// AUDIT ONLY: which bodies get stale (budget-starved) drawings, by on-screen size, during NFL/NBA/soccer autoplay.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const URLS = {
  nba: 'http://localhost:5206/?arcade&auto&sport=nba&seed=spr&ns=inspect&relay=ws://localhost:7777',
  nfl: 'http://localhost:5206/?arcade&auto&sport=nfl&seed=spr&ns=inspect&relay=ws://localhost:7777',
  soccer: 'http://localhost:5206/?soccer-lab&auto&sport=soccer&seed=spr&ns=inspect&relay=ws://localhost:7777',
};
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const sport of ['nfl', 'nba', 'soccer']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    await ctx.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__flush = () => {};
      window.requestAnimationFrame = (f) => raf((t) => { window.__flush(); f(t); });
    });
    const page = await ctx.newPage();
    await page.goto(URLS[sport], { waitUntil: 'load' });
    await page.evaluate(async () => {
      const m = await import('/src/game/pixel/body.ts');
      const P = m.SpriteCache.prototype;
      const st = (window.__st = { byPx: {}, pend: new Set() });
      const pxOf = (k) => { const p = k.split('|'); const v = Number(p[p.length - 2]); return v < 24 ? '<24' : v < 32 ? '24-31' : v < 48 ? '32-47' : v < 72 ? '48-71' : '72+'; };
      const bump = (k, f) => { const b = (st.byPx[pxOf(k)] ??= { lookups: 0, miss: 0, stale: 0 }); b[f]++; };
      const g0 = P.get, s0 = P.set;
      P.get = function (k) { const r = g0.call(this, k); bump(k, 'lookups'); if (!r) { bump(k, 'miss'); st.pend.add(k); } return r; };
      P.set = function (k, spr, inUse) { st.pend.delete(k); return s0.call(this, k, spr, inUse); };
      window.__flush = () => { for (const k of st.pend) bump(k, 'stale'); st.pend.clear(); };
    });
    await wait(5000);
    await page.evaluate(() => { window.__st.byPx = {}; });
    await wait(15000);
    const r = await page.evaluate(() => window.__st.byPx);
    const rows = Object.entries(r).map(([k, v]) => `${k}px lookups ${v.lookups} stale ${v.stale} (${((100 * v.stale) / v.lookups).toFixed(1)}%)`);
    console.log(sport, rows.join(' | '));
    await ctx.close();
  }
  await browser.close();
})();
