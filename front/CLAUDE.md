@AGENTS.md

# Front da versão Node (Next.js)

Metade do desafio [docs/desafios/node.md](../docs/desafios/node.md); consome a [`api/`](../api/CLAUDE.md).

- Next 16: Server Components buscam os dados, e as mutações passam por **Server Actions** (`src/actions/`), que são um diferencial do enunciado.
- O token JWT fica num cookie httpOnly e só é lido no servidor (`src/lib/session.ts`, `api.ts` e `dal.ts` com `server-only`). O browser nunca vê o token.
- Tailwind 4 + shadcn; identidade visual em [../docs/front/02-identidade-visual.md](../docs/front/02-identidade-visual.md).
- Plano por etapas e decisões: [../docs/front/README.md](../docs/front/README.md). Cache: [../docs/cache/](../docs/cache/README.md).

## Regras que não aparecem no código

- **Dados da requisição** (cookie, `searchParams`, hora atual) ficam dentro de `<Suspense>`. Nas páginas privadas, as leituras passam pelo `src/lib/dal.ts` (`use cache: private` + `cacheTag`); um valor que dependa da hora atual vai para um componente client. Qualquer leitura dinâmica fora desse escopo impede o Client Cache de reaproveitar a tela.
- **Leitura e escrita:** leitura é Server Component, escrita é Server Action (a busca de destinatário é a exceção). Depois de mexer em dinheiro, a action chama `walletChanged()`, que expira o cache e devolve a tela atualizada.
- **Dinheiro:** a API manda valores como string decimal. Exiba com `brl()`; converta para número só para enviar (`src/lib/money.ts`) e compare em centavos (`amountToCents`, `decimalToCents`).
- **Datas:** formate pelo `src/lib/format.ts`, no fuso `America/Sao_Paulo` (o servidor roda em UTC).
- **Erros da API:** as actions traduzem pelo status HTTP, em pt-BR (`toActionError` em `src/actions/wallet.ts`).
- **Skeletons:** repetem a estrutura do componente real (mesmas tags, paddings e tipografia; ver `src/components/wallet/skeletons.tsx`), e o conteúdo entra com `FADE_IN`.
- **`shadcn add`:** o gerador escreve `from "cn"` (troque por `@/lib/utils`) e pergunta se sobrescreve arquivos existentes (responda "não"). O `Toaster` usa tema fixo `light`, sem `next-themes`.
- **`@hookform/resolvers`** fica fixo em `5.2.2`: as versões mais novas conflitam com o Zod 4.
- **Verificação:** cache e prefetch se comportam diferente no `npm run dev`; confira em `npm run build && npm start`. O `build` também gera os tipos das rotas novas (`PageProps<"/rota">`).
