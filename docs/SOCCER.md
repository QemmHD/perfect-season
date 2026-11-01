# Soccer, the third sport

**Implemented by Claude (Anthropic), 2026-11-01, branch `claude/soccer-data`. Not deployed.** Soccer
joins NBA and NFL with the same reload model: pick **NBA · NFL · SOCCER** on Home and the app reloads
into that sport. The data and card pipeline is in [SOCCER-DATA.md](SOCCER-DATA.md), the match engine
in [SOCCER-ENGINE.md](SOCCER-ENGINE.md). Basketball and football saves, queues, ratings and screens
are unchanged.

## For players

### The draft game

- **Spin** a club and a decade (forty big clubs of the Premier League, LaLiga, Serie A, Bundesliga,
  Ligue 1, Eredivisie and Primeira Liga, 1950s to 2020s) and pick anyone who played for them then.
  Eight rounds fill **GK, CB, FB, DM/CM** (a holder or a central midfielder), **CM/AM, W, ST** and a
  **FLEX** (any outfielder). The list shows goals and assists a season (a keeper's clean sheets) and the
  line's rating; sort by value, goals, assists, rating or games.
- Your team is scored on **attack, midfield, defense and goalkeeping** against a near-perfect lineup; a
  weak area drags the whole team down.
- The **38-game league season** plays out: three points a win, one a draw (the season screen counts
  W–D–L and points, matchday by matchday with every score). **22 wins** reach the cup.
- **The cup**: four one-game knockout rounds (Round of 16, Quarter-final, Semi-final, Final) against
  the great champions of 2012-13 to 2025-26, the better record at home, the Final on neutral ground.
  **Level after 90 minutes goes to penalties.** Each game is told live (GameCast: halves, goal minutes,
  scorers and assists, win probability, and the shootout).
- **Perfect Season**: 38–0, then all four cup games won inside 90 minutes.
- Daily, Blind, Head to Head (against the AI or a real player), the Legends Gauntlet (eight great
  champions, three lives), missions, the Binder (a club-decade's set is its best keeper and seven best
  outfielders), the share poster and its own **soccer leaderboards** all work as in the other sports.

### Head to head: the match

After a 1 vs 1 draft you play your **attacks** on the real engine (six and one in stoppage time) while
the rival plays theirs: most goals wins, **level goes to penalties**. Controls: the joystick runs,
SPRINT (stamina), PASS (tap; hold to cross or loft), THRU (a through ball), hold SHOOT and let go in the
green (the stick aims in the goal). Against the AI a level match is settled by a shootout you take and
keep goal in; online both phones show the same agreed shootout. SIM MY ATTACKS lets the autopilot play
them. Your favorite club (Profile → Favorite teams now has a soccer tab) is your kit.

### Ultimate Team

- **Cards** show FC-style tiers (Bronze < 65, Silver 65–74, Gold 75+), the overall and **six stats**:
  PAC SHO PAS DRI DEF PHY, keepers DIV HAN KIC REF SPD POS. PAC, DRI and DEF are estimates
  (SOCCER-DATA.md). Hot Season promos (Ballon d'Or, Golden Boot, player of the season, champions...) and
  132 Legends carry their own overall. Levels add +1 to each stat per level and +1 overall at levels 3 and 5.
- **Squad**: eleven on a pitch, in **4-3-3** (default), **4-4-2, 4-2-3-1 or 3-5-2**. Changing formation
  keeps players in the roles both shapes share and fills new spots from your club.
- **Chemistry** links neighbours on the pitch: same club +4, same league +2, same season +1; six makes
  a full link (the data has no nationalities). Full chemistry adds 3 to the team overall.
- **Packs** (Bronze to Premium, Position packs by line: GK, defenders, midfielders, attackers, Daily
  Drop, Elite, Jumbo, Standout Guarantee, Lightning, Scout's Choice, Preview Pack), the **Scout Market**,
  **SBCs**, **Objectives**, the **Season Pass**, **Weekly Standouts**, Evolutions, Squad Battles,
  Champions Circuit, UT Draft and **Rivals** (online) all run on soccer cards.
- **Not in soccer yet** (left out cleanly, not shown): Club Season, Legends Events, Moments, Spotlight
  and GOAT editions and the Spotlight pack (a Spotlight prize becomes an Elite Gold pack), serial
  numbers (no card registry for soccer: numbering is simply absent), Landmark Seasons, the Live Calendar
  (This Season, program packs, season SBCs) and Training Camp.

## For developers

### The sport layer

- `src/engine/sport.ts`: `SportId = 'nba' | 'nfl' | 'soccer'` (and `UtSport`), `SPORTS`, `isSport`,
  `SOCCER_ON` (false in the single-file artifact build), and **`pick({ nba, nfl, soccer })`** /
  **`pickFor(sport, { ... })`**, which need all three answers. `SPORT_LABEL`, `SPORT_NAME`.
- Every sport branch on a soccer code path names all three sports. **`src/engine/sport-branches.test.ts`**
  reads the sources and fails on a two-way branch (`NFL ? a : b`, `!NFL`, `if (NFL)`,
  `sport === 'nba' ? a : b`, also split over lines) outside the basketball/football engines and the
  modules soccer never reaches (Club Season, Moments, listed in the test).
- Home's switch: `SportSwitch` in `src/ui/Pages.tsx` (three segments), `switchSport` reloads.

### Loading: nothing of soccer in an NBA/NFL page

- `src/engine/soccer-raw.ts` loads `soccer.json` with a **top-level await** only when the page plays
  soccer; `engine/data.ts` builds the cells from it. The web build targets `es2022` (iOS Safari 15+)
  for that. The artifact build (one IIFE) aliases it, and `src/soccer-lazy.ts`, to `*.artifact.ts`
  stubs and plays NBA/NFL only.
- `src/soccer-lazy.ts`: `loadSoccerGame()` (the engine and its glue, `src/game/soccer2/arcade.ts`) and
  `loadSoccerCards()` (`cards-soccer.json`), each its own chunk.
- `vite.config.ts` leaves soccer-only chunks (soccer2, pitch, `soccer.json`, `cards-soccer.json`) and
  `soccer-*.mp3` out of the service worker's install precache; the worker's cache-first fetch keeps them
  after their first use (offline soccer needs one online visit per deploy). Measured 2026-11-01 against
  the branch base (9d2bcc4): NBA/NFL precache 17.46 MB → 17.52 MB (+54 KB of code, no soccer data or
  sound), the page's static entry graph 3.71 MB → 3.76 MB (gzip 1.19 → 1.22 MB); soccer data chunks
  `soccer.json` 1.0 MB (0.30 MB gz) and `cards-soccer.json` 3.7 MB (1.0 MB gz) load on first use.
- `npm run build` gives Vite a 4 GB heap (the extra 4.7 MB of JSON tipped the default over).

### Saves (additive)

- New profile key **`perfect-season:profile:soccer:v1`**, the same split as football's: its own part
  there, the shared part (coins, XP, boosters, settings, name, streak...) in basketball's profile.
  `src/lib/profile.ts`: `PROFILE_KEYS`, `OTHER_SPORTS`, `readOtherLbs()`, `updateOtherLb(fn, only?)`,
  `resetOtherSport()` cover every other sport.
- `src/lib/recovery.ts`: soccer's profile, checkpoint and training keys join `RECOVERY_KEYS` **after**
  the original ones, as `OPTIONAL_KEYS`: a save without them (every older save) validates, restoring it
  leaves the phone's soccer progress alone, and a player who never played soccer saves exactly what
  older builds wrote (`captureProgress` leaves empty soccer keys out). An older build reading a server
  save that holds soccer progress refuses it ("incomplete or invalid", its device save kept) until it
  updates.
- Favorites gain an optional `soccer` club; stored only when set (`perfect-season:fav` unchanged otherwise).
- UT state gains optional `ut.formation` (`src/ut/state.ts`).

### Draft engine

`engine/data.ts` (soccer rows → `Player`: `role`, `roles`, `sub`, slots from `SOCCER_SPOTS`),
`engine/rating.ts` (`soccerValue`, `soccerParts`, benchmark and win curve calibrated by
`sim.test.ts` with `CALIB=1`: random drafts' median 14 wins, best-available 24/26/30 at p10/50/90, top
0.15% 38-0; grades; `soccerDraws` about half the non-wins, at most 12), `engine/season.ts` (`DRAW = 2`
in `seq`, `recordOf`, Poisson scores, `expectedGoals`), `engine/playoffs.ts` (`soccerTie`,
`soccerTieOdds`, `shootoutScore`, `Series.pens`; a shootout win isn't a "sweep"), `engine/broadcast.ts`
(two halves, scorers and assists, the shootout line), plus missions, rewards, rarity (soccer's own
cut-offs), collection, gauntlet and every screen in `src/ui`.

### The match in the app

`src/game/Arcade.tsx` mounts `Soccer2` (loaded lazily): POINTS `G` 1 and the other letters 0, seven
attacks a side, the AI's via `aiAttacksOf`, kits from the favorite clubs (`soccerKitsFor`), difficulty
through the existing `defenseDifficulty` (Squad Battles levels, Legend online). Drafted lineups become
elevens in `soccer2/arcade.ts` (`draftSquad`: the eight drafted, face stats estimated from the line's
overall and sub-ratings, plus squad players for the three spots a draft doesn't fill); UT squads via
`cardSquad`. A level match: `onFinish(..., pens)`; online and in sims both phones compute
`agreedShootout` (the host's eleven kicks first, `simShootout` on the match seed) and `Soccer2` shows it
kick by kick (`fixedShootout`); against the AI the shootout is played on the pitch.

**Online queues**: soccer draft head to head `NET_V = 'ps1-soccer-' + DATA_V + '-1'`, its own match
namespace `perfect-season/soccer/v1`; UT soccer `UT_RULES.soccer = 1`. NBA (draft 10 / UT 10) and NFL
(draft 10 / UT 11) are unchanged. Leaderboards: `perfect-season/soccer/v1`.

### Set pieces (tuned 2026-11-01)

`SP_TUNE` in `soccer2/engine.ts`. The autopilot (skill 0.75) scored about a third of corners and free
kicks and 79% of penalties. Now (300 attacks each, three real matchups, `setpieces.test.ts`):

| | Before | After | Target |
| --- | --- | --- | --- |
| Corners | 33.7% | 11.6% | 8–12% |
| Free-kick attacks (direct free kicks ~10% of shots) | 28.3% | 12.9% | 10–15% |
| Penalties | 79.0% | 74.9% | ~75% |
| Build-up / counter / wide (unchanged) | 14.0 / 11.3 / 12.7% | 14.4 / 11.3 / 12.4% | |

Levers: a corner's box is marked (a defender within 3.2 m goes up, wins from 0.8 base), its headers are
worse contacts (cone ×3.8) and the keeper commands more of his box; a direct free kick has a narrower
green (×0.7), a wider cone (×4.2) and a set keeper (reacts and reads sooner); a penalty keeper guesses
right 15 points more often, the green a little narrower.

### Sounds

Mixkit soccer SFX (Mixkit Sound Effects Free License) through `scripts/build_sfx.py`: `soccer-roar`
(#3022), `soccer-chant` loop (#438), `soccer-kick-1/2` (#2108, #2112), `soccer-bounce` (#2077),
`soccer-whistle` full time (#614). `src/lib/sound.ts` venue `'pitch'` uses them; basketball and
football never load them, and they are not precached (above). Credits table in CREDITS.md.

### Tests and QA

- `npm test` runs NBA, NFL, then `PS_SPORT=soccer vitest run soccer sport-branches`: `soccer-data`,
  `soccer-draft` (league, cup, pens, missions, gauntlet, GameCast), `soccer.test.ts` and
  `setpieces.test.ts` (engine), `soccer-saves` (also runs in NBA/NFL: additive keys, old-shaped
  profiles and snapshots round-trip), `soccer-ut` (cards, faces, formations, refit, chemistry, packs,
  Store, Squad Battles, Standouts, SBCs, the wire, the agreed shootout), `sport-branches`.
- `scripts/qa/soccer-app.mjs [all|switch|draft|arcade|ut|widths]` (Chromium, dev server + local relay):
  NBA → SOCCER switch keeping the other saves; draft → W-D-L season → cup with GameCast → results; a
  1 vs 1 draft and an autopilot match on the real engine; a fresh UT starter pack → pitch squad and
  formation change → a Squad Battles match → Store (no Spotlight); Home, draft, UT Home/Squad/Store at
  430, 390 and 320. Fails on any page error.

### Known limits

- The phone-feel of the soccer controls (two thumbs, meter timing) needs an owner playtest on an iPhone.
- An offline-installed app needs one online soccer visit per deploy before soccer plays offline.
- Hidden for now (above): Club Season (it needs a 20-club/38-game season with draws), Legends Events,
  Moments, Spotlight/GOAT and serials (the registry's sport CHECK allows nba/nfl only: an owner
  migration), Landmarks, the Live Calendar, Training Camp.
