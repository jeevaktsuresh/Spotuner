/**
 * Text normalisation and similarity helpers.
 *
 * The matcher compares metadata that comes from several providers with
 * inconsistent formatting ("Udi Udi (Remix) [Official]", "Aneesh & Sarkar &
 * Hruday"), so every comparison runs through `normalize` first.
 */

/** Bracketed qualifiers that never help identify content. */
const NOISE_PATTERN =
  /\((?:official\s*)?(?:video|audio|lyrics?|lyric\s*video|hd|hq|remix|live|cover|version|edit|mix|feat\.?[^)]*)\)|\[[^\]]*\]|\{[^}]*\}|feat\.?[^,]*|&/gi;

/** Collapse whitespace and strip diacritics for tolerant matching. */
function stripAccents(value) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Reduce a metadata string to its comparable core.
 *
 * Drops bracketed noise ("(Remix)", "[Official Video]"), `feat.` tails,
 * ampersands, and punctuation, then collapses whitespace.
 */
export function normalize(value) {
  if (!value) return '';

  return stripAccents(String(value))
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(NOISE_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Split a normalised string into a token multiset. */
export function tokenize(value) {
  const normalized = normalize(value);
  return normalized ? normalized.split(' ') : [];
}

/** Character bigrams, used for Dice similarity. */
function bigrams(text) {
  const grams = new Set();
  for (let i = 0; i < text.length - 1; i += 1) grams.add(text.slice(i, i + 2));
  return grams;
}

/**
 * Similarity of two metadata strings, 0..1.
 *
 * Uses a token-overlap score blended with a character-bigram Dice score.
 * Token overlap handles word reordering; bigrams catch typos and partial
 * matches where tokens differ ("Udi Udi" vs "Udi Udi Remix").
 */
export function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  // Containment: "Udi Udi" inside "Udi Udi (From ...)" scores very high.
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return 0.75 + 0.25 * ratio;
  }

  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;

  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const tokenScore = shared / union;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let gramShared = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) gramShared += 1;

  const dice = (2 * gramShared) / (leftGrams.size + rightGrams.size || 1);

  return Math.max(tokenScore, dice * 0.95);
}

/** True when the normalised strings are identical. */
export function exactMatch(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(left) && left === right;
}

/**
 * True when the requested artist is credited on the candidate release.
 *
 * Real metadata credits every contributor ("Pritam, Arijit Singh & Amitabh
 * Bhattacharya"), so asking for one artist and receiving a multi-artist credit
 * is the normal, correct outcome — not a partial match. Containment therefore
 * counts as full credit rather than merely "similar".
 */
export function artistCredited(requested, candidate) {
  if (!requested || !candidate) return false;

  const want = normalize(requested);
  const have = normalize(candidate);

  if (!want || !have) return false;
  if (want === have) return true;

  // The requested name appears as a whole run of words in the credit.
  return new RegExp(`(?:^|\\s)${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(have);
}

/**
 * True when two artist strings plausibly describe the same artist.
 *
 * Real metadata disagrees on ordering and separators ("A & B" vs "B, A"), so a
 * containment or high-similarity match counts as a match rather than a
 * "different artist" penalty.
 */
export function sameArtist(a, b) {
  if (!a || !b) return true; // Unknown — never penalise on absent data.
  if (exactMatch(a, b)) return true;
  if (artistCredited(a, b) || artistCredited(b, a)) return true;

  const similarityScore = similarity(a, b);
  if (similarityScore >= 0.72) return true;

  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));

  for (const token of left) {
    if (token.length > 2 && right.has(token)) return true;
  }

  return false;
}