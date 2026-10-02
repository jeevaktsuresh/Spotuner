/**
 * Debug logging for the language pipeline.
 *
 * Gated so it is on during development and off in production without any code
 * change, per the spec. Three gates, in order:
 *
 *   1. `SPOTUNER_LANGUAGE_DEBUG` — explicit override, always wins.
 *   2. `NODE_ENV === 'production'` — off unless explicitly forced on.
 *   3. otherwise on, because this is a development tool.
 *
 * `1`/`0`/`true`/`false` are all accepted so it can be set in a `.env` file,
 * where everything is a string.
 *
 * The flag is read on every call rather than captured at module load: on a Worker
 * the value arrives as a per-request binding, which does not exist yet when this
 * module is first evaluated. `setEnabled()` still overrides everything, which is
 * how the test suites pin it.
 */

import { envFlag, envStr } from '../runtime/env.js';

function readFlag() {
  const raw = envStr('SPOTUNER_LANGUAGE_DEBUG');
  if (raw === null) return null;
  return envFlag('SPOTUNER_LANGUAGE_DEBUG', null);
}

let override = null;

export function setEnabled(value) {
  override = value === null || value === undefined ? null : Boolean(value);
}

export function isEnabled() {
  if (override !== null) return override;

  const flag = readFlag();
  if (flag !== null) return flag;

  return envStr('NODE_ENV') !== 'production';
}

const LABEL = '[Spotuner Language Detection]';
const CONFLICT_LABEL = '[Spotuner Language Conflict]';

/** Per-track line, matching the format the spec asks for. */
export function logDetection({ title, artist, youtubeLanguage, scriptLabel, searchContexts, finalLanguage, confidence, sources }) {
  if (!isEnabled()) return;
  console.log(
    [
      LABEL,
      `Song: ${title}`,
      `Artist: ${artist}`,
      `YouTube Language: ${youtubeLanguage || 'unknown'}`,
      `Unicode Detection: ${scriptLabel}`,
      `Search Context: ${(searchContexts || []).join(', ') || 'none'}`,
      `Final Language: ${finalLanguage}`,
      `Confidence: ${confidence.toFixed(2)}`,
      `Sources: ${(sources || []).join(', ') || 'none'}`,
    ].join('\n'),
  );
}

/** Conflict line, emitted only when two layers actually disagree. */
export function logConflict({ title, youtubeLanguage, detectedScript, searchContexts, finalLanguage, confidence, detail }) {
  if (!isEnabled()) return;
  console.warn(
    [
      CONFLICT_LABEL,
      `Song: ${title}`,
      `YouTube Language: ${youtubeLanguage || 'unknown'}`,
      `Unicode Detection: ${detectedScript || 'none'}`,
      `Search Context: ${(searchContexts || []).join(', ') || 'none'}`,
      `Final Language: ${finalLanguage}`,
      `Confidence: ${confidence.toFixed(2)}`,
      detail ? `Reason: ${detail}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export function logSummary(summary) {
  if (!isEnabled()) return;
  const parts = Object.entries(summary.counts)
    .map(([code, n]) => `${code}=${n}`)
    .join(' ');
  console.log(
    `${LABEL} ${summary.total} tracks: ${parts}` +
      (summary.conflicts ? ` (${summary.conflicts} conflict(s))` : '') +
      (summary.cached ? ` (${summary.cached} from cache)` : ''),
  );
}
