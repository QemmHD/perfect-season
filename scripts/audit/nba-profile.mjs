// Where an NBA frame's time goes (nba-3 review, Claude 2026-11-17): an autoplay lab game at each size,
// 1x and 4x CPU, 8 s a sample.
//  - inside the game's rAF callback: the renderer's parts, timed by wrapping the live renderer's own
//    methods (the camera `follow`, the floor `drawFloorNow` + `drawBoard`, the players' drawings
//    `sprite` (look-up or build), the rim and ball `drawRim` + `drawBall`, the HUD on the canvas
//    `hud.over` + `hud.ball`); "draw: rest" is the rest of `draw` (the sprites' drawImage, shadows,
//    the chips' layout and paint); "sim + React" is the callback outside `draw`
//  - outside it, from a devtools timeline trace: style, layout, paint, compositing and GC
// Per frame means: the total over the sample / the frames drawn.
//   node scripts/audit/nba-profile.mjs [size…]   (default 430 320 852land)
import { context, launch, needServer, openLab, report, wait } from './nba-lib.mjs';

const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['430', '320', '852land'];
const PARTS = { follow: 'camera', drawFloorNow: 'floor', drawBoard: 'floor', sprite: 'sprites (build/look-up)', drawRim: 'rim + ball', drawBall: 'rim + ball' };
const TRACE = {
  RecalculateStyles: 'style',
  UpdateLayoutTree: 'style',
  Layout: 'layout',
  PrePaint: 'paint',
  Paint: 'paint',
  PaintImage: 'paint',
  RasterTask: 'raster (other threads)',
  UpdateLayer: 'composite',
  UpdateLayerTree: 'composite',
  Layerize: 'composite',
  CompositeLayers: 'composite',
  'Commit': 'composite',
  MinorGC: 'gc',
  MajorGC: 'gc',
  'V8.GC_SCAVENGER': 'gc',
  'V8.GC_MARK_COMPACTOR': 'gc',
};

async function sample(page, cdp, ms) {
  await page.evaluate(() => window.__prof.reset());
  const events = [];
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8', transferMode: 'ReportEvents' });
  await wait(ms);
  const inPage = await page.evaluate(() => window.__prof.read());
  await cdp.send('Tracing.end');
  await done;
  cdp.removeAllListeners('Tracing.dataCollected');
  const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const outside = {};
  for (const e of events) {
    const k = TRACE[e.name];
    if (!k || e.ph !== 'X' || !e.dur) continue;
    if (k !== 'raster (other threads)' && main && (e.pid !== main.pid || e.tid !== main.tid)) continue;
    outside[k] = (outside[k] ?? 0) + e.dur / 1000;
  }
  const n = Math.max(1, inPage.frames);
  const per = (x) => +(x / n).toFixed(3);
  const parts = Object.fromEntries(Object.entries(inPage.parts).map(([k, v]) => [k, per(v)]));
  return {
    frames: inPage.frames,
    callbackMs: per(inPage.callback),
    'sim + React (callback outside draw)': per(inPage.callback - inPage.draw),
    drawMs: per(inPage.draw),
    ...parts,
    'draw: rest (sprite drawImage, shadows, chips)': per(inPage.draw - Object.values(inPage.parts).reduce((a, x) => a + x, 0)),
    outsideCallbackMsPerFrame: Object.fromEntries(Object.entries(outside).map(([k, v]) => [k, per(v)])),
  };
}

await needServer();
const browser = await launch();
const out = {};
try {
  for (const size of sizes) {
    const { ctx, page, cdp, errors } = await context(browser, size);
    await ctx.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      const P = { frames: 0, callback: 0, draw: 0, parts: {} };
      window.__prof = {
        reset() {
          P.frames = 0;
          P.callback = 0;
          P.draw = 0;
          P.parts = {};
        },
        read: () => JSON.parse(JSON.stringify(P)),
        P,
      };
      window.requestAnimationFrame = (f) =>
        raf((t) => {
          const a = performance.now();
          f(t);
          P.callback += performance.now() - a;
          P.frames++;
        });
    });
    await openLab(page, { auto: '', seed: 'perf' });
    await page.evaluate((PARTS) => {
      const r = window.__hg2.renderer();
      const P = window.__prof.P;
      const wrap = (obj, name, label) => {
        const fn = obj[name];
        if (typeof fn !== 'function') return;
        obj[name] = function (...args) {
          const a = performance.now();
          try {
            return fn.apply(this, args);
          } finally {
            P.parts[label] = (P.parts[label] ?? 0) + performance.now() - a;
          }
        };
      };
      for (const [name, label] of Object.entries(PARTS)) wrap(r, name, label);
      if (r.hud) {
        wrap(r.hud, 'over', 'HUD on the canvas');
        wrap(r.hud, 'ball', 'HUD on the canvas');
      }
      const draw = r.draw;
      r.draw = function (...args) {
        const a = performance.now();
        try {
          return draw.apply(this, args);
        } finally {
          P.draw += performance.now() - a;
        }
      };
    }, PARTS);
    await wait(1500);
    const x1 = await sample(page, cdp, 8000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const x4 = await sample(page, cdp, 8000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    out[size] = { '1x': x1, '4x': x4, errors };
    console.log(size, JSON.stringify(out[size]));
    await ctx.close();
  }
} finally {
  await browser.close();
}
report('nba-profile', out);
