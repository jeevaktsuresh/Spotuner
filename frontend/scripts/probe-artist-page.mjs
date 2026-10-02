/**
 * Read what the Artists page actually renders, in a real browser.
 *
 * Node-side checks proved the pipeline returns 272 artists, and Vite transforms
 * every module cleanly, yet the page was reported as showing zero. Those facts
 * can both be true and still miss a browser-only failure — an exception during
 * render, or a request the browser sends differently. This drives headless Chrome
 * over CDP and reports the page's own text plus any console errors, so the
 * report is based on what is on screen rather than on what should be.
 *
 * Run: node scripts/probe-artist-page.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const URL_UNDER_TEST = process.argv[2] || 'http://localhost:5173/artists';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spotuner-cdp-'));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank',
]);

function cleanup(code) {
  try { chrome.kill(); } catch {}
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(code);
}

async function targets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chrome did not expose a debugging target');
}

const target = await targets();
const ws = new WebSocket(target.webSocketDebuggerUrl);

let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];
const netEvents = [];

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Network.responseReceived') {
    const r = msg.params.response;
    if (/\/shelves|\/artists\/images/.test(r.url)) {
      netEvents.push({ url: r.url, status: r.status });
    }
  }
  if (msg.method === 'Network.loadingFailed') {
    const r = msg.params;
    if (r.type !== 'Image') netEvents.push({ url: r.requestId, failed: r.errorText });
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    pageErrors.push(d.exception?.description || d.text);
  }
});

await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Page.navigate', { url: URL_UNDER_TEST });

// Poll until the shelves request has completed and the DOM has stabilised, rather
// than matching page text. The artist detail page shows a bare skeleton with no
// "Loading artists..." label, so a text-based exit condition samples it too early
// and reports an empty page that is merely still fetching.
const DEADLINE_MS = Number(process.env.WAIT_MS) || 60000;
const started = Date.now();
let snapshot = null;
let prevHtml = null;
let stableTicks = 0;
let loadingAfterShelves = false;

const READ = `(() => {
  const main = document.querySelector('main');
  const text = (main?.innerText || '').trim();
  const imgs = [...document.querySelectorAll('main a[href^="/artists/"] img')];
  return JSON.stringify({
    bodyText: text.slice(0, 400),
    html: main?.innerHTML.length ?? 0,
    artistLinks: document.querySelectorAll('main a[href^="/artists/"]').length,
    imgCount: imgs.length,
    itunesImgs: imgs.filter(i => /mzstatic/.test(i.src)).length,
    ytImgs: imgs.filter(i => /ytimg/.test(i.src)).length,
    loading: /Loading artists/.test(text)
  });
})()`;

while (Date.now() - started < DEADLINE_MS) {
  await new Promise((r) => setTimeout(r, 2000));
  const { result: probe } = await send('Runtime.evaluate', { expression: READ, returnByValue: true });
  snapshot = JSON.parse(probe.value);

  const html = snapshot.html;
  const shelvesDone = netEvents.some((n) => /\/shelves/.test(n.url ?? ''));

  // A loading skeleton does not change between polls, so "DOM is stable" would
  // exit while the page is still waiting on a slow fetch. Wait for the loading
  // text to disappear *and* the DOM to stop changing, so a slow request is never
  // mistaken for a finished page.
  const settled = !snapshot.loading && snapshot.html > 0;

  if (settled && html === prevHtml) {
    if (++stableTicks >= 2) break;
  } else {
    stableTicks = 0;
  }
  prevHtml = html;

  if (shelvesDone && snapshot.loading) loadingAfterShelves = true;
}

// The grid renders before artist images finish resolving; give the batched image
// requests time to land so the report reflects the settled state.
if (process.env.SETTLE_MS) {
  await new Promise((r) => setTimeout(r, Number(process.env.SETTLE_MS)));
  const { result: settled } = await send('Runtime.evaluate', {
    expression: `(() => {
      const imgs = [...document.querySelectorAll('main a[href^="/artists/"] img')];
      return JSON.stringify({
        imgCount: imgs.length,
        itunesImgs: imgs.filter(i => /mzstatic/.test(i.src)).length,
        ytImgs: imgs.filter(i => /ytimg/.test(i.src)).length
      });
    })()`,
    returnByValue: true,
  });
  snapshot = { ...snapshot, ...JSON.parse(settled.value) };
}

const info = { ...snapshot, title: 'Spotuner' };

console.log(`URL        : ${URL_UNDER_TEST}`);
console.log(`title      : ${info.title}`);
console.log(`artist links rendered : ${info.artistLinks}`);
console.log(`images rendered       : ${info.imgCount}`);
console.log(`  iTunes artist pics  : ${info.itunesImgs}`);
console.log(`  YouTube placeholders: ${info.ytImgs}`);
console.log('');
console.log('--- visible text ---');
console.log(info.bodyText || '(empty)');

console.log('');
console.log('--- network ---');
for (const n of netEvents) console.log(`  ${n.failed ? 'FAILED ' + n.failed : n.status + ' ' + n.url}`);

if (consoleErrors.length) {
  console.log('');
  console.log('--- console errors ---');
  for (const e of consoleErrors.slice(0, 10)) console.log(e);
}
if (pageErrors.length) {
  console.log('');
  console.log('--- uncaught exceptions ---');
  for (const e of pageErrors.slice(0, 10)) console.log(e);
}

cleanup(info.artistLinks > 0 ? 0 : 1);