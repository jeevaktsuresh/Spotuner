/**
 * Probe exactly which ranking signals InnerTube actually exposes.
 *
 * The scoring design depends on real fields, so this dumps the shapes rather
 * than assuming them. Run: node scripts/probe-metadata.mjs
 */
import axios from 'axios';

const INNERTUBE = 'https://music.youtube.com/youtubei/v1';
const KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const CLIENT = { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'en', gl: 'IN' };

// Discovery metadata uses the plain WEB client, not WEB_REMIX. The remix client
// returns no microformat at all, which is why an earlier probe found no dates.
const META_CLIENT = { clientName: 'WEB', clientVersion: '2.20240726.00.00', hl: 'en', gl: 'IN' };

const SONG_PARAMS = 'EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D';

const isTopic = (channel) => /\s-\sTopic$/i.test(String(channel || '').trim());

const http = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    Origin: 'https://music.youtube.com',
    'Accept-Language': 'en',
  },
});

function collectStrings(node, out = [], depth = 0) {
  if (depth > 14 || node === null || node === undefined) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const n of node) collectStrings(n, out, depth + 1);
    return out;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) collectStrings(v, out, depth + 1);
  }
  return out;
}

// --- 1. Search: does it expose views / upload hints? ---
console.log('===== SEARCH SHAPE =====');
const { data: searchData } = await http.post(`${INNERTUBE}/search?alt=json&key=${KEY}`, {
  context: { client: CLIENT },
  query: 'trending songs 2026',
  params: SONG_PARAMS,
});

const tabs = searchData?.contents?.tabbedSearchResultsRenderer?.tabs ?? [];
let items = [];
for (const tab of tabs) {
  const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents;
  for (const section of sections ?? []) {
    const list = section?.musicShelfRenderer?.contents;
    if (Array.isArray(list) && list.length > 0) items = list;
  }
}
console.log('items returned:', items.length);

// Results are wrapped in musicResponsiveListItemRenderer; unwrap before reading.
const normalized = items.map((i) => i?.musicResponsiveListItemRenderer).filter(Boolean);
console.log('normalized items:', normalized.length);
console.log('columns per item (first):', normalized[0]?.flexColumns?.length);
console.log('\nall metadata columns (index 1+) of first 8 items:');
for (const it of normalized.slice(0, 8)) {
  for (let c = 1; c < (it.flexColumns?.length ?? 0); c++) {
    const runs = it?.flexColumns?.[c]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
    console.log(`  col${c}: ${JSON.stringify(runs.map((r) => r.text))}`);
  }
}
const allText = collectStrings(normalized);
console.log('\nview/play counts found in search:', allText.filter((t) => /\d[\d.,]*\s*(views|plays|listeners)/i.test(t)).slice(0, 10));
console.log('NOTE: search carries NO publish date. Dates come from the /player microformat below.');

// --- 2. Player: the metadata source used by discovery ---
console.log('\n===== PLAYER SHAPE (source of all freshness signals) =====');
const videoIds = normalized.slice(0, 4).map((i) => i?.playlistItemData?.videoId).filter(Boolean);
console.log('probing video ids:', videoIds.join(', ') || '(none)');

for (const videoId of videoIds) {
  const { data: player } = await http.post(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
    context: { client: META_CLIENT },
    videoId,
  });

  const vd = player?.videoDetails ?? {};
  const mf = player?.microformat?.playerMicroformatRenderer ?? {};
  const description = mf.description?.simpleText ?? mf.description?.runs?.map((r) => r.text).join('') ?? '';
  const releasedOn = String(description).match(/Released on:\s*(\d{4}-\d{2}-\d{2})/i);

  console.log(`\n${videoId}`);
  console.log('  title          :', vd.title);
  console.log('  channel        :', mf.ownerChannelName || vd.author, isTopic(mf.ownerChannelName || vd.author) ? '(Topic channel)' : '');
  console.log('  viewCount      :', vd.viewCount);
  console.log('  likeCount      :', mf.likeCount);
  console.log('  uploadDate     :', mf.uploadDate);
  console.log('  category       :', mf.category);
  console.log('  lengthSeconds  :', vd.lengthSeconds);
  console.log('  isShortsEligible:', mf.isShortsEligible);
  console.log('  releasedOn     :', releasedOn ? releasedOn[1] : '(not stated)');
  console.log('  description    :', description ? `${description.length} chars` : '(none)');
}