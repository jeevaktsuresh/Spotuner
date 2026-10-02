/**
 * Inspect why language-scoped discovery returns few tracks.
 *
 * Regional scopes were yielding 1-4 tracks. This separates the possible causes,
 * because they need opposite fixes:
 *   - tracks that are genuinely another language  -> classifier is correct
 *   - tracks that ARE the target language but scored unknown -> classifier gap
 *   - tracks matched but below the score floor -> freshness filtering
 *
 * Run: node scripts/diagnose-language-scope.mjs [hi|te|kn|bn]
 */
import * as youtube from '../lib/youtube.js';
import * as language from '../lib/language/index.js';
import * as metadata from '../lib/discovery/metadata.js';
import { trendingQueries } from '../lib/discovery/queries.js';
import { poolCandidates } from '../lib/discovery/pool.js';
import { assessQuality } from '../lib/discovery/quality.js';
import { freshnessSignals } from '../lib/discovery/freshness.js';
import { releaseEvidence } from '../lib/discovery/quality.js';
import { trendingScore } from '../lib/discovery/score.js';

const scope = process.argv[2] || 'hi';
const queries = trendingQueries({ language: scope });

const settled = await Promise.allSettled(queries.map((q) => youtube.search(q, 30, { region: 'IN' })));
const resultSets = settled
  .map((r, i) => (r.status === 'fulfilled' ? { query: queries[i], tracks: r.value } : null))
  .filter(Boolean);

const pooled = poolCandidates(resultSets);
const viable = pooled.filter((c) => assessQuality(c).ok).slice(0, 90);
const hydrated = await metadata.hydrate(viable, { forceRefresh: false });
const annotated = await language.annotate(hydrated, { searchContexts: [scope] });

const matched = annotated.filter((t) => t.language === scope);
const other = annotated.filter((t) => t.language !== scope && t.language !== 'unknown');
const unknown = annotated.filter((t) => t.language === 'unknown');

console.log(`\n=== scope=${scope} ===`);
console.log(`queries: ${queries.length}`);
console.log(`pooled=${pooled.length} viable=${viable.length} matched=${matched.length} otherLang=${other.length} unknown=${unknown.length}`);

// Among matched, how many would clear the score floor?
let aboveFloor = 0;
const scored = matched.map((t) => {
  const evidence = releaseEvidence(t);
  const signals = freshnessSignals(t, evidence);
  const s = trendingScore(signals, {
    queryCount: t.queryCount, bestRank: t.bestRank, musicTrust: 0.5,
  });
  if (s.score >= 12) aboveFloor += 1;
  return { title: t.title, artist: t.artist, score: s.score, age: signals.ageInDays, gate: signals.freshnessGate };
});
console.log(`matched above score floor: ${aboveFloor}/${matched.length}`);

console.log(`\n-- matched (first 10) --`);
for (const m of scored.slice(0, 10)) {
  console.log(`  ${String(m.score).padStart(5)} age=${String(m.age ?? '-').padStart(6)} gate=${String((m.gate ?? 0).toFixed(2)).padStart(5)} ${m.title.slice(0, 40).padEnd(42)} ${String(m.artist).slice(0, 30)}`);
}

console.log(`\n-- unknown (first 12): these are the classifier gap --`);
for (const t of unknown.slice(0, 12)) {
  console.log(`  ${String(t.title).slice(0, 44).padEnd(46)} ${String(t.artist).slice(0, 40)}`);
}

console.log(`\n-- genuinely another language (first 12) --`);
for (const t of other.slice(0, 12)) {
  console.log(`  ${t.language} ${String(t.title).slice(0, 40).padEnd(42)} ${String(t.artist).slice(0, 34)}`);
}