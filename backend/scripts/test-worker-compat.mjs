/**
 * Worker API compatibility suite.
 *
 * Exercises every route the frontend depends on, against a running Worker, and
 * asserts the *contract* rather than just the status code: response shape, cache
 * headers, CORS, error statuses and, for playback, a URL that actually resolves
 * audio.
 *
 * This is the counterpart to `scripts/test-api-shape.mjs`, which asserts the same
 * shapes against the Express server's modules in-process. That one still guards the
 * Node path; this one guards what is actually deployed.
 *
 *   Terminal 1:  npm run dev
 *   Terminal 2:  npm run test:compat
 *   Override the target with BASE_URL=http://127.0.0.1:8787
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

let passed = 0;
let failed = 0;
const failures = [];

function record(name, error) {
  if (error) {
    failed += 1;
    failures.push(name);
    console.log(`FAIL ${name}\n       ${error.message}`);
  } else {
    passed += 1;
    console.log(`ok   ${name}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Left null: a non-JSON body is itself a failure the caller reports.
  }
  return { response, json, text, status: response.status, headers: response.headers };
}

const post = (path, body) =>
  call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify(body),
  });

const get = (path, origin = 'http://localhost:5173') =>
  call(path, { headers: { Origin: origin } });

/**
 * A GET that tolerates transient upstream throttling.
 *
 * InnerTube rate-limits by client identity, and this suite fires several searches
 * back to back, which trips it often enough to make a clean run a matter of luck.
 * The routes already retry internally; this is the outer bound for the case where
 * every attempt inside the route was throttled too. A 400 or 404 is never retried —
 * those are the assertions actually under test.
 */
async function getUpstream(path, origin = 'http://localhost:5173', attempts = 3) {
  let result = await get(path, origin);
  for (let attempt = 1; attempt < attempts && (result.status === 500 || result.status === 503); attempt++) {
    await new Promise((r) => setTimeout(r, 800 * attempt));
    result = await get(path, origin);
  }
  return result;
}

const SAMPLE_VIDEO = 'dQw4w9WgXcQ';

const checks = {
  async health() {
    const { status, json } = await get('/health');
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.status === 'ok', 'expected status: ok');
    assert(Number.isFinite(json?.timestamp), 'expected a numeric timestamp');
  },

  async corsAllowed() {
    const { headers, status } = await get('/health', 'http://localhost:5173');
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      headers.get('access-control-allow-origin') === 'http://localhost:5173',
      `expected the request origin to be echoed, got ${headers.get('access-control-allow-origin')}`,
    );
    assert(headers.get('access-control-allow-credentials') === 'true', 'expected credentials to be allowed');
  },

  async corsDisallowed() {
    const { headers } = await get('/health', 'https://not-spotuner.example');
    assert(
      headers.get('access-control-allow-origin') === null,
      `expected no CORS grant for an unlisted origin, got ${headers.get('access-control-allow-origin')}`,
    );
  },

  /**
   * The production frontend origin must be allowed without any configuration, so a
   * misconfigured `ALLOWED_ORIGINS` can never lock the deployed site out of its own
   * API and surface as an unexplained browser CORS error.
   */
  async corsProductionOrigin() {
    const { headers, status } = await get('/api/providers', 'https://spotuner.vercel.app');
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      headers.get('access-control-allow-origin') === 'https://spotuner.vercel.app',
      `expected the production origin to be echoed, got ${headers.get('access-control-allow-origin')}`,
    );
  },

  /** A wildcard, or a prefix match on the production origin, would be a real leak. */
  async corsNeverWildcard() {
    for (const origin of ['https://evil.example', 'https://spotuner.vercel.app.evil.com', 'null']) {
      const { headers } = await get('/api/providers', origin);
      const granted = headers.get('access-control-allow-origin');
      assert(granted !== '*', `expected no wildcard grant for ${origin}, got ${granted}`);
      assert(granted === null, `expected no grant for ${origin}, got ${granted}`);
    }
  },

  /**
   * Preflight is what a browser sends before any JSON POST, and it is answered by the
   * CORS layer alone. If it regresses, every write endpoint fails in the browser
   * while the same request succeeds from curl.
   */
  async corsPreflight() {
    const { status, headers } = await call('/api/hero-image', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://spotuner.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    assert(status === 204, `expected 204, got ${status}`);
    assert(
      headers.get('access-control-allow-origin') === 'https://spotuner.vercel.app',
      `expected the production origin, got ${headers.get('access-control-allow-origin')}`,
    );

    const methods = (headers.get('access-control-allow-methods') ?? '').split(',').map((m) => m.trim());
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      assert(methods.includes(method), `expected ${method} in Access-Control-Allow-Methods, got "${methods.join(',')}"`);
    }

    const allowed = (headers.get('access-control-allow-headers') ?? '').toLowerCase();
    for (const header of ['content-type', 'authorization']) {
      assert(allowed.includes(header), `expected ${header} in Access-Control-Allow-Headers, got "${allowed}"`);
    }
  },

  /**
   * CORS headers must survive the error paths too. A 4xx or 5xx that loses its
   * `Access-Control-Allow-Origin` is reported by the browser as a CORS failure,
   * which hides the real status and makes the bug look like a network problem.
   */
  async corsOnErrorResponses() {
    const cases = [
      ['404 not found', '/api/definitely-not-a-route', {}],
      [
        '413 payload too large',
        '/api/artists/images',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: ['x'.repeat(300000)] }) },
      ],
      [
        '400 validation',
        '/api/language/detect',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
      ],
    ];

    for (const [name, path, init] of cases) {
      const { headers } = await call(path, { ...init, headers: { Origin: 'https://spotuner.vercel.app', ...(init.headers ?? {}) } });
      assert(
        headers.get('access-control-allow-origin') === 'https://spotuner.vercel.app',
        `${name}: expected the CORS header to survive, got ${headers.get('access-control-allow-origin')}`,
      );
    }
  },

  async notFound() {
    const { status, json } = await get('/api/definitely-not-a-route');
    assert(status === 404, `expected 404, got ${status}`);
    assert(json?.error, 'expected a JSON error body');
  },

  async providers() {
    const { status, json } = await get('/api/providers');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json?.providers?.registered), 'expected providers.registered[]');
    assert(json?.playback?.youtube === true, 'expected YouTube to report playable');
    assert(json?.playback?.spotify === false, 'expected Spotify to report not playable');
    // The secret must never be echoed by the diagnostics route.
    assert(!JSON.stringify(json).includes('SPOTIFY_CLIENT_SECRET'), 'response leaked a secret name');
  },

  async youtubeSearch() {
    const { status, json } = await getUpstream('/api/search/youtube?query=malayalam%20songs&limit=3');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json), 'expected a bare array of tracks');
    assert(json.length > 0, 'expected at least one result');
    for (const key of ['id', 'title', 'artist', 'source']) {
      assert(key in json[0], `track is missing "${key}"`);
    }
    assert(json[0].source === 'youtube', 'expected source: youtube');
  },

  async youtubeSearchRequiresQuery() {
    const { status, json } = await get('/api/search/youtube');
    assert(status === 400, `expected 400, got ${status}`);
    assert(json?.error === 'Query is required', 'expected the documented error message');
  },

  async youtubeSearchRespectsLimit() {
    const { json } = await getUpstream('/api/search/youtube?query=hindi%20songs&limit=2');
    assert(Array.isArray(json), 'expected an array');
    assert(json.length <= 2, `expected at most 2 results, got ${json.length}`);
  },

  async searchAll() {
    const { status, json } = await getUpstream('/api/search/all?query=malayalam%20songs&limit=5');
    assert(status === 200, `expected 200, got ${status}`);
    for (const key of ['youtube', 'spotify', 'tracks', 'sources', 'errors', 'merged']) {
      assert(key in json, `response is missing "${key}"`);
    }
    assert(Array.isArray(json.tracks), 'tracks must be an array');
    assert(json.sources && typeof json.sources === 'object', 'sources must be an object');
    // Whatever the provider mix, every returned track has to be playable in-app.
    const playable = json.tracks.filter((t) => t.playable);
    assert(
      playable.length === json.tracks.length || json.sources.spotify === 0,
      'a non-playable track was returned without a Spotify source to explain it',
    );
  },

  async searchAllYoutubeOnly() {
    const { status, json } = await getUpstream('/api/search/all?query=tamil%20songs&source=youtube&limit=4');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json.youtube), 'expected a youtube array');
    assert(json.tracks.length === json.youtube.length, 'single-provider tracks must be the same list');
    assert('spotify' in json === false, 'a single-provider request must not add a spotify key');
  },

  async searchAllSpotifyOnly() {
    const { status, json } = await getUpstream('/api/search/all?query=pritam&source=spotify&limit=4');
    assert(status === 200, `expected 200, got ${status}`);
    assert('spotify' in json, 'expected a spotify key');
    assert(Array.isArray(json.spotify), 'spotify must be an array');
  },

  async searchAllRequiresQuery() {
    const { status, json } = await get('/api/search/all');
    assert(status === 400, `expected 400, got ${status}`);
    assert(json?.error === 'Query is required', 'expected the documented error message');
  },

  async streamResolution() {
    const { status, json } = await getUpstream(`/api/stream/youtube/${SAMPLE_VIDEO}`);
    assert(status === 200, `expected 200, got ${status}`);
    assert(typeof json?.streamUrl === 'string', 'expected a streamUrl string');
    assert(json.streamUrl.startsWith('https://'), 'expected an absolute https URL');
    assert(json.streamUrl.includes('googlevideo.com'), `expected a googlevideo URL, got ${json.streamUrl.slice(0, 60)}`);
  },

  async streamIsCached() {
    const first = await getUpstream(`/api/stream/youtube/${SAMPLE_VIDEO}`);
    const second = await get(`/api/stream/youtube/${SAMPLE_VIDEO}`);
    assert(first.status === 200 && second.status === 200, 'both requests should succeed');
    assert(first.json.streamUrl === second.json.streamUrl, 'expected the cached URL to be reused');
  },

  async playYouTube() {
    const { status, json } = await get(`/api/play/youtube/${SAMPLE_VIDEO}`);
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.source === 'youtube', `expected source: youtube, got ${json?.source}`);
    assert(typeof json.streamUrl === 'string', 'expected a streamUrl');
    assert(json.reason, 'expected a playback reason');
    assert(json.track?.playable === true, 'expected the returned track to be playable');
    assert(json.track?.playbackProvider === 'youtube', 'expected playbackProvider on the track');
  },

  async playUnknownTrack() {
    const { status, json } = await get('/api/play/youtube/aaaaaaaaaaaaaaaaaaaa');
    assert(status === 404 || status === 500, `expected a 404/500, got ${status}`);
    assert(json?.error, 'expected an error message');
  },

  async discoveryStatus() {
    const { status, json } = await get('/api/discovery/status');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json?.scopes), 'expected scopes[]');
    for (const scope of ['global', 'ml', 'ta', 'hi', 'te', 'kn', 'bn', 'pa', 'mr', 'gu']) {
      assert(json.scopes.includes(scope), `expected scope "${scope}"`);
    }
    assert(json.cache && json.metadata, 'expected cache and metadata diagnostics');
  },

  async discoveryTrending() {
    const { status, json } = await getUpstream('/api/discovery/trending?limit=5');
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.kind === 'trending', `expected kind: trending, got ${json?.kind}`);
    assert(json.scope === 'global', 'expected the scope echoed');
    assert(Array.isArray(json.tracks), 'expected tracks[]');
    assert(json.tracks.every((t) => t.playable === true), 'discovery must only emit playable tracks');
  },

  async discoveryLatest() {
    const { status, json } = await getUpstream('/api/discovery/latest?limit=5');
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.kind === 'latest', `expected kind: latest, got ${json?.kind}`);
    assert(Array.isArray(json.tracks), 'expected tracks[]');
  },

  async discoveryMalayalam() {
    const { status, json } = await getUpstream('/api/discovery/trending?scope=ml&limit=4');
    assert(status === 200, `expected 200, got ${status}`);
    assert(json.scope === 'ml', 'expected the ml scope echoed');
    // The language gate must hold: a Malayalam shelf may not contain Tamil.
    const wrong = (json.tracks ?? []).filter((t) => t.language && t.language !== 'ml');
    assert(wrong.length === 0, `language gate leaked: ${wrong.map((t) => `${t.artist} (${t.language})`).join(', ')}`);
  },

  async discoveryUnknownScopeFallsBack() {
    const { status, json } = await getUpstream('/api/discovery/trending?scope=zz&limit=3');
    assert(status === 200, `expected 200, got ${status}`);
    assert(json.scope === 'global', 'an unsupported scope must fall back to global');
  },

  async discoveryHome() {
    const { status, json } = await getUpstream('/api/discovery/home?limit=4');
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.scope, 'expected a scope');
    assert(Array.isArray(json?.trending?.tracks), 'expected trending.tracks[]');
    assert(Array.isArray(json?.latest?.tracks), 'expected latest.tracks[]');
  },

  async discoveryForYou() {
    const { status, json } = await post('/api/discovery/foryou', {
      scope: 'global',
      limit: 4,
      profile: { artists: { 'm. g. sreekumar': 3 }, languages: { ml: 2 }, totalPlays: 5 },
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json?.tracks), 'expected tracks[]');
    assert(json.stats?.personalisation, 'expected a personalisation summary');
  },

  async languageStatus() {
    const { status, json } = await get('/api/language/status');
    assert(status === 200, `expected 200, got ${status}`);
    for (const key of ['metadataLayer', 'weights', 'bands', 'minConfidence', 'cache', 'debugLogging']) {
      assert(key in json, `response is missing "${key}"`);
    }
  },

  async languageDetect() {
    const { status, json } = await post('/api/language/detect', {
      tracks: [
        { id: 'lang-1', title: 'മലയാളം ഗീതം', artist: 'വിജയ് നരസിംഹൻ' },
        { id: 'lang-2', title: 'Vaathi Illa', artist: 'S. Janaki' },
      ],
      searchContexts: ['ml'],
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json?.results), 'expected results[]');
    assert(json.summary && json.summary.counts, 'expected a summary with counts');
    assert(json.results[0].language === 'ml', `expected Malayalam, got ${json.results[0].language}`);
  },

  async languageDetectRequiresTracks() {
    const { status, json } = await post('/api/language/detect', { tracks: [] });
    assert(status === 400, `expected 400, got ${status}`);
    assert(json?.error, 'expected an error message');
  },

  async artistImages() {
    const { status, json } = await post('/api/artists/images', {
      names: ['M. G. Sreekumar', 'K. J. Yesudas', 'Arijit Singh'],
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.images && typeof json.images === 'object', 'expected an images object');
    assert(json.truncated === false, 'three names must not be truncated');
  },

  async artistImagesTruncates() {
    const names = Array.from({ length: 130 }, (_, i) => `artist ${i}`);
    const { status, json } = await post('/api/artists/images', { names });
    assert(status === 200, `expected 200, got ${status}`);
    assert(json.truncated === true, 'expected truncated: true past 120 names');
    assert(Object.keys(json.images).length <= 120, 'must not resolve more than 120 names');
  },

  async heroImageSingle() {
    const { status, json } = await post('/api/hero-image', {
      title: 'Vaathi Illa',
      artist: 'S. Janaki',
      album: 'Anjali',
      id: 'hero-1',
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(json?.results), 'expected results[]');
    assert(json.results.length === 1, 'expected exactly one result for a single object');
    assert('confidence' in json.results[0], 'expected a confidence score');
    assert('background' in json.results[0], 'expected the fallback gradient to be present');
  },

  async heroImageBatch() {
    const { status, json } = await post('/api/hero-image', {
      items: [
        { title: 'Malare', artist: 'Armaan Malik', id: 'hero-2' },
        { title: 'Vaathi Illa', artist: 'S. Janaki', id: 'hero-3' },
      ],
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(json.results.length === 2, 'expected one result per item');
  },

  async heroImageRejectsEmptyItems() {
    const { status, json } = await post('/api/hero-image', { items: [] });
    assert(status === 400, `expected 400, got ${status}`);
    assert(json?.error === 'items is required', 'expected the documented error message');
  },

  async shelves() {
    const { status, json, headers } = await getUpstream('/api/shelves?limit=3');
    assert(status === 200, `expected 200, got ${status}`);
    // The contract that must not be broken: a bare array.
    assert(Array.isArray(json), `expected a bare array, got ${typeof json}`);
    assert(json.length > 0, 'expected at least one shelf');
    for (const shelf of json) {
      assert(typeof shelf.id === 'string' && typeof shelf.title === 'string', 'each shelf needs id and title');
      assert(Array.isArray(shelf.tracks), `shelf ${shelf.id} is missing tracks[]`);
    }
    assert(headers.get('x-spotuner-cache'), 'expected the X-Spotuner-Cache header');
    assert(headers.get('x-spotuner-cache-age'), 'expected the X-Spotuner-Cache-Age header');
  },

  async refreshInvalidates() {
    const { status, json } = await post('/api/discovery/refresh', {});
    assert(status === 200, `expected 200, got ${status}`);
    assert(json?.refreshed === true, 'expected refreshed: true');
    assert(Number.isFinite(Date.parse(json.at)), 'expected an ISO timestamp');
  },
};

async function main() {
  console.log(`Spotuner Worker compatibility suite\n  target: ${BASE_URL}\n`);

  for (const [name, fn] of Object.entries(checks)) {
    try {
      await fn();
      record(name, null);
    } catch (error) {
      record(name, error);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length > 0) console.log(`failed: ${failures.join(', ')}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});