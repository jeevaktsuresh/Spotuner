/**
 * TTL cache — a `node-cache` work-alike.
 *
 * `node-cache` is a Node dependency with a `checkperiod` timer that keeps the
 * event loop alive; neither exists in a Worker. This provides the same surface the
 * project actually used (`get`/`set`/`del`/`keys`/`getTtl`/`flushAll`, `stdTTL`,
 * `maxKeys`) on top of a plain `Map` with lazy expiry, so nothing is retained past
 * its TTL and no timer runs.
 *
 * This is a *process-local optimisation layer only*. Every cache built on it has a
 * Cloudflare KV tier underneath (see `lib/runtime/kv.js`), so a cold isolate is a
 * cache miss, never a correctness problem.
 */

export class TtlCache {
  /**
   * @param {object} [options]
   * @param {number} [options.stdTTL]     Default lifetime, in seconds.
   * @param {number} [options.checkPeriod] Accepted for `node-cache` parity; unused,
   *   because expiry here is checked on read rather than on a timer.
   * @param {number} [options.maxKeys]    Evict oldest-inserted entries past this.
   */
  constructor({ stdTTL = 0, checkPeriod = 0, maxKeys = 0 } = {}) {
    this.stdTTL = Number(stdTTL) || 0;
    // Retained so call sites and status output stay identical to before.
    this.checkPeriod = Number(checkPeriod) || 0;
    this.maxKeys = Number(maxKeys) || 0;
    /** @type {Map<string, {value: any, expiresAt: number}>} */
    this.store = new Map();
  }

  /** Remaining lifetime in seconds, or 0 when absent/expired. */
  getTtl(key) {
    const entry = this.store.get(key);
    if (!entry) return 0;
    const remaining = Math.round((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] Seconds. Falls back to `stdTTL`.
   */
  set(key, value, ttl) {
    const seconds = Number(ttl ?? this.stdTTL) || 0;
    const expiresAt = seconds > 0 ? Date.now() + seconds * 1000 : 0;

    // Re-inserting moves the key to the end, so the Map's iteration order stays
    // insertion-ordered and eviction removes the genuinely oldest entry.
    this.store.delete(key);
    this.store.set(key, { value, expiresAt });

    if (this.maxKeys > 0) {
      while (this.store.size > this.maxKeys) {
        const oldest = this.store.keys().next();
        if (oldest.done) break;
        this.store.delete(oldest.value);
      }
    }

    return value;
  }

  /** `node-cache` exposes `del`; alias kept so either spelling works. */
  del(key) {
    return this.store.delete(key);
  }

  delete(key) {
    return this.store.delete(key);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  /** Live keys. Expired entries are swept first, matching `node-cache.keys()`. */
  keys() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== 0 && entry.expiresAt <= now) this.store.delete(key);
    }
    return [...this.store.keys()];
  }

  get size() {
    return this.keys().length;
  }

  flushAll() {
    this.store.clear();
  }
}

export default TtlCache;