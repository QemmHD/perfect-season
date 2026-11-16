// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4; Game Design V2 D.5, audit H4): the main
// Home's side of the next-best-action engine. NextUpStrip.tsx loads this module with a dynamic import
// after first paint, so the engine (next-action.ts and the light progress core it reads) never sits in
// the first-paint chunk. It adds the main app's own sources to the engine's list and nothing else:
//   - today's Missions waiting to be claimed (rewards, right after this sport's UT claims),
//   - today's draft Daily while unplayed (the engine's Daily Play slot, priority 6),
//   - other sports' UT claimables from the device cache (`perfect-season:ut-device:v1`), a count this
//     phone wrote when that sport last ran; a stale day is ignored, a pool is never loaded.
// `count` is the number the UT tab badge shows: exactly UT HOME's Rewards count (utClaimables, which
// equals the inbox's claimable rows, claimables.test.ts).
import { SOCCER_ON, type SportId } from '../engine/sport';
import type { Profile } from '../lib/profile';
import { openUtAt } from '../ut/go';
import { freshForMinutes, minutesExtras } from '../ut/minutes';
import { nextCtxOf, nextUp, plural, type MatchSetupRef, type NextAction, type Target } from '../ut/next-action';
import type { UtSport } from '../ut/types';
import type { UtView } from '../ut/UltimateTeam';

/** Where a Home action leads: the engine's targets, plus today's Missions sheet. */
export type HomeTarget = Target | { app: 'missions' };
export type HomeAction = Omit<NextAction, 'target'> & { target: HomeTarget };

export interface HomeNext {
  action: HomeAction;
  /** this sport's UT claimables: the UT tab badge (= UT HOME's Rewards count) */
  count: number;
  /** the Daily Drop streak ends tonight with its claim waiting: the badge shows an amber clock */
  amber: boolean;
  /** everything claimable on this phone (UT in every sport + Minutes rungs): the app-icon badge */
  total: number;
  /** the count may be short until UT has been opened once this build (claimables.ts `approx`) */
  approx: boolean;
  /** the Eastern day it was computed for */
  day: string;
}

export interface HomeInputs {
  /** today's missions done and not yet claimed */
  missions: number;
  /** today's draft Daily: its number and whether the ranked try is in */
  daily: { no: number; done: boolean };
}

// ---------- the device cache of each sport's UT claimables ----------

export const DEVICE_KEY = 'perfect-season:ut-device:v1';
export interface DeviceCache {
  claims?: Partial<Record<UtSport, { n: number; day: string }>>;
}
const SPORTS: UtSport[] = ['nba', 'nfl', 'soccer'];

export function readDevice(): DeviceCache {
  try {
    const v = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
/** Record this sport's count for the other sports' Homes (only when it changed). */
export function writeDeviceCount(sport: SportId, n: number, day: string): void {
  const d = readDevice(),
    cur = d.claims?.[sport];
  if (cur && cur.n === n && cur.day === day) return;
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ ...d, claims: { ...d.claims, [sport as UtSport]: { n, day } } }));
  } catch {
    // private mode or full storage: the other sports' Homes just don't show this count
  }
}
/** The other sports' counts recorded today (whole non-negative integers only; soccer only where it is on). */
export function elsewhereOf(d: DeviceCache, sport: UtSport, day: string): { sport: UtSport; count: number }[] {
  return SPORTS.filter((s) => s !== sport && (s !== 'soccer' || SOCCER_ON)).flatMap((s) => {
    const c = d.claims?.[s];
    return c && c.day === day && Number.isInteger(c.n) && c.n > 0 ? [{ sport: s, count: c.n }] : [];
  });
}

// ---------- the action ----------

/** The single best thing to do from the main Home, and the badge numbers. */
export function homeNext(p: Profile, sport: SportId, now: number, inputs: HomeInputs, device: DeviceCache = readDevice()): HomeNext {
  const s = sport as UtSport;
  const mx = minutesExtras(p.playtime, now, freshForMinutes(p));
  const ctx = nextCtxOf(p.ut, s, now, {
    ...mx,
    elsewhere: [],
    dailyPlay: inputs.daily.done ? null : { line: 'Daily #' + inputs.daily.no + ' · same spins for everyone · ranked', target: { app: 'draft', mode: 'daily' } },
  });
  const elsewhere = elsewhereOf(device, s, ctx.day);
  let action: HomeAction = nextUp({ ...ctx, elsewhere });
  // today's Missions are rewards too: after this sport's UT claims, before other sports' and the starter
  if (inputs.missions > 0 && action.id !== 'claim')
    action = { id: 'missions', line: plural(inputs.missions, 'mission') + ' done · claim the coins', cta: 'CLAIM', target: { app: 'missions' } };
  const count = ctx.claim.count;
  return {
    action,
    count,
    amber: count > 0 && ctx.claim.streakAtRisk,
    total: count + elsewhere.reduce((n, e) => n + e.count, 0) + (ctx.minutes?.n ?? 0),
    approx: ctx.claim.approx,
    day: ctx.day,
  };
}

/** The UT screen a ready match is chosen from (from the main app, UT opens where the match starts). */
export const MATCH_VIEW: Record<MatchSetupRef['mode'], UtView> = {
  battles: 'battles',
  cup: 'cup',
  circuit: 'circuit',
  league: 'league',
  draft: 'draft',
  rivals: 'rivals',
  events: 'events',
  moments: 'moments',
};

export interface HomeRoutes {
  openUt: () => void;
  /** another sport's UT: reload into that sport and open UT at `view` there */
  otherSport: (sport: UtSport, view: UtView) => void;
  minutes: () => void;
  draft: (mode: 'classic' | 'blind' | 'daily' | '1v1') => void;
  missions: () => void;
}

/** Go where the action is done, in one tap. */
export function goHome(t: HomeTarget, sport: SportId, r: HomeRoutes): void {
  switch (t.app) {
    case 'ut':
      if (t.sport && t.sport !== sport) r.otherSport(t.sport, t.view);
      else openUtAt(t.view, r.openUt);
      return;
    case 'match':
      openUtAt(MATCH_VIEW[t.setup.mode], r.openUt);
      return;
    case 'minutes':
      r.minutes();
      return;
    case 'draft':
      r.draft(t.mode === 'h2h' ? '1v1' : t.mode);
      return;
    case 'missions':
      r.missions();
  }
}
