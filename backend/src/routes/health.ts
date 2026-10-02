import { Hono } from 'hono';

/**
 * `GET /health`
 *
 * Unchanged from the Express server, and deliberately cheap: no upstream call, no
 * cache read, no provider probe. It answers "is this Worker serving", which is the
 * only question a load balancer or an uptime check needs answered.
 */
const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

export default app;