# ---------- build: instala tudo, gera o Prisma Client e compila ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# prisma generate não conecta no banco, mas o prisma.config.ts exige DATABASE_URL definida
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate
RUN npm run build

# ---------- runtime: só dependências de produção + build ----------
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3333

# Aplica migrations pendentes (não destrutivo) e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
