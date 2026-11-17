// Claude, 2026-11-01 (wave 3): the Live Calendar's program packs and picks, built on the content-drop
// packs (rare golds, Weekly Standouts, pick sheets). They open on the device like Gold/Premium; the
// registry is never involved.
//   live:<promo>        Program Pack      NBA 8 / NFL 16: 4 / 9 golds, 3 / 6 golds 80+ and a program
//                                         slot (programOdds, default 30%; the season's other promos via
//                                         extraOdds; a Legend 0.5%; otherwise a current Weekly Standout)
//   live-plus:<promo>   Program Guarantee NBA 6 / NFL 12: 5 / 11 golds 82+ + 1 program card
// (packs-2: golds on the gold curve, packs.ts; the slots were rare golds and golds before)
//   live-pick:<promo>:n pick 1 of n program cards (rewards only, never sold)
// The Finale is SBC-only: it never fills a pack slot.
import { hashString, type Rand, rng, shuffle } from '../engine/rng';
import { easternDateKey } from '../engine/season';
import { packsOn, per, promoById, schedule, wavesOf, type CalPack } from './calendar';
import { contentOf, type PickState } from './content-state';
import { FINALE_KIND, promoCards } from './live-cards';
import { fill, type Odds, type PackDef } from './packs';
import type { Pool } from './pool';
import { fcToDisplay } from './fc-scale';
import { fmtPct } from './odds-fmt';
import { boosted, boostOf } from './boost';
import { weekOf } from './sbc';
import type { UtState } from './state';
import type { RatedCard, UtSport } from './types';
import type { PullEntry } from './pull-log-state';

// Claude (packs-2, research §8.2): a program pack's golds are any gold and golds 80+ (its old rare golds);
// a guarantee's are golds 82+.
const G75: Odds = { g75: 1 };
const G80: Odds = { g80: 1 };
const G82: Odds = { g82: 1 };
/** A program slot's Legend chance (research §8.2), taken from its Weekly Standout share. */
export const LEGEND_PROGRAM = 0.005;
const rep = (n: number, o: Odds) => Array.from({ length: n }, () => o);

export const GUARANTEE_PRICE = 12000;
/**
 * The schedule's prices were planned on a larger coin scale; ours pays 60/30 a match. A guarantee scales
 * its scheduled price by this factor (and never costs under GUARANTEE_OVER × the program pack, below).
 */
export const PRICE_FACTOR: Record<UtSport, Record<string, number>> = { nba: { guarantee: 0.27 }, nfl: { guarantee: 0.155 }, soccer: { guarantee: 0.22 } };
/**
 * Claude (packs-3, audit H3 and M5): one program-pack price per sport. Every program pack returns about the
 * same quick-sell value whatever its odds (NBA 1,690-1,800 coins: a rarer program card is offset by the
 * Standouts it replaces), so the schedule's premium for low-odds packs only made them poor value (Ring
 * Night returned 40%). At these prices every scheduled program pack returns 0.51-0.55, its Friday boost
 * keeps it under 0.60, and a named flash sale's 25% off keeps it at or under 0.75. Soccer has no Live
 * Calendar yet; its price follows its Premium (the same ratio as basketball's) for when it has one.
 */
export const LIVE_PROGRAM_PRICE: Record<UtSport, number> = { nba: 3250, nfl: 2000, soccer: 2800 };
// Claude (packs-6, D5): NBA 3,300 → 3,250, so its Program Guarantee (2.2 × the pack, 7,300 → 7,200) and the
// stamp shelf's Program Pick (600 stamps, 60,000 coins of packs) stay inside the shelf's 5-12% band. Every
// scheduled program pack still returns 0.52-0.56 of its price (the exploits suite holds the EV band).
/** A Program Guarantee costs at least this many program packs (audit H3: 3,200 against a 3,000 pack before). */
export const GUARANTEE_OVER = 2.2;
const ceil100 = (x: number) => Math.ceil(x / 100) * 100;
/** A program pack's golds 80+ (`rare`, the old rare golds) and any golds, and a guarantee's golds 82+, per sport. Soccer has no calendar yet: kept for when it does. */
const LIVE_SHAPE: Record<UtSport, { rare: number; gold: number; guarantee: number }> = { nba: { rare: 3, gold: 4, guarantee: 5 }, nfl: { rare: 6, gold: 9, guarantee: 11 }, soccer: { rare: 4, gold: 5, guarantee: 7 } };

/**
 * Claude (packs-6, D5 "Honors"): a program whose band reaches this displayed overall (January Honors and
 * any later 96+ program) is an Honors-class program: its pack's program slot is at most HONORS_ODDS (with
 * pity, below), and its Program Guarantee costs at least HONORS_GUARANTEE (one a week, one per wave). Only
 * programs that start on or after HONORS_FROM (packs-plan §1 "Cutoffs": PROMO_EDIT_FROM) change, so a
 * program already on sale never moves.
 */
export const HONORS_TOP = 96;
export const HONORS_ODDS = 0.08;
export const HONORS_GUARANTEE: Record<UtSport, number> = { nba: 40000, nfl: 24000, soccer: 32000 };
export const HONORS_FROM = '2026-12-04';
/** Whether a promo is Honors-class (band top 96+, starting on or after the cutoff). */
export function isHonors(promoId: string): boolean {
  const p = promoById(promoId);
  return !!p && p.ovrBand[1] >= HONORS_TOP && p.start >= HONORS_FROM;
}

/** The pack's promo id (`live:s4-honors-y2` → `s4-honors-y2`). */
export const promoOfPack = (kind: string) => kind.replace(/^live(-plus|-pick)?:/, '').split(':')[0];

/**
 * A program pack's published shape: slots, price, and how its program slot divides. With `at`, a pack
 * inside its promo's Friday boost (flash.ts) carries the boosted program chance (× 1.5, at most 60%) and
 * `boost.until`; the Legend chance stays and the Weekly Standout share shrinks.
 */
export function livePackDef(sport: UtSport, pack: Pick<CalPack, 'id' | 'tpl' | 'name' | 'price' | 'programOdds' | 'extraOdds'>, at?: number): PackDef & { odds: number; extra: [string, number][]; boost: { until: number } | null } {
  const tpl = schedule()?.defaults.packTemplates[pack.tpl] ?? {};
  const guarantee = pack.tpl === 'guarantee';
  const honors = isHonors(promoOfPack(pack.id));
  const base0 = guarantee ? 1 : (pack.programOdds ?? tpl.programOdds ?? 0.3);
  const base = honors && !guarantee ? Math.min(HONORS_ODDS, base0) : base0;
  // the Finale never fills a pack slot (owner decision: SBC-only)
  const extra0 = Object.entries(pack.extraOdds ?? {}).filter(([id]) => promoById(id)?.kind !== FINALE_KIND && promoById(id)?.kind !== 'season-finale');
  const extraP0 = extra0.reduce((a, [, p]) => a + p, 0);
  const boost = !guarantee && at !== undefined ? boostOf(promoOfPack(pack.id), sport, at) : null;
  // (the whole program share is boosted, each promo of it in proportion)
  const k = boost && base + extraP0 > 0 ? boosted(base + extraP0) / (base + extraP0) : 1;
  const odds = base * k;
  const extra: [string, number][] = extra0.map(([id, p]) => [id, p * k]);
  const extraP = extraP0 * k;
  const legend = Math.min(LEGEND_PROGRAM, Math.max(0, 1 - odds - extraP));
  const slot: Odds = guarantee ? { program: 1 } : { program: odds + extraP, legend, standout: 1 - odds - extraP - legend };
  const ls = LIVE_SHAPE[sport];
  const slots = guarantee ? [...rep(ls.guarantee, G82), slot] : [...rep(ls.gold, G75), ...rep(ls.rare, G80), slot];
  const name = per(pack.name, sport) ?? pack.id;
  const program = LIVE_PROGRAM_PRICE[sport];
  const price = guarantee ? Math.max(Math.round(((pack.price ?? tpl.price ?? GUARANTEE_PRICE) * (PRICE_FACTOR[sport].guarantee ?? 1)) / 100) * 100, ceil100(GUARANTEE_OVER * program), honors ? HONORS_GUARANTEE[sport] : 0) : program;
  return {
    kind: pack.id as PackDef['kind'],
    name,
    price,
    blurb: guarantee
      ? slots.length + ' cards: ' + (slots.length - 1) + ' golds ' + fcToDisplay(82, sport) + '+ and one program card guaranteed'
      : slots.length + ' cards: ' + (ls.rare + ls.gold) + ' golds (' + ls.rare + ' of them ' + fcToDisplay(80, sport) + '+) and a program slot (' + fmtPct(odds + extraP) + ' a program card' + (boost ? ', boosted' : '') + ', ' + fmtPct(legend) + ' a Legend, otherwise a Weekly Standout)',
    slots,
    odds,
    extra,
    boost,
  };
}

/** The pack definition for a pack id, from the schedule (any cycle). */
export function packOfKind(kind: string): (CalPack & { cycleId: string }) | null {
  const s = schedule();
  if (!s) return null;
  const m = /^(.*?)(-y\d+)?$/.exec(kind)!;
  for (const se of s.seasons) for (const p of se.packs) if (p.id === m[1]) return { ...p, id: kind, cycleId: kind };
  return null;
}

export function livePackName(sport: UtSport, kind: string): string {
  if (kind.startsWith('live-pick:')) return (per(promoById(promoOfPack(kind))?.name, sport) ?? 'Program') + ' Pick';
  const p = packOfKind(kind);
  return p ? (per(p.name, sport) ?? 'Program Pack') : 'Program Pack';
}

/** Open a program pack: its slots, the program slot drawn from the released cards of its promos (boosted when `at` is in a boost). */
export function openLivePack(pool: Pool, kind: string, rand: Rand, day: string, week = weekOf(day), owned?: ReadonlySet<string>, at?: number, forceProgram = false): RatedCard[] {
  const p = packOfKind(kind);
  if (!p) return [];
  // (packs-3: opened at `at`, inside a Friday boost the program slot is the boosted one)
  const def0 = livePackDef(pool.sport, p, at);
  // Claude (packs-6, D6): the pity pack's program slot is a program card for certain
  const def = forceProgram && p.tpl !== 'guarantee' ? { ...def0, slots: [...def0.slots.slice(0, -1), { program: 1 }] } : def0;
  const promo = promoOfPack(kind);
  const draw = (r: Rand, have?: ReadonlySet<string>): RatedCard | null => {
    // which promo this slot is (the pack's own, or one of its extras), in proportion to their odds
    const total = def.odds + def.extra.reduce((a, [, x]) => a + x, 0);
    let x = r() * total;
    let id = promo;
    for (const [e, o] of def.extra) {
      if (x < o) {
        id = e;
        break;
      }
      x -= o;
    }
    // Claude (packs-2): never a program card the player owns while any of that program's released cards is unowned
    const all = promoCards(pool, id, day);
    const fresh = have?.size ? all.filter((rc) => !have.has(rc.line.id)) : all;
    const list = fresh.length ? fresh : all;
    return list.length ? list[Math.floor(r() * list.length)] : null;
  };
  return fill(pool, def.slots, rand, undefined, week, draw, { owned });
}

// ---------- pity (Claude, packs-6; packs-plan D6 and D7) ----------

/**
 * D6: how many program packs in a row can open before one is a program card for certain, for a pack whose
 * unboosted program rate is `p`: L = max(13, ceil(3.9 / p)). 30% → 13, 20% → 20, 8% → 49, 6% → 65. The
 * pity so fires on about 1.4-1.9% of program cards whatever the pack, and a low-odds pack stays rare.
 */
export function pityLength(p: number): number {
  if (!(p > 0)) return Infinity;
  if (p >= 1) return 1;
  return Math.max(13, Math.ceil(3.9 / p - 1e-9));
}

/** D6: the share of program packs that hold a program card with pity: p ÷ (1 − (1 − p)^L). */
export function effectiveProgramRate(p: number, L = pityLength(p)): number {
  if (!(p > 0)) return 0;
  if (p >= 1 || !Number.isFinite(L)) return Math.min(1, p);
  return p / (1 - Math.pow(1 - p, L));
}

/** A program pack's unboosted program rate (its own promo and its extras): what pity's length follows. */
export function baseProgramRate(sport: UtSport, kind: string): number | null {
  const p = packOfKind(kind);
  if (!p || p.tpl === 'guarantee' || !kind.startsWith('live:')) return null;
  const def = livePackDef(sport, p);
  return def.odds + def.extra.reduce((a, [, x]) => a + x, 0);
}

/** The Eastern day a wave of this promo last started on or before `day` (its start, then each wave). */
function waveStart(promoId: string, sport: UtSport, day: string): string {
  const pr = promoById(promoId);
  if (!pr) return '';
  return [pr.start, ...wavesOf(pr, sport).map((w) => w.d)].filter((d) => d <= day).sort().pop() ?? pr.start;
}

export interface PityState {
  /** L: the pack that opens a program card for certain is at most this many packs after the last one */
  length: number;
  /** this promo's program packs opened in a row this wave without a program card */
  misses: number;
  /** the next program card arrives within this many packs (1: the next pack is guaranteed one) */
  within: number;
  /** the next pack's program slot is certain */
  force: boolean;
}

/**
 * D7: pity is never stored. It is recomputed from the Pack Tracker's recent packs: the trailing run of this
 * promo's program packs (`live:<promo>`, from any source) opened since its latest wave began, none of which
 * held a program card. Any program card resets it, and so does a new wave. Null for a guarantee or a kind
 * that is not a program pack.
 */
export function pityState(sport: UtSport, log: { r: readonly PullEntry[] } | undefined, kind: string, day: string): PityState | null {
  const p = baseProgramRate(sport, kind);
  if (p === null) return null;
  const length = pityLength(p);
  const promo = promoOfPack(kind);
  const from = waveStart(promo, sport, day);
  let misses = 0;
  const r = log?.r ?? [];
  for (let i = r.length - 1; i >= 0; i--) {
    const e = r[i];
    if (!e.k.startsWith('live:') || promoOfPack(e.k) !== promo) continue;
    if (easternDateKey(new Date(e.at)) < from) break;
    if (e.cs.some((c) => c[2] === 'program')) break;
    misses++;
  }
  const within = Math.max(1, length - misses);
  return { length, misses, within, force: misses >= length - 1 };
}

/** Program packs on sale on a day (the Store's This Season row). */
export function livePacksOn(day: string): (CalPack & { cycle: number })[] {
  return packsOn(day);
}

// ---------- limits ----------

export function liveLimitKey(pack: Pick<CalPack, 'id' | 'tpl'>, day: string): string {
  return pack.tpl === 'guarantee' ? 'live:' + pack.id + ':' + weekOf(day) : 'live:' + pack.id + ':' + day;
}
export function liveLimit(pack: Pick<CalPack, 'tpl'>): number {
  const l = schedule()?.defaults.packTemplates[pack.tpl]?.limit;
  return pack.tpl === 'guarantee' ? (l?.perWeek ?? 1) : (l?.perDay ?? 3);
}
export function liveBuysLeft(ut: UtState, pack: Pick<CalPack, 'id' | 'tpl'>, day: string): number {
  return Math.max(0, liveLimit(pack) - (contentOf(ut).buys?.[liveLimitKey(pack, day)] ?? 0));
}
export function recordLiveBuy(ut: UtState, pack: Pick<CalPack, 'id' | 'tpl'>, day: string): UtState {
  const c = contentOf(ut);
  const key = liveLimitKey(pack, day);
  const week = weekOf(day);
  const kept = Object.fromEntries(Object.entries(c.buys ?? {}).filter(([k]) => !k.startsWith('live:') || k.endsWith(day) || k.endsWith(week)));
  return { ...ut, content: { ...c, buys: { ...kept, [key]: (kept[key] ?? 0) + 1 } } };
}

// ---------- program picks ----------

/** A `live-pick:<promo>:<n>` reward as a pick sheet (seeded by its pending id). */
export function livePick(pool: Pool, kind: string, id: string, day: string, at: number): PickState | null {
  const [, promo, n] = kind.split(':');
  const cards = promoCards(pool, promo, day);
  if (!cards.length) return null;
  const options = shuffle(cards, rng(hashString('live-pick:' + id))).slice(0, Math.max(1, Math.min(5, Number(n) || 3)));
  return { id, kind: 'live-pick', title: livePackName(pool.sport, kind), options: options.map((rc) => rc.line.id), at };
}

/** Pack kinds the schedule names in rewards, as this build's kinds (the content-drop packs). */
export function resolvePackKind(kind: string, day: string): string {
  const map: Record<string, string> = { 'daily-drop': 'daily', 'scout-choice': 'scout', 'elite-gold': 'elite', 'jumbo-premium': 'jumbo', 'standout-guarantee': 'standout' };
  if (map[kind]) return map[kind];
  if (kind.startsWith('season-program')) {
    const packs = packsOn(day);
    const prog = packs.find((p) => p.tpl === (kind === 'season-program-guarantee' ? 'guarantee' : 'program'));
    if (kind === 'season-program-pick') {
      const se = packs[0]?.season;
      return se?.raw.programPick ? se.raw.programPick + (se.cycle ? '' : '') : prog ? 'live-pick:' + promoOfPack(prog.id) + ':3' : 'scout';
    }
    return prog?.id ?? 'premium';
  }
  return kind;
}
