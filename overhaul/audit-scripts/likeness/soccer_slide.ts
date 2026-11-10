// AUDIT ONLY: soccer foot sliding. Runs autopilot attacks headless and, for every on-grass body every
// 1/60 s, applies the SAME branch logic as soccer2/render.ts animOf (ready below 1 m/s, backpedal at a
// fixed 1.1x for a defender going back, jog/run/sprint with the rate clamped to 0.65-1.7) and the
// sprite's facing (b.fx/fy, not the velocity). Classifies frames where the drawn feet can't match the
// ground the body covers. Run: cd /home/user/ps-studio && npx vite-node <this file> [attacks]
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { decide, pilot } from '/home/user/ps-studio/src/game/soccer2/autopilot';
import { kickOff, setupAttack, step, CLOCK } from '/home/user/ps-studio/src/game/soccer2/engine';
import { dealOf, ATTACKS } from '/home/user/ps-studio/src/game/soccer2/match';
import { clubSquad, soccerLines, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import { clipMeta, legScale } from '/home/user/ps-studio/src/game/pixel/mocap';
import { lookFor } from '/home/user/ps-studio/src/game/soccer2/render';
import type { Body, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
import { rng, hashString } from '/home/user/ps-studio/src/engine/rng';

const N = Number(process.argv[2] ?? 120);
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const counts = new Map<string, number>();
for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
const squads: Squad[] = [];
for (const [k, n] of counts) {
  if (n < 14) continue;
  const [fr, s] = k.split('|');
  try { squads.push(clubSquad(seasons, fr, Number(s))); } catch {}
}
const kit = { jersey: '#fff', trim: '#000', shorts: '#fff', socks: '#fff', shoes: '#000' };
const cls: Record<string, number> = {};
const speeds: number[] = [];
let frames = 0;
const bump = (k: string) => (cls[k] = (cls[k] ?? 0) + 1);
const ms = (b: Body, name: string) => clipMeta(name).root.speed * legScale(lookFor(b, kit, kit)) * (b.p.ht / 100);
const r = rng(hashString('slide'));
for (let i = 0; i < N; i++) {
  const att = squads[Math.floor(r() * squads.length)], def = squads[Math.floor(r() * squads.length)];
  const deal = dealOf('s' + i, ATTACKS);
  const a = setupAttack(deal[i % deal.length], att, def, 'sl' + i, { clock: CLOCK, stoppage: false, defIQ: 0 });
  const pl = pilot(0.68, 'p' + i);
  kickOff(a);
  let n = 0;
  while (!a.end && n++ < 60 * 90) {
    step(a, 1 / 60, decide(a, pl));
    for (const b of a.bodies) {
      frames++;
      const sp = Math.hypot(b.vx, b.vy);
      speeds.push(sp);
      const since = a.t - b.actAt;
      const action = (b.act === 'kick' && since < 0.55) || (b.act === 'tackle' && since < 0.9) || b.act === 'dive' || b.act === 'down' || (b.act === 'header' && since < 0.7) || b.act === 'catch' || b.act === 'wall';
      if (action) { bump(sp > 1.5 ? 'action clip while moving >1.5 m/s' : 'action clip'); continue; }
      if (sp <= 0.15) { bump('standing (ready)'); continue; }
      if (sp <= 1) { bump('ready idle clip while drifting 0.15-1 m/s (slide)'); continue; }
      const f = { x: b.fx, y: b.fy };
      const fwd = b.vx * f.x + b.vy * f.y;
      const lat = -b.vx * f.y + b.vy * f.x;
      if (b.side === 'D' && sp < 4.5 && fwd < -0.5 && Math.abs(fwd) > Math.abs(lat)) {
        const implied = ms(b, 'backpedal') * 1.1;
        bump(Math.abs(sp - implied) / sp > 0.25 ? 'backpedal at fixed 1.1x: feet off by >25% (slide)' : 'backpedal ok');
        continue;
      }
      // gait clip choice (closest log speed) and clamped rate
      let clip = 'jog', best = Infinity;
      for (const c of ['jog', 'run', 'sprint']) { const d = Math.abs(Math.log(sp / ms(b, c))); if (d < best) { best = d; clip = c; } }
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
speeds.sort((x, y) => x - y);
console.log('body-frames', tot, 'speed m/s p50', speeds[Math.floor(speeds.length / 2)].toFixed(2), 'p90', speeds[Math.floor(speeds.length * 0.9)].toFixed(2));
console.log('clip ground speeds for a 1.80 m player (m/s):', ['jog', 'run', 'sprint', 'backpedal'].map((c) => c + ' ' + (clipMeta(c).root.speed * legScale(lookFor({ role: 'att', p: { ht: 180, id: 'x', num: 1 } } as unknown as Body, kit, kit)) * 1.8).toFixed(2)).join(', '));
for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1])) console.log(((100 * v) / tot).toFixed(1).padStart(5) + '%  ' + k);
process.exit(0);
