// Claude, 2026-11-01: the juice is render only. A seeded game comes out exactly the same with
// hit-stop, shake and particles running as without them (both sports), and the particle pool
// stays bounded.
import { describe, expect, it } from 'vitest';
import { decide as nbaDecide, pilot as nbaPilot } from './hoops2/autopilot';
import { step as nbaStep } from './hoops2/engine';
import { afterPossession, newHoopsGame, startPossession } from './hoops2/game';
import type { Hooper } from './hoops2/types';
import { decide as nflDecide, fourthDown, chooseCall, pilot as nflPilot } from './football2/autopilot';
import { afterPlay, kick, newGame, punt, startPlay } from './football2/drive';
import { snap, step as nflStep } from './football2/engine';
import type { Defense, FbPlayer, Offense } from './football2/types';
import { HITSTOP, Juice } from './juice';

const DT = 1 / 60;
const SP = ['PG', 'SG', 'SF', 'PF', 'C'];
const hooper = (pos: string, r: number): Hooper => ({ id: pos + r, name: pos, tag: pos, num: null, ht: 78, wt: 220, pos, ovr: r, spd: r, acc: r, hnd: r, pas: r, thr: r, mid: r, cls: r, lay: r, ft: r, ddk: r, sdk: r, str: r, vrt: r, sta: r, prd: r, ind: r, stl: r, blk: r, reb: r, abil: ['deadeye', 'posterizer'] });

/** An app-like loop: uneven frames, an accumulator, juice reacting to the play's events. */
function frames(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) >>> 0;
    return 8 + (a % 27);
  };
}

function nbaGame(withJuice: boolean) {
  const g = newHoopsGame(SP.map((s) => hooper(s, 82)), SP.map((s) => hooper(s, 76)), 'juice-nba');
  const pl = nbaPilot(0.7, 'jn');
  const J = new Juice({ seed: 5 });
  const next = frames(9);
  let now = 0;
  const log: string[] = [];
  while (!g.over) {
    const p = startPossession(g);
    pl.letGo = null;
    pl.driving = false;
    pl.goal = null;
    pl.nextThink = 0;
    pl.crosses = 0;
    let acc = 0;
    for (let f = 0; f < 60 * 120 && !p.end; f++) {
      const ms = next();
      now += ms;
      const elapsed = ms / 1000;
      if (withJuice) J.update(elapsed);
      acc += withJuice ? J.gameTime(now, elapsed) : elapsed;
      while (acc >= DT && !p.end) {
        acc -= DT;
        nbaStep(p, DT, nbaDecide(p, pl));
        if (withJuice)
          for (const e of p.events) {
            if (e === 'release-green') J.hitStop('green', now);
            if (e.startsWith('finish:')) {
              J.hitStop('dunk', now);
              J.addTrauma(0.4);
              J.burst('sweat', 100, 100, 12, ['#fff']);
            }
            if (e.startsWith('blocked:')) J.hitStop('block', now);
          }
        p.events.length = 0;
      }
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
    log.push(afterPossession(g, p) + ':' + p.t.toFixed(4));
  }
  return { score: g.score, log };
}

const KEYS = 'SPD ACC AGI STR AWR THP SAC MAC DAC TUP BTK TRK JKM SPM SFA CAR BCV CTH RTE CIT SPC REL RBK PBK IBL PMV FMV BSH TAK PUR PRC ZCV MCV PRS HIT KPW KAC'.split(' ');
const fb = (id: string, abil: string[] = []): FbPlayer => ({ id, name: id, tag: id, num: null, ht: 73, wt: 220, pos: 'WR', ovr: 80, a: Object.fromEntries(KEYS.map((k) => [k, 80])), abil });
const off = (): Offense => ({ qb: fb('qb', ['cannon']), rb: fb('rb', ['truck-stick']), wr: [fb('x'), fb('z'), fb('sl')], te: fb('te'), ol: [0, 1, 2, 3, 4].map((i) => fb('ol' + i)) as Offense['ol'], k: fb('k') });
const def = (): Defense => ({ dl: [0, 1, 2, 3].map((i) => fb('dl' + i, ['edge-threat'])) as Defense['dl'], lb: [0, 1, 2].map((i) => fb('lb' + i)) as Defense['lb'], cb: [fb('cb1', ['shutdown']), fb('cb2')], s: [fb('fs'), fb('ss', ['enforcer'])] });

function nflGame(withJuice: boolean) {
  const g = newGame(off(), def(), 'juice-nfl');
  const pl = nflPilot(0.7, 'jf');
  const J = new Juice({ seed: 3 });
  const next = frames(4);
  let now = 0;
  const log: string[] = [];
  let plays = 0;
  while (!g.over && plays++ < 220) {
    if (g.down === 4) {
      const d = fourthDown(g);
      if (d === 'kick') {
        kick(g, 0.1);
        continue;
      }
      if (d === 'punt') {
        punt(g);
        continue;
      }
    }
    const p = startPlay(g, chooseCall(g, pl));
    snap(p);
    pl.readAt = 0;
    let acc = 0;
    for (let f = 0; f < 60 * 60 && !p.end; f++) {
      const ms = next();
      now += ms;
      if (withJuice) J.update(ms / 1000);
      acc += withJuice ? J.gameTime(now, ms / 1000) : ms / 1000;
      while (acc >= DT && !p.end) {
        acc -= DT;
        nflStep(p, DT, nflDecide(p, g, pl));
        if (withJuice)
          for (const e of p.events) {
            if (e === 'beat:truck') J.hitStop('truck', now);
            if (e === 'int' || e === 'lane-int') J.hitStop('int', now);
            if (e === 'bighit' || e === 'tackle') J.addTrauma(0.3);
          }
        p.events.length = 0;
      }
    }
    log.push(p.end!.kind + ':' + p.end!.gain + ':' + p.t.toFixed(4));
    afterPlay(g, p.end!);
  }
  return { score: g.score, log };
}

describe('juice is render only', () => {
  it('a seeded basketball game is identical with and without hit-stop/shake/particles', () => {
    const a = nbaGame(false),
      b = nbaGame(true);
    expect(b.log).toEqual(a.log);
    expect(b.score).toBe(a.score);
  }, 60000);
  it('a seeded football game is identical with and without hit-stop/shake/particles', () => {
    const a = nflGame(false),
      b = nflGame(true);
    expect(b.log).toEqual(a.log);
    expect(b.score).toBe(a.score);
  }, 60000);
  it('hit-stop holds time back for its length, shake decays, the pool stays bounded', () => {
    const J = new Juice({ seed: 1 });
    J.hitStop('dunk', 1000);
    expect(J.frozen(1000 + HITSTOP.dunk - 1)).toBe(true);
    expect(J.frozen(1000 + HITSTOP.dunk + 1)).toBe(false);
    expect(J.gameTime(1010, 0.016)).toBe(0);
    J.addTrauma(1);
    const v0 = J.view();
    for (let i = 0; i < 120; i++) J.update(1 / 60);
    expect(J.trauma).toBe(0);
    expect(Math.abs(J.view().x) + Math.abs(J.view().y)).toBeLessThanOrEqual(Math.abs(v0.x) + Math.abs(v0.y) + 9);
    for (let i = 0; i < 50; i++) J.burst('confetti', 10, 10, 30, ['#f00']);
    expect(J.count).toBeLessThanOrEqual(220);
    const R = new Juice({ reducedMotion: true });
    R.addTrauma(1);
    expect(R.view()).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
