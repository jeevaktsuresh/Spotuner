/**
 * Unicode script detection by character share.
 *
 * The spec calls for the *percentage* of characters in each script rather than
 * a single-character presence test, and that is the right call: a Malayalam song
 * titled "ഉദി ഉദി (Love)" is mostly Malayalam, and a presence test would score it
 * the same as a title that is one stray character in a mostly-English string.
 * Working in shares also gives a natural confidence — 97% of characters in one
 * script is a far stronger claim than 40%.
 *
 * Combining marks are attributed to the script of their base character, so a
 * Devanagari vowel sign is not counted as an unattributed character.
 */

/**
 * Script blocks, most specific first.
 *
 * `Han` is checked before `Japanese` because Japanese text is largely Han
 * characters, and attributing those to Chinese would be wrong more often than
 * not. `Devanagari` is deliberately not mapped to a single language here:
 * Hindi, Marathi and Sanskrit share the block, and guessing between them from
 * script alone is not possible, so the script is reported and the language is
 * left to the metadata and context layers.
 */
const SCRIPTS = [
  { script: 'malayalam', range: /[\u0D00-\u0D7F]/ },
  { script: 'tamil', range: /[\u0B80-\u0BFF]/ },
  { script: 'telugu', range: /[\u0C00-\u0C7F]/ },
  { script: 'kannada', range: /[\u0C80-\u0CFF]/ },
  { script: 'bengali', range: /[\u0980-\u09FF]/ },
  { script: 'devanagari', range: /[\u0900-\u097F]/ },
  { script: 'gurmukhi', range: /[\u0A00-\u0A7F]/ },
  { script: 'gujarati', range: /[\u0A80-\u0AFF]/ },
  { script: 'arabic', range: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { script: 'hebrew', range: /[\u0590-\u05FF]/ },
  { script: 'cyrillic', range: /[\u0400-\u04FF]/ },
  { script: 'greek', range: /[\u0370-\u03FF]/ },
  { script: 'hangul', range: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { script: 'japanese', range: /[\u3040-\u309F\u30A0-\u30FF]/ },
  { script: 'han', range: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
  { script: 'latin', range: /[A-Za-z\u00C0-\u024F]/ },
];

/**
 * Characters that carry no script evidence and must not be counted in the
 * denominator: digits, punctuation, whitespace, symbols and emoji. Counting them
 * would let "Malare!!!" report a lower Malayalam share simply by having more
 * decoration.
 */
const NEUTRAL = /^[\s\d\p{P}\p{S}\p{Z}\p{C}]+$/u;

/**
 * Combining marks, attributed to their base character's script.
 *
 * Without this, a heavily matras-ed Indic title would report a lower share than
 * it really has, because the vowel signs would fall through as unattributed.
 */
function isCombiningMark(char) {
  return /\p{M}/u.test(char);
}

/**
 * Measure the script composition of a string.
 *
 * @param {string} value
 * @returns {{total: number, scripts: Record<string, {chars: number, share: number}>, dominant: string|null, dominantShare: number}}
 *   `total` is the number of attributed characters; `dominant` is the script
 *   holding the largest share, or null when nothing was attributable.
 */
export function measureScripts(value) {
  const text = String(value ?? '');
  const counts = new Map();
  let total = 0;

  for (const char of text) {
    if (NEUTRAL.test(char)) continue;
    if (isCombiningMark(char)) continue; // Counted with its base character.

    const found = SCRIPTS.find((entry) => entry.range.test(char));
    if (!found) continue;

    counts.set(found.script, (counts.get(found.script) || 0) + 1);
    total += 1;
  }

  const scripts = {};
  for (const [script, chars] of counts) {
    scripts[script] = { chars, share: total > 0 ? chars / total : 0 };
  }

  let dominant = null;
  let dominantShare = 0;
  for (const [script, entry] of Object.entries(scripts)) {
    if (entry.share > dominantShare) {
      dominant = script;
      dominantShare = entry.share;
    }
  }

  return { total, scripts, dominant, dominantShare };
}

/**
 * Detect the script of a single field.
 *
 * @returns {{script: string|null, share: number, mixed: boolean, total: number}}
 *   `mixed` is true when a second script holds a meaningful share, which the
 *   caller treats as a reason to reduce confidence rather than to guess.
 */
export function detectScript(value) {
  const { scripts, dominant, dominantShare, total } = measureScripts(value);

  if (!dominant || total === 0) {
    return { script: null, share: 0, mixed: false, total: 0 };
  }

  const others = Object.entries(scripts)
    .filter(([script]) => script !== dominant)
    .sort((a, b) => b[1].share - a[1].share);

  const runnerUp = others[0];
  const mixed = Boolean(runnerUp && runnerUp[1].share >= 0.15);

  return { script: dominant, share: dominantShare, mixed, total };
}

/**
 * Scripts that map one-to-one onto a language.
 *
 * Devanagari, Gurmukhi, Gujarati, Bengali and Han are excluded: they identify a
 * script but not a single language, so the pipeline must not claim more than it
 * knows from a script alone.
 */
const SCRIPT_TO_CODE = {
  malayalam: 'ml',
  tamil: 'ta',
  telugu: 'te',
  kannada: 'kn',
  bengali: 'bn',
  gurmukhi: 'pa',
  gujarati: 'gu',
  cyrillic: 'ru',
  greek: 'el',
  hebrew: 'he',
  hangul: 'ko',
};

/**
 * Best-effort script-to-language for the unambiguous scripts.
 * @returns a language code, or null when the script does not pin one down
 */
export function codeFromScript(script) {
  return SCRIPT_TO_CODE[script] || null;
}

export { SCRIPTS };
