// nba-2's acceptance probe (Claude 2026-11-16): the shared controls in the real game, through CDP
// touch, isolated from every live service (nba-lib). Prints a value for each nba-2 acceptance row
// and writes JSON plus the captures:
//  1. geometry: every §3.8 rect at 393×852 (insets 59/34) and 320×568 (20/0) against targets.ts GEO;
//     gaps, target sizes, overlaps, right-thumb targets; the other six sizes: overlaps and insets
//  2. the handler never under a control: at tip-off and over 30 sampled frames of a game
//  3. a thumb held before the whistle moves the handler at once (NBA-12)
//  4. the stick: response frames, one tick haptic per sprint edge, two pointers, no accidental passes
//  5. gestures on SHOOT (tap = pump fake, hold = shot, swipes = moves), tap a teammate, PASS held,
//     CALL → ISO puts the ball in the star's hands
//  6. pause: 0 steps and 0 timers in 10 s, the same marks after a resume; Quit in a Squad Battles
//     game settles as a loss
//   node scripts/audit/nba-controls.mjs [--quick]
import path from 'node:path';
import fs from 'node:fs';
import { context, launch, needServer, openLab, PORTRAIT, report, SIZES, touch, utFixture, wait } from './nba-lib.mjs';

const { GEO, GEO_TOL } = await import('../../src/game/hoops2/targets.ts');
const OUT = process.env.NBA_SHOTS || '/tmp/ps-nba-shots';
const QUICK = process.argv.includes('--quick');
// --only=geo,play,shots,pause,quit runs just those sections
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const shotTo = async (page, name) => {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, timeout: 15000 });
  return file;
};
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : x);

/** every tap target in the game, plus the stick's zone (a target region of its own) */
const targets = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll('.arcade-full button, .arcade-full .ps-stick')].filter((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return r.width > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && cs.pointerEvents !== 'none' && !e.closest('.ps-radial:not(.open)') && !e.closest('.ps-hud-sheet-back');
    });
    return els.map((e) => {
      const r = e.getBoundingClientRect();
      const round = e.classList.contains('ps-ctl-btn') || e.classList.contains('ps-ctl-arcbtn');
      return { cls: e.className, label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18), x: r.x, y: r.y, w: r.width, h: r.height, round };
    });
  });

const overlapsOf = (els) => {
  const out = [];
  for (let i = 0; i < els.length; i++)
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i];
      const b = els[j];
      const hit = a.round && b.round ? Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) < (a.w + b.w) / 2 - 0.5 : a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
      if (hit) out.push(a.label + ' x ' + b.label);
    }
  return out;
};

/** a rect by selector, with its centre */
const box = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2, bottom: r.bottom };
  }, sel);

/** D is hidden in NBA: its token rect, measured with a probe element on the same tokens */
const dSlot = (page) =>
  page.evaluate(() => {
    const host = document.querySelector('.ps-ctl');
    if (!host) return null;
    const e = document.createElement('i');
    e.className = 'ps-ctl-btn ps-ctl-d';
    e.style.visibility = 'hidden';
    host.appendChild(e);
    const r = e.getBoundingClientRect();
    e.remove();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });

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
const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const state = (page) =>
  page.evaluate(() => {
    const q = window.__hg2;
    const p = q?.possession();
    if (!p) return null;
    const h = p.handler !== null ? p.bodies[p.handler] : null;
    return {
      t: p.t,
      handler: p.handler,
      hx: h?.cx,
      hz: h?.cz,
      act: h?.act,
      meter: p.meter ? { gather: !!p.meter.gather, off: p.meter.off ?? null } : null,
      ball: p.ball ? { kind: p.ball.kind, high: !!p.ball.high, who: p.ball.who } : null,
      passes: p.passes,
      end: p.end?.kind ?? null,
      call: p.playCall ? { kind: p.playCall.kind, actor: p.playCall.actor } : null,
      events: p.events.slice(),
      steps: q.steps(),
      feel: q.feel(),
      done: q.game()?.done ?? 0,
      marks: q.game()?.marks.join('') ?? ''
    };
  });

/** a fresh possession with the ball in hand and nothing happening yet */
async function freshPossession(page) {
  for (let i = 0; i < 200; i++) {
    const s = await state(page);
    if (s && s.handler !== null && !s.ball && !s.meter && !s.end && s.t > 0.2 && s.t < 6) return s;
    await wait(50);
  }
  return null;
}

await needServer();
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const out = { sizes: {}, checks: {} };
const errorsAll = [];
try {
  // ---------- 1 + 2. geometry at every size, the handler under the controls ----------
  for (const size of !want('geo') ? [] : QUICK ? ['393', '320'] : Object.keys(SIZES)) {
    const { ctx, page, cdp, errors } = await context(browser, size);
    const { w: W, h: H, insets } = SIZES[size];
    const [sat, sar, sab, sal] = insets;
    await openLab(page, { seed: 'ctl' + size });
    await wait(500);
    await shotTo(page, `ctl-${size}-tipoff`);
    const res = {};
    const els = await targets(page);
    res.overlaps = overlapsOf(els);
    res.minTarget = r1(Math.min(...els.filter((e) => !e.cls.includes('ps-stick')).map((e) => Math.min(e.w, e.h))));
    res.underInsets = els.filter((e) => e.y < sat - 0.5 || e.y + e.h > H - sab + 0.5 || e.x < sal - 0.5 || e.x + e.w > W - sar + 0.5).map((e) => e.label || e.cls);
    if (PORTRAIT.includes(size)) {
      const right = els.filter((e) => e.cls.includes('ps-ctl-btn'));
      res.rightTargets = right.length;
      res.highestRightTop = r1(Math.min(...right.map((e) => e.y)));
      res.highestRightShare = Math.round((Math.min(...right.map((e) => e.y)) / H) * 1000) / 1000;
    }
    // the handler under a control: tip-off, then 30 frames of a drive (the stick held right and up)
    const ctl = els.filter((e) => !e.cls.includes('ps-stick'));
    const under = [];
    const hb0 = await handlerBox(page);
    if (hb0 && ctl.some((c) => hits(hb0, c))) under.push('tipoff');
    if (size === '393' || size === '320') {
      const g = GEO[size];
      const m = {};
      for (const [k, sel] of [
        ['A', '.ps-ctl-a'],
        ['B', '.ps-ctl-b'],
        ['C', '.ps-ctl-c'],
        ['stick', '.ps-stick-ghost']
      ]) {
        const b = await box(page, sel);
        m[k] = b && { d: r1(b.w), cx: r1(b.cx), cy: r1(b.cy) };
      }
      const d = await dSlot(page);
      m.D = d && { d: r1(d.w), cx: r1(d.cx), cy: r1(d.cy) };
      const z = await box(page, '.ps-stick');
      m.zone = z && { x0: r1(z.x), x1: r1(z.x + z.w), y0: r1(z.y), y1: r1(z.y + z.h) };
      const bug = await box(page, '.hg2-bug');
      m.bug = bug && { x: r1(bug.x), y: r1(bug.y), w: r1(bug.w), h: r1(bug.h) };
      const pz = await box(page, '.ps-hud-pause');
      m.pause = pz && { x: r1(pz.x), y: r1(pz.y), w: r1(pz.w), h: r1(pz.h) };
      const ts = await box(page, '.ps-toast-slot');
      m.toast = ts && { bottom: r1(ts.bottom), h: r1(ts.h) };
      const gap = (a, b) => r1(Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.d / 2 - b.d / 2);
      m.gaps = { AB: gap(m.A, m.B), AC: gap(m.A, m.C), AD: gap(m.A, m.D) };
      // compare with the table, ±2 px
      const misses = [];
      const cmp = (path, got, want) => Math.abs(got - want) > GEO_TOL && misses.push(`${path}: ${got} (want ${want})`);
      for (const k of ['A', 'B', 'C', 'D', 'stick']) for (const f of ['d', 'cx', 'cy']) cmp(`${k}.${f}`, m[k][f], g[k][f]);
      for (const f of ['x0', 'x1', 'y0', 'y1']) cmp(`zone.${f}`, m.zone[f], g.zone[f]);
      for (const k of ['bug', 'pause']) for (const f of ['x', 'y', 'w', 'h']) cmp(`${k}.${f}`, m[k][f], g[k][f]);
      cmp('toast.bottom', m.toast.bottom, g.toast.bottom);
      cmp('toast.h', m.toast.h, g.toast.h);
      res.rects = m;
      res.rectMisses = misses;
      res.gapsInBand = Object.values(m.gaps).every((v) => v >= 10 - 0.5 && v <= 18 + 0.5);
      // 30 frames of a drive, sampled every 100 ms, stick pushed up-right from the ghost
      const st = m.stick;
      await touch(cdp, 'touchStart', [{ x: st.cx, y: st.cy, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: st.cx + 40, y: st.cy - 45, id: 1 }]);
      for (let i = 0; i < 30; i++) {
        await wait(100);
        const hb = await handlerBox(page);
        if (hb && ctl.some((c) => hits(hb, c))) under.push('frame' + i);
        if (i === 12) await shotTo(page, `ctl-${size}-drive`);
      }
      await touch(cdp, 'touchEnd', []);
    }
    res.handlerUnderControl = under;
    res.errors = errors.slice();
    errorsAll.push(...errors);
    out.sizes[size] = res;
    await ctx.close();
  }

  // ---------- 3-5. the stick and the cluster in play, at 393 ----------
  if (want('play')) {
    const { ctx, page, cdp, errors } = await context(browser, '393');
    // 3. a thumb held before the whistle (the first possession tips at 0.7 s)
    await page.goto((await import('./nba-lib.mjs')).url({ arcade: '', seed: 'ctl-preheld' }), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ps-stick', { timeout: 45000 });
    const ghost = await box(page, '.ps-stick-ghost');
    await touch(cdp, 'touchStart', [{ x: ghost.cx, y: ghost.cy, id: 1 }]);
    await touch(cdp, 'touchMove', [{ x: ghost.cx + 50, y: ghost.cy - 20, id: 1 }]);
    // in the page, frame by frame: where the handler is at the whistle and 300 ms of game time later
    const pre = await page.evaluate(
      () =>
        new Promise((res) => {
          let s0 = null;
          const f = () => {
            const p = window.__hg2?.possession();
            const h = p && p.handler !== null ? p.bodies[p.handler] : null;
            if (h && !s0) s0 = { t: p.t, cx: h.cx, cz: h.cz };
            if (h && s0 && p.t - s0.t >= 0.3) return res({ ft: Math.hypot(h.cx - s0.cx, h.cz - s0.cz), ms: (p.t - s0.t) * 1000, whistleT: s0.t });
            requestAnimationFrame(f);
          };
          requestAnimationFrame(f);
          setTimeout(() => res(null), 20000);
        })
    );
    out.checks.preheldFt = pre && r1(pre.ft);
    out.checks.preheldMs = pre && Math.round(pre.ms);
    out.checks.preheldWhistleT = pre && Math.round(pre.whistleT * 1000) / 1000;
    await touch(cdp, 'touchEnd', []);

    // 4. the stick's response (frames from the touch to the ring drawn) and the sprint edge's tick
    await freshPossession(page);
    // frames counted from the moment the page receives the touch (a capture listener) to the first
    // frame that has it: the ring drawn, and the game's stick input pushed; then the same for a move
    out.checks.stickResponseFrames = await (async () => {
      await page.evaluate(() => {
        window.__resp = null;
        let seen = null;
        let frames = 0;
        let ring = null;
        let game = null;
        document.addEventListener('pointerdown', () => (seen ??= performance.now()), { capture: true, once: true });
        const f = () => {
          if (seen !== null) {
            const r = document.querySelector('.ps-stick-ring');
            if (ring === null && r && r.style.opacity === '1') ring = frames;
            if (game === null && window.__hg2?.stick()?.active) game = frames;
            frames++;
          }
          if (seen === null || ((ring === null || game === null) && frames < 60)) requestAnimationFrame(f);
          else window.__resp = { ring, game };
        };
        requestAnimationFrame(f);
      });
      await touch(cdp, 'touchStart', [{ x: 90, y: 600, id: 1 }]);
      await page.waitForFunction(() => window.__resp !== null, null, { timeout: 5000 }).catch(() => null);
      const down = await page.evaluate(() => window.__resp);
      await page.evaluate(() => {
        window.__resp = null;
        let seen = null;
        let frames = 0;
        document.addEventListener('pointermove', () => (seen ??= performance.now()), { capture: true, once: true });
        const f = () => {
          if (seen !== null) {
            if ((window.__hg2?.stick()?.mag ?? 0) > 0.2) return (window.__resp = frames);
            frames++;
          }
          if (seen === null || frames < 60) requestAnimationFrame(f);
          else window.__resp = Infinity;
        };
        requestAnimationFrame(f);
      });
      await touch(cdp, 'touchMove', [{ x: 125, y: 600, id: 1 }]);
      await page.waitForFunction(() => window.__resp !== null, null, { timeout: 5000 }).catch(() => null);
      return { ringOnDown: down?.ring, gameOnDown: down?.game, gameOnMove: await page.evaluate(() => window.__resp) };
    })();
    const tick0 = (await state(page)).feel.tick;
    for (const dx of [20, 40, 60, 75, 85, 80, 90, 78, 88]) {
      await touch(cdp, 'touchMove', [{ x: 90 + dx, y: 600, id: 1 }]);
      await wait(40);
    }
    out.checks.sprintEdgeTicks = (await state(page)).feel.tick - tick0;
    // two pointers: the stick held (still pushed) and SHOOT pressed with a second finger
    const A = await box(page, '.ps-ctl-a');
    const sp = await state(page);
    await touch(cdp, 'touchMove', [
      { x: 150, y: 600, id: 1 },
      { x: A.cx, y: A.cy, id: 2 }
    ]);
    await touch(cdp, 'touchStart', [
      { x: 150, y: 600, id: 1 },
      { x: A.cx, y: A.cy, id: 2 }
    ]);
    await wait(60);
    const sq = await state(page);
    out.checks.twoPointers = { stickMoved: r1(Math.hypot(sq.hx - sp.hx, sq.hz - sp.hz)), shootHeld: !!sq.meter || !!sq.ball };
    await touch(cdp, 'touchEnd', []);
    await wait(1500);

    // no accidental passes from 24 stick touches (taps and drags all over the zone)
    let accidental = 0;
    for (let i = 0; i < 24; i++) {
      const s = await freshPossession(page);
      if (!s) break;
      const x = 10 + ((i * 37) % 170);
      const y = 400 + ((i * 53) % 400);
      await touch(cdp, 'touchStart', [{ x, y, id: 1 }]);
      if (i % 2) await touch(cdp, 'touchMove', [{ x: x + 20, y: y - 10, id: 1 }]);
      await wait(60);
      await touch(cdp, 'touchEnd', []);
      await wait(40);
      const after = await state(page);
      if (after.passes > s.passes || after.ball?.kind === 'pass') accidental++;
    }
    out.checks.accidentalPasses = accidental;

    // 5. gestures on SHOOT
    const gestureOn = async (kind) => {
      const s = await freshPossession(page);
      if (!s) return 'no possession';
      const a = await box(page, '.ps-ctl-a');
      const id = 5;
      await touch(cdp, 'touchStart', [{ x: a.cx, y: a.cy, id }]);
      if (kind === 'tap') {
        // straight up again: a state read in between would make the touch a hold on a busy machine
        await touch(cdp, 'touchEnd', []);
        await wait(60);
        const e = await state(page);
        const res = { act: e.act, ball: e.ball?.kind ?? null, shot: e.ball?.kind === 'shot' || !!e.meter, pump: e.events.some((x) => x.startsWith('pump')) || e.act === 'pump' };
        await wait(1700);
        return res;
      }
      if (kind === 'hold') await wait(520);
      else {
        const [dx, dy] = { L: [-60, 0], R: [60, 0], U: [0, -60], D: [0, 60] }[kind];
        for (let k = 1; k <= 4; k++) {
          await touch(cdp, 'touchMove', [{ x: a.cx + (dx * k) / 4, y: a.cy + (dy * k) / 4, id }]);
          await wait(16);
        }
      }
      const mid = await state(page);
      await touch(cdp, 'touchEnd', []);
      await wait(80);
      const e = await state(page);
      const res = { act: mid.act, after: e.act, ball: e.ball?.kind ?? null, shot: e.events.some((x) => x === 'release' || x === 'release-green') || e.ball?.kind === 'shot' || !!e.meter?.off };
      await wait(1700);
      return res;
    };
    out.checks.gestures = {};
    for (const k of ['tap', 'hold', 'L', 'R', 'U', 'D']) out.checks.gestures[k] = await gestureOn(k);
    await shotTo(page, 'ctl-393-after-gestures');

    // tap a teammate (one outside the stick's zone and the cluster)
    out.checks.tapTeammate = await (async () => {
      for (let tries = 0; tries < 6; tries++) {
        const s = await freshPossession(page);
        if (!s) return 'no possession';
        const pt = await page.evaluate(() => {
          const q = window.__hg2;
          const p = q.possession();
          const c = q.canvas().getBoundingClientRect();
          const z = q.zoom();
          const zone = document.querySelector('.ps-stick').getBoundingClientRect();
          const blocks = [...document.querySelectorAll('.ps-ctl-btn, .ps-hud-pause, .play-readout')].map((e) => e.getBoundingClientRect());
          for (const b of p.bodies) {
            if (b.side !== 'O' || b.idx === p.handler) continue;
            const f = q.screenOf(b.cx, b.cz, 0);
            const hd = q.screenOf(b.cx, b.cz, b.p.ht / 12);
            if (!f || !hd) continue;
            const x = c.left + f.x * z;
            const y = c.top + ((f.y + hd.y) / 2) * z;
            const inZone = x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
            const blocked = blocks.some((r) => x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4);
            if (!inZone && !blocked && y > 60 && x > 10 && x < innerWidth - 10) return { x, y, idx: b.idx };
          }
          return null;
        });
        if (!pt) {
          await wait(2500);
          continue;
        }
        await touch(cdp, 'touchStart', [{ x: pt.x, y: pt.y, id: 7 }]);
        await wait(40);
        await touch(cdp, 'touchEnd', []);
        await wait(30);
        const e = await state(page);
        return { to: pt.idx, ball: e.ball, passes: e.passes - s.passes, handler: e.handler };
      }
      return 'no teammate clear of the controls';
    })();
    await wait(2500);

    // PASS held: a lob
    out.checks.passHeld = await (async () => {
      const s = await freshPossession(page);
      if (!s) return 'no possession';
      const b = await box(page, '.ps-ctl-b');
      await touch(cdp, 'touchStart', [{ x: b.cx, y: b.cy, id: 8 }]);
      await wait(260);
      const e = await state(page);
      await touch(cdp, 'touchEnd', []);
      return { ball: e.ball, passes: e.passes - s.passes };
    })();
    await wait(2500);
    // PASS tapped: a pass after the 120 ms wind-up
    out.checks.passTap = await (async () => {
      const s = await freshPossession(page);
      if (!s) return 'no possession';
      const b = await box(page, '.ps-ctl-b');
      await touch(cdp, 'touchStart', [{ x: b.cx, y: b.cy, id: 8 }]);
      await wait(40);
      await touch(cdp, 'touchEnd', []);
      await wait(200);
      const e = await state(page);
      return { ball: e.ball, passes: e.passes - s.passes };
    })();
    await wait(2500);

    // CALL → the radial → ISO: the star has the ball within 2 s
    out.checks.iso = await (async () => {
      for (let tries = 0; tries < 4; tries++) {
        const s = await freshPossession(page);
        if (!s) return 'no possession';
        const c = await box(page, '.ps-ctl-c');
        await touch(cdp, 'touchStart', [{ x: c.cx, y: c.cy, id: 9 }]);
        await wait(40);
        await touch(cdp, 'touchEnd', []);
        await wait(180);
        if (tries === 0) await shotTo(page, 'ctl-393-call-radial');
        const iso = await box(page, '.ps-radial-item[data-radial-id="iso"]');
        await touch(cdp, 'touchStart', [{ x: iso.cx, y: iso.cy, id: 10 }]);
        await touch(cdp, 'touchEnd', []);
        const t0 = Date.now();
        let e = await state(page);
        if (!e.call || e.call.kind !== 'iso') {
          await wait(4800); // the call was recharging: wait it out and go again
          continue;
        }
        const star = e.call.actor;
        while (Date.now() - t0 < 2500 && e.handler !== star && !e.end) {
          await wait(30);
          e = await state(page);
        }
        await shotTo(page, 'ctl-393-iso');
        return { star, startedWith: s.handler, handler: e.handler, seconds: Math.round(((Date.now() - t0) / 1000) * 100) / 100, gameSeconds: Math.round((e.t - s.t) * 100) / 100 };
      }
      return 'call never ready';
    })();
    out.checks.errors393 = errors.slice();
    errorsAll.push(...errors);
    await ctx.close();
  }

  // ---------- captures: a hint, Buttons-only, the pause sheet, reduced motion ----------
  for (const size of want('shots') ? ['393', '320'] : []) {
    const { ctx, page, cdp, errors } = await context(browser, size);
    await openLab(page, { seed: 'ctl-shots' + size });
    await wait(450);
    await shotTo(page, `ctl-${size}-hint`);
    const pz = await box(page, '.ps-hud-pause');
    await touch(cdp, 'touchStart', [{ x: pz.cx, y: pz.cy, id: 1 }]);
    await touch(cdp, 'touchEnd', []);
    await wait(300);
    await shotTo(page, `ctl-${size}-pause-sheet`);
    await page.getByRole('radio', { name: 'BUTTONS' }).click();
    await page.getByRole('button', { name: 'RESUME' }).click();
    await wait(1200);
    const els = await targets(page);
    out.sizes[size] ??= {};
    out.sizes[size].buttonsOnly = { overlaps: overlapsOf(els), minTarget: r1(Math.min(...els.filter((e) => !e.cls.includes('ps-stick')).map((e) => Math.min(e.w, e.h)))) };
    await shotTo(page, `ctl-${size}-buttons-only`);
    errorsAll.push(...errors);
    await ctx.close();
  }
  if (want('shots')) {
    const { ctx, page, errors } = await context(browser, '393', { motion: 'reduce' });
    await openLab(page, { seed: 'ctl-reduce' });
    await wait(500);
    await shotTo(page, 'ctl-393-reduced-motion');
    errorsAll.push(...errors);
    await ctx.close();
  }

  // ---------- 6. pause: frozen for 10 s, then the same game ----------
  if (want('pause')) {
    const marksOf = async (pauseIt) => {
      const { ctx, page, cdp, errors } = await context(browser, '393');
      await openLab(page, { seed: 'ctl-pause', auto: '', slowmo: '4' });
      const res = {};
      if (pauseIt) {
        await wait(4000);
        const pz = await box(page, '.ps-hud-pause');
        await touch(cdp, 'touchStart', [{ x: pz.cx, y: pz.cy, id: 1 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(200);
        const a = await page.evaluate(() => ({ steps: window.__hg2.steps(), timers: window.__hg2.timers(), t: window.__hg2.possession()?.t, paused: window.__hg2.paused() }));
        await wait(10000);
        const b = await page.evaluate(() => ({ steps: window.__hg2.steps(), timers: window.__hg2.timers(), t: window.__hg2.possession()?.t, paused: window.__hg2.paused() }));
        res.during = { paused: a.paused && b.paused, steps: b.steps - a.steps, timerCallbacks: b.timers.fired - a.timers.fired, pendingKept: b.timers.pending, clockMoved: b.t - a.t };
        // hidden page while running: auto-pause (autoplay skips it; checked in the UT game below)
        await page.getByRole('button', { name: 'RESUME' }).click();
      }
      await page.waitForFunction(() => window.__hg2?.game()?.over, null, { timeout: 240000 });
      res.marks = await page.evaluate(() => window.__hg2.game().marks.join(' '));
      res.score = await page.evaluate(() => window.__hg2.game().score);
      res.errors = errors.slice();
      errorsAll.push(...errors);
      await ctx.close();
      return res;
    };
    const plain = await marksOf(false);
    const paused = await marksOf(true);
    out.checks.pause = { ...paused.during, marksPlain: plain.marks, marksPaused: paused.marks, identical: plain.marks === paused.marks && plain.score === paused.score };
  }

  // ---------- Quit in a Squad Battles game: a loss; a hidden page pauses it ----------
  if (want('quit')) {
    const { ctx, page, errors } = await context(browser, '393');
    await utFixture(page);
    await page.getByRole('button', { name: /Ultimate Team:/ }).click();
    await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
    await page.locator('.ut-row, .hq-mode').filter({ hasText: 'SQUAD BATTLES' }).first().click();
    await page.locator('.utb-rung.next').click();
    for (let i = 0; i < 400; i++) {
      if (await page.locator('.ps-ctl-a').count()) break;
      const vote = page.locator('.vote-opt.play:not([aria-disabled="true"])');
      if (await vote.count()) await vote.first().click({ timeout: 2000 }).catch(() => {});
      else if (await page.locator('button.big').filter({ hasText: /^PLAY$/ }).count()) await page.locator('button.big').filter({ hasText: /^PLAY$/ }).click();
      else await wait(50);
    }
    await page.waitForFunction(() => (window.__hg2?.possession()?.t ?? 0) > 0.5, null, { timeout: 30000 });
    // the app goes to the background: the game pauses itself
    const before = await page.evaluate(() => window.__hg2.steps());
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(3000);
    const after = await page.evaluate(() => ({ steps: window.__hg2.steps(), paused: window.__hg2.paused() }));
    out.checks.autoPauseOnHide = { paused: after.paused, stepsWhileHidden: after.steps - before };
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
    await shotTo(page, 'ctl-393-ut-paused');
    await page.getByRole('button', { name: 'QUIT GAME' }).click();
    await shotTo(page, 'ctl-393-quit-confirm');
    await page.getByRole('button', { name: /QUIT · TAKE THE LOSS/ }).click();
    await wait(2500);
    await shotTo(page, 'ctl-393-quit-result');
    out.checks.quit = await page.evaluate(() => {
      const t = document.body.innerText;
      return { lossShown: /\b(LOSS|LOST|DEFEAT)\b/i.test(t), winShown: /\b(VICTORY|YOU WON|WIN!)\b/i.test(t), sample: t.replace(/\s+/g, ' ').slice(0, 220) };
    });
    errorsAll.push(...errors);
    await ctx.close();
  }
} catch (e) {
  out.crashed = String(e?.message ?? e).slice(0, 400);
} finally {
  await browser.close();
  out.pageErrors = errorsAll;
  report('nba-controls' + (ONLY.length ? '-' + ONLY.join('-') : ''), out);
}
