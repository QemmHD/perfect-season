// Audit (read-only): simple scripted "human" strategies on the real engine, to find dominant
// strategies and exploits. Run: cd /home/user/ps-studio && npx vite-node <this file> [n]
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { autoplayAttack } from '/home/user/ps-studio/src/game/soccer2/autopilot';
import { GX, kickOff, PL, setupAttack, step, pressShoot, releaseShoot, setAim, snapAim, openSide, setSprint, TOP, setCurl, pass, ctrlOf, ownerOf } from '/home/user/ps-studio/src/game/soccer2/engine';
import { clubSquad, soccerLines, squadOvr, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import type { Attack, Pt, Scenario, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
import { rng, hashString } from '/home/user/ps-studio/src/engine/rng';

const N = Number(process.argv[2] ?? 200);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
const norm = (x: number, y: number) => {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
};

const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const counts = new Map<string, number>();
for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
const squads: Squad[] = [];
for (const [k, n] of counts) {
  if (n < 14) continue;
  const [fr, s] = k.split('|');
  try {
    squads.push(clubSquad(seasons, fr, Number(s)));
  } catch {}
}
const r0 = rng(hashString('human-pairs'));
const pairs: [Squad, Squad][] = Array.from({ length: N }, () => [squads[Math.floor(r0() * squads.length)], squads[Math.floor(r0() * squads.length)]]);

type Strat = { name: string; shootAt: number; drag: boolean; sd: number; sprint: boolean; weave?: boolean };

/** A beeline: the man on the ball runs (sprints) straight at the middle of the goal and shoots at `shootAt` m. */
function beeline(a: Attack, st: Strat, r: () => number): Attack {
  kickOff(a);
  let n = 0;
  let holdUntil = -1;
  let aim: Pt | null = null;
  while (!a.end && n++ < 60 * 90) {
    const c = ctrlOf(a);
    const own = ownerOf(a);
    let stick: Pt | null = { x: 0, y: 0 };
    if (a.setPiece && a.taker === c.id && !a.meter && !a.strike) {
      // a foul won: take it like a person would (low far corner, the same timing spread)
      if (pressShoot(a)) {
        holdUntil = a.t + TOP + gauss(r) * st.sd;
        const far = a.setPiece ? (a.setPiece.spot.x < GX ? 1 : -1) : 1;
        aim = snapAim({ x: (a.setPiece?.kind === 'penalty' ? (r() < 0.5 ? -1 : 1) : far) * 0.9, y: a.setPiece?.kind === 'penalty' ? -0.8 : 0.6 });
        setAim(a, aim);
      }
    } else if (own && own.id === c.id) {
      const d = Math.hypot(GX - c.x, PL - c.y);
      let dir = norm(GX - c.x, PL - 1 - c.y);
      if (st.weave) dir = norm(dir.x + Math.sin(a.t * 2.2) * 0.6, dir.y);
      stick = dir;
      setSprint(a, st.sprint && a.stamina > 0.08);
      if (!a.meter && holdUntil < 0 && d <= st.shootAt) {
        if (pressShoot(a)) {
          holdUntil = a.t + TOP + gauss(r) * st.sd;
          if (st.drag) {
            const s = openSide(a, c).side;
            aim = snapAim({ x: s * 0.95, y: -0.85 });
            setAim(a, aim);
          }
        }
      }
    } else if (!own && a.ball.flight && a.ball.flight.to === c.id) stick = null;
    else if (!own) stick = null;
    if (a.meter && holdUntil > 0 && a.t >= holdUntil) {
      releaseShoot(a, aim);
      holdUntil = -2;
    }
    step(a, 1 / 60, stick);
  }
  return a;
}

/** A set piece by a person: penalty / free kick aimed into a corner with timing spread. */
function setPieceHuman(a: Attack, aimv: Pt, sd: number, r: () => number, curl = 0): Attack {
  kickOff(a);
  for (let i = 0; i < 20; i++) step(a, 1 / 60, { x: 0, y: 0 });
  if (curl) setCurl(a, curl);
  if (!pressShoot(a)) return a;
  setAim(a, snapAim(aimv));
  const hold = Math.max(1, Math.round((TOP + gauss(r) * sd) * 60));
  for (let i = 0; i < hold && a.meter; i++) step(a, 1 / 60, { x: 0, y: 0 });
  if (a.meter) releaseShoot(a, snapAim(aimv));
  for (let i = 0; i < 60 * 30 && !a.end; i++) step(a, 1 / 60, { x: 0, y: 0 });
  return a;
}

function tally(label: string, f: (i: number) => Attack) {
  const t: Record<string, number> = { n: 0 };
  let used = 0;
  for (let i = 0; i < N; i++) {
    const a = f(i);
    t.n++;
    const k = a.end?.kind ?? 'T';
    t[k] = (t[k] ?? 0) + 1;
    used += a.used;
    if (a.events.includes('penalty')) t.pen = (t.pen ?? 0) + 1;
    if (a.events.includes('freekick')) t.fk = (t.fk ?? 0) + 1;
    const tx = (a.end?.text ?? '').replace(/ BY .*/, '').replace(/ · .*/, '');
    t['~' + tx] = (t['~' + tx] ?? 0) + 1;
  }
  const p = (k: string) => (((t[k] ?? 0) / t.n) * 100).toFixed(1).padStart(5) + '%';
  const texts = Object.entries(t)
    .filter(([k]) => k.startsWith('~'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => k.slice(1) + ' ' + ((v / t.n) * 100).toFixed(0) + '%')
    .join(', ');
  console.log(label.padEnd(44), 'G', p('G'), ' S', p('S'), ' W', p('W'), ' B', p('B'), ' L', p('L'), ' O', p('O'), ' T', p('T'), ' clock', (used / t.n).toFixed(1) + 's', ' penWon', p('pen'), ' fkWon', p('fk'), ' |', texts);
}

const STRATS: Strat[] = [
  { name: 'beeline sprint, shoot@12m assist', shootAt: 12, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@16m assist', shootAt: 16, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@20m assist', shootAt: 20, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@25m assist', shootAt: 25, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@30m assist', shootAt: 30, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@20m drag', shootAt: 20, drag: true, sd: 0.06, sprint: true },
  { name: 'beeline jog, shoot@16m assist', shootAt: 16, drag: false, sd: 0.06, sprint: false },
  { name: 'weave sprint, shoot@16m assist', shootAt: 16, drag: false, sd: 0.06, sprint: true, weave: true },
];
for (const dq of [0, 1]) {
  console.log('\n=== defIQ ' + dq + ' (n=' + N + ' per row, random real club-season matchups) ===');
  for (const sc of ['build', 'counter', 'wide'] as Scenario[]) {
    for (const st of STRATS) tally(sc + ' | ' + st.name, (i) => beeline(setupAttack(sc, pairs[i][0], pairs[i][1], 'h' + sc + i, { defIQ: dq }), st, rng(hashString('hr' + i + st.name))));
    tally(sc + ' | autopilot 0.68 (Pro AI)', (i) => autoplayAttack(setupAttack(sc, pairs[i][0], pairs[i][1], 'h' + sc + i, { defIQ: dq }), 0.68, 'p' + i));
    tally(sc + ' | autopilot 0.88 (Legend AI)', (i) => autoplayAttack(setupAttack(sc, pairs[i][0], pairs[i][1], 'h' + sc + i, { defIQ: dq }), 0.88, 'p' + i));
  }
}
console.log('\n=== set pieces by a person (sd 0.06 s), defIQ 0 ===');
for (const [lab, aim] of [
  ['pen low corner', { x: 0.95, y: -0.85 }],
  ['pen high corner', { x: 0.95, y: 0.85 }],
  ['pen centre', { x: 0, y: 0 }],
] as [string, Pt][])
  tally('penalty | ' + lab, (i) => setPieceHuman(setupAttack('penalty', pairs[i][0], pairs[i][1], 'hp' + i, {}), aim, 0.06, rng(hashString('pp' + lab + i))));
tally('penalty | autopilot 0.75', (i) => autoplayAttack(setupAttack('penalty', pairs[i][0], pairs[i][1], 'hp' + i, {}), 0.75, 'pp' + i));
for (const [lab, aim, curl] of [
  ['fk far top + bend', { x: 0.9, y: 0.8 }, 0.75],
  ['fk far top no bend', { x: 0.9, y: 0.8 }, 0],
  ['fk near low', { x: -0.9, y: -0.8 }, 0],
] as [string, Pt, number][])
  tally('freekick | ' + lab, (i) => {
    const a = setupAttack('freekick', pairs[i][0], pairs[i][1], 'hf' + i, { side: 1 });
    // far side: away from the ball's side
    const far = a.setPiece!.spot.x < GX ? 1 : -1;
    return setPieceHuman(a, { x: aim.x * far, y: aim.y }, 0.06, rng(hashString('ff' + lab + i)), curl * -far);
  });
tally('freekick | autopilot 0.75', (i) => autoplayAttack(setupAttack('freekick', pairs[i][0], pairs[i][1], 'hf' + i, { side: 1 }), 0.75, 'pf' + i));
