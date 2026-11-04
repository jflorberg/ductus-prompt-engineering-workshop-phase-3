# Meme-Tinder

Tinder but for memes

A proof of concept that workshop teams fork and extend. It is an npm workspaces monorepo:

- `backend/`: Express + TypeScript API on port 3000. Serves the seed memes (original SVGs in `backend/assets/memes`).
- `frontend/`: React + Vite + TypeScript on port 5173. The dev server proxies `/api` to the backend.

## Requirements

- Node.js 22 or newer (see `.nvmrc`; run `nvm use` if you use nvm)
- npm 10 or newer

## Quick start

```bash
npm install
npm run dev
```

To run in Docker instead, or for more detail on both options, see [deploy/README.md](deploy/README.md).

Open http://localhost:5173, then swipe memes by dragging the card, with the Like and Nope buttons or with the left and right arrow keys, and use the Likes tab to see what you liked. When all memes are swiped, press Reset to start over.

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

| Endpoint                     | Description                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/memes/next`        | `200 { "meme": {...} }` with the next unseen meme, or `200 { "meme": null }` when all memes have been swiped                                                                                                                                                                                                                                                            |
| `POST /api/swipes`           | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                                                                                                                                                                                                                                                                                  |
| `GET /api/likes`             | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)                                                                                                                                                                                                                                                                      |
| `DELETE /api/swipes`         | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                                                                                                                                                                                                                                                                            |
| `POST /api/memes`            | Body `{ "caption": "...", "image": "data:image/png;base64,..." }`. Posts a meme first in every user's pile (newest first). The image is stored as an SVG with the caption in a band at the bottom, like the seed memes. `201` with the new meme. Captions are 1–140 characters; images are PNG, JPEG, GIF, WebP or SVG, up to 1 MB, and the content must match the type |
| `GET /api/memes/uploads/:id` | The uploaded image (no `X-User-Id` needed). Served with a strict `Content-Security-Policy`, so scripts in an uploaded SVG never run. `404` for an unknown id                                                                                                                                                                                                            |
| `GET /api/me`                | `200 { "profile": { "id": "...", "nickname": "...", "emoji": "...", "bot": false } }` with the user's profile. The first call creates it with a random nickname and emoji. `id` is public; the `X-User-Id` is never returned                                                                                                                                            |
| `PUT /api/me`                | Body `{ "nickname": "...", "emoji": "..." }`. `200 { "profile": {...} }` with the updated profile. Nicknames are 1–30 characters (trimmed); the emoji must be exactly one emoji                                                                                                                                                                                         |

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id, invalid direction, an invalid posted meme or an invalid nickname or emoji, `413` for a request body over 2 MB, `404` for an unknown meme id. Swiping the same meme twice is idempotent: the first swipe is kept.

Swipes are stored in memory (`backend/src/swipes/repository.ts`) by default and are lost on restart. Set `DATABASE_FILE` to a file path to store them in SQLite (`backend/src/swipes/sqlite-repository.ts`) instead; Docker does this by default (see [deploy/README.md](deploy/README.md)). To plug in another database, implement `SwipeRepository`. Posted memes and their images (`backend/src/memes/imageStore.ts`) are still stored in memory only, so they are lost on restart.
