/**
 * Response-shape contracts.
 *
 * A backend change silently emptied the entire homepage once already: `/api/shelves`
 * was wrapped in a `{ shelves, cache }` envelope to report cache state, and every
 * consumer — which expected a bare array — rendered nothing, with no error anywhere.
 *
 * These assertions exist because a broken shape fails silently rather than loudly.
 * They check the shape, not the contents, so they stay meaningful as the underlying
 * data changes.
 *
 * Run: node scripts/test-api-shape.mjs (backend must be listening on :3001)
 */
import assert from 'node:assert/strict';

const API = 'http://localhost:3001';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n       ${error.message}`);
  }
}

await check('/api/shelves returns a bare array, not an envelope', async () => {
  const res = await fetch(`${API}/api/shelves?limit=3`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body), `expected an array, got ${typeof body}`);
  assert.ok(body.length > 0, 'and it is populated');
});

await check('every shelf has id, title and tracks', async () => {
  const body = await (await fetch(`${API}/api/shelves?limit=3`)).json();
  for (const shelf of body) {
    assert.ok(shelf.id, `shelf missing id: ${JSON.stringify(shelf).slice(0, 80)}`);
    assert.ok(typeof shelf.title === 'string' && shelf.title.length > 0, `shelf ${shelf.id} missing title`);
    assert.ok(Array.isArray(shelf.tracks), `shelf ${shelf.id} missing tracks`);
  }
});

await check('every track is playable — an id is what the player streams', async () => {
  const body = await (await fetch(`${API}/api/shelves?limit=3`)).json();
  const tracks = body.flatMap((s) => s.tracks);
  assert.ok(tracks.length > 0);

  for (const track of tracks) {
    assert.ok(track.id, `track missing id: ${JSON.stringify(track).slice(0, 100)}`);
    assert.ok(typeof track.title === 'string' && track.title.length > 0, `track ${track.id} missing title`);
    assert.ok(typeof track.artist === 'string', `track ${track.id} missing artist`);
    assert.ok(track.image, `track ${track.id} missing artwork`);
  }
});

await check('shelf cache state is reported in headers, not the body', async () => {
  const res = await fetch(`${API}/api/shelves?limit=3`);
  assert.ok(res.headers.get('x-spotuner-cache'), 'cache header present');
  // The body must remain an array — see the test above for why this matters.
  assert.ok(Array.isArray(await res.json()));
});

await check('/api/discovery/trending returns { tracks }', async () => {
  const body = await (await fetch(`${API}/api/discovery/trending?limit=4`)).json();
  assert.ok(body.tracks && Array.isArray(body.tracks), 'tracks array present');
  assert.ok(body.stats, 'stats present');
});

await check('/api/discovery/latest returns { tracks }', async () => {
  const body = await (await fetch(`${API}/api/discovery/latest?limit=4`)).json();
  assert.ok(body.tracks && Array.isArray(body.tracks), 'tracks array present');
});

await check('discovery tracks carry the canonical metadata fields', async () => {
  const body = await (await fetch(`${API}/api/discovery/trending?limit=4`)).json();
  const track = body.tracks[0];
  assert.ok(track, 'at least one track returned');
  for (const field of ['id', 'title', 'artist', 'artists', 'album', 'duration', 'url', 'source']) {
    assert.ok(field in track, `missing canonical field: ${field}`);
  }
  assert.ok(Array.isArray(track.artists), 'artists is a split credit list');
  assert.ok(Array.isArray(track.metadataSources), 'metadataSources records provenance');
});

await check('POST /api/discovery/foryou returns { tracks } for a cold profile', async () => {
  const res = await fetch(`${API}/api/discovery/foryou`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 5 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.tracks && Array.isArray(body.tracks), 'tracks array present');
  assert.equal(body.stats.personalisation.hasHistory, false, 'cold profile reported honestly');
});

await check('POST /api/discovery/refresh succeeds and invalidates every namespace', async () => {
  // Regression guard. This endpoint called `discovery.swrcache.invalidateNamespace`,
  // which was never exported, so every refresh failed with "Cannot read properties
  // of undefined" — silently leaving stale data in place while reporting success.
  const res = await fetch(`${API}/api/discovery/refresh`, { method: 'POST' });
  assert.equal(res.status, 200, `refresh returned ${res.status}`);
  const body = await res.json();
  assert.equal(body.refreshed, true, 'reports what it did');
  assert.ok(body.at, 'reports when');
});

await check('POST /api/artists/images returns a name -> url map', async () => {
  const res = await fetch(`${API}/api/artists/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names: ['Adele'] }),
  });
  const body = await res.json();
  assert.ok(body.images && typeof body.images === 'object', 'images map present');
  // Keyed by the name exactly as requested, which is what the caller indexes with.
  assert.ok('Adele' in body.images, `keyed as sent, got: ${Object.keys(body.images).join(',')}`);
});

await check('an unresolvable artist maps to null rather than a wrong image', async () => {
  const res = await fetch(`${API}/api/artists/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names: ['Zzzq Nonexistent Act Xyzzy Plugh'] }),
  });
  const body = await res.json();
  const value = body.images['Zzzq Nonexistent Act Xyzzy Plugh'];
  assert.ok(value === null || value === undefined, 'no image invented');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);