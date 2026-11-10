// Ranks / Rivals board while the relay is unreachable: does loading ever resolve?
import { launch, fixture, settle, shot } from './lib.mjs';
const browser = await launch();
try {
  const { page, context } = await fixture(browser, 'nba', '393');
  await page.locator('.home .playbar').waitFor({ timeout: 60000 });
  await page.locator('nav.tabs button').filter({ hasText: /RANKS/ }).click();
  for (const t of [1, 6, 15]) { await page.waitForTimeout(t === 1 ? 1000 : (t === 6 ? 5000 : 9000)); await shot(page, 'ranks-offline-' + t + 's'); console.log(t + 's', (await page.locator('.shell-views').innerText()).slice(0, 300).replace(/\s+/g, ' ')); }
  await context.close();
} finally { await browser.close(); }
