# Studio overhaul, team soccer: build plan

Planner: Claude (Anthropic), 2026-11-09. Worktree `/home/user/ps-s-soccer`, branch `claude/studio-soccer`, dev port 5217.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`. Sources read in full: `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-soccer.md`, `O/audit-soccer.md`, `O/research-soccer.md`, the audit harnesses `O/audit-scripts/soccer_*` and their outputs, `docs/SOCCER-ENGINE.md`, `docs/SOCCER.md`, `CLAUDE.md`, and all of `src/game/soccer2/` plus the soccer paths in `Arcade.tsx`, `ut/Match.tsx`, `ut/teams.ts`, `ut/squad.ts`, `lib/sound.ts`, `game/juice.ts`, `pixel/persp.ts`, `play-feedback.ts`. Team doc (engineers keep it current): `docs/studio-overhaul/soccer.md`.

## 1. Goals

1. **It looks like football on a phone.** Your passing options are on screen, the goal is in view near the box, nothing in the HUD covers the ball, the goal or your man, and the crowd sounds like a football ground.
2. **Skill beats exploits.** Sprinting straight at goal and holding SHOOT stops being the best play. Better cards are better on a smooth curve, never a cliff. Aiming, passing and timing are rewarded.
3. **The numbers look real.** Shots, on-target share, conversion by distance, blocks, saves, penalties and free kicks land near real top-flight football (times the documented arcade factor), while the believable scorelines (about 2.3–2.7 goals, about 25% draws) stay.
4. **It is a match, not drills.** Varied attack situations shaped by your formation, the opponent's attacks visible and defendable in solo play, an honest difficulty ladder, a proper full-time screen with scorers and a player of the match, and pause/quit.
5. **It feels like the respected games, on a thumb.** A floating stick with sprint on the left thumb, shot types and skill moves as gestures, juice, atmosphere and commentary, and animation hooks for the players team.
6. **Nothing breaks.** No save, storage key, card or copy id changes. Online soccer gets one protocol bump (by the lead). NBA and NFL are untouched. Determinism, bounded ratings, the 2026-11-02 aim/shoot/pass contract, the keeper model, offside and the shootout rules are preserved.

## 2. Baseline (measured by the audit on `acdf3e2`, re-confirmed in soccer-1)

| Area | Baseline | Source |
|---|---|---|
| AI vs AI, Pro (400 matches) | 2.33 goals/match, draws 26.8%, 0–0 7.8%, 5.21 shots/side, on target 53.7%, goals/shot 20.4%, save% 61.9%, blocked 11.3%, woodwork 4.2%, pens 93% (n=43), direct FK 2.3% | `soccer_table_all.txt` |
| Conversion by distance (Pro, open play) | 0–6 m 59.5%, 6–11 m 45.0%, 11–16.5 m 23.4%, 16.5–22 m 15.8%, 22–30 m 5.5% (Legend 12.3%), 30 m+ 3.1% (Legend 14.5%); only 3.3% of shots from 22 m+ | same |
| Difficulty (AI goals per side) | Rookie 1.17, Pro 1.17, Legend 0.99 (inverted) | same |
| Dominant no-skill run (counter, beeline, SHOOT @16 m) | 58.5% (Pro) / 40.0% (Legend) vs autopilot 20.0 / 12.5% | `soccer_human_out2.txt` |
| Same @30 m | counter 22.5%, build 16.0% (real ≤ 2%) | same |
| Fouls won by beelines | FK up to 28% of runs, penalties up to 15.5% | same |
| Rating cliff (counter beeline vs 78 def) | 60: 0.7%, 70: 1.7%, 80: 32.7%, 90: 92.3%, 99: 99.3% | `soccer_ratings_human_out.txt` |
| Manual aim vs assist (counter, 20 m) | drag 40.0% < assist 49.0% | `soccer_human_out2.txt` |
| Free kicks by a person | 3.5–4.5%; "far top + bend" wide 51%, over 23% | same |
| Penalties by a person | low corner 84.5% | same |
| Frozen ball | 25 of 3,000 attacks (0.83%) hang to the 120 s hard stop | `soccer_probe_out.txt` |
| Parries into own net | 65 of 456 goals (14.3%) | same |
| BEND buttons | "Bend left" ends +3.40 m right, "Bend right" −3.11 m | `soccer_bend.ts` |
| Portrait camera at kick-off (390×844) | 16.9 m of 68 m visible; teammates on screen build 1/5, counter 0/3, wide 1/5; wide carrier off-screen (x −36 / 426); corner taker 17 px at x=17; stands 30–37% of the height near goal | `soccer_cam_out.txt` |
| Frame pacing (lab autopilot, 390×844) | 1×: 60 fps; 4×: 59 fps, p99 33.3 ms; 6×: 53.1 fps, p99 50.1 ms | `soccer_perf_out.txt` |
| Tests | 33/33 soccer2 tests pass; `soccer.test.ts:269` allows the 120 s freeze | audit §12 |

## 3. How every task measures (shared commands)

- Heavy commands go through the semaphore: `bash O/heavy.sh <cmd>`. An env var goes through `env`: `bash O/heavy.sh env PS_SPORT=soccer npx vitest run soccer sport-branches`.
- Typecheck: `bash O/heavy.sh npm run typecheck`. Area tests: as above. Full `npm test` and `npm run build`: final QA task only (soccer-10), once each.
- Harnesses (ported into the repo in soccer-1 so they measure this worktree): `bash O/heavy.sh npx vite-node scripts/soccer/<name>.ts [n] [part]`:
  - `sim.ts [matches] [rookie|pro|legend|sim0.6|all]`: whole AI-vs-AI matches on 1,714 real club-season elevens; prints the §2.1 table (scorelines, shots, outcome mix, conversion by distance band, per-scenario rates, pens, FKs, set-piece share of goals).
  - `human.ts [n]`: the scripted-person strategies (beeline sprint/jog/weave × shoot at 12/16/20/25/30 m × assist/drag, plus the `skilled` proxy added in soccer-4) against the Pro and Legend autopilot, per scenario, with fouls won.
  - `ratings-human.ts [n]`: the rating gradient for a person (attack 60/70/80/90/99 vs a 78 defence) and the autopilot's.
  - `probe.ts [n]`: frozen balls, attacks longer than clock + 15 s, parry own-goals, step cost.
  - `bend.ts`: crossing point vs aim per BEND input.
  - `cam.ts`: camera framing per scenario and viewport (rewritten in soccer-2 to call the real `camera.ts`, no replicated maths).
  - `scripts/audit_soccer_shots.ts [n]` (existing): the seeded shooting/passing drills.
- Dev server: `cd /home/user/ps-s-soccer && nohup npx vite --port 5217 --strictPort > /tmp/ps-soccer-vite.log 2>&1 & echo $! > /tmp/ps-soccer-vite.pid`; stop with `kill $(cat /tmp/ps-soccer-vite.pid)`. Never `pkill -f`/`pgrep -f`.
- Browser QA: `PS_QA_URL=http://localhost:5217/ bash O/heavy.sh node scripts/qa/soccer-lab.mjs [part]`. The lab URL is `?soccer-lab&qa&ns=inspect&relay=ws://localhost:7777` (+ `scenario=`, `seed=`, `auto`, `pens`, `def=`). soccer-1 adds a `context.route('**/*')` abort for every host except localhost/127.0.0.1 and the two font hosts to `soccer-lab.mjs` and `soccer-app.mjs` (copied from `O/audit-scripts/utui/lib.mjs`), and device presets with `window.__psInsets` (393×852 insets 59/0/34/0, 390×844, 430×932, 320×568), touch, `deviceScaleFactor: 1` for our checks (3 for screenshots the owner sees).
- Screenshots go to `O/shots/soccer/<task>/` with before/after pairs, and every screenshot is opened and looked at.
- Every engine task re-runs `sim.ts 400 pro`, `human.ts 200` and `probe.ts 3000` and pastes before/after into the team doc.

## 4. Scope map (nothing silently dropped)

### 4.1 STREAM-soccer scope

| Brief item | Task |
|---|---|
| V-1 portrait camera (wider zoom, height-aware tilt, look-ahead, off-screen teammate arrows) | soccer-2 |
| V-1 name tag never behind SPRINT; wide overload never starts off-screen | soccer-2 (soccer-9 then moves SPRINT to the left thumb) |
| V-2 stands ≤ ~12% of the screen near goal | soccer-2 |
| B-1 defenders close down, tackle, block | soccer-4 |
| B-1 / R-3 fouls not cheap | soccer-4 |
| B-1 sprinting costs control and touch | soccer-4 |
| B-1 measure with `soccer_human.ts` until skilled beats no-skill | soccer-1 (harness port), soccer-4 (targets), soccer-5 (re-check after calibration) |
| B-2 smooth rating curve (`tackleWin`) | soccer-4 |
| R-1 frozen ball + test | soccer-1 |
| R-2 parry away from goal | soccer-1 (direction), soccer-3 (steered wide/out by HAN and position) |
| R-2 missing restarts (corners, goal kicks) | soccer-3 |
| C-4 BEND reversed + test | soccer-1 |
| V-3 hint covers goal and reticle; FREE KICK/BEND overprint; opponent taker gets your ring | soccer-2 |
| J-3 opponent goals throw your confetti | soccer-1 |
| J-1 NFL crowd; wire the unused soccer sounds (`src/lib/sound.ts`) | soccer-1 |
| C-5 pause and quit (online quit = forfeit with confirm) | soccer-6 |
| Result screen: scoreline, scorers, player of the match, DRAW; provide data to ut | soccer-6 (contract published in soccer-1) |
| Realism: shots/side 12–13, on target 33–35%, converted 10–11%, 30 m ≤ 2% | soccer-3 (shot model, drills), soccer-5 (whole-match calibration), soccer-6 (stats sheet totals) |
| Keep 2.3–2.7 goals and ~25% draws | soccer-5 (regression test), re-checked in soccer-7 and soccer-10 |
| B-3 difficulty ladder (AI side only) | soccer-5 |
| B-4 aiming rewarded over assist | soccer-3 |
| B-5 free-kick lottery; B-6 penalties slightly easy | soccer-3 |
| Seeded tests for each realism target | soccer-3 (`xg-bands.test.ts`), soccer-4 (`balance.test.ts`), soccer-5 (`realism.test.ts`) |
| S-1 varied attack situations (build-up from the back, counters, wing play, set pieces) | soccer-5 (weighted deal), soccer-7 (set-up templates) |
| S-1 defending phases: switch, jockey/contain, tackle/slide timing, keeper on 1v1s; rival goals from those phases; Auto-defend; online unchanged | soccer-8 |
| C-1 sprint on the left thumb, floating joystick | soccer-9 |
| C-3 shot types (finesse, chip, driven/low) with a touch gesture; keep drag-to-aim and timing | soccer-9 (engine parameters fitted against the soccer-3 model) |
| Skill moves (≥ 3) as swipes | soccer-9 |
| Dribble touches tied to DRI | soccer-4 (touch mechanic), soccer-9 (close-control feel) |
| AI-2 defending AI holds a shape, presses, covers the shooting lane | soccer-4 (+ teammate contain in soccer-8) |
| U-1 formation and all 11 cards matter | soccer-7 |
| A-1 animation: L/R kicks, keeper dives, slide tackles, dribble touches, get-ups (players team draws) | soccer-1 (action list and metadata contract published for players), soccer-4/8/9 (new acts), soccer-10 (metadata populated, routing hooks) |
| J-2 / J-4 juice and atmosphere: goal moments, net ripple, scorer celebration, crowd swells, commentary text | soccer-6 (goal moment card), soccer-10 (the rest) |
| "Protocol bump needed: soccer draft 2→3, UT 2→3" in the team doc | soccer-1 (first entry), soccer-10 (final wording) |
| Preserve list (§13 of the audit) | every task; guarded by the existing tests plus `golden.test.ts` from soccer-7 |
| Owner device checks (camera framing, sprint and stick feel, defending controls) | soccer-10 (doc), noted per task |

### 4.2 Audit items not named in STREAM

| Audit item | Task or deferral |
|---|---|
| V-4 tiny players | soccer-2 (zoom per phase; players team boosts small-sprite heads) |
| A-2 every player looks identical | players team (owner of appearance data); soccer only passes ids through |
| AI-1 attacking autopilot (never shoots from range, no THRU into space, no team styles) | soccer-5 (shot appetite and THRU), soccer-7 (team style from squad stats) |
| C-2 passing: edge arrows | soccer-2 |
| C-2 one name per control in all copy (CROSS/HOLD vs "hold PASS to whip it in") | soccer-2 |
| C-2 hold-THRU lofted through ball, tap-a-teammate runner trigger | Deferred (P2): passing is the strongest existing area and its main defect (targets off screen) is fixed by soccer-2's camera and arrows |
| C-4 shootout keeper (reverse camera, swipe to dive) | Deferred (P2): the pre-commit DIVE/STAY works and is deterministic; it needs a new camera mode and input after the defend phases |
| C-4 online interactive shootout | Deferred: needs commit-reveal over the match channel (`src/net/**`, lead-only) and a protocol change; online keeps the agreed shootout |
| S-1 fix #3: continuous 11v11 halves mode | Deferred: a new mode with its own queue/wire and protocol; the defend phases and varied deal give the match feel inside the attacks format |
| R-2 throw-ins | soccer-7 (quick throw-in near the box as a restart variant) |
| R-2 yellow cards for cynical fouls | soccer-4 (event, pop and report count; no sending-offs) |
| §11 performance (zoom redraws, prewarm) | soccer-2 (zoom quantisation), players team (sprite budget/cache), soccer-10 (measured) |
| §12 tests and QA gaps (layout QA, `max-width` media queries) | soccer-1 (route isolation, tighter time test), soccer-2 (layout checks, `.compact` class instead of width queries) |
| J-3 bare final screen and goal ceremony | soccer-6 |

### 4.3 Research recommendations (`research-soccer.md` §0 and §7)

| # | Recommendation | Task or deferral |
|---|---|---|
| 1 | Shot types on one SHOOT button | soccer-9 |
| 2 | Shrink the meter's grip on accuracy (`coneMult` 0.8…1.6) | soccer-3 |
| 3 | Conversion by distance × ~1.6 arcade factor | soccer-3 |
| 4 | Counters the best open-play chance | soccer-5 (per-attack target) |
| 5 | Set pieces by share of goals (weighted deal) | soccer-5 |
| 6 | Counter Chances: the player defends | soccer-8 |
| 7 | Acceleration archetypes | Deferred: B-2 flattening first; archetype curves are another rating lever that could re-create cliffs, and the card icon belongs to players/ut. Revisit after soccer-4 measurements |
| 8 | Skill moves by swipe, star-tier gated, cap 3 | soccer-9 (stars derived in-engine from DRI and position, no new data) |
| 9 | First-time turn-angle penalty (shots and passes) | soccer-3 |
| 10 | Traits ("PlayStyle"-like) | Deferred: needs new per-card data through the data build scripts and UT card-face work (players/packs); protocol-heavy |
| 11 | Roles with familiarity drive runs | Partly soccer-7 (runs by formation slot); familiarity data deferred with traits |
| 12 | Keepers steer parries wide | soccer-1 / soccer-3 |
| 13 | AI defenders don't auto-tackle | soccer-4 |
| 14 | Animation fidelity rules | players team; soccer supplies contact-time and action metadata (soccer-10) |
| 15 | Post-match stats sheet that looks real | soccer-6 |
| 16 | xG on every shot, shot map | soccer-6 (xG in the after-attack readout, shot map on the full-time card) |
| 17 | Dynamic highlights / dynamic stoppage time | Deferred: the seven-attack count is part of the Arcade/wire contract (`TOTAL = 7`); replays by goal type are P2 |
| 18 | Touch settings | soccer-9 (stick size, floating/fixed, auto-switch mode); power-up rate, keep-running-on-release and gestures-only deferred (P2) |
| 19 | UT card face (skill stars, weak foot, archetype, traits, roles), pack odds, foil | Deferred to players/packs/ut (their files) |
| 20 | Protocol bump soccer only | team doc |
| 7.2 | Pass-and-go double tap, swerve passes, through-ball lead by space | Deferred (P2) |
| 7.2 | Lofted/cross error ×1.3 under pressure, ×1.2 at full sprint | soccer-4 |
| 7.3 | Turn-rate caps, first-touch trap error, shielding by PHY | soccer-4 |
| 7.3 | Controlled sprint (close control at partial stick) | soccer-9 |
| 7.5 | Save% by distance, keeper sets, one dive, claims crosses, fewer hopeless rushes | soccer-3 |
| 7.6 | Weighted deal, corner/FK/penalty targets, wall from the 4 tallest | soccer-3 (wall, targets), soccer-5 (deal) |
| 7.6 | Corner target zones + attacker avoidance dash; penalty composure ring | Deferred (P2): the meter already carries penalty timing skill; a second timing UI would conflict |
| 7.8 | Late-match AI fatigue, stamina trait | Deferred (P2, low value in a 7-attack format) |
| 7.10 | Camera presets, replays by goal type | Deferred (P2): one well-tuned camera first |
| 7.10 | Scorebug/GameCast between attacks, commentary, haptics | soccer-6 (running stats on the intro card), soccer-10 (commentary, haptics) |
| 7.11 | Slow-mo pass set-up | Deferred (P2) |
| 7.13 | Rivals ladder, grind limits, promo cadence | ut / packs teams |

## 5. Ordered tasks

Order: enabling work and P0 first, then P1. Engine tasks that change outcomes are marked **Protocol: bump needed** (one bump for the whole branch, done by the lead: soccer draft 2→3, UT soccer 2→3; NBA and NFL unchanged). Render/UI-only tasks need none.

| Order | Id | Title | Priority | Est. | Depends on |
|---|---|---|---|---|---|
| 1 | soccer-1 | Harnesses in the repo, engine rule bugs and quick presentation bugs | P0 | 2.5 h | — |
| 2 | soccer-2 | Portrait camera, action-safe framing and HUD layout | P0 | 3.5 h | soccer-1 |
| 3 | soccer-3 | Shot model, keepers, set pieces and restarts fitted to real xG | P0 | 3 h | soccer-1 |
| 4 | soccer-4 | Defending AI, contact, touch dribbling, fouls and a smooth rating curve | P0 | 3 h | soccer-3 |
| 5 | soccer-5 | Weighted deal, whole-match calibration and an honest difficulty ladder | P0 | 3 h | soccer-3, soccer-4 |
| 6 | soccer-6 | Match shell: pause/quit, rival goals, full-time report and goal moments | P0 | 3 h | soccer-3 (xG), soccer-5 |
| 7 | soccer-7 | Formation-driven set-ups and attack variety | P1 | 3 h | soccer-5 |
| 8 | soccer-8 | Defend phases in solo matches | P1 | 3.5 h | soccer-4, soccer-5, soccer-6, soccer-7 |
| 9 | soccer-9 | Floating stick, sprint on the left thumb, shot types and skill moves | P1 | 3.5 h | soccer-2, soccer-3, soccer-4, soccer-8 |
| 10 | soccer-10 | Juice, atmosphere, animation hooks, then the final QA gate | P1 + gate | 3 h | all |

---

### soccer-1 · Harnesses in the repo, engine rule bugs and quick presentation bugs (P0, enabling)

**Scope:** harness port; R-1; R-2 (parry direction); C-4; J-1; J-3; bend buttons ≥ 44 px; QA isolation; early contracts for other teams.

**Files:** `scripts/soccer/{lib,sim,human,ratings-human,probe,bend,cam}.ts` (new); `src/game/soccer2/engine.ts`; `src/game/soccer2/Soccer2.tsx`; `src/game/soccer2/render.ts` (`burst`/`particles` only, the HUD side); `src/game/soccer2/soccer2.css`; `src/game/soccer2/soccer.test.ts`; `src/game/soccer2/rules.test.ts` (new); `src/lib/sound.ts` (soccer wiring only); `scripts/qa/soccer-lab.mjs`, `scripts/qa/soccer-app.mjs` (isolation); `docs/studio-overhaul/soccer.md` (new team doc).

**Changes**
1. **Harness port.** Copy the six audit scripts to `scripts/soccer/`, rewriting `/home/user/ps-studio/src/...` imports to `../../src/...`. Move the shared parts (real-squad loader for club-seasons with ≥ 14 lines, seeded pair picker, synthetic `player()`/`squad()`, `beeline()`, `setPieceHuman()`, `tally()`) into `scripts/soccer/lib.ts`. Fold `soccer_table.cjs`'s summary into `sim.ts` so one command prints the §2.1 table; JSON dumps only when `SOCCER_OUT=<path>` is set. Run all of them once and record the baseline in the team doc (it must match §2 above within sampling noise).
2. **R-1 frozen ball** (`engine.ts` `step`, `contact`, `keeper`):
   - In `step`, when `ball.flight.kind === 'shot'` (or `'parry'`) and the ball's ground speed is < 3 m/s with `h < 0.3`, or it has bounced twice, convert the flight to `{ kind: 'clear', from: last, to: null }`, clear `a.gkPlan`, and push event `'shot-dead'`. `contact()` then resolves it (keeper collects, a defender clears, an attacker plays on).
   - The attack clock runs for slow "shots": `a.used` advances whenever the ball's speed is < 3 m/s, whatever the flight kind.
   - A set piece left untaken by a person is handed to the autopilot's taker logic after 12 s (`Soccer2` shows a countdown from 5 s), so the 120 s hard stop stays only as a guard.
   - `soccer.test.ts:269`: tighten to `a.t < a.clock + 15` for every autopilot attack.
3. **R-2 parry direction** (`keeperSave`): the "out" branch uses `norm(side * 0.9, -0.35)` (away from the goal line); a parry may go round the post (positive y) only when the ball's x is outside `±(GHALF − 0.3)`, steering it wide of the frame. Restarts and HAN-scaled steering come in soccer-3.
4. **C-4 bend**: add `bendCurl(k: -1|0|1): number` to `engine.ts` (`return -k * 0.75`: a positive curl bends to the ball's left, so "Bend left" is a positive curl) and use it in `Soccer2.tsx`'s BEND handler. The pitch swipe (`-dx/140`) is already right. The arrow in `render.ts` already follows `a.curl`'s sign; verify it points the way the ball will go.
5. **Bend buttons**: `min-height: 44px` in `soccer2.css`; move `.sc2-bend` so it never covers the taker (measured in soccer-2's layout check).
6. **J-1 sounds**: `Soccer2.tsx` uses `loadSamples('pitch')` and `crowd.start(0.24, 'pitch')`. `engine.ts` pushes a render-only `'bounce'` event when the ball lands from flight with |vh| > 1.6 (detected in `step` by comparing the ball's height before and after `stepBall`); `handleEvents` calls `sfx.bounce()`. `sfx.fulltime()` already plays at full time.
7. **J-3 confetti**: `render.ts` `burst(..., 'confetti')` takes the scorer's kit side (`kitOf(body)`), so a rival goal bursts the rival's colours.
8. **QA isolation**: both soccer QA scripts route-abort every non-localhost host except the two font hosts, and add the device presets with `window.__psInsets`.
9. **Contracts for other teams, published now in the team doc** (no code yet):
   - for **players**: the soccer action list and the `Body.anim` metadata shape they can draw from (see soccer-10), so their A-1 work can start in parallel;
   - for **ut**: the `SoccerMatchReport` shape (see soccer-6), so their result sequence can start in parallel;
   - for the **lead**: the first "Protocol bump needed" line.

**Tests (new `rules.test.ts`)**
- A slow shot comes to rest short of goal: within 1 s its flight is no longer `'shot'`; the attack ends within 15 s with a valid letter.
- 300 seeded parries: the parried ball's initial `vy ≤ 0` unless its x is outside `±(GHALF − 0.3)`.
- `bendCurl(-1)` ("Bend left"): mean crossing x − aim x over 40 kicks < −1.5 m; `bendCurl(1)` > +1.5 m; `bendCurl(0)` within ±0.5 m.
- The `'bounce'` event fires on a lofted pass landing, and adding it changes no outcome (the same seed gives the same `end`, `t` and ball position).

**Measurements and targets**
- `probe.ts 3000`: frozen 25 → **0**; attacks longer than clock + 15 s of game time → **0**; parry own-goals (the keeper's parry was the last touch before the ball crossed inside the frame) 65 of 456 goals → **≤ 1% of goals**.
- `bend.ts`: Bend left −1.5 m or further left, Bend right +1.5 m or further right (baseline +3.40 / −3.11, inverted).
- `sim.ts 400 pro`: scorelines stay inside 2.1–2.8 goals and 20–32% draws (fixing parries removes cheap goals; the real refit is soccer-3/5).

**Screenshots:** the free-kick screen with BEND left selected and the arrow (393×852, 320×568); a rival goal's confetti in the shootout ("THEY SCORE").

**Protocol:** bump needed (R-1 and R-2 change attack outcomes and the AI simulations both phones compute). C-4, sounds and confetti alone would not need one.

**Save-compat:** none (no stored state).

**Cross-team:** players and ut (contracts above); lead (protocol line).

**Acceptance:** all soccer2 tests green under `PS_SPORT=soccer` and the default sport; probe targets met; bend test green; QA scripts abort non-localhost requests (count logged, zero page errors); baseline table in the team doc; commit pushed.

---

### soccer-2 · Portrait camera, action-safe framing and HUD layout (P0)

**Scope:** V-1, V-2, V-4, off-screen teammate arrows, name-tag safety, V-3, copy consistency (C-2), `.compact` class instead of width media queries, zoom quantisation for frame pacing.

**Files:** `src/game/soccer2/camera.ts` and `src/game/soccer2/hud.ts` (new, pure, no DOM: camera maths, edge markers, `layoutLabels`); `src/game/soccer2/render.ts` (camera, labels, rings, arrows: HUD sections only); `src/game/soccer2/Soccer2.tsx`; `src/game/soccer2/match.ts` (`SCENARIO_SHORT`, hint copy); `src/game/soccer2/soccer2.css`; `src/game/soccer2/camera.test.ts`, `hud-layout.test.ts` (new); `scripts/soccer/cam.ts`; `scripts/qa/soccer-lab.mjs`.

**Changes**
1. **`camera.ts`** (pure functions over `Attack`, used by `render.ts`, the harness and the tests):
   - `interface SafeBox { top: number; bottom: number; left: number; right: number }` (CSS px): top = the scoreboard and marks' bottom + 8; bottom = the control cluster's top − 8; measured by `Soccer2` from the DOM on resize and on control-layout changes, and passed as `renderer.safe`.
   - `camParams(W, H, zoom)` for portrait: `s = W/28 × zoom` px per metre at the play row (about 14 px/m at 390 instead of 20.5), `pitch` 0.62–0.80 rising with the aspect ratio (height-aware tilt: a taller phone looks down more steeply), `fov` 0.45, `row` and `horizon` solved so the stands and sky above the pitch never take more than 12% of `H`. Landscape keeps today's parameters (it already looks right).
   - `cameraTarget(a, W, H, safe)`: x follows 90% of the ball's offset (was 60%); a look-ahead of the carrier's velocity × 0.6 s (capped at 6 m) plus 3 m toward goal; a framing pass that adjusts the target and the zoom (0.82–1.15) until the carrier, the two best pass options (nearest teammates ahead and wide) and, inside 30 m, the goal mouth all sit in the safe box. Corners: aim at the box from the flag's side with the taker in frame (zoom about 1.0, not 0.68). Penalties: taker, keeper and goal framed with the goal in the upper third.
   - Zoom is quantised to steps of 0.05 and may change at most every 0.25 s, so sprite sizes don't change every frame (the audit's frame-pacing cause).
   - `offscreenMarkers(cam, a, safe)`: each side-A teammate outside the safe box gives an edge marker `{ id, x, y, angle, tag }` (at most 4, clamped to the safe box's edge).
2. **`render.ts`**: `camAt`/`target` call `camera.ts`. Draw the edge markers as teal chevrons with the player's tag (the existing 3×5 font, 10 px tall). The controlled player's name tag moves above his head when its rect would fall under a control rect. Labels go through a small collision pass (`layoutLabels(rects)` in `hud.ts`: later labels stack upward), which fixes "FBENDICK" (FREE KICK over BEND). The yellow control ring and name are drawn only for our side (`kitOf(body) === 'us'`); the rival's penalty taker gets a rival-coloured tag and no ring.
3. **`Soccer2.tsx` / `soccer2.css`**:
   - The tip becomes a bottom toast just above the control cluster (`bottom: calc(var(--sab) + <cluster height + 12>px)`) and is never shown while SHOOT is held or a set-piece meter is up.
   - The scoreboard's middle cell uses `SCENARIO_SHORT` (BUILD-UP, COUNTER, WIDE, CORNER, FREE KICK, PENALTY) with no ellipsis at 320.
   - At 320 the intro card no longer covers name tags: intro names are drawn above the card's top edge, or the card shrinks.
   - The `@media (max-width: 350px), (max-height: 600px)` rules become a `.compact` class that `Soccer2` sets from the measured wrap size (no width media queries in the screen).
   - Copy uses one name per control everywhere (the corner button CROSS · HOLD and its hint "Hold CROSS to whip it in"; free kick "BEND", never "curl" in one place and "bend" in another).

**Tests**
- `camera.test.ts` over every scenario × both mirrors × {390×844, 393×852 with insets 59/34, 320×568}, with the safe box measured from the current control layout:
  - the carrier is inside the safe box at kick-off: 100%;
  - teammates on screen: build ≥ 3/5, counter ≥ 2/3, wide ≥ 3/5, corner ≥ 4/5, free kick 4/4;
  - pitch width visible at the carrier's row in open play: 26–36 m (was 16.9);
  - stands and sky ≤ 12% of `H` in every scenario (corner was 37%);
  - corner taker sprite ≥ 22 px tall with x in [20, W − 20], and the goal fully in frame;
  - carrier sprite ≥ 24 px tall at 390 and ≥ 20 px at 320;
  - goal mouth ≥ 60 px wide at 390 whenever the carrier is inside 30 m;
  - every off-screen teammate has a marker.
- `hud-layout.test.ts`: `layoutLabels` never returns overlapping rects for FREE KICK + BEND + POWER/AUTO at 320, 390 and 430.
- `soccer-lab.mjs` layout part, checked in the browser:
  - the hint's rect never intersects the goal mouth's projected rect or the reticle;
  - no hint while `.hg2-shoot.held`;
  - `.mid small` has `scrollWidth ≤ clientWidth`;
  - every button is ≥ 44 × 44;
  - no control overlaps another at 320×568.

**Measurements:** `cam.ts` before/after table in the team doc. Frame pacing over the lab autopilot match (8 s): at 390×844 4× CPU fps ≥ 58 and p99 ≤ 33.4 ms; at 6× fps ≥ 53 (not worse than the 53.1 baseline despite the wider view).

**Screenshots** (before/after, 393×852 with insets and 320×568, plus 430×932 once): each scenario at kick-off and mid-attack, the wide overload (carrier on screen), a corner, a penalty, the free kick with the meter (no FBENDICK), the shot meter with the hint gone, off-screen arrows, and the rival's penalty taker.

**Protocol:** none (render and UI only; `camera.ts` reads the attack, never writes it).

**Save-compat:** none.

**Cross-team:**
- players: smaller sprites (about 24 px) rely on their small-sprite head boost and sprite cache; tell them about the quantised zoom.
- shell: the `--sat/--sab/--sal/--sar` variables on `.arcade-full` are theirs; read only.
- `pixel/persp.ts` (players) is used through `pcam`/`project` unchanged.

**Acceptance:** camera and layout tests green; browser layout checks pass at all viewports; frame-pacing targets met; screenshots reviewed; owner device check noted (framing on the real phone).

---

### soccer-3 · Shot model, keepers, set pieces and restarts fitted to real xG (P0 realism)

**Scope:** §2.2 conversion by distance; meter grip (research 2); range (C-3 range gate and hold time); pressure, angle, header and first-time (research 9) factors; blocks; keeper save% by distance; parry steering and R-2 restarts (earned corners, goal kicks); B-4; B-5; B-6; the wall from the 4 tallest; `xg.ts`.

**Files:** `src/game/soccer2/engine.ts` (`strikeShot`, `rangeCone`, `coneMult`, `assistAim`, `aimPoint`, `pressShoot`, `releaseShoot`, `keeperSave`, `planKeeper`, `duringFlight`, `SP_TUNE`, `KEEP`, new `setPieceAfterOut`, `fkArrival`); `src/game/soccer2/ratings.ts` (shot and keeper effects only); `src/game/soccer2/autopilot.ts` (`beginShot` uses `a.meter.top`); `src/game/soccer2/xg.ts` (new); `src/game/soccer2/render.ts` (meter label "TOO FAR", reticle at the bend-corrected arrival point); `src/game/soccer2/Soccer2.tsx` (`'corner-won'` and `'goal-kick'` events); tests `xg-bands.test.ts` (new), `shooting.test.ts`, `setpieces.test.ts`.

**Changes**
1. **Execution meter, not a lottery** (research 7.1): `coneMult` goes 0.8 at the green's centre, 1.0 at its edge, 1.3 at two greens, capped at 1.6 (was 0.5…3.2). Timing's main consequence moves to height and power (keep the late-rises / early-weak verbs and `timingWord`).
2. **Range:** `rangeCone(d)` grows exponentially with no cap: ×1 at ≤ 11 m, 1.6 at 16.5 m, 2.4 at 20 m, 3.2 at 25 m, about 4.3 at 30 m. Hold time scales with distance: `meter.top = lerp(0.40, 0.62, (d − 8)/17)` (FC 26's "minimal wind-up" close in). `maxRange(p) = lerp(24, 34, rt(SHO))`; beyond it the meter label reads **TOO FAR** in red.
3. **Context multipliers on the cone:**
   - pressure ×1.35 with a defender within 2 m (was ×1.3 within 1.6 m);
   - ×1.5 when the shot is from wide of the posts inside 12 m;
   - across the body as today;
   - headers ×2 the foot cone beyond 8 m (was ×2.4 everywhere);
   - first time ×1.2 at a 90° turn and ×1.6 at ≥ 135°; the same multiplier on first-time passes in `pass()`.
4. **Blocks:** body block width 0.45 → 0.7 m; a defender within 3 m of the shooting lane at the press of SHOOT steps across it during the wind-up (`blockLunge`, DEF-scaled reach 0.4–1.0 m).
5. **Keeper:**
   - save radius +0.15 m and reaction ×0.85 for shots he sees from ≥ 20 m;
   - one committed dive per shot;
   - fewer hopeless rushes (rush only when he reaches the ball's next touch point first);
   - parries steered wide or out by HAN and position (`Deflector`-style: the outward share is `lerp(0.5, 0.85, rt(HAN))`), never back across the six-yard box unless HAN < 55.
6. **Restarts (R-2):** in `duringFlight`, a ball over the byline off a defender or a keeper's parry calls `setPieceAfterOut(a, 'corner', side)`, which lines up the corner exactly like `setupAttack`'s corner (refactored into a shared `cornerLayout(a, side)`), pushes `'corner-won'`, and is limited to `a.restarts ≤ 2` per attack. A ball over the byline off an attacker ends the attack `'W'` with the text "GOAL KICK" (the keeper places the ball in `settle`).
7. **B-4 aim:** a full manual drag lands `manualMargin = assistMargin(SHO, d)` inside the post (the same range/SHO margin the assist uses, instead of the fixed 0.85 × `AIM_X`); the assist aims at 70% of that reach (conservative).
8. **B-5 free kicks:**
   - `SP_TUNE.fkCone` 3.0 → about 1.5;
   - the wall is the 4 tallest outfield players;
   - `fkArrival(a, aim, curl)` traces the would-be path with the curl and dip (deterministic, no RNG) and the reticle sits where the ball will actually arrive;
   - the meter's release height controls dip versus height.
9. **B-6 penalties:** penalty green ×0.85 and cone ×1.1, so a PERFECT low corner is about 85% and an ordinary GOOD release about 70%; keeper read unchanged (36–50% + `penRead`).
10. **`xg.ts`:** `xgOf({ dist, angle, head, pattern: 'open'|'counter'|'corner'|'fk'|'pen', firstTime, pressured })` from research §6.2 (foot and head columns by yard band, central vs wide factor, pen 0.76, direct FK 0.05–0.09). Used by the band test and by soccer-6's report. Display only: it never feeds the simulation.

**Tests**
- `xg-bands.test.ts`, seeded drills with the autopilot release model (sd 0.04–0.06 s) on 75-rated sides, each band n ≥ 150, ≤ 20 s:
  - conversion 0–6 m 35–55%, 6–11 m 18–32%, 11–16.5 m 8–15%, 16.5–22 m 4–8%, 22–30 m 1.5–4%, 30 m+ ≤ 1.5%; monotone;
  - headers from crosses at 8–10 yd 10–18%;
  - a manual corner drag from 16–20 m beats the assist by ≥ 5 points, and the assist is ≥ 70% of the manual rate.
- `shooting.test.ts`: update the `coneMult(0)` assertion (0.8) and the 1v1 assist bounds (0.25–0.55); the monotonicity, SHO, keeper and pass tests stay.
- `setpieces.test.ts`: corners 8–12% per attack, free-kick attacks 10–14% with direct free kicks 6–11% per shot, penalties 72–80%.
- `rules.test.ts`: a parry over the byline gives a corner set piece in the same attack; ≤ 2 restarts per attack; a ball off an attacker over the byline ends `'W'` with "GOAL KICK".

**Measurements** (`audit_soccer_shots.ts 200`, research §8 targets):
- 1v1 12–16 m with the keeper set, average finisher: 35–45% (was 62%);
- SHO 95 vs GK 75: 50–58%; SHO 75 vs GK 93: 25–32%;
- clean edge of the box 18–21 m, SHO 75: 12–18% (was 38–44%);
- 25–30 m, SHO 75: 3–5%; SHO 95: 6–9%.

`human.ts`:
- beeline SHOOT @30 m ≤ 3% in every scenario (was 9.5–22.5%);
- free kick "far corner + correct bend" (skilled) 6–9%, careless (no aim) 1–4%;
- penalties: low corner 80–88%, centre ≤ 40%.

`sim.ts 400 pro` (interim; the final fit is soccer-5): conversion by band inside the test bands, on target 32–42%, blocked ≥ 18%, save% 64–72%, woodwork 2–4%.

**Screenshots:** the meter at 30 m showing TOO FAR; the free-kick reticle at the bend-corrected point (left and right bend); an earned corner after a parry ("CORNER" pop); the corner layout.

**Protocol:** bump needed (shot outcomes, keeper, set pieces, restarts, agreed shootout).

**Save-compat:** none.

**Cross-team:** none (the players team may later use `ShotInfo.kind` for kick animations; see soccer-10).

**Acceptance:** all band, set-piece and drill targets inside range; preserved tests green; the before/after tables in the team doc.

---

### soccer-4 · Defending AI, contact, touch dribbling, fouls and a smooth rating curve (P0)

**Scope:** B-1, R-3, AI-2, B-2; "sprinting costs control and touch"; research 7.2 (cross error under pressure/sprint) and 7.3 (turn caps, first-touch trap error, shielding); AI defenders don't auto-tackle (research 13); yellow cards (event only).

**Files:** `src/game/soccer2/engine.ts` (`defend`, `tackles`, `separate`, `human`, the ball-at-feet block in `step`, `contact` first touch, `setPieceAfterFoul`); `src/game/soccer2/ratings.ts` (`tackleWin`, `dribblePace`, new `touchOf`, `turnRate`); `src/game/soccer2/types.ts` (`Act` adds `'poke' | 'block' | 'jockey' | 'getup'`; `Attack.touch?`, `Attack.yellows?`); `src/game/soccer2/autopilot.ts` (dribble decisions use the touch model); `src/game/soccer2/render.ts` (≤ 10-line routing of the new acts to existing clips: `getup` → `getup_front` if loaded else `fall_forward` reversed, `jockey` → `backpedal`/`shuffle`, `poke`/`block` → `ready`; a players-owned section, listed as touched outside the lane); `scripts/soccer/lib.ts` (the `skilled` strategy); `src/game/soccer2/balance.test.ts` (new).

**Changes**
1. **Lane-blocking press (AI-2):** the first presser goes goal-side onto the carrier–goal line at a jockey distance `lerp(2.5, 1.5, rt(DEF))`, slowing to 80% pace inside 4 m and facing the ball (act `'jockey'`; its facing points at the ball, which is safe because a defender's facing never feeds the simulation). Inside 22 m the second defender covers the shooting lane 3–5 m ahead of the carrier. A beaten defender gets a recovery sprint after `stunUntil`.
2. **Tackles on timing and angle, not proximity:**
   - a standing tackle may start only when the ball is exposed (the carrier's touch has knocked it > 0.6 m ahead, or he turns > 60°), after the defender's read delay, with a visible 0.25 s wind-up (act `'poke'`);
   - its success is `tackleWin` × angle (front 1.0, side 0.85, behind 0.6) × exposure;
   - a miss stuns `lerp(0.95, 0.6, rt(DEF))`;
   - AI defenders never auto-tackle a dribbler who merely comes close.
3. **Touch dribbling:** the ball leaves the feet. Every 2–4 strides the carrier knocks it `touchOf(p, speed)` ahead: 0.5 m at a jog up to 1.2–2.5 m at full sprint, shorter with higher DRI, ×1.3 at sprint. Between touches the ball rolls (the `Attack.touch = { next, out }` state) and is winnable by a poke (`interceptReach` vs DRI). The heading change with the ball is capped at `turnRate(p, speed)` (540°/s at a jog, 240°/s at a sprint, DRI- and height-scaled).
4. **Contact:** a carrier running into a defender's body within 0.9 m in front loses pace (×0.6–0.85 by PHY difference); shoulder-to-shoulder duels resolve by PHY; holding the stick back toward his own goal with a defender within 1.5 m shields (PHY difference). `separate()` stays as the overlap guard.
5. **Sprint cost:** besides the heavier touch, lofted/cross error ×1.2 at full sprint and ×1.3 under pressure; the first-touch trap error ∝ ball speed × (1 − DRI factor) × 1.3 sprinting × 1.4 when turning > 90° (research 7.3).
6. **Fouls (R-3):** base foul probability halved: `clamp(0.02 + 0.11·(1 − rt(DEF)) + (behind ? 0.10 : 0) + 0.04·rt(DRI) − 0.05·defIQ, 0.015, 0.2)`. In the box a frontal mistimed tackle is a foul half as often (penalties come mainly from behind or the side). A foul from behind on a breakaway is a yellow card (event `'yellow'`, pop "YELLOW · <tag>", counted for the report; no sending-offs).
7. **B-2 smooth curve:** `tackleWin`'s logistic scale 11 → 20, bounded 0.15–0.85. DRI buys options (shorter touches, tighter turns, a later poke window) instead of tackle immunity. PAC chase effects unchanged.
8. **`skilled` strategy** in `scripts/soccer/lib.ts`: carry at jog/sprint; when a defender is within 3 m ahead, play `pass(..., free=true)` to the most open teammate further forward; shoot only inside 16 m with a clear lane, dragged to the open side; release sd 0.05 s.

**Tests (`balance.test.ts`, n = 120 per row, real club pairs, ≤ 25 s)**
- For counter, build and wide: every no-skill beeline row (sprint and jog; SHOOT at 12/16/20 m; assist) scores ≤ 1.35× the Pro autopilot (0.68) on the same attacks.
- Beeline penalty won ≤ 4% of attacks, free kick won ≤ 9% (test tolerance; the harness target is tighter, below).
- `skilled` ≥ the best no-skill row + 4 points in counter and build.
- Rating gradient (counter beeline 16 m vs 78 defence): monotone 60→99, with 60 ≥ 3% and 99 ≤ 60%.
- `tackleWin` at a 10-point gap is between 0.55 and 0.75 (the curve is no longer a cliff).

**Measurements**
- `human.ts 200` at Pro (defIQ 0): every no-skill row ≤ 1.3× the Pro autopilot (baseline counter @16 m 58.5% vs 20% = 2.9×); penalty won ≤ 3% and free kick won ≤ 8% per beeline row (baseline up to 15.5% / 28%); `skilled` ≥ best no-skill row + 5 points in counter and build.
- `ratings-human.ts 300`: counter beeline at 60/70/80/90/99 vs 78 → about 3–12 / 8–20 / 15–30 / 22–40 / 30–55% (baseline 0.7 / 1.7 / 32.7 / 92.3 / 99.3); no adjacent 10-point step more than ×2.5; the autopilot's 60→99 gap stays ≥ 15 points.
- `sim.ts 400 pro`: penalties awarded 0.1–0.3 per side per match; attack-end mix logged (tackles and pokes must show up as "TACKLED/POKED AWAY" rather than all interceptions).

**Screenshots:** a defender jockeying goal-side (facing the ball), a poke tackle, a yellow-card pop, a heavy sprint touch with the ball ahead of the runner.

**Protocol:** bump needed (tackles, fouls, ratings used in matches, AI simulations).

**Save-compat:** none.

**Cross-team:**
- players: new acts `'poke' | 'block' | 'jockey' | 'getup'` and their minimal routing in `render.ts`'s player section (listed under "Touched outside my lane"); they replace the routing with proper clips.
- nba/nfl: none.

**Acceptance:** `balance.test.ts` green; harness targets met and tabled; the existing determinism/finite/idle tests green.

---

### soccer-5 · Weighted deal, whole-match calibration and an honest difficulty ladder (P0 realism)

**Scope:** whole-match realism (§2.1 targets, research §6 and §8), the weighted deal (research 5, 7.6; first half of S-1 "varied situations"), counters as the best open-play chance (research 4), AI shot appetite and THRU into space (AI-1), B-3, the seeded realism test suite.

**Files:** `src/game/soccer2/match.ts` (`dealOf` weighted); `src/game/soccer2/autopilot.ts` (`shotOn` long-shot appetite, THRU into space, `Pilot.iq` attack sharpness); `src/game/soccer2/arcade.ts` (`aiProgress(..., role)`, ladder constants); `src/game/soccer2/engine.ts` (small tuning only); `src/game/Arcade.tsx` (1-line hunk in the soccer branch of `aiPlay`); `src/ut/Match.tsx` (1-line hunk in `simBoth`'s soccer branch); `src/game/soccer2/realism.test.ts` (new); `soccer.test.ts:289` (deal assertion); `scripts/soccer/sim.ts` (a `ladder` part).

**Changes**
1. **Weighted deal:** `dealOf` draws each of the six regular attacks from build 32%, counter 22%, wide 22%, corner 15%, free kick 9% (seeded; zero or three corners in a match are possible; at most two set pieces dealt). Stoppage time stays a counter or a wide overload. Earned corners (soccer-3) add to the set-piece share.
2. **Shot volume and conversion:**
   - the autopilot takes long shots from 20–28 m when the lane is clear, with probability by SHO and skill;
   - blocked shots stay live (loose ball) instead of ending the attack;
   - parries back into play give second balls;
   - the autopilot plays THRU into space for a runner and switches play wide when the near side is crowded.

   Tune until the targets below hold.
3. **B-3 ladder:** `aiProgress(attack, defense, seed, skill, defIQ, role: 'rival' | 'mine' = 'mine')`.
   - For `'rival'`, the defence it attacks (your eleven, AI-controlled) plays at a fixed `OWN_DEF_IQ = 0`, and the difficulty maps to the AI's attack: `pilot(skill, seed, iq = defIQ)` (release spread ×(1 − 0.3·iq), read time ×(1 − 0.25·iq), better shot selection).
   - `'mine'` (your attacks simmed against the AI's defence) is unchanged: defIQ sharpens their defence.
   - `Arcade.tsx`'s soccer branch of `aiPlay` passes `rival ? 'rival' : 'mine'`; `ut/Match.tsx` `simBoth` passes `'rival'` for the rival's side.

**Tests (`realism.test.ts`, 120 Pro matches on real pairs, ≤ 30 s; wider tolerances than the harness)**
- goals/match 2.0–3.1;
- draws 15–35%;
- shots per side ≥ 8;
- on target 28–44%;
- goals/shot 8–16%;
- blocked ≥ 16%;
- 22 m+ band conversion ≤ 5%;
- set-piece share of goals (excluding penalties) 8–28%;
- ladder (60 matches per level vs a fixed 75 reference defence): AI goals Rookie < Pro < Legend, Legend ≥ 1.3× Rookie.

`soccer.test.ts:289` asserts the deal's weights over 2,000 seeds (each within ±3 points of its weight) instead of "every kind once".

**Measurements** (`sim.ts 400 <level>`; targets for the harness, tighter than the test):

| Metric | Baseline (Pro) | Target |
|---|---|---|
| Goals per match | 2.33 | 2.3–2.8 |
| Draws | 26.8% | 22–29% |
| 0–0 | 7.8% | 4–10% |
| Better side (ΔOVR ≥ 8) W/D/L | 69/24/7 | 60–72 / 18–28 / 7–15 |
| Shots per side (played attacks) | 5.21 | 9–13 |
| On target | 53.7% | 32–40% |
| Goals per shot | 20.4% | 9–14% |
| Keeper save % of on-target | 61.9% | 64–72% |
| Blocked | 11.3% | 20–30% |
| Woodwork | 4.2% | 2–4% |
| Shots from 22 m+ | 3.3% | ≥ 10% |
| Headers | 18.3% | 8–14% |
| Penalties (n ≥ 300 via `setpieces.test.ts`) | 93% (n=43) | 74–78% |
| Direct FK per shot | 2.3% | 6–11% |
| Per attack: build / counter / wide | 21.6 / 19.4 / 18.9% | 15–21 / 19–28 (counter ≥ build + 2) / 14–20% |
| Corner / FK attack | 5.4 / 10.6% | 8–12 / 10–14% |
| Set-piece share of goals (excl. pens) | about 32% | 12–22% |
| AI goals per side Rookie / Pro / Legend (vs fixed reference defence) | 1.17 / 1.17 / 0.99 | 0.8–1.0 / 1.1–1.35 / 1.45–1.8, monotone |
| `skilled` proxy win% over 200 full matches (rival by the ladder) | — | Rookie 60–85%, Pro 40–60%, Legend 20–45%, monotone |

Re-run `human.ts` and `ratings-human.ts`: soccer-4's targets must still hold.

**Screenshots:** none needed (engine and calibration). The team doc gets the before/after tables.

**Protocol:** bump needed (deal, AI simulations, ladder mapping used in takeovers and sims on both phones).

**Save-compat:** none.

**Cross-team:**
- `Arcade.tsx` (nba/nfl shared): one-line soccer-branch hunk.
- `ut/Match.tsx` (ut shared): one-line soccer-branch hunk.
- Both listed under "Touched outside my lane".

**Acceptance:** `realism.test.ts` green; every harness target met or the deviation explained in the team doc with a measured reason; soccer-3/4 tests still green.

---

### soccer-6 · Match shell: pause/quit, rival goals, full-time report and goal moments (P0)

**Scope:**
- C-5 pause and quit;
- S-1's minimum: rival goals announced;
- the result screen (scoreline, scorers, POTM, a draw reads DRAW) and the data contract for ut;
- J-3's bare final screen and goal ceremony;
- research 15/16 stats sheet, xG and shot map;
- research 7.10 running stats between attacks.

**Files:**
- `src/game/soccer2/report.ts` (new, pure);
- `src/game/soccer2/FullTime.tsx` and `src/game/soccer2/soccer2-shell.css` (new);
- `src/game/soccer2/Soccer2.tsx`;
- `src/game/soccer2/engine.ts` (render/report-only logging: `Attack.log`);
- `src/game/soccer2/match.ts` (`AttackLog` capture in `recordAttack`; `aiAttacksOf` returns `detail`);
- `src/game/soccer2/arcade.ts` (re-export `FullTime`, `buildReport`);
- `src/game/Arcade.tsx` (soccer-branch hunk ≤ 10 lines: `onReport` passthrough, the full-time hold, `onQuit`);
- tests `report.test.ts`, `shell.test.ts` (new).

**Data shapes (`report.ts`)**
```ts
export interface ShotLog { side: 'us' | 'them'; by: string; tag: string; min: number; x: number; y: number; dist: number; xg: number; kind: string; res: 'G' | 'S' | 'W' | 'B' | 'P'; assist?: string; played: boolean }
export interface AttackLog { i: number; side: 'us' | 'them'; scenario: Scenario; min: string; end: AttackEnd; text: string; shots: ShotLog[]; scorer?: { id: string; tag: string; name: string }; assist?: { id: string; tag: string; name: string }; pen?: boolean; corners: number; fouls: number; yellows: number; passes: number; tackles: number; saves: number }
export interface TeamBox { name: string; goals: number; shots: number; onTarget: number; blocked: number; xg: number; possession: number; passes: number; passAcc: number; corners: number; fouls: number; yellows: number; offsides: number; saves: number }
export interface PlayerMark { id: string; name: string; tag: string; pos: SoccerPos; side: 'us' | 'them'; rating: number; goals: number; assists: number }
export interface SoccerMatchReport {
  v: 1; seed: string; outcome: 'W' | 'D' | 'L';
  score: { us: number; them: number }; pens?: { us: number; them: number; won: boolean };
  us: TeamBox; them: TeamBox;
  goals: { side: 'us' | 'them'; min: string; tag: string; name: string; assist?: string; pen?: boolean }[];
  shots: ShotLog[]; potm: PlayerMark; ratings: PlayerMark[];
  /** online the wire carries only the rival's attack letters: their goals are listed by minute without names */
  rivalDetail: 'full' | 'goals-only';
}
```
`buildReport(match, myLogs, rival: { logs?: AttackLog[]; ends: string[] }, seed, pens?)`:
- played attacks give the real shots, xG (`xg.ts`), assists, corners, fouls, yellows, saves and tackles;
- the unplayed minutes are filled from `rng(hashString('box:' + seed))` with research 7.12's distributions, so team shots land 8–18 (mean 12–13), on target 34% ± 8, blocked about 25%, possession `50 ± 1.2 × ΔOVR` clamped 30–70, passes `900 × share`, accuracy 75–90% by PAS, corners Poisson(5.4), fouls Poisson(11), yellows Poisson(2.1), offsides Poisson(1.8);
- clamps: goals ≤ on target ≤ shots, and xG ≥ 0.1 per goal-less shot;
- player ratings: 6.5 + 1.0 per goal + 0.6 per assist + 0.3 per key pass or tackle won − 0.5 per error leading to a goal, keepers + 0.3 per save, clamped 6.0–10.0;
- POTM is the top rating (tie → the winning side, then the scorer).

This is display only; it never feeds the simulation.

**Changes**
1. **Engine logging:** `Attack.log` collects shots (with assist = the last teammate pass's `from`), passes, tackles, corners, fouls, yellows and saves. It is filled in `launchPass`, `launchShot`, `endAttack`, `keeperSave` and `tackles`; it never reads `a.rand`.
2. **Rival detail:** `aiAttacksOf` also returns `detail: AttackLog[]` (additive; `Progress` consumers ignore it). In solo, Arcade passes it to `Soccer2` as `rivalDetail`.
3. **Rival goals announced:** when the rival's score rises, a pop "<RIVAL> SCORE · 34' · RODRIGO" (name only when detail is known), `sfx.scoreThem()`, and a scoreboard pulse.
4. **Between attacks:** the intro card shows running shots (on target) and xG for both sides. After each shot the readout shows its xG ("xG 0.12").
5. **Goal moment:** a scorer plate slides in (name, position, OVR, "1st goal", assist by …) for 1.6 s; reduced motion → no slide, just shown.
6. **Pause (C-5):**
   - a 44 × 44 pause button in the top-left safe area, below the status bar, clear of the Dynamic Island and the scoreboard (checked at 320/393/430);
   - it opens a sheet with RESUME, HOW TO PLAY (the controls card) and QUIT MATCH (solo) / FORFEIT (online), each with a confirm;
   - while paused the loop's accumulator stops, input is cleared and timers for the next attack hold;
   - online, your own attacks pause (the rival plays on) and the sheet says so;
   - sound/haptics toggles stay in the app's Settings (`App.tsx` owns `setFeedback` persistence).
7. **Quit:** `Soccer2` gets `onQuit?: () => void`.
   - If Arcade provides a quit/forfeit path (nba/nfl own Arcade's pause work), it is used.
   - Otherwise soccer's fallback records your remaining attacks as `'T'` (no goal) and finishes, with the confirm text saying exactly that.
   - A true online forfeit (a loss whatever the score) needs an agreed wire code, raised for the lead in the team doc.
8. **Full time (`FullTime.tsx`):**
   - scoreline YOU x–y RIVAL and a result word WIN / DRAW / LOSS (a level match reads "DRAW · WON 4–3 ON PENALTIES" after a shootout);
   - scorers by side with minute, assist and PEN marker;
   - a stats table (shots, on target, xG, possession, corners, fouls, saves, yellows);
   - a shot map (SVG half-pitch, dots by xG, goals filled);
   - the POTM plate (the players team's portrait component when it lands; until then a name/position/rating plate);
   - a CONTINUE button, and the existing wait line while the rival plays on.
9. **Arcade hunk (soccer branch only):** pass `onReport` up through a new optional `onSoccerReport?: (r: SoccerMatchReport) => void` prop. Hold the soccer `onFinish` until FullTime's CONTINUE or 10 s (immediately with `autoplay`), so the card is read instead of flashing for 1.6 s. The wire (`onProgress`) is unchanged, so online timing is unaffected.

**Tests**
- `report.test.ts`: deterministic for a seed; goals ≤ on target ≤ shots; team shots in 8–18 over 500 seeds with mean 11–14; xG ≥ 0.1 per goal-less shot; ratings in 6.0–10.0; POTM rules; a level score gives `outcome 'D'` even with pens; online (`ends` only) gives `rivalDetail 'goals-only'` with minutes.
- `shell.test.ts`: logging consumes no RNG (the same seed gives the same ends and `t` with and without reading the log).
- Browser (`soccer-lab.mjs` part `shell`):
  - pause stops `a.t` advancing for 3 s;
  - resume continues;
  - quit with confirm finishes the match with `'T'` for the rest;
  - the pause button doesn't overlap the scoreboard, marks or hint at 320/393/430;
  - the full-time card renders scorers and the POTM;
  - CONTINUE fires.

**Screenshots:** the pause sheet (393×852 with Dynamic Island insets, 320×568), a rival-goal pop, the intro card with running stats, the goal-moment plate, the full-time card for a win, a draw with penalties and a loss, and the online "goals-only" variant.

**Protocol:** none (presentation and display-only data; the forfeit fallback uses existing end letters).

**Save-compat:** none (nothing stored).

**Cross-team:**
- ut: consumes `SoccerMatchReport` via `onSoccerReport` in their result sequence and draft results (they own `Match.tsx` result and `src/ui/Results.tsx`); the contract was published in soccer-1.
- nba/nfl: share the `Arcade.tsx` pause/quit contract; soccer adopts theirs if present.
- players: portrait component for the POTM.
- lead: the online forfeit wire code question.

**Acceptance:** tests green; browser checks pass; screenshots reviewed; the contract section in the team doc updated with the final shape.

---

### soccer-7 · Formation-driven set-ups and attack variety (P1)

**Scope:**
- U-1: the formation and all 11 cards matter;
- S-1's varied situations: build-up from the back, counters, wing play and set pieces, as template variants;
- R-2 throw-ins near the box;
- AI-1 team styles from squad stats;
- a golden test guarding later render-only work.

**Files:**
- `src/game/soccer2/types.ts` (`Squad.shape?: '433' | '442' | '4231' | '352'`, `Squad.slots?: Record<string, SoccerPlayer>`);
- `src/game/soccer2/ratings.ts` (`squadFrom` keeps the tuples as a compatibility view and adds `shape`/`slots`);
- `src/game/soccer2/arcade.ts` (`CardForPitch.slot?: string`; `cardSquad` infers the shape from slot ids);
- `src/game/soccer2/setups.ts` (new: data-driven templates);
- `src/game/soccer2/engine.ts` (`setupAttack` reads templates; y clamp lowered for build-from-the-back; throw-in restart);
- `src/game/soccer2/autopilot.ts` (team style);
- `src/ut/teams.ts` (1-line hunk: `pitchCardsOf` adds `slot` to each card);
- tests `formation.test.ts`, `golden.test.ts` (new).

**Changes**
1. **Shape from slots:** LST/RST + LM/RM → 4-4-2; LDM/RDM/CAM → 4-2-3-1; LWB/RWB + CB → 3-5-2; otherwise 4-3-3 (drafted elevens stay 4-3-3). The slot ids are on the wire already, so both phones build the same shape.
2. **`setups.ts`:** `ATTACK[shape][scenario][variant]` and `DEFENCE[shape][scenario]` as lists of `{ slot, x, y, vy? }`, mirrored by the seed. Who appears:
   - 4-4-2 build-up: both strikers plus the wide midfielders;
   - 3-5-2 wide overload: the wing-back high, overlapping;
   - 4-2-3-1: the CAM between the lines;
   - defending shapes: 4-4-2 holds two banks of four, 3-5-2 three centre-backs with wing-backs dropping, a 4-3-3 high press.

   Every outfield card appears as attacker or defender across a dealt match; the keeper now plays in your defensive phases (soccer-8) and shootouts.
3. **Variants per scenario** (2–3 each, seeded):
   - build: from the halfway line, from the back (keeper/centre-back start, y about 25), and a "turnover high up" press win at y about 70;
   - counter: a 3-on-2 and a 2-on-1 with a recovering full-back;
   - wide: overlap and underlap;
   - corner: a near-post and a far-post set-up, plus a short corner;
   - free kick: an edge-of-box direct one and a wide crossed one.
4. **Throw-ins:** a ball over the touchline off a defender with y > 75 becomes a quick throw-in to the nearest attacker (`setPieceAfterOut(a, 'throw')`: a short lofted pass from h = 2.0 m; counts toward `a.restarts ≤ 2`). Off an attacker it ends `'L'` "THROW-IN · THEIRS".
5. **Team style (AI-1):** the style comes from squad stats.
   - possession: mean PAS and DRI high, giving more build-up passes;
   - direct: PAC and PHY high, more THRU balls and long shots;
   - wing play: W and FB DRI/PAS high, more crosses.

   It adjusts the autopilot's option weights within ±15%. The deal weights are not changed.
6. **`golden.test.ts`:** a hash of 60 seeded autopilot attacks (ends, `t`, ball position) across scenarios and shapes. Later tasks that must not change autopilot outcomes (soccer-8's solo additions, soccer-10's render work) keep it green; soccer-9 updates it only with a written reason.

**Tests (`formation.test.ts`)**
- Each of the four shapes builds from real UT-style slot sets.
- Over 200 dealt matches, every outfield slot appears in ≥ 1 attack or defensive set-up per match on average.
- 4-4-2 build-ups field two strikers; 3-5-2 wide overloads start with the wing-back.
- Variants are seeded and deterministic.
- Throw-in restarts stay ≤ 2 per attack.
- `realism.test.ts` stays green with shapes mixed: per-shape goals/match within ±0.3 of the 4-3-3 baseline, so no formation is a free win.

**Measurements:** `sim.ts 400 pro` with random shapes: the soccer-5 table still holds. Per-shape goals for/against and the share of attacks where each slot touches the ball are recorded in the team doc.

**Screenshots:** build-up from the back, a 4-4-2 build-up with two strikers, a 3-5-2 wing-back overlap, a short corner, a throw-in near the box.

**Protocol:** bump needed (formation-dependent set-ups and deal variants change outcomes).

**Save-compat:** none (`slot` is derived at match time; nothing stored).

**Cross-team:** `ut/teams.ts` 1-line hunk (no owner listed; under "Touched outside my lane"); ut's formation screen unchanged.

**Acceptance:** tests green; calibration targets still met; golden test in place.

---

### soccer-8 · Defend phases in solo matches (P1)

**Scope:** S-1 defending:
- you control the nearest defender: switch, jockey/contain, tackle, slide timing, and the keeper on one-on-ones;
- the rival's attacks are interleaved and visible, and their goals come from those phases;
- Auto-defend;
- online keeps the simultaneous format;
- teammate contain (research 7.4).

**Files:**
- `src/game/soccer2/engine.ts`:
  - `Attack.human?: 'A' | 'D'`;
  - `Attack.dctl?: { id: number; stick: Pt; contain: boolean; slideDir?: Pt; queued?: 'tackle' | 'slide' | 'rush' }`;
  - functions `setDefStick`, `defContain`, `defTackle`, `defSlide`, `defSwitch`, `keeperRush`;
  - a `humanDefender()` brain branch in `step`;
- `src/game/soccer2/match.ts` (rival schedule: the rival's seven attacks dealt from `'ai:' + seed`, each resolved on the engine when it is reached);
- `src/game/soccer2/Soccer2.tsx` (interleaved flow, the defence control set, Auto-defend highlights with SKIP);
- `src/game/soccer2/prefs.ts` (new: device-local preferences);
- `src/game/soccer2/render.ts` (HUD for the controlled defender: ring, the switch target);
- `src/game/Arcade.tsx` (soccer-branch hunk ≤ 12 lines: pass `rivalSkill`, take `onRival`; in solo soccer `them` and `shown` come from it);
- tests `defend.test.ts`, `prefs.test.ts` (new).

**Changes**
1. **Engine.**
   - In a defend phase `setupAttack(scenario, them, us, seed, { defIQ: OWN_DEF_IQ, human: 'D' })`: the rival attacks with the autopilot at the ladder's skill and iq (soccer-5), and the stick drives `dctl.id`.
   - **Contain** (hold): backpedal at 80% pace facing the ball, auto-positioned goal-side on the carrier–goal line at 1.5–2.5 m.
   - **Tackle** (tap): a standing tackle through soccer-4's model (timing, exposure, angle, a foul from behind, a 0.25 s wind-up).
   - **Slide** (swipe on the pitch): 2.5 m along the swipe; it wins the ball by DEF and timing against the exposed ball; a miss puts him down for 1.0 s with a get-up; hitting the man first is a foul (a penalty for them in the box).
   - **Switch** (tap SWITCH or tap a player): to the defender nearest the ball's path (by `meetPoint`), never to one who can't reach a loose ball first.
   - **Auto-switch** modes off / cross-only (default) / on.
   - **Keeper RUSH** appears on a one-on-one: a tap sends the keeper out, and smother odds are better when timed at the carrier's touch (ball > 1 m ahead).
   - **Teammate contain:** AI defenders keep 3–4 m off the carrier and only tackle with the visible wind-up while you control the presser.
   - A phase ends when your side wins the ball, the attack ends, or 20 s of open play pass.
2. **Flow (solo only; `online` → unchanged):**
   - your attack i, then the rival's attack i;
   - defend mode from `prefs`: `'key'` (default: you defend counters, wide overloads and stoppage time; the rest are auto-defended and shown as a 4–6 s highlight with SKIP), `'all'`, or `'auto'` (all auto, watchable, skippable);
   - skipping fast-forwards the same deterministic simulation, so the result is identical;
   - the rival's score and goals (with scorer names) now come from these phases;
   - `Soccer2` reports `onRival(progress)` to Arcade;
   - `autoplayHook` → all auto.
3. **UI:** in defence the right cluster becomes TACKLE (tap) / CONTAIN (hold) / SWITCH, the same positions and sizes as PASS/SHOOT/THRU (≥ 44 px, ≥ 8 px apart). The intro card says "DEFEND · COUNTER" with a one-line hint; kits swap as in the shootout.
4. **`prefs.ts`:** device-local key `perfect-season:soccer-prefs:v1` (new, additive; JSON read and written in try/catch; defaults when missing or corrupt; unknown fields kept). Fields now: `defend: 'key' | 'all' | 'auto'`, `autoSwitch: 'off' | 'cross' | 'on'`; soccer-9 adds control fields. It stays out of cloud saves and checkpoints (a device preference, like Football2's played counter).

**Tests (`defend.test.ts`, n = 200 per row, scripted defender proxies through the new API, Pro)**
- An idle human (no input; AI teammates defend) concedes ≥ the auto-defend rate + 3 points (no "do nothing" exploit).
- A scripted good defender (contain goal-side at 2 m, tackle when the ball is exposed) concedes ≤ the auto-defend rate − 3 points.
- Tackle spam (tap every 0.3 s within 2 m) concedes ≥ good + 5 points and fouls ≥ 2× good.
- A slide from behind in the box that misses the ball gives a penalty ≥ 50% of the time.
- Auto-switch picks the defender with the earliest meet point on ≥ 90% of crosses and never switches to one who can't reach a loose ball first.
- A timed keeper rush smothers ≥ 1.5× an untimed one.
- With `human` unset, `golden.test.ts` is unchanged (autopilot outcomes untouched).
- An online-flagged match never builds a defend phase.

`prefs.test.ts`: absent, garbage and old-shape values give defaults; a round trip keeps unknown fields.

**Measurements:**
- solo match length with `'key'` mode (lab, real time): median 3.0–5.0 min (record);
- the share of the rival's goals that came from played or watched phases: 100%;
- Squad Battles ladder re-check with the `skilled` attack proxy plus the good-defender proxy: win% still Rookie > Pro > Legend.

**Screenshots:** a defend-phase intro, contain/jockey, a slide tackle, the SWITCH target ring, keeper RUSH on a one-on-one, an auto-defended highlight with SKIP, the defence control cluster at 320×568.

**Protocol:** no extra bump (solo only, and autopilot paths unchanged as the golden test proves); covered by the branch's single soccer bump anyway.

**Save-compat:** the new device-local key only; no profile, UT or recovery change; test for absent/corrupt values.

**Cross-team:**
- `Arcade.tsx` soccer-branch hunk (nba/nfl shared).
- ut: Squad Battles/Cups/Circuit solo matches now include defend phases (their pre-match screen M13 may mention "you defend their key chances").
- players: acts `'jockey'`, `'getup'`, `'slide'` (the slide tackle; `'dive'` stays the keeper's).

**Acceptance:** defend tests green; golden green; solo flow verified in the browser (touch) at 393×852 and 320×568; online flow still simultaneous (the `soccer-app.mjs` H2H part with two contexts against the local relay).

---

### soccer-9 · Floating stick, sprint on the left thumb, shot types and skill moves (P1)

**Scope:**
- C-1: a floating joystick and sprint on the left thumb (push past the ring), one-thumb freedom on the right;
- C-3: shot types (finesse, chip, low driven, power) by gesture on SHOOT, keeping drag-to-aim and the timing meter;
- skill moves (≥ 3) as swipes, star-gated and capped at 3 in a row;
- close control at partial stick (the controlled sprint);
- touch settings;
- the Arcade kick-off copy.

**Files:**
- `src/game/soccer2/gestures.ts` (new, pure classifiers);
- `src/game/soccer2/Soccer2.tsx`;
- `src/game/soccer2/soccer2.css`;
- `src/game/soccer2/engine.ts`:
  - `releaseShoot(a, aim, lag, kind?: ShotType)`;
  - per-type strike parameters;
  - `skillMove(a, dir)`;
  - the chain counter;
  - close control by stick magnitude;
- `src/game/soccer2/ratings.ts` (`skillStars(p)`: W/AM/ST DRI ≥ 88 → 5, 80–87 → 4, 70–79 → 3, 60–69 → 2, else 1; CB/GK capped at 2);
- `src/game/soccer2/types.ts` (`ShotInfo.kind` adds `'finesse' | 'chip' | 'low' | 'power'`, `Act` adds `'skill'`);
- `src/game/soccer2/prefs.ts` (control fields);
- `src/game/soccer2/render.ts` (meter power zone, chip/finesse aim hints);
- `src/game/Arcade.tsx` (soccer kick-off "how to play" copy, 2 lines);
- tests `gestures.test.ts`, `shot-types.test.ts`, `skills.test.ts` (new); `audit_soccer_shots.ts` drills for the types.

**Changes**
1. **Floating stick:**
   - a touch anywhere in the left control zone (x < 45% of W, below the safe box's top + 40%) spawns the base under the thumb, clamped inside the zone; release hides it;
   - `prefs.stick: 'floating' | 'fixed'` (default floating), `prefs.stickSize: 0.8 | 1 | 1.2`;
   - `screenRunInput` is unchanged (release-to-stop stays).
2. **Sprint on the left thumb:** pushing the knob past 1.15× the ring radius sprints (a sprint ring lights, plus a light `tapHaptic`); falling back under 1.0× stops. SPRINT leaves the right cluster, so PASS/SHOOT never compete with it. Shift still sprints on the keyboard.
3. **Shot types** (research 7.1), classified in `gestures.ts` from the SHOOT pointer trace:

   | Type | Gesture | Wind-up | Speed | Cone | Notes |
   |---|---|---|---|---|---|
   | Placed | hold, drag, release (as today) | `meter.top` | 1.0 | 1.0 | |
   | Finesse | the drag curves (> 15° from straight), or a sideways swipe within 0.25 s after release (aftertouch) | +0.08 s | ×0.82 | 0.8 far corner, 1.3 near post | curl 3–6 m/s² |
   | Chip | quick upward flick (> 40 px in < 150 ms) | 0.35 s | solved to drop under the bar | ×1.6 | |
   | Low driven | double tap (< 250 ms) | 0.45 s | ×1.05, height cap 0.6 m | ×1.1 | +40% error at full power |
   | Power | hold past the green into the red zone (0.85–1.0 s) | 0.90 s | ×1.25 | ×1.35 | open to tackles |

   Aim and the timing meter apply to all types.
4. **Skill moves:**
   - swipes on the right half of the pitch area (not on buttons) while on the ball:
     - forward = knock-on / ball roll forward;
     - side = step-over feint (≤ 3★) or drag turn (4–5★);
     - back = drag-back / feint and turn;
   - each move is a short burst and direction change; a defender within 2 m whose read delay has passed may bite (stunned 0.4 s), with probability by DRI and stars against DEF;
   - consecutive moves within 1.2 s are 15% slower with +40% touch error, and a 4th forces a heavy touch;
   - deterministic via `a.rand`.
5. **Close control:** stick magnitude 0.5–0.85 → 90% pace with the shortest touch (soccer-4's model); full stick at a jog → normal; sprint → knock-ons.
6. **Settings:** the pause sheet's CONTROLS panel offers stick floating/fixed, stick size, auto-switch mode and defend mode; all are device-local (`prefs.ts`).

**Tests**
- `gestures.test.ts`: on synthetic traces (500 per class with noise), classification ≥ 95% correct; slow aim drags (> 150 ms) never classify as chip; a double tap within 250 ms is driven, beyond is two placed presses.
- `shot-types.test.ts` (drills, n ≥ 150):
  - a chip 1v1 with the keeper > 4 m off his line scores 45–55%;
  - a chip against a keeper on his line ≤ 15%;
  - finesse to the far corner from 16–20 m beats placed by +3–6 points and is worse to the near post;
  - low driven is blocked less often through a crowd (≥ 5 points);
  - power: speed ×1.2–1.3, cone ×1.3–1.4, tackled in the wind-up more often than placed when a man is closing.
- `skills.test.ts`:
  - each move changes direction within 0.15 s;
  - a 4th chained move within 1.2 s gives a heavy touch (100%);
  - against a closing defender a 5★ DRI 90 beats him ≥ 2× as often as a 1★ DRI 55;
  - deterministic for the same seed and inputs.
- `golden.test.ts`: unchanged unless the autopilot is taught shot types; if so, update it with the reason written in the team doc and re-run soccer-5's targets.

**Measurements:**
- Browser (two-pointer CDP touch): a left-thumb sprint held while the right thumb presses SHOOT keeps speed ≥ 0.85 × sprint top speed during the wind-up (baseline drops to the 80% jog);
- the floating stick's knob centre is at the touch point ±2 px;
- no control overlaps at 320×568;
- every target ≥ 44 px.

Re-run `human.ts`: no new strategy using a single shot type exceeds the 1.3× autopilot rule (add "power @25 m" and "chip on every 1v1" rows).

**Screenshots:** the floating stick appearing under the thumb, the sprint ring lit, the power zone on the meter, a chip arc, a finesse curl, each skill move, the controls panel, at 393×852 and 320×568.

**Protocol:** bump needed (shot types and skill moves change attack outcomes; covered by the single soccer bump).

**Save-compat:** new fields in the device-local `perfect-season:soccer-prefs:v1` only, with defaults; tests extended.

**Cross-team:**
- players: acts `'skill'` with `skill` names, shot kinds for kick animations.
- `Arcade.tsx` kick-off copy hunk (nba/nfl shared).
- ut: none.

**Acceptance:** tests green; human-harness rule holds; browser touch checks pass; screenshots reviewed; owner device check noted (stick and sprint feel).

---

### soccer-10 · Juice, atmosphere, animation hooks, then the final QA gate (P1 + release gate)

**Scope:**
- J-2: hit-stop, trails, haptics, net ripple, near-miss slow motion;
- J-4: scorer celebration with teammates, crowd swell by danger, commentary ticker;
- A-1: action metadata for the players team plus minimal routing;
- performance re-measurement;
- the team's final QA: full `npm test`, one build, browser walks, docs.

**Files:**
- `src/game/soccer2/Soccer2.tsx`;
- `src/game/soccer2/render.ts` (net ripple, ball trail; the player section only for ≤ 10 lines of act routing, coordinated);
- `src/game/soccer2/commentary.ts` (new, pure);
- `src/game/soccer2/engine.ts`:
  - `Body.anim?` metadata, render-only;
  - `settle()` celebration steering;
- `src/lib/sound.ts` (soccer crowd swell by distance);
- tests `commentary.test.ts`, `juice-soccer.test.ts` (new);
- docs: `docs/SOCCER-ENGINE.md`, `docs/SOCCER.md`, `docs/studio-overhaul/soccer.md`.

**Changes**
1. **Juice** (uses `Juice` from `src/game/juice.ts` without editing it: `freezeUntil`, `addTrauma`, particles):
   - hit-stop: 40 ms on a PERFECT strike, 60 ms on a save, 80 ms on woodwork;
   - a trail on shots over 25 m/s;
   - shake through trauma (none with reduced motion);
   - a 0.4× near-miss slow motion for 0.6 s when a shot passes within 0.3 m of the post (off with reduced motion);
   - net ripple strength by shot speed;
   - gesture-gated haptics through `tapHaptic`/`vibrate`: light on a green release, medium on a tackle won, heavy on a goal.

   It holds back only the real time fed to the accumulator, exactly like `slowUntil`.
2. **Celebration:** in `settle` the scorer and the two nearest teammates run to the corner flag (post-whistle, outcome already final); the celebration variant is picked by `hashString(seed + attack)` from what the players team provides (`celebrate` until then).
3. **Atmosphere:**
   - the crowd swells with the ball's distance to goal (gain eased between 35 m and 12 m), roars on goals, oohs on near misses and saves;
   - `commentary.ts` maps events to short lines ("MESSI… CUTS INSIDE… SHOOTS!", "OFF THE BAR!", "FAR POST!", "WHAT A SAVE BY ALISSON!") with the phrase picked by `hashString(seed + event index)`, never `a.rand`;
   - shown in a one-line ticker under the scoreboard, inside the safe box.
4. **A-1 hooks:** the engine fills `Body.anim = { kind, foot: 'L' | 'R', at, skill?, dive?: { side, band: 'low' | 'mid' | 'high', parry } }` from geometry and the shot or pass type:
   - the foot comes from which side of the body the ball sits on relative to the target direction (deterministic, no RNG, never read by the simulation);
   - kinds: pass, driven, lofted, cross, through, shot, finesse, chip, power, low, volley, header, pen, fk, throw, clear;
   - acts: poke, block, slide, jockey, getup, skill, trap.

   The action list and contact-time rules go in the team doc for the players team, who own the clips and blending; soccer adds at most a ≤ 10-line routing in `animOf` until their mapping lands (listed as touched outside the lane).

**Tests**
- `juice-soccer.test.ts`: a seeded match played with and without hit-stop, slow motion, trails and commentary gives identical ends, `t` and ball positions (the same rule as `juice.test.ts`).
- `commentary.test.ts`: deterministic per seed; every event kind has a line; lines ≤ 28 characters.
- `golden.test.ts` unchanged.

**Final QA gate (once each, through `heavy.sh`)**
1. `npm run typecheck`, then the full `npm test` (NBA, NFL, soccer); every suite green.
2. `npm run build` once; soccer chunks still lazy (no soccer code or `cards-soccer.json` in the first-paint entry; the soccer chunk size recorded before/after).
3. Harness finals: `sim.ts 400 all`, `human.ts 200`, `ratings-human.ts 300`, `probe.ts 3000`, `bend.ts`, `cam.ts`, `audit_soccer_shots.ts 200`. Every target in this plan is tabled as met / missed (with reason).
4. Browser walks with route-abort and `?ns=inspect&relay=ws://localhost:7777`:
   - the lab (all scenarios, defend phases, shootout, pause, full time) at 393×852 (insets 59/34) and 320×568, plus 430×932 once;
   - `soccer-app.mjs all` (Home → SOCCER, draft → match → result, a UT Squad Battle with defend phases, an online H2H between two local contexts);
   - zero page errors;
   - the blocked-host count logged.
5. Frame pacing (lab autopilot, 8 s): 390×844 at 4× CPU fps ≥ 58, p99 ≤ 33.4 ms; at 6× fps ≥ 53; landscape not worse than baseline.
6. Reduced motion: no shake, slow motion or slide-ins; replays shortened.
7. Docs:
   - `docs/SOCCER-ENGINE.md` and `docs/SOCCER.md` updated (controls table, rating effects table, set pieces, the measured tables);
   - the team doc completed: before/after, tests added, the final "Protocol bump needed: soccer draft 2→3, UT 2→3 because …" line, "Touched outside my lane" (every hunk with file and line range), "Owner device checks", "Left undone and why".

**Screenshots:** a goal with trail and ripple, the celebration run, the commentary ticker, a near-miss slow motion, plus the final set for the owner (393×852 at DPR 3).

**Protocol:** none for this task's changes (render only; proven by `juice-soccer.test.ts` and golden). The branch as a whole needs the soccer bump (team doc).

**Save-compat:** none new. The final QA re-runs `soccer-saves` and the UT soccer tests (old-shape profiles and snapshots round-trip).

**Cross-team:**
- players: animation metadata contract and routing;
- shell: lazy-chunk check;
- ut/nba/nfl: no new hunks;
- lead: the protocol line and the integration notes.

**Acceptance:** the final QA gate passes in full; every plan target tabled; the docs updated; commits pushed.

## 6. Shared files and hunks outside the lane (all small and listed in the team doc)

| File | Owner | Soccer hunk | Task |
|---|---|---|---|
| `src/game/Arcade.tsx` | nba/nfl shared | soccer branch of `aiPlay` passes `role` | soccer-5 |
| `src/game/Arcade.tsx` | nba/nfl shared | soccer branch: `onSoccerReport` passthrough, the full-time hold, `onQuit` | soccer-6 |
| `src/game/Arcade.tsx` | nba/nfl shared | soccer branch: `rivalSkill` / `onRival` for solo defend phases | soccer-8 |
| `src/game/Arcade.tsx` | nba/nfl shared | soccer kick-off "how to play" copy | soccer-9 |
| `src/ut/Match.tsx` | ut shared | `simBoth` soccer rival uses `role 'rival'` | soccer-5 |
| `src/ut/teams.ts` | unlisted | `pitchCardsOf` adds `slot` | soccer-7 |
| `src/game/soccer2/render.ts`, player section | players | ≤ 10-line routing of new acts to existing clips | soccer-4, soccer-10 |
| `src/lib/sound.ts` | soccer (crowd wiring) | `'pitch'` venue use, swell by distance | soccer-1, soccer-10 |
| `scripts/qa/soccer-lab.mjs`, `scripts/qa/soccer-app.mjs` | soccer QA scripts (shell owns `browser.mjs`) | route-abort, presets, layout and shell checks | soccer-1, 2, 6, 10 |

Every Arcade hunk uses `pick({ nba, nfl, soccer })` / the existing `SOCCER` constant; `sport-branches.test.ts` must stay green. `DRAFT_RULES` and `UT_RULES` are never edited.

## 7. Protocol

One line in the team doc (first written in soccer-1, finalised in soccer-10):

> Protocol bump needed: soccer draft 2→3, UT soccer 2→3, because the frozen-ball and parry rules, the shot/keeper/set-piece model and restarts, the defending/tackle/foul model and rating curve, the AI attack ladder used in takeovers and sims, the weighted deal, formation-driven set-ups and the new shot types and skill moves all change how attacks, AI simulations and the agreed shootout come out. NBA and NFL unchanged.

Render/UI-only tasks (soccer-2, soccer-6, soccer-10's juice) and the solo-only defend phases (soccer-8, golden-tested) would not need a bump alone.

Online rules after the bump: the H2H format stays simultaneous; the agreed shootout stays; quit/forfeit uses existing end letters unless the lead adds a forfeit code (raised in soccer-6).

## 8. Save compatibility summary

- No storage key, card id, edition id, copy UID, profile field or UT state changes.
- One new device-local key, `perfect-season:soccer-prefs:v1` (soccer-8/9): optional, try/catch, defaults when missing or corrupt, unknown fields preserved, not in cloud saves or checkpoints; covered by `prefs.test.ts`.
- `CardForPitch.slot` and `Squad.shape/slots` are match-time values, never stored.
- `soccer-saves` and `soccer-ut` tests run in the final gate.

## 9. Deferred items (with reasons)

| Item | Reason |
|---|---|
| Landscape match portal (audit V-1 option a) | The app is portrait-locked by the manifest and `stage.tsx` (shell-owned); the owner's phone use is portrait. Portrait redesign chosen (soccer-2). |
| Continuous 11v11 halves mode (audit S-1 fix 3) | A new mode needing its own queue, wire and protocol; out of this overhaul's size. |
| Online interactive shootout (C-4) | Needs commit-reveal over the match channel (`src/net/**`, lead-only) and a protocol change. |
| Shootout keeper reverse camera + swipe to dive (C-4) | P2: the existing pre-commit dive works; it needs a new camera mode and input; after defend phases if time allows. |
| Online defend phases | STREAM: online keeps the simultaneous format. |
| Dynamic stoppage time and highlights by drama (research 17) | The seven-attack count (`TOTAL = 7`) is part of the Arcade and wire contract. |
| Replays chosen by goal type, camera presets (research 7.10) | P2: one tuned camera and the existing replay first. |
| Acceleration archetypes (research 7) | Another rating lever that could reintroduce cliffs right after B-2's flattening; the card icon belongs to players/ut. Revisit with soccer-4's measurements. |
| Traits, roles with familiarity, weak-foot stars (research 10, 11, 19) | Need new per-card data through the data build scripts plus card-face work owned by players/packs; protocol-heavy. Skill stars for skill moves are derived in-engine instead (soccer-9). |
| Pack odds display, foil variants, promo cadence, Rivals ladder (research 7.13) | packs and ut teams. |
| Player appearance data and new mocap clips (A-2, A-1 clips, kit patterns L-6) | players team; soccer supplies action metadata and the action list. |
| Lofted through ball (hold THRU), pass-and-go, runner trigger, swerve passes (C-2, research 7.2) | P2: passing is the strongest existing area; its main defect (targets off screen) is fixed by soccer-2. |
| Corner target zones and avoidance dash; penalty composure ring (research 7.6) | P2: the meter already carries penalty timing; a second timing UI would conflict. |
| Late-match AI fatigue (research 7.8) | Low value in a seven-attack format. |
| Slow-mo pass set-up; power-up rate; keep-running-on-release; gestures-only mode (research 7.11, 18) | P2 settings after the core control rework lands. |
| Sound/haptics toggles in the pause sheet | `App.tsx` owns the persisted settings (`setFeedback` from the profile); the pause sheet links to the controls panel only. |
| True online forfeit (a loss whatever the score) | Needs an agreed wire code; raised for the lead in soccer-6, with a fallback (remaining attacks void). |

## 10. Owner device checks (only a real iPhone can confirm)

- Camera framing and readability in portrait on the owner's phone (soccer-2).
- The pause button's placement next to the Dynamic Island (soccer-6).
- Floating stick and push-to-sprint feel; one-thumb SHOOT while sprinting (soccer-9).
- Defending controls: contain, tackle timing, slide swipe, SWITCH, keeper RUSH (soccer-8).
- Shot-type gestures on glass: chip flick vs aim drag, double tap, curved drag (soccer-9).
- Haptics on iOS through the gesture-gated path (soccer-10).
- Match length and pacing in solo with defend phases (soccer-8).
