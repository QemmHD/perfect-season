// AUDIT ONLY: slow-motion (0.25x) burst captures of the autopilot match in the production lab, to see
// key actions as they actually play (hard cuts, stale frames, foot plants). Frames at ~8 per real second.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const SH = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/burst/';
require('fs').mkdirSync(SH, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const sport of ['nba', 'nfl']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    await page.goto(`http://localhost:5206/?arcade&auto&sport=${sport}&seed=burst&slowmo=0.25&ns=inspect&relay=ws://localhost:7777`);
    await page.waitForSelector('canvas');
    await page.waitForTimeout(sport === 'nba' ? 9000 : 14000);
    for (let i = 0; i < 64; i++) {
      await page.screenshot({ path: SH + `${sport}-${String(i).padStart(2, '0')}.png`, clip: { x: 0, y: sport === 'nba' ? 300 : 380, width: 390, height: 460 } });
      await page.waitForTimeout(110);
    }
    await ctx.close();
  }
  await browser.close();
})();
