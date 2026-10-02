/**
 * Run a fetch from inside the page and report what came back.
 *
 * The Artists page stayed on "Loading artists..." while the network log showed a
 * 200 for /api/shelves. That leaves two very different possibilities — the
 * request hangs in the browser, or it succeeds and React never updates — and only
 * a request issued from page context can tell them apart.
 *
 * Run: node scripts/probe-fetch-in-page.mjs [url]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const PAGE = process.argv[2] || 'http://localhost:5173/artists';
const TARGET = process.argv[3] || 'http://localhost:3001/api/shelves?limit=10';

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spotuner-fetch-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-gpu',
  'about:blank',
]);

const done = (code) => {
  try { chrome.kill(); } catch {}
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(code);
};

async function findTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no debugging target');
}

const ws = new WebSocket((await findTarget()).webSocketDebuggerUrl);
let id = 1;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});

await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = id++;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: PAGE });
await new Promise((r) => setTimeout(r, 3000));

const expression = `
(async () => {
  const started = Date.now();
  try {
    const res = await fetch(${JSON.stringify(TARGET)});
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    return JSON.stringify({
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      isArray: Array.isArray(parsed),
      length: Array.isArray(parsed) ? parsed.length : null,
      firstHasTracks: !!(parsed && parsed[0] && parsed[0].tracks),
      bytes: text.length
    });
  } catch (e) {
    return JSON.stringify({ error: String(e), ms: Date.now() - started });
  }
})()
`;

const { result } = await send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
});

console.log(`page    : ${PAGE}`);
console.log(`fetch   : ${TARGET}`);
console.log(`result  : ${result.value}`);

done(0);