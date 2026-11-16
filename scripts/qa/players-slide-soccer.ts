// Players QA (studio overhaul, players-1): soccer foot sliding (A-5). Autopilot attacks run headless;
// for every on-grass body every 1/60 s, the SAME branch logic as soccer2/render.ts animOf (ready below
// 1 m/s, backpedal at a fixed 1.1x for a defender going back, jog/run/sprint with the rate clamped to
// 0.65-1.7) and the sprite's facing (b.fx/fy, not the velocity) classify frames where the drawn feet
// can't match the ground the body covers. Port of the audit's soccer_slide.ts (the baseline method);
// players-2 switches it to the extracted selection module and must reproduce these numbers.
//
//   PS_SPORT=soccer npx vite-node scripts/qa/players-slide-soccer.ts [--attacks 120] [--out DIR]
// Prints one JSON line (and OUT/players-slide-soccer.json). The audit measured 12.8%.
import cardsRaw from '../../src/data/cards-soccer.json';
import { decide, pilot } from '../../src/game/soccer2/autopilot';
import { kickOff, setupAttack, step, CLOCK } from '../../src/game/soccer2/engine';
import { dealOf, ATTACKS } from '../../src/game/soccer2/match';
import { clubSquad, soccerLines, type SoccerCardsFile } from '../../src/game/soccer2/ratings';
import { clipMeta, legScale } from '../../src/game/pixel/mocap';
import { lookFor } from '../../src/game/soccer2/render';
import type { Body, Squad } from '../../src/game/soccer2/types';
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
const cls: Record<string, number> = {};
const speeds: number[] = [];
const bump = (k: string) => (cls[k] = (cls[k] ?? 0) + 1);
const ms = (b: Body, name: string) => clipMeta(name).root.speed * legScale(lookFor(b, kit as never, kit as never)) * (b.p.ht / 100);
const r = rng(hashString('slide'));
for (let i = 0; i < N; i++) {
  const att = squads[Math.floor(r() * squads.length)],
    def = squads[Math.floor(r() * squads.length)];
  const deal = dealOf('s' + i, ATTACKS);
  const a = setupAttack(deal[i % deal.length], att, def, 'sl' + i, { clock: CLOCK, stoppage: false, defIQ: 0 });
  const pl = pilot(0.68, 'p' + i);
  kickOff(a);
  let n = 0;
  while (!a.end && n++ < 60 * 90) {
    step(a, 1 / 60, decide(a, pl));
    for (const b of a.bodies) {
      const sp = Math.hypot(b.vx, b.vy);
      speeds.push(sp);
      const since = a.t - b.actAt;
      const action = (b.act === 'kick' && since < 0.55) || (b.act === 'tackle' && since < 0.9) || b.act === 'dive' || b.act === 'down' || (b.act === 'header' && since < 0.7) || b.act === 'catch' || b.act === 'wall';
      if (action) {
        bump(sp > 1.5 ? 'action clip while moving >1.5 m/s' : 'action clip');
        continue;
      }
      if (sp <= 0.15) {
        bump('standing (ready)');
        continue;
      }
      if (sp <= 1) {
        bump('ready idle clip while drifting 0.15-1 m/s (slide)');
        continue;
      }
      const f = { x: b.fx, y: b.fy };
      const fwd = b.vx * f.x + b.vy * f.y;
      const lat = -b.vx * f.y + b.vy * f.x;
      if (b.side === 'D' && sp < 4.5 && fwd < -0.5 && Math.abs(fwd) > Math.abs(lat)) {
        const implied = ms(b, 'backpedal') * 1.1;
        bump(Math.abs(sp - implied) / sp > 0.25 ? 'backpedal at fixed 1.1x: feet off by >25% (slide)' : 'backpedal ok');
        continue;
      }
      let clip = 'jog',
        best = Infinity;
      for (const c of ['jog', 'run', 'sprint']) {
        const d = Math.abs(Math.log(sp / ms(b, c)));
        if (d < best) {
          best = d;
          clip = c;
        }
      }
      const rate = Math.max(0.65, Math.min(1.7, sp / ms(b, clip)));
      const implied = rate * ms(b, clip);
      const ang = Math.abs(Math.atan2(lat, fwd)) * 57.3;
      if (ang > 50) bump(ang > 120 ? 'forward run cycle while moving BACKWARD vs facing (moonwalk)' : 'forward run cycle while moving SIDEWAYS vs facing (crab slide)');
      else if (Math.abs(sp - implied) / sp > 0.15) bump('stride rate clamped: feet off by >15% (slide)');
      else bump('gait ok');
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
const probe = { role: 'att', p: { ht: 180, id: 'x', num: 1 } } as unknown as Body;
emit('players-slide-soccer-' + String(opts.tag ?? 'before'), {
  method: 'audit branch copy (soccer2/render.ts animOf, as in soccer_slide.ts)',
  attacks: N,
  secs: round((Date.now() - t0) / 1000, 1),
  bodyFrames: tot,
  // the audit's 12.8%: idle drift + clamped stride (its "(slide)" rows); the facing mismatches are
  // reported beside it
  slidingPct: round((100 * slideOnly) / tot, 1),
  slidingWithFacingPct: round((100 * sliding) / tot, 1),
  actionWhileMovingPct: round((100 * (cls['action clip while moving >1.5 m/s'] ?? 0)) / tot, 1),
  speedMs: { p50: +speeds[Math.floor(speeds.length / 2)].toFixed(2), p90: +speeds[Math.floor(speeds.length * 0.9)].toFixed(2) },
  clipGroundSpeedMs_180cm: Object.fromEntries(['jog', 'run', 'sprint', 'backpedal'].map((c) => [c, +(clipMeta(c).root.speed * legScale(lookFor(probe, kit as never, kit as never)) * 1.8).toFixed(2)])),
  classes: Object.fromEntries(Object.entries(cls).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, round((100 * v) / tot, 1)])),
});
process.exit(0);
