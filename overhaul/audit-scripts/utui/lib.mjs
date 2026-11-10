// UT/UI audit helpers (audit only; localhost + font CDN only, every other host aborted)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/home/user/ps-studio/package.json');
export const BASE = 'http://localhost:5205/';
export const SHOTS = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/ut-ui';
fs.mkdirSync(SHOTS, { recursive: true });
export const DEVICES = {
  '390': { w: 390, h: 844, insets: [47, 0, 34, 0] },      // iPhone 12/13/14 notch: 47pt top
  '393': { w: 393, h: 852, insets: [59, 0, 34, 0] },      // iPhone 15/16 Pro Dynamic Island
  '430': { w: 430, h: 932, insets: [59, 0, 34, 0] },      // Pro Max Dynamic Island
  '320': { w: 320, h: 568, insets: [20, 0, 0, 0] },       // SE 1st gen status bar
};
export async function launch() {
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
  const { chromium } = require('playwright');
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}
export const blocked = [];
export async function fixture(browser, sport, dev, { insets, motion = 'reduce', fresh = false, coins = 10000, extra = null, standalone = true } = {}) {
  const d = DEVICES[dev];
  const ins = insets ?? d.insets;
  const context = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: motion });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    blocked.push(u.hostname);
    return route.abort();
  });
  await context.addInitScript(({ ins, standalone }) => {
    window.__psInsets = ins;
    if (standalone) Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
  }, { ins, standalone });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (standalone) {
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
    } catch (e) { errors.push('cdp display-mode: ' + e.message); }
  }
  const url = new URL(BASE);
  url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  if (!fresh) {
    await page.evaluate(async ({ sport, coins, extra }) => {
      const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { getPool, byValue } = await import('/src/ut/pool.ts');
      const { openPack } = await import('/src/ut/packs.ts');
      const { autoBuild } = await import('/src/ut/squad.ts');
      const { freshUt } = await import('/src/ut/state.ts');
      const pool = await getPool(), p = freshProfile();
      p.name = 'Audit QA'; p.coins = coins; p.firstRun = false; p.gifts = ['testers-2026-10'];
      p.settings.sound = false; p.settings.haptics = false; p.xp = 5200;
      p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      const cards = [
        ...openPack(pool, 'starter', 'qa'),
        ...[...pool.base.values()].filter((c) => c.tier === 'goat').slice(0, 3),
        ...[...pool.base.values()].filter((c) => c.line.kind === 'season' && c.line.fr === ({ nba: 'CHI', nfl: 'NE', soccer: 'BAR' })[sport]).sort(byValue).slice(0, 25),
      ].filter((c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i);
      const owned = cards.map((rc, i) => ({ uid: 'audit-qa-' + i, cardId: rc.line.id, level: i === 0 ? 3 : 1, xp: i === 0 ? 42 : 0, at: i + 1 }));
      p.ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1,
        packs: [{ id: 'qa-gold', kind: 'gold', at: 2 }, { id: 'qa-gold2', kind: 'gold', at: 3 }] };
      localStorage.setItem('perfect-season:fav:asked', '1');
      saveProfile(p);
    }, { sport, coins, extra });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  return { page, context, errors };
}
export const settle = async (page, ms = 450) => {
  await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
export async function shot(page, name) {
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, timeout: 15000 });
  return file;
}
// geometry/overflow/target/contrast audit of the visible top layer
export const audit = (page) => page.evaluate(() => {
  const stage = document.querySelector('.stage');
  if (!stage) return { error: 'no stage' };
  const sr = stage.getBoundingClientRect();
  const k = sr.width / stage.offsetWidth || 1;
  const sat = parseFloat(getComputedStyle(stage).getPropertyValue('--sat')) || 0;
  const sab = parseFloat(getComputedStyle(stage).getPropertyValue('--sab')) || 0;
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
  const scroller = (e) => { for (let n = e.parentElement; n && n !== stage; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return n; } return null; };
  const vscroller = (e) => { for (let n = e.parentElement; n && n !== stage; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY)) return n; } return null; };
  const dialog = [...document.querySelectorAll('[role=dialog]')].filter(visible).pop();
  const root = dialog || stage;
  const offscreen = [], truncated = [], clipped = [], tiny = [], lowc = [], underInset = [], underHome = [];
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const s = getComputedStyle(n); const c = parse(s.backgroundColor); if (c && c.a > 0.85) return c; if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.includes('url')) return null; } return { r: 4, g: 18, b: 26, a: 1 }; };
  let topMost = 1e9, topMostLabel = '';
  for (const e of root.querySelectorAll('*')) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    const hasText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    const interactive = e.matches('button, a[href], input, [role=tab], [role=switch]');
    if ((r.right > sr.right + 1 || r.left < sr.left - 1) && !scroller(e)) offscreen.push(label(e) + ' @' + Math.round((r.right - sr.left) / k));
    const yTop = (r.top - sr.top) / k, yBot = (r.bottom - sr.top) / k;
    if ((hasText || interactive) && !vscroller(e)) {
      if (yTop < topMost) { topMost = yTop; topMostLabel = label(e); }
      if (yTop < sat - 0.5 && yBot > 0) underInset.push(label(e) + ' y' + Math.round(yTop));
      if (yBot > H - sab + 0.5 && yTop < H) underHome.push(label(e) + ' y' + Math.round(yBot));
    }
    if (!hasText) continue;
    const s = getComputedStyle(e);
    const fs = parseFloat(s.fontSize);
    if (fs < 10) tiny.push(label(e) + ' ' + fs + 'px');
    if (e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(s.overflowX)) (s.textOverflow === 'ellipsis' ? truncated : clipped).push(label(e));
    else if (e.scrollHeight > e.clientHeight + 2 && /(hidden|clip)/.test(s.overflowY) && !s.webkitLineClamp?.match(/\d/)) clipped.push('V:' + label(e));
    const fg = parse(s.color), bg = bgOf(e);
    if (fg && bg) { const op = +s.opacity; const a = fg.a * (isNaN(op) ? 1 : op); const mix = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }; const L1 = lum(mix), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); const big = fs >= 18 || (fs >= 14 && +s.fontWeight >= 700); if (cr < (big ? 3 : 4.5)) lowc.push(label(e) + ' ' + cr.toFixed(2)); }
  }
  const small = [];
  for (const e of root.querySelectorAll('button, a[href], input, select, [role=switch], [role=tab], [role=radio], summary')) {
    if (!visible(e) || e.disabled || e.closest('[aria-hidden=true],[inert]')) continue;
    const box = e.getBoundingClientRect();
    const pb = getComputedStyle(e, '::before');
    const px = (v) => (v.endsWith('px') ? parseFloat(v) : 0);
    const r = pb.content !== 'none' && pb.position === 'absolute' && pb.visibility !== 'hidden'
      ? { left: box.left + Math.min(0, px(pb.left)) * k, right: box.right - Math.min(0, px(pb.right)) * k, top: box.top + Math.min(0, px(pb.top)) * k, bottom: box.bottom - Math.min(0, px(pb.bottom)) * k } : box;
    const w = (r.right - r.left) / k, h = (r.bottom - r.top) / k;
    const sc = scroller(e); if (sc) { const q = sc.getBoundingClientRect(); if (r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom) continue; }
    if (w < 43.5 || h < 43.5) small.push(label(e) + ' ' + Math.round(w) + 'x' + Math.round(h));
  }
  return {
    k: +k.toFixed(3), sat, sab, H,
    title: document.querySelector('.ut-title')?.textContent ?? '',
    tab: document.querySelector('.ut-tabs [aria-current=page] span, nav.tabs [aria-current=page] span')?.textContent ?? '',
    hOverflow: document.documentElement.scrollWidth - innerWidth,
    docScroll: document.scrollingElement.scrollHeight - innerHeight,
    topMost: Math.round(topMost), topMostLabel,
    offscreen: [...new Set(offscreen)].slice(0, 10), clipped: [...new Set(clipped)].slice(0, 10), truncated: [...new Set(truncated)].slice(0, 10),
    small: [...new Set(small)].slice(0, 14), tiny: [...new Set(tiny)].slice(0, 12), lowContrast: [...new Set(lowc)].slice(0, 14),
    underInset: [...new Set(underInset)].slice(0, 8), underHome: [...new Set(underHome)].slice(0, 8),
  };
});
