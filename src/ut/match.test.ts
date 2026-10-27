// Playing squads: the converters to the games' teams, the Squad Battles ladder, the head to head
// window, and what a finished match settles.
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { squadsFit, squadWindow } from '../net/match';
import { aiOpponent, battlesThisWeek, ladderFor, RUNG_PACKS, RUNGS, shortName, weekLadder } from './battles';
import { COINS_LOSS, COINS_WIN, decide, settle, XP_FOR_WIN, XP_PER_GAME } from './play';
import { getPool, type Pool } from './pool';
import { onScale, rateCard } from './rate';
import { startersComplete } from './squad';
import { freshUt, type UtState } from './state';
import { cardToFb, cardToHooper, defenseOfSquad, fiveOfSquad, lineupOf, offenseOfSquad, ratingOf, type SquadCards, squadFromWire, squadToWire, type SquadWire, teamsOf } from './teams';

let pool: Pool;
let ladder: ReturnType<typeof ladderFor>;
const WEEK = '2026-W44';

beforeAll(async () => {
  pool = await getPool();
  ladder = ladderFor(pool, WEEK);
}, 60000);

const squadOf = (w: SquadWire) => squadFromWire(pool, w);

describe('the head to head window', () => {
  it('starts at 3 and widens by 2 every 10 seconds, to 10 at most', () => {
    expect([0, 9999, 10000, 19999, 20000, 30000, 40000, 120000].map(squadWindow)).toEqual([3, 3, 5, 5, 7, 9, 10, 10]);
    expect(squadWindow(-500)).toBe(3);
  });

  it('pairs squads inside the window only', () => {
    expect(squadsFit(80, 83, 0)).toBe(true);
    expect(squadsFit(80, 84, 0)).toBe(false);
    expect(squadsFit(80, 84, 10000)).toBe(true);
    expect(squadsFit(80, 70, 40000)).toBe(true);
    expect(squadsFit(80, 69, 600000)).toBe(false);
    // a searcher who didn't say (a draft player, an older app) never fits
    expect(squadsFit(80, undefined, 0)).toBe(false);
    expect(squadsFit(80, NaN, 40000)).toBe(false);
  });
});

describe('squads on the wire', () => {
  it('round-trips, and drops what this phone can’t place', () => {
    const w = ladder[3].squad;
    const sq = squadOf(w);
    expect(squadToWire(sq)).toEqual(w.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    const [slot, id] = w[0];
    const junk: unknown[] = [['ZZ', id, 1], [slot, 'no-such-card', 1], [slot, id, 9], [slot, id, 1.5], 'x', null, [slot, id], [slot, id, 2], [slot, w[1][1], 3]];
    const got = squadFromWire(pool, junk);
    // only the first good entry for the slot
    expect(Object.keys(got)).toEqual([slot]);
    expect(got[slot].level).toBe(2);
    expect(squadFromWire(pool, 'nope')).toEqual({});
  });
});

describe('cards as the game’s players', () => {
  it('rates a card at the spot it plays and its level', () => {
    const [slot, id] = ladder[5].squad[0];
    const line = pool.byId.get(id)!;
    const pos = SPORT === 'nba' ? (line.pos[0] ?? slot) : line.pos[0];
    if (SPORT === 'nba') {
      const h = cardToHooper(line, 1, pos);
      expect(h.pos).toBe(pos);
      expect(h.ovr).toBe(rateCard(line, 1, pos).ovr);
      expect(cardToHooper(line, 5, pos).ovr).toBeGreaterThanOrEqual(h.ovr);
    } else {
      const p = cardToFb(line, 1, pos);
      expect(p.pos).toBe(pos);
      expect(p.id).toBe(line.id);
      expect(p.ovr).toBe(rateCard(line, 1, pos).ovr);
      expect(cardToFb(line, 5, pos).ovr).toBeGreaterThanOrEqual(p.ovr);
    }
  });

  it.runIf(SPORT === 'nba')('makes a five in the game’s order and a bench, best first', () => {
    const sq = squadOf(ladder[4].squad);
    const { five, bench } = fiveOfSquad(sq);
    expect(five.map((h) => h.pos)).toEqual(['PG', 'SG', 'SF', 'PF', 'C']);
    expect(five.map((h) => h.id)).toEqual(['PG', 'SG', 'SF', 'PF', 'C'].map((s) => sq[s].line.id));
    expect(bench.length).toBe(5);
    for (let i = 1; i < bench.length; i++) expect(bench[i - 1].ovr).toBeGreaterThanOrEqual(bench[i].ovr - 3);
    // an empty starting spot: someone off the bench steps in
    const noC: SquadCards = { ...sq };
    delete noC.C;
    const b = fiveOfSquad(noC);
    expect(b.five[4].pos).toBe('C');
    expect(b.bench.length).toBe(4);
    expect(Object.values(sq).some((c) => c.line.id === b.five[4].id)).toBe(true);
    // nobody at all: replacement players
    const empty = fiveOfSquad({});
    expect(empty.five.map((h) => h.name)).toEqual(['Reserve PG', 'Reserve SG', 'Reserve SF', 'Reserve PF', 'Reserve C']);
    expect(empty.bench).toEqual([]);
  });

  it.runIf(SPORT === 'nfl')('makes an offense and a defense with every spot in place', () => {
    const sq = squadOf(ladder[4].squad);
    const o = offenseOfSquad(sq, 's');
    expect([o.qb.pos, o.rb.pos, o.te.pos, o.k.pos]).toEqual(['QB', 'RB', 'TE', 'K']);
    expect(o.wr.map((p) => p.id)).toEqual(['WR1', 'WR2', 'WR3'].map((s) => sq[s].line.id));
    expect(o.ol.map((p) => p.pos)).toEqual(['OT', 'OG', 'C', 'OG', 'OT']);
    const d = defenseOfSquad(sq, 's');
    expect(d.dl.map((p) => p.pos)).toEqual(['DE', 'DT', 'DT', 'DE']);
    expect([d.lb.length, d.cb.length, d.s.length]).toEqual([3, 2, 2]);
    expect(d.s.map((p) => p.id)).toEqual([sq.FS.line.id, sq.SS.line.id]);
    // an empty spot gets a depth player, the same one for the same seed
    const noQb: SquadCards = { ...sq };
    delete noQb.QB;
    const a = offenseOfSquad(noQb, 'seed').qb;
    expect(a.pos).toBe('QB');
    expect(a.ovr).toBeLessThan(o.qb.ovr);
    expect(offenseOfSquad(noQb, 'seed').qb).toEqual(a);
  });

  it('builds the same game on both phones: each side’s rival is the other’s own', () => {
    const a = squadOf(ladder[2].squad);
    const b = squadOf(ladder[6].squad);
    const mine = teamsOf(SPORT, a, b, 'match-1');
    const theirs = teamsOf(SPORT, b, a, 'match-1');
    if (SPORT === 'nba') {
      expect(JSON.stringify(mine.rivalFive)).toBe(JSON.stringify(theirs.five));
      expect(JSON.stringify(mine.rivalBench)).toBe(JSON.stringify(theirs.bench));
      expect(JSON.stringify(mine.five)).toBe(JSON.stringify(theirs.rivalFive));
    } else {
      expect(JSON.stringify(mine.rivalOffense)).toBe(JSON.stringify(theirs.offense));
      expect(JSON.stringify(mine.rivalDefense)).toBe(JSON.stringify(theirs.defense));
      expect(JSON.stringify(mine.offense)).toBe(JSON.stringify(theirs.rivalOffense));
    }
  });
});

describe('Squad Battles', () => {
  it('climbs eight themed rungs near their targets, each tougher than the last', () => {
    expect(ladder.length).toBe(RUNGS);
    for (const r of ladder) {
      const sq = squadOf(r.squad);
      expect(startersComplete(SPORT, lineupOf(sq))).toBe(true);
      expect(ratingOf(SPORT, sq).ovr).toBe(r.ovr);
      expect(Math.abs(r.ovr - r.target)).toBeLessThanOrEqual(2);
      expect(r.title).toMatch(/^\d{4}s /);
      expect(shortName(r)).toMatch(/^’\d\ds \S+$/);
    }
    for (let i = 1; i < RUNGS; i++) {
      expect(ladder[i].ovr).toBeGreaterThan(ladder[i - 1].ovr);
      expect(ladder[i].skill).toBeGreaterThan(ladder[i - 1].skill);
    }
    // a different franchise and decade on every rung
    expect(new Set(ladder.map((r) => r.fr + r.decade)).size).toBe(RUNGS);
    expect(ladder.map((r) => r.pack)).toEqual(ladder.map((r) => RUNG_PACKS[r.i] ?? null));
  });

  it('holds its shape week after week', () => {
    for (let w = 1; w <= 12; w++) {
      const l = ladderFor(pool, '2027-W' + String(w).padStart(2, '0'));
      l.forEach((r, i) => {
        expect(Math.abs(r.ovr - r.target)).toBeLessThanOrEqual(2);
        if (i) expect(r.ovr).toBeGreaterThan(l[i - 1].ovr);
      });
    }
  });

  it('is the same all week, and new the next', () => {
    expect(JSON.stringify(ladderFor(pool, WEEK))).toBe(JSON.stringify(ladder));
    expect(weekLadder(pool, WEEK)).toBe(weekLadder(pool, WEEK));
    const next = ladderFor(pool, '2026-W45');
    expect(next.map((r) => r.title)).not.toEqual(ladder.map((r) => r.title));
  });

  it('steps in for a no-show with a squad at your level', () => {
    for (const t of [onScale(64, SPORT), onScale(80, SPORT), onScale(88, SPORT)]) {
      const r = aiOpponent(pool, t, 'x' + t);
      expect(r.i).toBe(-1);
      expect(r.pack).toBeNull();
      expect(Math.abs(r.ovr - t)).toBeLessThanOrEqual(2);
      expect(startersComplete(SPORT, lineupOf(squadOf(r.squad)))).toBe(true);
    }
  });

  it('starts each week at the bottom, keeping the best week', () => {
    expect(battlesThisWeek({ week: WEEK, cleared: 3, best: 5 }, WEEK)).toEqual({ week: WEEK, cleared: 3, best: 5 });
    expect(battlesThisWeek({ week: '2026-W43', cleared: 6, best: 6 }, WEEK)).toEqual({ week: WEEK, cleared: 0, best: 6 });
  });
});

describe('a finished match', () => {
  const withCards = (): UtState => ({
    ...freshUt(),
    owned: [
      { uid: 'a', cardId: 'x', level: 1, xp: 0, at: 1 },
      { uid: 'b', cardId: 'y', level: 1, xp: 90, at: 2 },
      { uid: 'c', cardId: 'z', level: 1, xp: 0, at: 3 },
    ],
    squad: { PG: 'a', SG: 'b' },
  });
  const base = { us: 20, them: 10, online: false, played: ['a', 'b'], week: WEEK, packId: 'p1', at: 5 };

  it('pays coins and XP for every card that played', () => {
    const s = settle(withCards(), { ...base, won: true, rung: null });
    expect(s.coins).toBe(COINS_WIN);
    expect(s.xp).toBe(XP_PER_GAME + XP_FOR_WIN);
    const o = Object.fromEntries(s.ut.owned.map((c) => [c.uid, c]));
    expect(o.a.xp).toBe(XP_PER_GAME + XP_FOR_WIN);
    expect(o.b.level).toBe(2);
    expect(o.c.xp).toBe(0);
    expect(s.ups).toEqual([{ uid: 'b', level: 2 }]);
    expect(s.ut.record).toEqual({ w: 1, l: 0, h2hW: 0, h2hL: 0 });
    const l = settle(withCards(), { ...base, won: false, online: true, rung: null });
    expect(l.coins).toBe(COINS_LOSS);
    expect(l.xp).toBe(XP_PER_GAME);
    expect(l.ut.record).toEqual({ w: 0, l: 0, h2hW: 0, h2hL: 1 });
  });

  it('climbs the ladder on a win at the next rung, with its pack the first time', () => {
    const ut = { ...withCards(), battles: { week: WEEK, cleared: 3, best: 3 } };
    const s = settle(ut, { ...base, won: true, rung: { i: 3, pack: 'silver' } });
    expect(s.climbed).toBe(true);
    expect(s.pack).toBe('silver');
    expect(s.ut.battles).toEqual({ week: WEEK, cleared: 4, best: 4 });
    expect(s.ut.packs).toEqual([{ id: 'p1', kind: 'silver', at: 5 }]);
    // again (a cleared rung), or lost: no climb, no pack
    for (const again of [settle(s.ut, { ...base, won: true, rung: { i: 3, pack: 'silver' } }), settle(ut, { ...base, won: false, rung: { i: 3, pack: 'silver' } })]) {
      expect(again.climbed).toBe(false);
      expect(again.pack).toBeNull();
    }
    // last week's progress is gone: rung 1 is next again
    const stale = { ...withCards(), battles: { week: '2026-W40', cleared: 7, best: 7 } };
    expect(settle(stale, { ...base, won: true, rung: { i: 3, pack: null } }).climbed).toBe(false);
    const fresh = settle(stale, { ...base, won: true, rung: { i: 0, pack: null } });
    expect(fresh.ut.battles).toEqual({ week: WEEK, cleared: 1, best: 7 });
  });

  it('breaks a tie with the better squad, then the coin', () => {
    expect(decide(14, 7, 70, 90, () => false)).toEqual({ won: true, tiebreak: false });
    expect(decide(7, 14, 90, 70, () => true)).toEqual({ won: false, tiebreak: false });
    expect(decide(10, 10, 81.2, 80.9, () => false)).toEqual({ won: true, tiebreak: true });
    expect(decide(10, 10, 80.9, 81.2, () => true)).toEqual({ won: false, tiebreak: true });
    expect(decide(10, 10, 80, 80, () => true)).toEqual({ won: true, tiebreak: true });
  });
});
