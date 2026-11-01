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
    const legend = Object.values(pool.buckets.legend).flat()[0];
    p.ut.owned.push({ uid: 'qa-holo', cardId: 'holo~' + legend.line.id, level: 1, xp: 0, at: 99 });
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
  await shot(page, 'utc-' + tag + '-home-inbox');
  await page.locator('.ut-home-daily').click();
  await page.locator('.ut-dailyhub').waitFor();
  await shot(page, 'utc-' + tag + '-daily-hub');
  await page.locator('.ut-dailyhub .ut-daily-btn').click();
  await finishOpening(page);
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-daily-reveal');
  await closeOpening(page);
  let p = await current();
  assert.equal(p.coins, coins0, 'Daily Drop is free');
  assert.ok(p.ut.content.daily.streak >= 1, 'streak recorded');
  const ownedAfterDaily = p.ut.owned.length;
  assert.equal(ownedAfterDaily, before0.ut.owned.length + (sport === 'nba' ? 3 : 6));
  assert.equal(await page.locator('.ut-dailyhub .ut-daily-btn').count(), 0, 'Daily Drop opens once a day');
  // ---- login calendar (wave 2) ----
  const c0 = await current();
  await page.locator('.ut-cal-claim').click();
  await page.waitForTimeout(300);
  const c1 = await current();
  assert.equal(c1.ut.content.calendar.n, 1, 'calendar day 1 claimed');
  assert.ok(await page.locator('.ut-cal-claim').isDisabled(), 'calendar once a day');
  assert.ok(c1.ut.packs.length > c0.ut.packs.length, 'calendar day 1 pack');
  await shot(page, 'utc-' + tag + '-calendar');
  assert.equal((await current()).ut.owned.length, ownedAfterDaily);
  // ---- Rewards inbox: CLAIM ALL ----
  await tab(page, 'HOME');
  await page.locator('.ut-home-inbox').click();
  await page.locator('.ut-inbox').waitFor();
  await shot(page, 'utc-' + tag + '-inbox');
  const claimAllBtn = page.locator('.ut-claim-all');
  if (await claimAllBtn.isVisible().catch(() => false)) {
    await claimAllBtn.click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.ut-claim-all').count(), 0, 'claim all clears the inbox');
    await shot(page, 'utc-' + tag + '-inbox-claimed');
  }

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
  // (the Rewards inbox's CLAIM ALL may already have paid the seeded set)
  if (await page.locator('.ut-set-claim').count()) {
    await page.locator('.ut-set-claim').first().click();
    await page.waitForTimeout(300);
    assert.ok((await current()).coins > sBefore.coins, 'set pays coins');
  }
  const sAfter = await current();
  assert.ok(sAfter.ut.content.claims.some((c) => c.startsWith('set:')), 'a set claimed once');
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

  // ---- Preview Pack (wave 2) ----
  await tab(page, 'STORE');
  await page.getByRole('button', { name: 'PACKS', exact: true }).click();
  await page.getByRole('button', { name: 'PREVIEW A PACK', exact: true }).click();
  await page.locator('.ut-preview-cards').waitFor();
  const prev1 = await page.locator('.ut-preview-cards .utc').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await page.locator('.ut-preview').scrollIntoViewIfNeeded();
  await shot(page, 'utc-' + tag + '-preview');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.getByRole('button', { name: 'PLAY HQ', exact: true }).waitFor({ timeout: 60000 });
  await tab(page, 'STORE');
  await page.locator('.ut-preview-cards').waitFor();
  const prev2 = await page.locator('.ut-preview-cards .utc').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  assert.deepEqual(prev2, prev1, 'a reload shows the same preview');
  const pv0 = await current();
  await page.getByRole('button', { name: /^Buy the previewed pack/ }).click();
  await finishOpening(page);
  const opened = await page.locator('.ut-reveal-grid .utc').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  assert.deepEqual([...opened].sort(), [...prev1].sort(), 'bought exactly the previewed cards');
  await closeOpening(page);
  assert.ok((await current()).coins < pv0.coins, 'preview pack charged');
  await page.getByRole('button', { name: 'SKIP', exact: true }).click();
  await page.locator('.ut-preview-wait').waitFor();

  // ---- Streamlined SBC (wave 2) ----
  await tab(page, 'SBC');
  await page.locator('.ut-stream').first().click();
  await page.locator('.ut-stream-sheet').waitFor();
  await page.locator('.ut-stream-card').nth(0).click();
  await page.locator('.ut-stream-card').nth(1).click();
  await shot(page, 'utc-' + tag + '-stream');
  await page.getByRole('button', { name: /^ADD 2 CARDS/ }).click();
  await page.waitForTimeout(500);
  assert.ok((await current()).ut.content.streams.gold > 0, 'stream progress saved');

  // ---- Evolutions lab (wave 2) ----
  await tab(page, 'HOME');
  await page.getByRole('button', { name: /DEVELOPMENT/ }).click();
  await page.getByRole('button', { name: /EVOLUTIONS LAB/ }).click();
  await page.locator('.ut-evos').waitFor();
  await shot(page, 'utc-' + tag + '-evolutions');
  await page.locator('.ut-evo-def .btn').first().click();
  await page.locator('.ut-evo-choose').waitFor();
  await shot(page, 'utc-' + tag + '-evo-choose');
  await page.locator('.ut-evo-row .btn:not([disabled])').first().click();
  await page.waitForTimeout(400);
  const evoUid = Object.keys((await current()).ut.content.evo)[0];
  assert.ok(evoUid, 'an evolution started');
  // finish its objectives (the matches themselves are covered by the unit tests), then apply it
  await page.evaluate(async (uid) => {
    const { loadProfile, saveProfile } = await import('/src/lib/profile.ts');
    const p = loadProfile();
    p.ut.content.evo[uid].active.games = 9;
    p.ut.content.evo[uid].active.wins = 9;
    saveProfile(p);
  }, evoUid);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.getByRole('button', { name: 'PLAY HQ', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /DEVELOPMENT/ }).click();
  await page.getByRole('button', { name: /EVOLUTIONS LAB/ }).click();
  await page.getByRole('button', { name: 'APPLY', exact: true }).click();
  await page.waitForTimeout(400);
  assert.deepEqual((await current()).ut.content.evo[evoUid].done, ['rising-1'], 'evolution applied once');
  await shot(page, 'utc-' + tag + '-evo-applied');

  // ---- holographic card details (seeded holo legend) ----
  await tab(page, 'CLUB');
  await page.locator('.ut-gridcard', { has: page.locator('.utc.is-holo') }).first().click();
  await page.waitForTimeout(500);
  await shot(page, 'utc-' + tag + '-holo');
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await page.waitForTimeout(300);

  // ---- Favourite / LOCK from the card details ----
  await tab(page, 'CLUB');
  await page.locator('.ut-gridcard').first().click();
  await page.getByRole('button', { name: 'LOCK AS FAVOURITE', exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-locked');
  assert.equal((await current()).ut.content.locked.length, 1, 'card locked');
  assert.ok(await page.locator('.ut-detail-btns .btn.danger').isDisabled(), 'locked card cannot be sold');
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await page.waitForTimeout(400);

  // ---- UT Draft: free entry, captain, auto-draft, one real (simmed) match ----
  await tab(page, 'PLAY');
  await page.getByRole('button', { name: /UT DRAFT/ }).click();
  await page.waitForTimeout(300);
  await shot(page, 'utc-' + tag + '-draft-intro');
  const ownedBeforeDraft = (await current()).ut.owned.length;
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
  assert.equal(dBefore.ut.owned.length, ownedBeforeDraft, 'drafting never touches the club');
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

/** Wave 3: the Live Calendar on a given Eastern date (the clock is moved; no app-side override). */
async function runCalendar(sport, width, iso, label) {
  const tag = sport + '-' + width + '-' + label;
  const { page, context, current, errors } = await fixture(browser, sport, 'Claude Calendar', width);
  await context.clock.setSystemTime(new Date(iso));
  await page.evaluate(async () => {
    const { saveProfile, loadProfile } = await import('/src/lib/profile.ts');
    const p = loadProfile();
    p.coins = 40000;
    saveProfile(p);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ultimate Team:/ }).click();
  await page.getByRole('button', { name: 'PLAY HQ', exact: true }).waitFor({ timeout: 60000 });
  await page.locator('.ut-season-banner').waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'cal-' + tag + '-home');
  // the Store's This Season row: buy the first program pack
  await tab(page, 'STORE');
  await page.locator('.s-live').first().waitFor();
  await page.locator('.s-live').first().scrollIntoViewIfNeeded();
  await shot(page, 'cal-' + tag + '-store');
  const b0 = await current();
  await page.locator('.s-live .ut-buy').first().click();
  await finishOpening(page);
  await page.waitForTimeout(300);
  await shot(page, 'cal-' + tag + '-program-pack');
  await closeOpening(page);
  const b1 = await current();
  assert.ok(b1.coins < b0.coins, 'program pack charged');
  // the SBC tab's This Season section
  await tab(page, 'SBC');
  await page.locator('.ut-sbc.prog').first().waitFor();
  await page.locator('.ut-sbc.prog').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, 'cal-' + tag + '-sbc');
  assert.deepEqual(errors, [], tag + ' page errors');
  await context.close();
  log(tag, 'ok');
}

try {
  for (const [iso, label] of [
    ['2026-11-27T17:00:00Z', 'black-friday'],
    ['2027-01-15T17:00:00Z', 'honors'],
    ['2027-06-23T17:00:00Z', 'finale'],
  ])
    for (const sport of ['nba', 'nfl']) await runCalendar(sport, label === 'honors' ? 320 : 390, iso, label);
  for (const sport of ['nba', 'nfl']) for (const width of [390, 320]) await run(sport, width);
  for (const sport of ['nba', 'nfl']) await run(sport, 390, { weekend: true });
  log('all ok');
} finally {
  await browser.close();
}
