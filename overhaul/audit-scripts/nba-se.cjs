// AUDIT ONLY: iPhone SE 2/3 (375x667) tip-off frame. localhost only.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await context.newPage();
  await page.goto('http://localhost:5201/?arcade&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=audit390', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /\d/.test(document.querySelector('.hg2-bug .mid em')?.textContent || ''), null, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nba/375x667-01-tipoff.png' });
  const boxes = await page.evaluate(() => Object.fromEntries(['.hg2-skills', '.play-readout-toggle', '.hg2-pass', '.hg2-coach', '.hg2-hint'].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return [s, r && [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]]; })));
  console.log(JSON.stringify(boxes));
  await browser.close();
})();
