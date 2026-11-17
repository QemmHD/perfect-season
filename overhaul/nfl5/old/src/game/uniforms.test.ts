import { NBA_TEAMS, NFL_TEAMS, type TeamInfo, teamOf } from '../data/teams';
import { aiFavorite, colorDistance, colorsClash, kitsFor } from './uniforms';

const team = (sport: 'nba' | 'nfl', abbr: string) => teamOf(sport, abbr) as TeamInfo;

describe('team data', () => {
  it('has the 30 NBA and 32 NFL franchises, each once, in real colors', () => {
    expect(NBA_TEAMS).toHaveLength(30);
    expect(NFL_TEAMS).toHaveLength(32);
    for (const list of [NBA_TEAMS, NFL_TEAMS]) {
      expect(new Set(list.map((t) => t.abbr)).size).toBe(list.length);
      expect(new Set(list.map((t) => t.name)).size).toBe(list.length);
      for (const t of list)
        for (const c of [t.c1, t.c2, t.alt, t.helmet, t.mask, t.pants].filter(Boolean)) expect(c, t.abbr).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(teamOf('nba', 'GSW')?.name).toBe('Golden State Warriors');
    expect(teamOf('nfl', 'GSW')).toBeNull();
    expect(teamOf('nba', 'toString')).toBeNull();
    expect(teamOf('nfl', 42)).toBeNull();
  });
});

describe('kitsFor', () => {
  it('dresses each side in his team’s home set, on the rival’s court', () => {
    const k = kitsFor('GSW', 'CHI', 'nba');
    expect(k.mine).toEqual({ jersey: '#1D428A', trim: '#FFC72C', shorts: '#1D428A', socks: expect.any(String), shoes: expect.any(String) });
    expect(k.theirs.jersey).toBe('#CE1141');
    expect(k.rivalAway).toBe(false);
    // your offense plays on the defense's floor
    expect(k.court.abbr).toBe('CHI');
    expect(k.court.c1).toBe('#CE1141');
    expect(colorDistance(k.court.c1, k.court.c2)).toBeGreaterThan(120);
    // the other phone sees it the other way round
    const o = kitsFor('CHI', 'GSW', 'nba');
    expect(o.mine.jersey).toBe('#CE1141');
    expect(o.theirs.jersey).toBe('#1D428A');
    expect(o.court.abbr).toBe('GSW');
  });

  it('puts the rival in his away set when both picked the same team', () => {
    for (const [sport, list] of [['nba', NBA_TEAMS], ['nfl', NFL_TEAMS]] as const)
      for (const t of list) {
        const k = kitsFor(t.abbr, t.abbr, sport);
        expect(k.rivalAway, t.abbr).toBe(true);
        expect(k.mine.jersey).toBe(t.c1);
        expect(k.theirs.jersey).toBe(t.alt);
        expect(k.court.abbr).toBe(t.abbr);
      }
  });

  it('puts the rival in his away set when the two home jerseys clash', () => {
    for (const [a, b] of [
      ['LAL', 'SAC'],
      ['CHI', 'TOR'],
      ['CHI', 'HOU'],
      ['GSW', 'LAC'],
      ['BKN', 'SAS'],
      ['DEN', 'MIN'],
      ['BOS', 'MIL'],
      ['NYK', 'PHI'],
      ['PHX', 'UTA'],
    ]) {
      expect(colorsClash(team('nba', a).c1, team('nba', b).c1), a + '/' + b).toBe(true);
      const k = kitsFor(a, b, 'nba');
      expect(k.rivalAway, a + ' vs ' + b).toBe(true);
      expect(k.theirs.jersey).toBe(team('nba', b).alt);
    }
    for (const [a, b] of [
      ['GSW', 'CHI'],
      ['LAL', 'BOS'],
      ['MIA', 'DAL'],
      ['MIA', 'BOS'],
      ['PHX', 'OKC'],
    ]) {
      expect(colorsClash(team('nba', a).c1, team('nba', b).c1), a + '/' + b).toBe(false);
      expect(kitsFor(a, b, 'nba').rivalAway, a + ' vs ' + b).toBe(false);
    }
    expect(kitsFor('NYG', 'NE', 'nfl').rivalAway).toBe(true);
    expect(kitsFor('KC', 'TB', 'nfl').rivalAway).toBe(true);
    expect(kitsFor('GB', 'KC', 'nfl').rivalAway).toBe(false);
  });

  it('never sends two sides out in jerseys that clash, whoever picks whom', () => {
    for (const [sport, list] of [['nba', NBA_TEAMS], ['nfl', NFL_TEAMS]] as const)
      for (const a of list)
        for (const b of list) {
          const k = kitsFor(a.abbr, b.abbr, sport);
          expect(colorsClash(k.mine.jersey, k.theirs.jersey), a.abbr + ' vs ' + b.abbr).toBe(false);
          expect(colorsClash(a.c1, b.c1)).toBe(colorsClash(b.c1, a.c1));
        }
  });

  it('gives each sport its kit', () => {
    expect(Object.keys(kitsFor('BOS', 'LAL', 'nba').mine).sort()).toEqual(['jersey', 'shoes', 'shorts', 'socks', 'trim']);
    const f = kitsFor('PIT', 'PIT', 'nfl');
    expect(Object.keys(f.mine).sort()).toEqual(['helmet', 'jersey', 'mask', 'pants', 'shoes', 'socks', 'stripe', 'trim']);
    expect(f.mine).toMatchObject({ jersey: '#101820', trim: '#FFB612', pants: '#FFB612' });
    // on the road: the white jersey, the same helmet
    expect(f.theirs).toMatchObject({ jersey: team('nfl', 'PIT').alt, helmet: f.mine.helmet });
    // white home pants go with colored ones on the road
    expect(kitsFor('KC', 'KC', 'nfl').theirs.pants).toBe('#E31837');
  });

  it('still dresses both sides when a pick is missing or unknown', () => {
    const k = kitsFor(null, null, 'nba');
    expect(colorsClash(k.mine.jersey, k.theirs.jersey)).toBe(false);
    expect(kitsFor('GSW', 'NOPE', 'nba').theirs.jersey).toBe(k.theirs.jersey);
    expect(kitsFor('<script>', 'CHI', 'nba').mine.jersey).toBe(k.mine.jersey);
    expect(kitsFor('GSW', null, 'nfl').mine.jersey).toBe(k.mine.jersey);
  });

  it('picks the AI a team from the game’s seed', () => {
    expect(aiFavorite('s1', 'nba')).toBe(aiFavorite('s1', 'nba'));
    expect(teamOf('nfl', aiFavorite('s1', 'nfl'))).not.toBeNull();
    for (let i = 0; i < 50; i++) expect(aiFavorite('s' + i, 'nba', 'GSW')).not.toBe('GSW');
    expect(new Set(Array.from({ length: 60 }, (_, i) => aiFavorite('x' + i, 'nba'))).size).toBeGreaterThan(15);
  });
});
