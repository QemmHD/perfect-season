// V2 baseline probe for plan §3.10 (Claude 2026-11-16): today's match flow through the UT Squad
// Battles fixture at 393×852 (local profile, isolated), printing a value for every §3.10 row.
//  1. Pre-game: from the rung tap to the first controllable possession (the clock shows a number
//     and SHOOT is live): taps and seconds, and whether a tap skips the VS card.
//  2. Pause: today's game has no pause; what 10 s away does (engine steps and possessions played),
//     and whether a hidden page pauses it.
//  3. The loop, with ?autoplay so a full game plays itself: the final whistle to onFinish (the
//     result screen), then ut's 5 s result sheet stubbed by a 5 s wait, NEXT RUNG, and the next
//     tip-off at 4× CPU; whether the canvas and renderer were rebuilt; the JS heap after each game.
//     Autoplay shortens the VS card to 0.4 s and skips the vote, so the whole loop is also given
//     with step 1's measured pre-game added back.
//   node scripts/audit/nba-rematch.mjs [games]      (games: autoplay games to play, default 3)
import { context, launch, needServer, report, shot, utFixture, wait } from './nba-lib.mjs';

const GAMES = Number(process.argv[2] ?? 3);
const STUB_SHEET_S = 5;

async function toBattles(page) {
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
  await page.locator('.ut-row, .hq-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click();
  await page.locator('.utb-rung.next').waitFor();
}

/** the first possession you can play: the clock reads a number and SHOOT is enabled */
const controllable = (page) => page.evaluate(() => /\d/.test(document.querySelector('.hg2-bug .mid em')?.textContent || '') && !!document.querySelector('.hg2-shoot:not([disabled])'));
/** autoplay's first live possession (no controls): the dev probe sees a possession under way */
const tippedOff = (page) => page.evaluate(() => (window.__hg2?.possession()?.t ?? 0) > 0);

async function until(page, test, timeoutMs, everyMs = 20) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await test()) return (Date.now() - t0) / 1000;
    await wait(everyMs);
  }
  return null;
}

await needServer();
const browser = await launch();
const out = {};
try {
  // ---- 1. pre-game, and the VS card ----
  {
    const { ctx, page, errors } = await context(browser, '393');
    await utFixture(page);
    await toBattles(page);
    let taps = 1;
    const t0 = Date.now();
    await page.locator('.utb-rung.next').click();
    await page.locator('.utm-vs').waitFor({ timeout: 10000 });
    await shot(page, 'rematch-vs');
    // does a tap skip the VS card? (V2: the curtain skips in ≤ 0.3 s)
    const tTap = Date.now();
    await page.locator('.utm-vs').click({ force: true }).catch(() => {});
    const gone = await until(page, async () => (await page.locator('.utm-vs').count()) === 0, 4000);
    // a skip answers the tap at once; a card that leaves later just ran its own 2.8 s
    const skipS = gone !== null && gone <= 0.5 ? gone : null;
    const vsS = (Date.now() - t0) / 1000;
    let stage = '';
    let firstS = null;
    for (let i = 0; i < 400 && firstS === null; i++) {
      if (await controllable(page)) firstS = (Date.now() - t0) / 1000;
      else if (stage !== 'vote' && (await page.locator('.vote-opt').filter({ hasText: 'PLAY' }).count())) {
        stage = 'vote';
        await shot(page, 'rematch-vote');
        await page.locator('.vote-opt').filter({ hasText: 'PLAY' }).click();
        taps++;
      } else if (stage !== 'how' && (await page.locator('button.big').filter({ hasText: /^PLAY$/ }).count())) {
        stage = 'how';
        await shot(page, 'rematch-how');
        await page.locator('button.big').filter({ hasText: /^PLAY$/ }).click();
        taps++;
      } else await wait(25);
    }
    await shot(page, 'rematch-first-possession');
    // ---- 2. no pause: 10 s away ----
    const before = await page.evaluate(() => ({ t: window.__hg2?.possession()?.t ?? 0, done: window.__hg2?.game()?.done ?? 0 }));
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
    });
    await wait(10000);
    const after = await page.evaluate(() => ({ t: window.__hg2?.possession()?.t ?? 0, done: window.__hg2?.game()?.done ?? 0 }));
    out.pregame = {
      taps,
      tapsNote: 'the rung, the vote PLAY and the Arcade PLAY (the probe also tapped the VS card once, which did nothing)',
      seconds: firstS,
      vsSkippedByTapS: skipS,
      vsCardS: +vsS.toFixed(2),
      pauseControl: 'absent',
      hidden10s: { possessionsPlayed: after.done - before.done, simSecondsAdvanced: +(after.done === before.done ? after.t - before.t : NaN).toFixed(2) },
      errors,
    };
    console.log('pre-game', JSON.stringify(out.pregame));
    await ctx.close();
  }
  // ---- 3. the loop, autoplay ----
  {
    const { ctx, page, cdp, errors } = await context(browser, '393');
    // canvases made: every one (sprite caches draw into offscreen canvases) and the game's own
    await ctx.addInitScript(() => {
      window.__canvases = 0;
      const make = Document.prototype.createElement;
      Document.prototype.createElement = function (tag, o) {
        if (String(tag).toLowerCase() === 'canvas') window.__canvases++;
        return make.call(this, tag, o);
      };
    });
    await utFixture(page, { params: { autoplay: '' } });
    await toBattles(page);
    await page.locator('.utb-rung.next').click();
    const games = [];
    for (let gi = 0; gi < GAMES; gi++) {
      if ((await until(page, () => tippedOff(page), 30000)) === null) throw Error('no tip-off in game ' + (gi + 1));
      // the JS heap after a full collection (CDP: performance.memory is bucketed in Chromium)
      await cdp.send('HeapProfiler.collectGarbage');
      const heapMB = +((await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6).toFixed(2);
      const canvas = await page.evaluate(() => {
        const c = document.querySelector('.hg2-canvas');
        if (c && !c.dataset.qaId) c.dataset.qaId = String(Math.random()).slice(2, 8);
        return { id: c?.dataset.qaId ?? null, made: window.__canvases };
      });
      const gameS = await until(page, () => page.evaluate(() => !!document.querySelector('.hg2-final')), 400000, 50);
      const tWhistle = Date.now();
      await shot(page, `rematch-whistle-${gi + 1}`);
      const toFinish = await until(page, async () => (await page.getByRole('button', { name: 'NEXT RUNG', exact: true }).count()) > 0, 20000);
      await shot(page, `rematch-result-${gi + 1}`);
      const g = { heapMB, canvas, gameS, whistleToFinishS: toFinish };
      if (gi < GAMES - 1) {
        await wait(STUB_SHEET_S * 1000);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const tTap = Date.now();
        await page.getByRole('button', { name: 'NEXT RUNG', exact: true }).click();
        const tip = await until(page, () => tippedOff(page), 30000);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        g.nextRungToTipoffS4x = tip === null ? null : +((Date.now() - tTap) / 1000).toFixed(2);
        g.loopS = +((Date.now() - tWhistle) / 1000).toFixed(2);
      }
      games.push(g);
      console.log('game', gi + 1, JSON.stringify(g));
    }
    const last = games[games.length - 1];
    const ids = new Set(games.map((g) => g.canvas.id));
    out.loop = {
      games,
      whistleToFinishS: games[0].whistleToFinishS,
      rematchToTipoffS4x: games[0].nextRungToTipoffS4x,
      newGameCanvasesPerRematch: ids.size === 1 ? 0 : 1,
      sameCanvasElement: ids.size === 1,
      offscreenCanvasesPerGame: games.length > 1 ? Math.round((last.canvas.made - games[0].canvas.made) / (games.length - 1)) : null,
      heapGrowth: games.length > 1 && games[0].heapMB ? +(last.heapMB / games[0].heapMB).toFixed(3) : null,
      heapNote: `after game ${games.length} vs after game 1 (V2 asks after the 5th rematch)`,
      loopAutoplayS: games[0].loopS,
      loopWithRealPregameS: out.pregame.seconds && games[0].whistleToFinishS !== null ? +(games[0].whistleToFinishS + STUB_SHEET_S + out.pregame.seconds).toFixed(2) : null,
      loopNote: `whistle → result (${games[0].whistleToFinishS} s) + the ${STUB_SHEET_S} s stub sheet + NEXT RUNG → a controllable tip-off as a person meets it (step 1's ${out.pregame.seconds} s, taps included)`,
      errors,
    };
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('\n§3.10 rows, today:');
const rows = [
  ['flow.pregameTaps', '≤ 2', out.pregame?.taps],
  ['flow.pregameS', '≤ 3.5', out.pregame?.seconds],
  ['flow.skipCurtainS', '≤ 0.3', out.pregame?.vsSkippedByTapS ?? `not skippable (the VS card runs ${out.pregame?.vsCardS} s)`],
  ['pause.steps', '0', `no pause; hidden 10 s: ${out.pregame?.hidden10s.possessionsPlayed} possessions ended, ${out.pregame?.hidden10s.simSecondsAdvanced} sim s`],
  ['pause.timers', '0', 'no pause (timers run on)'],
  ['pause.markDiff', '0', 'no pause'],
  ['pause.autoOnHide', '1', out.pregame?.hidden10s.possessionsPlayed || out.pregame?.hidden10s.simSecondsAdvanced ? 0 : 1],
  ['hold.whistleToFinishS', '≤ 0.3', out.loop?.whistleToFinishS],
  ['hold.rematchToPlayS', '≤ 1.5 (4×)', out.loop?.rematchToTipoffS4x],
  ['hold.newCanvases', '0', `${out.loop?.newGameCanvasesPerRematch} game canvas and renderer per rematch (same element: ${out.loop?.sameCanvasElement}); ${out.loop?.offscreenCanvasesPerGame} offscreen sprite canvases made per game`],
  ['hold.heapGrowth', '≤ 1.10', out.loop?.heapGrowth],
  ['hold.loopS', '≤ 10', out.loop?.loopWithRealPregameS],
];
for (const [k, want, today] of rows) console.log(`  ${k.padEnd(24)} V2 ${String(want).padEnd(12)} today ${today}`);
out.rows = Object.fromEntries(rows.map(([k, want, today]) => [k, { v2: want, today }]));
report('nba-rematch', out);
