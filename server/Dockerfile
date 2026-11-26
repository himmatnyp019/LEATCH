# syntax=docker/dockerfile:1

# ---- dependencies (production only) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Never run as root.
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1
STOPSIGNAL SIGTERM
CMD ["node", "src/server.js"]
