import { settleCup, validCupRequest, type CupRequest } from './cup';
import { settleLeague, validLeagueRequest, type LeagueRequest } from './league';
import { settleEvent } from './events';
import { settleCircuit } from './circuit';
import { hqOf, recordMatchProgress } from './progression';
import { rivalsMatch } from './rivals';
// Playing a squad: what the UT screens ask for, and what a finished match pays (docs/ULTIMATE-TEAM.md
// "Playing").
//
// App.tsx gives <UltimateTeam> an `onPlaySquad` that opens the match screen (src/ut/Match.tsx) with
// the request; that screen finds the opponent, builds both teams (teams.ts), runs the vote and the
// arcade game, then settles the result here: coins, card XP, the record and the ladder.
import { battlesThisWeek, RUNGS } from './battles';
import { awardXp, type UtState } from './state';
import { LEVEL_UP_COINS, levelInfo, unlockedAt } from '../engine/economy';
import type { Booster } from '../engine/types';

export interface UtMatchRequest {
  /** unique per match started */
  id: number;
  /** vs an AI squad (a Squad Battles rung), or online head to head */
  mode: 'ai' | 'online';
  /** Squad Battles: the rung of this week's ladder */
  rung?: number;
  event?: { id: string; node: number };
  circuit?: { runId: string; round: number };
  league?: LeagueRequest;
  cup?: CupRequest;
  /** Claude: a UT Draft game (draft-mode.ts) */
  draft?: { runId: string; game: number };
  /**
   * Claude ut-5: started from the One-More bar at the end of the last match. The stake was on the
   * bar, so the match starts straight away: a short curtain with the opponent, no vote, no kickoff.
   */
  quick?: boolean;
}

export interface UtMatchResult {
  won: boolean;
  us: number;
  them: number;
  /** the uids of the cards that played (the whole squad) */
  played: string[];
  /** Claude ut-5: a level score settled as a draw (soccer's three-way branch; dormant until soccer settles draws) */
  draw?: true;
}

export type PlaySquad = (req: UtMatchRequest) => void;

/** What a played card earns: per game, and on top for a win. 700 XP takes a card to level 5. */
export const XP_PER_GAME = 40;
export const XP_FOR_WIN = 20;
/** A UT game pays like a draft's grade, so the economy (packs.ts) holds: about 50 a game. */
export const COINS_WIN = 60;
export const COINS_LOSS = 30;
/**
 * Claude ut-5, the dormant soccer three-way branch (plan contract G): a draw pays between the two,
 * and its cards earn half a win's bonus XP. Nothing settles a draw today: soccer settles a level UT
 * match on penalties; if soccer ever settles draws, that is soccer's UT protocol bump.
 */
export const COINS_DRAW = 45;
export const XP_FOR_DRAW = 10;

/**
 * Games a day that pay coins and XP (Squad Battles and head to head together): enough for a good
 * session, not a farm (a simmed game takes seconds). Past it a game still counts for the record and
 * the ladder, but pays nothing (a rung's pack included: a ladder that refreshes isn't a pack farm).
 */
export const PAID_GAMES_A_DAY = 8;

/** What a game pays: coins (times the Squad Battles difficulty's `pay`) and XP for every card. */
export function matchRewards(
  r: Pick<UtMatchResult, 'won'> & { draw?: boolean },
  pay = 1,
): { coins: number; xp: number } {
  const draw = !r.won && !!r.draw;
  return {
    coins: Math.round((r.won ? COINS_WIN : draw ? COINS_DRAW : COINS_LOSS) * pay),
    xp: XP_PER_GAME + (r.won ? XP_FOR_WIN : draw ? XP_FOR_DRAW : 0),
  };
}

/**
 * Claude ut-5 (V2 D.1): what a paid UT match adds to the shared Career level (`profile.xp`, the
 * draft's level): played +20, +10 more for a win (+5 for a draw), a sim +5. A match past the day's
 * paid games, or one that was already settled, adds nothing (the caller passes `paid`: the match
 * paid its card XP).
 */
export const CAREER_XP = { played: 20, win: 10, draw: 5, sim: 5 } as const;
export function careerXp(r: { how: 'played' | 'sim'; won: boolean; draw?: boolean; paid: boolean }): number {
  if (!r.paid) return 0;
  if (r.how === 'sim') return CAREER_XP.sim;
  return CAREER_XP.played + (r.won ? CAREER_XP.win : r.draw ? CAREER_XP.draw : 0);
}

export interface CareerGain {
  xp: number;
  /** levels reached by this gain, in order */
  levelUps: number[];
  /** LEVEL_UP_COINS for each of them */
  coins: number;
  /** boosters those levels unlock (as the draft's level-ups do) */
  boosters: Booster[];
}
/**
 * Career XP on the profile's shared fields: each level crossed pays LEVEL_UP_COINS and unlocks its
 * boosters, exactly as a draft run's level-up does. `xp` only rises, so a level pays once ever.
 */
export function addCareerXp<P extends { xp: number; coins: number; inventory: Record<Booster, number> }>(p: P, xp: number): { profile: P; gain: CareerGain } {
  const gain: CareerGain = { xp: Math.max(0, Math.floor(xp)), levelUps: [], coins: 0, boosters: [] };
  if (!gain.xp) return { profile: p, gain };
  const from = levelInfo(p.xp).level,
    to = levelInfo(p.xp + gain.xp).level;
  for (let l = from + 1; l <= to; l++) {
    gain.levelUps.push(l);
    gain.boosters.push(...unlockedAt(l));
  }
  gain.coins = LEVEL_UP_COINS * gain.levelUps.length;
  const inventory = { ...p.inventory };
  for (const b of gain.boosters) inventory[b] = (inventory[b] ?? 0) + 1;
  return { profile: { ...p, xp: p.xp + gain.xp, coins: p.coins + gain.coins, inventory }, gain };
}

/**
 * Who won: the higher score; a tie goes to the better squad (its unrounded overall), and two
 * squads exactly as good to `coin` (online, read off the match the same way on both phones).
 */
export function decide(
  us: number,
  them: number,
  mine: number,
  theirs: number,
  coin: () => boolean,
): { won: boolean; tiebreak: boolean } {
  if (us !== them) return { won: us > them, tiebreak: false };
  if (Math.abs(mine - theirs) > 1e-9)
    return { won: mine > theirs, tiebreak: true };
  return { won: coin(), tiebreak: true };
}

/**
 * A draw stands only for a level score that did not win, against the AI, outside a Cup (knockout:
 * penalties decide it) and a Club Season (its tables have no draws).
 */
export function isDraw(r: { draw?: boolean; won: boolean; us: number; them: number; online: boolean; cup?: unknown; league?: unknown }): boolean {
  return !!r.draw && !r.won && r.us === r.them && !r.online && !r.cup && !r.league;
}

export interface Settled {
  ut: UtState;
  coins: number;
  xp: number;
  /** cards that went up a level */
  ups: { uid: string; level: number }[];
  /** a Squad Battles rung cleared for the first time on this ladder, and the pack it paid */
  climbed: boolean;
  pack: string | null;
  /** that was the top rung: the next ladder is up */
  refreshed: boolean;
  seasonXP: number;
  circuitPrizes: string[];
  /** today's paid games were used up before this one: it paid nothing */
  capped: boolean;
}

/**
 * A finished match on the profile's UT state: XP for every card in the squad, the record (online
 * head to head apart from games against the AI), and on the ladder, the next rung cleared (with its
 * pack, the first time this week). Coins go to the profile's purse: `coins` says how many.
 */
export function settle(
  ut: UtState,
  r: {
    won: boolean;
    us: number;
    them: number;
    online: boolean;
    rung: { i: number; pack: string | null } | null;
    played: string[];
    week: string;
    day: string;
    packId: string;
    at: number;
    pay?: number;
    matchId?: string;
    event?: { id: string; node: number };
    circuit?: { runId: string; round: number };
    league?: LeagueRequest;
    cup?: CupRequest;
    clubOvr?: number;
    opponent?: string;
    how?: 'played' | 'sim';
    /** Claude ut-5: a level score settled as a draw (the dormant soccer branch; never in a Cup, a Club Season or online) */
    draw?: boolean;
  },
): Settled {
  const activeCircuit = r.circuit ? hqOf(ut).circuit.active : undefined;
  if (
    (r.cup &&
      (r.online ||
        r.rung ||
        r.event ||
        r.circuit ||
        r.league ||
        r.how !== 'played' ||
        typeof r.won !== 'boolean' ||
        !Number.isSafeInteger(r.at) ||
        r.at < 0 ||
        typeof r.matchId !== 'string' ||
        !r.matchId ||
        !validCupRequest(ut, r.cup) ||
        ![r.us, r.them].every(
          (x) => Number.isInteger(x) && x >= 0 && x <= 1000,
        ) ||
        (r.us !== r.them && r.won !== r.us > r.them))) ||
    (r.league &&
      (r.online ||
        r.rung ||
        r.event ||
        r.circuit ||
        r.cup ||
        (r.us !== r.them && r.won !== r.us > r.them) ||
        r.how !== 'played' ||
        !validLeagueRequest(ut, r.league) ||
        ![r.us, r.them].every(
          (x) => Number.isInteger(x) && x >= 0 && x <= 1000,
        ))) ||
    (r.matchId && ut.settled?.includes(r.matchId)) ||
    (r.circuit &&
      (r.how === 'sim' ||
        !activeCircuit ||
        activeCircuit.id !== r.circuit.runId ||
        activeCircuit.games !== r.circuit.round))
  )
    return {
      ut,
      coins: 0,
      xp: 0,
      ups: [],
      climbed: false,
      pack: null,
      capped: false,
      refreshed: false,
      seasonXP: 0,
      circuitPrizes: [],
    };
  ut = ut.hq ? ut : { ...ut, hq: hqOf(ut) };
  const draw = isDraw(r);
  const today = ut.paid.day === r.day ? ut.paid.n : 0;
  const capped = today >= PAID_GAMES_A_DAY;
  const { coins, xp } = capped ? { coins: 0, xp: 0 } : matchRewards({ won: r.won, draw }, r.pay);
  const x = awardXp(
    { ...ut, paid: { day: r.day, n: today + (capped ? 0 : 1) } },
    r.played,
    xp,
  );
  if (r.event && r.won && !r.online)
    x.ut = settleEvent(x.ut, r.event.id, r.event.node, r.at);
  const rec = x.ut.record;
  const record = r.online
    ? {
        ...rec,
        h2hW: rec.h2hW + (r.won ? 1 : 0),
        h2hL: rec.h2hL + (r.won ? 0 : 1),
      }
    : draw
      ? { ...rec, d: (rec.d ?? 0) + 1 }
      : { ...rec, w: rec.w + (r.won ? 1 : 0), l: rec.l + (r.won ? 0 : 1) };
  let battles = battlesThisWeek(x.ut.battles, r.week);
  const climbed =
    !!r.rung && r.rung.i >= 0 && r.won && r.rung.i === battles.cleared;
  const pack = climbed && !capped ? r.rung!.pack : null;
  // the top rung: the next ladder comes up (at the same difficulty)
  const refreshed = climbed && r.rung!.i + 1 >= RUNGS;
  if (climbed)
    battles = refreshed
      ? {
          ...battles,
          week: r.week,
          cleared: 0,
          best: RUNGS,
          round: (battles.round ?? 0) + 1,
        }
      : {
          ...battles,
          week: r.week,
          cleared: r.rung!.i + 1,
          best: Math.max(battles.best, r.rung!.i + 1),
        };
  const packs = pack
    ? [...x.ut.packs, { id: r.packId, kind: pack, at: r.at }]
    : x.ut.packs;
  const settledUt: UtState = {
    ...x.ut,
    record,
    battles,
    packs,
    ...(r.matchId
      ? { settled: [...(ut.settled ?? []), r.matchId].slice(-1000) }
      : {}),
    ...(r.online && r.matchId
      ? { rivals: rivalsMatch(ut.rivals, r.week, r.matchId, r.won) }
      : {}),
  };
  const circuit = r.circuit
    ? settleCircuit(settledUt, r.circuit.runId, r.circuit.round, r.won, r.at)
    : { ut: settledUt, coins: 0, prizes: [] };
  const seasonUt = r.league
    ? settleLeague(circuit.ut, r.league, r)
    : circuit.ut;
  const cupUt = r.cup
    ? settleCup(seasonUt, r.cup, {
        won: r.won,
        us: r.us,
        them: r.them,
        at: r.at,
        how: r.how!,
        matchId: r.matchId!,
      })
    : seasonUt;
  const progression = recordMatchProgress(cupUt, {
    id: r.matchId ?? 'legacy:' + r.packId,
    at: r.at,
    mode: r.cup
      ? 'cup'
      : r.league
        ? 'league'
        : r.circuit
          ? 'circuit'
          : r.online
            ? 'online'
            : r.event
              ? 'event'
              : 'battle',
    won: r.won,
    us: r.us,
    them: r.them,
    opponent: r.opponent ?? 'Opponent',
    coins: coins + circuit.coins,
    xp,
    day: r.day,
    how: r.how ?? 'played',
    played: r.played,
    ...(draw ? { draw: true } : {}),
  });
  return {
    ut: progression.ut,
    coins: coins + circuit.coins,
    seasonXP: progression.sp,
    circuitPrizes: circuit.prizes,
    xp,
    ups: x.ups,
    climbed,
    pack,
    capped,
    refreshed,
  };
}
