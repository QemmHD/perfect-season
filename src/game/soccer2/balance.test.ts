// The person against the AI after touch dribbling and the defending rework (Claude 2026-11-16, studio
// overhaul soccer-5; audit B-1, B-2, R-3, AI-1, AI-2; plan P1, P3, P7, P8, G8 and switch play). Guards,
// not fits: wide tolerances on small samples (the tight bands are in scripts/soccer/human.ts and
// ratings-human.ts, whose numbers are in docs/studio-overhaul/soccer.md).
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { autoplayAttack, decide, pilot } from './autopilot';
import { ctrlOf, GX, kickOff, ownerOf, PL, pressShoot, releaseShoot, setSprint, setupAttack, step } from './engine';
import { tackleWin } from './ratings';
import { squadFor } from './squads.test-util';
import type { Attack, Scenario, SoccerPlayer, SoccerPos, Squad } from './types';

let uid = 0;
function player(pos: SoccerPos, v: number, over: Record<string, number> = {}): SoccerPlayer {
  const keeper = pos === 'GK';
  const keys = keeper ? ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
  const a: Record<string, number> = Object.fromEntries(keys.map((k) => [k, v]));
  Object.assign(a, over);
  return { id: 'bp' + uid++, name: 'P', tag: 'P', num: null, ht: 182, pos, pos2: [pos], ovr: v, a, keeper };
}
function squad(v: number, over: Record<string, number> = {}): Squad {
  return {
    name: 'T',
    abbr: 'T',
    c1: '#c22',
    c2: '#fff',
    gk: player('GK', v),
    def: [player('FB', v, over), player('CB', v, over), player('CB', v, over), player('FB', v, over)],
    mid: [player('CM', v, over), player('DM', v, over), player('CM', v, over)],
    fwd: [player('W', v, over), player('ST', v, over), player('W', v, over)],
  };
}
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

/** The no-skill beeline (as scripts/soccer/lib.ts beeline): sprint straight at goal, SHOOT at 16 m with
 * aim assist, timing sd 0.06 s. */
function beeline(a: Attack, r: () => number): Attack {
  kickOff(a);
  let hold = -1;
  for (let n = 0; n < 60 * 120 && !a.end; n++) {
    const c = ctrlOf(a);
    const own = ownerOf(a);
    let stick: { x: number; y: number } | null = { x: 0, y: 0 };
    if (a.setPiece && a.taker === c.id && !a.meter && !a.strike) {
      if (pressShoot(a)) hold = a.t + a.meter!.top + gauss(r) * 0.06;
    } else if (own && own.id === c.id) {
      const dx = GX - c.x;
      const dy = PL - 1 - c.y;
      const l = Math.hypot(dx, dy) || 1;
      stick = { x: dx / l, y: dy / l };
      setSprint(a, a.stamina > 0.08);
      if (!a.meter && hold < 0 && Math.hypot(GX - c.x, PL - c.y) <= 16 && pressShoot(a)) hold = a.t + a.meter!.top + gauss(r) * 0.06;
    } else if (!own) stick = null;
    if (a.meter && hold > 0 && a.t >= hold) {
      releaseShoot(a, null);
      hold = -2;
    }
    step(a, 1 / 60, stick);
  }
  return a;
}

const SIDES = [0, 1, 2, 3].map((i) => squadFor('bal-' + i, 70 + i * 4));
const SCEN: Scenario[] = ['build', 'counter', 'wide'];

describe('B-2: the tackle curve (P7)', () => {
  it('a 10-point gap wins 0.55-0.75, bounded 0.15-0.85, smooth', () => {
    for (const base of [60, 70, 80]) {
      const p = tackleWin(player('CB', base + 10), player('W', base), false, 0);
      expect(p, 'DEF ' + (base + 10) + ' v DRI ' + base).toBeGreaterThanOrEqual(0.55);
      expect(p).toBeLessThanOrEqual(0.75);
    }
    expect(tackleWin(player('CB', 99), player('W', 30), false, 1)).toBeLessThanOrEqual(0.85);
    expect(tackleWin(player('CB', 30), player('W', 99), true, -0.5)).toBeGreaterThanOrEqual(0.15);
    // no cliff: every 5 points moves it by less than 0.15
    for (let g = -40; g < 40; g += 5) {
      const a = tackleWin(player('CB', 70 + g / 2), player('W', 70 - g / 2), false, 0);
      const b = tackleWin(player('CB', 70 + (g + 5) / 2), player('W', 70 - (g + 5) / 2), false, 0);
      expect(b - a).toBeLessThan(0.15);
      expect(b).toBeGreaterThanOrEqual(a);
    }
  });
});

describe('B-1: the no-skill beeline against the autopilot, R-3 fouls, G8 (soccer-5)', () => {
  it('fouls are no longer cheap, the ball is won between touches, and the beeline is held to the autopilot', () => {
    const N = 60;
    let bee = 0;
    let auto = 0;
    let pens = 0;
    let fks = 0;
    let won = 0;
    let exposed = 0;
    for (const sc of SCEN)
      for (let i = 0; i < N; i++) {
        const att = SIDES[i % 4];
        const def = SIDES[(i + 1) % 4];
        const b = beeline(setupAttack(sc, att, def, 'bal:' + sc + i, {}), rng(hashString('balr' + sc + i)));
        if (b.end?.kind === 'G') bee++;
        if (b.events.includes('penalty')) pens++;
        if (b.events.includes('freekick')) fks++;
        const p = autoplayAttack(setupAttack(sc, att, def, 'bal:' + sc + i, {}), 0.68, 'balp' + i);
        if (p.end?.kind === 'G') auto++;
        if (p.tackled) {
          won++;
          if (p.tackled.gap > 0.6) exposed++;
        }
      }
    const n = N * SCEN.length;
    // P3 (guard): penalties won ≤ 4%, free kicks won ≤ 9% (they were 4-12% and 2-28%)
    expect(pens / n).toBeLessThanOrEqual(0.04);
    expect(fks / n).toBeLessThanOrEqual(0.09);
    // G8 (guard ≥ 70%): the AI's tackles are won while the ball is off the feet, between touches
    expect(won).toBeGreaterThan(5);
    expect(exposed / won).toBeGreaterThanOrEqual(0.7);
    // P1: the beeline was up to 2.9x (7x in counters after soccer-4) the Pro autopilot; guard at 2x pooled
    // (the harness's per-row numbers and the 1.3x target are in the team doc)
    expect(bee).toBeLessThanOrEqual(Math.max(6, auto * 2));
  });
});

describe('R-3: a foul from behind on a breakaway is a yellow (P8)', () => {
  it('at least 85% of them', () => {
    let fouls = 0;
    let yellow = 0;
    for (let i = 0; i < 400 && fouls < 40; i++) {
      // a counter with one chaser left, a poor tackler as quick as the carrier, a stride behind him; every
      // other defender out of it; the carrier sprints at goal
      const a = setupAttack('counter', squad(78), squad(60, { DEF: 45, PAC: 78 }), 'yel' + i, { side: 1 });
      const c = a.bodies[a.ctrl];
      const chasers = a.bodies.filter((b) => b.side === 'D' && b.role !== 'gk');
      chasers.forEach((b, k) => {
        if (k === 0) {
          b.x = c.x + 0.3;
          b.y = c.y - 1.2;
          b.vy = 6.2;
        } else {
          b.x = 66;
          b.y = 31;
          b.stunUntil = 1e9;
        }
      });
      kickOff(a);
      for (let n = 0; n < 60 * 11 && !a.end && !a.setPiece; n++) {
        setSprint(a, true);
        a.stamina = 1;
        step(a, 1 / 60, a.ball.owner === c.id ? { x: (GX - c.x) / 40, y: 1 } : null);
      }
      if (a.events.includes('foul')) {
        fouls++;
        if (a.events.includes('yellow')) yellow++;
      }
    }
    expect(fouls).toBeGreaterThanOrEqual(10);
    expect(yellow / fouls).toBeGreaterThanOrEqual(0.85);
  });
});

describe('AI-1: switch play when the near side is crowded', () => {
  it('the autopilot switches it to the free man on the far side in at least 60% of crafted overloads', () => {
    let tries = 0;
    let switched = 0;
    for (let i = 0; i < 40; i++) {
      const a = setupAttack('wide', SIDES[i % 4], SIDES[(i + 2) % 4], 'switch' + i, { side: 1 });
      const c = a.bodies[a.ctrl];
      // five defenders round the ball on the left, the far winger (RW) alone on the right
      const defs = a.bodies.filter((b) => b.side === 'D' && b.role !== 'gk');
      defs.forEach((b, k) => {
        const ang = (k / defs.length) * Math.PI * 1.4 - 0.2;
        b.x = Math.max(1, c.x + Math.cos(ang) * (4.5 + (k % 2) * 2.5));
        b.y = c.y + 3 + Math.sin(ang) * 5;
      });
      const far = a.bodies.find((b) => b.side === 'A' && b.slot === 'RW')!;
      far.x = 48;
      far.y = c.y + 4;
      const pl = pilot(0.8, 'sw' + i);
      kickOff(a);
      for (let n = 0; n < 90 && !a.kick && !a.end; n++) step(a, 1 / 60, decide(a, pl));
      if (!a.kick) continue;
      tries++;
      if (a.kick.to === far.id && (a.kick.kind === 'lofted' || a.kick.kind === 'cross')) switched++;
    }
    expect(tries).toBeGreaterThanOrEqual(20);
    expect(switched / tries).toBeGreaterThanOrEqual(0.6);
  });
});
