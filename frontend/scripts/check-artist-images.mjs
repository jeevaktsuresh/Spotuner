/**
 * End-to-end coverage check for artist images.
 *
 * Walks the same path the browser does: fetch shelves, roll up artists, ask the
 * backend for pictures, and report how many ended up with a real image versus
 * falling back to a track thumbnail. Also confirms the returned URLs actually
 * load, since a plausible-looking URL is not proof of a working image.
 *
 * Run: node scripts/check-artist-images.mjs
 * Backend origin defaults to http://localhost:3001; override with API_URL.
 */
import { artistsFromTracks } from '../src/utils/artists.js';

const API = process.env.API_URL || 'http://localhost:3001';

const shelves = await (await fetch(`${API}/api/shelves?limit=10`)).json();
const tracks = shelves.flatMap((s) => s.tracks ?? []);
const artists = artistsFromTracks(tracks);

console.log(`artists rolled up: ${artists.length}`);

const withThumb = artists.filter((a) => a.image).length;
console.log(`have a track thumbnail: ${withThumb}`);

const resolved = new Map();
const BATCH = 24;
for (let i = 0; i < artists.length; i += BATCH) {
  const slice = artists.slice(i, i + BATCH).map((a) => a.name);
  const res = await fetch(`${API}/api/artists/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names: slice }),
  });
  const body = await res.json();
  for (const [k, v] of Object.entries(body.images ?? {})) resolved.set(k, v);
}

const real = [...resolved.values()].filter(Boolean);
console.log(`resolved by backend:   ${resolved.size} names, ${real.length} with an image`);
const pct = artists.length ? Math.round((real.length / artists.length) * 100) : 0;
console.log(`coverage: ${real.length}/${artists.length} (${pct}%)`);
console.log(`still on thumbnail fallback: ${artists.length - real.length}`);

// Confirm a sample of the URLs actually return an image, not an error page.
const sample = real.slice(0, 6);
console.log('');
console.log('sampling URLs for loadability:');
let ok = 0;
for (const url of sample) {
  try {
    const r = await fetch(url);
    const type = r.headers.get('content-type') || '';
    const good = r.ok && type.startsWith('image/');
    if (good) ok++;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} HTTP ${r.status} ${type}`);
  } catch (e) {
    console.log(`  FAIL ${e.message}`);
  }
}

console.log('');
console.log('sample of resolved artists:');
for (const [name, url] of [...resolved].filter(([, u]) => u).slice(0, 8)) {
  console.log(`  ${name}`);
}

console.log('');
console.log(`${ok}/${sample.length} sampled images loaded`);
process.exit(ok === sample.length && real.length > 0 ? 0 : 1);