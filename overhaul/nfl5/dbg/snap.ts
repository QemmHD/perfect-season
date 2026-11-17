import { hashString, rng } from '/home/user/ps-s-nfl/src/engine/rng';
import { decide, pilot } from '/home/user/ps-s-nfl/src/game/football2/autopilot';
import { CALLS } from '/home/user/ps-s-nfl/src/game/football2/calls';
import { newGame } from '/home/user/ps-s-nfl/src/game/football2/drive';
import { dist, lineUp, snap, step } from '/home/user/ps-s-nfl/src/game/football2/engine';
import { fixtureTeams } from '/home/user/ps-s-nfl/src/game/football2/sim-kit';
const id = (process.env.CALL ?? 'c0') as any, k = (process.env.K ?? 'verts') as any;
for (let i = 0; i < Number(process.env.N ?? 3); i++) {
  const t = fixtureTeams('gold');
  const g = newGame(t.off, t.def, 's' + i, 4, 0);
  const r = rng(hashString('dbg' + i));
  const p = lineUp(t.off, t.def, 'pass', k, 'inside', 35, 26.67, r, 0, { call: CALLS[id], shown: CALLS[id].shell, tell: true });
  console.log('--- snap', i, 'free', p.dcall?.free, 'flame', p.dcall?.flame);
  for (const b of p.bodies.filter((b) => b.side === 'D' && b.job === 'rush')) console.log('  rusher', b.slot, 'winAt', b.winAt.toFixed(2), 'mark', b.mark, 'at', b.x.toFixed(1), (b.y - 35).toFixed(1));
  snap(p);
  const pl = pilot(0.68, 'p' + i);
  pl.readAt = 0;
  for (let s = 0; s < 1500 && !p.end; s++) {
    decide(p, g, pl);
    step(p, 1 / 60, null);
    if (s % 15 === 0 && p.phase === 'drop') console.log('  t', p.t.toFixed(2), 'press', p.pressure.toFixed(2), 'near', Math.min(...p.bodies.filter((b) => b.job === 'rush').map((b) => dist(b, p.qb))).toFixed(2), 'qb', p.qb.y.toFixed(1), 'stage', pl.reads?.stage, pl.reads?.i);
    if (p.events.length) console.log('  ev', p.t.toFixed(2), p.events.join(','));
    p.events.length = 0;
  }
  console.log('  end', p.end?.kind, p.end?.gain.toFixed(1), p.end?.text, 'caught', p.end?.caught);
}
