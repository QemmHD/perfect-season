import TINY from './__fixtures__/tiny.bvh?raw';
import type { Look } from './body';
import { DEFAULT_HAIR, DEFAULT_SKIN, shapeFor } from './body';
import { bvhPositions, parseBvh } from './bvh';
import { BONES, type Clip, CLIPS, clipMeta, frame, frameAt, loadClip, mocapKey, retarget, sample, warp } from './mocap';
import type { Joints, Shape, V3 } from './rig';

// node's modules, loaded at run time (the app's types don't include node's)
const node = (m: string) => import(/* @vite-ignore */ 'node:' + m);

const look = (sport: 'nba' | 'nfl', ht: number, wt: number): Look => ({
  sport,
  ht,
  wt,
  num: 1,
  hair: 0,
  skin: DEFAULT_SKIN,
  hairColor: DEFAULT_HAIR,
  jersey: '#000',
  trim: '#fff',
  shorts: '#000',
  socks: '#fff',
  shoes: '#000',
  pads: sport === 'nfl' ? 1 : undefined,
});
const BODIES: Shape[] = [shapeFor(look('nba', 73, 185)), shapeFor(look('nba', 84, 255)), shapeFor(look('nfl', 76, 315))];

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const dist = (a: V3, b: V3) => len(sub(a, b));
const close = (a: V3, b: { x: number; y: number; z: number }, eps = 1e-6) => expect(dist(a, b)).toBeLessThan(eps);

describe('BVH', () => {
  const b = parseBvh(TINY);

  it('reads the hierarchy, channels and frames', () => {
    expect(b.joints.map((j) => j.name)).toEqual(['Hips', 'LeftUpLeg', 'LeftLeg', 'Spine']);
    expect(b.joints.map((j) => j.parent)).toEqual([-1, 0, 1, 0]);
    expect(b.joints.map((j) => j.col)).toEqual([0, 6, 9, 12]);
    expect(b.joints[0].channels[3]).toBe('Zrotation');
    expect(b.joints[2].end).toEqual({ x: 0, y: -4, z: 0 });
    expect(b.frameTime).toBeCloseTo(1 / 120, 6);
    expect(b.frames).toHaveLength(3);
    expect(b.frames[1]).toHaveLength(15);
  });

  it('places the joints (channel order Z, Y, X; children carried by their parents)', () => {
    const f0 = bvhPositions(b, b.frames[0]);
    close(f0.LeftLeg_end, { x: 1, y: 0, z: 0 });
    close(f0.Spine_end, { x: 0, y: 13, z: 0 });
    // the root turned 90 degrees about y and the knee 90 about x
    const f1 = bvhPositions(b, b.frames[1]);
    close(f1.LeftUpLeg, { x: 1, y: 8, z: 1 });
    close(f1.LeftLeg, { x: 1, y: 4, z: 1 });
    close(f1.LeftLeg_end, { x: -3, y: 4, z: 1 });
    close(f1.Spine_end, { x: 1, y: 13, z: 2 });
    // the hip flexed forward, the spine leaning sideways
    const f2 = bvhPositions(b, b.frames[2]);
    close(f2.LeftLeg, { x: 1, y: 7, z: 4 });
    close(f2.LeftLeg_end, { x: 1, y: 7, z: 8 });
    close(f2.Spine_end, { x: -1.5, y: 9 + 3 * Math.cos(Math.PI / 6), z: 0 });
  });

  it('agrees with the build script (scripts/build_mocap.py)', async () => {
    const { execFileSync } = await node('child_process');
    const { fileURLToPath } = await node('url');
    const fixture = fileURLToPath(new URL('./__fixtures__/tiny.bvh', import.meta.url));
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    let out: string;
    try {
      out = execFileSync('python3', ['scripts/build_mocap.py', '--parse', fixture], { cwd: root, encoding: 'utf8' });
    } catch {
      return; // no python here: the TS reading above still stands
    }
    const py = JSON.parse(out) as { frameTime: number; frames: Record<string, [number, number, number]>[] };
    expect(py.frameTime).toBeCloseTo(b.frameTime, 9);
    b.frames.forEach((fr, k) => {
      const ts = bvhPositions(b, fr);
      for (const [name, p] of Object.entries(py.frames[k])) close(ts[name], { x: p[0], y: p[1], z: p[2] }, 1e-9);
    });
  });
});

describe('mocap clips', () => {
  const names = Object.keys(CLIPS);
  const clips: Record<string, Clip> = {};
  beforeAll(async () => {
    for (const n of names) clips[n] = await loadClip(n);
  });

  it('has the clips the games need', () => {
    for (const n of ['jumpshot', 'layup', 'jump', 'dribble', 'crossover', 'crossover_l', 'shuffle', 'shuffle_l', 'ready', 'jog', 'run', 'cut', 'backpedal', 'celebrate', 'stumble', 'fall_back', 'fall_back_m', 'fall_forward', 'getup', 'throw', 'catch', 'kick', 'dive', 'block', 'stiff_arm'])
      expect(names).toContain(n);
  });

  it('decodes to whole, unit-length frames', () => {
    for (const n of names) {
      const c = clips[n];
      expect(c.frames).toBe(c.meta.frames);
      expect(c.dirs.length).toBe(c.frames * BONES.length * 3);
      for (let i = 0; i < c.dirs.length; i += 3) expect(Math.abs(Math.hypot(c.dirs[i], c.dirs[i + 1], c.dirs[i + 2]) - 1)).toBeLessThan(1e-5);
    }
  });

  it('keeps every event inside its clip, in a sensible order', () => {
    for (const n of names) {
      const m = CLIPS[n];
      for (const [k, t] of Object.entries(m.events)) {
        expect(t, n + ' ' + k).toBeGreaterThanOrEqual(0);
        expect(t, n + ' ' + k).toBeLessThanOrEqual(m.duration + 1e-6);
      }
      for (const [k, ts] of Object.entries(m.beats ?? {}))
        for (const t of ts) {
          expect(t, n + ' ' + k).toBeGreaterThanOrEqual(0);
          expect(t, n + ' ' + k).toBeLessThanOrEqual(m.duration + 1e-6);
        }
    }
    const s = clipMeta('jumpshot').events;
    expect(s.gather).toBeLessThan(s.dip);
    expect(s.dip).toBeLessThan(s.takeoff);
    expect(s.set).toBeLessThan(s.release);
    expect(s.takeoff).toBeLessThan(s.release);
    expect(s.release).toBeLessThan(s.land);
    expect(Math.abs(s.release - s.apex)).toBeLessThan(0.1); // released at the top of the jump
    const l = clipMeta('layup').events;
    expect(l.takeoff).toBeLessThan(l.release);
    expect(l.release).toBeLessThan(l.land);
    const f = clipMeta('fall_back').events;
    expect(f.impact).toBeLessThan(f.ground);
    const k = clipMeta('kick').events;
    expect(k.plant).toBeLessThan(k.contact);
  });

  it('retargets with each body\'s own bone lengths, feet on the floor, knees bending the right way, arms outside the torso', () => {
    let pushed = 0;
    for (const n of names) {
      const c = clips[n];
      for (const s of BODIES)
        for (let k = 0; k < c.frames; k++)
          for (const ground of ['clip', 'pin'] as const) {
            const f = frame(c, k);
            const j = retarget(f, s, { ground });
            const at = n + ' #' + k;
            // bone lengths
            for (const [a, b, l] of [
              ['hipL', 'kneeL', s.thigh],
              ['kneeL', 'ankleL', s.shin],
              ['ankleL', 'toeL', s.foot],
              ['hipR', 'kneeR', s.thigh],
              ['kneeR', 'ankleR', s.shin],
              ['ankleR', 'toeR', s.foot],
              ['pelvis', 'chest', s.spine],
              ['hipL', 'hipR', s.hipW * 2],
              ['shL', 'shR', s.shoulderW * 2],
              ['shL', 'elL', s.upper],
              ['elL', 'wrL', s.fore],
              ['wrL', 'handL', s.hand],
              ['shR', 'elR', s.upper],
              ['elR', 'wrR', s.fore],
              ['wrR', 'handR', s.hand],
            ] as [keyof Joints, keyof Joints, number][])
              expect(Math.abs(dist(j[a], j[b]) - l), at + ' ' + a + '-' + b).toBeLessThan(1e-6);
            // nothing through the floor: the shoes' undersides at or above it
            const sole = Math.min(j.ankleL.y - 0.024, j.toeL.y - 0.02, j.ankleR.y - 0.024, j.toeR.y - 0.02);
            expect(sole, at).toBeGreaterThan(-1e-6);
            // on his feet in the recording (or pinned): a foot on the floor, not floating
            if (ground === 'pin' || f.lift < 1e-3) {
              const rest = Math.min(j.pelvis.y, j.chest.y, j.head.y, j.kneeL.y, j.kneeR.y, j.elL.y, j.elR.y, j.handL.y, j.handR.y);
              if (rest - sole > 0.15) expect(sole, at).toBeLessThan(1e-6);
            }
            // knees: a bent knee's shin swings back from the thigh line, never forward (a knee
            // bent backward): "forward" by the hips and by the foot both, since a turned-out leg's
            // knee bends toward its toes, not the hips' front
            for (const side of ['L', 'R'] as const) {
              const k = (n: string) => j[(n + side) as keyof Joints];
              const th = sub(k('knee'), k('hip'));
              const sh = sub(k('ankle'), k('knee'));
              const tl = len(th);
              const u = { x: th.x / tl, y: th.y / tl, z: th.z / tl };
              const d = { x: sh.x / len(sh) - u.x, y: sh.y / len(sh) - u.y, z: sh.z / len(sh) - u.z };
              // (only where it would show: a bent knee under him; a thigh swung up over the body,
              // as in a fall, has no "front" to measure by)
              if (len(d) < 0.3 || u.y > -0.3) continue;
              const across = (v: V3) => {
                const a = v.x * u.x + v.y * u.y + v.z * u.z;
                const w = { x: v.x - u.x * a, y: v.y - u.y * a, z: v.z - u.z * a };
                const l = len(w);
                return l > 1e-6 ? (d.x * w.x + d.y * w.y + d.z * w.z) / l : 0;
              };
              const r = sub(j.hipR, j.hipL);
              const hipsFwd = { x: r.z, y: 0, z: -r.x }; // up x right
              const backward = Math.min(across(hipsFwd), across(sub(k('toe'), k('ankle'))));
              expect(backward, at + ' knee ' + side).toBeLessThan(0.25);
            }
            // forearms and hands outside the torso: the pixel torso is a thick block, as deep as
            // the torso radius and as wide as the hips widening to the shoulders
            const up = sub(j.chest, j.pelvis);
            const ul = len(up);
            const uu = { x: up.x / ul, y: up.y / ul, z: up.z / ul };
            const sa = sub(j.shR, j.shL);
            const sd = sa.x * uu.x + sa.y * uu.y + sa.z * uu.z;
            const rr = { x: sa.x - uu.x * sd, y: sa.y - uu.y * sd, z: sa.z - uu.z * sd };
            const rl = len(rr);
            const right = { x: rr.x / rl, y: rr.y / rl, z: rr.z / rl };
            const fwd = { x: uu.y * right.z - uu.z * right.y, y: uu.z * right.x - uu.x * right.z, z: uu.x * right.y - uu.y * right.x };
            for (const q of [j.wrL, j.wrR, j.handL, j.handR]) {
              const p = sub(q, j.pelvis);
              const h = p.x * uu.x + p.y * uu.y + p.z * uu.z;
              if (h < 0 || h > s.spine * 0.8) continue;
              const t = h / s.spine;
              const depth = s.rTorso * 0.95;
              const width = s.hipW + s.rThigh * 0.75 + (s.shoulderW - s.hipW - s.rThigh * 0.75) * t;
              const fa = p.x * fwd.x + p.y * fwd.y + p.z * fwd.z;
              const ra = p.x * right.x + p.y * right.y + p.z * right.z;
              if ((fa / depth) ** 2 + (ra / width) ** 2 < 0.98) pushed++;
            }
          }
    }
    expect(pushed).toBe(0);
  });

  it('mirrors: left for right, the body\'s side flipped', () => {
    const pairs = Object.entries(CLIPS).filter(([, m]) => m.mirrorOf);
    expect(pairs.length).toBeGreaterThanOrEqual(5);
    const s = BODIES[0];
    for (const [name, m] of pairs) {
      const a = clips[m.mirrorOf!];
      const b = clips[name];
      expect(b.frames).toBe(a.frames);
      for (let k = 0; k < a.frames; k += 3) {
        const fa = frame(a, k);
        const fb = frame(b, k);
        const thighR = fa.dirs[BONES.indexOf('thighR')];
        const thighL = fb.dirs[BONES.indexOf('thighL')];
        expect(dist(thighL, { x: thighR.x, y: thighR.y, z: -thighR.z })).toBeLessThan(1e-6);
        expect(fb.z).toBeCloseTo(-fa.z, 6);
        expect(fb.yaw).toBeCloseTo(-fa.yaw, 6);
        // the whole body: his left where his right was, across the middle
        const ja = retarget(fa, s);
        const jb = retarget(fb, s);
        for (const [l, r] of [
          ['handL', 'handR'],
          ['toeL', 'toeR'],
          ['elL', 'elR'],
          ['kneeL', 'kneeR'],
        ] as [keyof Joints, keyof Joints][]) {
          expect(dist(jb[l], { x: ja[r].x, y: ja[r].y, z: -ja[r].z }), name + ' #' + k + ' ' + l).toBeLessThan(1e-6);
          expect(dist(jb[r], { x: ja[l].x, y: ja[l].y, z: -ja[l].z }), name + ' #' + k + ' ' + r).toBeLessThan(1e-6);
        }
        close(jb.head, { x: ja.head.x, y: ja.head.y, z: -ja.head.z });
      }
    }
  });

  it('time-warps so an event lands when the game wants it', () => {
    const m = clipMeta('jumpshot');
    const w = warp(m, { release: 0.5 });
    expect(w(0.5)).toBeCloseTo(m.events.release, 6);
    expect(w(0)).toBeCloseTo(0, 6);
    // after the anchor the clip plays on at its own speed
    expect(w(0.6) - w(0.5)).toBeCloseTo(0.1, 6);
    // too soon to play the whole wind-up: start partway in, no faster than maxRate
    const quick = warp(m, { release: 0.2 }, { maxRate: 1.5 });
    expect(quick(0.2)).toBeCloseTo(m.events.release, 6);
    expect(quick(0)).toBeCloseTo(m.events.release - 0.3, 6);
    // two anchors: the takeoff and the release both on cue
    const two = warp(m, { takeoff: 0.3, release: 0.62 });
    expect(two(0.3)).toBeCloseTo(m.events.takeoff, 6);
    expect(two(0.62)).toBeCloseTo(m.events.release, 6);
  });

  it('gives whole frames stable cache keys, and loops wrap', () => {
    const run = clips.run;
    const f = frameAt(run, 0.1);
    expect(Number.isInteger(f)).toBe(true);
    expect(frameAt(run, 0.1 + run.meta.duration * 3)).toBe(f);
    expect(mocapKey(run, f)).toBe('mo:run:' + f);
    expect(mocapKey('fall_back', 12, 'pin')).toBe('mo:fall_back:12p');
    // a loop's travel carries on cycle after cycle
    const a = sample(run, 0.05);
    const b = sample(run, 0.05 + run.meta.duration);
    expect(b.x - a.x).toBeCloseTo(run.meta.cycle!.dx, 2);
    // a one-shot clip holds its last frame
    expect(frameAt('fall_back', 99)).toBe(clips.fall_back.frames - 1);
  });
});
