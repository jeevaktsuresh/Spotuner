/**
 * Hono application.
 *
 * Every route below is a transcription of the Express server that ran before it:
 * same paths, same methods, same parameters, same response bodies and status codes.
 * The only structural differences are the ones the Workers runtime forces — there
 * is no listener, no `node-cache`, and no `process.env` — and those live in
 * `lib/runtime/`, not here.
 *
 * Response formats are load-bearing: the frontend consumes them directly, and
 * `/api/shelves` in particular must stay a bare array. Nothing in this file
 * envelopes a response.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

import health from './routes/health.js';
import search from './routes/search.js';
import playback from './routes/playback.js';
import shelves from './routes/shelves.js';
import discovery from './routes/discovery.js';
import language from './routes/language.js';
import artists from './routes/artists.js';
import heroImage from './routes/heroImage.js';

import { envList } from '../lib/runtime/env.js';

/**
 * Origins allowed to call this API.
 *
 * Configurable because the frontend moves: it is on `localhost:5173` in
 * development and on Vercel in production. `credentials` stays on, so this is an
 * allow-list rather than a wildcard — an unauthenticated `*` would be simpler and
 * would also mean any site on the internet could drive this user's browser at the
 * API.
 */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://spotuner.vercel.app',
];

const app = new Hono();

/**
 * Resolve the request's origin against the allow-list.
 *
 * `ALLOWED_ORIGINS` is a comma-separated list in `wrangler.jsonc`. It is *unioned*
 * with the defaults rather than replacing them, so a typo or a stale redeploy can
 * never lock the deployed frontend out of its own API and present it as an
 * unexplained CORS failure — the failure mode this exists to prevent. Origins are
 * compared exactly, so a prefix or wildcard is never accepted.
 */
function allowOrigin(origin: string): string | null {
  if (!origin) return null;
  const configured = envList('ALLOWED_ORIGINS', DEFAULT_ORIGINS);
  const allowed = new Set([...DEFAULT_ORIGINS, ...configured]);
  return allowed.has(origin) ? origin : null;
}

app.use(
  '*',
  cors({
    origin: allowOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    // Hono's option is `credentials`; it emits Access-Control-Allow-Credentials.
    credentials: true,
    // `/api/shelves` reports its cache state in these two headers, and a browser
    // cannot read a response header that is not explicitly exposed.
    exposeHeaders: ['X-Spotuner-Cache', 'X-Spotuner-Cache-Age'],
    maxAge: 86400,
  }),
);

/**
 * Request body ceiling.
 *
 * The Express server inherited a 256 KB limit from `express.json()`. Hono's `bodyParser`
 * does not cap anything by itself, and only three routes here read a body
 * (`/api/discovery/foryou`, `/api/artists/images`, `/api/hero-image`) — but an
 * uncapped body is still uncapped memory on a Worker, so the limit is enforced
 * globally and by declared length, before the body is ever buffered.
 */
const MAX_BODY_BYTES = 256 * 1024;

app.use('*', async (c, next) => {
  const declared = Number(c.req.header('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return c.json({ error: 'Payload too large' }, 413);
  }

  await next();

  // A chunked request has no declared length, so the real size is only known once
  // the body has been consumed. Anything past the ceiling is rejected after the
  // fact; the route has already run, so the status is still raised for the client.
  const actual = Number(c.req.header('content-length') ?? '0');
  if (!declared && Number.isFinite(actual) && actual > MAX_BODY_BYTES) {
    return c.json({ error: 'Payload too large' }, 413);
  }
});

/**
 * Anything unrouted is a 404 in the same JSON shape the rest of the API uses.
 *
 * Hono's default is a plain-text `404 Not Found`, which a client that assumes JSON
 * would fail to parse.
 */
app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  // The message is logged, never returned: a stack trace or an upstream error body
  // can carry configuration details. `spotify.redact()` is the project's existing
  // scrubber for provider messages and is applied on the routes that need it.
  console.error('[spotuner] unhandled worker error:', error?.message ?? error);
  return c.json({ error: 'Internal server error' }, 500);
});

app.route('/', health);
app.route('/api', search);
app.route('/api', playback);
app.route('/api', shelves);
app.route('/api', discovery);
app.route('/api', language);
app.route('/api', artists);
app.route('/api', heroImage);

export default app;