// Claude (studio overhaul, shell-3, 2026-11-16): the early-ship plate and card-detail probes (Fix B,
// Fix C part 1, H1). Isolated like every shell run: ?ns=inspect, the local relay, every other host
// aborted, fixture players only, and it never taps SAVE NOW, ERASE, SELL or anything that spends.
//
//   node scripts/qa/plates.mjs --phase before|ship [--parts plates,h1,has] [--sports nba,nfl,soccer]
//     [--devices 393,390,402,440,320] [--runs 5]
//
// plates (393, standard player): Home, a sheet over Home, UT Home and its five tabs: the status plate,
//   the header probes (platesAudit), the UT seam across the inset line (CIEDE2000 at x = 20/195/370),
//   band luminance y 0..inset with A + B + C against A alone (PLATES_OFF_CSS), the band against the
//   scrimmed area just below it with a sheet open, the plate hidden on pack opening, the splash and
//   (synthetic) vs-splash and season reveal, and no transition under reduced motion.
// h1 (heavy player): the card detail from Club, Storage, Squad, Evolutions and the Pack Tracker at the
//   sheet's top, middle and end: bar bottom against the sheet bottom, a hit 4 pt above the sheet edge,
//   text showing below the bar; Collection opens no detail bar (checked); at 320 the bar region's
//   pixels against the before phase's.
// has (NBA heavy, 393): style-recalc time (CDP RecalcStyleDuration) of opening UT Club, with
//   plates.css on and off, interleaved.
// seams (393, standard player): the seam across the inset line (CIEDE2000 at x = 20/195/370, 1.5 pt
//   above and below it), with every plate and with A alone, on the screens without a header (the real
//   Draft; Playoffs, Welcome, Vote and Search as the real class over the Draft) and on the full-screen
//   overlays drawn over a header screen (Champions, GameCast, Rivals promotion, sport switch over
//   Home; the UT player pick over UT Home), each a synthetic element with the real class.
// Output: <PS_QA_SHOTS>/shell-3/<phase>/plates-*.json and screenshots there.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, base, dismissPack, fixture, launch } from './browser.mjs';
import { closeDialogs, deltaE2000, detailBarAudit, detailBarHit, DEVICES, edgeOf, meanLumaDiffPct, platesAudit, platesOff, readPixels, settle } from './edge-lib.mjs';
import { openUt, waitForHome } from './fixtures.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const phase = opt('phase', 'ship');
const parts = opt('parts', 'plates,h1,has,seams').split(',');
const sports = opt('sports', 'nba,nfl,soccer').split(',');
const h1Devices = opt('devices', '393,390,402,440,320').split(',');
const runs = Math.max(1, +opt('runs', 5));
const ROOT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), 'shell-3');
const OUT = path.join(ROOT, phase);
fs.mkdirSync(OUT, { recursive: true });
const r2 = (n) => (n === null || n === undefined ? n : Math.round(n * 100) / 100);
const ctxOpts = { isMobile: true, hasTouch: true };
const utTab = (page, label) => page.locator('.ut-tabs button').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).click();
const save = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1));

/** Band luminance y 0..inset across the width: with every plate, and with B and C turned off. */
async function band(page, t) {
  const region = { y0: 0, y1: t, lumas: true };
  const abc = (await readPixels(page, { regions: [region] })).regions[0];
  await platesOff(page, true);
  await settle(page, 120);
  const a = (await readPixels(page, { regions: [region] })).regions[0];
  await platesOff(page, false);
  await settle(page, 120);
  return { lumaABC: abc.luma, lumaA: a.luma, meanColorABC: abc.mean, meanColorA: a.mean, meanDiffPct: r2(meanLumaDiffPct(abc.lumas, a.lumas)) };
}

/** The plate's own display while an element with these classes is in the app (a synthetic stand-in). */
const plateWith = (page, cls) =>
  page.evaluate((cls) => {
    const host = document.querySelector('.stage') || document.getElementById('root');
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.append(d);
    const out = getComputedStyle(document.querySelector('.status-plate') || document.body).display;
    d.remove();
    return out;
  }, cls);

async function platesPart(browser, sport) {
  const dev = '393',
    d = DEVICES[dev],
    t = d.insets[0];
  const dir = path.join(OUT, 'plates-' + sport);
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture(browser, sport, 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 1, serialized: true });
  const { page } = f;
  const out = { sport, device: dev };
  try {
    await waitForHome(page);
    await settle(page, 500);
    const shot = (n) => page.screenshot({ path: path.join(dir, n + '.png') });
    out.home = { audit: await platesAudit(page, dev), band: await band(page, t) };
    await shot('home');
    out.reducedMotionTransition = await page.evaluate(() => {
      const p = document.querySelector('.status-plate');
      return p ? getComputedStyle(p).transitionDuration : null;
    });
    // a sheet over Home: the band against the scrimmed header just below it
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await settle(page, 600);
    const px = await readPixels(page, { regions: [{ y0: 0, y1: t }, { y0: t, y1: t + 8 }] });
    const [bandR, below] = px.regions;
    out.sheet = { status: (await platesAudit(page, dev)).status, bandLuma: bandR.luma, belowLuma: below.luma, bandColor: bandR.mean, belowColor: below.mean, relDiffPct: r2(((bandR.luma - below.luma) / below.luma) * 100), absDiffPct: r2(((bandR.luma - below.luma) / 255) * 100) };
    await shot('sheet');
    await closeDialogs(page);
    await settle(page, 400);
    out.afterSheet = (await platesAudit(page, dev)).status;
    // the immersive screens the plate must not cover (synthetic stand-ins for the hard-to-reach ones)
    out.hidden = { vsSplash: await plateWith(page, 'vs-splash'), seasonReveal: await plateWith(page, 'screen reveal'), splashClass: await plateWith(page, 'splash') };
    // ---------- Ultimate Team ----------
    await openUt(page);
    await settle(page, 700);
    await closeDialogs(page);
    const audit = await platesAudit(page, dev);
    const xs = [20, 195, 370];
    const seamPx = await readPixels(page, { points: xs.flatMap((x) => [[x, t - 1.5], [x, t + 1.5]]) });
    const seam = xs.map((x, i) => ({ x, above: seamPx.points[i * 2], below: seamPx.points[i * 2 + 1], dE: r2(deltaE2000(seamPx.points[i * 2], seamPx.points[i * 2 + 1])) }));
    out.utHome = { audit, seam, seamMax: Math.max(...seam.map((s) => s.dE)), band: await band(page, t) };
    await shot('ut-home');
    out.utTabs = {};
    for (const tab of ['PLAY', 'SQUAD', 'CLUB', 'CHALLENGES', 'STORE']) {
      await utTab(page, tab);
      await settle(page, 450);
      out.utTabs[tab] = await platesAudit(page, dev);
      if (tab === 'CLUB') await shot('ut-club');
    }
    // UT with a sheet open (the Club filter)
    await utTab(page, 'CLUB');
    await settle(page, 300);
    await page.locator('.ut-filter-btn').click();
    await page.getByRole('dialog').waitFor();
    await settle(page, 600);
    const upx = await readPixels(page, { regions: [{ y0: 0, y1: t }, { y0: t, y1: t + 8 }] });
    out.utSheet = { status: (await platesAudit(page, dev)).status, bandLuma: upx.regions[0].luma, belowLuma: upx.regions[1].luma, relDiffPct: r2(((upx.regions[0].luma - upx.regions[1].luma) / upx.regions[1].luma) * 100), absDiffPct: r2(((upx.regions[0].luma - upx.regions[1].luma) / 255) * 100) };
    await shot('ut-sheet');
    await closeDialogs(page);
    // pack opening: the plate steps aside for the cinema's own colour
    await utTab(page, 'STORE');
    await settle(page, 400);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const daily = page.locator('.ut-daily-btn');
    if (await daily.isVisible().catch(() => false)) await daily.click();
    else await page.locator('.ut-mine-pack').first().click();
    await page.locator('.ut-open-screen').waitFor({ timeout: 10000 });
    await settle(page, 300);
    out.packOpening = (await platesAudit(page, dev)).status;
    await shot('pack-open');
    await dismissPack(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await closeDialogs(page);
    // the launch splash, on a fresh load of the same player
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.splash').waitFor({ timeout: 20000 });
    out.splash = (await platesAudit(page, dev)).status;
  } catch (e) {
    out.fail = e.message.split('\n')[0];
  } finally {
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    await f.context.close();
  }
  return out;
}

/** CIEDE2000 across the inset line at x = 20/195/370 (1.5 pt above against 1.5 pt below), and the plate's colour. */
async function seamAt(page, t) {
  const xs = [20, 195, 370];
  const px = await readPixels(page, { points: xs.flatMap((x) => [[x, t - 1.5], [x, t + 1.5]]) });
  const dE = xs.map((x, i) => r2(deltaE2000(px.points[i * 2], px.points[i * 2 + 1])));
  const plate = await page.evaluate(() => {
    const p = document.querySelector('.status-plate');
    return p ? getComputedStyle(p).display + ' ' + getComputedStyle(p).backgroundColor : null;
  });
  return { plate, dE, max: Math.max(...dE), above: px.points[2], below: px.points[3] };
}
/** The seam with every plate (A + B + C) and with A alone. */
async function seamBoth(page, t) {
  const abc = await seamAt(page, t);
  await platesOff(page, true);
  await settle(page, 120);
  const a = await seamAt(page, t);
  await platesOff(page, false);
  await settle(page, 300);
  return { abc, a: { dE: a.dE, max: a.max } };
}
/** Append an element with these classes next to `near` (or into the stage), measure, remove it. */
async function seamWith(page, t, cls, near) {
  await page.evaluate(
    ([cls, near]) => {
      const host = (near && document.querySelector(near)?.parentElement) || document.querySelector('.stage') || document.getElementById('root');
      const d = document.createElement('div');
      d.className = cls;
      d.id = '__ps-seam-probe';
      host.append(d);
    },
    [cls, near]
  );
  await settle(page, 600);
  const out = await seamBoth(page, t);
  await page.evaluate(() => document.getElementById('__ps-seam-probe')?.remove());
  await settle(page, 300);
  return out;
}

async function seamsPart(browser, sport) {
  const dev = '393',
    d = DEVICES[dev],
    t = d.insets[0];
  const dir = path.join(OUT, 'seams-' + sport);
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture(browser, sport, 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 1, serialized: true });
  const { page } = f;
  const out = { sport, device: dev, headerless: {}, overlays: {} };
  try {
    await waitForHome(page);
    await settle(page, 500);
    out.home = await seamBoth(page, t);
    // full-screen overlays over Home (a header screen)
    for (const cls of ['champ', 'champ perfect', 'cast', 'promotion', 'sportfade nba']) out.overlays[cls] = await seamWith(page, t, cls, '.shell');
    await page.screenshot({ path: path.join(dir, 'home.png') });
    // the real Draft, reached with PLAY
    await page.locator('.mode').filter({ hasText: /CLASSIC/i }).first().click();
    await page.locator('.home .playbar button').click();
    await page.locator('.screen.draft').waitFor({ timeout: 60000 });
    await settle(page, 700);
    out.headerless.draft = await seamBoth(page, t);
    await page.screenshot({ path: path.join(dir, 'draft.png') });
    await page.screenshot({ path: path.join(dir, 'draft-top.png'), clip: { x: 0, y: 0, width: d.w, height: 140 } });
    // the other header-less screens: the real class laid over the Draft
    for (const cls of ['screen playoffs', 'screen welcome', 'screen vote', 'screen search']) out.headerless[cls.split(' ')[1]] = await seamWith(page, t, cls, '.screen.draft');
    // the UT player pick over UT Home (back Home first: the Draft has no UT entry)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForHome(page);
    await openUt(page);
    await settle(page, 700);
    await closeDialogs(page);
    out.utHome = await seamBoth(page, t);
    out.overlays['ut-pick-screen'] = await seamWith(page, t, 'ut-pick-screen', '.screen.ut');
  } catch (e) {
    out.fail = e.message.split('\n')[0];
  } finally {
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    await f.context.close();
  }
  return out;
}

/** Open a card detail by `open`, then measure it at the sheet's top, middle and end. */
async function detailAt(page, open) {
  await open();
  await page.locator('.sheet .ut-detail-btns').waitFor({ timeout: 10000 });
  await settle(page, 650);
  const rows = {};
  for (const where of ['top', 'mid', 'end']) {
    if (where !== 'top') {
      await page.evaluate((where) => {
        const s = [...document.querySelectorAll('.sheet')].pop();
        s.scrollTop = where === 'end' ? s.scrollHeight : (s.scrollHeight - s.clientHeight) / 2;
      }, where);
      await settle(page, 250);
    }
    const a = await detailBarAudit(page);
    const hit = await detailBarHit(page);
    rows[where] = { gap: a?.gap ?? null, scroll: a ? a.scrollTop + '/' + a.scrollMax : null, textBelowBar: a?.textBelowBar ?? null, hit4pt: hit };
  }
  return rows;
}

async function h1Part(browser, sport, dev) {
  const d = DEVICES[dev];
  const dir = path.join(OUT, 'h1-' + sport + '-' + dev);
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture(browser, sport, 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 1, profile: 'heavy' });
  const { page } = f;
  const out = { sport, device: dev, entries: {} };
  const entry = async (name, nav, open) => {
    try {
      await nav();
      await settle(page, 450);
      out.entries[name] = await detailAt(page, open);
      await page.screenshot({ path: path.join(dir, name + '-end.png') });
      if (name === 'club') {
        // the bar region at the end of the sheet, for the 320 pixel comparison
        const rect = await page.evaluate(() => {
          const bar = [...document.querySelectorAll('.sheet .ut-detail-btns')].pop();
          const b = bar.getBoundingClientRect(),
            s = bar.closest('.sheet').getBoundingClientRect();
          return { y0: Math.floor(b.top), y1: Math.ceil(s.bottom), x0: Math.floor(s.left), x1: Math.ceil(s.right) };
        });
        out.barRegion = rect;
        out.barPixels = (await readPixels(page, { regions: [{ ...rect, lumas: true }] })).regions[0].lumas;
      }
    } catch (e) {
      out.entries[name] = { fail: e.message.split('\n')[0] };
    }
    await closeDialogs(page);
  };
  const clubSeg = async (re) => {
    await utTab(page, 'CLUB');
    await settle(page, 300);
    await page.locator('.ut-segs [role=tab]').filter({ hasText: re }).first().click({ timeout: 8000 });
    await settle(page, 300);
  };
  try {
    await waitForHome(page, 'heavy');
    await openUt(page);
    await settle(page, 700);
    await closeDialogs(page);
    await entry(
      'club',
      () => clubSeg(/^players/i),
      () => page.locator('.ut-gridcard').first().click()
    );
    await entry(
      'storage',
      () => clubSeg(/^storage/i),
      () => page.locator('.ut-gridcard').first().click()
    );
    await entry(
      'evolutions',
      async () => {
        await clubSeg(/^development/i);
        await page.locator('.hq-mode-draft').filter({ hasText: /evolutions/i }).first().click({ timeout: 8000 });
      },
      () => page.locator('.ut-evo-card').first().click()
    );
    await entry(
      'tracker',
      async () => {
        await clubSeg(/^players/i);
        await page.locator('.ut-tracker-link').click({ timeout: 8000 });
        await settle(page, 300);
        // the tracker opens on BY PACK; RECENT lists the pulled cards
        await page.locator('.ut-segs [role=tab]').filter({ hasText: /^recent/i }).first().click({ timeout: 8000 });
      },
      () => page.locator('button.ut-trk-mini').first().click({ timeout: 10000 })
    );
    // Collection opens its own edition sheet (no sticky action bar): confirm it is untouched
    try {
      await clubSeg(/^collect/i);
      await settle(page, 300);
      await page.locator('.ut-book-card').first().click({ timeout: 5000 });
      await page.getByRole('dialog').waitFor({ timeout: 5000 });
      out.collectionDetailBar = await page.locator('.sheet .ut-detail-btns').count();
    } catch (e) {
      out.collectionDetailBar = 'not reached: ' + e.message.split('\n')[0];
    }
    await closeDialogs(page);
    // last: closing a detail opened from the Squad picker leaves the picker's closing scrim mounted over
    // the screen (a ut-lane bug reported in shell.md), which swallows every later tap
    await entry(
      'squad',
      () => utTab(page, 'SQUAD'),
      async () => {
        await page.locator('.ut-slot.filled').first().click();
        await page.getByRole('button', { name: 'DETAILS', exact: true }).click();
      }
    );
  } catch (e) {
    out.fail = e.message.split('\n')[0];
  } finally {
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    await f.context.close();
  }
  return out;
}

/** Style recalc of opening UT Club (heavy NBA), plates.css on and off, interleaved. */
async function hasPart(browser) {
  const d = DEVICES['393'];
  const f = await fixture(browser, 'nba', 'Edge QA', d.w, ctxOpts, { insets: d.insets, height: d.h, standalone: true, dsf: 1, profile: 'heavy' });
  const { page, context } = f;
  const out = { runs, on: [], off: [] };
  try {
    await waitForHome(page, 'heavy');
    await openUt(page);
    await settle(page, 800);
    await closeDialogs(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const recalc = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'RecalcStyleDuration').value * 1000;
    const toggle = (disabled) =>
      page.evaluate((disabled) => {
        let n = 0;
        for (const s of document.styleSheets) {
          try {
            // plates.css only (its :has() rules), never index.html's inline base sheet
            if ([...s.cssRules].some((r) => (r.selectorText || '').includes(':has(') && (r.selectorText || '').includes('status-plate'))) {
              s.disabled = disabled;
              n++;
            }
          } catch {
            /* cross-origin sheet (fonts) */
          }
        }
        return n;
      }, disabled);
    out.sheets = await toggle(false);
    for (let i = 0; i < runs * 2; i++) {
      const on = i % 2 === 0;
      await toggle(!on);
      // one unmeasured HOME → CLUB → HOME cycle after each toggle: (re)enabling a sheet makes the
      // engine rebuild its selector data on the next restyle, which is not what this measures
      await utTab(page, 'HOME');
      await settle(page, 500);
      await utTab(page, 'CLUB');
      await page.locator('.ut-gridcard').first().waitFor();
      await settle(page, 500);
      await utTab(page, 'HOME');
      await settle(page, 700);
      const r0 = await recalc();
      await utTab(page, 'CLUB');
      await page.locator('.ut-gridcard').first().waitFor();
      await settle(page, 1000);
      (on ? out.on : out.off).push(r2((await recalc()) - r0));
    }
    await toggle(false);
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    out.medianOn = med(out.on);
    out.medianOff = med(out.off);
    out.rise = r2(out.medianOn - out.medianOff);
    // paired: each on run against the off run right after it
    out.pairedMedianRise = r2(med(out.on.map((v, i) => v - out.off[i])));
  } catch (e) {
    out.fail = e.message.split('\n')[0];
  } finally {
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
    await context.close();
  }
  return out;
}

const browser = await launch();
const t0 = Date.now();
let failures = 0;
try {
  if (parts.includes('plates')) {
    const all = [];
    for (const s of sports) {
      const r = await platesPart(browser, s);
      all.push(r);
      failures += r.errors.length + (r.fail ? 1 : 0);
      console.log(JSON.stringify({ part: 'plates', sport: s, fail: r.fail, errors: r.errors.length, blocked: r.blocked }));
    }
    save('plates.json', all);
  }
  if (parts.includes('h1')) {
    const all = [];
    const before = phase !== 'before' && fs.existsSync(path.join(ROOT, 'before', 'h1.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'before', 'h1.json'), 'utf8')) : null;
    const queue = sports.flatMap((s) => h1Devices.map((dev) => [s, dev]));
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const [s, dev] = queue.shift();
        const r = await h1Part(browser, s, dev);
        const was = before?.find((b) => b.sport === s && b.device === dev);
        if (was?.barPixels && r.barPixels && was.barPixels.length === r.barPixels.length) {
          const changed = r.barPixels.filter((v, i) => Math.abs(v - was.barPixels[i]) > 4).length;
          r.barPixelsChangedPct = r2((changed / r.barPixels.length) * 100);
        } else if (was?.barPixels) r.barPixelsChangedPct = 'region size changed: ' + (was.barPixels?.length ?? 0) + ' → ' + (r.barPixels?.length ?? 0);
        all.push(r);
        failures += r.errors.length + (r.fail ? 1 : 0) + Object.values(r.entries).filter((e) => e.fail).length;
        console.log(JSON.stringify({ part: 'h1', sport: s, device: dev, fail: r.fail, entries: Object.fromEntries(Object.entries(r.entries).map(([k, v]) => [k, v.fail ? 'FAIL ' + v.fail : ['top', 'mid', 'end'].map((w) => v[w].gap + '/' + (v[w].textBelowBar?.length ?? '-') + '/' + (v[w].hit4pt ?? []).map(Number).join('')).join(' ')])), pixels: r.barPixelsChangedPct, collection: r.collectionDetailBar, errors: r.errors.length }));
      }
    });
    await Promise.all(workers);
    save('h1.json', all);
  }
  if (parts.includes('seams')) {
    const all = [];
    for (const s of sports) {
      const r = await seamsPart(browser, s);
      all.push(r);
      failures += r.errors.length + (r.fail ? 1 : 0);
      const row = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.abc.max + ' (A ' + v.a.max + ')']));
      console.log(JSON.stringify({ part: 'seams', sport: s, fail: r.fail, home: r.home && r.home.abc.max, ut: r.utHome && r.utHome.abc.max, headerless: row(r.headerless), overlays: row(r.overlays), errors: r.errors.length }));
    }
    save('seams.json', all);
  }
  if (parts.includes('has')) {
    const r = await hasPart(browser);
    failures += r.errors.length + (r.fail ? 1 : 0);
    console.log(JSON.stringify({ part: 'has', ...r }));
    save('has.json', r);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ phase, base, wallMs: Date.now() - t0, pageErrorsAndFailures: failures, edge393: edgeOf(59) }));
if (failures) process.exitCode = 1;
