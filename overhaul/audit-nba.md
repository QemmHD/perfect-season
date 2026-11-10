# NBA arcade engine and controls: audit

**Area:** `src/game/hoops2/*`, plus the shared `src/game/pixel/*`, `sprites.ts`, `juice.ts`, `PlayReadout.tsx`, `difficulty.ts` and `attrs.ts`, and the wrappers that host the game (`src/game/Arcade.tsx`, `src/ut/Match.tsx`).
**Checkout:** `/home/user/ps-studio`, branch `claude/studio-overhaul`, `acdf3e2`. Nothing in the repo was modified.
**Date:** 2026-11-09. **Auditor:** an audit agent (read-only).

**How it was measured**
- **Seeded autopilot games.** 60 games per configuration with real Ultimate Team themed squads from `aiOpponent()`. A box score was counted from the engine's own events. That gives 720 two-sided games, plus 241 era games.
- **The existing human-strategy harness.** `HUMAN=1`, 20 games per row, at Pro and Legend defense.
- **The rating-to-make-chance curve.** It was read directly from `greenWindow` and `releaseProbability`.
- **Foot sliding.** About 1.13 M on-ground body-frames, classified with the renderer's own animation choice.
- **Playwright captures.** Taken at 390×844, 430×932, 375×667, 320×568 and 844×390, with DPR 3, `isMobile` and `hasTouch`. Touch went through CDP multi-touch. Only localhost requests were allowed, and the lab used `?arcade&ns=inspect&relay=ws://localhost:7777`.
- **Frame timing.** Measured at 1× and with a 4× CPU slowdown.
- **The existing hoops2, juice and feedback tests.** 41 passed, 2 skipped (both opt-in).

Scripts are in `scratchpad/overhaul/audit-scripts/` and screenshots in `scratchpad/overhaul/audit-shots/nba/`. Full paths are in the appendix.

---

## 0. Executive summary

The engine underneath is good. It has deterministic fixed-step physics and rating-driven contests, and its physical rebounds and catches work. Rating monotonicity is tested, the juice layer is render-only, and the frame budget is about 2 ms. What falls short of a "respected sports game on mobile" is everything around that core:

1. **Critical: it is not a basketball game yet, it is a score attack.**
   - You play 16 offensive possessions and never defend.
   - The rival's score is computed by the autopilot before tip-off and revealed as you finish yours (`Arcade.tsx:187-196, 243-250`).
   - Finals look like 20–18, ties (5–10% of even games) are decided by squad rating, and a game lasts about 2–3 minutes.
2. **Critical: nobody can tell who is who.** Every player has the same skin tone and the same hair colour, with a hair style hashed from the player id (`render.ts:61-77`, `pixel/body.ts:592-610`). The owner asked for exactly this to be fixed.
3. **High: the shot-clock HUD freezes.** The bug only re-renders on React state changes. In one measured possession it sat on "8" for 7 s, and then the shot-clock turnover fired while it still read 8 (`Hoops2.tsx:784`).
4. **High: a thumb already on the stick at tip-off is ignored for the whole possession.** The knob stayed at `translate(0px, 0px)` for 2.25 s of live play (`Hoops2.tsx:619-625`).
5. **High: on iPhone SE sizes, your own ball handler is hidden behind CROSS / STEP BACK / PASS at tip-off.** This happens at 375×667 and 320×568. The coach calls sit about 600 px from the thumbs (`coach-controls.css:2-14`).
6. **High: the box scores are not NBA-like.**
   - Free-throw rate is **0.02** against the NBA's 0.24, because there are no shooting fouls.
   - Mid-range FG is **65%** against about 42%, and eFG is **61%** against 54.7%.
   - Pro turnover rate is **6.6%** against about 12%, while Legend is **18%**.
   - The highest-rated player scores **7.5–16%** of team points. One player takes about **62%** of a game's points, and only 2.9 players score per game.
   - Elite-shooter squads shoot within **2.6 s**: 83% threes, 89% of jumpers heavily contested, 0.37 passes a trip.
7. **High: the green window is smaller than the input.**
   - The average shooter's open green is ±17.5 ms, and under a heavy contest ±7 ms. The minimum is ±3 ms, which is less than one 16.7 ms frame.
   - It is drawn as a slice 2–4 px wide.
   - Release time is taken from the 60 Hz simulation clock, not the touch event (`engine.ts:475, 529-531`).
   - "PERFECT" can still miss: a green that is heavily contested converts only 32–62%.
8. **High: 29% of on-ground animation frames slide the feet.**
   - Recorded `crossover`, `dribble`, `jump`, `cut` and `catch` clips exist but are unused.
   - The step-back is the crossover pose played backwards.
   - Blocks, rebounds and contests share one pose.
9. **High: the camera behind the shooter hides the on-ball defender behind your own player.** It pans up on every shot, pushing the shooter under the buttons. Near the rim, players and labels pile into an unreadable stack.
10. **Medium: the HUD covers the action.** Pop banners at 38% of the height cover the rim on every make, block, turnover and call. Labels collide. The pixel font has no `& / Ö Ć Č …`, so names like Jokić, Dončić and Petrović and labels like "CATCH & SHOOT" print with holes.
11. **Medium: difficulty doesn't work the way players expect.** One `defIQ` sets both defenses, so the Legend AI scores fewer points than the Pro AI (measured 18.6 against 20.5 a game). Meanwhile a person playing simple, honest tactics manages 0.4–0.9 points per possession against the AI's 1.17–1.28, even on Rookie.
12. **Medium: there's no pause or quit in a match.** iOS haptics are a single delayed tick for every event. There are no fouls or free-throw trips, no OT, no box score at the end, and no announcer, music or shot-clock warning.

---

## 1. Box-score realism: measured against the NBA

The harness is `audit-scripts/nba-box.test.ts`. Each box score is counted from the engine's events (`release`, `finish:*`, `blocked:*`, `ft:*`, `orb:*`, ends). Squads are Ultimate Team themed squads from `aiOpponent(pool, target)`. The autopilot plays at Pro (skill 0.68, `defIQ` 0) unless noted. Each row is 60 games, about 960 possessions a side.

The NBA reference is the 2023-24 league average (Basketball-Reference team totals; Cleaning the Glass shot zones):
- 1.153 points a possession
- FG% .474
- 3PA/FGA .395, 3P% .366
- FTA/FGA .244, FT% .784
- turnover rate about 12% of possessions
- offensive-rebound rate about 24–25%
- assists on about 63% of field goals
- shot zones: about 31% at the rim (66%), about 30% mid and short (about 42–44%), about 39% threes

| Metric | Even 78 (Pro) | Even 86 (Pro) | Even 70 (Pro) | Even 78 (Legend AI + D) | Even 78 (Rookie AI + D) | 90 vs 75 (strong side) | NBA 2023-24 |
|---|---|---|---|---|---|---|---|
| Points a game (16 possessions) | 20.5 | 22.6 | 18.4 | 18.6 | 20.4 | 21.6 | 115 (about 99 possessions) |
| Points a possession | **1.28** | **1.41** | 1.15 | 1.16 | 1.27 | 1.35 | 1.15 |
| Seconds a possession (14 s clock) | 6.2 | 3.8 | 8.6 | 6.5 | 5.8 | **2.6** | about 14.5 (24 s clock) |
| FG% | .539 | .509 | .514 | .531 | .530 | .402 | .474 |
| 3PA rate | .327 | .603 | .223 | .430 | .232 | **.830** | .395 |
| 3P% | **.431** | .445 | .374 | .392 | .445 | .360 | .366 |
| eFG | **.610** | .643 | .556 | .615 | .582 | .551 | .547 |
| FT rate (FTA/FGA) | **.019** | .009 | .024 | .025 | .041 | .011 | **.244** |
| Turnovers a possession | **.066** | .055 | .108 | **.180** | .056 | .023 | about .12 |
| Steals a possession | .046 | .030 | .091 | .110 | .042 | .003 | about .076 |
| Offensive-rebound rate | .223 | .274 | .262 | .257 | .253 | .328 | about .245 |
| Assisted share of field goals¹ | .84 | .59 | .73 | .84 | .78 | **.24** | about .63 |
| Rim share @ make% | 27% @ 58% | 13% @ 47% | 37% @ 61% | 22% @ 63% | 45% @ 56% | 11% @ 56% | 31% @ 66% |
| Close (under 14 ft jumper) share @ make% | 14% @ 51% | 11% @ 69% | 9% @ 41% | 12% @ 57% | 13% @ 51% | 1% | |
| Mid share @ make% | 26% @ **65%** | 16% @ 65% | 32% @ 54% | 23% @ 68% | 20% @ 57% | 5% @ 70% | about 30% @ about 42% |
| Share of jumpers heavily contested | 46% | 70% | 39% | 57% | 34% | **89%** | n/a |
| Passes a possession | 1.31 | 0.95 | 1.10 | 1.32 | 1.28 | **0.37** | (about 3 a possession) |
| Highest-overall card's share of FGA | 15% | 37% | 18% | 22% | 16% | 30% | star usage 28–35% |
| Ties (decided by rating) | 6.7% | 10% | 10% | 6.7% | 5% | 3.3% | OT about 6% |

¹ An assist here is counted when a catch is followed by a make within 3.5 s. That is generous, so the gap is direction, not precision.

**Scoring concentration.** This was measured separately from `g.box` over 60 even-78 games (`nba-conc.test.ts`):
- The top scorer takes **62%** of the team's points.
- Only **2.9 players score** in a game.
- The highest-overall card takes **7.5%**.
- By lineup slot (`nba-anim.test.ts`), points split 24/24/23/17/12% across PG/SG/SF/PF/C, while **the PG slot holds the ball 74% of the time**.

The AI finds the single best matchup and repeats it, and nothing gives the star the ball.

**Era rows.** Squads near 80, grouped by theme decade, 10–43 games each:

| Decade | 1960s | 1970s | 1980s | 1990s | 2000s | 2010s | 2020s |
|---|---|---|---|---|---|---|---|
| 3PA rate (measured) | .10 | .08 | **.215** | **.374** | **.526** | **.548** | .403 |
| 3PA rate (NBA, approximate) | (no line) | (no line) | about .03–.08 | about .10–.20 | about .20 | about .22–.36 | about .40 |
| 3P% (measured) | .33 | .42 | .43 | **.48** | .41 | .44 | .41 |
| Seconds a possession | 6.9 | 6.7 | 5.6 | 5.3 | 4.8 | 4.5 | 5.2 |
| Points a possession | 1.25 | 1.21 | 1.28 | 1.36 | 1.35 | 1.40 | 1.28 |

The 2000s and 2010s squads shoot more threes than the 2020s ones. Pace runs the wrong way: older eras are slower, when the real NBA was faster. Pre-1980 players shoot threes at all because `thr` comes from free-throw touch for `from < 1980` (`ratings.ts:113`).

### NBA-01 · High · Free throws effectively don't exist
- **Evidence.** The only foul is the and-one on a made finish (`engine.ts:637-642`). Jump shots are never fouled. Missed drives are never fouled. There are no reach-in, bonus or team fouls, no foul trouble and no free-throw trips. FTA/FGA is 0.009–0.041 against the NBA's 0.244. The and-one free throw is rolled automatically by rating; there is no free-throw meter. The `'A'` mark is always worth 3 (`game.ts:13, 100`), so a four-point play is impossible.
- **Impact.** Box scores look nothing like basketball. Big men and drivers lose their "gets to the line" identity, and the free-throw rating barely matters.
- **Fix.**
  1. Add shooting fouls on contested drives (and some jumpers), with a probability from the defender's foul tendency (low DEF IQ or high aggression), contact and the shooter's STR and draw. Aim for an FT rate of about 0.20.
  2. Make free throws a short, skippable meter minigame (or auto-shoot in sims), and count team fouls each half so a bonus exists.
  3. Bumps the NBA protocol.

### NBA-02 · High · Shooting efficiency is inverted
- **Evidence.** Mid-range shots go in 54–70% against the NBA's about 42%, and close shots about 51%. Rim attempts are only 56–63%. Threes go in 41–48% for even teams. Under the curve (`nba-curve.json`), a thr-75 open three is a 96% make at ±20 ms, and the live % shows 65% at the arc. The design intent in `GAMEPLAY-RATINGS.md` ("open threes 67% for a 75") is arcade, but the result is a sport where the long two is the best shot.
- **Impact.** "Stats feel legit" fails at a glance: team FG% runs .51–.54 and eFG .61–.66.
- **Fix.**
  - Lower `offGreenBase` and `perfectCap` for mid and close, so an open perfect mid-range shot is worth about 0.9–1.0 points, below a rim finish or an open three.
  - Raise rim finish rates to about 64–68% for an average finisher, so the shot-value ordering matches the NBA: rim > corner three > above-break three > mid.
  - Keep the "a green open shot is rewarded" feel by making green feedback deterministic (NBA-12) rather than raising base percentages.
  - Re-run `ratings-matter.test.ts` and bump the protocol.

### NBA-03 · High · The AI plays hero ball and the star disappears
- **Evidence.** A 90 squad against a 75 squad shoots after 2.6 s on average: 83% threes, 89% heavily contested, 0.37 passes and 24% assisted. The highest-overall card takes 7.5–16% of points while one matchup takes 62%. The handler is always slot 0 at tip-off (`engine.ts:103`). There is no "get the star the ball" logic, because `decide()` only maximises the instant value of the current shot (`autopilot.ts:296-344`).
- **Impact.** The AI rival's possessions, simmed games, takeovers and Club Season results all inherit this. It doesn't look like the 1990s Bulls running offense through Jordan.
- **Fix.**
  - Give the autopilot a usage model: weight touches toward the player with the best creation ratings (HND, SPD, the shots) to a target of about 28–35%.
  - Enforce a minimum possession build-up, such as no heavily contested three before about 5 s unless the clock is under 4.
  - Prefer an inbound or entry to the star. A sharper skill means better shot quality, not earlier shots.

### NBA-04 · High · Turnovers are too rare on Pro and brutal on Legend and for human drives
- **Evidence.** The Pro turnover rate is 6.6%, almost all steals. Legend reaches 18%: steals 11% plus interceptions 6.6%. In the human harness, a person who simply drives at the rim loses it on **10–25% of possessions** (`human-def0.log` and `human-def1.log`: 31–78 steals per about 320 possessions). There are no travels, charges, kicked balls or out-of-bounds; the court is clamped (`engine.ts:179-181`) and players slide along the sideline.
- **Impact.** The most natural input for a new player, driving straight, gets stripped on Legend about one time in four, with no visible foul or explanation beyond "STRIPPED BY X".
- **Fix.**
  - Cap reach-in steals per second when the handler is moving away. Turn some "contact" into an offensive foul or a defensive reach-in foul (feeding NBA-01).
  - Add sideline and baseline out-of-bounds as turnovers.
  - Target about 12% turnovers with a steals share of about 60%.

### NBA-05 · Medium · Eras play almost the same, and some run backwards
- **Evidence.** See the era table: 3PA rate and pace move the wrong way between decades. `schemeFor` and the autopilot have no era inputs.
- **Fix.**
  - Add an optional era style profile per squad, derived from the theme decade or the average season: a three-point appetite multiplier, pace (shot-clock use), post-up weight and mid-range tolerance.
  - For pre-1980 players, cap `thr` (no line existed), or use the old-school distance.
  - These are behaviour weights, not rating changes, so card IDs and ratings stay intact.

### NBA-06 · Medium · The game is too short, scores are tiny and ties go to a hidden rating
- **Evidence.** `PER_HALF = 8` and `POSSESSIONS = 16` (`game.ts:8-9`), with a 14 s shot clock (`engine.ts:18`). Measured length is 6.2 s a possession plus about 1.3–1.6 s of dead time plus replays, so **about 2–2.5 minutes of play**, against the 5–6 minutes in `ARCADE-V2.md`. Final scores are about 20, with a game-to-game standard deviation of about 5. Ties are decided by rating (`Arcade.tsx:4`, `ut/play.ts:76-77`, `Results.tsx:250`): 5–10% of even games.
- **Fix.** Use four quarters with a visible game clock, more possessions and overtime on a tie (a 1-minute OT, or "first to score" for online parity). See NBA-07 for how possessions alternate.

---

## 2. Game format and flow

### NBA-07 · Critical · It is offense-only, and the rival's score is precomputed
- **Evidence.**
  - `ARCADE-V2.md:12` ("Offense only") and `OVERHAUL-GAMEPLAY.md:48`.
  - Against the AI, `ai = useMemo(() => aiPlay(true, …))` plays all 16 rival possessions instantly at mount. `shown` reveals `pointsThrough(ai, n)` as you finish yours (`Arcade.tsx:196, 243-250`).
  - There is no defensive possession, no defensive control and no player switching anywhere in hoops2.
  - The scoreboard's rival number, about 9 in the lab, is not a game being played.
- **Impact.** This is the single biggest gap from "how respected sports games play". There are no stops, no defensive stands, no momentum swings and no comebacks you can cause. "Defense controls" and "switching" (in this audit's brief) don't exist to evaluate.
- **Fix.**
  - **Phase 1 (offline):** alternate possessions in one game. The opponent's possessions run live on screen with the same engine and autopilot (it already exists), and the human controls one defender with:
    - stick movement;
    - a SWITCH button (nearest to the ball, or tap a player);
    - hold-to-contest or jump (reusing `contest` and the `jump` clip);
    - a STEAL swipe with the existing `stl` and foul risk.
  - Offer a "sim defense" toggle (fast-forward at 4× with a ticker) for players who want offense only.
  - **Phase 2 (online):** keep the parallel format for now, but show both sides' running game clocks. Real-time shared defense is a separate netcode project (`OVERHAUL-GAMEPLAY.md:48`).
  - Bumps the NBA draft and UT protocols.

### NBA-08 · High · The HUD shot clock freezes, and there's no warning before a violation
- **Evidence.**
  - The `em` clock renders `Math.ceil(p.clock)` at render time (`Hoops2.tsx:784`).
  - The rAF loop never sets state per frame (`Hoops2.tsx:477-600`).
  - The measured idle possession (`nba-clock.cjs`) showed 14 → 11 → 8, then **"8" for 7.2 s**, and then **"SHOT CLOCK" fired with 8 still showing**.
  - The `.low` class (under 5 s) never appeared. No horn or beep plays in the last seconds.
- **Impact.** It reads as a cheated turnover.
- **Fix.**
  - Update the clock text imperatively from the loop (a ref'd DOM node, or draw it on the canvas), or set a state value only when `ceil(clock)` changes.
  - Add a 5-second urgency state with ticks and a haptic.
  - Render-only, so no protocol bump.

### NBA-09 · Medium · There is no pause and no quit during a match
- **Evidence.**
  - The Hoops2 portal has no pause control.
  - `ut/Match.tsx:1091` allows leaving only in the search, error and load stages.
  - `useInputInterrupt` clears inputs on interruptions, but play resumes immediately when the app comes back.
- **Impact.** A phone call or an accidental home swipe mid-possession can lose the possession, and the player can't concede or restart. Every mobile sports game has a pause menu.
- **Fix.**
  - Add a pause button in the score bug, plus auto-pause on `visibilitychange` and `pagehide` when offline.
  - The menu offers resume, controls help, sound and haptics, and quit or forfeit, with a defined forfeit result for UT.
  - Online, pause becomes "timeout ×1 per half", or isn't offered.

### NBA-10 · Medium · The end of the game has no box score, no player of the game and no recap
- **Evidence.**
  - The final overlay shows "Your possessions 24" and the marks string (`Hoops2.tsx:911-918`). The last pop ("BUCKET +2") is still visible under the card (`audit-shots/nba/390-18-final.png`).
  - The UT result shows WIN or LOSS, the score and the marks only (`ut/Match.tsx:1405-1442`).
  - `HoopsGame.box` records points by slot only (`game.ts:27`).
  - Club Season AI box scores are fabricated: rebounds `floor(rand()*4)`, assists random (`ut/league.ts:303-345`).
- **Fix.**
  - Record a real per-player line in the engine wrapper from the events this audit already uses: PTS, FGM-A, 3PM-A, FTM-A, REB (OREB), AST, STL, BLK, TO. Show a box score tab and a player-of-the-game card with the matchup highlight.
  - Feed the same lines to Club Season instead of random numbers.
  - Stats bookkeeping only: no protocol bump unless the wire format changes.

### NBA-11 · Low · Dead code and small rule gaps
- `game.ts:110-111` computes `shooter` and then calls `void shooter`.
- There is no backcourt timer, three seconds, goaltending, travelling or offensive foul. That's fine for an arcade game, but the turnover and foul mix (NBA-01, NBA-04) needs some of them.
- An offensive rebound resets the clock to `max(clock, 10)` rather than a fixed reset. Acceptable.

---

## 3. Touch controls

Layout measured at 390×844 (CSS px): stick 128×128 at (14, 704); PASS 70 at (208, 676); SHOOT 100 at (276, 732); skills 208×44 at (168, 616); LAST PLAY at (12, 627); coach strip 235×54 at (78, **104**). Full layouts for every size are in `audit-scripts/nba-shots.json`.

### NBA-12 · High · A thumb already on the stick is ignored for the whole possession
- **Evidence.**
  - `stickDown` returns early if `possRef.current.end` or there's no possession (`Hoops2.tsx:619-621`).
  - Because the pointer is never captured, later `pointermove` events are dropped (`Hoops2.tsx:862`).
  - `nba-deadstick.cjs`: thumb down 0.1 s before tip-off and dragged for 2.25 s. The knob stayed at `translate(0px, 0px)` and the handler stood still. After lifting and touching again, the knob moved at once (`translate(1.4px, -27px)`).
  - It reproduced naturally in the scripted run: `390-06-sprint-drive.png` shows the handler frozen at the top of the floor while the stick is held.
  - Resting a thumb on the stick through the dead-ball pause is the normal way people hold the phone.
- **Fix.**
  - Always accept and capture the stick pointer, and keep the direction in `stickRef` during dead balls (just don't apply it), so it's live at tip-off.
  - Apply the same to SHOOT for "hold through the inbound", or explicitly ignore it with a visual.
  - No protocol bump (input layer).

### NBA-13 · High · On small phones the handler is hidden, and the coach calls are out of reach
- **Evidence.**
  - At 375×667 and 320×568 the ball handler stands under the CROSS / STEP BACK / PASS buttons at tip-off (`375x667-01-tipoff.png`, `320-01-tipoff-hint.png`). The camera puts him at 68% of the height (`render.ts:416-417`), and the skills sit at `bottom: sab + 184px` (`play-readout.css:28`).
  - At 320 the skills overlap the LAST PLAY toggle (bounding boxes (98–306, 340–384) and (12–147, 351–395)).
  - SCREEN / CUT / SPACE sit at `top: sat + 104px` in portrait (`coach-controls.css:4`). That's about 600 px from either thumb, so you have to let go of the stick or shoot mid-possession.
  - The hint (top 161) and the coach strip sit over the backboard and rim.
- **Fix.**
  - Make the camera anchor responsive to the control zone: the handler sits at about 52–55% of the height, above the highest control.
  - Move the skills into an arc around SHOOT (2K mobile and Hoop Land put moves on the right-thumb arc), or into gestures only, with a small "MOVES" toggle.
  - Put play calls on a left-thumb radial: hold PASS, or a small CALL button above the stick that opens SCREEN / CUT / SPACE.
  - Collapse the LAST PLAY toggle into the score bug.
  - Verify at 320, 375, 390 and 430 portrait.

### NBA-14 · High · Release timing is quantised to 60 Hz and the green slice is a few pixels wide
- **Evidence.**
  - `pressShoot` stores `m.t0 = p.t` and `releaseShoot` uses `held = p.t − m.t0 − lag` (`engine.ts:475, 529-531`). `p.t` only advances in 16.7 ms steps inside rAF (`Hoops2.tsx:500-551`), so a touch's real time is lost by up to one frame at each end.
  - Green half-windows (`nba-curve.json`, Pro):

    | Rating / contest | Open | Light | Heavy | Smothered |
    |---|---|---|---|---|
    | THR 60 | ±8.7 ms | ±6.1 | ±3.5 | ±3.0 (floor) |
    | THR 75 | ±17.5 ms | ±12.2 | ±7.0 | ±3.0 |
    | THR 90 | ±29.5 ms | ±20.6 | ±11.8 | ±4.4 |

    Legend multiplies by 0.84.
  - On screen, the meter arc is about 85 px long for a 0.676 s span at 390 wide (`render.ts:897-905`). That is 0.126 px per ms, so a THR-75 open green is **about 4 px wide**, a THR-60 green about 2 px, and a heavy contest about 1 px. The fill moves about 2 px a frame.
- **Impact.**
  - In the human harness (release error uniform within ±70 ms), only 0.3–21% of jumpers were greened.
  - Greens feel random rather than earned, and low-rated shooters and contested looks are pure luck.
  - The fixed `RELEASE_LAG = 0.03` (`Hoops2.tsx:33`) can't fit every device. There's no calibration.
- **Fix.**
  1. Timestamp inputs with the `PointerEvent.timeStamp` difference (press to release), converted to game time, instead of step time. That also lets the deterministic engine take an exact `off`.
  2. Raise the floor windows (for example ±10 ms smothered, ±16 ms heavy) and express difficulty mostly through make caps, not sub-frame windows.
  3. Draw the meter bigger: R about 0.13 × width, at least a 6 px slice, plus a "target notch" tick; or offer a vertical bar meter option.
  4. Add a one-time "shot timing calibration" in settings (tap to the beat) that sets the lag.
  5. Bumps the protocol, because outcomes change.

### NBA-15 · Medium · "PERFECT" shots miss
- **Evidence.**
  - `perfectCap` under a heavy contest is 32–62% and under smothered 10–30% (`engine.ts:308-316`). The meter lights green and says "PERFECT TIMING · CONTESTED" (`Hoops2.tsx:292`).
  - Human harness: greened kick-out shots went in 8–17 of 38–41 (Pro and Legend); greened drives 12/26.
- **Impact.** It is the most frustrating thing a shot meter can do. In 2K's competitive modes a green is a make.
- **Fix.** Under heavy or smothered contests, hide the green slice. Show the window shrink as amber ("CONTESTED: no green"), and keep "green = make" absolute for any shot where a green is drawn. The contest still lowers the make chance off-green.

### NBA-16 · Medium · Pass-target % ignores the closeout
- **Evidence.** The % over the aimed teammate is `shotChance(p, target)`, his openness now (`render.ts:831-834`). The AI's own `catchValue` notes that "a man with three feet now is heavily contested by the release" (`autopilot.ts:121-139`). In the human "kick" strategy, 311 of 353 catch-and-shoot threes were heavy or smothered, and 3P% was 12–23%.
- **Fix.** Show the closeout-adjusted catch value (reuse `catchValue` with the human's expected release), or show a contest-at-catch icon instead of a bare %.

### NBA-17 · Medium · The skill buttons sit on the shooting thumb, and the hint describes a gesture that doesn't exist
- **Evidence.**
  - CROSS / STEP BACK / SPIN are 44 px tall pills above PASS (`play-readout.css:28-29`) and fire on `onClick`, so on pointer up. You can't cross and then shoot in one thumb motion.
  - The hint at 3.8 s says "use skill buttons or **flick the stick** for moves" (`Hoops2.tsx:205`). Flicks are actually read on the full-screen `.hg2-swipe` layer (`Hoops2.tsx:673-749, 824-834`). Flicking the stick just moves the stick.
  - The move direction from a button is the stick's court `cz` sign (`Hoops2.tsx:765`), which is invisible to the player.
- **Fix.**
  - Fire moves on `pointerdown`.
  - Map them to right-thumb swipes from SHOOT (2K mobile style: swipe off the shoot button for a crossover, down for a step-back, a circle for a spin), with the buttons as an optional "simple controls" mode.
  - Fix the hint copy, and show the move direction as an arrow on the button.

### NBA-18 · Low · Stale button state, an oval stick and other details
- **Stale button state.** Skill-button `disabled` is computed at render time (`Hoops2.tsx:762`) and only refreshes on unrelated state changes, so it can look enabled while the ball is in the air. `nba-shots.json` recorded `disabled: true` at tip-off while the screenshot showed them lit.
- **Oval stick.** At 320 wide the stick is 114×128 (flex-shrunk), but `stickAt` uses `width/2` as the radius for both axes (`Hoops2.tsx:606-613`), so vertical sprint is harder to reach. Add `flex: none`.
- **Overlapping boxes.** PASS and SHOOT bounding boxes overlap at every size. Hit-testing respects the border radius, so this is fine, but the gap is tiny.
- **Live pass button.** PASS stays enabled during rebound races, when it does nothing.

---

## 4. How ratings map to outcomes

The full table is in `audit-scripts/nba-curve.json`: make % against release offset 0/10/20/30/40/60/80/120/200 ms, for THR 50–99, four contests and three difficulties.

| Open three, Pro | THR 60 | THR 75 | THR 90 | THR 99 |
|---|---|---|---|---|
| Perfect | 100 | 100 | 100 | 100 |
| 20 ms off | 66 | 96 | 100 | 100 |
| 40 ms off | 27 | 52 | 82 | 95 |
| 80 ms off | 15 | 24 | 36 | 46 |
| Live % shown at the arc | 46 | 65 | 81 | 88 (all open) |
| **Heavy contest, perfect** | 42 | 50 | 57 | 62 |
| **Smothered, perfect** | 17 | 22 | 27 | 30 |

Free throws from FT 40/60/75/85/95: 45/61/74/82/90% (`engine.ts:711-713`).

**Assessment**
- Ratings matter monotonically, and `ratings-matter.test.ts` passes.
- Good timing dominates over rating in the open: a THR-60 shooter at ±10 ms makes 97%, more than a THR-99 shooter at 60 ms (65%). That is the source of NBA-02's inflated percentages for good thumbs.
- Under contests, the rating spread is narrow: 42→62%.
- For "legit" stats, compress the open perfect cap by rating (for example THR 60 → about 60%, 75 → 75%, 99 → 95%), widen the touch fall-off, and make contests the main lever.
- Finishes:
  - A dunk is automatic: 0.78–0.97 by DDK, with contest multipliers.
  - A layup goes through a hidden layup meter. Its 0.42 s top and ±0–70 ms window are invisible, because the meter UI draws only jumpers' context labels.
  - Rim make% is low (56–63%) because of the crowd and spacing multipliers `0.9^(crowd + spacingHelp)` (`engine.ts:628-632`).

---

## 5. AI quality

### Offense (autopilot)
- **Good.**
  - It reads with the engine's own value functions (`shotValue`, `attackValue`, `catchValue`).
  - It drives and kicks, runs a pick and roll 25–60% of trips, lobs to cutters, escapes traps and steps back.
- **Weak.**
  - It has perfect information.
  - It plays hero ball with elite shooters (NBA-03).
  - It has no usage or star logic, no post-ups as a set play, and no tempo by era.
  - It never uses SPIN, CUT or SPACE.
  - Release spread is the only "human" noise: 50–84 ms at Legend to Rookie.
  - Difficulty only scales skill. The Rookie AI still scores 1.17 points a possession because your defense also drops to −0.5 (NBA-19).

### Defense
- **Good.**
  - Man, sag, switch and trap schemes are named on screen (`schemeFor`, `engine.ts:126-141`).
  - Help comes on drives, with rotation to the helper's man (`engine.ts:936-943, 1387-1407`).
  - Closeouts are capped by room, and there's chest contact on straight drives and a planted-screen avoidance path.
- **Weak.**
  - There is no zone, no hedge or drop coverage on screens, and no switch-everything versus switch-1–4 distinction.
  - There are no box-outs. On a miss, every defender runs to the exact landing spot the moment it's decided (`engine.ts:1284`), and the offense's rebounder gets the same assist (`engine.ts:988-989`).
  - Defenders never foul.
  - Reach-in steals are a per-second roll within 2.6 ft (`engine.ts:1350-1357`), so "drive into a man" is punished randomly (NBA-04).

### NBA-19 · Medium · Difficulty changes both defenses at once
- **Evidence.**
  - A single `defenseIQ` is passed to your offense and to the AI rival's offense (`Arcade.tsx:149, 190`; `ut/Match.tsx:666`).
  - Measured: the Legend AI scores 18.6 a game and the Pro AI 20.5. The Rookie AI scores 20.4 (1.27 PPP), almost the same as Pro.
  - The human harness (simple strategies) gets 0.37–0.62 points a possession on Pro for drive, three, elbow and kick. Cross-drive gets about 0.8–0.96 and step-back 1.0–1.2. That last one is an exploit relative to the others.
- **Impact.** A beginner on Rookie loses most games to an AI that plays like a sharp human, while the hardest setting makes the rival score less.
- **Fix.** Split the difficulty into `yourOffenseFacesDefIQ` and `aiOffenseFacesDefIQ`. Scale the AI's skill and release spread more widely (Rookie 0.35 / 110 ms, Legend 0.9 / 45 ms), and validate with the human harness so that Rookie wins about 70%, Pro about 50% and Legend about 30% for a median player.

---

## 6. Camera and HUD

Screenshots: `390-01…12`, `320-*`, `430-*`, `844land-*`.

### NBA-20 · High · The camera fights readability
- **Occluded defender.** The behind-the-shooter view depth-sorts by `cx` (`render.ts:722-756`). The on-ball defender, between the shooter and the rim, is drawn behind your own handler. At the release the meter says SMOTHERED, yet the man is mostly hidden (`390-zoom-meter.png`, `844land-03-meter-rising.png`).
- **Shooter under the buttons.** The camera follows the ball with `focus.y = ball cx` (`render.ts:662-669`). On every shot it pans toward the rim and pushes the shooter into the controls (`390-08-finish-result.png`: the shooter half under PASS).
- **Unreadable piles near the rim.** On drives, rebounds and traps the view zooms in, and 4–8 bodies stack with overlapping name, % and SCREEN labels (`390-05-shot-outcome.png`, `390-10-screen-call.png`, `390-zoom-crossover.png`).
- **Frame-rate-dependent follow.** The lerps (0.05–0.12 per frame) aren't time-based.
- **Fix.**
  - Lift the camera pitch and offset it 10–15° to the side, so on-ball defenders read as separate silhouettes, as Hoop Land's three-quarter view does.
  - Track a blend of handler and ball, with a dead zone, and hold the shooter in frame through the release.
  - Keep a fixed zoom near the rim.
  - Draw a ground ring and arrow for the on-ball defender's position and distance.
  - Make the follow lerps `1 − exp(−k·dt)`.

### NBA-21 · Medium · The HUD covers the play
- **Evidence.**
  - `.hg2-pop` sits at `top: 38%`, 24–40 px tall (`styles.css:8079-8115`). That's where the rim and paint are in portrait. "VERY LATE", "POSTERIZED! +2", "SCREEN & ROLL" and "DOUBLE TEAM!" all covered the play they describe (`390-04`, `390-17-highlight-1`, `390-10`).
  - The canvas labels collide. The badge pop "CLAMPS SILVER" overprinted the meter result "LATE" (`390-04-release-result.png`). The handler's name sits on the defender's face (`390-02`).
  - In portrait the top HUD (bug, marks, look chip, coach strip, hint) uses about 200 px and the controls about 230 px, so the court has about 45% of an 844 px screen.
- **Fix.**
  - Move pops to the top band under the score bug, or anchor them to the scorer with a small offset.
  - Add a label layout pass: a priority queue, with no overlapping label rectangles.
  - Merge the look chip and the hint into one line.
  - Hide the coach strip unless a call is active.

### NBA-22 · Medium · The pixel font can't print many names or labels
- **Evidence.**
  - `F35` (`render.ts:987-991`) has A–Z, 0–9, space, `- . ' ! %` only. "CATCH & SHOOT" prints as "CATCH   SHOOT" (`render.ts:950`) and "PERFECT / HEAVY" as "PERFECT   HEAVY" (`render.ts:953`).
  - 122 distinct non-ASCII player names in `cards-nba.json` print with holes. Jokić → "JOKI ", Dončić → "DON I ", Petrović, Kukoč, Stojaković, Schröder, Marčiulionis and others.
  - Tags are cut to 12 letters (`ratings.ts:45-49`), so ANTETOKOUNMPO becomes ANTETOKOUNMP.
- **Fix.** Fold diacritics to base letters for the pixel font (NFD plus stripping combining marks), add `& / : +` glyphs, and use smart truncation ("ANTETOKOUNMPO" → "G. ANTETOKOUNMPO" or "GIANNIS" via a short-name field).

---

## 7. Animation

### Inventory, measured from the code

| Action | Source | Frames / rate | Notes |
|---|---|---|---|
| Jump shot | CMU mocap `jumpshot` | 43 f, 30 fps (step 1), time-warped so the release hits the meter top | Good. The best animation in the game |
| Layup (and the driving-dunk run-up) | mocap `layup` | 47 f at 15 fps (step 2) | Pinned to the floor |
| Idle / ready | mocap `ready` | 81 f at 10 fps (step 3) | Used for any off-ball player under 2.5 ft/s |
| Jog / run / sprint | mocap | 24 / 20 / 22 f at 15 fps | Rate clamped to 0.65–1.5 of clip speed (`render.ts:143`) |
| Backpedal | mocap | 51 f | Clip ground speed **2.08 ft/s** for a 6'6" man; clamp 0.7–1.6 |
| Defensive shuffle (L/R) | mocap | 28 f | |
| Celebrate, stumble, fall back, slip (ankles), get up | mocap | 73 / 33 / 56 / 61 / 124 f | Good contact reactions |
| Standing dribble | hand-keyed `P.dribble` | 8 phases | A recorded `dribble` clip (35 f) is **unused** |
| Crossover | hand-keyed | 6 phases / 0.35 s | A recorded `crossover` clip (31 f) is **unused** |
| Step-back | **the crossover pose played backwards** (`render.ts:311-314`) | 6 | |
| Spin | hand-keyed | 6 / 0.45 s | |
| Pass (chest, bounce and lob all the same) | hand-keyed | 6 / 0.3 s | |
| Catch | hand-keyed | 5 / 0.25 s | Recorded `catch` and `catch_run` clips are **unused** |
| Contest = block = rebound | one hand-keyed `P.contest` (`render.ts:327-332`) | 10 | A recorded `jump` clip ("dunks from a standstill, rebounds, blocks") is **unused** |
| Dunks: one, two, tomahawk, windmill, 360, contact, rim hang | hand-keyed `P.dunk` | 12 | The 360 rotates the whole sprite |
| Screen | 1 static pose | 1 | |
| Defensive stance | hand-keyed cycle, static under 3 ft/s | 6 | |

**Missing entirely** (against Hoop Land and mobile or console 2K):
- **Moves:** hesitation, behind-the-back, between-the-legs, euro step, floater, fadeaway, hook shot, post-up and back-down, putback, tip-in.
- **Passes and catches:** bounce pass, overhead or lob pass, alley-oop toss, catch in stride.
- **Defense:** box-out, swat block (a distinct strike), loose-ball dive.
- **Game moments:** foul or charge reactions, free-throw routine, inbound, team high-fives, bench reactions.
- **People on the floor:** referees, coaches.
- **Crowd:** animated crowd (the stands are a static noise texture with a colour pulse, `render.ts:863-866`).

### NBA-23 · High · Skating feet on 29% of on-ground frames
- **Evidence.** `nba-anim.test.ts` ran 24 games, about 1.13 M body-frames, using the renderer's branch logic. The main causes:
  - a static defend pose while moving 1–3 ft/s: 10.3% of frames;
  - jog feet faster than the body: 6.6%;
  - shuffle too slow for the clip: 4.1%;
  - backpedal body much faster than the clip (rate capped at 1.6× of 2.08 ft/s): 2.4%;
  - idle clip while drifting: 3.3%;
  - hand-keyed pass, cross or catch poses while the body moves over 3 ft/s: 1.6%.

  The median body speed is 2.4 ft/s, the 75th percentile 9.2 ft/s and the 90th 14.2 ft/s.
- **Fix.**
  - Drive locomotion from speed with continuous blending: idle → walk → jog → run → sprint, by speed with phase-matched cross-fades. Add a walk clip. Remove the dead bands at under 2.5 ft/s and under 3 ft/s.
  - Use the backpedal clip with stride scaling, or a run-backward blend.
  - Use the recorded `crossover`, `dribble`, `jump`, `cut` and `catch` clips in place of the hand-keyed poses.
  - Cap root velocity during hand-keyed moves to what the pose's feet imply, or give the moves foot-plant keys.
  - Render-only, so no protocol bump.

### NBA-24 · Medium · No transitions, velocity snaps and unphysical misses
- **No transitions.** Every act change switches pose instantly. No cross-fade between clips or poses.
- **Velocity snaps.** A crossover sets `vx` and `vz` to a full burst in one step (`engine.ts:769-770`), a step-back likewise (`822-823`). Rising for a jumper multiplies velocity by 0.25 in one frame (`engine.ts:477-480`). Players teleport-turn.
- **Unphysical misses.** Every shot, make or miss, flies to the exact rim centre (`engine.ts:565-576`) and then pops out from there (`1173-1174`, `1414-1432`). Misses look like makes until the bounce. There are no rim-outs, backboard banks or airballs. The backboard sample is never played.
- **Fix.**
  - Add 80–120 ms pose cross-fades in `HoopsRenderer.sprite` (blend joints before `drawBody`).
  - Ramp move velocities over 2–4 steps (bumps the protocol).
  - Give misses an endpoint on the front rim, back rim or glass (deterministic from the same `make` roll), with matching sounds.

### NBA-25 · Low · 15 fps animation
- Most clips are drawn at 15 fps (`step: 2`) and idle at 10 fps. The sprite cache rebuild budget is 4 per frame (`render.ts:659, 472-475`). At pixel scale, 15 fps reads as choppy next to the 60 fps movement.
- **Fix.** Go to 30 fps for the handler and his defender, and keep 15 fps for far players.

---

## 8. Player identity: "so we know who is who"

### NBA-26 · Critical · Everyone looks the same
- **Evidence.**
  - `lookFor` uses `DEFAULT_SKIN` and `DEFAULT_HAIR` for everyone (`render.ts:61-77`).
  - Hair style comes from `hash(id) % 11`, and a beard from a 1-in-4 hash (`pixel/body.ts:592-610`).
  - `sprites.ts:6-7` states "Everyone shares one skin tone".
  - Only height, weight, jersey number and kit vary. In screenshots, ten players are distinguishable only by number. Names show only over the handler.
- **Impact.** The owner explicitly asked for characters that match real life.
- **Fix.**
  - Add an optional, original per-player appearance table, `src/data/nba-looks.json`, keyed by player id: skin tone from a 6–8 step palette, hair style and colour, facial hair, headband, goggles, sleeve, arm or leg sleeves, shoe colour and accessories. Hand-author the top about 300 stars and default the rest by a hash within plausible ranges.
  - Show the defender's and receiver's name on the target marker.
  - Show a 2-second roster intro at tip-off with portraits drawn by the same pixel rig.
  - Avoid licensed likeness art: these are original pixel descriptors.
  - Render-only, so no protocol bump.

---

## 9. Sound and haptics

- **Present.** Real samples: three dribble variants, four squeaks, swish, two rims, dunk, two catches, buzzer, horn, crowd bed, cheer, roar, ooh and groan (`src/assets/sfx`). Crowd swells. Synthesized fallbacks.
- **NBA-27 · Medium · Haptics are a single delayed tick.** On iOS every `vibrate()` pattern collapses to one `iosTick()` switch toggle (`lib/sound.ts:88-145`). A green, a dunk `[25,40,25]` and a block all feel identical. Loop-side events (dunk, block, double team) play on the next touch up to 400 ms later, or are dropped. **Fix:** fire the green and release haptic from the pointer-up handler only, as it already does; drop loop-side haptics on iOS rather than delaying them; and use two ticks about 60 ms apart for big moments while inside a gesture.
- **NBA-28 · Low · The soundscape is thin.**
  - There's no arena PA or announcer, no music, no "DE-FENSE" chant and no countdown beeps (NBA-08).
  - Sneaker squeaks aren't tied to cuts by speed.
  - Rim and backboard variety is limited by NBA-24.
  - **Fix:** add original crowd chants and countdown beeps, and tie squeaks to the plant frames of `cut`, `crossover` and `stepback`.

---

## 10. Performance and loading

- **Frame cost.** A full autoplay game (`nba-perf.cjs`, main-thread time inside rAF callbacks, sim plus draw):

  | Size | 1× p50 / p99 | 4× CPU p50 / p90 / p99 | Frames over 16 ms at 4× |
  |---|---|---|---|
  | 390×844 | 2.2 / 8.9 ms | 9.6 / 15.6 / 29.6 ms | 40 / 450 |
  | 844×390 | 1.9 / 6.8 | 7.6 / 12.4 / 28.5 | 20 / 462 |
  | 430×932 | 2.3 / 9.0 | 10.2 / 16.5 / 36.2 | 49 / 436 |

  rAF interval at 1× is a steady 16.7 ms. At 4×, the p99 is 33 ms and the maximum 117 ms. JS heap is 57 MB.
- **NBA-29 · Low-Medium.** Headroom is good on modern iPhones, but about 9–11% of frames would miss at 4×. The main costs:
  - the floor is rasterised per pixel and uploaded with `putImageData` every frame (`render.ts:506-521`);
  - each frame snapshot clones 10 bodies for replays (`Hoops2.tsx:43-49, 557`);
  - sprite rebuilds happen when poses change.

  **Fix:** cache the floor when the camera hasn't moved more than 0.5 px, and store replay snapshots as typed arrays.
- **Load (dev server, so indicative).** From a warm load, the pad appears at about 1.75 s and the first possession at about 2.3–2.5 s. That includes a fixed **700 ms** tip-off timer (`Hoops2.tsx:204`). A cold dev load took 5.9 s. "Taking the floor…" is plain text on black.
- **NBA-30 · Low · Wasted loading work.**
  - The game blocks on `loadAttrs()` (`nba-attrs`, 1.1 MB, 342 KB gzipped) even in Ultimate Team, where `five` and `rivalFive` are already built (`Hoops2.tsx:119-130`).
  - In the production build (sibling checkout `ps-next-ui/dist`, previous release `4b721f2`), the NBA and NFL arcade engines share one chunk, `Football2-*.js` (174 KB, 66 KB gzipped). Basketball loads football code.
  - 17 mocap clips load as separate chunks after the renderer is created, so the first frames can show hand-keyed poses and then pop.

  **Fix:**
  - Skip `loadAttrs` when `five` is given.
  - Split the hoops chunk.
  - Preload clips during the pre-game screen.
  - Replace the 700 ms blank timer with a 1.5 s "tip-off" intro: line-ups, the defense look, controls reminder.

---

## 11. Every way it can feel unfair or confusing

| # | Moment | Where |
|---|---|---|
| 1 | Shot-clock violation with "8" still on the clock | NBA-08 |
| 2 | Holding the stick at tip-off: the player won't move | NBA-12 |
| 3 | "PERFECT" release that misses | NBA-15 |
| 4 | SMOTHERED rating while the defender is hidden behind your own man | NBA-20 |
| 5 | A teammate shows 60% and is heavily contested by the catch | NBA-16 |
| 6 | Straight drives stripped one time in four on Legend, with no foul ever called | NBA-04, NBA-01 |
| 7 | The rival's score is fixed before you play; your defense doesn't exist | NBA-07 |
| 8 | A tie goes to a rating you never saw | NBA-06 |
| 9 | Legend AI scores less than Pro, and Rookie barely less | NBA-19 |
| 10 | Your handler hidden under buttons on small phones; coach calls out of reach | NBA-13 |
| 11 | Pop banners hide the dunk, block or turnover they announce | NBA-21 |
| 12 | Greens on low-rated shooters or contested shots are sub-frame luck | NBA-14 |
| 13 | A pass leads the receiver by 0.3 s of his current velocity (`engine.ts:687`), so a teammate changing direction gives "PASS OUT OF REACH", a turnover | |
| 14 | SHOOT within 11.5 ft while moving toward the rim always triggers a layup or dunk (`engine.ts:445`), so a pull-up or floater there is impossible | |
| 15 | Hint text describes a stick flick that does nothing | NBA-17 |
| 16 | Names with accents print with gaps | NBA-22 |
| 17 | No pause: a phone call costs possessions | NBA-09 |
| 18 | The game ends on a score and a row of marks: no box score, nothing to learn from | NBA-10 |

---

## 12. What already works well: preserve it

- **The deterministic fixed-step engine.**
  - Seeded RNG, `(p, dt, stick)` stepping and finite above-99 ratings.
  - `juice.test.ts` proves the render-only effects don't change results.
  - Keep this architecture for any defense mode, so online parity holds.
- **Physical outcomes.** Rebound reach races with BOARD timing, catches that never relocate players, alley-oops that need real reach, chest contact with a strength-based bully-through, help and rotation, closeout caps by room.
- **The ratings model.**
  - Continuous release curve, rating-scaled perfect caps, contest grades, tiered 2K26-threshold badges and badge pops.
  - Monotonicity tests: `ratings-matter.test.ts` is green, 15 tests in about 170 s.
  - Keep them as gates when re-tuning.
- **The recorded jump shot.** Its release is time-warped to the meter top, and the `shotTempo` set, catch and pull-up rhythms match. This is the best-feeling piece and the model for the rest.
- **The rebound share.** It's realistic (22–27%).
- **Clear explanation of defensive looks.** The scheme chip with a tip ("TRAPPING · move it early"), the live shot % with a colour code, the meter context label, and the LAST PLAY readout grounded in engine values.
- **Input hygiene.** Pointer capture, `useInputInterrupt`, cancellable held shots and keyboard support for SHOOT and PASS.
- **Robustness.** `rescue()` keeps a broken possession from freezing the game, canvases are freed for iOS's memory cap, and sprites fall back to last frame's when canvas memory runs out.
- **Juice.** Trauma shake, hit-stop, particles, confetti in team colours, the posterizer slow motion and the replay system. Reduced motion is honoured.
- **Landscape and safe areas.** The landscape layout (`844land-*`) is clean, controls sit well, and safe-area insets are applied throughout `.arcade-full`.
- **Performance.** About 2 ms a frame on desktop at 1×, with no React re-render per frame. Keep the HUD-clock fix out of React's per-frame path.

---

## 13. Suggested order, and protocol notes

1. **Quick, render or input only (no protocol bump).**
   - NBA-08: HUD clock and warning.
   - NBA-12: dead stick.
   - NBA-13: layout for 320 to 375 phones and control placement.
   - NBA-21: pop and label placement.
   - NBA-22: font.
   - NBA-17: hint copy and pointerdown.
   - NBA-09: pause.
   - NBA-16: catch-value %.
   - NBA-15: hide green under heavy contests (display only, if "green = make" waits for the bump).
2. **Look and feel (no bump).**
   - NBA-26: appearance table.
   - NBA-23, NBA-24, NBA-25: locomotion blending, the unused clips, cross-fades and 30 fps.
   - NBA-20: camera.
   - NBA-27, NBA-28: haptics and sound.
   - NBA-10: box score.
   - NBA-30: loading.
3. **One gameplay release (bump the NBA draft protocol 10 → 11 and UT NBA 10 → 11, in `src/net/match.ts` and `src/ut/Match.tsx`, and update `net.test.ts`).**
   - NBA-14: event-time release and minimum windows.
   - NBA-01: fouls and free throws.
   - NBA-02: the shot-value curve.
   - NBA-03: usage and tempo.
   - NBA-04: turnover mix.
   - NBA-05: era profiles.
   - NBA-19: split difficulty.
   - Validate with this audit's harness against the NBA column in section 1, plus `ratings-matter.test.ts` and the human harness.
4. **The format (bigger; bump again).**
   - NBA-07: alternating possessions with a controllable defender and switching.
   - NBA-06: quarters, game clock and OT.
   - Keep the online parallel format until shared real-time defense is designed.

None of this needs a save, key, card ID or UID change. Box-score and appearance data are additive.

---

## Appendix: artefacts

**Scripts:** `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/`
- vitest: `nba-box`, `nba-curve`, `nba-anim`, `nba-conc` (`.test.ts`, with JSON outputs)
- Playwright: `nba-shots`, `nba-deadstick`, `nba-clock`, `nba-perf`, `nba-final`, `nba-se` (`.cjs`)
- logs: `human-def0.log`, `human-def1.log`, `hoops-tests.log`

**Screenshots:** `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nba/`
- `{390,430,320,844land}-01…12-*.png`
- `375x667-01-tipoff.png`
- `390-13`…`390-18-*.png`
- `390-zoom-*.png`
