// Implemented by Codex. Run with npm run data:registry after changing edition generation.
import { writeFileSync } from 'node:fs';
import { loadCards } from '../src/ut/cards';
const catalog: Record<string, Record<string, string[]>> = {};
for (const sport of ['nba', 'nfl'] as const) {
  const p = await loadCards(sport);
  catalog[sport] = {};
  for (const tier of ['promo', 'legend', 'spotlight', 'goat'])
    catalog[sport][tier] = p.lines
      .filter((l) => l.kind === tier)
      .map((l) => l.id)
      .sort();
}
writeFileSync(new URL('../supabase/functions/card-registry/catalog.json', import.meta.url), JSON.stringify(catalog));
console.log(Object.fromEntries(Object.entries(catalog).map(([s, tiers]) => [s, Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, v.length]))])));
