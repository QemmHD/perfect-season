// Frame cost of the NBA game (audit nba-perf, ported by Claude 2026-11-16): an autoplay lab game at
// 430×932 and 320×568 (plus 852×393 sideways), 1× and 4× CPU. Main-thread time inside rAF callbacks
// (sim steps + canvas draw) and the rAF intervals (median fps, share of frames over 20 ms), the
// plan §3.9 rows.
//   node scripts/audit/nba-perf.mjs [size…]
import { context, frames, launch, needServer, openLab, report, wait } from './nba-lib.mjs';

const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['430', '320', '852land'];
await needServer();
const browser = await launch();
const out = {};
try {
  for (const size of sizes) {
    const { ctx, page, cdp, errors } = await context(browser, size);
    await ctx.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__cb = [];
      window.requestAnimationFrame = (f) =>
        raf((t) => {
          const a = performance.now();
          f(t);
          window.__cb.push(performance.now() - a);
        });
    });
    await openLab(page, { auto: '', seed: 'perf' });
    await wait(1500);
    const cost = () =>
      page.evaluate(() => {
        const d = window.__cb.slice().sort((a, b) => a - b);
        window.__cb = [];
        const q = (k) => +d[Math.floor(k * (d.length - 1))].toFixed(2);
        return { n: d.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: +d[d.length - 1].toFixed(1) };
      });
    await page.evaluate(() => (window.__cb = []));
    const f1 = await frames(page, 8000);
    const c1 = await cost();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const f4 = await frames(page, 8000);
    const c4 = await cost();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    out[size] = { '1x': { frames: f1, rafCallbackMs: c1 }, '4x': { frames: f4, rafCallbackMs: c4 }, errors };
    console.log(size, JSON.stringify(out[size]));
    await ctx.close();
  }
} finally {
  await browser.close();
}
report('nba-perf', out);
