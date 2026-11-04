# Meme-Tinder

Tinder but for memes

A proof of concept that workshop teams fork and extend. It is an npm workspaces monorepo:

- `backend/`: Express + TypeScript API on port 3000. Serves the seed memes (original SVGs in `backend/assets/memes`).
- `frontend/`: React + Vite + TypeScript on port 5173. The dev server proxies `/api` to the backend.
- `mcp/`: a stdio MCP server so Claude Code or Claude Desktop can create memes (see [Agent (MCP)](#agent-mcp)).

## Requirements

- Node.js 22 or newer (see `.nvmrc`; run `nvm use` if you use nvm)
- npm 10 or newer

## Quick start

```bash
npm install
npm run dev
```

To run in Docker instead, or for more detail on both options, see [deploy/README.md](deploy/README.md).

Open http://localhost:5173, then swipe memes by dragging the card, with the Like and Nope buttons or with the left and right arrow keys, and use the Likes tab to see what you liked. When all memes are swiped, press Reset to start over. Use the Post tab to post your own image with a caption, or the Create tab to make a meme from a well-known template (for example "This is Fine"); both go first in everyone's pile.

## Commands

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | Starts backend and frontend in watch mode                             |
| `npm test`          | Runs all backend and frontend tests                                   |
| `npm run build`     | Builds both workspaces                                                |
| `npm run lint`      | Lints the repository with ESLint                                      |
| `npm run format`    | Formats the repository with Prettier                                  |
| `npm run typecheck` | Type checks both workspaces, including tests                          |
| `npm run check`     | Runs everything CI runs (format check, lint, type check, build, test) |

CI (GitHub Actions, [.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `npm run check` steps and a Docker image build on every push to `main` and every pull request.

## API

All endpoints are under `/api` and need an `X-User-Id` header (the frontend creates an anonymous id on first visit and stores it in localStorage).

| Endpoint                                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/memes/next`                              | `200 { "meme": {...}, "stats": { "likes": n, "nopes": n, "lovePercent": 0-100 \| null } }` with the next unseen meme and how much all users love it (`lovePercent` is `null` before anyone swiped it), or `200 { "meme": null, "stats": null }` when all memes have been swiped                                                                                                                                                                                                                          |
| `GET /api/trending`                                | `200 { "window": "hour" \| "all", "memes": [{ "meme": {...}, "likes": n, "nopes": n, "lovePercent": n }] }`: up to 10 liked memes from all users, by likes, then love percent, then catalog order. Uses the last hour, or all time (`"all"`) when the last hour had fewer than 5 swipes                                                                                                                                                                                                                  |
| `GET /api/pulse`                                   | `200 { "swipesPerMinute": n }`: swipes (likes and nopes) from all users in the last 60 seconds                                                                                                                                                                                                                                                                                                                                                                                                           |
| `POST /api/swipes`                                 | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `GET /api/likes`                                   | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)                                                                                                                                                                                                                                                                                                                                                                                                       |
| `DELETE /api/swipes`                               | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                                                                                                                                                                                                                                                                                                                                                                                                             |
| `POST /api/memes`                                  | Body `{ "caption": "...", "image": "data:image/png;base64,..." }`. Posts a meme first in every user's pile (newest first). The image is stored as an SVG with the caption in a band at the bottom, like the seed memes. `201` with the new meme. Captions are 1–140 characters; images are PNG, JPEG, GIF, WebP or SVG, up to 1 MB, and the content must match the type                                                                                                                                  |
| `GET /api/memes/uploads/:id`                       | The uploaded image (no `X-User-Id` needed). Served with a strict `Content-Security-Policy`, so scripts in an uploaded SVG never run. `404` for an unknown id                                                                                                                                                                                                                                                                                                                                             |
| `GET /api/templates?q=...`                         | `200 { "templates": [{ "id", "name", "lines", "imageUrl" }] }`: meme templates whose id, name or keywords match `q` (case-insensitive), at most 24; the first templates when `q` is empty. `imageUrl` is the blank template image. `502` when the template provider is unavailable                                                                                                                                                                                                                       |
| `GET /api/templates/:id/preview?text=...&text=...` | The template rendered with one `text` per line, top to bottom (no `X-User-Id` needed; it is used as an `<img src>`). Nothing is stored. `200` with the image, `X-Content-Type-Options: nosniff` and `Cache-Control: public, max-age=3600`. `404` for an unknown template, `400` for invalid texts, `502` when the provider is unavailable                                                                                                                                                                |
| `POST /api/memes/from-template`                    | Body `{ "templateId": "fine", "texts": ["...", "..."] }`. Renders the template and posts it first in every user's pile, with the text on the image and no caption band. `201` with the new meme (like `POST /api/memes`); its caption is the non-empty lines joined with `" / "`. At most one text per template line, each up to 100 characters, at least one not blank, 140 characters in total. `400` for a missing or unknown `templateId` or invalid `texts`, `502` when the provider is unavailable |
| `GET /api/me`                                      | `200 { "profile": { "id": "...", "nickname": "...", "emoji": "...", "bot": false } }` with the user's profile. The first call creates it with a random nickname and emoji. `id` is public; the `X-User-Id` is never returned                                                                                                                                                                                                                                                                             |
| `PUT /api/me`                                      | Body `{ "nickname": "...", "emoji": "..." }`. `200 { "profile": {...} }` with the updated profile. Nicknames are 1–30 characters (trimmed); the emoji must be exactly one emoji                                                                                                                                                                                                                                                                                                                          |

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id, invalid direction, an invalid posted meme or an invalid nickname or emoji, `413` for a request body over 2 MB, `404` for an unknown meme id, `502` when the meme template provider is unavailable (the message never includes provider details). Swiping the same meme twice is idempotent: the first swipe is kept.

Swipes are stored in memory (`backend/src/swipes/repository.ts`) by default and are lost on restart. Set `DATABASE_FILE` to a file path to store them in SQLite (`backend/src/swipes/sqlite-repository.ts`) instead; Docker does this by default (see [deploy/README.md](deploy/README.md)). To plug in another database, implement `SwipeRepository`. Posted memes and their images (`backend/src/memes/imageStore.ts`) are still stored in memory only, so they are lost on restart.

Templates come from [memegen.link](https://memegen.link) (free, no key). Only the backend talks to it, through the `TemplateSource` interface in `backend/src/templates/source.ts`, so the provider can be swapped in one module. Set `MEMEGEN_BASE_URL` to point at another instance (see [deploy/README.md](deploy/README.md)).

## Agent (MCP)

`mcp/` is a small stdio [MCP](https://modelcontextprotocol.io) server, so you can ask Claude Code or Claude Desktop to make a meme, for example: "post a meme using the 'this is fine' dog with a funny caption about vibecoding". Claude writes the text itself on your own Claude subscription; the server only exposes two tools and needs no API key:

- `search_templates({ query })`: matching templates with their id, name and number of lines
- `create_meme({ templateId, texts })`: posts the meme and returns its caption and image URL

It is a thin client of the HTTP API above, so the backend must be running. Configure it with environment variables:

| Variable              | Default                 | What it does                           |
| --------------------- | ----------------------- | -------------------------------------- |
| `MEME_TINDER_URL`     | `http://localhost:3000` | The Meme-Tinder backend                |
| `MEME_TINDER_USER_ID` | `agent-claude`          | Sent as `X-User-Id` with every request |

Build it, then register it with Claude Code (use the absolute path of your checkout):

```bash
npm run build -w mcp
claude mcp add meme-tinder --env MEME_TINDER_URL=http://localhost:3000 -- node /absolute/path/to/mcp/dist/index.js
```

For Claude Desktop, add it to `claude_desktop_config.json` and restart the app:

```json
{
  "mcpServers": {
    "meme-tinder": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/dist/index.js"],
      "env": { "MEME_TINDER_URL": "http://localhost:3000" }
    }
  }
}
```

With `npm run dev`, the backend is on port 3000, so the default URL works. The created meme is first in the pile at http://localhost:5173. The Docker image does not ship the MCP server; run it locally and point `MEME_TINDER_URL` at the container (`http://localhost:3000` by default).
