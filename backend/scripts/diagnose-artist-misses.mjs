/**
 * Are the unresolved artists a matching problem or a catalogue problem?
 *
 * 21% of the catalogue gets a real picture. Before loosening the match rule in
 * lib/artists.js, this samples the names that missed and checks what iTunes
 * actually holds for them. If the answer is "no artist entity at all", the strict
 * rule is correct and should stay; loosening it would attach the wrong picture.
 *
 * Requests are paced, because bursting gets the whole process throttled and
 * makes every miss look like a catalogue gap.
 *
 * Run: node scripts/diagnose-artist-misses.mjs
 */
import axios from 'axios';

const API = 'http://localhost:3001';

// axios's default agent is served normally; a browser UA is answered 429.
const http = axios.create({ timeout: 12000, headers: { Accept: 'application/json' } });

function fold(v) {
  return String(v ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const shelves = await (await fetch(`${API}/api/shelves?limit=10`)).json();
const tracks = shelves.flatMap((s) => s.tracks ?? []);
const names = [...new Set(tracks.flatMap((t) => (t.artist || '').split(/\s*(?:&|,)\s*/)).map((s) => s.trim()).filter(Boolean))];

// Sample across the whole list rather than the head, which is the popular end.
const step = Math.max(1, Math.floor(names.length / 40));
const sample = names.filter((_, i) => i % step === 0).slice(0, 40);

let inCatalogue = 0;
let noEntity = 0;
let blocked = 0;
const examples = [];

for (const name of sample) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const r = await http.get('https://itunes.apple.com/search', {
      params: { term: name, entity: 'musicArtist', limit: 5 },
    });
    const hits = r.data?.results ?? [];
    const exact = hits.find((h) => fold(h.artistName) === fold(name));
    if (exact) {
      inCatalogue++;
      continue;
    }
    noEntity++;
    if (examples.length < 15) {
      examples.push(`  ${name.padEnd(28)} top hit: ${hits[0]?.artistName ?? '(no artist entity)'}`);
    }
  } catch (e) {
    blocked++;
  }
}

console.log(`sampled            : ${sample.length}`);
console.log(`in iTunes catalogue: ${inCatalogue}`);
console.log(`absent from iTunes : ${noEntity}`);
console.log(`blocked            : ${blocked}`);
console.log('');
console.log('misses (why the picture is a track thumbnail):');
for (const e of examples) console.log(e);