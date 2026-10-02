/**
 * Canonical track normalisation and non-destructive merging.
 *
 * Every source eventually produces one Spotuner track object. This module owns
 * that shape and the rules for filling it, so no downstream module has to know
 * which provider supplied which field.
 *
 * The merge rule that matters: **a null never overwrites a value.**
 *
 *   YouTube      title ✓   artist ✓   album ✗
 *   MusicBrainz  title ✓   artist ✓   album ✓
 *
 *   -> title  YouTube (it is the display string users see)
 *      artist merged and validated
 *      album  MusicBrainz
 *
 * Without that rule, adding an enrichment provider would quietly delete metadata:
 * MusicBrainz has no thumbnail, so a naive `{...youtube, ...mb}` would null out the
 * artwork of every single track. Empty and null are both treated as "no opinion".
 *
 * Pure functions, no I/O.
 */

import { normalizeIsrc, splitArtists, normalizeText } from './identity.js';

/** Fields that hold a scalar, and which source is authoritative for each. */
const SCALAR_FIELDS = [
  'title',
  'artist',
  'album',
  'albumId',
  'duration',
  'image',
  'releaseDate',
  'language',
  'languageConfidence',
  'isrc',
  'musicBrainzId',
  'spotifyId',
  'publishedAt',
  'views',
  'url',
  'category',
  'channel',
  'description',
];

/** Array-valued fields, unioned rather than replaced. */
const ARRAY_FIELDS = ['artists', 'genres', 'metadataSources'];

/**
 * Authoritative source per field.
 *
 * `youtube` wins for anything a user sees or plays: the title is the one already
 * in their search history and library, so replacing it would orphan saved tracks.
 * MusicBrainz wins only where YouTube genuinely has nothing — release dates,
 * album names, ISRCs and genres.
 */
const FIELD_AUTHORITY = {
  title: 'youtube',
  artist: 'youtube',
  url: 'youtube',
  image: 'youtube',
  channel: 'youtube',
  category: 'youtube',
  description: 'youtube',
  publishedAt: 'youtube',
  views: 'youtube',
  duration: 'youtube',
  album: 'musicbrainz',
  albumId: 'musicbrainz',
  releaseDate: 'musicbrainz',
  isrc: 'musicbrainz',
  musicBrainzId: 'musicbrainz',
  genres: 'musicbrainz',

  // Spotify is the authority for its own identifiers and for structured release
  // dates, which is exactly the information YouTube does not have. A spotifyId is
  // never invented by another provider, and never overwritten by one.
  spotifyId: 'spotify',
  releaseDateSpotify: 'spotify',
};

/** True for values that carry no information and must not overwrite anything. */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return false;
}

/** An ISO string, or null. */
function isoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Build a canonical track from a raw provider record.
 *
 * Every field is optional at the source, so this is defensive by construction: a
 * provider that knows only a title still yields a usable track rather than
 * throwing.
 *
 * @param {object} raw
 * @param {string} source  Provider name, recorded in `metadataSources`.
 * @returns {object} canonical track
 */
export function normalizeTrack(raw, source = 'youtube') {
  const input = raw ?? {};

  const title = str(input.title) || 'Unknown';
  const artistCredit = str(input.artist) || str(input.artistName) || 'Unknown';

  return {
    // --- identity ---
    id: str(input.id) || str(input.videoId) || null,
    source: str(input.source) || source,
    youtubeId: str(input.youtubeId) || str(input.videoId) || (source === 'youtube' ? str(input.id) : null),
    musicBrainzId: str(input.musicBrainzId) || str(input.recordingId) || null,
    spotifyId: str(input.spotifyId) || (source === 'spotify' ? str(input.id) : null),
    isrc: normalizeIsrc(input.isrc),

    // --- playback ---
    // Metadata source and playback source are independent. A Spotify-sourced track
    // is normally played through YouTube, and a YouTube-sourced track may be
    // played through Spotify when the SDK session allows it.
    //
    // `playable` is evidence, never intent: it is true only when a stream is
    // actually resolvable now. A provider that cannot serve audio must leave it
    // false rather than optimistic, or the player fails at the press.
    playable: input.playable === true,
    playbackProvider: str(input.playbackProvider) || null,

    // --- descriptive ---
    title,
    artist: artistCredit,
    artists: splitArtists(artistCredit),
    album: str(input.album) || null,
    albumId: str(input.albumId) || null,

    // --- media ---
    duration: num(input.duration) ?? 0,
    // `image` is the name the existing frontend and player already read.
    // `thumbnail` is kept as an explicit alias for the documented contract.
    image: str(input.image) || str(input.thumbnail) || null,
    thumbnail: str(input.image) || str(input.thumbnail) || null,
    url: str(input.url) || null,

    // --- dates ---
    // `publishedAt` is when the video went up; `releaseDate` is when the music
    // was released. They are different facts and the "latest" shelf depends on
    // keeping them apart.
    publishedAt: isoOrNull(input.publishedAt ?? input.uploadDate),
    releaseDate: isoOrNull(input.releaseDate),

    // --- classification (filled by the language stage) ---
    language: str(input.language) || null,
    languageName: str(input.languageName) || null,
    languageConfidence: num(input.languageConfidence) ?? 0,

    // --- editorial ---
    genres: array(input.genres ?? input.genre).map(str).filter(Boolean),
    views: num(input.views ?? input.viewCount) ?? 0,
    likes: num(input.likes ?? input.likeCount) ?? null,
    channel: str(input.channel) || null,
    category: str(input.category) || null,

    // --- provenance ---
    metadataSources: [source],
  };
}

function str(value) {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function array(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

/**
 * Merge secondary provider data into a canonical track without destroying anything.
 *
 * @param {object} base      Canonical track, usually from the primary provider.
 * @param {object} extra     Canonical track from a secondary provider.
 * @param {object} [options]
 * @param {string} [options.extraSource] Provider name of `extra`, for authority.
 * @returns {object} a new track; neither input is mutated.
 */
export function mergeTrack(base, extra, { extraSource = extra?.source } = {}) {
  if (!base) return extra ? { ...extra } : null;
  if (!extra) return { ...base };

  const merged = { ...base };

  for (const field of SCALAR_FIELDS) {
    const incoming = extra[field];

    // A null or empty value is "no opinion", never an instruction to erase.
    if (isEmpty(incoming)) continue;
    if (isEmpty(merged[field])) {
      merged[field] = incoming;
      continue;
    }

    // Both sides have a value. Keep the one from the authoritative source, unless
    // the authoritative side is the base already (in which case nothing changes).
    const authority = FIELD_AUTHORITY[field];
    if (authority && extraSource && authority === extraSource) {
      merged[field] = incoming;
    }
  }

  // A provider's own id is authoritative and additive. When Spotify is merged into
  // a YouTube track, the result carries both identifiers, which is what makes
  // cross-provider matching and playback fallback possible later.
  if (extraSource && extraSource !== base.source) {
    for (const idField of ['youtubeId', 'spotifyId', 'musicBrainzId']) {
      if (!isEmpty(extra[idField]) && isEmpty(merged[idField])) {
        merged[idField] = extra[idField];
      }
    }
  }

  // Playability is a union of *evidence*, not a claim by the later provider. A
  // provider that cannot serve audio must never turn a playable track into an
  // unplayable one, so only OR-ing is allowed.
  merged.playable = Boolean(base.playable) || Boolean(extra.playable);
  if (isEmpty(merged.playbackProvider) && !isEmpty(extra.playbackProvider)) {
    merged.playbackProvider = extra.playbackProvider;
  }

  // Arrays union, preserving order and dropping duplicates. `artists` is
  // recomputed from the winning credit line rather than unioned, because merging
  // two credit lines can invent a performer who was never in either.
  for (const field of ARRAY_FIELDS) {
    if (field === 'artists') continue;
    const combined = [...new Set([...(array(base[field])), ...(array(extra[field]))])];
    merged[field] = combined;
  }

  merged.artists = splitArtists(merged.artist);
  merged.thumbnail = merged.image;
  merged.metadataSources = [...new Set([...(array(base.metadataSources)), ...(array(extra.metadataSources))])];

  return merged;
}

/**
 * Merge many provider records for one track, in priority order.
 *
 * Later records fill gaps but never overwrite an earlier provider's authoritative
 * field, so the order of `records` is the order of trust.
 */
export function mergeAll(records, { primary = 'youtube' } = {}) {
  const ordered = [...(records ?? [])].sort((a, b) => {
    const rank = (r) => (r?.source === primary ? 0 : 1);
    return rank(a) - rank(b);
  });

  let result = null;
  for (const record of ordered) {
    if (!record) continue;
    result = result ? mergeTrack(result, record, { extraSource: record.source }) : { ...record };
  }

  return result;
}

/**
 * How complete a canonical track is, 0..1.
 *
 * Feeds the metadata-quality term in scoring: a track whose album, release date
 * and ISRC are all known is described more precisely than one that is only a
 * title and a channel.
 */
export function metadataQuality(track) {
  if (!track) return 0;

  const checks = [
    Boolean(track.album),
    Boolean(track.releaseDate),
    Boolean(track.isrc),
    Array.isArray(track.genres) && track.genres.length > 0,
    Boolean(track.musicBrainzId),
    Boolean(track.albumId),
    Number.isFinite(track.duration) && track.duration > 0,
    Array.isArray(track.artists) && track.artists.length > 1,
  ];

  return checks.filter(Boolean).length / checks.length;
}

export { isEmpty, isoOrNull };
