# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace=shared --workspace=server

COPY shared/ ./shared/
COPY server/ ./server/

RUN npm run build -w server

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace=shared --workspace=server --omit=dev

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared ./shared

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
