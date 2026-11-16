// Team nba's browser QA harness (Claude 2026-11-16). Every nba probe and capture goes through it, so
// none can reach a live service:
//  - the dev server is the team's own, http://localhost:5215, with ?ns=inspect and the team's own
//    relay ws://localhost:7795 (scripts/audit/nba-relay.mjs; never the shared 7777 or a real relay)
//  - every request and WebSocket to a host other than localhost/127.0.0.1 is aborted (fonts from
//    fonts.googleapis.com / fonts.gstatic.com excepted) and recorded in `blocked`
//  - the 8 plan sizes carry their safe-area insets, injected where the app reads them: the stage's
//    window.__psInsets hook and the game's own .arcade-full variables (which read env())
//  - both reduced-motion modes; touch through CDP
// Run any script with the dev server up (BUILD-RULES): node scripts/audit/nba-geo.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

export const require = createRequire(new URL('../../package.json', import.meta.url));
export const PORT = 5215;
export const RELAY_PORT = 7795;
export const BASE = `http://localhost:${PORT}/`;
export const RELAY = `ws://localhost:${RELAY_PORT}`;
export const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];
/** where captures and JSON land (NBA_SHOTS to change it; never inside the repo) */
export const SHOTS = process.env.NBA_SHOTS || '/tmp/ps-nba-shots';
fs.mkdirSync(SHOTS, { recursive: true });

/**
 * The plan's 8 sizes (§3.8), with insets [top, right, bottom, left] in CSS px: the owner's 393×852
 * (Dynamic Island 59 / home bar 34), the Pro Max, the SE 2/3 and the SE 1, and each turned sideways
 * (the island and the home bar move to the sides and the bottom).
 */
export const SIZES = {
  393: { w: 393, h: 852, insets: [59, 0, 34, 0] },
  320: { w: 320, h: 568, insets: [20, 0, 0, 0] },
  430: { w: 430, h: 932, insets: [59, 0, 34, 0] },
  375: { w: 375, h: 667, insets: [20, 0, 0, 0] },
  '852land': { w: 852, h: 393, insets: [0, 59, 21, 59] },
  '932land': { w: 932, h: 430, insets: [0, 59, 21, 59] },
  '667land': { w: 667, h: 375, insets: [0, 0, 0, 0] },
  '568land': { w: 568, h: 320, insets: [0, 0, 0, 0] },
};
export const PORTRAIT = ['393', '320', '430', '375'];

export const blocked = [];
const allowed = (u) => u.protocol === 'data:' || u.protocol === 'blob:' || ALLOWED.includes(u.hostname);

export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

/** Fail loudly unless the team's dev server answers on its port. */
export async function needServer() {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw Error('status ' + r.status);
  } catch (e) {
    throw Error(`nba-lib: no dev server on ${BASE} (${e.message}). Start it: nohup npx vite --port ${PORT} --strictPort > /tmp/ps-nba-vite.log 2>&1 & echo $! > /tmp/ps-nba-vite.pid`);
  }
}

/** The app's URL with the isolation parameters (and any extra ones, e.g. { arcade: '', seed: 'x' }). */
export function url(params = {}) {
  const u = new URL(BASE);
  const q = new URLSearchParams({ sport: 'nba', ns: 'inspect', relay: RELAY });
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  u.search = q.toString().replace(/=(&|$)/g, '$1');
  return u.href;
}

/** Abort every request and socket that would leave the machine. */
export async function isolate(context) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (allowed(u)) return route.continue();
    blocked.push(u.hostname);
    return route.abort();
  });
  if (context.routeWebSocket)
    await context.routeWebSocket(/.*/, (ws) => {
      const u = new URL(ws.url());
      if (ALLOWED.includes(u.hostname)) return ws.connectToServer();
      blocked.push('ws:' + u.hostname);
      return ws.close();
    });
}

/**
 * A touch context at one of the plan sizes, isolated, with its insets injected.
 * `motion` is 'no-preference' (captures) or 'reduce' (the reduced-motion pass).
 */
export async function context(browser, size, { motion = 'no-preference', scale = 1, insets } = {}) {
  const s = SIZES[size];
  if (!s) throw Error('nba-lib: unknown size ' + size);
  const ins = insets ?? s.insets;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, isMobile: true, hasTouch: true, deviceScaleFactor: scale, reducedMotion: motion });
  await isolate(ctx);
  await ctx.addInitScript((ins) => {
    window.__psInsets = ins;
    const css = `.arcade-full{--sat:${ins[0]}px!important;--sar:${ins[1]}px!important;--sab:${ins[2]}px!important;--sal:${ins[3]}px!important}`;
    const add = () => {
      const el = document.createElement('style');
      el.dataset.nbaQaInsets = '1';
      el.textContent = css;
      document.head.appendChild(el);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  }, ins);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text()) && errors.push('console: ' + m.text()));
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, size: s, insets: ins };
}

/** CDP touch: `pts` is [{ x, y, id }]; type touchStart / touchMove / touchEnd. */
export const touch = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 8, radiusY: 8, force: 1 })) });

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** An element's box (CSS px) and centre, or null. */
export async function rect(page, sel) {
  const b = await page.locator(sel).first().boundingBox().catch(() => null);
  return b && { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, cx: Math.round((b.x + b.width / 2) * 10) / 10, cy: Math.round((b.y + b.height / 2) * 10) / 10 };
}

/** The lab game (?arcade), waiting until the first possession's clock shows. */
export async function openLab(page, params = {}) {
  await page.goto(url({ arcade: '', seed: 'nba-qa', ...params }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /\d/.test(document.querySelector('.hg2-bug .mid em')?.textContent || ''), null, { timeout: 45000 });
}

export async function shot(page, name) {
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, timeout: 15000 });
  return file;
}

/** rAF intervals over `ms`: median fps, percentiles and the share of frames over 20 ms. */
export const frames = (page, ms = 5000) =>
  page.evaluate(
    (ms) =>
      new Promise((res) => {
        const ts = [];
        const t0 = performance.now();
        const f = (t) => {
          ts.push(t);
          if (t - t0 < ms) requestAnimationFrame(f);
          else {
            const d = ts
              .slice(1)
              .map((x, i) => x - ts[i])
              .sort((a, b) => a - b);
            const q = (k) => +d[Math.floor(k * (d.length - 1))].toFixed(1);
            res({ frames: d.length, medianFps: +(1000 / q(0.5)).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1), over20: +(d.filter((x) => x > 20).length / d.length).toFixed(3) });
          }
        };
        requestAnimationFrame(f);
      }),
    ms
  );

/** The run is clean only if nothing tried to leave the machine. */
export function report(name, out) {
  const hosts = [...new Set(blocked)];
  const file = path.join(SHOTS, name + '.json');
  fs.writeFileSync(file, JSON.stringify({ ...out, blockedHosts: hosts }, null, 1));
  console.log(JSON.stringify(out, null, 1));
  console.log(`\n${name}: JSON ${file}; requests to other hosts aborted: ${hosts.length ? hosts.join(', ') : 'none'}`);
}

/**
 * A seeded local UT profile in this context's isolated storage (the utui audit's fixture): a starter
 * club, a Chicago core and three GOATs, sound and haptics off. Never registered anywhere: the page
 * runs under ?ns=inspect with every outside host aborted.
 */
export async function utFixture(page, { coins = 10000, params = {} } = {}) {
  await page.goto(url(params), { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ coins }) => {
    const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
    const { getPool, byValue } = await import('/src/ut/pool.ts');
    const { openPack } = await import('/src/ut/packs.ts');
    const { autoBuild } = await import('/src/ut/squad.ts');
    const { freshUt } = await import('/src/ut/state.ts');
    const pool = await getPool();
    const p = freshProfile();
    p.name = 'NBA QA';
    p.coins = coins;
    p.firstRun = false;
    p.gifts = ['testers-2026-10'];
    p.settings.sound = false;
    p.settings.haptics = false;
    p.xp = 5200;
    p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const cards = [
      ...openPack(pool, 'starter', 'qa'),
      ...[...pool.base.values()].filter((c) => c.tier === 'goat').slice(0, 3),
      ...[...pool.base.values()].filter((c) => c.line.kind === 'season' && c.line.fr === 'CHI').sort(byValue).slice(0, 25),
    ].filter((c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i);
    const owned = cards.map((rc, i) => ({ uid: 'nba-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
    p.ut = { ...freshUt(), owned, squad: autoBuild('nba', owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1 };
    localStorage.setItem('perfect-season:fav:asked', '1');
    saveProfile(p);
  }, { coins });
  await page.reload({ waitUntil: 'domcontentloaded' });
}
