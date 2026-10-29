import type { UtState } from './state';
import { rememberCollection } from './collection';
import type { OwnedCard } from './types';

/** Canonical cards stay in `owned` so the original restore build can still read every copy. */
export function storedCards(ut: UtState): OwnedCard[] {
  const stored = new Set(ut.duplicateStorage ?? []);
  return ut.owned.filter((c) => stored.has(c.uid));
}

/** Exact editions only: another season or special edition always remains a separate club card. */
export function organizeStorage(ut: UtState, additions: OwnedCard[] = []): UtState {
  const equipped = new Set(Object.values(ut.squad));
  const previous = new Set(ut.duplicateStorage ?? []);
  const inClub = new Set(ut.owned.filter((c) => !previous.has(c.uid)).map((c) => c.uid));
  const seen = new Set<string>();
  const groups = new Map<string, OwnedCard[]>();
  const owned: OwnedCard[] = [];
  for (const card of [...ut.owned, ...additions]) {
    if (seen.has(card.uid)) continue;
    seen.add(card.uid);
    owned.push(card);
    const group = groups.get(card.cardId) ?? [];
    group.push(card);
    groups.set(card.cardId, group);
  }
  const keep = new Set<string>();
  for (const group of groups.values()) {
    // Preserve all equipped UIDs, including legacy lineups with two identical copies.
    const playing = group.filter((c) => equipped.has(c.uid));
    if (playing.length) for (const c of playing) keep.add(c.uid);
    else {
      const best = group
        .slice()
        .sort((a, b) => Number(inClub.has(b.uid)) - Number(inClub.has(a.uid)) || b.level - a.level || b.xp - a.xp || a.at - b.at || a.uid.localeCompare(b.uid))[0];
      keep.add(best.uid);
    }
  }
  return {
    ...(owned.length || ut.collected ? rememberCollection({ ...ut, owned }) : ut),
    owned,
    duplicateStorage: owned.filter((c) => !keep.has(c.uid)).map((c) => c.uid),
  };
}

/** Exchange copies without changing the edition or losing either copy's progress. */
export function useStoredCopy(ut: UtState, uid: string): UtState {
  if (!ut.duplicateStorage?.includes(uid)) return ut;
  const card = ut.owned.find((c) => c.uid === uid);
  if (!card) return ut;
  const stored = new Set(ut.duplicateStorage);
  const current = ut.owned.find((c) => c.cardId === card.cardId && !stored.has(c.uid));
  stored.delete(uid);
  if (current) stored.add(current.uid);
  return {
    ...ut,
    duplicateStorage: ut.owned.filter((c) => stored.has(c.uid)).map((c) => c.uid),
    squad: Object.fromEntries(Object.entries(ut.squad).map(([slot, id]) => [slot, id === current?.uid ? uid : id])),
  };
}

/** Consume exact UIDs from either place; a remaining copy returns to the club. */
export function removeCards(ut: UtState, uids: Iterable<string>): UtState {
  const gone = new Set(uids);
  return organizeStorage({
    ...rememberCollection(ut),
    owned: ut.owned.filter((c) => !gone.has(c.uid)),
    squad: Object.fromEntries(Object.entries(ut.squad).filter(([, uid]) => !gone.has(uid))),
  });
}
