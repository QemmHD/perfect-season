// A thumb already on the stick when a possession starts (audit NBA-12, ported by Claude
// 2026-11-16): is it ignored? Puts a thumb on the stick before the tip-off and holds it pushed up,
// then measures how far the handler moved (from the engine, through the dev probe) over 2.5 s,
// and again after lifting and pressing anew. Baseline for plan §3.8 `stick.preheldFt`.
//   node scripts/audit/nba-deadstick.mjs [size]
import { context, launch, needServer, rect, report, shot, touch, url, wait } from './nba-lib.mjs';

const size = process.argv[2] ?? '393';
await needServer();
const browser = await launch();
try {
  const { page, cdp, errors } = await context(browser, size);
  await page.goto(url({ arcade: '', seed: 'deadstick' }), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hg2-stick', { timeout: 45000 });
  const b = await rect(page, '.hg2-stick');
  const handler = () =>
    page.evaluate(() => {
      const p = window.__hg2?.possession();
      if (!p || p.handler === null) return null;
      const h = p.bodies[p.handler];
      return { cx: h.cx, cz: h.cz, t: p.t };
    });
  const knob = () => page.$eval('.hg2-stick i', (i) => i.style.transform);
  // the thumb goes down before the whistle (the pad shows ~700 ms before the first possession)
  await touch(cdp, 'touchStart', [{ x: b.cx, y: b.cy, id: 1 }]);
  await touch(cdp, 'touchMove', [{ x: b.cx + 3, y: b.cy - b.h * 0.45, id: 1 }]);
  await page.waitForFunction(() => window.__hg2?.possession()?.handler != null, null, { timeout: 30000 });
  const start = await handler();
  const held = [];
  for (let i = 0; i < 10; i++) {
    await touch(cdp, 'touchMove', [{ x: b.cx + (i % 2 ? 4 : -4), y: b.cy - b.h * 0.45, id: 1 }]);
    await wait(250);
    held.push({ knob: await knob(), at: await handler() });
  }
  await shot(page, `${size}-deadstick-held`);
  const moved = (a, z) => (a && z ? Math.hypot(z.cx - a.cx, z.cz - a.cz) : null);
  const after300 = held[0].at;
  await touch(cdp, 'touchEnd', []);
  await wait(100);
  const re0 = await handler();
  await touch(cdp, 'touchStart', [{ x: b.cx, y: b.cy, id: 2 }]);
  await touch(cdp, 'touchMove', [{ x: b.cx + 3, y: b.cy - b.h * 0.45, id: 2 }]);
  await wait(300);
  const re1 = await handler();
  await shot(page, `${size}-deadstick-repressed`);
  await touch(cdp, 'touchEnd', []);
  report('nba-deadstick', {
    size,
    preheldMovedFtAt300ms: moved(start, after300),
    preheldMovedFtAt2500ms: moved(start, held[held.length - 1].at),
    knobWhileHeld: held.map((x) => x.knob),
    repressedMovedFtAt300ms: moved(re0, re1),
    errors,
  });
} finally {
  await browser.close();
}
