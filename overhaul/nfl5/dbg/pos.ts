import { hashString, rng } from '/home/user/ps-s-nfl/src/engine/rng';
import { decide, pilot } from '/home/user/ps-s-nfl/src/game/football2/autopilot';
import { CALLS } from '/home/user/ps-s-nfl/src/game/football2/calls';
import { newGame } from '/home/user/ps-s-nfl/src/game/football2/drive';
import { lineUp, snap, step } from '/home/user/ps-s-nfl/src/game/football2/engine';
import { fixtureTeams } from '/home/user/ps-s-nfl/src/game/football2/sim-kit';
const id = (process.env.CALL ?? 'c3') as any, k = (process.env.K ?? 'verts') as any;
for (let i = 0; i < Number(process.env.N ?? 2); i++) {
  const t = fixtureTeams('gold');
  const g = newGame(t.off, t.def, 's' + i, 4, 0);
  const p = lineUp(t.off, t.def, 'pass', k, 'inside', 35, 26.67, rng(hashString('dbg' + i)), 0, { call: CALLS[id], shown: CALLS[id].shell, tell: false });
  snap(p);
  const pl = pilot(0.68, 'p' + i); pl.readAt = 0;
  const show = (tag: string) => console.log(tag, p.t.toFixed(2), p.bodies.filter((b) => b.side === 'D' && b.job !== 'rush' || (b.side === 'O' && ['X','Z','SL','TE','RB'].includes(b.slot))).map((b) => b.slot + ':' + b.x.toFixed(0) + ',' + (b.y - 35).toFixed(0) + (b.zone ? '[' + (b.zone.y - 35).toFixed(0) + ']' : '')).join(' '));
  for (let s = 0; s < 1500 && !p.end; s++) {
    decide(p, g, pl); step(p, 1 / 60, null);
    if (p.events.some((e) => e.startsWith('throw'))) { show('THROW'); const tr = p.bodies.find((b) => b.job === 'track'); console.log('  to', tr?.slot, 'land', p.ball?.to.x.toFixed(0), (p.ball!.to.y - 35).toFixed(0), 'flight', (p.ball!.t1 - p.ball!.t0).toFixed(2)); }
    if (p.events.includes('catch')) show('CATCH');
    p.events.length = 0;
  }
  console.log('end', p.end?.kind, p.end?.gain.toFixed(0));
}
