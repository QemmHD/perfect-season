// AUDIT ONLY: production build, ?arcade&auto (the shipped test bench), NBA and NFL autopilot matches.
// Per viewport and CPU rate: frame interval distribution, main-thread time inside rAF callbacks
// (sim + draw), long tasks, heap; plus load-to-first-frame and when the mocap clip chunks arrive
// relative to the first drawn frame (before then, hand-keyed stand-in poses are drawn).
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const SH = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (d, k) => +d[Math.min(d.length - 1, Math.floor(k * (d.length - 1)))].toFixed(1);
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const sports = (process.argv[2] || 'nba,nfl').split(',');
  for (const sport of sports) {
    for (const [w, h] of [[390, 844], [430, 932], [320, 568]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
      await ctx.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__cb = []; window.__iv = []; window.__lt = []; window.__first = null; let last = 0;
        window.requestAnimationFrame = (f) => raf((t) => { const a = performance.now(); f(t); const b = performance.now(); window.__cb.push(b - a); if (last) window.__iv.push(t - last); last = t; if (window.__first === null && document.querySelector('canvas')) window.__first = b; });
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } catch {}
      });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      const cdp = await ctx.newCDPSession(page);
      await page.goto(`http://localhost:5206/?arcade&auto&sport=${sport}&seed=perf&ns=inspect&relay=ws://localhost:7777`, { waitUntil: 'commit' });
      await page.waitForFunction(() => window.__first !== null, null, { timeout: 60000 });
      await wait(2500);
      const load = await page.evaluate(() => {
        const clips = performance.getEntriesByType('resource').filter((r) => /\/(ready|jog|run|sprint|jumpshot|layup|throw|catch|dive|block|kick|backpedal|shuffle|celebrate|fall_back|fall_forward|stumble|slip|getup|catch_run)-[\w-]+\.js$/.test(r.name));
        return { firstFrameMs: Math.round(window.__first), clipChunks: clips.length, clipsDoneMs: Math.round(Math.max(0, ...clips.map((r) => r.responseEnd))), gameChunks: performance.getEntriesByType('resource').filter((r) => /(Football2|Hoops2|arcade|mocap|poses|persp|court)/.test(r.name)).map((r) => r.name.split('/').pop() + '@' + Math.round(r.responseEnd)) };
      });
      const stats = async () => page.evaluate((qs) => {
        const q = new Function('d', 'k', qs);
        const cb = window.__cb.slice().sort((a, b) => a - b);
        const iv = window.__iv.slice().sort((a, b) => a - b);
        const lt = window.__lt.slice();
        const r = { frames: iv.length, fps: +(1000 / (iv.reduce((s, x) => s + x, 0) / iv.length)).toFixed(1), ivP50: q(iv, 0.5), ivP99: q(iv, 0.99), ivMax: +iv[iv.length - 1].toFixed(1), over20: iv.filter((x) => x > 20).length, over34: iv.filter((x) => x > 34).length, cbP50: q(cb, 0.5), cbP95: q(cb, 0.95), cbP99: q(cb, 0.99), cbMax: +cb[cb.length - 1].toFixed(1), longTasks: lt.length, longTaskMs: Math.round(lt.reduce((s, x) => s + x, 0)), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
        window.__cb = []; window.__iv = []; window.__lt = [];
        return r;
      }, 'return +d[Math.min(d.length-1, Math.floor(k*(d.length-1)))].toFixed(2)');
      await stats();
      await wait(10000);
      const x1 = await stats();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await wait(10000);
      const x4 = await stats();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await wait(20000);
      const later = await stats();
      await page.screenshot({ path: SH + `perf-match-${sport}-${w}.png` });
      console.log(sport, w + 'x' + h, 'LOAD', JSON.stringify(load));
      console.log(sport, w + 'x' + h, '1x', JSON.stringify(x1));
      console.log(sport, w + 'x' + h, '4x', JSON.stringify(x4));
      console.log(sport, w + 'x' + h, '1x+40s heap', later.heapMB, 'cbP99', later.cbP99, 'longTasks', later.longTasks, errs.length ? 'ERR ' + errs[0] : '');
      await ctx.close();
    }
  }
  await browser.close();
})();
