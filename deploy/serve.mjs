import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Static front end + API reverse proxy.
 *
 * Serves the built Vite bundle from `frontend/dist` and forwards `/api` and
 * `/health` to the Spotuner backend. Same-origin by design: the browser only ever
 * talks to this process, so the API's exact-match CORS allow-list can never lock
 * the deployed front end out of its own backend over a hostname difference.
 *
 * Configuration (environment):
 *   WEB_ROOT      directory to serve        (default ../frontend/dist)
 *   PORT          listen port               (default 8080)
 *   HOST          bind address              (default 0.0.0.0)
 *   API_TARGET    backend origin            (default http://127.0.0.1:3001)
 *   PROXY_PATHS   proxied path prefixes     (default /api,/health)
 */

const here = fileURLToPath(new URL('.', import.meta.url))
const WEB_ROOT = resolve(process.env.WEB_ROOT || join(here, '..', 'frontend', 'dist'))
const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'
const API_TARGET = new URL(process.env.API_TARGET || 'http://127.0.0.1:3001')
const PROXY_PATHS = (process.env.PROXY_PATHS || '/api,/health')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

const isProxied = (pathname) => PROXY_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

/** Forward a request to the backend, streaming both ways so nothing is buffered whole. */
const proxy = (req, res) => {
  const doRequest = API_TARGET.protocol === 'https:' ? httpsRequest : httpRequest
  const headers = { ...req.headers, host: API_TARGET.host }
  const upstream = doRequest(
    {
      protocol: API_TARGET.protocol,
      hostname: API_TARGET.hostname,
      port: API_TARGET.port || (API_TARGET.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )

  upstream.on('error', (error) => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    send(res, 502, `Backend unreachable at ${API_TARGET.origin}: ${error.message}`)
  })

  req.pipe(upstream)
}

/** Resolve a URL path to a file inside WEB_ROOT, or null if it escapes or is a directory. */
const resolveFile = (pathname) => {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null

  const candidate = resolve(join(WEB_ROOT, normalize(decoded)))
  if (candidate !== WEB_ROOT && !candidate.startsWith(WEB_ROOT + sep)) return null
  if (!existsSync(candidate)) return null

  const stats = statSync(candidate)
  if (stats.isDirectory()) {
    const index = join(candidate, 'index.html')
    return existsSync(index) ? index : null
  }
  return candidate
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (isProxied(pathname)) {
    proxy(req, res)
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
    return
  }

  const file = resolveFile(pathname) || (pathname.startsWith('/assets/') ? null : resolveFile('/index.html'))
  if (!file) {
    send(res, 404, 'Not Found')
    return
  }

  const isIndex = file === join(WEB_ROOT, 'index.html')
  const immutable = pathname.startsWith('/assets/')

  res.writeHead(200, {
    'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': statSync(file).size,
    'Cache-Control': isIndex
      ? 'no-cache'
      : immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
  })

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  createReadStream(file).pipe(res)
})

if (!existsSync(WEB_ROOT)) {
  console.error(`[web] WEB_ROOT does not exist: ${WEB_ROOT}. Build the frontend first.`)
  process.exit(1)
}

server.listen(PORT, HOST, () => {
  console.log(`[web] serving ${WEB_ROOT} on http://${HOST}:${PORT}`)
  console.log(`[web] proxying ${PROXY_PATHS.join(', ')} -> ${API_TARGET.origin}`)
})