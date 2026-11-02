// Claude 2026-11-02: shooting and passing audit for arcade soccer (src/game/soccer2). Seeded drills
// with a simulated person on the controls (release timing spread, the stick held the way a thumb
// holds it), goal rate by situation, by SHO and by keeper, and the autopilot's goal rate per
// scenario. Run: npx vite-node scripts/audit_soccer_shots.ts [n]
import cardsRaw from '../src/data/cards-soccer.json';
import { autoplayAttack } from '../src/game/soccer2/autopilot';
import { GX, kickOff, pass, PL, pressShoot, releaseShoot, setupAttack, openSide, setAim, snapAim, step, TOP } from '../src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '../src/game/soccer2/ratings';
import type { Attack, Body, Pt, Scenario, SoccerPlayer, SoccerPos, Squad } from '../src/game/soccer2/types';
import { rng, hashString } from '../src/engine/rng';

let N = 300;
// vite-node drops the script from argv: [node, vite-node, n, part]. SOCCER_AUDIT_LIB=1 imports the drills only.
const MAIN = process.env.SOCCER_AUDIT_LIB !== '1';
const ONLY = MAIN ? (process.argv[3] ?? 'all') : 'none';
if (MAIN && process.argv[2]) N = Number(process.argv[2]);
const OUT = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const GKK = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'];
let uid = 0;
function player(pos: SoccerPos, v = 75, over: Record<string, number> = {}): SoccerPlayer {
  const keeper = pos === 'GK';
  const a: Record<string, number> = Object.fromEntries((keeper ? GKK : OUT).map((k) => [k, v]));
  Object.assign(a, over);
  const id = 'p' + uid++;
  return { id, name: id, tag: id.toUpperCase(), num: null, ht: 182, pos, pos2: [pos], ovr: v, a, keeper };
}
function squad(v = 75, over: Partial<Record<'gk' | 'def' | 'mid' | 'fwd', Record<string, number>>> = {}): Squad {
  return {
    name: 'T',
    abbr: 'T',
    c1: '#cc2222',
    c2: '#ffffff',
    gk: player('GK', v, over.gk),
    def: [player('FB', v, over.def), player('CB', v, over.def), player('CB', v, over.def), player('FB', v, over.def)],
    mid: [player('CM', v, over.mid), player('DM', v, over.mid), player('CM', v, over.mid)],
    fwd: [player('W', v, over.fwd), player('ST', v, over.fwd), player('W', v, over.fwd)],
  };
}
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

export type Situation = '1v1' | 'edge' | 'wide' | 'volley';
/** How a person holds the stick while SHOOT is down (screen vector: x right, y down). */

/** A clean look at goal in a situation; the outfield defenders away except one at the edge. */
export function drill(att: Squad, def: Squad, seed: string, sit: Situation): Attack {
  const a = setupAttack('build', att, def, seed, { side: 1 });
  kickOff(a);
  const r = rng(hashString('drill:' + seed));
  const c = a.bodies[a.ctrl];
  const side = r() < 0.5 ? -1 : 1;
  const at: Record<Situation, Pt> = {
    '1v1': { x: GX + side * r() * 4, y: PL - 13 - r() * 3 },
    edge: { x: GX + side * r() * 7, y: PL - 18.5 - r() * 3 },
    wide: { x: GX + side * (11 + r() * 4), y: PL - 7 - r() * 4 },
    volley: { x: GX + side * r() * 3, y: PL - 9 - r() * 3 },
  };
  c.x = at[sit].x;
  c.y = at[sit].y;
  c.fx = 0;
  c.fy = 1;
  // the outfield defenders out of it (out wide, level with him: he's onside)
  for (const b of a.bodies) if (b.side === 'D' && b.role === 'def') ((b.x = b.x < GX ? 1 : 67), (b.y = c.y + 1), (b.stunUntil = 1e9));
  const w = a.bodies.find((b) => b.side === 'A' && b !== c)!;
  if (sit === 'volley') ((w.x = GX - side * 22), (w.y = PL - 12));
  const holder = sit === 'volley' ? w : c;
  a.ball.owner = holder.id;
  a.ctrl = holder.id;
  // the keeper gets set for where the ball is (the shooter held there a second)
  // (a one-on-one: he's through from 9 m further out, the keeper set on the angle; he runs in at the
  // keeper, as a person does, to his spot)
  const spot = { x: c.x, y: c.y };
  const back = sit === '1v1' ? 9 / Math.hypot(GX - c.x, PL - c.y) : 0;
  const pin = { x: c.x - (GX - c.x) * back, y: c.y - (PL - c.y) * back };
  for (let i = 0; i < 60; i++) {
    step(a, 1 / 60, { x: 0, y: 0 });
    c.x = pin.x;
    c.y = pin.y;
    c.vx = c.vy = 0;
  }
  if (sit === '1v1') {
    const want = Math.hypot(GX - spot.x, PL - spot.y);
    for (let i = 0; i < 240 && Math.hypot(GX - c.x, PL - c.y) > want && !a.end; i++) {
      a.sprinting = true;
      const d = Math.hypot(spot.x - c.x, spot.y - c.y) || 1;
      step(a, 1 / 60, { x: (spot.x - c.x) / d, y: (spot.y - c.y) / d });
    }
    a.sprinting = false;
    return a;
  }
  if (sit === 'edge') {
    // one man closing him down from 4 m
    const d = a.bodies.find((b) => b.side === 'D' && b.role === 'def')!;
    d.x = c.x + side * 2;
    d.y = c.y + 3.5;
    d.stunUntil = 0;
  }
  if (sit === 'volley') {
    // a teammate on the wing crosses it to him
    pass(a, 'lofted', { x: c.x - w.x, y: c.y - w.y });
    for (let i = 0; i < 12; i++) step(a, 1 / 60, null);
  } else {
    c.vy = 5;
    for (let i = 0; i < 12; i++) step(a, 1 / 60, { x: 0, y: 1 });
  }
  return a;
}

/**
 * The person's thumbs while SHOOT is held (2026-11-02 controls: the stick only runs, a drag on SHOOT
 * aims). run: keeps running at goal, no drag (aim assist); still: lets go of the stick, no drag;
 * drag: keeps running and drags to the open side's low corner; bad: drags at the keeper's side.
 */
export type Thumb = 'run' | 'still' | 'drag' | 'bad';
const RUN: Record<Thumb, Pt> = { run: { x: 0, y: 1 }, still: { x: 0, y: 0 }, drag: { x: 0, y: 1 }, bad: { x: 0, y: 1 } };

/** One shot by a simulated person: timing spread `sd` (s), the thumbs, a release lag like the app's. */
export function humanShot(a: Attack, sd: number, thumb: Thumb, r: () => number): Attack {
  const c = a.bodies[a.ctrl];
  const off = gauss(r) * sd;
  // volley: press so the meter tops out about as the cross arrives (the person's timing spread on top)
  if (a.ball.flight) {
    for (let i = 0; i < 240 && !a.end && a.ball.flight && a.ball.owner === null; i++) {
      const d = Math.hypot(a.ball.x - c.x, a.ball.y - c.y);
      if (d - 1.4 < Math.hypot(a.ball.vx, a.ball.vy) * (TOP + 0.15)) break;
      step(a, 1 / 60, null);
    }
    if (a.ball.flight?.to !== c.id) return a;
  }
  if (!pressShoot(a)) return a;
  // the drag goes on as SHOOT is pressed (it counts for a first-time hit still held at contact)
  const pre = openSide(a, c).side;
  if (thumb === 'drag' || thumb === 'bad') setAim(a, snapAim({ x: (thumb === 'drag' ? pre : -pre) * 0.95, y: -0.85 }));
  const hold = Math.max(1, Math.round((TOP + off) * 60));
  for (let i = 0; i < hold && !a.end && a.meter; i++) step(a, 1 / 60, a.ball.flight ? null : RUN[thumb]);
  // the person looks at the keeper as he lets go
  const side = openSide(a, c).side;
  const aim = thumb === 'drag' ? snapAim({ x: side * 0.95, y: -0.85 }) : thumb === 'bad' ? snapAim({ x: -side * 0.95, y: -0.85 }) : null;
  if (a.meter) releaseShoot(a, aim);
  for (let i = 0; i < 60 * 60 && !a.end; i++) step(a, 1 / 60, a.ball.owner === c.id ? RUN[thumb] : { x: 0, y: 0 });
  return a;
}

type Tally = Record<string, number>;
function tally(f: (i: number) => Attack | null): Tally {
  const t: Tally = { n: 0 };
  for (let i = 0; i < N; i++) {
    const a = f(i);
    if (!a) continue;
    t.n++;
    const k = a.end?.kind ?? 'T';
    t[k] = (t[k] ?? 0) + 1;
    if (a.lastShot?.greened) t.green = (t.green ?? 0) + 1;
    if (a.end?.text.includes('HELD') || a.end?.text.includes('COLLECTS')) t.atGk = (t.atGk ?? 0) + 1;
  }
  return t;
}
const pct = (t: Tally, k: string) => (((t[k] ?? 0) / Math.max(1, t.n)) * 100).toFixed(1) + '%';
const row = (label: string, t: Tally) => console.log(label.padEnd(36), 'goal', pct(t, 'G').padStart(6), ' saved', pct(t, 'S').padStart(6), ' held', pct(t, 'atGk').padStart(6), ' wide', pct(t, 'W').padStart(6), ' blk', pct(t, 'B').padStart(6), ' lost', pct(t, 'L').padStart(6), ' green', pct(t, 'green').padStart(6));

if (ONLY === 'all' || ONLY === 'shots') {
console.log('== by situation and thumb (75 team, 75 keeper, timing sd 0.06 s) ==');
for (const sit of ['1v1', 'edge', 'wide', 'volley'] as Situation[])
  for (const thumb of (sit === 'volley' ? ['still', 'drag'] : ['run', 'still', 'drag', 'bad']) as Thumb[]) {
    const t = tally((i) => humanShot(drill(squad(75), squad(75), sit + i, sit), 0.06, thumb, rng(hashString('h' + sit + i))));
    row(sit + ' / ' + thumb, t);
  }
console.log('== 1v1 and edge by SHO (thumb: drag), timing sd 0.06 ==');
for (const sho of [55, 75, 95])
  for (const sit of ['1v1', 'edge'] as Situation[]) {
    const t = tally((i) => humanShot(drill(squad(75, { fwd: { SHO: sho }, mid: { SHO: sho } }), squad(75), sit + 's' + i, sit), 0.06, 'drag', rng(hashString('hs' + sit + i))));
    row(sit + ' SHO ' + sho, t);
  }
console.log('== 1v1 and edge by keeper (SHO 75, drag) ==');
for (const gk of [52, 75, 93])
  for (const sit of ['1v1', 'edge'] as Situation[]) {
    const t = tally((i) => humanShot(drill(squad(75), squad(75, { gk: { DIV: gk, HAN: gk, REF: gk, POS: gk, SPD: gk } }), sit + 'g' + i, sit), 0.06, 'drag', rng(hashString('hg' + sit + i))));
    row(sit + ' GK ' + gk, t);
  }
console.log('== 1v1 by timing spread (drag) ==');
for (const sd of [0, 0.03, 0.06, 0.1, 0.15]) {
  const t = tally((i) => humanShot(drill(squad(75), squad(75), '1v1t' + i, '1v1'), sd, 'drag', rng(hashString('ht' + i))));
  row('1v1 timing sd ' + sd, t);
}

}
if (ONLY === 'all' || ONLY === 'auto') {
console.log('== autopilot (skill 0.75) per scenario, three real matchups ==');
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const pairs = [
  [clubSquad(seasons, 'BAR', 2015), clubSquad(seasons, 'RMA', 2017)],
  [clubSquad(seasons, 'EVE', 2016), clubSquad(seasons, 'LIV', 2019)],
  [clubSquad(seasons, 'MCI', 2023), clubSquad(seasons, 'ARS', 2024)],
];
const M = Math.max(30, Math.round(N / 3));
for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'] as Scenario[]) {
  const t: Tally = { n: 0 };
  let shots = 0;
  for (const [x, y] of pairs)
    for (let i = 0; i < M; i++) {
      const a = setupAttack(sc, x, y, 'sp:' + sc + ':' + i, {});
      autoplayAttack(a, 0.75, 'pilot:' + i);
      t.n++;
      if (a.lastShot) shots++;
      const k = a.end?.kind ?? 'T';
      t[k] = (t[k] ?? 0) + 1;
    }
  row('auto ' + sc + ' (shots ' + ((shots / t.n) * 100).toFixed(0) + '%)', t);
}
}
if (ONLY === 'all' || ONLY === 'pass') passAudit();


/** The man the person means to find, and a pass at him with the stick `errDeg` off his line. */
function passAudit() {
  const kinds: ['ground' | 'lofted' | 'through', number[]][] = [
    ['ground', [0, 10, 20, 35]],
    ['through', [0, 15, 30]],
    ['lofted', [0, 15]],
  ];
  console.log('== passing: build-up, stick aimed at a teammate with an error; thumb holds the stick after the tap ==');
  for (const [kind, errs] of kinds)
    for (const e of errs)
      for (const hold of [true, false]) {
        const t: Tally = { n: 0 };
        let dirErr = 0;
        for (let i = 0; i < N; i++) {
          const r = rng(hashString('pa' + kind + e + i));
          const res = passTrial(squad(75), squad(75), 'pass' + kind + i, kind, e * (r() < 0.5 ? -1 : 1), hold, r);
          if (!res) continue;
          t.n++;
          t[res.out] = (t[res.out] ?? 0) + 1;
          dirErr += res.dirErr;
        }
        t.mate = (t.him ?? 0) + (t.other ?? 0);
        console.log((kind + ' err ' + e + '° ' + (hold ? 'held' : 'let go')).padEnd(30), 'teammate', pct(t, 'mate').padStart(6), ' to him', pct(t, 'him').padStart(6), ' other', pct(t, 'other').padStart(6), ' cut out', pct(t, 'cut').padStart(6), ' loose', pct(t, 'loose').padStart(6), ' offside', pct(t, 'off').padStart(6), ' ball-vs-stick', (dirErr / Math.max(1, t.n)).toFixed(1) + '°');
      }
  for (const [label, minD] of [['', 8]] as [string, number][]) {
    console.log('== ground passes by PAS (stick 10° off, held)' + label + ' ==');
    for (const pas of [50, 75, 95]) {
      const t: Tally = { n: 0 };
      for (let i = 0; i < N; i++) {
        const r = rng(hashString('pp' + pas + i));
        const res = passTrial(squad(75, { mid: { PAS: pas }, fwd: { PAS: pas }, def: { PAS: pas } }), squad(75), 'pp' + i, 'ground', (r() < 0.5 ? -1 : 1) * 10, true, r, minD);
        if (!res) continue;
        t.n++;
        t[res.out] = (t[res.out] ?? 0) + 1;
      }
      t.mate = (t.him ?? 0) + (t.other ?? 0);
      console.log(('PAS ' + pas).padEnd(30), 'teammate', pct(t, 'mate').padStart(6), ' to him', pct(t, 'him').padStart(6), ' other', pct(t, 'other').padStart(6), ' cut out', pct(t, 'cut').padStart(6), ' loose', pct(t, 'loose').padStart(6));
    }
  }
}

/** A pass from the build-up's carrier to a teammate 10-30 m away, stick `errDeg` off his line. */
function passTrial(att: Squad, def: Squad, seed: string, kind: 'ground' | 'lofted' | 'through', errDeg: number, hold: boolean, r: () => number, minD = 8) {
  const a = setupAttack('build', att, def, seed, { side: 1 });
  kickOff(a);
  for (let i = 0; i < 20 + Math.floor(r() * 40); i++) step(a, 1 / 60, { x: 0, y: 0.6 });
  if (a.end || a.ball.owner !== a.ctrl) return null;
  const c = a.bodies[a.ctrl];
  const mates = a.bodies.filter((b) => b.side === 'A' && b !== c && Math.hypot(b.x - c.x, b.y - c.y) > minD && Math.hypot(b.x - c.x, b.y - c.y) < 32 && (kind !== 'through' || b.y > c.y));
  if (!mates.length) return null;
  const to = mates[Math.floor(r() * mates.length)];
  const base = Math.atan2(to.x - c.x, to.y - c.y) + (errDeg * Math.PI) / 180;
  const dir = { x: Math.sin(base), y: Math.cos(base) };
  if (!pass(a, kind, dir, process.env.OLD_PASS !== '1')) return null;
  let launched = -99;
  for (let i = 0; i < 60 * 4 && !a.end; i++) {
    step(a, 1 / 60, hold && i < 30 ? dir : { x: 0, y: 0 });
    if (launched < -9 && a.ball.flight) launched = Math.atan2(a.ball.vx, a.ball.vy);
    if (launched > -9 && a.ball.owner !== null) break;
  }
  const dirErr = launched < -9 ? 0 : (Math.abs(Math.atan2(Math.sin(launched - base), Math.cos(launched - base))) * 180) / Math.PI;
  let out = 'loose';
  if (a.end?.kind === 'O') out = 'off';
  else if (a.end) out = 'cut';
  else if (a.ball.owner === to.id) out = 'him';
  else if (a.ball.owner !== null && a.bodies[a.ball.owner].side === 'A') out = 'other';
  else if (a.ball.owner !== null) out = 'cut';
  return { out, dirErr };
}
