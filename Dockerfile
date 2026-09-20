# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- Abhängigkeiten
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------ Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Keine TURN-Zugangsdaten im Build: die liefert der Server zur Laufzeit unter
# /api/ice aus. Sonst lägen sie im öffentlichen Bundle und im Image.
RUN npm run build

# ----------------------------------------------------------- Produktionspaket
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ----------------------------------------------------------------- Laufzeitbild
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY package.json ./

# Kein Root im Container — das Node-Image bringt den Benutzer schon mit.
USER node

EXPOSE 8080
CMD ["node", "dist-server/server/index.js"]
