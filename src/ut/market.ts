// Claude, 2026-11-01: the Scout Market and the Swap Desk.
// Scout Market: twelve cards a day, the same for everyone (from the Eastern day's key), at fixed
// coin prices (about three times quick-sell; golds at least 300, Standouts and Hot Seasons at least
// 1,500), each buyable once per player per day. Coins only.
// Swap Desk: five duplicate golds from Duplicate Storage for a Scout's Choice pick (3 a day).
import { hashString, rng, type Rand } from '../engine/rng';
import { contentOf, lockedSet } from './content-state';
import { addPick, buysLeft, pickFor, recordBuy } from './content-packs';
import { quickSellValue } from './packs';
import type { Pool } from './pool';
import { rareInfo } from './rare';
import { weekOf } from './sbc';
import { standoutProgram } from './standouts';
import type { UtState } from './state';
import { organizeStorage, removeCards } from './storage';
import type { OwnedCard, RatedCard } from './types';

export type MarketTag = 'silver' | 'gold' | 'rare' | 'promo' | 'standout';
export interface MarketItem {
  i: number;
  cardId: string;
  price: number;
  tag: MarketTag;
}

/** the day's twelve, by kind */
export const MARKET_MIX: MarketTag[] = ['silver', 'silver', 'gold', 'gold', 'gold', 'gold', 'rare', 'rare', 'rare', 'promo', 'promo', 'standout'];
export const MARKET_FLOOR: Record<MarketTag, number> = { silver: 100, gold: 300, rare: 300, promo: 1500, standout: 1500 };

const round50 = (x: number) => Math.round(x / 50) * 50;

export function marketPrice(rc: RatedCard, tag: MarketTag): number {
  return Math.max(MARKET_FLOOR[tag], round50(3 * quickSellValue(rc)));
}

const pickFrom = (list: RatedCard[], rand: Rand, used: Set<string>): RatedCard | null => {
  const fresh = list.filter((rc) => !used.has(rc.line.pid));
  return fresh.length ? fresh[Math.floor(rand() * fresh.length)] : null;
};

const cache = new WeakMap<Pool, Map<string, MarketItem[]>>();

/** The day's market (deterministic from the sport and the day). */
export function marketFor(pool: Pool, day: string): MarketItem[] {
  let m = cache.get(pool);
  if (!m) cache.set(pool, (m = new Map()));
  const got = m.get(day);
  if (got) return got;
  const rand = rng(hashString('ut-market:' + pool.sport + ':' + day));
  const sorted = (xs: RatedCard[]) => xs.slice().sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const rare = rareInfo(pool);
  const lists: Record<MarketTag, RatedCard[]> = {
    silver: sorted(Object.values(pool.buckets.silver).flat()),
    gold: sorted(Object.values(pool.buckets.gold).flat().filter((rc) => !rare.ids.has(rc.line.id))),
    rare: sorted(Object.values(rare.buckets).flat()),
    promo: sorted(Object.values(pool.buckets.promo).flat()),
    standout: standoutProgram(pool, weekOf(day)).cards,
  };
  const used = new Set<string>();
  const items: MarketItem[] = [];
  MARKET_MIX.forEach((tag) => {
    const rc = pickFrom(lists[tag], rand, used) ?? pickFrom(lists.gold, rand, used);
    if (!rc) return;
    used.add(rc.line.pid);
    items.push({ i: items.length, cardId: rc.line.id, price: marketPrice(rc, rc.tier === 'gold' && tag !== 'rare' ? 'gold' : tag), tag });
  });
  m.set(day, items);
  return items;
}

export function marketBought(ut: UtState, day: string): Set<number> {
  const mk = contentOf(ut).market;
  return new Set(mk?.day === day ? mk.bought : []);
}

/**
 * Buy item `i` of today's market once: the card joins the club as `market:<day>:<i>` and the price
 * is returned for the caller to take from the wallet. Null when it was bought already, is unknown,
 * or costs more than `coins`.
 */
export function buyMarket(ut: UtState, pool: Pool, day: string, i: number, coins: number, at: number): { ut: UtState; price: number; card: OwnedCard } | null {
  const item = marketFor(pool, day)[i];
  if (!item || marketBought(ut, day).has(i) || coins < item.price) return null;
  const card: OwnedCard = { uid: 'market:' + pool.sport + ':' + day + ':' + i, cardId: item.cardId, level: 1, xp: 0, at };
  if (ut.owned.some((o) => o.uid === card.uid)) return null;
  const c = contentOf(ut);
  const bought = [...marketBought(ut, day), i];
  return { ut: organizeStorage({ ...ut, content: { ...c, market: { day, bought } } }, [card]), price: item.price, card };
}

// ---------- the Swap Desk ----------

export const SWAP_SIZE = 5;

/** Duplicate golds (Duplicate Storage, never in the squad), cheapest first: what a swap takes. */
export function swapCandidates<C extends { uid: string; rc: RatedCard; storage?: boolean; slot: string | null }>(cards: C[]): C[] {
  return cards.filter((c) => c.storage && !c.slot && c.rc.tier === 'gold').sort((a, b) => quickSellValue(a.rc) - quickSellValue(b.rc) || a.rc.ovr - b.rc.ovr || (a.uid < b.uid ? -1 : 1));
}

/** Trade exactly these five stored golds for a Scout's Choice pick (id `swap:<id>`), three a day. */
export function swapForPick(ut: UtState, pool: Pool, uids: string[], id: string, day: string, at: number): UtState | null {
  const stored = new Set(ut.duplicateStorage ?? []);
  const squad = new Set(Object.values(ut.squad));
  const locked = lockedSet(ut);
  const cards = uids.map((u) => ut.owned.find((o) => o.uid === u));
  if (new Set(uids).size !== SWAP_SIZE || cards.some((c) => !c || !stored.has(c.uid) || squad.has(c.uid) || locked.has(c.uid) || pool.base.get(c.cardId)?.tier !== 'gold')) return null;
  if (buysLeft(ut, 'swap', day, at) <= 0) return null;
  const after = recordBuy(removeCards(ut, uids, 'sbc'), 'swap', day, at);
  return addPick(after, pickFor(pool, 'swap', 'swap:' + id, weekOf(day), at));
}
