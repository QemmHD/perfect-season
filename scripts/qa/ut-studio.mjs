// Claude, 2026-11-10 (studio overhaul, team ut): the Ultimate Team QA harness. Copied from the UI
// audit's harness (insets, standalone, isolation) and extended with every measure the overhaul's
// acceptance numbers need. Localhost only: every request to another host is aborted except Google
// Fonts (so Archivo renders as on the phone), and the app runs on the inspect namespace with a local
// relay, so nothing reaches the live registry, saves, relays or boards.
//
//   node scripts/qa/ut-studio.mjs <case> [flags]          (dev server: npx vite --port 5212 --strictPort)
// Cases
//   selfcheck   Home, UT Home and every UT tab and segment plus the Rewards inbox, 3 sports x 3 sizes,
//               every metric, a screenshot each, tap feedback; dead taps at 393x852 (--dead all|none)
//   fixtures    every fixture in scripts/qa/fixtures/ut loads in its sport: Home, then UT Home,
//               with 0 page errors and the Rewards inbox it was built with
//   deadtaps    the dead-tap walk alone (fresh context per screen), at --size (default 393)
//   kit         the visual kit (src/ut/kit.tsx) rendered inside UT: sizes, data-primary, press and
//               claim burst, its CSS gzip size; with --rm, burst and sheen must compute animation none
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
/** Never tapped by the dead-tap walk: they spend, sell, submit, go online, reset or leave the app. */
const DENY = /\b(QUICK SELL|SELL|SUBMIT|BUY|FIND MATCH|PLAY ONLINE|RESET|ERASE|ADMIN|SEND|DELETE|SIGN OUT)\b/i;
/** OPEN on a registered pack (Spotlight, GOAT, Icon, numbered) talks to the card registry. */
const REGISTERED = /SPOTLIGHT|GOAT|ICON|NUMBERED|REGISTERED|SERIAL/i;

export const blocked = new Set();

export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  return chromium.launch({ headless: true, ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
}

/** Abort every request that isn't localhost or Google Fonts (BUILD-RULES: never touch live services). */
export async function isolate(context) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (ALLOWED_HOSTS.includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    blocked.add(u.hostname);
    return route.abort();
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

/** Home, UT Home, every UT tab and segment, and the Rewards inbox: how to get to each from anywhere. */
export const SCREENS = [
  { id: 'home', go: async () => {} },
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
  { id: 'inbox', go: async (p) => (await utTab(p, 'HOME'), p.locator('.ut-home-inbox').click(), settle(p, 300)) },
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
        fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify({ ...report, blocked: [...blocked] }, null, 1));
      }
  } finally {
    await browser.close();
  }
  report.blocked = [...blocked];
  report.summary = Object.fromEntries(report.runs.map((r) => [r.sport + ' ' + r.size, r.summary]));
  fs.writeFileSync(path.join(a.out, 'report.json'), JSON.stringify(report, null, 1));
  console.table(report.summary);
  console.log('blocked hosts (aborted):', report.blocked.join(', ') || 'none');
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
            r.inbox = await page.evaluate(() => document.querySelector('.ut-home-inbox')?.innerText.replace(/\s+/g, ' ').trim() ?? '');
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
  report.summary = { fixtures: report.results.length, failed: report.results.filter((r) => !r.ok).length, pageErrors: report.results.reduce((n, r) => n + r.pageErrors.length, 0) };
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
      for (const s of SCREENS) {
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
          const { createRoot } = await import(reactUrl.replace('react.js', 'react-dom_client.js'));
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
              h(kit.PrimaryButton, { onClick: () => {}, sub: 'About 5 min' }, 'Play match'),
            ),
          );
          await new Promise((res) => setTimeout(res, 300));
          const q = (s) => host.querySelector(s);
          const claim = q('.ut-k-claim');
          const sheen = getComputedStyle(claim, '::before').animationName;
          const primarySheen = getComputedStyle(q('.ut-k-primary'), '::before').animationName;
          claim.click();
          const burst = getComputedStyle(claim, '::after').animationName;
          const box = (e) => {
            const b = e.getBoundingClientRect();
            return [Math.round(b.width), Math.round(b.height)];
          };
          const go = q('.ut-k-go');
          const before = getComputedStyle(go, '::before');
          return {
            claimed,
            burstAttr: claim.hasAttribute('data-burst'),
            animation: { sheen, primarySheen, burst },
            primary: box(q('.ut-k-primary')),
            primaries: document.querySelectorAll('[data-primary]').length,
            claim: box(claim),
            goHit: [Math.round(go.getBoundingClientRect().width - 2 * parseFloat(before.left)), Math.round(go.getBoundingClientRect().height - 2 * parseFloat(before.top))],
            titlePx: getComputedStyle(q('.ut-k-title')).fontSize,
            titleFont: getComputedStyle(q('.ut-k-title')).fontStyle + ' ' + getComputedStyle(q('.ut-k-title')).fontStretch,
            countTone: [...host.querySelectorAll('.ut-k-count')].map((e) => e.dataset.tone + ' ' + e.textContent),
          };
        });
        await settle(page, 400);
        await page.screenshot({ path: path.join(a.out, 'kit-' + sport + '-' + SIZES[size].w + (a.rm ? '-rm' : '') + '.png') });
        // press feedback on a real UT control with no :active rule of its own (a tab bar button):
        // its computed style a frame after mouse down (the press is swallowed, nothing navigates)
        const tab = page.locator('.ut-tabs button').nth(1);
        const tb = await tab.boundingBox();
        await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
        const look = () => tab.evaluate((e) => getComputedStyle(e).transform + ' ' + getComputedStyle(e).filter);
        const rest = await look();
        await page.evaluate(() => window.addEventListener('click', (e) => (e.stopImmediatePropagation(), e.preventDefault()), { capture: true, once: true }));
        await page.mouse.down();
        await page.evaluate(() => new Promise((res) => requestAnimationFrame(res)));
        const pressed = await look();
        await page.mouse.up();
        r.press = { rest, pressed };
        r.pageErrors = errors.slice();
        report.runs.push({ sport, size, ...r });
        console.log(sport, size, JSON.stringify(r));
        await context.close();
      }
  } finally {
    await browser.close();
  }
  report.ok = report.cssGzip <= 4096 && report.runs.every((r) => r.primary[1] >= 56 && r.goHit[1] >= 44 && r.claim[1] >= 44 && r.claimed === 1 && !r.pageErrors.length && (a.rm ? Object.values(r.animation).every((n) => n === 'none') : r.animation.burst === 'ut-k-burst'));
  fs.writeFileSync(path.join(a.out, 'kit-report' + (a.rm ? '-rm' : '') + '.json'), JSON.stringify(report, null, 1));
  console.log('kit CSS', report.cssBytes, 'bytes,', report.cssGzip, 'gzip;', report.ok ? 'ok' : 'FAILED');
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  const run = { selfcheck, fixtures: fixturesCase, deadtaps: deadtapsCase, kit: kitCase }[a._[0]];
  if (!run) {
    console.log('usage: node scripts/qa/ut-studio.mjs selfcheck|fixtures|deadtaps|kit [--sport s] [--size 393|375|320] [--fixture name] [--no-edge] [--cpu n] [--rm] [--clock t] [--out dir] [--dead 393|all|none]');
    process.exit(1);
  }
  const r = await run(a);
  if (r.ok === false || r.summary?.failed) process.exitCode = 1;
}
