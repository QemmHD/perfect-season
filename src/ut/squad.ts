// Squads: the slots each sport fills, where they sit on the court or field, the links between
// neighbours that make chemistry, the team overall, and auto-build. See docs/ULTIMATE-TEAM.md.
import type { RatedCard, UtSport } from './types';

export interface SlotDef {
  id: string;
  /** the position it takes; null is any (a basketball bench spot) */
  pos: string | null;
  /** where it sits, in % of the court or that unit's half of the field */
  x: number;
  y: number;
  /** basketball: start / bench; football: off / def (the kicker is with the offense) */
  unit: 'start' | 'bench' | 'off' | 'def';
  /** its share of the team overall */
  weight: number;
}

const s = (id: string, pos: string | null, x: number, y: number, unit: SlotDef['unit'], weight: number): SlotDef => ({ id, pos, x, y, unit, weight });

/** Basketball: five starters on the half court (basket at the top), five on the bench. */
export const NBA_SLOTS: SlotDef[] = [
  s('C', 'C', 50, 13, 'start', 1),
  s('PF', 'PF', 16, 40, 'start', 1),
  s('SF', 'SF', 84, 40, 'start', 1),
  s('SG', 'SG', 24, 82, 'start', 1),
  s('PG', 'PG', 76, 82, 'start', 1),
  s('B1', null, 10, 50, 'bench', 0),
  s('B2', null, 30, 50, 'bench', 0),
  s('B3', null, 50, 50, 'bench', 0),
  s('B4', null, 70, 50, 'bench', 0),
  s('B5', null, 90, 50, 'bench', 0),
];

/**
 * Football: the full 22 and a kicker. Offense attacks up the screen (receivers on the top row, the
 * line, the quarterback, the back); defense faces it (the secondary on top, the line at the bottom).
 */
export const NFL_SLOTS: SlotDef[] = [
  s('WR1', 'WR', 9, 13, 'off', 1),
  s('WR3', 'WR', 30, 17, 'off', 0.9),
  s('TE', 'TE', 70, 17, 'off', 0.8),
  s('WR2', 'WR', 91, 13, 'off', 1),
  s('LT', 'OT', 14, 42, 'off', 0.9),
  s('LG', 'OG', 32, 42, 'off', 0.7),
  s('C', 'C', 50, 42, 'off', 0.7),
  s('RG', 'OG', 68, 42, 'off', 0.7),
  s('RT', 'OT', 86, 42, 'off', 0.9),
  s('QB', 'QB', 50, 67, 'off', 2.2),
  s('RB', 'RB', 50, 90, 'off', 1),
  s('K', 'K', 87, 88, 'off', 0.4),
  s('CB1', 'CB', 9, 14, 'def', 1),
  s('FS', 'S', 34, 14, 'def', 0.8),
  s('SS', 'S', 66, 14, 'def', 0.8),
  s('CB2', 'CB', 91, 14, 'def', 1),
  s('LB1', 'LB', 22, 45, 'def', 0.8),
  s('LB2', 'LB', 50, 45, 'def', 0.8),
  s('LB3', 'LB', 78, 45, 'def', 0.8),
  s('DE1', 'DE', 11, 77, 'def', 1),
  s('DT1', 'DT', 37, 77, 'def', 0.8),
  s('DT2', 'DT', 63, 77, 'def', 0.8),
  s('DE2', 'DE', 89, 77, 'def', 1),
];

/** Neighbours: each pair is a chemistry link (and a line on the court or field). */
export const NBA_LINKS: [string, string][] = [
  ['PG', 'SG'],
  ['SG', 'PF'],
  ['PF', 'C'],
  ['C', 'SF'],
  ['SF', 'PG'],
];

export const NFL_LINKS: [string, string][] = [
  // offense: the line, the tight end and receivers beside it, the quarterback and the back
  ['LT', 'LG'],
  ['LG', 'C'],
  ['C', 'RG'],
  ['RG', 'RT'],
  ['RT', 'TE'],
  ['TE', 'WR2'],
  ['WR1', 'WR3'],
  ['WR3', 'LT'],
  ['QB', 'C'],
  ['QB', 'RB'],
  // defense: the front four, the backers behind them, the secondary behind those
  ['DE1', 'DT1'],
  ['DT1', 'DT2'],
  ['DT2', 'DE2'],
  ['DE1', 'LB1'],
  ['DT1', 'LB2'],
  ['DT2', 'LB2'],
  ['DE2', 'LB3'],
  ['LB1', 'LB2'],
  ['LB2', 'LB3'],
  ['LB1', 'FS'],
  ['LB3', 'SS'],
  ['FS', 'SS'],
  ['CB1', 'FS'],
  ['CB2', 'SS'],
];

export function slotsFor(sport: UtSport): SlotDef[] {
  return sport === 'nba' ? NBA_SLOTS : NFL_SLOTS;
}
export function linksFor(sport: UtSport): [string, string][] {
  return sport === 'nba' ? NBA_LINKS : NFL_LINKS;
}

/** How many of each position a full squad's starters need: the packs draw positions in this mix. */
export function positionMix(sport: UtSport): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sl of slotsFor(sport)) if (sl.pos) out[sl.pos] = (out[sl.pos] ?? 0) + 1;
  return out;
}
export const POSITIONS: Record<UtSport, string[]> = {
  nba: ['PG', 'SG', 'SF', 'PF', 'C'],
  nfl: ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
};

export function canPlay(sl: SlotDef, rc: RatedCard): boolean {
  return sl.pos === null || rc.line.pos.includes(sl.pos);
}

// ---------- chemistry ----------

/** Same franchise +3, same decade +2, same season +4 (so 9 at most). */
export const LINK_POINTS = { franchise: 3, decade: 2, season: 4 };
/** A link this strong counts as full chemistry (same season, or same franchise and decade nearly). */
export const FULL_LINK = 6;
/** Full chemistry adds this much to the team overall. */
export const CHEM_BONUS = 3;

export function linkScore(a: RatedCard, b: RatedCard): number {
  let n = 0;
  if (a.line.fr === b.line.fr) n += LINK_POINTS.franchise;
  if (Math.floor(a.line.season / 10) === Math.floor(b.line.season / 10)) n += LINK_POINTS.decade;
  if (a.line.season === b.line.season) n += LINK_POINTS.season;
  return n;
}

export type Lineup = Record<string, RatedCard | null | undefined>;

export interface LinkInfo {
  a: string;
  b: string;
  score: number;
}

/** Chemistry 0-100: the links' points over FULL_LINK each, capped; an empty end scores nothing. */
export function chemistry(sport: UtSport, lineup: Lineup): { chem: number; links: LinkInfo[] } {
  const links = linksFor(sport).map(([a, b]) => {
    const ca = lineup[a];
    const cb = lineup[b];
    return { a, b, score: ca && cb ? linkScore(ca, cb) : 0 };
  });
  const total = links.reduce((t, l) => t + Math.min(FULL_LINK, l.score), 0);
  return { chem: Math.round((100 * total) / (links.length * FULL_LINK)), links };
}

export interface SquadRating {
  /** the weighted average of the starters (an empty slot counts as 0), plus chemistry's bonus */
  ovr: number;
  /** unrounded, for comparing squads */
  raw: number;
  base: number;
  chem: number;
  links: LinkInfo[];
  filled: number;
  size: number;
  complete: boolean;
}

export function rateSquad(sport: UtSport, lineup: Lineup): SquadRating {
  const slots = slotsFor(sport);
  let w = 0;
  let sum = 0;
  let filled = 0;
  for (const sl of slots) {
    const c = lineup[sl.id];
    if (c) filled++;
    if (!sl.weight) continue;
    w += sl.weight;
    if (c) sum += sl.weight * c.ovr;
  }
  const base = w ? sum / w : 0;
  const { chem, links } = chemistry(sport, lineup);
  const raw = base + (CHEM_BONUS * chem) / 100;
  return { ovr: Math.round(raw), raw, base, chem, links, filled, size: slots.length, complete: filled === slots.length };
}

/** The squad's starters complete (basketball's bench can wait). */
export function startersComplete(sport: UtSport, lineup: Lineup): boolean {
  return slotsFor(sport).every((sl) => sl.weight === 0 || !!lineup[sl.id]);
}

// ---------- auto-build ----------

export interface Candidate {
  uid: string;
  rc: RatedCard;
}

/**
 * The best squad from a club: each slot gets the best card that can play it (the slots with the
 * fewest choices first), then swaps that raise the team overall with chemistry are taken until none
 * does. One player once: two cards of the same man never play together.
 */
export function autoBuild(sport: UtSport, club: Candidate[]): Record<string, string> {
  const slots = slotsFor(sport);
  const ranked = club.slice().sort((a, b) => b.rc.ovr - a.rc.ovr);
  const options = new Map(slots.map((sl) => [sl.id, ranked.filter((c) => canPlay(sl, c.rc))]));
  const order = slots.filter((sl) => sl.weight > 0).sort((a, b) => options.get(a.id)!.length - options.get(b.id)!.length || b.weight - a.weight);
  const pick: Record<string, Candidate> = {};
  const usedPid = new Set<string>();
  const usedUid = new Set<string>();
  for (const sl of order) {
    const c = options.get(sl.id)!.find((x) => !usedPid.has(x.rc.line.pid) && !usedUid.has(x.uid));
    if (!c) continue;
    pick[sl.id] = c;
    usedPid.add(c.rc.line.pid);
    usedUid.add(c.uid);
  }
  const lineupOf = () => Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, v.rc])) as Lineup;
  let best = rateSquad(sport, lineupOf()).raw;
  // improve: try each slot's top few alternatives (chemistry can be worth more than a point of overall)
  for (let pass = 0; pass < 4; pass++) {
    let better = false;
    for (const sl of slots) {
      if (sl.weight === 0) continue;
      const cur = pick[sl.id];
      for (const c of options.get(sl.id)!.slice(0, 14)) {
        if (c === cur || usedUid.has(c.uid) || (usedPid.has(c.rc.line.pid) && cur?.rc.line.pid !== c.rc.line.pid)) continue;
        pick[sl.id] = c;
        const r = rateSquad(sport, lineupOf()).raw;
        if (r > best + 1e-9) {
          best = r;
          if (cur) {
            usedPid.delete(cur.rc.line.pid);
            usedUid.delete(cur.uid);
          }
          usedPid.add(c.rc.line.pid);
          usedUid.add(c.uid);
          better = true;
          break;
        }
        if (cur) pick[sl.id] = cur;
        else delete pick[sl.id];
      }
    }
    if (!better) break;
  }
  // basketball's bench: the best left, any position
  for (const sl of slots.filter((x) => x.weight === 0)) {
    delete pick[sl.id];
    const c = ranked.find((x) => !usedPid.has(x.rc.line.pid) && !usedUid.has(x.uid) && canPlay(sl, x.rc));
    if (!c) continue;
    pick[sl.id] = c;
    usedPid.add(c.rc.line.pid);
    usedUid.add(c.uid);
  }
  return Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, v.uid]));
}
