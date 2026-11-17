// Claude, 2026-11-01: browser QA for the dev-only soccer lab (?soccer-lab). Portrait phones, real
// touch input through CDP (Input.dispatchTouchEvent), screenshots of each stage, page errors and
// frame time. Needs the dev server: PS_QA_URL=http://localhost:5187/ node scripts/qa/soccer-lab.mjs [part]
// 2026-11-02: SHOOT is held and dragged to aim (the stick keeps running); the report has the aim the
// drag set, whether the shot was assisted, and the run speed while the meter was up.
// Studio overhaul soccer-1 (2026-11-10): every context goes through scripts/soccer/qa-isolate.mjs
// (live hosts aborted and counted, the safe-area insets injected, ?ns=inspect&relay=ws://localhost:7777).
// The play parts run on the owner's phone (393x852, Dynamic Island 59/34) and the smallest (320x568);
// `smoke` opens the lab on all six presets (page errors, the computed --sat, a live-host probe that
// must be blocked). soccer-1 parts on the same two phones: `bend` (a free kick with Bend left: its
// arrow, and where the kick goes), `autokick` (a free kick left alone: the countdown, then the
// autopilot takes it), `confetti` (a shootout: the rival's goal throws confetti in the rival's kit),
// `restarts` (R-2, 2026-11-16: a keeper's parry staged running wide of the post, the corner it earns
// lined up in the same attack, then a ball off a defender over the touchline and the quick throw-in).
// soccer-4 (2026-11-16): `ring` (the gold ring: gold let go on the gold with the word, chime and
// haptic frames and the judged offset against the touches' timestamps; amber under pressure; red TOO FAR).
// soccer-5 (2026-11-16): `touch` (the dribble: the ball knocked 0.6-1.0 m ahead at a jog and 3-5 m at a
// sprint through a real thumb on the stick; a defender jockeying, facing the ball, and a poke between
// touches; a shield with the stick back toward goal; the yellow card's toast, staged through its event).
// Parts: all | smoke | play | buttons | auto | sets | pens | bend | autokick | confetti | restarts | layout | ring | touch.
import { launch, base, artifacts } from './browser.mjs';
import { blocked, blockedLine, computedSat, phone, PRESETS, urlFor } from '../soccer/qa-isolate.mjs';
import fs from 'node:fs';
const out = process.env.PS_QA_SOCCER_OUT || artifacts + '/soccer';
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2] ?? 'all';
const part = (k) => only === 'all' || only === k;
const browser = await launch();
const report = [];
const errorsAll = [];
const preset = (tag) => PRESETS.find((p) => p.tag === tag);
async function open(p, params, opts = {}) {
  const context = await phone(browser, p, { dpr: 2, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|QA isolation/.test(m.text()) && errors.push('console: ' + m.text()));
  await page.goto(urlFor(base, { 'soccer-lab': '1', qa: '1', ...params }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__soccer && window.__soccer.a, null, { timeout: 30000 });
  const cdp = await context.newCDPSession(page);
  return { context, page, errors, cdp };
}
const state = (page) => page.evaluate(() => { const s = window.__soccer; const a = s.a; const c = a.bodies[a.ctrl]; return { ui: s.ui, t: a.t, used: a.used, end: a.end, ctrl: { x: c.x, y: c.y, vx: c.vx, vy: c.vy, tag: c.p.tag }, ball: { x: a.ball.x, y: a.ball.y, h: a.ball.h, owner: a.ball.owner }, meter: !!a.meter, aim: a.meter ? (a.meter.aim ?? null) : null, assisted: a.lastShot ? !!a.lastShot.assisted : null, setPiece: a.setPiece?.kind ?? null, goals: s.m.goals, ends: s.m.ends.slice(), i: s.m.i }; });
async function touch(cdp, type, points) {
  const touchPoints = points.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id ?? i }));
  try { await cdp.send("Input.dispatchTouchEvent", { type, touchPoints }); } catch (e) { throw new Error(type + " " + JSON.stringify(touchPoints) + " " + e.message); }
}
async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox({ timeout: 3000 });
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height } : null;
}
async function frameTime(page, ms = 2000) {
  return page.evaluate((ms) => new Promise((res) => { const ts = []; const t0 = performance.now(); const f = (t) => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(f); else { const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); res({ frames: d.length, median: d[Math.floor(d.length / 2)], p95: d[Math.floor(d.length * 0.95)] }); } }; requestAnimationFrame(f); }), ms);
}
// C5 from the frame recorder: the first frame on 'live' (the whistle), the first frame the carrier has
// any speed (the held push taken: 'respondMs'), and the first he has moved 0.05 m ('movedMs', the gate)
const C5_OF = () => { const r = window.__rec; const i = r.findIndex((f) => f.ui === 'live'); if (i < 0) return null; const w = r[i]; const go = r.slice(i).find((f) => f.v > 0.05); const m = r.slice(i).find((f) => Math.hypot(f.x - w.x, f.y - w.y) > 0.05); return { whistleAt: w.t, respondMs: go ? Math.round(go.t - w.t) : null, movedMs: m ? Math.round(m.t - w.t) : null }; };
if (part('smoke')) {
  // every preset: the lab loads with no page error, the injected insets reach .arcade-full, and a
  // request and a WebSocket to a live host from the page are both stopped (and counted)
  for (const p of PRESETS) {
    const before = blocked.count;
    const { context, page, errors } = await open(p, { seed: 'qa-smoke', scenario: 'freekick' });
    await page.waitForSelector('.sc2-ctl.go');
    const sat = await computedSat(page);
    const probe = await page.evaluate(async () => {
      const fetched = await fetch('https://example.com/ps-qa-isolation-probe').then(() => 'reached', () => 'blocked');
      const socket = await new Promise((res) => {
        const ws = new WebSocket('wss://example.com/ps-qa-isolation-probe');
        ws.onopen = () => res('reached');
        ws.onclose = () => res('blocked');
        ws.onerror = () => res('blocked');
        setTimeout(() => res('timeout'), 5000);
      });
      return { fetched, socket };
    });
    await page.screenshot({ path: `${out}/${p.tag}-smoke.png` });
    const row = { tag: p.tag, step: 'smoke', sat, wantSat: p.insets[0], probe, blockedHere: blocked.count - before, errors };
    report.push(row);
    errorsAll.push(...errors);
    if (sat !== p.insets[0]) errorsAll.push(p.tag + ': --sat ' + sat + ' (wanted ' + p.insets[0] + ')');
    if (probe.fetched !== 'blocked' || probe.socket !== 'blocked' || row.blockedHere < 2) errorsAll.push(p.tag + ': live-host probe not blocked ' + JSON.stringify(probe));
    await context.close();
  }
}
for (const p of [preset('393x852-sat59'), preset('320x568')]) {
  const tag = p.tag;
  if (part('play')) {
    // 1. kickoff card, then a real touch match: stick forward with SPRINT held (two fingers), pass, shoot
    const { context, page, errors, cdp } = await open(p, { seed: 'qa1', home: 'BAR', hs: '2015', away: 'RMA', as: '2017' });
    await page.waitForSelector('.sc2-ctl.go');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${tag}-kickoff.png` });
    const go = await center(page, '.sc2-ctl.go');
    await touch(cdp, 'touchStart', [go]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForSelector('.ps-stick-ghost');
    const s0 = await state(page);
    const stick = await center(page, '.ps-stick-ghost');
    // forward (up the screen), pushed past the ring: sprint on the left thumb (soccer-2)
    await touch(cdp, 'touchStart', [{ ...stick, id: 1 }]);
    await touch(cdp, 'touchMove', [{ x: stick.x, y: stick.y - 40, id: 1 }]);
    await touch(cdp, 'touchMove', [{ x: stick.x, y: stick.y - 85, id: 1 }]);
    await page.waitForTimeout(700);
    const s1 = await state(page);
    await page.screenshot({ path: `${out}/${tag}-attack.png` });
    // to the right
    await touch(cdp, 'touchMove', [{ x: stick.x + 50, y: stick.y, id: 1 }]);
    await page.waitForTimeout(450);
    const s2 = await state(page);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(400);
    const s3 = await state(page);
    const ft = await frameTime(page, 2000);
    // hold SHOOT, screenshot the meter, let go near the top
    let s4 = await state(page);
    if ((await page.locator('.sc2-ctl[data-act="shoot"]').count()) && s4.ball.owner !== null && !s4.end) {
      const shoot = await center(page, '.sc2-ctl[data-act="shoot"]');
      await touch(cdp, 'touchStart', [{ ...shoot, id: 3 }]);
      // drag on SHOOT: right and up (the top right corner)
      for (let k = 1; k <= 4; k++) await touch(cdp, 'touchMove', [{ x: shoot.x + 10 * k, y: shoot.y - 9 * k, id: 3 }]);
      await page.waitForTimeout(330);
      await page.screenshot({ path: `${out}/${tag}-shot-meter.png` });
      s4 = await state(page);
      await page.waitForTimeout(180);
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${tag}-shot.png` });
    }
    const metered = s4;
    s4 = await state(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}/${tag}-after.png` });
    report.push({ tag, step: 'touch', start: s0.ctrl, forward: s1.ctrl, right: s2.ctrl, released: s3.ctrl, dragAim: metered.aim, shot: s4, frame: ft, errors });
    errorsAll.push(...errors);
    await context.close();
  }
  if (part('buttons')) {
    // PASS (tap: along the grass), the receiver takes it; THRU; then SHOOT held and let go in the box
    const { context, page, errors, cdp } = await open(p, { seed: 'qa-btn', scenario: 'build', home: 'BAR', hs: '2015', away: 'EVE', as: '2016' });
    await page.locator('.sc2-ctl.go').tap({ force: true });
    await page.waitForSelector('.sc2-ctl[data-act="pass"], .sc2-ctl[data-act="cross"]');
    const before = await state(page);
    const pb = await center(page, '.sc2-ctl[data-act="pass"], .sc2-ctl[data-act="cross"]');
    await touch(cdp, 'touchStart', [pb]);
    await page.waitForTimeout(60);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(1400);
    const afterPass = await state(page);
    let thru = null;
    if (!afterPass.end && (await page.locator('.sc2-ctl[data-act="thru"]').count())) {
      await page.locator('.sc2-ctl[data-act="thru"]').tap();
      await page.waitForTimeout(1600);
      thru = await state(page);
    }
    // carry it toward goal, then shoot
    const st = await center(page, '.ps-stick-ghost').catch(() => null);
    let shot = null;
    if (st && !(await state(page)).end) {
      await touch(cdp, 'touchStart', [{ ...st, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: st.x, y: st.y - 50, id: 1 }]);
      await page.waitForTimeout(900);
      await touch(cdp, 'touchEnd', []);
      if ((await page.locator('.sc2-ctl[data-act="shoot"]').count()) && !(await state(page)).end) {
        const sh = await center(page, '.sc2-ctl[data-act="shoot"]');
        await touch(cdp, 'touchStart', [{ ...sh, id: 2 }]);
        await page.waitForTimeout(700);
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${out}/${tag}-shot-flight.png` });
        await page.waitForTimeout(1500);
        shot = await state(page);
      }
    }
    report.push({ tag, step: 'buttons', before: before.ctrl.tag, afterPass: { ctrl: afterPass.ctrl.tag, owner: afterPass.ball.owner, end: afterPass.end }, thru: thru && { ctrl: thru.ctrl.tag, end: thru.end }, shot: shot && { end: shot.end, ends: shot.ends }, errors });
    errorsAll.push(...errors);
    await context.close();
  }
  if (part('auto')) {
    // 2. the autopilot plays a whole match at normal speed: goal, final
    const { context, page, errors } = await open(p, { seed: 'qa-auto', auto: '1', home: 'BAR', hs: '2015', away: 'EVE', as: '2016' });
    let shotGoal = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const s = await state(page);
      if (!shotGoal && s.end?.kind === 'G') {
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${out}/${tag}-goal.png` });
        shotGoal = true;
      }
      if (s.ui === 'final') break;
      await page.waitForTimeout(150);
    }
    const s = await state(page);
    await page.screenshot({ path: `${out}/${tag}-final.png` });
    report.push({ tag, step: 'auto', ui: s.ui, ends: s.ends, goals: s.goals, goalShot: shotGoal, errors });
    errorsAll.push(...errors);
    await context.close();
  }
  if (part('sets')) {
    for (const sc of ['corner', 'freekick', 'counter', 'wide']) {
      const { context, page, errors } = await open(p, { seed: 'qa-' + sc, scenario: sc, home: 'LIV', hs: '2019', away: 'MCI', as: '2019' });
      await page.waitForSelector('.sc2-ctl.go');
      await page.waitForTimeout(700);
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${tag}-${sc}.png` });
      report.push({ tag, step: sc, s: await state(page), errors });
      errorsAll.push(...errors);
      await context.close();
    }
  }
  if (part('pens')) {
    const { context, page, errors, cdp } = await open(p, { seed: 'qa-pens', pens: '1' });
    await page.waitForSelector('.sc2-ctl.go');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${tag}-shootout.png` });
    let kicks = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const s = await state(page);
      if (s.ui === 'final') break;
      if (s.ui === 'so-intro' && (await page.locator('.sc2-ctl.go').count())) {
        await page.locator('.sc2-ctl.go').tap({ force: true, timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300);
        continue;
      }
      if (s.ui === 'so-kick' && (await page.locator('.sc2-ctl[data-act="shoot"]').count()) && !s.meter && !s.end) {
        const st = await center(page, '.ps-stick-ghost').catch(() => null);
        const sh = await center(page, '.sc2-ctl[data-act="shoot"]').catch(() => null);
        // the kick's controls can go between the check and here (the kick taken, their turn)
        if (!st || !sh) continue;
        const side = kicks % 2 ? -1 : 1;
        await touch(cdp, 'touchStart', [{ ...st, id: 1 }]);
        await touch(cdp, 'touchMove', [{ x: st.x + side * 45, y: st.y - 10, id: 1 }]);
        await touch(cdp, 'touchStart', [{ x: st.x + side * 45, y: st.y - 10, id: 1 }, { ...sh, id: 2 }]);
        await page.waitForTimeout(700);
        if (kicks === 0) await page.screenshot({ path: `${out}/${tag}-penalty-meter.png` });
        await touch(cdp, 'touchEnd', [{ x: st.x + side * 45, y: st.y - 10, id: 1 }]);
        await touch(cdp, 'touchEnd', []);
        kicks++;
        await page.waitForTimeout(500);
        continue;
      }
      if (s.ui === 'so-kick' && (await page.locator('.sc2-dive button').count()) && !s.end) {
        // (the buttons go when the kick is taken: a tap that misses that moment is skipped)
        await page.locator('.sc2-dive button').nth(kicks % 3).tap({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${tag}-pens-final.png` });
    const pens = await page.evaluate(() => window.__pens ?? null);
    report.push({ tag, step: 'pens', kicks, pens, errors });
    errorsAll.push(...errors);
    await context.close();
  }
  if (part('bend')) {
    // C-4: the left arrow bends the free kick left (the arrow over the ball and the kick agree)
    const { context, page, errors, cdp } = await open(p, { seed: 'qa-bend', scenario: 'freekick', home: 'LIV', hs: '2019', away: 'MCI', as: '2019' });
    await page.waitForSelector('.sc2-ctl.go');
    await page.locator('.sc2-ctl.go').tap({ force: true });
    // soccer-2: the bend is on D (tap: straight → left → right), beside the swipe on the pitch
    await page.waitForSelector('.sc2-ctl[data-act="bend"]');
    const sizes = await page.locator('.sc2-ctl[data-act="bend"]').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), label: b.getAttribute('aria-label') }; }));
    const d = await center(page, '.sc2-ctl[data-act="bend"]');
    await touch(cdp, 'touchStart', [{ ...d, id: 3 }]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);
    const pressed = /left/.test((await page.locator('.sc2-ctl[data-act="bend"]').getAttribute('aria-label')) ?? '') ? 'true' : 'false';
    await page.screenshot({ path: `${out}/${tag}-bend-left.png` });
    const curl = await page.evaluate(() => window.__soccer.a.curl);
    // aim at the middle of the goal on the green, and see which way it swings
    const sh = await center(page, '.sc2-ctl[data-act="shoot"]');
    await touch(cdp, 'touchStart', [{ ...sh, id: 4 }]);
    await page.waitForTimeout(620);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${tag}-bend-left-flight.png` });
    const kick = await page.evaluate(() => { const s = window.__soccer.a.lastShot; return s ? { aimX: s.aim.x, crossX: s.cross?.x ?? null } : null; });
    const path = await page.evaluate(() => { const a = window.__soccer.a; return { ballX: a.ball.x, ballY: a.ball.y, end: a.end?.text ?? null }; });
    report.push({ tag, step: 'bend', sizes, pressed, curl, kick, path, errors });
    errorsAll.push(...errors);
    if (sizes.some((b) => b.h < 44 || b.w < 44)) errorsAll.push(tag + ': a BEND button under 44 px ' + JSON.stringify(sizes));
    if (!(curl > 0) || pressed !== 'true') errorsAll.push(tag + ': Bend left set curl ' + curl + ' pressed ' + pressed);
    await context.close();
  }
  if (part('autokick')) {
    // R-1: a free kick left alone counts down from 5 s and the autopilot takes it at 12 s
    const { context, page, errors } = await open(p, { seed: 'qa-autokick', scenario: 'freekick', home: 'LIV', hs: '2019', away: 'MCI', as: '2019' });
    await page.waitForSelector('.sc2-ctl.go');
    await page.locator('.sc2-ctl.go').tap({ force: true });
    let shot = false;
    let takenAt = null;
    let lastT = 0;
    const seen = new Set();
    const t0 = Date.now();
    const first = (await state(page)).i;
    while (Date.now() - t0 < 45000) {
      const s = await state(page);
      // the kick taken and the attack over: the lab deals the next free kick (a new attack)
      if (s.i !== first) {
        takenAt = lastT;
        break;
      }
      lastT = s.t;
      const cd = await page.locator('.sc2-toast').innerText().catch(() => null);
      if (cd) seen.add(cd.replace(/\s+/g, ' ').trim());
      if (!shot && cd && /IN 3/.test(cd)) {
        await page.screenshot({ path: `${out}/${tag}-autokick-countdown.png` });
        shot = true;
      }
      if (!s.setPiece || s.end) {
        takenAt = s.t;
        break;
      }
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${tag}-autokick-taken.png` });
    report.push({ tag, step: 'autokick', countdown: [...seen], takenAt, errors });
    errorsAll.push(...errors);
    if (takenAt === null || takenAt < 12 || takenAt > 15) errorsAll.push(tag + ': the free kick was not taken for the person at 12-15 s (' + takenAt + ')');
    if (!seen.size) errorsAll.push(tag + ': no countdown shown');
    await context.close();
  }
  if (part('confetti')) {
    // J-3: their goal in a shootout throws confetti in their kit (their kicks are the AI's; ours are
    // left to the autopilot after the wait, so the loop needs no touches)
    const { context, page, errors } = await open(p, { seed: 'qa-pens', pens: '1', home: 'BAR', hs: '2015', away: 'LIV', as: '2019' });
    let theirGoal = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 150000 && !theirGoal) {
      const s = await state(page);
      if (s.ui === 'final') break;
      if (s.ui === 'so-intro' && (await page.locator('.sc2-ctl.go').count())) {
        const theirs = /THEIR KICK/.test(await page.locator('.sc2-toast').innerText().catch(() => ''));
        await page.locator('.sc2-ctl.go').tap({ force: true, timeout: 1500 }).catch(() => {});
        if (theirs) {
          for (let k = 0; k < 60; k++) {
            const q = await state(page);
            if (q.end) {
              if (q.end.kind === 'G') {
                await page.waitForTimeout(260);
                await page.screenshot({ path: `${out}/${tag}-their-goal-confetti.png` });
                theirGoal = await page.evaluate(() => { const a = window.__soccer.a; const b = a.bodies[a.shotBy]; return { scorer: b.p.tag, side: b.side, act: b.act }; });
              }
              break;
            }
            await page.waitForTimeout(100);
          }
        }
        continue;
      }
      await page.waitForTimeout(250);
    }
    report.push({ tag, step: 'confetti', theirGoal, errors });
    errorsAll.push(...errors);
    if (!theirGoal) errorsAll.push(tag + ': no rival goal in the shootout to check the confetti');
    await context.close();
  }
  if (part('touch')) {
    const look = (page) => page.evaluate(() => { const a = window.__soccer.a; const c = a.bodies[a.ctrl]; const own = a.ball.owner === c.id; return { t: a.t, own, ahead: Math.hypot(a.ball.x - c.x, a.ball.y - c.y), v: Math.hypot(c.vx, c.vy), touchAt: c.touchAt ?? null, act: c.act, defs: a.bodies.filter((b) => b.side === 'D').map((b) => b.act), end: a.end?.text ?? null }; });
    const away = (page, near) => page.evaluate((near) => { const a = window.__soccer.a; const c = a.bodies[a.ctrl]; let first = true; for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') { if (near && first) { b.x = c.x; b.y = c.y + near; b.vx = b.vy = 0; first = false; continue; } b.x = 3; b.y = 40; b.vx = b.vy = 0; b.stunUntil = 1e9; } }, near);
    // 1. the knock-on at a jog and at a sprint (the defence out of it)
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-touch', scenario: 'counter' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.ps-stick-ghost');
      await away(page, 0);
      const g = await center(page, '.ps-stick-ghost');
      const r = g.w / 2;
      const row = { tag, step: 'touch-knock', ringR: r };
      for (const [mode, k, shot, lo, hi] of [['jog', 0.95, 'touch-jog', 0.6, 1.05], ['sprint', 1.45, 'touch-sprint', 2.6, 5.2]]) {
        await touch(cdp, 'touchStart', [{ ...g, id: 1 }]);
        await touch(cdp, 'touchMove', [{ x: g.x, y: g.y - r * 0.5, id: 1 }]);
        await touch(cdp, 'touchMove', [{ x: g.x, y: g.y - r * k, id: 1 }]);
        let max = 0;
        let touches = 0;
        let last = null;
        let shotTaken = false;
        const t0 = Date.now();
        while (Date.now() - t0 < 2200) {
          const s = await look(page);
          if (s.touchAt !== last) ((touches += last === null ? 0 : 1), (last = s.touchAt));
          max = Math.max(max, s.ahead);
          if (!shotTaken && Date.now() - t0 > 700 && s.ahead >= lo && s.ahead <= hi) {
            await page.screenshot({ path: `${out}/${tag}-${shot}.png` });
            shotTaken = true;
          }
          await page.waitForTimeout(30);
        }
        const s = await look(page);
        row[mode] = { maxAhead: +max.toFixed(2), touches, speed: +s.v.toFixed(2), own: s.own, shot: shotTaken };
        if (!shotTaken || !s.own) errorsAll.push(tag + ': ' + mode + ' knock ' + JSON.stringify(row[mode]));
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(700);
      }
      report.push(row);
      errorsAll.push(...errors);
      await context.close();
    }
    // 2. a defender jockeys (facing the ball) and pokes between touches: a sprint at the back line
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-poke', scenario: 'build' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.ps-stick-ghost');
      const g = await center(page, '.ps-stick-ghost');
      const r = g.w / 2;
      await touch(cdp, 'touchStart', [{ ...g, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: g.x, y: g.y - r * 0.95, id: 1 }]);
      const seen = { jockey: false, poke: false };
      const t0 = Date.now();
      while (Date.now() - t0 < 9000 && !(seen.jockey && seen.poke)) {
        const s = await look(page);
        if (s.end) break;
        if (!seen.jockey && s.defs.includes('jockey')) ((seen.jockey = true), await page.screenshot({ path: `${out}/${tag}-touch-jockey.png` }));
        if (!seen.poke && s.defs.includes('poke')) ((seen.poke = true), await page.screenshot({ path: `${out}/${tag}-touch-poke.png` }));
        // past the ring once he's been contained: the long touch the poke is waiting for
        if (seen.jockey) await touch(cdp, 'touchMove', [{ x: g.x, y: g.y - r * 1.45, id: 1 }]);
        await page.waitForTimeout(25);
      }
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(900);
      const s = await look(page);
      await page.screenshot({ path: `${out}/${tag}-touch-after-poke.png` });
      report.push({ tag, step: 'touch-defend', seen, end: s.end });
      if (!seen.jockey || !seen.poke) errorsAll.push(tag + ': defend ' + JSON.stringify(seen));
      errorsAll.push(...errors);
      await context.close();
    }
    // 3. a shield: a man a metre goal-side, the stick back toward our own goal (down the screen)
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-shield', scenario: 'build' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.ps-stick-ghost');
      await away(page, 1.0);
      const g = await center(page, '.ps-stick-ghost');
      const r = g.w / 2;
      await touch(cdp, 'touchStart', [{ ...g, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: g.x, y: g.y + r * 0.9, id: 1 }]);
      let shield = false;
      for (let k = 0; k < 40 && !shield; k++) {
        const s = await look(page);
        if (s.act === 'shield') {
          shield = true;
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${out}/${tag}-touch-shield.png` });
        } else await page.waitForTimeout(30);
      }
      await touch(cdp, 'touchEnd', []);
      report.push({ tag, step: 'touch-shield', shield });
      if (!shield) errorsAll.push(tag + ': no shield');
      // 4. the yellow card's toast (its event staged on the live attack: a breakaway foul is seeded luck)
      await page.evaluate(() => window.__soccer.a.events.push('foul', 'yellow', 'advantage'));
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${tag}-touch-yellow.png` });
      const toast = await page.evaluate(() => document.querySelector('.hg2-pop')?.textContent ?? '');
      report.push({ tag, step: 'touch-yellow', toast });
      if (!/YELLOW/.test(toast)) errorsAll.push(tag + ': yellow toast ' + toast);
      errorsAll.push(...errors);
      await context.close();
    }
  }
  if (part('ring')) {
    // soccer-4: the gold ring on SHOOT. A shooter alone 18 m out (the defence moved off him through the
    // QA hook): the ring gold, SHOOT let go on the gold through a real touch, then the word, the chime
    // and the double haptic in the same frame (G6); the judged hold against the touches' own timestamps
    // (G5); the gold band's drawn length (G1). Then amber (a man within 1.5 m: PRESSURE) and red (33 m
    // with SHO 60: TOO FAR). Screenshots of each.
    const rig = async (page) => page.evaluate(() => {
      // what fired, and when: the touches' timestamps, the toast's word, the haptic, the chime's oscillators, the frames
      const w = window;
      w.__ring = { touches: [], frames: [], toast: [], vib: [], osc: [] };
      for (const t of ['pointerdown', 'pointerup']) window.addEventListener(t, (e) => w.__ring.touches.push({ t, ts: e.timeStamp }), { capture: true });
      const f = (t) => { w.__ring.frames.push(t); requestAnimationFrame(f); };
      requestAnimationFrame(f);
      const v = navigator.vibrate?.bind(navigator);
      navigator.vibrate = (p) => { w.__ring.vib.push({ at: performance.now(), p }); return v ? v(p) : true; };
      const st = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...a) { w.__ring.osc.push(performance.now()); return st.apply(this, a); };
      new MutationObserver(() => { const el = document.querySelector('.sc2-toast'); if (el) w.__ring.toast.push({ at: performance.now(), text: el.textContent }); }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    const clearOf = (page, near) => page.evaluate((near) => {
      const a = window.__soccer.a;
      const c = a.bodies[a.ctrl];
      let first = true;
      for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') {
        if (near && first) { b.x = c.x + near; b.y = c.y + 0.4; b.vx = b.vy = 0; b.stunUntil = 1e9; first = false; continue; }
        b.x = 3; b.y = 40; b.vx = b.vy = 0; b.stunUntil = 1e9;
      }
    }, near);
    const meter = (page) => page.evaluate(() => { const m = window.__soccer.a.meter; const a = window.__soccer.a; return m ? { held: a.t - m.t0, top: m.top, green: m.green, ring: m.ring, why: m.why ?? null } : null; });
    // gold
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-ring', scenario: 'build', start: '30,87', sho: '92' });
      await rig(page);
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.sc2-ctl[data-act="shoot"]');
      await clearOf(page, 0);
      await page.waitForTimeout(150);
      const shoot = await center(page, '.sc2-ctl[data-act="shoot"]');
      await touch(cdp, 'touchStart', [{ ...shoot, id: 5 }]);
      let m = await meter(page);
      await page.waitForTimeout(Math.max(0, (m.top - 0.16) * 1000));
      m = await meter(page);
      await page.screenshot({ path: `${out}/${tag}-ring-gold.png` });
      const view = await page.evaluate(() => window.__soccer.view.stats.goldArc);
      // let go on the gold: wait until the hold is within a few ms of the top
      for (let k = 0; k < 60; k++) { m = await meter(page); if (!m || m.held >= m.top - 0.012) break; await page.waitForTimeout(4); }
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(80);
      await page.screenshot({ path: `${out}/${tag}-ring-perfect.png` });
      const rel = await page.evaluate(() => { const a = window.__soccer.a; return { release: a.release ?? null, mark: performance.getEntriesByName('sc2-perfect').map((e) => e.startTime), ring: window.__ring }; });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${tag}-ring-after.png` });
      // G5: the engine's offset against the touches' own timestamps (the device lag is the 30 ms default)
      const tt = rel.ring.touches.filter((x) => x.t === 'pointerdown' || x.t === 'pointerup');
      const up = tt.filter((x) => x.t === 'pointerup').pop();
      const down = tt.filter((x) => x.t === 'pointerdown' && (!up || x.ts <= up.ts)).pop();
      const judgedMs = down && up && rel.release ? (up.ts - down.ts - 30 - rel.release.top * 1000) : null;
      // G6: the mark, the toast's PERFECT, the haptic and the chime between the same two frames
      const at = rel.mark[0];
      const frames = rel.ring.frames;
      const frameOf = (t) => frames.filter((f) => f <= t).length;
      const toast = rel.ring.toast.find((x) => /PERFECT/.test(x.text));
      const vib = rel.ring.vib.find((x) => Array.isArray(x.p));
      const osc = rel.ring.osc.find((x) => at !== undefined && x >= at - 1);
      const g6 = at === undefined ? null : { frame: frameOf(at), toast: toast ? frameOf(toast.at) : null, haptic: vib ? frameOf(vib.at) : null, chime: osc !== undefined ? frameOf(osc) : null, toastText: toast?.text ?? null };
      report.push({ tag, step: 'ring-gold', meterAtShot: m, goldArcPx: view, release: rel.release, judgedOffMs: judgedMs, engineOffMs: rel.release ? rel.release.off * 1000 : null, g6, errors });
      errorsAll.push(...errors);
      await context.close();
    }
    // amber: a man within 1.5 m
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-ring-amber', scenario: 'build', start: '30,87' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.sc2-ctl[data-act="shoot"]');
      await clearOf(page, 1.4);
      await page.waitForTimeout(120);
      const shoot = await center(page, '.sc2-ctl[data-act="shoot"]');
      await touch(cdp, 'touchStart', [{ ...shoot, id: 5 }]);
      await page.waitForTimeout(260);
      const m = await meter(page);
      await page.screenshot({ path: `${out}/${tag}-ring-amber.png` });
      const toast = await page.locator('.sc2-toast').first().textContent().catch(() => null);
      await touch(cdp, 'touchEnd', []);
      report.push({ tag, step: 'ring-amber', meter: m, toast, goldArcPx: await page.evaluate(() => window.__soccer.view.stats.goldArc), errors });
      errorsAll.push(...errors);
      await context.close();
    }
    // red: 33 m out with SHO 60
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-ring-red', scenario: 'build', start: '34,72', sho: '60' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.sc2-ctl[data-act="shoot"]');
      await clearOf(page, 0);
      await page.waitForTimeout(120);
      const shoot = await center(page, '.sc2-ctl[data-act="shoot"]');
      await touch(cdp, 'touchStart', [{ ...shoot, id: 5 }]);
      await page.waitForTimeout(380);
      const m = await meter(page);
      await page.screenshot({ path: `${out}/${tag}-ring-red.png` });
      const toast = await page.locator('.sc2-toast').first().textContent().catch(() => null);
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(120);
      const after = await page.locator('.sc2-toast').first().textContent().catch(() => null);
      report.push({ tag, step: 'ring-red', meter: m, toast, after, errors });
      errorsAll.push(...errors);
      await context.close();
    }
  }
  if (part('restarts')) {
    // R-2: the live attack object (window.__soccer.a) is staged the way rules.test.ts does it: the ball
    // leaves the keeper's hands wide of the right post, running over the byline
    const { context, page, errors } = await open(p, { seed: 'qa-restart', scenario: 'build', home: 'LIV', hs: '2019', away: 'MCI', as: '2019' });
    await page.waitForSelector('.sc2-ctl.go');
    await page.locator('.sc2-ctl.go').tap({ force: true });
    await page.waitForFunction(() => window.__soccer.ui === 'live' && window.__soccer.a.t > 0.3, null, { timeout: 10000 });
    const stage = (who, ball) => page.evaluate(({ who, ball }) => {
      const a = window.__soccer.a;
      const by = who === 'gk' ? a.bodies.find((b) => b.role === 'gk') : a.bodies.find((b) => b.side === 'D' && b.role !== 'gk');
      a.setPiece = null;
      a.taker = null;
      a.kick = null;
      Object.assign(a.ball, { owner: null, h: 0.5, vh: 1.5, curl: 0, dip: 0, last: by.id, ...ball });
      a.ball.flight = { kind: who === 'gk' ? 'parry' : 'clear', from: by.id, to: null, at: a.t };
      if (who === 'gk') { by.x = ball.x - 1.2; by.y = 104.2; by.act = 'dive'; by.actAt = a.t; by.h = 0.5; }
    }, { who, ball });
    await stage('gk', { x: 39.2, y: 103.6, vx: 2.4, vy: 2.2 });
    await page.waitForTimeout(160);
    await page.screenshot({ path: `${out}/${tag}-parry-wide.png` });
    await page.waitForFunction(() => window.__soccer.a.setPiece?.kind === 'corner' || window.__soccer.a.end, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/${tag}-earned-corner.png` });
    const corner = await page.evaluate(() => { const a = window.__soccer.a; return { setPiece: a.setPiece, restarts: a.restarts ?? 0, end: a.end, clockLeft: a.clock - a.used, taker: a.taker !== null ? a.bodies[a.taker].p.tag : null, ctrlIsTaker: a.ctrl === a.taker }; });
    // take the corner (the autopilot after the wait would too): tap PASS
    const passBtn = page.locator('.sc2-ctl[data-act="pass"], .sc2-ctl[data-act="cross"]').first();
    if (await passBtn.count()) await passBtn.tap({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1600);
    const after = await state(page);
    // a ball off a defender over the touchline in the final third: a quick throw-in
    let thrown = null;
    if (!after.end) {
      await stage('def', { x: 67.6, y: 90, vx: 4, vy: 0.4, h: 0.2, vh: 0 });
      await page.waitForFunction(() => window.__soccer.a.kick?.kind === 'throw' || window.__soccer.a.end, null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${tag}-quick-throw.png` });
      thrown = await page.evaluate(() => { const a = window.__soccer.a; return { kick: a.kick ? { kind: a.kick.kind, to: a.kick.to } : null, restarts: a.restarts ?? 0, end: a.end, ballH: a.ball.h }; });
    }
    report.push({ tag, step: 'restarts', corner, afterCorner: { end: after.end, setPiece: after.setPiece }, thrown, errors });
    errorsAll.push(...errors);
    if (corner.setPiece?.kind !== 'corner' || corner.restarts !== 1 || corner.end || !corner.ctrlIsTaker) errorsAll.push(tag + ': no earned corner ' + JSON.stringify(corner));
    await context.close();
  }
}
// soccer-2 (2026-11-16): the V2 control cluster, HUD kit, toast line and pause, on all six presets.
// C1 (every element against the V2 A.5 tokens, from the DOM), C2 (touch to visible change), C4 (sprint
// held under SHOOT's wind-up), C5 (a thumb down before the whistle), text sizes and overflow, the pause
// (a.t stops for 3 s, RESUME goes on), solo QUIT (the lab's stub gets onQuit's us and them) and the
// online FORFEIT confirm; screenshots of each.
const V2 = {
  393: { a: [92, 323, 738], b: [64, 238, 778], c: [48, 250, 694], d: [48, 340, 652], zone: [0, 189, 383, 818], toast: 618 },
  320: { a: [84, 266, 510], b: [56, 190, 536], c: [44, 200, 468], d: [44, 282, 436], zone: [0, 154, 256, 568], toast: 404 },
};
const rectOf = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, sel);
const overlap = (p, q) => p && q && p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
if (part('layout')) {
  const shots = process.env.PS_QA_SOCCER_SHOTS || out;
  fs.mkdirSync(shots, { recursive: true });
  for (const p of PRESETS) {
    const tag = p.tag;
    const fail = (m) => errorsAll.push(tag + ': ' + m);
    const { context, page, errors, cdp } = await open(p, { seed: 'qa-layout', scenario: 'build', home: 'BAR', hs: '2015', away: 'RMA', as: '2017' });
    await page.waitForSelector('.sc2-ctl.go');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${shots}/${tag}-intro.png` });
    // a frame recorder: the ui, the carrier's position and the match clock, every animation frame
    await page.evaluate(() => { window.__rec = []; const f = () => { const s = window.__soccer; if (s && s.a) { const c = s.a.bodies[s.a.ctrl]; window.__rec.push({ t: performance.now(), ui: s.ui, x: c.x, y: c.y, v: Math.hypot(c.vx, c.vy), at: s.a.t }); } requestAnimationFrame(f); }; requestAnimationFrame(f); });
    // C5: the left thumb goes down (and pushes up) 500 ms before the whistle, then the right thumb kicks off
    const ghost = await rectOf(page, '.ps-stick-ghost');
    await touch(cdp, 'touchStart', [{ x: ghost.cx, y: ghost.cy, id: 1 }]);
    await touch(cdp, 'touchMove', [{ x: ghost.cx, y: ghost.cy - 45, id: 1 }]);
    await page.waitForTimeout(500);
    const go = await rectOf(page, '.sc2-ctl.go');
    // (both thumbs stay down until it's measured: a touchEnd lifts the whole set over CDP)
    await touch(cdp, 'touchStart', [{ x: ghost.cx, y: ghost.cy - 45, id: 1 }, { x: go.cx, y: go.cy, id: 2 }]);
    await page.waitForTimeout(400);
    const c5 = await page.evaluate(C5_OF);
    if (!c5 || c5.movedMs === null || c5.movedMs > 100) fail('C5 pre-held thumb: ' + JSON.stringify(c5));
    // C1: the cluster, zone, bug, pause and toast line from the DOM, live
    await touch(cdp, 'touchEnd', []);
    const dom = {};
    for (const k of ['a', 'b', 'c']) dom[k] = await rectOf(page, '.sc2-ctl-' + k);
    dom.zone = await rectOf(page, '.ps-stick');
    dom.bug = await rectOf(page, '.sc2-bug');
    dom.heat = await page.evaluate(() => { const e = document.querySelector('.sc2-heat'); return e ? e.hidden : null; });
    dom.pause = await rectOf(page, '.sc2-pause');
    dom.toast = await rectOf(page, '.sc2-toast-slot');
    const ins = p.insets;
    const ref = p.w === 393 ? V2[393] : p.w === 320 ? V2[320] : null;
    if (ref) {
      for (const k of ['a', 'b', 'c']) {
        const [d, x, y] = ref[k];
        const r = dom[k];
        // the V2 table is for the owner's bottom inset (34) and the 320 phone's (0): the presets match
        if (!r || Math.abs(r.w - d) > 2 || Math.abs(r.cx - x) > 2 || Math.abs(r.cy - y) > 2) fail('C1 ' + k + ' ' + JSON.stringify(r) + ' want ' + ref[k]);
      }
      const z = dom.zone;
      if (Math.abs(z.x - ref.zone[0]) > 2 || Math.abs(z.x + z.w - ref.zone[1]) > 2 || Math.abs(z.y - ref.zone[2]) > 2 || Math.abs(z.y + z.h - ref.zone[3]) > 2) fail('C1 zone ' + JSON.stringify(z));
      if (Math.abs(dom.toast.y + dom.toast.h - ref.toast) > 2) fail('C1 toast bottom ' + (dom.toast.y + dom.toast.h));
    }
    const bugT = dom.bug.y - ins[0];
    if (bugT < 4 - 0.5 || bugT > 6 + 0.5) fail('C1 bug top = sat + ' + bugT);
    if (dom.pause.w < 44 || dom.pause.h < 44) fail('pause ' + JSON.stringify(dom.pause));
    const gaps = {};
    const g = (p1, q1) => Math.round((Math.hypot(p1.cx - q1.cx, p1.cy - q1.cy) - (p1.w + q1.w) / 2) * 10) / 10;
    gaps.ab = g(dom.a, dom.b);
    gaps.ac = g(dom.a, dom.c);
    for (const [k, v] of Object.entries(gaps)) if (v < 10 - 0.5 || v > 18 + 0.5) fail('gap ' + k + ' ' + v);
    // text and overflow: every visible HUD text is 10 px or more; no label spills out of its button; no page scroll
    const text = await page.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('.sc2 *')) {
        if (!(e instanceof HTMLElement) || !e.offsetParent || e.closest('canvas')) continue;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own && parseFloat(getComputedStyle(e).fontSize) < 10) bad.push(e.className + ' ' + getComputedStyle(e).fontSize);
      }
      const spill = [...document.querySelectorAll('.sc2-ctl')].flatMap((b) => [...b.querySelectorAll('.sc2-ctl-label, .sc2-ctl-sub')].filter((l) => l.getBoundingClientRect().width > b.getBoundingClientRect().width + 1).map((l) => l.textContent));
      return { bad, spill, scrollX: document.documentElement.scrollWidth - innerWidth };
    });
    if (text.bad.length) fail('text under 10 px ' + text.bad.slice(0, 4));
    if (text.spill.length) fail('labels spill ' + text.spill);
    if (text.scrollX > 0) fail('horizontal overflow ' + text.scrollX);
    await page.screenshot({ path: `${shots}/${tag}-cluster.png` });
    // (a live attack for what follows: the one kicked off, or the next if it's over)
    const liveNow = async () => {
      if ((await state(page)).ui !== 'live') {
        await page.waitForSelector('.sc2-ctl.go', { timeout: 15000 }).catch(() => {});
        await page.locator('.sc2-ctl.go').tap({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    };
    // C2: 50 thumbs on the stick: pointerdown to the ring drawn (the frame it's painted in)
    const lat = await page.evaluate(() => { window.__lat = []; const z = document.querySelector('.ps-stick'); const ring = document.querySelector('.ps-stick-ring'); let down = 0; z.addEventListener('pointerdown', (e) => (down = e.timeStamp), true); new MutationObserver(() => { if (ring.style.opacity === '1' && down) { window.__lat.push(performance.now() - down); down = 0; } }).observe(ring, { attributes: true, attributeFilter: ['style'] }); return true; });
    void lat;
    for (let k = 0; k < 50; k++) {
      const x = ghost.cx + ((k * 7) % 30) - 15;
      const y = ghost.cy + ((k * 11) % 30) - 15;
      await touch(cdp, 'touchStart', [{ x, y, id: 10 }]);
      await page.waitForTimeout(40);
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(30);
    }
    const c2 = await page.evaluate(() => { const l = window.__lat.slice().sort((a, b) => a - b); return { n: l.length, p50: Math.round(l[Math.floor(l.length / 2)]), p95: Math.round(l[Math.floor(l.length * 0.95)]) }; });
    if (c2.n < 48 || c2.p95 > 100) fail('C2 ' + JSON.stringify(c2));
    // the toast line never meets the goal mouth (sampled every frame for 2 s of the attack)
    const toastGoal = await page.evaluate(() => new Promise((res) => { let n = 0; let hit = 0; const t0 = performance.now(); const f = () => { const s = window.__soccer; const tEl = document.querySelector('.sc2-toast'); const gm = s && s.view && s.view.goal; if (tEl && gm) { n++; const r = tEl.getBoundingClientRect(); const dpr = 1; void dpr; if (r.x < gm.x + gm.w && gm.x < r.x + r.width && r.y < gm.y + gm.h && gm.y < r.y + r.height) hit++; } if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res({ n, hit }); }; requestAnimationFrame(f); }));
    if (toastGoal.hit) fail('toast over the goal mouth ' + JSON.stringify(toastGoal));
    // pause: the match clock stops for 3 s, the sheet's CONTROLS, then RESUME goes on
    await liveNow();
    const pauseBtn = await rectOf(page, '.sc2-pause');
    await touch(cdp, 'touchStart', [{ x: pauseBtn.cx, y: pauseBtn.cy, id: 20 }]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForSelector('.sc2-sheet');
    const t0 = await page.evaluate(() => window.__soccer.a.t);
    await page.waitForTimeout(3000);
    const t1 = await page.evaluate(() => window.__soccer.a.t);
    await page.screenshot({ path: `${shots}/${tag}-pause.png` });
    await page.getByRole('button', { name: 'CONTROLS' }).tap();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/${tag}-pause-controls.png` });
    const sheetFits = await page.evaluate(() => { const s = document.querySelector('.sc2-sheet'); return s.scrollHeight <= s.clientHeight + 1 || getComputedStyle(s).overflowY === 'auto'; });
    await page.getByRole('button', { name: 'BACK' }).tap();
    await page.getByRole('button', { name: 'RESUME' }).tap();
    await page.waitForTimeout(800);
    const t2 = await page.evaluate(() => window.__soccer.a.t);
    if (t1 !== t0) fail('pause: a.t ran from ' + t0 + ' to ' + t1);
    if (!(t2 > t1)) fail('resume: a.t stuck at ' + t2);
    // solo QUIT: confirm, then the lab's stub has onQuit's us and them
    await touch(cdp, 'touchStart', [{ x: pauseBtn.cx, y: pauseBtn.cy, id: 21 }]);
    await touch(cdp, 'touchEnd', []);
    await page.getByRole('button', { name: 'QUIT MATCH' }).tap();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/${tag}-quit-confirm.png` });
    await page.getByRole('button', { name: 'QUIT', exact: true }).tap();
    await page.waitForTimeout(300);
    const quit = await page.evaluate(() => window.__quit ?? null);
    if (!quit || !quit.us || !quit.them || quit.them.ends.length !== 7) fail('QUIT: onQuit got ' + JSON.stringify(quit));
    report.push({ tag, step: 'layout', c5, c2, dom: Object.fromEntries(Object.entries(dom).map(([k, v]) => [k, v && typeof v === 'object' ? { x: Math.round(v.x), y: Math.round(v.y), w: Math.round(v.w), h: Math.round(v.h), cx: Math.round(v.cx), cy: Math.round(v.cy) } : v])), gaps, text, toastGoal, pause: { t0, t1, t2 }, sheetFits, quit: quit && { us: quit.us.ends, them: quit.them.ends.length }, errors });
    errorsAll.push(...errors);
    await context.close();

    // C4: a counter up the open wing, the left thumb past the ring (sprint), then SHOOT with the right
    // thumb: the speed while SHOOT winds up, against the sprint before it
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-layout-c4', scenario: 'counter', start: '8,45', home: 'BAR', hs: '2015', away: 'RMA', as: '2017' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForTimeout(200);
      const gh = await rectOf(page, '.ps-stick-ghost');
      const speed = () => page.evaluate(() => { const a = window.__soccer.a; const c = a.bodies[a.ctrl]; return { v: Math.hypot(c.vx, c.vy), stamina: a.stamina, sprinting: a.sprinting, owner: a.ball.owner === c.id, meter: !!a.meter, end: !!a.end }; });
      await touch(cdp, 'touchStart', [{ x: gh.cx, y: gh.cy, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: gh.cx, y: gh.cy - 50, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: gh.cx, y: gh.cy - 95, id: 1 }]);
      await page.waitForTimeout(1100);
      const v0 = await speed();
      const sh = await rectOf(page, '.sc2-ctl[data-act="shoot"]');
      let v1 = null;
      let toastInMeter = null;
      if (sh) {
        await touch(cdp, 'touchStart', [{ x: gh.cx, y: gh.cy - 95, id: 1 }, { x: sh.cx, y: sh.cy, id: 3 }]);
        await page.waitForTimeout(300);
        v1 = await speed();
        toastInMeter = await page.locator('.sc2-toast').count();
        await page.screenshot({ path: `${shots}/${tag}-sprint-shoot.png` });
      }
      await touch(cdp, 'touchEnd', []);
      // sprinting drains stamina (engine: top x lerp(0.88, 1, stamina)), so the two speeds are compared at
      // the same stamina: what SHOOT's wind-up itself costs the sprint
      const fresh = (q) => q.v / (0.88 + 0.12 * q.stamina);
      const c4 = { sprint: +v0.v.toFixed(2), underShoot: v1 && +v1.v.toFixed(2), rawRatio: v1 && +(v1.v / v0.v).toFixed(3), ratio: v1 && +(fresh(v1) / fresh(v0)).toFixed(3), before: v0, during: v1 };
      if (!v0.sprinting || !v1 || !v1.meter || !(v1.sprinting)) fail('C4 setup ' + JSON.stringify(c4));
      else if (c4.ratio < 0.85) fail('C4 ' + JSON.stringify(c4));
      if (toastInMeter) fail('the toast line is up while SHOOT is held');
      report.push({ tag, step: 'c4', c4, errors });
      errorsAll.push(...errors);
      await context.close();
    }
    // a free kick: D holds the bend; "FREE KICK" over the meter and "BEND" over the ball never print over each other
    {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-layout-fk', scenario: 'freekick', home: 'LIV', hs: '2019', away: 'MCI', as: '2019' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForSelector('.sc2-ctl[data-act="bend"]');
      const d = await rectOf(page, '.sc2-ctl-d');
      if (ref) {
        const [dd, x, y] = ref.d;
        if (Math.abs(d.w - dd) > 2 || Math.abs(d.cx - x) > 2 || Math.abs(d.cy - y) > 2) fail('C1 d ' + JSON.stringify(d));
      }
      const a = await rectOf(page, '.sc2-ctl-a');
      const gad = Math.round((Math.hypot(a.cx - d.cx, a.cy - d.cy) - (a.w + d.w) / 2) * 10) / 10;
      if (gad < 9.5 || gad > 18.5) fail('gap ad ' + gad);
      await touch(cdp, 'touchStart', [{ x: d.cx, y: d.cy, id: 1 }]);
      await touch(cdp, 'touchEnd', []);
      const sh = await rectOf(page, '.sc2-ctl-a');
      await touch(cdp, 'touchStart', [{ x: sh.cx, y: sh.cy, id: 2 }]);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${shots}/${tag}-freekick-bend.png` });
      await touch(cdp, 'touchEnd', []);
      const targets = await page.locator('.sc2-ctl').count();
      if (targets > 4) fail('more than four right-thumb targets: ' + targets);
      report.push({ tag, step: 'layout-fk', d: { w: Math.round(d.w), cx: Math.round(d.cx), cy: Math.round(d.cy) }, gad, targets, errors });
      errorsAll.push(...errors);
      await context.close();
    }
    // online: the sheet offers FORFEIT (with its confirm), and the lab's stub gets the attacks played
    if (p.tag === '393x852-sat59' || p.tag === '320x568') {
      const { context, page, errors } = await open(p, { seed: 'qa-layout-ff', scenario: 'build', online: '1', home: 'BAR', hs: '2015', away: 'RMA', as: '2017' });
      await page.locator('.sc2-ctl.go').tap({ force: true });
      await page.waitForTimeout(300);
      await page.locator('.sc2-pause').tap();
      const quitShown = await page.getByRole('button', { name: 'QUIT MATCH' }).count();
      await page.getByRole('button', { name: 'FORFEIT' }).tap();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${shots}/${tag}-forfeit-confirm.png` });
      await page.getByRole('button', { name: 'FORFEIT', exact: true }).last().tap();
      await page.waitForTimeout(300);
      const ff = await page.evaluate(() => window.__forfeit ?? null);
      if (!ff || quitShown) fail('online forfeit ' + JSON.stringify({ ff, quitShown }));
      report.push({ tag, step: 'forfeit-sheet', ff, errors });
      errorsAll.push(...errors);
      await context.close();
    }
    // reduced motion: the sheet does not slide in, A does not breathe
    if (p.tag === '393x852-sat59') {
      const { context, page, errors } = await open(p, { seed: 'qa-layout-rm', scenario: 'build' }, { reducedMotion: 'reduce' });
      await page.waitForSelector('.sc2-ctl.go');
      const breathe = await page.evaluate(() => getComputedStyle(document.querySelector('.sc2-ctl.go')).animationName);
      await page.locator('.sc2-pause').tap();
      const slide = await page.evaluate(() => getComputedStyle(document.querySelector('.sc2-sheet')).animationName);
      if (breathe !== 'none' || slide !== 'none') fail('reduced motion: ' + breathe + ' / ' + slide);
      report.push({ tag, step: 'reduced-motion', breathe, slide, errors });
      errorsAll.push(...errors);
      await context.close();
    }
  }
  // the rival's taker (their penalty in a shootout): a violet ring and tag, never our gold
  for (const p of [preset('393x852-sat59'), preset('320x568')]) {
    const { context, page, errors } = await open(p, { seed: 'qa-violet', pens: '1', home: 'BAR', hs: '2015', away: 'LIV', as: '2019' });
    const t0 = Date.now();
    let shot = false;
    while (Date.now() - t0 < 40000 && !shot) {
      const s = await state(page);
      const toast = await page.locator('.sc2-toast').innerText().catch(() => '');
      if (s.ui === 'so-intro' && /THEIR KICK/.test(toast)) {
        await page.locator('.sc2-ctl.go').tap({ force: true, timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${(process.env.PS_QA_SOCCER_SHOTS || out)}/${p.tag}-rival-taker.png` });
        shot = true;
        // soccer-2 re-review: the pause button stays in a shootout; its sheet has no QUIT or FORFEIT, and a.t holds
        await page.locator('.sc2-pause').tap();
        await page.waitForSelector('.sc2-sheet');
        const sheet = await page.locator('.sc2-sheet').innerText();
        const t0 = (await state(page)).t;
        await page.waitForTimeout(800);
        const t1 = (await state(page)).t;
        await page.screenshot({ path: `${(process.env.PS_QA_SOCCER_SHOTS || out)}/${p.tag}-pens-paused.png` });
        if (!/RESUME/.test(sheet) || /QUIT|FORFEIT/.test(sheet) || t1 !== t0) errorsAll.push(p.tag + ': shootout pause ' + JSON.stringify({ sheet, t0, t1 }));
        report.push({ tag: p.tag, step: 'pens-pause', sheet: sheet.split('\n').filter(Boolean), held: t1 === t0 });
        await page.getByRole('button', { name: 'RESUME' }).tap();
      } else if (s.ui === 'so-intro') await page.locator('.sc2-ctl.go').tap({ force: true, timeout: 1500 }).catch(() => {});
      else if (s.ui === 'so-kick' && !s.end && (await page.locator('.sc2-ctl[data-act="shoot"]').count())) {
        const sh = await center(page, '.sc2-ctl[data-act="shoot"]');
        await page.touchscreen.tap(sh.x, sh.y);
      }
      await page.waitForTimeout(300);
    }
    if (!shot) errorsAll.push(p.tag + ': never reached their kick');
    report.push({ tag: p.tag, step: 'rival-taker', shot, errors });
    errorsAll.push(...errors);
    await context.close();
  }
}
// C5 repeated (soccer-2 re-review): one run sits near the 100 ms gate on a loaded machine, so the gate is
// the median of RUNS fresh kick-offs per preset (each run also reported)
if (part('c5')) {
  const RUNS = Number(process.env.PS_QA_C5_RUNS || 5);
  for (const p of PRESETS) {
    const runs = [];
    for (let k = 0; k < RUNS; k++) {
      const { context, page, errors, cdp } = await open(p, { seed: 'qa-c5-' + k, scenario: 'build', home: 'BAR', hs: '2015', away: 'RMA', as: '2017' });
      await page.waitForSelector('.sc2-ctl.go');
      await page.waitForTimeout(500);
      await page.evaluate(() => { window.__rec = []; const f = () => { const s = window.__soccer; if (s && s.a) { const c = s.a.bodies[s.a.ctrl]; window.__rec.push({ t: performance.now(), ui: s.ui, x: c.x, y: c.y, v: Math.hypot(c.vx, c.vy), at: s.a.t }); } requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const ghost = await rectOf(page, '.ps-stick-ghost');
      await touch(cdp, 'touchStart', [{ x: ghost.cx, y: ghost.cy, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: ghost.cx, y: ghost.cy - 45, id: 1 }]);
      await page.waitForTimeout(500);
      const go = await rectOf(page, '.sc2-ctl.go');
      await touch(cdp, 'touchStart', [{ x: ghost.cx, y: ghost.cy - 45, id: 1 }, { x: go.cx, y: go.cy, id: 2 }]);
      await page.waitForTimeout(400);
      runs.push(await page.evaluate(C5_OF));
      if (k === 0) {
        // the stick's keep-out follows the live ring (soccer-2 re-review): the thumb lifts and lands
        // again away from the ghost, and a keep-out rect sits on the ring there, not on the ghost
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(150);
        const at = { x: ghost.cx + 40, y: ghost.cy - 110 };
        await touch(cdp, 'touchStart', [{ x: at.x, y: at.y, id: 5 }]);
        await page.waitForTimeout(120);
        const ringKeep = await page.evaluate((at) => { const c = document.querySelector('.hg2-canvas').getBoundingClientRect(); const k = window.__soccer.view.keep; const W = document.querySelector('.hg2-canvas').width / c.width; const near = k.map((r) => ({ cx: c.left + (r.x + r.w / 2) / W, cy: c.top + (r.y + r.h / 2) / W })).map((q) => Math.hypot(q.cx - at.x, q.cy - at.y)); return Math.round(Math.min(...near)); }, at);
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(150);
        const lifted = await page.evaluate((at) => { const c = document.querySelector('.hg2-canvas').getBoundingClientRect(); const k = window.__soccer.view.keep; const W = document.querySelector('.hg2-canvas').width / c.width; return Math.round(Math.min(...k.map((r) => Math.hypot(c.left + (r.x + r.w / 2) / W - at.x, c.top + (r.y + r.h / 2) / W - at.y)))); }, at);
        if (ringKeep > 3 || lifted < 40) errorsAll.push(p.tag + ': stick keep-out ' + JSON.stringify({ ringKeep, lifted }));
        report.push({ tag: p.tag, step: 'stick-keep', ringKeepOffPx: ringKeep, afterLiftNearestPx: lifted });
      }
      errorsAll.push(...errors);
      await context.close();
    }
    const med = (k) => { const v = runs.map((r) => r?.[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length === runs.length ? v[Math.floor(v.length / 2)] : null; };
    const c5 = { runs: runs.map((r) => r && [r.respondMs, r.movedMs]), respondMedian: med('respondMs'), movedMedian: med('movedMs') };
    if (c5.movedMedian === null || c5.movedMedian > 100) errorsAll.push(p.tag + ': C5 median ' + JSON.stringify(c5));
    report.push({ tag: p.tag, step: 'c5', c5 });
  }
}
await browser.close();
fs.writeFileSync(out + '/report-' + only + '.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
console.log(blockedLine());
console.log('errors', errorsAll.length, errorsAll.slice(0, 5));
process.exitCode = errorsAll.length ? 1 : 0;
