// Implemented by Codex. Read-only audit of every edition; npm run audit:ratings writes JSON to stdout.
import { loadCards } from '../src/ut/cards';
import { rateCard } from '../src/ut/rate';
import { hooper } from '../src/game/hoops2/ratings';
import { nbaLineOf } from '../src/ut/rate';
import references from '../src/data/nba-rating-references.json';
const cases: Record<string, [string, number][]> = {
  nba: [
    ['Michael Jordan', 1996],
    ['LeBron James', 2013],
    ['Kobe Bryant', 2006],
    ['Scottie Pippen', 1996],
    ['Stephen Curry', 2016],
    ["Shaquille O'Neal", 2000],
    ['Tim Duncan', 2003],
    ['Larry Bird', 1986],
    ['Magic Johnson', 1987],
    ['Dennis Rodman', 1996],
  ],
  nfl: [
    ['Tom Brady', 2007],
    ['Jerry Rice', 1995],
    ['Randy Moss', 2007],
    ['Barry Sanders', 1997],
    ['Peyton Manning', 2013],
    ['Rob Gronkowski', 2011],
  ],
};
const report: Record<string, unknown> = {
  implementedBy: 'Codex',
  referenceSnapshot: references.checkedAt,
  publicPeakReferences: references.players.length,
  methodology: 'docs/RATINGS-AUDIT.md',
};
for (const sport of ['nba', 'nfl'] as const) {
  const data = await loadCards(sport),
    cards = data.lines.map((l) => rateCard(l)),
    seasons = cards.filter((c) => c.line.kind === 'season'),
    invalid: string[] = [];
  for (const rc of cards)
    for (const level of [1, 5]) {
      const r = level === 1 ? rc : rateCard(rc.line, 5);
      const cap = r.tier === 'goat' ? 110 : r.tier === 'spotlight' ? 105 : 99;
      if (!Number.isFinite(r.ovr) || r.ovr < 1 || r.ovr > cap || Object.values(r.attrs).some((v) => !Number.isFinite(v) || v < 1 || v > cap))
        invalid.push(r.line.id + ':level' + level);
    }
  const sorted = seasons.map((c) => c.ovr).sort((a, b) => a - b);
  report[sport] = {
    seasonCards: seasons.length,
    allEditions: cards.length,
    tiers: Object.fromEntries(['bronze', 'silver', 'gold', 'promo', 'legend', 'spotlight', 'goat'].map((t) => [t, cards.filter((c) => c.tier === t).length])),
    seasonOverallPercentiles: Object.fromEntries([0, 10, 25, 50, 75, 90, 100].map((q) => [q, sorted[Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length))]])),
    invalid,
    spotChecks: cases[sport].map(([name, year]) => {
      const rc = seasons.find((c) => c.line.name === name && c.line.season === year)!;
      return {
        name,
        season: year,
        ovr: rc.ovr,
        attrs: rc.attrs,
        source: rc.ratingSource,
        ...(sport === 'nba' ? { originalOverall: hooper(nbaLineOf(rc.line), rc.pos, rc.line.num).ovr } : {}),
      };
    }),
  };
  if (invalid.length) process.exitCode = 1;
}
console.log(JSON.stringify(report, null, 2));
