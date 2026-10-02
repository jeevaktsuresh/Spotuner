/**
 * Multi-layer language detection.
 *
 * Layers, in descending authority, each contributing a bounded weight to a
 * per-language score:
 *
 *   1. YouTube metadata      +50   snippet.defaultAudioLanguage (Data API)
 *   2. Strong Unicode script  +35   a script that pins one language outright
 *   3. Title script          +30   dominant script share of the title
 *   4. Description script    +15   only when Data API supplied a description
 *   5. Known artist          +10   single-language composer / singer (+3 cross)
 *   6. Romanized lexicon      +6   distinctive word per hit
 *   7. Search context        +10   the language the query was authored in
 *
 * Design rules that matter more than the weights:
 *
 *   Search context never overrides contradictory evidence. It is applied last,
 *   scaled down, and explicitly barred from promoting a track past a threshold
 *   that stronger evidence has already ruled out — the exact case the spec calls
 *   out, where a "Malayalam songs" search returns a track YouTube labels ta-IN.
 *
 *   A track with insufficient evidence stays `unknown`. Being confidently
 *   unsorted is better than being confidently wrong, because a wrong track in a
 *   language shelf is a visible bug while a missing one is merely a gap.
 *
 *   Conflict is recorded, never silently resolved.
 */

import { normalizeCode, nameOf, UNKNOWN } from './languages.js';
import { detectScript, codeFromScript } from './script.js';
import { lookupArtists, lookupWords } from './lexicon.js';
import { logDetection, logConflict } from './debug.js';

/** Weight table. Exported so the tests can assert the documented numbers. */
export const WEIGHTS = {
  youtubeMetadata: 50,
  strongScript: 35,
  titleScript: 30,
  descriptionScript: 15,
  knownArtist: 10,
  crossLanguageArtist: 3,
  romanizedWord: 6,
  searchContext: 10,
};

/**
 * Confidence bands. A track lands in a language shelf only above `minConfidence`.
 */
export const BANDS = {
  high: 0.8,
  medium: 0.6,
  low: 0.4,
};

/** Below this, a track is treated as `unknown` and kept out of every shelf. */
export const MIN_CONFIDENCE = BANDS.medium;

/**
 * Ceiling on how much search context may add, relative to real evidence.
 *
 * Search intent describes what the *user* asked for, never what the *recording*
 * is, and a YouTube search for "Malayalam songs" demonstrably returns Tamil
 * tracks. So context is only ever allowed to break a tie or nudge an
 * already-supported verdict, never to establish one.
 */
const SEARCH_CONTEXT_CEILING = 0.5;

/** A second script at this share means the field is genuinely mixed. */
const MIXED_SCRIPT_SHARE = 0.15;

function bandOf(confidence) {
  if (confidence >= BANDS.high) return 'high';
  if (confidence >= BANDS.medium) return 'medium';
  if (confidence >= BANDS.low) return 'low';
  return 'unknown';
}

/**
 * Add weight to a language's running total, tracking which layer contributed.
 */
function award(scores, sources, code, weight, source) {
  if (!code || code === UNKNOWN || weight <= 0) return;
  scores[code] = (scores[code] || 0) + weight;
  if (!sources[code]) sources[code] = new Set();
  sources[code].add(source);
}

/**
 * Detect the language of a single track.
 *
 * @param {object} input
 * @param {string} input.id              YouTube video ID (cache key).
 * @param {string} input.title
 * @param {string} input.artist
 * @param {string} [input.album]
 * @param {string} [input.description]   Data API only; usually absent.
 * @param {string} [input.youtubeLanguage] Raw `defaultAudioLanguage` tag.
 * @param {string[]} [input.searchContexts] Language codes of queries that found it.
 * @param {string[]} [input.additionalContexts] Merged in by the caller on a repeat hit.
 * @returns {object} detection
 */
export function detect(input = {}) {
  const {
    id,
    title = '',
    artist = '',
    album = '',
    description = '',
    youtubeLanguage,
    searchContexts = [],
    additionalContexts = [],
  } = input;

  const contexts = [...new Set([...searchContexts, ...additionalContexts].filter(Boolean))];

  const scores = {};
  const sources = {};

  // --- Layer 1: YouTube metadata -------------------------------------------
  const ytCode = normalizeCode(youtubeLanguage);
  if (ytCode !== UNKNOWN) {
    award(scores, sources, ytCode, WEIGHTS.youtubeMetadata, 'youtube_metadata');
  }

  // --- Layers 2 & 3: Unicode script ---------------------------------------
  const titleScript = detectScript(title);
  const albumScript = detectScript(`${album}`);
  const descriptionScript = detectScript(description);

  // Combined title+album is the "strong" layer: a native-script album name is
  // as good as a native-script title, and song titles are often romanized while
  // the album is not.
  const combinedShare =
    (titleScript.total * titleScript.share + albumScript.total * albumScript.share) /
    (titleScript.total + albumScript.total || 1);

  const combinedScript =
    titleScript.total >= albumScript.total ? titleScript.script : albumScript.script;

  if (combinedScript) {
    const code = codeFromScript(combinedScript);
    if (code) {
      // Weight scales with purity, and is cut when the field is mixed, because
      // "ഉദി ഉദി (Love)" is weaker evidence than "ഉദി ഉദി".
      const purity = Math.min(1, combinedShare / 0.75);
      const mixedPenalty = titleScript.mixed || albumScript.mixed ? 0.6 : 1;
      award(
        scores,
        sources,
        code,
        WEIGHTS.strongScript * purity * mixedPenalty,
        'unicode_script'
      );
    }
  }

  // The dominant script is also scored on the title alone, so a native title in a
  // romanized catalogue still contributes twice-over when both agree.
  if (titleScript.script) {
    const code = codeFromScript(titleScript.script);
    if (code) {
      const purity = Math.min(1, titleScript.share / 0.6);
      award(scores, sources, code, WEIGHTS.titleScript * purity, 'title_script');
    }
  }

  if (descriptionScript.script) {
    const code = codeFromScript(descriptionScript.script);
    if (code) {
      const purity = Math.min(1, descriptionScript.share / 0.5);
      award(scores, sources, code, WEIGHTS.descriptionScript * purity, 'description_script');
    }
  }

  // --- Layer 5: known artists ---------------------------------------------
  const artistHits = lookupArtists(artist);
  for (const hit of artistHits) {
    award(
      scores,
      sources,
      hit.code,
      hit.strong ? WEIGHTS.knownArtist : WEIGHTS.crossLanguageArtist,
      'known_artist'
    );
  }

  // --- Layer 6: romanized lexicon -----------------------------------------
  for (const hit of lookupWords(title)) {
    award(scores, sources, hit.code, WEIGHTS.romanizedWord, 'romanized_lexicon');
  }

  // --- Layer 7: search context --------------------------------------------
  // Applied last and capped, and worth *nothing* when nothing else fired — a
  // track supported only by the query it was found through is reported as
  // `unknown` rather than inheriting the query's language at full confidence.
  const hardEvidence = totalBeforeContext(scores);
  if (hardEvidence > 0 && contexts.length > 0) {
    const contextTotal = contexts.length * WEIGHTS.searchContext;
    const capped = Math.min(contextTotal, hardEvidence * SEARCH_CONTEXT_CEILING);

    for (const code of contexts) {
      if (code === UNKNOWN) continue;
      award(scores, sources, code, capped / contexts.length, 'search_context');
    }
  }

  // --- Resolve -------------------------------------------------------------
  const entries = Object.entries(scores)
    .map(([code, score]) => ({ code, score }))
    .sort((a, b) => b.score - a.score);

  if (entries.length === 0) {
    return finalize({ id, title, artist, code: UNKNOWN, score: 0, total: 0, scores, sources: {}, conflicts: [], contexts, ytCode, titleScript, band: 'unknown' });
  }

  const [winner, runnerUp] = entries;
  const total = entries.reduce((sum, e) => sum + e.score, 0);
  const confidence = total > 0 ? winner.score / total : 0;

  // Conflict: the winner is not the only credible claim, and the two are close
  // enough that a reader should be able to see the disagreement.
  const conflicts = [];
  if (runnerUp && runnerUp.score / winner.score >= 0.6) {
    conflicts.push({ competing: runnerUp.code, runnerUpScore: Number(runnerUp.score.toFixed(1)) });
  }
  if (ytCode !== UNKNOWN && ytCode !== winner.code) {
    conflicts.push({ competing: ytCode, layer: 'youtube_metadata' });
  }
  if (titleScript.script && codeFromScript(titleScript.script) && codeFromScript(titleScript.script) !== winner.code) {
    conflicts.push({ competing: codeFromScript(titleScript.script), layer: 'title_script' });
  }

  const result = finalize({
    id,
    title,
    artist,
    code: confidence >= MIN_CONFIDENCE ? winner.code : UNKNOWN,
    score: winner.score,
    total,
    scores,
    sources,
    conflicts,
    contexts,
    ytCode,
    titleScript,
    band: bandOf(confidence),
    confidence,
  });

  const scriptLabel = titleScript.script
    ? `${titleScript.script} ${(titleScript.share * 100).toFixed(0)}%`
    : 'none (Latin/romanized)';

  logDetection({
    title,
    artist,
    youtubeLanguage: ytCode === UNKNOWN ? null : ytCode,
    scriptLabel,
    searchContexts: contexts,
    finalLanguage: nameOf(result.language),
    confidence: result.languageConfidence,
    sources: result.languageDetectionSource,
  });

  if (result.languageConflict) {
    logConflict({
      title,
      youtubeLanguage: ytCode === UNKNOWN ? null : ytCode,
      detectedScript: titleScript.script,
      searchContexts: contexts,
      finalLanguage: nameOf(result.language),
      confidence: result.languageConfidence,
      detail: result.conflictDetail,
    });
  }

  return result;
}

function totalBeforeContext(scores) {
  return Object.values(scores).reduce((sum, n) => sum + n, 0);
}

/**
 * Shape the public result.
 *
 * The field names are the ones the frontend contract specifies, so no
 * translation layer is needed downstream.
 */
function finalize({
  id,
  title,
  artist,
  code,
  score,
  total,
  scores = {},
  sources,
  conflicts,
  contexts,
  ytCode,
  titleScript,
  band,
  confidence,
}) {
  const resolved = confidence ?? (total > 0 ? score / total : 0);

  return {
    id,
    language: code,
    languageName: nameOf(code),
    languageConfidence: Number(resolved.toFixed(3)),
    languageBand: band || bandOf(resolved),
    languageDetectionSource: [...(sources?.[code] || [])].sort(),

    // Diagnostics. Kept on the object because the spec asks for conflicts to be
    // logged and visible, and a debug endpoint is more useful than a log tail.
    languageConflict: Boolean(conflicts?.length),
    conflictDetail: conflicts?.length ? describeConflicts(conflicts) : null,
    candidates: Object.entries(scores || {})
      .map(([c, s]) => ({ language: c, score: Number(s.toFixed(1)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4),
    searchContexts: contexts || [],
    youtubeLanguage: ytCode === UNKNOWN ? null : ytCode,
    detectedScript: titleScript?.script || null,
    detectedScriptShare: titleScript?.share ? Number(titleScript.share.toFixed(2)) : null,
    evidenceTotal: Number((total || 0).toFixed(1)),
  };
}

function describeConflicts(conflicts) {
  return conflicts
    .map((c) => (c.layer ? `${c.layer}=${c.competing}` : `${c.competing} (${c.runnerUpScore})`))
    .join(', ');
}

export { bandOf, MIXED_SCRIPT_SHARE };
