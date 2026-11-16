// Claude (packs-4, 2026-11-16): the one source of every published number (packs-plan §5 packs-4,
// owner decision 4: "clear odds sheets"). Every chance here is computed from the definitions that fill
// real packs, picks and rewards, with the same steps as the draws (packs.ts goldDist / curveDist mirror
// drawGold / curvePick), never typed in by hand. The odds suite proves each sheet against 10,000 seeded
// openings, draws or rolls.
//
//   oddsFor(pool, kind, at)        a pack's sheet by its kind (Store kinds, position:<key>, live:<promo>,
//                                  live-plus:<promo>, Club Collection kinds and studio: recipes, the
//                                  Preview Pack, Spotlight): "chance of at least one" by overall band,
//                                  by tier, holo and the featured card, per slot, boost and notes
//   oddsTable(pool, def, ctx)      the same for any definition (slots) and context
//   pickTable(pool, kind, at)      a pick: Scout's Choice / Swap Desk, Front Office, Player Picks 82+ and
//                                  84+, Stamp Scout 85+, Standout, Program and calendar picks, and the
//                                  stamp shelf's items: "at least one of the options"
//   rewardOdds(pool, reward, at)   a random reward (an SBC card or pack, a Weekly Standout, a program
//                                  card): ut's objectives, MINUTES, league and Rookie Week rewards too
//   dropSheet(sport, index)        a Scout Drop: each tap's upgrade chance, the exact final odds, rewards
//   routeCost(sport, ovr)          a gold of this overall or better by its cheapest coin route (D10)
//   fmtPct(p), oneIn(p)            how a chance is written
//
// Pure (no React, no state). Computed on demand and memoised per (pool, kind, day, week, boost).
import { SPOTLIGHT_RATES } from '../../supabase/functions/card-registry/contract';
import { catalogOf, readPackSnapshot, snapshotPack, STUDIO_PACKS, STUDIO_TIERS, studioKind } from '../admin/catalog';
import { easternDateKey } from '../engine/season';
import { pickFor } from '../engine/sport';
import { per, promoById, wavesOf } from './calendar';
import { GOLD_PICKS, NFL_GROUPS, programPickSource } from './content-packs';
import { DROP_TIERS, dropEv, dropOdds, dropTable, type DropIndex, type DropReward, type DropTier } from './drop-tables';
import { fcToDisplay } from './fc-scale';
import { weekMonday } from './flash';
import { promoCards } from './live-cards';
import { livePackDef, packOfKind, promoOfPack } from './live-packs';
import {
  curveDist,
  curveOdds,
  FEATURED_STANDOUT,
  FLOORS,
  GOLD_CURVE,
  goldCardDist,
  goldDist,
  goldsOf,
  holoChanceOf,
  isFloorKind,
  legacyGoldDist,
  type Odds,
  type PackDef,
  packDefs,
  packName,
  positionChoices,
  SCOUT_STANDOUT,
  SILVER_CURVE,
  type SlotTier,
  tierBelow,
} from './packs';
import type { Pool } from './pool';
import { TIER_CUTS, TIER_NAMES } from './rate';
import { rewardText, type Reward, weekOf } from './sbc';
import type { ShelfItem } from './scout-stamps';
import { positionMix } from './squad';
import { standoutProgram } from './standouts';
import type { RatedCard, Tier, UtSport } from './types';
import { HOLO_CHANCE, HOLO_TIERS } from './variants';

/** The day these definitions were published (the sheet's "Updated"; a weekly or program row moves it later). */
export const ODDS_UPDATED = '2026-11-16';

/** The "at least one" overall bands, basketball's numbers (each sport's own via fcToDisplay). */
export const BANDS = [80, 82, 83, 84, 85, 86, 88] as const;
/** The bands computed: the shown ones and 90+ (the Pack Tracker's top bucket). */
const BAND_ALL: readonly number[] = [...BANDS, 90];
const I86 = BAND_ALL.indexOf(86);
const I90 = BAND_ALL.indexOf(90);

const BASE_TIERS: ReadonlySet<Tier> = new Set(['bronze', 'silver', 'gold']);
/** Tiers in the order a sheet lists them: the rarest first. */
const TIER_ROWS: Tier[] = ['goat', 'spotlight', 'legend', 'landmark', 'program', 'promo', 'standout', 'gold', 'silver', 'bronze'];

// ---------- how a chance is written ----------

/**
 * A chance as the sheets write it: under 0.1% reads "less than 0.1%", 99.5% and up "100%", one decimal
 * below 10% and whole numbers above. A chance of exactly 0 reads "0%".
 */
export function fmtPct(p: number): string {
  if (!(p > 0)) return '0%';
  if (p < 0.001) return 'less than 0.1%';
  if (p >= 0.995) return '100%';
  const x = Math.round(p * 1000) / 10;
  return x < 10 ? x.toFixed(1) + '%' : Math.round(p * 100) + '%';
}

/** "1 in 2,000" for a chance under 1% (null above, where the percentage says enough). */
export function oneIn(p: number): string | null {
  if (!(p > 0) || p >= 0.01) return null;
  const n = 1 / p;
  const r = n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
  return '1 in ' + r.toLocaleString('en-US');
}

// ---------- one card's distribution ----------

/** One card slot's outcome: chance of each band (overall or better), of each tier, holo and featured. */
interface Dist {
  ge: number[];
  tier: Partial<Record<Tier, number>>;
  holo: number;
  featured: number;
  /** the chance the slot gives a card at all (≤ 1) */
  mass: number;
}

const empty = (): Dist => ({ ge: BAND_ALL.map(() => 0), tier: {}, holo: 0, featured: 0, mass: 0 });

const thresholds = (sport: UtSport) => BAND_ALL.map((b) => fcToDisplay(b, sport));

/** A distribution over displayed overalls, all of one tier. */
function fromOvr(m: Map<number, number>, tier: Tier, sport: UtSport): Dist {
  const d = empty();
  const th = thresholds(sport);
  for (const [o, p] of m) {
    d.mass += p;
    th.forEach((t, i) => o >= t && (d.ge[i] += p));
  }
  d.tier[tier] = d.mass;
  return d;
}

/** Each card of `list` equally likely. `featured` marks the cards the featured row counts. */
function fromList(list: readonly RatedCard[], featured?: ReadonlySet<string>): Dist {
  const d = empty();
  if (!list.length) return d;
  const th = thresholds(list[0].line.sport);
  // counted, then divided once: a whole tier reads exactly 1
  for (const rc of list) {
    th.forEach((t, i) => rc.ovr >= t && d.ge[i]++);
    d.tier[rc.tier] = (d.tier[rc.tier] ?? 0) + 1;
    if (featured?.has(rc.line.id)) d.featured++;
  }
  const n = list.length;
  d.mass = 1;
  d.ge = d.ge.map((x) => x / n);
  for (const t of Object.keys(d.tier) as Tier[]) d.tier[t] = d.tier[t]! / n;
  d.featured /= n;
  return d;
}

/** A weighted mixture of distributions (weights need not sum to 1: the rest gives no card). */
function mixDist(parts: [Dist, number][]): Dist {
  const d = empty();
  for (const [x, w] of parts) {
    if (!w) continue;
    d.mass += w * x.mass;
    d.holo += w * x.holo;
    d.featured += w * x.featured;
    x.ge.forEach((g, i) => (d.ge[i] += w * g));
    for (const [t, p] of Object.entries(x.tier) as [Tier, number][]) d.tier[t] = (d.tier[t] ?? 0) + w * p;
  }
  return d;
}

/** What a slot's draw depends on besides the slot. */
export interface OddsCtx {
  /** the Weekly Standout week its Standout slots draw from */
  week: string;
  /** the Eastern day (a program slot's released cards) */
  day: string;
  /** a Position/Unit pack's positions and weights */
  mix?: [string, number][];
  /** a program slot's cards: each list with its share of the slot (a promo and its extras) */
  program?: [RatedCard[], number][];
  /** a registered pack (Spotlight): its golds are the registry receipt's pre-curve draw, never holo */
  registered?: true;
  /** the card ids the featured row counts */
  featured?: ReadonlySet<string>;
}

/** A Weekly Standout as packs draw it: the featured card FEATURED_STANDOUT, otherwise the others equally. */
function standoutDist(pool: Pool, week: string, ctx: OddsCtx): Dist | null {
  const cards = standoutProgram(pool, week).cards;
  if (!cards.length) return null;
  if (cards.length === 1) return fromList(cards, ctx.featured);
  return mixDist([
    [fromList(cards.slice(0, 1), ctx.featured), FEATURED_STANDOUT],
    [fromList(cards.slice(1), ctx.featured), 1 - FEATURED_STANDOUT],
  ]);
}

/** A tier drawn by position (drawCard): a position of the mix, then its bucket (golds and silvers on their curves). */
function byPosition(pool: Pool, tier: Tier, mix: [string, number][]): Dist {
  const tot = mix.reduce((a, [, w]) => a + w, 0);
  const sport = pool.sport;
  const parts: [Dist, number][] = [];
  for (const [pos, w] of mix) {
    // nothing at this position: the tiers below it there, as drawCard falls back
    let t: Tier | null = tier;
    while (t && !pool.buckets[t][pos]?.length) t = tierBelow(t);
    if (!t) continue;
    const list = pool.buckets[t][pos];
    const d =
      t === 'gold'
        ? fromOvr(curveDist(list, GOLD_CURVE, TIER_CUTS[sport].gold), 'gold', sport)
        : t === 'silver'
          ? fromOvr(curveDist(list, SILVER_CURVE, TIER_CUTS[sport].silver), 'silver', sport)
          : fromList(list);
    parts.push([d, w / tot]);
  }
  return mixDist(parts);
}

/** A gold slot's cards as flat arrays: each card's index among the pool's golds, its chance, its band level. */
interface CardVec {
  idx: Int32Array;
  p: Float64Array;
  /** how many of BAND_ALL's thresholds the card meets */
  lvl: Uint8Array;
}
const goldIndex = new WeakMap<Pool, Map<RatedCard, number>>();
const vecCache = new WeakMap<Map<RatedCard, number>, CardVec>();
function vecOf(pool: Pool, m: Map<RatedCard, number>): CardVec {
  let v = vecCache.get(m);
  if (v) return v;
  let gi = goldIndex.get(pool);
  if (!gi) goldIndex.set(pool, (gi = new Map(goldsOf(pool).map((rc, i) => [rc, i]))));
  const th = thresholds(pool.sport);
  const idx = new Int32Array(m.size);
  const p = new Float64Array(m.size);
  const lvl = new Uint8Array(m.size);
  let i = 0;
  for (const [rc, x] of m) {
    idx[i] = gi.get(rc) ?? -1;
    p[i] = x;
    let k = 0;
    while (k < th.length && rc.ovr >= th[k]) k++;
    lvl[i++] = k;
  }
  vecCache.set(m, (v = { idx, p, lvl }));
  return v;
}

/**
 * The cards already likely in the pack (by earlier slots), by gold index: fill never puts a card in a pack
 * twice, it draws again (up to 6 times). A gold slot's card chances given what came before: each card's
 * chance × the chance it isn't taken yet, renormalised by the redraws (first order: each redraw is a fresh
 * draw). On a thin unit (a soccer Goalkeepers pack) this moves a band by a few tenths of a point; in a full
 * pool it changes nothing visible.
 */
type Taken = Float64Array;
const newTaken = (pool: Pool): Taken => new Float64Array(goldsOf(pool).length);
function goldSlotDist(pool: Pool, floor: number, mix: [string, number][] | undefined, taken: Taken | undefined, share: number): Dist {
  const v = vecOf(pool, goldCardDist(pool, floor, mix));
  const n = v.p.length;
  let r = 0;
  if (taken) for (let i = 0; i < n; i++) if (v.idx[i] >= 0) r += v.p[i] * taken[v.idx[i]];
  const lv = new Float64Array(BAND_ALL.length + 1);
  let mass = 0;
  for (let i = 0; i < n; i++) {
    const t = taken && v.idx[i] >= 0 ? taken[v.idx[i]] : 0;
    const q = r > 0 ? (v.p[i] * (1 - t)) / (1 - r) : v.p[i];
    lv[v.lvl[i]] += q;
    mass += q;
    if (taken && v.idx[i] >= 0) taken[v.idx[i]] = Math.min(1, t + share * q);
  }
  const d = empty();
  d.mass = mass;
  let acc = 0;
  for (let k = BAND_ALL.length; k >= 1; k--) {
    acc += lv[k];
    d.ge[k - 1] = acc;
  }
  d.tier.gold = mass;
  return d;
}

const tierCache = new WeakMap<Pool, Map<string, Dist>>();

/** One card of slot tier `t` (fill's `draw`); `taken` (a pack's earlier golds) counts the no-repeat redraws. */
function tierDist(pool: Pool, t: SlotTier, ctx: OddsCtx, taken?: Taken, share = 1): Dist {
  const k0 = t === 'gold' ? 'g75' : t === 'rare' ? 'g78' : t;
  if (isFloorKind(k0) && !(ctx.registered && k0 === 'g75')) return goldSlotDist(pool, FLOORS[k0], ctx.mix, taken, share);
  // what doesn't depend on the week, the program or the featured card is the same in every pack: cached
  if (k0 === 'standout' || k0 === 'program') return tierDistNow(pool, t, ctx);
  let m = tierCache.get(pool);
  if (!m) tierCache.set(pool, (m = new Map()));
  const key = t + '|' + (ctx.registered ? 'r' : '') + '|' + (ctx.mix ? ctx.mix.map(([p, w]) => p + ':' + w).join(',') : '*');
  let d = m.get(key);
  if (!d) m.set(key, (d = tierDistNow(pool, t, ctx)));
  return d;
}

function tierDistNow(pool: Pool, t: SlotTier, ctx: OddsCtx): Dist {
  const sport = pool.sport;
  const mix = ctx.mix ?? Object.entries(positionMix(sport));
  if (ctx.registered && (t === 'gold' || t === 'g75')) return fromOvr(legacyGoldDist(pool), 'gold', sport);
  const k = t === 'gold' ? 'g75' : t === 'rare' ? 'g78' : t;
  if (isFloorKind(k)) return fromOvr(goldDist(pool, FLOORS[k], ctx.mix), 'gold', sport);
  if (k === 'standout') return standoutDist(pool, ctx.week, ctx) ?? fromOvr(goldDist(pool, FLOORS.g78, ctx.mix), 'gold', sport);
  if (k === 'program') {
    const lists = (ctx.program ?? []).filter(([l]) => l.length);
    const tot = lists.reduce((a, [, w]) => a + w, 0);
    return tot ? mixDist(lists.map(([l, w]) => [fromList(l, ctx.featured), w / tot])) : tierDist(pool, 'standout', ctx);
  }
  if (k === 'silver' || k === 'bronze') return byPosition(pool, k, mix);
  // the few special tiers come from the whole tier, whatever the position; an empty one falls a tier
  const all = Object.values(pool.buckets[k as Tier]).flat();
  if (all.length) return fromList(all, ctx.featured);
  const below = tierBelow(k as Tier);
  return below === 'gold' ? byPosition(pool, 'gold', mix) : below ? tierDist(pool, below, ctx) : empty();
}

/** One slot: its tiers' cards in their shares, and the holo chance of a special from a slot that rolls for it. */
function slotDist(pool: Pool, o: Odds, ctx: OddsCtx, taken?: Taken): Dist {
  const parts: [Dist, number][] = [];
  let holo = 0;
  for (const [t, p] of Object.entries(o) as [SlotTier, number][]) {
    if (!p) continue;
    const d = tierDist(pool, t, ctx, taken, p);
    parts.push([d, p]);
    if (!ctx.registered) {
      const h = holoChanceOf(o, t);
      if (h) for (const [tier, q] of Object.entries(d.tier) as [Tier, number][]) if (HOLO_TIERS.has(tier)) holo += p * q * h;
    }
  }
  const d = mixDist(parts);
  d.holo = holo;
  return d;
}

// ---------- a whole pack ----------

export interface OddsRow {
  key: string;
  label: string;
  p: number;
}

export interface OddsTable {
  /** a pack (cards), a pick (options) or a reward */
  kind: 'pack' | 'pick' | 'reward';
  title: string;
  /** cards in the pack, options in a pick */
  cards: number;
  slotsText: string;
  /** "at least one" by overall: BANDS on the sport's scale */
  bands: OddsRow[];
  /** "at least one" by tier (special tiers always; bronze/silver/gold when not certain) */
  tiers: OddsRow[];
  /** "at least one" holographic special */
  holo: number;
  /** the featured card (this week's Featured Standout, or the program's headliner) and the ids it counts */
  featured: { name: string; p: number; ids: string[] } | null;
  /** what each slot (or each option) can be, identical slots together */
  perSlot: { n: number; label: string; chips: OddsRow[] }[];
  /** a program pack inside its Friday boost: the boosted and normal program chance, and until when */
  boosted: { until: number; now: number; base: number } | null;
  /** the effective program rate with pity (packs-6 fills it) */
  effectiveProgram: number | null;
  notes: string[];
  /** the date these numbers last changed (YYYY-MM-DD) */
  updated: string;
  /** what the Pack Tracker compares: at least one 86+ and 90+ (the sport's scale), any special edition */
  r86: number;
  r90: number;
  special: number;
}

const SLOT_ORDER: SlotTier[] = ['goat', 'spotlight', 'legend', 'landmark', 'program', 'promo', 'standout', 'g88', 'g86', 'g84', 'g82', 'g80', 'g78', 'rare', 'g75', 'gold', 'silver', 'bronze'];
/** A slot tier's name ("Gold 78+"; any gold is just "Gold"). */
export function slotName(t: SlotTier, sport: UtSport): string {
  if (t === 'rare' || t === 'g78') return 'Gold ' + fcToDisplay(78, sport) + '+';
  if (t === 'g75' || t === 'gold') return 'Gold';
  if (isFloorKind(t)) return 'Gold ' + fcToDisplay(FLOORS[t], sport) + '+';
  return TIER_NAMES[t];
}

/**
 * 1 − Π(1 − p) × Π(none): the chance of at least one hit from independent slots (and from groups whose
 * chance of no hit is given). With a single slot that can hit and no group, that slot's own chance exactly
 * (so a one-slot rate such as the Spotlight's 20% reads exactly as published).
 */
function atLeastOne(ps: number[], none: number[] = []): number {
  const hit = ps.map((p) => Math.min(1, Math.max(0, p))).filter((p) => p > 0);
  if (hit.length === 1 && none.every((x) => x === 1)) return hit[0];
  return 1 - hit.reduce((a, p) => a * (1 - p), 1) * none.reduce((a, x) => a * x, 1);
}

/** A group of slots drawn together (no repeats): its chance of no hit, row by row. */
interface NoneFactor {
  bands: number[];
  tier: Partial<Record<Tier, number>>;
  featured: number;
  special: number;
}

/**
 * k guaranteed Weekly Standout slots in one pack (a Club Collection pack): fill never repeats a player in a
 * pack (it redraws up to 6 times, then keeps the 6th draw), so these slots are drawn without replacement,
 * not independently. Exact over every set of Standouts drawn (k ≤ 5 of at most 15).
 */
function standoutGroup(cards: readonly RatedCard[], k: number, featured: ReadonlySet<string> | undefined, sport: UtSport): NoneFactor {
  const n = cards.length;
  const p = cards.map((_, i) => (n === 1 ? 1 : i === 0 ? FEATURED_STANDOUT : (1 - FEATURED_STANDOUT) / (n - 1)));
  let states = new Map<number, number>([[0, 1]]);
  for (let step = 0; step < k; step++) {
    const next = new Map<number, number>();
    for (const [mask, q] of states) {
      let r = 0;
      for (let j = 0; j < n; j++) if (mask & (1 << j)) r += p[j];
      // the 6th draw is kept even when it repeats: the set stays as it is
      if (r > 0) next.set(mask, (next.get(mask) ?? 0) + q * Math.pow(r, 6));
      const keep = r < 1 ? (1 - Math.pow(r, 6)) / (1 - r) : 0;
      for (let i = 0; i < n; i++) if (!(mask & (1 << i))) next.set(mask | (1 << i), (next.get(mask | (1 << i)) ?? 0) + q * p[i] * keep);
    }
    states = next;
  }
  const th = thresholds(sport);
  const out: NoneFactor = { bands: th.map(() => 0), tier: {}, featured: 0, special: 0 };
  const tiers = [...new Set(cards.map((c) => c.tier))];
  for (const [mask, q] of states) {
    const got = cards.filter((_, i) => mask & (1 << i));
    th.forEach((t, i) => !got.some((c) => c.ovr >= t) && (out.bands[i] += q));
    for (const t of tiers) if (!got.some((c) => c.tier === t)) out.tier[t] = (out.tier[t] ?? 0) + q;
    if (!got.some((c) => featured?.has(c.line.id))) out.featured += q;
  }
  for (const t of tiers) out.tier[t] ??= 0;
  return out;
}

/** "at least one" rows from per-card distributions (independent slots) and groups drawn together. */
function rowsOf(dists: Dist[], sport: UtSport, groups: NoneFactor[] = []) {
  const bands = BAND_ALL.map((_, i) =>
    atLeastOne(
      dists.map((d) => d.ge[i]),
      groups.map((g) => g.bands[i]),
    ),
  );
  const tiers = new Map<Tier, number>();
  for (const t of TIER_ROWS)
    tiers.set(
      t,
      atLeastOne(
        dists.map((d) => d.tier[t] ?? 0),
        groups.map((g) => g.tier[t] ?? 1),
      ),
    );
  return {
    bands,
    tiers,
    holo: atLeastOne(dists.map((d) => d.holo)),
    featured: atLeastOne(
      dists.map((d) => d.featured),
      groups.map((g) => g.featured),
    ),
    special: atLeastOne(
      dists.map((d) => Object.entries(d.tier).reduce((a, [t, p]) => a + (BASE_TIERS.has(t as Tier) ? 0 : p), 0)),
      groups.map((g) => g.special),
    ),
    sport,
  };
}

type Rows = ReturnType<typeof rowsOf>;

/** The visible rows: every band with a chance, special tiers with a chance, base tiers when uncertain. */
function visible(r: Rows): { bands: OddsRow[]; tiers: OddsRow[] } {
  const bands = BANDS.map((b, i) => ({ key: 'b' + b, label: fcToDisplay(b, r.sport) + '+ overall', p: r.bands[i] })).filter((x) => x.p > 0);
  const tiers = TIER_ROWS.map((t) => ({ key: 't-' + t, label: TIER_NAMES[t], p: r.tiers.get(t) ?? 0 })).filter((x) => x.p > 0 && (!BASE_TIERS.has(x.key.slice(2) as Tier) || x.p < 0.995));
  return { bands, tiers };
}

/** Identical slots together, each with its tier chips. */
function perSlotOf(slots: readonly Odds[], sport: UtSport, label = 'card'): OddsTable['perSlot'] {
  const rows = new Map<string, { o: Odds; n: number }>();
  for (const o of slots) {
    const k = JSON.stringify(o);
    const r = rows.get(k);
    if (r) r.n++;
    else rows.set(k, { o, n: 1 });
  }
  return [...rows.values()].map(({ o, n }) => ({
    n,
    label: n + ' ' + label + (n === 1 ? '' : 's'),
    chips: SLOT_ORDER.filter((t) => (o[t] ?? 0) > 0).map((t) => ({ key: t, label: slotName(t, sport), p: o[t]! })),
  }));
}

const has = (slots: readonly Odds[], t: SlotTier) => slots.some((o) => (o[t] ?? 0) > 0);
const goldSlot = (o: Odds) => Object.keys(o).some((t) => isFloorKind(t) || t === 'gold' || t === 'rare');

/** The share of an any-gold slot in [a, b) overall, basketball's numbers (the curve's own split). */
function goldBand(a: number, b: number): number {
  let p = 0;
  for (const [o, x] of curveOdds(GOLD_CURVE, 75, 'nba')) if (o >= a && o < b) p += x;
  return p;
}

const later = (a: string, b: string) => (b > a ? b : a);

/** A pack's definition, as the sheet reads it. */
export type SheetDef = Pick<PackDef, 'name' | 'slots' | 'blurb'> & { kind: string; prefer?: true; price?: number };

/**
 * The odds sheet of a definition. `extra` adds what the context knows: the boost, the featured card's name,
 * the day the numbers changed and any notes of its own.
 */
export function oddsTable(pool: Pool, def: SheetDef, ctx: OddsCtx, extra: { boosted?: OddsTable['boosted']; featuredName?: string; updated?: string; notes?: string[] } = {}): OddsTable {
  const sport = pool.sport;
  // two or more guaranteed Standouts are drawn together, never the same player twice
  const sure = def.slots.filter((o) => o.standout === 1).length;
  const week = standoutProgram(pool, ctx.week).cards;
  const together = sure >= 2 && week.length >= 2 && !ctx.registered;
  const taken = newTaken(pool);
  const dists = def.slots.filter((o) => !together || o.standout !== 1).map((o) => slotDist(pool, o, ctx, taken));
  const r = rowsOf(dists, sport, together ? [standoutGroup(week, sure, ctx.featured, sport)] : []);
  const { bands, tiers } = visible(r);
  const notes: string[] = [...(extra.notes ?? [])];
  const standout = has(def.slots, 'standout');
  const program = has(def.slots, 'program');
  if (extra.boosted)
    notes.push(
      'BOOSTED: the program slot is ' + fmtPct(extra.boosted.now) + ' a program card (normally ' + fmtPct(extra.boosted.base) + ') until the boost ends. Every chance on this sheet already counts it.',
    );
  if (ctx.registered) {
    const R = SPOTLIGHT_RATES;
    notes.push(
      'The shared card registry rolls the last card: Spotlight ' +
        fmtPct(R.spotlight) +
        ', GOAT ' +
        (R.goat * 100).toString() +
        '% (' +
        oneIn(R.goat) +
        '), Legend ' +
        fmtPct(R.legend) +
        ', Hot Season ' +
        fmtPct(R.promo) +
        ', otherwise a gold. These contract odds never change and reset every pack: no GOAT is ever guaranteed.',
      'Its golds use the registered draw, so every receipt rebuilds exactly the cards it was minted with.',
    );
  } else if (def.slots.some(goldSlot))
    notes.push(
      'Every gold follows one overall curve. A slot that can be any gold lands ' +
        fcToDisplay(75, sport) +
        '–' +
        fcToDisplay(79, sport) +
        ' ' +
        fmtPct(goldBand(75, 80)) +
        ', ' +
        fcToDisplay(80, sport) +
        '–' +
        fcToDisplay(82, sport) +
        ' ' +
        fmtPct(goldBand(80, 83)) +
        ', ' +
        fcToDisplay(83, sport) +
        '–' +
        fcToDisplay(85, sport) +
        ' ' +
        fmtPct(goldBand(83, 86)) +
        ' and ' +
        fcToDisplay(86, sport) +
        '+ ' +
        fmtPct(goldBand(86, 100)) +
        '; a “Gold 78+” slot uses the same curve from 78 up.',
    );
  if (def.slots.some(goldSlot) || ctx.registered) notes.push('Rare means the shimmer only: the top 35% of golds at each position shimmer. It is never a slot and never a better chance.');
  if (standout)
    notes.push(
      'A Standout is one of this week’s Weekly Standouts: the Featured Standout ' +
        fmtPct(FEATURED_STANDOUT) +
        ' of the time, otherwise any of the others equally. Never a Standout you already own until you own them all.',
    );
  if (program) notes.push('A program card is one of the program’s cards released so far, all equally likely. Never one you already own while any released card is unowned.');
  if (def.prefer) notes.push('Gold slots skip players you own at the overall drawn when another card exists there, and otherwise go higher, never lower, so these odds are the least you get.');
  if (r.holo > 0) notes.push('A special edition from a slot that rolls for it is holographic ' + fmtPct(HOLO_CHANCE) + ' of the time. A guaranteed special never is.');
  let updated = later(ODDS_UPDATED, extra.updated ?? '');
  if (standout || program) updated = later(updated, weekMonday(ctx.week));
  const featuredName = extra.featuredName ?? (standout && !program ? standoutProgram(pool, ctx.week).featured?.line.name : undefined);
  return {
    kind: 'pack',
    title: def.name,
    cards: def.slots.length,
    slotsText: def.blurb.replace(/\.+$/, '') + '.',
    bands,
    tiers,
    holo: r.holo,
    featured: featuredName && r.featured > 0 ? { name: featuredName, p: r.featured, ids: [...(ctx.featured ?? [])] } : null,
    perSlot: perSlotOf(def.slots, sport),
    boosted: extra.boosted ?? null,
    effectiveProgram: null,
    notes,
    updated,
    r86: r.bands[I86],
    r90: r.bands[I90],
    special: r.special,
  };
}

// ---------- a pack by its kind ----------

/** A Club Collection recipe's tier as a slot (packs.ts studioSlot). */
const studioSlot = (t: string): Odds => (t === 'gold' ? { g75: 1 } : t === 'rare' ? { g78: 1 } : { [t]: 1 });

const memo = new WeakMap<Pool, Map<string, OddsTable | null>>();
function memoised(pool: Pool, key: string, make: () => OddsTable | null): OddsTable | null {
  let m = memo.get(pool);
  if (!m) memo.set(pool, (m = new Map()));
  if (m.has(key)) return m.get(key)!;
  const t = make();
  m.set(key, t);
  if (m.size > 400) m.delete(m.keys().next().value!);
  return t;
}

/** The Eastern day and week of an instant. */
export function dayWeek(at: number): { day: string; week: string } {
  const day = easternDateKey(new Date(at));
  return { day, week: weekOf(day) };
}

/** A program pack's table: its slots, its program lists (the promo and its extras), the boost and the headliner. */
function liveTable(pool: Pool, kind: string, at: number, day: string, week: string): OddsTable | null {
  const p = packOfKind(kind);
  if (!p) return null;
  const def = livePackDef(pool.sport, p, at);
  const promo = promoOfPack(kind);
  const own = promoCards(pool, promo, day);
  const program: [RatedCard[], number][] = [[own, def.odds], ...def.extra.map(([id, o]): [RatedCard[], number] => [promoCards(pool, id, day), o])];
  const heads = own.filter((rc) => rc.line.featured);
  const featured = new Set(heads.map((rc) => rc.line.id));
  const info = promoById(promo);
  const name = per(info?.name, pool.sport) ?? 'program';
  const featuredName = heads.length === 1 ? heads[0].line.name : heads.length ? heads.length + ' featured ' + name + ' cards' : undefined;
  // the day the released cards last changed: the latest wave on or before today
  const waves = info ? wavesOf(info, pool.sport).map((w) => w.d) : [];
  const released = [info?.start ?? '', ...waves]
    .filter((d) => d && d <= day)
    .sort()
    .pop();
  let boosted: OddsTable['boosted'] = null;
  if (def.boost) {
    const base = livePackDef(pool.sport, p);
    boosted = { until: def.boost.until, now: def.slots[def.slots.length - 1].program ?? 0, base: base.slots[base.slots.length - 1].program ?? 0 };
  }
  return oddsTable(pool, { ...def, kind }, { week, day, program, featured }, { boosted, featuredName, updated: released });
}

/**
 * The odds sheet of a pack by its kind, at `at` (default now): a Store kind, `position` (a random
 * position's pack, with how far the positions differ) or `position:<key>`, `live:` / `live-plus:` program
 * packs (boosted inside a Friday boost), Club Collection kinds and `studio:` recipes, `preview` (the
 * Premium Gold it shows) and `spotlight`. Null for a pick or a kind with no random draw (the starter,
 * admin awards, an event Spotlight reward).
 */
export function oddsFor(pool: Pool, kind: string, at = Date.now()): OddsTable | null {
  const { day, week } = dayWeek(at);
  const sport = pool.sport;
  if (kind.startsWith('live:') || kind.startsWith('live-plus:')) {
    const p = packOfKind(kind);
    const boost = p ? livePackDef(sport, p, at).boost : null;
    return memoised(pool, kind + '|' + day + '|' + week + '|' + (boost ? boost.until : ''), () => liveTable(pool, kind, at, day, week));
  }
  const defs = packDefs(sport) as Record<string, PackDef>;
  const studio = STUDIO_PACKS.includes(kind as (typeof STUDIO_PACKS)[number]) ? catalogOf(sport)[kind as (typeof STUDIO_PACKS)[number]] : null;
  const key = kind + '|' + week + (studio ? '|' + studio.price + ':' + JSON.stringify(studio.counts) : '');
  return memoised(pool, key, () => {
    const ctx: OddsCtx = { week, day };
    const standoutHead = new Set([standoutProgram(pool, week).featured?.line.id].filter(Boolean) as string[]);
    if (kind === 'spotlight') {
      if (sport === 'soccer') return null;
      const d = defs.spotlight;
      return oddsTable(pool, { ...d, kind }, { ...ctx, registered: true });
    }
    if (kind === 'preview') {
      const t = oddsTable(
        pool,
        { ...defs.premium, kind },
        { ...ctx, featured: standoutHead },
        { notes: ['A Preview Pack is a Premium Gold you see inside before you buy. These are the odds its cards were drawn with.'] },
      );
      return { ...t, title: 'Preview Pack' };
    }
    if (kind.startsWith('position:')) {
      const ch = positionChoices(sport).find((c) => c.key === kind.slice(9));
      if (!ch) return null;
      const need = positionMix(sport);
      const t = oddsTable(pool, { ...defs.position, kind }, { ...ctx, mix: ch.positions.map((p) => [p, need[p] ?? 1]) });
      return { ...t, title: pickFor(sport, { nba: ch.label + ' Pack', nfl: ch.label + ' Unit Pack', soccer: ch.label + ' Pack' }) };
    }
    if (kind === 'position') {
      // a random choice's pack: the mean of every choice's chances (a mixture), and how far they spread
      const tables = positionChoices(sport).map((c) => oddsFor(pool, 'position:' + c.key, at)!);
      const mean = (f: (t: OddsTable) => number) => tables.reduce((a, t) => a + f(t), 0) / tables.length;
      const first = tables[0];
      const spread = Math.max(
        0,
        ...first.bands.map((b) => Math.max(...tables.map((t) => t.bands.find((x) => x.key === b.key)?.p ?? 0)) - Math.min(...tables.map((t) => t.bands.find((x) => x.key === b.key)?.p ?? 0))),
      );
      const unit = pickFor(sport, { nba: 'position', nfl: 'unit', soccer: 'line' });
      return {
        ...first,
        title: pickFor(sport, { nba: defs.position.name, nfl: 'Unit Pack', soccer: defs.position.name }),
        bands: first.bands.map((b) => ({ ...b, p: mean((t) => t.bands.find((x) => x.key === b.key)?.p ?? 0) })),
        tiers: first.tiers.map((b) => ({ ...b, p: mean((t) => t.tiers.find((x) => x.key === b.key)?.p ?? 0) })),
        r86: mean((t) => t.r86),
        r90: mean((t) => t.r90),
        special: mean((t) => t.special),
        notes: ['Shown for a ' + unit + ' picked at random. Each ' + unit + '’s own chances differ from these by at most ' + (Math.round(spread * 1000) / 10).toFixed(1) + ' points.', ...first.notes],
      };
    }
    let def: SheetDef | null = defs[kind] && kind !== 'scout' ? { ...defs[kind], kind } : null;
    if (!def && kind.startsWith('studio:')) {
      const snap = readPackSnapshot(studioKind(kind) ? snapshotPack(sport, kind) : kind);
      if (snap)
        def = {
          kind,
          name: snap.pack.name,
          blurb:
            STUDIO_TIERS.filter((t) => snap.pack.counts[t])
              .map((t) => snap.pack.counts[t] + ' ' + (t === 'rare' ? 'gold 78+' : t))
              .join(' · ') + ' guaranteed',
          slots: STUDIO_TIERS.flatMap((t) => Array.from({ length: snap.pack.counts[t] ?? 0 }, () => studioSlot(t))),
        };
    }
    if (!def) return null;
    return oddsTable(pool, def, { ...ctx, featured: standoutHead });
  });
}

// ---------- picks: n options, keep one ----------

/** 1 − C(N − m, k) / C(N, k): the chance k distinct draws from N include at least one of m. */
export function hyperAtLeast(N: number, m: number, k: number): number {
  if (m <= 0 || N <= 0) return 0;
  const kk = Math.min(k, N);
  let none = 1;
  for (let i = 0; i < kk; i++) none *= Math.max(0, N - m - i) / (N - i);
  return 1 - none;
}

/** k different cards of `list`, all equally likely (Standout, Program, program and calendar picks). */
function uniformPick(
  pool: Pool,
  title: string,
  list: readonly RatedCard[],
  k: number,
  chip: string,
  notes: string[],
  featured?: { ids: ReadonlySet<string>; name: string },
  updated?: string,
): OddsTable {
  const sport = pool.sport;
  const n = list.length;
  const kk = Math.min(k, n);
  const bands = BAND_ALL.map((_, i) => hyperAtLeast(n, list.filter((rc) => rc.ovr >= thresholds(sport)[i]).length, kk));
  const tiers = new Map<Tier, number>(TIER_ROWS.map((t) => [t, hyperAtLeast(n, list.filter((rc) => rc.tier === t).length, kk)]));
  const fm = featured ? list.filter((rc) => featured.ids.has(rc.line.id)).length : 0;
  const r: Rows = { bands, tiers, holo: 0, featured: hyperAtLeast(n, fm, kk), special: hyperAtLeast(n, list.filter((rc) => !BASE_TIERS.has(rc.tier)).length, kk), sport };
  const v = visible(r);
  return {
    kind: 'pick',
    title,
    cards: kk,
    slotsText: (kk === 1 ? 'One option' : kk + ' different options') + ' face down from ' + n + ' ' + chip + (n === 1 ? '' : 's') + ', all equally likely. Keep one.',
    ...v,
    holo: 0,
    featured: featured && fm ? { name: featured.name, p: r.featured, ids: [...featured.ids] } : null,
    perSlot: [{ n: kk, label: 'Each option', chips: [{ key: 'u', label: 'Any of ' + n + ', ' + fmtPct(1 / Math.max(1, n)) + ' each', p: 1 / Math.max(1, n) }] }],
    boosted: null,
    effectiveProgram: null,
    notes: [...notes, 'You keep exactly one option. The others never join your club. Picks earn no holo.'],
    updated: later(ODDS_UPDATED, updated ?? ''),
    r86: bands[I86],
    r90: bands[I90],
    special: r.special,
  };
}

/** Options each drawn independently from per-option distributions (gold and Scout's Choice picks), as a mixture of cases. */
function optionPick(pool: Pool, title: string, n: number, cases: [Dist[], number][], perOption: OddsRow[], slotsText: string, notes: string[]): OddsTable {
  const sport = pool.sport;
  const rows = cases.map(([ds, w]) => [rowsOf(ds, sport), w] as const);
  const avg = (f: (r: Rows) => number) => rows.reduce((a, [r, w]) => a + w * f(r), 0);
  const r: Rows = {
    bands: BAND_ALL.map((_, i) => avg((x) => x.bands[i])),
    tiers: new Map(TIER_ROWS.map((t) => [t, avg((x) => x.tiers.get(t) ?? 0)])),
    holo: 0,
    featured: 0,
    special: avg((x) => x.special),
    sport,
  };
  return {
    kind: 'pick',
    title,
    cards: n,
    slotsText,
    ...visible(r),
    holo: 0,
    featured: null,
    perSlot: [{ n, label: 'Each option', chips: perOption }],
    boosted: null,
    effectiveProgram: null,
    notes: [...notes, 'You keep exactly one option. The others never join your club. Picks earn no holo.'],
    updated: ODDS_UPDATED,
    r86: r.bands[I86],
    r90: r.bands[I90],
    special: r.special,
  };
}

/** The stamp shelf's items as the picks they open (stamp-shelf.ts; Standout and Program open with packs-6). */
const SHELF_PICK: Record<ShelfItem, string> = { g82: 'pick-82', scout85: 'pick-85', standouts: 'standout-pick', program: 'program-pick' };

/** The saved pick kinds (PickState.kind) with a published table: every pick but the one-time Icon pick. */
const PICK_KINDS: ReadonlySet<string> = new Set(['scout', 'swap', 'standout-pick', 'front-office', 'pick-82', 'pick-84', 'pick-85', 'program-pick', 'calendar']);
/** Whether pickTable publishes this pick (by its saved kind, or a `live-pick:` / `shelf:` kind). */
export const hasPickOdds = (kind: string): boolean => PICK_KINDS.has(kind) || kind.startsWith('live-pick:') || kind.startsWith('shelf:');

/**
 * A pick's sheet: the chance that at least one of its options is each band and tier. Kinds: `scout` and
 * `swap` (Scout's Choice), `front-office`, `pick-82`, `pick-84`, `pick-85`, `program-pick`,
 * `standout-pick`, `live-pick:<promo>:<n>`, `calendar`, and the stamp shelf's items as `shelf:<item>`.
 * Null for a pick with no published draw (a one-time Icon pick).
 */
export function pickTable(pool: Pool, kind: string, at = Date.now()): OddsTable | null {
  const { day, week } = dayWeek(at);
  return memoised(pool, 'pick|' + kind + '|' + day, () => pickTableNow(pool, kind, day, week));
}

function pickTableNow(pool: Pool, kind: string, day: string, week: string): OddsTable | null {
  const sport = pool.sport;
  if (kind.startsWith('shelf:')) {
    const k = SHELF_PICK[kind.slice(6) as ShelfItem];
    return k ? pickTableNow(pool, k, day, week) : null;
  }
  const g = GOLD_PICKS[kind as keyof typeof GOLD_PICKS];
  if (g) {
    const d = fromOvr(goldDist(pool, g.floor), 'gold', sport);
    const name = g.title + ' ' + fcToDisplay(g.floor, sport) + '+';
    return optionPick(
      pool,
      name,
      g.n,
      [[Array.from({ length: g.n }, () => d), 1]],
      [{ key: 'g', label: 'Gold ' + fcToDisplay(g.floor, sport) + '+, on the gold curve', p: 1 }],
      g.n + ' different golds ' + fcToDisplay(g.floor, sport) + '+ face down, any position, never a special edition. Keep one.',
      g.prefer ? ['Options skip players you own at the overall drawn when another card exists there, and otherwise go higher, never lower, so these odds are the least you get.'] : [],
    );
  }
  if (kind === 'scout' || kind === 'swap') {
    const floor = fcToDisplay(84, sport);
    const so = standoutProgram(pool, week).cards;
    const groups: [string[], number][] = pickFor<[string[], number][]>(sport, { nba: [[Object.keys(positionMix(sport)), 1]], nfl: NFL_GROUPS.map(([, ps]) => [ps, 1 / NFL_GROUPS.length]), soccer: [[Object.keys(positionMix(sport)), 1]] });
    const need = positionMix(sport);
    let soShare = 0;
    const cases = groups.map(([ps, w]): [Dist[], number] => {
      const inGroup = new Set(ps);
      const eligible = so.filter((rc) => inGroup.has(rc.line.pos[0]) && rc.ovr >= floor);
      const s = eligible.length ? SCOUT_STANDOUT : 0;
      soShare += w * s;
      const d = mixDist([
        [
          fromOvr(
            goldDist(
              pool,
              84,
              ps.map((p) => [p, need[p] ?? 1]),
            ),
            'gold',
            sport,
          ),
          1 - s,
        ],
        [fromList(eligible), s],
      ]);
      return [[d, d, d], w];
    });
    return optionPick(
      pool,
      kind === 'swap' ? 'Swap Desk · Scout’s Choice' : 'Scout’s Choice',
      3,
      cases,
      [
        { key: 'g84', label: 'Gold ' + floor + '+', p: 1 - soShare },
        { key: 'standout', label: 'Weekly Standout ' + floor + '+', p: soShare },
      ],
      'Three different ' +
        floor +
        '+ cards from the gold curve' +
        pickFor(sport, { nba: ', different positions when they can be', nfl: ', from one position group picked at random', soccer: ', different positions when they can be' }) +
        '; each option is a Weekly Standout (' +
        floor +
        '+) ' +
        fmtPct(SCOUT_STANDOUT) +
        ' of the time when this week has one. Keep one.',
      soShare < SCOUT_STANDOUT
        ? ['This week ' + (soShare ? 'only some position groups have' : 'has no') + ' Weekly Standout rated ' + floor + '+, so the Standout chance is ' + fmtPct(soShare) + '.']
        : [],
    );
  }
  if (kind === 'standout-pick') {
    const p = standoutProgram(pool, week);
    return uniformPick(
      pool,
      'Standout Pick',
      p.cards,
      3,
      'Weekly Standout',
      ['Each of this week’s Standouts is equally likely; the Featured Standout too.'],
      p.featured ? { ids: new Set([p.featured.line.id]), name: p.featured.line.name } : undefined,
      weekMonday(week),
    );
  }
  if (kind === 'program-pick') {
    const src = programPickSource(pool, day);
    if (!src) {
      const t = pickTableNow(pool, 'pick-82', day, week);
      return t && { ...t, title: 'Program Pick', notes: ['No program is live, so a Program Pick is a Player Pick ' + fcToDisplay(82, sport) + '+ today.', ...t.notes] };
    }
    return uniformPick(pool, src.name + ' Pick', src.cards, 3, src.name + ' card', [
      'Options come from the program’s released cards' + (src.cards.some((rc) => rc.line.featured) ? '.' : ', never its featured headliner while three others are out.'),
    ]);
  }
  if (kind.startsWith('live-pick:')) {
    const [, promo, n] = kind.split(':');
    const cards = promoCards(pool, promo, day);
    if (!cards.length) return null;
    const name = per(promoById(promo)?.name, sport) ?? 'Program';
    return uniformPick(pool, name + ' Pick', cards, Math.max(1, Math.min(5, Number(n) || 3)), name + ' card', []);
  }
  if (kind === 'calendar') {
    const floor = fcToDisplay(78, sport);
    const golds = Object.values(pool.buckets.gold)
      .flat()
      .filter((rc) => rc.line.kind === 'season' && rc.ovr >= floor);
    return uniformPick(pool, 'Login Calendar · Gold Pick', golds, 2, 'season gold ' + floor + '+', []);
  }
  return null;
}

// ---------- random rewards ----------

/** Whether a reward has anything random in it (a sheet to show before it opens). */
export function isRandomReward(w: Reward): boolean {
  return !!(w.pack || w.card || w.standout || w.program);
}

/**
 * A random reward's sheet: an SBC's or objective's card (a gold on the curve from its floor, a Hot Season,
 * a Weekly Standout, a program card) together with any pack it pays, as one "at least one" table. ut's
 * MINUTES, league and Rookie Week rewards pass a `{ pack }` reward. Null when nothing in it is random.
 */
export function rewardOdds(pool: Pool, w: Reward, at = Date.now()): OddsTable | null {
  if (!isRandomReward(w)) return null;
  const { day, week } = dayWeek(at);
  const sport = pool.sport;
  const pack = w.pack ? oddsSlots(pool, w.pack, day, week) : null;
  const card: Dist[] = [];
  let featuredName: string | undefined;
  let featuredIds: string[] = [];
  const notes: string[] = [];
  const ctxBase: OddsCtx = { week, day };
  if (w.card) {
    const want = w.card;
    const fit = (rc: RatedCard) => rc.ovr >= (want.minOvr ?? 0);
    const all = Object.values(pool.buckets[want.tier]).flat();
    const fromFr = want.fr ? all.filter((rc) => fit(rc) && rc.line.fr === want.fr) : [];
    let d: Dist | null = null;
    if (want.tier === 'gold') {
      const floor = Math.max(want.minOvr ?? 0, TIER_CUTS[sport].gold);
      const m = curveDist(fromFr.length ? fromFr : goldsOf(pool), GOLD_CURVE, floor);
      if (m.size) d = fromOvr(m, 'gold', sport);
      notes.push('The gold is drawn on the gold curve from ' + floor + (fromFr.length ? ', from the franchise named' : '') + ' when you claim it.');
    }
    if (!d) {
      const list = fromFr.length ? fromFr : all.filter(fit);
      d = list.length ? fromList(list) : null;
      if (list.length) notes.push('The card is any of ' + list.length + ' that fit, all equally likely, drawn when you claim it.');
    }
    if (d) card.push(d);
  }
  if (w.standout) {
    const p = standoutProgram(pool, week);
    const d = standoutDist(pool, week, { ...ctxBase, featured: new Set(p.featured ? [p.featured.line.id] : []) });
    if (d) card.push(d);
    featuredName = p.featured?.line.name;
    featuredIds = p.featured ? [p.featured.line.id] : [];
    notes.push('A Weekly Standout from this week’s: the Featured Standout ' + fmtPct(FEATURED_STANDOUT) + ' of the time, otherwise any of the others equally.');
  }
  if (w.program) {
    const promo = promoById(w.program);
    const all = promo ? promoCards(pool, w.program, promo.end > day ? promo.end : day) : [];
    const list0 = w.programFeatured ? all.filter((rc) => rc.line.featured) : all.filter((rc) => !rc.line.featured);
    const list = list0.length ? list0 : all;
    if (list.length) card.push(fromList(list));
    notes.push('The program card is any of ' + list.length + (w.programFeatured ? ' featured' : '') + ' cards of the program, all equally likely, drawn when you claim it.');
  }
  const slots = [...(pack?.slots ?? []), ...card.map((): Odds => ({}))];
  const dists = [...(pack?.dists ?? []), ...card];
  const r = rowsOf(dists, sport);
  const title = rewardText(w, sport, packName);
  return {
    kind: 'reward',
    title: title.charAt(0).toUpperCase() + title.slice(1),
    cards: slots.length,
    slotsText: card.length && pack ? 'The reward’s card and its pack’s ' + pack.slots.length + ' cards together.' : pack ? pack.blurb : 'One card, drawn when you claim it.',
    ...visible(r),
    holo: r.holo,
    featured: featuredName && r.featured > 0 ? { name: featuredName, p: r.featured, ids: featuredIds } : null,
    perSlot: pack ? perSlotOf(pack.slots, sport) : [],
    boosted: null,
    effectiveProgram: null,
    notes: [...notes, ...(pack?.notes ?? [])],
    updated: later(ODDS_UPDATED, w.standout ? weekMonday(week) : ''),
    r86: r.bands[I86],
    r90: r.bands[I90],
    special: r.special,
  };
}

/** A pack reward's slots and their distributions (the Store definition; program kinds by the day). */
function oddsSlots(pool: Pool, kind: string, day: string, week: string): { slots: Odds[]; dists: Dist[]; blurb: string; notes: string[] } | null {
  const defs = packDefs(pool.sport) as Record<string, PackDef>;
  const p = kind.startsWith('live') ? packOfKind(kind) : null;
  const def = p ? livePackDef(pool.sport, p) : defs[kind];
  if (!def || kind === 'spotlight' || kind === 'scout') return null;
  const program: [RatedCard[], number][] | undefined = p
    ? [
        [promoCards(pool, promoOfPack(kind), day), (def as ReturnType<typeof livePackDef>).odds],
        ...(def as ReturnType<typeof livePackDef>).extra.map(([id, o]): [RatedCard[], number] => [promoCards(pool, id, day), o]),
      ]
    : undefined;
  const ctx: OddsCtx = { week, day, program };
  const t = p ? null : oddsFor(pool, kind);
  const taken = newTaken(pool);
  return { slots: def.slots, dists: def.slots.map((o) => slotDist(pool, o, ctx, taken)), blurb: def.blurb.replace(/\.+$/, '') + '.', notes: t?.notes ?? [] };
}

// ---------- Scout Drops ----------

export interface DropSheet {
  title: string;
  taps: number;
  /** drop 1: the first miss settles it */
  stopOnMiss: boolean;
  /** each tap's chance to move up a tier */
  steps: { from: DropTier; to: DropTier; p: number }[];
  /** the exact final odds (dropOdds), each with what it pays */
  final: { tier: DropTier; label: string; p: number; reward: string }[];
  /** the drop's expected value in coin-equivalents */
  ev: number;
  notes: string[];
  updated: string;
}

const DROP_LABEL: Record<DropTier, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

/** A Scout Drop reward in words ("Silver Pack + 100 coins", "60 coins + 3 Scout Stamps"). */
export function dropRewardText(sport: UtSport, r: DropReward): string {
  const parts: string[] = [];
  if (r.pack) parts.push(packName(sport, r.pack));
  if (r.coins) parts.push(r.coins.toLocaleString('en-US') + ' coins');
  if (r.stamps) parts.push(r.stamps + ' Scout Stamp' + (r.stamps === 1 ? '' : 's'));
  if (r.xp) parts.push(r.xp + ' XP');
  return parts.join(' + ');
}

/** A Scout Drop's sheet, shown before the first tap: its numbers are dropOdds' exactly. */
export function dropSheet(sport: UtSport, index: DropIndex): DropSheet {
  const t = dropTable(sport, index);
  const odds = dropOdds(sport, index);
  const steps = DROP_TIERS.slice(0, -1)
    .filter((tier) => t.up[tier] > 0)
    .map((tier) => ({ from: tier, to: DROP_TIERS[DROP_TIERS.indexOf(tier) + 1], p: t.up[tier] }));
  return {
    title: index === 1 ? 'Scout Reveal' : 'Scout Drop ' + index,
    taps: t.taps,
    stopOnMiss: !!t.stopOnMiss,
    steps,
    final: DROP_TIERS.map((tier) => ({ tier, label: DROP_LABEL[tier], p: odds[tier], reward: dropRewardText(sport, t.rewards[tier]) })),
    ev: dropEv(sport, index),
    notes: [
      t.stopOnMiss
        ? 'You tap ' + t.taps + ' times. Each tap can move the drop up one tier; the first tap that misses settles it.'
        : 'You tap ' + t.taps + ' times. Each tap can move the drop up one tier; a tap that misses only spends that tap.',
      'Free: nothing is staked. The reveal plays exactly the tiers rolled, never a tier you didn’t get.',
    ],
    updated: ODDS_UPDATED,
  };
}

// ---------- the coin route (D10) ----------

const routeCache = new Map<string, number>();

/** The chance one Premium Gold holds at least one gold of displayed overall `ovr` or better (exact, the curve). */
export function premiumChanceAtLeast(sport: UtSport, ovr: number): number {
  const def = packDefs(sport).premium;
  let none = 1;
  for (const slot of def.slots) {
    let p = 0;
    for (const [k, w] of Object.entries(slot)) {
      if (!w || !isFloorKind(k)) continue;
      let hit = 0;
      for (const [o, x] of curveOdds(GOLD_CURVE, fcToDisplay(FLOORS[k], sport), sport)) if (o >= ovr) hit += x;
      p += w * hit;
    }
    none *= 1 - p;
  }
  return 1 - none;
}

/**
 * D10: the coins a gold of displayed overall `ovr`+ costs by its cheapest pack route (Premium Gold price ÷
 * the chance a Premium has one). Infinity above the curve's top (no pack route at all). value.ts, the
 * Scout Market and the SBC value rules read it from here.
 */
export function routeCost(sport: UtSport, ovr: number): number {
  const price = packDefs(sport).premium.price;
  const key = sport + ':' + ovr + ':' + price;
  const got = routeCache.get(key);
  if (got !== undefined) return got;
  const p = premiumChanceAtLeast(sport, ovr);
  const v = p > 0 ? Math.round(price / p) : Infinity;
  routeCache.set(key, v);
  return v;
}

// ---------- the buy confirm ----------

/** Store purchases from this price ask first (BuyConfirm). */
export const CONFIRM_FROM = 1500;
/** From this price "Don't ask again" is never offered or honoured. */
export const ALWAYS_CONFIRM_FROM = 10000;

/** Whether a purchase asks first, and whether the player may turn that off for it. */
export function confirmFor(price: number, prefs?: { skipBuyConfirm?: boolean }): { ask: boolean; canSkip: boolean } {
  const canSkip = price < ALWAYS_CONFIRM_FROM;
  return { ask: price >= CONFIRM_FROM && !(canSkip && prefs?.skipBuyConfirm), canSkip };
}

/**
 * The three most telling rows of a sheet for the buy confirm: the best band a pack hits at least 1 time
 * in 20, the best band it hits at least 1 in 200, and the rarest special tier (or the featured card).
 */
export function headline(t: OddsTable, n = 3): OddsRow[] {
  const out: OddsRow[] = [];
  const bands = t.bands.filter((b) => b.p < 0.995);
  const a = [...bands].reverse().find((b) => b.p >= 0.05);
  if (a) out.push(a);
  const b = [...bands].reverse().find((x) => x.p >= 0.005 && x !== a);
  if (b) out.push(b);
  const special = t.tiers.filter((x) => !['t-gold', 't-silver', 't-bronze'].includes(x.key) && x.p < 0.995 && x.p > 0);
  const rare = special.find((x) => x.p >= 0.0001) ?? special[0];
  if (rare) out.push(rare);
  else if (t.featured) out.push({ key: 'featured', label: t.featured.name, p: t.featured.p });
  for (const x of [...t.tiers, ...t.bands]) if (out.length < n && x.p < 0.995 && x.p > 0 && !out.includes(x)) out.push(x);
  return out.slice(0, n);
}
