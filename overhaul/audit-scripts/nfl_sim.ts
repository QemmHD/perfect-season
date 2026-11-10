// AUDIT ONLY (read-only): seeded NFL arcade simulations vs real NFL reference rates.
// Run from the repo: cd /home/user/ps-studio && npx vite-node <this file> > out.json
import { hashString, rng } from '/home/user/ps-studio/src/engine/rng';
import { snap, step, isLine } from '/home/user/ps-studio/src/game/football2/engine';
import { afterPlay, kick, newGame, punt, startPlay, fgDistance, type Game } from '/home/user/ps-studio/src/game/football2/drive';
import { chooseCall, decide, fourthDown, pilot } from '/home/user/ps-studio/src/game/football2/autopilot';
import type { Play, Pt } from '/home/user/ps-studio/src/game/football2/types';
import { loadCards } from '/home/user/ps-studio/src/ut/cards';
import { rateCard } from '/home/user/ps-studio/src/ut/rate';
import { NFL_SLOTS } from '/home/user/ps-studio/src/ut/squad';
import { offenseOfSquad, defenseOfSquad, type SquadCards } from '/home/user/ps-studio/src/ut/teams';

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
const GAMES = Number(env.GAMES ?? 150);
const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
function squad(tier: string, pct: number, salt: string): SquadCards {
  const sq: SquadCards = {};
  const used = new Set<string>();
  for (const s of NFL_SLOTS) {
    const options = cards.filter((c) => c.tier === tier && c.line.pos.includes(s.pos!) && !used.has(c.line.name)).sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id));
    const c = options[Math.min(options.length - 1, Math.floor(options.length * pct))];
    if (!c) throw Error('Missing fixture ' + tier + '/' + s.id);
    sq[s.id] = { line: c.line, level: 1 };
    used.add(c.line.name);
  }
  void salt;
  return sq;
}
const SQ = {
  silver: squad('silver', 0.6, 's'),
  gold: squad('gold', 0.6, 'g'),
  elite: squad('gold', 0.97, 'e'),
};
const team = (k: keyof typeof SQ) => ({ off: offenseOfSquad(SQ[k], 'audit'), def: defenseOfSquad(SQ[k], 'audit') });

type Rec = Record<string, number>;
interface Opts { skill: number; defIQ: number; human?: boolean; stickDelay?: number; neverStick?: boolean }

function gauss(r: () => number) { return (r() + r() + r() + r() - 2) * 1.732; }

function playGame(g: Game, o: Opts, seed: string, c: Rec, runs: number[], passGains: number[], perDrive: { pts: number; plays: number; end: string; last: boolean }[], tdLens: number[]) {
  const pl = pilot(o.skill, seed);
  const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  let guard = 0;
  let dPlays = 0, dStartScore = 0, lastDriveIdx = g.drive;
  const closeDrive = () => {
    const end = g.ends[g.ends.length - 1];
    perDrive.push({ pts: g.score - dStartScore, plays: dPlays, end, last: lastDriveIdx === g.drives - 1 });
    dPlays = 0; dStartScore = g.score; lastDriveIdx = g.drive;
  };
  while (!g.over && guard++ < 300) {
    if (g.down === 4) {
      const d = fourthDown(g);
      if (d === 'kick') {
        const dist = fgDistance(g);
        const before = g.score;
        kick(g, Math.abs(gauss(pl.rand)) * (0.36 - 0.24 * o.skill));
        add('fga'); if (g.score > before) add('fgm');
        add(dist >= 50 ? 'fga50' : dist >= 40 ? 'fga40' : 'fga0'); if (g.score > before) add(dist >= 50 ? 'fgm50' : dist >= 40 ? 'fgm40' : 'fgm0');
        closeDrive();
        continue;
      }
      if (d === 'punt') { punt(g); closeDrive(); continue; }
      add('4th-go');
    }
    const down = g.down, toGo = g.toGo, line = g.ballOn + g.toGo;
    const p = startPlay(g, chooseCall(g, pl));
    snap(p);
    pl.readAt = o.human ? 1.5 + pl.rand() * 1.4 : 0;
    let thrown = false, throwT = 0;
    let carrierId = -1, carrierSince = 0;
    let broken = 0, whiff = 0, dives = 0, tackles = 0;
    for (let k = 0; k < 1500 && !p.end; k++) {
      let steer: number | null | Pt = decide(p, g, pl);
      if (o.human !== undefined && (o.stickDelay !== undefined || o.neverStick) && p.phase === 'run' && p.carrier) {
        if (p.carrier.id !== carrierId) { carrierId = p.carrier.id; carrierSince = p.t; }
        const c = p.carrier;
        const target = typeof steer === 'number' ? steer : c.x;
        if (o.neverStick || p.t - carrierSince < (o.stickDelay ?? 0)) steer = { x: 0, y: 0 };
        else { const vx = Math.max(-1, Math.min(1, (target - c.x) / 3)); const l = Math.hypot(vx, 1); steer = { x: vx / l, y: 1 / l }; }
      }
      step(p, 1 / 60, steer);
      for (const e of p.events) {
        if (e.startsWith('throw')) { thrown = true; throwT = p.t; }
        if (e.startsWith('beat:') || e === 'break') { broken++; add('broken'); add(e); }
        if (e === 'whiff') { whiff++; add('whiff'); }
        if (e === 'dive') { dives++; add('dive'); }
        if (e === 'pancake') add('pancake');
        if (e === 'route-win' || e.startsWith('route-win')) add('route-win');
        if (e === 'lane-int') add('lane-int');
        if (e === 'pass-deflected') add('deflect');
        if (e.startsWith('ability:')) add('ability');
        if (e === 'bighit') add('bighit');
        if (e === 'fumble-kept') add('fumble-kept');
        if (e === 'tackle') tackles++;
      }
      p.events.length = 0;
    }
    void tackles; void dives; void whiff;
    const e = p.end!;
    add('plays'); dPlays++;
    add('secs', e.secs);
    if (e.flag) add('flag:' + e.flag.kind);
    if (p.bust !== undefined) add('bust');
    if (p.call === 'pass') {
      add('dropbacks');
      if (thrown) { add('att'); add('ttt', throwT); }
      if (e.kind === 'sack') { add('sack'); add('sackyds', e.gain); add('sackT', e.secs); }
      if (thrown && e.caught) { add('cmp'); add('pyds', e.gain); passGains.push(e.gain); if (p.caughtAt) { add('air', p.caughtAt.y - p.los); add('yac', e.y - p.caughtAt.y); } if (p.catcher) add('to:' + p.catcher.slot); if (e.gain >= 20) add('pass20'); if (e.gain >= 40) add('pass40'); if (p.catchInfo?.contested) add('cmp-contested'); }
      else if (thrown && e.kind !== 'int') { passGains.push(0); }
      if (thrown && p.aim) { const z = p.aim.y - p.los < 10 ? 's' : p.aim.y - p.los < 20 ? 'm' : 'd'; add('att:' + z); if (e.caught) add('cmp:' + z); if (e.kind === 'int') add('int:' + z); }
      if (e.kind === 'int') add('int');
      if (p.qb.job === 'carry' && e.kind !== 'sack') { add('scramble'); }
      add('cov:' + p.coverage); if (thrown && e.caught) add('cmpcov:' + p.coverage);
    } else {
      add('runs'); add('ryds', e.gain); runs.push(e.gain);
      if (e.gain <= 0) add('stuff'); if (e.gain >= 10) add('run10'); if (e.gain >= 20) add('run20');
      add('run:' + p.run); add('runyds:' + p.run, e.gain);
      add('brokenOnRuns', broken);
    }
    if (e.kind === 'fumble') add('fumlost');
    if (e.kind === 'td') { add('td'); tdLens.push(e.gain); add(p.call === 'pass' ? 'td-pass' : 'td-run'); }
    if (e.kind === 'out') add('outbounds');
    if (down === 3) { add('3rd'); if (e.kind !== 'incomplete' && e.kind !== 'int' && e.kind !== 'fumble' && (e.y >= line || e.kind === 'td')) add('3rdconv'); }
    if (down === 4) { add('4th'); if (e.kind !== 'incomplete' && e.kind !== 'int' && e.kind !== 'fumble' && (e.y >= line || e.kind === 'td')) add('4thconv'); }
    void toGo;
    const before = g.drive;
    afterPlay(g, e);
    if (g.drive !== before) closeDrive();
  }
  for (const e of g.ends) add('end:' + e);
}

function pct(xs: number[], q: number) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }

function summarize(c: Rec, runs: number[], passGains: number[], perDrive: { pts: number; plays: number; end: string; last: boolean }[], games: number, tdLens: number[]) {
  const f = (a: number, b: number, d = 3) => +(a / Math.max(1, b)).toFixed(d);
  const drives = perDrive.length;
  return {
    games,
    drives,
    ptsPerGame: f(perDrive.reduce((s, d) => s + d.pts, 0), games, 2),
    ptsPerDrive: f(perDrive.reduce((s, d) => s + d.pts, 0), drives, 2),
    playsPerDrive: f(c.plays ?? 0, drives, 2),
    tdPerDrive: f(c['end:TD'] ?? 0, drives),
    fgPerDrive: f(c['end:FG'] ?? 0, drives),
    toPerDrive: f((c['end:INT'] ?? 0) + (c['end:FUM'] ?? 0), drives),
    downsPerDrive: f(c['end:DOWNS'] ?? 0, drives),
    timePerDrive: f(c['end:TIME'] ?? 0, drives),
    missPerDrive: f(c['end:MISS'] ?? 0, drives),
    safPerDrive: f(c['end:SAF'] ?? 0, drives),
    passShare: f(c.dropbacks ?? 0, c.plays ?? 0),
    cmpPct: f(c.cmp ?? 0, c.att ?? 0),
    ypa: f(c.pyds ?? 0, c.att ?? 0, 2),
    ypc: f(c.pyds ?? 0, c.cmp ?? 0, 2),
    anyA: f((c.pyds ?? 0) + (c.sackyds ?? 0) - 45 * (c.int ?? 0), (c.att ?? 0) + (c.sack ?? 0), 2),
    intPct: f(c.int ?? 0, c.att ?? 0),
    laneIntShare: f(c['lane-int'] ?? 0, c.int ?? 0),
    sackPct: f(c.sack ?? 0, c.dropbacks ?? 0),
    sackTime: f(c.sackT ?? 0, c.sack ?? 0, 2),
    timeToThrow: f(c.ttt ?? 0, c.att ?? 0, 2),
    scrambleRate: f(c.scramble ?? 0, c.dropbacks ?? 0),
    airYdsPerCmp: f(c.air ?? 0, c.cmp ?? 0, 2),
    yacPerCmp: f(c.yac ?? 0, c.cmp ?? 0, 2),
    pass20PerAtt: f(c.pass20 ?? 0, c.att ?? 0),
    pass40PerAtt: f(c.pass40 ?? 0, c.att ?? 0),
    depth: Object.fromEntries(['s', 'm', 'd'].map((z) => [z, { att: c['att:' + z] ?? 0, cmp: f(c['cmp:' + z] ?? 0, c['att:' + z] ?? 0), int: f(c['int:' + z] ?? 0, c['att:' + z] ?? 0) }])),
    targetsCaught: Object.fromEntries(['X', 'Z', 'SL', 'TE', 'RB'].map((k) => [k, f(c['to:' + k] ?? 0, c.cmp ?? 0)])),
    cmpManVsZone: { man: f(c['cmpcov:man'] ?? 0, c['cov:man'] ?? 0), zone: f(c['cmpcov:zone'] ?? 0, c['cov:zone'] ?? 0) },
    ypcRun: f(c.ryds ?? 0, c.runs ?? 0, 2),
    runMedian: pct(runs, 0.5),
    runP10: pct(runs, 0.1), runP25: pct(runs, 0.25), runP75: pct(runs, 0.75), runP90: pct(runs, 0.9), runP99: pct(runs, 0.99),
    stuffPct: f(c.stuff ?? 0, c.runs ?? 0),
    run10Pct: f(c.run10 ?? 0, c.runs ?? 0),
    run20Pct: f(c.run20 ?? 0, c.runs ?? 0),
    runByPlay: Object.fromEntries(['inside', 'outside', 'power'].map((k) => [k, { n: c['run:' + k] ?? 0, ypc: f(c['runyds:' + k] ?? 0, c['run:' + k] ?? 0, 2) }])),
    brokenPerRun: f(c.brokenOnRuns ?? 0, c.runs ?? 0),
    brokenPerPlay: f(c.broken ?? 0, c.plays ?? 0),
    whiffPerPlay: f(c.whiff ?? 0, c.plays ?? 0),
    missedTacklePct: f((c.broken ?? 0) + (c.whiff ?? 0), (c.broken ?? 0) + (c.whiff ?? 0) + (c.plays ?? 0) - (c.att ?? 0) + (c.cmp ?? 0) - (c.sack ?? 0)),
    fumLostPerPlay: f(c.fumlost ?? 0, c.plays ?? 0, 4),
    fumKeptPerPlay: f(c['fumble-kept'] ?? 0, c.plays ?? 0, 4),
    flagsPerPlay: f(['holding', 'def-holding', 'offside', 'dpi'].reduce((s, k) => s + (c['flag:' + k] ?? 0), 0), c.plays ?? 0),
    bustPerPass: f(c.bust ?? 0, c.dropbacks ?? 0),
    bigHitPerPlay: f(c.bighit ?? 0, c.plays ?? 0),
    third: { att: c['3rd'] ?? 0, conv: f(c['3rdconv'] ?? 0, c['3rd'] ?? 0) },
    fourth: { att: c['4th'] ?? 0, conv: f(c['4thconv'] ?? 0, c['4th'] ?? 0) },
    fg: { att: c.fga ?? 0, pct: f(c.fgm ?? 0, c.fga ?? 0), u40: f(c.fgm0 ?? 0, c.fga0 ?? 0), '40s': f(c.fgm40 ?? 0, c.fga40 ?? 0), '50+': f(c.fgm50 ?? 0, c.fga50 ?? 0), n50: c.fga50 ?? 0 },
    tdSharePass: f(c['td-pass'] ?? 0, c.td ?? 0),
    tdLenMedian: pct(tdLens, 0.5),
    tdLen20plus: f(tdLens.filter((x) => x >= 20).length, tdLens.length),
    avgPlaySecs: f(c.secs ?? 0, c.plays ?? 0, 2),
    lastDrive: (() => { const L = perDrive.filter((d) => d.last); return { n: L.length, pts: f(L.reduce((s, d) => s + d.pts, 0), L.length, 2), plays: f(L.reduce((s, d) => s + d.plays, 0), L.length, 2), time: f(L.filter((d) => d.end === 'TIME').length, L.length) }; })(),
    ends: Object.fromEntries(['TD', 'FG', 'MISS', 'INT', 'DOWNS', 'PUNT', 'FUM', 'SAF', 'TIME'].map((k) => [k, c['end:' + k] ?? 0])),
    abilityPopsPerPlay: f(c.ability ?? 0, c.plays ?? 0),
  };
}

function runCase(offK: keyof typeof SQ, defK: keyof typeof SQ, o: Opts, label: string) {
  const c: Rec = {}; const runs: number[] = []; const pg: number[] = []; const pd: { pts: number; plays: number; end: string; last: boolean }[] = []; const td: number[] = [];
  const off = team(offK).off, def = team(defK).def;
  const scores: number[] = [];
  for (let i = 0; i < GAMES; i++) {
    const g = newGame(off, def, 'audit:' + label + ':' + i, 4, o.defIQ);
    playGame(g, o, 'audit-p:' + label + ':' + i, c, runs, pg, pd, td);
    scores.push(g.score);
  }
  const hist: Record<number, number> = {};
  for (const s of scores) hist[s] = (hist[s] ?? 0) + 1;
  return { label, off: offK, def: defK, ...o, ...summarize(c, runs, pg, pd, GAMES, td), scoreHist: hist, scores };
}

const out: unknown[] = [];
const which = env.CASES ?? 'all';
// 1. equal teams, AI pilot at each level vs the matching defense level (how the AI rival plays)
if (which === 'all' || which.includes('ai'))
  for (const [lvl, skill, iq] of [['rookie', 0.45, -0.5], ['pro', 0.68, 0], ['legend', 0.88, 1]] as const)
    for (const t of ['silver', 'gold', 'elite'] as const) out.push(runCase(t, t, { skill, defIQ: iq }, 'ai-' + lvl + '-' + t));
// 2. human proxy (late reads, low aim skill) against each difficulty, gold vs gold
if (which === 'all' || which.includes('human'))
  for (const [lvl, iq] of [['rookie', -0.5], ['pro', 0], ['legend', 1]] as const) out.push(runCase('gold', 'gold', { skill: 0.35, defIQ: iq, human: true }, 'human-' + lvl + '-gold'));
// 3. direct-stick reaction cost: human proxy, stick held immediately vs after a delay vs never
if (which === 'all' || which.includes('stick'))
  for (const [nm, d, never] of [['stick0', 0, false], ['stick0.35', 0.35, false], ['stick0.7', 0.7, false], ['nostick', 0, true]] as const)
    out.push(runCase('gold', 'gold', { skill: 0.35, defIQ: 0, human: true, stickDelay: d, neverStick: never }, 'human-pro-' + nm));
// 4. mismatches
if (which === 'all' || which.includes('mis')) {
  out.push(runCase('elite', 'silver', { skill: 0.68, defIQ: 0 }, 'ai-pro-elite-v-silver'));
  out.push(runCase('silver', 'elite', { skill: 0.68, defIQ: 0 }, 'ai-pro-silver-v-elite'));
}
console.log(JSON.stringify(out, (k, v) => (k === 'scores' ? undefined : v), 1));
void isLine; void hashString; void rng;
