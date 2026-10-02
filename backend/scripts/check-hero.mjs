/**
 * Regression checks for the hero-image matcher.
 *
 * These assert behaviour that has actually broken before: silent empty query
 * plans, out-of-bounds header reads, and multi-artist credits being scored as
 * mismatches.
 *
 * Run: node scripts/check-hero.mjs
 */
import assert from 'node:assert/strict';
import { parseImageHeader } from '../lib/heroImage/probe.js';
import { buildQueries } from '../lib/heroImage/queries.js';
import { scoreCandidate, fallbackGradient, CONFIDENCE } from '../lib/heroImage/score.js';
import { artistCredited, sameArtist, normalize, similarity } from '../lib/heroImage/text.js';

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

// ---- header parsing -------------------------------------------------------
check('png dimensions', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(4),
    Buffer.from('IHDR'),
    Buffer.from([0, 0, 5, 0, 0, 0, 2, 0]),
  ]);
  assert.deepEqual(parseImageHeader(png), { width: 1280, height: 512, format: 'png' });
});

check('gif dimensions are little-endian', () => {
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([0x40, 0x00, 0x20, 0x00])]);
  assert.deepEqual(parseImageHeader(gif), { width: 64, height: 32, format: 'gif' });
});

check('webp lossy dimensions', () => {
  // Layout: 'RIFF'+size (0-7), 'WEBP' (8-11), chunk 'VP8 ' (12-15),
  // chunk size (16-19), frame tag (20-22), start code 9d 01 2a (23-25),
  // then 14-bit width (26-27) and height (28-29), little-endian.
  const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('WEBPVP8 '),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from([0xd2, 0xbe, 0x01]),
    Buffer.from([0x9d, 0x01, 0x2a]),
    Buffer.from([0x26, 0x02]), // width  = 550
    Buffer.from([0x70, 0x01]), // height = 368
  ]);
  const parsed = parseImageHeader(webp);
  assert.equal(parsed.width, 550);
  assert.equal(parsed.height, 368);
  assert.equal(parsed.format, 'webp');
});

check('non-image bytes rejected', () => {
  assert.equal(parseImageHeader(Buffer.from('not an image')), null);
});

check('truncated avif does not throw', () => {
  const truncated = Buffer.concat([
    Buffer.from([0, 0, 0, 20]),
    Buffer.from('ftypavif'),
    Buffer.from('ispe'),
    Buffer.from([0, 0]),
  ]);
  assert.doesNotThrow(() => parseImageHeader(truncated));
});

check('truncated jpeg does not throw', () => {
  const truncated = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0]), Buffer.from([0x00])]);
  assert.doesNotThrow(() => parseImageHeader(truncated));
});

// ---- query generation -----------------------------------------------------
check('query plan is non-empty', () => {
  const plan = buildQueries({ title: 'KALYANI (Remix)', artist: 'Sushin Shyam', album: 'KALYANI' });
  assert.ok(plan.length > 0, 'query plan must not be empty');
  assert.ok(plan.every((q) => q.query && !q.query.includes('{')), 'no unresolved template keys');
  assert.ok(plan.every((q) => !/undefined/i.test(q.query)), 'no undefined segments');
});

check('missing album does not break queries', () => {
  const plan = buildQueries({ title: 'Udi Udi', artist: 'Aneesh' });
  assert.ok(plan.length > 0);
  assert.ok(plan.every((q) => !/undefined/i.test(q.query)));
});

check('empty metadata yields empty plan', () => {
  assert.equal(buildQueries({}).length, 0);
});

// ---- text matching --------------------------------------------------------
check('noise is stripped', () => {
  assert.equal(normalize('Udi Udi (Remix) [Official Video]'), 'udi udi');
});

check('multi-artist credit counts as credited', () => {
  assert.equal(artistCredited('Arijit Singh', 'Pritam, Arijit Singh & Amitabh Bhattacharya'), true);
});

check('unrelated artist is not credited', () => {
  assert.equal(artistCredited('Arijit Singh', 'Imagine Dragons'), false);
});

check('artist order swap still matches', () => {
  assert.equal(sameArtist('Aneesh & Sarkar & Hruday', 'Hruday, Aneesh, Sarkar'), true);
});

check('unrelated title scores near zero', () => {
  assert.ok(similarity('Udi Udi', 'Believer Imagine Dragons') < 0.2);
});

// ---- scoring --------------------------------------------------------------
const kesariya = { title: 'Kesariya', artist: 'Arijit Singh' };

check('multi-artist credit clears the confidence floor', () => {
  const scored = scoreCandidate(
    {
      title: 'Kesariya',
      artist: 'Pritam, Arijit Singh & Amitabh Bhattacharya',
      official: true,
      probed: { ok: true, width: 1200, height: 1200 },
    },
    kesariya,
  );
  assert.ok(
    scored.score >= CONFIDENCE.MEDIUM,
    `expected >= ${CONFIDENCE.MEDIUM}, got ${scored.score} (${scored.reasons.join(',')})`,
  );
});

check('wrong artist is rejected despite a perfect image', () => {
  const scored = scoreCandidate(
    { title: 'Believer', artist: 'Imagine Dragons', official: true, probed: { ok: true, width: 1920, height: 1080 } },
    kesariya,
  );
  assert.ok(scored.score < CONFIDENCE.MEDIUM, `expected below floor, got ${scored.score}`);
});

check('confirmed square artwork is not double-penalised', () => {
  const withPenalty = scoreCandidate(
    { title: 'Kesariya', artist: 'Arijit Singh', official: true, probed: { ok: true, width: 300, height: 300 } },
    kesariya,
  );
  assert.ok(!withPenalty.reasons.includes('square-only'), 'identity-confirmed square art must not take the shape penalty');
});

check('unrelated square artwork still takes the shape penalty', () => {
  const scored = scoreCandidate({ url: 'u', probed: { ok: true, width: 600, height: 600 } }, kesariya);
  assert.ok(scored.reasons.includes('square-only'));
});

// ---- fallback -------------------------------------------------------------
check('fallback gradient is always renderable', () => {
  const g = fallbackGradient({ title: 'X', artist: 'Y' });
  assert.equal(typeof g.background, 'string');
  assert.ok(g.background.includes('gradient'));
  assert.ok(Array.isArray(g.dominantColors) && g.dominantColors.length >= 2);
});

check('fallback gradient is stable for the same input', () => {
  const a = fallbackGradient({ title: 'X', artist: 'Y' });
  const b = fallbackGradient({ title: 'X', artist: 'Y' });
  assert.equal(a.background, b.background);
});

check('fallback gradient differs across slides', () => {
  const a = fallbackGradient({ title: 'X', artist: 'Y' });
  const b = fallbackGradient({ title: 'Z', artist: 'Q' });
  assert.notEqual(a.background, b.background);
});

console.log('');
console.log(failures === 0 ? 'all hero-image checks passed' : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);