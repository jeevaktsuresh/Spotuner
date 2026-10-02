/**
 * Live accuracy probe for the language detector.
 *
 * Runs detection over the tracks the current shelves actually return and prints
 * the verdict per track, so accuracy can be judged by eye against known songs.
 * This is the measurement that matters: unit tests can only prove the scorer
 * does what it was told, not that the layers tell it the truth.
 *
 * Run: node scripts/probe-language.mjs [shelfId ...]
 */
import * as youtube from '../lib/youtube.js';
import { annotate, summarize } from '../lib/language/index.js';
import { setEnabled } from '../lib/language/debug.js';

// Quiet, so only the summary table shows.
setEnabled(false);

const SHELVES = [
  { id: 'malayalam', query: 'malayalam songs', language: 'ml' },
  { id: 'tamil', query: 'tamil songs', language: 'ta' },
  { id: 'hindi', query: 'hindi songs', language: 'hi' },
];

const wanted = process.argv.slice(2);
const shelves = wanted.length
  ? SHELVES.filter((s) => wanted.includes(s.id))
  : SHELVES;

const all = [];

for (const shelf of shelves) {
  const tracks = await youtube.search(shelf.query, 12);
  const annotated = await annotate(tracks, { searchContexts: [shelf.language] });
  all.push(...annotated);

  console.log(`\n=== ${shelf.id} (query: "${shelf.query}") ===`);
  for (const t of annotated) {
    const flag = t.language === shelf.language ? '  ' : t.language === 'unknown' ? ' ?' : ' XX';
    console.log(
      `${flag} ${String(t.language).padEnd(7)} ${t.languageConfidence.toFixed(2)}  ${t.title}  [${t.artist}]`,
    );
    console.log(
      `      sources=${(t.languageDetectionSource || []).join('+') || 'none'}` +
        `${t.languageConflict ? '  CONFLICT' : ''}`,
    );
  }
}

console.log('\n=== summary ===');
console.log(JSON.stringify(summarize(all), null, 2));
