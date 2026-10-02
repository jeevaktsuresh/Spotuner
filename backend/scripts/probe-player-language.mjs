/**
 * Probe: what language signal, if any, does the InnerTube *player* endpoint
 * expose for a video?
 *
 * Search returns nothing, but the player response carries caption tracklists
 * and microformat data, which can reveal the spoken language without a YouTube
 * Data API key. Caption languages in particular are a real (if sometimes empty)
 * signal for regional music.
 *
 * Run: node scripts/probe-player-language.mjs <videoId> [...]
 */
const INNERTUBE = 'https://music.youtube.com/youtubei/v1';
const KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20250101.01.00',
  hl: 'en',
  gl: 'US',
};

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage: node scripts/probe-player-language.mjs <videoId> [...]');
  process.exit(1);
}

for (const id of ids) {
  const response = await fetch(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: { client: CLIENT },
      videoId: id,
    }),
  });

  const data = await response.json();

  const videoDetails = data?.videoDetails || {};
  const microformat = data?.microformat?.playerMicroformatRenderer || {};
  const captions =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  console.log(`\n=== ${id} (HTTP ${response.status}) ===`);
  console.log(`  title       : ${videoDetails.title}`);
  console.log(`  author      : ${videoDetails.author}`);
  console.log(`  videoDetails.language? ${JSON.stringify(videoDetails.language ?? null)}`);

  console.log(`  microformat keys: ${Object.keys(microformat).filter((k) => /lang|country|music/i.test(k)).join(', ') || '(none)'}`);
  for (const key of ['language', 'availableCountries', 'musicEntityType', 'isFamilySafe']) {
    if (key in microformat) {
      console.log(`    ${key} = ${JSON.stringify(microformat[key]).slice(0, 160)}`);
    }
  }

  console.log(`  captionTracks: ${captions.length}`);
  for (const track of captions.slice(0, 6)) {
    console.log(`    ${track.languageCode}  kind=${track.kind}  vssId=${track.vssId}`);
  }

  const hits = new Map();
  (function walk(node, path, depth) {
    if (!node || typeof node !== 'object' || depth > 10) return;
    for (const [key, value] of Object.entries(node)) {
      const next = `${path}.${key}`;
      if (/lang/i.test(key)) hits.set(next, JSON.stringify(value).slice(0, 100));
      if (value && typeof value === 'object') walk(value, next, depth + 1);
    }
  })(data, '', 0);

  console.log(`  all lang-ish keys: ${hits.size}`);
  for (const [path, value] of hits) console.log(`    ${path} = ${value}`);
}
