// Implemented by Codex. Season-supported attributes and position-supported overalls for EVERY NBA edition.
import references from "../data/nba-rating-references.json";
import type { CardLine } from "./types";
import { profileQuality } from "./rating-quality";
const refs = new Map(references.players.map((p) => [p.name, p]));
const clamp = (v: number, a = 25, b = 99) =>
  Math.max(a, Math.min(b, Math.round(v)));
const unit = (v: number) => Math.max(0, Math.min(1, v));
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
  const attrs = { ...raw },
    s = line.stats,
    honors = new Set(line.honors),
    big = ["C", "PF"].includes(line.pos[0]);
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
  // Percentages alone are noisy: shrink toward 34% with a 75-attempt prior, using the actual season sample.
  const attempts = (s.a3 ?? 0) * (line.games ?? s.g ?? 0),
    pct = s.fg3;
  if (line.season < 1980) {
    // No measured three-point season exists. Touch is an estimate and cannot invent elite modern range.
    attrs["3PT"] = Math.min(
      attrs["3PT"],
      clamp(38 + 40 * unit(((s.ft ?? 0.7) - 0.55) / 0.35), 35, 78),
    );
  } else if (pct === null || pct === undefined || (s.a3 ?? 0) < 0.3) {
    attrs["3PT"] = Math.min(attrs["3PT"], clamp(raw["3PT"], 25, 55));
  } else {
    const shrunk = (pct * attempts + 0.34 * 75) / (attempts + 75);
    let ceiling = clamp(40 + 60 * unit((shrunk - 0.2) / 0.24) + 3);
    if (attempts < 75 || s.a3! < 1) ceiling = Math.min(ceiling, 78);
    if (pct < 0.28) ceiling = Math.min(ceiling, 60);
    attrs["3PT"] = Math.min(attrs["3PT"], ceiling);
  }
  // Free throws are directly observed; a peak roster must not erase an actual poor FT season.
  if (s.ft !== null && s.ft !== undefined) {
    const observed = clamp(25 + 74 * unit((s.ft - 0.3) / 0.65));
    attrs.FT = clamp(0.85 * observed + 0.15 * attrs.FT);
  }
  const quality = profileQuality("nba", line.pos[0], attrs),
    rankShape = nbaRosterScale(base);
  let ovr = 0.3 * rankShape + 0.7 * (quality + 4);
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
  return {
    ovr: clamp(Math.min(ovr, quality + 8), 40),
    attrs,
    source: ref?.source,
  };
}
