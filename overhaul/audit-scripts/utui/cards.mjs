// Card attractiveness: every edition filter in Club → Collection, one screenshot each (430 wide), plus a zoomed card.
import { launch, fixture, settle, shot } from './lib.mjs';
const [sport = 'nba'] = process.argv.slice(2);
const browser = await launch();
try {
  const { page, context } = await fixture(browser, sport, '430');
  await page.locator('.home .playbar').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
  await page.locator('.ut-tabs button').filter({ hasText: 'CLUB' }).first().click(); await settle(page, 600);
  await page.locator('.ut-segs [role=tab]').filter({ hasText: /^COLLECTION/ }).click(); await settle(page, 1200);
  const chips = await page.locator('[aria-label="Gallery tier"] button').allInnerTexts().catch(() => []);
  console.log('chips', chips);
  const labels = [...new Set(chips.map((c) => c.trim()).filter((c) => c && !/^(ALL|OWNED|MISSING)$/.test(c)))];
  let i = 0;
  for (const l of labels.slice(0, 14)) {
    try {
      await page.getByRole('button', { name: l, exact: true }).first().click({ timeout: 4000 });
      await settle(page, 1500);
      // scroll the grid into view
      await page.evaluate(() => { const g = document.querySelector('.ut-grid'); g?.scrollIntoView({ block: 'start' }); });
      await settle(page, 900);
      await shot(page, `cards-${sport}-${String(++i).padStart(2, '0')}-${l.replace(/[^A-Za-z0-9]+/g, '_')}`);
    } catch (e) { console.log('chip fail', l, e.message.split('\n')[0]); }
  }
  await context.close();
} finally { await browser.close(); }
