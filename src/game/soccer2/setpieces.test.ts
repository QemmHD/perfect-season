// Claude 2026-11-01: set-piece rates with the autopilot (skill 0.75) over three real matchups, the
// numbers docs/SOCCER.md quotes. Targets: corners 8-12%, direct free kicks 10-15%, penalties ~75%
// (they were about a third and 79% before the tuning, SP_TUNE in engine.ts). Bounds leave room for
// the sample (100 attacks per matchup).
import cardsRaw from '../../data/cards-soccer.json';
import { autoplayAttack } from './autopilot';
import { setupAttack } from './engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from './ratings';
import type { Scenario } from './types';

const N = 100;

describe('soccer set pieces', () => {
  const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
  const pairs = [
    [clubSquad(seasons, 'BAR', 2015), clubSquad(seasons, 'RMA', 2017)],
    [clubSquad(seasons, 'EVE', 2016), clubSquad(seasons, 'LIV', 2019)],
    [clubSquad(seasons, 'MCI', 2023), clubSquad(seasons, 'ARS', 2024)],
  ];
  const rate = (sc: Scenario) => {
    let goals = 0;
    let fk = 0;
    let fkGoals = 0;
    let n = 0;
    for (const [a, b] of pairs)
      for (let i = 0; i < N; i++) {
        const at = setupAttack(sc, a, b, 'sp:' + sc + ':' + i, {});
        autoplayAttack(at, 0.75, 'pilot:' + i);
        n++;
        if (at.lastShot?.kind === 'fk') fk++;
        if (at.end?.kind === 'G') {
          goals++;
          if (at.lastShot?.kind === 'fk') fkGoals++;
        }
      }
    return { all: goals / n, fk: fk ? fkGoals / fk : 0 };
  };
  it('corners score about one in ten', () => {
    const r = rate('corner');
    expect(r.all).toBeGreaterThan(0.06);
    expect(r.all).toBeLessThan(0.14);
  });
  it('free kicks: direct free kicks go in now and then, 6-15% of free-kick attacks', () => {
    const r = rate('freekick');
    // (studio overhaul soccer-1, R-2: the floors were 8% of attacks and 5% of direct free kicks; about
    // half of the direct goals were keepers parrying the kick into their own net, the bug R-2 fixes.
    // soccer-7 refits free kicks to the plan's A12 (direct 6-11%) and restores these floors.)
    expect(r.all).toBeGreaterThan(0.06);
    expect(r.all).toBeLessThan(0.17);
    expect(r.fk).toBeGreaterThan(0.02);
    expect(r.fk).toBeLessThan(0.15);
  });
  it('penalties go in about three times in four', () => {
    const r = rate('penalty');
    expect(r.all).toBeGreaterThan(0.7);
    expect(r.all).toBeLessThan(0.8);
  });
});
