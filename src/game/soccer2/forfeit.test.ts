// The online forfeit, soccer's side (Claude 2026-11-16, studio overhaul soccer-2; the nba/nfl contract,
// plan §5.3): 'FF' is a forfeited attack worth nothing, padded up to the match's total; only an
// explicit 'FF' says a side forfeited; and nothing local (the forfeit flag, a box score, a grade) goes
// on the wire.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { awarded, canForfeit, forfeitedBy, settleInputs, wireOf, type Progress } from '../progress';
import { END_TEXT, FORFEIT, forfeitBy, forfeitEnds, newMatch, totalOf } from './match';
import { squadFor } from './squads.test-util';

const RAW = import.meta.glob<string>(['../Arcade.tsx', '../../ut/Match.tsx', '../../net/match.ts', '../../App.tsx', './Soccer2.tsx'], { query: '?raw', import: 'default', eager: true });
const read = (f: string) => RAW[{ 'src/game/Arcade.tsx': '../Arcade.tsx', 'src/ut/Match.tsx': '../../ut/Match.tsx', 'src/net/match.ts': '../../net/match.ts', 'src/App.tsx': '../../App.tsx', 'src/game/soccer2/Soccer2.tsx': './Soccer2.tsx' }[f]!];
const pr = (score: number, ends: string[], done = true): Progress => ({ score, drive: ends.length, done, ends });

describe("'FF', the forfeited attack", () => {
  it('pads what was played up to the total (7: six and one in stoppage time), and never past it', () => {
    const total = totalOf(newMatch(squadFor('a', 75), squadFor('b', 75), 'ff'));
    expect(total).toBe(7);
    expect(forfeitEnds(['G', 'S'], total)).toEqual(['G', 'S', 'FF', 'FF', 'FF', 'FF', 'FF']);
    expect(forfeitEnds([], total)).toEqual(Array(7).fill('FF'));
    expect(forfeitEnds(['G', 'W', 'L', 'O', 'T', 'B', 'S', 'G'], total)).toHaveLength(7);
    expect(END_TEXT.FF).toBe('FORFEIT');
    expect(FORFEIT).toBe('FF');
  });
  it('is worth 0 on the scoreboard: the soccer POINTS in Arcade and the ut match screen count it as nothing', () => {
    // Arcade's soccer map (the Arcade must not import the lazy soccer chunk, so its map is checked as written)
    const arcade = read('src/game/Arcade.tsx');
    const soccer = /soccer:\s*\{([^}]*)\}/.exec(arcade.slice(arcade.indexOf('const POINTS')))![1];
    const pts = Object.fromEntries([...soccer.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(pts.FF).toBe(0);
    expect(pts.G).toBe(1);
    const score = (ends: string[]) => ends.reduce((a, e) => a + (pts[e] ?? 0), 0);
    expect(score(forfeitEnds(['G', 'S', 'G'], 7))).toBe(2);
    // the ut match screen labels it
    expect(read('src/ut/Match.tsx')).toMatch(/T: '·',\s*FF: 'FF',/);
  });
  it('a forfeit is never inferred from a missing field: only an FF end says so', () => {
    expect(forfeitBy(['G', 'S'])).toBe(false);
    expect(forfeitBy([])).toBe(false);
    expect(forfeitBy(forfeitEnds(['G'], 7))).toBe(true);
  });
  it('the wire carries the five shared fields only: no forfeit flag, no box, no grade', () => {
    const p = { score: 1, drive: 7, done: true, ends: forfeitEnds(['G'], 7), plays: 3, forfeit: true, box: [{ id: 'x' }], grade: { letter: 'S' } } as Progress & { box: unknown; grade: unknown };
    const w = wireOf(p);
    expect(Object.keys(w).sort()).toEqual(['done', 'drive', 'ends', 'plays', 'score']);
    expect(JSON.parse(JSON.stringify(w))).toEqual({ score: 1, drive: 7, done: true, ends: ['G', 'FF', 'FF', 'FF', 'FF', 'FF', 'FF'], plays: 3 });
    // and it's a copy: a later push to the match's ends can't change what was sent
    p.ends.push('G');
    expect(w.ends).toHaveLength(7);
  });
  it("the wire's own parser keeps 'FF' (two letters, inside its 8-letter limit), so the other phone sees the forfeit", () => {
    const net = read('src/net/match.ts');
    expect(net).toMatch(/e\.length <= 8/);
    expect('FF'.length).toBeLessThanOrEqual(8);
  });
});

describe('a forfeit decides the match (soccer-2 review fix)', () => {
  it('the side that forfeits loses even when it leads: 2-0 up after three attacks, it forfeits and loses 0-3', () => {
    const leader = pr(2, forfeitEnds(['G', 'G', 'S'], 7));
    const other = pr(0, ['S', 'W', 'B']);
    // the forfeiter's phone
    const [u, t] = awarded(leader, other, 'us');
    expect([u.score, t.score]).toEqual([0, 3]);
    expect(u.score < t.score).toBe(true);
    // the other phone: the same winner
    const [u2, t2] = awarded(other, leader, 'them');
    expect([u2.score, t2.score]).toEqual([3, 0]);
    // a level forfeit is not a coin flip
    const [u3, t3] = awarded(pr(1, forfeitEnds(['G'], 7)), pr(1, ['G']), 'us');
    expect(u3.score).toBeLessThan(t3.score);
    // already worse than 3-0 for the side that left: the score as played stands
    const [u4, t4] = awarded(pr(0, forfeitEnds(['S'], 7)), pr(4, ['G', 'G', 'G', 'G']), 'us');
    expect([u4.score, t4.score]).toEqual([0, 4]);
    // what was played stays on the record, with FORFEIT for the rest
    expect(u.ends).toEqual(['G', 'G', 'S', 'FF', 'FF', 'FF', 'FF']);
  });
  it('is refused once every attack is in (an agreed shootout): nothing is left to pad, so the other phone could never see it', () => {
    expect(canForfeit(pr(1, ['G', 'S', 'W', 'B', 'L', 'O', 'T']), 7)).toBe(false);
    expect(canForfeit({ ...pr(1, ['G', 'S', 'W', 'B', 'L', 'O', 'T']), done: false }, 7)).toBe(false);
    expect(canForfeit(pr(0, ['S', 'W'], true), 7)).toBe(false);
    expect(canForfeit(pr(0, ['S', 'W'], false), 7)).toBe(true);
    expect(canForfeit(null, 7)).toBe(true);
    // Arcade refuses through it; Soccer2 offers QUIT/FORFEIT only while attacks are left, and no penalties after a forfeit
    expect(read('src/game/Arcade.tsx')).toMatch(/!canForfeit\(p, TOTAL\)\) return false;/);
    const sc = read('src/game/soccer2/Soccer2.tsx');
    expect(sc).toMatch(/const canLeave = !match\.over && !soRef\.current && !left\.current;/);
    expect(sc).toMatch(/allowShootout && !left\.current && r && r\.done && !r\.forfeit/);
    expect(sc).toMatch(/!allowShootout \|\| left\.current\) return;/);
  });
  it('both hosts read it: ut decides on the forfeit and settles a solo quit as a loss; the draft does the same', () => {
    const ut = read('src/ut/Match.tsx');
    expect(ut).toMatch(/onFinish=\{\(us, them, how, _took, pens, ff\) => finish\(us, them, how, pens, ff\)\}/);
    expect(ut).toMatch(/onQuit=\{\(us, them\) => finish\(us, them, 'played', undefined, 'us', true\)\}/);
    expect(ut).toMatch(/const d = ff\s*\? \{ won: ff === 'them', tiebreak: false \}/);
    const app = read('src/App.tsx');
    expect(app).toMatch(/onFinish=\{\(us, them, how, took, pens, ff\) =>/);
    expect(app).toMatch(/pens, forfeit: ff \}\)/);
    expect(app).toMatch(/onQuit=\{\(us, them\) => finish\(r, playSeason/);
    expect(app).toMatch(/arcade\.forfeit \? arcade\.forfeit === 'them'/);
  });
});

// soccer-2 re-review: Arcade settles on what this render knows, never on the forfeit state an effect
// sets a commit later (the phone that finished first and waits used to settle a forfeit on raw scores)
describe('settleInputs: what Arcade settles on, in the same render', () => {
  const online = { online: true, watchFF: true, soccer: true, forfeit: null } as const;
  it('receiver already done, the rival forfeits while leading 2-0: a 3-0 win, in the very render the forfeit arrives', () => {
    const mine = pr(1, ['G', 'S', 'W', 'B', 'L', 'O', 'T']);
    // before: the rival is still playing, nothing settles
    const waiting = settleInputs({ ...online, mine, rivalLive: pr(2, ['G', 'G', 'S'], false) });
    expect(waiting.final).toBeNull();
    expect(waiting.ff).toBeNull();
    // the forfeiter's last Progress lands; the forfeit state is still null in this render
    const rivalLive = pr(2, forfeitEnds(['G', 'G', 'S'], 7));
    expect(forfeitedBy(rivalLive)).toBe(true);
    const s = settleInputs({ ...online, mine, rivalLive });
    expect(s.ff).toBe('them');
    expect(s.level).toBe(false);
    expect(s.final!.map((p) => p.score)).toEqual([3, 0]);
    // and with the state caught up a commit later, the same answer
    expect(settleInputs({ ...online, mine, rivalLive, forfeit: 'them' }).final!.map((p) => p.score)).toEqual([3, 0]);
  });
  it("the forfeiter's mirror: its own padded record says it, and it loses 0-3 whatever it led by", () => {
    const mine: Progress = { ...pr(2, forfeitEnds(['G', 'G', 'S'], 7)), forfeit: true };
    // the rival is still mid-match: this phone settles at once on what it has heard of them
    const s = settleInputs({ ...online, mine, rivalLive: pr(0, ['S', 'W', 'B'], false) });
    expect(s.ff).toBe('us');
    expect(s.final!.map((p) => p.score)).toEqual([0, 3]);
    // nothing heard from them yet
    expect(settleInputs({ ...online, mine, rivalLive: null }).final!.map((p) => p.score)).toEqual([0, 3]);
  });
  it('the receiver still mid-match settles on what it played, as a 3-0 win', () => {
    const s = settleInputs({ ...online, mine: pr(0, ['S', 'W'], false), rivalLive: pr(1, forfeitEnds(['G'], 7)) });
    expect(s.ff).toBe('them');
    expect(s.final!.map((p) => p.score)).toEqual([3, 0]);
  });
  it('a level forfeit never waits for penalties; a level match without one does', () => {
    const lvl = settleInputs({ ...online, mine: pr(1, ['G', 'S', 'W', 'B', 'L', 'O', 'T']), rivalLive: pr(1, forfeitEnds(['G'], 7)) });
    expect(lvl.level).toBe(false);
    expect(lvl.final!.map((p) => p.score)).toEqual([3, 0]);
    const ends = ['G', 'S', 'W', 'B', 'L', 'O', 'T'];
    const plain = settleInputs({ ...online, mine: pr(1, ends), rivalLive: pr(1, ends) });
    expect(plain.level).toBe(true);
    expect(plain.final).toBeNull();
    expect(settleInputs({ ...online, mine: pr(1, ends), rivalLive: pr(1, ends), pens: { won: true } }).final!.map((p) => p.score)).toEqual([1, 1]);
  });
  it("an 'FF' is read only where it is watched (soccer online), and a normal finish settles on the score", () => {
    const rivalLive = pr(2, forfeitEnds(['G', 'G'], 7));
    expect(settleInputs({ ...online, watchFF: false, mine: pr(1, ['G']), rivalLive }).ff).toBeNull();
    const done = settleInputs({ ...online, mine: pr(2, ['G', 'G', 'S', 'W', 'B', 'L', 'O']), rivalLive: pr(1, ['G', 'S', 'W', 'B', 'L', 'O', 'T']) });
    expect(done.ff).toBeNull();
    expect(done.final!.map((p) => p.score)).toEqual([2, 1]);
    // solo: the AI's match is the other side
    const solo = settleInputs({ online: false, watchFF: false, soccer: true, forfeit: null, mine: pr(1, ['G', 'S', 'W', 'B', 'L', 'O', 'T']), rivalLive: null, ai: pr(0, ['S', 'S', 'W', 'B', 'L', 'O', 'T']) });
    expect(solo.final!.map((p) => p.score)).toEqual([1, 0]);
  });
  it('Arcade reads it in the render and passes the derived side, not the state', () => {
    const arcade = read('src/game/Arcade.tsx');
    expect(arcade).toMatch(/const \{ ff, us, them, level, final \} = settleInputs\(/);
    expect(arcade).toMatch(/ff \?\? undefined\), hold \? 0 : level \? 2600 : 1600\);\n  \}, \[us, them, pens, ff\]\);/);
    expect(arcade).not.toMatch(/forfeit \? awarded\(us, them, forfeit\)/);
  });
});
