// Implemented by Codex. Overall must be supported by the attributes used in the actual match.
import type { UtSport } from "./types";
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
  return sport === "nba" ? (NBA[pos] ?? NBA.SF) : (NFL[group(pos)] ?? NFL.WR);
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
/** Higher editions improve signature strengths; a pocket passer or non-shooter retains that identity. */
export function editionAttributes(
  base: Record<string, number>,
  amount: number,
  cap: number,
  special: boolean,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(base).map(([code, value]) => {
      let gain = amount;
      if (special) {
        gain *= value < 65 ? 0.12 : value < 80 ? 0.5 : 1;
        if (["SPD", "ACC", "AGI", "VRT"].includes(code))
          gain = Math.min(amount >= 14 ? 6 : 4, gain);
        if (code === "FT") gain = Math.min(4, gain);
      } else if (value < 55) gain = Math.min(2, amount * 0.3);
      return [code, Math.max(1, Math.min(cap, Math.round(value + gain)))];
    }),
  );
}

/** Numbered editions raise proven signature skills enough to earn their tier, never every weak attribute. */
export function supportEdition(
  sport: UtSport,
  pos: string,
  attrs: Record<string, number>,
  cap: number,
  minimum: number,
): Record<string, number> {
  const out = { ...attrs },
    weights = roleWeights(sport, pos);
  const strong = Object.keys(out).filter(
    (k) =>
      (weights[k] ?? 0) >= 0.075 &&
      out[k] >= 75 &&
      !["SPD", "ACC", "AGI", "VRT", "FT", "STA"].includes(k),
  );
  for (
    let step = 0;
    step < 400 && profileQuality(sport, pos, out) + 8 < minimum - 0.49;
    step++
  ) {
    const eligible = strong
      .filter((k) => out[k] < cap)
      .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0) || out[b] - out[a]);
    if (!eligible.length) break;
    out[eligible[step % eligible.length]]++;
  }
  return out;
}
