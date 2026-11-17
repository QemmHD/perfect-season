// The frame, measured live (plan §3.8 camera, safe-box and HUD rows; nba-3, Claude 2026-11-16), at
// the 8 plan sizes on `.arcade-full` with the insets injected:
//  - the score bug, the pause button and the Heat bar against the V2 A.5 table (393 and 320, ±2 px)
//  - the safe box the game reads from the tokens (hud/geometry.ts) against the table
//  - nothing drawn in the DOM (bug, Heat bar, pause, LAST PLAY, the toast line, the cluster, the
//    stick's ghost) within 40 px of the projected rim, in any sampled frame
//  - over ≥ 300 frames of an autoplay game: the rim's row and the handler's (median), the handler
//    (feet to head) and the rim inside the safe box, the zoom near the rim (the rim's px per foot
//    while the ball is within 15 ft), and at each jump-shot release how much of the shooter the
//    nearest defender hides when he's drawn in front (shoulder-wide silhouettes, in the air too)
//   node scripts/audit/nba-hud.mjs [size…]
import { context, launch, needServer, openLab, PORTRAIT, rect, report, shot, SIZES, wait } from './nba-lib.mjs';

const { GEO, GEO_TOL } = await import('../../src/game/hoops2/targets.ts');
const RIM = { cx: 41.75, cz: 0, h: 10 };
const PAD = 40;
const FRAMES = Number(process.env.NBA_HUD_FRAMES ?? 900);
// (nba-3 review) the camera rows over several autoplay games at a size, so the medians and the
// release rows rest on enough: NBA_HUD_SEEDS=6 NBA_HUD_FRAMES=2700 → 16,200 frames, 30+ releases
const SEEDS = Number(process.env.NBA_HUD_SEEDS ?? 1);
const AT_RIM = ['layup', 'dunk', 'contact', 'standdunk', 'oop'];

/** every visible HUD element's box (CSS px) */
const domRects = (page) =>
  page.$$eval('.arcade-full .ps-bug, .arcade-full .ps-heat, .arcade-full .ps-hud-pause, .arcade-full .ps-bug-aside button, .arcade-full .ps-toast, .arcade-full .ps-ctl-btn, .arcade-full .ps-stick-ghost', (els) =>
    els
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0')
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { sel: e.className.baseVal ?? e.className, x: r.x, y: r.y, w: r.width, h: r.height };
      })
      .filter((r) => r.w > 0 && r.h > 0)
  );

/** camera samples in the page, every frame of an autoplay game */
const sample = (page, n) =>
  page.evaluate(
    ({ n, RIM, AT_RIM }) =>
      new Promise((resolve) => {
        const out = [];
        const releases = [];
        let wasShot = false;
        let lastT = -1;
        let held = 0;
        const step = () => {
          const q = window.__hg2;
          const p = q?.possession();
          const c = q?.canvas()?.getBoundingClientRect();
          // (nba-3 review) only frames of play: the game clock moved since the last frame (a possession
          // waiting for its tip, or a frozen moment, isn't the camera following the play)
          const moving = !!p && p.t !== lastT;
          if (p && !moving) held++;
          lastT = p ? p.t : -1;
          if (q && p && c && !p.end && moving) {
            const z = q.zoom();
            const at = (cx, cz, h = 0) => {
              const s = q.screenOf(cx, cz, h);
              return s && { x: c.left + s.x * z, y: c.top + s.y * z, s: s.s * z };
            };
            const rim = at(RIM.cx, RIM.cz, RIM.h);
            const rimFloor = at(RIM.cx, RIM.cz, 0);
            const hb = p.handler !== null ? p.bodies[p.handler] : null;
            const feet = hb && at(hb.cx, hb.cz, 0);
            const head = hb && at(hb.cx, hb.cz, 7.5);
            const ball = p.ball && 'to' in p.ball ? null : hb;
            const toast = document.querySelector('.arcade-full .ps-toast')?.getBoundingClientRect();
            // the Clutch possessions sit 6% tighter on purpose (V2 B.0.4): left out of the zoom row
            const clutch = !!q.renderer()?.clutch;
            out.push({ clutch, rimX: rim.x, rimY: rim.y, rimS: rimFloor.s, feetY: feet?.y ?? null, headY: head?.y ?? null, dRim: ball ? Math.hypot(ball.cx - RIM.cx, ball.cz - RIM.cz) : null, toast: toast && toast.width ? { x: toast.x, y: toast.y, w: toast.width, h: toast.height } : null });
            const isShot = p.ball?.kind === 'shot';
            if (isShot && !wasShot) {
              const sh = p.bodies[p.ball.who];
              let d = null;
              let best = Infinity;
              for (const o of p.bodies)
                if (o.side === 'D' && Math.hypot(o.cx - sh.cx, o.cz - sh.cz) < best) {
                  best = Math.hypot(o.cx - sh.cx, o.cz - sh.cz);
                  d = o;
                }
              const box = (b) => {
                const f = at(b.cx, b.cz, b.h);
                const hd = at(b.cx, b.cz, b.h + 7.5);
                return { x0: f.x - 0.85 * f.s, x1: f.x + 0.85 * f.s, y0: hd.y, y1: f.y };
              };
              const A = box(sh);
              const B = box(d);
              // the defender hides the shooter only when he's drawn in front (lower on the floor)
              const front = at(d.cx, d.cz, 0).y > at(sh.cx, sh.cz, 0).y;
              const ix = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0));
              const iy = Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
              releases.push({ hide: front ? (ix * iy) / ((A.x1 - A.x0) * (A.y1 - A.y0)) : 0, jumper: !AT_RIM.includes(p.ball.shot) });
            }
            wasShot = isShot;
          }
          if (out.length < n) requestAnimationFrame(step);
          else resolve({ out, releases, held, geo: window.__hg2.geometry() });
        };
        requestAnimationFrame(step);
      }),
    { n, RIM, AT_RIM }
  );

const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
};
const r3 = (x) => Math.round(x * 1000) / 1000;
const near = (a, b) => Math.abs(a - b) <= GEO_TOL;
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

await needServer();
const sizes = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SIZES);
const browser = await launch();
const out = {};
try {
  for (const size of sizes) {
    const { ctx, page, errors } = await context(browser, size);
    // a phone that has calibrated (since nba-4 the first played match offers the calibrator, which
    // holds the tip-off): the probe measures the game, not the offer
    await ctx.addInitScript(() => {
      try {
        const key = 'perfect-season:touch-prefs:v1';
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 1, offsetMs: 0 }));
      } catch {
        /* private mode */
      }
    });
    const H = SIZES[size].h;
    const res = { errors };
    // the HUD with its controls (a played game)
    await openLab(page, { seed: 'hud' + size });
    await wait(500);
    const dom = await domRects(page);
    res.rects = {
      bug: await rect(page, '.ps-bug'),
      pause: await rect(page, '.ps-hud-pause'),
      heat: await rect(page, '.ps-heat'),
      lastPlay: await rect(page, '.ps-bug-aside'),
    };
    if (GEO[size]) {
      const g = GEO[size];
      res.v2 = {};
      for (const k of ['bug', 'pause', 'heat']) {
        const b = res.rects[k];
        res.v2[k] = b && near(b.x, g[k].x) && near(b.y, g[k].y) && near(b.w, g[k].w) && near(b.h, g[k].h);
      }
    }
    await shot(page, `hud-${size}-play`);
    // the camera over an autoplay game
    const cam = { out: [], releases: [], geo: null };
    for (let k = 0; k < SEEDS; k++) {
      const auto = await ctx.newPage();
      await openLab(auto, { seed: 'hud-cam' + size + (k ? '-' + k : ''), auto: '' });
      const one = await sample(auto, FRAMES);
      cam.out.push(...one.out);
      cam.releases.push(...one.releases);
      cam.held = (cam.held ?? 0) + one.held;
      cam.geo = one.geo;
      if (k === 0) await shot(auto, `hud-${size}-auto`);
      await auto.close();
    }
    const geo = cam.geo;
    res.safeBox = geo;
    if (GEO[size]) res.v2.safeBox = near(geo.safeTop, GEO[size].safe.y0) && near(geo.safeBottom, GEO[size].safe.y1);
    const inBox = (y) => y >= geo.safeTop && y <= geo.safeBottom;
    const s = cam.out;
    const withH = s.filter((x) => x.feetY !== null);
    const nearRim = s.filter((x) => x.dRim !== null && x.dRim <= 15 && !x.clutch).map((x) => x.rimS);
    const mean = nearRim.reduce((a, x) => a + x, 0) / Math.max(1, nearRim.length);
    // the DOM against the rim ± 40 px, every frame (the played page's controls, and the toast as shown)
    let domHits = 0;
    const hitWho = new Set();
    for (const f of s) {
      const box = { x: f.rimX - PAD, y: f.rimY - PAD, w: 2 * PAD, h: 2 * PAD };
      const els = f.toast ? [...dom.filter((d) => !String(d.sel).includes('ps-toast')), { sel: 'ps-toast', ...f.toast }] : dom;
      const who = els.filter((d) => hit(d, box));
      if (who.length) domHits++;
      for (const w of who) hitWho.add(String(w.sel).split(' ')[0]);
    }
    res.camera = {
      frames: s.length,
      framesHeldOut: cam.held,
      rimRow: r3(median(s.map((x) => x.rimY)) / H),
      handlerRow: r3(median(withH.map((x) => x.feetY)) / H),
      safeHandlerRim: r3(withH.filter((x) => inBox(x.feetY) && inBox(x.headY) && inBox(x.rimY)).length / Math.max(1, withH.length)),
      zoomVarNearRim: nearRim.length ? r3((Math.max(...nearRim) - Math.min(...nearRim)) / mean) : null,
      releases: cam.releases.length,
      overlapOkAll: cam.releases.length ? r3(cam.releases.filter((x) => x.hide <= 0.35).length / cam.releases.length) : null,
      jumpReleases: cam.releases.filter((x) => x.jumper).length,
      overlapOk: cam.releases.some((x) => x.jumper) ? r3(cam.releases.filter((x) => x.jumper && x.hide <= 0.35).length / cam.releases.filter((x) => x.jumper).length) : null,
      domOnRimFrames: domHits,
      domOnRim: [...hitWho],
    };
    if (PORTRAIT.includes(size)) res.portrait = true;
    out[size] = res;
    console.log(size, JSON.stringify({ v2: res.v2, safeBox: geo, camera: res.camera }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
report('nba-hud', out);
