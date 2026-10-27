// Ultimate Team: what the profile keeps, per sport (the basketball and football profiles each have
// their own `ut`). Small and free of card data on purpose: the profile loads it on every launch,
// while the cards themselves load only when the mode opens. See docs/ULTIMATE-TEAM.md.
import type { OwnedCard } from './types';

/** A pack waiting to be opened (a challenge reward, the starter). */
export interface PendingPack {
  /** unique, and the seed its contents come from */
  id: string;
  kind: string;
  at: number;
}

export interface UtState {
  v: 1;
  owned: OwnedCard[];
  /** the squad: slot id (PG, B1, QB, WR2, ...) to an owned card's uid */
  squad: Record<string, string>;
  packsOpened: number;
  /** the free starter pack (once per sport) has been opened */
  starterClaimed: boolean;
  /** squad building challenges: challenge id to when it was done (ms) */
  sbc: { done: Record<string, number> };
  /** packs earned and not opened yet */
  packs: PendingPack[];
  /** what was quick-sold, for the hub */
  sold: { cards: number; coins: number };
  /** Squad Battles: rungs cleared this week (`week` is its key), the best week, and games played */
  battles: { week: string; cleared: number; best: number };
  /** results of played matches: vs the AI and online head to head */
  record: { w: number; l: number; h2hW: number; h2hL: number };
  /** games that paid coins and XP today (`day`, Eastern): a day's paid games are limited (play.ts) */
  paid: { day: string; n: number };
}

export function freshUt(): UtState {
  return { v: 1, owned: [], squad: {}, packsOpened: 0, starterClaimed: false, sbc: { done: {} }, packs: [], sold: { cards: 0, coins: 0 }, battles: { week: '', cleared: 0, best: 0 }, record: { w: 0, l: 0, h2hW: 0, h2hL: 0 }, paid: { day: '', n: 0 } };
}

const num = (x: unknown, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/**
 * Any saved `ut` (none at all in profiles from before the mode, or one from an older build) as a
 * valid current state: unknown fields go, bad entries are dropped, and the squad only points at
 * cards that are still owned.
 */
export function migrateUt(raw: unknown): UtState {
  const base = freshUt();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Record<keyof UtState, unknown>>;
  const owned: OwnedCard[] = [];
  const seen = new Set<string>();
  if (Array.isArray(r.owned))
    for (const c of r.owned as Partial<OwnedCard>[]) {
      if (!c || typeof c.uid !== 'string' || typeof c.cardId !== 'string' || seen.has(c.uid)) continue;
      seen.add(c.uid);
      owned.push({ uid: c.uid, cardId: c.cardId, level: Math.max(1, Math.min(5, Math.round(num(c.level, 1)))), xp: Math.max(0, num(c.xp, 0)), at: num(c.at, 0) });
    }
  const squad: Record<string, string> = {};
  if (r.squad && typeof r.squad === 'object')
    for (const [slot, uid] of Object.entries(r.squad as Record<string, unknown>)) if (typeof uid === 'string' && seen.has(uid) && !Object.values(squad).includes(uid)) squad[slot] = uid;
  const done: Record<string, number> = {};
  const sbc = r.sbc as { done?: unknown } | undefined;
  if (sbc && sbc.done && typeof sbc.done === 'object') for (const [k, v] of Object.entries(sbc.done as Record<string, unknown>)) if (typeof v === 'number') done[k] = v;
  const packs: PendingPack[] = Array.isArray(r.packs) ? (r.packs as PendingPack[]).filter((p) => p && typeof p.id === 'string' && typeof p.kind === 'string').map((p) => ({ id: p.id, kind: p.kind, at: num(p.at, 0) })) : [];
  const sold = r.sold as { cards?: unknown; coins?: unknown } | undefined;
  const bt = r.battles as { week?: unknown; cleared?: unknown; best?: unknown } | undefined;
  const rec = r.record as Partial<Record<'w' | 'l' | 'h2hW' | 'h2hL', unknown>> | undefined;
  const paid = r.paid as { day?: unknown; n?: unknown } | undefined;
  const count = (x: unknown) => Math.max(0, Math.round(num(x, 0)));
  return {
    v: 1,
    owned,
    squad,
    packsOpened: Math.max(0, Math.round(num(r.packsOpened, 0))),
    starterClaimed: r.starterClaimed === true,
    sbc: { done },
    packs,
    sold: { cards: num(sold?.cards, 0), coins: num(sold?.coins, 0) },
    battles: { week: typeof bt?.week === 'string' ? bt.week : '', cleared: Math.min(8, count(bt?.cleared)), best: Math.min(8, count(bt?.best)) },
    record: { w: count(rec?.w), l: count(rec?.l), h2hW: count(rec?.h2hW), h2hL: count(rec?.h2hL) },
    paid: { day: typeof paid?.day === 'string' ? paid.day : '', n: count(paid?.n) },
  };
}

// ---------- upgrades ----------

export const MAX_LEVEL = 5;
/** XP from one level to the next: 1→2 100, 2→3 150, 3→4 200, 4→5 250 (700 in all, ~15-20 games). */
export function xpToNext(level: number): number {
  return level >= MAX_LEVEL ? 0 : 50 + 50 * level;
}

/**
 * Cards that played earn XP (the match code calls this through `awardXp` with the squad's uids).
 * `xp` is the progress into the current level; a card levels up as many times as it fills.
 */
export function awardXp(ut: UtState, uids: string[], n: number): { ut: UtState; ups: { uid: string; level: number }[] } {
  const want = new Set(uids);
  const ups: { uid: string; level: number }[] = [];
  const owned = ut.owned.map((c) => {
    if (!want.has(c.uid) || c.level >= MAX_LEVEL || n <= 0) return c;
    let level = c.level;
    let xp = c.xp + n;
    while (level < MAX_LEVEL && xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level++;
    }
    if (level >= MAX_LEVEL) xp = 0;
    if (level > c.level) ups.push({ uid: c.uid, level });
    return { ...c, level, xp };
  });
  return { ut: { ...ut, owned }, ups };
}
