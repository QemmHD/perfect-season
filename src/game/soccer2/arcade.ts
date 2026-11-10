// Soccer in the app (Claude, 2026-11-01): what the head-to-head (Arcade.tsx) and Ultimate Team need
// from the soccer engine, in one module that is loaded only when soccer is played (src/soccer-lazy.ts),
// so basketball and football never download it.
//  - drafted lineups → elevens: the eight drafted (GK, CB, FB, DM/CM, CM/AM, W, ST, FLEX) and squad
//    players for the three spots a draft doesn't fill, their six face stats estimated from the line's
//    overall and its attack / creation / defence sub-ratings (docs/SOCCER.md)
//  - Ultimate Team cards → elevens: the card's own face stats
//  - a level match's shootout both phones agree on, and the kits.
import { teamOf } from '../../data/teams';
import { hashString, rng } from '../../engine/rng';
import type { Lineup, Player } from '../../engine/types';
import { SLOTS } from '../../engine/types';
import { soccerKits, type SoccerKits } from './kits';
import { aiAttacksOf, ATTACKS, STOPPAGE } from './match';
import { GK_KEYS, OUT_KEYS, rateSoccerLine, squadFrom, squadOvr } from './ratings';
import { simShootout, type Side } from './shootout';
import type { SoccerPlayer, SoccerPos, Squad } from './types';

export { Soccer2 } from './Soccer2';
export type { ShootoutResult } from './Soccer2';
export { aiAttacksOf, ATTACKS, STOPPAGE, squadOvr };
export type { Squad, SoccerKits };

/** Attacks a side plays, stoppage time included. */
export const SOCCER_TOTAL = ATTACKS + STOPPAGE;

/** The face templates at overall 75 (scripts/build_soccer_cards.py) and which stats carry the overall. */
const TEMPLATE: Record<SoccerPos, number[]> = {
  ST: [77, 76, 64, 73, 35, 72],
  W: [84, 70, 71, 79, 38, 63],
  AM: [74, 71, 77, 79, 50, 63],
  CM: [68, 66, 75, 74, 66, 71],
  DM: [63, 58, 70, 68, 74, 76],
  FB: [79, 52, 68, 72, 72, 71],
  CB: [64, 40, 56, 57, 77, 79],
  GK: [76, 73, 70, 77, 50, 74],
};
const WEIGHTED: Record<SoccerPos, number[]> = {
  ST: [0.15, 0.45, 0.1, 0.18, 0, 0.12],
  W: [0.25, 0.2, 0.2, 0.3, 0, 0.05],
  AM: [0.1, 0.2, 0.3, 0.3, 0.05, 0.05],
  CM: [0.05, 0.1, 0.35, 0.2, 0.15, 0.15],
  DM: [0.05, 0, 0.25, 0.1, 0.35, 0.25],
  FB: [0.25, 0, 0.2, 0.1, 0.3, 0.15],
  CB: [0.1, 0, 0.05, 0, 0.55, 0.3],
  GK: [0.22, 0.2, 0.08, 0.25, 0.03, 0.22],
};
const POS: SoccerPos[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/**
 * A drafted line's six face stats: the position's template moved by the overall (fully on the stats
 * that carry it, 0.6 on the others), then nudged by its sub-ratings (attack 0.6 SHO + 0.4 DRI,
 * creation 0.6 PAS + 0.4 DRI, defence 0.7 DEF + 0.3 PHY) where they differ from the template's.
 */
export function draftFace(pos: SoccerPos, ovr: number, sub?: { att: number; mid: number; def: number }): number[] {
  const t = TEMPLATE[pos];
  const w = WEIGHTED[pos];
  const f = t.map((v, i) => v + (w[i] >= 0.1 ? 1 : 0.6) * (ovr - 75));
  if (sub && pos !== 'GK') {
    const att = 0.6 * f[1] + 0.4 * f[3];
    const mid = 0.6 * f[2] + 0.4 * f[3];
    const def = 0.7 * f[4] + 0.3 * f[5];
    const k = 0.5;
    f[1] += k * (sub.att - att);
    f[3] += 0.4 * k * (sub.att - att + sub.mid - mid);
    f[2] += k * (sub.mid - mid);
    f[4] += k * (sub.def - def);
    f[5] += 0.3 * k * (sub.def - def);
  }
  return f.map((v) => Math.round(clamp(v, 25, 99)));
}

const posOf = (s: string | undefined): SoccerPos => (POS.includes(s as SoccerPos) ? (s as SoccerPos) : 'CM');

/** A drafted player as he plays: his line's overall and estimated face stats. */
export function draftedPlayer(p: Player): SoccerPlayer {
  const roles = (p.roles ?? [p.role ?? 'CM']).map(posOf);
  const ovr = Math.round(p.s.ovr ?? 70);
  return rateSoccerLine({
    pid: p.pid,
    name: p.name,
    pos: roles.join('/'),
    ovr,
    face: draftFace(roles[0], ovr, p.sub),
    ht: null,
    num: null,
    season: p.to,
    fr: p.cellId,
    abbr: p.abbr,
    teamName: p.teamName,
    c1: p.c1,
    c2: p.c2,
  });
}

/** The three spots a draft leaves open (a second centre-back and full-back, a midfielder, a forward). */
function squadPlayers(seed: string, ovr: number): SoccerPlayer[] {
  const r = rng(hashString('squad:' + seed));
  const names = ['Okafor', 'Lindqvist', 'Moreau', 'Brennan', 'Castillo', 'Hoffmann', 'Sato', 'Varga', 'Mendes', 'Kowalski', 'Dubois', 'Rossi'];
  const pick = () => names.splice(Math.floor(r() * names.length), 1)[0];
  return (['CB', 'FB', 'CM', 'W'] as SoccerPos[]).map((pos, i) =>
    rateSoccerLine({ pid: 'squad-' + i, name: pick(), pos, ovr, face: draftFace(pos, ovr), ht: null, num: null, season: 0, fr: 'SQD', abbr: 'SQD', teamName: 'Squad', c1: '#888888', c2: '#ffffff' })
  );
}

/** A drafted lineup's eleven, its players in a fixed order so both phones build the same one. */
export function draftSquad(lineup: Lineup, info: { name: string; abbr: string; c1: string; c2: string }): Squad {
  const ps = (SLOTS.map((k) => lineup[k]).filter(Boolean) as Player[]).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const drafted = ps.map(draftedPlayer);
  // squad players a little under the drafted team (the eleven is mostly yours)
  const mean = drafted.length ? drafted.reduce((a, p) => a + p.ovr, 0) / drafted.length : 70;
  return squadFrom([...drafted, ...squadPlayers(ps.map((p) => p.id).join('|'), Math.round(clamp(mean - 8, 58, 74)))], info);
}

/** One Ultimate Team card as it plays (its own face stats, in OUT or GK key order). */
export interface CardForPitch {
  pid: string;
  name: string;
  /** every position on the card, main first */
  pos: string[];
  ovr: number;
  attrs: Record<string, number>;
  ht: number | null;
  num: number | null;
  season: number;
  fr: string;
  abbr: string;
  teamName: string;
  c1: string;
  c2: string;
}

export function cardPlayer(c: CardForPitch): SoccerPlayer {
  const keeper = c.pos[0] === 'GK';
  const keys = keeper ? GK_KEYS : OUT_KEYS;
  return rateSoccerLine({ ...c, pos: c.pos.join('/'), face: keys.map((k) => c.attrs[k] ?? 60) });
}

/**
 * An Ultimate Team eleven: the squad's cards into the engine's back four, midfield three and front
 * three, by position (squadFrom: a 4-4-2's second striker plays as a forward, a 3-5-2's wing-back at
 * full-back). Cards given in a fixed order so both phones build the same eleven.
 */
export function cardSquad(cards: CardForPitch[], info: { name: string; abbr: string; c1: string; c2: string }): Squad {
  const players = cards.map(cardPlayer);
  const mean = players.length ? players.reduce((a, p) => a + p.ovr, 0) / players.length : 65;
  const fill = players.length >= 11 ? [] : squadPlayers(info.abbr + ':' + players.length, Math.round(clamp(mean - 8, 50, 70)));
  return squadFrom([...players, ...fill], info);
}

/**
 * A level match's penalties, the same on both phones: simulated from the match seed with the host's
 * eleven kicking first. `host` is whether this phone is the host; the result is this phone's view.
 */
export function agreedShootout(mine: Squad, theirs: Squad, seed: string, host: boolean): { first: Side; scored: boolean[]; us: number; them: number; winner: Side } {
  const [a, b] = host ? [mine, theirs] : [theirs, mine];
  const so = simShootout(a, b, 'pens:' + seed, 0.75, 'us');
  const scored = so.kicks.map((k) => k.scored);
  const hostGoals = so.kicks.filter((k) => k.side === 'us' && k.scored).length;
  const guestGoals = so.kicks.filter((k) => k.side === 'them' && k.scored).length;
  const hostWon = so.winner === 'us';
  return host
    ? { first: 'us', scored, us: hostGoals, them: guestGoals, winner: hostWon ? 'us' : 'them' }
    : { first: 'them', scored, us: guestGoals, them: hostGoals, winner: hostWon ? 'them' : 'us' };
}

/** The kits for a match: your favorite club's colors (or the house teal) against the rival's. */
export function soccerKitsFor(myFav: string | null, rivalFav: string | null): SoccerKits {
  const me = teamOf('soccer', myFav) ?? { c1: '#19E3C9', c2: '#0B2631' };
  const them = teamOf('soccer', rivalFav) ?? { c1: '#9B7BFF', c2: '#5B3FD1' };
  return soccerKits(me, them);
}

/** The AI's attacks as a Progress, for the Arcade's scoreboard. */
export function aiProgress(attack: Squad, defense: Squad, seed: string, skill: number, defIQ: number) {
  return aiAttacksOf(attack, defense, seed, skill, ATTACKS, defIQ);
}

/** Who a simulation is for: the rival's attacks against your defence (`rival`), or yours; a match
 * between two phones (`online`). */
export interface SimFor {
  rival: boolean;
  online: boolean;
}

/**
 * The one door to the AI's simulations (Claude 2026-11-10, studio overhaul soccer-1): the Arcade's
 * AI attacks, takeovers and SIM, and Ultimate Team's simBoth all call it. Today it plays exactly as
 * aiProgress, whoever it is for. Online, phone A works out B's attacks as the rival's while B works
 * out the same attacks as its own, so anything that reads `ctx` (the solo difficulty ladder) must
 * apply only when !ctx.online, or the two phones disagree on the score. agreement.test.ts holds it.
 */
export function aiProgressFor(attack: Squad, defense: Squad, seed: string, skill: number, defIQ: number, _ctx: SimFor) {
  return aiProgress(attack, defense, seed, skill, defIQ);
}
