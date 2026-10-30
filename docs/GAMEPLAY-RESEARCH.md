# Ratings and gameplay revision — Codex, 2026-10-30

Implemented by **Codex (OpenAI)** following the owner's reports of inaccurate NBA/NFL cards, fake defenders, incomplete animations and inconsistent scoring. This revises the existing Canvas2D pixel game. It does not replace the engine, change the visual identity, or import proprietary 2K/Madden code, animations or formulas.

## Research and its limits

| Source | What was learned and used |
| --- | --- |
| [NBA 2K26 official Gameplay Courtside Report](https://nba.2k.com/2k26/courtside-report/gameplay/) | Difficulty-dependent timing tolerance; readable contests; planted movement; help and recovery; decisions that create good shots. Console ProPLAY is proprietary and is not included here. |
| [NBA 2K25 official Gameplay Courtside Report](https://nba.2k.com/2k25/courtside-report/gameplay/) | Openness, shooter ability, timing and release contests are separate factors. Defensive reactions change by difficulty. |
| [Madden NFL 26 official Gameplay Deep Dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive) | Player identity, passing fundamentals, movement transitions and readable defensive decisions. Perfect Season retains its own slingshot controls and two-dimensional routes. |
| [EA's explanation of QB attributes](https://www.ea.com/news/madden-25-qb-ratings) | Throw power, distance accuracy, awareness and rushing ability have different meanings. This is a **2013** article; its old yardage bands are not presented as current Madden rules. |
| [Mike Stauffer interview](https://grantland.com/hollywood-prospectus/qa-mike-stauffer-on-coming-up-with-nba-2k-player-ratings/) | Actual statistics/tracking plus film; dunk frequency is not dunk ability; historical players require evidence and era context. Published 2015, not a current proprietary formula. |
| [Donny Moore interview](https://www.engadget.com/2013-09-17-how-football-players-make-the-grade-in-madden.html), [Madden ratings explanation](https://boardroom.tv/madden-nfl-ratings-explained/) | Position-specific traits, scouting/combine evidence and film; yards and TDs alone cannot establish sprint speed or arm strength. |
| [2K Archive](https://2karchive.com/) | Public numerical release/update snapshots, matched to existing NBA player-seasons. This is a community archive, not an official season-final roster feed. |
| [nflscraPy Madden release](https://github.com/blnkpagelabs/nflscraPy/releases/tag/MaddenRatings) | Published weekly ratings with explicit NFL season and iteration date, 2021–2023. Latest published record per matched player-season is retained. [MIT notice](NFLSCRAPY-LICENSE.txt). |
| [2KRatings all-time profiles](RATINGS-AUDIT.md) | Existing 372 peak anchors remain for historical attributes without same-era coverage. |

The console games' unpublished overall formulas cannot be verified or reproduced exactly. Perfect Season uses its own position-weighted quality model, actual season statistics, available public benchmarks and explicitly estimated historical attributes. Our continuous release curve is a deliberate arcade choice; it is **not** a claim to replicate 2K26's green-or-miss mode.

### Free resources and attribution

The public GitHub Madden archive above supplies numerical reference facts and is MIT licensed; its notice is retained. No third-party application code was copied. [nifleisch/madden-nfl-prediction](https://github.com/nifleisch/madden-nfl-prediction) was also researched, but contains a scraper rather than a committed historical roster dataset; linked legacy Weebly spreadsheets returned 404 and were not used. [Kenney's CC0 Sports Pack](https://opengameart.org/content/sports-pack-350) was evaluated, but no new art was imported: it would not supply compatible animation for the game's existing pixel rigs. The existing recorded backpedal/shuffle clips and their existing attribution are reused.

## Card coverage and exact matching

The reproducible [builder](../scripts/build_season_references.py) reads the existing card catalogs; it never rewrites their source statistics, IDs or edition selections. Cached raw downloads stay outside the repository. Generated snapshots retain source URLs, retrieval date, field order and SHA-256 hashes of downloaded inputs.

| Coverage | NBA | NFL |
| --- | ---: | ---: |
| Matched unique players | 1,771 | 1,135 |
| Matched unique player-seasons | 8,938 | 2,114 |
| Base season cards with a same-era benchmark, including traded stints | 9,419 | 2,120 |
| All editions carrying those benchmarks | 9,739 | 2,186 |
| Season cards without a same-era benchmark | 11,885 | 28,735 |

The remaining cards still use season/role calibration. Of NBA season cards without a same-era reference, 2,508 also have a public peak anchor; remaining historical attributes are estimates. The NFL named physical-identity fallback remains an estimate. **A whole-pool software audit is not individual film research of every historical player.** Do not call all 54,324 cards exact official 2K/Madden ratings.

Matching normalizes accents and punctuation but preserves meaningful name/suffix differences. Position must be compatible, and height must agree within three inches where both sources provide it. Ambiguous NFL name/season candidates are rejected (86 source rows); no fuzzy surname matching. Each reference is attached by existing `pid:season`, before promo/legend/Spotlight/GOAT copies are derived. Traded stints share a benchmark but retain their own team-stint statistics.

- **NBA:** 2K2000–2024 launch snapshots map to the preceding completed NBA season (edition minus one). The archive explicitly labels 2K25/26 as updated rosters; these map to the edition-ending season and take precedence over an adjacent launch snapshot. NBA attributes from 2016 onward cover 3PT/MID/LAY/DNK/SPD/HND; PRD/IND coverage starts later. Older rows may provide overall only. `snapshot` records the actual game edition, not an invented season-final timestamp.
- **NFL:** the source's explicit `season` is used; no edition-year guessing. `snapshot` records the final available published `iteration_date`. SAC/MAC/DAC/TUP, power, blocking, coverage and physical attributes map by meaning. The engine's single RTE attribute is the rounded average of short/medium/deep route running; it is not advertised as Madden's separate three route attributes.
- **NBA blending:** available same-era attributes use 85% benchmark / 15% season-derived input, before measured three-point/FT constraints. The overall uses 88% benchmark / 12% calibrated overall, subject to playable quality support. Unavailable attributes retain season/peak estimates.
- **NFL blending:** measured physical/arm traits use the benchmark directly; applicable skills use 85% benchmark / 15% season input. Native-position overall uses 90% benchmark / 10% season overall with a quality ceiling. An out-of-position card cannot inherit its native reference overall.
- All editions then pass through existing identity-preserving edition boosts, level gains, attribute bounds and freshly computed badges. No source season statistics are replaced by ratings. A poor free-throw shooter or non-shooter keeps that weakness.

The [machine-readable audit](ratings-audit-summary.json) covers **54,324 editions at levels 1 and 5**, with coverage counts, spot checks, source metadata and invalid lists. Card Detail displays its actual benchmark source/snapshot or the existing estimate explanation.

## Gameplay findings → implementation

| Observed execution problem | Implemented change | Connection |
| --- | --- | --- |
| Defenders mirrored a cushion all the way under the basket; collisions moved positions but retained the attacker's forward momentum. | On-ball defenders meet a committed direct drive. Contact absorbs momentum into the chest while allowing tangential movement around it. Helpers, rotations and closeouts use the existing schemes. Tracking uses delayed observed velocity rather than current controller input. | `hoops2/engine.ts` → actual played game and autopilot |
| Step-backs/spins lost their burst/animation on the next movement update; cooldown depended on the current animation. | Persistent shared move timestamp; complete move travel/animation; shorter recoverable shakes; no automatic stun on every step-back. | `hoops2/types.ts`, `engine.ts`, existing input controls |
| One frame outside green caused a large probability cliff; a green layup ignored an elite set rim protector. | Continuous timing curve; open perfect jumpers rewarded; contested perfect timing still respects coverage/block reach; rating, movement, energy and difficulty affect timing tolerance. Feedback distinguishes perfect timing from a contested attempt. | `greenWindow`, `releaseProbability`, `shotValue`, `shotChance` and renderer/HUD |
| Running finishes could start from 15 feet away. | Tightened gather range; actual movement/contact must create a finishing lane. | `pressShoot` / existing layup/dunk animations |
| User passes landed exactly at finger aim regardless of distance accuracy. | Bounded, center-weighted dispersion from SAC/MAC/DAC, TUP, movement and pressure. The aiming ring uses the same uncertainty radius. 99+ ratings are explicitly checked for finite calculations. | `football2/engine.ts` → `throwTo`, `throwErrorRadius`; renderer aim overlay |
| Coverage mostly waited for the endpoint; pass interceptions were unusually rare. | Faster rating-based post-throw reads; once-per-defender plays on the actual swept low-ball path, limited by reach, height and reaction time. High lobs clear underneath defenders. Catch-point battles remain separate. | `Ball.tried`, `playPassingLane`, `arrive` |
| Movement acceleration ignored ACC/AGI; defenders faced away while backpedaling. | Attribute-based acceleration/turning; delayed observed route reads; recorded backpedal/shuffle footwork and smooth facing/open-hip transitions. | `football2/engine.ts`, `render.ts`; existing pixel/mocap pipeline |
| Highest difficulty could add an artificial rush deadline on top of tighter coverage. | Rush wins follow the blocker/rusher ratings with a normal phone-input pocket window. Pressure becomes visible before the rusher is completely free. | `WIN_AT`, `winAt`, pressure HUD |
| Selected difficulty did not consistently reach defense; online explicitly used standard defense. | Central `defenseDifficulty`: Rookie −0.5, Pro 0, Legend 1; Squad Battles retains All-Star 0.5. Online always 1 on both clients, including simulations and takeovers. NFL Legend ladder target offset increases to 6 so its squads remain measurably stronger after recalibration. | `difficulty.ts`, `Arcade.tsx`, `ut/Match.tsx`, AI wrapper functions, `ut/battles.ts` |

## Save, online and deployment boundaries

No profile version, storage key, player signing key, card edition ID, owned UID, XP, squad reference, wallet, pack entitlement, server-save revision or collection claim is reset. No backend schema/Edge Function changed in this revision. Automatic encrypted saves and the worldwide card registry keep their existing connections.

`DRAFT_RULES` and `UT_RULES` are **4** so old and revised clients cannot enter an incompatible match. `DATA_V` and leaderboard history are unchanged. Full UT attribute fingerprints still protect squad compatibility. Both phones need the same preview/update to test online together.

Pre-revision restore point: `backup/pre-gameplay-research-2026-10-30` → `f3ccd941475bc209c750557df0ef4850385bce49`. Original main/restore source remains `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. This is source history, not a replacement for the existing player-save service.

Work stays on `feature/season-evolution` / PR #1 and the existing owner-private test Site. Main/GitHub Pages is not promoted by this revision. See [private preview record](PRIVATE-PREVIEW.md) for the final published commit/version.

## Verification and reproduction

```sh
# Public numerical references; cached downloads are kept outside the repository.
PS_RESEARCH_CACHE=/tmp/ps-rating-research python3 scripts/build_season_references.py
npm run audit:ratings
npm test
npm run build

# Fixed-seed, human-like decisions; default 20 NBA / 40 NFL games per matchup/strategy.
HUMAN=1 npx vitest run src/game/hoops2/human.test.ts
PS_SPORT=nfl HUMAN=1 npx vitest run src/game/football2/human.test.ts
# HUMAN_DEF_IQ=-0.5 / 0 / 1 selects defense. HUMAN_GAMES changes the sample size.

# Fresh localhost identities; external registry traffic only uses the inspect namespace.
PS_QA_PACKAGE_JSON=/path/to/qa-tools/package.json node scripts/qa/gameplay.mjs
PS_QA_PACKAGE_JSON=/path/to/qa-tools/package.json node scripts/qa/online.mjs
```

Regression cases cover release continuity and contests, head-on containment, move travel/cooldown, difficulty parity, actual accuracy dispersion, 99+ throws, low-lane interceptions and high-lob clearance. The browser gameplay check uses the real match components and rated fixture squads, manual pointer shooting/throwing, populated canvases, bounded autoplay completion and unchanged owned copies. Two independent online clients use a signature-verifying local Nostr relay; this is not a physical two-iPhone network test.

Automated balance samples are diagnostic, not a guarantee of human fun or addiction. On-device play should assess input delay, reading the defense, finding several useful attacking choices, sound/haptics, orientation and rematches before promoting main. Results and screenshots are recorded in the validation section of [the Codex update log](CODEX-UPDATE-LOG.md).

### Measured balance sample

The complete [fixed-seed diagnostic summary](gameplay-balance-summary.json) includes all measured strategies/matchups before and after. Representative average-team Pro results:

| Diagnostic | Before | Revised |
| --- | ---: | ---: |
| NBA direct-drive attempts reaching rim | 351/351 | 159/293 |
| NBA direct-drive points/possession | 1.19 | 0.48 |
| NBA crossover-drive points/possession | 1.14 | 0.92 |
| NBA drive-and-kick points/possession | 1.11 | 1.35 |
| NFL completion percentage | 73% | 58% |
| NFL interceptions/attempt | 0.2% | 0.8% |
| NFL sacks/dropback | 18.5% | 10.0% |

NBA step-backs now actually reach behind the arc instead of losing their movement immediately; the sample makes them useful, so their efficacy remains a device-play tuning focus. Legend improves reaction/coverage and tightens timing, with every online participant using that same setting. These figures are observations from the committed harness, not hardcoded success targets.
