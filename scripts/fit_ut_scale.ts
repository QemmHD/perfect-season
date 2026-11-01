// Claude ratings rework (2026-11-01): fits UT_SCALE[sport].curve (src/ut/ut-scale.ts) — the displayed
// UT overall for each rating-scale overall — to the EA FC 27-style pyramid below, from the pool's
// season cards. Read-only: prints the knots to paste into ut-scale.ts.
// Run: npx vite-node scripts/fit_ut_scale.ts [nba|nfl]  (then re-run scripts/fit_ut_balance.ts)
import { loadCards } from '../src/ut/cards';
import { rateCard } from '../src/ut/rate';
import type { UtSport } from '../src/ut/types';

const sport = (process.argv[2] ?? process.env.PS_SPORT ?? 'nba') as UtSport;
/** displayed overall → share of season cards at or above it */
const PYRAMID: [number, number][] = [
  [91, 0.00015],
  [90, 0.0006],
  [89, 0.0015],
  [88, 0.003],
  [87, 0.006],
  [86, 0.011],
  [85, 0.018],
  [84, 0.027],
  [83, 0.04],
  [80, 0.1],
  [75, 0.3],
  [65, 0.65],
];
const raw = (await loadCards(sport)).lines
  .filter((l) => l.kind === 'season')
  .map((l) => rateCard(l).rawExact!)
  .sort((a, b) => b - a);
const n = raw.length;
const knots: [number, number][] = [[raw[n - 1] - 0.01, 39.5]];
// a display value starts at the rating-scale value whose share at-or-above is nearest its target
for (const [shown, share] of PYRAMID.slice().reverse()) {
  // the boundary sits between the last card in and the first card out (unrounded overalls)
  const i = Math.max(0, Math.min(n - 2, Math.round(share * n) - 1));
  const k: [number, number] = [(raw[i] + raw[i + 1]) / 2, shown - 0.5];
  while (knots.length && knots[knots.length - 1][0] >= k[0]) knots.pop();
  knots.push(k);
}
knots.push([99, 91]);
const show = (r: number) => {
  for (let i = 1; i < knots.length; i++) if (r <= knots[i][0]) return Math.round(knots[i - 1][1] + ((r - knots[i - 1][0]) * (knots[i][1] - knots[i - 1][1])) / (knots[i][0] - knots[i - 1][0]));
  return 91;
};
const counts: Record<number, number> = {};
for (const r of raw) counts[show(r)] = (counts[show(r)] ?? 0) + 1;
console.error(sport, 'season cards', n, 'per displayed overall (75+):', Object.entries(counts).filter(([k]) => +k >= 75).map(([k, v]) => k + ':' + v).join(' '));
console.error('bronze/silver/gold %:', [raw.filter((r) => show(r) < 65).length, raw.filter((r) => show(r) >= 65 && show(r) < 75).length, raw.filter((r) => show(r) >= 75).length].map((x) => ((100 * x) / n).toFixed(1)).join(' / '));
console.log(JSON.stringify(knots.map(([a, b]) => [Math.round(a * 1000) / 1000, b])));
