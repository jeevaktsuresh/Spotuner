/**
 * Track identity and de-duplication across providers.
 *
 * The same recording arrives with a different name from every source:
 *
 *   YouTube      "Malare - Vijay Yesudas"
 *   MusicBrainz  "Malare — Vijay Yesudas"
 *
 * They are one track and must not become two candidates. But the aggressive
 * version of that rule is worse than the bug it fixes: collapsing a remix, a
 * live take, an acoustic version or a cover into its studio original silently
 * deletes distinct music, and a listener who searched for the remix cannot find
 * it. So variant markers are treated as part of the identity, not noise to strip.
 *
 * Identity is a three-tier cascade, strongest first:
 *
 *   1. ISRC          an industry code for one specific recording. Authoritative.
 *   2. provider id   MusicBrainz recording id. Authoritative within that source.
 *   3. fuzzy key     normalized title + artist, *including* any variant marker.
 *
 * Pure functions, no I/O, so the rules are directly testable.
 */

/**
 * Markers that make a recording genuinely distinct from another.
 *
 * Kept deliberately narrow. Each entry is a version of the music that someone
 * could reasonably search for by name, so "Malare (Live)" and "Malare" are two
 * different tracks. Words that describe packaging rather than performance
 * ("official video", "4k", "lyrics") are absent — those are upload noise, and
 * pool.js already handles them separately.
 */
const VARIANT_MARKERS = [
  'remix',
  'remaster',
  'remastered',
  'live',
  'acoustic',
  'instrumental',
  'unplugged',
  'cover',
  'karaoke',
  'slowed',
  'reverb',
  'sped up',
  'nightcore',
  'demo',
  'session',
  'version',
  'edit',
  'bootleg',
  'mashup',
  'rework',
  // Format variants. Each is a different master carrying its own ISRC, so
  // treating them as packaging would attach the wrong identifier — a Dolby
  // Atmos mix and the stereo original are not the same recording. Observed
  // directly: MusicBrainz returns both under one title, distinguished only by
  // `disambiguation`.
  'mix',
  'dub',
  'stem',
  'atmos',
  'mono',
  'stereo',
  'radio',
];

/**
 * Upload noise: describes the *file*, never the *recording*.
 *
 * Stripped from titles before comparison, because the same recording is uploaded
 * as "Official Video", "Audio" and "Lyrics" by three different channels and all
 * three are the same track. Version markers are handled separately above and are
 * never stripped.
 */
const PACKAGING_NOISE = [
  'official video',
  'official audio',
  'official song',
  'official music video',
  'lyric video',
  'lyrics video',
  'audio only',
  'full audio',
  'music video',
  'visualizer',
  'official',
  'video',
  'audio',
  'lyrics',
  'lyric',
  'hd',
  'hq',
  '4k',
  '1080p',
  '720p',
  'quality',
  'song',
  'single',
  'album',
];

/** Lowercase, strip diacritics, keep letters and digits. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Split a credit line into individual performers.
 *
 * Mirrors the frontend's `splitArtistCredit` so a YouTube credit and a
 * MusicBrainz credit for the same song produce the same artist list. Kept here
 * as well rather than imported across the app boundary, because the backend
 * cannot depend on frontend source.
 *
 * Note the separator pattern. An earlier version wrapped the separators in
 * optional whitespace, so the bare "x" matched *inside* any word containing that
 * letter: "Max" became "Ma" and "Alex Paul" became "Ale". That silently corrupted
 * artist identity in the diversity cap, so a bare "x" now requires whitespace on
 * both sides *and* something following it.
 */
export function splitArtists(credit) {
  const text = String(credit ?? '').trim();
  if (!text) return [];

  return [
    ...new Set(
      text
        .split(SEPARATOR_PATTERN)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter((part) => part && !/^(and|&|,)$/i.test(part))
        .map((part) => part.toLowerCase()),
    ),
  ];
}

/**
 * Credit separators.
 *
 * `&` and `,` are unambiguous. A bare `x` only counts as a collaboration marker
 * when it stands alone between two names — which is why "Artist X" and "Alex
 * Paul" survive intact.
 */
const SEPARATOR_PATTERN = /\s*(?:&|,|\bx\b(?=\s+\S))\s*/i;

/**
 * The performer a track is attributed to for identity and diversity purposes.
 *
 * A collaboration is credited to whoever leads it, which matches how people
 * describe their listening habits and how the diversity cap decides whether two
 * tracks are "the same artist".
 */
export function leadArtistName(credit) {
  return splitArtists(credit)[0] ?? null;
}

/** Packaging words present in the title. */
function packagingNoise(title) {
  const lower = ` ${normalizeText(title)} `;
  return PACKAGING_NOISE.filter((phrase) => lower.includes(phrase));
}

/** Variant words present in the title. These are *identity*, not noise. */
export function variantMarkers(title) {
  const tokens = normalizeText(title).split(' ').filter(Boolean);
  const found = new Set();

  for (const token of tokens) {
    for (const marker of VARIANT_MARKERS) {
      // "remastered" contains "remaster", so a prefix match catches both without
      // listing every inflection.
      if (token === marker || (token.startsWith(marker) && token.length - marker.length <= 3)) {
        found.add(marker);
      }
    }
  }

  return [...found].sort();
}

/**
 * Tokens that carry the identity of the title, once noise is removed.
 *
 * Drops packaging words, keeps variant markers, and drops tokens so generic they
 * cannot distinguish one song from another.
 *
 * Tokens that merely repeat the artist credit are also dropped, which matters a
 * great deal in practice: "Song Name - Artist Name" is the single most common
 * YouTube upload format, so without this the same recording appears as
 * "Song Name" from one provider and "Song Name Artist Name" from another and the
 * two never de-duplicate.
 */
export function titleTokens(title, artist = '') {
  const noise = new Set(packagingNoise(title));
  const artistTokens = new Set(normalizeText(artist).split(' ').filter(Boolean));

  return normalizeText(title)
    .split(' ')
    .filter((token) => token && !noise.has(token) && token.length > 1)
    .filter((token) => !artistTokens.has(token));
}

/**
 * Fuzzy identity key: normalized title + lead artist.
 *
 * Uses the three longest distinctive tokens rather than all of them, so
 * "Malare (From Moonnam Pakkam)" and "Malare - Moonnam Pakkam" agree while two
 * different songs by the same artist stay apart.
 *
 * The variant marker is appended rather than folded into the token pool, so two
 * versions of one song produce different keys by construction.
 */
export function fuzzyIdentityKey(track) {
  const tokens = titleTokens(track?.title, track?.artist);

  if (tokens.length === 0) return null;

  const distinctive = [...new Set([...tokens].sort((a, b) => b.length - a.length).slice(0, 3))]
    .sort()
    .join(' ');

  const leadArtist = splitArtists(track?.artist)[0] ?? normalizeText(track?.artist).split(' ')[0] ?? '';
  const variant = variantMarkers(track?.title).join('+');

  return `${distinctive}::${leadArtist}${variant ? `::${variant}` : ''}`;
}

/**
 * Rough textual agreement between two titles, 0..1.
 *
 * Compares *distinctive* tokens, not raw ones, so it agrees with
 * `fuzzyIdentityKey`. This matters more than it looks: measuring raw tokens meant
 * "Malare Official Video" scored only 0.33 against "Malare", even though the
 * identity key correctly treats them as the same song. A cross-provider matcher
 * built on that number rated the single most common upload format as a weak match
 * and fell just under the merge threshold.
 *
 * Defined here rather than in normalize.js so the two views of a title cannot
 * drift apart again.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1
 */
export function titleSimilarity(a, b) {
  const tokensA = new Set(titleTokens(a));
  const tokensB = new Set(titleTokens(b));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared += 1;

  return shared / Math.max(tokensA.size, tokensB.size);
}

/**
 * Strongest available identity for a track, as a comparable string.
 *
 * Prefers ISRC, then a provider-native recording id, then the fuzzy key. Used to
 * group candidates that describe one recording across providers.
 *
 * @returns {{level: 'isrc'|'recordingId'|'fuzzy'|'none', key: string|null}}
 */
export function identityOf(track) {
  const isrc = normalizeIsrc(track?.isrc);
  if (isrc) return { level: 'isrc', key: `isrc:${isrc}` };

  const recordingId = track?.musicBrainzId ?? track?.recordingId ?? null;
  if (recordingId) return { level: 'recordingId', key: `mbid:${String(recordingId).toLowerCase()}` };

  const fuzzy = fuzzyIdentityKey(track);
  if (fuzzy) return { level: 'fuzzy', key: `fuzzy:${fuzzy}` };

  return { level: 'none', key: null };
}

/** ISRCs arrive hyphenated or bare; canonical form is 12 alphanumeric characters. */
export function normalizeIsrc(value) {
  if (!value) return null;
  const cleaned = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length === 12 ? cleaned : null;
}

/**
 * Whether two tracks are the same recording, or merely the same song.
 *
 * `sameRecording` is strict: ISRC or recording-id agreement, or a fuzzy match
 * with *no* variant disagreement. This is the predicate that prevents one song
 * becoming two candidates.
 *
 * A fuzzy agreement where one side is a remix and the other is not returns false
 * even though the titles otherwise match, which is the specific failure the
 * variant markers exist to prevent.
 *
 * @returns {{same: boolean, level: string, reason: string}}
 */
export function matchTracks(a, b) {
  if (!a || !b) return { same: false, level: 'none', reason: 'missing track' };

  const idA = identityOf(a);
  const idB = identityOf(b);

  // Two different ISRCs are two different recordings, full stop. This check must
  // come before the fuzzy comparison, or a remix with its own ISRC would still be
  // merged by title.
  if (idA.level === 'isrc' && idB.level === 'isrc') {
    return idA.key === idB.key
      ? { same: true, level: 'isrc', reason: 'identical ISRC' }
      : { same: false, level: 'isrc', reason: 'conflicting ISRCs' };
  }

  // Exactly one side having an ISRC is the *normal* case, not a conflict: YouTube
  // never supplies one. It falls through to the fuzzy comparison, which is safe
  // because the fuzzy key already encodes variant markers — so a remix or a
  // remaster still fails to match on title alone.
  if (idA.level === 'recordingId' && idB.level === 'recordingId') {
    return idA.key === idB.key
      ? { same: true, level: 'recordingId', reason: 'identical recording id' }
      : { same: false, level: 'recordingId', reason: 'different recordings' };
  }

  const keyA = fuzzyIdentityKey(a);
  const keyB = fuzzyIdentityKey(b);

  if (!keyA || !keyB) {
    return { same: false, level: 'fuzzy', reason: 'no usable title' };
  }

  if (keyA !== keyB) {
    return { same: false, level: 'fuzzy', reason: 'different title or artist' };
  }

  // Keys match, so the variant markers already agree by construction — a remix
  // and its original produce different keys. Confirm explicitly anyway, because
  // this is the exact case the whole module exists to protect.
  const variantA = variantMarkers(a?.title);
  const variantB = variantMarkers(b?.title);
  const variantsAgree =
    variantA.length === variantB.length && variantA.every((v, i) => v === variantB[i]);

  if (!variantsAgree) {
    return { same: false, level: 'fuzzy', reason: 'variant markers disagree' };
  }

  return { same: true, level: 'fuzzy', reason: 'normalized title and artist agree' };
}

/**
 * Whether a record can actually be played.
 *
 * An enrichment provider's record never carries a YouTube video id, so this
 * distinction is load-bearing rather than theoretical: choosing the *most
 * complete* record outright can pick the MusicBrainz side of a merge and return a
 * track with no playable id, which fails only at the moment the user presses play.
 */
function isPlayable(track) {
  return Boolean(track?.id ?? track?.youtubeId ?? track?.videoId);
}

/**
 * Collapse tracks that describe one recording, keeping the richest representative.
 *
 * The survivor must be playable, and among playable records it is the one carrying
 * the most metadata — so adding an enrichment provider improves the surviving
 * record instead of replacing it with something that cannot be played.
 *
 * @param {object[]} tracks
 * @param {object} [options]
 * @param {string[]} [options.protectedFields] Fields that make a record more complete.
 * @returns {{tracks: object[], merged: number, groups: Array<object>}}
 */
export function dedupeTracks(tracks, { protectedFields = ['isrc', 'musicBrainzId', 'releaseDate', 'genres'] } = {}) {
  const groups = [];

  for (const track of tracks ?? []) {
    if (!track) continue;

    let placed = false;

    for (const group of groups) {
      const verdict = matchTracks(group.primary, track);
      if (!verdict.same) continue;

      group.members.push(track);

      // Swap only when the newcomer is playable and strictly more informative.
      // A non-playable record never displaces a playable one, however rich.
      if (
        isPlayable(track) &&
        (!isPlayable(group.primary) || completeness(track, protectedFields) > completeness(group.primary, protectedFields))
      ) {
        group.primary = track;
      }

      // Whatever survives, the group's knowledge is not discarded: the kept record
      // absorbs anything it was missing.
      group.primary = fillGaps(group.primary, group.members.find((m) => m !== group.primary) ?? track);

      placed = true;
      break;
    }

    if (!placed) groups.push({ primary: track, members: [track] });
  }

  return {
    tracks: groups.map((g) => g.primary),
    merged: groups.reduce((sum, g) => sum + g.members.length - 1, 0),
    groups,
  };
}

/** How many optional metadata fields a record actually filled in. */
function completeness(track, fields) {
  let score = 0;
  for (const field of fields) {
    const value = track?.[field];
    if (value === null || value === undefined || value === '') continue;
    score += Array.isArray(value) ? (value.length > 0 ? 1 : 0) : 1;
  }
  return score;
}

/** Empty for the same reason normalize.js treats a value as empty. */
function blank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Copy across only the fields the survivor left empty.
 *
 * Deliberately authority-blind: this exists so de-duplication does not *lose* an
 * enrichment provider's contribution when that provider's record is not the one
 * kept. Field authority is a normalize.js concern and is applied earlier, in
 * `enrich()`, which merges into the primary record before de-duplication runs.
 */
function fillGaps(kept, extra) {
  const out = { ...kept };
  for (const [field, value] of Object.entries(extra)) {
    if (blank(value)) continue;
    if (blank(out[field])) out[field] = value;
    else if (Array.isArray(value) && Array.isArray(out[field])) {
      out[field] = [...new Set([...out[field], ...value])];
    }
  }
  return out;
}
