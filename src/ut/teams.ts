// Squads as the played games' teams: a basketball five (and bench) of Hoopers, a football offense
// and defense of FbPlayers. Each card is rated at the spot it plays and its level, with the same
// code both phones run, so two phones build the same teams from the same squad. A squad travels as
// card ids and levels (SquadWire).
import { hashString } from '../engine/rng';
import { depth } from '../game/football2/squad';
import type { Defense, FbPlayer, Offense } from '../game/football2/types';
import { hooper, SPOTS } from '../game/hoops2/ratings';
import type { Hooper } from '../game/hoops2/types';
import type { Pool } from './pool';
import { rateCard, toHooper } from './rate';
import { type Lineup, rateSquad, slotsFor, type SquadRating } from './squad';
import type { CardLine, RatedCard, UtSport } from './types';

/** A squad on the wire: [slot, card id, level] for every filled spot. */
export type SquadWire = [string, string, number][];

/** A squad as cards: slot → card line and level. */
export type SquadCards = Record<string, { line: CardLine; level: number }>;

/** The wire's squad as cards, checked against this phone's pool and the sport's slots. Unknown cards and slots drop out. */
export function squadFromWire(pool: Pool, w: unknown): SquadCards {
  const out: SquadCards = {};
  if (!Array.isArray(w)) return out;
  const slots = new Set(slotsFor(pool.sport).map((s) => s.id));
  for (const e of w.slice(0, 40)) {
    if (!Array.isArray(e) || e.length !== 3) continue;
    const [slot, id, level] = e;
    if (typeof slot !== 'string' || !slots.has(slot) || typeof id !== 'string' || out[slot]) continue;
    const line = pool.byId.get(id);
    if (!line || !Number.isInteger(level) || level < 1 || level > 5) continue;
    out[slot] = { line, level };
  }
  return out;
}

export function squadToWire(sq: SquadCards): SquadWire {
  return Object.entries(sq)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([slot, c]) => [slot, c.line.id, c.level]);
}

/** Each card rated as it shows in the squad builder (its own position, its level). */
export function lineupOf(sq: SquadCards): Lineup {
  return Object.fromEntries(Object.entries(sq).map(([s, c]) => [s, rateCard(c.line, c.level)]));
}

export function ratingOf(sport: UtSport, sq: SquadCards): SquadRating {
  return rateSquad(sport, lineupOf(sq));
}

// ---------- basketball ----------

/** a card as the game's player, rated at the spot it plays */
export function cardToHooper(line: CardLine, level: number, spot: string): Hooper {
  return { ...toHooper(rateCard(line, level, spot)), pos: spot };
}

/** someone to stand in an empty spot: a replacement-level player */
function reserve(spot: string): Hooper {
  const rk = { pts: 0.25, reb: 0.25, ast: 0.25, stl: 0.25, blk: 0.25, val: 0.2 };
  return hooper({ name: 'Reserve ' + spot, id: 'reserve:' + spot, pos: [spot], from: 2000, r: { pts: 5, reb: 3, ast: 1, stl: 0.5, blk: 0.3 }, val: 0, rk, ppg: 5, apg: 1, a: null }, spot, null);
}

/** The five in the game's order (PG, SG, SF, PF, C) and the bench (best first). */
export function fiveOfSquad(sq: SquadCards): { five: Hooper[]; bench: Hooper[] } {
  const benchSlots = slotsFor('nba').filter((s) => s.unit === 'bench' && sq[s.id]);
  const bench = benchSlots.map((s) => sq[s.id]).sort((a, b) => rateCard(b.line, b.level).ovr - rateCard(a.line, a.level).ovr);
  const used = new Set<CardLine>();
  const five = SPOTS.map((spot) => {
    let c: { line: CardLine; level: number } | undefined = sq[spot];
    // an empty starting spot: the best bench player who plays it, then anyone on the bench
    c ??= bench.find((b) => !used.has(b.line) && b.line.pos.includes(spot)) ?? bench.find((b) => !used.has(b.line));
    if (!c) return reserve(spot);
    used.add(c.line);
    return cardToHooper(c.line, c.level, spot);
  });
  return { five, bench: bench.filter((b) => !used.has(b.line)).map((b) => toHooper(rateCard(b.line, b.level))) };
}

// ---------- football ----------

function tagOf(name: string): string {
  const parts = name.replace(/ \(.*\)$/, '').split(' ');
  return (parts.slice(1).join(' ') || parts[0]).toUpperCase().slice(0, 12);
}

const SIZE: Record<string, [number, number]> = { QB: [75, 222], RB: [71, 212], WR: [72, 196], TE: [77, 252], OT: [78, 315], OG: [76, 312], C: [75, 300], DE: [76, 270], DT: [75, 305], LB: [74, 240], CB: [71, 192], S: [72, 206], K: [72, 196] };

/** a card as the game's player, rated at the position it plays */
export function cardToFb(line: CardLine, level: number, pos: string): FbPlayer {
  const rc: RatedCard = rateCard(line, level, pos);
  const [ht, wt] = SIZE[pos] ?? [74, 220];
  return { id: line.id, name: line.name, tag: tagOf(line.name), num: line.num, ht: line.ht ?? ht, wt: line.wt ?? wt, pos, ovr: rc.ovr, a: { ...rc.attrs }, abil: rc.abil.slice() };
}

/** an empty spot: a depth player well below the squad (the squad builder asks for every spot filled) */
function fb(sq: SquadCards, slot: string, pos: string, seed: string): FbPlayer {
  const c = sq[slot];
  return c ? cardToFb(c.line, c.level, pos) : depth(pos, 0.25, seed, slot);
}

/** The offense: QB, RB, the receivers (X = WR1, Z = WR2, the slot = WR3), the TE, the line left to right, the kicker. */
export function offenseOfSquad(sq: SquadCards, seed: string): Offense {
  return {
    qb: fb(sq, 'QB', 'QB', seed),
    rb: fb(sq, 'RB', 'RB', seed),
    wr: [fb(sq, 'WR1', 'WR', seed), fb(sq, 'WR2', 'WR', seed), fb(sq, 'WR3', 'WR', seed)],
    te: fb(sq, 'TE', 'TE', seed),
    ol: [fb(sq, 'LT', 'OT', seed), fb(sq, 'LG', 'OG', seed), fb(sq, 'C', 'C', seed), fb(sq, 'RG', 'OG', seed), fb(sq, 'RT', 'OT', seed)],
    k: fb(sq, 'K', 'K', seed),
  };
}

/** The defense: the front four (LE, LDT, RDT, RE), the backers (WLB, MLB, SLB), the corners, the safeties (free, strong). */
export function defenseOfSquad(sq: SquadCards, seed: string): Defense {
  return {
    dl: [fb(sq, 'DE1', 'DE', seed), fb(sq, 'DT1', 'DT', seed), fb(sq, 'DT2', 'DT', seed), fb(sq, 'DE2', 'DE', seed)],
    lb: [fb(sq, 'LB1', 'LB', seed), fb(sq, 'LB2', 'LB', seed), fb(sq, 'LB3', 'LB', seed)],
    cb: [fb(sq, 'CB1', 'CB', seed), fb(sq, 'CB2', 'CB', seed)],
    s: [fb(sq, 'FS', 'S', seed), fb(sq, 'SS', 'S', seed)],
  };
}

/** Both sides of a game, from the two squads (what the arcade game takes instead of drafted lineups). */
export interface Teams {
  five?: Hooper[];
  bench?: Hooper[];
  rivalFive?: Hooper[];
  rivalBench?: Hooper[];
  offense?: Offense;
  defense?: Defense;
  rivalOffense?: Offense;
  rivalDefense?: Defense;
}

export function teamsOf(sport: UtSport, mine: SquadCards, theirs: SquadCards, seed: string): Teams {
  if (sport === 'nba') {
    const a = fiveOfSquad(mine);
    const b = fiveOfSquad(theirs);
    return { five: a.five, bench: a.bench, rivalFive: b.five, rivalBench: b.bench };
  }
  // depth players (for empty spots) seeded by the squad itself, so both phones make the same ones
  const key = (sq: SquadCards) => seed + ':' + hashString(JSON.stringify(squadToWire(sq)));
  return { offense: offenseOfSquad(mine, key(mine)), defense: defenseOfSquad(mine, key(mine)), rivalOffense: offenseOfSquad(theirs, key(theirs)), rivalDefense: defenseOfSquad(theirs, key(theirs)) };
}
