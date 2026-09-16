# Etapa 1: build del backend
# Va primero para que BuildKit no lo paralelice con el frontend
FROM node:20-alpine AS server-build
WORKDIR /server
COPY server/package.json ./
RUN npm install
# Cache-buster explícito: deploy-env.sh pasa el hash del árbol git de server/. Si
# cambió, la primera USA del ARG (este RUN) invalida la caché de todo lo que sigue,
# así la COPY de abajo nunca puede quedar "CACHED" con código viejo (bug real,
# visto varias veces). Sin el arg (build a mano, prod) queda vacío y no afecta.
ARG SERVER_HASH=
RUN echo "server@${SERVER_HASH}" > /dev/null
COPY server/ .
RUN NODE_OPTIONS="--max-old-space-size=512" npm run build

# Etapa 2: build del frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
# Fuerza a que este stage espere a que termine server-build. Sin esto, BuildKit
# corre ambos stages en paralelo (son independientes hasta la imagen final) sin
# importar el orden en que están escritos acá — en un servidor con poca RAM
# (como el de test) los dos "npm run build" (tsc + vite) al mismo tiempo pueden
# saturar la memoria y el build queda colgado haciendo swap sin avanzar.
COPY --from=server-build /server/dist /tmp/.server-build-done
COPY package.json package-lock.json* bun.lock* ./
RUN npm install --legacy-peer-deps
# Se copia SOLO lo que vite necesita, en vez de `COPY . .`. Con el copiado
# completo, cambiar un .md, un test o una migración invalidaba esta capa y
# obligaba a rehacer el build del frontend aunque no se hubiera tocado una línea
# de src/.
COPY index.html vite.config.ts tsconfig*.json postcss.config.js tailwind.config.js ./
ARG SRC_HASH=
RUN echo "src@${SRC_HASH}" > /dev/null
COPY src ./src
COPY public ./public
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN NODE_OPTIONS="--max-old-space-size=512" npx vite build

# Etapa 3: imagen final
FROM node:20-alpine
# Chromium para generacion de PDFs con puppeteer-core
RUN apk add --no-cache chromium ttf-dejavu
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
WORKDIR /app

COPY --from=server-build /server/node_modules ./node_modules
COPY --from=server-build /server/dist ./dist

# Frontend build -> el servidor lo sirve como archivos estaticos
COPY --from=frontend-build /app/dist ./public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
