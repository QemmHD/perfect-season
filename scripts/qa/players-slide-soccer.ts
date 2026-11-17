// Players QA (studio overhaul, players-1; players-5 rewrite): soccer foot sliding (A-5). Autopilot
// attacks run headless; for every on-grass body every 1/60 s, the renderer's real selection
// (pixel/select-soccer.ts `motionOf`: the drawn facing, a defender facing the ball as he gets back, the
// stride locomotion.ts picks, the planted foot) is set against the body's real ground speed. A frame
// slides when the drawn feet can't cover the ground: the `ready` clip while he drifts over 0.15 m/s,
// or a stride more than 15% off his speed (the audit's "(slide)" rows: players-1's baseline 13.7%);
// a stride travelling more than 50° off the way he moves (the old moonwalk and crab rows) is
// reported beside it, and actions while moving (a kick, a tackle) separately, as before.
//
//   PS_SPORT=soccer npx vite-node scripts/qa/players-slide-soccer.ts [--attacks 120] [--tag after] [--out DIR]
// Prints one JSON line (and OUT/players-slide-soccer-<tag>.json). The audit measured 12.8%.
import cardsRaw from '../../src/data/cards-soccer.json';
import { decide, pilot } from '../../src/game/soccer2/autopilot';
import { kickOff, setupAttack, step, CLOCK } from '../../src/game/soccer2/engine';
import { dealOf, ATTACKS } from '../../src/game/soccer2/match';
import { clubSquad, soccerLines, type SoccerCardsFile } from '../../src/game/soccer2/ratings';
import { clipMeta, legScale, loadClips } from '../../src/game/pixel/mocap';
import { loadAppearance } from '../../src/game/pixel/appearance';
import { slides, strideVelocity } from '../../src/game/pixel/locomotion';
import { CLIPS, heightM, lookFor, type Memo, motionOf } from '../../src/game/pixel/select-soccer';
import type { Squad } from '../../src/game/soccer2/types';
import { rng, hashString } from '../../src/engine/rng';
import { emit, opts, round } from './players-lib.mjs';

const N = Number(opts.attacks ?? 120);
const t0 = Date.now();
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const counts = new Map<string, number>();
for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
const squads: Squad[] = [];
for (const [k, n] of counts) {
  if (n < 14) continue;
  const [fr, s] = k.split('|');
  try {
    squads.push(clubSquad(seasons, fr, Number(s)));
  } catch {
    // a club-season without a full eleven
  }
}
const kit = { jersey: '#fff', trim: '#000', shorts: '#fff', socks: '#fff', shoes: '#000' };
await loadClips(CLIPS);
await loadAppearance('soccer');
const cls: Record<string, number> = {};
const speeds: number[] = [];
const drift: number[] = [];
const bump = (k: string) => (cls[k] = (cls[k] ?? 0) + 1);
const r = rng(hashString('slide'));
for (let i = 0; i < N; i++) {
  const att = squads[Math.floor(r() * squads.length)],
    def = squads[Math.floor(r() * squads.length)];
  const deal = dealOf('s' + i, ATTACKS);
  const a = setupAttack(deal[i % deal.length], att, def, 'sl' + i, { clock: CLOCK, stoppage: false, defIQ: 0 });
  const pl = pilot(0.68, 'p' + i);
  kickOff(a);
  const memos = new Map<string, Memo>();
  let n = 0;
  while (!a.end && n++ < 60 * 90) {
    step(a, 1 / 60, decide(a, pl));
    for (const b of a.bodies) {
      const who = b.p.id + '|' + b.side;
      let m = memos.get(who);
      if (!m) memos.set(who, (m = { gait: { t: a.t, frac: (b.id * 0.29) % 1 }, face: { x: b.fx, y: b.fy } }));
      const look = lookFor(b, kit as never, kit as never);
      const fr = motionOf(b, a.t, look, m, a.ball);
      const sp = Math.hypot(b.vx, b.vy);
      speeds.push(sp);
      const since = a.t - b.actAt;
      const action = (b.act === 'kick' && since < 0.55) || (b.act === 'tackle' && since < 0.9) || b.act === 'dive' || b.act === 'down' || (b.act === 'header' && since < 0.7) || b.act === 'catch' || b.act === 'wall';
      if (action) {
        bump(sp > 1.5 ? 'action clip while moving >1.5 m/s' : 'action clip');
        continue;
      }
      const an = fr.an;
      if (an.gait && an.clip) {
        drift.push((fr.mo.slid * 34) / heightM(b));
        const sv = strideVelocity(fr.face, { meta: clipMeta(an.clip), ct: an.ct ?? 0, pick: an.gait, unitsPerLeg: legScale(look) * heightM(b) });
        const off = Math.abs(Math.atan2(sv.x * b.vy - sv.y * b.vx, sv.x * b.vx + sv.y * b.vy)) * 57.3;
        if (slides(an.gait)) bump('stride off its speed by >15% (slide)');
        else if (off > 50) bump(off > 120 ? 'stride travelling BACKWARD vs the way he moves (moonwalk)' : 'stride travelling SIDEWAYS vs the way he moves (crab slide)');
        else bump('gait ok: ' + an.gait.clip + (an.gait.reverse ? ' back' : '') + (an.gait.stride < 1 ? ' short' : ''));
        continue;
      }
      if (sp <= 0.15) bump('standing (ready)');
      else bump('ready or a pose while drifting over 0.15 m/s (slide)');
    }
  }
}
const tot = Object.values(cls).reduce((s, x) => s + x, 0);
const sliding = Object.entries(cls)
  .filter(([k]) => /\(slide\)|moonwalk|crab slide/.test(k))
  .reduce((s, [, v]) => s + v, 0);
const slideOnly = Object.entries(cls)
  .filter(([k]) => /\(slide\)/.test(k))
  .reduce((s, [, v]) => s + v, 0);
speeds.sort((x, y) => x - y);
drift.sort((x, y) => x - y);
const q = (xs: number[], x: number) => (xs.length ? +xs[Math.floor(x * (xs.length - 1))].toFixed(2) : null);
emit('players-slide-soccer-' + String(opts.tag ?? 'after'), {
  method: 'select-soccer.ts motionOf (the renderer\'s selection), 1/60 s',
  attacks: N,
  secs: round((Date.now() - t0) / 1000, 1),
  bodyFrames: tot,
  slidingPct: round((100 * slideOnly) / tot, 1),
  slidingWithFacingPct: round((100 * sliding) / tot, 1),
  actionWhileMovingPct: round((100 * (cls['action clip while moving >1.5 m/s'] ?? 0)) / tot, 1),
  plantedDriftArtPx34: { p50: q(drift, 0.5), p99: q(drift, 0.99), max: q(drift, 1) },
  speedMs: { p50: q(speeds, 0.5), p90: q(speeds, 0.9) },
  classes: Object.fromEntries(Object.entries(cls).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, round((100 * v) / tot, 1)])),
});
process.exit(0);
