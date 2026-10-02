/**
 * Text analysis for the recommendation engine.
 *
 * Two jobs:
 *
 *  1. Language detection from Unicode script blocks. This is the only fully
 *     reliable signal available without a metadata database — a Malayalam
 *     title is written in the Malayalam block, a Tamil title in the Tamil
 *     block, so "is this Malayalam?" can be answered with certainty rather
 *     than guessed from romanised text.
 *  2. Normalisation and tokenisation for keyword matching over Latin text
 *     (Romanised titles, artist names, album names).
 */

/**
 * Unicode ranges that identify a language outright.
 *
 * `latin` is deliberately absent: Latin script carries no language signal, so
 * those titles fall through to keyword detection.
 */
const SCRIPT_RANGES = [
  { language: 'Malayalam', test: /[\u0D00-\u0D7F]/ },
  { language: 'Tamil', test: /[\u0B80-\u0BFF]/ },
  { language: 'Telugu', test: /[\u0C00-\u0C7F]/ },
  { language: 'Kannada', test: /[\u0C80-\u0CFF]/ },
  { language: 'Bengali', test: /[\u0980-\u09FF]/ },
  { language: 'Hindi', test: /[\u0900-\u097F]/ },
  { language: 'Gujarati', test: /[\u0A80-\u0AFF]/ },
  { language: 'Punjabi', test: /[\u0A00-\u0A7F]/ },
  { language: 'Arabic', test: /[\u0600-\u06FF\u0750-\u077F]/ },
  { language: 'Persian', test: /[\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { language: 'Russian', test: /[\u0400-\u04FF]/ },
  { language: 'Greek', test: /[\u0370-\u03FF]/ },
  { language: 'Hebrew', test: /[\u0590-\u05FF]/ },
  { language: 'Japanese', test: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/ },
  { language: 'Korean', test: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { language: 'Chinese', test: /[\u4E00-\u9FFF]/ },
];

/**
 * Latin-script keywords per language.
 *
 * Only consulted when script detection is inconclusive, which is common for
 * romanised South Indian releases. Deliberately narrow: these are genre and
 * language *hints*, not proof, so callers should treat a hit as soft evidence.
 */
const LATIN_KEYWORDS = {
  Malayalam: ['malayalam', 'malayalam', 'kerala', 'manjummelam', 'molladam'],
  Tamil: ['tamil', 'kollywood', 'chennai'],
  Telugu: ['telugu', 'tollywood'],
  Kannada: ['kannada'],
  Hindi: ['hindi', 'bollywood', 'bollywood', 'punjabi', 'remix', 'desi'],
  Punjabi: ['punjabi'],
  English: ['official audio', 'official video', 'lyrics', 'remix', 'cover'],
};

/** Strip bracketed qualifiers that carry no genre or language signal. */
const NOISE_PATTERN =
  /\((?:official\s*)?(?:video|audio|lyrics?|lyric\s*video|hd|hq|remix|live|cover|version|edit|mix|4k)\)|\[[^\]]*\]|\{[^}]*\}|feat\.?[^,]*|&/gi;

function stripAccents(value) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalise for keyword comparison: lowercase, de-accented, punctuation to space.
 *
 * Deliberately Latin-only (`[a-z0-9]`), because its job is to feed English genre
 * and mood lexicons and to give romanised text something to match on. It erases
 * other scripts entirely, so it must not be used for anything that needs to
 * *compare* two non-Latin strings — see `foldForIdentity`.
 */
export function normalize(value) {
  if (!value) return '';
  return stripAccents(String(value))
    .toLowerCase()
    .replace(/['’]/g, '')
    // Drop bracketed qualifiers first; otherwise "(Remix)" reduces to the bare
    // word "remix", which then looks like a genre signal.
    .replace(NOISE_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Characters outside Basic Latin, Latin-1/Extended, and general punctuation. */
const NON_LATIN = /[^\u0020-\u024F\u2000-\u206F]/;

/**
 * Fold a string for *identity* comparison, preserving non-Latin scripts.
 *
 * `normalize` is right for matching English lexicons but wrong for deciding
 * whether two things are the same, because a Malayalam or Tamil artist name
 * reduces to the empty string. That is not a cosmetic loss: artist identity is
 * keyed on this fold, so every non-Latin artist in the catalogue collapses onto
 * the same key. The per-artist diversity cap then treats the entire regional
 * catalogue as one artist and demotes everything past the first couple of
 * tracks, and artist affinity from listening history cannot tell two different
 * Malayalam artists apart.
 *
 * Latin text folds exactly as `normalize` does, so genre, mood and language
 * matching are unaffected.
 */
export function foldForIdentity(value) {
  if (!value) return '';

  const raw = String(value).toLowerCase().replace(NOISE_PATTERN, ' ');

  // Non-Latin scripts have no word spaces, so whitespace is dropped rather than
  // used as a separator: the result is compared as a whole, not tokenised.
  if (NON_LATIN.test(raw)) {
    return raw.replace(/[^\p{L}\p{N}]+/gu, '');
  }

  // Delegated rather than reimplemented, so that Latin text folds exactly as it
  // always has — accent decomposition, apostrophe removal and all. Repeating
  // that logic here previously dropped precomposed accents ("Beyoncé" folded to
  // "beyonc"), which is the kind of drift this delegation exists to prevent.
  return normalize(value);
}

/** Strip bracketed noise while preserving the human-readable string. */
export function stripNoise(value) {
  if (!value) return '';
  return String(value).replace(NOISE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenize(value) {
  const n = normalize(value);
  return n ? n.split(' ').filter((t) => t.length > 1) : [];
}

/**
 * Detect the language of a track.
 *
 * Language classification happens in the backend (`backend/lib/language/`), which
 * has access to the search context, the artist credit, the album and — when a
 * YouTube Data API key is configured — `snippet.defaultAudioLanguage`. The
 * frontend only reads the result.
 *
 * The script and keyword paths below are the historical fallback. They are kept
 * because a track can reach the catalogue through paths that bypass the API
 * (cached shelves, a user's own saved library), and a track with no
 * classification should not silently lose its language. They are deliberately
 * weaker: the API verdict wins whenever it is present and confident.
 *
 * @returns {{language: string, confidence: 'high'|'low'|'unknown'}}
 */
export function detectLanguage(track) {
  const haystack = `${track?.title ?? ''} ${track?.artist ?? ''} ${track?.album ?? ''}`;

  for (const { language, test } of SCRIPT_RANGES) {
    if (test.test(haystack)) return { language, confidence: 'high' };
  }

  // Latin script: look for explicit language markers in the searchable text.
  const normalized = normalize(haystack);

  for (const [language, keywords] of Object.entries(LATIN_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(normalize(kw)))) {
      return { language, confidence: 'low' };
    }
  }

  return { language: 'Unknown', confidence: 'unknown' };
}

/** True when a track's language matches any of `languages` (case-insensitive). */
export function matchesLanguage(track, languages) {
  if (!languages || languages.length === 0) return false;
  const trackLanguage = track?.enriched?.language?.toLowerCase();
  return languages.some((l) => String(l).toLowerCase() === trackLanguage);
}