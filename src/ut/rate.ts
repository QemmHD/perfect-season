import { nflIdentity } from './nfl-identity';
import { editionAttributes, profileQuality, supportEdition } from './rating-quality';
// Ultimate Team ratings: a card line becomes a rated card with the same code the played games use,
// so a card shows exactly what it plays like. Basketball goes through hoops2's `hooper()` (fed the
// season's own ranks), football through football2's `rateNflLine()`. On top of the base rating:
// standard promo/legend boosts and levels affect the six key attributes. Codex Spotlight/GOAT
// editions improve the full profile, retain signature weaknesses, and support 100–110 gameplay. See docs/ULTIMATE-TEAM.md.
import { calibrateNba, nbaRosterScale } from './calibration';
import type { Attrs } from '../game/attrs';
import { groupOf, NFL_KEYS, rateNflLine, nflAbilities } from '../game/football2/ratings';
import { BADGE_NAMES, badges, hooper, type NbaLine } from '../game/hoops2/ratings';
import type { Hooper } from '../game/hoops2/types';
import { MAX_LEVEL } from './state';
import type { CardLine, RatedCard, Tier, UtSport } from './types';

/** Codex roster calibration: NBA Bronze <75, Silver 75–84, Gold 85+.
 * NFL retains its own distribution: Bronze <84, Silver 84–88, Gold 89+.
 * Old challenge thresholds pass through onScale(), preserving their relative difficulty. */
export const TIER_CUTS: Record<UtSport, { silver: number; gold: number }> = { nba: { silver: 75, gold: 85 }, nfl: { silver: 84, gold: 89 } };

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

/** Each level above 1 adds one overall. */
export function levelBonus(level: number): number {
  return Math.max(0, Math.min(MAX_LEVEL, Math.round(level)) - 1);
}

/**
 * A card, rated: overall, tier, its attributes (0-99 by card code), the six it shows, abilities.
 * `pos` rates it at another of its positions (basketball's overall doesn't move; football's may).
 */
export function rateCard(line: CardLine, level = 1, pos?: string): RatedCard {
  const boost = Math.max(0, line.boost ?? 0);
  const bonus = boost + levelBonus(level);
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
    base = calibrated.ovr;
    attrs = calibrated.attrs;
    ratingSource = calibrated.source;
    keys = NBA_KEYS[at].map((c) => [c, NBA_NAME[c]]);
    abil = h.abil.slice();
  } else {
    // the boost is applied here, the same way for both sports, whatever rateNflLine does with it
    const r = rateNflLine({ ...line, boost: undefined }, pos ?? line.pos[0]);
    const actualAttrs = nflIdentity(line, r.attrs);
    base = Math.min(r.ovr, Math.round(profileQuality('nfl', r.pos, actualAttrs) + 5));
    at = r.pos;
    attrs = actualAttrs;
    keys = r.key.map(([c, n]) => [c, n]);
    if (!keys.length) keys = (NFL_KEYS[groupOf(at)] ?? NFL_KEYS.WR).map(([c, n]) => [c, n]);
    abil = r.abil.slice();
  }
  const special = line.kind === 'goat' || line.kind === 'spotlight';
  const goat = line.kind === 'goat';
  const limit = goat ? 110 : special ? 105 : 99;
  const bounded = (x: number) => Math.max(1, Math.min(limit, Math.round(x)));
  // Boost exactly once. Promo editions improve the whole playable profile, preserving signature skills.
  if (boost) attrs = editionAttributes(attrs, boost, limit, special);
  if (special) attrs = supportEdition(line.sport, at, attrs, limit, goat ? 106 : 100);
  if (levelBonus(level)) for (const [code] of keys) attrs[code] = bounded((attrs[code] ?? base) + levelBonus(level));
  if (line.sport === 'nba') {
    const h = hooper(nbaLineOf(line), at, line.num);
    for (const [code, field] of NBA_ATTRS) (h as unknown as Record<string, unknown>)[field] = attrs[code];
    abil = badges(h, line.stats.a3 ?? 0);
  } else abil = nflAbilities(groupOf(at), attrs);
  if (line.kind === 'promo') abil.push(PROMO_ABILITY);
  if (line.kind === 'legend' || goat) abil.unshift(LEGEND_ABILITY);
  const support = Math.round(profileQuality(line.sport, at, attrs) + 8);
  const baseOvr = special ? bounded(Math.min(support, Math.max(goat ? 106 : 100, base + (goat ? 11 : 6)))) : cap(base + boost);
  const ovr = special ? bounded(Math.min(support, baseOvr + levelBonus(level))) : cap(Math.min(support + 2, base + bonus));
  // a season card's tier is its unlevelled overall's, so levelling never turns bronze into silver
  const tier: Tier =
    line.kind === 'goat' ? 'goat' : line.kind === 'spotlight' ? 'spotlight' : line.kind === 'promo' ? 'promo' : line.kind === 'legend' ? 'legend' : tierOf(baseOvr, line.sport);
  return { line, ovr, tier, pos: at, attrs, ratingSource, key: keys.map(([c, n]) => [c, n, attrs[c] ?? ovr]), abil };
}

/** A rated basketball card as the arcade game's player (for the match step). */
export function toHooper(rc: RatedCard): Hooper {
  const h = hooper(nbaLineOf(rc.line), rc.pos, rc.line.num);
  const out = { ...h, ovr: rc.ovr, abil: rc.abil.slice() } as Hooper;
  for (const [c, f] of NBA_ATTRS) if (typeof rc.attrs[c] === 'number') (out as unknown as Record<string, number>)[f as string] = rc.attrs[c];
  return out;
}
