// Autoplay a lab game to the final whistle (audit nba-final, ported by Claude 2026-11-16): the
// banners seen on the way, two replays and two highlights captured, the final screen, the progress
// it reports and the wall time.
//   node scripts/audit/nba-final.mjs [size] [slowmo]
import { context, launch, needServer, report, shot, url, wait } from './nba-lib.mjs';

const size = process.argv[2] ?? '393';
const slowmo = process.argv[3] ?? '4';
await needServer();
const browser = await launch();
try {
  const { page, errors } = await context(browser, size);
  const t0 = Date.now();
  await page.goto(url({ arcade: '', auto: '', slowmo, seed: 'final2' }), { waitUntil: 'domcontentloaded' });
  let replays = 0;
  let highlights = 0;
  const pops = new Set();
  let final = false;
  for (let i = 0; i < 1200 && !final; i++) {
    const st = await page.evaluate(() => ({ final: !!document.querySelector('.hg2-final'), replay: !!document.querySelector('.replay-banner'), pop: document.querySelector('.hg2-pop')?.textContent ?? '' }));
    if (st.pop) pops.add(st.pop);
    if (st.replay && replays < 2) await shot(page, `${size}-final-replay-${++replays}`);
    if (st.pop && /SLAM|ALLEY|POSTER|SPLASH/.test(st.pop) && highlights < 2) await shot(page, `${size}-final-highlight-${++highlights}`);
    final = st.final;
    if (!final) await wait(250);
  }
  await wait(600);
  await shot(page, `${size}-final`);
  const progress = await page.$eval('[data-progress]', (e) => JSON.parse(e.getAttribute('data-progress') || 'null')).catch(() => null);
  report('nba-final', { size, slowmo: +slowmo, final, wallS: (Date.now() - t0) / 1000, banners: [...pops], score: progress?.score, ends: progress?.ends, errors });
} finally {
  await browser.close();
}
