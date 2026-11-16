// Claude (packs-2, 2026-11-16): isolated localhost QA for the packs-2 rewards (docs/studio-overhaul/
// packs.md). Every request whose host isn't localhost (or the font CDN) is aborted, the page runs in the
// `inspect` namespace against a local relay, and the save is a local fixture: nothing reaches a live
// service. In the page it awards a Player Pick 84+ (awardPick 'pick-84', as ut's 25-hour milestone does)
// and rolls a Scout Drop 1 (rollDrop, as ut's drop screen does), depositing its pack as a pending
// `scout-drop:` pack and a drop-2 stamp outcome through grantStamps. Then it opens both from the Store
// like a player, shoots each step and checks the kept card, the pack and the Pack Tracker's log.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-picks.mjs nba 393
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const base = process.env.PS_QA_URL || 'http://localhost:5213/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
const out = process.env.OUT || '/tmp/packs-qa';
fs.mkdirSync(out, { recursive: true });
const [sport = 'nba', width = '393', motion = 'reduce'] = process.argv.slice(2);
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const url = new URL(base);
url.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
await page.goto(url.href, { waitUntil: 'domcontentloaded' });
const fixture = await page.evaluate(async (sport) => {
  const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
  const { getPool } = await import('/src/ut/pool.ts');
  const { openPack } = await import('/src/ut/packs.ts');
  const { autoBuild } = await import('/src/ut/squad.ts');
  const { freshUt } = await import('/src/ut/state.ts');
  const { awardPick } = await import('/src/ut/content-packs.ts');
  const { rollDrop, dropOdds } = await import('/src/ut/drop-tables.ts');
  const { grantStamps, stampsBalance } = await import('/src/ut/scout-stamps.ts');
  const pool = await getPool();
  const p = freshProfile();
  p.name = 'Packs QA';
  p.coins = 10000;
  p.firstRun = false;
  p.gifts = ['testers-2026-10'];
  p.settings.sound = false;
  p.settings.haptics = false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  p.rewardDay = day;
  const cards = openPack(pool, 'starter', 'qa');
  const owned = cards.map((rc, i) => ({ uid: 'packs-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
  let ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1 };
  const at = Date.now();
  // ut's 25-hour MINUTES milestone
  ut = awardPick(ut, pool, 'pick-84', 'minutes:life:25h', at);
  const repeatNoOp = awardPick(ut, pool, 'pick-84', 'minutes:life:25h', at) === ut;
  // Scout Drop 1 (the Scout Reveal) and a drop 2: ut's seed shape, packs' tables
  const seed = (i) => 'scout-drop:qa-player:' + sport + ':' + day + ':' + i;
  const d1 = rollDrop(seed(1), sport, 1);
  ut = { ...ut, packs: [...ut.packs, { id: 'scout-drop:' + sport + ':' + day + ':1', kind: d1.reward.pack, at }] };
  let k = 0;
  let d2 = rollDrop(seed(2) + ':' + k, sport, 2);
  while (!d2.reward.stamps && k < 500) d2 = rollDrop(seed(2) + ':' + ++k, sport, 2);
  ut = grantStamps(ut, d2.reward.stamps, 'drop', day + ':2');
  p.ut = ut;
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  const pick = ut.content.picks[0];
  return {
    pick: pick.title + ' → ' + pick.options.map((id) => pool.base.get(id).line.name + ' ' + pool.base.get(id).ovr + ' ' + pool.base.get(id).tier).join(', '),
    repeatNoOp,
    drop1: d1,
    drop1Odds: dropOdds(sport, 1),
    drop2: d2,
    stamps: stampsBalance(ut),
  };
}, sport);
console.log('fixture:', JSON.stringify(fixture));
await page.reload({ waitUntil: 'domcontentloaded' });

const shot = (name) => page.screenshot({ path: path.join(out, sport + '-' + width + '-' + name + '.png'), animations: 'disabled' });
const settle = (ms = 500) => page.waitForTimeout(ms);
/** Through an opening like a player: break the seal, continue past the walkout, skip, then shoot the
 * revealed cards and press DONE. */
async function finishOpening(name) {
  const screen = page.locator('.ut-open-screen');
  await screen.waitFor({ timeout: 10000 });
  for (let i = 0; i < 40; i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.count()) {
      await settle(motion === 'reduce' ? 300 : 900);
      await shot(name + '-cards');
      console.log(name + ' revealed:', (await page.locator('.ut-open-screen [aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter((t) => /\d/.test(t)).slice(0, 12))).join(' | '));
      await done.click();
      await settle();
      return;
    }
    const next = page.locator('.ut-cinema-open, .ut-cinema-next, .ut-skip').first();
    if (await next.count()) await next.click().catch(() => {});
    else await settle(300);
    if (i === 1) await shot(name + '-cinema');
    await settle(motion === 'reduce' ? 250 : 700);
  }
  throw Error(name + ': the opening never finished');
}

const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();
await page.locator('.ut-tabs button').filter({ hasText: /^STORE[0-9]*$/ }).click();
const pickTile = page.getByRole('button', { name: /Choose your player: Player Pick/ });
await pickTile.waitFor({ timeout: 20000 });
await settle();
await shot('store-mine');
console.log('your packs:', (await page.locator('.ut-mine-pack b').allInnerTexts()).join(' | '));
// the tile target size in design px (the stage scales 390 to the phone)
const k = await page.evaluate(() => {
  const s = document.querySelector('.stage');
  return s ? s.getBoundingClientRect().width / s.offsetWidth : 1;
});
const box = await pickTile.boundingBox();
console.log('pick tile:', Math.round(box.width / k) + 'x' + Math.round(box.height / k));

// the Player Pick 84+: flip, choose, keep
await pickTile.click();
await page.locator('.ut-pick-screen').waitFor();
await settle();
await shot('pick84-facedown');
console.log('pick heading:', await page.locator('.ut-pick-screen h2').innerText());
const reveal = page.locator('.ut-pick-btns .btn.primary');
if (await reveal.count()) await reveal.click();
await settle(motion === 'reduce' ? 400 : 1800);
await page.locator('.ut-pick-card').nth(1).click();
await settle();
await shot('pick84-chosen');
await page.locator('.ut-pick-btns .btn.gold').click();
await finishOpening('pick84');

// the Scout Drop's pack: an ordinary pending pack
const dropTile = page.getByRole('button', { name: /^Open your / }).first();
await dropTile.waitFor({ timeout: 10000 });
console.log('drop pack tile:', await dropTile.getAttribute('aria-label'));
await dropTile.click();
await finishOpening('drop-pack');

const after = await page.evaluate(async () => {
  const { loadProfile } = await import('/src/lib/profile.ts');
  const { stampsBalance } = await import('/src/ut/scout-stamps.ts');
  const p = loadProfile();
  const log = p.ut.content?.pulls;
  return {
    owned: p.ut.owned.length,
    pickKept: p.ut.owned.filter((o) => o.uid === 'pick:minutes:life:25h').map((o) => o.cardId),
    picksLeft: (p.ut.content?.picks ?? []).length,
    pending: p.ut.packs.map((x) => x.id),
    logged: (log?.r ?? []).map((e) => e.k + '/' + e.s + '/' + e.n),
    stamps: stampsBalance(p.ut),
  };
});
console.log('after:', JSON.stringify(after));
console.log('errors:', errors.length ? errors : 'none', 'blocked hosts:', [...new Set(blocked)].join(',') || 'none');
await browser.close();
