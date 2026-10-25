// Football: the data, the draft and the season, run with PS_SPORT=nfl (npm test does both sports).
import { CELLS, CELL_BY_ID, PLAYOFF_TEAMS, primeVersion } from './data';
import { assignSlots, draftReducer, eligibleSlots, isDraftComplete, newDraft, ROUNDS, whyUnavailable } from './draft';
import { buildBracket, isPerfect, matchupOdds, playoffOutcome, PLAYOFF_MIN_WINS, seriesWinChance, simSeries } from './playoffs';
import { rarityOf } from './rarity';
import { gradeFor, rateTeam, ratingForWins, WIN_CURVE, winsFromRating } from './rating';
import { rng } from './rng';
import { gameScore, playSeason } from './season';
import { NFL } from './sport';
import { emptyLineup, type Player, SLOTS } from './types';
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
  it('gives every cell a defense and enough players for every spot', () => {
    for (const c of CELLS) {
      const def = c.players.filter((p) => p.pos[0] === 'DEF');
      expect(def.length).toBe(1);
      expect(def[0].s.pa).toBeGreaterThan(5);
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
  it('rates the great defenses and players as such', () => {
    expect(rarityOf(find('CHI-1980', 'Bears Defense'))).toBe('legendary');
    expect(rarityOf(find('PIT-1970', 'Steelers Defense'))).toBe('legendary');
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
  });
});

describe.skipIf(!NFL)('football rules', () => {
  it('has six spots and a FLEX that takes backs, receivers and tight ends', () => {
    expect(SLOTS).toEqual(['QB', 'RB', 'WR', 'TE', 'FLEX', 'DEF']);
    expect(ROUNDS).toBe(6);
    const rb = find('CHI-1980', 'Walter Payton');
    let s = newDraft('classic', 'pro', null);
    s = draftReducer(s, { type: 'land', cellId: 'CHI-1980', ptr: 0 });
    expect(eligibleSlots(s, rb)).toEqual(['RB', 'FLEX']);
    s = draftReducer(s, { type: 'place', playerId: rb.id, slot: 'FLEX' });
    expect(s.lineup.FLEX?.name).toBe('Walter Payton');
    // the defense only plays DEF
    const d = find('CHI-1980', 'Bears Defense');
    expect(d.pos).toEqual(['DEF']);
    expect(whyUnavailable(s, d)).toBe(null);
  });
  it("trades a defense for the same franchise's from another decade, but never holds anyone twice", () => {
    const d70 = find('CHI-1970', 'Bears Defense');
    const d80 = find('CHI-1980', 'Bears Defense');
    const qb = find('SF-1980', 'Joe Montana');
    let s = newDraft('classic', 'pro', null);
    s = draftReducer(s, { type: 'land', cellId: 'CHI-1970', ptr: 0 });
    s = draftReducer(s, { type: 'place', playerId: d70.id, slot: 'DEF' });
    s = draftReducer(s, { type: 'endCell' });
    s = draftReducer(s, { type: 'land', cellId: 'CHI-1980', ptr: 0 });
    expect(whyUnavailable(s, d80)).toBe('dup');
    s = draftReducer(s, { type: 'arm', booster: 'trade' });
    expect(whyUnavailable(s, d80)).toBe(null);
    s = draftReducer(s, { type: 'place', playerId: d80.id, slot: 'DEF' });
    expect(s.lineup.DEF?.id).toBe(d80.id);
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
    const team: Player[] = [find('SF-1980', 'Joe Montana'), find('SF-1980', 'Jerry Rice'), find('CHI-1980', 'Walter Payton'), find('NE-2010', 'Rob Gronkowski'), find('KC-2020', 'Tyreek Hill'), find('PIT-1970', 'Steelers Defense')];
    const l = assignSlots(team)!;
    expect(l).not.toBeNull();
    for (const k of SLOTS) expect(l[k]!.pos).toContain(k);
    expect(l.FLEX).not.toBeNull();
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
