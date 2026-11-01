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


## Expanded game-rating references — Claude 2026-11-01

**Implemented by Claude (Anthropic), 2026-11-01, branch `claude/ratings-refs`.** The owner's idea: "pull all overalls from all games — all the games have rated all players", clarified as "depending on what year you pull decides ratings": a season-X card uses the rating from the game edition that represents season X, never an all-time or another year's rating. Other seasons are only a fallback the rating code may apply (nearest season, with its own age adjustment); the data keeps every season separate.

**Risk, stated plainly.** These are the publishers' own ratings (2K/Take-Two, EA), collected by fan sites and public GitHub scrapes. We use them as numeric reference anchors only, exactly as the earlier 2K Archive / nflscraPy precedent: no names, art, logos, badges text or game files are copied beyond what matching needs, and the cards stay original. The ratings themselves are not ours and no source below grants a licence to EA's or 2K's data. If a rights holder objects, delete the `sets` blocks (the original rows are separate) and rerun.

### Edition → season mapping

NBA seasons are named by their ending year (2016-17 = 2017). Madden N is released in August N−1 and is played during NFL season N−1.

| Kind (priority) | NBA season X | NFL season X | Why |
| --- | --- | --- | --- |
| original rows (kept, win any conflict) | 2K(X+1) launch; 2K25/2K26 latest update → 2025/2026 | Madden (X+1) final published iteration, 2021–23 | unchanged |
| `final` | 2K(X) latest in-season roster update (2K25, 2K26) | Madden (X+1) final iteration (nflscraPy rows the original strict match missed) | reflects the whole season X |
| `next` | 2K(X+1) launch roster | Madden (X+2) launch roster | built from season X's play; measured on 2021–23 Madden: next launch vs final in-season update OVR MAE 0.85/0.55/0.32, r 0.985–0.993 |
| `preseason` (fallback) | 2K(X) launch roster | Madden (X+1) launch roster | the edition played during X, but a projection made before X: MAE 1.7/2.1/1.6, r 0.94–0.96 vs the final update. Used only when the player is missing from the `next` edition (retired, waived, injured) |
| `retro` (fallback) | NBA 2K26 classic team of season X (e.g. 1985-86 Celtics → 1986) | — | the only same-season game rating before 1999; a modern retrospective scale |

Concrete editions: NBA 2K (1999) → 1999, 2K1 → 2000 … 2K24 → 2023, 2K25 launch (scraped 2024-10-09) → 2024, 2K25 final → 2025, 2K26 final → 2026, 2K27 launch → 2026 (when 2K26 final lacks the player). Madden 2002 → 2000, Madden 2003 → 2001 … Madden 25 (2013 edition) → 2012, Madden 15 → 2013 … Madden 26 → 2024, Madden 27 → 2025. A key (`playerId:season`) lives in exactly one block, so each entry's provenance is its block (`id`, `kind`, `source`, `basis`, `licence`) plus the snapshot label in its first column (e.g. "Madden 20 launch", "2K25 launch", "2K26 classic 1995-96"). `kind` is attached to `line.ratingReference` so the rating code can treat fallbacks differently; the card detail shows the snapshot label.

### Sources

| Source | Editions / years | Fields used | Terms / notes | Rows added |
| --- | --- | --- | --- | --- |
| [2K Archive](https://2karchive.com/) (already used) | NBA 2K–2K27 (overall; 3PT/MID/LAY/DNK/SPD/HND/PRD/IND from 2K16) | OVR + 8 | Free fan site, "as is", ratings belong to 2K; robots allow all. Better name matching (suffixes, nicknames, Ron Artest → Metta World Peace, Yi Jianlian order) plus same-edition fallback | 47 final, 318 next, 981 preseason |
| [ReinerJasin/NBA2k25_Web_Scraping](https://github.com/ReinerJasin/NBA2k25_Web_Scraping) (2KRatings scrape), git history pinned at `f7d7246` (2024-10-09) and `eedbdef` (2025-08-23) | 2K25 near-launch and final rosters | OVR + 19 attributes | README says MIT, no LICENSE file | 381 next (all of 2024), 2 final, 6 preseason |
| [wkoverfield/nba2kapi](https://github.com/wkoverfield/nba2kapi) (2KRatings scrape) at `6f460b8` | 2K26 roster archive captured 2026-08-08 (current + 66 classic teams), 2K26 roster 2025-11-16 | OVR + 19 attributes | README says MIT, no LICENSE file | 325 retro (1965–2014), 8 final, 3 preseason |
| [theedgepredictor/nfl-madden-data](https://github.com/theedgepredictor/nfl-madden-data) at `7443ba1`, `data/madden/raw/<Y>.csv` (= Madden Y+1 launch, collected from maddenratings.weebly.com) | Madden 2002–26 | OVR + every listed attribute (Madden 2003 overall only; Madden 10 overall/SPD/ACC) | No licence file. Only raw files are read; the repo's imputed/ML-predicted "processed" values are not used | 15,513 next, 1,011 preseason |
| [2K Archive Madden board](https://2karchive.com/madden/) | Madden 2002–27 | OVR, SPD, ACC, AGI, STR, AWR (Madden 27 only) | as above; agrees with nfl-madden-data on overall for every player listed in both, edition by edition (Madden 24: 2,048 of 2,059) | 698 next (all of 2025) |
| [nflscraPy MaddenRatings](https://github.com/blnkpagelabs/nflscraPy/releases/tag/MaddenRatings) (already used) | Madden 22–24 iterations | OVR + 37 | code MIT ([licence](NFLSCRAPY-LICENSE.txt)) | 173 final |

Checked and not used: **2KRatings.com** and **maddenratings.net** answer automated requests with Cloudflare challenges (HTTP 403/429); maddenratings' pre-2002 Madden and NBA Live pages are roster images only, so they would need OCR, which we don't do. **HoopsHype** NBA 2K history: robots.txt disallows Claude/anthropic agents, so it was not fetched. **EA's ratings site** (`ea.com/games/madden-nfl/ratings`) serves the current edition only (Madden 27, the 2026 season, outside our cards); its public API returned an older roster without a game parameter, so it wasn't used. **Wayback Machine** connections were reset from this sandbox. **Kaggle** datasets need a signed-in API token (not attempted). Muthead / Madden Ultimate Team cards are promo cards, not season rosters. Pro Football Reference and FootballDB don't publish game ratings. No public season-specific game ratings were found for the NFL before 2000 or the NBA before 1999 apart from the 2K26 classic teams.

### Matching and size

A source row joins a card only when exactly one player in our season-X cards fits: exact normalised name (accents, punctuation, Jr./Sr./II–V dropped, known renames), otherwise same surname with an equivalent first name (nickname list, initials, prefix) **and** the same franchise in season X or the adjacent season **and** a compatible position. Height must agree within 3 inches when both are known; football requires a compatible position group unless the team also matches. Ambiguous rows are dropped (a handful per sport). Football rows keep only the attributes the player's position groups read (`NFL_USE` in the script, measured from `rateCard`), and trailing empty columns are trimmed.

| File | Before | After | gzip before → after |
| --- | --- | --- | --- |
| `season-references-nba.json` | 8,938 player-seasons, 541 KB | 11,009 (2,071 players), 649 KB | 75 KB → 110 KB |
| `season-references-nfl.json` | 2,114 player-seasons, 307 KB | 19,509 (5,018 players), 2.55 MB | 88 KB → 402 KB |

Both stay lazy chunks loaded with their sport's card catalog (`cards-<sport>.json` is ~3 MB).

### Coverage (season cards with a reference)

Measured with `scratchpad/ratings-refs/coverage.ts` (tier = the card's tier before this change).

| Bucket | NBA same season, before → after | NBA within ±2, after | NFL same season, before → after | NFL within ±2, after |
| --- | --- | --- | --- | --- |
| All season cards | 44.2% → **54.5%** | 61.6% | 6.9% → **63.3%** | 66.1% |
| Modern (NBA 1999+, NFL 2000+) | 79.9% → **95.8%** | 97.9% | 10.8% → **99.0%** | 99.4% |
| 1960s–70s | 0% → 1.1% | 5.0% | 0% → 0% | 0% |
| 1980s | 0% → 2.6% | 10.6% | 0% → 0% | 0% |
| 1990s | 8.0% → 14.3% | 40.3% | 0% → 0% | 17.8% |
| 2000s | 80.0% → 93.9% | 96.6% | 0% → 98.7% | 99.1% |
| 2010s | 83.8% → 96.4% | 98.5% | 0% → 99.2% | 99.6% |
| 2020s | 74.0% → 97.7% | 99.0% | 46.0% → 99.2% | 99.7% |
| Bronze / Silver / Gold | 40.4/52.5/37.0% → 52.8/60.4/45.6% | 58.9/67.2/57.4% | 7.7/4.9/5.7% → 60.0/78.6/59.3% | 63.0/80.8/62.2% |
| NBA PG/SG/SF/PF/C | 44.7/45.6/41.2/44.1/45.4% → 55.1/55.7/52.1/54.3/55.3% | 62–63% | | |
| NFL QB/RB/WR/TE/OL | | | 5.7/5.4/6.0/6.0/7.9% → 49.0/48.9/54.4/51.2/72.1% | 51.8/50.8/57.1/53.7/75.0% |
| NFL DL/LB/CB/S/K | | | 7.5/7.8/6.4/7.4/7.1% → 67.9/73.6/68.1/70.3/61.8% | 70.9/76.8/71.2/73.7/65.1% |

Fallback share: 990 NBA preseason + 325 retro rows, 1,011 NFL preseason rows. The remaining gap is history before the games existed (NBA pre-1999 and NFL pre-2000 are 45% / 36% of season cards). `src/ut/season-references.test.ts` holds the floors (NBA ≥53% all / ≥94% 1999+; NFL ≥62% / ≥97% 2000+) and checks one block per key, valid snapshots, card keys and 1–99 values.

### Effect on ratings (no formula changed)

The same `calibrateNba()` / `calibrateNflReference()` blends now apply to many more cards, so UT ratings move and the UT online queue splits automatically through `pool.print` (draft queues NBA 8 / NFL 9 are unaffected: draft formulas are untouched). Season-card tiers: NBA bronze/silver/gold 10,895/7,507/2,902 → 10,883/7,634/2,787 (501 cards change tier); NFL 20,846/5,600/4,409 → 21,036/4,872/4,947 (5,901 change). NFL level-1 99s fall from 98 (68 of them linemen) to 76 (8 linemen, 70 reference-backed). Examples: Mahomes 2024 83 → 94 (Madden 26 launch 95), Mahomes 2018 97, Tyreek Hill 2018 SPD 99, LeBron 2024 95 (2K25 launch), Kobe 2016 85 (2K16 launch fallback). One identity test moved with its reference: Rodman 1995-96 is 87 in 2K26's classic Bulls, so the floor is now 86 instead of 89. Curry 2022 3PT stays 87 because the calibration's three-point ceiling still applies on top of a reference (fix B in the ratings plan, separate work).

### Rebuild

`python3 scripts/build_expanded_references.py [nba|nfl]` (≈15 s; caches downloads in `$PS_RESEARCH_CACHE`, default `<tmp>/ps-rating-research`, one request a second, sha256 recorded in the JSON). It keeps the original `rows` and regenerates `sets`. After `scripts/build_season_references.py` (the original rows), run it again. Then `npm run audit:ratings > docs/ratings-audit-summary.json` and `npm test`.
