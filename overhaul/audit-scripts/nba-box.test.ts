// AUDIT ONLY (not part of the repo). Seeded autopilot games with a box-score tracker built from the
// engine's own events. Run from the repo:
//   cd /home/user/ps-studio && npx vitest run --dir <this dir> nba-box
import { writeFileSync } from 'node:fs';
import { getPool } from '/home/user/ps-studio/src/ut/pool';
import { aiOpponent } from '/home/user/ps-studio/src/ut/battles';
import { fiveOfSquad, squadFromWire } from '/home/user/ps-studio/src/ut/teams';
import { decide, pilot } from '/home/user/ps-studio/src/game/hoops2/autopilot';
import { afterPossession, newHoopsGame, startPossession } from '/home/user/ps-studio/src/game/hoops2/game';
import { dist, RIM, step } from '/home/user/ps-studio/src/game/hoops2/engine';
import type { Hooper, Possession } from '/home/user/ps-studio/src/game/hoops2/types';

const OUT = process.env.AUDIT_OUT ?? '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/nba-box.json';
const GAMES = Number(process.env.AUDIT_GAMES ?? 30);

interface Box {
  games: number; poss: number; pts: number; fga: number; fgm: number; tpa: number; tpm: number; fta: number; ftm: number;
  tov: number; stl: number; intc: number; outs: number; clock: number; orb: number; drb: number; ast: number; blk: number;
  rimA: number; rimM: number; closeA: number; closeM: number; midA: number; midM: number;
  greens: number; jumpers: number; cOpen: number; cLight: number; cHeavy: number; cSmoth: number;
  and1: number; possT: number; passes: number; oops: number; dunks: number; posters: number; ankles: number; shook: number;
  traps: number; calls: number; starPts: number; starFga: number; topScorerShare: number; maxPlayerPts: number;
  marginSum: number; wins: number; ties: number; scoreList: number[];
}
const zero = (): Box => ({ games: 0, poss: 0, pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, tov: 0, stl: 0, intc: 0, outs: 0, clock: 0, orb: 0, drb: 0, ast: 0, blk: 0, rimA: 0, rimM: 0, closeA: 0, closeM: 0, midA: 0, midM: 0, greens: 0, jumpers: 0, cOpen: 0, cLight: 0, cHeavy: 0, cSmoth: 0, and1: 0, possT: 0, passes: 0, oops: 0, dunks: 0, posters: 0, ankles: 0, shook: 0, traps: 0, calls: 0, starPts: 0, starFga: 0, topScorerShare: 0, maxPlayerPts: 0, marginSum: 0, wins: 0, ties: 0, scoreList: [] });

/** Play one side's 16 possessions with the autopilot, counting a box score from the events. */
function playTracked(off: Hooper[], def: Hooper[], bench: Hooper[], seed: string, skill: number, defIQ: number, box: Box): number {
  const g = newHoopsGame(off, def, seed, undefined, bench, defIQ);
  const pl = pilot(skill, seed);
  const dt = 1 / 60;
  const ptsBy = new Map<string, number>();
  const fgaBy = new Map<string, number>();
  const star = off.slice().sort((a, b) => b.ovr - a.ovr)[0].id;
  while (!g.over) {
    const p: Possession = startPossession(g);
    pl.letGo = null; pl.driving = false; pl.goal = null; pl.nextThink = 0; pl.crosses = 0;
    let lastCatch: { who: number; t: number; passer: number } | null = null;
    let passer = -1;
    for (let i = 0; i < 60 * 40 && !p.end; i++) {
      const before = p.handler;
      const s = decide(p, pl);
      step(p, dt, s);
      for (const e of p.events) {
        const shotKind = p.lastShot?.kind;
        const shooterIdx = p.ball?.kind === 'shot' ? p.ball.who : before ?? -1;
        const name = shooterIdx >= 0 ? p.bodies[shooterIdx]?.p.id : undefined;
        const fga = (kind: string | undefined, three: boolean) => {
          box.fga++;
          if (three) box.tpa++;
          if (name) fgaBy.set(name, (fgaBy.get(name) ?? 0) + 1);
          if (name === star) box.starFga++;
          if (kind === 'layup' || kind === 'dunk' || kind === 'contact' || kind === 'standdunk' || kind === 'oop') box.rimA++;
          else if (kind === 'close') box.closeA++;
          else if (kind === 'mid') box.midA++;
        };
        if (e === 'release' || e === 'release-green') {
          box.jumpers++;
          if (e === 'release-green') box.greens++;
          const c = p.lastShot?.contest;
          if (c === 'open') box.cOpen++; else if (c === 'light') box.cLight++; else if (c === 'heavy') box.cHeavy++; else box.cSmoth++;
          fga(shotKind, shotKind === 'three');
        } else if (e.startsWith('finish:')) {
          fga(e.split(':')[1], false);
          const k = e.split(':')[1];
          if (k === 'oop') box.oops++;
          if ((k === 'dunk' || k === 'contact' || k === 'standdunk' || k === 'oop') && e.endsWith(':make')) box.dunks++;
        } else if (e.startsWith('blocked:')) {
          box.blk++;
          // a blocked shot is an attempt (its release/finish event never fires)
          const who = p.bodies.find((b) => b.side === 'O' && b.bumped);
          const k = p.lastShot?.kind;
          box.fga++;
          if (k === 'three') box.tpa++;
          if (who) fgaBy.set(who.p.id, (fgaBy.get(who.p.id) ?? 0) + 1);
          if (who?.p.id === star) box.starFga++;
          if (k === 'layup' || k === 'dunk' || k === 'contact' || k === 'standdunk' || k === 'oop') box.rimA++;
          else if (k === 'close') box.closeA++;
          else if (k === 'mid') box.midA++;
        } else if (e === 'ft:make') { box.fta++; box.ftm++; box.and1++; }
        else if (e === 'ft:miss') box.fta++;
        else if (e.startsWith('orb:')) { box.orb++; lastCatch = null; }
        else if (e === 'pass' || e === 'lob') { box.passes++; passer = before ?? -1; }
        else if (e === 'catch' || e === 'oop-catch') { lastCatch = { who: p.handler ?? -1, t: p.t, passer }; }
        else if (e.startsWith('posterized:')) box.posters++;
        else if (e.startsWith('ankles:')) box.ankles++;
        else if (e.startsWith('shook:')) box.shook++;
        else if (e.startsWith('trap:')) box.traps++;
        else if (e.startsWith('call:')) box.calls++;
      }
      p.events.length = 0;
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
    const e = p.end;
    box.poss++;
    box.possT += p.t;
    if (e.kind === 'make') {
      box.fgm++;
      const ls = p.lastShot;
      const k = ls?.kind;
      const fgPts = (p.ball?.points ?? e.points) - (ls?.and1 ? 1 : 0);
      if (fgPts >= 3) box.tpm++;
      if (k === 'layup' || k === 'dunk' || k === 'contact' || k === 'standdunk' || k === 'oop') box.rimM++;
      else if (k === 'close') box.closeM++;
      else if (k === 'mid') box.midM++;
      if (lastCatch && lastCatch.who === e.who && p.t - lastCatch.t < 3.5 && lastCatch.passer >= 0) box.ast++;
      const nm = p.bodies[e.who]?.p.id;
      if (nm) ptsBy.set(nm, (ptsBy.get(nm) ?? 0) + e.points);
      if (nm === star) box.starPts += e.points;
    } else if (e.kind === 'miss') box.drb++;
    else {
      box.tov++;
      if (e.kind === 'steal') box.stl++;
      else if (e.kind === 'int') box.intc++;
      else if (e.kind === 'out') box.outs++;
      else if (e.kind === 'clock') box.clock++;
    }
    afterPossession(g, p);
  }
  box.games++;
  box.pts += g.score;
  box.scoreList.push(g.score);
  const mx = Math.max(0, ...ptsBy.values());
  box.maxPlayerPts += mx;
  box.topScorerShare += g.score ? mx / g.score : 0;
  return g.score;
}

function summary(b: Box) {
  const r = (x: number, d = 3) => Number(x.toFixed(d));
  const ptsPerFGM = b.fgm ? (b.pts - b.ftm) / b.fgm : 0;
  return {
    games: b.games,
    ppg: r(b.pts / b.games, 1),
    ppp: r(b.pts / b.poss),
    secPerPoss: r(b.possT / b.poss, 1),
    fgaPerPoss: r(b.fga / b.poss),
    fgPct: r(b.fgm / b.fga),
    threePArate: r(b.tpa / b.fga),
    threePct: r(b.tpa ? b.tpm / b.tpa : 0),
    efg: r((b.fgm + 0.5 * b.tpm) / b.fga),
    ftRate: r(b.fta / b.fga),
    ftPct: r(b.fta ? b.ftm / b.fta : 0),
    tovPct: r(b.tov / b.poss),
    stealPct: r(b.stl / b.poss),
    intPct: r(b.intc / b.poss),
    outPct: r(b.outs / b.poss),
    shotClockPct: r(b.clock / b.poss),
    orbPct: r(b.orb / Math.max(1, b.orb + b.drb)),
    astPerFGM: r(b.fgm ? b.ast / b.fgm : 0),
    blkPerFGA: r(b.blk / b.fga),
    rimShare: r(b.rimA / b.fga), rimPct: r(b.rimA ? b.rimM / b.rimA : 0),
    closeShare: r(b.closeA / b.fga), closePct: r(b.closeA ? b.closeM / b.closeA : 0),
    midShare: r(b.midA / b.fga), midPct: r(b.midA ? b.midM / b.midA : 0),
    greenRate: r(b.greens / Math.max(1, b.jumpers)),
    jumperContest: { open: r(b.cOpen / b.jumpers), light: r(b.cLight / b.jumpers), heavy: r(b.cHeavy / b.jumpers), smothered: r(b.cSmoth / b.jumpers) },
    and1PerGame: r(b.and1 / b.games, 2),
    passesPerPoss: r(b.passes / b.poss, 2),
    oopsPerGame: r(b.oops / b.games, 2), dunksPerGame: r(b.dunks / b.games, 2), postersPerGame: r(b.posters / b.games, 2),
    anklesPerGame: r(b.ankles / b.games, 2), shookPerGame: r(b.shook / b.games, 2),
    starShareOfPts: r(b.starPts / Math.max(1, b.pts)), starShareOfFGA: r(b.starFga / Math.max(1, b.fga)),
    topScorerShare: r(b.topScorerShare / b.games), topScorerPts: r(b.maxPlayerPts / b.games, 1),
    scoreSd: r(Math.sqrt(b.scoreList.reduce((a, x) => a + (x - b.pts / b.games) ** 2, 0) / b.games), 2),
    winPct: b.wins || b.ties ? r((b.wins + b.ties * 0.5) / b.games) : undefined,
    tiePct: r(b.ties / b.games),
    ptsPerFGM: r(ptsPerFGM),
  };
}

it('NBA autopilot box scores', async () => {
  const pool = await getPool();
  const results: Record<string, unknown> = {};
  const squads = new Map<string, { five: Hooper[]; bench: Hooper[]; decade: number; ovr: number; title: string }>();
  const squadAt = (target: number, seed: string) => {
    const k = target + ':' + seed;
    let s = squads.get(k);
    if (!s) {
      const rung = aiOpponent(pool, target, seed);
      const { five, bench } = fiveOfSquad(squadFromWire(pool, rung.squad));
      s = { five, bench, decade: rung.decade, ovr: rung.ovr, title: rung.title };
      squads.set(k, s);
    }
    return s;
  };
  const t0 = Date.now();
  // 1) even matchups at three tiers, Pro AI (skill .68, def 0) and Legend (skill .88, def 1)
  const configs: [string, number, number, number, number][] = [
    ['even78_pro', 78, 78, 0.68, 0],
    ['even86_pro', 86, 86, 0.68, 0],
    ['even70_pro', 70, 70, 0.68, 0],
    ['even78_legend_def1', 78, 78, 0.88, 1],
    ['even78_rookieAI_defm05', 78, 78, 0.45, -0.5],
    ['strong90_vs_75_pro', 90, 75, 0.68, 0],
  ];
  const byDecade = new Map<number, Box>();
  for (const [lab, ta, tb, skill, def] of configs) {
    const box = zero();
    const opp = zero();
    for (let i = 0; i < GAMES; i++) {
      const A = squadAt(ta, 'A' + lab.slice(0, 6) + (i % 10));
      const B = squadAt(tb, 'B' + lab.slice(0, 6) + (i % 10));
      const a = playTracked(A.five, B.five, A.bench, 'g' + lab + i, skill, def, box);
      const b = playTracked(B.five, A.five, B.bench, 'h' + lab + i, skill, def, opp);
      box.marginSum += a - b;
      if (a > b) box.wins++;
      else if (a === b) box.ties++;
      if (lab === 'even78_pro') {
        for (const s of [A, B]) {
          if (!byDecade.has(s.decade)) byDecade.set(s.decade, zero());
        }
      }
    }
    results[lab] = { team: summary(box), opp: summary(opp), avgMargin: Number((box.marginSum / GAMES).toFixed(2)) };
    console.log(lab, JSON.stringify(results[lab]));
  }
  // 2) by era: themed squads near 80, grouped by the decade of the theme, each vs an 80 opponent
  const eraBox = new Map<number, Box>();
  for (let i = 0; i < GAMES * 4; i++) {
    const A = squadAt(80, 'era' + i);
    const B = squadAt(80, 'opp' + (i % 12));
    const b = eraBox.get(A.decade) ?? zero();
    eraBox.set(A.decade, b);
    playTracked(A.five, B.five, A.bench, 'era' + i, 0.68, 0, b);
  }
  const era: Record<string, unknown> = {};
  for (const [d, b] of [...eraBox.entries()].sort((x, y) => x[0] - y[0])) era[d + 's'] = summary(b);
  results.byEra = era;
  console.log('byEra', JSON.stringify(era));
  // squad sample for the record
  results.sampleSquads = [...squads.values()].slice(0, 6).map((s) => ({ title: s.title, ovr: s.ovr, five: s.five.map((h) => `${h.name} ${h.pos} ${h.ovr} thr${h.thr} lay${h.lay} ddk${h.ddk} hnd${h.hnd} prd${h.prd}`) }));
  results.ms = Date.now() - t0;
  writeFileSync(OUT, JSON.stringify(results, null, 1));
}, 3_600_000);
