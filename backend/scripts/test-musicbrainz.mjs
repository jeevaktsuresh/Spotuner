/**
 * Tests for MusicBrainz match selection, against payloads captured from the live
 * API.
 *
 * These rules were not designed on paper — each came from observing a wrong
 * answer. Unit tests with invented fixtures could not have caught them, because
 * the bugs were about the schema MusicBrainz *actually* returns:
 *
 *   - `inc=releases` yields `title`, `status` and a nested `release-group` only.
 *     There is no release-level `date`, and `primary-type` lives on the group, not
 *     the release. Filtering on `release.date` therefore silently did nothing.
 *   - Every candidate for a popular song scores 100 with an identical title, so
 *     neither score nor title can discriminate. Only `disambiguation` can.
 *   - `recording.first-release-date` is recording-wide, and was observed reporting
 *     a 2023 live album's date for a 2017 studio single.
 *
 * The final two tests assert on the fixtures themselves, so these payloads cannot
 * quietly drift into a shape the real service never sends.
 *
 * Run: node scripts/test-musicbrainz.mjs
 */
import assert from 'node:assert/strict';

import {
  pickMatch,
  usableReleases,
  pickRelease,
} from '../lib/metadata/providers/musicbrainz.js';

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

const group = (primary, secondary = []) => ({ 'primary-type': primary, 'secondary-types': secondary });

// --- captured payloads ------------------------------------------------------

/** "Blinding Lights" — the Dolby Atmos candidate. */
const atmosMix = {
  title: 'Blinding Lights',
  disambiguation: 'Dolby Atmos mix',
  length: 200000,
  'first-release-date': '2019-11-29',
  isrcs: ['USUG11904251'],
  'artist-credit': [{ name: 'The Weeknd' }],
  releases: [
    { title: 'After Hours', status: 'Official', 'release-group': group('Album') },
    { title: 'Blinding Lights', status: 'Official', 'release-group': group('Single') },
  ],
};

/** "Blinding Lights" — the live take. */
const liveTake = {
  title: 'Blinding Lights',
  disambiguation: 'live, 2022-11-26-27: SoFi Stadium',
  length: 253365,
  'first-release-date': '2023-03-03',
  isrcs: ['USUG12301431'],
  'artist-credit': [{ name: 'The Weeknd' }],
  releases: [{ title: 'Live at SoFi Stadium', status: 'Official', 'release-group': group('Album', ['Live']) }],
};

/** "Blinding Lights" — a chart compilation with nothing usable. */
const chartCompilation = {
  title: 'Blinding Lights',
  disambiguation: '',
  length: 200466,
  'first-release-date': '2021',
  isrcs: [],
  'artist-credit': [{ name: 'The Weeknd' }],
  releases: [
    { title: 'Die Ultimative Chartshow', status: 'Official', 'release-group': group('Album', ['Compilation']) },
  ],
};

/** "Blinding Lights" — the music-video upload carrying the original single. */
const videoUpload = {
  title: 'Blinding Lights',
  disambiguation: 'music video',
  length: 262000,
  'first-release-date': '2019-11-29',
  isrcs: ['USUMV1902060'],
  'artist-credit': [{ name: 'The Weeknd' }],
  releases: [
    { title: 'Blinding Lights', status: 'Official', 'release-group': group('Single') },
    { title: 'The Highlights', status: 'Official', 'release-group': group('Album', ['Compilation']) },
  ],
};

/** "Shape of You" — every release is from a live album. */
const shapeOfYouLiveOnly = {
  title: 'Shape of You',
  disambiguation: '',
  length: 233712,
  'first-release-date': '2023-05-10',
  isrcs: ['GBAHS2300446'],
  'artist-credit': [{ name: 'Ed Sheeran' }],
  releases: [
    { title: 'Apple Music Live: Ed Sheeran', status: 'Official', 'release-group': group('Album', ['Live']) },
  ],
};

const shapeOfYouSingle = {
  title: 'Shape of You',
  disambiguation: '',
  length: 233712,
  'first-release-date': '2017-01-06',
  isrcs: ['GBAHS1700003'],
  'artist-credit': [{ name: 'Ed Sheeran' }],
  releases: [{ title: 'Shape of You', status: 'Official', 'release-group': group('Single') }],
};

const query = { title: 'Blinding Lights', artist: 'The Weeknd' };

// --- release filtering ------------------------------------------------------

check('live releases are rejected', () => {
  assert.equal(usableReleases(liveTake.releases).length, 0);
});

check('compilations are rejected', () => {
  assert.equal(usableReleases(chartCompilation.releases).length, 0);
});

check('DJ mixes and soundtracks are rejected', () => {
  const mix = [{ title: 'X', status: 'Official', 'release-group': group('Album', ['DJ-mix']) }];
  const soundtrack = [{ title: 'Y', status: 'Official', 'release-group': group('Album', ['Soundtrack']) }];
  assert.equal(usableReleases(mix).length, 0);
  assert.equal(usableReleases(soundtrack).length, 0);
});

check('bootlegs and pseudo-releases are rejected', () => {
  const bootleg = [{ title: 'X', status: 'Bootleg', 'release-group': group('Album') }];
  const pseudo = [{ title: 'Y', status: 'Pseudo-Release', 'release-group': group('Single') }];
  assert.equal(usableReleases(bootleg).length, 0);
  assert.equal(usableReleases(pseudo).length, 0);
});

check('singles, albums and EPs are accepted', () => {
  assert.equal(usableReleases(shapeOfYouSingle.releases).length, 1);
  assert.equal(usableReleases(atmosMix.releases).length, 2);
});

check('an album is never reported when every release is live', () => {
  // The original corruption: a 2017 single reporting "Apple Music Live: Ed Sheeran".
  const result = pickRelease(shapeOfYouLiveOnly.releases, shapeOfYouLiveOnly);
  assert.equal(result.album, null, 'no live album reported');
  assert.equal(result.date, null, 'and no date derived from it');
});

check('a named single yields its release date', () => {
  const result = pickRelease(shapeOfYouSingle.releases, shapeOfYouSingle);
  assert.equal(result.album, 'Shape of You');
  assert.equal(result.date, '2017-01-06');
});

check('a release date is withheld when no release matches the recording', () => {
  // "After Hours" is a real album but the recording is not titled that, so the
  // recording-wide date must not be attached to it on trust.
  const onlyAlbum = [{ title: 'After Hours', status: 'Official', 'release-group': group('Album') }];
  const result = pickRelease(onlyAlbum, { title: 'Blinding Lights', 'first-release-date': '2019-11-29' });
  assert.equal(result.date, null, 'date withheld');
  assert.equal(result.album, 'After Hours', 'but the album name is still useful');
});

// --- match selection --------------------------------------------------------

check('a live take is never chosen for a plain query', () => {
  const chosen = pickMatch([liveTake, chartCompilation, atmosMix], query);
  assert.notEqual(chosen?.disambiguation, liveTake.disambiguation);
});

check('a mix is never chosen for a plain query', () => {
  const chosen = pickMatch([atmosMix, chartCompilation, videoUpload], query);
  assert.ok(!/atmos/i.test(chosen?.disambiguation ?? ''), 'Dolby Atmos mix rejected');
});

check('the most informative surviving candidate wins', () => {
  // The chart compilation is gate-clean but contributes nothing; the video upload
  // carries an ISRC and a matching single. Choosing the first gate-passing
  // candidate returned the compilation and enriched nothing.
  const chosen = pickMatch([chartCompilation, videoUpload, atmosMix], query);
  assert.equal(chosen, videoUpload, 'prefers the candidate that contributes metadata');
});

check('a lone surviving candidate is accepted', () => {
  // The video upload is the least ambiguous survivor: "music video" describes the
  // upload format, not a different master, so it carries the single's identifiers.
  assert.equal(pickMatch([videoUpload], query), videoUpload);
});

check('a lone mix is rejected when no mix was requested', () => {
  // With "mix"/"atmos" recognised as variant markers, this is the same shape as
  // the live take: one candidate, and it is a different recording.
  assert.equal(pickMatch([atmosMix], query), null);
});

check('a different artist is rejected', () => {
  const other = { ...shapeOfYouSingle, 'artist-credit': [{ name: 'Someone Else' }] };
  assert.equal(pickMatch([other], { title: 'Shape of You', artist: 'Ed Sheeran' }), null);
});

check('an unrelated title is rejected', () => {
  const other = { ...shapeOfYouSingle, title: 'Totally Unrelated Song' };
  assert.equal(pickMatch([other], { title: 'Shape of You', artist: 'Ed Sheeran' }), null);
});

check('a query asking for a remix may match a remix', () => {
  // The gate is one-directional: a variant the caller did not ask for is rejected,
  // but asking for one explicitly must still be allowed to find it.
  const remix = {
    ...shapeOfYouSingle,
    title: 'Shape of You (Remix)',
    disambiguation: 'remix',
  };
  const chosen = pickMatch([remix], { title: 'Shape of You (Remix)', artist: 'Ed Sheeran' });
  assert.equal(chosen, remix, 'an explicitly requested variant still matches');
});

check('no candidate at all resolves to null rather than throwing', () => {
  assert.equal(pickMatch([], query), null);
  assert.equal(pickMatch(undefined, query), null);
});

// --- fixture fidelity -------------------------------------------------------

check('fixtures match the real schema: releases carry no date field', () => {
  // Guards the root cause of the original bug: code written against an imagined
  // schema, filtering on `release.date`, which silently matched nothing.
  for (const release of [...shapeOfYouSingle.releases, ...liveTake.releases]) {
    assert.ok(!('date' in release), 'release has no date');
    assert.ok(!('primary-type' in release), 'primary-type is on the release-group');
    assert.ok('release-group' in release, 'release-group is present');
  }
});

check('fixtures match the real schema: every candidate shares one title', () => {
  // This is precisely why usefulness ranking is required and score cannot be used.
  const titles = new Set([atmosMix, liveTake, chartCompilation, videoUpload].map((r) => r.title));
  assert.equal(titles.size, 1, 'all four captured candidates are titled "Blinding Lights"');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);