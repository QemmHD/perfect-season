// Claude, 2026-11-01: browser QA for the dev-only soccer lab (?soccer-lab). Portrait phones, real
// touch input through CDP (Input.dispatchTouchEvent), screenshots of each stage, page errors and
// frame time. Needs the dev server: PS_QA_URL=http://localhost:5187/ node scripts/qa/soccer-lab.mjs [part]
// 2026-11-02: SHOOT is held and dragged to aim (the stick keeps running); the report has the aim the
// drag set, whether the shot was assisted, and the run speed while the meter was up.
// Studio overhaul soccer-1 (2026-11-10): every context goes through scripts/soccer/qa-isolate.mjs
// (live hosts aborted and counted, the safe-area insets injected, ?ns=inspect&relay=ws://localhost:7777).
// The play parts run on the owner's phone (393x852, Dynamic Island 59/34) and the smallest (320x568);
// `smoke` opens the lab on all six presets (page errors, the computed --sat, a live-host probe that
// must be blocked). Parts: all | smoke | play | buttons | auto | sets | pens.
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
if (part('smoke')) {
  // every preset: the lab loads with no page error, the injected insets reach .arcade-full, and a
  // request and a WebSocket to a live host from the page are both stopped (and counted)
  for (const p of PRESETS) {
    const before = blocked.count;
    const { context, page, errors } = await open(p, { seed: 'qa-smoke', scenario: 'freekick' });
    await page.waitForSelector('.sc2-go');
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
    await page.waitForSelector('.sc2-go');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${tag}-kickoff.png` });
    const go = await center(page, '.sc2-go');
    await touch(cdp, 'touchStart', [go]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForSelector('.sc2-stick');
    const s0 = await state(page);
    const stick = await center(page, '.sc2-stick');
    const sprint = await center(page, '.sc2-sprint');
    // forward (up the screen) with sprint: two fingers at once
    await touch(cdp, 'touchStart', [{ ...stick, id: 1 }]);
    await touch(cdp, 'touchMove', [{ x: stick.x, y: stick.y - 50, id: 1 }]);
    await touch(cdp, 'touchStart', [{ x: stick.x, y: stick.y - 50, id: 1 }, { ...sprint, id: 2 }]);
    await page.waitForTimeout(700);
    const s1 = await state(page);
    await page.screenshot({ path: `${out}/${tag}-attack.png` });
    // to the right
    await touch(cdp, 'touchMove', [{ x: stick.x + 50, y: stick.y, id: 1 }, { ...sprint, id: 2 }]);
    await page.waitForTimeout(450);
    const s2 = await state(page);
    await touch(cdp, 'touchEnd', [{ ...sprint, id: 2 }]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(400);
    const s3 = await state(page);
    const ft = await frameTime(page, 2000);
    // hold SHOOT, screenshot the meter, let go near the top
    let s4 = await state(page);
    if ((await page.locator('.hg2-shoot').count()) && s4.ball.owner !== null && !s4.end) {
      const shoot = await center(page, '.hg2-shoot');
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
    await page.locator('.sc2-go').tap();
    await page.waitForSelector('.hg2-pass');
    const before = await state(page);
    const pb = await center(page, '.hg2-pass');
    await touch(cdp, 'touchStart', [pb]);
    await page.waitForTimeout(60);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(1400);
    const afterPass = await state(page);
    let thru = null;
    if (!afterPass.end && (await page.locator('.sc2-thru').count())) {
      await page.locator('.sc2-thru').tap();
      await page.waitForTimeout(1600);
      thru = await state(page);
    }
    // carry it toward goal, then shoot
    const st = await center(page, '.sc2-stick').catch(() => null);
    let shot = null;
    if (st && !(await state(page)).end) {
      await touch(cdp, 'touchStart', [{ ...st, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: st.x, y: st.y - 50, id: 1 }]);
      await page.waitForTimeout(900);
      await touch(cdp, 'touchEnd', []);
      if ((await page.locator('.hg2-shoot').count()) && !(await state(page)).end) {
        const sh = await center(page, '.hg2-shoot');
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
      await page.waitForSelector('.sc2-go');
      await page.waitForTimeout(700);
      await page.locator('.sc2-go').tap();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${tag}-${sc}.png` });
      report.push({ tag, step: sc, s: await state(page), errors });
      errorsAll.push(...errors);
      await context.close();
    }
  }
  if (part('pens')) {
    const { context, page, errors, cdp } = await open(p, { seed: 'qa-pens', pens: '1' });
    await page.waitForSelector('.sc2-go');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${tag}-shootout.png` });
    let kicks = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const s = await state(page);
      if (s.ui === 'final') break;
      if (s.ui === 'so-intro' && (await page.locator('.sc2-go').count())) {
        await page.locator('.sc2-go').tap({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300);
        continue;
      }
      if (s.ui === 'so-kick' && (await page.locator('.hg2-shoot').count()) && !s.meter && !s.end) {
        const st = await center(page, '.sc2-stick').catch(() => null);
        const sh = await center(page, '.hg2-shoot').catch(() => null);
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
}
await browser.close();
fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
console.log(blockedLine());
console.log('errors', errorsAll.length, errorsAll.slice(0, 5));
process.exitCode = errorsAll.length ? 1 : 0;
