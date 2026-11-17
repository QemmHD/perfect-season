// Soccer v2: card face stats → gameplay numbers. Implemented by Claude (Anthropic), 2026-11-01.
// Every effect is a bounded lerp between two marks of a rating (40-99): a 99 gets the best mark, a
// promo above 99 a little more (at most 11 points, about +10% of the range), so nothing runs away
// and every number stays finite. The card file (src/data/cards-soccer.json) carries the six face
// stats per line; this file reads them and turns them into players and elevens.
import type { SoccerPlayer, SoccerPos, Squad } from './types';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** a rating as 0-1 between two marks, plus a capped bonus past 99 (finite for any number) */
export function rt(v: number | undefined, lo = 40, hi = 99): number {
  const x = Number.isFinite(v) ? (v as number) : 60;
  return clamp((x - lo) / (hi - lo), 0, 1) + (x > 99 ? Math.min(11, x - 99) * 0.009 : 0);
}
/** a to b by t (t can pass 1 by the past-99 bonus) */
const lin = (a: number, b: number, t: number) => a + (b - a) * t;

const POSITIONS: SoccerPos[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
export const OUT_KEYS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;
export const GK_KEYS = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] as const;

/** One card line as the card file has it (season, promo or legend edition). */
export interface SoccerCardLine {
  pid: string;
  name: string;
  /** 'W/ST' */
  pos: string;
  ovr: number;
  /** six face stats, in OUT or GK key order */
  face: number[];
  /** centimetres */
  ht: number | null;
  num: number | null;
  season: number;
  fr: string;
  abbr: string;
  teamName: string;
  c1: string;
  c2: string;
  label?: string;
}

/** A short name for the tag: the surname, or the one name (Neymar, Rodri). */
function tagOf(name: string): string {
  const parts = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z' .-]/g, '')
    .trim()
    .split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return (last.length <= 2 && parts.length > 1 ? parts.slice(-2).join(' ') : last).toUpperCase().slice(0, 11);
}

/** Rate a card line for the arcade match: the face stats as they are (bounded effects come later). */
export function rateSoccerLine(l: SoccerCardLine, boost = 0): SoccerPlayer {
  const pos2 = l.pos.split('/').filter((p): p is SoccerPos => (POSITIONS as string[]).includes(p));
  const pos = pos2[0] ?? 'CM';
  const keeper = pos === 'GK';
  const keys = keeper ? GK_KEYS : OUT_KEYS;
  const a: Record<string, number> = {};
  keys.forEach((k, i) => {
    const v = Number(l.face[i]);
    a[k] = Number.isFinite(v) ? clamp(v + boost, 1, 130) : 60;
  });
  return { id: l.pid + ':' + l.season + ':' + l.fr, name: l.name, tag: tagOf(l.name), num: l.num, ht: l.ht && Number.isFinite(l.ht) ? clamp(l.ht, 155, 205) : 181, pos, pos2: pos2.length ? pos2 : [pos], ovr: l.ovr + boost, a, keeper };
}

/* ---------------------------------------------------------------------------------------------
   What the ratings do on the pitch. Each is exported so the docs table and the tests measure the
   same numbers the engine uses. */

/** Top speed, m/s: PAC 40 → 6.8, PAC 99 → 9.4 (a keeper's SPD: 5.6 → 7.6). */
export function topSpeed(p: SoccerPlayer): number {
  return p.keeper ? lin(5.6, 7.6, rt(p.a.SPD)) : lin(6.8, 9.4, rt(p.a.PAC));
}
/** Off the sprint he runs at this share of top speed. */
export const JOG = 0.8;
/** With the ball at his feet: a good dribbler loses less pace (0.88 → 0.97). */
export function dribblePace(p: SoccerPlayer): number {
  return Math.min(0.99, lin(0.88, 0.97, rt(p.a.DRI)));
}
/** Acceleration (m/s²): quick feet and pace. */
export function accelOf(p: SoccerPlayer): number {
  return p.keeper ? lin(9, 13, rt(p.a.SPD)) : lin(9, 15, rt(p.a.PAC) * 0.6 + rt(p.a.DRI) * 0.4);
}
/** A pass's direction error, degrees (1 sd): PAS 40 → 7°, PAS 99 → 1.5°. */
export function passError(p: SoccerPlayer): number {
  return Math.max(0.5, lin(7, 1.5, rt(p.keeper ? p.a.KIC : p.a.PAS)));
}
/** A shot's error cone, degrees (1 sd) on a green release: SHO 40 → 5.5°, SHO 99 → 1.6°. */
export function shotCone(p: SoccerPlayer): number {
  return Math.max(0.4, lin(5.5, 1.6, rt(p.keeper ? 40 : p.a.SHO)));
}
/** Half the green window on the power meter (seconds): SHO 40 → 0.028, SHO 99 → 0.085. */
export function greenHalf(p: SoccerPlayer): number {
  return lin(0.028, 0.085, Math.pow(Math.min(1, rt(p.keeper ? 40 : p.a.SHO)), 1.1) + Math.max(0, rt(p.a.SHO) - 1) * 0.5);
}
/** A struck shot's speed at full power (m/s): SHO and PHY, 21 → 31. */
export function shotSpeed(p: SoccerPlayer): number {
  return p.keeper ? 22 : lin(21, 31, rt(p.a.SHO) * 0.7 + rt(p.a.PHY) * 0.3);
}
/** A header's speed (m/s) and how high he gets (m, the top of his head at the jump). */
export function headerSpeed(p: SoccerPlayer): number {
  return lin(10, 17, rt(p.a.PHY) * 0.5 + rt(p.a.SHO) * 0.5);
}
export function jumpReach(p: SoccerPlayer, htCm = p.ht): number {
  return htCm / 100 + lin(0.35, 0.75, rt(p.a.PHY));
}

/**
 * A tackle's chance to win the ball: DEF (and a little PHY) against DRI (and a little PHY), a
 * logistic around even, bounded to 10-90%. Sprinting with the ball costs the dribbler 6 points of
 * control; the defense's difficulty is worth up to 5.
 */
export function tackleWin(def: SoccerPlayer, att: SoccerPlayer, sprinting: boolean, defIQ: number): number {
  const d = 100 * rt(def.a.DEF) + 18 * (rt(def.a.PHY) - 0.5) + 5 * defIQ;
  const c = 100 * rt(att.a.DRI) + 12 * (rt(att.a.PHY) - 0.5) - (sprinting ? 6 : 0);
  return clamp(1 / (1 + Math.exp(-(d - c) / 11)), 0.1, 0.9);
}
/** How far a defender reaches for a passing ball (m), and his chance to cut it out at a speed. */
export function interceptReach(p: SoccerPlayer): number {
  return lin(0.55, 1.05, rt(p.keeper ? 60 : p.a.DEF));
}
export function interceptChance(p: SoccerPlayer, speed: number, defIQ: number): number {
  return clamp(0.25 + 0.42 * rt(p.a.DEF) + 0.18 * (1 - speed / 22) + 0.06 * defIQ, 0.1, 0.9);
}
/** A defender's chance to block a shot passing within his body's reach. */
export function blockChance(p: SoccerPlayer, wall: boolean): number {
  return wall ? 0.92 : clamp(lin(0.25, 0.62, rt(p.a.DEF)), 0.15, 0.7);
}

/** Keepers. Reaction to a strike (s): REF 40 → 0.30, 99 → 0.12. */
export function gkReaction(p: SoccerPlayer): number {
  return Math.max(0.06, lin(0.3, 0.12, rt(p.a.REF)));
}
/** How far his dive carries his body sideways (m) and how long the dive takes (s). */
export function gkDive(p: SoccerPlayer): { reach: number; time: number } {
  return { reach: lin(1.05, 1.85, rt(p.a.DIV)), time: Math.max(0.3, lin(0.6, 0.42, rt(p.a.DIV))) };
}
/** Hands at full stretch beyond his body (m). */
export function gkArm(p: SoccerPlayer): number {
  return lin(0.85, 1.15, rt(p.a.DIV) * 0.5 + rt(p.a.REF) * 0.5);
}
/** Misreading where the shot goes (m, 1 sd): sharp reflexes read it truer. */
export function gkMisread(p: SoccerPlayer): number {
  return Math.max(0.05, lin(0.7, 0.3, rt(p.a.REF)));
}
/** Standing off his angle (m, 1 sd): POS. */
export function gkPositionError(p: SoccerPlayer): number {
  return Math.max(0.05, lin(1.3, 0.35, rt(p.a.POS)));
}
/** Holding a save rather than parrying it: HAN, less for a hard shot or one at full stretch. */
export function gkCatch(p: SoccerPlayer, speed: number, stretch: number, high: boolean): number {
  return clamp(lin(0.38, 0.86, rt(p.a.HAN)) - Math.max(0, speed - 16) / 34 - stretch * 0.3 - (high ? 0.12 : 0), 0.05, 0.94);
}
/** Guessing a penalty right (going the way it's struck). */
export function gkPenaltyRead(p: SoccerPlayer): number {
  return clamp(lin(0.36, 0.5, rt(p.a.REF) * 0.6 + rt(p.a.POS) * 0.4), 0.3, 0.56);
}
/** Coming off his line to smother a one-on-one: SPD and DIV against the dribbler. */
export function gkSmother(gk: SoccerPlayer, att: SoccerPlayer): number {
  return clamp(0.45 + 0.35 * (rt(gk.a.SPD) * 0.5 + rt(gk.a.DIV) * 0.5) - 0.3 * rt(att.a.DRI), 0.12, 0.8);
}

/* ---------------------------------------------------------------------------------------------
   Card file → lines → elevens */

/** The parts of cards-soccer.json this reads (see docs/SOCCER-DATA.md). */
export interface SoccerCardsFile {
  n: number;
  players: [string, string, number | null, number | null][];
  teams: [string, string, string, string, string][];
  cols: { player: number[]; season: number[]; team: number[]; pos: string[]; num: (number | null)[]; ovr: number[]; face: number[][] };
  promos: [number, number, string, number, number[]][];
  legends: [number, number, string, number, number[]][];
}

/** Every season line of the file (index i is line i), with promos and legends as their own lines. */
export function soccerLines(f: SoccerCardsFile): { seasons: SoccerCardLine[]; specials: SoccerCardLine[] } {
  const c = f.cols;
  const seasons: SoccerCardLine[] = [];
  for (let i = 0; i < f.n; i++) {
    const [pid, name, ht] = f.players[c.player[i]];
    const [fr, abbr, teamName, c1, c2] = f.teams[c.team[i]];
    seasons.push({ pid, name, pos: c.pos[i], ovr: c.ovr[i], face: c.face[i], ht, num: c.num[i], season: c.season[i], fr, abbr, teamName, c1, c2 });
  }
  const specials = [...f.promos, ...f.legends].map(([line, , label, ovr, face]) => ({ ...seasons[line], ovr, face, label }));
  return { seasons, specials };
}

const fits = (p: SoccerPlayer, pos: SoccerPos[]) => p.pos2.some((x) => pos.includes(x));

/**
 * The best 4-3-3 a club had in a season: the top keeper, two centre-backs, two full-backs, a holder,
 * two more midfielders, two wingers and a striker, each by overall from players listed there (a
 * gap is filled from the nearest position).
 */
export function squadFrom(players: SoccerPlayer[], info: { name: string; abbr: string; c1: string; c2: string }): Squad {
  const pool = [...players].sort((a, b) => b.ovr - a.ovr);
  const used = new Set<string>();
  const take = (want: SoccerPos[], fallback: SoccerPos[]): SoccerPlayer => {
    const pick = pool.find((p) => !used.has(p.id) && fits(p, want)) ?? pool.find((p) => !used.has(p.id) && fits(p, fallback)) ?? pool.find((p) => !used.has(p.id) && !p.keeper) ?? pool.find((p) => !used.has(p.id));
    if (!pick) throw new Error('squadFrom: not enough players for ' + info.abbr);
    used.add(pick.id);
    return pick;
  };
  const gk = take(['GK'], ['GK']);
  const cb1 = take(['CB'], ['DM', 'FB']);
  const cb2 = take(['CB'], ['DM', 'FB']);
  const fb1 = take(['FB'], ['CB', 'W', 'DM']);
  const fb2 = take(['FB'], ['CB', 'W', 'DM']);
  const st = take(['ST'], ['W', 'AM']);
  const w1 = take(['W'], ['AM', 'ST']);
  const w2 = take(['W'], ['AM', 'ST', 'FB']);
  const dm = take(['DM'], ['CM']);
  const cm1 = take(['CM', 'AM'], ['DM', 'W']);
  const cm2 = take(['CM', 'AM', 'DM'], ['W', 'ST', 'FB']);
  return { ...info, gk, def: [fb1, cb1, cb2, fb2], mid: [cm1, dm, cm2], fwd: [w1, st, w2] };
}

/** A club's eleven for one season from the card lines (the season lines only). */
export function clubSquad(lines: SoccerCardLine[], fr: string, season: number): Squad {
  const mine = lines.filter((l) => l.fr === fr && l.season === season);
  if (mine.length < 11) throw new Error('clubSquad: ' + fr + ' ' + season + ' has ' + mine.length + ' lines');
  const first = mine[0];
  return squadFrom(
    mine.map((l) => rateSoccerLine(l)),
    { name: first.teamName, abbr: first.abbr, c1: first.c1, c2: first.c2 }
  );
}

/** The eleven, outfielders first, then the keeper. */
export function elevenOf(s: Squad): SoccerPlayer[] {
  return [...s.def, ...s.mid, ...s.fwd, s.gk];
}

/** A team's overall: the mean of its eleven (shootout tiebreaks and the AI's planning). */
export function squadOvr(s: Squad): number {
  const xi = elevenOf(s);
  return xi.reduce((a, p) => a + p.ovr, 0) / xi.length;
}
