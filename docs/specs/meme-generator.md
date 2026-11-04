# Spec: Meme generator from templates, in the app and over MCP

Status: ready to implement. Read [CLAUDE.md](../../CLAUDE.md) first. Its conventions (layers, `createX` factories, tests, CHANGELOG, `npm run check`) apply to everything below.

## Goal

Users create a meme from a well-known template (for example "This is Fine") by picking the template and typing the text for each line, in the same way as online meme generators. The finished meme goes into every user's pile, like a posted meme.

There are two ways in, and both use the same backend:

1. **In the app**: a new "Create" tab.
2. **From an agent**: an MCP server, so a user can tell Claude Code or Claude Desktop "post a meme using the 'this is fine' dog with a funny caption about vibecoding". Claude runs on the user's own Claude subscription and writes the text itself. The MCP server only exposes tools. No Anthropic API key is involved anywhere.

```
Web app (Create tab) ─┐
                      ├──► our backend ──► memegen.link (templates + rendering)
MCP server (Claude) ──┘
```

Only the backend talks to the template provider. The frontend and the MCP server know nothing about memegen.link, so the provider can be swapped by changing one backend module.

## Template provider: memegen.link

[memegen.link](https://memegen.link) is a free, open source meme API that needs no account or key. Docs: https://api.memegen.link/docs/.

The endpoints we rely on are below. **Verify the exact shapes against the live docs before coding**: they were not checked against the live API when this spec was written.

- `GET {base}/templates/`: every template. Each has `id`, `name`, `lines` (the number of text lines), `blank` (the URL of the empty image), `example`, and possibly `keywords`.
- `POST {base}/images` with `{ "template_id": "fine", "text": ["top", "bottom"], "extension": "jpg" }`: returns `{ "url": "..." }` of the rendered image. Prefer this over building `/images/{id}/{line1}/{line2}.jpg` URLs yourself, because the URL form has its own escaping rules (`_` for a space, `~q` for `?`, and so on).
- The rendered image URL accepts `?width=600`. Use it so images stay well under our 1 MB limit.

The base URL comes from the `MEMEGEN_BASE_URL` env var (default `https://api.memegen.link`), so tests and self-hosted setups can point it elsewhere.

## Backend

### Modules (new folder `backend/src/templates/`)

| File         | Holds                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source.ts`  | The `TemplateSource` interface: `list(): Promise<Template[]>` and `render(templateId, texts): Promise<StoredImage>`. `Template` is `{ id, name, lines, imageUrl }` (`imageUrl` is the blank template image, used for thumbnails). This is the seam for the external provider, like `SwipeRepository` is for storage.                                                                                                          |
| `memegen.ts` | `createMemegenSource({ fetch, baseUrl })` implements `TemplateSource` against memegen.link. `fetch` is injected (the default is the global `fetch`). Every request has a timeout (`AbortSignal.timeout(5000)`). `render` downloads the rendered image, rejects anything over `MAX_IMAGE_BYTES` or with a content type that is not PNG or JPEG, and returns `{ contentType, data }`. Any failure throws `TemplateSourceError`. |
| `service.ts` | `createTemplateService(source, memeService, options?)` returns a `TemplateService` with the business logic described below. It never calls `fetch` itself.                                                                                                                                                                                                                                                                    |

`TemplateService`:

- `search(query: string): Promise<Template[]>`. Calls `source.list()` once and caches the result in memory for 24 hours (inject `now: () => Date` so tests control time). If the call fails, nothing is cached and the error is rethrown. Matching is case-insensitive on `id`, `name` and keywords. An empty query returns the first templates in provider order. Returns at most 24 results.
- `preview(templateId, texts): Promise<StoredImage>`. Validates the input (see below) and returns `source.render(...)`. Nothing is stored.
- `createMeme(templateId, texts): Promise<Meme>`. Validates the input, renders, and stores the result through `memeService.postCaptionedMeme(...)` (below). Returns the new meme.

Validation, shared by `preview` and `createMeme`:

- An unknown `templateId` throws `UnknownTemplateError`.
- `texts` must be an array of strings with at most `template.lines` entries, each 100 characters or fewer, and at least one entry that is not blank after trimming. Anything else throws `InvalidTemplateTextError`. Shorter arrays are padded with empty strings.
- The meme's `caption` (used as its title and alt text) is the non-empty trimmed texts joined with `" / "`. If that is longer than `MAX_CAPTION_LENGTH` (140), throw `InvalidTemplateTextError`.

### Change to the meme service

`backend/src/memes/service.ts` gets one new method:

```ts
/** Stores an image that already has its text on it (no caption band) and adds it to the catalog. */
postCaptionedMeme(input: { caption: string; image: StoredImage }): Meme;
```

- It runs the same checks as `postMeme` (caption rules, allowed type, content matches type, size limit). Extract the shared checks into a helper; don't copy them.
- It stores an SVG built by a new `composeFullCardSvg(image, caption)` in `compose.ts`. That SVG is 400x400 with the image filling the card (`preserveAspectRatio="xMidYMid meet"` on a dark background), no caption band and no text overlay, and `<title>` set to the caption. Everything else (ids, `UPLOAD_PATH`, `catalog.add`) works the same as `postMeme`, so the meme goes first in every pile.
- The public `POST /api/memes` does **not** change. Only the template service can skip the caption band.

### Endpoints (in `backend/src/app.ts`, validation and status codes only)

`createApp` gets a new optional `templateService` in `AppOptions`, and the routes are registered only when it is set (the same pattern as `memeService`). Express 5 forwards rejected promises from async handlers.

| Endpoint                                           | Description                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/templates?q=...`                         | Needs `X-User-Id`. `200 { "templates": [{ "id", "name", "lines", "imageUrl" }] }`. `502` if the provider fails.                                                                                                                                                                                                                           |
| `GET /api/templates/:id/preview?text=...&text=...` | **No** `X-User-Id` (it is used as an `<img src>`, the same as `/api/memes/uploads/:id`). One `text` query parameter per line. `200` with the image, its `Content-Type`, `X-Content-Type-Options: nosniff` and `Cache-Control: public, max-age=3600`. `404` for an unknown template, `400` for invalid texts, `502` if the provider fails. |
| `POST /api/memes/from-template`                    | Needs `X-User-Id`. Body `{ "templateId": "fine", "texts": ["...", "..."] }`. `201` with the new meme (`{ id, caption, imageUrl }`, like `POST /api/memes`). `400` for a missing or unknown `templateId` or invalid `texts`, `502` if the provider fails.                                                                                  |

Errors are `{ "error": "..." }`. Messages for `502` must not leak provider URLs or stack traces. Use something like `"The meme template service is unavailable, try again later"`.

### Wiring (`backend/src/index.ts`)

Create `createMemegenSource({ baseUrl: process.env.MEMEGEN_BASE_URL ?? "https://api.memegen.link" })`, then `createTemplateService(source, memeService)`, and pass it to `createApp`. Document `MEMEGEN_BASE_URL` in [deploy/README.md](../../deploy/README.md), and note that this feature needs outbound internet from the container.

### Backend tests

- `test/templateService.test.ts`: a fake `TemplateSource` and the real meme service with an in-memory catalog and image store. Covers search matching, the result limit, caching (one `list()` call, then a refresh after 24 hours with a fake clock), no caching after a failure, every validation rule, the joined caption, and that `createMeme` puts the meme first in the catalog.
- `test/memegen.test.ts`: a fake `fetch`. Covers the request bodies sent to memegen, mapping templates, rejecting an oversized or wrongly typed download, a timeout or network error becoming `TemplateSourceError`, and that a non-2xx response becomes `TemplateSourceError`.
- `test/templates.test.ts` (Supertest): every status code in the endpoint table, including the preview headers and `502` without leaking details.
- `compose.test.ts` and `memeService.test.ts`: `composeFullCardSvg` has no band and escapes the caption in `<title>`, and `postCaptionedMeme` follows the same rejection rules as `postMeme`.
- No test may reach the real network.

## Frontend

- `api.ts` gets three new exports:
  - `searchTemplates(q: string): Promise<Template[]>`
  - `templatePreviewUrl(templateId: string, texts: string[]): string` builds the `/api/templates/:id/preview?...` URL with `URLSearchParams`. It is a pure function with no fetch.
  - `postMemeFromTemplate(templateId: string, texts: string[]): Promise<Meme>`
- `TemplateView.tsx` is a new component, following `PostView.tsx` for structure, errors, the posting state and the confirmation:
  - A search box (debounced about 300 ms) and a grid of template thumbnails (`imageUrl`, with the name as alt text). The first results load when the view opens.
  - Picking a template shows one text input per line (`lines`, maxlength 100) and a live preview `<img>` whose `src` comes from `templatePreviewUrl`, updated about 400 ms after typing stops. The preview is only shown when at least one line has text.
  - A Post button that is disabled until a line has text and while posting. On success it shows the same confirmation as `PostView` and clears the form. On error it shows the API's error message.
  - A "Change template" action returns to the grid.
- `App.tsx` gets a "Create" nav tab next to "Post", rendering `<TemplateView onPost={...} />`. A created meme must reach the swipe pile in the same way a posted one does today.
- Styles go in `styles.css`. The grid has to work at phone width.
- `test/TemplateView.test.tsx` (Testing Library, `fetch` mocked in `api` or via props) covers search results rendering, picking a template showing the right number of inputs, the preview `src`, Post disabled and enabled, success, and the error message.

## MCP server (new workspace `mcp/`)

A small stdio MCP server, so Claude Code or Claude Desktop can create memes. It is a thin client of our HTTP API, with no meme or memegen logic of its own.

- Add `"mcp"` to the root `package.json` `workspaces`. Its `package.json` has `build` (`tsc`), `start` (`node dist/index.js`), `test` (`vitest run`) and `typecheck` scripts, so `npm run check` and CI cover it automatically. ESM, with `.js` import extensions like the backend.
- New dependencies, justified by this task: `@modelcontextprotocol/sdk` and `zod` (the SDK uses zod for tool input schemas). Use the SDK's current `McpServer` and `StdioServerTransport` API, and check its README for the version you install.
- Config comes from env vars: `MEME_TINDER_URL` (default `http://localhost:3000`) and `MEME_TINDER_USER_ID` (default `agent-claude`, sent as `X-User-Id`).
- Structure: `src/client.ts` has `createMemeTinderClient({ fetch, baseUrl, userId })` with `searchTemplates` and `createMemeFromTemplate`. `src/server.ts` has `createServer(client)`, which registers the tools. `src/index.ts` wires them to stdio. Never write to stdout except through the transport, because stdout is the protocol channel; logs go to stderr.
- Tools:
  - `search_templates({ query: string })` returns the matching templates as text: id, name, number of lines. The tool description tells the model to call it first and to use the `lines` count.
  - `create_meme({ templateId: string, texts: string[] })` returns the created meme's caption and its full image URL (`MEME_TINDER_URL` + `imageUrl`). Its description says texts go top to bottom, one per line, short and punchy, at most 100 characters each.
  - API errors are returned as tool errors (`isError: true`) with the API's `error` message, so the model can correct itself (for example, by searching again after an unknown template).
- Tests (`mcp/test/`): the client with a fake `fetch` (headers, URLs, bodies, error mapping), and the tools through `createServer` with a fake client.
- Add an "Agent (MCP)" section to the root [README.md](../../README.md) with setup, for example `npm run build -w mcp` and then `claude mcp add meme-tinder --env MEME_TINDER_URL=http://localhost:3000 -- node /absolute/path/to/mcp/dist/index.js`, plus a Claude Desktop config snippet and an example prompt.
- The Docker image does not ship the MCP server. Because of the new workspace, though, [deploy/Dockerfile](../../deploy/Dockerfile) must `COPY mcp/package.json mcp/` before each `npm ci` (both stages), or `npm ci` fails on the lockfile. Check this with a local `docker build` or the CI Docker job.

## Documentation and changelog

- Add the three endpoints to the API table in [README.md](../../README.md), and `MEMEGEN_BASE_URL` to the docs listed above.
- Add `CHANGELOG.md` entries under `## Unreleased` → `Added` for each slice, with the issue number if one exists.

## Delivery: three PRs, in this order

1. **Backend**: the template modules, `postCaptionedMeme` with `composeFullCardSvg`, the endpoints, wiring, tests, README and deploy docs.
2. **Frontend**: `api.ts`, `TemplateView.tsx`, the Create tab and tests. Depends on 1.
3. **MCP**: the `mcp/` workspace, Dockerfile `COPY` lines, README section and tests. Depends on 1 only, so it can be built in parallel with 2.

Each PR passes `npm run check` and the Definition of Done in [ROADMAP.md](../../ROADMAP.md).

## Acceptance criteria

- [ ] In the app, Create → search "fine" → pick "This is Fine" → type two lines → the preview shows the text on the image → Post → the meme is the next card in another browser's pile, with no caption band.
- [ ] With the MCP server registered in Claude Code, the prompt "post a meme using the 'this is fine' dog with a funny caption about vibecoding" creates a meme that appears first in the pile.
- [ ] With memegen.link unreachable (for example, `MEMEGEN_BASE_URL=http://127.0.0.1:9`), the Create tab and the MCP tool both show a clear "unavailable" error, and the rest of the app keeps working.
- [ ] `POST /api/memes` behaves exactly as before.
- [ ] `npm run check` passes, and CI (including the Docker build) is green.

## Out of scope

- Uploading your own image as a template, and custom text position, font or color
- Persisting created memes (they share the posted memes' in-memory `ImageStore`, which is a separate, known gap)
- Authenticating agents or rate limiting. Any client that can reach the API can create memes, the same as posting today. A shared agent key and moderation are follow-ups.
- Shipping or hosting the MCP server remotely (stdio, local only)

## Notes

- Template images are third-party content (for example, "This is Fine" is by KC Green). That's fine for this workshop app. Revisit before any public hosting.
