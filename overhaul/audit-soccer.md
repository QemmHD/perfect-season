# Soccer arcade engine and controls: production audit

**Area:** the arcade engine in `src/game/soccer2`:
- `engine.ts`, `autopilot.ts`, `match.ts`, `shootout.ts`, `ratings.ts`, `render.ts`, `Soccer2.tsx`, `soccer2.css`, `arcade.ts` and `Lab.tsx` (`?soccer-lab`)
- the shared `football2/controls.ts` dead-zone mapper
- the soccer paths in `game/Arcade.tsx`, `ut/Match.tsx`, `lib/sound.ts`, `pixel/*` and `play-feedback.ts`

**Baseline:** branch `claude/studio-overhaul`, which equals main `acdf3e2`.
- `PS_SPORT=soccer vitest run src/game/soccer2`: 33 of 33 tests pass.
- No tracked files were changed.

**Auditor:** Claude (Anthropic), 2026-11-09. This was a read-only audit.

## How this was measured

Scripts are in `scratchpad/overhaul/audit-scripts/` and screenshots in `scratchpad/overhaul/audit-shots/soccer/` (full paths in the appendix).

- **Whole matches** (`soccer_sim.ts`, tables from `soccer_table.cjs`): 400 matches per level, 22,400 attacks and 16,090 logged shots in all. Random pairs from the 1,714 real club-season elevens in `cards-soccer.json` (squad OVR p10 63.5, p50 71.9, p90 79.5) on the real engine and autopilot, logging every shot's distance, type and result. Levels use the shipped pairs: Rookie skill 0.45 / `defIQ` −0.5, Pro 0.68 / 0, Legend 0.88 / 1, and SIM 0.6 (SIM MY ATTACKS).
- **Scripted person** (`soccer_human.ts`, 200 attacks per row on real pairs; `soccer_ratings_human.ts`, 300 per cell on synthetic 60–99 squads): simple strategies through the real control API (stick vector, `setSprint`, `pressShoot`/`setAim`/`releaseShoot`), release timing sd 0.06 s as in the repo's own audit model.
- **Probes:** `soccer_probe.ts` (3,000 attacks: frozen balls, parry goals, step cost), `soccer_bend.ts`, `soccer_cam.ts` (replicates `render.ts`'s camera to compute each kick-off frame), and the repo's `scripts/audit_soccer_shots.ts 150 shots`.
- **Browser:** Vite on port 5203 at `?soccer-lab&qa&ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted. Real CDP touch at 390×844 and 430×932 (safe areas emulated as top 59 / bottom 34), 320×568 and 844×390, all `isMobile`, `hasTouch`, DPR 3. rAF pacing at 1×, 4× and 6× CPU throttle.

**Real-football reference rates** (approximate top-five-league figures 2022–25 from Opta/FBref tables and public StatsBomb/Opta xG models; targets for shape, not exact pins): 2.7–2.9 goals a match; 12–13 shots per team, 33–35% on target, ≈ 25% blocked, 10–11% converted; keepers save ≈ 70% on target; 35–40% of shots from outside the box. xG by distance: 0–6 m 0.30–0.45, 6–11 m 0.20–0.30, 11–16.5 m 0.08–0.12, 16.5–22 m 0.04–0.06, 22–30 m 0.02–0.03, 30 m+ ≤ 0.01; one-on-one ≈ 0.30–0.40. Headers 10–12%, penalties 76–78% (≈ 0.25–0.3 awarded per team per match), direct free kicks 5–7%, draws 24–27%.

---

## Top findings (summary)

| # | Sev | Finding |
|---|---|---|
| 1 | **Critical** | You never defend or see the opponent: a match is the same 7 dealt attack drills, and the AI's goals appear silently in the scoreboard. |
| 2 | **Critical** | The portrait camera shows about 17 m of the 68 m width: 0–1 of 3–5 teammates on screen at kick-off, and the wide-overload carrier starts **off-screen**. |
| 3 | **Critical** | Dominant no-skill strategy: sprint at goal, SHOOT at 16 m, no aim scores **58.5%** of counters against the AI's 20%, and wins a foul on up to 30% of runs. |
| 4 | **Critical** | Ratings are a cliff for a person: the same run scores 1.7% with 70-rated attackers and **92.3%** with 90s (against a 78 defence). |
| 5 | High | Frozen ball: a shot that stops short of goal can't be touched and stops the clock; the attack hangs up to **120 s** (0.83% of real-squad attacks). |
| 6 | High | Keepers parry into their own net: **14.3% of all goals** follow a parry, which `engine.ts:1062` sends toward the goal line. |
| 7 | High | The shot model is off: 5 shots a side (real 12–13), 53% on target (real 33–35%), 20% converted (real 10–11%); a person scores **16–22% from 30 m** (real ≤ 2%). |
| 8 | High | Difficulty is flat or inverted for the opponent: the AI scores 1.17 a match on Rookie and Pro but 0.99 on Legend, because `defIQ` also runs *your* defence. |
| 9 | High | The free-kick BEND buttons are inverted: "Bend left" curls the ball 3.4 m **right**. The reticle ignores bend, so bent far-corner free kicks go wide 51% of the time. |
| 10 | High | Thin animation set: one right-footed kick for every pass and shot, a belly-flop for keeper dives and slide tackles, a basketball jump for headers, no dribble touches, skill moves or get-ups. |
| 11 | High | Every player has the same skin and hair colour (`render.ts:79-80`); nobody looks like who he is (owner request). |
| 12 | High | HUD collisions: the first hint covers the goal and the aim reticle, "FREE KICK" and "BEND" overprint as "FBENDICK", and the opponent's penalty taker wears your control ring. |
| 13 | High | Corners waste 37% of the screen on sky and stands; the taker is a 17 px sprite at x = 17 and the goal is cropped. |
| 14 | High | No shooting skill ceiling: the assist beats a deliberate corner drag (49% vs 40% from 20 m), and there are no chip, finesse or driven shots. |
| 15 | Medium | Control, rules and presentation gaps (§4–§10): sprint on the right thumb, fixed stick, no pause, no corners or throw-ins from play, the formation ignored, the NFL crowd playing, minimal haptics, a pre-commit shootout keeper, a bare final screen. |

---

## 1. Match structure: is it a football match?

### S-1. Attacks only, the same seven, the opponent invisible (Critical)

**Evidence**
- `match.ts:1-6` and `52-66`: a side plays `ATTACKS = 6` plus one stoppage-time attack. `dealOf` shuffles the fixed bag `['build','counter','wide','corner','freekick','build']` and adds a counter or a wide overload for stoppage time. Every match therefore contains exactly one corner, one free kick, one counter, one wide overload and two build-ups. `soccer.test.ts:289` asserts this.
- Each scenario starts from hard-coded positions (`engine.ts:275-391`). The build-up always begins with your left centre-mid at (27, 51) against the same six-man block. Only the mirror side and a free kick's spot are random.
- The opponent's attacks are `aiAttacksOf(them, us, …)`, simulated at once (`match.ts:109`, `Arcade.tsx:185`). `Soccer2.tsx:772` simply prints `rival.score`. There is no pop, sound, replay or even "they scored" line when it goes up.
- There is no control of your keeper or defenders, no tackle button, no player switch, no kick-off, no half-time, no possession phase and no substitutions. Your back four and keeper only ever play in that invisible simulation (and the shootout).

**Player impact:** a set of shooting drills, not a match. Half the sport (defending, pressing, tackling, keeping) is missing, you lose without seeing why, and defenders' and keepers' cards feel worthless in Ultimate Team. (EA FC Mobile's *VS Attack* is a similar format, but it shows the opponent's attack phases and sits beside a full 11v11 mode.)

**Fix direction**, in order of payoff:
1. Make the opponent's attacks *watchable*. Play them on the same engine, with the AI on the ball, between your attacks, and give you a **defend** control set: switch to the nearest man (auto plus a SWITCH button), a CONTAIN/jockey hold, a TACKLE tap (standing) and a SLIDE (hold), with the keeper rushing on a button. The engine already has the defender brains, tackle resolution and fouls. They need a human input path (mirror `human()` for side D).
2. Give the deal variety. Draw from a weighted pool with several set-up templates per scenario: different carriers, depths and defensive shapes, short corners, edge-of-box free kicks, a "keeper long ball" and a "turnover high up the pitch". Let corners and free kicks be *earned* from play (see §5 R-2) rather than dealt.
3. For a "real match" mode (Club, Rivals), go to continuous 11v11 halves of 2–3 minutes on the same engine. The engine is general enough: 60 Hz, zonal back line, offside and fouls already exist.
4. At minimum, pop "RMA SCORE · 34' · RODRIGO" with a goal-mouth replay when the rival's score rises.

---

## 2. Measured realism: simulated stats against real football

### 2.1 Whole matches, AI against AI (400 matches per level)

| Metric | Rookie | Pro | Legend | SIM 0.6 | Real |
|---|---|---|---|---|---|
| Goals / match (both sides) | 2.33 | 2.33 | 1.98 | 2.27 | 2.7–2.9 |
| Draws | 26.0% | 26.8% | 31.0% | 23.0% | 24–27% |
| 0–0 | 8.0% | 7.8% | 14.5% | 7.8% | ≈ 7–8% |
| Better team (ΔOVR ≥ 8) wins / draws / loses | 66 / 19 / 14 | 69 / 24 / 7 | 67 / 21 / 12 | 64 / 24 / 11 | ≈ 60–70 / 20–25 / 10–15 |
| Shots per side | 5.20 | 5.21 | 4.63 | 5.07 | 12–13 |
| On target (goal + saved) | 51.3% | 53.7% | 54.9% | 52.2% | 33–35% |
| Goals per shot | 20.3% | 20.4% | 18.8% | 19.7% | 10–11% |
| Keeper save % of on-target | 60.4% | 61.9% | 65.8% | 62.2% | ≈ 70% |
| Blocked | 11.2% | 11.3% | 10.9% | 11.4% | ≈ 25% |
| Woodwork | 4.1% | 4.2% | 3.9% | 4.0% | ≈ 2–3% |
| Non-penalty shots inside the box | 63% | 60% | 56% | 60% | 60–65% |
| Penalties scored (n ≈ 40 each) | 78% | 93% | 89% | 86% | 76–78% |
| Direct free kicks scored | 3.4% | 2.3% | 4.3% | 4.5% | 5–7% |

**What works.** The **scorelines** are already believable:
- Per-side goals are Pro 0: 31%, 1: 37%, 2: 21%, 3: 6%, 4+: 4%. That is close to a Poisson with λ ≈ 1.2.
- The draw rate is right, and the better team wins about two in three.

**What's wrong.** The **shot model underneath is wrong.** Too few shots are converted at about twice the real rate, too many hit the target, and too few are blocked.
- Any stats screen (shots, on target, xG) would look fake.
- It is also why a person who simply *shoots more* breaks the game (§3).

### 2.2 Conversion by distance (open play, Pro, 4,167 shots)

| Distance from goal centre | Share of shots | Goal % (game) | Real xG |
|---|---|---|---|
| 0–6 m | 1.0% | 59.5% | 30–45% |
| 6–11 m | 13.6% | 45.0% | 20–30% |
| 11–16.5 m | 33.8% | 23.4% | 8–12% |
| 16.5–22 m | 27.1% | 15.8% | 4–6% |
| 22–30 m | 1.8% | 5.5% (Legend 12.3%) | 2–3% |
| 30 m + | 1.5% | 3.1% (Legend 14.5%) | ≤ 1% |
| Headers (all) | 18% | 18.3% | 10–12% |

Every band is converted 1.5 to 3 times too often. The 16.5–22 m band is the worst.

The AI rarely shoots from 22 m or more (3% of shots, against 15%+ in real football). When anyone does, it scores far too often, because `rangeCone` stops growing at 22 m (`engine.ts:781-783`, capped at ×2.25). The angular error is the same at 50 m as at 22 m.

The repo's own drills (`audit_soccer_shots.ts 150 shots`) agree:
- Edge of the box, about 20 m, one man closing: **39–47%** scored (real ≈ 5–7%).
- One-on-one: 61–64% (real ≈ 35–40%).
- With SHO 95 from the edge: 76%.
- Keeper rating swings an edge shot from 62% (GK 52) to 16% (GK 93).

**Fix direction**
- Retune toward real xG. Let `rangeCone` keep growing (for example linearly to ×4 at 35 m). Raise the keeper's base save radius for shots he sees early. Raise the block probability (the block width is only 0.42–0.45 m, `engine.ts:1351`).
- Re-fit `KEEP`/`SP_TUNE` against the distance table above with a new `setpieces`-style test pinning each band.
- Expect to need *more* shots (12–13 per match per side) at *lower* conversion. In an attacks-only format that means more shots per attack (rebounds, second balls) rather than more attacks.
- Any change to the physics or ratings requires bumping soccer draft 2 → 3 and UT soccer 2 → 3.

### 2.3 Attack ends (Pro, 2,800 attacks per side)

The AI's attacks end like this:

| End | Share |
|---|---|
| Goal | 16.7% |
| Lost (intercepted 13.2%, won in the air 8.4%, tackled 6.4%) | 33.7% |
| Wide or over | 22.5% |
| Saved | 15.2% |
| Blocked | 8.4% |
| Offside | 3.0% |
| Time | 0.6% |

By scenario, the goal rate is: build-up 21.6%, counter 19.4%, wide 18.9%, free kick 10.6% and corner 5.4%. Penalties are won in 1.1% of attacks.

Attacks use 4.3–7.2 s of the 30 s clock, so a whole match is about 1.5–2 minutes of real time: good for mobile, but drills rather than a game with ebb and flow.

---

## 3. Balance and fairness for a person

### B-1. A dominant no-skill strategy (Critical)

Strategy: run straight at the middle of the goal with SPRINT held, press SHOOT at distance D, never aim, timing sd 0.06 s, and take any foul's set piece low in a corner. 200 attacks on real club pairs:

| Scenario | Strategy | Pro (`defIQ` 0) | Legend (`defIQ` 1) | Autopilot 0.68 / 0.88 at the same `defIQ` |
|---|---|---|---|---|
| Counter | Beeline, SHOOT at 16 m | **58.5%** | **40.0%** | 20.0 / 17.5% (Pro); 12.0 / 12.5% (Legend) |
| Counter | Beeline, SHOOT at 20 m | 49.0% | 31.0% | |
| Counter | Beeline, SHOOT at 30 m | 22.5% | 13.0% | |
| Build-up | Beeline, SHOOT at 16 m | 26.5% | 24.5% | 26.0 / 18.0% |
| Build-up | Beeline, SHOOT at 30 m | 16.0% | 9.5% | |
| Wide | Beeline, SHOOT at 16 m | 38.0% | 32.5% | 18.5 / 21.5% |

The simplest input (hold up, SPRINT and SHOOT) beats the autopilot's whole decision tree by 2–3× on counters and wide overloads, and it **wins fouls**: a free kick on 20% of build-up runs, a penalty on 7.5–9.5% of build-ups and 9.5–12% of wide overloads.

**Causes:** defenders only engage within 1.2 m and then "gather" for 0.16–0.45 s (`engine.ts:1688-1697`); a beaten tackle stuns them for 0.95 s; sprinting costs only 6 dribble points; there's no body contact (`separate()` only pushes bodies apart at 0.7 m); and each beaten tackle is a foul 3–40% of the time (`engine.ts:1724`, +0.14 from behind), always a penalty in the box.

**Fix direction:** defenders block the line to goal, jockeying goal-side at 1.5–2.5 m, and tackle on timing and angle rather than proximity; a PHY shoulder-charge and a slowdown when running into a body; a heavier, contestable touch at full sprint, as in every FC title; about half the foul rate, with penalties depending on the tackle angle. Target: no single input pattern scores more than about 1.3× the designed AI in any scenario, pinned by a regression test using `soccer_human.ts`-style strategies.

### B-2. Ratings are a cliff for the person on the ball (Critical)

Same beeline at 16 m, synthetic squads, attackers at one rating against a 78 defence and 78 keeper (300 per cell):

| Attack OVR | 60 | 70 | 80 | 90 | 99 |
|---|---|---|---|---|---|
| Counter | 0.7% | 1.7% | 32.7% | **92.3%** | 99.3% |
| Build-up | 0.0% | 0.7% | 21.7% | 70.0% | 88.7% |
| Wide | 4.3% | 6.7% | 27.3% | 60.7% | 81.3% |
| Autopilot (counter / build-up) | 7.0 / 10.3% | — | 14.7 / 19.0% | — | 33.7 / 30.0% |

`tackleWin` (`ratings.ts:115-121`) is a logistic over DEF − DRI with scale 11, about 0.15 logits a rating point. A carrier faces 3–4 tackles a run, so survival compounds: at −8 OVR he gets through about 0.2% of the time, at +12 about 57%. PAC compounds the same way.

**Player impact:** a gold Ultimate Team side against bronze or silver Squad Battles is automatic, while a new player's 65–70 starter side can't carry the ball five metres, and passing doesn't help because the targets are off screen (§6 V-1).

**Fix direction:** flatten per-event effects (scale 18–22 instead of 11) and bound outcomes per attack; let DRI buy *options* (tighter turns, skill-move windows, protecting the ball) rather than tackle immunity; keep the AI-vs-AI scorelines of §2.1 as the regression target; add a soccer human-proxy `ratings-matter` test, monotone from about 8% (60) to 45% (99).

### B-3. Difficulty is symmetric and flat for the opponent (High)

**Evidence:** `Arcade.tsx:185` passes the same `defenseIQ` to the AI's attacks against your defence as to your attacks. Measured AI goals per match: Rookie 1.17, Pro 1.17, Legend 0.99, so raising difficulty makes the *opponent score less*. Only your attacks get harder (beeline counter 58.5% → 40%), and Legend mostly means more 0–0s (7.8% → 14.5%).

**Fix direction:** split the knobs into `aiAttackSkill` and `aiDefendIQ` for the opponent, keep your own AI defence at a fixed level, and fit each level to a target win rate for a reference human proxy (for example Rookie 75%, Pro 55%, Legend 35%).

### B-4. Manual aim never beats the assist (High)

**Evidence:** from 20 m on counters the assist scores 49.0% against 40.0% for a drag to the open low corner (build-ups 19.5% vs 21.5%; repo drill `1v1/run` 62.0% vs `1v1/drag` 61.3%). A full snapped drag always lands 0.85 × `AIM_X` = 1.0 m inside the post (`engine.ts:725`, `762-772`), while the assist adapts its margin to SHO and range (`engine.ts:733-744`). Learning to aim is punished.

**Fix direction:** give manual aim the same range and SHO margin, make the assist slightly conservative (about 70% of the margin) so a correct manual aim earns +5–10 points, and add shot types on SHOOT gestures (swipe-up chip, curved finesse, low drive) whose success depends on the keeper's position, which is where skill lives in FC Mobile and console Elite Shooting.

### B-5. Free kicks are a lottery (Medium)

**Evidence:** `SP_TUNE.fkCone = 3.0` (`engine.ts:892`) triples the error cone, so a person converts 3.5–4.5% whatever he does. "Far top corner plus bend" goes **wide 51% and over 23%**. Bend moves the ball ±3.1–3.4 m at 25 m (`soccer_bend.ts`), but the reticle shows the aim point, not where the bend takes it. The autopilot's 10–15% free-kick attacks are mostly rebounds.

**Fix direction:** show the bent path (or the bend-corrected arrival point), cut `fkCone` to about 1.5, let meter height control dip versus height, and target 6–8% direct for a skilled person and 2–3% for a careless one.

### B-6. Penalties slightly too easy in matches (Medium)

The penalty scenario tests at about 75% (`setpieces.test.ts`). Penalties won from fouls during matches scored 86–93% at Pro, Legend and SIM (about 40 per level). A person going low into the corner scores 84.5%.

Fix direction: bring both to 76–78%. Give keeper reads a skill tell (a run-up stutter), and make "PERFECT" low-corner kicks about 85% while ordinary releases drop to about 70%.

---

## 4. Controls

### C-1. Movement and dribbling (High)

**What works:** the stick is a true two-axis, screen-relative field vector with a radial dead zone and release-to-stop (`screenRunInput`), acceleration comes from PAC and DRI, and live QA confirmed forward moves up the pitch and release stops.

**Problems**
1. **The ball is glued to the boots.** `engine.ts:1192-1201` places it at `owner + facing × (0.32 + 0.035·v)` every frame: no touches, knock-ons or shielding, so dribbling has no rhythm and can't be contested.
2. **No skill moves:** no feint, step-over, drag-back, knock-on or protect. DRI only changes pace with the ball and tackle odds.
3. **The joystick is fixed** (118–124 px, bottom-left). Modern mobile sports games float it under the thumb.
4. **SPRINT sits in the right-hand cluster** (`soccer2.css:133`, measured at (304, 590) at 390 wide, above PASS), despite the CSS comment "stick and sprint on the left". One thumb can't hold SPRINT and press SHOOT or PASS, and pointer capture stops a slide between buttons, so every shot or pass drops you to 80% pace for the 0.62 s wind-up.

**Fix direction:** a touch-based dribble (a touch every 2–4 strides, knock distance up with speed and down with DRI, the ball winnable between touches); swipe or stick-flick skill moves gated by DRI; a floating stick with sprint on "push past the ring" or double-tap; and one pointer that can hop from SPRINT to SHOOT.

### C-2. Passing (Medium; mostly good)

**What works**
- Free directional passing with a narrow fading assist (22°, 18° lofted, 30° through).
- A dashed pass line in teal when it's on a man.
- Tap ground pass, hold 0.22 s for a lob or cross, THRU into space.
- The receiver runs onto it.
- Weight errors scale with PAS.
- The repo's measurements are sensible (a through ball aimed at a runner reaches him 97.5% of the time).

**Problems**
- You can't see the men you're passing to: at kick-off 0–1 of 3–5 teammates are on screen (§6 V-1).
- THRU is tap-only: there's no lofted through ball.
- There's no "call for a run" or player-lock, so you can't trigger the runner you want. Forwards start runs at random (`engine.ts:1654-1659`, a hazard of 0.35/s).
- The corner button says CROSS / HOLD, but the hint says "hold PASS to whip it in". A *tap* plays a ground ball out of the corner, which is mostly cut out.

**Fix direction**
- Fix the camera first. Then add a hold-THRU lofted through ball, plus a "runner" tap (tap a teammate on the pitch to send him in behind).
- Use one name per control in all copy.
- Off-screen teammates need edge arrows with initials, as FC Mobile and PES do for off-screen players.

### C-3. Shooting (High: depth)

**What works**
- The stick never aims. A drag on SHOOT aims, with a snap toward the corners.
- Accuracy follows release timing continuously.
- The mini-goal and in-goal reticle show the live error ring.
- The PERFECT / GOOD / EARLY / LATE words and the miss reasons ("LATE RELEASE · DRAGGED WIDE", "STRAIGHT AT HIM") are genuinely helpful. They were seen in the 390 screenshots `-05-release` and `-07-after`.

**Problems**
- Shot types (§3 B-4).
- **There's no range gate or feedback.** SHOOT works from your own half: the 390 screenshot `-04-meter-aim` shows a wind-up from about 50 m. Because the cone stops growing at 22 m, a 30 m shot has the same angular error as a 22 m one.
- The 0.62 s hold is long for a phone, and it's the same for a tap-in and a 25 m drive. FC Mobile's power shot is about 0.3–0.5 s, and its finesse and chip are instant swipes.

**Fix direction**
- Scale the hold time with distance (about 0.35 s inside 11 m, 0.62 s at 25 m).
- Add chip, finesse and driven gestures.
- Cap the range by SHO (beyond it the meter goes red with "TOO FAR"), or let the error grow without limit.

### C-4. Set pieces (High: the bend bug; Medium otherwise)

- **The BEND buttons are inverted.** `Soccer2.tsx:928-939` calls `setCurl(a, k*0.75)` with k = −1 labelled "Bend left" and a left arrow. A positive curl pushes the ball to its left (`engine.ts:89-94`), so k = −1 bends right. Measured (`soccer_bend.ts`): "Bend left" ends **+3.40 m right** of the aim and "Bend right" −3.11 m. The pitch swipe (`-dx/140`, `Soccer2.tsx:622-623`) is correct, so the two bend inputs contradict each other.
- The BEND buttons are 40 px tall (`soccer2.css:227`), below the 44 px rule. At 320×568 the bend row covers the taker (screenshot `320x568-11-freekick-meter.png`).
- Corners are "stick picks the man". The target ring and name tell you who, but the man is often a 14–17 px sprite at the far side of a badly framed shot (§6 V-3).
- **Shootout keeping** is a three-button pre-commit (DIVE ← / STAY / DIVE →, 92×56 px), with the camera behind *their* taker. Your keeper is about 40 px tall at the top of the screen (`390x844-25-pens-dive.png`). There's no timing or reaction element.
- **Online shootouts are a non-interactive cutscene** (`fixedShootout`), so both phones agree. That's understandable, but it leaves the most dramatic moment unplayed.

**Fix direction**
- Flip k in the button handler. Add a test that "Bend left" ends left of the aim.
- Raise the bend buttons to 44 px and move them off the taker.
- Shootout keeper: a reverse camera from behind the keeper and a swipe-to-dive with a reaction window. Read the kick from the taker's run-up and hips, as console games do.
- Online: run the kicks interactively with a deterministic lock-step, since both phones already share the seed. Send a commit-reveal of each aim and dive over the match channel.

### C-5. No pause, quit or settings in the match (Medium)

There's no pause control in `Soccer2.tsx` or `Arcade.tsx`. `useInputInterrupt` only clears held input on blur or visibility change.

Fix direction: add a pause button (top-left, away from the Dynamic Island) with resume, sound, haptics, controls help and forfeit.

---

## 5. Engine bugs and rules

### R-1. Frozen ball: up to 120 s of nothing (High)

**Evidence**
- `step()` stops the attack clock whenever `ball.flight.kind` is `'shot'` or `'parry'` (`engine.ts:1147`).
- `contact()` returns immediately for a shot (`engine.ts:1417`): "a shot in the air is the keeper's business".
- The keeper freezes while a `gkPlan` exists (`engine.ts:1914` and `keeperInFlight`).
- So a weak or blocked-looking shot or header that comes to rest without crossing a line, and without passing the keeper, stays a "shot" forever. Nobody can touch it and the clock doesn't run. The attack ends only at the hard stop `t > clock × 3 + 30` = 120 s (`engine.ts:1220`).
- Measured: 25 of 3,000 real-squad autopilot attacks (0.83%), and 0.22–0.44% of synthetic 75v75 attacks in every open-play scenario. All 25 stuck examples had the flight still `shot`, the ball still, a shot or header as the last event and `end:T`. Examples are in `soccer_probe_out.txt`.
- `soccer.test.ts:269` *allows* this: `a.t < CLOCK*3+31`.

**Player impact**
- About 1 attack in 120 shows a dead ball and frozen players for 90–100 real seconds.
- Over a 7-attack match that's about 6% of matches, and it reads as a crash.

**Fix direction**
- When a shot's speed drops below about 3 m/s, or it bounces twice, convert its flight to `'clear'`/loose so `contact()` can resolve it.
- Run the clock for slow "shots".
- Tighten the test to `a.t < clock + 15`.

### R-2. Parries into the goal and missing restarts (High)

**Evidence:** in `keeperSave`, 45% of parries go "out" along `norm(side × 0.9, +0.45)` (`engine.ts:1060-1062`), *toward* the goal line from `gk.y − 0.2`. With the keeper 0.5–3.6 m off his line, the ball often crosses inside the frame: **65 of 456 goals (14.3%)** had a parry as their last shot event, and 14.5% of all parries end in the net, right after the HUD pops "PARRIED!" (`Soccer2.tsx:259`).

Rule shortcuts in the same area: a ball over the byline ends the attack ("DEFLECTED OUT" or "SAVED · TURNED ROUND") with **no corner**; over the touchline it's "OUT OF PLAY" with **no throw-in**, whoever touched it; any keeper possession ends the attack; there are no cards.

**Fix direction:** parry away from goal (y-component ≤ 0, round the post only when the ball is outside ±(GHALF − 0.3)); chain an earned corner as a bonus attack in the same slot; quick throw-ins near the box; a yellow card for cynical fouls from behind.

### R-3. Fouls are too easy to win (High; see B-1)

The figures are in §3 B-1. In the real game, 0.25–0.3 penalties are awarded per team per match. Here a person running straight at the box draws one on about 1 attack in 10, which is about 0.7 a match.

Fix direction: see B-1. Halve the foul probability, and award a penalty only on tackles from behind or from the side inside the box.

---

## 6. Camera, readability and HUD

### V-1. Portrait camera: a 17 m keyhole (Critical)

**Evidence**
- `render.ts:214-217`: in portrait, `s = W/19` px per metre at row 0.6. At 390 wide that's about 20.5 px/m at your player's row, so you see **16.9 m of the 68 m** across.
- The camera follows only 60% of the ball's offset from centre (`render.ts:232`).

Per scenario at kick-off (`soccer_cam.ts`, at 390×844):

| Scenario | Carrier screen position | Teammates on screen | Goal mouth width |
|---|---|---|---|
| Build-up | (130, 568) | 1 of 5 | 46 px |
| Counter | (130, 568) | **0 of 3** | 43 px |
| Wide overload | **(−36, 568) / (426, 568): off-screen** | 1 of 5 | 62 px |
| Corner | (17, 346), 17 px tall | 3 of 5 | 67 px |
| Free kick | (245, 591) | 4 of 4 | 81 px |
| Penalty | (195, 487) | 1 of 3 | 94 px |

- 320×568 is the same with smaller numbers: carrier 34 px tall, goal mouth 35–51 px.
- `390x844-10-wide.png`: your winger isn't visible. His name tag "NEYMAR" is clamped to the screen edge directly behind the SPRINT button.
- `390x844-03-run-passline.png`: the pass line runs off toward a teammate the player can't see.
- **Landscape (`844x390-02-live.png`) looks right:** the whole width, bigger players, teammates and the goal all in view. The app is portrait-locked (`manifest` `orientation: portrait`; `stage.tsx` counter-rotates).

**Fix direction**
- Either (a) allow landscape for the match portal only: FC Mobile, eFootball and Dream League are all landscape. Or (b) redesign the portrait camera: higher and steeper (pitch about 0.9), `s ≈ W/34` (about 34 m across), following 85–100% of the ball's x, with dynamic framing that keeps the carrier, the nearest two options and the goal inside a safe box above the controls. Retro Goal and Soccer Story manage portrait with a much flatter top-down view.
- Add off-screen teammate arrows in either case.
- Add an "action-safe" rule: the carrier is never drawn under the control cluster (bottom 220 px) or the scoreboard (top `sat` + 60 px).

### V-2. Stands eat the screen near goal (High)

Near the box, and especially on corners and penalties, the far stand fills 30–37% of the screen height. In `390x844-10-corner.png`, y = 0–315 CSS px is sky, scoreboard and stands, and the pitch starts at about y = 320. The corner taker sits at x = 17 px at 17 px tall, and the goal is cropped at the top right. The lower 35% of the screen is empty grass under the stick.

Fix direction:
- Corner framing: aim the camera at the box, from the flag's side, with the goal at the upper third and the taker in frame. Use zoom ≈ 1.0, not 0.68.
- Clamp the horizon so the stands never take more than about 12% of the height in portrait.

### V-3. HUD collisions and clarity (High)

1. **The hint covers the goal.** `.sc2 .sc2-hint` sits at `top: calc(var(--sat) + 76px)` (`soccer2.css:57`), measured at (27, 135, 335×46) at 390. The goal mouth is at y ≈ 158–165 in build-ups and counters, so the first tip (4.2 s) hides the goal, the keeper *and the aim reticle* (`390x844-04-meter-aim.png`). On penalties it covers the RMA row of the tally (`390x844-21-pens-kick.png`, `-25-pens-dive.png`).
2. **Canvas label collision.** "FREE KICK" (`render.ts:552`) and "BEND" (`render.ts:792`) draw at about the same spot and print "FBENDICK" (`390x844-11-freekick-meter.png`; also at 320 and 430).
3. **The opponent's penalty taker gets your yellow control ring and name tag** (`render.ts:730`, ring on `ctrlOf(a)` for both sides). See `390x844-25-pens-dive.png`.
4. **Scoreboard truncation:** "COUNTER-ATT…" and "WIDE OVERLO…" (`soccer2.css` caps it at 92 px). At 320 the scenario name is hidden entirely.
5. **Names under the intro card.** At 320 the intro card covers XAVI's tag, and BUSQUETS is clipped at the left edge (`320x568-01-intro.png`).
6. The rival's goals have no notification (§1).

**Fix direction**
- Move tips to a bottom-anchored toast above the controls, or into the intro card. Never show one while the meter is up.
- Give canvas labels a collision layout pass (stack the BEND label under the meter label).
- Draw the control ring only for `side A` when `usKicking`. Show their taker with the rival's colour tag.
- Use short scenario names (BUILD, COUNTER, WIDE, CORNER, FREE KICK) or a two-line mid-cell.

### V-4. Tiny players (Medium)

Your carrier is about 25–42 px tall at 390, and far players 10–14 px. The goal is about 45 px wide when an attack starts. Kit numbers are 3–4 px glyphs.

Combined with V-1, players can't tell who's who. This feeds the owner's "so we know who is who" request: see A-2.

---

## 7. Animation and identity

### A-1. Inventory against console and mobile football (High)

Loaded clips (`render.ts:42`) and where each is used (`animOf`, `render.ts:111-159`):

| Moment | What plays now | Production expectation | Gap |
|---|---|---|---|
| Jog / run / sprint | CMU `jog`, `run` ("a basketball player, no ball"), `sprint`, rate-matched to speed | Football run cycles, with and without the ball and with arm swing | OK, generic |
| Dribble | The same run cycle; ball glued at the feet | Touch-synced dribble, close control, knock-on, shielding | **Missing** |
| Pass, cross, shot, volley, chip, free kick, penalty | **One** `kick` clip (approach, plant, right leg), warped to contact at 0.11 s | Inside-foot pass, driven pass, lob, cross, laces shot, finesse, chip, volley, left foot | **One clip for all; no left foot** |
| Header | `jump` (basketball two-foot jump) | Attacking header, glancing header, diving header, defensive clearance | Weak |
| First touch | None (the ball snaps to his feet) | Trap, chest, thigh, turn-on-receive | **Missing** |
| Slide tackle | `dive` (forward belly dive) | Feet-first slide, standing poke, block tackle | Wrong motion |
| Beaten / fouled | `fall_forward` / `fall_forward_m`, then pops up | Stumble, fall, roll, **get-up** (`getup`/`getup_front` exist in the library but aren't loaded) | Partial |
| Keeper set / ready | `ready` (basketball ready stance) | Keeper set position, side-shuffle | Generic |
| Keeper dive | `dive` (forward belly-flop), its facing forced sideways | Low dive, high dive, tip-over, parry, punch, catch, smother | **Wrong motion** |
| Keeper catch | `catch` (chest) | Catch, gather, distribute | Partial |
| Wall | `ready`, or `jump` when it jumps | Wall jump, hands protecting | OK |
| Defender jockey | `backpedal` at under 4.5 m/s | Jockey / side-step (`shuffle`/`shuffle_l` are **loaded but never used**) | Partial |
| Celebration | One `celebrate` (arms up); the scorer jogs to the corner flag | Several celebrations (knee slide, badge kiss, team pile-on); teammates join | Thin |
| Throw-in, goal kick, kick-off, referee | — | — | No restarts exist |

**Fix direction:** add about 15 football clips from licence-clear research mocap (inside-foot pass, laces shot, chip, trap, chest control, diving header, feet-first slide, standing tackle, keeper low and high dives each side, catch-and-hold, keeper kick, get-up, two celebrations). Mirror for the left foot, chosen by ball side and the card's foot. Sync dribble touches to the `stepL`/`stepR` beats. Drop the unused `shuffle`, `shuffle_l` and `fall_back` loads or use them.

### A-2. Every player looks identical (High; owner request)

**Evidence**
- `lookFor` (`render.ts:68-89`) gives every player `skin: DEFAULT_SKIN` (#a8714f) and `hairColor: DEFAULT_HAIR`.
- `hairFor(id)` hashes the id into basketball styles: high top, headband, locs.
- Body weight is derived from height at BMI 23.
- Only height, kit number and the yellow name tag on the controlled player tell players apart.

**Fix direction**
- Add per-player appearance data to the soccer card pipeline (`scripts/build_soccer_cards.py`): skin tone (5–6 buckets), hair colour, hair style (short, long, bald, curly, ponytail, man-bun, bleached) and facial hair. Source it from public, licence-clear descriptors. Hand-curate the top 300 stars and default the rest by hash with plausible regional priors.
- Add boot colour and sleeve or undershirt variants.
- Show names above *every* attacker for the first second of each attack. In-match name tags above the teammate the pass line points at already exist.

---

## 8. AI

### AI-1. Attacking autopilot (Medium; mostly good)

**What works**
- It plays through the same controls as a person, with skill-scaled read times, release spread and pass choice (`autopilot.ts`).
- Scorelines and better-team-wins rates are realistic (§2.1).

**Problems:** it loses 33–41% of attacks (interceptions 13–19%), almost never shoots from range (3% of shots from 22 m+), never plays THRU into space or switches play, and its `think()` pass-versus-carry scoring looks the same every time. Once its attacks are watchable (§1) it needs team styles (possession, direct, wing play, counter) derived from squad stats.

### AI-2. Defending AI (High)

**What works**
- A zonal back line that steps up and drops (`lineY`).
- Nearest-man press, cover man, goal-side marking, tracking runners, reading passes after a DEF-scaled lag, and the chaser logic for interceptions.

**Problems.** It is exploitable by a straight sprint (B-1):
- It doesn't block the shooting lane once the carrier is inside 20 m.
- Defenders don't slide to block shots (block chance only if the ball crosses their y within 0.45 m).
- The keeper's rush comes only from 18 m and only when unblocked.

Fix direction: lane-blocking (stand on the carrier–goal line at 1.5–2.5 m), shot-block lunges, a recovery sprint after being beaten, and keeper rush timing from the carrier's touch.

---

## 9. Juice, audio and presentation

### J-1. Wrong crowd: the soccer sounds are wired but unused (Medium)

**Evidence**
- `Soccer2.tsx:205-206` calls `loadSamples('stadium')` and `crowd.start(0.24, 'stadium')`. That loads the **NFL** stadium crowd bed and samples.
- The soccer venue `'pitch'` (`sound.ts:156-193`: `soccer-chant`, `soccer-roar`, `soccer-kick-1/2`, `soccer-bounce`, `soccer-whistle`) is never preloaded, and its chant never plays.
- `sample()` loads lazily on a miss, so the first goal's roar and the first kicks fall back to stand-ins.
- `sfx.bounce()` is never called.

Fix direction: `loadSamples('pitch')` and `crowd.start(0.24, 'pitch')`. Call `sfx.bounce` on ground contacts after flight.

### J-2. Thin juice compared with NBA and NFL (Medium)

**Evidence**
- The soccer match doesn't use the shared `Juice` system (`src/game/juice.ts`: hit-stop, particles, trails, squash and stretch) that NBA and NFL use.
- It has one `vibrate` call (on a goal), against 13 across Hoops2 and Football2.
- No ball trail on power shots.
- No hit-stop on tackles, saves or woodwork.
- No slow-motion close call on a save.

**Fix direction**
- Wire `Juice`: hit-stop on a PERFECT strike (40 ms), a save (60 ms) and woodwork (80 ms), and a trail on shots over 25 m/s.
- Gesture-gated haptics: a light tap on the green release, a medium tap on tackles, heavy on goals.
- An "almost" slow-motion when a shot passes within 0.3 m of the post.

### J-3. Presentation bugs (Medium)

- **Confetti in your colours for the opponent's goals.** Any `celebrate` act bursts confetti from `this.kits.us` (`render.ts:458`, `476`). This is visible in shootouts ("THEY SCORE" with your confetti, frame 10 of `390x844-auto-contact.png`).
- **Bare final screen** (`390x844-39-final.png`). It shows only a big number, the end letters and "YOU LOSE THE SHOOTOUT". There are no scorers, shots, xG, possession or man of the match, and no replay highlights.
- **No goal ceremony beyond a pop.** There's no scorer card with his rating or stat line, and no teammates joining. For an Ultimate Team game, a goal is the moment to show the card that scored.

**Fix direction**
- Fix the confetti colours.
- A full-time card: scorers with minute and assist, your shots/on target/xG against the AI's, Player of the Match (card art), and per-attack highlight replays.
- A goal moment: a scorer card flip-in with OVR, plus a "+XP" tick.

### J-4. Commentary and atmosphere (Low)

There's no commentary and the crowd doesn't build near the box. Cheap fix: an event-driven text ticker ("Messi… cuts inside… SHOOTS!") and a crowd swell keyed to the ball's distance from goal.

---

## 10. Ultimate Team coupling

### U-1. The formation is cosmetic and most cards never play (Medium)

**Evidence**
- `cardSquad` → `squadFrom` (`arcade.ts:145`, `ratings.ts:198-215`) always rebuilds a **4-3-3** by best position fit. The UT 4-4-2 / 4-2-3-1 / 3-5-2 choice has no effect in the engine.
- In the user-played scenarios (build-up, counter, wide), only the midfield three, the front three and, in wide overloads, one full-back appear. Your centre-backs appear only as corner and free-kick targets, and your keeper only in shootouts. Their main effect is in the invisible AI attacks.

Fix direction: map formations to scenario set-ups (a 4-4-2 build-up has two strikers; a 3-5-2 has wing-backs high). Make defenders visible by playing the opponent's attacks (§1).

---

## 11. Performance

**Engine:** 22.8 µs per 60 Hz step (engine plus autopilot, `soccer_probe.ts`). Negligible.

**Rendering:** rAF pacing in the lab's autopilot match over 8 s:

| Viewport | CPU | fps | p95 | p99 | max | Frames over 20 ms | Long tasks |
|---|---|---|---|---|---|---|---|
| 390×844 | 1× | 60.0 | 16.8 | 16.8 | 16.8 | 0 | 0 |
| 390×844 | 4× | 59.0 | 16.8 | 33.3 | 50.1 | 6 | 1 |
| 390×844 | 6× | 53.1 | 33.3 | 50.1 | 100 | 41 | 4 |
| 844×390 | 4× | 56.9 | 16.8 | 50.0 | 83.4 | 14 | 5 |
| 844×390 | 6× | 46.1 | 50.0 | 66.7 | 150 | 76 | 9 |

It is smooth on a modern phone. Older devices (4–6× slower) see hitches.

**Likely cause:** sprite-cache misses. Each mocap frame × facing × pixel size × pitch bucket is drawn on demand, at most 5 a frame (`render.ts:700`). Zooms (corner 0.68, replay 1.3) change `px` every frame, so sprites are redrawn constantly and players left on stale sprites pop in size.

**Fix direction:** quantise sprite size during zooms, pre-warm run, kick and dive frames for the visible looks at attack start, and redraw the q = 2 floor only when the camera moves.

## 12. Tests and QA gaps (Low)

All 33 soccer tests pass, but `soccer.test.ts:269` accepts the 120 s freeze, and nothing pins the parry direction, the bend direction, per-distance conversion, human-strategy dominance, the rating gradient for a person, camera framing or HUD overlaps. `scripts/qa/soccer-lab.mjs` checks page errors and frame time, not layout. `soccer2.css:300-370` uses `max-width` media queries; the match is a full-screen portal outside the 390 frame, so it's tolerable, but `wide`/height classes would match the house rule.

---

## 13. What works well and must be preserved

- **The deterministic, seeded engine:** a fixed 60 Hz step, every random draw from the attack's generator, replays that repeat exactly, and `agreedShootout` for online agreement. Keep the determinism tests.
- **Real ball physics:** drag, rolling resistance, Magnus curl, top-spin dip, bounces, analytic and solved pass and shot velocities, woodwork and the net.
- **The ratings layer:** bounded, monotone effects with finite above-99 handling (`rt()`). Every face stat has a measurable role, the keeper's six included.
- **The AI-vs-AI scorelines:** ≈ 2.3 goals, ≈ 26% draws, a Poisson-like spread, and the better side winning about two in three. Use these as regression anchors while fixing the shot model underneath.
- **The control contract from the 2026-11-02 update:**
  - the stick only runs
  - aim with a drag on SHOOT
  - continuous timing accuracy
  - the mini-goal and reticle
  - PERFECT / GOOD / EARLY / LATE plus miss reasons
  - free passing with a narrow assist and a pass line
  - receivers running onto passes
  - first-time volleys and headers
- **The keeper model:** the bisector stance, narrowing tight angles, REF reaction, DIV reach, HAN catch-or-parry, and the backlift "set". It just needs the parry direction fixed.
- **Offside judged at the moment of the pass**, and a believable zonal back line, press and cover.
- **Shootout rules:** five kicks then sudden death, the can't-catch-up stop, and taker order by finishing.
- **The UX scaffolding:** intro cards with per-scenario hints, the attack marks with letters, the PlayReadout "Last play" coaching, goal replays with tap-to-skip, reduced-motion handling, input-interrupt cleanup and lazy loading of the soccer chunk.
- **The landscape layout**, which already looks like a proper football game.

---

## 14. Suggested order of work

Every engine change bumps soccer draft 2 → 3 and UT soccer 2 → 3 (NBA and NFL untouched). Re-run the three simulation scripts after each step.

1. **Bugs:** frozen ball (R-1), parry direction (R-2), inverted BEND (C-4), soccer sounds (J-1), the hint and label collisions, the opponent's control ring and confetti (V-3, J-3), 44 px bend buttons.
2. **Camera:** a portrait redesign or a landscape match portal, off-screen teammate arrows, an action-safe framing rule (V-1, V-2).
3. **Balance:** lane-blocking and contact in the defending AI (B-1, AI-2), a flatter `tackleWin` (B-2), the shot model fitted to xG by distance (§2.2), half the foul rate (R-3), split difficulty (B-3), manual aim at least as good as the assist (B-4).
4. **Structure:** watchable, defendable opponent attacks (S-1), a varied deal with earned corners and throw-ins (R-2), a full-time stats card (J-3).
5. **Feel:** touch dribbling and skill moves (C-1), shot types (C-3), the animation pack (A-1), player appearance data (A-2), Juice and haptics (J-2), an interactive shootout keeper (C-4).

---

## Appendix: files

- **Scripts and outputs:** `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/`: `soccer_sim.ts` + `soccer_table.cjs` (`soccer_table_all.txt`), `soccer_human.ts` (`soccer_human_out2.txt`), `soccer_ratings_human.ts` (`soccer_ratings_human_out.txt`), `soccer_probe.ts` (`soccer_probe_out.txt`), `soccer_beedbg.ts`, `soccer_stuck.ts`, `soccer_bend.ts`, `soccer_cam.ts` (`soccer_cam_out.txt`), `soccer_shots.cjs`, `soccer_dive.cjs`, `soccer_perf.cjs` (`soccer_perf_out.txt`), and the repo drill output `existing_shots_150.txt`.
- **Screenshots:** `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/soccer/` (390x844, 430x932, 320x568, 844x390), with contact sheets `390x844-auto-contact.png`, `430x932-contact.png` and `320x568-contact.png`, and element boxes in `report-*.json`.
