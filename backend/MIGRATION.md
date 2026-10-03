# Backend migration: Express → Hono on Cloudflare Workers

The Spotuner API was a single long-lived Node process on a VM. It is now a Hono app on
Cloudflare Workers, with Cloudflare KV replacing the filesystem and in-process caches.

The contract did not change. Every path, method, parameter, response body and status code the
frontend depends on is preserved, and that is enforced by a live contract suite
(`npm run test:compat`) rather than by inspection.

---

## What actually changed

| Concern | Before | After |
|---|---|---|
| Runtime | Node 18+ process, listening on a port | Cloudflare Workers, `fetch` handler |
| Framework | Express 4 | Hono 4 |
| Entry point | `backend/server.js` | `backend/src/index.ts` |
| Caching | `node-cache` + JSON files under `backend/.cache` | Cloudflare KV + isolate-local TTL map |
| Config | `process.env` read at module load | `env` bindings installed per request (`lib/runtime/env.js`) |
| Stream resolution | yt-dlp subprocess | InnerTube `/player` on unciphered clients; yt-dlp kept as a Node-only fallback |
| HTTP client | axios, Node adapter | axios with `adapter: 'fetch'`, `cache: 'no-store'` |
| Deploy | pm2/systemd on a VM | `wrangler deploy` |

The Node server is **retained**, not deleted. `npm run dev:node` still starts it and it still
returns identical responses — it is the fallback for debugging on Node, and the target of
`npm run test:api`.

### Why the runtime layer exists

A Worker has no `process`, no listener, and no filesystem, so `process.env` captured at module
scope reads as `undefined` and every cache is a no-op. Four thin modules absorb that, and the
rest of `lib/` is unaware of the runtime it is in:

- `lib/runtime/env.js` — binding access with a `process.env` fallback, so the same code runs on
  both runtimes.
- `lib/runtime/kv.js` — namespace access, JSON (de)serialisation, and index maintenance.
- `lib/runtime/ttl-cache.js` — a `node-cache`-compatible in-memory TTL map, so call sites that
  want a hot tier do not change.
- `lib/runtime/stream-cache.js` — stream URL caching, capped by the URL's own `expire` rather
  than only by TTL.
- `lib/runtime/http.js` — the axios fetch adapter. Workerd rejects axios's default Node adapter
  and rejects `cache: 'default'`, which both fail at runtime rather than at build time.

### Why `nodejs_compat`

`lib/` is shared with the Node server and uses `Buffer` (image probing), `base64` (Spotify
client), and dynamic `node:*` imports (the yt-dlp fallback). Rather than fork those files, the
Worker opts into `nodejs_compat` and the Node-only branch is behind a runtime guard, so the
dynamic import is never evaluated in a bundle that cannot resolve it.

### Search and stream resilience

InnerTube rate-limits by client identity. A burst of searches from one client is answered with
403 even though the same query succeeds moments later, which is exactly what a page load that
fans out into several searches does. Both paths now walk a list of unauthenticated clients and
retry with backoff, and treat a `200` with an empty envelope as throttled rather than as
"no results":

- `search()` — `WEB_REMIX` → `WEB` → `ANDROID_MUSIC`, 2 attempts each.
- `resolveStream()` — `ANDROID_VR` and fallbacks, first one that returns a format wins.

Stream URLs are cached, but never beyond their own `expire` minus a safety margin, so a
re-resolve happens instead of serving a dead URL.

### Subrequest budget

Two places could exhaust the Worker's 1000-subrequest ceiling, and both were fixed rather than
left for production to discover:

- Artist-image priming read up to 1000 keys **serially** on the first lookup of a cold isolate.
  It now runs *alongside* the request rather than in front of it, reads a bounded recent slice
  (`SPOTUNER_ARTIST_PRIME_LIMIT`, default 250) with bounded concurrency, and is a pure
  optimisation — a name it misses still gets a direct key-by-key read.
- The 256 KB JSON body ceiling that `express.json()` provided is now enforced in `src/app.ts`.
  Only three routes read a body, but an uncapped body is uncapped memory on a Worker.

---

## Routes

All 17 are preserved.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | |
| GET | `/api/search/youtube` | `query` required, `limit` bounded |
| GET | `/api/search/all` | `source` narrows to one provider |
| GET | `/api/providers` | Reports YouTube playable, Spotify not |
| GET | `/api/play/:source/:id` | Resolves to a real playable source |
| GET | `/api/stream/youtube/:videoId` | Cached, 500 on provider failure |
| GET | `/api/shelves` | **Bare array**, cache state in headers |
| GET | `/api/discovery/trending` | |
| GET | `/api/discovery/latest` | |
| GET | `/api/discovery/home` | |
| GET | `/api/discovery/status` | Reports `kv+memory` when both tiers are live |
| POST | `/api/discovery/foryou` | Compact profile only, never stored |
| POST | `/api/discovery/refresh` | Invalidates every namespace |
| POST | `/api/artists/images` | Name → URL map, `null` for unresolved |
| GET | `/api/language/status` | |
| POST | `/api/language/detect` | |
| POST | `/api/hero-image` | Single or batch |

`/api/shelves` returning a bare array and not an envelope is load-bearing, so nothing in
`src/app.ts` envelopes a response.

---

## Environment

See `.env.example` for the annotated list. Two things differ between runtimes:

- **Local** — `wrangler dev` reads `backend/.env` automatically.
- **Production** — non-secret values live in `wrangler.jsonc` under `vars`; the Spotify
  credentials are Worker secrets.

`PORT` applies only to the Express fallback. Wrangler serves on 8787.

### KV namespaces

| Binding | Contents |
|---|---|
| `CACHE` | Discovery SWR entries, search results, stream URLs, hydrated metadata, language detections, hero images, Spotify cooldown |
| `ARTIST_IMAGES` | The iTunes artist-image catalogue |

`npm run kv:create` provisions both; paste the four returned ids into `wrangler.jsonc`, which
ships with placeholders.

---

## Setup

```bash
cd backend
npm install
cp .env.example .env        # optional locally

npm run kv:create                            # then paste the ids into wrangler.jsonc
npm run secret:spotify-id                    # optional
npm run secret:spotify-secret                # optional
npm run typecheck
npx wrangler deploy --dry-run
npm run deploy
```

A **paid Cloudflare plan is a requirement, not an optimisation**: a cold `/api/shelves` costs
several hundred subrequests against a free-plan ceiling of 50.

The frontend needs no code change — `VITE_API_URL` already selects the API base, and defaults
to the Node server. Point it at the Worker with `VITE_API_URL=https://<worker>.workers.dev/api`.

---

## Verification

`npm run test:compat` asserts the contract, not just status codes: response shapes, CORS
headers and credential exposure, the bare-array shelves contract, cache headers, error statuses,
and a stream URL that actually resolves audio.

CORS gets five dedicated checks because it fails in a uniquely misleading way: a missing
`Access-Control-Allow-Origin` makes the browser report a CORS error and hide the real status,
so an ordinary 404 or 500 looks like a network fault. The suite pins the production origin,
the `204` preflight for `GET, POST, PUT, DELETE, OPTIONS` with `Content-Type` and
`Authorization`, the absence of any wildcard or prefix-match grant, and — the one that is
easiest to regress silently — that the CORS header survives 404, 413 and 400 responses.

| Suite | Target | Result |
|---|---|---|
| `test:compat` | Worker `:8787` | **37 passed, 0 failed** |
| `test:api` | Express `:3001` | 11 passed, 0 failed |
| `test:discovery` | in-process | 52 passed, 0 failed |
| `test:metadata` | in-process | 19 passed, 0 failed |
| `test:scoring` | in-process | 25 passed, 0 failed |
| `test:failure` | in-process | 9 passed, 0 failed |
| `test:spotify` | in-process | 40 passed, 0 failed, 3 skipped (live quota) |
| `typecheck` | — | clean |
| `deploy --dry-run` | — | 439.75 KiB, gzip 111.55 KiB |

Caching was verified across a real Worker restart, not just within one process: `/api/discovery/latest`
took 21.7s to build, and returned in **41ms** after the Worker was stopped and restarted — served
from KV, not isolate memory.

Stream URLs were verified to be real cross-IP: the `googlevideo.com` URL returned by
`/api/stream/youtube/dQw4w9WgXcQ` fetches with HTTP 200 from outside the machine.

---

## Known limitations

- **Cold reads are slow.** A cold `/api/discovery/latest` is ~22s and a cold `/api/shelves` is
  ~27s, because the pipeline hydrates 90 videos, enriches them, and fans out into dozens of
  YouTube searches. A large uncached `/api/artists/images` request can take ~90s: the iTunes
  pacing is deliberately slow because firing faster is what gets the app throttled. All of it is
  KV-cached afterwards, and stale entries are served while revalidating.
- **KV is eventually consistent.** Writes are visible in the same isolate immediately and
  elsewhere within about a minute, so a second region can briefly miss an entry that was just
  written. Acceptable for caches; it would not be for a source of truth.
- **Paid plan required.** See above.
- **Isolation is per-isolate.** A KV read costs a request on every cold isolate, so the first
  request to each region pays the rehydration cost. This is why priming is bounded and runs
  alongside the request.
- **Spotify quota.** Live Spotify tests skip when the development quota is exhausted. The app
  degrades to YouTube-only rather than failing.
- **Placeholder namespace ids.** `wrangler.jsonc` ships with `YOUR_*_NAMESPACE_ID` and cannot be
  deployed until they are replaced.
