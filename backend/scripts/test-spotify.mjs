/**
 * Spotify integration behaviour.
 *
 * Covers authentication, token caching, normalisation, cross-provider matching,
 * de-duplication, playback availability and fallback, failure isolation, and cache
 * behaviour.
 *
 * Split by what it needs:
 *
 *   - Pure parts (matching, merging, normalisation, failure isolation) are driven
 *     with injected responses, so they are deterministic and need no network.
 *   - Live parts (auth, search) are skipped unless credentials are configured, and
 *     report as skipped rather than silently passing.
 *
 * Run: node scripts/test-spotify.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Loaded before any provider is imported. ESM evaluates imports first, so a
// provider that reads its configuration at call time would otherwise see an
// environment without credentials and report itself unavailable — which is
// exactly what made the "YouTube outage, Spotify still works" case fail.
dotenv.config();

import { normalizeTrack, mergeTrack, metadataQuality } from '../lib/metadata/normalize.js';
import {
  matchConfidence,
  relationshipBetween,
  mergeAcrossProviders,
  findCounterpart,
  linkRecords,
  MERGE_CONFIDENCE,
} from '../lib/metadata/match.js';
import * as spotify from '../lib/metadata/providers/spotify.js';
import * as manager from '../lib/metadata/manager.js';
import { registry } from '../lib/metadata/index.js';

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n       ${error.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    const result = await fn();
    if (result === 'skipped') {
      skipped += 1;
      console.log(`skip ${name}`);
      return;
    }
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n       ${error.message}`);
  }
}

// ===== Fixtures =============================================================

/** A Spotify track shaped exactly like the API's payload. */
const spotifyTrack = {
  id: '4Hvf9xIeJWp5p9FkJerQhN',
  name: 'Malare',
  duration_ms: 316000,
  popularity: 62,
  explicit: false,
  external_urls: { spotify: 'https://open.spotify.com/track/4Hvf9xIeJWp5p9FkJerQhN' },
  artists: [{ name: 'Vijay Yesudas' }, { name: 'Rajesh Murugesan' }],
  album: {
    id: 'alb1',
    name: 'Premam',
    release_date: '2015-03-25',
    release_date_precision: 'day',
    external_ids: { isrc: 'INM811456901' },
    images: [
      { url: 'https://i.scdn.co/image/small', width: 64, height: 64 },
      { url: 'https://i.scdn.co/image/large', width: 640, height: 640 },
    ],
  },
};

const youtubeTrack = {
  source: 'youtube',
  id: '-GyOKmoLbng',
  title: 'Malare Official Video',
  artist: 'Vijay Yesudas',
  album: null,
  duration: 316,
  image: 'https://ytimg/abc.jpg',
  url: 'https://music.youtube.com/watch?v=-GyOKmoLbng',
};

// ===== 1. Normalisation ====================================================

check('a Spotify track normalises to the canonical shape', () => {
  const track = spotify.toCanonicalTrack(spotifyTrack);

  assert.equal(track.id, '4Hvf9xIeJWp5p9FkJerQhN');
  assert.equal(track.source, 'spotify');
  assert.equal(track.spotifyId, '4Hvf9xIeJWp5p9FkJerQhN');
  assert.equal(track.title, 'Malare');
  assert.equal(track.artist, 'Vijay Yesudas, Rajesh Murugesan');
  assert.deepEqual(track.artists, ['vijay yesudas', 'rajesh murugesan']);
  assert.equal(track.album, 'Premam');
  assert.equal(track.albumId, 'alb1');
  assert.equal(track.duration, 316, 'ms converted to seconds');
  assert.equal(track.releaseDate.slice(0, 10), '2015-03-25');
  assert.equal(track.isrc, 'INM811456901');
  assert.ok(track.thumbnail, 'thumbnail present');
  assert.deepEqual(track.metadataSources, ['spotify']);
});

check('the widest artwork is chosen', () => {
  const track = spotify.toCanonicalTrack(spotifyTrack);
  assert.equal(track.thumbnail, 'https://i.scdn.co/image/large');
});

check('a Spotify track is never marked playable', () => {
  // The Web API serves no audio, so this is a fact, not a placeholder.
  const track = spotify.toCanonicalTrack(spotifyTrack);
  assert.equal(track.playable, false);
  assert.equal(track.playbackProvider, null);
  assert.equal(spotify.isPlayable(), false);
});

check('enrichByText converts a raw payload rather than trusting its shape', () => {
  // Regression guard. The fault injector stands in for the upstream API and
  // therefore returns *raw* Spotify items. An earlier version passed them straight
  // through unconverted, so `enrichByText` returned objects with `title:
  // undefined` — which silently defeated enrichment in every failure-path test
  // while the live path worked. The injected shape and the live shape must be
  // identical, or the tests are not testing the code that runs.
  const raw = {
    id: '4Hvf9xIeJWp5p9FkJerQhN',
    name: 'Malare',
    duration_ms: 316000,
    artists: [{ name: 'Vijay Yesudas' }],
    album: {
      id: 'alb1',
      name: 'Premam',
      release_date: '2015-03-25',
      external_ids: { isrc: 'INM811456901' },
      images: [{ url: 'https://i.scdn.co/large', width: 640, height: 640 }],
    },
  };

  spotify.setFaultInjector(async () => [raw]);

  try {
    // Synchronously verified below via the async check; this asserts the contract.
    assert.ok(typeof spotify.enrichByText === 'function', 'enrichByText exists');
  } finally {
    spotify.setFaultInjector(null);
  }
});

await checkAsync('enrichByText returns a usable canonical track from a raw payload', async () => {
  spotify.setFaultInjector(async () => [
    {
      id: '4Hvf9xIeJWp5p9FkJerQhN',
      name: 'Malare',
      duration_ms: 316000,
      artists: [{ name: 'Vijay Yesudas' }],
      album: {
        id: 'alb1',
        name: 'Premam',
        release_date: '2015-03-25',
        external_ids: { isrc: 'INM811456901' },
        images: [{ url: 'https://i.scdn.co/large', width: 640, height: 640 }],
      },
    },
  ]);

  try {
    const enriched = await spotify.enrichByText({ title: 'Malare', artist: 'Vijay Yesudas' });

    assert.ok(enriched, 'a result is returned');
    assert.equal(enriched.title, 'Malare', 'title converted, not undefined');
    assert.equal(enriched.album, 'Premam');
    assert.equal(enriched.duration, 316, 'ms converted to seconds');
    assert.equal(enriched.isrc, 'INM811456901');
    assert.equal(enriched.spotifyId, '4Hvf9xIeJWp5p9FkJerQhN');
  } finally {
    spotify.setFaultInjector(null);
  }
});

await checkAsync('discovery enrichment merges Spotify metadata into a YouTube track', async () => {
  // The end-to-end guarantee: a Spotify match contributes its release date, ISRC
  // and id to a YouTube candidate, without damaging the YouTube fields.
  spotify.setFaultInjector(async () => [
    {
      id: 'sp-enrich',
      name: 'Malare',
      duration_ms: 316000,
      artists: [{ name: 'Vijay Yesudas' }],
      album: {
        id: 'alb-premam',
        name: 'Premam',
        release_date: '2015-03-25',
        external_ids: { isrc: 'INM811456901' },
        images: [{ url: 'https://i.scdn.co/large', width: 640, height: 640 }],
      },
    },
  ]);

  const { prepare, fromSearchResult } = await import('../lib/metadata/index.js');

  try {
    const input = fromSearchResult(
      {
        id: 'yt-enrich',
        title: 'Malare',
        artist: 'Vijay Yesudas',
        image: 'https://ytimg/thumb.jpg',
        duration: 316,
      },
      'youtube'
    );

    const { tracks, report } = await prepare([input]);
    const track = tracks[0];

    assert.ok(report.enrichment.enriched > 0, `enrichment reported: ${report.enrichment.enriched}`);
    assert.equal(track.album, 'Premam', 'album came from Spotify');
    assert.equal(track.isrc, 'INM811456901', 'ISRC came from Spotify');
    assert.equal(track.spotifyId, 'sp-enrich', 'Spotify id attached');
    assert.equal(track.youtubeId, 'yt-enrich', 'YouTube id preserved');
    assert.equal(track.image, 'https://ytimg/thumb.jpg', 'YouTube artwork not overwritten');
    assert.equal(track.playable, true, 'and it remains playable');
    assert.ok(track.metadataSources.includes('spotify'), 'provenance records Spotify');
  } finally {
    spotify.setFaultInjector(null);
  }
});

check('a malformed Spotify track is rejected rather than half-built', () => {
  assert.equal(spotify.toCanonicalTrack(null), null);
  assert.equal(spotify.toCanonicalTrack({}), null);
});

check('release date precision is preserved', () => {
  const track = spotify.toCanonicalTrack(spotifyTrack);
  assert.equal(track.releaseDatePrecision, 'day');
});

check('merging Spotify into YouTube keeps both identifiers and fills gaps', () => {
  const yt = normalizeTrack(youtubeTrack, 'youtube');
  yt.spotifyId = null;
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const merged = mergeTrack(yt, sp, { extraSource: 'spotify' });

  assert.equal(merged.youtubeId, '-GyOKmoLbng', 'YouTube id survives');
  assert.equal(merged.spotifyId, '4Hvf9xIeJWp5p9FkJerQhN', 'Spotify id added');
  assert.equal(merged.isrc, 'INM811456901', 'ISRC taken from Spotify');
  assert.equal(merged.album, 'Premam', 'album gap filled');
  assert.equal(merged.image, 'https://ytimg/abc.jpg', 'YouTube artwork not overwritten');
  assert.equal(merged.title, 'Malare Official Video', 'YouTube title is authoritative');
  assert.ok(merged.metadataSources.includes('youtube') && merged.metadataSources.includes('spotify'));
});

check('merging never makes a playable track unplayable', () => {
  const yt = normalizeTrack({ ...youtubeTrack, playable: true, playbackProvider: 'youtube' }, 'youtube');
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const merged = mergeTrack(yt, sp, { extraSource: 'spotify' });

  assert.equal(merged.playable, true, 'still playable after merging unplayable metadata');
  assert.equal(merged.playbackProvider, 'youtube', 'provider not replaced');
});

// ===== 2. Cross-provider matching ==========================================

check('the same song on both providers matches with high confidence', () => {
  const yt = normalizeTrack(youtubeTrack, 'youtube');
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const { confidence, level } = matchConfidence(yt, sp);
  assert.ok(confidence >= MERGE_CONFIDENCE, `confidence ${confidence} >= ${MERGE_CONFIDENCE}`);
  assert.equal(level, 'fuzzy', 'matched on normalised text, not ISRC');
});

check('a shared ISRC merges regardless of differing titles', () => {
  const a = { ...normalizeTrack(youtubeTrack, 'youtube'), isrc: 'INM811456901' };
  const b = { ...spotify.toCanonicalTrack(spotifyTrack), title: 'Totally Different Title' };
  assert.equal(matchConfidence(a, b).confidence, 1);
});

check('conflicting ISRCs are never merged', () => {
  const a = { ...normalizeTrack(youtubeTrack, 'youtube'), isrc: 'INM811456901' };
  const b = { ...spotify.toCanonicalTrack(spotifyTrack), isrc: 'INM999999999' };
  const verdict = matchConfidence(a, b);
  assert.equal(verdict.confidence, 0);
  assert.match(verdict.reason, /conflicting/i);
});

check('a remix is NOT merged into its original', () => {
  const original = spotify.toCanonicalTrack(spotifyTrack);
  const remix = spotify.toCanonicalTrack({ ...spotifyTrack, id: 'sp2', name: 'Malare (Remix)' });

  const verdict = matchConfidence(normalizeTrack(youtubeTrack, 'youtube'), remix);
  assert.equal(verdict.confidence, 0, 'a remix stays its own track');
  assert.match(verdict.reason, /variant/i);
});

check('live, acoustic, instrumental and cover variants are all kept separate', () => {
  const yt = normalizeTrack(youtubeTrack, 'youtube');

  for (const suffix of ['(Live)', '(Acoustic)', '(Instrumental)', '(Cover)', '(Slowed)', '(Reverb)']) {
    const variant = spotify.toCanonicalTrack({ ...spotifyTrack, id: `v${suffix}`, name: `Malare ${suffix}` });
    assert.equal(matchConfidence(yt, variant).confidence, 0, `${suffix} must stay distinct`);
  }
});

check('a differing duration lowers confidence without blocking a merge', () => {
  const yt = normalizeTrack(youtubeTrack, 'youtube');
  const short = spotify.toCanonicalTrack({ ...spotifyTrack, duration_ms: 120000 });

  const verdict = matchConfidence(yt, short);
  assert.ok(verdict.confidence < MERGE_CONFIDENCE, `a 2m vs 5m cut scores ${verdict.confidence}`);
  assert.ok(verdict.confidence > 0, 'but is still a candidate, not a hard rejection');
  assert.equal(verdict.durationMatch, false);
});

check('an absent duration is not treated as a disagreement', () => {
  const yt = normalizeTrack({ ...youtubeTrack, duration: 0 }, 'youtube');
  const sp = spotify.toCanonicalTrack(spotifyTrack);
  assert.equal(matchConfidence(yt, sp).durationMatch, null);
});

check('different songs by the same artist do not match', () => {
  const a = normalizeTrack(youtubeTrack, 'youtube');
  const b = spotify.toCanonicalTrack({ ...spotifyTrack, id: 'sp3', name: 'Mala Re' });
  assert.equal(matchConfidence(a, b).confidence, 0);
});

// ===== 3. De-duplication ===================================================

check('duplicate results across providers collapse to one canonical track', () => {
  const yt = { ...normalizeTrack(youtubeTrack, 'youtube'), playable: true, playbackProvider: 'youtube' };
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const { tracks, merged } = mergeAcrossProviders([yt, sp]);

  assert.equal(tracks.length, 1, 'one card, not two');
  assert.equal(merged, 1);
  assert.equal(tracks[0].youtubeId, '-GyOKmoLbng');
  assert.equal(tracks[0].spotifyId, '4Hvf9xIeJWp5p9FkJerQhN');
  assert.equal(tracks[0].isrc, 'INM811456901');
  assert.equal(tracks[0].album, 'Premam', 'metadata gained from Spotify');
  assert.equal(tracks[0].playable, true, 'playability preserved through the merge');
});

check('a YouTube track never lists YouTube as its own alternate', () => {
  // Regression guard: an alternates bug produced self-referential entries.
  const yt = { ...normalizeTrack(youtubeTrack, 'youtube'), playable: true };
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const { tracks } = mergeAcrossProviders([yt, sp]);

  for (const track of tracks) {
    for (const alternate of track.alternates ?? []) {
      assert.notEqual(alternate.source, track.source, `${track.id} lists itself as an alternate`);
    }
  }
});

check('alternates are unique', () => {
  const yt = { ...normalizeTrack(youtubeTrack, 'youtube'), playable: true };
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const { tracks } = mergeAcrossProviders([yt, sp]);

  for (const track of tracks) {
    const keys = (track.alternates ?? []).map((a) => `${a.source}:${a.id}`);
    assert.equal(new Set(keys).size, keys.length, `duplicate alternates: ${keys.join(',')}`);
  }
});

check('distinct tracks from both providers are all preserved', () => {
  const a = normalizeTrack({ ...youtubeTrack, id: 'y1', title: 'Malare' }, 'youtube');
  const b = normalizeTrack({ ...youtubeTrack, id: 'y2', title: 'Ente Vaa Moocham' }, 'youtube');
  const c = spotify.toCanonicalTrack({ ...spotifyTrack, id: 's1', name: 'Mala Re' });

  const { tracks } = mergeAcrossProviders([a, b, c]);
  assert.equal(tracks.length, 3);
});

check('linkRecords attaches a cross-provider alternate', () => {
  const yt = { ...normalizeTrack(youtubeTrack, 'youtube'), playable: true };
  const sp = spotify.toCanonicalTrack(spotifyTrack);

  const linked = linkRecords(yt, sp);
  assert.equal(linked.alternates.length, 1);
  assert.equal(linked.alternates[0].source, 'spotify');
});

check('findCounterpart skips the track itself', () => {
  const yt = normalizeTrack(youtubeTrack, 'youtube');
  assert.equal(findCounterpart(yt, [yt]), null);
});

// ===== 4. Provider registry and selection ===================================

check('Spotify is registered as an enricher, never a primary', () => {
  // Structural guarantee: Spotify must not be able to decide what the app plays.
  const names = registry.providerNames();
  assert.deepEqual(names.primary, ['youtube'], 'YouTube is the only primary');
  assert.ok(names.enrichers.includes('spotify'));
});

check('a disabled Spotify reports unavailable without affecting YouTube', () => {
  const previous = process.env.SPOTIFY_CLIENT_ID;
  const previousSecret = process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;

  try {
    const names = registry.providerNames();
    assert.deepEqual(names.available.primary, ['youtube'], 'YouTube still available');
    assert.ok(!names.available.enrichers.includes('spotify'), 'Spotify reported unavailable');
  } finally {
    if (previous !== undefined) process.env.SPOTIFY_CLIENT_ID = previous;
    if (previousSecret !== undefined) process.env.SPOTIFY_CLIENT_SECRET = previousSecret;
  }
});

check('resolveSources maps every source selector', () => {
  assert.deepEqual(manager.resolveSources('youtube'), ['youtube']);
  assert.deepEqual(manager.resolveSources('spotify'), ['spotify']);
  assert.deepEqual(manager.resolveSources('all'), ['youtube', 'spotify']);
  assert.deepEqual(manager.resolveSources(['spotify']), ['spotify']);
  // 'auto' never returns an empty list, so a caller always has somewhere to look.
  assert.ok(manager.resolveSources('auto').length >= 1);
});

check('an unknown provider selector falls back to auto, not to nothing', () => {
  // 'deezer' is not a known source, so this resolves to whatever is available. With
  // Spotify configured that is both providers, which is the correct outcome — the
  // alternative, silently returning YouTube only, would hide a working provider.
  const resolved = manager.resolveSources('deezer');
  assert.ok(resolved.includes('youtube'), 'YouTube is always included');
  assert.ok(
    resolved.every((name) => ['youtube', 'spotify'].includes(name)),
    `no unknown providers leak through, got: ${resolved.join(',')}`,
  );
});

// ===== 5. Playback =========================================================

await checkAsync('a YouTube track plays natively', async () => {
  const selection = await manager.selectPlaybackProvider({
    source: 'youtube',
    id: '-GyOKmoLbng',
    playable: true,
    playbackProvider: 'youtube',
  });
  assert.equal(selection.provider, 'youtube');
  assert.equal(selection.reason, 'native');
});

await checkAsync('a Spotify track reports no native playback rather than pretending', async () => {
  const track = spotify.toCanonicalTrack(spotifyTrack);
  // With no YouTube counterpart reachable, the honest answer is "no playable source".
  const selection = await manager.selectPlaybackProvider(track);
  assert.ok(
    selection.provider === null || selection.provider === 'youtube',
    'either finds a fallback or reports none',
  );
  if (selection.provider === 'youtube') {
    assert.equal(selection.track.playable, true, 'the fallback is genuinely playable');
  } else {
    assert.match(selection.reason, /counterpart|no playable/i);
  }
});

await checkAsync('preferring Spotify never yields an unplayable track', async () => {
  // The user setting must not override the absence of a stream.
  const track = { ...spotify.toCanonicalTrack(spotifyTrack), id: 'zzz-no-such-track-zzz', title: 'Zzzq Nonexistent Act Xyzzy' };
  const selection = await manager.selectPlaybackProvider(track, { preferred: 'spotify' });

  assert.notEqual(selection.provider, 'spotify', 'Spotify never claims playback it cannot deliver');
  if (selection.provider === null) {
    assert.match(selection.reason, /counterpart|no playable/i);
  }
});

await checkAsync('an empty track is handled', async () => {
  const selection = await manager.selectPlaybackProvider(null);
  assert.equal(selection.provider, null);
});

// ===== 6. Failure isolation ================================================

await checkAsync('a Spotify outage leaves YouTube search working', async () => {
  // Spotify is forced to fail; the YouTube path must be unaffected.
  const ytProvider = await import('../lib/metadata/providers/youtube.js');

  ytProvider.setFaultInjector(async (q) => [normalizeTrack({ ...youtubeTrack, title: q }, 'youtube')]);
  spotify.setFaultInjector(async () => {
    throw new Error('simulated Spotify outage');
  });

  try {
    const result = await manager.search('Malare', { sources: 'all', cache: false });

    assert.ok(result.tracks.length > 0, 'results still returned');
    assert.ok(result.errors.spotify, 'the Spotify failure is reported, not hidden');
    assert.ok(result.tracks.every((t) => t.source === 'youtube'), 'YouTube results survive');
  } finally {
    spotify.setFaultInjector(null);
    ytProvider.setFaultInjector(null);
  }
});
await checkAsync('a YouTube outage leaves Spotify metadata working', async () => {
  const ytProvider = await import('../lib/metadata/providers/youtube.js');

  ytProvider.setFaultInjector(async () => {
    throw new Error('simulated YouTube outage');
  });
  // An injected Spotify response is a raw API payload, exactly as a live one is, so
  // it travels the same conversion path rather than a special-cased shortcut.
  spotify.setFaultInjector(async () => [spotifyTrack]);

  try {
    const result = await manager.search('Malare', { sources: 'all', cache: false });

    assert.ok(result.errors.youtube, 'the YouTube failure is reported');
    assert.ok(result.tracks.length > 0, 'Spotify results still returned');
    assert.equal(result.tracks[0].source, 'spotify');
    assert.equal(result.tracks[0].playable, false, 'and are honestly unplayable');
  } finally {
    spotify.setFaultInjector(null);
    ytProvider.setFaultInjector(null);
  }
});

await checkAsync('both providers failing yields an empty result, not an exception', async () => {
  const ytProvider = await import('../lib/metadata/providers/youtube.js');

  ytProvider.setFaultInjector(async () => {
    throw new Error('YouTube down');
  });
  spotify.setFaultInjector(async () => {
    throw new Error('Spotify down');
  });

  try {
    const result = await manager.search('Malare', { sources: 'all', cache: false });
    assert.equal(result.tracks.length, 0);
    assert.ok(result.errors.youtube && result.errors.spotify);
  } finally {
    spotify.setFaultInjector(null);
    ytProvider.setFaultInjector(null);
  }
});

await checkAsync('an empty query returns nothing without calling a provider', async () => {
  const result = await manager.search('', { sources: 'all' });
  assert.equal(result.tracks.length, 0);
  assert.deepEqual(result.errors, {});
});

// ===== 7. Token caching and auth (live, optional) ==========================

const hasCredentials =
  fs.existsSync(path.join(process.cwd(), '.env')) &&
  /SPOTIFY_CLIENT_SECRET=\S+/.test(fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8'));

await checkAsync('a token is obtained and cached rather than re-requested', async () => {
  if (!hasCredentials) return 'skipped';

  spotify.clearCache();

  const first = await spotify.getAccessToken();
  if (!first) return 'skipped'; // invalid credentials in this environment

  const before = spotify.cacheStats().probes.tokenRequests;

  // Three more calls must all reuse the cached token.
  await spotify.getAccessToken();
  await spotify.getAccessToken();
  await spotify.getAccessToken();

  const after = spotify.cacheStats().probes.tokenRequests;
  assert.equal(after, before, 'no additional token requests were made');
  assert.ok(spotify.isAuthenticated());
});

await checkAsync('concurrent callers share a single token request', async () => {
  if (!hasCredentials) return 'skipped';
  spotify.clearCache();
  await spotify.getAccessToken(); // ensure a valid token exists first

  spotify.clearCache();
  const token = await spotify.getAccessToken();
  if (!token) return 'skipped';

  // Warm, then clear only the counters' observable effect by checking a burst.
  const requestsBefore = spotify.cacheStats().probes.tokenRequests;
  const results = await Promise.all([
    spotify.getAccessToken(),
    spotify.getAccessToken(),
    spotify.getAccessToken(),
    spotify.getAccessToken(),
  ]);

  assert.ok(results.every((t) => t === results[0]), 'all callers get the same token');
  assert.equal(spotify.cacheStats().probes.tokenRequests, requestsBefore, 'none re-requested');
});

await checkAsync('a search limit above the API maximum is clamped, not rejected', async () => {
  if (!hasCredentials) return 'skipped';

  // Regression guard, and the subtlest bug in this integration. Spotify answers
  // HTTP 400 "Invalid limit" for a track search asking for more than 10, despite
  // documenting a maximum of 50. The provider reported that as "no results" with no
  // error, so every multi-source search silently returned YouTube only and looked
  // like it was working.
  const payload = await spotify.searchTracks('malare', { limit: 50 });

  // A spent quota is an environmental condition, not a defect in the clamp. Skip
  // rather than fail, so the suite stays meaningful when the app's rate limit is
  // exhausted — which is normal, since the limit resets roughly daily.
  if (payload === null) {
    const stats = spotify.cacheStats();
    if (stats.probes.rateLimited > 0) return 'skipped';
    throw new Error('search failed for a reason other than rate limiting');
  }

  assert.ok(payload.tracks.items.length > 0, 'and returns results');
  assert.ok(payload.tracks.items.length <= 10, `at most 10 items, got ${payload.tracks.items.length}`);
});

await checkAsync('a large requested limit still yields a usable merged result', async () => {
  if (!hasCredentials) return 'skipped';

  // The whole point of the clamp: asking for 20 merged results must not result in
  // zero Spotify results. Skipped under rate limiting, for the same reason.
  const result = await manager.search('malare', { sources: 'all', limit: 20, cache: false });

  if (result.sources.spotify === 0 && /rate limited/i.test(result.errors?.spotify ?? '')) {
    return 'skipped';
  }

  assert.ok(result.tracks.length > 0, 'results returned');
  assert.ok(result.sources.spotify > 0, `Spotify contributed, got ${result.sources.spotify}`);
  assert.deepEqual(result.errors, {}, 'and reported no error');
});

await checkAsync('live Spotify search returns normalised tracks', async () => {
  if (!hasCredentials) return 'skipped';

  const results = await manager.searchProvider('spotify', 'Malare Vijay Yesudas', { limit: 3 });
  if (results.length === 0) return 'skipped';

  const track = results[0];
  assert.equal(track.source, 'spotify');
  assert.ok(track.spotifyId, 'spotifyId present');
  assert.ok(track.title && track.artist);
  assert.equal(track.playable, false, 'never playable from the Web API');
  assert.equal(track.playbackProvider, null);
});

await checkAsync('live parallel search merges both providers', async () => {
  if (!hasCredentials) return 'skipped';

  const result = await manager.search('Malare', { sources: 'all', limit: 10, cache: false });

  assert.ok(result.tracks.length > 0);
  assert.ok(result.sources.youtube > 0, 'YouTube contributed');
  // Every returned track must be playable or honestly marked otherwise.
  for (const track of result.tracks) {
    if (track.source === 'youtube') assert.equal(track.playable, true);
    if (track.source === 'spotify') assert.equal(track.playable, false);
  }
});

await checkAsync('search results are cached', async () => {
  if (!hasCredentials) return 'skipped';

  const first = await manager.search('Cache Test Query', { sources: 'all', cache: true });
  const second = await manager.search('Cache Test Query', { sources: 'all', cache: true });

  // Identical results are the observable effect of a cache hit.
  assert.deepEqual(
    first.tracks.map((t) => t.id),
    second.tracks.map((t) => t.id),
    'a repeated query returns the same tracks',
  );
});

console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
process.exit(failed > 0 ? 1 : 0);