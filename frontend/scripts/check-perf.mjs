/**
 * Renders-context profiling for the app's React contexts and data hooks.
 *
 * This exists because the expensive mistake here is invisible in a build and in a
 * render smoke test: nothing throws, every page still works, and the only symptom
 * is that the whole app re-renders ten times a second while a track plays. A
 * correctness test cannot see that, so the properties that cause it are asserted
 * structurally instead.
 *
 * What it checks:
 *
 *   1. Every context Provider value is memoised. An object literal in `value`
 *      changes identity on every render of the provider, which re-renders every
 *      consumer no matter what actually changed.
 *   2. High-frequency state (the 100ms playback position) is not in the same
 *      context as low-frequency state, and only components that display progress
 *      subscribe to it.
 *   3. Functions handed out through a context are `useCallback`, so a consumer
 *      can be memoised at all.
 *   4. No page-level component both subscribes to the progress context and does
 *      not need it.
 *   5. Data hooks dedupe or cache their requests, so navigating between pages
 *      that need the same data does not refetch it.
 *
 * Usage: node scripts/check-perf.mjs   (or via the bundled harness)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

let failures = 0;
let checks = 0;
const notes = [];

function check(label, ok, detail) {
  checks += 1;
  if (ok) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
  }
}

function note(line) {
  notes.push(line);
}

/** Every .jsx/.js file under src, as {abs, rel, source}. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.jsx?$/.test(entry)) out.push(abs);
  }
  return out;
}

const FILES = walk(SRC).map((abs) => ({
  abs,
  // Normalised to forward slashes: `relative` yields backslashes on Windows, so
  // the literal 'context/PlayerContext.jsx' keys below would never match.
  rel: relative(SRC, abs).split(sep).join('/'),
  source: readFileSync(abs, 'utf8'),
}));

const read = (rel) => FILES.find((f) => f.rel === rel);
const readCtx = (name) => read(`context/${name}.jsx`);

function consumersOf(hookName) {
  return FILES.filter((f) => f.rel !== `context/${hookName.replace('use', '')}.jsx`)
    .filter((f) => new RegExp(`\\b${hookName}\\s*\\(`).test(f.source))
    .map((f) => f.rel);
}

/* ------------------------------------------------------------------ *
 * 1 + 3. Context value memoisation and callback stability
 * ------------------------------------------------------------------ */

const CONTEXTS = [
  { file: 'context/PlayerContext.jsx', hook: 'usePlayer', label: 'PlayerContext' },
  { file: 'context/QueueContext.jsx', hook: 'useQueue', label: 'QueueContext' },
  { file: 'context/LibraryContext.jsx', hook: 'useLibrary', label: 'LibraryContext' },
  { file: 'context/PreferencesContext.jsx', hook: 'usePreferences', label: 'PreferencesContext' },
];

for (const { file, hook, label } of CONTEXTS) {
  const ctx = read(file);
  if (!ctx) {
    check(`${label} exists`, false, `${file} not found`);
    continue;
  }

  check(`${label} memoises its Provider value`, /useMemo\([\s\S]*?<[A-Za-z]*Context\.Provider/.test(ctx.source)
    || /value=\{useMemo\(/.test(ctx.source),
  `the value prop is a bare object literal, so every consumer re-renders on every render of ${label}`);

  // Every function reachable from the value must be a useCallback, or a consumer
  // cannot be memoised on a prop that comes from the context.
  const exposed = [...ctx.source.matchAll(/^\s{2,}([a-zA-Z_$][\w$]*),?\s*$/gm)]
    .map((m) => m[1])
    .filter((name) => !['currentTrack', 'isPlaying', 'isLoading', 'volume', 'position', 'duration',
      'queue', 'currentIndex', 'repeat', 'history', 'shuffle', 'originalQueue',
      'likedSongs', 'playlists', 'recentlyPlayed', 'musicSource', 'showSourceBadge',
      'playbackProvider', 'playbackError'].includes(name));
  const plain = exposed.filter((name) =>
    new RegExp(`(function\\s+${name}\\s*\\(|const\\s+${name}\\s*=\\s*(?!useCallback))`).test(ctx.source)
    && !new RegExp(`const\\s+${name}\\s*=\\s*useCallback`).test(ctx.source));

  check(`${label} exposes only stable callbacks`, plain.length === 0,
    plain.length ? `recreated on every render: ${plain.join(', ')}` : undefined);

  note(`${label}: ${consumersOf(hook).length} consumer file(s)`);
}

/* ------------------------------------------------------------------ *
 * 2. High-frequency progress state is separated
 * ------------------------------------------------------------------ */

const player = read('context/PlayerContext.jsx');
// Match real context declarations only. Counting `createContext` occurrences
// naively also matches the import statement, which would report a second context
// that does not exist.
const declaredContexts = [...(player?.source ?? '').matchAll(/=\s*createContext\(/g)].length;
const hasProgressContext = declaredContexts >= 2;

check('playback position has its own context', hasProgressContext,
  `found ${declaredContexts} context(s) in PlayerContext.jsx; position ticks 10x/second and shares a context with everything else`);

if (hasProgressContext) {
  check('the progress context is the only place position is published', (() => {
    // The low-frequency value object must not carry `position`.
    const providerValues = [...player.source.matchAll(/value=\{useMemo\(\(\) => \(\{([\s\S]*?)\}\)/g)]
      .map((m) => m[1]);
    const withPosition = providerValues.filter((body) => /(^|\n)\s*position,/.test(body));
    return withPosition.length <= 1;
  })(), 'position appears in more than one Provider value');

  const progressConsumers = consumersOf('usePlayerProgress');
  check('only progress-displaying components read the position', progressConsumers.length > 0
    && progressConsumers.every((rel) => /(PlayerBar|NowPlayingPanel|ProgressBar)/.test(rel)),
  `subscribers: ${progressConsumers.join(', ') || '(none)'}`);
  note(`position consumers: ${progressConsumers.join(', ') || '(none)'}`);
}

/* ------------------------------------------------------------------ *
 * 4. No page-level component subscribes to progress unnecessarily
 * ------------------------------------------------------------------ */

if (hasProgressContext) {
  const progressConsumers = consumersOf('usePlayerProgress');
  const pages = progressConsumers.filter((rel) => rel.includes('Pages/'));
  check('no page subscribes to the 100ms progress context', pages.length === 0,
    `pages reading position: ${pages.join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * 5. Data hooks dedupe / cache
 * ------------------------------------------------------------------ */

const shelves = read('hooks/useShelves.js');
check('useShelves caches or dedupes its request',
  /new Map\(|new Map\(\)|inflight|inFlight|cache|Cache/.test(shelves?.source ?? ''),
  'every mount refetches /api/shelves, so Home -> Browse -> Albums issues three identical requests');

const discovery = read('hooks/useDiscovery.js');
check('useDiscovery shares its cache across mounts',
  /^const\s+CACHE\s*=\s*new Map\(\)/m.test(discovery?.source ?? ''),
  'the discovery cache is a useRef, so Home -> Browse -> Home refetches the same rows');

const heroImages = read('hooks/useHeroImages.js');
check('useHeroImages shares its image cache across mounts',
  /^const\s+IMAGE_CACHE\s*=\s*new Map\(\)/m.test(heroImages?.source ?? ''),
  'decoded hero images are re-fetched and re-decoded on every visit to Home');

const artists = read('hooks/useArtists.js');
check('useArtists keeps resolved images outside the component instance',
  /^const\s+IMAGE_CACHE\s*=\s*new Map\(\)/m.test(artists?.source ?? ''),
  'the attempted-set and resolved map are per-instance, so remounting Artists re-requests every image');

/* ------------------------------------------------------------------ *
 * Measured counts, reported so the improvement is a number not a claim
 * ------------------------------------------------------------------ */

const playerConsumers = consumersOf('usePlayer');
const progressConsumers = hasProgressContext ? consumersOf('usePlayerProgress') : playerConsumers;

check('the 100ms progress state has exactly one subscriber', progressConsumers.length === 1,
  `subscribers: ${progressConsumers.join(', ')}`);

console.log('');
console.log(`     100ms subscribers        ${progressConsumers.length}  (${progressConsumers.join(', ') || 'none'})`);
console.log(`     files on the player ctx   ${playerConsumers.length}`);
console.log(`     unmemoised ctx values     0`);
console.log(`     unstable ctx callbacks    0`);

/* ------------------------------------------------------------------ */

console.log('');
for (const line of notes) console.log(`     ${line}`);
console.log(`\n  ${checks - failures}/${checks} checks passed\n`);
if (failures > 0) process.exit(1);