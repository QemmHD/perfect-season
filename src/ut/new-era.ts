// Claude, 2026-11-01: the one-time "New Era" thank-you bundle for players who were here before the
// ratings rework: an Icon (Legend) pick (three Legends at 88+ on the FC-style scale, keep one) and
// 65,000 coins. Nothing is reset: every card, coin and level stays.
//
// Eligibility is an additive marker, never a date: `ut.content.era.eligible` is stamped the first
// time this build loads a sport's saved profile (profile.ts loadFrom), true when that save already
// had Ultimate Team cards, packs or games, or any game played/XP. New profiles are created with
// `eligible: false`. A restored cloud save from before the update has no marker, so it qualifies once.
// Exactly once: the Legend pick under `new-era-2026` in this sport's `ut.content.claims`; the coins
// under `new-era-2026` in the profile's shared `gifts` list (one wallet, so once across both sports).
import { hashString, rng, shuffle } from '../engine/rng';
import { claimed, contentOf, withClaim, withContent } from './content-state';
import { addPick } from './content-packs';
import type { Pool } from './pool';
import { fcToDisplay } from './fc-scale';
import type { UtState } from './state';

export const NEW_ERA_ID = 'new-era-2026';
export const NEW_ERA_COINS = 65000;

/** What profile.ts passes in: the save as it was loaded. */
export interface SavedActivity {
  xp?: number;
  stats?: { games?: number };
  history?: unknown[];
}

/** Stamp the marker once: was this save already in use before this build? */
export function stampNewEra(ut: UtState, saved: SavedActivity | null | undefined): UtState {
  if (contentOf(ut).era) return ut;
  const r = ut.record;
  const active =
    ut.owned.length > 0 ||
    ut.packsOpened > 0 ||
    r.w + r.l + r.h2hW + r.h2hL > 0 ||
    (saved?.stats?.games ?? 0) > 0 ||
    (saved?.xp ?? 0) > 0 ||
    (Array.isArray(saved?.history) && saved!.history!.length > 0);
  return withContent(ut, (c) => ({ ...c, era: { eligible: active } }));
}

/** A brand-new player's UT state: never eligible. */
export function markNewPlayer(ut: UtState): UtState {
  return withContent(ut, (c) => ({ ...c, era: { eligible: false } }));
}

export function newEraReady(ut: UtState): boolean {
  return !!contentOf(ut).era?.eligible && !claimed(ut, NEW_ERA_ID);
}

/** Three different Legends at 88+ on the FC-style display scale (deterministic). */
export function legendOptions(pool: Pool, seed: string): string[] {
  const floor = fcToDisplay(88, pool.sport);
  const all = Object.values(pool.buckets.legend)
    .flat()
    .sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const good = all.filter((rc) => rc.ovr >= floor);
  const list = shuffle(good.length >= 3 ? good : all, rng(hashString('new-era:' + seed)));
  const out: string[] = [];
  const pids = new Set<string>();
  for (const rc of list) {
    if (pids.has(rc.line.pid)) continue;
    pids.add(rc.line.pid);
    out.push(rc.line.id);
    if (out.length === 3) break;
  }
  return out;
}

/** The pick sheet's id in this sport. */
export const newEraPickId = (sport: string) => NEW_ERA_ID + ':' + sport;

/**
 * Claim the bundle once: the Legend pick opens (this sport) and the coins are paid unless the shared
 * gift list already has them (the other sport claimed first). Unchanged when not eligible or claimed.
 */
export function claimNewEra<P extends { coins: number; gifts?: string[]; ut: UtState }>(p: P, pool: Pool, at: number): P {
  if (!newEraReady(p.ut)) return p;
  const options = legendOptions(pool, newEraPickId(pool.sport));
  if (options.length < 1) return p;
  const ut = addPick(withClaim(p.ut, NEW_ERA_ID), { id: newEraPickId(pool.sport), kind: 'new-era', title: 'New Era · Icon Pick', options, at });
  const paid = (p.gifts ?? []).includes(NEW_ERA_ID);
  return { ...p, ut, ...(paid ? {} : { coins: p.coins + NEW_ERA_COINS, gifts: [...(p.gifts ?? []), NEW_ERA_ID] }) };
}
