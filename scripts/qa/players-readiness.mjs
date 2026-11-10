// Players QA (studio overhaul, players-1): is the match ready when its first frame is drawn?
// From the audit's coldstart.cjs/matchperf.cjs LOAD numbers (P-5, NBA-30): the time from opening the
// match (navigation to the autoplay bench) to its first drawn frame, when the motion-capture clips and
// (from players-4) the appearance data arrive, and how many frames were drawn before they did: those
// frames show hand-keyed stand-in poses and default looks, then pop.
//
// Until the renderer exposes `window.__pixelDebug` (players-2: stand-in poses and default looks drawn,
// counted exactly), stand-in frames are counted from clip arrival: game frames drawn before the last
// clip chunk finished loading. When `__pixelDebug` exists its counters are reported too.
//
//   node scripts/qa/players-readiness.mjs [--sport nba,nfl,soccer] [--cpu 1,4] [--runs 3] [--vp 393]
//        [--after 4] [--tag before] [--out DIR]
// Each run is a fresh browser context (empty HTTP cache); the median of the runs is reported.
import { cpu, emit, listOf, matchUrl, needServer, newContext, opts, quantile, shot, SPORTS, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const rates = listOf(opts.cpu, ['1', '4']).map(Number);
const runsN = Number(opts.runs ?? 3);
const vp = String(opts.vp ?? '393');
const after = Number(opts.after ?? 4);
const tag = String(opts.tag ?? 'before');

/** Before any app script: note every game frame (a drawImage onto a canvas in the document, once per
 * animation frame) and every clip / appearance / game chunk as it arrives. */
function readinessHooks() {
  const R = (window.__psReady = { first: null, canvasAt: null, frames: [], lastFrameT: -1, res: [] });
  const raf = window.requestAnimationFrame.bind(window);
  let inFrame = false,
    drew = false;
  window.requestAnimationFrame = (f) =>
    raf((t) => {
      inFrame = true;
      drew = false;
      try {
        f(t);
      } finally {
        inFrame = false;
        // the audits' "first frame": the first animation frame with a canvas in the page
        if (R.canvasAt === null && document.querySelector('canvas')) R.canvasAt = performance.now();
        if (drew && R.lastFrameT !== t) {
          R.lastFrameT = t;
          const now = performance.now();
          if (R.first === null) R.first = now;
          if (R.frames.length < 2000) R.frames.push(now);
        }
      }
    });
  const di = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...a) {
    if (inFrame && this.canvas && this.canvas.isConnected && this.canvas.width > 100) drew = true;
    return di.apply(this, a);
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) R.res.push({ name: e.name, start: e.startTime, end: e.responseEnd });
    }).observe({ type: 'resource', buffered: true });
  } catch {
    // resource timing unavailable
  }
}

// dev: /src/data/mocap/run.json?import ; production: /assets/run-<hash>.js (clip names as in mocap.ts)
const CLIP = /\/data\/mocap\/(?!index)[\w-]+\.json|\/assets\/(?:ready|jog|run|sprint|walk|jumpshot|layup|throw|catch|catch_run|dive|block|kick|backpedal|shuffle|celebrate|fall_back|fall_forward|stumble|slip|getup|getup_front|dribble|crossover|cut|stiff_arm|jump)-[\w-]{6,}\.js$/;
const LOOKS = /\/data\/appearance\/|\/assets\/(?:appearance|looks)[\w-]*\.(?:js|json)$/;
const GAME = /(Hoops2|Football2|Soccer2|SoccerLab|Lab|render|arcade)[\w.-]*\.(?:tsx?|js)(\?|$)/;

await needServer();
const results = await withBrowser(async (browser) => {
  const out = [];
  for (const sport of sports)
    for (const rate of rates) {
      const runs = [];
      for (let i = 0; i < runsN; i++) {
        const context = await newContext(browser, vp, { dpr: 3 });
        await context.addInitScript(readinessHooks);
        const page = await context.newPage();
        const errors = watchErrors(page);
        if (rate !== 1) await cpu(page, rate);
        await page.goto(matchUrl(sport, { seed: 'ready' + i }), { waitUntil: 'commit' });
        await page.waitForFunction(() => window.__psReady && window.__psReady.first !== null, null, { timeout: 120000 });
        await wait(after * 1000);
        const r = await page.evaluate(() => ({ ...window.__psReady, pixelDebug: window.__pixelDebug ?? null }));
        if (i === 0) await shot(page, `${tag}-readiness-${sport}-${rate}x`);
        const clips = r.res.filter((x) => CLIP.test(x.name));
        const looks = r.res.filter((x) => LOOKS.test(x.name));
        const game = r.res.filter((x) => GAME.test(x.name));
        const clipsLast = clips.length ? Math.max(...clips.map((x) => x.end)) : null;
        const looksLast = looks.length ? Math.max(...looks.map((x) => x.end)) : null;
        const ready = Math.max(clipsLast ?? 0, looksLast ?? 0);
        runs.push({
          canvasMs: r.canvasAt === null ? null : Math.round(r.canvasAt),
          firstFrameMs: Math.round(r.first),
          gameChunksDoneMs: game.length ? Math.round(Math.max(...game.map((x) => x.end))) : null,
          clipChunks: clips.length,
          clipsFirstMs: clips.length ? Math.round(Math.min(...clips.map((x) => x.start))) : null,
          clipsDoneMs: clipsLast === null ? null : Math.round(clipsLast),
          clipsAfterFirstFrameMs: clipsLast === null ? null : Math.round(clipsLast - r.first),
          appearanceChunks: looks.length,
          appearanceDoneMs: looksLast === null ? null : Math.round(looksLast),
          standInFrames: r.frames.filter((t) => t < ready).length,
          standInFramesAfterFirst: Math.max(0, r.frames.filter((t) => t < ready).length - 1),
          framesSeen: r.frames.length,
          pixelDebug: r.pixelDebug,
          pageErrors: errors.slice(0, 3),
        });
        await context.close();
      }
      const med = (k) => {
        const xs = runs.map((r) => r[k]).filter((x) => x !== null && x !== undefined);
        return xs.length ? quantile(xs, 0.5) : null;
      };
      out.push({
        sport,
        cpu: rate,
        vp,
        runs: runs.length,
        median: {
          playToFirstFrameMs: med('firstFrameMs'),
          canvasMs: med('canvasMs'),
          clipsDoneMs: med('clipsDoneMs'),
          clipsAfterFirstFrameMs: med('clipsAfterFirstFrameMs'),
          clipChunks: med('clipChunks'),
          appearanceDoneMs: med('appearanceDoneMs'),
          standInFramesAfterFirst: med('standInFramesAfterFirst'),
        },
        each: runs,
      });
    }
  return out;
});
emit('players-readiness-' + tag, {
  note: 'playToFirstFrameMs = navigation to the autoplay bench -> first drawn game frame (dev server); canvasMs = the audits\' definition (first animation frame with a canvas mounted). Stand-in frames are frames drawn before the last clip/appearance chunk arrived, until __pixelDebug exists.',
  results,
});
