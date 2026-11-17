// Claude, 2026-11-01 (wave 2): the Evolutions lab, FC-style. It extends Codex's Development lab
// (club-management.ts, XP programs) with stat upgrades:
//  - each evolution has eligibility caps (max overall, tiers, sometimes positions or era)
//  - objectives played with that card (games, wins)
//  - an upgrade (overall + attributes) with a ceiling below the top promos
//  - chains: Rising Star II needs Rising Star I, and the lab shows the end of the chain first
// Upgrades are stored additively on the owned copy: `ut.content.evo[uid].done`. The copy's card id
// never changes; it plays and shows as the derived id `evo~<ids>~<card id>` (variants.ts), so both
// phones rate it the same online.
import { contentOf } from './content-state';
import type { Pool } from './pool';
import { fcToDisplay } from './fc-scale';
import type { UtState } from './state';
import type { RatedCard, Tier, UtSport } from './types';

export interface EvoUpgrade {
  /** overall added (never past `cap` on the sport's scale) */
  ovr: number;
  /** which attributes and how much: face (all six shown), best3, best2 */
  attrs: { which: 'face' | 'best3' | 'best2'; n: number }[];
}
export interface EvoDef {
  id: string;
  title: string;
  blurb: string;
  /** eligibility: overall at most this (FC-style display scale, fc-scale.ts) */
  maxOvr: number;
  tiers: Tier[];
  /** only seasons before this year (Veteran) */
  before?: number;
  /** this evolution must be done first */
  needs?: string;
  games: number;
  wins: number;
  upgrade: EvoUpgrade;
  /** ceiling after the upgrade (reference scale): below the top promos */
  cap: number;
}

export const EVOS: EvoDef[] = [
  { id: 'rising-1', title: 'Rising Star I', blurb: 'Give a young gold minutes.', maxOvr: 80, tiers: ['silver', 'gold'], games: 3, wins: 1, upgrade: { ovr: 2, attrs: [{ which: 'face', n: 2 }] }, cap: 84 },
  { id: 'rising-2', title: 'Rising Star II', blurb: 'Make him a starter.', maxOvr: 84, tiers: ['silver', 'gold'], needs: 'rising-1', games: 4, wins: 2, upgrade: { ovr: 2, attrs: [{ which: 'best3', n: 3 }] }, cap: 87 },
  { id: 'specialist', title: 'Specialist', blurb: 'Sharpen what he does best.', maxOvr: 85, tiers: ['gold', 'standout'], games: 3, wins: 2, upgrade: { ovr: 1, attrs: [{ which: 'best2', n: 4 }] }, cap: 88 },
  { id: 'veteran', title: 'Veteran Leader', blurb: 'An old pro, one more run. Seasons before 2000.', maxOvr: 86, tiers: ['gold'], before: 2000, games: 5, wins: 3, upgrade: { ovr: 3, attrs: [{ which: 'face', n: 2 }] }, cap: 89 },
];
export const MAX_ACTIVE_EVOS = 3;

export const evoById = (id: string) => EVOS.find((e) => e.id === id);

export interface EvoCopy {
  done: string[];
  active?: { id: string; games: number; wins: number; at: number };
}

export function evoOf(ut: UtState, uid: string): EvoCopy {
  return contentOf(ut).evo?.[uid] ?? { done: [] };
}

/** The id the copy plays and shows as: its card id, or the evolved variant. */
export function playId(ut: UtState, oc: { uid: string; cardId: string }): string {
  const done = contentOf(ut).evo?.[oc.uid]?.done ?? [];
  return done.length ? 'evo~' + done.join('+') + '~' + oc.cardId : oc.cardId;
}

/** Why a card can't start an evolution, or null when it can. `rc` is the copy as it plays now. */
export function evoBlock(ut: UtState, uid: string, rc: RatedCard, def: EvoDef, sport: UtSport): string | null {
  const e = evoOf(ut, uid);
  if (e.done.includes(def.id)) return 'Already completed';
  if (e.active) return 'Already evolving';
  if (def.needs && !e.done.includes(def.needs)) return 'Needs ' + (evoById(def.needs)?.title ?? def.needs);
  const tier = rc.line.variantOf ? baseTier(rc) : rc.tier;
  if (!def.tiers.includes(tier)) return 'Wrong card type';
  if (rc.ovr > fcToDisplay(def.maxOvr, sport)) return 'Overall above ' + fcToDisplay(def.maxOvr, sport);
  if (def.before && rc.line.season >= def.before) return 'Seasons before ' + def.before;
  if (Object.values(contentOf(ut).evo ?? {}).filter((x) => x.active).length >= MAX_ACTIVE_EVOS) return MAX_ACTIVE_EVOS + ' evolutions already running';
  return null;
}
const baseTier = (rc: RatedCard): Tier => rc.tier;

export function startEvo(ut: UtState, pool: Pool, uid: string, rc: RatedCard, evoId: string, at: number): UtState {
  const def = evoById(evoId);
  if (!def || !ut.owned.some((o) => o.uid === uid) || evoBlock(ut, uid, rc, def, pool.sport)) return ut;
  const c = contentOf(ut);
  const cur = evoOf(ut, uid);
  return { ...ut, content: { ...c, evo: { ...(c.evo ?? {}), [uid]: { ...cur, active: { id: evoId, games: 0, wins: 0, at } } } } };
}

export function cancelEvo(ut: UtState, uid: string): UtState {
  const c = contentOf(ut);
  const cur = c.evo?.[uid];
  if (!cur?.active) return ut;
  return { ...ut, content: { ...c, evo: { ...c.evo, [uid]: { done: cur.done } } } };
}

/** After a match: every evolving card that played moves on (each match id counts once). */
export function recordEvoMatch(ut: UtState, r: { matchId: string; won: boolean; played: string[] }): UtState {
  const c = contentOf(ut);
  if (!c.evo || c.evoSeen?.includes(r.matchId)) return ut;
  const played = new Set(r.played);
  let changed = false;
  const evo: Record<string, EvoCopy> = {};
  for (const [uid, e] of Object.entries(c.evo)) {
    const def = e.active && evoById(e.active.id);
    if (e.active && def && played.has(uid) && (e.active.games < def.games || e.active.wins < def.wins)) {
      evo[uid] = { ...e, active: { ...e.active, games: e.active.games + 1, wins: e.active.wins + (r.won ? 1 : 0) } };
      changed = true;
    } else evo[uid] = e;
  }
  if (!changed) return ut;
  return { ...ut, content: { ...c, evo, evoSeen: [...(c.evoSeen ?? []), r.matchId].slice(-60) } };
}

export function evoReady(e: EvoCopy | undefined): boolean {
  const def = e?.active && evoById(e.active.id);
  return !!def && e!.active!.games >= def.games && e!.active!.wins >= def.wins;
}

/** Apply a finished evolution to the copy (once: it moves from active to done). */
export function claimEvo(ut: UtState, uid: string): UtState {
  const c = contentOf(ut);
  const e = c.evo?.[uid];
  if (!e || !evoReady(e) || !ut.owned.some((o) => o.uid === uid)) return ut;
  return { ...ut, content: { ...c, evo: { ...c.evo, [uid]: { done: [...e.done, e.active!.id] } } } };
}

/** Evolutions waiting to be applied (the rewards inbox). */
export function readyEvos(ut: UtState): string[] {
  return Object.entries(contentOf(ut).evo ?? {})
    .filter(([uid, e]) => evoReady(e) && ut.owned.some((o) => o.uid === uid))
    .map(([uid]) => uid);
}

/**
 * The upgrades of a chain applied to a rated card: overall up to each step's ceiling (never below
 * where it started), attributes up to 99. Pure: the variant rater and the chain preview share it.
 */
export function applyEvos(rc: RatedCard, ids: string[]): RatedCard {
  let ovr = rc.ovr;
  const attrs = { ...rc.attrs };
  const face = rc.key.map(([c]) => c).filter((c) => c !== 'FT');
  for (const id of ids) {
    const def = evoById(id);
    if (!def) continue;
    const ceiling = fcToDisplay(def.cap, rc.line.sport);
    ovr = Math.max(ovr, Math.min(ceiling, ovr + def.upgrade.ovr));
    for (const a of def.upgrade.attrs) {
      const ranked = face.slice().sort((x, y) => (attrs[y] ?? 0) - (attrs[x] ?? 0));
      const list = a.which === 'face' ? face : ranked.slice(0, a.which === 'best3' ? 3 : 2);
      for (const code of list) if (typeof attrs[code] === 'number') attrs[code] = Math.max(attrs[code], Math.min(99, attrs[code] + a.n));
    }
  }
  return { ...rc, ovr, attrs, key: rc.key.map(([c, n]) => [c, n, attrs[c] ?? ovr]) };
}
