// Players QA (studio overhaul, players-1; players-5 rewrite): NBA foot sliding (A-5, NBA-23). Seeded
// autopilot games run headless; for every on-ground body every 1/60 s the renderer's real selection
// (pixel/select-nba.ts `motionOf`: the drawn facing, the stride locomotion.ts picks, the planted foot)
// is set against the body's real ground speed. A frame slides when the drawn feet can't cover that
// ground: a stride more than 15% off the speed (the audit's rule) or travelling more than 50° off the
// way he moves (a crab or a moonwalk), the idle clip or a static pose while he moves over 1 ft/s, or
// a hand-keyed move while he moves over 3 ft/s. players-1's baseline (29.1%) copied the renderer's old
// branches with the same thresholds. Also reported: how far the planted foot drifts in a contact beat
// (art px at 34 art px).
//
//   npx vite-node scripts/qa/players-slide-nba.ts [--games 24] [--tag after] [--out DIR]
// Prints one JSON line (and OUT/players-slide-nba-<tag>.json).
import { getPool } from '../../src/ut/pool';
import { aiOpponent } from '../../src/ut/battles';
import { fiveOfSquad, squadFromWire } from '../../src/ut/teams';
import { decide, pilot } from '../../src/game/hoops2/autopilot';
import { afterPossession, newHoopsGame, startPossession } from '../../src/game/hoops2/game';
import { step } from '../../src/game/hoops2/engine';
import { clipMeta, legScale, loadClips } from '../../src/game/pixel/mocap';
import { loadAppearance } from '../../src/game/pixel/appearance';
import { slides, strideVelocity } from '../../src/game/pixel/locomotion';
import { AT_RIM, CLIPS, lookFor, type Memo, motionOf } from '../../src/game/pixel/select-nba';
import type { Body } from '../../src/game/hoops2/types';
import { emit, opts, round } from './players-lib.mjs';

const GAMES = Number(opts.games ?? 24);
const t0 = Date.now();
await loadClips(CLIPS);
await loadAppearance('nba');
const pool = await getPool();
const kit = { jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
const cnt: Record<string, number> = {};
const add = (k: string, n = 1) => (cnt[k] = (cnt[k] ?? 0) + n);
const LOCO = new Set(['run', 'idle', 'dribble', 'defend']);
const HANDKEYED = new Set(['cross', 'stepback', 'spin', 'pass', 'catch', 'contest', 'block', 'rebound', 'stumble', 'screen', 'celebrate']);
const speeds: number[] = [];
const drift: number[] = [];
for (let gi = 0; gi < GAMES; gi++) {
  const A = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'anim' + gi).squad));
  const B = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'animB' + gi).squad));
  const g = newHoopsGame(A.five, B.five, 'anim' + gi, undefined, [], 0);
  const pl = pilot(0.68, 'anim' + gi);
  const memos = new Map<string, Memo>();
  while (!g.over) {
    const p = startPossession(g);
    pl.letGo = null;
    pl.driving = false;
    pl.goal = null;
    pl.nextThink = 0;
    pl.crosses = 0;
    for (let i = 0; i < 2400 && !p.end; i++) {
      step(p, 1 / 60, decide(p, pl));
      p.events.length = 0;
      for (const b of p.bodies) {
        const who = b.p.id + '|' + b.side;
        let m = memos.get(who);
        if (!m) memos.set(who, (m = { gait: { t: p.t, frac: (b.idx * 0.29) % 1 }, last: null }));
        const look = lookFor(b, kit);
        const ball = p.ball;
        const shotAt = ball && ball.kind === 'shot' && ball.who === b.idx && !AT_RIM.includes(ball.shot ?? '') ? ball.t0 : null;
        const fr = motionOf(b, p.t, p.handler === b.idx, look, m, shotAt);
        if (b.h > 0.05) continue;
        const v = Math.hypot(b.vx, b.vz);
        speeds.push(v);
        add('frames');
        classify(b, fr, v, look);
      }
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
    afterPossession(g, p);
  }
}

function classify(b: Body, fr: ReturnType<typeof motionOf>, v: number, look: ReturnType<typeof lookFor>) {
  const an = fr.an;
  if (an.gait && an.clip) {
    if (fr.mo.slid > 0) drift.push((fr.mo.slid * 34) / (b.p.ht / 12));
    else drift.push(0);
    const sv = strideVelocity(fr.face, { meta: clipMeta(an.clip), ct: an.ct ?? 0, pick: an.gait, unitsPerLeg: legScale(look) * (b.p.ht / 12) });
    const off = Math.abs(Math.atan2(sv.x * b.vz - sv.y * b.vx, sv.x * b.vx + sv.y * b.vz));
    if (slides(an.gait)) add('slide:stride-off:' + an.gait.clip);
    else if (v > 1 && off > (50 * Math.PI) / 180) add('slide:stride-direction:' + an.gait.clip);
    else add('ok:' + an.gait.clip + (an.gait.reverse ? '-back' : '') + (an.gait.stride < 1 ? '-short' : ''));
    return;
  }
  if (LOCO.has(b.act)) return v > 1 ? add('slide:static-while-moving:' + b.act + ':' + (an.clip ?? an.key.replace(/[\d.:-]+/g, ''))) : add('ok:stand:' + b.act);
  if (HANDKEYED.has(b.act)) return v > 3 ? add('slide:handkeyed-pose-while-moving:' + b.act) : add('ok:' + b.act);
  add('other:' + b.act);
}

const slidesN = Object.entries(cnt)
  .filter(([k]) => k.startsWith('slide'))
  .reduce((a, [, v]) => a + v, 0);
speeds.sort((a, b) => a - b);
drift.sort((a, b) => a - b);
const q = (xs: number[], x: number) => +xs[Math.floor(x * (xs.length - 1))].toFixed(2);
emit('players-slide-nba-' + String(opts.tag ?? 'after'), {
  method: 'select-nba.ts motionOf (the renderer\'s selection), 1/60 s, on-ground bodies',
  games: GAMES,
  secs: round((Date.now() - t0) / 1000, 1),
  groundFrames: cnt.frames,
  slidingPct: round((100 * slidesN) / cnt.frames, 1),
  plantedDriftArtPx34: { p50: q(drift, 0.5), p99: q(drift, 0.99), max: q(drift, 1) },
  counts: Object.fromEntries(Object.entries(cnt).sort((a, b) => b[1] - a[1])),
  bodySpeedFtPerS: { p25: q(speeds, 0.25), p50: q(speeds, 0.5), p75: q(speeds, 0.75), p90: q(speeds, 0.9), p99: q(speeds, 0.99) },
});
process.exit(0);
