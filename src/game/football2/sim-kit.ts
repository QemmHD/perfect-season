// The calibration kit for arcade football (tests and scripts/nfl_calibrate.ts only; imports.test.ts
// keeps every product file from importing it, so none of it reaches a bundle). It plays seeded
// whole games through the real drive, engine and autopilot loop, the way Football2 runs them, with
// the AI's pilot or a "human proxy" (a person's later reads and looser aim, and a thumb that finds
// the stick a beat after each catch or handoff). It counts every play into one accumulator and
// summarizes it as bands with their sample sizes and 95% intervals, and it adds up a game's real
// length from the same pacing constants the screen waits out.
import fixtures from '../../../docs/studio-overhaul/nfl-calibration/fixtures.json';
import { hashString, rng } from '../../engine/rng';
import { autoplay, chooseCall, decide, fourthDown, pilot, pocketThumb } from './autopilot';
import { afterPlay, DRIVES, fgDistance, kick, newGame, punt, rivalDriveEnd, startPlay } from './drive';
import { CarryGate } from './controls';
import { dist, FIELD_W, flightTime, projectRoute, slingWindow, snap, speedOf, step, throwAway, throwTo } from './engine';
import { CALL_IDS, CALLS } from './calls';
import { HEATING } from './shared-v2';
import * as pacing from './pacing';
import { REPLAY_AFTER, REPLAY_SPEED } from '../replay';
import { depth } from './squad';
import type { Defense, FbPlayer, Offense, Play, Pt, RunInput } from './types';

export type Tier = 'silver' | 'gold' | 'elite' | 'promo';
export const TIERS: Tier[] = ['silver', 'gold', 'elite', 'promo'];

export interface Teams {
  off: Offense;
  def: Defense;
}

interface FixtureTier {
  cards: Record<string, string>;
  offense: Offense;
  defense: Defense;
}
interface FixtureFile {
  rule: string;
  tiers: Record<Tier, FixtureTier>;
}

/**
 * A fixture team (both sides of one squad: its offense, and the defense the same tier's offense
 * faces), from the pinned ratings snapshot in docs/studio-overhaul/nfl-calibration/fixtures.json,
 * so before and after stay comparable when cards are re-rated. A fresh copy each call.
 */
export function fixtureTeams(tier: Tier): Teams {
  const t = (fixtures as unknown as FixtureFile).tiers[tier];
  if (!t) throw Error('No pinned NFL fixture for tier ' + tier);
  return JSON.parse(JSON.stringify({ off: t.offense, def: t.defense })) as Teams;
}

/** Synthetic teams rated around `level` (0-1) from the depth model: no card data, fast. */
export function synthTeams(level: number, seed = 'synth'): Teams {
  const p = (pos: string, slot: string): FbPlayer => depth(pos, level, seed, slot);
  return {
    off: {
      qb: p('QB', 'QB'),
      rb: p('RB', 'RB'),
      wr: [p('WR', 'X'), p('WR', 'Z'), p('WR', 'SL')],
      te: p('TE', 'TE'),
      ol: [p('OT', 'LT'), p('OG', 'LG'), p('C', 'C'), p('OG', 'RG'), p('OT', 'RT')],
      k: p('K', 'K')
    },
    def: {
      dl: [p('DE', 'LE'), p('DT', 'LDT'), p('DT', 'RDT'), p('DE', 'RE')],
      lb: [p('LB', 'WLB'), p('LB', 'MLB'), p('LB', 'SLB')],
      cb: [p('CB', 'CB1'), p('CB', 'CB2')],
      s: [p('S', 'FS'), p('S', 'SS')]
    }
  };
}

/**
 * Who plays the offense. `ai`: the autopilot at `skill`, reading from the snap. `human`: the human
 * proxy (skill about 0.35, the throw 1.5-2.9 s after the snap). With `stickDelay` or `neverStick`
 * the human runs with the stick: after each carrier change his thumb lands `stickDelay` seconds
 * later (or never) and holds toward the lane, and the screen's momentum-carry rule turns that into
 * the engine's input. Without either he steers like the pilot (a perfect thumb).
 * `defIQ` is the defense's difficulty.
 */
export interface PilotMode {
  kind: 'ai' | 'human';
  skill: number;
  defIQ: number;
  stickDelay?: number;
  neverStick?: boolean;
  /** nfl-2: the human proxy moves in the pocket with his thumb and throws it away outside the box (autopilot pocketThumb) */
  pocket?: boolean;
}

/** The shipped levels: the AI's skill and the defense's difficulty (Arcade AI_SKILL, difficulty DEFENSE_LEVEL). */
export const LEVELS = {
  rookie: { skill: 0.45, defIQ: -0.5 },
  pro: { skill: 0.68, defIQ: 0 },
  legend: { skill: 0.88, defIQ: 1 }
} as const;
export type LevelName = keyof typeof LEVELS;
export const HUMAN_SKILL = 0.35;
/**
 * nfl-4: the human proxy on the gold rings (the same model as nba-4's, so gold rates compare across
 * sports): his release lands N(ring centre, 50 ms) from where it should, judged at that instant.
 * On a sling he aims where his man will be HUMAN_SLING_WAIT seconds from now (plus the flight), with
 * the pilot's own aim error, and lets go on the ring.
 */
export const HUMAN_RING_SIGMA = 0.05;
/** and he goes for this share of the gold JUKE/SPIN rings he's shown (the rest he's steering, or sees too late) */
export const HUMAN_RING_TRY = 0.7;
export const HUMAN_SLING_WAIT = 0.3;
/** how many times he corrects a sling the ring shows him is off (its moment gone, or amber TIMING) */
export const HUMAN_SLING_FIXES = 2;

/** One play, kick or punt as the wall-clock model needs it. */
export interface PlayRec {
  kind: 'snap' | 'kick' | 'punt';
  /** engine seconds from the snap to the whistle (0 for kicks and punts) */
  secs: number;
  /** what the screen does after it: an ordinary play, a first down, a drive that ended, a score */
  after: 'play' | 'first' | 'drive' | 'score';
  /** trucks during the play (each runs in slow motion for a moment) */
  trucks: number;
  /** a replay, if any: since nfl-3 only a long touchdown gets one (V2 §B.2.7: touchdowns and takeaways) */
  replay: 'long-td' | null;
  /** the game's last play (no replay, no next tray) */
  last: boolean;
}

export interface GameResult {
  score: number;
  ends: string[];
  plays: PlayRec[];
}

/** Everything counted across games. */
export interface Acc {
  c: Record<string, number>;
  runs: number[];
  yac: number[];
  passYds: number[];
  ttt: number[];
  sackT: number[];
  sackYds: number[];
  drivePts: number[];
  drivePlays: number[];
  scores: number[];
  games: number;
}

export function newAcc(): Acc {
  return { c: {}, runs: [], yac: [], passYds: [], ttt: [], sackT: [], sackYds: [], drivePts: [], drivePlays: [], scores: [], games: 0 };
}

const DT = 1 / 60;
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

/** 3rd-down distance buckets (yards to go) */
const THIRD = [
  ['1', 0, 1.5],
  ['2-3', 1.5, 3.5],
  ['4-6', 3.5, 6.5],
  ['7-10', 6.5, 10.5],
  ['11+', 10.5, 99]
] as const;
const thirdBucket = (toGo: number) => THIRD.find(([, lo, hi]) => toGo > lo && toGo <= hi)?.[0] ?? '11+';
/** Field-goal distance buckets */
const FG_BINS = [
  ['<30', 0, 30],
  ['30-39', 30, 40],
  ['40-49', 40, 50],
  ['50-59', 50, 60],
  ['60+', 60, 99]
] as const;
const fgBucket = (d: number) => FG_BINS.find(([, lo, hi]) => d >= lo && d < hi)?.[0] ?? '60+';
/** Pass depth buckets by where the throw was aimed, yards past the line */
const depthOf = (air: number) => (air < 0 ? 'behind' : air < 10 ? '0-9' : air < 20 ? '10-19' : '20+');

/** The human's stick: where his thumb holds it (field direction), once it has landed. */
function stickToward(c: Pt, lane: RunInput): Pt {
  const target = typeof lane === 'number' ? lane : c.x;
  const vx = Math.max(-1, Math.min(1, (target - c.x) / 3));
  const l = Math.hypot(vx, 1);
  return { x: vx / l, y: 1 / l };
}

/**
 * The human proxy's thumb across one play, and what the screen makes of it (controls.ts CarryGate,
 * the same rule Football2 runs): after each carrier change the thumb lands `stickDelay` seconds
 * later (or never) and holds toward the lane; a thumb that lands after the change is a new touch.
 */
function humanStick(mode: PilotMode) {
  const gate = new CarryGate();
  let carrier = -1;
  let since = 0;
  let down = false;
  return (p: Play, lane: RunInput): RunInput => {
    const c = p.phase === 'run' ? p.carrier : null;
    if (!c) {
      gate.input(null, false, null);
      return lane;
    }
    if (c.id !== carrier) {
      carrier = c.id;
      since = p.t;
      down = false;
    }
    const held = !mode.neverStick && p.t - since >= (mode.stickDelay ?? 0);
    if (held && !down) {
      down = true;
      if (p.t > since) gate.touch();
    }
    return gate.input(c.id, p.call === 'run' && c === p.rb, held ? stickToward(c, lane) : null);
  };
}

/** The solo rival's drive ends for a human-proxy game: the AI pilot at the difficulty whose defense
 * IQ this is (Pro if none matches), the same squads the other way round, as Arcade's aiDrivesOf. */
function rivalDrives(teams: Teams, mode: PilotMode, seed: string, drives: number): string[] {
  const level = Object.values(LEVELS).find((l) => l.defIQ === mode.defIQ) ?? LEVELS.pro;
  const t = JSON.parse(JSON.stringify(teams)) as Teams;
  const g = newGame(t.off, t.def, 'cal-rival:' + seed, drives, mode.defIQ);
  return autoplay(g, level.skill, 'cal-rival:' + seed).ends;
}

/**
 * nfl-5: count the defense's call on a lined-up snap (the call mix, its situational shares, a blitz
 * against the base calls, the FREE RUSHER flame and how often it shows), and return a per-step
 * watcher for the flame's rusher: he's "truly unblocked" when nobody is assigned to him, nobody ever
 * holds him, and over his first second (or until the ball is out) he closes on the quarterback at
 * 60% of his top speed or more.
 */
function callStats(p: Play, down: number, toGo: number, ballOn: number, add: (k: string, n?: number) => void): ((p: Play) => void) | null {
  const dc = p.dcall;
  if (!dc) return null;
  const call = CALLS[dc.id];
  add('dcsnaps');
  add('dc:' + dc.id);
  if (dc.rotated) add('dc:rotated');
  if (dc.shown !== 'one' || dc.shell !== 'one') add('dc:not-one');
  if (down >= 3 && toGo >= 7) {
    add('dc:3rdlong');
    if (dc.shell === 'two' || call.family === 'BLITZ') add('dc:3rdlong:hit');
  }
  if (ballOn >= 80) {
    add('dc:rz');
    if (call.coverage === 'man' || dc.id === 'goal') add('dc:rz:hit');
  }
  if (p.call !== 'pass') return null;
  if (call.family === 'BLITZ') add('bz:drop');
  else add('base:drop');
  if (dc.free.length) {
    add('free:snaps');
    if (call.family === 'BLITZ') add('free:blitz');
    if (dc.flame !== null && call.family === 'BLITZ') add('free:blitz:flame');
  }
  if (dc.flame === null) return null;
  add('flame');
  const f = p.bodies[dc.flame];
  const top = speedOf(f.p);
  const d0 = dist(f, p.qb);
  let held = f.mark !== null || !!f.blocker;
  let done = false;
  return (q: Play) => {
    if (done) return;
    if (f.heldUntil > q.t) held = true;
    const out = q.phase !== 'drop' || q.carrier !== q.qb || !!q.end;
    if (q.t >= 1 || out) {
      done = true;
      const closing = (d0 - dist(f, q.qb)) / Math.max(0.2, q.t);
      if (!held && (closing >= 0.6 * top || dist(f, q.qb) < 1.2)) add('flame:free');
    }
  };
}

/** Play one whole game (`drives` drives) of `teams.off` against `teams.def`, counting into `acc`. */
export function playGame(teams: Teams, mode: PilotMode, seed: string, acc?: Acc, drives = DRIVES): GameResult {
  const g = newGame(teams.off, teams.def, 'cal:' + seed, drives, mode.defIQ);
  const pl = pilot(mode.skill, 'cal-p:' + seed);
  if (mode.pocket) pl.legalOnly = true;
  const human = mode.kind === 'human';
  // the human proxy's thumb on the rings (nfl-4): a sling held for the ring, then let go
  let sling: { aim: Pt; at: number } | null = null;
  if (human) {
    const ringRand = rng(hashString('cal-ring:' + seed));
    pl.ringSigma = HUMAN_RING_SIGMA;
    pl.ringTry = HUMAN_RING_TRY;
    pl.throwAt = (p, b, lead, spot) => {
      // he drags onto where his man will be, with his own aim error; the ring shows him the rest:
      // its moment already gone (lead him further) or amber off the path (TIMING: slide the reticle
      // half way back onto the path), up to two corrections
      const ex = spot.x - lead.x,
        ey = spot.y - lead.y;
      let ring: ReturnType<typeof slingWindow> = null;
      let aim: Pt = lead;
      for (let tries = 0; tries <= HUMAN_SLING_FIXES; tries++) {
        let at: Pt = lead;
        for (let i = 0; i < 3; i++) at = projectRoute(b, HUMAN_SLING_WAIT * (1 + tries) + flightTime(p, dist(p.qb, at)));
        const f = tries ? 0.5 : 1;
        aim = { x: Math.max(1, Math.min(FIELD_W - 1, at.x + ex * f)), y: Math.min(109, at.y + ey * f) };
        ring = slingWindow(p, aim);
        if (!ring || (ring.w.center >= p.t + 0.15 && ring.dial !== 'TIMING')) break;
      }
      if (!ring) return false;
      sling = { aim, at: Math.max(p.t, ring.w.center + gauss(ringRand) * HUMAN_RING_SIGMA) };
      return true;
    };
  }
  const withStick = human && (mode.stickDelay !== undefined || !!mode.neverStick);
  let thumbs: ReturnType<typeof pocketThumb> | null = null;
  const c = acc?.c ?? {};
  const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  const plays: PlayRec[] = [];
  let drivePts = 0;
  let drivePlays = 0;
  let redZone = false;
  // the human proxy plays a solo game: the AI rival's drives (its pilot at this difficulty, its
  // offense against this defense) land as his own end, as Arcade shows them, and move his Heat
  // (Football2 does the same with rivalDriveEnd); the AI side has no rival here
  const rivalEnds = human ? rivalDrives(teams, mode, seed, drives) : [];
  let driveNo = 0;
  const closeDrive = (end: string) => {
    if (human && !g.over && driveNo < rivalEnds.length) rivalDriveEnd(g, rivalEnds[driveNo]);
    driveNo++;
    if (!acc) return;
    acc.drivePts.push(drivePts);
    acc.drivePlays.push(drivePlays);
    add('drives');
    add('end:' + end);
    if (redZone) {
      add('rz');
      if (end === 'TD') add('rz-td');
      if (end === 'TD' || end === 'FG') add('rz-score');
    }
    drivePts = 0;
    drivePlays = 0;
    redZone = false;
  };
  for (let guard = 0; !g.over && guard < 400; guard++) {
    if (g.ballOn >= 80) redZone = true;
    if (g.down === 4) {
      const d = fourthDown(g);
      if (d === 'kick') {
        const dist = fgDistance(g);
        const a = kick(g, Math.abs(gauss(pl.rand)) * (0.36 - 0.24 * mode.skill));
        add('fga');
        add('fga:' + fgBucket(dist));
        if (a.points) {
          add('fgm');
          add('fgm:' + fgBucket(dist));
        }
        drivePts += a.points;
        plays.push({ kind: 'kick', secs: 0, after: a.points ? 'score' : 'drive', trucks: 0, replay: null, last: g.over });
        closeDrive(a.driveOver ?? 'MISS');
        continue;
      }
      if (d === 'punt') {
        const a = punt(g);
        plays.push({ kind: 'punt', secs: 0, after: 'drive', trucks: 0, replay: null, last: g.over });
        closeDrive(a.driveOver ?? 'PUNT');
        continue;
      }
      add('4th-go');
    }
    const down = g.down;
    const toGo = g.toGo;
    const p = startPlay(g, chooseCall(g, pl));
    const watch = callStats(p, down, toGo, g.ballOn, add);
    snap(p);
    pl.readAt = human ? 1.5 + pl.rand() * 1.4 : 0;
    const stick = withStick ? humanStick(mode) : null;
    const thumb = human && mode.pocket ? (thumbs ??= pocketThumb('cal-t:' + seed)) : null;
    let thrown = false;
    let trucks = 0;
    sling = null;
    for (let k = 0; k < 1500 && !p.end; k++) {
      let lane: RunInput = null;
      const held = sling as { aim: Pt; at: number } | null;
      if (held && p.phase === 'drop') {
        // holding the sling for the ring: let go at his moment (judged then, applied this step)
        if (p.t + DT >= held.at) {
          throwTo(p, held.aim, undefined, { at: Math.max(held.at, p.t) });
          sling = null;
        }
      } else {
        sling = null;
        lane = decide(p, g, pl);
      }
      if (thumb && p.phase === 'drop' && !sling) {
        const th = thumb(p);
        if (th.away) throwAway(p);
        else lane = th.steer;
      }
      step(p, DT, stick ? stick(p, lane) : lane);
      watch?.(p);
      for (const e of p.events) {
        if (e === 'throwaway') add('throwaway');
        if (e === 'throw' || e === 'throw-pressure') {
          thrown = true;
          add('att');
          acc?.ttt.push(p.t);
          const target = p.bodies.find((b) => b.job === 'track');
          if (target) add('tgt:' + target.slot);
          if (p.aim) add('att:' + depthOf(p.aim.y - p.los));
        } else if (e === 'beat:truck') trucks++;
        if (e.startsWith('beat:') || e === 'break') add('broken');
        else if (e === 'whiff') add('whiff');
        else if (e === 'bighit') add('bighit');
        else if (e === 'fumble-kept') add('fumble-kept');
        else if (e === 'lane-int') add('lane-int');
        else if (e.startsWith('ability:')) add('ability');
        else if (e.startsWith('gold:') || e.startsWith('perfect:')) add(e);
        else if (e.startsWith('ring:')) add(e.split(':').slice(0, 3).join(':'));
      }
      p.events.length = 0;
    }
    const e = p.end!;
    add('plays');
    if (p.dcall) {
      const fam = p.dcall.family === 'BLITZ' ? 'bz' : 'base';
      add(fam + ':plays');
      if (e.gain >= 20) add(fam + ':20');
      if (p.call === 'pass' && e.kind === 'sack') add(fam + ':sack');
    }
    add('down:' + down);
    if (p.call === 'pass') add('down:' + down + ':pass');
    drivePlays++;
    if (e.flag) add('flag');
    if (p.call === 'pass') {
      add('dropbacks');
      if (e.kind === 'sack') {
        add('sack');
        acc?.sackT.push(e.secs);
        acc?.sackYds.push(e.gain);
      }
      if (p.qb.job === 'carry' && e.kind !== 'sack') add('scramble');
      if (thrown) {
        const zone = p.aim ? depthOf(p.aim.y - p.los) : '0-9';
        // (nfl-4: how the sling's ring judged each throw by depth, and how those throws came out)
        const rj = p.ring?.kind === 'sling' ? p.ring.judge + '-' + p.ring.state : 'tap';
        add('rz:' + zone + ':' + rj);
        if (e.caught) add('rzc:' + zone + ':' + rj);
        if (e.caught) {
          add('cmp');
          add('cmp:' + zone);
          acc?.passYds.push(e.gain);
          if (e.gain >= 20) add('pass20');
          if (p.catcher) add('rec:' + p.catcher.slot);
          if (p.caughtAt) {
            add('air', p.caughtAt.y - p.los);
            acc?.yac.push(e.y - p.caughtAt.y);
          }
        } else if (e.kind !== 'int') acc?.passYds.push(0);
        if (e.kind === 'int') {
          add('int');
          add('int:' + zone);
        }
      }
    } else {
      acc?.runs.push(e.gain);
      add('run:' + p.run);
      add('runyds:' + p.run, e.gain);
    }
    if (e.kind === 'fumble') add('fumlost');
    const a = afterPlay(g, e);
    if (down === 3) {
      const b = thirdBucket(toGo);
      add('3rd');
      add('3rd:' + b);
      if (a.firstDown || a.driveOver === 'TD') {
        add('3rdconv');
        add('3rdconv:' + b);
      }
    }
    drivePts += a.points;
    const longTd = a.points > 0 && e.gain >= pacing.LONG_TD_REPLAY.yards;
    plays.push({ kind: 'snap', secs: e.secs, after: a.points ? 'score' : a.driveOver ? 'drive' : a.firstDown ? 'first' : 'play', trucks, replay: longTd ? 'long-td' : null, last: g.over });
    if (a.driveOver) closeDrive(a.driveOver);
  }
  if (acc) {
    acc.games++;
    acc.scores.push(g.score);
    add('perfects', g.perfects);
    add('chances', g.chances);
    if (g.heat.best >= HEATING) add('heatingGames');
    if (g.heat.lit > 0) add('fireGames');
  }
  return { score: g.score, ends: g.ends.slice(), plays };
}

// ---------- bands: a value, its sample size and a 95% interval ----------

export interface Band {
  v: number;
  n: number;
  lo: number;
  hi: number;
}
const Z = 1.96;
const round = (x: number, d = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : NaN);

/** A proportion with its Wilson score interval. */
export function wilson(k: number, n: number): Band {
  if (n <= 0) return { v: NaN, n: 0, lo: NaN, hi: NaN };
  const p = k / n;
  const z2 = Z * Z;
  const mid = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { v: round(p), n, lo: round(Math.max(0, mid - half)), hi: round(Math.min(1, mid + half)) };
}

/** A mean with its normal-approximation interval. */
export function meanBand(xs: number[]): Band {
  const n = xs.length;
  if (!n) return { v: NaN, n: 0, lo: NaN, hi: NaN };
  const m = xs.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0;
  const half = (Z * sd) / Math.sqrt(n);
  return { v: round(m, 3), n, lo: round(m - half, 3), hi: round(m + half, 3) };
}

/** A quantile with its distribution-free (order statistic) interval. */
export function quantileBand(xs: number[], q: number): Band {
  const n = xs.length;
  if (!n) return { v: NaN, n: 0, lo: NaN, hi: NaN };
  const s = [...xs].sort((a, b) => a - b);
  const at = (i: number) => s[Math.max(0, Math.min(n - 1, i))];
  const half = Z * Math.sqrt(n * q * (1 - q));
  return { v: round(at(Math.floor(q * n)), 2), n, lo: round(at(Math.floor(n * q - half)), 2), hi: round(at(Math.ceil(n * q + half)), 2) };
}

/**
 * A statistic of a whole sample (the odds two games tie, say) with a jackknife interval: the spread
 * of its leave-one-out values. Games with the same value share one leave-one-out computation.
 */
export function jackknifeBand(xs: number[], stat: (ys: number[]) => number): Band {
  const n = xs.length;
  if (n < 3) return { v: NaN, n, lo: NaN, hi: NaN };
  const full = stat(xs);
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  const loo: [number, number][] = [];
  for (const [v, m] of counts) {
    const i = xs.indexOf(v);
    loo.push([stat([...xs.slice(0, i), ...xs.slice(i + 1)]), m]);
  }
  const mean = loo.reduce((s, [t, m]) => s + t * m, 0) / n;
  const se = Math.sqrt(((n - 1) / n) * loo.reduce((s, [t, m]) => s + m * (t - mean) ** 2, 0));
  return { v: round(full), n, lo: round(Math.max(0, full - Z * se)), hi: round(Math.min(1, full + Z * se)) };
}

/** The odds that two different games of this sample satisfy `f` (two independent games, unbiased). */
const pairOdds = (scores: number[], f: (a: number, b: number) => boolean) => {
  const h = new Map<number, number>();
  for (const s of scores) h.set(s, (h.get(s) ?? 0) + 1);
  const n = scores.length;
  let pairs = 0;
  for (const [a, na] of h) for (const [b, nb] of h) if (f(a, b)) pairs += na * (nb - (a === b ? 1 : 0));
  return n > 1 ? pairs / (n * (n - 1)) : NaN;
};
export const tieOdds = (scores: number[]) => pairOdds(scores, (a, b) => a === b);

export function summarize(acc: Acc) {
  const c = acc.c;
  const n = (k: string) => c[k] ?? 0;
  const runs = acc.runs;
  const att = n('att');
  const drives = n('drives');
  const share = (k: string, of: number) => wilson(n(k), of);
  const runCount = (f: (g: number) => boolean) => runs.filter(f).length;
  return {
    games: acc.games,
    drives,
    plays: n('plays'),
    ptsPerGame: meanBand(acc.scores),
    ptsPerDrive: meanBand(acc.drivePts),
    playsPerDrive: meanBand(acc.drivePlays),
    driveEnds: Object.fromEntries(['TD', 'FG', 'MISS', 'INT', 'FUM', 'DOWNS', 'PUNT', 'SAF', 'TIME'].map((k) => [k, share('end:' + k, drives)])),
    turnoverDrives: wilson(n('end:INT') + n('end:FUM'), drives),
    redZone: { trips: n('rz'), td: share('rz-td', n('rz')), score: share('rz-score', n('rz')) },
    third: { all: share('3rdconv', n('3rd')), ...Object.fromEntries(THIRD.map(([b]) => [b, share('3rdconv:' + b, n('3rd:' + b))])) },
    passShare: share('dropbacks', n('plays')),
    completion: share('cmp', att),
    byDepth: Object.fromEntries(['behind', '0-9', '10-19', '20+'].map((z) => [z, { att: n('att:' + z), cmp: share('cmp:' + z, n('att:' + z)), int: share('int:' + z, n('att:' + z)) }])),
    intRate: share('int', att),
    laneIntShare: share('lane-int', n('int')),
    sackRate: share('sack', n('dropbacks')),
    sackYards: meanBand(acc.sackYds),
    timeToThrow: meanBand(acc.ttt),
    timeToSack: quantileBand(acc.sackT, 0.5),
    scrambleRate: share('scramble', n('dropbacks')),
    yardsPerAttempt: meanBand(acc.passYds),
    yac: meanBand(acc.yac),
    airPerCatch: { v: round(n('air') / Math.max(1, n('cmp')), 2), n: n('cmp') },
    gain20PerAttempt: share('pass20', att),
    targets: Object.fromEntries(['X', 'Z', 'SL', 'TE', 'RB'].map((s) => [s, share('tgt:' + s, att)])),
    catches: Object.fromEntries(['X', 'Z', 'SL', 'TE', 'RB'].map((s) => [s, share('rec:' + s, n('cmp'))])),
    runs: {
      ypc: meanBand(runs),
      median: quantileBand(runs, 0.5),
      p10: quantileBand(runs, 0.1),
      p25: quantileBand(runs, 0.25),
      p75: quantileBand(runs, 0.75),
      p90: quantileBand(runs, 0.9),
      p99: quantileBand(runs, 0.99),
      stuffed: wilson(runCount((g) => g <= 0), runs.length),
      '1-3': wilson(runCount((g) => g > 0 && g < 3.5), runs.length),
      '4-6': wilson(runCount((g) => g >= 3.5 && g < 6.5), runs.length),
      '7-9': wilson(runCount((g) => g >= 6.5 && g < 9.5), runs.length),
      '10+': wilson(runCount((g) => g >= 10), runs.length),
      '20+': wilson(runCount((g) => g >= 20), runs.length),
      '40+': wilson(runCount((g) => g >= 40), runs.length),
      byPlay: Object.fromEntries(['inside', 'outside', 'power'].map((k) => [k, { n: n('run:' + k), ypc: round(n('runyds:' + k) / Math.max(1, n('run:' + k)), 2) }]))
    },
    brokenPerPlay: { v: round(n('broken') / Math.max(1, n('plays')), 3), n: n('plays') },
    fumblesLost: share('fumlost', n('plays')),
    flags: share('flag', n('plays')),
    abilityPopsPerPlay: { v: round(n('ability') / Math.max(1, n('plays')), 3), n: n('plays') },
    // nfl-4: the gold rings and Heat
    perfectRate: share('perfects', n('chances')),
    perfectBy: { sling: share('perfect:sling', n('gold:sling')), move: wilson(n('perfect:juke') + n('perfect:spin'), n('gold:move')) },
    ringsJudged: Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith('ring:'))),
    slingByDepth: Object.fromEntries(
      Object.entries(c)
        .filter(([k]) => k.startsWith('rz:'))
        .map(([k, v]) => [k.slice(3), { att: v, cmp: share('rzc:' + k.slice(3), v) }])
    ),
    chancesPerGame: { v: round(n('chances') / Math.max(1, acc.games), 2), n: acc.games },
    heatingGames: share('heatingGames', acc.games),
    fireGames: share('fireGames', acc.games),
    fieldGoals: { all: share('fgm', n('fga')), ...Object.fromEntries(FG_BINS.map(([b]) => [b, share('fgm:' + b, n('fga:' + b))])), fifty: wilson(n('fga:50-59') + n('fga:60+'), n('fga')) },
    fourthDownTries: { v: round(n('4th-go') / Math.max(1, acc.games), 2), n: acc.games },
    // nfl-5: the AI's play calling and the defense's calls
    passShareByDown: Object.fromEntries([1, 2, 3, 4].map((d) => [d, share('down:' + d + ':pass', n('down:' + d))])),
    calls: {
      snaps: n('dcsnaps'),
      mix: Object.fromEntries(CALL_IDS.map((id) => [id, share('dc:' + id, n('dcsnaps'))])),
      distinct: CALL_IDS.filter((id) => n('dc:' + id) > 0).length,
      rotated: share('dc:rotated', n('dcsnaps')),
      thirdLongTwoHighOrBlitz: share('dc:3rdlong:hit', n('dc:3rdlong')),
      redZoneManOrGoal: share('dc:rz:hit', n('dc:rz')),
      blitzSack: share('bz:sack', n('bz:drop')),
      baseSack: share('base:sack', n('base:drop')),
      blitz20: share('bz:20', n('bz:plays')),
      base20: share('base:20', n('base:plays')),
      flameOnFreeBlitz: share('free:blitz:flame', n('free:blitz')),
      flameTrulyFree: share('flame:free', n('flame'))
    },
    scores: {
      hist: Object.fromEntries([...new Set(acc.scores)].sort((a, b) => a - b).map((s) => [s, acc.scores.filter((x) => x === s).length])),
      tie: jackknifeBand(acc.scores, tieOdds),
      zeroZero: jackknifeBand(acc.scores, (ys) => pairOdds(ys, (a, b) => a === 0 && b === 0)),
      margin3: jackknifeBand(acc.scores, (ys) => pairOdds(ys, (a, b) => Math.abs(a - b) === 3)),
      margin7: jackknifeBand(acc.scores, (ys) => pairOdds(ys, (a, b) => Math.abs(a - b) === 7))
    }
  };
}
export type Summary = ReturnType<typeof summarize>;

// ---------- the wall-clock model ----------

export interface Pace {
  /** calling a play (or a 4th-down choice) */
  pick: number;
  /** stopping the kick needle */
  kickAim: number;
  /** replays shown (off under reduced motion, and in autoplay) */
  replays: boolean;
}
export const HUMAN_PACE: Pace = { pick: pacing.HUMAN_PICK, kickAim: pacing.HUMAN_KICK_AIM, replays: true };
export const AUTO_PACE: Pace = { pick: pacing.AUTO_PICK, kickAim: pacing.AUTO_KICK_AIM, replays: false };

/**
 * Real seconds one play takes on the screen: `live` from its tray to the whistle (or a kick's
 * result), when the screen reports progress, and `after` from there to the next tray.
 */
export function playWallParts(r: PlayRec, pace: Pace): { live: number; after: number } {
  if (r.kind === 'kick') return { live: pace.pick + pace.kickAim + pacing.KICK_RESULT, after: pacing.KICK_TO_TRAY };
  if (r.kind === 'punt') return { live: pace.pick, after: pacing.PUNT_TO_TRAY };
  // a truck: a moment of hit-stop, then slow motion while the play runs on
  const slow = r.trucks * (pacing.SLOWMO.truck * (1 - pacing.SLOWMO_RATE) + pacing.TRUCK_HIT_STOP);
  const live = pace.pick + r.secs + slow;
  if (pace.replays && r.replay && !r.last) {
    return { live, after: pacing.REPLAY_LEAD.score + (pacing.LONG_TD_REPLAY.before + REPLAY_AFTER) / REPLAY_SPEED + pacing.REPLAY_TAIL };
  }
  return { live, after: pacing.WHISTLE_TO_TRAY[r.after] };
}

/** Real seconds one play takes on the screen, from its tray to the next tray. */
export function playWall(r: PlayRec, pace: Pace): number {
  const w = playWallParts(r, pace);
  return w.live + w.after;
}

/** A game's real length (seconds) and each drive's, from the first tray to the last play's next tray. */
export function wallClock(plays: PlayRec[], pace: Pace): { total: number; drives: number[] } {
  const drives: number[] = [];
  let cur = 0;
  for (const r of plays) {
    cur += playWall(r, pace);
    if (r.after !== 'play') {
      drives.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) drives.push(cur);
  return { total: drives.reduce((s, d) => s + d, 0), drives };
}

/** Run `games` seeded games of one case and summarize them (and their wall-clock drives). */
export function runCase(teams: () => Teams, mode: PilotMode, label: string, games: number, pace?: Pace, drives = DRIVES) {
  const acc = newAcc();
  const wall: number[] = [];
  const gameWall: number[] = [];
  for (let i = 0; i < games; i++) {
    const res = playGame(teams(), mode, label + ':' + i, acc, drives);
    if (pace) {
      const w = wallClock(res.plays, pace);
      wall.push(...w.drives);
      gameWall.push(w.total);
    }
  }
  const s = summarize(acc);
  return {
    label,
    mode,
    ...s,
    ...(pace ? { wall: { perDrive: meanBand(wall), medianDrive: quantileBand(wall, 0.5), p90Drive: quantileBand(wall, 0.9), perGame: meanBand(gameWall) } } : {})
  };
}
export type CaseResult = ReturnType<typeof runCase>;

/** Two sides' games of a ladder rung: your offense (the human proxy) and the AI's, each against the other's defense. */
export function ladder(us: Teams, them: Teams, level: LevelName, games: number, human: PilotMode, label: string) {
  const ai: PilotMode = { kind: 'ai', ...LEVELS[level] };
  let win = 0;
  let tie = 0;
  for (let i = 0; i < games; i++) {
    const mine = playGame({ off: us.off, def: them.def }, { ...human, defIQ: LEVELS[level].defIQ }, label + ':us:' + i).score;
    const theirs = playGame({ off: them.off, def: us.def }, ai, label + ':ai:' + i).score;
    if (mine > theirs) win++;
    else if (mine === theirs) tie++;
  }
  return { label, level, games, win: wilson(win, games), tie: wilson(tie, games), loss: wilson(games - win - tie, games) };
}

