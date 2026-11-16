// The feel of the court (plan §3.13): a double on every PERFECT, a long on a score (and a block or a
// turnover against you), nothing at all while the game is paused. A spy on the haptics shim.
import { vi } from 'vitest';

const fired: string[] = [];
vi.mock('../hud/feel', () => ({ haptic: (p: string) => fired.push(p) }));

const { feelOf, playFeel } = await import('./feel-events');

beforeEach(() => {
  fired.length = 0;
});

describe('court haptics', () => {
  it('a double on every PERFECT (a jumper in gold, a finish in gold)', () => {
    playFeel(['rise', 'release-green', 'fga:0:three:3'], { paused: false });
    playFeel(['finish:layup:make', 'finish-green'], { paused: false });
    expect(fired).toEqual(['double', 'double']);
  });
  it('a long on a score, a block and a turnover; nothing for the rest', () => {
    playFeel(['pass', 'catch', 'end:make'], { paused: false });
    playFeel(['blocked:6'], { paused: false });
    for (const k of ['steal', 'int', 'clock', 'out']) playFeel(['end:' + k], { paused: false });
    playFeel(['end:miss', 'rim', 'release', 'scheme:man'], { paused: false });
    expect(fired).toEqual(['long', 'long', 'long', 'long', 'long', 'long']);
  });
  it('a PERFECT three that drops: the double, then the long', () => {
    expect(feelOf(['release-green', 'end:make'])).toEqual(['double', 'long']);
  });
  it('none while paused', () => {
    expect(playFeel(['release-green', 'end:make', 'blocked:5', 'end:steal'], { paused: true })).toEqual([]);
    expect(fired).toEqual([]);
  });
  it("a release's double already played inside the touch is not played again", () => {
    playFeel(['release-green', 'end:make'], { paused: false, doubleDone: true });
    expect(fired).toEqual(['long']);
  });
});
