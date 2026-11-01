// Claude ratings rework (2026-11-01): what an Ultimate Team card's face shows, and keeping the
// overall honest to it. Basketball cards show six universal categories (FC-style) built from the
// played attributes; football cards show their position's six key attributes. Either way the overall
// sits within a few points of the position-weighted mean of the face, so a 95 looks like a 95.
import { NFL_KEYS, groupOf } from '../game/football2/ratings';
import { roleWeights } from './rating-quality';
import type { UtSport } from './types';
import { fromDisplay, toDisplay } from './ut-scale';

export interface FaceCategory {
  code: string;
  label: string;
  /** attribute → weight inside the category */
  parts: Record<string, number>;
  /** how much the category leans on its best part (a sharpshooter's OUT is his three, not his FT) */
  top: number;
}

/** Basketball's six: outside, inside, playmaking, athleticism, defense, rebounding. */
export const NBA_FACE: FaceCategory[] = [
  { code: 'OUT', label: 'Outside scoring', parts: { '3PT': 0.5, MID: 0.35, FT: 0.15 }, top: 0.5 },
  { code: 'INS', label: 'Inside scoring', parts: { CLS: 0.35, LAY: 0.35, DNK: 0.2, SDK: 0.1 }, top: 0.5 },
  { code: 'PLY', label: 'Playmaking', parts: { HND: 0.5, PAS: 0.5 }, top: 0.4 },
  { code: 'ATH', label: 'Athleticism', parts: { SPD: 0.3, ACC: 0.25, VRT: 0.2, STR: 0.15, STA: 0.1 }, top: 0 },
  { code: 'DEF', label: 'Defense', parts: { PRD: 0.35, IND: 0.3, STL: 0.2, BLK: 0.15 }, top: 0.5 },
  { code: 'REB', label: 'Rebounding', parts: { REB: 1 }, top: 0 },
];

/**
 * Basketball roles (2K-style archetypes): how much each category counts toward the overall. A card is
 * weighed in the role of its position that suits it best, so a glass-cleaning stopper is judged on
 * rebounding and defense and a pure shooter on his shot, never on skills the role doesn't ask for.
 */
export const NBA_ROLES: Record<string, { label: string; w: Record<string, number> }> = {
  playmaker: { label: 'Playmaker', w: { OUT: 0.22, INS: 0.16, PLY: 0.42, ATH: 0.12, DEF: 0.08 } },
  creator: { label: 'Shot creator', w: { OUT: 0.4, INS: 0.22, PLY: 0.22, ATH: 0.1, DEF: 0.06 } },
  slasher: { label: 'Slasher', w: { OUT: 0.12, INS: 0.4, PLY: 0.18, ATH: 0.2, DEF: 0.1 } },
  stopper: { label: 'Lockdown defender', w: { OUT: 0.2, INS: 0.12, PLY: 0.14, ATH: 0.16, DEF: 0.38 } },
  scorer: { label: 'Scoring wing', w: { OUT: 0.34, INS: 0.34, PLY: 0.12, ATH: 0.1, DEF: 0.06, REB: 0.04 } },
  twoway: { label: 'Two-way wing', w: { OUT: 0.24, INS: 0.24, PLY: 0.1, ATH: 0.12, DEF: 0.2, REB: 0.1 } },
  forward: { label: 'Point forward', w: { OUT: 0.18, INS: 0.26, PLY: 0.34, ATH: 0.1, DEF: 0.06, REB: 0.06 } },
  post: { label: 'Post scorer', w: { OUT: 0.08, INS: 0.5, PLY: 0.06, ATH: 0.04, DEF: 0.14, REB: 0.18 } },
  stretch: { label: 'Stretch big', w: { OUT: 0.4, INS: 0.24, PLY: 0.06, ATH: 0.04, DEF: 0.1, REB: 0.16 } },
  glass: { label: 'Glass and paint defender', w: { INS: 0.18, ATH: 0.04, DEF: 0.38, REB: 0.4 } },
  hub: { label: 'Playmaking big', w: { OUT: 0.14, INS: 0.3, PLY: 0.26, DEF: 0.06, REB: 0.24 } },
};
const NBA_POSITION_ROLES: Record<string, string[]> = {
  PG: ['playmaker', 'creator', 'slasher', 'stopper'],
  SG: ['creator', 'slasher', 'stopper', 'playmaker'],
  SF: ['scorer', 'twoway', 'forward', 'slasher', 'stopper'],
  PF: ['post', 'stretch', 'glass', 'hub', 'twoway'],
  C: ['post', 'glass', 'stretch', 'hub'],
};

/** Football faces: the position's key attributes, with the most-weighted skills on every face. */
const NFL_FACE_KEYS: Record<string, [string, string][]> = {
  ...NFL_KEYS,
  RB: [['SPD', 'Speed'], ['ACC', 'Acceleration'], ['BTK', 'Break tackle'], ['JKM', 'Juke move'], ['CAR', 'Carrying'], ['BCV', 'Ball carrier vision']],
  CB: [['SPD', 'Speed'], ['MCV', 'Man coverage'], ['ZCV', 'Zone coverage'], ['PRS', 'Press'], ['PRC', 'Play recognition'], ['CTH', 'Catching']],
};

export function nflFaceKeys(pos: string): [string, string][] {
  return NFL_FACE_KEYS[groupOf(pos)] ?? NFL_FACE_KEYS.WR;
}

export function nbaCategory(cat: FaceCategory, attrs: Record<string, number>, cap = 99): number {
  let mean = 0,
    best = 0;
  for (const [code, w] of Object.entries(cat.parts)) {
    const v = attrs[code] ?? 50;
    mean += v * w;
    best = Math.max(best, v);
  }
  return Math.max(1, Math.min(cap, Math.round(cat.top * best + (1 - cat.top) * mean)));
}

/** The six numbers printed on the card: [code, name, value]. */
export function faceOf(sport: UtSport, pos: string, attrs: Record<string, number>, cap = 99): [string, string, number][] {
  if (sport === 'nba') return NBA_FACE.map((c) => [c.code, c.label, nbaCategory(c, attrs, cap)]);
  return nflFaceKeys(pos).map(([code, label]) => [code, label, attrs[code] ?? 50]);
}

/** Face code → its weight in this position's overall (basketball: in the card's best role). */
export function faceWeights(sport: UtSport, pos: string, attrs?: Record<string, number>): Record<string, number> {
  if (sport === 'nba') return NBA_ROLES[attrs ? nbaRole(pos, attrs) : (NBA_POSITION_ROLES[pos] ?? NBA_POSITION_ROLES.SF)[0]].w;
  const role = roleWeights('nfl', pos);
  return Object.fromEntries(nflFaceKeys(pos).map(([code]) => [code, role[code] ?? 0]));
}

/** The basketball role (NBA_ROLES key) a card's attributes fit best at its position. */
export function nbaRole(pos: string, attrs: Record<string, number>): string {
  let best = '',
    top = -1;
  for (const r of NBA_POSITION_ROLES[pos] ?? NBA_POSITION_ROLES.SF) {
    const f = meanOf(nbaSpec(r), (c) => attrs[c] ?? 50, 99);
    if (f > top) [best, top] = [r, f];
  }
  return best;
}

interface FaceSpec {
  entries: { parts: [string, number][]; top: number; w: number }[];
  total: number;
  /** attributes that feed the face (and so the overall) */
  feeding: string[];
}
const specs = new Map<string, FaceSpec>();
function nbaSpec(role: string): FaceSpec {
  const k = 'nba:' + role;
  let spec = specs.get(k);
  if (!spec) {
    const w = NBA_ROLES[role].w;
    const entries = NBA_FACE.map((c) => ({ parts: Object.entries(c.parts), top: c.top, w: w[c.code] ?? 0 })).filter((e) => e.w > 0);
    // only the role's main categories move to fit the overall (a playmaker's defense stays his own)
    const feeding = NBA_FACE.filter((c) => (w[c.code] ?? 0) >= 0.15).flatMap((c) => Object.keys(c.parts));
    spec = { entries, total: entries.reduce((n, e) => n + e.w, 0), feeding };
    specs.set(k, spec);
  }
  return spec;
}
function specOf(sport: UtSport, pos: string, attrs: Record<string, number>): FaceSpec {
  if (sport === 'nba') return nbaSpec(nbaRole(pos, attrs));
  const k = 'nfl:' + groupOf(pos);
  let spec = specs.get(k);
  if (!spec) {
    const w = faceWeights(sport, pos);
    const entries = nflFaceKeys(pos)
      .map(([code]) => ({ parts: [[code, 1]] as [string, number][], top: 0, w: w[code] ?? 0 }))
      .filter((e) => e.w > 0);
    const feeding = [...new Set([...Object.keys(roleWeights('nfl', pos)), ...nflFaceKeys(pos).map(([c]) => c)])];
    spec = { entries, total: entries.reduce((n, e) => n + e.w, 0), feeding };
    specs.set(k, spec);
  }
  return spec;
}
function meanOf(spec: FaceSpec, get: (code: string) => number, cap: number, show?: (x: number) => number): number {
  let n = 0;
  for (const e of spec.entries) {
    let mean = 0,
      best = 0;
    for (const [code, w] of e.parts) {
      const v = get(code);
      mean += v * w;
      if (v > best) best = v;
    }
    const v = Math.max(1, Math.min(cap, Math.round(e.top * best + (1 - e.top) * mean)));
    n += e.w * (show ? Math.round(show(v)) : v);
  }
  return spec.total ? n / spec.total : 0;
}

/** The position-weighted mean of the face: what the overall must stay close to. */
export function faceMean(sport: UtSport, pos: string, attrs: Record<string, number>, cap = 99): number {
  return meanOf(specOf(sport, pos, attrs), (c) => attrs[c] ?? 50, cap);
}

/** The same on the displayed UT scale: the weighted mean of the face numbers the card prints. */
export function shownFaceMean(sport: UtSport, pos: string, attrs: Record<string, number>): number {
  return meanOf(specOf(sport, pos, attrs), (c) => attrs[c] ?? 50, 99, (x) => toDisplay(sport, x));
}

/** Measured or directly observed: never moved to fit an overall. */
const PROTECTED: Record<UtSport, string[]> = { nba: ['FT', 'SPD', 'ACC'], nfl: ['SPD', 'ACC', 'AGI', 'STR', 'THP'] };

export interface SupportOptions {
  /** codes that came from a same-era benchmark: they move at most 3 */
  referenced?: Iterable<string>;
  /** the most any attribute moves */
  limit?: number;
  /** a real sample (10+ games): 85+ signature skills give way at most 4 */
  signature?: boolean;
}

/**
 * Bring a card's attributes and overall together: when the overall sits more than 2 above (below) the
 * weighted face, the role's main skill attributes rise (fall) by up to `limit` — attributes under 75 rise
 * only partly (weaknesses barely), measured athleticism and free throws not at all — and whatever gap remains past 3 comes
 * off the overall. The played game reads the same attributes, so the card plays like its number.
 */
export function supportOverall(sport: UtSport, pos: string, attrs: Record<string, number>, ovr: number, opts: SupportOptions = {}): { attrs: Record<string, number>; ovr: number } {
  // judged as the card is shown: the displayed overall against the displayed face (ut-scale.ts)
  const show = (x: number) => toDisplay(sport, x);
  const spec = specOf(sport, pos, attrs);
  const f0 = meanOf(spec, (c) => attrs[c] ?? 50, 99, show);
  const shown = show(ovr);
  const gap = shown - f0;
  if (Math.abs(gap) <= 2) return { attrs, ovr };
  const sign = Math.sign(gap);
  const want = shown - sign * 2;
  // stars' card attributes may rise further (the cards people chase must read like their number)
  // a thin-sample season's estimated skills give way further (its overall already shrinks the sample)
  const limit = opts.limit ?? (sign < 0 ? 14 : ovr >= 90 ? 8 : 6);
  const ref = new Set(opts.referenced ?? []);
  const codes = spec.feeding.filter((c) => c in attrs && !PROTECTED[sport].includes(c));
  const moved: Record<string, number> = {};
  const shift = (s: number) => {
    for (const c of codes) {
      const v = attrs[c];
      let d = sign * Math.min(s, ref.has(c) ? Math.min(3, limit) : limit);
      if (d > 0) d *= v >= 75 ? 1 : v >= 65 ? 0.5 : 0.2;
      // a proven signature skill (85+) is the card's identity: it gives way at most 4 (a bench sharpshooter stays one)
      else if (v >= 85 && opts.signature) d = Math.max(d, -4);
      moved[c] = Math.max(1, Math.min(99, Math.round(v + d)));
    }
  };
  const get = (c: string) => moved[c] ?? attrs[c] ?? 50;
  let lo = 0,
    hi = limit;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    shift(mid);
    if (sign * (want - meanOf(spec, get, 99, show)) > 0) lo = mid;
    else hi = mid;
  }
  shift(hi);
  const out = { ...attrs, ...moved };
  // judged again in whichever role now fits best (a lowered profile can suit another role)
  const f1 = meanOf(specOf(sport, pos, out), (c) => out[c] ?? 50, 99, show);
  // the very top of the scale may sit up to 4 over its face (a 99 is rarely 99 everywhere)
  const over = 3 + Math.max(0, Math.min(1, (ovr - 91) / 4));
  const fitted = Math.max(f1 - 3, Math.min(f1 + over, shown));
  return { attrs: out, ovr: fitted === shown ? ovr : Math.max(1, Math.min(99, fromDisplay(sport, fitted))) };
}

/** Levels: each level above 1 adds one to the card's key attributes; levels 3 and 5 also add one overall. */
export function levelAttrBonus(level: number): number {
  return Math.max(0, Math.min(5, Math.round(level)) - 1);
}
export function levelOvrBonus(level: number): number {
  const l = Math.round(level);
  return l >= 5 ? 2 : l >= 3 ? 1 : 0;
}
