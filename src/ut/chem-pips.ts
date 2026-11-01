// Claude, 2026-11-01: per-player chemistry pips (0-3), the share of a player's own links that are
// full (squad.ts linkScore: franchise +3, decade +2, season +4, full at 6). Display only: the team
// chemistry that feeds the squad overall is unchanged, so match strength and online play are too.
import { FULL_LINK, linkScore, linksFor, type Lineup } from './squad';
import type { UtSport } from './types';

export function playerChem(sport: UtSport, lineup: Lineup): Record<string, number> {
  const sum: Record<string, number> = {};
  const deg: Record<string, number> = {};
  for (const [a, b] of linksFor(sport)) {
    const ca = lineup[a];
    const cb = lineup[b];
    const v = ca && cb ? Math.min(FULL_LINK, linkScore(ca, cb)) / FULL_LINK : 0;
    for (const s of [a, b]) {
      sum[s] = (sum[s] ?? 0) + v;
      deg[s] = (deg[s] ?? 0) + 1;
    }
  }
  const out: Record<string, number> = {};
  for (const slot of Object.keys(deg)) {
    if (!lineup[slot]) continue;
    const r = sum[slot] / deg[slot];
    out[slot] = r >= 0.85 ? 3 : r >= 0.5 ? 2 : r > 0.15 ? 1 : 0;
  }
  return out;
}
