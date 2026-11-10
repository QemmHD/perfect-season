// AUDIT ONLY: precise JS heap (CDP, after GC) at Home, after opening UT, and during an arcade match (prod build).
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
async function dismiss(page) { for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); const d = page.locator('[role=dialog]').last(); if (!(await d.isVisible().catch(() => false))) { if (i > 3) return; continue; } await d.locator('button').last().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape')); } }
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const sport of ['nba', 'nfl', 'soccer']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return +(h.usedSize / 1048576).toFixed(1); };
    await page.goto(`http://localhost:5206/?sport=${sport}&ns=inspect&relay=ws://localhost:7777`);
    await page.locator('input').first().fill('Audit');
    await page.getByRole('button', { name: /NEXT/ }).click();
    await page.getByRole('button', { name: /Skip for now/ }).click();
    await page.locator('nav.tabs').waitFor();
    await dismiss(page);
    await page.waitForTimeout(2000);
    const home = await heap();
    await page.locator('.tab-ut').click();
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
    await page.waitForTimeout(3000);
    const ut = await heap();
    let match = null;
    if (sport !== 'soccer') {
      await page.goto(`http://localhost:5206/?arcade&auto&sport=${sport}&seed=heap&ns=inspect&relay=ws://localhost:7777`);
      await page.waitForSelector('canvas');
      await page.waitForTimeout(25000);
      match = await heap();
    }
    console.log(sport, JSON.stringify({ homeMB: home, afterUtMB: ut, arcadeMatchMB: match }));
    await ctx.close();
  }
  await browser.close();
})();
