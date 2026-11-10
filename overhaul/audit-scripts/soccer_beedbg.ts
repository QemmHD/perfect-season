// Audit probe (read-only): why "run at goal, shoot at 12 m" attacks never end.
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { GX, kickOff, PL, setupAttack, step, pressShoot, releaseShoot, setSprint, TOP, ctrlOf, ownerOf } from '/home/user/ps-studio/src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import type { Pt, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
import { rng, hashString } from '/home/user/ps-studio/src/engine/rng';
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const counts = new Map<string, number>();
for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
const squads: Squad[] = [];
for (const [k, n] of counts) { if (n < 14) continue; const [fr, s] = k.split('|'); try { squads.push(clubSquad(seasons, fr, Number(s))); } catch {} }
const r0 = rng(hashString('human-pairs'));
const pairs: [Squad, Squad][] = Array.from({ length: 200 }, () => [squads[Math.floor(r0() * squads.length)], squads[Math.floor(r0() * squads.length)]]);
let open = 0; const why: Record<string, number> = {}; const ex: string[] = [];
for (let i = 0; i < 200; i++) {
  const a = setupAttack('build', pairs[i][0], pairs[i][1], 'hbuild' + i, { defIQ: 0 });
  kickOff(a);
  let holdUntil = -1; let n = 0; let shots = 0;
  while (!a.end && n++ < 60 * 90) {
    const c = ctrlOf(a); const own = ownerOf(a);
    let stick: Pt | null = { x: 0, y: 0 };
    if (own && own.id === c.id) {
      const d = Math.hypot(GX - c.x, PL - c.y); const l = Math.hypot(GX - c.x, PL - 1 - c.y) || 1;
      stick = { x: (GX - c.x) / l, y: (PL - 1 - c.y) / l };
      setSprint(a, a.stamina > 0.08);
      if (!a.meter && holdUntil === -1 && d <= 12 && pressShoot(a)) holdUntil = a.t + TOP;
    } else stick = null;
    if (a.meter && holdUntil > 0 && a.t >= holdUntil) { releaseShoot(a, null); holdUntil = -2; shots++; }
    step(a, 1 / 60, stick);
  }
  if (!a.end) {
    open++;
    const c = ctrlOf(a); const own = ownerOf(a); const gk = a.bodies.find((b) => b.role === 'gk')!;
    const k = 'shots=' + shots + ' owner=' + (own ? own.side + (own.id === c.id ? '(ctrl)' : '(not ctrl)') : 'none') + ' flight=' + (a.ball.flight?.kind ?? 'none') + ' meter=' + !!a.meter;
    why[k] = (why[k] ?? 0) + 1;
    if (ex.length < 5) ex.push(k + ` | ctrl (${c.x.toFixed(1)},${c.y.toFixed(1)}) v ${Math.hypot(c.vx, c.vy).toFixed(2)} | ball (${a.ball.x.toFixed(1)},${a.ball.y.toFixed(1)}) | gk (${gk.x.toFixed(1)},${gk.y.toFixed(1)}) | used ${a.used.toFixed(1)} t ${a.t.toFixed(1)} | nearest def ${Math.min(...a.bodies.filter((b) => b.side === 'D' && b.role === 'def').map((b) => Math.hypot(b.x - c.x, b.y - c.y))).toFixed(2)} m | events ${a.events.slice(-4).join(',')}`);
  }
}
console.log('not ended after 90 s:', open, JSON.stringify(why));
for (const e of ex) console.log('  ' + e);
