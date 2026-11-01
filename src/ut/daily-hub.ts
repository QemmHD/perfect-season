// Claude, 2026-11-01 (wave 2): the Daily hub on Home (Daily Drop + login calendar + daily
// objectives). Modelled on EA FC 27: a 5-day login calendar that moves on each day you claim (missed
// days don't reset it; FC: D1 pack, D2 consumables, D3 SP, D4 pick 1 of 2, D5 boost) and three
// daily objectives with a bonus for finishing all three. The three objectives are Codex's existing
// HQ dailies (progression.ts); this adds the all-three bonus (`daily-bonus:<day>`) and the calendar.
import { hashString, rng, shuffle } from '../engine/rng';
import { claimed, contentOf, withClaim } from './content-state';
import { addPick } from './content-packs';
import type { Pool } from './pool';
import { addSeasonXP, objectiveDeck } from './progression';
import { fcToDisplay } from './fc-scale';
import type { UtState } from './state';

export const CALENDAR_DAYS = 5;
export interface CalendarReward {
  day: number;
  label: string;
  coins?: number;
  pack?: string;
  sp?: number;
  pick?: true;
}
export const CALENDAR: CalendarReward[] = [
  { day: 1, label: 'Silver Pack + 100 coins', pack: 'silver', coins: 100 },
  { day: 2, label: '300 coins', coins: 300 },
  { day: 3, label: '200 Season Points', sp: 200 },
  { day: 4, label: 'Gold pick: 1 of 2', pick: true },
  { day: 5, label: 'Gold Pack + 500 coins', pack: 'gold', coins: 500 },
];

/** Today's calendar step (1-5) and whether it can be claimed. */
export function calendarStatus(ut: UtState, day: string): { ready: boolean; step: number } {
  const c = contentOf(ut).calendar;
  const done = c?.n ?? 0;
  if (c?.day === day) return { ready: false, step: ((done - 1) % CALENDAR_DAYS) + 1 };
  return { ready: true, step: (done % CALENDAR_DAYS) + 1 };
}

/** Two different golds at 78+ (FC-style scale), deterministic from the id. */
export function calendarPickOptions(pool: Pool, id: string): string[] {
  const floor = fcToDisplay(78, pool.sport);
  const golds = Object.values(pool.buckets.gold)
    .flat()
    .filter((rc) => rc.line.kind === 'season' && rc.ovr >= floor)
    .sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const out: string[] = [];
  const pids = new Set<string>();
  for (const rc of shuffle(golds, rng(hashString('calendar:' + id)))) {
    if (pids.has(rc.line.pid)) continue;
    pids.add(rc.line.pid);
    out.push(rc.line.id);
    if (out.length === 2) break;
  }
  return out;
}

/** Claim today's calendar step once: coins for the wallet, packs/picks/SP into the club. */
export function claimCalendar(ut: UtState, pool: Pool, day: string, at: number): { ut: UtState; coins: number; reward: CalendarReward } | null {
  const s = calendarStatus(ut, day);
  if (!s.ready) return null;
  const r = CALENDAR[s.step - 1];
  const c = contentOf(ut);
  let next: UtState = { ...ut, content: { ...c, calendar: { day, n: (c.calendar?.n ?? 0) + 1 } } };
  const id = 'calendar:' + pool.sport + ':' + day;
  if (r.pack && !next.packs.some((p) => p.id === id)) next = { ...next, packs: [...next.packs, { id, kind: r.pack, at }] };
  if (r.sp) next = addSeasonXP(next, day, r.sp);
  if (r.pick) next = addPick(next, { id, kind: 'calendar', title: 'Login Calendar · Gold Pick', options: calendarPickOptions(pool, id), at });
  return { ut: next, coins: r.coins ?? 0, reward: r };
}

// ---------- the daily objectives' bonus ----------

export const DAILY_BONUS = { coins: 100, pack: 'silver' };

export function dailyObjectives(ut: UtState, day: string) {
  return objectiveDeck(ut, day).filter((o) => o.group === 'daily' && o.period === day);
}

export function dailyBonusReady(ut: UtState, day: string): boolean {
  const d = dailyObjectives(ut, day);
  return d.length > 0 && d.every((o) => o.claimed) && !claimed(ut, 'daily-bonus:' + day);
}

/** The all-three bonus, once a day. */
export function claimDailyBonus(ut: UtState, sport: string, day: string, at: number): { ut: UtState; coins: number } | null {
  if (!dailyBonusReady(ut, day)) return null;
  const id = 'daily-bonus:' + sport + ':' + day;
  const next = withClaim(ut, 'daily-bonus:' + day);
  return { ut: next.packs.some((p) => p.id === id) ? next : { ...next, packs: [...next.packs, { id, kind: DAILY_BONUS.pack, at }] }, coins: DAILY_BONUS.coins };
}
