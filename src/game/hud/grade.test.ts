/// <reference types="vite/client" />
// The match grade (plan §3.14, §4.8): the letters, FLAWLESS, and the grade and box staying on this
// phone: on Progress for the host, never in what goes to the other phone.
import { GRADE_AT, GRADE_PAR, gradeLetter, makeGrade, parFor, settleGrade, wireProgress } from './grade';
import type { Progress } from '../progress';

const RAW = import.meta.glob<string>(['../Arcade.tsx', '../../net/match.ts', './grade.ts'], { query: '?raw', import: 'default', eager: true });

describe('match grade', () => {
  it('S at 1.25 × par, A at 1.10 ×, B at 0.90 ×, otherwise C', () => {
    const par = GRADE_PAR.pro;
    expect(gradeLetter(GRADE_AT.S * par, par)).toBe('S');
    expect(gradeLetter(GRADE_AT.S * par - 0.001, par)).toBe('A');
    expect(gradeLetter(GRADE_AT.A * par, par)).toBe('A');
    expect(gradeLetter(GRADE_AT.A * par - 0.001, par)).toBe('B');
    expect(gradeLetter(GRADE_AT.B * par, par)).toBe('B');
    expect(gradeLetter(GRADE_AT.B * par - 0.001, par)).toBe('C');
    expect(gradeLetter(0, par)).toBe('C');
  });

  it('the par by rung: Rookie 1.20, Pro 1.10, All-Star 1.05, Legend 0.97, online 1.10', () => {
    expect(parFor(-0.5, false)).toBe(1.2);
    expect(parFor(0, false)).toBe(1.1);
    expect(parFor(0.5, false)).toBe(1.05);
    expect(parFor(1, false)).toBe(0.97);
    expect(parFor(1, true)).toBe(1.1);
  });

  it('FLAWLESS is a win with no turnovers: provisional at the whistle, settled by the result', () => {
    const g = makeGrade({ points: 21, units: 16, par: 1.1, turnovers: 0, perfects: 5, moments: 9, bestHeat: 100, fires: 1 });
    expect(g).toMatchObject({ v: 1, letter: 'A', flawless: true, perfects: 5, moments: 9, bestHeat: 100, fires: 1, ppu: 1.313, par: 1.1 });
    expect(makeGrade({ points: 22, units: 16, par: 1.1, turnovers: 0, perfects: 0, moments: 0, bestHeat: 0, fires: 0 }).letter).toBe('S');
    const p: Progress = { score: 21, drive: 16, done: true, ends: [], grade: g };
    expect(settleGrade(p, true).grade?.flawless).toBe(true);
    expect(settleGrade(p, false).grade?.flawless).toBe(false);
    const sloppy = makeGrade({ points: 22, units: 16, par: 1.1, turnovers: 1, perfects: 0, moments: 0, bestHeat: 0, fires: 0 });
    expect(settleGrade({ ...p, grade: sloppy }, true).grade?.flawless).toBe(false);
    expect(makeGrade({ points: 0, units: 0, par: 1.1, turnovers: 0, perfects: 0, moments: 0, bestHeat: 0, fires: 0 }).ppu).toBe(0);
  });

  it('Progress.grade reaches the host; the wire carries neither the grade nor the box', () => {
    const g = makeGrade({ points: 20, units: 16, par: 1.1, turnovers: 2, perfects: 3, moments: 7, bestHeat: 70, fires: 0 });
    const p: Progress = { score: 20, drive: 16, done: true, ends: ['2'], plays: 16, grade: g, box: { us: [{ id: 'a', pts: 20 }], them: [], pog: 'A' } };
    // the host path: settleGrade keeps everything else as it was
    const host = settleGrade(p, true);
    expect(host.grade).toEqual(g);
    expect(host.box).toEqual(p.box);
    const wire = wireProgress(p);
    expect(wire).toEqual({ score: 20, drive: 16, done: true, ends: ['2'], plays: 16 });
    expect(JSON.stringify(wire)).not.toMatch(/grade|box|perfects/);
    // a progress without them goes as it is
    const plain: Progress = { score: 1, drive: 1, done: false, ends: [] };
    expect(wireProgress(plain)).toBe(plain);
  });

  it('the host sends wireProgress, and the wire reader (net/match.ts arcadeOf) builds only the five known fields', () => {
    expect(RAW['../Arcade.tsx']).toMatch(/onProgress\(wireProgress\(p\)\)/);
    expect(RAW['../Arcade.tsx']).toMatch(/settleGrade\(us, won\)/);
    const src = RAW['../../net/match.ts'];
    const body = src.slice(src.indexOf('function arcadeOf'), src.indexOf('\n}', src.indexOf('function arcadeOf')));
    expect(body).toMatch(/return \{ score, drive, done: a\.done === true, ends, plays: /);
    expect(body).not.toMatch(/grade|box/);
  });

  it('grade.ts stays dependency-free (it lands in the UT chunk)', () => {
    expect(RAW['./grade.ts']).not.toMatch(/^import(?! type)/m);
  });
});
