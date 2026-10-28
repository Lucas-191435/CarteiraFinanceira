# Front — Carteira Bolt

Next.js 16 (App Router, Cache Components) + React 19, Tailwind v4 e shadcn/ui. Leituras em Server Components, escritas em **Server Actions**; o token da API fica só num cookie `httpOnly`.

```bash
cp .env.example .env.local   # API_URL, APP_URL, NEXT_PUBLIC_SHOW_TEST_USERS
npm install
npm run dev                  # http://localhost:4000 (a API precisa estar em API_URL)
npm run build && npm run lint
```

Para subir a stack completa (MySQL, Redis, API e front) com Docker, veja o [README da raiz](../README.md).
