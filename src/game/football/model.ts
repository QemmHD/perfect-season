// Arcade football: who's on the field and how good each one is at the things the game asks of
// him. Every rating comes from the player's real line: his rank among all lines at his position
// in the data, sharpened by the specific stat that matters (a quarterback's completions for his
// accuracy, a receiver's yards a catch for his speed). Ratings run 0 (the worst line at the spot)
// to 1 (the best).
import { CELLS } from '../../engine/data';
import { DEF_SLOTS, type Lineup, type Player } from '../../engine/types';
import type { Attrs } from '../attrs';

export interface Look {
  /** uniform: jersey, trim (helmet stripe, number outline), pants */
  c1: string;
  c2: string;
  pants: string;
  /** the number on the jersey, or null when no source says which */
  num: number | null;
  /** build: 0.85 (slight) to 1.25 (a lineman) */
  width: number;
  /** height: 0.92 to 1.1 */
  tall: number;
}

export type Role = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'OL' | 'DL' | 'LB' | 'CB' | 'S';

export interface Athlete {
  role: Role;
  name: string;
  /** short name for the screen: "RICE" */
  tag: string;
  /** top speed, yards a second */
  speed: number;
  /** 0-1 */
  hands: number;
  /** 0-1: breaking tackles, and (defense) making them */
  power: number;
  /** 0-1: quarterback only */
  acc: number;
  arm: number;
  poise: number;
  look: Look;
  /** the real player, when there is one */
  player: Player | null;
  /** 0-99 for the lineup card */
  ovr: number;
}

export interface Squad {
  qb: Athlete;
  rb: Athlete;
  wr: Athlete;
  te: Athlete;
  flex: Athlete;
  /** how good the defense is, 0-1 */
  def: number;
  defName: string;
  defLook: Look;
  /** the offensive line, generic */
  ol: Athlete[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

/** each position's lines, sorted by value, to rank a player among them */
const RANKS: Record<string, number[]> = (() => {
  const out: Record<string, number[]> = {};
  for (const c of CELLS)
    for (const p of c.players) {
      const k = p.pos[0];
      (out[k] ??= []).push(p.val);
    }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
  return out;
})();

/** where a line ranks among all lines at its position: 0 the worst, 1 the best */
export function rankOf(p: Player): number {
  const list = RANKS[p.pos[0]];
  if (!list?.length) return 0.5;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (list[m] < p.val) lo = m + 1;
    else hi = m;
  }
  return lo / Math.max(1, list.length - 1);
}

export function tagOf(name: string): string {
  const parts = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ');
  return (parts[parts.length - 1] || name).toUpperCase().slice(0, 9);
}

function lookOf(c1: string, c2: string, a: Attrs | null, base: number): Look {
  const wt = a?.wt ?? null;
  const ht = a?.ht ?? null;
  return {
    c1,
    c2,
    pants: lighten(c2),
    num: a?.num ?? null,
    width: wt ? lerp(0.86, 1.22, (wt - 175) / 95) : base,
    tall: ht ? lerp(0.93, 1.09, (ht - 68) / 10) : 1,
  };
}

/** pants: the trim color, lifted toward white so the legs read against the field */
function lighten(hex: string): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * 0.55);
  return '#' + ((1 << 24) | (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255)).toString(16).slice(1);
}

const perGame = (p: Player, k: string) => p.s[k] ?? 0;

/** A drafted skill player as an athlete. */
export function athlete(p: Player, role: Role, a: Attrs | null): Athlete {
  const rank = rankOf(p);
  const ovr = Math.round(lerp(55, 99, rank));
  const look = lookOf(p.c1, p.c2, a, role === 'TE' ? 1.12 : role === 'RB' ? 1.04 : 0.95);
  const base: Athlete = { role, name: p.name, tag: tagOf(p.name), speed: 7.6, hands: 0.6, power: 0.5, acc: 0.5, arm: 0.5, poise: 0.5, look, player: p, ovr };
  if (role === 'QB') {
    const ypg = perGame(p, 'passYds');
    const cmp = a?.cmp ?? null;
    const ypa = a?.ypa ?? null;
    const intr = a?.intr ?? null;
    // accuracy: completions when we have them, else yards and touchdowns a game
    const acc = cmp !== null ? clamp01((cmp - 0.5) / 0.19) : clamp01((ypg - 140) / 160);
    const arm = ypa !== null ? clamp01((ypa - 5.6) / 2.6) : clamp01((ypg - 150) / 150);
    const poise = intr !== null ? clamp01((0.05 - intr) / 0.035) : clamp01(0.4 + (perGame(p, 'passTd') - perGame(p, 'int')) / 2);
    return { ...base, acc: 0.55 * acc + 0.45 * rank, arm: 0.6 * arm + 0.4 * rank, poise: 0.6 * poise + 0.4 * rank, speed: lerp(5.8, 7.6, clamp01(perGame(p, 'rushYds') / 40)), hands: 0.5, power: 0.35 };
  }
  if (role === 'RB' || (role === 'FLEX' && p.pos[0] === 'RB')) {
    const ypc = a?.ypc ?? null;
    const spd = ypc !== null ? clamp01((ypc - 3.4) / 2.0) : clamp01(perGame(p, 'rushYds') / 110);
    const wt = a?.wt ?? 210;
    const pow = clamp01(0.5 * clamp01((wt - 190) / 45) + 0.5 * clamp01(perGame(p, 'rushTd') / 1.0));
    const recs = a?.rec ?? perGame(p, 'rec');
    return { ...base, speed: lerp(7.4, 9.3, 0.55 * spd + 0.45 * rank), power: 0.5 * pow + 0.5 * rank, hands: lerp(0.45, 0.85, clamp01(recs / 4.5)) };
  }
  // receivers: speed from yards a catch, hands from catch rate (or catches a game)
  const ypr = a?.ypr ?? (perGame(p, 'rec') > 0.5 ? perGame(p, 'recYds') / perGame(p, 'rec') : 11);
  const isTe = p.pos[0] === 'TE';
  const spd = clamp01((ypr - (isTe ? 8 : 10)) / 8);
  const cr = a?.cr ?? null;
  const hands = cr !== null ? clamp01((cr - 0.5) / 0.25) : clamp01((perGame(p, 'rec') - 1.5) / 5);
  return {
    ...base,
    speed: lerp(isTe ? 7.1 : 7.7, isTe ? 8.5 : 9.4, 0.55 * spd + 0.45 * rank),
    hands: lerp(0.55, 0.97, 0.55 * hands + 0.45 * rank),
    power: isTe ? lerp(0.5, 0.8, rank) : lerp(0.25, 0.55, rank),
  };
}

function generic(role: Role, c1: string, c2: string, i: number, quality: number): Athlete {
  const big = role === 'OL' || role === 'DL';
  const look: Look = { c1, c2, pants: lighten(c2), num: big ? 60 + ((i * 7) % 20) : role === 'LB' ? 50 + i : 20 + i * 3, width: big ? 1.24 : role === 'LB' ? 1.08 : 0.95, tall: big ? 1.05 : 1 };
  const speed = role === 'DL' ? lerp(6.1, 7.0, quality) : role === 'OL' ? 5.4 : role === 'LB' ? lerp(7.5, 8.3, quality) : lerp(8.5, 9.3, quality);
  return { role, name: role, tag: role, speed, hands: lerp(0.35, 0.7, quality), power: lerp(0.45, 0.85, quality), acc: 0, arm: 0, poise: 0, look, player: null, ovr: 0 };
}

/** A lineup's drafted defenders: its DL, LB and DB. */
export function defendersOf(lineup: Lineup): Player[] {
  return DEF_SLOTS.map((k) => lineup[k]).filter((p): p is Player => !!p);
}

/**
 * How good a drafted defense is, 0-1: its defenders' average rank, each among all lines at his
 * spot. (An adapter until the game's defense is made of the real defenders: the rebuild.)
 */
export function defenseOf(defs: Player[]): number {
  return defs.length ? defs.reduce((a, p) => a + rankOf(p), 0) / defs.length : 0.5;
}

/** The defense's colors: its best defender's team. */
export function defenseColors(defs: Player[]): { c1: string; c2: string; abbr: string } | null {
  const best = defs.slice().sort((a, b) => b.val - a.val)[0];
  return best ? { c1: best.c1, c2: best.c2, abbr: best.abbr } : null;
}

export function squadOf(lineup: Lineup, rivalDefense: Player[], attrs: (p: Player) => Attrs | null): Squad {
  const pick = (k: string) => lineup[k] as Player;
  const flexP = pick('FLEX');
  const team = pick('QB');
  const ol = [0, 1, 2].map((i) => generic('OL', team.c1, team.c2, i, 0.5));
  const look = defenseColors(rivalDefense);
  return {
    qb: athlete(pick('QB'), 'QB', attrs(pick('QB'))),
    rb: athlete(pick('RB'), 'RB', attrs(pick('RB'))),
    wr: athlete(pick('WR'), 'WR', attrs(pick('WR'))),
    te: athlete(pick('TE'), 'TE', attrs(pick('TE'))),
    flex: athlete(flexP, 'FLEX', attrs(flexP)),
    def: defenseOf(rivalDefense),
    defName: 'Defense',
    defLook: { c1: look?.c1 ?? '#444', c2: look?.c2 ?? '#ddd', pants: lighten(look?.c2 ?? '#ddd'), num: null, width: 1, tall: 1 },
    ol,
  };
}

/** The eight defenders: three linemen, a linebacker, two corners, two safeties. */
export function defenders(s: Squad): Athlete[] {
  const { c1, c2 } = s.defLook;
  const q = s.def;
  return [
    generic('DL', c1, c2, 0, q),
    generic('DL', c1, c2, 1, q),
    generic('DL', c1, c2, 2, q),
    generic('LB', c1, c2, 3, q),
    generic('CB', c1, c2, 4, q),
    generic('CB', c1, c2, 5, q),
    generic('S', c1, c2, 6, q),
    generic('S', c1, c2, 7, q),
  ];
}
