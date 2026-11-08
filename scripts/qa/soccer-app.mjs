// Soccer in the app, end to end in Chromium (Claude, 2026-11-01). Needs the dev server and the local
// relay (docs/BROWSER-QA.md):
//   PS_QA_URL=http://localhost:5193/ node scripts/qa/soccer-app.mjs [all|switch|draft|arcade|ut|widths]
// - switch: an NBA player switches to SOCCER on Home (the reload model), the other sports' saves untouched
// - draft:  a Classic soccer draft (eight spots on the pitch) → the 38-game W-D-L season → the cup (simulated
//           rounds with GameCast) → results (W-D-L, points)
// - arcade: a 1 vs 1 draft against the AI, then the match played by the autopilot on the real engine
//           (?autoplay), to the result
// - ut:     a fresh Ultimate Team: starter pack → squad on the pitch (formation switch) → a Squad Battles
//           match (autoplay) → Store (no Spotlight)
// - widths: Home, draft, UT Home/Squad/Store at 430, 390 and 320
// Every flow fails on a page error. Screenshots go to PS_QA_ARTIFACTS (default /tmp/perfect-season-qa).
import assert from 'node:assert/strict';
import { base, fixture, launch, shot } from './browser.mjs';

const which = process.argv[2] ?? 'all';
const run = (k) => which === 'all' || which === k;
const browser = await launch();
const report = {};
const wait = (page, ms) => page.waitForTimeout(ms);
const noErrors = (errors, what) => assert.deepEqual(errors, [], what + ': page errors');

/** Classic (or 1 vs 1) draft: spin, take the first player who fits, place him; until the lineup's full. */
async function draft(page, tag) {
  const action = () => page.locator('.actionbar button').last();
  for (let i = 0; i < 80; i++) {
    const t = ((await action().innerText().catch(() => '')) || '').trim();
    if (/PLAY THE SEASON|SEE THE MATCHUP/.test(t)) {
      await shot(page, tag + '-drafted');
      await action().click();
      return t;
    }
    if (/^SPIN|NO ONE FITS/.test(t)) {
      const hide = page.getByRole('button', { name: 'Hide players' });
      if (await hide.isVisible().catch(() => false)) await hide.click();
      await action().click();
      await wait(page, 3200);
      continue;
    }
    if (/SHOW PLAYERS|PICK A PLAYER/.test(t)) {
      if (/SHOW/.test(t)) {
        await action().click();
        await wait(page, 500);
      }
      const row = page.locator('.row:not(.off)').first();
      if (!(await row.count())) throw Error('no player to pick');
      await row.click();
      await wait(page, 400);
      const slot = page.locator('.slot-empty.glow').first();
      if (await slot.count()) await slot.click();
      await wait(page, 1500);
      continue;
    }
    await wait(page, 800);
  }
  throw Error('the draft did not finish');
}

if (run('switch')) {
  const { page, errors, context } = await fixture(browser, 'nba', 'Claude QA', 390);
  await wait(page, 1200);
  await shot(page, 'soccer-switch-0-nba');
  const before = await page.evaluate(() => [localStorage.getItem('perfect-season:profile:v1'), localStorage.getItem('perfect-season:profile:nfl:v1')]);
  await page.getByRole('group', { name: 'Sport' }).getByRole('button', { name: /SOCCER/ }).click();
  await page.waitForURL(/.*/, { timeout: 15000 });
  await page.locator('.sportswitch.soccer').waitFor({ timeout: 30000 });
  await wait(page, 1500);
  assert.equal(await page.getByRole('group', { name: 'Sport' }).getByRole('button', { name: /SOCCER/ }).getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('body').innerText(), /38–0/);
  const after = await page.evaluate(() => [JSON.parse(localStorage.getItem('perfect-season:profile:v1')), localStorage.getItem('perfect-season:profile:nfl:v1'), localStorage.getItem('perfect-season:sport')]);
  // basketball's own progress and the shared wallet are what they were; football's untouched
  const nbaBefore = JSON.parse(before[0]);
  assert.equal(after[0].coins, nbaBefore.coins);
  assert.deepEqual(after[0].ut.owned, nbaBefore.ut.owned);
  assert.equal(after[1], before[1]);
  assert.equal(after[2], 'soccer');
  await shot(page, 'soccer-switch-1-soccer');
  noErrors(errors, 'switch');
  report.switch = 'ok';
  await context.close();
}

if (run('draft')) {
  const { page, errors, context } = await fixture(browser, 'soccer', 'Claude QA', 390);
  await wait(page, 1200);
  await page.locator('.playbar button').first().click();
  await wait(page, 1200);
  await draft(page, 'soccer-draft');
  await wait(page, 1200);
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  if (await skip.count()) await skip.click();
  await wait(page, 1200);
  const board = await page.locator('.board').innerText();
  assert.match(board, /DRAWS/);
  await shot(page, 'soccer-season');
  const action = () => page.locator('.actionbar button').last();
  const madeIt = /START THE CUP/.test(await action().innerText());
  await action().click();
  await wait(page, 1200);
  if (madeIt) {
    await shot(page, 'soccer-cup');
    for (let i = 0; i < 30; i++) {
      const t = ((await action().innerText().catch(() => '')) || '').trim();
      if (/SEE RESULTS/.test(t)) {
        await shot(page, 'soccer-cup-done');
        await action().click();
        break;
      }
      if (/^PLAY THE|^NEXT/.test(t)) {
        await action().click();
        await wait(page, 1500);
        if (i === 0) await shot(page, 'soccer-gamecast');
        const sk = page.getByRole('button', { name: /SKIP TO FINAL/ });
        if (await sk.count()) await sk.click();
        const cont = page.getByRole('button', { name: 'CONTINUE' });
        for (let k = 0; k < 12 && !(await cont.count()); k++) await wait(page, 500);
        if (i === 0) await shot(page, 'soccer-gamecast-final');
        if (await cont.count()) {
          await wait(page, 1600);
          await cont.click();
        }
        await wait(page, 1500);
        continue;
      }
      const champ = page.locator('.champ button');
      if (await champ.count()) {
        await shot(page, 'soccer-champions');
        await champ.first().click();
        await wait(page, 1500);
        continue;
      }
      await wait(page, 1000);
    }
  }
  await wait(page, 2500);
  const results = await page.locator('.record').innerText();
  assert.match(results, /\d+\s*–\s*\d+\s*–\s*\d+/);
  await shot(page, 'soccer-results');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:soccer:v1')));
  assert.equal(saved.history.length, 1);
  assert.equal(saved.stats.games, 1);
  noErrors(errors, 'draft');
  report.draft = { wins: saved.history[0].wins, playoff: saved.history[0].playoff };
  await context.close();
}

if (run('arcade')) {
  const { page, errors, context } = await fixture(browser, 'soccer', 'Claude QA', 390);
  const url = new URL(page.url());
  url.searchParams.set('autoplay', '1');
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await wait(page, 2000);
  await page.getByRole('button', { name: /Head to Head|1 vs 1/i }).first().click();
  await page.locator('.playbar button').first().click();
  await page.getByRole('button', { name: /PLAY THE AI NOW/ }).click({ timeout: 20000 });
  await wait(page, 3000);
  await draft(page, 'soccer-1v1');
  // ?autoplay: straight into the match, the autopilot on the ball
  await page.locator('.sc2').waitFor({ timeout: 30000 });
  await wait(page, 6000);
  await shot(page, 'soccer-arcade-live');
  const t0 = Date.now();
  await page.locator('.vs-head').waitFor({ timeout: 420000 });
  report.arcadeSeconds = Math.round((Date.now() - t0) / 1000);
  await wait(page, 2500);
  await shot(page, 'soccer-arcade-result');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:soccer:v1')));
  const last = saved.history[saved.history.length - 1];
  assert.equal(last.mode, '1v1');
  assert.ok(last.vs && typeof last.vs.won === 'boolean', 'a played match has a winner (penalties settle a draw)');
  report.arcade = { won: last.vs.won, line: await page.locator('.vs').innerText().catch(() => '') };
  noErrors(errors, 'arcade');
  await context.close();
}

if (run('ut')) {
  const { page, errors, context } = await fixture(browser, 'soccer', 'Claude QA', 390);
  // a fresh club: the starter pack not opened yet
  await page.evaluate(async () => {
    const { freshUt } = await import('/src/ut/state.ts');
    const p = JSON.parse(localStorage.getItem('perfect-season:profile:soccer:v1'));
    p.ut = freshUt();
    localStorage.setItem('perfect-season:profile:soccer:v1', JSON.stringify(p));
  });
  const url = new URL(page.url());
  url.searchParams.set('autoplay', '1');
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await wait(page, 2000);
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.locator('.ut-starter').waitFor({ timeout: 60000 });
  await shot(page, 'soccer-ut-starter');
  await page.locator('.ut-starter').click();
  for (let i = 0; i < 40; i++) {
    const done = page.getByRole('button', { name: 'DONE', exact: true });
    if (await done.isVisible().catch(() => false)) {
      await shot(page, 'soccer-ut-starter-cards');
      await done.click();
      break;
    }
    const skip = page.locator('.ut-skip');
    if (await skip.isVisible().catch(() => false)) await skip.click();
    else await page.mouse.click(195, 420);
    await wait(page, 700);
  }
  await wait(page, 1000);
  const owned = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:soccer:v1')).ut);
  assert.equal(owned.starterClaimed, true);
  assert.ok(owned.owned.length >= 15);
  assert.equal(Object.keys(owned.squad).length, 11);
  await page.locator('.ut-tabs button', { hasText: 'SQUAD' }).first().click();
  await wait(page, 1200);
  await shot(page, 'soccer-ut-squad');
  await page.getByRole('group', { name: 'Formation' }).getByRole('button', { name: '4-4-2' }).click();
  await wait(page, 800);
  await shot(page, 'soccer-ut-squad-442');
  const f = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:soccer:v1')).ut.formation);
  assert.equal(f, '4-4-2');
  await page.getByRole('group', { name: 'Formation' }).getByRole('button', { name: '4-3-3' }).click();
  await wait(page, 500);
  // a match: Squad Battles, the first rung (?autoplay plays it)
  await page.locator('.ut-tabs button', { hasText: 'PLAY' }).first().click();
  await wait(page, 800);
  // Claude review: the overhaul Play hub also has a PLAY SQUAD BATTLES recommendation; open the mode row
  await page.locator('.play-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click();
  await wait(page, 1200);
  await shot(page, 'soccer-ut-battles');
  await page.getByRole('button', { name: /^Rung 1:/ }).click();
  await wait(page, 1500);
  const go = page.getByRole('button', { name: /^PLAY/ }).last();
  if (await go.isVisible().catch(() => false)) await go.click();
  await page.locator('.sc2').waitFor({ timeout: 60000 });
  await wait(page, 5000);
  await shot(page, 'soccer-ut-match');
  await page.getByRole('heading', { name: /WIN|LOSS/, exact: true }).waitFor({ timeout: 420000 });
  await wait(page, 1500);
  await shot(page, 'soccer-ut-match-result');
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('perfect-season:profile:soccer:v1')).ut.record);
  assert.equal(rec.w + rec.l, 1);
  report.ut = { record: rec };
  const back = page.getByRole('button', { name: /CONTINUE|DONE|BACK/ }).first();
  if (await back.isVisible().catch(() => false)) await back.click();
  await wait(page, 1500);
  await page.locator('.ut-tabs button', { hasText: 'STORE' }).first().click();
  await wait(page, 1200);
  const store = await page.locator('.page').first().innerText();
  assert.doesNotMatch(store, /Spotlight Pack/);
  await shot(page, 'soccer-ut-store');
  noErrors(errors, 'ut');
  await context.close();
}

if (run('widths')) {
  for (const width of [430, 390, 320]) {
    const { page, errors, context } = await fixture(browser, 'soccer', 'Claude QA', width, width === 320 ? { viewport: { width: 320, height: 568 } } : width === 430 ? { viewport: { width: 430, height: 932 } } : {});
    await wait(page, 1500);
    await shot(page, 'soccer-w' + width + '-home');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, 'no sideways scroll at ' + width);
    await page.locator('.playbar button').first().click();
    await wait(page, 1500);
    await page.locator('.actionbar button').last().click();
    await wait(page, 3500);
    await shot(page, 'soccer-w' + width + '-draft');
    await page.getByRole('button', { name: 'Leave draft' }).click();
    const leave = page.getByRole('button', { name: /LEAVE/ }).last();
    if (await leave.isVisible().catch(() => false)) await leave.click();
    await wait(page, 1200);
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs').waitFor({ timeout: 60000 });
    await wait(page, 1500);
    await shot(page, 'soccer-w' + width + '-ut-home');
    for (const t of ['SQUAD', 'STORE']) {
      await page.locator('.ut-tabs button', { hasText: t }).first().click();
      await wait(page, 1200);
      await shot(page, 'soccer-w' + width + '-ut-' + t.toLowerCase());
    }
    noErrors(errors, 'widths ' + width);
    await context.close();
  }
  report.widths = 'ok';
}

await browser.close();
console.log(JSON.stringify({ base, ...report }, null, 1));
