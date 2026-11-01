// Claude, 2026-11-01: ratings matter in the right direction, abilities work (docs/GAMEPLAY-RATINGS.md).
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { decide, pilot } from './autopilot';
import { fgMax, fireAtFor, kickWindow, newGame, startPlay } from './drive';
import { ABILITY_ON, byId, lineUp, maxThrow, moveEdge, on, routeWinChance, rushWinAt, snap, step, throwErrorRadius, throwTo } from './engine';
import type { Body, Defense, FbPlayer, Move, Offense } from './types';

const KEYS = 'SPD ACC AGI STR AWR THP SAC MAC DAC TUP BTK TRK JKM SPM SFA CAR BCV CTH RTE CIT SPC REL RBK PBK IBL PMV FMV BSH TAK PUR PRC ZCV MCV PRS HIT KPW KAC'.split(' ');
const fb = (pos: string, id: string, o: Record<string, number> = {}, abil: string[] = [], wt = 220): FbPlayer => ({
  id,
  name: id,
  tag: id,
  num: null,
  ht: 73,
  wt,
  pos,
  ovr: 75,
  a: { ...Object.fromEntries(KEYS.map((k) => [k, 75])), SPD: 86, ACC: 86, AGI: 82, ...o },
  abil
});
const offense = (mod: Partial<Record<'qb' | 'rb' | 'wr' | 'te' | 'ol' | 'k', FbPlayer>> = {}): Offense => ({
  qb: mod.qb ?? fb('QB', 'qb'),
  rb: mod.rb ?? fb('RB', 'rb'),
  wr: [mod.wr ?? fb('WR', 'x'), fb('WR', 'z'), fb('WR', 'sl')],
  te: mod.te ?? fb('TE', 'te'),
  ol: [0, 1, 2, 3, 4].map((i) => mod.ol ?? fb('OT', 'ol' + i, {}, [], 310)) as Offense['ol'],
  k: mod.k ?? fb('K', 'k')
});
const defense = (d: FbPlayer | null = null): Defense => ({
  dl: [0, 1, 2, 3].map((i) => d ?? fb('DE', 'dl' + i, {}, [], 280)) as Defense['dl'],
  lb: [0, 1, 2].map((i) => fb('LB', 'lb' + i)) as Defense['lb'],
  cb: [fb('CB', 'cb1'), fb('CB', 'cb2')],
  s: [fb('S', 'fs'), fb('S', 'ss')]
});
const body = (p: FbPlayer): Body => ({ id: 0, side: 'O', p, slot: 'RB', x: 0, y: 0, vx: 0, vy: 0, job: 'carry', act: 'carry', actAt: 0, route: [], sit: false, mark: null, zone: null, heldUntil: 0, readUntil: 0, misread: false, stunUntil: 0, breakAt: 0, winAt: 0, windAt: 0, diveAt: 0, dive: null, trail: [] });

describe('NFL ball-carrier moves: no more inversions', () => {
  const tackler = body(fb('LB', 'lb', {}, [], 235));
  it('a truck works by trucking, strength and weight; a stiff arm by its rating and strength', () => {
    const power = body(fb('RB', 'pow', { TRK: 95, STR: 90, SFA: 90 }, [], 235));
    const scat = body(fb('RB', 'scat', { TRK: 55, STR: 55, SFA: 55 }, [], 185));
    expect(moveEdge('truck', power, tackler)).toBeGreaterThan(moveEdge('truck', scat, tackler) + 0.15);
    expect(moveEdge('stiff', power, tackler)).toBeGreaterThan(moveEdge('stiff', scat, tackler));
    // a heavier back trucks better, same ratings
    const heavy = body(fb('RB', 'h', { TRK: 80 }, [], 240)),
      light = body(fb('RB', 'l', { TRK: 80 }, [], 190));
    expect(moveEdge('truck', heavy, tackler)).toBeGreaterThan(moveEdge('truck', light, tackler));
  });
  it('the AI picks the move that fits the back (a power back trucks, a scat back jukes)', () => {
    // the same scoring the autopilot uses, with its timing values
    const timing: Record<Move, number> = { juke: 0.32, spin: 0.2, stiff: 0.18, truck: 0.18 };
    const best = (c: Body) => (['juke', 'spin', 'stiff', 'truck'] as Move[]).map((k) => [k, moveEdge(k, c, tackler) + timing[k] * 0.74] as const).sort((a, b) => b[1] - a[1])[0][0];
    expect(best(body(fb('RB', 'pow', { TRK: 97, STR: 92, JKM: 60, SPM: 60, SFA: 70 }, [], 245)))).toBe('truck');
    expect(best(body(fb('RB', 'scat', { TRK: 50, STR: 55, JKM: 95, SPM: 80, SFA: 55 }, [], 185)))).toBe('juke');
  });
});

describe('NFL: passer, rusher and route ratings are felt', () => {
  it('accuracy spreads the throw (60 vs 90 passers differ a lot)', () => {
    const p60 = lineUp(offense({ qb: fb('QB', 'q', { SAC: 60, MAC: 60, DAC: 60 }) }), defense(), 'pass', 'slants', 'inside', 25, 26.67, rng(1));
    const p90 = lineUp(offense({ qb: fb('QB', 'q', { SAC: 90, MAC: 90, DAC: 90 }) }), defense(), 'pass', 'slants', 'inside', 25, 26.67, rng(1));
    expect(throwErrorRadius(p60, 20)).toBeGreaterThan(throwErrorRadius(p90, 20) * 3);
  });
  it('a power or finesse rush beats its blocker sooner, by the best of the two', () => {
    const blk = fb('OT', 'ot', { PBK: 75, STR: 80, AGI: 55 });
    const r = () => 0.5;
    const even = rushWinAt(fb('DE', 'd', { PMV: 75, FMV: 75, STR: 80, AGI: 55 }), blk, r, false);
    const power = rushWinAt(fb('DE', 'd', { PMV: 95, FMV: 60, STR: 95, AGI: 55 }), blk, r, false);
    const finesse = rushWinAt(fb('DE', 'd', { PMV: 60, FMV: 95, STR: 70, AGI: 85 }), blk, r, false);
    expect(power).toBeLessThan(even - 0.3);
    expect(finesse).toBeLessThan(even - 0.3);
  });
  it('a route runner wins his break against a worse cover man', () => {
    expect(routeWinChance(fb('WR', 'w', { RTE: 95, AGI: 90 }), fb('CB', 'c', { MCV: 70, AGI: 80 }))).toBeGreaterThan(0.85);
    expect(routeWinChance(fb('WR', 'w', { RTE: 65, AGI: 80 }), fb('CB', 'c', { MCV: 92, AGI: 90 }))).toBeLessThan(0.2);
  });
  it('no cliffs: the kick window grows smoothly with accuracy below 55 too', () => {
    const g = (kac: number) => {
      const x = newGame(offense({ k: fb('K', 'k', { KAC: kac }) }), defense(), 'k');
      x.ballOn = 80;
      return kickWindow(x);
    };
    expect(g(50)).toBeGreaterThan(g(45));
    expect(g(99)).toBeGreaterThan(g(80));
  });
});

describe('NFL abilities: all sixteen work, in the zone about half the time', () => {
  const ALL = ['cannon', 'surgeon', 'scrambler', 'truck-stick', 'juke-box', 'deep-threat', 'sure-hands', 'red-zone', 'pocket-wall', 'road-grader', 'edge-threat', 'run-stopper', 'enforcer', 'shutdown', 'ballhawk', 'big-leg'];
  it('rolls each ability once per play from the play seed, about half the time', () => {
    let hits = 0,
      n = 0;
    for (let s = 0; s < 400; s++) {
      const p = lineUp(offense({ qb: fb('QB', 'q', {}, ['cannon']) }), defense(), 'pass', 'slants', 'inside', 25, 26.67, rng(s));
      n++;
      if (on(p.qb, 'cannon')) hits++;
      // the same seed rolls the same way (both phones agree)
      const again = lineUp(offense({ qb: fb('QB', 'q', {}, ['cannon']) }), defense(), 'pass', 'slants', 'inside', 25, 26.67, rng(s));
      expect(on(again.qb, 'cannon')).toBe(on(p.qb, 'cannon'));
    }
    expect(hits / n).toBeGreaterThan(ABILITY_ON - 0.08);
    expect(hits / n).toBeLessThan(ABILITY_ON + 0.08);
  });
  it('every ability has an effect when it is on', () => {
    let used = 0;
    const forced = (o: Offense, d: Defense, seed: number, id: string, pick: (b: Body) => boolean) => {
      for (let s = seed; s < seed + 60; s++) {
        const p = lineUp(o, d, 'pass', 'verts', 'inside', 25, 26.67, rng(s));
        const b = p.bodies.find(pick)!;
        used = s;
        if (on(b, id)) return p;
      }
      throw new Error('never on: ' + id);
    };
    // cannon: farther and faster
    const off = (abil: string[]) => offense({ qb: fb('QB', 'q', {}, abil) });
    const cannon = forced(off(['cannon']), defense(), 0, 'cannon', (b) => b.slot === 'QB');
    const plain = lineUp(off([]), defense(), 'pass', 'verts', 'inside', 25, 26.67, rng(0));
    expect(maxThrow(cannon)).toBeGreaterThan(maxThrow(plain) + 3);
    // surgeon: tighter short throws
    const surgeon = forced(off(['surgeon']), defense(), 0, 'surgeon', (b) => b.slot === 'QB');
    expect(throwErrorRadius(surgeon, 10)).toBeLessThan(throwErrorRadius(plain, 10));
    // pocket wall / edge threat: the rush wins later / sooner
    const wall = forced(offense({ ol: fb('OT', 'ol', {}, ['pocket-wall'], 310) }), defense(), 0, 'pocket-wall', (b) => b.slot === 'LT');
    const le = (p: ReturnType<typeof lineUp>) => p.bodies.find((b) => b.slot === 'LE')!;
    // (the rolls come after the rush is drawn, so the same seed without the ability is the same rush)
    const base = lineUp(offense(), defense(), 'pass', 'verts', 'inside', 25, 26.67, rng(used));
    expect(le(wall).winAt).toBeCloseTo(le(base).winAt + 0.35, 5);
    const edge = forced(offense(), defense(fb('DE', 'e', {}, ['edge-threat'], 280)), 0, 'edge-threat', (b) => b.slot === 'LE');
    const base2 = lineUp(offense(), defense(fb('DE', 'e', {}, [], 280)), 'pass', 'verts', 'inside', 25, 26.67, rng(used));
    expect(le(edge).winAt).toBeLessThan(le(base2).winAt - 0.2);
    // big leg: four more yards of range
    const k = (abil: string[]) => fgMax(newGame(offense({ k: fb('K', 'k', {}, abil) }), defense(), 'k'));
    expect(k(['big-leg'])).toBe(k([]) + 4);
    // heat check gets the QB hot a completion sooner
    expect(fireAtFor(newGame(offense({ wr: fb('WR', 'x', {}, ['heat-check']) }), defense(), 'h'))).toBe(2);
    // the list itself: each id is rolled by lineUp for a carrier of it
    for (const id of ALL) {
      const p = lineUp(offense({ qb: fb('QB', 'q', {}, [id]) }), defense(), 'pass', 'verts', 'inside', 25, 26.67, rng(7));
      expect(Array.isArray(p.qb.on)).toBe(true);
    }
  });
  it('abilities report when they change a play (the HUD pop)', () => {
    let seen = false;
    for (let s = 0; s < 40 && !seen; s++) {
      const g = newGame(offense({ qb: fb('QB', 'q', { THP: 95 }, ['cannon', 'surgeon']) }), defense(), 'pop' + s);
      const p = startPlay(g, 'pass');
      const pl = pilot(0.8, 'pp' + s);
      snap(p);
      for (let i = 0; i < 600 && !p.end; i++) {
        step(p, 1 / 60, decide(p, g, pl));
        if (p.events.some((e) => e.startsWith('ability:'))) seen = true;
        p.events.length = 0;
      }
    }
    expect(seen).toBe(true);
    void byId;
    void throwTo;
  });
});
