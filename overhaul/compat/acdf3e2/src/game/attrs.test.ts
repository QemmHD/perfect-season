// The arcade games' attributes file covers the drafted defenders too (PS_SPORT=nfl; npm test runs both).
import { CELLS, CELL_BY_ID } from '../engine/data';
import { NFL } from '../engine/sport';
import { DEF_SLOTS } from '../engine/types';
import { loadAttrs } from './attrs';

describe.skipIf(!NFL)('football attributes', () => {
  it('give every drafted defender his size, and most his number and splits', async () => {
    const attrs = await loadAttrs();
    const defenders = CELLS.flatMap((c) => c.players).filter((p) => DEF_SLOTS.includes(p.pos[0]));
    const got = defenders.map(attrs);
    expect(got.every((a) => a && a.ht && a.wt)).toBe(true);
    expect(got.filter((a) => a?.num != null).length / got.length).toBeGreaterThan(0.75);
    // every line since 2000 has his sacks, interceptions and tackles a game
    const modern = defenders.filter((p) => p.from >= 2000).map(attrs);
    expect(modern.filter((a) => a?.sck != null && a?.ints != null && a?.tkl != null).length / modern.length).toBeGreaterThan(0.99);
    const find = (cell: string, name: string) => attrs(CELL_BY_ID[cell].players.find((p) => p.name === name)!)!;
    expect([find('PHI-1980', 'Reggie White').num, find('PHI-1980', 'Reggie White').ht]).toEqual([92, 77]);
    expect(find('PHI-1980', 'Reggie White').sck).toBeGreaterThan(1);
    expect(find('NYG-1980', 'Lawrence Taylor').num).toBe(56);
    expect(find('DAL-1990', 'Deion Sanders').num).toBe(21);
  });
});
