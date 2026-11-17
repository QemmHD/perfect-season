// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4; Game Design V2 F.2 ut #6, research "session
// end"): two lines when a player leaves Ultimate Team with EXIT, shown after Home is on screen and never
// blocking it: what this visit earned (coins, packs, active Minutes) and what waits tomorrow ("Daily
// Drop Day 3 of 7 · 3 new objectives"). No guilt and no clock: only what is true and what comes next.
import type { Profile } from '../lib/profile';
import { easternClock } from './claimables';
import { tomorrowLine } from './hub-feed';
import { plural } from './next-action';

/** What the visit started with. */
export interface SessionMark {
  at: number;
  day: string;
  coins: number;
  packs: number;
  opened: number;
  /** counted MINUTES seconds today */
  sec: number;
}

const daySec = (p: Profile, day: string) => (p.playtime?.day === day ? p.playtime.daySec : 0);

export function markSession(p: Profile, now: number): SessionMark {
  const { day } = easternClock(now);
  return { at: now, day, coins: p.coins, packs: p.ut.packs.length, opened: p.ut.packsOpened, sec: daySec(p, day) };
}

/** A visit shorter than this that earned nothing says nothing. */
export const QUIET_MS = 30000;

/**
 * The two lines, or null for a short visit that earned nothing. Coins are what the wallet gained (a
 * visit that spent more than it earned names its packs instead); packs are those earned (opened or
 * still waiting); minutes are the active Minutes this visit counted today.
 */
export function sessionSummary(start: SessionMark, p: Profile, now: number): { earned: string | null; tomorrow: string } | null {
  const { day } = easternClock(now);
  const coins = Math.max(0, p.coins - start.coins),
    opened = Math.max(0, p.ut.packsOpened - start.opened),
    earnedPacks = Math.max(0, p.ut.packs.length + opened - start.packs),
    min = day === start.day ? Math.floor(Math.max(0, daySec(p, day) - start.sec) / 60) : Math.floor(daySec(p, day) / 60);
  const parts = [coins ? '+' + coins.toLocaleString('en-US') + ' coins' : '', earnedPacks ? plural(earnedPacks, 'pack') : '', min ? min + ' active min' : ''].filter(Boolean);
  if (!parts.length && now - start.at < QUIET_MS) return null;
  return { earned: parts.length ? 'This visit: ' + parts.join(' · ') : null, tomorrow: 'Tomorrow: ' + tomorrowLine(p.ut, now) };
}

/** The toast's text: one or two sentences. */
export function summaryText(s: { earned: string | null; tomorrow: string }): string {
  return (s.earned ? s.earned + '. ' : '') + s.tomorrow + '.';
}
