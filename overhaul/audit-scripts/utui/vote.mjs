// Does the solo "SIM OR PLAY?" countdown run out and start the match by itself?
import { launch, fixture, settle, shot } from './lib.mjs';
const browser = await launch();
try {
  for (const motion of ['no-preference', 'reduce']) {
    const { page, context } = await fixture(browser, 'nba', '393', { motion });
    await page.locator('.home .playbar').waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
    await page.locator('.ut-tabs button').filter({ hasText: 'PLAY' }).first().click(); await settle(page, 800);
    await page.locator('.play-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click(); await settle(page, 1000);
    await page.getByRole('button', { name: /^Rung 1:/ }).click();
    const t0 = Date.now(); const seen = [];
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(500);
      const s = await page.evaluate(() => ({ vote: !!document.querySelector('.screen.vote'), ring: document.querySelector('.screen.vote')?.innerText.match(/(\d+)\s*SECONDS/)?.[1] ?? null, game: !!document.querySelector('.arcade-full, .hg2'), phase: document.querySelector('.screen.vote')?.className }));
      seen.push(((Date.now() - t0) / 1000).toFixed(1) + 's:' + (s.game ? 'GAME' : s.vote ? 'vote ' + s.ring + ' ' + s.phase : 'other'));
      if (s.game) break;
    }
    console.log(motion, seen.join(' | '));
    await shot(page, 'vote-timer-' + motion);
    await context.close();
  }
} finally { await browser.close(); }
