// Implemented by Codex: frozen eligibility, including upgrades that first cross 90 OVR.
import { writeFileSync } from 'node:fs';
import { loadCards } from '../src/ut/cards';
import { rateCard } from '../src/ut/rate';
const server: Record<string, Record<string, number>> = {};
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
  writeFileSync(new URL(`../src/data/numbered-${sport}.json`, import.meta.url), JSON.stringify(out) + '\n');
  console.log(sport, Object.keys(out).length);
}
writeFileSync(new URL('../supabase/functions/card-registry/numbered.json', import.meta.url), JSON.stringify(server) + '\n');
