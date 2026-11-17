// Claude (studio overhaul nfl-4): Heat (C18, V2 §B.0.2) and the match grade (C22). Every gain, the
// 66 and 100 thresholds, three ON FIRE snaps (four with a Heat Check card), the reset after drive 2,
// the rival's bar from their ends alone; the same inputs give the same Heat; the grade rides on the
// finished Progress only and never reaches onProgress or the wire; FLAWLESS is a win with no
// turnovers.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { autoplay } from './autopilot';
import { afterPlay, fireSnapsFor, gradeLetter, gradeLevel, gradeOf, heatFromEnds, kick, newGame, onFire, PAR, punt, rivalDriveEnd, startPlay } from './drive';
import { addHeat, COLD, FIRE_UNITS, FULL, HEATING, heatValue, spendFire } from './shared-v2';
import { gradeResult, type Progress, wireProgress } from '../progress';
import { synthTeams } from './sim-kit';
import type { Defense, FbPlayer, Offense, PlayEnd } from './types';

const man = (pos: string, abil: string[] = []): FbPlayer => ({ id: pos + abil.join(), name: pos, tag: pos, num: null, ht: 74, wt: 220, pos, ovr: 75, a: {}, abil });
const off = (abil: string[] = []): Offense => ({ qb: man('QB'), rb: man('RB'), wr: [man('WR', abil), man('WR'), man('WR')], te: man('TE'), ol: [man('OT'), man('OG'), man('C'), man('OG'), man('OT')], k: man('K') });
const def: Defense = { dl: [man('DE'), man('DT'), man('DT'), man('DE')], lb: [man('LB'), man('LB'), man('LB')], cb: [man('CB'), man('CB')], s: [man('S'), man('S')] };
const end = (kind: PlayEnd['kind'], y: number, o: Partial<PlayEnd> = {}): PlayEnd => ({ kind, x: 26, y, gain: 0, text: '', caught: false, secs: 4, ...o });

describe('Heat, the pure maths', () => {
  it('values every NFL event as V2 does', () => {
    expect(heatValue('perfect', 'nfl')).toBe(12);
    expect(heatValue('score', 'nfl')).toBe(25);
    expect(heatValue('stop', 'nfl')).toBe(15);
    expect(heatValue('clean', 'nfl')).toBe(5);
    expect(heatValue('turnover', 'nfl')).toBe(-20);
    expect(heatValue('conceded', 'nfl')).toBe(-10);
    expect(heatValue('half', 'nfl')).toBe(0);
    expect(FIRE_UNITS.nfl).toBe(3);
  });

  it('crosses HEATING UP at 66, lights ON FIRE at 100, holds full while lit, and a loss puts it out', () => {
    let h = { ...COLD, pts: 54 };
    let r = addHeat(h, 'perfect', 'nfl');
    expect(r.h.pts).toBe(HEATING);
    expect(r.heating).toBe(true);
    expect(r.lit).toBe(false);
    r = addHeat({ ...COLD, pts: 88 }, 'perfect', 'nfl');
    expect(r.h).toEqual({ pts: FULL, fire: 3, best: FULL, lit: 1 });
    expect(r.lit).toBe(true);
    expect(r.heating).toBe(false);
    // capped at 100; gains while lit change nothing
    expect(addHeat(r.h, 'score', 'nfl').h).toEqual(r.h);
    // a turnover while lit: the fire's out and 20 come off
    h = addHeat(r.h, 'turnover', 'nfl').h;
    expect(h).toEqual({ pts: 80, fire: 0, best: FULL, lit: 1 });
    // never below 0, always whole numbers
    expect(addHeat(COLD, 'conceded', 'nfl').h.pts).toBe(0);
    for (const ev of ['perfect', 'score', 'stop', 'clean', 'turnover', 'conceded'] as const) expect(Number.isInteger(addHeat({ ...COLD, pts: 37 }, ev, 'nfl').h.pts)).toBe(true);
  });

  it('burns for three snaps (spendFire), then the bar empties for the next run at it; half empties it but keeps best and lit', () => {
    let h = addHeat({ ...COLD, pts: 90 }, 'score', 'nfl').h;
    expect(h.fire).toBe(3);
    h = spendFire(h);
    h = spendFire(h);
    expect(h).toEqual({ pts: FULL, fire: 1, best: FULL, lit: 1 });
    h = spendFire(h);
    expect(h).toEqual({ pts: 0, fire: 0, best: FULL, lit: 1 });
    expect(spendFire(h)).toEqual(h);
    const half = addHeat({ pts: 70, fire: 2, best: 90, lit: 2 }, 'half', 'nfl').h;
    expect(half).toEqual({ pts: 0, fire: 0, best: 90, lit: 2 });
  });
});

describe('Heat in the drive (drive.ts)', () => {
  it('counts each PERFECT +12, a touchdown +25, a turnover -20, and the grade counts with them', () => {
    const g = newGame(off(), def, 'heat', 4);
    afterPlay(g, end('tackle', g.ballOn + 3, { perfects: ['WR', 'RB'], chances: 3 }));
    expect(g.heat.pts).toBe(24);
    expect(g.perfects).toBe(2);
    expect(g.chances).toBe(3);
    expect(g.pf).toEqual({ WR: 1, RB: 1 });
    afterPlay(g, end('td', 100, { caught: true }));
    expect(g.heat.pts).toBe(49);
    afterPlay(g, end('int', 40));
    // (drive 2 just ended: the bar empties after it)
    expect(g.drive).toBe(2);
    expect(g.heat.pts).toBe(0);
    expect(g.heat.best).toBe(49);
    expect(g.turnovers).toBe(1);
    const g2 = newGame(off(), def, 'heat2', 4);
    afterPlay(g2, end('tackle', g2.ballOn + 2, { perfects: ['QB'] }));
    afterPlay(g2, end('fumble', 30));
    expect(g2.heat.pts).toBe(0);
    expect(g2.turnovers).toBe(1);
  });

  it('a clean first down (+5): a set of downs moved on with no sack in it', () => {
    const g = newGame(off(), def, 'clean', 4);
    // a first down on the ground, first play of the drive
    expect(afterPlay(g, end('tackle', g.ballOn + 11)).firstDown).toBe(true);
    expect(g.heat.pts).toBe(5);
    afterPlay(g, end('tackle', g.ballOn + 3, { caught: true }));
    expect(afterPlay(g, end('tackle', g.ballOn + 8)).firstDown).toBe(true);
    expect(g.heat.pts).toBe(10);
    // a sack in the series: its first down isn't clean, and the next series starts clean again
    afterPlay(g, end('sack', g.ballOn - 5));
    expect(afterPlay(g, end('tackle', g.ballOn + 16)).firstDown).toBe(true);
    expect(g.heat.pts).toBe(10);
    expect(afterPlay(g, end('tackle', g.ballOn + 11)).firstDown).toBe(true);
    expect(g.heat.pts).toBe(15);
    // a new drive after a sacked series that never moved on starts clean
    const s = newGame(off(), def, 'sacked', 4);
    afterPlay(s, end('sack', s.ballOn - 5));
    punt(s);
    expect(afterPlay(s, end('tackle', s.ballOn + 11)).firstDown).toBe(true);
    expect(s.heat.pts).toBe(5);
  });

  it('ON FIRE lights at 100, says so, burns 3 snaps on the plays it lines up, and 4 with a Heat Check card', () => {
    for (const [abil, snaps] of [[[], 3], [['heat-check'], 4]] as const) {
      const g = newGame(off([...abil]), def, 'fire', 4);
      expect(fireSnapsFor(g)).toBe(snaps);
      g.heat = { ...g.heat, pts: 91 };
      const a = afterPlay(g, end('tackle', g.ballOn + 2, { perfects: ['WR'] }));
      expect(a.fire).toBe('lit');
      expect(onFire(g)).toBe(true);
      expect(g.heat.lit).toBe(1);
      for (let i = 0; i < snaps; i++) {
        expect(startPlay(g, 'pass').fire).toBe(true);
        const r = afterPlay(g, end('tackle', g.ballOn + 2));
        expect(r.fire).toBe(i === snaps - 1 ? 'out' : null);
      }
      expect(onFire(g)).toBe(false);
      expect(startPlay(g, 'pass').fire).toBe(false);
      expect(g.heat.pts).toBe(0);
    }
  });

  it('HEATING UP is reported once, when the bar crosses 66', () => {
    const g = newGame(off(), def, 'warm', 4);
    g.heat = { ...g.heat, pts: 60 };
    expect(afterPlay(g, end('tackle', g.ballOn + 2, { perfects: ['WR'] })).heating).toBe(true);
    expect(afterPlay(g, end('tackle', g.ballOn + 2, { perfects: ['WR'] })).heating).toBe(false);
  });

  it('empties after drive 2, whichever way drive 2 ends (a kick, a punt), and not in a one-drive drill', () => {
    const g = newGame(off(), def, 'half', 4);
    afterPlay(g, end('td', 100));
    expect(g.heat.pts).toBe(25);
    g.down = 4;
    kick(g, 1);
    expect(g.drive).toBe(2);
    expect(g.heat.pts).toBe(0);
    expect(g.heat.best).toBe(25);
    const h = newGame(off(), def, 'half2', 4);
    punt(h);
    h.heat = { ...h.heat, pts: 50 };
    punt(h);
    expect(h.heat.pts).toBe(0);
    const d = newGame(off(), def, 'drill', 1);
    d.heat = { ...d.heat, pts: 50 };
    afterPlay(d, end('tackle', d.ballOn + 2));
    expect(d.heat.pts).toBe(50);
  });

  it('solo: points the rival scores cost 10, a stop or a takeaway by your defense earns 15', () => {
    const g = newGame(off(), def, 'rival', 4);
    g.heat = { ...g.heat, pts: 40 };
    rivalDriveEnd(g, 'TD');
    expect(g.heat.pts).toBe(30);
    rivalDriveEnd(g, 'FG');
    expect(g.heat.pts).toBe(20);
    rivalDriveEnd(g, 'INT');
    expect(g.heat.pts).toBe(35);
    rivalDriveEnd(g, 'FUM');
    expect(g.heat.pts).toBe(50);
    rivalDriveEnd(g, 'PUNT');
    expect(g.heat.pts).toBe(65);
    rivalDriveEnd(g, 'DOWNS');
    rivalDriveEnd(g, 'MISS');
    expect(g.heat.pts).toBe(95);
    // the clock running out on them is neither
    rivalDriveEnd(g, 'TIME');
    expect(g.heat.pts).toBe(95);
    // and a stop that fills the bar lights ON FIRE for your next snaps
    expect(rivalDriveEnd(g, 'SAF').lit).toBe(true);
    expect(onFire(g)).toBe(true);
  });

  it("the rival's bar comes from their wire ends alone: TD +25, a turnover -20, empty after their drive 2", () => {
    expect(heatFromEnds([])).toEqual(COLD);
    expect(heatFromEnds(['TD']).pts).toBe(25);
    expect(heatFromEnds(['TD', 'INT']).pts).toBe(0);
    expect(heatFromEnds(['TD', 'TD', 'TD']).pts).toBe(25);
    expect(heatFromEnds(['TD', 'TD', 'TD']).best).toBe(50);
    expect(heatFromEnds(['FG', 'PUNT', 'TD', 'TD']).pts).toBe(50);
    expect(heatFromEnds(['TD', 'TD', 'TD', 'TD', 'TD']).pts).toBe(75);
    // the same ends, the same bar
    expect(heatFromEnds(['TD', 'FUM', 'TD'])).toEqual(heatFromEnds(['TD', 'FUM', 'TD']));
  });

  it('identical inputs give identical Heat: two seeded whole games, the same bar and counts', () => {
    const run = () => {
      const t = synthTeams(0.7, 'same');
      const g = newGame(t.off, t.def, 'same-heat', 4);
      autoplay(g, 0.68, 'same-heat');
      return { heat: g.heat, perfects: g.perfects, chances: g.chances, turnovers: g.turnovers, pf: g.pf, ends: g.ends };
    };
    const a = run();
    expect(run()).toEqual(a);
    // (the AI's own moves meet the ring too: some games have chances)
    let chances = 0;
    for (let i = 0; i < 12; i++) {
      const t = synthTeams(0.7, 'c' + i);
      const g = newGame(t.off, t.def, 'chances:' + i, 4);
      autoplay(g, 0.68, 'chances:' + i);
      chances += g.chances;
    }
    expect(chances).toBeGreaterThan(0);
  }, 60_000);
});

describe('the match grade (C22)', () => {
  it('letters points a drive against par for the difficulty', () => {
    expect(gradeLevel(-0.5)).toBe('rookie');
    expect(gradeLevel(0)).toBe('pro');
    expect(gradeLevel(1)).toBe('legend');
    expect(gradeLetter(PAR.pro + 1.5, PAR.pro)).toBe('S');
    expect(gradeLetter(PAR.pro + 0.5, PAR.pro)).toBe('A');
    expect(gradeLetter(PAR.pro - 0.5, PAR.pro)).toBe('B');
    expect(gradeLetter(PAR.pro - 0.51, PAR.pro)).toBe('C');
    const g = newGame(off(), def, 'grade', 4);
    g.score = 17;
    g.ends = ['TD', 'TD', 'FG', 'PUNT'];
    g.perfects = 4;
    g.chances = 9;
    g.heat = { pts: 0, fire: 0, best: 88, lit: 1 };
    const gr = gradeOf(g, 'pro', true);
    expect(gr).toEqual({ letter: 'A', perfects: 4, chances: 9, heatBest: 88, lit: 1, flawless: true, turnovers: 0 });
    // deterministic
    expect(gradeOf(g, 'pro', true)).toEqual(gr);
  });

  it('FLAWLESS iff a win with no turnovers', () => {
    const grade = { letter: 'B' as const, perfects: 0, chances: 0, heatBest: 0, lit: 0, flawless: false, turnovers: 0 };
    const us = (score: number, turnovers: number): Progress => ({ score, drive: 4, done: true, ends: [], grade: { ...grade, turnovers } });
    expect(gradeResult(us(14, 0), { score: 7 }).grade?.flawless).toBe(true);
    expect(gradeResult(us(14, 1), { score: 7 }).grade?.flawless).toBe(false);
    expect(gradeResult(us(7, 0), { score: 7 }).grade?.flawless).toBe(false);
    expect(gradeResult(us(7, 0), { score: 14 }).grade?.flawless).toBe(false);
    // a Progress without a grade (another sport, a sim) passes through untouched
    const plain: Progress = { score: 3, drive: 4, done: true, ends: [] };
    expect(gradeResult(plain, { score: 0 })).toBe(plain);
  });

  it('never reaches the wire, and never rides an onProgress', () => {
    const p: Progress = { score: 7, drive: 4, done: true, ends: ['TD'], plays: 9, grade: { letter: 'S', perfects: 1, chances: 1, heatBest: 30, lit: 0, flawless: false, turnovers: 0 } };
    const w = wireProgress(p);
    expect(w).toEqual({ score: 7, drive: 4, done: true, ends: ['TD'], plays: 9 });
    expect('grade' in w).toBe(false);
    expect(wireProgress(w)).toBe(w);
    // the screen: every onProgress sends progress(g), which has no grade; only onDone adds it
    const src = Object.values(import.meta.glob<string>('./Football2.tsx', { query: '?raw', import: 'default', eager: true }))[0];
    const progressFn = src.match(/const progress = \(g: Game\): Progress => \(([^;]*)\);/);
    expect(progressFn).not.toBeNull();
    expect(progressFn![1]).not.toMatch(/grade/);
    const calls = [...src.matchAll(/onProgress\(([^)]*\)?)\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).toMatch(/^progress\((g|game)\)$/);
    expect(src).toMatch(/onDone\(\{ \.\.\.progress\(g\), grade: gradeOf\(/);
    // and Arcade sends the wire copy
    const arcade = Object.values(import.meta.glob<string>('../Arcade.tsx', { query: '?raw', import: 'default', eager: true }))[0];
    expect(arcade).toMatch(/onProgress\(wireProgress\(p\)\)/);
  });
});
