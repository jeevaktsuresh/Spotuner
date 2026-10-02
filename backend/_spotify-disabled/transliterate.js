/**
 * Native-script to Latin transliteration for regional catalogues.
 *
 * Why this exists: Spotify tags each recording with a real language and returns
 * Malayalam and Tamil titles in their own script, but YouTube Music returns
 * those same songs with romanized titles. "ഉദി ഉദി" and "Udi Udi" are the same
 * recording, yet no amount of string comparison will ever relate them, because
 * one side is a different alphabet. In practice that made every regional track
 * unresolvable.
 *
 * Transliterating the native side to Latin closes that gap, because the other
 * side is *already* Latin. Only the native-to-Latin direction is needed, which
 * is the tractable one; the reverse is not.
 *
 * This is deliberately a coarse skeleton, not a scholarly transliteration.
 * Romanization is inconsistent in the wild ("ഉദി" appears as "Udi", "Udhi" and
 * "Uddi"), so callers must treat the result as advisory evidence and require
 * independent corroboration — an artist credit or a matching runtime — before
 * playing anything on the strength of it. See `audioResolver.js`.
 *
 * Only the scripts backing the regional shelves are covered. Anything else
 * returns null, and the caller falls back to its existing behaviour.
 */

/**
 * Per-script symbol tables.
 *
 * Each entry is a list of [character, latin] pairs. Vowel signs are listed
 * before independent vowels where they differ only by encoding, so the longest
 * match wins during the scan.
 */
const SCRIPTS = {
  Malayalam: {
    range: /[\u0D00-\u0D7F]/,
    // Independent vowels and vowel signs share most codepoints in appearance;
    // both are listed so either form transliterates.
    pairs: [
      // Multi-character vowel signs first: longest match wins.
      ['ൈ', 'ai'], ['ൗ', 'au'],
      ['ക്ഷ', 'ksha'], ['ജ്ഞ', 'jnya'],
      ['അ', 'a'], ['ആ', 'aa'], ['ഇ', 'i'], ['ഈ', 'ee'], ['ഉ', 'u'], ['ഊ', 'oo'],
      ['ഋ', 'ri'], ['എ', 'e'], ['ഏ', 'ee'], ['ഐ', 'ai'], ['ഒ', 'o'], ['ഓ', 'oo'],
      ['ഔ', 'au'],
      ['ാ', 'a'], ['ി', 'i'], ['ീ', 'ee'], ['ു', 'u'], ['ൂ', 'oo'], ['ൃ', 'ri'],
      ['െ', 'e'], ['േ', 'ee'], ['ൊ', 'o'], ['ോ', 'oo'], ['ൌ', 'au'],
      ['ക', 'k'], ['ഖ', 'kh'], ['ഗ', 'g'], ['ഘ', 'gh'], ['ങ', 'ng'],
      ['ച', 'c'], ['ഛ', 'ch'], ['ജ', 'j'], ['ഝ', 'jh'], ['ഞ', 'ny'],
      ['ട', 't'], ['ഠ', 'th'], ['ഡ', 'd'], ['ഢ', 'dh'], ['ണ', 'n'],
      ['ത', 'th'], ['ഥ', 'th'], ['ദ', 'd'], ['ധ', 'dh'], ['ന', 'n'],
      ['പ', 'p'], ['ഫ', 'ph'], ['ബ', 'b'], ['ഭ', 'bh'], ['മ', 'm'],
      ['യ', 'y'], ['ര', 'r'], ['റ', 'r'], ['ല', 'l'], ['ള', 'l'], ['ഴ', 'zh'],
      ['വ', 'v'], ['ശ', 'sh'], ['ഷ', 'sh'], ['സ', 's'], ['ഹ', 'h'],
      ['ം', 'm'], ['ഃ', 'h'],
    ],
  },
  Tamil: {
    range: /[\u0B80-\u0BFF]/,
    pairs: [
      ['ௌ', 'au'],
      ['ஃ', 'h'],
      ['அ', 'a'], ['ஆ', 'aa'], ['இ', 'i'], ['ஈ', 'ee'], ['உ', 'u'], ['ஊ', 'oo'],
      ['எ', 'e'], ['ஏ', 'ee'], ['ஐ', 'ai'], ['ஒ', 'o'], ['ஓ', 'oo'], ['ஔ', 'au'],
      ['ஸ்ரீ', 'sri'],
      ['ா', 'a'], ['ி', 'i'], ['ீ', 'ee'], ['ு', 'u'], ['ூ', 'oo'],
      ['ெ', 'e'], ['ே', 'ee'], ['ை', 'ai'], ['ொ', 'o'], ['ோ', 'oo'],
      ['க', 'k'], ['ங', 'ng'], ['ச', 'c'], ['ஞ', 'ny'], ['ட', 't'], ['ண', 'n'],
      ['த', 'th'], ['ந', 'n'], ['ப', 'p'], ['ம', 'm'], ['ய', 'y'], ['ர', 'r'],
      ['ல', 'l'], ['வ', 'v'], ['ழ', 'zh'], ['ள', 'l'], ['ற', 'r'], ['ன', 'n'],
      ['ஜ', 'j'], ['ஷ', 'sh'], ['ஸ', 's'], ['ஹ', 'h'],
      ['்', ''],
    ],
  },
};

/** True when the string contains a script this module can transliterate. */
export function isSupported(value) {
  return Object.values(SCRIPTS).some((script) => script.range.test(String(value || '')));
}

/** The name of the supported script found in the string, or null. */
export function detectScript(value) {
  for (const [name, script] of Object.entries(SCRIPTS)) {
    if (script.range.test(String(value || ''))) return name;
  }
  return null;
}

/**
 * Transliterate a native-script string to a rough Latin skeleton.
 *
 * Returns null when the string contains no supported script, so callers can
 * distinguish "nothing to do" from "transliterated to nothing".
 *
 * Chars outside the script are passed through, which lets an already-mixed
 * title like "ഉദി ഉദി (Udi Udi)" keep its Latin parenthetical.
 */
export function transliterate(value) {
  if (!value) return null;

  const source = String(value);
  const scriptName = detectScript(source);
  if (!scriptName) return null;

  const pairs = SCRIPTS[scriptName].pairs;
  let out = '';

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (!SCRIPTS[scriptName].range.test(char)) {
      out += char;
      continue;
    }

    // Longest match first, so a two-character ligature is not consumed as two
    // single symbols.
    let matched = false;
    for (const [symbol, latin] of pairs) {
      if (symbol.length > 1 && source.startsWith(symbol, i)) {
        out += latin;
        i += symbol.length - 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const single = pairs.find(([symbol]) => symbol === char);
    out += single ? single[1] : '';
  }

  return out.replace(/\s+/g, ' ').trim();
}
