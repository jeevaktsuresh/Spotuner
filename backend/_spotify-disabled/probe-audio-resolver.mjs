/**
 * Live probe for the Spotify -> YouTube resolver.
 *
 * `findMatch` needs no Spotify credentials, only YouTube, so the matching half
 * of the pipeline can be exercised on its own. Audio extraction is deliberately
 * not exercised: it spawns yt-dlp and downloads nothing, so `score`, `videoId`
 * and the chosen title are printed for manual inspection.
 *
 * Run: node scripts/probe-audio-resolver.mjs ["Title" "Artist" "DurationSeconds"]
 */
import * as audioResolver from '../lib/audioResolver.js';

const PROBES = [
  { title: 'Udi Udi', artist: 'Sujith Mohan', duration: 251 },
  { title: 'Ordinary', artist: 'John Doe', duration: 214 },
  { title: 'Believer', artist: 'Imagine Dragons', duration: 214 },
  { title: 'Thunderstruck', artist: 'AC/DC', duration: 292 },
];

if (process.argv[2]) {
  const [title, artist, duration] = process.argv.slice(2);
  PROBES.length = 0;
  PROBES.push({ title, artist, duration: Number(duration) || 0 });
}

let failures = 0;

for (const track of PROBES) {
  const match = await audioResolver.findMatch(track);

  if (!match) {
    console.log(`MISS  "${track.title}" by ${track.artist}`);
    failures += 1;
    continue;
  }

  const flag = match.confidence === 'high' ? 'ok  ' : 'WARN';
  if (match.confidence !== 'high') failures += 1;

  console.log(
    `${flag}  ${match.score.toFixed(2)} [${match.confidence}] "${track.title}" by ${track.artist}\n` +
      `        -> ${match.candidate.title} by ${match.candidate.artist} (${match.candidate.duration}s)\n` +
      `        -> https://music.youtube.com/watch?v=${match.videoId}`
  );
}

console.log(failures === 0 ? '\nAll probes matched.' : `\n${failures} probe(s) weak or unmatched.`);
process.exit(failures === 0 ? 0 : 1);
