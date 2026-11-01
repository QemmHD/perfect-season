// Claude ratings rework (2026-11-01): compacts an NFL Combine join (player id → forty, 3-cone, vertical,
// combine year) into src/data/nfl-combine.json for Ultimate Team football athleticism.
// Sources: nflverse combine data (CC-BY 4.0, data from Pro-Football-Reference); 1987–98 hand-timed
// results (nflcombineresults.com via the josedv82 dataset, facts only) get the usual +0.06 s
// hand-timing correction. Usage: node scripts/build_nfl_combine.mjs <join.json>
import { readFileSync, writeFileSync } from 'node:fs';
const join = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rows = {};
for (const [pid, r] of Object.entries(join)) {
  if (typeof r.forty !== 'number' && typeof r.cone !== 'number') continue;
  const hand = /hand-timed/.test(r.src ?? '');
  const forty = typeof r.forty === 'number' ? Math.round((r.forty + (hand ? 0.06 : 0)) * 100) / 100 : null;
  rows[pid] = [forty, typeof r.cone === 'number' ? r.cone : null, typeof r.vert === 'number' ? r.vert : null, r.year ?? null];
}
const out = {
  source: 'nflverse combine (CC-BY 4.0, data from Pro-Football-Reference); 1987–98 hand-timed results from nflcombineresults.com (+0.06 s)',
  columns: ['forty', 'cone', 'vert', 'year'],
  rows,
};
writeFileSync(new URL('../src/data/nfl-combine.json', import.meta.url), JSON.stringify(out));
console.log('players', Object.keys(rows).length);
