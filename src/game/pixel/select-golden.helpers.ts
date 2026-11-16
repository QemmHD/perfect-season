// The players-2 extraction gate (studio overhaul): seeded games of each sport run headless, and every
// 1/60 s every body's animation choice (look, clip, frame, pose and the memo it leaves) is hashed.
// The same runner hashes the selection code as it was inside the three render.ts files (base commit
// 79682ba) and as it is in select-{nba,nfl,soccer}.ts, so "moved verbatim" is a checked fact. Test
// code only: nothing in the app imports this file.
import { aiOpponent } from '../../ut/battles';
import { getPool } from '../../ut/pool';
import { fiveOfSquad, squadFromWire } from '../../ut/teams';
import { frameAt, loadClips } from './mocap';
import type { Look } from './body';
import type { Pose } from './rig';

/** FNV-1a over a stream of strings, as 8 hex digits. */
export class Digest {
  private h = 0x811c9dc5;
  n = 0;
  add(s: string) {
    for (let i = 0; i < s.length; i++) {
      this.h ^= s.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193) >>> 0;
    }
    this.h ^= 10;
    this.h = Math.imul(this.h, 0x01000193) >>> 0;
    this.n++;
  }
  hex() {
    return this.h.toString(16).padStart(8, '0');
  }
}

const poseHash = (p: Pose) =>
  Object.keys(p)
    .sort()
    .map((k) => k + (p as unknown as Record<string, number>)[k].toFixed(5))
    .join(',');
const lookHash = (l: Look) => JSON.stringify(Object.keys(l).sort().map((k) => [k, (l as unknown as Record<string, unknown>)[k]]));

interface AnimLike {
  key: string;
  pose: Pose;
  clip?: string;
  ct?: number;
  step?: number;
  ground?: string;
  dribble?: number;
  ball?: string;
}
const animHash = (an: AnimLike) => [an.key, an.clip ?? '', an.clip ? frameAt(an.clip, an.ct ?? 0, an.step ?? 2) : '', an.ct === undefined ? '' : an.ct.toFixed(5), an.step ?? '', an.ground ?? '', an.dribble ?? '', an.ball ?? '', poseHash(an.pose)].join('|');

// ---- NBA ----
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface NbaSel {
  CLIPS: string[];
  lookFor(b: any, kit: any): Look;
  animOf(b: any, t: number, carrying: boolean, look: Look, m: any, shotAt: number | null): AnimLike;
  dunkStyle(b: any): string;
  spins360(b: any): boolean;
}

export async function goldenNba(sel: NbaSel, games = 3): Promise<{ digest: string; samples: number }> {
  const { decide, pilot } = await import('../hoops2/autopilot');
  const { afterPossession, newHoopsGame, startPossession } = await import('../hoops2/game');
  const { step } = await import('../hoops2/engine');
  await loadClips(sel.CLIPS);
  const pool = await getPool();
  const kit = { jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
  const AT_RIM = ['layup', 'dunk', 'contact', 'standdunk', 'oop'];
  const d = new Digest();
  for (let gi = 0; gi < games; gi++) {
    const A = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'gold' + gi).squad));
    const B = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'goldB' + gi).squad));
    const g = newHoopsGame(A.five, B.five, 'gold' + gi, undefined, [], 0);
    const pl = pilot(0.68, 'gold' + gi);
    const memos = new Map<string, unknown>();
    let possessions = 0;
    while (!g.over && possessions++ < 40) {
      const p = startPossession(g);
      pl.letGo = null;
      pl.driving = false;
      pl.goal = null;
      pl.nextThink = 0;
      pl.crosses = 0;
      for (let i = 0; i < 2400 && !p.end; i++) {
        step(p, 1 / 60, decide(p, pl));
        p.events.length = 0;
        if (i % 2) continue;
        for (const b of p.bodies) {
          const who = b.p.id + '|' + b.side;
          const look = sel.lookFor(b, kit);
          let m = memos.get(who);
          if (!m) memos.set(who, (m = { gait: { t: p.t, frac: (b.idx * 0.29) % 1 }, last: null }));
          const ball = p.ball;
          const shotAt = ball && ball.kind === 'shot' && ball.who === b.idx && !AT_RIM.includes(ball.shot ?? '') ? ball.t0 : null;
          const an = sel.animOf(b, p.t, p.handler === b.idx, look, m, shotAt);
          d.add(lookHash(look) + '#' + animHash(an) + '#' + JSON.stringify(m) + '#' + sel.dunkStyle(b) + sel.spins360(b));
        }
      }
      if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
      afterPossession(g, p);
    }
  }
  return { digest: d.hex(), samples: d.n };
}

// ---- NFL ----
export interface NflSel {
  CLIPS: string[];
  lookFor(b: any, kit: any): Look;
  animOf(b: any, t: number, p: any, look: Look, m: any, aiming: boolean): AnimLike;
}

export async function goldenNfl(sel: NflSel, games = 2): Promise<{ digest: string; samples: number }> {
  const { snap, step } = await import('../football2/engine');
  const { afterPlay, kick, newGame, punt, startPlay } = await import('../football2/drive');
  const { chooseCall, decide, fourthDown, pilot } = await import('../football2/autopilot');
  const { loadCards } = await import('../../ut/cards');
  const { rateCard } = await import('../../ut/rate');
  const { NFL_SLOTS } = await import('../../ut/squad');
  const { offenseOfSquad, defenseOfSquad } = await import('../../ut/teams');
  await loadClips(sel.CLIPS);
  const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
  const squad = (pct: number) => {
    const sq: Record<string, { line: (typeof cards)[number]['line']; level: number }> = {};
    const used = new Set<string>();
    for (const s of NFL_SLOTS) {
      const options = cards.filter((c) => c.tier === 'gold' && c.line.pos.includes(s.pos!) && !used.has(c.line.name)).sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id));
      const c = options[Math.min(options.length - 1, Math.floor(options.length * pct))];
      sq[s.id] = { line: c.line, level: 1 };
      used.add(c.line.name);
    }
    return sq;
  };
  const SQ = [squad(0.6), squad(0.9)];
  const kit = { jersey: '#203731', trim: '#ffb612', pants: '#ffb612', helmet: '#203731', stripe: '#ffffff', socks: '#203731', shoes: '#1b1b1f', mask: '#9aa0a6' };
  const d = new Digest();
  for (let gi = 0; gi < games; gi++) {
    const g = newGame(offenseOfSquad(SQ[gi % 2] as never, 'gold'), defenseOfSquad(SQ[(gi + 1) % 2] as never, 'gold'), 'gold' + gi);
    const pl = pilot(0.68, 'gold' + gi);
    const memos = new Map<string, { gait: { t: number; frac: number }; face: { x: number; y: number }; faceAt: number }>();
    let guard = 0;
    while (!g.over && guard++ < 60) {
      if (g.down === 4) {
        const f = fourthDown(g);
        if (f === 'kick') {
          kick(g, 0.05);
          continue;
        }
        if (f === 'punt') {
          punt(g);
          continue;
        }
      }
      const p = startPlay(g, chooseCall(g, pl));
      snap(p);
      for (let k = 0; k < 1500 && !p.end; k++) {
        step(p, 1 / 60, decide(p, g, pl));
        p.events.length = 0;
        if (k % 2) continue;
        for (const b of p.bodies) {
          const who = b.p.id + '|' + b.side;
          let m = memos.get(who);
          if (!m) memos.set(who, (m = { gait: { t: p.t, frac: (b.id * 0.29) % 1 }, face: { x: 0, y: b.side === 'O' ? 1 : -1 }, faceAt: p.t }));
          // the renderer turns the memo's facing toward travel before it picks the animation
          if (Math.hypot(b.vx, b.vy) > 0.6 && b.act !== 'tackle' && b.act !== 'down') {
            const l = Math.hypot(b.vx, b.vy);
            m.face = { x: b.vx / l, y: b.vy / l };
          }
          m.faceAt = p.t;
          const look = sel.lookFor(b, kit);
          const an = sel.animOf(b, p.t, p, look, m, b === p.qb && p.phase === 'drop' && k % 120 < 30);
          d.add(lookHash(look) + '#' + animHash(an) + '#' + JSON.stringify(m.gait));
        }
      }
      if (!p.end) break;
      afterPlay(g, p.end);
    }
  }
  return { digest: d.hex(), samples: d.n };
}

// ---- soccer ----
export interface SoccerSel {
  CLIPS: string[];
  lookFor(b: any, kit: any, keeperKit: any): Look;
  animOf(b: any, t: number, look: Look, m: any): AnimLike;
}

export async function goldenSoccer(sel: SoccerSel, attacks = 16): Promise<{ digest: string; samples: number }> {
  const cardsRaw = (await import('../../data/cards-soccer.json')).default;
  const { decide, pilot } = await import('../soccer2/autopilot');
  const { kickOff, setupAttack, step, CLOCK } = await import('../soccer2/engine');
  const { dealOf, ATTACKS } = await import('../soccer2/match');
  const { clubSquad, soccerLines } = await import('../soccer2/ratings');
  const { rng, hashString } = await import('../../engine/rng');
  await loadClips(sel.CLIPS);
  const { seasons } = soccerLines(cardsRaw as never);
  const counts = new Map<string, number>();
  for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
  const squads: ReturnType<typeof clubSquad>[] = [];
  for (const [k, n] of counts) {
    if (n < 14) continue;
    const [fr, s] = k.split('|');
    try {
      squads.push(clubSquad(seasons, fr, Number(s)));
    } catch {
      // a club-season without a full eleven
    }
  }
  const kit = { jersey: '#c8102e', trim: '#ffffff', shorts: '#c8102e', socks: '#c8102e', shoes: '#111111' };
  const gk = { jersey: '#1fa34a', trim: '#111111', shorts: '#111111', socks: '#1fa34a', shoes: '#111111', gloves: '#f2f2ee' };
  const r = rng(hashString('golden'));
  const d = new Digest();
  for (let i = 0; i < attacks; i++) {
    const att = squads[Math.floor(r() * squads.length)];
    const def = squads[Math.floor(r() * squads.length)];
    const deal = dealOf('g' + i, ATTACKS);
    const a = setupAttack(deal[i % deal.length], att, def, 'gd' + i, { clock: CLOCK, stoppage: false, defIQ: 0 });
    const pl = pilot(0.68, 'gp' + i);
    kickOff(a);
    const memos = new Map<string, { gait: { t: number; frac: number }; face: { x: number; y: number }; faceAt: number }>();
    let n = 0;
    while (!a.end && n++ < 60 * 90) {
      step(a, 1 / 60, decide(a, pl));
      if (n % 2) continue;
      for (const b of a.bodies) {
        const who = b.p.id + '|' + b.side;
        let m = memos.get(who);
        if (!m) memos.set(who, (m = { gait: { t: a.t, frac: (b.id * 0.29) % 1 }, face: { x: b.fx, y: b.fy }, faceAt: a.t }));
        m.face = { x: b.fx, y: b.fy };
        m.faceAt = a.t;
        const look = sel.lookFor(b, kit, gk);
        const an = sel.animOf(b, a.t, look, m);
        d.add(lookHash(look) + '#' + animHash(an) + '#' + JSON.stringify(m.gait));
      }
    }
  }
  return { digest: d.hex(), samples: d.n };
}
