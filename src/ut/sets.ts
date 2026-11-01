// Claude, 2026-11-01: Set Collections. Discover (pack, pick, buy, earn) gold-or-better cards to fill
// a set; every set pays once (claim id `set:<id>` in ut.content.claims, its pack `set:<sport>:<id>`).
// Discovery is the permanent `ut.collected` record, so selling or trading a card never undoes a set.
//   Era sets       a franchise in a decade: 5 (NBA) / 8 (NFL) different gold+ players
//   All-Decade     one gold+ at every position group from a decade
//   Program sets   3 Standouts, 10 Standouts, 3 Landmarks, 25 rare golds
import { claimed, withClaim } from './content-state';
import { decadeOf, type Pool } from './pool';
import { rareInfo } from './rare';
import type { UtState } from './state';
import type { CardLine, RatedCard, UtSport } from './types';

export type SetKind = 'era' | 'decade' | 'program';
export interface CardSet {
  id: string;
  kind: SetKind;
  title: string;
  blurb: string;
  need: number;
  have: number;
  coins: number;
  pack?: string;
  claimed: boolean;
}

const GOLDISH = new Set(['gold', 'standout', 'promo', 'landmark', 'legend', 'spotlight', 'goat']);
export const ERA_NEED: Record<UtSport, number> = { nba: 5, nfl: 8 };
const GROUPS: Record<UtSport, [string, string[]][]> = {
  nba: [
    ['PG', ['PG']],
    ['SG', ['SG']],
    ['SF', ['SF']],
    ['PF', ['PF']],
    ['C', ['C']],
  ],
  nfl: [
    ['QB', ['QB']],
    ['RB', ['RB']],
    ['WR', ['WR']],
    ['TE', ['TE']],
    ['OL', ['OT', 'OG', 'C']],
    ['DL', ['DE', 'DT']],
    ['LB', ['LB']],
    ['DB', ['CB', 'S']],
    ['K', ['K']],
  ],
};

interface Catalog {
  eras: { fr: string; decade: number; name: string }[];
  decades: number[];
}
const catalogs = new WeakMap<Pool, Catalog>();

/** Franchise-decades with enough gold players to make a set (twice what it needs). */
function catalog(pool: Pool): Catalog {
  let c = catalogs.get(pool);
  if (c) return c;
  const by = new Map<string, { fr: string; decade: number; name: string; season: number; pids: Set<string> }>();
  for (const rc of Object.values(pool.buckets.gold).flat()) {
    const l = rc.line;
    if (l.kind !== 'season') continue;
    const decade = Math.floor(l.season / 10) * 10;
    const k = l.fr + ':' + decade;
    let e = by.get(k);
    if (!e) by.set(k, (e = { fr: l.fr, decade, name: l.teamName, season: l.season, pids: new Set() }));
    if (l.season >= e.season) {
      e.season = l.season;
      e.name = l.teamName;
    }
    e.pids.add(l.pid);
  }
  const eras = [...by.values()]
    .filter((e) => e.pids.size >= ERA_NEED[pool.sport] * 2)
    .sort((a, b) => a.decade - b.decade || (a.fr < b.fr ? -1 : 1))
    .map(({ fr, decade, name }) => ({ fr, decade, name }));
  const decades = [...new Set(eras.map((e) => e.decade))].sort((a, b) => a - b);
  c = { eras, decades };
  catalogs.set(pool, c);
  return c;
}

/** The discovered editions as rated cards (unknown ids skip). */
export function discovered(pool: Pool, ut: Pick<UtState, 'collected' | 'owned'>): RatedCard[] {
  const ids = new Set([...(ut.collected ?? []), ...ut.owned.map((c) => c.cardId)]);
  const out: RatedCard[] = [];
  for (const id of ids) {
    const rc = pool.base.get(id);
    if (rc) out.push(rc);
  }
  return out;
}

const decadeNum = (l: CardLine) => Math.floor(l.season / 10) * 10;

/** Every set with its progress and whether it was claimed. */
export function setsFor(pool: Pool, ut: UtState): CardSet[] {
  const cat = catalog(pool);
  const cards = discovered(pool, ut).filter((rc) => GOLDISH.has(rc.tier));
  const era = new Map<string, Set<string>>();
  const dec = new Map<number, Set<string>>();
  const groups = GROUPS[pool.sport];
  for (const rc of cards) {
    const l = rc.line;
    const k = l.fr + ':' + decadeNum(l);
    (era.get(k) ?? era.set(k, new Set()).get(k)!).add(l.pid);
    const g = groups.find(([, ps]) => ps.includes(l.pos[0]))?.[0];
    if (g) (dec.get(decadeNum(l)) ?? dec.set(decadeNum(l), new Set()).get(decadeNum(l))!).add(g);
  }
  const need = ERA_NEED[pool.sport];
  const sets: CardSet[] = [];
  const mk = (s: Omit<CardSet, 'claimed'>) => sets.push({ ...s, claimed: claimed(ut, 'set:' + s.id) });
  const so = new Set(cards.filter((rc) => rc.tier === 'standout').map((rc) => rc.line.pid)).size;
  const lm = new Set(cards.filter((rc) => rc.tier === 'landmark').map((rc) => rc.line.id)).size;
  const rare = rareInfo(pool);
  const rares = cards.filter((rc) => rare.ids.has(rc.line.id)).length;
  mk({ id: 'program:standouts-3', kind: 'program', title: 'Standout Spotter', blurb: 'Discover 3 different Weekly Standouts.', need: 3, have: so, coins: 250, pack: 'scout' });
  mk({ id: 'program:standouts-10', kind: 'program', title: 'Standout Collector', blurb: 'Discover 10 different Weekly Standouts.', need: 10, have: so, coins: 500, pack: 'elite' });
  mk({ id: 'program:landmarks-3', kind: 'program', title: 'Landmark Archive', blurb: 'Earn 3 Landmark Seasons.', need: 3, have: lm, coins: 500, pack: 'elite' });
  mk({ id: 'program:rare-25', kind: 'program', title: 'Rare Air', blurb: 'Discover 25 rare golds.', need: 25, have: rares, coins: 300, pack: 'jumbo' });
  for (const d of cat.decades)
    mk({ id: 'decade:' + d, kind: 'decade', title: 'All-' + decadeOf(d) + ' Team', blurb: 'A gold or better ' + groups.map((g) => g[0]).join(' ') + ' from the ' + decadeOf(d) + '.', need: groups.length, have: dec.get(d)?.size ?? 0, coins: 500, pack: 'premium' });
  for (const e of cat.eras)
    mk({ id: 'era:' + e.fr + ':' + e.decade, kind: 'era', title: decadeOf(e.decade) + ' ' + e.name, blurb: need + ' different gold or better players from the ' + decadeOf(e.decade) + ' ' + e.name + '.', need, have: Math.min(need, era.get(e.fr + ':' + e.decade)?.size ?? 0), coins: 300, pack: 'gold' });
  return sets.map((s) => ({ ...s, have: Math.min(s.need, s.have) }));
}

/** Claim a complete set once: its coins (for the caller's wallet) and its pack into the Store. */
export function claimSet(pool: Pool, ut: UtState, id: string, at: number): { ut: UtState; coins: number; pack: string | null } {
  const set = setsFor(pool, ut).find((s) => s.id === id);
  if (!set || set.claimed || set.have < set.need) return { ut, coins: 0, pack: null };
  const packId = 'set:' + pool.sport + ':' + id;
  const next = withClaim(ut, 'set:' + id);
  return {
    ut: set.pack && !next.packs.some((p) => p.id === packId) ? { ...next, packs: [...next.packs, { id: packId, kind: set.pack, at }] } : next,
    coins: set.coins,
    pack: set.pack ?? null,
  };
}

/** For a pack's reveal: how many open sets a newly found card would move (the SET tag). */
export function setTagger(pool: Pool, ut: UtState): (rc: RatedCard) => number {
  const before = discovered(pool, ut).filter((rc) => GOLDISH.has(rc.tier));
  const open = new Set(setsFor(pool, ut).filter((s) => !s.claimed && s.have < s.need).map((s) => s.id));
  const eraPids = new Set(before.map((b) => b.line.fr + ':' + decadeNum(b.line) + ':' + b.line.pid));
  const soPids = new Set(before.filter((b) => b.tier === 'standout').map((b) => b.line.pid));
  const lmIds = new Set(before.filter((b) => b.tier === 'landmark').map((b) => b.line.id));
  return (rc) => {
    if (!GOLDISH.has(rc.tier)) return 0;
    const l = rc.line;
    let n = 0;
    if (open.has('era:' + l.fr + ':' + decadeNum(l)) && !eraPids.has(l.fr + ':' + decadeNum(l) + ':' + l.pid)) n++;
    if (rc.tier === 'standout' && !soPids.has(l.pid)) n += Number(open.has('program:standouts-3')) + Number(open.has('program:standouts-10'));
    if (rc.tier === 'landmark' && !lmIds.has(l.id) && open.has('program:landmarks-3')) n++;
    return n;
  };
}
