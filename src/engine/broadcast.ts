// A playoff game told as it happens: the scoring, who did it, the clock and the win probability.
// Pure presentation. The engine has already decided who won (and, in football, the final score);
// this only writes a game that agrees with it, seeded so the same game always tells the same way.
import { type Rand, hashString, rng } from './rng';
import { NFL } from './sport';
import type { Lineup, OppPlayer, Player, PlayoffTeam } from './types';
import { SLOTS } from './types';

export type Side = 'us' | 'them';

export interface CastEvent {
  /** game time, 0 (kickoff, tip-off) to 1 (the final whistle) */
  t: number;
  /** 1-4 */
  period: number;
  /** time left in the period, "8:42" */
  clock: string;
  side: Side | null;
  pts: number;
  /** the score after this play */
  us: number;
  them: number;
  text: string;
  /** a play worth a headline: a touchdown, a three, a dunk, a pick */
  big: boolean;
  /** a play that put a side ahead for good, late */
  clutch?: boolean;
  /** our win probability after the play, 0-1 */
  wp: number;
}

export interface StarLine {
  side: Side;
  name: string;
  line: string;
}

export interface GameCast {
  us: number;
  them: number;
  won: boolean;
  /** points per period, ours then theirs */
  periods: [number, number][];
  /** every scoring play (basketball: every basket), in order; `big` ones make the play-by-play */
  events: CastEvent[];
  /** the win probability through the game, for the chart: [t, wp] */
  wp: [number, number][];
  /** player of the game, and the other side's best */
  stars: StarLine[];
}

const PERIOD_MIN = NFL ? 15 : 12;
/** spread of a game's final margin around what was expected, in points (Stern's model) */
const SIGMA = NFL ? 13.45 : 11.5;

// ---------- small maths ----------

function erf(x: number): number {
  // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
function phiInv(p: number): number {
  // bisection is plenty here
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Our chance to win with `lead` points at game time t, for a game we were expected to win with
 * probability `pre` (the margin is a random walk: what's left of it is spread like the rest of
 * the game).
 */
export function winProb(lead: number, t: number, pre: number): number {
  const rem = Math.max(0, 1 - t);
  if (rem < 1e-4) return lead > 0 ? 1 : lead < 0 ? 0 : 0.5;
  const mu = phiInv(Math.min(0.995, Math.max(0.005, pre))) * SIGMA;
  return phi((lead + mu * rem) / (SIGMA * Math.sqrt(rem)));
}

function pick<T>(xs: T[], rand: Rand): T {
  return xs[Math.floor(rand() * xs.length)];
}

function weighted<T>(xs: T[], w: (x: T) => number, rand: Rand): T {
  const ws = xs.map((x) => Math.max(0, w(x)));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(xs, rand);
  let r = rand() * total;
  for (let i = 0; i < xs.length; i++) {
    r -= ws[i];
    if (r <= 0) return xs[i];
  }
  return xs[xs.length - 1];
}

function clockOf(t: number): { period: number; clock: string } {
  const period = Math.min(4, Math.floor(t * 4) + 1);
  const left = Math.max(0, (period - t * 4) * PERIOD_MIN);
  const m = Math.floor(left);
  const s = Math.min(59, Math.round((left - m) * 60));
  return { period, clock: m + ':' + String(s).padStart(2, '0') };
}

/** A last name for the play-by-play: "Rice", "St. Brown", a defense by its team ("Steelers"). */
function short(name: string): string {
  if (/ Defense$/.test(name)) return name.replace(/ Defense$/, '');
  const parts = name.replace(/\s*\([^)]*\)\s*$/, '').split(' ');
  let i = parts.length - 1;
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/.test(parts[i]) && i > 1) i--;
  const before = parts[i - 1];
  return i > 1 && /^(St\.|Van|van|De|Del|La|Le|Du|Da|Di|Mac)$/.test(before) ? before + ' ' + parts[i] : parts[i];
}

// ---------- the score, split into plays ----------

/** Football points as scoring plays: mostly touchdowns (7) and field goals (3). */
export function footballPlays(points: number): number[] {
  // fewest plays, touchdowns first; 6 (missed extra point), 8 (two-point try) and 2 (safety) when needed
  const cost: Record<number, number> = { 7: 1, 3: 1.15, 6: 1.7, 8: 1.7, 2: 3 };
  const best: (number[] | null)[] = [[]];
  for (let p = 1; p <= points; p++) {
    let choice: number[] | null = null;
    let c = Infinity;
    for (const v of [7, 3, 6, 8, 2]) {
      const prev = p - v >= 0 ? best[p - v] : null;
      if (!prev) continue;
      const pc = prev.reduce((a, x) => a + cost[x], 0) + cost[v];
      if (pc < c) {
        c = pc;
        choice = prev.concat([v]);
      }
    }
    best.push(choice);
  }
  return best[points] ?? [];
}

/** Basketball points as baskets: twos, threes and free throws. */
function basketballPlays(points: number, rand: Rand): number[] {
  const out: number[] = [];
  let left = points;
  while (left > 0) {
    if (left <= 3) {
      out.push(left);
      break;
    }
    const r = rand();
    const v = r < 0.6 ? 2 : r < 0.85 ? 3 : 1;
    out.push(v);
    left -= v;
  }
  return out;
}

/** A basketball game's score that agrees with its result. */
export function basketballScore(won: boolean, pre: number, rand: Rand): [number, number] {
  const total = Math.round(206 + (rand() - 0.5) * 34);
  const expected = phiInv(Math.min(0.99, Math.max(0.01, pre))) * SIGMA;
  // how much a winner wins by: around the expectation, never zero
  let margin = Math.abs(Math.round(expected * (won ? 1 : -1) * 0.6 + (rand() - 0.5) * 2 * 14));
  if (margin < 1) margin = 1 + Math.floor(rand() * 4);
  margin = Math.min(margin, 38);
  const hi = Math.round((total + margin) / 2);
  const lo = hi - margin;
  return won ? [hi, lo] : [lo, hi];
}

// ---------- who did it ----------

interface Cast {
  /** football */
  qb?: string;
  backs: { name: string; w: number }[];
  catchers: { name: string; w: number }[];
  defense?: string;
  /** basketball: everyone, weighted by scoring, with their position */
  scorers: { name: string; w: number; pos: string; three: number }[];
}

function ourCast(lineup: Lineup): Cast {
  const ps = SLOTS.map((k) => lineup[k]).filter(Boolean) as Player[];
  if (!NFL) return { backs: [], catchers: [], scorers: ps.map((p) => ({ name: p.name, w: p.s.pts ?? 10, pos: p.pos[0], three: /G/.test(p.pos[0]) ? 0.45 : p.pos[0] === 'SF' ? 0.35 : 0.15 })) };
  const qb = ps.find((p) => p.pos[0] === 'QB');
  const def = ps.find((p) => p.pos[0] === 'DEF');
  const skill = ps.filter((p) => p.pos[0] !== 'QB' && p.pos[0] !== 'DEF');
  return {
    qb: qb?.name,
    defense: def?.name,
    backs: [...(qb ? [{ name: qb.name, w: (qb.s.rushTd ?? 0) + 0.02 }] : []), ...skill.map((p) => ({ name: p.name, w: (p.s.rushTd ?? 0) + (p.pos[0] === 'RB' ? 0.1 : 0) }))],
    catchers: skill.map((p) => ({ name: p.name, w: (p.s.recTd ?? 0) + (p.s.recYds ?? 0) / 400 })),
    scorers: [],
  };
}

function theirCast(opp: PlayoffTeam): Cast {
  const five: OppPlayer[] = opp.five;
  if (!NFL) return { backs: [], catchers: [], scorers: five.map((p) => ({ name: p.name, w: p.s.pts ?? 10, pos: p.pos, three: /G/.test(p.pos) ? 0.45 : p.pos === 'SF' ? 0.35 : 0.15 })) };
  const qb = five.find((p) => p.pos === 'QB');
  const rest = five.filter((p) => p.pos !== 'QB');
  return {
    qb: qb?.name,
    backs: [...(qb ? [{ name: qb.name, w: (qb.s.rushTd ?? 0) + 0.02 }] : []), ...rest.map((p) => ({ name: p.name, w: (p.s.rushTd ?? 0) + (p.pos === 'RB' ? 0.1 : 0) }))],
    catchers: rest.map((p) => ({ name: p.name, w: (p.s.recTd ?? 0) + (p.s.recYds ?? 0) / 400 })),
    scorers: [],
  };
}

/** A play's yards: short ones are common, long ones rare. */
function yards(rand: Rand, max = 80): number {
  return Math.max(1, Math.min(max, Math.round(1 + Math.pow(rand(), 2.2) * max)));
}

interface Credit {
  name: string;
  side: Side;
  td: number;
  yds: number;
  passTd: number;
}

function footballText(side: Side, v: number, c: Cast, rand: Rand, credit: (name: string, f: Partial<Credit>) => void): { text: string; big: boolean } {
  if (v === 3) {
    const d = 22 + Math.floor(rand() * 32);
    return { text: (side === 'us' ? 'Field goal' : 'Their field goal') + ' from ' + d + ' yards', big: false };
  }
  if (v === 2) return { text: side === 'us' && c.defense ? short(c.defense) + ' sack in the end zone: safety' : 'Safety', big: true };
  const tail = v === 8 ? ', and the two-point try is good' : v === 6 ? ' (the extra point is no good)' : '';
  // our defense scores now and then
  if (side === 'us' && c.defense && rand() < 0.08) {
    const d = yards(rand, 90);
    credit(c.defense, { td: 1 });
    return { text: short(c.defense) + ' pick-six: ' + d + ' yards the other way' + tail, big: true };
  }
  const passing = c.qb && c.catchers.length && rand() < 0.62;
  if (passing) {
    const to = weighted(c.catchers, (x) => x.w, rand);
    const d = yards(rand, 75);
    credit(to.name, { td: 1, yds: d });
    credit(c.qb!, { passTd: 1, yds: d });
    const t = rand() < 0.5 ? short(c.qb!) + ' finds ' + short(to.name) + ' for a ' + d + '-yard touchdown' : short(to.name) + ' hauls in a ' + d + '-yard TD from ' + short(c.qb!);
    return { text: t + tail, big: true };
  }
  const back = c.backs.length ? weighted(c.backs, (x) => x.w, rand) : null;
  const d = yards(rand, 60);
  if (back) credit(back.name, { td: 1, yds: d });
  const who = back ? short(back.name) : side === 'us' ? 'Your offense' : 'They';
  const t = d >= 20 ? who + ' breaks loose: ' + d + '-yard touchdown run' : who + ' punches it in from ' + d + (d === 1 ? ' yard' : ' yards');
  return { text: t + tail, big: true };
}

const DUNK = ['throws it down', 'with the slam', 'hammers home the dunk', 'finishes at the rim'];
const TWO = ['pull-up jumper', 'drives for two', 'scores in the post', 'hits the baseline jumper', 'floater drops'];
const THREE = ['buries a three', 'from way downtown', 'drains the corner three', 'hits the step-back three'];

function basketballText(v: number, c: Cast, rand: Rand, credit: (name: string, pts: number) => void): { text: string; big: boolean } {
  const shooter = weighted(c.scorers, (x) => x.w * (v === 3 ? x.three * 2 : 1), rand);
  credit(shooter.name, v);
  const n = short(shooter.name);
  if (v === 3) return { text: n + ' ' + pick(THREE, rand), big: true };
  if (v === 1) return { text: n + ' at the line', big: false };
  if (/C|PF/.test(shooter.pos) && rand() < 0.4) return { text: n + ' ' + pick(DUNK, rand), big: true };
  return { text: n + ' ' + pick(TWO, rand), big: rand() < 0.25 };
}

// ---------- the game ----------

/**
 * Tell one game. `us` and `them` are the final score (football: the engine's; basketball: pass
 * null and one is made up from the result). `pre` is our pregame chance to win.
 */
export function castGame(input: { lineup: Lineup; opp: PlayoffTeam; won: boolean; score?: [number, number] | null; pre: number; seed: string }): GameCast {
  const rand = rng(hashString('cast:' + input.seed));
  const [us, them] = input.score ?? basketballScore(input.won, input.pre, rand);
  const ours = ourCast(input.lineup);
  const theirs = theirCast(input.opp);
  const credits = new Map<string, Credit>();
  const credit = (side: Side) => (name: string, f: Partial<Credit>) => {
    const key = side + ':' + name;
    const c = credits.get(key) ?? { name, side, td: 0, yds: 0, passTd: 0 };
    c.td += f.td ?? 0;
    c.yds += f.yds ?? 0;
    c.passTd += f.passTd ?? 0;
    credits.set(key, c);
  };

  // each side's plays, at random moments
  const plays: { side: Side; v: number; t: number }[] = [];
  for (const side of ['us', 'them'] as Side[]) {
    const pts = side === 'us' ? us : them;
    const vs = NFL ? footballPlays(pts) : basketballPlays(pts, rand);
    for (const v of vs) plays.push({ side, v, t: 0.004 + rand() * 0.988 });
  }
  plays.sort((a, b) => a.t - b.t);

  // a close game is decided late: the winner's last score comes at the end, from behind
  const margin = Math.abs(us - them);
  const winner: Side = us > them ? 'us' : 'them';
  const closeEnough = NFL ? margin <= 8 : margin <= 3;
  let clutchAt = -1;
  if (closeEnough) {
    const idx = plays.map((p, i) => ({ p, i })).filter(({ p }) => p.side === winner && p.v >= margin);
    if (idx.length) {
      const chosen = idx[Math.floor(rand() * idx.length)].i;
      const [moved] = plays.splice(chosen, 1);
      const lastT = plays.reduce((m, p) => Math.max(m, p.t), 0);
      moved.t = Math.min(0.999, Math.max(lastT + 0.002, NFL ? 0.975 + rand() * 0.02 : 0.992 + rand() * 0.006));
      plays.push(moved);
      plays.sort((a, b) => a.t - b.t);
      clutchAt = plays.indexOf(moved);
    }
  }

  const events: CastEvent[] = [];
  const periods: [number, number][] = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  let a = 0;
  let b = 0;
  const wp: [number, number][] = [[0, input.pre]];
  plays.forEach((p, i) => {
    if (p.side === 'us') a += p.v;
    else b += p.v;
    const { period, clock } = clockOf(p.t);
    periods[period - 1][p.side === 'us' ? 0 : 1] += p.v;
    const c = p.side === 'us' ? ours : theirs;
    const said = NFL ? footballText(p.side, p.v, c, rand, credit(p.side)) : basketballText(p.v, c, rand, (name, pts) => credit(p.side)(name, { td: pts }));
    const w = winProb(a - b, p.t, input.pre);
    events.push({ t: p.t, period, clock, side: p.side, pts: p.v, us: a, them: b, text: said.text, big: said.big || i === clutchAt, clutch: i === clutchAt || undefined, wp: w });
    wp.push([p.t, w]);
  });
  wp.push([1, us > them ? 1 : 0]);

  // basketball runs: a side scoring 9+ unanswered gets a line in the play-by-play
  if (!NFL) {
    let run: Side | null = null;
    let runPts = 0;
    let told = false;
    for (const e of events) {
      if (e.side === run) runPts += e.pts;
      else {
        run = e.side;
        runPts = e.pts;
        told = false;
      }
      if (runPts >= 9 && !told && !e.clutch) {
        e.big = true;
        e.text = (e.side === 'us' ? 'Your team' : input.opp.team.split(' ').pop()) + ' on a ' + runPts + '-0 run. ' + e.text;
        told = true;
      }
    }
  }

  return { us, them, won: us > them, periods, events, wp, stars: stars(input, us, them, credits, rand) };
}

function stars(input: { lineup: Lineup; opp: PlayoffTeam }, us: number, them: number, credits: Map<string, Credit>, rand: Rand): StarLine[] {
  const out: StarLine[] = [];
  for (const side of ['us', 'them'] as Side[]) {
    const mine = [...credits.values()].filter((c) => c.side === side);
    if (NFL) {
      // most touchdowns, then most yards
      const best = mine.sort((x, y) => y.td + y.passTd - (x.td + x.passTd) || y.yds - x.yds)[0];
      if (!best) continue;
      const p = side === 'us' ? (SLOTS.map((k) => input.lineup[k]).find((q) => q?.name === best.name) ?? null) : null;
      const o = side === 'them' ? input.opp.five.find((q) => q.name === best.name) : null;
      const s = p?.s ?? o?.s ?? {};
      const f = 0.85 + rand() * 0.6;
      let line: string;
      if (p && p.pos[0] === 'DEF') line = best.td + ' defensive TD';
      else if (best.passTd > 0 && (s.passYds ?? 0) > 0) line = Math.round((s.passYds ?? 0) * f + best.yds * 0.3) + ' pass yds, ' + best.passTd + ' TD' + (best.td ? ', ' + best.td + ' rush TD' : '');
      else if ((s.recYds ?? 0) >= (s.rushYds ?? 0)) line = Math.max(1, Math.round((s.rec ?? 3) * f)) + ' rec, ' + Math.round((s.recYds ?? 40) * f + best.yds * 0.5) + ' yds, ' + best.td + ' TD';
      else line = Math.round((s.rushYds ?? 50) * f + best.yds * 0.4) + ' rush yds, ' + best.td + ' TD';
      out.push({ side, name: best.name, line });
    } else {
      const total = side === 'us' ? us : them;
      const best = mine.sort((x, y) => y.td - x.td)[0];
      if (!best) continue;
      const o = side === 'them' ? input.opp.five.find((q) => q.name === best.name) : null;
      const p = side === 'us' ? SLOTS.map((k) => input.lineup[k]).find((q) => q?.name === best.name) : null;
      const s = p?.s ?? o?.s ?? {};
      const pts = Math.min(Math.round(total * 0.55), best.td);
      const reb = Math.max(0, Math.round((s.reb ?? 4) * (0.7 + rand() * 0.7)));
      const ast = Math.max(0, Math.round((s.ast ?? 3) * (0.7 + rand() * 0.7)));
      out.push({ side, name: best.name, line: pts + ' pts, ' + reb + ' reb, ' + ast + ' ast' });
    }
  }
  // the winner's star first
  return us > them ? out : out.reverse();
}
