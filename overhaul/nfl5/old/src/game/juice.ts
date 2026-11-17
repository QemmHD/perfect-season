// Game feel ("juice") for both courts: trauma-based screen shake with a directional kick and a
// zoom punch, hit-stop, and pooled pixel particles (turf, sweat, team-colour confetti).
// Implemented by Claude (Anthropic), 2026-11-01, from the recipes in Squirrel Eiserloh's "Juicing
// your cameras with math" (trauma² shake on smooth noise) and Vlambeer's "art of screenshake".
//
// RENDER ONLY. Nothing here reads or writes simulation state, and it never touches a possession's
// or a play's seeded random numbers (it has its own). Hit-stop works exactly like the existing
// slow motion: it holds back the real time fed to the fixed-step accumulator, so the same steps
// run with the same inputs in the same order and a seeded game comes out identically with or
// without it (juice.test.ts checks this for both sports).

/** hit-stop lengths (ms) by moment */
export const HITSTOP = { dunk: 70, block: 60, truck: 90, int: 50, green: 40, bighit: 80, posterize: 90 } as const;
export type HitStopKind = keyof typeof HITSTOP;

export type ParticleKind = 'turf' | 'sweat' | 'confetti' | 'spark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** seconds left, and its whole life */
  life: number;
  max: number;
  color: string;
  size: number;
  grav: number;
  drag: number;
  kind: ParticleKind;
  /** confetti flutter phase */
  ph: number;
}

const POOL = 220;
const TAU = Math.PI * 2;

/** A small deterministic generator of its own (mulberry32), so particles never consume game randomness. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** smooth 1-D noise in -1..1 (a sum of incommensurate sines: cheap, continuous, never repeats visibly) */
function smooth(t: number, k: number): number {
  return 0.55 * Math.sin(t * 31.7 + k * 1.31) + 0.3 * Math.sin(t * 53.3 + k * 4.17) + 0.15 * Math.sin(t * 97.1 + k * 2.71);
}

export class Juice {
  /** 0-1; the shake is trauma squared */
  trauma = 0;
  /** a directional kick (pixels) that springs back */
  private kx = 0;
  private ky = 0;
  /** zoom punch (share, 0.04 = 4% in) */
  private zoom = 0;
  /** real-time ms until which the game is held still (hit-stop) */
  freezeUntil = 0;
  /** the biggest shake in pixels at full trauma */
  maxShake = 9;
  reduced = false;
  private parts: Particle[] = [];
  private live = 0;
  private rand = prng(0x9e3779b9);
  private t = 0;

  constructor(opts: { reducedMotion?: boolean; seed?: number } = {}) {
    this.reduced = !!opts.reducedMotion;
    if (opts.seed !== undefined) this.rand = prng(opts.seed);
    for (let i = 0; i < POOL; i++) this.parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 1, grav: 0, drag: 0, kind: 'spark', ph: 0 });
  }

  /** Add trauma (0-1). */
  addTrauma(a: number) {
    if (this.reduced) return;
    this.trauma = Math.min(1, this.trauma + a);
  }
  /** A kick in a screen direction (dx, dy, any length) of `px` pixels. */
  kick(dx: number, dy: number, px: number) {
    if (this.reduced) return;
    const l = Math.hypot(dx, dy) || 1;
    this.kx += (dx / l) * px;
    this.ky += (dy / l) * px;
  }
  /** A quick zoom in (share of the view, e.g. 0.035). */
  punch(z: number) {
    if (this.reduced) return;
    this.zoom = Math.max(this.zoom, z);
  }
  /** Hold the game still for a moment (real ms from `now`). Kept short under reduced motion. */
  hitStop(kind: HitStopKind, now: number) {
    const ms = this.reduced ? Math.min(30, HITSTOP[kind]) : HITSTOP[kind];
    this.freezeUntil = Math.max(this.freezeUntil, now + ms);
  }
  /** Is the game held still right now? */
  frozen(now: number): boolean {
    return now < this.freezeUntil;
  }
  /** The real time to feed the fixed-step accumulator this frame: none while frozen. */
  gameTime(now: number, elapsed: number): number {
    return this.frozen(now) ? 0 : elapsed;
  }

  /** Advance the effects by real seconds. */
  update(dt: number) {
    if (dt <= 0) return;
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    // the kick springs back critically damped-ish
    const back = Math.pow(0.0006, dt);
    this.kx *= back;
    this.ky *= back;
    this.zoom = Math.max(0, this.zoom - dt * 0.22);
    for (const q of this.parts) {
      if (q.life <= 0) continue;
      q.life -= dt;
      if (q.life <= 0) {
        this.live--;
        continue;
      }
      const d = Math.pow(1 - q.drag, dt * 60);
      q.vx *= d;
      q.vy = q.vy * d + q.grav * dt;
      if (q.kind === 'confetti') q.vx += Math.sin(this.t * 9 + q.ph) * 30 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }

  /** The camera offset (pixels) and zoom (scale) to draw with now. */
  view(): { x: number; y: number; scale: number } {
    if (this.reduced) return { x: 0, y: 0, scale: 1 };
    const s = this.trauma * this.trauma * this.maxShake;
    return { x: Math.round(smooth(this.t, 1) * s + this.kx), y: Math.round(smooth(this.t, 7) * s + this.ky), scale: 1 + this.zoom };
  }

  /** Spawn particles at a screen point. `dir` biases the spray (radians, screen space). */
  burst(kind: ParticleKind, x: number, y: number, n: number, colors: string[], opts: { dir?: number; spread?: number; speed?: number; size?: number } = {}) {
    if (this.reduced && kind === 'confetti') n = Math.min(n, 6);
    const r = this.rand;
    for (let k = 0; k < n; k++) {
      let q = this.parts.find((p) => p.life <= 0);
      if (!q) {
        // the pool is full: recycle the oldest-looking one
        q = this.parts[Math.floor(r() * this.parts.length)];
        if (q.life > 0) this.live--;
      }
      const spread = opts.spread ?? TAU;
      const a = (opts.dir ?? -Math.PI / 2) + (r() - 0.5) * spread;
      const sp = (opts.speed ?? 60) * (0.45 + r() * 0.8);
      q.kind = kind;
      q.x = x + (r() - 0.5) * 4;
      q.y = y + (r() - 0.5) * 3;
      q.vx = Math.cos(a) * sp;
      q.vy = Math.sin(a) * sp;
      q.color = colors[Math.floor(r() * colors.length)] ?? '#fff';
      q.size = Math.max(1, Math.round((opts.size ?? 2) * (0.6 + r() * 0.7)));
      q.grav = kind === 'confetti' ? 40 : kind === 'sweat' ? 160 : kind === 'turf' ? 260 : 120;
      q.drag = kind === 'confetti' ? 0.04 : kind === 'turf' ? 0.02 : 0.03;
      q.max = q.life = kind === 'confetti' ? 1.6 + r() * 0.9 : kind === 'turf' ? 0.45 + r() * 0.3 : 0.35 + r() * 0.3;
      q.ph = r() * TAU;
      this.live++;
    }
  }

  /** How many particles are alive (for tests and the perf overlay). */
  get count(): number {
    return this.parts.reduce((n, q) => n + (q.life > 0 ? 1 : 0), 0);
  }

  /** Draw the particles: square pixels, fading at the end of their life. */
  draw(ctx: CanvasRenderingContext2D) {
    if (this.live <= 0) return;
    const a0 = ctx.globalAlpha;
    for (const q of this.parts) {
      if (q.life <= 0) continue;
      ctx.globalAlpha = a0 * Math.min(1, q.life / Math.min(0.25, q.max * 0.5));
      ctx.fillStyle = q.color;
      const w = q.kind === 'confetti' ? Math.max(1, Math.round(q.size * (0.5 + 0.5 * Math.abs(Math.sin(this.t * 12 + q.ph))))) : q.size;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), w, q.size);
    }
    ctx.globalAlpha = a0;
  }
}

/** Squash and stretch for a ball: a scale along its motion (stretch) and across (squash). */
export function squashStretch(vx: number, vy: number, squash: number): { angle: number; along: number; across: number } {
  const v = Math.hypot(vx, vy);
  const stretch = Math.min(0.28, v * 0.0016);
  if (squash > 0) return { angle: 0, along: 1 + 0.32 * squash, across: 1 - 0.28 * squash };
  return { angle: Math.atan2(vy, vx), along: 1 + stretch, across: 1 - stretch * 0.55 };
}
