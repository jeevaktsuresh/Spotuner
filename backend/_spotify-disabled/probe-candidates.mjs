/**
 * Diagnostic: show what YouTube search returns for a query, with the resolver's
 * score for each candidate.
 *
 * Used to investigate a weak match rather than to assert behaviour. It prints
 * raw candidates so it can be judged by eye.
 *
 * Run: node scripts/probe-candidates.mjs "query"
 */
import * as youtube from '../lib/youtube.js';
import { scoreCandidate } from '../lib/audioResolver.js';

const query = process.argv[2] || 'Udi Udi Sujith Mohan';

// The track being resolved. Passed as "title|artist|duration".
const spec = process.argv[3] || 'ഉദി ഉദി|Sujith Mohan|251';
const [title, artist, duration] = spec.split('|');
const track = { title, artist, duration: Number(duration) || 0 };

const candidates = await youtube.search(query, 8);

console.log(`query : ${query}`);
console.log(`track : ${track.title} by ${track.artist} (${track.duration}s)`);
console.log(`candidates: ${candidates.length}\n`);

for (const candidate of candidates) {
  console.log(`  ${scoreCandidate(track, candidate).toFixed(2)}  ${candidate.title}`);
  console.log(`        ${candidate.artist}  (${candidate.duration}s)`);
}
