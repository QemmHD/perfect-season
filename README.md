# Perfect Season (NBA + NFL)

Spin a random NBA or NFL team and decade, draft players who played for them, and try for a perfect season: 82-0, then 16-0 in the playoffs, or 17-0 and four straight playoff wins through the Super Bowl.
Product spec: [`docs/SPEC.md`](docs/SPEC.md).

**Codex update and Claude handoff:** [`CLAUDE.md`](CLAUDE.md) maps the code and save rules; [`docs/CODEX-UPDATE-LOG.md`](docs/CODEX-UPDATE-LOG.md) identifies changes implemented by Codex, connections, validation and release status. The [Spotlight content guide](docs/UT-CONTENT-UPDATE.md) covers GOAT/Spotlight cards, new packs, the collection gallery, duplicate storage, events and global copy numbers. [Ratings methodology and audit](docs/RATINGS-AUDIT.md).

## Two sports

The home screen has an **NBA / NFL** switch. Each sport is its own game with the same modes, boosters, rarity, missions, leaderboards and Head to Head; your name, coins, level, boosters, settings and daily chest are shared.

**Football:**
- **Six spots:** QB, RB, WR, TE, FLEX (any back, receiver or tight end) and DEF, so six rounds. The spots sit on a football field: receivers on the line, the backfield and the defense behind.
- **Every franchise-decade since the 1970 merger:** 183 team-decades, 3,030 quarterbacks, running backs, receivers and tight ends, plus each team's defense for that decade (rated by points allowed).
- **Stats per game:** a quarterback shows passing yards, touchdowns, interceptions and rushing yards; a back rushing yards, touchdowns and catches; a receiver catches, yards and touchdowns; a defense its points allowed against the league average, top-5 seasons and best rank.
- **The season:** 17 games, every score on the schedule (vs DAL, @ GB), with the points scored and allowed. 10 wins make the playoffs.
- **The playoffs:** four one-game rounds (Wild Card, Divisional, Conference Championship, Super Bowl) against real playoff teams since 1970, with home field to the better record and the Super Bowl on neutral ground. Scout each one: their quarterback, running back and top two receivers that season, their scoring and defense, and your odds.
- **Separate boards and queues:** football has its own leaderboards and Head to Head queue, and the online count covers both sports. An invite link opens in the friend's sport (`?room=CODE&sport=nfl`); a friend who types your code while on the other sport gets a one-tap switch.

## What's in this build

- **Ultimate Team Spotlight:** 251 new Spotlight editions (100–105 overall), 40 GOAT editions (106–110), a 3,500-coin promo pack with a 0.05% chance of any GOAT, and globally numbered copies. Real attributes carry into the played game.
- **Collection and events:** a collection gallery with permanent discovery/milestone rewards, dedicated exact-copy duplicate storage, and three themed three-match series per sport with guaranteed Spotlight rewards for their final first clears.
- **Progress, practice and Rivals:** automatic encrypted server saves, solo Continue, six Training Camp drills and weekly UT Rivals divisions/rewards. Existing saves migrate additively.

- **Modes:** Classic, Blind (stats hidden, +50% rewards), Daily (same spins for everyone, first try ranked, resets at midnight US Eastern), and Head to Head.
- **Head to Head, live against real players:**
  - Quick Match finds whoever else is searching. After 30 seconds with no one around, the AI (Rookie, Pro or Legend) steps in, or you can play it right away.
  - Play a Friend: make a 4-letter code and send it, or share an invite link (`?room=CODE`).
  - Both players draft from the same five team-decades, taking turns going first, with a 25-second shot clock. Run out of time and the best fit is picked for you.
  - If the other player leaves or their phone drops for 20 seconds, the AI finishes their draft and you win by forfeit. A 10-second blip (a notification, a quick app switch) changes nothing.
- **Online without a new player login:** matches, leaderboards and admin gifts use five public [Nostr](https://nostr.com) relays. Each phone signs with its own key. Numbered Spotlight/GOAT pulls additionally use the separate [card registry](docs/UT-CONTENT-UPDATE.md#global-copy-numbers-and-backend); existing ordinary packs remain usable offline.
- **Your name:** asked for the first time the app opens (with a dice for random names). It shows on the boards and to your opponents.
- **Draft:**
  - Slot-machine reels and a no-repeat team-decade rule.
  - 1 free team respin and 1 free decade respin; extra respins cost 25 coins.
  - Historical positions; the full roster, with games and seasons played.
  - Sort by any stat; swap players between spots they can both play.
  - Live category bars and guided tips on the first draft.
- **Boosters** (unlock at levels 2, 3 and 4): Double Pick, Trade and Prime. One of each per draft, not allowed in Daily or 1v1.
- **Season and playoffs:** an 82-game ticker reveal, then (with 50 or more wins) four best-of-7 series against real historical teams, ending with a Finals boss.
  - Tap any series to scout the opponent: their five most-played players with per-game stats, your chance in each home and road game, and your odds to win the series.
  - The round you're on shows the opponent's five right on its card.
- **Results:** grade and tier, playoff outcome, your playoff run (every opponent, with the team that knocked you out marked, tap to scout), category breakdown, rewards, XP and levels, your global rank, a share card image and share text.
- **Ranks:** global leaderboards for today's Daily, Classic and Blind (this week and all time) and Head to Head wins, plus your own best runs.
  - Each player keeps their best entry per board. Every entry carries its lineup, and every phone recomputes the record from the player data and drops anything that doesn't add up (Daily lineups must come from that day's teams).
  - Duplicate names get a short tag (`#a1b2`) so you can tell players apart.
- **Coming back every day:** a daily chest that grows for 7 days in a row, three daily missions (easy, medium, hard) with a bonus for finishing all three, and a streak flame on the home screen.
- **Rarity:** about the best 0.5% of player lines are Legendary, the next tiers Epic and Rare. Rows and cards show it, drafting one sets off a full-screen moment, and the reels flash when a team has a Legendary player.
- **Big moments:** a match-found VS screen, a running win-streak flame and 10-win milestones during the season, Playoffs Clinched at 50 wins, New Personal Best, Mission Complete, and a live player count.
- **Other pages:** Daily, Boosters store (earned coins only), Profile and history, Settings (sound, vibration, booster hints, reset), How to play.
- **Sound and saving:** the arcade games and the game casts play real recordings (an arena or stadium crowd that cheers, oohs and groans, sneakers, swishes, rims, pads, whistles, buzzer and horn; free sources, credited in [`docs/CREDITS.md`](docs/CREDITS.md)); the menus' sounds are synthesized. Vibration on Android and haptic ticks on iPhone (iOS 18+). Progress is saved in the browser (localStorage).
- **Fits every phone:** the 390px-wide layout scales to the screen width (an iPhone 15 Pro Max gets it 10% larger), and the height adapts, with tighter spacing on shorter screens.
  - Content stays clear of the Dynamic Island, the status bar and the home indicator, while backgrounds run edge to edge.
  - Tablets and desktops show a phone-shaped frame.
  - It stays portrait like a native app. iPhones don't let websites lock rotation, so when the phone turns sideways the game turns itself back: it stays upright relative to the phone, fills the screen, keeps the Dynamic Island at its top, and fades back in. A draft in progress is never lost.
- **Motion:**
  - Screen transitions, and slot-machine reels with wind-up, blur and overshoot. The team reel takes on the team's color when it lands.
  - A spring-loaded player drawer you can drag down to close. Player cards drop in with a burst and slide when moved.
  - The season ticker slows down for an unbeaten finish, and grades land with a stamp.
  - Playoff games flip in, and a title brings a champion screen. Results count up and a level-up popup appears.
  - Animations are reduced when the phone asks for reduced motion.
- **Installable:** add it to the home screen for a full-screen app with its own icon and launch screen (manifest, Apple meta tags and launch images in `public/`).
  - It updates itself. Every launch loads the newest deploy, and an app resumed from the background checks for one and switches over on the next menu screen, never mid-draft. Settings shows the version.
  - It works offline: a service worker (`pwa/sw.js`) keeps the game and its fonts on the phone.

## Run it

```bash
npm install
npm run dev          # local dev server
npm test             # engine rules + calibration simulation, for basketball then football (PS_SPORT=nfl)
npm run build        # static site in dist/ (GitHub Pages, Vercel)
node scripts/make-artifact.mjs   # single page in dist-artifact/perfect-season.html
node scripts/make-icons.mjs      # re-render icons and iPhone launch images into public/ (needs Playwright)
```

`make-icons.mjs` writes full-color PNGs; the committed ones were then reduced to 256 colors with Pillow (`Image.quantize(256)`), which keeps each launch image under 80 KB.

### Deploying

**GitHub Pages** (live at https://qemmhd.github.io/perfect-season/): `.github/workflows/pages.yml` tests, builds and publishes on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

To install it on an iPhone, open the link in Safari, tap **Share → Add to Home Screen**. Each push to `main` reaches installed copies on their next launch.

The build writes `sw.js` and `version.json` next to the page; the version is the build time and commit (`20261024.2105-9d52b2b`).

`vercel.json` still works for Vercel: import the repository with the default settings.

The leaderboard and Head to Head need no setup. For testing on the real relays without touching the real boards, add `?ns=test` (any lowercase name) to the URL. `?relay=ws://localhost:7777` points the app at a local relay instead.

## Online: how it holds up, and its limits

What's covered, each by a test with two players in separate browsers (`?relay=` points them at a local test relay):
- **Normal play.** A full match, a rematch straight after, a friend code, and the AI stepping in after 30 seconds. Both phones always agree on the result.
- **Rough connections.** A relay that drops 35% of messages, and the real public relays.
- **Clock and leaving.** The shot clock picking for an idle player, and a player leaving mid-match.
- **Disconnects.**
  - The app frozen in the background for 10 seconds: nothing happens.
  - Frozen for 30 seconds: that player is dropped and the other wins by forfeit.
  - A 30-second network outage: the player who lost connection is dropped; their phone doesn't claim the win too.
  - An opponent who never connects: back to the queue after 12 seconds, with no result.

Limits that come from having no server:
- **Results are reported by each phone.** Every leaderboard lineup is checked against the player data, and records that don't add up are dropped. Daily lineups must come from that day's teams. But a modified copy of the game could still claim a believable result, or a head-to-head record it didn't earn. The owner can take a key off the boards by adding it to `BLOCKED` in `src/net/leaderboard.ts`.
- **A modified copy can redraw unfairly.** In head to head, the other phone's picks are checked: no taking a player you hold, no drafting from another round's team-decade. A modified copy could still pick from any other team-decade on its own redraws.
- **Big boards are trimmed.** Relays return at most about 500 entries per board, so a board with more players than that shows the most recent 500.
- **Public relays can be slow or down.** The game uses five at once and keeps working with any one of them.

## Data

### Football

`src/data/nfl.json` is generated by `scripts/build_nfl_data.py` (sources in `scripts/nfl_sources.py`):
- **1970–1998:** Pro-Football-Reference season tables (passing, rushing, receiving), as scraped by the public [fantasydatapros/data](https://github.com/fantasydatapros/data) repository. Players are matched to the [nflverse](https://github.com/nflverse/nflverse-data) player register by name and birth year, so careers that cross into 1999 stay one player.
- **1999–2025:** nflverse weekly player stats, so a traded player's games count for the team he played them for. nflverse only has a row for a game a player recorded a stat in, so games played come from elsewhere: a season with one team through 2021 is Pro-Football-Reference's row (games, starts and totals, as before 1999); a name the register can't place (Ben Watson for Benjamin Watson) is matched by team, season and yards; a traded season shares Pro-Football-Reference's combined games out over its stints; otherwise a back's, receiver's or tight end's games are the weeks his team played and the weekly rosters list him as active (exact for about 90% of players in 2002–2015 and 2020–2025; the 2016–2019 files don't mark game-day inactives, so there it's the games he recorded a stat in). Positions are each season's roster position.
- **Scores:** FiveThirtyEight's game results (to 1998) and nflverse schedules (1999 on): every team's record, points for and against, and playoff run.

Rebuild it with `npm run data` (downloads into `.cache/nfl/`).

**Coverage:** 1970 through 2025, all 32 franchises (183 team-decades, 5,506 lines), and 634 playoff teams.
- A cell is a franchise-decade with its name that decade, e.g. `LV-1980` = Los Angeles Raiders, `TEN-1990` = Houston Oilers. A season counts toward the decade it's played in.
- Lines are per-game averages over the player's seasons with that franchise in that decade. Before 1999 the source lists a traded player's split season only as a combined row with no team, so that season is left out of the lines (it still counts toward the league averages and his career rate).
- **What the game scores:** every stat is measured against that season's league average per team-game, on the 1970–2025 scale, then counted as adjusted yards: yards, plus 20 a touchdown, minus 45 an interception (the weights of adjusted net yards per attempt). Quarterbacks count passing and rushing; everyone else rushing and receiving. A short stint is blended with the player's career rate as if he had played 4 more games.
- **One scale for every position:** each position's adjusted yards are mapped onto the value distribution of basketball's rotation players, so a 95th-percentile tight end is worth what a 95th-percentile quarterback is, and Legendary means the same in both sports. Above the 98th percentile the map goes by yards rather than rank, so two near-equal lines at the top are worth about the same (the 1970s Rams and Vikings defenses: 23.6 and 23.5). A defense is valued by points saved against the league average and goes by its team's name that decade (the 1990s Oilers).
- **Positions** are the player's most-played position over his career (fullbacks count as running backs). Quarterbacks need 4 starts and 100 attempts in a cell, backs 6 games and 40 touches, receivers and tight ends 6 games and 15 catches. Each cell lists up to 5 quarterbacks, 9 backs, 12 receivers and 6 tight ends.
- **Playoff opponents** are every team that made the playoffs, with its record over 17 games (the 1982 strike season's 6–3 Chargers count as 11–6).
- From 1999 the weekly sums match nflverse's own season totals for every player (checked for 2010, 2018 and 2025: about 1,900 players a season, no differences).
- Fixed in the sources: in the Jaguars' 2001 and 2002 home games every nflverse row carries the visitors' team, so those games go to the team on each player's roster; three games have no nflverse weekly rows (1999 Ravens–Rams, 2000 Chargers–Chiefs and Bills–Dolphins), which the Pro-Football-Reference rows cover; two players the register can't tell apart in some seasons take the id they have with the same team in a nearby season (the Jaguars' James Stewart); and a player whose name differs between the sources keeps one career across 1999 (Rocket and Raghib Ismail, Cam and Cameron Cleeland, Robby Anderson and Robbie Chosen).
- Spot-checked against Pro-Football-Reference: Jerry Rice's 1980s 49ers line (76 games, 4.6 catches, 83.7 yards, 0.87 touchdowns a game), Payton, Marino, Manning, Brady, Mahomes, the 1985 Bears (15–1, 198 points allowed) and every Super Bowl winner since 1970.

### Basketball

`src/data/nba.json` is generated by `scripts/build_nba_data.py` from Basketball-Reference season totals, using the public [sumitrodatta/bball-reference-datasets](https://github.com/sumitrodatta/bball-reference-datasets) repository. Rebuild it with `npm run data` (downloads into `.cache/raw/`).

**Coverage:** every NBA player from 1959–60 through 2025–26: 4,506 players, all 30 franchises, every franchise-decade they played in (180 team-decades, 14,174 player lines). ABA seasons are not included. The 2026–27 season starts after this build; rerun `npm run data` to add it.

- A cell is a franchise-decade with the franchise's name in that decade, e.g. `GSW-1960` = San Francisco Warriors.
- A season counts toward the decade it ends in.
- Player lines are games-weighted per-game averages over all of that player's seasons with that franchise in that decade. Every player who appeared counts, even for one game; the drawer shows games played.
- **What the game scores:** each line also has a rated version (`r` in the engine). Each season's stats are measured against that season's league average per team-game, on the 1960–2026 average scale. A 1959–60 team grabbed 73.5 rebounds a game and a 2004–05 team 41.9, so raw numbers would make the early decades a jackpot.
  - Rated this way, real teams' top-5 players predict their actual records better: correlation 0.48, against 0.39 for raw stats across 1960–2026.
  - A short stint is blended with the player's career rate as if he'd played 10 more games at it.
  - The drawer always shows the real stats.
- Steals and blocks before 1973-74 are estimated by regression and flagged.
- **Positions** are career positions: each season's listed position, weighted by games. Positions with at least 12% of a player's games are kept, up to three (LeBron SF/PF, Magic PG/SG, Jordan SG/SF, Ewing C). The few 1960s and 1970s players with no listed position get the nearest one by their rebound and assist profile.
- **Namesakes:** when two players share a name (Patrick Ewing and his son), the one with the longer career keeps the plain name. The other gets the years he spent with that team, e.g. "Patrick Ewing (2010–11)".

**Audit:** `python3 scripts/audit_nba_data.py --bbref 40` checks the data four ways, plus a live spot check:

1. Each team-season's player totals equal the team's own totals, so no player is missing.
2. Traded players' per-team rows add up to their season totals.
3. Every line in `nba.json` matches a fresh recomputation from the source.
4. Every franchise-decade with NBA games exists.
5. A spot check against Basketball-Reference player pages.

Last run (October 2026): 1,595 team-seasons, 2,656 traded seasons and 14,174 lines with no issues. 130 of 130 lines matched Basketball-Reference exactly: every team-decade of 30 stars, plus 40 random role players from the 1960s to the 2020s.

Two notes on the source data:

- Before 1968–69, team rebound totals include team rebounds that were never credited to a player, so the audit skips that one comparison for those seasons.
- Basketball-Reference already shows the first games of 2026–27, which the audit leaves out.
- **Before a public launch:** check the data source's terms, and team names and colors for trademark use. No logos are used.

## Code map

| Path | What it does |
|---|---|
| `src/engine/` | Pure game logic with no UI: `sport` (which sport this page plays), `data` (player database), `rating` (score, balance, win curve, grades), `draft` (rules reducer, respins, bot, boosters), `season` (with football scores), `playoffs`, `economy` |
| `src/engine/*.test.ts` | Rule tests, plus `sim.test.ts`, which prints win and title distributions for random, best-available and smart drafting |
| `src/stage.tsx` | Fits the 390px-wide frame to the screen, reads the safe-area insets, and picks a height class (`fit-compact`, `fit-tight`, `fit-normal`, `fit-roomy`) |
| `src/ui/` | React screens: `Welcome` (first-launch name), `Search` (matchmaking), `Draft`, `Season` (reveal, playoffs, champion screen), `Scout` (opponent scouting sheet), `Results`, `Leaderboard` (global board, name sheet), `Rewards` (daily chest, missions), `Pages` (home, tabs, settings, how to play) |
| `src/ui/sportui.ts` | What the screens show differently per sport: stat columns, sorts, records, wording |
| `src/ui/motion.tsx`, `src/ui/Hero.tsx` | View transitions, count-ups and sparks; the animated arena behind the home scoreboard |
| `src/lib/` | `profile` (saved progress), `sound` (Web Audio: recorded game sounds from `src/assets/sfx`, made by `scripts/build_sfx.py`, and synthesized menu sounds; vibration), `share` (share text and card image), `names` (name rules and random names), `update` (service worker and auto-update) |
| `src/net/` | `nostr` (relay pool, keys, signing), `leaderboard` (entries, checks, ranking), `match` (presence, matchmaking, the live match channel) |
| `src/engine/online.ts`, `rarity.ts`, `missions.ts` | Head-to-head rules (shared cell order, redraws, shot-clock pick), rarity tiers, daily missions and the reward streak |
| `pwa/sw.js` | Service worker template; `vite.config.ts` fills in the version and file list |

## Tuning (all in `src/engine`)

| Constant | Value | Effect |
|---|---|---|
| Rated lines (`build_nba_data.py`) | each season against its own league; `SHRINK_GAMES = 10` | Every decade's best players score about the same (within 8%). A one-game cameo counts near the player's career rate |
| `BENCHMARK` (rating.ts) | 125 / 51 / 31 / 16 | The "near-perfect lineup": about the 97th percentile of skilled drafts in points, rebounds, assists and defense |
| `WIN_CURVE` (rating.ts) | quantile anchors, (23.5, 18) to (109.1, 82) | Random picks: median 30 wins. Best available: 52 / 57 / 64 at the 10th / 50th / 90th percentile. 82-0 in about 0.2% of unboosted drafts |
| Football `BENCHMARK`, `WIN_CURVE` | 23.2 / 38.3 / 70.7 / 23.5, run and catch together 89.7; (51.1, 4) to (133.1, 17) | Balance compares passing, the run and catch game together, and defense, so the FLEX can be a back or a receiver. Random picks: median 6 wins. Best available: 11 / 12 / 13. 17-0 in about 0.1–0.2% of drafts; titles 7% (best available) and 10% (smart), like basketball |
| Football playoffs | `SERIES_K` 10, pools 10–11 / 11–12 / 12–14 / 14+, 10 wins to get in, home edge 6% | One game a round: a 12-win team wins the Super Bowl about 4% of the time, a 14-win team 28%, a 17-0 team 64–73% |
| `SERIES_K`, `ROUND_POOLS`, `PLAYOFF_MIN_WINS` (playoffs.ts) | 12; 50–55 / 55–59 / 59–63 / 64+; 50 | 50 wins make the playoffs. Title odds: 62 wins ≈ 12%, 70 wins ≈ 45%, 82-0 ≈ 88%. 16-0 after 82-0 ≈ 4% |
| Bot levels (draft.ts, App.tsx) | Rookie / Pro / Legend | Against a player who takes the best available: you win about 94% / 68% / 39% (football: 93% / 71% / 45%). You start against Rookie, a coin flip decides Pro, Legend always starts |
| `economy.ts` | rewards, prices, level curve | See SPEC §7 |
