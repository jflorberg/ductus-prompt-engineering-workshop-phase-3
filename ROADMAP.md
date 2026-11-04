# Roadmap: 2-hour workshop sprint

**Team:** Frontend developer (FE), Backend developer (BE), Full-stack developer (DEV), Manager (PM)
**Timebox:** 120 minutes
**Input:** [Vision 001: Cute Demo. Where's the Rocket Ship?](vision/001-launch.md)
**Goal:** Demo on a green `main` at 2:00: likes survive a restart, every meme shows how loved it is, a Trending tab and a live "memes per minute" counter, a LIKE/NOPE stamp when you swipe, and every PR checked automatically by CI. Posting your own meme if there is time.

## From vision to scope

The vision has five "P0" big bets. Four people cannot ship five P0s in two hours, so we rank them by what makes the "done" story in the vision true, and by risk.

| Big bet                             | What we ship this sprint                                                                                                            | Priority         | Why                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1. Nothing you love ever disappears | A JSON file repository behind `SwipeRepository`, plus a Docker volume                                                               | **Must**         | The founder's main complaint. Without it nothing else matters after a restart.                                            |
| 5. Guardrails                       | GitHub Actions CI (`npm test` + `npm run build`) on every PR, a required check on `main`, a PR template with the Definition of Done | **Must**         | Cheap (one small PR) and it protects every merge after it. Done first.                                                    |
| 3. Hot or not                       | "87% loved this" on every card, and a Trending tab                                                                                  | **Must**         | Needs swipes from all users, which is the same data work as persistence                                                   |
| 3. Hot or not                       | Memes per minute counter                                                                                                            | **Should**       | Small once swipes have timestamps                                                                                         |
| 4. Feel the swipe                   | LIKE/NOPE stamp, and the next card animates in (CSS only)                                                                           | **Should**       | Frontend only, no API changes                                                                                             |
| 2. Post your own meme               | Upload an SVG with a caption; it shows up in everyone's pile                                                                        | **Should**       | Most valuable for growth, but the riskiest: SVG files can carry scripts. Built with the safety rules below or not at all. |
| 4. Feel the swipe                   | Confetti on a streak of 5 likes, and a moment on the 100th swipe                                                                    | **Could**        | Nice surprise, no dependencies needed                                                                                     |
| 5. Guardrails                       | A formatter (Prettier) checked in CI                                                                                                | **Next session** | Reformats every file, so it conflicts with every open PR. Do it at the start of the next session.                         |

The PM cuts from the bottom. A Should item that is not merged by **1:40** gets dropped.

### Out of scope (from "Not now" in the vision)

- Money, ads, premium tiers
- Undo and unliking (not in the vision)
- Accounts and login, a real database server, hosting on the internet
- Moderation tooling (reporting, an admin view), and raster images (PNG, JPEG)

### Our answers to the founder's open questions

| Question                           | Decision                                                                                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two people post the same meme?     | The backend hashes the SVG (SHA-256, `node:crypto`). A duplicate gets `409` and the existing meme is not changed.                                                                                                                 |
| Somebody posts something not nice? | This sprint: the SVG is validated and rejected if it has scripts, event handlers, `foreignObject` or external links; size and caption length are limited. Real moderation (report + hide) is the first item for the next session. |
| Trending: last hour or all time?   | The last hour, ranked by likes. If fewer than 5 swipes happened in the last hour, it falls back to all time, and the tab says which one it shows.                                                                                 |

## Where we start

The app already does a lot (see [CHANGELOG.md](CHANGELOG.md)):

- 30 SVG memes, swipe by drag, buttons or arrow keys, a Likes tab, and Reset when all memes are swiped
- API: `GET /api/memes/next`, `POST /api/swipes`, `GET /api/likes`, `DELETE /api/swipes`
- Clean layers: `app.ts` (HTTP) → `swipes/service.ts` (logic) → `SwipeRepository` (storage, in memory only)
- Tests in both workspaces, plus a Docker setup in `deploy/`
- No CI, no timestamps on swipes, and the meme catalog is static seed data

## API contract (agreed at kickoff, before anyone writes code)

All endpoints require `X-User-Id` like the existing ones. Errors are `{ "error": "..." }`.

| Endpoint                        | Description                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/memes/next` (changed) | Adds `"stats": { "likes": n, "nopes": n }` across all users next to `"meme"`. The frontend shows "N% loved this", or "Be the first to rate this" when both are 0.                                                         |
| `GET /api/trending`             | `200 { "window": "hour" \| "all", "memes": [{ "meme": {...}, "likes": n, "nopes": n }] }`, top 10 by likes in the window, then catalog order                                                                              |
| `GET /api/pulse`                | `200 { "swipesPerMinute": n }`: swipes from all users in the last 60 seconds. The frontend polls it every 5 seconds.                                                                                                      |
| `POST /api/memes`               | Body `{ "caption": "...", "svg": "<svg ...>" }`. `201 { "meme": {...} }`. `400` for an empty caption, a caption over 140 characters or an unsafe or invalid SVG. `409` for a duplicate SVG. `413` for an SVG over 100 KB. |

Data changes:

```ts
// swipes/repository.ts
interface Swipe {
  memeId: string;
  direction: Direction;
  swipedAt: string; // ISO time, set by the service from an injected clock
}

interface SwipeRepository {
  // existing: listByUser, add, clearByUser
  listAll(): Swipe[];
}
```

```ts
// memes/repository.ts (new, same pattern as SwipeRepository)
interface PostedMeme {
  id: string;
  caption: string;
  svg: string;
  sha256: string;
  postedAt: string;
}

interface MemeRepository {
  list(): PostedMeme[];
  add(meme: PostedMeme): void;
}
```

The catalog lists the seed memes first, then posted memes in the order they were posted. The service already returns the next unseen meme in catalog order, so a new meme reaches everyone's pile, including users who have seen everything. Posted SVGs are served from `/api/memes/images/:id.svg` with `Content-Type: image/svg+xml` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, so a script that slips through validation still cannot run.

## Timeline

| Time      | Phase                                | Everyone                                                                                                                                                                     |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | **Kickoff**                          | Pull `main`, run `npm install`, `npm test` and `npm run dev`. PM walks through the vision, the scope, the API contract and owners, and creates one GitHub issue per feature. |
| 0:15–1:10 | **Build block 1** (Must)             | One branch per issue, small PRs. CI is live from about 0:30.                                                                                                                 |
| 1:10–1:20 | **Merge window 1**                   | PM merges the Must PRs once CI is green. Everyone rebases on `main`.                                                                                                         |
| 1:20–1:40 | **Build block 2** (Should and Could) |                                                                                                                                                                              |
| 1:40–1:50 | **Code freeze + merge window 2**     | Only fixes from here on. CI must be green on `main`.                                                                                                                         |
| 1:50–2:00 | **Demo**                             | PM runs the demo script below                                                                                                                                                |

## Per role

### Backend developer (BE)

| When      | Task                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:15–0:30 | Add `swipedAt` to `Swipe` and `listAll()` to the `SwipeRepository` interface and the in-memory repository. The service takes a `now: () => Date` dependency (default `() => new Date()`) so tests control time. **Push this early as its own PR**, because DEV builds on it.                |
| 0:30–1:10 | `getMemeStats(memeId)`, `getTrending()` and `getSwipesPerMinute()` on the service. `stats` in `GET /api/memes/next`, plus the `GET /api/trending` and `GET /api/pulse` routes. Service tests with a fake clock (window edges, the all-time fallback) and Supertest tests. README API table. |
| 1:20–1:40 | `POST /api/memes`: SVG validation, the SHA-256 duplicate check, serving posted images with the CSP header. Tests for every rejection rule, including an SVG with `<script>` and one with `onload=`.                                                                                         |

Files: [backend/src/swipes/repository.ts](backend/src/swipes/repository.ts), [backend/src/swipes/service.ts](backend/src/swipes/service.ts), [backend/src/app.ts](backend/src/app.ts), `backend/test/`.

### Frontend developer (FE)

| When      | Task                                                                                                                                                                                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:15–0:30 | Typed `fetchTrending()`, `fetchPulse()` and `postMeme()` in `api.ts`, and the `stats` field on the next-meme response, written against the contract (mock `fetch` in tests).                                                                                                                          |
| 0:30–1:10 | "N% loved this" on `MemeCard.tsx`. A `TrendingView.tsx` component and a "Trending" tab in `App.tsx`. A `PulseCounter.tsx` ("12 memes/min") in the header. Tests with Testing Library.                                                                                                                 |
| 1:20–1:40 | **Feel the swipe**: a LIKE or NOPE stamp while dragging and on release (buttons and arrow keys too), and the next card animates in. CSS only, and respect `prefers-reduced-motion`. Add a "Post" tab for DEV's `PostMemeView`. If there is time: confetti on 5 likes in a row and on the 100th swipe. |

Files: [frontend/src/App.tsx](frontend/src/App.tsx), [frontend/src/api.ts](frontend/src/api.ts), [frontend/src/MemeCard.tsx](frontend/src/MemeCard.tsx), [frontend/src/styles.css](frontend/src/styles.css), `frontend/test/`.
FE owns `App.tsx` and `api.ts`. Nobody else edits them, so there are no merge conflicts there.

### Full-stack developer (DEV)

| When      | Task                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:15–0:30 | **Guardrails first.** `.github/workflows/ci.yml`: on every PR and push to `main`, Node from `.nvmrc`, `npm ci`, `npm test`, `npm run build`. `.github/pull_request_template.md` with the Definition of Done below. Merge it right away so every later PR is checked.                                                                                                                                                                        |
| 0:30–1:00 | `createFileSwipeRepository(filePath)` in a new `backend/src/swipes/fileRepository.ts`, including `listAll` from BE's interface PR. It loads the JSON at startup and writes synchronously on every change, using only `node:fs`. Tests: data survives creating a new repository on the same file. Wire it up in `backend/src/index.ts` behind a `DATA_FILE` env var (in-memory stays the default, so tests and `npm run dev` do not change). |
| 1:00–1:10 | A volume and `DATA_FILE` in [deploy/docker-compose.yml](deploy/docker-compose.yml), documented in [deploy/README.md](deploy/README.md).                                                                                                                                                                                                                                                                                                     |
| 1:10–1:20 | Integration owner for merge window 1: run the merged `main` end to end (`npm run dev` and Docker).                                                                                                                                                                                                                                                                                                                                          |
| 1:20–1:40 | `MemeRepository` (in memory and file, the file one under the same data folder) and the catalog change to include posted memes. `PostMemeView.tsx`: pick an `.svg` file, a caption field, a Post button and the error messages for `400`, `409` and `413`. It calls FE's `postMeme()`.                                                                                                                                                       |

This is the "plug in a database" path described in [CLAUDE.md](CLAUDE.md). The service does not change for persistence.

### Manager (PM)

| When          | Task                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15     | Run the kickoff. Lock the scope, the answers to the founder's questions and the API contract. Create the issues and assign them.                                                                     |
| 0:30          | Once the CI PR is merged, turn on branch protection for `main`: require the CI check and one review.                                                                                                 |
| 0:15–1:40     | Keep time. Check in every 20 minutes ("blocked?"). Make the scope calls: cut, not extend. Prepare the demo script. Send the founder the three decisions above so there are no surprises at the demo. |
| 1:10 and 1:40 | Run both merge windows: check each PR against the Definition of Done, then merge in order (DEV CI → BE interface → DEV file repository → BE endpoints → FE).                                         |
| 1:50–2:00     | Run the demo. Write down what is left over as issues for the next session (start with moderation and Prettier).                                                                                      |

## Dependencies

```
DEV: CI (0:30) ──► every later PR is checked

BE: Swipe.swipedAt + listAll (0:30) ──► DEV: file repository ──► Docker volume
         │
         └──► BE: stats, trending, pulse ──► FE: % on card, Trending tab, counter
                                               ▲
FE: api.ts against the contract (mocked) ─────┘

BE: POST /api/memes ──► DEV: PostMemeView ──► FE: Post tab
```

The hard blockers are BE's interface PR and DEV's CI PR. Getting both merged by 0:30 is the most important milestone of the first hour.

## Definition of Done (per PR, from CLAUDE.md)

- [ ] CI is green (`npm test` and `npm run build`)
- [ ] Tests added or updated, and they test behavior through the public interface
- [ ] `CHANGELOG.md` updated under `## Unreleased` with the issue number
- [ ] README API table updated for new or changed endpoints
- [ ] Layers respected: no logic in `app.ts`, and `fetch` only in `api.ts`
- [ ] No new dependencies (`node:crypto` and `node:fs` are built in)

## Demo script (1:50)

The founder's "done" from the vision, step by step:

1. Start with Docker (`deploy/`), using the file repository. Open the app on a phone on the same network.
2. Swipe ten memes: the LIKE and NOPE stamps, the next card arriving, and "N% loved this" on each card.
3. Restart the container. All likes are still in the Likes tab.
4. Open a second browser (a new user id) and swipe a few: the memes-per-minute counter goes up, and the **Trending** tab ranks the winners.
5. Post a meme (an SVG plus a caption) in one browser, and swipe to it in the other. Post it again: "This meme already exists".
6. Show a PR with the green CI check.

## Risks

| Risk                                               | Mitigation                                                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `Swipe` change breaks DEV's file repository    | BE merges the interface PR first and early. DEV rebases right after.                                                                                             |
| A malicious SVG runs a script in someone's browser | Validation on upload, images only rendered with `<img>`, and the CSP `sandbox` header on every posted image. If the tests are not green by 1:40, posting is cut. |
| "Everything is P0" pressure leads to scope creep   | The scope table above is the contract. PM cuts at 1:40, no exceptions, and tells the founder what moves to the next session.                                     |
| Merge conflicts in `App.tsx` and `api.ts`          | FE owns both. BE and DEV touch the backend, `deploy/`, `.github/` and new frontend files only.                                                                   |
| The backend is not ready when FE needs it          | FE works against the contract with mocked `fetch` and integrates after merge window 1                                                                            |
| CI is slow or flaky and blocks merges              | CI only runs the same `npm test` and `npm run build` everyone runs locally. If GitHub Actions is down, the PM merges after a local run and notes it on the PR.   |
| A broken `main` at demo time                       | CI on every PR, code freeze at 1:40, and DEV verifies `main` end to end                                                                                          |
