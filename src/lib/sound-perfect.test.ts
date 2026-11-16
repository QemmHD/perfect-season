// Game Design V2's shared ring sounds (Claude 2026-11-16, studio overhaul soccer-1): sfx.perfect
// rises a semitone per PERFECT in a row and stops at +4, sfx.ringTick climbs two semitones a tick,
// sfx.post clangs; all synthesized (nothing fetched but the existing crowd "ooh") and silent with the
// sound off. The contract is in docs/studio-overhaul/soccer.md §5.0.1 a.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _test, PERFECT_MAX_STEP, PERFECT_ROOT, perfectStep, RING_TICK, setFeedback, sfx } from './sound';

class Param {
  value = 0;
  constructor(private readonly log?: number[]) {}
  setValueAtTime(v: number) {
    this.value = v;
    this.log?.push(v);
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}
class Node {
  constructor(readonly context: Ctx) {}
  connect<T>(n: T): T {
    return n;
  }
}
/** A fake AudioContext that logs every oscillator's start frequency and when it starts. */
class Ctx {
  static osc: { f: number; at: number }[] = [];
  static nodes = 0;
  currentTime = 5;
  sampleRate = 8000;
  state = 'running';
  destination = new Node(this);
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  createGain() {
    Ctx.nodes++;
    return Object.assign(new Node(this), { gain: new Param() });
  }
  createOscillator() {
    Ctx.nodes++;
    const log: number[] = [];
    const o = Object.assign(new Node(this), {
      type: 'sine',
      frequency: new Param(log),
      start: (at: number) => Ctx.osc.push({ f: log[0], at }),
      stop() {},
    });
    return o;
  }
  createBiquadFilter() {
    Ctx.nodes++;
    return Object.assign(new Node(this), { type: 'lowpass', frequency: new Param(), Q: new Param() });
  }
  createDynamicsCompressor() {
    Ctx.nodes++;
    const p = () => new Param();
    return Object.assign(new Node(this), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() });
  }
  createBuffer(_ch: number, len: number, rate: number) {
    Ctx.nodes++;
    const data = new Float32Array(len);
    return { duration: len / rate, getChannelData: () => data };
  }
  createBufferSource() {
    Ctx.nodes++;
    return Object.assign(new Node(this), { buffer: null, playbackRate: new Param(), start() {}, stop() {}, onended: null });
  }
}

const g = globalThis as unknown as { window?: unknown; fetch?: unknown };
const realFetch = g.fetch;
let fetched: string[] = [];
const semitones = (f: number, ref: number) => Math.round(12 * Math.log2(f / ref) * 100) / 100;

beforeEach(() => {
  _test.reset();
  setFeedback(true, true);
  Ctx.osc = [];
  Ctx.nodes = 0;
  fetched = [];
  g.window = { AudioContext: Ctx };
  g.fetch = vi.fn((url: string) => {
    fetched.push(String(url));
    return new Promise(() => {});
  });
});
afterEach(() => {
  _test.reset();
  setFeedback(true, true);
  delete g.window;
  g.fetch = realFetch;
});

describe('sfx.perfect: the PERFECT chime', () => {
  it('is a root and its fifth 70 ms later, about 180 ms in all', () => {
    sfx.perfect();
    const [root, fifth] = Ctx.osc;
    expect(root.f).toBeCloseTo(PERFECT_ROOT, 6);
    expect(semitones(fifth.f, root.f)).toBe(7);
    expect(fifth.at - root.at).toBeCloseTo(0.07, 6);
  });

  it('rises a semitone per PERFECT in a row, and stops at +4', () => {
    const roots: number[] = [];
    for (let streak = 1; streak <= 9; streak++) {
      Ctx.osc = [];
      sfx.perfect(streak);
      roots.push(semitones(Ctx.osc[0].f, PERFECT_ROOT));
      // the fifth goes up with it
      expect(semitones(Ctx.osc[1].f, Ctx.osc[0].f)).toBe(7);
    }
    expect(roots).toEqual([0, 1, 2, 3, 4, 4, 4, 4, 4]);
    expect(PERFECT_MAX_STEP).toBe(4);
  });

  it('treats a missing, zero, fractional or nonsense streak as a first PERFECT or the nearest below', () => {
    expect([undefined, 0, -3, 1, 1.9, 2.2, NaN, Infinity, 100].map((s) => perfectStep(s as number))).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 4]);
  });
});

describe('sfx.ringTick: a closing ring', () => {
  it('climbs two semitones a tick over four ticks, and holds the last', () => {
    const steps = [0, 1, 2, 3, 4, -1].map((i) => {
      Ctx.osc = [];
      sfx.ringTick(i);
      expect(Ctx.osc).toHaveLength(1);
      return semitones(Ctx.osc[0].f, RING_TICK);
    });
    expect(steps).toEqual([0, 2, 4, 6, 6, 0]);
  });
});

describe('sfx.post: off the woodwork', () => {
  it('clangs on several inharmonic partials', () => {
    sfx.post();
    const fs = Ctx.osc.map((o) => o.f);
    expect(fs.length).toBeGreaterThanOrEqual(3);
    // a struck tube, not a chord: the partials aren't whole-number multiples of the lowest
    const lo = Math.min(...fs);
    expect(fs.filter((f) => f !== lo).some((f) => Math.abs(f / lo - Math.round(f / lo)) > 0.1)).toBe(true);
  });
});

describe('no files and no sound when it is off', () => {
  it('the chime and the tick fetch nothing; the clang only asks for the existing crowd "ooh"', async () => {
    sfx.perfect(3);
    sfx.ringTick(2);
    await Promise.resolve();
    expect(fetched).toEqual([]);
    sfx.post();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched.every((u) => /\/ooh[.-]/.test(u))).toBe(true);
  });

  it('makes no audio nodes at all with the sound off', () => {
    setFeedback(false, true);
    sfx.perfect(2);
    sfx.ringTick(1);
    sfx.post();
    expect(Ctx.nodes).toBe(0);
    expect(Ctx.osc).toEqual([]);
    expect(fetched).toEqual([]);
  });
});
