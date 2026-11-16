// Players QA (studio overhaul, players-1): what the match screen shows, measured against GAME-DESIGN-V2
// C.1.2 (pixel size and on-screen heights) and C.2 (venues). Three parts, all three sports:
//
// 1. Art pixel (C.1.2: 1 art px = 1.5 design px, snapped to whole device pixels). The bodies are
//    rastered at their art size and blitted 1:1 onto the game canvas, so one art px is one canvas
//    px: per sport, viewport and device pixel ratio (1, 2, 3) the canvas's CSS box against its
//    backing store gives `designPerArt` (CSS px per canvas px over the stage scale k) and
//    `devPerArt` (device px per canvas px), and whether that is a whole number.
// 2. On-screen heights (C.1.2, reported for the sport teams, who own the cameras): the probe's
//    per-frame sprite heights (nearest body, the ball's body = the controlled player on offense,
//    median, farthest) in design px, against NBA 51 / far 36 and NFL and soccer 34 / far 22.5.
// 3. Venue calm (C.2), on frames sampled every 3 s of an autoplay match: every sprite blit is
//    recorded into a mask, then the frame's pixels give
//    - venue vs sprite lightness: mean CIE L* of every non-sprite pixel against the sprites' (V2:
//      the venue at least 30% darker);
//    - surface grain: Michelson contrast of luminance (p90 vs p10) in 12x12 tiles of the playing
//      surface away from lines and sprites, median over tiles (V2: <=4%);
//    - the crowd: the band with the most textured rows (mean |dL*| two pixels apart >= 3; flat gaps of
//      up to 23 rows, the ribbons and facades between tiers, bridged) above the playing surface's top
//      edge, top to bottom; its share of the screen height in
//      portrait (V2: <=12%), and of everything above the surface; the
//      colours they use (V2: three dark bands plus <=6% team and <=2% white flecks), and how often a
//      pixel equals its right neighbour (V2's 2 px blocks give >=50%; 1 px noise gives little);
//    - the vignette: corner tiles' mean L* against the centre's (V2: corners -18%).
//
//   node scripts/qa/players-screen.mjs [--sport nba,nfl,soccer] [--vp 393,320] [--dpr-vp 393,320]
//        [--secs 18] [--warm 5] [--tag before] [--out DIR] [--port 5214]
// Prints one JSON line (and OUT/players-screen-<tag>.json). Isolated: localhost only.
import { emit, installProbe, listOf, matchUrl, needServer, newContext, opts, quantile, readProbe, resetProbe, round, shot, SPORTS, summariseProbe, VIEWPORTS, wait, watchErrors, withBrowser } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const vps = listOf(opts.vp, ['393', '320']);
const dprVps = listOf(opts['dpr-vp'], ['393', '320']);
const secs = Number(opts.secs ?? 18);
const warm = Number(opts.warm ?? 5);
const tag = String(opts.tag ?? 'before');
const seed = String(opts.seed ?? 'screen');

/** V2 C.1.2 on-screen targets in design px: controlled player and far players (1 art px = 1.5). */
export const HEIGHT_TARGETS = { nba: { controlled: 51, far: 36 }, nfl: { controlled: 34, far: 22.5 }, soccer: { controlled: 34, far: 22.5 } };

/** The stage scale and the game canvas's geometry, in the page. */
function canvasGeometry() {
  const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!cv) return null;
  const st = document.querySelector('.stage');
  const k = st && st.offsetWidth ? st.getBoundingClientRect().width / st.offsetWidth : innerWidth / 390;
  const r = cv.getBoundingClientRect();
  return { k, cssW: r.width, cssH: r.height, w: cv.width, h: cv.height, dpr: devicePixelRatio, innerH: innerHeight };
}

/** In the page, on top of the sprite probe: record one frame's sprite blits and measure it. */
async function installSampler({ sport }) {
  const R = await import({ nba: '/src/game/hoops2/render.ts', nfl: '/src/game/football2/render.ts', soccer: '/src/game/soccer2/render.ts' }[sport]);
  const Cls = R[{ nba: 'HoopsRenderer', nfl: 'FootballRenderer', soccer: 'SoccerRenderer' }[sport]];
  const body = await import('/src/game/pixel/body.ts');
  if (window.__psScreen) return;
  const S = (window.__psScreen = { want: 0, frames: [], sprites: new WeakSet() });
  const P = body.SpriteCache.prototype;
  const g0 = P.get,
    s0 = P.set;
  P.get = function (k) {
    const r = g0.call(this, k);
    if (r && r.canvas) S.sprites.add(r.canvas);
    return r;
  };
  P.set = function (k, spr, inUse) {
    if (spr && spr.canvas) S.sprites.add(spr.canvas);
    return s0.call(this, k, spr, inUse);
  };
  // CIE L* and Lab from sRGB
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const LUT = new Float32Array(256).map((_, i) => lin(i));
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const lab = (r, g, b) => {
    const R2 = LUT[r],
      G = LUT[g],
      B = LUT[b];
    const X = (0.4124 * R2 + 0.3576 * G + 0.1805 * B) / 0.95047,
      Y = 0.2126 * R2 + 0.7152 * G + 0.0722 * B,
      Z = (0.0193 * R2 + 0.1192 * G + 0.9505 * B) / 1.08883;
    const fy = f(Y);
    return [116 * fy - 16, 500 * (f(X) - fy), 200 * (fy - f(Z)), Y];
  };
  const measure = (cv, mask) => {
    const W = cv.width,
      H = cv.height;
    const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    const n = W * H;
    const L = new Float32Array(n),
      A = new Float32Array(n),
      Bc = new Float32Array(n),
      Y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [l, a, b, y] = lab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      L[i] = l;
      A[i] = a;
      Bc[i] = b;
      Y[i] = y;
    }
    // a 1 px ring round every sprite is theirs too (their outline sits on the venue)
    const near = new Uint8Array(n);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) near[(y + dy) * W + x + dx] = 1;
      }
    let sl = 0,
      sn = 0,
      vl = 0,
      vn = 0;
    for (let i = 0; i < n; i++) {
      if (mask[i]) {
        sl += L[i];
        sn++;
      } else if (!near[i]) {
        vl += L[i];
        vn++;
      }
    }
    const spriteL = sn ? sl / sn : null,
      venueL = vn ? vl / vn : null;
    // the playing surface's colour: the median Lab of the venue pixels low in the middle
    const pick = [];
    for (let y = Math.floor(H * 0.75); y < Math.floor(H * 0.95); y++) for (let x = Math.floor(W * 0.3); x < Math.floor(W * 0.7); x++) if (!near[y * W + x]) pick.push(y * W + x);
    const med = (arr) => {
      const s = Float32Array.from(arr).sort();
      return s.length ? s[s.length >> 1] : 0;
    };
    const sL = med(pick.map((i) => L[i])),
      sA = med(pick.map((i) => A[i])),
      sB = med(pick.map((i) => Bc[i]));
    // (lines don't count: a white band in the stands would pass for them)
    const isSurface = (i) => Math.hypot(L[i] - sL, A[i] - sA, Bc[i] - sB) < 20;
    // the surface's top edge: the first row (from the top) where 40% of the venue pixels are the
    // surface's colour for three rows running
    const rowShare = [];
    for (let y = 0; y < H; y++) {
      let m = 0,
        c = 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (near[i]) continue;
        c++;
        if (isSurface(i)) m++;
      }
      rowShare.push(c ? m / c : 0);
    }
    let top = H;
    for (let y = 0; y + 2 < H; y++)
      if (rowShare[y] >= 0.4 && rowShare[y + 1] >= 0.4 && rowShare[y + 2] >= 0.4) {
        top = y;
        break;
      }
    // the crowd: rows above the surface with texture (mean |dL*| to the pixel two to the left >= 3,
    // so 2 px blocks count), grouped into bands across gaps of up to 23 flat rows (ribbons, facades
    // between tiers); the band with the most textured rows is the stands (a goal net or a board just
    // above the surface is a thin band of its own)
    const textured = [];
    for (let y = 0; y < top; y++) {
      let e = 0,
        c = 0;
      for (let x = 2; x < W; x++) {
        const i = y * W + x;
        if (near[i] || near[i - 2]) continue;
        e += Math.abs(L[i] - L[i - 2]);
        c++;
      }
      if (c > W * 0.3 && e / c >= 3) textured.push(y);
    }
    let band = [0, -1],
      bandRows = 0;
    for (let a = 0; a < textured.length; ) {
      let b = a;
      while (b + 1 < textured.length && textured[b + 1] - textured[b] <= 24) b++;
      if (b - a + 1 > bandRows) {
        band = [textured[a], textured[b]];
        bandRows = b - a + 1;
      }
      a = b + 1;
    }
    const crowdRows = [];
    for (let y = band[0]; y <= band[1]; y++) crowdRows.push(y);
    const colours = new Map();
    let cpx = 0,
      same = 0,
      crowdL = 0;
    for (const y of crowdRows)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (near[i]) continue;
        const k = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
        colours.set(k, (colours.get(k) ?? 0) + 1);
        cpx++;
        crowdL += L[i];
        if (x + 1 < W && d[i * 4] === d[i * 4 + 4] && d[i * 4 + 1] === d[i * 4 + 5] && d[i * 4 + 2] === d[i * 4 + 6]) same++;
      }
    const top3 = [...colours.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    // surface grain: 12x12 tiles below the surface's top edge, surface pixels only, lines out
    const grain = [];
    const T = 12;
    for (let ty = Math.max(top + 4, 0); ty + T <= H; ty += T)
      for (let tx = 0; tx + T <= W; tx += T) {
        const ys = [];
        for (let y = ty; y < ty + T; y++)
          for (let x = tx; x < tx + T; x++) {
            const i = y * W + x;
            if (near[i] || !(Math.hypot(L[i] - sL, A[i] - sA, Bc[i] - sB) < 20)) continue;
            ys.push(Y[i]);
          }
        if (ys.length < T * T * 0.8) continue;
        ys.sort((a, b) => a - b);
        const lo = ys[Math.floor(ys.length * 0.1)],
          hi = ys[Math.floor(ys.length * 0.9)];
        grain.push((hi - lo) / Math.max(1e-6, hi + lo));
      }
    grain.sort((a, b) => a - b);
    // vignette: the four corner tiles (10% x 10%) against the centre tile, venue pixels only
    const tileL = (x0, y0) => {
      let s = 0,
        c = 0;
      for (let y = y0; y < y0 + Math.floor(H * 0.1); y++)
        for (let x = x0; x < x0 + Math.floor(W * 0.1); x++) {
          const i = y * W + x;
          if (near[i]) continue;
          s += L[i];
          c++;
        }
      return c ? s / c : null;
    };
    const cw = Math.floor(W * 0.1),
      ch = Math.floor(H * 0.1);
    const corners = [tileL(0, 0), tileL(W - cw, 0), tileL(0, H - ch), tileL(W - cw, H - ch)].filter((x) => x !== null);
    const centre = tileL(Math.floor(W * 0.45), Math.floor(H * 0.45));
    return {
      w: W,
      h: H,
      spritePx: sn,
      spriteL: spriteL === null ? null : +spriteL.toFixed(1),
      venueL: venueL === null ? null : +venueL.toFixed(1),
      venueDarkerPct: spriteL && venueL !== null ? +((100 * (spriteL - venueL)) / spriteL).toFixed(1) : null,
      surfaceTopRow: top,
      crowdRows: crowdRows.length,
      crowdColours: colours.size,
      crowdTop3Share: cpx ? +(top3 / cpx).toFixed(3) : null,
      crowdSameRightShare: cpx ? +(same / cpx).toFixed(3) : null,
      crowdL: cpx ? +(crowdL / cpx).toFixed(1) : null,
      grainMedianPct: grain.length ? +(100 * grain[grain.length >> 1]).toFixed(2) : null,
      grainTiles: grain.length,
      vignettePct: centre && corners.length ? +((100 * (corners.reduce((a, b) => a + b, 0) / corners.length - centre)) / centre).toFixed(1) : null,
    };
  };
  const d0 = Cls.prototype.draw;
  Cls.prototype.draw = function (ctx, state, ...rest) {
    if (!S.want) return d0.call(this, ctx, state, ...rest);
    S.want--;
    const cv = ctx.canvas;
    const m = document.createElement('canvas');
    m.width = cv.width;
    m.height = cv.height;
    const mg = m.getContext('2d');
    mg.imageSmoothingEnabled = false;
    const di = ctx.drawImage;
    let blits = 0;
    ctx.drawImage = function (src, ...a) {
      if (src && S.sprites.has(src)) {
        blits++;
        mg.setTransform(ctx.getTransform());
        mg.globalAlpha = 1;
        mg.drawImage(src, ...a);
      }
      return di.call(this, src, ...a);
    };
    try {
      return d0.call(this, ctx, state, ...rest);
    } finally {
      delete ctx.drawImage;
      const md = mg.getImageData(0, 0, m.width, m.height).data;
      const mask = new Uint8Array(m.width * m.height);
      for (let i = 0; i < mask.length; i++) mask[i] = md[i * 4 + 3] > 0 ? 1 : 0;
      try {
        S.frames.push({ blits, ...measure(cv, mask) });
      } catch (e) {
        S.frames.push({ error: String(e && e.message) });
      }
      m.width = m.height = 0;
    }
  };
}

const med = (xs) => {
  const v = xs.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  return v.length ? round(quantile(v, 0.5), 2) : null;
};

await needServer();
const report = await withBrowser(async (browser) => {
  // ---- 1. the art pixel at DPR 1, 2 and 3 ----
  const artPixel = [];
  for (const sport of sports)
    for (const vp of dprVps)
      for (const dpr of [1, 2, 3]) {
        const context = await newContext(browser, vp, { dpr });
        const page = await context.newPage();
        await page.goto(matchUrl(sport, { seed }), { waitUntil: 'load' });
        await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.width > 100), null, { timeout: 90000 });
        await wait(1500);
        const g = await page.evaluate(canvasGeometry);
        const cssPerArt = g.cssW / g.w;
        const devPerArt = cssPerArt * dpr;
        artPixel.push({ sport, vp, dpr, canvas: `${g.w}x${g.h}`, css: `${round(g.cssW, 1)}x${round(g.cssH, 1)}`, k: round(g.k, 3), designPerArt: round(cssPerArt / g.k, 3), devPerArt: round(devPerArt, 3), integer: Math.abs(devPerArt - Math.round(devPerArt)) < 0.01 });
        await context.close();
      }
  // ---- 2 and 3: heights and the venue, from an autoplay match ----
  const runs = [];
  for (const sport of sports)
    for (const vp of vps) {
      const context = await newContext(browser, vp, { dpr: 1 });
      const page = await context.newPage();
      const errors = watchErrors(page);
      await page.goto(matchUrl(sport, { seed }), { waitUntil: 'load' });
      await installProbe(page, sport);
      await page.evaluate(installSampler, { sport });
      await wait(warm * 1000);
      await resetProbe(page);
      const shots = [];
      for (let t = 0; t < secs; t += 3) {
        await wait(3000);
        await page.evaluate(() => (window.__psScreen.want = 1));
        await wait(120);
        shots.push(await shot(page, `${tag}-screen-${sport}-${vp}-${shots.length}`));
      }
      const g = await page.evaluate(canvasGeometry);
      const probe = summariseProbe(await readProbe(page));
      const frames = (await page.evaluate(() => window.__psScreen.frames)).filter((f) => !f.error);
      const designPerArt = g.cssW / g.w / g.k;
      const fa = probe.frameArtPx ?? {};
      const toDesign = (x) => (x === null || x === undefined ? null : round(x * designPerArt, 1));
      const tgt = HEIGHT_TARGETS[sport];
      const heights = {
        designPerArt: round(designPerArt, 3),
        artPx: fa,
        designPx: { nearest: toDesign(fa.nearestP50), controlled: toDesign(fa.ballP50 ?? fa.nearestP50), typical: toDesign(fa.typicalP50), far: toDesign(fa.farP50) },
        target: tgt,
      };
      heights.controlledVsTargetPct = heights.designPx.controlled === null ? null : round((100 * (heights.designPx.controlled - tgt.controlled)) / tgt.controlled, 1);
      heights.farVsTargetPct = heights.designPx.far === null ? null : round((100 * (heights.designPx.far - tgt.far)) / tgt.far, 1);
      const rowsToScreenPct = (rows) => round((100 * rows * (g.cssH / g.h)) / g.innerH, 1);
      const venue = {
        frames: frames.length,
        venueDarkerPct: med(frames.map((f) => f.venueDarkerPct)),
        venueL: med(frames.map((f) => f.venueL)),
        spriteL: med(frames.map((f) => f.spriteL)),
        grainPct: med(frames.map((f) => f.grainMedianPct)),
        vignettePct: med(frames.map((f) => f.vignettePct)),
        crowdScreenPct: med(frames.map((f) => rowsToScreenPct(f.crowdRows))),
        aboveSurfaceScreenPct: med(frames.map((f) => rowsToScreenPct(f.surfaceTopRow))),
        crowdColours: med(frames.map((f) => f.crowdColours)),
        crowdTop3Share: med(frames.map((f) => f.crowdTop3Share)),
        crowdSameRightShare: med(frames.map((f) => f.crowdSameRightShare)),
        crowdL: med(frames.map((f) => f.crowdL)),
        each: frames,
      };
      runs.push({ sport, vp, seed, geometry: { canvas: `${g.w}x${g.h}`, css: `${round(g.cssW, 1)}x${round(g.cssH, 1)}`, k: round(g.k, 3), viewportH: g.innerH }, heights, venue, spritePx: probe.spritePx, shots, pageErrors: errors.slice(0, 5) });
      await context.close();
    }
  return { artPixel, runs };
});
emit('players-screen-' + tag, { viewports: Object.fromEntries(vps.map((v) => [v, VIEWPORTS[v]])), ...report });
