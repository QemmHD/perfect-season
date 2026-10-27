// A BVH motion-capture file read in the browser or a test: the joint hierarchy and every frame's
// joint positions. The game itself plays the compact clips scripts/build_mocap.py makes from
// BVH files (mocap.ts); this is the same reading, for tools and for checking that script.
import type { V3 } from './rig';

export interface BvhJoint {
  name: string;
  parent: number;
  offset: V3;
  channels: string[];
  /** the column of its first channel in a frame */
  col: number;
  /** End Site offset, if the joint ends a chain */
  end?: V3;
}

export interface Bvh {
  joints: BvhJoint[];
  frameTime: number;
  frames: number[][];
}

export function parseBvh(text: string): Bvh {
  const tok = text.split(/\s+/).filter(Boolean);
  let i = 0;
  const next = () => tok[i++];
  const num = () => Number(next());
  if (next() !== 'HIERARCHY') throw new Error('not a BVH file');
  const joints: BvhJoint[] = [];
  // each '{' pushes the joint it opens (or -2 for an End Site)
  const stack: number[] = [];
  let pendingEnd = false;
  let cur = -1;
  let col = 0;
  for (;;) {
    const t = next();
    if (t === undefined) throw new Error('BVH: no MOTION section');
    if (t === 'ROOT' || t === 'JOINT') {
      joints.push({ name: next(), parent: stack.length ? stack[stack.length - 1] : -1, offset: { x: 0, y: 0, z: 0 }, channels: [], col: 0 });
      cur = joints.length - 1;
    } else if (t === 'End') {
      next();
      pendingEnd = true;
    } else if (t === '{') {
      stack.push(pendingEnd ? -2 : cur);
    } else if (t === '}') {
      if (stack.pop() === -2) pendingEnd = false;
    } else if (t === 'OFFSET') {
      const o = { x: num(), y: num(), z: num() };
      if (pendingEnd) joints[stack[stack.length - 2]].end = o;
      else joints[cur].offset = o;
    } else if (t === 'CHANNELS') {
      const n = num();
      joints[cur].channels = tok.slice(i, i + n);
      joints[cur].col = col;
      col += n;
      i += n;
    } else if (t === 'MOTION') break;
    else throw new Error('BVH: unexpected ' + t);
  }
  if (next() !== 'Frames:') throw new Error('BVH: expected Frames:');
  const n = num();
  if (next() !== 'Frame' || next() !== 'Time:') throw new Error('BVH: expected Frame Time:');
  const frameTime = num();
  const frames: number[][] = [];
  for (let k = 0; k < n && i + col <= tok.length; k++) {
    frames.push(tok.slice(i, i + col).map(Number));
    i += col;
  }
  return { joints, frameTime, frames };
}

type M3 = number[];
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mm(a: M3, b: M3): M3 {
  const o: M3 = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
  return o;
}
const mv = (m: M3, v: V3): V3 => ({ x: m[0] * v.x + m[1] * v.y + m[2] * v.z, y: m[3] * v.x + m[4] * v.y + m[5] * v.z, z: m[6] * v.x + m[7] * v.y + m[8] * v.z });
function rot(axis: string, deg: number): M3 {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === 'X') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'Y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Every joint's position in a frame (null: the rest pose), in the file's own axes; End Sites as
 * '<joint>_end'. Rotations apply in the order the channels list them. */
export function bvhPositions(b: Bvh, frame: number[] | null): Record<string, V3> {
  const pos: Record<string, V3> = {};
  const rots: M3[] = [];
  b.joints.forEach((j, k) => {
    let R = I3;
    let t = { x: 0, y: 0, z: 0 };
    if (frame) {
      j.channels.forEach((ch, c) => {
        const val = frame[j.col + c];
        if (ch.endsWith('rotation')) R = mm(R, rot(ch[0], val));
        else if (ch === 'Xposition') t = { ...t, x: val };
        else if (ch === 'Yposition') t = { ...t, y: val };
        else if (ch === 'Zposition') t = { ...t, z: val };
      });
    }
    let p: V3;
    let G: M3;
    if (j.parent < 0) {
      p = { x: j.offset.x + t.x, y: j.offset.y + t.y, z: j.offset.z + t.z };
      G = R;
    } else {
      const pp = pos[b.joints[j.parent].name];
      const o = mv(rots[j.parent], j.offset);
      p = { x: pp.x + o.x, y: pp.y + o.y, z: pp.z + o.z };
      G = mm(rots[j.parent], R);
    }
    pos[j.name] = p;
    rots[k] = G;
    if (j.end) {
      const o = mv(G, j.end);
      pos[j.name + '_end'] = { x: p.x + o.x, y: p.y + o.y, z: p.z + o.z };
    }
  });
  return pos;
}
