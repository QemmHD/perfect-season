// Codex: real rollover, claim and exact-copy regressions from the post-overhaul audit.
import { describe, expect, it } from 'vitest';
import { freshUt, migrateUt } from './state';
import {
  addSeasonXP,
  claimReadySeason,
  claimSeason,
  hqOf,
  recordMatchProgress,
  seasonReady
} from './progression';
import {
  abandonCircuit,
  circuitOf,
  settleCircuit,
  startCircuit
} from './circuit';
import { startDevelopment } from './club-management';
import { organizeStorage, useStoredCopy } from './storage';
import { momentDifficulty, momentsFor, momentUnit } from './moments';
const copy = {
  uid: 'original',
  cardId: 'original-edition',
  level: 2,
  xp: 35,
  at: 1,
  mint: {
    serial: 8,
    totalAtPull: 20,
    requestId: 'original-receipt',
    namespace: 'inspect'
  }
};
const club = () => ({ ...freshUt(), owned: [copy], squad: { PG: copy.uid } });
describe('researched clubhouse polish', () => {
  it('claims only earned unclaimed levels in the selected season and cannot pay again after reload', () => {
    let u = addSeasonXP(club(), '2026-10-30', 1800);
    u = claimSeason(u, 'season:1', 1, 1).ut;
    u = addSeasonXP(u, '2026-12-01', 300);
    const current = hqOf(u).seasons['season:2'];
    expect(seasonReady(u, 'season:1')).toBe(5);
    const r = claimReadySeason(u, 'season:1', 2);
    expect(r.coins).toBe(200);
    expect(r.packCount).toBe(3);
    expect(r.ut.packs).toHaveLength(4);
    expect(
      hqOf(r.ut).seasons['season:1'].claimed.sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(hqOf(r.ut).seasons['season:2']).toEqual(current);
    expect(r.ut.owned).toEqual([copy]);
    const again = claimReadySeason(
      migrateUt(JSON.parse(JSON.stringify(r.ut))),
      'season:1',
      3
    );
    expect(again.coins).toBe(0);
    expect(again.packCount).toBe(0);
    expect(again.ut.packs).toEqual(r.ut.packs);
  });
  it('keeps weekly Circuit bests, prizes and all three used entries when returning to an earlier week', () => {
    let u = startCircuit(club(), '2026-W44', 'a', 1);
    for (let round = 0; round < 6; round++)
      u = settleCircuit(u, 'a', round, round < 5, 2 + round).ut;
    for (const id of ['b', 'c'])
      u = abandonCircuit(startCircuit(u, '2026-W44', id, 10));
    expect(circuitOf(u, '2026-W44').entries).toBe(3);
    u = abandonCircuit(startCircuit(u, '2026-W45', 'next-week', 20));
    u = migrateUt(JSON.parse(JSON.stringify(u)));
    const restored = circuitOf(u, '2026-W44');
    expect(restored.entries).toBe(3);
    expect(restored.best).toBe(5);
    expect(restored.claimed).toEqual([2, 4]);
    expect(startCircuit(u, '2026-W44', 'fourth-attempt', 30)).toBe(u);
    expect(u.owned).toEqual([copy]);
    expect(circuitOf(u, '2026-W45').entries).toBe(1);
  });
  it('reconciles prize displays from older receipts even without optional week history', () => {
    const u = club();
    const h = hqOf(u);
    h.claims = ['circuit:2026-W44:2', 'circuit:2026-W44:4'];
    const c = circuitOf({ ...u, hq: h }, '2026-W44');
    expect(c.claimed).toEqual([2, 4]);
    expect(c.best).toBe(4);
    expect(c.entries).toBe(0);
  });
  it('retains exact-copy development while swapping duplicates and resumes it only for the enrolled UID', () => {
    const original = organizeStorage({
      ...club(),
      owned: [copy, { ...copy, uid: 'spare', level: 1, xp: 0, mint: undefined }]
    });
    let u = startDevelopment(original, 'original', 'breakout', 1);
    u = organizeStorage(useStoredCopy(u, 'spare'));
    expect(u.duplicateStorage).toContain('original');
    expect(hqOf(u).development.active?.uid).toBe('original');
    const input = {
      id: 'spare-played',
      at: 2,
      mode: 'battle' as const,
      won: true,
      us: 10,
      them: 5,
      opponent: 'Rival',
      coins: 60,
      xp: 60,
      day: '2026-10-30',
      how: 'played' as const,
      played: ['spare']
    };
    u = recordMatchProgress(u, input).ut;
    expect(hqOf(u).development.active?.games).toBe(0);
    u = organizeStorage(useStoredCopy(u, 'original'));
    expect(u.squad.PG).toBe('original');
    u = recordMatchProgress(u, {
      ...input,
      id: 'original-played',
      played: ['original']
    }).ut;
    expect(hqOf(u).development.active?.games).toBe(1);
    expect(u.owned).toEqual(original.owned);
  });
  it('labels NFL completions, field goals and the actual All-Star difficulty accurately', () => {
    expect(
      momentUnit(momentsFor('nfl').find((m) => m.drill === 'throw')!)
    ).toBe('COMPLETIONS');
    expect(momentUnit(momentsFor('nfl').find((m) => m.drill === 'kick')!)).toBe(
      'FIELD GOALS'
    );
    expect(
      momentDifficulty(momentsFor('nba').find((m) => m.difficulty === 0.5)!)
    ).toBe('All-Star');
  });
});
