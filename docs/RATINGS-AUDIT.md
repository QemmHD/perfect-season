# Ultimate Team ratings audit

**Implemented by Codex (OpenAI), 2026-10-28–2026-10-29.** The owner's request was to bring NBA ratings closer to 2K and correct player identities, overalls and stats without deleting or resetting owned cards.

## Coverage and references

The audit covers **21,304 NBA season cards** and **30,855 NFL season cards**, plus their special editions. All **54,324 editions** are checked at levels 1 and 5 for finite, bounded overalls/attributes. The committed [machine-readable summary](ratings-audit-summary.json) reports tier distributions, percentiles, player spot checks and invalid-entry lists.

[`nba-rating-references.json`](../src/data/nba-rating-references.json) contains factual attribute/overall snapshots from **111 public 2KRatings all-time player profiles**, checked 2026-10-28, with the source URL on every record. They are approximate peak anchors, not an official 2K roster for every historical season. Season cards remain estimates, with source-season statistics and honors preserved.

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
