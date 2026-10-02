# 🎵 Spotuner

A full-length music streaming app built on YouTube Music. Real playback, real search, real
discovery — no previews, no 30-second clips.

```
                         SPOTUNER
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
     YouTube          MusicBrainz          User Data
   InnerTube API       / Metadata API       Listening
        │                   │                   │
        │            Spotify Web API             │
        │           (enrichment only)            │
        └───────────────────┼───────────────────┘
                            ↓
              Provider Manager + Match/Dedupe
                            ↓
                    Metadata Normalizer
                            ↓
                    Language Detection
                            ↓
                     Quality Filtering
                            ↓
                    Spotuner Scoring
                            ↓
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
          Trending        Latest       For You
                            ↓
                    Playback Manager
                            ↓
                    YouTube playback
```

The principle: **external sources provide data, Spotuner provides the intelligence.** Every
rank, score and recommendation is computed in this codebase. No third-party recommendation
score is used, and no trending list is hardcoded.

YouTube and Spotify are **peers as data sources**. Spotify contributes release dates, ISRCs,
album names and identifiers; YouTube remains the only source of playable audio. External
sources never gate the experience: YouTube is the only provider allowed to *produce* a
candidate, and every optional provider can only *enrich* one. If one is down, wrong, slow or
rate-limited, the app behaves as if it did not exist — and says so rather than silently
degrading.


---

## 📋 Table of Contents

- [What it does](#-what-it-does)
- [Tech stack](#-tech-stack)
- [Quick start](#-quick-start)
- [Configuration](#-configuration)
- [API reference](#-api-reference)
- [Architecture](#-architecture)
- [Testing and diagnostics](#-testing-and-diagnostics)
- [Known limitations](#-known-limitations)
- [Legal notice](#-legal-notice)

---

## ✨ What it does

### Playback
- Full-length streaming from YouTube, resolved per request and cached
- Play/pause, next/previous, seek, volume, shuffle, and three repeat modes
- Queue management with a live Now Playing panel
- Real-time progress tracking

### Discovery
- **Trending Now** and **Latest Releases** — ranked from live YouTube search, not a static
  list, and gated on upload age so a "trending" shelf never surfaces year-old catalogue
- **For You** — a personalised third mode ranked on affinity: language, artist, genre, minus
  skip and already-played penalties, with a confidence factor so a thin history produces a
  neutral result rather than a confident wrong one
- 25 editorial shelves spanning Malayalam, Tamil, Hindi, Telugu, Kannada, Bengali, Chill,
  Workout, and Romantic
- Six recommendation strategies (Liked Songs, Chill Mix, Malayalam, Tamil, Workout,
  Romantic) driven by a real listening profile
- Hero carousels with artwork resolved per slide

### Catalogue
- **Artists** — credits are split into individual performers, so `Jakes Bejoy & Vishal
  Mishra & Aavani Malhar` produces three artist pages rather than one
- Each artist has a song list and a play-all button, at `/artists/<slug>`
- Per-artist imagery resolved from the iTunes Search API, falling back to track artwork

### Library
- Like/save tracks, create playlists, recently played
- Listening behaviour tracked for likes, skips, replays, completion rate, and play count
- Persisted to `localStorage`

### Multi-source
- **YouTube + Spotify as peers** — both search concurrently; either can fail without
  affecting the other
- **Cross-provider matching** — the same recording on both platforms resolves to one canonical
  track, with the counterpart attached as an alternate
- **Variants are never merged** — remixes, live takes, acoustic, instrumental, covers, slowed
  and reverb versions stay distinct
- **Provider preference** — `auto`, `youtube`, or `spotify`, persisted alongside existing
  preferences
- **Provider-aware playback** — a Spotify track resolves to a matched YouTube upload, because
  the Spotify Web API serves no audio

### Metadata
- **Provider abstraction** — YouTube (primary), MusicBrainz and Spotify (enrichment) behind
  one replaceable interface
- **Canonical track object** — every source converges on one shape, and a null from a second
  provider never overwrites a value the first one supplied
- **Cross-provider identity** — ISRC, MusicBrainz recording id, Spotify id, then a normalised
  title+artist key
- Provenance is recorded per track in `metadataSources`

### Language detection
- Backend classifies each track's language from title, description, channel name, and
  transliterated script
- Used to filter the regional shelves and to drive language-scoped discovery
- Emits an ISO code plus a confidence value

---

## 🛠️ Tech stack

### Backend
| Package | Purpose |
|---|---|
| Hono 4 on Cloudflare Workers | HTTP server and routing |
| YouTube InnerTube API | Search, metadata, stream URL resolution |
| iTunes Search API | Artist imagery |
| Cloudflare KV | Discovery, search, stream, metadata, language, hero-image and artist-image caching |
| Spotify Web API | Optional metadata and peer search (never playback) |
| MusicBrainz | Optional metadata enrichment |
| axios (fetch adapter) | HTTP client |
| Wrangler | Local dev server, KV provisioning, deploy, logs |

The Worker is the deployed entrypoint. `backend/server.js` remains a Node/Express server with
identical responses for local debugging on Node, and is what `npm run dev:node` starts. See
[backend/MIGRATION.md](backend/MIGRATION.md) for what changed and why.

### Frontend
| Package | Purpose |
|---|---|
| React 19 + Vite 8 | UI and build |
| React Router 7 | Navigation |
| Tailwind CSS 4 | Styling |
| Howler.js | Audio playback |
| Context API | Player, queue, library state |
| Lucide React | Icons |
| oxlint | Linting |

Styling is configured entirely in `src/index.css` via Tailwind v4's `@theme`. There is no
`tailwind.config.js`.

---

## 🚀 Quick start

### Prerequisites
- **Node.js 18+** (developed against Node 24)
- **A Cloudflare account** — only to deploy. Local development needs nothing beyond Node.
- **yt-dlp** — *optional*, and no longer how playback works. Stream URLs now come from the
  YouTube InnerTube `/player` endpoint, which runs in any runtime. yt-dlp is kept only as a
  Node-side fallback (`npm run dev:node`); the Worker never invokes it. It is bundled at
  `backend/bin/yt-dlp/yt-dlp.exe` on Windows, or put it on `PATH` elsewhere.

### Install

```bash
# Backend
cd backend
npm install
cp .env.example .env        # optional; defaults are fine for local dev

# Frontend
cd ../frontend
npm install
```

### Run

```bash
# Terminal 1 — Worker on http://127.0.0.1:8787  (this is the deployed path)
cd backend
npm run dev

# Terminal 2 — frontend on http://localhost:5173
cd frontend
npm run dev
```

Open **http://localhost:5173**. Verify the backend with
`curl http://127.0.0.1:8787/health`.

To run the Node/Express fallback instead (port 3001):

```bash
cd backend
npm run dev:node
```

Wrangler creates local KV namespaces automatically under `backend/.wrangler/state`, so there is
nothing to provision before running locally. When the Worker is up, point the frontend at it with
`VITE_API_URL=http://127.0.0.1:8787/api`; it otherwise defaults to the Node server on 3001.

> The first request to a cold backend is slow — it runs live YouTube queries to build
> shelves. Allow ~10–30s, and up to ~90s for a large uncached artist-image request.
> Subsequent requests are served from KV and are typically single-digit milliseconds.

---

## ⚙️ Configuration

### Backend — `backend/.env`

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS allowlist |

### Backend — optional tuning

These have sane defaults and rarely need changing. Listed because they are the knobs behind
discovery quality and rate limiting.

| Variable | Default | Effect |
|---|---|---|
| `SPOTUNER_TTL_TRENDING_MS` | 20 min | Trending cache lifetime |
| `SPOTUNER_TTL_LATEST_MS` | 45 min | Latest cache lifetime |
| `SPOTUNER_TTL_CATALOG_MS` | 6 h | Editorial shelf cache lifetime |
| `SPOTUNER_STALE_GRACE_MS` | 30 min | How long stale data is served while revalidating |
| `SPOTUNER_TRENDING_WINDOW_DAYS` | 210 | Max age for a trending track |
| `SPOTUNER_RELEASE_WINDOW_DAYS` | 365 | Max age for a latest-release track |
| `SPOTUNER_MIN_TRENDING_SCORE` | 12 | Minimum score to appear on trending |
| `SPOTUNER_MIN_LATEST_SCORE` | 18 | Minimum score to appear on latest |
| `SPOTUNER_REPETITION_WEIGHT` | 1 | Penalty for repeated artists |
| `SPOTUNER_HYDRATE_LIMIT` | 90 | Candidates hydrated with full metadata |
| `SPOTUNER_META_CONCURRENCY` | 8 | Parallel metadata requests |
| `SPOTUNER_LANGUAGE_DEBUG` | off | Verbose language classification |
| `SPOTUNER_ITUNES_INTERVAL_MS` | 110 | Minimum gap between iTunes requests |
| `SPOTUNER_ITUNES_BACKOFF_MS` | 15 min | Cooldown after iTunes throttles |
| `SPOTUNER_ARTIST_PRIME_LIMIT` | 250 | Artist-image keys a cold isolate pulls into memory. A subrequest budget, not a cache size — lower it on the Workers free plan |

On a deployed Worker these are **not** read from `.env`. Non-secret values live in
`backend/wrangler.jsonc` under `vars`; credentials are Worker secrets. See below.

### Spotify (optional)

| Variable | Notes |
|---|---|
| `SPOTIFY_CLIENT_ID` | From the Spotify developer dashboard |
| `SPOTIFY_CLIENT_SECRET` | **Server-side only.** Never reaches the browser |
| `SPOTUNER_SPOTIFY_COOLDOWN_MS` | Fallback cooldown after a 429 when Spotify sends no `Retry-After` |

Without these, Spotify is simply unavailable: YouTube remains the search, discovery and
playback source, and nothing degrades. Credentials live in `backend/.env`, which is
gitignored; `.env.example` holds placeholders only.

### MusicBrainz enrichment (optional)

| Variable | Default | Effect |
|---|---|---|
| `SPOTUNER_METABRAINZ` | on | Set `off` to disable enrichment entirely |
| `SPOTUNER_MB_INTERVAL_MS` | 1050 | Gap between MusicBrainz requests (~1 req/s limit) |
| `SPOTUNER_ENRICH_LIMIT` | 24 | Candidates enriched per discovery run |
| `SPOTUNER_MAX_ENRICHERS` | 2 | Enrichment providers consulted per run |

### Cloudflare — namespaces, secrets and deploy

The Worker needs two KV namespaces and two secrets. A **paid plan is required**: a cold
`/api/shelves` fans out into far more than the free plan's 50 subrequests per invocation.

```bash
cd backend

# 1. Provision KV and paste the four returned ids into wrangler.jsonc
npm run kv:create

# 2. Store the Spotify credentials encrypted
npm run secret:spotify-id
npm run secret:spotify-secret

# 3. Check the bundle, then deploy
npm run typecheck
npx wrangler deploy --dry-run
npm run deploy

# 4. Tail production logs
npm run tail
```

| Binding | Contents |
|---|---|
| `CACHE` | Discovery SWR entries, search results, stream URLs, hydrated metadata, language detections, hero images, Spotify cooldown |
| `ARTIST_IMAGES` | Persistent iTunes artist-image catalogue |

| Secret | Required |
|---|---|
| `SPOTIFY_CLIENT_ID` | Optional. Without it Spotify is unavailable and YouTube carries everything |
| `SPOTIFY_CLIENT_SECRET` | Optional, and must stay server-side |

Local `wrangler dev` reads `.env` automatically, so the same code runs locally and in
production without a second config path.

### Frontend — `frontend/.env`

| Variable | Default |
|---|---|
| `VITE_API_URL` | `http://localhost:3001/api` |

---

## 📡 API reference

### Health
```
GET /health
```

### Streaming
```
GET /api/stream/youtube/:videoId
```

### Search
```
GET /api/search/youtube?query=<song>

GET /api/search/all?query=<song>&source=<all|youtube|spotify|auto>&limit=
```

`source=all` queries both providers concurrently, normalises, matches cross-provider
duplicates and merges them into one result. The response carries the merged list on `tracks`,
plus per-provider arrays, so older clients keep working. A provider that fails is reported in
`errors` rather than silently dropped.

### Providers
```
GET /api/providers
```
Reports which providers are registered, which are available, and **which can serve audio**.

### Playback
```
GET /api/play/:source/:id?source=<auto|youtube|spotify>
```
Resolves a playable stream for a track from any source, and reports which provider actually
served it plus why. A Spotify track normally resolves to a matched YouTube upload.

### Shelves
```
GET /api/shelves?limit=<n>
```
Builds editorial shelves from YouTube search. **Slow on a cold cache (~10s+)** — this is why
the frontend uses a 60s request budget for it.

### Discovery
```
GET /api/discovery/trending?scope=<global|ml|ta|...>&limit=&maxPerArtist=
GET /api/discovery/latest?scope=<global|ml|ta|...>&limit=&maxPerArtist=
GET /api/discovery/home?scope=&limit=
GET /api/discovery/status      # cache ages, scoring weights, provider stats
POST /api/discovery/refresh    # invalidate trending, latest, foryou and shelves
```

### For You
```
POST /api/discovery/foryou
{ "profile": { "artists": {...}, "languages": {...}, "genres": {...},
               "skippedArtists": {...}, "playedKeys": [...], "totalPlays": 0 },
  "scope": "global", "limit": 20, "enrich": true }
```

The profile is posted rather than looked up because listening history lives in the browser's
`localStorage` — there is no server-side user. Only a **compact summary** is sent:
normalised affinities and skip counts, never track titles, timestamps, or per-play records.
Nothing is persisted server-side.

### Language
```
GET  /api/language/status
POST /api/language/detect      # { title, description?, channel? }
```

### Artists
```
POST /api/artists/images       # { names: string[] } -> { images: { name: url|null } }
```
Accepts up to 120 names per call. Names with no image resolve to `null` so the caller can
keep its placeholder.

### Hero images
```
POST /api/hero-image
```

---

## 🏗️ Architecture

```
spotuner/
├── backend/
│   ├── server.js                  # Express app and all routes
│   ├── lib/
│   │   ├── youtube.js             # InnerTube client, search, normalization, streams
│   │   ├── artists.js             # iTunes artist imagery + disk cache
│   │   ├── metadata/              # provider layer
│   │   │   ├── index.js           #   enrich() + dedupe(), never rejects
│   │   │   ├── normalize.js       #   canonical track + non-destructive merge
│   │   │   ├── identity.js        #   cross-provider identity and de-duplication
│   │   │   ├── match.js           #   confidence scoring and variant safety
│   │   │   ├── manager.js         #   parallel orchestration + playback choice
│   │   │   ├── registry.js        #   provider roles and availability
│   │   │   └── providers/
│   │   │       ├── youtube.js     #     primary: the only source of candidates
│   │   │       ├── spotify.js     #     enrichment only, never playback
│   │   │       └── musicbrainz.js #     enrichment only, never playback
│   │   ├── discovery/             # trending/latest/for-you pipeline
│   │   │   ├── index.js           #   orchestration and scoring thresholds
│   │   │   ├── queries.js         #   date-aware and profile-aware query families
│   │   │   ├── pool.js            #   multi-query search pool
│   │   │   ├── metadata.js        #   InnerTube WEB metadata hydration
│   │   │   ├── freshness.js       #   age and release scoring
│   │   │   ├── quality.js         #   post-hydration filtering
│   │   │   ├── score.js           #   trending and latest ranking
│   │   │   ├── foryou.js          #   personalised affinity scoring
│   │   │   ├── diversity.js       #   artist cap and repetition damping
│   │   │   ├── dimensions.js      #   album and language diversity
│   │   │   └── swrcache.js        #   stale-while-revalidate cache
│   │   ├── language/              # language detection
│   │   │   ├── index.js           #   public API
│   │   │   ├── detect.js          #   classification
│   │   │   ├── lexicon.js         #   per-language word lists
│   │   │   ├── script.js          #   script/transliteration signals
│   │   │   └── metadata.js        #   title/description/channel extraction
│   │   └── heroImage/             # hero artwork resolution
│   │       ├── index.js
│   │       └── providers/         #   local artwork, external search, fallbacks
│   ├── bin/yt-dlp/                # bundled yt-dlp binary
│   ├── scripts/                   # tests and probes
│   └── .cache/                    # generated: artist image cache
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Artwork/           # Artwork, PlayButton
│   │   │   ├── Branding/          # SpotunerBrand
│   │   │   ├── Cards/             # card components, TrackRow
│   │   │   ├── Layout/            # Sidebar, Header, Shelf, RightPanel
│   │   │   ├── Pages/             # Home, Search, Browse, Artists, Artist, …
│   │   │   └── Player/            # PlayerBar, ProgressBar, VolumeControl
│   │   ├── context/               # Player, Queue, Library, Preferences providers
│   │   ├── hooks/                 # useShelves, useArtists, useDiscovery, useForYou, …
│   │   ├── recommend/             # recommendation engine + profileSummary
│   │   ├── services/api.js        # API clients
│   │   ├── utils/                 # artists.js, formatTime.js
│   │   ├── App.jsx                # routes
│   │   └── index.css              # Tailwind v4 theme + design tokens
│   └── scripts/                   # tests and probes
│
└── README.md
```

### Routes
`/` · `/search` · `/browse` · `/radio` · `/artists` · `/artists/:artistKey` · `/albums` ·
`/playlists` · `/library` · `/liked`

### Artist URL format
Artist keys are lowercased and keep literal spaces internally; links use a hyphenated slug.
`findArtist` compares slugs on both sides, so all of these resolve:

- `/artists/anirudh-ravichander` (canonical)
- `/artists/anirudh%20ravichander` (legacy space form)
- `/artists/ajay-atul` (hyphen preserved in real names)
- `/artists/m.g.-sreekumar` (initials)

---

## 🧪 Testing and diagnostics

### Backend

```bash
cd backend
npm test                 # all unit suites: discovery, metadata, scoring, failure
npm run typecheck        # tsc --noEmit over src/ and lib/
npm run test:compat      # live Worker contract suite (needs `npm run dev` running)
npm run test:discovery   # freshness, scoring, caching, quality, language
npm run test:metadata    # normalisation, merging, identity, MusicBrainz selection
npm run test:scoring     # personalised scoring, penalties, diversity
npm run test:failure     # an unavailable provider never breaks the pipeline
npm run test:spotify     # auth, matching, dedup, playback fallback, failures
npm run test:spotify-security  # the client secret never leaves the server
npm run test:api         # live API response-shape contracts (needs `npm run dev:node`)
npm run check:discovery  # trending vs latest overlap, upload-age sanity
npm run probe:metadata   # InnerTube metadata probe
npm run probe:providers  # live MusicBrainz enrichment coverage
```

`test:compat` and `test:api` are the two live suites and they target different servers on
purpose: `test:compat` exercises the deployed Worker (`:8787`) and asserts the contract the
frontend depends on — response shapes, CORS, cache headers, error statuses, and a stream URL
that really resolves audio. `test:api` asserts the same shapes against the Express fallback
(`:3001`). Override the compat target with `BASE_URL=https://your-worker.workers.dev`.

### Frontend

```bash
cd frontend
npm run lint                  # oxlint
npm run test                  # render smoke + recommendations
npm run test:render           # mounts every component via react-dom/server
npm run test:recommend        # recommendation engine checks
npm run test:live             # live language verification against the backend
npm run check:artists         # credit splitting and URL round-trips
npm run check:artist-images   # artist image coverage end-to-end
npm run probe:artist-page     # renders Artists in headless Chrome over CDP
```

`probe:artist-page` is the one that catches browser-only failures. It needs Chrome installed
at `C:\Program Files\Google\Chrome\Application\chrome.exe` and both servers running.

---

## ⚠️ Known limitations

**Artist image coverage is ~20–30%.** iTunes throttles sustained traffic, and many credited
performers have no catalogue entry — session singers, and lo-fi/ambient channels like
"Sad Music" or "Lofi Sleep Chill" that are not artists at all. Resolved pictures are cached in
the `ARTIST_IMAGES` KV namespace, and coverage climbs across sessions as backoffs
expire. Everything else falls back to track artwork. Images are catalogue covers, not
portrait photographs.

**A paid Cloudflare plan is required, not optional.** The free plan allows 50 subrequests per
invocation; a cold `/api/shelves` costs several hundred. A cold build takes 20–30s, and a large
uncached `/api/artists/images` request can take ~90s, because the iTunes pacing is deliberately
slow to avoid tripping throttling. Both are cached in KV afterwards.

**Spotify is a metadata provider, never a playback source.** The Spotify Web API does not
expose an audio stream endpoint for third-party use, so a Spotify track is played through a
matched YouTube upload. `playable` is `false` on every Spotify record — that is a fact about
the API, not a gap. Real Spotify playback would require the Web Playback SDK, an interactive
Premium login, and browser-side account state; none of that is faked here.

**Spotify's search endpoint caps `limit` at 10, not the documented 50.** Measured directly:
`limit=10` returns 200, `limit=20` returns HTTP 400 "Invalid limit". Exceeding it fails
silently — the provider reports no results and no error — so multi-source search would appear
to work while returning YouTube only.

**Spotify rate limits reset roughly daily.** A quota exhaustion returns `Retry-After` of
around 84000 seconds. The provider honours that and persists the deadline to
`backend/.cache/spotify-state.json`, so a restart during a long cooldown stays quiet instead of
consuming thousands of doomed requests. While cooling down, search reports
`{"spotify": "rate limited (cooling down)"}` rather than degrading silently.

**MusicBrainz enrichment coverage is roughly 25%** of a trending run, and near zero for
Malayalam and Tamil film music, which is thinly catalogued there. Enrichment is bounded to
24 candidates per run (`SPOTUNER_ENRICH_LIMIT`) because the service is limited to about one
request per second. A release date is only reported when a usable release matching the
recording exists — a missing date is preferred over a wrong one, because it feeds the
latest-release score.

**iTunes rejects browser user-agents.** Sending a Chrome `User-Agent` returns HTTP 429 and
drops coverage to zero. The client deliberately sends no custom UA; this is pinned by
`backend/scripts/probe-artist-image3.mjs`.

**A cold `/api/shelves` takes 8–30 seconds.** It runs three discovery passes and a full
editorial shelf build against live YouTube. The result is cached with stale-while-revalidate,
so this is a once-per-process cost, not a per-navigation one.

**Regional discovery is sparse for Hindi, Telugu, Kannada, and Bengali.** YouTube returns
mostly older catalogue for those languages, and the freshness gates reject it rather than
padding a shelf with stale tracks. Malayalam and Tamil are well populated.

**Shelves are slow on a cold cache.** `/api/shelves` runs live YouTube queries and takes
~10s warm, considerably longer cold. This is a one-time cost per backend process: the route
is cached with stale-while-revalidate, so navigation afterwards is served from memory.

**Unstable unofficial APIs.** InnerTube endpoints and yt-dlp break periodically. Version
constants in `backend/lib/youtube.js` (`CLIENT`, `META_CLIENT`) are the first thing to bump
when YouTube changes its API.

---

## ⚖️ Legal notice

Educational project. It uses unofficial, unauthenticated access to YouTube Music and the
iTunes Search API. Both are subject to change and their use may violate their terms of
service. No audio is stored or redistributed — streams are resolved on demand and cached
only as URLs. For any real deployment, use licensed audio and official APIs.

---

## 📄 License

MIT
