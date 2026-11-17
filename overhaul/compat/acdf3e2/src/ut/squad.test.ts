// Squads: chemistry, the team overall and auto-build (npm test runs both sports; these use made-up
// cards, so they check both sports' formations either way).
import { fakeCard } from './fake.test-util';
import { autoBuild, canPlay, chemistry, CHEM_BONUS, FULL_LINK, linkScore, NBA_LINKS, NBA_SLOTS, NFL_LINKS, NFL_SLOTS, playsIn, positionMix, rateSquad, startersComplete } from './squad';
import type { RatedCard } from './types';

const fiveOf = (o: { fr?: string; season?: (i: number) => number; ovr?: number[] }): Record<string, RatedCard> =>
  Object.fromEntries(['PG', 'SG', 'SF', 'PF', 'C'].map((p, i) => [p, fakeCard({ pos: p, ovr: o.ovr?.[i] ?? 80, fr: o.fr ?? 'T' + i, season: o.season ? o.season(i) : 1970 + i * 11 })]));

describe('formations', () => {
  it('has the squads the design asks for', () => {
    expect(NBA_SLOTS.filter((s) => s.unit === 'start').map((s) => s.pos).sort()).toEqual(['C', 'PF', 'PG', 'SF', 'SG']);
    expect(NBA_SLOTS.filter((s) => s.unit === 'bench')).toHaveLength(5);
    expect(NFL_SLOTS).toHaveLength(23);
    expect(positionMix('nfl')).toEqual({ WR: 3, TE: 1, OT: 2, OG: 2, C: 1, QB: 1, RB: 1, K: 1, CB: 2, S: 2, LB: 3, DE: 2, DT: 2 });
    // every link joins two real slots, once
    for (const [slots, links] of [
      [NBA_SLOTS, NBA_LINKS],
      [NFL_SLOTS, NFL_LINKS],
    ] as const) {
      const ids = new Set(slots.map((s) => s.id));
      const seen = new Set<string>();
      for (const [a, b] of links) {
        expect(ids.has(a) && ids.has(b)).toBe(true);
        const k = [a, b].sort().join('-');
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
  });

  it('lets a card play its own positions only (and anyone on the bench)', () => {
    const pf = fakeCard({ pos: ['PF', 'C'], ovr: 70 });
    expect(canPlay(NBA_SLOTS.find((s) => s.id === 'C')!, pf)).toBe(true);
    expect(canPlay(NBA_SLOTS.find((s) => s.id === 'PG')!, pf)).toBe(false);
    expect(canPlay(NBA_SLOTS.find((s) => s.id === 'B3')!, pf)).toBe(true);
    expect(canPlay(NFL_SLOTS.find((s) => s.id === 'LT')!, fakeCard({ pos: 'OT', ovr: 70, sport: 'nfl' }))).toBe(true);
    expect(canPlay(NFL_SLOTS.find((s) => s.id === 'LG')!, fakeCard({ pos: 'OT', ovr: 70, sport: 'nfl' }))).toBe(false);
  });
});

describe('chemistry', () => {
  it('scores a link: same franchise +3, same decade +2, same season +4', () => {
    const a = fakeCard({ pos: 'PG', ovr: 70, fr: 'CHI', season: 1996 });
    expect(linkScore(a, fakeCard({ pos: 'SG', ovr: 70, fr: 'CHI', season: 1996 }))).toBe(9);
    expect(linkScore(a, fakeCard({ pos: 'SG', ovr: 70, fr: 'CHI', season: 1991 }))).toBe(5);
    expect(linkScore(a, fakeCard({ pos: 'SG', ovr: 70, fr: 'CHI', season: 1987 }))).toBe(3);
    expect(linkScore(a, fakeCard({ pos: 'SG', ovr: 70, fr: 'NYK', season: 1996 }))).toBe(6);
    expect(linkScore(a, fakeCard({ pos: 'SG', ovr: 70, fr: 'NYK', season: 1999 }))).toBe(2);
    expect(linkScore(a, fakeCard({ pos: 'SG', ovr: 70, fr: 'NYK', season: 2004 }))).toBe(0);
  });

  it('is 100 for one team-season, 0 for strangers, and counts an empty end as nothing', () => {
    expect(chemistry('nba', fiveOf({ fr: 'CHI', season: () => 1996 })).chem).toBe(100);
    // five teams, five decades
    expect(chemistry('nba', fiveOf({})).chem).toBe(0);
    // same franchise, different decades: 3 of 6 per link
    expect(chemistry('nba', fiveOf({ fr: 'BOS' })).chem).toBe(50);
    const four = fiveOf({ fr: 'CHI', season: () => 1996 });
    delete four.C;
    // two of the five links lose their center
    expect(chemistry('nba', four).chem).toBe(60);
    expect(FULL_LINK).toBe(6);
  });

  it('works on the football field too', () => {
    const lineup = Object.fromEntries(NFL_SLOTS.map((s) => [s.id, fakeCard({ pos: s.pos!, ovr: 80, fr: 'SF', season: 1989, sport: 'nfl' })]));
    expect(chemistry('nfl', lineup).chem).toBe(100);
    const r = chemistry('nfl', { ...lineup, QB: fakeCard({ pos: 'QB', ovr: 80, fr: 'DAL', season: 2010, sport: 'nfl' }) });
    // the quarterback's two links break
    expect(r.links.filter((l) => l.score === 0)).toHaveLength(2);
    expect(r.chem).toBe(Math.round((100 * (NFL_LINKS.length - 2)) / NFL_LINKS.length));
  });
});

describe('team overall', () => {
  it('averages the starters and adds up to 3 for chemistry', () => {
    const strangers = rateSquad('nba', fiveOf({ ovr: [70, 75, 80, 85, 90] }));
    expect(strangers.base).toBe(80);
    expect(strangers.ovr).toBe(80);
    const team = rateSquad('nba', fiveOf({ ovr: [70, 75, 80, 85, 90], fr: 'CHI', season: () => 1996 }));
    expect(team.raw).toBeCloseTo(80 + CHEM_BONUS);
    expect(team.ovr).toBe(83);
    // the bench doesn't count toward it
    const benched = rateSquad('nba', { ...fiveOf({ ovr: [70, 75, 80, 85, 90] }), B1: fakeCard({ pos: 'C', ovr: 99 }) });
    expect(benched.base).toBe(80);
    expect(benched.filled).toBe(6);
  });

  it('counts an empty starter as 0 and knows when the squad is complete', () => {
    const four = fiveOf({ ovr: [80, 80, 80, 80, 80] });
    delete four.PG;
    const r = rateSquad('nba', four);
    expect(r.base).toBe(64);
    expect(r.complete).toBe(false);
    expect(startersComplete('nba', four)).toBe(false);
    expect(startersComplete('nba', fiveOf({}))).toBe(true);
  });

  it('weights football positions: the quarterback counts most', () => {
    const lineup = Object.fromEntries(NFL_SLOTS.map((s) => [s.id, fakeCard({ pos: s.pos!, ovr: 70, fr: 'T' + s.id, season: 1970 + NFL_SLOTS.indexOf(s) * 2, sport: 'nfl' })]));
    const base = rateSquad('nfl', lineup).base;
    expect(base).toBeCloseTo(70);
    const qb = rateSquad('nfl', { ...lineup, QB: fakeCard({ pos: 'QB', ovr: 90, fr: 'X', season: 2023, sport: 'nfl' }) }).base;
    const k = rateSquad('nfl', { ...lineup, K: fakeCard({ pos: 'K', ovr: 90, fr: 'X', season: 2023, sport: 'nfl' }) }).base;
    expect(qb - base).toBeGreaterThan(4 * (k - base));
  });
});

describe('auto-build', () => {
  it('fills every spot with the best card that can play it, one player once', () => {
    const club = [
      ...['PG', 'SG', 'SF', 'PF', 'C'].flatMap((p, i) => [70, 80].map((o) => ({ uid: p + o, rc: fakeCard({ pos: p, ovr: o + i, fr: 'T' + p + o, season: 1960 + i * 12 + (o === 80 ? 6 : 0) }) }))),
      // the same man twice: only one of him plays
      { uid: 'dupe', rc: fakeCard({ pos: 'PG', ovr: 99, pid: 'same', fr: 'Q', season: 2001 }) },
      { uid: 'dupe2', rc: fakeCard({ pos: 'SG', ovr: 98, pid: 'same', fr: 'Q', season: 2002 }) },
    ];
    const squad = autoBuild('nba', club);
    const byUid = new Map(club.map((c) => [c.uid, c.rc]));
    for (const sl of NBA_SLOTS) if (squad[sl.id]) expect(canPlay(sl, byUid.get(squad[sl.id])!)).toBe(true);
    expect([squad.PG, squad.SG].filter((u) => u === 'dupe' || u === 'dupe2')).toHaveLength(1);
    expect(new Set(Object.values(squad)).size).toBe(Object.values(squad).length);
    const pids = Object.values(squad).map((u) => byUid.get(u)!.line.pid);
    expect(new Set(pids).size).toBe(pids.length);
    // the starters are complete and the bench is filled from what's left
    expect(startersComplete('nba', Object.fromEntries(Object.entries(squad).map(([s, u]) => [s, byUid.get(u)])))).toBe(true);
    expect(NBA_SLOTS.filter((s) => s.unit === 'bench' && squad[s.id]).length).toBe(5);
  });

  it('takes a slightly worse card when its chemistry is worth more', () => {
    // four Bulls of 1996, and at center a 1996 Bull (78) or a stranger (79)
    const bulls = ['PG', 'SG', 'SF', 'PF'].map((p) => ({ uid: p, rc: fakeCard({ pos: p, ovr: 80, fr: 'CHI', season: 1996 }) }));
    const club = [...bulls, { uid: 'bull', rc: fakeCard({ pos: 'C', ovr: 78, fr: 'CHI', season: 1996 }) }, { uid: 'stranger', rc: fakeCard({ pos: 'C', ovr: 79, fr: 'UTA', season: 1973 }) }];
    expect(autoBuild('nba', club).C).toBe('bull');
  });
});

describe('the cards that play', () => {
  it('are the five and the first three off the bench in basketball, everyone in football', () => {
    for (const x of ['PG', 'C', 'B1', 'B2', 'B3']) expect(playsIn('nba', x)).toBe(true);
    expect(playsIn('nba', 'B4')).toBe(false);
    expect(playsIn('nba', 'B5')).toBe(false);
    expect(playsIn('nba', null)).toBe(false);
    for (const x of NFL_SLOTS) expect(playsIn('nfl', x.id)).toBe(true);
    expect(playsIn('nfl', null)).toBe(false);
  });
});
