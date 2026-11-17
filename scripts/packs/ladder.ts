// Claude (packs-6, 2026-11-17): the tier ladder model (packs-plan D5, D6, D13 and §5 packs-6 items 5-6).
//
// What one card of each tier costs by its cheapest coin route, and how many days of income that is for
// the casual, regular, engaged and maximum player, before Game Design V2 and with every V2 income row
// (D.16 and E.5, accepted at about +50% by the lead). The rungs are computed from the real definitions:
// pack slots, the pity's effective rate, prices, limits and the Hot Season challenges' cheapest fodder at
// acquisition cost (value.ts, D10). The stamp shelf's values and the stamp pace come from the same tables.
//
// The ladder suite (src/ut/packs-suites/ladder.ts) imports it, and it runs as a script:
//   PS_SPORT=nba npx vite-node scripts/packs/ladder.ts > ladder-nba.md
// It reads ut's MINUTES ladders from src/ut/minutes.ts when that module is on the branch, and otherwise
// MINUTES_FALLBACK (a copy of V2 E.5; the suite fails at merge if the two differ).
/// <reference types="vite/client" />
import { pickFor } from '../../src/engine/sport';
import { packsOn } from '../../src/ut/calendar';
import { dropEv } from '../../src/ut/drop-tables';
import { fcToDisplay } from '../../src/ut/fc-scale';
import { effectiveProgramRate, HONORS_GUARANTEE, isHonors, LEGEND_PROGRAM, livePackDef, pityLength, promoOfPack } from '../../src/ut/live-packs';
import { packDefs, type Odds, SPOTLIGHT_PRICE, type SlotTier } from '../../src/ut/packs';
import type { Pool } from '../../src/ut/pool';
import { seasonReward } from '../../src/ut/progression';
import { HOT_SEASON_TUNE, weekOf } from '../../src/ut/sbc';
import { COINS_PER_STAMP, NOMINAL_PRICE, STAMP_GRANT, STAMP_SHELF, type ShelfItem } from '../../src/ut/scout-stamps';
import { SHELF_FLOOR } from '../../src/ut/stamp-shelf';
import type { UtSport } from '../../src/ut/types';
import { cheapestFodder, packEv, routeCost } from '../../src/ut/value';

// ---------- ut's MINUTES ladders (V2 E.5) ----------

export interface MinutesReward {
  coins?: number;
  pack?: 'silver' | 'gold' | 'premium';
  /** a "Scout Stamp" reward (one = a grant of STAMP_GRANT.minutes30 stamps, D13) */
  stamp?: number;
  /** the Player Pick 84+ */
  pick?: boolean;
  flair?: string;
  done?: boolean;
}
export interface MinutesRung {
  at: number;
  reward: MinutesReward;
}
export interface MinutesLadders {
  daily: MinutesRung[];
  weekly: MinutesRung[];
  life: MinutesRung[];
}

/** V2 E.5's full table (the lead accepted it), as ut's minutes.ts `LADDERS` holds it. */
export const MINUTES_FALLBACK: MinutesLadders = {
  daily: [
    { at: 5, reward: { coins: 25 } },
    { at: 15, reward: { coins: 50 } },
    { at: 30, reward: { coins: 75, stamp: 1 } },
    { at: 60, reward: { pack: 'silver', coins: 50 } },
    { at: 90, reward: { coins: 50, done: true } },
  ],
  weekly: [
    { at: 60, reward: { coins: 150 } },
    { at: 150, reward: { pack: 'silver' } },
    { at: 300, reward: { pack: 'gold' } },
    { at: 450, reward: { coins: 400 } },
    { at: 600, reward: { pack: 'premium', flair: 'Iron Man week' } },
  ],
  life: [
    { at: 60, reward: { pack: 'gold', flair: 'Rookie' } },
    { at: 300, reward: { coins: 1000, flair: 'Starter' } },
    { at: 600, reward: { pack: 'premium', flair: 'Pro frame' } },
    { at: 1500, reward: { pick: true, flair: 'All-Star frame' } },
    { at: 3000, reward: { flair: 'MVP frame, banner and nameplate' } },
    { at: 6000, reward: { flair: 'Hall of Famer frame and a card finish' } },
    { at: 15000, reward: { flair: 'Legend title' } },
    { at: 30000, reward: { flair: 'Icon frame' } },
    { at: 60000, reward: { flair: 'GOAT crown' } },
  ],
};

/** ut's module, when it is on this branch (a glob, so this file builds without it). */
const UT_MINUTES = import.meta.glob<{ LADDERS?: MinutesLadders }>('../../src/ut/minutes.ts', { eager: true });
export const MINUTES_FROM_UT: MinutesLadders | null = Object.values(UT_MINUTES)[0]?.LADDERS ?? null;
/** The ladders the model uses: ut's when present, otherwise the fallback. */
export const MINUTES: MinutesLadders = MINUTES_FROM_UT ?? MINUTES_FALLBACK;

// ---------- V2 income (D.16, E.4, E.5) ----------

export type Player = 'casual' | 'regular' | 'engaged' | 'max';
export const PLAYERS: Player[] = ['casual', 'regular', 'engaged', 'max'];

/**
 * Every income row of Game Design V2 D.16 and E.5, per player, in coin-equivalents a day (packs at their
 * quick-sell value). `base` is ut's coin-flow table (E.4): today, and after the planned ut overhaul; the
 * rest is what V2 adds on top. The rows D.16 gives only for the engaged player are spread over the others
 * as noted. NFL and soccer earn the same coins (E.5); their packs are valued at their own prices.
 */
export const V2_INCOME = {
  /** E.4 / D.16: coin-equivalents a day before V2 (maximum = engaged: matches stop paying after 8 a day) */
  base: { casual: { today: 1030, planned: 1260 }, regular: { today: 1250, planned: 1500 }, engaged: { today: 1470, planned: 1860 }, max: { today: 1470, planned: 1860 } } as Record<Player, { today: number; planned: number }>,
  /** of `base`, the Daily bonus Silver Pack at quick-sell (it earns no stamps); the rest is coins */
  dailySilverQs: 200,
  /** E.5: counted active minutes a day (casual ≈ 17, about 120 a week) */
  minutesPerDay: { casual: 17, regular: 30, engaged: 60, max: 90 } as Record<Player, number>,
  /** E.6: league week-end rewards a day (stay 100 coins a week; promotions a Silver or Gold; worst case 64) */
  league: { casual: 14, regular: 15, engaged: 30, max: 64 } as Record<Player, number>,
  /** D.12/D.16: Scout Drops 2 and 3 a day (the first three wins; drop 1 is the existing Scout Reveal) */
  drops: { casual: 1, regular: 2, engaged: 2, max: 2 } as Record<Player, number>,
  /** D.14 / D.16: Hot Hand, 20-96 a day inside the 8 paid games */
  hotHand: { casual: 20, regular: 40, engaged: 60, max: 96 } as Record<Player, number>,
  /** D.3 / D.16: the Daily Play's first clear */
  dailyPlay: { casual: 75, regular: 75, engaged: 75, max: 75 } as Record<Player, number>,
  /** E.4: the UT match win rate the Circuit odds use, and Champions Circuit entries a week (3 allowed) */
  winRate: { casual: 0.5, regular: 0.55, engaged: 0.6, max: 0.65 } as Record<Player, number>,
  circuitEntries: { casual: 0, regular: 1, engaged: 3, max: 3 } as Record<Player, number>,
  /** the share of 28-day seasons in which the player reaches Season Pass level 25 */
  seasonPass: { casual: 0, regular: 0.5, engaged: 1, max: 1 } as Record<Player, number>,
};

/** How ut's earned Spotlight routes are modelled: as the code has them, or as packs-1 asked (Program Picks). */
export type UtRoutes = 'current' | 'requested';

const rep = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
const day0 = '2026-12-05';
/** The day the ladder is read on: release week + 1, with two ordinary programs live (s2). */
export const REF_DAY = day0;
/** A day of January Honors (s4), for the Honors rung. */
export const HONORS_DAY = '2027-01-20';

/** The D5 bands (basketball coins); other sports scale by their Standout Guarantee price. */
export const D5 = {
  standout: [3000, 3600],
  program: [6600, 10000],
  promo: [15000, 26000],
  legend: [40000, 55000],
} as const;
export const rungScale = (sport: UtSport) => packDefs(sport).standout.price / packDefs('nba').standout.price;

export type Rung = 'standout' | 'program' | 'promo' | 'legend' | 'honors' | 'finale' | 'spotlight' | 'goat';
export const RUNGS: Rung[] = ['standout', 'program', 'promo', 'legend', 'honors', 'finale', 'spotlight', 'goat'];
/** The rungs a sport has: soccer has no Live Calendar (programs, Honors, the Finale) and no Spotlight or GOAT. */
export const rungsOf = (sport: UtSport): Rung[] => pickFor(sport, { nba: RUNGS, nfl: RUNGS, soccer: ['standout', 'promo', 'legend'] as Rung[] });
export const RUNG_NAME: Record<Rung, string> = { standout: 'Standout', program: 'Program', promo: 'Hot Season', legend: 'Legend', honors: 'Honors', finale: 'Finale', spotlight: 'Spotlight', goat: 'GOAT' };

export interface RouteCost {
  rung: Rung;
  coins: number;
  route: string;
}

const STORE = ['bronze', 'silver', 'gold', 'premium', 'elite', 'jumbo', 'standout'] as const;
const share = (slots: readonly Odds[], t: SlotTier) => slots.reduce((a, o) => a + (o[t] ?? 0), 0);

/**
 * Each rung's cheapest coin route. Store packs at full price (a sale or a Lightning window is a discount on
 * a route, not a route of its own); the program pack with its pity's effective rate; the Program Guarantee;
 * the four Hot Season challenges at the acquisition cost of their cheapest fodder (D10), less a Premium they
 * also pay; the Spotlight pack's contract odds. The Finale is its challenge's lower bound (D5): a Legend and
 * six program cards.
 */
export function ladderRoutes(pool: Pool, day = REF_DAY): Record<Rung, RouteCost> {
  const sport = pool.sport;
  const defs = packDefs(sport);
  const out = {} as Record<Rung, RouteCost>;
  const best = (rung: Rung, coins: number, route: string) => {
    if (!(coins > 0) || !Number.isFinite(coins)) return;
    if (!out[rung] || coins < out[rung].coins) out[rung] = { rung, coins: Math.round(coins), route };
  };
  for (const k of STORE) {
    const d = defs[k];
    for (const [rung, t] of [['standout', 'standout'], ['promo', 'promo'], ['legend', 'legend']] as const) {
      const n = share(d.slots, t);
      if (n > 0) best(rung, d.price / n, d.name);
    }
  }
  if (sport !== 'soccer') {
    const sp = defs.spotlight;
    const last = sp.slots[sp.slots.length - 1];
    best('spotlight', sp.price / (last.spotlight ?? 0), sp.name);
    best('goat', sp.price / (last.goat ?? 0), sp.name);
    best('legend', sp.price / (last.legend ?? 0), sp.name);
    best('promo', sp.price / (last.promo ?? 0), sp.name);
    for (const [d, rung] of [
      [day, 'program'],
      [HONORS_DAY, 'honors'],
    ] as const)
      for (const p of packsOn(d)) {
        const honors = isHonors(promoOfPack(p.id));
        if ((rung === 'honors') !== honors) continue;
        const def = livePackDef(sport, p);
        if (p.tpl === 'guarantee') best(rung, def.price, def.name + ' (guarantee)');
        else {
          const pp = def.odds + def.extra.reduce((a, [, x]) => a + x, 0);
          best(rung, def.price / effectiveProgramRate(pp, pityLength(pp)), def.name + ' (with pity)');
          best('legend', def.price / LEGEND_PROGRAM, def.name);
        }
      }
    // an Honors-class program may have no guarantee on sale: its floor price is the rule's
    if (!out.honors) best('honors', HONORS_GUARANTEE[sport], 'Honors guarantee floor');
  }
  // the Hot Season challenges (HOT_SEASON_TUNE), ignoring their franchise rules (a lower bound)
  const t = HOT_SEASON_TUNE[sport];
  for (const [name, size, gold, extra] of [
    ['Dynasty', t.dynasty, false, 0],
    ['Hall of Fame Class', t.hof, true, defs.premium.price],
    ['Rival Dynasties', t.rival, false, 0],
    ['Hot Season Hunt', t.hunt, false, 0],
  ] as const)
    best('promo', cheapestFodder(sport, { size, teamOvr: t.team, ...(gold ? { tier: 'gold' as const } : {}) }).value - extra, name + ' challenge');
  if (sport !== 'soccer') out.finale = { rung: 'finale', coins: out.legend.coins + 6 * out.program.coins, route: 'The Perfect Season challenge: a Legend and six program cards (lower bound)' };
  return out;
}

/** D5: the Spotlight pack's price from the measured rungs (0.20 × 1.5 × max(Legend, Finale), up to 1,000). */
export function spotlightPriceFor(routes: Record<Rung, RouteCost>): number {
  const top = Math.max(routes.legend.coins, routes.finale?.coins ?? 0);
  return Math.ceil((0.2 * 1.5 * top) / 1000) * 1000;
}

// ---------- income a day ----------

/** A pack's coin-equivalent value (its exact quick-sell EV on the realistic curve). */
export function packValue(pool: Pool, kind: 'silver' | 'gold' | 'premium', week = weekOf(REF_DAY)): number {
  return packEv(pool, packDefs(pool.sport)[kind].slots, { week });
}

/** A day's MINUTES rewards for `perDay` counted minutes every day (daily rungs + a seventh of the week's). */
export function minutesValue(pool: Pool, perDay: number, ladders = MINUTES): { coins: number; packs: number; stamps: number; perDay: number } {
  let coins = 0;
  let packs = 0;
  let stamps = 0;
  const add = (r: MinutesReward, k: number) => {
    coins += (r.coins ?? 0) * k;
    if (r.pack) packs += packValue(pool, r.pack) * k;
    stamps += (r.stamp ?? 0) * STAMP_GRANT.minutes30 * k;
  };
  for (const r of ladders.daily) if (perDay >= r.at) add(r.reward, 1);
  const week = Math.min(630, perDay * 7);
  for (const r of ladders.weekly) if (week >= r.at) add(r.reward, 1 / 7);
  return { coins, packs, stamps, perDay: coins + packs };
}

export interface Income {
  /** coin-equivalents a day */
  total: number;
  rows: Record<string, number>;
}

/** A player's income a day in this sport: before V2 (`today` or `planned`) or with every V2 row. */
export function incomeOf(pool: Pool, player: Player, mode: 'today' | 'planned' | 'v2'): Income {
  const I = V2_INCOME;
  const rows: Record<string, number> = { base: I.base[player][mode === 'today' ? 'today' : 'planned'] };
  if (mode === 'v2') {
    rows.minutes = minutesValue(pool, I.minutesPerDay[player]).perDay;
    rows.league = I.league[player];
    rows.drops = I.drops[player] * dropEv(pool.sport, 2);
    rows.hotHand = I.hotHand[player];
    rows.dailyPlay = I.dailyPlay[player];
  }
  return { total: Object.values(rows).reduce((a, b) => a + b, 0), rows };
}

// ---------- ut's earned routes (special cards a day, not counted as coin income) ----------

/** P(at least `w` wins in a 6-game Circuit run) at win rate `p`. */
function atLeast(p: number, w: number): number {
  let s = 0;
  for (let k = w; k <= 6; k++) s += binom(6, k) * p ** k * (1 - p) ** (6 - k);
  return s;
}
const binom = (n: number, k: number) => rep(k, (i) => (n - i) / (i + 1)).reduce((a, b) => a * b, 1);

/** Special cards a day from ut's earned routes: the Circuit's 6-0 prize and Season Pass level 25. */
export function earnedPerDay(pool: Pool, player: Player, routes: UtRoutes): Partial<Record<Rung, number>> {
  if (pool.sport === 'soccer') return {};
  const I = V2_INCOME;
  const n = I.circuitEntries[player];
  const six = n ? 1 - (1 - atLeast(I.winRate[player], 6)) ** n : 0;
  const spotlightPacks = six / 7 + I.seasonPass[player] / 28;
  if (routes === 'requested') return { program: spotlightPacks };
  const sl = packDefs(pool.sport).spotlight.slots;
  const last = sl[sl.length - 1];
  return { spotlight: spotlightPacks * (last.spotlight ?? 0), legend: spotlightPacks * (last.legend ?? 0), promo: spotlightPacks * (last.promo ?? 0), goat: spotlightPacks * (last.goat ?? 0) };
}

/** Days for one card of each rung: coins at this income, plus ut's earned routes. The Finale is coins only. */
export function daysOf(pool: Pool, coins: Record<Rung, RouteCost>, player: Player, mode: 'today' | 'planned' | 'v2', routes: UtRoutes): Partial<Record<Rung, number>> {
  const inc = incomeOf(pool, player, mode).total;
  const earned = earnedPerDay(pool, player, routes);
  const out: Partial<Record<Rung, number>> = {};
  for (const r of rungsOf(pool.sport)) {
    const rate = inc / coins[r].coins + (r === 'finale' ? 0 : (earned[r] ?? 0));
    out[r] = 1 / rate;
  }
  return out;
}

// ---------- the stamp shelf ----------

/**
 * A shelf item's value in coins, by the game's own prices: a pick of three golds from a floor is what the
 * Store charges for one (Scout's Choice is priced at a quarter of the cheapest pack route to a gold that
 * good: odds.ts routeCost); a Standout pick and a Program pick are their rungs. Null where the sport has no
 * such item (soccer's Program Pick).
 */
export function shelfValue(pool: Pool, item: ShelfItem, routes = ladderRoutes(pool)): number | null {
  const sport = pool.sport;
  if (item === 'g82' || item === 'scout85') return routeCost(sport, fcToDisplay(SHELF_FLOOR[sport][item], sport)) / 4;
  if (item === 'standouts') return routes.standout.coins;
  return pickFor(sport, { nba: routes.program?.coins, nfl: routes.program?.coins, soccer: undefined }) ?? null;
}

/** Each item's value ÷ the coins its stamps stand for (cost × 100): the 5-12% band. */
export function shelfShares(pool: Pool): { item: ShelfItem; cost: number; value: number; share: number }[] {
  const routes = ladderRoutes(pool);
  return STAMP_SHELF.flatMap((s) => {
    const v = shelfValue(pool, s.item, routes);
    return v === null ? [] : [{ item: s.item, cost: s.cost, value: Math.round(v), share: v / (s.cost * COINS_PER_STAMP) }];
  });
}

/**
 * Stamps day by day for a player who opens packs with every coin they earn (the stamps' premise), from
 * release: coins on Store packs (1 per 100), MINUTES packs at their Store price, the 30-minute grant,
 * Scout Drop stamps, Circuit and Season Pass packs at their Store price. Duplicate specials (+10) are left
 * out (a lower bound). Returns the cumulative balance at the end of each day.
 */
export function stampPace(sport: UtSport, player: Player, days = 42, ladders = MINUTES): number[] {
  const I = V2_INCOME;
  const nominal = NOMINAL_PRICE[sport];
  const st = (kind: string) => Math.floor((nominal[kind] ?? 0) / COINS_PER_STAMP);
  const m = I.minutesPerDay[player];
  // coins a day: the base less its Daily Silver, and V2's coin rows (MINUTES coins are added per rung below)
  const coins = I.base[player].planned - I.dailySilverQs + I.league[player] + I.hotHand[player] + I.dailyPlay[player] + I.drops[player] * (0.512 * 25 + 0.3605 * 45 + 0.1125 * 60);
  const drops = I.drops[player] * 0.1125 * STAMP_GRANT.drop;
  // Circuit (Silver at 2 wins, Gold at 4) and the Season Pass's packs, spread evenly over the week / season
  const n = I.circuitEntries[player];
  const best = (w: number) => (n ? 1 - (1 - atLeast(I.winRate[player], w)) ** n : 0);
  const circuit = (best(2) * st('silver') + best(4) * st('gold')) / 7;
  let sp = 0;
  for (let tier = 1; tier <= 25; tier++) {
    const r = seasonReward(tier);
    if (r.pack && r.pack !== 'spotlight') sp += st(r.pack);
  }
  const season = (sp * I.seasonPass[player]) / 28;
  const out: number[] = [];
  let bal = 0;
  let life = 0;
  let week = 0;
  for (let d = 0; d < days; d++) {
    if (d % 7 === 0) week = 0;
    let c = coins;
    for (const r of ladders.daily)
      if (m >= r.at) {
        c += r.reward.coins ?? 0;
        if (r.reward.pack) bal += st(r.reward.pack);
        bal += (r.reward.stamp ?? 0) * STAMP_GRANT.minutes30;
      }
    const before = week;
    week = Math.min(630, week + m);
    for (const r of ladders.weekly)
      if (before < r.at && week >= r.at) {
        c += r.reward.coins ?? 0;
        if (r.reward.pack) bal += st(r.reward.pack);
      }
    const lifeBefore = life;
    life += m;
    for (const r of ladders.life)
      if (lifeBefore < r.at && life >= r.at) {
        c += r.reward.coins ?? 0;
        if (r.reward.pack) bal += st(r.reward.pack);
      }
    bal += c / COINS_PER_STAMP + drops + circuit + season;
    out.push(bal);
  }
  return out;
}

/** The first day (1-based) at whose end the balance reaches `n`, or Infinity. */
export function dayToStamps(pace: number[], n: number): number {
  const i = pace.findIndex((b) => b >= n);
  return i < 0 ? Infinity : i + 1;
}

// ---------- the report ----------

const fmt = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '∞');
const fd = (x: number | undefined) => (x === undefined ? '—' : x < 10 ? x.toFixed(1) : x.toFixed(0));

/** The ladder tables in Markdown (coins; days before V2 and with V2 for each player; the shelf; stamps). */
export function ladderReport(pool: Pool): string {
  const sport = pool.sport;
  const routes = ladderRoutes(pool);
  const rungs = rungsOf(sport);
  const lines: string[] = [];
  lines.push('#### ' + sport.toUpperCase() + ': rungs (cheapest coin route)', '', '| Rung | Coins | Route |', '|---|---|---|');
  for (const r of rungs) lines.push('| ' + RUNG_NAME[r] + ' | ' + fmt(routes[r].coins) + ' | ' + routes[r].route + ' |');
  if (sport !== 'soccer') lines.push('', 'Spotlight pack price by D5: ' + fmt(spotlightPriceFor(routes)) + ' (in packs.ts: ' + fmt(SPOTLIGHT_PRICE[sport]) + ').');
  for (const routesMode of (sport === 'soccer' ? ['current'] : ['current', 'requested']) as UtRoutes[]) {
    lines.push('', '#### Days for one card, ut routes ' + routesMode + ' (before V2 = planned income; today in brackets)', '', '| Player | Income today / planned / V2 | ' + rungs.map((r) => RUNG_NAME[r]).join(' | ') + ' |', '|---|---|' + rungs.map(() => '---').join('|') + '|');
    for (const p of PLAYERS) {
      const t = daysOf(pool, routes, p, 'today', routesMode);
      const b = daysOf(pool, routes, p, 'planned', routesMode);
      const v = daysOf(pool, routes, p, 'v2', routesMode);
      const inc = (m: 'today' | 'planned' | 'v2') => fmt(incomeOf(pool, p, m).total);
      lines.push('| ' + p + ' | ' + inc('today') + ' / ' + inc('planned') + ' / ' + inc('v2') + ' | ' + rungs.map((r) => fd(b[r]) + ' → ' + fd(v[r]) + ' (' + fd(t[r]) + ')').join(' | ') + ' |');
    }
  }
  lines.push('', '#### V2 income rows (coin-equivalents a day)', '', '| Player | ' + Object.keys(incomeOf(pool, 'engaged', 'v2').rows).join(' | ') + ' |', '|---|' + Object.keys(incomeOf(pool, 'engaged', 'v2').rows).map(() => '---').join('|') + '|');
  for (const p of PLAYERS) lines.push('| ' + p + ' | ' + Object.values(incomeOf(pool, p, 'v2').rows).map(fmt).join(' | ') + ' |');
  lines.push('', '#### Stamp shelf (value ÷ the coins its stamps stand for)', '', '| Item | Stamps | Value | Share |', '|---|---|---|---|');
  for (const s of shelfShares(pool)) lines.push('| ' + s.item + ' | ' + s.cost + ' | ' + fmt(s.value) + ' | ' + (s.share * 100).toFixed(1) + '% |');
  lines.push('', '#### Stamp pace (day the balance first reaches it)', '', '| Player | 50 | 120 | 300 | 600 | stamps a day (4-week mean) |', '|---|---|---|---|---|---|');
  for (const p of PLAYERS) {
    const pace = stampPace(sport, p);
    lines.push('| ' + p + ' | ' + [50, 120, 300, 600].map((n) => fd(dayToStamps(pace, n))).join(' | ') + ' | ' + (pace[27] / 28).toFixed(1) + ' |');
  }
  return lines.join('\n');
}

// run as a script (vite-node); under vitest the suite only imports the model
if (!import.meta.env?.VITEST && import.meta.env?.MODE !== 'test') {
  const { getPool } = await import('../../src/ut/pool');
  console.log(ladderReport(await getPool()));
}
