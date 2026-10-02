/**
 * Inspect the raw MusicBrainz response shape.
 *
 * Guessing at field names produced a wrong release selection that unit tests
 * could not catch, because they used hand-written fixtures. This prints the real
 * payload so the selection logic is written against the actual schema.
 *
 * Run: node scripts/probe-mb-shape.mjs
 */
import axios from 'axios';

const http = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Spotuner/1.0 ( https://github.com/spotuner ; shape probe )',
    Accept: 'application/json',
  },
});

const QUERY = 'recording:"Shape of You" AND artist:"Ed Sheeran"';

const { data } = await http.get('https://musicbrainz.org/ws/2/recording', {
  params: { query: QUERY, fmt: 'json', limit: 1, inc: 'releases+artist-credits+tags' },
});

const recording = data.recordings?.[0];

if (!recording) {
  console.log('no recording returned');
  process.exit(0);
}

console.log('recording keys:', Object.keys(recording).join(', '));
console.log('title:', recording.title);
console.log('first-release-date:', recording['first-release-date'] ?? '(absent)');
console.log('isrcs:', (recording.isrcs ?? []).join(', ') || '(none)');
console.log('releases:', recording.releases?.length ?? 0);
console.log('');

for (const release of recording.releases ?? []) {
  // Printed in full because the field set turned out to be much narrower than
  // documented: `inc=releases` yields only `title` and `status`, so release-level
  // date and type filtering is simply not available.
  console.log('  release keys:', Object.keys(release).join(', '));
  console.log('  ', JSON.stringify(release));
}