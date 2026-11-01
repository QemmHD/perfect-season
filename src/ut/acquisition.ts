import type { OwnedCard, RatedCard } from './types';
/** Keep the full pack identifier: weekly/event reward IDs can share the same first ten characters. */
export function ownedCardsForPack(cards: RatedCard[], packId: string, at: number): OwnedCard[] {
  return cards.map((rc, i) => ({ uid: 'pack:' + packId + ':' + i, cardId: rc.line.id, level: 1, xp: 0, at: at + i }));
}
