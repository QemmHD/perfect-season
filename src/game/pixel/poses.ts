// The moves, as poses over time. Each takes a phase (0 to 1 through the move, or any number for a
// loop like a run) and returns the pose for that moment. Animations step at a pixel-art frame rate
// (the games quantize the phase), so each frame reads as a drawn frame.
import { blend, type Pose, STAND } from './rig';

const TAU = Math.PI * 2;
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.max(0, Math.min(1, t));

/** Standing ready, breathing. */
export function idle(phase: number): Pose {
  const b = Math.sin(phase * TAU) * 0.008;
  return { ...STAND, crouch: 0.02 + b };
}

/**
 * Running: legs cycle, arms swing opposite, a forward lean that grows with speed (0-1). One phase
 * unit is one stride pair.
 */
export function run(phase: number, speed = 1): Pose {
  const a = phase * TAU;
  const s = Math.sin(a);
  const k = 0.4 + 0.6 * speed;
  // the leg swinging back kicks its heel up; the one coming through stays fairly straight
  const kick = (x: number) => 0.25 + 1.25 * Math.max(0, x) ** 1.5;
  return {
    lean: 0.1 + 0.12 * speed,
    crouch: 0.025 + 0.02 * Math.abs(Math.cos(a)) * k,
    lift: 0.03 * Math.max(0, Math.sin(a * 2 + 0.5)) * k,
    hipL: 0.58 * s * k,
    kneeL: kick(-Math.sin(a + 0.5)) * k + 0.1,
    hipR: -0.58 * s * k,
    kneeR: kick(Math.sin(a + 0.5)) * k + 0.1,
    shL: -0.7 * s * k,
    elL: 1.45,
    shR: 0.7 * s * k,
    elR: 1.45,
    abL: 0.16,
    abR: 0.16,
  };
}

/** Dribbling: his right hand pumps the ball; the left guards. Running or standing (speed 0). */
export function dribble(phase: number, speed: number): Pose {
  const base = speed > 0.05 ? run(phase, speed) : { ...idle(phase), crouch: 0.07, lean: 0.2, hipL: 0.25, kneeL: 0.5, hipR: -0.1, kneeR: 0.45 };
  const bounce = Math.sin(phase * TAU * (speed > 0.05 ? 2 : 1.6));
  return {
    ...base,
    shR: 0.55 + 0.12 * bounce,
    elR: 0.35 - 0.25 * bounce,
    abR: 0.22,
    shL: 0.7,
    elL: 0.9,
    abL: 0.35,
  };
}

/** The ball's height in a dribble (0 at the floor, 1 at the hand), for the same phase. */
export function dribbleBall(phase: number, speed: number): number {
  const p = (phase * (speed > 0.05 ? 2 : 1.6)) % 1;
  // fast down, slower back up
  return p < 0.45 ? 1 - ease(p / 0.45) : ease((p - 0.45) / 0.55);
}

/**
 * The jump shot. 0-0.25 the gather (dip, ball to the chest), 0.25-0.75 the rise (up, ball above the
 * head), 0.75-1 the release and follow-through at the top. `release` is where the ball leaves.
 */
export function jumpShot(phase: number): Pose {
  const t = clamp(phase);
  const gather: Pose = { lean: 0.08, crouch: 0.09, lift: 0, hipL: 0.4, kneeL: 0.85, hipR: 0.35, kneeR: 0.8, shL: 1.0, elL: 1.4, shR: 1.1, elR: 1.6, abL: 0.25, abR: 0.15, nod: 0.1 };
  // the set point: shooting elbow under the ball, forearm straight up, guide hand on its side
  const set: Pose = { lean: -0.04, crouch: 0, lift: 0.14, hipL: 0.1, kneeL: 0.25, hipR: 0.05, kneeR: 0.2, shL: 2.15, elL: 0.95, shR: 2.3, elR: 0.8, abL: 0.3, abR: 0.08, nod: 0.25 };
  // the release: the shooting arm snaps straight up and forward
  const flick: Pose = { lean: -0.05, crouch: 0, lift: 0.15, hipL: 0.12, kneeL: 0.35, hipR: 0.06, kneeR: 0.3, shL: 2.05, elL: 0.75, shR: 2.8, elR: 0.12, abL: 0.32, abR: 0.06, nod: 0.3 };
  if (t < 0.25) return blend(STAND, gather, ease(t / 0.25));
  if (t < 0.75) return blend(gather, set, ease((t - 0.25) / 0.5));
  return blend(set, flick, ease((t - 0.75) / 0.25));
}

/** Coming down after a shot (0-1): back to the floor with a soft landing. */
export function land(phase: number, from: Pose): Pose {
  const t = clamp(phase);
  const landing: Pose = { ...STAND, crouch: 0.08, hipL: 0.35, kneeL: 0.7, hipR: 0.3, kneeR: 0.65, shL: 0.6, elL: 0.6, shR: 0.7, elR: 0.5 };
  if (t < 0.5) return blend(from, { ...landing, lift: 0 }, ease(t / 0.5));
  return blend(landing, STAND, ease((t - 0.5) / 0.5));
}

/** A layup off one foot: the right knee drives up, the right arm lays it in at full stretch. */
export function layup(phase: number): Pose {
  const t = clamp(phase);
  const step: Pose = { lean: 0.15, crouch: 0.06, lift: 0, hipL: 0.5, kneeL: 0.6, hipR: -0.45, kneeR: 0.4, shL: 0.9, elL: 1.2, shR: 1.0, elR: 1.3, abL: 0.2, abR: 0.15 };
  const up: Pose = { lean: 0.02, crouch: 0, lift: 0.2, hipL: -0.15, kneeL: 0.4, hipR: 1.35, kneeR: 1.7, shL: 1.4, elL: 1.1, shR: 2.95, elR: 0.15, abL: 0.35, abR: 0.08, nod: 0.3 };
  if (t < 0.35) return blend(STAND, step, ease(t / 0.35));
  return blend(step, up, ease((t - 0.35) / 0.65));
}

/**
 * A dunk. `kind`: 'two' two hands, 'one' one-handed tomahawk, 'contact' through a defender (the
 * same rise with knees tucked and both arms cocked back further).
 */
export function dunk(phase: number, kind: 'one' | 'two' | 'contact'): Pose {
  const t = clamp(phase);
  const load: Pose = { lean: 0.25, crouch: 0.12, lift: 0, hipL: 0.55, kneeL: 1.1, hipR: 0.5, kneeR: 1.05, shL: -0.4, elL: 0.6, shR: -0.45, elR: 0.6, abL: 0.2, abR: 0.2 };
  const cock: Pose =
    kind === 'one'
      ? { lean: -0.12, crouch: 0, lift: 0.36, hipL: 0.2, kneeL: 1.1, hipR: 0.45, kneeR: 1.5, shL: 1.3, elL: 0.9, shR: 3.6, elR: 0.9, abL: 0.45, abR: 0.15, nod: 0.25 }
      : kind === 'contact'
        ? { lean: -0.18, crouch: 0, lift: 0.4, hipL: 0.85, kneeL: 1.9, hipR: 0.75, kneeR: 1.8, shL: 3.5, elL: 0.8, shR: 3.6, elR: 0.8, abL: 0.25, abR: 0.25, nod: 0.3 }
        : { lean: -0.1, crouch: 0, lift: 0.36, hipL: 0.35, kneeL: 1.2, hipR: 0.3, kneeR: 1.15, shL: 3.3, elL: 0.5, shR: 3.35, elR: 0.5, abL: 0.2, abR: 0.2, nod: 0.25 };
  const slam: Pose = { ...cock, lean: 0.12, shL: kind === 'one' ? 1.0 : 2.2, elL: 0.2, shR: 2.25, elR: 0.15, nod: -0.1 };
  if (t < 0.25) return blend(STAND, load, ease(t / 0.25));
  if (t < 0.7) return blend(load, cock, ease((t - 0.25) / 0.45));
  return blend(cock, slam, ease((t - 0.7) / 0.3));
}

/** A chest pass: both arms push out (0-1). */
export function pass(phase: number): Pose {
  const t = clamp(phase);
  const load: Pose = { ...STAND, lean: 0.1, crouch: 0.05, hipL: 0.35, kneeL: 0.5, hipR: -0.2, kneeR: 0.35, shL: 0.6, elL: 1.9, shR: 0.6, elR: 1.9, abL: 0.35, abR: 0.35 };
  const out: Pose = { ...load, lean: 0.18, shL: 1.45, elL: 0.15, shR: 1.45, elR: 0.15, abL: 0.15, abR: 0.15 };
  if (t < 0.4) return blend(STAND, load, ease(t / 0.4));
  return blend(load, out, ease((t - 0.4) / 0.6));
}

/** Guarding: low, wide, hands up and out; shuffles with the phase. */
export function defend(phase: number, active: number): Pose {
  const s = Math.sin(phase * TAU);
  return {
    lean: 0.22,
    crouch: 0.1,
    lift: 0,
    spread: 0.22,
    hipL: 0.35 + 0.12 * s * active,
    kneeL: 0.75,
    hipR: 0.3 - 0.12 * s * active,
    kneeR: 0.7,
    shL: 1.0 + 0.8 * active,
    elL: 0.35,
    shR: 0.9 + 0.3 * active,
    elR: 0.5,
    abL: 0.9,
    abR: 0.85,
  };
}

/** Going up to contest or block (0-1). */
export function contest(phase: number): Pose {
  const t = clamp(phase);
  const up: Pose = { lean: -0.02, crouch: 0, lift: 0.17, hipL: 0.15, kneeL: 0.4, hipR: 0.1, kneeR: 0.35, shL: 3.0, elL: 0.15, shR: 2.6, elR: 0.3, abL: 0.25, abR: 0.3, nod: 0.25 };
  const load: Pose = { ...defend(0, 0), crouch: 0.12 };
  if (t < 0.3) return blend(defend(0, 0), load, ease(t / 0.3));
  if (t < 0.7) return blend(load, up, ease((t - 0.3) / 0.4));
  return blend(up, { ...up, lift: 0.04 }, ease((t - 0.7) / 0.3));
}

/** Arms out to catch (0-1). */
export function catchBall(phase: number): Pose {
  const t = clamp(phase);
  const reach: Pose = { ...STAND, lean: 0.12, shL: 1.3, elL: 0.4, shR: 1.3, elR: 0.4, abL: 0.25, abR: 0.25 };
  return blend(STAND, reach, ease(t));
}

/** A celebration: fist pump. */
export function celebrate(phase: number): Pose {
  const s = Math.abs(Math.sin(phase * TAU));
  return { ...STAND, lift: 0.05 * s, shR: 2.5 + 0.5 * s, elR: 0.9, shL: 0.3, elL: 1.2, nod: 0.2 };
}

/** Off balance: crossed up or posterized, leaning back with the arms out (0-1). */
export function stumble(phase: number): Pose {
  const t = clamp(phase);
  const fall: Pose = { lean: -0.38, side: 0.18, crouch: 0.12, lift: 0, spread: 0.3, hipL: 0.75, kneeL: 1.1, hipR: -0.25, kneeR: 0.5, shL: 1.5, elL: 0.4, shR: 2.2, elR: 0.6, abL: 1.1, abR: 0.9, nod: 0.35 };
  if (t < 0.3) return blend(defend(0, 0), fall, ease(t / 0.3));
  return blend(fall, { ...fall, lean: -0.3, crouch: 0.1 }, ease((t - 0.3) / 0.7));
}

/** A crossover: low, the ball whipped from one hand to the other, a hard plant (0-1). */
export function crossover(phase: number): Pose {
  const t = clamp(phase);
  const s = Math.sin(t * Math.PI);
  return {
    lean: 0.3,
    side: -0.25 * s,
    crouch: 0.1,
    lift: 0,
    spread: 0.25,
    hipL: 0.5 * s,
    kneeL: 0.9,
    hipR: -0.3 * s,
    kneeR: 0.7,
    shL: 0.5 + 0.3 * s,
    elL: 0.9,
    shR: 0.4 + 0.4 * (1 - s),
    elR: 0.5,
    abL: 0.3 + 0.4 * s,
    abR: 0.3 + 0.4 * (1 - s),
  };
}

/** A standing dunk: a two-foot power jump, both hands (0-1). */
export function standDunk(phase: number): Pose {
  return dunk(phase, 'two');
}
