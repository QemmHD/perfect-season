// AUDIT ONLY (dev server 5206, localhost only): patch the shared SpriteCache to count, during an
// autoplay match, how many sprite lookups hit, how many new drawings were made, and how many bodies
// were shown a STALE drawing because the per-frame drawing budget was spent (lookups that missed but
// produced no new drawing). Also records the on-screen sprite heights (px) and takes screenshots.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const fs = require('fs');
const SHOTS = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const URLS = {
  nba: 'http://localhost:5206/?arcade&auto&sport=nba&seed=spr&ns=inspect&relay=ws://localhost:7777',
  nfl: 'http://localhost:5206/?arcade&auto&sport=nfl&seed=spr&ns=inspect&relay=ws://localhost:7777',
  soccer: 'http://localhost:5206/?soccer-lab&auto&sport=soccer&seed=spr&ns=inspect&relay=ws://localhost:7777',
};
(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const sport of Object.keys(URLS)) {
    if (only && only !== sport) continue;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    await ctx.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__frames = 0;
      window.requestAnimationFrame = (f) => raf((t) => { window.__frames++; f(t); });
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(sport, 'pageerror', e.message));
    await page.goto(URLS[sport], { waitUntil: 'load' });
    await page.evaluate(async () => {
      const m = await import('/src/game/pixel/body.ts');
      const P = m.SpriteCache.prototype;
      const st = (window.__spr = { get: 0, hit: 0, set: 0, px: {}, perFrameNew: [] });
      const g0 = P.get, s0 = P.set;
      P.get = function (k) { st.get++; const r = g0.call(this, k); if (r) st.hit++; return r; };
      P.set = function (k, spr, inUse) { st.set++; const parts = k.split('|'); const px = parts[parts.length - 2]; st.px[px] = (st.px[px] || 0) + 1; return s0.call(this, k, spr, inUse); };
    });
    // let the match start
    await wait(6000);
    await page.evaluate(() => { const s = window.__spr; s.get = s.hit = s.set = 0; s.px = {}; window.__frames = 0; });
    const t0 = Date.now();
    for (let i = 0; i < 6; i++) {
      await wait(3000);
      await page.screenshot({ path: SHOTS + `ingame-${sport}-390-${i}.png` });
    }
    const secs = (Date.now() - t0) / 1000;
    const r = await page.evaluate(() => ({ ...window.__spr, frames: window.__frames }));
    const miss = r.get - r.hit;
    const stale = miss - r.set;
    const pxs = Object.entries(r.px).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
    const tot = pxs.reduce((s, x) => s + x[1], 0);
    let acc = 0, p10 = 0, p50 = 0, p90 = 0;
    for (const [k, v] of pxs) { acc += v; if (!p10 && acc >= tot * 0.1) p10 = k; if (!p50 && acc >= tot * 0.5) p50 = k; if (!p90 && acc >= tot * 0.9) p90 = k; }
    console.log(JSON.stringify({ sport, secs, frames: r.frames, lookups: r.get, perFrameLookups: +(r.get / r.frames).toFixed(1), hitRate: +(r.hit / r.get).toFixed(3), newDrawings: r.set, newPerSec: +(r.set / secs).toFixed(1), staleShown: stale, staleRate: +(stale / r.get).toFixed(3), spritePx: { min: pxs[0]?.[0], p10, p50, p90, max: pxs[pxs.length - 1]?.[0] } }));
    await ctx.close();
  }
  await browser.close();
})();
