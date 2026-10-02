import NodeCache from 'node-cache';
import * as youtube from './youtube.js';
import { similarity, sameArtist, normalize } from './heroImage/text.js';
import { transliterate } from './transliterate.js';

/**
 * Spotify track -> playable audio.
 *
 * The Spotify Web API cannot supply audio, so a Spotify track is only a
 * description of a recording. To actually play one, this finds the best
 * matching video on YouTube Music and hands the ID to yt-dlp, which is already
 * the project's audio path. The two systems therefore never have to agree in
 * advance: Spotify supplies trustworthy metadata, YouTube supplies bytes.
 *
 * The hard part is choosing the right video. Search results for a song title
 * routinely include the live version, a remix, a 10-hour loop and a spoken-word
 * upload, and picking the wrong one is worse than reporting no match at all.
 * Candidates are scored on title, credited artist and runtime, and anything that
 * clears only the weak bar is returned as a low-confidence match so the caller
 * can log or surface it rather than silently playing the wrong recording.
 */

/**
 * A track -> video mapping is stable for a long time, and resolving one costs a
 * YouTube search plus a yt-dlp invocation. Caching for a week removes almost
 * all repeat cost while still recovering if a video is taken down.
 */
const matchCache = new NodeCache({ stdTTL: 60 * 60 * 24 * 7 });

/** Minimum score to play something rather than admit defeat. */
const ACCEPT_SCORE = 0.45;
/** At or above this the match is considered trustworthy. */
const CONFIDENT_SCORE = 0.62;

/**
 * True when a string is written in something other than a Latin script.
 *
 * The shared `normalize()` helper deliberately reduces metadata to `[a-z0-9]`,
 * which erases Indic, Tamil, Greek and Cyrillic titles completely and would
 * silently score every regional candidate as 0. Regional catalogues are the main
 * reason Spotify is being added, so those titles are compared in their own
 * script instead.
 *
 * Accents are decomposed and dropped first, so "Beyoncé" is correctly treated as
 * Latin and keeps using the diacritic-tolerant `similarity()`.
 */
function needsScriptMatch(value) {
  const letters = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\p{L}]/gu, '');

  if (!letters) return false;
  return /[^\u0000-\u024F]/.test(letters);
}

/** Alternate spellings of the same version of a song. */
const VARIANT_PATTERN =
  /\b(remix|rework|bootleg|edit|mix|live|acoustic|instrumental|karaoke|cover|sped|slowed|reverb|8d|nightcore|mashup|medley|dj)\b/i;

/** Case-fold and strip everything that is not a letter or digit, keeping marks. */
function foldForScript(value) {
  if (!value) return '';

  return String(value)
    .toLowerCase()
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function bigrams(text) {
  const grams = new Map();
  for (let i = 0; i < text.length - 1; i += 1) {
    const gram = text.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

/**
 * Dice coefficient over character bigrams in the original script, 0..1.
 *
 * Used for non-Latin titles where token overlap is meaningless because there
 * are no spaces between words. Bigrams are the right unit there: they still
 * score near 1 for a one-character title difference and decay gracefully for
 * the heavy transliteration variation typical of regional titles.
 */
function scriptSimilarity(a, b) {
  const left = foldForScript(a);
  const right = foldForScript(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return left === right ? 1 : 0;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);

  let shared = 0;
  for (const [gram, count] of leftGrams) {
    shared += Math.min(count, rightGrams.get(gram) || 0);
  }

  return (2 * shared) / (left.length + right.length - 2);
}

/**
 * Collapse the spelling variation that romanization introduces.
 *
 * The same Malayalam title appears in the wild as "Udi", "Udhi" and "Uddi", and
 * the same Tamil title as "Vaa" and "Va". Dropping `h` and collapsing repeated
 * letters makes those converge, so one spelling still matches another. This is
 * only ever used to *widen* a cross-script comparison, never to make a match on
 * its own, since folding this aggressively would also flatten genuine words.
 */
function romanizationSkeleton(value) {
  return normalize(value)
    .replace(/h/g, '')
    .replace(/([a-z])\1+/g, '$1');
}

/**
 * Compare a native-script title against a romanized one.
 *
 * YouTube Music presents Malayalam and Tamil songs in Latin script, so the two
 * sides of a regional comparison are in different alphabets and neither the
 * shared `similarity` nor the bigram comparison can relate them. Transliterating
 * the native side to Latin puts both into the same alphabet, which is the only
 * way these can ever match.
 *
 * Returns `transliterated: true` so the caller knows the match rests on this
 * weaker evidence and can require corroboration before playing it.
 */
function crossScriptScore(native, latin) {
  const skeleton = transliterate(native);
  if (!skeleton) return { score: 0, transliterated: false };

  const direct = similarity(skeleton, latin);
  const tolerant = similarity(romanizationSkeleton(skeleton), romanizationSkeleton(latin));

  return { score: Math.max(direct, tolerant * 0.95), transliterated: true };
}

/**
 * Title comparison, reporting whether transliteration was involved.
 *
 * Three cases, because a regional comparison can be same-script either way,
 * cross-script, or neither.
 */
function analyzeTitle(a, b) {
  if (!a || !b) return { score: 0, transliterated: false };

  const aNative = needsScriptMatch(a);
  const bNative = needsScriptMatch(b);

  // Both in the same non-Latin script: compare directly.
  if (aNative && bNative) return { score: scriptSimilarity(a, b), transliterated: false };

  // Mixed: one side native, the other Latin. Transliterate the native side.
  if (aNative) return crossScriptScore(a, b);
  if (bNative) return crossScriptScore(b, a);

  return { score: similarity(a, b), transliterated: false };
}

/** Title comparison that stays meaningful for non-Latin scripts. */
function titleScore(a, b) {
  return analyzeTitle(a, b).score;
}

/**
 * Runtime agreement, 0..1.
 *
 * Runtime is the most reliable single signal for version identity: a live cut
 * or extended mix is almost always minutes away from the studio runtime, while
 * two uploads of the same master agree to within a second or two.
 */
function durationScore(expected, actual) {
  if (!expected || !actual) return 0.5; // Unknown — neutral, never penalise.
  if (expected < 30) return 0.5; // Too short to be meaningful.

  const delta = Math.abs(expected - actual);

  if (delta <= 4) return 1;
  if (delta <= 12) return 0.8;
  if (delta <= 30) return 0.45;
  if (delta <= 60) return 0.15;
  return 0;
}

/**
 * Discount a title that is merely a substring of a longer one, 0..1.
 *
 * Both comparison paths treat containment as strong evidence — "Kal Ho Naa Ho"
 * inside "Kal Ho Naa Ho (From Kal Ho Naa Ho)" genuinely is the same song. But a
 * short title that is only the opening hook of a longer one is usually a
 * *different* song: "Udi Udi" against "Udi Udi Jaye" is a different recording by
 * a different artist, and without this discount it scores as a near-match.
 *
 * The ratio of lengths is the discriminator. A qualifier in brackets barely
 * lengthens the title, whereas an extra title clause roughly doubles it.
 */
function containmentPenalty(requested, candidate) {
  const left = foldForScript(requested);
  const right = foldForScript(candidate);

  if (!left || !right || left === right) return 1;
  if (!left.includes(right) && !right.includes(left)) return 1;

  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  const ratio = shorter.length / longer.length;

  if (ratio >= 0.8) return 1;
  if (ratio >= 0.6) return 0.6;
  return 0.3;
}

/**
 * Score one YouTube candidate against the Spotify track.
 *
 * Weights favour the artist credit and the runtime over the raw title string,
 * because a title can be copied verbatim onto the wrong video while a matching
 * artist and matching runtime together are much harder to fake.
 *
 * `transliterated` reports that the title comparison only worked after
 * converting a native script to Latin. That is inherently weaker evidence, so
 * `findMatch` refuses to play such a candidate unless the artist or the runtime
 * independently agrees.
 */
/**
 * Score one YouTube candidate against the Spotify track in full.
 *
 * Exported so the corroboration gate can be tested directly: `scoreCandidate`
 * alone would hide the `transliterated` and `corroborated` decisions that decide
 * whether a match is playable.
 */
export function analyzeCandidate(track, candidate) {
  const titleMatch = analyzeTitle(track.title, candidate.title);
  const title = titleMatch.score * containmentPenalty(track.title, candidate.title);
  const artistCredited = sameArtist(track.artist, candidate.artist);
  const artist = artistCredited ? 1 : titleScore(track.artist, candidate.artist);
  const timing = durationScore(track.duration, candidate.duration);

  let score = title * 0.45 + artist * 0.35 + timing * 0.2;

  // A remix of the requested track is a different recording, and vice versa.
  // Runtime already penalises most of these, so this is a compounding nudge.
  const wantVariant = VARIANT_PATTERN.test(track.title || '');
  const haveVariant = VARIANT_PATTERN.test(candidate.title || '');
  if (wantVariant !== haveVariant) score *= 0.7;

  // Corroboration, independent of how the title matched.
  const durationDelta =
    track.duration && candidate.duration
      ? Math.abs(track.duration - candidate.duration)
      : null;

  // An artist credit is proof. A runtime is only corroboration when it is very
  // close *and* the title genuinely lines up: a 10-second difference on a
  // four-minute track is coincidence, not identity, and a coincidental runtime
  // must never be able to override a plainly wrong artist.
  const runtimeAgrees = durationDelta !== null && durationDelta <= 5;

  return {
    score,
    transliterated: titleMatch.transliterated,
    titleScore: title,
    corroborated: artistCredited || (runtimeAgrees && title >= 0.7),
  };
}

/** Score one YouTube candidate against the Spotify track, 0..1. */
export function scoreCandidate(track, candidate) {
  return analyzeCandidate(track, candidate).score;
}

/**
 * The queries to try, in order of preference.
 *
 * YouTube Music's index is romanized even for regional music: it answers a
 * Malayalam title with "Aalila Kanna", not the script that was asked for. So
 * when the track title is not in Latin script, the *transliterated* title is
 * the better query, and the native one is kept as a fallback because some
 * uploads are titled natively after all.
 *
 * The artist-only query is a last resort: it cannot identify a track on its
 * own, but for a regional track whose title matches nothing it is the only way
 * the right recording appears in the candidate pool at all.
 */
function buildQueries(track) {
  const title = String(track.title || '').trim();
  const artist = String(track.artist || '').trim();

  const romanized = transliterate(title);
  const nativeFirst = needsScriptMatch(title);

  const queries = [];

  if (nativeFirst && romanized) queries.push(`${romanized} ${artist}`.trim());
  queries.push(`${title} ${artist}`.trim());

  if (nativeFirst && romanized) queries.push(romanized);
  queries.push(title);

  if (artist) queries.push(artist);

  // Preserve order while dropping the empty and duplicate queries that arise
  // when a title is already Latin.
  return [...new Set(queries.filter(Boolean))];
}

/**
 * Run the queries and return the union of their candidates, de-duplicated by
 * video ID. A failure in any one query is survivable, so results are collected
 * as they land rather than aborting the whole resolve.
 */
async function searchCandidates(track) {
  const queries = buildQueries(track);
  const byId = new Map();

  const settled = await Promise.allSettled(
    queries.map((query) => youtube.search(query, 8).catch((error) => {
      console.error(`Audio resolve search failed for "${query}":`, error.message);
      return [];
    }))
  );

  for (const result of settled) {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
    for (const candidate of result.value) {
      if (candidate?.id && !byId.has(candidate.id)) byId.set(candidate.id, candidate);
    }
  }

  return [...byId.values()];
}

/**
 * Find the best YouTube video for a Spotify track.
 *
 * Returns `{ videoId, score, confidence, candidate }`, or null when nothing
 * clears the accept threshold. `confidence` is `'high'` or `'low'`; a low
 * result is still playable but is reported separately so a bad mapping is
 * visible instead of being mistaken for a clean match.
 */
export async function findMatch(track) {
  if (!track?.title) return null;

  // node-cache rejects a non-string key, so a track without an id is still
  // resolvable — it just cannot be cached or deduplicated.
  const cacheKey = track.id ? `match:${track.id}` : null;
  if (cacheKey) {
    const cached = matchCache.get(cacheKey);
    if (cached) return cached;
  }

  const candidates = await searchCandidates(track);

  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best = null;
  for (const candidate of candidates) {
    if (!candidate?.id) continue;
    const analysis = analyzeCandidate(track, candidate);
    if (!best || analysis.score > best.score) best = { ...analysis, candidate };
  }

  if (!best || best.score < ACCEPT_SCORE) {
    console.warn(
      `No YouTube match for "${track.title}" by ${track.artist} (best score ${best?.score?.toFixed(2) ?? 'n/a'})`
    );
    return null;
  }

  // A transliterated title match is a guess about spelling, not about identity.
  // Requiring the artist or the runtime to agree independently means a regional
  // track can resolve, but never on the strength of transliteration alone.
  if (best.transliterated && !best.corroborated) {
    console.warn(
      `Refusing transliteration-only match for "${track.title}" by ${track.artist} ` +
        `-> "${best.candidate.title}" (${best.score}, no corroborating artist or runtime)`
    );
    return null;
  }

  const match = {
    videoId: best.candidate.id,
    score: Number(best.score.toFixed(3)),
    // A corroborated transliteration match is real, but it should not be
    // reported as confidently as a direct same-script match.
    confidence:
      best.score >= CONFIDENT_SCORE && !(best.transliterated && !best.corroborated)
        ? 'high'
        : 'low',
    transliterated: best.transliterated,
    candidate: best.candidate,
  };

  if (cacheKey) matchCache.set(cacheKey, match);

  if (match.confidence === 'low') {
    console.warn(
      `Low-confidence match for "${track.title}" -> https://music.youtube.com/watch?v=${match.videoId} (${match.score})`
    );
  }

  return match;
}

/**
 * Full resolve for a Spotify track: metadata lookup, YouTube match, then the
 * actual stream URL from yt-dlp.
 *
 * Only the final URL is short-lived, so a cached match still re-resolves the
 * stream on every call and a rotated or expired URL cannot stick.
 */
export async function resolveAudioForTrack(track) {
  const match = await findMatch(track);
  if (!match) return null;

  const streamUrl = await youtube.resolveStream(match.videoId);

  return {
    streamUrl,
    videoId: match.videoId,
    score: match.score,
    confidence: match.confidence,
    matchedTitle: match.candidate.title,
    matchedArtist: match.candidate.artist,
  };
}

/** Build the search query a track would use, exposed for diagnostics. */
export function describeQuery(track) {
  return [normalize(track?.title), normalize(track?.artist)].filter(Boolean).join(' · ');
}
