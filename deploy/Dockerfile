# Build context is the repository root (see docker-compose.yml).

# --- Build stage: install everything and build both workspaces ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run build

# --- Runtime stage: production dependencies, built backend and built frontend ---
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 STATIC_DIR=/app/frontend/dist DATABASE_FILE=/app/data/swipes.db
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend --include-workspace-root=false
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/assets backend/assets
COPY --from=build /app/frontend/dist frontend/dist
# The SQLite database lives here; docker-compose.yml mounts a volume on it.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
