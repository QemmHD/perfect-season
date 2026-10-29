// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import references from '../data/nba-rating-references.json';
import type { CardLine } from './types';

const refs = new Map(references.players.map((p) => [p.name, p]));
const clamp = (v: number, a = 1, b = 99) => Math.max(a, Math.min(b, Math.round(v)));
/** Preserve the old rarity distribution while putting NBA ratings on a familiar roster scale. */
export function nbaRosterScale(value: number): number {
  const points = [
    [40, 40],
    [56, 60],
    [65, 75],
    [75, 85],
    [85, 92],
    [95, 97],
    [99, 99],
  ];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1],
      [x1, y1] = points[i];
    if (value <= x1) return clamp(y + ((value - x) * (y1 - y)) / (x1 - x));
  }
  return 99;
}
/** Every NBA season is calibrated; public all-time references anchor known players near their peak.
 * These are estimates, not a claim that a 2K roster exists for every historical season. */
export function calibrateNba(line: CardLine, base: number, raw: Record<string, number>) {
  const attrs = { ...raw };
  const big = line.pos[0] === 'C' || line.pos[0] === 'PF';
  const honors = new Set(line.honors);
  const eliteDef = honors.has('DPOY') || honors.has('ALLDEF1');
  const goodDef = eliteDef || honors.has('ALLDEF2');
  attrs.PRD = Math.min(attrs.PRD, goodDef ? 99 : 84);
  if (goodDef) {
    const code = big ? 'IND' : 'PRD';
    attrs[code] = Math.max(attrs[code], eliteDef ? 94 : 88);
  }
  if (big && (line.stats.dunk ?? 0) > 0.15 && (line.stats.ft ?? 0.6) < 0.72) attrs.MID = Math.min(attrs.MID, 68);
  const ref = refs.get(line.name);
  let ovr = nbaRosterScale(base);
  if (ref) {
    const awardStrength = honors.has('MVP')
      ? 0.95
      : honors.has('ALLNBA1')
        ? 0.85
        : honors.has('ALLNBA2')
          ? 0.7
          : honors.has('ALLNBA3')
            ? 0.55
            : eliteDef && honors.has('REB')
              ? 0.8
              : eliteDef
                ? 0.65
                : 0;
    const nearPeak = Math.max(awardStrength, 0, 1 - Math.abs(line.season - ref.peakSeason) / 6);
    const standing = Math.max(line.rk.val ?? 0, eliteDef ? 0.98 * Math.max(line.rk.reb ?? 0, line.rk.blk ?? 0, line.rk.stl ?? 0) : 0);
    const seasonTarget = ref.ovr - Math.max(0, 0.99 - standing) * 35 - Math.max(0, 20 - (line.stats.mpg ?? 20)) * 0.45;
    ovr = clamp(ovr * (1 - nearPeak) + seasonTarget * nearPeak);
    // Smaller influence away from peak retains season-to-season differences and ageing.
    const weight = 0.22 + 0.68 * nearPeak;
    for (const [code, value] of Object.entries(ref.attrs)) {
      if (code in attrs) attrs[code] = clamp(attrs[code] * (1 - weight) + value * weight);
    }
    // All-time roster cards sometimes invent shooting range. Historical volume still governs it.
    if (line.season >= 1980 && ((line.stats.a3 ?? 0) < 1 || (line.stats.fg3 ?? 0.34) < 0.28)) attrs['3PT'] = Math.min(attrs['3PT'], raw['3PT']);
  }
  if (honors.has('DPOY')) ovr = Math.max(ovr, 89);
  else if (eliteDef) ovr = Math.max(ovr, 82);
  if (honors.has('MVP')) ovr = Math.max(ovr, 96);
  else if (honors.has('ALLNBA1')) ovr = Math.max(ovr, 91);
  else if (honors.has('ALLNBA2')) ovr = Math.max(ovr, 88);
  else if (honors.has('ALLNBA3')) ovr = Math.max(ovr, 85);
  return { ovr, attrs, source: ref?.source };
}
