/**
 * Probe: two candidate sources for a real artist image.
 *
 *   A. YouTube InnerTube WEB search — look for a channel shelf in any of the
 *      current renderer shapes (channelRenderer, lockupViewModel, and the
 *      channelThumbnailWithLinkRenderer that actually showed up).
 *   B. iTunes Search API — keyless, returns a real artist image for well-known
 *      acts. Treated as a fallback, not the primary.
 *
 * Run: node scripts/probe-artist-image2.mjs
 */
import axios from 'axios';

const http = axios.create({
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    Origin: 'https://www.youtube.com',
  },
});

const CLIENT = { clientName: 'WEB', clientVersion: '2.20240726.00.00', hl: 'en', gl: 'US' };

/** Best (largest) thumbnail URL from an InnerTube thumbnails array. */
function bestThumb(thumbnails) {
  if (!Array.isArray(thumbnails)) return null;
  const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

function textOf(t) {
  if (!t) return null;
  if (typeof t.simpleText === 'string') return t.simpleText;
  if (Array.isArray(t.runs)) return t.runs.map((r) => r.text).join('');
  return null;
}

/** Any avatar-looking thumbnail anywhere in a renderer subtree. */
function findAvatars(node, out = [], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 30) return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'thumbnails' && Array.isArray(v)) {
      const url = bestThumb(v);
      if (url) out.push(url);
    }
    if (v && typeof v === 'object') findAvatars(v, out, depth + 1);
  }
  return out;
}

/** Pull lockupViewModel-style channel results, the current YouTube format. */
function findLockups(data) {
  const out = [];
  (function walk(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 40) return;
    if (node.lockupViewModel) {
      const l = node.lockupViewModel;
      out.push({
        contentId: l.contentId,
        title: textOf(l.metadata?.lockupMetadataViewModel?.title),
        avatar: bestThumb(l.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel
            ?.avatar?.image?.sources),
      });
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') walk(v, depth + 1);
    }
  })(data);
  return out;
}

const NAMES = ['Anirudh Ravichander', 'Arijit Singh', 'Adele', 'M.G. Sreekumar', 'Karan Aujla'];

console.log('=== A. YouTube InnerTube WEB search ===');
for (const name of NAMES) {
  let data;
  try {
    const res = await http.post('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      context: { client: CLIENT },
      query: name,
    });
    data = res.data;
  } catch (e) {
    console.log(`${name.padEnd(22)} FAILED ${e.message}`);
    continue;
  }
  const lockups = findLockups(data);
  const avatars = findAvatars(data);
  console.log(`${name.padEnd(22)} lockups=${lockups.length} thumbnails=${avatars.length}`);
  if (lockups.length > 0) {
    // Dump one real lockup so the correct avatar path can be read off the shape.
    const sample = data.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents?.[0];
    console.log('     sample section keys:', JSON.stringify(Object.keys(sample ?? {})));
  }
  for (const l of lockups.slice(0, 3)) {
    console.log(`     lockup ${JSON.stringify(l.title)} -> ${l.avatar ?? 'NO AVATAR'}`);
  }
  if (avatars[0]) console.log(`     first thumb: ${avatars[0]}`);
  await new Promise((r) => setTimeout(r, 1200)); // stay under the 403 threshold
}

console.log('');
console.log('=== B. iTunes Search API ===');
for (const name of NAMES) {
  try {
    const s = await axios.get('https://itunes.apple.com/search', {
      params: { term: name, entity: 'musicArtist', limit: 3 },
      timeout: 15000,
    });
    const hits = s.data?.results ?? [];
    if (hits.length === 0) {
      console.log(`${name.padEnd(22)} no artist hit`);
      continue;
    }
    const exact =
      hits.find((h) => h.artistName?.toLowerCase() === name.toLowerCase()) ?? hits[0];
    const l = await axios.get('https://itunes.apple.com/lookup', {
      params: { id: exact.artistId, entity: 'album', limit: 25 },
      timeout: 15000,
    });
    // The artist entity itself comes back first and has no artwork, so take the
    // first result that actually carries an image.
    const withArt = (l.data?.results ?? []).find((r) => r.artworkUrl100);
    const img = withArt?.artworkUrl100;
    const up = img ? img.replace('100x100bb', '512x512bb') : null;
    console.log(
      `${name.padEnd(22)} matched=${JSON.stringify(exact.artistName)} ` +
        `via=${withArt?.collectionName ?? '-'} img=${up ?? 'NONE'}`
    );
  } catch (e) {
    console.log(`${name.padEnd(22)} FAILED ${e.message}`);
  }
}
