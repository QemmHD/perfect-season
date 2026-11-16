// Claude (packs-1, 2026-11-16): isolated localhost QA for the packs-1 SBC fixes (docs/studio-overhaul/
// packs.md). Every request whose host isn't localhost (or the font CDN) is aborted, the page runs in the
// `inspect` namespace against a local relay, and the save is a local fixture: nothing reaches a live
// service. It opens the SBC page, auto-fills a repeatable, puts a Legend in by hand and shoots the trade-in
// confirm with its warning rows; in soccer it shoots the SBC list with the soccer position templates.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-sbc.mjs nba 393
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const base = process.env.PS_QA_URL || 'http://localhost:5213/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('QA fixtures are restricted to localhost.');
const out = process.env.OUT || '/tmp/packs-qa';
fs.mkdirSync(out, { recursive: true });
const [sport = 'nba', width = '393'] = process.argv.slice(2);
const DEV = { 393: { w: 393, h: 852, insets: [59, 0, 34, 0] }, 320: { w: 320, h: 568, insets: [20, 0, 0, 0] } }[width];
const ALLOWED = ['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const { chromium } = require('playwright');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: DEV.w, height: DEV.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
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
const legendName = await page.evaluate(async (sport) => {
  const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
  const { getPool } = await import('/src/ut/pool.ts');
  const { openPack } = await import('/src/ut/packs.ts');
  const { autoBuild } = await import('/src/ut/squad.ts');
  const { freshUt } = await import('/src/ut/state.ts');
  const pool = await getPool();
  const p = freshProfile();
  p.name = 'Packs QA';
  p.coins = 10000;
  p.firstRun = false;
  p.gifts = ['testers-2026-10'];
  p.settings.sound = false;
  p.settings.haptics = false;
  p.rewardDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const all = [...pool.base.values()];
  const cards = [
    ...openPack(pool, 'starter', 'qa'),
    ...all.filter((c) => c.tier === 'legend').slice(0, 1),
    ...all.filter((c) => c.tier === 'promo').slice(0, 1),
    ...all.filter((c) => c.line.kind === 'season' && c.tier === 'gold').slice(0, 40),
    ...all.filter((c) => c.line.kind === 'season' && c.tier === 'silver').slice(0, 20),
  ].filter((c, i, list) => list.findIndex((x) => x.line.id === c.line.id) === i);
  const owned = cards.map((rc, i) => ({ uid: 'packs-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
  p.ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1 };
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  return all.find((c) => c.tier === 'legend')?.line.name ?? '';
}, sport);
await page.reload({ waitUntil: 'domcontentloaded' });

const shot = (name) => page.screenshot({ path: path.join(out, sport + '-' + width + '-' + name + '.png'), animations: 'disabled' });
const settle = (ms = 500) => page.waitForTimeout(ms);
// into Ultimate Team, then CHALLENGES → SBCs
const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();
await page.locator('.ut-tabs button').filter({ hasText: /^CHALLENGES[0-9]*$/ }).click();
await page.getByRole('tab', { name: /^SBCs/ }).click();
await page.locator('.ut-sbc').first().waitFor({ timeout: 20000 });
await settle();

if (sport === 'soccer') {
  const names = await page.locator('.ut-sbc .disp').allInnerTexts();
  console.log('soccer SBCs:', names.join(' | '));
  // the position templates first (Back Four, then the others), Kickabout last
  let own = page.locator('.ut-sbc').filter({ hasText: /Back Four/i }).first();
  if (!(await own.count())) own = page.locator('.ut-sbc').filter({ hasText: /Front Three|Midfield Engine|Gold Spine|Kickabout/i }).first();
  if (await own.count()) {
    await own.scrollIntoViewIfNeeded();
    await settle();
    await shot('sbc-list');
    await own.click();
    await settle(700);
    await shot('sbc-sheet');
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await settle();
  } else console.log('no soccer position template today');
}

// a repeatable anyone can do: the first upgrade with no requirements the auto-fill can't meet
const up = page.locator('.ut-sbc.upgrade:not(.done)').first();
await up.scrollIntoViewIfNeeded();
await up.click();
await page.locator('.ut-sbcsheet').waitFor();
await page.getByRole('button', { name: /AUTO-FILL/ }).click();
await settle();
// swap the first slot for the Legend, by hand (FITS off when it doesn't meet every requirement alone)
await page.locator('.ut-sbc-slot').first().click();
await page.locator('.ut-picker').waitFor();
const row = () => page.locator('.ut-pickrow').filter({ hasText: legendName }).first();
if (!(await row().count())) {
  const fits = page.locator('.ut-picker .chip[aria-pressed=true]').first();
  if (await fits.count()) await fits.click();
  await settle(300);
}
console.log('legend in picker:', legendName, await row().count());
await row().click();
await settle();
const submit = page.getByRole('button', { name: 'SUBMIT', exact: true });
await submit.click();
await settle(600);
const warn = page.locator('.sbc-warn-row');
console.log('warning rows:', await warn.count(), (await warn.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' / '));
console.log('yes button:', await page.locator('.btn.danger, .btn.gold').filter({ hasText: /TRADE IN/ }).allInnerTexts());
await shot('sbc-confirm');
// target sizes of the confirm's buttons (design px; the stage scales 390 to the phone)
const sizes = await page.evaluate(() => {
  const stage = document.querySelector('.stage');
  const k = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
  return [...document.querySelectorAll('[role=dialog] .btnrow .btn')].map((b) => {
    const r = b.getBoundingClientRect();
    return b.textContent.trim() + ' ' + Math.round(r.width / k) + 'x' + Math.round(r.height / k);
  });
});
console.log('confirm buttons:', sizes.join(', '));
console.log('errors:', errors.length ? errors : 'none', 'blocked hosts:', [...new Set(blocked)].join(',') || 'none');
await browser.close();
