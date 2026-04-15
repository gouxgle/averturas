# ── Etapa 1: build del frontend ──────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* bun.lock* ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# ── Etapa 2: build del backend ────────────────────────────────
FROM node:20-alpine AS server-build
WORKDIR /server
COPY server/package.json ./
RUN npm install
COPY server/ .
RUN npm run build

# ── Etapa 3: imagen final ─────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=server-build /server/node_modules ./node_modules
COPY --from=server-build /server/dist ./dist

# Frontend build → el servidor lo sirve como archivos estáticos
COPY --from=frontend-build /app/dist ./public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
