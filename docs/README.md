# Documentation index

Every document in the repository, grouped by topic. New here? Read the [front page](../README.md), then [`DEVELOPMENT.md`](DEVELOPMENT.md) to run and build the game, then [`CLAUDE.md`](../CLAUDE.md) for the save rules and module map.

## Gameplay

| Doc | What it covers |
|---|---|
| [SPEC.md](SPEC.md) | The original product spec: draft rules, season and playoffs, economy, modes |
| [ARCADE-V2.md](ARCADE-V2.md) | The agreed scope for the played arcade games and Ultimate Team |
| [CORE-GAMEPLAY.md](CORE-GAMEPLAY.md) | The court and field overhaul: rebounds, shot rhythm, throws, blocking, pursuit (Codex) |
| [GAMEPLAY-RATINGS.md](GAMEPLAY-RATINGS.md) | Every rating matters in play: NBA and NFL fixes, badges, abilities, juice, measured before/after |
| [GAMEPLAY-RESEARCH.md](GAMEPLAY-RESEARCH.md) | Ratings and gameplay revision research (Codex) |
| [NFL-RUSHING.md](NFL-RUSHING.md) | NFL rushing execution fix |
| [NFL-DIRECT-CONTROL.md](NFL-DIRECT-CONTROL.md) | Two-axis NFL joystick control |

## Ultimate Team

| Doc | What it covers |
|---|---|
| [ULTIMATE-TEAM.md](ULTIMATE-TEAM.md) | The original mode design and foundations |
| [UT-CONTENT-UPDATE.md](UT-CONTENT-UPDATE.md) | Spotlight and GOAT cards, collection gallery, duplicate storage, events, global copy numbers |
| [UT-OVERHAUL.md](UT-OVERHAUL.md) | The clubhouse overhaul: seasons, objectives, Champions Circuit, Moments, development, lineups |
| [UT-POLISH.md](UT-POLISH.md) | Research, fixes and polish after the overhaul |
| [UT-CLUB-SEASON.md](UT-CLUB-SEASON.md) | Club Season: full 82/17-game seasons with playoffs |
| [UT-CONTENT-2.md](UT-CONTENT-2.md) | Content drop 2: new packs, Weekly Standouts, Landmark Seasons, Scout Market, Sets, UT Draft, New Era bundle; FC 27 mechanics (Item Score, Evolutions, Rewards inbox); the Live Calendar |
| [PACK-CINEMA.md](PACK-CINEMA.md) | Pack-opening presentation and walkouts |
| [CARD-CIRCULATION.md](CARD-CIRCULATION.md) | 90+ card serial numbers and live circulation counts |

## Ratings & Data

| Doc | What it covers |
|---|---|
| [RATINGS-AUDIT.md](RATINGS-AUDIT.md) | Ultimate Team ratings methodology, audit and the FC-style display scale |
| [ratings-audit-summary.json](ratings-audit-summary.json) | Generated summary of the ratings audit |
| [../research/ratings-reference.md](../research/ratings-reference.md) | NBA 2K and Madden calibration notes |
| [DEVELOPMENT.md § Data](DEVELOPMENT.md#data) | How the NBA and NFL player data is built and audited |
| [CREDITS.md](CREDITS.md) | Data sources, motion capture, sounds and their licences |
| [NFLSCRAPY-LICENSE.txt](NFLSCRAPY-LICENSE.txt) | Licence for an NFL data source |

## Soccer

| Doc | What it covers |
|---|---|
| [SOCCER.md](SOCCER.md) | Soccer in the app: the draft game, head to head, Ultimate Team, saves and queues |
| [SOCCER-DATA.md](SOCCER-DATA.md) | Soccer data and card pipeline |
| [SOCCER-ENGINE.md](SOCCER-ENGINE.md) | The arcade soccer engine ("Attacks") |

## UI

| Doc | What it covers |
|---|---|
| [UI-NAVIGATION.md](UI-NAVIGATION.md) | Navigation and naming: the tab structure and where everything lives |
| [UI-CONSISTENCY.md](UI-CONSISTENCY.md) | Visual and flow consistency polish (Codex) |
| [PLAY-TAB-AND-FOOTBALL-HINT.md](PLAY-TAB-AND-FOOTBALL-HINT.md) | The Ultimate Team Play tab and the football hint fix |
| [../research/pixel-art-options.md](../research/pixel-art-options.md) | Pixel-art player options |
| [screenshots/](screenshots/) | The App Store-style screenshots on the front page |

## QA & Release

| Doc | What it covers |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Run, test, build and deploy; online limits; data; code map; tuning |
| [CODEX-UPDATE-LOG.md](CODEX-UPDATE-LOG.md) | The change log: author, date, files, tests and release state of every update (Codex and Claude) |
| [EVOLUTION-RELEASE.md](EVOLUTION-RELEASE.md) | Save Locker, Training Camp and Ultimate Team Rivals release |
| [AUTOMATIC-SAVES.md](AUTOMATIC-SAVES.md) | Automatic encrypted server saves: identity and recovery limits |
| [BROWSER-QA.md](BROWSER-QA.md) | Isolated browser QA scripts (`scripts/qa/`) |
| [PRIVATE-PREVIEW.md](PRIVATE-PREVIEW.md) | The owner's private test copy |
| [previews/README.md](previews/README.md) | Visual QA previews |
| [../CLAUDE.md](../CLAUDE.md) | Handoff for contributors: save rules, module map, verification |

Generated QA and balance reports: [core-gameplay-nba-audit.json](core-gameplay-nba-audit.json), [core-gameplay-rushing-audit.json](core-gameplay-rushing-audit.json), [gameplay-balance-summary.json](gameplay-balance-summary.json), [nfl-rushing-balance.json](nfl-rushing-balance.json), [nfl-direct-control-qa.json](nfl-direct-control-qa.json), [football-hint-layout-audit.json](football-hint-layout-audit.json), [play-tab-layout-audit.json](play-tab-layout-audit.json), [ui-layout-audit.json](ui-layout-audit.json), [ut-league-browser-audit.json](ut-league-browser-audit.json).

## Notes

| Doc | What it covers |
|---|---|
| [notes/README.md](notes/README.md) | Working notes by category: owner instructions, decisions, research, ratings, content plan, soccer, gameplay, release |
