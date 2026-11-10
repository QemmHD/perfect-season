// Claude (packs-1, 2026-11-10): write the packs "before" fixture for this sport.
//   PS_SPORT=nba npx vite-node scripts/packs/snapshot.ts            → src/ut/__fixtures__/packs-before/nba.json
//   PS_SPORT=nba npx vite-node scripts/packs/snapshot.ts -- --check → compare with the committed file, write nothing
// The fixture is taken once, on the untouched base (docs/studio-overhaul/packs.md); the packs-economy suite
// checks every later commit against it. Re-take it only through the packs-10 re-baseline kit, after review.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getPool } from '../../src/ut/pool';
import { diffSnapshot, takeSnapshot, type PacksSnapshot } from '../../src/ut/packs-suites/snapshot';

const pool = await getPool();
const snap = takeSnapshot(pool);
const file = new URL('../../src/ut/__fixtures__/packs-before/' + pool.sport + '.json', import.meta.url);
// one rating row per line, so a later diff of the file reads by card
const text =
  '{\n' +
  Object.entries(snap)
    .map(([k, v]) =>
      k === 'ratings'
        ? JSON.stringify(k) + ': {\n' + Object.entries(v as Record<string, Record<string, string>>).map(([kind, rows]) => JSON.stringify(kind) + ': {\n' + Object.entries(rows).map(([id, r]) => JSON.stringify(id) + ': ' + JSON.stringify(r)).join(',\n') + '\n}').join(',\n') + '\n}'
        : JSON.stringify(k) + ': ' + JSON.stringify(v)
    )
    .join(',\n') +
  '\n}\n';
if (process.argv.includes('--check')) {
  if (!existsSync(file)) throw new Error('No committed fixture for ' + pool.sport);
  const committed = JSON.parse(readFileSync(file, 'utf8')) as PacksSnapshot;
  const d = diffSnapshot(committed, snap);
  console.log(pool.sport, Object.keys(d).length ? 'differs: ' + JSON.stringify(d, null, 1) : 'matches the committed fixture');
} else {
  writeFileSync(file, text);
  const n = Object.values(snap.ratings).reduce((a, r) => a + Object.keys(r).length, 0);
  console.log(pool.sport, 'wrote', n, 'edition rows,', Object.keys(snap.sbcs).length, 'SBC days,', snap.receipts.length, 'receipts,', Object.keys(snap.started).length, 'started entries,', (text.length / 1024).toFixed(1), 'KB; foreign', snap.foreignFingerprint);
}
