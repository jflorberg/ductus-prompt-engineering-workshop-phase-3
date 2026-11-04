# Changelog

<!-- All notable changes below this line -->

## Unreleased

### Added

- SQLite persistence for swipes: `createSqliteSwipeRepository` in `backend/src/swipes/sqlite-repository.ts` using Node's built-in `node:sqlite` (no new dependency), enabled with the `DATABASE_FILE` env var (in-memory stays the default); the Docker image stores the database on a `meme-data` volume so likes survive restarts

- GitHub Actions CI (`.github/workflows/ci.yml`) on pushes to `main` and on pull requests: Prettier format check, ESLint, type check (including tests), build and tests, plus a job that builds the Docker image
- ESLint (`eslint.config.mjs`: recommended rules, typescript-eslint, React hooks, no `any`, type-only imports) and Prettier (`.prettierrc.json`, 100 columns) at the repository root; `vision/` is excluded from Prettier because the upstream repository owns it
- Root scripts `lint`, `format`, `format:check`, `typecheck` and `check` (runs everything CI runs); `typecheck` in both workspaces, with `backend/tsconfig.check.json` so backend tests are type checked too
- `ROADMAP.md`: a 2-hour sprint plan for a team of a frontend developer, a backend developer, a full-stack developer and a manager

- 20 more memes (SVG assets and seed entries), bringing the catalog to 30

- Agent guidance in `CLAUDE.md`: architecture, folder structure, commands, coding conventions, extension points (`SwipeRepository`, service vs. HTTP layer) and the rule that `CHANGELOG.md` is updated with every change (#8)

- Docker setup in `deploy/`: multi-stage `Dockerfile` (`node:22-alpine`), `docker-compose.yml` and a `README.md` for Docker and local start; root `.dockerignore` and a link from the root README (#4)
- The backend serves the built frontend when `STATIC_DIR` is set, with an SPA fallback that never answers `/api` paths, plus Supertest tests for it (#4)

- Drag gestures on the swipe card using pointer events (touch and mouse, no gesture library): the card follows the pointer, a release past 100 px likes or nopes, and a shorter release snaps back (#7)
- Left and right arrow keys swipe (nope and like) in the swipe view only, and are ignored while a swipe request is in flight (#7)
- Frontend tests for the `MemeCard` buttons, arrow keys and drag threshold, and for arrow keys and double-swipe protection in the app (#7)

- `GET /api/likes` returns `{ "memes": [...] }` with the user's liked memes in catalog order, and `listLikedMemes` on the swipe service (#6)
- Frontend likes view (`LikesView`) with an empty message, Swipe/Likes navigation and a typed `fetchLikes()` in the API client (#6)
- Service, Supertest and frontend tests for the likes list and likes view (#6)

- Reset of a user's swipes (including likes): `DELETE /api/swipes` (`204`), `resetSwipes` on the swipe service and `clearByUser` on `SwipeRepository` (#5)
- Frontend empty state ("You have seen all memes") with a Reset button, and a typed `resetSwipes()` in the API client (#5)
- Service, Supertest and frontend tests for the reset flow and the empty state (#5)

- Swipe service and in-memory swipe repository (behind a `SwipeRepository` interface) in the backend (#3)
- `POST /api/swipes` endpoint; swiped memes are never returned again, repeated swipes keep the first one (#3)
- Anonymous user id (localStorage) sent as `X-User-Id`, plus Like and Nope buttons in the frontend (#3)
- Frontend error message when the backend is unreachable or returns an error (#3)
- Unit tests for the swipe service, Supertest tests for the swipe endpoints and frontend swipe tests (#3)

- npm workspaces monorepo with `backend` (Express + TypeScript) and `frontend` (React + Vite + TypeScript) (#2)
- Ten original SVG programmer-humour memes with captions and a meme catalog in the backend (#2)
- `GET /api/memes/next` endpoint and static serving of meme images under `/api/memes/images` (#2)
- Frontend that fetches a meme and shows it as a static card, with `/api` proxied to the backend (#2)
- Vitest example tests in both workspaces (Supertest for the backend, Testing Library for the frontend) (#2)
- `.nvmrc` and `engines` requiring Node 22+ and npm 10+; README with requirements and quick start (#2)

### Changed

- The codebase is formatted with Prettier (formatting only, no behavior change)
- The initial meme load in `App` no longer sets state synchronously inside `useEffect` and ignores results that arrive after unmount (found by the React hooks lint rule)
- `CLAUDE.md` and `README.md` list the new commands; `npm run check` is now the command to run before finishing a change
- `ROADMAP.md`: replanned the 2-hour sprint around [Vision 001](vision/001-launch.md): persistence, CI guardrails, meme stats and Trending as Must; memes per minute, swipe feedback and posting memes as Should; undo and unlike dropped
- `MemeCard` now takes `onSwipe(direction)` and owns the Like and Nope buttons, which moved out of `App`; buttons are disabled while a swipe request is in flight (#7)
- The plain "No more memes." text is replaced by the `EmptyState` component (#5)
- `GET /api/memes/next` is now per user (requires `X-User-Id`) and returns `{ "meme": ... }`, with `{ "meme": null }` when all memes are swiped (#3)
- `createApp` now takes a swipe service instead of the meme catalog (#3)
