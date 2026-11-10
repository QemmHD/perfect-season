// Audit (read-only): frame pacing of the soccer lab's autopilot match at 390x844, at 1x and 4x CPU throttle.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [w, h] of [[390, 844], [844, 390]])
    for (const thr of [1, 4, 6]) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
      await context.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
      const page = await context.newPage();
      await page.goto('http://localhost:5203/?soccer-lab=1&qa=1&auto=1&seed=perf&ns=inspect&relay=ws://localhost:7777', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__soccer && window.__soccer.a, null, { timeout: 60000 });
      await page.waitForTimeout(2500);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
      const r = await page.evaluate(
        () =>
          new Promise((res) => {
            const ts = [];
            let long = 0;
            try {
              new PerformanceObserver((l) => (long += l.getEntries().length)).observe({ entryTypes: ['longtask'] });
            } catch {}
            const t0 = performance.now();
            const f = (t) => {
              ts.push(t);
              if (t - t0 < 8000) requestAnimationFrame(f);
              else {
                const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
                const over = d.filter((x) => x > 20).length;
                res({ frames: d.length, fps: +(d.length / 8).toFixed(1), median: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), p99: +d[Math.floor(d.length * 0.99)].toFixed(1), max: +d[d.length - 1].toFixed(1), over20ms: over, longtasks: long, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null });
              }
            };
            requestAnimationFrame(f);
          })
      );
      out[w + 'x' + h + ' cpu' + thr + 'x'] = r;
      console.log(w + 'x' + h, 'cpu', thr + 'x', JSON.stringify(r));
      await context.close();
    }
  await browser.close();
})();
