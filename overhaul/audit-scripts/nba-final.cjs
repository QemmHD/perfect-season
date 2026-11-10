// AUDIT ONLY: autoplay a lab game at 4x to the final screen; capture replays and the end. localhost only.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const SHOTS = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nba';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto('http://localhost:5201/?arcade&auto&slowmo=4&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=final2', { waitUntil: 'domcontentloaded' });
  let replays = 0, pops = new Set(), shots = 0;
  for (let i = 0; i < 400; i++) {
    const st = await page.evaluate(() => ({ final: !!document.querySelector('.hg2-final'), replay: !!document.querySelector('.replay-banner'), pop: document.querySelector('.hg2-pop')?.textContent ?? '' }));
    if (st.pop) pops.add(st.pop);
    if (st.replay && replays < 2) { replays++; await page.screenshot({ path: SHOTS + '/390-16-replay-' + replays + '.png' }); }
    if (st.pop && /SLAM|ALLEY|POSTER|SPLASH/.test(st.pop) && shots < 2) { shots++; await page.screenshot({ path: SHOTS + '/390-17-highlight-' + shots + '.png' }); }
    if (st.final) break;
    await wait(250);
  }
  await wait(600);
  await page.screenshot({ path: SHOTS + '/390-18-final.png' });
  const prog = await page.$eval('[data-progress]', (e) => e.getAttribute('data-progress')).catch(() => null);
  console.log('wall s', (Date.now() - t0) / 1000, 'pops', [...pops].join(' | '), 'progress', prog);
  await browser.close();
})();
