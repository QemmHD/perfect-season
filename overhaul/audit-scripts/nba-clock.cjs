// AUDIT ONLY: does the HUD shot clock tick while nobody touches anything? localhost only.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await context.newPage();
  await page.goto('http://localhost:5201/?arcade&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=clock', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /\d/.test(document.querySelector('.hg2-bug .mid em')?.textContent || ''), null, { timeout: 30000 });
  const out = [];
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    out.push(((Date.now() - t0) / 1000).toFixed(1) + 's:' + (await page.$eval('.hg2-bug .mid em', (e) => e.textContent + (e.classList.contains('low') ? '(low)' : ''))) + ' ' + (await page.$eval('.hg2-bug .mid small', (e) => e.textContent)) + ' pop=' + (await page.$eval('.hg2', (e) => e.querySelector('.hg2-pop')?.textContent ?? '')));
    await wait(500);
  }
  console.log(out.join('\n'));
  await page.screenshot({ path: '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nba/390-15-idle-possession.png' });
  await browser.close();
})();
