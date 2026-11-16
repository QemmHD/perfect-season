// Players QA (studio overhaul, players-1): in-match frame pacing, cost and canvas memory, all three
// sports, at the five phone viewports, 1x and 4x CPU. Port of the audit's matchperf.cjs/heap.cjs,
// plus the total canvas area held by cached player sprites (the iOS canvas-memory risk, A-1/P-4).
//
// Per run: frame intervals (fps, p99, max, frames over 20 and 34 ms), main-thread time inside
// requestAnimationFrame per frame (sim + draw), long tasks, the renderer's own draw cost, heap after
// a forced GC at the start and the end, and the sprite canvas area now and at its peak.
//
//   node scripts/qa/players-matchperf.mjs [--sport nba,nfl,soccer] [--vp 393,430,320,375,844land]
//        [--cpu 1,4] [--window 10] [--warm 2.5] [--dpr 3] [--seed perf] [--tag before] [--out DIR]
// `--window` is seconds per CPU rate (60 for the players-2 sprite-area acceptance at 4x).
import { cpu, emit, heapMB, installProbe, listOf, MATCH_VIEWPORTS, matchUrl, needServer, newContext, opts, quantile, readProbe, round, shot, SPORTS, summariseProbe, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const vps = listOf(opts.vp, MATCH_VIEWPORTS);
const rates = listOf(opts.cpu, ['1', '4']).map(Number);
const windowS = Number(opts.window ?? 10);
const warm = Number(opts.warm ?? 2.5);
const dpr = Number(opts.dpr ?? 3);
const seed = String(opts.seed ?? 'perf');
const tag = String(opts.tag ?? 'before');

/** Frame timing hooks, installed before the page's own scripts. */
function pacingHooks() {
  const raf = window.requestAnimationFrame.bind(window);
  const P = (window.__psPace = { cost: new Map(), iv: [], lt: [], lastT: 0 });
  window.requestAnimationFrame = (f) =>
    raf((t) => {
      const a = performance.now();
      try {
        f(t);
      } finally {
        const c = performance.now() - a;
        P.cost.set(t, (P.cost.get(t) ?? 0) + c);
        if (t !== P.lastT) {
          if (P.lastT) P.iv.push(t - P.lastT);
          P.lastT = t;
        }
      }
    });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.lt.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // no long-task timing in this browser
  }
}

const take = (page) =>
  page.evaluate(() => {
    const P = window.__psPace;
    const out = { iv: P.iv.slice(), cost: [...P.cost.values()], lt: P.lt.slice() };
    P.iv = [];
    P.cost = new Map();
    P.lt = [];
    return out;
  });

function pace(s) {
  const iv = s.iv;
  const mean = iv.reduce((a, b) => a + b, 0) / Math.max(1, iv.length);
  return {
    frames: iv.length,
    fps: round(1000 / mean, 1),
    ivP50: round(quantile(iv, 0.5), 1),
    ivP99: round(quantile(iv, 0.99), 1),
    ivMax: round(Math.max(0, ...iv), 1),
    over20: iv.filter((x) => x > 20).length,
    over34: iv.filter((x) => x > 34).length,
    rafCostP50: round(quantile(s.cost, 0.5), 2),
    rafCostP99: round(quantile(s.cost, 0.99), 2),
    longTasks: s.lt.length,
    longTaskMs: Math.round(s.lt.reduce((a, b) => a + b, 0)),
  };
}

await needServer();
const runs = await withBrowser(async (browser) => {
  const out = [];
  for (const sport of sports)
    for (const vp of vps) {
      const context = await newContext(browser, vp, { dpr });
      await context.addInitScript(pacingHooks);
      const page = await context.newPage();
      const errors = watchErrors(page);
      await page.goto(matchUrl(sport, { seed }), { waitUntil: 'load' });
      await installProbe(page, sport);
      await wait(warm * 1000);
      const heapStart = await heapMB(page);
      await take(page);
      const byRate = {};
      let session = null;
      for (const rate of rates) {
        if (rate !== 1 || session) session = await cpu(page, rate);
        await take(page);
        const drawFrom = (await readProbe(page)).drawMs.length;
        await wait(windowS * 1000);
        const s = await take(page);
        const draw = (await readProbe(page)).drawMs.slice(drawFrom);
        byRate[rate + 'x'] = { ...pace(s), drawMsP50: round(quantile(draw, 0.5), 2), drawMsP99: round(quantile(draw, 0.99), 2) };
      }
      if (session) await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const probe = summariseProbe(await readProbe(page));
      const heapEnd = await heapMB(page);
      const file = await shot(page, `${tag}-perf-match-${sport}-${vp}`);
      out.push({ sport, vp, dpr, seed, windowS, ...byRate, heapStartMB: heapStart, heapEndMB: heapEnd, spriteAreaMpx: probe.spriteAreaMpx, spriteAreaPeakMpx: probe.spriteAreaPeakMpx, cacheEntries: probe.cacheEntries, spritePx: probe.spritePx, shot: file, pageErrors: errors.slice(0, 5) });
      await context.close();
    }
  return out;
});
emit('players-matchperf-' + tag, { runs });
