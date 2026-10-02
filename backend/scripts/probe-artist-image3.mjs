/**
 * Probe: which user-agent does the iTunes Search API accept?
 *
 * This is load-bearing and counter-intuitive, so it is pinned by a test rather
 * than a comment. iTunes answers 429/403 to browser-looking agents; axios's
 * default agent is served normally. Adding a realistic Chrome UA to
 * lib/artists.js silently took coverage from 71 images to 0.
 *
 * Run: node scripts/probe-artist-image3.mjs
 */
import axios from 'axios';

const URL = 'https://itunes.apple.com/search?term=Adele&entity=musicArtist&limit=3';

const agents = [
  ['no UA header', undefined],
  [
    'browser Chrome',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  ],
  ['Spotify/1.0', 'Spotify/1.0 (iOS/16.0; Scale/3.0)'],
];

let failures = 0;

for (const [label, ua] of agents) {
  const config = { timeout: 15000 };
  if (ua) config.headers = { 'User-Agent': ua };
  try {
    const r = await axios.get(URL, config);
    console.log(`${label.padEnd(16)} HTTP ${r.status}  results=${r.data?.resultCount}`);
  } catch (e) {
    console.log(`${label.padEnd(16)} FAIL ${e.response?.status ?? e.message}`);
  }
  await new Promise((r) => setTimeout(r, 800));
}

// The production client must not send a browser UA.
const real = await axios.get(URL, { timeout: 15000, headers: { Accept: 'application/json' } });
const servedAgent = String(real.request?.res?.req?._header ?? '');
const looksLikeBrowser = /mozilla|chrome|safari/i.test(servedAgent);
if (looksLikeBrowser) {
  failures++;
  console.log(`\nFAIL production client sends a browser UA: ${servedAgent.slice(0, 80)}`);
} else {
  console.log(`\nok   production client agent is not browser-like`);
}

process.exit(failures > 0 ? 1 : 0);