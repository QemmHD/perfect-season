// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import type { Pool } from './pool';
import type { UtState } from './state';

/** Discovery is permanent. Selling/using a card never erases a discovered edition or a claimed reward. */
export function rememberCollection(ut: UtState): UtState {
  return { ...ut, collected: [...new Set([...(ut.collected ?? []), ...ut.owned.map((c) => c.cardId)])] };
}
export interface CollectionReward {
  id: string;
  title: string;
  have: number;
  need: number;
  coins: number;
  pack?: string;
}
export function collectionRewards(pool: Pool, ut: UtState): CollectionReward[] {
  const seen = new Set([...(ut.collected ?? []), ...ut.owned.map((c) => c.cardId)]);
  const valid = [...seen].flatMap((id) => {
    const l = pool.byId.get(id);
    return l ? [l] : [];
  });
  const milestones = [25, 50, 100, 250, 500, 1000].map((need, i) => ({
    id: 'editions:' + need,
    title: need + ' editions discovered',
    have: valid.length,
    need,
    coins: [100, 150, 250, 400, 750, 1000][i],
    ...(i >= 2 ? { pack: i >= 4 ? 'premium' : 'gold' } : {}),
  }));
  const teams = new Map<string, { name: string; pids: Set<string> }>();
  for (const l of pool.lines) if (!teams.has(l.fr)) teams.set(l.fr, { name: l.teamName, pids: new Set() });
  for (const l of valid) teams.get(l.fr)?.pids.add(l.pid);
  const sets: CollectionReward[] = [...teams].map(([fr, t]) => ({ id: 'franchise:' + fr, title: t.name + ' collection', have: t.pids.size, need: 5, coins: 100, pack: 'silver' }));
  return [...milestones, ...sets];
}
export function claimCollection(pool: Pool, ut: UtState, id: string, at: number) {
  const reward = collectionRewards(pool, ut).find((r) => r.id === id);
  if (!reward || reward.have < reward.need || ut.collectionClaims?.includes(id)) return { ut, coins: 0, claimed: false };
  return {
    ut: {
      ...rememberCollection(ut),
      collectionClaims: [...(ut.collectionClaims ?? []), id],
      packs: reward.pack ? [...ut.packs, { id: 'collection:' + pool.sport + ':' + id, kind: reward.pack, at }] : ut.packs,
    },
    coins: reward.coins,
    claimed: true,
  };
}
