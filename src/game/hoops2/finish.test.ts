// Shooting near the rim: running at it is a finish (a dunk or a layup) from the edge of the paint
// on; standing there, or drifting sideways, it's a jumper.
import { CELLS } from '../../engine/data';
import { hashString, rng } from '../../engine/rng';
import { NFL } from '../../engine/sport';
import { loadAttrs } from '../attrs';
import { newPossession, pressShoot, RIM } from './engine';
import { hooper, lineOf, SPOTS } from './ratings';
import type { Hooper } from './types';

async function fives(): Promise<[Hooper[], Hooper[]]> {
  const at = await loadAttrs();
  const all = CELLS.flatMap((c) => c.players).sort((a, b) => b.val - a.val);
  const five = (skip: number): Hooper[] =>
    SPOTS.map((s) => {
      const p = all.filter((x) => x.pos.includes(s as never))[skip];
      return hooper(lineOf(p, at(p)), s, null);
    });
  return [five(0), five(40)];
}

// (basketball's players: the basketball run of npm test)
const run = NFL ? it.skip : it;

describe('a shot near the rim', () => {
  run('is a finish when he runs at the rim from 10.5 feet, a jumper when he stands there', async () => {
    const [ours, theirs] = await fives();
    const at = (vx: number, vz: number) => {
      const p = newPossession(ours, theirs, [1, 1, 1, 1, 1], rng(hashString('finish')));
      const h = p.bodies[0];
      h.cx = RIM.cx - 10.5;
      h.cz = 0;
      h.vx = vx;
      h.vz = vz;
      // the defenders out of the way
      for (const d of p.bodies.slice(5)) d.cz = 20;
      pressShoot(p);
      return p;
    };
    const running = at(17, 0);
    expect(running.finish).not.toBeNull();
    expect(['dunk', 'layup', 'contact']).toContain(running.finish!.kind);
    // a step or two more before he goes up
    expect(running.finish!.tUp - running.finish!.t0).toBeGreaterThanOrEqual(0.26);
    const standing = at(0, 0);
    expect(standing.finish).toBeNull();
    expect(standing.meter).not.toBeNull();
    const sideways = at(0, 17);
    expect(sideways.finish).toBeNull();
  });
});
