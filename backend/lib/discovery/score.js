/**
 * Discovery scoring.
 *
 * Two separate scores, deliberately not sharing a ranking:
 *
 *   trendingScore  attention *right now*  — velocity-weighted, cross-query
 *                  corroborated, moderate recency decay.
 *   latestScore    genuine *new releases* — release-date weighted, with an
 *                  explicit new-release verdict doing most of the work.
 *
 * A track can legitimately score 88 trending and 12 latest (a breakout old
 * song), or 30 trending and 95 latest (released last Tuesday, nobody has
 * noticed yet). Collapsing these into one number is what makes a "latest"
 * shelf fill with old hits.
 *
 * Weights are exported so they can be reported by the status route and tuned
 * without reading the scoring code.
 */

import { DECAY } from './freshness.js';

export { trendingWindowDays } from './freshness.js';

export const TRENDING_WEIGHTS = {
  crossQuery: 25,
  searchRank: 15,
  velocity: 25,
  engagement: 12,
  recency: 13,
  musicConfidence: 10,
};

export const LATEST_WEIGHTS = {
  releaseRecency: 30,
  newRelease: 28,
  crossQuery: 14,
  searchRank: 10,
  musicConfidence: 10,
  velocity: 8,
};

/**
 * How strongly appearing across independent queries should count.
 *
 * Normalised against a soft target rather than the raw query count, so adding
 * more queries keeps improving coverage without permanently inflating scores.
 * `min(1, count / target)` with a target of 4: a track found by four or more
 * queries is fully credited.
 */
const CROSS_QUERY_TARGET = 4;

/**
 * How much confidence we have this is a real released track, 0..1.
 *
 * Built from distributor signals rather than title keywords, because those are
 * structural facts about the upload rather than guesses about the text.
 */
export function musicConfidence(track, evidence) {
  let score = 0;

  if (evidence.isTopic) score += 0.5;
  if (evidence.markers.includes('auto_generated')) score += 0.2;
  if (evidence.markers.includes('distributor_delivery')) score += 0.15;
  if (String(track.category || '').toLowerCase().includes('music')) score += 0.2;
  if (track.releaseDate) score += 0.15;

  return Math.max(0, Math.min(1, score));
}

/**
 * YouTube's own ordering, normalised so rank 1 scores 1 and rank 30 scores 0.
 *
 * This is the one relevance signal the platform gives us directly, so it is
 * worth keeping as its own term rather than folding into other scores.
 */
export function searchRankScore(bestRank, poolSize = 30) {
  if (!Number.isFinite(bestRank) || bestRank < 1) return 0;
  return Math.max(0, 1 - (bestRank - 1) / Math.max(poolSize - 1, 1));
}

/** Cross-query presence, normalised against a soft target. */
export function crossQueryScore(queryCount) {
  if (!Number.isFinite(queryCount) || queryCount <= 0) return 0;
  return Math.min(1, queryCount / CROSS_QUERY_TARGET);
}

/**
 * Trending score, 0..100.
 *
 * Velocity carries real weight alongside cross-query presence, which is the
 * direct answer to "do not let lifetime view count dominate": a track's raw view
 * total only ever enters through its per-day rate.
 *
 * The final multiplication by the freshness gate is load-bearing. Without it,
 * additive terms such as cross-query presence and engagement can outvote recency
 * entirely and put nine-year-old catalogue back on a trending shelf — which is
 * exactly the bug this scoring exists to prevent, given that YouTube exposes no
 * view time-series with which to actually detect a track losing momentum.
 */
export function trendingScore(signals, context = {}) {
  const {
    queryCount = 0,
    bestRank = null,
    musicTrust = 0,
  } = context;

  const w = TRENDING_WEIGHTS;
  const parts = {
    crossQuery: w.crossQuery * crossQueryScore(queryCount),
    searchRank: w.searchRank * searchRankScore(bestRank),
    // An unmeasurable velocity contributes zero rather than a neutral 0.5,
    // because "we could not tell" is not "average".
    velocity: w.velocity * (signals.velocityForTrending ?? signals.velocity ?? 0),
    engagement: w.engagement * (signals.engagement ?? 0),
    recency: w.recency * (signals.recency ?? 0),
    musicConfidence: w.musicConfidence * musicTrust,
  };

  const base = Object.values(parts).reduce((a, b) => a + b, 0);
  const gate = signals.freshnessGate ?? 1;

  return {
    score: Math.round(base * gate * 10) / 10,
    parts: { ...parts, freshnessGate: Math.round(gate * 1000) / 1000, baseTotal: Math.round(base * 10) / 10 },
  };
}

/**
 * Latest-release score, 0..100.
 *
 * `newRelease` is a gate expressed as a weight: a track that is verifiably not a
 * new release can still reach ~35 points, which keeps genuinely new-but-unnoticed
 * music eligible while ensuring re-uploads of old songs cannot reach the top of
 * a "latest" shelf.
 *
 * The result is then multiplied by the release gate, for the same reason the
 * trending score is multiplied by the freshness gate: cross-query presence and
 * search rank carry no notion of age, so an old track that happens to be widely
 * surfaced would otherwise accumulate enough points to look current.
 */
export function latestScore(signals, context = {}) {
  const {
    queryCount = 0,
    bestRank = null,
    musicTrust = 0,
  } = context;

  const w = LATEST_WEIGHTS;
  const parts = {
    releaseRecency: w.releaseRecency * (signals.releaseRecency ?? 0),
    newRelease: w.newRelease * (signals.confidence ?? 0),
    crossQuery: w.crossQuery * crossQueryScore(queryCount),
    searchRank: w.searchRank * searchRankScore(bestRank),
    musicConfidence: w.musicConfidence * musicTrust,
    velocity: w.velocity * (signals.releaseVelocity ?? signals.velocity ?? 0),
  };

  const base = Object.values(parts).reduce((a, b) => a + b, 0);
  const gate = signals.releaseGate ?? 1;

  return {
    score: Math.round(base * gate * 10) / 10,
    parts: {
      ...parts,
      releaseGate: Math.round(gate * 1000) / 1000,
      baseTotal: Math.round(base * 10) / 10,
    },
  };
}

export { DECAY };