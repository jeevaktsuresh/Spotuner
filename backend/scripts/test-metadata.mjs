/**
 * Tests for the metadata layer: normalisation, merging, identity, de-duplication.
 *
 * All pure functions, no network, because the decisions worth protecting are the
 * ones about which metadata wins and which tracks are the same recording — and
 * those must be verifiable without depending on what MusicBrainz returns today.
 *
 * Run: node scripts/test-metadata.mjs
 */
import assert from 'node:assert/strict';

import { normalizeTrack, mergeTrack, mergeAll, metadataQuality } from '../lib/metadata/normalize.js';
import {
  identityOf,
  matchTracks,
  dedupeTracks,
  fuzzyIdentityKey,
  variantMarkers,
  normalizeIsrc,
  splitArtists,
  titleSimilarity,
} from '../lib/metadata/identity.js';

let passed = 0;
let failed = 0;

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

// ---------------------------------------------------------------- normalize

check('a raw provider record becomes a canonical track', () => {
  const t = normalizeTrack(
    { id: 'abc', title: 'Malare', artist: 'Vijay Yesudas', album: '', duration: 214, image: 'http://x/y.jpg' },
    'youtube'
  );
  assert.equal(t.id, 'abc');
  assert.equal(t.source, 'youtube');
  assert.equal(t.youtubeId, 'abc');
  assert.equal(t.title, 'Malare');
  assert.deepEqual(t.artists, ['vijay yesudas']);
  assert.equal(t.duration, 214);
  assert.deepEqual(t.metadataSources, ['youtube']);
});

check('a sparse record still yields a usable track', () => {
  const t = normalizeTrack({ id: 'x', title: 'Solo' }, 'youtube');
  assert.equal(t.title, 'Solo');
  assert.equal(t.album, null);
  assert.equal(t.duration, 0);
  assert.equal(t.genres.length, 0);
});

check('thumbnail mirrors image so both names resolve', () => {
  const t = normalizeTrack({ id: 'x', title: 'T', image: 'http://i.jpg' }, 'youtube');
  assert.equal(t.thumbnail, t.image);
});

check('publishedAt and releaseDate stay distinct facts', () => {
  const t = normalizeTrack(
    { id: 'x', title: 'T', publishedAt: '2026-01-10', releaseDate: '2025-06-01' },
    'youtube'
  );
  assert.equal(t.publishedAt, '2026-01-10T00:00:00.000Z');
  assert.equal(t.releaseDate, '2025-06-01T00:00:00.000Z');
});

check('an unparseable date becomes null rather than Invalid Date', () => {
  const t = normalizeTrack({ id: 'x', title: 'T', releaseDate: 'not-a-date' }, 'youtube');
  assert.equal(t.releaseDate, null);
});

check('ISRC is canonicalised to 12 characters', () => {
  assert.equal(normalizeIsrc('us-rc1-76-00001'), 'USRC17600001');
  assert.equal(normalizeIsrc('USRC17600001'), 'USRC17600001');
  assert.equal(normalizeIsrc('too-short'), null);
});

check('credit lines split into individual performers', () => {
  assert.deepEqual(splitArtists('Jakes Bejoy & Vishal Mishra & Aavani Malhar'), [
    'jakes bejoy',
    'vishal mishra',
    'aavani malhar',
  ]);
  assert.deepEqual(splitArtists('Karan Aujla, AP Dhillon'), ['karan aujla', 'ap dhillon']);
});

// ---------------------------------------------------------------- merging

check('a null from a second provider never erases a value', () => {
  // The regression this module exists for: MusicBrainz has no artwork, so a naive
  // `{...youtube, ...mb}` would blank the image of every track.
  const yt = normalizeTrack({ id: 'a', title: 'T', artist: 'X', album: '', image: 'http://i.jpg', duration: 200 }, 'youtube');
  const mb = normalizeTrack({ title: 'T', artist: 'X', album: 'Real Album', image: null, duration: null }, 'musicbrainz');

  const merged = mergeTrack(yt, mb, { extraSource: 'musicbrainz' });

  assert.equal(merged.image, 'http://i.jpg', 'artwork survives');
  assert.equal(merged.duration, 200, 'duration survives');
  assert.equal(merged.album, 'Real Album', 'the gap is filled');
});

check('YouTube keeps title and artist, MusicBrainz supplies the album', () => {
  const yt = normalizeTrack({ id: 'a', title: 'Malare', artist: 'Vijay Yesudas', album: '' }, 'youtube');
  const mb = normalizeTrack({ title: 'Malare (Remastered)', artist: 'Vijay Yesudas Jr', album: 'Malare OST', releaseDate: '2024-03-01', isrc: 'IN1234567890' }, 'musicbrainz');

  const merged = mergeTrack(yt, mb, { extraSource: 'musicbrainz' });

  assert.equal(merged.title, 'Malare', 'title stays the one the user already knows');
  assert.equal(merged.artist, 'Vijay Yesudas');
  assert.equal(merged.album, 'Malare OST');
  assert.equal(merged.releaseDate, '2024-03-01T00:00:00.000Z');
  assert.equal(merged.isrc, 'IN1234567890');
});

check('metadataSources records every provider that contributed', () => {
  const yt = normalizeTrack({ id: 'a', title: 'T', artist: 'X' }, 'youtube');
  const mb = normalizeTrack({ title: 'T', artist: 'X', album: 'A' }, 'musicbrainz');
  const merged = mergeTrack(yt, mb, { extraSource: 'musicbrainz' });
  assert.deepEqual(merged.metadataSources, ['youtube', 'musicbrainz']);
});

check('merging never invents a performer absent from both credits', () => {
  const yt = normalizeTrack({ id: 'a', title: 'T', artist: 'Solo' }, 'youtube');
  const mb = normalizeTrack({ title: 'T', artist: 'Solo', artists: ['solo', 'ghost'] }, 'musicbrainz');
  const merged = mergeTrack(yt, mb, { extraSource: 'musicbrainz' });
  // `artists` is recomputed from the winning credit line, never unioned.
  assert.deepEqual(merged.artists, ['solo']);
});

check('genres union across providers without duplicates', () => {
  const yt = normalizeTrack({ id: 'a', title: 'T', artist: 'X', genres: ['Pop'] }, 'youtube');
  const mb = normalizeTrack({ title: 'T', artist: 'X', genres: ['Pop', 'Soundtrack'] }, 'musicbrainz');
  const merged = mergeTrack(yt, mb, { extraSource: 'musicbrainz' });
  assert.deepEqual(merged.genres, ['Pop', 'Soundtrack']);
});

check('neither input is mutated by a merge', () => {
  const yt = normalizeTrack({ id: 'a', title: 'T', artist: 'X', album: null }, 'youtube');
  const mb = normalizeTrack({ title: 'T', artist: 'X', album: 'A' }, 'musicbrainz');
  mergeTrack(yt, mb, { extraSource: 'musicbrainz' });
  assert.equal(yt.album, null, 'base untouched');
  assert.equal(mb.album, 'A', 'extra untouched');
});

check('mergeAll orders by trust, not by argument order', () => {
  const mb = normalizeTrack({ title: 'T', artist: 'X', album: 'MB Album' }, 'musicbrainz');
  const yt = normalizeTrack({ id: 'a', title: 'T', artist: 'X', album: null, image: 'http://i.jpg' }, 'youtube');
  const merged = mergeAll([mb, yt], { primary: 'youtube' });
  assert.equal(merged.title, 'T');
  assert.equal(merged.album, 'MB Album');
  assert.equal(merged.image, 'http://i.jpg');
});

check('metadata quality rises as fields are filled in', () => {
  const bare = normalizeTrack({ id: 'a', title: 'T', artist: 'X' }, 'youtube');
  const rich = normalizeTrack(
    { id: 'a', title: 'T', artist: 'A & B', album: 'Al', albumId: 'x', releaseDate: '2026-01-01', isrc: 'IN1234567890', genres: ['Pop'], musicBrainzId: 'mb-1', duration: 200 },
    'youtube'
  );
  assert.ok(metadataQuality(rich) > metadataQuality(bare), `${metadataQuality(rich)} > ${metadataQuality(bare)}`);
  assert.equal(metadataQuality(null), 0);
});

check('title similarity is symmetric and forgiving of punctuation', () => {
  assert.ok(titleSimilarity('Malare', 'Malare') === 1);
  assert.ok(titleSimilarity('Malare - Vijay Yesudas', 'Malare — Vijay Yesudas') === 1);
  assert.ok(titleSimilarity('Malare', 'Manjalprasaadikkam') < 0.5);
});

// ---------------------------------------------------------------- identity

check('the same recording from two sources is one identity', () => {
  const a = { title: 'Malare', artist: 'Vijay Yesudas' };
  const b = { title: 'Malare — Vijay Yesudas', artist: 'Vijay Yesudas' };
  assert.equal(matchTracks(a, b).same, true);
});

check('upload packaging does not create a second track', () => {
  // Same recording, three different uploads.
  const a = { title: 'Malare', artist: 'Vijay Yesudas' };
  const b = { title: 'Malare Official Video', artist: 'Vijay Yesudas' };
  const c = { title: 'Malare (Lyrics)', artist: 'Vijay Yesudas' };
  assert.equal(matchTracks(a, b).same, true);
  assert.equal(matchTracks(a, c).same, true);
});

check('a remix is NOT merged into its original', () => {
  // The exact failure the variant markers exist to prevent.
  const original = { title: 'Malare', artist: 'Vijay Yesudas' };
  const remix = { title: 'Malare (Remix)', artist: 'Vijay Yesudas' };
  assert.equal(matchTracks(original, remix).same, false);
  assert.deepEqual(variantMarkers('Malare (Remix)'), ['remix']);
});

check('live, acoustic and cover variants stay separate', () => {
  const base = { title: 'Ente Vaa Moocham', artist: 'Anwar Assalam' };
  for (const suffix of ['(Live)', '(Acoustic)', '(Cover)', '(Instrumental)', '(Remastered 2024)']) {
    const variant = { title: `Ente Vaa Moocham ${suffix}`, artist: 'Anwar Assalam' };
    assert.equal(matchTracks(base, variant).same, false, `${suffix} must stay distinct`);
  }
});

check('two different songs by one artist stay separate', () => {
  const a = { title: 'Ente Vaa Moocham', artist: 'Anwar Assalam' };
  const b = { title: 'Manjalprasaadikkam', artist: 'Anwar Assalam' };
  assert.equal(matchTracks(a, b).same, false);
});

check('a shared ISRC merges regardless of differing titles', () => {
  const a = { title: 'Completely Different Name', artist: 'X', isrc: 'IN1234567890' };
  const b = { title: 'Another Name Entirely', artist: 'Y', isrc: 'IN-12345-67890' };
  assert.equal(matchTracks(a, b).same, true);
  assert.equal(matchTracks(a, b).level, 'isrc');
});

check('conflicting ISRCs are respected even when titles match', () => {
  const a = { title: 'Malare', artist: 'X', isrc: 'IN1111111111' };
  const b = { title: 'Malare', artist: 'X', isrc: 'IN2222222222' };
  const verdict = matchTracks(a, b);
  assert.equal(verdict.same, false);
  assert.match(verdict.reason, /conflicting/i);
});

check('a MusicBrainz recording id merges on its own', () => {
  const a = { title: 'X Song', artist: 'Y', musicBrainzId: 'abc-123' };
  const b = { title: 'Totally Other Title', artist: 'Z', musicBrainzId: 'ABC-123' };
  assert.equal(matchTracks(a, b).same, true);
});

check('identity prefers ISRC over recording id over fuzzy', () => {
  assert.equal(identityOf({ title: 'Malare', artist: 'Vijay Yesudas', isrc: 'IN1234567890', musicBrainzId: 'm1' }).level, 'isrc');
  assert.equal(identityOf({ title: 'Malare', artist: 'Vijay Yesudas', musicBrainzId: 'm1' }).level, 'recordingId');
  assert.equal(identityOf({ title: 'Malare', artist: 'Vijay Yesudas' }).level, 'fuzzy');
  assert.equal(identityOf({}).level, 'none');
});

check('an artist name repeated in the title does not change identity', () => {
  // "Song Name - Artist Name" is the most common YouTube upload format, so this
  // must agree with the bare "Song Name" form.
  assert.equal(
    fuzzyIdentityKey({ title: 'Malare', artist: 'Vijay Yesudas' }),
    fuzzyIdentityKey({ title: 'Malare - Vijay Yesudas', artist: 'Vijay Yesudas' })
  );
});

check('a fuzzy key is stable across punctuation differences', () => {
  const a = fuzzyIdentityKey({ title: 'Malare (From Moonnam Pakkam)', artist: 'Shakthisree Gopinanth' });
  const b = fuzzyIdentityKey({ title: 'Malare - Moonnam Pakkam', artist: 'Shakthisree Gopinanth' });
  assert.equal(a, b);
});

// ---------------------------------------------------------------- dedupe

check('duplicate uploads collapse to one candidate', () => {
  const result = dedupeTracks([
    { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas', youtubeId: 'v1' },
    { id: 'v2', title: 'Malare Official Video', artist: 'Vijay Yesudas', youtubeId: 'v2' },
    { id: 'v3', title: 'Malare (Lyrics)', artist: 'Vijay Yesudas', youtubeId: 'v3' },
  ]);
  assert.equal(result.tracks.length, 1, 'one recording');
  assert.equal(result.merged, 2);
});

check('a remix survives de-duplication as its own track', () => {
  const result = dedupeTracks([
    { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas' },
    { id: 'v2', title: 'Malare (Remix)', artist: 'Vijay Yesudas' },
  ]);
  assert.equal(result.tracks.length, 2, 'the remix is not swallowed');
});

check('the richest record survives a merge', () => {
  const result = dedupeTracks([
    { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas', youtubeId: 'v1' },
    { id: 'v2', title: 'Malare', artist: 'Vijay Yesudas', youtubeId: 'v1', album: 'OST', releaseDate: '2024-01-01', isrc: 'IN1234567890', musicBrainzId: 'mb1' },
  ]);
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].album, 'OST', 'the enriched record is kept');
  assert.equal(result.tracks[0].isrc, 'IN1234567890');
});

check('cross-provider duplicates collapse once an ISRC is known', () => {
  // YouTube never carries an ISRC, so this asymmetry is the normal case and must
  // not block a merge: same title, same artist, no variant disagreement.
  const result = dedupeTracks([
    { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas', youtubeId: 'v1' },
    { id: null, title: 'Malare', artist: 'Vijay Yesudas', isrc: 'IN1234567890', musicBrainzId: 'mb-9', album: 'Malare' },
  ]);
  assert.equal(result.tracks.length, 1, 'same recording, one candidate');
  assert.equal(result.tracks[0].album, 'Malare', 'the enriched fields survive');
  assert.equal(result.tracks[0].youtubeId, 'v1', 'the playback id survives');
});
check('a remastered upload is not folded into the original', () => {
  // Same ISRC on one side, but the titles disagree on version. Keeping them apart
  // is the spec's explicit requirement not to merge distinct masters.
  const result = dedupeTracks([
    { id: 'v1', title: 'Malare', artist: 'Vijay Yesudas', youtubeId: 'v1' },
    { id: 'v2', title: 'Malare (Remastered 2019)', artist: 'Vijay Yesudas', youtubeId: 'v2', isrc: 'IN1234567890' },
  ]);
  assert.equal(result.tracks.length, 2, 'distinct masters stay distinct');
});

check('de-duplication never returns fewer than it received', () => {
  const distinct = ['One', 'Two', 'Three', 'Four'].map((t, i) => ({ id: `${i}`, title: t, artist: `Artist${i}` }));
  const result = dedupeTracks(distinct);
  assert.equal(result.tracks.length, 4);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
