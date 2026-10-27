// The card data (src/data/cards-<sport>.json, scripts/build_cards.py) as the loader expands it:
// invariants over every line, and spot checks against well-known seasons.
import { describe, expect, it } from 'vitest';
import { legendsOf, loadCards, promosOf } from './cards';
import type { CardLine, UtSport } from './types';

const RANGE: Record<UtSport, [number, number]> = { nba: [1960, 2026], nfl: [1970, 2025] };

function season(lines: CardLine[], name: string, year: number, fr?: string): CardLine {
  const found = lines.filter((l) => l.kind === 'season' && l.name === name && l.season === year && (!fr || l.fr === fr));
  expect(found, `${name} ${year} ${fr ?? ''}`).toHaveLength(1);
  return found[0];
}

describe.each(['nba', 'nfl'] as UtSport[])('%s cards: invariants', (sport) => {
  // checked line by line, failures collected (an expect per line would take seconds)
  it('ids are unique and well formed', async () => {
    const { lines, byId } = await loadCards(sport);
    expect(lines.length).toBeGreaterThan(15000);
    expect(byId.size).toBe(lines.length);
    const bad = lines.filter((l) => l.id !== `${sport}:${l.kind}:${l.season}:${l.pid}:${l.fr}` || l.sport !== sport || !/^[A-Za-z0-9._-]+$/.test(l.pid));
    expect(bad.map((l) => l.id)).toEqual([]);
  });

  it('seasons are in range, ranks in 0-1, stats are numbers or null', async () => {
    const { lines } = await loadCards(sport);
    const [lo, hi] = RANGE[sport];
    const bad: string[] = [];
    for (const l of lines) {
      if (l.season < lo || l.season > hi) bad.push(l.id + ' season');
      if (!l.pos.length || !l.pos.every(Boolean) || !l.name || !/^#[0-9A-F]{6}$/i.test(l.c1) || !/^#[0-9A-F]{6}$/i.test(l.c2)) bad.push(l.id + ' fields');
      for (const [k, v] of Object.entries(l.rk)) if (v !== null && !(v >= 0 && v <= 1)) bad.push(`${l.id} rk.${k} ${v}`);
      for (const [k, v] of Object.entries(l.stats)) if (v !== null && !Number.isFinite(v)) bad.push(`${l.id} stats.${k} ${v}`);
    }
    expect(bad).toEqual([]);
  });

  it('every promo and legend points at a real season card of the same player', async () => {
    const { lines, byId } = await loadCards(sport);
    const promos = await promosOf(sport);
    const legends = await legendsOf(sport);
    const seasons = lines.filter((l) => l.kind === 'season').length;
    expect(promos.length / seasons).toBeGreaterThan(0.02);
    expect(promos.length / seasons).toBeLessThan(0.04);
    expect(legends.length).toBeGreaterThanOrEqual(118);
    expect(legends.length).toBeLessThanOrEqual(135);
    expect(new Set(legends.map((l) => l.pid)).size).toBe(legends.length);
    const bad: string[] = [];
    for (const l of [...promos, ...legends]) {
      const base = byId.get(l.seasonId ?? '');
      if (!base || base.kind !== 'season' || base.pid !== l.pid || base.season !== l.season || base.fr !== l.fr) bad.push(l.id + ' base');
      if (l.kind === 'promo' && !((l.boost ?? 0) >= 3 && (l.boost ?? 0) <= 6 && l.label?.endsWith(' ' + l.season))) bad.push(l.id + ' promo');
      if (l.kind === 'legend' && !((l.boost ?? 0) >= 2 && (l.boost ?? 0) <= 8 && l.label === 'LEGEND')) bad.push(l.id + ' legend');
    }
    expect(bad).toEqual([]);
  });
});

describe('nba cards: spot checks', () => {
  it('Jordan 1996 Bulls: MVP, scoring title, a promo', async () => {
    const { lines, byId } = await loadCards('nba');
    const mj = season(lines, 'Michael Jordan', 1996, 'CHI');
    expect(mj.id).toBe('nba:season:1996:jordami01:CHI');
    expect(mj.honors).toEqual(expect.arrayContaining(['MVP', 'ALLNBA1', 'SCORING']));
    expect(mj.num).toBe(23);
    expect(mj.stats.pts).toBeCloseTo(30.4, 1);
    const promo = byId.get('nba:promo:1996:jordami01:CHI');
    expect(promo?.label).toBe('MVP 1996');
    expect(promo?.boost).toBeGreaterThanOrEqual(5);
  });

  it('Curry 2016 Warriors: MVP', async () => {
    const { lines } = await loadCards('nba');
    const sc = season(lines, 'Stephen Curry', 2016, 'GSW');
    expect(sc.honors).toContain('MVP');
    expect(sc.teamName).toBe('Golden State Warriors');
    expect(sc.rk.fg3).toBeGreaterThan(0.95);
  });

  it("Rodman 1992 Pistons: the season's best rebounder", async () => {
    const { lines } = await loadCards('nba');
    const dr = season(lines, 'Dennis Rodman', 1992, 'DET');
    expect(dr.rk.reb).toBeGreaterThan(0.99);
    expect(dr.honors).toContain('REB');
  });

  it('the era shows: 1985 Bulls and 1979 SuperSonics', async () => {
    const { lines } = await loadCards('nba');
    const mj = season(lines, 'Michael Jordan', 1985, 'CHI');
    expect([mj.abbr, mj.teamName]).toEqual(['CHI', 'Chicago Bulls']);
    const gw = season(lines, 'Gus Williams', 1979, 'OKC');
    expect([gw.abbr, gw.teamName]).toEqual(['SEA', 'Seattle SuperSonics']);
    expect(mj.stats.stl).not.toBeNull();
    const wilt = season(lines, 'Wilt Chamberlain', 1962);
    expect(wilt.stats.stl).toBeNull();
    expect(wilt.rk.val).toBeGreaterThan(0.99);
  });

  it('legends include the obvious names', async () => {
    const names = new Set((await legendsOf('nba')).map((l) => l.name));
    for (const n of ['Michael Jordan', 'Kareem Abdul-Jabbar', 'Magic Johnson', 'Larry Bird', 'Bill Russell', 'Wilt Chamberlain',
      'LeBron James', 'Kobe Bryant', 'Tim Duncan', "Shaquille O'Neal", 'Hakeem Olajuwon', 'Stephen Curry', 'Kevin Durant',
      'Julius Erving', 'Jerry West', 'Oscar Robertson'])
      expect(names.has(n), n).toBe(true);
  });
});

describe('nfl cards: spot checks', () => {
  it('Lawrence Taylor 1986 Giants: LB, first-team All-Pro', async () => {
    const lt = season((await loadCards('nfl')).lines, 'Lawrence Taylor', 1986, 'NYG');
    expect(lt.pos[0]).toBe('LB');
    expect(lt.grp).toBe('LB');
    expect(lt.honors).toEqual(expect.arrayContaining(['ALLPRO1', 'MVP']));
    expect(lt.stats.sk).toBe(20.5);
  });

  it('Jerry Rice 1987 49ers: WR', async () => {
    const jr = season((await loadCards('nfl')).lines, 'Jerry Rice', 1987, 'SF');
    expect(jr.pos[0]).toBe('WR');
    expect(jr.stats.rectd).toBe(22);
    expect(jr.honors).toContain('ALLPRO1');
  });

  it('Justin Tucker 2016 Ravens: K with field goals', async () => {
    const jt = season((await loadCards('nfl')).lines, 'Justin Tucker', 2016, 'BAL');
    expect(jt.pos[0]).toBe('K');
    expect(jt.stats.fgm).toBe(38);
    expect(jt.stats.fga).toBe(39);
    expect(jt.stats.fgm50).toBe(10);
    expect(jt.rk.fgp).toBeGreaterThan(0.9);
  });

  it('Peyton Manning 2004 Colts: QB, MVP, a record promo', async () => {
    const { lines, byId } = await loadCards('nfl');
    const pm = season(lines, 'Peyton Manning', 2004, 'IND');
    expect(pm.pos[0]).toBe('QB');
    expect(pm.stats.td).toBe(49);
    expect(pm.honors).toContain('MVP');
    expect(byId.get(pm.id.replace(':season:', ':promo:'))?.boost).toBe(6);
  });

  it('Michael Strahan 2001 Giants: DE, 22.5 sacks', async () => {
    const ms = season((await loadCards('nfl')).lines, 'Michael Strahan', 2001, 'NYG');
    expect(ms.pos[0]).toBe('DE');
    expect(ms.stats.sk).toBe(22.5);
    expect(ms.honors).toEqual(expect.arrayContaining(['ALLPRO1', 'SACKS']));
  });

  it('the era shows: 1985 Raiders, 1972 Raiders', async () => {
    const { lines } = await loadCards('nfl');
    const ma = season(lines, 'Marcus Allen', 1985, 'LV');
    expect([ma.abbr, ma.teamName]).toEqual(['RAI', 'Los Angeles Raiders']);
    const jo = season(lines, 'Jim Otto', 1972, 'LV');
    expect([jo.abbr, jo.teamName, jo.pos[0]]).toEqual(['OAK', 'Oakland Raiders', 'C']);
    expect(jo.sparse).toBe(true);
  });

  it('legends include the obvious names', async () => {
    const names = new Set((await legendsOf('nfl')).map((l) => l.name));
    for (const n of ['Joe Montana', 'Tom Brady', 'Peyton Manning', 'Jerry Rice', 'Walter Payton', 'Barry Sanders', 'Lawrence Taylor',
      'Reggie White', 'Deion Sanders', 'Ronnie Lott', 'Anthony Munoz', 'Jim Otto'])
      expect(names.has(n), n).toBe(true);
  });
});
