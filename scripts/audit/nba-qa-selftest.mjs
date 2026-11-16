// Proves the QA network guard (Claude 2026-11-16, after review). nba-qa-run.mjs runs it before
// every shared script, and refuses the run unless it passes:
//   node --import ./scripts/audit/nba-qa-preload.mjs scripts/audit/nba-qa-selftest.mjs
// Two local servers stand in for the two kinds of host: 127.0.0.1 (allowed) and 127.0.0.2 (not on
// the allow-list, so it plays the live Supabase / relay host). Every probe runs against both: each
// must reach 127.0.0.1 (so we know the probe really fires) and must never reach 127.0.0.2. The
// probes are the ways a QA script could send a request past an abort-everything context route:
// page.route + continue() (scripts/qa/content.mjs on the card registry), context.route + continue(),
// continue({ url }) and fallback({ url }) overrides, route.fetch(), page.request / context.request,
// playwright.request.newContext, unrouteAll(), page.routeWebSocket + connectToServer(),
// browser.newPage(), CDP Fetch interception, a persistent profile, and node's own fetch / http.
// Needs no dev server. Exit 0 and "nba-qa-selftest: ok" when every probe holds.
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const pw = require('playwright');
if (!pw.chromium.launch.nbaGuarded) {
  console.error('nba-qa-selftest: playwright is not guarded (run me with --import nba-qa-preload.mjs)');
  process.exit(3);
}

const hits = { allowed: [], forbidden: [] };
function server(host, kind) {
  const s = http.createServer((req, res) => {
    hits[kind].push(req.method + ' ' + req.url);
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<!doctype html><title>selftest</title>');
    }
    res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end('ok');
  });
  s.on('upgrade', (req, socket) => {
    hits[kind].push('WS ' + req.url);
    socket.destroy();
  });
  return new Promise((resolve, reject) => {
    s.once('error', reject);
    s.listen(0, host, () => resolve({ s, url: `http://${host}:${s.address().port}`, ws: `ws://${host}:${s.address().port}` }));
  });
}

const A = await server('127.0.0.1', 'allowed');
const F = await server('127.0.0.2', 'forbidden');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
/** run `probe(base)` against both hosts; the path tags the hits */
async function both(name, path, probe, { control = true } = {}) {
  for (const [kind, base] of [
    ['allowed', A],
    ['forbidden', F],
  ]) {
    try {
      await probe(base, path);
    } catch {
      /* a refused probe throws: that's the guard working */
    }
  }
  await wait(250);
  const leaked = hits.forbidden.filter((h) => h.includes(path));
  const reached = hits.allowed.some((h) => h.includes(path));
  results.push({ name, leaked: leaked.length, controlReached: control ? reached : 'n/a' });
}

const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
let ok = true;
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(A.url + '/');
  const pageFetch = (url, init = {}) => page.evaluate(({ url, init }) => fetch(url, { mode: 'no-cors', ...init }).then(() => 1, () => 0), { url, init });

  // the reviewer's reproduction: a page route that continue()s the card-registry POST
  await page.route('**/functions/v1/card-registry', (r) => r.continue());
  await both('page.route + continue() (content.mjs)', '/functions/v1/card-registry', (b, p) => pageFetch(b.url + p, { method: 'POST', body: 'x' }));

  await ctx.route('**/ctx-continue', (r) => r.continue());
  await both('context.route + continue()', '/ctx-continue', (b, p) => pageFetch(b.url + p));

  // URL overrides: from an allowed URL to each host
  await page.route(`${A.url}/override-*-to-forbidden`, (r) => r.continue({ url: F.url + '/override-landed' }));
  await page.route(`${A.url}/override-*-to-allowed`, (r) => r.continue({ url: A.url + '/override-landed' }));
  await pageFetch(A.url + '/override-x-to-allowed');
  await pageFetch(A.url + '/override-x-to-forbidden');
  await wait(250);
  results.push({ name: 'continue({ url }) override', leaked: hits.forbidden.filter((h) => h.includes('/override-landed')).length, controlReached: hits.allowed.some((h) => h.includes('/override-landed')) });

  await page.route(`${A.url}/fb-*-to-forbidden`, (r) => r.fallback({ url: F.url + '/fb-landed' }));
  await page.route(`${A.url}/fb-*-to-allowed`, (r) => r.fallback({ url: A.url + '/fb-landed' }));
  await pageFetch(A.url + '/fb-x-to-allowed');
  await pageFetch(A.url + '/fb-x-to-forbidden');
  await wait(250);
  results.push({ name: 'fallback({ url }) override', leaked: hits.forbidden.filter((h) => h.includes('/fb-landed')).length, controlReached: hits.allowed.some((h) => h.includes('/fb-landed')) });

  // a refused route.fetch() aborts the request and throws (an uncaught throw ends the script: fail closed)
  await page.route('**/route-fetch', async (r) => {
    try {
      await r.fulfill({ response: await r.fetch() });
    } catch {
      /* refused */
    }
  });
  await both('route.fetch()', '/route-fetch', (b, p) => pageFetch(b.url + p));

  await both('page.request.get', '/page-request', (b, p) => page.request.get(b.url + p));
  await both('context.request.post', '/ctx-request', (b, p) => ctx.request.post(b.url + p, { data: 'x' }));
  const api = await pw.request.newContext();
  await both('playwright.request.newContext().get', '/api-request', (b, p) => api.get(b.url + p));
  await api.dispose();

  await ctx.unrouteAll();
  await both('after context.unrouteAll() (plain fetch)', '/after-unroute', (b, p) => pageFetch(b.url + p));
  await ctx.unroute('**/*');
  await both('after context.unroute("**/*") (plain fetch)', '/after-unroute2', (b, p) => pageFetch(b.url + p));

  await page.routeWebSocket('**/ws-probe', (ws) => {
    ws.connectToServer();
  });
  await both('page.routeWebSocket + connectToServer()', '/ws-probe', (b, p) =>
    page.evaluate((u) => new Promise((res) => {
      const s = new WebSocket(u);
      s.onopen = s.onerror = s.onclose = () => res(1);
      setTimeout(() => res(0), 1500);
    }), b.ws + p)
  );

  const solo = await browser.newPage();
  await solo.goto(A.url + '/');
  await both('browser.newPage() (plain fetch)', '/solo-page', (b, p) => solo.evaluate((u) => fetch(u, { mode: 'no-cors' }).then(() => 1, () => 0), b.url + p));
  await solo.close();

  // refusals that need no host pair
  const refused = async (name, fn) => {
    try {
      await fn();
      results.push({ name, leaked: 1, controlReached: 'n/a' });
    } catch {
      results.push({ name, leaked: 0, controlReached: 'n/a' });
    }
  };
  const cdp = await ctx.newCDPSession(page);
  await refused('CDP Fetch.enable', () => cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }));
  await refused('browser-level CDP session', () => browser.newBrowserCDPSession());
  await refused('launchPersistentContext', () => pw.chromium.launchPersistentContext('/tmp/nba-qa-selftest-profile'));
  await refused('connectOverCDP', () => pw.chromium.connectOverCDP('http://127.0.0.2:9222'));
  await refused('a remote baseURL', () => browser.newContext({ baseURL: F.url }));

  // node's own requests
  await both('node fetch', '/node-fetch', (b, p) => fetch(b.url + p));
  await both('node http.get', '/node-http', (b, p) => new Promise((res, rej) => http.get(b.url + p, (r) => (r.resume(), r.on('end', res))).on('error', rej)));
  await ctx.close();
} finally {
  await browser.close();
  A.s.close();
  F.s.close();
}

for (const r of results) {
  const bad = r.leaked > 0 || r.controlReached === false;
  if (bad) ok = false;
  const what = r.controlReached === 'n/a' ? (r.leaked ? 'NOT refused' : 'refused') : `${r.leaked} request(s) reached 127.0.0.2; control reached 127.0.0.1: ${r.controlReached}`;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${r.name}: ${what}`);
}
if (hits.forbidden.length) console.log('127.0.0.2 saw: ' + hits.forbidden.join(', '));
console.log(ok ? 'nba-qa-selftest: ok' : 'nba-qa-selftest: FAILED');
process.exit(ok ? 0 : 1);
