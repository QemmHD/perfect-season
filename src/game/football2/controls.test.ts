// Codex: the thumb's two screen axes must reach the field in either camera orientation.
import { describe, expect, it } from 'vitest';
import { audibleTo, CarryGate, callAllowed, screenRunInput } from './controls';
import { choices, newGame } from './drive';
import type { Defense, FbPlayer, Offense } from './types';
describe('football joystick mapping', () => {
  it.each([
    ['end', 0, -1, 0, 1],
    ['end', 0, 1, 0, -1],
    ['end', 1, 0, 1, 0],
    ['end', -1, 0, -1, 0],
    ['side', 1, 0, 0, 1],
    ['side', -1, 0, 0, -1],
    ['side', 0, -1, 1, 0],
    ['side', 0, 1, -1, 0]
  ] as const)('%s view maps screen (%s,%s) to field (%s,%s)', (view, x, y, fx, fy) => {
    const v = screenRunInput(x, y, view);
    expect(v.x).toBeCloseTo(fx);
    expect(v.y).toBeCloseTo(fy);
  });
  it('keeps center/jitter still, retains partial pressure and caps diagonal speed', () => {
    expect(screenRunInput(0, 0.08, 'end')).toEqual({ x: 0, y: 0 });
    const partial = screenRunInput(0, -0.5, 'end');
    expect(partial.y).toBeGreaterThan(0.3);
    expect(partial.y).toBeLessThan(0.6);
    const diagonal = screenRunInput(1, -1, 'end');
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(screenRunInput(NaN, 1, 'end')).toEqual({ x: 0, y: 0 });
  });
});

// Claude (nfl-1): the momentum carry. The engine takes null as "nobody is steering this carrier".
describe('the momentum carry gate', () => {
  const up = { x: 0, y: 1 },
    backLeft = { x: -0.7, y: -0.7 };
  it('lets an untouched new carrier run on his momentum, and gives a touched one the stick', () => {
    const g = new CarryGate();
    expect(g.input(null, false, null)).toEqual({ x: 0, y: 0 });
    expect(g.input(7, false, null)).toBeNull();
    expect(g.input(7, false, null)).toBeNull();
    g.touch();
    expect(g.input(7, false, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(g.input(7, false, up)).toEqual(up);
    // touched, then let go: a brake, never the momentum again for this carrier
    expect(g.input(7, false, null)).toEqual({ x: 0, y: 0 });
  });
  it('counts a stick held upfield at the change at once, and any deflection on a designed handoff', () => {
    const g = new CarryGate();
    expect(g.input(3, false, { x: 0.5, y: 0.6 })).toEqual({ x: 0.5, y: 0.6 });
    g.reset();
    expect(g.input(4, true, backLeft)).toEqual(backLeft);
    g.reset();
    // 0.3 of its length upfield is the line
    expect(g.input(5, false, { x: 0.95, y: 0.3 })).toEqual({ x: 0.95, y: 0.3 });
    g.reset();
    expect(g.input(5, false, { x: 0.96, y: 0.28 })).toBeNull();
  });
  it('ignores a stick held back-left at the catch until it moves a quarter of the way or is touched again', () => {
    const g = new CarryGate();
    expect(g.input(2, false, backLeft)).toBeNull();
    expect(g.input(2, false, { x: -0.6, y: -0.6 })).toBeNull();
    expect(g.input(2, false, { x: -0.7, y: -0.4 })).toEqual({ x: -0.7, y: -0.4 });
    g.reset();
    expect(g.input(2, false, backLeft)).toBeNull();
    g.touch();
    expect(g.input(2, false, backLeft)).toEqual(backLeft);
  });
  it('treats a centred held stick at the change as untouched (a resting thumb never brakes the catch)', () => {
    const g = new CarryGate();
    expect(g.input(6, true, { x: 0, y: 0 })).toBeNull();
    expect(g.input(6, true, { x: 0, y: 0.3 })).toEqual({ x: 0, y: 0.3 });
  });
  it('steers at once with a touch made while the ball is in the air, whatever its direction', () => {
    const right = { x: 1, y: 0 };
    const g = new CarryGate();
    // the reviewer's repro: touched in the air, held right through the catch
    g.touch(true);
    expect(g.input(null, false, right)).toEqual(right);
    expect(g.input(11, false, right)).toEqual(right);
    expect(g.input(11, false, right)).toEqual(right);
    // back-left too: a thumb that landed after the throw is deliberate
    g.reset();
    g.touch(true);
    expect(g.input(null, false, backLeft)).toEqual(backLeft);
    expect(g.input(12, false, backLeft)).toEqual(backLeft);
    // a touch in the pocket (not in the air) still waits for the upfield rule
    g.reset();
    g.touch();
    expect(g.input(null, false, right)).toEqual(right);
    expect(g.input(13, false, right)).toBeNull();
    // the air touch is used once: the next carrier (a lateral) is decided afresh
    g.reset();
    g.touch(true);
    expect(g.input(14, false, right)).toEqual(right);
    expect(g.input(15, false, right)).toBeNull();
    // let go before the catch: he runs on his momentum, never a brake
    g.reset();
    g.touch(true);
    expect(g.input(null, false, right)).toEqual(right);
    expect(g.input(16, false, null)).toBeNull();
  });
  it('decides afresh for every new carrier: a touch before the ball changes hands does not carry over', () => {
    const g = new CarryGate();
    g.touch();
    expect(g.input(null, false, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(g.input(8, false, { x: 0, y: 0 })).toBeNull();
    g.touch();
    expect(g.input(8, false, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    // the next carrier (a lateral, a new play) starts over
    expect(g.input(9, false, null)).toBeNull();
  });
});

// Claude (nfl-2 review fix): AUDIBLE and the book keep to a drill's kind.
describe('practice drills keep to their call', () => {
  it('allows only runs in a run drill, only passes in a throw drill, everything in a game', () => {
    expect([callAllowed('run', 'run'), callAllowed('run', 'pass')]).toEqual([true, false]);
    expect([callAllowed('throw', 'run'), callAllowed('throw', 'pass')]).toEqual([false, true]);
    expect([callAllowed('kick', 'run'), callAllowed('kick', 'pass')]).toEqual([false, false]);
    expect([callAllowed(undefined, 'run'), callAllowed(null, 'pass')]).toEqual([true, true]);
  });
  it('never lets AUDIBLE turn a run drill into a pass (or a throw drill into a run), whatever the cards', () => {
    const run = { call: 'run' as const, concept: 'verts' as const, run: 'inside' as const },
      pass = { call: 'pass' as const, concept: 'mesh' as const, run: 'inside' as const };
    for (const cards of [[run, run, run], [pass, pass, run], [run], [pass, run, pass]]) {
      for (const cur of cards) {
        const r = audibleTo(cur, cards, 'run');
        if (r?.kind === 'card') expect(cards[r.index].call).toBe('run');
        if (r?.kind === 'book') expect(r.card.call).toBe('run');
        const t = audibleTo(cur, cards, 'throw');
        if (t?.kind === 'card') expect(cards[t.index].call).toBe('pass');
        if (t?.kind === 'book') expect(t.card.call).toBe('pass');
      }
    }
    // a run drill's cards are all runs: AUDIBLE does nothing at all
    expect(audibleTo(run, [run, run, run], 'run')).toBeNull();
    expect(audibleTo(pass, [pass, pass, pass], 'throw')).toBeNull();
    // in a game it flips the picked card to its mirror (nfl-5): to the card when it's on the tray,
    // else from the book; and back again
    const slants = { call: 'pass' as const, concept: 'slants' as const, run: 'outside' as const };
    const inside = { call: 'run' as const, concept: 'verts' as const, run: 'inside' as const };
    expect(audibleTo(slants, [slants, pass, inside], undefined)).toEqual({ kind: 'card', index: 2 });
    expect(audibleTo(slants, [slants, pass, run], undefined)).toEqual({ kind: 'book', card: { call: 'run', concept: 'slants', run: 'inside' } });
    expect(audibleTo(inside, [inside, run, run], undefined)).toEqual({ kind: 'book', card: { call: 'pass', concept: 'slants', run: 'inside' } });
  });
  it('a run drill lined up from the real choices offers only runs (the tray never shows a pass)', () => {
    const man = (pos: string): FbPlayer => ({ id: pos, name: pos, tag: pos, num: null, ht: 74, wt: 220, pos, ovr: 75, a: {}, abil: [] });
    const off: Offense = { qb: man('QB'), rb: man('RB'), wr: [man('WR'), man('WR'), man('WR')], te: man('TE'), ol: [man('OT'), man('OG'), man('C'), man('OG'), man('OT')], k: man('K') };
    const def: Defense = { dl: [man('DE'), man('DT'), man('DT'), man('DE')], lb: [man('LB'), man('LB'), man('LB')], cb: [man('CB'), man('CB')], s: [man('S'), man('S')] };
    const g = newGame(off, def, 'drill', 4);
    for (let down = 1; down <= 4; down++) {
      g.down = down;
      const cs = choices(g, 'run').filter((c) => callAllowed('run', c.call));
      expect(cs.length).toBeGreaterThan(0);
      expect(cs.every((c) => c.call === 'run')).toBe(true);
    }
  });
});
