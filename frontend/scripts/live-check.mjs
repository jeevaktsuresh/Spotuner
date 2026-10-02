/**
 * Live smoke check against the running backend.
 *
 * Confirms the recommender produces differentiated cards from real catalogue
 * data rather than only from fixtures. Run with the backend on port 3001.
 */
import { generateCards, fillColdStartCards } from '../src/recommend/index.js';

const res = await fetch('http://localhost:3001/api/shelves?limit=8');
const shelves = await res.json();
console.log('shelves:', shelves.length, '| tracks:', shelves.reduce((n, s) => n + (s.tracks?.length ?? 0), 0));

const all = shelves.flatMap(s => s.tracks ?? []);

// Malayalam tracks are identified by the backend's language verdict, not by
// script. Most Malayalam titles on YouTube are romanized — "Asalayavale",
// "Kanneerppoovinte" — so counting native-script titles badly undercounts the
// language and, worse, made this check assert something false.
const byLanguage = (code) => all.filter(t => t.language === code);
const ml = byLanguage('ml');

const scriptPresent = all.filter(t => /[\u0D00-\u0D7F]/.test(t.title)).length;
console.log(
  `malayalam (by language field): ${ml.length} | ` +
  `native-script titles: ${scriptPresent} | other: ${all.length - ml.length}`
);

const now = Date.now();
// A simulated listener: heavy Malayalam plays, two likes, some skips.
const history = ml.slice(0, 5).flatMap((t, i) => [
  { ...t, playCount: 4, skipCount: 0, completionRate: 0.95, liked: i < 2, lastPlayedAt: now - 3600e3 },
  { ...t, playCount: 2, skipCount: 1, completionRate: 0.4, liked: false, lastPlayedAt: now - 7200e3 },
]);
const likedSongs = ml.slice(0, 2).map(t => ({ ...t, likedAt: now }));

const { cards, profile, catalogue } = generateCards({ shelves, history, likedSongs });
const filled = fillColdStartCards({ cards, catalogue, profile });

console.log('tier:', profile.level.tier, '| plays:', profile.totals.plays, '| liked:', profile.totals.liked);
console.log('');

for (const c of filled) {
  console.log(`${c.card.padEnd(12)} ${String(c.count).padStart(2)} songs  [${c.tier}]  ${c.subtitle}`);
  for (const s of c.songs.slice(0, 3)) {
    console.log(`    ${(s.score ?? 0).toFixed(1).padStart(5)}  ${(s.title ?? '').slice(0, 32).padEnd(34)} ${s.reason}`);
  }
}

const sigs = filled.filter(c => c.count).map(c => c.songs.map(s => s.id).join(','));
console.log('');
console.log('distinct card outputs:', new Set(sigs).size, 'of', sigs.length);

// The Malayalam card must contain only tracks the backend classified as `ml`.
// This asserts the real invariant — the constraint card filters on the API's
// language verdict — rather than on title script, which romanized Malayalam
// titles do not carry and which would flag correct results as leaks.
const mlCard = filled.find(c => c.key === 'malayalam');
const wrongLanguage = mlCard.songs.filter(
  (s) => s.track && s.track.language && s.track.language !== 'ml'
);

console.log('malayalam card wrong-language tracks:', wrongLanguage.length);

if (wrongLanguage.length > 0) {
  for (const s of wrongLanguage) {
    console.log(`    LEAK ${s.track.language} ${s.track.title}`);
  }
  console.log('\nFAIL: the Malayalam card contains non-Malayalam tracks');
  process.exitCode = 1;
} else {
  console.log('ok   every Malayalam card track is backend-classified as ml');
}
