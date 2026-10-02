/**
 * Artist credit parsing.
 *
 * The `artist` field on a track is a full credit line, not a single performer:
 *
 *   "Jakes Bejoy & Vishal Mishra & Aavani Malhar"
 *   "Anirudh Ravichander & Dhanush"
 *   "Mithoon, Vishal Mishra & Asees Kaur"
 *
 * Grouping tracks by that raw string produced one "artist" per collaboration, so
 * the Artists page listed the same performer several times and buried solo
 * artists behind joint credits. These helpers split a credit into its individual
 * performers and give each a stable identity key.
 */

/**
 * Separators found in real InnerTube credit lines.
 *
 * `&` dominates (95 of 193 unique credits sampled); comma appears occasionally,
 * often without spaces. `feat`/`ft` are included because they are common in
 * YouTube Music credits even though this dataset's sample had none. A bare
 * hyphen is deliberately excluded: "A. R. Rahman" style initialisms and
 * hyphenated names such as "Ajay-Atul" must not be split.
 */
const SEPARATORS = /\s*(?:&|,|\bx\b|\bfeat\.?\b|\bft\.?\b|\bwith\b)\s*/i;

/** Normalize for comparison/dedupe: trim, collapse spaces, casefold. */
export function artistKey(name) {
  return String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * URL form of an artist key.
 *
 * Keys keep literal spaces so identity is never muddied by slug collisions, since
 * a real name may itself contain a hyphen ("Berny-Ignatius", "Ajay-Atul"). This
 * converts a key to the tidy, shareable `/artists/anirudh-ravichander` form.
 *
 * Comparing slugs on both sides is what makes resolution total: a stored key of
 * "anirudh ravichander" and one of "ajay-atul" both resolve from their own slug,
 * and a URL written with a literal space (`/artists/anirudh%20ravichander`) folds
 * to the same slug. Nothing is lost in either direction.
 */
export function artistSlug(key) {
  return String(key ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Split one credit line into individual performer names.
 *
 * Returns an empty array for blank input, and de-duplicates within the line so
 * a repeated performer is only listed once.
 *
 * @param {string} credit
 * @returns {string[]}
 */
export function splitArtistCredit(credit) {
  const text = String(credit ?? '').trim();
  if (!text) return [];

  const parts = text
    .split(SEPARATORS)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    // Drop connector noise that survives the split, e.g. a trailing "and".
    .filter((part) => part && !/^(and|&|,)$/i.test(part));

  const seen = new Set();
  const unique = [];
  for (const part of parts) {
    const key = artistKey(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }

  return unique;
}

/**
 * Roll tracks up into per-artist entries.
 *
 * A collaboration credits every performer, so the track is added to each of their
 * entries — a song by "Jakes Bejoy & Vishal Mishra" appears under both artists,
 * which is the expected behaviour for a credits-based rollup.
 *
 * Each entry carries:
 *   name      display name (first-seen casing wins)
 *   key       stable dedupe/id key (casefolded)
 *   image     the track cover used as a placeholder, so the avatar is never an
 *             empty circle while the real picture loads
 *   isPlaceholder true while `image` is still that cover rather than a resolved
 *             artist picture; useArtists keys off this, never off `image`
 *   tracks    every track credited to this artist, de-duplicated by track id
 *   songCount number of distinct songs
 *
 * @param {object[]} tracks
 * @returns {object[]} artists, most songs first
 */
export function artistsFromTracks(tracks) {
  /** @type {Map<string, {name: string, key: string, image: string|null, tracks: object[], _ids: Set<string>}>} */
  const map = new Map();

  for (const track of tracks ?? []) {
    if (!track) continue;

    const credit = track.artist;
    // `unknown` is the placeholder the search layer uses for a missing credit;
    // it is not an artist and must not become an entry.
    if (!credit || /^(unknown|various artists?)$/i.test(credit.trim())) continue;

    for (const name of splitArtistCredit(credit)) {
      const key = artistKey(name);
      if (!key) continue;

      let entry = map.get(key);
      if (!entry) {
        entry = { name, key, image: null, tracks: [], _ids: new Set() };
        map.set(key, entry);
      }

      // The same track can credit an artist twice across shelves; only count it
      // once so the "N songs" count is truthful.
      const trackId = track.id ?? `${track.source ?? 'yt'}:${track.title}`;
      if (entry._ids.has(trackId)) continue;

      entry._ids.add(trackId);
      entry.tracks.push(track);

      // Any cover is better than an empty circle; the real portrait wins later.
      if (!entry.image && track.image) entry.image = track.image;
    }
  }

  return [...map.values()]
    .map(({ _ids, ...rest }) => ({
      ...rest,
      songCount: rest.tracks.length,
      isPlaceholder: true,
    }))
    .sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name));
}