# Changelog

<!-- All notable changes below this line -->

## Unreleased

### Added

- Feel the swipe (Big Bet 4): a LIKE or NOPE stamp that fades in while dragging and is stamped on release, button click or arrow key; the swiped card flies off the screen (300 ms) before the swipe is sent, and the next card arrives with a bounce. CSS only, and no animation when the user prefers reduced motion
- Celebrations with CSS fireworks (`Celebration` component, explosions of sparks around the screen): on every 3 likes in a row, and on every 100th swipe in this browser (counted in localStorage by `swipeCount.ts`). The fireworks are left out when the user prefers reduced motion
- Testing Library tests for the stamp, the fly-out, the streak, the 100th swipe and the celebration

- `docs/specs/meme-generator.md`: the spec for creating memes from templates (memegen.link) in a new "Create" tab and through an MCP server for Claude Code and Claude Desktop

- Meme generator backend: `GET /api/templates`, `GET /api/templates/:id/preview` and `POST /api/memes/from-template`. Templates come from memegen.link behind a `TemplateSource` interface (`backend/src/templates/`), cached for 24 hours, with a 5 second timeout and a `502` "unavailable" error when the provider fails. Set `MEMEGEN_BASE_URL` to use another instance. Created memes go first in every pile, stored by the new `postCaptionedMeme` as a full-card SVG (`composeFullCardSvg`) with no caption band; `POST /api/memes` is unchanged

- Meme generator "Create" tab: search templates, pick one, type a line per template line with a live preview, and post it (`TemplateView.tsx`, `searchTemplates`, `templatePreviewUrl` and `postMemeFromTemplate` in `api.ts`)

- MCP server (`mcp/` workspace) with `search_templates` and `create_meme` tools, so Claude Code or Claude Desktop can create memes through the API. New dependencies `@modelcontextprotocol/sdk` and `zod`, used only by `mcp/`. The Dockerfile copies `mcp/package.json` so `npm ci` matches the lockfile

- SQLite persistence for swipes: `createSqliteSwipeRepository` in `backend/src/swipes/sqlite-repository.ts` using Node's built-in `node:sqlite` (no new dependency), enabled with the `DATABASE_FILE` env var (in-memory stays the default); the Docker image stores the database on a `meme-data` volume so likes survive restarts

- Post your own meme (Big Bet 2): a "Post" tab with an image picker (PNG, JPEG, GIF, WebP or SVG, up to 1 MB), a required caption (up to 140 characters), a preview with the caption band and a confirmation. Posted memes go first into every user's pile (newest first)
- `POST /api/memes` (base64 data URL in JSON, no new dependency) and `GET /api/memes/uploads/:id`, with a meme service (`backend/src/memes/service.ts`) that checks the caption, the image type, the file content and the size, and an `ImageStore` interface with an in-memory implementation. Uploaded images are served with a strict `Content-Security-Policy` and `nosniff`, so scripts in an SVG never run
- Posted memes look like the seed memes: the backend combines the image and the caption into one 400x400 SVG with the caption in capitals in a dark band at the bottom (`backend/src/memes/compose.ts`)
- Typed `postMeme()` in the API client, a `PostView` component, and service, Supertest and Testing Library tests for posting

- Hot or not (Vision 001, Big Bet 3): every swipe gets a `swipedAt` timestamp (the swipe service takes an injectable clock), `listAll` on `SwipeRepository`, and `getMemeStats`, `getTrending` and `getSwipesPerMinute` on the service. `GET /api/memes/next` now also returns the meme's `stats`; new `GET /api/trending` (last hour, falling back to all time when fewer than 5 swipes) and `GET /api/pulse` (swipes per minute). The SQLite repository stores `swiped_at` and adds the column to existing databases, where old swipes count as all-time only
- Frontend: a pink love meter on each card ("87% of people loved this", or "Be the first to rate this meme!"), a Trending tab with medals, and a live "memes swiped per minute" counter that refreshes every 5 seconds and keeps its last number when a refresh fails. Service, Supertest and Testing Library tests
- Pink and fun frontend theme: colour tokens, a pink gradient background, rounded cards and pill buttons with emoji, a pop-in animation for each new card (off with `prefers-reduced-motion`), and a "Your likes are saved" note

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

- Claude Code project settings (`.claude/settings.json`): `curl` moves from deny to ask, `git pull`/`git fetch` are ask rules, and `api.memegen.link` is in the sandbox's allowed domains, so the template provider can be checked from Claude Code

- `MemeCatalog` has an `add` method, and `createApp` takes an optional `memeService` option that enables the post endpoints
- Failed API requests in the frontend now include the backend's `error` message

- The codebase is formatted with Prettier (formatting only, no behavior change)
- The initial meme load in `App` no longer sets state synchronously inside `useEffect` and ignores results that arrive after unmount (found by the React hooks lint rule)
- `CLAUDE.md` and `README.md` list the new commands; `npm run check` is now the command to run before finishing a change
- `ROADMAP.md`: replanned the 2-hour sprint around [Vision 001](vision/001-launch.md): persistence, CI guardrails, meme stats and Trending as Must; memes per minute, swipe feedback and posting memes as Should; undo and unlike dropped
- `MemeCard` now takes `onSwipe(direction)` and owns the Like and Nope buttons, which moved out of `App`; buttons are disabled while a swipe request is in flight (#7)
- The plain "No more memes." text is replaced by the `EmptyState` component (#5)
- `GET /api/memes/next` is now per user (requires `X-User-Id`) and returns `{ "meme": ... }`, with `{ "meme": null }` when all memes are swiped (#3)
- `createApp` now takes a swipe service instead of the meme catalog (#3)
