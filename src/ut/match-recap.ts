// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5; Game Design V2 D.1 and D.10, audit M3):
// everything the end of a match shows, worked out from data that is already settled. Nothing here
// writes state or decides a result: settlement stays in play.ts (and is identical on both phones);
// this file reads the save before and after it and says what moved.
//
//   verdictOf     WIN / LOSS, · OT, · PENS, and DRAW (soccer) or TIE only for a level score
//   END_CODES     every end code per sport: the label the result screen shows and what it scores
//   buildRecap    coins, Career XP and level-ups, card XP, objectives that moved, the Season Pass
//                 bar, Rivals RP and division, Active Minutes "+4 min, now 27" with the next rung,
//                 milestones, the match grade (C1) and the rated box (C2); slots for the Scout Drop
//                 (ut-7) and the weekly league change (ut-8)
//   afterCtxOf    what the One-More bar needs from this match (next-action.ts AfterCtx)
//   oneMoreStart  where the One-More bar's target leads: a match request that starts at once, or a
//                 screen when the target is not a match
//
// Light on purpose: no pool, packs or engine modules (the regulation counts are pinned to the engines
// by verdict.test.ts), so it tests in milliseconds and adds little to the match chunk.
import type { LevelInfo } from '../engine/economy';
import { levelInfo } from '../engine/economy';
import { credit, etDay, type Playtime } from '../lib/playtime';
import { freshCup } from './cup-state';
import { contentOf } from './content-state';
import { leagueRequest } from './league';
import type { RecapGrade } from './match-box';
import type { RatedBox } from './match-ratings';
import { minutesView, rewardText, shortReward } from './minutes';
import { type AfterCtx, type Difficulty, DIFFICULTIES, type MatchSetupRef, type NextAction, packName } from './next-action';
import { hqOf, objectiveDeck, rewardLabel, SEASON_STEP, SEASON_TIERS, seasonFor, seasonReward } from './objectives';
import type { CareerGain, UtMatchRequest } from './play';
import { DIVISIONS, divisionOf, rivalsOf } from './rivals';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { UtView } from './UltimateTeam';

/** cup.ts cupOf, without cup.ts's pool import */
const cupOf = (ut: UtState) => ut.cup ?? freshCup();

// ---------- end codes and regulation ----------

/** Possessions (NBA), drives (NFL) and attacks (soccer) in regulation. */
export const REGULATION: Record<UtSport, number> = { nba: 16, nfl: 4, soccer: 6 };
/**
 * Whether more ends than regulation on the record mean overtime. Soccer's record also carries the
 * counter-attacks and restarts an attack can turn into (and a level match goes to penalties), so in
 * soccer only the sport's own `ot` says overtime.
 */
const OT_BY_COUNT: Record<UtSport, boolean> = { nba: true, nfl: true, soccer: false };

export interface EndCode {
  /** what the result screen's end strip shows */
  label: string;
  /** what it put on the board */
  points: number;
}
const code = (label: string, points = 0): EndCode => ({ label, points });
/**
 * Every end code each sport writes on `Progress.ends`, with its label and points. Codes outside the
 * table show as themselves and score nothing on the strip (end-codes.test.ts pins the table).
 * 'FF' is a forfeited possession, drive or attack (each sport pads the record with it).
 */
export const END_CODES: Record<UtSport, Record<string, EndCode>> = {
  nba: { '2': code('2', 2), '3': code('3', 3), A: code('2+1', 3), X: code('·'), TO: code('TO'), FF: code('FF') },
  nfl: {
    TD: code('TD', 7),
    TD6: code('TD', 6),
    TD8: code('TD+2', 8),
    FG: code('FG', 3),
    MISS: code('FG✕'),
    INT: code('INT'),
    DOWNS: code('DWN'),
    PUNT: code('PUNT'),
    FUM: code('FUM'),
    SAF: code('SAF'),
    TIME: code('TIME'),
    FF: code('FF'),
  },
  soccer: { G: code('GOAL', 1), S: code('SAVE'), W: code('WIDE'), B: code('BLK'), L: code('LOST'), O: code('OFF'), T: code('·'), FF: code('FF') },
};
export const endLabel = (sport: UtSport, e: string) => END_CODES[sport][e]?.label ?? e;
export const endPoints = (sport: UtSport, e: string) => END_CODES[sport][e]?.points ?? 0;
/** Read aloud: soccer's words (its letters mean nothing alone), the other sports' codes. */
export function endSpoken(sport: UtSport, e: string): string {
  if (sport !== 'soccer') return e;
  const l = endLabel(sport, e);
  return l === '·' ? 'time' : l.toLowerCase();
}

// ---------- the verdict ----------

export interface Verdict {
  /** the big word: WIN or LOSS, and for a level score only DRAW (soccer) or TIE */
  word: 'WIN' | 'LOSS' | 'DRAW' | 'TIE';
  /** how it is drawn: a level score settled for you reads as a draw with a winning note */
  tone: 'win' | 'loss' | 'draw';
  tag?: 'OT' | 'PENS';
  /** one line under it: "Won 4–3 on penalties", "A tie goes to the better squad: yours." */
  note?: string;
  /** what settlement decided: did it count as a win */
  won: boolean;
}
export interface VerdictIn {
  us: number;
  them: number;
  won: boolean;
  /** settled by the squads' ratings or the coin (decide), not the score */
  tiebreak?: boolean;
  /** settled as a draw (play.ts isDraw) */
  draw?: boolean;
  pens?: { us: number; them: number; won: boolean };
  /** overtime periods, when the sport reports them (Progress.ot) */
  ot?: number;
  ends?: [readonly string[], readonly string[]];
}
const LEVEL_WORD: Record<UtSport, 'DRAW' | 'TIE'> = { nba: 'TIE', nfl: 'TIE', soccer: 'DRAW' };

/** The result's headline. A level score never reads WIN or LOSS: that is what the note is for. */
export function verdictOf(o: VerdictIn, sport: UtSport): Verdict {
  const ot = (o.ot ?? 0) > 0 || (OT_BY_COUNT[sport] && !!o.ends?.some((e) => e.length > REGULATION[sport]));
  if (o.us !== o.them) return { word: o.won ? 'WIN' : 'LOSS', tone: o.won ? 'win' : 'loss', won: o.won, ...(ot ? { tag: 'OT' as const } : {}) };
  const word = LEVEL_WORD[sport];
  if (o.pens)
    return {
      word,
      tone: o.pens.won ? 'win' : 'loss',
      tag: 'PENS',
      note: (o.pens.won ? 'Won ' : 'Lost ') + o.pens.us + '–' + o.pens.them + ' on penalties',
      won: o.pens.won,
    };
  if (o.draw || !o.won && !o.tiebreak) return { word, tone: 'draw', note: 'Level at the final whistle', won: false, ...(ot ? { tag: 'OT' as const } : {}) };
  return {
    word,
    tone: o.won ? 'win' : 'loss',
    note: 'A ' + word.toLowerCase() + ' goes to the better squad: ' + (o.won ? 'yours.' : 'theirs.'),
    won: o.won,
    ...(ot ? { tag: 'OT' as const } : {}),
  };
}

// ---------- the recap ----------

export interface RecapObjective {
  id: string;
  group: 'daily' | 'weekly' | 'lifetime';
  title: string;
  from: number;
  to: number;
  target: number;
  /** completed by this match */
  done: boolean;
  reward: string;
}
export interface RecapMilestone {
  id: string;
  title: string;
  line: string;
  /** a pack or prize waits in the Store */
  store?: boolean;
}
export interface Recap {
  verdict: Verdict;
  /** what the wallet gained: the match's coins, plus any Career level coins */
  coins: number;
  /** the match itself paid nothing: today's paid games were already played */
  capped: boolean;
  career: { gain: CareerGain; from: LevelInfo; to: LevelInfo } | null;
  cards: { xp: number; ups: { name: string; level: number }[] };
  objectives: RecapObjective[];
  sp: { gained: number; from: number; to: number; levelFrom: number; levelTo: number; next: string | null } | null;
  rivals: { from: number; to: number; divFrom: number; divTo: number; name: string; promoted: boolean } | null;
  /** `at`: the next daily rung's minute mark, the bar's end (null once the day is capped) */
  minutes: { plus: number; now: number; at: number | null; next: string | null; capped: boolean; frozen: boolean } | null;
  milestones: RecapMilestone[];
  grade: RecapGrade | null;
  box: RatedBox | null;
  /** ut-7: the Scout Drop a win in the day's first three reveals (null until it lands) */
  scoutDrop: null;
  /** ut-8: the weekly league position change (null until it lands) */
  league: null;
}

interface Side {
  coins: number;
  xp: number;
  ut: UtState;
  playtime?: Playtime;
}
export interface RecapIn {
  sport: UtSport;
  day: string;
  week: string;
  now: number;
  /** the profile before the match settled, and as it settled (the same update the save gets) */
  before: Side;
  after: Side;
  verdict: Verdict;
  /** card XP each card earned and the cards that levelled (names resolved by the caller) */
  cards: { xp: number; ups: { name: string; level: number }[] };
  capped: boolean;
  career: CareerGain | null;
  online: boolean;
  /** counted MINUTES seconds of this match not banked yet when it settled (playtime pendingSec) */
  minutesSec: number | null;
  milestones: RecapMilestone[];
  grade: RecapGrade | null;
  box: RatedBox | null;
}

function objectivesMoved(before: UtState, after: UtState, day: string): RecapObjective[] {
  const was = new Map(objectiveDeck(before, day).map((o) => [o.id, o]));
  const out: RecapObjective[] = [];
  for (const o of objectiveDeck(after, day)) {
    const b = was.get(o.id);
    const from = Math.min(b?.progress ?? 0, o.target),
      to = Math.min(o.progress, o.target);
    if (o.claimed || to <= from) continue;
    out.push({ id: o.id, group: o.group, title: o.title, from, to, target: o.target, done: to >= o.target, reward: rewardLabel(o.reward) });
  }
  // completed first, then dailies, then the rest
  const rank = (o: RecapObjective) => (o.done ? 0 : 2) + (o.group === 'daily' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b)).slice(0, 4);
}

function spMoved(before: UtState, after: UtState, day: string, sport: UtSport): Recap['sp'] {
  const id = seasonFor(day).id,
    from = hqOf(before).seasons[id]?.xp ?? 0,
    to = hqOf(after).seasons[id]?.xp ?? 0;
  if (to <= from) return null;
  const levelTo = Math.floor(to / SEASON_STEP);
  const nextTier = levelTo + 1;
  let next: string | null = null;
  if (nextTier <= SEASON_TIERS) {
    const r = seasonReward(nextTier);
    next = r.pack ? packName(r.pack, sport) : rewardLabel(r);
  }
  return { gained: to - from, from, to, levelFrom: Math.floor(from / SEASON_STEP), levelTo, next };
}

function rivalsMoved(before: UtState, after: UtState, week: string): Recap['rivals'] {
  const a = rivalsOf(before.rivals, week),
    b = rivalsOf(after.rivals, week);
  if (a.points === b.points && a.w + a.l === b.w + b.l) return null;
  const divFrom = divisionOf(a.points),
    divTo = divisionOf(b.points);
  return { from: a.points, to: b.points, divFrom, divTo, name: DIVISIONS[divTo].name, promoted: divTo > divFrom };
}

/**
 * The MINUTES ledger as it reads once this match's seconds bank (playtime.ts bankActivity writes the
 * same through the profile sink a moment later): what the recap and the One-More bar count from.
 */
export function bankedLedger(pt: Playtime | undefined, sec: number, now: number, sport: UtSport): Playtime {
  return credit(pt, { sec: Math.max(0, Math.floor(sec)), menu: 0, raw: 0, sport, act: 1 }, now);
}

/** Today's counted minutes with this match banked, and the next rung, from the ledger before it. */
export function minutesMoved(pt: Playtime | undefined, sec: number, now: number, sport: UtSport): Recap['minutes'] {
  const day = etDay(now),
    beforeMin = pt && pt.day === day ? Math.floor(pt.daySec / 60) : 0;
  const q = bankedLedger(pt, sec, now, sport);
  const v = minutesView(q, now);
  if (v.frozen) return { plus: 0, now: beforeMin, at: null, next: null, capped: false, frozen: true };
  const nowMin = v.day.min,
    next = v.day.capped ? null : v.day.next;
  return {
    plus: Math.max(0, nowMin - beforeMin),
    now: nowMin,
    at: next ? next.at : null,
    next: next ? next.minutesLeft + ' min to ' + rewardText(next.reward) : v.ready.length ? shortReward(v.ready[0].reward) + ' ready' : null,
    capped: v.day.capped,
    frozen: false,
  };
}

/** Everything the end of the match shows, from the save before and after it settled. */
export function buildRecap(r: RecapIn): Recap {
  const careerFrom = levelInfo(r.before.xp),
    careerTo = levelInfo(r.after.xp);
  return {
    verdict: r.verdict,
    coins: Math.max(0, r.after.coins - r.before.coins),
    capped: r.capped,
    career: r.career && r.career.xp > 0 ? { gain: r.career, from: careerFrom, to: careerTo } : null,
    cards: r.cards,
    objectives: objectivesMoved(r.before.ut, r.after.ut, r.day),
    sp: spMoved(r.before.ut, r.after.ut, r.day, r.sport),
    rivals: r.online ? rivalsMoved(r.before.ut, r.after.ut, r.week) : null,
    minutes: r.minutesSec === null ? null : minutesMoved(r.before.playtime, r.minutesSec, r.now, r.sport),
    milestones: r.milestones,
    grade: r.grade,
    box: r.box,
    scoutDrop: null,
    league: null,
  };
}

/** What a finished match unlocked, as milestones (the old result screen's separate blocks, folded in). */
export function milestonesOf(m: {
  sport: UtSport;
  /** a Squad Battles rung (index from 0) cleared for the first time this week */
  climbed?: { rung: number; rungs: number; pack: string | null; level?: string };
  refreshed?: boolean;
  event?: { title: string; won: boolean; cleared: boolean; final: boolean };
  circuitPrizes?: string[];
  draft?: { wins: number; games: number; done: boolean };
  cupDone?: boolean;
  career?: CareerGain | null;
}): RecapMilestone[] {
  const out: RecapMilestone[] = [];
  if (m.career?.levelUps.length) {
    const top = m.career.levelUps[m.career.levelUps.length - 1];
    out.push({ id: 'career:' + top, title: 'LEVEL ' + top, line: '+' + m.career.coins + ' coins' + (m.career.boosters.length ? ' and a booster' : '') });
  }
  if (m.climbed) {
    const top = m.climbed.rung + 1 >= m.climbed.rungs;
    out.push({
      id: 'rung:' + m.climbed.rung,
      title: top ? 'LADDER CLEARED' : 'RUNG ' + (m.climbed.rung + 1) + ' CLEARED',
      line: m.climbed.pack
        ? 'Your ' + packName(m.climbed.pack, m.sport) + ' is waiting in the Store'
        : m.refreshed
          ? 'A new ladder is up' + (m.climbed.level ? ' on ' + m.climbed.level : '')
          : 'Next up: rung ' + (m.climbed.rung + 2),
      ...(m.climbed.pack ? { store: true } : {}),
    });
  }
  if (m.event?.won)
    out.push({
      id: 'event',
      title: m.event.cleared ? (m.event.final ? 'SERIES COMPLETE' : 'EVENT MATCH WON') : 'REPLAY COMPLETE',
      line: m.event.cleared ? 'Your first-clear reward is waiting in the Store' : 'This stage’s first-clear reward was already earned',
      ...(m.event.cleared ? { store: true } : {}),
    });
  for (const p of m.circuitPrizes ?? []) out.push({ id: 'circuit:' + p, title: 'CIRCUIT REWARD', line: p + ' · waiting in your Store', store: true });
  if (m.draft)
    out.push({
      id: 'draft',
      title: m.draft.done ? (m.draft.wins >= m.draft.games ? 'PERFECT DRAFT' : 'RUN OVER · ' + m.draft.wins + (m.draft.wins === 1 ? ' WIN' : ' WINS')) : m.draft.wins + ' / ' + m.draft.games + ' WINS',
      line: m.draft.done ? 'Claim your rewards in Play → UT Draft' : 'Win the next game to raise your reward',
    });
  if (m.cupDone) out.push({ id: 'cup', title: 'CUP OVER', line: 'See how your Cup finished in Club Cups' });
  return out;
}

// ---------- the One-More bar ----------

/** Consecutive losses ending with the latest match (a win or a draw ends the run). */
export function lossStreakOf(ut: UtState): number {
  const h = hqOf(ut).history;
  let n = 0;
  for (let i = h.length - 1; i >= 0 && !h[i].won && !h[i].draw; i--) n++;
  return n;
}

export interface MatchKind {
  online: boolean;
  cup?: unknown;
  circuit?: unknown;
  league?: unknown;
  draft?: unknown;
  event?: unknown;
  /** Squad Battles: the rung just played (from 0); absent for an AI that stepped in */
  rung?: number;
  level?: Difficulty;
}
export function modeOf(k: MatchKind): MatchSetupRef['mode'] {
  return k.cup ? 'cup' : k.circuit ? 'circuit' : k.league ? 'league' : k.draft ? 'draft' : k.online ? 'rivals' : k.event ? 'events' : 'battles';
}
/** Whether a run continues after this match (the bar then offers its next game). */
export function runContinues(ut: UtState, mode: MatchSetupRef['mode']): boolean {
  switch (mode) {
    case 'cup':
      return !!cupOf(ut).active && !cupOf(ut).active!.done;
    case 'circuit': {
      const c = hqOf(ut).circuit.active;
      return !!c && c.games < 6;
    }
    case 'league':
      return !!ut.league?.active && ut.league.active.phase !== 'complete' && !!leagueRequest(ut.league.active);
    case 'draft': {
      const d = contentOf(ut).draft?.active;
      return !!d && !d.done;
    }
    default:
      return false;
  }
}
/** The One-More context (next-action.ts AfterCtx) for a match, from the save as it settled. */
export function afterCtxOf(ut: UtState, k: MatchKind, r: { won: boolean; us: number; them: number; flawless?: boolean }): AfterCtx {
  const mode = modeOf(k);
  return {
    mode,
    won: r.won,
    us: r.us,
    them: r.them,
    lossStreak: r.won ? 0 : lossStreakOf(ut),
    ...(r.flawless ? { flawless: true } : {}),
    ...(mode === 'battles' && k.rung !== undefined && k.rung >= 0 ? { rung: k.rung, level: k.level } : {}),
    runContinues: runContinues(ut, mode),
  };
}

/** Where the One-More bar leads: a match to start at once (with a difficulty change first), or a screen. */
export type OneMoreStart =
  | { kind: 'match'; req: UtMatchRequest; level?: Difficulty }
  | { kind: 'view'; view: UtView };

/**
 * The bar's target as something to do. Squad Battles, Cup, Circuit, Club Season, UT Draft, Legends
 * Events and Rivals start the next match directly (`quick`: no vote, no kickoff screen); a target that
 * is a screen (a Moments drill, a finished run) opens that screen. `id` is the new match's id.
 */
export function oneMoreStart(a: NextAction, ut: UtState, k: MatchKind & { event?: { id: string; node: number } }, id: number, won: boolean): OneMoreStart {
  const t = a.target;
  if (t.app === 'ut') return { kind: 'view', view: t.view };
  if (t.app !== 'match') return { kind: 'view', view: 'hub' };
  const s = t.setup,
    quick = { id, mode: 'ai' as const, quick: true };
  switch (s.mode) {
    case 'battles': {
      const saved = DIFFICULTIES.includes(ut.battles.level as Difficulty) ? (ut.battles.level as Difficulty) : 'pro';
      return { kind: 'match', req: { ...quick, rung: s.rung ?? 0 }, ...(s.level && s.level !== saved ? { level: s.level } : {}) };
    }
    case 'cup': {
      const c = cupOf(ut).active;
      return c && !c.done ? { kind: 'match', req: { ...quick, cup: { runId: c.id, round: c.round } } } : { kind: 'view', view: 'cup' };
    }
    case 'circuit': {
      const c = hqOf(ut).circuit.active;
      return c && c.games < 6 ? { kind: 'match', req: { ...quick, circuit: { runId: c.id, round: c.games } } } : { kind: 'view', view: 'circuit' };
    }
    case 'league': {
      const l = ut.league?.active,
        req = l && l.phase !== 'complete' ? leagueRequest(l) : null;
      return req ? { kind: 'match', req: { ...quick, league: req } } : { kind: 'view', view: 'league' };
    }
    case 'draft': {
      const d = contentOf(ut).draft?.active;
      return d && !d.done ? { kind: 'match', req: { ...quick, draft: { runId: d.id, game: d.games } } } : { kind: 'view', view: 'draft' };
    }
    case 'events': {
      const e = k.event;
      return e ? { kind: 'match', req: { ...quick, event: { id: e.id, node: won ? Math.min(2, e.node + 1) : e.node } } } : { kind: 'view', view: 'events' };
    }
    case 'rivals':
      // online: back into the queue (the opponent is whoever is there; nothing to pre-load)
      return { kind: 'match', req: { id, mode: 'online' } };
    default:
      return { kind: 'view', view: 'moments' };
  }
}
