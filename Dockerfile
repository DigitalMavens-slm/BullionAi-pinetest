# BullionAI backend — production image
# Runs the always-on Node server (Shoonya WebSocket + SSE + API) on :8787

FROM node:20-slim

# Freesst build tools not required; our deps are pure JS.
WORKDIR /app

# Install dependencies first for better layer caching
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source + data skeleton (monorepo: backend/ is the service root)
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/tests ./tests
COPY BullionAI-fixedtgt.pine BullionAI.pine ./ 2>/dev/null || true
# start-server.js stays at repo root for backwards compat; also try backend/
COPY start-server.js ./ 2>/dev/null || true
COPY backend/start-server.js ./ 2>/dev/null || true

# Data dir for candle datasets; symbols downloaded at runtime.
RUN mkdir -p /app/data /app/data/symbols

# Runtime
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# The API server auto-runs main() when required directly.
CMD ["node", "src/server/bullionai-api.js"]