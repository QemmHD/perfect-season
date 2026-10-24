// Daily missions and the daily reward streak.
import { hashString, rng, shuffle } from './rng';

/** What a finished game tells the missions. */
export interface GameEvent {
  mode: 'classic' | 'blind' | 'daily' | '1v1';
  wins: number;
  series: number;
  title: boolean;
  sweeps: number;
  balance: number;
  legends: number;
  /** 1v1 result: true won, false lost, null draw or not a 1v1 */
  vsWon: boolean | null;
  /** against a real player */
  online: boolean;
}

export interface Mission {
  id: string;
  text: string;
  goal: number;
  coins: number;
  xp: number;
  /** how much a finished game moves it forward */
  step: (e: GameEvent) => number;
}

const season = (e: GameEvent) => e.mode !== '1v1';

const EASY: Mission[] = [
  { id: 'play3', text: 'Finish 3 games', goal: 3, coins: 30, xp: 30, step: () => 1 },
  { id: 'daily', text: 'Play today’s Daily', goal: 1, coins: 30, xp: 30, step: (e) => (e.mode === 'daily' ? 1 : 0) },
  { id: 'h2h2', text: 'Play 2 Head to Head matches', goal: 2, coins: 30, xp: 30, step: (e) => (e.mode === '1v1' ? 1 : 0) },
  { id: 'blind', text: 'Finish a Blind draft', goal: 1, coins: 30, xp: 30, step: (e) => (e.mode === 'blind' ? 1 : 0) },
];
const MEDIUM: Mission[] = [
  { id: 'playoffs2', text: 'Make the playoffs twice', goal: 2, coins: 50, xp: 50, step: (e) => (season(e) && e.wins >= 50 ? 1 : 0) },
  { id: 'series', text: 'Win a playoff series', goal: 1, coins: 50, xp: 50, step: (e) => (e.series > 0 ? 1 : 0) },
  { id: 'legend', text: 'Draft a Legendary player', goal: 1, coins: 50, xp: 50, step: (e) => (e.legends > 0 ? 1 : 0) },
  { id: 'h2hwin', text: 'Win a Head to Head match', goal: 1, coins: 50, xp: 50, step: (e) => (e.vsWon === true ? 1 : 0) },
  { id: 'balance', text: 'Finish a season with 90%+ balance', goal: 1, coins: 50, xp: 50, step: (e) => (season(e) && e.balance >= 0.9 ? 1 : 0) },
];
const HARD: Mission[] = [
  { id: 'wins62', text: 'Win 62+ games in a season', goal: 1, coins: 80, xp: 80, step: (e) => (season(e) && e.wins >= 62 ? 1 : 0) },
  { id: 'title', text: 'Win a championship', goal: 1, coins: 80, xp: 80, step: (e) => (e.title ? 1 : 0) },
  { id: 'sweep', text: 'Sweep a playoff series 4–0', goal: 1, coins: 80, xp: 80, step: (e) => (e.sweeps > 0 ? 1 : 0) },
  { id: 'legend2', text: 'Draft 2 Legendary players in one team', goal: 1, coins: 80, xp: 80, step: (e) => (e.legends >= 2 ? 1 : 0) },
  { id: 'realwin', text: 'Beat a real player in Head to Head', goal: 1, coins: 80, xp: 80, step: (e) => (e.online && e.vsWon === true ? 1 : 0) },
];

/** Finishing all three missions pays this on top. */
export const ALL_MISSIONS_BONUS = 60;

/** The day's three missions: one easy, one medium, one hard, the same for everyone. */
export function missionsFor(day: string): Mission[] {
  const r = rng(hashString('perfect-season-missions:' + day));
  return [shuffle(EASY, r)[0], shuffle(MEDIUM, r)[0], shuffle(HARD, r)[0]];
}

export function missionById(day: string, i: number): Mission {
  return missionsFor(day)[i];
}

/** Progress after one game. Returns the new progress and the missions it just completed. */
export function advance(day: string, progress: number[], e: GameEvent): { progress: number[]; completed: number[] } {
  const list = missionsFor(day);
  const next = list.map((m, i) => Math.min(m.goal, (progress[i] ?? 0) + m.step(e)));
  const completed = list.map((_, i) => i).filter((i) => next[i] >= list[i].goal && (progress[i] ?? 0) < list[i].goal);
  return { progress: next, completed };
}

// ---------- daily reward ----------

/** The calendar day before an Eastern date key. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return t.toISOString().slice(0, 10);
}

/** Opening today's reward continues the streak from yesterday, or starts it again at 1. */
export function nextStreak(streak: { count: number; last: string | null; best: number }, today: string): { count: number; last: string; best: number } {
  if (streak.last === today) return { ...streak, last: today };
  const count = streak.last === dayBefore(today) ? streak.count + 1 : 1;
  return { count, last: today, best: Math.max(streak.best, count) };
}

/** Coins in the daily chest: 25 on day 1, 15 more each day, topping out on day 7. */
export function rewardFor(streakDay: number): { coins: number; xp: number } {
  const d = Math.min(7, Math.max(1, streakDay));
  return { coins: 25 + 15 * (d - 1), xp: 20 + 5 * (d - 1) };
}
