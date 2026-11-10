// Players QA (studio overhaul, players-1): NFL foot sliding (A-5; new baseline, the audits had none).
// Seeded autopilot drives run headless with gold-tier Ultimate Team squads; for every body on its feet
// every 1/60 s after the snap, the NFL renderer's animation choice (football2/render.ts animOf/gait,
// its branches copied here, the same method as the NBA and soccer classifiers) is set against the
// body's real ground speed. A frame slides when the drawn feet can't cover that ground:
// - the `ready` idle clip (QB drop, a set receiver, a slow rusher) while moving over 1 ft/s;
// - a gait whose rate is clamped (0.65-1.7, the heavy man's plod applied) more than 15% off;
// - a shuffle/backpedal whose clamped rate (0.65-1.8) is more than 15% off;
// - a planted action (block drive, throw, hand-keyed juke/spin/stiff arm/truck, the static carry
//   cycle) while moving over 1 yd/s.
// The QB drop is reported on its own: frames of the idle clip while the QB moves over 1 yd/s, and
// the yards he skates that way per dropback (the NFL audit saw 6.5).
// players-2 switches this to the extracted selection module and must reproduce these numbers.
//
//   PS_SPORT=nfl npx vite-node scripts/qa/players-slide-nfl.ts [--games 24] [--out DIR]
import { snap, step, isLine } from '../../src/game/football2/engine';
import { afterPlay, kick, newGame, punt, startPlay, type Game } from '../../src/game/football2/drive';
import { chooseCall, decide, fourthDown, pilot } from '../../src/game/football2/autopilot';
import type { Body, Play } from '../../src/game/football2/types';
import { clipMeta, legScale } from '../../src/game/pixel/mocap';
import { heaviness } from '../../src/game/pixel/style';
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
const looks = new Map<string, object>();
// the renderer's look for this man (pads 1.25 on the lines), for his sprite's leg length
const lookOf = (b: Body) => {
  let l = looks.get(b.p.id);
  if (!l) looks.set(b.p.id, (l = { sport: 'nfl', ht: b.p.ht, wt: b.p.wt, num: 1, pads: isLine(b) || b.p.pos === 'DT' || b.p.pos === 'DE' ? 1.25 : 1 }));
  return l as never;
};
// a clip's ground speed in yd/s on his sprite legs (render.ts: clipMeta(c).root.speed * legScale * ht/36)
const yd = (b: Body, name: string) => clipMeta(name).root.speed * legScale(lookOf(b)) * (b.p.ht / 36);
const off = (speed: number, implied: number) => Math.abs(Math.log(Math.max(0.01, speed) / Math.max(0.01, implied))) > Math.log(1.15);

function classify(b: Body, p: Play, face: { x: number; y: number }) {
  const speed = Math.hypot(b.vx, b.vy);
  const qb = b === p.qb;
  add('frames');
  if (qb) add('qb:frames');
  const idle = (why: string) => {
    if (speed > 1 / 3) {
      add('slide:ready-idle-while-moving:' + why);
      if (qb && speed > 1) add('qb:idle-moving-frames');
    } else add('ok:ready');
  };
  const gait = (why: string) => {
    let clip = 'jog',
      best = Infinity;
    for (const c of ['jog', 'run', 'sprint']) {
      const d = Math.abs(Math.log(speed / yd(b, c)));
      if (d < best) {
        best = d;
        clip = c;
      }
    }
    const rate = Math.max(0.65, Math.min(1.7, speed / yd(b, clip))) * (1.04 - 0.1 * heaviness(b.p.wt, b.p.ht));
    if (off(speed, rate * yd(b, clip))) add('slide:gait-rate-clamped:' + why);
    else add('ok:gait');
  };
  const planted = (what: string) => (speed > 1 ? add('slide:planted-action-while-moving:' + what) : add('ok:' + what));
  switch (b.act) {
    case 'tackle':
    case 'down':
    case 'windup':
      add('off-feet');
      cnt.frames--;
      if (qb) cnt['qb:frames']--;
      return;
    case 'stance':
      // render.ts: a stance under 0.6 yd/s is the static stance pose; moving, the ready idle clip
      if (speed < 0.6) add('ok:stance');
      else idle(qb ? 'qb-drop' : 'stance');
      return;
    case 'run':
    case 'rush':
      if (b.act === 'rush' && speed < 2) return planted('rush-block');
      if (speed > 1) return gait(b.act);
      return idle(b.act);
    case 'carry':
      if (speed > 1.2) return gait('carry');
      return planted('carry-cycle');
    case 'backpedal': {
      if (speed < 0.7) return idle('backpedal');
      const forward = b.vx * face.x + b.vy * face.y;
      const lateral = -b.vx * face.y + b.vy * face.x;
      const name = Math.abs(lateral) > Math.abs(forward) ? 'shuffle' : forward < -0.4 ? 'backpedal' : null;
      if (!name) return gait('backpedal-forward');
      const g = clipMeta(name).root.speed * legScale(lookOf(b)) * (b.p.ht / 36);
      const rate = Math.max(0.65, Math.min(1.8, speed / Math.max(0.1, g)));
      return off(speed, rate * g) ? add('slide:' + name + '-rate-clamped') : add('ok:' + name);
    }
    case 'block':
      return planted('block');
    case 'throw':
      return planted('throw');
    case 'catch':
      // catch_run carries its own root motion above 3 yd/s
      return speed > 3 ? add('ok:catch_run') : planted('catch');
    case 'juke':
    case 'spin':
    case 'stiff':
    case 'truck':
      return planted('handkeyed-' + b.act);
    case 'kick':
    case 'celebrate':
      return planted(b.act);
    default:
      add('other:' + b.act);
  }
}

let dropbacks = 0,
  skateYd = 0;
for (let gi = 0; gi < GAMES; gi++) {
  const o = SQ[gi % 2],
    d = SQ[(gi + 1) % 2];
  const g: Game = newGame(offenseOfSquad(o, 'slide'), defenseOfSquad(d, 'slide'), 'slide' + gi);
  const pl = pilot(0.68, 'slide' + gi);
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
    snap(p);
    if (p.call === 'pass') dropbacks++;
    // the renderer's facing memo: toward travel (turning at 14/s), the backpedaller watching the QB
    const faces = new Map<number, { x: number; y: number }>();
    for (let k = 0; k < 1500 && !p.end; k++) {
      step(p, 1 / 60, decide(p, g, pl));
      p.events.length = 0;
      for (const b of p.bodies) {
        const speed = Math.hypot(b.vx, b.vy);
        let face = faces.get(b.id) ?? { x: 0, y: b.side === 'O' ? 1 : -1 };
        const grounded = b.act === 'tackle' || b.act === 'down';
        if (!grounded) {
          const mark = p.bodies.find((x) => x.id === b.mark);
          const openHips = b.act === 'backpedal' && speed > 4.8 && mark && mark.y > b.y - 1;
          const watch = b.act === 'backpedal' && !openHips ? p.qb : null;
          const dir = watch ? { x: watch.x - b.x, y: watch.y - b.y } : speed > 0.6 ? { x: b.vx, y: b.vy } : face;
          const target = Math.atan2(dir.y, dir.x),
            old = Math.atan2(face.y, face.x);
          const delta = Math.atan2(Math.sin(target - old), Math.cos(target - old));
          const f = old + delta * Math.min(1, (1 / 60) * 14);
          face = { x: Math.cos(f), y: Math.sin(f) };
          faces.set(b.id, face);
        }
        if (b === p.qb && b.act === 'stance' && speed > 1) skateYd += speed / 60;
        classify(b, p, face);
      }
    }
    if (!p.end) break;
    afterPlay(g, p.end);
  }
}
const slides = Object.entries(cnt)
  .filter(([k]) => k.startsWith('slide'))
  .reduce((a, [, v]) => a + v, 0);
emit('players-slide-nfl-' + String(opts.tag ?? 'before'), {
  method: 'renderer branch copy (football2/render.ts animOf/gait), gold squads, 1/60 s',
  games: GAMES,
  secs: round((Date.now() - t0) / 1000, 1),
  groundFrames: cnt.frames,
  slidingPct: round((100 * slides) / cnt.frames, 1),
  qbIdleMovingFrames: cnt['qb:idle-moving-frames'] ?? 0,
  qbIdleMovingPctOfQbFrames: round((100 * (cnt['qb:idle-moving-frames'] ?? 0)) / Math.max(1, cnt['qb:frames'] ?? 0), 1),
  dropbacks,
  qbSkateYdPerDropback: round(skateYd / Math.max(1, dropbacks), 2),
  counts: Object.fromEntries(Object.entries(cnt).sort((a, b) => b[1] - a[1])),
});
process.exit(0);
