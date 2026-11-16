// Claude (packs-4, 2026-11-16): isolated localhost QA of the odds sheets and the buy confirm
// (docs/studio-overhaul/packs.md "packs-4"), on the packs-3 harness: every request whose host isn't localhost
// (or the font CDN) is aborted, the page runs in the `inspect` namespace against a local relay, the save is a
// local fixture and the clock is fixed. It opens the sheets like a player (Store tiles, the Daily Drop, a
// waiting pack and pick, the Preview Pack, a program pack, Scout's Choice, the buy confirm and its VIEW ODDS,
// an SBC reward, the Pack Tracker), measures tile tap → visible sheet at 4× CPU, and checks every control in
// a sheet is 44 design px or more, every text 10 design px or more and nothing overflows.
//   PS_QA_URL=http://localhost:5213/ OUT=<dir> node scripts/packs/qa-odds-sheets.mjs nba 393 [reduce|full] [ISO time]
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
  const { awardPick } = await import('/src/ut/content-packs.ts');
  const { recordPull } = await import('/src/ut/pull-log.ts');
  const { livePacksOn } = await import('/src/ut/live-packs.ts');
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
  let ut = { ...freshUt(), owned, squad: autoBuild(sport, owned.map((c, i) => ({ uid: c.uid, rc: cards[i] }))), starterClaimed: true, packsOpened: 3 };
  // a waiting Premium and a waiting Player Pick 84+ (reward-style ids)
  ut = { ...ut, packs: [{ id: 'objective:qa-premium', kind: 'premium', at: Date.now() }] };
  ut = awardPick(ut, pool, 'pick-84', 'minutes:life:25h', Date.now()) ?? ut;
  // two logged Gold packs, so the Pack Tracker has a summary
  for (const i of [0, 1]) {
    const got = openPack(pool, 'gold', 'qa-log-' + i);
    ut = recordPull(ut, { id: 'qa-log-' + i, kind: 'gold', name: 'Gold Pack', price: 1050, source: 'store', at: Date.now() - (2 - i) * 60000, uid: 'pack:qa-log-' + i + ':', cards: got });
    ut = { ...ut, owned: [...ut.owned, ...got.map((rc, k) => ({ uid: 'pack:qa-log-' + i + ':' + k, cardId: rc.line.id, level: 1, xp: 0, at: Date.now() }))] };
  }
  p.ut = ut;
  localStorage.setItem('perfect-season:fav:asked', '1');
  saveProfile(p);
  return { day, live: livePacksOn(day).map((x) => x.id) };
}, sport);
console.log('fixture:', JSON.stringify(fixture));
await page.reload({ waitUntil: 'domcontentloaded' });

const shot = (name) => page.screenshot({ path: path.join(out, sport + '-' + width + '-' + name + '.png'), animations: 'disabled' });
const settle = (ms = 500) => page.waitForTimeout(ms);
const issues = [];

/** Every control in `sel` ≥ 44 design px tall (a compact chip counts its ::before hit area), every text ≥ 10, nothing past its box. */
async function audit(sel, label) {
  const res = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { missing: true };
    const stage = document.querySelector('.stage');
    const k = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
    const small = [];
    for (const b of root.querySelectorAll('button, [role=checkbox]')) {
      const r = b.getBoundingClientRect();
      if (!r.width) continue;
      const before = getComputedStyle(b, '::before');
      const ext = before.content !== 'none' && before.position === 'absolute' ? Math.max(0, -parseFloat(before.top) || 0) + Math.max(0, -parseFloat(before.bottom) || 0) : 0;
      const h = r.height / k + ext;
      if (h < 44 - 0.5) small.push((b.innerText || b.getAttribute('aria-label') || '?').trim().slice(0, 30) + ' ' + h.toFixed(1));
    }
    // (pack art labels are decorative, aria-hidden, and their legibility is packs-8's H3: reported apart)
    const tiny = [];
    let art = 0;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el.getClientRects().length) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs >= 10) continue;
      if (el.closest('[aria-hidden=true]')) art++;
      else tiny.push(n.textContent.trim().slice(0, 24) + ' ' + fs);
    }
    const over = [];
    const box = root.getBoundingClientRect();
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.right > box.right + 1 || r.left < box.left - 1) over.push(el.className + ' ' + Math.round(r.left) + '-' + Math.round(r.right));
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && getComputedStyle(el).overflowX !== 'auto') over.push('scroll ' + el.className);
    }
    const pageOver = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    // a sheet's footer (CLOSE) always on screen: the body scrolls, the footer never does
    const foot = root.querySelector('.ps-odds-foot');
    if (foot && foot.getBoundingClientRect().bottom > innerHeight + 1) over.push('footer off screen ' + Math.round(foot.getBoundingClientRect().bottom));
    return { small, tiny, art, over: over.slice(0, 5), pageOver };
  }, sel);
  if (res.missing) return issues.push(label + ': missing ' + sel);
  if (res.small.length) issues.push(label + ' small targets: ' + res.small.join(', '));
  if (res.tiny.length) issues.push(label + ' tiny text: ' + res.tiny.join(', '));
  if (res.over.length) issues.push(label + ' overflow: ' + res.over.join(', '));
  if (res.pageOver) issues.push(label + ' page scrolls sideways');
  if (res.art) artNotes.add(label);
}
const artNotes = new Set();

/** Tap `btn` and time it until the sheet's body is on screen (after the next frame), in ms. */
async function timedOpen(btn) {
  await btn.scrollIntoViewIfNeeded();
  const h = await btn.elementHandle();
  return page.evaluate(
    (el) =>
      new Promise((res) => {
        const t0 = performance.now();
        el.click();
        const f = () => (document.querySelector('.ps-odds-body') ? requestAnimationFrame(() => res(performance.now() - t0)) : requestAnimationFrame(f));
        f();
      }),
    h,
  );
}

const close = async () => {
  await page.locator('.ps-odds-foot .btn').last().click();
  await page.locator('.ps-odds').waitFor({ state: 'detached' });
};

const ut = page.locator('nav button, .tabs button, button').filter({ hasText: /^ULTIMATE TEAM$/ }).first();
await ut.waitFor({ timeout: 30000 });
await ut.click();
await page.locator('.ut-tabs button').filter({ hasText: /^STORE[0-9]*$/ }).click();
await page.locator('.ut-daily').waitFor({ timeout: 20000 });
await settle(1500);
await shot('store-top');
await audit('.ut-mine', 'waiting packs');

// tile tap → visible sheet at 4× CPU (the chunk preloads in an idle moment after the Store paints)
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const times = {};
for (const name of ['Premium Gold', 'Jumbo Premium', 'Elite Gold', 'Gold Pack']) {
  const btn = page.getByRole('button', { name: name + ' odds', exact: true }).first();
  if (!(await btn.count())) continue;
  times[name] = Math.round(await timedOpen(btn));
  await settle(300);
  await close();
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log('tap → sheet at 4x (ms):', JSON.stringify(times));

// the Premium sheet with PER CARD open
await page.getByRole('button', { name: 'Premium Gold odds', exact: true }).first().click();
await page.locator('.ps-odds-body').waitFor();
await settle(500);
await shot('premium-sheet');
await audit('.ps-odds', 'premium sheet');
await page.locator('.ps-odds-toggle').click();
await settle(300);
await page.locator('.ps-odds-slots').scrollIntoViewIfNeeded();
await shot('premium-percard');
await audit('.ps-odds', 'premium per card');
console.log('premium:', (await page.locator('.ps-odds-body').innerText()).replace(/\s+/g, ' ').slice(0, 400));
await close();

// the Daily Drop line, then its sheet
console.log('daily:', (await page.locator('.ut-daily small').last().innerText()).replace(/\s+/g, ' '));
await page.getByRole('button', { name: 'Daily Drop odds', exact: true }).click();
await page.locator('.ps-odds-body').waitFor();
await settle(400);
await shot('daily-sheet');
await audit('.ps-odds', 'daily sheet');
await close();

// a waiting pick and a waiting pack
for (const label of ['Player Pick 84+ odds', 'Premium Gold odds']) {
  const chip = page.locator('.ut-mine .ps-odds-chip').filter({ hasText: 'ODDS' });
  const one = page.locator('.ut-mine').getByRole('button', { name: label, exact: true }).first();
  if (!(await one.count())) {
    issues.push('no waiting chip ' + label + ' (' + (await chip.count()) + ' chips)');
    continue;
  }
  await one.click();
  await page.locator('.ps-odds-body').waitFor();
  await settle(400);
  await shot(label.startsWith('Player') ? 'pick84-sheet' : 'waiting-premium-sheet');
  await audit('.ps-odds', label);
  await close();
}

// the pick screen's own ODDS chip (the sheet opens above the full-screen pick)
await page.locator('.ut-mine').getByRole('button', { name: /^Choose your player/ }).first().click();
await page.locator('.ut-pick-screen').waitFor();
await settle(400);
await page.locator('.ut-pick-screen .ps-odds-chip').click();
await page.locator('.ps-odds-body').waitFor();
await settle(400);
const onTop = await page.evaluate(() => {
  const r = document.querySelector('.ps-odds-foot .btn').getBoundingClientRect();
  return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.ps-odds') != null;
});
if (!onTop) issues.push('pick screen: the odds sheet is under the pick screen');
await shot('pick-screen-sheet');
await audit('.ps-odds', 'pick screen sheet');
await close();
await page.getByRole('button', { name: 'LATER', exact: true }).click();
await page.locator('.ut-pick-screen').waitFor({ state: 'detached' });
await settle(300);

// Scout's Choice (a pick table)
const scout = page.getByRole('button', { name: "Scout's Choice odds", exact: true }).first();
if (await scout.count()) {
  await scout.click();
  await page.locator('.ps-odds-body').waitFor();
  await settle(400);
  await shot('scout-sheet');
  await audit('.ps-odds', 'scout sheet');
  console.log('scout:', (await page.locator('.ps-odds-head p').innerText()).replace(/\s+/g, ' '));
  await close();
}

// a program pack (boosted inside a Friday boost)
const prog = page.locator('.ut-shopitem.s-live .ut-oddsbtn').first();
if (await prog.count()) {
  await prog.scrollIntoViewIfNeeded();
  await prog.click();
  await page.locator('.ps-odds-body').waitFor();
  await settle(400);
  await shot('program-sheet');
  await audit('.ps-odds', 'program sheet');
  console.log('program:', (await page.locator('.ps-odds-body').innerText()).replace(/\s+/g, ' ').slice(0, 260));
  await close();
}

// the Preview Pack's sheet
const prev = page.getByRole('button', { name: 'Preview Pack odds', exact: true });
if (await prev.count()) {
  await prev.scrollIntoViewIfNeeded();
  await prev.click();
  await page.locator('.ps-odds-body').waitFor();
  await settle(300);
  await audit('.ps-odds', 'preview sheet');
  await close();
}

// the buy confirm (Jumbo, under 10,000: "Don't ask again" offered), VIEW ODDS over it, then CANCEL
const jumbo = page.getByRole('button', { name: /^Buy Jumbo Premium for/ }).first();
await jumbo.scrollIntoViewIfNeeded();
await jumbo.click();
await page.locator('.ps-confirm').waitFor();
await settle(500);
await shot('buy-confirm');
await audit('.ps-confirm', 'buy confirm');
console.log('confirm:', (await page.locator('.ps-confirm').innerText()).replace(/\s+/g, ' '));
await page.getByRole('button', { name: 'VIEW ODDS', exact: true }).click();
await page.locator('.ps-odds-body').waitFor();
await settle(400);
await shot('buy-confirm-odds');
await close();
await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
await page.locator('.ps-confirm').waitFor({ state: 'detached' });
const coins0 = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('profile'))?.[1] ?? '{}').coins);
console.log('coins after cancel:', coins0);

// the Pack Tracker: the footnote and a tracked pack's sheet
await page.getByRole('button', { name: 'PULL HISTORY', exact: true }).first().click();
await page.locator('.ut-trk-pack').first().waitFor({ timeout: 10000 });
await settle(400);
const foot = page.locator('.ut-trk-list > p.note').first();
await foot.scrollIntoViewIfNeeded();
await shot('tracker-foot');
console.log('tracker:', (await foot.innerText()).replace(/\s+/g, ' '));
await page.locator('.ut-trk-odds').first().click();
await page.locator('.ps-odds-body').waitFor();
await settle(300);
await audit('.ps-odds', 'tracker sheet');
await close();

// an SBC with a random reward: its ODDS chip
await page.locator('.ut-tabs button').filter({ hasText: /^CHALLENGES[0-9]*$/ }).click();
await page.getByRole('tab', { name: /^SBCs/ }).click();
await page.locator('.ut-sbc').first().waitFor({ timeout: 20000 });
await settle(500);
const sbc = page.locator('.ut-sbc:not(.done)').filter({ hasText: /Gold card|Hot Season card|Weekly Standout|Pack|Gold/ }).first();
await sbc.scrollIntoViewIfNeeded();
await sbc.click();
await page.locator('.ut-sbcsheet').waitFor();
await settle(400);
await page.getByRole('button', { name: 'Reward odds', exact: true }).click();
await page.locator('.ps-odds-body').waitFor();
await settle(400);
await shot('sbc-reward-sheet');
await audit('.ps-odds', 'sbc reward sheet');
console.log('sbc reward:', (await page.locator('.ps-odds-head').innerText()).replace(/\s+/g, ' '));
await close();

console.log('decorative pack-art labels under 10 px (packs-8 H3) in:', [...artNotes].join(', ') || 'none');
console.log('issues:', issues.length ? '\n  ' + issues.join('\n  ') : 'none');
console.log('errors:', JSON.stringify(errors), 'blocked:', JSON.stringify([...new Set(blocked)]));
await browser.close();
