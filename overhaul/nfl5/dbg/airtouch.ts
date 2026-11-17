
import { hashString, rng } from '/home/user/ps-s-nfl/src/engine/rng';
import { decide, pilot } from '/home/user/ps-s-nfl/src/game/football2/autopilot';
import { CarryGate } from '/home/user/ps-s-nfl/src/game/football2/controls';
import { newGame } from '/home/user/ps-s-nfl/src/game/football2/drive';
import { lineUp, snap, step } from '/home/user/ps-s-nfl/src/game/football2/engine';
import { depth } from '/home/user/ps-s-nfl/src/game/football2/squad';
import type { Defense, Offense, RunPlay } from '/home/user/ps-s-nfl/src/game/football2/types';
const player = (pos: string, slot: string) => depth(pos, 0.5, 'rushing-regression', slot);
function teams() {
  const off: Offense = {
    qb: player('QB', 'QB'),
    rb: player('RB', 'RB'),
    wr: [player('WR', 'X'), player('WR', 'Z'), player('WR', 'SL')],
    te: player('TE', 'TE'),
    ol: ['OT', 'OG', 'C', 'OG', 'OT'].map((p, i) => player(p, 'OL' + i)) as Offense['ol'],
    k: player('K', 'K')
  };
  const def: Defense = {
    dl: ['DE', 'DT', 'DT', 'DE'].map((p, i) => player(p, 'DL' + i)) as Defense['dl'],
    lb: [0, 1, 2].map((i) => player('LB', 'LB' + i)) as Defense['lb'],
    cb: [player('CB', 'CB1'), player('CB', 'CB2')],
    s: [player('S', 'FS'), player('S', 'SS')]
  };
  return { off, def };
}
function play(run: RunPlay = 'outside', seed = 1, iq = 0) {
  const { off, def } = teams();
  const p = lineUp(off, def, 'run', 'slants', run, 35, 26.67, rng(hashString('rushing:' + seed)), iq);
  snap(p);
  return p;
}

const right = { x: 1, y: 0 };
const run = (seed: number, thumb: boolean) => {
  const { off, def } = teams();
  const concept = (['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh', 'curls', 'posts'] as const)[seed % 8];
  const p = lineUp(off, def, 'pass', concept, 'inside', 30, 26.67, rng(hashString('air-touch:' + seed)));
  for (const d of p.bodies.filter((x) => x.side === 'D')) d.stunUntil = Infinity;
  snap(p);
  const g = newGame(off, def, 'air-touch:' + seed);
  const pl = pilot(0.7, 'air-touch:' + seed);
  const gate = new CarryGate();
  let touched = false;
  const vx: number[] = [];
  let who = '';
  for (let i = 0; i < 600 && !p.end && vx.length < 16; i++) {
    decide(p, g, pl);
    if (thumb && p.phase === 'air' && !touched) { touched = true; gate.touch(true); }
    const c = p.phase === 'run' ? p.carrier : null;
    step(p, 1 / 60, gate.input(c ? c.id : null, false, touched ? right : null));
    if (p.phase === 'run' && p.carrier) { vx.push(p.carrier.vx); who = p.carrier.slot + ' vy ' + p.carrier.vy.toFixed(2); }
  }
  return vx.length >= 16 ? { vx, who, concept } : null;
};
for (let seed = 1; seed < 80; seed++) {
  const h = run(seed, true), f = run(seed, false);
  if (!h || !f) continue;
  const bad = !(h.vx[1] > h.vx[0]) || !(h.vx[6]-h.vx[0] > 1.5) || !(h.vx[6] > f.vx[6]+1) || !(h.vx[15]>0);
  if (bad) console.log(seed, h.concept, h.who, h.vx.slice(0,16).map(v=>v.toFixed(2)).join(' '), '| free6', f.vx[6].toFixed(2));
}
