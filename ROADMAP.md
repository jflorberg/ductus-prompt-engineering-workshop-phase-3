# Roadmap: 2-hour workshop sprint

**Team:** Frontend developer (FE), Backend developer (BE), Full-stack developer (DEV), Manager (PM)
**Timebox:** 120 minutes
**Goal:** Demo three new features on a green `main` at 2:00: users can undo a swipe, users can remove a like, and swipes survive a backend restart. Add a "Top memes" leaderboard if there is time.

## Where we start

The app already does a lot (see [CHANGELOG.md](CHANGELOG.md)):

- 30 memes, swipe by drag, buttons or arrow keys, a Likes tab, and Reset when all memes are swiped
- API: `GET /api/memes/next`, `POST /api/swipes`, `GET /api/likes`, `DELETE /api/swipes`
- Clean layers: `app.ts` (HTTP) → `swipes/service.ts` (logic) → `SwipeRepository` (storage, in memory only)
- Tests in both workspaces, plus a Docker setup in `deploy/`

What is missing, and what this sprint builds:

| Gap | Why it matters |
| --- | --- |
| A swipe cannot be undone | Users misswipe all the time, especially with drag |
| A like cannot be removed | The Likes list only grows, until a full Reset |
| Swipes are lost on restart | The in-memory repository resets on every deploy |
| No shared signal | Users cannot see which memes other people like |

## Scope

| Priority | Feature | Owner(s) |
| --- | --- | --- |
| Must | **Undo the last swipe** (button + `Backspace` key) | BE + FE |
| Must | **Remove a meme from Likes** | BE + FE (same endpoint as undo) |
| Must | **Persistent swipes**: a JSON file repository, plus a Docker volume | DEV |
| Should | **Top memes leaderboard**: a new "Top" tab ranked by likes | BE + FE |
| Should | **Drag feedback**: a "LIKE" or "NOPE" stamp on the card while you drag | FE |
| Could | **Progress counter** ("12 / 30") on the swipe view | BE + FE |
| Out | Accounts and login, uploading memes, a real database server | Too big for 2 hours |

The PM cuts from the bottom. A Should item that is not merged by **1:40** gets dropped.

## API contract (agreed at kickoff, before anyone writes code)

New endpoints, all requiring `X-User-Id` like the existing ones:

| Endpoint | Description |
| --- | --- |
| `DELETE /api/swipes/:memeId` | Removes the user's swipe for one meme (undo and unlike both use this). `204`. `404` for an unknown meme id. Safe to repeat. |
| `GET /api/stats` | `200 { "memes": [{ "meme": {...}, "likes": n, "nopes": n }] }` across all users, sorted by likes (highest first), then catalog order. |

New `SwipeRepository` methods (DEV implements them in the file repository too):

```ts
remove(userId: string, memeId: string): void;
listAll(): Swipe[];
```

Undo needs no extra endpoint. The frontend remembers the id of the last swiped meme and calls `DELETE /api/swipes/:memeId`. The service returns memes in catalog order, so `GET /api/memes/next` returns that meme again.

## Timeline

| Time | Phase | Everyone |
| --- | --- | --- |
| 0:00–0:15 | **Kickoff** | Pull `main`, run `npm install`, `npm test` and `npm run dev`. PM walks through scope, the API contract and owners, and creates one GitHub issue per feature. |
| 0:15–1:10 | **Build block 1** (Must) | One branch per issue, small PRs |
| 1:10–1:20 | **Merge window 1** | PM merges the Must PRs. Everyone rebases on `main`. |
| 1:20–1:40 | **Build block 2** (Should and Could) | |
| 1:40–1:50 | **Code freeze + merge window 2** | Only fixes from here on. `npm test` and `npm run build` must pass on `main`. |
| 1:50–2:00 | **Demo** | PM runs the demo script below |

## Per role

### Backend developer (BE)

| When | Task |
| --- | --- |
| 0:15–0:30 | Add `remove` and `listAll` to the `SwipeRepository` interface and the in-memory repository. **Push this early as its own PR**, because DEV builds on it. |
| 0:30–1:10 | `removeSwipe(userId, memeId)` on the service (throws `UnknownMemeError`) and the `DELETE /api/swipes/:memeId` route. Service tests and Supertest tests. README API table. |
| 1:20–1:40 | `getStats()` on the service and the `GET /api/stats` route, with tests. If there is time: a `remaining` count in `GET /api/memes/next` for the progress counter. |

Files: [backend/src/swipes/repository.ts](backend/src/swipes/repository.ts), [backend/src/swipes/service.ts](backend/src/swipes/service.ts), [backend/src/app.ts](backend/src/app.ts), `backend/test/`.

### Frontend developer (FE)

| When | Task |
| --- | --- |
| 0:15–0:30 | Typed `removeSwipe(memeId)` and `fetchStats()` in `api.ts`, written against the contract (the backend is not ready yet, so mock `fetch` in tests). |
| 0:30–1:10 | **Undo**: an Undo button and the `Backspace` key in the swipe view, enabled after a swipe. **Unlike**: a Remove button per meme in `LikesView`. Tests with Testing Library. |
| 1:20–1:40 | A `TopView.tsx` component and a "Top" tab in `App.tsx`. If there is time: the LIKE/NOPE stamp while dragging in `MemeCard.tsx`. |

Files: [frontend/src/App.tsx](frontend/src/App.tsx), [frontend/src/api.ts](frontend/src/api.ts), [frontend/src/LikesView.tsx](frontend/src/LikesView.tsx), [frontend/src/MemeCard.tsx](frontend/src/MemeCard.tsx), `frontend/test/`.
FE owns `App.tsx`. Nobody else edits it, so there are no merge conflicts there.

### Full-stack developer (DEV)

| When | Task |
| --- | --- |
| 0:15–0:30 | Write `createFileSwipeRepository(filePath)` in a new `backend/src/swipes/fileRepository.ts`. It loads the JSON at startup and writes synchronously on every change. Use only `node:fs`, so no new dependency. |
| 0:30–1:00 | Once BE's interface PR is merged, implement `remove` and `listAll` too. Tests: data survives creating a new repository on the same file. Wire it up in `backend/src/index.ts` behind a `DATA_FILE` env var (in-memory stays the default, so tests and `npm run dev` do not change). |
| 1:00–1:10 | Add a volume and `DATA_FILE` to [deploy/docker-compose.yml](deploy/docker-compose.yml) and document it in [deploy/README.md](deploy/README.md). |
| 1:10–1:50 | Integration owner. Run the merged `main` end to end (`npm run dev` and Docker), review BE and FE PRs, and fix what breaks. Pair with FE on the Top tab if it is behind. |

This is the "plug in a database" path described in [CLAUDE.md](CLAUDE.md). The service does not change.

### Manager (PM)

| When | Task |
| --- | --- |
| 0:00–0:15 | Run the kickoff. Lock the scope and the API contract. Create the issues and assign them. |
| 0:15–1:40 | Keep time. Check in every 20 minutes ("blocked?"). Make the scope calls: cut, not extend. Prepare the demo script. |
| 1:10 and 1:40 | Run both merge windows: check each PR against the Definition of Done, then merge in order (BE interface → DEV → BE endpoints → FE). |
| 1:50–2:00 | Run the demo. Write down what is left over as issues for the next session. |

## Dependencies

```
BE: repository interface (0:30) ──► DEV: file repository
         │
         └──► BE: DELETE /api/swipes/:memeId ──► FE: undo + unlike (integration)
                                                   ▲
FE: api.ts against the contract (mocked) ─────────┘

BE: GET /api/stats ──► FE: Top tab
```

The only hard blocker is BE's interface PR. Getting it merged by 0:30 is the most important milestone of the first hour.

## Definition of Done (per PR, from CLAUDE.md)

- [ ] Tests added or updated, and they test behavior through the public interface
- [ ] `npm test` and `npm run build` pass
- [ ] `CHANGELOG.md` updated under `## Unreleased` with the issue number
- [ ] README API table updated for new endpoints
- [ ] Layers respected: no logic in `app.ts`, and `fetch` only in `api.ts`
- [ ] No new dependencies

## Demo script (1:50)

1. Start with Docker (`deploy/`), using the file repository.
2. Swipe 3 memes, misswipe one, and press **Undo**: the meme comes back.
3. Open **Likes** and remove one like.
4. Restart the container: the swipes and likes are still there.
5. Open in a second browser (a new user id), swipe, then show the **Top** tab ranking.

## Risks

| Risk | Mitigation |
| --- | --- |
| The interface change breaks DEV's build | BE merges the interface PR first and early. DEV rebases right after. |
| Merge conflicts in `App.tsx` and `api.ts` | FE owns both. BE and DEV only touch the backend and `deploy/`. |
| The backend is not ready when FE needs it | FE works against the contract with mocked `fetch` and integrates after merge window 1 |
| Scope creep | PM cuts at 1:40, no exceptions |
| A broken `main` at demo time | Code freeze at 1:40, and DEV verifies `main` end to end |
