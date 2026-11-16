// Players QA (studio overhaul, players-1): can you tell who is who? Port of the audit's lineup.cjs,
// silhouette.cjs and numbers.cjs (L-1, L-2, L-5), drawing real stars exactly as the app does
// (CardArt `lookOf`/`portraitUrl`, `drawBody` on the mocap `ready` clip at match sizes).
//
// Outputs per sport:
// - `<tag>-lineup-<sport>.png`: row 1 card portraits, rows 2-3 own kit at 40 and 24 px, row 4 all
//   twelve in ONE shared kit (identity must come from the player, not the shirt);
// - identity in one shared kit: for every pair of the twelve, drawn at the SAME height (24, 40 and
//   60 px, so height doesn't count), the share of differing pixels (anchored at the feet, over the
//   union of both silhouettes);
// - the look each star gets (hair, beard, skin, hair colour, build) and the owner-named checks;
// - NBA: torso width by build at 24/34/40/60 px (the audit's eight bodies plus BMI 20 vs 31); soccer:
//   Haaland vs Messi; `<tag>-numbers.png`, the jersey-number legibility sheet.
// - V2 Broadcast Pixel rows (GAME-DESIGN-V2 C.1.1, C.1.3), drawn front-on in the `ready` pose:
//   `proportions`: for sprites 20/24/34/60 art px tall (with the outline, in the match camera's pitch),
//   the figure height, the head box with hair (w x h: the skin, hair, buzz and eye pixels within 1.5
//   head radii of the head joint and down to the chin, outline excluded) and heads tall (figure
//   height over head-box height), against V2's 4.5/5/5.5/6 heads and 5x5, 6x6, 7x8, 12x13 boxes;
//   `outline`: per star at 34 art px in his own look, the colours of the outer silhouette edge (the
//   share that is V2's `#14121c`) and the inner line pixels (pixels inside the figure drawn in an
//   outline colour, where V2 wants the part's shadow tone: 0 black inner pixels); and, from
//   `rasterBody`'s per-pixel material slots (revised C.1.3 and C.7 #8), the tones drawn per main
//   material (skin, jersey, shorts, socks: V2 asks five, the C.7 bar three) and the rim light: of the
//   figure's pixels with nothing above-left of them (the outline ring or empty), the share drawn in
//   the brightest tone of their own material (V2: every one).
// - Owner-named looks (Shaq bald, Iverson cornrows and headband, Kareem goggles, Rodman dyed, Haaland
//   long blond, Mbappe short and clean-shaven, Brady curated and reviewed) are read from the
//   appearance record (`src/game/pixel/appearance.ts`, `appearanceFor`, players-3) and its source rows
//   (`src/data/appearance/source/<sport>.looks.json`). Until players-3 lands they are reported
//   "not built yet (players-3)", never judged from today's hashed looks.
//
//   node scripts/qa/players-lineup.mjs [--sport nba,nfl,soccer] [--tag before] [--out DIR]
import fs from 'node:fs';
import path from 'node:path';
import { appUrl, emit, listOf, needServer, OUT, opts, quantile, ROOT, round, SPORTS, watchErrors, withBrowser, isolate } from './players-lib.mjs';

const sports = listOf(opts.sport, SPORTS);
const tag = String(opts.tag ?? 'before');

const STARS = {
  nba: ["Shaquille O'Neal", 'Stephen Curry', 'Dennis Rodman', 'Allen Iverson', 'Michael Jordan', 'LeBron James', 'Muggsy Bogues', 'Manute Bol', 'Nikola Jokić', 'Kareem Abdul-Jabbar', 'Yao Ming', 'Giannis Antetokounmpo'],
  nfl: ['Patrick Mahomes', 'Derrick Henry', 'Tom Brady', 'Aaron Donald', 'Jerry Rice', 'Travis Kelce', 'Barry Sanders', 'William Perry', 'Randy Moss', 'Ray Lewis', 'Justin Tucker', 'Tyreek Hill'],
  soccer: ['Lionel Messi', 'Erling Haaland', 'Cristiano Ronaldo', 'Pelé', 'Diego Maradona', 'Peter Crouch', 'Zlatan Ibrahimović', 'Ronaldinho', 'Paul Pogba', 'Manuel Neuer', 'Kylian Mbappé', "N'Golo Kanté"],
};

/** Runs in the page: everything the lineup needs, drawn with the app's own modules. */
async function draw({ names, sport, withNumbers }) {
  const { getPool } = await import('/src/ut/pool.ts');
  const { lookOf, portraitUrl } = await import('/src/ut/CardArt.tsx');
  const body = await import('/src/game/pixel/body.ts');
  const mocap = await import('/src/game/pixel/mocap.ts');
  const P = await import('/src/game/pixel/poses.ts');
  await mocap.loadClips(['ready', 'run']);
  const pool = await getPool();
  const found = [];
  for (const n of names) {
    let best = null;
    for (const rc of pool.base.values()) if (rc.line.name === n && rc.line.kind === 'season' && (!best || rc.ovr > best.ovr)) best = rc;
    if (best) found.push(best);
  }
  const shared = (look) => ({ ...look, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', helmet: '#1d428a', stripe: '#ffc72c', socks: sport === 'nfl' ? '#1d428a' : '#f2f2f2', pants: '#f2f2f2' });
  const sprite = (look, pxAt78, view = { facing: 0.9, pitch: 0.45 }) => body.drawBody(look, mocap.mocapJoints('ready', 10, look, { ground: 'clip' }), view, Math.max(6, Math.round((pxAt78 * look.ht) / 78)));
  // ---- the sheet ----
  const W = 1380,
    H = 880;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = sport === 'nba' ? '#c98d55' : '#3f7d3a';
  g.fillRect(0, 0, W, H);
  g.font = 'bold 11px sans-serif';
  const colW = Math.floor(W / Math.max(1, found.length));
  const imgs = await Promise.all(
    found.map(
      (rc) =>
        new Promise((ok) => {
          const im = new Image();
          im.onload = () => ok(im);
          im.onerror = () => ok(null);
          im.src = portraitUrl(rc.line, 'stand');
        })
    )
  );
  const info = [];
  found.forEach((rc, i) => {
    const x0 = i * colW;
    if (imgs[i]) g.drawImage(imgs[i], x0 + (colW - 108) / 2, 4, 108, 117);
    const look = lookOf(rc.line);
    for (const [row, px, lk] of [
      [0, 40, look],
      [1, 24, look],
      [2, 40, shared(look)],
    ]) {
      const sp = sprite(lk, px);
      const y = 130 + row * 240;
      g.drawImage(sp.canvas, x0 + colW / 2 - sp.ax * 3, y + 220 - sp.ay * 3, sp.canvas.width * 3, sp.canvas.height * 3);
    }
    g.fillStyle = '#fff';
    g.fillText(rc.line.name.slice(0, 18), x0 + 4, 868);
    g.fillText(`${rc.line.ht ?? '-'}${sport === 'soccer' ? 'cm' : 'in'} ${rc.line.wt ?? '-'}lb #${rc.line.num ?? '-'}`, x0 + 4, 856);
    const seasons = [...new Set([...pool.base.values()].filter((x) => x.line.name === rc.line.name && x.line.kind === 'season').map((x) => x.line.season))].sort();
    info.push({ name: rc.line.name, pid: rc.line.pid, season: rc.line.season, seasons, team: rc.line.abbr, ovr: rc.ovr, ht: rc.line.ht, wt: rc.line.wt ?? null, num: rc.line.num ?? null, hair: look.hair, beard: !!look.beard, skin: look.skin, hairColor: look.hairColor, lookHt: round1(look.ht), lookWt: round1(look.wt) });
  });
  // the appearance record (players-3), when it exists: the owner-named checks read it, never the
  // hashed look the renderers draw today
  let appearance = { built: false, error: null, byName: {} };
  try {
    const A = await import('/src/game/pixel/appearance.ts');
    if (typeof A.appearanceFor !== 'function') throw new Error('appearanceFor is not exported');
    if (typeof A.loadAppearance === 'function') await A.loadAppearance(sport);
    appearance.built = true;
    for (const x of info) {
      const at = {};
      for (const se of [x.season, ...x.seasons]) {
        try {
          at[se] = A.appearanceFor(sport, x.pid, se) ?? null;
        } catch (e) {
          at[se] = { error: String(e && e.message).slice(0, 80) };
        }
      }
      appearance.byName[x.name] = { best: at[x.season] ?? null, bySeason: at };
    }
  } catch (e) {
    appearance = { built: false, error: String(e && e.message).slice(0, 120), byName: {} };
  }
  function round1(x) {
    return Math.round(x * 10) / 10;
  }
  // ---- identity in one shared kit ----
  const pixels = (sp) => {
    const d = sp.canvas.getContext('2d').getImageData(0, 0, sp.canvas.width, sp.canvas.height).data;
    return { d, w: sp.canvas.width, h: sp.canvas.height, ax: Math.round(sp.ax), ay: Math.round(sp.ay) };
  };
  const diff = (a, b) => {
    // align the anchors (feet), compare over the union of both silhouettes
    const x0 = Math.min(-a.ax, -b.ax),
      x1 = Math.max(a.w - a.ax, b.w - b.ax),
      y0 = Math.min(-a.ay, -b.ay),
      y1 = Math.max(a.h - a.ay, b.h - b.ay);
    let union = 0,
      differ = 0;
    const at = (s, x, y) => {
      const px = x + s.ax,
        py = y + s.ay;
      if (px < 0 || py < 0 || px >= s.w || py >= s.h) return null;
      const i = (py * s.w + px) * 4;
      return s.d[i + 3] ? s.d[i] * 65536 + s.d[i + 1] * 256 + s.d[i + 2] : null;
    };
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const p = at(a, x, y),
          q = at(b, x, y);
        if (p === null && q === null) continue;
        union++;
        if (p !== q) differ++;
      }
    return union ? differ / union : 0;
  };
  const identity = {};
  for (const px of [24, 34, 40, 60]) {
    // every star drawn the SAME height: height is a cue of its own, this measures the look (skin,
    // hair, beard, gear, build) the shared kit leaves
    const sp = found.map((rc) => {
      const lk = shared(lookOf(rc.line));
      return pixels(body.drawBody(lk, mocap.mocapJoints('ready', 10, lk, { ground: 'clip' }), { facing: 0.9, pitch: 0.45 }, px));
    });
    const pairs = [];
    for (let i = 0; i < sp.length; i++) for (let j = i + 1; j < sp.length; j++) pairs.push({ a: found[i].line.name, b: found[j].line.name, d: diff(sp[i], sp[j]) });
    identity[px] = pairs;
  }
  // ---- builds (L-2): the audit's bodies, same kit, pose and view, facing the camera ----
  const base = { sport: 'nba', num: 30, hair: 0, skin: body.DEFAULT_SKIN, hairColor: body.DEFAULT_HAIR, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
  const torso = (look, pxAt78) => {
    const px = Math.round((pxAt78 * look.ht) / 78);
    const sp = body.drawBody(look, mocap.mocapJoints('ready', 10, look, { ground: 'clip' }), { facing: Math.PI / 2, pitch: 0.45 }, px);
    const cv = sp.canvas;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let minx = 1e9,
      maxx = -1,
      miny = 1e9,
      maxy = -1;
    const rowW = [];
    for (let y = 0; y < cv.height; y++) {
      let a = -1,
        b = -1;
      for (let x = 0; x < cv.width; x++)
        if (d[(y * cv.width + x) * 4 + 3]) {
          if (a < 0) a = x;
          b = x;
        }
      rowW.push(a < 0 ? 0 : b - a + 1);
      if (a >= 0) {
        minx = Math.min(minx, a);
        maxx = Math.max(maxx, b);
        miny = Math.min(miny, y);
        maxy = Math.max(maxy, y);
      }
    }
    const h = maxy - miny + 1;
    const band = rowW.slice(miny + Math.round(h * 0.3), miny + Math.round(h * 0.45));
    return { px, bboxW: maxx - minx + 1, bboxH: h, torsoW: Math.max(...band) };
  };
  // ---- V2 proportions and outline (C.1.1, C.1.3) ----
  const { ramp, rgb, mix, outlineOf } = await import('/src/game/pixel/color.ts');
  const rig = await import('/src/game/pixel/rig.ts');
  const key = (r, g2, b) => (r << 16) | (g2 << 8) | b;
  const keyOf = (c) => key(c[0], c[1], c[2]);
  const front = { facing: Math.PI / 2, pitch: 0.45 };
  const headBox = (look, px) => {
    const j = mocap.mocapJoints('ready', 10, look, { ground: 'clip' });
    const sp = body.drawBody(look, j, front, px);
    const cv = sp.canvas;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    // the head's materials: skin (and its dark ear/neck tone), hair, the buzz-cut blend, the eyes
    const skin = rgb(look.skin),
      hair = rgb(look.hairColor);
    const sk = ramp(skin);
    const headCols = new Set([...sk, ...ramp(hair), ...ramp(mix(hair, skin, 0.35)), mix(sk[0], [0, 0, 0], 0.15), [28, 18, 22]].map(keyOf));
    const hp = rig.project(j.head, front, px);
    const hr = Math.max(0.9, body.shapeFor(look).headR * px);
    const hcx = sp.ax + hp.x,
      hcy = sp.ay + hp.y;
    let x0 = 1e9,
      x1 = -1,
      y0 = 1e9,
      y1 = -1,
      fy0 = 1e9,
      fy1 = -1;
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (!d[i + 3]) continue;
        fy0 = Math.min(fy0, y);
        fy1 = Math.max(fy1, y);
        const k = key(d[i], d[i + 1], d[i + 2]);
        if (!headCols.has(k) || Math.abs(x + 0.5 - hcx) > hr * 1.5 + 0.5 || y + 0.5 > hcy + hr * 1.05) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    // the sprite with its outline, and the figure without its 1 px outline ring top and bottom
    const spriteH = fy1 - fy0 + 1;
    const figureH = spriteH - 2;
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1;
    return { px, spriteH, figureH, headW: w, headH: h, headsTall: Math.round((figureH / h) * 100) / 100, headR: Math.round(hr * 100) / 100 };
  };
  // V2's bands are by the drawn sprite's height: the `ready` crouch and the camera's pitch make it
  // shorter than the grid height `px`, so each band takes the smallest grid height whose sprite is
  // at least that tall
  const atHeight = (look, artH) => {
    for (let px = artH; px < artH * 2; px++) {
      const m = headBox(look, px);
      if (m.spriteH >= artH) return { artH, ...m };
    }
    return { artH, ...headBox(look, artH) };
  };
  const plain = { sport, ht: 78, wt: 215, num: 23, hair: 0, beard: false, skin: body.DEFAULT_SKIN, hairColor: body.DEFAULT_HAIR, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f', helmet: '#1d428a', stripe: '#ffc72c', pants: '#f2f2f2' };
  // NFL players wear a helmet, so the head box is measured bare-headed (NBA rules) in every sport:
  // V2's table is about the body's proportions, the same in all three
  const proportions = [20, 24, 34, 60].map((h) => atHeight({ ...plain, sport: 'nba' }, h));
  const outlineOfSprite = (look, px) => {
    const sp = body.drawBody(look, mocap.mocapJoints('ready', 10, look, { ground: 'clip' }), { facing: 0.9, pitch: 0.45 }, px);
    const cv = sp.canvas,
      W = cv.width,
      H = cv.height;
    const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
    const colour = (x, y) => {
      const i = (y * W + x) * 4;
      return key(d[i], d[i + 1], d[i + 2]);
    };
    // every colour drawn, and the outline colour each would get (color.ts outlineOf, the line today)
    const drawn = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (op(x, y)) drawn.add(colour(x, y));
    const lineCols = new Set([...drawn].map((k) => keyOf(outlineOf([(k >> 16) & 255, (k >> 8) & 255, k & 255]))));
    lineCols.add(key(0x14, 0x12, 0x1c));
    const edgeHist = new Map();
    let edge = 0,
      edgeV2 = 0,
      inner = 0,
      innerLine = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!op(x, y)) continue;
        const k = colour(x, y);
        if (!op(x + 1, y) || !op(x - 1, y) || !op(x, y + 1) || !op(x, y - 1)) {
          edge++;
          edgeHist.set(k, (edgeHist.get(k) ?? 0) + 1);
          if (k === key(0x14, 0x12, 0x1c)) edgeV2++;
        } else {
          inner++;
          if (lineCols.has(k)) innerLine++;
        }
      }
    const hex = (k) => '#' + k.toString(16).padStart(6, '0');
    return { edge, edgeV2Share: Math.round((1000 * edgeV2) / Math.max(1, edge)) / 1000, edgeColours: edgeHist.size, edgeTop: [...edgeHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${hex(k)} ${Math.round((100 * n) / edge)}%`), inner, innerLinePx: innerLine, innerLineShare: Math.round((1000 * innerLine) / Math.max(1, inner)) / 1000 };
  };
  // V2 C.1.3 shading, from the raster's material slots: tones per main material and the rim light
  const shadingOf = (look, px) => {
    const r = body.rasterBody(look, mocap.mocapJoints('ready', 10, look, { ground: 'clip' }), { facing: 0.9, pitch: 0.45 }, px);
    const W = r.w,
      H = r.h;
    const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && r.slot[y * W + x] > 0;
    const lumaOf = (c) => 0.299 * (c & 255) + 0.587 * ((c >>> 8) & 255) + 0.114 * ((c >>> 16) & 255);
    const tones = new Map();
    for (let i = 0; i < W * H; i++) {
      if (!r.slot[i]) continue;
      let t = tones.get(r.slot[i]);
      if (!t) tones.set(r.slot[i], (t = new Map()));
      t.set(r.px[i], (t.get(r.px[i]) ?? 0) + 1);
    }
    // a material's tones: colours covering at least 2 px (a stray number or eye pixel is not a tone)
    const toneCount = (slot) => [...(tones.get(slot)?.values() ?? [])].filter((n) => n >= 2).length;
    const brightest = new Map([...tones].map(([slot, t]) => [slot, Math.max(...[...t.keys()].map(lumaOf))]));
    let rimPx = 0,
      rimLit = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!r.slot[i] || filled(x - 1, y - 1)) continue;
        rimPx++;
        if (lumaOf(r.px[i]) >= brightest.get(r.slot[i]) - 0.5) rimLit++;
      }
    const M = body.MATERIAL_SLOT;
    const main = { skin: M.skin, jersey: M.jersey, shorts: sport === 'nfl' ? M.pants : M.shorts, socks: M.socks };
    const perMaterial = Object.fromEntries(Object.entries(main).map(([k, slot]) => [k, toneCount(slot)]));
    const present = Object.values(perMaterial).filter((n) => n > 0);
    return { tonesPerMaterial: perMaterial, tonesMin: present.length ? Math.min(...present) : 0, rimPx, rimShare: Math.round((1000 * rimLit) / Math.max(1, rimPx)) / 1000 };
  };
  const outline = found.map((rc) => ({ name: rc.line.name, ...outlineOfSprite(lookOf(rc.line), 34), ...shadingOf(lookOf(rc.line), 34) }));
  const builds = [];
  if (sport === 'nba') {
    const who = [
      ['Curry', 74, 185],
      ['Shaq', 85, 325],
      ['Rodman', 79, 210],
      ['Manute Bol', 91, 200],
      ['Yao', 90, 310],
      ['Bogues', 63, 136],
      ['Jokic', 83, 284],
      ['Giannis', 83, 243],
      ['BMI 20 (78 in)', 78, Math.round((20 * 78 * 78) / 703)],
      ['BMI 31 (78 in)', 78, Math.round((31 * 78 * 78) / 703)],
    ];
    for (const [label, ht, wt] of who) for (const px of [24, 34, 40, 60]) builds.push({ label, ht, wt, pxAt78: px, ...torso({ ...base, ht, wt }, px) });
  } else {
    // the same view, each star's own card build in the shared kit
    for (const rc of found) for (const px of [24, 34, 40, 60]) builds.push({ label: rc.line.name, ht: rc.line.ht, wt: rc.line.wt ?? null, pxAt78: px, ...torso(shared(lookOf(rc.line)), px) });
  }
  // ---- numbers (L-5): legibility by size and facing ----
  let numbers = null;
  if (withNumbers) {
    const nums = [23, 80, 88, 12, 99, 7];
    const facings = [
      [Math.PI / 2, 'front'],
      [1.2, 'card 1.2'],
      [0.9, '0.9'],
      [0.6, '0.6'],
      [0.35, '0.35'],
    ];
    const sizes = [26, 40, 56, 80];
    const cw = 92;
    const n = document.createElement('canvas');
    n.width = 120 + nums.length * cw;
    n.height = sizes.length * facings.length * 60 + 40;
    const ng = n.getContext('2d');
    ng.imageSmoothingEnabled = false;
    ng.fillStyle = '#c98d55';
    ng.fillRect(0, 0, n.width, n.height);
    ng.font = 'bold 11px sans-serif';
    let row = 0;
    for (const px of sizes)
      for (const [f, lab] of facings) {
        const y = 20 + row * 60;
        ng.fillStyle = '#000';
        ng.fillText(px + 'px ' + lab, 4, y + 30);
        nums.forEach((num, i) => {
          const look = { ...base, ht: 78, wt: 215, num };
          const sp = body.drawBody(look, P.idle(0.15), { facing: f, pitch: 0.3 }, px);
          const hh = Math.round(px * 0.55);
          const kk = 52 / hh;
          ng.drawImage(sp.canvas, 0, sp.top, sp.canvas.width, hh, 110 + i * cw, y - 2, sp.canvas.width * kk, hh * kk);
        });
        row++;
      }
    numbers = n.toDataURL();
  }
  return { url: c.toDataURL(), info, identity, builds, numbers, proportions, outline, appearance, missing: names.filter((n) => !found.some((rc) => rc.line.name === n)) };
}

// V2 C.1.4's option names (plan players-3 `appearance.ts`)
const DYED = ['red', 'blue', 'green', 'pink', 'purple'];
const LONG = ['flow', 'ponytail', 'bun', 'locs-long', 'braids', 'band-bound'];
const SHORT = ['bald', 'buzz', 'short', 'fade'];
const curated = (a) => !!a && a.src === 'curated';
/**
 * The owner-named looks (STREAM players P0), judged on the appearance record: `a` is the star's record
 * at his best card's season, `all` every season's record, `row` his source row (`reviewed`).
 */
const OWNER = {
  nba: [
    ["Shaquille O'Neal", 'shaved head', ({ a }) => curated(a) && a.hair === 'bald'],
    ['Allen Iverson', 'cornrows and a headband', ({ a }) => curated(a) && a.hair === 'cornrows' && a.head === 'band'],
    ['Kareem Abdul-Jabbar', 'goggles', ({ a }) => curated(a) && a.eyes === 'goggles'],
    // dyed by season: some season of his 1994-98 cards (the Spurs and Bulls years) in a V2 dyed tone
    ['Dennis Rodman', 'dyed hair (1994-98)', ({ all }) => Object.entries(all).some(([se, x]) => +String(se).slice(0, 4) >= 1994 && +String(se).slice(0, 4) <= 1998 && curated(x) && DYED.includes(x.hairTone))],
  ],
  nfl: [['Tom Brady', 'a curated Tier A row, reviewed', ({ a, row }) => curated(a) && !!row && row.reviewed === true]],
  soccer: [
    ['Erling Haaland', 'long blond hair', ({ a }) => curated(a) && a.hairTone === 'blond' && LONG.includes(a.hair)],
    ['Kylian Mbappé', 'short, clean-shaven', ({ a }) => curated(a) && SHORT.includes(a.hair) && a.facial === 'none'],
  ],
};

/** The star's row in the curated source file, matched by pid or name (players-3's format). */
function sourceRow(sport, pid, name) {
  const f = path.join(ROOT, 'src/data/appearance/source', `${sport}.looks.json`);
  if (!fs.existsSync(f)) return null;
  let hit = null;
  const walk = (x) => {
    if (hit || !x || typeof x !== 'object') return;
    if (!Array.isArray(x) && (x.pid === pid || x.name === name)) return void (hit = x);
    for (const v of Object.values(x)) walk(v);
  };
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    // a map keyed by pid
    if (j && typeof j === 'object' && !Array.isArray(j) && j[pid] && typeof j[pid] === 'object') return j[pid];
    walk(j);
  } catch {
    return null;
  }
  return hit;
}

await needServer();
const results = await withBrowser(async (browser) => {
  const out = [];
  for (const sport of sports) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    await isolate(context);
    const page = await context.newPage();
    const errors = watchErrors(page);
    await page.goto(appUrl({ pixel: 'x', sport }), { waitUntil: 'load' });
    const r = await page.evaluate(draw, { names: STARS[sport], sport, withNumbers: sport === 'nba' });
    const file = path.join(OUT, `${tag}-lineup-${sport}.png`);
    fs.writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'));
    let numbersFile = null;
    if (r.numbers) fs.writeFileSync((numbersFile = path.join(OUT, `${tag}-numbers.png`)), Buffer.from(r.numbers.split(',')[1], 'base64'));
    const identity = {};
    for (const [px, pairs] of Object.entries(r.identity)) {
      const ds = pairs.map((p) => p.d);
      identity[px + 'px'] = {
        pairs: pairs.length,
        sharePairsAtLeast8pct: round(pairs.filter((p) => p.d >= 0.08).length / Math.max(1, pairs.length), 3),
        sharePairsAtLeast12pct: round(pairs.filter((p) => p.d >= 0.12).length / Math.max(1, pairs.length), 3),
        minPct: round(100 * Math.min(...ds), 1),
        p10Pct: round(100 * quantile(ds, 0.1), 1),
        p50Pct: round(100 * quantile(ds, 0.5), 1),
        closest: [...pairs]
          .sort((a, b) => a.d - b.d)
          .slice(0, 5)
          .map((p) => `${p.a} / ${p.b} ${(100 * p.d).toFixed(1)}%`),
      };
    }
    const torso40 = Object.fromEntries(r.builds.filter((b) => b.pxAt78 === 40).map((b) => [b.label, b.torsoW]));
    const torso34 = Object.fromEntries(r.builds.filter((b) => b.pxAt78 === 34).map((b) => [b.label, b.torsoW]));
    // V2 C.1.1: heads tall and the head box (w x h, with hair) per sprite-height band
    const V2_HEADS = { 20: [4.5, 5, 5], 24: [5, 6, 6], 34: [5.5, 7, 8], 60: [6, 12, 13] };
    const proportions = r.proportions.map((p) => {
      const [heads, bw, bh] = V2_HEADS[p.artH];
      return { ...p, target: { headsTall: heads, headW: bw, headH: bh }, ok: Math.abs(p.headsTall - heads) <= 0.25 && Math.abs(p.headW - bw) <= 1 && Math.abs(p.headH - bh) <= 1 };
    });
    const ol = r.outline;
    const outline = { stars: ol.length, edgeV2ShareMin: Math.min(...ol.map((o) => o.edgeV2Share)), edgeColoursP50: quantile(ol.map((o) => o.edgeColours), 0.5), innerLinePxP50: quantile(ol.map((o) => o.innerLinePx), 0.5), innerLineShareMax: Math.max(...ol.map((o) => o.innerLineShare)), tonesMin: Math.min(...ol.map((o) => o.tonesMin)), rimShareMin: Math.min(...ol.map((o) => o.rimShare)), rimShareP50: quantile(ol.map((o) => o.rimShare), 0.5), each: ol };
    const owner = (OWNER[sport] ?? []).map(([name, want, ok]) => {
      const l = r.info.find((x) => x.name === name);
      const drawnAs = l ? { hair: l.hair, beard: l.beard, hairColor: l.hairColor, skin: l.skin } : null;
      if (!l) return { name, want, correct: false, missing: 'no card', drawnAs };
      if (!r.appearance.built) return { name, want, correct: null, notBuilt: 'players-3', drawnAs };
      const rec = r.appearance.byName[name] ?? { best: null, bySeason: {} };
      return { name, want, correct: !!ok({ a: rec.best, all: rec.bySeason, row: sourceRow(sport, l.pid, name) }), record: rec.best, drawnAs };
    });
    out.push({ sport, sheet: file, numbersSheet: numbersFile, missing: r.missing, appearanceBuilt: r.appearance.built, appearanceError: r.appearance.error, stars: r.info, distinctSkins: new Set(r.info.map((l) => l.skin)).size, distinctHairColors: new Set(r.info.map((l) => l.hairColor)).size, identity, torso40, torso34, proportions, outline, builds: r.builds, ownerExamples: owner, pageErrors: errors.slice(0, 3) });
    await context.close();
  }
  return out;
});
emit('players-lineup-' + tag, { results });
