import { profileQuality } from "../src/ut/rating-quality";
// Implemented by Codex. Read-only audit of every edition; npm run audit:ratings writes JSON to stdout.
import { loadCards } from "../src/ut/cards";
import { rateCard } from "../src/ut/rate";
import { hooper } from "../src/game/hoops2/ratings";
import { nbaLineOf } from "../src/ut/rate";
import references from "../src/data/nba-rating-references.json";
import { faceWeights } from "../src/ut/card-face";
import type { RatedCard } from "../src/ut/types";
/** the displayed face's position-weighted mean (what the displayed overall must stay near) */
const shownFace = (sport: "nba" | "nfl", r: RatedCard) => {
  const w = faceWeights(sport, sport === "nba" ? r.line.pos[0] : r.pos, r.attrs);
  let n = 0, t = 0;
  for (const [k, , v] of r.face ?? r.key) { n += (w[k] ?? 0) * v; t += w[k] ?? 0; }
  return t ? n / t : r.ovr;
};
import { groupOf } from "../src/game/football2/ratings";
const cases: Record<string, [string, number][]> = {
  nba: [
    ["Michael Jordan", 1996],
    ["LeBron James", 2013],
    ["Kobe Bryant", 2006],
    ["Scottie Pippen", 1996],
    ["Stephen Curry", 2016],
    ["Shaquille O'Neal", 2000],
    ["Tim Duncan", 2003],
    ["Larry Bird", 1986],
    ["Magic Johnson", 1987],
    ["Dennis Rodman", 1996],
    ["Bob Rule", 1969],
    ["Neal Walk", 1973],
    ["Steve Nash", 2006],
    ["Tracy McGrady", 2003],
    ["Kobe Bryant", 2016],
    ["Nikola Jokić", 2024],
    ["Giannis Antetokounmpo", 2024],
    ["Stephen Curry", 2010],
  ],
  nfl: [
    ["Tom Brady", 2007],
    ["Jerry Rice", 1995],
    ["Randy Moss", 2007],
    ["Barry Sanders", 1997],
    ["Peyton Manning", 2013],
    ["Rob Gronkowski", 2011],
    ["Patrick Mahomes", 2022],
    ["Josh Allen", 2023],
    ["Tom Brady", 2021],
    ["Aaron Donald", 2022],
  ],
};
const report: Record<string, unknown> = {
  implementedBy: "Codex; Claude ratings rework 2026-11-01",
  referenceSnapshot: references.checkedAt,
  publicPeakReferences: references.players.length,
  methodology: "docs/RATINGS-AUDIT.md",
};
for (const sport of ["nba", "nfl"] as const) {
  const data = await loadCards(sport),
    cards = data.lines.map((l) => rateCard(l)),
    seasons = cards.filter((c) => c.line.kind === "season"),
    invalid: string[] = [];
  for (const rc of cards)
    for (const level of [1, 5]) {
      const r = level === 1 ? rc : rateCard(rc.line, 5);
      const cap = r.tier === "goat" ? 110 : r.tier === "spotlight" ? 105 : 99;
      if (
        !Number.isFinite(r.ovr) ||
        r.ovr < 1 ||
        r.ovr > cap ||
        Object.values(r.attrs).some(
          (v) => !Number.isFinite(v) || v < 1 || v > cap,
        ) ||
        // Claude rework: standard editions must read like their face (levels deliberately lift the key
        // attributes more than the overall); specials keep the Codex support bound
        (r.tier === "spotlight" || r.tier === "goat"
          ? r.ovr > profileQuality(sport, r.pos, r.attrs) + 10.51
          : level === 1 && Math.abs(r.ovr - shownFace(sport, r)) > 8) ||
        (r.tier === "spotlight" && r.ovr < 100) ||
        (r.tier === "goat" && r.ovr < 106)
      )
        invalid.push(r.line.id + ":level" + level);
    }
  const sorted = seasons.map((c) => c.ovr).sort((a, b) => a - b);
  report[sport] = {
    seasonCards: seasons.length,
    seasonBenchmarkedCards: seasons.filter(c => c.line.ratingReference).length,
    benchmarkedEditions: cards.filter(c => c.line.ratingReference).length,
    seasonBenchmarkPlayers: new Set(seasons.filter(c => c.line.ratingReference).map(c => c.line.pid)).size,
    seasonBenchmarkPlayerSeasons: new Set(seasons.filter(c => c.line.ratingReference).map(c => c.line.pid + ':' + c.line.season)).size,
    estimateOnlySeasonCards: seasons.filter(c => !c.line.ratingReference).length,
    peakAnchoredSeasonCards: seasons.filter(c => !c.line.ratingReference && c.ratingSource).length,
    allEditions: cards.length,
    tiers: Object.fromEntries(
      ["bronze", "silver", "gold", "promo", "legend", "spotlight", "goat"].map(
        (t) => [t, cards.filter((c) => c.tier === t).length],
      ),
    ),
    seasonOverallPercentiles: Object.fromEntries(
      [0, 10, 25, 50, 75, 90, 100].map((q) => [
        q,
        sorted[
          Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length))
        ],
      ]),
    ),
    // rating scale (2K/Madden-comparable); the displayed UT scale tops out at 91 for season cards
    season99AtLevel1: seasons.filter((c) => c.rawOvr === 99).length,
    season99AtLevel5: seasons.filter((c) => rateCard(c.line, 5).rawOvr === 99)
      .length,
    displayed90PlusSeasonCards: seasons.filter((c) => c.ovr >= 90).length,
    displayedSeasonMax: Math.max(...seasons.map((c) => c.ovr)),
    goldShareByPosition: Object.fromEntries(
      [...new Set(seasons.map((c) => (sport === "nba" ? c.line.pos[0] : groupOf(c.pos))))].map((g) => {
        const xs = seasons.filter((c) => (sport === "nba" ? c.line.pos[0] : groupOf(c.pos)) === g);
        return [g, +((100 * xs.filter((c) => c.tier === "gold").length) / xs.length).toFixed(1)];
      }),
    ),
    promoAt99: cards.filter((c) => c.tier === "promo" && c.ovr >= 99).length,
    legendAt99: cards.filter((c) => c.tier === "legend" && c.ovr >= 99).length,
    faceGapMedianByTier: Object.fromEntries(
      ["bronze", "silver", "gold", "promo", "legend"].map((t) => {
        const g = cards
          .filter((c) => c.tier === t)
          .map((c) => c.ovr - shownFace(sport, c))
          .sort((a, b) => a - b);
        return [t, +g[Math.floor(g.length / 2)].toFixed(1)];
      }),
    ),
    maximumLevel5OverallGain: Math.max(...seasons.filter((_, i) => i % 25 === 0).map((c) => rateCard(c.line, 5).ovr - c.ovr)),
    maximumOverallAboveRoleQuality: Math.max(
      ...cards.map((c) => c.ovr - profileQuality(sport, c.pos, c.attrs)),
    ),
    invalid,
    spotChecks: cases[sport].map(([name, year]) => {
      const rc = seasons.find(
        (c) => c.line.name === name && c.line.season === year,
      )!;
      return {
        name,
        season: year,
        ovr: rc.ovr,
        face: rc.face,
        attrs: rc.attrs,
        source: rc.ratingSource,
        benchmark: rc.line.ratingReference,
        ...(sport === "nba"
          ? {
              originalOverall: hooper(nbaLineOf(rc.line), rc.pos, rc.line.num)
                .ovr,
            }
          : {}),
      };
    }),
  };
  if (invalid.length) process.exitCode = 1;
}
console.log(JSON.stringify(report, null, 2));
