/**
 * Regression checks for the Spotify -> YouTube audio resolver.
 *
 * The resolver's only job is to avoid playing the wrong recording, so these
 * assert the failure modes that actually occur in practice: a live cut or
 * remix out-scoring the studio master, a same-titled song by a different artist
 * winning, and non-Latin regional titles collapsing to a zero score.
 *
 * No network and no credentials needed — the scoring function is pure.
 *
 * Run: node scripts/check-audio-resolver.mjs
 */
import assert from 'node:assert/strict';
import { scoreCandidate, analyzeCandidate } from '../lib/audioResolver.js';

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}\n        ${error.message.split('\n')[0]}`);
  }
}

const studio = { title: 'Ordinary', artist: 'John Doe', duration: 214 };

/** Score every candidate and assert the winner. */
function best(track, candidates) {
  return candidates.reduce((a, b) => (scoreCandidate(track, b) > scoreCandidate(track, a) ? b : a));
}

// ---- version identity ------------------------------------------------------

check('studio master beats the live cut', () => {
  const winner = best(studio, [
    { title: 'Ordinary (Live)', artist: 'John Doe', duration: 268 },
    { title: 'Ordinary', artist: 'John Doe', duration: 214 },
  ]);
  assert.equal(winner.title, 'Ordinary');
});

check('remix does not out-score the original', () => {
  const winner = best(studio, [
    { title: 'Ordinary (Remix)', artist: 'John Doe', duration: 215 },
    { title: 'Ordinary', artist: 'John Doe', duration: 214 },
  ]);
  assert.equal(winner.title, 'Ordinary');
});

check('a live track prefers a live cut', () => {
  const live = { title: 'Ordinary (Live)', artist: 'John Doe', duration: 268 };
  const winner = best(live, [
    { title: 'Ordinary', artist: 'John Doe', duration: 214 },
    { title: 'Ordinary (Live)', artist: 'John Doe', duration: 266 },
  ]);
  assert.equal(winner.title, 'Ordinary (Live)');
});

check('a 10-hour loop is rejected by runtime', () => {
  const loop = { title: 'Ordinary', artist: 'John Doe', duration: 36000 };
  assert.ok(scoreCandidate(studio, loop) < scoreCandidate(studio, studio));
});

// ---- artist identity -------------------------------------------------------

check('same-titled song by another artist loses', () => {
  const winner = best(studio, [
    { title: 'Ordinary', artist: 'Completely Different Band', duration: 214 },
    { title: 'Ordinary', artist: 'John Doe', duration: 214 },
  ]);
  assert.equal(winner.artist, 'John Doe');
});

check('a partial artist credit still matches', () => {
  const track = { title: 'Ordinary', artist: 'Arijit Singh', duration: 214 };
  const winner = best(track, [
    { title: 'Ordinary', artist: 'Pritam, Arijit Singh & Amitabh Bhattacharya', duration: 214 },
    { title: 'Ordinary', artist: 'Some Other Singer', duration: 214 },
  ]);
  assert.match(winner.artist, /Arijit Singh/);
});

check('multi-word artist, reversed order, still matches', () => {
  const track = { title: 'Kal Ho Naa Ho', artist: 'Shankar Mahadevan', duration: 296 };
  const winner = best(track, [
    { title: 'Kal Ho Naa Ho', artist: 'Shankar-Ehsaan-Loy', duration: 296 },
    { title: 'Kal Ho Naa Ho', artist: 'A.R. Rahman', duration: 296 },
  ]);
  assert.equal(winner.artist, 'Shankar-Ehsaan-Loy');
});

// ---- non-Latin scripts -----------------------------------------------------

// The shared normalize() reduces these to empty strings, which used to mean
// every regional candidate scored 0 and the correct video was never chosen.
check('Malayalam title is not scored as zero against its own script', () => {
  const track = { title: 'ഉദി ഉദി', artist: 'സുജിത മോഹൻ', duration: 251 };
  const same = { title: 'ഉദി ഉദി', artist: 'സുജിത മോഹൻ', duration: 251 };
  const wrong = { title: 'വലിയ ഇടവിളി', artist: 'വിജയ് ജയരാമൻ', duration: 251 };

  assert.ok(scoreCandidate(track, same) > 0.9, 'exact script match should score high');
  assert.ok(scoreCandidate(track, wrong) < scoreCandidate(track, same));
});

check('Tamil title is not scored as zero against its own script', () => {
  const track = { title: 'வா வா', artist: 'அனுபன்', duration: 200 };
  const same = { title: 'வா வா', artist: 'அனுபன்', duration: 200 };
  assert.ok(scoreCandidate(track, same) > 0.9);
});

check('a transliterated title still scores, just lower', () => {
  const track = { title: 'ഉദി ഉദി', artist: 'Sujith Mohan', duration: 251 };
  const transliterated = { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 };
  const unrelated = { title: 'വലിയ ഇടവിളി', artist: 'Vijay Yesudas', duration: 251 };

  // Must beat the unrelated track rather than collapse to an identical zero.
  assert.ok(scoreCandidate(track, transliterated) > scoreCandidate(track, unrelated));
});

check('accents do not push a Latin title into script mode', () => {
  // "Beyoncé" must be comparable via the diacritic-tolerant path, not folded
  // into a bigram comparison that scores the accent mismatch poorly.
  const track = { title: ' revelations', artist: 'Beyoncé', duration: 245 };
  const same = { title: 'Revelations', artist: 'Beyonce', duration: 245 };
  assert.ok(scoreCandidate(track, same) > 0.85);
});

check('Devanagari title is not scored as zero', () => {
  const track = { title: 'तुम हो तो', artist: 'अमित सिंह', duration: 240 };
  const same = { title: 'तुम हो तो', artist: 'अमित सिंह', duration: 240 };
  assert.ok(scoreCandidate(track, same) > 0.9);
});

// ---- shared-hook titles ----------------------------------------------------

// A short title that is only the opening hook of a longer one is a different
// song. Both comparison paths reward containment, so this needed an explicit
// discount: "Udi Udi" once scored 0.78 against the unrelated "Udi Udi Jaye".

check('a shared hook does not out-score the full title', () => {
  const track = { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 };
  // A different song that merely opens with the same hook.
  const hookOnly = { title: 'Udi Udi Jaye', artist: 'Sukhwinder Singh', duration: 261 };
  const correct = { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 };

  assert.ok(scoreCandidate(track, correct) > scoreCandidate(track, hookOnly));
  assert.ok(
    scoreCandidate(track, hookOnly) < 0.62,
    `hook-only match should not reach the confident threshold, got ${scoreCandidate(track, hookOnly)}`
  );
});

check('a bracketed qualifier is not treated as a different song', () => {
  const track = { title: 'Kal Ho Naa Ho', artist: 'Shankar Mahadevan', duration: 296 };
  const qualified = { title: 'Kal Ho Naa Ho (From Kal Ho Naa Ho)', artist: 'Shankar Mahadevan', duration: 296 };

  // Trailing qualifiers lengthen the title, so the containment discount applies.
  // It must not demote the match below the confident threshold, because artist
  // and runtime both still agree exactly.
  assert.ok(
    scoreCandidate(track, qualified) >= 0.62,
    `expected a confident match, got ${scoreCandidate(track, qualified)}`
  );
});

check('a native-script hook does not out-score the native-script full title', () => {
  const track = { title: 'உதி', artist: 'சுஜித மோஹன்', duration: 251 };
  const longer = { title: 'உதி உதி ஜெயே', artist: 'சுக்விந்தர் சிங்', duration: 261 };
  assert.ok(scoreCandidate(track, longer) < 0.62);
});

// ---- cross-script matching -------------------------------------------------
// Spotify returns regional titles in their own script; YouTube Music returns
// the same songs romanized. The two can only be related by transliterating the
// native side, which is much weaker evidence and must be gated.

check('a native Malayalam title matches its romanized YouTube title', () => {
  const track = { title: 'ഉദി ഉദി', artist: 'Sujith Mohan', duration: 251 };
  const romanized = { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 };
  const unrelated = { title: 'Aalila Kanna', artist: 'Veena Sujith', duration: 365 };

  assert.ok(
    scoreCandidate(track, romanized) > scoreCandidate(track, unrelated),
    'transliteration should let the true title win'
  );
});

check('romanization spelling variants still match', () => {
  const track = { title: 'ഉദി ഉദി', artist: 'Sujith Mohan', duration: 251 };
  // The same title is romanized inconsistently in the wild.
  const variant = { title: 'Udhi Uddi', artist: 'Sujith Mohan', duration: 251 };
  const other = { title: 'Thunderstruck', artist: 'AC/DC', duration: 292 };

  assert.ok(scoreCandidate(track, variant) > scoreCandidate(track, other));
});

check('a native Tamil title matches its romanized YouTube title', () => {
  const track = { title: 'வா வா', artist: 'Anubhav', duration: 200 };
  const romanized = { title: 'Vaa Vaa', artist: 'Anubhav', duration: 200 };
  const unrelated = { title: 'Believer', artist: 'Imagine Dragons', duration: 214 };

  assert.ok(scoreCandidate(track, romanized) > scoreCandidate(track, unrelated));
});

check('an already-mixed title matches without double-counting', () => {
  const track = { title: 'ഉദി ഉദി (Udi Udi)', artist: 'Sujith Mohan', duration: 251 };
  const romanized = { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 };
  assert.ok(scoreCandidate(track, romanized) > 0.6);
});

// ---- corroboration gate ----------------------------------------------------
// These pin a bug found by live probing: a wrong song ("Udi Udi Jaye" by an
// unrelated artist) was being accepted because its runtime happened to be ten
// seconds from the target. A coincidental runtime is not identity.

check('a coincidental runtime cannot override a wrong artist', () => {
  // 261s against an expected 251s, and a title that is only a hook of it.
  const track = { title: 'ഉദി ഉദി', artist: 'Sujith Mohan', duration: 251 };
  const wrong = { id: 'x', title: 'Udi Udi Jaye', artist: 'Sukhwinder Singh', duration: 261 };

  const analysis = analyzeCandidate(track, wrong);
  assert.equal(analysis.transliterated, true, 'the title only matched via transliteration');
  assert.equal(analysis.corroborated, false, 'a near-miss runtime is not corroboration');
});

check('a matching artist corroborates a transliterated match', () => {
  const track = { title: 'ഉദി ഉദി', artist: 'Sujith Mohan', duration: 251 };
  const right = { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 };

  const analysis = analyzeCandidate(track, right);
  assert.equal(analysis.transliterated, true);
  assert.equal(analysis.corroborated, true);
});

check('a very close runtime plus a real title match corroborates', () => {
  const track = { title: 'ഉദി ഉദി', artist: 'Sujith Mohan', duration: 251 };
  const near = { title: 'Udi Udi', artist: 'Various Artists', duration: 253 };

  const analysis = analyzeCandidate(track, near);
  assert.equal(analysis.corroborated, true);
});

// ---- robustness ------------------------------------------------------------

check('missing duration does not crash or dominate', () => {
  const track = { title: 'Ordinary', artist: 'John Doe', duration: 0 };
  const candidate = { title: 'Ordinary', artist: 'John Doe', duration: 0 };
  const score = scoreCandidate(track, candidate);
  assert.ok(Number.isFinite(score) && score > 0.5);
});

check('a wholly unrelated candidate scores low', () => {
  const score = scoreCandidate(
    { title: 'Ordinary', artist: 'John Doe', duration: 214 },
    { title: 'Thunderstruck', artist: 'AC/DC', duration: 292 }
  );
  assert.ok(score < 0.45, `expected below accept threshold, got ${score}`);
});

console.log(failures === 0 ? '\nAll audio-resolver checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
