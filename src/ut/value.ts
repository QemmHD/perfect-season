// Claude (packs-3, 2026-11-16): what a card or a pack is worth in coins (packs-plan D10), the yardstick
// for the Scout Market's prices, the SBC value rules and (packs-6) the tier ladder.
//
//   routeCost(sport, ovr)   a gold of this displayed overall or better by the cheapest coin route: the
//                           Premium Gold price ÷ the chance a Premium holds at least one (exact, from the
//                           pack's own slots on the gold curve). NBA: 83+ ≈ 7,000, 86+ ≈ 50,000 coins.
//   coinValue(rc)           a card at acquisition cost: twice its quick-sell value (a pack returns about
//                           half its price, 0.45–0.60), a gold 83+ at its route cost, a special edition
//                           at its ladder rung (SPECIAL_RUNG, until packs-6 measures the ladder).
//   goldRewardValue(...)    a gold reward drawn on the curve from a floor (what an SBC pays), at the
//                           cost of the pack route that hands out the same draw.
//   cheapestFodder(...)     the least coin value of the cards that meet a challenge's tier, minimum and
//                           team-overall requirements (any overall is assumed to exist in the club).
//   packEv(pool, slots)     a pack's mean quick-sell value, exactly, from its slots: the EV band.
// The coin values are pure functions of the pack definitions and the curve; packEv reads the pool.
import { fcToDisplay } from './fc-scale';
import { curveOdds, FEATURED_STANDOUT, FLOORS, GOLD_CURVE, isFloorKind, type Odds, packDefs, quickSell, quickSellValue, SILVER_CURVE, type SlotTier } from './packs';
import type { Pool } from './pool';
import { positionMix } from './squad';
import { standoutProgram } from './standouts';
import { tierOf } from './rate';
import { promoCards } from './live-cards';
import { livePackDef, packOfKind, promoOfPack } from './live-packs';
import { weekOf } from './sbc';
import type { RatedCard, Tier, UtSport } from './types';

/** From this displayed overall up, a gold is valued at its route cost (basketball's 83, each sport's scale). */
export const ROUTE_FROM = 83;

const routeCache = new Map<string, number>();

/** The chance one Premium Gold holds at least one gold of displayed overall `ovr` or better (exact). */
export function premiumChanceAtLeast(sport: UtSport, ovr: number): number {
  const def = packDefs(sport).premium;
  let none = 1;
  for (const slot of def.slots) {
    let p = 0;
    for (const [k, w] of Object.entries(slot)) {
      if (!w || !isFloorKind(k)) continue;
      const odds = curveOdds(GOLD_CURVE, fcToDisplay(FLOORS[k], sport), sport);
      let hit = 0;
      for (const [o, x] of odds) if (o >= ovr) hit += x;
      p += w * hit;
    }
    none *= 1 - p;
  }
  return 1 - none;
}

/**
 * D10: the coins a gold of displayed overall `ovr`+ costs by its cheapest pack route (Premium Gold
 * price ÷ the chance a Premium has one). Infinity above the curve's top (no pack route at all).
 */
export function routeCost(sport: UtSport, ovr: number): number {
  const key = sport + ':' + ovr + ':' + packDefs(sport).premium.price;
  const got = routeCache.get(key);
  if (got !== undefined) return got;
  const p = premiumChanceAtLeast(sport, ovr);
  const v = p > 0 ? Math.round(packDefs(sport).premium.price / p) : Infinity;
  routeCache.set(key, v);
  return v;
}

/**
 * D5's ladder rungs (basketball coins) for the special tiers, until packs-6 measures the ladder: the
 * lower bound of each rung. Other sports scale by their Standout Guarantee price.
 */
export const SPECIAL_RUNG: Partial<Record<Tier, number>> = { standout: 3000, program: 6600, promo: 15000, landmark: 15000, legend: 40000, spotlight: 60000, goat: 1_000_000 };

const rungScale = (sport: UtSport) => packDefs(sport).standout.price / packDefs('nba').standout.price;

/** D10: a gold of this displayed overall at acquisition cost (2 × quick-sell; its route cost from 83+). */
export function goldValue(sport: UtSport, ovr: number): number {
  return ovr >= fcToDisplay(ROUTE_FROM, sport) ? routeCost(sport, ovr) : 2 * quickSell('gold', ovr, sport);
}

/** D10: the coins a card is worth at acquisition cost. */
export function coinValue(rc: Pick<RatedCard, 'tier' | 'ovr'> & { line: { sport: UtSport } }): number {
  const sport = rc.line.sport;
  if (rc.tier === 'gold') return goldValue(sport, rc.ovr);
  const rung = SPECIAL_RUNG[rc.tier];
  if (rung) return Math.round(rung * rungScale(sport));
  return 2 * quickSell(rc.tier, rc.ovr, sport);
}

/** A card of a tier-by-overall (bronze, silver or gold by its overall), at acquisition cost. */
function plainValue(sport: UtSport, ovr: number): number {
  const t = tierOf(ovr, sport);
  return t === 'gold' ? goldValue(sport, ovr) : 2 * quickSell(t, ovr, sport);
}

/**
 * The coin value of a gold reward drawn on the curve from `floor` (displayed) up: what an SBC pays. Buying
 * Premiums until one holds a gold `floor`+ hands out exactly such a card (the curve above the floor), so a
 * reward from 83 up is worth that route's cost, routeCost(floor). Below 83 it is the curve's mean of
 * 2 × quick-sell under 83, plus its chance of 83+ at routeCost(83).
 */
export function goldRewardValue(sport: UtSport, floor: number): number {
  const from = fcToDisplay(ROUTE_FROM, sport);
  if (floor >= from) return routeCost(sport, floor);
  let v = 0;
  for (const [o, p] of curveOdds(GOLD_CURVE, floor, sport)) v += p * (o >= from ? routeCost(sport, from) : 2 * quickSell('gold', o, sport));
  return v;
}

/** What a challenge asks of each card and of the whole (the requirements this model prices). */
export interface FodderReqs {
  size: number;
  /** every card at least this tier (a "tier" requirement covering every card) */
  tier?: Tier;
  /** every card at least this overall */
  minOvr?: number;
  /** the rounded mean overall at least this */
  teamOvr?: number;
}

/**
 * The least total coin value of `size` cards meeting the requirements, and the overalls that do it
 * (DP over the overall sum). Cards are bronze, silver or gold by their overall.
 */
export function cheapestFodder(sport: UtSport, r: FodderReqs): { value: number; ovrs: number[] } {
  const lo = Math.max(40, r.minOvr ?? 0, r.tier === 'gold' ? fcToDisplay(75, sport) : r.tier === 'silver' ? fcToDisplay(65, sport) : 40);
  const hi = Math.max(lo, fcToDisplay(93, sport));
  const vals: [number, number][] = [];
  for (let o = lo; o <= hi; o++) vals.push([o, plainValue(sport, o)]);
  // the rounded mean must reach teamOvr: the sum at least (teamOvr - 0.5) * size
  const need = r.teamOvr ? Math.ceil((r.teamOvr - 0.5) * r.size - 1e-9) : 0;
  // best[k][s]: least value of k cards whose overalls sum to exactly s (s capped at need)
  const cap = Math.max(need, lo * r.size);
  let best = new Map<number, { v: number; ovrs: number[] }>([[0, { v: 0, ovrs: [] }]]);
  for (let k = 0; k < r.size; k++) {
    const next = new Map<number, { v: number; ovrs: number[] }>();
    for (const [s, cur] of best)
      for (const [o, v] of vals) {
        const ns = Math.min(cap, s + o);
        const nv = cur.v + v;
        const had = next.get(ns);
        if (!had || nv < had.v) next.set(ns, { v: nv, ovrs: [...cur.ovrs, o] });
      }
    best = next;
  }
  let out = { v: Infinity, ovrs: [] as number[] };
  for (const [s, cur] of best) if (s >= need && cur.v < out.v) out = cur;
  return { value: out.v, ovrs: out.ovrs.sort((a, b) => a - b) };
}


// ---------- a pack's quick-sell value, exactly (the EV band, packs-plan §5 packs-3 item 7) ----------

/** What the expected value of a pack's slots depends on besides the slots. */
export interface EvCtx {
  /** the Weekly Standout week its Standout slots draw from */
  week: string;
  /** a Position/Unit pack's positions and weights */
  mix?: [string, number][];
  /** a program slot's cards: each list with its share of the slot (a promo and its extras) */
  program?: [RatedCard[], number][];
}

const meanQs = (list: readonly RatedCard[]) => (list.length ? list.reduce((a, rc) => a + quickSellValue(rc), 0) / list.length : 0);

/** The mean quick-sell value of one card of a slot tier (golds and silvers on their curves). */
export function slotQs(pool: Pool, tier: SlotTier, ctx: EvCtx): number {
  const sport = pool.sport;
  const t = tier === 'gold' ? 'g75' : tier === 'rare' ? 'g78' : tier;
  if (isFloorKind(t)) {
    let v = 0;
    for (const [o, p] of curveOdds(GOLD_CURVE, fcToDisplay(FLOORS[t], sport), sport)) v += p * quickSell('gold', o, sport);
    return v;
  }
  if (t === 'silver') {
    let v = 0;
    for (const [o, p] of curveOdds(SILVER_CURVE, fcToDisplay(65, sport), sport)) v += p * quickSell('silver', o, sport);
    return v;
  }
  if (t === 'bronze') {
    const mix = ctx.mix ?? Object.entries(positionMix(sport));
    const tot = mix.reduce((a, [, w]) => a + w, 0);
    return mix.reduce((a, [p, w]) => a + (w / tot) * meanQs(pool.buckets.bronze[p] ?? []), 0);
  }
  if (t === 'standout') {
    const cards = standoutProgram(pool, ctx.week).cards;
    if (!cards.length) return slotQs(pool, 'g78', ctx);
    return cards.length === 1 ? quickSellValue(cards[0]) : FEATURED_STANDOUT * quickSellValue(cards[0]) + (1 - FEATURED_STANDOUT) * meanQs(cards.slice(1));
  }
  if (t === 'program') {
    const lists = (ctx.program ?? []).filter(([l]) => l.length);
    const tot = lists.reduce((a, [, w]) => a + w, 0);
    return tot ? lists.reduce((a, [l, w]) => a + (w / tot) * meanQs(l), 0) : slotQs(pool, 'standout', ctx);
  }
  return meanQs(Object.values(pool.buckets[t as Tier]).flat());
}

/** A pack's expected quick-sell value from its slots (exact up to the rare nearest-overall step). */
export function packEv(pool: Pool, slots: readonly Odds[], ctx: EvCtx): number {
  let v = 0;
  for (const o of slots) for (const [t, p] of Object.entries(o) as [SlotTier, number][]) if (p) v += p * slotQs(pool, t, ctx);
  return v;
}

/**
 * A Live Calendar program pack's expected quick-sell value and price on `day` (at `at`, boosted when a
 * Friday boost is on): its program slot draws the released cards of its promo and its extras.
 */
export function livePackEv(pool: Pool, kind: string, day: string, at?: number): { ev: number; price: number } | null {
  const p = packOfKind(kind);
  if (!p) return null;
  const def = livePackDef(pool.sport, p, at);
  const program: [RatedCard[], number][] = [[promoCards(pool, promoOfPack(kind), day), def.odds], ...def.extra.map(([id, o]): [RatedCard[], number] => [promoCards(pool, id, day), o])];
  return { ev: packEv(pool, def.slots, { week: weekOf(day), program }), price: def.price };
}
