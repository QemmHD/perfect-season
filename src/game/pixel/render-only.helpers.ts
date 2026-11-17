// players-2: the render-only proof (studio overhaul). Two checks, shared by render-only.test.ts and
// render-only-soccer.test.ts:
// 1. importGraph: the files each sport's simulation reaches by static import. None may be in
//    src/game/pixel/ or src/data/appearance/: the engines can't call drawing code at all.
// 2. stepDigests: a seeded game run twice, once bare and once with the whole drawing pipeline
//    (look via matchLook and the appearance record, clip selection, proportions, the art pixel, the
//    crowd hook, a raster now and then) run on every body every step. The engine state is hashed after every step; the two runs must hash the same.
// Test code only: nothing in the app imports this file.
import { Digest } from './select-golden.helpers';
import { drawnHeight, shoulderWidthPx } from './proportions';
import { artScaleFor, quantPx } from './art-scale';
import { rasterBody, type Look } from './body';
import { loadAppearance } from './appearance';
import { excite } from './crowd';
import { clipMeta, frameAt, loadClips, mocapJointsAtFrame } from './mocap';
import { applyTouches, fineStep, headBob, stepFor } from './locomotion';
import { SpriteBudget } from './sprite-budget';
import type { Memo as NbaMemo } from './select-nba';
import type { Memo as NflMemo } from './select-nfl';
import type { Memo as SoccerMemo } from './select-soccer';
import { aiOpponent } from '../../ut/battles';
import { getPool } from '../../ut/pool';
import { fiveOfSquad, squadFromWire } from '../../ut/teams';

const node = (m: string) => import(/* @vite-ignore */ 'node:' + m);

/** Every file reached from `entries` by static import (src-relative paths), with who imported it first. */
export async function importGraph(entries: string[]): Promise<Map<string, string>> {
  const { readFileSync, existsSync } = await node('fs');
  const path = await node('path');
  const src = path.resolve(new URL('../../', import.meta.url).pathname);
  const seen = new Map<string, string>();
  const todo = entries.map((e) => [path.resolve(src, e), '(entry)'] as [string, string]);
  const resolve = (from: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null;
    const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
    for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts']) if (existsSync(c) && !c.endsWith('/')) return c;
    return null;
  };
  while (todo.length) {
    const [file, by] = todo.pop()!;
    const rel = path.relative(src, file);
    if (seen.has(rel)) continue;
    seen.set(rel, by);
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text: string = String(readFileSync(file));
    // static imports and re-exports (type-only imports are erased: they can't run anything)
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      const r = resolve(file, m[1]);
      if (r) todo.push([r, rel]);
    }
  }
  return seen;
}

/**
 * Each sport's simulation: the engine, the autopilot, the game/drive/match flow and the ratings. (Not
 * soccer2/arcade.ts: it is the soccer lazy-load barrel that also re-exports the Soccer2 screen and the
 * kits; the lineup and shootout code it serves lives in ratings, match and shootout, listed here.)
 */
export const SIM_ENTRIES = {
  nba: ['game/hoops2/engine.ts', 'game/hoops2/autopilot.ts', 'game/hoops2/game.ts', 'game/hoops2/ratings.ts', 'game/hoops2/badges.ts'],
  nfl: ['game/football2/engine.ts', 'game/football2/autopilot.ts', 'game/football2/drive.ts', 'game/football2/ratings.ts', 'game/football2/squad.ts'],
  soccer: ['game/soccer2/engine.ts', 'game/soccer2/autopilot.ts', 'game/soccer2/match.ts', 'game/soccer2/ratings.ts', 'game/soccer2/shootout.ts'],
};

/** Everything the drawing does to one body that could touch it: render code reading engine state
 * (players-5: the motion, its locomotion touches and the frame's sprite budget too). */
function drawPass(look: Look, sel: () => { an: { clip?: string; ct?: number; step?: number; pose: unknown; gait?: { rate: number; stride: number } }; dip: boolean; lead: number; mo: { lean: { fwd: number; side: number } } }, heightViewPx: number, raster: boolean, budget: SpriteBudget, who: string) {
  const fr = sel();
  const an = fr.an;
  const a = artScaleFor('A', 3, 1, 3);
  const px = quantPx(a.artPxFor(heightViewPx), a.viewPerArt);
  shoulderWidthPx(look.ht, look.wt, px, look.pads ?? 0);
  excite('score', 0);
  const req = { who, px, must: false, staleFor: 0, near: 0 };
  budget.order([req]);
  if (budget.allow(req)) budget.drew(who);
  else budget.stale(who);
  if (raster) {
    const step = an.clip ? fineStep(stepFor(false, an.step ?? 2), an.gait?.rate ?? 1) : 1;
    const frame = an.clip ? frameAt(an.clip, an.ct ?? 0, step) : 0;
    const touch = { heavy: 0, fwd: fr.mo.lean.fwd, side: fr.mo.lean.side, stride: an.gait?.stride ?? 1, dip: fr.dip, lead: fr.lead, bob: an.clip ? headBob(frame / clipMeta(an.clip).frames, px) : 0 };
    const pose = an.clip ? applyTouches(mocapJointsAtFrame(an.clip, frame, look, { ground: 'clip' }), touch, px) : (an.pose as never);
    rasterBody(look, pose, { facing: 1.1, pitch: 0.5 }, px);
  }
}

/** The engine state after a step, hashed (every field the simulation keeps). */
const stateOf = (o: unknown) => JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));

export async function stepDigestsNba(withDrawing: boolean): Promise<{ digest: string; steps: number }> {
  const sel = await import('./select-nba');
  const { decide, pilot } = await import('../hoops2/autopilot');
  const { afterPossession, newHoopsGame, startPossession } = await import('../hoops2/game');
  const { step } = await import('../hoops2/engine');
  await loadClips(sel.CLIPS);
  // the curated looks in (matchLook draws them), when drawing
  if (withDrawing) await loadAppearance('nba');
  const pool = await getPool();
  const kit = { jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
  const d = new Digest();
  const A = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'ro0').squad));
  const B = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 80, 'roB0').squad));
  const g = newHoopsGame(A.five, B.five, 'ro0', undefined, [], 0);
  const pl = pilot(0.68, 'ro0');
  const memos = new Map<string, NbaMemo>();
  const budget = new SpriteBudget();
  for (let n = 0; n < 12 && !g.over; n++) {
    const p = startPossession(g);
    for (let i = 0; i < 2400 && !p.end; i++) {
      step(p, 1 / 60, decide(p, pl));
      if (withDrawing) {
        budget.begin(1000 / 60);
        for (const b of p.bodies) {
          const who = b.p.id + '|' + b.side;
          if (!memos.has(who)) memos.set(who, { gait: { t: p.t, frac: 0 }, last: null });
          const look = sel.lookFor(b, kit);
          drawPass(look, () => sel.motionOf(b, p.t, p.handler === b.idx, look, memos.get(who)!, null), (drawnHeight('nba', b.p.ht) / 12) * 9, i % 20 === b.idx, budget, who);
        }
        budget.spent(1, 4);
      }
      d.add(stateOf(p));
      p.events.length = 0;
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
    afterPossession(g, p);
    d.add(stateOf(g));
  }
  return { digest: d.hex(), steps: d.n };
}

export async function stepDigestsNfl(withDrawing: boolean): Promise<{ digest: string; steps: number }> {
  const sel = await import('./select-nfl');
  const { snap, step } = await import('../football2/engine');
  const { afterPlay, newGame, startPlay } = await import('../football2/drive');
  const { chooseCall, decide, pilot } = await import('../football2/autopilot');
  const { loadCards } = await import('../../ut/cards');
  const { rateCard } = await import('../../ut/rate');
  const { NFL_SLOTS } = await import('../../ut/squad');
  const { offenseOfSquad, defenseOfSquad } = await import('../../ut/teams');
  await loadClips(sel.CLIPS);
  // the curated looks in (matchLook draws them), when drawing
  if (withDrawing) await loadAppearance('nfl');
  const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
  const sq: Record<string, { line: (typeof cards)[number]['line']; level: number }> = {};
  const used = new Set<string>();
  for (const s of NFL_SLOTS) {
    const c = cards.filter((c) => c.tier === 'gold' && c.line.pos.includes(s.pos!) && !used.has(c.line.name)).sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id))[0];
    sq[s.id] = { line: c.line, level: 1 };
    used.add(c.line.name);
  }
  const kit = { jersey: '#203731', trim: '#ffb612', pants: '#ffb612', helmet: '#203731', stripe: '#ffffff', socks: '#203731', shoes: '#1b1b1f', mask: '#9aa0a6' };
  const g = newGame(offenseOfSquad(sq as never, 'ro'), defenseOfSquad(sq as never, 'ro'), 'ro0');
  const pl = pilot(0.68, 'ro0');
  const d = new Digest();
  const memos = new Map<string, NflMemo>();
  const budget = new SpriteBudget();
  for (let n = 0; n < 10 && !g.over; n++) {
    const p = startPlay(g, chooseCall(g, pl));
    snap(p);
    for (let k = 0; k < 1500 && !p.end; k++) {
      step(p, 1 / 60, decide(p, g, pl));
      if (withDrawing) {
        budget.begin(1000 / 60);
        for (const b of p.bodies) {
          const who = b.p.id + '|' + b.side;
          if (!memos.has(who)) memos.set(who, { gait: { t: p.t, frac: 0 }, face: { x: 0, y: 1 } });
          const look = sel.lookFor(b, kit);
          drawPass(look, () => sel.motionOf(b, p.t, p, look, memos.get(who)!, false), (drawnHeight('nfl', b.p.ht) / 36) * 14, k % 20 === b.id % 20, budget, who);
        }
        budget.spent(1, 4);
      }
      d.add(stateOf(p));
      p.events.length = 0;
    }
    if (!p.end) break;
    afterPlay(g, p.end);
    d.add(stateOf(g));
  }
  return { digest: d.hex(), steps: d.n };
}

export async function stepDigestsSoccer(withDrawing: boolean): Promise<{ digest: string; steps: number }> {
  const sel = await import('./select-soccer');
  const cardsRaw = (await import('../../data/cards-soccer.json')).default;
  const { decide, pilot } = await import('../soccer2/autopilot');
  const { kickOff, setupAttack, step, CLOCK } = await import('../soccer2/engine');
  const { dealOf, ATTACKS } = await import('../soccer2/match');
  const { clubSquad, soccerLines } = await import('../soccer2/ratings');
  await loadClips(sel.CLIPS);
  // the curated looks in (matchLook draws them), when drawing
  if (withDrawing) await loadAppearance('soccer');
  const { seasons } = soccerLines(cardsRaw as never);
  const clubs = [...new Set(seasons.map((l) => l.fr + '|' + l.season))];
  const squads: ReturnType<typeof clubSquad>[] = [];
  for (const k of clubs) {
    if (squads.length >= 2) break;
    const [fr, s] = k.split('|');
    try {
      squads.push(clubSquad(seasons, fr, Number(s)));
    } catch {
      // a club-season without a full eleven
    }
  }
  const kit = { jersey: '#c8102e', trim: '#ffffff', shorts: '#c8102e', socks: '#c8102e', shoes: '#111111' };
  const d = new Digest();
  for (let i = 0; i < 6; i++) {
    const deal = dealOf('ro' + i, ATTACKS);
    const a = setupAttack(deal[i % deal.length], squads[0], squads[1], 'ro' + i, { clock: CLOCK, stoppage: false, defIQ: 0 });
    const pl = pilot(0.68, 'rp' + i);
    kickOff(a);
    const memos = new Map<string, SoccerMemo>();
    const budget = new SpriteBudget();
    for (let n = 0; !a.end && n < 60 * 90; n++) {
      step(a, 1 / 60, decide(a, pl));
      if (withDrawing) {
        budget.begin(1000 / 60);
        for (const b of a.bodies) {
          const who = b.p.id + '|' + b.side;
          if (!memos.has(who)) memos.set(who, { gait: { t: a.t, frac: 0 }, face: { x: b.fx, y: b.fy } });
          const look = sel.lookFor(b, kit, kit);
          drawPass(look, () => sel.motionOf(b, a.t, look, memos.get(who)!, a.ball), ((drawnHeight('soccer', b.p.ht / 2.54) * 2.54) / 100) * 12, n % 20 === b.id % 20, budget, who);
        }
        budget.spent(1, 4);
      }
      d.add(stateOf(a));
    }
  }
  return { digest: d.hex(), steps: d.n };
}
