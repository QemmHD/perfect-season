// Audit (read-only): the shootout's "their kick" screen (dive buttons) at 390x844.
const { createRequire } = require('node:module');
const { chromium } = createRequire('/home/user/ps-studio/package.json')('playwright');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/soccer/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  await page.goto('http://localhost:5203/?soccer-lab=1&qa=1&pens=1&seed=aud-pens&ns=inspect&relay=ws://localhost:7777', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: '.arcade-full{--sat:59px!important;--sab:34px!important}' });
  await page.waitForSelector('.sc2-go', { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.click('.sc2-go');
  await page.waitForTimeout(600);
  const s = await page.locator('.hg2-shoot').boundingBox();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(620);
  await page.mouse.up();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if (await page.locator('.sc2-go').count()) break;
  }
  await page.screenshot({ path: OUT + '390x844-24-pens-their-intro.png' });
  await page.click('.sc2-go');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '390x844-25-pens-dive.png' });
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.sc2-dive button')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
  console.log('dive buttons', JSON.stringify(boxes));
  await b.close();
})();
