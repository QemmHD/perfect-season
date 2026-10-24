# Perfect Season (NBA)

Spin a random NBA team and decade, draft five players who played for them, and try to go 82-0, then 16-0 in the playoffs.
Product spec: [`docs/SPEC.md`](docs/SPEC.md).

## What's in this build

- **Modes:** Classic, Blind (stats hidden, +50% rewards), Daily (same spins for everyone, first try ranked, resets at midnight US Eastern), and Head to Head.
- **Head to Head, live against real players:**
  - Quick Match finds whoever else is searching. After 30 seconds with no one around, the AI (Rookie, Pro or Legend) steps in, or you can play it right away.
  - Play a Friend: make a 4-letter code and send it, or share an invite link (`?room=CODE`).
  - Both players draft from the same five team-decades, taking turns going first, with a 25-second shot clock. Run out of time and the best fit is picked for you.
  - If the other player leaves or their phone drops for 20 seconds, the AI finishes their draft and you win by forfeit. A 10-second blip (a notification, a quick app switch) changes nothing.
- **Online without accounts or a server:** everything goes over five public [Nostr](https://nostr.com) relays at once, so one going down changes nothing. Each phone signs its messages with its own key, so nobody can post as you.
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
- **Sound and saving:** synthesized sound effects, vibration on Android, and haptic ticks on iPhone (iOS 18+). Progress is saved in the browser (localStorage).
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
npm test             # engine rules + calibration simulation
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
| `src/engine/` | Pure game logic with no UI: `data` (player database), `rating` (score, balance, win curve, grades), `draft` (rules reducer, respins, bot, boosters), `season`, `playoffs`, `economy` |
| `src/engine/*.test.ts` | Rule tests, plus `sim.test.ts`, which prints win and title distributions for random, best-available and smart drafting |
| `src/stage.tsx` | Fits the 390px-wide frame to the screen, reads the safe-area insets, and picks a height class (`fit-compact`, `fit-tight`, `fit-normal`, `fit-roomy`) |
| `src/ui/` | React screens: `Welcome` (first-launch name), `Search` (matchmaking), `Draft`, `Season` (reveal, playoffs, champion screen), `Scout` (opponent scouting sheet), `Results`, `Leaderboard` (global board, name sheet), `Rewards` (daily chest, missions), `Pages` (home, tabs, settings, how to play) |
| `src/ui/motion.tsx`, `src/ui/Hero.tsx` | View transitions, count-ups and sparks; the animated arena behind the home scoreboard |
| `src/lib/` | `profile` (saved progress), `sound` (Web Audio + vibration), `share` (share text and card image), `names` (name rules and random names), `update` (service worker and auto-update) |
| `src/net/` | `nostr` (relay pool, keys, signing), `leaderboard` (entries, checks, ranking), `match` (presence, matchmaking, the live match channel) |
| `src/engine/online.ts`, `rarity.ts`, `missions.ts` | Head-to-head rules (shared cell order, redraws, shot-clock pick), rarity tiers, daily missions and the reward streak |
| `pwa/sw.js` | Service worker template; `vite.config.ts` fills in the version and file list |

## Tuning (all in `src/engine`)

| Constant | Value | Effect |
|---|---|---|
| Rated lines (`build_nba_data.py`) | each season against its own league; `SHRINK_GAMES = 10` | Every decade's best players score about the same (within 8%). A one-game cameo counts near the player's career rate |
| `BENCHMARK` (rating.ts) | 125 / 51 / 31 / 16 | The "near-perfect lineup": about the 97th percentile of skilled drafts in points, rebounds, assists and defense |
| `WIN_CURVE` (rating.ts) | quantile anchors, (23.5, 18) to (109.1, 82) | Random picks: median 30 wins. Best available: 52 / 57 / 64 at the 10th / 50th / 90th percentile. 82-0 in about 0.2% of unboosted drafts |
| `SERIES_K`, `ROUND_POOLS`, `PLAYOFF_MIN_WINS` (playoffs.ts) | 12; 50–55 / 55–59 / 59–63 / 64+; 50 | 50 wins make the playoffs. Title odds: 62 wins ≈ 12%, 70 wins ≈ 45%, 82-0 ≈ 88%. 16-0 after 82-0 ≈ 4% |
| Bot levels (draft.ts, App.tsx) | Rookie / Pro / Legend | Against a player who takes the best available: you win about 94% / 68% / 39%. You start against Rookie, a coin flip decides Pro, Legend always starts |
| `economy.ts` | rewards, prices, level curve | See SPEC §7 |
