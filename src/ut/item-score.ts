// Claude, 2026-11-01 (wave 2): Item Score, a card's value for Streamlined SBCs and the Gallery,
// modelled on EA FC 27's curve (research notes FC27-RESEARCH.md): Bronze 20, Silver 35, then by
// overall 75:90, 80:180, 83:410, 84:830, 85:2,100, 86:4,100, 88:8,300, 90:14,000, 92:20,000,
// 95:40,000, 99:100,000 (roughly doubling per point above 83). The knots are written on the
// reference scale and mapped through `onScale`, so the curve follows our final rating scale.
// Special editions multiply it (FC: TOTW/Hero +25%, Icon +50%, holographic more).
import { onScale } from './rate';
import type { RatedCard, UtSport } from './types';

export const ITEM_KNOTS: [number, number][] = [
  [75, 90],
  [80, 180],
  [83, 410],
  [84, 830],
  [85, 2100],
  [86, 4100],
  [88, 8300],
  [90, 14000],
  [92, 20000],
  [95, 40000],
  [99, 100000],
];
export const ITEM_BRONZE = 20;
export const ITEM_SILVER = 35;

export const ITEM_MULT: Partial<Record<RatedCard['tier'], number>> = {
  standout: 1.25,
  promo: 1.25,
  landmark: 1.35,
  legend: 1.5,
  spotlight: 2,
  goat: 2.5,
};
export const HOLO_MULT = 1.5;

const cache = new Map<UtSport, [number, number][]>();
/** The knots on this sport's scale (strictly increasing in overall). */
function knots(sport: UtSport): [number, number][] {
  let k = cache.get(sport);
  if (!k) {
    k = [];
    for (const [x, pts] of ITEM_KNOTS) {
      const o = onScale(x, sport);
      if (!k.length || o > k[k.length - 1][0]) k.push([o, pts]);
      else k[k.length - 1][1] = pts;
    }
    cache.set(sport, k);
  }
  return k;
}

/** Points for an overall on the gold curve (log-linear between knots, capped at the top). */
export function curvePoints(ovr: number, sport: UtSport): number {
  const k = knots(sport);
  if (ovr <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    const [x1, y1] = k[i];
    if (ovr <= x1) {
      const [x0, y0] = k[i - 1];
      const t = (ovr - x0) / (x1 - x0);
      return Math.round(Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0))));
    }
  }
  return k[k.length - 1][1];
}

/** A card's Item Score. `holo`: a holographic copy (variants.ts) is worth more. */
export function itemScore(rc: Pick<RatedCard, 'tier' | 'ovr' | 'line'>): number {
  if (rc.tier === 'bronze') return ITEM_BRONZE;
  if (rc.tier === 'silver') return ITEM_SILVER;
  const base = curvePoints(rc.ovr, rc.line.sport) * (ITEM_MULT[rc.tier] ?? 1) * (rc.line.holo ? HOLO_MULT : 1);
  return Math.round(base / 5) * 5;
}
