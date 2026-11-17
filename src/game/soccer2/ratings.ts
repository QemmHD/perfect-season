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
/**
 * The gold window's base half-width on SHOOT (seconds), before openness and the rest (engine.ts
 * shotRing; the ±30 ms floor comes last, v2/perfect.ts, so SHO 60 or less sits on the floor): SHO 70 →
 * 0.039, SHO 85 → 0.051, SHO 95 → 0.062, SHO 99 → 0.066. Narrower and steeper than the 2026-11-02 green
 * (0.028 → 0.085, power 1.1): gold now places the ball exactly, so it must be earned, and the ring shows
 * the rating (V2 B.3.8, plan G3: SHO 95 ≥ 1.5× SHO 70). Claude 2026-11-16, soccer-4.
 */
export function greenHalf(p: SoccerPlayer): number {
  return lin(0.018, 0.066, Math.pow(Math.min(1, rt(p.keeper ? 40 : p.a.SHO)), 1.25) + Math.max(0, rt(p.a.SHO) - 1) * 0.5);
}
/** The range gate (V2 B.3.5): beyond this the ring is red (TOO FAR). SHO 40 → 24 m, SHO 99 → 34 m. */
export function maxRange(p: SoccerPlayer): number {
  return lin(24, 34, rt(p.keeper ? 40 : p.a.SHO));
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
 * logistic around even, bounded to 15-85%. Sprinting with the ball costs the dribbler 6 points of
 * control; the defense's difficulty is worth up to 5. B-2 (Claude 2026-11-16, studio overhaul
 * soccer-5): the logistic's scale went from 11 to 20 points and the bounds from 10-90% to 15-85%, so a
 * 10-point gap is worth about 0.70 (it was 0.83) and a 30-point one about 0.85: better cards win more
 * often, never always (plan P7: 0.55-0.75 at a 10-point gap). The engine multiplies it by the angle
 * and by how exposed the ball is between touches (engine.ts TACKLE).
 */
export const TACKLE_SCALE = 20;
export function tackleWin(def: SoccerPlayer, att: SoccerPlayer, sprinting: boolean, defIQ: number): number {
  const d = 100 * rt(def.a.DEF) + 18 * (rt(def.a.PHY) - 0.5) + 5 * defIQ;
  const c = 100 * rt(att.a.DRI) + 12 * (rt(att.a.PHY) - 0.5) - (sprinting ? 6 : 0);
  return clamp(1 / (1 + Math.exp(-(d - c) / TACKLE_SCALE)), 0.15, 0.85);
}

/* ---------------------------------------------------------------------------------------------
   The man on the ball (Claude 2026-11-16, studio overhaul soccer-5; V2 B.3.4, audit B-1). The ball is
   knocked ahead on touch beats and rolls between them (engine.ts TOUCH), so these say how far and how
   often. */

/** Off the sprint, a man on the ball runs at this share of his top speed (soccer-5; JOG off the ball). */
export const DRIBBLE_JOG = 0.75;
/** One running step (m) at a speed (m/s): about 1.6 m at a jog, 2.1 m at a sprint. Stride rate is
 * speed / this (3.3 steps a second at a jog, 4.3 at a sprint). */
export function strideLen(speed: number): number {
  return clamp(0.9 + 0.13 * speed, 0.95, 2.2);
}
/**
 * A dribble touch: how many strides until the next one, and how far (m) the ball runs out beyond the
 * foot it left (the most it gets ahead of him before he catches it). By pace: a touch every 2 strides
 * and 0.45 m out at a jog (the ball 0.6-1.0 m ahead), every 3-4 and about 1.4 m at a run, every 5-6 and
 * 3.4 m at a sprint (3-5 m ahead); close control (the stick part-way, 0.5-0.85) every 1.5 strides and
 * 0.2 m. DRI shortens it: a DRI 95 touch goes about 0.74x as far as a DRI 60 one (plan G7). `ratio` is
 * his speed as a share of top speed.
 */
export const TOUCH_PACE = { jog: { strides: 2, out: 0.45 }, run: { strides: 3.5, out: 1.4 }, sprint: { strides: 5.5, out: 3.4 }, close: { strides: 1.5, out: 0.2 } };
export function touchScale(p: SoccerPlayer): number {
  return lin(1.2, 0.75, Math.min(1.1, rt(p.a.DRI)));
}
export function touchOf(p: SoccerPlayer, ratio: number, close: boolean): { strides: number; out: number } {
  const k = touchScale(p);
  if (close) return { strides: TOUCH_PACE.close.strides, out: TOUCH_PACE.close.out * k };
  const { jog, run, sprint } = TOUCH_PACE;
  // jog up to 0.78 of top speed, a run at 0.87, a sprint from 0.95
  const u = ratio <= 0.78 ? 0 : ratio >= 0.95 ? 2 : ratio < 0.87 ? (ratio - 0.78) / 0.09 : 1 + (ratio - 0.87) / 0.08;
  const lo = u < 1 ? jog : run;
  const hi = u < 1 ? run : sprint;
  const f = u < 1 ? u : u - 1;
  // a better dribbler touches it a little more often too (fewer strides between touches)
  return { strides: lin(lo.strides, hi.strides, f) * Math.sqrt(k), out: lin(lo.out, hi.out, f) * k };
}
/**
 * How fast he can turn with the ball (rad/s) at a speed: the sideways grip a = lerp(8, 12) m/s² by
 * DRI and PAC, over the speed (a 9 m/s sprinter turns about 1 rad/s, a 5 m/s jogger 2), never slower
 * than 0.8 and free below 2 m/s. A turn of more than 120° at a sprint needs a brake first (engine.ts).
 */
export function turnRate(p: SoccerPlayer, speed: number): number {
  if (speed < 2) return 12;
  const grip = lin(8, 12, Math.min(1, rt(p.a.DRI) * 0.7 + rt(p.a.PAC) * 0.3));
  return Math.max(0.8, grip / speed);
}
/** Body contact while he dribbles: he keeps this share of his pace, by the PHY difference (0.60-0.85). */
export function contactPace(self: SoccerPlayer, other: SoccerPlayer): number {
  return clamp(0.725 + 0.0075 * ((self.a.PHY ?? 60) - (other.a.PHY ?? 60)), 0.6, 0.85);
}
/** A shield (his back to the defender, the ball on the far foot): the defender's chance that one try
 * through him wins it, by the PHY difference and a little DEF (plan G9: a shield holds 2 s in ≥ 60% of
 * tries at PHY +10 and ≤ 35% at PHY −10). */
export function shieldBreak(def: SoccerPlayer, att: SoccerPlayer): number {
  const diff = (att.a.PHY ?? 60) - (def.a.PHY ?? 60) - 0.15 * ((def.a.DEF ?? 60) - 70);
  return clamp(0.78 / (1 + Math.exp(diff / 6.5)), 0.05, 0.75);
}
/**
 * A foul from a mistimed tackle (R-3, soccer-5; it was up to 40%): 2% plus 11% for a poor tackler, 10%
 * from behind, 4% against a good dribbler, less for a sharper defence, bounded 1.5-20%.
 */
export function foulChance(def: SoccerPlayer, att: SoccerPlayer, behind: boolean, defIQ: number): number {
  return clamp(0.02 + 0.11 * (1 - Math.min(1, rt(def.a.DEF))) + (behind ? 0.1 : 0) + 0.04 * rt(att.a.DRI) - 0.05 * defIQ, 0.015, 0.2);
}
/**
 * Skill stars (1-5, plan §5.10; the single source the card faces and TRICK read): DRI 88+ → 5, 80-87 →
 * 4, 70-79 → 3, 60-69 → 2, else 1, for wingers, attacking midfielders and strikers; full-backs and
 * midfielders top out at 4, centre-backs and keepers at 2.
 */
export function skillStars(p: SoccerPlayer): number {
  if (p.keeper) return 1;
  const d = p.a.DRI ?? 0;
  const s = d >= 88 ? 5 : d >= 80 ? 4 : d >= 70 ? 3 : d >= 60 ? 2 : 1;
  const att = p.pos2.some((x) => x === 'W' || x === 'AM' || x === 'ST');
  if (att) return s;
  return Math.min(s, p.pos === 'CB' ? 2 : 4);
}
/** How far a defender reaches for a passing ball (m), and his chance to cut it out at a speed. */
export function interceptReach(p: SoccerPlayer): number {
  return lin(0.55, 1.05, rt(p.keeper ? 60 : p.a.DEF));
}
export function interceptChance(p: SoccerPlayer, speed: number, defIQ: number): number {
  return clamp(0.25 + 0.42 * rt(p.a.DEF) + 0.18 * (1 - speed / 22) + 0.06 * defIQ, 0.1, 0.9);
}
/** A defender's chance to block a shot passing within his body's reach (soccer-4: 0.25 → 0.62 before;
 * a ball struck straight at a body is mostly stopped, and real open play has a quarter of shots blocked). */
export function blockChance(p: SoccerPlayer, wall: boolean): number {
  return wall ? 0.92 : clamp(lin(0.42, 0.8, rt(p.a.DEF)), 0.3, 0.85);
}

/* Keepers. Soccer-4 (Claude 2026-11-16) narrowed the spread of these around a 75 keeper (whose
   numbers barely move) so a 93 keeper is about 20-25% better than an average one, not twice as good
   (research §7.5; plan S5: GK 93 concedes 0.70-0.85× what GK 75 does from the same shots). */
/** Reaction to a strike (s): REF 40 → 0.22, 75 → 0.196, 99 → 0.18. */
export function gkReaction(p: SoccerPlayer): number {
  return Math.max(0.06, lin(0.22, 0.18, rt(p.a.REF)));
}
/** How far his dive carries his body sideways (m) and how long the dive takes (s). */
export function gkDive(p: SoccerPlayer): { reach: number; time: number } {
  return { reach: lin(1.42, 1.64, rt(p.a.DIV)), time: Math.max(0.3, lin(0.53, 0.48, rt(p.a.DIV))) };
}
/** Hands at full stretch beyond his body (m). */
export function gkArm(p: SoccerPlayer): number {
  return lin(0.96, 1.08, rt(p.a.DIV) * 0.5 + rt(p.a.REF) * 0.5);
}
/** Misreading where the shot goes (m, 1 sd): sharp reflexes read it truer. */
export function gkMisread(p: SoccerPlayer): number {
  return Math.max(0.05, lin(0.55, 0.42, rt(p.a.REF)));
}
/** Standing off his angle (m, 1 sd): POS (soccer-4: 1.3 → 0.35 before; 75 barely moves). */
export function gkPositionError(p: SoccerPlayer): number {
  return Math.max(0.05, lin(1.0, 0.5, rt(p.a.POS)));
}
/** Holding a save rather than parrying it: HAN, less for a hard shot or one at full stretch (soccer-4:
 * 0.38 → 0.86 before, narrowed with the other keeper effects). */
export function gkCatch(p: SoccerPlayer, speed: number, stretch: number, high: boolean): number {
  return clamp(lin(0.48, 0.8, rt(p.a.HAN)) - Math.max(0, speed - 16) / 34 - stretch * 0.3 - (high ? 0.12 : 0), 0.05, 0.94);
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
