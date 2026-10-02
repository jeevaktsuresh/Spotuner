/**
 * axios instances for the Worker runtime.
 *
 * One factory, used everywhere `axios.create()` was used before, because of a
 * Workers-specific trap: axios picks its adapter in order — `xhr`, `http`, `fetch`
 * — and tests the Node `http` adapter with `Object.prototype.toString.call(process)
 * === '[object process]'`. With `nodejs_compat` enabled, workerd's `process`
 * polyfill *is* a `Process` class instance, so that check passes and axios selects
 * the Node HTTP adapter inside a runtime that has no Node HTTP server. Every call
 * then fails with `Unsupported cache mode: default`.
 *
 * Requesting the fetch adapter explicitly is the fix, and it is also the honest
 * choice: Workers have exactly one HTTP client and it is `fetch`. Under Node the
 * same adapter is used, so local runs and deployed runs take the same code path.
 *
 * The second Workers-specific fix lives here too: axios's fetch adapter injects
 * `cache: 'default'` into every `Request`, and workerd only supports
 * `cache: 'no-store'` — every call otherwise fails with
 * `Unsupported cache mode: default`. Passing `no-store` explicitly is also the
 * semantically correct choice here, because every call this project makes is an
 * upstream API read that the project's own caches, not the HTTP cache, govern.
 */

import axios from 'axios';

/**
 * @param {object} [config] Standard axios instance config.
 * @returns {import('axios').AxiosInstance}
 */
export function createHttp(config = {}) {
  return axios.create({
    adapter: 'fetch',
    fetchOptions: { cache: 'no-store' },
    ...config,
  });
}

export default createHttp;