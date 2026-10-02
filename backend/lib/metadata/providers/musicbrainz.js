/**
 * MusicBrainz metadata provider — enrichment only.
 *
 * MusicBrainz is never a playback source and never a discovery source here. Its
 * job is to answer the questions YouTube cannot:
 *
 *   release date   the "latest" shelf hinges on knowing when the music was
 *                  released, and YouTube only offers an upload date plus whatever
 *                  the description happens to state
 *   ISRC           the only reliable identifier for a specific recording
 *   album / genres structure YouTube's free search never returns
 *
 * Constraints that shaped this module:
 *
 *   1. **Never fatal.** MusicBrainz being down, slow, or unreachable must not
 *      affect the music homepage. Every failure resolves to null and the caller
 *      keeps the YouTube-only record. `resolve()` cannot reject.
 *   2. **Rate limited.** The public service allows roughly one request per second
 *      per client and answers 503 when exceeded, so requests are paced and
 *      aggressively negative-cached.
 *   3. **Keyed on a real match.** A wrong match is worse than no match, so a
 *      candidate is only accepted when title and artist both agree closely.
 */

import { createHttp } from '../../runtime/http.js';
import { normalizeIsrc, variantMarkers, titleSimilarity } from '../identity.js';
import { normalizeTrack } from '../normalize.js';
import { appVersion, envNum, envStr } from '../../runtime/env.js';
import * as kv from '../../runtime/kv.js';

export const name = 'musicbrainz';

const ENDPOINT = 'https://musicbrainz.org/ws/2';

/**
 * MusicBrainz requires a descriptive user-agent and blocks generic ones.
 *
 * Contact details are expected in the agent string by their policy. Without this
 * the service answers 403.
 *
 * Built per request rather than once: on a Worker the version binding only exists
 * after the module has been evaluated.
 */
const userAgent = () =>
  `Spotuner/${appVersion()} ( https://github.com/spotuner ; music discovery )`;

const http = createHttp({
  timeout: 6000,
  headers: {
    'User-Agent': userAgent(),
    Accept: 'application/json',
  },
});

/** Minimum gap between outbound requests, honouring the ~1 req/s limit. */
const MIN_INTERVAL_MS = () => envNum('SPOTUNER_MB_INTERVAL_MS', 1050);

/**
 * How similar titles must be to accept a match.
 *
 * Deliberately strict. MusicBrainz's own search ranking is loose — a query for
 * one song routinely returns a different song by a similar artist — and a wrong
 * release date is a silent data corruption that would then be trusted by the
 * scoring engine.
 */
const MIN_TITLE_SIMILARITY = 0.75;

/** How similar artists must be. Tighter than titles, since artists repeat. */
const MIN_ARTIST_SIMILARITY = 0.6;

const SUCCESS_TTL_MS = 30 * 86400000; // 30 days: a release date does not move.
const MISS_TTL_MS = 7 * 86400000; // 7 days: a regional act may get catalogued later.
const ERROR_TTL_MS = 10 * 60 * 1000; // 10 minutes: a failure is likely transient.

/** @type {Map<string, {value: object|null, expiresAt: number}>} */
const cache = new Map();

const stats = { attempts: 0, hits: 0, misses: 0, errors: 0, rejected: 0, cacheHits: 0 };

let lastRequestAt = 0;

/** Serialize the gap between requests so bursts cannot trip the rate limiter. */
async function pace() {
  const wait = lastRequestAt + MIN_INTERVAL_MS() - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export function isAvailable() {
  // Enabled by default but can be switched off without a code change. Both
  // spellings are honoured: the original variable was missing an "s", and
  // silently ignoring a correctly-spelled setting would be worse than accepting
  // both.
  const flag = envStr('SPOTUNER_MUSICBRAINZ') ?? envStr('SPOTUNER_METABRAINZ');
  return flag !== 'off';
}

/**
 * Fault injection for tests.
 *
 * ESM namespace objects are frozen, so `enrich()`'s failure path cannot be
 * exercised by patching this module's `getTrack` from a test file. This hook
 * exists so the "an optional provider is never fatal" guarantee is verified
 * against a real failure rather than assumed from reading the code.
 *
 * Production never sets it; `enrich()` treats whatever it returns as the
 * provider's answer, which is exactly what makes the test meaningful.
 */
let faultInjector = null;

/** @param {((query: object) => any)|null} fn */
export function setFaultInjector(fn) {
  faultInjector = typeof fn === 'function' ? fn : null;
}

/**
 * Look up one recording by title and artist.
 *
 * @param {object} query
 * @param {string} query.title
 * @param {string} query.artist
 * @param {number} [query.limit]
 * @returns {Promise<object|null>} partial canonical track, or null
 */
export async function getTrack({ title, artist, limit = 5 } = {}) {
  if (!title || !artist) return null;

  if (faultInjector) return faultInjector({ title, artist });

  const cacheKey = `${String(title).toLowerCase()}|${String(artist).toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    stats.cacheHits += 1;
    return cached.value;
  }

  stats.attempts += 1;

  try {
    await pace();

    const { data } = await http.get(`${ENDPOINT}/recording`, {
      params: {
        query: `recording:${quote(title)} AND artist:${quote(artist)}`,
        fmt: 'json',
        limit,
        // The release list is what carries a real release date and the ISRC.
        inc: 'releases+artist-credits+tags',
      },
    });

    const match = pickMatch(data?.recordings, { title, artist });

    if (!match) {
      stats.rejected += 1;
      return store(cacheKey, null, MISS_TTL_MS);
    }

    stats.hits += 1;
    return store(cacheKey, toCanonical(match, { title, artist }), SUCCESS_TTL_MS);
  } catch (error) {
    // 503 means rate limited; 503/5xx/timeout are all transient. Never cache a
    // long-lived failure, but do stop retrying immediately.
    stats.errors += 1;
    const ttl = error?.response?.status === 404 ? MISS_TTL_MS : ERROR_TTL_MS;
    return store(cacheKey, null, ttl);
  }
}

function store(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Lucene query syntax requires quoting and escaping of special characters. */
function quote(value) {
  return `"${String(value).replace(/["\\]/g, ' ').trim()}"`;
}

/**
 * Choose the one acceptable match from MusicBrainz's ranked results.
 *
 * MusicBrainz returns several candidates that are indistinguishable by score and
 * title — five records for "Blinding Lights" all score 100 with an identical
 * title. They differ only in `disambiguation`: the studio track, a Dolby Atmos
 * mix, a DJ mix, a live take and a music-video upload. So this does two passes:
 *
 *   1. reject anything that is a different recording (gates below)
 *   2. among survivors, prefer the one that actually carries metadata
 *
 * The second pass matters as much as the first. Taking the first gate-passing
 * candidate returned a 2021 chart compilation with no ISRC and no usable release,
 * which enriched nothing — while a later candidate in the same result set carried
 * a valid ISRC and the original single.
 *
 * Gates, each of which has caught a real observed failure:
 *
 *   title similarity  — catches unrelated songs
 *   artist similarity — catches a different act with a similar name
 *   variant agreement — rejects mixes, DJ versions and live takes the caller did
 *                      not ask for, whose ISRCs belong to different masters
 */
function pickMatch(recordings, { title, artist }) {
  const queryVariants = new Set(variantMarkers(title));
  const survivors = [];

  for (const recording of recordings ?? []) {
    const candidateTitle = recording?.title ?? '';

    if (titleSimilarity(candidateTitle, title) < MIN_TITLE_SIMILARITY) continue;

    // A candidate carrying a variant marker the query lacks is a different
    // recording, even though its title matches. The reverse is allowed: asking for
    // "(Remix)" and finding the remix is exactly right.
    const candidateVariants = variantMarkers(`${candidateTitle} ${recording?.disambiguation ?? ''}`);
    if (candidateVariants.some((v) => !queryVariants.has(v))) continue;

    const credits = recording?.['artist-credit'] ?? [];
    const candidateArtist = credits
      .map((c) => (typeof c?.name === 'string' ? c.name : c?.artist?.name ?? ''))
      .filter(Boolean)
      .join(' & ');

    // A missing artist credit is not disqualifying on its own — plenty of
    // recordings are unattributed — but a *present and different* one is.
    if (candidateArtist && titleSimilarity(candidateArtist, artist) < MIN_ARTIST_SIMILARITY) continue;

    survivors.push(recording);
  }

  if (survivors.length === 0) return null;
  if (survivors.length === 1) return survivors[0];

  // Prefer the survivor that yields the most usable metadata.
  survivors.sort((a, b) => usefulness(b) - usefulness(a));
  return survivors[0];
}

/**
 * How much metadata a candidate can actually contribute, as a comparable number.
 *
 * Weighted towards a usable release, because the release date is what the
 * latest-release score depends on; an ISRC is next; a usable album name last.
 */
function usefulness(recording) {
  const releases = usableReleases(recording?.releases);
  const hasNamedRelease = releases.some((r) => {
    const name = String(r?.title ?? '').toLowerCase().trim();
    const title = String(recording?.title ?? '').toLowerCase().trim();
    return name && (name === title || name.includes(title) || title.includes(name));
  });

  const hasReleaseDate = Boolean(recording?.['first-release-date']) && hasNamedRelease;

  return (
    (hasReleaseDate ? 4 : 0) +
    (usableReleases(recording?.releases).length > 0 ? 1 : 0) +
    ((recording?.isrcs ?? []).some((i) => normalizeIsrc(i)) ? 2 : 0) +
    ((recording?.tags ?? []).length > 0 ? 0.5 : 0)
  );
}

/**
 * Release-group types that mean "this is not the recording's own release".
 *
 * Verified against the live API rather than assumed: a search for "Shape of You"
 * returns only two releases, both from the 2023 live album "Apple Music Live: Ed
 * Sheeran", whose release-group carries `secondary-types: ["Live"]`. Accepting
 * either would give a 2017 single a 2023 release date, and that date feeds the
 * latest-release score — a silent, plausible-looking corruption.
 */
const REJECTED_SECONDARY_TYPES = new Set(['live', 'compilation', 'soundtrack', 'video', 'dj-mix', 'mix']);

/** Release-group primary types that can represent a real studio release. */
const USABLE_PRIMARY_TYPES = new Set(['single', 'album', 'ep']);

/**
 * Releases that plausibly represent this recording's own release.
 *
 * Filters on the release-group, because that is where the type information
 * actually lives — the release object itself has no `date` and no `primary-type`
 * when fetched via `inc=releases`.
 */
function usableReleases(releases) {
  return (releases ?? []).filter((release) => {
    const status = String(release?.status ?? '').toLowerCase();
    if (status === 'bootleg' || status === 'pseudo-release') return false;

    const group = release?.['release-group'];
    const primary = String(group?.['primary-type'] ?? '').toLowerCase();
    const secondary = (group?.['secondary-types'] ?? []).map((t) => String(t).toLowerCase());

    if (secondary.some((t) => REJECTED_SECONDARY_TYPES.has(t))) return false;
    // An absent type is tolerated; a present-but-unusable one is not.
    if (primary && !USABLE_PRIMARY_TYPES.has(primary)) return false;

    return true;
  });
}

/**
 * Choose the release to report, and only report a date we can defend.
 *
 * A release date is only taken when a usable release exists *and* its title
 * matches the recording — i.e. the track was released as a named single or on a
 * matching album. `recording.first-release-date` exists but is recording-wide and
 * was observed reporting a live album's date for a studio single, so it is used
 * only under that condition.
 */
function pickRelease(releases, recording) {
  const usable = usableReleases(releases);
  if (usable.length === 0) return { album: null, date: null };

  const title = String(recording?.title ?? '').toLowerCase().trim();

  const named =
    usable.find((r) => {
      const name = String(r?.title ?? '').toLowerCase().trim();
      return name && (name === title || name.includes(title) || title.includes(name));
    }) ?? null;

  // A matching title is the only case where the recording-wide date is trusted.
  if (!named) return { album: usable[0]?.title ?? null, date: null };

  return {
    album: named.title,
    date: recording?.['first-release-date'] ?? null,
  };
}

/**
 * Convert a MusicBrainz recording into a partial canonical track.
 *
 * Only enrichment fields are populated. There is deliberately no `image` and no
 * `url`: MusicBrainz carries no artwork and is not a playback source, so the
 * merge leaves YouTube's values untouched.
 */
function toCanonical(recording, query) {
  const { album, date } = pickRelease(recording?.releases, recording);

  const credits = (recording?.['artist-credit'] ?? [])
    .map((c) => (typeof c?.name === 'string' ? c.name : c?.artist?.name ?? ''))
    .filter(Boolean);

  const genres = (recording?.tags ?? [])
    .map((t) => t?.name)
    .filter(Boolean)
    .slice(0, 5);

  return {
    ...normalizeTrack(
      {
        id: recording?.id ?? null,
        musicBrainzId: recording?.id ?? null,
        source: 'musicbrainz',
        title: recording?.title ?? query.title,
        artist: credits.join(' & ') || query.artist,
        album: album ?? null,
        duration: Number.isFinite(recording?.length)
          ? Math.round(recording.length / 1000)
          : null,
        releaseDate: date ?? null,
        isrc: recording?.isrcs?.[0] ?? null,
        genres,
      },
      'musicbrainz'
    ),

    // Keep YouTube's identifiers out of this record: merging must not overwrite
    // the playback id with a MusicBrainz one.
    id: null,
    youtubeId: null,
    image: null,
    thumbnail: null,
    url: null,
    isrc: normalizeIsrc(recording?.isrcs?.[0]),
  };
}

/** Not a discovery source; returns an empty list so callers need no branch. */
export async function search() {
  return [];
}

/** Resolve an artist to a MusicBrainz artist id, for future cross-referencing. */
export async function getArtist(name) {
  if (!name) return null;
  try {
    await pace();
    const { data } = await http.get(`${ENDPOINT}/artist`, {
      params: { query: `artist:${quote(name)}`, fmt: 'json', limit: 1 },
    });
    const artist = data?.artists?.[0];
    if (!artist) return null;
    return { id: artist.id, name: artist.name, source: 'musicbrainz', disambiguation: artist.disambiguation ?? null };
  } catch {
    return null;
  }
}

/** Resolve a release to a MusicBrainz release id. */
export async function getAlbum(name) {
  if (!name) return null;
  try {
    await pace();
    const { data } = await http.get(`${ENDPOINT}/release`, {
      params: { query: `release:${quote(name)}`, fmt: 'json', limit: 1 },
    });
    const release = data?.releases?.[0];
    if (!release) return null;
    return { id: release.id, name: release.title, source: 'musicbrainz', releaseDate: release.date ?? null };
  } catch {
    return null;
  }
}

export function cacheStats() {
  return { entries: cache.size, probes: { ...stats } };
}

// Exported for testing. These are the decisions that decide whether enrichment is
// correct, and they are pure: the rules below were derived from observing wrong
// answers against the live API, so they need to be assertable against captured
// payloads rather than only exercised through the network.
export { pickMatch, usableReleases, pickRelease };

export function clearCache() {
  cache.clear();
  stats.attempts = 0;
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
  stats.rejected = 0;
  stats.cacheHits = 0;
}

export default { name, isAvailable, search, getTrack, getArtist, getAlbum, cacheStats, clearCache };
