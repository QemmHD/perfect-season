// AUDIT ONLY. (1) Who uses the ball, by lineup slot. (2) How often the drawing's feet slide: the
// renderer's own animation choice (render.ts animOf/gait) against each body's real ground speed.
import { writeFileSync } from 'node:fs';
import { getPool } from '/home/user/ps-studio/src/ut/pool';
import { aiOpponent } from '/home/user/ps-studio/src/ut/battles';
import { fiveOfSquad, squadFromWire } from '/home/user/ps-studio/src/ut/teams';
import { decide, pilot } from '/home/user/ps-studio/src/game/hoops2/autopilot';
import { afterPossession, newHoopsGame, startPossession } from '/home/user/ps-studio/src/game/hoops2/game';
import { step } from '/home/user/ps-studio/src/game/hoops2/engine';
import { clipMeta, legScale } from '/home/user/ps-studio/src/game/pixel/mocap';
import { hairFor } from '/home/user/ps-studio/src/game/pixel/body';
import type { Body } from '/home/user/ps-studio/src/game/hoops2/types';

const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/nba-anim.json';

it('usage by slot and foot sliding', async () => {
  const pool = await getPool();
  const slotPts = [0, 0, 0, 0, 0], slotFga = [0, 0, 0, 0, 0], slotTouch = [0, 0, 0, 0, 0];
  let starSlotSum = 0, starGames = 0;
  const cnt: Record<string, number> = {};
  const add = (k: string, n = 1) => (cnt[k] = (cnt[k] ?? 0) + n);
  const ft = (b: Body, name: string) => clipMeta(name).root.speed * legScale({ sport: 'nba', ht: b.p.ht, wt: b.p.wt, num: 1, hair: hairFor(b.p.id), skin: '#000', hairColor: '#000', jersey: '#fff', trim: '#000', shorts: '#fff', socks: '#fff', shoes: '#000' } as never) * (b.p.ht / 12);
  const speeds: number[] = [];
  for (let gi = 0; gi < 24; gi++) {
    const A = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'anim' + gi).squad));
    const B = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'animB' + gi).squad));
    const g = newHoopsGame(A.five, B.five, 'anim' + gi, undefined, [], 0);
    const starSlot = A.five.map((h, i) => [h.ovr, i]).sort((a, b) => b[0] - a[0])[0][1];
    starSlotSum += starSlot; starGames++;
    const pl = pilot(0.68, 'anim' + gi);
    while (!g.over) {
      const p = startPossession(g);
      pl.letGo = null; pl.driving = false; pl.goal = null; pl.nextThink = 0; pl.crosses = 0;
      for (let i = 0; i < 2400 && !p.end; i++) {
        const before = p.handler;
        step(p, 1 / 60, decide(p, pl));
        if (before !== null) slotTouch[before] += 1 / 60;
        for (const e of p.events) if ((e === 'release' || e === 'release-green' || e.startsWith('finish:')) && before !== null) slotFga[before]++;
        p.events.length = 0;
        // foot sliding, per body per frame (the renderer's branches, simplified)
        for (const b of p.bodies) {
          if (b.h > 0.05) continue;
          const v = Math.hypot(b.vx, b.vz);
          speeds.push(v);
          add('frames');
          const slide = (rate: number, name: string, lo: number, hi: number) => {
            const r = v / ft(b, name);
            const shown = Math.max(lo, Math.min(hi, r));
            const err = Math.abs(Math.log(r / shown));
            if (err > Math.log(1.15)) add(r > hi ? 'slide:toofast:' + name : 'slide:tooslow:' + name);
            else add('ok:' + name);
            void rate;
          };
          const pick = (names: string[]) => {
            let best = names[0], d = Infinity;
            for (const n of names) { const x = Math.abs(Math.log(Math.max(0.01, v) / ft(b, n))); if (x < d) { d = x; best = n; } }
            return best;
          };
          switch (b.act) {
            case 'run':
              if (v > 2.5) slide(1, pick(['jog', 'run', 'sprint']), 0.65, 1.5);
              else if (v > 1) add('slide:idle-while-moving:run');
              else add('ok:idle');
              break;
            case 'idle':
              if (v > 1) add('slide:idle-while-moving:idle'); else add('ok:idle');
              break;
            case 'dribble':
              if (v > 1.8) slide(1, pick(['jog', 'run', 'sprint']), 0.65, 1.5);
              else if (v > 1) add('slide:static-dribble-pose-while-moving');
              else add('ok:dribble-stand');
              break;
            case 'defend': {
              if (v <= 3) { if (v > 1) add('slide:static-defend-pose-while-moving'); else add('ok:defend-stand'); break; }
              const lat = -b.vx * Math.sin(b.face) + b.vz * Math.cos(b.face);
              const fwd = b.vx * Math.cos(b.face) + b.vz * Math.sin(b.face);
              if (fwd < -3 && Math.abs(fwd) >= Math.abs(lat)) { const r = -fwd / ft(b, 'backpedal'); add(r > 1.6 * 1.15 ? 'slide:toofast:backpedal' : r < 0.7 / 1.15 ? 'slide:tooslow:backpedal' : 'ok:backpedal'); }
              else if (Math.abs(lat) > Math.abs(fwd)) { const r = Math.abs(lat) / ft(b, 'shuffle'); add(r > 1.6 * 1.15 ? 'slide:toofast:shuffle' : r < 0.7 / 1.15 ? 'slide:tooslow:shuffle' : 'ok:shuffle'); }
              else slide(1, pick(['jog', 'run', 'sprint']), 0.65, 1.5);
              break;
            }
            case 'cross': case 'stepback': case 'spin': case 'pass': case 'catch': case 'contest': case 'block': case 'rebound': case 'stumble': case 'screen': case 'celebrate':
              if (v > 3) add('slide:handkeyed-pose-while-moving:' + b.act); else add('ok:' + b.act);
              break;
            default:
              add('other:' + b.act);
          }
        }
      }
      if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
      afterPossession(g, p);
    }
    g.box.forEach((x, i) => (slotPts[i] += x));
  }
  const tot = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const share = (a: number[]) => a.map((x) => +(x / tot(a)).toFixed(3));
  const slides = Object.entries(cnt).filter(([k]) => k.startsWith('slide')).reduce((a, [, v]) => a + v, 0);
  const clipSpeeds: Record<string, number> = {};
  const sample = { p: { ht: 78, wt: 215, id: 'abc' } } as Body;
  for (const n of ['jog', 'run', 'sprint', 'shuffle', 'backpedal']) clipSpeeds[n] = +ft(sample, n).toFixed(2);
  speeds.sort((a, b) => a - b);
  const q = (x: number) => +speeds[Math.floor(x * (speeds.length - 1))].toFixed(1);
  const res = {
    slotNames: ['PG(1)', 'SG(2)', 'SF(3)', 'PF(4)', 'C(5)'],
    ptsShareBySlot: share(slotPts), fgaShareBySlot: share(slotFga), ballTimeShareBySlot: share(slotTouch),
    avgStarSlot: +(starSlotSum / starGames).toFixed(2),
    slidingShareOfGroundFrames: +(slides / cnt.frames).toFixed(3),
    counts: Object.fromEntries(Object.entries(cnt).sort((a, b) => b[1] - a[1])),
    clipGroundSpeedFtPerS_for_6ft6_215: clipSpeeds,
    bodySpeedQuantiles: { p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), p99: q(0.99) },
  };
  console.log(JSON.stringify(res, null, 1));
  writeFileSync(OUT, JSON.stringify(res, null, 1));
}, 1_200_000);
