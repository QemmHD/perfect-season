// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import type { Profile } from '../lib/profile';
import { registeredPack } from './packs';
import type { Pool } from './pool';
import { registryNamespace, type RegistryReceipt } from './registry';
import { organizeStorage } from './storage';
import type { OwnedCard } from './types';
import type { Opening } from './UltimateTeam';

export function registeredOpening(pool: Pool, p: Profile, receipt: RegistryReceipt): { profile: Profile; opening: Opening | null } {
  if (p.ut.registeredOpenings?.includes(receipt.id)) {
    const pending = p.ut.pendingPromo;
    const same = pending && (pending.id === receipt.id || (pending.kind === receipt.kind && receipt.kind.startsWith('event-')));
    return { profile: same ? { ...p, ut: { ...p.ut, pendingPromo: undefined } } : p, opening: null };
  }
  const pending = p.ut.pendingPromo;
  if (
    !pending ||
    pending.kind !== receipt.kind ||
    receipt.sport !== pool.sport ||
    receipt.namespace !== registryNamespace() ||
    typeof receipt.seed !== 'string' ||
    typeof receipt.id !== 'string'
  )
    throw new Error('The pack receipt does not match your pending pack.');
  if (pending.kind === 'spotlight' && pending.id !== receipt.id) throw new Error('The pack receipt has a different ID.');
  if (p.coins < pending.price) throw new Error('Your pack is reserved. Earn enough coins to complete it, then retry.');
  const cards = registeredPack(pool, receipt.kind, receipt.seed, receipt.cardId);
  const rare = receipt.tier === 'goat' || receipt.tier === 'spotlight';
  const chase = receipt.cardId ? pool.base.get(receipt.cardId) : null;
  if (
    (chase && chase.tier !== receipt.tier) ||
    (!chase && receipt.tier !== 'gold') ||
    (rare && (!Number.isSafeInteger(receipt.serial) || receipt.serial! <= 0 || !Number.isSafeInteger(receipt.totalAtPull) || receipt.totalAtPull! < receipt.serial!))
  )
    throw new Error('The card registry returned an invalid card receipt.');
  const owned: OwnedCard[] = cards.map((rc, i) => ({
    uid: 'registered:' + receipt.id + ':' + i,
    cardId: rc.line.id,
    level: 1,
    xp: 0,
    at: pending.at + i,
    ...(rare && i === cards.length - 1 ? { mint: { serial: receipt.serial!, totalAtPull: receipt.totalAtPull!, requestId: receipt.id, namespace: receipt.namespace } } : {}),
  }));
  const ut = organizeStorage(p.ut, owned);
  const stored = new Set(ut.duplicateStorage);
  return {
    profile: {
      ...p,
      coins: p.coins - pending.price,
      ut: {
        ...ut,
        pendingPromo: undefined,
        registeredOpenings: [...(ut.registeredOpenings ?? []), receipt.id],
        packs: pending.packId ? ut.packs.filter((pp) => pp.id !== pending.packId) : ut.packs,
        packsOpened: ut.packsOpened + 1,
      },
    },
    opening: {
      id: receipt.id,
      title: pending.kind.startsWith('event-') ? 'Spotlight Reward' : 'Spotlight Pack',
      kind: pending.kind.startsWith('event-') ? 'reward' : 'spotlight',
      cards: cards.map((rc, i) => ({ uid: owned[i].uid, rc })),
      stored: owned.filter((c) => stored.has(c.uid)).length,
      ...(rare ? { mint: { serial: receipt.serial!, total: receipt.totalAtPull! } } : {}),
    },
  };
}
