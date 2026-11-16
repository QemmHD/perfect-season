// Claude (studio overhaul, shell-5, 2026-11-16): the full-matrix fit walker. For each sport and phone it
// walks the audit's ~50 screens through the real UI (role and name selectors, real taps), plays two real
// matches, and checks the edge states. On every screen it records edge-lib's audit (text and controls in
// the status-bar band, bottom cuts, small and overlapping tap areas, overflow), the header plates, the
// preserve checks, and how long each tap took to paint.
//
//   node scripts/qa/edge-walk.mjs --phase before|after [--sports nba,nfl,soccer] [--devices all|393,…]
//     [--parts walk,match,edge] [--band 393] [--jobs 3] [--profile standard]
//   node scripts/qa/edge-walk.mjs --phase after --parts paint --sports nba,soccer   (393, 4× CPU)
//
// Parts:
//  - walk: Home (top, scrolled, every mode tile), How to play, Missions, Gauntlet, Training Camp (NBA/NFL),
//    Ranks, Profile, Settings (+ the Advanced danger zone where it exists), the Draft's toast, board after
//    a spin and booster tray; Ultimate Team: Home, Rewards, Daily, Records, Play and every Play mode
//    (soccer hides some: recorded n/a), Rivals, Squad, Club Players, Filter, card detail (top and end,
//    with its sticky bar), Tracker, Storage, Collection, Sets, Development, Evolutions, SBCs, an SBC,
//    Standouts, Objectives, Season Pass, Store, Odds, Market; the daily pack with motion (seal, walkout
//    with SKIP, the grid); EXIT.
//  - match: Head to Head vs the AI (Search, the friend-code keyboard, the draft played to the end, the
//    Vote, PLAY) and a UT Squad Battle: kick-off, live play, NFL play-call and playbook, the PlayReadout,
//    pause where the sport has one; soccer's shootout from the lab (dev server only). In each match the
//    status-bar strip is sampled with the HUD scrim hidden (10 frames a match, 20 a sport) for sprites.
//  - edge: Home sideways (edge 0, nothing clipped), and the keyboard up (visual viewport 310 px) on
//    Welcome (a fresh player), Search and the danger zone (the last two inside walk/match).
//  - packrm: the daily drop opened under reduced motion in a fresh context (walk opens it with motion):
//    the cinema's steps and running animations, for the preserve comparison.
//  - paint: Club Players and SBCs scrolled at 4× CPU, the header's paint cost per frame (CDP trace).
// Tap timing: every walker tap records input → next paint (Event Timing) and the frames of the 600 ms
// after it (edge-lib tapTimingInit/readTap). The draft loop's picks are not timed.
// Output: <PS_QA_SHOTS>/<phase>/walk/<sport>-<device>/NN-screen.png (+ -band.png at --band phones) and
// report.json, <phase>/sheets/<sport>-<device>.png, and <phase>/walk/summary-<sports>.json. Isolated:
// ?ns=inspect, the local relay, every other host aborted; nothing here spends, sells, saves or erases.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, base, buildRoot, fixture, launch } from './browser.mjs';
import {
  arcadeInsets,
  auditScreen,
  clearBand,
  closeDialogs,
  contactSheet,
  detailBarAudit,
  DEVICE_IDS,
  DEVICES,
  expectedLayout,
  homeAudit,
  hudScrim,
  keyboardAudit,
  keyboardViewport,
  pageNow,
  percentile,
  platesAudit,
  preserveAudit,
  readTap,
  rotate,
  rotatedAudit,
  scrimOff,
  settle,
  simulateBand,
  stickyAudit,
  stripPixels,
  splitStatic,
  stripSprites,
  tapTimingInit,
} from './edge-lib.mjs';
import { openUt, waitForHome } from './fixtures.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const list = (name, fallback, all) => {
  const v = opt(name, null);
  if (v === null) return fallback;
  return v === 'all' ? all : v === 'none' ? [] : v.split(',');
};
const sports = list('sports', ['nba', 'nfl', 'soccer'], ['nba', 'nfl', 'soccer']);
const devices = list('devices', DEVICE_IDS, DEVICE_IDS);
const bandOn = list('band', ['393'], DEVICE_IDS);
const parts = opt('parts', 'walk,match,edge').split(',');
const phase = opt('phase', 'after');
const jobs = Math.max(1, +opt('jobs', 3));
const profile = opt('profile', 'standard');
const ROOT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), phase);
const OUT = path.join(ROOT, 'walk');
for (const d of devices) if (!DEVICES[d]) throw Error('Unknown device ' + d + '; known: ' + DEVICE_IDS.join(', '));
const ctxOpts = { isMobile: true, hasTouch: true };
const appUrl = (sport, extra = '') => {
  const u = new URL(base);
  u.search = '?' + new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' }) + extra;
  return u.href;
};
const PLAY_MODES = {
  nba: ['CLUB CUPS', 'CLUB SEASON', 'SQUAD BATTLES', 'CHAMPIONS CIRCUIT', 'LEGENDS EVENTS', 'MOMENTS', 'UT DRAFT'],
  nfl: ['CLUB CUPS', 'CLUB SEASON', 'SQUAD BATTLES', 'CHAMPIONS CIRCUIT', 'LEGENDS EVENTS', 'MOMENTS', 'UT DRAFT'],
  soccer: ['CLUB CUPS', 'CLUB SEASON', 'SQUAD BATTLES', 'CHAMPIONS CIRCUIT', 'LEGENDS EVENTS', 'MOMENTS', 'UT DRAFT'],
};
const KEYBOARD_H = 310;

/** The parts of an audit a report keeps (lists stay short; counts are exact). */
const brief = (a) => ({
  topMost: a.topMost,
  textInBand: a.textInBand,
  controlInBand: a.controlInBand,
  bottomCut: a.bottomCut,
  small: a.small,
  overlap: a.overlap,
  offscreen: a.offscreen,
  docScroll: a.docScroll,
  hOverflow: a.hOverflow,
  tiny: a.tiny.length,
  lowContrast: a.lowContrast.length,
});

async function runDevice(browser, sport, dev) {
  const d = DEVICES[dev],
    t0 = Date.now();
  const dir = path.join(OUT, sport + '-' + dev);
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture(browser, sport, 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 1, profile, serialized: true, init: tapTimingInit });
  const { page } = f;
  const screens = [],
    taps = [],
    na = [],
    hud = [],
    states = {};
  let n = 0,
    pending = null;

  /** Reads the previous tap's timing once its 600 ms window has passed. */
  const flush = async () => {
    if (!pending) return;
    const p = pending;
    pending = null;
    const r = await readTap(page, p.t0).catch(() => null);
    if (r) taps.push({ tap: p.label, screen: p.screen, ...r });
  };
  /** A real tap on a locator, timed (input → next paint and the frames after it). */
  const tap = async (locator, label, clickOpts = {}) => {
    await flush();
    await locator.waitFor({ state: 'visible', timeout: clickOpts.timeout ?? 15000 });
    const at = await pageNow(page);
    await locator.click({ ...clickOpts, timeout: clickOpts.timeout ?? 15000 });
    pending = { t0: at, label, screen: String(n + 1).padStart(2, '0') };
  };
  const cap = async (name, { measure = null, settleMs = 380, audit = true, device = dev } = {}) => {
    await settle(page, settleMs);
    const file = String(++n).padStart(2, '0') + '-' + name;
    const rec = { screen: file };
    if (audit) {
      rec.audit = brief(await auditScreen(page, device));
      const pl = await platesAudit(page, typeof device === 'object' ? device : dev);
      const h = pl.header;
      rec.plates = {
        status: pl.status && { display: pl.status.display, height: pl.status.height, color: pl.status.color },
        header: h && { el: h.el, opaque: h.opaque, probesOk: h.probesOk, failedProbes: h.probes.filter((p) => !p.ok).slice(0, 3), hairlineOff: h.hairlineOff, textContrast: h.textContrast, lineContrast: h.lineContrast },
      };
      rec.preserve = await preserveAudit(page);
    }
    if (measure) Object.assign(rec, await measure());
    rec.shots = [file + '.png'];
    await page.screenshot({ path: path.join(dir, file + '.png') });
    if (bandOn.includes(dev) && audit) {
      await simulateBand(page, d.insets[0]);
      await page.screenshot({ path: path.join(dir, file + '-band.png') });
      await clearBand(page);
      rec.shots.push(file + '-band.png');
    }
    screens.push(rec);
    await flush();
    return rec;
  };
  const step = async (name, act, o = {}) => {
    const s0 = Date.now();
    try {
      await act();
      const rec = await cap(name, o);
      rec.ms = Date.now() - s0;
    } catch (e) {
      pending = null;
      const file = String(++n).padStart(2, '0') + '-' + name;
      await page.screenshot({ path: path.join(dir, file + '-FAILED.png') }).catch(() => {});
      screens.push({ screen: file, fail: e.message.split('\n')[0], ms: Date.now() - s0 });
      await closeDialogs(page);
    }
  };
  /** A part of the walk: a failure is recorded and the walk goes on to the next part. */
  const section = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      pending = null;
      screens.push({ screen: String(++n).padStart(2, '0') + '-' + name + '-aborted', fail: e.message.split('\n')[0] });
      await closeDialogs(page).catch(() => {});
    }
  };
  const missing = (name, why) => {
    na.push({ screen: name, why });
  };
  const visible = (loc) => loc.isVisible().catch(() => false);
  const utTab = (label) => tap(page.locator('.ut-tabs button').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }), 'ut tab ' + label);
  const seg = (label) => tap(page.locator('.ut-segs [role=tab]').filter({ hasText: new RegExp('^' + label) }).first(), 'segment ' + label);
  const back = () => tap(page.locator('.ut-back'), 'back');
  const mainTab = (label) => tap(page.locator('nav.tabs button').filter({ hasText: new RegExp('^\\s*' + label + '\\s*$', 'i') }).first(), 'tab ' + label);
  const dialog = () => page.getByRole('dialog').first().waitFor({ timeout: 10000 });
  const home = async (extra = '') => {
    pending = null;
    await page.goto(appUrl(sport, extra), { waitUntil: 'domcontentloaded' });
    await waitForHome(page);
    await settle(page, 600);
    await closeDialogs(page);
  };
  const homeRect = async () => ({ playRect: (await preserveAudit(page)).play });

  // ---------- the HUD scrim's sprite check: the status-bar strip with the scrim hidden ----------
  const sampleStrip = async (match, frames = 10) => {
    const t = d.insets[0];
    if (!t) return;
    await scrimOff(page, true);
    const got = [];
    for (let i = 0; i < frames; i++) {
      const { w, h, rgba } = await stripPixels(page, t);
      got.push(stripSprites(rgba, w, h, { keepMask: true }));
      await page.waitForTimeout(250);
    }
    await scrimOff(page, false);
    // the stands' own lights sit in the same pixels in every frame; players, the ball and a rim move
    const { staticPx, moving } = splitStatic(got.map((g) => g.mask));
    got.forEach(({ mask, ...g }, i) => hud.push({ match, i, ...g, spritePx: moving[i], outlierPx: g.spritePx, backdropPx: staticPx }));
  };

  // ---------- a match on screen: kick-off, the play call, live play, pause, the readout ----------
  const matchFrames = async (tag) => {
    // the match intro (your five against theirs) waits for PLAY / SIM IT
    const intro = page.locator('.screen.arcade').getByRole('button', { name: 'PLAY', exact: true });
    if (await intro.waitFor({ timeout: 20000 }).then(() => true, () => false)) {
      await cap(tag + '-intro', { settleMs: 300 });
      await tap(intro, 'match PLAY');
    }
    await page.locator('.arcade-full canvas').first().waitFor({ timeout: 90000 });
    await page.waitForTimeout(1200);
    const ins = await arcadeInsets(page, d.insets);
    const scrim = async () => ({ arcade: ins, scrim: await hudScrim(page) });
    await cap(tag + '-kickoff', { measure: scrim, settleMs: 200 });
    if (sport === 'nfl') {
      const call = page.locator('.fb2-call');
      if (await call.waitFor({ timeout: 12000 }).then(() => true, () => false)) {
        await cap(tag + '-playcall', { settleMs: 200 });
        const book = page.getByRole('button', { name: /FULL PLAYBOOK/ });
        if (await visible(book)) {
          await step(tag + '-playbook', () => tap(book, 'playbook'), { settleMs: 400 });
          const close = page.getByRole('button', { name: 'Close playbook' });
          if (await visible(close)) await tap(close, 'close playbook');
          else await page.keyboard.press('Escape');
          await settle(page, 300);
        } else missing(tag + '-playbook', 'no FULL PLAYBOOK button');
        // call the first play: the snap and live play follow
        const play = call.locator('button:not([aria-pressed])').last();
        if (await visible(play)) await tap(play, 'call a play').catch(() => {});
      } else missing(tag + '-playcall', 'no play call shown');
    }
    // soccer's attacks wait for KICK OFF before play is live
    const kick = page.getByRole('button', { name: /^KICK OFF/ }).first();
    if (await visible(kick)) await tap(kick, 'KICK OFF').catch(() => {});
    await page.waitForTimeout(2500);
    await cap(tag + '-live', { measure: scrim, settleMs: 100 });
    await sampleStrip(tag);
    const pause = page.getByRole('button', { name: /pause/i }).first();
    if (await visible(pause)) {
      await step(tag + '-pause', () => tap(pause, 'pause'));
      const resume = page.getByRole('button', { name: /resume|continue/i }).first();
      if (await visible(resume)) await tap(resume, 'resume');
    } else missing(tag + '-pause', 'this sport has no pause control on this build');
    const readout = page.locator('.play-readout');
    if (await readout.waitFor({ timeout: 25000 }).then(() => true, () => false)) await cap(tag + '-readout', { settleMs: 200 });
    else missing(tag + '-readout', 'no PlayReadout within 25 s');
  };

  /** Plays the draft to the end: SPIN, show the players, take the first one who fits, place him. */
  const draftToVote = async () => {
    const end = Date.now() + 240000;
    const action = page.getByRole('button', { name: /^(SPIN|SHOW PLAYERS|NO ONE FITS · FREE RESPIN|SEE THE MATCHUP)$/ });
    while (Date.now() < end) {
      if (await page.locator('.screen.vote').count()) return true;
      const row = page.locator('.drawer.open .row:not([aria-disabled="true"])').first();
      const glow = page.locator('.slot-empty.glow').first();
      const hide = page.getByRole('button', { name: 'Hide players' });
      if (await visible(glow)) await glow.click({ timeout: 5000 }).catch(() => {});
      else if (await visible(row)) await row.click({ timeout: 5000 }).catch(() => {});
      // nobody in the drawer fits: close it, so the board's action (a free respin, SPIN) can be reached
      else if (await visible(page.locator('.drawer.open'))) await hide.click({ timeout: 5000 }).catch(() => {});
      else if (await visible(action.first())) await action.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(450);
    }
    return false;
  };

  /** A pack opened under reduced motion: the cinema's steps and running animations (audit §6 preserve). */
  const packReducedMotion = async () => {
    // the daily drop: the player's other packs register with the card registry, which isolated QA can't reach
    const rest = page.locator('.ut-daily-btn');
    if (!(await visible(rest))) return missing('pack-reduced-motion', 'no daily drop in the Store');
    const steps = [];
    await tap(rest, 'open a pack (reduced motion)');
    await page.locator('.ut-open-screen').waitFor({ timeout: 15000 });
    for (let i = 0; i < 40; i++) {
      const s = await page.evaluate(() => {
        const o = document.querySelector('.ut-open-screen');
        if (!o) return null;
        const btns = [...o.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 18)).sort();
        const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.ut-open-screen')).length;
        return { cls: [...o.classList].filter((c) => c !== 'ut-open-screen').sort().join('.'), btns: btns.join('|'), running };
      });
      if (!s) break;
      const key = s.cls + ' [' + s.btns + ']';
      if (!steps.length || steps[steps.length - 1].key !== key) steps.push({ key, running: s.running });
      else steps[steps.length - 1].running = Math.max(steps[steps.length - 1].running, s.running);
      const next = page.getByRole('button', { name: /^(DONE|TAP TO CONTINUE)$/ }).first();
      if (/DONE/.test(s.btns)) {
        await cap('pack-reduced-motion', { settleMs: 200 });
        await page.getByRole('button', { name: 'DONE', exact: true }).click().catch(() => {});
      } else if (await visible(page.locator('.ut-cinema-open'))) await page.locator('.ut-cinema-open').click().catch(() => {});
      else if (await visible(next)) await next.click().catch(() => {});
      await page.waitForTimeout(300);
    }
    states.packReducedMotion = steps;
  };

  try {
    await waitForHome(page);
    await settle(page, 800);
    await closeDialogs(page);
    // ======================= walk =======================
    if (parts.includes('walk'))
      await section('walk', async () => {
      await step('home', async () => {}, { measure: async () => ({ home: await homeAudit(page), ...(await homeRect()) }) });
      await step(
        'home-scrolled',
        () => page.evaluate(() => { const s = document.querySelector('.home-scroll'); if (s) s.scrollTop = s.scrollHeight; }),
        { measure: homeRect }
      );
      await page.evaluate(() => { const s = document.querySelector('.home-scroll'); if (s) s.scrollTop = 0; });
      await step('howto', async () => { await tap(page.getByRole('button', { name: 'How to play' }), 'How to play'); await dialog(); });
      await closeDialogs(page);
      await step('missions', async () => { await tap(page.locator('.statchip.quests'), 'missions'); await dialog(); });
      await closeDialogs(page);
      await step('gauntlet', async () => { await tap(page.locator('.statchip.gauntlet-chip'), 'gauntlet'); await dialog(); });
      await closeDialogs(page);
      for (const [mode, re] of [['blind', /blind/i], ['daily', /daily/i], ['h2h', /head to head/i], ['classic', /classic/i]])
        await step('home-mode-' + mode, () => tap(page.locator('.mode').filter({ hasText: re }).first(), 'mode ' + mode), { measure: homeRect });
      if (sport !== 'soccer') {
        await step('training', async () => { await tap(page.locator('.training-entry'), 'Training Camp'); await page.locator('.evo-top').waitFor({ timeout: 30000 }); }, { settleMs: 700 });
        await tap(page.getByRole('button', { name: 'Leave Training Camp' }), 'leave camp').catch(() => {});
        await page.locator('.home .playbar').waitFor({ timeout: 30000 }).catch(() => {});
      } else missing('training', 'Training Camp is hidden in soccer');
      await step('ranks', () => mainTab('RANKS'), { settleMs: 900 });
      await step('profile', () => mainTab('PROFILE'));
      await step('settings', async () => { await tap(page.getByRole('button', { name: 'Settings', exact: true }), 'Settings'); await dialog(); }, { settleMs: 600 });
      const adv = page.getByRole('button', { name: /^ADVANCED/ });
      if (await visible(adv)) {
        await step('settings-danger', async () => {
          await tap(adv, 'Advanced');
          await page.evaluate(() => document.querySelector('.danger-zone, [class*=danger]')?.scrollIntoView({ block: 'end' }));
        });
        // the keyboard up over the type-to-confirm field
        const input = page.locator('[role=dialog] input:not([type=checkbox])').last();
        if (await visible(input)) {
          await input.focus();
          await keyboardViewport(page, KEYBOARD_H);
          states.keyboardDanger = await keyboardAudit(page, KEYBOARD_H, ['KEEP MY PROGRESS', 'ERASE EVERYTHING']);
          await cap('kb-danger', { audit: false, settleMs: 200 });
          await keyboardViewport(page, null);
        } else missing('kb-danger', 'no type-to-confirm field');
      } else missing('settings-danger', 'no Advanced danger zone on this build');
      await closeDialogs(page);
      await mainTab('HOME');
      await settle(page, 400);
      // ---------- the Draft: the toast, the board after a spin, the booster tray ----------
      await tap(page.locator('.mode').filter({ hasText: /classic/i }).first(), 'mode classic');
      await tap(page.locator('.home .playbar button').first(), 'PLAY');
      await page.locator('.screen.draft').waitFor({ timeout: 60000 });
      await settle(page, 1200);
      await step(
        'draft-toast',
        async () => {
          await tap(page.getByRole('button', { name: 'Respin team' }), 'respin before a spin', { force: true });
          await page.locator('.toast').waitFor({ timeout: 5000 });
        },
        { settleMs: 160 }
      );
      await page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
      await step('draft-spin', async () => { await tap(page.getByRole('button', { name: 'SPIN', exact: true }), 'SPIN'); await page.waitForTimeout(3600); });
      await step('draft-boosters', async () => {
        await page.evaluate(() => { const r = document.querySelector('.drawer.open .drawer-body, .drawer.open'); const s = [...(r?.querySelectorAll('*') ?? [])].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4) || r; if (s) s.scrollTop = s.scrollHeight; });
        await page.locator('.drawer-tray .boost').first().waitFor({ timeout: 5000 });
      });
      await tap(page.getByRole('button', { name: 'Leave draft' }), 'leave draft').catch(() => {});
      const leave = page.getByRole('button', { name: /^(LEAVE|QUIT|YES)/ }).first();
      if (await visible(leave)) await leave.click();
      await page.locator('.home .playbar').waitFor({ timeout: 30000 }).catch(() => home());
      // ---------- Ultimate Team ----------
      await flush();
      const at = await pageNow(page);
      await openUt(page);
      pending = { t0: at, label: 'Ultimate Team (open)', screen: String(n + 1).padStart(2, '0') };
      await settle(page, 900);
      await closeDialogs(page);
      await step('ut-home', async () => {});
      await step('ut-rewards', () => tap(page.locator('.ut-home-inbox'), 'Rewards'));
      await back().catch(() => {});
      await step('ut-daily', () => tap(page.locator('.ut-home-daily'), 'Daily'));
      await back().catch(() => {});
      await step('ut-records', () => tap(page.locator('.uh-form'), 'Records'));
      await back().catch(() => {});
      await step('ut-play', () => utTab('PLAY'));
      for (const row of PLAY_MODES[sport]) {
        const name = 'ut-play-' + row.toLowerCase().replace(/\s+/g, '-');
        const tile = page.locator('.play-mode').filter({ hasText: row }).first();
        if (!(await visible(tile))) {
          missing(name, 'not offered in ' + sport);
          continue;
        }
        await step(name, () => tap(tile, row), { measure: row === 'CLUB CUPS' ? async () => ({ sticky: await stickyAudit(page, '.cup-page > .cup-go') }) : null });
        await back().catch(() => {});
        await settle(page, 250);
      }
      await step('ut-play-rivals', () => tap(page.locator('.up-rivals-top'), 'Rivals'));
      await back().catch(() => {});
      await step('ut-squad', () => utTab('SQUAD'));
      await step('ut-club-players', () => utTab('CLUB'));
      await step('ut-club-filter', async () => { await tap(page.locator('.ut-filter-btn'), 'Filter'); await dialog(); });
      await closeDialogs(page);
      const detail = async () => ({ sticky: await stickyAudit(page, '.sheet .ut-detail-btns'), detailBar: await detailBarAudit(page) });
      await step('ut-card-detail', async () => { await tap(page.locator('.ut-gridcard').first(), 'card'); await dialog(); }, { measure: detail, settleMs: 700 });
      await step('ut-card-detail-end', () => page.evaluate(() => { const s = [...document.querySelectorAll('.sheet')].pop(); s.scrollTop = s.scrollHeight; }), { measure: detail });
      await closeDialogs(page);
      await step('ut-club-tracker', () => tap(page.locator('.ut-tracker-link'), 'Pack Tracker'));
      await back().catch(() => {});
      await step('ut-club-storage', () => seg('STORAGE'));
      await step('ut-club-collection', () => seg('COLLECTION'));
      await step('ut-club-sets', () => tap(page.locator('.ut-so-link').filter({ hasText: 'Sets' }).first(), 'Sets'));
      await back().catch(() => {});
      await step('ut-club-development', () => seg('DEVELOPMENT'));
      await step('ut-club-evolutions', () => tap(page.getByRole('button', { name: /EVOLUTIONS LAB/ }).first(), 'Evolutions'));
      await back().catch(() => {});
      await step('ut-ch-sbc', async () => { await utTab('CHALLENGES'); await seg('SBCs'); });
      await step('ut-ch-sbc-detail', () => tap(page.locator('button.ut-sbc:not([disabled])').first(), 'an SBC'), { settleMs: 600 });
      await closeDialogs(page);
      if (await visible(page.locator('.ut-back'))) await back().catch(() => {});
      await step('ut-ch-standouts', async () => { await utTab('CHALLENGES'); await seg('SBCs'); await tap(page.locator('.ut-so-link').filter({ hasText: 'Weekly Standouts' }).first(), 'Standouts'); });
      await back().catch(() => {});
      await step('ut-ch-objectives', () => seg('OBJECTIVES'));
      await step('ut-ch-season-pass', () => seg('SEASON PASS'));
      await step('ut-store', () => utTab('STORE'));
      await step('ut-store-odds', async () => { await tap(page.locator('.ut-oddsbtn').first(), 'Odds'); await dialog(); });
      await closeDialogs(page);
      await step('ut-store-market', () => tap(page.getByRole('tab', { name: 'SCOUT MARKET' }), 'Scout Market'));
      await page.getByRole('tab', { name: 'PACKS' }).click().catch(() => {});
      await settle(page, 300);
      // ---------- a pack with motion: the seal, the walkout with SKIP, the grid ----------
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const packs = page.locator('.ut-mine-pack');
      // the daily drop opens with motion (the standard player's own pack is kept for the reduced-motion pass)
      const daily = page.locator('.ut-daily-btn');
      await step('pack-seal', async () => tap((await visible(daily)) ? daily : packs.first(), 'open a pack'), { settleMs: 700 });
      await step('pack-walkout', async () => { await tap(page.locator('.ut-cinema-open'), 'tear the pack'); await page.locator('.ut-skip').waitFor({ timeout: 10000 }); }, { settleMs: 120 });
      await step('pack-grid', async () => {
        // SKIP rides the cinema's animation and can be gone by the time the tap lands: the grid is the check
        await tap(page.locator('.ut-skip'), 'SKIP', { force: true, timeout: 3000 }).catch(() => (pending = null));
        for (let i = 0; i < 12 && !(await visible(page.getByRole('button', { name: 'DONE', exact: true }))); i++) {
          const more = page.getByRole('button', { name: /SKIP|TAP TO CONTINUE/ }).first();
          if (await visible(more)) await more.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
        }
        await page.getByRole('button', { name: 'DONE', exact: true }).waitFor({ timeout: 10000 });
      }, { settleMs: 500 });
      const done = page.getByRole('button', { name: 'DONE', exact: true });
      if (await visible(done)) await tap(done, 'DONE');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await settle(page, 600);
      await closeDialogs(page);
      await closeDialogs(page);
      await step('ut-exit', async () => { await utTab('HOME'); await tap(page.locator('.ut-back'), 'EXIT'); await page.locator('nav.tabs').waitFor({ timeout: 30000 }); }, { measure: homeRect });
      });
    // ======================= packrm: only the reduced-motion pack (the preserve check alone) =======================
    if (parts.includes('packrm'))
      await section('packrm', async () => {
        await openUt(page);
        await settle(page, 700);
        await closeDialogs(page);
        await utTab('STORE');
        await settle(page, 500);
        await packReducedMotion();
      });
    // ======================= match =======================
    if (parts.includes('match'))
      await section('match', async () => {
      await home();
      // ---------- Head to Head vs the AI: Search (and its keyboard), the draft, the Vote, PLAY ----------
      await tap(page.locator('.mode').filter({ hasText: /head to head/i }).first(), 'mode h2h');
      await step('search', async () => { await tap(page.locator('.home .playbar button').first(), 'PLAY'); await page.locator('.screen.search').waitFor({ timeout: 30000 }); }, { settleMs: 700 });
      const friend = page.getByRole('button', { name: /PLAY A FRIEND/ });
      if (await visible(friend)) {
        await tap(friend, 'Play a friend');
        const code = page.getByLabel("Friend's code");
        if (await code.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
          await code.focus();
          await keyboardViewport(page, KEYBOARD_H);
          states.keyboardSearch = await keyboardAudit(page, KEYBOARD_H, ['JOIN']);
          await cap('kb-search', { audit: false, settleMs: 200 });
          await keyboardViewport(page, null);
          await page.evaluate(() => document.activeElement?.blur());
        } else missing('kb-search', "no Friend's code field");
        await page.getByRole('button', { name: /QUICK MATCH/ }).click().catch(() => {});
        await settle(page, 300);
      }
      try {
        await tap(page.getByRole('button', { name: /PLAY THE AI NOW/ }), 'play the AI');
        await page.locator('.screen.draft').waitFor({ timeout: 60000 });
        await settle(page, 800);
        if (!(await draftToVote())) {
          const state = await page.evaluate(() => [...document.querySelectorAll('.screen.draft button')].filter((b) => b.getBoundingClientRect().height > 0).map((b) => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24)).slice(0, 12).join(' | '));
          throw Error('the draft did not reach the Vote in 240 s; buttons: ' + state);
        }
        await cap('vote', { settleMs: 400 });
        await tap(page.locator('.vote-opt.play'), 'Vote PLAY');
        await matchFrames('h2h');
      } catch (e) {
        const file = String(++n).padStart(2, '0') + '-h2h';
        await page.screenshot({ path: path.join(dir, file + '-FAILED.png') }).catch(() => {});
        screens.push({ screen: file, fail: e.message.split('\n')[0] });
      }
      // ---------- a UT Squad Battle ----------
      await home();
      try {
        await flush();
        await openUt(page);
        await settle(page, 700);
        await closeDialogs(page);
        await utTab('PLAY');
        await tap(page.locator('.play-mode').filter({ hasText: 'SQUAD BATTLES' }).first(), 'Squad Battles');
        await settle(page, 500);
        await tap(page.getByRole('button', { name: /^Rung 1:/ }), 'Rung 1');
        const vote = page.locator('.vote-opt.play');
        if (await vote.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
          await cap('ut-vote', { settleMs: 200 });
          await tap(vote, 'Vote PLAY');
        } else {
          const go = page.getByRole('button', { name: /^PLAY/ }).last();
          if (await visible(go)) await tap(go, 'PLAY');
        }
        await matchFrames('ut');
      } catch (e) {
        const file = String(++n).padStart(2, '0') + '-ut-match';
        await page.screenshot({ path: path.join(dir, file + '-FAILED.png') }).catch(() => {});
        screens.push({ screen: file, fail: e.message.split('\n')[0] });
      }
      // ---------- soccer's shootout (the lab is on the dev server only) ----------
      if (sport === 'soccer') {
        if (buildRoot) missing('match-shootout', 'production builds have no soccer lab');
        else
          await step(
            'match-shootout',
            async () => {
              pending = null;
              await page.goto(appUrl('soccer', '&soccer-lab&pens&seed=edge'), { waitUntil: 'domcontentloaded' });
              await page.locator('.arcade-full canvas').first().waitFor({ timeout: 90000 });
              await page.waitForTimeout(3000);
              await arcadeInsets(page, d.insets);
            },
            { measure: async () => ({ scrim: await hudScrim(page) }) }
          );
      }
      });
    // ======================= edge states =======================
    if (parts.includes('edge'))
      await section('edge', async () => {
      await home();
      try {
        await rotate(page, dev, true);
        const [t, , b] = d.insets;
        states.rotated = await rotatedAudit(page);
        await cap('rotated', { device: { insets: [0, b, 0, t] }, settleMs: 200 });
      } catch (e) {
        screens.push({ screen: String(++n).padStart(2, '0') + '-rotated', fail: e.message.split('\n')[0] });
      }
      await rotate(page, dev, false).catch(() => {});
      });
  } finally {
    await flush().catch(() => {});
    await f.context.close();
  }
  // ---------- Welcome with the keyboard up (a fresh player, its own context) ----------
  if (parts.includes('edge')) {
    const w = await fixture(browser, sport, 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 1, profile: 'fresh', serialized: true });
    try {
      await waitForHome(w.page, 'fresh');
      const input = w.page.locator('input').first();
      if (await input.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
        await input.focus();
        await keyboardViewport(w.page, KEYBOARD_H);
        states.keyboardWelcome = await keyboardAudit(w.page, KEYBOARD_H, ['NEXT']);
        const file = String(++n).padStart(2, '0') + '-kb-welcome';
        await w.page.screenshot({ path: path.join(dir, file + '.png') });
        screens.push({ screen: file, shots: [file + '.png'] });
      } else missing('kb-welcome', 'Welcome shows no name field');
      f.errors.push(...w.errors);
      f.blocked.push(...w.blocked);
    } catch (e) {
      screens.push({ screen: String(++n).padStart(2, '0') + '-kb-welcome', fail: e.message.split('\n')[0] });
    } finally {
      await w.context.close();
    }
  }
  const report = { sport, device: dev, phone: d.name, insets: d.insets, expected: expectedLayout(dev), profile, build: buildRoot, base, ms: Date.now() - t0, errors: f.errors, blocked: [...new Set(f.blocked)], screens, na, taps, hud, states };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1));
  return report;
}

// ======================= paint: header repaint while a list scrolls, at 4× CPU =======================
async function paintPart(browser, sport) {
  const dev = '393',
    d = DEVICES[dev];
  const f = await fixture(browser, sport, 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 3, profile: 'heavy', serialized: true });
  const { page } = f;
  const out = { sport, device: dev, lists: {} };
  try {
    await waitForHome(page, 'heavy');
    await openUt(page);
    await settle(page, 1000);
    await closeDialogs(page);
    const cdp = await f.context.newCDPSession(page);
    const utTab = (label) => page.locator('.ut-tabs button').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).click();
    for (const [name, open] of [
      ['club-players', () => utTab('CLUB')],
      ['sbcs', async () => { await utTab('CHALLENGES'); await page.locator('.ut-segs [role=tab]').filter({ hasText: /^SBCs/ }).first().click(); }],
    ]) {
      await open();
      await settle(page, 900);
      const header = await page.evaluate(() => {
        const h = document.querySelector('.screen > .topbar');
        return h ? h.getBoundingClientRect().bottom : 0;
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const events = [];
      const tracer = await browser.newBrowserCDPSession();
      tracer.on('Tracing.dataCollected', (e) => events.push(...e.value));
      const finished = new Promise((r) => tracer.once('Tracing.tracingComplete', r));
      await tracer.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
      // scroll the list down a little every frame for about two seconds, as a finger would
      const frames = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const all = [...document.querySelectorAll('.screen *')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 40);
            const s = all.sort((a, b) => b.clientHeight - a.clientHeight)[0];
            if (!s) return resolve(0);
            const t0 = performance.now();
            let n = 0;
            const step = () => {
              s.scrollTop += 9;
              n++;
              if (performance.now() - t0 < 2200) requestAnimationFrame(step);
              else resolve(n);
            };
            requestAnimationFrame(step);
          })
      );
      await tracer.send('Tracing.end');
      await finished;
      await tracer.detach();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      // header paints: Paint events whose clip starts above the header's bottom edge. The clip's units
      // (CSS or device px) differ between Chromium versions, so the test is the conservative one: a
      // paint counts as the header's when it starts above the header in either unit
      const paints = events.filter((e) => e.name === 'Paint' && e.ph === 'X');
      const dpr = 3;
      const top = paints.filter((e) => {
        const q = e.args?.data?.clip;
        if (!q) return false;
        return Math.min(q[1], q[3], q[5], q[7]) < header * dpr - 0.5;
      });
      const ms = top.reduce((s, e) => s + (e.dur || 0), 0) / 1000;
      out.lists[name] = { header: Math.round(header), frames, paints: paints.length, headerPaints: top.length, headerPaintMs: Math.round(ms * 100) / 100, msPerFrame: frames ? Math.round((ms / frames) * 1000) / 1000 : null, allPaintMs: Math.round((paints.reduce((s, e) => s + (e.dur || 0), 0) / 1000) * 100) / 100, allMsPerFrame: frames ? Math.round((paints.reduce((s, e) => s + (e.dur || 0), 0) / 1000 / frames) * 1000) / 1000 : null };
      await closeDialogs(page);
    }
  } finally {
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    await f.context.close();
  }
  return out;
}

/** Per run: the counts the acceptance reads, every exception by selector, and the tap timing. */
function summarize(r) {
  const ok = r.screens.filter((s) => !s.fail);
  const sum = (k) => ok.reduce((s, x) => s + (x.audit ? (Array.isArray(x.audit[k]) ? x.audit[k].length : x.audit[k] > 0 ? 1 : 0) : 0), 0);
  const where = (k) => ok.filter((x) => x.audit && (Array.isArray(x.audit[k]) ? x.audit[k].length : x.audit[k] > 0)).map((x) => ({ screen: x.screen, items: Array.isArray(x.audit[k]) ? x.audit[k].map((i) => (typeof i === 'string' ? i : i.label + ' ' + (i.capTop ?? i.top ?? i.bottom))) : x.audit[k] }));
  const inps = r.taps.map((t) => (t.inp === null ? 0 : t.inp));
  const plays = ok.filter((s) => s.playRect).map((s) => s.playRect);
  const playSpread = plays.length ? Math.max(...['top', 'bottom'].map((k) => Math.max(...plays.map((p) => p[k])) - Math.min(...plays.map((p) => p[k])))) : null;
  return {
    sport: r.sport,
    device: r.device,
    ms: r.ms,
    screens: ok.length,
    failed: r.screens.filter((s) => s.fail).map((s) => s.screen + ': ' + s.fail),
    na: r.na.map((x) => x.screen),
    errors: r.errors,
    blocked: r.blocked,
    textInBand: sum('textInBand'),
    controlInBand: sum('controlInBand'),
    bottomCut: sum('bottomCut'),
    docScroll: sum('docScroll'),
    hOverflow: sum('hOverflow'),
    offscreen: sum('offscreen'),
    where: { textInBand: where('textInBand'), controlInBand: where('controlInBand'), bottomCut: where('bottomCut'), offscreen: where('offscreen'), docScroll: where('docScroll') },
    // sideways the stage is counter-rotated, so box widths and heights swap: sizes are judged upright only
    small: where('small').filter((x) => !/rotated/.test(x.screen)),
    overlap: where('overlap').filter((x) => !/rotated/.test(x.screen)),
    m6: ok.filter((s) => /draft-(spin|boosters)/.test(s.screen)).map((s) => ({ screen: s.screen, small: s.audit.small.filter((x) => /Respin|DOUBLE|TRADE|PRIME|unlocks at level|you have/i.test(x)), overlap: s.audit.overlap.filter((x) => /Respin|DOUBLE|TRADE|PRIME|you have/i.test(x)) })),
    plates: ok.filter((s) => s.plates?.header).map((s) => ({ screen: s.screen, el: s.plates.header.el, ok: s.plates.header.opaque && s.plates.header.probesOk })),
    squeezed: ok.filter((s) => s.preserve?.squeezed?.length).map((s) => ({ screen: s.screen, squeezed: s.preserve.squeezed })),
    backLabels: Object.fromEntries(ok.filter((s) => s.preserve?.back).map((s) => [s.screen.slice(3), s.preserve.back])),
    playRects: plays.length,
    playSpread,
    sticky: ok.filter((s) => s.sticky).map((s) => ({ screen: s.screen, ...s.sticky })),
    detailBar: ok.filter((s) => s.detailBar).map((s) => ({ screen: s.screen, gap: s.detailBar.gap, textBelowBar: s.detailBar.textBelowBar.length })),
    hud: { frames: r.hud.length, spritePx: r.hud.reduce((s, h) => s + h.spritePx, 0), framesWithSprites: r.hud.filter((h) => h.spritePx > 0).length, busyRowsMax: r.hud.reduce((m, h) => Math.max(m, h.busyRows), 0) },
    scrim: ok.filter((s) => s.scrim).map((s) => ({ screen: s.screen, ...s.scrim })),
    states: r.states,
    taps: { n: r.taps.length, measured: r.taps.filter((t) => t.inp !== null).length, p95: percentile(inps, 95), max: inps.length ? Math.max(...inps) : null, longFramesMax: Math.max(0, ...r.taps.map((t) => t.long)), fpsAvg: r.taps.length ? Math.round((r.taps.reduce((s, t) => s + (t.fps ?? 0), 0) / r.taps.filter((t) => t.fps).length) * 10) / 10 : null, offenders: r.taps.filter((t) => (t.inp ?? 0) > 100 || t.long > 1).map((t) => ({ tap: t.tap, screen: t.screen, inp: t.inp, long: t.long, worst: t.worst, fps: t.fps })) },
  };
}

const browser = await launch();
const started = Date.now();
const results = [];
try {
  if (parts.includes('paint')) {
    const paint = [];
    for (const sport of sports) {
      const r = await paintPart(browser, sport);
      paint.push(r);
      console.log(JSON.stringify(r));
    }
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'paint-' + sports.join('-') + '.json'), JSON.stringify({ phase, base, build: buildRoot, paint }, null, 1));
  }
  if (parts.some((p) => p !== 'paint')) {
    const queue = sports.flatMap((sport) => devices.map((dev) => [sport, dev]));
    const workers = Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const [sport, dev] = queue.shift();
        const r = await runDevice(browser, sport, dev);
        results.push(r);
        const s = summarize(r);
        console.log(JSON.stringify({ sport, device: dev, ms: r.ms, screens: s.screens, failed: s.failed, na: s.na.length, errors: r.errors.length, band: s.textInBand + '/' + s.controlInBand, bottomCut: s.bottomCut, p95: s.taps.p95 }));
        const files = r.screens.flatMap((x) => (x.shots ?? []).filter((f) => !f.endsWith('-band.png')).map((f) => path.join(OUT, sport + '-' + dev, f)));
        await contactSheet(browser, files, path.join(ROOT, 'sheets', sport + '-' + dev + '.png'), { cols: 10, tile: 160, title: `edge-walk ${phase} · ${sport} · ${dev} (${DEVICES[dev].name})` });
      }
    });
    await Promise.all(workers);
  }
} finally {
  await browser.close();
}
if (results.length) {
  const summary = results.map(summarize);
  fs.writeFileSync(path.join(OUT, 'summary-' + sports.join('-') + '-' + devices.length + '.json'), JSON.stringify({ phase, base, build: buildRoot, profile, parts, wallMs: Date.now() - started, summary }, null, 1));
  const bad = results.reduce((s, r) => s + r.errors.length, 0);
  console.log(JSON.stringify({ phase, wallMs: Date.now() - started, runs: results.length, pageErrors: bad, nonLocalHostsBlocked: [...new Set(results.flatMap((r) => r.blocked))] }));
  if (bad) process.exitCode = 1;
}
