// Claude, 2026-11-10 (studio overhaul, team ut): the Ultimate Team QA harness. Copied from the UI
// audit's harness (insets, standalone, isolation) and extended with every measure the overhaul's
// acceptance numbers need. Localhost only: every request to another host is aborted except Google
// Fonts (so Archivo renders as on the phone), and the app runs on the inspect namespace with a local
// relay, so nothing reaches the live registry, saves, relays or boards.
//
//   node scripts/qa/ut-studio.mjs <case> [flags]          (dev server: npx vite --port 5212 --strictPort)
// Relay guard (always on): every WebSocket goes through context.routeWebSocket. Sockets to the local
// relay (localhost/127.0.0.1:7777) and the dev server's own HMR socket connect; any other socket is
// refused, listed in the report and fails the run (exit code 1).
// Cases
//   selfcheck   Home, Ranks, Profile, UT Home and every UT tab and segment plus the Rewards inbox,
//               3 sports x 3 sizes, every metric, a screenshot each, tap feedback; dead taps at
//               393x852 (--dead all|none)
//   fixtures    every fixture in scripts/qa/fixtures/ut loads in its sport: Home, then UT Home,
//               with 0 page errors and the Rewards inbox it was built with; a fixture with a MINUTES
//               ledger (profile.playtime) must still hold it, unchanged, after the app has saved
//   deadtaps    the dead-tap walk alone (fresh context per screen), at --size (default 393);
//               --screen <id> (repeatable) walks only those screens
//   minutes     MINUTES on screen (ut-3), per sport x size and MINUTES fixture (default minutes-27,
//               minutes-week-600, minutes-90; --fixture picks one): Home's ring chip inside the gutters
//               with Home's scroll and PLAY bar measured; the Minutes screen's metrics (targets, text,
//               contrast) with the next rung visible without scrolling; CLAIM feedback time, coins and
//               packs paid once, a second tap a no-op; reduced motion (--rm) draws the rings and rail
//               fills with no animation; the Profile panel; UT Home's ring (first fixture only)
//   recap       the 5-second end of match (ut-5): a Squad Battles SIM to the result; the One-More bar's
//               time from mount (<= 5.0 s; --rm <= 100 ms), tally fps and long tasks (--cpu 4: >= 55),
//               vibrations outside input (0), the bar's tap area over V2 A.5's A centre, >= 64 px and
//               the only data-primary, layout metrics; the BOX SCORE sheet; --skip taps at 0.7 s
//               (final state <= 100 ms, the tap presses nothing); --onemore taps the bar and times the
//               next match's first game frame (<= 3.0 s)
//   kit         the visual kit (src/ut/kit.tsx) rendered inside UT: sizes, data-primary, press and
//               claim burst, its CSS gzip size (<= 5 KB); with --rm, burst, sheen and ring fill must
//               compute animation none
// Flags
//   --sport nba|nfl|soccer (repeatable; default all)   --size 393|375|320 (repeatable; default all)
//   --fixture <name> (default audit)    --edge / --no-edge (default on: shell's Fix A, simulated)
//   --cpu <n> (CPU throttling)          --rm (reduced motion)   --clock <ISO or ET "YYYY-MM-DD HH:MM">
//   --out <dir> (screenshots + report.json; default $PS_QA_ARTIFACTS/ut-studio)
//   --dead 393|all|none (selfcheck: where to run the dead-tap walk; default 393)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fixturesFor, readFixture, SPORTS, useFixture } from './ut-fixtures.mjs';

const require = createRequire(new URL('../../package.json', import.meta.url));
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BASE = process.env.PS_QA_URL || 'http://localhost:5212/';
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname)) throw Error('QA fixtures are restricted to localhost.');

/** The three phone frames: the owner's iPhone, a home-button iPhone, the smallest supported. */
export const SIZES = {
  393: { w: 393, h: 852, insets: [59, 0, 34, 0] },
  375: { w: 375, h: 667, insets: [20, 0, 0, 0] },
  320: { w: 320, h: 568, insets: [20, 0, 0, 0] },
};
/** Shell's top-edge clearance (shell plan, stage-layout.ts topEdge): 59 -> 22, 47 -> 19, 20 -> 8. */
export const topEdge = (inset) => Math.min(22, Math.round(Math.max(0, inset) * 0.4));
/** Shell's Fix A as the audit simulated it (O/audit-scripts/utui/edge.mjs). It switches itself off
 * once the real fix is in the build (the stage then carries --inset-top inline). */
const fixCss = (edge) => {
  const s = '.stage:not([style*="--inset-top"])';
  return `${s}{--edge:${edge}px}
${s} .shell-top{padding-top:calc(var(--sat) + var(--edge))!important}
${s} .shell-views{top:calc(var(--sat) + var(--edge) + var(--top-h))!important}
${s} .screen{padding-top:calc(var(--sat) + var(--edge))!important}`;
};
const ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];
/** The only WebSocket endpoints QA may open: the local relay, and the dev server (Vite's HMR). */
const RELAY_OK = ['localhost:7777', '127.0.0.1:7777'];
/** Never tapped by the dead-tap walk: they spend, sell, submit, go online, reset or leave the app. */
const DENY = /\b(QUICK SELL|SELL|SUBMIT|BUY|FIND MATCH|PLAY ONLINE|RESET|ERASE|ADMIN|SEND|DELETE|SIGN OUT)\b/i;
/** OPEN on a registered pack (Spotlight, GOAT, Icon, numbered) talks to the card registry. */
const REGISTERED = /SPOTLIGHT|GOAT|ICON|NUMBERED|REGISTERED|SERIAL/i;

export const blocked = new Set();
/** Every WebSocket the app tried to open: connected (local) or refused (anything else). */
export const sockets = { local: 0, refused: [] };
/** The relay guard's verdict, for a report: { local, nonLocal, ok }. */
export const socketReport = () => ({ local: sockets.local, nonLocal: [...new Set(sockets.refused)], ok: sockets.refused.length === 0 });

export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  return chromium.launch({ headless: true, ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
}

/**
 * Abort every request that isn't localhost or Google Fonts (BUILD-RULES: never touch live services),
 * and route every WebSocket through the relay guard: only the local relay and the dev server's HMR
 * socket connect; anything else (a live Nostr relay, a realtime backend) is refused and recorded.
 */
export async function isolate(context) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (ALLOWED_HOSTS.includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    blocked.add(u.hostname);
    return route.abort();
  });
  const dev = new URL(BASE);
  const devHost = dev.hostname + ':' + (dev.port || (dev.protocol === 'https:' ? '443' : '80'));
  await context.routeWebSocket(/.*/, (ws) => {
    const u = new URL(ws.url());
    const host = u.hostname + ':' + (u.port || (u.protocol === 'wss:' ? '443' : '80'));
    if (RELAY_OK.includes(host) || host === devHost) {
      sockets.local++;
      ws.connectToServer();
      return;
    }
    sockets.refused.push(u.protocol + '//' + host);
    ws.close({ code: 1008, reason: 'QA isolation: only the local relay at localhost:7777' });
  });
}

/** "2026-11-22 12:00" is Eastern wall time; anything else is parsed as an ISO instant. */
export function parseClock(s) {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/.exec(s);
  if (!m) return new Date(s).toISOString();
  for (const off of ['-05:00', '-04:00']) {
    const d = new Date(m[1] + 'T' + m[2] + ':' + m[3] + ':00' + off);
    const et = d.toLocaleString('en-CA', { timeZone: 'America/New_York', hour12: false });
    if (et.includes(m[2] + ':' + m[3])) return d.toISOString();
  }
  return new Date(m[1] + 'T' + m[2] + ':' + m[3] + ':00-05:00').toISOString();
}

/**
 * A fresh, isolated phone: the size's viewport and insets, touch, standalone, the fixture's storage
 * and clock, shell's top edge, long-task and page-error recording, optional CPU throttling.
 */
export async function openPhone(browser, { sport, size, fixture = 'audit', rm = false, cpu = 0, edge = true, clock = null }) {
  const d = SIZES[size];
  const context = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: rm ? 'reduce' : 'no-preference' });
  await isolate(context);
  const inset = d.insets[0];
  const edgePx = edge ? topEdge(inset) : 0;
  await context.addInitScript(
    ({ insets, css }) => {
      window.__psInsets = insets;
      Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
      window.__lt = [];
      try {
        new PerformanceObserver((l) => window.__lt.push(...l.getEntries().map((e) => [e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
      } catch {
        // no long-task timing in this engine
      }
      if (css)
        document.addEventListener('DOMContentLoaded', () => {
          const s = document.createElement('style');
          s.id = '__ut_edge';
          s.textContent = css;
          document.head.append(s);
        });
    },
    { insets: d.insets, css: edge ? fixCss(edgePx) : '' },
  );
  const page = await context.newPage();
  const fx = typeof fixture === 'string' ? readFixture(sport, fixture) : fixture;
  await useFixture(context, page, fx, { clock });
  // after the fixture is seeded: count the app's own localStorage writes per key (window.__psWrites),
  // so a check can prove the app really saved, not just that the stored value survived
  await context.addInitScript(() => {
    const writes = (window.__psWrites = {});
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === window.localStorage) writes[k] = (writes[k] ?? 0) + 1;
      return set.call(this, k, v);
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (cpu > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  const url = new URL(BASE);
  url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  return { context, page, errors, edge: edgePx, inset, fixture: fx };
}

export const settle = async (page, ms = 450) => {
  await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

// ---------------------------------------------------------------- navigation

export async function closeDialogs(page) {
  for (let i = 0; i < 5 && (await page.locator('[role=dialog]').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
const inUt = (page) => page.locator('.ut-tabs').count();
export async function waitHome(page) {
  await page.locator('.home .playbar').waitFor({ timeout: 60000 });
  await settle(page, 900);
}
export async function enterUt(page) {
  if (await inUt(page)) return;
  await page.getByRole('button', { name: /Ultimate Team:/ }).first().click();
  await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
  await settle(page, 900);
  await closeDialogs(page);
}
const utTab = async (page, label) => {
  await enterUt(page);
  await closeDialogs(page);
  await page
    .locator('.ut-tabs button')
    .filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) })
    .click();
  await settle(page, 300);
};
const seg = async (page, label) => {
  await page.locator('.ut-segs [role=tab]').filter({ hasText: new RegExp('^' + label) }).click();
  await settle(page, 300);
};

/** Back to the main app from anywhere in UT (UT Home's EXIT), then one of its tabs. */
async function mainTab(page, label) {
  if (await inUt(page)) {
    await utTab(page, 'HOME');
    await page.locator('.ut-back').first().click();
    await page.locator('nav.tabs').waitFor({ timeout: 30000 });
  }
  await closeDialogs(page);
  await page
    .locator('nav.tabs button')
    .filter({ hasText: new RegExp('^\\s*' + label + '\\s*$', 'i') })
    .first()
    .click();
  await settle(page, 500);
}

/** RANKS → MINUTES (ut-3), with the lazy screen loaded. */
async function openMinutes(page) {
  await mainTab(page, 'RANKS');
  await page.locator('.ranks-head .seg button').filter({ hasText: /^MINUTES$/ }).click();
  await page.locator('.mv-hero').waitFor({ timeout: 30000 });
  await settle(page, 500);
}

/** Home, Ranks, Profile, UT Home, every UT tab and segment, and the Rewards inbox: how to get to each from anywhere. */
export const SCREENS = [
  { id: 'home', go: (p) => mainTab(p, 'HOME') },
  { id: 'ranks', go: (p) => mainTab(p, 'RANKS') },
  { id: 'profile', go: (p) => mainTab(p, 'PROFILE') },
  { id: 'minutes', go: (p) => openMinutes(p) },
  { id: 'ut-home', go: (p) => utTab(p, 'HOME') },
  { id: 'play', go: (p) => utTab(p, 'PLAY') },
  { id: 'squad', go: (p) => utTab(p, 'SQUAD') },
  { id: 'club-players', go: async (p) => (await utTab(p, 'CLUB'), seg(p, 'PLAYERS')) },
  { id: 'club-storage', go: async (p) => (await utTab(p, 'CLUB'), seg(p, 'STORAGE')) },
  { id: 'club-collection', go: async (p) => (await utTab(p, 'CLUB'), seg(p, 'COLLECTION')) },
  { id: 'club-development', go: async (p) => (await utTab(p, 'CLUB'), seg(p, 'DEVELOPMENT')) },
  { id: 'challenges-sbc', go: async (p) => (await utTab(p, 'CHALLENGES'), seg(p, 'SBCs')) },
  { id: 'challenges-objectives', go: async (p) => (await utTab(p, 'CHALLENGES'), seg(p, 'OBJECTIVES')) },
  { id: 'challenges-season', go: async (p) => (await utTab(p, 'CHALLENGES'), seg(p, 'SEASON PASS')) },
  { id: 'store', go: (p) => utTab(p, 'STORE') },
  // ut-4: the Rewards inbox is the hub's Rewards row (the hero's CLAIM ALL claims in place)
  { id: 'inbox', go: async (p) => (await utTab(p, 'HOME'), await closeDialogs(p), await p.locator('.uh-rewards').click(), settle(p, 300)) },
];

/** Where the app is: the screen title, tab, segment and open dialogs. */
const signature = (page) =>
  page.evaluate(() => ({
    title: document.querySelector('.ut-title')?.textContent ?? (document.querySelector('.home .playbar') ? 'HOME' : ''),
    tab: document.querySelector('.ut-tabs [aria-current=page] span, nav.tabs [aria-current=page] span')?.textContent ?? '',
    seg: document.querySelector('.ut-segs [aria-selected=true]')?.textContent ?? '',
    dialogs: document.querySelectorAll('[role=dialog]').length,
    arena: !!document.querySelector('.arcade-full, .ut-open-screen, .utm'),
  }));
const sameScreen = (a, b) => a.title === b.title && a.tab === b.tab && a.seg === b.seg && a.dialogs === b.dialogs && a.arena === b.arena;

// ---------------------------------------------------------------- per-screen metrics

/** Layout, text, targets, contrast and the top edge of what's on screen (the topmost dialog, or the stage). */
const measure = (page, edge) =>
  page.evaluate((edge) => {
    const stage = document.querySelector('.stage');
    if (!stage) return { error: 'no stage' };
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth || 1;
    const css = getComputedStyle(stage);
    const sat = parseFloat(css.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(css.getPropertyValue('--sab')) || 0;
    // once shell's real fix is in, --sat already includes the edge and --inset-top is the raw inset
    const realEdge = css.getPropertyValue('--inset-top').trim();
    const clearance = realEdge ? sat : sat + edge;
    const H = stage.offsetHeight;
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      for (let n = e; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      }
      return r.bottom > sr.top + 1 && r.top < sr.bottom - 1;
    };
    const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const scroller = (e) => {
      for (let n = e.parentElement; n && n !== stage; n = n.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowX)) return n;
      return null;
    };
    const vscroller = (e) => {
      for (let n = e.parentElement; n && n !== stage; n = n.parentElement) if (/(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
      return null;
    };
    const dialog = [...document.querySelectorAll('[role=dialog]')].filter(visible).pop();
    const root = dialog || stage;
    const offscreen = [],
      truncated = [],
      clipped = [],
      tiny = [],
      lowc = [],
      gradientText = [];
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (e) => {
      for (let n = e; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        const c = parse(s.backgroundColor);
        if (c && c.a > 0.85) return c;
        if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      }
      return { r: 4, g: 18, b: 26, a: 1 };
    };
    let topMost = 1e9,
      topMostLabel = '';
    for (const e of root.querySelectorAll('*')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      const hasText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      const interactive = e.matches('button, a[href], input, [role=tab], [role=switch]');
      if ((r.right > sr.right + 1 || r.left < sr.left - 1) && !scroller(e)) offscreen.push(label(e) + ' @' + Math.round((r.right - sr.left) / k));
      const yTop = (r.top - sr.top) / k;
      if ((hasText || interactive) && !vscroller(e) && yTop < topMost) {
        topMost = yTop;
        topMostLabel = label(e);
      }
      if (!hasText) continue;
      const s = getComputedStyle(e);
      const fs = parseFloat(s.fontSize);
      if (fs < 10) tiny.push(label(e) + ' ' + fs + 'px');
      if (e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(s.overflowX)) (s.textOverflow === 'ellipsis' ? truncated : clipped).push(label(e));
      else if (e.scrollHeight > e.clientHeight + 2 && /(hidden|clip)/.test(s.overflowY) && !/\d/.test(s.webkitLineClamp || '')) clipped.push('V:' + label(e));
      const fg = parse(s.color);
      if (!fg) continue;
      const op = +s.opacity;
      const a = fg.a * (isNaN(op) ? 1 : op);
      const big = fs >= 18 || (fs >= 14 && +s.fontWeight >= 700);
      const bg = bgOf(e);
      if (!bg) {
        // text over a gradient or art: sampled from the screenshot's pixels behind it (node side)
        if (gradientText.length < 40 && r.width > 2 && r.height > 2)
          gradientText.push({ label: label(e), x: r.left, y: r.top, w: r.width, h: r.height, fg: [fg.r, fg.g, fg.b, a], need: big ? 3 : 4.5 });
        continue;
      }
      const mix = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
      const L1 = lum(mix),
        L2 = lum(bg);
      const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (cr < (big ? 3 : 4.5)) lowc.push(label(e) + ' ' + cr.toFixed(2));
    }
    const small = [];
    let targets = 0;
    for (const e of root.querySelectorAll('button, a[href], input, select, [role=switch], [role=tab], [role=radio], summary')) {
      if (!visible(e) || e.disabled || e.closest('[aria-hidden=true],[inert]')) continue;
      const box = e.getBoundingClientRect();
      const pb = getComputedStyle(e, '::before');
      const px = (v) => (v.endsWith('px') ? parseFloat(v) : 0);
      const r =
        pb.content !== 'none' && pb.position === 'absolute' && pb.visibility !== 'hidden'
          ? { left: box.left + Math.min(0, px(pb.left)) * k, right: box.right - Math.min(0, px(pb.right)) * k, top: box.top + Math.min(0, px(pb.top)) * k, bottom: box.bottom - Math.min(0, px(pb.bottom)) * k }
          : box;
      const sc = scroller(e);
      if (sc) {
        const q = sc.getBoundingClientRect();
        if (r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom) continue;
      }
      targets++;
      const w = (r.right - r.left) / k,
        h = (r.bottom - r.top) / k;
      if (w < 43.5 || h < 43.5) small.push(label(e) + ' ' + Math.round(w) + 'x' + Math.round(h));
    }
    const primaries = [...document.querySelectorAll('[data-primary]')].filter(visible).length;
    const uniq = (a) => [...new Set(a)];
    return {
      k: +k.toFixed(3),
      sat,
      sab,
      edge,
      title: document.querySelector('.ut-title')?.textContent ?? '',
      tab: document.querySelector('.ut-tabs [aria-current=page] span, nav.tabs [aria-current=page] span')?.textContent ?? '',
      seg: document.querySelector('.ut-segs [aria-selected=true]')?.textContent ?? '',
      hOverflow: document.documentElement.scrollWidth - innerWidth,
      docScroll: document.scrollingElement.scrollHeight - innerHeight,
      topMost: Math.round(topMost),
      topMostLabel,
      topClear: topMost >= clearance - 0.5,
      clearance,
      targets,
      primaries,
      offscreen: uniq(offscreen),
      clipped: uniq(clipped),
      truncated: uniq(truncated),
      small: uniq(small),
      tiny: uniq(tiny),
      lowContrast: uniq(lowc),
      gradientText,
      H,
    };
  }, edge);

/** Contrast of text over gradients and art, from the screenshot's own pixels behind it. */
async function sampleGradientContrast(page, png, items) {
  if (!items.length) return [];
  return page.evaluate(
    async ({ b64, items }) => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const lum = ([r, gg, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
      };
      const out = [];
      for (const t of items) {
        const x0 = Math.max(0, Math.round(t.x)),
          y0 = Math.max(0, Math.round(t.y)),
          x1 = Math.min(img.width - 1, Math.round(t.x + t.w) - 1),
          y1 = Math.min(img.height - 1, Math.round(t.y + t.h) - 1);
        if (x1 <= x0 || y1 <= y0) continue;
        const px = (x, y) => [...g.getImageData(x, y, 1, 1).data];
        const ring = [];
        const step = Math.max(1, Math.round((x1 - x0) / 24));
        for (let x = x0; x <= x1; x += step) ring.push(px(x, y0), px(x, y1));
        const vstep = Math.max(1, Math.round((y1 - y0) / 8));
        for (let y = y0; y <= y1; y += vstep) ring.push(px(x0, y), px(x1, y));
        // the background is what is least like the text: keep the half of the samples farthest from it
        const fg = t.fg;
        const dist = (p) => Math.abs(p[0] - fg[0]) + Math.abs(p[1] - fg[1]) + Math.abs(p[2] - fg[2]);
        const bg = ring.sort((a, b) => dist(b) - dist(a)).slice(0, Math.max(1, Math.ceil(ring.length / 2)));
        const mix = (b) => [fg[0] * fg[3] + b[0] * (1 - fg[3]), fg[1] * fg[3] + b[1] * (1 - fg[3]), fg[2] * fg[3] + b[2] * (1 - fg[3])];
        // worst case over the background samples, from the median outward (one stray pixel doesn't decide)
        const ratios = bg.map((b) => {
          const L1 = lum(mix(b)),
            L2 = lum(b);
          return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        });
        ratios.sort((a, b) => a - b);
        const cr = ratios[Math.floor(ratios.length * 0.25)];
        if (cr < t.need) out.push(t.label + ' ' + cr.toFixed(2) + ' (on gradient)');
      }
      return out;
    },
    { b64: png.toString('base64'), items },
  );
}

/**
 * Tap feedback: press each of up to `max` controls (mouse down, never released on it: the click is
 * swallowed) and time pointerdown -> the first computed-style change on it, an ancestor or its
 * pseudo-elements, or the first DOM mutation in the app.
 */
async function tapFeedback(page, max = 10) {
  const handles = await page.$$(
    ':is(.stage [role=dialog]:last-of-type, .stage) :is(button, a[href], [role=tab], [role=switch]):not(:disabled):not([aria-hidden=true] *)',
  );
  const picked = [];
  for (const h of handles) {
    if (picked.length >= max) break;
    const ok = await h.evaluate((e) => {
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= innerHeight && !!top && (top === e || e.contains(top));
    });
    if (ok) picked.push(h);
  }
  const results = [];
  for (const h of picked) {
    const box = await h.boundingBox();
    if (!box) continue;
    const label = await h.evaluate((e) => (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 32));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await h.evaluate((el) => {
      const PROPS = ['transform', 'scale', 'translate', 'filter', 'opacity', 'background-color', 'background-image', 'box-shadow', 'color', 'border-top-color', 'outline-color'];
      const nodes = [];
      for (let n = el, i = 0; n && i < 4; n = n.parentElement, i++) nodes.push([n, null], ...(i === 0 ? [[n, '::before'], [n, '::after']] : []));
      const snap = () => nodes.map(([n, pe]) => PROPS.map((p) => getComputedStyle(n, pe).getPropertyValue(p)).join('|')).join('#');
      const before = snap();
      const st = (window.__tapProbe = { t0: 0, t1: 0, mut: 0 });
      const mo = new MutationObserver(() => {
        if (st.t0 && !st.mut) st.mut = performance.now();
      });
      mo.observe(document.querySelector('.stage') ?? document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      const down = () => {
        st.t0 = performance.now();
        const tick = () => {
          if (!st.t1 && snap() !== before) st.t1 = performance.now();
          if (!st.t1 && performance.now() - st.t0 < 400) requestAnimationFrame(tick);
          else mo.disconnect();
        };
        requestAnimationFrame(tick);
      };
      window.addEventListener('pointerdown', down, { capture: true, once: true });
      // the press is a probe: no click may reach the app
      st.block = (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
      };
      window.addEventListener('click', st.block, { capture: true });
    });
    await page.mouse.down();
    await page.waitForTimeout(420);
    await page.mouse.move(2, 2);
    await page.mouse.up();
    const r = await page.evaluate(() => {
      const st = window.__tapProbe;
      setTimeout(() => window.removeEventListener('click', st.block, { capture: true }), 50);
      const first = [st.t1, st.mut].filter((t) => t > 0);
      return first.length && st.t0 ? Math.round(Math.min(...first) - st.t0) : null;
    });
    await page.waitForTimeout(80);
    results.push({ label, ms: r });
  }
  const ms = results.map((r) => r.ms).filter((x) => x !== null).sort((a, b) => a - b);
  return {
    probed: results.length,
    medianMs: ms.length ? ms[Math.floor(ms.length / 2)] : null,
    maxMs: ms.length ? ms[ms.length - 1] : null,
    over100: results.filter((r) => r.ms !== null && r.ms > 100).map((r) => r.label + ' ' + r.ms + 'ms'),
    none: results.filter((r) => r.ms === null).map((r) => r.label),
  };
}

/** Long tasks since `since` (performance time): count and total ms. */
const longTasks = (page, since) =>
  page.evaluate((since) => {
    const l = (window.__lt || []).filter(([t]) => t >= since);
    return { n: l.length, ms: Math.round(l.reduce((a, [, d]) => a + d, 0)), worst: Math.round(Math.max(0, ...l.map(([, d]) => d))) };
  }, since);

/** Every metric for the screen the page is on, with a screenshot. */
async function captureScreen(page, { file, edge, since, errors, errorsBefore, probe = true }) {
  await page
    .locator('.toast')
    .waitFor({ state: 'detached', timeout: 4000 })
    .catch(() => {});
  const m = await measure(page, edge);
  const png = await page.screenshot({ path: file, timeout: 20000 });
  const gradient = await sampleGradientContrast(page, png, m.gradientText).catch((e) => ['sampling failed: ' + e.message]);
  delete m.gradientText;
  m.lowContrast = [...m.lowContrast, ...gradient];
  m.longTasks = await longTasks(page, since);
  m.pageErrors = errors.slice(errorsBefore);
  if (probe) m.tapFeedback = await tapFeedback(page);
  return m;
}

// ---------------------------------------------------------------- dead taps

/** The screen's tappable controls in document order, minus the denylist, as stable keys. */
const tapTargets = (page) =>
  page.evaluate(
    ({ deny, registered }) => {
      const D = new RegExp(deny, 'i'),
        R = new RegExp(registered, 'i');
      const root = [...document.querySelectorAll('[role=dialog]')].pop() || document.querySelector('.stage');
      const seen = {};
      const out = [];
      for (const e of root.querySelectorAll('button, a[href], [role=tab], [role=switch], summary')) {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || e.disabled || e.closest('[aria-hidden=true],[inert]')) continue;
        if (getComputedStyle(e).visibility === 'hidden') continue;
        const label = (e.getAttribute('aria-label') || e.innerText || e.title || e.className || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 48);
        const n = (seen[label] = (seen[label] ?? -1) + 1);
        let skip = '';
        if (D.test(label)) skip = 'denylist';
        // the tab or segment already open: tapping it again rightly changes nothing (switches and
        // toggle buttons are still tapped: they flip)
        else if (e.matches('[aria-current=page], [aria-current=true], [role=tab][aria-selected=true]')) skip = 'already selected';
        else if (/\bOPEN\b/i.test(label) && R.test(e.closest('article, li, section, .ut-mine-pack, div')?.innerText ?? '')) skip = 'registered pack';
        else if (e.matches('a[target=_blank]')) skip = 'leaves the app';
        out.push({ label, n, skip });
      }
      return out;
    },
    { deny: DENY.source, registered: REGISTERED.source },
  );

/** Click one control and report whether anything visible happened within 600 ms. */
async function tapOnce(page, target) {
  const handle = await page.evaluateHandle(
    ({ label, n }) => {
      const root = [...document.querySelectorAll('[role=dialog]')].pop() || document.querySelector('.stage');
      let i = -1;
      for (const e of root.querySelectorAll('button, a[href], [role=tab], [role=switch], summary')) {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || e.disabled || e.closest('[aria-hidden=true],[inert]')) continue;
        if (getComputedStyle(e).visibility === 'hidden') continue;
        const l = (e.getAttribute('aria-label') || e.innerText || e.title || e.className || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 48);
        if (l === label && ++i === n) return e;
      }
      return null;
    },
    { label: target.label, n: target.n },
  );
  const el = handle.asElement();
  if (!el) return { ...target, result: 'missing' };
  // what changes on its own (timers, count-ups) is noise, not a response
  await page.evaluate(
    () =>
      new Promise((res) => {
        const noisy = (window.__noisy = new Set());
        const mo = new MutationObserver((l) => l.forEach((m) => noisy.add(m.target)));
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        setTimeout(() => (mo.disconnect(), res()), 250);
      }),
  );
  await page.evaluate(() => {
    const st = (window.__tap = { at: 0, hit: 0 });
    const noisy = window.__noisy;
    const isNoise = (n) => {
      for (let x = n; x; x = x.parentNode) if (noisy.has(x) && x !== document.body) return true;
      return false;
    };
    st.mo = new MutationObserver((l) => {
      if (!st.hit && l.some((m) => !isNoise(m.target))) st.hit = performance.now();
    });
    st.mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener('click', () => (st.at = performance.now()), { capture: true, once: true });
  });
  const url0 = page.url();
  try {
    await el.click({ timeout: 2500 });
  } catch (e) {
    return { ...target, result: 'unclickable', why: e.message.split('\n')[0].slice(0, 80) };
  }
  let ms = null;
  for (let t = 0; t < 12 && ms === null; t++) {
    await page.waitForTimeout(50);
    ms = await page.evaluate(() => (window.__tap?.hit ? Math.round(window.__tap.hit - window.__tap.at) : null)).catch(() => 0);
    if (page.url() !== url0) ms = 0;
  }
  await page.evaluate(() => window.__tap?.mo.disconnect()).catch(() => {});
  return { ...target, result: ms === null ? 'DEAD' : 'ok', ms };
}

/** Every control on one screen, in a fresh context, restoring the screen after each tap. */
async function deadTapScreen(browser, opts, screen) {
  const { context, page, errors } = await openPhone(browser, opts);
  const out = { screen: screen.id, dead: [], ok: 0, skipped: [], unclickable: [], errors: [] };
  try {
    await waitHome(page);
    await closeDialogs(page);
    await screen.go(page);
    const home = await signature(page);
    const targets = await tapTargets(page);
    for (const t of targets) {
      if (t.skip) {
        out.skipped.push(t.label + ' (' + t.skip + ')');
        continue;
      }
      const r = await tapOnce(page, t);
      if (r.result === 'DEAD') out.dead.push(t.label);
      else if (r.result === 'ok') out.ok++;
      else out.unclickable.push(t.label + ' (' + r.result + ')');
      // back to the screen: close sheets, then navigate, then reload as a last resort
      if (!sameScreen(await signature(page).catch(() => ({})), home)) {
        await closeDialogs(page).catch(() => {});
        if (!sameScreen(await signature(page).catch(() => ({})), home)) {
          try {
            if (!(await page.locator('.home .playbar, .ut-tabs').count())) throw Error('left the menus');
            await screen.go(page);
          } catch {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await waitHome(page);
            await closeDialogs(page);
            await screen.go(page);
          }
        }
      }
    }
  } catch (e) {
    out.errors.push(e.message.split('\n')[0]);
  }
  out.errors.push(...errors);
  await context.close();
  return out;
}

// ---------------------------------------------------------------- cases

function args(argv) {
  const a = { _: [], sport: [], size: [], fixture: 'audit', edge: true, cpu: 0, rm: false, clock: null, out: null, dead: '393' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--sport') a.sport.push(argv[++i]);
    else if (k === '--size') a.size.push(argv[++i]);
    else if (k === '--fixture') a.fixture = argv[++i];
    else if (k === '--edge') a.edge = true;
    else if (k === '--no-edge') a.edge = false;
    else if (k === '--cpu') a.cpu = +argv[++i];
    else if (k === '--rm') a.rm = true;
    else if (k === '--clock') a.clock = parseClock(argv[++i]);
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--dead') a.dead = argv[++i];
    else if (k === '--screen') (a.screen ??= []).push(argv[++i]);
    else if (k === '--skip') a.skip = true;
    else if (k === '--onemore') a.onemore = true;
    else a._.push(k);
  }
  if (!a.sport.length) a.sport = [...SPORTS];
  if (!a.size.length) a.size = Object.keys(SIZES);
  a.out = a.out || path.join(process.env.PS_QA_ARTIFACTS || '/tmp/perfect-season-qa', 'ut-studio');
  fs.mkdirSync(a.out, { recursive: true });
  return a;
}

const flagsOf = (a) => ({ edge: a.edge, cpu: a.cpu, rm: a.rm, clock: a.clock, fixture: a.fixture });
const tally = (screens) => ({
  screens: screens.length,
  failed: screens.filter((s) => s.fail).length,
  overflow: screens.filter((s) => s.hOverflow > 0 || s.offscreen?.length).length,
  clipped: screens.reduce((n, s) => n + (s.clipped?.length ?? 0), 0),
  small: screens.reduce((n, s) => n + (s.small?.length ?? 0), 0),
  tiny: screens.reduce((n, s) => n + (s.tiny?.length ?? 0), 0),
  lowContrast: screens.reduce((n, s) => n + (s.lowContrast?.length ?? 0), 0),
  topNotClear: screens.filter((s) => s.topClear === false).length,
  pageErrors: screens.reduce((n, s) => n + (s.pageErrors?.length ?? 0), 0),
  longTasks: screens.reduce((n, s) => n + (s.longTasks?.n ?? 0), 0),
  longTaskMs: screens.reduce((n, s) => n + (s.longTasks?.ms ?? 0), 0),
  primaries: screens.reduce((n, s) => n + (s.primaries ?? 0), 0),
  tapProbed: screens.reduce((n, s) => n + (s.tapFeedback?.probed ?? 0), 0),
  tapNoFeedback: screens.reduce((n, s) => n + (s.tapFeedback?.none.length ?? 0), 0),
  tapOver100: screens.reduce((n, s) => n + (s.tapFeedback?.over100.length ?? 0), 0),
  tapMedianMs: (() => {
    const v = screens.map((s) => s.tapFeedback?.medianMs).filter((x) => x != null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  })(),
});

async function selfcheck(a) {
  const browser = await launch();
  const report = { case: 'selfcheck', at: new Date().toISOString(), base: BASE, flags: flagsOf(a), runs: [] };
  try {
    for (const sport of a.sport)
      for (const size of a.size) {
        const run = { sport, size: SIZES[size].w + 'x' + SIZES[size].h, insets: SIZES[size].insets, screens: [] };
        const { context, page, errors, edge } = await openPhone(browser, { sport, size, fixture: a.fixture, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock });
        try {
          await waitHome(page);
          await closeDialogs(page);
          for (const s of SCREENS) {
            const since = await page.evaluate(() => performance.now());
            const errorsBefore = errors.length;
            const file = path.join(a.out, sport + '-' + run.size + '-' + s.id + '.png');
            try {
              await s.go(page);
              await settle(page, 500);
              const m = await captureScreen(page, { file, edge, since, errors, errorsBefore });
              run.screens.push({ screen: s.id, ...m });
              console.log(
                [sport, run.size, s.id.padEnd(22), 'top', m.topMost + (m.topClear ? '' : '!'), 'small', m.small.length, 'tiny', m.tiny.length, 'lowc', m.lowContrast.length, 'clip', m.clipped.length, 'lt', m.longTasks.n, 'tap', m.tapFeedback.medianMs + 'ms', 'none', m.tapFeedback.none.length].join(' '),
              );
            } catch (e) {
              run.screens.push({ screen: s.id, fail: e.message.split('\n')[0] });
              console.log(sport, run.size, s.id, 'FAIL', e.message.split('\n')[0]);
              await closeDialogs(page).catch(() => {});
            }
          }
          run.errors = errors.slice();
        } finally {
          await context.close();
        }
        if (a.dead === 'all' || a.dead === String(size)) {
          run.deadTaps = [];
          for (const s of SCREENS) {
            const d = await deadTapScreen(browser, { sport, size, fixture: a.fixture, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock }, s);
            run.deadTaps.push(d);
            console.log(sport, run.size, 'dead taps', s.id.padEnd(22), 'ok', d.ok, 'dead', d.dead.length, d.dead.join(' | '), 'skipped', d.skipped.length, d.errors.length ? 'errors ' + d.errors.join(' | ') : '');
          }
        }
        run.summary = { ...tally(run.screens), deadTaps: run.deadTaps ? run.deadTaps.reduce((n, d) => n + d.dead.length, 0) : null };
        report.runs.push(run);
        fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify({ ...report, blocked: [...blocked], sockets: socketReport() }, null, 1));
      }
  } finally {
    await browser.close();
  }
  report.blocked = [...blocked];
  report.sockets = socketReport();
  report.summary = Object.fromEntries(report.runs.map((r) => [r.sport + ' ' + r.size, r.summary]));
  report.ok = report.sockets.ok;
  fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify(report, null, 1));
  console.table(report.summary);
  console.log('blocked hosts (aborted):', report.blocked.join(', ') || 'none');
  console.log('sockets: local', report.sockets.local, '| non-local', report.sockets.nonLocal.length, report.sockets.nonLocal.join(', '));
  return report;
}

async function fixturesCase(a) {
  const browser = await launch();
  const report = { case: 'fixtures', at: new Date().toISOString(), flags: flagsOf(a), results: [] };
  try {
    for (const sport of a.sport)
      for (const f of fixturesFor(sport)) {
        const size = a.size.length === Object.keys(SIZES).length ? '393' : a.size[0];
        const { context, page, errors } = await openPhone(browser, { sport, size, fixture: f.name, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock });
        const r = { sport, fixture: f.name, ok: true, steps: [] };
        try {
          if (f.name === 'fresh') {
            // a first launch: the welcome flow, not Home
            await page.waitForFunction(() => document.querySelector('.stage')?.innerText.trim().length > 0, null, { timeout: 60000 });
            await settle(page, 1500);
            r.steps.push('first launch');
          } else {
            await waitHome(page);
            r.steps.push('home');
            await page.screenshot({ path: path.join(a.out, 'fixture-' + sport + '-' + f.name + '-home.png') });
            await closeDialogs(page);
            await enterUt(page);
            r.steps.push('ut');
            r.inbox = await page.evaluate(() => document.querySelector('.uh-rewards')?.innerText.replace(/\s+/g, ' ').trim() ?? '');
          }
          // the MINUTES ledger rides in the basketball profile key (the cross-sport SHARED place):
          // after the app has loaded, migrated and saved, it must be exactly what the fixture held
          const want = f.name === 'fresh' ? undefined : readFixture(sport, f.name).storage['perfect-season:profile:v1']?.playtime;
          if (want !== undefined) {
            const { have, writes } = await page.evaluate(() => ({
              have: JSON.parse(localStorage.getItem('perfect-season:profile:v1') ?? 'null')?.playtime,
              writes: window.__psWrites?.['perfect-season:profile:v1'] ?? 0,
            }));
            // a round trip only counts if the app rewrote the key at least once
            r.profileWrites = writes;
            r.playtimeKept = writes >= 1 && JSON.stringify(have) === JSON.stringify(want);
            r.steps.push('playtime ' + (writes < 1 ? 'NOT SAVED' : r.playtimeKept ? 'kept over ' + writes + ' writes' : 'CHANGED'));
            if (!r.playtimeKept) r.ok = false;
          }
          await page.screenshot({ path: path.join(a.out, 'fixture-' + sport + '-' + f.name + '.png') });
        } catch (e) {
          r.ok = false;
          r.fail = e.message.split('\n')[0];
        }
        r.pageErrors = errors.slice();
        if (r.pageErrors.length) r.ok = false;
        report.results.push(r);
        console.log(sport.padEnd(6), f.name.padEnd(20), r.ok ? 'ok' : 'FAIL', r.steps.join(' > '), r.inbox ? '| ' + r.inbox.slice(0, 60) : '', r.fail ?? '', r.pageErrors.join(' | '));
        await context.close();
      }
  } finally {
    await browser.close();
  }
  report.blocked = [...blocked];
  report.sockets = socketReport();
  report.summary = {
    fixtures: report.results.length,
    failed: report.results.filter((r) => !r.ok).length,
    pageErrors: report.results.reduce((n, r) => n + r.pageErrors.length, 0),
    playtimeChecked: report.results.filter((r) => r.playtimeKept !== undefined).length,
    playtimeKept: report.results.filter((r) => r.playtimeKept).length,
    nonLocalSockets: report.sockets.nonLocal.length,
  };
  report.ok = report.sockets.ok && !report.summary.failed;
  fs.writeFileSync(path.join(a.out, 'fixtures-report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.summary), 'blocked:', report.blocked.join(', ') || 'none');
  return report;
}

async function deadtapsCase(a) {
  const browser = await launch();
  const size = a.size.length === Object.keys(SIZES).length ? '393' : a.size[0];
  const report = { case: 'deadtaps', at: new Date().toISOString(), flags: flagsOf(a), size, runs: [] };
  try {
    for (const sport of a.sport) {
      const screens = [];
      for (const s of a.screen ? SCREENS.filter((x) => a.screen.includes(x.id)) : SCREENS) {
        const d = await deadTapScreen(browser, { sport, size, fixture: a.fixture, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock }, s);
        screens.push(d);
        console.log(sport, 'dead taps', s.id.padEnd(22), 'ok', d.ok, 'dead', d.dead.length, d.dead.join(' | '), 'skipped', d.skipped.length);
      }
      report.runs.push({ sport, screens, dead: screens.reduce((n, d) => n + d.dead.length, 0) });
    }
  } finally {
    await browser.close();
  }
  report.blocked = [...blocked];
  report.sockets = socketReport();
  report.ok = report.sockets.ok;
  fs.writeFileSync(path.join(a.out, 'deadtaps-report.json'), JSON.stringify(report, null, 1));
  return report;
}

/** The kit, rendered with the app's own React inside a UT screen, measured and screenshotted. */
async function kitCase(a) {
  const browser = await launch();
  const cssPath = path.join(REPO, 'src/ut/ut-system.css');
  const css = fs.readFileSync(cssPath);
  const report = { case: 'kit', at: new Date().toISOString(), flags: flagsOf(a), cssBytes: css.length, cssGzip: zlib.gzipSync(css, { level: 9 }).length, runs: [] };
  try {
    for (const sport of a.sport)
      for (const size of a.size) {
        const { context, page, errors } = await openPhone(browser, { sport, size, fixture: a.fixture, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock });
        await waitHome(page);
        await closeDialogs(page);
        await enterUt(page);
        const r = await page.evaluate(async () => {
          // the app's own React: the same pre-bundled module URLs (and version hash) the kit imports
          const src = await (await fetch('/src/ut/kit.tsx')).text();
          const reactUrl = src.match(/from\s+"(\/node_modules\/\.vite\/deps\/react\.js\?v=[\w]+)"/)[1];
          const React = (await import(reactUrl)).default;
          // a pre-bundled CommonJS dependency: its exports sit on the default export
          const client = await import(reactUrl.replace('react.js', 'react-dom_client.js'));
          const createRoot = client.createRoot ?? client.default.createRoot;
          const kit = await import('/src/ut/kit.tsx');
          const icons = await import('/src/ut/icons.tsx');
          const h = React.createElement;
          const host = document.createElement('div');
          host.id = '__kit';
          host.style.cssText = 'position:absolute;inset:calc(var(--sat) + 8px) 0 calc(var(--sab) + 8px);z-index:50;overflow:auto;padding:8px 16px;background:var(--bg);display:grid;gap:12px;align-content:start';
          document.querySelector('.screen.ut').append(host);
          const now = Date.now();
          let claimed = 0;
          createRoot(host).render(
            h(
              React.Fragment,
              null,
              h(kit.SectionTitle, { title: 'Live now', aside: h(kit.Countdown, { to: now + 5 * 3600000, prefix: 'Ends in' }) }),
              h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, h(kit.RewardChip, { kind: 'coins', amount: 1500, label: 'coins' }), h(kit.RewardChip, { kind: 'pack', label: 'Gold Pack' }), h(kit.RewardChip, { kind: 'sp', amount: 80, label: 'SP' })),
              h('div', { style: { display: 'flex', gap: 12, alignItems: 'center' } }, h(kit.ProgressRing, { value: 2, max: 3 }), h(kit.ProgressRing, { value: 6, max: 6, size: 52 }), h(kit.Countdown, { to: now + 3 * 86400000 + 4 * 3600000 }), h(kit.GoChip, { onClick: () => {}, ariaLabel: 'Go to Squad Battles' })),
              h(kit.ClaimButton, { onClaim: () => claimed++ }),
              h(kit.EmptyState, { icon: h(icons.IconGift, { size: 28 }), line: 'Nothing to claim right now. Win a match to fill this up.', cta: { label: 'PLAY', onClick: () => {} } }),
              h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, h(kit.MinutesRing, { minutes: 27, target: 30, reward: '75 coins + stamp next', onClick: () => {} }), h(kit.MinutesRing, { minutes: 60, target: 60, reward: 'Silver Pack ready', state: 'ready', onClick: () => {} }), h(kit.MinutesRing, { minutes: 90, target: 90, reward: 'Great session.', state: 'done' })),
              h(kit.GoldBar, { eyebrow: 'Next up', title: '3 min to 75 coins', stake: '+ a Scout Stamp', onClick: () => (window.__goldClicks = (window.__goldClicks ?? 0) + 1) }),
              h(kit.PrimaryButton, { onClick: () => {}, sub: 'About 5 min' }, 'Play match'),
              // room to scroll, so a touch-drag that starts on the gold bar really scrolls the list
              h('div', { 'aria-hidden': true, style: { height: 1400 } }),
            ),
          );
          await new Promise((res) => setTimeout(res, 300));
          const q = (s) => host.querySelector(s);
          const claim = q('.ut-k-claim');
          const sheen = getComputedStyle(claim, '::before').animationName;
          const primarySheen = getComputedStyle(q('.ut-k-primary'), '::before').animationName;
          const goldSheen = getComputedStyle(q('.ut-k-gold'), '::before').animationName;
          const ring = getComputedStyle(q('.ut-k-ring circle + circle')).animationName;
          claim.click();
          const burst = getComputedStyle(claim, '::after').animationName;
          // in design px: the stage draws the 390 frame scaled to the phone (0.82 at 320 wide)
          const stage = document.querySelector('.stage');
          const k = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
          const box = (e) => {
            const b = e.getBoundingClientRect();
            return [Math.round(b.width / k), Math.round(b.height / k)];
          };
          const go = q('.ut-k-go');
          const before = getComputedStyle(go, '::before');
          return {
            claimed,
            burstAttr: claim.hasAttribute('data-burst'),
            animation: { sheen, primarySheen, goldSheen, ring, burst },
            mins: [...host.querySelectorAll('button.ut-k-mins')].map(box),
            gold: box(q('.ut-k-gold')),
            // V2 C.3 tokens resolve inside the UT screen
            tokens: ['bg', 'teal', 'gold', 'dim'].map((t) => getComputedStyle(host).getPropertyValue('--ps-' + t).trim()),
            primary: box(q('.ut-k-primary')),
            primaries: document.querySelectorAll('[data-primary]').length,
            claim: box(claim),
            goHit: [Math.round(go.getBoundingClientRect().width / k - 2 * parseFloat(before.left)), Math.round(go.getBoundingClientRect().height / k - 2 * parseFloat(before.top))],
            titlePx: getComputedStyle(q('.ut-k-title')).fontSize,
            titleFont: getComputedStyle(q('.ut-k-title')).fontStyle + ' ' + getComputedStyle(q('.ut-k-title')).fontStretch,
            countTone: [...host.querySelectorAll('.ut-k-count')].map((e) => e.dataset.tone + ' ' + e.textContent),
          };
        });
        await settle(page, 400);
        await page.screenshot({ path: path.join(a.out, 'kit-' + sport + '-' + SIZES[size].w + (a.rm ? '-rm' : '') + '.png') });
        // press feedback on a real UT control with no :active rule of its own (a tab bar button):
        // its computed style after mouse down (the press is swallowed, nothing navigates). One frame is
        // too early (every run read 'none none'), and a fixed wait is flaky on a loaded machine, so it
        // polls each frame for up to 600 ms until the style moves off its rest value.
        // The kit host covers the tab bar, so it is taken out (display: none) for this probe (a press on it would land
        // on the host, not the tab).
        await page.evaluate(() => (document.getElementById('__kit').style.display = 'none'));
        const tab = page.locator('.ut-tabs button').nth(1);
        const tb = await tab.boundingBox();
        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
        const look = () => tab.evaluate((e) => ({ transform: getComputedStyle(e).transform, filter: getComputedStyle(e).filter }));
        const rest = await look();
        // what is under the pointer (a covering layer would swallow the press and fail the probe)
        const hit = await page.evaluate(([x, y]) => {
          const e = document.elementFromPoint(x, y);
          return e ? (e.closest('button')?.className || e.tagName) + (e.closest('.ut-tabs button') ? ' (tab)' : ' (NOT the tab)') : 'nothing';
        }, [tb.x + tb.width / 2, tb.y + tb.height / 2]);
        await page.evaluate(() => window.addEventListener('click', (e) => (e.stopImmediatePropagation(), e.preventDefault()), { capture: true, once: true }));
        await page.mouse.down();
        await tab
          .evaluate(
            (e, r) =>
              new Promise((res) => {
                const t0 = performance.now();
                const poll = () => {
                  const cs = getComputedStyle(e);
                  if (cs.transform !== r.transform || cs.filter !== r.filter || performance.now() - t0 > 600) res();
                  else requestAnimationFrame(poll);
                };
                requestAnimationFrame(poll);
              }),
            rest,
          )
          .catch(() => {});
        await page.waitForTimeout(250); // let any transition on the control finish while still held
        const pressed = await look();
        await page.mouse.up();
        // reduced motion keeps the brightness but never scales; otherwise the press scales to 0.97
        const pressOk = a.rm ? pressed.transform === 'none' && pressed.filter !== rest.filter : pressed.transform !== rest.transform && /0\.97/.test(pressed.transform);
        r.press = { rest, pressed, hit, ok: pressOk };
        await page.evaluate(() => (document.getElementById('__kit').style.display = 'grid'));
        // scope: [data-pressed] outside the UT screen and .ps-v2 is left alone; a kit piece outside
        // both carries the tokens itself (the portal fallback), and one inside inherits a re-tint
        r.scope = await page.evaluate(() => {
          const out = document.createElement('div');
          out.setAttribute('data-pressed', 'true');
          document.body.append(out);
          const portal = document.createElement('span');
          portal.className = 'x ut-k-count';
          document.body.append(portal);
          const tint = document.createElement('div');
          tint.style.setProperty('--ps-teal', '#123456');
          tint.innerHTML = '<span class="ut-k-count"></span>';
          document.getElementById('__kit').append(tint);
          const res = {
            outsidePressed: getComputedStyle(out).transform + ' ' + getComputedStyle(out).filter,
            portalTeal: getComputedStyle(portal).getPropertyValue('--ps-teal').trim(),
            retinted: getComputedStyle(tint.firstChild).getPropertyValue('--ps-teal').trim(),
          };
          out.remove();
          portal.remove();
          tint.remove();
          return res;
        });
        r.scope.ok = r.scope.outsidePressed === 'none none' && r.scope.portalTeal === '#4fe3c1' && r.scope.retinted === '#123456';
        // haptics: a touch-drag that starts on the gold bar scrolls and never buzzes; a tap buzzes once
        // (the fixtures save haptics off, so the probe turns them on in the app's own sound.ts)
        await page.evaluate(async () => {
          window.__vib = [];
          navigator.vibrate = (p) => (window.__vib.push(p), true);
          window.__goldClicks = 0;
          (await import('/src/lib/sound.ts')).setFeedback(false, true);
        });
        const gold = page.locator('#__kit .ut-k-gold');
        await gold.scrollIntoViewIfNeeded();
        const gb = await gold.boundingBox();
        const cdp = await context.newCDPSession(page);
        const gx = Math.round(gb.x + gb.width / 2),
          gy = Math.round(gb.y + gb.height / 2);
        const scrollBefore = await page.evaluate(() => document.getElementById('__kit').scrollTop);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gx, y: gy }] });
        for (let i = 1; i <= 12; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gx, y: gy - i * 20 }] });
          await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(400);
        const drag = await page.evaluate(() => ({ vib: window.__vib.length, clicks: window.__goldClicks, scroll: document.getElementById('__kit').scrollTop }));
        await gold.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const gb2 = await gold.boundingBox();
        await page.touchscreen.tap(gb2.x + gb2.width / 2, gb2.y + gb2.height / 2);
        await page.waitForTimeout(300);
        const tap = await page.evaluate(() => ({ vib: window.__vib.slice(), clicks: window.__goldClicks }));
        await cdp.detach();
        r.haptic = { drag: { scrolled: drag.scroll - scrollBefore, vibrations: drag.vib, clicks: drag.clicks }, tap: { vibrations: tap.vib.length - drag.vib, clicks: tap.clicks - drag.clicks, pattern: tap.vib.at(-1) } };
        r.haptic.ok = r.haptic.drag.scrolled > 0 && r.haptic.drag.vibrations === 0 && r.haptic.drag.clicks === 0 && r.haptic.tap.clicks === 1 && r.haptic.tap.vibrations === 1;
        r.pageErrors = errors.slice();
        report.runs.push({ sport, size, ...r });
        console.log(sport, size, JSON.stringify(r));
        await context.close();
      }
  } finally {
    await browser.close();
  }
  report.sockets = socketReport();
  report.ok =
    report.sockets.ok &&
    report.cssGzip <= 5120 &&
    report.runs.every(
      (r) =>
        r.primary[1] >= 56 &&
        r.goHit[1] >= 44 &&
        r.claim[1] >= 44 &&
        r.gold[1] >= 56 &&
        r.mins.every(([w, hh]) => w >= 44 && hh >= 44) &&
        r.tokens.join() === '#071521,#4fe3c1,#f6b93b,#8aa3b5' &&
        r.claimed === 1 &&
        r.press.ok &&
        r.scope.ok &&
        r.haptic.ok &&
        !r.pageErrors.length &&
        (a.rm ? Object.values(r.animation).every((n) => n === 'none') : r.animation.burst === 'ut-k-burst' && r.animation.ring === 'ut-k-ring'),
    );
  fs.writeFileSync(path.join(a.out, 'kit-report' + (a.rm ? '-rm' : '') + '.json'), JSON.stringify(report, null, 1));
  console.log('kit CSS', report.cssBytes, 'bytes,', report.cssGzip, 'gzip; sockets', JSON.stringify(report.sockets), report.ok ? 'ok' : 'FAILED');
  return report;
}

/** Design px box of the first element matching `sel` (relative to the stage), or null. */
const boxOf = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    const stage = document.querySelector('.stage');
    if (!e || !stage) return null;
    const k = stage.getBoundingClientRect().width / stage.offsetWidth || 1,
      s = stage.getBoundingClientRect(),
      r = e.getBoundingClientRect();
    return { x: Math.round((r.left - s.left) / k), y: Math.round((r.top - s.top) / k), w: Math.round(r.width / k), h: Math.round(r.height / k), bottom: Math.round((r.bottom - s.top) / k) };
  }, sel);
/** The saved wallet (shared, basketball's key), this sport's packs and the claimed rungs. (The app drops ?sport= from the address once loaded.) */
const stored = (page, sport) =>
  page.evaluate((sport) => {
    const p = JSON.parse(localStorage.getItem('perfect-season:profile:v1') || '{}');
    const own = JSON.parse(localStorage.getItem({ nba: 'perfect-season:profile:v1', nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' }[sport]) || '{}');
    return { coins: p.coins, packs: (own.ut?.packs ?? []).length, claimed: p.playtime?.claimed };
  }, sport);

async function minutesCase(a) {
  const browser = await launch();
  const fixtures = a.fixture !== 'audit' ? [a.fixture] : ['minutes-27', 'minutes-week-600', 'minutes-90'];
  const report = { case: 'minutes', at: new Date().toISOString(), flags: flagsOf(a), runs: [] };
  try {
    for (const sport of a.sport)
      for (const size of a.size)
        for (const fixture of fixtures) {
          const tag = sport + '-' + SIZES[size].w + 'x' + SIZES[size].h + '-' + fixture + (a.rm ? '-rm' : '');
          const r = { sport, size: SIZES[size].w + 'x' + SIZES[size].h, fixture };
          const { context, page, errors, edge } = await openPhone(browser, { sport, size, fixture, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock });
          try {
            await waitHome(page);
            await closeDialogs(page);
            // Home: the chip sits inside the 16 px gutters on the stat strip's one row
            const chip = await boxOf(page, '.home .mins-chip');
            const strip = await boxOf(page, '.home .statstrip');
            r.home = {
              chip,
              chipText: await page.locator('.home .mins-chip b').textContent(),
              strip,
              inGutters: await page.evaluate(() => {
                const st = document.querySelector('.stage'),
                  k = st.getBoundingClientRect().width / st.offsetWidth || 1,
                  x0 = st.getBoundingClientRect().left;
                return [...document.querySelectorAll('.home .statstrip > *')].every((c) => {
                  const b = c.getBoundingClientRect();
                  return (b.left - x0) / k >= 15.5 && (b.right - x0) / k <= 374.5;
                });
              }),
              scroll: await page.evaluate(() => {
                const sc = document.querySelector('.home-scroll');
                return sc.scrollHeight - sc.clientHeight;
              }),
              playTop: (await boxOf(page, '.home .playbar button')).y,
              ringAnimation: await page.evaluate(() => getComputedStyle(document.querySelector('.home .mins-mini .fill')).animationName),
            };
            await page.screenshot({ path: path.join(a.out, tag + '-home.png') });
            // review fix: the widest strip the app can draw. A 4-digit online count reads "1.2k"
            // (compactCount, unit-tested: 1234 -> "1.2k", 12345 -> "12k"), with a 2-digit streak and
            // "58/60" in the Minutes chip; every chip must stay inside the gutters. The numbers are
            // set in place for the measurement and put back at once.
            r.home.worst = await page.evaluate(() => {
              const st = document.querySelector('.stage'),
                k = st.getBoundingClientRect().width / st.offsetWidth || 1,
                x0 = st.getBoundingClientRect().left,
                set = [
                  ['.home .statchip.streak b.num', '12'],
                  ['.home .statchip.online b.num', '1.2k'],
                  ['.home .mins-chip b.num', '58/60'],
                  ['.home .statchip.quests b.num', '3/3'],
                  ['.home .statchip.gauntlet-chip b.num', '8/8'],
                ].map(([sel, t]) => {
                  const e = document.querySelector(sel);
                  if (!e) return null;
                  const was = e.textContent;
                  e.textContent = t;
                  return [e, was];
                }),
                boxes = [...document.querySelectorAll('.home .statstrip > *')].map((c) => {
                  const b = c.getBoundingClientRect();
                  return [Math.round((b.left - x0) / k), Math.round((b.right - x0) / k)];
                }),
                strip = document.querySelector('.home .statstrip').getBoundingClientRect(),
                h = Math.round(strip.height / k),
                word = document.querySelector('.home .statchip.online .lc-word'),
                wordCut = !!word && word.scrollWidth > word.clientWidth,
                chip = document.querySelector('.home .statchip.online'),
                chipCut = !!chip && chip.scrollWidth > chip.clientWidth + 1;
              for (const x of set) if (x) x[0].textContent = x[1];
              return {
                chips: boxes.length,
                online: !!set[1],
                x: [Math.min(...boxes.map((b) => b[0])), Math.max(...boxes.map((b) => b[1]))],
                h,
                wordCut,
                chipCut,
                inGutters: boxes.every(([l, rr]) => l >= 15.5 && rr <= 374.5),
              };
            });
            // the Minutes screen
            const since = await page.evaluate(() => performance.now());
            await page.locator('.home .mins-chip').click();
            await page.locator('.mv-hero').waitFor({ timeout: 30000 });
            await settle(page, 700);
            const m = await captureScreen(page, { file: path.join(a.out, tag + '-minutes.png'), edge, since, errors, errorsBefore: 0, probe: false });
            // the top bar's 8 px "LV" over the level ring is shell's (pre-existing, listed in ut.md), not this screen's
            const own = (l) => l.filter((x) => !/^LV \d/.test(x));
            // text the tab bar covers at the scroll edge is sampled against the bar, not its panel: not on screen
            const covered = await page.evaluate(() => {
              const t = document.querySelector('nav.tabs')?.getBoundingClientRect();
              if (!t) return [];
              return [...document.querySelectorAll('.mv *')]
                .filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
                .filter((e) => e.getBoundingClientRect().bottom > t.top)
                .map((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40));
            });
            m.lowContrast = m.lowContrast.filter((x) => !covered.some((c) => c && x.startsWith(c)));
            r.minutes = { small: m.small, tiny: own(m.tiny), lowContrast: m.lowContrast, clipped: m.clipped, offscreen: m.offscreen, hOverflow: m.hOverflow, topClear: m.topClear, pageErrors: m.pageErrors };
            // the next rung (or the ready one) in view without scrolling, above the tab bar
            r.minutes.nextRung = await page.evaluate(() => {
              const v = document.querySelector('.shell-views').getBoundingClientRect();
              const tabs = document.querySelector('nav.tabs')?.getBoundingClientRect();
              const bottom = Math.min(v.bottom, tabs ? tabs.top : v.bottom);
              const n = document.querySelector('.mv-rail .mv-node[data-state="ready"], .mv-rail .mv-node[data-state="next"]') ?? document.querySelector('.mv-hero');
              const b = n.getBoundingClientRect();
              const sc = n.closest('.page');
              return { state: n.dataset.state ?? 'hero', visible: b.top >= v.top - 0.5 && b.bottom <= bottom + 0.5, scrolled: sc ? sc.scrollTop : 0 };
            });
            r.minutes.hero = (await page.locator('.mv-hero h2').textContent()).trim();
            // RANKS' three segments sit inside the gutters (a sport's longer title wraps them under it)
            r.minutes.segsInside = await page.evaluate(() => {
              const st = document.querySelector('.stage'),
                k = st.getBoundingClientRect().width / st.offsetWidth || 1,
                x0 = st.getBoundingClientRect().left;
              return [...document.querySelectorAll('.ranks-head .seg button')].every((b) => {
                const r = b.getBoundingClientRect();
                return (r.left - x0) / k >= 15.5 && (r.right - x0) / k <= 374.5;
              });
            });
            r.minutes.animations = await page.evaluate(() => ['.mv-ring .fill', '.mv-bar i', '.mv-node[data-state="ready"] .mv-chest-art'].map((s) => [s, document.querySelector(s) ? getComputedStyle(document.querySelector(s)).animationName : 'absent']));
            // CLAIM: feedback time, paid once, a second tap is a no-op
            const claim = page.locator('.mv-hero .ut-k-claim');
            if (await claim.count()) {
              const before = await stored(page, sport);
              const b = await claim.boundingBox();
              await page.evaluate(() => {
                const st = (window.__claimProbe = { t0: 0, t1: 0 });
                window.addEventListener('pointerdown', () => (st.t0 = performance.now()), { capture: true, once: true });
                const hero = document.querySelector('.mv-hero');
                const btn = hero.querySelector('.ut-k-claim');
                const mo = new MutationObserver(() => st.t0 && !st.t1 && (st.t1 = performance.now()));
                mo.observe(hero, { subtree: true, childList: true, attributes: true, characterData: true });
                // the burst attribute on the button counts as feedback too
                new MutationObserver(() => st.t0 && !st.t1 && (st.t1 = performance.now())).observe(btn, { attributes: true });
              });
              await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
              await page.waitForTimeout(700);
              const probe = await page.evaluate(() => window.__claimProbe);
              const after = await stored(page, sport);
              await page.screenshot({ path: path.join(a.out, tag + '-claimed.png') });
              // the same spot again: the button is gone, nothing more is paid
              await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
              await page.waitForTimeout(500);
              const again = await stored(page, sport);
              r.claim = {
                feedbackMs: probe.t1 && probe.t0 ? Math.round(probe.t1 - probe.t0) : null,
                coins: after.coins - before.coins,
                packs: after.packs - before.packs,
                secondTap: { coins: again.coins - after.coins, packs: again.packs - after.packs },
                buttonGone: !(await claim.count()),
                status: (await page.locator('.mv-claimed').textContent().catch(() => '')) || '',
              };
            }
            await closeDialogs(page);
            // Profile's playtime panel
            await mainTab(page, 'PROFILE');
            await page.locator('.pt-panel').scrollIntoViewIfNeeded();
            await settle(page, 300);
            const pm = await captureScreen(page, { file: path.join(a.out, tag + '-profile.png'), edge, since, errors, errorsBefore: 0, probe: false });
            r.profile = { small: pm.small, tiny: own(pm.tiny), lowContrast: pm.lowContrast.filter((x) => /Playtime|Today|week|Lifetime|open|NBA|NFL|Soccer|MINUTES|BADGE|ROOKIE|STARTER/i.test(x)) };
            // UT Home's ring (first fixture only: UT is the slow part)
            if (fixture === fixtures[0]) {
              await enterUt(page);
              await page.locator('.uh-mins').waitFor({ timeout: 30000 });
              await settle(page, 400);
              r.utHome = { box: await boxOf(page, '.uh-mins .ut-k-mins'), text: (await page.locator('.uh-mins .ut-k-mins-text').innerText()).replace(/\s+/g, ' ') };
              await page.screenshot({ path: path.join(a.out, tag + '-ut-home.png') });
            }
          } catch (e) {
            r.fail = e.message.split('\n')[0];
          } finally {
            r.pageErrors = errors.slice();
            await context.close();
          }
          r.ok =
            !r.fail &&
            !r.pageErrors.length &&
            r.home?.inGutters &&
            r.home?.worst?.inGutters &&
            r.home?.worst?.h <= 30 &&
            !r.home?.worst?.chipCut &&
            r.minutes?.nextRung?.visible &&
            r.minutes.segsInside &&
            !r.minutes.small.length &&
            !r.minutes.tiny.length &&
            !r.minutes.lowContrast.length &&
            (!a.rm || (r.home.ringAnimation === 'none' && r.minutes.animations.every(([, n]) => n === 'none' || n === 'absent'))) &&
            (!r.claim || (r.claim.feedbackMs !== null && r.claim.feedbackMs <= 100 && r.claim.packs > 0 && r.claim.secondTap.coins === 0 && r.claim.secondTap.packs === 0 && r.claim.buttonGone)) &&
            !r.profile?.small.length &&
            !r.profile?.tiny.length;
          report.runs.push(r);
          console.log(tag, r.ok ? 'ok' : 'FAILED', JSON.stringify({ home: r.home && { chip: r.home.chipText, scroll: r.home.scroll, playTop: r.home.playTop, inGutters: r.home.inGutters, worst: r.home.worst }, minutes: r.minutes && { hero: r.minutes.hero, next: r.minutes.nextRung, small: r.minutes.small.length, tiny: r.minutes.tiny.length, lowc: r.minutes.lowContrast }, claim: r.claim, ut: r.utHome?.text, fail: r.fail }));
        }
  } finally {
    await browser.close();
  }
  report.sockets = socketReport();
  report.blocked = [...blocked];
  report.ok = report.sockets.ok && report.runs.every((r) => r.ok);
  fs.writeFileSync(path.join(a.out, 'minutes-report' + (a.rm ? '-rm' : '') + '.json'), JSON.stringify(report, null, 1));
  console.log('minutes:', report.runs.filter((r) => r.ok).length + '/' + report.runs.length, 'ok; sockets', JSON.stringify(report.sockets), 'blocked', report.blocked.join(', ') || 'none', report.ok ? 'ok' : 'FAILED');
  return report;
}


// ---------------------------------------------------------------- recap (ut-5)

/** UT → PLAY → Squad Battles → the next rung; the vote's SIM (or PLAY with --played) to the result. */
async function toResult(page) {
  await enterUt(page);
  await utTab(page, 'PLAY');
  await closeDialogs(page);
  await page.locator('button').filter({ hasText: /^PLAY SQUAD BATTLES$/ }).click();
  await settle(page, 500);
  await page.locator('.utb-rung').first().click();
  await page.locator('.vote-opt.sim').waitFor({ timeout: 60000 });
  await page.locator('.vote-opt.sim').click();
}

/** In-page probes, before the result mounts: when it mounts, when the bar shows, frame times, vibrations. */
const recapProbes = () => {
  const w = window;
  w.__rc = { mount: null, bar: null, done: null, frames: [], vib: [] };
  const v = navigator.vibrate?.bind(navigator);
  navigator.vibrate = (p) => {
    w.__rc.vib.push({ t: performance.now(), ev: window.event?.type ?? null, trusted: window.event?.isTrusted ?? null });
    return v ? v(p) : true;
  };
  new MutationObserver(() => {
    const r = w.__rc;
    if (!r.mount && document.querySelector('.mr')) {
      r.mount = performance.now();
      let last = r.mount;
      const loop = (t) => {
        r.frames.push([t - r.mount, t - last]);
        last = t;
        if (t - r.mount < 6000) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    if (r.mount && !r.bar && document.querySelector('.mr-onemore [data-primary]')) r.bar = performance.now();
    if (r.mount && !r.done && document.querySelector('.mr[data-phase=done]')) r.done = performance.now();
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
};

/** The bar's tap area in screen px, and whether it covers V2 A.5's A-button centre. */
const A_CENTRE = { 393: [323, 738], 375: [305, 587], 320: [266, 510] };
const barGeometry = (page, size) =>
  page.evaluate((a) => {
    const stage = document.querySelector('.stage');
    const k = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
    const b = document.querySelector('.mr-onemore [data-primary]')?.getBoundingClientRect();
    if (!b) return null;
    return {
      rect: [b.left, b.top, b.width, b.height].map(Math.round),
      heightDesign: Math.round(b.height / k),
      coversA: a[0] >= b.left && a[0] <= b.right && a[1] >= b.top && a[1] <= b.bottom,
      primaries: document.querySelectorAll('[data-primary]').length,
      verdict: document.querySelector('.mr-word')?.textContent,
      score: document.querySelector('.mr-score')?.textContent,
      title: document.querySelector('.mr-onemore .ut-k-gold-text b')?.textContent,
      stake: document.querySelector('.mr-onemore .ut-k-gold-text em')?.textContent ?? null,
    };
  }, A_CENTRE[size]);

async function recapCase(a) {
  const browser = await launch();
  const report = { case: 'recap', at: new Date().toISOString(), flags: flagsOf(a), runs: [] };
  try {
    for (const sport of a.sport)
      for (const size of a.size) {
        const tag = sport + '-' + size + (a.rm ? '-rm' : '') + (a.cpu > 1 ? '-cpu' + a.cpu : '');
        const r = { sport, size, rm: a.rm, cpu: a.cpu, fail: [] };
        const { context, page, errors, edge } = await openPhone(browser, { sport, size, fixture: a.fixture, rm: a.rm, cpu: a.cpu, edge: a.edge, clock: a.clock });
        try {
          await context.addInitScript(recapProbes);
          await page.evaluate(recapProbes);
          await waitHome(page);
          await toResult(page);
          await page.locator('.mr').waitFor({ timeout: 60000 });
          if (a.skip) {
            await page.waitForTimeout(700);
            const t = await page.evaluate(() => performance.now());
            await page.touchscreen.tap(195 * (size / 390), 300 * (size / 390));
            await page.waitForFunction(() => window.__rc.done, null, { timeout: 5000 });
            r.skipMs = Math.round((await page.evaluate(() => window.__rc.done)) - t);
            await page.waitForTimeout(400);
            r.stillOnResult = (await page.locator('.mr').count()) > 0;
            if (!(r.skipMs <= 100)) r.fail.push('skip ' + r.skipMs + ' ms');
            if (!r.stillOnResult) r.fail.push('the skip tap pressed something');
          }
          await page.locator('.mr-onemore [data-primary]').waitFor({ timeout: 15000 });
          const rc = await page.evaluate(() => window.__rc);
          r.barMs = Math.round(rc.bar - rc.mount);
          const tally = rc.frames.filter(([t]) => t >= 2400 && t <= 5000);
          if (tally.length > 1) {
            const span = tally[tally.length - 1][0] - tally[0][0];
            r.tallyFps = Math.round(((tally.length - 1) / span) * 1000 * 10) / 10;
            r.worstFrameMs = Math.round(Math.max(...tally.map(([, d]) => d)));
          }
          const lt = await page.evaluate((m) => (window.__lt ?? []).filter(([t]) => t >= m && t <= m + 5200).map(([, d]) => Math.round(d)), rc.mount);
          r.longTasks = lt;
          r.vibrations = rc.vib;
          r.timerVibrations = rc.vib.filter((x) => !/pointer|click|touch|key/.test(x.ev ?? '')).length;
          await settle(page, 300);
          r.geometry = await barGeometry(page, size);
          const m = await captureScreen(page, { file: path.join(a.out, 'recap-' + tag + '.png'), edge, since: 0, errors, errorsBefore: 0, probe: false });
          r.metrics = { hOverflow: m.hOverflow, offscreen: m.offscreen, clipped: m.clipped, truncated: m.truncated, small: m.small, tiny: m.tiny, lowContrast: m.lowContrast, primaries: m.primaries };
          const limit = a.rm ? 100 : 5000;
          if (!(r.barMs <= limit)) r.fail.push('bar at ' + r.barMs + ' ms');
          if (!r.geometry?.coversA) r.fail.push('bar misses the A centre');
          if (!(r.geometry?.heightDesign >= 64)) r.fail.push('bar ' + r.geometry?.heightDesign + ' px tall');
          if (r.geometry?.primaries !== 1) r.fail.push(r.geometry?.primaries + ' primaries');
          if (r.timerVibrations) r.fail.push(r.timerVibrations + ' vibrations outside input');
          if (m.hOverflow > 0 || m.offscreen.length || m.clipped.length || m.small.length || m.tiny.length) r.fail.push('layout');
          if (!a.rm && a.cpu >= 4 && !(r.tallyFps >= 55)) r.fail.push('tally ' + r.tallyFps + ' fps');
          // the box score sheet, then the bar: tap → the next match's first game frame
          await page.locator('.mr-sec button').filter({ hasText: 'BOX SCORE' }).click();
          await page.locator('.mr-box').waitFor({ timeout: 5000 });
          await settle(page, 400);
          await page.screenshot({ path: path.join(a.out, 'recap-' + tag + '-box.png') });
          await page.keyboard.press('Escape');
          await page.locator('.mr-box').waitFor({ state: 'detached', timeout: 5000 });
          if (a.onemore) {
            const t0 = await page.evaluate(() => performance.now());
            const b = r.geometry.rect;
            await page.touchscreen.tap(b[0] + b[2] / 2, b[1] + b[3] / 2);
            // the first game frame: the game's canvas up and its loading line gone (the attributes are
            // in, so the engine has drawn the court, field or pitch; the recap has no canvas)
            // and the picture really drawn: at least 6 colours across a 5 x 5 grid of samples
            await page.waitForFunction(
              () =>
                !document.querySelector('.fg-loading') &&
                [...document.querySelectorAll('canvas')].some((c) => {
                  if (!(c.width > 0 && c.getBoundingClientRect().height > 100)) return false;
                  const g = c.getContext('2d');
                  if (!g) return false;
                  const seen = new Set();
                  for (let i = 1; i <= 5; i++)
                    for (let j = 1; j <= 5; j++) seen.add(g.getImageData(Math.floor((c.width * i) / 6), Math.floor((c.height * j) / 6), 1, 1).data.join(','));
                  return seen.size >= 6;
                }),
              null,
              { timeout: 15000, polling: 'raf' },
            );
            const t1 = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame((t) => res(t)))));
            r.oneMoreToFrameMs = Math.round(t1 - t0);
            if (!(r.oneMoreToFrameMs <= 3000)) r.fail.push('One-More to first frame ' + r.oneMoreToFrameMs + ' ms');
            await page.screenshot({ path: path.join(a.out, 'recap-' + tag + '-next.png') });
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(a.out, 'recap-' + tag + '-next-1500.png') });
          }
          r.pageErrors = errors;
          if (errors.length) r.fail.push('page errors');
        } catch (e) {
          r.fail.push('error: ' + e.message.split('\n')[0]);
          await page.screenshot({ path: path.join(a.out, 'recap-' + tag + '-error.png') }).catch(() => {});
        }
        r.ok = !r.fail.length;
        report.runs.push(r);
        console.log(tag, r.ok ? 'ok' : 'FAILED', JSON.stringify({ barMs: r.barMs, skipMs: r.skipMs, fps: r.tallyFps, worst: r.worstFrameMs, lt: r.longTasks, vib: r.vibrations?.length, timerVib: r.timerVibrations, geo: r.geometry, next: r.oneMoreToFrameMs, layout: r.metrics && { small: r.metrics.small, tiny: r.metrics.tiny, clipped: r.metrics.clipped, off: r.metrics.offscreen, trunc: r.metrics.truncated, lowc: r.metrics.lowContrast }, fail: r.fail }));
        await context.close();
      }
  } finally {
    await browser.close();
  }
  report.sockets = socketReport();
  report.blocked = [...blocked];
  report.ok = report.sockets.ok && report.runs.every((r) => r.ok);
  fs.writeFileSync(path.join(a.out, 'recap-report' + (a.rm ? '-rm' : '') + (a.cpu > 1 ? '-cpu' + a.cpu : '') + '.json'), JSON.stringify(report, null, 1));
  console.log('recap:', report.runs.filter((r) => r.ok).length + '/' + report.runs.length, 'ok; sockets', JSON.stringify(report.sockets), report.ok ? 'ok' : 'FAILED');
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  const run = { selfcheck, fixtures: fixturesCase, deadtaps: deadtapsCase, kit: kitCase, minutes: minutesCase, recap: recapCase }[a._[0]];
  if (!run) {
    console.log('usage: node scripts/qa/ut-studio.mjs selfcheck|fixtures|deadtaps|kit|minutes|recap [--skip] [--onemore] [--sport s] [--size 393|375|320] [--fixture name] [--no-edge] [--cpu n] [--rm] [--clock t] [--out dir] [--dead 393|all|none]');
    process.exit(1);
  }
  const r = await run(a);
  if (r.ok === false || r.summary?.failed) process.exitCode = 1;
}
