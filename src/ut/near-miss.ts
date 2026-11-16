// Claude, 2026-11-16 (studio overhaul, team ut-1): near-miss chips (V2 D.10, audit §5). At most three
// small chips, each a TRUE, deterministic distance to a real reward, read from the save ("1 win to
// Finalist", "2 wins to Pro", "1 game to today's bonus", "120 SP to level 7", "1 win to Gold Pack"),
// each leading where the step is taken (a GoTarget). Nothing here is random, inflated or invented:
// a chip only exists while its reward is genuinely that close, and the closest come first.
// Light like next-action.ts (claimables-graph.test.ts).
import { easternClock } from './claimables';
import type { GoTarget } from './go';
import { battlesNow, CIRCUIT_GAMES, CIRCUIT_STEPS, DAILY_BONUS_LINE, dailyLeft, packName, paidLeftOf, plural, rivalsNext, rungPays } from './next-action';
import { hqOf, seasonFor, SEASON_STEP, SEASON_TIERS, weekKey } from './objectives';
import type { UtState } from './state';
import type { UtSport } from './types';

export interface NearMiss {
  /** stable, for keys and tests */
  id: string;
  /** steps left: wins or games (SP converted at a won played match's 110 SP), ≥ 1 */
  steps: number;
  /** the chip: "1 win to Finalist" */
  text: string;
  go: GoTarget;
  stake?: string;
}

/** Season Points a played win earns (progression.ts recordMatchProgress: 80 + 30). */
export const SP_PER_WIN = 110;
/** A chip is "near" at one or two steps. */
export const NEAR_STEPS = 2;
export const MAX_CHIPS = 3;

/** Inputs from outside this save: sets one or two cards away (only the pool knows). */
export interface NearExtras {
  sets?: { id: string; title: string; left: number }[];
}

export function nearMisses(ut: UtState, sport: UtSport, now: number, extras: NearExtras = {}): NearMiss[] {
  const { day } = easternClock(now),
    week = weekKey(day),
    h = hqOf(ut),
    out: NearMiss[] = [];
  // Champions Circuit: the next prize, when it is still reachable in the games left
  const c = h.circuit.active;
  if (c && c.games < CIRCUIT_GAMES) {
    const next = CIRCUIT_STEPS.find(([w]) => w > c.wins && w - c.wins <= CIRCUIT_GAMES - c.games);
    if (next) out.push({ id: 'circuit', steps: next[0] - c.wins, text: plural(next[0] - c.wins, 'win') + ' to ' + next[1], go: { view: 'circuit', label: 'PLAY' } });
  }
  // Rivals: the next division reward this week
  const r = rivalsNext(ut, week);
  if (r) out.push({ id: 'rivals', steps: r.wins, text: plural(r.wins, 'win') + ' to ' + r.name, go: { view: 'rivals', label: 'RIVALS' }, stake: packName(r.pack, sport) });
  // today's three objectives: the last one
  const d = dailyLeft(ut, day);
  if (d && (d.unit !== 'point' || d.left <= 12))
    out.push({ id: 'daily', steps: d.unit === 'point' ? 1 : d.left, text: plural(d.left, d.unit) + " to today's bonus", go: { view: 'battles', label: 'PLAY' }, stake: DAILY_BONUS_LINE });
  // Season Pass: the next level, within half a level. SP is earned by playing, so the chip leads to a
  // match (the Season Pass screen only shows the track)
  const s = h.seasons[seasonFor(day).id],
    xp = s?.xp ?? 0,
    tier = Math.floor(xp / SEASON_STEP) + 1,
    left = tier * SEASON_STEP - xp;
  if (tier <= SEASON_TIERS && left <= SEASON_STEP / 2)
    out.push({ id: 'pass', steps: Math.ceil(left / SP_PER_WIN), text: left + ' SP to level ' + tier, go: { view: 'battles', label: 'PLAY' } });
  // Squad Battles: the next rung, while it still pays its pack (first clear this week, paid games left)
  const b = battlesNow(ut, week),
    rungPack = rungPays(b, b.rung, b.level, paidLeftOf(ut, day));
  if (rungPack) out.push({ id: 'battles', steps: 1, text: '1 win to ' + packName(rungPack, sport), go: { view: 'battles', label: 'PLAY' } });
  for (const x of extras.sets ?? [])
    if (x.left >= 1) out.push({ id: 'set:' + x.id, steps: x.left, text: plural(x.left, 'card') + ' away · ' + x.title, go: { view: 'sets', label: 'SETS' } });
  return out
    .filter((x) => x.steps >= 1 && x.steps <= NEAR_STEPS)
    .sort((a, b) => a.steps - b.steps || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, MAX_CHIPS);
}
