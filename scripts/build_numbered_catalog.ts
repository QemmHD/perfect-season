// Implemented by Codex: frozen eligibility, including upgrades that first cross 90 OVR.
// Claude (packs-1, 2026-11-10): `--check` (npx vite-node scripts/build_numbered_catalog.ts -- --check)
// builds the catalogs in memory and compares them with the committed files, writing nothing. Eligibility
// is frozen: a rating change that moves a card across 90 is reported here, and the files are never
// regenerated to follow it (docs/CARD-CIRCULATION.md, docs/studio-overhaul/packs.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCards } from '../src/ut/cards';
import { rateCard } from '../src/ut/rate';
import { digest } from '../src/ut/packs-suites/snapshot';

const check = process.argv.includes('--check');
const server: Record<string, Record<string, number>> = {};
let differs = false;
for (const sport of ['nba', 'nfl'] as const) {
  const out: Record<string, number> = {};
  for (const line of (await loadCards(sport)).lines)
    for (let level = 1; level <= 5; level++) {
      if (rateCard(line, level).ovr >= 90) {
        out[line.id] = level;
        break;
      }
    }
  server[sport] = out;
  const file = new URL(`../src/data/numbered-${sport}.json`, import.meta.url);
  if (check) {
    const committed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>;
    const added = Object.keys(out).filter((id) => !(id in committed));
    const gone = Object.keys(committed).filter((id) => !(id in out));
    const moved = Object.keys(out).filter((id) => id in committed && committed[id] !== out[id]);
    const same = !added.length && !gone.length && !moved.length;
    differs ||= !same;
    console.log(sport, 'committed', digest(JSON.stringify(committed)), 'generated', digest(JSON.stringify(out)), same ? 'match' : 'DIFFERS: +' + added.length + ' new 90+, -' + gone.length + ' no longer 90+, ' + moved.length + ' at another level', added.slice(0, 5), gone.slice(0, 5), moved.slice(0, 5));
  } else {
    writeFileSync(file, JSON.stringify(out) + '\n');
    console.log(sport, Object.keys(out).length);
  }
}
if (check) process.exitCode = differs ? 1 : 0;
else writeFileSync(new URL('../supabase/functions/card-registry/numbered.json', import.meta.url), JSON.stringify(server) + '\n');
