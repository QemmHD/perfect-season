import { createRequire } from 'node:module';
const require = createRequire('/home/user/ps-studio/package.json');
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/packs-promos';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
async function run(sport, date, fn) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.route('**/*', (r) => (['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
  if (date) await context.clock.setSystemTime(new Date(date));
  const page = await context.newPage();
  const url = 'http://localhost:5204/?' + new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (sport) => {
    const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
    const { getPool } = await import('/src/ut/pool.ts');
    const { openPack } = await import('/src/ut/packs.ts');
    const { autoBuild } = await import('/src/ut/squad.ts');
    const { freshUt } = await import('/src/ut/state.ts');
    const pool = await getPool(); const p = freshProfile();
    p.name = 'Audit'; p.coins = 60000; p.firstRun = false; p.gifts = ['testers-2026-10', 'new-era-2026']; p.settings.sound = false; p.settings.haptics = false;
    const cards = openPack(pool, 'starter', 'audit');
    const owned = cards.map((rc, i) => ({ uid: 'audit-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
    p.ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1, packs: [], content: { era: { eligible: false } } };
    localStorage.setItem('perfect-season:fav:asked', '1');
    saveProfile(p);
  }, sport);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.uh-squad').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  await fn(page);
  await context.close();
}
const tab = (page, label) => page.locator('.ut-tabs button').filter({ hasText: new RegExp('^' + label + '[0-9]*$') }).click();
await run('soccer', '2026-11-12T17:00:00Z', async (page) => {
  await tab(page, 'CHALLENGES');
  await page.waitForTimeout(800);
  const el = page.locator('.page').first();
  for (let i = 0; i < 4; i++) { await el.evaluate((e, y) => (e.scrollTop = y), i * 600); await page.waitForTimeout(250); await page.screenshot({ path: OUT + '/soccer-390-sbc-' + i + '.png' }); }
});
await run('nba', null, async (page) => {
  await tab(page, 'STORE');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'WEEKLY STANDOUTS' }).first().click();
  await page.waitForTimeout(900);
  const el = page.locator('.page').first();
  for (let i = 0; i < 3; i++) { await el.evaluate((e, y) => (e.scrollTop = y), i * 650); await page.waitForTimeout(250); await page.screenshot({ path: OUT + '/nba-390-standouts-' + i + '.png' }); }
});
await browser.close();
console.log('ok');
