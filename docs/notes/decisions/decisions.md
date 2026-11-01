# Decisions log

Product and engineering decisions taken during the 2026-11-01 season update, with the reason where it isn't obvious. Add new decisions at the bottom with a date.

## Saves and economy

- **No account reset.** Displayed overalls and tiers may change; owned cards, coins, levels, XP, serials and squads do not. Existing players get the one-time New Era bundle (Legend pick at 88+ on the new scale + 65,000 coins), claimed exactly once.
- **New Era 65,000 coins honoured** as the owner asked, even though it is large against the game's 60/30-per-match coin scale.
- **Coins only.** Every pack and offer costs in-game coins; there is no real-money purchase anywhere.
- Economy targets copy FC's ratios on our own coin scale: pack value (quick-sell / Item Score) 45–60% of price.

## Ratings

- **Two overalls.** `rawOvr` stays on the 2K/Madden-comparable rating scale (comparisons, numbering, gameplay); the shown overall goes through one FC 27-style display scale (`src/ut/ut-scale.ts`): Bronze 40–64, Silver 65–74, Gold 75–99, walkout 86+.
- **Spotlight/GOAT stay above 99** as registered numbered ultra-rares; don't devalue owned copies.
- **2K/Madden reference ratings** for NBA/NFL follow the existing precedent (risk noted to the owner). **No EA FC ratings for soccer:** soccer has its own ratings model built from match facts.
- **Do not regenerate the numbered-eligibility files** (`src/data/numbered-*.json`, the card-registry `numbered.json`): that would un-number owned cards.

## Online compatibility

- A rating change alters `pool.print`, which splits the Ultimate Team online queue automatically.
- An engine rule change needs explicit `DRAFT_RULES` / `UT_RULES` bumps. This release: draft NBA 10 / NFL 10, UT NBA 10 / NFL 11; soccer draft and UT queues start at 1.
- `SPOTLIGHT_RATES` (the server contract) is unchanged; all new packs open locally on the device.

## Content calendar

- Season names avoid league marks: "Summer League" became **Summer Run**, "All-Star Break" became **Midseason Stars**.
- The **Perfect Season Finale (98–99) is SBC-only**, with no pack slot.
- The **card pool is frozen for year one**: no new-season card data rebuild, so no extra queue splits.
- After the planned year, seasons 2–12 repeat shifted by 364 days with new promo IDs, so content never stops.

## Builds and testing

- The owner test page builds with `vite build --mode testpage`; Spotlight rolls locally there only.
- Vitest's default 5 s timeout can trip under machine load; pool-loading tests got longer timeouts. Run the final QA with few other jobs running.
