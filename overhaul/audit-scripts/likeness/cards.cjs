// AUDIT ONLY (production preview 5206, isolated): fresh profile -> UT -> starter pack reveal ->
// club grid -> card detail, screenshots at 390/430/320, to judge the player art on cards.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const SH = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/';
const wait = (p, ms) => p.waitForTimeout(ms);
async function dismiss(page) {
  for (let i = 0; i < 12; i++) {
    await wait(page, 500);
    const d = page.locator('[role=dialog]').last();
    if (!(await d.isVisible().catch(() => false))) { if (i > 3) return; continue; }
    await d.locator('button').last().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));
  }
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const sport = process.argv[2] || 'nba';
  for (const [w, h] of (process.argv[3] === 'one' ? [[390, 844]] : [[390, 844], [430, 932], [320, 568]])) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(`http://localhost:5206/?sport=${sport}&ns=inspect&relay=ws://localhost:7777`);
    await page.locator('input').first().fill('Audit');
    await page.getByRole('button', { name: /NEXT/ }).click();
    await page.getByRole('button', { name: /Skip for now/ }).click();
    await page.locator('nav.tabs').waitFor();
    await dismiss(page);
    await page.locator('.tab-ut').click();
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
    await dismiss(page);
    await await page.screenshot({ path: SH + 'cards-dbg.png' }); await page.getByText(/starter pack/i).first().click();
    const t0 = Date.now();
    for (let i = 0; i < 8; i++) {
      await wait(page, 900);
      await page.screenshot({ path: SH + `cards-${sport}-${w}-reveal-${i}.png` });
      // tap through the reveal
      await page.mouse.click(w / 2, h * 0.55).catch(() => {});
    }
    // skip/finish buttons
    for (let i = 0; i < 10; i++) {
      const b = page.getByRole('button', { name: /SKIP|DONE|CONTINUE|SEND ALL|KEEP ALL|TO MY CLUB|CLUB|OK/i }).last();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await wait(page, 900); } else break;
    }
    await dismiss(page);
    await page.screenshot({ path: SH + `cards-${sport}-${w}-after-pack.png` });
    // the club grid
    await page.getByRole('button', { name: /^CLUB/ }).last().click().catch(() => {});
    await wait(page, 2500);
    await page.screenshot({ path: SH + `cards-${sport}-${w}-club.png` });
    // a card detail (the first card)
    const card = page.locator('.utc').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click().catch(() => {});
      await wait(page, 1500);
      await page.screenshot({ path: SH + `cards-${sport}-${w}-detail.png` });
      const box = await page.locator('.utc.big .utc-px, .utc .utc-px').first().boundingBox().catch(() => null);
      const cbox = await page.locator('.utc.big').first().boundingBox().catch(() => null);
      console.log(sport, w, 'detail card box', JSON.stringify(cbox), 'player art box', JSON.stringify(box));
    }
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.utc')].slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); const px = e.querySelector('.utc-px'); const p = px ? px.getBoundingClientRect() : null; return [Math.round(r.width), p ? Math.round(p.height) : 0]; }));
    console.log(sport, w, 'card widths / art heights (css px)', JSON.stringify(sizes.slice(0, 20)));
    await ctx.close();
  }
  await browser.close();
})();
