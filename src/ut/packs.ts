import { catalogOf, readPackSnapshot, studioKind, snapshotPack, STUDIO_PACKS, STUDIO_TIERS } from '../admin/catalog';
// Packs: what's in the store, the odds of every slot, deterministic contents from a seed, the free
// starter, and quick-sell values.
//
// ---------- the economy (docs/ULTIMATE-TEAM.md: "Balanced") ----------
//
// What a player earns in a day of normal play (3-4 games, the missions, the daily chest), in coins,
// from src/engine/economy.ts, missions.ts and the daily reward:
//   games       a draft pays its grade (C 30, B 40, A 50, S 60) + 10 per playoff series won +
//               25 for a title, and 15-50 for a 1 vs 1 win: about 50 a game → 3.5 games ≈ 175
//   missions    30 easy (nearly always) + 50 medium (most days) + 80 hard (some days) + 60 for
//               all three (some days) ≈ 30 + 35 + 28 + 18 ≈ 110
//   daily chest 25 on day 1, +15 a day up to 115 on day 7: ≈ 70 a day over the first week
//   levels      50 coins a level; 40-100 XP a game makes one about every 2-3 games ≈ 50
//   so ≈ 400 coins a day, ≈ 2,800 in the first week. Ultimate Team adds challenge rewards and
//   quick-sells on top (and its own games, once they're played: see play.ts).
//
// Target: a full Gold starting squad after about a week of that.
//   Basketball: 5 starters, the doc's packs as they are. The starter brings one gold; two Gold
//   packs (900, 1,050 since packs-2: 3 golds, ~2 of them new positions) and a position pack or two
//   (700, now 800: 3 golds at the spot still missing) fill the rest: ≈ 2,300-3,000 coins with what's sold back (a spare gold
//   sells for 100-400) ≈ 4-6 days.
//   Football: 23 starters, 4.6 times as many, from the same wallet and the same games. At the same
//   prices a football pack holds 2-3 times the cards (Gold: 12 cards, 10 golds; Premium: 16, 14),
//   its positions drawn in the mix a squad needs (3 WR, 3 LB, 2 OT, ...), and each card sells for
//   about a third as much, so no pack is worth more sold than it cost. One position never fills
//   much of a 23-man squad, so football's position pack is a unit (the line, the secondary, ...):
//   6 golds for 500, about a Gold pack's price per gold, aimed. The last few gaps are what take
//   the time: ≈ 5,500 coins of packs, ≈ 8-11 days.
//   src/ut/economy.test.ts plays it out over 100 players a sport at 400 coins a day, with none of
//   the challenges' rewards: a player who sells what his squad can't use gets there in a median
//   4 days (basketball) and 8 (football); one who keeps his silvers and spare golds, 6 and 11 (7 and
//   12 on packs-2's gold curve and prices).
//   The daily challenges' packs and coins bring both nearer a week.
//
// Legends: about 1 in 150 Premium packs (0.66% a pack), 1 in 500 Gold packs; Hot Season promos
// 6% of Premium packs, 2% of Gold packs.
import { SPOTLIGHT_RATES } from '../../supabase/functions/card-registry/contract';
import { hashString, rng, type Rand, trueRand } from '../engine/rng';
import { type Pool, TIER_RANK } from './pool';
import { TIER_CUTS } from './rate';
import { UT_SCALE } from './ut-scale';
import { fcToDisplay } from './fc-scale';
import { slotsFor, canPlay, positionMix } from './squad';
import type { RatedCard, Tier, UtSport } from './types';
import { easternDateKey } from '../engine/season';
import { weekOf } from './sbc';
import { drawStandout, standoutProgram } from './standouts';
import { HOLO_CHANCE, HOLO_TIERS, holoId, parseVariant } from './variants';
import { livePackName, openLivePack } from './live-packs';

/** Claude 2026-11-01: daily (Daily Drop), scout (Scout's Choice, pick 1 of 3), elite (Elite Gold),
 * jumbo (Jumbo Premium), standout (Standout Guarantee) and lightning (its weekend discount copy). */
export type PackKind = 'bronze' | 'silver' | 'gold' | 'premium' | 'position' | 'spotlight' | 'starter' | 'daily' | 'scout' | 'elite' | 'jumbo' | 'standout' | 'lightning' | 'roster' | 'captains' | 'dynasty';
/**
 * Claude (packs-2): a gold slot with an overall floor, drawn on the one gold curve (GOLD_CURVE): `g78` is
 * "a gold 78+". The floors are basketball's display scale, mapped to each sport's (fc-scale.ts).
 */
export type FloorKind = 'g75' | 'g78' | 'g80' | 'g82' | 'g84' | 'g86' | 'g88';
export const FLOORS: Record<FloorKind, number> = { g75: 75, g78: 78, g80: 80, g82: 82, g84: 84, g86: 86, g88: 88 };
export const isFloorKind = (t: string): t is FloorKind => Object.prototype.hasOwnProperty.call(FLOORS, t);
/**
 * A slot's odds by tier, plus the gold floors. They add up to 1. `gold` and `rare` are the names saved
 * Club Collection recipes and older definitions use: `gold` reads as `g75` and `rare` as `g78`. A rare
 * gold (rare.ts) is the shimmer only now, never a slot.
 */
export type SlotTier = Tier | 'rare' | FloorKind;
export type Odds = Partial<Record<SlotTier, number>>;

export interface PackDef {
  kind: PackKind;
  name: string;
  /** coins; the starter is free */
  price: number;
  blurb: string;
  slots: Odds[];
  /** Claude (packs-2): its gold slots prefer a card the player doesn't own, at the overall drawn (curvePick) */
  prefer?: true;
}

const rep = (n: number, o: Odds): Odds[] => Array.from({ length: n }, () => o);
const B: Odds = { bronze: 1 };
const S: Odds = { silver: 1 };
const G75: Odds = { g75: 1 };
const G78: Odds = { g78: 1 };
const G82: Odds = { g82: 1 };
export const GOAT_SPOTLIGHT = 0.0005;
export const SPOTLIGHT_ODDS: Odds = SPOTLIGHT_RATES;
export const LEGEND_PREMIUM = 0.0066;
/** Claude: the special slot is split between this week's Standouts and Hot Season (same total as before). */
export const STANDOUT_PREMIUM = 0.04;
export const PROMO_PREMIUM = 0.02;
export const LEGEND_GOLD = 0.002;
export const STANDOUT_GOLD = 0.015;
export const PROMO_GOLD = 0.005;
/** Of any Standout pulled, the week's Featured Standout. */
export const FEATURED_STANDOUT = 0.1;
export const STANDOUT_ELITE = 0.1;
export const LEGEND_ELITE = 0.01;
export const STANDOUT_DAILY = 0.02;

/** the slot that can turn into something special (Claude, packs-2: a gold 78+ otherwise, research §8.2) */
const goldPlus: Odds = { g78: 1 - STANDOUT_GOLD - PROMO_GOLD - LEGEND_GOLD, standout: STANDOUT_GOLD, promo: PROMO_GOLD, legend: LEGEND_GOLD };
const premiumPlus: Odds = { g78: 1 - STANDOUT_PREMIUM - PROMO_PREMIUM - LEGEND_PREMIUM, standout: STANDOUT_PREMIUM, promo: PROMO_PREMIUM, legend: LEGEND_PREMIUM };
const elitePlus: Odds = { g84: 1 - STANDOUT_ELITE - LEGEND_ELITE, standout: STANDOUT_ELITE, legend: LEGEND_ELITE };
const dailyLast: Odds = { silver: 0.6, g75: 1 - 0.6 - STANDOUT_DAILY, standout: STANDOUT_DAILY };

/** Claude: the new packs' prices. Football's 16-card Standout pack holds golds that sell for a third
 * as much, so its chase packs cost less; Lightning is always 25% off. */
export const CONTENT_PRICES: Record<UtSport, { scout: number; elite: number; jumbo: number; standout: number; lightning: number }> = {
  // Retuned on the reworked display scale so quick-sell EV is 45–60% of price (FC research target);
  // Scout's Choice is priced on its best option's value. Lightning stays 25% off the Standout pack.
  // Claude (packs-2): Elite Gold re-specced to golds 82+ with an 84+ last slot (research §8.2). Research
  // priced it 3,000, but its quick-sell value is about 1,270 (NFL 875, soccer 925), so 3,000 would return
  // 42%: it is 2,600 (NFL 1,500 → 1,800, soccer unchanged 1,900), about 49%. packs-3 tunes it again.
  nba: { scout: 650, elite: 2600, jumbo: 3600, standout: 3000, lightning: 2250 },
  nfl: { scout: 250, elite: 1800, jumbo: 2700, standout: 1800, lightning: 1350 },
  // soccer (Claude 2026-11-01): eleven starters, about 1.4 times basketball's cards a pack, each worth 0.7 as much sold
  soccer: { scout: 500, elite: 1900, jumbo: 3200, standout: 2600, lightning: 1950 },
};

/**
 * Each pack's shape per sport: its price, and its cards as [bronze, chance-of-silver] (Bronze),
 * [bronze, silver, chance-of-gold] (Silver), [silver, gold, gold-that-can-be-special] (Gold and
 * Premium), golds (Position). `qs` scales quick-sell values.
 */
export const PACK_SHAPE = {
  // Claude 2026-11-01 (after the ratings rework): every paid pack retuned so its average quick-sell
  // value is 45–60% of the price on the new display scale (NBA Bronze 150 → 250; NFL Bronze 150 → 175,
  // Silver 400 → 320, Premium 1,800 → 1,400). Gold and Position were already in range.
  // Claude (packs-2): golds on the per-overall curve are worth more sold (gold mean 77.9 → 79.9), so the
  // packs that went over 60% EV are re-priced to about 57-59% (Silver 400 → 500, Gold 900 → 1,050,
  // Position 700 → 800; NFL Silver 320 → 350, Gold 900 → 1,000, Unit 500 → 575; soccer Silver 380 → 450).
  // packs-3 tunes every price again against its EV band.
  nba: { price: { bronze: 250, silver: 500, gold: 1050, premium: 1800, position: 800 }, bronze: [4, 1], silver: [1, 3, 1], gold: [2, 2, 1], premium: [2, 5, 1], position: 3, qs: 1, rare: { gold: 1, premium: 3, position: 1 } },
  // football: 23 starters to fill, so two to three times the cards, each worth about a third as much sold
  nfl: {
    price: { bronze: 175, silver: 350, gold: 1000, premium: 1400, position: 575 },
    bronze: [8, 2],
    silver: [2, 6, 2],
    gold: [2, 9, 1],
    premium: [2, 13, 1],
    position: 6,
    qs: 0.35,
    rare: { gold: 2, premium: 6, position: 2 },
  },
  soccer: {
    price: { bronze: 220, silver: 450, gold: 900, premium: 1600, position: 650 },
    bronze: [5, 2],
    silver: [2, 4, 1],
    gold: [2, 3, 1],
    premium: [2, 7, 1],
    position: 4,
    qs: 0.7,
    rare: { gold: 1, premium: 4, position: 1 },
  },
};

/** Claude: the new packs' shapes: [cards], and (packs-2) how many of their golds are 78+ (the old
 * rare-gold counts). Elite Gold: its golds 82+, and how many of them 84+ (the last one the special slot). */
const CONTENT_SHAPE = {
  nba: { daily: 3, elite: { g82: 5, g84: 1 }, jumbo: { silver: 4, gold: 4, rare: 7 }, standout: { gold: 4, rare: 3 } },
  nfl: { daily: 6, elite: { g82: 10, g84: 2 }, jumbo: { silver: 8, gold: 9, rare: 14 }, standout: { gold: 9, rare: 6 } },
  soccer: { daily: 4, elite: { g82: 7, g84: 1 }, jumbo: { silver: 5, gold: 6, rare: 9 }, standout: { gold: 6, rare: 4 } },
};

/** Claude (packs-2): a Club Collection recipe's tier as a slot (its `gold` is any gold, its `rare` a gold 78+). */
const studioSlot = (t: string): Odds => (t === 'gold' ? G75 : t === 'rare' ? G78 : { [t]: 1 });

export function packDefs(sport: UtSport): Record<Exclude<PackKind, 'starter'>, PackDef> {
  const k = PACK_SHAPE[sport];
  const [bb, br] = k.bronze;
  const [sb, ss, sr] = k.silver;
  const [gs, gg, gr] = k.gold;
  const [ps, pg, pr] = k.premium;
  const c = CONTENT_SHAPE[sport];
  const standoutSlots = [...rep(c.standout.gold, G75), ...rep(c.standout.rare, G78), { standout: 1 }];
  // Claude (packs-2, research §8.1/§8.2): every gold comes from one per-overall curve. A pack's old rare
  // golds are its 78+ slots now, and its special slot is one of them; the rest of its golds are any gold.
  const goldRest = (golds: number, rare: number) => golds - rare;
  const defs = {
    bronze: {
      kind: 'bronze',
      name: 'Bronze Pack',
      price: k.price.bronze,
      blurb: bb + br + ' cards, mostly bronze, 20% a silver',
      slots: [...rep(bb, B), ...rep(br, { bronze: 0.8, silver: 0.2 })],
    },
    silver: {
      kind: 'silver',
      name: 'Silver Pack',
      price: k.price.silver,
      blurb: sb + ss + sr + ' cards, silver-heavy, 25% a gold',
      slots: [...rep(sb, B), ...rep(ss, S), ...rep(sr, { silver: 0.75, g75: 0.25 })],
    },
    gold: {
      kind: 'gold',
      name: 'Gold Pack',
      price: k.price.gold,
      blurb: gs + gg + gr + ' cards, ' + (gg + gr) + ' golds, ' + k.rare.gold + ' of them 78+',
      slots: [...rep(gs, S), ...rep(goldRest(gg + gr, k.rare.gold), G75), ...rep(k.rare.gold - gr, G78), ...rep(gr, goldPlus)],
    },
    premium: {
      kind: 'premium',
      name: 'Premium Gold',
      price: k.price.premium,
      blurb: ps + pg + pr + ' cards, ' + (pg + pr) + ' golds (' + k.rare.premium + ' of them 78+), 6% a Standout or Hot Season, 0.66% a Legend',
      slots: [...rep(ps, S), ...rep(goldRest(pg + pr, k.rare.premium), G75), ...rep(k.rare.premium - pr, G78), ...rep(pr, premiumPlus)],
    },
    spotlight: {
      kind: 'spotlight',
      name: 'Spotlight Pack',
      price: 3500,
      // (soccer has no Spotlight editions: the Store leaves this pack out, storeOrder)
      blurb: SPOTLIGHT_COMMON[sport] + 1 + ' gold-or-better cards. 20% Spotlight, 0.05% GOAT. Online.',
      // Claude (packs-2): its golds are rebuilt from the registry's receipt by the pre-curve draw
      // (legacyFill), so a retried receipt always gives the cards it was minted with
      slots: [...rep(SPOTLIGHT_COMMON[sport], { gold: 1 }), SPOTLIGHT_ODDS],
    },
    position: {
      kind: 'position',
      name: 'Position Pack',
      price: k.price.position,
      blurb: k.position + ' golds (' + k.rare.position + ' of them 78+) at the position you pick, ones you don’t own first',
      slots: [...rep(k.position - k.rare.position, G75), ...rep(k.rare.position, G78)],
      prefer: true,
    },
    daily: {
      kind: 'daily',
      name: 'Daily Drop',
      price: 0,
      blurb: c.daily + ' free cards once a day; the last can be a gold or a Weekly Standout',
      slots: [...rep(c.daily - 1, { bronze: 0.5, silver: 0.5 }), dailyLast],
    },
    scout: {
      kind: 'scout',
      name: "Scout's Choice",
      price: CONTENT_PRICES[sport].scout,
      blurb: 'Three ' + fcToDisplay(84, sport) + '+ golds face down' + ((sport === 'nfl' && ' from one position group') || '') + '. Keep one',
      slots: rep(3, { g84: 1 - SCOUT_STANDOUT, standout: SCOUT_STANDOUT }),
    },
    elite: {
      kind: 'elite',
      name: 'Elite Gold',
      price: CONTENT_PRICES[sport].elite,
      blurb: c.elite.g82 + c.elite.g84 + ' golds ' + fcToDisplay(82, sport) + '+, ' + c.elite.g84 + ' of them ' + fcToDisplay(84, sport) + '+; the last is a Standout 10% or a Legend 1%',
      slots: [...rep(c.elite.g82, G82), ...rep(c.elite.g84 - 1, { g84: 1 }), elitePlus],
      prefer: true,
    },
    jumbo: {
      kind: 'jumbo',
      name: 'Jumbo Premium',
      price: CONTENT_PRICES[sport].jumbo,
      blurb: c.jumbo.silver + c.jumbo.gold + c.jumbo.rare + 1 + ' cards: ' + (c.jumbo.gold + c.jumbo.rare + 1) + ' golds, ' + (c.jumbo.rare + 1) + ' of them 78+, one a premium slot',
      slots: [...rep(c.jumbo.silver, S), ...rep(c.jumbo.gold, G75), ...rep(c.jumbo.rare, G78), premiumPlus],
    },
    standout: {
      kind: 'standout',
      name: 'Standout Guarantee',
      price: CONTENT_PRICES[sport].standout,
      blurb: standoutSlots.length + ' cards: ' + (c.standout.gold + c.standout.rare) + ' golds (' + c.standout.rare + ' of them 78+) and one of this week’s Standouts guaranteed',
      slots: standoutSlots,
    },
    lightning: {
      kind: 'lightning',
      name: 'Lightning Standout',
      price: CONTENT_PRICES[sport].lightning,
      blurb: 'The Standout Guarantee, 25% off, in short weekend windows',
      slots: standoutSlots,
    },
  } as Record<Exclude<PackKind, 'starter'>, PackDef>;
  for (const kind of STUDIO_PACKS) {
    const p = catalogOf(sport)[kind];
    defs[kind] = { kind, name: p.name, price: p.price, blurb: STUDIO_TIERS.filter((t) => p.counts[t]).map((t) => p.counts[t] + ' ' + (t === 'rare' ? 'gold 78+' : t)).join(' · ') + ' guaranteed', slots: STUDIO_TIERS.flatMap((t) => rep(p.counts[t], studioSlot(t))) };
  }
  return defs;
}

/** Claude: chance that one Scout's Choice option is a Weekly Standout. */
export const SCOUT_STANDOUT = 0.03;

export const STORE_ORDER: Exclude<PackKind, 'starter'>[] = ['spotlight', 'bronze', 'silver', 'gold', 'premium', 'position'];
/** The Spotlight pack's gold slots before its chase card. */
const SPOTLIGHT_COMMON: Record<UtSport, number> = { nba: 7, nfl: 15, soccer: 10 };
/** The packs a sport's Store sells: soccer has no Spotlight (no registered serials for soccer). */
export function storeOrder(sport: UtSport): Exclude<PackKind, 'starter'>[] {
  return sport === 'soccer' ? STORE_ORDER.filter((k) => k !== 'spotlight') : STORE_ORDER;
}

export function packName(sport: UtSport, kind: string): string {
  const snapshot=readPackSnapshot(kind);if(snapshot)return snapshot.pack.name;
  if (kind.startsWith('event-spotlight:')) return 'Spotlight Reward';
  if (kind === 'standout-pick') return 'Standout Pick';
  if (kind.startsWith('live')) return livePackName(sport, kind);
  if (kind === 'admin-goat') return 'GOAT Pack';
  if (kind === 'admin-icon') return 'Icon Pack';
  if(kind==='admin-squad')return 'Gold Squad Pack';
  if(kind==='admin-icon-team')return 'All-Time Squad Pack';
  if(kind.startsWith('admin-card:')){try{return decodeURIComponent(kind.split(':')[2]??'Player Award')+' Pack';}catch{return 'Player Award Pack';}}
  if (kind === 'starter') return 'Starter Pack';
  if (kind.startsWith('position:')) return (positionChoices(sport).find((c) => c.key === kind.slice(9))?.label ?? kind.slice(9)) + ' Pack';
  return packDefs(sport)[kind as Exclude<PackKind, 'starter'>]?.name ?? 'Pack';
}

// ---------- drawing cards ----------

/**
 * Claude (packs-2, research §8.1): the per-overall curves. A gold slot first draws an overall on
 * GOLD_CURVE (restricted to the slot's floor and renormalised), then a card at that overall. Weights
 * are percentages on basketball's display scale (FC-style: gold 75–99), mapped to each sport's through
 * the tier cuts (fc-scale.ts). Per any-gold slot: 75–79 45.0%, 80–82 49.2%, 83–85 5.2%, 86+ 0.59%
 * (85+ 1.0%, 88+ 0.20%). 92 and 93 extend the research's 91 ceiling with a trace so soccer's few base
 * golds that high can still drop (0.003%). The silver curve leans gently to 70–74 (45 / 55).
 */
export type Curve = Readonly<Record<number, number>>;
export const GOLD_CURVE: Curve = { 75: 4.56, 76: 5.02, 77: 6.71, 78: 13.46, 79: 15.29, 80: 17.67, 81: 16.22, 82: 15.28, 83: 3.4, 84: 1.38, 85: 0.43, 86: 0.22, 87: 0.16, 88: 0.15, 89: 0.034, 90: 0.011, 91: 0.005, 92: 0.002, 93: 0.001 };
export const SILVER_CURVE: Curve = { 65: 9, 66: 9, 67: 9, 68: 9, 69: 9, 70: 11, 71: 11, 72: 11, 73: 11, 74: 11 };

const uniform = (list: readonly RatedCard[], rand: Rand) => list[Math.floor(rand() * list.length)];

/** A curve on a sport's display scale: its overalls ascending and their weights. */
interface Scaled {
  ovr: number[];
  w: number[];
}
const scaledCache = new Map<Curve, Partial<Record<UtSport, Scaled>>>();
function scaled(curve: Curve, sport: UtSport): Scaled {
  let m = scaledCache.get(curve);
  if (!m) scaledCache.set(curve, (m = {}));
  let s = m[sport];
  if (!s) {
    const acc = new Map<number, number>();
    for (const [k, w] of Object.entries(curve)) {
      const o = fcToDisplay(Number(k), sport);
      acc.set(o, (acc.get(o) ?? 0) + w);
    }
    const ovr = [...acc.keys()].sort((a, b) => a - b);
    s = m[sport] = { ovr, w: ovr.map((o) => acc.get(o)!) };
  }
  return s;
}

/** The chance a slot on `curve` with floor `floor` (display scale) lands on each overall: exact. */
export function curveOdds(curve: Curve, floor: number, sport: UtSport): Map<number, number> {
  const s = scaled(curve, sport);
  const total = s.ovr.reduce((a, o, i) => a + (o >= floor ? s.w[i] : 0), 0);
  const out = new Map<number, number>();
  s.ovr.forEach((o, i) => o >= floor && total > 0 && out.set(o, s.w[i] / total));
  return out;
}

/** An overall drawn on the curve at or above `floor`, renormalised (one rand). */
function drawOvr(curve: Curve, floor: number, sport: UtSport, rand: Rand): number | null {
  const s = scaled(curve, sport);
  let total = 0;
  for (let i = 0; i < s.ovr.length; i++) if (s.ovr[i] >= floor) total += s.w[i];
  if (total <= 0) return null;
  let x = rand() * total;
  let last: number | null = null;
  for (let i = 0; i < s.ovr.length; i++) {
    if (s.ovr[i] < floor) continue;
    last = s.ovr[i];
    if (x < s.w[i]) return last;
    x -= s.w[i];
  }
  return last;
}

/** A list of cards by displayed overall (built once per list). */
const byOvrCache = new WeakMap<readonly RatedCard[], Map<number, RatedCard[]>>();
function byOvr(list: readonly RatedCard[]): Map<number, RatedCard[]> {
  let m = byOvrCache.get(list);
  if (!m) {
    m = new Map();
    for (const rc of list) {
      const l = m.get(rc.ovr);
      if (l) l.push(rc);
      else m.set(rc.ovr, [rc]);
    }
    byOvrCache.set(list, m);
  }
  return m;
}

/** The overall present in `idx` nearest to `want`: −1, +1, −2, +2, …, never outside [lo, hi]. */
function nearestPresent(idx: Map<number, RatedCard[]>, want: number, lo: number, hi: number): number | null {
  for (let d = 0; want - d >= lo || want + d <= hi; d++) {
    if (want - d >= lo && want - d <= hi && idx.get(want - d)?.length) return want - d;
    if (d > 0 && want + d <= hi && want + d >= lo && idx.get(want + d)?.length) return want + d;
  }
  return null;
}

export interface CurveOpts {
  /** card ids the player owns: with them the pick prefers a card he doesn't (duplicate protection) */
  owned?: ReadonlySet<string>;
}

/**
 * With `owned`, the cards at overall `at` the player doesn't own; when he owns them all, those at the
 * nearest overall above (+1, +2, … up to `hi`); empty when he owns every card from `at` up, and the
 * caller then gives a card at `at` (a duplicate). It never steps below `at`, so for every overall x the
 * chance of x or better with the protection is at least the published (fresh-club) chance.
 * (Claude, packs-2 review fix: it used to try −1 after +1 at each distance, which lowered 84+ / 88+ rates.)
 */
function unownedNear(idx: Map<number, RatedCard[]>, at: number, hi: number, owned: ReadonlySet<string>): RatedCard[] {
  for (let o = at; o <= hi; o++) {
    const fresh = (idx.get(o) ?? []).filter((rc) => !owned.has(rc.line.id));
    if (fresh.length) return fresh;
  }
  return [];
}

/** The top overall a curve reaches on a sport's scale. */
const curveTop = (curve: Curve, sport: UtSport) => {
  const s = scaled(curve, sport);
  return s.ovr[s.ovr.length - 1];
};

/**
 * Claude (packs-2): one card from `list` on `curve` at `floor`+ (display scale). It draws an overall,
 * resolves it to the nearest overall the list has (−1, +1, −2, …, never below the floor or above the
 * curve's top) and picks uniformly there. Null when the list has nothing in range. With `owned` it
 * prefers a card the player doesn't own (unownedNear), so a fresh club draws exactly the curve.
 */
export function curvePick(list: readonly RatedCard[], curve: Curve, floor: number, rand: Rand, opts?: CurveOpts): RatedCard | null {
  if (!list.length) return null;
  const sport = list[0].line.sport;
  const top = curveTop(curve, sport);
  const want = drawOvr(curve, floor, sport, rand);
  if (want === null) return null;
  const idx = byOvr(list);
  const at = nearestPresent(idx, want, floor, top);
  if (at === null) return null;
  const fresh = opts?.owned?.size ? unownedNear(idx, at, top, opts.owned) : [];
  return uniform(fresh.length ? fresh : idx.get(at)!, rand);
}

/**
 * The share of a gold slot's curve mass that lands on another overall than drawn because no position in
 * the slot's mix has a card there (the step-down fallback, exact).
 */
export function curveStepMass(pool: Pool, floor: FloorKind, mix?: [string, number][]): number {
  const lo = fcToDisplay(FLOORS[floor], pool.sport);
  const idx = byOvr(goldsOf(pool, (mix ?? Object.entries(positionMix(pool.sport))).map(([p]) => p)));
  let moved = 0;
  for (const [o, p] of curveOdds(GOLD_CURVE, lo, pool.sport)) if (!idx.get(o)?.length) moved += p;
  return moved;
}

function drawPos(mix: [string, number][], rand: Rand): string {
  const tot = mix.reduce((a, [, w]) => a + w, 0);
  let x = rand() * tot;
  for (const [p, w] of mix) {
    if (x < w) return p;
    x -= w;
  }
  return mix[mix.length - 1][0];
}

/** Every gold of a pool (and of a mix's positions), built once. */
const allGoldCache = new WeakMap<Pool, Map<string, RatedCard[]>>();
export function goldsOf(pool: Pool, positions?: readonly string[]): RatedCard[] {
  let m = allGoldCache.get(pool);
  if (!m) allGoldCache.set(pool, (m = new Map()));
  const key = positions ? positions.join(',') : '*';
  let l = m.get(key);
  if (!l) {
    l = (positions ?? Object.keys(pool.buckets.gold)).flatMap((p) => pool.buckets.gold[p] ?? []);
    m.set(key, l);
  }
  return l;
}

/**
 * Claude (packs-2, research §8.1): a gold `floor`+ (basketball's display number) on the gold curve. It
 * draws the overall first, then a position of the mix that has a card at that overall (by the mix's
 * weights), then a card there uniformly. Only when no position of the mix has that overall does it move
 * to the nearest one that does (−1, +1, …). `owned` turns on the preference for cards the player
 * doesn't own: at the drawn overall at that position, then at any of the mix's positions, then the
 * nearest overall above (unownedNear, never below: a duplicate at the drawn overall instead).
 */
export function drawGold(pool: Pool, floor: number, rand: Rand, mix?: [string, number][], owned?: ReadonlySet<string>): RatedCard | null {
  const sport = pool.sport;
  const lo = fcToDisplay(floor, sport);
  const golds = pool.buckets.gold;
  const m = (mix ?? Object.entries(positionMix(sport))).filter(([p]) => golds[p]?.length);
  const all = byOvr(goldsOf(pool, m.map(([p]) => p)));
  const top = curveTop(GOLD_CURVE, sport);
  const want = drawOvr(GOLD_CURVE, lo, sport, rand);
  const at = want === null ? null : nearestPresent(all, want, lo, top);
  // the mix has nothing that high (a unit without a gold that good): any position
  if (at === null) return m.length === Object.keys(golds).length ? null : curvePick(goldsOf(pool), GOLD_CURVE, lo, rand, { owned });
  const pos = drawPos(
    m.filter(([p]) => byOvr(golds[p]).get(at)?.length),
    rand
  );
  const here = byOvr(golds[pos]).get(at)!;
  if (owned?.size) {
    const free = here.filter((rc) => !owned.has(rc.line.id));
    const fresh = free.length ? free : unownedNear(all, at, top, owned);
    if (fresh.length) return uniform(fresh, rand);
  }
  return uniform(here, rand);
}

const TIERS_DOWN: Tier[] = ['goat', 'spotlight', 'legend', 'promo', 'gold', 'silver', 'bronze'];

/** One card of a tier in a position's bucket: golds and silvers on their curves, the rest uniform. */
function fromBucket(list: RatedCard[], tier: Tier, rand: Rand): RatedCard {
  if (tier === 'gold') return curvePick(list, GOLD_CURVE, TIER_CUTS[list[0].line.sport].gold, rand) ?? uniform(list, rand);
  if (tier === 'silver') return curvePick(list, SILVER_CURVE, TIER_CUTS[list[0].line.sport].silver, rand) ?? uniform(list, rand);
  return uniform(list, rand);
}

/** One card of a tier: at a position drawn in the squad's mix, or the given mix, or the one asked for. */
function drawCard(pool: Pool, tier: Tier, rand: Rand, want: string | null, mix?: [string, number][]): RatedCard | null {
  const bucket = pool.buckets[tier];
  let pos = want;
  if (tier === 'promo' || tier === 'legend' || tier === 'spotlight' || tier === 'goat') {
    // few enough that they come from the whole tier, whatever the position
    const all = Object.values(bucket).flat();
    if (all.length) return uniform(all, rand);
  } else {
    pos ??= drawPos(mix ?? Object.entries(positionMix(pool.sport)), rand);
    if (bucket[pos]?.length) return fromBucket(bucket[pos], tier, rand);
  }
  // nothing there: the next tier down at that position, then anyone in the tier
  const i = TIERS_DOWN.indexOf(tier);
  for (const t of TIERS_DOWN.slice(i + 1)) {
    const b = pool.buckets[t][pos ?? ''];
    if (pos && b?.length) return fromBucket(b, t, rand);
  }
  const any = Object.values(bucket).filter((l) => l.length);
  if (any.length) return fromBucket(any[Math.floor(rand() * any.length)], tier, rand);
  return i + 1 < TIERS_DOWN.length ? drawCard(pool, TIERS_DOWN[i + 1], rand, want, mix) : null;
}

/** Claude: the Eastern week whose Standouts a pack opened now draws from. */
export function currentWeek(): string {
  return weekOf(easternDateKey());
}

/** Card ids a club owns (variants as their base edition), for duplicate protection; built once per list. */
const ownedCache = new WeakMap<readonly { cardId: string }[], ReadonlySet<string>>();
export function ownedCardIds(owned: readonly { cardId: string }[]): ReadonlySet<string> {
  let s = ownedCache.get(owned);
  if (!s) {
    s = new Set(owned.map((o) => parseVariant(o.cardId)?.base ?? o.cardId));
    ownedCache.set(owned, s);
  }
  return s;
}

/** Claude (packs-2): what an opening knows about the player. */
export interface OpenOpts {
  /** the club's card ids (ownedCardIds): Standout and program slots never repeat an owned card while
   * any of their set is unowned, and a `prefer` pack's golds prefer an unowned card (curvePick) */
  owned?: ReadonlySet<string>;
}

/** A Weekly Standout; one the player owns is redrawn among the week's he doesn't (chase protection). */
function drawStandoutFor(pool: Pool, week: string, rand: Rand, owned?: ReadonlySet<string>): RatedCard | null {
  const c = drawStandout(pool, week, rand, FEATURED_STANDOUT);
  if (!c || !owned?.has(c.line.id)) return c;
  const fresh = standoutProgram(pool, week).cards.filter((rc) => !owned.has(rc.line.id));
  return fresh.length ? uniform(fresh, rand) : c;
}

/** The slot name a drawn tier means (saved recipes' `gold` and `rare`, see SlotTier). */
const slotKind = (t: SlotTier): SlotTier => (t === 'gold' ? 'g75' : t === 'rare' ? 'g78' : t);

const DRAW_ORDER: SlotTier[] = ['goat', 'spotlight', 'legend', 'landmark', 'program', 'promo', 'standout', 'g88', 'g86', 'g84', 'g82', 'g80', 'g78', 'rare', 'g75', 'gold', 'silver', 'bronze'];

function drawTier(o: Odds, rand: Rand): SlotTier {
  let x = rand();
  let last: SlotTier = 'bronze';
  for (const t of DRAW_ORDER) {
    const p = o[t] ?? 0;
    if (p <= 0) continue;
    last = t;
    if (x < p) return t;
    x -= p;
  }
  return last;
}

/**
 * Claude (packs-2, research §8.2): the chance a special edition from this slot is its holographic
 * variant. Only a slot that rolls for its special (chance under 1) can give a holo: a guaranteed
 * Standout or program card never does.
 */
export function holoChanceOf(slot: Odds, tier: SlotTier): number {
  const p = slot[tier] ?? 0;
  return p > 0 && p < 1 ? HOLO_CHANCE : 0;
}

/** A pack's cards from its slots: no card twice in one pack. */
/** Claude wave 3: `program` draws a Live Calendar program slot (live-packs.ts). */
export type ProgramDraw = (rand: Rand, owned?: ReadonlySet<string>) => RatedCard | null;

export interface FillOpts extends OpenOpts {
  /** the pack's golds prefer cards the player doesn't own (PackDef.prefer) */
  prefer?: boolean;
}

export function fill(pool: Pool, slots: Odds[], rand: Rand, mix?: [string, number][], week = currentWeek(), program?: ProgramDraw, opts: FillOpts = {}): RatedCard[] {
  const out: RatedCard[] = [];
  const ids = new Set<string>();
  const owned = opts.owned;
  const draw = (t: SlotTier): RatedCard | null => {
    if (isFloorKind(t)) return drawGold(pool, FLOORS[t], rand, mix, opts.prefer ? owned : undefined);
    if (t === 'standout') return drawStandoutFor(pool, week, rand, owned) ?? drawGold(pool, FLOORS.g78, rand, mix);
    if (t === 'program') return (program?.(rand, owned) ?? null) || draw('standout');
    return drawCard(pool, t as Tier, rand, null, mix);
  };
  for (const o of slots) {
    const rolled = drawTier(o, rand);
    const tier = slotKind(rolled);
    let c: RatedCard | null = null;
    for (let k = 0; k < 6; k++) {
      c = draw(tier);
      if (c && !ids.has(c.line.id) && !(tier === 'standout' && ids.has('pid:' + c.line.pid))) break;
    }
    if (!c) continue;
    ids.add(c.line.id);
    ids.add('pid:' + c.line.pid);
    // Claude wave 2: a special edition from a pack is sometimes its holographic variant (variants.ts)
    if (HOLO_TIERS.has(c.tier) && rand() < holoChanceOf(o, rolled)) c = pool.base.get(holoId(c.line.id)) ?? c;
    out.push(c);
  }
  return out;
}

// ---------- the pre-curve draw (registered packs) ----------

/**
 * Within a tier the lower overalls are the common ones: each point above the tier's floor is 20%
 * rarer (football's scale is about half as wide at the top, so a point there counts 2.2 times).
 * Claude (packs-2): the draw every pack used before the gold curve, kept only so a registered Spotlight
 * or GOAT pack rebuilds its common golds from the registry's receipt exactly as they were minted.
 */
const RARER = 0.8;
const STEP: Record<UtSport, number> = { nba: 1.6, nfl: 2.2, soccer: 1.6 };
const legacyCum = new WeakMap<RatedCard[], number[]>();

function legacyWeighted(list: RatedCard[], tier: Tier, rand: Rand): RatedCard {
  let c = legacyCum.get(list);
  if (!c) {
    let t = 0;
    const sport = list[0]?.line.sport ?? 'nba';
    const floor = tier === 'gold' ? TIER_CUTS[sport].gold : TIER_CUTS[sport].silver;
    c = list.map((rc) => (t += tier === 'silver' || tier === 'gold' ? Math.pow(RARER, Math.max(0, rc.ovr - floor) * STEP[sport]) : 1));
    legacyCum.set(list, c);
  }
  const x = rand() * c[c.length - 1];
  let lo = 0;
  let hi = c.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (c[m] <= x) lo = m + 1;
    else hi = m;
  }
  return list[lo];
}

/** A gold by the pre-curve draw (with its old fallbacks down the tiers). */
function legacyGold(pool: Pool, rand: Rand): RatedCard | null {
  const pos = drawPos(Object.entries(positionMix(pool.sport)), rand);
  if (pool.buckets.gold[pos]?.length) return legacyWeighted(pool.buckets.gold[pos], 'gold', rand);
  for (const t of ['silver', 'bronze'] as Tier[]) if (pool.buckets[t][pos]?.length) return legacyWeighted(pool.buckets[t][pos], t, rand);
  const any = Object.values(pool.buckets.gold).filter((l) => l.length);
  return any.length ? legacyWeighted(any[Math.floor(rand() * any.length)], 'gold', rand) : null;
}

/** `n` golds by the pre-curve draw, no card twice: exactly what `fill` gave a gold-only pack before packs-2. */
export function legacyFill(pool: Pool, n: number, rand: Rand): RatedCard[] {
  const out: RatedCard[] = [];
  const ids = new Set<string>();
  for (let s = 0; s < n; s++) {
    rand(); // the slot's tier roll (a gold slot is always gold)
    let c: RatedCard | null = null;
    for (let k = 0; k < 6; k++) {
      c = legacyGold(pool, rand);
      if (c && !ids.has(c.line.id)) break;
    }
    if (!c) continue;
    ids.add(c.line.id);
    out.push(c);
  }
  return out;
}

/** The rand for a pack's seed. */
export function packRand(seed: string): Rand {
  return rng(hashString('ut-pack:' + seed));
}

/**
 * What a position pack can be: basketball's five positions; football's units (a quarterback alone
 * fills one of 23 spots, so football's packs cover a unit, positions drawn in the squad's mix).
 */
export function positionChoices(sport: UtSport): { key: string; label: string; positions: string[] }[] {
  if (sport === 'soccer') return SOCCER_UNITS.map(([key, label, positions]) => ({ key, label, positions }));
  if (sport === 'nba') return ['PG', 'SG', 'SF', 'PF', 'C'].map((p) => ({ key: p, label: p, positions: [p] }));
  return NFL_UNITS.map(([key, label, positions]) => ({ key, label, positions }));
}

/** Soccer's position packs (Claude 2026-11-01): the keeper, the defence, the midfield, the attack. */
export const SOCCER_UNITS: [string, string, string[]][] = [
  ['GK', 'Goalkeepers', ['GK']],
  ['DEF', 'Defenders', ['CB', 'FB']],
  ['MID', 'Midfielders', ['DM', 'CM', 'AM']],
  ['ATT', 'Attackers', ['W', 'ST']],
];

export const NFL_UNITS: [string, string, string[]][] = [
  ['QB-RB-K', 'QB · RB · K', ['QB', 'RB', 'K']],
  ['WR-TE', 'Receivers', ['WR', 'TE']],
  ['OL', 'Offensive Line', ['OT', 'OG', 'C']],
  ['DL', 'Defensive Line', ['DE', 'DT']],
  ['LB', 'Linebackers', ['LB']],
  ['DB', 'Secondary', ['CB', 'S']],
];

/**
 * A pack's contents, truly random (the device's randomness); with a `seed` (the tests) the same
 * seed always gives the same cards. `kind` is a store pack, the starter, or "position:<key>" (a
 * key from positionChoices).
 */
export function openPack(pool: Pool, kind: string, seed?: string, week = currentWeek(), opts: OpenOpts = {}): RatedCard[] {
  const rand = seed === undefined ? trueRand() : packRand(seed);
  // Claude: Scout's Choice is a pick of three, not a pack (content-packs.ts pickOptions)
  if (kind === 'scout' || kind === 'standout-pick' || kind.startsWith('live-pick:')) throw new Error('This is a pick, not a pack.');
  // Claude wave 3: Live Calendar program packs (live-packs.ts)
  if (kind.startsWith('live:') || kind.startsWith('live-plus:')) return openLivePack(pool, kind, rand, easternDateKey(), week, opts.owned);
  // The rare slot is rolled and numbered by the shared registry, never by this local RNG.
  if (kind === 'spotlight' || kind.startsWith('event-spotlight:')) throw new Error('This pack needs the shared card registry.');
  if (kind === 'admin-goat') throw new Error('This pack needs an admin award and the card registry.');
  if(kind==='admin-squad'||kind==='admin-icon-team'){const used=new Set<string>();return slotsFor(pool.sport).filter(s=>s.weight>0).map(slot=>{const matching=[...pool.base.values()].filter(c=>canPlay(slot,c)&&!used.has(c.line.pid));const preferred=matching.filter(c=>c.tier===(kind==='admin-icon-team'?'legend':'gold')),options=preferred.length?preferred:matching.filter(c=>c.tier==='gold');if(!options.length)throw new Error('The team pack is unavailable for this position.');const c=options[Math.floor(rand()*options.length)];used.add(c.line.pid);return c;});}
  if(kind.startsWith('admin-card:')){const id=decodeURIComponent(kind.split(':')[1]);if(!/^(nba|nfl|soccer):(season|promo|legend|standout|landmark):/.test(id))throw new Error('This player award requires a registered pack.');const c=pool.base.get(id);if(!c||c.line.sport!==pool.sport)throw new Error('This card is unavailable in this sport.');return [c];}
  if (kind === 'admin-icon') return fill(pool, [{legend:1}], rand, undefined, week, undefined, opts);
  if (kind === 'starter') return starterCards(pool, rand);
  const snapshot=readPackSnapshot(studioKind(kind)?snapshotPack(pool.sport,kind):kind);
  if(kind.startsWith('studio:')&&!snapshot)throw Error('Invalid saved pack recipe.');
  if(snapshot)return fill(pool,STUDIO_TIERS.flatMap(t=>rep(snapshot.pack.counts[t],studioSlot(t))),rand,undefined,week,undefined,opts);
  const defs = packDefs(pool.sport);
  if (kind.startsWith('position:')) {
    const ch = positionChoices(pool.sport).find((c) => c.key === kind.slice(9));
    if (!ch) throw new Error(UNKNOWN_PACK);
    const need = positionMix(pool.sport);
    return fill(
      pool,
      defs.position.slots,
      rand,
      ch.positions.map((p) => [p, need[p] ?? 1]),
      week,
      undefined,
      { ...opts, prefer: defs.position.prefer }
    );
  }
  const def = defs[kind as Exclude<PackKind, 'starter'>];
  // Claude (packs-1, decision D9): a kind this build doesn't know (a reward pack from a newer build,
  // synced in a cloud save) never opens empty: it throws, so the pending pack stays until an update
  // can open it. Before, it opened as no cards and the pending entry was spent.
  if (!def) throw new Error(UNKNOWN_PACK);
  return fill(pool, def.slots, rand, undefined, week, undefined, { ...opts, prefer: def.prefer });
}

/**
 * Claude (packs-1 fix, review finding 6): whether this build knows a pending pack's kind (openPack can
 * open it, or it is a pick or a registry pack). An unknown kind is a reward from a newer build: the Store
 * labels it "New Pack · UPDATE TO OPEN" instead of a generic "Pack" that only explains itself on a tap.
 */
export function knownPack(sport: UtSport, kind: string): boolean {
  if (kind === 'starter' || kind === 'scout' || kind === 'standout-pick' || kind === 'spotlight' || kind === 'admin-goat' || kind === 'admin-icon' || kind === 'admin-squad' || kind === 'admin-icon-team') return true;
  if (['live-pick:', 'live:', 'live-plus:', 'event-spotlight:', 'admin-card:', 'studio:'].some((p) => kind.startsWith(p))) return true;
  if (readPackSnapshot(kind)) return true;
  if (kind.startsWith('position:')) return positionChoices(sport).some((c) => c.key === kind.slice(9));
  return Object.prototype.hasOwnProperty.call(packDefs(sport), kind);
}

/** Claude (packs-1): why a pack this build can't open stays where it is (openPack throws it). */
export const UNKNOWN_PACK = 'Update the game to open this pack. It stays in your Store until then.';

/**
 * The free starter: a card for every spot of a squad (a third of them silver, the quarterback or
 * point guard among them), one gold to start the club, and basketball a full bench.
 */
function starterCards(pool: Pool, rand: Rand): RatedCard[] {
  const mix = Object.entries(positionMix(pool.sport));
  const spots: string[] = mix.flatMap(([p, n]) => Array.from({ length: n }, () => p));
  if (pool.sport === 'nba') spots.push(...spots.slice());
  const out: RatedCard[] = [];
  const ids = new Set<string>();
  const pids = new Set<string>();
  const take = (tier: Tier, pos: string | null) => {
    // a thin bucket (few silver tackles, say) can keep drawing the same man: then the next tier
    for (const t of [tier, ...(['bronze', 'silver', 'gold'] as Tier[]).filter((x) => x !== tier)])
      for (let k = 0; k < 12; k++) {
        const c = drawCard(pool, t, rand, pos);
        if (c && !ids.has(c.line.id) && !pids.has(c.line.pid)) {
          ids.add(c.line.id);
          pids.add(c.line.pid);
          out.push(c);
          return;
        }
      }
  };
  // soccer (Claude 2026-11-01): the eleven and three to rotate in
  if (pool.sport === 'soccer') spots.push('CB', 'CM', 'ST');
  spots.forEach((p, i) => take(i === 0 || rand() < (pool.sport === 'nba' && i < 5 ? 0.6 : 0.3) ? 'silver' : 'bronze', p));
  take('gold', null);
  return out;
}

// ---------- quick-sell ----------

/** Claude (packs-1): every tier, lowest first, in the canonical order (pool.ts TIER_RANK). */
export const TIER_ORDER: Tier[] = (Object.keys(TIER_RANK) as Tier[]).sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);

/**
 * Coins for selling a card, before the sport's `qs` factor (football 0.35, soccer 0.7): bronze 15-30,
 * silver 40-80, gold 100-400, Standout 400-660, Hot Season 500+, Program 700+, Landmark 1,200+, Legend
 * 2,500+, Spotlight 4,000-5,050, GOAT 6,000+. Levels count. A higher tier (TIER_RANK) is worth more at
 * its lowest, middle and highest overall (packs-economy suite).
 */
export function quickSellValue(rc: RatedCard): number {
  return quickSell(rc.tier, rc.ovr, rc.line.sport);
}

/** Claude (packs-1): the quick-sell value of a card of this tier and displayed overall. */
export function quickSell(tier: Tier, o: number, sport: UtSport): number {
  const { silver, gold } = TIER_CUTS[sport];
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  // Claude rework: values follow the displayed UT scale's own ranges (ut-scale.ts)
  const scale = UT_SCALE[sport];
  const top = scale.curve[scale.curve.length - 1][1];
  let v: number;
  // Claude (packs-1, audit C1): one chain. A second `if` used to overwrite the GOAT and Spotlight values
  // with the bronze line, so a 104 Spotlight sold for 30 coins and SBC auto-fill spent it first.
  if (tier === 'goat') v = 6000 + 500 * Math.max(0, o - 106);
  else if (tier === 'spotlight') v = 4000 + 150 * Math.max(0, o - 100);
  else if (tier === 'legend') v = 2500 + 150 * Math.max(0, o - (scale.legend[0][1] + 1));
  // Claude content editions, on the same displayed scale: Landmark ~85–93, programs
  else if (tier === 'landmark') v = 1200 + 60 * Math.max(0, o - (scale.legend[0][1] - 3));
  else if (tier === 'program') v = 700 + 60 * Math.max(0, o - (scale.legend[0][1] - 4));
  else if (tier === 'promo') v = 500 + 40 * Math.max(0, o - (scale.promo[0][1] - 4));
  // Claude (packs-1): Standouts (80–93) on one absolute line, under every Hot Season. The old line
  // (400 + 40 per point from the Hot Season knot - 14) sold a 93 Standout above a 97 Hot Season, and in
  // soccer (knot 80) every Standout above every Hot Season.
  else if (tier === 'standout') v = 400 + 20 * Math.max(0, o - 80);
  else if (tier === 'gold') v = 100 + 300 * Math.pow(clamp01((o - gold) / (top - gold)), 1.5);
  else if (tier === 'silver') v = 40 + 40 * clamp01((o - silver) / (gold - silver - 1));
  else v = 15 + 15 * clamp01((o - (silver - 15)) / 14);
  v *= PACK_SHAPE[sport].qs;
  return Math.max(5, Math.round(v / 5) * 5);
}

/** Best last: the order a pack reveals in. */
export function revealOrder(cards: RatedCard[]): RatedCard[] {
  return cards.slice().sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.ovr - b.ovr);
}

/**
 * How big a walkout a pull gets: 0 none (bronze, silver), 1 a gold, 2 a star (Claude: an 86+ gold on
 * basketball's scale, or a Hot Season), 3 a legend.
 */
export function walkoutLevel(rc: RatedCard): 0 | 1 | 2 | 3 | 4 {
  if (rc.tier === 'goat') return 4;
  if (rc.tier === 'spotlight') return 3;
  if (rc.tier === 'legend' || rc.tier === 'landmark' || (rc.tier === 'program' && rc.line.programKind === 'finale')) return 3;
  if (rc.tier === 'promo' || rc.tier === 'standout' || rc.tier === 'program' || (rc.tier === 'gold' && rc.ovr >= UT_SCALE[rc.line.sport].walkout)) return 2;
  return rc.tier === 'gold' ? 1 : 0;
}

/** Server-approved chase card plus deterministic common slots; retries reconstruct the same pack. */
export function registeredPack(pool: Pool, kind: string, seed: string, chaseId: string | null): RatedCard[] {
  const chase = chaseId ? pool.base.get(chaseId) : null;
  if (chaseId && !chase) throw new Error('Update the game to load this card edition.');
  if (kind.startsWith('event-spotlight:')) {
    if (chase?.tier !== 'spotlight') throw new Error('Invalid event reward.');
    return [chase];
  }
  if (kind === 'admin-goat' && chase?.tier !== 'goat') throw new Error('Invalid GOAT award receipt.');
  if (kind !== 'spotlight' && kind !== 'admin-goat') throw new Error('Unknown registered pack.');
  // Claude (packs-2): the pre-curve draw, so every receipt (old or new) rebuilds the cards it was minted with
  const common = legacyFill(pool, SPOTLIGHT_COMMON[pool.sport], packRand(seed));
  const rand = packRand(seed + ':chase');
  let last = chase;
  for (let i = 0; !last && i < 20; i++) {
    const c = legacyGold(pool, rand);
    if (c && !common.some((x) => x.line.id === c.line.id)) last = c;
  }
  return last ? [...common, last] : common;
}
