/**
 * Unit tests for the discovery scoring and filtering pipeline.
 *
 * These cover the pure functions only — no network — because the decisions worth
 * protecting are the ones that decide whether an old song is presented as new,
 * and those need to be verifiable without depending on what YouTube returns today.
 *
 * Run: node scripts/test-discovery.mjs
 */
import assert from 'node:assert/strict';

import {
  recencyScore,
  velocityScore,
  effectiveVelocityAge,
  freshnessGate,
  releaseGate,
  engagementScore,
  ageInDays,
  releaseAssessment,
  freshnessSignals,
  trendingWindowDays,
  releaseWindowDays,
  DECAY,
} from '../lib/discovery/freshness.js';

import {
  trendingScore,
  latestScore,
  musicConfidence,
  crossQueryScore,
  searchRankScore,
} from '../lib/discovery/score.js';

import { assessQuality, releaseEvidence, isTopicChannel } from '../lib/discovery/quality.js';
import { identityKey, poolCandidates } from '../lib/discovery/pool.js';
import { trendingQueries, latestQueries, calendar } from '../lib/discovery/queries.js';
import { applyArtistDiversity, repetitionMultiplier, markShown, resetRepetition } from '../lib/discovery/diversity.js';
import * as swrcache from '../lib/discovery/swrcache.js';
import { parsePlayCount } from '../lib/youtube.js';

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

const NOW = new Date('2026-10-02T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);

// ---------------------------------------------------------------- queries

check('queries rotate with the current year, not a hardcoded one', () => {
  const thisYear = trendingQueries({ now: new Date('2026-10-02T12:00:00Z') });
  const nextYear = trendingQueries({ now: new Date('2027-03-14T12:00:00Z') });

  assert.ok(thisYear.some((q) => q.includes('2026')), '2026 queries mention 2026');
  assert.ok(nextYear.some((q) => q.includes('2027')), '2027 queries mention 2027');
  assert.ok(
    !nextYear.some((q) => q.includes('2026')),
    'no stale year leaks into the next year'
  );
});

check('latest queries include the current month', () => {
  const q = latestQueries({ now: new Date('2026-03-14T12:00:00Z') });
  assert.ok(q.some((x) => /march/i.test(x)), 'month name present');
});

check('language queries use the language name, not the code', () => {
  const q = trendingQueries({ language: 'ml', now: NOW });
  assert.ok(q.every((x) => /malayalam/i.test(x)), 'every query names Malayalam');
  assert.ok(!q.some((x) => /\bml\b/.test(x)), 'no raw code leaks in');
});

check('trending and latest query families differ', () => {
  const t = trendingQueries({ now: NOW });
  const l = latestQueries({ now: NOW });
  assert.notDeepEqual(t, l);
});

// ---------------------------------------------------------------- play counts

check('play counts parse into real numbers', () => {
  assert.equal(parsePlayCount('488M plays'), 488000000);
  assert.equal(parsePlayCount('1.2K views'), 1200);
  assert.equal(parsePlayCount('2,345,678 views'), 2345678);
  assert.equal(parsePlayCount('3B plays'), 3000000000);
  assert.equal(parsePlayCount(''), null);
  assert.equal(parsePlayCount(undefined), null);
});

// ---------------------------------------------------------------- freshness

check('recency decays monotonically with age', () => {
  const young = recencyScore(1, DECAY.trending);
  const old = recencyScore(100, DECAY.trending);
  assert.ok(young > old, 'younger scores higher');
  assert.ok(recencyScore(0, DECAY.trending) > 0.99, 'today is ~1');
  assert.ok(old < young, 'monotonic');
});

check('age is null when the date is unknown', () => {
  assert.equal(ageInDays(null, NOW), null);
  assert.equal(ageInDays(new Date('nonsense'), NOW), null);
  assert.equal(Math.round(ageInDays(daysAgo(10), NOW)), 10);
});

check('velocity favours fast-rising songs over old accumulated ones', () => {
  const fast = velocityScore(500000, 2); // 500k views in 2 days
  const slow = velocityScore(100000000, 1825); // 100M views over 5 years
  assert.ok(fast > slow, `${fast} > ${slow}`);
});

check('velocity is null, not zero, when unmeasurable', () => {
  assert.equal(velocityScore(null, 10), null);
  assert.equal(velocityScore(1000, null), null);
});

check('a sub-hour-old video does not claim infinite velocity', () => {
  const justNow = velocityScore(50000, 0.001);
  assert.ok(Number.isFinite(justNow) && justNow <= 1, 'clamped and finite');
});

check('the freshness gate excludes old tracks from trending', () => {
  assert.equal(freshnessGate(1), 1);
  assert.equal(freshnessGate(trendingWindowDays()), 1);
  assert.ok(freshnessGate(365) < 0.1, 'a year old is gated out');
  assert.ok(freshnessGate(3400) < 0.001, 'a decade old is fully gated');
});

check('the release gate falls back to upload age when release date is missing', () => {
  assert.equal(releaseGate(null, 5), 1, 'recent upload passes');
  assert.ok(releaseGate(null, 2000) < 0.01, 'ancient upload gated');
  assert.ok(releaseGate(10, 4000) > 0.9, 'recent release wins over old upload');
});

check('velocity is not inflated by capping the age divisor', () => {
  // Regression guard: an earlier implementation divided a lifetime total by the
  // trending window instead of the true age, believing this would be conservative.
  // It does the opposite — a smaller divisor yields a larger rate — so old tracks
  // scored higher than their real velocity justified. The gate handles recency;
  // velocity now reports only what is measurable.
  const real = velocityScore(291000000, 3389);
  const cappedWrongly = velocityScore(291000000, trendingWindowDays());
  assert.ok(cappedWrongly > real, 'capping genuinely inflates, which is why it was removed');
  assert.ok(real < 1 && real > 0, 'the honest rate is a finite value');
  assert.equal(effectiveVelocityAge(3389), 3389, 'age passes through unchanged');
});

check('engagement measures the ratio, not the total', () => {
  const big = engagementScore(10000000, 500000);
  const small = engagementScore(400000, 20000);
  assert.ok(Math.abs(big - small) < 0.01, `${big} ~= ${small}`);
  assert.equal(engagementScore(null, 5), null);
});

// ---------------------------------------------------------------- new release

check('a recent distributor upload counts as a new release', () => {
  const track = { uploadDate: daysAgo(3), releaseDate: daysAgo(4) };
  const evidence = { markers: ['auto_generated'], isTopic: true, uploadLagDays: 1 };
  const result = releaseAssessment(track, evidence, NOW);
  assert.equal(result.isNewRelease, true);
  assert.ok(result.confidence > 0.5);
});

check('an old song re-uploaded recently is NOT a new release', () => {
  // The critical case: recent upload, but the music itself is years old.
  const track = { uploadDate: daysAgo(2), releaseDate: daysAgo(1400) };
  const evidence = { markers: [], isTopic: false, uploadLagDays: 1398 };
  const result = releaseAssessment(track, evidence, NOW);
  assert.equal(result.isNewRelease, false, 'recent upload of old music is not a release');
  assert.ok(result.reasons.some((r) => /re-upload/i.test(r)), 'reason explains the upload lag');
});

check('a remaster is not treated as a new release', () => {
  const track = { uploadDate: daysAgo(1), releaseDate: daysAgo(5) };
  const evidence = { markers: ['title_rerelease_marker'], isTopic: true, uploadLagDays: 4 };
  const result = releaseAssessment(track, evidence, NOW);
  assert.equal(result.isNewRelease, false);
});

check('no release information at all leans negative, not positive', () => {
  const track = { uploadDate: daysAgo(2), releaseDate: null };
  const evidence = { markers: [], isTopic: false, uploadLagDays: null };
  const result = releaseAssessment(track, evidence, NOW);
  assert.ok(result.confidence < 0.5, 'unknown is not treated as new');
});

// ---------------------------------------------------------------- scoring

function signalsFor(ageDays, extra = {}) {
  const uploadDate = daysAgo(ageDays);
  return freshnessSignals(
    {
      title: 'Song',
      artist: 'Artist',
      uploadDate,
      releaseDate: uploadDate,
      viewCount: extra.views ?? 1000000,
      likeCount: extra.likes ?? 50000,
    },
    { markers: [], isTopic: true, uploadLagDays: 0 },
    NOW
  );
}

check('trending ranking puts recent, fast-rising songs first', () => {
  const recent = trendingScore(signalsFor(3), { queryCount: 4, bestRank: 1, musicTrust: 1 });
  const old = trendingScore(signalsFor(2000), { queryCount: 4, bestRank: 1, musicTrust: 1 });
  assert.ok(recent.score > old.score, `${recent.score} > ${old.score}`);
  assert.ok(old.score < 5, `old track is gated near zero, got ${old.score}`);
});

check('cross-query presence raises a trending score', () => {
  const many = trendingScore(signalsFor(10), { queryCount: 5, bestRank: 5, musicTrust: 0.5 });
  const few = trendingScore(signalsFor(10), { queryCount: 1, bestRank: 5, musicTrust: 0.5 });
  assert.ok(many.score > few.score);
});

check('the trending score stays within 0..100', () => {
  const best = trendingScore(signalsFor(0, { views: 5e8, likes: 5e7 }), {
    queryCount: 8, bestRank: 1, musicTrust: 1,
  });
  assert.ok(best.score <= 100 && best.score >= 0, `${best.score}`);
});

check('latest ranking is driven by release recency', () => {
  const fresh = latestScore(signalsFor(2), { queryCount: 2, bestRank: 2, musicTrust: 1 });
  const old = latestScore(signalsFor(900), { queryCount: 2, bestRank: 2, musicTrust: 1 });
  assert.ok(fresh.score > old.score);
  assert.ok(old.score < 5, `ancient release gated, got ${old.score}`);
});

check('trending and latest are genuinely different concepts', () => {
  // A widely-surfaced song that is past the trending window: it should still
  // carry some "release" value but almost no "currently trending" value.
  const older = signalsFor(400);
  const t = trendingScore(older, { queryCount: 4, bestRank: 1, musicTrust: 1 });
  const l = latestScore(older, { queryCount: 4, bestRank: 1, musicTrust: 1 });
  assert.notEqual(t.score, l.score, 'the two concepts score the same track differently');
  assert.ok(t.score < 5, `a 400-day-old track is not trending, got ${t.score}`);

  // A brand-new, fast-rising track is legitimately strong on both: being new AND
  // gaining attention are not mutually exclusive. The distinction is not that the
  // scores are always different, but that each ranks its own concern first.
  const fresh = signalsFor(2);
  const tf = trendingScore(fresh, { queryCount: 3, bestRank: 2, musicTrust: 1 }).score;
  const lf = latestScore(fresh, { queryCount: 3, bestRank: 2, musicTrust: 1 }).score;
  assert.ok(tf > 60 && lf > 60, `a fresh rising track scores high on both (${tf}, ${lf})`);

  // And the ordering inverts across the two concepts for a mid-age track: what is
  // still a plausible release is no longer a plausible trend.
  const mid = signalsFor(300);
  const tm = trendingScore(mid, { queryCount: 3, bestRank: 2, musicTrust: 1 }).score;
  const lm = latestScore(mid, { queryCount: 3, bestRank: 2, musicTrust: 1 }).score;
  assert.ok(lm > tm, `past the trending window, latest outranks trending (${lm} > ${tm})`);
});

check('a brand-new release ranks near the top of latest', () => {
  const fresh = latestScore(signalsFor(1), { queryCount: 3, bestRank: 1, musicTrust: 1 });
  assert.ok(fresh.score > 60, `expected a high latest score, got ${fresh.score}`);
});

check('cross-query and rank scores are bounded', () => {
  assert.equal(crossQueryScore(0), 0);
  assert.equal(crossQueryScore(4), 1);
  assert.equal(crossQueryScore(50), 1, 'saturates rather than growing unbounded');
  assert.equal(searchRankScore(1), 1);
  assert.equal(searchRankScore(30), 0);
});

check('music confidence is bounded and rewards distributor signals', () => {
  assert.ok(musicConfidence({}, { isTopic: false, markers: [] }) <= 0.2);
  assert.ok(musicConfidence({}, { isTopic: true, markers: ['auto_generated'] }) >= 0.5);
});

// ---------------------------------------------------------------- quality

check('Topic channels are recognised', () => {
  assert.equal(isTopicChannel('Sugar Bwai - Topic'), true);
  assert.equal(isTopicChannel('Aneesh Poojari'), false);
});

check('Shorts are rejected', () => {
  assert.equal(assessQuality({ duration: 30, isShortsEligible: true, title: 'Song' }).ok, false);
  assert.equal(assessQuality({ duration: 45, channel: 'Someone' }).ok, false);
  assert.equal(assessQuality({ duration: 45, channel: 'X - Topic' }).ok, true, 'a Topic master is trusted');
});

check('a full-length track survives', () => {
  const v = assessQuality({
    duration: 210,
    title: 'Song Name',
    artist: 'Artist',
    channel: 'Artist - Topic',
    category: 'Music',
    isShortsEligible: false,
  });
  assert.equal(v.ok, true);
});

check('title keywords alone do not delete a track with music metadata', () => {
  // The spec explicitly warns against blind title filtering: a real song can be
  // called "Mashup" or "Tribute".
  const v = assessQuality({
    duration: 200,
    title: 'Mashup of My Feelings',
    channel: 'Some Artist - Topic',
    category: 'Music',
    isShortsEligible: false,
  });
  assert.equal(v.ok, true, 'kept because the channel and category corroborate it');
});

check('a lyrics channel is rejected', () => {
  const v = assessQuality({
    duration: 200,
    title: 'Some Song',
    channel: 'Lyrics Master',
    category: 'Film & Animation',
    isShortsEligible: false,
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'non_music_channel');
});

check('live streams are rejected', () => {
  assert.equal(assessQuality({ duration: 3600, isLive: true }).ok, false);
});

check('release evidence spots distributor markers', () => {
  const e = releaseEvidence({
    description: 'Provided to YouTube by DistroKid\nReleased on: 2026-01-02\nAuto-generated by YouTube',
    channel: 'X - Topic',
  });
  assert.ok(e.markers.includes('distributor_delivery'));
  assert.ok(e.markers.includes('released_on_stated'));
  assert.ok(e.markers.includes('auto_generated'));
  assert.equal(e.isTopic, true);
});

check('dates are accepted as ISO strings as well as Date objects', () => {
  // Regression guard. The canonical track shape stores dates as ISO strings,
  // because those survive JSON and a Date does not. The release-evidence path
  // used to call `.getTime()` on them directly, which threw and failed the entire
  // discovery request — the homepage returned an error rather than a shelf.
  const asStrings = releaseEvidence({
    uploadDate: '2026-10-01T00:00:00.000Z',
    releaseDate: '2026-09-01T00:00:00.000Z',
  });
  assert.equal(asStrings.uploadLagDays, 30, 'string dates produce the same lag');

  const asDates = releaseEvidence({
    uploadDate: daysAgo(30),
    releaseDate: daysAgo(60),
  });
  assert.equal(asDates.uploadLagDays, 30, 'Date objects still work');

  assert.equal(releaseEvidence({ uploadDate: null, releaseDate: null }).uploadLagDays, null);
});

check('an ISO string date is scored for freshness', () => {
  const signals = freshnessSignals(
    { title: 'S', artist: 'A', uploadDate: daysAgo(5).toISOString(), releaseDate: daysAgo(6).toISOString(), viewCount: 500000, likeCount: 20000 },
    { markers: [], isTopic: true, uploadLagDays: 1 },
    NOW
  );
  assert.ok(Number.isFinite(signals.ageInDays), 'age computed from an ISO string');
  assert.equal(Math.round(signals.ageInDays), 5);
});

// ---------------------------------------------------------------- pooling

check('identity keys collapse re-uploads of the same song', () => {
  const a = identityKey({ title: 'Malare (From Moonnam Pakkam)', artist: 'Shakthisree Gopinanth' });
  const b = identityKey({ title: 'Malare - Moonnam Pakkam', artist: 'Shakthisree Gopinanth' });
  assert.equal(a, b, 'same recording, different punctuation');
});

check('identity keys keep different songs apart', () => {
  const a = identityKey({ title: 'Ente Vaa Moocham', artist: 'Anwar Assalam' });
  const b = identityKey({ title: 'Manjalprasaadikkam', artist: 'Anwar Assalam' });
  assert.notEqual(a, b);
});

check('a track found by several queries keeps its provenance', () => {
  const track = (id, title) => ({ id, title, artist: 'A', album: '', playCount: 100 });
  const pooled = poolCandidates([
    { query: 'q1', tracks: [track('1', 'One'), track('2', 'Two')] },
    { query: 'q2', tracks: [track('1', 'One')] },
    { query: 'q3', tracks: [track('1', 'One'), track('2', 'Two')] },
  ]);

  const one = pooled.find((p) => p.id === '1');
  assert.equal(pooled.length, 2, 'de-duplicated by video id');
  assert.equal(one.queryCount, 3, 'counted once per query');
  assert.equal(one.discoverySources.length, 3);
  assert.deepEqual(one.discoverySources.sort(), ['q1', 'q2', 'q3']);
});

check('a repeated video inside one query is counted once', () => {
  const track = (id) => ({ id, title: 'One', artist: 'A', album: '', playCount: 1 });
  const pooled = poolCandidates([
    { query: 'q1', tracks: [track('1'), track('1'), track('1')] },
  ]);
  assert.equal(pooled[0].queryCount, 1, 'not inflated by repeats within a query');
});

// ---------------------------------------------------------------- diversity

check('an artist cap defers rather than deletes', () => {
  const ranked = [
    { id: '1', artist: 'A', score: 100 },
    { id: '2', artist: 'A', score: 99 },
    { id: '3', artist: 'A', score: 98 },
    { id: '4', artist: 'B', score: 97 },
  ];
  const out = applyArtistDiversity(ranked, { maxPerArtist: 2 });
  assert.equal(out.length, 4, 'nothing is dropped');
  assert.deepEqual(out.slice(0, 3).map((t) => t.id), ['1', '2', '4'], 'third A is deferred');
});

check('the artist cap still fills a shelf when one artist dominates', () => {
  const ranked = Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, artist: 'Same', score: 100 - i }));
  assert.equal(applyArtistDiversity(ranked, { maxPerArtist: 2 }).length, 8);
});

check('collaborators do not consume the lead artist quota', () => {
  const ranked = [
    { id: '1', artist: 'Lead & Guest', score: 10 },
    { id: '2', artist: 'Lead, Guest', score: 9 },
    { id: '3', artist: 'Lead & Other', score: 8 },
  ];
  const out = applyArtistDiversity(ranked, { maxPerArtist: 2 });
  assert.deepEqual(out.slice(0, 3).map((t) => t.id), ['1', '2', '3']);
});

check('repetition demotes but never excludes', () => {
  resetRepetition();
  assert.equal(repetitionMultiplier('fresh'), 1);
  markShown(['hot']);
  const once = repetitionMultiplier('hot', Date.now());
  for (let i = 0; i < 10; i += 1) markShown(['hot']);
  const many = repetitionMultiplier('hot', Date.now());
  assert.ok(once < 1 && once > 0.9, `once: ${once}`);
  assert.ok(many < once, 'more showings means a lower multiplier');
  assert.ok(many >= 0.7, 'but never fully excluded');
});

check('repetition decays as time passes', () => {
  resetRepetition();
  markShown(['x']);
  const now = Date.now();
  const later = now + 6 * 3600000 + 1000; // past the window
  assert.equal(repetitionMultiplier('x', later), 1, 'the penalty expires');
});

// ---------------------------------------------------------------- cache

check('a fresh cache entry is served without calling the producer', async () => {
  swrcache.clear();
  let calls = 0;
  const producer = async () => { calls += 1; return { value: calls }; };
  const opts = { ttlMs: 1000, staleGraceMs: 1000 };

  const a = await swrcache.cached('t', { k: 1 }, producer, opts);
  const b = await swrcache.cached('t', { k: 1 }, producer, opts);
  assert.equal(calls, 1, 'producer ran once');
  assert.equal(a.value, b.value);
  assert.equal(b.stale, false);
});

check('an expired entry is served stale while refreshing in the background', async () => {
  swrcache.clear();
  let calls = 0;
  const producer = async () => { calls += 1; await new Promise((r) => setTimeout(r, 30)); return { value: calls }; };
  const opts = { ttlMs: 1, staleGraceMs: 10000 };

  await swrcache.cached('t', { k: 2 }, producer, opts);
  await new Promise((r) => setTimeout(r, 20));

  const stale = await swrcache.cached('t', { k: 2 }, producer, opts);
  assert.equal(stale.stale, true, 'served immediately as stale');
  assert.equal(stale.refreshing, true, 'refresh happens behind the caller');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(calls, 2, 'the background refresh did run');
});

check('concurrent cold reads share one producer run', async () => {
  swrcache.clear();
  let calls = 0;
  const producer = async () => { calls += 1; await new Promise((r) => setTimeout(r, 40)); return { v: calls }; };
  const opts = { ttlMs: 1000, staleGraceMs: 1000 };

  await Promise.all([
    swrcache.cached('t', { k: 3 }, producer, opts),
    swrcache.cached('t', { k: 3 }, producer, opts),
    swrcache.cached('t', { k: 3 }, producer, opts),
  ]);
  assert.equal(calls, 1, 'three concurrent requests, one discovery run');
});

check('different cache keys do not collide', async () => {
  swrcache.clear();
  let calls = 0;
  const producer = async () => { calls += 1; return { v: calls }; };
  const opts = { ttlMs: 1000, staleGraceMs: 1000 };

  await swrcache.cached('t', { scope: 'global' }, producer, opts);
  await swrcache.cached('t', { scope: 'ml' }, producer, opts);
  assert.equal(calls, 2, 'per-scope entries are distinct');
});

check('a failed refresh falls back to the cached value', async () => {
  swrcache.clear();
  let shouldFail = false;
  const producer = async () => {
    if (shouldFail) throw new Error('upstream down');
    return { v: 'good' };
  };
  const opts = { ttlMs: 1, staleGraceMs: 10000 };

  await swrcache.cached('t', { k: 4 }, producer, opts);
  await new Promise((r) => setTimeout(r, 10));
  shouldFail = true;

  const result = await swrcache.cached('t', { k: 4 }, producer, opts);
  assert.equal(result.value.v, 'good', 'still serves the last good shelf');
});

check('trending TTL is shorter than the catalog TTL', () => {
  assert.ok(swrcache.TTL.trending < swrcache.TTL.catalog);
  assert.ok(swrcache.TTL.latest < swrcache.TTL.catalog);
});

check('the trending window is shorter than the release window', () => {
  assert.ok(trendingWindowDays() < releaseWindowDays());
});

// ---------------------------------------------------------------- calendar

check('calendar reports the ISO week of a date', () => {
  const c = calendar(new Date('2026-10-02T00:00:00Z'));
  assert.equal(c.year, 2026);
  assert.equal(c.month, 'October');
  assert.ok(Number.isInteger(c.week) && c.week > 0 && c.week <= 53);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);