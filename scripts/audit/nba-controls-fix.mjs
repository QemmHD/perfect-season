// The nba-2 review fixes, checked in the real game through CDP touch, isolated from every live service
// (nba-lib). Claude 2026-11-16.
//  pump    taps of 90-115 ms on SHOOT, some with the lift heard 35-50 ms late (a busy main thread): a
//          pump fake every time, never a shot
//  call    a near-instant tap on CALL opens the radial and picks nothing
//  radial  the open CALL radial in Gestures and in Buttons-only mode: no target overlaps (the move
//          arc steps aside while the radial is open)
//  hints   the SPIN / CROSS / STEP labels: rendered px size and inside the screen at 393 and 320
//  toast   the toast line against the ball handler's box over the first possession (the hints show)
//  practice  Training Camp and Moments: the overlay's buttons against the pause button, LAST PLAY and
//          its opened card
//   node scripts/audit/nba-controls-fix.mjs [--only=pump,call,radial,hints,toast,practice]
import path from 'node:path';
import fs from 'node:fs';
import { context, launch, needServer, openLab, report, touch, url, utFixture, wait } from './nba-lib.mjs';

const OUT = process.env.NBA_SHOTS || '/tmp/ps-nba-shots';
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const shotTo = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 15000 });
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : x);

const box = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }, sel);

/** every visible tap target in the game (the open radial's items included), and the overlapping pairs */
const overlaps = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll('.arcade-full button')].filter((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return r.width > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && cs.pointerEvents !== 'none' && !e.closest('.ps-radial:not(.open)') && !e.closest('.ps-hud-sheet-back');
    });
    const list = els.map((e) => {
      const r = e.getBoundingClientRect();
      const round = e.classList.contains('ps-ctl-btn') || e.classList.contains('ps-ctl-arcbtn');
      return { label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 14), x: r.x, y: r.y, w: r.width, h: r.height, round };
    });
    const out = [];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const hit = a.round && b.round ? Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) < (a.w + b.w) / 2 - 0.5 : a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
        if (hit) out.push(a.label + ' x ' + b.label);
      }
    return { targets: list.map((t) => t.label), overlaps: out };
  });

const state = (page) =>
  page.evaluate(() => {
    const q = window.__hg2;
    const p = q?.possession();
    if (!p) return null;
    const h = p.handler !== null ? p.bodies[p.handler] : null;
    return { t: p.t, handler: p.handler, act: h?.act, meter: p.meter ? { gather: !!p.meter.gather, off: p.meter.off ?? null } : null, ball: p.ball?.kind ?? null, end: p.end?.kind ?? null, call: p.playCall?.kind ?? null, events: p.events.slice(), lastShot: !!p.lastShot };
  });

async function freshPossession(page) {
  for (let i = 0; i < 300; i++) {
    const s = await state(page);
    if (s && s.handler !== null && !s.ball && !s.meter && !s.end && s.t > 0.3 && s.t < 6) return s;
    await wait(50);
  }
  return null;
}

/** the handler's sprite box on screen (feet to head), from the dev probe */
const handlerBox = (page) =>
  page.evaluate(() => {
    const q = window.__hg2;
    const p = q?.possession();
    const c = q?.canvas()?.getBoundingClientRect();
    if (!q || !p || !c || p.handler === null) return null;
    const b = p.bodies[p.handler];
    const z = q.zoom();
    const f = q.screenOf(b.cx, b.cz, 0);
    const hd = q.screenOf(b.cx, b.cz, b.p.ht / 12 + b.h);
    if (!f || !hd) return null;
    const half = 1.2 * f.s * z;
    return { x: c.left + f.x * z - half, y: c.top + hd.y * z, w: half * 2, h: (f.y - hd.y) * z };
  });
const hits = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

await needServer();
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const out = {};
const errorsAll = [];
try {
  // ---------- pump: taps on SHOOT, some heard late ----------
  if (want('pump')) {
    const { ctx, page, cdp, errors } = await context(browser, '393');
    // first-game hints off, so nothing else is on the line
    await page.addInitScript(() => localStorage.setItem('perfect-season:touch-prefs:v1', JSON.stringify({ v: 1, controls: 'gestures', hints: { nba: 1023 } })));
    await openLab(page, { seed: 'fix-pump' });
    await page.evaluate(() => {
      window.__taps = [];
      const a = () => document.querySelector('.ps-ctl-a');
      addEventListener('pointerdown', (e) => a()?.contains(e.target) && (window.__down = { ts: e.timeStamp, at: performance.now() }), true);
      addEventListener('pointerup', (e) => a()?.contains(e.target) && window.__taps.push({ held: e.timeStamp - window.__down.ts, lagDown: window.__down.at - window.__down.ts, lagUp: performance.now() - e.timeStamp }), true);
    });
    const rows = [];
    // the CDP round trip adds ~30 ms to a touch, so the sleeps are shorter than the taps they make;
    // only rows whose measured hold (event timestamps) is under 120 ms count as taps
    for (const tap of [90, 100, 110, 115]) {
      for (const lag of [0, 45]) {
        for (let k = 0; k < 3; k++) {
          const s = await freshPossession(page);
          if (!s) break;
          const a = await box(page, '.ps-ctl-a');
          const started = touch(cdp, 'touchStart', [{ x: a.cx, y: a.cy, id: 3 }]);
          const t0 = Date.now();
          await wait(Math.max(0, tap - 8));
          // a busy main thread: the lift is heard `lag` ms after it happened, while rAF frames queue
          const busy = lag ? page.evaluate((ms) => { const s = performance.now(); while (performance.now() - s < ms); }, lag) : null;
          while (Date.now() - t0 < tap) await new Promise((r) => setImmediate(r));
          await started;
          await touch(cdp, 'touchEnd', []);
          await busy;
          await wait(90);
          const e = await state(page);
          const t = await page.evaluate(() => window.__taps[window.__taps.length - 1]);
          rows.push({ sleep: tap, lag, held: r1(t?.held), lagUp: r1(t?.lagUp), pump: e.act === 'pump' || e.events.some((x) => x.startsWith('pump')), shot: e.ball === 'shot' || e.lastShot || (e.meter && e.meter.off !== null) });
          await wait(1800);
        }
      }
    }
    const taps = rows.filter((r) => r.held < 120);
    out.pump = { taps: taps.length, pumps: taps.filter((r) => r.pump && !r.shot).length, shots: taps.filter((r) => r.shot).length, rows };
    errorsAll.push(...errors);
    await ctx.close();
  }

  // ---------- call / radial: a quick tap on CALL; the open radial in both modes ----------
  for (const size of want('call') || want('radial') ? ['393', '320'] : []) {
    const { ctx, page, cdp, errors } = await context(browser, size);
    await page.addInitScript(() => localStorage.setItem('perfect-season:touch-prefs:v1', JSON.stringify({ v: 1, controls: 'gestures', hints: { nba: 1023 } })));
    await openLab(page, { seed: 'fix-call' + size });
    const res = (out['radial' + size] = {});
    const openRadial = async () => {
      for (let i = 0; i < 4; i++) {
        const s = await freshPossession(page);
        if (!s) return { error: 'no possession' };
        const c = await box(page, '.ps-ctl-c');
        await touch(cdp, 'touchStart', [{ x: c.cx, y: c.cy, id: 4 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(260);
        const e = await state(page);
        const open = await page.evaluate(() => !!document.querySelector('.ps-radial.open'));
        if (open || e.call) return { open, picked: e.call };
        await wait(1500);
      }
      return { open: false };
    };
    res.quickTap = await openRadial();
    res.gestures = await overlaps(page);
    await shotTo(page, `fix-${size}-radial-gestures`);
    // close it (tap outside) and switch to Buttons-only
    await page.evaluate(() => document.querySelector('.ps-radial-item') && document.dispatchEvent(new Event('pointerdown')));
    const pz = await box(page, '.ps-hud-pause');
    await touch(cdp, 'touchStart', [{ x: pz.cx, y: pz.cy, id: 1 }]);
    await touch(cdp, 'touchEnd', []);
    await wait(300);
    await page.getByRole('radio', { name: 'BUTTONS' }).click();
    await page.getByRole('button', { name: 'RESUME' }).click();
    await wait(800);
    res.buttonsClosed = await overlaps(page);
    res.quickTapButtons = await openRadial();
    res.buttonsOpen = await overlaps(page);
    res.arcShownWhileOpen = await page.evaluate(() => !!document.querySelector('.ps-ctl-arc'));
    await shotTo(page, `fix-${size}-radial-buttons`);
    await wait(3600); // the radial closes by itself
    res.arcBack = await page.evaluate(() => !!document.querySelector('.ps-ctl-arc'));
    errorsAll.push(...errors);
    await ctx.close();
  }

  // ---------- hints: size and inside the screen ----------
  for (const size of want('hints') ? ['393', '320', '375'] : []) {
    const { ctx, page, errors } = await context(browser, size);
    await openLab(page, { seed: 'fix-hints' + size });
    await wait(400);
    out['hints' + size] = await page.evaluate(() => {
      const sab = parseFloat(getComputedStyle(document.querySelector('.arcade-full')).getPropertyValue('--sab')) || 0;
      const texts = [...document.querySelectorAll('.ps-ctl-hints text')].map((t) => {
        const r = t.getBoundingClientRect();
        const px = t.getScreenCTM().a * parseFloat(getComputedStyle(t).fontSize);
        return { label: t.textContent, px: Math.round(px * 100) / 100, bottom: Math.round(r.bottom * 10) / 10, right: Math.round(r.right * 10) / 10, left: Math.round(r.left * 10) / 10 };
      });
      const arrows = [...document.querySelectorAll('.ps-ctl-hints path')].map((p) => {
        const r = p.getBoundingClientRect();
        return { bottom: Math.round(r.bottom * 10) / 10, right: Math.round(r.right * 10) / 10 };
      });
      const H = innerHeight;
      const W = innerWidth;
      return { texts, minPx: Math.min(...texts.map((t) => t.px)), allInside: [...texts, ...arrows].every((b) => b.bottom <= H - sab + 0.5 && b.right <= W + 0.5 && (b.left ?? 0) >= 0), H, sab };
    });
    await shotTo(page, `fix-${size}-hints`);
    errorsAll.push(...errors);
    await ctx.close();
  }

  // ---------- toast vs the handler over the first possession (the first-game hints show) ----------
  for (const size of want('toast') ? ['393', '320'] : []) {
    const { ctx, page, errors } = await context(browser, size);
    await openLab(page, { seed: 'fix-toast' + size });
    let frames = 0;
    let under = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const [tb, hb] = await Promise.all([box(page, '.ps-toast'), handlerBox(page)]);
      if (tb && hb) {
        frames++;
        if (hits(tb, hb)) under++;
      }
      await wait(100);
    }
    out['toast' + size] = { framesWithToast: frames, handlerUnderToast: under };
    await shotTo(page, `fix-${size}-toast`);
    errorsAll.push(...errors);
    await ctx.close();
  }

  // ---------- practice: Training Camp and Moments overlays against the game's own top controls ----------
  if (want('practice')) {
    const measure = async (page, overlaySel) =>
      page.evaluate((overlaySel) => {
        const R = (e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const named = [];
        for (const e of document.querySelectorAll(overlaySel + ' > button')) named.push({ label: 'overlay:' + (e.getAttribute('aria-label') || e.textContent).trim(), ...R(e) });
        for (const [sel, label] of [
          ['.ps-hud-pause', 'pause'],
          ['.play-readout-toggle', 'LAST PLAY'],
          ['.play-readout-heading button', 'LAST PLAY close'],
          ['.play-readout-card', 'LAST PLAY card']
        ]) {
          const e = document.querySelector(sel);
          if (e && e.getBoundingClientRect().width) named.push({ label, ...R(e) });
        }
        // Chromium has no safe-area env(): the harness emulates the insets with --sat, but the practice
        // overlays sit at env(safe-area-inset-top) + 87 / 104 px. Put them where a real phone does.
        const sat = parseFloat(getComputedStyle(document.querySelector('.arcade-full')).getPropertyValue('--sat')) || 0;
        const envTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--probe-env')) || 0;
        for (const n of named) if (n.label.startsWith('overlay')) n.y += sat - envTop;
        const out = [];
        for (let i = 0; i < named.length; i++)
          for (let j = i + 1; j < named.length; j++) {
            const a = named[i];
            const b = named[j];
            if (a.label.startsWith('overlay') === b.label.startsWith('overlay')) continue;
            if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(a.label + ' x ' + b.label);
          }
        return { rects: named.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h) })), overlaps: out };
      }, overlaySel);
    /** play one attempt (hold SHOOT, let go) so LAST PLAY has something, then open its card */
    const attemptAndOpen = async (page, cdp) => {
      await page.waitForFunction(() => /\d/.test(document.querySelector('.ps-bug-clock')?.textContent || ''), null, { timeout: 45000 });
      for (let i = 0; i < 2 && !(await page.locator('.play-readout-toggle').count()); i++) {
        const s = await freshPossession(page);
        if (!s) break;
        const a = await box(page, '.ps-ctl-a');
        await touch(cdp, 'touchStart', [{ x: a.cx, y: a.cy, id: 6 }]);
        await wait(520);
        await touch(cdp, 'touchEnd', []);
        await wait(3500);
      }
      const closed = await page.locator('.play-readout-toggle').count();
      return closed;
    };
    for (const size of ['393', '320']) {
      // Training Camp
      {
        const { ctx, page, cdp, errors } = await context(browser, size);
        await utFixture(page);
        await page.locator('.training-entry').click();
        await page.locator('.camp-drill').first().click();
        await page.getByRole('button', { name: /LET.S WORK/ }).click();
        const had = await attemptAndOpen(page, cdp);
        const closed = await measure(page, '.camp-overlay');
        if (had) {
          const t = await box(page, '.play-readout-toggle');
          await touch(cdp, 'touchStart', [{ x: t.cx, y: t.cy, id: 8 }]);
          await touch(cdp, 'touchEnd', []);
          await wait(300);
        }
        const open = await measure(page, '.camp-overlay');
        await shotTo(page, `fix-${size}-camp`);
        out['camp' + size] = { lastPlayShown: !!had, closed, open };
        errorsAll.push(...errors);
        await ctx.close();
      }
      // Moments
      {
        const { ctx, page, cdp, errors } = await context(browser, size);
        await utFixture(page);
        await page.getByRole('button', { name: /Ultimate Team:/ }).click();
        await wait(600);
        await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
        await page.locator('.ut-row, .hq-mode').filter({ hasText: /MOMENTS/i }).first().click();
        await wait(800);
        await page.getByText('FIRST LIGHT').first().click();
        await wait(500);
        await page.getByRole('button', { name: /PLAY MOMENT|PLAY AGAIN/ }).first().click({ timeout: 8000 });
        const had = await attemptAndOpen(page, cdp);
        const closed = await measure(page, '.hq-moment-overlay');
        if (had) {
          const t = await box(page, '.play-readout-toggle');
          await touch(cdp, 'touchStart', [{ x: t.cx, y: t.cy, id: 8 }]);
          await touch(cdp, 'touchEnd', []);
          await wait(300);
        }
        const open = await measure(page, '.hq-moment-overlay');
        await shotTo(page, `fix-${size}-moment`);
        out['moment' + size] = { lastPlayShown: !!had, closed, open };
        errorsAll.push(...errors);
        await ctx.close();
      }
    }
  }
} catch (e) {
  out.crashed = String(e?.stack ?? e).slice(0, 600);
} finally {
  await browser.close();
  out.pageErrors = errorsAll;
  report('nba-controls-fix' + (ONLY.length ? '-' + ONLY.join('-') : ''), out);
}
void url;
