// Claude (studio overhaul, shell-1, 2026-11-10): the top-edge header check the early iPhone fix
// ships on. For each sport and phone it walks the screens whose headers sit under the status bar
// (Home, Settings, Ultimate Team's six tabs, a card detail at its top/middle/end, a toast, a pack
// opening with SKIP, the Draft after a spin, and a match frame) and records edge-lib's audit of each.
//
//   node scripts/qa/edge-headers.mjs [--sports nba,nfl,soccer] [--devices 393,402,…|all]
//     [--phase before] [--band 393|all|none] [--shots 393|all|none] [--jobs 3] [--profile standard]
//
// --band: phones whose screens are also saved under the simulated iOS 26 band (NN-screen-band.png).
// --shots: phones whose every screen is saved; the others save only screens with a finding.
// Output: <PS_QA_SHOTS>/<phase>/<sport>-<device>/NN-screen.png and report.json there, a summary in
// <phase>/edge-headers-<sports>.json and a contact sheet per sport. Isolated: ?ns=inspect, local relay,
// every other host aborted. Works on the dev server and on a production build (PS_QA_BUILD_ROOT); a
// build has no soccer bench, so soccer's match frame is taken on the dev server only.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, base, buildRoot, dismissPack, fixture, launch } from './browser.mjs';
import { arcadeInsets, auditScreen, closeDialogs, contactSheet, detailBarAudit, DEVICE_IDS, DEVICES, expectedLayout, homeAudit, settle, simulateBand, clearBand } from './edge-lib.mjs';
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
const fullShots = list('shots', ['393'], DEVICE_IDS);
const phase = opt('phase', 'before');
const jobs = Math.max(1, +opt('jobs', 3));
const profile = opt('profile', 'standard');
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), phase);
for (const d of devices) if (!DEVICES[d]) throw Error('Unknown device ' + d + '; known: ' + DEVICE_IDS.join(', '));

/** The parts of an audit the report keeps (lists stay short; counts are exact). */
const brief = (a) => ({
  topMost: a.topMost,
  capTopMost: a.capTopMost,
  textInBand: a.textInBand,
  controlInBand: a.controlInBand,
  bottomCut: a.bottomCut,
  bars: a.bars,
  small: a.small,
  overlap: a.overlap,
  tiny: a.tiny.length,
  lowContrast: a.lowContrast.length,
  offscreen: a.offscreen,
  docScroll: a.docScroll,
  hOverflow: a.hOverflow,
});

async function runDevice(browser, sport, dev) {
  const d = DEVICES[dev],
    t0 = Date.now();
  const dir = path.join(OUT, sport + '-' + dev);
  fs.mkdirSync(dir, { recursive: true });
  const f = await fixture(browser, sport, 'Edge QA', d.w, { isMobile: true, hasTouch: true }, { insets: d.insets, height: d.h, standalone: true, dsf: 1, profile, serialized: true });
  const { page } = f;
  const screens = [];
  let n = 0;
  const cap = async (name, measure, settleMs = 380) => {
    await settle(page, settleMs);
    const audit = await auditScreen(page, dev);
    const extra = measure ? await measure() : {};
    const file = String(++n).padStart(2, '0') + '-' + name;
    const finding = audit.textInBand.length > 0 || audit.controlInBand.length > 0 || audit.bottomCut.length > 0 || !!extra?.finding;
    const shots = [];
    if (fullShots.includes(dev) || finding) {
      await page.screenshot({ path: path.join(dir, file + '.png') });
      shots.push(file + '.png');
    }
    if (bandOn.includes(dev)) {
      await simulateBand(page, d.insets[0]);
      await page.screenshot({ path: path.join(dir, file + '-band.png') });
      await clearBand(page);
      shots.push(file + '-band.png');
    }
    screens.push({ screen: file, ...extra, audit: brief(audit), shots });
  };
  const step = async (name, act, measure, settleMs) => {
    const s0 = Date.now();
    try {
      await act();
      await cap(name, measure, settleMs);
      screens[screens.length - 1].ms = Date.now() - s0;
    } catch (e) {
      screens.push({ screen: String(++n).padStart(2, '0') + '-' + name, fail: e.message.split('\n')[0], ms: Date.now() - s0 });
      await closeDialogs(page);
    }
  };
  const utTab = (label) => page.locator('.ut-tabs button').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).click();
  try {
    await waitForHome(page);
    await step('home', async () => {}, async () => ({ home: await homeAudit(page) }));
    await step(
      'settings',
      async () => {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('dialog').waitFor();
      },
      null,
      600
    );
    await closeDialogs(page);
    // ---------- Ultimate Team ----------
    await openUt(page);
    await settle(page, 600);
    await closeDialogs(page);
    await step('ut-home', async () => {});
    for (const tab of ['PLAY', 'SQUAD', 'CLUB', 'CHALLENGES', 'STORE']) await step('ut-' + tab.toLowerCase(), () => utTab(tab));
    const detailMeasure = async () => {
      const bar = await detailBarAudit(page);
      return { detailBar: bar, finding: !!bar && bar.textBelowBar.length > 0 };
    };
    const scrollSheet = (where) =>
      page.evaluate((where) => {
        const s = [...document.querySelectorAll('.sheet')].pop();
        if (!s) throw Error('no sheet');
        s.scrollTop = where === 'end' ? s.scrollHeight : (s.scrollHeight - s.clientHeight) / 2;
      }, where);
    await step(
      'detail-top',
      async () => {
        await utTab('CLUB');
        await page.locator('.ut-gridcard').first().click();
        await page.getByRole('dialog').waitFor();
      },
      detailMeasure,
      700
    );
    await step('detail-mid', () => scrollSheet('mid'), detailMeasure);
    await step('detail-end', () => scrollSheet('end'), detailMeasure);
    await closeDialogs(page);
    await step(
      'pack-skip',
      async () => {
        await utTab('STORE');
        const daily = page.locator('.ut-daily-btn');
        if (await daily.isVisible().catch(() => false)) await daily.click();
        else await page.locator('.ut-mine-pack').filter({ hasText: /gold/i }).first().click();
        // the pack cinema waits for a tap on the seal; SKIP shows once the pack is torn
        await page.locator('.ut-cinema-open').click({ timeout: 10000 });
        await page.locator('.ut-skip').waitFor({ timeout: 10000 });
      },
      null,
      120
    );
    await dismissPack(page);
    await closeDialogs(page);
    await utTab('HOME');
    await page.locator('.ut-back').click();
    await page.locator('.home .playbar').waitFor({ timeout: 30000 });
    // ---------- the Draft: a toast before spinning, then the board after a spin ----------
    await page.locator('.mode').filter({ hasText: /CLASSIC/i }).first().click();
    await page.locator('.home .playbar button').click();
    await page.locator('.screen.draft').waitFor({ timeout: 60000 });
    await settle(page, 500);
    await step(
      'toast',
      async () => {
        // before the first spin the respin is aria-disabled, and tapping it explains why (Draft.tsx)
        await page.getByRole('button', { name: 'Respin team' }).click({ force: true });
        await page.locator('.toast').waitFor({ timeout: 5000 });
      },
      null,
      150
    );
    await step('draft-spin', async () => {
      await page.getByRole('button', { name: 'SPIN', exact: true }).click();
      await page.waitForTimeout(3500);
    });
    // ---------- a match frame (the arcade bench; soccer's bench exists on the dev server only) ----------
    const bench = sport === 'soccer' ? (buildRoot ? null : 'soccer-lab') : 'arcade';
    if (!bench) screens.push({ screen: String(++n).padStart(2, '0') + '-ingame', skipped: 'production builds have no soccer bench' });
    else {
      let arcade = null;
      await step(
        'ingame',
        async () => {
          const u = new URL(base);
          u.search = '?' + bench + '&auto&sport=' + sport + '&seed=edge&ns=inspect&relay=ws://localhost:7777';
          await page.goto(u.href, { waitUntil: 'domcontentloaded' });
          await page.locator('.arcade-full canvas').first().waitFor({ timeout: 60000 });
          await page.waitForTimeout(2500);
          // the device's insets before the HUD is measured (see edge-lib arcadeInsets)
          arcade = await arcadeInsets(page, d.insets);
        },
        async () => ({ arcade }),
        300
      );
    }
  } finally {
    await f.context.close();
  }
  const report = { sport, device: dev, phone: d.name, insets: d.insets, expected: expectedLayout(dev), profile, build: buildRoot, ms: Date.now() - t0, errors: f.errors, blocked: [...new Set(f.blocked)], screens };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1));
  return report;
}

const browser = await launch();
const started = Date.now();
const results = [];
try {
  for (const sport of sports) {
    const s0 = Date.now();
    const queue = devices.slice();
    const workers = Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const dev = queue.shift();
        const r = await runDevice(browser, sport, dev);
        results.push(r);
        const bad = r.screens.filter((s) => s.fail);
        console.log(JSON.stringify({ sport, device: dev, ms: r.ms, errors: r.errors.length, blocked: r.blocked, fails: bad.map((s) => s.screen + ': ' + s.fail) }));
      }
    });
    await Promise.all(workers);
    const sheetFiles = DEVICE_IDS.filter((d) => devices.includes(d)).flatMap((dev) => {
      const r = results.find((x) => x.sport === sport && x.device === dev);
      return (r?.screens ?? []).flatMap((s) => (s.shots ?? []).filter((f) => !f.endsWith('-band.png')).map((f) => path.join(OUT, sport + '-' + dev, f)));
    });
    await contactSheet(browser, sheetFiles, path.join(OUT, 'sheet-' + sport + '.png'), { cols: 8, title: `edge-headers ${phase} · ${sport} · ${devices.join(', ')}` });
    const bandFiles = results.filter((r) => r.sport === sport).flatMap((r) => r.screens.flatMap((s) => (s.shots ?? []).filter((f) => f.endsWith('-band.png')).map((f) => path.join(OUT, sport + '-' + r.device, f))));
    await contactSheet(browser, bandFiles, path.join(OUT, 'sheet-' + sport + '-band.png'), { cols: 8, title: `edge-headers ${phase} · ${sport} · simulated iOS 26 band` });
    console.log(JSON.stringify({ sport, devices: devices.length, wallMs: Date.now() - s0 }));
  }
} finally {
  await browser.close();
}
const summary = results.map((r) => ({
  sport: r.sport,
  device: r.device,
  ms: r.ms,
  errors: r.errors,
  blocked: r.blocked,
  homeClass: r.screens.find((s) => s.home)?.home?.homeClass ?? null,
  expectedHomeClass: r.expected.homeClass,
  screens: Object.fromEntries(
    r.screens.map((s) => [
      s.screen,
      s.fail || s.skipped
        ? { fail: s.fail, skipped: s.skipped }
        : { topMost: s.audit.topMost.y, capTopMost: s.audit.capTopMost.y, textInBand: s.audit.textInBand.length, controlInBand: s.audit.controlInBand.length, bottomCut: s.audit.bottomCut.length, ...(s.detailBar ? { barGap: s.detailBar.gap, textBelowBar: s.detailBar.textBelowBar.length } : {}), ...(s.arcade ? { arcade: s.arcade.mode } : {}) },
    ])
  ),
}));
fs.writeFileSync(path.join(OUT, 'edge-headers-' + sports.join('-') + '.json'), JSON.stringify({ phase, base, build: buildRoot, profile, wallMs: Date.now() - started, summary }, null, 1));
const failures = results.reduce((s, r) => s + r.errors.length + r.screens.filter((x) => x.fail).length, 0);
console.log(JSON.stringify({ phase, wallMs: Date.now() - started, pageErrorsAndFailedSteps: failures, nonLocalHostsBlocked: [...new Set(results.flatMap((r) => r.blocked))] }));
if (failures) process.exitCode = 1;
