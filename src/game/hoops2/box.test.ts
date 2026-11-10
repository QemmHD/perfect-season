// The box score adds up (Claude 2026-11-10): per-player lines built from the engine's events agree
// with the game's own marks and score in seeded AI games (20 always, with made-up fives and benches
// so nothing has to load; NBA_BOX=1 for 200 with real Squad Battles squads), and a hand-built pass,
// catch and make credits exactly one assist.
import { getPool } from '../../ut/pool';
import { rng } from '../../engine/rng';
import { BoxTracker, type BoxSide } from './box';
import { newPossession, pass, pressShoot, releaseShoot, RIM, step } from './engine';
import { DT, env, playMatch, squadShown, synthSquad } from './harness';
import type { Mark } from './game';
import type { Hooper, Possession } from './types';

const GAMES = env.NBA_BOX ? 200 : 20;

const count = (marks: Mark[], ...m: Mark[]) => marks.filter((x) => m.includes(x)).length;

describe('box score', () => {
  it(`player lines add up to the marks and the score (${GAMES} games, both teams)`, async () => {
    const pool = env.NBA_BOX ? await getPool() : null;
    let mismatches = 0;
    const problems: string[] = [];
    for (let i = 0; i < GAMES; i++) {
      const A = pool ? squadShown(pool, 70 + (i % 5) * 5, 'boxA' + (i % 7)) : synthSquad('A' + i);
      const B = pool ? squadShown(pool, 70 + ((i + 3) % 5) * 5, 'boxB' + (i % 7)) : synthSquad('B' + i);
      const box = new BoxTracker();
      // the same facts counted straight off the events, independently of the tracker
      const seen: Record<BoxSide, { shots: number; ft: number; blocked: number; steals: number; misses: number }> = {
        us: { shots: 0, ft: 0, blocked: 0, steals: 0, misses: 0 },
        them: { shots: 0, ft: 0, blocked: 0, steals: 0, misses: 0 },
      };
      const each = (p: Possession, side: BoxSide) => {
        for (const e of p.events) {
          if (e === 'release' || e === 'release-green' || e.startsWith('finish:') || e.startsWith('blocked:')) seen[side].shots++;
          if (e.startsWith('ft:')) seen[side].ft++;
          if (e.startsWith('blocked:')) seen[side].blocked++;
          if (e === 'end:steal' || e === 'end:int') seen[side].steals++;
          if (e === 'end:miss') seen[side].misses++;
        }
      };
      const { us, them } = playMatch(A, B, 'box' + i, [0.45, 0.68, 0.88][i % 3], [-0.5, 0, 1][i % 3], { box, each });
      for (const [side, played] of [['us', us], ['them', them]] as const) {
        const other: BoxSide = side === 'us' ? 'them' : 'us';
        const t = box.team(side);
        const d = box.team(other);
        const marks = played.marks;
        const checks: [string, number, number][] = [
          ['points', t.pts, played.g.score],
          ['made field goals', t.fgm, count(marks, '2', '3', 'A')],
          ['made threes', t.tpm, count(marks, '3')],
          ['made and-ones', t.ftm, count(marks, 'A')],
          ['turnovers', t.tov + t.teamTov, count(marks, 'TO')],
          ['possessions', t.poss, marks.length],
          ['attempts', t.fga, seen[side].shots],
          ['free throws', t.fta, seen[side].ft],
          ['blocks by the defense', d.blk, seen[side].blocked],
          ['steals by the defense', d.stl, seen[side].steals],
          ['defensive rebounds', d.drb + d.teamReb, seen[side].misses],
        ];
        for (const [what, got, want] of checks)
          if (got !== want) {
            mismatches++;
            problems.push(`game ${i} ${side}: ${what} ${got} != ${want}`);
          }
        for (const l of box.lines(side))
          if (l.fgm > l.fga || l.tpm > l.tpa || l.tpa > l.fga || l.ftm > l.fta || l.pts !== 2 * l.fgm + l.tpm + l.ftm) {
            mismatches++;
            problems.push(`game ${i} ${side}: ${l.name} ${JSON.stringify(l)}`);
          }
      }
    }
    expect(problems.slice(0, 8)).toEqual([]);
    expect(mismatches).toBe(0);
  }, 300_000);

  const man = (id: string, extra: Partial<Hooper> = {}): Hooper => ({ id, name: 'Player ' + id, tag: id.toUpperCase(), num: 1, ht: 78, wt: 215, pos: 'SG', ovr: 80, spd: 75, acc: 75, hnd: 75, pas: 75, thr: 85, mid: 80, cls: 80, lay: 80, ft: 80, ddk: 60, sdk: 50, str: 70, vrt: 70, sta: 80, prd: 70, ind: 70, stl: 70, blk: 60, reb: 60, abil: [], ...extra });
  /** A possession with the defense frozen far away: a pass to an open shooter at the arc. */
  const setUp = (): Possession => {
    const ours = ['pg', 'sg', 'sf', 'pf', 'c'].map((s) => man(s));
    const theirs = ['d1', 'd2', 'd3', 'd4', 'd5'].map((s) => man(s));
    const p = newPossession(ours, theirs, [1, 1, 1, 1, 1], rng(7), 0);
    Object.assign(p.bodies[0], { cx: 22, cz: 0, vx: 0, vz: 0 });
    Object.assign(p.bodies[1], { cx: RIM.cx - 24.5, cz: 8, vx: 0, vz: 0 });
    for (const d of p.bodies) if (d.side === 'D') Object.assign(d, { cx: -4, cz: 22, stunUntil: 99 });
    return p;
  };
  /** Run until the catch, wait `hold` seconds, then release a jumper exactly on the green. */
  const passCatchShoot = (hold: number): { box: BoxTracker; p: Possession } => {
    const p = setUp();
    const box = new BoxTracker();
    box.begin(p, 'us');
    const look = () => {
      box.onStep(p);
      const caught = p.events.includes('catch');
      p.events.length = 0;
      return caught;
    };
    pass(p, 1);
    let caught = look();
    for (let k = 0; k < 120 && !caught; k++) {
      step(p, DT, null);
      caught = look();
    }
    expect(caught).toBe(true);
    for (let k = 0; k < Math.round(hold / DT); k++) {
      step(p, DT, null);
      look();
    }
    pressShoot(p);
    const m = p.meter!;
    while (p.t - m.t0 < m.top) {
      step(p, DT, null);
      look();
    }
    releaseShoot(p, p.t - m.t0 - m.top);
    look();
    for (let k = 0; k < 240 && !p.end; k++) {
      step(p, DT, null);
      look();
    }
    box.onEnd(p);
    return { box, p };
  };

  it('a pass, a catch and a make credit one assist to the passer', () => {
    const { box, p } = passCatchShoot(0.2);
    expect(p.lastShot?.greened).toBe(true);
    expect(p.end?.kind).toBe('make');
    const lines = box.lines('us');
    const by = (id: string) => lines.find((l) => l.id === id)!;
    expect(by('pg').ast).toBe(1);
    expect(lines.reduce((a, l) => a + l.ast, 0)).toBe(1);
    expect(by('sg')).toMatchObject({ pts: 3, fgm: 1, fga: 1, tpm: 1, tpa: 1, pure: 1, ast: 0 });
    expect(box.team('us')).toMatchObject({ pts: 3, ast: 1, poss: 1 });
  });

  it('holding it past the assist window is his own basket', () => {
    const { box, p } = passCatchShoot(2.7);
    expect(p.end?.kind).toBe('make');
    expect(box.team('us').ast).toBe(0);
    expect(box.lines('us').find((l) => l.id === 'sg')!.pts).toBe(3);
  });
});
