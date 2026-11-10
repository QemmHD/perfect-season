# American football research: how the respected games play, and real NFL calibration targets

Track: American football (NFL engine `src/game/football2`, NFL Ultimate Team).
Prepared 2026-11-09 for the Perfect Season studio overhaul. Research only: no repo files were edited.

The report has four parts:

1. Real NFL numbers to calibrate against, computed from nflverse play-by-play data.
2. How the reference games play: Madden NFL 25/26/27 (console and PC), College Football 25/26/27, Madden NFL Mobile, Retro Bowl and Retro Bowl College, NFL Blitz and Tecmo Super Bowl. For each, what players like and dislike.
3. How football Ultimate Team handles packs, odds, promos, chemistry and events, on console and on mobile.
4. Concrete recommendations for Perfect Season, with numbers.

A note on the date: it is now November 2026, so **Madden NFL 27 and College Football 27 are the current games** (they launched in August 2026). Madden 25/26 remain the main references, as the brief asked. Where the 27 games changed something useful, such as timing-based catching or the Tackle Stick, it is noted.

---

## 0. The 20 most important findings (summary)

1. **Our measured NFL outputs differ from the real game in specific places.** The repo's own measurements show 58% completions, 0.8% interceptions per attempt and 10% sacks per dropback (`docs/GAMEPLAY-RESEARCH.md` in the repo). Runs gain 2.3–3.3 yards a carry against an elite defense and 4.3–5.2 against an average one (ARCADE-V2.md). The real 2024–25 league averages are **64–65% completions, 2.2% interceptions, a 6.9% sack rate and 4.3 yards per designed run** (median 3 yards), with 10–11% of runs gaining 10 or more yards (nflverse data, section 1). Interceptions are about 2.7× too rare and sacks about 1.5× too common.
2. **Calibrate passing by throw depth, not one global number.** By air yards in 2024 the figures are:

   | Air yards | Completion | Interception |
   |---|---|---|
   | Behind the line | 79% | 0.8% |
   | 0–9 | 72% | 1.2% |
   | 10–19 | 55% | 3.4% |
   | 20+ | 35% | 6.3% |

   About half of all throws are 0–9 air yards and 11% are 20+.
3. **The run distribution matters more than the run average.** In 2024, 18.6% of designed runs gained zero or lost yards and 36% gained 1–3. Another 24% gained 4–6, 10.9% gained 7–9, 8.4% gained 10–19, 1.7% gained 20–39 and 0.5% gained 40+. The 90th percentile is 10 yards and the 99th percentile is 29.
4. **Third down depends on distance.** Conversion rates are 67–70% on 3rd and 1 and 52–55% on 3rd and 2–3. They fall to 43–45% at 4–6 yards, 31–32% at 7–10 and 14–16% at 11 or more. The overall rate is 39.5–39.7%.
5. **Drive results.** A typical drive ends in a touchdown 23% of the time, a field goal 16%, a punt 34%, a turnover 10% and a turnover on downs 5–6%. Teams average 10.6–10.8 drives a game and about 2.1 points per drive. Red-zone trips end in a touchdown 57–58% of the time and score some points 87% of the time.
6. **Scores and margins have shape.** The average is 23.0 points per team-game (median 23, 10th percentile 10, 90th percentile 36–37). The most common team scores are 20, 24, 27 and 17. The most common margins are **3 (14–15% of games)** and **7 (7–10%)**. About half of games are within one score entering the 4th quarter. The home team wins 53.5% of games, and 5–6% go to overtime.
7. **Madden 26/27 build depth from readable, timing-based skill checks.** The Hit Stick has a timing indicator under the defender showing power, squareness and timing, and the defender's ratings widen its window. Madden 27 catching uses a release meter: slightly early, perfect or late. Bullet passes reward meter timing. All of these can be reduced to a tap or a release that suits a phone.
8. **Madden 26 rebalanced superstar abilities.** Effects that used to be guaranteed now fire about **50% of the time** when their conditions are met. X-Factors have explicit triggers and knockouts, for example "one completion of 30+ air yards" to activate and "one sack" to knock out. Madden 27 adds Hot/Cold player states, and ability tiers that add new effects instead of bigger numbers.
9. **Pass coverage became physical and readable.** On a man-coverage cut, a receiver gains about **1 step on an outside-leverage cut and 2–3 steps on an inside-leverage cut**. Defenders must be **facing the ball** to try an interception; otherwise they swat it. That removes "psychic" interceptions.
10. **QB vision and identity.** Madden 26 and College Football 26 use height-based **Field Vision**: shorter QBs lose accuracy throwing through blocked lanes, and the receiver icons fade. QB awareness sets how many reads the QB gets through. Madden 26 added 9 ball holds, 3 arm slots, 40 QB "recipes" and 500+ new QB animations. Signature traits are how stars feel like themselves.
11. **College Football's atmosphere works through what the player sees.** Stadium Pulse shakes the screen, hides receiver icons and scrambles play art for the road team only. A visiting gain of 20+ yards that earns a first down quiets the crowd. In hostile stadiums the kick meter fades out. A Composure rating and abilities offset the effects. Madden 27 turns home-field advantage **off in online Ultimate Team**.
12. **Madden Mobile's main lessons are about pacing.** Players like auto-play for grinding, very short games (quarters of 1, then 1.5, then 2 minutes) and VS Mode, where both players face identical bite-size scenarios. They dislike slow stamina regeneration, pay-to-win, overalls above 99, a whistle after every play and controls that are "acceptable at best".
13. **Retro Bowl is the proof that our control scheme works on phones.** It has a 4.8★ rating from 937K App Store ratings, an Editors' Choice badge and a 46 MB download. The core is drag-to-throw with a visible aim line, a second-finger tap to switch between bullet and lob, and swipe moves. Stiff arms and hurdles trigger automatically from player attributes, and trucking uses a hold-to-charge meter. The management loop is light (credits earned from fan support, press conferences, morale and facilities), so a season takes "a couple of hours". Reviewers' complaints: interceptions come too easily, fumbles, and repetition.
14. **NFL Blitz and Tecmo Super Bowl were about getting to the snap fast.** Blitz used 7 players a side, 30-yard first downs, 2-minute quarters (about 12-minute games) and no penalties. A team went **On Fire after 3 straight catches by one receiver or 2 sacks in a row**. A turbo meter fed every special move. Tecmo had an 8-play book in which a correct defensive guess means instant pressure, two buttons, 5-minute quarters, and star players who were near unstoppable.
15. **Football Ultimate Team packs disclose odds as "chance of at least one item in this band".** A band shown at 100% is a guarantee, and every opening is independent. Example from MUT 20: a 6-item Gridiron pack showed Gold 75+ at 100%, Elite 80+ at 39%, 83+ at 13% and 85+ at 5.2%.
16. **MUT 26's weekly structure.** It had a 12-game weekly Solo Champions gauntlet and Solo Seasons where 10 wins reach the playoffs. Sick Six allowed 3 runs a week. Limited-time cards stayed available for **1 week** (previously 3 days). A shared-token Weekly Spotlight Pass covered several programs, and Team of the Week cards dropped weekly, usually on Wednesday.
17. **Promos are themed events with several earning paths.** Most Feared ran **October 16 to November 11**. It had login-reward cards, an upgrade currency shop, "Detective Sets" where you guess a hidden card's identity, H2H event cards upgradeable to 90, a replayable solo challenge and a raid boss. The mobile version had one star card with **21 upgrade variations up to Mythic**, regenerating currency (1 every 50 seconds, capped at 600) and two daily code drops.
18. **Chemistry tiers in MUT.** There are **10 tiers, one for every 5 matching components**, each giving +1 to two attributes, so all 10 tiers add +20 attribute points. Components include players, coach, uniforms and stadium.
19. **Card identity and animation.** Madden 26 claims 700+ new tackle animations, 700+ catch animations (Madden 25), 16 signature QB sets and 4,000+ celebration elements. The lesson for pixel art is **variety and signature behaviour for the top ~100 cards**, not frame count alone.
20. **Protocol.** Any NFL physics or rating change from this report changes match outcomes. That requires bumping **NFL draft 10 → 11 and NFL Ultimate Team 11 → 12**, with NBA and soccer unchanged.

---

## 1. Real NFL calibration data

### 1.1 Method

The brief's suggested sources (Pro-Football-Reference, the NFL Football Operations site) block automated fetching (HTTP 403), so I used the public nflverse play-by-play files instead.

- **Source:** [nflverse play_by_play releases](https://github.com/nflverse/nflverse-data/releases/tag/pbp)
- **Seasons:** 1999, 2005, 2015, 2024 and 2025, regular season only, 272 games each for 2024 and 2025.
- **Scripts (read-only analysis):** `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/fbscripts/nflstats.py`, `nflextra.py`, `nflextra2.py` and `nflspread.py`.
- **Raw outputs:** `out_recent.txt`, `out_eras.txt`, `out_extra.txt`, `out_spread.txt` and `out_2025b.txt`, in the same folder.

**Definitions:**

- **Plays:** pass dropbacks (including sacks and scrambles) plus designed runs, excluding kneels and spikes.
- **Designed runs:** run plays excluding QB scrambles.
- **Sack rate:** sacks ÷ (attempts + sacks).
- **Turnover on downs:** a "Turnover on downs" drive result.

These can differ slightly from Pro-Football-Reference conventions; PFR, for example, counts kneels as rushes.

### 1.2 League averages per team-game

| Metric | 2024 | 2025 |
|---|---|---|
| Points | 22.9 (median 23; P10 10; P90 35.7) | 23.0 (median 23; P10 10; P90 37) |
| Offensive plays (excluding kneels/spikes) | 61.5 | 60.6 |
| Total yards | 338 | 328 |
| Yards per play | 5.50 | 5.41 |
| Pass share of plays (dropbacks) | 57.2% | 56.9% |
| Dropbacks | 37.2 | 36.5 |
| Pass attempts | 32.8 | 32.1 |
| Completion % | 65.2% | 64.3% |
| Yards per attempt | 7.13 | 7.02 |
| Net yards per attempt (includes sacks) | 6.19 | 6.09 |
| Yards per completion | 10.9 | 10.9 |
| Yards after catch per completion | 5.30 | 5.14 |
| Average depth of target | 7.7 | 7.8 |
| Sacks | 2.42 (6.86% sack rate; −6.6 yards each) | 2.37 (6.87%; −6.5 yards) |
| QB hits per dropback | 14.9% | 15.4% |
| Scrambles per dropback | 5.3% (7.9 yards each) | 5.5% (7.5 yards each) |
| Interception % | 2.17% (0.71 a game) | 2.18% (0.70 a game) |
| Pass TD % | 4.54% (1.49 a game) | 4.65% (1.49 a game) |
| Designed runs | 24.4 | 24.1 |
| Designed-run yards per carry | 4.32 (median 3) | 4.27 (median 3) |
| All rushes yards per carry (with scrambles) | 4.58 | 4.52 |
| Rush TDs | 0.94 | 0.94 |
| Fumbles lost | 0.43 (0.75% per designed run) | 0.40 (0.62% per designed run) |
| Turnovers | 1.15 | 1.10 |
| First downs | 18.3 | 17.8 |
| Success rate (EPA-style) | 43.9% | 44.0% |
| Shotgun rate | 70.3% | 65.9% |
| No-huddle rate | 12.1% | 9.8% |
| Penalties | 6.4 for 52 yards | 6.4 for 51 yards |
| Game clock per snap (scrimmage and kicking plays) | 23.8 s | 24.2 s |

Points per game agree with the NFL's own reporting: 2025 averaged 23.3 through Week 4, and the record is 24.8 in 2020 ([NFL Football Operations](https://operations.nfl.com/updates/the-game/dynamic-kickoff-making-leaguewide-impact-on-offense-through-week-4)).

### 1.3 Passing by depth (air yards), 2024 and 2025

| Air yards | Share of attempts | Completion % | INT % | YAC per completion | Yards per attempt |
|---|---|---|---|---|---|
| Behind the line | 18.3% / 17.8% | 79.0% / 76.8% | 0.80% / 0.84% | 9.5 / 9.1 | 4.8 / 4.3 |
| 0–9 | 49.6% / 49.1% | 72.1% / 71.6% | 1.23% / 1.57% | 4.1 / 4.1 | 6.0 / 5.9 |
| 10–19 | 20.8% / 21.5% | 55.0% / 53.6% | 3.39% / 3.24% | 3.7 / 3.5 | 9.7 / 9.3 |
| 20+ | 11.4% / 11.5% | 34.8% / 36.7% | 6.31% / 4.95% | 5.7 / 5.3 | 11.6 / 12.0 |

**Throw direction:** 41% right, 37–38% left, 21–22% middle.

**Completed-pass gains:**

| Gain | Share of completions |
|---|---|
| 0 or less | 4.4% |
| 1–4 | 17.4% |
| 5–9 | 34.8% |
| 10–19 | 29.8% |
| 20–39 | 11.5% |
| 40+ | 2.1% |

Passes of 20+ yards come on 8.9% of attempts, about 2.9 completions of 20+ per team-game.

**Pressure and timing (outside sources):**

- **Time to throw:** the league average was **2.81 s in 2024** and **2.86 s in 2025**, up from 2.70 s in 2020 ([PFF](https://www.pff.com/news/nfl-quarterbacks-are-holding-the-ball-longer-than-ever-the-trends-behind-time-to-throw/)).
- **Time to pressure:** the average pressure arrives at **2.9 s**, and pressure under 2.5 s counts as "quick" ([NFL Next Gen Stats](https://www.nfl.com/news/next-gen-stats-introduction-to-pressure-probability)). Our engine's "even rusher wins at about 2.9 s" already matches this (ARCADE-V2.md).
- **Clean pocket vs pressure (2024, PFF via WOKV):**

  | | Clean pocket | Under pressure |
  |---|---|---|
  | Completion | 72.1% | 48.9% |
  | Accuracy | 79.0% | 63.8% |
  | TD:INT ratio | 2.7 | 1.6 |
  | Passer rating | about 101.6 | 71.4 |

  Source: [WOKV citing PFF](https://wokv.com/news/local/how-much-does-pressure-matter-defense/2BK2ZVT4MJFLHAKDA5R6OHZNKU). Another 2024 measure puts the league's "pickable" pass rate under pressure at 5.53% and release time under pressure at 3.24 s ([The Analyst](https://theanalyst.com/2025/01/nfl-quarterback-performance-under-pressure)).

### 1.4 Rushing distribution (designed runs)

| Yards | 1999 | 2005 | 2015 | 2024 | 2025 |
|---|---|---|---|---|---|
| < 0 | 12.1% | 10.1% | 11.1% | 9.5% | 9.2% |
| 0 | 11.1% | 9.9% | 9.9% | 9.1% | 8.8% |
| 1–3 | 37.9% | 38.9% | 37.2% | 36.2% | 37.8% |
| 4–6 | 20.7% | 21.8% | 22.1% | 23.7% | 23.8% |
| 7–9 | 8.7% | 9.5% | 9.3% | 10.9% | 10.4% |
| 10–19 | 7.5% | 7.7% | 7.9% | 8.4% | 7.8% |
| 20–39 | 1.7% | 1.7% | 2.0% | 1.7% | 1.6% |
| 40+ | 0.43% | 0.45% | 0.50% | 0.52% | 0.56% |
| Yards per carry | 3.78 | 4.03 | 4.11 | 4.32 | 4.27 |

In 2024–25 the percentiles are: 10th = 0, 25th = 1, median = 3, 75th = 6, 90th = 9–10, 95th = 13–14 and 99th = 29. That is a long right tail on a median of 3.

**Where runs go:** left 36–38%, right 36–37%, middle 25–27%. By gap: end 33–36%, guard 34%, tackle 31–33%.

Teams average 2.5 designed runs of 10+ yards per team-game. Across all plays they average 3.5 plays of 20+ yards and 0.57 plays of 40+ yards per team-game.

### 1.5 Down and distance

**Pass share by down (2024–25):**

| Down | Pass share |
|---|---|
| 1st | 47.2% |
| 2nd | 58.9% |
| 3rd | 74.2% |
| 4th | 62.0% |

First and 10 gains 5.85 yards on average, and the average 2nd down is 2nd and 7.7.

**Third-down conversion by distance, with share of 3rd downs at that distance:**

| Distance | 2024 | 2025 | Share of 3rd downs |
|---|---|---|---|
| 1 | 69.6% | 67.2% | 12% |
| 2–3 | 52.5% | 54.7% | 17% |
| 4–6 | 44.8% | 43.4% | 24–25% |
| 7–10 | 32.4% | 31.1% | 27–28% |
| 11+ | 14.5% | 16.1% | 18–19% |
| All | 39.7% | 39.5% | 12.6 attempts a game |

Fourth downs: 1.4–1.6 attempts per team-game, converted 55–57% of the time.

### 1.6 Drives, red zone and field position

**Drive results:**

| Result | 2024 | 2025 | 1999 |
|---|---|---|---|
| Punt | 34.7% | 33.4% | 41.7% |
| Touchdown | 22.7% | 23.1% | 17.0% |
| Field goal | 15.9% | 16.2% | 12.2% |
| Turnover | 9.9% | 9.6% | 13.0% |
| End of half | 7.4% | 7.4% | 6.7% |
| Turnover on downs | 5.3% | 6.3% | 3.8% |
| Missed field goal | 3.0% | 2.7% | 3.5% |
| Defensive touchdown / safety | 1.3% | 1.3% | 2.2% |
| Drives per team-game | 10.8 | 10.6 | 12.4 |
| Plays per drive | 6.0 | 6.0 | — |

**Red zone (2024 / 2025):** 3.2–3.3 trips per team-game. Touchdown rate **57.6% / 57.3%**; any score **86.6% / 86.8%**. It was 46.6% in 1999, 50.8% in 2005 and 56.0% in 2015.

**Drive start versus points scored (2024–25):** the average start is the own 30.4-yard line (median the 30).

| Starting spot (own yard line) | Share of drives | Points per drive | TD % | FG % |
|---|---|---|---|---|
| 1–10 | 8.5% | 1.28 | 16.6% | 8.9% |
| 11–20 | 16.9% | 1.48 | 17.6% | 11.3% |
| 21–25 | 10.0% | 1.69 | 20.0% | 13.8% |
| 26–30 | 27.4% | 1.91 | 21.9% | 15.3% |
| 31–40 | 20.7% | 2.18 | 24.8% | 17.7% |
| 41–50 | 6.8% | 2.66 | 28.9% | 22.1% |
| Opponent 49–40 | 4.4% | 2.43 | 24.9% | 24.7% |
| Opponent 39–30 | 2.5% | 3.34 | 35.1% | 33.3% |
| Opponent 29–20 | 1.6% | 4.32 | 46.0% | 37.4% |
| Opponent 19 and in | 1.3% | 4.89 | 60.8% | 23.7% |

### 1.7 Kicking and special teams

**Field goals by distance (made %, share of attempts):**

| Distance | 1999 | 2015 | 2024 | 2025 |
|---|---|---|---|---|
| < 30 | 95.1% | 97.6% | 97.1% (21%) | 98.1% (19%) |
| 30–39 | 79.8% | 94.1% | 94.3% (27%) | 93.0% (28%) |
| 40–49 | 67.7% | 75.7% | 76.7% (27%) | 84.3% (29%) |
| 50–59 | 50.0% | 66.9% | 72.3% (24%) | 70.1% (22%) |
| 60+ | 0/2 | 1/6 | 4/15 | 12/22 |
| All | 77.8% | 84.5% | 84.0% | 85.6% |

Long field goals have become routine: 22–24% of attempts are now from 50+, against 8.6% in 1999.

**Other kicking and returns:**

- **Extra point:** 95.8–95.9% since the snap moved back in 2015; it was 98.9% in 1999.
- **Two-point try:** 40.7% in 2024 and 46.1% in 2025, about 0.24 attempts per team-game.
- **Punts:** 3.6–3.8 per team-game (5.2 in 1999), averaging 47.1–47.3 gross yards.
- **Kickoff rules:** 2024 used the new dynamic kickoff with touchbacks to the 30. In 2025 touchbacks moved to the 35 ([CBS Sports](https://www.cbssports.com/nfl/news/nfl-makes-another-change-to-dynamic-kickoff-format-ahead-of-2025-season-to-spark-more-kick-returns)).
  - Touchback rate: 64.3% in 2024, **20.7% in 2025**.
  - Returns averaged 27.7 and 26.1 yards.
  - Reported return rate: 32.8% in 2024, 74.5% in 2025 ([ProFootballTalk](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/nfl-had-74-5-percent-of-kickoffs-returned-in-2025-after-only-32-8-percent-in-2024)).
- **Punt returns:** about 12.3 yards.

### 1.8 Score shape, margins and comebacks

**Most frequent team scores:**

| Score | 2024 | 2025 |
|---|---|---|
| 20 | 7.9% | 7.5% |
| 24 | 5.7% | 6.2% |
| 27 | 5.3% | 6.6% |
| 17 | 5.1% | 4.6% |
| 10 | 5.0% | 4.8% |

30, 34, 23, 13, 26 and 31 come next. Shutouts happen in 0.4–1.3% of team-games.

**Final margins:**

| Margin | 2024 | 2025 |
|---|---|---|
| 3 | 13.6% | 15.1% |
| 7 | 7.4% | 9.6% |
| 6 | 10.3% | 4.0% |
| 1, 4, 10, 14, 17 | 3–6% each | 3–6% each |
| 3 or less | 23.9% | 26.8% |
| 7 or less | 51.8% | 49.6% |
| 14 or more | 33.1% | 35.3% |
| 21 or more | 18.4% | 18.0% |

**Combined points:** median 45–45.5; 10th percentile 29–30; 90th percentile 62–65.

**Other game-level rates:**

- Home team wins 53.3% (2024) and 53.7% (2025).
- Overtime in 5.9% (2024) and 5.1% (2025) of games.
- 2024–25, 543 decided games:
  - The eventual winner trailed by **7 or more at some point in 31.7%** of games, by 10+ in 12.3%, 14+ in 4.2%, 17+ in 1.5% and 21+ in 0.4%.
  - **50.6%** of games were within 8 points entering the 4th quarter.
  - The lead changed hands **1.3 times per game** on average, and 40% of games had no lead change at all.

### 1.9 Spread between players and teams

These ranges size what card ratings should do (2024–25 player-seasons).

**QBs with 300+ attempts (55 seasons):**

| Stat | Min | 10th pct | Median | 90th pct | Max |
|---|---|---|---|---|---|
| Completion % | 57.9% | 60.9% | 65.9% | 69.7% | 72.8% |
| INT % | 0.6% | 1.3% | 2.0% | 3.15% | 4.0% |
| Sack rate | 2.8% | 4.1% | 6.5% | 9.5% | 11.9% |
| Yards per attempt | 5.9 | 6.3 | 7.2 | 8.3 | 8.9 |
| TD % | 2.3% | 3.6% | 4.75% | 6.5% | 8.7% |
| Average depth of target | 5.7 | 6.4 | 7.8 | 8.8 | 9.3 |

**Rushers with 150+ carries (64 seasons):**

| Stat | Min | 10th pct | Median | 90th pct | Max |
|---|---|---|---|---|---|
| Yards per carry | 3.4 | 3.75 | 4.47 | 5.18 | 5.91 |
| 10+ yard run rate | 5.5% | 8% | 10.7% | 13.8% | 16.8% |
| Stuff rate (0 or less) | 10.7% | 13.5% | 16.8% | 22.4% | 27% |

Top of the list: D. Henry 2024 (5.91 yards per carry, 13.9% explosive, 13.9% stuffed), S. Barkley 2024 (5.78), D. Achane 2025 (5.67, 16.8% explosive) and J. Gibbs 2024 (5.65).

**Receivers with 80+ targets:**

| Stat | 10th pct | Median | 90th pct |
|---|---|---|---|
| Catch rate | 57% | 67% | 77% |
| YAC per catch | 2.95 | 4.4 | 6.7 |
| Yards per target | 6.2 | 7.8 | 9.8 |
| Average depth of target | 5.1 | 9.5 | 13.0 |

**Teams:**

- Offensive yards per play: 4.34 to 6.94 (median 5.36).
- Defensive yards per play allowed: 4.49 to 6.28 (median 5.43).

### 1.10 Era differences

These matter for the game's 1970–2025 cards and for any era filters.

| Season | Pts/tm-g | Comp % | Yds/att | Net yds/att | Sack % | INT % | TD % | Run yds/carry | 10+ runs | 3rd % | Red-zone TD % | FG % | XP % | Shotgun | Punts/g | Drives/g |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1999 | 20.8 | 57.2 | 6.77 | 5.86 | 6.95 | 3.24 | 3.99 | 3.78 | 9.6% | 36.4 | 46.6 | 77.8 | 98.9 | 12%* | 5.2 | 12.4 |
| 2005 | 20.6 | 59.6 | 6.80 | 5.91 | 6.70 | 3.10 | 3.92 | 4.03 | 9.8% | 38.1 | 50.8 | 81.0 | 98.5 | 16%* | 4.9 | 11.8 |
| 2015 | 22.8 | 62.9 | 7.25 | 6.40 | 6.09 | 2.38 | 4.60 | 4.11 | 10.4% | 39.0 | 56.0 | 84.5 | 94.2 | 62% | 4.8 | 11.8 |
| 2024 | 22.9 | 65.2 | 7.13 | 6.19 | 6.86 | 2.17 | 4.54 | 4.32 | 10.6% | 39.7 | 57.6 | 84.0 | 95.8 | 70% | 3.8 | 10.8 |
| 2025 | 23.0 | 64.3 | 7.02 | 6.09 | 6.87 | 2.18 | 4.65 | 4.27 | 10.0% | 39.5 | 57.3 | 85.6 | 95.9 | 66% | 3.6 | 10.6 |

\* Shotgun was probably under-recorded in the early play-by-play data.

**Before 1999 (outside sources):**

- The league interception rate has fallen in a "nearly linear" way since the 1970 merger, by about **one percentage point per decade** ([SI](https://www.si.com/nfl/2019/10/02/nfl-interception-rate-decline)). Extrapolated, that gives roughly 5–6% in the early 1970s, 4% in the 1980s and 3–3.5% in the 1990s.
- The league completion record of 53% set in 1962 stood until 1979 ([Football Perspective](https://footballperspective.com/tag/completion-percentage)).
- Rushing TDs per 16 team-games fell from 18.6 in the 1960s to 14.9 in the 1980s and 12.6 recently. Passing TDs stayed around 21–24 ([Football Perspective](https://www.footballperspective.com/scoring-distribution-since-1940/)).

The repo already has 1970–2025 season data, so per-season baselines can be derived there.

---

## 2. Madden NFL 25 / 26 / 27 (console and PC)

### 2.1 Playcalling and coaching

- **Coach DNA (Madden 26):** a machine-learned playcall model trained on real NFL tendencies. Its inputs are down, distance, score, clock, timeouts, personnel, field position and weather. A **Coach Suggestions** tab shows the real coach's likely call next to the player's choice. **CoachSpeak** gives a short explanation, for example on 4th and short. **Adaptive Counters** track the opponent's tendencies during the game and weight counter plays higher: more QB contain and zone against a mobile QB. These are tagged "Counter" in the menu ([EA Madden 26 Gameplay Deep Dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- **Real-Time Coaching AI** (from College Football 25): delayed safety rotations, pre-play front changes and timed blitzes. Defensive archetypes differ by team: the Vikings and Chiefs are blitz-heavy, the Eagles play two-high, the Steelers one-high. The AI adjusts the way a person would against repeated plays ([same](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- **Playbook and pre-play controls:** Madden 26 has about 1,000 new plays (roughly double Madden 25), and up to 12 stunts on a four-man front. Madden 27 adds up to 20 saved custom adjustments per side with 10 active at once. Coach Mode stops pre-play changes at 15 seconds on the play clock, and CoachSpeak covers 50+ pre-play scenarios ([EA Madden 27 gameplay](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)).
- **Ordinary late-game decisions read as smart.** The November 2025 update made AI QBs throw the ball away instead of taking needless sacks. They also manage the clock near halftime and late in games. AI ball carriers between the tackles run north–south with fewer pointless moves ([MUT.GG title update notes](https://www.mut.gg/news/madden-nfl-26-title-update-november-19th/)).

### 2.2 Pre-play reads

- **Hot defender (Madden 25):** a fire icon marks a defender who will be **unblocked if he blitzes**, which calls for a quick throw ([Madden 25 deep dive via MUT.GG](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).
- **Coverage shells:** Cover 1–4 shells can be toggled before the snap to disguise the coverage, at the risk of being out of alignment. Protections are drawn on the pre-play art: Half-Slide L/R, Full Slide, Base and Empty, plus an un-target option ([same](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive); [Madden 26](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- **Custom route stems** extend a route's stem 1 yard per input, or 5 yards with the D-pad. Basic hot routes are available to every QB ([Madden 25 deep dive](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).

### 2.3 Passing

**Pass types and controls:**

- **Three passing modes:** Placement, Placement & Accuracy, and Classic. In Placement & Accuracy, accuracy comes from a **meter plus left-stick aim** instead of ratings alone. In Placement, ratings decide accuracy ([Prima Games, Madden 25 passing](https://primagames.com/gaming/madden-nfl-25-passing-guide-controls-settings-pass-types-and-more)).
- **How long the button is held sets the pass type:**
  - A tap is a lob.
  - Releasing before the meter fills, about a third to two-thirds of the way, gives a touch pass.
  - Holding until full gives a bullet.
  - Bullets carry the most velocity, then touch, then lob ([GameSkinny, Madden 23 pass types](https://www.gameskinny.com/bnave/madden-23-pass-types-controls-and-fieldsense-skill-based-passing-explained)).
- **Timing grades:** community testers report that only bullets earn "Good" timing (the blue zone) or "Great" timing (the line near the end of the meter) ([Operation Sports forum](https://forums.operationsports.com/forums/madden-nfl-football/1000626-clarifying-how-use-passing-accuracy-meter.html); community testing, not official).
- **Madden 26 tuning:** non-bullet throws have more arc and touch, and lob and lead passes were retuned for more precise placement ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

**QB DNA (Madden 26):**

- 500+ new animations and 40 QB recipes.
- 9 ball holds (8 named in EA's list); one-hand holds switch to two hands under pressure.
- 3 base arm slots: over the top, ¾ high and ¾ low.
- Signature off-platform throws for specific QBs: jump pass, no-look, cross-body.
- Signature scramble run cycles for Mahomes, Hurts and Murray.
- Hips and shoulders align to the target when throwing on the run ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

**Field Vision:**

- Madden 26 ties accuracy and visibility to **QB height and open throwing lanes**. Shorter QBs lose vision and accuracy when they don't throw through an open lane, and the receiver icon fades when blocked ([same](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- College Football 26 runs Field Vision silently in the background ([Operation Sports](https://www.operationsports.com/college-football-26-factors-height-into-qb-vision)).
- Its ancestor was the polarizing **QB Vision Cone** from Madden 06. The right stick aimed a cone; receivers inside it got an accuracy bonus and those outside got a penalty, and better QBs had wider cones ([Game Informer](https://gameinformer.com/b/features/archive/2017/03/06/the-sports-desk-in-defense-of-the-madden-qb-vision-cone)).

**QB AI and reads (Madden 26):**

- Awareness sets how fast the QB moves through his reads. Elite QBs reach their **3rd or 4th read**; low-rated QBs usually stop at the 1st or 2nd.
- Higher-rated QBs throw hot reads quickly under pressure.
- Scramble decisions estimate the yards available before contact against what is needed for a first down ([same](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

**QB traits** are 50 CPU tendencies, for example Risk Taker, Conservative, Cannon, Throw Away, Panic Button, Hero Ball, Happy Feet, and "Seeing Ghosts" for 3 plays after a sack. They shape behaviour but don't change outcomes. Example: Josh Allen's "Run Over" trait is based on 54% of his scrambles gaining 3+ yards after contact ([same](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

### 2.4 Catching

**Catch types and buttons:**

| Catch | Button | What it does |
|---|---|---|
| Possession | X / A | Safest; stops the receiver's momentum. |
| RAC (run after catch) | Square / X | Skips the post-catch delay so the receiver keeps running. Riskier. |
| Aggressive | Triangle / Y | High-pointing contested balls; more drops. |
| Spectacular (Madden 25) | L1 / LB | Wider catch radius with a small catch penalty. |

Sources: [Madden School](https://www.madden-school.com/how-and-when-to-use-rac-vs-possession-vs-aggressive-catch-in-madden-20/), [Madden 25 deep dive](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive).

**Receiver traits:** Possession Receiver, RAC Receiver, Aggressive Receiver, Highlight Reel and Throw It Up ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

**Timing-Based Catching (Madden 27 and College Football 27):**

- Hold the catch type, then release in the window:
  - **Slightly early** (yellow): a ratings roll.
  - **Perfect** (green): the best catch chance.
  - **Late:** a drop.
- The green window shrinks as coverage tightens: open, partially covered, covered, smothered.
- Difficulty sets the window size. Spectacular Catch and Catch in Traffic ratings offset penalties.
- It can be limited to medium and deep passes, or turned off ([EA Madden 27 gameplay](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay); [MUT.GG Madden 27 deep dive](https://mut.gg/news/madden-nfl-27-gameplay-deep-dive/)).

### 2.5 Run game and ball carrier

**Skill moves and physics:**

- Madden 25 added hundreds of jukes, spins, high-steps and hesitations. A **Setup State**, entered by holding sprint, chains moves together, for example a back-juke into a spin ([Madden 25 deep dive](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).
- **BOOM Tech:** physics on top of FieldSENSE. Ball carriers brace for impact, stumble and recover balance depending on the hit and their ratings. Hit Sticks, Cut Sticks, Trucks, Stiff-Arms and Dive Tackles are all physics-driven ([same](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).

**Ball-carrier abilities:**

- **Tireless Runner:** stamina loss doesn't hurt his rebalance after broken tackles.
- **Steamroller:** much harder to knock off his path at full speed ([same](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).

**Madden 26 additions:**

- Timing-based trucks and stiff arms.
- **Reach for the sticks:** hold up near the first-down line or goal line. It increases fumble risk if the carrier is hit.
- **Cover Ball:**
  - Sim style: greatly reduces fumble chance.
  - Competitive style: full immunity if pressed before the tackle starts ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- **QB moves:** right-stick jukes and spins behind the line. The QB juke was later nerfed: no speed boost unless sprinting, and defenders keep contain ([November 2025 update](https://www.mut.gg/news/madden-nfl-26-title-update-november-19th/)).
- **Read option** (Madden 25 and CFB 25): the default is the handoff; hold A/X to keep ([Madden 25 deep dive](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).

### 2.6 Tackling

**Madden 25 Hit Stick:**

- Timing-based. **Tackle and Hit Power ratings widen the timing window.**
- A **tackle indicator under the defender** shows power, squareness and timing.
- Early, late or badly angled hits lose power at impact ([EA Madden 25 deep dive](https://careers.ea.com/games/madden-nfl/madden-nfl-25/news/gridiron-notes-madden-25-gameplay-deep-dive)).
- A perfect hit shows a **green circle** and is more likely to cause a fumble ([Dexerto](https://dexerto.com/madden/how-to-use-the-hit-stick-in-madden-25-2863265)).
- Related abilities: **Form Tackler** makes the ideal window easier to hit, and **Extra Pop** raises the fumble chance on a perfect Hit Stick.

**Madden 26:**

- 700+ new tackle animations.
- Timing-based strips, cut sticks, lunges, wraps and swat or wrap catch-tackles.
- Fewer "ghost" tackles without real contact ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

**Madden 27 Tackle Stick:** right stick up = Hit Stick, down = Cut, left = Lunge, right = Wrap ([EA Madden 27](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)).

### 2.7 Blocking, pass rush and defensive AI

**Blocking:**

- A leverage system chooses blocking animations. In pass protection, each pass play has a built-in protection, and five-man protections default to Empty.
- **Block Steering:** a defender can drive his engaged blocker into the backfield or sideways, depending on ratings, momentum and size.
- Madden 27 adds RB/TE chip blocks and a **QB-sneak timing meter**. The meter compares center, guard and QB push against the defenders' shed strength: a defensive edge shrinks the window and an offensive edge grows it ([Madden 26](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive); [Madden 27](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)).

**Pass rush (Madden 26):**

- The per-play limit on rush moves was removed. Each move now costs stamina according to the player's rush ratings, the **Effort system**.
- Holding the trigger gives a burst; other inputs give faster, more expensive sheds.
- Rushers disengage earlier when the QB scrambles ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive); [November 2025 update](https://www.mut.gg/news/madden-nfl-26-title-update-november-19th/)).

**Coverage (Madden 26):**

- A **cut reaction system**: an outside-leverage cut gains the receiver about **1 step**, an inside-leverage cut about **2–3 steps**. The base win chance is man coverage against the matching route-running rating (short, medium or deep), then leverage shapes the result.
- **"Psychic" interceptions reduced:** defenders must face or look at the ball to try a catch; otherwise they go for a knockout.
- Flat defenders sprint instead of backpedalling when dropping 20+ yards.
- Route Commit means a correct guess gives a faster break and an incorrect one gives exaggerated false steps ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive); [CFB 26 deep dive](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)).
- Madden 27 "Smart Zones" add settings such as Plaster (stick to receivers when plays extend) and Ultra Aggressive (jump routes underneath, high risk) ([Madden 27](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)).

**Run fits:** A and B gap defenders play the run first. C, D and E gap defenders play the pass first when their key releases into a route, and fill the run when they read a block ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

### 2.8 X-Factors, Superstar abilities, Hot/Cold and momentum

**Zone abilities:** each X-Factor player has its own trigger to activate and its own knockout. Examples:

| Player and ability | Activation | Knockout |
|---|---|---|
| Mahomes, "Bazooka" | One completion of **30+ air yards** (yards after the catch don't count) | One sack |
| Kelce, "Double Me" | — | Not targeted on **3 straight pass plays**, shown by a meter |

Source: [Diamond Lobby](https://diamondlobby.com/madden-24/how-to-enter-the-zone-madden-24/).

**Madden 26 changes:**

- About 60 Superstar abilities, among them KO, Enforcer and Route Technician, became **chance-based, about 50% when conditions are met**, instead of guaranteed ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- X-Factors are reshuffled mid-season based on real performance: new ones for Puka Nacua, Jonathan Taylor, Jahmyr Gibbs and others, with some stars losing theirs ([November 2025 update](https://www.mut.gg/news/madden-nfl-26-title-update-november-19th/)).

**Madden 27:**

- Players must be **Hot** to activate X-Factors; going **Cold** switches them off until momentum rebuilds.
- Ability tiers are Bronze, Silver and Gold, and each tier **adds a new effect** rather than bigger numbers. For example, Enforcer: Bronze raises Hit Stick success, Silver makes its timing more forgiving and Gold adds fumble chance.
- College Football 27 has **5 tiers up to "Heisman"**, plus "Coach Chat", used **3 times a game** on a Cold player ([Madden 27](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)).

**Momentum and M-Factors (Madden 22):**

- A tug-of-war meter above the score. TDs, turnovers and sacks push it.
- At momentum thresholds a team unlocks "M-Factors": for example **Icy Veins** (QB immune to pressure), **Shook** (opponent's play art distorted) and **Paranoid** (QB periodically can't see receivers).
- The **home team gets one extra M-Factor slot**, and all 32 teams have their own home-field effect, for example Chicago's away kick meter moving faster ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-homefield-advantages-gameday-factors-and-momentum-factors); [App Trigger](https://apptrigger.com/2021/07/05/madden-22-gameday-momentum)).
- Gameday factors include Calm (slower kick meter), Rivalry (bigger momentum swings) and Slippery When Wet (slower direction changes) ([MUT.GG](https://www.mut.gg/news/madden-nfl-22-homefield-advantages-gameday-factors-and-momentum-factors)).

### 2.9 Stamina, wear and tear, and weather

- **Wear & Tear** (Madden 26) tracks contact per game. Repetitive play-calling and overused players raise injury risk ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- **Weather:**
  - Snow and rain take speed, acceleration and change of direction, scaled by how heavy the weather is.
  - There are more drops, fumbles and broken tackles, and kicks and throws lose power and accuracy.
  - Cold-weather teams play better in snow; warm-weather teams fatigue more slowly in heat ([same](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).

### 2.10 Kicking

- **Madden 25** kept the legacy meter as an option and made College Football 25's **two-stage multi-meter** the online default. It is a horizontal accuracy meter first, then a vertical power meter filled by holding. Releasing in the overkick zone loses accuracy or distance ([Madden University](https://www.maddenuniversity.com/strategies/special-teams/kicking/two-ways-to-kick-in-madden-nfl-25-legacy-and-multi-meter-options); [Madden 25 deep dive](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)).
- In College Football 26's hostile stadiums, the **accuracy meter goes fully transparent, the ball fades as the kicker lines up, and the power meter fills white** ([CFB 26 deep dive](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)).

### 2.11 What players and critics like or dislike

**Liked:**

- **Movement feel.** EA says about 40% of social posts comparing Madden and College Football mentioned movement. Both games now share one movement tuning, and top speeds match real athletes ([Madden 26 deep dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)).
- **Player identity**, through QB DNA, signature run cycles and celebrations.
- **Smarter coverage.**
- GameSpot headlined Madden 26 "The Best Madden In Years" ([GameSpot](https://www.gamespot.com/reviews/madden-nfl-26-review/1900-6418395/)).

**Disliked:** exploits are patched constantly (QB rollout speed boosts, QB jukes), and the High-Throw accuracy was nerfed in Competitive mode in Madden 25 ([MUT.GG, October 16 2024 title update](https://www.mut.gg/news/title-update-october-16th-madden-nfl-25/); [September 2024 title update (EA)](https://ea.com/games/madden-nfl/madden-nfl-25/news/title-update-september-2024)).

**Lesson for us:** any "always works" move gets abused. Give every move a cost, a counter and a chance.

---

## 3. College Football 25 / 26 (console)

**Why it is liked:**

- **Speed and an arcade feel:** "plays faster than its big brother Madden" ([Charlie Intel](https://charlieintel.com/games/college-football-25-review-333271)).
- **The option game** has a deep library of plays ([Shacknews](https://shacknews.com/article/140606/ea-sports-college-football-25-review)).
- **Stadium atmosphere.**

Passing was the most-criticized mechanic.

**Home-field advantage, Stadium Pulse and Composure:**

- These affect **the visiting team only** ([Game Rant](https://gamerant.com/college-football-gameplay-features-home-field-advantage-wear-and-tear-get-louder/); [TheGamer](https://www.thegamer.com/ea-sports-college-football-25-stadium-pulse-abilities-explained-guide/)).
- A noise meter appears and the screen shakes. Red-zone and big 3rd-down moments get louder, and the home side can "Get Louder".
- EA's help pages say **receiver icons may disappear** during the play and players should memorize them before the snap ([EA Help](https://help.ea.com/da/articles/ea-sports-college-football/stadium-pulse/)).
- Players report scrambled play art ([EA forum bug report](https://forums.ea.com/discussions/college-football-25-bugs-archive-en/no-stadium-pulse-vibration-during-away-games/7095197)).
- Low-Composure QBs struggle to read pre-snap and to audible ([CBS Sports](https://www.cbssports.com/college-football/news/watch-ea-sports-college-football-25-gameplay-trailer-goes-in-depth-on-wear-tear-homefield-advantage)).
- **College Football 26 additions:**
  - A visiting gain of **20+ yards that earns a first down silences the crowd for a while**.
  - Night and rivalry games add modifiers to clock management, kicking, false starts and communication.
  - Receivers lined up farther from the QB are affected more ([CFB 26 deep dive](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)).

**Wear & Tear:**

- Each body part has its own damage "hot zone": the QB's arm and upper body, a running back's legs ([CBS Sports](https://www.cbssports.com/college-football/news/watch-ea-sports-college-football-25-gameplay-trailer-goes-in-depth-on-wear-tear-homefield-advantage)).
- In College Football 26:
  - QB health under **60%** shows a pre-snap visual cue.
  - Accumulated wear can drop an ability by **up to 2 tiers**.
  - There are 13 sliders: 8 for types of impact and 5 for recovery: per play, per timeout, per quarter, at halftime and an in-game healing pool ([CFB 26 deep dive](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)).

**Abilities:**

- 80+ abilities in College Football 25, with 4 tiers (Bronze to Platinum) and up to 8 per player (5 physical and 3 mental) ([GamingBolt](https://gamingbolt.com/ea-sports-college-football-25-wear-and-tear-abilities-and-more-detailed-in-new-deep-dive)).
- In College Football 26, abilities move up from Platinum to **Heisman when a player is hot**. A green flash marks a tier-up and a red arrow a drop ([CFB 26 deep dive](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)).

**Scale (College Football 26):** 2,800+ new plays, 45+ new formations, 136 team playbooks, 300 real coaches, 4 new motion types, multi-player pre-snap motion and 12 stunt types ([same](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)).

**Passing feedback:** the College Football 25 pass meter shows **blue (safe and accurate), yellow (uncertain) and red (likely inaccurate)** as the throw starts ([GamingBolt / esports.gg reporting](https://gamingbolt.com/ea-sports-college-football-25-wear-and-tear-abilities-and-more-detailed-in-new-deep-dive)). College Football 26 widened the range of slightly inaccurate passes.

---

## 4. Madden NFL Mobile

**Controls over time:**

- **Launch era:** tap a receiver's icon for a lob, tap and hold for a bullet, and swipe left, right or back to juke ([EA FAQ](https://forums.ea.com/discussions/madden-nfl-mobile-en/madden-nfl-mobile-faq/8936215)).
- **Later:** EA dropped tap controls for a **virtual stick plus a context-sensitive action button**. GameZebo called it "workable" and the controls "acceptable at best" ([GameZebo](https://www.gamezebo.com/reviews/madden-nfl-mobile-review-keeping-the-drive-going/)).
- An earlier touch-only scheme (Madden NFL 25 mobile, 2013) was weakest on running ([GameZebo](https://www.gamezebo.com/reviews/madden-nfl-25-review/)).
- **Today:** **one-button mode** (tap and swipe for most actions) or manual controls that add jukes, stiff arms and user tackles. EA advises learning a core of 4–6 plays first ([EA How to Play, Madden NFL 26 Mobile](https://www.ea.com/en/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-how-to-play)).

**Session design:**

- Season games started with **1-minute quarters, then 1.5, then 2 minutes**, aimed at 5–10-minute mobile sessions instead of 30 minutes on console.
- Head-to-head was asynchronous and played in drives; only your offense was live ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog//2015/02/madden-mobile-can-ea-update-its-classic.html)).
- Today's **VS Mode** is real-time ranked play where **both players attempt identical, randomized bite-size scenarios**. Wins earn Fans (for rank) and VS Tokens (for a store). You can skip celebrations by veering to the middle of the end zone ([EA VS Mode](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-vs-mode)).

**Progression:**

- The long-term goal is "team rating": start at 60–65 and aim for 100.
- Achievements grant trophy cards that combine in nested sets, for example 5 Gold trophies for 1 Elite.
- 2–4 short live events run at any time, some lasting about 2 hours ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog//2015/02/madden-mobile-can-ea-update-its-classic.html)).
- Madden NFL 25 Mobile replaced player leveling with **Season Team Training** (rank-ups by unit or position group give everyone an OVR bonus) and added a profile-level playbook budget ([GamingOnPhone](https://gamingonphone.com/news/madden-nfl-25-mobile-is-set-for-an-official-release-on-august-8th-2024)).
- **Player EVO:**
  - Feed a same-rarity card with a higher base OVR; the target's OVR rises to match.
  - Stats are rescaled to the position, and traits and chemistry are kept.
  - Token cost by rarity: **2 (Uncommon), 10 (Rare), 50 (Epic) and 250 (Iconic)**.
  - Cards can be evolved any number of times ([EA Player EVO](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-madden-101-player-evo)).

**Event example: Most Feared on Madden NFL 26 Mobile (October 17 – November 3):**

- Every player receives the featured card free at Uncommon on login. It starts at **84 OVR** and has **21 upgrade variations up to Mythic**, and boosts persist after the event.
- **Currencies:**
  - Night Essence, used for upgrades.
  - Lunar Essence, which regenerates **1 every 50 s up to 600** and converts to Night Essence.
  - Promo Stamina: **30 per event**.
  - Exploration Stamina: **7 a day** for a node map.
- **Daily codes:** **34 codes** released **2 a day**. Each code digit needs a separate play.
- A hub has 4 goals that unlock a boss challenge ([EA Most Feared Mobile](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-maxing-out-most-feared)).

**Rarity and OVR scale:** mobile overalls go well above 99. In Team of the Year Part 2, cards started at **Epic 136** and could be upgraded to **Mythic 166** ([EA TOTY Part 2](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-team-of-the-year-part-two)).

**What players like:**

- **Auto-play** for grinding ("Spare 5 minutes? This is great"), so they don't have to grind tasks like passing for 100 yards ([Muthead forum review](https://muthead.com/forums/madden-nfl-mobile-discussion/317130-mm23-review-3-weeks-in), quoted in search results).
- Little grind for adults with less time.
- "Best sports game on ur phone" ([TapTap reviews](https://www.taptap.io/app/195921/review)).

**What players dislike:**

- Very slow stamina regeneration, and events that refresh only 3 times a day.
- Monetization and pay-to-win; "bombarded with cards and packs".
- **Ratings above 99.**
- A **whistle after every play** that kills the pace.
- The lost Auction House.
- No defense you can control.
- **Player performance that doesn't match their stats.**
- A 10-minute drive limit that causes unfair forfeits.

Sources: [TapTap](https://www.taptap.io/app/195921/review), [EA forum "Madden Mobile Issues"](https://forums.ea.com/discussions/madden-nfl-mobile-en/madden-mobile-issues/13293592).

---

## 5. Retro Bowl and Retro Bowl College

**Reach and quality:**

- **4.8★ from 937K App Store ratings**, Editors' Choice, #8 in Sports, a 46.2 MB download.
- Free, with a **$0.99 "Unlimited" upgrade** and credit packs ([App Store](https://apps.apple.com/app/id1478902583)).
- It was the #1 App Store download in late 2021, and the Switch version scored Metacritic 84 ([Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl)).

**Controls (why it works on touch):**

- **Passing:**
  - Drag opposite the receiver to aim and release to throw; an aim line shows where the ball will land.
  - The ball goes to the aimed spot, not to the receiver, so the player must lead deep routes.
  - **QB strength sets maximum range, and stamina reduces strength with every throw.**
  - A second-finger tap (or right-click) switches between a **low, fast bullet** that beats defenders sitting under a route and a **high pass** over them ([Retro Bowl passing guide](https://retrobowl.gg/blog/retro-bowl-passing-guide/)).
  - Pocket Gamer: it "takes the flinging mechanic from Angry Birds and applies it to American football" ([Pocket Gamer](https://ee.pocketgamer.com/articles/084147/retro-bowl-review-a-must-play-sports-game/)).
- **Running:**
  - The carrier runs forward on his own, and the player swipes to sidestep, slow down or dive. Diving protects against fumbles and helps reach the line to gain.
  - **Stiff arms and hurdles are automatic:** strong players stiff-arm more and fast players hurdle more ([guide](https://retrobowl.gg/blog/retro-bowl-passing-guide/); [Defector](https://defector.com/this-little-football-game-on-my-phone-is-fun-as-hell)).
  - **Trucking:** hold the screen to charge a meter and push through defenders, at the cost of running slower and being tackleable from behind ([App Store version notes](https://apps.apple.com/app/id1478902583)).
- **Kicking:** two taps, the first for power and the second for direction. **Higher accuracy slows the aiming arc**, and strength sets range and drains with stamina ([guide](https://retrobowl.gg/blog/retro-bowl-passing-guide/)).
- **Defense is simulated.** You play only offense, and reviewers call this the main limitation ([Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl); [MobileSyrup](https://mobilesyrup.com/2020/09/27/retro-bowl-football-game-review/)).
- Later updates added **Interrupt Sim**: take over a simulated game, or sim mid-game ([App Store](https://apps.apple.com/app/id1478902583); [Operation Sports, Retro Bowl College](https://www.operationsports.com/retro-bowl-college-adds-sim-game-and-interrupt-options-editor-improvements-and-more)).

**Management loop (the hook):**

- **Coaching Credits** are paid after each game in proportion to the number of **full fan-support bars**. They are spent on facilities, free agents and coordinators ([GamingOnPhone guide](https://gamingonphone.com/guides/retro-bowl-the-complete-seasons-mode-guide-and-tips)).
- **Facilities:** Training gives more XP per game, Rehab lowers injuries and improves condition, and Stadium raises fan support.
- **Coordinator traits** have small, legible effects:
  - Likeable: +5% morale.
  - Physio: +5% condition per game.
  - Fan Favourite: +1% fan support per game.
  - Talent Spotter: +0.5% potential.
  - Scout: +3 scouting trips.
  - Negotiator: blocks toxic-morale spread.
  - Motivator: instant morale boost.
  ([same](https://gamingonphone.com/guides/retro-bowl-the-complete-seasons-mode-guide-and-tips))
- **Press conferences** force choices, for example "criticize him (his morale drops) or the team (team morale drops)". Morale affects trades and results ([Defector](https://defector.com/this-little-football-game-on-my-phone-is-fun-as-hell)).
- "You can burn through a full season in a couple of hours" ([Defector](https://defector.com/this-little-football-game-on-my-phone-is-fun-as-hell)).
- Nintendo Life: the management is "just deep enough that you actually want to review your roster and staff, but simple to the degree that it's not time-consuming" ([Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/retro-bowl)).
- **Retro Bowl College** adds roughly 250 teams, recruits who leave after **4 years**, a scholarship budget instead of a salary cap, GPA management and a college playoff ([Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl)). Balance updates keep traditionally strong programs strong "for longer" ([New Star Games](https://www.newstargames.com/post/10-apr-2025-multiple-updates)).

**Complaints:**

- **Interceptions "can come too easily"** ([Defector](https://defector.com/this-little-football-game-on-my-phone-is-fun-as-hell)).
- Too many fumbles ([Nintendo Life via Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl)).
- Scenarios repeat after a while ([MobileSyrup](https://mobilesyrup.com/2020/09/27/retro-bowl-football-game-review/)).

---

## 6. Arcade references

### 6.1 NFL Blitz (Midway, 1997–2000)

**Rules** ([Den of Geek](https://www.denofgeek.com/games/nfl-blitz-history-making-of-too-violent-retrospective-midway/); [Wikipedia](https://en.wikipedia.org/wiki/NFL_Blitz_(1997_video_game))):

- **7 players a side**, because three linemen were needed for one to snap the ball.
- **30 yards for a first down.**
- **2-minute quarters** on a fast clock, so a game took about **12 minutes**.
- No penalties: hitting a receiver before the catch was legal, and multiple passes behind the line were allowed.
- Extra points were nearly automatic.

**Design intent** (Mark Turmell): a "quicker-hitting [game], not a deep simulation". The team removed whatever kept players away from the ball, such as setup and formation screens ([Den of Geek](https://www.denofgeek.com/games/nfl-blitz-history-making-of-too-violent-retrospective-midway/)). Blitz 99 was Turmell's favorite because of "the interesting things that can happen": tipped balls and loose fumbles players dive for.

**Mechanics, from the official Blitz 2000 N64 manual** ([archive.org](https://archive.org/download/Nintendo64Manuals_201812/NFL%20Blitz%202000%20%28USA%29_text.pdf)):

- **On Fire:** your team goes On Fire "when you have one receiver successfully catch three passes in a row on Offense or your Defense sacks the QB twice in a row". It gives more speed and power, and "if you don't keep up the good work your flame will go out".
- **Turbo meter** at the bottom of the screen, shared across moves. Turbo is used for:
  - turbo running and a spin (double-tap turbo);
  - a fast pass (turbo + pass);
  - a stiff arm (turbo + pass button over the line);
  - a high hurdle, a power tackle and a push.
- Other moves: a jump pass, a dive forward, a lateral back, and a defensive interception or swat.
- **Hidden play selection** for multiplayer, done by moving the cursor to a corner slot.
- **Audibles:** 3 slots.
- **A play editor**, with 3 offensive playbook pages and 1 defensive page.
- **Onside kicks** after scoring.

**Late hits:** about a 1-second window after the whistle, "a cornerstone of the product" according to Turmell. They were removed in later licensed versions at the NFL's request ([Den of Geek](https://www.denofgeek.com/games/nfl-blitz-history-making-of-too-violent-retrospective-midway/)).

### 6.2 Tecmo Super Bowl (NES, 1991)

- Two buttons and a D-pad, **5-minute quarters**, no penalties, and cinematic cut-scenes on key plays.
- All 28 NFL teams, a season mode and substitutions.
- The developer "did not aim for reality", focusing instead on speed and strength. Reviewers compare its addictiveness to Tetris ([The Ringer](https://www.theringer.com/2016/11/17/nfl/the-legend-of-tecmo-super-bowl-8824647ea94d)).
- **8-play playbook**, up from 4 in Tecmo Bowl. The defense picks from the same 8 plays, and **a correct guess sends the defensive line straight at the QB** for a loss: rock-paper-scissors at the line ([Giant Bomb](https://giantbomb.com/wiki/Games/Tecmo_Super_Bowl)).
- **Iconic outlier stars:** Bo Jackson was nearly unstoppable, Christian Okoye's Hitting Power knocked defenders flying, and a single Barry Sanders run could swing a quarter ([The Ringer](https://www.theringer.com/2016/11/17/nfl/the-legend-of-tecmo-super-bowl-8824647ea94d)).
- **Attributes** were a handful: Running Speed, Rushing Power, Maximum Speed, Hitting Power, Pass Control, Receptions, Ball Control, Pass Interceptions and Kicking Ability ([TecmoGeek](https://tecmogeek.com/about/ratings)). Hitting Power only matters for offensive players around 88 and above.
- I did not verify the weekly player-condition system (Bad / Average / Good / Excellent) in this pass. I remember it but don't cite it.

---

## 7. Football Ultimate Team: packs, odds, promos and chemistry

**How odds are disclosed (Madden 26, College Football 26):**

- The store's **"View Info"** shows the probability of each **category or OVR band** per pack.
- **A category at 100% is always awarded**; for example "100% 80+" means at least one 80+ player.
- Probabilities are per pack and not cumulative: **each opening is an independent event**.
- Higher bands are less likely, and every pack gives "some value" ([EA Madden 26 pack probability](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-ultimate-team-26-pack-probability); [EA College Football 26](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-ultimate-team-pack-probabilities)).
- No pity or bad-luck protection is mentioned.

**Published example (Madden 20)** ([GamingBolt](https://gamingbolt.com/madden-nfl-20-ultimate-team-guide-tips-pack-prices-and-card-chances)):

| Pack | Price | Items | Disclosed odds |
|---|---|---|---|
| Get A Player | 500 coins | 1 | Silver 62+ 100%, 66+ 31%, Gold 70+ 7.8%, 72+ 3.1% |
| Get A Gold Player | 5,000 coins | 1 | Gold 70+ 100%, 75+ 35%, Elite 80+ 9%, 82+ 4.3% |
| Gridiron | 500 points | 6 | Gold 75+ 100%, Elite 80+ 39%, 83+ 13%, 85+ 5.2% |
| Superstars | 18,000 coins | 5 | Gold 77+ 100%, 80+ 16%, 83+ 15%, 85+ 4.9% |
| All-Pro | 30,000 coins | 7 | Gold 75+ 100%, 80+ 42%, 83+ 14%, 85+ 5.2% |
| Clutch | 40,000 coins | 6 | Elite 80+ 100%, 82+ 45%, 84+ 18%, 86+ 5.8% |
| Elite Player | 50,000 coins | 7 | Elite 80+ 100%, 83+ 33%, 85+ 12%, 87+ 3.4% |
| Legends Fantasy | 120,000 coins | 6 | Elite 83+ 100%, 85+ 20%, 87+ 7.2%, 88+ 3.7%; plus a guaranteed 81+ Legend |

The pattern: **the guaranteed floor sits one band below the chase band**, and the top band is about 3–6% per pack. A "fantasy" pack lets the player choose one card from a themed set.

**Chemistry (MUT team chemistry)** ([MUT.GG](https://www.mut.gg/news/mut-101-team-chemistry-tutorial/)):

| Tier | Components needed | Boosts (+1 each) |
|---|---|---|
| 1 | 5 | Strength, Impact Block |
| 2 | 10 | Jumping, Play Recognition |
| 3 | 15 | Agility, Change of Direction |
| 4 | 20 | Acceleration, Carrying |
| 5 | 25 | Speed, Tackle |
| 6 | 30 | Strength, Stamina |
| 7 | 35 | Throw Power, Jumping |
| 8 | 40 | Agility, Change of Direction |
| 9 | 45 | Acceleration, Catching |
| 10 | 50 | Speed, Awareness |

- Boosts are cumulative, so all 10 tiers give +20 attribute points.
- **Components** include starters and backups, kicker, punter, coach, home and away uniforms, and stadium.
- Team Masters, Team Diamonds and Captains count multiple times: **3×**, and up to **7×** for Captains.
- Program chemistries exist alongside team chemistry: Most Feared, TOTW Boost, Legends Motivators and others ([MUT.GG chemistry](https://www.mut.gg/chemistry/)).

**Weekly structure in MUT 26** ([MUT.GG MUT 26 deep dive](https://www.mut.gg/news/madden-nfl-26-ultimate-team-deep-dive/)):

- **Solo Champions:** a **12-game weekly gauntlet** with a weekly entry token, plus extra tokens from objectives. A higher battle score earns better rewards.
- **Solo Seasons:** half-length games on an NFL-style schedule. **10 wins reaches the playoffs.**
- **Sick Six:** 3 runs a week.
- **Limited-time cards** now stay available for **1 week** instead of 3 days.
- **Collector's Series:** collect a set of Champions to unlock a stronger version of your chosen one.
- **Weekly Spotlight Pass:** several programs share one token reward. The first covered Legends, Team of the Week and Collector's Series.
- **Team of the Week** releases weekly, usually Wednesday around 10:30 AM or 1:30 PM ET ([MUT.GG schedule](https://www.mut.gg/schedule/?page=10); [TOTW program](https://www.mut.gg/programs/totw/)).

**Promo calendar examples (MUT 26):**

- **Most Feared** (October 16 – November 11):
  - a login card;
  - an upgrade currency shop (Jack-o-Lanterns);
  - **Detective Sets**, which award a card only if you correctly guess his identity;
  - Champions with chemistry boosts;
  - online and solo H2H events, each awarding **2 cards upgradeable to 90 OVR**;
  - a raid;
  - a cross-game token link with College Football ([EA Most Feared](https://www.ea.com/games/madden-nfl/madden-nfl-26/event/madden-26-most-feared)).
- **Zero Chill** (from about December 4): a login choice between two cards ([EA Madden 26 Season 4](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-season-4)).
- **Team of the Year** (Season 6).
- **Off-season drops in late May and June 2026:** **Golden Tickets** (parts 4–6), **Ultimate Legends**, **Position Heroes**, **Flashbacks**, **Team Captains** and **Collector's Series** ([MUT.GG schedule](https://www.mut.gg/schedule/?page=10)).
- **Golden Tickets** are community-designed cards released in waves (6 of 35 in the first drop in MUT 22), with cheaper ability slots. They later became 99 OVR ([MUT.GG](https://www.mut.gg/news/golden-ticket-program-details-mut-22)).

---

## 8. Recommendations for Perfect Season (NFL engine and NFL Ultimate Team)

Constraints carried through: keep our original names, coins only, no change to saves or IDs, and a protocol bump for any physics or ratings change. Every number below is a **target band for an even matchup at Pro difficulty with average cards (≈ gold 80 OVR)**, unless stated otherwise. Ratings should move results within the real spreads in §1.9, and further for all-time and bronze cards.

### 8.1 Calibration targets for the play engine and the simulator

**A. Simulated games** (GameCast, Club Season sims, AI-versus-AI): match real NFL shape.

| Target | Value |
|---|---|
| Points per team-game | 23 ±1; P10 about 10, P90 about 36; shutouts ≤ 1% |
| Final margins | 3 in 13–15% of games; 7 in 7–10%; ≤ 7 in about 50%; ≥ 21 in about 18% |
| Overtime | 5–6% of games |
| Home wins | about 53.5% (where home exists) |
| Drives per team | about 10.7 |
| Drive results | TD 23%, FG 16%, punt 34%, turnover 10%, downs 6%, missed FG 3%, end of half 7% |
| Red zone | TD 57%, any score 87% |
| Comebacks | winner trailed by 10+ in about 12% of games, 14+ in about 4% |

**B. Played arcade drives:** keep the arcade compression, but keep the shape. The current format plays 4 drives and scores 12–14 points in an even game, about 3.1–3.5 points per drive.

- Recommended drive results:

  | Result | Share |
  |---|---|
  | Touchdown | 33–38% |
  | Field goal attempt | 18–22% |
  | Stopped (punt or downs) | 28–33% |
  | Turnover | 8–12% |

  Turnovers must stay meaningful; a ~10% chance per drive is close to the real 9.6–9.9%.
- Use the start-position table in §1.6 for any field-position variety. Short fields after takeaways should be worth about +1.5 to +2.5 expected points.

**C. Per-play outcomes**, by throw depth and run gain, for both played and simulated plays:

- **Completions by depth:** 77–80% behind the line, 71–73% at 0–9 yards, 53–56% at 10–19, 34–37% at 20+. Overall 63–66%; the repo measured 58% in a human-like sample.
- **Interceptions by depth:** 0.8%, 1.2–1.6%, 3.2–3.4% and 5–6.3%. Overall 2.0–2.3% per attempt; the repo measured 0.8%.
  - Raise the deep and intermediate risk, not the short risk. Under pressure, raise interceptable throws to about 5.5% (The Analyst's "pickable" rate).
  - Retro Bowl players complain when interceptions feel too easy. Every interception should come from a visible cause: a defender facing the ball, a throw into a closing window, or a throw while under pressure.
  - Adopt Madden 26's rule that **a defender must be facing or looking at the ball to intercept; otherwise he only deflects it.**
- **Sacks:** 6.5–7% of dropbacks (the repo measured 10%), about 6.5 yards lost each.
  - Keep the average pressure at about **2.9 s**, and give players a readable warning such as the reddening QB ring we already have.
  - A pressured throw should complete about 49% versus 72% from a clean pocket.
- **Scrambles:** about 5–5.5% of dropbacks, around 7.5 yards each.
- **Designed runs:** yards per carry 4.3 with **median 3** and this distribution:

  | Gain | Share |
  |---|---|
  | 0 or less | 18% |
  | 1–3 | 36% |
  | 4–6 | 24% |
  | 7–9 | 10–11% |
  | 10–19 | 8% |
  | 20+ | 2.2% |

  Scale it by matchup:
  - Elite defense against an average back: 3.4–3.8 yards per carry, about 25% stuffed.
  - An elite back against an average defense: 5.2–5.9 yards per carry, 14–17% runs of 10+.

  The current 2.3–3.3 against an elite defense is too low. No real 150-carry back averaged under 3.4 in 2024–25.
- **Fumbles lost:** 0.6–0.75% of carries; 0.4 per team-game. Diving, "cover ball" and possession catches should lower it, and reaching, trucking and big hits should raise it.
- **Third downs:** 39–40% overall, with the distance curve in §1.5 (about 68% at 1 yard, 53% at 2–3, 44% at 4–6, 32% at 7–10, 15% at 11+). This is the single best test that down and distance "feel real".
- **Field goals:** under 30 yards about 97%, 30–39 93–94%, 40–49 80% ±4, 50–59 70–72%, 60+ about 30–50%. Extra point 95.8%; two-point try about 43%.

**D. Rating spread.** An average gold QB should land near the median in §1.9. Treat the observed 10th–90th percentile range as the gap between about a 75 and a 92 card, and extend linearly for bronze and for promo or legend cards, clamped:

| | Completion % | INT % | Sack rate |
|---|---|---|---|
| 99 QB, clamp | 74% | 0.8% | 3% |
| 60 QB, clamp | 54% | 4.5% | 12% |

Use the same approach for running backs (3.4–5.9 yards per carry) and receivers (catch rate 57–77%, YAC 3–6.7).

**E. Run the tests that exist.** Extend `scripts/audit_nfl_rushing.ts` and the human-like suite (`src/game/football2/human.test.ts`) to report the §1.3–§1.5 distributions, not only means. Add assertions with tolerance bands, for example designed-run median 2–4, 10+ rate 8–13% and third-down conversion 35–44%.

**Protocol.** Any of these changes alters two-client agreement, so they require bumping **NFL draft 10 → 11 and NFL Ultimate Team 11 → 12**. NBA and soccer are unchanged.

### 8.2 Passing on touch (keep the slingshot, add depth)

Retro Bowl's drag-to-throw is proven on phones (4.8★ from 937K ratings). Our slingshot, dotted arc and accuracy-limited arc already follow it, so keep that core and layer Madden-style skill on top:

1. **Throw type the player can choose.** Keep the automatic type by distance as the default (ours: bullets under about 12 yards, lobs past 30). Add Retro Bowl's **second-finger tap to toggle "BULLET / LOB"**, shown as a chip next to the QB. A bullet beats an underneath defender and a lob goes over him. Touch is the default in between.
2. **Optional "release timing" for bullets only**, as in Madden's Placement & Accuracy. A thin ring around the targeted receiver sweeps once.
   - Releasing in the **green window (about 120 ms, widened by the QB's accuracy for that depth)** shrinks the error radius by 25–35%.
   - Early or late releases get normal accuracy, never a forced miss.
   - Make it a setting, "Precision Passing", on by default at Legend and off at Rookie.
3. **Throwing lanes, the mobile version of Field Vision.** If the throw path crosses a lineman's sprite near release, add accuracy error and a chance of a batted ball (about 1–2% of all attempts). The penalty grows for **QBs under 6'1"** and shrinks for 6'4" and taller. This uses existing height data and gives short QBs a real style: they roll out to find lanes.
4. **Reads tied to awareness.** Show the open, tight and covered rings only on the QB's first N reads. N is 2 for an average QB, 3–4 for an elite one (awareness 90+), and 1 for a rookie-level QB. This is Madden 26's read-progression rule made visible.
5. **Hot defender.** Before the snap, mark an unblocked blitzer with a small flame icon (our own art) and teach the quick throw. Make it rarer at higher difficulty, and use our own term, for example "FREE RUSHER".

### 8.3 Catching

1. **Automatic catch type by default**, chosen from the receiver's trait: a possession receiver secures the ball, a YAC receiver turns upfield, a contested-catch receiver high-points.
2. **An optional "SNAG" tap**, a lighter version of Madden 27's timing-based catching. While the ball is in the air, a ring around the receiver fills.
   - Tapping in the green window raises the contested-catch chance by about +10–15 points and triggers a highlight animation.
   - The window shrinks with coverage tightness: open, covered, smothered.
   - **Missing the tap never forces a drop**; it falls back to the ratings roll. Madden's "late = drop" rule is too punishing for a phone.
3. Hit the catch-rate spreads in §1.9: catch rate 57–77% by receiver, about 4.4 yards after the catch.

### 8.4 Run game and ball carrier

Our current stick plus juke, spin and power buttons is sound. Add:

1. **Hold-to-truck** (Retro Bowl): holding the Power button charges a short meter of about 0.4–0.6 s. While charging the runner moves at about 85% speed and can be tackled from behind. Releasing near full gives a truck chance scaled by trucking against the tackler's tackle and hit power.
2. **Automatic stiff arm and hurdle**, rated by attribute, when no button is pressed. Strong backs stiff-arm more and fast backs hurdle more, so stars feel like themselves without inputs. Keep the manual buttons for experts.
3. **Dive / Reach** button within 3 yards of the line to gain or the goal line: about +1 yard, with a small extra fumble risk if hit while reaching (Madden 26).
4. **Cover Ball:** hold with two fingers on the runner to cut fumble chance by about 70% and slow down by about 10%.
5. **Tackler wind-up** (we already have a ring and "!"). Make it visible **0.25–0.35 s** before contact, so a juke has a fair chance to beat it. Each repeat of the same move within a play keeps its stamina cost.
6. **Lane reads:** keep the Codex fixes. Calibrate with the distribution in §8.1C, not the average.

### 8.5 Defense (optional mode or events)

The design notes say true human-versus-human defense is a separate networking project (OVERHAUL-GAMEPLAY.md). Two light ways to make defense interactive without that:

1. **Tecmo-style "Read the Play"** on defensive stops in solo and Ultimate Team games.
   - Before the opponent's key snaps (for example 3rd downs, or the last 2 minutes), choose 1 of 3 defensive calls. A correct guess, for example blitz against a deep drop, gives an instant rusher or jumps the route.
   - The result is then simulated from the real distributions. It is a 2-second decision that makes the simulated defense feel like yours, and it answers the Madden Mobile complaint that there is "no game mode where players can actively control their defense".
2. **"Big Hit" timing for the user-controlled tackler**, adapted from Madden's Hit Stick indicator. When the defender closes on the ball carrier, a ring shows power, angle and timing.
   - A perfect tap gives a big hit with a fumble chance of about 6–8% (around 10% with an "Enforcer"-style trait). Keep the overall fumble rate in §8.1.
   - An early or late tap gives a normal wrap tackle with a broken-tackle chance.
   - The defender's tackle and hit power ratings widen the window.

### 8.6 Momentum, On Fire and star moments

We already put the QB On Fire after 3 straight completions.

1. **Defensive fire**, from Blitz: **2 sacks in a row** or a takeaway set the defense On Fire, speeding up its rush. It ends after a first down allowed of 10 or more yards.
2. **On Fire knockouts and messaging.** End it on an incompletion, sack or interception, as now. Show a small flame meter so players know they are one catch away.
3. **"Zone" traits on star cards**, our own name and art, modelled on Madden's X-Factors. Each elite card gets one trait with an **explicit trigger and knockout** shown on the card:

   | Card | Trigger | Knockout | Effect while in the zone |
   |---|---|---|---|
   | QB | One completion of 30+ air yards | One sack | Full arc, +1 read |
   | WR | Three catches of 10+ yards | Three straight plays not targeted | Wins contested catches more |
   | RB | Two runs of 8+ yards | A run for a loss | Breaks the first tackle more |
   | Pass rusher | A sack | A 20-yard completion against the defense | Faster rush |

   Effects should be **chance-based (about 50% when conditions are met)**, as Madden 26 changed them to, and never guaranteed. Make the effect visible with a glow, a sound and a tag in the play readout.
4. **Hot/Cold** (Madden 27) as a light layer: two good plays heat a player and two bad ones cool him. Use it only for visual flair and trait access, not hidden stat swings, so outcomes stay explainable.
5. **Crowd pressure for road games** in solo Club Season and Cups only, College Football-style.
   - Shake the screen gently, and hide the receiver open-rings on red-zone 3rd downs for the visiting player.
   - **A 20+ yard first down silences it** (College Football 26).
   - In hostile stadiums the kick meter fades after it appears.
   - Respect reduced motion: replace the shake with a pulsing border.
   - **Never use it in online Ultimate Team**, as Madden 27 disables home-field advantage in online MUT.

### 8.7 Kicking

- Use a two-stage meter: tap to set accuracy on a horizontal bar that sweeps, then hold to fill power and release before the red overkick zone. Or use Retro Bowl's simpler two taps.
- **Kicker accuracy slows the sweep** and kicker power sets range, both from Retro Bowl.
- Wind shifts the arc.
- Calibrate so a perfect 50-yard attempt by an average kicker succeeds about 85–90% of the time, and the realistic population of attempts lands on §1.7 (50–59 yards ≈ 71%).

### 8.8 Playcalling and pre-play

1. **Three play cards**, as now, plus a **Coach Pick** badge on one card with a one-line reason in our own voice, for example "They're showing two deep — the seam is open." This is Madden 26's Coach Suggestions and CoachSpeak on a phone.
2. **AI defense counters user tendencies** within a game. If the player calls the same concept or target 3 times in 6 plays, the AI shades coverage to it, and the pre-snap readout says so ("They're keying on the flats"). This is Madden 26's Adaptive Counters made visible.
3. **AI offense** in simulations follows real pass rates by down (47%, 59%, 74%, 62% for downs 1–4), goes for it on 4th down 1.4–1.6 times a game, and throws the ball away rather than taking needless sacks.
4. **Coverage shell icons** (1-high or 2-high) before the snap. At Legend difficulty a rotation after the snap disguises them about 25–35% of the time (College Football 26 / Madden real-time coaching).

### 8.9 Clock, pace and game length

- **Mobile sessions:** Madden Mobile started at 1-minute quarters and Blitz games took about 12 minutes. Keep a full match at **3–6 minutes of player time**. Our 4-drive arcade format with a 2-minute final drive fits that.
- **No whistle dead time:** auto-advance to the play-call screen in about 0.6–0.8 s, and make celebrations skippable with a tap. Madden Mobile players complain about whistles after every play.
- **Auto-play or quick sim** for any grind objective. It is what Madden Mobile players praise most. Let Squad Battles and Ultimate Team events be simulated with a small reward cut (for example 70% of coins), as Retro Bowl's "Interrupt Sim" does.
- **For simulated game clocks:** about 24 s of game clock per snap and 60–61 offensive plays per team. Sims of the two-minute drill should stop the clock on incompletions and out-of-bounds plays, as ours already does.

### 8.10 Identity: player look, signature traits and animation

The owner asked that players be recognizable.

1. **Appearance driven by data on every card:** height and weight build (already in the data), jersey number, handedness (left-handed QBs throw left), and position gear. Add a small **hand-curated signature table for the top ~100 NFL cards**: hair silhouette, visor, sleeve and arm-band style, skin tone and celebration. No team logos or league marks beyond what the game already uses.
2. **Signature motion for stars** (Madden 26 has 16 signature QB sets and signature run cycles):
   - QBs: stance, ball hold (two hands high, or one hand low "gunslinger") and arm slot (over the top, ¾ or sidearm, from Madden's 3 arm slots).
   - Running backs: one of 3 run-cycle variants (upright, low and churning, glider).
   - Use these to separate stars visually.
3. **Animation state checklist for pixel art.** Madden's numbers (700+ catch animations, 700+ tackle animations, 500+ blocking animations, 4,000+ celebration elements) show that **variety** is what sells realism. For pixel art, aim for **3–4 variants per frequent action**:
   - QB: dropback in 3, 5 and 7 steps; throwing on the run; a pump fake.
   - Catches: possession (two hands), high-point, diving, one-handed spectacular.
   - Tackles: wrap, big hit (2–3 frames of hit-stop for impact), ankle dive, gang tackle.
   - Ball carrier: juke, spin, stiff arm, truck, hurdle, dive.
   - Celebrations: 4–6 short ones, skippable.

   Frame counts are our design recommendation, not from a source. Run cycles of 6–8 frames at 10–12 fps. A throw with anticipation, release and follow-through, with release about 0.35–0.45 s after the windup starts so the timing reads clearly.

### 8.11 Mobile controls checklist

The control rules below draw on Madden Mobile, Retro Bowl and Blitz:

- One thumb steers with the virtual stick. The other thumb gets **at most 3 context buttons** (Juke, Spin, Power when running; Bullet/Lob when passing). Each is at least 44 design px and placed in the lower-right thumb arc.
- Every move also has a gesture (flicks), but **buttons are the discoverable default**.
- Moves cost stamina, in the spirit of Blitz's shared turbo meter and Madden 26's Effort system. Show the stamina bar under the runner.
- Celebrations skip on a tap, and the next play-call screen appears in under 1 s.
- Optional "one-button" assist for new players: automatic catch, automatic moves and automatic kick aim, like Madden Mobile's one-button mode. It is off in online play, or both players are matched with it on.

### 8.12 NFL Ultimate Team (packs, odds, promos and chase)

**Odds disclosure.** Add a "View Odds" sheet to every pack, shown as **chance of at least one item per band**.

- Bands at 100% are guarantees, and every opening is independent.
- The structure follows MUT. Example rebalance for our Premium Gold (8 cards):

  | Band | Chance of at least one |
  |---|---|
  | Gold 75+ | 100% |
  | 80+ | 100% |
  | 84+ | 45% |
  | 87+ | 14% |
  | 90+ (promo) | 6% |
  | Legend | 0.66% |

- Keep **the floor one band below the chase band**, and the top non-promo band at 3–6% per pack, the same bands MUT 20 used.

**Ratings cap.** **Keep the maximum overall at 99.** Mobile players dislike overalls above 99. Show extra promo power through trait tiers, Bronze, Silver and Gold that add new effects, as in Madden 27, instead of a higher number.

**Weekly loop:**

- A **12-game weekly Solo Gauntlet** with escalating rewards by score, like Solo Champions.
- A short **"Season" ladder where 10 wins reach the playoffs.**
- **3 runs a week** of a hard Sick-Six-style boss ladder.
- **Weekly "Team of the Week"-style cards on Wednesday**, from real weekly stats where available, otherwise from the historical "on this week" seasons.
- Limited-time cards should stay **7 days**.

**Promo calendar** tied to the NFL calendar, all with our own names:

| Season | Promo idea |
|---|---|
| Season opener (September) | Kickoff promo |
| Halloween (mid-October to early November) | Night-themed promo with "guess the hidden player" sets |
| Thanksgiving | Harvest-style feast promo |
| December | Winter promo with a login pick-one card |
| January | Playoffs bracket promo, with upgrades as teams advance |
| February | Title-game promo |
| Late winter | Team of the Year |
| Spring | Draft and "college heroes" promo |
| Summer | Legends and position-heroes off-season |

**Each promo should include every earning path MUT and Madden Mobile use:**

1. A free login card.
2. A **featured hero card upgradeable through 6–10 tiers** with event currency. Mobile's 21 tiers suggest players accept long tracks.
3. Upgradeable H2H or Squad Battles reward cards capped at 90.
4. A replayable solo challenge.
5. A themed SBC with a twist, such as Detective Sets.
6. A boss challenge.

Keep regenerating currency optional and generous (no hard blockers). Mobile players dislike slow stamina regeneration.

**Fan-ballot cards** (our version of Golden Tickets): community-voted "dream" versions of historical players, released in waves of 5–6.

**Chemistry tiers** like MUT's: one tier every 5 matching components. Count coach, uniforms and stadium items as components if we add them. Each tier gives a small +1 to two attributes, so a full team-chemistry squad gains about +20 attribute points, a visible but not overwhelming bonus. Promo chemistries (for example "Night" and "Team of the Week") should give their boosts at fewer components.

**Upgrades:** an EVO-style "feed a higher-overall same-tier card to raise this one" path, with costs rising steeply by tier (Madden Mobile uses 2 → 10 → 50 → 250 tokens). It gives duplicates and fodder a purpose. Keep all owned UIDs and serials untouched (brief constraint).

**A light management meta**, from Retro Bowl:

- Fan support bars after each game increase the coin multiplier.
- One optional press-conference choice after notable games, for example "Praise the team: +chemistry this week" or "Hype the fans: +10% coins next game".
- Small coordinator-style trait items with legible ±5% effects. This is the "just deep enough" management that reviewers credit for Retro Bowl's addictiveness.

### 8.13 Measurement plan

1. Add a nightly headless sweep of about **5,000 seeded drives** per difficulty, using both autopilot and human-like strategies. Report every metric in §8.1 with tolerance bands.
2. Publish the report next to `docs/gameplay-balance-summary.json`.
3. In addition, add a "Last Play" telemetry roll-up: completion % by depth, INT % by depth, sack rate, run histogram and 3rd-down curve, aggregated locally on the player's device in dev builds only, to compare human play against these targets.

---

## 9. Source list (key)

**Madden (console and PC):**

- [Madden 26 Gameplay Deep Dive (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)
- [Madden 25 Gameplay Deep Dive (MUT.GG mirror)](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive)
- [Madden 25 Gridiron Notes (EA mirror)](https://careers.ea.com/games/madden-nfl/madden-nfl-25/news/gridiron-notes-madden-25-gameplay-deep-dive)
- [Madden 27 Gameplay (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)
- [Madden 27 deep dive (MUT.GG)](https://mut.gg/news/madden-nfl-27-gameplay-deep-dive/)
- [Madden 26 title update notes, November 19 2025 (MUT.GG)](https://www.mut.gg/news/madden-nfl-26-title-update-november-19th/)
- [Madden 22 momentum and home-field advantages (MUT.GG)](https://www.mut.gg/news/madden-nfl-22-homefield-advantages-gameday-factors-and-momentum-factors)
- [X-Factor zones (Diamond Lobby)](https://diamondlobby.com/madden-24/how-to-enter-the-zone-madden-24/)
- [Madden 25 passing guide (Prima Games)](https://primagames.com/gaming/madden-nfl-25-passing-guide-controls-settings-pass-types-and-more)
- [Madden 23 pass types (GameSkinny)](https://www.gameskinny.com/bnave/madden-23-pass-types-controls-and-fieldsense-skill-based-passing-explained)
- [Catch types (Madden School)](https://www.madden-school.com/how-and-when-to-use-rac-vs-possession-vs-aggressive-catch-in-madden-20/)
- [QB Vision Cone (Game Informer)](https://gameinformer.com/b/features/archive/2017/03/06/the-sports-desk-in-defense-of-the-madden-qb-vision-cone)
- [Madden 25 hit stick (Dexerto)](https://dexerto.com/madden/how-to-use-the-hit-stick-in-madden-25-2863265)
- [Madden 25 kicking meters (Madden University)](https://www.maddenuniversity.com/strategies/special-teams/kicking/two-ways-to-kick-in-madden-nfl-25-legacy-and-multi-meter-options)

**College Football:**

- [College Football 26 Gameplay Deep Dive (EA)](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-campus-huddle-gameplay-deep-dive)
- [College Football 25 wear and tear and home-field advantage (CBS Sports)](https://www.cbssports.com/college-football/news/watch-ea-sports-college-football-25-gameplay-trailer-goes-in-depth-on-wear-tear-homefield-advantage)
- [College Football 25 home-field advantage (Game Rant)](https://gamerant.com/college-football-gameplay-features-home-field-advantage-wear-and-tear-get-louder/)
- [Stadium Pulse (TheGamer)](https://www.thegamer.com/ea-sports-college-football-25-stadium-pulse-abilities-explained-guide/)
- [Stadium Pulse (EA Help)](https://help.ea.com/da/articles/ea-sports-college-football/stadium-pulse/)
- [College Football 25 abilities and wear and tear (GamingBolt)](https://gamingbolt.com/ea-sports-college-football-25-wear-and-tear-abilities-and-more-detailed-in-new-deep-dive)
- [College Football 25 review (Charlie Intel)](https://charlieintel.com/games/college-football-25-review-333271)
- [College Football 25 review (Shacknews)](https://shacknews.com/article/140606/ea-sports-college-football-25-review)

**Madden NFL Mobile:**

- [How to Play, Madden NFL 26 Mobile (EA)](https://www.ea.com/en/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-how-to-play)
- [VS Mode (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-vs-mode)
- [Most Feared on mobile (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-maxing-out-most-feared)
- [Player EVO (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-madden-101-player-evo)
- [Team of the Year Part 2 (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-team-of-the-year-part-two)
- [Madden Mobile design analysis (Deconstructor of Fun)](https://www.deconstructoroffun.com/blog//2015/02/madden-mobile-can-ea-update-its-classic.html)
- [Madden NFL Mobile review (GameZebo)](https://www.gamezebo.com/reviews/madden-nfl-mobile-review-keeping-the-drive-going/)
- [Madden NFL Mobile FAQ (EA forum)](https://forums.ea.com/discussions/madden-nfl-mobile-en/madden-nfl-mobile-faq/8936215)
- [User reviews (TapTap)](https://www.taptap.io/app/195921/review)
- [Madden Mobile Issues (EA forum)](https://forums.ea.com/discussions/madden-nfl-mobile-en/madden-mobile-issues/13293592)

**Retro Bowl:**

- [Retro Bowl (Wikipedia)](https://en.wikipedia.org/wiki/Retro_Bowl)
- [Retro Bowl (App Store)](https://apps.apple.com/app/id1478902583)
- [Passing guide (retrobowl.gg)](https://retrobowl.gg/blog/retro-bowl-passing-guide/)
- [Defector](https://defector.com/this-little-football-game-on-my-phone-is-fun-as-hell)
- [Seasons mode guide (GamingOnPhone)](https://gamingonphone.com/guides/retro-bowl-the-complete-seasons-mode-guide-and-tips)
- [Pocket Gamer review](https://ee.pocketgamer.com/articles/084147/retro-bowl-review-a-must-play-sports-game/)
- [Nintendo Life review](https://www.nintendolife.com/reviews/switch-eshop/retro-bowl)
- [MobileSyrup review](https://mobilesyrup.com/2020/09/27/retro-bowl-football-game-review/)
- [New Star Games update post](https://www.newstargames.com/post/10-apr-2025-multiple-updates)

**NFL Blitz and Tecmo Super Bowl:**

- [NFL Blitz history (Den of Geek)](https://www.denofgeek.com/games/nfl-blitz-history-making-of-too-violent-retrospective-midway/)
- [NFL Blitz 2000 N64 manual (archive.org)](https://archive.org/download/Nintendo64Manuals_201812/NFL%20Blitz%202000%20%28USA%29_text.pdf)
- [NFL Blitz (Wikipedia)](https://en.wikipedia.org/wiki/NFL_Blitz_(1997_video_game))
- [The Legend of Tecmo Super Bowl (The Ringer)](https://www.theringer.com/2016/11/17/nfl/the-legend-of-tecmo-super-bowl-8824647ea94d)
- [Tecmo Super Bowl (Giant Bomb)](https://giantbomb.com/wiki/Games/Tecmo_Super_Bowl)
- [Tecmo Super Bowl ratings (TecmoGeek)](https://tecmogeek.com/about/ratings)

**Ultimate Team:**

- [Madden 26 pack probability (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-ultimate-team-26-pack-probability)
- [College Football 26 pack probabilities (EA)](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/college-football-26-ultimate-team-pack-probabilities)
- [Madden 20 pack odds (GamingBolt)](https://gamingbolt.com/madden-nfl-20-ultimate-team-guide-tips-pack-prices-and-card-chances)
- [MUT 26 deep dive (MUT.GG)](https://www.mut.gg/news/madden-nfl-26-ultimate-team-deep-dive/)
- [MUT team chemistry tutorial (MUT.GG)](https://www.mut.gg/news/mut-101-team-chemistry-tutorial/)
- [Most Feared (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-26/event/madden-26-most-feared)
- [Madden 26 Season 4 (EA)](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-season-4)
- [MUT content schedule (MUT.GG)](https://www.mut.gg/schedule/?page=10)
- [Golden Tickets (MUT.GG)](https://www.mut.gg/news/golden-ticket-program-details-mut-22)

**NFL statistics:**

- [nflverse play-by-play (computed here)](https://github.com/nflverse/nflverse-data/releases/tag/pbp)
- [Pressure probability (NFL Next Gen Stats)](https://www.nfl.com/news/next-gen-stats-introduction-to-pressure-probability)
- [Time to throw (PFF)](https://www.pff.com/news/nfl-quarterbacks-are-holding-the-ball-longer-than-ever-the-trends-behind-time-to-throw/)
- [Pressure splits (WOKV / PFF)](https://wokv.com/news/local/how-much-does-pressure-matter-defense/2BK2ZVT4MJFLHAKDA5R6OHZNKU)
- [QB performance under pressure (The Analyst)](https://theanalyst.com/2025/01/nfl-quarterback-performance-under-pressure)
- [Interception rate decline (SI)](https://www.si.com/nfl/2019/10/02/nfl-interception-rate-decline)
- [Scoring distribution since 1940 (Football Perspective)](https://www.footballperspective.com/scoring-distribution-since-1940/)
- [Dynamic kickoff impact (NFL Football Operations)](https://operations.nfl.com/updates/the-game/dynamic-kickoff-making-leaguewide-impact-on-offense-through-week-4)
- [2025 kickoff rule (CBS Sports)](https://www.cbssports.com/nfl/news/nfl-makes-another-change-to-dynamic-kickoff-format-ahead-of-2025-season-to-spark-more-kick-returns)
- [2025 kickoff return rate (ProFootballTalk)](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/nfl-had-74-5-percent-of-kickoffs-returned-in-2025-after-only-32-8-percent-in-2024)

**Gaps and caveats:**

- **Blocked sites:** Pro-Football-Reference, GameSpot, TV Tropes and some EA pages returned 403 or 500. www.nfldata.org did not resolve in this sandbox; it would have to be allowed in the session's network settings.
- **No frame counts:** no source publishes exact Madden Hit Stick or catch timing windows in frames or milliseconds. The windows suggested in §8 (about 120 ms for a perfect release, a 0.25–0.35 s tackler wind-up) are design proposals.
- **No current pack odds:** Madden 26 and 27 pack odds appear only in the game client. The newest published table found here is Madden 20.
- **Unverified Tecmo details:** the Tecmo weekly condition system and the grapple button-mashing were not verified.
