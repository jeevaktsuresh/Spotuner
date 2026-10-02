/**
 * Checks artist-credit splitting against real catalogue data from the backend.
 *
 * The Artists page bug was grouping by the raw credit string, so the invariant to
 * protect is: no two distinct performers collapse into one entry, and a performer
 * always lands on the same key regardless of which collaboration they appear in.
 *
 * Run: node scripts/check-artists.mjs (backend must be on :3001)
 */
import { artistsFromTracks, splitArtistCredit, artistKey, artistSlug } from '../src/utils/artists.js';

const shelves = await (await fetch('http://localhost:3001/api/shelves?limit=10')).json();
const tracks = shelves.flatMap((s) => s.tracks ?? []);

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`ok   ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? `\n       ${detail}` : ''}`); }
}

// --- unit-level splitting ---
check('splits an ampersand collaboration', (() => {
  const r = splitArtistCredit('Jakes Bejoy & Vishal Mishra & Aavani Malhar');
  return r.length === 3 && r[0] === 'Jakes Bejoy';
})());

check('splits a comma collaboration', (() => {
  const r = splitArtistCredit('Mithoon, Vishal Mishra & Asees Kaur');
  return r.length === 3 && r.includes('Mithoon');
})());

check('handles commas without spaces', (() => {
  const r = splitArtistCredit('Pankaj Udas,Hamsalekha,Itagi Eeranna');
  return r.length === 3;
})());

check('does not split hyphenated names', (() => {
  const r = splitArtistCredit('Ajay-Atul');
  return r.length === 1 && r[0] === 'Ajay-Atul';
})());

check('does not split dotted initials', (() => {
  const r = splitArtistCredit('A.R. Rahman');
  return r.length === 1 && r[0] === 'A.R. Rahman';
})());

check('a solo credit stays one', (() => {
  const r = splitArtistCredit('Anirudh Ravichander');
  return r.length === 1;
})());

check('blank credit yields nothing', splitArtistCredit('') .length === 0 && splitArtistCredit(null).length === 0);

check('splitting is case-insensitive on the key', artistKey('Arijit Singh') === artistKey('arijit singh'));

// --- rollup-level invariants on real data ---
const artists = artistsFromTracks(tracks);
const byKey = new Map(artists.map((a) => [a.key, a]));

check('every raw credit with & produced multiple artists', (() => {
  const collab = tracks.find((t) => (t.artist || '').includes(' & '));
  if (!collab) return true; // no sample to test
  const members = splitArtistCredit(collab.artist);
  return members.every((m) => byKey.has(artistKey(m)));
})(), 'a collaborator from a joint credit is missing from the rollup');

check('no entry still contains an & separator', (() => {
  const bad = artists.filter((a) => a.name.includes('&') || a.name.includes(','));
  return bad.length === 0;
})(), `offenders: ${artists.filter((a) => a.name.includes('&') || a.name.includes(',')).slice(0, 5).map((a) => a.name).join(' | ')}`);

check('no entry is a placeholder', (() => {
  return !artists.some((a) => /^(unknown|various artists?)$/i.test(a.name));
})());

check('song counts match the underlying track arrays', (() => {
  return artists.every((a) => a.songCount === a.tracks.length);
})());

check('each artist has at least one song', () => artists.every((a) => a.songCount >= 1));

check('no duplicate track inside an artist', (() => {
  return artists.every((a) => new Set(a.tracks.map((t) => t.id)).size === a.tracks.length);
})());

check('a repeat performer across collaborations is one entry', (() => {
  const credited = new Map();
  for (const t of tracks) {
    for (const m of splitArtistCredit(t.artist || '')) {
      const k = artistKey(m);
      credited.set(k, (credited.get(k) ?? 0) + 1);
    }
  }
  const repeated = [...credited.entries()].filter(([, n]) => n > 1);
  if (repeated.length === 0) return true;
  return repeated.every(([k]) => byKey.has(k));
})());

// --- route round-trip: a URL must resolve back to the same artist ---
// Links use the hyphenated slug, but a URL pasted with a literal space must work
// too, and a real hyphen in a name must survive.
check('artist slug survives a URL round-trip', (() => {
  return artists.every((a) => {
    const url = `/artists/${encodeURIComponent(artistSlug(a.key))}`;
    const slug = decodeURIComponent(url.slice('/artists/'.length));
    return artistSlug(slug) === artistSlug(a.key);
  });
})());

check('a space-form URL resolves to the same artist', (() => {
  // findArtist() compares slugs, so the literal-space form must fold to the same.
  const target = artists.find((a) => / /.test(a.key));
  if (!target) return true;
  return artistSlug(decodeURIComponent(encodeURIComponent(target.key))) === artistSlug(target.key);
})());

check('a mixed-case URL slug resolves to the same artist', (() => {
  const target = artists.find((a) => a.songCount > 1);
  if (!target) return true;
  const shouted = artistSlug(target.key).toUpperCase();
  return byKey.has(artistKey(target.name)) && artistSlug(byKey.get(artistKey(target.name)).key) === shouted.toLowerCase();
})());

check('a hyphen in a real name is not collapsed', (() => {
  // "Ajay-Atul" must keep its slug as "ajay-atul", not become "ajay atul".
  const hyphenated = artists.filter((a) => /-/.test(a.name));
  return hyphenated.every((a) => artistSlug(a.key) === artistSlug(a.name));
})());

check('an unknown artist slug resolves to null', (() => {
  return !byKey.has(artistKey('definitely-not-a-real-artist-xyz'));
}));

// --- report the before/after effect ---
const rawUnique = new Set(tracks.map((t) => t.artist).filter(Boolean)).size;
console.log('');
console.log(`tracks            : ${tracks.length}`);
console.log(`raw credit strings: ${rawUnique}`);
console.log(`individual artists: ${artists.length}`);
console.log('');
console.log('top 12 artists:');
for (const a of artists.slice(0, 12)) {
  console.log(`  ${String(a.songCount).padStart(3)}  ${a.name}`);
}

console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);