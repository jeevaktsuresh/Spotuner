import { Hono } from 'hono';

import * as youtube from '../../lib/youtube.js';
import * as manager from '../../lib/metadata/manager.js';
import * as spotify from '../../lib/metadata/providers/spotify.js';
import * as streamCache from '../../lib/runtime/stream-cache.js';

/**
 * Playback resolution.
 *
 * This is the provider-aware playback seam: given a track from any source, it
 * returns where the audio will actually come from. A Spotify track normally
 * resolves to a matched YouTube upload, because the Spotify Web API serves no
 * audio. The response says which provider won and why, so the UI can show it
 * rather than guess.
 *
 * Stream URLs are cached, but never permanently: a googlevideo URL carries its own
 * expiry, so `stream-cache` caps every entry by that expiry as well as by TTL, and
 * a stale or expired entry is simply re-resolved.
 */
const app = new Hono();

app.get('/play/:source/:id', async (c) => {
  try {
    const { source, id } = c.req.param() as { source: string; id: string };
    const preferred = String(c.req.query('source') ?? 'auto');

    let track = await manager.getTrack(source, id);
    if (!track && source === 'spotify') {
      // Spotify ids are not resolvable without a token; a cached library record
      // can still supply the metadata, so search is the fallback.
      const results = await manager.searchProvider('spotify', id, { limit: 1 });
      track = results[0] ?? null;
    }

    if (!track) {
      return c.json({ error: 'Track not found' }, 404);
    }

    const selection = await manager.selectPlaybackProvider(track, { preferred });

    if (!selection.provider || !selection.track) {
      return c.json(
        {
          error: 'No playable source for this track',
          reason: selection.reason,
        },
        404,
      );
    }

    // A cached URL is only used if it is still within its own lifetime; the cache
    // layer drops anything past it, so a dead URL is re-resolved rather than served.
    const streamUrl =
      (await streamCache.get(selection.provider, selection.track.id)) ??
      (await youtube.resolveStream(selection.track.id));

    if (!streamUrl) {
      return c.json({ error: 'Stream URL not found' }, 404);
    }

    await streamCache.set(selection.provider, selection.track.id, streamUrl);

    return c.json({
      streamUrl,
      source: selection.provider,
      reason: selection.reason,
      track: {
        ...selection.track,
        playbackProvider: selection.provider,
        playable: true,
      },
    });
  } catch (error: any) {
    console.error('Playback resolution error:', spotify.redact(error?.message));
    return c.json({ error: 'Playback resolution failed' }, 500);
  }
});

app.get('/stream/youtube/:videoId', async (c) => {
  try {
    const { videoId } = c.req.param() as { videoId: string };

    const cached = await streamCache.get('youtube', videoId);
    if (cached) {
      return c.json({ streamUrl: cached });
    }

    const streamUrl = await youtube.resolveStream(videoId);

    if (!streamUrl) {
      return c.json({ error: 'Stream URL not found' }, 404);
    }

    await streamCache.set('youtube', videoId, streamUrl);

    return c.json({ streamUrl });
  } catch (error: any) {
    console.error('YouTube stream error:', error?.message);
    return c.json({ error: error?.message ?? 'Stream resolution failed' }, 500);
  }
});

/**
 * Audio proxy.
 *
 * `/stream/youtube/:videoId` above answers *where* the audio lives. That is enough
 * for curl and not enough for a browser: it hands the client a signed
 * `googlevideo.com` URL, which is cross-origin, tied to the IP that resolved it, and
 * a well-known target for content blockers. Any of those turns into a media request
 * that transfers zero bytes while the API call above still returns a clean 200 —
 * which is exactly the failure this endpoint removes.
 *
 * So the browser is pointed here instead. The Worker resolves the URL, fetches the
 * bytes, and streams them straight through. Nothing is buffered: the upstream body
 * is handed to the response as-is, so memory use does not scale with track length.
 *
 * The googlevideo URL never reaches the client and is never logged. A signature is a
 * bearer credential for the media, and `wrangler tail` output is not private, so
 * logs carry the video id and status only.
 */

/** Only YouTube's own media CDN may be proxied, so this can never become a relay. */
function isGoogleVideoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'googlevideo.com' || host.endsWith('.googlevideo.com');
  } catch {
    return false;
  }
}

/**
 * Upstream statuses that mean "this URL is finished", not "this video is unavailable".
 *
 * A cached URL can die before its TTL — the cache caps entries by the URL's own
 * `expire`, but a link can also be revoked early. Answering 404 to the player here
 * would be a lie: the track is fine, the link was stale, so the entry is dropped and
 * one fresh resolution is attempted before giving up.
 */
const STALE_URL_STATUSES = new Set([403, 404, 410]);

/** Resolve a fresh URL for a video, bypassing the cache. */
async function resolveFresh(videoId: string): Promise<string> {
  let url: string | null = null;
  try {
    url = await youtube.resolveStream(videoId);
  } catch (error: any) {
    // The video itself is the problem — deleted, private, region-blocked — rather
    // than the proxy. Tagged so the handler can answer 404 instead of 500.
    const unavailable = new Error(error?.message ?? 'Stream resolution failed');
    (unavailable as any).code = 'UNAVAILABLE';
    throw unavailable;
  }
  if (!url) {
    const unavailable = new Error('Stream URL not found');
    (unavailable as any).code = 'UNAVAILABLE';
    throw unavailable;
  }
  await streamCache.set('youtube', videoId, url);
  return url;
}

/**
 * googlevideo imposes two limits on a signed media URL fetched from a datacenter IP,
 * both measured rather than assumed:
 *
 *   window size   `bytes=0-1048575` is answered 206, `bytes=0-2097151` is 403
 *   absolute offset  `bytes=1000000-1001023` is 206, `bytes=3000000-3001023` is 403
 *
 * An open-ended `bytes=0-` — which is exactly what a browser sends to start playback —
 * violates the first limit and is always refused. Forwarding it verbatim is what
 * turned "no audio" into a 502, so the window is clamped to something the CDN will
 * serve and the browser asks for the next window as it buffers.
 *
 * The offset ceiling is the harder constraint and cannot be worked around from here:
 * past roughly the first 1-2 MB the CDN refuses regardless of how fresh the URL is, so
 * seeking deep into a long track is not available through this route.
 */
const MAX_RANGE_WINDOW = 1024 * 1024;

/**
 * Clamp a client `Range` header to a window googlevideo will serve.
 *
 * Returns the header to forward upstream, or null when the client sent no range.
 * Only the single byte-range form is handled, which is all a media element sends;
 * anything else passes through untouched rather than being guessed at.
 */
function clampRange(rangeHeader: string | undefined): string | null {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return rangeHeader;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return rangeHeader;

  const start = rawStart === '' ? 0 : Number(rawStart);
  if (!Number.isFinite(start)) return rangeHeader;

  // An open-ended range has an infinite end, which is precisely the case that needs
  // clamping — so this must test for NaN, not for finiteness.
  const requestedEnd = rawEnd === '' ? Number.POSITIVE_INFINITY : Number(rawEnd);
  if (Number.isNaN(requestedEnd) || requestedEnd < start) return rangeHeader;

  return `bytes=${start}-${Math.min(requestedEnd, start + MAX_RANGE_WINDOW - 1)}`;
}

/**
 * Forward the client's `Range` header, clamped to a window the CDN will serve.
 *
 * A refused URL is spent rather than broken, so `fetchMedia` resolves a new one and
 * retries once. The short pause matters: the CDN throttles a URL that is reused
 * quickly, and a burst of range requests would otherwise spend the replacement too.
 */
async function fetchMedia(videoId: string, range: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    // googlevideo rejects requests that do not look like a media client, and it
    // serves 403 rather than 400 when it decides a request is not one.
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  };
  // The browser asks for a byte range so it can seek. Forwarding it is what makes
  // 206 work, and seeking is impossible without it.
  if (range) headers.Range = range;

  const attempt = async (url: string) => {
    if (!isGoogleVideoUrl(url)) throw new Error('Refusing to proxy a non-googlevideo URL');
    return fetch(url, { headers });
  };

  const cached = await streamCache.get('youtube', videoId);
  const first = await attempt(cached ?? (await resolveFresh(videoId)));

  if (!STALE_URL_STATUSES.has(first.status)) return first;

  console.warn(`[audio] cached url rejected upstream (${first.status}) for ${videoId}; re-resolving`);

  await streamCache.invalidate('youtube', videoId);
  await new Promise((resolve) => setTimeout(resolve, 250));
  return attempt(await resolveFresh(videoId));
}

app.on(['GET', 'HEAD'], '/audio/youtube/:videoId', async (c) => {
  const { videoId } = c.req.param() as { videoId: string };

  if (!videoId) {
    return c.json({ error: 'videoId is required' }, 400);
  }

  try {
    const range = clampRange(c.req.header('range'));
    const response = await fetchMedia(videoId, range);

    if (!response.ok && response.status !== 206) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : response.status;
      console.warn(`[audio] upstream ${response.status} for ${videoId}`);
      return c.json({ error: 'Upstream media unavailable' }, status as 400);
    }

    // Pass through only what describes the payload. Hop-by-hop and CORS headers are
    // dropped: CORS is this API's own, applied by the middleware above.
    const headers = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);
    for (const name of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Advertised unconditionally: the player uses it to decide whether seeking is
    // possible, and googlevideo does support ranges.
    if (!headers.has('accept-ranges')) headers.set('Accept-Ranges', 'bytes');
    // Short, because the underlying signed URL is disposable and a stale one must
    // not be reused from a browser cache.
    headers.set('Cache-Control', 'private, max-age=300');

    if (c.req.method === 'HEAD') {
      return new Response(null, { status: response.status, headers });
    }

    // 206 when upstream honoured the range, 200 otherwise. The body is the upstream
    // stream, not a buffered copy.
    return new Response(response.body, { status: response.status, headers });
  } catch (error: any) {
    if (error?.code === 'UNAVAILABLE') {
      return c.json({ error: 'Stream not available' }, 404);
    }
    console.error('Audio proxy error:', error?.message);
    return c.json({ error: 'Audio proxy failed' }, 500);
  }
});

export default app;