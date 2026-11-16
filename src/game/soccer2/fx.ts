// Soccer's juice (Claude 2026-11-16, studio overhaul soccer-3; Game Design V2 B.0.5, B.3.6, B.3.7):
// hit-stop, trauma shake, slow motion and the moments that call them, through the shared `Juice`
// (src/game/juice.ts). RENDER ONLY: it holds back or slows the real time fed to the fixed-step
// accumulator, so the same steps run with the same inputs in the same order, and a seeded attack
// ends identically with or without it (juice-soccer.test.ts). It reads the attack, never writes it,
// and never draws on the attack's seeded randomness.
//
// The plan's seam (§5.6): at merge the lead points `hitStopFor` at the players team's
// `impactOf(kind).stopMs` and `HitStopCap`; soccer keeps calling only this file.
import { Juice } from '../juice';
import { GH, GHALF, GX } from './engine';
import type { Attack } from './types';

/** The moments that stop the game for a beat (V2 B.0.5 / B.3.6), and how long (ms). */
export type SoccerHit = 'power' | 'goal' | 'save' | 'woodwork';
export const HIT_MS: Readonly<Record<SoccerHit, number>> = { power: 33, goal: 66, save: 60, woodwork: 80 };
/** Every hit-stop is 33-120 ms; at most 150 ms of them in any second; ≤ 30 ms under reduced motion. */
export const HIT = { min: 33, max: 120, capPerS: 150, reduced: 30 } as const;
/** Slow motion: a near miss at 0.4× for 0.6 s, a goal at 0.35× for 0.5 s; never under reduced motion. */
export const SLOW = { nearK: 0.4, nearMs: 600, goalK: 0.35, goalMs: 500 } as const;
/** A shot struck at least this fast (m/s) is a power shot (its hit-stop). */
export const POWER_SHOT = 24;

/** A hit-stop's length (ms) for a moment, clamped to [33, 120], or to 30 under reduced motion. */
export function hitStopFor(kind: SoccerHit, reduced = false): number {
  const ms = Math.max(HIT.min, Math.min(HIT.max, HIT_MS[kind]));
  return reduced ? Math.min(HIT.reduced, ms) : ms;
}

/** What a play's event asks of the juice. */
export interface Moment {
  hit?: SoccerHit;
  trauma?: number;
  slow?: 'near' | 'goal';
  /** the woodwork rang: the frame shivers (render.ts postHit) */
  post?: boolean;
}

/** Is the last shot a near miss: across the line within a metre outside the frame? */
export function nearMiss(a: Attack): boolean {
  const c = a.lastShot?.cross;
  if (!c) return false;
  const out = Math.abs(c.x - GX) >= GHALF || c.h >= GH;
  return out && Math.abs(c.x - GX) < GHALF + 1 && c.h < GH + 1;
}

/** The juice for one engine event (attack.events), read from the attack as it stands. */
export function momentOf(e: string, a: Attack): Moment | null {
  switch (e) {
    case 'shot': {
      const b = a.ball;
      return Math.hypot(b.vx, b.vy, b.vh) >= POWER_SHOT ? { hit: 'power', trauma: 0.12 } : null;
    }
    case 'goal':
      return { hit: 'goal', trauma: 0.45, slow: 'goal' };
    case 'save-catch':
    case 'save-parry':
    case 'smother':
      return { hit: 'save', trauma: 0.25 };
    case 'post':
    case 'bar':
      return { hit: 'woodwork', trauma: 0.3, slow: 'near', post: true };
    case 'end:W':
      return nearMiss(a) ? { slow: 'near', trauma: 0.1 } : null;
    case 'tackle':
    case 'block':
      return { trauma: 0.15 };
    default:
      return null;
  }
}

/**
 * The match's juice: the shared Juice for trauma shake (and its hit-stop clock), a rolling ledger that
 * caps hit-stops at 150 ms a second, and one slow-motion beat per attack.
 */
export class SoccerFx {
  readonly juice: Juice;
  readonly reduced: boolean;
  /** hit-stops granted in the last second: [real ms at, ms] */
  private ledger: [number, number][] = [];
  private slowUntil = 0;
  private slowK = 1;
  private slowUsed = false;
  /** hit-stop ms granted in all (the tests read it) */
  granted = 0;

  constructor(opts: { reduced?: boolean; seed?: number } = {}) {
    this.reduced = !!opts.reduced;
    this.juice = new Juice({ reducedMotion: this.reduced, seed: opts.seed ?? 0x50cc3 });
    this.juice.maxShake = 6;
  }

  /** Hold the game still for a moment, within the 150 ms-a-second cap. Returns the ms granted. */
  hitStop(kind: SoccerHit, now: number): number {
    this.ledger = this.ledger.filter(([at]) => now - at < 1000);
    const used = this.ledger.reduce((n, [, ms]) => n + ms, 0);
    const ms = Math.min(hitStopFor(kind, this.reduced), HIT.capPerS - used);
    if (ms <= 0) return 0;
    this.ledger.push([now, ms]);
    this.granted += ms;
    this.juice.freezeUntil = Math.max(this.juice.freezeUntil, now + ms);
    return ms;
  }

  /** Slow the game for a beat (one per attack; none under reduced motion). */
  slow(kind: 'near' | 'goal', now: number) {
    if (this.reduced || this.slowUsed) return;
    this.slowUsed = true;
    this.slowK = kind === 'goal' ? SLOW.goalK : SLOW.nearK;
    this.slowUntil = now + (kind === 'goal' ? SLOW.goalMs : SLOW.nearMs);
  }

  /** A new attack: its own slow-motion beat. */
  newAttack() {
    this.slowUsed = false;
    this.slowUntil = 0;
  }

  /** Apply one play event's moment. */
  apply(m: Moment, now: number) {
    if (m.hit) this.hitStop(m.hit, now);
    if (m.trauma) this.juice.addTrauma(m.trauma);
    if (m.slow) this.slow(m.slow, now);
  }

  /** The time scale now (slow motion), 1 when none. */
  scale(now: number): number {
    return now < this.slowUntil ? this.slowK : 1;
  }

  /** Real seconds for the fixed-step accumulator this frame: none while held, slower in slow motion. */
  gameTime(now: number, elapsed: number): number {
    return this.juice.gameTime(now, elapsed) * this.scale(now);
  }

  /** Advance the shake by real seconds. */
  update(dt: number) {
    this.juice.update(dt);
  }

  /** The screen shake to draw with now (px). */
  view(): { x: number; y: number } {
    const v = this.juice.view();
    return { x: v.x, y: v.y };
  }

  /** A pause of `ms` real milliseconds: the beats in progress resume where they were. */
  shift(ms: number) {
    if (this.juice.freezeUntil > 0) this.juice.freezeUntil += ms;
    if (this.slowUntil > 0) this.slowUntil += ms;
    this.ledger = this.ledger.map(([at, d]) => [at + ms, d]);
  }
}
