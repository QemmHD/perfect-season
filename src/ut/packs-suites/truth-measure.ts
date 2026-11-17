// Claude (packs-5, 2026-11-16): the measures the ratings-truth suite and scripts/packs share (what a
// card's played attributes print, Kendall τ, the 90+ crossing list against the packs-1 fixture). Plain
// module (no vitest) so the measurement scripts can import it. Test and tool code only.
import { pickFor } from '../../engine/sport';
import { faceOf } from '../card-face';
import type { Pool } from '../pool';
import { NBA_KEYS, rateCard } from '../rate';
import type { RatedCard } from '../types';
import { toDisplay } from '../ut-scale';
import { parseRow, rowsOf, type PacksSnapshot } from './snapshot';

/** The re-rated kinds (packs-5): everything else must equal the packs-1 fixture. */
export const RERATED = ['promo', 'legend', 'spotlight', 'goat'] as const;

/** The position a card's face is weighed at (rate.ts): basketball's own listed position, else SF. */
export function facePosOf(rc: RatedCard): string {
  return pickFor(rc.line.sport, { nba: NBA_KEYS[rc.line.pos[0]] ? rc.line.pos[0] : 'SF', nfl: rc.pos, soccer: rc.pos });
}

/** The face the played attributes print on the displayed scale (what a Hot Season or Legend must show). */
export function playedFace(rc: RatedCard): number[] {
  return faceOf(rc.line.sport, facePosOf(rc), rc.attrs, 99).map(([, , v]) => Math.round(toDisplay(rc.line.sport, v)));
}

/** Kendall τ-b of two equal-length lists (ties in either list count against neither order). */
export function kendallTau(a: number[], b: number[]): number {
  let c = 0,
    d = 0,
    ta = 0,
    tb = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const x = Math.sign(a[i] - a[j]),
        y = Math.sign(b[i] - b[j]);
      if (x === 0 && y === 0) continue;
      if (x === 0) ta++;
      else if (y === 0) tb++;
      else if (x === y) c++;
      else d++;
    }
  const den = Math.sqrt((c + d + ta) * (c + d + tb));
  return den ? (c - d) / den : 1;
}

export const faceVals = (rc: RatedCard) => (rc.face ?? rc.key).map(([, , v]) => v);
/** A card at a level (level 1 is the pool's own). */
export const at = (pool: Pool, rc: RatedCard, level: number) => (level === 1 ? rc : rateCard(pool.byId.get(rc.line.id) ?? rc.line, level));

/** The ids whose 90+ status moved at some level between the fixture and now (the OVR diff's crossing list). */
export function crossingList(pool: Pool, before: PacksSnapshot): string[] {
  const out: string[] = [];
  for (const kind of RERATED) {
    const old = rowsOf(before, kind);
    for (const rc of Object.values(pool.buckets[kind]).flat()) {
      const was = old.get(rc.line.id);
      if (!was) continue;
      const a = parseRow(was, kind).ovr;
      const b = [1, 2, 3, 4, 5].map((l) => at(pool, rc, l).ovr);
      if (a.some((o, i) => o >= 90 !== b[i] >= 90)) out.push(rc.line.id);
    }
  }
  return out.sort();
}
