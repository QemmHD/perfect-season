import { profileQuality } from "../src/ut/rating-quality";
// Implemented by Codex. Read-only audit of every edition; npm run audit:ratings writes JSON to stdout.
import { loadCards } from "../src/ut/cards";
import { rateCard } from "../src/ut/rate";
import { hooper } from "../src/game/hoops2/ratings";
import { nbaLineOf } from "../src/ut/rate";
import references from "../src/data/nba-rating-references.json";
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
  implementedBy: "Codex",
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
        r.ovr > profileQuality(sport, r.pos, r.attrs) + 10.51 ||
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
    season99AtLevel1: seasons.filter((c) => c.ovr === 99).length,
    season99AtLevel5: seasons.filter((c) => rateCard(c.line, 5).ovr === 99)
      .length,
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
