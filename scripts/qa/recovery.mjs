// Claude (studio overhaul, shell-4, 2026-11-16): the recovery screen and the arena signal, in the real
// app (dev server only: the crash hook `?qa-crash=` exists only there). Isolated like every shell run:
// ?ns=inspect, the local relay, every other host aborted, serialized fixture players only. It never
// taps SAVE NOW, ERASE, CLAIM, SELL or anything that spends.
//
//   node scripts/qa/recovery.mjs [--parts crash,chunk,arena,draft,online,lazy] [--sports nba,nfl,soccer] [--match-ms 60000] [--chunk-via ut|draft]
//   (default parts: crash,chunk,arena; draft, online and lazy were added by the shell-4 review fix)
//
// crash: ?qa-crash=root|view|tab|ut|arena. The recovery card must be in the frame the error happens in
//   (rAF frame log), no frame may be blank, and the screenshot must not be blank. Then RELOAD (with the
//   hook taken off the URL) must land on Home with coins, XP, ut.owned (levels included) and the squad
//   deep-equal to the player before the crash. ut also checks BACK TO HOME; arena (a UT match) checks
//   BACK TO ULTIMATE TEAM, which lands on UT as the match's own exit does.
// chunk: the match file aborted at the network (NBA/NFL the attributes file, soccer the soccer engine)
//   while a Squad Battles match opens: recovery within 1 s, never "Walking out…" or a disabled PLAY; the
//   copy switches to the offline wording when the phone goes offline.
// arena: arenaActive() against `body > .arcade-full` on every frame, from insertion to removal, through
//   a UT Squad Battles match (?autoplay, played to its end), Training Camp and a Moment (NBA/NFL); the
//   observer's total callback time over the first --match-ms of the match; shellWork() refused and
//   counted while a match is on. (Draft matches mount the same Arcade and engines as UT matches.)
// draft: Head to Head vs the AI, the draft played to the Vote (shell-5's loop), PLAY, the arena crashes
//   (?qa-crash=arena): "This match stopped" with no loss line, BACK TO HOME lands on Home through
//   leaveDraft, progress deep-equal. Draft → Vote → PLAY is the same Arcade as a UT match.
// online: two phones on an isolated relay (an ephemeral port, signature-checked, never 7777) meet in a
//   quick Head to Head, draft, both vote PLAY; phone A's arena crashes. A's card must say the online
//   match counts as a loss; BACK TO HOME must close the match and record it at once: activeMatch null
//   and h2h.l up by exactly 1, still exactly 1 after a relaunch (no second forfeit at boot). Needs the
//   ws package (PS_QA_WS_PACKAGE_JSON=<a package.json with ws installed> when the repo has none).
// lazy: a lazy screen's chunk (UltimateTeam) aborted. Offline: the recovery card ("You're offline")
//   with BACK TO HOME, not the old bare ScreenMissing. Online: one reload into the live build, then the
//   card ("Part of the game didn't load") on the next tap, never a reload loop.
// chunk falls back to a draft match when a UT match never asks for the attribute file (after the
//   merge with nfl-3, NFL Ultimate Team teams arrive pre-rated).
// Output: <PS_QA_SHOTS>/shell-4/recovery/recovery-<parts>.json and screenshots there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { artifacts, base, buildRoot, fixture, launch, require } from './browser.mjs';
import { readPixels } from './edge-lib.mjs';
import { openUt, waitForHome } from './fixtures.mjs';

if (buildRoot) throw Error('recovery.mjs runs on the dev server: the ?qa-crash hook is not in production builds.');
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const parts = opt('parts', 'crash,chunk,arena').split(',');
const sports = opt('sports', 'nba,nfl,soccer').split(',');
const matchMs = +opt('match-ms', 60000);
// chunk: 'ut' (default; falls back to a draft match when the UT match never asks for the file) or 'draft'
const chunkVia = opt('chunk-via', 'ut');
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), 'shell-4', 'recovery');
fs.mkdirSync(OUT, { recursive: true });
const ctxOpts = { isMobile: true, hasTouch: true };
const opts = { insets: [59, 0, 34, 0], height: 852, serialized: true };
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Every rAF frame: does the page show the recovery card (R), an arena (A), app content (C)? Only changes are kept. */
function frameLog() {
  window.__ps = { f: 0, log: [], clickF: null, clickT: null, arenaInF: null, mismatch: [], arenaFrames: 0, frames: 0 };
  const s = window.__ps;
  addEventListener('click', () => ((s.clickF = s.f), (s.clickT = performance.now())), true);
  // the frame an arena is inserted in, even one that is gone again before it is painted
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) if (s.arenaInF === null && n.classList?.contains('arcade-full')) s.arenaInF = s.f;
  }).observe(document, { childList: true, subtree: true });
  let last = null;
  const tick = () => {
    s.f++;
    const arena = !!document.querySelector('body > .arcade-full');
    const st = (document.querySelector('.recovery') ? 'R' : '') + (arena ? 'A' : '') + (document.querySelector('.stage .screen, .stage .shell, .stage .view') ? 'C' : '') + (document.querySelector('.splash') ? 'S' : '');
    if (st !== last) s.log.push({ f: s.f, t: Math.round(performance.now()), s: st });
    last = st;
    if (window.__psArenaMod) {
      s.frames++;
      if (arena) s.arenaFrames++;
      if (window.__psArenaMod.arenaActive() !== arena) s.mismatch.push({ f: s.f, dom: arena });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function open(browser, sport, crash, extra = {}, { relay = 'ws://localhost:7777', name = 'Shell QA', serialized = true } = {}) {
  const f = await fixture(browser, sport, name, 393, ctxOpts, { ...opts, serialized, relay });
  await f.context.addInitScript(frameLog);
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay, ...(crash ? { 'qa-crash': crash } : {}), ...extra });
  await f.page.goto(u.href, { waitUntil: 'domcontentloaded' });
  // the dev server's own module instance of arena.ts: the same one the app uses
  await f.page.evaluate(async () => {
    window.__psArenaMod = await import('/src/shell/arena.ts');
    window.__psSameArena = window.__psArenaMod.cost === window.__psArenaObserver;
  });
  return f;
}

const frames = (page) => page.evaluate(() => window.__ps);
/** Screenshot, and how varied it is (a blank screen has a luminance spread near 0). */
async function capture(page, name) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file });
  const px = await readPixels(page, { regions: [{ y0: 0, y1: await page.evaluate(() => innerHeight), lumas: true }] });
  const l = px.regions[0].lumas;
  const mean = l.reduce((a, b) => a + b, 0) / l.length;
  const sd = Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length);
  return { file: path.basename(file), lumaSd: Math.round(sd * 10) / 10, blank: sd < 3 };
}
/** The recovery card's text and its buttons' sizes. */
const card = (page) =>
  page.evaluate(() => {
    const r = document.querySelector('.recovery');
    if (!r) return null;
    const b = [...r.querySelectorAll('button')].map((x) => ({ t: x.textContent.trim(), w: Math.round(x.getBoundingClientRect().width), h: Math.round(x.getBoundingClientRect().height) }));
    return { cls: r.className, title: r.querySelector('h2')?.textContent, body: r.querySelector('p')?.textContent, buttons: b };
  });
const keyFields = (p) => ({ coins: p.coins, xp: p.xp, owned: p.ut.owned, squad: p.ut.squad });

/** UT → PLAY → Squad Battles → rung 1 → the match's kickoff (Arcade is mounted there). */
async function toKickoff(page) {
  await openUt(page);
  await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
  await page.locator('.hq-mode').filter({ hasText: /SQUAD BATTLES/ }).click();
  await page.getByRole('button', { name: /^Rung 1:/ }).click();
  const go = page.getByRole('button', { name: /^PLAY\s+\S/ }).first(); // "PLAY  Run your offense…", not the Play tab
  const arena = page.locator('body > .arcade-full');
  // with ?autoplay the match starts at once; otherwise its PLAY / SIM choice comes first
  await Promise.race([go.waitFor({ timeout: 30000 }), arena.waitFor({ timeout: 30000 })]);
  if (!(await arena.count())) await go.click();
}

async function reloadHome(page, sport) {
  await page.evaluate(() => {
    const u = new URL(location.href);
    u.searchParams.delete('qa-crash');
    history.replaceState(null, '', u.href);
  });
  const nav = page.waitForEvent('framenavigated');
  await page.getByRole('button', { name: 'RELOAD', exact: true }).click();
  await nav;
  await waitForHome(page);
  return page.url();
}

const visible = (loc) => loc.isVisible().catch(() => false);

/** Home → Head to Head → PLAY: the Search screen (quick match searching). */
async function toSearch(page) {
  await page.locator('.mode').filter({ hasText: /head to head/i }).first().click();
  await page.locator('.home .playbar button').first().click();
  await page.locator('.screen.search').waitFor({ timeout: 30000 });
}

/** shell-5's draft loop (edge-walk.mjs): SPIN, show the players, take the first who fits, place him; until the Vote. */
async function draftToVote(page, ms = 240000) {
  const end = Date.now() + ms;
  const action = page.getByRole('button', { name: /^(SPIN|SHOW PLAYERS|NO ONE FITS · FREE RESPIN|SEE THE MATCHUP)$/ });
  while (Date.now() < end) {
    if (await page.locator('.screen.vote').count()) return true;
    const row = page.locator('.drawer.open .row:not([aria-disabled="true"])').first();
    const glow = page.locator('.slot-empty.glow').first();
    const hide = page.getByRole('button', { name: 'Hide players' });
    if (await visible(glow)) await glow.click({ timeout: 5000 }).catch(() => {});
    else if (await visible(row)) await row.click({ timeout: 5000 }).catch(() => {});
    else if (await visible(page.locator('.drawer.open'))) await hide.click({ timeout: 5000 }).catch(() => {});
    else if (await visible(action.first())) await action.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  return false;
}

/** Search → PLAY THE AI NOW → the draft → the Vote → PLAY: the arcade screen (Arcade mounts, kickoff first). */
async function aiDraftToArcade(page) {
  await toSearch(page);
  await page.getByRole('button', { name: /PLAY THE AI NOW/ }).click({ timeout: 30000 });
  await page.locator('.screen.draft').waitFor({ timeout: 60000 });
  if (!(await draftToVote(page))) throw Error('the draft did not reach the Vote in 240 s');
  await page.locator('.vote-opt.play').click();
}

// ---------- crash ----------
async function crash(browser, sport, where) {
  const f = await open(browser, sport, where);
  const { page } = f;
  const out = { sport, where };
  try {
    if (where === 'ut') {
      await waitForHome(page);
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    } else if (where === 'arena') {
      // the arena comes on screen with the kickoff's PLAY
      await waitForHome(page);
      await toKickoff(page);
      await page.locator('button.big.shine').filter({ hasText: /^PLAY$/ }).click({ timeout: 60000 });
    }
    await page.locator('.recovery').waitFor({ timeout: 60000 });
    const fr = await frames(page);
    const firstR = fr.log.find((e) => e.s.includes('R'));
    const firstShown = fr.log.findIndex((e) => e.s !== '');
    // after the first thing is drawn, a frame with neither the splash, the app nor the card is blank
    out.blankFrames = fr.log.slice(firstShown).filter((e) => e.s === '').length;
    // frames from the trigger to the card: the app's first render (root/view/tab: the first frame
    // with anything of the app's, card included), the tap (ut), or the arena's insertion (arena)
    const from = where === 'ut' ? fr.clickF : where === 'arena' ? fr.arenaInF : fr.log.find((e) => /[RC]/.test(e.s))?.f;
    out.framesToRecovery = from === null || from === undefined ? null : firstR.f - from;
    out.arenaLeft = await page.locator('body > .arcade-full').count();
    out.card = await card(page);
    out.shot = await capture(page, `crash-${sport}-${where}`);
    const logged = await page.evaluate(() => JSON.parse(localStorage.getItem('ps-errors') || '[]')[0]);
    out.logged = logged && { where: logged.where, msg: logged.msg.slice(0, 60) };
    if (where === 'ut' || where === 'arena') {
      if (where === 'arena') {
        // a UT match's card goes back the way the match's own exit does: to Ultimate Team (review fix)
        await page.getByRole('button', { name: 'BACK TO ULTIMATE TEAM', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('.recovery') && document.querySelector('.ut-top, .ut-tabs'), null, { timeout: 20000 });
        out.backToUt = true;
      } else {
        await page.getByRole('button', { name: 'BACK TO HOME', exact: true }).click();
        await page.locator('.home .playbar').waitFor({ timeout: 20000 });
        out.backToHome = true;
      }
      // and the progress as this phone stores it, after a fresh load (the hook fires only on UT or a match)
      await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
      await page.locator('.home .playbar').waitFor({ timeout: 60000 });
      out.afterHome = keyFields(await f.current());
    } else {
      out.reloadedTo = new URL(await reloadHome(page, sport)).search;
      out.afterReload = keyFields(await f.current());
    }
    const after = out.afterReload ?? out.afterHome;
    assert.deepEqual(after, keyFields(f.original), 'progress changed');
    out.progressEqual = true;
    delete out.afterReload;
    delete out.afterHome;
    out.errors = f.errors.filter((e) => !/qa-crash/.test(e));
    out.blocked = [...new Set(f.blocked)];
    // blocked: hosts the app tried and the isolation aborted (none got through)
    out.pass = out.blankFrames === 0 && out.framesToRecovery !== null && out.framesToRecovery <= 1 && !out.shot.blank && out.arenaLeft === 0 && out.errors.length === 0 && out.card.buttons.every((b) => b.h >= 44);
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-crash-${sport}-${where}.png`) }).catch(() => {});
  } finally {
    await f.context.close();
  }
  return out;
}

// ---------- chunk ----------
async function chunk(browser, sport, via = 'ut') {
  const f = await open(browser, sport, null);
  const { page, context } = f;
  const out = { sport, via };
  try {
    const target = sport === 'soccer' ? /\/src\/game\/soccer2\/arcade\.ts/ : new RegExp('/src/data/' + sport + '-attrs\\.json');
    let aborted = 0,
      abortedAt = null;
    await context.route(target, (r) => (aborted++, (abortedAt ??= Date.now()), r.abort('failed')));
    await waitForHome(page);
    if (via === 'draft') await aiDraftToArcade(page);
    else {
      await openUt(page);
      await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
      await page.locator('.hq-mode').filter({ hasText: /SQUAD BATTLES/ }).click();
      await page.getByRole('button', { name: /^Rung 1:/ }).click();
      // the match screen mounts Arcade (and asks for the file) at once, or after its own PLAY
      const go = page.getByRole('button', { name: /^PLAY\s+\S/ }).first(); // "PLAY  Run your offense…", not the Play tab
      await Promise.race([go.waitFor({ timeout: 30000 }), page.locator('.recovery').waitFor({ timeout: 30000 })]);
      if (!(await page.locator('.recovery').count())) await go.click();
    }
    const shown = await page.locator('.recovery').waitFor({ timeout: 8000 }).then(
      () => true,
      () => false
    );
    // a UT match that never asks for the file (teams that arrive rated, as nfl-3's do): the caller
    // runs the same case through a draft match instead
    if (!shown && aborted === 0 && via === 'ut') {
      out.preRated = true;
      return out;
    }
    if (!shown) throw Error('no recovery card within 8 s (aborted ' + aborted + ')');
    const { t0, t1, origin } = await page.evaluate(() => ({ t0: window.__ps.clickT, t1: window.__ps.log.find((e) => e.s.includes('R'))?.t, origin: performance.timeOrigin }));
    out.aborted = aborted;
    // from the failed download to the card on screen (the acceptance), and from the tap (which on the
    // dev server includes fetching the match's unbundled modules first)
    out.msToRecovery = Math.round(origin + t1 - abortedAt);
    out.msFromTap = Math.round(t1 - t0);
    out.walkingOut = await page.getByText('Walking out…').count();
    out.disabledPlay = await page.locator('button.big.shine[disabled]').count();
    out.online = await card(page);
    out.shotOnline = await capture(page, `chunk-${sport}-online`);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(100);
    out.offline = await card(page);
    out.shotOffline = await capture(page, `chunk-${sport}-offline`);
    out.errors = f.errors.filter((e) => !/dynamically imported module|Failed to fetch|soccer2\/arcade|attrs/.test(e));
    out.blocked = [...new Set(f.blocked)];
    out.pass =
      aborted > 0 &&
      out.msToRecovery <= 1000 &&
      out.walkingOut === 0 &&
      out.disabledPlay === 0 &&
      /new version/i.test(out.online.body) &&
      /Connect to the internet, then tap RELOAD/.test(out.offline.body) &&
      !out.shotOnline.blank;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-chunk-${sport}.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
  return out;
}

// ---------- arena ----------
const arenaState = (page) =>
  page.evaluate(() => ({
    active: window.__psArenaMod.arenaActive(),
    dom: !!document.querySelector('body > .arcade-full'),
    cost: { ...window.__psArenaObserver },
    refused: { ...(window.__psShellWorkDuringArena || {}) },
    same: window.__psSameArena,
    mismatch: window.__ps.mismatch.length,
    frames: window.__ps.frames,
    arenaFrames: window.__ps.arenaFrames,
  }));

async function arenaRun(browser, sport, kind) {
  // the UT match plays itself (?autoplay: no kickoff, the autopilot on both ends) so it reaches its end
  const f = await open(browser, sport, null, kind === 'ut-match' ? { autoplay: '' } : {});
  const { page } = f;
  const out = { sport, kind };
  try {
    await waitForHome(page);
    if (kind === 'ut-match') await toKickoff(page);
    else if (kind === 'training') {
      await page.locator('.training-entry').click();
      await page.locator('.camp-drill').first().click({ timeout: 30000 });
      await page.getByRole('button', { name: /LET.S WORK/ }).click({ timeout: 30000 });
    } else if (kind === 'moment') {
      await openUt(page);
      await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
      await page.locator('.hq-mode').filter({ hasText: /MOMENTS/ }).click();
      await page.locator('.hq-moment-tile').first().click();
      await page.getByRole('button', { name: /PLAY MOMENT|PLAY AGAIN/ }).first().click({ timeout: 20000 });
    }
    await page.locator('body > .arcade-full').waitFor({ timeout: 60000 });
    const start = await arenaState(page);
    out.activeAtStart = start.active;
    // a real shell call while the match is on: it must be refused and counted
    out.shellWorkDuring = await page.evaluate(() => window.__psArenaMod.shellWork('qa-probe'));
    // the match: --match-ms of it, or all of it when it ends sooner (an autoplayed soccer match can)
    const window0 = Date.now();
    const span = kind === 'ut-match' ? matchMs : 4000;
    await page.locator('body > .arcade-full').waitFor({ state: 'detached', timeout: span }).catch(() => {});
    const mid = await arenaState(page);
    out.observer = { calls: mid.cost.calls - start.cost.calls, ms: r3(mid.cost.ms - start.cost.ms), overMs: Date.now() - window0 };
    out.endedInWindow = !mid.dom;
    // the invariant, every frame: arenaActive() === an arena is in <body>
    out.activeThroughout = mid.mismatch === 0 && (mid.active || out.endedInWindow);
    if (mid.dom) out.shot = await capture(page, `arena-${sport}-${kind}`);
    // leave: the camp's and the Moment's exits; a UT match has no quit, so it plays to its end
    if (kind === 'training' && mid.dom) await page.getByRole('button', { name: 'Leave training' }).click();
    else if (kind === 'moment' && mid.dom) await page.getByRole('button', { name: 'Leave Moment' }).click();
    const t = Date.now();
    await page.locator('body > .arcade-full').waitFor({ state: 'detached', timeout: kind === 'ut-match' ? 360000 : 10000 });
    out.msToRemoval = Date.now() - t;
    await page.waitForTimeout(200);
    const end = await arenaState(page);
    out.inactiveAfter = !end.active && end.mismatch === 0;
    out.framesSampled = end.frames;
    out.arenaFrames = end.arenaFrames;
    out.refused = end.refused;
    // the whole visit: every body child added or removed since the app started, arena or not
    out.observerWholeVisit = { calls: end.cost.calls, ms: r3(end.cost.ms) };
    out.sameModule = start.same;
    // the callback's own cost, finer than performance.now()'s 0.1 ms steps: the same tracker code over
    // this page's real <body>, its callback driven 20,000 times with an arena record
    out.perCallUs = await page.evaluate(() => {
      let cb = null;
      class MO {
        constructor(f) {
          cb = f;
        }
        observe() {}
        disconnect() {}
      }
      const t = window.__psArenaMod.trackArenas(document.body, MO);
      const node = document.createElement('div');
      node.className = 'arcade-full';
      const recs = [{ addedNodes: [node], removedNodes: [] }];
      const n = 20000;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) cb(recs);
      const us = ((performance.now() - t0) * 1000) / n;
      t.stop();
      return Math.round(us * 100) / 100;
    });
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    out.pass =
      out.activeAtStart && out.activeThroughout && out.inactiveAfter && out.shellWorkDuring === false && out.sameModule && out.observer.ms <= 0.1 && out.errors.length === 0;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-arena-${sport}-${kind}.png`) }).catch(() => {});
  } finally {
    await f.context.close();
  }
  return out;
}

// ---------- draft (review fix): a draft match vs the AI, crashed in the arena ----------
async function draftCrash(browser, sport) {
  const f = await open(browser, sport, 'arena');
  const { page } = f;
  const out = { sport };
  try {
    await waitForHome(page);
    await aiDraftToArcade(page);
    await page.locator('button.big.shine').filter({ hasText: /^PLAY$/ }).click({ timeout: 60000 });
    await page.locator('.recovery').waitFor({ timeout: 60000 });
    const fr = await frames(page);
    out.framesToRecovery = fr.arenaInF === null ? null : fr.log.find((e) => e.s.includes('R')).f - fr.arenaInF;
    out.arenaLeft = await page.locator('body > .arcade-full').count();
    out.card = await card(page);
    out.lossLine = await page.locator('.recovery-loss').count();
    out.shot = await capture(page, `draft-${sport}-arena`);
    await page.getByRole('button', { name: 'BACK TO HOME', exact: true }).click();
    await page.locator('.home .playbar').waitFor({ timeout: 20000 });
    out.backToHome = true;
    await page.waitForTimeout(500);
    const after = keyFields(await f.current());
    assert.deepEqual(after, keyFields(f.original), 'progress changed');
    out.progressEqual = true;
    out.errors = f.errors.filter((e) => !/qa-crash/.test(e));
    out.blocked = [...new Set(f.blocked)];
    out.pass = out.framesToRecovery !== null && out.framesToRecovery <= 1 && out.arenaLeft === 0 && /This match stopped/.test(out.card.title) && /Nothing was saved/.test(out.card.body) && out.lossLine === 0 && !out.shot.blank && out.errors.length === 0;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-draft-${sport}.png`) }).catch(() => {});
  } finally {
    await f.context.close();
  }
  return out;
}

// ---------- online (review fix): an online Head to Head match, crashed in phone A's arena ----------
/** An isolated, signature-checking relay on an ephemeral port (never 7777: every team's isolated app points there). */
async function startRelay() {
  // ws is not a dependency of the app: PS_QA_WS_PACKAGE_JSON may name a scratch package that has it
  let wsReq = require;
  try {
    require.resolve('ws');
  } catch {
    if (!process.env.PS_QA_WS_PACKAGE_JSON) throw Error('the online part needs the ws package: set PS_QA_WS_PACKAGE_JSON to a package.json with ws installed');
    wsReq = createRequire(process.env.PS_QA_WS_PACKAGE_JSON);
  }
  const { WebSocketServer } = wsReq('ws');
  const { verifyEvent } = require('nostr-tools/pure');
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  const clients = new Map();
  const stored = new Map();
  const fits = (e, f) =>
    (!f.kinds || f.kinds.includes(e.kind)) &&
    (!f.authors || f.authors.includes(e.pubkey)) &&
    (!f.since || e.created_at >= f.since) &&
    Object.entries(f).every(([k, v]) => !k.startsWith('#') || e.tags.some((t) => t[0] === k.slice(1) && v.includes(t[1])));
  const send = (socket, data) => socket.readyState === 1 && socket.send(JSON.stringify(data));
  wss.on('connection', (socket) => {
    const subs = new Map();
    clients.set(socket, subs);
    socket.on('close', () => clients.delete(socket));
    socket.on('message', (bytes) => {
      const m = JSON.parse(bytes.toString());
      if (m[0] === 'EVENT') {
        const e = m[1];
        if (!verifyEvent(e)) return send(socket, ['OK', e.id, false, 'invalid signature']);
        if (e.kind >= 30000 && e.kind < 40000) stored.set(e.kind + ':' + e.pubkey + ':' + e.tags.find((t) => t[0] === 'd')?.[1], e);
        for (const [peer, subscriptions] of clients) for (const [id, filters] of subscriptions) if (filters.some((f) => fits(e, f))) send(peer, ['EVENT', id, e]);
        send(socket, ['OK', e.id, true, '']);
      } else if (m[0] === 'REQ') {
        subs.set(m[1], m.slice(2));
        for (const e of stored.values()) if (m.slice(2).some((f) => fits(e, f))) send(socket, ['EVENT', m[1], e]);
        send(socket, ['EOSE', m[1]]);
      } else if (m[0] === 'CLOSE') subs.delete(m[1]);
    });
  });
  await new Promise((resolve) => (wss.address() ? resolve() : wss.once('listening', resolve)));
  return {
    url: 'ws://localhost:' + wss.address().port,
    close: async () => {
      for (const socket of clients.keys()) socket.terminate();
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}

async function onlineCrash(browser, sport) {
  const relay = await startRelay();
  // fresh-built players (not the serialized file), so the two phones have different signing keys
  const a = await open(browser, sport, 'arena', {}, { relay: relay.url, name: 'Shell QA A', serialized: false });
  const b = await open(browser, sport, null, {}, { relay: relay.url, name: 'Shell QA B', serialized: false });
  const out = { sport, relay: relay.url };
  try {
    await Promise.all([waitForHome(a.page), waitForHome(b.page)]);
    const before = await a.current();
    out.before = { l: before.h2h?.l ?? 0, w: before.h2h?.w ?? 0, activeMatch: before.activeMatch ?? null };
    for (const p of [a.page, b.page]) await toSearch(p);
    await Promise.all([a.page, b.page].map((p) => p.locator('.screen.draft').waitFor({ timeout: 60000 })));
    out.matched = await a.page.evaluate((key) => JSON.parse(localStorage.getItem(key)).activeMatch, { nba: 'perfect-season:profile:v1', nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' }[sport]);
    const drafted = await Promise.all([draftToVote(a.page, 300000), draftToVote(b.page, 300000)]);
    if (!drafted.every(Boolean)) throw Error('an online draft did not reach the Vote: ' + drafted);
    await Promise.all([a.page, b.page].map((p) => p.locator('.vote-opt.play').click()));
    // B kicks off too, so A's rival is live while A's arena breaks
    await Promise.all([a.page, b.page].map((p) => p.locator('button.big.shine').filter({ hasText: /^PLAY$/ }).click({ timeout: 60000 })));
    await a.page.locator('.recovery').waitFor({ timeout: 60000 });
    out.card = await card(a.page);
    out.lossLine = await a.page.locator('.recovery-loss').textContent().catch(() => null);
    out.shot = await capture(a.page, `online-${sport}-arena`);
    out.activeBeforeHome = !!(await a.current()).activeMatch;
    // the forfeit's toast lasts 2.85 s: watch for it from the tap
    const toast = a.page.locator('.toast').filter({ hasText: /counts as a loss/ }).first().textContent({ timeout: 6000 }).catch(() => null);
    await a.page.getByRole('button', { name: 'BACK TO HOME', exact: true }).click();
    await a.page.locator('.home .playbar').waitFor({ timeout: 20000 });
    out.toast = await toast;
    await a.page.waitForTimeout(800);
    const after = await a.current();
    out.after = { l: after.h2h?.l ?? 0, w: after.h2h?.w ?? 0, activeMatch: after.activeMatch ?? null };
    // a relaunch must not record a second forfeit (activeMatch is already null)
    await a.page.goto(a.page.url().replace(/([?&])qa-crash=arena&?/, '$1'), { waitUntil: 'domcontentloaded' });
    await waitForHome(a.page);
    await a.page.waitForTimeout(1500);
    const relaunched = await a.current();
    out.afterRelaunch = { l: relaunched.h2h?.l ?? 0, activeMatch: relaunched.activeMatch ?? null };
    // the rival heard A leave (B's draft-match screen shows them gone, or B finishes on its own)
    out.errors = a.errors.filter((e) => !/qa-crash/.test(e)).concat(b.errors);
    out.blocked = [...new Set([...a.blocked, ...b.blocked])];
    out.pass =
      !!out.matched &&
      out.activeBeforeHome &&
      /This match stopped/.test(out.card.title) &&
      /counts as a loss/.test(out.lossLine || '') &&
      !/Nothing was saved/.test(out.card.body) &&
      out.after.activeMatch === null &&
      out.after.l === out.before.l + 1 &&
      out.after.w === out.before.w &&
      out.afterRelaunch.activeMatch === null &&
      out.afterRelaunch.l === out.before.l + 1 &&
      /counts as a loss/.test(out.toast || '') &&
      out.errors.length === 0;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await a.page.screenshot({ path: path.join(OUT, `fail-online-${sport}-a.png`) }).catch(() => {});
    await b.page.screenshot({ path: path.join(OUT, `fail-online-${sport}-b.png`) }).catch(() => {});
  } finally {
    await a.context.close();
    await b.context.close();
    await relay.close();
  }
  return out;
}

// ---------- lazy (review fix): a lazy screen's own chunk (Ultimate Team) can't download ----------
async function lazyChunk(browser, sport, offline) {
  const f = await open(browser, sport, null);
  const { page, context } = f;
  const out = { sport, offline };
  try {
    let aborted = 0;
    await context.route(/\/src\/ut\/UltimateTeam\.tsx/, (r) => (aborted++, r.abort('failed')));
    await waitForHome(page);
    if (offline)
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
        dispatchEvent(new Event('offline'));
      });
    else {
      // online: the first failure reloads into the live build (once a minute at most) ...
      const nav = page.waitForEvent('framenavigated', { timeout: 30000 });
      await page.getByRole('button', { name: /Ultimate Team:/ }).click();
      await nav;
      await waitForHome(page);
      out.reloadedOnce = true;
    }
    // ... and the next failure (or any offline one) shows the recovery card, not a bare panel or a loop
    const navs = [];
    page.on('framenavigated', (fr) => fr === page.mainFrame() && navs.push(fr.url()));
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.recovery').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    out.reloadsAfter = navs.length;
    out.aborted = aborted;
    out.card = await card(page);
    out.oldPanel = await page.getByText('This screen didn’t load').count();
    out.shot = await capture(page, `lazy-${sport}-${offline ? 'offline' : 'online'}`);
    await page.getByRole('button', { name: 'BACK TO HOME', exact: true }).click();
    await page.locator('.home .playbar').waitFor({ timeout: 20000 });
    out.backToHome = true;
    out.errors = f.errors.filter((e) => !/dynamically imported module|Failed to fetch|UltimateTeam/.test(e));
    out.pass =
      aborted > 0 &&
      out.reloadsAfter === 0 &&
      out.oldPanel === 0 &&
      (offline ? /offline/i.test(out.card.title) && /Connect to the internet/.test(out.card.body) : /didn.t load/.test(out.card.title)) &&
      out.card.buttons.some((b) => b.t === 'BACK TO HOME') &&
      out.card.buttons.every((b) => b.h >= 44) &&
      !out.shot.blank &&
      out.errors.length === 0;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-lazy-${sport}-${offline ? 'offline' : 'online'}.png`) }).catch(() => {});
  } finally {
    await context.close();
  }
  return out;
}

const browser = await launch();
const report = { at: new Date().toISOString(), parts, sports, matchMs, crash: [], chunk: [], arena: [], draft: [], online: [], lazy: [] };
try {
  for (const sport of sports) {
    if (parts.includes('crash'))
      for (const where of ['root', 'view', 'tab', 'ut', 'arena']) {
        const r = await crash(browser, sport, where);
        report.crash.push(r);
        console.log(JSON.stringify({ crash: where, sport, pass: r.pass, fail: r.fail, frames: r.framesToRecovery, blank: r.blankFrames, sd: r.shot?.lumaSd }));
      }
    if (parts.includes('chunk')) {
      let r = await chunk(browser, sport, chunkVia);
      // the UT match never asked for the file (teams that arrive rated): the same case through a draft match
      if (r.preRated) r = { ...(await chunk(browser, sport, 'draft')), utPreRated: true };
      report.chunk.push(r);
      console.log(JSON.stringify({ chunk: sport, via: r.via, pass: r.pass, fail: r.fail, ms: r.msToRecovery, fromTap: r.msFromTap, aborted: r.aborted }));
    }
    if (parts.includes('draft')) {
      const r = await draftCrash(browser, sport);
      report.draft.push(r);
      console.log(JSON.stringify({ draft: sport, pass: r.pass, fail: r.fail, frames: r.framesToRecovery, title: r.card?.title }));
    }
    if (parts.includes('online')) {
      const r = await onlineCrash(browser, sport);
      report.online.push(r);
      console.log(JSON.stringify({ online: sport, pass: r.pass, fail: r.fail, before: r.before, after: r.after, relaunch: r.afterRelaunch, loss: r.lossLine, toast: r.toast }));
    }
    if (parts.includes('lazy'))
      for (const offline of [true, false]) {
        const r = await lazyChunk(browser, sport, offline);
        report.lazy.push(r);
        console.log(JSON.stringify({ lazy: sport, offline, pass: r.pass, fail: r.fail, aborted: r.aborted, reloads: r.reloadsAfter, title: r.card?.title }));
      }
    if (parts.includes('arena'))
      for (const kind of sport === 'soccer' ? ['ut-match'] : ['ut-match', 'training', 'moment']) {
        const r = await arenaRun(browser, sport, kind);
        report.arena.push(r);
        console.log(JSON.stringify({ arena: kind, sport, pass: r.pass, fail: r.fail, observer: r.observer, perCallUs: r.perCallUs, invariant: r.activeThroughout, removalMs: r.msToRemoval }));
      }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'recovery-' + parts.join('-') + '.json'), JSON.stringify(report, null, 1));
const all = [...report.crash, ...report.chunk, ...report.arena, ...report.draft, ...report.online, ...report.lazy];
console.log(JSON.stringify({ runs: all.length, pass: all.filter((r) => r.pass).length, out: OUT }));
if (all.some((r) => !r.pass)) process.exitCode = 1;
