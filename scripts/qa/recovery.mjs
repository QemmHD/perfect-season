// Claude (studio overhaul, shell-4, 2026-11-16): the recovery screen and the arena signal, in the real
// app (dev server only: the crash hook `?qa-crash=` exists only there). Isolated like every shell run:
// ?ns=inspect, the local relay, every other host aborted, serialized fixture players only. It never
// taps SAVE NOW, ERASE, CLAIM, SELL or anything that spends.
//
//   node scripts/qa/recovery.mjs [--parts crash,chunk,arena] [--sports nba,nfl,soccer] [--match-ms 60000]
//
// crash: ?qa-crash=root|view|tab|ut|arena. The recovery card must be in the frame the error happens in
//   (rAF frame log), no frame may be blank, and the screenshot must not be blank. Then RELOAD (with the
//   hook taken off the URL) must land on Home with coins, XP, ut.owned (levels included) and the squad
//   deep-equal to the player before the crash. ut and arena also check BACK TO HOME.
// chunk: the match file aborted at the network (NBA/NFL the attributes file, soccer the soccer engine)
//   while a Squad Battles match opens: recovery within 1 s, never "Walking out…" or a disabled PLAY; the
//   copy switches to the offline wording when the phone goes offline.
// arena: arenaActive() against `body > .arcade-full` on every frame, from insertion to removal, through
//   a UT Squad Battles match (?autoplay, played to its end), Training Camp and a Moment (NBA/NFL); the
//   observer's total callback time over the first --match-ms of the match; shellWork() refused and
//   counted while a match is on. (Draft matches mount the same Arcade and engines as UT matches.)
// Output: <PS_QA_SHOTS>/shell-4/recovery/recovery-<parts>.json and screenshots there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, base, buildRoot, fixture, launch } from './browser.mjs';
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

async function open(browser, sport, crash, extra = {}) {
  const f = await fixture(browser, sport, 'Shell QA', 393, ctxOpts, opts);
  await f.context.addInitScript(frameLog);
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777', ...(crash ? { 'qa-crash': crash } : {}), ...extra });
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
      await page.getByRole('button', { name: 'BACK TO HOME', exact: true }).click();
      await page.locator('.home .playbar').waitFor({ timeout: 20000 });
      out.backToHome = true;
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
async function chunk(browser, sport) {
  const f = await open(browser, sport, null);
  const { page, context } = f;
  const out = { sport };
  try {
    const target = sport === 'soccer' ? /\/src\/game\/soccer2\/arcade\.ts/ : new RegExp('/src/data/' + sport + '-attrs\\.json');
    let aborted = 0,
      abortedAt = null;
    await context.route(target, (r) => (aborted++, (abortedAt ??= Date.now()), r.abort('failed')));
    await waitForHome(page);
    await openUt(page);
    await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
    await page.locator('.hq-mode').filter({ hasText: /SQUAD BATTLES/ }).click();
    await page.getByRole('button', { name: /^Rung 1:/ }).click();
    // the match screen mounts Arcade (and asks for the file) at once, or after its own PLAY
    const go = page.getByRole('button', { name: /^PLAY\s+\S/ }).first(); // "PLAY  Run your offense…", not the Play tab
    await Promise.race([go.waitFor({ timeout: 30000 }), page.locator('.recovery').waitFor({ timeout: 30000 })]);
    if (!(await page.locator('.recovery').count())) await go.click();
    await page.locator('.recovery').waitFor({ timeout: 5000 });
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
      /Connect once/.test(out.offline.body) &&
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

const browser = await launch();
const report = { at: new Date().toISOString(), parts, sports, matchMs, crash: [], chunk: [], arena: [] };
try {
  for (const sport of sports) {
    if (parts.includes('crash'))
      for (const where of ['root', 'view', 'tab', 'ut', 'arena']) {
        const r = await crash(browser, sport, where);
        report.crash.push(r);
        console.log(JSON.stringify({ crash: where, sport, pass: r.pass, fail: r.fail, frames: r.framesToRecovery, blank: r.blankFrames, sd: r.shot?.lumaSd }));
      }
    if (parts.includes('chunk')) {
      const r = await chunk(browser, sport);
      report.chunk.push(r);
      console.log(JSON.stringify({ chunk: sport, pass: r.pass, fail: r.fail, ms: r.msToRecovery, fromTap: r.msFromTap, aborted: r.aborted }));
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
const all = [...report.crash, ...report.chunk, ...report.arena];
console.log(JSON.stringify({ runs: all.length, pass: all.filter((r) => r.pass).length, out: OUT }));
if (all.some((r) => !r.pass)) process.exitCode = 1;
