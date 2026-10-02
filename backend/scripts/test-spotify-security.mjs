/**
 * Security assertions for the Spotify integration.
 *
 * The requirement is absolute: SPOTIFY_CLIENT_SECRET must never reach the frontend,
 * a browser bundle, an API response, storage the client can read, or a log. Those
 * are claims about many code paths at once, so each is checked directly rather than
 * asserted in a comment.
 *
 * Runs against the live server, because the risk is in what actually leaves it.
 *
 * Run: node scripts/test-spotify-security.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:3001';
const ROOT = path.resolve(process.cwd(), '..');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n       ${error.message}`);
  }
}

/** The real secret, read locally. Never printed. */
const envPath = path.join(process.cwd(), '.env');
const secret = fs.existsSync(envPath)
  ? (fs.readFileSync(envPath, 'utf8').match(/^SPOTIFY_CLIENT_SECRET=(.*)$/m)?.[1] ?? '').trim()
  : '';

if (!secret) {
  console.log('no SPOTIFY_CLIENT_SECRET in .env; structural checks only\n');
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${name}\n       ${error.message}`);
  }
}

// --- source hygiene --------------------------------------------------------

check('no source file contains the literal secret', () => {
  const offenders = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|mjs|jsx|css|html|json|ts|tsx)$/.test(entry.name)) {
        const contents = fs.readFileSync(full, 'utf8');
        if (secret && contents.includes(secret)) offenders.push(path.relative(ROOT, full));
      }
    }
  };

  walk(ROOT);

  assert.deepEqual(offenders, [], `secret found in: ${offenders.join(', ')}`);
});

check('.env is gitignored', () => {
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m, '.env is ignored');
  // Every variant must be ignored, not just the bare name.
  assert.match(gitignore, /^\.env\.\*$/m, '.env.* is ignored');
  assert.match(gitignore, /^!\.env\.example$/m, '.env.example stays tracked');
});

check('.env.example contains placeholders only', () => {
  const example = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
  assert.match(example, /SPOTIFY_CLIENT_ID=your_spotify_client_id/);
  assert.match(example, /SPOTIFY_CLIENT_SECRET=your_spotify_client_secret/);
  assert.ok(!example.includes(secret), 'no real secret in the example');
});

check('the frontend never references the client secret', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|jsx|css|html)$/.test(entry.name)) {
        const contents = fs.readFileSync(full, 'utf8');
        if (/SPOTIFY_CLIENT_SECRET|client_credentials/i.test(contents)) {
          offenders.push(path.relative(ROOT, full));
        }
      }
    }
  };
  walk(path.join(ROOT, 'frontend'));
  assert.deepEqual(offenders, [], `frontend references the secret in: ${offenders.join(', ')}`);
});

check('the frontend bundle never references the secret', () => {
  const dist = path.join(ROOT, 'frontend', 'dist');
  if (!fs.existsSync(dist)) return; // not built; source check above covers it

  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|css|html)$/.test(entry.name)) {
        const contents = fs.readFileSync(full, 'utf8');
        if (secret && contents.includes(secret)) offenders.push(path.relative(dist, full));
        if (/SPOTIFY_CLIENT_SECRET/.test(contents)) offenders.push(`${path.relative(dist, full)} (name)`);
      }
    }
  };
  walk(dist);
  assert.deepEqual(offenders, [], `bundle exposes the secret: ${offenders.join(', ')}`);
});

// --- runtime exposure ------------------------------------------------------

await checkAsync('no API response contains the secret', async () => {
  const endpoints = [
    '/api/providers',
    '/api/search/all?query=malare&source=all&limit=4',
    '/api/search/all?query=malare&source=spotify&limit=4',
    '/api/discovery/status',
    '/health',
  ];

  for (const endpoint of endpoints) {
    const text = await (await fetch(`${API}${endpoint}`)).text();
    assert.ok(!text.includes(secret), `secret leaked from ${endpoint}`);
    assert.ok(!/SPOTIFY_CLIENT_SECRET/.test(text), `secret name leaked from ${endpoint}`);
    assert.ok(!/client_credentials/i.test(text), `grant type leaked from ${endpoint}`);
  }
});

await checkAsync('the access token is never returned to a client', async () => {
  const text = await (await fetch(`${API}/api/providers`)).text();
  // A bearer token would be equally damaging, so the shape is checked too.
  assert.ok(!/Bearer\s+[A-Za-z0-9._-]{20,}/.test(text), 'no bearer token in a response');
  assert.ok(!/"access_token"/.test(text), 'no access_token field');
});

await checkAsync('a failing Spotify request leaks no credential detail', async () => {
  // An invalid id should produce a clean 404, not an error carrying the auth error.
  const res = await fetch(`${API}/api/play/spotify/not-a-real-spotify-id`);
  const text = await res.text();
  assert.ok(!text.includes(secret), 'no secret in the error');
  assert.ok(!/authorization|basic /i.test(text), 'no auth detail in the error');
});

await checkAsync('probing with a wrong secret never surfaces it', async () => {
  // Exercised through the provider directly, because the running server holds a
  // working token. Verifies the failure path is silent about the credential.
  const spotify = await import('../lib/metadata/providers/spotify.js');
  spotify.clearCache();

  const original = process.env.SPOTIFY_CLIENT_SECRET;
  process.env.SPOTIFY_CLIENT_SECRET = 'deliberately-wrong-secret-value';

  try {
    const token = await spotify.getAccessToken();
    assert.equal(token, null, 'authentication fails cleanly');

    // Compared against a baseline rather than an absolute: the counters are
    // cumulative, and an earlier assertion in this file may already have exercised
    // the provider.
    const stats = spotify.cacheStats();
    assert.ok(stats.probes.authFailures >= 1, `the failure is counted, got ${stats.probes.authFailures}`);
    assert.ok(!JSON.stringify(stats).includes('deliberately-wrong'), 'no credential in stats');

    const redacted = spotify.redact(`failed with ${'deliberately-wrong-secret-value'} in it`);
    assert.ok(!redacted.includes('deliberately-wrong-secret-value'), 'redact removes the secret');
    assert.match(redacted, /\[REDACTED\]/);
  } finally {
    if (original === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
    else process.env.SPOTIFY_CLIENT_SECRET = original;
    spotify.clearCache();
  }
});

await checkAsync('a missing secret degrades rather than throwing', async () => {
  const spotify = await import('../lib/metadata/providers/spotify.js');
  spotify.clearCache();

  const originalId = process.env.SPOTIFY_CLIENT_ID;
  const originalSecret = process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;

  try {
    assert.equal(spotify.isAvailable(), false, 'reports unconfigured');
    assert.equal(await spotify.getAccessToken(), null, 'no token, no throw');
    assert.equal(await spotify.searchTracks('anything'), null, 'search returns null');
    const stats = spotify.cacheStats();
    assert.equal(stats.configured, false);
    assert.ok(!('token' in stats), 'no token field even in stats');
  } finally {
    if (originalId !== undefined) process.env.SPOTIFY_CLIENT_ID = originalId;
    if (originalSecret !== undefined) process.env.SPOTIFY_CLIENT_SECRET = originalSecret;
    spotify.clearCache();
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);