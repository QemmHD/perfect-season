// In-game HUD vs the Dynamic Island: the played games read env() directly, so give .arcade-full the
// simulated insets and capture a UT match in each sport a few seconds in.
import { launch, fixture, settle, shot } from './lib.mjs';
const browser = await launch();
try {
  for (const [sport, dev] of [['nba', '393'], ['nfl', '393'], ['soccer', '393'], ['nba', '320']]) {
    const { page, context } = await fixture(browser, sport, dev);
    const [t, , b] = dev === '320' ? [20, 0, 0] : [59, 0, 34];
    await page.addStyleTag({ content: `.arcade-full{--sat:${t}px!important;--sab:${b}px!important}` }).catch(() => {});
    await page.locator('.home .playbar').waitFor({ timeout: 60000 });
    await page.evaluate(([t, b]) => { const s = document.createElement('style'); s.textContent = `.arcade-full{--sat:${t}px!important;--sab:${b}px!important}`; document.head.append(s); }, [t, b]);
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
    await page.locator('.ut-tabs button').filter({ hasText: 'PLAY' }).first().click(); await settle(page, 800);
    await page.locator('.play-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click(); await settle(page, 1000);
    await page.getByRole('button', { name: /^Rung 1:/ }).click();
    await page.waitForTimeout(1500);
    const go = page.getByRole('button', { name: /^PLAY/ }).last(); if (await go.isVisible().catch(() => false)) await go.click();
    await page.waitForTimeout(800); await shot(page, `ingame-${sport}-${dev}-0-load`);
    await page.waitForTimeout(7000); await shot(page, `ingame-${sport}-${dev}-1`);
    const g = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { bug: r('.hg2-bug'), quit: r('.arcade-full button[aria-label*="ause" i], .arcade-full button[aria-label*="uit" i]'), btns: [...document.querySelectorAll('.arcade-full button')].map((b) => { const q = b.getBoundingClientRect(); return (b.getAttribute('aria-label') || b.innerText).slice(0, 18) + '@' + Math.round(q.left) + ',' + Math.round(q.top) + ' ' + Math.round(q.width) + 'x' + Math.round(q.height); }) }; });
    console.log(sport, dev, JSON.stringify(g));
    await context.close();
  }
} finally { await browser.close(); }
