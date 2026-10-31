/* Sound effects (Web Audio) and vibration.

   The menus' clicks, coins and card sounds are synthesized: no files. The games play real
   recordings (src/assets/sfx, made by scripts/build_sfx.py, credits in docs/CREDITS.md): the
   first tap unlocks audio and starts fetching and decoding them, the arena's set for basketball
   and the stadium's for football (any other one loads the first time it's asked for). Until a
   recording is ready, or if it can't be decoded, its synthesized stand-in plays instead. Each play
   wanders a little in pitch and volume so repeats don't sound canned. */

import { NFL } from '../engine/sport';

let ctx: AudioContext | null = null;
let soundOn = true;
let hapticsOn = true;

export function setFeedback(sound: boolean, haptics: boolean) {
  soundOn = sound;
  hapticsOn = haptics;
  if (!sound) crowd.stop();
}

// a hidden page (another app, a locked phone) goes quiet, and picks up where it was when it's back
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else if (soundOn) void ctx.resume().catch(() => {});
  });

function ac(): AudioContext | null {
  if (!soundOn) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    // iOS reports 'interrupted' after a call or Siri
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slide?: number } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
  const peak = opts.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, opts: { gain?: number; at?: number; freq?: number } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.at ?? 0);
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  const g = c.createGain();
  g.gain.value = opts.gain ?? 0.12;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let iosSwitch: HTMLLabelElement | null = null;

/* iPhones have no vibration API, but Safari 18 plays a light haptic tick when a
   switch-style checkbox toggles. A hidden one gives us taps on iOS. */
function iosTick() {
  try {
    if (!iosSwitch) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-60px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch {
    // not supported
  }
}

export function vibrate(pattern: number | number[]) {
  if (!hapticsOn) return;
  try {
    if (typeof navigator.vibrate === 'function' && !IOS) {
      navigator.vibrate(pattern);
      return;
    }
  } catch {
    // not supported
  }
  if (!IOS) return;
  // one tick per pulse of the pattern
  const p = Array.isArray(pattern) ? pattern : [pattern];
  let t = 0;
  for (let i = 0; i < p.length; i += 2) {
    if (t === 0) iosTick();
    else window.setTimeout(iosTick, t);
    t += p[i] + (p[i + 1] ?? 0);
  }
}

/* ---------------------------------------------------------------------------------------------
   Recordings */

export type Venue = 'arena' | 'stadium';

interface SampleDef {
  /** file names in src/assets/sfx (no .mp3), one picked at random each play; or one list per venue */
  files: string[] | Record<Venue, string[]>;
  /** playback gain */
  gain: number;
  /** loaded up front only for this venue (any sound still loads the first time it's asked for) */
  only?: Venue;
  /** how far pitch and volume wander each play (a share, ±) */
  pitch?: number;
  vol?: number;
}

/** Every recording the games play. */
export const SAMPLES = {
  crowd: { files: { arena: ['crowd-arena'], stadium: ['crowd-stadium'] }, gain: 1, pitch: 0, vol: 0 },
  cheer: { files: { arena: ['cheer-arena'], stadium: ['cheer-stadium'] }, gain: 0.3, pitch: 0.03 },
  roar: { files: { arena: ['roar-arena'], stadium: ['roar-stadium'] }, gain: 0.6, pitch: 0.02 },
  ooh: { files: ['ooh'], gain: 0.34, pitch: 0.05 },
  groan: { files: ['groan'], gain: 0.32, pitch: 0.04 },
  whistle: { files: ['whistle'], gain: 0.6, pitch: 0.02, vol: 0.08 },
  buzzer: { files: ['buzzer'], gain: 0.6, pitch: 0, vol: 0 },
  catch: { files: ['catch-1', 'catch-2'], gain: 0.45 },
  squeak: { files: ['squeak-1', 'squeak-2', 'squeak-3', 'squeak-4'], gain: 0.35, only: 'arena', pitch: 0.1, vol: 0.3 },
  dribble: { files: ['dribble-1', 'dribble-2', 'dribble-3'], gain: 0.5, only: 'arena', pitch: 0.05, vol: 0.2 },
  swish: { files: ['swish'], gain: 0.6, only: 'arena', pitch: 0.06 },
  rim: { files: ['rim-1', 'rim-2'], gain: 0.55, only: 'arena', pitch: 0.06 },
  backboard: { files: ['backboard'], gain: 0.55, only: 'arena', pitch: 0.05 },
  dunk: { files: ['dunk'], gain: 0.75, only: 'arena', pitch: 0.04 },
  hit: { files: ['hit-1', 'hit-2', 'hit-3'], gain: 0.7, only: 'stadium', pitch: 0.06 },
  thud: { files: ['thud'], gain: 0.55, only: 'stadium', pitch: 0.08 },
  kick: { files: ['kick'], gain: 0.6, only: 'stadium', pitch: 0.04 },
  horn: { files: ['horn'], gain: 0.6, only: 'stadium', pitch: 0, vol: 0 },
} satisfies Record<string, SampleDef>;

export type SampleName = keyof typeof SAMPLES;

// Vite gives each file a hashed name (the service worker precaches them). The single-page artifact
// build has no room for them, so it keeps the synthesized sounds.
const URLS: Record<string, string> = {};
if (import.meta.env.MODE !== 'artifact') {
  const found = import.meta.glob<string>('../assets/sfx/*.mp3', { eager: true, query: '?url', import: 'default' });
  for (const [path, url] of Object.entries(found)) URLS[path.slice(path.lastIndexOf('/') + 1, -4)] = url;
}

/** The files a sound plays at a venue. */
export function filesOf(name: SampleName, v: Venue = venue): string[] {
  const f = (SAMPLES[name] as SampleDef).files;
  return Array.isArray(f) ? f : f[v];
}

let venue: Venue = NFL ? 'stadium' : 'arena';
const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<void>>();
// a file that wouldn't load (offline before it was cached) is tried again after a while
const failed = new Map<string, number>();

function decode(c: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // the callback form too: older Safari has no promise version
  return new Promise((resolve, reject) => {
    try {
      const p = c.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
      if (p && typeof p.catch === 'function') p.catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

let queue: Promise<unknown> = Promise.resolve();

/** Fetch and decode one file (once); decodes run one at a time so a phone stays smooth. */
function loadFile(file: string): Promise<void> {
  const known = pending.get(file);
  if (known) return known;
  const url = URLS[file];
  const c = ac();
  if (!url || !c || buffers.has(file) || typeof fetch !== 'function' || Date.now() - (failed.get(file) ?? -1e9) < 30000) return Promise.resolve();
  const job = queue
    .then(() => fetch(url))
    .then((r) => {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return r.arrayBuffer();
    })
    .then((data) => decode(c, data))
    .then((buf) => {
      buffers.set(file, buf);
      loaded(file);
    })
    .catch(() => {
      failed.set(file, Date.now());
      pending.delete(file);
    });
  queue = job;
  pending.set(file, job);
  return job;
}

/** Load a venue's recordings: the crowd first, then the rest. Safe to call any time. */
export function loadSamples(v: Venue = venue): Promise<void> {
  const order: SampleName[] = ['crowd', 'whistle', 'cheer', 'roar'];
  for (const n of Object.keys(SAMPLES) as SampleName[]) if (!order.includes(n)) order.push(n);
  const jobs: Promise<void>[] = [];
  for (const n of order) {
    const d = SAMPLES[n] as SampleDef;
    if (d.only && d.only !== v) continue;
    for (const f of filesOf(n, v)) jobs.push(loadFile(f));
  }
  return Promise.all(jobs).then(() => {});
}

/** What's decoded so far: file name and seconds (for checking a build). */
export function loadedSamples(): { name: string; seconds: number }[] {
  return [...buffers].map(([name, b]) => ({ name, seconds: Math.round(b.duration * 100) / 100 }));
}

// recordings go through a gentle compressor, so a roar on top of a hit on top of the crowd doesn't
// clip, at a master gain that sits them a few dB over the synthesized sounds they replace
// (the compressor adds about 5.6 dB of make-up gain of its own)
const REC_GAIN = 0.25;
let bus: GainNode | null = null;
function busOf(c: AudioContext): AudioNode {
  if (!bus || bus.context !== c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    bus = c.createGain();
    bus.gain.value = REC_GAIN;
    bus.connect(comp).connect(c.destination);
  }
  return bus;
}

const lastFile = new Map<SampleName, string>();

/**
 * Play a recording. Returns null when it isn't decoded (yet), so the caller plays its stand-in;
 * asking for one that isn't loaded starts loading it.
 */
export function sample(name: SampleName, opts: { gain?: number; rate?: number; at?: number; variant?: number } = {}): { src: AudioBufferSourceNode; gain: GainNode } | null {
  const c = ac();
  if (!c) return null;
  const d = SAMPLES[name] as SampleDef;
  const files = filesOf(name);
  let file: string | undefined;
  if (opts.variant !== undefined) file = files[Math.max(0, Math.min(files.length - 1, opts.variant))];
  else {
    const ready = files.filter((f) => buffers.has(f));
    if (ready.length > 1) {
      // not the same one twice running
      const pool = ready.filter((f) => f !== lastFile.get(name));
      file = pool[Math.floor(Math.random() * pool.length)];
    } else file = ready[0];
  }
  const buf = file ? buffers.get(file) : undefined;
  if (!file || !buf) {
    for (const f of files) void loadFile(f);
    return null;
  }
  lastFile.set(name, file);
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    const p = d.pitch ?? 0.04;
    const v = d.vol ?? 0.12;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * p);
    const g = c.createGain();
    g.gain.value = Math.max(0, d.gain * (opts.gain ?? 1) * (1 + (Math.random() * 2 - 1) * v));
    src.connect(g).connect(busOf(c));
    src.start(c.currentTime + (opts.at ?? 0));
    return { src, gain: g };
  } catch {
    return null;
  }
}

/* The crowd's reactions (cheers, the roar, an ooh, a groan) as recordings. One within a moment of
   another only plays if it's bigger, so a score that both cheers and swells the crowd cheers once. */
let reactAt = -9;
let reactSize = 0;
const reactions = new Set<{ src: AudioBufferSourceNode; gain: GainNode }>();

function react(name: 'cheer' | 'roar' | 'ooh' | 'groan', size: number, gain = 1, hold = 0): boolean {
  const c = ac();
  if (!c) return false;
  const now = c.currentTime;
  if (now - reactAt < 0.7 && size < reactSize + 0.4) return true;
  const n = sample(name, { gain });
  if (!n) return false;
  reactAt = now;
  reactSize = size;
  reactions.add(n);
  n.src.onended = () => reactions.delete(n);
  if (hold) {
    // a short one: the crowd settles before the recording would
    n.gain.gain.setTargetAtTime(0.0001, now + hold, 0.35);
    n.src.stop(now + hold + 1.6);
  }
  return true;
}

/** The crowd cheers a play, louder and longer the bigger it is (0-1.5); false when the cheer isn't loaded. */
function cheer(x: number): boolean {
  if (x < 0.35) return false;
  return react('cheer', x, Math.pow(Math.min(1.4, x), 0.8), 0.7 + 1.5 * Math.min(1, x));
}

const DUNKS = ['dunk', 'contact', 'standdunk', 'oop'];

export const sfx = {
  click: () => tone(660, 0.05, { type: 'triangle', gain: 0.06 }),
  spinStart: () => {
    noise(0.25, { gain: 0.08, freq: 900 });
    tone(220, 0.25, { type: 'sawtooth', gain: 0.03, slide: 2.2 });
  },
  tick: () => tone(1400, 0.025, { type: 'square', gain: 0.025 }),
  stop: () => {
    tone(140, 0.12, { type: 'triangle', gain: 0.22, slide: 0.6 });
    noise(0.06, { gain: 0.06, freq: 2500 });
    vibrate(12);
  },
  select: () => {
    tone(880, 0.06, { type: 'triangle', gain: 0.08 });
    vibrate(8);
  },
  place: () => {
    tone(196, 0.16, { type: 'sine', gain: 0.25, slide: 0.7 });
    tone(1046, 0.08, { type: 'triangle', gain: 0.06, at: 0.02 });
    vibrate(18);
  },
  nope: () => {
    tone(180, 0.12, { type: 'square', gain: 0.05 });
    vibrate([10, 60, 10]);
  },
  coin: () => {
    tone(1318, 0.08, { type: 'square', gain: 0.05 });
    tone(1760, 0.14, { type: 'square', gain: 0.05, at: 0.07 });
  },
  tickerWin: () => tone(990, 0.03, { type: 'triangle', gain: 0.03 }),
  tickerLoss: () => tone(330, 0.03, { type: 'triangle', gain: 0.03 }),
  gameWin: () => {
    tone(784, 0.1, { type: 'triangle', gain: 0.09 });
    vibrate(8);
  },
  gameLoss: () => tone(220, 0.14, { type: 'sawtooth', gain: 0.05 }),
  seriesWin: () => {
    [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.1, at: i * 0.09 }));
    vibrate([20, 40, 20]);
  },
  seriesLoss: () => {
    [392, 330, 262].forEach((f, i) => tone(f, 0.22, { type: 'sawtooth', gain: 0.05, at: i * 0.12 }));
    vibrate(60);
  },
  result: (letter: string) => {
    const big = letter.startsWith('S');
    const good = big || letter.startsWith('A') || letter === 'B';
    const notes = big ? [523, 659, 784, 1046, 1318] : good ? [523, 659, 784, 1046] : letter === 'F' ? [330, 294, 262] : [440, 523, 659];
    notes.forEach((f, i) => tone(f, big ? 0.3 : 0.2, { type: 'triangle', gain: 0.11, at: i * 0.1 }));
    vibrate(big ? [30, 50, 30, 50, 60] : good ? [30, 40, 30] : 40);
  },
  levelUp: () => {
    [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.14, { type: 'square', gain: 0.05, at: i * 0.08 }));
    vibrate([20, 30, 20]);
  },
  heartbeat: () => {
    tone(70, 0.12, { type: 'sine', gain: 0.35, slide: 0.8 });
    tone(64, 0.12, { type: 'sine', gain: 0.25, slide: 0.8, at: 0.16 });
    vibrate([12, 140, 10]);
  },
  stamp: () => {
    tone(110, 0.22, { type: 'sine', gain: 0.35, slide: 0.5 });
    noise(0.12, { gain: 0.1, freq: 600 });
    vibrate(24);
  },
  whoosh: () => noise(0.22, { gain: 0.05, freq: 1800 }),
  /** a value adding onto the team rating: each one a step higher */
  count: (i: number) => tone(523 * Math.pow(2, i / 6), 0.09, { type: 'triangle', gain: 0.07 }),
  /** the game is on: a referee's whistle */
  whistle: () => {
    if (sample('whistle')) return;
    tone(2900, 0.28, { type: 'sine', gain: 0.05 });
    tone(2960, 0.28, { type: 'sine', gain: 0.04 });
  },
  /** we scored: a quick rising sting and the crowd */
  scoreUs: (big = false) => {
    tone(784, 0.08, { type: 'triangle', gain: 0.07 });
    tone(1175, 0.12, { type: 'triangle', gain: 0.07, at: 0.06 });
    if (!cheer(big ? 0.9 : 0.5)) noise(big ? 0.9 : 0.45, { gain: big ? 0.07 : 0.04, freq: 900 });
    if (big) vibrate([18, 40, 18]);
  },
  /** they scored: a low thud */
  scoreThem: () => tone(150, 0.16, { type: 'sine', gain: 0.18, slide: 0.7 }),
  /** the final buzzer, or the clock running out */
  buzzer: () => {
    if (!sample('buzzer')) tone(196, 0.55, { type: 'square', gain: 0.045 });
  },
  /** a stadium on its feet */
  roar: () => {
    if (!react('roar', 1.5)) {
      noise(1.6, { gain: 0.09, freq: 700 });
      noise(1.2, { gain: 0.05, freq: 1600, at: 0.1 });
    }
    vibrate([30, 50, 30, 50, 60]);
  },
  title: () => {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.12, at: i * 0.11 }));
    vibrate([40, 60, 40, 60, 120]);
  },

  /* ---- the games: recordings, with a synthesized stand-in until they're loaded ---- */

  /** the crowd cheers a play: 0.35 a nice one .. 1 a big one (quieter plays only lift the crowd) */
  cheer: (x = 0.7) => {
    if (!cheer(x) && x >= 0.35) noise(0.5 + x * 0.4, { gain: 0.03 + x * 0.04, freq: 900 });
  },
  /** the crowd's "oooh": a block, a broken ankle, a near thing */
  ooh: () => {
    if (!react('ooh', 1)) {
      tone(330, 0.6, { type: 'sine', gain: 0.04, slide: 1.25 });
      noise(0.6, { gain: 0.04, freq: 700 });
    }
  },
  /** the crowd's groan: a miss, a turnover */
  groan: (x = 1) => {
    if (!react('groan', 0.6 * x, x)) tone(260, 0.5, { type: 'sine', gain: 0.03 * x, slide: 0.7 });
  },
  /** a sneaker on the court */
  squeak: () => {
    if (!sample('squeak')) tone(1900 + Math.random() * 500, 0.08, { type: 'sine', gain: 0.02, slide: 1.3 });
  },
  /** the ball off the floor (hard: a pound dribble) */
  dribble: (hard = false) => {
    if (!sample('dribble', { gain: hard ? 1.3 : 1 })) tone(95, 0.08, { type: 'sine', gain: hard ? 0.22 : 0.15, slide: 0.7 });
  },
  /** nothing but net */
  swish: () => {
    if (!sample('swish')) noise(0.28, { gain: 0.05, freq: 3200 });
  },
  /** off the rim */
  rim: () => {
    if (sample('rim')) return;
    tone(520, 0.2, { type: 'triangle', gain: 0.07 });
    tone(1410, 0.12, { type: 'sine', gain: 0.025 });
    noise(0.05, { gain: 0.05, freq: 900 });
  },
  /** off the glass */
  backboard: () => {
    if (sample('backboard')) return;
    tone(120, 0.16, { type: 'sine', gain: 0.2, slide: 0.7 });
    noise(0.12, { gain: 0.07, freq: 1500 });
  },
  /** a dunk: the rim takes it, the net snaps */
  dunk: () => {
    if (!sample('dunk')) {
      tone(480, 0.25, { type: 'triangle', gain: 0.08 });
      noise(0.3, { gain: 0.06, freq: 2600, at: 0.04 });
    }
    vibrate([25, 40, 25]);
  },
  /** a made basket: the net (or the rim on a dunk), the sting and the crowd */
  bucket: (shot?: string, big = false) => {
    if (shot && DUNKS.includes(shot)) {
      if (!sample('dunk')) noise(0.3, { gain: 0.06, freq: 2600 });
    } else if (!sample('swish')) noise(0.28, { gain: 0.05, freq: 3200 });
    sfx.scoreUs(big);
  },
  /** a block: a hand on the ball and the crowd's "oooh" */
  block: () => {
    if (!sample('catch', { variant: 1, gain: 1.6 })) noise(0.05, { gain: 0.12, freq: 1800 });
    sfx.ooh();
    vibrate(30);
  },
  /** the ball into hands */
  catch: () => {
    if (!sample('catch')) noise(0.04, { gain: 0.09, freq: 1600 });
    vibrate(10);
  },
  /** pads and helmets: strength 0 (a wrap-up) .. 1 (a big hit) */
  hit: (strength = 0.5) => {
    const s = Math.max(0, Math.min(1, strength));
    if (!sample('hit', { variant: s < 0.35 ? 0 : s < 0.75 ? 1 : 2, gain: 0.75 + s * 0.4 })) {
      tone(140, 0.12, { type: 'triangle', gain: 0.18 + s * 0.08, slide: 0.6 });
      noise(0.06, { gain: 0.05 + s * 0.03, freq: 2500 });
    }
    vibrate(Math.round(12 + s * 24));
  },
  /** a body on the turf */
  thud: (at = 0) => {
    if (!sample('thud', { at })) tone(90, 0.14, { type: 'sine', gain: 0.2, slide: 0.6, at });
  },
  /** a tackle: the hit, then both of them on the ground */
  tackle: (strength = 0.5) => {
    sfx.hit(strength);
    sfx.thud(0.16 + Math.random() * 0.06);
  },
  /** boot on ball (at: seconds from now, for the leg to come through) */
  kick: (at = 0) => {
    if (!sample('kick', { at })) tone(110, 0.1, { type: 'sine', gain: 0.25, slide: 0.6, at });
  },
  /** the stadium horn */
  horn: () => {
    if (sample('horn')) return;
    tone(147, 1.1, { type: 'sawtooth', gain: 0.03 });
    tone(185, 1.1, { type: 'sawtooth', gain: 0.025 });
  },
  /** six points: the horn and the stadium (the sting stands in until the horn's loaded) */
  touchdown: () => {
    if (!sample('horn')) {
      tone(784, 0.08, { type: 'triangle', gain: 0.07 });
      tone(1175, 0.12, { type: 'triangle', gain: 0.07, at: 0.06 });
    }
    if (!react('roar', 1.5)) noise(0.9, { gain: 0.07, freq: 900 });
    vibrate([18, 40, 18]);
  },
};

/* ---------------------------------------------------------------------------------------------
   The crowd under a live game: the venue's recorded crowd on a loop, or (until that's loaded)
   a loop of shaped noise. The game sets how loud it sits; a play makes it swell and settle, and
   with the recordings loaded the crowd cheers it too. */

interface Bed {
  out: GainNode;
  nodes: AudioScheduledSourceNode[];
  /** gain at level 1 */
  max: number;
  recorded: boolean;
  venue: Venue;
}

let bed: Bed | null = null;
let crowdLevel = 0.3;
const CROWD_MAX = 0.11;
const CROWD_REC_MAX = 0.42;
// the loop files are 10 s of crowd, then their first 0.6 s again: loop 0.3 .. 10.3 s
const LOOP_FROM = 0.3;
const LOOP_LEN = 10;

function synthBed(c: AudioContext, v: Venue): Bed {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    // pink-ish noise (Paul Kellet's filter), so it rumbles rather than hisses
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    // fade the loop's seam
    for (let i = 0; i < 2000; i++) {
      const k = i / 2000;
      d[i] *= k;
      d[len - 1 - i] *= k;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lo = c.createBiquadFilter();
  lo.type = 'bandpass';
  lo.frequency.value = 520;
  lo.Q.value = 0.7;
  const hi = c.createBiquadFilter();
  hi.type = 'bandpass';
  hi.frequency.value = 1700;
  hi.Q.value = 0.9;
  const hiGain = c.createGain();
  hiGain.gain.value = 0.45;
  const murmur = c.createGain();
  murmur.gain.value = 1;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.23;
  const depth = c.createGain();
  depth.gain.value = 0.22;
  lfo.connect(depth).connect(murmur.gain);
  const out = c.createGain();
  out.gain.value = 0.0001;
  src.connect(lo).connect(murmur);
  src.connect(hi).connect(hiGain).connect(murmur);
  murmur.connect(out).connect(c.destination);
  src.start();
  lfo.start();
  return { out, nodes: [src, lfo], max: CROWD_MAX, recorded: false, venue: v };
}

function recordedBed(c: AudioContext, buf: AudioBuffer, v: Venue): Bed {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = LOOP_FROM;
  src.loopEnd = Math.min(buf.duration, LOOP_FROM + LOOP_LEN);
  const out = c.createGain();
  out.gain.value = 0.0001;
  src.connect(out).connect(busOf(c));
  // start somewhere in the loop, so it isn't the same crowd every game
  src.start(c.currentTime, LOOP_FROM + Math.random() * (src.loopEnd - LOOP_FROM));
  return { out, nodes: [src], max: CROWD_REC_MAX, recorded: true, venue: v };
}

function newBed(c: AudioContext, v: Venue): Bed | null {
  const file = filesOf('crowd', v)[0];
  const buf = buffers.get(file);
  try {
    if (buf) return recordedBed(c, buf, v);
    void loadFile(file);
    return synthBed(c, v);
  } catch {
    return null;
  }
}

function fadeOut(b: Bed, c: AudioContext, fade: number) {
  const t = c.currentTime;
  try {
    b.out.gain.cancelScheduledValues(t);
    b.out.gain.setTargetAtTime(0.0001, t, fade / 3);
    for (const n of b.nodes) n.stop(t + fade + 0.2);
  } catch {
    // already stopped
  }
}

/** A recording just finished decoding: a noise crowd that was standing in hands over to it. */
function loaded(file: string) {
  const c = ctx;
  if (!c || !bed || bed.recorded || filesOf('crowd', bed.venue)[0] !== file) return;
  const old = bed;
  const next = newBed(c, old.venue);
  if (!next) return;
  bed = next;
  fadeOut(old, c, 1.5);
  next.out.gain.setTargetAtTime(Math.max(0.0002, crowdLevel * next.max), c.currentTime, 0.5);
}

export const crowd = {
  /** the crowd comes in (level 0-1), the arena's for basketball, the stadium's for football */
  start(level = 0.3, v: Venue = venue) {
    const c = ac();
    if (!c) return;
    crowdLevel = level;
    if (bed && bed.venue === v) {
      crowd.level(level);
      return;
    }
    if (bed) crowd.stop(0.5);
    bed = newBed(c, v);
    if (bed) bed.out.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * bed.max), c.currentTime + 1.2);
  },
  /** how loud the crowd sits, 0-1: louder late in a close game */
  level(x: number) {
    crowdLevel = Math.max(0, Math.min(1, x));
    if (!bed || !ctx) return;
    const g = bed.out.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(Math.max(0.0002, crowdLevel * bed.max), ctx.currentTime, 0.5);
  },
  /** a play: the crowd jumps up (and cheers it), then settles back */
  swell(x = 1) {
    if (!bed || !ctx) return;
    const g = bed.out.gain;
    const t = ctx.currentTime;
    const peak = Math.max(crowdLevel, Math.min(1.6, crowdLevel + x)) * bed.max;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(peak, t, 0.06);
    g.setTargetAtTime(Math.max(0.0002, crowdLevel * bed.max), t + 0.5 + x * 0.6, 0.7);
    cheer(x);
  },
  stop(fade = 0.8) {
    const b = bed;
    bed = null;
    if (!ctx) return;
    if (b) fadeOut(b, ctx, fade);
    // and the cheers still ringing out
    const t = ctx.currentTime;
    for (const r of reactions) {
      try {
        r.gain.gain.cancelScheduledValues(t);
        r.gain.gain.setTargetAtTime(0.0001, t, fade / 3);
        r.src.stop(t + fade + 0.2);
      } catch {
        // already stopped
      }
    }
    reactions.clear();
  },
};

/* Taps unlock audio: the first one with sound on (iOS also wants a sound started inside the tap)
   starts loading this sport's recordings, and any tap wakes audio the phone has suspended (a call,
   Siri, coming back to the app), so the crowd is back even before the next sound effect. */
const GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'] as const;
let loadStarted = false;
function unlock() {
  if (ctx && ctx.state === 'running' && loadStarted) return;
  const c = ac();
  if (!c) return;
  try {
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start(0);
  } catch {
    // nothing to unlock
  }
  if (!loadStarted) {
    loadStarted = true;
    window.setTimeout(() => void loadSamples(), 0);
  }
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  for (const g of GESTURES) window.addEventListener(g, unlock, { capture: true, passive: true });
  // a peek from the browser console or a test: which recordings are decoded
  if (!import.meta.env.PROD)
    (window as unknown as { __psSound: unknown }).__psSound = {
      loadedSamples,
      loadSamples,
      sfx,
      crowd,
      nameOf: (b: AudioBuffer) => [...buffers].find(([, x]) => x === b)?.[0] ?? null,
      bed: () => bed && { recorded: bed.recorded, venue: bed.venue, gain: bed.out.gain.value },
    };
}

/** For tests: put a decoded recording in place, or start over. */
export const _test = {
  setBuffer(file: string, buf: AudioBuffer) {
    buffers.set(file, buf);
    loaded(file);
  },
  reset() {
    crowd.stop(0);
    ctx = null;
    bus = null;
    bed = null;
    buffers.clear();
    pending.clear();
    failed.clear();
    lastFile.clear();
    reactions.clear();
    reactAt = -9;
    reactSize = 0;
    queue = Promise.resolve();
    loadStarted = false;
    soundOn = true;
    hapticsOn = true;
  },
  urls: URLS,
  bed: () => bed,
};

/** Codex: original, cancellable pack score. No downloads, loops or changes to game audio settings. */
export function packSound(cue: 'charge' | 'surge' | 'reveal', premium = false): () => void {
  const c = ac();
  if (!c) return () => {};
  const bus = c.createGain(),
    filter = c.createBiquadFilter(),
    nodes: OscillatorNode[] = [];
  const now = c.currentTime,
    duration = cue === 'charge' ? 0.78 : cue === 'surge' ? 1.05 : 0.95;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cue === 'reveal' ? 4200 : 900, now);
  filter.frequency.exponentialRampToValueAtTime(cue === 'surge' ? 5200 : 3000, now + duration * 0.8);
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.exponentialRampToValueAtTime(premium ? 0.17 : 0.12, now + 0.04);
  bus.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  filter.connect(bus).connect(c.destination);
  const freqs = cue === 'reveal' ? [65.4, 130.8, 196, 261.6, 329.6] : cue === 'surge' ? [55, 110, 164.8] : [65.4, 98, 130.8];
  for (const [i, f] of freqs.entries()) {
    const o = c.createOscillator(),
      gain = c.createGain();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(cue === 'reveal' && i === 0 ? 100 : f, now);
    o.frequency.exponentialRampToValueAtTime(cue === 'reveal' ? f : Math.min(1900, f * (cue === 'surge' ? 9 : 4)), now + duration * 0.9);
    gain.gain.value = i === 0 ? 0.48 : 0.18;
    o.connect(gain).connect(filter);
    o.start(now);
    o.stop(now + duration + 0.03);
    nodes.push(o);
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const at = c.currentTime;
    bus.gain.cancelScheduledValues(at);
    bus.gain.setValueAtTime(0.0001, at);
    for (const n of nodes) {
      try {
        n.stop(at + 0.015);
      } catch {}
    }
  };
}
