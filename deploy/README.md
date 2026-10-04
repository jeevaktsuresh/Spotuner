# Deployment — `~/spotuner` on the home server

This is the deployment. Nothing is hosted off-box: no Cloudflare Worker, no CDN, no third-party
frontend host. The app runs the Node/Express entrypoint (`backend/server.js`), and the built bundle
is served from the same machine. `backend/src/` still contains a Hono/Worker build of the same
routes; it is unused here and nothing in this document depends on it.

## Shape

```
browser ──▶ spotuner-web  (0.0.0.0:8080)  deploy/serve.mjs
              ├── /            → frontend/dist  (static, SPA fallback to index.html)
              ├── /assets/*    → immutable, 1 year
              └── /api,/health → proxied to 127.0.0.1:3001

                    spotuner-api  (0.0.0.0:3001)  node backend/server.js
                      └── YouTube InnerTube, iTunes, MusicBrainz, Spotify
```

Same-origin on purpose: the browser only ever talks to port 8080, so the API's exact-match CORS
allow-list can never lock the front end out over a hostname or IP difference. The bundle is built
with `VITE_API_URL=/`, which resolves every call to `/api` on whatever host served the page.

## Prerequisites on the host

Node is installed user-local, without `sudo`, at `~/.local/node` (v24 LTS) and added to `PATH` in
`~/.bashrc` and `~/.profile`.

`yt-dlp` is installed at `~/.local/bin/yt-dlp` and is **load-bearing**, not optional: playback
resolves through it because only the VISIONOS-client URL it selects serves a whole track, while
the InnerTube URLs truncate at ~1.5 MB. `spotuner-api.service` sets `PATH` explicitly, because a
systemd user unit reads no shell rc file and a resolver that cannot find the binary silently
falls back to the truncating clients.

```bash
mkdir -p ~/.local/bin
curl -fsSL -o ~/.local/bin/yt-dlp \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
chmod +x ~/.local/bin/yt-dlp
```

## Services

Units live in `~/.config/systemd/user/` (copied from `deploy/`), and linger is enabled, so they
start at boot without a login session.

```bash
systemctl --user status  spotuner-api spotuner-web
systemctl --user restart spotuner-web        # after a frontend rebuild
journalctl --user -u spotuner-api -f
systemctl --user --now disable spotuner-web  # front end only
```

## Updating from a working tree

Node, `node_modules` and the systemd units survive; only the sources are replaced.

```bash
# on the dev machine
tar -czf spotuner-src.tar.gz -C /path/to/spotuner \
  --exclude='*/.git' --exclude='*/node_modules' \
  --exclude='backend/.wrangler' --exclude='backend/.cache' \
  --exclude='backend/tmp-meta.json' --exclude='backend/.env' --exclude='backend/bin' \
  --exclude='frontend/dist' --exclude='frontend/.env' --exclude='frontend/.env.local' \
  backend frontend
tar -czf spotuner-deploy.tar.gz -C /path/to/spotuner/deploy .

# on the server
scp spotuner-src.tar.gz spotuner-deploy.tar.gz jts@HOST:~/
ssh jts@HOST
```

```bash
# on the server
cd ~/spotuner
tar -xzf spotuner-src.tar.gz && rm -f spotuner-src.tar.gz
mkdir -p deploy && tar -xzf spotuner-deploy.tar.gz -C deploy && rm -f spotuner-deploy.tar.gz
cp deploy/*.service ~/.config/systemd/user/

(cd backend  && npm install --no-audit --no-fund)
(cd frontend && npm install --no-audit --no-fund && VITE_API_URL=/ npm run build)

systemctl --user daemon-reload
systemctl --user restart spotuner-api spotuner-web
```

`backend/.env` is written once, by hand, and is never overwritten by an update — it is mode `600`
and holds the Spotify credentials. The backend binds every interface on 3001 because
`app.listen(PORT)` takes no host, so the API is reachable directly as well as through the proxy.

## Configuration

`~/spotuner/backend/.env`:

| Variable | Value |
|---|---|
| `PORT` | `3001` |
| `ALLOWED_ORIGINS` | localhost + `http://192.168.18.6:8080` |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | optional; YouTube carries everything without them |

`deploy/serve.mjs` reads `WEB_ROOT`, `PORT`, `HOST`, `API_TARGET` and `PROXY_PATHS`; the unit sets
them.

## Notes

- **yt-dlp is the playback path on this deployment.** `backend/bin/yt-dlp` holds the Windows
  binary and is excluded from the upload; the Linux build lives at `~/.local/bin/yt-dlp`. If
  playback ever stops past ~95 seconds, check `systemctl --user show spotuner-api -p Environment`
  still has `~/.local/bin` on `PATH` — a missing binary is a silent fallback, not an error.
- **Spotify answers 429 for this app.** The client-credentials token is accepted, but every
  `/v1/search` call is rate-limited, so the provider parks in a multi-hour cooldown and drops out
  of search and enrichment. YouTube search, discovery and playback are unaffected, which is the
  designed behaviour for an unavailable optional provider. Upstream quota, not deployment.
- **Caches are in-memory.** With no KV bindings, `CACHE` and `ARTIST_IMAGES` degrade to process
  memory: the first request after a restart is a cold build (trending ~5s, latest ~4s, shelves
  ~10s), warm ones are milliseconds.
- A discovery run fans out into many YouTube queries with a ~3.2 GiB box. `SPOTUNER_HYDRATE_LIMIT`
  and `SPOTUNER_ENRICH_LIMIT` keep their own defaults here (`24` and `2`, not the lower Worker
  values in `backend/wrangler.jsonc`, which exist for a subrequest ceiling that does not apply on
  Node); lower them in `.env` if memory becomes a problem.
- **The bundle cannot reach off-box by accident.** `VITE_API_URL=/` and the same-origin default in
  `frontend/src/services/api.js` mean a rebuild never bakes in a hostname. Check it with
  `grep -rlE 'workers\.dev|vercel\.app' ~/spotuner/frontend/dist` — it should match nothing.
- **Reaching it from outside the LAN** needs a port forward or a tunnel in front of 8080, plus TLS.
  Neither is set up here: the service is plain HTTP on the LAN address, which is fine for a trusted
  network and not fine for the open internet.