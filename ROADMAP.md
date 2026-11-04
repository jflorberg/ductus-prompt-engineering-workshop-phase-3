## Product context (read this first)

### What
Meme-Tinder is a dating app for memes. Users see one meme at a time and swipe right (like) or left (nope),
using drag, the Like/Nope buttons or the arrow keys. The Likes tab keeps every meme the user liked.
Users are anonymous: the frontend stores a random user id in localStorage and sends it as `X-User-Id`.

### Why
- Users: a quick laugh, and seeing whether other people agree with them.
- The founder (see [vision/001-launch.md](vision/001-launch.md)): proof that people love it, a Trending list
  to share on LinkedIn, and a "memes per minute" number that goes up.
- The team: a small, safe app to practise building features with AI agents.

### When and where
- In a web browser, on a phone or a computer, for short breaks ("bored for two minutes").
- Development: `npm run dev`, open http://localhost:5173.
- Production-like: Docker (`deploy/`), open http://localhost:3000. Swipes are saved on a volume.

### Product principles (apply to every change)
1. **Never lose a like.** Swipes are saved to a JSON file (`DATA_FILE`). If the file is corrupt, the backend
   refuses to start rather than overwrite it. No change may risk existing saved data.
2. **Pink and happy.** The frontend uses the pink theme tokens in `frontend/src/styles.css`, rounded
   cards, pill buttons and emoji (in `aria-hidden` spans so accessible names stay "Like", "Nope" and so on).
   Animations respect `prefers-reduced-motion`.
3. **Reliable backend.** Logic lives in the service and is tested without HTTP. Time comes from an injected
   clock (`now`) so tests control it. Endpoints return JSON errors and never crash on bad input.
4. **Green before done.** `npm run check` (format, lint, type check, build, test) must pass. CI runs it on
   every PR.

### Vision 001 status
| Big bet | Status |
| --- | --- |
| 1. Nothing you love ever disappears (persistent swipes) | Done |
| 2. Post your own meme | Not started |
| 3. Hot or not: love % on each card, Trending tab, memes per minute | In progress |
| 4. Feel the swipe: LIKE/NOPE stamp, card animation, confetti | Not started (cards already pop in) |
| 5. Guardrails: CI, lint, format | Done (`npm run check`, `.github/workflows/ci.yml`) |

### Big Bet 3 decisions (so every agent builds the same thing)
- Each swipe has a `swipedAt` timestamp (ISO). Old saved swipes without one are loaded as 1970,
  so they count for all-time stats but never as recent.
- Love %: `likes / (likes + nopes)`, rounded. It is `null` when nobody has swiped the meme yet, and the
  UI then says "Be the first to rate this".
- Trending: likes in the last hour. If the last hour has fewer than 5 swipes, it uses all time instead.
  Top 10, only memes with at least one like, ranked by likes, then love %, then catalog order.
- Memes per minute: swipes from all users in the last 60 seconds.
- API: `GET /api/memes/next` returns `{ meme, stats }`; new endpoints `GET /api/trending` and
  `GET /api/pulse`. `SwipeRepository` has a new `listAll()`.

### Out of scope until the founder asks
Money, ads, premium tiers, accounts and login, and anything the vision does not mention.
