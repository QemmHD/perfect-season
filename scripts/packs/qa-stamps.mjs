// Claude (packs-6, 2026-11-17): isolated localhost QA for the stamp shelf, the Store's STAMPS tile and the
// program-pack guarantee (docs/studio-overhaul/packs.md "packs-6"). Every request whose host isn't
// localhost (or the font CDN) is aborted, the page runs in the `inspect` namespace against a local relay,
// and the save is a local fixture: nothing reaches a live service. The fixture holds 650 Scout Stamps
// (grants) and, in NBA and NFL, ten logged program packs of the live program without a program card, so
// its odds sheet reads "guaranteed within 3 packs". The script opens the Store, the STAMPS tile, the shelf,
// redeems a pick end to end (arm, confirm, reveal, keep) and checks the balance, the claim and the club.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-stamps.mjs nba 393 [reduce|full] [standouts|g82|program]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const base = process.env.PS_QA_URL || 'http://localhost:5213/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
const out = process.env.OUT || '/tmp/packs-qa';
fs.mkdirSync(out, { recursive: true });
const [sport = 'nba', width = '393', motion = 'reduce', item = 'standouts'] = process.argv.slice(2);
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
  const { grantStamps, stampsBalance } = await import('/src/ut/scout-stamps.ts');
  const { livePacksOn, pityState } = await import('/src/ut/live-packs.ts');
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
  for (let i = 0; i < 13; i++) ut = grantStamps(ut, 50, 'other', 'qa-' + i);
  // ten program packs of the live program in a row without a program card (pity: L − 10 left)
  const live = sport === 'soccer' ? null : livePacksOn(day).find((x) => x.tpl === 'program');
  let pity = null;
  if (live) {
    const now = Date.now();
    const r = Array.from({ length: 10 }, (_, i) => ({ id: 'qa-live-' + i, k: live.id, n: 'Program Pack', c: 0, s: 'reward', at: now - 60000 + i, u: 'pack:qa-live-' + i + ':', cs: [[cards[0].line.id, cards[0].ovr, 'gold']] }));
    ut = { ...ut, content: { ...ut.content, pulls: { v: 1, r, a: {}, since: now - 60000, f: 0, l: 0 } } };
    pity = pityState(sport, ut.content.pulls, live.id, day);
  }
  p.ut = ut;
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  return { stamps: stampsBalance(ut), live: live?.id ?? null, pity };
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
const tile = page.locator('.ps-stamps-tile');
await tile.waitFor({ timeout: 20000 });
await settle();
const k = await page.evaluate(() => {
  const s = document.querySelector('.stage');
  return s ? s.getBoundingClientRect().width / s.offsetWidth : 1;
});
const size = async (loc) => {
  const b = await loc.boundingBox();
  return Math.round(b.width / k) + 'x' + Math.round(b.height / k);
};
await tile.scrollIntoViewIfNeeded();
await shot('store-tile');
console.log('stamps tile:', await tile.getAttribute('aria-label'), await size(tile));

// the program pack's odds sheet with this player's guarantee
if (fixture.live) {
  const odds = page.locator('.ut-shopitem.s-live .ut-oddsbtn').first();
  await odds.scrollIntoViewIfNeeded();
  await odds.click();
  const pity = page.locator('.ps-odds-pity');
  await pity.waitFor({ timeout: 10000 });
  await settle();
  await shot('program-odds');
  console.log('program sheet:', (await pity.innerText()).replace(/\n/g, ' / '), '| footer:', await page.locator('.ps-odds-foot small').innerText());
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await settle();
}

await tile.scrollIntoViewIfNeeded();
await tile.click();
await page.locator('.ut-stamps').waitFor({ timeout: 20000 });
await settle(800);
await shot('shelf');
console.log('title:', await page.locator('.ut-top, .topbar, header').first().innerText().catch(() => '?'));
console.log('hero:', (await page.locator('.ps-stamps-hero-txt').innerText()).replace(/\n/g, ' / '));
for (const t of await page.locator('.ps-shelf-tile').all()) {
  const btn = t.locator('.ps-shelf-btn');
  console.log('tile:', (await t.locator('strong').innerText()) + ' | ' + (await btn.innerText()) + ' | button ' + (await size(btn)) + ' | ' + ((await t.locator('.ps-shelf-why').count()) ? await t.locator('.ps-shelf-why').innerText() : 'odds chip ' + (await size(t.locator('.ps-odds-chip')))));
}
await page.locator('.ut-stamps').evaluate((el) => el.scrollTo(0, el.scrollHeight)).catch(() => {});
await page.evaluate(() => document.querySelector('.ps-stamps-src')?.scrollIntoView());
await settle();
await shot('shelf-bottom');

// the shelf item's odds
const tileOf = page.locator('.ps-shelf-tile.i-' + item);
await tileOf.scrollIntoViewIfNeeded();
await tileOf.locator('.ps-odds-chip').click();
await page.locator('.ps-odds').waitFor();
await settle();
await shot(item + '-odds');
console.log(item + ' odds:', await page.locator('.ps-odds-head h2').innerText());
await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
await settle();

// redeem: the first tap arms, the second spends
const btn = tileOf.locator('.ps-shelf-btn');
await btn.click();
await settle(200);
console.log('armed:', await btn.innerText());
await shot(item + '-armed');
await btn.click();
await page.locator('.ut-pick-screen').waitFor({ timeout: 10000 });
await settle();
await shot(item + '-pick');
console.log('pick heading:', await page.locator('.ut-pick-screen h2').innerText());
const reveal = page.locator('.ut-pick-btns .btn.primary');
if (await reveal.count()) await reveal.click();
await settle(motion === 'reduce' ? 400 : 1800);
await page.locator('.ut-pick-card').nth(0).click();
await settle();
await page.locator('.ut-pick-btns .btn.gold').click();
await finishOpening(item + '-kept');

const after = await page.evaluate(async () => {
  const { loadProfile } = await import('/src/lib/profile.ts');
  const { stampsBalance } = await import('/src/ut/scout-stamps.ts');
  const p = loadProfile();
  return {
    stamps: stampsBalance(p.ut),
    spent: (p.ut.content?.claims ?? []).filter((c) => c.startsWith('stamps:')),
    kept: p.ut.owned.filter((o) => o.uid.startsWith('pick:stamps:')).map((o) => o.uid + ' ' + o.cardId),
    picksLeft: (p.ut.content?.picks ?? []).length,
  };
});
console.log('after:', JSON.stringify(after));
console.log('errors:', errors.length ? errors : 'none', 'blocked hosts:', [...new Set(blocked)].join(',') || 'none');
await browser.close();
