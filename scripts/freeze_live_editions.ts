// Claude, 2026-11-01 (wave 3): freezes every scheduled Live Calendar promo's selection into
// src/data/live-editions.json, so later rating tweaks can never reshuffle a program's players.
// Append-only: an existing entry is kept as it is; the script fails if a frozen id would change.
//   npx vite-node scripts/freeze_live_editions.ts            (all scheduled promos)
//   npx vite-node scripts/freeze_live_editions.ts --check    (verify only, write nothing)
import fs from 'node:fs';
import path from 'node:path';
import { loadSchedule, setManifest } from '../src/ut/calendar';
import { loadCards } from '../src/ut/cards';
import { selectPromo } from '../src/ut/live-cards';
import { buildPool } from '../src/ut/pool';
import type { UtSport } from '../src/ut/types';

const FILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/data/live-editions.json');
type Manifest = Record<string, Partial<Record<UtSport, [string, number][]>>>;

const check = process.argv.includes('--check');
const sch = await loadSchedule();
const old: Manifest = JSON.parse(fs.readFileSync(FILE, 'utf8'));
// select fresh (the manifest must not feed its own regeneration)
setManifest({});
const next: Manifest = JSON.parse(JSON.stringify(old));
let added = 0;
for (const sport of ['nba', 'nfl'] as UtSport[]) {
  const cards = await loadCards(sport);
  const pool = buildPool(sport, cards.lines, cards.byId);
  for (const season of sch.seasons)
    for (const promo of season.promos) {
      const sel = selectPromo(pool, promo.id).map((s) => [s.id, s.wave] as [string, number]);
      const frozen = old[promo.id]?.[sport];
      if (frozen) {
        if (JSON.stringify(frozen) !== JSON.stringify(sel)) console.log('kept frozen (selection would now differ):', sport, promo.id);
        continue;
      }
      if (!sel.length) continue;
      (next[promo.id] ??= {})[sport] = sel;
      added++;
    }
}
for (const [id, e] of Object.entries(old))
  for (const sport of ['nba', 'nfl'] as UtSport[]) if (e[sport] && JSON.stringify(next[id]?.[sport]) !== JSON.stringify(e[sport])) throw new Error('refusing to change frozen ' + id + ' ' + sport);
console.log((check ? 'would add ' : 'added ') + added + ' promo selections; ' + Object.keys(next).length + ' promos frozen');
if (!check) fs.writeFileSync(FILE, JSON.stringify(next) + '\n');
