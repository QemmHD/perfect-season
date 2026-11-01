import { nflIdentity } from './nfl-identity';
import { calibrateNflReference, RATING_CONTEXT } from './season-reference';
import { careerOf } from './cards';
import { editionAttributes, profileQuality, supportEdition } from './rating-quality';
import { TIER_CUTS, editionDisplay, fromDisplay, toDisplay } from './ut-scale';
import { shownFaceMean, faceOf, levelAttrBonus, levelOvrBonus, nflFaceKeys, supportOverall } from './card-face';
// Ultimate Team ratings: a card line becomes a rated card with the same code the played games use,
// so a card shows exactly what it plays like. Basketball goes through hoops2's `hooper()` (fed the
// season's own ranks), football through football2's `rateNflLine()`. On top of the base rating:
// standard promo/legend boosts and levels affect the six key attributes. Codex Spotlight/GOAT
// editions improve the full profile, retain signature weaknesses, and support 100–110 gameplay. See docs/ULTIMATE-TEAM.md.
import { calibrateNba, nbaRosterScale } from './calibration';
import type { Attrs } from '../game/attrs';
import { groupOf, NFL_KEYS, rateNflLine, nflAbilities } from '../game/football2/ratings';
export { faceWeights } from './card-face';
import { BADGE_NAMES, badges, hooper, type NbaLine } from '../game/hoops2/ratings';
import type { Hooper } from '../game/hoops2/types';
import { MAX_LEVEL } from './state';
import type { CardLine, RatedCard, Tier, UtSport } from './types';

/** Tier cuts live with the displayed UT scale (ut-scale.ts): currently NBA Bronze <75, Silver 75–84,
 * Gold 85+; NFL Bronze <84, Silver 84–88, Gold 89+. Old challenge thresholds pass through onScale(),
 * preserving their relative difficulty on whatever scale is displayed. */
export { TIER_CUTS, UT_SCALE } from './ut-scale';

export function tierOf(ovr: number, sport: UtSport = 'nba'): Tier {
  const c = TIER_CUTS[sport];
  return ovr >= c.gold ? 'gold' : ovr >= c.silver ? 'silver' : 'bronze';
}

/** basketball's overall → football's, at the same standing (from the two pools' distributions) */
const SCALE: [number, number][] = [
  [40, 62],
  [56, 75],
  [65, 84],
  [75, 89],
  [99, 99],
];

/**
 * A number written on basketball's 0-99 scale (a challenge's "team overall 72", a star's 85) at the
 * same standing in this sport.
 */
export function onScale(x: number, sport: UtSport): number {
  return Math.round(toDisplay(sport, ratingStanding(x, sport)));
}

/** The same standing on the rating scale (before the displayed UT curve, ut-scale.ts). */
export function ratingStanding(x: number, sport: UtSport): number {
  if (sport === 'nba') return nbaRosterScale(x);
  for (let i = 1; i < SCALE.length; i++) {
    const [a0, b0] = SCALE[i - 1];
    const [a1, b1] = SCALE[i];
    if (x <= a1 || i === SCALE.length - 1) return Math.round(b0 + ((Math.max(a0, Math.min(a1, x)) - a0) * (b1 - b0)) / (a1 - a0));
  }
  return x;
}

export const TIER_NAMES: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', promo: 'Hot Season', spotlight: 'Spotlight', legend: 'Legend', goat: 'GOAT' };
export const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'promo', 'legend', 'spotlight', 'goat'];

/** Basketball attributes: card code, the Hooper field, the name. */
export const NBA_ATTRS: [string, keyof Hooper, string][] = [
  ['SPD', 'spd', 'Speed'],
  ['ACC', 'acc', 'Acceleration'],
  ['HND', 'hnd', 'Ball handle'],
  ['PAS', 'pas', 'Pass accuracy'],
  ['3PT', 'thr', 'Three-point shot'],
  ['MID', 'mid', 'Mid-range shot'],
  ['CLS', 'cls', 'Close shot'],
  ['LAY', 'lay', 'Driving layup'],
  ['FT', 'ft', 'Free throw'],
  ['DNK', 'ddk', 'Driving dunk'],
  ['SDK', 'sdk', 'Standing dunk'],
  ['STR', 'str', 'Strength'],
  ['VRT', 'vrt', 'Vertical'],
  ['STA', 'sta', 'Stamina'],
  ['PRD', 'prd', 'Perimeter defense'],
  ['IND', 'ind', 'Interior defense'],
  ['STL', 'stl', 'Steal'],
  ['BLK', 'blk', 'Block'],
  ['REB', 'reb', 'Rebounding'],
];
const NBA_NAME: Record<string, string> = Object.fromEntries(NBA_ATTRS.map(([c, , n]) => [c, n]));

/** The six a basketball card shows, by position, 2K style. */
export const NBA_KEYS: Record<string, string[]> = {
  PG: ['SPD', 'HND', 'PAS', '3PT', 'LAY', 'PRD'],
  SG: ['3PT', 'MID', 'SPD', 'LAY', 'HND', 'PRD'],
  SF: ['3PT', 'MID', 'DNK', 'SPD', 'PRD', 'REB'],
  PF: ['CLS', 'MID', 'SDK', 'STR', 'IND', 'REB'],
  C: ['CLS', 'SDK', 'STR', 'IND', 'BLK', 'REB'],
};

/** Football attribute names, from every position's keys. */
const NFL_NAME: Record<string, string> = Object.fromEntries(Object.values(NFL_KEYS).flatMap((ks) => ks.map(([c, n]) => [c, n])));

export function attrName(code: string): string {
  return NBA_NAME[code] ?? NFL_NAME[code] ?? code;
}

/** What a promo and a legend add besides overall (effects are the played games' to give). */
export const PROMO_ABILITY = 'heat-check';
export const LEGEND_ABILITY = 'icon';

export const ABILITY_NAMES: Record<string, string> = {
  ...BADGE_NAMES,
  [PROMO_ABILITY]: 'Heat Check',
  [LEGEND_ABILITY]: 'Icon',
};

export const ABILITY_HELP: Record<string, string> = {
  posterizer: 'Dunks through contact',
  limitless: 'Shoots from deep without a penalty',
  deadeye: 'Contests hurt his jumper less',
  clamps: 'Locks up ball handlers',
  'rim-protector': 'Alters shots at the rim',
  'ankle-breaker': 'Crossovers leave defenders stumbling',
  dimer: 'Passes set up better shots',
  'lob-city': 'Finishes alley-oops',
  [PROMO_ABILITY]: 'Gets hot quicker: a hot-season card',
  [LEGEND_ABILITY]: 'An all-time great at his peak',
};

export function abilityName(id: string): string {
  return ABILITY_NAMES[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const cap = (x: number) => Math.max(1, Math.min(99, Math.round(x)));
const val = (x: number | null | undefined): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** The card's stats as the attrs hooper() reads (size, minutes, splits). */
function nbaAttrs(line: CardLine): Attrs {
  const s = line.stats;
  return {
    ht: line.ht,
    wt: line.wt,
    num: line.num,
    mpg: val(s.mpg),
    fg2: val(s.fg2),
    fg3: val(s.fg3),
    a3: val(s.a3),
    ft: val(s.ft),
    fta: val(s.fta),
    orb: val(s.orb),
    drb: val(s.drb),
    tov: val(s.tov),
    dunk: val(s.dunk),
    rim: val(s.rim),
  };
}

export function nbaLineOf(line: CardLine): NbaLine {
  const s = line.stats;
  const rk = line.rk;
  const n = (x: number | null | undefined) => val(x) ?? 0;
  return {
    name: line.name,
    id: line.id,
    pos: line.pos,
    from: line.season,
    r: { pts: n(s.pts), reb: n(s.reb), ast: n(s.ast), stl: n(s.stl), blk: n(s.blk) },
    val: 0,
    rk: { pts: n(rk.pts), reb: n(rk.reb), ast: n(rk.ast), stl: n(rk.stl), blk: n(rk.blk), val: n(rk.val) },
    ppg: n(s.pts),
    apg: n(s.ast),
    a: nbaAttrs(line),
  };
}

/** A football season rated on its own (estimate or same-era Madden benchmark), at its natural position. */
type NflSeason = { ovr: number; exact: number; attrs: Record<string, number>; pos: string; abil: string[]; source?: string };
const nflSeasonCache = new WeakMap<CardLine, NflSeason>();
function nflSeason(line: CardLine, strip = false): NflSeason {
  const own = strip ? undefined : nflSeasonCache.get(line);
  if (own) return own;
  const l = strip ? { ...line, ratingReference: undefined } : line;
  const r = rateNflLine({ ...l, boost: undefined }, l.pos[0]);
  const out = { ...calibrateNflReference(l, r.pos, r.ovr, nflIdentity(l, r.attrs)), pos: r.pos, abil: r.abil };
  if (!strip) nflSeasonCache.set(line, out);
  return out;
}

/**
 * Claude rework: a football starter's season estimate is held near the player's own level. Without a
 * same-era benchmark, one season's box score (a quarterback's down year, a lineman with no stats)
 * swings too far; the best three estimates within three seasons set a floor of 55/45 toward it.
 */
function nflCareerFloor(line: CardLine, pos: string, ovr: number): number {
  if (line.ratingReference || (line.starts ?? 0) < 8 || groupOf(pos) !== groupOf(line.pos[0])) return ovr;
  const career = careerOf(line);
  if (!career) return ovr;
  const g = groupOf(line.pos[0]);
  const near = career
    .filter((l) => Math.abs(l.season - line.season) <= 3 && groupOf(l.pos[0]) === g)
    .map((l) => nflSeason(l, !RATING_CONTEXT.borrow).exact)
    .sort((a, b) => b - a)
    .slice(0, 3);
  if (!near.length) return ovr;
  const rep = near.reduce((n, v) => n + v, 0) / near.length;
  return Math.max(ovr, 0.55 * ovr + 0.45 * (rep - 2));
}

/**
 * The overall a level adds: one at level 3 and one more at level 5 (the rest of a level's value goes to
 * the key attributes, +1 each per level). Kept under its old name for callers.
 */
export function levelBonus(level: number): number {
  return levelOvrBonus(Math.min(MAX_LEVEL, level));
}

/**
 * Claude rework: per-position (and, in basketball, per-decade) gold-share balance. A season's overall
 * near the gold line moves by its group's shift (full within 4 of the cut, tapering to nothing 12
 * away), fitted so every position and era has a similar share of gold cards (scripts/fit_ut_balance.ts).
 * Stars and deep-bench seasons are untouched. The attributes follow through supportOverall().
 */
export const OVR_BALANCE: Record<UtSport, Record<string, number>> = {
  nba: { 'C:1960': 3.998, 'C:1970': -2.287, 'C:1980': -0.811, 'C:1990': 0.49, 'C:2000': 2.453, 'C:2010': -0.074, 'C:2020': -2.508, 'PF:1960': 3.998, 'PF:1970': 0.975, 'PF:1980': -0.805, 'PF:1990': -0.531, 'PF:2000': 2.232, 'PF:2010': 1.053, 'PF:2020': -1.191, 'PG:1960': 1.318, 'PG:1970': -1.717, 'PG:1980': -1.348, 'PG:1990': -1.414, 'PG:2000': -0.178, 'PG:2010': -0.463, 'PG:2020': -3.824, 'SF:1960': 3.998, 'SF:1970': 3.998, 'SF:1980': 3.998, 'SF:1990': 1.25, 'SF:2000': 0.301, 'SF:2010': 2.539, 'SF:2020': -1.275, 'SG:1960': 2.811, 'SG:1970': 0.789, 'SG:1980': -0.09, 'SG:1990': -1.209, 'SG:2000': -0.816, 'SG:2010': 0.738, 'SG:2020': -1.152 },
  nfl: { 'CB': -1.475, 'DL': 0.992, 'K': 4.013, 'LB': -1.59, 'OL': 3.998, 'QB': 2.463, 'RB': -0.184, 'S': -1.965, 'TE': -0.186, 'WR': -2.771 },
};
export function balanceKey(line: Pick<CardLine, 'sport' | 'season' | 'pos'>, pos = line.pos[0]): string {
  if (line.sport === 'nfl') return groupOf(pos);
  return line.pos[0] + ':' + Math.max(1960, Math.min(2020, Math.floor(line.season / 10) * 10));
}
function balanced(line: CardLine, pos: string, ovr: number): number {
  const shift = OVR_BALANCE[line.sport][balanceKey(line, pos)] ?? 0;
  if (!shift) return ovr;
  const cut = fromDisplay(line.sport, TIER_CUTS[line.sport].gold);
  const taper = Math.max(0, Math.min(1, 1 - (Math.abs(ovr - cut) - 4) / 8));
  return ovr + shift * taper;
}

/**
 * A card, rated: overall, tier, its attributes (0-99 by card code), the six it shows, abilities.
 * `pos` rates it at another of its positions (basketball's overall doesn't move; football's may).
 */
export function rateCard(line: CardLine, level = 1, pos?: string): RatedCard {
  const boost = Math.max(0, line.boost ?? 0);
  let base: number;
  let at: string;
  let attrs: Record<string, number>;
  let keys: [string, string][];
  let abil: string[];
  let ratingSource: string | undefined;
  if (line.sport === 'nba') {
    at = pos && NBA_KEYS[pos] ? pos : NBA_KEYS[line.pos[0]] ? line.pos[0] : 'SF';
    const h = hooper(nbaLineOf(line), at, line.num);
    base = h.ovr;
    attrs = Object.fromEntries(NBA_ATTRS.map(([c, f]) => [c, h[f] as number]));
    const calibrated = calibrateNba(line, base, attrs);
    base = calibrated.exact;
    attrs = calibrated.attrs;
    ratingSource = calibrated.source;
    keys = NBA_KEYS[at].map((c) => [c, NBA_NAME[c]]);
    abil = h.abil.slice();
  } else {
    // the boost is applied here, the same way for both sports, whatever rateNflLine does with it
    let r: NflSeason;
    if (!pos || pos === line.pos[0]) r = nflSeason(line);
    else {
      const raw = rateNflLine({ ...line, boost: undefined }, pos);
      r = { ...calibrateNflReference(line, raw.pos, raw.ovr, nflIdentity(line, raw.attrs)), pos: raw.pos, abil: raw.abil };
    }
    base = nflCareerFloor(line, r.pos, r.exact);
    at = r.pos;
    attrs = { ...r.attrs };
    ratingSource = r.source;
    keys = nflFaceKeys(at).map(([c, n]) => [c, n]);
    abil = r.abil.slice();
  }
  const special = line.kind === 'goat' || line.kind === 'spotlight';
  const goat = line.kind === 'goat';
  const limit = goat ? 110 : special ? 105 : 99;
  const bounded = (x: number) => Math.max(1, Math.min(limit, Math.round(x)));
  // the overall is weighed at the card's own position in basketball (it doesn't move between spots)
  const facePos = line.sport === 'nba' ? (NBA_KEYS[line.pos[0]] ? line.pos[0] : 'SF') : at;
  base = Math.max(40, Math.min(99, balanced(line, at, base)));
  let baseOvr: number;
  let exact: number;
  // The season profile: attributes and overall brought together, so the face reads like the number.
  // Every edition of the season starts from this same profile.
  const fit = RATING_CONTEXT.support ? supportOverall(line.sport, facePos, attrs, base, { referenced: Object.keys(line.ratingReference?.attrs ?? {}) }) : { attrs, ovr: base };
  attrs = fit.attrs;
  if (special) {
    // Spotlight/GOAT: unchanged Codex model (signature skills raised to support 100–110).
    attrs = editionAttributes(attrs, boost, limit, true);
    attrs = supportEdition(line.sport, at, attrs, limit, goat ? 106 : 100);
    const support = Math.round(profileQuality(line.sport, at, attrs) + 8);
    baseOvr = bounded(Math.min(support, Math.max(goat ? 106 : 100, base + (goat ? 11 : 6))));
    exact = baseOvr;
  } else {
    exact = Math.max(40, Math.min(99, fit.ovr));
    baseOvr = cap(exact);
  }
  // What the card shows: its overall and face on the displayed UT scale (ut-scale.ts); levels add on top.
  let shownBase = special ? baseOvr : cap(toDisplay(line.sport, exact));
  let faceLift = 0;
  if (line.kind === 'promo' || line.kind === 'legend') {
    // Hot Season (Team-of-the-Year analog) / Legend: the displayed overall comes from the edition's own
    // range (UT_SCALE), ordered by the season it celebrates; the playable profile gains the edition's
    // boost once (weaknesses kept), and the face shows the season face raised to the edition's number.
    const seasonShown = shownBase;
    shownBase = Math.max(seasonShown + (line.kind === 'promo' ? 1 : 0), editionDisplay(line.sport, line.kind, seasonShown));
    attrs = editionAttributes(attrs, boost, 99, false);
    baseOvr = cap(baseOvr + boost);
    faceLift = Math.max(0, shownBase - Math.round(shownFaceMean(line.sport, facePos, attrs)));
  }
  const lv = levelAttrBonus(Math.min(MAX_LEVEL, level));
  if (lv) for (const [code] of keys) attrs[code] = bounded((attrs[code] ?? baseOvr) + lv);
  if (line.sport === 'nba') {
    const h = hooper(nbaLineOf(line), at, line.num);
    for (const [code, field] of NBA_ATTRS) (h as unknown as Record<string, unknown>)[field] = attrs[code];
    // a high-volume-era sharpshooter keeps Limitless even when his era took fewer threes a game
    abil = badges(h, attrs['3PT'] >= 90 ? Math.max(5, line.stats.a3 ?? 0) : line.stats.a3 ?? 0);
  } else abil = nflAbilities(groupOf(at), attrs);
  if (line.kind === 'promo') abil.push(PROMO_ABILITY);
  if (line.kind === 'legend' || goat) abil.unshift(LEGEND_ABILITY);
  const ovr = bounded(shownBase + levelBonus(level));
  const face = faceOf(line.sport, facePos, attrs, limit).map(([c, n, v]) => [c, n, special ? v : bounded(toDisplay(line.sport, v) + faceLift)] as [string, string, number]);
  // a season card's tier is its unlevelled overall's, so levelling never turns bronze into silver
  const tier: Tier =
    line.kind === 'goat' ? 'goat' : line.kind === 'spotlight' ? 'spotlight' : line.kind === 'promo' ? 'promo' : line.kind === 'legend' ? 'legend' : tierOf(shownBase, line.sport);
  return { line, ovr, rawOvr: bounded(baseOvr + levelBonus(level)), rawExact: exact, tier, pos: at, attrs, ratingSource, key: keys.map(([c, n]) => [c, n, attrs[c] ?? ovr]), face, abil };
}

/** A rated basketball card as the arcade game's player (for the match step). */
export function toHooper(rc: RatedCard): Hooper {
  const h = hooper(nbaLineOf(rc.line), rc.pos, rc.line.num);
  const out = { ...h, ovr: rc.ovr, abil: rc.abil.slice() } as Hooper;
  for (const [c, f] of NBA_ATTRS) if (typeof rc.attrs[c] === 'number') (out as unknown as Record<string, number>)[f as string] = rc.attrs[c];
  return out;
}
