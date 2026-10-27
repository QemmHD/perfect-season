// The card pool the mode plays with: every card line, rated once at level 1, and grouped by tier
// and position for the packs. Loaded when Ultimate Team opens, never before.
import { SPORT } from '../engine/sport';
// The real per-season card data replaces the stand-in here: `from './cards'` (same signature).
import { loadCards } from './devcards';
import { rateCard } from './rate';
import type { CardLine, OwnedCard, RatedCard, Tier, UtSport } from './types';

export interface Pool {
  sport: UtSport;
  lines: CardLine[];
  byId: Map<string, CardLine>;
  /** every card rated at level 1 */
  base: Map<string, RatedCard>;
  /** tier → main position → cards (a promo or legend is filed under its own tier) */
  buckets: Record<Tier, Record<string, RatedCard[]>>;
}

export function buildPool(sport: UtSport, lines: CardLine[], byId?: Map<string, CardLine>): Pool {
  const base = new Map<string, RatedCard>();
  const buckets: Pool['buckets'] = { bronze: {}, silver: {}, gold: {}, promo: {}, legend: {} };
  for (const l of lines) {
    const rc = rateCard(l);
    base.set(l.id, rc);
    (buckets[rc.tier][l.pos[0]] ??= []).push(rc);
  }
  return { sport, lines, byId: byId ?? new Map(lines.map((l) => [l.id, l])), base, buckets };
}

let cache: Promise<Pool> | null = null;

/** This page's sport's pool (cached). */
export function getPool(): Promise<Pool> {
  cache ??= loadCards(SPORT).then((s) => buildPool(SPORT, s.lines, s.byId));
  // a failed load can be tried again
  cache.catch(() => (cache = null));
  return cache;
}

const ratedCache = new Map<string, RatedCard>();

/** An owned card rated at its level (null when its card id isn't in the pool any more). */
export function ratedOf(pool: Pool, c: Pick<OwnedCard, 'cardId' | 'level'>): RatedCard | null {
  if (c.level <= 1) return pool.base.get(c.cardId) ?? null;
  const k = c.cardId + '@' + c.level;
  let rc = ratedCache.get(k);
  if (!rc) {
    const line = pool.byId.get(c.cardId);
    if (!line) return null;
    rc = rateCard(line, c.level);
    ratedCache.set(k, rc);
  }
  return rc;
}

/** Decade label of a season: 1996 → "1990s". */
export function decadeOf(season: number): string {
  return Math.floor(season / 10) * 10 + 's';
}

/** "1995-96" for basketball (the season it ends), "1985" for football. */
export function seasonText(line: Pick<CardLine, 'sport' | 'season'>): string {
  return line.sport === 'nba' ? line.season - 1 + '-' + String(line.season).slice(2) : String(line.season);
}

/** "'96" */
export function shortSeason(line: Pick<CardLine, 'season'>): string {
  return '’' + String(line.season).slice(2);
}

export const TIER_RANK: Record<Tier, number> = { bronze: 0, silver: 1, gold: 2, promo: 3, legend: 4 };

/** Best first: tier, then overall. */
export function byValue(a: RatedCard, b: RatedCard): number {
  return TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.ovr - a.ovr;
}
