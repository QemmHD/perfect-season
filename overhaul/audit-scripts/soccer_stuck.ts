// Audit probe (read-only): reproduce the frozen-ball state with a plain "run at goal and shoot" input.
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { GX, kickOff, PL, setupAttack, step, pressShoot, releaseShoot, setSprint, TOP, ctrlOf, ownerOf } from '/home/user/ps-studio/src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import type { Pt } from '/home/user/ps-studio/src/game/soccer2/types';

const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const us = clubSquad(seasons, 'BAR', 2015);
const them = clubSquad(seasons, 'RMA', 2017);
let frozen = 0;
let printed = 0;
const N = Number(process.argv[2] ?? 300);
const whereStopped: string[] = [];
for (let i = 0; i < N; i++) {
  const a = setupAttack('build', us, them, 'stuck' + i, {});
  kickOff(a);
  let shotAt = -1;
  let holdUntil = -1;
  let n = 0;
  let shooter: { x: number; y: number } | null = null;
  while (!a.end && n++ < 60 * 150) {
    const c = ctrlOf(a);
    const own = ownerOf(a);
    let stick: Pt | null = { x: 0, y: 0 };
    if (own && own.id === c.id) {
      const d = Math.hypot(GX - c.x, PL - c.y);
      const l = Math.hypot(GX - c.x, PL - 1 - c.y) || 1;
      stick = { x: (GX - c.x) / l, y: (PL - 1 - c.y) / l };
      setSprint(a, a.stamina > 0.08);
      if (!a.meter && holdUntil === -1 && d <= 14 && pressShoot(a)) holdUntil = a.t + TOP;
    } else stick = null;
    if (a.meter && holdUntil > 0 && a.t >= holdUntil) {
      shooter = { x: c.x, y: c.y };
      releaseShoot(a, null);
      holdUntil = -2;
      shotAt = a.t;
    }
    step(a, 1 / 60, stick);
  }
  const f = a.ball.flight;
  if (a.end?.kind === 'T' && f?.kind === 'shot') {
    frozen++;
    const gk = a.bodies.find((b) => b.role === 'gk')!;
    const s = a.lastShot!;
    whereStopped.push(`ball (${a.ball.x.toFixed(1)}, ${a.ball.y.toFixed(1)}) h ${a.ball.h.toFixed(2)} | shooter (${shooter?.x.toFixed(1)}, ${shooter?.y.toFixed(1)}) | gk (${gk.x.toFixed(1)}, ${gk.y.toFixed(1)}) act ${gk.act} | shot speed ${s.speed.toFixed(1)} power ${s.power.toFixed(2)} | t ${a.t.toFixed(1)} shotAt ${shotAt.toFixed(1)} | events ${a.events.slice(-5).join(',')}`);
  }
}
console.log('frozen (ended on the 120 s hard stop with the ball still a "shot"):', frozen, 'of', N);
for (const w of whereStopped.slice(0, 8)) console.log('  ' + w);
