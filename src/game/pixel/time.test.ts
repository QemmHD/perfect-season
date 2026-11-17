// players-5: every locomotion memo runs on game time, so nothing a frame shows comes from a moment that
// isn't this one. On a replay's rewind, a SIM jump and a rematch (renderer.resetMotion: fresh memos),
// the first frame after the jump is exactly what a body seen for the first time would show (no turn
// from the old facing, no planted-foot offset, no lean or brake carried over); on a pause or a
// hit-stop (game time frozen) the frame holds, and the first resumed pose is within 20% of his height
// of the last one. Synthetic bodies through the real select-nba motionOf and clips.
import { loadClips, mocapJointsAtFrame, frameAt } from './mocap';
import * as nba from './select-nba';
import type { Look } from './body';
import type { Body } from '../hoops2/types';

const look = { sport: 'nba', ht: 78, wt: 215, num: 3, hair: 0, skin: '#a8714f', hairColor: '#1b1b1f', jersey: '#fff', trim: '#000', shorts: '#fff', socks: '#fff', shoes: '#000' } as unknown as Look;

/** a guard running a curve up the floor, then slowing (game time t) */
function guard(t: number): Body {
  const face = 0.9 * Math.sin(t * 1.3);
  const sp = 14 + 4 * Math.sin(t * 0.7);
  return {
    idx: 1,
    side: 'O',
    p: { id: 'g1', ht: 78, wt: 215, spd: 85, hnd: 80, num: 3 },
    cx: 20,
    cz: 0,
    vx: Math.cos(face) * sp,
    vz: Math.sin(face) * sp,
    h: 0,
    vh: 0,
    face,
    act: 'run',
    actAt: 0,
    energy: 1,
    burst: 1,
  } as unknown as Body;
}

const fresh = (): nba.Memo => ({ gait: { t: 0, frac: 0.29 }, last: null });
const DT = 1 / 60;

/** the frame without its gait phase (which carries on: a stride's phase isn't a pose from elsewhere) */
const carried = (f: nba.BodyFrame) => ({ face: f.face, dip: f.dip, lead: f.lead, ox: f.mo.ox, oy: f.mo.oy, lean: f.mo.lean, clip: f.an.clip, gait: f.an.gait && { clip: f.an.gait.clip, rate: f.an.gait.rate, stride: f.an.gait.stride } });

/** a pose's biggest joint move between two frames, as a share of his height */
function poseJump(a: nba.BodyFrame, b: nba.BodyFrame): number {
  const J = (f: nba.BodyFrame) => (f.an.clip ? mocapJointsAtFrame(f.an.clip, frameAt(f.an.clip, f.an.ct ?? 0, 1), look) : null);
  const ja = J(a);
  const jb = J(b);
  if (!ja || !jb) return 0;
  let worst = 0;
  for (const k of Object.keys(ja) as (keyof typeof ja)[]) worst = Math.max(worst, Math.hypot(ja[k].x - jb[k].x, ja[k].y - jb[k].y, ja[k].z - jb[k].z));
  return worst;
}

beforeAll(async () => {
  await loadClips(nba.CLIPS);
});

describe('discontinuities never blend from the pre-jump pose', () => {
  const play = (m: nba.Memo, from: number, frames: number) => {
    let f: nba.BodyFrame | null = null;
    for (let i = 0; i < frames; i++) f = nba.motionOf(guard(from + i * DT), from + i * DT, false, look, m, null);
    return f!;
  };
  it.each([
    ['a replay rewind', 4, 1.5],
    ['a SIM jump', 4, 12],
    ['a new possession (inbound)', 4, 0.02],
  ])('%s', (_name, before, after) => {
    const m = fresh();
    play(m, 1, (before - 1) / DT);
    // the moment after the jump, carried memo vs a body never seen before (same stride phase)
    const jumped = nba.motionOf(guard(after), after, false, look, m, null);
    const newcomer = fresh();
    newcomer.gait.frac = m.gait.frac;
    const first = nba.motionOf(guard(after), after, false, look, newcomer, null);
    expect(carried(jumped)).toEqual(carried(first));
    expect(jumped.mo.ox).toBe(0);
    expect(jumped.face).toBe(guard(after).face);
  });
  it('a rematch (resetMotion: fresh memos) starts like a first frame', () => {
    const m = fresh();
    play(m, 0.5, 120);
    const re = fresh();
    const a = nba.motionOf(guard(0.5), 0.5, false, look, re, null);
    const b = nba.motionOf(guard(0.5), 0.5, false, look, fresh(), null);
    expect(carried(a)).toEqual(carried(b));
  });
  it.each([
    ['a pause', 90],
    ['a hit-stop', 6],
  ])('%s holds the frame, then resumes within 20% of his height', (_name, frozen) => {
    const m = fresh();
    const t0 = 2;
    const last = play(m, t0 - 60 * DT, 61);
    let held = last;
    for (let i = 0; i < frozen; i++) {
      held = nba.motionOf(guard(t0), t0, false, look, m, null);
      expect(carried(held)).toEqual({ ...carried(last), lead: held.lead, dip: held.dip });
      expect(held.an.ct).toBe(last.an.ct);
    }
    const resumed = nba.motionOf(guard(t0 + DT), t0 + DT, false, look, m, null);
    expect(poseJump(last, resumed)).toBeLessThanOrEqual(0.2);
    // and it carried on: no reset on a freeze
    expect(Math.abs(resumed.face - last.face)).toBeLessThan(0.3);
  });
});
