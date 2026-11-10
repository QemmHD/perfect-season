// Audit screenshots of the Store, odds sheets, pack opening, Scout Market and Live Calendar surfaces.
// Isolated: localhost dev server on 5204, ?ns=inspect&relay=ws://localhost:7777, every non-localhost
// request aborted. Never opens a Spotlight/registry pack.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/home/user/ps-studio/package.json');
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/packs-promos';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5204/';
const blocked = [];
const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function ctxFor(w, h, date) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    blocked.push(u.hostname);
    return route.abort();
  });
  if (date) await context.clock.setSystemTime(new Date(date));
  return context;
}

async function seed(page, sport, extra = {}) {
  const url = new URL(BASE);
  url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    async ({ sport, extra }) => {
      const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
      const { getPool } = await import('/src/ut/pool.ts');
      const { openPack } = await import('/src/ut/packs.ts');
      const { autoBuild } = await import('/src/ut/squad.ts');
      const { freshUt } = await import('/src/ut/state.ts');
      const pool = await getPool();
      const p = freshProfile();
      p.name = 'Audit';
      p.coins = 60000;
      p.firstRun = false;
      p.gifts = ['testers-2026-10', 'new-era-2026'];
      p.settings.sound = false;
      p.settings.haptics = false;
      p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      const cards = openPack(pool, 'starter', 'audit').filter((c, i, l) => l.findIndex((x) => x.line.id === c.line.id) === i);
      const owned = cards.map((rc, i) => ({ uid: 'audit-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
      p.ut = {
        ...freshUt(),
        owned,
        squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))),
        starterClaimed: true,
        packsOpened: 1,
        packs: extra.packs ?? [
          { id: 'audit-gold', kind: 'gold', at: 2 },
          { id: 'audit-standout', kind: 'standout', at: 3 },
        ],
        content: { era: { eligible: false } },
      };
      localStorage.setItem('perfect-season:fav:asked', '1');
      saveProfile(p);
    },
    { sport, extra }
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.uh-squad').waitFor({ timeout: 60000 });
  await page.waitForTimeout(600);
}

const tab = (page, label) => page.locator('.ut-tabs button').filter({ hasText: new RegExp('^' + label + '[0-9]*$') }).click();
async function scrollShots(page, sel, name, max = 6) {
  const el = page.locator(sel).first();
  const h = await el.evaluate((e) => e.scrollHeight).catch(() => 0);
  const vh = await el.evaluate((e) => e.clientHeight).catch(() => 0);
  let i = 0;
  for (let y = 0; i < max; y += Math.max(200, vh - 120), i++) {
    await el.evaluate((e, y) => (e.scrollTop = y), y).catch(() => {});
    await page.waitForTimeout(250);
    await page.screenshot({ path: OUT + '/' + name + '-' + i + '.png' });
    if (y + vh >= h) break;
  }
  await el.evaluate((e) => (e.scrollTop = 0)).catch(() => {});
}

async function storeRun(sport, w, h, date, tag) {
  const context = await ctxFor(w, h, date);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, sport);
  await page.screenshot({ path: OUT + '/' + tag + '-ut-home.png' });
  await scrollShots(page, '.page', tag + '-ut-home-scroll', 4);
  await tab(page, 'STORE');
  await page.waitForTimeout(800);
  await scrollShots(page, '.page.ut-store', tag + '-store', 9);
  await context.close();
  return errors;
}

const errs = {};
// 1) Store on three phone sizes, today (2026-11-09)
errs.nba390 = await storeRun('nba', 390, 844, null, 'nba-390');
errs.nba430 = await storeRun('nba', 430, 932, null, 'nba-430');
errs.nba320 = await storeRun('nba', 320, 568, null, 'nba-320');
errs.nfl390 = await storeRun('nfl', 390, 844, null, 'nfl-390');
errs.soccer390 = await storeRun('soccer', 390, 844, null, 'soccer-390');
// 2) Live Calendar live: First Tip (Nov 14) and Hot Season Honors (Jan 16)
errs.nbaFirstTip = await storeRun('nba', 390, 844, '2026-11-14T17:00:00Z', 'nba-390-firsttip');
errs.nbaHonors = await storeRun('nba', 390, 844, '2027-01-16T17:00:00Z', 'nba-390-honors');

// 3) Odds sheets, Scout Market, Standout pack opening (cinema, not reduced)
{
  const context = await ctxFor(390, 844, null);
  const page = await context.newPage();
  page.on('pageerror', (e) => (errs.odds ??= []).push(e.message));
  await seed(page, 'nba');
  await tab(page, 'STORE');
  await page.waitForTimeout(600);
  for (const name of ['Premium Gold', 'Elite Gold', 'Standout Guarantee', 'Gold Pack', 'Spotlight Pack', "Scout's Choice", 'Daily Drop'].filter(Boolean)) {
    const b = page.getByRole('button', { name: name + ' odds', exact: true });
    if (!(await b.count())) continue;
    await b.first().scrollIntoViewIfNeeded();
    await b.first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: OUT + '/nba-390-odds-' + name.replace(/\W+/g, '-').toLowerCase() + '.png' });
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole('tab', { name: /^SCOUT MARKET/ }).click();
  await page.waitForTimeout(600);
  await scrollShots(page, '.page.ut-store', 'nba-390-market', 3);
  await page.getByRole('tab', { name: /^PACKS/ }).click();
  await page.waitForTimeout(400);
  // open the earned Standout Guarantee: the full cinema, frames over time
  const mine = page.getByRole('button', { name: /Open your Standout Guarantee/ });
  await mine.click();
  await page.locator('.ut-open-screen').waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/nba-390-open-0-pack.png' });
  await page.locator('.ut-cinema-open').click();
  const t0 = Date.now();
  for (const ms of [400, 1200, 2000, 2800, 3600, 4600]) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
    await page.screenshot({ path: OUT + '/nba-390-open-1-walk-' + ms + '.png' });
  }
  const next = page.locator('.ut-cinema-next');
  if (await next.isVisible().catch(() => false)) await next.click();
  await page.waitForTimeout(2600);
  await page.screenshot({ path: OUT + '/nba-390-open-2-reveal.png' });
  await context.close();
}
// 4) a Premium pack bought from the Store (buy flow + confirm)
{
  const context = await ctxFor(390, 844, null);
  const page = await context.newPage();
  page.on('pageerror', (e) => (errs.buy ??= []).push(e.message));
  await seed(page, 'nfl');
  await tab(page, 'STORE');
  await page.waitForTimeout(600);
  const buy = page.getByRole('button', { name: /^Buy Premium Gold for/ });
  await buy.scrollIntoViewIfNeeded();
  await buy.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/nfl-390-buy-premium-0.png' });
  const seal = page.locator('.ut-cinema-open');
  if (await seal.isVisible().catch(() => false)) {
    await seal.click();
    await page.waitForTimeout(3200);
    await page.screenshot({ path: OUT + '/nfl-390-buy-premium-1.png' });
    for (let k = 0; k < 6; k++) {
      const skip = page.getByRole('button', { name: 'SKIP', exact: true });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      const n2 = page.locator('.ut-cinema-next');
      if (await n2.isVisible().catch(() => false)) await n2.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: OUT + '/nfl-390-buy-premium-2-reveal.png' });
  }
  await context.close();
}
fs.writeFileSync(OUT + '/errors.json', JSON.stringify({ errs, blocked: [...new Set(blocked)] }, null, 1));
console.log(JSON.stringify({ errs, blocked: [...new Set(blocked)] }));
await browser.close();
