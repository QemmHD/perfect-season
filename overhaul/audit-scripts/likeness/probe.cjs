const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const SH = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://localhost:5206/?sport=' + (process.argv[2] || 'nba') + '&ns=inspect&relay=ws://localhost:7777');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: SH + 'probe-' + (process.argv[2] || 'nba') + '.png' });
  const t = await page.evaluate(() => [...document.querySelectorAll('button, [role=button], input')].filter(e => e.offsetParent).map(e => (e.tagName + ':' + (e.getAttribute('aria-label') || e.innerText || e.placeholder || '')).slice(0, 60)).join(' | '));
  console.log(t);
  console.log(await page.evaluate(() => document.body.className + ' / ' + [...document.body.querySelectorAll('[class]')].slice(0,30).map(e=>e.className).join(',')));
  await browser.close();
})();
