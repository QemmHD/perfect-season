// A brand-new player: first launch → name → teams → Home coach → UT starter pack (motion on).
import { launch, fixture, settle, shot } from './lib.mjs';
const [sport = 'nba', dev = '393'] = process.argv.slice(2);
const browser = await launch();
const P = `first-${sport}-${dev}`;
try {
  const { page, context, errors } = await fixture(browser, sport, dev, { fresh: true, motion: 'no-preference' });
  await page.waitForTimeout(3500);
  await shot(page, P + '-01-launch');
  const clickText = async (re) => { const b = page.getByRole('button', { name: re }).first(); if (await b.isVisible().catch(() => false)) { await b.click(); return true; } return false; };
  // name step
  await clickText(/CONTINUE|NEXT|LET'S GO|GO/i); await settle(page, 900);
  await shot(page, P + '-02-after-name');
  await clickText(/SKIP|LATER|NOT NOW/i); await settle(page, 1500);
  await shot(page, P + '-03-after-teams');
  for (let i = 0; i < 5; i++) {
    const dlg = page.locator('[role=dialog]').last();
    if (!(await dlg.count())) break;
    await shot(page, P + '-04-dialog-' + i);
    const b = dlg.getByRole('button').filter({ hasText: /COLLECT|GOT IT|NEXT|CONTINUE|OK|DONE|LET.S GO|SKIP/ }).first();
    if (await b.isVisible().catch(() => false)) await b.click(); else await page.keyboard.press('Escape');
    await settle(page, 900);
  }
  await shot(page, P + '-04b-home');
  // what does the main tab bar tell a new player about UT?
  const tabs = await page.locator('nav.tabs').innerText().catch(() => '');
  console.log('tabs:', tabs.replace(/\s+/g, ' '));
  await page.getByRole('button', { name: /Ultimate Team/ }).first().click();
  await page.waitForTimeout(4000);
  await shot(page, P + '-05-ut-first');
  // starter
  await page.locator('.ut-tabs').waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 }).catch(() => {});
  await settle(page, 800); await shot(page, P + '-05b-ut-ready');
  const st = page.getByRole('button', { name: /starter/i }).first();
  if (await st.isVisible().catch(() => false)) await st.click(); else console.log('no starter button');
  for (let t = 0; t < 12; t++) { await page.waitForTimeout(700); await shot(page, P + '-06-starter-' + String(t).padStart(2, '0')); if (t % 3 === 2) await page.mouse.click(Math.round(page.viewportSize().width / 2), Math.round(page.viewportSize().height * 0.45)); }
  for (let i = 0; i < 25 && (await page.locator('.ut-open-screen').count()); i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.isVisible().catch(() => false)) { await shot(page, P + '-07-starter-done'); await done.click(); break; }
    const skip = page.getByRole('button', { name: 'SKIP', exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click(); else await page.mouse.click(30, 300);
    await page.waitForTimeout(500);
  }
  await settle(page, 1500);
  await shot(page, P + '-08-ut-after-starter');
  console.log('errors', errors);
  await context.close();
} finally { await browser.close(); }
