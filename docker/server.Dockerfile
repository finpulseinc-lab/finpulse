# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace=shared --workspace=server --workspace=client

COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

# VITE_API_URL is intentionally empty: frontend and backend share the same
# Cloud Run origin, so all fetch() calls use relative paths (/api/files/...).
RUN npm run build -w shared && npm run build -w server && npm run build -w client

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
COPY --from=builder /app/client/dist ./client/dist

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
