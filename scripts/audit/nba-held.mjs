// The held arena, measured (plan §3.10 rows; nba-3, Claude 2026-11-16): the lab's stub host
// (?arcade&hold&auto: Arcade with `hold`, a 5 s stub result sheet, then `rematch()`), at 393×852.
//  - whistle → onFinish: from the last possession's end (the dev probe's whistleAt) to the host's
//    onFinish (HeldLab's log)
//  - rematch() → the first live frame of the next game at 4× CPU, the 1.2 s curtain included (the
//    tip-off, and the first frame drawn after the game has stepped); and a tap on the curtain → live
//    (skipping it)
//  - the renderer and the canvas are the same objects after every rematch
//  - the JS heap (after a forced GC) after the 5th rematch against after the 1st
//  - the whole loop: whistle → next tip-off with the stub's 5 s sheet
// Each game is fast-forwarded to its last possession (the probe's skipTo), so a loop takes seconds.
//   node scripts/audit/nba-held.mjs [rematches]   (default 5)
import { context, launch, needServer, report, shot, url, wait } from './nba-lib.mjs';

const N = Number(process.argv[2] ?? 5);

async function until(page, test, timeoutMs, everyMs = 15) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await test()) return (Date.now() - t0) / 1000;
    await wait(everyMs);
  }
  return null;
}
/** a possession under way (the dev probe: game time has started) */
const live = (page) => page.evaluate(() => {
  const p = window.__hg2?.possession();
  return !!p && p.t > 0 && !p.end;
});
const lastPossession = (page) => page.evaluate(() => {
  const g = window.__hg2.game();
  window.__hg2.skipTo(g.total - 1);
});
const heap = async (page, cdp) => {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
};

await needServer();
const browser = await launch();
const out = { rematches: [] };
try {
  const { page, cdp, errors } = await context(browser, '393');
  await page.goto(url({ arcade: '', hold: '', auto: '', seed: 'held' }), { waitUntil: 'domcontentloaded' });
  await until(page, () => live(page), 45000);
  await page.evaluate(() => {
    window.__r0 = window.__hg2.renderer();
    window.__c0 = window.__hg2.canvas();
  });
  for (let i = 0; i <= N; i++) {
    const row = { game: i };
    await lastPossession(page);
    // the whistle → onFinish
    await page.waitForFunction((n) => (window.__heldLab?.finishes.length ?? 0) > n, i, { timeout: 60000 });
    const t = await page.evaluate((n) => ({ whistle: window.__hg2.whistleAt(), finish: window.__heldLab.finishes[n] }), i);
    row.whistleToFinishS = +((t.finish - t.whistle) / 1000).toFixed(3);
    const whistle = t.whistle;
    // (nba-3 review) the box score at the whistle: this game's points only (the scorer plate reads it)
    row.boxPtsAtWhistle = await page.evaluate(() => window.__hg2.boxPoints());
    row.scoreAtWhistle = await page.evaluate(() => window.__hg2.game().score);
    if (i === 0) await shot(page, 'held-393-sheet');
    if (i === N) {
      out.rematches.push(row);
      break;
    }
    if (i === 0) {
      // the whole loop with the stub's own 5 s sheet: whistle → the next game's first live frame
      const s = await until(page, () => live(page), 20000);
      row.loopWhistleToTipS = +((await page.evaluate((w) => performance.now() - w, whistle)) / 1000).toFixed(2);
      row.loopWaitS = s;
    } else if (i === 1) {
      // a tap on the curtain skips it
      await page.evaluate(() => window.__heldLab.rematch());
      await page.locator('.hg2-curtain').waitFor({ timeout: 5000 });
      await shot(page, 'held-393-curtain');
      const t0 = Date.now();
      await page.locator('.hg2-curtain').dispatchEvent('pointerdown');
      await until(page, () => live(page), 10000);
      row.skipCurtainToLiveS = +((Date.now() - t0) / 1000).toFixed(3);
    } else {
      // rematch() → the first live frame at 4× CPU, the curtain played out (timed in the page: the
      // rematch call to the next possession's tip-off, then to its first frame on screen)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      // (nba-3 review) timed in the page from the rematch call: the first tip-off (`tipAt` as the next
      // game's first possession starts; a later possession's tip-off overwrites it, so it's watched),
      // and the first frame on screen after the game has run a step (the frame after the one that
      // drew it: so the tip-off's own draw, the court and the first drawings, is counted)
      await page.evaluate(() => {
        const w = window;
        w.__held4x = { tip: null, frame: null };
        const before = w.__hg2.tipAt();
        let seen = false;
        const watch = () => {
          const q = w.__hg2;
          const tip = q?.tipAt();
          if (w.__held4x.tip === null && tip !== null && tip !== before) w.__held4x.tip = tip;
          const p = q?.possession();
          if (w.__held4x.tip !== null && p && (p.t > 0 || p.end)) {
            if (seen) {
              w.__held4x.frame = performance.now();
              return;
            }
            seen = true;
          }
          requestAnimationFrame(watch);
        };
        w.__heldLab.rematch();
        requestAnimationFrame(watch);
      });
      await page.waitForFunction(() => window.__held4x.frame !== null, null, { timeout: 20000, polling: 50 });
      const t4 = await page.evaluate(() => ({ at: window.__heldLab.rematches.at(-1), ...window.__held4x }));
      row.rematchToTip4xS = +((t4.tip - t4.at) / 1000).toFixed(3);
      row.rematchToLive4xS = +((t4.frame - t4.at) / 1000).toFixed(3);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await until(page, () => live(page), 20000, 10);
    }
    // a rematch's box score starts again at 0 (before the fix it carried the last game's points)
    row.boxPtsAtTip = await page.evaluate(() => {
      const g = window.__hg2.game();
      return { box: window.__hg2.boxPoints(), score: g.score, done: g.done };
    });
    row.sameRenderer = await page.evaluate(() => window.__hg2.renderer() === window.__r0 && window.__hg2.canvas() === window.__c0);
    row.heapMB = +(await heap(page, cdp)).toFixed(2);
    out.rematches.push(row);
    console.log(JSON.stringify(row));
  }
  const heaps = out.rematches.filter((r) => r.heapMB).map((r) => r.heapMB);
  out.summary = {
    whistleToFinishMaxS: Math.max(...out.rematches.map((r) => r.whistleToFinishS)),
    rematchToTip4xMaxS: Math.max(...out.rematches.filter((r) => r.rematchToTip4xS).map((r) => r.rematchToTip4xS)),
    rematchToLive4xMaxS: Math.max(...out.rematches.filter((r) => r.rematchToLive4xS).map((r) => r.rematchToLive4xS)),
    rematches4x: out.rematches.filter((r) => r.rematchToLive4xS).length,
    skipCurtainToLiveS: out.rematches.find((r) => r.skipCurtainToLiveS)?.skipCurtainToLiveS,
    loopWhistleToTipS: out.rematches[0].loopWhistleToTipS,
    rendererKept: out.rematches.filter((r) => 'sameRenderer' in r).every((r) => r.sameRenderer),
    // the box never runs ahead of the game it belongs to (it carried over before the fix)
    boxIsThisGame: out.rematches.every((r) => !r.boxPtsAtTip || r.boxPtsAtTip.box <= r.boxPtsAtTip.score),
    heapAfter1stMB: heaps[0],
    heapAfterLastMB: heaps[heaps.length - 1],
    heapGrowth: +(heaps[heaps.length - 1] / heaps[0]).toFixed(3),
  };
  out.errors = errors;
} finally {
  await browser.close();
}
report('nba-held', out);
