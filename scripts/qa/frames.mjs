// Claude (studio overhaul, shell-6, 2026-11-16): what the screen shows from the tap that starts a match
// to gameplay, frame by frame. Isolated like every shell run (?ns=inspect, the local relay, every other
// host aborted, serialized fixture players); it never taps anything that spends or saves remotely.
//
//   node scripts/qa/frames.mjs [--mounts draft,ut,training,moment] [--sports nba,nfl,soccer]
//        [--runs 5] [--draft-runs 2] [--cpu 1,4] [--curtain on|off] [--motion reduce|no-preference]
//        [--label after] [--part arena|skeleton]
//
// arena: a CDP screencast (every frame Chromium paints, with its timestamp) from the tap to 1.2 s after
//   the first game frame. A page-side rAF log says, per frame, whether the arena is in <body> and what
//   the curtain shows. Each painted frame is classed:
//     curtain  the curtain (backdrop, title card, or its fade) covers the screen
//     empty    an arena is up, no curtain, and the stage is flat: its luminance spread (rows 30–85%) is
//              under the threshold calibrated on the audit's empty-arena shot (match-nba-393-01-pre.png;
//              the soccer one already shows the pitch, so it is reported and left out)
//     game     an arena is up and the stage has a picture
//     app      no arena yet (the screen the tap was on)
//   Mount points: draft (Head to Head vs the AI: draft → Vote → PLAY → kickoff → PLAY), ut (Squad
//   Battles rung 1 → PLAY), training (Training Camp, first drill) and moment (UT Moments, first tile);
//   training and moment are NBA/NFL only (soccer has neither). training and moment also play a warm
//   second match in the same page (leave, open it again). Per run: tap → first game frame, curtain on
//   screen, empty frames, game time at lift (lift − the arena's first drawn frame, an upper bound: the
//   engines draw only once their clock runs) and the engine-tick proxy at lift: the engines step
//   floor(Σ min(0.1 s, frame dt) / (1/60 s)) — the same sum each engine's loop makes — counted from the
//   arena's first drawn frame. `--curtain off` (dev server only) runs the same app without the curtain:
//   the before, and the tick comparison.
// skeleton: the UT tap at --cpu, rAF-logged: the first frame with UT's chrome, whether any frame between
//   the tap and it is blank, the header and tab bar rects from skeleton to ready (shift), and the
//   progress label's update gaps.
// Output: <PS_QA_SHOTS>/shell/shell-6/frames/frames-<label>.json plus evidence frames (JPEG).
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, base, fixture, launch } from './browser.mjs';
import { percentile } from './edge-lib.mjs';
import { openUt, waitForHome } from './fixtures.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const part = opt('part', 'arena');
const mounts = opt('mounts', 'draft,ut,training,moment').split(',');
const sports = opt('sports', 'nba,nfl,soccer').split(',');
const runs = +opt('runs', 5);
const draftRuns = +opt('draft-runs', 2);
const cpus = opt('cpu', '1,4').split(',').map(Number);
const curtainOff = opt('curtain', 'on') === 'off';
const motion = opt('motion', 'reduce');
const label = opt('label', curtainOff ? 'off' : 'on');
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), 'shell-6', 'frames');
fs.mkdirSync(OUT, { recursive: true });
const ctxOpts = { isMobile: true, hasTouch: true };
const opts = { insets: [59, 0, 34, 0], height: 852, serialized: true, motion };
const r1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
const AUDIT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/ut-ui';

// ---------- the page side: one record per animation frame ----------
function recorder(off) {
  if (off) window.__psCurtainOff = true;
  const fr = (window.__fr = { on: false, log: [], arenaAt: [], uiAt: [] });
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
  };
  const watch = () => {
    new MutationObserver((recs) => {
      for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList.contains('arcade-full')) fr.arenaAt.push(performance.now());
    }).observe(document.body, { childList: true });
  };
  // the moment the app gets the tap (the tile's click), not when the test sent it
  addEventListener('click', () => fr.on && (fr.clickAt = performance.now()), true);
  if (document.body) watch();
  else document.addEventListener('DOMContentLoaded', watch);
  const loop = (t) => {
    requestAnimationFrame(loop);
    if (!fr.on) return;
    const arena = document.querySelector('body > .arcade-full');
    const c = document.querySelector('.arena-curtain');
    const rec = { t, a: arena ? 1 : 0, c: c ? (c.classList.contains('ac-is-lifting') ? 'L' : c.classList.contains('ac-is-cover') ? 'B' : 'C') : '' };
    if (arena) rec.clock = arena.querySelector('.hg2-bug .mid em')?.textContent ?? null;
    if (fr.ut) {
      const scr = document.querySelector('.screen.ut');
      const top = document.querySelector('.screen.ut > .ut-top');
      // the bars against their own screen's box: the view's enter slide moves the whole screen, which is not a shift
      const rel = (el) => {
        const r = rect(el);
        const s = rect(scr);
        return r && s ? [r[0] - s[0], r[1] - s[1], r[2], r[3], Math.round((s[1] + s[3] - (r[1] + r[3])) * 10) / 10] : null;
      };
      rec.ut = { skel: !!document.querySelector('.ut-skel-body'), done: !!top && !document.querySelector('.ut-skel-body, .ut-loading'), top: rel(top), tabs: rel(document.querySelector('.screen.ut > .ut-tabs')), label: document.querySelector('.ut-skel-label')?.textContent ?? null, home: !!document.querySelector('.shell-top'), op: scr ? +getComputedStyle(scr.closest('.view') ?? scr).opacity : null };
    }
    fr.log.push(rec);
  };
  requestAnimationFrame(loop);
}

// ---------- decoding painted frames (a helper page in the same browser) ----------
let helper = null;
async function stats(browser, jpegs) {
  if (!helper) {
    const ctx = await browser.newContext();
    helper = await ctx.newPage();
    await helper.setContent('<canvas id=c></canvas>');
  }
  return helper.evaluate(async (list) => {
    const out = [];
    const c = document.getElementById('c');
    const g = c.getContext('2d', { willReadFrequently: true });
    for (const src of list) {
      const blob = await (await fetch(src)).blob();
      const bmp = await createImageBitmap(blob);
      c.width = bmp.width;
      c.height = bmp.height;
      g.drawImage(bmp, 0, 0);
      const y0 = Math.floor(bmp.height * 0.3);
      const y1 = Math.floor(bmp.height * 0.85);
      const d = g.getImageData(0, y0, bmp.width, y1 - y0).data;
      let n = 0,
        s = 0,
        s2 = 0;
      for (let i = 0; i < d.length; i += 16) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        s += l;
        s2 += l * l;
        n++;
      }
      const m = s / n;
      out.push(Math.round(Math.sqrt(Math.max(0, s2 / n - m * m)) * 10) / 10);
    }
    return out;
  }, jpegs);
}

/** The empty-arena threshold: the audit's empty-arena shots (stage rows 30–85%) plus a margin. */
async function calibrate(browser) {
  const files = fs.existsSync(AUDIT) ? fs.readdirSync(AUDIT).filter((f) => /^match-.*-01-pre\.png$/.test(f)) : [];
  const sds = files.length ? await stats(browser, files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(AUDIT, f)).toString('base64'))) : [];
  // a shot with a picture on its stage (the soccer one already shows the pitch and players) is not an empty arena
  const empties = sds.filter((v) => v < 10);
  const empty = empties.length ? Math.max(...empties) : 2;
  return { files, sds, rejected: files.filter((_, i) => sds[i] >= 10), threshold: Math.max(6, Math.round((empty * 2 + 4) * 10) / 10) };
}

// ---------- getting to the tap ----------
const visible = (loc) => loc.isVisible().catch(() => false);
async function draftToKickoff(page) {
  await page.locator('.mode').filter({ hasText: /head to head/i }).first().click();
  await page.locator('.home .playbar button').first().click();
  await page.locator('.screen.search').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /PLAY THE AI NOW/ }).click({ timeout: 30000 });
  await page.locator('.screen.draft').waitFor({ timeout: 60000 });
  const end = Date.now() + 240000;
  const action = page.getByRole('button', { name: /^(SPIN|SHOW PLAYERS|NO ONE FITS · FREE RESPIN|SEE THE MATCHUP)$/ });
  while (Date.now() < end && !(await page.locator('.screen.vote').count())) {
    const row = page.locator('.drawer.open .row:not([aria-disabled="true"])').first();
    const glow = page.locator('.slot-empty.glow').first();
    if (await visible(glow)) await glow.click({ timeout: 5000 }).catch(() => {});
    else if (await visible(row)) await row.click({ timeout: 5000 }).catch(() => {});
    else if (await visible(page.locator('.drawer.open'))) await page.getByRole('button', { name: 'Hide players' }).click({ timeout: 5000 }).catch(() => {});
    else if (await visible(action.first())) await action.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  await page.locator('.vote-opt.play').click({ timeout: 30000 });
  return page.locator('.arc-kick button.big.shine, .arc-kick .arc-btns button').filter({ hasText: /^PLAY$/ }).first();
}
async function utToKickoff(page) {
  await openUt(page);
  await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
  await page.locator('.hq-mode').filter({ hasText: /SQUAD BATTLES/ }).click();
  await page.getByRole('button', { name: /^Rung 1:/ }).click();
  // the rung's PLAY ("PLAY  Run your offense…") opens the match's kickoff; its PLAY brings the arena
  await page.getByRole('button', { name: /^PLAY\s+\S/ }).first().click({ timeout: 30000 });
  return page.locator('.arc-kick button.big.shine, .arc-kick .arc-btns button').filter({ hasText: /^PLAY$/ }).first();
}
async function trainingTap(page) {
  if (!(await page.locator('.camp-drill').count())) await page.locator('.training-entry').click();
  await page.locator('.camp-drill').first().click({ timeout: 30000 });
  return page.getByRole('button', { name: /LET.S WORK/ });
}
async function momentTap(page) {
  if (!(await page.locator('.hq-moment-tile').count())) {
    if (!(await page.locator('.screen.ut').count())) await openUt(page);
    await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
    await page.locator('.hq-mode').filter({ hasText: /MOMENTS/ }).click();
  }
  await page.locator('.hq-moment-tile').first().click();
  return page.getByRole('button', { name: /PLAY MOMENT|PLAY AGAIN/ }).first();
}
const LEAVE = { training: 'Leave training', moment: 'Leave Moment' };

// ---------- one tap → gameplay ----------
async function measure(browser, f, sport, tapLoc, name) {
  const { page } = f;
  await tapLoc.waitFor({ timeout: 120000 });
  // the arena's own HTTP and module caches are what they are; the screencast and the log start here
  const cdp = await f.context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (e) => {
    frames.push({ wall: e.metadata.timestamp * 1000, data: e.data });
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, everyNthFrame: 1 });
  const origin = await page.evaluate(() => {
    window.__fr.log = [];
    window.__fr.arenaAt = [];
    window.__fr.on = true;
    window.__psCurtain = [];
    return performance.timeOrigin;
  });
  await page.waitForTimeout(250);
  const tapT = await page.evaluate(() => performance.now());
  await tapLoc.tap({ timeout: 10000 });
  // until the curtain is gone (or never came) and the arena has been drawing for a while
  await page.locator('body > .arcade-full').waitFor({ timeout: 60000 });
  await page
    .waitForFunction(
      () => {
        const c = window.__psCurtain?.at(-1);
        const a = window.__fr.arenaAt.at(-1);
        return !document.querySelector('.arena-curtain') && (window.__psCurtainOff || (c && c.liftAt !== undefined)) && a !== undefined && performance.now() - a > 2600;
      },
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  await page.waitForTimeout(1200);
  await cdp.send('Page.stopScreencast').catch(() => {});
  const { log, arenaAt, curtain } = await page.evaluate(() => ({ log: window.__fr.log, arenaAt: window.__fr.arenaAt, curtain: window.__psCurtain ?? [] }));
  await page.evaluate(() => (window.__fr.on = false));
  await cdp.detach().catch(() => {});
  const sds = await stats(
    browser,
    frames.map((x) => 'data:image/jpeg;base64,' + x.data)
  );
  // each painted frame against the rAF record just before it (page time)
  const classed = frames.map((x, i) => {
    const t = x.wall - origin;
    let rec = null;
    for (const r of log) if (r.t <= t + 1) rec = r;
    const kind = !rec || !rec.a ? 'app' : rec.c ? 'curtain' : sds[i] >= threshold ? 'game' : 'empty';
    return { t: Math.round(t - tapT), sd: sds[i], kind, c: rec?.c ?? '' };
  });
  const after = classed.filter((x) => x.t >= 0);
  const firstGame = after.find((x) => x.kind === 'game');
  const empties = after.filter((x) => x.kind === 'empty' && (!firstGame || x.t < firstGame.t));
  const emptyAfter = firstGame ? after.filter((x) => x.kind === 'empty' && x.t > firstGame.t) : [];
  const cur = after.filter((x) => x.kind === 'curtain');
  const arena0 = arenaAt[0];
  const run = curtain.at(-1) ?? null;
  // the first frame the canvas held a picture: the curtain's own probe when on; else the first game frame
  const drawnT = run?.drawnAt !== undefined ? arena0 + run.drawnAt : firstGame ? firstGame.t + tapT : null;
  const liftT = run?.liftAt !== undefined ? arena0 + run.liftAt : firstGame ? firstGame.t + tapT : null;
  let acc = 0;
  for (let i = 1; i < log.length; i++) if (drawnT !== null && log[i].t > drawnT && log[i].t <= liftT) acc += Math.min(0.1, (log[i].t - log[i - 1].t) / 1000);
  const ticks = drawnT === null || liftT === null ? null : Math.floor(acc * 60 + 1e-6);
  // evidence frames: the first curtain frame, every empty frame, the first game frame
  const keep = (x, tag) => {
    const i = classed.indexOf(x);
    const file = `${name}-${tag}-${x.t}ms.jpg`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(frames[i].data, 'base64'));
    return file;
  };
  const evidence = [];
  if (cur[0]) evidence.push(keep(cur[0], 'curtain'));
  const cardFrame = cur.find((x) => x.c === 'C');
  if (cardFrame) evidence.push(keep(cardFrame, 'card'));
  for (const e of empties.slice(0, 3)) evidence.push(keep(e, 'EMPTY'));
  if (firstGame) evidence.push(keep(firstGame, 'game'));
  return {
    framesPainted: after.length,
    tapToArenaMs: r1(arena0 - tapT),
    tapToGameMs: firstGame ? firstGame.t : null,
    emptyFrames: empties.length,
    emptyAfterGame: emptyAfter.length,
    curtainFrames: cur.length,
    curtainOnScreenMs: cur.length ? cur.at(-1).t - cur[0].t + 16 : 0,
    cardShown: run?.cardAt !== undefined,
    curtain: run && { cover: r1(run.coverAt), card: r1(run.cardAt), drawn: r1(run.drawnAt), motion: r1(run.motionAt), motionBy: run.motionBy, lift: r1(run.liftAt), reason: run.reason, handover: run.handover },
    gameTimeAtLiftS: drawnT === null ? null : Math.round(((liftT - drawnT) / 1000) * 1000) / 1000,
    ticksAtLift: ticks,
    clockAtLift: log.find((r) => r.t >= liftT)?.clock ?? null,
    sd: { emptyMax: empties.length ? Math.max(...empties.map((x) => x.sd)) : null, gameMin: Math.min(...after.filter((x) => x.kind === 'game').map((x) => x.sd)) },
    evidence,
  };
}

async function arenaRun(browser, sport, mount, cpu, runIdx) {
  const f = await fixture(browser, sport, 'Shell QA', 393, ctxOpts, opts);
  await f.context.addInitScript(recorder, curtainOff);
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await f.page.goto(u.href, { waitUntil: 'domcontentloaded' });
  const out = { sport, mount, cpu, run: runIdx, curtain: curtainOff ? 'off' : 'on', matches: [] };
  const cdp = await f.context.newCDPSession(f.page);
  try {
    await waitForHome(f.page);
    const get = { draft: draftToKickoff, ut: utToKickoff, training: trainingTap, moment: momentTap }[mount];
    const twice = mount === 'training' || mount === 'moment';
    for (let m = 0; m < (twice ? 2 : 1); m++) {
      const tap = await get(f.page);
      await tap.waitFor({ timeout: 120000 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const r = await measure(browser, f, sport, tap, `${label}-${sport}-${mount}-${cpu}x-r${runIdx}-m${m + 1}`);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      out.matches.push({ match: m + 1, ...r });
      if (twice && m === 0) {
        await f.page.getByRole('button', { name: LEAVE[mount] }).click({ timeout: 20000 });
        await f.page.locator('body > .arcade-full').waitFor({ state: 'detached', timeout: 20000 });
        await f.page.waitForTimeout(600);
      }
    }
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await f.page.screenshot({ path: path.join(OUT, `fail-${label}-${sport}-${mount}-${cpu}x-r${runIdx}.png`) }).catch(() => {});
  } finally {
    await f.context.close();
  }
  return out;
}

// ---------- the UT skeleton ----------
async function skeletonRun(browser, sport, cpu) {
  const f = await fixture(browser, sport, 'Shell QA', 393, ctxOpts, opts);
  await f.context.addInitScript(recorder, false);
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await f.page.goto(u.href, { waitUntil: 'domcontentloaded' });
  const out = { sport, cpu };
  const cdp = await f.context.newCDPSession(f.page);
  try {
    await waitForHome(f.page);
    const tile = f.page.getByRole('button', { name: /Ultimate Team:/ });
    await tile.waitFor();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const tapT = await f.page.evaluate(() => {
      window.__fr.ut = true;
      window.__fr.log = [];
      window.__fr.on = true;
      return performance.now();
    });
    await tile.tap();
    await f.page.waitForFunction(() => window.__fr.log.at(-1)?.ut?.done, null, { timeout: 180000 });
    await f.page.waitForTimeout(400);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const log = await f.page.evaluate(() => ((window.__fr.on = false), window.__fr.log));
    const clickAt = await f.page.evaluate(() => window.__fr.clickAt ?? null);
    out.sendToClickMs = clickAt === null ? null : r1(clickAt - tapT);
    const from = clickAt ?? tapT;
    const after = log.filter((r) => r.t >= from);
    const firstUt = after.findIndex((r) => r.ut.top);
    // between the tap and UT's chrome: Home must stay (never a frame with neither)
    out.blankFrames = after.slice(0, Math.max(0, firstUt)).filter((r) => !r.ut.home).length;
    out.framesToChrome = firstUt;
    out.msToChrome = firstUt >= 0 ? r1(after[firstUt].t - from) : null;
    out.firstChromeIsSkeleton = firstUt >= 0 ? after[firstUt].ut.skel : null;
    const skel = after.filter((r) => r.ut.top && r.ut.skel);
    const ready = after.filter((r) => r.ut.done);
    const shift = (k) => (skel.length && ready.length ? Math.max(...skel.map((s) => Math.max(...s.ut[k].map((v, i) => Math.abs(v - ready.at(-1).ut[k][i]))))) : null);
    out.headerShiftPx = shift('top');
    out.tabsShiftPx = shift('tabs');
    out.skeletonMs = skel.length ? r1(skel.at(-1).t - skel[0].t) : 0;
    out.msToReady = ready.length ? r1(ready[0].t - from) : null;
    // the label: the gaps between changes of its text (frames where it is shown)
    const changes = [];
    let last = null;
    for (const r of after) if (r.ut.label !== null && r.ut.label !== last) (changes.push(r.t), (last = r.ut.label));
    const gaps = changes.slice(1).map((t, i) => t - changes[i]);
    out.labelUpdates = changes.length;
    out.labelGapMaxMs = gaps.length ? r1(Math.max(...gaps)) : null;
    out.labelGapP95Ms = gaps.length ? r1(percentile(gaps, 95)) : null;
    // the longest frame while the skeleton was up (a long task freezes the label too)
    const dts = skel.slice(1).map((r, i) => r.t - skel[i].t);
    out.longestFrameMs = dts.length ? r1(Math.max(...dts)) : null;
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    await f.page.screenshot({ path: path.join(OUT, `skeleton-ready-${sport}-${cpu}x.png`) });
  } catch (e) {
    out.fail = e.message.split('\n')[0];
  } finally {
    await f.context.close();
  }
  return out;
}

const browser = await launch();
const cal = await calibrate(browser);
const threshold = cal.threshold;
const report = { at: new Date().toISOString(), base, part, label, curtain: curtainOff ? 'off' : 'on', motion, calibration: cal, runs: [] };
if (part === 'skeleton') {
  for (const sport of sports) for (const cpu of cpus) report.runs.push(await skeletonRun(browser, sport, cpu));
} else {
  for (const sport of sports)
    for (const mount of mounts) {
      if ((mount === 'training' || mount === 'moment') && sport === 'soccer') continue;
      for (const cpu of cpus) for (let i = 0; i < (mount === 'draft' ? draftRuns : runs); i++) {
        const r = await arenaRun(browser, sport, mount, cpu, i + 1);
        report.runs.push(r);
        console.log(JSON.stringify({ sport, mount, cpu, run: i + 1, fail: r.fail, m: r.matches.map((m) => [m.tapToGameMs, m.curtainOnScreenMs, m.emptyFrames, m.gameTimeAtLiftS, m.ticksAtLift]) }));
      }
    }
  // summary per sport, mount, cpu and match number
  const groups = {};
  for (const r of report.runs)
    for (const m of r.matches ?? []) {
      const k = [r.sport, r.mount, r.cpu + 'x', 'm' + m.match].join(' ');
      (groups[k] ??= []).push(m);
    }
  report.summary = Object.fromEntries(
    Object.entries(groups).map(([k, list]) => {
      const on = list.map((m) => m.curtainOnScreenMs);
      const tg = list.filter((m) => m.tapToGameMs !== null).map((m) => m.tapToGameMs);
      return [
        k,
        {
          n: list.length,
          tapToGame: { p50: percentile(tg, 50), p95: percentile(tg, 95) },
          curtainOn: { p50: percentile(on, 50), p95: percentile(on, 95) },
          cardShown: list.filter((m) => m.cardShown).length,
          emptyFrames: list.reduce((a, m) => a + m.emptyFrames, 0),
          gameTimeAtLiftS: { max: Math.max(...list.map((m) => m.gameTimeAtLiftS ?? 0)) },
          ticksAtLift: list.map((m) => m.ticksAtLift),
        },
      ];
    })
  );
}
await browser.close();
const file = path.join(OUT, `${part}-${label}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.summary ?? report.runs, null, 1));
console.log('report:', file);
