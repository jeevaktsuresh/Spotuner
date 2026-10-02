/**
 * Content-quality filtering for discovery results.
 *
 * YouTube search with the "songs" filter still returns a meaningful amount of
 * non-music: lyric videos, reaction videos, interviews, and Shorts. None of that
 * belongs in a music discovery shelf.
 *
 * Two deliberate constraints:
 *
 *   1. Filters are conservative. A false positive deletes a real song, which is
 *      worse than showing one stray lyric video, so anything ambiguous is kept.
 *   2. Title keywords alone are never enough. "Lyrics" appears in plenty of
 *      genuine titles, so every title match must be corroborated by the channel
 *      name or the Music category before a track is dropped.
 */

import { toDate } from './freshness.js';

/**
 * Non-music title markers.
 *
 * Matched against the title only in combination with a corroborating channel
 * signal, except for a few that are unambiguous on their own ("lyrics" in
 * parentheses, "reaction", "podcast", "interview").
 */
const TITLE_BLOCKLIST = [
  'lyrics',
  'reaction',
  'review',
  'interview',
  'podcast',
  'tutorial',
  'how to',
  'behind the scenes',
  'making of',
  'fan edit',
  'fanmade',
  'mashup',
  'cover by',
  'reaction video',
  'listening to',
  'compilation of',
  'all songs',
  'full album',
  'jumbled',
  'sped up',
  'slowed',
  'nightcore',
  '8d audio',
  'tiktok',
  'ringtone',
  'instrumental version',
  'karaoke',
];

/**
 * Channel markers for channels that are not music channels.
 *
 * Matched case-insensitively. Kept to phrases that are structural rather than
 * topical, so a band called "Cover Band" is not swept up by "cover".
 */
const CHANNEL_BLOCKLIST = [
  'lyrics',
  'lyric video',
  'reaction',
  'review',
  'interview',
  'podcast',
  'tutorial',
  'compilation',
  'fan edit',
  'ringtones',
  '24/7',
  'non stop',
  'nonstop',
];

/**
 * Title markers that indicate the same recording resurfacing rather than a new
 * release. These do NOT block the track; they reduce its new-release score, per
 * the requirement to distinguish a new upload from a new song.
 */
const RERELEASE_MARKERS = [
  'remaster',
  'remastered',
  'remix',
  'live',
  'unplugged',
  'acoustic',
  'instrumental',
  'cover version',
  're-release',
  'rerelease',
  'anniversary',
  'classic',
  'retro',
  'golden',
  'evergreen',
  'throwback',
  'old song',
  'love song',
  'dedication',
  'tribute',
  'legacy',
  'from the archives',
  'restored',
  'full album',
  'all songs',
];

/** Matches the distributor "Topic" channels that carry real released audio. */
const TOPIC_CHANNEL = /\s-\sTopic$/i;

/** `[Official Video]`, `(Lyrics)`, `| Lyrics` etc. */
function hasTitleMarker(text, markers) {
  const lower = ` ${String(text || '').toLowerCase()} `;
  return markers.some((marker) => lower.includes(marker));
}

/**
 * Whether a channel is an auto-generated distributor audio channel.
 *
 * These are YouTube's own uploads of a released single, which makes them the
 * single strongest available evidence that a track is a genuine release rather
 * than an individual's upload.
 */
export function isTopicChannel(channel) {
  return TOPIC_CHANNEL.test(String(channel || '').trim());
}

/**
 * Decide whether a discovered track is actually music we should surface.
 *
 * @returns {{ok: boolean, reason?: string}}
 */
export function assessQuality(track, { minDuration = 60 } = {}) {
  // --- Shorts ---
  // YouTube exposes an explicit `isShortsEligible` flag, which is more reliable
  // than inferring from duration and costs nothing extra since the flag arrives
  // with the metadata already fetched.
  if (track.isShortsEligible) {
    return { ok: false, reason: 'shorts' };
  }

  if (typeof track.duration === 'number' && track.duration > 0 && track.duration < minDuration) {
    // A Topic-channel upload is a released master, so its length is authoritative
    // and is trusted even when short.
    if (!isTopicChannel(track.channel)) {
      return { ok: false, reason: 'shorts' };
    }
  }

  // Live streams are not a release and not a track.
  if (track.isLive) {
    return { ok: false, reason: 'live' };
  }

  // A missing or absurd duration means the record is unusable for playback.
  if (!track.duration || track.duration < 10) {
    return { ok: false, reason: 'no_duration' };
  }

  const category = String(track.category || '').toLowerCase();
  const isMusicCategory = category.includes('music');

  // --- Channel-level rejection ---
  if (hasTitleMarker(track.channel, CHANNEL_BLOCKLIST)) {
    // "... - Topic" channels are legitimate regardless of the name pattern.
    if (!isTopicChannel(track.channel)) {
      return { ok: false, reason: 'non_music_channel' };
    }
  }

  // --- Title markers ---
  if (hasTitleMarker(track.title, TITLE_BLOCKLIST)) {
    // Corroborate: either the channel looks non-musical, or YouTube's category
    // is not Music. A title match alone on an otherwise clean music record is
    // kept, because real songs do get titled "Mashup" or "Tribute".
    if (!isTopicChannel(track.channel) && !isMusicCategory) {
      return { ok: false, reason: 'non_music_title' };
    }
  }

  return { ok: true };
}

/**
 * Evidence that a track is a *new release* rather than an old recording
 * resurfacing. Returned as separate signals so scoring can weight them, rather
 * than a single boolean that throws away the reasoning.
 *
 * @returns {{markers: string[], uploadLagDays: number|null, isTopic: boolean}}
 */
export function releaseEvidence(track) {
  const markers = hasTitleMarker(track.title, RERELEASE_MARKERS)
    ? [hasTitleMarker(track.title, RERELEASE_MARKERS) ? 'title_rerelease_marker' : null].filter(Boolean)
    : [];

  // "Provided to YouTube by <label>" means a distributor delivered this file.
  if (/provided to youtube by/i.test(track.description || '')) {
    markers.push('distributor_delivery');
  }
  if (/auto-generated by youtube/i.test(track.description || '')) {
    markers.push('auto_generated');
  }
  if (isTopicChannel(track.channel)) {
    markers.push('topic_channel');
  }
  // An explicit release date in the description is strong corroboration.
  if (/released on:\s*\d{4}-\d{2}-\d{2}/i.test(track.description || '')) {
    markers.push('released_on_stated');
  }
  if (track.releaseDate) {
    markers.push('has_release_date');
  }

  // Days between the music release and the upload. A large positive gap means
  // the music is old and the file is newly uploaded — a re-upload, not a release.
  //
  // Both dates are coerced because the canonical track shape stores them as ISO
  // strings; calling `.getTime()` on one threw and took the whole discovery run
  // down with it.
  let uploadLagDays = null;
  const uploaded = toDate(track.uploadDate);
  const released = toDate(track.releaseDate);

  if (uploaded && released) {
    const deltaMs = uploaded.getTime() - released.getTime();
    if (Number.isFinite(deltaMs)) uploadLagDays = Math.round(deltaMs / 86400000);
  }

  return { markers: [...new Set(markers)], uploadLagDays, isTopic: isTopicChannel(track.channel) };
}