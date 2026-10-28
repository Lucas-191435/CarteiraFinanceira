# Carteira Financeira

Carteira financeira em que usuários se cadastram, se autenticam, depositam, transferem saldo entre si e revertem operações, com histórico completo de movimentações.

| Pasta | Conteúdo |
|---|---|
| [`api/`](api/) | API REST — NestJS, TypeScript, Prisma, MySQL, JWT, Swagger |
| [`front/`](front/) | Front-end — Next.js 16, Server Components + Server Actions, Tailwind v4, shadcn |

## Requisitos

- **Docker** com Docker Compose — para o ambiente completo
- **Node.js 22+** e **MySQL 8** local — apenas para desenvolver a API fora do Docker

## Rodando com Docker (ambiente completo)

Sobe banco, cache, API e front sem precisar instalar nada além do Docker.

```bash
# 1. Variáveis do compose
cp .env.example .env
# edite o .env e defina um JWT_SECRET (o .env.example mostra como gerar um)

# 2. Sobe tudo (as migrations rodam ao iniciar a API; o front espera a API ficar saudável)
docker compose up -d --build

# 3. (Opcional) Popula o banco com usuários e histórico de exemplo
docker compose --profile tools run --rm seed
```

Pronto:

- **Front: http://localhost:4000** (login com os usuários de exemplo, senha `Teste123@`)
- API: http://localhost:4333
- Swagger: http://localhost:4333/docs/swagger
- MySQL do container: `localhost:4306` (usuário `root`, senha do `.env`)
- Redis (cache da API): `localhost:4379` — opcional: se não estiver no ar, a API consulta o banco direto

### Comandos do dia a dia

Cada aplicação é atualizada separadamente.

> **Menu interativo:** `node menu.mjs` na raiz lista os comandos abaixo (e os de dev local e qualidade) para escolher com as setas. Ctrl+C encerra o comando em execução e volta ao menu.

| Objetivo | Comando |
|---|---|
| Subir tudo | `docker compose up -d --build` |
| Atualizar só a API (rebuild + restart, sem mexer no banco) | `docker compose up -d --build --no-deps api` |
| Atualizar só o front | `docker compose up -d --build --no-deps front` |
| Popular o banco do container | `docker compose --profile tools run --rm seed` |
| Ver logs da API / do front | `docker compose logs -f api` / `docker compose logs -f front` |
| Ver status dos containers | `docker compose ps` |
| Parar tudo (os dados do banco são mantidos) | `docker compose down` |
| Parar e **apagar** os dados do banco | `docker compose down -v` |

### Variáveis (`.env` da raiz)

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_NAME` | `carteiraFinanceiraBolt` | Nome do banco criado no container |
| `DATABASE_PASSWORD` | `12345678` | Senha do `root` do MySQL do container |
| `MYSQL_PORT` | `4306` | Porta do MySQL na sua máquina |
| `API_PORT` | `4333` | Porta da API na sua máquina |
| `REDIS_PORT` | `4379` | Porta do Redis na sua máquina |
| `FRONT_PORT` | `4000` | Porta do front na sua máquina |
| `SHOW_TEST_USERS` | `true` | Mostra o atalho dos usuários de exemplo na tela de login (vale no build: depois de mudar, rebuild do front) |
| `JWT_SECRET` | — | **Obrigatória.** Segredo para assinar os tokens |
| `SWAGGER_USER` / `SWAGGER_PASSWORD` | — | Login (HTTP Basic) da documentação em `/docs/swagger`. Vazias, a documentação fica aberta. As rotas exigem o JWT de qualquer forma |

## Desenvolvendo a API (sem Docker)

Usa o MySQL instalado na sua máquina e hot reload.

```bash
cd api
cp .env.example .env        # ajuste usuário/senha/porta do seu MySQL e o JWT_SECRET
npm install
npx prisma generate
npm run prisma:migrate      # cria o banco e aplica as migrations
npm run seed                # opcional
npm run dev
```

> O `npm run dev` usa as mesmas portas dos containers (API 4333, front 4000). A faixa 4xxx é só deste projeto, então ele não disputa porta com outros projetos; para rodar o dev, pare antes os containers com `docker compose stop api front`.

Também dá para desenvolver usando só o banco e o cache do Docker: `npm run db:up` (sobe o MySQL e o Redis do compose) e aponte o `api/.env` para `localhost:4306`.

### Scripts da API

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe a API em modo watch |
| `npm run build` / `npm run start:prod` | Compila e roda a versão compilada |
| `npm run prisma:migrate` | Cria/aplica migrations no banco de desenvolvimento |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run seed` | Popula o banco com os cenários de exemplo |
| `npm run test:e2e` | Testes de integração (usam o banco `<DATABASE_NAME>_test`, nunca o de desenvolvimento) |
| `npm run lint` | ESLint |
| `npm run db:up` / `npm run db:down` | Sobe/para o MySQL e o Redis do compose |

## Usuários de exemplo

Criados pelo seed, todos com a senha **`Teste123@`**:

| E-mail | Cenário |
|---|---|
| ana@carteira.com | Empresta e contesta (estorno) |
| bruno@carteira.com | Pagamento em duplicidade estornado |
| carla@carteira.com | Fica negativa após um estorno; depósito soma ao negativo |
| diego@carteira.com | Transfere para a pessoa errada e estorna |
| elisa@carteira.com | Deposita valor errado e estorna |
| fabio@carteira.com | Termina com saldo negativo |

Detalhes de cada cenário em [`api/prisma/seeds/README.md`](api/prisma/seeds/README.md).

## Principais endpoints

Todos, exceto cadastro e login, exigem `Authorization: Bearer <token>`. Documentação completa no Swagger.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/user` | Cadastro |
| `POST` | `/auth/login` | Login (retorna o token JWT) |
| `GET` | `/user/me` | Dados do usuário autenticado |
| `GET` | `/wallet` | Saldo atual |
| `GET` | `/wallet/statement` | Extrato paginado (filtro opcional por período) |
| `POST` | `/wallet/deposit` | Depósito |
| `POST` | `/wallet/transfer` | Transferência para outro usuário (pelo e-mail) |
| `POST` | `/wallet/transactions/:id/reverse` | Estorno de depósito ou transferência |

## Documentação

- [Modelagem da carteira](api/docs/plano-modelagem-carteira.md) — decisões de modelagem, regras de saldo, fluxo de cada operação e melhorias futuras
- [Seeds](api/prisma/seeds/README.md) — usuários e cenários de exemplo
- [Front](front/README.md) — como rodar o `front/` (Next.js + Server Actions) sozinho
