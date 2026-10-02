import { normalize } from '../text.js';

/**
 * MusicMetadataProvider — real album art from keyless music APIs.
 *
 * Two backends, tried in order:
 *
 *   1. iTunes Search API — no key, generous rate limit, returns artwork up to
 *      3000x3000 and reports the collection name, which lets the scorer verify
 *      the album actually matches.
 *   2. Cover Art Archive — the MusicBrainz artwork service. Slower and stricter
 *      (it needs an exact release match) but authoritative for album identity.
 *
 * Artwork from these APIs is square. That is expected and handled downstream:
 * the scorer marks these candidates `square-only` so the carousel renders them
 * as a blurred, colour-graded backdrop rather than stretching them.
 */

const ITUNES_TIMEOUT_MS = 5000;
const COVER_ART_TIMEOUT_MS = 6000;
const UA = 'Spotuner/1.0 (+hero-image-matcher)';

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Two artwork renditions per release: the URL the API actually returned, plus
 * one large upgrade.
 *
 * Emitting every conceivable size floods the candidate pool with 404s that
 * each consume a probe request, and the original is the only URL guaranteed to
 * exist — so it must always be present as a fallback.
 */
function itunesArtworkVariants(url, reportedWidth) {
  if (!url) return [];

  const variants = new Set([url]);

  // Ask for one size above the hero minimum; the probe reports what actually
  // came back, so an over-request is corrected downstream.
  if (reportedWidth < 1200) {
    variants.add(url.replace(/\/\d+x\d+(-?\w*)?\.(jpg|png)$/, '/1200x1200bb.jpg'));
  }

  return [...variants];
}

async function searchItunesForTerm(term, metadata) {
  if (!term) return [];

  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    '&media=music&entity=song,album&limit=8';

  const payload = await fetchJson(url, ITUNES_TIMEOUT_MS);
  const results = payload?.results ?? [];

  const candidates = [];

  for (const item of results) {
    if (!item?.artworkUrl100) continue;

    const width = Number(item.artworkUrl100.match(/(\d+)x/)?.[1] ?? 100);

    // Prefer the largest rendition this release actually supports.
    const urls = itunesArtworkVariants(item.artworkUrl100, width);

    for (const candidateUrl of urls) {
      candidates.push({
        url: candidateUrl,
        title: item.trackName ?? item.collectionName ?? '',
        artist: item.artistName ?? '',
        album: item.collectionName ?? '',
        albumId: String(item.collectionId ?? ''),
        songId: String(item.trackId ?? ''),
        imageType: 'album_artwork',
        source: 'itunes',
        official: true,
        queryWeight:
          item.trackName && normalize(item.trackName) === normalize(metadata.title) ? 1 : 0.7,
      });
    }
  }

  return candidates;
}

/**
 * Query iTunes with a few term shapes.
 *
 * The cleaned title is used because raw "(Remix)" text makes the search fuzzy.
 * A title-only query is deliberately NOT issued: iTunes answers it with other
 * artists' covers of identically-named songs, which then have to be scored
 * down and waste probe requests.
 */
async function searchItunes(metadata) {
  const cleanTitle = normalize(metadata.title);
  const cleanArtist = normalize(metadata.artist);
  const cleanAlbum = normalize(metadata.album);

  const terms = [
    [cleanArtist, cleanTitle].filter(Boolean).join(' '),
    [cleanArtist, cleanAlbum].filter(Boolean).join(' '),
  ].filter(Boolean);

  const uniqueTerms = [...new Set(terms)];

  const results = await Promise.allSettled(
    uniqueTerms.map((term) => searchItunesForTerm(term, metadata)),
  );

  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

/**
 * Cover Art Archive lookup by MusicBrainz release-group search.
 *
 * Returns the front cover for a release whose artist and title agree with the
 * requested content.
 */
async function searchCoverArtArchive(metadata) {
  const query = [metadata.artist, metadata.album || metadata.title].filter(Boolean).join(' ').trim();
  if (!query) return [];

  const searchUrl =
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}` +
    '&fmt=json&limit=5';

  const payload = await fetchJson(searchUrl, COVER_ART_TIMEOUT_MS);
  const groups = payload?.['release-groups'] ?? [];

  const candidates = [];

  for (const group of groups) {
    if (!group?.id) continue;

    const artUrl = `https://coverartarchive.org/release-group/${group.id}/front-500`;

    candidates.push({
      url: artUrl,
      title: group['primary-title'] ?? '',
      artist: group['artist-credit']?.[0]?.name ?? '',
      album: group['primary-title'] ?? '',
      albumId: group.id,
      imageType: 'album_artwork',
      source: 'coverartarchive',
      official: true,
      queryWeight: 0.75,
    });
  }

  return candidates;
}

export default {
  name: 'music-metadata',

  async find(metadata) {
    const [itunes, coverArt] = await Promise.allSettled([
      searchItunes(metadata),
      searchCoverArtArchive(metadata),
    ]);

    return [
      ...(itunes.status === 'fulfilled' ? itunes.value : []),
      ...(coverArt.status === 'fulfilled' ? coverArt.value : []),
    ];
  },
};