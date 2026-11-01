// Claude, 2026-11-01: rare golds. An additive flag, not a tier: the top ~35% of each position's
// season golds by overall. Packs guarantee them ("1 rare gold") and the card art gives them a subtle
// shimmer. Tier cuts never move; nothing here changes a rating or the pool fingerprint.
import { hashString } from '../engine/rng';
import type { Pool } from './pool';
import type { RatedCard } from './types';

export const RARE_SHARE = 0.35;

interface RareInfo {
  /** position → the lowest overall that is rare there */
  cut: Record<string, number>;
  /** position → its rare golds (pack draws) */
  buckets: Record<string, RatedCard[]>;
  ids: Set<string>;
}

const infos = new WeakMap<Pool, RareInfo>();
/** the last pool's rare ids, for the card art (which has only the card) */
let current: Set<string> = new Set();

export function rareInfo(pool: Pool): RareInfo {
  let r = infos.get(pool);
  if (!r) {
    const cut: Record<string, number> = {};
    const buckets: Record<string, RatedCard[]> = {};
    const ids = new Set<string>();
    for (const [pos, list] of Object.entries(pool.buckets.gold)) {
      const season = list.filter((rc) => rc.line.kind === 'season');
      if (!season.length) continue;
      // by overall, then a stable hash of the id: ties at the cut split evenly (football's scale is narrow)
      const ranked = season.slice().sort((a, b) => b.ovr - a.ovr || hashString(a.line.id) - hashString(b.line.id));
      const top = ranked.slice(0, Math.max(1, Math.round(ranked.length * RARE_SHARE)));
      cut[pos] = top[top.length - 1].ovr;
      buckets[pos] = top;
      for (const rc of buckets[pos]) ids.add(rc.line.id);
    }
    r = { cut, buckets, ids };
    infos.set(pool, r);
  }
  current = r.ids;
  return r;
}

/** A rare gold (of the pool given, or the last pool loaded). */
export function isRare(rc: Pick<RatedCard, 'tier' | 'line'>, pool?: Pool): boolean {
  if (rc.tier !== 'gold') return false;
  return (pool ? rareInfo(pool).ids : current).has(rc.line.id);
}
