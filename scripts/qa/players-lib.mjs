// Players team QA harness (studio overhaul, players-1). Shared by every scripts/qa/players-*.mjs.
//
// Isolation (BUILD-RULES "Live services"): every request and WebSocket whose host is not
// localhost/127.0.0.1 is aborted. Google Fonts' Archivo is answered from a local copy (PS_QA_FONT_DIR, default
// `.cache/qa-fonts`, git-ignored) so card text measures in the real face while no request leaves the
// machine; without that folder the font requests are aborted too and the report says
// `fonts: "fallback"`. Pages always open with ?ns=inspect&relay=ws://localhost:7777, and the route log
// (`routeLog()`) is printed with every report: `external` must stay 0.
//
// Options every script takes: --port 5214 (the players team's dev server), --out <dir> (screenshots
// and JSON; default /tmp/perfect-season-qa/players), --vp 393,320 (viewport keys below),
// --sport nba,nfl,soccer. Pure helpers (key parsing, quantiles, contrast) are exported for tests.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const require = createRequire(path.join(ROOT, 'package.json'));

// ---------- options ----------

/** `--key value`, `--key=value` and bare `--flag` (true). Repeated keys keep the last. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

/** A comma list option, or the default list. */
export const listOf = (v, def) => (v === undefined || v === true ? def : String(v).split(',').map((s) => s.trim()).filter(Boolean));

export const opts = parseArgs(process.argv.slice(2));
export const PORT = Number(opts.port ?? process.env.PS_PLAYERS_PORT ?? 5214);
export const BASE = `http://localhost:${PORT}/`;
export const OUT = path.resolve(String(opts.out ?? process.env.PS_PLAYERS_OUT ?? '/tmp/perfect-season-qa/players'));
export const FONT_DIR = path.resolve(process.env.PS_QA_FONT_DIR ?? path.join(ROOT, '.cache/qa-fonts'));
export const SPORTS = ['nba', 'nfl', 'soccer'];
fs.mkdirSync(OUT, { recursive: true });

/**
 * The viewports. Insets are [top, right, bottom, left] in screen px (stage.tsx `__psInsets`).
 * 393 is the owner's phone (iPhone 15/16 Pro, Dynamic Island 59/34); 390 is the audits' measuring
 * viewport, kept so their numbers can be reproduced; 844land is a Pro in landscape.
 */
export const VIEWPORTS = {
  393: { w: 393, h: 852, insets: [59, 0, 34, 0] },
  430: { w: 430, h: 932, insets: [59, 0, 34, 0] },
  320: { w: 320, h: 568, insets: [20, 0, 0, 0] },
  375: { w: 375, h: 667, insets: [20, 0, 0, 0] },
  '844land': { w: 844, h: 390, insets: [0, 59, 21, 59] },
  390: { w: 390, h: 844, insets: [47, 0, 34, 0] },
};
export const MATCH_VIEWPORTS = ['393', '430', '320', '375', '844land'];

// ---------- browser ----------

export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

const LOG = { continued: {}, external: [], blocked: {}, fontsLocal: 0 };
/** What the route handlers saw: `external` lists requests that left the machine (must be empty). */
export const routeLog = () => ({ ...LOG, external: LOG.external.slice(0, 20), externalCount: LOG.external.length });
const local = (host) => host === 'localhost' || host === '127.0.0.1';
const fontFiles = () => (fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.woff2')) : []);
export const fontsMode = () => (fontFiles().some((f) => f.includes('latin-standard-normal')) ? 'archivo-local' : 'fallback');

/** Google Fonts' stylesheet for Archivo, rewritten to the local files (served by the same handler). */
function archivoCss() {
  const face = (file, style, range) =>
    `@font-face{font-family:'Archivo';font-style:${style};font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(https://fonts.gstatic.com/__local/${file}) format('woff2');unicode-range:${range};}`;
  const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const ext = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const have = new Set(fontFiles());
  return [
    ['archivo-latin-ext-standard-normal.woff2', 'normal', ext],
    ['archivo-latin-standard-normal.woff2', 'normal', latin],
    ['archivo-latin-ext-standard-italic.woff2', 'italic', ext],
    ['archivo-latin-standard-italic.woff2', 'italic', latin],
  ]
    .filter(([f]) => have.has(f))
    .map(([f, s, r]) => face(f, s, r))
    .join('\n');
}

/** Abort every non-localhost request; answer Google Fonts from the local Archivo copy. */
export async function isolate(context) {
  const useFonts = fontsMode() === 'archivo-local';
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (local(u.hostname)) {
      LOG.continued[u.hostname] = (LOG.continued[u.hostname] ?? 0) + 1;
      return route.continue();
    }
    if (useFonts && u.hostname === 'fonts.googleapis.com' && u.pathname.startsWith('/css')) {
      LOG.fontsLocal++;
      return route.fulfill({ status: 200, contentType: 'text/css', body: archivoCss() });
    }
    if (useFonts && u.hostname === 'fonts.gstatic.com' && u.pathname.startsWith('/__local/')) {
      const file = path.join(FONT_DIR, path.basename(u.pathname));
      if (fs.existsSync(file)) {
        LOG.fontsLocal++;
        return route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*' } });
      }
    }
    LOG.blocked[u.hostname] = (LOG.blocked[u.hostname] ?? 0) + 1;
    return route.abort();
  });
  // WebSockets don't pass through route(): a relay socket goes only to localhost (the local test
  // relay); any other is closed before it connects
  await context.routeWebSocket(/.*/, (ws) => {
    const u = new URL(ws.url());
    if (local(u.hostname)) return ws.connectToServer();
    LOG.blocked['ws:' + u.hostname] = (LOG.blocked['ws:' + u.hostname] ?? 0) + 1;
    ws.close({ code: 1008, reason: 'players QA: localhost only' });
  });
  // a request that somehow got past the router (a worker, a beacon) is caught here
  context.on('request', (r) => {
    const u = new URL(r.url());
    if (!['data:', 'blob:'].includes(u.protocol) && !local(u.hostname) && !(u.hostname.startsWith('fonts.g') && useFonts)) {
      r.response()
        .then((res) => res && LOG.external.push(u.hostname + u.pathname))
        .catch(() => {});
    }
  });
}

/**
 * A phone context: viewport, touch, insets, standalone (home-screen) display mode, isolation.
 * `dpr` defaults to 1 (BUILD-RULES own checks); the audits' perf and sprite runs used 3.
 */
export async function newContext(browser, vp = '393', { dpr = 1, reducedMotion = 'no-preference', touch = true, standalone = true, insets, serviceWorkers = 'block' } = {}) {
  const v = VIEWPORTS[vp];
  if (!v) throw Error('unknown viewport ' + vp + ' (have ' + Object.keys(VIEWPORTS).join(', ') + ')');
  const context = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: dpr, isMobile: touch, hasTouch: touch, reducedMotion, serviceWorkers });
  await isolate(context);
  await context.addInitScript(
    ({ ins, standalone }) => {
      window.__psInsets = ins;
      if (standalone) Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
    },
    { ins: insets ?? v.insets, standalone }
  );
  return context;
}

/** Page errors collected per page. */
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
  return errors;
}

/** An app URL with the isolation parameters always set. */
export function appUrl(params = {}) {
  const u = new URL(BASE);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false) q.set(k, v === true ? '' : String(v));
  q.set('ns', 'inspect');
  q.set('relay', 'ws://localhost:7777');
  u.search = q.toString().replace(/=(&|$)/g, '$1');
  if (!local(u.hostname)) throw Error('QA is restricted to localhost');
  return u.href;
}

/** The autoplay test bench of each sport: ?arcade&auto (NBA, NFL) or the dev ?soccer-lab&auto&qa. */
export function matchUrl(sport, { seed = 'players', slowmo, extra = {} } = {}) {
  const bench = sport === 'soccer' ? { 'soccer-lab': true, auto: true, qa: true } : { arcade: true, auto: true };
  return appUrl({ ...bench, sport, seed, ...(slowmo ? { slowmo } : {}), ...extra });
}

export async function cpu(page, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

/** Heap after a forced GC (CDP), in MB. */
export async function heapMB(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const h = await cdp.send('Runtime.getHeapUsage');
  await cdp.detach().catch(() => {});
  return +(h.usedSize / 1048576).toFixed(1);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const settle = async (page, ms = 450) => {
  await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

export async function shot(page, name, options = {}) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, timeout: 20000, ...options });
  return file;
}

/** Write a report to OUT/<name>.json and print it as one JSON line (the scripts' contract). */
export function emit(name, report) {
  const full = { script: name, port: PORT, fonts: fontsMode(), at: new Date().toISOString(), ...report, routeLog: routeLog() };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(full, null, 1));
  process.stdout.write(JSON.stringify(full) + '\n');
  return full;
}

/** Run a script body with a browser, closing it however the body ends. */
export async function withBrowser(fn) {
  const browser = await launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/** Fail fast with a clear message when the dev server isn't up. */
export async function needServer() {
  try {
    const r = await fetch(BASE, { method: 'GET' });
    if (!r.ok) throw Error('HTTP ' + r.status);
  } catch (e) {
    console.error(`players QA: no dev server at ${BASE} (${e.message}). Start it with: nohup npx vite --port ${PORT} --strictPort > /tmp/ps-players-vite.log 2>&1 &`);
    process.exit(2);
  }
}

// ---------- the UT fixture (copied from the audit harness, localhost only) ----------

/**
 * A seeded Ultimate Team profile: a starter pack, three GOATs, the best 25 of one franchise, two
 * unopened gold packs, coins. Written to localStorage on the inspect namespace, then reloaded.
 */
export async function utFixture(page, sport, { coins = 10000, goats = 3 } = {}) {
  await page.goto(appUrl({ sport }), { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    async ({ sport, coins, goats }) => {
      const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { getPool, byValue } = await import('/src/ut/pool.ts');
      const { openPack } = await import('/src/ut/packs.ts');
      const { autoBuild } = await import('/src/ut/squad.ts');
      const { freshUt } = await import('/src/ut/state.ts');
      const pool = await getPool(),
        p = freshProfile();
      p.name = 'Players QA';
      p.coins = coins;
      p.firstRun = false;
      p.gifts = ['testers-2026-10'];
      p.settings.sound = false;
      p.settings.haptics = false;
      p.xp = 5200;
      p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      const fr = { nba: 'CHI', nfl: 'NE', soccer: 'BAR' }[sport];
      const cards = [
        ...openPack(pool, 'starter', 'players-qa'),
        ...[...pool.base.values()].filter((c) => c.tier === 'goat').slice(0, goats),
        ...[...pool.base.values()].filter((c) => c.line.kind === 'season' && c.line.fr === fr).sort(byValue).slice(0, 25),
      ].filter((c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i);
      const owned = cards.map((rc, i) => ({ uid: 'players-qa-' + i, cardId: rc.line.id, level: i === 0 ? 3 : 1, xp: i === 0 ? 42 : 0, at: i + 1 }));
      p.ut = {
        ...freshUt(),
        owned,
        squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))),
        starterClaimed: true,
        packsOpened: 1,
        packs: [
          { id: 'players-qa-gold', kind: 'gold', at: 2 },
          { id: 'players-qa-gold2', kind: 'gold', at: 3 },
        ],
      };
      localStorage.setItem('perfect-season:fav:asked', '1');
      saveProfile(p);
    },
    { sport, coins, goats }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/** Open Ultimate Team straight onto a view (the app's own transient return-view memory). */
export async function openUt(page, view = 'hub') {
  await page.locator('nav.tabs').waitFor({ timeout: 60000 });
  await page.evaluate(async (view) => {
    const { rememberUtReturn } = await import('/src/ut/return-view.ts');
    rememberUtReturn(view);
  }, view);
  await page.locator('.tab-ut').first().click();
  await page.locator('.ut-tabs').waitFor({ timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 90000 });
}

/** Close whatever modal sheets sit on top (first-run tips, offers). */
export async function dismissDialogs(page, rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    await page.waitForTimeout(300);
    const d = page.locator('[role=dialog]').last();
    if (!(await d.isVisible().catch(() => false))) {
      if (i > 2) return;
      continue;
    }
    await d
      .locator('button')
      .last()
      .click({ timeout: 2500 })
      .catch(() => page.keyboard.press('Escape'));
  }
}

// ---------- pure helpers (also used inside pages through their source) ----------

/**
 * A body sprite key, `who|anim|facing/dirs|px|pitch`, as the three renderers build it (`who` is
 * `pid|side`, soccer adds `|kitSide`). Returns null for anything else.
 */
export function parseSpriteKey(k) {
  const p = String(k).split('|');
  if (p.length < 6) return null;
  const n = p.length;
  const fd = p[n - 3].split('/');
  const px = Number(p[n - 2]);
  if (fd.length !== 2 || !Number.isFinite(px)) return null;
  const anim = p[n - 4];
  const m = /^mo:([^:]+):(\d+)/.exec(anim);
  return { who: p.slice(0, n - 4).join('|'), anim, clip: m ? m[1] : null, frame: m ? Number(m[2]) : null, fb: Number(fd[0]), dirs: Number(fd[1]), px, pitch: Number(p[n - 1]) };
}

/** The audit's sprite size buckets. */
export const pxBucket = (px) => (px < 24 ? '<24' : px < 32 ? '24-31' : px < 48 ? '32-47' : px < 72 ? '48-71' : '72+');
export const PX_BUCKETS = ['<24', '24-31', '32-47', '48-71', '72+'];

/** Nearest-rank quantile of a sorted copy. */
export function quantile(xs, q) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

export const round = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? null : +x.toFixed(d));
export const pct = (a, b) => (b ? round((100 * a) / b, 1) : null);

/** WCAG contrast of two `#rrggbb` / `rgb()` colours. */
export function contrast(fg, bg) {
  const rgb = (c) => {
    const s = String(c).trim();
    if (s.startsWith('#')) {
      const h = s.length === 4 ? s.slice(1).replace(/./g, (x) => x + x) : s.slice(1, 7);
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const m = s.match(/rgba?\(([^)]+)\)/);
    return m ? m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number) : [0, 0, 0];
  };
  const lum = (c) => {
    const [r, g, b] = rgb(c).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(fg),
    b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** FNV-1a 32-bit, hex: the golden sequence digests. */
export function fnv(s, h = 0x811c9dc5) {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
export const hex = (h) => h.toString(16).padStart(8, '0');

// ---------- the in-match sprite probe ----------

const RENDERERS = {
  nba: ['/src/game/hoops2/render.ts', 'HoopsRenderer'],
  nfl: ['/src/game/football2/render.ts', 'FootballRenderer'],
  soccer: ['/src/game/soccer2/render.ts', 'SoccerRenderer'],
};

/**
 * Patch the match renderer and the shared SpriteCache (dev server modules, same instances the game
 * uses) to watch every body sprite: per frame, what each body asked for (its key), whether it was a
 * cache hit, a new drawing, or STALE (the budget was spent, so last frame's drawing was shown). Also
 * the play phase (snap, kickoff, inbound), the ball body, draw cost, and the canvas area every cached
 * sprite holds. `golden` keeps a per-frame text sequence (who, anim, facing) for the players-2 check.
 * Read results with `readProbe(page)`.
 */
export async function installProbe(page, sport, { golden = false, goldenCap = 400000 } = {}) {
  const [mod, cls] = RENDERERS[sport];
  await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 90000 });
  await page.evaluate(
    async ({ sport, mod, cls, parseSrc, bucketSrc, golden, goldenCap }) => {
      const parse = new Function('return ' + parseSrc)();
      const bucket = new Function('return ' + bucketSrc)();
      const body = await import('/src/game/pixel/body.ts');
      const R = await import(mod);
      const Cls = R[cls];
      if (window.__psProbe) return;
      const S = (window.__psProbe = {
        sport,
        frames: 0,
        drawMs: [],
        caches: new Set(),
        renderer: null,
        byPx: {},
        pxHist: {},
        heavyKeys: 0,
        leanKeys: 0,
        bySince: {},
        bodies: new Map(),
        starts: 0,
        startFrame: -1,
        phase: null,
        state: null,
        areaPeak: 0,
        areaSamples: [],
        cur: null,
        golden: golden ? [] : null,
        goldenLen: 0,
        goldenCap,
        t0: performance.now(),
        reset() {
          this.frames = 0;
          this.drawMs = [];
          this.byPx = {};
          this.pxHist = {};
          this.heavyKeys = 0;
          this.leanKeys = 0;
          this.bySince = {};
          this.bodies = new Map();
          this.starts = 0;
          this.areaPeak = 0;
          this.areaSamples = [];
          this.t0 = performance.now();
        },
      });
      const P = body.SpriteCache.prototype;
      const g0 = P.get,
        s0 = P.set;
      P.get = function (k) {
        S.caches.add(this);
        const r = g0.call(this, k);
        if (S.cur) {
          const e = parse(k);
          if (e) S.cur.req.set(e.who, { k, e, hit: !!r, made: false });
        }
        return r;
      };
      P.set = function (k, spr, inUse) {
        S.caches.add(this);
        if (S.cur) {
          const e = parse(k);
          const q = e && S.cur.req.get(e.who);
          if (q && q.k === k) q.made = true;
        }
        return s0.call(this, k, spr, inUse);
      };
      const whoOf = (b) => (b && b.p ? b.p.id + '|' + b.side : null);
      const ballWho = (st) => {
        if (sport === 'nfl') return whoOf(st.carrier ?? st.qb);
        if (sport === 'nba') return st.handler === null || st.handler === undefined ? null : whoOf(st.bodies[st.handler]);
        const o = st.ball && st.ball.owner;
        if (o === null || o === undefined) return null;
        return whoOf(st.bodies.find((b) => b.id === o) ?? st.bodies[o]);
      };
      const area = () => {
        const seen = new Set();
        let a = 0;
        const add = (s) => {
          if (!s || !s.canvas || seen.has(s)) return;
          seen.add(s);
          a += s.canvas.width * s.canvas.height;
        };
        for (const c of S.caches) if (c.map) for (const s of c.map.values()) add(s);
        if (S.renderer && S.renderer.last) for (const s of S.renderer.last.values()) add(s);
        return a;
      };
      S.area = area;
      const finish = (f) => {
        S.frames++;
        S.drawMs.push(f.ms);
        // a new play: the snap or kickoff (the phase leaves 'pre'), or a fresh play/possession state
        // whose clock starts near zero (an NBA inbound; a play that starts live). The first frame seen
        // and replay snapshots (mid-play clocks) are not starts.
        const st = f.state;
        const fresh = S.state !== null && st !== S.state && (st.t ?? 1) < 0.25 && st.phase !== 'pre';
        const snapped = S.phase === 'pre' && st.phase !== undefined && st.phase !== 'pre';
        if (fresh || snapped) {
          S.starts++;
          S.startFrame = S.frames;
        }
        S.state = st;
        S.phase = st.phase ?? null;
        const since = S.startFrame < 0 ? -1 : S.frames - S.startFrame;
        const sb = since < 0 ? 'unknown' : since < 10 ? '0-9' : since < 30 ? '10-29' : since < 120 ? '30-119' : '120+';
        const bw = ballWho(st);
        const line = [];
        for (const [who, q] of f.req) {
          const pb = bucket(q.e.px);
          const st2 = q.hit ? 'hit' : q.made ? 'new' : 'stale';
          const bp = (S.byPx[pb] ??= { lookups: 0, hit: 0, made: 0, stale: 0 });
          bp.lookups++;
          bp[st2 === 'new' ? 'made' : st2]++;
          S.pxHist[q.e.px] = (S.pxHist[q.e.px] ?? 0) + 1;
          // the keep-list's body-type cues in the key: the heavy man's wider stride, the sprint lean
          if (/w\d/.test(q.e.anim)) S.heavyKeys++;
          if (/l-?\d/.test(q.e.anim)) S.leanKeys++;
          if (q.e.px >= 32) {
            const bs = (S.bySince[sb] ??= { lookups: 0, stale: 0 });
            bs.lookups++;
            if (st2 === 'stale') bs.stale++;
          }
          // the blends-under-load target: sprites of 48 px and up in the 20 frames after a start
          if (q.e.px >= 48 && since >= 0 && since < 20) {
            const bs = (S.bySince['48px-0-19'] ??= { lookups: 0, stale: 0 });
            bs.lookups++;
            if (st2 === 'stale') bs.stale++;
          }
          let b = S.bodies.get(who);
          if (!b) S.bodies.set(who, (b = { frames: 0, px: [], reqAnim: null, shownAnim: null, reqChanges: 0, shownChanges: 0, stale: 0, staleRun: 0, maxStaleRun: 0, ball: 0 }));
          b.frames++;
          if (b.px.length < 4000) b.px.push(q.e.px);
          if (q.e.anim !== b.reqAnim) {
            if (b.reqAnim !== null) b.reqChanges++;
            b.reqAnim = q.e.anim;
          }
          if (st2 === 'stale') {
            b.stale++;
            b.staleRun++;
            b.maxStaleRun = Math.max(b.maxStaleRun, b.staleRun);
          } else {
            b.staleRun = 0;
            if (q.e.anim !== b.shownAnim) {
              if (b.shownAnim !== null) b.shownChanges++;
              b.shownAnim = q.e.anim;
            }
          }
          if (bw && who.startsWith(bw)) b.ball++;
          if (S.golden) line.push(who + ' ' + q.e.anim + ' ' + q.e.fb + '/' + q.e.dirs + ' ' + q.e.px + ' ' + q.e.pitch);
        }
        if (S.golden && S.goldenLen < S.goldenCap) {
          line.sort();
          const s = S.frames + '@' + Math.round((st.t ?? 0) * 1000) + ':' + line.join(';');
          S.golden.push(s);
          S.goldenLen += s.length;
        }
        if (S.frames % 30 === 0) {
          const a = area();
          S.areaPeak = Math.max(S.areaPeak, a);
          S.areaSamples.push(a);
        }
      };
      const d0 = Cls.prototype.draw;
      Cls.prototype.draw = function (ctx, state, ...rest) {
        S.renderer = this;
        S.cur = { req: new Map(), state };
        const t0 = performance.now();
        try {
          return d0.call(this, ctx, state, ...rest);
        } finally {
          const f = S.cur;
          S.cur = null;
          f.ms = performance.now() - t0;
          finish(f);
        }
      };
    },
    { sport, mod, cls, parseSrc: parseSpriteKey.toString(), bucketSrc: pxBucket.toString(), golden, goldenCap }
  );
}

/** Zero the probe's counters (after the warm-up). */
export const resetProbe = (page) => page.evaluate(() => window.__psProbe && window.__psProbe.reset());

/** The probe's raw counters, summarised in the page (bodies reduced to their stats). */
export const readProbe = (page) =>
  page.evaluate(() => {
    const S = window.__psProbe;
    if (!S) return null;
    const secs = (performance.now() - S.t0) / 1000;
    const med = (a) => {
      if (!a.length) return null;
      const s = [...a].sort((x, y) => x - y);
      return s[Math.floor((s.length - 1) / 2)];
    };
    const bodies = [...S.bodies.entries()].map(([who, b]) => ({ who, frames: b.frames, px: med(b.px), reqChanges: b.reqChanges, shownChanges: b.shownChanges, stale: b.stale, maxStaleRun: b.maxStaleRun, ball: b.ball }));
    return { frames: S.frames, secs, drawMs: S.drawMs, byPx: S.byPx, pxHist: S.pxHist, heavyKeys: S.heavyKeys, leanKeys: S.leanKeys, bySince: S.bySince, bodies, starts: S.starts, areaNow: S.area(), areaPeak: Math.max(S.areaPeak, S.area()), areaSamples: S.areaSamples, cacheEntries: [...S.caches].reduce((n, c) => n + (c.map ? c.map.size : 0), 0), pixelDebug: window.__pixelDebug ?? null };
  });

/**
 * Summarise a probe read: stale overall and by size, by frames since the play started (sprites of
 * 32 px and up), and per-body effective animation rates (distinct poses SHOWN per second, against
 * the poses the renderer ASKED for), for every body, the large ones (40 px and up) and the ball's.
 */
export function summariseProbe(r) {
  const tot = { lookups: 0, hit: 0, made: 0, stale: 0 };
  const byPx = {};
  for (const b of PX_BUCKETS) {
    const x = r.byPx[b];
    if (!x) continue;
    for (const k of Object.keys(tot)) tot[k] += x[k];
    byPx[b] = { lookups: x.lookups, stalePct: pct(x.stale, x.lookups) };
  }
  const bySince = {};
  for (const [k, v] of Object.entries(r.bySince)) bySince[k] = { lookups: v.lookups, stalePct: pct(v.stale, v.lookups) };
  const fps = r.frames / Math.max(0.001, r.secs);
  const rate = (b) => ({ req: (b.reqChanges * fps) / Math.max(1, b.frames), shown: (b.shownChanges * fps) / Math.max(1, b.frames) });
  // bodies on screen for at least a second that the renderer wanted to animate (not a held pose)
  const live = r.bodies.filter((b) => b.frames >= fps && (b.reqChanges * fps) / b.frames >= 5);
  const dist = (list) => {
    const xs = list.map((b) => rate(b).shown);
    return { bodies: list.length, min: round(quantile(xs, 0)), p10: round(quantile(xs, 0.1)), p50: round(quantile(xs, 0.5)), reqP50: round(quantile(list.map((b) => rate(b).req), 0.5)), under10: list.filter((b) => rate(b).shown < 10).length, under12: list.filter((b) => rate(b).shown < 12).length };
  };
  const large = live.filter((b) => b.px >= 40);
  const ball = live.filter((b) => b.ball >= b.frames * 0.5);
  const near = [...live].sort((a, b) => b.px - a.px).slice(0, 6);
  const hist = Object.entries(r.pxHist ?? {}).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
  const n = hist.reduce((s, x) => s + x[1], 0);
  const pxAt = (q) => {
    let acc = 0;
    for (const [k, v] of hist) if ((acc += v) >= q * n) return k;
    return null;
  };
  return {
    frames: r.frames,
    secs: round(r.secs, 1),
    spritePx: n ? { min: hist[0][0], p10: pxAt(0.1), p50: pxAt(0.5), p90: pxAt(0.9), max: hist[hist.length - 1][0] } : null,
    fps: round(fps, 1),
    lookupsPerFrame: round(tot.lookups / Math.max(1, r.frames), 1),
    hitRate: round(tot.hit / Math.max(1, tot.lookups), 3),
    newPerSec: round(tot.made / Math.max(0.001, r.secs), 1),
    stalePct: pct(tot.stale, tot.lookups),
    byPx,
    bySinceStart: bySince,
    starts: r.starts,
    drawMsP50: round(quantile(r.drawMs, 0.5), 2),
    drawMsP99: round(quantile(r.drawMs, 0.99), 2),
    maxStaleRun: Math.max(0, ...r.bodies.map((b) => b.maxStaleRun)),
    maxStaleRun32: Math.max(0, ...r.bodies.filter((b) => b.px >= 32).map((b) => b.maxStaleRun)),
    animFps: { all: dist(live), large40: dist(large), ball: dist(ball), nearest6: dist(near) },
    spriteAreaMpx: round(r.areaNow / 1e6, 2),
    spriteAreaPeakMpx: round(r.areaPeak / 1e6, 2),
    cacheEntries: r.cacheEntries,
    pixelDebug: r.pixelDebug,
  };
}
