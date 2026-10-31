// The game sounds: every recording is in place, each falls back to its synthesized stand-in until
// it's decoded, sound off stays silent, and the crowd runs on the recorded loop once it's there.
import { SAMPLES, _test, crowd, filesOf, sample, setFeedback, packSound, sfx, type SampleName } from './sound';

/** What a fake AudioContext was asked to make. */
interface Made {
  oscillators: number;
  sources: FakeSource[];
}

class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor(readonly context: FakeCtx) {}
  connect<T>(n: T): T {
    return n;
  }
}

class FakeSource extends FakeNode {
  buffer: { duration: number; name?: string } | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = new FakeParam();
  started: number[] | null = null;
  stopped = false;
  onended: (() => void) | null = null;
  start(when = 0, offset = 0) {
    this.started = [when, offset];
  }
  stop() {
    this.stopped = true;
  }
}

class FakeCtx {
  static made: Made = { oscillators: 0, sources: [] };
  currentTime = 10;
  sampleRate = 48000;
  state = 'running';
  destination = new FakeNode(this);
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  createGain() {
    return Object.assign(new FakeNode(this), { gain: new FakeParam() });
  }
  createOscillator() {
    FakeCtx.made.oscillators++;
    return Object.assign(new FakeNode(this), { type: 'sine', frequency: new FakeParam(), start() {}, stop() {} });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(this), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createDynamicsCompressor() {
    const p = () => new FakeParam();
    return Object.assign(new FakeNode(this), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() });
  }
  createBuffer(_ch: number, len: number, rate: number) {
    const data = new Float32Array(len);
    return { duration: len / rate, getChannelData: () => data };
  }
  createBufferSource() {
    const s = new FakeSource(this);
    FakeCtx.made.sources.push(s);
    return s;
  }
}

const g = globalThis as unknown as { window?: unknown };
const recorded = (name?: string) => FakeCtx.made.sources.filter((s) => s.buffer?.name && (!name || s.buffer.name === name));
const buffer = (name: string, duration = 0.5) => ({ name, duration }) as unknown as AudioBuffer;

beforeEach(() => {
  _test.reset();
  FakeCtx.made = { oscillators: 0, sources: [] };
  g.window = { AudioContext: FakeCtx };
});
afterEach(() => {
  _test.reset();
  delete g.window;
});

describe('the recordings', () => {
  const paths = Object.keys(import.meta.glob('../assets/sfx/*.mp3'));
  const onDisk = paths.map((p) => p.slice(p.lastIndexOf('/') + 1, -4));
  const named = new Set((Object.keys(SAMPLES) as SampleName[]).flatMap((n) => [...filesOf(n, 'arena'), ...filesOf(n, 'stadium')]));

  it('has a file for every sound, and no file nothing plays', () => {
    for (const f of named) expect(onDisk, f).toContain(f);
    for (const f of onDisk) expect(named.has(f), f).toBe(true);
  });

  it('gets a URL for every file from the bundler', () => {
    for (const f of named) expect(_test.urls[f], f).toMatch(/\.mp3/);
  });

  it('keeps the whole set small', async () => {
    // node's fs, untyped: the project has no node types
    const fs = (await import('node:fs' as string)) as { statSync(p: string): { size: number } };
    const dir = new URL('../assets/sfx/', import.meta.url).pathname;
    const bytes = onDisk.reduce((s, f) => s + fs.statSync(dir + f + '.mp3').size, 0);
    expect(bytes).toBeLessThan(1.2 * 1024 * 1024);
  });

  it('has an arena and a stadium version of the crowd', () => {
    expect(filesOf('crowd', 'arena')).toEqual(['crowd-arena']);
    expect(filesOf('crowd', 'stadium')).toEqual(['crowd-stadium']);
    expect(filesOf('roar', 'stadium')).toEqual(['roar-stadium']);
  });
});

describe('playing', () => {
  it('plays the synthesized stand-in until the recording is decoded', () => {
    sfx.swish();
    expect(recorded()).toHaveLength(0);
    // the stand-in is a noise burst: one buffer source with a made-up (unnamed) buffer
    expect(FakeCtx.made.sources).toHaveLength(1);

    _test.setBuffer('swish', buffer('swish'));
    FakeCtx.made.sources = [];
    sfx.swish();
    expect(recorded('swish')).toHaveLength(1);
    expect(FakeCtx.made.sources).toHaveLength(1);
  });

  it('falls back to tones for a sound whose recording is missing', () => {
    sfx.rim();
    expect(FakeCtx.made.oscillators).toBeGreaterThan(0);
    expect(recorded()).toHaveLength(0);
    _test.setBuffer('rim-1', buffer('rim-1'));
    FakeCtx.made.oscillators = 0;
    sfx.rim();
    expect(FakeCtx.made.oscillators).toBe(0);
    expect(recorded('rim-1')).toHaveLength(1);
  });

  it('wanders a little in pitch, and never repeats a variant twice running', () => {
    for (const f of ['squeak-1', 'squeak-2', 'squeak-3', 'squeak-4']) _test.setBuffer(f, buffer(f, 0.2));
    let last = '';
    const rates = new Set<number>();
    for (let i = 0; i < 40; i++) {
      sfx.squeak();
      const s = FakeCtx.made.sources[FakeCtx.made.sources.length - 1];
      expect(s.buffer!.name).not.toBe(last);
      last = s.buffer!.name!;
      const r = s.playbackRate.value;
      expect(r).toBeGreaterThanOrEqual(0.9);
      expect(r).toBeLessThanOrEqual(1.1);
      rates.add(r);
    }
    expect(rates.size).toBeGreaterThan(30);
  });

  it('picks the hit by its strength', () => {
    for (const f of ['hit-1', 'hit-2', 'hit-3']) _test.setBuffer(f, buffer(f, 0.4));
    sfx.hit(0);
    sfx.hit(0.5);
    sfx.hit(1);
    expect(recorded().map((s) => s.buffer!.name)).toEqual(['hit-1', 'hit-2', 'hit-3']);
  });

  it('stays silent with sound off', () => {
    _test.setBuffer('swish', buffer('swish'));
    setFeedback(false, true);
    sfx.swish();
    sfx.rim();
    sfx.whistle();
    sfx.roar();
    crowd.start(0.3);
    expect(FakeCtx.made.sources).toHaveLength(0);
    expect(FakeCtx.made.oscillators).toBe(0);
    expect(sample('swish')).toBeNull();
    setFeedback(true, true);
    sfx.swish();
    expect(recorded('swish')).toHaveLength(1);
  });

  it('cheers a score once, though the score and the crowd both ask', () => {
    // this sport's cheer (the arena's for basketball, the stadium's for football)
    const f = filesOf('cheer')[0];
    _test.setBuffer(f, buffer(f, 4));
    sfx.scoreUs(true);
    crowd.start(0.3);
    crowd.swell(1);
    expect(recorded(f)).toHaveLength(1);
    // a bigger moment right after still gets its roar
    _test.setBuffer(filesOf('roar')[0], buffer(filesOf('roar')[0], 5));
    sfx.roar();
    expect(recorded(filesOf('roar')[0])).toHaveLength(1);
  });
});

describe('the crowd', () => {
  it('runs on noise until the venue loop is decoded, then hands over to it', () => {
    crowd.start(0.3, 'stadium');
    expect(_test.bed()?.recorded).toBe(false);
    const noise = FakeCtx.made.sources[0];
    expect(noise.loop).toBe(true);

    _test.setBuffer('crowd-stadium', buffer('crowd-stadium', 10.6));
    const bed = _test.bed();
    expect(bed?.recorded).toBe(true);
    expect(bed?.venue).toBe('stadium');
    expect(noise.stopped).toBe(true);
    const loop = recorded('crowd-stadium')[0];
    expect(loop.loop).toBe(true);
    // the seamless stretch of the file, 10 s from 0.3 s
    expect(loop.loopStart).toBeCloseTo(0.3);
    expect(loop.loopEnd).toBeCloseTo(10.3);
  });

  it('starts on the recorded loop when it is ready, and swells and stops', () => {
    _test.setBuffer('crowd-arena', buffer('crowd-arena', 10.6));
    crowd.start(0.24, 'arena');
    const bed = _test.bed()!;
    expect(bed.recorded).toBe(true);
    crowd.swell(0.2);
    crowd.level(0.5);
    expect(bed.out.gain.value).toBeCloseTo(0.5 * bed.max);
    crowd.stop(0.5);
    expect(_test.bed()).toBeNull();
    expect(recorded('crowd-arena')[0].stopped).toBe(true);
  });

  it('turning sound off stops it', () => {
    _test.setBuffer('crowd-arena', buffer('crowd-arena', 10.6));
    crowd.start(0.3, 'arena');
    setFeedback(false, true);
    expect(_test.bed()).toBeNull();
  });
});

describe('Codex pack score', () => {
  it('creates bounded cues that can be stopped repeatedly without recordings', () => {
    setFeedback(true, false);
    for (const cue of ['charge', 'surge', 'reveal'] as const) {
      const stop = packSound(cue, true);
      stop();
      stop();
    }
    expect(FakeCtx.made.oscillators).toBeGreaterThan(0);
    expect(recorded()).toHaveLength(0);
  });
  it('obeys sound-off before allocating any cue', () => {
    setFeedback(false, false);
    packSound('surge', true)();
    packSound('reveal', true)();
    expect(FakeCtx.made.oscillators).toBe(0);
  });
});
