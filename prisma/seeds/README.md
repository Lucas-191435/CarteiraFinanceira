# Seeds

Dados de exemplo para desenvolvimento e demonstração da carteira financeira.

## Como rodar

```bash
npm run seed            # ou: npx prisma db seed
```

Para começar com o banco limpo (**apaga todos os dados**, use só em desenvolvimento):

```bash
npx prisma migrate reset
npm run seed
```

No ambiente Docker (banco do container), a partir da raiz do projeto:

```bash
docker compose --profile tools run --rm seed
```

O seed é seguro para rodar mais de uma vez: se `ana@carteira.com` já existir, ele é pulado.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `../seed.ts` | Ponto de entrada (`prisma db seed`); chama os seeds abaixo. |
| `../database.ts` | `PrismaClient` standalone (fora do Nest) usado pelos seeds. |
| `create-wallet-scenarios.seed.ts` | Cria os 6 usuários e o histórico de jun–out/2026. |

## Usuários

Senha de todos: **`Teste123@`**

| Usuário | E-mail | Saldo final | Lançamentos | Perfil |
|---|---|---:|---:|---|
| Ana Souza | ana@carteira.com | 16.450,00 | 22 | Salário fixo, paga aluguel, empresta dinheiro |
| Bruno Lima | bruno@carteira.com | 35.850,00 | 24 | Recebe aluguéis, paga serviços |
| Carla Mendes | carla@carteira.com | 1.950,00 | 19 | Fica negativa após um estorno |
| Diego Rocha | diego@carteira.com | 3.100,00 | 22 | Transfere para a pessoa errada e estorna |
| Elisa Martins | elisa@carteira.com | 16.250,00 | 28 | Freelancer, deposita valor errado e estorna |
| Fábio Costa | fabio@carteira.com | **-200,00** | 19 | Termina o período com saldo negativo |

## Como o histórico é gerado

As operações **passam pelo `WalletService`**, não são inserções diretas no banco. Assim o seed obedece às mesmas regras da API: lock das carteiras, validação de saldo na transferência, `balanceAfter` correto e estorno com movimento inverso. Se uma regra mudar, o seed continua coerente (ou falha, avisando).

Como o service grava com a data atual, cada operação tem o `createdAt` da transação e dos lançamentos ajustado logo depois (`backdate`). A linha do tempo é ordenada por data e executada em ordem cronológica, para que a sequência de `balanceAfter` acompanhe as datas.

Horários em Brasília (`-03:00`).

## Rotina mensal

Repete de junho a setembro; em outubro (mês corrente) vai só até o dia 20.

| Dia | Operação |
|---|---|
| 05 | Depósitos: Ana 5000 (salário), Bruno 3000, Carla 1500, Diego 2500, Elisa 1200, Fábio 600 |
| 08 | Ana → Bruno 1800 (aluguel) |
| 10 | Diego → Bruno 1500 (aluguel) |
| 12 | Elisa → Ana 150 (rateio da internet) |
| 15 | Bruno → Fábio 300 (serviço de jardinagem) |
| 18 | Carla → Elisa 200 (aula particular) |
| 20 | Fábio → Diego 80 (pizza dividida) |
| 22 | Ana → Carla 250 (ajuda com transporte) — exceto outubro |
| 25 | Diego → Elisa 400 (design do site) — exceto outubro |
| 27 | Depósito Elisa 800 (freelance extra) — exceto outubro |

## Cenários especiais

| Data | Cenário | O que demonstra |
|---|---|---|
| 26/08 | Diego transfere 700 para a Carla por engano, estorna 12 min depois e envia para a Elisa | Estorno de transferência a pedido do usuário |
| 02–05/09 | Ana empresta 1200 para a Carla; Carla gasta quase tudo; Ana contesta e estorna → Carla fica com **-900**; o depósito do dia 05 leva a Carla para 600 | Estorno que deixa o recebedor negativo e depósito somando ao saldo negativo |
| 06/09 | Elisa deposita 5000 (queria 500), estorna e deposita 500 | Estorno de depósito (1 lançamento `DEBIT`) |
| 15–16/10 | Bruno paga o Fábio em duplicidade e estorna a cópia no dia seguinte | Estorno de operação duplicada |
| 21/10 | Fábio tenta transferir 50.000 sem saldo | Validação de saldo (`422`, nenhuma transação criada) |
| 21/10 | Ana deposita 700 com `idempotencyKey` e reenvia a mesma chave | Idempotência (`409`, o depósito não duplica) |
| 22–23/10 | Fábio gasta quase tudo; Bruno estorna o serviço de outubro → Fábio termina com **-200** | Usuário com saldo negativo no estado atual |

## O que dá para explorar com esses dados

- **Extrato por mês**: `GET /wallet/statement?from=2026-09-01T03:00:00.000Z&to=2026-10-01T03:00:00.000Z` (setembro em horário de Brasília).
- **Transações estornadas**: no extrato aparecem com `status: REVERSED`, seguidas do lançamento `REVERSAL`.
- **Saldo negativo**: logar como `fabio@carteira.com`.
- **Estornar algo novo**: qualquer transação `COMPLETED` iniciada pelo usuário logado (pegue o `transaction.id` no extrato).
