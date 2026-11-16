// Players QA (studio overhaul, players-2): every sprite blit at a whole number of device pixels.
// The page's drawImage is instrumented before the app loads: for each blit of a player sprite (a
// small canvas drawn onto the game canvas) it records the device px per sprite px (the destination
// scale x the context's transform x the game canvas's device px per canvas px) and the device px
// position of the sprite's corner. A sprite is at a whole device scale when both are whole numbers
// (within 0.01). Run per art-pixel option, DPR 1, 2 and 3, at 393 and 320.
//
//   node scripts/qa/players-artpx.mjs [--sport nba,nfl,soccer] [--options A,C] [--dpr 1,2,3] [--vp 393,320]
//        [--secs 4] [--tag p2] [--out DIR]
import { emit, listOf, matchUrl, needServer, newContext, opts, shot, SPORTS, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const options = listOf(opts.options, ['A', 'C']);
const dprs = listOf(opts.dpr, ['1', '2', '3']).map(Number);
const vps = listOf(opts.vp, ['393', '320']);
const secs = Number(opts.secs ?? 4);
const tag = String(opts.tag ?? 'p2');

function hooks() {
  const S = (window.__psArt = { blits: 0, scaleOff: 0, posOff: 0, scales: {}, worst: [] });
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    const cv = this.canvas;
    // player sprites: small offscreen canvases drawn onto the on-screen game canvas
    if (img instanceof HTMLCanvasElement && cv && cv.isConnected && img.width < 260 && img.height < 400 && img !== cv && (a.length === 2 || a.length === 4)) {
      const r = cv.getBoundingClientRect();
      const devPerCanvas = (r.width * devicePixelRatio) / cv.width;
      const m = this.getTransform();
      const sx = a.length === 4 ? a[2] / img.width : 1;
      const scale = sx * Math.hypot(m.a, m.b) * devPerCanvas;
      const x = (m.a * a[0] + m.c * a[1] + m.e) * devPerCanvas;
      const y = (m.b * a[0] + m.d * a[1] + m.f) * devPerCanvas;
      const off = (v) => Math.abs(v - Math.round(v)) > 0.01;
      S.blits++;
      const k = round2(scale);
      S.scales[k] = (S.scales[k] ?? 0) + 1;
      if (off(scale)) S.scaleOff++;
      if (off(x) || off(y)) S.posOff++;
      if ((off(scale) || off(x) || off(y)) && S.worst.length < 5) S.worst.push({ scale: round2(scale), x: round2(x), y: round2(y), w: img.width, h: img.height });
    }
    return orig.call(this, img, ...a);
  };
  function round2(v) {
    return Math.round(v * 1000) / 1000;
  }
}

await needServer();
const runs = await withBrowser(async (browser) => {
  const out = [];
  for (const option of options)
    for (const sport of sports)
      for (const vp of vps)
        for (const dpr of dprs) {
          const context = await newContext(browser, vp, { dpr });
          await context.addInitScript(hooks);
          const page = await context.newPage();
          const errors = watchErrors(page);
          await page.goto(matchUrl(sport, { seed: 'artpx', extra: { artpx: option } }), { waitUntil: 'load' });
          await page.waitForSelector('canvas', { timeout: 120000 });
          await wait(2500);
          await page.evaluate(() => Object.assign(window.__psArt, { blits: 0, scaleOff: 0, posOff: 0, scales: {}, worst: [] }));
          await wait(secs * 1000);
          const s = await page.evaluate(() => window.__psArt);
          const canvas = await page.evaluate(() => {
            const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
            const r = c.getBoundingClientRect();
            return { w: c.width, h: c.height, cssW: Math.round(r.width * 10) / 10, devPerCanvas: Math.round(((r.width * devicePixelRatio) / c.width) * 1000) / 1000 };
          });
          const file = dpr === 3 && vp === '393' ? await shot(page, `${tag}-artpx-${option}-${sport}-${vp}-dpr${dpr}`) : null;
          out.push({ option, sport, vp, dpr, canvas, blits: s.blits, nonIntegerScale: s.scaleOff, nonIntegerPos: s.posOff, scales: s.scales, worst: s.worst, shot: file, pageErrors: errors.slice(0, 3) });
          await context.close();
        }
  return out;
});
const by = (o) => runs.filter((r) => r.option === o);
emit('players-artpx-' + tag, {
  summary: Object.fromEntries(options.map((o) => [o, { runs: by(o).length, blits: by(o).reduce((a, r) => a + r.blits, 0), nonIntegerScale: by(o).reduce((a, r) => a + r.nonIntegerScale, 0), nonIntegerPos: by(o).reduce((a, r) => a + r.nonIntegerPos, 0) }])),
  runs: runs.map((r) => ({ ...r, scales: Object.fromEntries(Object.entries(r.scales).map(([k, v]) => [k, v])) })),
});
