// Claude (nfl-2): pointer ownership and gestures, driven with synthetic touch sequences.
import { describe, expect, it } from 'vitest';
import { burstHeld, COVER_MS, type Ctx, Gestures, isTap, nextPassType, ownerOf, stickZone, SWIPE_MS, SWIPE_PX, swipeDir, TAP_MS, TAP_PX } from './gestures';

const W = 393,
  H = 852;
const ctx = (state: Ctx['state']): Ctx => ({ w: W, state, zone: stickZone(W, H) });
let t = 1000;
const at = (id: number, x: number, y: number, extra: { ctl?: string; icon?: number } = {}) => ({ id, x, y, t, ...extra });

describe('pointer ownership (decided on pointerdown, in order)', () => {
  it('gives the stick zone as the C15 rule: left 48%, lower 55%', () => {
    expect(stickZone(393, 852)).toEqual({ w: 189, top: 383 });
    expect(stickZone(320, 568)).toEqual({ w: 154, top: 256 });
  });
  it('puts a control first, then the stick zone, then an icon, then the right two thirds', () => {
    // a control wins even inside the stick zone
    expect(ownerOf(at(1, 100, 700, { ctl: 'A' }), ctx('carrier'))).toEqual({ kind: 'control', ctl: 'A' });
    expect(ownerOf(at(1, 12, 70, { ctl: 'pause' }), ctx('pocket'))).toEqual({ kind: 'control', ctl: 'pause' });
    // the stick zone wins over an icon drawn inside it
    expect(ownerOf(at(1, 100, 600, { icon: 4 }), ctx('pocket'))).toEqual({ kind: 'stick' });
    expect(ownerOf(at(1, 300, 300, { icon: 4 }), ctx('pocket'))).toEqual({ kind: 'icon', icon: 4 });
    expect(ownerOf(at(1, 300, 300), ctx('pocket'))).toEqual({ kind: 'sling' });
    expect(ownerOf(at(1, 300, 300), ctx('carrier'))).toEqual({ kind: 'hold' });
    // the left third above the zone owns nothing; before the snap the field is for looking around (nfl-3)
    expect(ownerOf(at(1, 60, 200), ctx('pocket'))).toEqual({ kind: 'none' });
    expect(ownerOf(at(1, 300, 300), ctx('pre'))).toEqual({ kind: 'look' });
    expect(ownerOf(at(1, 60, 200), ctx('pre'))).toEqual({ kind: 'look' });
    // a thumb resting in the zone before the snap already owns the stick
    expect(ownerOf(at(1, 80, 700), ctx('pre'))).toEqual({ kind: 'stick' });
    expect(ownerOf(at(1, 80, 700), ctx('idle'))).toEqual({ kind: 'none' });
    // icons take touches only in the pocket
    expect(ownerOf(at(1, 300, 300, { icon: 2 }), ctx('carrier'))).toEqual({ kind: 'hold' });
  });
  it('lets one finger own the stick, and a second in the zone owns nothing', () => {
    const g = new Gestures();
    expect(g.down(at(1, 80, 700), ctx('carrier'))).toEqual([{ kind: 'stick-down', id: 1 }]);
    expect(g.down(at(2, 120, 650), ctx('carrier'))).toEqual([]);
    expect(g.owner(2)).toEqual({ kind: 'none' });
    expect(g.up(1, 90, 700, t + 400)).toEqual([{ kind: 'stick-up', id: 1 }]);
    expect(g.stickId()).toBeNull();
  });
});

describe('looking around before the snap (nfl-3)', () => {
  it('a drag of 10 px on the field follows the finger, and its lift ends it; a tap does nothing', () => {
    const g = new Gestures();
    g.down(at(1, 250, 300), ctx('pre'));
    expect(g.move(1, 252, 305, t + 30)).toEqual([]);
    expect(g.move(1, 250, 330, t + 60)).toEqual([{ kind: 'look', dx: 0, dy: 30 }]);
    // once it's looking, every move follows (even back inside 10 px of the start)
    expect(g.move(1, 251, 302, t + 90)).toEqual([{ kind: 'look', dx: 1, dy: 2 }]);
    expect(g.up(1, 251, 302, t + 120)).toEqual([{ kind: 'look', dx: 1, dy: 2 }, { kind: 'look-end' }]);
    const tap = new Gestures();
    tap.down(at(2, 250, 300), ctx('pre'));
    expect(tap.up(2, 252, 301, t + 80)).toEqual([]);
  });
  it('a thumb in the stick zone before the snap still owns the stick, never the view', () => {
    const g = new Gestures();
    expect(g.down(at(1, 80, 700), ctx('pre'))).toEqual([{ kind: 'stick-down', id: 1 }]);
    expect(g.move(1, 80, 600, t + 50)).toEqual([]);
  });
  it('a look taken away (a system gesture) ends, and nothing else fires', () => {
    const g = new Gestures();
    g.down(at(1, 250, 300), ctx('pre'));
    g.move(1, 250, 340, t + 40);
    expect(g.cancel(1)).toEqual([{ kind: 'look-end' }]);
  });
});

describe('tap or drag', () => {
  it('splits at 10 px and 250 ms', () => {
    expect(isTap(TAP_PX - 0.1, TAP_MS - 1)).toBe(true);
    expect(isTap(TAP_PX, 10)).toBe(false);
    expect(isTap(2, TAP_MS)).toBe(false);
  });
  it('throws to an icon on touch-down, once, and a drag from it is not a slingshot', () => {
    const g = new Gestures();
    expect(g.down(at(1, 300, 300, { icon: 3 }), ctx('pocket'))).toEqual([{ kind: 'icon-throw', icon: 3 }]);
    expect(g.move(1, 300, 340, t + 50)).toEqual([]);
    expect(g.up(1, 290, 380, t + 400)).toEqual([]);
    expect(g.slingId()).toBeNull();
  });
  it('starts the slingshot on the field at 10 px, and a cancelled touch throws nothing', () => {
    const g = new Gestures();
    g.down(at(1, 280, 420), ctx('pocket'));
    expect(g.move(1, 285, 425, t + 30)).toEqual([]);
    expect(g.move(1, 288, 428, t + 40)).toEqual([{ kind: 'sling-start', id: 1, x0: 280, y0: 420 }]);
    expect(g.cancel(1)).toEqual([{ kind: 'sling-cancel', id: 1 }]);
  });
});

describe('swipe off A', () => {
  it('reads left and right at 36 px within 250 ms, and nothing slower, shorter or vertical', () => {
    expect(swipeDir(-SWIPE_PX, 4, 100)).toBe(-1);
    expect(swipeDir(SWIPE_PX + 5, -10, SWIPE_MS)).toBe(1);
    expect(swipeDir(SWIPE_PX - 1, 0, 100)).toBe(0);
    expect(swipeDir(60, 0, SWIPE_MS + 1)).toBe(0);
    expect(swipeDir(40, 50, 100)).toBe(0);
  });
  it('resolves a pending A press as a swipe, or as a plain press on lift or once the window lapses', () => {
    const g = new Gestures();
    g.down(at(1, 323, 738, { ctl: 'A' }), ctx('carrier'), { pendingA: true });
    expect(g.move(1, 300, 740, t + 80)).toEqual([]);
    expect(g.move(1, 285, 741, t + 120)).toEqual([{ kind: 'swipe', dir: -1 }]);
    expect(g.up(1, 280, 741, t + 160)).toEqual([]);
    g.down(at(2, 323, 738, { ctl: 'A' }), ctx('carrier'), { pendingA: true });
    expect(g.up(2, 326, 738, t + 90)).toEqual([{ kind: 'a-tap' }]);
    g.down(at(3, 323, 738, { ctl: 'A' }), ctx('carrier'), { pendingA: true });
    expect(g.tick(t + SWIPE_MS - 1)).toEqual([]);
    expect(g.tick(t + SWIPE_MS + 1)).toEqual([{ kind: 'a-tap' }]);
    expect(g.up(3, 400, 738, t + 300)).toEqual([]);
    // without a pending press A is the DOM button's alone
    g.down(at(4, 323, 738, { ctl: 'A' }), ctx('carrier'));
    expect(g.move(4, 260, 738, t + 50)).toEqual([]);
  });
});

describe('the cover-ball hold', () => {
  it('covers after 0.3 s of a still right thumb while the left thumb steers, and lets go on lift or a move', () => {
    const g = new Gestures();
    g.down(at(1, 80, 700), ctx('carrier'));
    g.move(1, 120, 660, t + 50);
    g.down(at(2, 300, 400), ctx('carrier'));
    expect(g.tick(t + COVER_MS - 1)).toEqual([]);
    expect(g.tick(t + COVER_MS)).toEqual([{ kind: 'cover', on: true }]);
    expect(g.tick(t + COVER_MS + 100)).toEqual([]);
    // the stick keeps steering through it
    expect(g.stickId()).toBe(1);
    expect(g.up(2, 301, 401, t + 900)).toEqual([{ kind: 'cover', on: false }]);
    g.down(at(3, 300, 400), ctx('carrier'));
    g.tick(t + COVER_MS + 5);
    expect(g.move(3, 300, 420, t + 600)).toEqual([{ kind: 'cover', on: false }]);
    // a thumb that moved before the hold never covers
    g.down(at(4, 300, 400), ctx('carrier'));
    g.move(4, 330, 400, t + 50);
    expect(g.tick(t + COVER_MS + 50)).toEqual([]);
  });
});

describe('the second finger', () => {
  it('cycles the throw type during a slingshot drag, and is never the stick\'s finger', () => {
    const g = new Gestures();
    g.down(at(1, 80, 700), ctx('pocket'));
    g.down(at(2, 280, 420), ctx('pocket'));
    g.move(2, 270, 470, t + 40);
    expect(g.slingId()).toBe(2);
    // the stick's finger moving or lifting cycles nothing
    expect(g.move(1, 100, 690, t + 60)).toEqual([]);
    // a new finger on the field cycles
    expect(g.down(at(3, 330, 300), ctx('pocket'))).toEqual([{ kind: 'cycle' }]);
    expect(g.up(3, 330, 300, t + 80)).toEqual([]);
    // a new finger in the stick zone (while it's held) is not a cycle either
    expect(g.down(at(4, 60, 760), ctx('pocket'))).toEqual([]);
    // a control is still the control's
    expect(g.down(at(5, 250, 694, { ctl: 'C' }), ctx('pocket'))).toEqual([]);
    expect(g.up(2, 260, 520, t + 300)).toEqual([{ kind: 'sling-release', id: 2 }]);
    expect(g.down(at(6, 330, 300), ctx('pocket'))).toEqual([]);
  });
  it('cycles TOUCH, BULLET, LOB', () => {
    expect(nextPassType('touch')).toBe('bullet');
    expect(nextPassType('bullet')).toBe('lob');
    expect(nextPassType('lob')).toBe('touch');
  });
});

describe('burst', () => {
  it('comes from the ring by default and from D with the Burst-button preference, never both', () => {
    expect(burstHeld({ ring: true, button: false, buttonPref: false })).toBe(true);
    expect(burstHeld({ ring: false, button: true, buttonPref: false })).toBe(false);
    expect(burstHeld({ ring: true, button: false, buttonPref: true })).toBe(false);
    expect(burstHeld({ ring: false, button: true, buttonPref: true })).toBe(true);
  });
});
