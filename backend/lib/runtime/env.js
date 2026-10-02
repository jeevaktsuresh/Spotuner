/**
 * Runtime environment access.
 *
 * Cloudflare Workers has no `process.env`. Bindings and secrets arrive per request
 * on the handler's `env` object, and ESM evaluates every import *before* the
 * handler body runs — which is the same ordering trap that made this project read
 * Spotify credentials lazily inside functions.
 *
 * So this module holds the bindings, and everything reads through it:
 *
 *   Worker     `installEnv(env)` runs in Hono middleware before any route body,
 *              so by the time a lib module asks for a value the bindings are there.
 *   Node       with no bindings installed, reads fall through to `process.env`, so
 *              the Express fallback server, the CLI probes and the test suites all
 *              keep working untouched — including their habit of mutating
 *              `process.env` mid-run.
 *
 * Everything is read lazily through a function call. That is deliberate: it is the
 * only form that is correct in both runtimes without a re-initialisation dance.
 */

/** @type {Record<string, unknown>|null} */
let bindings = null;

/**
 * Install the current request's Worker bindings.
 *
 * Called on every request, so a value changed through `wrangler secret put` (or a
 * redeploy that reaches an existing isolate) is picked up without a restart.
 *
 * @param {Record<string, unknown>} env
 */
export function installEnv(env) {
  bindings = env ?? null;
}

/** Drop the installed bindings. Used by tests that assert on the Node fallback. */
export function resetEnv() {
  bindings = null;
}

/** Whether Worker bindings are currently installed. */
export function hasBindings() {
  return bindings !== null;
}

/**
 * The raw value for a key: Worker binding first, then `process.env`.
 *
 * Never throws and never returns a non-string binding coerced to something
 * surprising — booleans and numbers are legal Worker vars and are stringified by
 * the callers that want text.
 *
 * @param {string} key
 * @returns {string|undefined}
 */
export function raw(key) {
  if (bindings && key in bindings && bindings[key] !== undefined && bindings[key] !== null) {
    return bindings[key];
  }

  const proc = globalThis.process;
  if (proc && proc.env && proc.env[key] !== undefined && proc.env[key] !== null) {
    return proc.env[key];
  }

  return undefined;
}

/** Trimmed string, or null when unset/empty. */
export function envStr(key) {
  const value = raw(key);
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Numeric setting.
 *
 * Returns the fallback for anything that is not a finite number, which preserves
 * the `Number(x) || default` semantics these settings were originally written
 * with — including the deliberate behaviour that `0` is falsy and therefore falls
 * back to the default. Callers that need `0` to be meaningful pass the fallback as
 * `0`.
 */
export function envNum(key, fallback) {
  const value = Number(raw(key));
  if (!Number.isFinite(value) || value === 0) return fallback;
  return value;
}

/**
 * Boolean flag.
 *
 * Accepts the string spellings a `.env` file produces, and returns the fallback
 * when the variable is absent or unrecognised.
 */
export function envFlag(key, fallback = null) {
  const value = envStr(key);
  if (value === null) return fallback;
  const text = value.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

/** Comma-separated list, trimmed and emptied. */
export function envList(key, fallback = []) {
  const value = envStr(key);
  if (value === null) return fallback;
  const items = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

/** Build id, reported in diagnostics. Never a secret. */
export function appVersion() {
  return envStr('SPOTUNER_VERSION') ?? envStr('npm_package_version') ?? '1.0.0';
}