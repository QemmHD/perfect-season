// Players QA (studio overhaul, players-5): memory and freshness across rematches with the arena kept
// mounted. Each sport's autoplay match runs `--secs` (40) at 1x; at every quarter the renderer's
// `resetMotion()` is called, as the One-More rematch path does with the arena held (V2 D.1): the motion
// starts again, the sprite caches and their shared area account stay. Reported: heap after a forced
// GC at the start and the end, the shared area account (pixel/sprite-budget.ts MATCH_AREA: art px now
// and at its peak, never over the 6 Mpx cap), and stale draws of bodies of 32 art px or more in the
// 30 frames after each reset (the pre-warm).
//
//   node scripts/qa/players-rematch.mjs [--sport nba,nfl,soccer] [--vp 393] [--secs 40] [--resets 3]
//        [--tag after] [--out DIR] [--port 5214]
// Prints one JSON line (and OUT/players-rematch-<tag>.json). Isolated: localhost only.
import { emit, heapMB, installProbe, listOf, matchUrl, needServer, newContext, opts, readProbe, resetProbe, round, SPORTS, summariseProbe, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const vp = String(opts.vp ?? '393');
const secs = Number(opts.secs ?? 40);
const resets = Number(opts.resets ?? 3);
const tag = String(opts.tag ?? 'after');

await needServer();
const runs = await withBrowser(async (browser) => {
  const out = [];
  for (const sport of sports) {
    const context = await newContext(browser, vp, { dpr: 1 });
    const page = await context.newPage();
    const errors = watchErrors(page);
    await page.goto(matchUrl(sport, { seed: 'rematch' }), { waitUntil: 'load' });
    await installProbe(page, sport);
    await wait(3000);
    // the shared area account, read from the module copy the page runs
    await page.evaluate(async () => {
      const loaded = (p) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => new URL(n).pathname === p) ?? p;
      const B = await import(loaded('/src/game/pixel/sprite-budget.ts'));
      window.__psArea = B.MATCH_AREA;
      B.MATCH_AREA.peak = B.MATCH_AREA.used;
    });
    await resetProbe(page);
    const heapStart = await heapMB(page);
    const after = [];
    const every = (secs * 1000) / (resets + 1);
    for (let i = 0; i <= resets; i++) {
      await wait(every);
      if (i === resets) break;
      // a rematch with the arena mounted: the renderer's motion starts again, its drawings stay
      const before = await page.evaluate(() => {
        const S = window.__psProbe;
        S.renderer.resetMotion();
        return { frames: S.frames, byPx: JSON.parse(JSON.stringify(S.byPx)) };
      });
      // (30 frames at 60 fps)
      await wait(500);
      after.push(await page.evaluate((b) => {
        // the 30 frames after the reset: sprites of 32 px and up, from the probe's per-size counters
        const S = window.__psProbe;
        let lookups = 0;
        let stale = 0;
        for (const k of ['32-47', '48-71', '72+']) {
          const now = S.byPx[k] ?? { lookups: 0, stale: 0 };
          const was = b.byPx[k] ?? { lookups: 0, stale: 0 };
          lookups += now.lookups - was.lookups;
          stale += now.stale - was.stale;
        }
        return { frames: S.frames - b.frames, lookups, stale };
      }, before));
    }
    const area = await page.evaluate(() => ({ used: window.__psArea.used, peak: window.__psArea.peak, cap: window.__psArea.cap }));
    const probe = summariseProbe(await readProbe(page));
    const heapEnd = await heapMB(page);
    const lk = after.reduce((n, a) => n + a.lookups, 0);
    const st = after.reduce((n, a) => n + a.stale, 0);
    out.push({
      sport,
      vp,
      secs,
      resets,
      heapStartMB: heapStart,
      heapEndMB: heapEnd,
      heapGrowthPct: round((100 * (heapEnd - heapStart)) / Math.max(1, heapStart), 1),
      areaMpx: { now: round(area.used / 1e6, 2), peak: round(area.peak / 1e6, 2), cap: round(area.cap / 1e6, 2) },
      afterReset: { windows: after, lookups32: lk, stalePct32: lk ? round((100 * st) / lk, 1) : null },
      stalePct: probe.stalePct,
      fps: probe.fps,
      pageErrors: errors.slice(0, 5),
    });
    await context.close();
  }
  return out;
});
emit('players-rematch-' + tag, { runs });
