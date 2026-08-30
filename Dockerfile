# BullionAI backend — production image
# Runs the always-on Node server (Shoonya WebSocket + SSE + API) on :8787

FROM node:20-slim

# Freesst build tools not required; our deps are pure JS.
WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source + data skeleton
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY BullionAI-fixedtgt.pine BullionAI.pine ./ 2>/dev/null || true
COPY start-server.js ./

# Data dir for candle datasets; symbols downloaded at runtime.
RUN mkdir -p /app/data /app/data/symbols

# Runtime
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# The API server auto-runs main() when required directly.
CMD ["node", "src/server/bullionai-api.js"]