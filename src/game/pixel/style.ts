// Body-type touches on recorded (mocap) joints, render only (Claude, 2026-11-01): a heavier man
// runs with a wider base and a heavier step, a fast man leans into his sprint. The joints are in
// the rig's body frame (x forward, y up, z to his side, a share of his height).
import type { Joints } from './rig';

type V3 = { x: number; y: number; z: number };
const UPPER: (keyof Joints)[] = ['chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'handL', 'handR'];
const LOWER_L: (keyof Joints)[] = ['kneeL', 'ankleL', 'toeL'];
const LOWER_R: (keyof Joints)[] = ['kneeR', 'ankleR', 'toeR'];

/** How heavy a build reads (0 a 180 lb wing, 1 a 300 lb lineman). */
export function heaviness(wt: number, ht: number): number {
  // weight for his height: a tall man carries more without looking heavy
  const bmi = (wt / (ht * ht)) * 703;
  return Math.max(0, Math.min(1, (bmi - 24) / 12));
}

/** Lean the upper body forward from the pelvis by `a` radians (a sprint), rounded for the sprite cache. */
export function leanForward(j: Joints, a: number): Joints {
  if (Math.abs(a) < 1e-3) return j;
  const c = Math.cos(a),
    s = Math.sin(a),
    p = j.pelvis;
  const out = { ...j };
  for (const k of UPPER) {
    const q = j[k] as V3;
    const dx = q.x - p.x,
      dy = q.y - p.y;
    out[k] = { x: p.x + dx * c + dy * s, y: p.y - dx * s + dy * c, z: q.z } as never;
  }
  return out;
}

/** A wider base (legs out by `k`, a share of hip width) and the pelvis sitting `drop` lower. */
export function widen(j: Joints, k: number, drop = 0): Joints {
  if (k < 1e-3 && drop < 1e-4) return j;
  const out = { ...j };
  const hipW = Math.abs(j.hipL.z - j.hipR.z) || 0.06;
  const push = (keys: (keyof Joints)[], side: number) => {
    for (const key of keys) {
      const q = j[key] as V3;
      out[key] = { x: q.x, y: q.y, z: q.z + side * hipW * k } as never;
    }
  };
  push(LOWER_L, Math.sign(j.hipL.z - j.hipR.z) || 1);
  push(LOWER_R, Math.sign(j.hipR.z - j.hipL.z) || -1);
  if (drop > 0)
    for (const key of ['pelvis', 'hipL', 'hipR', ...UPPER] as (keyof Joints)[]) {
      const q = out[key] as V3;
      out[key] = { x: q.x, y: q.y - drop, z: q.z } as never;
    }
  return out;
}

/** Sprint lean for a man running at `speed` of his top, by his speed rating (a 99 leans most). */
export function sprintLean(spd: number, share: number): number {
  const k = Math.max(0, Math.min(1, (share - 0.75) / 0.25));
  return Math.round(k * (0.06 + 0.14 * Math.max(0, Math.min(1, (spd - 70) / 29))) * 20) / 20;
}
