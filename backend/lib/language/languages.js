/**
 * Language registry.
 *
 * The single source of truth for language identity in the detection pipeline.
 * Detection, scoring, filtering and logging all resolve codes through here, so
 * a code can never mean two different things in two different modules.
 *
 * Codes are ISO 639-1 wherever one exists. `und` (undefined) is the
 * "could not determine" value and is deliberately *not* a language: a track that
 * lands on it is excluded from every language shelf rather than being guessed
 * into one.
 */

/** Every language Spotuner classifies, with the scripts that indicate it. */
export const LANGUAGES = {
  ml: { name: 'Malayalam', native: 'മലയാളം', scripts: ['malayalam'] },
  ta: { name: 'Tamil', native: 'தமிழ்', scripts: ['tamil'] },
  hi: { name: 'Hindi', native: 'हिन्दी', scripts: ['devanagari'] },
  kn: { name: 'Kannada', native: 'ಕನ್ನಡ', scripts: ['kannada'] },
  te: { name: 'Telugu', native: 'తెలుగు', scripts: ['telugu'] },
  bn: { name: 'Bengali', native: 'বাংলা', scripts: ['bengali'] },
  pa: { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', scripts: ['gurmukhi'] },
  gu: { name: 'Gujarati', native: 'ગુજરાતી', scripts: ['gujarati'] },
  mr: { name: 'Marathi', native: 'मराठी', scripts: ['devanagari'] },
  ur: { name: 'Urdu', native: 'اردو', scripts: ['arabic'] },
  ar: { name: 'Arabic', native: 'العربية', scripts: ['arabic'] },
  ru: { name: 'Russian', native: 'Русский', scripts: ['cyrillic'] },
  el: { name: 'Greek', native: 'Ελληνικά', scripts: ['greek'] },
  he: { name: 'Hebrew', native: 'עברית', scripts: ['hebrew'] },
  fa: { name: 'Persian', native: 'فارسی', scripts: ['arabic'] },
  ja: { name: 'Japanese', native: '日本語', scripts: ['japanese'] },
  ko: { name: 'Korean', native: '한국어', scripts: ['hangul'] },
  zh: { name: 'Chinese', native: '中文', scripts: ['han'] },
  en: { name: 'English', native: 'English', scripts: ['latin'] },
  unknown: { name: 'Unknown', native: '', scripts: [] },
};

export const UNKNOWN = 'unknown';

/** Devanagari and Gurmukhi overlap for Hindi/Punjabi/Marathi; see script.js. */
export const CODE_TO_NAME = Object.fromEntries(
  Object.entries(LANGUAGES).map(([code, meta]) => [code, meta.name]),
);

export function nameOf(code) {
  return CODE_TO_NAME[code] || LANGUAGES.unknown.name;
}

export function isKnown(code) {
  return Boolean(code) && code !== UNKNOWN && code in LANGUAGES;
}

/**
 * Normalise a language tag to a registry code.
 *
 * YouTube and the Data API both emit tags like `ml-IN`, `ta`, `en-US` and
 * occasionally `und` or garbage. Only the primary subtag is meaningful for
 * these, so `ml-IN` and `ml` collapse to the same code.
 *
 * @returns a registry code, or `unknown` when nothing usable is present
 */
export function normalizeCode(tag) {
  if (!tag) return UNKNOWN;

  const raw = String(tag).trim().toLowerCase();
  if (!raw || raw === 'und' || raw === 'unknown' || raw === 'zxx') return UNKNOWN;

  const primary = raw.split(/[-_]/)[0];

  // A handful of legacy or region-specific tags that do not map to themselves.
  const aliases = {
    in: 'id', // Indonesian, not "India"
    iw: 'he',
    ji: 'yi',
    tl: 'fil',
  };

  const code = aliases[primary] || primary;
  return code in LANGUAGES && code !== UNKNOWN ? code : UNKNOWN;
}

/**
 * Normalise a free-text language name to a code.
 *
 * Used for search-context plumbing, where the query is authored by a human
 * ("Malayalam songs") rather than by YouTube.
 */
export function codeFromName(name) {
  if (!name) return UNKNOWN;
  const needle = String(name).trim().toLowerCase();
  if (!needle) return UNKNOWN;

  for (const [code, meta] of Object.entries(LANGUAGES)) {
    if (code === UNKNOWN) continue;
    if (meta.name.toLowerCase() === needle) return code;
  }
  return UNKNOWN;
}
