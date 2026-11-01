// Claude, 2026-11-01: isolated localhost QA for the Pack Tracker (docs/PULL-TRACKER.md). In each
// sport (NBA, NFL, soccer) at 390x844 and 320x568, from a pre-tracker save: the empty state and the
// "before tracker" cards, then real packs through the UI (a Gold and a Silver pack from the Store, the
// Daily Drop, a Scout's Choice pick, and in soccer the waiting reward pack), the tracker's three
// sections, and a reload proving every pack is logged exactly once. Fails on page errors, horizontal
// overflow inside the tracker, and tap targets under 44 design px.
//   node scripts/qa/pull-tracker.mjs [nba|nfl|soccer|all] [390|320|all]
// Starts its own Vite server on a free port (or uses PS_QA_URL) and stops only that process by PID.
// Screenshots: PS_QA_ARTIFACTS (default /tmp/perfect-season-qa/pull-tracker).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.env.PS_QA_ARTIFACTS ||= '/tmp/perfect-season-qa/pull-tracker';
const [sportArg = 'all', widthArg = 'all'] = process.argv.slice(2);
const sports = sportArg === 'all' ? ['nba', 'nfl', 'soccer'] : [sportArg];
const widths = widthArg === 'all' ? [390, 320] : [+widthArg];
const HEIGHT = { 390: 844, 320: 568 };
const log = (...a) => console.log('[pull-tracker]', ...a);

// ---- our own dev server (killed by its PID only) ----
let server = null;
if (!process.env.PS_QA_URL) {
  const port = await new Promise((res) => {
    const s = net.createServer().listen(0, () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (d) => process.env.PS_QA_VERBOSE && process.stderr.write(d));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('vite did not start')), 60000);
    server.stdout.on('data', (d) => /Local:|ready in/.test(String(d)) && (clearTimeout(t), res()));
    server.on('exit', (c) => rej(new Error('vite exited ' + c)));
  });
  process.env.PS_QA_URL = 'http://127.0.0.1:' + port + '/';
  log('vite pid', server.pid, process.env.PS_QA_URL);
}
const stop = () => {
  if (server && server.exitCode === null) process.kill(server.pid, 'SIGTERM');
};
process.on('exit', stop);

const { fixture, shot, artifacts } = await import('./browser.mjs');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();

async function finishOpening(page) {
  await page.locator('.ut-open-screen').waitFor({ timeout: 15000 });
  for (let k = 0; k < 40; k++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.isVisible().catch(() => false)) break;
    const seal = page.locator('.ut-cinema-open');
    if (await seal.isVisible().catch(() => false)) await seal.click();
    else {
      const skip = page.getByRole('button', { name: 'SKIP', exact: true });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      else {
        const next = page.locator('.ut-cinema-next');
        if (await next.isVisible().catch(() => false)) await next.click();
        else await page.locator('.ut-open-screen').click({ position: { x: 12, y: 80 } }).catch(() => {});
      }
    }
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'DONE', exact: true }).click();
  await page.locator('.ut-open-screen').waitFor({ state: 'detached', timeout: 8000 });
}
/** the Store ignores a second pack within 600 ms of the last (UltimateTeam.openNow's double-tap lock) */
const settle = (page) => page.waitForTimeout(700);
const tab = (page, label) => page.locator('.ut-tabs button').filter({ hasText: new RegExp('^' + label + '[0-9]*$') }).click();
const seg = (page, label) => page.getByRole('tab', { name: new RegExp('^' + label) }).click();

/** layout problems inside the tracker: anything past the frame, buttons under 44 design px */
const audit = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('.stage') || document.body;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / (stage.offsetWidth || sr.width) || 1;
    const rootEl = document.querySelector('.ut-tracker');
    const out = { offscreen: [], small: [] };
    if (!rootEl) return out;
    const inScroller = (e) => {
      for (let n = e.parentElement; n && n !== rootEl; n = n.parentElement) if (/(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
      return false;
    };
    for (const e of rootEl.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if ((r.right > sr.right + 1 || r.left < sr.left - 1) && !inScroller(e)) out.offscreen.push((e.className || e.tagName) + ' @' + Math.round((r.right - sr.left) / k));
    }
    for (const b of rootEl.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (r.width < 1) continue;
      // chips draw a 32px pill with an invisible ::before hit area (6px above and below)
      const before = getComputedStyle(b, '::before');
      const extra = before.content !== 'none' && before.position === 'absolute' ? -2 * parseFloat(before.top || '0') : 0;
      const h = r.height / k + Math.max(0, extra);
      if (h < 43.5 || r.width / k < 43.5) out.small.push((b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 30) + ' ' + Math.round(r.width / k) + 'x' + Math.round(h));
    }
    return out;
  });

async function check(page, where, issues) {
  const a = await audit(page);
  if (a.offscreen.length) issues.push(where + ' offscreen: ' + a.offscreen.slice(0, 4).join(', '));
  if (a.small.length) issues.push(where + ' small targets: ' + a.small.slice(0, 6).join(', '));
}

const pullsOf = (p) => p.ut.content?.pulls ?? null;
const summary = [];

let lastPage = null;
async function run(sport, width) {
  const tag = sport + '-' + width;
  const issues = [];
  const { page, current, errors } = await fixture(browser, sport, 'Claude Tracker', width, { viewport: { width, height: HEIGHT[width] } });
  lastPage = [page, tag];
  await page.evaluate(() => {
    // a pre-tracker save with more coins (Silver, Gold and a Scout's Choice)
    return import('/src/lib/profile.ts').then(({ loadProfile, saveProfile }) => {
      const p = loadProfile();
      p.coins = 20000;
      p.ut.packsOpened = 4;
      saveProfile(p);
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const p0 = await current();
  assert.equal(pullsOf(p0), null, 'a pre-tracker save has no log');
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.uh-squad').waitFor({ timeout: 90000 });

  // ---- Club → Pack Tracker: the intentional empty state, and the cards from before ----
  await tab(page, 'CLUB');
  await page.locator('.ut-tracker-link').waitFor();
  await shot(page, tag + '-01-club-link');
  await page.locator('.ut-tracker-link').click();
  await page.locator('.ut-tracker').waitFor();
  assert.equal((await page.locator('.ut-title').innerText()).trim().toLowerCase(), 'pack tracker');
  await seg(page, 'BY PACK');
  await page.locator('.ut-trk-empty').waitFor();
  await shot(page, tag + '-02-empty');
  await check(page, 'empty', issues);
  await seg(page, 'ALL CARDS');
  await page.locator('.ut-trk-item').first().waitFor();
  const preCount = await page.locator('.ut-trk-item.pre').count();
  assert.ok(preCount > 0, 'cards from before the tracker are marked');
  await shot(page, tag + '-03-all-before');

  // ---- open packs for real through the Store ----
  await tab(page, 'STORE');
  await page.locator('.ut-store').waitFor();
  const defs = await page.evaluate(async (sport) => {
    const { packDefs } = await import('/src/ut/packs.ts');
    const d = packDefs(sport);
    return { gold: d.gold.price, silver: d.silver.price, scout: d.scout.price };
  }, sport);
  let expected = 0;
  await page.getByRole('button', { name: 'Buy Gold Pack for ' + defs.gold + ' coins', exact: true }).click();
  await finishOpening(page);
  expected++;
  await settle(page);
  await page.getByRole('button', { name: 'Buy Silver Pack for ' + defs.silver + ' coins', exact: true }).click();
  await finishOpening(page);
  expected++;
  const daily = page.locator('.ut-daily .ut-daily-btn');
  if (await daily.isVisible().catch(() => false)) {
    await settle(page);
    await daily.click();
    await finishOpening(page);
    expected++;
  }
  // Scout's Choice: a pick sheet, keep one
  await settle(page);
  await page.getByRole('button', { name: "Buy Scout's Choice for " + defs.scout + ' coins', exact: true }).click();
  await page.locator('.ut-pick-screen').waitFor();
  await page.getByRole('button', { name: 'REVEAL', exact: true }).click().catch(() => {});
  await page.locator('.ut-pick-card').nth(0).click();
  await page.getByRole('button', { name: 'KEEP THIS PLAYER', exact: true }).click();
  await finishOpening(page);
  expected++;
  // soccer's fixture also waits with a reward Gold pack
  if (sport === 'soccer') {
    await settle(page);
    await page.getByRole('button', { name: 'Open your Gold Pack', exact: true }).click();
    await finishOpening(page);
    expected++;
  }
  const p1 = await current();
  const l1 = pullsOf(p1);
  assert.ok(l1, 'the log exists after opening');
  assert.equal(l1.r.length, expected, 'every opening logged once');
  assert.equal(l1.a.gold.n + (l1.a.gold.pd === l1.a.gold.n ? 0 : 0), sport === 'soccer' ? 2 : 1, 'gold total');
  assert.equal(l1.a.gold.c, defs.gold, 'only the bought gold pack cost coins');
  assert.equal(l1.a.scout.c, defs.scout, 'Scout price recorded');
  assert.equal(p1.ut.packsOpened, p0.ut.packsOpened + expected - 1, 'picks never counted as packs');
  for (const e of l1.r) for (let i = 0; i < e.cs.length; i++) assert.ok(p1.ut.owned.some((c) => c.uid === (e.u.endsWith(':') ? e.u + i : e.u)), 'logged uid owned');

  // ---- the tracker from the Store's PULL HISTORY link ----
  await page.locator('.ut-pull-history').first().click();
  await page.locator('.ut-tracker').waitFor();
  await seg(page, 'BY PACK');
  await page.locator('.ut-trk-pack').first().waitFor();
  await page.waitForTimeout(400);
  const names = await page.locator('.ut-trk-name b').allInnerTexts();
  for (const n of ['Gold Pack', 'Silver Pack', "Scout's Choice"]) assert.ok(names.includes(n), 'summary for ' + n + ' in ' + names.join('|'));
  const goldCard = page.locator('.ut-trk-pack', { hasText: 'Gold Pack' }).first();
  const goldRows = await goldCard.locator('.ut-trk-table > div').allInnerTexts();
  assert.ok(goldRows.some((r) => /86\+ in a pack/.test(r) && /%/.test(r)), 'hit rate row with you vs expected');
  await page.locator('.ut-trk-hero').scrollIntoViewIfNeeded();
  await shot(page, tag + '-04-by-pack');
  await check(page, 'by pack', issues);
  await page.locator('.ut-trk-pack').last().scrollIntoViewIfNeeded();
  await shot(page, tag + '-05-by-pack-scrolled');

  await seg(page, 'RECENT');
  await page.locator('.ut-trk-pull').first().waitFor();
  assert.equal(await page.locator('.ut-trk-pull').count(), expected, 'feed lists every pack');
  assert.ok((await page.locator('.ut-trk-pull').first().innerText()).includes(sport === 'soccer' ? 'Gold Pack' : "Scout's Choice"), 'newest first');
  await shot(page, tag + '-06-recent');
  await check(page, 'recent', issues);
  await page.locator('.ut-trk-chips').first().getByRole('button', { name: 'GOLD', exact: true }).click();
  assert.equal(await page.locator('.ut-trk-pull').count(), sport === 'soccer' ? 2 : 1, 'pack type filter');
  await page.locator('.ut-trk-chips').first().getByRole('button', { name: 'ALL PACKS', exact: true }).click();
  await page.locator('.ut-trk-chips').nth(1).getByRole('button', { name: 'SPECIAL', exact: true }).click();
  await shot(page, tag + '-07-recent-special');
  await page.locator('.ut-trk-chips').nth(1).getByRole('button', { name: 'ANY CARD', exact: true }).click();
  // a mini card opens the card details
  await page.locator('.ut-trk-pull .ut-trk-mini').first().click();
  await page.locator('.ut-detail, [role=dialog]').first().waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await seg(page, 'ALL CARDS');
  await page.locator('.ut-trk-item').first().waitFor();
  const firstFrom = await page.locator('.ut-trk-item .ut-trk-from').first().innerText();
  assert.ok(!/Before tracker/.test(firstFrom), 'newest card comes from a tracked pack: ' + firstFrom);
  assert.ok((await page.locator('.ut-trk-item.pre').count()) > 0, 'older cards still marked');
  await shot(page, tag + '-08-all');
  await check(page, 'all cards', issues);
  await page.locator('.ut-trk-chips').first().getByRole('button', { name: '86+', exact: true }).click();
  await shot(page, tag + '-09-all-86');
  await page.locator('.ut-trk-chips').first().getByRole('button', { name: 'ANY OVR', exact: true }).click();

  // ---- reload: nothing logged twice ----
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.ut-tracker, .uh-squad').first().waitFor({ timeout: 90000 });
  const p2 = await current();
  assert.deepEqual(pullsOf(p2), l1, 'the log is unchanged by a reload');
  assert.equal(p2.ut.owned.length, p1.ut.owned.length);

  assert.deepEqual(errors, [], 'page errors');
  const size = JSON.stringify(l1).length;
  summary.push({ tag, packs: expected, cards: l1.r.reduce((s, e) => s + e.cs.length, 0), logBytes: size, issues });
  log(tag, 'ok', expected, 'packs logged,', size, 'bytes', issues.length ? 'ISSUES: ' + issues.join(' | ') : '');
  await page.context().close();
}

let failed = false;
try {
  for (const s of sports) for (const w of widths) await run(s, w);
} catch (e) {
  failed = true;
  console.error(e);
  if (lastPage) await shot(lastPage[0], lastPage[1] + '-FAILED').catch(() => {});
} finally {
  await browser.close();
  stop();
}
fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(summary, null, 2));
const layout = summary.flatMap((s) => s.issues);
if (layout.length) log('layout issues:', layout.length);
process.exit(failed || layout.length ? 1 : 0);
