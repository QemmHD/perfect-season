// A real Squad Battles match played by the autopilot (?autoplay, x8 time) to the result + debrief.
import { launch, fixture, settle, shot } from './lib.mjs';
const [sport = 'nba', dev = '393'] = process.argv.slice(2);
const browser = await launch();
try {
  const { page, context, errors } = await fixture(browser, sport, dev);
  const u = new URL(page.url()); u.searchParams.set('autoplay', '1');
  await page.goto(u.href, { waitUntil: 'domcontentloaded' });
  await page.locator('.home .playbar').waitFor({ timeout: 60000 });
  await page.evaluate(async () => {
    const code = await (await fetch('/src/game/Arcade.tsx')).text();
    const reactUrl = code.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
    const React = (await import(reactUrl)).default; const original = React.createElement;
    React.createElement = (type, props, ...children) => { if (['Hoops2', 'Football2', 'Soccer2'].includes(type?.name)) props = { ...props, timeScale: 8 }; return original(type, props, ...children); };
  });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.ut-loading'), null, { timeout: 60000 });
  await page.locator('.ut-tabs button').filter({ hasText: 'PLAY' }).first().click();
  await settle(page, 800);
  await page.locator('.play-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click();
  await settle(page, 1000);
  await page.getByRole('button', { name: /^Rung 1:/ }).click().catch(async () => { await page.getByRole('button', { name: 'PLAY', exact: true }).first().click(); });
  await page.waitForTimeout(1200);
  await shot(page, `match-${sport}-${dev}-01-pre`);
  const go = page.getByRole('button', { name: /^PLAY/ }).last();
  if (await go.isVisible().catch(() => false)) await go.click();
  await page.waitForTimeout(2500);
  await shot(page, `match-${sport}-${dev}-02-vs-or-game`);
  await page.waitForTimeout(6000);
  await shot(page, `match-${sport}-${dev}-03-ingame`);
  await page.locator('.utm-result').waitFor({ timeout: 420000 });
  await page.waitForTimeout(2500);
  await shot(page, `match-${sport}-${dev}-04-result`);
  const sc = await page.evaluateHandle(() => { const l = [...document.querySelectorAll('.stage *')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4; }); return l.sort((a, b) => b.clientHeight - a.clientHeight)[0] || null; });
  const el = sc.asElement();
  if (el) { for (let i = 1; i < 4; i++) { const more = await el.evaluate((e) => { if (e.scrollTop + e.clientHeight >= e.scrollHeight - 4) return false; e.scrollTop += e.clientHeight * 0.85; return true; }); if (!more) break; await settle(page, 400); await shot(page, `match-${sport}-${dev}-05-result-s${i}`); } }
  console.log('result text:', (await page.locator('.utm-result').innerText()).replace(/\s+/g, ' ').slice(0, 900));
  console.log('errors', errors);
  await context.close();
} finally { await browser.close(); }
