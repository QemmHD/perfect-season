// Players QA (studio overhaul, players-1; players-5 rewrite): NFL foot sliding (A-5). Seeded autopilot
// drives run headless with gold-tier Ultimate Team squads; for every body on its feet every 1/60 s
// after the snap, the renderer's real selection (pixel/select-nfl.ts `motionOf`: the drawn facing,
// the stride locomotion.ts picks, the planted foot) is set against the body's real ground speed. A
// frame slides when the drawn feet can't cover that ground:
// - a stride more than 15% off his speed, or travelling more than 50° off the way he moves;
// - the `ready` idle clip while he moves over 1 ft/s (1/3 yd/s);
// - a planted action (a block or rush drive, a throw, a hand-keyed move, the static carry cycle)
//   while he moves over 1 yd/s.
// The QB drop is reported on its own: frames of the idle clip while the QB moves over 1 yd/s, and
// the yards he skates that way per dropback (players-1's baseline: 22.2% of QB frames, 1.97 yd).
// players-1's baseline (40.4%) copied the renderer's old branches with the same thresholds.
//
//   PS_SPORT=nfl npx vite-node scripts/qa/players-slide-nfl.ts [--games 24] [--tag after] [--out DIR]
import { snap, step } from '../../src/game/football2/engine';
import { afterPlay, kick, newGame, punt, startPlay, type Game } from '../../src/game/football2/drive';
import { chooseCall, decide, fourthDown, pilot } from '../../src/game/football2/autopilot';
import type { Body, Play } from '../../src/game/football2/types';
import { clipMeta, legScale, loadClips } from '../../src/game/pixel/mocap';
import { loadAppearance } from '../../src/game/pixel/appearance';
import { slides, strideVelocity } from '../../src/game/pixel/locomotion';
import { CLIPS, lookFor, type Memo, motionOf } from '../../src/game/pixel/select-nfl';
import { loadCards } from '../../src/ut/cards';
import { rateCard } from '../../src/ut/rate';
import { NFL_SLOTS } from '../../src/ut/squad';
import { offenseOfSquad, defenseOfSquad, type SquadCards } from '../../src/ut/teams';
import { emit, opts, round } from './players-lib.mjs';

if (process.env.PS_SPORT !== 'nfl') {
  console.error('players-slide-nfl: run with PS_SPORT=nfl');
  process.exit(2);
}
const GAMES = Number(opts.games ?? 24);
const t0 = Date.now();
const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
function squad(pct: number): SquadCards {
  const sq: SquadCards = {};
  const used = new Set<string>();
  for (const s of NFL_SLOTS) {
    const options = cards.filter((c) => c.tier === 'gold' && c.line.pos.includes(s.pos!) && !used.has(c.line.name)).sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id));
    const c = options[Math.min(options.length - 1, Math.floor(options.length * pct))];
    if (!c) throw Error('Missing fixture ' + s.id);
    sq[s.id] = { line: c.line, level: 1 };
    used.add(c.line.name);
  }
  return sq;
}
const SQ = [squad(0.6), squad(0.9)];

const cnt: Record<string, number> = {};
const add = (k: string, n = 1) => (cnt[k] = (cnt[k] ?? 0) + n);
await loadClips(CLIPS);
await loadAppearance('nfl');
const kit = { jersey: '#203731', trim: '#ffb612', pants: '#ffb612', helmet: '#203731', stripe: '#ffffff', socks: '#203731', shoes: '#1b1b1f', mask: '#9aa0a6' };
const drift: number[] = [];
const IDLE_ACTS = new Set(['stance', 'run', 'rush', 'carry', 'backpedal', 'block']);

function classify(b: Body, p: Play, fr: ReturnType<typeof motionOf>, look: ReturnType<typeof lookFor>) {
  const speed = Math.hypot(b.vx, b.vy);
  const qb = b === p.qb;
  add('frames');
  if (qb) add('qb:frames');
  const an = fr.an;
  if (an.gait && an.clip) {
    drift.push((fr.mo.slid * 34) / (b.p.ht / 36));
    const sv = strideVelocity(fr.face, { meta: clipMeta(an.clip), ct: an.ct ?? 0, pick: an.gait, unitsPerLeg: legScale(look) * (b.p.ht / 36) });
    const off = Math.abs(Math.atan2(sv.x * b.vy - sv.y * b.vx, sv.x * b.vx + sv.y * b.vy));
    if (slides(an.gait)) add('slide:stride-off:' + an.gait.clip);
    else if (speed > 1 / 3 && off > (50 * Math.PI) / 180) add('slide:stride-direction:' + an.gait.clip);
    else add('ok:' + an.gait.clip + (an.gait.reverse ? '-back' : '') + (an.gait.stride < 1 ? '-short' : ''));
    return;
  }
  if (an.clip === 'ready' || (!an.clip && /^(st|id)/.test(an.key))) {
    if (speed > 1 / 3) {
      add('slide:ready-idle-while-moving:' + (qb && p.phase === 'drop' ? 'qb-drop' : b.act));
      if (qb && speed > 1) add('qb:idle-moving-frames');
    } else add('ok:ready');
    return;
  }
  if (an.clip === 'catch_run' && speed > 3) return add('ok:catch_run');
  const what = (an.clip ?? an.key.replace(/[\d.:-]+/g, '')) + ':' + b.act;
  if (speed > 1) add('slide:planted-action-while-moving:' + what);
  else add('ok:' + (IDLE_ACTS.has(b.act) ? 'stand:' : '') + what);
}

let dropbacks = 0,
  skateYd = 0;
for (let gi = 0; gi < GAMES; gi++) {
  const o = SQ[gi % 2],
    d = SQ[(gi + 1) % 2];
  const g: Game = newGame(offenseOfSquad(o, 'slide'), defenseOfSquad(d, 'slide'), 'slide' + gi);
  const pl = pilot(0.68, 'slide' + gi);
  const memos = new Map<string, Memo>();
  let guard = 0;
  while (!g.over && guard++ < 300) {
    if (g.down === 4) {
      const f = fourthDown(g);
      if (f === 'kick') {
        kick(g, 0.05);
        continue;
      }
      if (f === 'punt') {
        punt(g);
        continue;
      }
    }
    const p = startPlay(g, chooseCall(g, pl));
    // the pre-snap frame the renderer sees, then the snap
    for (const b of p.bodies) {
      const who = b.p.id + '|' + b.side;
      let m = memos.get(who);
      if (!m) memos.set(who, (m = { gait: { t: p.t, frac: (b.id * 0.29) % 1 }, face: { x: 0, y: b.side === 'O' ? 1 : -1 } }));
      motionOf(b, p.t, p, lookFor(b, kit), m, false);
    }
    snap(p);
    if (p.call === 'pass') dropbacks++;
    for (let k = 0; k < 1500 && !p.end; k++) {
      step(p, 1 / 60, decide(p, g, pl));
      p.events.length = 0;
      for (const b of p.bodies) {
        const who = b.p.id + '|' + b.side;
        let m = memos.get(who);
        if (!m) memos.set(who, (m = { gait: { t: p.t, frac: (b.id * 0.29) % 1 }, face: { x: 0, y: b.side === 'O' ? 1 : -1 } }));
        const look = lookFor(b, kit);
        const fr = motionOf(b, p.t, p, look, m, false);
        if (b.act === 'tackle' || b.act === 'down' || b.act === 'windup') {
          add('off-feet');
          continue;
        }
        const speed = Math.hypot(b.vx, b.vy);
        const idle = fr.an.clip === 'ready' || (!fr.an.clip && /^(st|id)/.test(fr.an.key));
        if (b === p.qb && p.phase === 'drop' && idle && speed > 1) skateYd += speed / 60;
        classify(b, p, fr, look);
      }
    }
    if (!p.end) break;
    afterPlay(g, p.end);
  }
}
const slidesN = Object.entries(cnt)
  .filter(([k]) => k.startsWith('slide'))
  .reduce((a, [, v]) => a + v, 0);
drift.sort((a, b) => a - b);
const q = (xs: number[], x: number) => (xs.length ? +xs[Math.floor(x * (xs.length - 1))].toFixed(2) : null);
emit('players-slide-nfl-' + String(opts.tag ?? 'after'), {
  method: 'select-nfl.ts motionOf (the renderer\'s selection), gold squads, 1/60 s',
  games: GAMES,
  secs: round((Date.now() - t0) / 1000, 1),
  groundFrames: cnt.frames,
  slidingPct: round((100 * slidesN) / cnt.frames, 1),
  qbIdleMovingFrames: cnt['qb:idle-moving-frames'] ?? 0,
  qbIdleMovingPctOfQbFrames: round((100 * (cnt['qb:idle-moving-frames'] ?? 0)) / Math.max(1, cnt['qb:frames'] ?? 0), 1),
  dropbacks,
  qbSkateYdPerDropback: round(skateYd / Math.max(1, dropbacks), 2),
  plantedDriftArtPx34: { p50: q(drift, 0.5), p99: q(drift, 0.99), max: q(drift, 1) },
  counts: Object.fromEntries(Object.entries(cnt).sort((a, b) => b[1] - a[1])),
});
process.exit(0);
