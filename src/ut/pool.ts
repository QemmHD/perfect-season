import { pickFor } from '../engine/sport';
// The card pool the mode plays with: every card line, rated once at level 1, and grouped by tier
// and position for the packs. Loaded when Ultimate Team opens, never before.
import { hashString } from '../engine/rng';
import { SPORT } from '../engine/sport';
// the per-season card data (src/data/cards-<sport>.json, scripts/build_cards.py)
import { loadCards } from './cards';
import { rateCard } from './rate';
import type { CardLine, OwnedCard, RatedCard, Tier, UtSport } from './types';
import { deriveEditionLine, parseEditionId } from './editions';
import { deriveVariantLine, isVariantId } from './variants';
import { deriveLiveLine, parseLiveId } from './live-cards';
import { loadSchedule, schedule } from './calendar';
import { rareInfo } from './rare';

/**
 * Claude: content version mixed into the pool fingerprint. This build can field Weekly Standout and
 * Landmark Season editions that older builds can't resolve, so its online queue must not pair with
 * them (`queueOf` in Match.tsx uses the fingerprint).
 */
export const CONTENT_PRINT = 'ut-content-4';

/**
 * Card lines by id that also resolve the derived editions (editions.ts) on demand: a Standout from
 * any past week, or a Landmark, loads forever from its season card. Derived lines are cached apart
 * from the map's own entries, so iterating it still sees only the built lines.
 */
class EditionLines extends Map<string, CardLine> {
  private derived = new Map<string, CardLine | null>();
  constructor(
    entries: Iterable<[string, CardLine]>,
    private lines: CardLine[]
  ) {
    super(entries);
  }
  get(id: string): CardLine | undefined {
    const own = super.get(id);
    if (own || (!isVariantId(id) && !parseEditionId(id) && !parseLiveId(id))) return own;
    let d = this.derived.get(id);
    if (d === undefined) {
      d = isVariantId(id) ? deriveVariantLine(id, (k) => this.get(k)) : parseLiveId(id) ? deriveLiveLine(id, (k) => super.get(k)) : deriveEditionLine(id, (k) => super.get(k), this.lines);
      this.derived.set(id, d);
    }
    return d ?? undefined;
  }
  has(id: string): boolean {
    return this.get(id) !== undefined;
  }
}

/** Level-1 ratings that rate a derived edition the first time it is asked for. */
class EditionRatings extends Map<string, RatedCard> {
  private derived = new Map<string, RatedCard | null>();
  constructor(private byId: () => Map<string, CardLine>) {
    super();
  }
  get(id: string): RatedCard | undefined {
    const own = super.get(id);
    if (own || (!isVariantId(id) && !parseEditionId(id) && !parseLiveId(id))) return own;
    let d = this.derived.get(id);
    if (d === undefined) {
      const line = this.byId().get(id);
      d = line ? rateCard(line) : null;
      this.derived.set(id, d);
    }
    return d ?? undefined;
  }
  has(id: string): boolean {
    return this.get(id) !== undefined;
  }
}

export interface Pool {
  sport: UtSport;
  lines: CardLine[];
  byId: Map<string, CardLine>;
  /** every card rated at level 1 */
  base: Map<string, RatedCard>;
  /** tier → main position → cards (a promo or legend is filed under its own tier) */
  buckets: Record<Tier, Record<string, RatedCard[]>>;
  /** a fingerprint of every card and its rating: online squads only pair with the same cards */
  print: string;
}

export function buildPool(sport: UtSport, lines: CardLine[], byId?: Map<string, CardLine>): Pool {
  const b = poolBuilder(sport, lines, byId);
  for (const l of lines) b.add(l);
  return b.done();
}

/** Rates the cards one at a time into a pool. */
function poolBuilder(sport: UtSport, lines: CardLine[], byId?: Map<string, CardLine>) {
  let lookup: Map<string, CardLine> | null = null;
  const base = new EditionRatings(() => lookup!);
  const buckets: Pool['buckets'] = { bronze: {}, silver: {}, gold: {}, promo: {}, spotlight: {}, legend: {}, goat: {}, standout: {}, landmark: {}, program: {} };
  let h = 2166136261;
  return {
    add(l: CardLine) {
      const rc = rateCard(l);
      base.set(l.id, rc);
      (buckets[rc.tier][l.pos[0]] ??= []).push(rc);
      h = Math.imul(h ^ hashString(l.id + ':' + rc.ovr + ':' + rc.tier + ':' + JSON.stringify(rc.attrs) + ':' + rc.abil.join(',')), 16777619) >>> 0;
    },
    done: (): Pool => {
      lookup = new EditionLines(byId ?? lines.map((l) => [l.id, l]), lines);
      return { sport, lines, byId: lookup, base, buckets, print: (Math.imul(h ^ hashString(CONTENT_PRINT + ':' + String(schedule()?.version ?? '')), 16777619) >>> 0).toString(36) };
    },
  };
}

/**
 * The same, a slice at a time with a breath between: rating twenty thousand cards takes a phone a
 * couple of seconds, and the page shouldn't stand still that long.
 */
async function buildPoolInSlices(sport: UtSport, lines: CardLine[], byId?: Map<string, CardLine>): Promise<Pool> {
  const b = poolBuilder(sport, lines, byId);
  let t0 = performance.now();
  for (const l of lines) {
    b.add(l);
    if (performance.now() - t0 > 12) {
      await new Promise((r) => setTimeout(r, 0));
      t0 = performance.now();
    }
  }
  return b.done();
}

let cache: Promise<Pool> | null = null;

/** This page's sport's pool (cached). */
export function getPool(): Promise<Pool> {
  // Claude wave 3: the Live Calendar schedule loads with the cards (program cards resolve from it)
  cache ??= Promise.all([loadCards(SPORT), loadSchedule()])
    .then(([s]) => buildPoolInSlices(SPORT, s.lines, s.byId))
    .then((p) => (rareInfo(p), p));
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
  // soccer's season is the year it ends too ("2014-15")
  return pickFor(line.sport, { nba: line.season - 1 + '-' + String(line.season).slice(2), nfl: String(line.season), soccer: line.season - 1 + '-' + String(line.season).slice(2) });
}

/** "'96" */
export function shortSeason(line: Pick<CardLine, 'season'>): string {
  return '’' + String(line.season).slice(2);
}

export const TIER_RANK: Record<Tier, number> = { bronze: 0, silver: 1, gold: 2, standout: 2.5, program: 3, promo: 3, landmark: 3.5, legend: 4, spotlight: 5, goat: 6 };

/** Best first: tier, then overall. */
export function byValue(a: RatedCard, b: RatedCard): number {
  return TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.ovr - a.ovr;
}
