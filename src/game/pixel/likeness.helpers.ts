// The §3.2 identity row measured on the raster (studio overhaul players-4; test code only, nothing in
// the app imports this file). The same method as scripts/qa/players-lineup.mjs: each star's best
// season card, his card look (looks.ts `cardLook`) in ONE shared kit, every star drawn at the SAME
// height, the recorded `ready` frame 10, facing 0.9 and pitch 0.45; two drawings aligned at the feet
// and compared over the union of their silhouettes. A pair "differs by d" when d of the union's
// pixels are a different colour (or present in one drawing only). Height is a cue of its own, so it
// is taken out: what is left is build, skin, hair, facial hair, gear and the number.
import { getPool } from '../../ut/pool';
import type { CardLine } from '../../ut/types';
import { loadAppearance, type Sport } from './appearance';
import { type Look, rasterBody, type Raster } from './body';
import { cardLook } from './looks';
import { STARS } from './lineup-stars';
import { loadClips, mocapJoints } from './mocap';

/** The lineup stars (lineup-stars.ts). William Perry has no NFL card, so NFL is 11. */
export { STARS };

/** The shared kit (the harness's). */
export function sharedKit(look: Look): Look {
  const nfl = look.sport === 'nfl';
  return { ...look, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', helmet: '#1d428a', stripe: '#ffc72c', socks: nfl ? '#1d428a' : '#f2f2f2', pants: '#f2f2f2' };
}

/** Each star's best season card line (the highest overall), in STARS order; missing names are left out. */
export async function starLines(sport: Sport): Promise<CardLine[]> {
  const pool = await getPool();
  await loadAppearance(sport);
  await loadClips(['ready']);
  const out: CardLine[] = [];
  for (const name of STARS[sport]) {
    let best: { line: CardLine; ovr: number } | null = null;
    for (const rc of pool.base.values()) if (rc.line.name === name && rc.line.kind === 'season' && (!best || rc.ovr > best.ovr)) best = rc;
    if (best) out.push(best.line);
  }
  return out;
}

export function drawStar(look: Look, px: number): Raster {
  return rasterBody(look, mocapJoints('ready', 10, look, { ground: 'clip' }), { facing: 0.9, pitch: 0.45 }, px);
}

/** The share of the union of two drawings (aligned at the feet) that differs. */
export function pixelDiff(a: Raster, b: Raster): number {
  const ax = Math.round(a.ax),
    ay = Math.round(a.ay),
    bx = Math.round(b.ax),
    by = Math.round(b.ay);
  const x0 = Math.min(-ax, -bx),
    x1 = Math.max(a.w - ax, b.w - bx),
    y0 = Math.min(-ay, -by),
    y1 = Math.max(a.h - ay, b.h - by);
  const at = (r: Raster, ox: number, oy: number, x: number, y: number) => {
    const px = x + ox,
      py = y + oy;
    if (px < 0 || py < 0 || px >= r.w || py >= r.h) return 0;
    return r.px[py * r.w + px];
  };
  let union = 0,
    differ = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = at(a, ax, ay, x, y),
        q = at(b, bx, by, x, y);
      if (!p && !q) continue;
      union++;
      if (p !== q) differ++;
    }
  return union ? differ / union : 0;
}

export interface IdentityRow {
  px: number;
  pairs: { a: string; b: string; d: number }[];
  /** the share of pairs at least 8% different, the smallest difference */
  share8: number;
  min: number;
}

/** The identity row at each height. */
export async function identity(sport: Sport, sizes: number[]): Promise<IdentityRow[]> {
  const lines = await starLines(sport);
  return sizes.map((px) => {
    const r = lines.map((l) => drawStar(sharedKit(cardLook(l)), px));
    const pairs: IdentityRow['pairs'] = [];
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) pairs.push({ a: lines[i].name, b: lines[j].name, d: pixelDiff(r[i], r[j]) });
    return { px, pairs, share8: pairs.filter((p) => p.d >= 0.08).length / pairs.length, min: Math.min(...pairs.map((p) => p.d)) };
  });
}
