// Claude (packs-4 review fixes, 2026-11-17): how every published chance is written, in a module of its own
// so the pack definitions (packs.ts, live-packs.ts, first paint) write their blurbs with the same rule as
// the odds sheets (odds.ts re-exports both) without pulling the odds engine into the first-paint bundle.

/**
 * A chance as the sheets write it: under 0.1% reads "less than 0.1%", 99.5% and up "100%", one decimal
 * below 10% and whole numbers above. A chance of exactly 0 reads "0%".
 */
export function fmtPct(p: number): string {
  if (!(p > 0)) return '0%';
  if (p < 0.001) return 'less than 0.1%';
  if (p >= 0.995) return '100%';
  const x = Math.round(p * 1000) / 10;
  return x < 10 ? x.toFixed(1) + '%' : Math.round(p * 100) + '%';
}

/** "1 in 2,000" for a chance under 1% (null above, where the percentage says enough). */
export function oneIn(p: number): string | null {
  if (!(p > 0) || p >= 0.01) return null;
  const n = 1 / p;
  const r = n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
  return '1 in ' + r.toLocaleString('en-US');
}
