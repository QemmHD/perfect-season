// AUDIT ONLY. Playwright captures of the NBA arcade lab (?arcade) at iPhone sizes, with touch input via
// CDP, load timing and frame timing. Only localhost requests are allowed.
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const fs = require('node:fs');
const SHOTS = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nba';
const BASE = 'http://localhost:5201/';
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/nba-shots.json';
const only = process.argv[2];

const sizes = [
  { name: '390', w: 390, h: 844 },
  { name: '430', w: 430, h: 932 },
  { name: '320', w: 320, h: 568 },
  { name: '844land', w: 844, h: 390 },
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ctxFor(browser, s) {
  const context = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort();
  });
  return context;
}

async function touch(cdp, type, pts) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 8, radiusY: 8, force: 1 })) });
}

async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, top: b.y, left: b.x } : null;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = {};
  for (const s of sizes) {
    if (only && only !== s.name) continue;
    const context = await ctxFor(browser, s);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
    const cdp = await context.newCDPSession(page);
    const t0 = Date.now();
    await page.goto(BASE + '?arcade&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=audit' + s.name + '&level=0.85', { waitUntil: 'domcontentloaded' });
    const tDom = Date.now() - t0;
    await page.waitForSelector('.hg2-canvas', { timeout: 30000 });
    const tCanvas = Date.now() - t0;
    await page.waitForSelector('.hg2-pad', { timeout: 30000 });
    const tPad = Date.now() - t0;
    // the first possession tips off 700 ms after the game exists
    await page.waitForFunction(() => { const em = document.querySelector('.hg2-bug .mid em'); return em && /\d/.test(em.textContent || ''); }, null, { timeout: 30000 });
    const tPlay = Date.now() - t0;
    const r = { tDom, tCanvas, tPad, tPlay };
    await wait(300);
    await page.screenshot({ path: `${SHOTS}/${s.name}-01-tipoff-hint.png` });
    // layout of the controls
    const sel = ['.hg2-bug', '.hg2-marks', '.hg2-look', '.hg2-hint', '.hg2-coach', '.hg2-skills', '.hg2-stick', '.hg2-pass', '.hg2-shoot', '.play-readout-toggle'];
    r.layout = {};
    for (const q of sel) {
      const b = await page.locator(q).first().boundingBox().catch(() => null);
      r.layout[q] = b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    }
    r.skillButtons = await page.$$eval('.hg2-skills button', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), disabled: b.disabled }; }));
    // overlaps between interactive controls
    const boxes = Object.entries(r.layout).filter(([, b]) => b);
    r.overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [na, a] = boxes[i], [nb, b] = boxes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) r.overlaps.push(na + ' x ' + nb);
    }
    // dribble up the floor with the stick (thumb pushed up), two seconds
    const stick = await center(page, '.hg2-stick');
    const shoot = await center(page, '.hg2-shoot');
    const passB = await center(page, '.hg2-pass');
    if (stick && shoot) {
      await touch(cdp, 'touchStart', [{ x: stick.x, y: stick.y, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: stick.x + 6, y: stick.y - stick.h * 0.42, id: 1 }]);
      await wait(1200);
      await page.screenshot({ path: `${SHOTS}/${s.name}-02-dribble-up.png` });
      await touch(cdp, 'touchEnd', []);
      await wait(250);
      // hold SHOOT, capture the meter rising, release near the top
      await touch(cdp, 'touchStart', [{ x: shoot.x, y: shoot.y, id: 2 }]);
      await wait(320);
      await page.screenshot({ path: `${SHOTS}/${s.name}-03-meter-rising.png` });
      await wait(170);
      await touch(cdp, 'touchEnd', []);
      await wait(120);
      await page.screenshot({ path: `${SHOTS}/${s.name}-04-release-result.png` });
      await wait(900);
      await page.screenshot({ path: `${SHOTS}/${s.name}-05-shot-outcome.png` });
      // wait for the next possession
      await page.waitForFunction(() => !document.querySelector('.hg2-pass')?.hasAttribute('disabled'), null, { timeout: 15000 }).catch(() => null);
      await wait(1200);
      // a drive at the rim with the stick at its edge (sprint), then SHOOT for the finish
      await touch(cdp, 'touchStart', [{ x: stick.x, y: stick.y, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: stick.x + 4, y: stick.y - stick.h * 0.6, id: 1 }]);
      await wait(1500);
      await page.screenshot({ path: `${SHOTS}/${s.name}-06-sprint-drive.png` });
      await touch(cdp, 'touchStart', [{ x: stick.x + 4, y: stick.y - stick.h * 0.6, id: 1 }, { x: shoot.x, y: shoot.y, id: 2 }]);
      await wait(250);
      await page.screenshot({ path: `${SHOTS}/${s.name}-07-finish-gather.png` });
      await touch(cdp, 'touchEnd', []);
      await wait(700);
      await page.screenshot({ path: `${SHOTS}/${s.name}-08-finish-result.png` });
      await page.waitForFunction(() => !document.querySelector('.hg2-pass')?.hasAttribute('disabled'), null, { timeout: 15000 }).catch(() => null);
      await wait(1000);
      // a skill move (CROSS) and a coach call (SCREEN)
      const cross = await center(page, '.hg2-skills button');
      if (cross) {
        await touch(cdp, 'touchStart', [{ x: cross.x, y: cross.y, id: 3 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(140);
        await page.screenshot({ path: `${SHOTS}/${s.name}-09-crossover.png` });
      }
      const coach = await center(page, '.hg2-coach button');
      if (coach) {
        await wait(600);
        await touch(cdp, 'touchStart', [{ x: coach.x, y: coach.y, id: 4 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(900);
        await page.screenshot({ path: `${SHOTS}/${s.name}-10-screen-call.png` });
      }
      // PASS
      if (passB) {
        await touch(cdp, 'touchStart', [{ x: passB.x, y: passB.y, id: 5 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(250);
        await page.screenshot({ path: `${SHOTS}/${s.name}-11-pass.png` });
      }
      // LAST PLAY readout
      const lp = await center(page, '.play-readout-toggle');
      if (lp) {
        await touch(cdp, 'touchStart', [{ x: lp.x, y: lp.y, id: 6 }]);
        await touch(cdp, 'touchEnd', []);
        await wait(300);
        await page.screenshot({ path: `${SHOTS}/${s.name}-12-lastplay.png` });
      }
    }
    // frame timing: 5 s of rAF intervals, normal and with a 4x CPU slowdown (a mid-range phone)
    const sampleFrames = async () =>
      page.evaluate(
        () =>
          new Promise((res) => {
            const ts = [];
            const t0 = performance.now();
            const f = (t) => {
              ts.push(t);
              if (t - t0 < 5000) requestAnimationFrame(f);
              else {
                const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
                const q = (k) => +d[Math.floor(k * (d.length - 1))].toFixed(1);
                res({ frames: d.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +d[d.length - 1].toFixed(1), over20: d.filter((x) => x > 20).length, over33: d.filter((x) => x > 33.4).length });
              }
            };
            requestAnimationFrame(f);
          })
      );
    if (s.name === '390') {
      r.frames1x = await sampleFrames();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      r.frames4x = await sampleFrames();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      // heap
      r.heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + ' MB' : null));
    }
    r.errors = errors;
    results[s.name] = r;
    console.log(s.name, JSON.stringify(r));
    await context.close();
  }
  fs.writeFileSync(OUT + (only ? '.' + only : ''), JSON.stringify(results, null, 1));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
