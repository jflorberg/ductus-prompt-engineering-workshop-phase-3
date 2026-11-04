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

| Endpoint              | Description                                                                                                                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/memes/next` | `200 { "meme": {...}, "stats": { "likes": n, "nopes": n, "lovePercent": 0-100 \| null } }` with the next unseen meme and how much all users love it (`lovePercent` is `null` before anyone swiped it), or `200 { "meme": null, "stats": null }` when all memes have been swiped         |
| `GET /api/trending`   | `200 { "window": "hour" \| "all", "memes": [{ "meme": {...}, "likes": n, "nopes": n, "lovePercent": n }] }`: up to 10 liked memes from all users, by likes, then love percent, then catalog order. Uses the last hour, or all time (`"all"`) when the last hour had fewer than 5 swipes |
| `GET /api/pulse`      | `200 { "swipesPerMinute": n }`: swipes (likes and nopes) from all users in the last 60 seconds                                                                                                                                                                                          |
| `POST /api/swipes`    | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                                                                                                                                                                                                  |
| `GET /api/likes`      | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)                                                                                                                                                                                      |
| `DELETE /api/swipes`  | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                                                                                                                                                                                            |

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id or invalid direction, `404` for an unknown meme id. Swiping the same meme twice is idempotent: the first swipe is kept.

Swipes are saved to a JSON file (`backend/src/swipes/fileRepository.ts`; the path comes from `DATA_FILE`, default `data/swipes.json` in the backend's working directory), so likes survive a restart. Implement `SwipeRepository` to plug in a database.
