// Claude, 2026-11-01: isolated localhost QA for UT content drop 2 (docs/UT-CONTENT-2.md).
// Both sports at 390 and 320: Daily Drop, every new pack, Scout's Choice pick, Scout Market buy,
// a Set claim, a UT Draft entry through a real (simmed) match, the Weekly Standouts page, the SBC
// tab and the squad's chemistry pips; one weekend run buys the Lightning pack. Screenshots go to
// PS_QA_ARTIFACTS; any page error fails the run.
//   PS_QA_URL=http://localhost:5185/ node scripts/qa/ut-content.mjs
import assert from 'node:assert/strict';
import { launch, fixture, shot } from './browser.mjs';

const browser = await launch();
const log = (...a) => console.log('[ut-content]', ...a);

/** finish any pack opening on screen (reduced motion: tap the seal, skip, DONE) */
async function finishOpening(page) {
  const screen = page.locator('.ut-open-screen');
  await screen.waitFor({ timeout: 15000 });
  for (let k = 0; k < 12; k++) {
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
      }
    }
    await page.waitForTimeout(250);
  }
}
async function closeOpening(page) {
  await page.getByRole('button', { name: 'DONE', exact: true }).click();
  await page.locator('.ut-open-screen').waitFor({ state: 'detached', timeout: 8000 });
}
const tab = (page, label) => page.locator('.ut-tabs button').filter({ hasText: new RegExp('^' + label + '[0-9]*$') }).click();

async function run(sport, width, opts = {}) {
  const tag = sport + '-' + width + (opts.weekend ? '-weekend' : '');
  const ctx = opts.weekend ? {} : {};
  const { page, context, current, errors, original } = await fixture(browser, sport, 'Claude Content', width, ctx);
  if (opts.weekend) {
    // a Saturday 12:30 Eastern: the Lightning window is open
    await context.clock.setSystemTime(new Date('2026-11-07T17:30:00Z'));
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  // seed one completable franchise-era set (discovery-based) without touching the fixture's cards
  await page.evaluate(async (sport) => {
    const { getPool } = await import('/src/ut/pool.ts');
    const { setsFor } = await import('/src/ut/sets.ts');
    const { saveProfile, loadProfile } = await import('/src/lib/profile.ts');
    const pool = await getPool();
    const p = loadProfile();
    const era = setsFor(pool, p.ut).find((s) => s.kind === 'era' && s.have < s.need);
    const [, fr, decade] = era.id.split(':');
    const pids = new Set();
    const ids = Object.values(pool.buckets.gold)
      .flat()
      .filter((rc) => rc.line.kind === 'season' && rc.line.fr === fr && Math.floor(rc.line.season / 10) * 10 === Number(decade) && !pids.has(rc.line.pid) && pids.add(rc.line.pid))
      .map((rc) => rc.line.id);
    p.ut.collected = [...new Set([...(p.ut.collected ?? []), ...ids])];
    p.coins = 40000;
    saveProfile(p);
    void sport;
  }, sport);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.getByRole('button', { name: 'PLAY HQ', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  await shot(page, 'utc-' + tag + '-home');

  // ---- New Era thank-you bundle (the fixture is a pre-update save: eligible once) ----
  if (!opts.weekend) {
    const e0 = await current();
    await page.locator('.ut-new-era').waitFor();
    await page.getByRole('button', { name: 'CLAIM YOUR NEW ERA BUNDLE', exact: true }).click();
    await page.locator('.ut-pick-screen').waitFor();
    await page.waitForTimeout(500);
    await shot(page, 'utc-' + tag + '-new-era-pick');
    await page.locator('.ut-pick-card').nth(0).click();
    await page.getByRole('button', { name: 'KEEP THIS PLAYER', exact: true }).click();
    await finishOpening(page);
    await closeOpening(page);
    const e1 = await current();
    assert.equal(e1.coins, e0.coins + 65000, 'New Era coins once');
    assert.equal(e1.ut.owned.length, e0.ut.owned.length + 1, 'one Icon kept');
    assert.equal(await page.locator('.ut-new-era').count(), 0, 'bundle claimed once');
  }

  // ---- Daily Drop from Home ----
  const before0 = await current();
  const coins0 = before0.coins;
  await page.locator('.ut-home-daily').click();
  await finishOpening(page);
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-daily-reveal');
  await closeOpening(page);
  let p = await current();
  assert.equal(p.coins, coins0, 'Daily Drop is free');
  assert.ok(p.ut.content.daily.streak >= 1, 'streak recorded');
  const ownedAfterDaily = p.ut.owned.length;
  assert.equal(ownedAfterDaily, before0.ut.owned.length + (sport === 'nba' ? 3 : 6));
  await page.locator('.ut-home-daily').click(); // claimed: goes to the Store, no second drop
  await page.waitForTimeout(300);
  assert.equal((await current()).ut.owned.length, ownedAfterDaily, 'Daily Drop opens once a day');

  // ---- Store: every new pack ----
  await tab(page, 'STORE');
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-store');
  const packs = opts.weekend ? ['Lightning Standout'] : ['Standout Guarantee', 'Elite Gold', 'Jumbo Premium'];
  for (const name of packs) {
    const before = await current();
    await page.getByRole('button', { name: new RegExp('^Buy ' + name + ' for') }).click();
    await finishOpening(page);
    await page.waitForTimeout(250);
    await shot(page, 'utc-' + tag + '-' + name.toLowerCase().replace(/[^a-z]+/g, '-'));
    await closeOpening(page);
    const after = await current();
    assert.ok(after.coins < before.coins, name + ' charges coins');
    assert.ok(after.ut.owned.length > before.ut.owned.length, name + ' adds cards');
    if (name.includes('Standout')) assert.ok(after.ut.owned.slice(before.ut.owned.length).some((c) => c.cardId.split(':')[1] === 'standout'), 'a Standout is guaranteed');
    log(tag, name, before.coins - after.coins);
  }
  if (opts.weekend) {
    const left = await page.locator('.s-lightning .ut-limit').innerText();
    assert.match(left, /Limit reached/);
    await finishContext();
    return;
  }
  // ---- Scout's Choice ----
  await page.mouse.wheel(0, 400);
  const beforePick = await current();
  await page.getByRole('button', { name: /^Buy Scout’?'?s Choice for/ }).click();
  await page.locator('.ut-pick-screen').waitFor();
  await shot(page, 'utc-' + tag + '-pick-facedown');
  const reveal = page.getByRole('button', { name: 'REVEAL', exact: true });
  if (await reveal.isVisible().catch(() => false)) await reveal.click();
  await page.waitForTimeout(1600);
  await page.locator('.ut-pick-card').nth(1).click();
  await shot(page, 'utc-' + tag + '-pick-chosen');
  await page.getByRole('button', { name: 'KEEP THIS PLAYER', exact: true }).click();
  await finishOpening(page);
  await closeOpening(page);
  const afterPick = await current();
  assert.equal(afterPick.ut.owned.length, beforePick.ut.owned.length + 1, 'exactly one kept');
  assert.equal(afterPick.ut.content.picks.length, 0, 'the pick closes');

  // ---- Scout Market ----
  await page.getByRole('button', { name: 'SCOUT MARKET', exact: true }).click();
  await page.waitForTimeout(400);
  await shot(page, 'utc-' + tag + '-market');
  const mBefore = await current();
  await page.locator('.ut-market-item').nth(2).click();
  await finishOpening(page);
  await closeOpening(page);
  const mAfter = await current();
  assert.ok(mAfter.coins < mBefore.coins, 'market charges');
  assert.equal(mAfter.ut.content.market.bought.length, 1);
  assert.ok(await page.locator('.ut-market-item').nth(2).isDisabled(), 'bought once');

  // ---- a Set ----
  await tab(page, 'HOME');
  await page.getByRole('button', { name: /^Sets/ }).click();
  await page.getByRole('button', { name: 'Franchise eras', exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-sets');
  const sBefore = await current();
  await page.locator('.ut-set-claim').first().click();
  await page.waitForTimeout(300);
  const sAfter = await current();
  assert.ok(sAfter.coins > sBefore.coins, 'set pays coins');
  assert.ok(sAfter.ut.content.claims.some((c) => c.startsWith('set:era:')), 'set claimed once');
  await page.getByRole('button', { name: 'Landmarks', exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, 'utc-' + tag + '-landmarks');

  // ---- Weekly Standouts and SBCs ----
  await tab(page, 'HOME');
  await page.locator('.ut-home-so').click();
  await page.waitForTimeout(500);
  await shot(page, 'utc-' + tag + '-standouts');
  await tab(page, 'SBC');
  await page.locator('.ut-sbc.so').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-sbc');

  // ---- Squad pips ----
  await tab(page, 'SQUAD');
  await page.waitForTimeout(600);
  assert.ok((await page.locator('.ut-pips').count()) > 0, 'chemistry pips show');
  await shot(page, 'utc-' + tag + '-squad');

  // ---- UT Draft: free entry, captain, auto-draft, one real (simmed) match ----
  await tab(page, 'PLAY');
  await page.getByRole('button', { name: /UT DRAFT/ }).click();
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-draft-intro');
  await page.getByRole('button', { name: 'FREE WEEKLY ENTRY', exact: true }).click();
  await page.locator('.ut-draft-opt').first().waitFor();
  await shot(page, 'utc-' + tag + '-draft-captain');
  await page.locator('.ut-draft-opt').nth(0).click();
  await page.waitForTimeout(200);
  await shot(page, 'utc-' + tag + '-draft-pick');
  await page.getByRole('button', { name: 'AUTO-DRAFT THE REST', exact: true }).click();
  await page.locator('.ut-draft-next .btn').waitFor();
  await shot(page, 'utc-' + tag + '-draft-ready');
  const dBefore = await current();
  assert.equal(dBefore.ut.owned.length, mAfter.ut.owned.length, 'drafting never touches the club');
  await page.locator('.ut-draft-next .btn').click();
  await page.locator('.vote-opt.sim').click({ timeout: 30000 });
  await page.locator('.utm-result').waitFor({ timeout: 90000 });
  await page.waitForTimeout(400);
  await shot(page, 'utc-' + tag + '-draft-result');
  const dAfter = await current();
  assert.equal(dAfter.ut.content.draft.active.games, 1, 'one game settled');
  assert.equal(dAfter.coins, dBefore.coins, 'draft games pay at the end');
  await page.getByRole('button', { name: 'DONE', exact: true }).click();
  await page.getByRole('button', { name: /PLAY HQ|CLAIM REWARDS|END RUN NOW/ }).first().waitFor({ timeout: 30000 });
  const retire = page.getByRole('button', { name: /END RUN NOW/ });
  if (await retire.isVisible().catch(() => false)) await retire.click();
  await page.getByRole('button', { name: 'CLAIM REWARDS', exact: true }).click();
  await page.waitForTimeout(300);
  const dEnd = await current();
  assert.equal(dEnd.ut.content.draft.active, undefined, 'run closed');
  assert.equal(dEnd.ut.content.draft.history.length, 1);
  await shot(page, 'utc-' + tag + '-draft-claimed');
  await finishContext();

  async function finishContext() {
    assert.deepEqual(errors, [], tag + ' page errors');
    await context.close();
    log(tag, 'ok');
  }
}

try {
  for (const sport of ['nba', 'nfl']) for (const width of [390, 320]) await run(sport, width);
  for (const sport of ['nba', 'nfl']) await run(sport, 390, { weekend: true });
  log('all ok');
} finally {
  await browser.close();
}
