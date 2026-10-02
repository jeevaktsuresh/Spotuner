/**
 * Deterministic tests for personalised scoring, penalties and diversity.
 *
 * Given the same candidate and the same profile, the score must be identical every
 * time — which is what makes a recommendation explainable and regression-testable.
 * Nothing here touches the network or the clock.
 *
 * Run: node scripts/test-scoring.mjs
 */
import assert from 'node:assert/strict';

import {
  buildProfile,
  forYouScore,
  userAffinity,
  leadArtistAffinity,
  skipPenalty,
  playedPenalty,
  confidenceFor,
  tierFor,
  leadArtistKey,
  FORYOU_WEIGHTS,
  PENALTY_WEIGHTS,
} from '../lib/discovery/foryou.js';

import { applyDiversity, applyShelfDiversity, languageSpread } from '../lib/discovery/dimensions.js';
import { forYouQueries } from '../lib/discovery/queries.js';

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

/** A profile with the example affinities from the spec. */
const RICH_PROFILE = buildProfile({
  artists: { 'Artist X': 10, 'Artist Y': 4, 'Artist Z': 1 },
  languages: { ml: 10, en: 8, ta: 4 },
  genres: { pop: 10, rock: 3 },
  totalPlays: 120,
});

const COLD_PROFILE = buildProfile({});

function track(overrides = {}) {
  return {
    id: 't1',
    title: 'Some Song',
    artist: 'Artist X',
    language: 'ml',
    languageName: 'Malayalam',
    genres: ['pop'],
    metadataQuality: 0.6,
    ...overrides,
  };
}

// ---------------------------------------------------------------- confidence

check('confidence grows with evidence and saturates', () => {
  assert.ok(confidenceFor(1) < confidenceFor(10), 'more evidence, more confidence');
  assert.ok(confidenceFor(100) < 1, 'never fully certain');
  assert.equal(confidenceFor(0), 0, 'no evidence, no confidence');
  assert.equal(confidenceFor(-5), 0);
});

check('a thin profile cannot produce a strong opinion', () => {
  const thin = buildProfile({ artists: { 'Artist X': 5 }, languages: { ml: 5 } });
  assert.ok(thin.confidence < 0.8, `thin confidence ${thin.confidence}`);
});

check('tiers match the frontend five-stage model', () => {
  assert.equal(tierFor(0, 0), 'cold');
  assert.equal(tierFor(5, 1), 'early');
  assert.equal(tierFor(20, 5), 'learning');
  assert.equal(tierFor(80, 20), 'strong');
  assert.equal(tierFor(500, 50), 'advanced');
});

// ---------------------------------------------------------------- affinity

check('affinity is normalised against the strongest key', () => {
  const profile = buildProfile({ artists: { A: 10, B: 5 } });
  assert.equal(profile.artists.map.get('a'), 1);
  assert.equal(profile.artists.map.get('b'), 0.5);
});

check('a preferred artist and language outrank an unfamiliar one', () => {
  const favourite = forYouScore(
    track({ id: 'a', artist: 'Artist X', language: 'ml' }),
    RICH_PROFILE
  );
  const stranger = forYouScore(
    track({ id: 'b', artist: 'Artist Q', language: 'kn' }),
    RICH_PROFILE
  );

  assert.ok(favourite.score > stranger.score, `${favourite.score} > ${stranger.score}`);
});

check('a cold profile produces no personalisation rather than a wrong one', () => {
  const cold = forYouScore(track(), COLD_PROFILE);
  assert.equal(COLD_PROFILE.hasHistory, false);
  assert.match(cold.reason, /popular/i, 'says so rather than claiming a reason');
  // Nothing personal may be claimed.
  assert.equal(userAffinity(track(), COLD_PROFILE), null);
});

check('scoring is deterministic', () => {
  const a = forYouScore(track({ id: 'same' }), RICH_PROFILE);
  const b = forYouScore(track({ id: 'same' }), RICH_PROFILE);
  assert.equal(a.score, b.score, 'same input, same score');
  assert.deepEqual(a.parts, b.parts, 'same breakdown');
});

check('the score stays within 0..100', () => {
  const max = forYouScore(
    track({ artist: 'Artist X', language: 'ml', genres: ['pop'], metadataQuality: 1 }),
    RICH_PROFILE,
    { queryCount: 10, bestRank: 1, signals: { releaseRecency: 1, recency: 1 } }
  );
  assert.ok(max.score <= 100 && max.score >= 0, `${max.score}`);
});

check('the lead artist defines affinity, not the whole credit line', () => {
  assert.equal(leadArtistKey({ artist: 'Lead & Guest' }), 'lead');
  assert.equal(leadArtistKey({ artist: 'Lead, Guest' }), 'lead');
  assert.equal(leadArtistKey({ artist: 'Unknown' }), null);
  assert.equal(leadArtistKey({ artist: 'Various Artists' }), null);
  assert.equal(leadArtistKey({}), null);

  const profile = buildProfile({ artists: { Lead: 10 } });
  const collab = { artist: 'Lead & Guest' };
  assert.equal(leadArtistAffinity(collab, profile), 1);
});

// ---------------------------------------------------------------- penalties

check('skipping an artist lowers its score', () => {
  const plain = buildProfile({ artists: { 'Artist X': 10 }, languages: { ml: 10 } });
  const skipping = buildProfile({
    artists: { 'Artist X': 10 },
    languages: { ml: 10 },
    skippedArtists: { 'Artist X': 10 },
  });

  const liked = forYouScore(track({ artist: 'Artist X' }), plain);
  const skipped = forYouScore(track({ artist: 'Artist X' }), skipping);

  assert.ok(skipped.score < liked.score, `${skipped.score} < ${liked.score}`);
});

check('a skipped artist cannot be promoted by a positive score', () => {
  const profile = buildProfile({
    artists: { 'Artist X': 10 },
    languages: { ml: 10 },
    skippedArtists: { 'Artist X': 10 },
  });
  assert.equal(leadArtistAffinity({ artist: 'Artist X' }, profile), 0);
  assert.ok(skipPenalty({ artist: 'Artist X' }, profile) > 0);
});

check('skip penalties scale with confidence, not with raw skips', () => {
  const strong = buildProfile({ artists: { A: 10, B: 8, C: 6, D: 4 }, skippedArtists: { A: 10 } });
  const weak = buildProfile({ artists: { A: 10 }, skippedArtists: { A: 10 } });
  assert.ok(strong.confidence > weak.confidence);
  assert.ok(skipPenalty({ artist: 'A' }, strong) > skipPenalty({ artist: 'A' }, weak));
});

check('an already-played track is penalised but not removed', () => {
  const profile = buildProfile({
    artists: { 'Artist X': 10 },
    languages: { ml: 10 },
    playedKeys: ['T1'],
  });
  assert.ok(playedPenalty({ id: 't1' }, profile) > 0);
  assert.equal(playedPenalty({ id: 'other' }, profile), 0);

  const score = forYouScore(track({ id: 't1' }), profile);
  assert.ok(score.score >= 0, 'still scoreable');
});

check('a penalty cannot push a score below zero', () => {
  const profile = buildProfile({
    artists: { Nobody: 1 },
    skippedArtists: { Nobody: 100 },
    playedKeys: ['T1'],
  });
  const result = forYouScore(track({ id: 't1', artist: 'Nobody' }), profile);
  assert.ok(result.score >= 0, `clamped, got ${result.score}`);
});

check('an unknown artist is never penalised for absent data', () => {
  const profile = buildProfile({ artists: { 'Artist X': 10 }, skippedArtists: { 'Artist X': 10 } });
  assert.equal(skipPenalty({ artist: 'Totally Different' }, profile), 0);
  assert.equal(playedPenalty({}, profile), 0);
});

// ---------------------------------------------------------------- explanations

check('the reason matches the signals that produced the score', () => {
  const result = forYouScore(track({ artist: 'Artist X', language: 'ml' }), RICH_PROFILE);
  assert.match(result.reason, /listen to Malayalam|artist you play|taste/i, result.reason);
});

check('a skipped artist is explained as such', () => {
  const profile = buildProfile({
    artists: { 'Artist X': 10 },
    languages: { ml: 10 },
    skippedArtists: { 'Artist X': 10 },
  });
  const result = forYouScore(track({ artist: 'Artist X' }), profile);
  assert.match(result.reason, /skip/i, result.reason);
});

// ---------------------------------------------------------------- diversity

check('an album cap defers rather than deletes', () => {
  const ranked = [
    { id: '1', album: 'A', score: 100 },
    { id: '2', album: 'A', score: 99 },
    { id: '3', album: 'A', score: 98 },
    { id: '4', album: 'B', score: 97 },
  ];
  const out = applyDiversity(ranked, { caps: { album: 2 }, dimensions: ['album'] });
  assert.equal(out.length, 4, 'nothing dropped');
  assert.deepEqual(out.slice(0, 3).map((t) => t.id), ['1', '2', '4'], 'third A deferred');
});

check('a language share caps one language without emptying a regional shelf', () => {
  // 20 slots, 60% share -> cap of 12. A shelf that is 12/20 Malayalam is allowed.
  const ranked = Array.from({ length: 20 }, (_, i) => ({
    id: `${i}`,
    album: `Album ${i}`,
    language: i < 12 ? 'ml' : 'en',
    score: 100 - i,
  }));

  const out = applyShelfDiversity(ranked, { limit: 20 });
  const taken = out.slice(0, 20);

  assert.equal(taken.length, 20, 'shelf still full');
  const ml = taken.filter((t) => t.language === 'ml').length;
  assert.ok(ml <= 12, `Malayalam capped at 12, got ${ml}`);
  assert.ok(taken.some((t) => t.language === 'en'), 'other languages survive');
});

check('diversity never returns fewer tracks than it received', () => {
  const ranked = Array.from({ length: 15 }, (_, i) => ({ id: `${i}`, album: 'Same', language: 'ml', score: 10 - i }));
  assert.equal(applyShelfDiversity(ranked, { limit: 20 }).length, 15);
});

check('an all-one-language shelf is still returned in full', () => {
  // A regional shelf legitimately *is* one language; the cap must defer, never delete.
  const ranked = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, album: `A${i}`, language: 'ml', score: 100 - i }));
  const out = applyShelfDiversity(ranked, { limit: 20 });
  assert.equal(out.length, 20);
});

check('language spread is reported for diagnostics', () => {
  const spread = languageSpread([
    { language: 'ml' }, { language: 'ml' }, { language: 'en' },
  ]);
  assert.equal(spread.total, 3);
  assert.equal(spread.dominant, 'ml');
  assert.ok(Math.abs(spread.dominantShare - 0.667) < 0.01);
});

// ---------------------------------------------------------------- query pool

check('For You queries are derived from the listener', () => {
  const queries = forYouQueries({
    profile: { artists: { 'Anirudh Ravichander': 10 }, genres: { pop: 5 }, languages: { ml: 8 } },
    now: new Date('2026-10-02T12:00:00Z'),
  });
  assert.ok(queries.some((q) => /anirudh ravichander/i.test(q)), 'queries their artist');
  assert.ok(queries.some((q) => /malayalam/i.test(q)), 'queries their language');
});

check('For You always keeps a broad discovery query', () => {
  // Without this the shelf converges on the user's own back catalogue.
  const queries = forYouQueries({
    profile: { artists: { 'Artist X': 10 }, genres: {}, languages: {} },
    now: new Date('2026-10-02T12:00:00Z'),
  });
  assert.ok(queries.some((q) => /new songs this week/i.test(q)), 'stays wide');
});

check('For You falls back gracefully with no profile', () => {
  const queries = forYouQueries({ profile: null, now: new Date('2026-10-02T12:00:00Z') });
  assert.ok(queries.length > 0, 'still produces a pool');
  assert.ok(queries.every((q) => typeof q === 'string' && q.length > 0));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
