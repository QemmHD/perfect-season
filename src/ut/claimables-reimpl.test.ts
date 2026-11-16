// Claude, 2026-11-16 (studio overhaul, team ut-1): claimables.ts and next-action.ts re-implement a few
// checks and constants whose originals live next to the card pool (so importing them would load it).
// Each copy must equal its original over every QA fixture of this sport and a 60-day calendar. If a
// packs-owned original changes at merge (Daily Drop, calendar), this test says which copy to update.
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { loadProfile } from '../lib/profile';
import { LEVEL, LEVEL_NAME, LEVELS, RUNGS as BATTLE_RUNGS } from './battles';
import { CIRCUIT_GAMES as CG, CIRCUIT_PRIZES } from './circuit';
import * as C from './claimables';
import { MemoryStorage, useStorage } from './compat/memory-storage';
import { claimed } from './content-state';
import { dailyStatus, previousDay, STREAK_DAYS } from './content-packs';
import { standoutObjectiveId, standoutWins } from './content-progress';
import { cupClaimId, cupOf } from './cup';
import { CALENDAR_DAYS, calendarStatus, DAILY_BONUS } from './daily-hub';
import { NEW_ERA_ID, newEraReady } from './new-era';
import * as N from './next-action';
import { seasonReady } from './objectives';
import { PAID_GAMES_A_DAY } from './play';
import { STANDOUT_OBJECTIVE_WINS } from './standouts';
import type { UtState } from './state';
import { weekKey } from './objectives';
import { qaFixtures } from './qa-fixtures.test-util';

const saves: [string, UtState, string][] = qaFixtures(SPORT).map((x) => {
  useStorage(new MemoryStorage(x.storage));
  return [x.name, loadProfile().ut, x.day];
});
const days = (d0: string) => Array.from({ length: 61 }, (_, i) => new Date(Date.parse(d0 + 'T12:00:00Z') + (i - 30) * 86400000).toISOString().slice(0, 10));

describe('claimables.ts copies equal their originals (' + SPORT + ')', () => {
  it('constants', () => {
    expect(C.DROP_STREAK_DAYS).toBe(STREAK_DAYS);
    expect(C.CALENDAR_STEPS).toBe(CALENDAR_DAYS);
    expect(C.NEW_ERA_CLAIM).toBe(NEW_ERA_ID);
    expect(C.STANDOUT_WINS).toBe(STANDOUT_OBJECTIVE_WINS);
  });
  for (const [name, ut, d0] of saves)
    it(name + ': Daily Drop, calendar, New Era, Standouts, Cup and Season Pass over 60 days', () => {
      expect(C.newEraWaiting(ut)).toBe(newEraReady(ut));
      expect(C.cupTitleReady(ut, SPORT)).toBe(
        (() => {
          const a = cupOf(ut).active;
          return !!a && a.sport === SPORT && a.done && a.results.length === 3 && a.results.every((r) => r.won) && !cupOf(ut).claims.includes(cupClaimId(a.sport, a.week, a.kind));
        })(),
      );
      expect(C.seasonTiersReady(ut)).toBe(Object.keys(ut.hq?.seasons ?? {}).reduce((n, k) => n + seasonReady(ut, k), 0));
      for (const day of days(d0)) {
        const week = weekKey(day);
        expect(C.previousDay(day)).toBe(previousDay(day));
        expect(C.dropStatus(ut, day)).toEqual(dailyStatus(ut, day));
        expect(C.calendarReady(ut, day)).toBe(calendarStatus(ut, day).ready);
        expect(C.standoutReady(ut, week)).toBe(standoutWins(ut, week) >= STANDOUT_OBJECTIVE_WINS && !claimed(ut, standoutObjectiveId(week)));
      }
    });
});

describe('next-action.ts constants equal the rules they mirror', () => {
  it('paid games, the Squad Battles ladder and its packs, the Champions Circuit', () => {
    expect(N.PAID_CAP).toBe(PAID_GAMES_A_DAY);
    expect(N.RUNGS).toBe(BATTLE_RUNGS);
    expect(N.DIFFICULTIES).toEqual(LEVELS);
    expect(N.DIFFICULTY_NAME).toEqual(LEVEL_NAME);
    for (const l of LEVELS) expect(N.RUNG_PACKS[l]).toEqual(LEVEL[l].packs);
    expect(N.CIRCUIT_GAMES).toBe(CG);
    expect(N.CIRCUIT_STEPS).toEqual(CIRCUIT_PRIZES.map((p) => [p.wins, p.title]));
  });
  it("today's all-three bonus (daily-hub.ts DAILY_BONUS), shown on the strip and the near-miss chip", () => {
    expect(N.DAILY_BONUS_REWARD).toEqual(DAILY_BONUS);
    expect(N.DAILY_BONUS_LINE).toBe(DAILY_BONUS.coins + ' coins + ' + N.packName(DAILY_BONUS.pack));
  });
});
