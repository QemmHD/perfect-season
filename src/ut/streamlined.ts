// Claude, 2026-11-01 (wave 2): Streamlined SBCs, FC 27 style, the main duplicate sink. Submit any
// cards (duplicates welcome; locked favourites and squad players never) toward a points target in
// Item Score (item-score.ts). Progress is saved between submissions and overflow carries over;
// each time the target is reached the reward lands in the Store (`stream:<id>:<n>`, once each).
//
// Targets calibrate themselves from the live card pool: each is 1.8 times the average Item Score
// of the reward itself (60 seeded packs or picks), so a stream can never be farmed in a loop and
// keeps its value when the rating scale changes.
import { contentOf, lockedSet } from './content-state';
import { scoutOptions } from './content-packs';
import { itemScore } from './item-score';
import { openPack } from './packs';
import type { Pool } from './pool';
import { playsIn } from './squad';
import { standoutProgram } from './standouts';
import type { UtState } from './state';
import { removeCards } from './storage';
import type { RatedCard } from './types';

export const STREAM_MARGIN = 1.8;
export const STREAM_SAMPLES = 60;

export interface StreamDef {
  id: string;
  title: string;
  blurb: string;
  /** the pending pack kind it pays (scout / standout-pick open as pick sheets) */
  pack: string;
}

export const STREAMS: StreamDef[] = [
  { id: 'gold', title: 'Gold Stream', blurb: 'Any cards toward a Gold Pack.', pack: 'gold' },
  { id: 'premium', title: 'Premium Stream', blurb: 'Any cards toward a Premium Gold pack.', pack: 'premium' },
  { id: 'scout', title: 'Scout Stream', blurb: 'Any cards toward a Scout’s Choice pick.', pack: 'scout' },
  { id: 'elite', title: 'Elite Stream', blurb: 'Any cards toward an Elite Gold pack.', pack: 'elite' },
  { id: 'standout', title: 'Standout Stream', blurb: 'Any cards toward a Weekly Standout pick.', pack: 'standout-pick' },
];

const targets = new WeakMap<Pool, Map<string, number>>();

/** What the stream's reward is worth on average, in Item Score (deterministic for the pool and week). */
function rewardScore(pool: Pool, def: StreamDef, week: string): number {
  let sum = 0;
  for (let i = 0; i < STREAM_SAMPLES; i++) {
    const seed = 'stream-target:' + def.id + ':' + i;
    if (def.pack === 'scout') sum += Math.max(...scoutOptions(pool, seed, week).options.map(itemScore));
    else if (def.pack === 'standout-pick') sum += Math.max(...standoutProgram(pool, week).cards.slice(1 + (i % 3), 4 + (i % 3)).map(itemScore));
    else sum += openPack(pool, def.pack, seed, week).reduce((a, rc) => a + itemScore(rc), 0);
  }
  return sum / STREAM_SAMPLES;
}

/** The stream's points target (rounded to 50). Fixed per pool; the Standout one per week. */
export function streamTarget(pool: Pool, id: string, week = '2026-W44'): number {
  let m = targets.get(pool);
  if (!m) targets.set(pool, (m = new Map()));
  const def = STREAMS.find((s) => s.id === id);
  if (!def) return Infinity;
  // a fixed reference week keeps targets stable all season (the Standout stream's too)
  const k = id;
  let t = m.get(k);
  if (t === undefined) {
    t = Math.max(100, Math.round((STREAM_MARGIN * rewardScore(pool, def, week)) / 50) * 50);
    m.set(k, t);
  }
  return t;
}

export function streamProgress(ut: UtState, id: string): number {
  return contentOf(ut).streams?.[id] ?? 0;
}

/** Cards a stream can take: not locked, not playing in the squad (bench extras and storage welcome). */
export function streamCandidates<C extends { uid: string; rc: RatedCard; slot: string | null }>(ut: UtState, sport: RatedCard['line']['sport'], cards: C[]): C[] {
  const locked = lockedSet(ut);
  return cards.filter((c) => !locked.has(c.uid) && !playsIn(sport, c.slot)).sort((a, b) => itemScore(a.rc) - itemScore(b.rc));
}

/**
 * Submit exactly these copies to a stream: they retire (SBC), their Item Score adds to the saved
 * progress, and every full target deposits the reward (ids `stream:<sport>:<id>:<n>`, overflow kept).
 * Returns null when any copy is missing, locked, playing in the squad, or listed twice.
 */
export function submitStream(ut: UtState, pool: Pool, id: string, uids: string[], score: (uid: string) => number | null, at: number): { ut: UtState; points: number; rewards: number } | null {
  const def = STREAMS.find((s) => s.id === id);
  if (!def || !uids.length || new Set(uids).size !== uids.length) return null;
  const locked = lockedSet(ut);
  const inSquad = new Map(Object.entries(ut.squad).map(([slot, uid]) => [uid, slot]));
  let points = 0;
  for (const uid of uids) {
    const s = score(uid);
    if (s === null || locked.has(uid) || !ut.owned.some((o) => o.uid === uid) || playsIn(pool.sport, inSquad.get(uid) ?? null)) return null;
    points += s;
  }
  const target = streamTarget(pool, id);
  const c = contentOf(ut);
  let progress = (c.streams?.[id] ?? 0) + points;
  let n = c.streams?.[id + ':n'] ?? 0;
  const packs = [];
  while (progress >= target) {
    progress -= target;
    n++;
    packs.push({ id: 'stream:' + pool.sport + ':' + id + ':' + n, kind: def.pack, at: at + n });
  }
  const after = removeCards(ut, uids, 'sbc');
  return {
    ut: { ...after, content: { ...contentOf(after), streams: { ...(c.streams ?? {}), [id]: progress, [id + ':n']: n } }, packs: [...after.packs, ...packs.filter((p) => !after.packs.some((x) => x.id === p.id))] },
    points,
    rewards: packs.length,
  };
}
