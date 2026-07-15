# ---- build do front (Vite) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: API Express + dist ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 3001
# schema.sql é idempotente: aplica migrações pendentes a cada deploy
# (não há passo manual no fluxo git push -> Coolify).
CMD ["sh", "-c", "node server/scripts/run-schema.js && node server/index.js"]
