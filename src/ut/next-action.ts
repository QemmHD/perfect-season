// Claude, 2026-11-16 (studio overhaul, team ut-1): the next best action (Game Design V2 D.5, contract
// W6 in docs/studio-overhaul/ut-plan.md). One engine for four surfaces: the main Home "Next up" strip,
// the UT Hub hero, the One-More bar at the end of a match and the session-end summary. It is a pure
// function of a small context (NextCtx) built from the save by nextCtxOf, so it is cheap (≤ 2 ms on a
// 3,000-card club, next-action.test.ts) and light: it never loads pool, packs, cards, sbc, rate or
// squad (claimables-graph.test.ts).
//
// Priority, first match wins:
//    1  unclaimed rewards: this sport's claimables, then another sport's, the first-run starter pack,
//       Minutes rungs once ut-2 lands (the Daily Drop claim is drawn amber when its streak is at risk)
//    2  an unfinished run (the most recently played)
//    3  a play streak at risk today (ut-7 slot)
//    4  something ending within 24 h
//    5  1–2 steps from a milestone
//    6  the Daily Play if unplayed (B1 slot)
//    7  a daily objective at 2 of 3
//    8  Season Pass within 30% of a named reward
//    9  a new program wave in its first 48 h (packs slot)
//   10  unopened packs or picks
//   11  the best next match in your recent mode
//   12  Done for today (when the day's goals are met)
// It never says "Done for today" while anything is claimable: claims come first and Done is last.
// The One-More bar keeps the same rule: it turns calm only when nothing waits to be claimed or opened.
//
// With `ctx.after` (a finished match) it returns the One-More target instead (V2 D.10): a lower rung
// or a drill after a third straight loss, REMATCH after a loss by one score, the harder rung after a
// FLAWLESS win, otherwise the next game of the run or ladder. Done for today keeps the match one tap
// away but stops pushing. With `after`, pass the save as settled by that match (the One-More bar is
// shown after the tally); a rung's pack is named only while that rung still pays it (rungPays).
//
// Slots later tasks fill take their value from `extras` and are null until then: Minutes rungs
// (ut-2), the weekly league line and Career Road level (ut-8), the Daily Play (B1), program waves
// (packs' promo-hub).
import { easternClock, utClaimables, type Claimables } from './claimables';
import { contentOf } from './content-state';
import { LABEL, MODE_LABEL } from './labels';
import { seasonGames } from './league-state';
import { DAILY, hqOf, objectiveDeck, seasonFor, seasonReward, SEASON_STEP, SEASON_TIERS, weekKey, WEEKLY } from './objectives';
import { DIVISIONS, RIVALS_WIN_RP, divisionOf, rivalsOf } from './rivals';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { UtView } from './UltimateTeam';

// ---------- constants mirrored from heavy modules (pinned by next-action.test.ts) ----------

/** play.ts PAID_GAMES_A_DAY */
export const PAID_CAP = 8;
/** battles.ts RUNGS, LEVELS, LEVEL_NAME and each difficulty's rung packs (LEVEL[level].packs) */
export const RUNGS = 8;
export type Difficulty = 'rookie' | 'pro' | 'allstar' | 'legend';
export const DIFFICULTIES: Difficulty[] = ['rookie', 'pro', 'allstar', 'legend'];
export const DIFFICULTY_NAME: Record<Difficulty, string> = { rookie: 'Rookie', pro: 'Pro', allstar: 'All-Star', legend: 'Legend' };
export const RUNG_PACKS: Record<Difficulty, Record<number, string>> = {
  rookie: { 3: 'bronze', 7: 'silver' },
  pro: { 3: 'silver', 7: 'gold' },
  allstar: { 3: 'gold', 7: 'premium' },
  legend: { 1: 'gold', 3: 'gold', 5: 'premium', 7: 'premium' },
};
/** circuit.ts CIRCUIT_GAMES and CIRCUIT_PRIZES (wins, title) */
export const CIRCUIT_GAMES = 6;
export const CIRCUIT_STEPS: [wins: number, title: string][] = [
  [2, 'Contender'],
  [4, 'Finalist'],
  [6, 'Champion'],
];
/** cup.ts: a Cup is three knockout rounds */
export const CUP_ROUNDS = 3;
/** daily-hub.ts DAILY_BONUS: today's all-three bonus */
export const DAILY_BONUS_REWARD = { coins: 100, pack: 'silver' };
/** "One score": a loss this close offers REMATCH first (points; a basket, a touchdown, a goal) */
export const ONE_SCORE: Record<UtSport, number> = { nba: 3, nfl: 8, soccer: 1 };

// ---------- the action ----------

/** Where an action leads. `sport` is set when it is another sport's Ultimate Team. */
export type Target =
  | { app: 'ut'; view: UtView; sport?: UtSport }
  | { app: 'draft'; mode: 'classic' | 'blind' | 'daily' | 'h2h' }
  | { app: 'minutes' }
  | { app: 'match'; setup: MatchSetupRef };

/** The next match, chosen and ready to start (ut-5's One-More bar starts it through the existing path). */
export interface MatchSetupRef {
  mode: 'battles' | 'cup' | 'circuit' | 'league' | 'draft' | 'rivals' | 'events' | 'moments';
  /** Squad Battles: the rung index and difficulty */
  rung?: number;
  level?: Difficulty;
  /** the same opponent again */
  rematch?: boolean;
}

export interface NextAction {
  /** stable: 'claim', 'claim:nfl', 'run:cup', 'streak', 'after:rematch', 'done' … */
  id: string;
  /** one line with the true distance: "6 rewards to claim", "1 win to Finalist" */
  line: string;
  /** the button's word: CLAIM ALL, RESUME, PLAY, OPEN, REMATCH, KEEP PLAYING */
  cta: string;
  target: Target;
  /** what is at stake, in a few words: "Gold Pack", "250 coins" */
  stake?: string;
  /** a clock is running (under 24 h): drawn amber */
  amber?: boolean;
  /** the day's goals are met: drawn calm, never pushed */
  done?: boolean;
}

export interface RunInfo {
  kind: 'cup' | 'circuit' | 'league' | 'draft';
  line: string;
  /** last started or played (ms): the most recent run wins */
  at: number;
}
export interface Ending {
  id: string;
  line: string;
  hoursLeft: number;
  target: Target;
  stake?: string;
}
export interface Milestone {
  id: string;
  /** steps left (1 or 2: wins, games, minutes ≤ 5) */
  steps: number;
  line: string;
  target: Target;
  stake?: string;
}

/** What a finished match adds (the One-More bar). */
export interface AfterCtx {
  mode: MatchSetupRef['mode'];
  won: boolean;
  us: number;
  them: number;
  /** consecutive losses including this one (0 after a win) */
  lossStreak: number;
  /** the engine's FLAWLESS flag (V2 C1 grade), when the sport reports it */
  flawless?: boolean;
  /** Squad Battles: the rung just played and its difficulty */
  rung?: number;
  level?: Difficulty;
  /** the run continues: its next game exists (Cup round, Circuit game, season game, draft game) */
  runContinues?: boolean;
}

export interface NextCtx {
  sport: UtSport;
  day: string;
  hoursLeft: number;
  claim: Claimables;
  /** other sports' claimable counts (their stored light count; never their pools) */
  elsewhere: { sport: UtSport; count: number }[];
  starter: boolean;
  /** ut-2: claimable Minutes rungs */
  minutes: { n: number; line: string } | null;
  runs: RunInfo[];
  /** ut-7: the play streak at risk today (V2 D.13). The Daily Drop streak, which needs a claim, is
   * flagged on the claim action itself (`claim.streakAtRisk`). */
  streak: { line: string; target: Target } | null;
  ending: Ending[];
  milestones: Milestone[];
  /** B1: today's Daily Play, when not yet played */
  dailyPlay: { line: string; target: Target } | null;
  /** a daily objective left with the other two done */
  dailyLast: { line: string; stake: string } | null;
  pass: { line: string; stake: string } | null;
  /** packs: a program wave in its first 48 h */
  wave: { line: string; target: Target } | null;
  packs: number;
  picks: number;
  recent: { setup: MatchSetupRef; line: string; stake?: string };
  /** Squad Battles this week: rungs cleared on this week's ladder (0–RUNGS) and the saved difficulty (battlesNow) */
  battles: { cleared: number; level: Difficulty };
  today: { dailiesDone: boolean; paidLeft: number; minutesCapped: boolean };
  after?: AfterCtx;
}

/** Inputs nextCtxOf cannot read from this sport's save. Each is optional; absent means "none yet". */
export interface NextExtras {
  elsewhere?: { sport: UtSport; count: number }[];
  minutes?: NextCtx['minutes'];
  minutesCapped?: boolean;
  streak?: NextCtx['streak'];
  milestones?: Milestone[];
  dailyPlay?: NextCtx['dailyPlay'];
  wave?: NextCtx['wave'];
  after?: AfterCtx;
}

const ut$ = (view: UtView): Target => ({ app: 'ut', view });
export const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
/** soccer has no Spotlight editions: its Spotlight prizes are Elite Gold packs (progression.ts depositPrize) */
const SPOTLIGHT_NAME: Record<UtSport, string> = { nba: 'Spotlight Pack', nfl: 'Spotlight Pack', soccer: 'Elite Gold Pack' };
export const packName = (kind: string, sport?: UtSport) =>
  kind === 'spotlight' && sport ? SPOTLIGHT_NAME[sport] : kind[0].toUpperCase() + kind.slice(1) + ' Pack';
/** "100 coins + Silver Pack": today's all-three bonus, built from DAILY_BONUS_REWARD */
export const DAILY_BONUS_LINE = DAILY_BONUS_REWARD.coins + ' coins + ' + packName(DAILY_BONUS_REWARD.pack);

// ---------- reading the save ----------

/**
 * Squad Battles this week: the next rung to play (`rung`), rungs cleared so far (`cleared`: 0 on a new
 * week; RUNGS on an old save that cleared the whole ladder before it refreshed) and the difficulty.
 */
export function battlesNow(ut: UtState, week: string): { rung: number; cleared: number; level: Difficulty } {
  const b = ut.battles,
    level = DIFFICULTIES.includes(b.level as Difficulty) ? (b.level as Difficulty) : 'pro';
  const cleared = b.week === week ? b.cleared : 0;
  return { rung: Math.min(cleared, RUNGS - 1), cleared, level };
}
/** play.ts PAID_GAMES_A_DAY left today (a capped match pays no coins, XP or rung pack). */
export function paidLeftOf(ut: UtState, day: string): number {
  return Math.max(0, PAID_CAP - (ut.paid.day === day ? ut.paid.n : 0));
}
/**
 * The pack a win on `rung` of `level` would pay, if any. A rung pays only the first time it is
 * cleared on this week's ladder (play.ts: a win on rung `cleared` climbs; Battles.tsx shows the pack
 * only from `cleared` up) and never once the day's paid games are played. Another difficulty starts
 * its ladder at rung 1 (Battles.tsx onLevel), so all its rungs are still to clear.
 */
export function rungPays(b: { cleared: number; level: Difficulty }, rung: number, level: Difficulty, paidLeft: number): string | undefined {
  if (paidLeft <= 0) return undefined;
  return rung >= (level === b.level ? b.cleared : 0) ? RUNG_PACKS[level][rung] : undefined;
}
/** A rung's line, and its stake when it still pays a pack (`pack`, from rungPays). */
function battlesLine(rung: number, level: Difficulty, pack?: string): { line: string; stake?: string } {
  return {
    line: LABEL.squadBattles + ' · ' + DIFFICULTY_NAME[level] + ' rung ' + (rung + 1) + ' of ' + RUNGS,
    ...(pack ? { stake: packName(pack) } : {}),
  };
}

function runsOf(ut: UtState, sport: UtSport): RunInfo[] {
  const h = hqOf(ut),
    out: RunInfo[] = [];
  const last = (mode: string, from: number) => Math.max(from, ...h.history.filter((m) => m.mode === mode && m.at >= from).map((m) => m.at));
  const cup = ut.cup?.active;
  if (cup && !cup.done && cup.sport === sport)
    out.push({ kind: 'cup', at: Math.max(cup.at, ...cup.results.map((r) => r.at)), line: MODE_LABEL.cup + ' · round ' + (cup.results.length + 1) + ' of ' + CUP_ROUNDS });
  const c = h.circuit.active;
  if (c && c.games < CIRCUIT_GAMES) {
    const next = CIRCUIT_STEPS.find(([w]) => w > c.wins && w - c.wins <= CIRCUIT_GAMES - c.games);
    out.push({
      kind: 'circuit',
      at: last('circuit', c.at),
      line: next
        ? plural(next[0] - c.wins, 'win') + ' to ' + next[1] + ' · ' + MODE_LABEL.circuit
        : MODE_LABEL.circuit + ' · match ' + (c.games + 1) + ' of ' + CIRCUIT_GAMES,
    });
  }
  const s = ut.league?.active;
  if (s && s.phase !== 'complete' && sport !== 'soccer') {
    const me = s.teams[0];
    out.push({
      kind: 'league',
      at: last('league', s.at),
      line:
        s.phase === 'playoffs'
          ? MODE_LABEL.league + ' playoffs · ' + me.w + '–' + me.l
          : MODE_LABEL.league + ' · ' + me.w + '–' + me.l + ' · game ' + (me.w + me.l + 1) + ' of ' + seasonGames(sport),
    });
  }
  const d = contentOf(ut).draft?.active;
  if (d && !d.done)
    out.push({ kind: 'draft', at: last('draft', d.at), line: MODE_LABEL.draft + (d.results.length ? ' · game ' + (d.results.length + 1) + ' · ' + plural(d.wins, 'win') : ' · finish your squad') });
  return out.sort((a, b) => b.at - a.at);
}

/** Weekly goals within two games of done, when the week ends within 24 h (Sunday, Eastern). */
function endingOf(ut: UtState, day: string, week: string, hoursLeft: number): Ending[] {
  const tomorrow = new Date(Date.parse(day + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  if (weekKey(tomorrow) === week) return [];
  const out: Ending[] = [];
  const h = hqOf(ut),
    counts = h.weeks[week];
  for (const [id, , counter, target, reward] of WEEKLY) {
    const claim = 'weekly:' + week + ':' + id,
      left = target - (counts?.[counter] ?? 0);
    if (h.claims.includes(claim) || left <= 0 || left > 2 || (counter !== 'games' && counter !== 'wins')) continue;
    out.push({
      id: 'ending:' + claim,
      line: plural(left, counter === 'wins' ? 'win' : 'game') + ' to a weekly objective · ends tonight',
      hoursLeft,
      target: ut$('battles'),
      stake: reward.pack ? packName(reward.pack) : (reward.coins ?? 0) + ' coins',
    });
  }
  const next = rivalsNext(ut, week),
    r = rivalsOf(ut.rivals, week);
  if (next && next.wins <= 2 && r.w + r.l > 0)
    out.push({ id: 'ending:rivals', line: plural(next.wins, 'win') + ' to ' + next.name + ' · ' + LABEL.rivals + ' week ends tonight', hoursLeft, target: ut$('rivals'), stake: packName(next.pack) });
  return out;
}

/**
 * The next Rivals division reward not yet earned this week, and the wins it takes. A reward is
 * earned when the week's best reaches the division and the week's wins reach its count
 * (rivals.ts rivalsMatch); every win adds RIVALS_WIN_RP and one win, so the larger gap decides.
 */
export function rivalsNext(ut: UtState, week: string): { name: string; pack: string; wins: number } | null {
  const r = rivalsOf(ut.rivals, week);
  for (let i = 0; i < DIVISIONS.length; i++) {
    const d = DIVISIONS[i],
      key = week + ':' + i;
    if (r.rewards.some((x) => x.id === key) || r.claimed.includes(key)) continue;
    const forPoints = d.at <= r.best ? 0 : Math.ceil((d.at - r.points) / RIVALS_WIN_RP);
    return { name: d.name, pack: d.pack, wins: Math.max(forPoints, d.wins - r.w, 1) };
  }
  return null;
}
/** Rivals 1–2 wins from the next division's reward (the weekly "promotion line"), once the week has begun. */
function rivalsMilestone(ut: UtState, week: string): Milestone | null {
  const r = rivalsOf(ut.rivals, week),
    next = rivalsNext(ut, week);
  if (!next || next.wins > 2 || r.w + r.l === 0) return null;
  return { id: 'milestone:rivals:' + next.name, steps: next.wins, line: plural(next.wins, 'win') + ' to ' + next.name + ' · ' + LABEL.rivals, target: ut$('rivals'), stake: packName(next.pack) };
}

/** Today's last daily objective when the other two are done: what is left of it. */
export function dailyLeft(ut: UtState, day: string, deck = objectiveDeck(ut, day)): { left: number; unit: string } | null {
  const today = deck.filter((o) => o.group === 'daily' && o.period === day);
  const open = today.filter((o) => !o.claimed && o.progress < o.target);
  if (today.length !== DAILY.length || open.length !== 1) return null;
  const o = open[0];
  return { left: o.target - o.progress, unit: o.counter === 'points' ? 'point' : o.counter === 'wins' ? 'win' : 'game' };
}
function dailyLastOf(ut: UtState, day: string, deck: ReturnType<typeof objectiveDeck>): NextCtx['dailyLast'] {
  const d = dailyLeft(ut, day, deck);
  return d ? { line: plural(d.left, d.unit) + " to today's three objectives", stake: DAILY_BONUS_LINE } : null;
}

/** The next Season Pass tier that pays a pack, when the SP left is within 30% of the way there. */
function passOf(ut: UtState, day: string, sport: UtSport): NextCtx['pass'] {
  const s = hqOf(ut).seasons[seasonFor(day).id],
    xp = s?.xp ?? 0,
    reached = Math.floor(xp / SEASON_STEP);
  let prev = 0;
  for (let t = 1; t <= SEASON_TIERS; t++) {
    const r = seasonReward(t);
    if (!r.pack) continue;
    if (t <= reached) {
      prev = t;
      continue;
    }
    const left = t * SEASON_STEP - xp,
      span = (t - prev) * SEASON_STEP;
    if (left > 0.3 * span) return null;
    return { line: left + ' SP to level ' + t + ' · ' + LABEL.seasonPass, stake: packName(r.pack, sport) };
  }
  return null;
}

function recentOf(ut: UtState, sport: UtSport, week: string, paidLeft: number): NextCtx['recent'] {
  const h = hqOf(ut).history,
    last = h[h.length - 1]?.mode;
  const b = battlesNow(ut, week);
  const battles = (): NextCtx['recent'] => ({ setup: { mode: 'battles', rung: b.rung, level: b.level }, ...battlesLine(b.rung, b.level, rungPays(b, b.rung, b.level, paidLeft)) });
  switch (last) {
    case 'online':
      return { setup: { mode: 'rivals' }, line: LABEL.rivals + ' · ' + DIVISIONS[divisionOf(rivalsOf(ut.rivals, week).points)].name };
    case 'event':
      return sport === 'soccer' ? battles() : { setup: { mode: 'events' }, line: LABEL.legendsEvents };
    default:
      return battles();
  }
}

/** The context for `nextUp`, read from one sport's Ultimate Team save. */
export function nextCtxOf(ut: UtState, sport: UtSport, now: number, extras: NextExtras = {}): NextCtx {
  const { day, hoursLeft } = easternClock(now),
    week = weekKey(day),
    deck = objectiveDeck(ut, day),
    claim = utClaimables(ut, day, week, sport, now, deck);
  const today = deck.filter((o) => o.group === 'daily' && o.period === day);
  const rivalsM = rivalsMilestone(ut, week),
    paidLeft = paidLeftOf(ut, day),
    b = battlesNow(ut, week);
  return {
    sport,
    day,
    hoursLeft,
    claim,
    elsewhere: (extras.elsewhere ?? []).filter((e) => e.sport !== sport && e.count > 0),
    starter: !ut.starterClaimed,
    minutes: extras.minutes ?? null,
    runs: runsOf(ut, sport),
    streak: extras.streak ?? null,
    ending: endingOf(ut, day, week, hoursLeft),
    milestones: [...(extras.milestones ?? []), ...(rivalsM ? [rivalsM] : [])],
    dailyPlay: extras.dailyPlay ?? null,
    dailyLast: dailyLastOf(ut, day, deck),
    pass: passOf(ut, day, sport),
    wave: extras.wave ?? null,
    packs: claim.packs,
    picks: claim.picks,
    recent: recentOf(ut, sport, week, paidLeft),
    battles: { cleared: b.cleared, level: b.level },
    today: {
      dailiesDone: today.length > 0 && today.every((o) => o.claimed || o.progress >= o.target),
      paidLeft,
      minutesCapped: !!extras.minutesCapped,
    },
    ...(extras.after ? { after: extras.after } : {}),
  };
}

// ---------- the choice ----------

const doneToday = (c: NextCtx) => c.today.dailiesDone || c.today.paidLeft === 0 || c.today.minutesCapped;
/** Rewards waiting to be claimed or opened, here or in another sport: never "Done for today" over these. */
const waiting = (c: NextCtx) => c.claim.count > 0 || (c.minutes?.n ?? 0) > 0 || c.elsewhere.length > 0 || c.starter || c.packs > 0 || c.picks > 0;
/** "Done for today" applies: the day's goals are met and nothing waits. */
const calmNow = (c: NextCtx) => doneToday(c) && !waiting(c);
const DONE_LINE = 'Matches still count for your record and Season Pass';
/** ut-3 (V2 D.11): the calm line once the day's 90 Minutes are in. */
export const MINUTES_DONE_LINE = 'Matches still pay coins as usual and count for your Career XP';

/** The One-More bar: the best next match after the one just finished (V2 D.1, D.10). */
function oneMore(c: NextCtx, a: AfterCtx): NextAction {
  const calm = calmNow(c);
  const wrap = (x: NextAction): NextAction => (calm ? { ...x, id: 'done:' + x.id, cta: 'KEEP PLAYING', done: true, line: LABEL.doneForToday + ' · ' + x.line } : x);
  const level = a.level ?? c.battles.level,
    rung = a.rung ?? 0,
    // a rung's pack, only while that rung still pays it (never a replay of a cleared rung)
    line = (r: number, l: Difficulty) => battlesLine(r, l, rungPays(c.battles, r, l, c.today.paidLeft));
  if (!a.won && a.lossStreak >= 3) {
    if (a.mode === 'battles' && rung > 0) {
      const l = line(rung - 1, level);
      return wrap({ id: 'after:easier', line: 'Reset the rhythm · ' + l.line, cta: 'PLAY', target: { app: 'match', setup: { mode: 'battles', rung: rung - 1, level } }, ...(l.stake ? { stake: l.stake } : {}) });
    }
    const easier = DIFFICULTIES[DIFFICULTIES.indexOf(level) - 1];
    if (a.mode === 'battles' && easier) {
      const l = line(0, easier);
      return wrap({ id: 'after:easier', line: 'Try ' + DIFFICULTY_NAME[easier] + ' · ' + l.line, cta: 'PLAY', target: { app: 'match', setup: { mode: 'battles', rung: 0, level: easier } }, ...(l.stake ? { stake: l.stake } : {}) });
    }
    if (c.sport !== 'soccer')
      return wrap({ id: 'after:drill', line: 'Sharpen up in a ' + LABEL.moments.slice(0, -1) + ' drill · 60 s', cta: 'DRILL', target: ut$('moments') });
  }
  if (!a.won && a.them - a.us > 0 && a.them - a.us <= ONE_SCORE[c.sport])
    return wrap({
      id: 'after:rematch',
      line: 'Lost by ' + plural(a.them - a.us, c.sport === 'soccer' ? 'goal' : 'point') + ' · run it back',
      cta: 'REMATCH',
      target: { app: 'match', setup: { mode: a.mode, rematch: true, ...(a.mode === 'battles' ? { rung, level } : {}) } },
    });
  if (a.won && a.flawless && a.mode === 'battles') {
    const up = rung + 1 < RUNGS ? { rung: rung + 1, level } : DIFFICULTIES[DIFFICULTIES.indexOf(level) + 1] ? { rung: 0, level: DIFFICULTIES[DIFFICULTIES.indexOf(level) + 1] } : null;
    if (up) {
      const l = line(up.rung, up.level);
      return wrap({ id: 'after:harder', line: 'FLAWLESS · step up: ' + l.line, cta: 'PLAY', target: { app: 'match', setup: { mode: 'battles', ...up } }, ...(l.stake ? { stake: l.stake } : {}) });
    }
  }
  if (a.runContinues && (a.mode === 'cup' || a.mode === 'circuit' || a.mode === 'league' || a.mode === 'draft')) {
    const run = c.runs.find((r) => r.kind === a.mode);
    return wrap({ id: 'after:run:' + a.mode, line: run?.line ?? MODE_LABEL[a.mode], cta: 'NEXT', target: { app: 'match', setup: { mode: a.mode } } });
  }
  if (a.mode === 'battles') {
    // a win on the top rung brings the next ladder up at rung 1 (play.ts `refreshed`)
    const next = a.won ? (rung + 1 < RUNGS ? rung + 1 : 0) : rung;
    const l = line(next, level);
    return wrap({ id: 'after:battles', line: (l.stake ? '1 win to ' + l.stake + ' · ' : '') + l.line, cta: 'NEXT', target: { app: 'match', setup: { mode: 'battles', rung: next, level } }, ...(l.stake ? { stake: l.stake } : {}) });
  }
  return wrap({ id: 'after:recent', line: c.recent.line, cta: 'PLAY', target: { app: 'match', setup: c.recent.setup }, ...(c.recent.stake ? { stake: c.recent.stake } : {}) });
}

/** The single best thing to do next (V2 D.5). */
export function nextUp(c: NextCtx): NextAction {
  if (c.after) return oneMore(c, c.after);
  // 1. unclaimed rewards
  const minutes = c.minutes?.n ?? 0,
    claims = c.claim.count + minutes;
  if (claims > 0) {
    const line = claims === 1 ? (minutes ? c.minutes!.line : (c.claim.lines[0] ?? '1 reward') + ' · ready') : plural(claims, 'reward') + ' to claim';
    // the Daily Drop streak ends at Eastern midnight: the claim that keeps it is drawn amber
    const risk = c.claim.streakAtRisk;
    return {
      id: 'claim',
      line: risk ? 'Day ' + c.claim.dropDay + ' streak ends at midnight · ' + line : line,
      cta: claims === 1 ? 'CLAIM' : 'CLAIM ALL',
      target: c.claim.count ? ut$('inbox') : { app: 'minutes' },
      ...(risk ? { amber: true } : {}),
    };
  }
  const other = c.elsewhere[0];
  if (other)
    return {
      id: 'claim:' + other.sport,
      line: plural(other.count, 'reward') + ' to claim in ' + other.sport.toUpperCase() + ' ' + LABEL.ultimateTeam,
      cta: 'CLAIM',
      target: { app: 'ut', view: 'inbox', sport: other.sport },
    };
  if (c.starter) return { id: 'starter', line: 'Your starter pack is waiting', cta: 'OPEN', target: ut$('hub'), stake: 'Starter Pack' };
  // 2. an unfinished run
  const run = c.runs[0];
  if (run) return { id: 'run:' + run.kind, line: run.line, cta: 'RESUME', target: ut$(run.kind) };
  // 3. the play streak at risk today (ut-7)
  if (c.streak) return { id: 'streak', line: c.streak.line, cta: 'PLAY', target: c.streak.target, amber: true };
  // 4. ending within 24 h
  const end = [...c.ending].filter((e) => e.hoursLeft < 24).sort((a, b) => a.hoursLeft - b.hoursLeft || (a.id < b.id ? -1 : 1))[0];
  if (end) return { id: end.id, line: end.line, cta: 'GO', target: end.target, amber: true, ...(end.stake ? { stake: end.stake } : {}) };
  // 5. one or two steps from a milestone
  const m = [...c.milestones].filter((x) => x.steps >= 1 && x.steps <= 2).sort((a, b) => a.steps - b.steps || (a.id < b.id ? -1 : 1))[0];
  if (m) return { id: m.id, line: m.line, cta: 'GO', target: m.target, ...(m.stake ? { stake: m.stake } : {}) };
  // 6. the Daily Play
  if (c.dailyPlay) return { id: 'daily-play', line: c.dailyPlay.line, cta: 'PLAY', target: c.dailyPlay.target };
  // 7. a daily objective at 2 of 3
  if (c.dailyLast) return { id: 'daily-last', line: c.dailyLast.line, cta: 'PLAY', target: ut$('battles'), stake: c.dailyLast.stake };
  // 8. Season Pass near a named reward
  if (c.pass) return { id: 'pass', line: c.pass.line, cta: 'PLAY', target: { app: 'match', setup: c.recent.setup }, stake: c.pass.stake };
  // 9. a new program wave
  if (c.wave) return { id: 'wave', line: c.wave.line, cta: 'SEE', target: c.wave.target };
  // 10. unopened packs or picks
  if (c.packs || c.picks)
    return {
      id: 'packs',
      line: c.packs ? plural(c.packs, 'pack') + ' to open' + (c.picks ? ' · ' + plural(c.picks, 'pick') : '') : plural(c.picks, 'pick') + ' to choose',
      cta: 'OPEN',
      target: ut$('store'),
    };
  // 11/12. the best next match, or Done for today once the day's goals are met
  const play: NextAction = { id: 'play', line: c.recent.line, cta: 'PLAY', target: { app: 'match', setup: c.recent.setup }, ...(c.recent.stake ? { stake: c.recent.stake } : {}) };
  if (calmNow(c)) return { id: 'done', line: LABEL.doneForToday + ' · ' + (c.today.minutesCapped ? MINUTES_DONE_LINE : DONE_LINE), cta: 'KEEP PLAYING', target: play.target, done: true };
  return play;
}
