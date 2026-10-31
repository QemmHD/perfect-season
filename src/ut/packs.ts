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
//   packs (900: 3 golds, ~2 of them new positions) and a position pack or two (700: 3 golds at the
//   spot still missing) fill the rest: ≈ 2,300-3,000 coins with what's sold back (a spare gold
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
//   4 days (basketball) and 8 (football); one who keeps his silvers and spare golds, 6 and 11.
//   The daily challenges' packs and coins bring both nearer a week.
//
// Legends: about 1 in 150 Premium packs (0.66% a pack), 1 in 500 Gold packs; Hot Season promos
// 6% of Premium packs, 2% of Gold packs.
import { SPOTLIGHT_RATES } from '../../supabase/functions/card-registry/contract';
import { hashString, rng, type Rand, trueRand } from '../engine/rng';
import { type Pool, TIER_RANK } from './pool';
import { onScale, TIER_CUTS } from './rate';
import { positionMix } from './squad';
import type { RatedCard, Tier, UtSport } from './types';

export type PackKind = 'bronze' | 'silver' | 'gold' | 'premium' | 'position' | 'spotlight' | 'starter';
/** Odds of each tier for one card of a pack (they add up to 1). */
export type Odds = Partial<Record<Tier, number>>;

export interface PackDef {
  kind: PackKind;
  name: string;
  /** coins; the starter is free */
  price: number;
  blurb: string;
  slots: Odds[];
}

const rep = (n: number, o: Odds): Odds[] => Array.from({ length: n }, () => o);
const B: Odds = { bronze: 1 };
const S: Odds = { silver: 1 };
const G: Odds = { gold: 1 };
export const GOAT_SPOTLIGHT = 0.0005;
export const SPOTLIGHT_ODDS: Odds = SPOTLIGHT_RATES;
export const LEGEND_PREMIUM = 0.0066;
export const PROMO_PREMIUM = 0.06;
export const LEGEND_GOLD = 0.002;
export const PROMO_GOLD = 0.02;

/** the slot that can turn into something special */
const goldPlus: Odds = { gold: 1 - PROMO_GOLD - LEGEND_GOLD, promo: PROMO_GOLD, legend: LEGEND_GOLD };
const premiumPlus: Odds = { gold: 1 - PROMO_PREMIUM - LEGEND_PREMIUM, promo: PROMO_PREMIUM, legend: LEGEND_PREMIUM };

/**
 * Each pack's shape per sport: its price, and its cards as [bronze, chance-of-silver] (Bronze),
 * [bronze, silver, chance-of-gold] (Silver), [silver, gold, gold-that-can-be-special] (Gold and
 * Premium), golds (Position). `qs` scales quick-sell values.
 */
export const PACK_SHAPE = {
  nba: { price: { bronze: 150, silver: 400, gold: 900, premium: 1800, position: 700 }, bronze: [4, 1], silver: [1, 3, 1], gold: [2, 2, 1], premium: [2, 5, 1], position: 3, qs: 1 },
  // football: 23 starters to fill, so two to three times the cards, each worth about a third as much sold
  nfl: {
    price: { bronze: 150, silver: 400, gold: 900, premium: 1800, position: 500 },
    bronze: [8, 2],
    silver: [2, 6, 2],
    gold: [2, 9, 1],
    premium: [2, 13, 1],
    position: 6,
    qs: 0.35,
  },
};

export function packDefs(sport: UtSport): Record<Exclude<PackKind, 'starter'>, PackDef> {
  const k = PACK_SHAPE[sport];
  const [bb, br] = k.bronze;
  const [sb, ss, sr] = k.silver;
  const [gs, gg, gr] = k.gold;
  const [ps, pg, pr] = k.premium;
  return {
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
      slots: [...rep(sb, B), ...rep(ss, S), ...rep(sr, { silver: 0.75, gold: 0.25 })],
    },
    gold: {
      kind: 'gold',
      name: 'Gold Pack',
      price: k.price.gold,
      blurb: gs + gg + gr + ' cards, ' + (gg + gr) + ' golds guaranteed',
      slots: [...rep(gs, S), ...rep(gg, G), ...rep(gr, goldPlus)],
    },
    premium: {
      kind: 'premium',
      name: 'Premium Gold',
      price: k.price.premium,
      blurb: ps + pg + pr + ' cards, ' + (pg + pr) + ' golds, 6% a Hot Season, 0.66% a Legend',
      slots: [...rep(ps, S), ...rep(pg, G), ...rep(pr, premiumPlus)],
    },
    spotlight: {
      kind: 'spotlight',
      name: 'Spotlight Pack',
      price: 3500,
      blurb: (sport === 'nba' ? 8 : 16) + ' gold-or-better cards. 20% Spotlight, 0.05% GOAT. Online.',
      slots: [...rep(sport === 'nba' ? 7 : 15, G), SPOTLIGHT_ODDS],
    },
    position: { kind: 'position', name: 'Position Pack', price: k.price.position, blurb: k.position + ' golds at the position you pick', slots: rep(k.position, G) },
  };
}

export const STORE_ORDER: Exclude<PackKind, 'starter'>[] = ['spotlight', 'bronze', 'silver', 'gold', 'premium', 'position'];

export function packName(sport: UtSport, kind: string): string {
  if (kind.startsWith('event-spotlight:')) return 'Spotlight Reward';
  if (kind === 'starter') return 'Starter Pack';
  if (kind.startsWith('position:')) return (positionChoices(sport).find((c) => c.key === kind.slice(9))?.label ?? kind.slice(9)) + ' Pack';
  return packDefs(sport)[kind as Exclude<PackKind, 'starter'>]?.name ?? 'Pack';
}

// ---------- drawing cards ----------

function drawTier(o: Odds, rand: Rand): Tier {
  let x = rand();
  let last: Tier = 'bronze';
  for (const t of ['goat', 'spotlight', 'legend', 'promo', 'gold', 'silver', 'bronze'] as Tier[]) {
    const p = o[t] ?? 0;
    if (p <= 0) continue;
    last = t;
    if (x < p) return t;
    x -= p;
  }
  return last;
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

/**
 * Within a tier the lower overalls are the common ones: each point above the tier's floor is 20%
 * rarer (football's scale is about half as wide at the top, so a point there counts 2.2 times).
 */
const RARER = 0.8;
const STEP: Record<UtSport, number> = { nba: 1.6, nfl: 2.2 };
const cum = new WeakMap<RatedCard[], number[]>();

function weighted(list: RatedCard[], tier: Tier, rand: Rand): RatedCard {
  let c = cum.get(list);
  if (!c) {
    let t = 0;
    const sport = list[0]?.line.sport ?? 'nba';
    const floor = tier === 'gold' ? TIER_CUTS[sport].gold : TIER_CUTS[sport].silver;
    c = list.map((rc) => (t += tier === 'silver' || tier === 'gold' ? Math.pow(RARER, Math.max(0, rc.ovr - floor) * STEP[sport]) : 1));
    cum.set(list, c);
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

const TIERS_DOWN: Tier[] = ['goat', 'spotlight', 'legend', 'promo', 'gold', 'silver', 'bronze'];

/** One card of a tier: at a position drawn in the squad's mix, or the given mix, or the one asked for. */
function drawCard(pool: Pool, tier: Tier, rand: Rand, want: string | null, mix?: [string, number][]): RatedCard | null {
  const bucket = pool.buckets[tier];
  let pos = want;
  if (tier === 'promo' || tier === 'legend' || tier === 'spotlight' || tier === 'goat') {
    // few enough that they come from the whole tier, whatever the position
    const all = Object.values(bucket).flat();
    if (all.length) return all[Math.floor(rand() * all.length)];
  } else {
    pos ??= drawPos(mix ?? Object.entries(positionMix(pool.sport)), rand);
    if (bucket[pos]?.length) return weighted(bucket[pos], tier, rand);
  }
  // nothing there: the next tier down at that position, then anyone in the tier
  const i = TIERS_DOWN.indexOf(tier);
  for (const t of TIERS_DOWN.slice(i + 1)) {
    const b = pool.buckets[t][pos ?? ''];
    if (pos && b?.length) return weighted(b, t, rand);
  }
  const any = Object.values(bucket).filter((l) => l.length);
  if (any.length) {
    const l = any[Math.floor(rand() * any.length)];
    return weighted(l, tier, rand);
  }
  return i + 1 < TIERS_DOWN.length ? drawCard(pool, TIERS_DOWN[i + 1], rand, want, mix) : null;
}

/** A pack's cards from its slots: no card twice in one pack. */
function fill(pool: Pool, slots: Odds[], rand: Rand, mix?: [string, number][]): RatedCard[] {
  const out: RatedCard[] = [];
  const ids = new Set<string>();
  for (const o of slots) {
    const tier = drawTier(o, rand);
    let c: RatedCard | null = null;
    for (let k = 0; k < 6; k++) {
      c = drawCard(pool, tier, rand, null, mix);
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
  if (sport === 'nba') return ['PG', 'SG', 'SF', 'PF', 'C'].map((p) => ({ key: p, label: p, positions: [p] }));
  return NFL_UNITS.map(([key, label, positions]) => ({ key, label, positions }));
}

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
export function openPack(pool: Pool, kind: string, seed?: string): RatedCard[] {
  const rand = seed === undefined ? trueRand() : packRand(seed);
  // The rare slot is rolled and numbered by the shared registry, never by this local RNG.
  if (kind === 'spotlight' || kind.startsWith('event-spotlight:')) throw new Error('This pack needs the shared card registry.');
  if (kind === 'starter') return starterCards(pool, rand);
  const defs = packDefs(pool.sport);
  if (kind.startsWith('position:')) {
    const ch = positionChoices(pool.sport).find((c) => c.key === kind.slice(9));
    if (!ch) return [];
    const need = positionMix(pool.sport);
    return fill(
      pool,
      defs.position.slots,
      rand,
      ch.positions.map((p) => [p, need[p] ?? 1])
    );
  }
  const def = defs[kind as Exclude<PackKind, 'starter'>];
  return def ? fill(pool, def.slots, rand) : [];
}

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
  spots.forEach((p, i) => take(i === 0 || rand() < (pool.sport === 'nba' && i < 5 ? 0.6 : 0.3) ? 'silver' : 'bronze', p));
  take('gold', null);
  return out;
}

// ---------- quick-sell ----------

/**
 * Coins for selling a card: bronze 15-30, silver 40-80, gold 100-400, promo 500+, legend 2,500+
 * (football half that, its packs holding twice the cards). Levels count.
 */
export function quickSellValue(rc: RatedCard): number {
  const o = rc.ovr;
  const sport = rc.line.sport;
  const { silver, gold } = TIER_CUTS[sport];
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  let v: number;
  if (rc.tier === 'goat') v = 5000 + 500 * Math.max(0, o - 106);
  else if (rc.tier === 'spotlight') v = 1400 + 100 * Math.max(0, o - 100);
  else if (rc.tier === 'legend') v = 2500 + 150 * Math.max(0, o - onScale(90, sport));
  else if (rc.tier === 'promo') v = 500 + 40 * Math.max(0, o - onScale(78, sport));
  else if (rc.tier === 'gold') v = 100 + 300 * Math.pow(clamp01((o - gold) / (99 - gold)), 1.5);
  else if (rc.tier === 'silver') v = 40 + 40 * clamp01((o - silver) / (gold - silver - 1));
  else v = 15 + 15 * clamp01((o - (silver - 15)) / 14);
  v *= PACK_SHAPE[sport].qs;
  return Math.max(5, Math.round(v / 5) * 5);
}

/** Best last: the order a pack reveals in. */
export function revealOrder(cards: RatedCard[]): RatedCard[] {
  return cards.slice().sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.ovr - b.ovr);
}

/**
 * How big a walkout a pull gets: 0 none (bronze, silver), 1 a gold, 2 a star (an 85+ gold on
 * basketball's scale, or a Hot Season), 3 a legend.
 */
export function walkoutLevel(rc: RatedCard): 0 | 1 | 2 | 3 | 4 {
  if (rc.tier === 'goat') return 4;
  if (rc.tier === 'spotlight') return 3;
  if (rc.tier === 'legend') return 3;
  if (rc.tier === 'promo' || (rc.tier === 'gold' && rc.ovr >= onScale(85, rc.line.sport))) return 2;
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
  if (kind !== 'spotlight') throw new Error('Unknown registered pack.');
  const common = fill(pool, rep(pool.sport === 'nba' ? 7 : 15, G), packRand(seed));
  const rand = packRand(seed + ':chase');
  let last = chase;
  for (let i = 0; !last && i < 20; i++) {
    const c = drawCard(pool, 'gold', rand, null);
    if (c && !common.some((x) => x.line.id === c.line.id)) last = c;
  }
  return last ? [...common, last] : common;
}
