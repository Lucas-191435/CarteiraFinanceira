# Plano — Modelagem da carteira financeira

## Objetivo

Adicionar ao banco e à API o suporte a carteira: depósito, transferência entre usuários, reversão (estorno) e histórico de movimentações.

Requisitos atendidos por este plano:

- Usuários podem enviar, receber e depositar dinheiro.
- Transferência valida saldo do remetente antes de executar.
- Depósito soma ao saldo mesmo quando ele está negativo.
- Depósito e transferência podem ser revertidos por inconsistência ou a pedido do usuário.
- Histórico da carteira mostra entradas, saídas e estornos.

## Decisões de modelagem

| Decisão | Motivo |
|---|---|
| `Wallet` separada de `User` (1:1) | Responsabilidade única; o usuário não carrega dado financeiro. |
| Uma tabela `Transaction` para todos os tipos (`DEPOSIT`, `TRANSFER`, `REVERSAL`) | Evita três fontes da verdade e um `UNION` para montar o extrato; a reversão é implementada uma vez só. |
| `LedgerEntry` registra o efeito em cada carteira (`CREDIT`/`DEBIT`) | É o histórico da carteira. Transferência gera 2 lançamentos, depósito gera 1. |
| Reversão é uma **nova** transação, nunca edição/exclusão | Histórico imutável. A original só muda `status` para `REVERSED`. |
| `reversalOfId @unique` | O banco impede estornar a mesma transação duas vezes. |
| `Wallet.balance` é cache; fonte da verdade = lançamentos | Leitura e validação rápidas, com conciliação possível (`balance == ΣCREDIT − ΣDEBIT`). |
| `balanceAfter` em cada lançamento | Extrato mostra a evolução do saldo sem recalcular; quebras na sequência ficam visíveis. |
| Valores em `Decimal(15,2)` | Nunca `Float` para dinheiro. |
| `idempotencyKey @unique` opcional | Evita operação duplicada por clique duplo / reenvio. |
| Saldo **pode** ficar negativo | Acontece em reversões (ex.: recebedor já gastou o valor). Sem `UNSIGNED`/`CHECK >= 0`. |
| `fromWalletId` e `toWalletId` opcionais | Depósito não tem origem; estorno de depósito não tem destino. Regra única: `from` recebe DEBIT, `to` recebe CREDIT. |
| `onDelete: Restrict` nas relações de `Transaction` | Apagar uma carteira nunca pode "desligar" o histórico (o padrão do Prisma seria `SET NULL`). |
| Destinatário da transferência pelo e-mail | Mais natural para o usuário do que um id de carteira. |

## Schema Prisma

```prisma
enum TransactionType {
  DEPOSIT
  TRANSFER
  REVERSAL
}

enum TransactionStatus {
  COMPLETED
  REVERSED
}

enum EntryDirection {
  CREDIT
  DEBIT
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  wallet       Wallet?
  transactions Transaction[] // operações que este usuário iniciou

  @@map("users")
}

model Wallet {
  id        String   @id @default(uuid())
  userId    String   @unique
  balance   Decimal  @default(0) @db.Decimal(15, 2) // cache; fonte da verdade = entries
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user                 User          @relation(fields: [userId], references: [id])
  entries              LedgerEntry[]
  outgoingTransactions Transaction[] @relation("FromWallet")
  incomingTransactions Transaction[] @relation("ToWallet")

  @@map("wallets")
}

model Transaction {
  id             String            @id @default(uuid())
  type           TransactionType
  status         TransactionStatus @default(COMPLETED)
  amount         Decimal           @db.Decimal(15, 2)
  description    String?
  idempotencyKey String?           @unique
  initiatorId    String // quem solicitou (não necessariamente de onde sai o dinheiro)
  fromWalletId   String? // null no depósito
  toWalletId     String? // null no estorno de depósito
  reversalOfId   String?           @unique // só em REVERSAL
  createdAt      DateTime          @default(now())

  initiator  User          @relation(fields: [initiatorId], references: [id])
  fromWallet Wallet?       @relation("FromWallet", fields: [fromWalletId], references: [id], onDelete: Restrict)
  toWallet   Wallet?       @relation("ToWallet", fields: [toWalletId], references: [id], onDelete: Restrict)
  reversalOf Transaction?  @relation("Reversal", fields: [reversalOfId], references: [id], onDelete: Restrict)
  reversedBy Transaction?  @relation("Reversal")
  entries    LedgerEntry[]

  @@index([fromWalletId, createdAt])
  @@index([toWalletId, createdAt])
  @@map("transactions")
}

model LedgerEntry {
  id            String         @id @default(uuid())
  walletId      String
  transactionId String
  direction     EntryDirection
  amount        Decimal        @db.Decimal(15, 2)
  balanceAfter  Decimal        @db.Decimal(15, 2)
  createdAt     DateTime       @default(now())

  wallet      Wallet      @relation(fields: [walletId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@index([walletId, createdAt])
  @@map("ledger_entries")
}
```

Observação: em `Transaction`, `type`/`status` descrevem a operação; em `LedgerEntry`, `direction` descreve o efeito em uma carteira. `CREDIT`/`DEBIT` **não** é status.

## Regras de saldo

1. `Wallet.balance` só muda junto com a criação de `LedgerEntry` — nunca `UPDATE` solto (nem em seed/admin; saldo inicial é um depósito).
2. Criar `Transaction` + `LedgerEntry` + atualizar `balance` acontece em **um** `prisma.$transaction`.
3. Antes de ler o saldo, travar a(s) carteira(s) com `SELECT ... FOR UPDATE`. Com duas carteiras, travar sempre em ordem de `id` (evita deadlock).
4. O cálculo usa o saldo travado no banco; o cliente envia só o valor da operação.
5. Somente a **transferência** valida saldo. Depósito e reversão não.

## Fluxo de cada operação

Esqueleto comum: validar entrada → travar carteiras → calcular novos saldos → criar `Transaction` com `entries` → atualizar `balance`.

### Depósito

- Valida: valor > 0. Usuário deposita na própria carteira.
- Trava: carteira de destino.
- `Transaction`: `DEPOSIT`, `COMPLETED`, `fromWalletId = null`, `toWalletId = carteira`.
- Lançamentos: 1 → destino `CREDIT`, `balanceAfter = saldo + valor`.
- Saldo negativo: a soma resolve (−30 + 100 = 70), sem caso especial.

### Transferência

- Valida: valor > 0, destinatário existe, destinatário ≠ remetente, **saldo do remetente ≥ valor** (lido após o lock).
- Trava: as duas carteiras, em ordem de `id`.
- `Transaction`: `TRANSFER`, `COMPLETED`, `fromWalletId = A`, `toWalletId = B`, `initiatorId = A`.
- Lançamentos: 2 → A `DEBIT` (`saldoA − valor`), B `CREDIT` (`saldoB + valor`).

### Reversão

- Valida: transação original existe, está `COMPLETED`, não é `REVERSAL`, e quem pede é o `initiatorId` dela (ou admin/sistema em caso de inconsistência).
- Trava: as carteiras envolvidas na original.
- Cria `Transaction`: `REVERSAL`, `COMPLETED`, `reversalOfId = original`, `from`/`to` invertidos, `initiatorId` = quem pediu.
- Lançamentos (direções inversas às da original):
  - Reversão de transferência: 2 → B `DEBIT`, A `CREDIT`.
  - Reversão de depósito: 1 → carteira `DEBIT`.
- Atualiza a original para `status = REVERSED`.
- Não valida saldo: a carteira debitada pode ficar negativa.

### Exemplo

A deposita 100, transfere 30 para B e depois estorna:

| Transaction | LedgerEntry (carteira, direção, valor, `balanceAfter`) |
|---|---|
| T1 `DEPOSIT` 100 | A, CREDIT, 100, 100 |
| T2 `TRANSFER` 30 → vira `REVERSED` | A, DEBIT, 30, 70 · B, CREDIT, 30, 30 |
| T3 `REVERSAL` 30, `reversalOfId = T2` | B, DEBIT, 30, 0 · A, CREDIT, 30, 100 |

Lançamentos antigos nunca são alterados; T2 só muda de status.

## Histórico / extrato

- Extrato de um usuário = `LedgerEntry` da carteira dele, ordenado por `createdAt`, com a `Transaction` incluída (tipo, status, contraparte).
- Uma transação aparece no extrato das duas carteiras envolvidas, cada uma pelo seu lançamento.
- Por mês: saldo inicial = `balanceAfter` do último lançamento antes do mês; saldo final = `balanceAfter` do último lançamento do mês; entradas/saídas = soma de `CREDIT`/`DEBIT` no período.
- Estorno de mês anterior cai no mês em que foi feito; meses passados não mudam.
- Limites de mês calculados em `America/Sao_Paulo` e convertidos para UTC antes da consulta.

## Etapas de implementação

Status: **concluído** (24/10/2026).

1. ✅ **Schema**: migration `wallet`, com backfill que cria carteira (saldo 0) para usuários já cadastrados.
2. ✅ **Cadastro**: `UserRepository.createUser` cria a `Wallet` junto (nested create). Seed (`prisma/seeds/create-wallet-scenarios.seed.ts`) cria 6 usuários `@carteira.com` (senha `Teste123@`) com histórico de jun–out/2026 gerado pelo próprio `WalletService`: rotina mensal, transferência para a pessoa errada + estorno, empréstimo contestado deixando saldo negativo + depósito somando ao negativo, depósito com valor errado + estorno, pagamento em duplicidade + estorno, tentativa sem saldo e `idempotencyKey` repetida (recusadas), e um usuário terminando negativo.
3. ✅ **Módulo `wallet`** (`src/modules/wallet`):
   - Repository: `lockWallets` (`SELECT ... FOR UPDATE` em ordem de id) e `postTransaction` (cria transação + lançamentos + atualiza saldo).
   - `GET /wallet` — saldo atual.
   - `GET /wallet/statement?page&pageSize&from&to` — extrato paginado, com contraparte.
   - `POST /wallet/deposit` — `{ amount, description?, idempotencyKey? }`.
   - `POST /wallet/transfer` — `{ toEmail, amount, description?, idempotencyKey? }`.
   - `POST /wallet/transactions/:id/reverse` — `{ reason? }`. Só quem iniciou a operação pode estornar.
4. ✅ **Erros**: `400` entrada inválida / para si mesmo / estornar um estorno; `403` estorno pedido por outro usuário; `404` carteira, destinatário ou transação; `409` já revertida ou `idempotencyKey` repetida; `422` saldo insuficiente.
5. ✅ **Swagger**: DTOs de request/response e `@ApiResponse` por erro. Valores monetários saem como string decimal (ex.: `"100.5"`).
6. ✅ **Testes** (`test/wallet.e2e-spec.ts`, `npm run test:e2e`): integração contra MySQL real no banco `<DATABASE_NAME>_test` (migrations aplicadas com `migrate deploy`). Cobrem depósito, idempotência, transferência, saldo insuficiente, transferência para si mesmo, 5 transferências simultâneas (lock), estorno de transferência e de depósito, saldo negativo + depósito, estorno duplo (inclusive em paralelo), estorno de estorno, permissão e extrato. Todos verificam a invariante `balance == ΣCREDIT − ΣDEBIT`.

## Melhorias futuras

- Fechamento mensal de saldo (tabela de fechamento por carteira/mês) para conciliação e relatórios estáveis.
- Job de conciliação automática: `Wallet.balance` × `ΣCREDIT − ΣDEBIT` e consistência da sequência de `balanceAfter`.
- Limites de transferência (diário/mensal).
- Coluna sequencial nos lançamentos para desempate de ordem no extrato (hoje: `createdAt` com precisão de ms + `id`).
- Rate limit específico para as rotas da carteira (hoje vale o global de 10 req/min).
- Campo `reason` / usuário de sistema para estornos automáticos por inconsistência.
