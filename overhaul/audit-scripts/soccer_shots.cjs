// Audit (read-only): screenshots of the soccer lab at phone sizes, with real touch input via CDP.
// Dev server: cd /home/user/ps-studio && npx vite --port 5203 --strictPort
// Run: node soccer_shots.cjs [only]
const { createRequire } = require('node:module');
const req = createRequire('/home/user/ps-studio/package.json');
const { chromium } = req('playwright');
const fs = require('node:fs');
const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/soccer/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5203/';
const only = process.argv[2] || 'all';
const report = {};

async function open(browser, vp, params) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(u.hostname) || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  const url = new URL(BASE);
  url.search = new URLSearchParams({ 'soccer-lab': '1', qa: '1', ns: 'inspect', relay: 'ws://localhost:7777', home: 'BAR', hs: '2015', away: 'RMA', as: '2017', ...params }).toString();
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  if (vp.sat) await page.addStyleTag({ content: `.arcade-full{--sat:${vp.sat}px!important;--sab:${vp.sab}px!important}` });
  await page.waitForFunction(() => window.__soccer && window.__soccer.a, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const cdp = await context.newCDPSession(page);
  return { context, page, errors, cdp };
}
async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: p.id ?? i })) });
}
async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox({ timeout: 3000 }).catch(() => null);
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, top: b.y, left: b.x } : null;
}
const st = (page) => page.evaluate(() => { const s = window.__soccer; const a = s.a; const c = a.bodies[a.ctrl]; return { ui: s.ui, t: +a.t.toFixed(2), end: a.end && a.end.text, ctrl: c.p.tag, cy: +c.y.toFixed(1), owner: a.ball.owner, meter: !!a.meter, sp: a.setPiece && a.setPiece.kind, goals: s.m.goals, ends: s.m.ends.join('') }; });
async function tapSel(page, cdp, sel) {
  const c = await center(page, sel);
  if (!c) return false;
  await touch(cdp, 'touchStart', [c]);
  await touch(cdp, 'touchEnd', []);
  return true;
}
/** element boxes for the overlap/size table */
async function boxes(page) {
  return page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { bug: q('.hg2-bug'), marks: q('.sc2-marks'), hint: q('.sc2-hint'), stick: q('.sc2-stick'), sprint: q('.sc2-sprint'), pass: q('.hg2-pass'), thru: q('.sc2-thru'), shoot: q('.hg2-shoot'), bend: q('.sc2-bend'), readout: q('.play-readout, [class*=readout]'), intro: q('.sc2-intro'), pop: q('.hg2-pop'), vw: innerWidth, vh: innerHeight };
  });
}

const VPS = [
  { tag: '390x844', w: 390, h: 844, sat: 59, sab: 34 },
  { tag: '430x932', w: 430, h: 932, sat: 59, sab: 34 },
  { tag: '320x568', w: 320, h: 568, sat: 20, sab: 0 },
];

(async () => {
  const browser = await chromium.launch();
  for (const vp of VPS) {
    const R = (report[vp.tag] = {});
    if (only === 'all' || only === 'build') {
      const { context, page, errors, cdp } = await open(browser, vp, { seed: 'aud1' });
      await page.waitForSelector('.sc2-go');
      await page.screenshot({ path: OUT + vp.tag + '-01-intro.png' });
      R.introBoxes = await boxes(page);
      await tapSel(page, cdp, '.sc2-go');
      await page.waitForSelector('.sc2-stick');
      await page.waitForTimeout(500);
      await page.screenshot({ path: OUT + vp.tag + '-02-live.png' });
      R.liveBoxes = await boxes(page);
      // stick up-right (pass line shows while the stick is held)
      const stick = await center(page, '.sc2-stick');
      await touch(cdp, 'touchStart', [{ ...stick, id: 1 }]);
      await touch(cdp, 'touchMove', [{ x: stick.x + 25, y: stick.y - 40, id: 1 }]);
      await page.waitForTimeout(600);
      await page.screenshot({ path: OUT + vp.tag + '-03-run-passline.png' });
      R.afterRun = await st(page);
      // hold SHOOT with the stick still held, drag on it toward top-left
      const shoot = await center(page, '.hg2-shoot');
      if (shoot) {
        await touch(cdp, 'touchStart', [{ x: stick.x + 25, y: stick.y - 40, id: 1 }, { ...shoot, id: 3 }]);
        for (let k = 1; k <= 4; k++) await touch(cdp, 'touchMove', [{ x: stick.x + 25, y: stick.y - 40, id: 1 }, { x: shoot.x - 9 * k, y: shoot.y - 8 * k, id: 3 }]);
        await page.waitForTimeout(380);
        await page.screenshot({ path: OUT + vp.tag + '-04-meter-aim.png' });
        R.meter = await st(page);
        await page.waitForTimeout(150);
        await touch(cdp, 'touchEnd', [{ x: stick.x + 25, y: stick.y - 40, id: 1 }]);
        await page.waitForTimeout(250);
        await page.screenshot({ path: OUT + vp.tag + '-05-release.png' });
      }
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(1400);
      await page.screenshot({ path: OUT + vp.tag + '-06-result.png' });
      R.result = await st(page);
      await page.waitForTimeout(2600);
      await page.screenshot({ path: OUT + vp.tag + '-07-after.png' });
      R.errors = errors.slice();
      await context.close();
    }
    for (const sc of ['corner', 'freekick', 'counter', 'wide']) {
      if (only !== 'all' && only !== 'set' && only !== sc) continue;
      const { context, page, errors, cdp } = await open(browser, vp, { seed: 'aud-' + sc, scenario: sc });
      await page.waitForSelector('.sc2-go');
      await tapSel(page, cdp, '.sc2-go');
      await page.waitForTimeout(sc === 'corner' ? 1600 : 700);
      await page.screenshot({ path: OUT + vp.tag + '-10-' + sc + '.png' });
      R[sc + 'Boxes'] = await boxes(page);
      if (sc === 'freekick') {
        const b = await center(page, '.sc2-bend button:last-child');
        if (b) {
          await touch(cdp, 'touchStart', [b]);
          await touch(cdp, 'touchEnd', []);
          await page.waitForTimeout(200);
        }
        const shoot = await center(page, '.hg2-shoot');
        await touch(cdp, 'touchStart', [{ ...shoot, id: 3 }]);
        await touch(cdp, 'touchMove', [{ x: shoot.x + 30, y: shoot.y - 25, id: 3 }]);
        await page.waitForTimeout(400);
        await page.screenshot({ path: OUT + vp.tag + '-11-freekick-meter.png' });
        await page.waitForTimeout(200);
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: OUT + vp.tag + '-12-freekick-result.png' });
      }
      if (sc === 'corner') {
        const pass = await center(page, '.hg2-pass');
        const stick = await center(page, '.sc2-stick');
        await touch(cdp, 'touchStart', [{ ...stick, id: 1 }]);
        await touch(cdp, 'touchMove', [{ x: stick.x + 30, y: stick.y - 10, id: 1 }]);
        await page.waitForTimeout(300);
        await page.screenshot({ path: OUT + vp.tag + '-13-corner-aim.png' });
        await touch(cdp, 'touchStart', [{ x: stick.x + 30, y: stick.y - 10, id: 1 }, { ...pass, id: 2 }]);
        await page.waitForTimeout(350);
        await touch(cdp, 'touchEnd', [{ x: stick.x + 30, y: stick.y - 10, id: 1 }]);
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(900);
        await page.screenshot({ path: OUT + vp.tag + '-14-corner-cross.png' });
      }
      R[sc + 'Errors'] = errors.slice();
      await context.close();
    }
    if (only === 'all' || only === 'pens') {
      const { context, page, errors, cdp } = await open(browser, vp, { seed: 'aud-pens', pens: '1' });
      await page.waitForSelector('.sc2-go');
      await page.screenshot({ path: OUT + vp.tag + '-20-pens-intro.png' });
      await tapSel(page, cdp, '.sc2-go');
      await page.waitForTimeout(700);
      await page.screenshot({ path: OUT + vp.tag + '-21-pens-kick.png' });
      R.pensBoxes = await boxes(page);
      // play the kicks: ours hold SHOOT dragging right; theirs dive left
      for (let k = 0; k < 14; k++) {
        const s = await st(page);
        if (s.ui === 'final') break;
        if (await page.locator('.sc2-go').count()) {
          await tapSel(page, cdp, '.sc2-go');
          await page.waitForTimeout(400);
          continue;
        }
        if (await page.locator('.sc2-dive button').count()) {
          if (k === 1) await page.screenshot({ path: OUT + vp.tag + '-22-pens-dive.png' });
          await tapSel(page, cdp, '.sc2-dive button:first-child');
          await page.waitForTimeout(2600);
          continue;
        }
        const shoot = await center(page, '.hg2-shoot');
        if (shoot && s.ui === 'so-kick') {
          await touch(cdp, 'touchStart', [{ ...shoot, id: 3 }]);
          await touch(cdp, 'touchMove', [{ x: shoot.x + 40, y: shoot.y + 20, id: 3 }]);
          await page.waitForTimeout(600);
          await touch(cdp, 'touchEnd', []);
          await page.waitForTimeout(2600);
          continue;
        }
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: OUT + vp.tag + '-23-pens-end.png' });
      R.pens = await st(page);
      R.pensErrors = errors.slice();
      await context.close();
    }
    if (only === 'all' || only === 'auto') {
      const { context, page, errors } = await open(browser, vp, { seed: 'aud-auto', auto: '1', attacks: '2', slowmo: '1.5' });
      const shots = [];
      const t0 = Date.now();
      let i = 0;
      while (Date.now() - t0 < 70000) {
        const s = await st(page);
        if (s.ui === 'final') break;
        if (i % 6 === 0) await page.screenshot({ path: OUT + vp.tag + '-30-auto-' + String(i).padStart(2, '0') + '.png' });
        i++;
        await page.waitForTimeout(700);
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: OUT + vp.tag + '-39-final.png' });
      R.auto = await st(page);
      R.autoErrors = errors.slice();
      await context.close();
    }
  }
  if (only === 'all' || only === 'land') {
    const vp = { tag: '844x390', w: 844, h: 390, sat: 0, sab: 21 };
    const { context, page, errors, cdp } = await open(browser, vp, { seed: 'aud1' });
    await page.waitForSelector('.sc2-go');
    await page.screenshot({ path: OUT + vp.tag + '-01-intro.png' });
    await tapSel(page, cdp, '.sc2-go');
    await page.waitForTimeout(800);
    await page.screenshot({ path: OUT + vp.tag + '-02-live.png' });
    report.land = { boxes: await boxes(page), errors };
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(OUT + 'report-' + only + '.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1).slice(0, 6000));
})();
