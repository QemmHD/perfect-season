// Soccer v2: a match of Attacks. Implemented by Claude (Anthropic), 2026-11-01. Each side gets six
// attacks (three a half) and one in stoppage time, each a scenario dealt from the seed: patient
// build-up, a counter, a wide overload, a corner, a free kick (a penalty comes from a foul in the
// box). An attack has 30 seconds of open play (stoppage time 15); it ends in a Goal, a Save, Wide,
// Blocked, Lost, Offside or Time. Only your own goals count on your phone; the other side plays its
// attacks on its own (or the autopilot plays the AI's). Level at the end: a shootout.
import { hashString, rng } from '../../engine/rng';
import { autoplayAttack } from './autopilot';
import { CLOCK, setupAttack, STOPPAGE_CLOCK } from './engine';
import type { Attack, AttackEnd, Scenario, Squad } from './types';

/** regular attacks each (three a half), plus one in stoppage time */
export const ATTACKS = 6;
export const STOPPAGE = 1;

export const END_TEXT: Record<AttackEnd, string> = { G: 'GOAL', S: 'SAVED', W: 'WIDE', B: 'BLOCKED', L: 'LOST IT', O: 'OFFSIDE', T: 'TIME' };

export const SCENARIO_NAMES: Record<Scenario, string> = {
  build: 'Build-up',
  counter: 'Counter-attack',
  wide: 'Wide overload',
  corner: 'Corner',
  freekick: 'Free kick',
  penalty: 'Penalty',
};

export const SCENARIO_HINTS: Record<Scenario, string> = {
  build: 'Work it forward · find a runner in behind',
  counter: '3 on 2 · sprint at them before they get back',
  wide: 'Overload the flank · beat your man or cross it',
  corner: 'Pick your target · hold PASS to whip it in',
  freekick: 'Swipe to bend it · hold SHOOT and let go in the green',
  penalty: 'Aim with the stick · hold SHOOT, let go in the green',
};

export interface Match {
  us: Squad;
  them: Squad;
  seed: string;
  attacks: number;
  defIQ: number;
  /** the scenarios, stoppage time's last */
  deal: Scenario[];
  /** attacks played */
  i: number;
  ends: AttackEnd[];
  goals: number;
  over: boolean;
}

/** The six scenarios a match deals (every kind once, a second build-up), shuffled; then stoppage time's. */
export function dealOf(seed: string, attacks = ATTACKS): Scenario[] {
  const r = rng(hashString('deal:' + seed));
  const bag: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick', 'build'];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const out: Scenario[] = [];
  for (let i = 0; i < attacks; i++) out.push(bag[i % bag.length]);
  out.push(r() < 0.5 ? 'counter' : 'wide');
  return out;
}

export function newMatch(us: Squad, them: Squad, seed: string, attacks = ATTACKS, defIQ = 0): Match {
  return { us, them, seed, attacks, defIQ, deal: dealOf(seed, attacks), i: 0, ends: [], goals: 0, over: false };
}

/** Attacks in all, stoppage time included. */
export const totalOf = (m: Match) => m.attacks + STOPPAGE;
export const isStoppage = (m: Match, i = m.i) => i >= m.attacks;
/** which half attack i is in (1, 2; stoppage time is the second half's) */
export const halfOf = (m: Match, i = m.i) => (i < Math.ceil(m.attacks / 2) ? 1 : 2);
/** the match minute an attack starts at, for the scoreboard */
export function minuteOf(m: Match, i = m.i): string {
  if (isStoppage(m, i)) return "90+'";
  const per = 90 / m.attacks;
  return Math.round(per * i + per / 2) + "'";
}

/** The next attack, lined up (the whistle hasn't gone). */
export function attackFor(m: Match, i = m.i): Attack {
  const stoppage = isStoppage(m, i);
  return setupAttack(m.deal[i], m.us, m.them, m.seed + ':' + i, { clock: stoppage ? STOPPAGE_CLOCK : CLOCK, stoppage, defIQ: m.defIQ });
}

/** An attack's over: count it. */
export function recordAttack(m: Match, a: Attack): AttackEnd {
  const e = a.end?.kind ?? 'T';
  if (m.over) return e;
  m.ends.push(e);
  if (e === 'G') m.goals++;
  m.i++;
  if (m.i >= totalOf(m)) m.over = true;
  return e;
}

/** Play every attack with the autopilot (the AI's attacks, a simmed match, the tests). */
export function autoplayMatch(m: Match, skill: number, seed = m.seed): Match {
  while (!m.over) {
    const a = attackFor(m);
    autoplayAttack(a, skill, seed + ':ai:' + m.i);
    recordAttack(m, a);
  }
  return m;
}

/** The AI's attacks against your defense, as the other phone would report them. */
export function aiAttacksOf(attack: Squad, defense: Squad, seed: string, skill: number, attacks = ATTACKS, defIQ = 0): { score: number; drive: number; done: boolean; ends: string[]; plays: number } {
  const m = autoplayMatch(newMatch(attack, defense, 'ai:' + seed, attacks, defIQ), skill, 'ai:' + seed);
  return { score: m.goals, drive: m.i, done: true, ends: m.ends.slice(), plays: m.i };
}
