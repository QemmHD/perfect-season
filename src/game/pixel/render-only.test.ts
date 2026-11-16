// players-2: everything players changes is render only. The simulation of each sport can't reach the
// drawing code by import, and a seeded NBA and NFL game hashes the same engine state after every
// step whether or not the whole drawing pipeline runs on every body (the soccer twin is
// render-only-soccer.test.ts, run with PS_SPORT=soccer).
import { SPORT } from '../../engine/sport';
import { importGraph, SIM_ENTRIES, stepDigestsNba, stepDigestsNfl } from './render-only.helpers';

describe('the simulation never imports drawing code', () => {
  it.each(Object.entries(SIM_ENTRIES))('%s', async (_sport, entries) => {
    const graph = await importGraph(entries);
    expect(graph.size).toBeGreaterThan(entries.length);
    const bad = [...graph].filter(([f]) => /^game\/pixel\/|^data\/appearance\//.test(f)).map(([f, by]) => `${f} (from ${by})`);
    expect(bad).toEqual([]);
  });
});

describe.skipIf(SPORT !== 'nba')('NBA: drawing leaves the engine state alone', () => {
  it('hashes the same state after every step with and without the drawing pipeline', async () => {
    const bare = await stepDigestsNba(false);
    const drawn = await stepDigestsNba(true);
    expect(bare.steps).toBeGreaterThan(1000);
    expect(drawn).toEqual(bare);
  }, 180000);
});

describe.skipIf(SPORT !== 'nfl')('NFL: drawing leaves the engine state alone', () => {
  it('hashes the same state after every step with and without the drawing pipeline', async () => {
    const bare = await stepDigestsNfl(false);
    const drawn = await stepDigestsNfl(true);
    expect(bare.steps).toBeGreaterThan(1000);
    expect(drawn).toEqual(bare);
  }, 180000);
});
