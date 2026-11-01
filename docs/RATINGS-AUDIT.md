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

## Claude rework 2026-11-01

**Implemented by Claude (Anthropic), 2026-11-01, branch `feature/season-evolution`** (merged with `claude/ratings-refs`). The owner: "balance out the cards overalls … the stats are still far off … the ultimate team ratings need a rework, it's not like real ultimate team." UT layer only: draft-mode formulas (`src/game/*/ratings.ts`) are unchanged; the only engine change is the NBA shot curve (below).

### What changed

| Step | Where | What |
| --- | --- | --- |
| A. Era-normalised NBA overall | `calibration.ts` | the estimate is capped by a 2K-measured standing curve (`rk.val` → 2K overall); position offsets C −7, PG −6, PF −1 |
| B. Three-point | `calibration.ts`, `rate.ts` | a trusted same-season 2K 3PT skips the shrinkage ceiling (tiny samples still capped 80/72); new ceiling and positional low-sample floor; Limitless no longer needs 5 3PA a game from a 90+ shooter |
| C. Reference trust | `calibration.ts`, `season-reference.ts` | same-season skills 0.95 (was 0.85); `preseason`/`retro` fallbacks count less (`referenceTrust`) |
| D. Nearest-season borrowing | `cards.ts` (`careerOf`), `season-reference.ts` | a season without a reference borrows the player's nearest one: athleticism within 6 seasons (−1.1/yr past a sixth season, −0.5/yr earlier), skills within 4 at half weight |
| E/F/G. NFL estimate path | `season-reference.ts`, `rate.ts` | per-group overall maps, then quantile-matched to the 19,500 same-season Madden ratings (`NFL_ESTIMATE_LEVEL`); estimate top compressed (99 → 96); starters held near their best three seasons (career floor); attribute bias fixes (WR SPC/CTH, RB CAR/JKM/BCV, CB/LB ZCV, running QB SPD/ACC/AGI, …) |
| Combine | `nfl-combine.ts`, `src/data/nfl-combine.json` | measured 40/3-cone → SPD/ACC/AGI (aged −0.6/yr past 28) for 4,029 players; weight-based fallback at half weight; hand-set identities and Madden ratings win (see CREDITS.md) |
| Face | `card-face.ts`, `CardArt.tsx`, `CardDetail.tsx` | NBA cards print six universal categories OUT/INS/PLY/ATH/DEF/REB (top-heavy means of the played attributes); football keeps position keys (RB shows BCV, CB shows PRC). NBA cards are weighed in their best **role** (Playmaker, Shot creator, Slasher, Lockdown defender, Scoring/Two-way wing, Point forward, Post scorer, Stretch big, Glass and paint defender, Playmaking big) |
| Support | `card-face.ts` `supportOverall` | when the overall sits more than 2 from the weighted face (judged as displayed), the role's main skills move (up to 6, 8 for stars, 14 down; weaknesses barely rise, 85+ signature skills fall at most 4; measured athleticism and FT never); any gap past 3 (4 at the very top) comes off the overall |
| Balance | `rate.ts` `OVR_BALANCE`, `scripts/fit_ut_balance.ts` | per position (NBA × decade) shift near the gold line (±4; kickers and pre-1990 NBA ±6) so each group has ≈30% gold |
| UT display scale | `ut-scale.ts`, `scripts/fit_ut_scale.ts` | one isolated curve per sport from the rating scale to the displayed UT overall; tiers, onScale, walkouts, ladders and editions follow (below) |
| Editions | `rate.ts`, `ut-scale.ts` | Hot Season and Legend displayed overalls come from their own ranges ordered by the season; the playable profile still gains the edition boost once; the face shows the season face raised to the edition's number. Spotlight/GOAT unchanged |
| Levels | `card-face.ts` | +1 key attributes per level; +1 overall at level 3 and +1 at 5 (max +2, was +4). XP/levels themselves unchanged |

Every number on the card face, the overall and the tier are display-layer; gameplay always reads the rating-scale attributes. `RatedCard.rawOvr` keeps the 2K/Madden-comparable overall (numbering's 90+ check uses it, so numbered eligibility is untouched).

### UT display scale (EA FC 27-style)

| | Bronze | Silver | Gold | Walkout |
| --- | --- | --- | --- | --- |
| Displayed overall (both sports) | 40–64 | 65–74 | 75–99 | 86+ |
| Share of season cards (NBA / NFL) | 35.1 / 35.1% | 35.3 / 34.9% | 29.7 / 29.9% | |

Base season gold pyramid, cards at each displayed overall:

| | 75–82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NBA | 5,468 (86.5%) | 277 | 191 | 150 | 106 | 64 | 31 | 19 | 12 | 2 |
| NFL | 7,965 (86.2%) | 436 | 281 | 210 | 153 | 94 | 40 | 31 | 16 | 9 |

Editions: Hot Season (Team-of-the-Year analog) 94–97, no 99s (NBA median 95, NFL 95); Legends 88–95 (NBA 88–94, 2 at 94; NFL 88–95, 3 at 95); room left for weekly promos at 80–92 and landmark promos ~85–93; Spotlight 100–105 and GOAT 106–110 unchanged. The rating-scale → display curve is piecewise-linear (NBA rating 75.9 → 74.5, 83.9 → 79.5, 89.3 → 82.5 … 99 → 91; NFL 82.3 → 74.5, 90.1 → 79.5 … 99 → 91). All UT thresholds follow it: `onScale()` maps every legacy challenge/SBC number through the same standing (now unrounded), Squad Battles rungs are set on the rating scale and shown on the UT scale (NBA Legend step +11, was +9, because the top is compressed), quick-sell values use the scale's own ranges, and walkouts start at the configured 86.

To re-target the scale, edit `UT_SCALE` (pyramid targets live in `scripts/fit_ut_scale.ts`), then run `npx vite-node scripts/fit_ut_scale.ts nba|nfl` and `npx vite-node scripts/fit_ut_balance.ts nba|nfl` alternately twice and paste the printed tables. Re-run both after any change to the reference files.

### Before → after (season cards unless stated)

| | NBA before | NBA after | NFL before | NFL after |
| --- | --- | --- | --- | --- |
| Bronze / silver / gold | 10,895 / 7,507 / 2,902 | 7,471 / 7,513 / 6,320 | 20,846 / 5,600 / 4,409 | 10,840 / 10,780 / 9,235 |
| Gold share by position | PG 19% C 18% SF 9% SG 10% | 26–31% (SF 26%) | C 22% OG 19% TE 6% DT 10% | 25–31% (K 25%, TE 29%) |
| 90+ season cards (shown) | 1,154 (40 at 99) | 14 (top 91) | 3,814 (98 at 99, 68 OL) | 25 (top 91; 5 OL, all Madden 99s) |
| Hot Season at 99 | 259 of 518 (50%) | 0 (94–97) | 404 of 1,106 (37%) | 0 (94–97) |
| Legends at 99 | 22 of 120 | 0 (88–94) | 42 of 130 | 0 (88–95) |
| Level-5 overall gain | +4 | +2 | +4 | +2 |
| Gold: overall − weighted face (median) | +7 | +1.7 | +7.2 | +1.4 |

### Famous seasons (rating-scale overall, displayed UT overall)

| Card | Before | After (rating / shown) | Key attribute before → after |
| --- | --- | --- | --- |
| Curry 2021-22 | 96 | 96 / 86 | 3PT 87 → 99 (Limitless) |
| Korver 2009-10 | 64 | 65 / 59 | 3PT 85 → 89 (2K 63 bench season) |
| Westbrook 2016-17 | 94 | 94 / 85 | SPD 96 → 97 |
| Jokić 2023-24 | 97 | 97 / 87 | PAS 94 → 96 |
| Jordan 1995-96 | 99 | 98 / 89 | MID 96 → 99 |
| LeBron 2012-13 | 99 | 98 / 89 | SPD 92 |
| Mahomes 2024 | 83 bronze | 94 / 82 gold | THP 95 → 97 |
| Tyreek Hill 2016 / 2018 | 75 / 91 | 79 / 70, 93 / 82 | SPD 84 / 94 → 97 / 99 |
| Aaron Donald 2018 | 96 | 99 / 89 | PMV 93 → 99 |
| Josh Allen 2024 | 97 | 99 / 89 | THP 98 |
| Tom Brady 2016 | 97 | 99 / 90 | SPD 50 → 62 (Madden-backed) |
| Calvin Johnson 2012 | 93 | 99 / 88 | SPD 88 → 95 (combine 4.35) |
| Trent Williams 2021 | 98 | 98 / 88 | PBK 94 |
| Justin Tucker 2016 | 98 | 91 / 80 | KAC 98 → 95 |

### Out-of-sample estimate check (rating scale)

The estimate path, rated with the card's own same-season reference removed, against that reference (`scratchpad/ratings/oos.ts` method):

| | Sample | OVR MAE | Tier agreement |
| --- | --- | --- | --- |
| NBA before | 9,419 | 5.2 | 63% |
| NBA after, vs the raw 2K rating (no / with neighbour borrowing) | 11,608 | 4.3 / 4.2 | 70 / 70% |
| NBA after, vs the same card's final rating | 11,608 | **2.6** | **85%** |
| NFL before | 2,120 | 6.0 | 66% |
| NFL after on that 2021–23 sample (before the reference merge) | 2,120 | 4.2 / 4.0 | 76 / 77% |
| NFL after, expanded 2000–2025 Madden set, vs raw (no / with borrowing) / vs final | 19,520 | 5.5 / 4.8 / **4.2** | 68 / 70 / **78%** |

Against raw 2K the NBA estimate cannot fall below ≈4 while the per-position balance moves seasons up to ±4 away from 2K's own position mix (with the balance switched off it is 3.9 / 74%); against the pipeline's final ratings it is well inside the target. NFL speed bias against Madden is now ≈0 (was −4 to −11). With the expanded references 99% of 2000+ NFL seasons carry their own Madden rating, so the NFL estimate path now only rates pre-2000 football; on the broad 19,520-season check it stays above the MAE-4 target against raw Madden (5.5, 4.8 with neighbour borrowing) and meets it against the final pipeline (4.2, 78% tier agreement).

### Gameplay: NBA shot curve

`hoops2/engine.ts`: green window `0.22 + 0.78·r^1.15` → `0.12 + 0.88·r^1.6`; open off-green three `lerp(0.2, 0.47)` → `lerp(0.16, 0.5)`. Expected make% of an open set three at an ordinary release spread (σ 50 ms), rating 50/70/80/90/99: before 58/78/86/93/97, after 48/69/81/91/97 — elite shooters unchanged, poor shooters about ten points worse. The fixed-seed human-strategy harness (draft teams, 10 games) moves jumper-heavy strategies by −0.02 to −0.11 PPP (step-back 1.97 → 1.86 good O), drives unchanged.

### Compatibility

Draft queue NBA 8 → **9** (shot curve; NFL draft stays 9). UT queue rules NBA 8 → 9, NFL 9 → 10, and the pool fingerprint changes, so UT online squads only pair with this build. Card IDs, levels, XP, serials and numbered eligibility are unchanged; owned cards show new displayed overalls/tiers.
