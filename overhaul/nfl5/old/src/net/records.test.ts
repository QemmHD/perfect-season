// Head-to-head records: what the wire may carry, the series against one opponent, and how it reads.
import { addVs } from '../lib/profile';
import { recText, seriesText } from '../ui/Search';
import { recOf } from './match';

describe('head-to-head records', () => {
  it('takes only a sane [wins, losses] off the wire', () => {
    expect(recOf([14, 6])).toEqual({ w: 14, l: 6 });
    expect(recOf([0, 0])).toEqual({ w: 0, l: 0 });
    for (const bad of [null, 5, '14-6', [1], [1, 2, 3], [-1, 2], [1.5, 2], [90000, 20000], { w: 1, l: 2 }]) expect(recOf(bad)).toBeUndefined();
  });

  it('keeps a series against each opponent, by key', () => {
    let vs = addVs(undefined, 'k1', 'Sam', true);
    vs = addVs(vs, 'k1', 'Sam', true);
    vs = addVs(vs, 'k2', 'Ann', false);
    vs = addVs(vs, 'k1', 'Sammy', false);
    expect(vs.k1).toEqual({ name: 'Sammy', w: 2, l: 1 });
    expect(vs.k2).toEqual({ name: 'Ann', w: 0, l: 1 });
  });

  it('keeps the most recent 300 opponents', () => {
    let vs = {};
    for (let i = 0; i < 320; i++) vs = addVs(vs, 'k' + i, 'P' + i, true);
    expect(Object.keys(vs)).toHaveLength(300);
    expect(vs).not.toHaveProperty('k0');
    expect(vs).toHaveProperty('k319');
  });

  it('reads the way the match splash shows it', () => {
    expect(recText({ w: 14, l: 6 })).toBe('14–6 H2H');
    expect(recText({ w: 0, l: 0 })).toBe('No H2H games yet');
    expect(seriesText(undefined, 'Sam')).toBe('First meeting');
    expect(seriesText({ name: 'Sam', w: 3, l: 1 }, 'Sam')).toBe('You lead Sam 3–1');
    expect(seriesText({ name: 'Sam', w: 1, l: 3 }, 'Sam')).toBe('Sam leads you 3–1');
    expect(seriesText({ name: 'Sam', w: 2, l: 2 }, 'Sam')).toBe('Tied with Sam 2–2');
  });
});
