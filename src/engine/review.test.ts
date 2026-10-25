// The draft report: grades and the best team from the same spins (npm test runs both sports).
import { autoDraft } from './autodraft';
import { CELLS } from './data';
import { draftReducer, eligibleSlots, newDraft, whyUnavailable } from './draft';
import { bestFromCells, dailyPar, draftLetter, gradeOf, reviewDraft } from './review';
import { rateTeam } from './rating';
import { NFL } from './sport';
import { SLOTS } from './types';

describe('draft report', () => {
  it('grades a pick by how far it fell short of the best one', () => {
    expect(gradeOf(0)).toBe('best');
    expect(gradeOf(1.5)).toBe('great');
    expect(gradeOf(3)).toBe('good');
    expect(gradeOf(6)).toBe('reach');
    expect(gradeOf(20)).toBe('miss');
    expect(draftLetter(100)).toBe('A+');
    expect(draftLetter(50)).toBe('F');
  });
  it('reviews every pick, and the best team is at least as good as yours', () => {
    for (let i = 0; i < 60; i++) {
      const s = autoDraft(i % 2 ? 'best' : 'random', 500 + i, 'classic');
      const r = reviewDraft(s.log, s.lineup);
      expect(r.picks.length).toBe(SLOTS.length);
      expect(r.best.rating.rating).toBeGreaterThanOrEqual(r.yours.rating - 1e-9);
      expect(r.winsLeft).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(100);
      for (const p of r.picks) expect(p.bestGain).toBeGreaterThanOrEqual(p.gain - 1e-9);
      // the best team uses one player from each team you landed
      const cells = SLOTS.map((k) => s.lineup[k]!.cellId).sort();
      expect(SLOTS.map((k) => r.best.lineup[k]?.cellId).filter(Boolean).sort()).toEqual(cells);
      // and every player plays a spot he played
      for (const k of SLOTS) if (r.best.lineup[k]) expect(r.best.lineup[k]!.pos).toContain(k);
    }
  });
  it("takes the best available every round and still sees what hindsight would change", () => {
    const s = autoDraft('best', 77, 'classic');
    const r = reviewDraft(s.log, s.lineup);
    expect(r.picks.filter((p) => p.grade === 'best').length).toBeGreaterThanOrEqual(SLOTS.length - 2);
  });
  it('sets the same Daily par for everyone', () => {
    const a = dailyPar('2026-10-25');
    const b = dailyPar('2026-10-25');
    expect(a.rating.rating).toBe(b.rating.rating);
    expect(a.wins).toBeGreaterThan(0);
    expect(bestFromCells([]).rating.rating).toBe(rateTeam([]).rating);
  });
  it('never suggests a pick the draft would refuse', () => {
    // a Trade armed while holding a player whose far better team-decade just came up: in
    // basketball he can't be held twice, so the review mustn't hold him up as the better pick
    let found: { a: (typeof CELLS)[number]; b: (typeof CELLS)[number]; pid: string; gap: number } | null = null;
    for (const a of CELLS)
      for (const p of a.players)
        for (const b of CELLS) {
          const q = b.id !== a.id && b.players.find((x) => x.pid === p.pid);
          if (q && q.val - p.val > (found?.gap ?? 12)) found = { a, b, pid: p.pid, gap: q.val - p.val };
        }
    expect(found).not.toBeNull();
    const { a, b, pid } = found!;
    const p = a.players.find((x) => x.pid === pid)!;
    let s = newDraft('classic', 'pro', null);
    s = draftReducer(s, { type: 'land', cellId: a.id, ptr: 0 });
    s = draftReducer(s, { type: 'place', playerId: p.id, slot: p.pos[0] });
    s = draftReducer(s, { type: 'endCell' });
    s = draftReducer(s, { type: 'land', cellId: b.id, ptr: 0 });
    s = draftReducer(s, { type: 'arm', booster: 'trade' });
    const q = b.players.find((x) => x.pid === pid)!;
    expect(whyUnavailable(s, q) === null).toBe(NFL);
    const other = b.players.find((x) => x.pid !== pid && whyUnavailable(s, x) === null && eligibleSlots(s, x).length)!;
    s = draftReducer(s, { type: 'place', playerId: other.id, slot: eligibleSlots(s, other)[0] });
    const best = reviewDraft(s.log, s.lineup).picks[1].best;
    if (!NFL) expect(best?.pid).not.toBe(pid);
  });
});
