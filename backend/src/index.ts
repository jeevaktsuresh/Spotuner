/**
 * Worker entry point.
 *
 * Cloudflare owns the HTTP lifecycle, so there is no `app.listen()` here: the
 * runtime calls `fetch` for every request and this module's only job is to make
 * the request's bindings available to the shared application code before handing
 * off to the Hono app.
 *
 * The bind step is not ceremony. The `lib/` modules are plain ESM shared with the
 * Node fallback server, and they were written to read configuration lazily — a
 * requirement that came from Spotify credentials being unavailable at module-load
 * time on Node, and which a Worker makes universal: bindings simply do not exist
 * until a request arrives. Installing them per request also means a value changed
 * with `wrangler secret put` is picked up without redeploying.
 */

import { installEnv } from '../lib/runtime/env.js';
import { installKv } from '../lib/runtime/kv.js';
import app from './app.js';

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    installEnv(env);
    installKv(env);

    return app.fetch(request, env, ctx);
  },
};