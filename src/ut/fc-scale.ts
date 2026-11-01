// Claude, 2026-11-01: content thresholds (Standout bands, 84+ picks, Evolution caps, Item Score,
// Live Calendar bands, SBC targets) are written on the EA FC 27-style display scale
// (Bronze 40–64, Silver 65–74, Gold 75–99). The displayed UT scale is configured in ut-scale.ts; this
// maps an FC-scale number onto it through the tier cuts (the identity while the cuts are 65/75), so
// content keeps its meaning if UT_SCALE is ever re-targeted.
import { along, UT_SCALE } from './ut-scale';
import type { UtSport } from './types';

export function fcToDisplay(x: number, sport: UtSport): number {
  const c = UT_SCALE[sport].cuts;
  if (x > 99) return x;
  return Math.round(along(x, [[40, 40], [65, c.silver], [75, c.gold], [99, 99]]));
}

/** The displayed overall from which a pack reveal walks out. */
export const walkoutAt = (sport: UtSport) => UT_SCALE[sport].walkout;
