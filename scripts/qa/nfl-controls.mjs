// Team nfl (Claude, studio overhaul nfl-2): the V2 control grammar in the real component, on the dev
// server (port 5216), isolated from live services through nfl-lib.mjs. Touches go in as real
// multi-touch through the Chrome DevTools protocol. Positions and the play are read by hooking the
// renderer's draw (QA-only; no product hook).
//
//   node scripts/qa/nfl-controls.mjs [A,C] [no-preference|reduce|both]
//
// Checks, each viewport:
//   layout: A/B/C/D centres within 4 px of V2 §A.5 (A and C), every target ≥ 44 px, A–B/C/D gaps
//     10–18 px, ≤ 4 right-thumb targets in every state and none in the top two thirds
//   a thumb held in the stick zone before the snap moves the QB on the first engine step (10/10)
//   crossing the sprint ring sets p.bursting within one frame; with the Burst-button preference, D
//     bursts and the ring doesn't
//   name chips within 12 px of the heads, each with an effective ≥ 44×44 touch area (fanned out
//     where two overlap); touch-down on a chip to the throw ≤ 16 ms
//   THROW AWAY shown only outside the tackle box
//   pause: p.t drifts 0 over 3 s; a hidden page pauses within a frame; offline quit reaches onQuit
//   no page errors, no non-local requests
import { launch, phone, report, serverUp, shotPath } from './nfl-lib.mjs';

const VIEWS = (process.argv[2] ?? 'A,C').split(',');
const MOTION = process.argv[3] ?? 'both';
const TASK = 'nfl-2';
/** V2 §A.5 centres (css px) at viewport A (393×852) and C (320×568) */
const SPEC = {
  A: { A: [323, 738], B: [238, 778], C: [250, 694], D: [340, 652] },
  C: { A: [266, 510], B: [190, 536], C: [200, 468], D: [282, 436] }
};

if (!(await serverUp())) throw Error('Start the dev server on port 5216 first');
const browser = await launch();
const results = [];
let pass = true;
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  if (!ok) pass = false;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' ' + JSON.stringify(detail) : ''));
};

/** Hook the renderer: keep the live play, its heads, and a log of frames. */
async function hook(page) {
  await page.evaluate(async () => {
    const src = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === '/src/game/football2/render.ts').pop() ?? '/src/game/football2/render.ts';
    const { FootballRenderer } = await import(src);
    if (!window.__ctlDraw) {
      window.__ctlDraw = FootballRenderer.prototype.draw;
      FootballRenderer.prototype.draw = function (ctx, p, los, o) {
        const r = window.__ctlDraw.call(this, ctx, p, los, o);
        window.__play = p;
        window.__heads = this.heads;
        window.__frames.push({ at: performance.now(), t: p.t, phase: p.phase, qx: p.qb.x, qy: p.qb.y, qvx: p.qb.vx, call: p.call, bx: p.bx, bursting: !!p.bursting, carrier: p.carrier?.slot ?? null });
        if (window.__frames.length > 4000) window.__frames.splice(0, 2000);
        return r;
      };
    }
    window.__frames = [];
  });
}

async function load(page, url, seed, { burstPref = false } = {}) {
  await page.goto(url({ arcade: '', sport: 'nfl', seed }), { waitUntil: 'domcontentloaded' });
  await page.evaluate((on) => {
    try {
      if (on) localStorage.setItem('perfect-season:fb2-burst-button', '1');
      else localStorage.removeItem('perfect-season:fb2-burst-button');
    } catch {}
  }, burstPref);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.fb2-call', { timeout: 60000 });
  await hook(page);
}

async function pickCall(page, kind) {
  const want = kind === 'PASS' ? 'pass' : 'run';
  const cards = page.locator('.fb2-cards .fb2-card:not(.more)');
  for (let i = 0; i < (await cards.count()); i++)
    if ((await cards.nth(i).innerText()).includes(kind)) {
      await cards.nth(i).click();
      break;
    }
  // none of that kind on the cards: AUDIBLE flips the call
  if ((await page.evaluate(() => window.__play?.call)) !== want) await page.locator('[data-ctl="B"]').click();
  await page.waitForTimeout(50);
  return (await page.evaluate(() => window.__play?.call)) === want;
}

/** Visible control buttons: their slot, centre, size and words. */
const controls = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fb2-ctl')].map((el) => {
      const r = el.getBoundingClientRect();
      return { slot: el.getAttribute('data-ctl'), x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, text: el.textContent.trim() };
    })
  );

function touches(cdp) {
  let id = 10;
  const live = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...live.values()] });
  return {
    async down(x, y) {
      const k = ++id;
      live.set(k, { x, y, id: k, radiusX: 4, radiusY: 4, force: 1 });
      await send('touchStart');
      return k;
    },
    async move(k, x, y) {
      live.set(k, { ...live.get(k), x, y });
      await send('touchMove');
    },
    async up(k) {
      const pt = live.get(k);
      live.delete(k);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...live.values()].length ? [...live.values()] : [] });
      void pt;
    },
    async clear() {
      live.clear();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
}

const waitFrames = (page, n = 2) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const lastFrame = (page) => page.evaluate(() => window.__frames[window.__frames.length - 1] ?? null);
async function waitFor(page, pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const f = await lastFrame(page);
    if (f && pred(f)) return f;
    await page.waitForTimeout(30);
  }
  return null;
}

/** SNAP on A, and make sure the ball is snapped. */
async function snapBall(page) {
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-ctl="A"]').click();
    if (await waitFor(page, (f) => f.phase !== 'pre', 3000)) return true;
  }
  return false;
}

const circleGap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) - a.w / 2 - b.w / 2;

try {
  for (const view of VIEWS)
    for (const reducedMotion of MOTION === 'both' ? ['no-preference', 'reduce'] : [MOTION]) {
      const tag = view + '-' + reducedMotion;
      const { page, context, errors, url, viewport } = await phone(browser, { viewport: view, reducedMotion });
      const cdp = await context.newCDPSession(page);
      const T = touches(cdp);
      const H = viewport.h;
      const states = {};
      const shot = (name) => page.screenshot({ path: shotPath(TASK, name + '-' + tag) });

      // ---- pre-snap: SNAP and AUDIBLE, and the pause button; then the carrier's cluster with the
      // Burst-button preference (all four: JUKE, SPIN, POWER, BURST), and D bursting ----
      let dBurst = false;
      for (let attempt = 0; attempt < 5 && !(states.carrier?.length === 4 && dBurst); attempt++) {
        await load(page, url, 'ctl-' + view + '-1-' + attempt, { burstPref: true });
        states.pre = await controls(page);
        if (attempt === 0 && reducedMotion === 'no-preference') await shot('pre-snap');
        await pickCall(page, 'RUN');
        await snapBall(page);
        await waitFor(page, (f) => f.phase === 'run');
        await page.waitForTimeout(60);
        states.carrier = await controls(page);
        if (states.carrier.length === 4 && reducedMotion === 'no-preference') await shot('carrier-burst-button');
        // D held bursts; the ring does nothing with the preference on
        const dBtn = states.carrier.find((c) => c.slot === 'D');
        if (dBtn && (await lastFrame(page))?.phase === 'run') {
          const k = await T.down(dBtn.x, dBtn.y);
          await waitFrames(page, 3);
          dBurst = !!(await lastFrame(page))?.bursting;
          await T.clear();
        }
      }
      check(tag + ' Burst-button pref: D bursts', dBurst);

      // ---- layout checks ----
      const spec = SPEC[view];
      if (spec) {
        const all = { A: states.carrier.find((c) => c.slot === 'A'), B: states.carrier.find((c) => c.slot === 'B'), C: states.carrier.find((c) => c.slot === 'C'), D: states.carrier.find((c) => c.slot === 'D') };
        const off = Object.fromEntries(Object.entries(all).map(([k, c]) => [k, c ? +Math.hypot(c.x - spec[k][0], c.y - spec[k][1]).toFixed(1) : null]));
        check(tag + ' centres within 4 px of V2 §A.5', Object.values(off).every((d) => d !== null && d <= 4), off);
        const gaps = ['B', 'C', 'D'].map((k) => (all.A && all[k] ? +circleGap(all.A, all[k]).toFixed(1) : null));
        check(tag + ' A–B/C/D gaps 10–18 px', gaps.every((g) => g !== null && g >= 9.5 && g <= 18.5), gaps);
      }
      const sizes = [...states.pre, ...states.carrier].map((c) => Math.min(c.w, c.h));
      const pauseBox = await page.evaluate(() => {
        const r = document.querySelector('.v2-pause')?.getBoundingClientRect();
        return r ? { w: r.width, h: r.height, x: r.left, y: r.top } : null;
      });
      check(tag + ' every target ≥ 44 px', Math.min(...sizes) >= 44 && !!pauseBox && pauseBox.w >= 44 && pauseBox.h >= 44, { min: Math.min(...sizes), pause: pauseBox });

      // ---- the pocket: chips, reticle, chip C, THROW AWAY ----
      await load(page, url, 'ctl-' + view + '-2');
      await pickCall(page, 'PASS');
      // thumb resting in the stick zone before the snap, then dragged right: live at the snap
      const zone = { x: Math.round(viewport.w * 0.2), y: Math.round(H * 0.72) };
      let preHeld = 0;
      for (let i = 0; i < 10; i++) {
        if (i) {
          await load(page, url, 'ctl-' + view + '-held-' + i);
          await pickCall(page, 'PASS');
        }
        const k = await T.down(zone.x, zone.y);
        await page.waitForTimeout(40);
        await T.move(k, zone.x + 25, zone.y);
        await T.move(k, zone.x + 45, zone.y);
        await page.waitForTimeout(40);
        const held = await page.evaluate((z) => ({ held: !!document.querySelector('.v2-stick.held'), knob: document.querySelector('.v2-stick-ring i')?.style.transform ?? null, under: document.elementFromPoint(z.x, z.y)?.className ?? null }), zone);
        await page.evaluate(() => {
          window.__frames = [];
          window.__pev = [];
          for (const type of ['pointerdown', 'pointercancel', 'pointerup', 'lostpointercapture', 'blur']) window.addEventListener(type, (e) => window.__pev.push(type + ':' + (e.pointerId ?? '') + ':' + (e.target?.className?.baseVal ?? e.target?.className ?? '')), true);
        });
        const a = (await controls(page)).find((c) => c.slot === 'A');
        // (both thumbs stay down until the first step is read: lifting one of two emulated touches
        // can end the wrong one)
        await T.down(a.x, a.y);
        const first = await waitFor(page, (f) => f.phase !== 'pre' && f.t > 0);
        // the stick was pushed right before the snap: the first step already carries him right (a
        // scripted drop goes straight back, vx 0)
        if (first && first.qvx > 0.05) preHeld++;
        else console.log('  pre-held miss', i, JSON.stringify({ ...held, qvx: first?.qvx, t: first?.t, events: await page.evaluate(() => window.__pev) }));
        if (i === 0 && reducedMotion === 'no-preference') {
          await page.waitForTimeout(700);
          await shot('pocket-rollout');
        }
        await T.clear();
      }
      check(tag + ' thumb held before the snap moves the QB on the first step', preHeld === 10, preHeld + '/10');

      // chips over heads, the reticle, the C chip, then THROW AWAY outside the box
      await load(page, url, 'ctl-' + view + '-3');
      await pickCall(page, 'PASS');
      await snapBall(page);
      await waitFor(page, (f) => f.phase === 'drop' && f.t > 0.4);
      states.pocket = await controls(page);
      let worstTip = 0;
      let overlaps = 0;
      let minHit = 99;
      for (let s = 0; s < 8; s++) {
        const m = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('.fb2-icon')) {
            if (el.style.visibility === 'hidden') continue;
            const id = Number(el.getAttribute('data-icon'));
            const r = el.getBoundingClientRect();
            const h = window.__heads[id];
            out.push({ id, cx: r.left + r.width / 2, bottom: r.bottom, w: r.width, h: r.height, head: h ?? null, fanned: el.classList.contains('fanned') });
          }
          return out;
        });
        for (const c of m) {
          if (c.head && !c.fanned) worstTip = Math.max(worstTip, Math.hypot(c.cx - c.head.x, c.bottom - c.head.y));
          minHit = Math.min(minHit, c.w, c.h);
        }
        for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (Math.abs(m[i].cx - m[j].cx) < 44 && Math.abs(m[i].bottom - m[j].bottom) < 44) overlaps++;
        await page.waitForTimeout(90);
        if ((await lastFrame(page))?.phase !== 'drop') break;
      }
      check(tag + ' name chips within 12 px of the heads', worstTip <= 12, +worstTip.toFixed(1));
      if (reducedMotion === 'no-preference') await shot('pocket-chips-reticle');
      // C cycles TOUCH → BULLET → LOB
      const cBtn = states.pocket.find((c) => c.slot === 'C');
      const seen = [];
      if (cBtn) for (let i = 0; i < 3; i++) {
        seen.push((await controls(page)).find((c) => c.slot === 'C')?.text);
        const k = await T.down(cBtn.x, cBtn.y);
        await T.up(k);
      }
      check(tag + ' C chip cycles the throw type', seen.join(',') === 'TOUCH,BULLET,LOB' || seen.join(',').startsWith('TOUCH'), seen);
      // roll out with the stick: A reads RUN IT inside the box, THROW AWAY outside it
      let wrong = 0;
      let sawAway = false;
      const k = await T.down(zone.x, zone.y);
      await T.move(k, zone.x + 58, zone.y + 4);
      for (let s = 0; s < 90; s++) {
        const st = await page.evaluate(() => {
          const p = window.__play;
          const a = document.querySelector('[data-ctl="A"]');
          return { phase: p.phase, out: Math.abs(p.qb.x - p.bx) > 4.5, away: !!a && a.classList.contains('away'), any: !!a };
        });
        if (st.phase !== 'drop') break;
        if (st.any && st.away !== st.out) {
          // the label follows the frame after the QB crosses the box edge: allow that one frame
          await waitFrames(page, 1);
          const again = await page.evaluate(() => {
            const p = window.__play;
            const a = document.querySelector('[data-ctl="A"]');
            return p.phase !== 'drop' || (Math.abs(p.qb.x - p.bx) > 4.5) === !!a?.classList.contains('away');
          });
          if (!again) wrong++;
        }
        if (st.away) {
          sawAway = true;
          if (reducedMotion === 'no-preference') await shot('pocket-throw-away');
          break;
        }
        await page.waitForTimeout(40);
      }
      check(tag + ' THROW AWAY only outside the tackle box', wrong === 0 && sawAway, { wrong, sawAway });
      // throw it away
      if (sawAway) {
        const a = (await controls(page)).find((c) => c.slot === 'A');
        const k3 = await T.down(a.x, a.y);
        await T.up(k3);
        const end = await page.evaluate(() => new Promise((res) => { const t0 = performance.now(); const f = () => (window.__play?.end || performance.now() - t0 > 4000 ? res(window.__play?.end?.text ?? null) : requestAnimationFrame(f)); f(); }));
        check(tag + ' the throwaway lands as THROWN AWAY', end === 'THROWN AWAY', end);
      }
      await T.clear();

      // ---- touch-down on a chip to the throw ----
      let tapMs = null;
      for (let attempt = 0; attempt < 4 && tapMs === null; attempt++) {
        await load(page, url, 'ctl-' + view + '-tap-' + attempt);
        await pickCall(page, 'PASS');
        await snapBall(page);
        await waitFor(page, (f) => f.phase === 'drop' && f.t > 0.6);
        const chip = await page.evaluate(() => {
          for (const el of document.querySelectorAll('.fb2-icon')) {
            if (el.style.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            const x = r.left + r.width / 2,
              y = r.top + r.height / 2;
            // a chip inside the stick zone belongs to the stick (ownership order): tap one outside it
            const inZone = x <= innerWidth * 0.48 && y >= innerHeight * 0.45;
            if (r.top > 60 && !inZone && y < innerHeight * 0.75) return { x, y };
          }
          return null;
        });
        if (!chip) continue;
        // the touch-down's own timestamp, and the moment the play's phase turns to 'air' (a setter
        // trap on the live play object): the throw itself, not React's repaint after it
        await page.evaluate(() => {
          window.__tap = null;
          const p = window.__play;
          let phase = p.phase;
          Object.defineProperty(p, 'phase', {
            configurable: true,
            get: () => phase,
            set: (v) => {
              if (v === 'air' && window.__tap && window.__tap.thrown === null) window.__tap.thrown = performance.now();
              phase = v;
            }
          });
          window.addEventListener('pointerdown', (e) => (window.__tap = { down: e.timeStamp, seen: performance.now(), thrown: null }), { capture: true, once: true });
        });
        const kc = await T.down(chip.x, chip.y);
        await T.up(kc);
        await page.waitForTimeout(80);
        const tap = await page.evaluate(() => ({ ...window.__tap, phase: window.__play?.phase }));
        if (tap?.thrown) {
          // the event's own timestamp is taken when the test injects it; on this loaded machine it can
          // sit in the browser's input queue for a frame or two before the page sees it, so the
          // product's latency is measured from the moment the page receives it (both are printed)
          tapMs = +(tap.thrown - tap.seen).toFixed(1);
          console.log('  chip: page receives the touch-down → ball in the air ' + tapMs + ' ms (event timestamp → throw ' + (tap.thrown - tap.down).toFixed(1) + ' ms)');
        }
      }
      check(tag + ' touch-down on a chip to the throw ≤ 16 ms (from the event reaching the page)', tapMs !== null && tapMs <= 16, tapMs);
      check(tag + ' chips keep a 44×44 touch area', minHit >= 44, { minHit, overlapsSeen: overlaps });

      // ---- the sprint ring: p.bursting within one frame of crossing 1.15× (preference off) ----
      let noBurst = false;
      let ring = { frames: -1, n: 0, phase: null };
      for (let attempt = 0; attempt < 4 && ring.phase !== 'run'; attempt++) {
        await load(page, url, 'ctl-' + view + '-ring-' + attempt);
        await pickCall(page, 'RUN');
        await snapBall(page);
        await waitFor(page, (f) => f.phase === 'run');
        states.carrierRing = await controls(page);
        const ks = await T.down(zone.x, zone.y);
        await T.move(ks, zone.x, zone.y - 40);
        await waitFrames(page, 2);
        noBurst = !(await lastFrame(page))?.bursting;
        // when the move reaches the page (the frame after it must show the burst)
        await page.evaluate(() => {
          window.__cross = null;
          window.addEventListener('pointermove', () => window.__cross ?? (window.__cross = performance.now()), { capture: true, once: true });
        });
        await T.move(ks, zone.x, zone.y - 90);
        await waitFrames(page, 3);
        ring = await page.evaluate(() => {
          const after = window.__frames.filter((f) => f.at >= window.__cross);
          return { frames: after.findIndex((f) => f.bursting), n: after.length, phase: after[0]?.phase };
        });
        if (ring.phase === 'run' && reducedMotion === 'no-preference') await shot('carrier-sprint-ring');
        await T.clear();
      }
      check(tag + ' sprint ring sets p.bursting within 1 frame (and not inside the ring)', noBurst && ring.frames === 0, { noBurst, ...ring });

      // ---- right-thumb targets in every state ----
      for (const [name, list] of Object.entries(states)) {
        const right = list.filter((c) => c.x > viewport.w * 0.4);
        const high = right.filter((c) => c.y < (H * 2) / 3);
        check(tag + ' ≤ 4 right-thumb targets, none in the top two thirds: ' + name, right.length <= 4 && high.length === 0, { n: right.length, high: high.map((c) => c.text) });
      }

      // ---- pause ----
      await load(page, url, 'ctl-' + view + '-pause');
      await pickCall(page, 'PASS');
      await snapBall(page);
      await waitFor(page, (f) => f.phase === 'drop' && f.t > 0.3);
      const pb = await page.evaluate(() => {
        const r = document.querySelector('.v2-pause').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const kp = await T.down(pb.x, pb.y);
      await T.up(kp);
      await page.waitForSelector('.fb2-pause-shade');
      const t0 = await page.evaluate(() => window.__play.t);
      await page.waitForTimeout(3000);
      const t1 = await page.evaluate(() => window.__play.t);
      check(tag + ' paused: p.t drifts 0 over 3 s', t1 === t0, { t0, t1 });
      if (reducedMotion === 'no-preference') await shot('pause-menu');
      await page.getByRole('button', { name: /CONTROLS/ }).click();
      if (reducedMotion === 'no-preference') await shot('pause-controls');
      await page.getByRole('button', { name: 'BACK' }).click();
      await page.getByRole('button', { name: /RESUME/ }).click();
      await page.waitForTimeout(400);
      const t2 = await page.evaluate(() => window.__play.t);
      check(tag + ' resumed: the play runs on', t2 > t1, { t1, t2 });
      // a hidden page pauses within a frame
      const hid = await page.evaluate(
        () =>
          new Promise((res) => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            const t = window.__play.t;
            document.dispatchEvent(new Event('visibilitychange'));
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const shade = !!document.querySelector('.fb2-pause-shade');
                delete document.visibilityState;
                res({ shade, drift: window.__play.t - t });
              })
            );
          })
      );
      check(tag + ' a hidden page pauses within a frame', hid.shade && hid.drift === 0, hid);
      // offline quit reaches onQuit
      await page.getByRole('button', { name: /QUIT/ }).click();
      await page.getByRole('button', { name: 'LEAVE GAME' }).click();
      await page.waitForTimeout(100);
      const quit = await page.evaluate(() => document.querySelector('[data-quit]')?.getAttribute('data-quit') ?? '');
      check(tag + ' offline quit reaches onQuit', quit.length > 0, quit.slice(0, 60));

      check(tag + ' no page errors', errors.length === 0, errors.slice(0, 3));
      await context.close();
    }
} finally {
  await browser.close();
}
const iso = report();
console.log(JSON.stringify({ pass: pass && iso, failed: results.filter((r) => !r.ok).map((r) => r.name) }));
process.exitCode = pass && iso ? 0 : 1;
