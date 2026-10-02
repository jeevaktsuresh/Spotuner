/**
 * Show every candidate MusicBrainz returns for a query, with the gates applied.
 *
 * Needed because two plausible implementations behaved differently on the same
 * query — one accepting a live album's release, one rejecting everything — and
 * neither could be judged correct without seeing the candidates and the reasons.
 *
 * Run: node scripts/probe-mb-candidates.mjs [title] [artist]
 */
import axios from 'axios';
import { titleSimilarity } from '../lib/metadata/normalize.js';
import { variantMarkers } from '../lib/metadata/identity.js';

const title = process.argv[2] ?? 'Blinding Lights';
const artist = process.argv[3] ?? 'The Weeknd';

const http = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Spotuner/1.0 ( https://github.com/spotuner ; candidates probe )',
    Accept: 'application/json',
  },
});

const query = `recording:"${title}" AND artist:"${artist}"`;
const { data } = await http.get('https://musicbrainz.org/ws/2/recording', {
  params: { query, fmt: 'json', limit: 5, inc: 'releases+artist-credits+tags' },
});

console.log(`query: ${query}\n`);

const queryVariants = new Set(variantMarkers(title));
console.log('query variant markers:', [...queryVariants].join(',') || '(none)');
console.log('');

for (const rec of data.recordings ?? []) {
  const credits = (rec['artist-credit'] ?? [])
    .map((c) => (typeof c?.name === 'string' ? c.name : c?.artist?.name ?? ''))
    .filter(Boolean)
    .join(' & ');

  const candidateVariants = variantMarkers(`${rec.title} ${rec.disambiguation ?? ''}`);
  const simT = titleSimilarity(rec.title, title);
  const simA = titleSimilarity(credits, artist);
  const extraVariant = candidateVariants.filter((v) => !queryVariants.has(v));

  const groups = (rec.releases ?? []).map((r) => {
    const g = r['release-group'] ?? {};
    return `${g['primary-type'] ?? '?'}${g['secondary-types']?.length ? '+' + g['secondary-types'].join(',') : ''}`;
  });

  console.log(`title       : ${rec.title}`);
  console.log(`  disambig  : ${rec.disambiguation ?? '(none)'}`);
  console.log(`  artist    : ${credits || '(none)'}`);
  console.log(`  score     : ${rec.score}  len=${rec.length ?? '-'}`);
  console.log(`  isrcs     : ${(rec.isrcs ?? []).join(', ') || '(none)'}`);
  console.log(`  first-rel : ${rec['first-release-date'] ?? '(none)'}`);
  console.log(`  releases  : ${(rec.releases ?? []).map((r) => r.title).join(' | ') || '(none)'}`);
  console.log(`  r-group   : ${groups.join(' | ') || '(none)'}`);
  console.log(`  GATE title: ${simT.toFixed(2)} ${simT >= 0.75 ? 'PASS' : 'REJECT'}`);
  console.log(`  GATE art  : ${simA.toFixed(2)} ${!credits || simA >= 0.6 ? 'PASS' : 'REJECT'}`);
  console.log(`  GATE var  : ${extraVariant.join(',') || 'none'} ${extraVariant.length ? 'REJECT' : 'PASS'}`);
  console.log('');
}