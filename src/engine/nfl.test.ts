// Football: the data, the draft and the season, run with PS_SPORT=nfl (npm test does both sports).
import { CELLS, CELL_BY_ID, PLAYOFF_TEAMS, primeVersion } from './data';
import { assignSlots, draftReducer, eligibleSlots, isDraftComplete, newDraft, ROUNDS, whyUnavailable } from './draft';
import { buildBracket, isPerfect, matchupOdds, playoffOutcome, PLAYOFF_MIN_WINS, seriesWinChance, simSeries } from './playoffs';
import { RARITY_MIN, rarityOf } from './rarity';
import { gradeFor, rateTeam, ratingForWins, WIN_CURVE, winsFromRating } from './rating';
import { rng } from './rng';
import { gameScore, playSeason } from './season';
import { NFL } from './sport';
import { DEF_SLOTS, emptyLineup, type Player, SLOTS } from './types';
import { autoDraft } from './autodraft';

const find = (cellId: string, name: string) => CELL_BY_ID[cellId].players.find((p) => p.name === name)!;

describe.skipIf(!NFL)('football data', () => {
  it('has every franchise-decade since 1970 with real lines', () => {
    expect(CELLS.length).toBeGreaterThan(175);
    const montana = find('SF-1980', 'Joe Montana');
    expect(montana.pos).toEqual(['QB']);
    expect(montana.s.passYds).toBeGreaterThan(200);
    const rice = find('SF-1980', 'Jerry Rice');
    expect(rice.pos).toEqual(['WR', 'FLEX']);
    expect(rarityOf(rice)).toBe('legendary');
    expect(CELL_BY_ID['LV-1980'].name).toBe('Los Angeles Raiders');
    expect(CELL_BY_ID['TEN-1990'].name).toBe('Houston Oilers');
    expect(CELL_BY_ID['IND-1970'].name).toBe('Baltimore Colts');
    expect(CELL_BY_ID['LAR-2010'].name).toBe('St. Louis Rams');
  });
  it('gives every cell its defenders and enough players for every spot', () => {
    for (const c of CELLS) {
      for (const k of DEF_SLOTS) {
        const d = c.players.filter((p) => p.pos[0] === k);
        expect(d.length, c.id + ' ' + k).toBeGreaterThanOrEqual(3);
        expect(d.length).toBeLessThanOrEqual(7);
        // a defender plays his own spot only, and knows the position he played
        for (const p of d) {
          expect(p.pos).toEqual([k]);
          expect(p.role).toBeTruthy();
        }
      }
      expect(c.players.some((p) => p.pos[0] === 'QB')).toBe(true);
      const ids = new Set(c.players.map((p) => p.id));
      expect(ids.size).toBe(c.players.length);
      const names = new Set(c.players.map((p) => p.name));
      expect(names.size).toBe(c.players.length);
      for (const p of c.players) {
        expect(p.val).toBeGreaterThan(0);
        expect(p.val).toBeLessThan(31);
        expect(Number.isFinite(p.val)).toBe(true);
      }
    }
  });
  it('rates the great defenders and players as such, whatever their era', () => {
    const lt = find('NYG-1980', 'Lawrence Taylor');
    expect(lt.pos).toEqual(['LB']);
    expect(lt.r.def).toBe(lt.val);
    expect(lt.s.sacks).toBeGreaterThan(10);
    expect(lt.s.pb).toBe(9);
    const reggie = find('PHI-1980', 'Reggie White');
    expect(reggie.pos).toEqual(['DL']);
    expect(reggie.s.sacks).toBeGreaterThan(14);
    const greats = [lt, reggie, find('SF-1980', 'Ronnie Lott'), find('SF-1990', 'Deion Sanders'), find('DAL-1990', 'Deion Sanders'), find('LAR-2010', 'Aaron Donald'), find('CHI-1980', 'Mike Singletary')];
    for (const p of greats) expect(rarityOf(p), p.name + ' ' + p.cellId).toBe('legendary');
    // near the top of every line at their spot: Taylor and White the top 1%, the defensive backs the top 2%
    const above = (p: Player) => {
      const all = CELLS.flatMap((c) => c.players).filter((x) => x.pos[0] === p.pos[0]);
      return all.filter((x) => x.val > p.val).length / all.length;
    };
    expect(above(lt)).toBeLessThan(0.01);
    expect(above(reggie)).toBeLessThan(0.01);
    expect(above(find('SF-1980', 'Ronnie Lott'))).toBeLessThan(0.02);
    expect(above(find('SF-1990', 'Deion Sanders'))).toBeLessThan(0.02);
    // a backup who barely played rates low
    const backups = CELLS.flatMap((c) => c.players).filter((p) => DEF_SLOTS.includes(p.pos[0]) && p.seasons === 1 && p.g < 8 && !p.s.pb && !p.s.ap);
    expect(backups.length).toBeGreaterThan(5);
    expect(backups.reduce((a, p) => a + p.val, 0) / backups.length).toBeLessThan(RARITY_MIN.rare);
    // each decade's best defenders are about as strong as any other's
    const decade = (era: string) => {
      const vals = CELLS.filter((c) => c.era === era).flatMap((c) => DEF_SLOTS.map((k) => c.players.find((p) => p.pos[0] === k)!.val));
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    for (const era of ['1970s', '1980s', '1990s', '2010s', '2020s']) expect(Math.abs(decade(era) - decade('2000s')), era).toBeLessThan(1.5);
    expect(rarityOf(find('KC-2010', 'Patrick Mahomes'))).toBe('legendary');
    expect(rarityOf(find('NE-2010', 'Rob Gronkowski'))).toBe('legendary');
    // a quarterback's value is passing and running; a receiver's is catching and running
    const brady = find('NE-2010', 'Tom Brady');
    expect(brady.r.recv).toBe(0);
    expect(brady.r.pass).toBeGreaterThan(brady.r.rush);
  });
  it('primes a player to his best team-decade', () => {
    const favre = find('GB-2000', 'Brett Favre');
    const up = primeVersion(favre)!;
    expect(up.val).toBeGreaterThan(favre.val);
    expect(up.cellId).toBe('GB-2000');
    // every Prime points to a team-decade that lists him, with a better line
    for (const c of CELLS) for (const p of c.players) if (p.primeRef) expect(primeVersion(p), p.name + ' ' + c.id).not.toBeNull();
  });
  it('lists real playoff teams with their key players', () => {
    const bears = PLAYOFF_TEAMS.find((t) => t.year === '1985' && t.team === 'Chicago Bears')!;
    expect([bears.w, bears.l, bears.wFull, bears.champ]).toEqual([15, 1, 16, true]);
    expect(bears.five.map((p) => p.name)).toContain('Walter Payton');
    const fins = PLAYOFF_TEAMS.find((t) => t.year === '1972' && t.team === 'Miami Dolphins')!;
    expect(fins.wFull).toBe(17);
    for (const t of PLAYOFF_TEAMS) expect(t.five.length).toBeGreaterThanOrEqual(3);
    // and their defense: the season's best at each spot
    expect(bears.def!.map((p) => p.pos)).toEqual(['DL', 'LB', 'DB']);
    expect(bears.def!.map((p) => p.name)).toContain('Mike Singletary');
    for (const t of PLAYOFF_TEAMS) expect(t.def!.length).toBe(3);
  });
});

describe.skipIf(!NFL)('football rules', () => {
  it('has eight spots: a FLEX that takes backs, receivers and tight ends, and three defenders', () => {
    expect(SLOTS).toEqual(['QB', 'RB', 'WR', 'TE', 'FLEX', 'DL', 'LB', 'DB']);
    expect(ROUNDS).toBe(8);
    const rb = find('CHI-1980', 'Walter Payton');
    let s = newDraft('classic', 'pro', null);
    s = draftReducer(s, { type: 'land', cellId: 'CHI-1980', ptr: 0 });
    expect(eligibleSlots(s, rb)).toEqual(['RB', 'FLEX']);
    s = draftReducer(s, { type: 'place', playerId: rb.id, slot: 'FLEX' });
    expect(s.lineup.FLEX?.name).toBe('Walter Payton');
    // a defender only plays his own spot
    s = draftReducer(s, { type: 'endCell' });
    s = draftReducer(s, { type: 'land', cellId: 'NYG-1980', ptr: 0 });
    const lt = find('NYG-1980', 'Lawrence Taylor');
    expect(whyUnavailable(s, lt)).toBe(null);
    expect(eligibleSlots(s, lt)).toEqual(['LB']);
    expect(draftReducer(s, { type: 'place', playerId: lt.id, slot: 'DL' }).lineup.DL).toBe(null);
    s = draftReducer(s, { type: 'place', playerId: lt.id, slot: 'LB' });
    expect(s.lineup.LB?.name).toBe('Lawrence Taylor');
    s = draftReducer(s, { type: 'endCell' });
    s = draftReducer(s, { type: 'land', cellId: 'CHI-1980', ptr: 0 });
    expect(whyUnavailable(s, find('CHI-1980', 'Mike Singletary'))).toBe('nofit');
    expect(whyUnavailable(s, find('CHI-1980', 'Richard Dent'))).toBe(null);
  });
  it('trades a defender for his line from another decade, but never holds anyone twice', () => {
    const r80 = find('PHI-1980', 'Reggie White');
    const r90 = find('GB-1990', 'Reggie White');
    const qb = find('SF-1980', 'Joe Montana');
    let s = newDraft('classic', 'pro', null);
    s = draftReducer(s, { type: 'land', cellId: 'GB-1990', ptr: 0 });
    s = draftReducer(s, { type: 'place', playerId: r90.id, slot: 'DL' });
    s = draftReducer(s, { type: 'endCell' });
    s = draftReducer(s, { type: 'land', cellId: 'PHI-1980', ptr: 0 });
    expect(whyUnavailable(s, r80)).toBe('dup');
    s = draftReducer(s, { type: 'arm', booster: 'trade' });
    expect(whyUnavailable(s, r80)).toBe(null);
    s = draftReducer(s, { type: 'place', playerId: r80.id, slot: 'DL' });
    expect(s.lineup.DL?.id).toBe(r80.id);
    // never for the very line already on the team (picked earlier this turn with Double)
    let u = newDraft('classic', 'pro', null);
    u = draftReducer(u, { type: 'land', cellId: 'PHI-1980', ptr: 0 });
    u = draftReducer(u, { type: 'arm', booster: 'double' });
    u = draftReducer(u, { type: 'place', playerId: r80.id, slot: 'DL' });
    u = draftReducer(u, { type: 'arm', booster: 'trade' });
    expect(whyUnavailable(u, r80)).toBe('dup');
    // a back held at RB could take FLEX in a trade and be on the team twice
    const p70 = find('CHI-1970', 'Walter Payton');
    const p80 = find('CHI-1980', 'Walter Payton');
    let t = newDraft('classic', 'pro', null);
    for (const [cell, p, slot] of [['CHI-1970', p70, 'RB'], ['SF-1980', qb, 'QB'], ['SF-1980', find('SF-1980', 'Jerry Rice'), 'FLEX']] as const) {
      t = draftReducer(t, { type: 'land', cellId: cell, ptr: 0 });
      t = draftReducer(t, { type: 'place', playerId: p.id, slot });
      t = draftReducer(t, { type: 'endCell' });
    }
    t = draftReducer(t, { type: 'land', cellId: 'CHI-1980', ptr: 0 });
    t = draftReducer(t, { type: 'arm', booster: 'trade' });
    expect(whyUnavailable(t, p80)).toBe('dup');
  });
  it('seats any legal team', () => {
    const team: Player[] = [
      find('SF-1980', 'Joe Montana'),
      find('SF-1980', 'Jerry Rice'),
      find('CHI-1980', 'Walter Payton'),
      find('NE-2010', 'Rob Gronkowski'),
      find('KC-2020', 'Tyreek Hill'),
      find('PHI-1980', 'Reggie White'),
      find('NYG-1980', 'Lawrence Taylor'),
      find('SF-1980', 'Ronnie Lott'),
    ];
    const l = assignSlots(team)!;
    expect(l).not.toBeNull();
    for (const k of SLOTS) expect(l[k]!.pos).toContain(k);
    expect(l.FLEX).not.toBeNull();
    expect([l.DL!.name, l.LB!.name, l.DB!.name]).toEqual(['Reggie White', 'Lawrence Taylor', 'Ronnie Lott']);
  });
  it('plays a 17-game season with scores that agree with the record', () => {
    const s = autoDraft('best', 7, 'classic');
    expect(isDraftComplete(s)).toBe(true);
    const season = playSeason(s.lineup);
    expect(season.seq.length).toBe(17);
    expect(season.scores!.length).toBe(17);
    season.scores!.forEach((g, i) => expect(g.us > g.them).toBe(season.seq[i] === 1));
    expect(season.wins).toBe(season.seq.filter((x) => x === 1).length);
    expect(season.pf!).toBeGreaterThan(10);
    expect(season.pa!).toBeLessThan(40);
    // same lineup, same season
    expect(playSeason(s.lineup).scores).toEqual(season.scores);
  });
  it('always gives a game a score that matches its result', () => {
    // even when the dice can't help it: a constant random number makes both teams score the same
    for (const x of [0.0001, 0.5, 0.9999]) {
      const [a, b] = gameScore(true, 24, 18, () => x);
      expect(a).toBeGreaterThan(b);
      const [c, d] = gameScore(false, 24, 18, () => x);
      expect(c).toBeLessThan(d);
      expect(Math.min(a, b, c, d)).toBeGreaterThanOrEqual(0);
    }
  });
  it('win curve covers 0 to 17 and inverts', () => {
    expect(WIN_CURVE[WIN_CURVE.length - 1][1]).toBe(17);
    for (const w of [3, 8, 10, 13, 16, 17]) expect(winsFromRating(ratingForWins(w))).toBe(w);
    expect(gradeFor(17).letter).toBe('S+');
    expect(gradeFor(PLAYOFF_MIN_WINS).tier).toBe('Playoff Team');
  });
  it('plays one-game playoff rounds with the right odds', () => {
    const opp = PLAYOFF_TEAMS.find((t) => t.wFull === 13)!;
    const ours = ratingForWins(14);
    const exact = seriesWinChance(ours, 14, opp, 1);
    expect(exact).toBeCloseTo(matchupOdds(ours, opp).home, 6);
    let won = 0;
    const r = rng(3);
    for (let i = 0; i < 4000; i++) if (simSeries(ours, 14, opp, r, 1)[0] === 1) won++;
    expect(Math.abs(won / 4000 - exact)).toBeLessThan(0.03);
    // the Super Bowl is on neutral ground
    expect(seriesWinChance(ours, 14, opp, 3)).toBeCloseTo(matchupOdds(ours, opp).neutral, 6);
  });
  it('a 17-0 team usually, but not always, wins it all', () => {
    let titles = 0;
    const N = 3000;
    // the lowest rating that goes 17-0: no 17-win playoff team is rated above it
    const lowest = WIN_CURVE.find(([, w]) => w === 16.5)![0];
    expect(winsFromRating(lowest)).toBe(17);
    expect(ratingForWins(17)).toBeLessThan(lowest + 0.5);
    const season = { ...rateTeam([]), rating: lowest, wins: 17, pf: 32, pa: 14 };
    for (let i = 0; i < N; i++) {
      const b = buildBracket(season, rng(100 + i));
      const out = playoffOutcome(b);
      if (out.title) titles++;
      for (const x of b.filter((x) => x.played)) {
        expect(x.games.length).toBe(1);
        expect(x.scores![0][0] > x.scores![0][1]).toBe(x.won);
      }
      if (out.title) expect(isPerfect(17, out)).toBe(true);
    }
    const p = titles / N;
    expect(p).toBeGreaterThan(0.55);
    expect(p).toBeLessThan(0.72);
  });
  it('rates an empty team at zero and a full team in range', () => {
    expect(rateTeam(Object.values(emptyLineup())).wins).toBe(0);
    const s = autoDraft('best', 11, 'classic');
    const r = rateTeam(SLOTS.map((k) => s.lineup[k]));
    expect(r.wins).toBeGreaterThan(5);
  });
});
