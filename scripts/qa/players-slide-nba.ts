// Players QA (studio overhaul, players-1): NBA foot sliding (A-5, NBA-23). Seeded autopilot games run
// headless; for every on-ground body every 1/60 s, the renderer's animation choice (its branches,
// copied from hoops2/render.ts animOf/gait as the audit did: the baseline method) is set against the
// body's real ground speed. A frame slides when the drawn feet can't cover that ground: an idle or
// static pose while moving, or a gait whose rate is clamped more than 15% off the speed.
// players-2 switches this to the extracted selection module and must reproduce these numbers.
//
//   npx vite-node scripts/qa/players-slide-nba.ts [--games 24] [--out DIR]
// Prints one JSON line (and OUT/players-slide-nba.json). The audit measured 29.1% over 24 games.
import { getPool } from '../../src/ut/pool';
import { aiOpponent } from '../../src/ut/battles';
import { fiveOfSquad, squadFromWire } from '../../src/ut/teams';
import { decide, pilot } from '../../src/game/hoops2/autopilot';
import { afterPossession, newHoopsGame, startPossession } from '../../src/game/hoops2/game';
import { step } from '../../src/game/hoops2/engine';
import { clipMeta, legScale } from '../../src/game/pixel/mocap';
import { hairFor } from '../../src/game/pixel/body';
import type { Body } from '../../src/game/hoops2/types';
import { emit, opts, round } from './players-lib.mjs';

const GAMES = Number(opts.games ?? 24);
const t0 = Date.now();
const pool = await getPool();
const cnt: Record<string, number> = {};
const add = (k: string, n = 1) => (cnt[k] = (cnt[k] ?? 0) + n);
// a clip's ground speed in ft/s on this player's sprite legs
const ft = (b: Body, name: string) => clipMeta(name).root.speed * legScale({ sport: 'nba', ht: b.p.ht, wt: b.p.wt, num: 1, hair: hairFor(b.p.id), skin: '#000', hairColor: '#000', jersey: '#fff', trim: '#000', shorts: '#fff', socks: '#fff', shoes: '#000' } as never) * (b.p.ht / 12);
const speeds: number[] = [];
for (let gi = 0; gi < GAMES; gi++) {
  const A = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'anim' + gi).squad));
  const B = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'animB' + gi).squad));
  const g = newHoopsGame(A.five, B.five, 'anim' + gi, undefined, [], 0);
  const pl = pilot(0.68, 'anim' + gi);
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
        if (b.h > 0.05) continue;
        const v = Math.hypot(b.vx, b.vz);
        speeds.push(v);
        add('frames');
        const slide = (name: string, lo: number, hi: number) => {
          const r = v / ft(b, name);
          const shown = Math.max(lo, Math.min(hi, r));
          if (Math.abs(Math.log(r / shown)) > Math.log(1.15)) add(r > hi ? 'slide:toofast:' + name : 'slide:tooslow:' + name);
          else add('ok:' + name);
        };
        const pick = (names: string[]) => {
          let best = names[0],
            d = Infinity;
          for (const n of names) {
            const x = Math.abs(Math.log(Math.max(0.01, v) / ft(b, n)));
            if (x < d) {
              d = x;
              best = n;
            }
          }
          return best;
        };
        switch (b.act) {
          case 'run':
            if (v > 2.5) slide(pick(['jog', 'run', 'sprint']), 0.65, 1.5);
            else if (v > 1) add('slide:idle-while-moving:run');
            else add('ok:idle');
            break;
          case 'idle':
            if (v > 1) add('slide:idle-while-moving:idle');
            else add('ok:idle');
            break;
          case 'dribble':
            if (v > 1.8) slide(pick(['jog', 'run', 'sprint']), 0.65, 1.5);
            else if (v > 1) add('slide:static-dribble-pose-while-moving');
            else add('ok:dribble-stand');
            break;
          case 'defend': {
            if (v <= 3) {
              if (v > 1) add('slide:static-defend-pose-while-moving');
              else add('ok:defend-stand');
              break;
            }
            const lat = -b.vx * Math.sin(b.face) + b.vz * Math.cos(b.face);
            const fwd = b.vx * Math.cos(b.face) + b.vz * Math.sin(b.face);
            if (fwd < -3 && Math.abs(fwd) >= Math.abs(lat)) {
              const r = -fwd / ft(b, 'backpedal');
              add(r > 1.6 * 1.15 ? 'slide:toofast:backpedal' : r < 0.7 / 1.15 ? 'slide:tooslow:backpedal' : 'ok:backpedal');
            } else if (Math.abs(lat) > Math.abs(fwd)) {
              const r = Math.abs(lat) / ft(b, 'shuffle');
              add(r > 1.6 * 1.15 ? 'slide:toofast:shuffle' : r < 0.7 / 1.15 ? 'slide:tooslow:shuffle' : 'ok:shuffle');
            } else slide(pick(['jog', 'run', 'sprint']), 0.65, 1.5);
            break;
          }
          case 'cross':
          case 'stepback':
          case 'spin':
          case 'pass':
          case 'catch':
          case 'contest':
          case 'block':
          case 'rebound':
          case 'stumble':
          case 'screen':
          case 'celebrate':
            if (v > 3) add('slide:handkeyed-pose-while-moving:' + b.act);
            else add('ok:' + b.act);
            break;
          default:
            add('other:' + b.act);
        }
      }
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
    afterPossession(g, p);
  }
}
const slides = Object.entries(cnt)
  .filter(([k]) => k.startsWith('slide'))
  .reduce((a, [, v]) => a + v, 0);
speeds.sort((a, b) => a - b);
const q = (x: number) => +speeds[Math.floor(x * (speeds.length - 1))].toFixed(1);
const sample = { p: { ht: 78, wt: 215, id: 'abc' } } as Body;
emit('players-slide-nba-' + String(opts.tag ?? 'before'), {
  method: 'audit branch copy (hoops2/render.ts animOf/gait, simplified as in nba-anim.test.ts)',
  games: GAMES,
  secs: round((Date.now() - t0) / 1000, 1),
  groundFrames: cnt.frames,
  slidingPct: round((100 * slides) / cnt.frames, 1),
  counts: Object.fromEntries(Object.entries(cnt).sort((a, b) => b[1] - a[1])),
  clipGroundSpeedFtPerS_6ft6_215: Object.fromEntries(['jog', 'run', 'sprint', 'shuffle', 'backpedal'].map((n) => [n, +ft(sample, n).toFixed(2)])),
  bodySpeedFtPerS: { p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), p99: q(0.99) },
});
process.exit(0);
