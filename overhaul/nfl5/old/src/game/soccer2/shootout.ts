// Soccer v2: the penalty shootout that settles a level match. Implemented by Claude (Anthropic),
// 2026-11-01. Five kicks each, alternating, the better finishers first; then sudden death in
// pairs. It stops as soon as one side can't be caught. Every kick is a real penalty on the engine
// (the taker's meter and aim against the keeper's read and dive). Twenty rounds level (vanishingly
// rare) goes to the better eleven, as the head-to-head's tie rule does.
import { autoplayAttack } from './autopilot';
import { setupAttack } from './engine';
import { elevenOf, rt, squadOvr } from './ratings';
import type { Attack, SoccerPlayer, Squad } from './types';

export type Side = 'us' | 'them';

export interface Kick {
  side: Side;
  taker: SoccerPlayer;
  scored: boolean;
}

export interface Shootout {
  us: Squad;
  them: Squad;
  seed: string;
  /** who kicks first */
  first: Side;
  kicks: Kick[];
  done: boolean;
  winner: Side | null;
}

export const ROUNDS = 5;
const MAX_ROUNDS = 20;

/** The order a side kicks in: its outfielders by finishing, the keeper last. */
export function takers(s: Squad): SoccerPlayer[] {
  const out = elevenOf(s).filter((p) => !p.keeper);
  out.sort((p, q) => rt(q.a.SHO) * 0.8 + rt(q.a.PHY) * 0.2 - (rt(p.a.SHO) * 0.8 + rt(p.a.PHY) * 0.2));
  return [...out, s.gk];
}

export function newShootout(us: Squad, them: Squad, seed: string, first: Side = 'us'): Shootout {
  return { us, them, seed, first, kicks: [], done: false, winner: null };
}

export function score(so: Shootout): { us: number; them: number; usTaken: number; themTaken: number } {
  let us = 0;
  let them = 0;
  let usTaken = 0;
  let themTaken = 0;
  for (const k of so.kicks) {
    if (k.side === 'us') {
      usTaken++;
      if (k.scored) us++;
    } else {
      themTaken++;
      if (k.scored) them++;
    }
  }
  return { us, them, usTaken, themTaken };
}

/** Whose kick is next, who takes it and who keeps. */
export function nextKick(so: Shootout): { side: Side; taker: SoccerPlayer; keeper: SoccerPlayer; n: number } {
  const n = so.kicks.length;
  const side: Side = n % 2 === 0 ? so.first : so.first === 'us' ? 'them' : 'us';
  const kicking = side === 'us' ? so.us : so.them;
  const order = takers(kicking);
  const k = so.kicks.filter((q) => q.side === side).length;
  return { side, taker: order[k % order.length], keeper: (side === 'us' ? so.them : so.us).gk, n };
}

/** The kick lined up as an attack: the kicking side's taker against the other side's keeper. */
export function kickAttack(so: Shootout): Attack {
  const nk = nextKick(so);
  const att = nk.side === 'us' ? so.us : so.them;
  const def = nk.side === 'us' ? so.them : so.us;
  return setupAttack('penalty', att, def, so.seed + ':pen:' + nk.n, { taker: nk.taker, side: 1, clock: 12 });
}

/** A kick taken: count it and see whether that settles it. */
export function recordKick(so: Shootout, scored: boolean): Shootout {
  if (so.done) return so;
  so.kicks.push({ side: nextKick(so).side, taker: nextKick(so).taker, scored });
  const s = score(so);
  if (s.usTaken <= ROUNDS && s.themTaken <= ROUNDS) {
    if (s.us + (ROUNDS - s.usTaken) < s.them) return settle(so, 'them');
    if (s.them + (ROUNDS - s.themTaken) < s.us) return settle(so, 'us');
  }
  if (s.usTaken >= ROUNDS && s.usTaken === s.themTaken && s.us !== s.them) return settle(so, s.us > s.them ? 'us' : 'them');
  if (s.usTaken >= MAX_ROUNDS && s.usTaken === s.themTaken) return settle(so, squadOvr(so.us) >= squadOvr(so.them) ? 'us' : 'them');
  return so;
}

function settle(so: Shootout, w: Side): Shootout {
  so.done = true;
  so.winner = w;
  return so;
}

/** A whole shootout with both sides on the autopilot. */
export function simShootout(us: Squad, them: Squad, seed: string, skill = 0.75, first: Side = 'us'): Shootout {
  const so = newShootout(us, them, seed, first);
  let guard = 0;
  while (!so.done && guard++ < MAX_ROUNDS * 2 + 2) {
    const a = kickAttack(so);
    autoplayAttack(a, skill, seed + ':k' + so.kicks.length);
    recordKick(so, a.end?.kind === 'G');
  }
  return so;
}
