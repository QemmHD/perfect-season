# NFL arcade engine and controls: production audit

Area: `src/game/football2` (engine, drive, autopilot, render, Football2 UI, playbook, CSS), plus the shared `pixel/*` mocap and poses, `juice.ts`, `PlayReadout`/`play-feedback.ts`, `difficulty.ts` and the NFL paths in `Arcade.tsx` and `ut/Match.tsx`/`ut/play.ts`.
Baseline: branch `claude/studio-overhaul` = main `acdf3e2`. `PS_SPORT=nfl vitest run src/game/football2`: 65 passed, 2 opt-in skipped. No tracked files were changed.
Auditor: Claude (Anthropic), 2026-11-09. Read-only audit.

## How this was measured

- **Seeded simulations.** `audit-scripts/nfl_sim.ts` ran 120 games per case (480 drives) through the real `drive.ts`/`engine.ts`/`autopilot.ts` loop. That is 2,160 games and about 13,000 plays in all. Results are in `audit-scripts/nfl_sim_out.json` and `nfl_table.cjs` prints them as tables.
  - **Fixtures.** Real UT squads built the way `scripts/audit_nfl_rushing.ts` builds them: per slot, the 60th-percentile card for silver and gold, and the 97th-percentile gold card for "elite". Each squad's offense faces the same tier's defense.
  - **AI cases.** These use the shipped AI pairs: skill 0.45/0.68/0.88 with `defIQ` −0.5/0/1 (Rookie/Pro/Legend).
  - **"Human proxy" cases.** These follow the repo's `human.test.ts` model: skill 0.35, and a read and throw that come 1.5–2.9 s after the snap.
  - **"Stick" cases.** These feed real human-style vector input (`RunInput` as a `Pt`). The proxy holds the stick toward its lane, but only after a reaction delay of 0, 0.35 or 0.7 s each time a new ball carrier gets the ball. A final case never touches the stick.
- **Structural probe.** `audit-scripts/nfl_zside.ts` traced 1,500 pass plays: normal, flipped, with the WR cards swapped and with the CB cards swapped.
- **Browser runs.** Vite on port 5202, `?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted by Playwright.
  - **Screenshots.** `audit-scripts/nfl_shots.cjs` captured 390×844 and 430×932 (iPhone safe areas emulated: top 59, bottom 34), 320×568 and 844×390 landscape, all `isMobile`, `hasTouch`, DPR 3. They are in `audit-shots/nfl/`.
  - **Catch-and-stop probe.** `audit-scripts/nfl_catchstop.cjs` hooks the real renderer and reads the ball carrier's velocity after a catch in the live component.
  - **Frame pacing.** `audit-scripts/nfl_perf.cjs` measured the autopilot lab for 15 s, at 1× and 4× CPU throttle.
- **NFL reference rates.** These are approximate public league averages for 2023–24 (Pro-Football-Reference season pages and NFL Next Gen Stats; repo docs quote the same sources):
  - Passing: completion 65%, Y/A ≈ 7.0, Y/C ≈ 10.8, INT 2.2%, sacks ≈ 6.8% of dropbacks, time to throw ≈ 2.8 s, YAC ≈ 5.2 per catch, 20+ yd completions ≈ 8–9% of attempts.
  - Rushing: ≈ 4.4 yards per carry, median ≈ 3, runs for zero or less ≈ 18%, 10+ yd runs ≈ 11%, 20+ yd runs ≈ 2%.
  - Drives: ≈ 2.1 points per drive, TD on ≈ 23% of drives, turnovers on ≈ 11%, ≈ 6 plays per drive.
  - Situational: passes ≈ 58% of plays, 3rd-down conversions ≈ 39%, FG% ≈ 84.

Treat these as targets for shape, not exact pins: this game is a four-drive arcade format.

---

## Top findings (summary)

| # | Sev | Finding |
|---|---|---|
| 1 | **Critical** | A ball carrier stops dead after a handoff or catch unless the stick is already held. With a 0.35 s reaction, yards per carry fall from 3.9 to 1.2, YAC from 5.7 to 2.0 and points per game from 13.9 to 9.1. In the live component, 5 of 5 catches made without the stick braked to 0 within 0.25 s and lost yards. |
| 2 | **Critical** | The play-call panel hides your own formation: QB/RB at 390 and 430, all 11 players and the line of scrimmage at 320. In landscape the passing panel covers the RB and slot. |
| 3 | High | Difficulty is symmetric and the AI is superhuman in the pocket. Its time to throw is 1.4–1.6 s and it is sacked 0.1–0.3% of the time on Legend, against 26.6% for the human proxy. On Rookie the human proxy wins only 47.5%, because Rookie also weakens your defense. |
| 4 | High | Elite-vs-elite and online (Legend defense) games collapse to 4.9 points a game, 51% completions, 6.9% INT and 31% turnover drives. One game in five is tied and then decided by squad rating. |
| 5 | High | The run game has no tails. Runs for zero or less are 7–12% (NFL ≈ 18%) and 10+ yd runs 0–3% (≈ 11%). The 99th-percentile run is under 10 yards for even Pro/Legend teams, and Inside, Outside and Power all average 3.5–4.0. |
| 6 | High | Deep balls are too reliable for a human. The proxy gains 20+ yards on 19–20% of attempts (NFL ≈ 8–9%) and completes 57–62% of deep throws (NFL ≈ 35–40%). Half or more of its TDs come from 20+ yards. |
| 7 | High | The Z receiver (UT WR2 slot) gets about 5% of targets in AI play (85 of 1,500 throws). Flipping the formation or swapping cards doesn't change it, so it's structural: that card is decoration in sims, AI drives and takeovers. |
| 8 | High | The QB can't move in the pocket. The only escape is an irreversible RUN IT, there is no throwaway or slide, and sacks have no animation. |
| 9 | High | The defense is two coverages (Cover 1 / Cover 3) behind a 4-man rush, every down, with no blitzes or situational calls. Offense is one formation, 8 pass concepts and 3 runs, with no play action, screens, draws, sneaks, audibles or hot routes. |
| 10 | High | Animations: juke, spin, stiff arm and truck use hand-keyed poses (the juke is the basketball crossover pose) although mocap `cut`/`stiff_arm` exist. The QB skates back in an idle clip, sacks have no fall, `getup` is unused, there is no handoff exchange, pile or returns, and the ball vanishes on incompletions. |
| 11 | High | Head-to-head and UT matches have no pause, quit or settings. Ties go to squad rating (no overtime or two-point try), and the user never sees or influences the opponent's drives. |
| 12 | High | Identity: all 22 players share one skin tone and no hair or gear. Draft fill-ins are labelled "WR 81" and "OT 72", so you can't tell who is who. |

---

## 1. Measured realism: simulated stats vs the NFL

Selected rows; the full table is in `nfl_table.cjs` output. "gold" means 60th-percentile gold UT cards on both sides. "elite" means 97th-percentile gold on both sides.

| Case | pts/g (4 dr) | pts/drive | TD % of drives | TO % of drives | cmp% | Y/A | Y/C | INT% | sack% | YAC | 20+ yd % of att | YPC | run median | ≤0 % | 10+ % | 20+ % | 3rd % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **NFL ref** | ~8.4 | 2.1 | 23 | 11 | 65 | 7.0 | 10.8 | 2.2 | 6.8 | 5.2 | 8–9 | 4.4 | ~3 | ~18 | ~11 | ~2 | 39 |
| AI Pro, silver | 10.9 | 2.71 | 31 | 16 | 66.4 | 7.65 | 11.5 | 3.0 | 3.5 | 3.2 | 5.0 | 3.38 | 3.0 | 8 | 0 | 0.0 | 40 |
| AI Pro, gold | 15.0 | 3.75 | 44 | 14 | 70.1 | 10.0 | 14.3 | 2.7 | 2.7 | 4.2 | 8.5 | 3.76 | 3.1 | 10 | 1 | 0.3 | 49 |
| AI Pro, elite | 7.5 | 1.88 | 18 | 27 | 61.7 | 6.37 | 10.3 | **5.8** | 2.7 | 2.1 | 2.9 | 3.05 | 2.7 | 9 | 0 | 0.3 | 39 |
| AI Legend, gold | 11.9 | 2.96 | 31 | 19 | 61.5 | 7.7 | 12.5 | 3.4 | **0.1** | 2.6 | 5.2 | 3.49 | 2.8 | 9 | 1 | 0.6 | 43 |
| AI Legend, elite | **4.9** | **1.22** | **8** | **31** | **51.0** | 5.24 | 10.3 | **6.9** | 0.3 | 1.4 | 1.7 | 2.68 | 2.5 | 10 | 0 | 0.4 | 27 |
| Human proxy, Rookie, gold | 16.1 | 4.03 | 52 | 10 | 67.7 | **13.1** | **19.3** | 2.2 | 10.8 | 5.5 | **19.9** | 4.37 | 3.2 | 12 | 2 | 1.2 | 45 |
| Human proxy, Pro, gold | 14.0 | 3.49 | 43 | 8 | 66.6 | **11.8** | **17.7** | 1.7 | 12.3 | 4.2 | **19.0** | 4.01 | 3.0 | 10 | 2 | 1.2 | 40 |
| Human proxy, Legend, gold | 8.3 | 2.08 | 23 | 9 | 63.1 | 11.3 | 17.8 | 2.0 | **26.6** | 3.9 | 18.5 | 3.36 | 2.8 | 8 | 1 | 0.3 | 27 |
| Human proxy, Pro, stick +0.35 s | **9.1** | 2.29 | 24 | 11 | 67.4 | 10.4 | 15.5 | 2.4 | 13.2 | **2.0** | 16.6 | **1.17** | **0.9** | 15 | 0 | 0.4 | 29 |
| Human proxy, Pro, stick +0.7 s | 6.8 | 1.71 | 18 | 11 | 65.4 | 9.9 | 15.1 | 2.4 | 13.1 | 1.2 | 16.7 | **−0.35** | −0.6 | **61** | 0 | 0.1 | 26 |
| Human proxy, Pro, never touches stick | 4.6 | 1.15 | 9 | 9 | 66.5 | 9.0 | 13.5 | 1.9 | 13.4 | −0.1 | 14.9 | **−3.69** | −4.0 | **100** | 0 | 0 | 19 |

More measurements:

- **Run percentiles, AI Pro gold.** P10/P25/P50/P75/P90/P99 = 1.0/2.0/3.1/5.6/7.3/9.7 yards. Elite: 0.5/1.8/2.7/4.1/5.9/7.9. Legend gold: 1/1.9/2.8/4.9/6.3/8.2.
- **By run play, AI Pro gold.** Inside 3.55, Outside 3.74, Power 4.00 yards per carry.
- **Target share (catches), AI Pro gold.** X 17%, slot 28%, TE 24%, RB 25%, Z 6%. Across every case Z gets 3.5–7.5% and the RB 20–44% (NFL backs get roughly 15–18%).
- **Pass share.** 66–69% of plays (NFL ≈ 58%). The AI passes 70% of the time, 45% on short yardage (`autopilot.ts:31-34`).
- **Deep throws** (20+ yd aim): AI Pro gold 55% complete, human proxy 57–62%, NFL ≈ 35–40%.
- **TD length, human proxy.** Median 24 yards on Pro and 42 on Legend; 54–64% of its TDs come from 20+ yards.
- **Broken tackles and whiffed dives.** Broken tackles run 0.14–0.38 per carry and whiffs 0.03–0.20 per play. That is a lot of contact drama, yet runs stay short because pursuit swarms (see §4).
- **Drive endings.** No case ever punts (by design). "DOWNS" ends 12–55% of drives against an NFL figure of about 3–4%.
- **Field goals.** The AI makes 65–85%. 50+ yard kicks are 26–40% of all attempts (NFL about 20%).
- **Two-minute drill (last drive).** 5–6 plays; the clock runs out on 2–16% of them.
- **Ties against an identical side.** 10–13% for gold, **20% for Legend elite**. Win/tie/loss from the score distributions:

| Matchup | Win | Tie | Loss |
|---|---|---|---|
| Human proxy vs AI, Rookie | 47.5% | 11.6% | 40.9% |
| Human proxy vs AI, Pro | 41.2% | 9.9% | 48.9% |
| Human proxy vs AI, Legend | 29.9% | 9.4% | 60.7% |
| Human proxy, Pro, stick +0.35 s, vs AI | 20.9% | 8.6% | 70.5% |

Takeaway: for even gold teams, completion percentage, 3rd-down rate, plays per drive and the flag rate sit in a believable band. Everything else is off:

- Scoring runs about 70% above NFL and swings to well under it at the top tier.
- The run game has no explosive plays.
- Human deep passing is far too explosive.
- Sacks and pressure are asymmetric between the human and the AI.
- The share of a team's targets each receiver gets is unrealistic.

---

## 2. Controls

### C-1. The ball carrier brakes to a stop after a catch or handoff unless the stick is already held (Critical)

**Evidence**
- `engine.ts:785-797`: a manual vector of magnitude 0 means `braking`, at 26–38 yd/s².
- `Football2.tsx:649-655` (`steerNow`) always sends a vector, `{0,0}` when untouched.
- The stick only appears once the play is live (`steering`, `Football2.tsx:903`). During a pass's drop the user's thumbs are on the slingshot or the PASS TO buttons.
- Live component (`nfl_catchstop.cjs`, 6 seeds, tap RB and never touch the stick): 5 catches at 2.6–5.2 yd/s, speed **0.00 by +0.25 s** on all five. Yards after catch +0.1; play results −0.8, −2.4, −2.3, −2.3, −4.3. Screenshot: `audit-shots/nfl/390-40-catch-nostick.png`.
- Simulation (same pilot, only the stick timing differs):

| Stick timing | Yards per carry | YAC | Points per game |
|---|---|---|---|
| Held at once | 3.9 | 5.7 | 13.9 |
| +0.35 s | 1.2 | 2.0 | 9.1 |
| +0.7 s | −0.35 (61% stuffed) | 1.2 | 6.8 |
| Never | −3.7 | ≈0 | 4.6 |

**Player impact.** Typical mobile reaction is 0.25–0.45 s, plus a thumb travelling from the PASS TO panel to the stick. Most catches will feel like the receiver "gives up". `CORE-GAMEPLAY.md` promises in-stride catches that keep 96% of the receiver's momentum, and the momentum is erased within a few frames. Runs from a late thumb lose yards.

**Fix direction**
- **Momentum carry.** On a carrier change (handoff, catch, scramble), keep the current momentum and follow the designed lane (the numeric/`null` path the AI uses) until the first stick touch of that carry. Only a stick touched and then released should brake, if braking on release is kept at all.
- **Pre-hold.** Alternatively, accept a stick that was already held from the throw onward, and show a pulsing "HOLD TO RUN" ghost on the stick during the ball's flight.
- **Constraints.** Keep the owner-requested direct control: never convert a touched centred stick to `null`, per CLAUDE.md. This changes NFL physics for humans, so bump draft NFL 10→11 and UT NFL 11→12.

### C-2. The QB has no pocket control, no throwaway and no slide (High)

**Evidence**
- `engine.ts:858-861`: during a pass the QB is steered to a fixed spot at `los-6.5`. Field drags are taken by the slingshot (`Football2.tsx:796-797`). The only escape is `scramble()`, which ends all throwing (`engine.ts:622-632`).
- Sacks come at about 3.0 s (`WIN_AT = 3.05`, `engine.ts:435`). The measured average time to sack is 2.8–3.3 s, short of the NFL's 4+ s.
- Human-proxy sack rates are 10.8%, 12.3% and 26.6% on Rookie, Pro and Legend.

**Player impact.** Pressure can only be beaten by throwing early. Mobile football players expect to step up, roll out, throw on the run or throw it away.

**Fix direction**
- Let the stick (or a short drag from the QB) move the QB in the pocket, with the existing `movement` error term (`engine.ts:501`) and lower `sight`.
- Add a THROW AWAY gesture: a swipe to the sideline, legal outside the tackle box.
- Let the scrambling QB throw until he crosses the line of scrimmage.
- Stretch pressure into a felt arc: `winAt` about 2.6–3.4 s for a pressure ring, sacks around 3.8–4.5 s.
- Bump the NFL protocol.

### C-3. The passing UI asks too much in a 2–3 s window (Medium)

**Evidence**
- `Football2.tsx:1074-1128` and `audit-shots/nfl/390-03-dropback.png` show the panel after the snap:
  - five slot buttons labelled X, SL, Z, TE, RB;
  - three trajectory buttons, BULLET, TOUCH and LOB;
  - RUN IT on the right;
  - plus the field slingshot.
- The trajectory is chosen live, and defaults to TOUCH.
- Landing ring and target name show only when `sight(p,len) >= 1` (`render.ts:863-884`). A weaker QB's arc fades out with no target feedback (`390-04-aim.png`).
- Nothing marks where the ball lands while it is in the air (`390-05-air.png`; the ball is about 2–3 css px).

**Player impact.** Players read jargon slot codes instead of the players on the field. Trajectory is a second decision under pressure, and on weaker QBs aiming is blind.

**Fix direction**
- Madden Mobile-style receiver icons drawn over each receiver's head on the field, in the route colours: tap = touch, hold = lob, double tap = bullet.
- Or pick the trajectory before the snap and keep the panel as an optional "pro" layout.
- Always show a faint landing reticle while the ball is in the air.
- Keep the `sight` mechanic for the arc, but show the receiver's name chip regardless.

### C-4. Moves: no chosen direction, no dive, slide or protect, and stamina resets every play (Medium)

**Evidence**
- `moveWithBall(p, kind)` uses `dir || away` (`engine.ts:616`), so a juke always goes away from the nearest defender (`Football2.tsx:787` passes no direction).
- No dive-for-yards, slide, hurdle or cover-up exists in `Move`.
- `stamina` starts at 1 every play (`engine.ts:293`).

**Player impact.** Moves feel random rather than authored. There is no way to protect the ball or finish forward.

**Fix direction**
- Take the juke direction from the stick's lateral component or a swipe on the JUKE button.
- Add DIVE (forward fall for yards) and SLIDE for a scrambling QB.
- Optionally carry a per-drive fatigue value for the RB.
- Bump the protocol.

### C-5. Kicking: an easy, uniform meter with dominated choices (Medium)

**Evidence: the meter**
- The meter's needle is a fixed 1.1 s ping-pong. The window is `max(0.12, 0.36 + 0.3·acc − 0.014·(d−20))` (`drive.ts:169-174`). In milliseconds:

| Kick | KAC 55 | KAC 70 | KAC 85 | KAC 95 |
|---|---|---|---|---|
| 30 yd | 326 | 410 | 494 | 550 |
| 45 yd | 132 | 179 | 263 | 319 |
| 50 yd | 132 | 132 | 186 | 242 |
| 55 yd | 132 | 132 | 132 | 165 |
| 60 yd | 132 | 132 | 132 | 132 |

  The window floors at 132 ms, so a KAC 55 and a KAC 95 kicker are identical from 55+ yards. Range is a hard cut at 46–60 yards; beyond it there is no button.
- There is no power or wind, no snap or hold, no block attempt, and the defense stands frozen during the kick (`390-31-kick-meter.png`, `390-32-kick-flight.png`).

**Evidence: the rest of the kicking game**
- There is no extra-point decision: a touchdown is always worth 7 (`drive.ts:15`).
- `punt()` (`drive.ts:344`) is worth exactly as much as a turnover on downs in this format; `autopilot.ts:43-48` says so. Even so, the UI offers PUNT on every 4th down (`390-12-fourth.png`), and it is never correct.

**Fix direction**
- Two-step meter: power, then accuracy, with the window scaled by distance and KAC without the shared floor, plus light wind.
- Animated snap and hold, and a rushing unit with a rare block from FG-block ability or BSH.
- After a TD, offer XP (a short meter) or a 2-point try (one play from the 2). This also cuts ties (see G-3).
- Either remove PUNT, or give it value: field position for the next drive, or a "pin" bonus.
- Protocol bump for scoring changes.

### C-6. Joystick and buttons: sizes are fine, the layout is crowded (Low)

**Evidence.** Measured boxes at 390: stick 120 px, BURST 68, JUKE/SPIN 74, POWER 86. At 320: stick 108, BURST 62, moves 58/68. Every target is at least 44 px and nothing overlaps in run mode.

**Issue.** In landscape the three move buttons sit in one row (567–771 px) close to the right thumb's resting arc.

**Fix direction.** Keep the sizes. Consider an arc layout for landscape.

---

## 3. Playcalling UI and playbook

### P-1. The play-call panel hides the formation and the backfield (Critical)

**Evidence** (measured panel top against the line of scrimmage):

| Viewport | Panel top | Line of scrimmage | What is hidden | Screenshot |
|---|---|---|---|---|
| 390×844 | y=562 | y≈523 | QB, RB, RB route | `390-01-playcall.png` |
| 430×932 | y=641 | — | QB; RB label peeks out | `430-01-playcall.png` |
| 320×568 | y=320 | — | All 11 offensive players and the line | `320-01-playcall.png` |
| 844×390 | — | — | PASS TO panel covers RB and slot | `844L-03-dropback.png` |

- The 4th-down panel is taller still (`390-12-fourth.png`).
- On run plays no lane or hole is drawn on the field before the snap: `routes` is only for pass plays (`Football2.tsx:759`). The run's path exists only on the small card art.

**Player impact.** You pick plays without seeing your formation, the defense's alignment (press or off corners, safety depth) or the run's hole. On iPhone SE the field is effectively blind before the snap.

**Fix direction**
- A compact horizontal tray of about 110–130 px: play cards as a swipeable strip, with SNAP as a large button.
- Move the pre-snap camera row from 0.68 (`render.ts:392`) to about 0.45 so the line of scrimmage sits mid-screen.
- Draw the run's hole arrow and the blocking lanes on the field for run calls.
- In landscape, dock the panel on the right side only.
- Collapse the tray while the user drags on the field to look around.

### P-2. A shallow playbook with random suggestions (High)

**Evidence**
- `CONCEPT_ROUTES` (`engine.ts:154-163`) has 8 concepts and `RUN_NAMES` 3 runs, all from one shotgun 11-personnel set (`lineUp`, `engine.ts:216-225`).
- The three offered cards are two random passes plus the down's random run (`drive.ts:126-136`); nothing reflects down and distance.
- The playbook dialog shows 11 identical-formation cards with no descriptions (`390-02-playbook.png`).

**Player impact.** Calling plays is shallow, with no strategy layer or "beat this coverage" learning.

**Fix direction**
- Formations: Gun Trips, Bunch, Singleback, I-Form, Goal Line, Empty.
- Concepts: play action (fakes the handoff and holds the linebackers through their read window), RB and WR screens, draw, QB sneak, toss/sweep, counter, a Hail Mary, and spike/kneel in the two-minute drill.
- Situational suggested plays: 3rd & short, red zone, two-minute.
- A one-line "beats Cover 3 / man" note on each card.
- Hot routes, at minimum one tap on a receiver before the snap to swap to a go/slant/out.
- Protocol bump.

### P-3. The playbook dialog overflows the viewport (Medium)

**Evidence.** `.fb2-playbook` measures x=−5 with width viewport + 10 at 320, 390 and 430 (`shots-log.json`). Both side borders are clipped (`390-02-playbook.png`).

**Fix direction.** Constrain with `width: min(620px, calc(100vw - 24px - sal - sar))`, and audit the `.fb2-card` min-content in the 3-column grid.

### P-4. Feedback copy contradicts the UI (Medium)

**Evidence**
- `play-feedback.ts:105` says "use SCRAMBLE", but the button reads RUN IT.
- `:113` says "move out of the pocket", which the game doesn't allow.
- `:111` says "Follow the highlighted run lane", but no lane is highlighted.
- `Arcade.tsx:390` says "from your own 25", but `startSpot` varies from 10 to 52.
- `Arcade.tsx:407` says "Run: drag to steer"; there is now a fixed joystick and BURST.
- Hints run on a 4.2 s timer (`Football2.tsx:219-224`) and carry into the next play-call screen. `390-40-catch-nostick.png` shows "Joystick to run…" over the play cards.

**Fix direction**
- Rewrite the copy to match the controls.
- Clear the hint when the phase changes.
- Rebuild the kickoff "how to play" rows for: receiver tap or drag, BULLET/TOUCH/LOB, stick + BURST, JUKE/SPIN/POWER.

---

## 4. Passing, catching, run game, blocking, tackles

### G-1. The run game has no explosive plays (High)

**Evidence**
- In every AI case, runs for zero or less are 7–12% and 10+ yd runs 0–3%. The run P90 is 5.1–8.1 yards and the P99 7.0–9.7 for even matchups.
- Inside, Outside and Power average 3.55, 3.74 and 4.00 (AI Pro gold).
- Even so, broken tackles run 0.14–0.38 per carry.
- Causes:
  - pursuit's closing burst (`engine.ts:1020`) plus the bounded intercept (`pursuitTarget`, `engine.ts:572-593`);
  - linebackers reach the hole once their read window ends (`engine.ts:340-343`);
  - the secondary drops its pass read 0.5–0.85 s after the snap (`:345`);
  - blocks release at a fixed hold (`engine.ts:884`).

  Result: every run meets a wall of 3–5 defenders around 3 yards.

**Player impact.** Runs feel samey and grindy, with no home-run threat. A 95-speed back is barely distinguishable from an average one in AI play. That contradicts "ratings matter"; check `ratings-matter.test.ts` against tail metrics, not only means.

**Fix direction**
- Shape the run distribution to the NFL: about 18% for zero or less, 11% at 10+, 2% at 20+.
- Second-level variance:
  - linebacker overfills or misfits;
  - safety angle errors scaled by PUR and SPD;
  - real cutback lanes when the backside end chases;
  - pursuit that can't recover after a broken tackle in space.
- Distinct run identities: Power pulls the guard, Outside stretches and cuts back, Inside double-teams.
- Add `rushing.test.ts` checks on percentiles.
- Protocol bump.

### G-2. Deep passing too reliable, YAC too low under pressure (High)

**Evidence**
- Human proxy: Y/A 11.3–13.1, Y/C 17.7–19.3, 20+ yards on 18.5–19.9% of attempts, deep completions 57–62%.
- AI Pro gold deep completions 55%.
- Causes:
  - the FS deep zone is a single landmark (`engine.ts:247/257`);
  - Cover 3's deep defenders read late ("break on the ball" at 0.20–0.40 s, `engine.ts:551`);
  - the contested-catch formula gives a high base when the receiver arrives first (`engine.ts:1311-1314`).
- YAC is 1.4–2.6 on Legend and 4.2 on Pro gold, against NFL ≈ 5.2. Tackles land almost on the catch.

**Fix direction**
- Over-the-top leverage for deep thirds and the FS (stay deeper than the deepest receiver until the throw).
- Faster safety breaks on lobs, and a stronger penalty on lob contests from trailing defenders.
- Scale YAC with CB/S tackling range and "catch in stride" separation rather than pursuit speed alone.
- Targets: deep completions 35–45% and 20+ yd completions about 10% for a skilled human.

### G-3. Target distribution is structurally lopsided (High)

**Evidence**
- `nfl_zside.ts`: Z gets 85 of 1,500 targets (5.7%) against X 362, RB 421, slot 311 and TE 282.
- Flipped formation: 86. WR cards swapped between X and Z: 123. CB cards swapped: 82. So the cause is the concepts and coverage geometry, not ratings.
- By concept, Z is the target only on Mesh (53 of 180). On Verts Z draws 4 targets against X's 78, although both run `go`.
- Across the main sim, Z's share of catches is 3.5–7.5% in every case, and the RB's 20–44%.

**Player impact.** In UT the WR2 slot is weighted 1.0 in squad rating (`ut/squad.ts:43`) yet does nothing in sims, AI drives, takeovers or Club Season. That undermines card value and "ratings matter".

**Fix direction**
- Investigate the pilot's `open` metric on the TE/strong side (SLB zone at `bx+9`, `engine.ts:249`) and the read order.
- Give Z primary reads in Smash, Flood and Dagger variants.
- Add a regression test: each WR slot's target share should fall in roughly 12–30%.

### G-4. INTs and turnovers explode at the top tier (High)

**Evidence**
- Elite vs elite: INT 5.8% (Pro) and 6.9% (Legend), turnovers on 27–31% of drives, completions 51–62%.
- Lane interceptions are 10–19% of all INTs in the higher tiers.
- 97th-percentile defenders (MCV/ZCV/PRC in the 90s) beat 97th-percentile offenses. `routeWinChance` caps at 0.9/0.1, coverage reaction lag scales by both PRC and MCV, the lane-play chance by PRC/ZCV, and Ballhawk compounds all of these.

**Player impact.** Online play (Legend defense, `difficulty.ts:4`) with maxed squads becomes a 0–10 point grind, and one game in five is tied.

**Fix direction**
- Balance the offense-vs-defense curves at the top end. A test could hold 97th vs 97th within about 15% of 60th vs 60th in points per drive.
- Cap lane-INT probability, and make Ballhawk additive rather than multiplicative.
- Check `GAMEPLAY-RATINGS.md`'s 99-vs-90 numbers against real elite squads.

### G-5. Tackles end the play on first contact (Medium)

**Evidence.** `tackle()` (`engine.ts:1131-1217`) ends the play on a successful tackle roll. There is no wrap-up, no carry-forward, no gang tackle, no stand-up and no pile push. A big hit drives the runner back; otherwise his velocity is ×0.3.

**Player impact.** Runs end abruptly and power backs can't fall forward for extra yards.

**Fix direction**
- A short "contact" state of about 0.3–0.6 s in which STR, TRK and weight against TAK and HIT decide forward progress. Help defenders join, and the tackle resolves to a spot.
- Use the mocap `fall_forward` clip for fall-forward yards.
- Protocol bump.

### G-6. No returns, and the rules shortcut real football (Medium)

**Evidence**
- An interception or fumble simply ends the drive: no return and no defensive score.
- A safety ends the drive with 0 points to the opponent (`drive.ts:310-314`).
- Kickoffs are a seeded number (`startSpot`, `drive.ts:82-92`).
- The AI never punts and goes for it on every 4th down outside range. DOWNS ends 12–55% of drives against an NFL figure of about 3–4%.

**Fix direction**
- A brief scripted return animation for INTs and fumbles, with a chance of a defensive TD that subtracts from the drive.
- A 15 s kickoff-return mini-play as an option (BURST plus steering) seeded from `startSpot`.
- Award safeties to the opponent via the `ends` wire. That needs a protocol and wire change, so treat it as a later item.

---

## 5. Defense, AI drives, difficulty and fairness

### D-1. The AI defense is static and predictable (High)

**Evidence** (`engine.ts:227-259`)
- 60% Cover 1 man, 40% Cover 3 zone, chosen by the play RNG regardless of situation.
- Always four rushers, with the MLB as RB spy. The front never moves before the snap.
- No blitzes, no Cover 2 or Cover 4, no Cover 0, no nickel or dime, no goal-line or prevent calls, no disguise or post-snap rotation.
- Blown coverages exist (a 2.5–7.5% bust).

**Player impact.** After a few games the defense is solved and there is no pre-snap read to master.

**Fix direction**
- A defensive call table keyed to down, distance, field zone and difficulty: Cover 2, Tampa 2, Cover 4, Cover 0 and 1-robber blitzes, zone blitz, sim pressure.
- Show the disguise before the snap and rotate after it.
- Higher difficulty should mean better calls, not just a `defIQ` reaction boost.
- Protocol bump.

### D-2. You never play defense; the opponent's drives are invisible (High)

**Evidence**
- AI drives are computed instantly by `aiDrivesOf` (`Football2.tsx:1338-1342`; `Arcade.tsx:189-195`). The rival's score just steps up after each of your drives (`Arcade.tsx:250-252`). Online, the rival's phone plays its own drives.
- The defense's assignments, your defensive cards and the AI's plays are never shown. Your 11 defensive cards only matter through the hidden simulation.

**Player impact.** Half of football, and half of a UT squad, is never felt. There is no dramatic "get a stop" moment.

**Fix direction**
- Cheapest: a "Defensive call" card before each AI drive (choose Base, Blitz or Prevent and a coverage), deterministic in both clients. Then a 15–20 s condensed drive recap: a drive chart, key plays rendered as replays from a seeded re-simulation, and your defenders' names on tackles and INTs.
- Fuller: an optional controllable defender (user-controlled safety or LB: switch player, tackle button, swat/pick button) for offline modes.
- Either way, bump the protocol if the rules change.

### D-3. Difficulty is symmetric; the AI QB is superhuman and Rookie isn't easy (High)

**Evidence**
- The same `defenseIQ` applies to the rival's defense and to your defense when the AI drives (`Arcade.tsx:149,189,195`; `ut/Match.tsx:665-666`; UT battles `def` in `ut/battles.ts:36-41`).
- The AI pilot's read time is 0.5–1.6 s (`autopilot.ts:80`). Its measured time to throw is 1.39–1.64 s against the NFL's ≈ 2.8 s, and its sack rate on Legend is 0.1–0.3%.
- The human proxy's time to throw is 2.24–2.27 s, with sack rates of 10.8%, 12.3% and 26.6% on Rookie, Pro and Legend.
- Human-proxy win rates against the AI with the same squads are 47.5%, 41.2% and 29.9% on Rookie, Pro and Legend, and 20.9% on Pro once the realistic 0.35 s stick delay is included.

**Player impact.** Rookie isn't a learning difficulty, because your own defense is loosened (−0.5) while the AI attacks it. The AI on any level reads and throws faster than a person can.

**Fix direction**
- Decouple the two: the user's defense should be neutral or helped on Rookie, and difficulty should mainly scale the AI offense's read time (floor about 2.2–2.6 s), accuracy, mistakes and play calling.
- Calibrate targets with the human proxy plus stick delay. Suggested: Rookie ≥ 70% wins, Pro about 50%, Legend about 30–35% for an even squad.
- Online keeps `COMPETITIVE_DEFENSE` symmetric (fair).
- Bump the protocol for AI changes that affect takeovers.

### D-4. Ties are frequent and decided off the field (High)

**Evidence**
- `ut/play.ts:67-80` gives a tie to the better squad (unrounded overall), otherwise a coin flip.
- Measured tie odds with even sides: 10–13% (gold), 20% (Legend elite).
- Scores cluster on 0/3/7/10/14/17 because a TD is a fixed 7 and there is no 2-point try.

**Player impact.** One game in eight to one game in five is decided by a number the player didn't play.

**Fix direction**
- Overtime: one more drive each from the 25, deterministic seeds. Or a two-point shootout (alternating 2-point plays, both phones agree from the seed).
- Plus a TD conversion choice (C-5).
- Protocol bump and wire handling for the extra drive ends.

### D-5. No pause, quit or settings in H2H and UT matches (High)

**Evidence**
- `Football2` portals over the whole document (`Football2.tsx:907-1208`) with no menu.
- The Arcade `play` stage renders only the game (`Arcade.tsx:472-474`). Training and Moments do have "Leave" overlays (`Training.tsx:245`, `Moments.tsx`).
- An OS interruption only clears held inputs (`useInputInterrupt.ts`).

**Player impact.** There is no way to mute, check controls, resume or concede. That is standard in every store sports game.

**Fix direction**
- A pause button in the top-right safe area with Resume, Controls, Sound/Haptics and Quit.
- Online, quitting concedes; offline, quitting forfeits with a confirmation.
- Keep the online clock rules: pausing doesn't stop the rival.

---

## 6. Game flow, clock, structure

### F-1. The format is thin for a "respected sports game" (Medium)

**Evidence**
- 4 drives each (`drive.ts:11`). There is no game clock before the last drive, and the last drive is a 120 s drill with a fixed 20 s runoff (`drive.ts:18-19,202-215`).
- No timeouts, spike, kneel, hurry-up, two-minute warning or quarters.
- Last drives run 5–6 plays, and the clock expires on 2–16% of them.

**Fix direction**
- Optional "Standard" length: 6 drives with a halftime card.
- In the two-minute drill: 2 timeouts, a spike button, hurry-up (shorter runoff), and the clock stopping on the run-out-of-bounds rule already in place.
- Show the clock on every drive as "drive time", so the drill isn't a surprise.

### F-2. End-of-game summary and stats (Medium)

**Evidence**
- The final card shows only the score and drive-end letters (`Football2.tsx:1198-1205`; `390-22-final.png`).
- `matchDebrief` is built from drive ends only (`ut/MatchDebrief.tsx`).
- There is no per-player box score (passing C/A/yds/TD/INT, rushing, receiving, sacks, tackles), although the engine knows the catcher, carrier and tackler on every play.
- The final card is translucent over a stale lined-up play, so route lines bleed through (`390-22-final.png`).

**Fix direction**
- Accumulate per-player stats in Football2 (render-side, no rules change).
- Show a box score with a player of the game, and feed it to UT objectives ("throw 2 TDs with X").
- Make the final card opaque, or clear the pre-snap play once `g.over`.

---

## 7. Animation inventory (mocap)

### A-1. Gaps against console and mobile football (High)

**Mocap clips present** (`src/data/mocap/index.json`, CMU source, 26 clips): jumpshot, layup, jump, dribble, crossover, shuffle, ready, jog, run, sprint, cut, backpedal, celebrate, stumble, fall_back, slip, fall_forward, getup, getup_front, throw, catch, catch_run, block, stiff_arm, kick, dive.

**What NFL uses** (`render.ts:162`): ready, jog, run, sprint, backpedal, shuffle(_l), block, throw, catch, catch_run, dive, fall_back(_m), fall_forward(_m), kick, celebrate.

**Problems**
- **Moves are hand-keyed.** `animOf` has no case for juke, spin, stiff or truck (`render.ts:229-283`), so `poseOf` hand poses are used (`render.ts:115-130`). The juke is `P.crossover`, a basketball dribble pose. Mocap `cut` (with its plant event) and `stiff_arm` (with its extend event) exist but are unused for the NFL. The jump from mocap to hand-keyed rig and back reads as a style pop.
- **The QB drop skates.** During the drop the engine sets `act(qb,'stance')` every frame while moving him at up to 3 yd/s (`engine.ts:858-861`), so `animOf` plays the `ready` idle clip. He slides 6.5 yards with no footwork.
- **Sacks.** `endPlay(p,'sack',…)` (`engine.ts:1069`) never sets the QB's act. He stays standing as the rusher arrives; there's no fall, strip or celebration.
- **Missing set pieces:**
  - no snap or handoff exchange (the ball teleports at `dist<1.8`, `engine.ts:738-745`), no QB carry-out fake, no pitch;
  - no INT or fumble returns; the ball vanishes on incompletions (`arrive` sets `p.ball=null`, `engine.ts:1286`), with no bounce or tumble;
  - no diving or over-the-shoulder catches, no toe-tap at the sideline, no swat or pass-breakup arm, no drop animation beyond a hand wobble for CTH below 70;
  - no wrap-up, gang tackle or pile; players stay down (no `getup` / `getup_front`);
  - no FG snap or hold (the holder stands), and the FG defense never moves (`390-31/32`);
  - one celebration clip for every scorer, with no team celebration or sideline.

**Player impact.** The owner explicitly asked for "animations [that] seem real like how the games do". The set pieces fans watch most (sacks, picks, big runs, kicks) are the least animated.

**Fix direction**
- Wire the existing `cut` and `stiff_arm` clips into the juke and stiff-arm moves. Build truck (a shoulder drop from `run` plus `stumble`) and spin from CMU trials via `build_mocap.py`.
- Map the QB drop to `backpedal` or a three/five-step drop (a backpedal variant), with `ready` only while set.
- Sack: QB `fall_back`/`fall_forward` and a rusher `dive` hold.
- Use `getup` after 0.8–1.2 s for non-carriers before the whistle ends the play.
- Add a ball bounce for incompletions and a short return clip after INTs.
- All render-only, so no protocol bump.

---

## 8. Camera, HUD, readability and identity

### V-1. The camera wastes the screen and the players are tiny (Medium)

**Evidence**
- Portrait camera: `row 0.68, horizon 0.13, pitch 0.5, fov 0.42` (`render.ts:392`).
- Above the action (`390-03`, `390-10`, `390-11`): about 27% of the height is sky, stands and the score bug, and about 25% is empty far field.
- Receivers and defenders are about 12–25 css px tall and the ball about 2–4 css px (`390-05-air.png`).
- Yard numbers beyond about 20 yards are illegible smears.
- No zoom-out on deep throws and no zoom-in on contact; the replay zoom is the only change.

**Fix direction**
- Tighter field of view with a dynamic zoom: pull back for deep routes and lobs, push in on the carrier in traffic.
- Raise the field (horizon about 0.06).
- Ball trail and shadow ring.
- Simpler, larger yard numbers at a distance (mip or LOD for the floor texture).

### V-2. Player identity: every player looks the same (High; owner request)

**Evidence**
- `lookFor` (`render.ts:56-77`) gives every NFL body `skin: DEFAULT_SKIN, hair: 0, hairColor: DEFAULT_HAIR`. Hoops and soccer do the same: `DEFAULT_SKIN` is used in every renderer.
- Only height, weight, number and the linemen's bigger pads vary.
- Draft fill-ins are named "WR 81" or "OT 72" (`squad.ts:66`; visible in `390-01`).
- Names show only on receivers before the snap and on the ball carrier.

**Player impact.** "Add different characters… so we know who is who" (owner) is unmet in the NFL game.

**Fix direction**
- A small per-player `look` table keyed by player id: skin tone from a curated palette, visor tint, arm sleeves, gloves, towel, hair or locs out of the helmet. Fill it in for GOAT, Icon and star cards first; fall back to a seeded but plausible look.
- Bigger name chips for the ball carrier.
- On the field, prefer a real defensive name in the tackle text ("TACKLED BY …" is currently plain "TACKLED", `engine.ts:1192`).
- Render-only; keep the original pixel style.

### V-3. HUD overlaps and stale overlays (Medium)

**Evidence**
- Landscape: the LAST PLAY chip (x 71–206, y 84–128) overlaps the hint (x 73–400, y 98–128) (`shots-log.json`).
- Portrait: the chip's right edge sits 3 px from the drive marks (`390-08`).
- Hints wrap to two lines at 390 for running and for most hints at 320.
- The ability pop "CANNON" appears over the QB mid-throw.
- On Fire's text chip and its flame particles are fine.

**Fix direction.** A single HUD slot manager (hint / readout / pop) that queues instead of stacking, one-line hint copy, and keeping the readout clear of the marks.

### V-4. Ability pops are noisy and random (Medium)

**Evidence**
- `ABILITY_ON = 0.5` (`engine.ts:31`) is a seeded coin flip per play per ability.
- Measured pops per play: 0.7 for gold and 2.0–2.4 for elite squads.
- Nothing shows before the snap which abilities are "in the zone".

**Fix direction**
- Earn the zone (Madden-like): for example a WR after 2 catches, a DE after a pressure, or a single "zone" meter per team.
- Show active abilities on the play card or the player's chip before the snap.
- Rate-limit pops to 1 per play.
- Protocol bump if the trigger logic changes.

---

## 9. Juice, audio and feedback

**What exists**
- Juice (`juice.ts`) is render-only and proven deterministic (`juice.test.ts`): hit-stop, shake, punch, sparks and sweat.
- Big hits, trucks and long TDs get slow-motion replays (`Football2.tsx:511-536`), skippable and off under reduced motion.
- Haptics fire on big events.

**Gaps (Low to Medium)**
- No crowd build-up on 3rd down, no play-clock tension, no announcer, PA or stadium beats.
- `say()` pops sit centre-screen over the field (`390-06`, `390-11`).
- A touchdown gets a 2.0 s pop and confetti, but no camera beat or team celebration.

**Fix direction**
- Contextual crowd states: a 3rd-down roar, a red-zone swell.
- Move result pops to a lower-third broadcast strip.
- A TD sequence: replay, celebration clip, scoreboard flip.

---

## 10. Performance

**Measured**
- Autopilot lab, 390×844 DPR 3: 60.1 fps, p99 16.8 ms, no long tasks.
- At 4× CPU throttle: 57.3 fps, p99 33.4 ms, 10 frames over 33 ms and 6 long tasks totalling 527 ms in 15 s.
- The canvas is 390×844 CSS-scaled, which keeps the pixel art crisp.

**Risks (Medium)**
- Every stick `pointermove` calls `setKnob` (`Football2.tsx:822`), re-rendering the whole 1,300-line component tree at the touch rate (120 Hz on ProMotion). `KickMeter` `setState`s every rAF.
- Each frame clones 22 bodies for the replay recorder (`Football2.tsx:719`, about 360 frames × 22 objects kept).
- The sprite budget is 4 new drawings per frame (`render.ts:672`), so off-ball players visibly hold stale frames during camera moves.
- The floor is rasterised per frame in JS (`drawFloor`).

**Fix direction**
- Drive the knob through a ref and the style; memoize the HUD subtrees.
- Record replay snapshots at 30 Hz into pooled arrays.
- Raise the sprite budget when the cache is warm; prewarm common frames at kickoff.
- Profile on an A13-class iPhone.

---

## 11. What works well (preserve)

- **Engine architecture.** A deterministic, seeded, fixed-step 11-on-11 simulation where both phones agree. Render-only juice is proven identical with and without effects. A clean `RunInput` contract (a vector for humans, a number or `null` for the AI). Above-99 ratings are bounded and finite.
- **Physical, rating-driven sub-systems.** Assigned blocking needs real proximity. The pass rush takes the best of power and finesse moves. Route breaks are an RTE/AGI duel against MCV/AGI. Coverage has reaction lag by PRC/MCV. Defenders get one swept play on the ball. The catch point compares reach and contest. Tacklers show a telegraphed wind-up ring, and moves have counterplay (juke timed against the dive, stiff arm or truck at contact). All 16 abilities work, and the `ratings-matter` tests exist.
- **Realistic bands for even gold teams.** Completion 61–72%, 3rd-down conversions 40–49%, 5.7–7.4 plays per drive, flags on 4–5% of plays, about 0.5% of plays losing a fumble.
- **Throw trajectories that drive real physics.** BULLET, TOUCH and LOB differ in flight time, peak, lane clearance and lead. The "sight" mechanic turns QB accuracy into visible information.
- **Direct-control stick done right (once touched).** Screen-relative two-axis input, radial dead zone, analog speed, braking and reversing tuned by ACC/AGI. BURST shares stamina with the moves. Inputs are cleaned up on interruption. Two thumbs (stick + BURST) are supported. Every control is at least 44 px with no overlaps in run mode at all four tested sizes.
- **Penalties.** Accept/decline logic with half-the-distance rules (`drive.ts:217-273`). Blown coverages create plausible big plays for weaker offenses. Kickoff variance with seeded `startSpot`.
- **Landscape.** The side-on landscape camera shows the whole formation and routes clearly (`844L-01-playcall.png`); keep it as the reference for readability.
- **Feel touches.** Replays, hit-stop on trucks and big hits, On Fire flames, the stamina bar under the runner, the red tackler ring with a "!" chip, high-point leaps for SPC 85+ and a bobble for low CTH, heavier gaits for linemen, an afterimage for SPD 92+ backs.
- **Accessibility.** Reduced motion is honoured: no shake or zoom, short hit-stop, no replays. ARIA labels on all controls. Keyboard and WASD fallback.

---

## 12. Suggested order and protocol notes

1. **Controls and layout:**
   - momentum carry after a handoff or catch (C-1);
   - a compact play-call tray, a higher line of scrimmage and the run lane drawn on the field (P-1);
   - copy and hint fixes (P-4);
   - the playbook dialog overflow (P-3);
   - a pause menu (D-5).

   C-1 needs an NFL protocol bump. The others are UI-only.
2. **Fairness:**
   - decouple difficulty and give the AI QB a read floor (D-3);
   - top-tier balance (G-4);
   - Z target share (G-3);
   - overtime and the TD conversion choice (D-4, C-5).

   All need the protocol bump.
3. **Realism tails:**
   - run distribution (G-1);
   - deep-pass and YAC calibration (G-2);
   - pocket movement, throwaway and sack timing (C-2);
   - tackle contact (G-5).

   Add percentile-based regression tests built from `nfl_sim.ts`.
4. **Depth:**
   - defensive play calling and blitzes (D-1);
   - formations, play action, screens and situational suggestions (P-2);
   - a defensive call and drive recap for AI drives (D-2).
5. **Presentation:**
   - the animation set (A-1);
   - identity looks (V-2);
   - camera (V-1);
   - box score (F-2);
   - HUD manager (V-3);
   - ability zone (V-4).

**Protocol.** Any engine, autopilot, scoring or input-semantics change above means bumping NFL draft 10→11 and UT NFL 11→12, once per release (`src/net/match.ts`, `src/ut/Match.tsx`, pinned in `net.test.ts`/`nfl-net.test.ts`). Render-only work (A-1, V-1–V-3, F-2) needs no bump. Keep `football2/ratings-matter.test.ts`, `rushing.test.ts`, `gameplay.test.ts`, `variance.test.ts` and `juice.test.ts` green.

---

## Artifacts

- Simulation: `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/nfl_sim.ts`, output `nfl_sim_out.json`, tables `nfl_table.cjs`.
- Z-receiver probe: `audit-scripts/nfl_zside.ts`.
- Browser: `audit-scripts/nfl_shots.cjs` (screens), `nfl_catchstop.cjs` (post-catch braking in the live component), `nfl_perf.cjs` (frame pacing).
- Screenshots: `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/nfl/`. The `390-*`, `430-*`, `320-*` and `844L-*` sets include: 01 play call, 02 playbook, 03 drop, 04 aim, 05 ball in air, 06 after throw, 08 run call, 10/11 running, 12 fourth down. Also `390-20/21/22` (two-minute drill and final), `390-30/31/32` (kick drill and meter) and `390-40` (catch without the stick), plus `shots-log.json` with the measured control boxes.
