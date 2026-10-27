#!/usr/bin/env python3
"""Real motion capture for the arcade games' pixel players.

Reads CMU Graphics Lab motion capture trials (the cgspeed / Bruce Hahne BVH conversion), turns each
one into the joint set our rig draws (src/game/pixel/rig.ts: pelvis, hips, knees, ankles, toes,
chest, neck, head, shoulders, elbows, wrists, hands) in the rig's body frame (x forward, y up,
z to his right, the player's height = 1), splits the root motion (ground-plane travel and turning)
from the motion in place, resamples to 30 fps, trims each clip to the useful part, quantizes it and
writes compact JSON:

  src/data/mocap/<name>.json   one clip: bone directions per frame (base64), root track
  src/data/mocap/index.json    every clip's metadata: duration, loop, events, root motion summary

The game keeps each bone's direction from the recording and uses its own bone lengths for each
player (rig.ts shapeOf), so a 6'1" guard and a 7'0" center run the same recorded jump shot with
their own limbs. Standard library only.

  python3 scripts/build_mocap.py                       build every clip in CLIPS
  python3 scripts/build_mocap.py --inspect 124_05      print a trial's signals (to pick trims/events)
  python3 scripts/build_mocap.py --fetch               download the trials CLIPS uses (into .cache)

Data: CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu (funded by NSF EIA-0196217).
See docs/CREDITS.md.
"""
from __future__ import annotations

import base64
import json
import math
import os
import ssl
import struct
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# raw downloads live in the main checkout's .cache (git-ignored), shared by every worktree
CACHE = os.environ.get('MOCAP_CACHE') or os.path.join(ROOT.split('/.claude/worktrees/')[0], '.cache', 'mocap', 'bvh')
OUT = os.path.join(ROOT, 'src', 'data', 'mocap')
MIRROR = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/'
FPS = 30

# The CMU index's frame rate per subject (most are 120; the cgspeed BVH files all say 120, but
# these subjects were captured at 60, so their files play twice too fast unless corrected).
SOURCE_FPS_60 = {75, 77, 79, 80, 62, 88}


# --------------------------------------------------------------------------------------------
# BVH
# --------------------------------------------------------------------------------------------

class Joint:
    __slots__ = ('name', 'parent', 'offset', 'channels', 'children', 'end', 'index')

    def __init__(self, name, parent):
        self.name = name
        self.parent = parent
        self.offset = (0.0, 0.0, 0.0)
        self.channels: list[str] = []
        self.children: list[Joint] = []
        self.end = None  # End Site offset, if any
        self.index = 0  # first channel's column


class Bvh:
    def __init__(self, joints, frames, frame_time):
        self.joints: list[Joint] = joints
        self.frames: list[list[float]] = frames
        self.frame_time: float = frame_time
        self.by_name = {j.name: j for j in joints}


def parse_bvh(text: str) -> Bvh:
    """A BVH file: the joint hierarchy (offsets, channel orders) and the motion's frames."""
    tok = text.split()
    i = 0
    joints: list[Joint] = []
    stack: list[Joint] = []
    col = 0
    if tok[i] != 'HIERARCHY':
        raise ValueError('not a BVH file')
    i += 1
    pending_end = False
    cur = None
    while i < len(tok):
        t = tok[i]
        if t in ('ROOT', 'JOINT'):
            parent = stack[-1] if stack else None
            cur = Joint(tok[i + 1], parent)
            if parent:
                parent.children.append(cur)
            joints.append(cur)
            i += 2
        elif t == 'End':
            pending_end = True
            i += 2  # 'End Site'
        elif t == '{':
            if pending_end:
                stack.append(None)  # type: ignore[arg-type]
            else:
                stack.append(cur)  # type: ignore[arg-type]
            i += 1
        elif t == '}':
            top = stack.pop()
            if top is None:
                pending_end = False
            i += 1
        elif t == 'OFFSET':
            off = (float(tok[i + 1]), float(tok[i + 2]), float(tok[i + 3]))
            if pending_end:
                stack[-2].end = off  # the joint that owns this End Site
            else:
                cur.offset = off  # type: ignore[union-attr]
            i += 4
        elif t == 'CHANNELS':
            n = int(tok[i + 1])
            cur.channels = tok[i + 2:i + 2 + n]  # type: ignore[union-attr]
            cur.index = col  # type: ignore[union-attr]
            col += n
            i += 2 + n
        elif t == 'MOTION':
            i += 1
            break
        else:
            raise ValueError('unexpected token %r' % t)
    # MOTION / Frames: N / Frame Time: dt / numbers
    if tok[i] != 'Frames:':
        raise ValueError('expected Frames:')
    n = int(tok[i + 1])
    if tok[i + 2] != 'Frame' or tok[i + 3] != 'Time:':
        raise ValueError('expected Frame Time:')
    dt = float(tok[i + 4])
    i += 5
    vals = tok[i:]
    if len(vals) < n * col:
        n = len(vals) // col
    frames = [[float(v) for v in vals[k * col:(k + 1) * col]] for k in range(n)]
    return Bvh(joints, frames, dt)


def _rot(axis: str, deg: float):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    if axis == 'X':
        return (1, 0, 0, 0, c, -s, 0, s, c)
    if axis == 'Y':
        return (c, 0, s, 0, 1, 0, -s, 0, c)
    return (c, -s, 0, s, c, 0, 0, 0, 1)


def _mm(a, b):
    return (
        a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
        a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
        a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    )


def _mv(m, v):
    return (m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2])


I3 = (1, 0, 0, 0, 1, 0, 0, 0, 1)


def fk(b: Bvh, frame: list[float] | None) -> dict[str, tuple]:
    """World positions of every joint (and '<name>_end' for End Sites) in the file's own axes.
    frame None gives the rest pose."""
    pos: dict[str, tuple] = {}
    rot: dict[str, tuple] = {}
    for j in b.joints:
        R = I3
        t = (0.0, 0.0, 0.0)
        if frame is not None:
            for k, ch in enumerate(j.channels):
                v = frame[j.index + k]
                if ch.endswith('rotation'):
                    R = _mm(R, _rot(ch[0], v))
                elif ch == 'Xposition':
                    t = (v, t[1], t[2])
                elif ch == 'Yposition':
                    t = (t[0], v, t[2])
                elif ch == 'Zposition':
                    t = (t[0], t[1], v)
        if j.parent is None:
            p = (j.offset[0] + t[0], j.offset[1] + t[1], j.offset[2] + t[2])
            G = R
        else:
            pp = pos[j.parent.name]
            PR = rot[j.parent.name]
            o = _mv(PR, j.offset)
            p = (pp[0] + o[0], pp[1] + o[1], pp[2] + o[2])
            G = _mm(PR, R)
        pos[j.name] = p
        rot[j.name] = G
        if j.end is not None:
            o = _mv(G, j.end)
            pos[j.name + '_end'] = (p[0] + o[0], p[1] + o[1], p[2] + o[2])
    return pos


# --------------------------------------------------------------------------------------------
# vectors
# --------------------------------------------------------------------------------------------

def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    return math.sqrt(dot(a, a))


def unit(a, fallback=(0.0, 1.0, 0.0)):
    n = norm(a)
    return mul(a, 1 / n) if n > 1e-9 else fallback


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def rotate(v, axis, ang):
    """Rodrigues: v turned by ang (radians) about the unit axis."""
    c, s = math.cos(ang), math.sin(ang)
    return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)))


# --------------------------------------------------------------------------------------------
# the CMU skeleton -> our joints
# --------------------------------------------------------------------------------------------

# Our rig's axes: x forward, y up, z to his right. The CMU BVH files: x to the actor's left (in
# the rest pose), y up, z forward. Both right-handed, so this is a proper rotation.
def to_rig(p):
    return (p[2], p[1], -p[0])


def our_points(w: dict[str, tuple]) -> dict[str, tuple]:
    """The points we keep, in the rig's axes (still in the file's units, not yet body-relative)."""
    g = lambda n: to_rig(w[n])
    o = {
        'hipL': g('LeftUpLeg'), 'hipR': g('RightUpLeg'),
        'kneeL': g('LeftLeg'), 'kneeR': g('RightLeg'),
        'ankleL': g('LeftFoot'), 'ankleR': g('RightFoot'),
        'ballL': g('LeftToeBase'), 'ballR': g('RightToeBase'),
        'toeL': g('LeftToeBase_end'), 'toeR': g('RightToeBase_end'),
        'c7': g('Neck1'), 'headJ': g('Head'), 'headTop': g('Head_end'),
        'shL': g('LeftArm'), 'shR': g('RightArm'),
        'elL': g('LeftForeArm'), 'elR': g('RightForeArm'),
        'wrL': g('LeftHand'), 'wrR': g('RightHand'),
        'fingL': g('LeftHandIndex1_end'), 'fingR': g('RightHandIndex1_end'),
    }
    o['pelvis'] = lerp(o['hipL'], o['hipR'], 0.5)
    o['head'] = lerp(o['headJ'], o['headTop'], 0.5)
    return o


# The bones we store: (name, from, to). The game rebuilds the body from the pelvis out along
# these directions with its own lengths (rig.ts shapeOf), so this order is the decode order.
BONES = [
    ('hipAxis', 'hipL', 'hipR'),       # pelvis orientation: left hip to right hip
    ('thighL', 'hipL', 'kneeL'),
    ('shinL', 'kneeL', 'ankleL'),
    ('footL', 'ankleL', 'toeL'),
    ('thighR', 'hipR', 'kneeR'),
    ('shinR', 'kneeR', 'ankleR'),
    ('footR', 'ankleR', 'toeR'),
    ('spine', 'pelvis', 'c7'),         # pelvis to the base of the neck
    ('neck', 'c7', 'head'),            # base of the neck to the middle of the head
    ('shAxis', 'shL', 'shR'),          # shoulders: left to right
    ('upperL', 'shL', 'elL'),
    ('foreL', 'elL', 'wrL'),
    ('handL', 'wrL', 'fingL'),
    ('upperR', 'shR', 'elR'),
    ('foreR', 'elR', 'wrR'),
    ('handR', 'wrR', 'fingR'),
]


# --------------------------------------------------------------------------------------------
# a trial: every source frame's points, body-relative pieces, calibration
# --------------------------------------------------------------------------------------------

# How far the clips tip the head forward of the neck line: our pixel heads sit a little forward
# (the face), as in rig.ts's hand-keyed poses.
NECK_TILT = 0.14
# Lift below this many leg lengths counts as standing on the floor (mocap jitter).
CONTACT = 0.035


def yaw_of(p) -> float:
    """Which way the body faces (radians, rig convention: 0 = +x, pi/2 = +z), from the hips and
    the shoulders together (they counter-rotate in a stride; their sum is steady)."""
    r1 = unit((p['hipR'][0] - p['hipL'][0], 0, p['hipR'][2] - p['hipL'][2]), (0, 0, 1))
    r2 = unit((p['shR'][0] - p['shL'][0], 0, p['shR'][2] - p['shL'][2]), (0, 0, 1))
    r = add(r1, r2)
    # forward = up x right = (r.z, 0, -r.x)
    return math.atan2(-r[0], r[2])


def unwrap(a: list[float]) -> list[float]:
    out = [a[0]]
    for x in a[1:]:
        d = x - out[-1]
        d -= 2 * math.pi * round(d / (2 * math.pi))
        out.append(out[-1] + d)
    return out


def gauss(a: list[float], sigma: float) -> list[float]:
    """Gaussian smoothing (sigma in samples), edges held."""
    if sigma <= 0:
        return list(a)
    r = int(sigma * 3) + 1
    w = [math.exp(-0.5 * (k / sigma) ** 2) for k in range(-r, r + 1)]
    n = len(a)
    out = []
    for i in range(n):
        s = 0.0
        ws = 0.0
        for k in range(-r, r + 1):
            j = min(n - 1, max(0, i + k))
            s += a[j] * w[k + r]
            ws += w[k + r]
        out.append(s / ws)
    return out


class Trial:
    """One CMU trial, read once: its points at every source frame in the rig's axes, measured in
    the subject's leg lengths (hip to ankle), with the floor at y = 0."""

    def __init__(self, tid: str):
        b = load(tid)
        self.tid = tid
        self.fps = source_fps(tid)
        rest = our_points(fk(b, None))
        H = rest['headTop'][1] - min(rest['toeL'][1], rest['toeR'][1])
        leg = norm(sub(rest['kneeL'], rest['hipL'])) + norm(sub(rest['ankleL'], rest['kneeL']))
        self.leg_per_height = leg / H
        raw = [our_points(fk(b, fr)) for fr in b.frames]
        # the floor: where the lower toe is most of the time (a low percentile, not the minimum,
        # which is a marker's dip through the floor)
        toes = sorted(min(p['toeL'][1], p['toeR'][1]) for p in raw)
        floor = toes[len(toes) // 8]
        self.pts = [{k: (v[0] / leg, (v[1] - floor) / leg, v[2] / leg) for k, v in p.items()} for p in raw]
        self.n = len(self.pts)
        # the foot flat on the floor: how far our ankle-to-toe line points down then, and how high
        # the ankle stands; the game's feet are flat when standing
        self.flat = {}
        for s in 'LR':
            low_ankle = sorted(p['ankle' + s][1] for p in self.pts)[len(self.pts) // 50]
            pitches = []
            heights = []
            for p in self.pts:
                a, t = p['ankle' + s], p['toe' + s]
                if t[1] < 0.03 and a[1] < low_ankle + 0.03:
                    d = sub(t, a)
                    pitches.append(math.atan2(-d[1], math.hypot(d[0], d[2])))
                    heights.append(a[1])
            pitches.sort()
            heights.sort()
            self.flat[s] = (pitches[len(pitches) // 2] if pitches else 0.3, heights[len(heights) // 2] if heights else low_ankle)
        self.yaw_raw = unwrap([yaw_of(p) for p in self.pts])

    def at(self, t: float) -> dict[str, tuple]:
        """Points at a time (seconds), interpolated."""
        x = max(0.0, min(self.n - 1.0, t * self.fps))
        i = min(self.n - 2, int(x))
        a = x - i
        p, q = self.pts[i], self.pts[i + 1]
        return {k: lerp(p[k], q[k], a) for k in p}

    def series(self, f, t0: float, t1: float):
        """f(points) at every source frame from t0 to t1: [(t, value)]."""
        i0 = max(0, int(t0 * self.fps))
        i1 = min(self.n - 1, int(math.ceil(t1 * self.fps)))
        return [(i / self.fps, f(self.pts[i])) for i in range(i0, i1 + 1)]

    def clear(self, p, s: str) -> float:
        """How high a foot is off the floor (leg lengths): its toe or its heel, whichever is lower."""
        return max(0.0, min(p['toe' + s][1], p['ankle' + s][1] - self.flat[s][1]))

    def lift(self, p) -> float:
        return min(self.clear(p, 'L'), self.clear(p, 'R'))

    def yaw_at(self, t: float, sigma_s: float) -> float:
        sm = self._smooth(sigma_s)
        x = max(0.0, min(self.n - 1.0, t * self.fps))
        i = min(self.n - 2, int(x))
        return sm[i] + (sm[i + 1] - sm[i]) * (x - i)

    _sm_cache: dict = {}

    def _smooth(self, sigma_s: float):
        key = (self.tid, sigma_s)
        if key not in Trial._sm_cache:
            Trial._sm_cache[key] = gauss(self.yaw_raw, sigma_s * self.fps)
        return Trial._sm_cache[key]

    def vel(self, joint: str, t: float):
        h = 2 / self.fps
        return mul(sub(self.at(t + h)[joint], self.at(t - h)[joint]), 1 / (2 * h))


_TRIALS: dict[str, Trial] = {}


def trial(tid: str) -> Trial:
    if tid not in _TRIALS:
        _TRIALS[tid] = Trial(tid)
    return _TRIALS[tid]


def to_body(v, yaw: float):
    """A world-space (rig axes) vector into the body frame that faces `yaw`."""
    c, s = math.cos(yaw), math.sin(yaw)
    return (v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c)


def bone_dirs(T: Trial, p, yaw: float, flip_knees: bool = False) -> list[tuple]:
    """The stored bones' directions in the body frame, with the rig's foot and head conventions.
    flip_knees: the trial's skeleton fit bends the knees backward (subject 79); put each knee on
    the other side of its hip-to-ankle line, which keeps the hips, the ankles and both bones' lengths."""
    loc = {k: to_body(sub(v, p['pelvis']), yaw) for k, v in p.items()}
    if flip_knees:
        for s in 'LR':
            h, k, a = loc['hip' + s], loc['knee' + s], loc['ankle' + s]
            ax = unit(sub(a, h))
            v = sub(k, h)
            loc['knee' + s] = add(h, sub(mul(ax, 2 * dot(v, ax)), v))
    out = []
    d = {}
    for name, a, b in BONES:
        d[name] = unit(sub(loc[b], loc[a]))
    for s in 'LR':
        # the foot: turned up by its flat-on-the-floor angle, about the ankle's hinge
        f = d['foot' + s]
        up = mul(d['shin' + s], -1)
        ax = cross(f, up)
        ax = unit(ax, (0, 0, 1)) if norm(ax) > 0.2 else (0, 0, 1)
        d['foot' + s] = unit(rotate(f, ax, T.flat[s][0]))
    # the head: a little forward of the neck line, about the shoulders' axis
    left = mul(d['shAxis'], -1)
    d['neck'] = unit(rotate(d['neck'], left, NECK_TILT))
    for name, _, _ in BONES:
        out.append(d[name])
    return out


# --------------------------------------------------------------------------------------------
# events
# --------------------------------------------------------------------------------------------

def _air(T: Trial, t0: float, t1: float):
    """The longest stretch in [t0, t1] with both feet off the floor: (takeoff, land) times."""
    s = T.series(T.lift, t0, t1)
    best = None
    cur = None
    for t, v in s:
        if v > CONTACT:
            if cur is None:
                cur = t
        elif cur is not None:
            if best is None or t - cur > best[1] - best[0]:
                best = (cur, t)
            cur = None
    if cur is not None and (best is None or s[-1][0] - cur > best[1] - best[0]):
        best = (cur, s[-1][0])
    if best is None:
        raise ValueError('%s: no jump between %.2f and %.2f' % (T.tid, t0, t1))
    return best


def _argmax(series, sign=1):
    return max(series, key=lambda tv: sign * tv[1])[0]


def detect(T: Trial, kind: str, t0: float, t1: float, ev: dict) -> float | list[float]:
    """An event's source time (or times), found from the motion. Kinds:
    takeoff / land / apex: the biggest jump in the clip
    dip: the lowest pelvis before takeoff (the load)
    release: the shooting hand's fingertips at their highest (the ball leaves the hand)
    releaseL: the same, left hand
    set: the ball (between the wrists) passing the forehead on the way up
    gather: the hands coming together before the shot (the start of the shooting motion)
    throw: the throwing (right) hand at its fastest forward
    contact: the kicking (right) foot at its fastest
    impact: a fall's pelvis hitting the floor
    ground: still on the floor after a fall
    bounce: dribble bounces (the ball on the floor: between the push and the next catch)
    stepL / stepR: footfalls"""
    if kind in ('takeoff', 'land', 'apex'):
        a, b = _air(T, t0, t1)
        if kind == 'takeoff':
            return a
        if kind == 'land':
            return b
        return _argmax(T.series(lambda p: p['pelvis'][1], a, b))
    if kind == 'dip':
        a = ev.get('takeoff') or _air(T, t0, t1)[0]
        return _argmax(T.series(lambda p: p['pelvis'][1], max(t0, a - 0.7), a), -1)
    if kind in ('release', 'releaseL'):
        s = 'R' if kind == 'release' else 'L'
        a = ev.get('takeoff', t0)
        b = ev.get('land', t1)
        return _argmax(T.series(lambda p: p['fing' + s][1], max(t0, a - 0.15), b))
    if kind == 'set':
        # the ball (between the wrists) up past the forehead, on its way to the release
        rel = ev['release']
        s = T.series(lambda p: (p['wrL'][1] + p['wrR'][1]) / 2 - (p['head'][1] + 0.06), ev.get('dip', t0), rel)
        for t, v in s:
            if v > 0.0:
                return t
        return rel
    if kind == 'gather':
        # the start of the load: the pelvis starting down into the dip
        dip = ev.get('dip') or detect(T, 'dip', t0, t1, ev)
        s = T.series(lambda p: p['pelvis'][1], max(t0, dip - 0.6), dip)
        top = max(v for _, v in s)
        low = s[-1][1]
        for t, v in reversed(s):
            if v >= top - 0.15 * (top - low):
                return t
        return s[0][0]
    if kind == 'throw':
        def fwd_speed(t):
            y = T.yaw_at(t, 0.5)
            v = T.vel('wrR', t)
            return to_body(v, y)[0]
        return _argmax([(t, fwd_speed(t)) for t, _ in T.series(lambda p: 0, t0, t1)])
    if kind in ('reach', 'reach2'):
        # the right hand (or both) furthest out in front: a stiff arm, a catch
        def out(t):
            y = T.yaw_at(t, 0.3)
            p = T.at(t)
            r = to_body(sub(p['wrR'], p['pelvis']), y)[0]
            if kind == 'reach':
                return r
            return min(r, to_body(sub(p['wrL'], p['pelvis']), y)[0])
        return _argmax([(t, out(t)) for t, _ in T.series(lambda p: 0, t0, t1)])
    if kind == 'plant':
        # the kick's plant: the left foot down just before contact
        c = ev['contact']
        s = T.series(lambda p: T.clear(p, 'L'), max(t0, c - 0.5), c)
        for t, v in reversed(s):
            if v > CONTACT:
                return t
        return s[0][0]
    if kind == 'contact':
        return _argmax([(t, norm(T.vel('toeR', t))) for t, _ in T.series(lambda p: 0, t0, t1)])
    if kind == 'impact':
        s = T.series(lambda p: p['pelvis'][1], t0, t1)
        lo = min(v for _, v in s)
        for t, v in s:
            if v < lo + 0.06:
                return t
    if kind == 'ground':
        imp = ev.get('impact') or detect(T, 'impact', t0, t1, ev)
        prev = None
        for t, _ in T.series(lambda p: 0, imp + 0.1, t1):
            sp = sum(norm(T.vel(j, t)) for j in ('pelvis', 'c7', 'head', 'kneeL', 'kneeR'))
            if sp < 0.9:
                return t
            prev = t
        return prev if prev is not None else t1
    if kind == 'bounce':
        s = T.series(lambda p: p['wrR'][1], t0, t1)
        sm = gauss([v for _, v in s], 0.03 * T.fps)
        ts = [t for t, _ in s]
        ext = []
        for i in range(1, len(sm) - 1):
            if sm[i] < sm[i - 1] and sm[i] <= sm[i + 1]:
                ext.append(('min', ts[i]))
            if sm[i] > sm[i - 1] and sm[i] >= sm[i + 1]:
                ext.append(('max', ts[i]))
        out = []
        for (k1, ta), (k2, tb) in zip(ext, ext[1:]):
            if k1 == 'min' and k2 == 'max':
                out.append((ta + tb) / 2)
        return out
    if kind in ('stepL', 'stepR'):
        s = kind[-1]
        # (from a little before the clip, so a foot already coming down at the start counts)
        series = T.series(lambda p: T.clear(p, s), max(0.0, t0 - 0.4), t1)
        out = []
        up = series[0][1] > 0.04
        for t, v in series:
            if up and v < 0.025:
                out.append(t)
                up = False
            elif not up and v > 0.06:
                up = True
        return out
    raise ValueError('unknown event kind %r' % kind)


# --------------------------------------------------------------------------------------------
# clips
# --------------------------------------------------------------------------------------------

def pose_dist(a: list[tuple], b: list[tuple]) -> float:
    return sum(norm(sub(x, y)) for x, y in zip(a, b))


def build_clip(name: str, spec: dict) -> tuple[dict, dict]:
    """One clip: (the clip file, its index entry)."""
    T = trial(spec['src'])
    t0, t1 = spec['start'], spec['end']
    loop = spec.get('loop', False)
    mode = spec.get('yaw', 'fixed')
    sigma = spec.get('sigma', 0.4)
    turn = math.radians(spec.get('turn', 0))
    flip = spec.get('flip_knees', False)

    # events first (a fixed facing can hang on one, like the release)
    ev: dict[str, float] = {}
    beats: dict[str, list[float]] = {}
    # detectors that lean on others run after them
    order = ['takeoff', 'land', 'apex', 'dip', 'release', 'releaseL', 'throw', 'contact', 'impact', 'gather', 'set', 'ground', 'plant']
    rank = lambda kv: order.index(kv[1]) if isinstance(kv[1], str) and kv[1] in order else -1
    for k, v in sorted(spec.get('events', {}).items(), key=rank):
        if isinstance(v, (int, float)):
            ev[k] = float(v)
        else:
            r = detect(T, v, t0, t1, ev)
            if isinstance(r, list):
                beats[k] = r
            else:
                ev[k] = r

    # a loop ends where the motion best matches its start (searched near the asked end)
    if loop:
        d0 = bone_dirs(T, T.at(t0), T.yaw_at(t0, sigma))
        d0b = bone_dirs(T, T.at(t0 + 1 / FPS), T.yaw_at(t0 + 1 / FPS, sigma))
        best = None
        k = -0.3
        while k <= 0.3:
            te = t1 + k
            if te > t0 + 0.3 and te < T.n / T.fps:
                d1 = bone_dirs(T, T.at(te), T.yaw_at(te, sigma))
                # match the motion too: the frame just after each
                d1b = bone_dirs(T, T.at(te + 1 / FPS), T.yaw_at(te + 1 / FPS, sigma))
                c = pose_dist(d0, d1) + 0.5 * pose_dist(d0b, d1b)
                if best is None or c < best[0]:
                    best = (c, te)
            k += 1 / T.fps
        t1 = best[1]

    if not loop:
        # whole frames
        t1 = t0 + max(1, round((t1 - t0) * FPS)) / FPS
    dur = t1 - t0
    n = max(2, round(dur * FPS)) if loop else max(2, round(dur * FPS) + 1)
    step = dur / n if loop else dur / (n - 1)
    times = [t0 + i * step for i in range(n)]

    # the facing the body frame follows
    if mode == 'smooth':
        yaw_of_t = lambda t: T.yaw_at(t, sigma) + turn
    else:
        face = spec.get('face', t0)
        if isinstance(face, str) and face.startswith('@'):
            # '@<event>': the hips' and shoulders' facing at that moment (a shot squares up)
            ref = T.yaw_at(ev[face[1:]], 0.05)
        elif isinstance(face, str):
            # 'vel:<joint>@<event>': the way that joint moves at that moment (a throw, a kick)
            j, e = face[4:].split('@')
            te = ev[e] if e in ev else float(e)
            v = T.vel(j, te)
            ref = math.atan2(v[2], v[0])
        else:
            ref = T.yaw_at(face, 0.05)
        yaw_of_t = lambda t: ref + turn

    frames = []
    root = []
    p0 = T.at(t0)['pelvis']
    yaw0 = yaw_of_t(t0)

    def travel(ta: float, tb: float):
        """Ground travel from ta to tb in the clip's root frame. With a fixed facing, simply the
        displacement in that facing; following the turns ('smooth'), each bit of travel is taken in
        the facing he had then, so the path comes out straight (the turning is in the yaw track)."""
        if mode != 'smooth':
            a, b = T.at(ta)['pelvis'], T.at(tb)['pelvis']
            g = to_body((b[0] - a[0], 0, b[2] - a[2]), yaw0)
            return g[0], g[2]
        x = z = 0.0
        k = max(1, int((tb - ta) * T.fps))
        for i in range(k):
            ua = ta + (tb - ta) * i / k
            ub = ta + (tb - ta) * (i + 1) / k
            a, b = T.at(ua)['pelvis'], T.at(ub)['pelvis']
            g = to_body((b[0] - a[0], 0, b[2] - a[2]), yaw_of_t((ua + ub) / 2))
            x += g[0]
            z += g[2]
        return x, z

    gx = gz = 0.0
    prev_t = t0
    for t in times:
        p = T.at(t)
        y = yaw_of_t(t)
        frames.append(bone_dirs(T, p, y, flip))
        dx, dz = travel(prev_t, t)
        gx += dx
        gz += dz
        prev_t = t
        root.append((gx, gz, y - yaw0, T.lift(p), p['pelvis'][1]))

    if loop:
        # spread what's left of the seam over the cycle, so the last frame runs into the first
        end = bone_dirs(T, T.at(t1), yaw_of_t(t1), flip)
        pe = T.at(t1)
        for i in range(n):
            a = i / n
            frames[i] = [unit(add(d, mul(sub(s0, se), a))) for d, s0, se in zip(frames[i], frames[0], end)]
            r = root[i]
            root[i] = (r[0], r[1], r[2], max(0.0, r[3] + (root[0][3] - T.lift(pe)) * a), r[4] + (root[0][4] - pe['pelvis'][1]) * a)
        ex, ez = travel(times[-1], t1)
        cycle = {'dx': round(gx + ex, 3), 'dz': round(gz + ez, 3), 'turn': round(yaw_of_t(t1) - yaw0, 3)}
    else:
        cycle = None

    # pack: per frame 5 int16 (root x, z in 1/1000 legs; yaw 1/1000 rad; lift, pelvis height
    # 1/1000 legs) then 3 int8 per bone (direction * 127)
    buf = bytearray()
    q = lambda x: max(-32767, min(32767, round(x * 1000)))
    for r, dirs in zip(root, frames):
        buf += struct.pack('<5h', *(q(x) for x in r))
        for d in dirs:
            buf += struct.pack('<3b', *(max(-127, min(127, round(c * 127))) for c in d))

    rel = lambda t: round(t - t0, 3)
    events = {k: rel(v) for k, v in sorted(ev.items(), key=lambda kv: kv[1]) if t0 - 1e-6 <= v <= t1 + 1e-6}
    if loop:
        # a loop's beats, folded into one cycle
        beat_out = {}
        for k, v in beats.items():
            folded = []
            for t in sorted((t - t0) % dur for t in v if t0 - dur <= t < t1):
                # the same footfall seen at both ends of the cycle counts once
                if not any(min(abs(t - u), dur - abs(t - u)) < 0.06 for u in folded):
                    folded.append(round(t, 3))
            beat_out[k] = folded
    else:
        beat_out = {k: [rel(t) for t in v if t0 <= t <= t1] for k, v in beats.items()}
    last = root[-1]
    dist = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(root, root[1:]))
    meta = {
        'src': spec['src'],
        'desc': spec.get('desc', ''),
        'frames': n,
        'fps': round((n if loop else n - 1) / dur, 4),
        'duration': round(dur, 4),
        'loop': loop,
        'yaw': mode,
        'events': events,
    }
    if beat_out:
        meta['beats'] = beat_out
    meta['root'] = {
        'dx': round(last[0], 3), 'dz': round(last[1], 3), 'turn': round(last[2], 3),
        'speed': round(dist / dur, 3), 'peak': round(max(r[3] for r in root), 3),
    }
    if cycle:
        meta['cycle'] = cycle
    if spec.get('mirror'):
        meta['mirror'] = spec['mirror']
    if spec.get('tags'):
        meta['tags'] = spec['tags']
    clip = {
        'name': name,
        'src': spec['src'],
        'bones': [b[0] for b in BONES],
        'frames': n,
        'fps': meta['fps'],
        'data': base64.b64encode(bytes(buf)).decode('ascii'),
    }
    return clip, meta


def source_fps(tid: str) -> int:
    return 60 if int(tid.split('_')[0]) in SOURCE_FPS_60 else 120


def bvh_url(tid: str) -> str:
    subj, trial = tid.split('_')
    s = int(subj)
    name = ('%02d_%s.bvh' % (s, trial)) if s < 100 else ('%d_%s.bvh' % (s, trial))
    return MIRROR + '%03d/' % s + name


def fetch(tid: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, tid + '.bvh')
    if not os.path.exists(dst):
        ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or None)
        data = urllib.request.urlopen(urllib.request.Request(bvh_url(tid)), context=ctx, timeout=60).read()
        with open(dst, 'wb') as f:
            f.write(data)
    return dst


def load(tid: str) -> Bvh:
    with open(fetch(tid)) as f:
        return parse_bvh(f.read())


# --------------------------------------------------------------------------------------------
# the clips: which trial, which stretch of it, how its facing works, its events
# --------------------------------------------------------------------------------------------
# start / end: seconds into the trial. yaw: 'fixed' keeps every turn in the pose (the clip faces
# one way: `face` is the moment whose facing counts, or 'vel:<joint>@<event>' to face the way a
# hand or foot moves then; `turn` adds degrees); 'smooth' takes the slow turning out of the pose
# into the root track (locomotion), leaving the hips' and shoulders' swing in it. events: a
# trial time, or a detector from detect(). mirror: also offer the clip mirrored under this name.

CLIPS: dict[str, dict] = {}

SHOT = {'gather': 'gather', 'dip': 'dip', 'set': 'set', 'takeoff': 'takeoff', 'apex': 'apex', 'release': 'release', 'land': 'land'}
JUMP = {'takeoff': 'takeoff', 'apex': 'apex', 'land': 'land'}
STEPS = {'stepL': 'stepL', 'stepR': 'stepR'}
FALL = {'impact': 'impact', 'ground': 'ground'}

# ---- basketball ----
CLIPS['jumpshot'] = dict(src='124_05', start=2.75, end=4.15, yaw='smooth', sigma=0.12, events=SHOT, tags=['nba'],
                         desc='jump shot: step in, dip, ball up past the forehead, release at the top, land')
CLIPS['layup'] = dict(src='124_06', start=2.45, end=4.0, yaw='smooth', sigma=0.12, events={**JUMP, 'release': 'release'}, tags=['nba'],
                      desc='layup off one foot: last two steps, plant, right hand lays it in at full stretch (also the driving jump for a dunk)')
CLIPS['jump'] = dict(src='016_03', start=0.8, end=2.6, events={'dip': 'dip', **JUMP}, tags=['nba', 'nfl'],
                     desc='two-foot vertical jump from a deep load (dunks from a standstill, rebounds, blocks)')
CLIPS['dribble'] = dict(src='006_13', start=2.0, end=3.4, yaw='smooth', loop=True, events={'bounce': 'bounce', **STEPS}, tags=['nba'],
                        desc='dribbling on the move, right hand (walking pace: speed it up for a jog)')
CLIPS['crossover'] = dict(src='006_12', start=1.0, end=2.0, yaw='smooth', events={'cross': 1.4}, mirror='crossover_l', tags=['nba'],
                          desc='crossover: right-hand dribble, ball across to the left hand (the mirror goes left to right)')
CLIPS['shuffle'] = dict(src='102_27', start=0.45, end=1.4, loop=True, events=STEPS, mirror='shuffle_l', tags=['nba'],
                        desc='defensive slide to his right: low, wide, hands out (the mirror slides left)')
CLIPS['ready'] = dict(src='140_06', start=4.4, end=7.4, loop=True, events={}, tags=['nba', 'nfl'],
                      desc='ready stance: knees bent, hands up, weight shifting (also a two-point stance)')
CLIPS['jog'] = dict(src='016_35', start=0.2, end=1.3, yaw='smooth', loop=True, events=STEPS, tags=['nba', 'nfl'], desc='jog')
CLIPS['run'] = dict(src='102_10', start=0.1, end=0.8, yaw='smooth', sigma=0.2, loop=True, events=STEPS, tags=['nba', 'nfl'], desc='run (a basketball player, no ball)')
CLIPS['sprint'] = dict(src='143_01', start=0.1, end=0.8, yaw='smooth', sigma=0.2, loop=True, events=STEPS, tags=['nba', 'nfl'], desc='sprint')
CLIPS['cut'] = dict(src='102_18', start=0.4, end=1.4, face=1.2, events={'plant': 0.95, **STEPS}, mirror='cut_l', tags=['nba', 'nfl'],
                    desc='jab step left, plant and cut hard right (the mirror cuts left)')
CLIPS['backpedal'] = dict(src='136_11', start=2.0, end=4.0, yaw='smooth', loop=True, events=STEPS, tags=['nba', 'nfl'],
                          desc='backpedal: crouched, stepping backward (play faster for a quick drop)')
CLIPS['celebrate'] = dict(src='079_69', start=6.0, end=8.4, events={}, tags=['nba', 'nfl'], desc='celebration: both arms thrown up and out, held, then down')
CLIPS['stumble'] = dict(src='104_13', start=0.7, end=1.75, yaw='smooth', events={}, mirror='stumble_m', tags=['nba', 'nfl'],
                        desc='stumble: lurches forward, arms flung out, catches himself')
CLIPS['fall_back'] = dict(src='090_18', start=0.55, end=2.4, face=0.5, events=FALL, mirror='fall_back_m', tags=['nba', 'nfl'],
                          desc='knocked down backward: feet go, falls flat on his back (posterized, run over)')
CLIPS['slip'] = dict(src='090_17', start=2.4, end=4.4, face=2.6, events=FALL, mirror='slip_m', tags=['nba', 'nfl'],
                     desc='feet fly out from under him, lands on his back legs up (ankle breaker)')
CLIPS['fall_forward'] = dict(src='090_16', start=3.1, end=4.6, face=2.3, events=FALL, mirror='fall_forward_m', tags=['nba', 'nfl'],
                             desc='pitched forward through the air, lands flat on his front (starts airborne)')
CLIPS['getup'] = dict(src='140_08', start=1.5, end=5.6, events={}, tags=['nba', 'nfl'], desc='gets up from lying on his back')
CLIPS['getup_front'] = dict(src='140_01', start=1.8, end=4.8, events={}, tags=['nba', 'nfl'], desc='gets up from lying on his front')

# ---- football ----
# (079_91's skeleton fit bends the knees backward in every frame: flip_knees puts them right)
CLIPS['throw'] = dict(src='079_91', start=2.3, end=5.0, face='vel:wrR@release', flip_knees=True, events={'release': 'throw'}, tags=['nfl'],
                      desc='quarterback pass: ball up by the ear, stride, overhand release, follow-through')
CLIPS['catch'] = dict(src='033_01', start=8.9, end=9.8, events={'catch': 'reach2'}, tags=['nfl'], desc='catch at the chest, both hands')
CLIPS['catch_run'] = dict(src='143_22', start=1.15, end=2.35, events={'catch': 'reach2'}, tags=['nfl'], desc='reaches out low for the ball, then turns upfield')
CLIPS['block'] = dict(src='082_06', start=3.0, end=4.6, loop=True, events=STEPS, tags=['nfl'], desc='drive block: low, both hands into the man, short driving steps')
CLIPS['stiff_arm'] = dict(src='143_23', start=0.95, end=1.5, events={'extend': 'reach'}, tags=['nfl'], desc='stiff arm: right arm punched straight out (hold the extend frame)')
CLIPS['kick'] = dict(src='010_01', start=4.0, end=5.6, face='vel:toeR@contact', events={'plant': 'plant', 'contact': 'contact'}, tags=['nfl'],
                     desc='kick: approach, plant, right leg swings through the ball')
CLIPS['dive'] = dict(src='090_16', start=2.45, end=4.6, face=2.3, events={'takeoff': 'takeoff', 'impact': 'impact', 'ground': 'ground'}, tags=['nfl'],
                     desc='dive: gathers, launches forward, lands flat on his front (diving tackle or catch)')

def write_all(names: list[str] | None = None):
    os.makedirs(OUT, exist_ok=True)
    index_path = os.path.join(OUT, 'index.json')
    index = {}
    if names and os.path.exists(index_path):
        with open(index_path) as f:
            index = json.load(f)['clips']
    total = 0
    for name, spec in CLIPS.items():
        if names and name not in names:
            continue
        clip, meta = build_clip(name, spec)
        with open(os.path.join(OUT, name + '.json'), 'w') as f:
            json.dump(clip, f, separators=(',', ':'))
            f.write('\n')
        index[name] = meta
        size = os.path.getsize(os.path.join(OUT, name + '.json'))
        total += size
        ev = ' '.join('%s=%.2f' % kv for kv in meta['events'].items())
        print('%-14s %s %5.2fs %3d fr %6d B  %s' % (name, spec['src'], meta['duration'], meta['frames'], size, ev))
    for name in list(index):
        if name not in CLIPS:
            del index[name]
    with open(index_path, 'w') as f:
        json.dump({
            'credit': 'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.',
            'units': 'lengths in the subject\'s leg lengths (hip to ankle); times in seconds',
            'bones': [b[0] for b in BONES],
            'clips': {k: index[k] for k in CLIPS if k in index},
        }, f, indent=1)
        f.write('\n')
    print('%d bytes in clips written' % total)


def inspect(tid: str, t0: float = 0, t1: float = 1e9, step: float = 0.1):
    T = trial(tid)
    print('%s: %d frames at %d fps (%.2f s); leg/height %.3f; flat feet L %.2f rad %.3f R %.2f rad %.3f' % (
        tid, T.n, T.fps, T.n / T.fps, T.leg_per_height, T.flat['L'][0], T.flat['L'][1], T.flat['R'][0], T.flat['R'][1]))
    print('    t  pelY  lift clrL clrR  wrL  wrR  fngR head  wrRx  spd   yaw  lean')
    t = max(0, t0)
    prev = None
    end = min(t1, (T.n - 1) / T.fps)
    while t <= end + 1e-9:
        p = T.at(t)
        y = T.yaw_raw[min(T.n - 1, int(t * T.fps))]
        spd = 0.0
        if prev is not None:
            spd = math.hypot(p['pelvis'][0] - prev[0], p['pelvis'][2] - prev[2]) / step
        prev = p['pelvis']
        sp = to_body(sub(p['c7'], p['pelvis']), y)
        wr = to_body(sub(p['wrR'], p['pelvis']), y)
        print('%5.2f %5.2f %5.2f %4.2f %4.2f %4.2f %4.2f %5.2f %4.2f %5.2f %4.1f %5.0f %4.0f' % (
            t, p['pelvis'][1], T.lift(p), T.clear(p, 'L'), T.clear(p, 'R'), p['wrL'][1], p['wrR'][1], p['fingR'][1], p['head'][1],
            wr[0], spd, math.degrees(y), math.degrees(math.atan2(sp[0], sp[1]))))
        t += step


def parse_only(path: str):
    """For the tests: a BVH file's joints and its frames' world positions, as JSON."""
    with open(path) as f:
        b = parse_bvh(f.read())
    out = {
        'joints': [{'name': j.name, 'parent': j.parent.name if j.parent else None, 'offset': j.offset, 'channels': j.channels} for j in b.joints],
        'frameTime': b.frame_time,
        'frames': [fk(b, fr) for fr in b.frames],
    }
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--inspect':
        rng = [float(x) for x in args[2:5]]
        inspect(args[1], *rng)
    elif args and args[0] == '--parse':
        parse_only(args[1])
    elif args and args[0] == '--fetch':
        for s in sorted({c['src'] for c in CLIPS.values()}):
            print(s, fetch(s))
    else:
        write_all(args or None)
