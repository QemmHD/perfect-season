// Implemented by Codex. Season-supported attributes and position-supported overalls for EVERY NBA edition.
import references from "../data/nba-rating-references.json";
import type { CardLine } from "./types";
import { profileQuality } from "./rating-quality";
import { borrowNeighbour } from "./season-reference";
const refs = new Map(references.players.map((p) => [p.name, p]));
const clamp = (v: number, a = 25, b = 99) =>
  Math.max(a, Math.min(b, Math.round(v)));
const unit = (v: number) => Math.max(0, Math.min(1, v));
/** Piecewise-linear through sorted [x, y] knots. */
export function piecewise(x: number, knots: [number, number][]): number {
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++)
    if (x <= knots[i][0]) {
      const [x0, y0] = knots[i - 1],
        [x1, y1] = knots[i];
      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  return knots[knots.length - 1][1];
}
/** Claude ratings rework: the 2K overall a season's league standing (rk.val) usually earns, measured
 * on the 9,400 seasons that have a same-era 2K rating. Used to keep each era's gold share realistic. */
const ERA_CURVE: [number, number][] = [
  [0, 69], [0.2, 71], [0.4, 73], [0.6, 75], [0.7, 77], [0.8, 79], [0.85, 81],
  [0.9, 83], [0.93, 85], [0.96, 88], [0.98, 90], [0.99, 94], [1, 96],
];
/** Estimate-path position bias against same-era 2K (centres and point guards ran hot). */
const POSITION_OFFSET: Record<string, number> = { C: -7, PG: -6, PF: -1 };
/** A low-volume season still says something about touch: the least a position's three can be. */
const THREE_FLOOR: Record<string, number> = { PG: 62, SG: 62, SF: 58, PF: 50, C: 40 };
/** Legacy challenge values are mapped to the familiar roster scale, not used as a card's final overall. */
export function nbaRosterScale(value: number): number {
  const points = [
    [40, 40],
    [56, 60],
    [65, 75],
    [75, 85],
    [85, 92],
    [95, 97],
    [99, 99],
  ];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1],
      [x1, y1] = points[i];
    if (value <= x1) return clamp(y + ((value - x) * (y1 - y)) / (x1 - x));
  }
  return 99;
}
export function calibrateNba(
  line: CardLine,
  base: number,
  raw: Record<string, number>,
) {
  const seasonRef = line.ratingReference;
  let attrs = { ...raw };
  const s = line.stats,
    honors = new Set(line.honors),
    big = ["C", "PF"].includes(line.pos[0]);
  // Claude rework: the season-stat estimate over-rates centres' handle, burst and finishing.
  if (!seasonRef && line.pos[0] === "C")
    for (const [code, d] of [["DNK", 6], ["HND", 6], ["SPD", 6], ["IND", 6], ["LAY", 5], ["PRD", 4]] as const)
      attrs[code] = clamp(attrs[code] - d, 1);
  // A season without its own 2K benchmark borrows the player's nearest one (aged athleticism, half-weight skills).
  if (!seasonRef) attrs = borrowNeighbour(line, attrs, ["SPD", "ACC"], []);
  const eliteDef = honors.has("DPOY") || honors.has("ALLDEF1"),
    goodDef = eliteDef || honors.has("ALLDEF2");
  // Missing historical measurements mean unknown, not an actual zero steal/block skill.
  if (s.stl === null) {
    attrs.STL = big ? 48 : 58;
    attrs.PRD = big ? 48 : 62;
  }
  if (s.blk === null) {
    attrs.BLK = big ? 64 : 38;
    attrs.IND = big ? 70 : 45;
  }
  attrs.PRD = Math.min(attrs.PRD, goodDef ? 99 : 84);
  if (goodDef) {
    const key = big ? "IND" : "PRD";
    attrs[key] = Math.max(attrs[key], eliteDef ? 94 : 88);
  }
  if (big && (s.dunk ?? 0) > 0.1 && (s.ft ?? 0.6) < 0.72)
    attrs.MID = Math.min(attrs.MID, 68);
  const ref = refs.get(line.name);
  let nearPeak = 0;
  if (ref) {
    const award = honors.has("MVP")
      ? 0.95
      : honors.has("ALLNBA1")
        ? 0.85
        : honors.has("ALLNBA2")
          ? 0.7
          : honors.has("ALLNBA3")
            ? 0.55
            : eliteDef
              ? 0.65
              : 0;
    nearPeak = Math.max(
      award,
      1 - Math.abs(line.season - ref.peakSeason) / 6,
      0,
    );
    const weight = 0.18 + 0.72 * nearPeak;
    for (const [code, value] of Object.entries(ref.attrs))
      if (typeof value === "number" && code in attrs)
        attrs[code] = clamp(attrs[code] * (1 - weight) + value * weight);
  }
  // Gus Johnson is absent from the public 2K all-time roster snapshot. His Hall of Fame bio
  // documents the power/athletic profile the pre-tracking box score cannot measure.
  // Numeric ratings are explicitly curated estimates, not official 2K values.
  // https://www.hoophall.com/hall-of-famers/gus-johnson/
  if (line.name === "Gus Johnson") {
    const decline = Math.max(0, line.season - 1970) * 1.5;
    for (const [code, value] of Object.entries({
      DNK: 94,
      SDK: 82,
      STR: 90,
      VRT: 93,
      SPD: 82,
      ACC: 85,
      PRD: 82,
    }))
      attrs[code] = clamp(value - decline);
  }
  // A same-era roster is stronger evidence than a player's all-time peak. These are public
  // release/update benchmarks, blended with actual season performance; never claimed as an exact roster clone.
  if (seasonRef) for (const [code, value] of Object.entries(seasonRef.attrs)) {
    if (code in attrs) attrs[code] = clamp(value * 0.95 + raw[code] * 0.05);
  }
  // Percentages alone are noisy: shrink toward 34% with a 75-attempt prior, using the actual season sample.
  const attempts = (s.a3 ?? 0) * (line.games ?? s.g ?? 0),
    pct = s.fg3;
  const ref3 = seasonRef?.attrs["3PT"];
  if (line.season < 1980) {
    // No measured three-point season exists. Touch is an estimate and cannot invent elite modern range.
    attrs["3PT"] = Math.min(
      attrs["3PT"],
      clamp(38 + 40 * unit(((s.ft ?? 0.7) - 0.55) / 0.35), 35, 78),
    );
  } else if (ref3 !== undefined) {
    // A same-era 2K shooting grade is trusted; only a tiny or unmeasured sample is held down.
    if (pct === null || pct === undefined) attrs["3PT"] = Math.min(attrs["3PT"], 72);
    else if (attempts < 75) attrs["3PT"] = Math.min(attrs["3PT"], 80);
  } else {
    const touch = unit(((s.ft ?? 0.7) - 0.6) / 0.25);
    const floor = Math.round((THREE_FLOOR[line.pos[0]] ?? 55) * (0.82 + 0.18 * touch));
    if (pct === null || pct === undefined || (s.a3 ?? 0) < 0.3) {
      attrs["3PT"] = Math.min(55, Math.max(floor, Math.min(attrs["3PT"], clamp(raw["3PT"], 25, 55))));
    } else {
      const shrunk = (pct * attempts + 0.34 * 75) / (attempts + 75);
      let ceiling = clamp(42 + 58 * unit((shrunk - 0.22) / 0.2) + 4 * unit(attempts / 400));
      if (attempts < 75 || s.a3! < 1) ceiling = Math.min(ceiling, 80);
      if (pct < 0.28) ceiling = Math.min(ceiling, 62);
      attrs["3PT"] =
        attempts >= 75
          ? Math.min(ceiling, Math.round(0.35 * attrs["3PT"] + 0.65 * (ceiling - 2)))
          : Math.min(Math.max(attrs["3PT"], floor), ceiling);
    }
  }
  // Free throws are directly observed; a peak roster must not erase an actual poor FT season.
  if (s.ft !== null && s.ft !== undefined) {
    const observed = clamp(25 + 74 * unit((s.ft - 0.3) / 0.65));
    attrs.FT = clamp(0.85 * observed + 0.15 * attrs.FT);
  }
  const quality = profileQuality("nba", line.pos[0], attrs),
    rankShape = nbaRosterScale(base);
  const blend =
    0.3 * rankShape + 0.7 * (quality + 4 + (POSITION_OFFSET[line.pos[0]] ?? 0));
  let ovr = Math.min(
    blend,
    0.4 * blend + 0.6 * piecewise(line.rk.val ?? 0, ERA_CURVE),
  );
  if (ref) {
    const defenseStanding = goodDef
      ? Math.max(line.rk.reb ?? 0, line.rk.blk ?? 0, line.rk.stl ?? 0)
      : 0;
    const standing = Math.max(line.rk.val ?? 0, defenseStanding * 0.97);
    const target =
      ref.ovr -
      Math.max(0, 0.99 - standing) * 32 -
      Math.max(0, 24 - (s.mpg ?? 24)) * 0.7;
    ovr = ovr * (1 - 0.9 * nearPeak) + target * 0.9 * nearPeak;
  }
  // Honors may distinguish elite impact, but may never override the playable attribute ceiling.
  if (honors.has("MVP")) ovr = Math.max(ovr, 96);
  else if (honors.has("ALLNBA1")) ovr = Math.max(ovr, 91);
  else if (honors.has("ALLNBA2")) ovr = Math.max(ovr, 88);
  else if (honors.has("DPOY")) ovr = Math.max(ovr, 88);
  const mpg = s.mpg ?? 24;
  if (!honors.size && mpg < 15) ovr = Math.min(ovr, 68 + Math.max(0, mpg - 8));
  if (seasonRef) ovr = 0.88 * seasonRef.ovr + 0.12 * ovr;
  return {
    ovr: clamp(Math.min(ovr, quality + 8), 40),
    /** the same before rounding (the gold-share balance needs the fraction) */
    exact: Math.max(40, Math.min(99, Math.min(ovr, quality + 8))),
    attrs,
    source: seasonRef?.source ?? ref?.source,
  };
}
