// Claude, 2026-11-01 (second gameplay pass): football's realistic variance sources: where a drive
// starts, flags, blown coverages, loose balls and the AI's fourth downs (docs/GAMEPLAY-RATINGS.md).
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { fourthDown } from './autopilot';
import { afterPlay, newGame, START, startSpot } from './drive';
import { lineUp } from './engine';
import type { Defense, FbPlayer, Flag, Offense, PlayEnd } from './types';

const KEYS = 'SPD ACC AGI STR AWR THP SAC MAC DAC TUP BTK TRK JKM SPM SFA CAR BCV CTH RTE CIT SPC REL RBK PBK IBL PMV FMV BSH TAK PUR PRC ZCV MCV PRS HIT KPW KAC'.split(' ');
const fb = (pos: string, id: string, o: Record<string, number> = {}): FbPlayer => ({
  id,
  name: id,
  tag: id,
  num: null,
  ht: 73,
  wt: 220,
  pos,
  ovr: 75,
  a: { ...Object.fromEntries(KEYS.map((k) => [k, 75])), SPD: 86, ACC: 86, AGI: 82, ...o },
  abil: []
});
const offense = (o: Record<string, number> = {}): Offense => ({
  qb: fb('QB', 'qb'),
  rb: fb('RB', 'rb', o),
  wr: [fb('WR', 'x', o), fb('WR', 'z', o), fb('WR', 'sl', o)],
  te: fb('TE', 'te'),
  ol: [0, 1, 2, 3, 4].map((i) => fb('OT', 'ol' + i)) as Offense['ol'],
  k: fb('K', 'k')
});
const defense = (o: Record<string, number> = {}): Defense => ({
  dl: [fb('DE', 'le'), fb('DT', 'ldt'), fb('DT', 'rdt'), fb('DE', 're')],
  lb: [fb('LB', 'w', o), fb('LB', 'm', o), fb('LB', 's', o)],
  cb: [fb('CB', 'cb1', o), fb('CB', 'cb2', o)],
  s: [fb('S', 'fs', o), fb('S', 'ss', o)]
});
const end = (kind: PlayEnd['kind'], y: number, flag?: Flag): PlayEnd => ({ kind, x: 26, y, gain: 0, text: '', caught: kind === 'tackle', secs: 4, flag });

describe('where a drive starts (the kickoff)', () => {
  it('is seeded, spread around the 25 with touchbacks and the odd big return', () => {
    const g = { seed: 'ko', off: offense(), def: defense() };
    const spots = Array.from({ length: 2000 }, (_, i) => startSpot({ ...g, seed: 'ko' + i }, i % 4));
    expect(startSpot(g, 2)).toBe(startSpot(g, 2));
    const tb = spots.filter((s) => s === START).length / spots.length;
    const mean = spots.reduce((a, s) => a + s, 0) / spots.length;
    expect(tb).toBeGreaterThan(0.4);
    expect(tb).toBeLessThan(0.55);
    expect(mean).toBeGreaterThan(25);
    expect(mean).toBeLessThan(30);
    expect(Math.min(...spots)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...spots)).toBeLessThanOrEqual(56);
    expect(spots.filter((s) => s >= 38).length / spots.length).toBeGreaterThan(0.05);
  });
  it('a fast returner against slow coverage starts a little farther up the field', () => {
    const avg = (o: Offense, d: Defense) => Array.from({ length: 1500 }, (_, i) => startSpot({ seed: 'r' + i, off: o, def: d }, 1)).reduce((a, s) => a + s, 0) / 1500;
    expect(avg(offense({ SPD: 97 }), defense({ SPD: 78 }))).toBeGreaterThan(avg(offense({ SPD: 80 }), defense({ SPD: 92 })) + 1);
  });
  it('every drive of a game starts from its own spot', () => {
    const g = newGame(offense(), defense(), 'spots');
    const first = g.ballOn;
    expect(first).toBe(startSpot(g, 0));
    afterPlay(g, end('int', 40));
    expect(g.ballOn).toBe(startSpot(g, 1));
  });
});

describe('flags', () => {
  const at = (ballOn: number, down = 1, toGo = 10) => {
    const g = newGame(offense(), defense(), 'flag');
    g.ballOn = ballOn;
    g.down = down;
    g.toGo = toGo;
    return g;
  };
  it('offensive holding wipes out a gain: ten yards back, the down again', () => {
    const g = at(40, 2, 6);
    const a = afterPlay(g, end('tackle', 52, { by: 'O', kind: 'holding', tag: 'LT' }));
    expect(a.flag?.kind).toBe('holding');
    expect(g.ballOn).toBe(30);
    expect(g.down).toBe(2);
    expect(g.toGo).toBe(16);
  });
  it('half the distance near your own goal; declined when the play was worse (a pick)', () => {
    const g = at(8);
    afterPlay(g, end('tackle', 12, { by: 'O', kind: 'holding', tag: 'LT' }));
    expect(g.ballOn).toBe(4);
    const h = at(40);
    const a = afterPlay(h, end('int', 55, { by: 'O', kind: 'holding', tag: 'LT' }));
    expect(a.driveOver).toBe('INT');
  });
  it('defensive holding is five yards and a first down; it takes a pick back', () => {
    const g = at(40, 3, 8);
    const a = afterPlay(g, end('int', 50, { by: 'D', kind: 'def-holding', tag: 'CB1' }));
    expect(a.driveOver).toBeNull();
    expect(a.firstDown).toBe(true);
    expect(g.ballOn).toBe(45);
    expect(g.down).toBe(1);
  });
  it('pass interference is a first down at the spot; declined when the play was better', () => {
    const g = at(40, 3, 8);
    afterPlay(g, end('incomplete', 0, { by: 'D', kind: 'dpi', tag: 'CB1', spot: 63 }));
    expect(g.ballOn).toBe(63);
    expect(g.down).toBe(1);
    const h = at(40, 1, 10);
    const a = afterPlay(h, end('tackle', 75, { by: 'D', kind: 'offside', tag: 'LE' }));
    expect(a.flag).toBeUndefined();
    expect(h.ballOn).toBe(75);
  });
  it('a flag never takes a touchdown away', () => {
    const g = at(80);
    const a = afterPlay(g, end('td', 100, { by: 'O', kind: 'holding', tag: 'LT' }));
    expect(a.points).toBe(7);
  });
});

describe('blown coverages', () => {
  const rate = (d: Defense, defIQ = 0) => {
    let n = 0;
    for (let i = 0; i < 4000; i++) if (lineUp(offense(), d, 'pass', 'verts', 'inside', 30, 26.6, rng(i + 1), defIQ).bust !== undefined) n++;
    return n / 4000;
  };
  it('happen on a few percent of passes, more for a green secondary, less for a smart one or a hard defense', () => {
    const avg = rate(defense());
    expect(avg).toBeGreaterThan(0.02);
    expect(avg).toBeLessThan(0.08);
    expect(rate(defense({ AWR: 55, PRC: 55 }))).toBeGreaterThan(rate(defense({ AWR: 95, PRC: 95 })) + 0.02);
    expect(rate(defense({ AWR: 95, PRC: 95 }))).toBeGreaterThan(0.01);
    expect(rate(defense(), 1)).toBeLessThan(avg);
  });
  it('never on a run (the run game has its own misreads)', () => {
    for (let i = 0; i < 200; i++) expect(lineUp(offense(), defense(), 'run', 'verts', 'inside', 30, 26.6, rng(i + 1)).bust).toBeUndefined();
  });
});

describe('the AI on fourth down', () => {
  it('kicks in range and otherwise goes for it (a punt is worth nothing in this format)', () => {
    const g = newGame(offense(), defense(), '4th');
    g.down = 4;
    g.toGo = 9;
    g.ballOn = 20;
    expect(fourthDown(g)).toBe('go');
    g.ballOn = 75;
    expect(fourthDown(g)).toBe('kick');
  });
});
