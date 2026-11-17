// The looks gallery (?pixel=looks, studio overhaul players-4): every trait the raster draws, at the
// sizes the games use, for judging the art by eye. Not linked from the app's menus, lazy (its own
// chunk inside the pixel gallery's), and storage-free: it reads the card and appearance data and
// writes nothing.
//
// 1. The owner's seven examples (lineup-stars.ts), each in the season that shows his look.
// 2. The 18 hair silhouettes x 16/20/24/34/60 art px x 4 facings, and a second kit.
// 3. Facial hair, head gear, goggles, the mouthguard, arm and leg gear, socks.
// 4. Football heads: the helmet with its centre stripe, three visors, hair out of the back, a towel.
// 5. The 10 skin tones against 8 kits (dark skin on a dark kit keeps its lit rim).
// 6. Each sport's lineup stars in their own colours and in one shared kit.
// 7. The venue: the surface tokens, the crowd's bands and flecks, the textures and the vignette.
import React, { useEffect, useRef, useState } from 'react';
import { pickFor } from '../../engine/sport';
import { loadCards } from '../../ut/cards';
import type { CardLine } from '../../ut/types';
import { type Appearance, ARM, appearanceFor, FACIAL, HAIR, hairHex, LEG, loadAppearance, NEUTRAL_SKIN, SKIN_TONES, skinTone, SOCKS, type Sport } from './appearance';
import { drawBody, freeCanvas, type Look, type Sprite } from './body';
import { CROWD_BANDS, crowdAt, crowdPalette } from './crowd';
import { OWNER_EXAMPLES, STARS } from './lineup-stars';
import { cardLook, type KitColors, matchLook } from './looks';
import { courtTexture, type FieldTex, fieldTexture } from './persp';
import { pitchTexture } from './pitch';
import { idle } from './poses';
import type { View } from './rig';
import { drawVignette, TEAM_PAINT, VENUE, VIGNETTE } from './venue';

const SIZES = [16, 20, 24, 34, 60];
const FACINGS: [string, number][] = [
  ['front', Math.PI / 2],
  ['3/4', 0.9],
  ['side', 0],
  ['back', -Math.PI / 2],
];
const PITCH = 0.35;
/** Two kits for the trait rows: a dark one and a light one. */
const KIT_A: [string, string] = ['#1d428a', '#ffc72c'];
const KIT_B: [string, string] = ['#f4f4f4', '#ce1141'];
/** Eight kits for the skin contrast grid, light to dark. */
const KITS8: [string, string][] = [
  ['#f4f4f4', '#ce1141'],
  ['#fdb927', '#552583'],
  ['#00b2a9', '#0b162a'],
  ['#e56020', '#1d1160'],
  ['#007a33', '#ffffff'],
  ['#ce1141', '#000000'],
  ['#1d428a', '#ffc72c'],
  ['#0b0b0e', '#c4ced4'],
];

const BG = '#14121c';
const INK = '#ece8f4';
const DIM = '#a49cbc';

/** A kit in the colours `look` needs, by sport. */
function kitColors(sport: Sport, [c1, c2]: [string, string]): KitColors {
  return pickFor(sport, {
    nba: { jersey: c1, trim: c2, shorts: c1, socks: '#f2f2f2', shoes: '#1b1b1f' },
    nfl: { jersey: c1, trim: c2, shorts: '#e8e8e4', socks: c1, shoes: '#1b1b1f', helmet: c1, stripe: c2, mask: '#9aa0a6', pants: '#e8e8e4' },
    soccer: { jersey: c1, trim: c2, shorts: c1, socks: c1, shoes: '#1b1b1f' },
  });
}

/** A made-up player wearing one trait (and the neutral defaults for the rest), in a kit. */
function traitLook(sport: Sport, kit: [string, string], patch: Partial<Appearance>, num: number | null = 23): Look {
  const base = matchLook(sport, null, kitColors(sport, kit), { id: 'gallery', num, ht: pickFor(sport, { nba: 78, nfl: 74, soccer: 180 }), wt: pickFor(sport, { nba: 215, nfl: 225, soccer: null }) });
  const app: Appearance = { ...base.app, hair: 'short', hairTone: 'black', facial: 'none', head: 'none', eyes: 'none', armL: 'none', armR: 'none', legL: 'none', legR: 'none', skin: 6, mouthguard: false, towel: false, helmetHair: 'none', ...patch };
  return { ...base, app, skin: app.skin === undefined ? NEUTRAL_SKIN : skinTone(app.skin), hairColor: hairHex(app.hairTone, kit[0]) };
}

/** The shared kit the identity row uses (likeness.helpers.ts). */
function shared(look: Look): Look {
  return { ...look, ...kitColors(look.sport, ['#1d428a', '#ffc72c']), socks: pickFor(look.sport, { nba: '#f2f2f2', nfl: '#1d428a', soccer: '#f2f2f2' }) };
}

const pose = idle(0.15);
const draw = (look: Look, px: number, view: View): Sprite => drawBody(look, pose, view, px);

interface Cell {
  sp: Sprite;
  cap?: string;
}
interface Row {
  label: string;
  cells: Cell[];
}

/** A sheet of labelled rows of sprites, drawn once into one canvas at an integer scale. */
function Sheet({ rows, scale }: { rows: Row[]; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  // drawn once: the sprites' canvases are let go after, so a second run (React's strict mode) has nothing to draw
  const drawn = useRef<Row[] | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || drawn.current === rows) return;
    drawn.current = rows;
    const LABEL = 150;
    const GAP = 8;
    // each sprite cropped to its drawn pixels (the canvases carry room for any pose), feet aligned
    const crops = rows.map((r) => r.cells.map((cell) => cropOf(cell.sp)));
    const above = crops.map((cs) => Math.max(1, ...cs.map((c) => c.ay - c.y0)) * scale);
    const below = crops.map((cs) => Math.max(1, ...cs.map((c) => c.y1 - c.ay)) * scale);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.font = '12px system-ui, sans-serif';
    const heights = rows.map((r, i) => Math.max(above[i] + below[i] + 22, wrap(ctx, r.label, 0, 0, LABEL - 12, false) * 14 + 12));
    let w = 0;
    let h = 8;
    for (const [i, cs] of crops.entries()) {
      w = Math.max(w, LABEL + cs.reduce((sum, c) => sum + Math.max(c.x1 - c.x0, 6) * scale + GAP, 0));
      h += heights[i];
    }
    c.width = Math.max(1, w + 8);
    c.height = Math.max(1, h);
    setSize({ w: c.width, h: c.height });
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, c.width, c.height);
    let y = 8;
    rows.forEach((r, i) => {
      ctx.fillStyle = INK;
      ctx.font = '12px system-ui, sans-serif';
      wrap(ctx, r.label, 6, y + 14, LABEL - 12);
      let x = LABEL;
      // every sprite stands on the row's floor line
      const floor = y + 4 + above[i];
      r.cells.forEach((cell, j) => {
        const k = crops[i][j];
        const cw = k.x1 - k.x0;
        ctx.drawImage(cell.sp.canvas, k.x0, k.y0, cw, k.y1 - k.y0, x, floor - (k.ay - k.y0) * scale, cw * scale, (k.y1 - k.y0) * scale);
        if (cell.cap) {
          ctx.fillStyle = DIM;
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(cell.cap, x, floor + below[i] + 13);
        }
        x += Math.max(cw, 6) * scale + GAP;
      });
      y += heights[i];
    });
    // the sprites are on the sheet now: let their canvases go (iOS caps a page's canvas memory)
    for (const r of rows) for (const cell of r.cells) freeCanvas(cell.sp.canvas);
  }, [rows, scale]);
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <canvas ref={ref} style={{ width: size.w, height: size.h, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

/** A sprite's drawn pixels: the box round everything opaque on its canvas, and its feet. */
function cropOf(sp: Sprite): { x0: number; y0: number; x1: number; y1: number; ay: number } {
  const { canvas } = sp;
  const g = canvas.getContext('2d');
  const box = { x0: 0, y0: 0, x1: canvas.width, y1: canvas.height, ay: Math.round(sp.ay) };
  if (!g || !canvas.width || !canvas.height) return box;
  const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width,
    y0 = canvas.height,
    x1 = 0,
    y1 = 0;
  for (let yy = 0; yy < canvas.height; yy++)
    for (let xx = 0; xx < canvas.width; xx++)
      if (d[(yy * canvas.width + xx) * 4 + 3]) {
        x0 = Math.min(x0, xx);
        y0 = Math.min(y0, yy);
        x1 = Math.max(x1, xx + 1);
        y1 = Math.max(y1, yy + 1);
      }
  return x1 > x0 ? { x0, y0, x1, y1: Math.max(y1, box.ay), ay: box.ay } : box;
}

/** Write `text` wrapped to `max` px wide from (x, y) (or only count when `draw` is false): the lines it takes. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, draw = true): number {
  let line = '';
  let lines = 1;
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > max && line) {
      if (draw) ctx.fillText(line, x, y);
      line = word;
      y += 14;
      lines++;
    } else line = next;
  }
  if (draw) ctx.fillText(line, x, y);
  return lines;
}

/** Every size at every facing, for one look. */
function sizesAndFacings(look: Look): Cell[] {
  const cells: Cell[] = [];
  for (const px of SIZES) for (const [name, facing] of FACINGS) cells.push({ sp: draw(look, px, { facing, pitch: PITCH }), cap: name === 'front' ? px + ' px' : undefined });
  return cells;
}

/** The season line nearest `season` for a name (the regular season card). */
function lineNear(lines: CardLine[], name: string, season?: number): CardLine | undefined {
  let best: CardLine | undefined;
  for (const l of lines) {
    if (l.name !== name || l.kind !== 'season') continue;
    if (!best) best = l;
    else if (season !== undefined ? Math.abs(l.season - season) < Math.abs(best.season - season) : (l.games ?? 0) > (best.games ?? 0)) best = l;
  }
  return best;
}

function traitsOf(a: Appearance): string {
  const parts = [a.hair, a.hairTone, a.facial !== 'none' && a.facial, a.head !== 'none' && a.head, a.eyes !== 'none' && a.eyes, a.armL !== 'none' && 'L ' + a.armL, a.armR !== 'none' && 'R ' + a.armR, a.helmetHair && a.helmetHair !== 'none' && 'helmet hair ' + a.helmetHair, a.skin !== undefined && 'skin ' + (a.skin + 1)];
  return parts.filter(Boolean).join(', ');
}

type Data = Record<Sport, CardLine[]>;

function sections(d: Data) {
  const out: { title: string; note: string; rows: Row[] }[] = [];

  // 1. the owner's examples
  out.push({
    title: "The owner's seven examples",
    note: 'Each in his own colours and the season that shows the look; front and three-quarter at 60 art px, then 34 and 24. The caption reads back the record the raster drew.',
    rows: OWNER_EXAMPLES.map((ex) => {
      const line = lineNear(d[ex.sport], ex.name, ex.season);
      if (!line) return { label: ex.name + ': no card', cells: [] };
      const look = cardLook(line);
      const views: [number, View][] = [
        [60, { facing: Math.PI / 2, pitch: PITCH }],
        [60, { facing: 0.9, pitch: PITCH }],
        [34, { facing: 0.9, pitch: PITCH }],
        [24, { facing: 0.9, pitch: PITCH }],
        [34, { facing: -Math.PI / 2, pitch: PITCH }],
      ];
      return { label: `${ex.name} ${line.season}: ${ex.shows}. Drawn: ${traitsOf(look.app)}`, cells: views.map(([px, v]) => ({ sp: draw(look, px, v), cap: px + ' px' })) };
    }).filter((r) => r.cells.length),
  });

  // 2. hair
  out.push({
    title: 'Hair: 18 silhouettes',
    note: 'Each style at 16, 20, 24, 34 and 60 art px, front, three-quarter, side and back. Below 24 art px they collapse to four silhouettes (none, cap, tall, long). The last cell is the light kit at 34.',
    rows: HAIR.map((hair) => ({
      label: hair,
      cells: [...sizesAndFacings(traitLook('nba', KIT_A, { hair })), { sp: draw(traitLook('nba', KIT_B, { hair, hairTone: 'brown', skin: 2 }), 34, { facing: 0.9, pitch: PITCH }), cap: 'kit B' }],
    })),
  });

  // 3. faces and gear
  const at = (look: Look): Cell[] =>
    [20, 34, 60].flatMap((px) => [
      { sp: draw(look, px, { facing: Math.PI / 2, pitch: PITCH }), cap: px + ' px' },
      { sp: draw(look, px, { facing: 0.9, pitch: PITCH }) },
    ]);
  out.push({
    title: 'Facial hair, head gear and goggles',
    note: 'Facial hair from 20 art px (a full beard below too); the mouthguard from 24.',
    rows: [
      ...FACIAL.map((facial) => ({ label: 'facial: ' + facial, cells: at(traitLook('nba', KIT_A, { facial, hair: 'short' })) })),
      ...(['band', 'wrap', 'skullcap'] as const).map((head) => ({ label: 'head: ' + head, cells: at(traitLook('nba', KIT_A, { head, headC: 'white' })) })),
      { label: 'goggles', cells: at(traitLook('nba', KIT_A, { eyes: 'goggles', hair: 'receding' })) },
      { label: 'mouthguard', cells: at(traitLook('nba', KIT_A, { mouthguard: true })) },
    ],
  });
  out.push({
    title: 'Arm and leg gear, socks',
    note: 'Sleeves on the right arm, leg gear on both legs. Wristbands and tape from 34 art px.',
    rows: [
      ...ARM.filter((a) => a !== 'none').map((arm) => ({ label: 'arm: ' + arm, cells: at(traitLook('nba', KIT_A, { armR: arm })) })),
      ...LEG.filter((l) => l !== 'none').map((leg) => ({ label: 'leg: ' + leg, cells: at(traitLook('nba', KIT_A, { legL: leg, legR: leg })) })),
      ...SOCKS.map((socks) => ({ label: 'socks: ' + socks, cells: [...at(traitLook('nba', KIT_A, { socks })), ...at(traitLook('soccer', KIT_B, { socks }))] })),
    ],
  });

  // 4. football heads
  const fb = (patch: Partial<Appearance>): Cell[] =>
    [23, 34, 60].flatMap((px) => [
      { sp: draw(traitLook('nfl', KIT_A, patch, 12), px, { facing: Math.PI / 2, pitch: 0.3 }), cap: px + ' px' },
      { sp: draw(traitLook('nfl', KIT_A, patch, 12), px, { facing: 0.9, pitch: 0.45 }) },
      { sp: draw(traitLook('nfl', KIT_A, patch, 12), px, { facing: -2.2, pitch: 0.4 }) },
    ]);
  out.push({
    title: 'Football: helmet, visor, hair out of the back',
    note: 'The centre stripe on a blank shell (no logos); clear, dark and tinted visors; locs, flow and curls out of the back of the helmet; a towel from 24 art px.',
    rows: [
      { label: 'helmet', cells: fb({}) },
      { label: 'visor: clear', cells: fb({ eyes: 'visor-clear' }) },
      { label: 'visor: dark', cells: fb({ eyes: 'visor-dark' }) },
      { label: 'visor: tint', cells: fb({ eyes: 'visor-tint' }) },
      { label: 'hair: locs', cells: fb({ helmetHair: 'locs' }) },
      { label: 'hair: flow', cells: fb({ helmetHair: 'flow' }) },
      { label: 'hair: curly', cells: fb({ helmetHair: 'curly' }) },
      { label: 'towel', cells: fb({ towel: true }) },
    ],
  });

  // 5. skin x kits
  out.push({
    title: 'Ten skin tones against eight kits',
    note: 'At 34 art px, three-quarter. Dark skin on a dark kit keeps a lit rim so the arms never sink into the jersey.',
    rows: SKIN_TONES.map((_, i) => ({ label: 'tone ' + (i + 1), cells: KITS8.map((k) => ({ sp: draw(traitLook('nba', k, { skin: i }), 34, { facing: 0.9, pitch: PITCH }) })) })),
  });

  // 6. the stars
  for (const sport of ['nba', 'nfl', 'soccer'] as const) {
    const lines = STARS[sport].map((n) => lineNear(d[sport], n)).filter((l): l is CardLine => !!l);
    const looks = lines.map(cardLook);
    const view: View = { facing: 0.9, pitch: 0.45 };
    out.push({
      title: pickFor(sport, { nba: 'NBA', nfl: 'NFL', soccer: 'Soccer' }) + ' lineup stars',
      note: 'Own colours at 60 art px; then the shared kit at 60, 34 and 24 (the identity row: who is who without the colours).',
      rows: [
        { label: 'own kit, 60 px', cells: looks.map((l, i) => ({ sp: draw(l, 60, view), cap: lines[i].name.split(' ').pop() })) },
        ...[60, 34, 24].map((px) => ({ label: 'shared kit, ' + px + ' px', cells: looks.map((l) => ({ sp: draw(shared(l), px, view) })) })),
      ],
    });
  }
  return out;
}

/** The venue: the tokens as swatches, the crowd's bands and flecks, the three textures and the vignette. */
function Venue() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.width = 1200;
    c.height = 920;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '12px system-ui, sans-serif';
    const label = (t: string, x: number, y: number) => {
      ctx.fillStyle = INK;
      ctx.fillText(t, x, y);
    };
    const swatch = (hex: string, x: number, y: number, name: string) => {
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, 44, 44);
      ctx.fillStyle = DIM;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(name, x, y + 56);
      ctx.font = '12px system-ui, sans-serif';
    };
    let x = 8;
    label('Surface tokens', 8, 18);
    for (const [name, hex] of [
      ['plank a', VENUE.nba.planks[0]],
      ['plank b', VENUE.nba.planks[1]],
      ['nba line', VENUE.nba.lines],
      ['nfl mow a', VENUE.nfl.mow[0]],
      ['nfl mow b', VENUE.nfl.mow[1]],
      ['nfl line', VENUE.nfl.lines],
      ['soc mow a', VENUE.soccer.mow[0]],
      ['soc mow b', VENUE.soccer.mow[1]],
      ['soc line', VENUE.soccer.lines],
      ...CROWD_BANDS.map((b, i) => ['crowd ' + (i + 1), b]),
    ] as [string, string][]) {
      swatch(hex, x, 28, name);
      x += 54;
    }
    label(`Team paint at ${TEAM_PAINT * 100}% saturation; corners ${VIGNETTE * 100}% darker`, 8, 110);
    // the crowd for four home colours: three bands, nearest (bottom) lightest, 2 px flecks
    label('Crowd: three dark bands, flecks of the home colour and white in 2 px blocks', 8, 140);
    const homes = ['#ce1141', '#1d428a', '#007a33', '#fdb927'];
    homes.forEach((home, k) => {
      const p = crowdPalette(home);
      const img = ctx.createImageData(120, 72);
      for (let y = 0; y < 72; y++)
        for (let xx = 0; xx < 120; xx++) {
          const col = crowdAt(p, xx, y, (2 - Math.floor(y / 24)) as 0 | 1 | 2, k);
          const i = (y * 120 + xx) * 4;
          img.data[i] = col[0];
          img.data[i + 1] = col[1];
          img.data[i + 2] = col[2];
          img.data[i + 3] = 255;
        }
      const tmp = document.createElement('canvas');
      tmp.width = 120;
      tmp.height = 72;
      tmp.getContext('2d')?.putImageData(img, 0, 0);
      ctx.drawImage(tmp, 8 + k * 260, 150, 240, 144);
      freeCanvas(tmp);
    });
    // the three textures, top-down, at their smallest level
    label('The surfaces, top-down (their smallest texture level)', 8, 320);
    const texs: [string, FieldTex][] = [
      ['court', courtTexture({ c1: '#ce1141', c2: '#ffffff', abbr: 'CHI' })],
      ['field', fieldTexture({ homeC1: '#e31837', homeC2: '#ffb81c', homeName: 'Chiefs', awayC1: '#002244', awayC2: '#c60c30', awayName: 'Patriots' })],
      ['pitch', pitchTexture({ homeC1: '#c8102e', homeC2: '#00b2a9', awayC1: '#034694' })],
    ];
    let tx = 8;
    for (const [, t] of texs) {
      const lv = t.lv[t.lv.length - 1];
      const img = new ImageData(new Uint8ClampedArray(lv.px.buffer.slice(0)), lv.w, lv.h);
      const tmp = document.createElement('canvas');
      tmp.width = lv.w;
      tmp.height = lv.h;
      tmp.getContext('2d')?.putImageData(img, 0, 0);
      const s = Math.min(380 / lv.w, 400 / lv.h);
      ctx.drawImage(tmp, tx, 330, lv.w * s, lv.h * s);
      freeCanvas(tmp);
      tx += 396;
    }
    // the vignette over a flat mid grey
    const v = document.createElement('canvas');
    v.width = 300;
    v.height = 150;
    const vc = v.getContext('2d');
    if (vc) {
      vc.fillStyle = '#808080';
      vc.fillRect(0, 0, 300, 150);
      drawVignette(vc, 300, 150);
      label('The vignette over flat grey', 8, 752);
      ctx.drawImage(v, 8, 760);
    }
    freeCanvas(v);
  }, []);
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <canvas ref={ref} style={{ width: 1200, height: 920, display: 'block' }} />
    </div>
  );
}

export default function LooksGallery() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const scale = Math.max(1, Math.min(6, Math.round(Number(new URLSearchParams(location.search).get('scale') ?? 3)) || 3));
  useEffect(() => {
    let live = true;
    const sports = ['nba', 'nfl', 'soccer'] as const;
    Promise.all([...sports.map((s) => loadAppearance(s)), ...sports.map((s) => loadCards(s))])
      .then((r) => {
        if (!live) return;
        const pools = r.slice(3) as Awaited<ReturnType<typeof loadCards>>[];
        setData({ nba: pools[0].lines, nfl: pools[1].lines, soccer: pools[2].lines });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  const [list, setList] = useState<ReturnType<typeof sections> | null>(null);
  useEffect(() => {
    if (data) setList(sections(data));
  }, [data]);
  return (
    <div style={{ background: BG, color: INK, minHeight: '100vh', padding: 16, boxSizing: 'border-box', font: '14px system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Looks gallery</h1>
      <p style={{ color: DIM, margin: '0 0 16px', maxWidth: 720 }}>
        Every trait the player raster draws, at match sizes (art px; scale {scale}x here). Checked by eye; the numbers behind it are in head, numbers, likeness, kits and venue tests.
      </p>
      {failed && <p>The card data didn't load.</p>}
      {!data && !failed && <p data-looks-loading>Loading the card and appearance data…</p>}
      {list?.map((s) => (
        <section key={s.title} data-looks-section={s.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 2px' }}>{s.title}</h2>
          <p style={{ color: DIM, margin: '0 0 8px', maxWidth: 720 }}>{s.note}</p>
          <Sheet rows={s.rows} scale={scale} />
        </section>
      ))}
      {list && (
        <section data-looks-section="venue" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 2px' }}>The venue palette</h2>
          <Venue />
        </section>
      )}
      {list && <p data-looks-ready style={{ color: DIM }}>{appearanceFor('nba', 'onealsh01', 2000).src === 'curated' ? 'Curated looks loaded.' : 'Defaults only: the appearance data did not load.'}</p>}
    </div>
  );
}
