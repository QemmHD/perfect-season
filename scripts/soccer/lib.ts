// Soccer measurement harnesses: the shared parts (studio overhaul soccer-1, Claude 2026-11-10).
// Ported from the 2026-11-09 audit scripts (soccer_sim/human/ratings_human/probe/bend/cam) so every
// later task re-measures with the same seeds: the real club-season elevens, the pair picker, the
// synthetic squads, the scripted person (beeline, set pieces) and the tallies. Run any harness with
//   bash O/heavy.sh npx vite-node scripts/soccer/<name>.ts [n] [part]
import cardsRaw from '../../src/data/cards-soccer.json';
import { hashString, rng } from '../../src/engine/rng';
import { ctrlOf, GX, kickOff, openSide, ownerOf, PL, pressShoot, releaseShoot, setAim, setCurl, setSprint, snapAim, step, TOP } from '../../src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '../../src/game/soccer2/ratings';
import type { Attack, Pt, SoccerPlayer, SoccerPos, Squad } from '../../src/game/soccer2/types';

export const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
export const norm = (x: number, y: number) => {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
};
/** a share as a padded percentage */
export const pct = (a: number, b: number, w = 6) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-').padStart(w);
/** the n-th argument after the script (vite-node drops the script from argv) */
export const arg = (i: number, dflt: string) => process.argv[2 + i] ?? dflt;

/** Every club-season in the card file with at least 14 lines, as an eleven (the audit's 1,714). */
export function realSquads(): Squad[] {
  const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
  const counts = new Map<string, number>();
  for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
  const out: Squad[] = [];
  for (const [k, n] of counts) {
    if (n < 14) continue;
    const [fr, s] = k.split('|');
    try {
      out.push(clubSquad(seasons, fr, Number(s)));
    } catch {
      // a club-season without a keeper or a full back line: not an eleven
    }
  }
  return out;
}

/** n seeded random pairings of the squads (the same pairs for the same key). */
export function pairsOf(squads: Squad[], n: number, key: string): [Squad, Squad][] {
  const r = rng(hashString(key));
  return Array.from({ length: n }, () => [squads[Math.floor(r() * squads.length)], squads[Math.floor(r() * squads.length)]] as [Squad, Squad]);
}

const OUT = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const GKK = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'];
let uid = 0;
/** A synthetic player: every face stat `v`, with `over` overriding some. */
export function player(pos: SoccerPos, v: number, over: Record<string, number> = {}): SoccerPlayer {
  const keeper = pos === 'GK';
  const a: Record<string, number> = Object.fromEntries((keeper ? GKK : OUT).map((k) => [k, v]));
  Object.assign(a, over);
  return { id: 'p' + uid++, name: 'P', tag: 'P', num: null, ht: 182, pos, pos2: [pos], ovr: v, a, keeper };
}
/** A synthetic 4-3-3 eleven rated `v` (its keeper `gk`); `over` overrides stats on the outfield lines. */
export function squad(v: number, gk = v, over: Record<string, number> = {}): Squad {
  return {
    name: 'T',
    abbr: 'T',
    c1: '#c22',
    c2: '#fff',
    gk: player('GK', gk),
    def: [player('FB', v, over), player('CB', v, over), player('CB', v, over), player('FB', v, over)],
    mid: [player('CM', v, over), player('DM', v, over), player('CM', v, over)],
    fwd: [player('W', v, over), player('ST', v, over), player('W', v, over)],
  };
}

/** A scripted person: how he runs, where he shoots from, whether he aims, his timing spread. */
export interface Strat {
  name: string;
  /** SHOOT is pressed inside this distance from the goal (m) */
  shootAt: number;
  /** drag on SHOOT to the open side's low corner (else aim assist) */
  drag: boolean;
  /** release timing spread (s, 1 sd) */
  sd: number;
  sprint: boolean;
  /** weave across the line to goal instead of a straight run */
  weave?: boolean;
  /** a won free kick or penalty: 'far' (free kick far top, penalty a random low corner), or 'low'
   * (both at a random low corner, the audit's ratings harness) */
  setPiece?: 'far' | 'low';
}

/** The no-skill beeline: the man on the ball runs (sprints) straight at the goal and shoots at
 * `shootAt` m; a foul won is taken like a person would. Plays the attack out. */
export function beeline(a: Attack, st: Strat, r: () => number): Attack {
  kickOff(a);
  let n = 0;
  let holdUntil = -1;
  let aim: Pt | null = null;
  while (!a.end && n++ < 60 * 150) {
    const c = ctrlOf(a);
    const own = ownerOf(a);
    let stick: Pt | null = { x: 0, y: 0 };
    if (a.setPiece && a.taker === c.id && !a.meter && !a.strike) {
      if (pressShoot(a)) {
        holdUntil = a.t + TOP + gauss(r) * st.sd;
        const pen = a.setPiece?.kind === 'penalty';
        if (st.setPiece === 'low') aim = snapAim({ x: r() < 0.5 ? -0.9 : 0.9, y: -0.8 });
        else {
          const far = a.setPiece ? (a.setPiece.spot.x < GX ? 1 : -1) : 1;
          aim = snapAim({ x: (pen ? (r() < 0.5 ? -1 : 1) : far) * 0.9, y: pen ? -0.8 : 0.6 });
        }
        setAim(a, aim);
      }
    } else if (own && own.id === c.id) {
      const d = Math.hypot(GX - c.x, PL - c.y);
      let dir = norm(GX - c.x, PL - 1 - c.y);
      if (st.weave) dir = norm(dir.x + Math.sin(a.t * 2.2) * 0.6, dir.y);
      stick = dir;
      setSprint(a, st.sprint && a.stamina > 0.08);
      if (!a.meter && holdUntil < 0 && d <= st.shootAt && pressShoot(a)) {
        holdUntil = a.t + TOP + gauss(r) * st.sd;
        if (st.drag) {
          aim = snapAim({ x: openSide(a, c).side * 0.95, y: -0.85 });
          setAim(a, aim);
        }
      }
    } else if (!own) stick = null;
    if (a.meter && holdUntil > 0 && a.t >= holdUntil) {
      releaseShoot(a, aim);
      holdUntil = -2;
    }
    step(a, 1 / 60, stick);
  }
  return a;
}

/** A set piece by a person: aimed at `aimv` with timing spread `sd`, bend `curl` (setCurl units). */
export function setPieceHuman(a: Attack, aimv: Pt, sd: number, r: () => number, curl = 0): Attack {
  kickOff(a);
  for (let i = 0; i < 20; i++) step(a, 1 / 60, { x: 0, y: 0 });
  if (curl) setCurl(a, curl);
  if (!pressShoot(a)) return a;
  setAim(a, snapAim(aimv));
  const hold = Math.max(1, Math.round((TOP + gauss(r) * sd) * 60));
  for (let i = 0; i < hold && a.meter; i++) step(a, 1 / 60, { x: 0, y: 0 });
  if (a.meter) releaseShoot(a, snapAim(aimv));
  for (let i = 0; i < 60 * 150 && !a.end; i++) step(a, 1 / 60, { x: 0, y: 0 });
  return a;
}

/** How n attacks ended: the letters, the clock used, penalties and free kicks won, the end texts. */
export interface Tally {
  n: number;
  ends: Record<string, number>;
  used: number;
  pen: number;
  fk: number;
  texts: Record<string, number>;
}
export function tallyOf(n: number, f: (i: number) => Attack): Tally {
  const t: Tally = { n: 0, ends: {}, used: 0, pen: 0, fk: 0, texts: {} };
  for (let i = 0; i < n; i++) {
    const a = f(i);
    t.n++;
    const k = a.end?.kind ?? 'T';
    t.ends[k] = (t.ends[k] ?? 0) + 1;
    t.used += a.used;
    if (a.events.includes('penalty')) t.pen++;
    if (a.events.includes('freekick')) t.fk++;
    const tx = (a.end?.text ?? '').replace(/ BY .*/, '').replace(/ · .*/, '');
    t.texts[tx] = (t.texts[tx] ?? 0) + 1;
  }
  return t;
}
/** One printed row: G S W B L O T, the clock used, fouls won, the top end texts. */
export function tallyLine(label: string, t: Tally): string {
  const p = (k: string) => pct(t.ends[k] ?? 0, t.n);
  const texts = Object.entries(t.texts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => k + ' ' + ((v / t.n) * 100).toFixed(0) + '%')
    .join(', ');
  return label.padEnd(44) + ' G' + p('G') + '  S' + p('S') + '  W' + p('W') + '  B' + p('B') + '  L' + p('L') + '  O' + p('O') + '  T' + p('T') + '  clock ' + (t.used / t.n).toFixed(1) + 's  penWon' + pct(t.pen, t.n) + '  fkWon' + pct(t.fk, t.n) + '  | ' + texts;
}
export const tally = (label: string, n: number, f: (i: number) => Attack) => console.log(tallyLine(label, tallyOf(n, f)));
