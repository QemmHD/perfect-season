// Claude, 2026-11-01: the Scout Market and the Swap Desk.
// Scout Market: twelve cards a day, the same for everyone (from the Eastern day's key), at fixed
// coin prices, each buyable once per player per day. Coins only.
// Swap Desk: duplicate golds from Duplicate Storage for a Scout's Choice pick, once a day.
// Claude (packs-3, audit C2, owner decision 4 "cheap 94-97 routes cut back"): the market used to sell two
// Hot Season cards (94-97) and a Standout every day for about 2,000 coins, so the chase was over in two
// weeks. It sells base cards only now: 2 silvers, 5 golds and 4 golds 78+ (all on the gold curve, at most
// 82), and one "scouted" gold 83-86. Nothing above 86, no special edition. A card is priced at three times
// its quick-sell value or a quarter of its pack-route cost (value.ts), whichever is more, and never under
// its kind's floor; the 83-86 gold so costs 1,500-12,000 coins in basketball.
import { hashString, rng, type Rand } from '../engine/rng';
import { contentOf, lockedSet } from './content-state';
import { addPick, buysLeft, pickFor, recordBuy } from './content-packs';
import { fcToDisplay } from './fc-scale';
import { SWAP_SIZE, swapSize } from './flash';
import { type Curve, curvePick, GOLD_CURVE, goldsOf, quickSellValue, SILVER_CURVE } from './packs';
import type { Pool } from './pool';
import { weekOf } from './sbc';
import type { UtState } from './state';
import { organizeStorage, removeCards } from './storage';
import type { OwnedCard, RatedCard } from './types';
import { routeCost } from './value';

/** `promo` and `standout` are no longer sold (packs-3); they stay in the type for old code paths. */
export type MarketTag = 'silver' | 'gold' | 'rare' | 'high' | 'promo' | 'standout';
export interface MarketItem {
  i: number;
  cardId: string;
  price: number;
  tag: MarketTag;
}

/** the day's twelve, by kind: `gold` any gold up to 82, `rare` a gold 78-82, `high` one gold 83-86 */
export const MARKET_MIX: MarketTag[] = ['silver', 'silver', 'gold', 'gold', 'gold', 'gold', 'gold', 'rare', 'rare', 'rare', 'rare', 'high'];
export const MARKET_FLOOR: Record<MarketTag, number> = { silver: 100, gold: 300, rare: 400, high: 1500, promo: 1500, standout: 1500 };
/** The overall ranges (basketball's display scale) each kind draws on the gold curve, cut at its top. */
const RANGE: Partial<Record<MarketTag, [number, number]>> = { gold: [75, 82], rare: [78, 82], high: [83, 86] };
const cut = (hi: number): Curve => Object.fromEntries(Object.entries(GOLD_CURVE).filter(([o]) => Number(o) <= hi));
const CURVES: Partial<Record<MarketTag, Curve>> = { gold: cut(82), rare: cut(82), high: cut(86) };
/** A market card costs at least this share of its pack-route cost (D10), so the market is never the cheap route to an 83+. */
export const MARKET_ROUTE_SHARE = 0.25;

const round50 = (x: number) => Math.round(x / 50) * 50;

export function marketPrice(rc: RatedCard, tag: MarketTag): number {
  const route = rc.tier === 'gold' && rc.ovr >= fcToDisplay(83, rc.line.sport) ? round50(MARKET_ROUTE_SHARE * routeCost(rc.line.sport, rc.ovr)) : 0;
  return Math.max(MARKET_FLOOR[tag], round50(3 * quickSellValue(rc)), route);
}

const cache = new WeakMap<Pool, Map<string, MarketItem[]>>();

/** The day's market (deterministic from the sport and the day). */
export function marketFor(pool: Pool, day: string): MarketItem[] {
  let m = cache.get(pool);
  if (!m) cache.set(pool, (m = new Map()));
  const got = m.get(day);
  if (got) return got;
  const sport = pool.sport;
  const rand = rng(hashString('ut-market:v2:' + sport + ':' + day));
  const byId = (xs: RatedCard[]) => xs.slice().sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const silvers = byId(Object.values(pool.buckets.silver).flat());
  const golds = byId(goldsOf(pool));
  // (one list per top overall, so the curve's per-list index is built once)
  const capped = new Map<number, RatedCard[]>();
  for (const [, hi] of Object.values(RANGE)) {
    const top = fcToDisplay(hi, sport);
    if (!capped.has(top)) capped.set(top, golds.filter((g) => g.ovr <= top));
  }
  const used = new Set<string>();
  const draw = (tag: MarketTag, r: Rand): RatedCard | null => {
    for (let k = 0; k < 12; k++) {
      let rc: RatedCard | null;
      if (tag === 'silver') rc = curvePick(silvers, SILVER_CURVE, fcToDisplay(65, sport), r);
      else {
        const [lo, hi] = RANGE[tag]!.map((x) => fcToDisplay(x, sport));
        rc = curvePick(capped.get(hi)!, CURVES[tag]!, lo, r);
      }
      if (rc && !used.has(rc.line.pid)) return rc;
    }
    return null;
  };
  const items: MarketItem[] = [];
  MARKET_MIX.forEach((tag) => {
    const own = draw(tag, rand);
    // (nothing of its kind left: any gold up to 82 instead, sold as one)
    const t: MarketTag = own || tag === 'silver' ? tag : 'gold';
    const rc = own ?? (t === tag ? null : draw('gold', rand));
    if (!rc) return;
    used.add(rc.line.pid);
    items.push({ i: items.length, cardId: rc.line.id, price: marketPrice(rc, t), tag: t });
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

export { SWAP_SIZE, swapSize };

/** Duplicate golds (Duplicate Storage, never in the squad), cheapest first: what a swap takes. */
export function swapCandidates<C extends { uid: string; rc: RatedCard; storage?: boolean; slot: string | null }>(cards: C[]): C[] {
  return cards.filter((c) => c.storage && !c.slot && c.rc.tier === 'gold').sort((a, b) => quickSellValue(a.rc) - quickSellValue(b.rc) || a.rc.ovr - b.rc.ovr || (a.uid < b.uid ? -1 : 1));
}

/**
 * Trade exactly these stored golds for a Scout's Choice pick (id `swap:<id>`), once a day (packs-3: it was
 * 3). A swap takes five, or four inside a "swap-desk 4-for-1" flash window (flash.ts swapSize).
 */
export function swapForPick(ut: UtState, pool: Pool, uids: string[], id: string, day: string, at: number): UtState | null {
  const stored = new Set(ut.duplicateStorage ?? []);
  const squad = new Set(Object.values(ut.squad));
  const locked = lockedSet(ut);
  const cards = uids.map((u) => ut.owned.find((o) => o.uid === u));
  if (new Set(uids).size !== swapSize(at, pool.sport) || cards.some((c) => !c || !stored.has(c.uid) || squad.has(c.uid) || locked.has(c.uid) || pool.base.get(c.cardId)?.tier !== 'gold')) return null;
  if (buysLeft(ut, 'swap', day, at) <= 0) return null;
  const after = recordBuy(removeCards(ut, uids, 'sbc'), 'swap', day, at);
  return addPick(after, pickFor(pool, 'swap', 'swap:' + id, weekOf(day), at));
}
