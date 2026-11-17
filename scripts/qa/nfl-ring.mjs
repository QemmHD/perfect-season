// Team nfl (Claude, studio overhaul nfl-4): the gold rings, PERFECT, Heat and the grade in the real
// component, on the dev server (port 5216), isolated from live services through nfl-lib.mjs. Touches
// go in as real touches through the Chrome DevTools protocol, timed against the engine's own ring
// windows (read through the renderer's draw, QA-only; no product hook).
//
//   node scripts/qa/nfl-ring.mjs [A,C] [no-preference|reduce|both]   (default A,C both)
//
// Checks, each viewport and motion setting:
//   the sling's ring is drawn on the reticle while dragging, gold for an open man in stride, amber
//     off his path, red past the arm (RANGE)
//   a scripted release on the centre of a gold ring is PERFECT: the toast says PERFECT and the chime
//     is called exactly once; Heat 90 + 12 lights ON FIRE (the toast, the bug's flame)
//   with every frame delayed 30 ms, three releases near the centre are judged as their touch
//     timestamps say (not the frame they land in)
//   a tackler's wind-up wears the ring; a JUKE pressed on its centre is PERFECT and he goes down
//   reduced motion keeps the rings and their colours, and drops the PERFECT word's scale
//   the final card carries the grade, which arrives on onDone only (never on an earlier progress)
//   no page errors, no non-local requests
import { launch, phone, report, serverUp, shotPath } from './nfl-lib.mjs';

const VIEWS = (process.argv[2] ?? 'A,C').split(',');
const MOTION = process.argv[3] ?? 'both';
const TASK = process.env.NFL_TASK || 'nfl-4';

if (!(await serverUp())) throw Error('Start the dev server on port 5216 first');
const browser = await launch();
let pass = true;
const check = (name, ok, detail) => {
  if (!ok) pass = false;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' ' + JSON.stringify(detail) : ''));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** Hook the renderer (the live play, the sling ring it drew) and the app's own engine module; stub the chime to count it. */
async function hook(page) {
  await page.evaluate(async () => {
    const res = (path) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).pathname === path).pop() ?? path;
    const { FootballRenderer } = await import(res('/src/game/football2/render.ts'));
    window.__eng = await import(res('/src/game/football2/engine.ts'));
    const sound = await import(res('/src/lib/sound.ts'));
    window.__chimes = [];
    // the release's own timestamp (the same clock as performance.now())
    window.addEventListener('pointerup', (e) => (window.__upTs = e.timeStamp), true);
    // the chime's shared cue: perfectChime calls it once per PERFECT (a stub, so the run is silent)
    sound.sfx.perfect = (streak) => window.__chimes.push({ streak, at: performance.now() });
    if (!window.__ringDraw) {
      window.__ringDraw = FootballRenderer.prototype.draw;
      FootballRenderer.prototype.draw = function (ctx, p, los, o) {
        const r = window.__ringDraw.call(this, ctx, p, los, o);
        window.__play = p;
        window.__sling = o.sling ?? null;
        // (the last ring the reticle showed before the ball left: the halo or the rush can turn it
        // gold or amber in the last frames before the moment)
        if (o.sling) window.__lastSling = { state: o.sling.w.state, t: p.t };
        window.__renderer = this;
        window.__frameAt = { date: Date.now(), t: p.t };
        // (each frame's performance.now() and play clock, for the timestamp check)
        (window.__frames ??= []).push({ perf: performance.now(), t: p.t });
        if (window.__frames.length > 120) window.__frames.shift();
        return r;
      };
    }
  });
}

/** The Game behind the screen (QA only): found through React's fiber on the canvas. */
const findGame = `(() => {
  const el = document.querySelector('.hg2-canvas');
  const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  for (let f = key ? el[key] : null; f; f = f.return) {
    for (let h = f.memoizedState; h && typeof h === 'object' && 'next' in h; h = h.next) {
      const v = Array.isArray(h.memoizedState) ? h.memoizedState[0] : null;
      if (v && typeof v === 'object' && 'heat' in v && 'ends' in v) return v;
    }
  }
  return null;
})()`;

async function load(page, url, seed, extra = {}) {
  await page.goto(url({ arcade: '', sport: 'nfl', seed, ...extra }), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(extra.auto !== undefined ? '.hg2-canvas' : '.fb2-tray', { timeout: 60000 });
  await hook(page);
}

async function pickCall(page, kind) {
  const want = kind === 'PASS' ? 'pass' : 'run';
  const cards = page.locator('.fb2-tray .fb2-card[data-call]');
  for (let i = 0; i < (await cards.count()); i++)
    if ((await cards.nth(i).innerText()).includes(kind)) {
      await cards.nth(i).click();
      break;
    }
  if ((await page.evaluate(() => window.__play?.call)) !== want) await page.locator('[data-ctl="B"]').click();
  await page.waitForTimeout(50);
  return (await page.evaluate(() => window.__play?.call)) === want;
}
async function snapBall(page) {
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-ctl="A"]').click();
    for (let k = 0; k < 60; k++) {
      if ((await page.evaluate(() => window.__play?.phase)) !== 'pre') return true;
      await page.waitForTimeout(40);
    }
  }
  return false;
}
async function waitPlay(page, pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(pred)) return true;
    await page.waitForTimeout(20);
  }
  return false;
}
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('.v2-toast')].map((t) => t.className.replace('v2-toast ', '') + ':' + t.textContent).join(' | '));

/** A touch through CDP (real pointer events with the browser's own timestamps). */
function touch(cdp) {
  const pts = new Map();
  let id = 20;
  // `at` (epoch ms): the moment the touch happened, which becomes the event's timeStamp; the
  // event itself may be delivered later (a late frame, a busy machine)
  const send = (type, at) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()], ...(at ? { timestamp: at / 1000 } : {}) });
  return {
    async down(x, y, at) {
      const k = ++id;
      pts.set(k, { x, y, id: k, radiusX: 3, radiusY: 3, force: 1 });
      await send('touchStart', at);
      return k;
    },
    async move(k, x, y) {
      pts.set(k, { ...pts.get(k), x, y });
      await send('touchMove');
    },
    async up(k, at) {
      pts.delete(k);
      await send('touchEnd', at);
    }
  };
}

/** Where to drag from, and by how much, to sling at `aim` (the screen's own mapping, end view). */
const dragFor = (page, aim) =>
  page.evaluate((aim) => {
    const p = window.__play;
    const w = innerWidth,
      h = innerHeight;
    const per = window.__eng.maxThrow(p) / (Math.min(w, h) * 0.62);
    // a start on open field in the right two thirds, clear of chips, controls and the stick zone
    let s = null;
    for (const [fx, fy] of [[0.7, 0.3], [0.85, 0.36], [0.6, 0.4], [0.8, 0.25], [0.9, 0.45]]) {
      const x = Math.round(w * fx),
        y = Math.round(h * fy);
      const el = document.elementFromPoint(x, y);
      if (el && !el.closest('.fb2-icon, .fb2-ctl, .v2-pause, .v2-bug, .v2-stick-ring')) {
        s = { x, y };
        break;
      }
    }
    return s && { x0: s.x, y0: s.y, dx: -(aim.x - p.qb.x) / per, dy: (aim.y - p.qb.y) / per };
  }, aim);

/** A receiver whose ring is gold for a sling `wait` seconds ahead, with time to drag first. */
const goldAim = (page, offPath = 0) =>
  page.evaluate((offPath) => {
    const E = window.__eng;
    const p = window.__play;
    if (!p || p.phase !== 'drop') return null;
    for (const b of p.bodies.filter((b) => b.side === 'O' && b.job === 'route'))
      for (const wait of [0.9, 1.1, 1.3]) {
        let at = { x: b.x, y: b.y };
        for (let i = 0; i < 3; i++) at = E.projectRoute(b, wait + E.flightTime(p, E.dist(p.qb, at)));
        if (at.x < 3 || at.x > E.FIELD_W - 3) continue;
        const aim = { x: at.x + offPath, y: at.y };
        const w = E.slingWindow(p, aim);
        if (w && (offPath ? w.w.state === 'amber' : w.w.state === 'gold') && w.w.center > p.t + 0.6) return { aim, center: w.w.center, half: w.w.half, target: b.slot };
      }
    return null;
  }, offPath);

/**
 * Real ms (Date.now) when the engine reaches engine time `t`, from the last frame. The play's clock
 * at a draw runs behind real time by what's left in the fixed-step accumulator (0-17 ms, half a step
 * on average), so the estimate takes that half step off.
 */
const whenEngine = (page, t) => page.evaluate((t) => window.__frameAt.date + (t - window.__frameAt.t) * 1000 - 8, t);
/** The same moment as an exact epoch time on the page's own clock (performance.timeOrigin + now). */
const epochOf = (page, t) =>
  page.evaluate((t) => {
    const f = window.__frames[window.__frames.length - 1];
    return performance.timeOrigin + f.perf + (t - f.t) * 1000 - 8;
  }, t);
/** Release at engine time `t`: the touch carries that moment as its timestamp and is delivered
 * `late` ms after it, so the judgement has to come from the timestamp, not from when it arrived. */
async function releaseAt(page, T, k, t, late = 12) {
  const at = await epochOf(page, t);
  await sleep(at + late - Date.now());
  await T.up(k, at);
}

/** Drag the sling for a gold (or amber) aim and hold; returns the plan, or null if this play has none. */
async function holdSling(page, T, offPath = 0) {
  if (!(await waitPlay(page, () => window.__play?.phase === 'drop' && window.__play.t > 0.85, 6000))) return null;
  const g = await goldAim(page, offPath);
  if (!g) return null;
  const d = await dragFor(page, g.aim);
  if (!d) return null;
  const k = await T.down(d.x0, d.y0);
  for (let i = 1; i <= 4; i++) await T.move(k, d.x0 + (d.dx * i) / 4, d.y0 + (d.dy * i) / 4);
  await page.waitForTimeout(60);
  return { ...g, k };
}

try {
  for (const view of VIEWS)
    for (const reducedMotion of MOTION === 'both' ? ['no-preference', 'reduce'] : [MOTION]) {
      const tag = view + '-' + reducedMotion;
      const { page, context, errors, url } = await phone(browser, { viewport: view, reducedMotion });
      const cdp = await context.newCDPSession(page);
      const T = touch(cdp);
      const shot = (name) => page.screenshot({ path: shotPath(TASK, name + '-' + tag) });

      // ---- the sling: gold on the reticle, a PERFECT on its centre, the chime once, ON FIRE ----
      let perfect = null;
      for (let attempt = 0; attempt < 14 && !perfect; attempt++) {
        await load(page, url, 'ring-' + view + '-' + attempt);
        await pickCall(page, 'PASS');
        await page.evaluate(`(() => { const g = ${findGame}; if (g) g.heat = { pts: 90, fire: 0, best: 90, lit: 0 }; })()`);
        if (!(await snapBall(page))) continue;
        const h = await holdSling(page, T);
        if (!h) continue;
        // the ring's moment (re-read: the window drawn now is the one that's judged)
        const due = await whenEngine(page, (await page.evaluate(() => window.__sling?.w.center)) ?? h.center);
        await sleep(due - Date.now() - 150);
        const drawnBefore = await page.evaluate(() => window.__sling?.w.state ?? null);
        await shot('sling-gold');
        await sleep((await whenEngine(page, (await page.evaluate(() => window.__sling?.w.center)) ?? h.center)) - Date.now() - 30);
        // what the reticle shows just before the release
        const sl = await page.evaluate(() => window.__sling && { state: window.__sling.w.state, center: window.__sling.w.center, half: window.__sling.w.half });
        await releaseAt(page, T, h.k, sl?.center ?? h.center);
        await waitPlay(page, () => !!window.__play?.ring, 1500);
        const ring = await page.evaluate(() => window.__play?.ring ?? null);
        await page.waitForTimeout(120);
        const toast = await toastText(page);
        const chimes = await page.evaluate(() => window.__chimes.length);
        // (what the reticle showed 150 ms and 30 ms before, and in the last frame before the throw)
        const last = await page.evaluate(() => window.__lastSling);
        perfect = { drawn: last?.state, seen: [drawnBefore, sl?.state, last?.state], ring, toast, chimes, target: h.target };
        if (ring?.judge === 'perfect') await shot('perfect-toast');
        if (ring?.judge !== 'perfect') perfect = null;
        if (perfect) {
          const scale = await page.evaluate(() => getComputedStyle(document.querySelector('.v2-toast.perfect b') ?? document.body).animationName);
          perfect.anim = scale;
          // on to the next snap: the bar lit ON FIRE (90 + 12)
          await waitPlay(page, () => !!document.querySelector('.fb2-tray'), 12000);
          await page.waitForTimeout(300);
          perfect.fire = await page.evaluate(() => ({ bug: !!document.querySelector('.v2-bug-team.us.fire .v2-bug-flame'), bar: !!document.querySelector('.v2-heat-bar.us.fire'), play: !!window.__play?.fire }));
          await shot('on-fire-presnap');
          // the burning ball: a pass in the air while ON FIRE
          await pickCall(page, 'PASS');
          if (await snapBall(page)) {
            await waitPlay(page, () => window.__play?.phase === 'drop' && window.__play.t > 1, 4000);
            const chip = await page.evaluate(() => {
              const r = document.querySelector('.fb2-icon.pick')?.getBoundingClientRect();
              return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
            });
            if (chip) {
              const k = await T.down(chip.x, chip.y);
              await T.up(k);
              await waitPlay(page, () => window.__play?.phase === 'air' && window.__play.t - window.__play.ball.t0 > 0.25, 3000);
              await shot('on-fire-ball');
            }
          }
        }
      }
      check(tag + ' sling: the ring is gold on the reticle and a centre release is PERFECT', !!perfect && perfect.drawn === 'gold' && perfect.ring.judge === 'perfect', perfect);
      check(tag + ' PERFECT on the toast line and the chime called once', !!perfect && /PERFECT/.test(perfect.toast) && perfect.chimes === 1, perfect && { toast: perfect.toast, chimes: perfect.chimes });
      check(tag + ' reduced motion: the PERFECT word has no scale (normal: it pops)', !!perfect && (reducedMotion === 'reduce' ? perfect.anim === 'none' : perfect.anim === 'v2-perfect-pop'), perfect?.anim);
      check(tag + ' Heat 90 + PERFECT lights ON FIRE: the bug flame, the bar and the next play', !!perfect?.fire && perfect.fire.bug && perfect.fire.bar && perfect.fire.play, perfect?.fire);

      // ---- amber (off his path: TIMING) and red (past the arm: RANGE) ----
      let amber = null;
      let red = null;
      for (let attempt = 0; attempt < 6 && !(amber && red); attempt++) {
        await load(page, url, 'ring-ar-' + view + '-' + attempt);
        await pickCall(page, 'PASS');
        if (!(await snapBall(page))) continue;
        const h = await holdSling(page, T, 1.9);
        if (!h) continue;
        await page.waitForTimeout(120);
        amber = await page.evaluate(() => window.__sling?.w.state ?? null);
        if (amber === 'amber') await shot('sling-amber');
        else amber = null;
        // now pull past the arm
        const far = await page.evaluate(() => ({ x: innerWidth * 0.9, y: innerHeight * 0.05 }));
        await T.move(h.k, far.x - 0, far.y + 0);
        const d = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
        await T.move(h.k, d.w * 0.5, d.h * 0.99);
        await page.waitForTimeout(120);
        red = await page.evaluate(() => window.__sling?.w.state ?? null);
        if (red === 'red') await shot('sling-red-range');
        else red = null;
        await T.up(h.k);
        await page.waitForTimeout(200);
        const toast = await toastText(page);
        if (red) red = toast;
      }
      check(tag + ' amber off his path, red past the arm (RANGE on the toast)', amber === 'amber' && !!red && /RANGE/.test(red), { amber, red });

      // ---- the frame-delay check: 30 ms added to every frame (one every ~47 ms) ----
      // A release a little off the ring's centre. From the touch's own timestamp and the last frame
      // drawn before it, the engine time of the release is known to within one step (what was left
      // in the accumulator); the judgement must agree with it. A judgement taken from the frame
      // that reads the touch would be up to a whole delayed frame later, and is reported beside it.
      const samples = [];
      for (let attempt = 0; attempt < 24 && samples.length < 3; attempt++) {
        await load(page, url, 'ring-lag-' + view + '-' + attempt);
        await page.evaluate(() => {
          const raf = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = (cb) =>
            raf((t) => {
              const until = performance.now() + 30;
              while (performance.now() < until);
              cb(t);
            });
        });
        await pickCall(page, 'PASS');
        if (!(await snapBall(page))) continue;
        const h = await holdSling(page, T);
        if (!h) continue;
        const w = await page.evaluate(() => window.__sling && { center: window.__sling.w.center, half: window.__sling.w.half, state: window.__sling.w.state });
        if (!w || w.state !== 'gold') {
          await T.up(h.k);
          continue;
        }
        const off = 0.4 * w.half;
        await releaseAt(page, T, h.k, w.center + off, 35);
        await waitPlay(page, () => !!window.__play?.ring, 1500);
        const r = await page.evaluate(() => {
          const ts = window.__upTs;
          const fr = window.__frames.filter((f) => f.perf <= ts).pop();
          const next = window.__frames.find((f) => f.perf > ts);
          return { ring: window.__play?.ring ?? null, at: fr ? fr.t + (ts - fr.perf) / 1000 : null, frameAt: next ? next.t : null };
        });
        if (!r.ring || r.at === null) continue;
        const DT = 1 / 60;
        const lo = r.at - w.center,
          hi = lo + DT;
        // perfect is possible if some moment in [lo, hi] is inside the half-window, certain if all are
        const can = Math.min(Math.abs(lo), Math.abs(hi), lo < 0 && hi > 0 ? 0 : 9) <= w.half;
        const must = Math.max(Math.abs(lo), Math.abs(hi)) <= w.half;
        // (the ring's state at the throw: an amber ring is never PERFECT, wherever it's released)
        const ok = r.ring.state !== 'gold' ? r.ring.judge !== 'perfect' : r.ring.judge === 'perfect' ? can : !must;
        samples.push({ ok, judge: r.ring.judge, state: r.ring.state, half: +w.half.toFixed(3), fromTouch: [+lo.toFixed(3), +hi.toFixed(3)], fromFrame: r.frameAt === null ? null : +(r.frameAt - w.center).toFixed(3) });
      }
      check(tag + ' with a 30 ms frame delay the judgement agrees with the touch timestamp (3 releases)', samples.length === 3 && samples.every((x) => x.ok), samples);

      // ---- the JUKE ring on a tackler, and a PERFECT juke ----
      let juke = null;
      const jukeTries = [];
      for (let attempt = 0; attempt < 20 && !juke; attempt++) {
        await load(page, url, 'ring-juke-' + view + '-' + attempt);
        await page.evaluate(`(() => { const g = ${findGame}; if (g) g.heat = { pts: 60, fire: 0, best: 60, lit: 0 }; })()`);
        await pickCall(page, 'RUN');
        if (!(await snapBall(page))) continue;
        let plan = null;
        const t0 = Date.now();
        while (!plan && Date.now() - t0 < 6000) {
          plan = await page.evaluate(() => {
            const p = window.__play;
            if (!p || p.phase !== 'run' || p.end) return null;
            for (const b of p.bodies) {
              const w = b.side === 'D' ? window.__eng.jukeWindow(p, b) : null;
              if (w && w.state === 'gold' && w.center > p.t + 0.12) return { id: b.id, center: w.center, half: w.half };
            }
            return null;
          });
          if (!plan) {
            if (await page.evaluate(() => !!window.__play?.end)) break;
            await page.waitForTimeout(10);
          }
        }
        if (!plan) {
          jukeTries.push('no ring');
          continue;
        }
        await shot('juke-ring');
        const a = await page.evaluate(() => {
          const r = document.querySelector('[data-ctl="A"]')?.getBoundingClientRect();
          return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
        });
        if (!a) {
          jukeTries.push('no A');
          continue;
        }
        const chimes0 = await page.evaluate(() => window.__chimes.length);
        // the press is the timing (a press that isn't a swipe cuts away from the man on release); it
        // carries the ring's moment as its timestamp and arrives a little after it
        const at = await epochOf(page, plan.center);
        await sleep(at + 10 - Date.now());
        const k = await T.down(a.x, a.y, at);
        await T.up(k, at + 30);
        // (read it in the same play: a quick tackle can bring the next play in within the second)
        await waitPlay(page, () => !!window.__play?.ring || !!window.__play?.end, 1200);
        const res = await page.evaluate((id) => ({ ring: window.__play?.ring ?? null, act: window.__play?.bodies[id].act, stunned: window.__play ? window.__play.bodies[id].stunUntil > window.__play.t : false, move: window.__play?.move ? window.__play.move.kind + '@' + window.__play.move.at.toFixed(2) : null, t: window.__play?.t.toFixed(2), end: window.__play?.end?.kind ?? null }), plan.id);
        jukeTries.push(res.ring ? res.ring.kind + ':' + res.ring.judge + ':' + res.ring.state : 'no ring judged ' + JSON.stringify({ c: plan.center.toFixed(2), move: res.move, t: res.t, end: res.end }));
        if (res.ring?.judge === 'perfect') {
          await page.waitForTimeout(90);
          await shot('juke-perfect-stumble');
          // (PERFECT's chime is called once; the toast can already show a later hit by another man)
          juke = { ...res, toast: await toastText(page), chimes: (await page.evaluate(() => window.__chimes.length)) - chimes0 };
          // HEATING UP (60 + 12) shows once the play's over
          await waitPlay(page, () => !!window.__play?.end, 8000);
          await page.waitForTimeout(1500);
          juke.heating = await toastText(page);
          juke.bar = await page.evaluate(() => !!document.querySelector('.v2-heat-bar.us.heating'));
          await shot('heating-up');
        }
      }
      check(tag + ' a JUKE on the centre of the gold ring is PERFECT (chime once) and that tackler goes down', !!juke && juke.act === 'down' && juke.stunned && juke.chimes === 1, juke ?? jukeTries);
      check(tag + ' HEATING UP at 66 (60 + 12): the bar glows', !!juke?.bar, juke && { bar: juke.bar, toast: juke.heating });

      // ---- the final card with the grade, which only onDone carries ----
      await page.goto(url({ arcade: '', sport: 'nfl', seed: 'ring-final-' + view, drives: '1', auto: '' }), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.hg2-canvas', { timeout: 60000 });
      await page.evaluate(() => {
        window.__progress = [];
        const el = document.querySelector('[data-progress]');
        new MutationObserver(() => window.__progress.push(el.getAttribute('data-progress'))).observe(el, { attributes: true });
      });
      await page.waitForSelector('.fb2-grade', { timeout: 120000 });
      await page.waitForTimeout(400);
      await shot('final-grade');
      const prog = await page.evaluate(() => window.__progress.map((s) => JSON.parse(s)));
      const last = prog[prog.length - 1];
      check(tag + ' the final card shows the grade; only the finished Progress carries it', !!last?.grade && last.done && prog.slice(0, -1).every((p) => !p.grade), { n: prog.length, grade: last?.grade });

      check(tag + ' no page errors', errors.length === 0, errors.slice(0, 3));
      await context.close();
    }
} finally {
  await browser.close();
}
const iso = report();
console.log(pass && iso ? 'nfl-ring: ALL PASS' : 'nfl-ring: FAILURES');
if (!pass) process.exitCode = 1;
