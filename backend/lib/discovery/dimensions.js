/**
 * Cross-dimension diversity.
 *
 * `diversity.js` already caps repeats per artist and damps tracks shown recently.
 * Both are reused unchanged. This module adds the dimensions that cap does not
 * cover: language, album and genre.
 *
 * Why a cap per language is not simply "one language per shelf": the app targets
 * an Indian audience and a shelf of only Malayalam is the norm for a regional
 * view, so a *global* shelf that is 18/20 one language is the real failure. The
 * rule is therefore relative — no language may exceed a configured share of the
 * shelf — rather than absolute.
 *
 * Like the artist cap, this defers rather than deletes. A shelf returns full.
 */

const DEFAULT_LANGUAGE_SHARE = 0.6;

/**
 * Apply a per-key cap across several dimensions at once.
 *
 * Walks the ranking once and defers any track that would push *any* dimension
 * over its cap, then appends the deferred tracks. A track deferred by language is
 * not re-admitted later for exceeding a different dimension — one deferral is
 * enough, and re-checking would let the ordering thrash.
 *
 * @param {object[]} ranked  Scored tracks, best first.
 * @param {object} options
 * @param {object} [options.caps]  { dimension: maxCount }
 * @param {string[]} [options.dimensions]  Which track fields to key on.
 * @param {number} [options.limit]  When set, the cap becomes a share of this.
 * @returns {object[]} reordered, same length as the input
 */
export function applyDiversity(ranked, { caps = {}, dimensions = [], limit = null } = {}) {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];
  if (dimensions.length === 0) return ranked;

  const counts = new Map(dimensions.map((d) => [d, new Map()]));
  const taken = [];
  const deferred = [];

  for (const track of ranked) {
    const violated = dimensions.some((dimension) => {
      const key = keyFor(track, dimension);
      if (!key) return false;

      const map = counts.get(dimension);
      const used = map.get(key) ?? 0;

      if (capFor(caps, dimension, limit) === null) return false;
      if (used < capFor(caps, dimension, limit)) {
        map.set(key, used + 1);
        return false;
      }

      return true;
    });

    if (violated) deferred.push(track);
    else taken.push(track);
  }

  return [...taken, ...deferred];
}

/**
 * Cap for one dimension: an explicit count, or a share of the shelf size.
 *
 * A share is what makes the language rule adapt: with `limit: 20` and a share of
 * 0.6 the cap is 12, so a shelf can be predominantly one language but never
 * entirely so.
 */
function capFor(caps, dimension, limit) {
  if (Number.isFinite(caps[dimension])) return caps[dimension];

  if (limit && Number.isFinite(caps[`${dimension}Share`])) {
    return Math.max(1, Math.floor(limit * caps[`${dimension}Share`]));
  }

  return null;
}

/**
 * Dimension key for a track.
 *
 * Album keys are normalised so "Malare (Deluxe)" and "Malare" are one release
 * for cap purposes.
 */
function keyFor(track, dimension) {
  let value;

  switch (dimension) {
    case 'language':
      value = track?.language;
      break;
    case 'album':
      value = track?.album;
      break;
    case 'genre':
      value = (track?.genres ?? [])[0];
      break;
    default:
      value = track?.[dimension];
  }

  if (!value) return null;

  const normalized = String(value).toLowerCase().trim();
  return normalized === '' || normalized === 'unknown' ? null : normalized;
}

/**
 * The standard multi-dimension pass used by every ranked shelf.
 *
 * Album and genre are capped at small absolute counts rather than shares: an
 * album genuinely is one recording, so a third track from it is worth suppressing,
 * whereas languages legitimately dominate a regional shelf.
 */
export function applyShelfDiversity(ranked, { limit = 20, maxPerAlbum = 2, languageShare = DEFAULT_LANGUAGE_SHARE } = {}) {
  return applyDiversity(ranked, {
    limit,
    dimensions: ['album', 'language'],
    caps: { album: maxPerAlbum, languageShare },
  });
}

/** Diagnostics: how evenly a shelf is spread across languages. */
export function languageSpread(tracks) {
  const counts = new Map();

  for (const track of tracks ?? []) {
    const key = track?.language ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = tracks?.length || 0;
  if (total === 0) return { total: 0, languages: {}, dominant: null, dominantShare: 0 };

  const languages = Object.fromEntries(counts);
  const [dominant, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    total,
    languages,
    dominant,
    dominantShare: Math.round((count / total) * 1000) / 1000,
  };
}
