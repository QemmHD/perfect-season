// Claude (packs-2 review fix, 2026-11-16): isolated localhost QA of the Position Pack and Elite Gold odds
// sheets' duplicate-protection note (docs/studio-overhaul/packs.md "packs-2 review fixes"), on the packs-3
// harness: every request whose host isn't localhost (or the font CDN) is aborted, the page runs in the
// `inspect` namespace against a local relay, the save is a local fixture and the clock is fixed.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-odds.mjs nba 393 [reduce|full] [ISO time]
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
  const { openPack } = await import('/src/ut/packs.ts');
  const { autoBuild } = await import('/src/ut/squad.ts');
  const { freshUt } = await import('/src/ut/state.ts');
  const { nextPreview, withPreviewSeed } = await import('/src/ut/preview-pack.ts');
  const { weekOf } = await import('/src/ut/sbc.ts');
  const { flashDeals } = await import('/src/ut/pack-actions.ts');
  const pool = await getPool();
  const p = freshProfile();
  p.name = 'Packs QA';
  p.coins = 20000;
  p.firstRun = false;
  p.gifts = ['testers-2026-10'];
  p.settings.sound = false;
  p.settings.haptics = false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  p.rewardDay = day;
  const cards = openPack(pool, 'starter', 'qa');
  const owned = cards.map((rc, i) => ({ uid: 'packs-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
  let ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 1 };
  // a preview skipped 10 minutes ago: the next one is a day away
  ut = nextPreview(withPreviewSeed(ut, 'qapreview', weekOf(day)), false, Date.now() - 600000, weekOf(day));
  p.ut = ut;
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  return { day, deals: flashDeals(sport, Date.now()).map((d) => d.name + ' ' + d.was + '→' + d.price) };
}, sport);
console.log('fixture:', JSON.stringify(fixture));
await page.reload({ waitUntil: 'domcontentloaded' });

const shot = (name) => page.screenshot({ path: path.join(out, sport + '-' + width + '-' + name + '.png'), animations: 'disabled' });
const settle = (ms = 500) => page.waitForTimeout(ms);
const k = async () => page.evaluate(() => {
  const s = document.querySelector('.stage');
  return s ? s.getBoundingClientRect().width / s.offsetWidth : 1;
});

const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();
await page.locator('.ut-tabs button').filter({ hasText: /^STORE[0-9]*$/ }).click();
await page.locator('.ut-daily').waitFor({ timeout: 20000 });
await settle(800);
for (const name of ['Position Pack', 'Elite Gold']) {
  const btn = page.getByRole('button', { name: name + ' odds', exact: true }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await settle(700);
  const sheet = page.locator('.ut-odds').first();
  const txt = (await sheet.innerText()).replace(/\s+/g, ' ');
  console.log(name + ':', txt.match(/Golds in this pack[^.]*\./)?.[0] ?? 'NO PREFER NOTE');
  const last = page.locator('.ut-odds p.note').last();
  await last.scrollIntoViewIfNeeded();
  await settle(300);
  await shot(name.replace(/ /g, '-').toLowerCase() + '-odds');
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await settle(400);
}
console.log('errors:', JSON.stringify(errors), 'blocked:', JSON.stringify([...new Set(blocked)]));
await browser.close();
