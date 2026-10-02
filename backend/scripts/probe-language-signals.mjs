/**
 * Probe: scan the raw InnerTube search response for any language signal.
 *
 * Determines which layers of the language pipeline can actually be populated
 * from the source Spotuner already uses, versus which need a YouTube Data API
 * key that this project does not have.
 *
 * Run: node scripts/probe-language-signals.mjs "malayalam songs"
 */
const INNERTUBE = 'https://music.youtube.com/youtubei/v1';
const KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20250101.01.00',
  hl: 'en',
  gl: 'US',
};

const query = process.argv[2] || 'malayalam songs';

const response = await fetch(`${INNERTUBE}/search?alt=json&key=${KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: { client: CLIENT },
    query,
    params: 'EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D',
  }),
});

const data = await response.json();

const hits = new Map();
(function walk(node, path, depth) {
  if (!node || typeof node !== 'object' || depth > 12) return;
  for (const [key, value] of Object.entries(node)) {
    const next = `${path}.${key}`;
    if (/lang|globe|locale/i.test(key)) {
      hits.set(next, JSON.stringify(value).slice(0, 140));
    }
    if (value && typeof value === 'object') walk(value, next, depth + 1);
  }
})(data, '', 0);

console.log(`query    : ${query}`);
console.log(`status   : ${response.status}`);
console.log(`lang keys: ${hits.size}`);
for (const [path, value] of hits) console.log(`   ${path} = ${value}`);
