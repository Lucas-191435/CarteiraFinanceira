# ---------- deps: só instala (camada reaproveitada enquanto o lockfile não muda) ----------
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build: compila o Next em modo standalone ----------
FROM node:22-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* é embutido no JavaScript do browser na hora do build, por isso é ARG (e não env de runtime)
ARG NEXT_PUBLIC_SHOW_TEST_USERS=false
ENV NEXT_PUBLIC_SHOW_TEST_USERS=$NEXT_PUBLIC_SHOW_TEST_USERS
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- runtime: só o servidor standalone + assets ----------
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégios para rodar o servidor
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# API_URL e APP_URL chegam em runtime pelo compose (lidos só no servidor)
CMD ["node", "server.js"]
