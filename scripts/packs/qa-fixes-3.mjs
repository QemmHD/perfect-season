// Claude (packs-3 review fixes, 2026-11-16): isolated localhost QA for the packs-3 review fixes
// (docs/studio-overhaul/packs.md "packs-3 review fixes"). Every request whose host isn't localhost (or the
// font CDN) is aborted, the page runs in the `inspect` namespace against a local relay, the save is a local
// fixture and the clock is fixed (Black Friday 2026-11-27, 18:30 Eastern: the Black Friday Blitz sale is on).
// It checks, like a player:
//   - the Club Collection tiles show their limits ("1 of 1 left today"), at the new floor prices;
//   - buying Captains charges its price, logs the frozen `studio:captains:…` kind, and the tile then reads
//     "Limit reached today" with a disabled BUY;
//   - (NBA/NFL) the flash sale's Scout's Choice at 20% off: the kept card is logged at the sale price.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-fixes-3.mjs nba 393 [reduce|full]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const base = process.env.PS_QA_URL || 'http://localhost:5213/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
const out = process.env.OUT || '/tmp/packs-qa';
fs.mkdirSync(out, { recursive: true });
const [sport = 'nba', width = '393', motion = 'reduce', when = '2026-11-27T23:30:00Z'] = process.argv.slice(2);
const DEV = { 393: { w: 393, h: 852, insets: [59, 0, 34, 0] }, 320: { w: 320, h: 568, insets: [20, 0, 0, 0] } }[width];
const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const { chromium } = require('playwright');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: DEV.w, height: DEV.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
const blocked = [];
await context.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (ALLOWED.includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
  blocked.push(u.hostname);
  return route.abort();
});
await context.addInitScript((ins) => (window.__psInsets = ins), DEV.insets);
const page = await context.newPage();
await page.clock.install({ time: new Date(when) });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = new URL(base);
url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
await page.goto(url.href, { waitUntil: 'domcontentloaded' });
const fixture = await page.evaluate(async (sport) => {
  const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
  const { getPool } = await import('/src/ut/pool.ts');
  const { openPack, packDefs } = await import('/src/ut/packs.ts');
  const { autoBuild } = await import('/src/ut/squad.ts');
  const { freshUt } = await import('/src/ut/state.ts');
  const { flashDeals } = await import('/src/ut/pack-actions.ts');
  const pool = await getPool();
  const p = freshProfile();
  p.name = 'Packs QA';
  p.coins = 30000;
  p.firstRun = false;
  p.gifts = ['testers-2026-10'];
  p.settings.sound = false;
  p.settings.haptics = false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  p.rewardDay = day;
  const cards = openPack(pool, 'starter', 'qa');
  const owned = cards.map((rc, i) => ({ uid: 'packs-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
  p.ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1 };
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  const d = packDefs(sport);
  return { day, prices: { roster: d.roster.price, captains: d.captains.price, dynasty: d.dynasty.price, scout: d.scout.price, standout: d.standout.price }, deals: flashDeals(sport, Date.now()).map((x) => x.kind + ' ' + x.was + '→' + x.price) };
}, sport);
console.log('fixture:', JSON.stringify(fixture));
await page.reload({ waitUntil: 'domcontentloaded' });

const shot = (name) => page.screenshot({ path: path.join(out, sport + '-' + width + '-' + name + '.png'), animations: 'disabled' });
const settle = (ms = 500) => page.waitForTimeout(ms);
const save = () => page.evaluate(async () => {
  const p = (await import('/src/lib/profile.ts')).loadProfile();
  return { coins: p.coins, buys: p.ut.content?.buys ?? {}, logged: (p.ut.content?.pulls?.r ?? []).slice(0, 2).map((e) => e.k + '/' + e.s + '/' + e.c) };
});
const confirmBuy = async () => {
  const buy = page.locator('.ps-confirm-btns .btn.gold');
  if (await buy.count()) await buy.click();
};
const finishOpening = async () => {
  await page.locator('.ut-open-screen').first().waitFor({ timeout: 10000 });
  for (let i = 0; i < 60; i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.count()) {
      await done.click();
      break;
    }
    const next = page.locator('.ut-cinema-open, .ut-cinema-next, .ut-skip').first();
    if (await next.count()) await next.click().catch(() => {});
    await settle(motion === 'reduce' ? 250 : 700);
  }
  await settle(800);
};

const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();
await page.locator('.ut-tabs button').filter({ hasText: /^STORE[0-9]*$/ }).click();
await page.locator('.ut-daily').waitFor({ timeout: 20000 });
await settle(800);

const tile = (k) => page.locator('.ut-shopitem.s-' + k).first();
const club = async () => {
  const r = {};
  for (const k of ['roster', 'captains', 'dynasty']) {
    const t = tile(k);
    if (!(await t.count())) continue;
    r[k] = { note: await t.locator('.ut-limit').innerText().catch(() => '(no limit line)'), price: await t.locator('.ut-buy .num').innerText(), disabled: await t.locator('.ut-buy').getAttribute('aria-disabled') };
  }
  return r;
};
await tile('captains').scrollIntoViewIfNeeded();
await settle();
await shot('club-before');
console.log('club collection before:', JSON.stringify(await club()));

const before = await save();
await tile('captains').locator('.ut-buy').click();
await confirmBuy();
await finishOpening();
const afterCaptains = await save();
console.log('captains paid', before.coins - afterCaptains.coins, 'logged', JSON.stringify(afterCaptains.logged), 'limit keys', JSON.stringify(Object.keys(afterCaptains.buys).filter((k) => k.startsWith('captains'))));
await page.locator('.ut-tabs button').filter({ hasText: /^STORE[0-9]*$/ }).click().catch(() => {});
await settle(600);
await tile('captains').scrollIntoViewIfNeeded();
await settle();
await shot('club-after');
console.log('club collection after:', JSON.stringify(await club()));
// a second tap is refused with the limit toast, nothing charged (aria-disabled: the tap still reaches it)
await tile('captains').locator('.ut-buy').click({ force: true });
await settle(400);
console.log('second tap toast:', (await page.locator('.toast, .ut-toast, [role="status"]').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').slice(0, 160), 'coins unchanged:', (await save()).coins === afterCaptains.coins);

const flash = page.locator('.ut-flash');
if (await flash.count()) {
  const item = flash.locator('.ut-flash-item').filter({ hasText: /Scout/ }).first();
  if (await item.count()) {
    await item.scrollIntoViewIfNeeded();
    await settle();
    await shot('flash-scout');
    console.log('flash scout tile:', (await item.innerText()).replace(/\s+/g, ' '));
    const c0 = (await save()).coins;
    await item.locator('.btn.ut-buy').click();
    await confirmBuy();
    await page.locator('.ut-pick-screen').waitFor({ timeout: 10000 });
    await page.locator('.ut-pick-card').first().click();
    await settle(motion === 'reduce' ? 600 : 2500);
    await page.locator('.ut-pick-card').first().click();
    await settle(400);
    await page.getByRole('button', { name: 'KEEP THIS PLAYER' }).click();
    await settle(1200);
    const s = await save();
    console.log('flash scout paid', c0 - s.coins, 'logged', JSON.stringify(s.logged));
  } else console.log('no Scout deal in this sale');
}
console.log('errors:', errors.length ? errors : 'none', 'blocked hosts:', [...new Set(blocked)].join(',') || 'none');
await browser.close();
