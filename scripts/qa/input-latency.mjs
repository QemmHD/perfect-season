// Claude (studio overhaul, shell-6, 2026-11-16): in-game input latency. How long from a thumb on a
// match control to the picture answering it, per action and sport. shell measures and reports; the
// input and animation code belongs to nba, nfl, soccer and players (shell's code is not in the input
// path: the curtain is gone before play and adds no listener to the arena).
//
//   node scripts/qa/input-latency.mjs [--sports nba,nfl,soccer] [--n 20] [--cpu 1,4] [--label after]
//        [--match-s 120]
//
// A Squad Battles match (rung 1; the same Arcade and engine as a draft match vs the AI), isolated like
// every shell run. Real touches through CDP Input.dispatchTouchEvent, at the control's centre:
//   nba     pass (PASS), shoot (SHOOT press), juke (CROSS), sprint (the stick pushed to its edge)
//   nfl     snap (SNAP), throw (a PASS TO receiver), scramble (RUN IT), juke (JUKE), burst (BURST press),
//           stiff-arm (POWER)
//   soccer  pass (PASS), shoot (SHOOT press), through (THRU), sprint (SPRINT press)
// Each input gets three numbers:
//   paint     Event Timing: the touch's pointerdown/touchstart `duration`, from the input to the next
//             paint after its handlers ran. The engines take input in the handler and draw in their
//             next rAF, so this is the first frame that can show it (a floor for the visible answer).
//   frame     the first rAF frame after the handler ran (page time), minus the input.
//   visible   a CDP screencast around the input: the first painted frame after it whose change from the
//             frame before it, in a window around the control's player (the lower two thirds of the
//             stage), exceeds the largest frame-to-frame change of the 300 ms before the input by 50%
//             and by 6 luma levels. Background motion (the crowd, the dribble) sets that bar per input,
//             so "visible" is the first frame where something more than the usual motion happens.
//             null when nothing stood out within 500 ms (a press whose answer is a meter or a pose
//             that builds slowly).
// p50/p95 per action at each CPU rate. Output: <PS_QA_SHOTS>/shell-6/latency/latency-<label>.json and
// one frame strip per action and sport as evidence.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, base, fixture, launch } from './browser.mjs';
import { percentile } from './edge-lib.mjs';
import { openUt, waitForHome } from './fixtures.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const sports = opt('sports', 'nba,nfl,soccer').split(',');
const N = +opt('n', 20);
const cpus = opt('cpu', '1,4').split(',').map(Number);
const label = opt('label', 'after');
const matchS = +opt('match-s', 150);
const OUT = path.join(process.env.PS_QA_SHOTS || path.join(artifacts, 'shots'), 'shell-6', 'latency');
fs.mkdirSync(OUT, { recursive: true });
const ctxOpts = { isMobile: true, hasTouch: true };
const opts = { insets: [59, 0, 34, 0], height: 852, serialized: true };
const r1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

/** The controls per sport: a selector, the gesture, and how long a press is held. */
const ACTIONS = {
  nba: [
    { name: 'pass', sel: '.hg2-pass', kind: 'tap' },
    { name: 'shoot', sel: '.hg2-shoot', kind: 'hold', ms: 380 },
    { name: 'juke', sel: '.hg2-skills button[aria-label="Cross over"]', kind: 'tap' },
    { name: 'sprint', sel: '.hg2-stick', kind: 'push' },
  ],
  nfl: [
    { name: 'snap', sel: '.fb2-tray button, button', text: /^(SNAP|GO FOR IT)$/, kind: 'tap' },
    { name: 'throw', sel: '.fb2-receivers button', kind: 'tap' },
    { name: 'scramble', sel: '.fb2-mv.scramble', kind: 'tap' },
    { name: 'juke', sel: '.fb2-mv.juke', kind: 'tap' },
    { name: 'burst', sel: '.fb2-burst', kind: 'hold', ms: 500 },
    { name: 'stiff-arm', sel: '.fb2-mv.power', kind: 'tap' },
  ],
  soccer: [
    { name: 'pass', sel: 'button[aria-label^="Pass:"]', kind: 'tap' },
    { name: 'through', sel: 'button[aria-label="Through ball"]', kind: 'tap' },
    { name: 'sprint', sel: 'button[aria-label="Sprint: hold"]', kind: 'hold', ms: 500 },
    { name: 'shoot', sel: 'button[aria-label^="Shoot:"]', kind: 'hold', ms: 420 },
  ],
};

function recorder() {
  const lat = (window.__lat = { frames: [], events: [] });
  const loop = (t) => {
    lat.frames.push(t);
    if (lat.frames.length > 4000) lat.frames.splice(0, 2000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (/^(pointerdown|touchstart|pointerup|touchend)$/.test(e.name)) lat.events.push({ name: e.name, start: e.startTime, ps: e.processingStart, pe: e.processingEnd, dur: e.duration });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {
    /* no Event Timing */
  }
}

let helper = null;
/** Per frame: the largest change from the previous frame in the stage's lower two thirds (mean abs luma, 8×8 blocks). */
async function diffs(browser, jpegs) {
  if (!helper) {
    helper = await (await browser.newContext()).newPage();
    await helper.setContent('<canvas id=c></canvas>');
  }
  return helper.evaluate(async (list) => {
    const c = document.getElementById('c');
    const g = c.getContext('2d', { willReadFrequently: true });
    let prev = null;
    const out = [];
    for (const src of list) {
      const bmp = await createImageBitmap(await (await fetch(src)).blob());
      c.width = bmp.width;
      c.height = bmp.height;
      g.drawImage(bmp, 0, 0);
      const y0 = Math.floor(bmp.height * 0.33);
      const h = Math.floor(bmp.height * 0.45);
      const d = g.getImageData(0, y0, bmp.width, h).data;
      const bw = 8;
      const cols = Math.floor(bmp.width / bw);
      const rows = Math.floor(h / bw);
      const cur = new Float32Array(cols * rows);
      for (let y = 0; y < rows * bw; y++)
        for (let x = 0; x < cols * bw; x++) {
          const i = (y * bmp.width + x) * 4;
          cur[Math.floor(y / bw) * cols + Math.floor(x / bw)] += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        }
      for (let i = 0; i < cur.length; i++) cur[i] /= bw * bw;
      let m = 0;
      if (prev) for (let i = 0; i < cur.length; i++) m = Math.max(m, Math.abs(cur[i] - prev[i]));
      out.push(Math.round(m * 10) / 10);
      prev = cur;
    }
    return out;
  }, jpegs);
}

async function touch(cdp, type, x, y) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 6, radiusY: 6, force: 1, id: 1 }] });
}

/** The visible, enabled control for an action, and its centre (screen px). */
const find = (page, a) =>
  page.evaluate(
    ({ sel, text }) => {
      for (const el of document.querySelectorAll('body > .arcade-full ' + sel.split(', ').join(', body > .arcade-full '))) {
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
        if (text && !new RegExp(text).test(el.textContent.trim())) continue;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width < 8 || r.height < 8 || s.visibility === 'hidden' || +s.opacity < 0.2) continue;
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!hit || !(hit === el || el.contains(hit))) continue;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
      }
      return null;
    },
    { sel: a.sel, text: a.text?.source }
  );

async function toMatch(page) {
  await openUt(page);
  await page.locator('.ut-tabs button').filter({ hasText: /^PLAY$/ }).click();
  await page.locator('.hq-mode').filter({ hasText: /SQUAD BATTLES/ }).click();
  await page.getByRole('button', { name: /^Rung 1:/ }).click();
  await page.getByRole('button', { name: /^PLAY\s+\S/ }).first().click({ timeout: 30000 });
  await page.locator('.arc-kick button.big.shine, .arc-kick .arc-btns button').filter({ hasText: /^PLAY$/ }).first().click({ timeout: 60000 });
  await page.locator('body > .arcade-full').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.arena-curtain'), null, { timeout: 30000 });
}

async function run(browser, sport, cpu) {
  const f = await fixture(browser, sport, 'Shell QA', 393, ctxOpts, opts);
  await f.context.addInitScript(recorder);
  const u = new URL(base);
  u.search = new URLSearchParams({ sport, ns: 'inspect', relay: 'ws://localhost:7777' });
  await f.page.goto(u.href, { waitUntil: 'domcontentloaded' });
  const { page } = f;
  const out = { sport, cpu, actions: {} };
  const cdp = await f.context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (e) => {
    frames.push({ wall: e.metadata.timestamp * 1000, data: e.data });
    if (frames.length > 400) frames.splice(0, 100);
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  try {
    await waitForHome(page);
    await toMatch(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 });
    const origin = await page.evaluate(() => performance.timeOrigin);
    const acts = ACTIONS[sport];
    const counts = Object.fromEntries(acts.map((a) => [a.name, 0]));
    const samples = Object.fromEntries(acts.map((a) => [a.name, []]));
    const end = Date.now() + matchS * 1000;
    let strip = {};
    while (Date.now() < end && acts.some((a) => counts[a.name] < N)) {
      if (!(await page.locator('body > .arcade-full').count())) break;
      let did = false;
      for (const a of acts) {
        if (counts[a.name] >= N) continue;
        const at = await find(page, a);
        if (!at) continue;
        did = true;
        const t0 = await page.evaluate(() => performance.now());
        if (a.kind === 'push') {
          await touch(cdp, 'touchStart', at.x, at.y);
          await page.waitForTimeout(120);
        }
        const tIn = await page.evaluate(() => performance.now());
        if (a.kind === 'push') await touch(cdp, 'touchMove', at.x + at.w * 0.48, at.y - at.w * 0.1);
        else await touch(cdp, 'touchStart', at.x, at.y);
        await page.waitForTimeout(a.kind === 'hold' ? a.ms : a.kind === 'push' ? 450 : 60);
        await touch(cdp, 'touchEnd', at.x, at.y);
        await page.waitForTimeout(500);
        const { events, rafs } = await page.evaluate((t) => ({ events: window.__lat.events.filter((e) => e.start >= t - 5), rafs: window.__lat.frames.filter((x) => x >= t - 400) }), a.kind === 'push' ? tIn : t0);
        // Event Timing: the first press-type entry at or after the input
        const ev = events.find((e) => (a.kind === 'push' ? /pointermove|touchmove|pointerdown|touchstart/ : /pointerdown|touchstart/).test(e.name));
        const handled = ev ? ev.pe : null;
        const frameAfter = handled !== null ? rafs.find((x) => x >= handled) : null;
        // the screencast around the input
        const win = frames.filter((x) => x.wall - origin >= tIn - 320 && x.wall - origin <= tIn + 520);
        let visible = null;
        if (win.length > 3) {
          const ds = await diffs(browser, win.map((x) => 'data:image/jpeg;base64,' + x.data));
          const before = ds.filter((_, i) => i > 0 && win[i].wall - origin < tIn);
          const bar = Math.max(6, (before.length ? Math.max(...before) : 0) * 1.5);
          const k = win.findIndex((x, i) => x.wall - origin >= tIn && ds[i] > bar);
          if (k >= 0) {
            visible = win[k].wall - origin - tIn;
            if (!strip[a.name]) {
              strip[a.name] = true;
              fs.writeFileSync(path.join(OUT, `${label}-${sport}-${cpu}x-${a.name}-before.jpg`), Buffer.from(win[Math.max(0, k - 1)].data, 'base64'));
              fs.writeFileSync(path.join(OUT, `${label}-${sport}-${cpu}x-${a.name}-answer-${Math.round(visible)}ms.jpg`), Buffer.from(win[k].data, 'base64'));
            }
          }
        }
        samples[a.name].push({ paint: ev ? r1(ev.dur) : null, frame: frameAfter !== null && frameAfter !== undefined ? r1(frameAfter - tIn) : null, visible: r1(visible) });
        counts[a.name]++;
        await page.waitForTimeout(250);
      }
      if (!did) await page.waitForTimeout(300);
    }
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    for (const a of acts) {
      const s = samples[a.name];
      const col = (k) => s.map((x) => x[k]).filter((v) => v !== null);
      out.actions[a.name] = {
        n: s.length,
        paint: { p50: percentile(col('paint'), 50), p95: percentile(col('paint'), 95) },
        frame: { p50: percentile(col('frame'), 50), p95: percentile(col('frame'), 95) },
        visible: { p50: percentile(col('visible'), 50), p95: percentile(col('visible'), 95), seen: col('visible').length },
      };
    }
    out.errors = f.errors;
    out.blocked = [...new Set(f.blocked)];
  } catch (e) {
    out.fail = e.message.split('\n')[0];
    await page.screenshot({ path: path.join(OUT, `fail-${label}-${sport}-${cpu}x.png`) }).catch(() => {});
  } finally {
    await f.context.close();
  }
  return out;
}

const browser = await launch();
const report = { at: new Date().toISOString(), base, label, n: N, runs: [] };
for (const sport of sports)
  for (const cpu of cpus) {
    const r = await run(browser, sport, cpu);
    report.runs.push(r);
    console.log(JSON.stringify(r));
  }
await browser.close();
const file = path.join(OUT, `latency-${label}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 1));
console.log('report:', file);
