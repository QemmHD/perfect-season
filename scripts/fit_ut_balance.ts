// Claude ratings rework (2026-11-01): fits OVR_BALANCE in src/ut/rate.ts so every basketball
// position × decade and every football position group has a similar share of gold season cards.
// Shifts are bounded to ±4 (kickers +6) so no season moves far from its same-era benchmark.
// Read-only: prints the table to paste into rate.ts. Run: npx vite-node scripts/fit_ut_balance.ts [nba|nfl]
import { loadCards } from '../src/ut/cards';
import { OVR_BALANCE, balanceKey, rateCard, TIER_CUTS } from '../src/ut/rate';
import type { UtSport } from '../src/ut/types';

const sport = (process.argv[2] ?? process.env.PS_SPORT ?? 'nba') as UtSport;
/** gold share target per group (the FC-style scale: gold ≈30% of season cards); kickers a little lower */
const TARGET = (key: string) => (key === 'K' ? 0.25 : +(process.env.GOLD_SHARE ?? 0.3));
const lines = (await loadCards(sport)).lines.filter((l) => l.kind === 'season');
const keys = [...new Set(lines.map((l) => balanceKey(l)))].sort();
const lo: Record<string, number> = {},
  hi: Record<string, number> = {};
for (const k of keys) [lo[k], hi[k]] = [-4, k === 'K' ? 6 : 4];
const table = OVR_BALANCE[sport];
for (const k of Object.keys(table)) delete table[k];
const share = () => {
  const n: Record<string, [number, number]> = {};
  for (const l of lines) {
    const k = balanceKey(l);
    const a = (n[k] ??= [0, 0]);
    a[0]++;
    if (rateCard(l).ovr >= TIER_CUTS[sport].gold) a[1]++;
  }
  return Object.fromEntries(Object.entries(n).map(([k, [all, gold]]) => [k, gold / all]));
};
for (let it = 0; it < 12; it++) {
  for (const k of keys) table[k] = (lo[k] + hi[k]) / 2;
  const s = share();
  for (const k of keys) (s[k] < TARGET(k) ? lo : hi)[k] = table[k];
  console.error('iteration', it, keys.map((k) => `${k} ${table[k].toFixed(2)} ${(100 * s[k]).toFixed(1)}%`).join(' | '));
}
// the share jumps where many seasons sit on one value (honors-only pre-1999 football lines): keep
// whichever bracket end lands nearer the target
const round = (x: number) => Math.round(x * 1000) / 1000;
for (const k of keys) table[k] = round(lo[k]);
const sLo = share();
for (const k of keys) table[k] = round(hi[k]);
const sHi = share();
for (const k of keys) table[k] = Math.abs(sLo[k] - TARGET(k)) <= Math.abs(sHi[k] - TARGET(k)) ? round(lo[k]) : round(hi[k]);
const s = share();
console.error('final', keys.map((k) => `${k} ${(100 * s[k]).toFixed(1)}%`).join(' | '));
console.log(JSON.stringify(Object.fromEntries(keys.filter((k) => table[k]).map((k) => [k, table[k]]))));
