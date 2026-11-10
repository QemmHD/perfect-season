// AUDIT ONLY: frame pacing of the NFL arcade (autopilot lab) at 390x844 dsf3, with and without 4x CPU throttle.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const throttle of [1, 4]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = new URL(r.request().url()); return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.continue() : r.abort(); });
    const cdp = await ctx.newCDPSession(page);
    await page.goto('http://localhost:5202/?arcade&auto&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=perf', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas.hg2-canvas', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const r = await page.evaluate(async () => {
      const gaps = [];
      let last = performance.now();
      let longTasks = 0, longMs = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { longTasks++; longMs += e.duration; } }).observe({ entryTypes: ['longtask'] }); } catch {}
      const heap0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
      await new Promise((res) => {
        const t0 = performance.now();
        const f = (now) => { gaps.push(now - last); last = now; if (now - t0 < 15000) requestAnimationFrame(f); else res(); };
        requestAnimationFrame(f);
      });
      const heap1 = performance.memory ? performance.memory.usedJSHeapSize : 0;
      gaps.sort((a, b) => a - b);
      const q = (p) => gaps[Math.floor(p * (gaps.length - 1))];
      return { frames: gaps.length, fps: +(gaps.length / 15).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), over33: gaps.filter((g) => g > 33.4).length, longTasks, longMs: Math.round(longMs), heapMB0: +(heap0 / 1e6).toFixed(1), heapMB1: +(heap1 / 1e6).toFixed(1), canvas: (() => { const c = document.querySelector('canvas.hg2-canvas'); return c ? c.width + 'x' + c.height + ' css ' + c.style.width + 'x' + c.style.height : null; })() };
    });
    console.log(JSON.stringify({ throttle, ...r }));
    await ctx.close();
  }
  await browser.close();
})();
