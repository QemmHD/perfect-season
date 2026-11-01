// Claude, 2026-11-01: the two derived promo editions, Weekly Standouts and Landmark Seasons.
//
// IDs (stable forever; never rename):
//   Standout  `<sport>:standout:<week>:<season>:<pid>:<fr>`  week = "2026-W44", or "2026-W44F" for
//             that week's featured card (the F keeps its +5 boost resolvable without the program)
//   Landmark  `<sport>:landmark:<season>:<pid>:<fr>`
// Both are derived from their season card `<sport>:season:<season>:<pid>:<fr>` alone, so an owned
// copy resolves in any later week (pool.ts resolves them lazily; they are not in pack buckets or the
// pool fingerprint's line list).
//
// Rating: the season card at the same level and position, then
//   Standout  OVR +3 (featured +5), capped 97; its three best face attributes get the full boost,
//             the other face attributes +1 (physicals at most +1), FT never changes.
//   Landmark  OVR +5, capped 99; the landmark's own skills +6, the other face attributes +1, every
//             other attribute unchanged, so a specialist keeps his weaknesses.
import { landmarkCatalog, landmarkFallback, LANDMARK_ATTRS, type Landmark, type LandmarkType } from './landmarks';
import { rateCard } from './rate';
import { fcToDisplay } from './fc-scale';
import { fromDisplay } from './ut-scale';
import type { CardLine, RatedCard, UtSport } from './types';

export const STANDOUT_BOOST = 3;
export const STANDOUT_FEATURED_BOOST = 5;
/** Caps on the FC-style display scale (fc-scale.ts): Standouts land ~80–92, Landmarks 85–93. */
export const STANDOUT_CAP = 92;
export const STANDOUT_FEATURED_CAP = 93;
export const LANDMARK_BOOST = 4;
export const LANDMARK_ATTR_BOOST = 6;
export const LANDMARK_FLOOR = 85;
export const LANDMARK_CAP = 93;

const PHYSICAL = new Set(['SPD', 'ACC', 'STR', 'VRT', 'STA', 'AGI']);
const WEEK = /^\d{4}-W\d{2}$/;

export function standoutId(week: string, featured: boolean, season: Pick<CardLine, 'sport' | 'season' | 'pid' | 'fr'>): string {
  return season.sport + ':standout:' + week + (featured ? 'F' : '') + ':' + season.season + ':' + season.pid + ':' + season.fr;
}

export function landmarkId(season: Pick<CardLine, 'sport' | 'season' | 'pid' | 'fr'>): string {
  return season.sport + ':landmark:' + season.season + ':' + season.pid + ':' + season.fr;
}

export interface EditionRef {
  sport: UtSport;
  kind: 'standout' | 'landmark';
  seasonId: string;
  week?: string;
  featured?: boolean;
}

/** An edition id's parts, or null when it isn't a Standout or Landmark id. */
export function parseEditionId(id: string): EditionRef | null {
  const p = id.split(':');
  // soccer (Claude 2026-11-01): Weekly Standouts only (it has no landmark catalogue)
  if (p[0] !== 'nba' && p[0] !== 'nfl' && p[0] !== 'soccer') return null;
  const sport = p[0] as UtSport;
  if (sport === 'soccer' && p[1] === 'landmark') return null;
  if (p[1] === 'standout' && p.length === 6) {
    const featured = p[2].endsWith('F');
    const week = featured ? p[2].slice(0, -1) : p[2];
    if (!WEEK.test(week) || !/^\d{4}$/.test(p[3])) return null;
    return { sport, kind: 'standout', week, featured, seasonId: sport + ':season:' + p[3] + ':' + p[4] + ':' + p[5] };
  }
  if (p[1] === 'landmark' && p.length === 5 && /^\d{4}$/.test(p[2])) return { sport, kind: 'landmark', seasonId: sport + ':season:' + p[2] + ':' + p[3] + ':' + p[4] };
  return null;
}

/** "WK 44" */
export function weekLabel(week: string): string {
  return 'WK ' + week.slice(-2);
}

/**
 * The edition's card line, from its season card. `lines` (the pool's) finds the landmark in the
 * catalog; a season that no longer qualifies still resolves, with its best line printed.
 */
export function deriveEditionLine(id: string, seasonOf: (id: string) => CardLine | undefined, lines?: CardLine[]): CardLine | null {
  const ref = parseEditionId(id);
  if (!ref) return null;
  const base = seasonOf(ref.seasonId);
  if (!base || base.kind !== 'season' || base.sport !== ref.sport) return null;
  if (ref.kind === 'standout')
    return {
      ...base,
      id,
      kind: 'standout',
      boost: ref.featured ? STANDOUT_FEATURED_BOOST : STANDOUT_BOOST,
      label: ref.featured ? 'FEATURED STANDOUT' : 'WEEKLY STANDOUT',
      seasonId: base.id,
      week: ref.week,
      featured: ref.featured,
    };
  const lm: Landmark = (lines && landmarkCatalog(lines).get(base.id)) || landmarkFallback(base);
  return { ...base, id, kind: 'landmark', boost: LANDMARK_BOOST, label: 'LANDMARK SEASON', seasonId: base.id, landmark: lm.text, landmarkType: lm.type };
}

/** The three highest face attributes (ties: the card's own order), never FT. */
function bestFace(rc: RatedCard): string[] {
  return rc.key
    .filter(([c]) => c !== 'FT')
    .map(([c, , v], i) => ({ c, v, i }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.c);
}

/** A Standout or Landmark edition, rated (rate.ts routes these kinds here). */
export function rateEdition(line: CardLine, level = 1, pos?: string): RatedCard {
  const seasonLine: CardLine = { ...line, id: line.seasonId ?? line.id, kind: 'season', boost: undefined, label: undefined };
  const base = rateCard(seasonLine, level, pos);
  const standout = line.kind === 'standout';
  const delta = standout ? (line.featured ? STANDOUT_FEATURED_BOOST : STANDOUT_BOOST) : LANDMARK_BOOST;
  const cap = standout ? STANDOUT_CAP : LANDMARK_CAP;
  const face = new Set(base.key.map(([c]) => c));
  const targets = new Set(standout ? bestFace(base) : (LANDMARK_ATTRS[(line.landmarkType as LandmarkType) ?? 'scorer'] ?? []));
  const attrDelta = standout ? delta : LANDMARK_ATTR_BOOST;
  const attrs: Record<string, number> = { ...base.attrs };
  for (const code of Object.keys(attrs)) {
    if (code === 'FT') continue;
    let d = 0;
    if (targets.has(code)) d = PHYSICAL.has(code) ? 1 : attrDelta;
    else if (face.has(code)) d = 1;
    if (d) attrs[code] = Math.max(1, Math.min(99, Math.round(attrs[code] + d)));
  }
  const sport = line.sport;
  const ovr = standout
    ? Math.max(base.ovr, Math.min(fcToDisplay(line.featured ? STANDOUT_FEATURED_CAP : cap, sport), base.ovr + delta))
    : Math.max(fcToDisplay(LANDMARK_FLOOR, sport), Math.min(fcToDisplay(cap, sport), base.ovr + delta));
  return liftShown({ ...base, line, ovr, tier: standout ? 'standout' : 'landmark', attrs, key: base.key.map(([c, n]) => [c, n, attrs[c] ?? ovr]) }, base);
}

/**
 * An edition's printed face and rating-scale overall follow its new displayed overall: the face
 * (basketball's six categories, football's key attributes; card-face.ts) rises by the same amount,
 * and `rawOvr` (numbering, comparisons) is the displayed overall read back on the rating scale.
 */
export function liftShown(rc: RatedCard, base: RatedCard): RatedCard {
  const d = rc.ovr - base.ovr;
  if (!d) return rc;
  const sport = rc.line.sport;
  return {
    ...rc,
    ...(base.face ? { face: base.face.map(([c, n, v]) => [c, n, Math.max(1, Math.min(99, v + d))] as [string, string, number]) } : {}),
    ...(base.rawOvr !== undefined ? { rawOvr: Math.max(base.rawOvr, Math.min(99, Math.round(fromDisplay(sport, rc.ovr)))) } : {}),
  };
}
