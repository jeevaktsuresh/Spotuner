/**
 * Candidate pooling and de-duplication.
 *
 * Ten overlapping queries return the same video many times over. Pooling first
 * means each video is hydrated once, scored once, and rendered once — and it
 * turns "how many independent queries surfaced this" into a real signal, since a
 * track found by six queries is a different kind of evidence than one found by a
 * single query.
 *
 * Two identities are maintained:
 *   videoId             exact — the same upload seen twice
 *   normalized title+artist  fuzzy — a different upload of the same recording
 *
 * The second matters because labels re-upload the same song to different channels,
 * and showing three copies of one track would read as broken.
 */

/** Lowercase, strip punctuation and diacritic-ish noise, collapse whitespace. */
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Tokens that add no identifying power to a title key. */
const STOP_TOKENS = new Set([
  'the', 'a', 'an', 'feat', 'ft', 'featuring', 'official', 'video', 'audio',
  'song', 'lyrics', 'lyric', 'hd', 'hq', 'remastered', 'remaster', 'version',
  'from', 'with', 'and', 'music', 'video', 'full', 'hd1080p', '1080p',
]);

/**
 * Build the fuzzy identity key for a track.
 *
 * Keeps the two most distinctive tokens of the title plus the lead artist, so
 * "Malare (From Moonnam Pakkam)" and "Malare - Moonnam Pakkam" collapse together
 * while two different songs by the same artist stay separate.
 */
export function identityKey(track) {
  const titleTokens = normalizeText(track.title)
    .split(' ')
    .filter((t) => t && !STOP_TOKENS.has(t) && t.length > 1);

  // Distinctive tokens first, then the first two in original order.
  const sorted = [...titleTokens].sort((a, b) => b.length - a.length);
  const distinctive = sorted.slice(0, 3);

  const title = [...new Set(distinctive)].sort().join(' ');
  const artist = normalizeText(track.artist).split(' ')[0] ?? '';

  if (!title) return null;
  return `${title}::${artist}`;
}

/**
 * Merge search results from many queries into one candidate list.
 *
 * @param {Array<{query: string, tracks: object[]}>} resultSets
 * @returns {object[]} pooled candidates carrying query provenance
 */
export function poolCandidates(resultSets) {
  /** @type {Map<string, object>} keyed by videoId */
  const byVideo = new Map();
  /** @type {Map<string, string>} identity key -> videoId */
  const byIdentity = new Map();

  for (const { query, tracks } of resultSets) {
    const seenInThisQuery = new Set();

    (tracks || []).forEach((track, index) => {
      if (!track?.id) return;

      const existing = byVideo.get(track.id);

      if (existing) {
        // Count each query at most once, so a page that repeats a video cannot
        // inflate its cross-query presence.
        if (!seenInThisQuery.has(track.id)) {
          existing.queryCount += 1;
          existing.discoverySources.push(query);
          seenInThisQuery.add(track.id);
        }
        existing.bestRank = Math.min(existing.bestRank, index + 1);
        // Keep the richest metadata seen for this video.
        if (!existing.album && track.album) existing.album = track.album;
        if (!existing.playCount && track.playCount) existing.playCount = track.playCount;
        return;
      }

      const key = identityKey(track);
      const duplicateOf = key ? byIdentity.get(key) : undefined;

      if (duplicateOf && duplicateOf !== track.id) {
        // A different upload of a recording already in the pool. Fold it into
        // the incumbent as corroboration and keep the better-ranked one.
        const incumbent = byVideo.get(duplicateOf);
        if (incumbent) {
          if (!seenInThisQuery.has(duplicateOf)) {
            incumbent.queryCount += 1;
            incumbent.discoverySources.push(query);
            incumbent.duplicateUploads += 1;
            seenInThisQuery.add(duplicateOf);
          }
          incumbent.bestRank = Math.min(incumbent.bestRank, index + 1);
        }
        return;
      }

      const candidate = {
        ...track,
        queryCount: 1,
        bestRank: index + 1,
        discoverySources: [query],
        identityKey: key,
        duplicateUploads: 0,
      };

      byVideo.set(track.id, candidate);
      if (key) byIdentity.set(key, track.id);
      seenInThisQuery.add(track.id);
    });
  }

  return [...byVideo.values()];
}