// AUDIT ONLY: main-thread time inside rAF callbacks (the game loop: sim steps + canvas draw), autoplay
// game, 1x and 4x CPU slowdown, portrait and landscape. localhost only.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const [w, h] of [[390, 844], [844, 390], [430, 932]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await context.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    await context.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__cb = [];
      window.requestAnimationFrame = (f) => raf((t) => { const a = performance.now(); f(t); window.__cb.push(performance.now() - a); });
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.goto('http://localhost:5201/?arcade&auto&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=perf', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /\d/.test(document.querySelector('.hg2-bug .mid em')?.textContent || ''), null, { timeout: 30000 });
    await wait(1500);
    const stats = async () => page.evaluate(() => { const d = window.__cb.slice().sort((a, b) => a - b); window.__cb = []; const q = (k) => +d[Math.floor(k * (d.length - 1))].toFixed(2); return { n: d.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: +d[d.length - 1].toFixed(1), over8ms: d.filter((x) => x > 8).length, over16ms: d.filter((x) => x > 16).length }; });
    await page.evaluate(() => (window.__cb = []));
    await wait(8000);
    const x1 = await stats();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await wait(8000);
    const x4 = await stats();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(w + 'x' + h, 'rAF callback ms 1x', JSON.stringify(x1), ' 4x', JSON.stringify(x4));
    await context.close();
  }
  await browser.close();
})();
