# API da versão Node (NestJS)

Metade do desafio [docs/desafios/node.md](../docs/desafios/node.md); a outra metade é o [`front/`](../front/CLAUDE.md), que consome esta API.

- NestJS + TypeScript, Prisma (MySQL), JWT, Swagger em `/docs/swagger`. Redis é opcional: sem ele, a API consulta o banco direto.
- Cada domínio em `src/modules/<domínio>/`, com controller, service, repository e DTOs. Infraestrutura compartilhada (auth, cache, database, middleware, validators) em `src/common/`.
- As regras da carteira ficam em `src/modules/wallet/wallet.service.ts`. O SQL sensível (lock `FOR UPDATE` em ordem de id, update condicional do estorno, lançamentos do ledger) fica em `wallet.repository.ts`.
- Os testes e2e (`test/wallet.e2e-spec.ts`) usam o banco `<DATABASE_NAME>_test`, nunca o de desenvolvimento.
- Comandos, Docker e variáveis: [README.md da raiz](../README.md). Decisões de modelagem: [docs/plano-modelagem-carteira.md](docs/plano-modelagem-carteira.md). Cache: [../docs/cache/](../docs/cache/README.md).

## Regras que não aparecem no código

- **Saldo:** muda só junto com lançamentos no ledger, dentro de `runInTransaction`, com `lockWallets` antes de ler; a validação de saldo usa o valor travado, lido do banco.
- **Cache nas escritas:** toda operação que move dinheiro chama `cache.bumpWallets(...)` com todas as carteiras envolvidas (as duas pontas de uma transferência), depois do commit.
- **Cache nas leituras:** a chave inclui a versão da carteira, e a resposta sai no formato JSON (`Decimal` e `Date` como string), venha do banco ou do Redis.
- **`canReverse`:** a regra vive em dois lugares, `getStatement` e `reverse()`, no `wallet.service.ts`; mude os dois juntos.
- **Senha:** a política é a mesma em `src/common/validators/password.validator.ts` e `front/src/validations/password.ts`; mude os dois juntos.
- **Contrato com o front:** o front traduz os erros pelo status HTTP (400, 403, 404, 409, 422) e espelha os DTOs em `front/src/types/`; ao mudar um status ou um campo, atualize o front.
- **Rate limit:** as chamadas chegam pelo servidor do Next, então todos os usuários compartilham um IP. O limite global fica alto, e o limite apertado vai por rota, com `@Throttle`.
- **Prisma 7:** depois de `prisma migrate dev`, rode `npx prisma generate`. O client gerado fica em `src/generated/`; as mudanças vão no `schema.prisma`.
- **Banco:** recriar o banco (`prisma migrate reset`) é com o usuário. Os testes aplicam as migrations com `migrate deploy` e precisam do MySQL (e do Redis para os testes de cache): `npm run db:up`.
- **Seed:** passa pelo `WalletService` (com `new CacheService(null)`), para obedecer às mesmas regras da API.
