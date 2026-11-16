// Claude (packs-1 fixes, 2026-11-16): isolated localhost QA for the review fixes of packs-1 (docs/studio-
// overhaul/packs.md, "packs-1 review fixes"). Every request whose host isn't localhost (or the font CDN) is
// aborted, the page runs in the `inspect` namespace against a local relay, and the save is a local fixture:
// nothing reaches a live service. It checks:
//   - the Store's "Your packs": a pack kind this build doesn't know shows "New Pack · UPDATE TO OPEN" and
//     stays saved after a tap; Front Office / Player Pick tiles name their own pick and option count;
//   - the SBC sheet's auto-fill on a club of special cards only: the protected-card toast, fast;
//   - the trade-in confirm with 4+ flagged cards: the count line, the fade, no repeated overall.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-fixes-1.mjs nba 393
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
const specialNames = await page.evaluate(async (sport) => {
  const { freshProfile, saveProfile } = await import('/src/lib/profile.ts');
  const { getPool } = await import('/src/ut/pool.ts');
  const { openPack } = await import('/src/ut/packs.ts');
  const { awardPick } = await import('/src/ut/content-packs.ts');
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
  const starter = openPack(pool, 'starter', 'qa');
  // the spare club: special editions only (one per player), so auto-fill has nothing it may trade
  const pids = new Set(starter.map((c) => c.line.pid));
  const specials = all.filter((c) => (c.tier === 'legend' || c.tier === 'promo') && !pids.has(c.line.pid) && pids.add(c.line.pid)).slice(0, 40);
  const cards = [...starter, ...specials];
  const owned = cards.map((rc, i) => ({ uid: 'packs-qa-' + i, cardId: rc.line.id, level: 1, xp: 0, at: i + 1 }));
  const squad = autoBuild(sport, owned.slice(0, starter.length).map((c, i) => ({ uid: c.uid, rc: cards[i] })));
  let ut = { ...freshUt(), owned, squad, starterClaimed: true, packsOpened: 1 };
  // a pack from a newer build, a known gold, and two reward picks
  ut = { ...ut, packs: [{ id: 'reward:pass:24', kind: 'headliners', at: 1 }, { id: 'objective:qa', kind: 'gold', at: 2 }] };
  ut = awardPick(ut, pool, 'front-office', 'qa:fo', Date.now()) ?? ut;
  ut = awardPick(ut, pool, 'pick-82', 'stamps:g82:qa', Date.now()) ?? ut;
  p.ut = ut;
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  return specials.map((c) => c.line.name);
}, sport);
await page.reload({ waitUntil: 'domcontentloaded' });

const shot = (name) => page.screenshot({ path: path.join(out, sport + '-' + width + '-' + name + '.png'), animations: 'disabled' });
const settle = (ms = 500) => page.waitForTimeout(ms);
const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();

// ---- the Store's Your packs ----
await page.locator('.ut-tabs button').filter({ hasText: /^STORE[0-9]*$/ }).click();
await page.locator('.ut-mine-pack').first().waitFor({ timeout: 20000 });
await settle();
const tiles = await page.locator('.ut-mine-pack').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim() + ' [' + e.getAttribute('aria-label') + ']'));
console.log('your packs:', tiles.join(' | '));
await page.locator('.ut-mine').screenshot({ path: path.join(out, sport + '-' + width + '-your-packs.png') });
await shot('store');
const tag = await page.evaluate(() => {
  const stage = document.querySelector('.stage');
  const k = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
  const el = document.querySelector('.ut-mine-new');
  const t = el?.querySelector('.ut-update');
  if (!el || !t) return null;
  const r = el.getBoundingClientRect();
  const q = t.getBoundingClientRect();
  return { tile: Math.round(r.width / k) + 'x' + Math.round(r.height / k), tagInside: q.left >= r.left - 0.5 && q.right <= r.right + 0.5, tagLines: Math.round(q.height / k) };
});
console.log('new-pack tile:', JSON.stringify(tag));
await page.locator('.ut-mine-new').click();
await settle(700);
console.log('toast after tap:', (await page.locator('.toast, [role=status]').allInnerTexts()).join(' / ').replace(/\s+/g, ' '));
const still = await page.evaluate(async (sport) => {
  const { loadProfile } = await import('/src/lib/profile.ts');
  return loadProfile().ut.packs.map((p) => p.kind);
}, sport);
console.log('pending kinds after tap:', still.join(','));

// ---- the SBC page ----
await page.locator('.ut-tabs button').filter({ hasText: /^CHALLENGES[0-9]*$/ }).click();
await page.getByRole('tab', { name: /^SBCs/ }).click();
await page.locator('.ut-sbc').first().waitFor({ timeout: 20000 });
await settle();
// each challenge of 4+ cards: auto-fill (the protected-card toast), then specials by hand; the first
// one whose SUBMIT turns gold goes to the confirm
const fillByHand = async () => {
  const slots = await page.locator('.ut-sbc-slot').count();
  const used = new Set();
  for (let i = 0; i < slots; i++) {
    await page.locator('.ut-sbc-slot').nth(i).click();
    await page.locator('.ut-picker').waitFor();
    const fits = page.locator('.ut-picker .chip[aria-pressed=true]').first();
    if (await fits.count()) await fits.click();
    await settle(150);
    let row = null;
    for (const nm of specialNames) {
      if (used.has(nm)) continue;
      const r = page.locator('.ut-pickrow').filter({ hasText: nm }).first();
      if (await r.count()) { row = r; used.add(nm); break; }
    }
    await (row ?? page.locator('.ut-pickrow').first()).click();
    await settle(200);
  }
};
const n = await page.locator('.ut-sbc:not(.done)').count();
let opened = false;
let toasted = false;
for (let i = 0; i < n && !opened; i++) {
  const card = page.locator('.ut-sbc:not(.done)').nth(i);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.locator('.ut-sbcsheet').waitFor();
  await settle(300);
  const slots = await page.locator('.ut-sbc-slot').count();
  if (slots >= 4) {
    if (!toasted) {
      const t0 = Date.now();
      await page.getByRole('button', { name: /AUTO-FILL/ }).click();
      await page.waitForFunction(() => /never trades|Not enough/.test(document.body.innerText), null, { timeout: 15000 });
      console.log('auto-fill toast in', Date.now() - t0, 'ms:', (await page.locator('.toast, [role=status]').allInnerTexts()).join(' / ').replace(/\s+/g, ' '));
      await shot('autofill-toast');
      toasted = true;
    }
    await fillByHand();
    const ok = await page.locator('.ut-sbcsheet .btn.gold').filter({ hasText: /^SUBMIT$/ }).count();
    console.log('tried', (await page.locator('.ut-sbcsheet h2').innerText()), slots, 'slots, submit', ok ? 'ready' : 'not ready');
    if (ok) { opened = true; break; }
  }
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await settle(300);
}
if (!opened) throw Error('no 4+ card challenge the specials can meet today');
await page.getByRole('button', { name: 'SUBMIT', exact: true }).click();
await settle(700);
console.log('count line:', (await page.locator('.sbc-warn-count').allInnerTexts()).join(' / '));
console.log('warning rows:', (await page.locator('.sbc-warn-row').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' / '));
const list = await page.evaluate(() => {
  const ul = document.querySelector('.sbc-warn');
  return ul ? { scroll: ul.scrollHeight, client: ul.clientHeight, more: ul.classList.contains('more') } : null;
});
console.log('list:', JSON.stringify(list));
await shot('sbc-confirm');
console.log('errors:', errors.length ? errors : 'none', 'blocked hosts:', [...new Set(blocked)].join(',') || 'none');
await browser.close();
