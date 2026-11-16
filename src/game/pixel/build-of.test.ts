// players-3: one build formula for the match, the cards, the draft cards and the walkout. A draft cell
// without a height or weight on the card reads the install-cached attrs file (keyed `CELL:pid`), so
// Shaq, Manute Bol and Muggsy Bogues get their real builds; only without it does a position's typical
// build stand in.
import { buildOf, weightFor } from './appearance';
import ATTRS from '../../data/nba-attrs.json';

const file = ATTRS as unknown as { fields: string[]; lines: Record<string, (number | null)[]> };
const HT = file.fields.indexOf('ht');
const WT = file.fields.indexOf('wt');
const attrs = (id: string) => {
  const row = file.lines[id];
  return row ? { ht: row[HT], wt: row[WT] } : null;
};

describe('buildOf', () => {
  it.each([
    ['LAL-2000:onealsh01', 85, 325],
    ['GSW-1980:bolma01', 91, 200],
    ['CHA-1990:boguemu01', 63, 136],
  ])('reads the attrs file for the draft cell %s', (id, ht, wt) => {
    const b = buildOf('nba', { id, attrs, pos: 'C' });
    expect([b.htIn, b.wt]).toEqual([ht, wt]);
    expect(b.bmi).toBeCloseTo((wt * 703) / (ht * ht), 6);
  });

  it('puts what the card or the body says first', () => {
    expect(buildOf('nba', { ht: 80, wt: 240, id: 'LAL-2000:onealsh01', attrs }).wt).toBe(240);
  });

  it('falls back to the position only without the attrs file', () => {
    const b = buildOf('nba', { id: 'LAL-2000:onealsh01', pos: 'C' });
    expect(b.htIn).toBe(83);
    expect(b.wt).toBe(weightFor('nba', 83, null, 'C'));
    const qb = buildOf('nfl', { pos: 'QB' });
    expect([qb.htIn, qb.wt]).toEqual([75, 222]);
    expect(buildOf('nfl', { ht: 79, pos: 'OT' }).wt).toBeGreaterThan(315);
  });

  it('makes Shaq the heaviest build and Bol the lightest at almost the same height', () => {
    const shaq = buildOf('nba', { id: 'LAL-2000:onealsh01', attrs });
    const bol = buildOf('nba', { id: 'GSW-1980:bolma01', attrs });
    expect(shaq.bmi).toBeGreaterThan(31);
    expect(bol.bmi).toBeLessThan(17.5);
  });
});
