## Product context (read this first)

### What

Meme-Tinder is a dating app for memes. Users see one meme at a time and swipe right (like) or left (nope),
using drag, the Like/Nope buttons or the arrow keys. The Likes tab keeps every meme the user liked.
The frontend stores a random user id in localStorage and sends it as `X-User-Id`. That id is the secret key
of a person: it has a profile (nickname and emoji) with a separate public id, and there are no passwords.

### Why

- Users: a quick laugh, and finding people who laugh at the same things.
- The founder (see [vision/001-launch.md](vision/001-launch.md)): proof that people love it, a Trending list
  to share on LinkedIn, and a "memes per minute" number that goes up.
- The founder, again (see [vision/002-pivot.md](vision/002-pivot.md)): "Nobody wants to swipe alone." Memes
  are how people find each other: compatibility, "It's a Match!", a live ticker and invite links.
- The team: a small, safe app to practise building features with AI agents.

### When and where

- In a web browser, on a phone or a computer, for short breaks ("bored for two minutes").
- Development: `npm run dev`, open http://localhost:5173.
- Production-like: Docker (`deploy/`), open http://localhost:3000. Swipes and profiles are saved in SQLite on
  a volume.

### Product principles (apply to every change)

1. **Never lose a like.** Swipes and profiles are saved in SQLite (built-in `node:sqlite`) when
   `DATABASE_FILE` is set; Docker sets it, `npm run dev` keeps them in memory unless you set it. Schema
   changes are migrations that keep existing rows. No change may risk existing saved data.
2. **Pink and happy.** The frontend uses the pink theme tokens in `frontend/src/styles.css`, rounded
   cards, pill buttons and emoji (in `aria-hidden` spans so accessible names stay "Like", "Nope" and so on).
   Animations respect `prefers-reduced-motion`.
3. **Reliable backend.** Logic lives in the service and is tested without HTTP. Time comes from an injected
   clock (`now`) so tests control it. Endpoints return JSON errors and never crash on bad input.
4. **Green before done.** `npm run check` (format, lint, type check, build, test) must pass. CI runs it on
   every PR.
5. **The secret stays secret.** Other users only ever see the public profile id, never the `X-User-Id`.

### Vision 001 status

| Big bet                                                            | Status                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Nothing you love ever disappears (persistent swipes)            | Done                                                                     |
| 2. Post your own meme                                              | Done (posted memes are kept in memory only, so they are lost on restart) |
| 3. Hot or not: love % on each card, Trending tab, memes per minute | Done                                                                     |
| 4. Feel the swipe: LIKE/NOPE stamp, card animation, confetti       | Done (stamps, fly-out, fireworks on streaks and the 100th swipe)         |
| 5. Guardrails: CI, lint, format                                    | Done (`npm run check`, `.github/workflows/ci.yml`)                       |

Extra, not from a vision: memes from templates (Create tab and an MCP server, see
[docs/specs/meme-generator.md](docs/specs/meme-generator.md)).

### Big Bet 3 decisions (so every agent builds the same thing)

- Each swipe has a `swipedAt` timestamp (ISO), stored in the `swiped_at` column. Databases from before the
  column existed are migrated on start, and their old swipes get 1970, so they count for all-time stats but
  never as recent.
- Love %: `likes / (likes + nopes)`, rounded. It is `null` when nobody has swiped the meme yet, and the
  UI then says "Be the first to rate this".
- Trending: likes in the last hour. If the last hour has fewer than 5 swipes, it uses all time instead.
  Top 10, only memes with at least one like, ranked by likes, then love %, then catalog order.
- Memes per minute: swipes from all users in the last 60 seconds.
- API: `GET /api/memes/next` returns `{ meme, stats }`; new endpoints `GET /api/trending` and
  `GET /api/pulse`. `SwipeRepository` has a new `listAll()`.

### Out of scope until the founder asks

<<<<<<< Updated upstream
Chat, money, ads, premium tiers, the app store, passwords and email login, and anything the vision does not
mention.

## Vision 002 plan: It's a Match!

**Team:** Frontend developer (FE), Backend developer (BE), Full-stack developer (DEV), Manager (PM)
**Timebox:** 120 minutes
**Goal:** Demo on a green `main` at 2:00 that shows the founder's "done": I send my mum an invite link, she
swipes ten memes on her phone without signing up, we both see how compatible we are, a live ticker at the
bottom shows that she just loved my favourite meme, and we both get an "It's a Match!" moment with fireworks.

### From vision to scope

The vision has five more "P0" big bets on top of an app that is "mostly the same". It is not the same app: it
changes who a user is (a person, not a browser) and adds data shared between users. We rank the bets by what
makes the "done" story true. Everything from vision 001 stays.

| Big bet                     | What we ship                                                                                                                                  | Priority   | Status                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| (foundation)                | `swipedAt` on every swipe, and `listAll()` that also returns **who** swiped (`UserSwipe`)                                                     | **Must**   | `swipedAt` done; `listAll()` has no user id yet |
| 1. Who am I?                | A profile (nickname and emoji) for every user id, created automatically with a random nickname, editable in a "Me" tab, stored in SQLite      | **Must**   | Done (`GET` and `PUT /api/me`)                  |
| 2. Find my meme people      | A compatibility score, a "People" tab ("People like you", best match first) and a person view with the memes you both loved                   | **Must**   |                                                 |
| 5. Bring a friend           | An "Invite a friend" link (`/?invite=<profileId>`). The friend swipes right away, starts with the memes the inviter swiped and sees the score | **Must**   |                                                 |
| 3. It's a match!            | A match when two people pass the threshold below: "It's a Match!" with the existing fireworks and a short sound (Web Audio, no files)         | **Must**   | `Celebration.tsx` exists                        |
| 2. Always someone for me    | Three seeded bot profiles with fixed swipes, always shown with a 🤖 badge                                                                     | **Must**   | `bot` flag on profiles exists                   |
| 4. Live!                    | A ticker at the bottom: "Sara just loved _It Was DNS_", "Johan just got a match!". The frontend polls `GET /api/feed` every 3 seconds         | **Should** | Polling, like `PulseCounter.tsx`                |
| 1. Who am I? (cross-device) | "Use on another device" with a one-time pairing code (see below)                                                                              | **Should** |                                                 |
| 3. It's a match!            | Bots that keep swiping slowly so the ticker moves on day one                                                                                  | **Could**  |                                                 |

The PM cuts from the bottom. A Should item that is not merged by **1:40** gets dropped.

### Our answers to the founder's open questions

| Question                                     | Decision                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can everyone see what everyone else liked?   | No. Other people see your nickname, emoji and your score with them. In a person view you only see the memes **you both** liked, so you never learn a like you did not share. Nopes are never shown. The ticker only shows likes and matches, by nickname.                   |
| What if I'm the only user?                   | Three bots (for example "Bot Bea 🤖", "Bot Rex 🤖", "Bot Kim 🤖") with fixed swipes over the seed memes, chosen so that they have different tastes. They are always labelled as bots, never posed as real people. A second browser also counts as a second person.          |
| What if the score is based on two memes?     | No score until you have both swiped at least **5** of the same memes ("Swipe 3 more to see your score"). A **match** needs at least **10** shared swipes and a score of at least **75%**. With the invite, the friend gets the inviter's memes first, so ten swipes is ten. |
| Do "Hot or not" and memes per minute fit?    | Yes. Love % and Trending describe memes, compatibility describes people; both stay. Memes per minute stays too: it is built and cheap. The ticker shows the same activity with names, so we revisit the counter after the demo.                                             |
| How compatible is "enough"? ("You tell me.") | 75% over 10 or more shared swipes (see above). The numbers are constants in the matching service, so we can tune them after the demo.                                                                                                                                       |

### How the score works

For two people, take the memes both have swiped. The score is the share of those memes where they agreed
(both liked or both noped), rounded to a whole percent. A shared like counts double, so two people who nope
everything do not come out at 100%:

```
score = (2 × bothLiked + bothNoped) / (2 × bothLiked + bothNoped + disagreed)
```

Below 5 shared swipes there is no score. The score is computed on read from `listAll()`; with a few hundred
users that is fast enough, and it means there is no score table to keep in sync.

### Logging in on another device without a password

The `X-User-Id` already is the login. To get it onto a second device:

1. On device A, the Me tab asks for a pairing code (`POST /api/me/pairing-code`). The backend makes a
   6-character code from easy-to-read characters (no 0/O or 1/I), valid for 5 minutes and usable once.
2. On device B, the user types the code (`POST /api/pair`, no profile needed). The backend returns the user
   id, `identity.ts` stores it, and the app reloads as that person.
3. Swipes made on device B before pairing are merged into the account; where both devices swiped the same
   meme, the account's swipe is kept.
4. Failed attempts are limited so codes cannot be guessed.

A permanent "secret link" would be simpler, but it never expires and leaks through chat and browser history.
Email links and passkeys are out of scope. This is workshop-grade security: a real launch needs HTTPS.

### API contract (agreed at kickoff, before anyone writes code)

All endpoints require `X-User-Id` like the existing ones, except `POST /api/pair`. Errors are
`{ "error": "..." }`. A profile in a response is `{ "id": "<profileId>", "nickname": "...", "emoji": "...", "bot": false }`.

| Endpoint                             | Description                                                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/me` (done)                 | `200 { "profile": {...} }`. Creates the profile on the first call, with a random nickname ("Curious Otter") and emoji, so there is no sign-up wall.                                                                                                                   |
| `PUT /api/me` (done)                 | Body `{ "nickname": "...", "emoji": "..." }`. `200 { "profile": {...} }`. `400` for an empty nickname, a nickname over 30 characters or an emoji that is not one emoji.                                                                                               |
| `POST /api/invites`                  | Body `{ "profileId": "..." }`: the current user was invited by this profile. `204`. `404` for an unknown profile, `400` for your own profile. Only the first invite counts. From then on `GET /api/memes/next` returns memes the inviter swiped first.                |
| `GET /api/people`                    | `200 { "people": [{ "profile": {...}, "score": 84 \| null, "sharedSwipes": n, "match": true }] }`, everyone except you (bots included), best score first, people without a score last                                                                                 |
| `GET /api/people/:profileId`         | `200 { "profile": {...}, "score": 84 \| null, "sharedSwipes": n, "match": true, "bothLiked": [meme, ...] }`. `404` for an unknown profile.                                                                                                                            |
| `POST /api/swipes` (changed)         | Adds `"matches": [profile, ...]` to the response: the people this swipe made you match with (usually empty). A match is stored once and never repeated.                                                                                                               |
| `GET /api/matches`                   | `200 { "matches": [{ "profile": {...}, "matchedAt": "..." }] }`, newest first. The frontend checks it on start and celebrates matches it has not seen yet (kept in localStorage), so the other person also gets the moment, even if they were not online.             |
| `GET /api/feed?after=<seq>` (Should) | `200 { "events": [{ "seq": n, "type": "like" \| "match", "at": "...", "profile": {...}, "meme"?: {...}, "other"?: {...} }] }`, at most 20, oldest first. Without `after`, the latest 20. Kept in memory (the last 200 events); it does not need to survive a restart. |
| `POST /api/me/pairing-code` (Should) | `201 { "code": "K7P3MX", "expiresAt": "..." }`. A new code replaces the previous one.                                                                                                                                                                                 |
| `POST /api/pair` (Should)            | Body `{ "code": "..." }`. `200 { "userId": "..." }` and merges the calling device's swipes (if it sends `X-User-Id`) into that user. `400` for an unknown, used or expired code, `429` after too many failed attempts.                                                |

Data changes:

```ts
// swipes/repository.ts: listAll() must say who swiped, for compatibility and the feed
interface UserSwipe extends Swipe {
  userId: string;
}

interface SwipeRepository {
  // existing: listByUser, add, clearByUser
  listAll(): UserSwipe[]; // was Swipe[]; the stats code keeps working because UserSwipe extends Swipe
}
```

```ts
// profiles/repository.ts (done): add invitedBy for invites
interface Profile {
  id: string; // public, random
  userId: string; // secret, the X-User-Id
  nickname: string;
  emoji: string;
  bot: boolean;
  invitedBy?: string; // profileId (new)
}

// matching/repository.ts (new): matches are stored so they are celebrated once
interface MatchRepository {
  listByUser(userId: string): { userId: string; otherUserId: string; matchedAt: string }[];
  add(userIdA: string, userIdB: string, matchedAt: string): void; // stores both directions
}
```

New backend modules, each with a `createX` factory and tested without HTTP: `matching/service.ts` (score,
people, shared likes, match detection after a swipe), `feed/service.ts` (the in-memory event log) and
`pairing` (codes, in memory). `app.ts` stays thin.

### Timeline

| Time      | Phase                                | Everyone                                                                                                                                        |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | **Kickoff**                          | Pull `main`, run `npm install` and `npm run check`. PM walks through the scope, the decisions, the API contract and the owners, creates issues. |
| 0:15–1:10 | **Build block 1** (Must)             | One branch per issue, small PRs, CI on every PR                                                                                                 |
| 1:10–1:20 | **Merge window 1**                   | PM merges the Must PRs once CI is green. Everyone merges `main` into their branch.                                                              |
| 1:20–1:40 | **Build block 2** (Should and Could) |                                                                                                                                                 |
| 1:40–1:50 | **Code freeze + merge window 2**     | Only fixes from here on. CI must be green on `main`.                                                                                            |
| 1:50–2:00 | **Demo**                             | PM runs the demo script below                                                                                                                   |

### Per role

#### Backend developer (BE)

| When      | Task                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:15–0:30 | `listAll()` returns `UserSwipe[]` (with `userId`) in the in-memory and SQLite repositories. **Push this early as its own PR**, because matching builds on it.                                                                                                                                                                                                                                                 |
| 0:30–1:10 | `matching/service.ts`: the score, `listPeople`, `getPerson` (shared likes) and `checkMatches` after a swipe, plus the `MatchRepository` (memory and SQLite). The `GET /api/people`, `GET /api/people/:profileId` and `GET /api/matches` routes and `matches` in `POST /api/swipes`. Service tests for the formula, the 5 and 10 swipe limits and "a match is stored once"; Supertest tests. README API table. |
| 1:20–1:40 | **Should:** pairing codes: `POST /api/me/pairing-code` and `POST /api/pair`, with the swipe merge and attempt limit, tested with a fake clock.                                                                                                                                                                                                                                                                |

#### Full-stack developer (DEV)

| When      | Task                                                                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:15–0:45 | The bots: three bot profiles and their swipes in seed data, loaded at start (idempotent, so a restart does not duplicate them).                                                                                                                                              |
| 0:45–1:10 | `invitedBy` on profiles (SQLite migration), `POST /api/invites` and the "inviter's memes first" order in the swipe service, with tests.                                                                                                                                      |
| 1:10–1:20 | Integration owner for merge window 1: run the merged `main` end to end in two browsers (`npm run dev`) and in Docker.                                                                                                                                                        |
| 1:20–1:40 | **Should:** `feed/service.ts` and `GET /api/feed`; the swipe and match code publishes `like` and `match` events. A `Ticker.tsx` component that calls FE's `fetchFeed()` every 3 seconds and shows the latest event, sliding in (no animation with `prefers-reduced-motion`). |

#### Frontend developer (FE)

| When      | Task                                                                                                                                                                                                                                                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:15–0:30 | Typed `acceptInvite()`, `fetchPeople()`, `fetchPerson()`, `fetchMatches()`, `fetchFeed()`, `createPairingCode()` and `pair()` in `api.ts`, and the new `sendSwipe()` return value, written against the contract (mock `fetch` in tests).                                                                                                      |
| 0:30–1:10 | "Invite a friend" with a copy button in the Me tab. A "People" tab (`PeopleView.tsx`, `PersonView.tsx` with the memes you both loved, "Swipe N more to see your score"). Reading `?invite=` on start in `App.tsx` and calling `acceptInvite()`. Testing Library tests.                                                                        |
| 1:20–1:40 | **It's a Match!**: extend `Celebration.tsx` with a match message (both emojis, "You and Sara are 84% compatible") and a short Web Audio sound, muted with reduced motion. Triggered by the `sendSwipe()` response and by unseen matches from `fetchMatches()`. **Should:** "Use on another device" in the Me tab (show a code, or enter one). |

FE owns `App.tsx` and `api.ts`. Nobody else edits them, so there are no merge conflicts there. DEV's
`Ticker.tsx` is mounted by FE.

#### Manager (PM)

| When          | Task                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15     | Run the kickoff. Lock the scope, the answers to the founder's questions, the score formula and the API contract. Create the issues and assign them.                                         |
| 0:15–1:40     | Keep time. Check in every 20 minutes ("blocked?"). Make the scope calls: cut, not extend. Send the founder the decisions above **before** the demo, especially privacy and the bots.        |
| 1:10 and 1:40 | Run both merge windows: check each PR against the Definition of Done, then merge in order (BE `listAll` → BE matching → DEV bots and invites → FE views → match moment → ticker → pairing). |
| 1:50–2:00     | Run the demo. Write down what is left over as issues for the next session (start with blocking and reporting people, and a private mode).                                                   |

### Dependencies

```
BE: listAll with userId (0:30) ──► BE: matching service ──► FE: People tab, person view
                                          │
Profiles (done) ──────────────────────────┼──► FE: It's a Match! moment
        │                                 │
        ├──► DEV: bots ("always someone") │
        └──► DEV: invites ──► FE: invite link in the Me tab

BE: matching + swipes ──► DEV: feed ──► DEV: Ticker.tsx (mounted by FE)

FE: api.ts against the contract (mocked) ──► all FE views
```

The hard blocker is BE's `listAll` PR. Getting it merged by 0:30 is the most important milestone of the first
hour.

### Definition of Done (per PR, from CLAUDE.md)

- [ ] `npm run check` passes locally and CI is green
- [ ] Tests added or updated, and they test behavior through the public interface
- [ ] `CHANGELOG.md` updated under `## Unreleased` with the issue number
- [ ] README API table updated for new or changed endpoints
- [ ] Layers respected: no logic in `app.ts`, and `fetch` only in `api.ts`
- [ ] No new dependencies (`node:sqlite`, `node:crypto` and Web Audio are built in)
- [ ] Existing swipes, likes and profiles still load after the change (test with an existing `DATABASE_FILE`)

### Demo script (1:50)

1. Start with Docker (`deploy/`) on the existing database volume: the old likes are still there, now with a
   profile. Set a nickname and an emoji in the Me tab.
2. Open the People tab: the three bots are there, with scores. Tap one to see the memes you both loved.
3. Copy the invite link and open it on a phone (a new user). No sign-up: the phone swipes ten memes, the same
   ones the first user swiped.
4. Both screens show the score in the People tab. The ticker on the laptop shows "Mum just loved
   _It Was DNS_".
5. At the tenth shared swipe, if the score is 75% or more: "It's a Match!" with fireworks and sound on both
   screens. Rehearse it so the phone agrees on enough memes.
6. Restart the container: profiles, likes and the match are still there.
7. Show a PR with the green CI check.

### Risks

| Risk                                                         | Mitigation                                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The pivot breaks existing users ("don't you dare lose them") | The user id stays the key and profiles are created on demand. Migrations keep existing rows, and the Definition of Done has a check against an existing database file.    |
| The secret user id leaks                                     | Invite links and person views only use the public profile id. Pairing codes expire after 5 minutes and work once.                                                         |
| Privacy: people see more than they want                      | Only memes you both liked are shown, never nopes. The founder gets this decision before the demo. Private mode is the first item for the next session.                    |
| Bots feel like fake users                                    | They always have a 🤖 badge, in the People tab, the person view, the match moment and the ticker.                                                                         |
| Match never happens in the demo                              | The invite puts the inviter's memes first, so ten swipes give ten shared swipes. Rehearse once at 1:20 with two browsers. The threshold is a constant and can be lowered. |
| Merge conflicts in `App.tsx`, `api.ts` and `styles.css`      | FE owns `App.tsx` and `api.ts`. Everyone merges `main` into their branch after each merge window. New CSS goes at the end of `styles.css` in its own block.               |
| The ticker polls too often or leaks memory                   | Polling every 3 seconds with `after`, the effect is cleaned up on unmount, and the backend keeps only the last 200 events. If it is not green by 1:40, the ticker is cut. |
| "Everything is P0" pressure leads to scope creep             | The scope table above is the contract. PM cuts at 1:40, no exceptions, and tells the founder what moves to the next session.                                              |
=======
Money, ads, premium tiers, accounts and real login, and anything the vision does not mention.
The three-clap login (`ClapGate`) is a playful gate on the device, not an account: it does not
identify anyone and must not be used to protect data.
>>>>>>> Stashed changes
