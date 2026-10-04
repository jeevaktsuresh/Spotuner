/**
 * Which InnerTube clients return a directly usable (unciphered) audio URL?
 *
 * `/player` only hands back plain `url` values to a few clients; the rest return
 * `signatureCipher`, which needs YouTube's deciphering JS to turn into something
 * playable. `resolveStream()` can therefore only use the former, so when playback
 * breaks upstream this script says which clients are still viable instead of
 * leaving it to guesswork.
 *
 *   node scripts/probe-stream-clients.mjs [videoId]
 *
 * Reads the real endpoint, so treat it as a network probe: it is slow-ish, and it
 * is the tool to reach for when `/api/stream/youtube/:id` starts failing.
 */
import { createHttp } from '../lib/runtime/http.js';

const KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const INNERTUBE = 'https://music.youtube.com/youtubei/v1';
const VIDEO_ID = process.argv[2] || 'dQw4w9WgXcQ';

const http = createHttp({ timeout: 15000, headers: { 'Content-Type': 'application/json' } });

const CANDIDATES = [
  { clientName: 'ANDROID_VR', clientVersion: '1.61.48', userAgent: 'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; GB) gzip', extra: { androidSdkVersion: 30 } },
  { clientName: 'ANDROID', clientVersion: '20.10.38', userAgent: 'com.google.android.apps.youtube.music/20.10.38 (Linux; U; Android 12; GB) gzip', extra: { androidSdkVersion: 30 } },
  { clientName: 'ANDROID_TESTSUITE', clientVersion: '1.9', userAgent: 'com.google.android.youtube/1.9 (Linux; U; Android 11) gzip', extra: { androidSdkVersion: 30 } },
  { clientName: 'IOS', clientVersion: '19.29.1', userAgent: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)', extra: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.1.0.22B83' } },
  { clientName: 'TVHTML5', clientVersion: '7.20240724.13.00', userAgent: 'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15', extra: {} },
  { clientName: 'WEB', clientVersion: '2.20240726.00.00', userAgent: null, extra: {} },
  { clientName: 'MWEB', clientVersion: '2.20240726.01.00', userAgent: null, extra: {} },
  { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20240723.01.00', userAgent: null, extra: { clientScreen: 'EMBED' } },
];

let usable = 0;

for (const c of CANDIDATES) {
  const label = `${c.clientName}/${c.clientVersion}`;
  try {
    const res = await http.post(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
      context: { client: { clientName: c.clientName, clientVersion: c.clientVersion, hl: 'en', gl: 'US', ...c.extra } },
      videoId: VIDEO_ID,
      contentCheckOk: true,
      racyCheckOk: true,
    }, { headers: c.userAgent ? { 'User-Agent': c.userAgent } : {} });

    const data = res.data;
    const formats = [...(data?.streamingData?.adaptiveFormats ?? []), ...(data?.streamingData?.formats ?? [])];
    const audio = formats.filter((f) => String(f?.mimeType ?? '').startsWith('audio/'));
    const plain = audio.filter((f) => typeof f.url === 'string' && f.url);
    const ciphered = audio.length - plain.length;
    if (plain.length) usable += 1;

    console.log(
      `${usable ? 'USABLE ' : '       '}${label.padEnd(42)} http=${res.status} ` +
        `audio=${audio.length} unciphered=${plain.length} ciphered=${ciphered} ` +
        `playability=${data?.playabilityStatus?.status ?? 'unknown'}` +
        (plain.length ? ` itags=${plain.map((f) => f.itag).join(',')}` : ''),
    );
  } catch (error) {
    console.log(`       ${label.padEnd(42)} ERROR http=${error?.response?.status ?? 'none'} ${String(error.message).slice(0, 70)}`);
  }
}

console.log(`\n${usable} client(s) returned a directly playable audio url for ${VIDEO_ID}`);