// AUDIT ONLY. Is a thumb already on the stick when a possession starts ignored? And the rAF timing
// of the shot meter input vs the 60 Hz step. localhost only.
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
  const cdp = await context.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })) });
  await page.goto('http://localhost:5201/?arcade&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=deadstick', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hg2-stick', { timeout: 30000 });
  const b = await page.locator('.hg2-stick').boundingBox();
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const knob = () => page.$eval('.hg2-stick i', (i) => i.style.transform);
  const clock = () => page.$eval('.hg2-bug .mid em', (e) => e.textContent);
  // thumb down on the stick BEFORE the tip-off (the game shows its pad 700 ms before the first possession)
  await touch('touchStart', [{ x: c.x, y: c.y, id: 1 }]);
  const res = { beforeTip: [] };
  for (let i = 0; i < 10; i++) {
    await touch('touchMove', [{ x: c.x + (i % 2 ? 4 : -4), y: c.y - b.height * 0.45, id: 1 }]);
    await wait(250);
    res.beforeTip.push({ knob: await knob(), clock: await clock() });
  }
  await page.screenshot({ path: SHOTS + '/390-13-held-stick-ignored.png' });
  await touch('touchEnd', []);
  await wait(100);
  await touch('touchStart', [{ x: c.x, y: c.y, id: 2 }]);
  await touch('touchMove', [{ x: c.x + 3, y: c.y - b.height * 0.45, id: 2 }]);
  await wait(300);
  res.afterRepress = { knob: await knob(), clock: await clock() };
  await page.screenshot({ path: SHOTS + '/390-14-repressed-stick-works.png' });
  await touch('touchEnd', []);
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
