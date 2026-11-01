// Claude, 2026-11-01: Pack Helper tags on a pack's reveal, worked out from the club as it was
// before the pack: NEW (an edition never discovered), UPGRADE +N (beats the starter at a squad spot
// the card can play, by N overall), SET (moves an open Set Collection), SBC FODDER (a spare copy of
// an edition you already own, or a bronze/silver you've seen). Display only.
import type { Pool } from './pool';
import { setTagger } from './sets';
import { canPlay, type Lineup, slotsFor } from './squad';
import type { UtState } from './state';
import type { RatedCard } from './types';

export type HelperTag = { k: 'new' | 'upgrade' | 'set' | 'fodder'; text: string };

export function packTags(pool: Pool, before: UtState, lineup: Lineup, cards: RatedCard[]): HelperTag[][] {
  const seen = new Set([...(before.collected ?? []), ...before.owned.map((c) => c.cardId)]);
  const owned = new Set(before.owned.map((c) => c.cardId));
  const sets = setTagger(pool, before);
  const starters = slotsFor(pool.sport).filter((s) => s.weight > 0);
  const inPack = new Map<string, number>();
  return cards.map((rc) => {
    const tags: HelperTag[] = [];
    const copies = inPack.get(rc.line.id) ?? 0;
    inPack.set(rc.line.id, copies + 1);
    const isNew = !seen.has(rc.line.id) && copies === 0;
    if (isNew) tags.push({ k: 'new', text: 'NEW' });
    let up = 0;
    for (const sl of starters) {
      if (!canPlay(sl, rc)) continue;
      const cur = lineup[sl.id];
      if (cur && cur.line.pid === rc.line.pid && cur.line.id === rc.line.id) continue;
      up = Math.max(up, cur ? rc.ovr - cur.ovr : 0);
    }
    if (up > 0) tags.push({ k: 'upgrade', text: 'UPGRADE +' + up });
    if (isNew && sets(rc) > 0) tags.push({ k: 'set', text: 'SET' });
    const spare = owned.has(rc.line.id) || copies > 0;
    if (!up && (spare || (!isNew && (rc.tier === 'bronze' || rc.tier === 'silver')))) tags.push({ k: 'fodder', text: 'SBC FODDER' });
    return tags;
  });
}
