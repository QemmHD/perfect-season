// nba-4's gold ring in the browser (plan task nba-4 "nba-meter"; Claude 2026-11-16), each a real lab
// game, isolated (nba-lib.mjs), CDP touch on the A button:
//  - the gold band's thickness on screen (design px) for THR 55 open, at 393 and 320: ≥ 8
//  - the ring's state in each spot: open and light gold, heavy amber (PRESSURE), smothered red,
//    a three past his range amber (RANGE), a 33-footer red (TOO FAR); no gold band drawn unless gold
//  - the toast sequence after a scripted release: the coverage word as he rises, then the result word
//  - the PERFECT toast's pop with no-preference, none with reduce
//  - the calibrator the first match offers (once on the phone), and the HEATING UP / ON FIRE ball
// The lab runs at ?slowmo=0.25 so a capture lands mid-hold. Each spot pins the defenders where it puts
// them (the probe sets their position every frame), so the ring shows that spot's contest.
//   node scripts/audit/nba-meter.mjs
import { context, launch, needServer, openLab, rect, report, shot, touch, wait } from './nba-lib.mjs';

const PREFS = 'perfect-season:touch-prefs:v1';

/** Skip the one-line hints (and, unless asked, the calibration offer) in this context. */
async function prefs(ctx, { calibrated = true } = {}) {
  await ctx.addInitScript(
    ({ key, calibrated }) => {
      try {
        if (!sessionStorage.getItem('nba-meter-init')) {
          sessionStorage.setItem('nba-meter-init', '1');
          localStorage.setItem(key, JSON.stringify({ v: 1, ...(calibrated ? { offsetMs: 25 } : {}), hints: { nba: calibrated ? 63 : 31 } }));
        }
      } catch {
        /* private mode */
      }
    },
    { key: PREFS, calibrated }
  );
}

/**
 * Put the handler at `ft` straight out from the rim with these ratings, and his man `gap` ft in front
 * of him (null: every defender far away). The positions are held every frame from now on.
 */
const setSpot = (page, spot) =>
  page.evaluate((s) => {
    const RIM = { cx: 41.75, cz: 0 };
    const p = window.__hg2.possession();
    const b = p.bodies[p.handler];
    Object.assign(b.p, s.rate);
    if (s.energy !== undefined) b.energy = s.energy;
    // a drive: set off toward the rim once (the finish ring), not held in place
    if (s.drive) Object.assign(b, { cx: RIM.cx - s.ft, cz: 0.5, vx: 15, vz: 0 });
    const pin = () => {
      const q = window.__hg2.possession();
      if (q !== p || p.end) return;
      if (!p.meter && !s.drive) Object.assign(b, { cx: RIM.cx - s.ft, cz: 0, vx: 0, vz: 0 });
      // (the drive keeps its pace until SHOOT: no thumb is on the stick in the capture)
      if (s.drive && !p.meter && !p.finish) Object.assign(b, { vx: 15, vz: 0 });
      for (const d of p.bodies) {
        if (d.side !== 'D') continue;
        const near = s.gap !== null && d.mark === b.idx;
        Object.assign(d, near ? { cx: b.cx + s.gap, cz: 0.2, vx: 0, vz: 0 } : { cx: 2, cz: (d.idx - 7) * 9, vx: 0, vz: 0 });
      }
      for (const o of p.bodies) if (o.side === 'O' && o !== b) Object.assign(o, { cx: 6, cz: (o.idx - 2) * 10, vx: 0, vz: 0 });
      requestAnimationFrame(pin);
    };
    pin();
  }, spot);

/** The live ring the engine has for the shooter, and its gold band on screen (design px). */
const ringNow = (page) =>
  page.evaluate(async () => {
    const { arcPx, bandPx } = await import('/src/game/hud/ring-draw.ts');
    const { ARC_R } = await import('/src/game/hoops2/hud-draw.ts');
    const p = window.__hg2.possession();
    const m = p?.meter;
    if (!m) return null;
    const c = window.__hg2.canvas();
    const z = window.__hg2.zoom();
    const W = c.width;
    const H = c.height;
    const R = Math.max(26, Math.round(Math.min(W, H) * ARC_R));
    const spec = { idealMs: m.top * 1000, goldMs: m.green * 1000, state: m.state };
    return { kind: m.kind, late: m.late ?? 0, state: m.state, dial: m.dial ?? null, goldMs: +(m.green * 1000).toFixed(1), idealMs: +(m.top * 1000).toFixed(1), bandCanvasPx: +bandPx(spec, arcPx(R, spec.idealMs)).toFixed(2), bandCssPx: +(bandPx(spec, arcPx(R, spec.idealMs)) * z).toFixed(2), arcR: R };
  });

/** A fresh possession with the ball in the handler's hands, standing. */
async function readyBall(page) {
  await page.waitForFunction(() => {
    const p = window.__hg2?.possession();
    return p && !p.end && p.handler !== null && !p.ball && !p.meter && !p.finish && p.t > 0.4;
  }, null, { timeout: 60000, polling: 100 });
}

/** The toast line's texts and pops as they come, from now on. */
const watchToasts = (page) =>
  page.evaluate(() => {
    window.__toasts = [];
    const seen = new Set();
    const tick = () => {
      for (const el of document.querySelectorAll('.ps-toast')) {
        const key = el.textContent + '|' + el.className;
        if (!seen.has(key)) {
          seen.add(key);
          const st = getComputedStyle(el);
          window.__toasts.push({ text: el.textContent, pop: el.classList.contains('pop'), anim: st.animationName });
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

const SPOTS = [
  { name: 'open-thr55-mid', ft: 15, gap: null, rate: { thr: 55, mid: 55 }, want: 'gold' },
  { name: 'light-three', ft: 24, gap: 4.6, rate: { thr: 75, mid: 75 }, want: 'gold' },
  { name: 'heavy-three', ft: 24, gap: 2.6, rate: { thr: 75, mid: 75 }, want: 'amber' },
  { name: 'smothered-three', ft: 24, gap: 1.2, rate: { thr: 75, mid: 75 }, want: 'red' },
  { name: 'range-three', ft: 26.6, gap: null, rate: { thr: 72, mid: 72 }, want: 'amber' },
  { name: 'too-far', ft: 33, gap: null, rate: { thr: 72, mid: 72 }, want: 'red' },
  // tired legs (55% energy): the gold sits 17.5 ms later and 11% narrower
  { name: 'tired-mid', ft: 15, gap: null, rate: { thr: 75, mid: 75 }, energy: 0.55, want: 'gold' },
  // the finish ring: SHOOT on a drive at the rim (a layup; dunkers dunk)
  { name: 'finish-ring', ft: 13, gap: null, rate: { thr: 75, mid: 75, lay: 85, ddk: 40, sdk: 40 }, drive: true, want: 'gold' }
];

await needServer();
const SUFFIX = process.env.NBA_METER_SPOTS ? '-' + process.env.NBA_METER_SPOTS.replace(/,/g, '+') : process.env.NBA_METER_ONLY ? '-only' : '';
const browser = await launch();
const out = { spots: {}, toasts: {}, calibrator: null, heat: {} };
try {
  for (const size of process.env.NBA_METER_ONLY ? [] : ['393', '320']) {
    // (NBA_METER_SPOTS=a,b runs only those spots; NBA_METER_ONLY=1 only the calibrator and Heat)
    for (const spot of SPOTS.filter((x) => !process.env.NBA_METER_SPOTS || process.env.NBA_METER_SPOTS.split(',').includes(x.name))) {
      if (size === '320' && !['open-thr55-mid', 'light-three', 'heavy-three', 'smothered-three', 'range-three'].includes(spot.name)) continue;
      const { ctx, page, cdp, errors } = await context(browser, size);
      await prefs(ctx);
      await openLab(page, { seed: 'meter-' + spot.name, slowmo: '0.25' });
      await readyBall(page);
      await setSpot(page, spot);
      await wait(spot.drive ? 1300 : 700);
      await watchToasts(page);
      const a = await rect(page, '.ps-ctl-a');
      await touch(cdp, 'touchStart', [{ x: a.cx, y: a.cy, id: 1 }]);
      // into the rise: about 60% of the way to the ideal (slow motion ×0.25)
      await wait(spot.drive ? 500 : 1100);
      const ring = await ringNow(page);
      const file = await shot(page, `nba4-${size}-${spot.name}`);
      // let go on the ideal for the open shot (its PERFECT), late for the rest (their words)
      const m = await page.evaluate(() => {
        const p = window.__hg2.possession();
        return p?.meter ? { t0: p.meter.t0, top: p.meter.top, t: p.t } : null;
      });
      if (m) await wait(Math.max(0, ((m.t0 + m.top - m.t) / 0.25) * 1000 - (spot.want === 'gold' && spot.gap === null ? 70 : -260)));
      await touch(cdp, 'touchEnd', []);
      await wait(500);
      const after = await shot(page, `nba4-${size}-${spot.name}-result`);
      await wait(1800);
      const last = await page.evaluate(() => {
        const p = window.__hg2.possession();
        const ls = p?.lastShot;
        return { toasts: window.__toasts, shot: ls ? { state: ls.state, dial: ls.dial, greened: ls.greened, offMs: ls.offMs && +ls.offMs.toFixed(1), goldMs: ls.goldMs && +ls.goldMs.toFixed(1), make: ls.make } : null };
      });
      out.spots[size + ' ' + spot.name] = { want: spot.want, ring, ok: ring?.state === spot.want, ...last, files: [file, after], errors };
      await ctx.close();
    }
  }

  // the PERFECT toast pop: present with no-preference, absent with reduce
  for (const motion of process.env.NBA_METER_ONLY ? [] : ['no-preference', 'reduce']) {
    const { ctx, page, cdp } = await context(browser, '393', { motion });
    await prefs(ctx);
    await openLab(page, { seed: 'meter-pop', slowmo: '0.25' });
    await readyBall(page);
    await setSpot(page, SPOTS[0]);
    await wait(700);
    await watchToasts(page);
    const a = await rect(page, '.ps-ctl-a');
    await touch(cdp, 'touchStart', [{ x: a.cx, y: a.cy, id: 1 }]);
    await wait(400);
    const m = await page.evaluate(() => {
      const p = window.__hg2.possession();
      return p?.meter ? { t0: p.meter.t0, top: p.meter.top, t: p.t } : null;
    });
    if (m) await wait(Math.max(0, ((m.t0 + m.top - m.t) / 0.25) * 1000 - 70));
    await touch(cdp, 'touchEnd', []);
    await wait(260);
    await shot(page, `nba4-393-perfect-toast-${motion}`);
    await wait(900);
    out.toasts[motion] = await page.evaluate(() => ({ toasts: window.__toasts, greened: window.__hg2.possession()?.lastShot?.greened ?? null, feel: window.__hg2.feel() }));
    await ctx.close();
  }

  // the calibrator the first match offers, at both sizes
  for (const size of ['393', '320']) {
    const { ctx, page, cdp } = await context(browser, size);
    await prefs(ctx, { calibrated: false });
    await page.goto((await import('./nba-lib.mjs')).url({ arcade: '', seed: 'meter-cal' }), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hg2-cal', { timeout: 45000 });
    await wait(400);
    await shot(page, `nba4-${size}-calibrator`);
    await page.locator('.hg2-cal .ps-hud-sheet-btn.primary').click();
    // tap on the four beats (650 ms apart after two count-in beats and a 500 ms lead)
    const pad = await rect(page, '.hg2-cal-pad');
    // the first beat to tap is the moment the pad first reads TAP
    await page.waitForFunction(() => document.querySelector('.hg2-cal-beat')?.textContent === 'TAP', null, { timeout: 5000, polling: 'raf' });
    // (each tap scheduled from the first, so the CDP round trips don't add up)
    const T = Date.now() + 20;
    for (let i = 0; i < 4; i++) {
      await wait(Math.max(0, T + i * 650 - Date.now()));
      await touch(cdp, 'touchStart', [{ x: pad.cx, y: pad.cy, id: 1 }]);
      await touch(cdp, 'touchEnd', []);
    }
    await wait(600);
    await shot(page, `nba4-${size}-calibrator-result`);
    const res = await page.evaluate(() => document.querySelector('.hg2-cal-result')?.textContent ?? null);
    await page.locator('.hg2-cal .ps-hud-sheet-btn.primary').click().catch(() => null);
    await wait(300);
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').offsetMs ?? null, PREFS);
    if (size === '393') out.calibrator = { result: res, savedOffsetMs: saved };
    else out.calibrator320 = { result: res, savedOffsetMs: saved };
    await ctx.close();
  }

  // Heat on the ball: HEATING UP (66) and ON FIRE (100), set through the game's own bar
  for (const [stage, v] of [
    ['heating', 70],
    ['fire', 100]
  ]) {
    const { ctx, page } = await context(browser, '393');
    await prefs(ctx);
    await openLab(page, { seed: 'meter-heat-' + stage, auto: '' });
    // the next possession starts with that stage (the bar set on the game, the stage on the possession)
    const d0 = await page.evaluate(() => window.__hg2.game().done);
    await page.waitForFunction((d) => window.__hg2.game().done > d && window.__hg2.possession() && !window.__hg2.possession().end, d0, { timeout: 60000, polling: 50 });
    await page.evaluate(
      ({ v, stage }) => {
        const g = window.__hg2.game();
        g.heat.us = v >= 100 ? { v: 100, fire: 2, peak: 100, fires: 1 } : { v, fire: 0, peak: v, fires: 0 };
        window.__hg2.possession().heat = stage;
      },
      { v, stage }
    );
    await page.waitForFunction(() => window.__hg2.possession()?.t > 0.8, null, { timeout: 60000, polling: 100 });
    await page.waitForFunction(() => {
      const p = window.__hg2.possession();
      return p?.ball?.kind === 'pass' || p?.ball?.kind === 'shot';
    }, null, { timeout: 30000, polling: 'raf' }).catch(() => null);
    const file = await shot(page, `nba4-393-heat-${stage}`);
    out.heat[stage] = { possessionHeat: await page.evaluate(() => window.__hg2.possession()?.heat), bar: await page.evaluate(() => document.querySelector('.ps-heat')?.className ?? null), file };
    await ctx.close();
  }
} finally {
  await browser.close();
}
report('nba4-meter' + SUFFIX, out);
