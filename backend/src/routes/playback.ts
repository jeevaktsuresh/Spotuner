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

export default app;