// Two phones, one online match: the model the agreement tests run (Claude 2026-11-10, studio overhaul
// soccer-1). Each phone builds both elevens from the cards itself (its own labels and colours), as the
// app does, and works out the AI's attacks through aiProgressFor the way Arcade.tsx (takeover, taken)
// and ut/Match.tsx (simBoth) call it. Each function returns [phone A's result, phone B's result].
import { COMPETITIVE_DEFENSE } from '../difficulty';
import type { Progress } from '../progress';
import { aiProgressFor, type CardForPitch, cardSquad } from './arcade';
import { cardsFor } from './squads.test-util';
import type { Squad } from './types';

/** Arcade.tsx AI_SKILL.legend: the online takeover's level; simBoth plays both sides at 0.6 online */
const LEGEND = 0.88;
const SIM = 0.6;
const TOTAL = 7;

/** One phone's view of the match: its own eleven and the rival's, built from the cards (soccerCards). */
export interface Phone {
  us: Squad;
  them: Squad;
}
/** Arcade.tsx's soccer squads (YOU in the house teal, the rival in purple) and ut/Match.tsx simBoth's. */
export const arcadeSeat = (mine: CardForPitch[], theirs: CardForPitch[], rivalName: string): Phone => ({
  us: cardSquad(mine, { name: 'You', abbr: 'YOU', c1: '#19E3C9', c2: '#0B2631' }),
  them: cardSquad(theirs, { name: rivalName, abbr: rivalName.slice(0, 3).toUpperCase(), c1: '#9B7BFF', c2: '#5B3FD1' }),
});
const utSeat = (mine: CardForPitch[], theirs: CardForPitch[], rivalName: string): Phone => ({
  us: cardSquad(mine, { name: 'You', abbr: 'YOU', c1: '#19E3C9', c2: '#0B2631' }),
  them: cardSquad(theirs, { name: rivalName, abbr: 'OPP', c1: '#9B7BFF', c2: '#5B3FD1' }),
});
export type Sim = typeof aiProgressFor;
/** Arcade.tsx aiPlay's soccer branch: the rival's attacks against you, or yours against them. */
const aiPlay = (sim: Sim, q: Phone, rival: boolean, s: string, skill: number, online: boolean): Progress =>
  rival ? sim(q.them, q.us, s, skill, COMPETITIVE_DEFENSE, { rival, online }) : sim(q.us, q.them, s, skill, COMPETITIVE_DEFENSE, { rival, online });
/** Arcade.tsx finishedFrom: the attacks played up to k, then the AI's (soccer: a goal is a point). */
const finishedFrom = (played: Progress, k: number, sim: Progress): Progress => {
  const ends = played.ends.slice(0, k).concat(sim.ends.slice(k)).slice(0, TOTAL);
  return { score: ends.filter((e) => e === 'G').length, drive: TOTAL, done: true, ends, plays: played.plays };
};
/** what both phones must agree on */
export const view = (p: Progress) => ({ score: p.score, done: p.done, ends: p.ends.join('') });

/** the two clubs of seed i: their cards, levels from 58 to 92 */
export const clubs = (i: number) => ({ a: cardsFor('agree-a:' + i, 58 + ((i * 7) % 35)), b: cardsFor('agree-b:' + i, 58 + ((i * 11 + 13) % 35)) });

/** Arcade.tsx online: B played k attacks (A heard them all) and went quiet; A's AI finishes B's
 * attacks from k (the rival's, from A's seat) and B, told A took over from k, finishes its own. */
export function takeover(i: number, sim: Sim): [Progress, Progress] {
  const { a, b } = clubs(i);
  const phoneA = arcadeSeat(a, b, 'Bianca');
  const phoneB = arcadeSeat(b, a, 'Arturo');
  const seed = 'h2h:' + i;
  const k = i % TOTAL;
  const playedB: Progress = { score: 0, drive: k, done: false, ends: 'GSWLBOT'.slice(0, k).split(''), plays: k * 3 };
  const onA = finishedFrom(playedB, k, aiPlay(sim, phoneA, true, seed + ':takeover', LEGEND, true));
  const onB = finishedFrom(playedB, Math.min(k, playedB.ends.length), aiPlay(sim, phoneB, false, seed + ':takeover', LEGEND, true));
  return [onA, onB];
}

/** ut/Match.tsx simBoth on each phone: half 0 compares A's own attacks with B's view of them, half 1
 * A's view of B's attacks with B's own. */
export function simBoth(i: number, half: 0 | 1, sim: Sim): [Progress, Progress] {
  const { a, b } = clubs(i);
  const phoneA = utSeat(a, b, 'Bianca');
  const phoneB = utSeat(b, a, 'Arturo');
  const keyA = 'ut-seed:' + i + ':sim:wireA';
  const keyB = 'ut-seed:' + i + ':sim:wireB';
  if (half === 0) return [sim(phoneA.us, phoneA.them, keyA, SIM, COMPETITIVE_DEFENSE, { rival: false, online: true }), sim(phoneB.them, phoneB.us, keyA, SIM, COMPETITIVE_DEFENSE, { rival: true, online: true })];
  return [sim(phoneA.them, phoneA.us, keyB, SIM, COMPETITIVE_DEFENSE, { rival: true, online: true }), sim(phoneB.us, phoneB.them, keyB, SIM, COMPETITIVE_DEFENSE, { rival: false, online: true })];
}

/** A stand-in ladder that plays the rival's attacks sharper even online: the bug the tests guard. */
export const leaky: Sim = (att, def, s, skill, defIQ, ctx) => aiProgressFor(att, def, s, ctx.rival ? Math.min(1, skill + 0.25) : skill, defIQ, ctx);
