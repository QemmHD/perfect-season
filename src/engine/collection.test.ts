// The binder (npm test runs both sports).
import { collect, coreSet, franchises, setProgress, summarize } from './collection';
import { CELLS } from './data';
import { NFL } from './sport';

describe('binder', () => {
  it('gives every team-decade a core set of its best players', () => {
    for (const c of CELLS) {
      const set = coreSet(c);
      expect(set.length).toBeGreaterThan(2);
      expect(set.length).toBeLessThanOrEqual(NFL ? 6 : 5);
      if (NFL) expect(set.some((p) => p.pos[0] === 'DEF')).toBe(true);
    }
  });
  it('collects cards and finishes a set exactly once', () => {
    const cell = CELLS[3];
    const set = coreSet(cell);
    let c = {};
    const first = collect(c, set.slice(0, set.length - 1));
    expect(first.fresh.length).toBe(set.length - 1);
    expect(first.sets).toEqual([]);
    c = first.next;
    const second = collect(c, [set[set.length - 1], set[0]]);
    expect(second.fresh).toEqual([set[set.length - 1].id]);
    expect(second.sets).toEqual([cell.id]);
    expect(setProgress(second.next, cell).done).toBe(true);
    expect(second.next[set[0].id]).toBe(2);
    // finishing it again pays nothing
    expect(collect(second.next, set).sets).toEqual([]);
    const sum = summarize(second.next);
    expect(sum.cards).toBe(set.length);
    expect(sum.sets).toBe(1);
  });
  it('lists every franchise with its decades', () => {
    const fs = franchises();
    expect(fs.length).toBe(NFL ? 32 : 30);
    expect(fs.reduce((a, f) => a + f.cells.length, 0)).toBe(CELLS.length);
  });
});
