# Ultimate Team ratings audit

**Implemented by Codex (OpenAI), 2026-10-28–2026-10-30.** The owner's request was to bring NBA ratings closer to 2K and correct player identities, overalls and stats without deleting or resetting owned cards.


## Current research revision — 2026-10-30

Codex added same-era benchmarks for **8,938 NBA** and **2,114 NFL unique player-seasons**, inherited by every derived edition of those cards. The compact generated snapshots load with their sport's UT catalog. NBA mappings respect the archive's launch-vs-updated roster basis; NFL mappings retain the explicit season and final published iteration date. Exact normalized player names, compatible positions and available height checks prevent speculative matches.

The remaining cards retain season/role estimates and available peak anchors. These are not exact official ratings for every historical season. [GAMEPLAY-RESEARCH.md](GAMEPLAY-RESEARCH.md) gives the source list, coverage table, blending rules, rejected matches, licenses, reproduction and actual engine changes. The updated [audit summary](ratings-audit-summary.json) validates all 54,324 editions at levels 1 and 5 with zero invalid entries.

## Coverage and references

The audit covers **21,304 NBA season cards** and **30,855 NFL season cards**, plus their special editions. All **54,324 editions** are checked at levels 1 and 5 for finite, bounded overalls/attributes. The committed [machine-readable summary](ratings-audit-summary.json) reports tier distributions, percentiles, player spot checks and invalid-entry lists.

[`nba-rating-references.json`](../src/data/nba-rating-references.json) contains factual attribute/overall snapshots from **372 public 2KRatings all-time player profiles**, refreshed 2026-10-29, with the source URL on every record. They are approximate peak anchors, not an official 2K roster for every historical season. Season cards remain estimates, with source-season statistics and honors preserved.

Examples of the source material: [Michael Jordan](https://www.2kratings.com/michael-jordan-all-time-chicago-bulls), [Scottie Pippen](https://www.2kratings.com/scottie-pippen-all-time-chicago-bulls), [LeBron James](https://www.2kratings.com/lebron-james-all-time-cleveland-cavaliers), [Kobe Bryant](https://www.2kratings.com/kobe-bryant-all-time-los-angeles-lakers).

## What changed

`CardLine` → original Hoops2 rating → **Codex `calibrateNba()`** → edition boost/level → `RatedCard` → `toHooper()` / actual gameplay. The card display and match consume the same resulting attributes.

- NBA season overalls move to a roster scale with Bronze below 75, Silver 75–84 and Gold 85+. The original percentile ordering and similar rarity mix are retained; `onScale()` maps challenge thresholds, and gold weighting accounts for the compressed upper rating range.
- Defensive honors contribute to defensive identity. Steals alone no longer make an ordinary guard an elite perimeter defender. Reference profiles help distinguish elite defenders, passers, finishers, shooters and rebounders.
- Known players are anchored more strongly in peak/award seasons and more lightly elsewhere, retaining season differences. Defensive specialists use defensive/value ranks rather than being penalized for low points per game.
- Efficient dunkers do not automatically become elite mid-range shooters. All-time references cannot invent a three-point game for a low-volume/poor-accuracy historical season. Physical and skill profiles are calibrated separately rather than boosting every attribute indiscriminately.
- NBA badges are recomputed from the actual final attributes. Spotlight/GOAT editions then improve that playable profile; only those new editions exceed 99.
- NFL card data are season totals, while `rateNfl()` expects per-game rates and efficiency fractions. The UT adapter now normalizes QB completion/INT/yardage rates, rushing yards and sacks; RB receiving volume/yards per carry; WR/TE yards per reception/catch rate. Pocket-QB acceleration/agility follow the corrected speed. Source totals are never overwritten. Draft inputs already use their own normalization.

## Representative original → revised season ratings

“Original” is baseline `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. These are estimates for the specified season, before edition and level boosts.

| Card | Attribute | Original | Revised |
| --- | --- | ---: | ---: |
| Michael Jordan 1996 | Mid-range | 84 | 96 |
| Michael Jordan 1996 | Close shot | 73 | 94 |
| LeBron James 2013 | Speed | 73 | 92 |
| Kobe Bryant 2006 | Mid-range | 81 | 95 |
| Scottie Pippen 1996 | Perimeter defense | 80 | 96 |
| Stephen Curry 2016 | Perimeter defense | 94 | 82 |
| Stephen Curry 2016 | Three-point shot | 98 | 99 |
| Shaquille O'Neal 2000 | Mid-range | 77 | 41 |
| Tim Duncan 2003 | Three-point shot | 45 | 45 |
| Dennis Rodman 1996 | Overall | 73 | 91 |
| Tom Brady 2007 | Speed | 95 | 62 |

The full summary includes additional attributes and source URLs. Differences from exact 2K releases are intentional where the public reference is an all-time roster, where the historical season differs, or where the underlying statistic needs a conservative estimate. The implementation does not claim official 2K/Madden endorsement or exact coverage of every release.

## Reproduce and maintain

- `npm run audit:ratings` prints the whole-pool audit as JSON; redirect it to `docs/ratings-audit-summary.json` when intentionally updating ratings.
- `python3 scripts/fetch_rating_references.py` refreshes factual public snapshots (optional `beautifulsoup4` dependency). Review source changes and gameplay/rarity implications before committing. It reads the original legend selections and caches fetched HTML outside the repo.
- `npm test` includes player-identity checks, full-pool bounds, edition boosts, actual over-99 movement/shooting, pack/economy checks, and compatibility tests in both sports.
- `pool.print` hashes attributes and abilities as well as IDs/overalls/tiers. Changes to the playable model therefore cannot silently pair different UT builds.

Never rename owned card IDs or rebuild player progress to apply a rating correction. Change the model and retain UIDs, levels, XP, collection history, pack receipts and registered serials.


## All-tier correction, 2026-10-29 — Codex

The owner's follow-up specifically covers **every card**, not only GOATs. All 54,324 editions are rerated through the same corrected model at every owned level; IDs, copies, XP, levels and raw source statistics stay intact.

The earlier audit missed overalls being driven by a percentile curve even when playable attributes were mediocre. Before this correction, 95 ordinary NBA cards started at 99; 1,078 started at 95+ and could reach 99 at level 5. For example, Bob Rule 1969 was 95 despite a much weaker playable profile. The all-tier correction ties overall to a position-weighted attribute profile, emphasizes actual specialist strengths and caps unsupported inflation. Big playmakers can use a creator's skill mix instead of being forced into rim-runner weights. This preserves high ratings for players such as Bird/Jokic/LeBron without requiring every unrelated skill to be elite.

Reference coverage increased from 111 to **372 players**. The refresh searches all available all-time team versions, chooses the highest overall and prefers the player's peak team on ties. It no longer takes the first team page found: Nash now uses Phoenix (96), McGrady Orlando (95), and Chris Paul New Orleans (97). Public profiles change over time; each frozen record retains its exact source URL. These are approximate reference anchors, not an official historical roster database.

Season three-point support uses actual accuracy, volume and games with a 75-attempt shrinkage prior. A tiny sample, no measured range or poor accuracy cannot inherit an all-time card's elite three-point rating. Observed free-throw accuracy has stronger influence. Unknown pre-tracking steals/blocks use conservative role priors instead of being treated as measured zeroes. Gus Johnson's historically documented power/athletic profile is a separately labeled curated estimate from his Hall of Fame biography, not a claimed 2K reference.

NFL season standing now weights the position's meaningful production and excludes draft selection as a substitute for performance. Tiny passing/rushing/receiving samples regress toward ordinary efficiency rather than creating 99s. Offensive line priors distinguish part-time players, full-time starters and honors without a first-round-pick bonus. A small explicitly estimated physical-archetype set preserves known identities such as Brady versus Vick; those numerical estimates are not advertised as official Madden ratings. Original draft-mode rating inputs/logic are unchanged; these adaptations apply to the Ultimate Team season-card path.

Edition boosts now improve strong, relevant skills, give smaller gains to secondary skills, and keep weak skills weak. Physical boosts are bounded and free throws retain a low baseline for poor shooters. The universal 96/100 key-attribute floors are removed. A 99+ edition raises its existing signature skills enough to support its premium overall, rather than adding elite stats to unrelated weaknesses. Badges in both sports are recomputed from the final attributes. The new ratings are used by the actual game engines and fingerprinted in UT matchmaking (rules version 3).

Reproduction: `npm run audit:ratings` now also reports base/upgraded 99 counts and the maximum gap between overall and role quality; unsupported overalls and underpowered numbered editions fail the whole-pool audit. `src/ut/ratings-audit.test.ts` covers ordinary inflation, weak season versus peak, Shaq/Curry/Jordan shooting identity, Brady/Vick speed, draft-pick invariance, tiny samples, and unchanged source-season data across all available tiers. Final results and updated representative values are in the committed JSON and Codex update log; the earlier before/after table above describes the preceding release and is superseded by those final values.
