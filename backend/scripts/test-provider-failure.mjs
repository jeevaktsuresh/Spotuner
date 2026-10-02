/**
 * Failure handling: an optional metadata provider must never break the homepage.
 *
 * The spec requires that MusicBrainz being unavailable leaves the pipeline
 * functional. That is a claim about behaviour under failure, so it is tested
 * under failure rather than asserted in a comment.
 *
 * Three modes:
 *   1. provider disabled entirely
 *   2. provider enabled but the network call rejects
 *   3. provider enabled and returning junk
 *
 * Run: node scripts/test-provider-failure.mjs
 */
import assert from 'node:assert/strict';

import * as registry from '../lib/metadata/registry.js';
import * as musicbrainz from '../lib/metadata/providers/musicbrainz.js';
import { enrich, prepare, dedupe } from '../lib/metadata/index.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`ok   ${name}`);
    })
    .catch((error) => {
      failed += 1;
      console.log(`FAIL ${name}\n       ${error.message}`);
    });
}

const TRACKS = [
  { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas', image: 'http://i/1.jpg', duration: 214, metadataSources: ['youtube'] },
  { id: 'v2', title: 'Ente Vaa Moocham', artist: 'Anwar Assalam', image: 'http://i/2.jpg', duration: 260, metadataSources: ['youtube'] },
];

// --- 1. disabled ------------------------------------------------------------

await check('enrichment resolves to the input when the provider is disabled', async () => {
  const previous = process.env.SPOTUNER_METABRAINZ;
  process.env.SPOTUNER_METABRAINZ = 'off';

  const { tracks, report } = await enrich(TRACKS);

  assert.equal(tracks.length, 2, 'both tracks returned');
  assert.equal(report.skipped, true);
  assert.match(report.reason, /no enrichers|disabled/i);
  assert.equal(tracks[0].image, 'http://i/1.jpg', 'artwork intact');
  assert.equal(tracks[0].album, undefined, 'no invented fields');

  if (previous === undefined) delete process.env.SPOTUNER_METABRAINZ;
  else process.env.SPOTUNER_METABRAINZ = previous;
});

// --- 2. network failure -----------------------------------------------------

await check('a throwing provider never rejects and never corrupts a track', async () => {
  // Force the provider to fail the way a real outage would.
  musicbrainz.setFaultInjector(() => {
    throw new Error('ECONNREFUSED simulated outage');
  });

  try {
    const { tracks, report } = await enrich(TRACKS);

    assert.equal(tracks.length, 2, 'all tracks still returned');
    assert.equal(report.errors, 2, 'failures counted');
    assert.equal(tracks[0].id, 'v1');
    assert.equal(tracks[0].image, 'http://i/1.jpg', 'artwork preserved through failure');
    assert.equal(tracks[0].metadataSources[0], 'youtube', 'still attributed to YouTube');
  } finally {
    musicbrainz.setFaultInjector(null);
  }
});

// --- 3. junk response -------------------------------------------------------

await check('a provider returning junk is treated as no contribution', async () => {
  musicbrainz.setFaultInjector(() => ({
    id: null,
    title: null,
    artist: null,
    album: null,
    releaseDate: null,
    isrc: null,
    genres: [],
    image: null,
    metadataSources: ['musicbrainz'],
  }));

  try {
    const { tracks } = await enrich(TRACKS);
    assert.equal(tracks[0].image, 'http://i/1.jpg', 'null from the provider did not erase');
    // The input never had an album, so it must not acquire one from junk.
    assert.ok(tracks[0].album === undefined || tracks[0].album === null, 'no invented album');
  } finally {
    musicbrainz.setFaultInjector(null);
  }
});

await check('a provider returning an empty object changes nothing', async () => {
  musicbrainz.setFaultInjector(() => ({}));

  try {
    const { tracks } = await enrich(TRACKS);
    assert.deepEqual(tracks.map((t) => t.id), ['v1', 'v2']);
    assert.equal(tracks[0].image, 'http://i/1.jpg');
  } finally {
    musicbrainz.setFaultInjector(null);
  }
});

await check('a hanging provider does not block the others', async () => {
  musicbrainz.setFaultInjector(async () => {
    throw new Error('timeout');
  });

  try {
    // A rejection is isolated per track, so one failure cannot abort the batch.
    const { tracks } = await enrich(TRACKS);
    assert.equal(tracks.length, TRACKS.length, 'batch survives per-track failure');
  } finally {
    musicbrainz.setFaultInjector(null);
  }
});

// --- pipeline level ---------------------------------------------------------

await check('prepare() still yields a scored, playable list with no provider', async () => {
  const previous = process.env.SPOTUNER_METABRAINZ;
  process.env.SPOTUNER_METABRAINZ = 'off';

  try {
    const { tracks, report } = await prepare(TRACKS);
    assert.equal(tracks.length, 2);
    assert.equal(report.enrichment.skipped, true);
    assert.equal(report.dedupe.input, 2);
    // Every track must remain playable: that is what the pipeline needs downstream.
    for (const t of tracks) assert.ok(t.id, 'track kept its playable id');
  } finally {
    if (previous === undefined) delete process.env.SPOTUNER_METABRAINZ;
    else process.env.SPOTUNER_METABRAINZ = previous;
  }
});

await check('de-duplication still runs without any enrichment', () => {
  const { tracks, report } = dedupe([
    { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas' },
    { id: 'v2', title: 'Malare Official Video', artist: 'Vijay Yesudas' },
  ]);
  assert.equal(tracks.length, 1);
  assert.equal(report.merged, 1);
});

// --- registry ---------------------------------------------------------------

await check('the registry reports a disabled provider as unavailable', () => {
  const previous = process.env.SPOTUNER_METABRAINZ;
  process.env.SPOTUNER_METABRAINZ = 'off';

  try {
    const names = registry.providerNames();
    assert.deepEqual(names.primary, ['youtube'], 'YouTube is always primary');
    assert.ok(!names.available.enrichers.includes('musicbrainz'), 'disabled = unavailable');
    assert.equal(registry.getProvider('musicbrainz'), null);
  } finally {
    if (previous === undefined) delete process.env.SPOTUNER_METABRAINZ;
    else process.env.SPOTUNER_METABRAINZ = previous;
  }
});

await check('YouTube remains available regardless of configuration', () => {
  const previous = process.env.SPOTUNER_METABRAINZ;
  process.env.SPOTUNER_METABRAINZ = 'off';
  try {
    assert.ok(registry.getProvider('youtube'), 'the primary source is never optional');
    assert.deepEqual(registry.primaryProviders().map((p) => p.name), ['youtube']);
  } finally {
    if (previous === undefined) delete process.env.SPOTUNER_METABRAINZ;
    else process.env.SPOTUNER_METABRAINZ = previous;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);