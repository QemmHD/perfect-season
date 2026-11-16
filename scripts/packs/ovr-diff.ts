// Claude (packs-1, 2026-11-10): every special edition's displayed overall, before (the committed packs
// fixture, src/ut/__fixtures__/packs-before/<sport>.json) against now, at levels 1-5. packs-5 publishes it
// as the re-rate's list of changed overalls (owner decision 5: document every change to a displayed overall).
//   PACKS_OUT=<dir> PACKSIM_LABEL=after-packs-5 PS_SPORT=nba npx vite-node scripts/packs/ovr-diff.ts
// Writes ovr-diff-<sport>.json (every changed id) and ovr-diff-<sport>.md (counts by kind and delta, the
// rows that cross 90 — numbered eligibility is frozen, so those go to the lead — and every changed row).
import { readFileSync } from 'node:fs';
import { getPool } from '../../src/ut/pool';
import { parseRow, ratingRow, rowsOf, SNAPSHOT_KINDS, snapshotEditions, type PacksSnapshot } from '../../src/ut/packs-suites/snapshot';
import { writeOut } from './out';

const pool = await getPool();
const sport = pool.sport;
const before = JSON.parse(readFileSync(new URL('../../src/ut/__fixtures__/packs-before/' + sport + '.json', import.meta.url), 'utf8')) as PacksSnapshot;
const now = snapshotEditions(pool);
interface Row { id: string; name: string; kind: string; tierBefore: string; tierNow: string; before: number[]; now: number[]; delta: number; crosses90: boolean }
const changed: Row[] = [];
const counts: Record<string, Record<string, number>> = {};
let missing = 0;
let added = 0;
for (const kind of SNAPSHOT_KINDS) {
  const old = rowsOf(before, kind);
  const cur = new Map(now[kind].map((rc) => [rc.line.id, rc]));
  for (const id of old.keys()) if (!cur.has(id) && !pool.base.get(id)) missing++;
  for (const [id, rc] of cur) {
    const was = old.get(id);
    if (!was) {
      added++;
      continue;
    }
    const a = parseRow(was, kind);
    const b = parseRow(ratingRow(pool, rc, kind), kind);
    const delta = b.ovr[0] - a.ovr[0];
    const k = (counts[kind] ??= {});
    k[delta] = (k[delta] ?? 0) + 1;
    if (delta === 0 && a.ovr.join() === b.ovr.join() && a.tier === b.tier) continue;
    changed.push({ id, name: rc.line.name + ' ' + rc.line.season, kind, tierBefore: a.tier, tierNow: b.tier, before: a.ovr, now: b.ovr, delta, crosses90: a.ovr.some((o, i) => (o >= 90) !== (b.ovr[i] >= 90)) });
  }
}
changed.sort((x, y) => x.kind.localeCompare(y.kind) || x.delta - y.delta || (x.id < y.id ? -1 : 1));
const md = [
  '# Displayed overall changes, ' + sport + ' (before = the packs-1 fixture)',
  '',
  'Rows compared: ' + SNAPSHOT_KINDS.map((k) => k + ' ' + now[k].length).join(', ') + '. Changed: ' + changed.length + '. Crossing 90 at some level: ' + changed.filter((r) => r.crosses90).length + '. In the fixture but no longer resolvable: ' + missing + '. New ids: ' + added + '.',
  '',
  '| Kind | ' + 'Δ L1 → count |',
  '|---|---|',
  ...SNAPSHOT_KINDS.filter((k) => counts[k]).map((k) => '| ' + k + ' | ' + Object.entries(counts[k]).sort((a, b) => +a[0] - +b[0]).map(([d, n]) => (+d > 0 ? '+' : '') + d + ': ' + n).join(', ') + ' |'),
  '',
  ...(changed.length ? ['| Card | Id | Kind | Tier | L1..L5 before | L1..L5 now | Δ | 90 |', '|---|---|---|---|---|---|---|---|', ...changed.map((r) => '| ' + r.name + ' | `' + r.id + '` | ' + r.kind + ' | ' + (r.tierBefore === r.tierNow ? r.tierNow : r.tierBefore + ' → ' + r.tierNow) + ' | ' + r.before.join(' ') + ' | ' + r.now.join(' ') + ' | ' + (r.delta > 0 ? '+' : '') + r.delta + ' | ' + (r.crosses90 ? 'crosses' : '') + ' |')] : ['No displayed overall changed.']),
  '',
].join('\n');
writeOut('ovr-diff-' + sport + '.json', { sport, counts, changed, missing, added });
console.log(sport, 'changed', changed.length, 'crossing 90', changed.filter((r) => r.crosses90).length, 'missing', missing, 'new', added, '→', writeOut('ovr-diff-' + sport + '.md', md));
