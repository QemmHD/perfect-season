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
// - NBA: torso width by build at 24/40/60 px (the audit's eight bodies plus BMI 20 vs 31); soccer:
//   Haaland vs Messi; `<tag>-numbers.png`, the jersey-number legibility sheet.
//
//   node scripts/qa/players-lineup.mjs [--sport nba,nfl,soccer] [--tag before] [--out DIR]
import fs from 'node:fs';
import path from 'node:path';
import { appUrl, emit, listOf, needServer, OUT, opts, quantile, round, SPORTS, watchErrors, withBrowser, isolate } from './players-lib.mjs';

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
    info.push({ name: rc.line.name, pid: rc.line.pid, season: rc.line.season, team: rc.line.abbr, ovr: rc.ovr, ht: rc.line.ht, wt: rc.line.wt ?? null, num: rc.line.num ?? null, hair: look.hair, beard: !!look.beard, skin: look.skin, hairColor: look.hairColor, lookHt: round1(look.ht), lookWt: round1(look.wt) });
  });
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
  for (const px of [24, 40, 60]) {
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
    for (const [label, ht, wt] of who) for (const px of [24, 40, 60]) builds.push({ label, ht, wt, pxAt78: px, ...torso({ ...base, ht, wt }, px) });
  } else {
    // the same view, each star's own card build in the shared kit
    for (const rc of found) for (const px of [24, 40, 60]) builds.push({ label: rc.line.name, ht: rc.line.ht, wt: rc.line.wt ?? null, pxAt78: px, ...torso(shared(lookOf(rc.line)), px) });
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
  return { url: c.toDataURL(), info, identity, builds, numbers, missing: names.filter((n) => !found.some((rc) => rc.line.name === n)) };
}

const OWNER = {
  nba: [
    ["Shaquille O'Neal", 'shaved head', (l) => l.hair === 3],
    ['Allen Iverson', 'cornrows', () => false],
    ['Kareem Abdul-Jabbar', 'goggles', () => false],
    ['Dennis Rodman', 'dyed hair', (l) => l.hairColor !== '#1d1612'],
  ],
  nfl: [['Tom Brady', 'his own look (judged by eye in players-7)', () => null]],
  soccer: [
    ['Erling Haaland', 'long blond hair', (l) => l.hairColor !== '#1d1612'],
    ['Kylian Mbappé', 'short, clean-shaven', (l) => !l.beard && (l.hair === 0 || l.hair === 1)],
  ],
};

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
    const owner = (OWNER[sport] ?? []).map(([name, want, ok]) => {
      const l = r.info.find((x) => x.name === name);
      return { name, want, correct: l ? ok(l) : null, drawnAs: l ? { hair: l.hair, beard: l.beard, hairColor: l.hairColor, skin: l.skin } : null };
    });
    out.push({ sport, sheet: file, numbersSheet: numbersFile, missing: r.missing, stars: r.info, distinctSkins: new Set(r.info.map((l) => l.skin)).size, distinctHairColors: new Set(r.info.map((l) => l.hairColor)).size, identity, torso40, builds: r.builds, ownerExamples: owner, pageErrors: errors.slice(0, 3) });
    await context.close();
  }
  return out;
});
emit('players-lineup-' + tag, { results });
