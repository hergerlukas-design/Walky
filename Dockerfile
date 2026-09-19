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
# Vite backt VITE_*-Variablen fest ein, deshalb müssen sie hier anliegen.
ARG VITE_TURN_URLS=""
ARG VITE_TURN_USERNAME=""
ARG VITE_TURN_CREDENTIAL=""
ARG VITE_STUN_URLS=""
ENV VITE_TURN_URLS=$VITE_TURN_URLS \
    VITE_TURN_USERNAME=$VITE_TURN_USERNAME \
    VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL \
    VITE_STUN_URLS=$VITE_STUN_URLS
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
