/**
 * Verify the two headline claims about trending vs latest.
 *
 *   1. They return meaningfully different track sets.
 *   2. "Latest" is actually fresher than "trending", and "trending" is not
 *      dominated by old catalogue.
 *
 * Also checks that the freshness gate does its job: without it, tracks from
 * years back leak into trending, which is the original bug.
 *
 * Run: node scripts/check-trending-vs-latest.mjs [languageCode|-]
 */
import * as discovery from '../lib/discovery/index.js';
import { freshnessGate } from '../lib/discovery/freshness.js';

const language = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : null;
const limit = 20;

const started = Date.now();
const [trending, latest] = await Promise.all([
  discovery.getTrendingMusic({ language, limit, refresh: true }),
  discovery.getLatestMusic({ language, limit, refresh: true }),
]);

const median = (arr) => {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const tIds = new Set(trending.tracks.map((t) => t.id));
const lIds = new Set(latest.tracks.map((t) => t.id));
const overlap = [...tIds].filter((id) => lIds.has(id));

console.log(`\n=== trending vs latest${language ? ` [${language}]` : ' [global]'} ===`);
console.log(`both runs took ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`trending: ${trending.tracks.length} tracks | latest: ${latest.tracks.length} tracks`);
console.log(`OVERLAP: ${overlap.length} shared ids (${((overlap.length / Math.max(tIds.size, 1)) * 100).toFixed(0)}% of trending)`);

const tAges = trending.tracks.map((t) => t.ageInDays);
const lAges = latest.tracks.map((t) => t.ageInDays);

console.log(`\nmedian upload age   trending=${median(tAges)?.toFixed(1)}d   latest=${median(lAges)?.toFixed(1)}d`);
console.log(`median release age  trending=${median(trending.tracks.map((t) => t.releaseAgeInDays))?.toFixed(1)}d   latest=${median(latest.tracks.map((t) => t.releaseAgeInDays))?.toFixed(1)}d`);
console.log(`new releases        trending=${trending.tracks.filter((t) => t.isNewRelease).length}   latest=${latest.tracks.filter((t) => t.isNewRelease).length}`);

// The original failure mode: old catalogue on a trending shelf.
const oldOnTrending = trending.tracks.filter((t) => Number.isFinite(t.ageInDays) && t.ageInDays > 365);
console.log(`\ntracks older than 1yr on TRENDING: ${oldOnTrending.length} ${oldOnTrending.length ? `(worst: ${Math.max(...oldOnTrending.map((t) => t.ageInDays)).toFixed(0)}d)` : ''}`);

console.log('\n--- freshness gate behaviour ---');
for (const age of [1, 30, 90, 150, 200, 365, 900, 3400]) {
  console.log(`  age ${String(age).padStart(4)}d -> gate ${freshnessGate(age).toFixed(3)}`);
}

console.log('\n--- latest top 8 ---');
for (const t of latest.tracks.slice(0, 8)) {
  console.log(`  ${String(t.latestScore).padStart(5)}  relAge=${String(t.releaseAgeInDays ?? '-').padStart(6)}d  ${t.title.slice(0, 48).padEnd(50)} ${String(t.artist).slice(0, 28)}`);
}

console.log('\n--- trending top 8 ---');
for (const t of trending.tracks.slice(0, 8)) {
  console.log(`  ${String(t.trendingScore).padStart(5)}  age=${String(t.ageInDays ?? '-').padStart(6)}d  ${t.title.slice(0, 48).padEnd(50)} ${String(t.artist).slice(0, 28)}`);
}