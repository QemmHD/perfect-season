// Squad Building Challenges: trade in cards that meet a challenge's requirements for a pack, coins
// or a special card. Six daily and four weekly, the same for everyone, picked from the date the
// way the Daily is; three upgrades (cards in for a better pack) that can be done twice a day; and
// repeatables (five cards in for a better card) that can be done as often as you like.
// See docs/ULTIMATE-TEAM.md.
import { hashString, pickOne, rng, type Rand, shuffle, trueRand } from '../engine/rng';
import { openPack, packRand, quickSellValue } from './packs';
import { decadeOf, type Pool, TIER_RANK } from './pool';
import { onScale } from './rate';
import type { RatedCard, Tier, UtSport } from './types';

export type Req =
  /** every card at least this overall */
  | { k: 'minOvr'; ovr: number }
  /** the cards' average overall at least this */
  | { k: 'teamOvr'; ovr: number }
  /** at least n cards of this tier or better */
  | { k: 'tier'; tier: Tier; n: number }
  /** at least n from one franchise (any) */
  | { k: 'sameFr'; n: number }
  /** at least n from this franchise */
  | { k: 'fr'; fr: string; name: string; n: number }
  /** at least n from this decade (1990 = the 1990s) */
  | { k: 'decade'; decade: number; n: number }
  /** at least n from one decade (any) */
  | { k: 'sameDecade'; n: number }
  /** one card at each of these positions */
  | { k: 'positions'; pos: string[] };

export interface Reward {
  coins?: number;
  /** a pack kind (see packs.ts) */
  pack?: string;
  /** a card: a Hot Season, or a gold at least this good, from this franchise when there is one */
  card?: { tier: 'gold' | 'promo'; minOvr?: number; fr?: string };
}

export interface Sbc {
  /** unique: the day or week it belongs to and its place in the list */
  id: string;
  kind: 'daily' | 'weekly' | 'upgrade';
  /** an upgrade: how many more times it can be done today (counting this one); none: repeatable */
  left?: number;
  title: string;
  blurb: string;
  /** how many cards go in */
  size: number;
  reqs: Req[];
  reward: Reward;
}

const TIER_NAME: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', promo: 'Hot Season', legend: 'Legend' };

export function reqText(r: Req): string {
  switch (r.k) {
    case 'minOvr':
      return 'Every card ' + r.ovr + '+ overall';
    case 'teamOvr':
      return 'Team overall ' + r.ovr + '+';
    case 'tier':
      return 'At least ' + r.n + ' ' + TIER_NAME[r.tier] + (r.tier === 'gold' ? '' : ' or better');
    case 'sameFr':
      return r.n + ' from the same franchise';
    case 'fr':
      return 'At least ' + r.n + ' ' + r.name;
    case 'decade':
      return 'At least ' + r.n + ' from the ' + r.decade + 's';
    case 'sameDecade':
      return r.n + ' from the same decade';
    case 'positions':
      return 'One each: ' + r.pos.join(' ');
  }
}

export function rewardText(w: Reward, sport: UtSport, packName: (s: UtSport, k: string) => string): string {
  const parts: string[] = [];
  if (w.pack) parts.push(packName(sport, w.pack));
  if (w.card) parts.push(w.card.tier === 'promo' ? 'a Hot Season card' : w.card.minOvr ? (String(w.card.minOvr).startsWith('8') ? 'an ' : 'a ') + w.card.minOvr + '+ Gold card' : 'a Gold card');
  if (w.coins) parts.push(w.coins.toLocaleString('en-US') + ' coins');
  return parts.join(' + ');
}

const mostOf = (xs: string[]): number => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return Math.max(0, ...m.values());
};

/** Whether the cards meet one requirement, and how far along they are ("2/3"). */
export function checkReq(r: Req, cards: RatedCard[]): { ok: boolean; have: string } {
  const n = cards.length;
  switch (r.k) {
    case 'minOvr': {
      const low = cards.filter((c) => c.ovr < r.ovr).length;
      return { ok: n > 0 && low === 0, have: n ? (low ? low + ' under' : 'all ' + r.ovr + '+') : '—' };
    }
    case 'teamOvr': {
      const avg = n ? Math.round(cards.reduce((a, c) => a + c.ovr, 0) / n) : 0;
      return { ok: n > 0 && avg >= r.ovr, have: n ? String(avg) : '—' };
    }
    case 'tier': {
      const k = cards.filter((c) => TIER_RANK[c.tier] >= TIER_RANK[r.tier]).length;
      return { ok: k >= r.n, have: k + '/' + r.n };
    }
    case 'sameFr': {
      const k = mostOf(cards.map((c) => c.line.fr));
      return { ok: k >= r.n, have: k + '/' + r.n };
    }
    case 'fr': {
      const k = cards.filter((c) => c.line.fr === r.fr).length;
      return { ok: k >= r.n, have: k + '/' + r.n };
    }
    case 'decade': {
      const k = cards.filter((c) => Math.floor(c.line.season / 10) * 10 === r.decade).length;
      return { ok: k >= r.n, have: k + '/' + r.n };
    }
    case 'sameDecade': {
      const k = mostOf(cards.map((c) => decadeOf(c.line.season)));
      return { ok: k >= r.n, have: k + '/' + r.n };
    }
    case 'positions': {
      // each listed position filled by a different card that plays it
      const k = matchPositions(r.pos, cards).filter((i) => i >= 0).length;
      return { ok: k === r.pos.length, have: k + '/' + r.pos.length };
    }
  }
}

/**
 * The most positions that can each get a card of their own (cards play every position they list):
 * for each position, the index of its card, or -1. A true matching (augmenting paths), so a card
 * that plays two positions goes where it's needed whatever order the cards came in; earlier cards
 * are tried first.
 */
export function matchPositions(pos: string[], cards: { line: { pos: string[] } }[]): number[] {
  const owner: number[] = cards.map(() => -1);
  const seat = (p: number, seen: boolean[]): boolean => {
    for (let c = 0; c < cards.length; c++) {
      if (seen[c] || !cards[c].line.pos.includes(pos[p])) continue;
      seen[c] = true;
      if (owner[c] < 0 || seat(owner[c], seen)) {
        owner[c] = p;
        return true;
      }
    }
    return false;
  };
  for (let p = 0; p < pos.length; p++) seat(p, cards.map(() => false));
  const out = pos.map(() => -1);
  owner.forEach((p, c) => p >= 0 && (out[p] = c));
  return out;
}

/** A challenge checked against the cards put in: every requirement, and the right number of cards. */
export function checkSbc(s: Sbc, cards: RatedCard[]): { ok: boolean; full: boolean; reqs: { req: Req; text: string; ok: boolean; have: string }[] } {
  const reqs = s.reqs.map((req) => ({ req, text: reqText(req), ...checkReq(req, cards) }));
  // one player once
  const pids = new Set(cards.map((c) => c.line.pid));
  const full = cards.length === s.size && pids.size === cards.length;
  return { ok: full && reqs.every((r) => r.ok), full, reqs };
}

// ---------- the day's and the week's challenges ----------

/** ISO week of an Eastern date key, like the leaderboard's: "2026-W44". */
export function weekOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

interface Ctx {
  pool: Pool;
  rand: Rand;
  /** franchises with plenty of cards, and their current names */
  frs: { fr: string; name: string }[];
  decades: number[];
}

function context(pool: Pool, seed: string): Ctx {
  const count = new Map<string, number>();
  const name = new Map<string, { name: string; season: number }>();
  const dec = new Map<number, number>();
  for (const l of pool.lines) {
    if (l.kind !== 'season') continue;
    count.set(l.fr, (count.get(l.fr) ?? 0) + 1);
    const n = name.get(l.fr);
    if (!n || l.season > n.season) name.set(l.fr, { name: l.teamName, season: l.season });
    const d = Math.floor(l.season / 10) * 10;
    dec.set(d, (dec.get(d) ?? 0) + 1);
  }
  const most = Math.max(...count.values());
  const frs = Array.from(count.entries())
    .filter(([, n]) => n >= most * 0.35)
    .map(([fr]) => ({ fr, name: name.get(fr)!.name }))
    .sort((a, b) => (a.fr < b.fr ? -1 : 1));
  const top = Math.max(...dec.values());
  const decades = Array.from(dec.entries())
    .filter(([, n]) => n >= top * 0.3)
    .map(([d]) => d)
    .sort((a, b) => a - b);
  return { pool, rand: rng(hashString(seed)), frs, decades };
}

type Template = (c: Ctx) => Omit<Sbc, 'id' | 'kind'>;

const nba = (c: Ctx) => c.pool.sport === 'nba';
/** a threshold written on basketball's scale, in this sport's */
const sc = (c: Ctx, x: number) => onScale(x, c.pool.sport);

const EASY: Template[] = [
  () => ({ title: 'Three of a Kind', blurb: 'Teammates trade well.', size: 3, reqs: [{ k: 'sameFr', n: 3 }], reward: { pack: 'silver' } }),
  (c) => {
    const d = pickOne(c.decades, c.rand);
    return { title: d + 's Night', blurb: 'A trip back to the ' + d + 's.', size: 3, reqs: [{ k: 'decade', decade: d, n: 3 }], reward: { pack: 'silver' } };
  },
  () => ({ title: 'Silver Lining', blurb: 'Swap some silver for something shinier.', size: 4, reqs: [{ k: 'tier', tier: 'silver', n: 3 }], reward: { pack: 'silver' } }),
  (c) => ({ title: 'Bronze Age', blurb: 'Clear out the bench.', size: 5, reqs: [{ k: 'minOvr', ovr: sc(c, 50) }], reward: { pack: 'silver' } }),
  (c) => ({ title: nba(c) ? 'Pickup Game' : 'Scrimmage', blurb: 'Any five who can play a little.', size: 5, reqs: [{ k: 'teamOvr', ovr: sc(c, 56) }], reward: { pack: 'silver' } }),
  (c) => {
    const [a, b] = shuffle(c.decades, c.rand);
    return { title: 'Then and Now', blurb: 'Two from the ' + a + 's, two from the ' + b + 's.', size: 4, reqs: [{ k: 'decade', decade: a, n: 2 }, { k: 'decade', decade: b, n: 2 }], reward: { pack: 'silver' } };
  },
  () => ({ title: 'Pairs', blurb: 'Two teammates, two from one decade.', size: 4, reqs: [{ k: 'sameFr', n: 2 }, { k: 'sameDecade', n: 2 }], reward: { pack: 'silver' } }),
  () => ({ title: 'Silver Service', blurb: 'Three silvers, cashed in.', size: 3, reqs: [{ k: 'tier', tier: 'silver', n: 3 }], reward: { pack: 'silver' } }),
];

const MEDIUM: Template[] = [
  (c) => {
    const f = pickOne(c.frs, c.rand);
    return { title: 'Franchise Night', blurb: 'Bring the ' + f.name + '.', size: 4, reqs: [{ k: 'fr', fr: f.fr, name: f.name, n: 2 }, { k: 'teamOvr', ovr: sc(c, 64) }], reward: { pack: 'gold' } };
  },
  (c) => ({ title: 'Same Era', blurb: 'One decade, one team.', size: 5, reqs: [{ k: 'sameDecade', n: 5 }, { k: 'teamOvr', ovr: sc(c, 65) }], reward: { pack: 'gold' } }),
  () => ({ title: 'Silver Squad', blurb: 'A whole lineup of silver or better.', size: 5, reqs: [{ k: 'tier', tier: 'silver', n: 5 }], reward: { pack: 'gold' } }),
  (c) => {
    const [a, b] = shuffle(c.frs, c.rand);
    return { title: 'Rivalry Week', blurb: a.name + ' and ' + b.name + ', on one sheet.', size: 4, reqs: [{ k: 'fr', fr: a.fr, name: a.name, n: 2 }, { k: 'fr', fr: b.fr, name: b.name, n: 2 }], reward: { pack: 'gold' } };
  },
  (c) => {
    const d = pickOne(c.decades, c.rand);
    return { title: 'Decade Draft', blurb: 'Four from the ' + d + 's, and they can play.', size: 5, reqs: [{ k: 'decade', decade: d, n: 4 }, { k: 'teamOvr', ovr: sc(c, 66) }], reward: { pack: 'gold' } };
  },
  () => ({ title: 'Golden Pair', blurb: 'Two golds and a shared era.', size: 4, reqs: [{ k: 'tier', tier: 'gold', n: 2 }, { k: 'sameDecade', n: 3 }], reward: { pack: 'gold' } }),
  (c) =>
    nba(c)
      ? { title: 'Backcourt', blurb: 'A point guard and a shooting guard, and a third.', size: 3, reqs: [{ k: 'positions', pos: ['PG', 'SG'] }, { k: 'teamOvr', ovr: sc(c, 68) }], reward: { pack: 'gold' } }
      : { title: 'Pass Catchers', blurb: 'Two receivers and a tight end.', size: 3, reqs: [{ k: 'positions', pos: ['WR', 'WR', 'TE'] }, { k: 'teamOvr', ovr: sc(c, 68) }], reward: { pack: 'gold' } },
];

const HARD: Template[] = [
  (c) =>
    nba(c)
      ? { title: 'A Full Five', blurb: 'A real lineup, and a good one.', size: 5, reqs: [{ k: 'positions', pos: ['PG', 'SG', 'SF', 'PF', 'C'] }, { k: 'teamOvr', ovr: sc(c, 72) }], reward: { pack: 'premium' } }
      : { title: 'Skill Set', blurb: 'A whole offense around the quarterback.', size: 5, reqs: [{ k: 'positions', pos: ['QB', 'RB', 'WR', 'WR', 'TE'] }, { k: 'teamOvr', ovr: sc(c, 72) }], reward: { pack: 'premium' } },
  (c) => {
    const f = pickOne(c.frs, c.rand);
    return { title: f.name + ' Legacy', blurb: 'Three from one franchise, all good ones.', size: 3, reqs: [{ k: 'fr', fr: f.fr, name: f.name, n: 3 }, { k: 'minOvr', ovr: sc(c, 68) }], reward: { card: { tier: 'gold', minOvr: sc(c, 78), fr: f.fr } } };
  },
  (c) => ({ title: 'Golden Era', blurb: 'Five from one decade, four of them gold.', size: 5, reqs: [{ k: 'sameDecade', n: 5 }, { k: 'tier', tier: 'gold', n: 4 }], reward: { card: { tier: 'gold', minOvr: sc(c, 82) } } }),
  (c) => ({ title: 'Deep Bench', blurb: 'Eight cards, five of them gold.', size: 8, reqs: [{ k: 'tier', tier: 'gold', n: 5 }, { k: 'teamOvr', ovr: sc(c, 72) }], reward: { pack: 'premium' } }),
  (c) =>
    nba(c)
      ? { title: 'Frontcourt', blurb: 'A gold three, four and five.', size: 3, reqs: [{ k: 'positions', pos: ['SF', 'PF', 'C'] }, { k: 'tier', tier: 'gold', n: 3 }], reward: { pack: 'premium' } }
      : { title: 'No Fly Zone', blurb: 'A gold secondary.', size: 4, reqs: [{ k: 'positions', pos: ['CB', 'CB', 'S', 'S'] }, { k: 'tier', tier: 'gold', n: 4 }], reward: { pack: 'premium' } },
];

const WEEKLY: Template[] = [
  (c) => {
    const f = pickOne(c.frs, c.rand);
    return { title: 'Dynasty: ' + f.name, blurb: 'Five from one franchise. A Hot Season card comes back.', size: 5, reqs: [{ k: 'fr', fr: f.fr, name: f.name, n: 5 }, { k: 'teamOvr', ovr: sc(c, 70) }], reward: { card: { tier: 'promo', fr: f.fr } } };
  },
  (c) => {
    const d = pickOne(c.decades, c.rand);
    return { title: 'The ' + d + 's All-Stars', blurb: 'Six golds from one decade.', size: 6, reqs: [{ k: 'decade', decade: d, n: 6 }, { k: 'tier', tier: 'gold', n: 6 }], reward: { pack: 'premium' } };
  },
  (c) =>
    nba(c)
      ? { title: 'Gold Standard', blurb: 'A gold five at every position.', size: 5, reqs: [{ k: 'positions', pos: ['PG', 'SG', 'SF', 'PF', 'C'] }, { k: 'tier', tier: 'gold', n: 5 }], reward: { pack: 'premium', card: { tier: 'gold', minOvr: sc(c, 82) } } }
      : { title: 'Gold Front Seven', blurb: 'A gold front seven.', size: 7, reqs: [{ k: 'positions', pos: ['DE', 'DE', 'DT', 'DT', 'LB', 'LB', 'LB'] }, { k: 'tier', tier: 'gold', n: 7 }], reward: { pack: 'premium', card: { tier: 'gold', minOvr: sc(c, 82) } } },
  (c) => ({ title: 'Team Builders', blurb: 'Eight cards, one era, real chemistry.', size: 8, reqs: [{ k: 'sameDecade', n: 6 }, { k: 'sameFr', n: 3 }, { k: 'teamOvr', ovr: sc(c, 70) }], reward: { pack: 'premium' } }),
  (c) => ({ title: 'Hall of Fame Class', blurb: 'Eight golds, and good ones.', size: 8, reqs: [{ k: 'tier', tier: 'gold', n: 8 }, { k: 'teamOvr', ovr: sc(c, 78) }], reward: { pack: 'premium', card: { tier: 'promo' } } }),
  (c) => {
    const [a, b] = shuffle(c.frs, c.rand);
    return { title: 'Rival Dynasties', blurb: 'Three ' + a.name + ', three ' + b.name + '. A Hot Season card comes back.', size: 6, reqs: [{ k: 'fr', fr: a.fr, name: a.name, n: 3 }, { k: 'fr', fr: b.fr, name: b.name, n: 3 }, { k: 'teamOvr', ovr: sc(c, 70) }], reward: { card: { tier: 'promo' } } };
  },
  (c) => {
    const d = pickOne(c.decades, c.rand);
    return { title: 'Champions of the ' + d + 's', blurb: 'Five from the ' + d + 's, built to win.', size: 5, reqs: [{ k: 'decade', decade: d, n: 5 }, { k: 'teamOvr', ovr: sc(c, 74) }], reward: { card: { tier: 'gold', minOvr: sc(c, 85) } } };
  },
  () => ({ title: 'Hot Season Hunt', blurb: 'Six cards: five golds, three teammates.', size: 6, reqs: [{ k: 'tier', tier: 'gold', n: 5 }, { k: 'sameFr', n: 3 }], reward: { card: { tier: 'promo' } } }),
];

/** Upgrades (cards in for a better pack: twice a day each) and repeatables (five cards in for a
 * better card: as often as you like). */
export const UPGRADE_TIMES = 2;
const UPGRADES: [Template, number][] = [
  [() => ({ title: 'Bronze Upgrade', blurb: 'Any five cards for a Silver pack.', size: 5, reqs: [{ k: 'tier', tier: 'bronze', n: 5 }], reward: { pack: 'silver' } }), UPGRADE_TIMES],
  [() => ({ title: 'Silver Upgrade', blurb: 'Five silvers (or better) for a Gold pack.', size: 5, reqs: [{ k: 'tier', tier: 'silver', n: 5 }], reward: { pack: 'gold' } }), UPGRADE_TIMES],
  [(c) => ({ title: 'Gold Upgrade', blurb: 'Five good golds for a Premium pack.', size: 5, reqs: [{ k: 'tier', tier: 'gold', n: 5 }, { k: 'teamOvr', ovr: sc(c, 78) }], reward: { pack: 'premium' } }), UPGRADE_TIMES],
  [() => ({ title: 'Silver to Gold', blurb: 'Five silvers for a gold.', size: 5, reqs: [{ k: 'tier', tier: 'silver', n: 5 }], reward: { card: { tier: 'gold' } } }), Infinity],
  [(c) => ({ title: 'Golden Hour', blurb: 'Eight golds for a better one.', size: 8, reqs: [{ k: 'tier', tier: 'gold', n: 8 }, { k: 'teamOvr', ovr: sc(c, 77) }], reward: { card: { tier: 'gold', minOvr: sc(c, 84) } } }), Infinity],
  [(c) => ({ title: 'Elite Pull', blurb: 'Eight strong golds for a star.', size: 8, reqs: [{ k: 'tier', tier: 'gold', n: 8 }, { k: 'teamOvr', ovr: sc(c, 81) }], reward: { card: { tier: 'gold', minOvr: sc(c, 88) } } }), Infinity],
];

/**
 * Today's six (two easy, two medium, two hard), this week's four, and the upgrades. `done` (the
 * challenges done, by id) says which round of each upgrade is next: after its last one today it
 * shows as done.
 */
export function sbcsFor(pool: Pool, day: string, done: Record<string, unknown> = {}): Sbc[] {
  const sport = pool.sport;
  const d = context(pool, 'ut-sbc:' + sport + ':' + day);
  const daily = [EASY, EASY, MEDIUM, MEDIUM, HARD, HARD];
  const picked = new Map<Template[], Template[]>();
  const dailies = daily.map((list, i) => {
    // two different ones from each list
    const left = picked.get(list) ?? shuffle(list, d.rand);
    picked.set(list, left.slice(1));
    return { ...left[0](d), id: 'd:' + day + ':' + i, kind: 'daily' as const };
  });
  const week = weekOf(day);
  const w = context(pool, 'ut-sbc:' + sport + ':' + week);
  const weekly = shuffle(WEEKLY, w.rand)
    .slice(0, 4)
    .map((t, i) => ({ ...t(w), id: 'w:' + week + ':' + i, kind: 'weekly' as const }));
  const u = context(pool, 'ut-sbc:' + sport + ':upgrades');
  const upgrades = UPGRADES.map(([t, times], i) => {
    let n = 0;
    while (n < times - 1 && done['u:' + day + ':' + i + ':' + n]) n++;
    return { ...t(u), id: 'u:' + day + ':' + i + ':' + n, kind: 'upgrade' as const, ...(Number.isFinite(times) ? { left: times - n } : {}) };
  });
  return [...dailies, ...weekly, ...upgrades];
}

// ---------- filling a challenge from the club ----------

/** A card in the club, as auto-fill sees it: `slot` is where it plays in the squad, if it does. */
export interface FillCard {
  uid: string;
  rc: RatedCard;
  slot: string | null;
}

/**
 * Does one card meet a requirement's part for a single card? With `size`, only the requirements
 * every card must meet count (a "2 from the Bulls" in a four-card challenge lets two be anyone).
 */
export function cardFits(r: Req, c: RatedCard, size?: number): boolean {
  const all = (n: number) => size === undefined || n >= size;
  switch (r.k) {
    case 'minOvr':
      return c.ovr >= r.ovr;
    case 'fr':
      return !all(r.n) || c.line.fr === r.fr;
    case 'decade':
      return !all(r.n) || Math.floor(c.line.season / 10) * 10 === r.decade;
    case 'tier':
      return !all(r.n) || TIER_RANK[c.tier] >= TIER_RANK[r.tier];
    case 'positions':
      return !all(r.pos.length) || r.pos.some((p) => c.line.pos.includes(p));
    default:
      return true;
  }
}

/**
 * Fill a challenge from the club, cheapest cards first and squad cards last. Each try starts from a
 * core (a franchise, a decade, or both, for the "same" and "from" requirements; the biggest
 * first), seats the positions, fills up, then raises the team overall with the cheapest swaps that
 * do it. The first set that passes wins; null when none does.
 */
export function autoFill<C extends FillCard>(s: Sbc, club: C[]): string[] | null {
  const cheap = (a: C, b: C) => (a.slot ? 1 : 0) - (b.slot ? 1 : 0) || quickSellValue(a.rc) - quickSellValue(b.rc) || a.rc.ovr - b.rc.ovr;
  // only cards that meet what every card must (an overall floor, a tier for all, ...)
  const cands = club.filter((c) => s.reqs.every((r) => cardFits(r, c.rc, s.size))).sort(cheap);
  const has = (k: Req['k']) => s.reqs.some((r) => r.k === k);
  const byFr = has('sameFr') || has('fr');
  const byDec = has('sameDecade') || has('decade');
  const decOf = (c: C) => Math.floor(c.rc.line.season / 10);
  const tries: C[][] = [cands];
  if (byFr || byDec) {
    const groups = new Map<string, C[]>();
    for (const c of cands) {
      const k = (byDec ? decOf(c) : '') + '|' + (byFr ? c.rc.line.fr : '');
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
    }
    for (const g of Array.from(groups.values()).sort((a, b) => b.length - a.length)) {
      // the group, then the rest of its decade (a decade needs more cards than one franchise has)
      const rest = byDec && byFr ? cands.filter((c) => decOf(c) === decOf(g[0]) && !g.includes(c)) : [];
      tries.push([...g, ...rest]);
    }
  }
  const posReq = s.reqs.find((r) => r.k === 'positions') as { pos: string[] } | undefined;
  const team = s.reqs.find((r) => r.k === 'teamOvr') as { ovr: number } | undefined;
  const rcs = (xs: C[]) => xs.map((c) => c.rc);
  const others = (pick: C[]) => s.reqs.every((r) => r.k === 'teamOvr' || checkReq(r, rcs(pick)).ok);
  for (const core of tries.slice(0, 160)) {
    const pick: C[] = [];
    const pids = new Set<string>();
    const add = (c: C) => {
      if (pick.length >= s.size || pids.has(c.rc.line.pid)) return false;
      pick.push(c);
      pids.add(c.rc.line.pid);
      return true;
    };
    // the positions: a matching over the core (cheapest first), so a two-position card doesn't
    // take a spot another one needs
    if (posReq) for (const i of matchPositions(posReq.pos, rcs(core))) if (i >= 0) add(core[i]);
    // "at least n" of a tier, a franchise, a decade: the cheapest n that are
    for (const r of s.reqs) {
      if (r.k !== 'tier' && r.k !== 'fr' && r.k !== 'decade') continue;
      let have = pick.filter((c) => cardFits(r, c.rc)).length;
      for (const c of core.concat(cands)) {
        if (have >= r.n) break;
        if (!pick.includes(c) && cardFits(r, c.rc) && add(c)) have++;
      }
    }
    for (const c of core) add(c);
    if (!byFr && !byDec) for (const c of cands) add(c);
    if (pick.length < s.size || !others(pick)) continue;
    // the team overall: swap the weakest card for the cheapest one that closes the gap (or the
    // biggest step there is), keeping every other requirement met
    for (let k = 0; team && k < s.size * 3 && !checkSbc(s, rcs(pick)).ok; k++) {
      const sum = pick.reduce((a, c) => a + c.rc.ovr, 0);
      const worst = pick.reduce((w, c) => (c.rc.ovr < w.rc.ovr ? c : w), pick[0]);
      const gap = Math.ceil((team.ovr - 0.5) * s.size - sum);
      const ok = (c: C) => c.rc.ovr > worst.rc.ovr && !pick.includes(c) && (!pids.has(c.rc.line.pid) || c.rc.line.pid === worst.rc.line.pid) && others(pick.map((x) => (x === worst ? c : x)));
      const pool = core.length > s.size ? core.concat(cands) : cands;
      const up = pool.find((c) => c.rc.ovr >= worst.rc.ovr + gap && ok(c)) ?? pool.filter(ok).sort((a, b) => b.rc.ovr - a.rc.ovr)[0];
      if (!up) break;
      pids.delete(worst.rc.line.pid);
      pids.add(up.rc.line.pid);
      pick.splice(pick.indexOf(worst), 1, up);
    }
    if (checkSbc(s, rcs(pick)).ok) return pick.map((c) => c.uid);
  }
  return null;
}

/**
 * The special card a challenge pays: a random one of every card that fits what it promises (its
 * tier, its overall, its franchise), drawn when it's claimed, so no two players are bound to get
 * the same one. With a `seed` (the tests) the same seed gives the same card.
 */
export function rewardCard(pool: Pool, want: NonNullable<Reward['card']>, seed?: string): RatedCard | null {
  const rand = seed === undefined ? trueRand() : packRand('sbc-card:' + seed);
  const all = Object.values(pool.buckets[want.tier]).flat();
  const fit = (rc: RatedCard) => rc.ovr >= (want.minOvr ?? 0);
  const fromFr = all.filter((rc) => fit(rc) && (!want.fr || rc.line.fr === want.fr));
  const list = fromFr.length ? fromFr : all.filter(fit);
  if (list.length) return list[Math.floor(rand() * list.length)];
  // nothing that good: the best of a Gold pack
  return openPack(pool, 'gold', seed === undefined ? undefined : 'sbc-card:' + seed).sort((a, b) => b.ovr - a.ovr)[0] ?? null;
}
