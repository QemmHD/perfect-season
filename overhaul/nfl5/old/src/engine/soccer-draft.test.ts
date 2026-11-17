// Claude 2026-11-01: the soccer draft game (PS_SPORT=soccer): its data, spots, ratings, the 38-game
// league with draws and points, the knockout cup with penalties, missions, the gauntlet and the
// telling of a game. Skipped in the other sports (their own suites cover them).
import { autoDraft } from './autodraft';
import { asOpponent, castGame, mirrorCast, seasonHeadlines } from './broadcast';
import { collect, coreSet } from './collection';
import { CELLS, CELL_BY_ID, ERAS, PLAYOFF_TEAMS } from './data';
import { rewardsFor } from './economy';
import { climb, gauntletLadder } from './gauntlet';
import { missionsFor } from './missions';
import { buildBracket, isPerfect, playoffOutcome, ROUND_NAMES, SERIES_WINS, shootoutScore, soccerTieOdds } from './playoffs';
import { rarityOf } from './rarity';
import { GAMES, gradeFor, rateTeam, ratingForWins, soccerDraws, soccerParts, winsFromRating } from './rating';
import { rng } from './rng';
import { DRAW, playSeason, recordOf } from './season';
import { SOCCER, SPORT } from './sport';
import { SLOTS, slotLabel } from './types';
import { DATA_V } from './version';

describe.runIf(SOCCER)('soccer draft', () => {
  it('loads forty clubs by decade, every player at his spots', () => {
    expect(SPORT).toBe('soccer');
    expect(CELLS.length).toBeGreaterThan(250);
    expect(new Set(CELLS.map((c) => c.fr)).size).toBe(40);
    expect(ERAS[0]).toBe('1950s');
    expect(SLOTS).toEqual(['GK', 'CB', 'FB', 'DM', 'AM', 'W', 'ST', 'FLEX']);
    expect([slotLabel('DM'), slotLabel('AM'), slotLabel('GK')]).toEqual(['DM/CM', 'CM/AM', 'GK']);
    for (const c of CELLS)
      for (const p of c.players) {
        expect(p.pos.length).toBeGreaterThan(0);
        expect(p.pos.every((s) => SLOTS.includes(s))).toBe(true);
        // a keeper only keeps goal; everyone else can play the FLEX
        expect(p.pos.includes('GK')).toBe(p.role === 'GK');
        if (p.role !== 'GK') expect(p.pos).toContain('FLEX');
        expect(Number.isFinite(p.val)).toBe(true);
      }
    const messi = CELL_BY_ID['BAR-2010'].players.find((p) => p.name === 'Lionel Messi')!;
    expect(messi.pos).toEqual(['W', 'ST', 'FLEX']);
    expect(rarityOf(messi)).toBe('legendary');
    // a central midfielder fills either midfield spot
    expect(soccerParts('CM', 80).mid).toBeGreaterThan(soccerParts('CB', 80).mid);
    const cm = CELLS.flatMap((c) => c.players).find((p) => p.role === 'CM' && p.roles!.length === 1)!;
    expect(cm.pos).toEqual(['DM', 'AM', 'FLEX']);
  });

  it('plays a 38-game league: wins, draws and losses add up, three points a win', () => {
    for (let i = 0; i < 30; i++) {
      const d = autoDraft(i % 2 ? 'best' : 'random', 400 + i);
      const s = playSeason(d.lineup);
      const r = recordOf(s.seq);
      expect(s.seq).toHaveLength(GAMES);
      expect(GAMES).toBe(38);
      expect(r.w).toBe(s.wins);
      expect(r.d).toBe(s.draws);
      expect(r.d).toBe(soccerDraws(s.wins));
      expect(r.w + r.d + r.l).toBe(38);
      expect(s.points).toBe(3 * r.w + r.d);
      // every game's score agrees with its result
      s.scores!.forEach((g, j) => {
        if (s.seq[j] === 1) expect(g.us).toBeGreaterThan(g.them);
        else if (s.seq[j] === DRAW) expect(g.us).toBe(g.them);
        else expect(g.us).toBeLessThan(g.them);
      });
      expect(s.pf).toBeGreaterThan(0);
    }
    expect(winsFromRating(ratingForWins(38))).toBe(38);
    expect(gradeFor(38).letter).toBe('S+');
    expect(gradeFor(22).tier).toBe('Cup Places');
  });

  it('keeps the draft difficulty where it was tuned', () => {
    const wins = (strat: 'random' | 'best') => Array.from({ length: 400 }, (_, i) => playSeason(autoDraft(strat, 9000 + i).lineup).wins).sort((a, b) => a - b);
    const random = wins('random');
    const best = wins('best');
    expect(random[200]).toBeGreaterThanOrEqual(11);
    expect(random[200]).toBeLessThanOrEqual(17);
    expect(best[200]).toBeGreaterThanOrEqual(23);
    expect(best[200]).toBeLessThanOrEqual(29);
    expect(best[399]).toBeLessThanOrEqual(38);
  });

  it('a knockout cup of one-game rounds; level after 90 minutes goes to penalties', () => {
    expect(ROUND_NAMES).toEqual(['Round of 16', 'Quarter-final', 'Semi-final', 'Final']);
    expect(SERIES_WINS).toBe(1);
    let pens = 0;
    let titles = 0;
    for (let i = 0; i < 300; i++) {
      const s = playSeason(autoDraft('best', 700 + i).lineup);
      const b = buildBracket(s, rng(i));
      for (const r of b.filter((x) => x.played)) {
        expect(r.games).toHaveLength(1);
        const [u, t] = r.scores![0];
        if (r.pens) {
          pens++;
          expect(u).toBe(t);
          expect(r.won).toBe(r.pens[0] > r.pens[1]);
        } else expect(r.won).toBe(u > t);
      }
      const out = playoffOutcome(b);
      if (out.title) titles++;
      // a perfect season: 38-0 and every round won inside 90 minutes
      if (out.title && b.some((x) => x.pens)) expect(isPerfect(GAMES, out)).toBe(false);
    }
    expect(pens).toBeGreaterThan(20);
    expect(titles).toBeGreaterThan(5);
    const o = soccerTieOdds(0.5);
    expect(o.draw).toBeCloseTo(0.27, 2);
    expect(o.win + o.draw * o.pens).toBeCloseTo(0.5, 5);
    for (let i = 0; i < 50; i++) {
      const [w, l] = shootoutScore(rng(i));
      expect(w).toBeGreaterThan(l);
    }
  });

  it('opponents are the great champions, W-D-L, with their elevens', () => {
    expect(PLAYOFF_TEAMS.length).toBe(75);
    for (const t of PLAYOFF_TEAMS) {
      expect(t.five.length).toBe(11);
      // (Ligue 1 2019-20 stopped after 27 or 28 games)
      expect(t.w + t.l + t.t).toBeGreaterThanOrEqual(27);
    }
    expect(gauntletLadder('2026-W44')).toHaveLength(8);
    const s = playSeason(autoDraft('best', 1).lineup);
    for (const g of climb(s, gauntletLadder('2026-W44'), 'x')) if (g.score) expect(g.won ? g.score[0] > g.score[1] : g.score[0] < g.score[1]).toBe(true);
  });

  it('tells a game in two halves of goals, with a shootout when level', () => {
    const d = autoDraft('best', 3);
    const opp = PLAYOFF_TEAMS[0];
    const g = castGame({ lineup: d.lineup, opp, won: true, score: [2, 1], pre: 0.6, seed: 's' });
    expect(g.periods).toHaveLength(2);
    expect(g.events.filter((e) => e.side).length).toBe(3);
    expect(g.events.every((e) => /'$/.test(e.clock))).toBe(true);
    expect(g.won).toBe(true);
    const pen = castGame({ lineup: d.lineup, opp, won: false, score: [1, 1], pre: 0.5, seed: 'p', pens: [3, 4] });
    expect(pen.won).toBe(false);
    expect(pen.events[pen.events.length - 1].clock).toBe('PENS');
    expect(mirrorCast(pen).won).toBe(true);
    expect(mirrorCast(pen).pens).toEqual([4, 3]);
    const s = playSeason(d.lineup);
    expect(seasonHeadlines(d.lineup, s.seq, s.scores, 'h').length).toBeLessThanOrEqual(5);
    expect(asOpponent(d.lineup, 'Rival', 'RIV', ['#000', '#fff']).five.length).toBe(8);
  });

  it('missions, rewards, binder sets and the data fingerprint are soccer’s own', () => {
    expect(missionsFor('2026-11-01').some((m) => /cup|Legendary|Head to Head|90%/.test(m.text))).toBe(true);
    const r = rewardsFor({ wins: 30, seriesWon: 2, title: false, mode: 'classic', vsWon: null, botLevel: 'pro', rankedDaily: false });
    expect(r.lines.join(' ')).toMatch(/cup ties won/);
    const cell = CELL_BY_ID['BAR-2010'];
    const set = coreSet(cell);
    expect(set).toHaveLength(8);
    expect(set.filter((p) => p.role === 'GK')).toHaveLength(1);
    expect(collect({}, set).sets).toEqual(['BAR-2010']);
    expect(typeof DATA_V).toBe('string');
    expect(rateTeam(SLOTS.map(() => null)).wins).toBe(0);
  });
});
