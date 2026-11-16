// The NBA lab game at the plan's sizes, played by touch (ported from the audit's nba-shots, Claude
// 2026-11-16): load timing, the control layout and its overlaps, then a dribble, a jumper (meter
// rising, release, outcome), a sprint drive and finish, a crossover, a SCREEN call, a pass and the
// LAST PLAY readout, each captured. Frame timing at 393×852, 1× and 4× CPU.
//   node scripts/audit/nba-shots.mjs [size…] [--reduce]      (sizes: 393 320 430 375 852land …)
import { context, frames, launch, needServer, openLab, rect, report, shot, SIZES, touch, wait } from './nba-lib.mjs';

const argv = process.argv.slice(2);
const motion = argv.includes('--reduce') ? 'reduce' : 'no-preference';
const sizes = argv.filter((a) => !a.startsWith('--'));
const CONTROLS = ['.hg2-bug', '.hg2-marks', '.hg2-look', '.hg2-hint', '.hg2-pop', '.hg2-coach', '.hg2-skills', '.hg2-stick', '.hg2-pass', '.hg2-shoot', '.play-readout-toggle'];
const nextPossession = (page) => page.waitForFunction(() => !document.querySelector('.hg2-pass')?.hasAttribute('disabled'), null, { timeout: 15000 }).catch(() => null);

await needServer();
const browser = await launch();
const results = {};
try {
  for (const name of sizes.length ? sizes : Object.keys(SIZES)) {
    const { ctx, page, cdp, errors } = await context(browser, name, { motion });
    const tag = name + (motion === 'reduce' ? '-reduce' : '');
    const t0 = Date.now();
    await openLab(page, { seed: 'audit' + name, level: '0.85' });
    const r = { tPlayMs: Date.now() - t0 };
    await wait(300);
    await shot(page, `${tag}-01-tipoff`);
    r.layout = {};
    for (const q of CONTROLS) r.layout[q] = await rect(page, q);
    const boxes = Object.entries(r.layout).filter(([, b]) => b);
    r.overlaps = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [na, a] = boxes[i];
        const [nb, b] = boxes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) r.overlaps.push(na + ' x ' + nb);
      }
    const stick = await rect(page, '.hg2-stick');
    const shoot = await rect(page, '.hg2-shoot');
    const passB = await rect(page, '.hg2-pass');
    if (stick && shoot) {
      await touch(cdp, 'touchStart', [{ x: stick.cx, y: stick.cy, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: stick.cx + 6, y: stick.cy - stick.h * 0.42, id: 1 }]);
      await wait(1200);
      await shot(page, `${tag}-02-dribble-up`);
      await touch(cdp, 'touchEnd', []);
      await wait(250);
      await touch(cdp, 'touchStart', [{ x: shoot.cx, y: shoot.cy, id: 2 }]);
      await wait(320);
      await shot(page, `${tag}-03-meter-rising`);
      await wait(170);
      await touch(cdp, 'touchEnd', []);
      await wait(120);
      await shot(page, `${tag}-04-release`);
      await wait(900);
      await shot(page, `${tag}-05-outcome`);
      await nextPossession(page);
      await wait(1200);
      await touch(cdp, 'touchStart', [{ x: stick.cx, y: stick.cy, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: stick.cx + 4, y: stick.cy - stick.h * 0.6, id: 1 }]);
      await wait(1500);
      await shot(page, `${tag}-06-sprint-drive`);
      await touch(cdp, 'touchStart', [{ x: stick.cx + 4, y: stick.cy - stick.h * 0.6, id: 1 }, { x: shoot.cx, y: shoot.cy, id: 2 }]);
      await wait(250);
      await shot(page, `${tag}-07-finish-gather`);
      await touch(cdp, 'touchEnd', []);
      await wait(700);
      await shot(page, `${tag}-08-finish-result`);
      await nextPossession(page);
      await wait(1000);
      const cross = await rect(page, '.hg2-skills button');
      if (cross) {
        await touch(cdp, 'touchStart', [{ x: cross.cx, y: cross.cy, id: 3 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(140);
        await shot(page, `${tag}-09-crossover`);
      }
      const coach = await rect(page, '.hg2-coach button');
      if (coach) {
        await wait(600);
        await touch(cdp, 'touchStart', [{ x: coach.cx, y: coach.cy, id: 4 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(900);
        await shot(page, `${tag}-10-screen-call`);
      }
      if (passB) {
        await touch(cdp, 'touchStart', [{ x: passB.cx, y: passB.cy, id: 5 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(250);
        await shot(page, `${tag}-11-pass`);
      }
      const lp = await rect(page, '.play-readout-toggle');
      if (lp) {
        await touch(cdp, 'touchStart', [{ x: lp.cx, y: lp.cy, id: 6 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(300);
        await shot(page, `${tag}-12-lastplay`);
      }
    }
    if (name === '393') {
      r.frames1x = await frames(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      r.frames4x = await frames(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      r.heapMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));
    }
    r.errors = errors;
    results[tag] = r;
    console.log(tag, JSON.stringify({ tPlayMs: r.tPlayMs, overlaps: r.overlaps, errors }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
report('nba-shots' + (motion === 'reduce' ? '-reduce' : ''), results);
