import { createHttp } from './runtime/http.js';
import { envNum } from './runtime/env.js';
import * as language from './language/index.js';

/**
 * YouTube Music client built directly on the public InnerTube API.
 *
 * This replaces `node-youtube-music`, which stopped working because it hardcodes
 * `clientVersion: '0.1'` in its request context; YouTube now rejects that with a
 * 404. The response envelope changed too — search results moved from
 * `contents.tabs[]` to `contents.tabbedSearchResultsRenderer.tabs[]`.
 */

const INNERTUBE = 'https://music.youtube.com/youtubei/v1';
const KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';

// Bumped past the version that stopped being accepted. InnerTube only requires
// this to be a plausible-looking string, but stale values eventually 404 too.
const CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20250101.01.00',
  hl: 'en',
  gl: 'US',
};

// `EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D` is the search filter that scopes results to songs.
const SONG_PARAMS = 'EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D';

const http = createHttp({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    Origin: 'https://music.youtube.com',
    'Accept-Language': 'en',
  },
});

/**
 * Parse a human play/view count ("488M plays", "1.2K views") into a number.
 *
 * The third metadata column carries YouTube's own play count for most search
 * results, which is the only view signal available without paying for a Data API
 * key. Returns null when the text is absent or unparseable, so callers can tell
 * "no count" apart from "zero views".
 */
function parsePlayCount(text) {
  if (typeof text !== 'string') return null;

  const match = text.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  const scale = { k: 1e3, m: 1e6, b: 1e9 }[(match[2] || '').toLowerCase()] ?? 1;
  return Math.round(base * scale);
}

/** "4:43" | "1:02:03" -> seconds. Returns null when unparseable. */
function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;

  const parts = value.trim().split(':');
  if (!parts.length || parts.some((p) => p !== '' && Number.isNaN(Number(p)))) return null;

  return parts.reduce((total, part) => total * 60 + (Number(part) || 0), 0);
}

/**
 * Pick the largest thumbnail offered and upscale the URL.
 *
 * InnerTube only returns 60px and 120px variants, which look blurry in a card
 * grid. The size is encoded in the URL suffix (`=w120-h120-l90-rj`), so it can
 * be rewritten to request a bigger rendition of the same image.
 */
function pickThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;

  const largest = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  if (!largest?.url) return null;

  return largest.url.replace(/=w\d+-h\d+/, '=w544-h544');
}

/** Concatenate the runs of a flex column into one string. */
function readColumn(item, index) {
  const column = item.flexColumns?.[index]?.musicResponsiveListItemFlexColumnRenderer;
  const runs = column?.text?.runs;
  if (!Array.isArray(runs)) return [];
  return runs.map((run) => run.text).filter(Boolean);
}

/**
 * Parse the second metadata column into artist and album.
 *
 * The column interleaves artist, album and duration separated by "•" tokens.
 * Album used to be thrown away here, which discarded a genuinely useful signal:
 * film and album names are often native-script even when a song title has been
 * romanized, so they are what lets the language detector recognise a Malayalam
 * song from a Latin-script "Malare".
 */
function readArtistAndAlbum(meta) {
  const durationToken = meta.find((token) => /^\d+:\d{2}(:\d{2})?$/.test(token.trim()));
  const separatorIndex = meta.findIndex((token) => token.trim() === '•');

  // Artist runs are interleaved with bare punctuation runs (", ", " & ", " "),
  // so punctuation is normalized into separators before joining.
  const artist = meta
    .slice(0, separatorIndex === -1 ? meta.length : separatorIndex)
    .map((token) => token.trim())
    .filter(Boolean)
    .reduce((acc, token) => {
      if (/^[,&]+$/.test(token)) {
        const prior = acc[acc.length - 1];
        // Collapse runs like ", &" down to a single " & ".
        if (prior && /^[&]+$/.test(prior)) acc[acc.length - 1] = '&';
        else acc.push(token.replace(/,+/g, '&'));
        return acc;
      }
      acc.push(token);
      return acc;
    }, [])
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Everything between the artist and the duration, minus separators.
  const albumParts = meta
    .slice(separatorIndex === -1 ? meta.length : separatorIndex + 1)
    .filter((token) => token.trim() && token.trim() !== '•' && token !== durationToken)
    .map((token) => token.trim());

  const album = albumParts.join(' • ').replace(/\s{2,}/g, ' ').trim();

  return { artist: artist || 'Unknown', album };
}

function normalizeItem(item) {
  const videoId = item?.playlistItemData?.videoId;
  if (!videoId) return null;

  const [title] = readColumn(item, 0);
  const meta = readColumn(item, 1);
  const durationToken = meta.find((token) => /^\d+:\d{2}(:\d{2})?$/.test(token.trim()));
  const { artist, album } = readArtistAndAlbum(meta);

  // Column 3 is YouTube's own play count ("488M plays"). It is absent for many
  // results, so it stays null rather than defaulting to 0.
  const playCountText = readColumn(item, 2).join(' ');

  return {
    id: videoId,
    title: title?.trim() || 'Unknown',
    artist,
    album,
    image: pickThumbnail(item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    duration: parseDuration(durationToken) ?? 0,
    url: `https://music.youtube.com/watch?v=${videoId}`,
    source: 'youtube',
    playCount: parsePlayCount(playCountText),
  };
}

/**
 * Pull the song shelf out of whichever envelope InnerTube returned. The library
 * previously read `contents.tabs[]`, but the payload now arrives under
 * `contents.tabbedSearchResultsRenderer.tabs[]`, so both are handled.
 */
function extractItems(data) {
  const roots = [];

  const tabbed = data?.contents?.tabbedSearchResultsRenderer?.tabs;
  if (Array.isArray(tabbed)) {
    roots.push(...tabbed.map((tab) => tab?.tabRenderer?.content?.sectionListRenderer?.contents));
  }

  if (Array.isArray(data?.contents?.tabs)) {
    roots.push(...data.contents.tabs.map((tab) => tab?.tabRenderer?.content?.sectionListRenderer?.contents));
  }

  if (Array.isArray(data?.contents?.sectionListRenderer?.contents)) {
    roots.push(data.contents.sectionListRenderer.contents);
  }

  for (const sections of roots) {
    if (!Array.isArray(sections)) continue;

    for (const section of sections) {
      const items = section?.musicShelfRenderer?.contents;
      if (!Array.isArray(items)) continue;

      const parsed = items
        .map((entry) => normalizeItem(entry?.musicResponsiveListItemRenderer))
        .filter(Boolean);

      if (parsed.length > 0) return parsed;
    }
  }

  return [];
}

/**
 * Search clients, tried in order.
 *
 * `WEB_REMIX` is the primary and stays first. InnerTube rate-limits by client
 * identity, though: a burst of searches from one client is answered with 403 even
 * though the same query is perfectly fine moments later, which is exactly what a
 * page load that fans out into several searches does. So a throttled search is
 * retried against a different client rather than surfaced as a failed request.
 *
 * Every client here is unauthenticated and needs no API key. The order is
 * "known to return songs first"; `WEB` is last because its response envelope is
 * the same music-shelf shape but its catalogue bias is broader.
 */
const SEARCH_CLIENTS = [
  CLIENT,
  { clientName: 'WEB', clientVersion: '2.20240726.00.00' },
  { clientName: 'ANDROID_MUSIC', clientVersion: '7.27.52' },
];

/**
 * Whether a failed search is worth retrying.
 *
 * 403/429 are throttling, 5xx is upstream, and a request with no response at all
 * is a timeout or reset. A 400 is the query itself being malformed, so retrying it
 * only wastes the caller's latency.
 */
function isRetryableSearchFailure(error) {
  const status = error?.response?.status;
  if (!status) return true;
  return status === 403 || status === 429 || status >= 500;
}

/** Attempts per client before moving on to the next one. */
const SEARCH_ATTEMPTS = 2;

export async function search(query, limit = 20, { region } = {}) {
  const regionExtra = region ? { gl: region } : {};
  let lastError;

  for (const client of SEARCH_CLIENTS) {
    for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        // 300ms, then ~900ms: long enough for a short throttle window to clear,
        // short enough that the caller still gets an answer quickly.
        await new Promise((r) => setTimeout(r, 300 * 3 ** (attempt - 1)));
      }

      try {
        const { data } = await http.post(`${INNERTUBE}/search?alt=json&key=${KEY}`, {
          context: { client: { ...client, hl: 'en', gl: 'US', ...regionExtra } },
          query,
          params: SONG_PARAMS,
        });

        const items = extractItems(data);
        // A 200 with an empty envelope is a throttled answer wearing a success
        // status, so it falls through to the next client instead of returning
        // "no results" for a query that has results.
        if (items.length > 0) return items.slice(0, limit);
      } catch (error) {
        if (!isRetryableSearchFailure(error)) throw error;
        lastError = error;
      }
    }
  }

  if (lastError) throw lastError;
  return [];
}

export { parsePlayCount };

// ===== VIDEO METADATA =====

/**
 * The `WEB` client, used only for per-video metadata.
 *
 * Search and playback run on `WEB_REMIX`, but that client returns no
 * microformat — `microformat.playerMicroformatRenderer` comes back empty, so
 * there is no publish date, view count or like count. The plain `WEB` client with
 * a `2.x` version does return it, and needs no API key and no authentication.
 *
 * This replaced yt-dlp for discovery metadata. yt-dlp works, but YouTube blocks
 * it with "Sign in to confirm you're not a bot" under any sustained probing, and
 * a full extraction costs ~2s per video against ~150ms here — a 13x difference
 * that decides whether a discovery pass can run behind a page load.
 *
 * yt-dlp used to be the only way to resolve audio streams, which was a different job
 * performed once per track at playback time. That path now goes through the same
 * InnerTube `/player` endpoint on a client that returns unciphered formats — see
 * `resolveStream()` — with yt-dlp kept only as a Node-side fallback.
 */
const META_CLIENT = {
  clientName: 'WEB',
  clientVersion: '2.20240726.00.00',
  hl: 'en',
  gl: 'US',
};

const META_CONCURRENCY = () => envNum('SPOTUNER_META_CONCURRENCY', 8);

/** Unwrap a microformat text node, arriving as `{simpleText}` or `{runs}`. */
function readMicroformatText(node) {
  if (typeof node === 'string') return node;
  if (typeof node?.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node?.runs)) return node.runs.map((r) => r?.text ?? '').join('');
  return '';
}

/** "2026-03-11T22:40:28-07:00" -> Date. */
function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Extract the fields discovery needs from one `/player` response.
 *
 * Note what is *not* here: the microformat has no music `release_date`. The
 * release date is recovered from the description, which distributor-delivered
 * uploads carry as an explicit `Released on: YYYY-MM-DD` line.
 */
function toVideoMetadata(data) {
  const vd = data?.videoDetails;
  const mf = data?.microformat?.playerMicroformatRenderer;
  if (!vd && !mf) return null;

  const description =
    readMicroformatText(mf?.description) || readMicroformatText(vd?.shortDescription);

  // Distributor uploads state the music release date explicitly. This is the only
  // available signal separating a new release from an old song re-uploaded.
  const releasedOn = description.match(/Released on:\s*(\d{4}-\d{2}-\d{2})/i);

  // "℗ 2026 Mass Appeal" — the copyright line also carries a year, used as a
  // fallback when no explicit release date is present. Resolved to mid-year so an
  // unknown day does not distort the age calculation.
  const copyrightYear = description.match(/[\u2117\u00A9]\s*(\d{4})/);

  const viewCount = Number(vd?.viewCount ?? mf?.viewCount);
  const likeCount = Number(mf?.likeCount);

  // InnerTube returns `lengthSeconds` and `isLiveContent` as strings here, so both
  // need explicit coercion. `Boolean("false")` is true, which would mark every
  // track as a live stream.
  const lengthSeconds = Number(vd?.lengthSeconds);
  const isLive = vd?.isLiveContent === true || vd?.isLiveContent === 'true';

  return {
    uploadDate: parseIsoDate(mf?.uploadDate) ?? parseIsoDate(mf?.publishDate),
    releaseDate: releasedOn
      ? parseIsoDate(releasedOn[1])
      : copyrightYear
        ? new Date(Date.UTC(Number(copyrightYear[1]), 6, 1))
        : null,
    releaseDateExact: Boolean(releasedOn),
    copyrightYear: copyrightYear ? Number(copyrightYear[1]) : null,
    viewCount: Number.isFinite(viewCount) && viewCount > 0 ? viewCount : null,
    likeCount: Number.isFinite(likeCount) && likeCount >= 0 ? likeCount : null,
    channel: mf?.ownerChannelName || vd?.author || null,
    category: mf?.category || null,
    description: description ? description.slice(0, 2000) : null,
    duration: Number.isFinite(lengthSeconds) && lengthSeconds > 0 ? lengthSeconds : null,
    isShortsEligible: mf?.isShortsEligible ?? null,
    isLive,
  };
}

/** Fetch one video's metadata. Returns null on failure. */
async function fetchVideoMetadata(videoId) {
  try {
    const { data } = await http.post(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
      context: { client: META_CLIENT },
      videoId,
    });
    return toVideoMetadata(data);
  } catch {
    return null;
  }
}

/**
 * Fetch metadata for many videos with bounded concurrency.
 *
 * @param {string[]} videoIds
 * @returns {Promise<Object<string, object|null>>} keyed by video id
 */
export async function getVideoMetadata(videoIds) {
  const ids = [...new Set(videoIds || [])].filter(Boolean);
  const out = {};
  if (ids.length === 0) return out;

  let cursor = 0;

  const runners = Array.from({ length: Math.min(META_CONCURRENCY(), ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      out[id] = await fetchVideoMetadata(id);
    }
  });

  await Promise.all(runners);
  return out;
}

/**
 * Build editorial shelves by running several YouTube searches and stitching the
 * results together. The web player has no browse/curation endpoint that this
 * key can reach, so each row is sourced from a themed query instead.
 *
 * Returns the frontend's track shape, ready to be queued and played in-app.
 *
 * Language shelves are handled differently from the rest, and this is the whole
 * point of the change. A themed query is a *hint about intent*, never a filter:
 * a YouTube search for "malayalam songs" returns Tamil tracks, regularly and in
 * bulk. So a language shelf runs several targeted queries, de-duplicates by video
 * ID, runs the language detector over every result, and then keeps only the
 * tracks the detector actually classified as that language. The query seeds the
 * candidate pool; the detector decides the contents.
 */
export async function getShelves({ limitPerShelf = 6, shelves }) {
  const results = await Promise.allSettled(
    shelves.map(async (shelf) => {
      if (shelf.language) {
        return buildLanguageShelf(shelf, limitPerShelf);
      }

      const songs = await search(shelf.query, limitPerShelf);
      const annotated = await language.annotate(songs);

      return {
        id: shelf.id,
        title: shelf.title,
        kind: shelf.kind || 'album',
        tracks: annotated,
      };
    })
  );

  return results
    .filter((result) => result.status === 'fulfilled' && result.value.tracks.length > 0)
    .map((result) => result.value);
}

/**
 * Build one language shelf by search-then-detect.
 *
 * Runs each of the shelf's queries, pools the results by video ID, detects the
 * language of everything found, and keeps only the matching tracks. A shelf
 * returns empty rather than filling with wrong-language tracks, which is the
 * honest outcome and is what the frontend reports when it happens.
 */
async function buildLanguageShelf(shelf, limitPerShelf) {
  const queries = [shelf.query, ...(shelf.queries || [])].filter(Boolean);
  const target = shelf.language;

  const perQuery = Math.max(limitPerShelf, 8);
  const settled = await Promise.allSettled(queries.map((query) => search(query, perQuery)));

  // Pool by video ID so a track surfaced by four queries is fetched, detected
  // and rendered once, and accumulates the query contexts it was seen under.
  const pooled = new Map();
  for (const result of settled) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const track of result.value) {
      if (!track?.id) continue;
      const existing = pooled.get(track.id);
      if (existing) {
        existing.queries += 1;
        // Keep the richest metadata seen for this video.
        if (!existing.album && track.album) existing.album = track.album;
        continue;
      }
      pooled.set(track.id, { ...track, queries: 1 });
    }
  }

  const candidates = [...pooled.values()];
  if (candidates.length === 0) {
    return { id: shelf.id, title: shelf.title, kind: shelf.kind || 'track', tracks: [] };
  }

  const annotated = await language.annotate(candidates, { searchContexts: [target] });
  language.summarize(annotated);

  const matching = annotated
    .filter((track) => track.language === target)
    // Rank by confidence first, then by how many of the shelf's queries found
    // it, which is a mild popularity signal within the language.
    .sort((a, b) => b.languageConfidence - a.languageConfidence || b.queries - a.queries);

  return {
    id: shelf.id,
    title: shelf.title,
    kind: shelf.kind || 'track',
    language: target,
    // Surfaced so the frontend can tell "no Malayalam music exists" apart from
    // "the detector could not classify what we fetched".
    languageCandidateCount: candidates.length,
    languageMatchedCount: matching.length,
    tracks: matching.slice(0, limitPerShelf),
  };
}

// ===== STREAM RESOLUTION ===================================================
//
// Cloudflare Workers cannot spawn a process, so the previous `child_process` +
// `yt-dlp` extraction is gone. Audio URLs are now read from the InnerTube
// `/player` response on a client whose formats arrive as plain `url` fields rather
// than `signatureCipher` blobs — no signature deciphering, no binary, no
// filesystem.
//
// The URL is a `*.googlevideo.com` link with a short lifetime. That is unchanged in
// kind from the yt-dlp output: still a direct progressive audio URL the browser
// fetches itself, still nothing proxied or re-hosted by this backend.

// Unciphered audio requires a client whose `/player` response carries plain `url`
// values (itags 139/140/249/251). Probed live against the endpoint; see
// scripts/probe-stream-clients.mjs for the evidence.
//
//   client                  audio formats   plain url   notes
//   ANDROID_VR              4               yes         primary
//   ANDROID (YouTube Music) 6               yes         most itags, incl. 599/600
//   ANDROID_TESTSUITE       0               n/a         playabilityStatus UNPLAYABLE
//   IOS                     -               n/a         HTTP 400 from every network
//   WEB / MWEB / TVHTML5 /
//   WEB_EMBEDDED_PLAYER     0               n/a         return no unciphered audio
//   VISIONOS                5               yes         NOT usable from here: LOGIN_REQUIRED
//
// The last three groups are excluded deliberately rather than left in as harmless
// fallbacks: each one costs a subrequest and up to a second of latency on every
// call before contributing nothing, and subrequests are capped per invocation on the
// Free plan.
//
// VISIONOS deserves its own note, because it is the one client whose URLs are *not*
// truncated — and the reason it cannot simply be added here is the whole story of
// playback. A URL from ANDROID or IOS stops serving at roughly 1.5 MB of absolute
// offset, measured across every itag and every User-Agent; a URL from VISIONOS serves
// the entire file, including open-ended `bytes=0-`. That is a per-client policy, so
// the client identity in the URL is what decides how much of a track is playable.
// Asking for VISIONOS directly answers LOGIN_REQUIRED without the cookie and visitor
// bootstrap yt-dlp performs, so on Node the binary is asked instead — see
// `resolveWithYtDlp`.
//
// A `signatureCipher` would need YouTube's deciphering JS to resolve, which is
// exactly the native work this migration removed, so a client that only returns
// ciphered URLs is no use here.
const STREAM_CLIENTS = [
  {
    clientName: 'ANDROID_VR',
    clientVersion: '1.61.48',
    userAgent: 'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; GB) gzip',
    extra: { androidSdkVersion: 30 },
  },
  {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    userAgent: 'com.google.android.apps.youtube.music/20.10.38 (Linux; U; Android 12; GB) gzip',
    extra: { androidSdkVersion: 30 },
  },
];

/** Preference order over audio-only formats. */
const AUDIO_RANKS = [
  // AAC in MP4 first: it is the only container every browser plays reliably through
  // an <audio> element, and Howler (the player) uses one.
  { mime: 'audio/mp4', codecs: 'mp4a.40.2', rank: 0 },
  { mime: 'audio/mp4', codecs: 'mp4a.40.5', rank: 1 },
  { mime: 'audio/mp4', codecs: '', rank: 2 },
  { mime: 'audio/webm', codecs: 'opus', rank: 3 },
  { mime: 'audio/webm', codecs: '', rank: 4 },
];

function rankFormat(format) {
  const mime = String(format?.mimeType ?? '');
  const codecs = String(format?.codecs ?? '');
  const audioType = mime.split(';')[0].trim();

  for (const rule of AUDIO_RANKS) {
    if (audioType !== rule.mime) continue;
    if (rule.codecs && !codecs.includes(rule.codecs)) continue;
    return rule.rank;
  }

  return 99;
}

/**
 * Best unciphered audio-only URL in a `/player` response, or null.
 *
 * Only `url` fields are considered: a `signatureCipher` would need YouTube's
 * deciphering JS to resolve, which is exactly the native work this migration
 * removed, and shipping a broken URL would be worse than resolving nothing.
 */
function pickAudioUrl(data) {
  const formats = [
    ...(data?.streamingData?.adaptiveFormats ?? []),
    ...(data?.streamingData?.formats ?? []),
  ].filter((format) => String(format?.mimeType ?? '').startsWith('audio/') && typeof format.url === 'string' && format.url);

  if (formats.length === 0) return null;

  const ranked = formats
    .map((format) => ({ url: format.url, rank: rankFormat(format), bitrate: Number(format.averageBitrate ?? format.bitrate ?? 0) }))
    .sort((a, b) => a.rank - b.rank || b.bitrate - a.bitrate);

  return ranked[0]?.url ?? null;
}

/** Why a `/player` call produced no URL, for the error message. */
function playabilityReason(data) {
  return (
    data?.playabilityStatus?.reason ||
    data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText ||
    null
  );
}

/**
 * Count the audio formats in a `/player` response and how many are directly usable.
 *
 * Split out so the resolver can log *why* a client yielded nothing. "0 formats" and
 * "4 formats but all ciphered" are completely different failures, and collapsing
 * both into `null` is what made this undiagnosable from a Worker log.
 */
function inspectAudio(data) {
  const formats = [
    ...(data?.streamingData?.adaptiveFormats ?? []),
    ...(data?.streamingData?.formats ?? []),
  ].filter((format) => String(format?.mimeType ?? '').startsWith('audio/'));

  const plain = formats.filter((format) => typeof format.url === 'string' && format.url);
  return { audio: formats.length, plain: plain.length };
}

export async function resolveStream(videoId) {
  if (!videoId) throw new Error('no video id');

  // yt-dlp goes first on Node, and only on Node: `node:child_process` cannot be
  // imported in a Worker, so the dynamic specifier below throws inside the try and the
  // catch turns that into "not available here". This is not a preference. Current
  // yt-dlp resolves the VISIONOS player, and a VISIONOS URL is the only kind that
  // serves a whole track through this backend — see `STREAM_CLIENTS` for the
  // measurement. Everything below it truncates at ~1.5 MB.
  const viaYtDlp = await resolveWithYtDlp(videoId).catch(() => null);
  if (viaYtDlp) return viaYtDlp;

  let lastReason = null;

  for (const client of STREAM_CLIENTS) {
    const label = `${client.clientName}/${client.clientVersion}`;

    try {
      const { status, data } = await http.post(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
        context: { client: { clientName: client.clientName, clientVersion: client.clientVersion, hl: 'en', gl: 'US', ...client.extra } },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }, {
        headers: { 'User-Agent': client.userAgent },
      });

      const url = pickAudioUrl(data);
      const counts = inspectAudio(data);

      // Deliberately logs no URL and no signature: a googlevideo link is a bearer
      // token for the media, and `wrangler tail` output is not private.
      console.log(
        `[youtube:stream] ${label} http=${status} playability=${data?.playabilityStatus?.status ?? 'unknown'} ` +
          `audioFormats=${counts.audio} unciphered=${counts.plain} resolved=${Boolean(url)}`,
      );

      if (url) return url;

      lastReason = playabilityReason(data);
    } catch (error) {
      const upstream = error?.response?.status ?? null;
      lastReason = error?.message ?? null;
      console.warn(
        `[youtube:stream] ${label} failed http=${upstream ?? 'no-response'} ` +
          `reason=${String(error?.message ?? error).slice(0, 160)}`,
      );
    }
  }

  throw new Error(
    lastReason ? `stream resolution failed: ${lastReason}` : 'no client produced a stream URL',
  );
}

/**
 * The original yt-dlp path, which is on Node again.
 *
 * It was demoted to a fallback when `resolveStream` was ported to Cloudflare, because
 * a Worker cannot spawn a process. On Node it is the primary, for a measured reason:
 * the URLs InnerTube hands back here (`c=ANDROID`, `c=IOS`) stop serving at roughly
 * 1.5 MB of absolute offset, which is about 95 seconds of a 129 kbps track, while the
 * VISIONOS URL current yt-dlp selects serves the file whole. Only yt-dlp can reach that
 * client, because asking for it directly answers LOGIN_REQUIRED without yt-dlp's
 * cookie and visitor bootstrap.
 *
 * `node:child_process` cannot be imported in a Worker, so the specifier is built at
 * runtime to keep it out of the bundle graph entirely; on the Worker the import throws
 * and the caller treats yt-dlp as absent.
 */
async function resolveWithYtDlp(videoId) {
  const specifier = ['node', 'child_process'].join(':');
  const utilSpecifier = ['node', 'util'].join(':');

  const [{ exec }, { promisify }] = await Promise.all([import(specifier), import(utilSpecifier)]);
  const nodePath = ['node', 'path'].join(':');
  const nodeFs = ['node', 'fs'].join(':');
  const [{ default: path }, { default: fs }, { fileURLToPath }] = await Promise.all([
    import(nodePath),
    import(nodeFs),
    import('node:url'),
  ]);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const local = path.join(here, '..', 'bin', 'yt-dlp', 'bin', 'yt-dlp.exe');
  const binary = fs.existsSync(local) ? local : 'yt-dlp';

  const execPromise = promisify(exec);
  const url = `https://music.youtube.com/watch?v=${videoId}`;

  // m4a first, because it is the only audio container every browser plays through an
  // <audio> element. Left to itself yt-dlp prefers itag 251 (webm/opus) on bitrate,
  // which is fine on Chrome and a coin flip on Safari.
  const format = 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio';

  let stdout;
  try {
    ({ stdout } = await execPromise(
      `"${binary}" -g -f "${format}" --no-warnings --no-playlist "${url}"`,
      { timeout: 45000 },
    ));
  } catch (error) {
    if (error.code === 'ENOENT' || /not recognized|command not found/i.test(error.message)) {
      throw new Error('yt-dlp is not installed. Install it with: pip install --user yt-dlp');
    }
    throw new Error(`yt-dlp failed: ${String(error.message).split('\n')[0]}`);
  }

  return stdout.trim().split(/\r?\n/).find(Boolean) ?? null;
}
