// Does the HUD shot clock tick while nobody touches anything? (audit NBA-08, ported by Claude
// 2026-11-16). Samples the bug's clock, possession counter and banner every 500 ms for 20 s.
//   node scripts/audit/nba-clock.mjs [size]
import { context, launch, needServer, openLab, report, shot, wait } from './nba-lib.mjs';

const size = process.argv[2] ?? '393';
await needServer();
const browser = await launch();
const samples = [];
try {
  const { page, errors } = await context(browser, size);
  await openLab(page, { seed: 'clock' });
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    samples.push({
      s: +((Date.now() - t0) / 1000).toFixed(1),
      ...(await page.evaluate(() => {
        const em = document.querySelector('.hg2-bug .mid em');
        return { clock: em?.textContent ?? null, low: !!em?.classList.contains('low'), poss: document.querySelector('.hg2-bug .mid small')?.textContent ?? null, pop: document.querySelector('.hg2-pop')?.textContent ?? '' };
      })),
    });
    if (i === 10) await shot(page, `${size}-clock-idle`);
    await wait(500);
  }
  // how long the displayed value stood still while the possession was live
  let longest = 0;
  let run = 0;
  for (let i = 1; i < samples.length; i++) {
    const same = samples[i].clock === samples[i - 1].clock && samples[i].poss === samples[i - 1].poss && /\d/.test(samples[i].clock ?? '');
    run = same ? run + (samples[i].s - samples[i - 1].s) : 0;
    longest = Math.max(longest, run);
  }
  report('nba-clock', { size, longestFrozenS: +longest.toFixed(1), samples, errors });
} finally {
  await browser.close();
}
