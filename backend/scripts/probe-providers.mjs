/**
 * Live probe: do the metadata providers actually work?
 *
 * The unit tests prove the merge, matching and identity rules are correct against
 * hand-written provider responses. They cannot prove that a provider is reachable,
 * that its rate limit is survivable, or that it returns anything usable for the
 * catalogue this app actually serves — which is mostly Indian film music, where
 * both MusicBrainz and Spotify coverage is uneven.
 *
 * Reports real numbers, and says "not configured" or "rate limited" rather than
 * quietly reporting zero coverage and letting that read as a bug.
 *
 * Run: node scripts/probe-providers.mjs
 */
import dotenv from 'dotenv';

// Loaded before the providers are used. They read configuration at call time, but
// without this the process has no credentials at all and every provider reports
// itself unavailable — which looks identical to a real outage.
dotenv.config();

import * as registry from '../lib/metadata/registry.js';
import * as manager from '../lib/metadata/manager.js';
import * as spotify from '../lib/metadata/providers/spotify.js';
import * as youtube from '../lib/youtube.js';

console.log('=== registered providers ===');
const names = registry.providerNames();
console.log(`primary   : ${names.primary.join(', ')}`);
console.log(`enrichers : ${names.enrichers.join(', ')}`);
console.log(`available : primary=[${names.available.primary.join(', ')}] enrichers=[${names.available.enrichers.join(', ')}]`);
console.log('');

// ===== Spotify: authentication ============================================

console.log('=== spotify authentication ===');
console.log(`configured : ${spotify.isAvailable()}`);

if (spotify.isAvailable()) {
  const started = Date.now();
  const token = await spotify.getAccessToken();
  console.log(`token      : ${token ? `obtained in ${Date.now() - started}ms` : 'NULL'}`);

  const before = spotify.cacheStats().probes.tokenRequests;
  await spotify.getAccessToken();
  const after = spotify.cacheStats().probes.tokenRequests;
  console.log(`cached     : ${after === before ? 'yes (no new token request)' : 'NO — token not reused'}`);
} else {
  console.log('skipped: no SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in the environment');
}

const spotifyStats = spotify.cacheStats();
if (spotifyStats.coolingDown) {
  const mins = Math.round((spotifyStats.cooldownEndsAt - Date.now()) / 60000);
  console.log(`rate limit : cooling down for another ~${mins} min (honouring Retry-After)`);
}
console.log('');

// ===== YouTube search =====================================================

console.log('=== live YouTube search ===');

let tracks = [];
try {
  tracks = await youtube.search('malayalam latest songs', 6, { region: 'IN' });
} catch (error) {
  console.log(`YouTube search FAILED: ${error.message}`);
  process.exit(0);
}

console.log(`sampled ${tracks.length} tracks`);
console.log('');

// ===== Cross-provider merge ===============================================

console.log('=== multi-source search (concurrent, merged) ===');
try {
  const merged = await manager.search('malayalam latest songs', {
    sources: 'all',
    limit: 12,
    cache: false,
  });

  console.log(`per provider : yt=${merged.sources.youtube} spotify=${merged.sources.spotify}`);
  console.log(`duplicates merged away : ${merged.merged}`);
  console.log(`returned     : ${merged.tracks.length}`);
  console.log(`errors       : ${JSON.stringify(merged.errors)}`);

  const spotifyOnly = merged.tracks.filter((t) => t.source === 'spotify');
  console.log(`spotify-only results : ${spotifyOnly.length}`);

  // The invariant that matters: a Spotify record must never claim it can play.
  const lying = merged.tracks.filter((t) => t.source === 'spotify' && t.playable);
  console.log(
    `spotify records claiming playback : ${lying.length} ${lying.length === 0 ? '(correct)' : '— REGRESSION'}`
  );
} catch (error) {
  console.log(`multi-source search failed: ${error.message}`);
}
console.log('');

// ===== Enrichment =========================================================

console.log('=== enrichment of YouTube tracks ===');

const sample = tracks.map((t) => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  image: t.image,
  // Cleared so the report cannot mistake YouTube's own album field for something a
  // provider contributed. On several of these the album is literally the title,
  // which made an earlier version of this probe claim hits that never happened.
  album: null,
  duration: t.duration ?? 0,
  genres: [],
  metadataSources: ['youtube'],
}));

const prepared = await (await import('../lib/metadata/index.js')).prepare(sample, { enrich: true });
const report = prepared.report.enrichment;

console.log(`attempted : ${report.attempted}`);
console.log(`enriched  : ${report.enriched}`);
console.log(`misses    : ${report.misses}`);
console.log(`errors    : ${report.errors}`);
console.log(`coverage  : ${(report.coverage * 100).toFixed(0)}%  (budget ${report.budget}, unprocessed ${report.unprocessed})`);
console.log('');

for (const t of prepared.tracks) {
  const added = [];
  if (t.album) added.push(`album=${t.album}`);
  if (t.releaseDate) added.push(`released=${t.releaseDate.slice(0, 10)}`);
  if (t.isrc) added.push(`isrc=${t.isrc}`);
  if (t.musicBrainzId) added.push(`mbid=${String(t.musicBrainzId).slice(0, 8)}`);
  if (t.spotifyId) added.push(`spotify=${String(t.spotifyId).slice(0, 8)}`);

  console.log(`${added.length ? 'HIT ' : 'miss'}  ${String(t.title).slice(0, 40).padEnd(42)} ${added.join('  ') || '-'}`);

  // Enrichment must never damage a track.
  if (!t.id) console.log('      !! WARNING: lost its playable id');
  if (!t.image) console.log('      !! WARNING: lost its artwork');
}

console.log('');
console.log(`de-duplication : ${prepared.report.dedupe.input} in -> ${prepared.report.dedupe.output} out (${prepared.report.dedupe.merged} merged)`);
console.log(
  `all playable ids: ${prepared.tracks.every((t) => t.id) ? 'yes' : 'NO — REGRESSION'}`
);
console.log('');

console.log('=== provider stats ===');
console.log(JSON.stringify(registry.providerStats(), null, 2));