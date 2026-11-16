// Team nfl browser QA harness (Claude, studio overhaul). Every context it opens is isolated from live
// services: requests to any host but localhost, 127.0.0.1 and the two font hosts are aborted and
// recorded, and report() fails the run if one was attempted. Reduced motion is always set
// explicitly (a motion check against a default would be vacuous), the dev server is the team's
// port 5216, and the iPhone safe areas go in through the stage's own test hook.
//
//   node scripts/qa/nfl-lib.mjs --probe     self-test: a page fetch to a non-local host is blocked and reported
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const require = createRequire(new URL('../../package.json', import.meta.url));
export const PORT = 5216;
export const BASE = 'http://localhost:' + PORT + '/';
export const SHOTS = process.env.NFL_SHOTS || '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/shots/nfl';
export const RELAY_LOCK = '/tmp/ps-qa-relay-7777.lock';
export const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/** The team's viewports: [width, height] and safe-area insets [top, right, bottom, left]. */
export const VIEWPORTS = {
  A: { w: 393, h: 852, insets: [59, 0, 34, 0] },
  B: { w: 430, h: 932, insets: [59, 0, 34, 0] },
  C: { w: 320, h: 568, insets: [20, 0, 0, 0] },
  D: { w: 844, h: 390, insets: [0, 59, 21, 59] },
  E: { w: 375, h: 667, insets: [20, 0, 0, 0] }
};

/** Every non-local request any isolated context attempted: { host, url }. */
export const blocked = [];

/** Abort every request to a host that isn't local (or the fonts), and remember it. */
export async function isolate(context) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || ALLOWED.includes(u.hostname)) return route.continue();
    blocked.push({ host: u.hostname, url: u.href.slice(0, 120) });
    return route.abort();
  });
  // WebSockets bypass routing: only the local relay may be dialled
  await context.addInitScript((allowed) => {
    const Native = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      const host = new URL(url, location.href).hostname;
      if (!allowed.includes(host)) throw new Error('QA isolation: WebSocket to ' + host + ' blocked');
      return new Native(url, protocols);
    };
    window.WebSocket.prototype = Native.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  }, ALLOWED);
}

export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

/**
 * An isolated touch phone at viewport A-E, with motion set explicitly. Returns the context, a page
 * with its error list, and `url(query)`, which always carries the inspect namespace and local relay.
 */
export async function phone(browser, { viewport = 'A', reducedMotion, dsf = 1 } = {}) {
  if (reducedMotion !== 'reduce' && reducedMotion !== 'no-preference') throw Error('nfl-lib: pass reducedMotion explicitly ("reduce" or "no-preference")');
  const v = VIEWPORTS[viewport];
  if (!v) throw Error('nfl-lib: unknown viewport ' + viewport);
  const context = await browser.newContext({ viewport: { width: v.w, height: v.h }, isMobile: true, hasTouch: true, deviceScaleFactor: dsf, reducedMotion });
  await isolate(context);
  await context.addInitScript((insets) => {
    window.__psInsets = insets;
  }, v.insets);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = (query = {}) => {
    const u = new URL(BASE);
    u.search = new URLSearchParams({ ...query, ns: 'inspect', relay: 'ws://localhost:7777' }).toString().replace(/=(?=&|$)/g, '');
    return u.href;
  };
  return { context, page, errors, url, viewport: v };
}

/** The dev server must be up on the team's port before a run (start and stop it by PID). */
export async function serverUp() {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * A relay-using run must hold the machine-wide relay lock and find port 7777 free:
 *   flock -w 1800 /tmp/ps-qa-relay-7777.lock env PS_QA_RELAY_LOCKED=1 node scripts/qa/<script>.mjs
 */
export async function relayGuard() {
  if (process.env.PS_QA_RELAY_LOCKED !== '1') throw Error('Relay runs need the lock: flock -w 1800 ' + RELAY_LOCK + ' env PS_QA_RELAY_LOCKED=1 node <script>');
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(Error('Port 7777 is in use: another relay run is still going')));
    s.listen(7777, '127.0.0.1', () => s.close(resolve));
  });
}

export function shotPath(task, name) {
  const dir = path.join(SHOTS, task);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name + '.png');
}

/** Print what isolation blocked; a run that tried to reach a live host fails. */
export function report() {
  if (!blocked.length) {
    console.log('isolation: no non-local requests');
    return true;
  }
  console.log('isolation: BLOCKED ' + blocked.length + ' non-local request(s): ' + [...new Set(blocked.map((b) => b.host))].join(', '));
  process.exitCode = 1;
  return false;
}

// self-test: a fetch and a WebSocket to a non-local host are both stopped, and reported
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--probe')) {
  const browser = await launch();
  try {
    const { page, context } = await phone(browser, { viewport: 'A', reducedMotion: 'reduce' });
    await page.setContent('<p>probe</p>');
    const fetched = await page.evaluate(() =>
      fetch('https://example.com/qa-probe').then(
        () => 'reached',
        () => 'failed'
      )
    );
    const socket = await page.evaluate(() => {
      try {
        new WebSocket('wss://relay.example.com');
        return 'opened';
      } catch (e) {
        return 'refused: ' + e.message;
      }
    });
    await context.close();
    console.log(JSON.stringify({ fetched, socket, blocked }));
    const ok = fetched === 'failed' && socket.startsWith('refused') && blocked.some((b) => b.host === 'example.com');
    report();
    // the probe's blocked request is the expected outcome: the self-test passes when it was caught
    process.exitCode = ok ? 0 : 1;
    console.log(ok ? 'probe: blocked and reported' : 'probe: NOT blocked');
  } finally {
    await browser.close();
  }
}
