// Codex: actual economy/progression invariants, rollover, replay protection and legacy preservation.
import { describe, expect, it } from 'vitest';
import { freshUt, migrateUt } from './state';
import {
  addSeasonXP,
  claimObjective,
  claimSeason,
  hqOf,
  objectiveDeck,
  recordActivity,
  recordMatchProgress,
  seasonFor
} from './progression';
import { normalizeHQ } from './hq-state';
import { startCircuit, settleCircuit, circuitOf } from './circuit';
import {
  startDevelopment,
  claimDevelopment,
  savePreset
} from './club-management';
import { claimMoment, finishMoment, momentsFor } from './moments';
import { settle } from './play';
const day = '2026-10-30',
  week = '2026-10-26';
const club = () => ({
  ...freshUt(),
  owned: [
    {
      uid: 'original',
      cardId: 'old-card',
      level: 2,
      xp: 35,
      at: 1,
      mint: {
        serial: 8,
        totalAtPull: 20,
        requestId: 'old',
        namespace: 'inspect'
      }
    }
  ],
  squad: { PG: 'original' }
});
const match = (
  ut: ReturnType<typeof club>,
  id: string,
  won = true,
  how: 'played' | 'sim' = 'played'
) =>
  recordMatchProgress(ut, {
    id,
    at: 1,
    mode: 'battle',
    won,
    us: 15,
    them: 10,
    opponent: 'Rival',
    coins: 60,
    xp: 60,
    day,
    how,
    played: ['original']
  }).ut;
describe('clubhouse progression', () => {
  it('initializes legacy totals before settling the first new match and rejects a stale Circuit round before paying anything', () => {
    const old = { ...club(), record: { w: 7, l: 4, h2hW: 3, h2hL: 2 } },
      now = Date.now();
    const input = {
      won: true,
      us: 20,
      them: 10,
      online: false,
      rung: null,
      played: ['original'],
      week,
      day,
      packId: 'first-pack',
      at: now,
      matchId: 'first-match'
    };
    const r = settle(old, input);
    expect(hqOf(r.ut).totals.games).toBe(17);
    expect(hqOf(r.ut).totals.wins).toBe(11);
    const loaded = migrateUt(JSON.parse(JSON.stringify(r.ut)));
    expect(hqOf(loaded).history[0].at).toBe(now);
    let u = startCircuit(r.ut, week, 'run', now);
    u = settle(u, {
      ...input,
      matchId: 'round-zero',
      circuit: { runId: 'run', round: 0 }
    }).ut;
    const replay = settle(u, {
      ...input,
      matchId: 'new-id-stale-round',
      circuit: { runId: 'run', round: 0 }
    });
    expect(replay.ut).toBe(u);
    expect(replay.coins).toBe(0);
    expect(replay.xp).toBe(0);
  });
  it('keeps weekly Circuit prize receipts even if a device date returns to a previous week', () => {
    let u = startCircuit(club(), week, 'a', 1);
    for (let i = 0; i < 6; i++) u = settleCircuit(u, 'a', i, true, i + 2).ut;
    u = startCircuit(u, '2026-W45', 'b', 10);
    for (let i = 0; i < 6; i++) u = settleCircuit(u, 'b', i, false, 11 + i).ut;
    u = startCircuit(migrateUt(u), week, 'c', 20);
    for (let i = 0; i < 6; i++) {
      const r = settleCircuit(u, 'c', i, true, 21 + i);
      expect(r.coins).toBe(0);
      u = r.ut;
    }
    expect(u.packs).toHaveLength(3);
  });
  it('preserves every original owned field and unknown-free optional clubhouse state through reload', () => {
    const old = club(),
      u = savePreset(
        startDevelopment(old, 'original', 'breakout', 1),
        0,
        'My Team',
        1
      ),
      loaded = migrateUt(JSON.parse(JSON.stringify(u)));
    expect(loaded.owned).toEqual(old.owned);
    expect(loaded.squad).toEqual(old.squad);
    expect(loaded.hq?.presets[0].squad.PG).toBe('original');
    expect(loaded.hq?.development.active?.uid).toBe('original');
  });
  it('banks old completed objectives across day/week rollover and claims them once', () => {
    let u = recordActivity(club(), 'one', day, {
      games: 2,
      wins: 1,
      points: 30
    });
    const id = objectiveDeck(u, day).find(
      (o) => o.group === 'daily' && o.counter === 'games'
    )!.id;
    expect(
      objectiveDeck(u, '2026-11-08').find((o) => o.id === id)?.progress
    ).toBe(2);
    const r = claimObjective(u, id, '2026-11-08', 3);
    expect(r.coins).toBe(50);
    expect(claimObjective(migrateUt(r.ut), id, '2026-11-08', 4).coins).toBe(0);
    expect(r.ut.owned).toEqual(u.owned);
  });
  it('retains old earned season rewards while the next season starts at zero', () => {
    const id = seasonFor(day).id,
      u = addSeasonXP(club(), day, 7500),
      later = '2026-12-01';
    expect(seasonFor(later).id).not.toBe(id);
    const r = claimSeason(u, id, 25, 5);
    expect(r.pack).toBe('spotlight');
    expect(r.ut.packs.filter((p) => p.id === id + ':tier:25')).toHaveLength(1);
    expect(claimSeason(migrateUt(r.ut), id, 25, 6).coins).toBe(0);
    expect(hqOf(r.ut).seasons[seasonFor(later).id]?.xp ?? 0).toBe(0);
  });
  it('counts a settled match once and limits match season points to sixteen games per day', () => {
    let u: ReturnType<typeof freshUt> = club();
    for (let i = 0; i < 17; i++)
      u = recordMatchProgress(u, {
        id: String(i),
        at: i,
        mode: 'online',
        won: true,
        us: 20,
        them: 10,
        opponent: 'Rival',
        coins: 60,
        xp: 60,
        day,
        how: 'played',
        played: ['original']
      }).ut;
    expect(hqOf(u).totals.games).toBe(17);
    expect(hqOf(u).cardStats.original.games).toBe(17);
    expect(hqOf(u).seasons[seasonFor(day).id].xp).toBe(16 * 120);
    const replay = recordMatchProgress(u, {
      id: '16',
      at: 99,
      mode: 'online',
      won: true,
      us: 20,
      them: 10,
      opponent: 'Rival',
      coins: 60,
      xp: 60,
      day,
      how: 'played',
      played: ['original']
    });
    expect(replay.ut).toBe(u);
    expect(replay.sp).toBe(0);
  });
  it('targets development XP to the original copy and requires actual played games', () => {
    const original = club();
    let u = startDevelopment(original, 'original', 'breakout', 1);
    u = match(u as ReturnType<typeof club>, 'sim', true, 'sim');
    expect(claimDevelopment(u, day, 9).xp).toBe(0);
    for (let i = 0; i < 3; i++)
      u = match(u as ReturnType<typeof club>, 'played:' + i);
    const r = claimDevelopment(u, day, 10);
    expect(r.xp).toBe(200);
    expect(r.ut.owned[0].uid).toBe('original');
    expect(r.ut.owned[0].mint).toEqual(original.owned[0].mint);
    expect(r.ut.owned[0].level).toBeGreaterThan(original.owned[0].level);
    expect(claimDevelopment(migrateUt(r.ut), day, 11).xp).toBe(0);
  });
  it('makes circuit rounds and best-week rewards replay-safe without removing any owned copy', () => {
    const old = club();
    let u = startCircuit(old, week, 'run', 1);
    for (let round = 0; round < 6; round++) {
      const r = settleCircuit(u, 'run', round, true, round + 2);
      expect(settleCircuit(r.ut, 'run', round, true, round + 2).coins).toBe(0);
      u = r.ut;
    }
    expect(hqOf(u).circuit.best).toBe(6);
    expect(hqOf(u).circuit.active).toBeUndefined();
    expect(u.packs.map((p) => p.kind)).toEqual(['silver', 'gold', 'spotlight']);
    expect(u.owned).toEqual(old.owned);
    u = startCircuit(u, week, 'run2', 9);
    for (let i = 0; i < 6; i++) {
      const r = settleCircuit(u, 'run2', i, true, 10 + i);
      expect(r.coins).toBe(0);
      u = r.ut;
    }
    expect(u.packs).toHaveLength(3);
  });
  it('keeps an unfinished circuit when the week turns and opens new entries after finishing it', () => {
    let u = startCircuit(club(), week, 'run', 1);
    expect(circuitOf(u, '2026-11-02').week).toBe(week);
    for (let i = 0; i < 6; i++) u = settleCircuit(u, 'run', i, false, i + 1).ut;
    expect(circuitOf(u, '2026-11-02').entries).toBe(0);
  });
  it('awards a Moment only after enough real attempts and only once after reload', () => {
    const m = momentsFor('nba')[0],
      old = club(),
      attempts = Array.from({ length: 5 }, () => ({
        points: 2,
        success: true,
        detail: 'MAKE'
      }));
    expect(
      claimMoment(
        finishMoment(old, m, attempts.slice(0, 2), 1),
        'nba',
        m.id,
        day,
        2
      ).coins
    ).toBe(0);
    const r = claimMoment(
      finishMoment(old, m, attempts, 2),
      'nba',
      m.id,
      day,
      3
    );
    expect(r.coins).toBe(100);
    expect(claimMoment(migrateUt(r.ut), 'nba', m.id, day, 4).coins).toBe(0);
    expect(r.ut.owned).toEqual(old.owned);
  });
  it('prunes missing preset/development references without inventing cards', () => {
    const u = savePreset(
      startDevelopment(club(), 'original', 'breakout', 1),
      0,
      'A',
      1
    );
    const h = normalizeHQ(u.hq, []);
    expect(h.presets[0].squad).toEqual({});
    expect(h.development.active).toBeUndefined();
    expect(hqOf(club()).totals.games).toBe(0);
  });
});
