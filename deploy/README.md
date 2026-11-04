# Running Meme-Tinder

The app runs either in Docker (one command, no Node needed) or locally with Node.

## Docker

Requires Docker with Compose. From the repository root:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Open http://localhost:3000. Stop with `Ctrl+C`, or `docker compose -f deploy/docker-compose.yml down` if you started it with `-d`.

How it works:

- One container, one process, one port (3000). There is no CORS or proxy configuration.
- `deploy/Dockerfile` is multi-stage (`node:22-alpine`, matching `.nvmrc`). The build stage installs all workspaces and runs `npm run build`. The final stage installs only the backend's production dependencies and copies in the built backend, the meme assets and the built frontend.
- The backend serves the built frontend when the `STATIC_DIR` environment variable is set (the image sets it to `/app/frontend/dist`). Unknown non-API paths fall back to `index.html`; `/api` paths are never shadowed.
- Swipes are stored in SQLite at `/app/data/swipes.db` (the image sets `DATABASE_FILE`), on the named volume `meme-data`, so they survive restarts and `down`/`up`. To start from scratch, run `docker compose -f deploy/docker-compose.yml down -v`, which deletes the volume.
- To use another host port, change `"3000:3000"` in `deploy/docker-compose.yml`, for example to `"8080:3000"`.

## Local

Requires Node.js 22 or newer (see `.nvmrc`; run `nvm use` if you use nvm) and npm 10 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend on port 3000.

To try the production setup without Docker:

```bash
npm run build
STATIC_DIR=frontend/dist npm start -w backend
```

Then open http://localhost:3000.

## Persistence

By default the backend keeps swipes in memory, so they are lost on restart (handy for `npm run dev` and tests). Set `DATABASE_FILE` to a file path to store them in SQLite instead, for example:

```bash
DATABASE_FILE=data/swipes.db npm run dev -w backend
```

The folder must exist; the file and table are created on first start. SQLite comes from Node's built-in `node:sqlite` module (Node 22.13 or newer, no extra dependency). Node may print an `ExperimentalWarning` for it on startup; that is expected.

## Meme templates

The Create tab (and the MCP server, see the root [README.md](../README.md#agent-mcp)) renders memes from templates with [memegen.link](https://memegen.link). The backend calls it at `https://api.memegen.link` by default. Set `MEMEGEN_BASE_URL` to use another instance, for example a self-hosted one:

```bash
MEMEGEN_BASE_URL=http://localhost:5000 npm run dev -w backend
```

This feature needs outbound internet access from the backend (or the container). Without it, the Create tab and the MCP tools show "The meme template service is unavailable" and the rest of the app keeps working. With Docker Compose, pass the variable under `environment:` in `deploy/docker-compose.yml`.
