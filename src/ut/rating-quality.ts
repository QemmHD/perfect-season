import { pickFor } from '../engine/sport';
// Implemented by Codex. Overall must be supported by the attributes used in the actual match.
import type { UtSport } from "./types";
import { fromDisplay, toDisplay } from "./ut-scale";
const NBA: Record<string, Record<string, number>> = {
  PG: {
    HND: 0.19,
    PAS: 0.18,
    "3PT": 0.14,
    MID: 0.08,
    LAY: 0.12,
    PRD: 0.12,
    SPD: 0.08,
    STL: 0.04,
    STA: 0.05,
  },
  SG: {
    "3PT": 0.16,
    MID: 0.16,
    LAY: 0.14,
    HND: 0.13,
    PRD: 0.14,
    DNK: 0.08,
    SPD: 0.08,
    PAS: 0.06,
    STA: 0.05,
  },
  SF: {
    "3PT": 0.11,
    MID: 0.11,
    CLS: 0.06,
    LAY: 0.12,
    DNK: 0.06,
    PRD: 0.15,
    HND: 0.1,
    PAS: 0.11,
    REB: 0.08,
    IND: 0.04,
    SPD: 0.03,
    STA: 0.03,
  },
  PF: {
    CLS: 0.13,
    MID: 0.08,
    SDK: 0.1,
    IND: 0.19,
    REB: 0.19,
    STR: 0.09,
    BLK: 0.09,
    DNK: 0.07,
    PAS: 0.03,
    STA: 0.03,
  },
  C: {
    CLS: 0.18,
    SDK: 0.12,
    IND: 0.2,
    REB: 0.2,
    BLK: 0.12,
    STR: 0.1,
    PAS: 0.03,
    SPD: 0.02,
    STA: 0.03,
  },
};
const NFL: Record<string, Record<string, number>> = {
  QB: {
    THP: 0.18,
    SAC: 0.2,
    MAC: 0.21,
    DAC: 0.15,
    TUP: 0.15,
    AWR: 0.1,
    SPD: 0.01,
  },
  RB: {
    SPD: 0.17,
    ACC: 0.12,
    BTK: 0.16,
    JKM: 0.12,
    CAR: 0.14,
    BCV: 0.19,
    CTH: 0.1,
  },
  WR: { SPD: 0.18, CTH: 0.22, RTE: 0.24, CIT: 0.12, SPC: 0.08, REL: 0.16 },
  TE: { CTH: 0.25, RBK: 0.16, SPD: 0.12, CIT: 0.16, RTE: 0.22, STR: 0.09 },
  OL: { PBK: 0.34, RBK: 0.31, STR: 0.14, AWR: 0.13, IBL: 0.08 },
  DL: {
    PMV: 0.23,
    FMV: 0.19,
    BSH: 0.22,
    STR: 0.13,
    SPD: 0.08,
    TAK: 0.08,
    PRC: 0.07,
  },
  LB: {
    TAK: 0.22,
    PUR: 0.18,
    PRC: 0.2,
    ZCV: 0.12,
    SPD: 0.1,
    BSH: 0.12,
    PMV: 0.03,
    FMV: 0.03,
  },
  CB: { SPD: 0.18, MCV: 0.28, ZCV: 0.21, PRS: 0.11, PRC: 0.13, CTH: 0.09 },
  S: { SPD: 0.13, ZCV: 0.27, MCV: 0.15, TAK: 0.17, HIT: 0.1, PRC: 0.18 },
  K: { KAC: 0.58, KPW: 0.42 },
};
function group(pos: string) {
  if (["OT", "OG", "C", "OL", "T", "G"].includes(pos)) return "OL";
  if (["DE", "DT", "DL", "NT"].includes(pos)) return "DL";
  return pos === "DB" ? "CB" : pos === "FB" ? "RB" : pos;
}
export function roleWeights(sport: UtSport, pos: string) {
  // soccer cards carry their own overall (rate.ts rateSoccerCard): basketball's weights only as a placeholder
  return pickFor(sport, { nba: () => NBA[pos] ?? NBA.SF, nfl: () => NFL[group(pos)] ?? NFL.WR, soccer: () => NBA.SF })();
}
/** A specialist can be great without mastering unrelated skills. Only meaningful position skills count. */
export function profileQuality(
  sport: UtSport,
  pos: string,
  attrs: Record<string, number>,
): number {
  const weights = roleWeights(sport, pos),
    entries = Object.entries(weights);
  const average =
    entries.reduce((n, [code, w]) => n + (attrs[code] ?? 50) * w, 0) /
    entries.reduce((n, [, w]) => n + w, 0);
  const strengths = entries
    .filter(([code, w]) => w >= 0.075 && !["STA", "SPD"].includes(code))
    .map(([code]) => attrs[code] ?? 50)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const best =
    strengths.reduce((n, v) => n + v, 0) / Math.max(1, strengths.length);
  const quality = 0.35 * average + 0.65 * best;
  // Big playmakers are not forced into a rim-running center's skill mix.
  return sport === "nba" &&
    ["PF", "C"].includes(pos) &&
    (attrs.PAS ?? 0) >= 78 &&
    (attrs.HND ?? 0) >= 65
    ? Math.max(quality, profileQuality("nba", "SF", attrs))
    : quality;
}
/** Measured speed: a Hot Season or Legend raises it by half its delta (editionAttributes). */
const ATHLETIC: Record<UtSport, string[]> = { nba: ["SPD", "ACC"], nfl: ["SPD", "ACC", "AGI"], soccer: [] };
/**
 * Higher editions improve signature strengths; a pocket passer or non-shooter retains that identity.
 * Claude (packs-5, plan D4): a numbered edition's gain on a strength (80+) scales with its headroom,
 * `amount × (cap − v) / (cap − 60)`, so a 99 gains less than an 85 and the top of the profile keeps its
 * order instead of piling up at the cap (the old full gain put Brady's GOAT at 110 in five of six).
 * Given `sport`, a Hot Season or Legend gain (packs-5, plan D3) is at least `amount` on the displayed
 * scale too (ut-scale.ts), so every face number rises by the edition's delta like its overall does,
 * where the displayed curve is flat (most of the 80s) and `amount` rating points would show as two.
 * Measured speed (ATHLETIC) is the exception: an honored season doesn't make a player faster, so there
 * a Hot Season or Legend adds half its delta (a 44-year-old Brady stays a pocket passer).
 */
export function editionAttributes(
  base: Record<string, number>,
  amount: number,
  cap: number,
  special: boolean,
  sport?: UtSport,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(base).map(([code, value]) => {
      let gain = amount;
      if (special) {
        gain *= value < 65 ? 0.12 : value < 80 ? 0.5 : Math.max(0, cap - value) / (cap - 60);
        if (["SPD", "ACC", "AGI", "VRT"].includes(code))
          gain = Math.min(amount >= 14 ? 6 : 4, gain);
        if (code === "FT") gain = Math.min(4, gain);
      } else if (value < 55) gain = Math.min(2, amount * 0.3);
      else if (sport && ATHLETIC[sport].includes(code)) gain = Math.ceil(amount / 2);
      else if (sport) gain = Math.max(amount, fromDisplay(sport, toDisplay(sport, value) + amount) - value);
      return [code, Math.max(1, Math.min(cap, Math.round(value + gain)))];
    }),
  );
}

/** Measured or observed athleticism (and free throws, stamina): a numbered edition never lifts them. */
const UNLIFTED = ["SPD", "ACC", "AGI", "VRT", "FT", "STA"];
/** Claude (packs-5, plan D4): how many attributes of a numbered edition may sit at its cap. */
export const SPECIAL_AT_CAP = 2;

/**
 * Hold a numbered edition to at most `n` attributes at its cap: the ones already there stay, then the
 * highest of `ref` (the profile before the last raise, so ties keep their order); every other
 * attribute stops one under the cap.
 */
export function holdCap(
  attrs: Record<string, number>,
  ref: Record<string, number>,
  cap: number,
  n = SPECIAL_AT_CAP,
): Record<string, number> {
  const out = { ...attrs };
  const want = Object.keys(out).filter((k) => out[k] >= cap);
  if (want.length <= n) return out;
  const keep = new Set(want.filter((k) => (ref[k] ?? 0) >= cap));
  for (const k of want.slice().sort((a, b) => (ref[b] ?? 0) - (ref[a] ?? 0) || (a < b ? -1 : 1)))
    if (keep.size < n) keep.add(k);
  for (const k of want) if (!keep.has(k)) out[k] = cap - 1;
  return out;
}

/**
 * Claude (packs-5, plan D4; replaces Codex's supportEdition): lift a numbered edition's proven
 * strengths until its overall reaches `target`, keeping the player's shape. The strengths (role skills
 * of 75+, never measured athleticism, free throws or stamina) rise a point at a time in proportion to
 * (v − 60)^1.5, so the best skills rise most, and:
 *  1. at most SPECIAL_AT_CAP attributes reach the cap (what can't go higher spills to the next strength);
 *  2. no face value (`face`: the six numbers the card prints) reaches one that stood above it, so the
 *     face keeps its order;
 *  3. the tier `floor` holds.
 * When the target can't be met that way the edition settles on the best whole overall it can carry, as
 * long as that is the floor. Only a card that could not otherwise reach its floor gives way: first on
 * the face order, then with a third attribute at the cap (the feasibility list,
 * `scripts/packs/promoattrs.ts --feasibility`).
 */
export function shapeEdition(
  sport: UtSport,
  pos: string,
  attrs: Record<string, number>,
  cap: number,
  target: number,
  floor: number,
  face: (attrs: Record<string, number>) => number[] = (a) => Object.values(a),
): Record<string, number> {
  const weights = roleWeights(sport, pos);
  const strong = Object.keys(attrs).filter(
    (k) => (weights[k] ?? 0) >= 0.075 && attrs[k] >= 75 && !UNLIFTED.includes(k),
  );
  const carries = (a: Record<string, number>, want: number) => profileQuality(sport, pos, a) + 8 >= want - 0.49;
  if (!strong.length || carries(attrs, target)) return { ...attrs };
  const pull = strong.map((k) => Math.pow(attrs[k] - 60, 1.5));
  const ref = face(attrs);
  // [higher, lower] face positions: the lower stays under the higher (never ties it, never passes it)
  const pairs: [number, number][] = [];
  ref.forEach((x, i) => ref.forEach((y, j) => x > y && pairs.push([i, j])));
  const run = (n: number, keepOrder: boolean, want: number) => {
    const out = { ...attrs };
    const lift = strong.map(() => 0);
    let atCap = Object.values(out).filter((v) => v >= cap).length;
    while (!carries(out, want)) {
      let moved = false;
      for (const i of strong.map((_, i) => i).sort((a, b) => lift[a] / pull[a] - lift[b] / pull[b] || b - a)) {
        const k = strong[i];
        if (out[k] >= cap || (out[k] + 1 >= cap && atCap >= n)) continue;
        out[k]++;
        if (keepOrder) {
          const f = face(out);
          if (pairs.some(([hi, lo]) => f[lo] >= f[hi])) {
            out[k]--;
            continue;
          }
        }
        if (out[k] >= cap) atCap++;
        lift[i]++;
        moved = true;
        break;
      }
      if (!moved) break;
    }
    return out;
  };
  const kept = run(SPECIAL_AT_CAP, true, target);
  if (carries(kept, target)) return kept;
  // the best whole overall the shape can carry, reached with the least lift
  const most = Math.min(target, Math.floor(profileQuality(sport, pos, kept) + 8 + 0.49));
  if (most >= floor) return run(SPECIAL_AT_CAP, true, most);
  const loose = run(SPECIAL_AT_CAP, false, floor);
  return carries(loose, floor) ? loose : run(SPECIAL_AT_CAP + 1, false, floor);
}
