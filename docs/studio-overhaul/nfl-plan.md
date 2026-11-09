# Team nfl: build plan (studio overhaul)

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, dev-server port **5216**. Cut from `claude/studio-overhaul` = main `acdf3e2`.
`O` below means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

Sources read in full for this plan: `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-nfl.md`, `O/audit-nfl.md` (every section, C-1 to the artifacts list), `O/research-football.md` (§0 to §9), the repo `CLAUDE.md`, `docs/NFL-DIRECT-CONTROL.md`, `docs/NFL-RUSHING.md`, `docs/CORE-GAMEPLAY.md`, `docs/GAMEPLAY-RATINGS.md`, `docs/ARCADE-V2.md`, `docs/OVERHAUL-GAMEPLAY.md`, all of `src/game/football2/` (engine, drive, autopilot, render, Football2, controls, squad, PlaybookDialog, the CSS, and the tests), the NFL paths in `src/game/Arcade.tsx`, `src/game/difficulty.ts`, `src/game/play-feedback.ts`, `src/ut/Match.tsx`, `src/ut/play.ts`, `src/ut/match-debrief.ts`, `src/App.tsx`, and the harnesses `O/audit-scripts/nfl_*`. The other teams' briefs were grepped for overlaps on shared files.

The team doc (what changed, measurements, "Protocol bump needed", "Touched outside my lane", owner device checks) is `docs/studio-overhaul/nfl.md`. Task nfl-1 creates it, and every later task appends to it.

---

## 1. Goals

1. **The ball carrier never gives up.** After a catch or handoff he keeps running with natural momentum until the thumb lands (C-1). This is the audit's critical bug.
2. **You can see your team before the snap** on 393, 430 and 320 widths and in landscape. Play calling is quick, and run plays show their lane on the field (P-1).
3. **Passing and pocket play feel like the respected games, on a phone.**
   - Keep the Retro Bowl slingshot.
   - Add on-field receiver icons, a second-finger bullet/lob toggle, Madden-style pocket movement, throwaways and slides (C-2, C-3).
4. **Stats read as real.** Per-play distributions are calibrated to the 2024–25 NFL (research §1). Seeded calibration tests assert them within tolerance bands, built on `nfl_sim.ts`.
5. **Fair, readable difficulty.**
   - Difficulty changes only the AI's side.
   - The AI QB reads like a person.
   - Rookie is genuinely easy and Legend is fair.
   - Ties are settled on the field with conversions and overtime (D-3, D-4).
6. **Football, not half of it.**
   - A real defensive call table.
   - More formations and plays, with situational suggestions.
   - In solo games you play defense on the AI's drives (D-1, P-2, D-2).
7. **Studio-quality shell.**
   - Pause and quit everywhere.
   - A HUD that never overlaps.
   - Broadcast-style feedback.
   - An end-of-game box score with a player of the game.
   - At most 1 s between plays (D-5, V-3, V-4, F-2, pacing).

**Preserve** (audit §11):
- The seeded, fixed-step, deterministic 11-on-11 engine, and render-only juice (`juice.test.ts`).
- The `RunInput` contract:
  - A `Pt` is human intent. A touched, centred stick is `{0,0}`, which brakes. It is never turned into `null`.
  - A number or `null` is the AI's lane. nfl-1 adds one case: "human has not touched the stick since this carrier got the ball" is sent as `null`. This is documented, and it is not a centred stick.
- Above-99 ratings stay bounded and finite.
- The physical, rating-driven sub-systems: blocking proximity, power and finesse rush, route breaks, coverage lag, one swept play on the ball per defender, catch-point reach, the tackler wind-up, move counterplay, and the 16 abilities.
- Penalties with accept/decline, blown coverages and the seeded kickoff spot.
- The landscape side camera, which is the readability reference.
- The feel touches: replays, hit-stop, On Fire, the stamina bar, the tackler ring, high-point leaps, heavy gaits and afterimages.
- Accessibility: reduced motion, ARIA labels on every control, and the keyboard/WASD fallback.

## 2. Rules applied to every task

- **Lane.**
  - We own `src/game/football2/**` (except the player-drawing sections of `render.ts`: `lookFor`, `poseOf`, `animOf`, `sprite`, the sprite budget and caching) and `src/game/football/**`.
  - Shared with nba, in NFL branches only, as small hunks that never reformat a file: `Arcade.tsx`, `difficulty.ts`, `play-feedback.ts`, `PlayReadout.tsx`/`play-readout.css`, `juice.ts`, `replay.ts`, `useInputInterrupt.ts`, `attrs.ts`.
  - New CSS goes in new files under `src/game/football2/`, imported from our components: `play-tray.css`, `pass-controls.css`, `hud.css`, `defense.css`. We do not grow `src/styles.css`.
  - Every edit outside the lane is listed under "Touched outside my lane" in `nfl.md`.
- **Sport branches.** Use `pick({ nba, nfl, soccer })` in shared files. Never a two-way sport ternary.
- **Determinism.** Engine, drive and autopilot code uses `p.rand` or `rng(hashString(…))` only. `Math.random()` is allowed only in render-only code; the kick ball path in `kickNow` is an example. Every engine-touching task keeps `juice.test.ts` and the seeded tests green.
- **Protocol.**
  - Never edit `DRAFT_RULES` (`src/net/match.ts`) or `UT_RULES` (`src/ut/Match.tsx`).
  - Write one line in `nfl.md`: **"Protocol bump needed: NFL draft 10→11, UT 11→12, because …"**, adding each task's reason.
  - NBA and soccer are unchanged.
  - New wire values are drive-end strings of 8 characters or fewer. The existing `net/match.ts` parser already accepts these (strings ≤ 8 chars, at most 40 entries), so no net code changes.
- **Saves.**
  - No profile, storage-key, card, edition or copy id changes.
  - New state is local, optional preference keys only (listed per task), each read and written inside try/catch with defaults.
  - `perfect-season:fb2-played` is untouched.
- **Commands.** Run through the semaphore: `bash O/heavy.sh …`.
  - Area tests: `bash O/heavy.sh env PS_SPORT=nfl npx vitest run src/game/football2 src/game/play-feedback.test.ts src/game/juice.test.ts src/engine/sport-branches.test.ts`
  - Typecheck: `bash O/heavy.sh npm run typecheck`
  - Heavy calibration: `bash O/heavy.sh env PS_SPORT=nfl CAL=1 npx vitest run src/game/football2/calibration.test.ts`, or `bash O/heavy.sh npx vite-node scripts/nfl_calibrate.ts`
  - Full `npm test` and `npm run build` run only in nfl-10.
- **Browser QA.**
  - Dev server: `nohup npx vite --port 5216 --strictPort > /tmp/ps-nfl-vite.log 2>&1 & echo $! > /tmp/ps-nfl-vite.pid`. Stop it with `kill $(cat /tmp/ps-nfl-vite.pid)`.
  - URL: `http://localhost:5216/?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=…`
  - Every context runs `context.route('**/*')` and aborts any host other than localhost and 127.0.0.1, except fonts.googleapis.com and fonts.gstatic.com. This copies `O/audit-scripts/utui/lib.mjs`.
  - Positions are read by hooking `FootballRenderer.prototype.draw` from the dev server (QA-only, as `nfl_catchstop.cjs` does). No product debug hooks are shipped.
- **Viewports** (touch, `isMobile`, `deviceScaleFactor: 1` for own checks).
  - Insets are injected on `.arcade-full`, as `nfl_shots.cjs` does, until shell's QA override lands.

  | Name | Viewport | Insets |
  |---|---|---|
  | A | 393×852 | 59/34 (owner's phone) |
  | B | 430×932 | 59/34 |
  | C | 320×568 | 20/0 |
  | D | 844×390 landscape | top 0, bottom 21, left/right 59 |

  Also a reduced-motion run. Screenshots go to `O/shots/nfl/<task>/`, and each is looked at.
- **Commits.**
  - After each task, stage explicit paths. The message starts `Claude: ` and ends with the two trailer lines from BUILD-RULES.
  - Push with `git push -u origin claude/studio-nfl`, retrying 4 times (2/4/8/16 s) on network errors.
  - Never `git add -A`, force-push, rebase or bare `git stash`.

## 3. Baseline to beat (audit, `acdf3e2`, 120 seeded games per case)

| Metric | NFL target (research §1) | Measured now |
|---|---|---|
| Completion % | 64–65 | AI Pro gold 70.1, elite-Legend 51.0, human proxy 63–68 |
| By depth: behind / 0–9 / 10–19 / 20+ | 79 / 72 / 55 / 35 | Deep (20+): AI 55%, human proxy 57–62% |
| INT % | 2.2, rising with depth | AI Pro gold 2.7; elite 5.8–6.9 |
| Sack % | 6.9 | AI 0.1–3.5; human proxy 10.8 / 12.3 / 26.6 (Rookie / Pro / Legend) |
| Time to throw | ~2.8 s | AI 1.39–1.64 s; human proxy 2.24–2.27 s |
| 20+ yd gains, % of attempts | 8–9 | Human proxy 18.5–19.9 |
| YAC | 5.2 | 1.4–4.2 (Legend low); 2.0 with a 0.35 s stick delay |
| Runs: YPC / median / ≤0 / 10+ / 20+ | 4.3 / 3 / 18% / 10–11% / 2.2% | 3.76 / 3.1 / 10% / 1% / 0.3% (AI Pro gold); P99 9.7 |
| Inside / Outside / Power YPC | distinct | 3.55 / 3.74 / 4.00 |
| Target share | WR2 matters | Z 5.7% of 1,500 targets; RB 20–44% |
| Points per drive | 2.1 | AI Pro gold 3.75; elite-Legend 1.22 |
| Turnovers, % of drives | ~10 | Elite-Legend 31 |
| DOWNS, % of drives | ~5–6 | 12–55 (no punts) |
| 3rd-down conversion | 39–40, by distance | 40–49 overall |
| Ties decided by squad rating | — | 10–13% (gold), 20% (elite Legend) |
| Human proxy wins (Rookie / Pro / Legend) | ≥70 / ~50 / 30–35 | 47.5 / 41.2 / 29.9; 20.9 on Pro with the 0.35 s stick |
| Catch with no stick (live) | keeps running | 5 of 5 braked to 0 within 0.25 s; YAC +0.1 |
| Play-call panel top vs line of scrimmage (390) | formation visible | y=562 vs y≈523: QB and RB hidden; at 320 all 11 hidden |
| Ability pops per play | ≤ 1 | 0.7 (gold), 2.0–2.4 (elite) |
| Frame pacing at 4× throttle | smooth | p99 33.4 ms; 10 frames > 33 ms; 6 long tasks (527 ms) in 15 s |

## 4. Cross-team contracts

Each contract is recorded in `nfl.md` and announced in the team doc. Whichever team lands first defines it, and the other reuses it.

1. **Quit and forfeit (with nba; App.tsx and ut/Match.tsx callers).**
   - `Football2` gets `onQuit?: () => void`. `Arcade` gets `onQuit` handling.
   - `Arcade.onFinish` gets an optional 6th argument, `forfeit?: 'us' | 'them'`.
   - Online, the quitter sends a final `Progress` with `done: true`, and its `ends` are padded with `'FF'` (worth 0) up to the regulation count. A rival `Arcade` that sees `'FF'` finishes at once with `forfeit: 'them'`.
   - `App.tsx` `finish` and `ut/Match.tsx` `finish` map `forfeit` to `won` in at most 6 lines each.
2. **Solo defense (nba has the same idea, NBA-07).**
   - `Football2` gets `solo?: { rivalOffense: Offense; ourDefense: Defense; skill: number; defIQ: number }` and `onRival?: (p: Progress) => void`.
   - In the NFL branch of `Arcade`, when `!online`, the rival's shown and final progress come from `onRival` instead of the precomputed `ai`.
   - Online stays parallel offense, unchanged.
3. **Difficulty (`difficulty.ts`, with nba).**
   - New export `userDefenseIQ(online: boolean, level: BotLevel): number`, giving the human's defense when the AI drives.
   - `defenseDifficulty` keeps its meaning: the AI defense facing the human.
   - Online stays symmetric (`COMPETITIVE_DEFENSE`).
4. **Box score (for ut).**
   - `Football2` and `Arcade` get `onBoxScore?: (box: FbBox) => void`. `FbBox` is exported from `football2/boxscore.ts`.
   - The box score is never sent over the wire.
   - ut uses it for man of the match and for objectives.
5. **Acts (for players).**
   - The engine sets existing acts:
     - `backpedal` for the QB drop
     - `down` for a sacked QB
     - `tackle` for the sacker
     - `catch` for the RB at the handoff mesh
   - It also sets one new act, `getup`, for downed non-carriers after 0.8–1.2 s.
   - The players team maps `getup` (mocap `getup` / `getup_front`) in `animOf`. Until they do, it falls through to the idle pose.
   - Requests to players: juke to the `cut` clip, stiff arm to `stiff_arm`, truck, and a QB rollout and play-action fake.
6. **Crowd (for ut).**
   - `Football2` and `Arcade` get `crowd?: 'home' | 'road' | 'neutral'` (default neutral).
   - `ut/Match.tsx` passes `'road'` only for solo away fixtures (Club Season and Cups). It never does so online.
7. **Drive-end codes (for ut).**
   - New codes: `TD6` (6 points: missed XP or failed two-point try), `TD8` (8 points: good two-point try) and `FF` (forfeit, 0).
   - `TD` stays 7, with the XP made.
   - Overtime drives are appended after the regulation ends.
   - `ut/Match.tsx` `HOOPS_FOOTBALL_POINTS` / `LABEL` and the `ut/match-debrief.ts` allowed list need these (tiny hunks).
8. **Shell.**
   - `.arcade-full --sat` changes with shell's Fix A.
   - All our HUD offsets use `var(--sat)` and `var(--sar)`. Re-measure after the merge.

## 5. Protocol summary

**Protocol bump needed: NFL draft 10→11, UT 11→12.** Each task adds its reason to `nfl.md`:

- nfl-1: human input semantics after a carrier change
- nfl-3: pocket, throwaway and slide
- nfl-4: passing calibration and QB reads
- nfl-5: runs, contact and moves
- nfl-6: scoring, kicks, overtime and the AI
- nfl-7: draft fill-ins become real players, and the `FF` code
- nfl-8: playbook and defensive calls
- nfl-10: earned zones, defensive On Fire, precision passing and SNAG

nfl-2 is render and UI only. nfl-9 is solo-only, and its engine additions are inert without user-defender input; a determinism guard test proves it.

NBA and soccer are not bumped by us.

---

## 6. Ordered tasks

### nfl-1 (P0, enabling): calibration harness, baseline and momentum carry (C-1)

**Scope.** Audit C-1, plus the harness every calibration task uses, plus the stick-knob re-render cost (audit §10).

**Changes**
- **New `src/game/football2/sim-kit.ts`.** Pure, with no DOM. It is used by tests and the script.
  - `fixtureTeams(tier: 'silver' | 'gold' | 'elite')`: real UT squads built as `nfl_sim.ts` builds them. Per `NFL_SLOTS`, the 60th-percentile card for silver and gold, and the 97th-percentile gold card for elite.
  - `synthTeams(level)`: built from `depth()`, for fast tests.
  - `PilotMode = { kind: 'ai' | 'human'; skill: number; defIQ: number; stickDelay?: number; neverStick?: boolean; pocket?: boolean }`.
  - `playGame(g, mode, seed, acc)`.
  - `summarize(acc)`. It returns every audit metric plus:
    - the run histogram (≤0, 1–3, 4–6, 7–9, 10–19, 20–39, 40+) and P10/P25/P50/P75/P90/P99
    - passing by aim depth (behind the line, 0–9, 10–19, 20+): completion and INT
    - 3rd down by distance (1, 2–3, 4–6, 7–10, 11+)
    - red-zone trips, TD % and score %
    - target share by slot
    - time to throw and time to sack
    - scramble and throwaway rates
    - FG % by distance
    - score histogram and tie odds
    - paired-game margins
  - The human stick proxy models the new UI contract: `null` until the first touch (after `stickDelay`), then a `Pt`.
- **New `scripts/nfl_calibrate.ts`.** Read-only and run with vite-node. `CASES=ai,human,stick,mis,shape,ladder` and `GAMES=300` select the cases. It writes `docs/studio-overhaul/nfl-calibration/<label>.json` and prints a markdown table. It never reads or writes a profile and never contacts a relay or registry.
- **New `src/game/football2/calibration.test.ts`.**
  - An always-on fast block: synthetic teams, 40 games, sanity bands (finite, completion 45–80%, YPC 2–7).
  - An opt-in `CAL=1` block with real-card bands. Each later task adds its assertions here.
- **`Football2.tsx`, C-1.**
  - A `touchRef = { carrier: number | null; touched: boolean }`.
  - When `p.carrier?.id` changes (handoff, catch or scramble), `touched` = (the stick is deflected beyond the dead zone, or keys are held). This is the pre-hold.
  - `steerNow()` returns `null` while `!touched`, otherwise `screenRunInput(…)` (a `Pt`, `{0,0}` included).
  - Any stick pointerdown or keydown sets `touched = true`.
  - A touched-then-released stick still brakes, as today. Untouched is not centred, per CLAUDE.md.
- **`engine.ts` `step()` carrier branch.**
  - For `steer === null` on a non-designed carrier (a receiver after a catch, or a scrambling QB), carry the current heading: lateral velocity decays toward 0 at 0.6× the AGI turn rate for the first 0.35 s after the carrier change, then the existing `aim === null` upfield path takes over.
  - The RB keeps `followingRun` on the designed lane.
- **Pre-hold cue.** While the ball is in the air and the stick is untouched, `.fb2-stick` gets a pulsing "HOLD TO RUN" ghost, defined in `rushing-controls.css`. Under reduced motion it is a static label.
- **Performance.** The knob is driven through a ref (`knobRef.style.transform`) in `move`, `stickDown` and `keyRun`, instead of `setKnob` state. That stops a full-tree re-render on every pointermove.
- **Docs.** Create `docs/studio-overhaul/nfl.md` (sections per BUILD-RULES) with the baseline table and the first "Protocol bump needed" line. Append a "Momentum carry" section to `docs/NFL-DIRECT-CONTROL.md`.

**Tests and measurements**
- **`rushing.test.ts`, new cases.**
  - With `null` input after a catch in the open field, speed at +0.5 s ≥ 0.85 × catch speed, and gain at +1 s ≥ 4 yd.
  - A touched-then-`{0,0}` stick brakes to under 0.01 yd/s (the existing test stays).
  - A pre-held `Pt` drives immediately.
- **CAL stick cases** (gold v gold, Pro, 300 games), measured in the same run:
  - YPC(+0.35 s) ≥ 0.9 × YPC(held)
  - YAC(+0.35 s) ≥ 0.85 × YAC(held)
  - untouched YPC ≥ 0.9 × held
  - Baseline: YPC 3.9 / 1.2 / −0.35 / −3.7 and YAC 5.7 / 2.0 / 1.2 / ≈0 for held / +0.35 / +0.7 / never.
- **Live, new `scripts/qa/nfl-catch-run.mjs`** (from `nfl_catchstop.cjs`, port 5216, 6 seeds, PASS to the RB, never touch the stick):
  - 6/6 carriers keep ≥ 70% of catch speed at +0.25 s and ≥ 50% at +0.5 s.
  - YAC > +1 yd on ≥ 5/6.
  - Baseline: 0/5 moving at +0.25 s; YAC +0.1.
  - `scripts/qa/joystick.mjs` still passes, so release still brakes.
- **Performance.** During a 2 s stick drag, React commits to `Football2` ≤ 10, counted with a QA-only Profiler wrapper. Baseline is about one per pointermove (60–120 a second).
- Baseline CAL numbers for every case are written to `nfl.md`. These are the "before" for later tasks.

**Screenshots.** A and C: a catch at +0.25 s with no stick, and the ghost "HOLD TO RUN" stick during flight.

**Protocol.** Needed (input semantics after a carrier change).

**Save compatibility.** None.

**Dependencies.** None.

### nfl-2 (P0): pre-snap tray, run lane, camera framing and playbook dialog (P-1, P-3, P-4 partial, V-1, C-6)

**Changes**
- **New `src/game/football2/PlayTray.tsx` and `play-tray.css`.** They replace the `.fb2-call` markup in `Football2.tsx`.
  - Header row, about 44 px: down and distance, FLIP as a 44 px icon button, and PLAYBOOK as a 44 px icon button.
  - One horizontal scroll-snap strip of play cards, about 104×88 each. It holds the 3 suggested cards plus the 2 most recently used, each with art, PASS/RUN and a name.
  - A large SNAP button, at least 64×64, at the strip's right.
  - On 4th down, one extra row: GO / KICK / PUNT.
  - A collapse chevron shrinks the tray to a 56 px bar with SNAP still visible. Dragging on the field before the snap collapses it too.
- **Landscape (`.fb2.wide`).** The tray docks as a 300 px column at the right. Move buttons sit on an arc (C-6): JUKE high, SPIN mid, POWER low-right, each ≥ 58 px and at least 24 px apart.
- **Camera (`render.ts`, camera and HUD sections only).**
  - `perspAt` takes a row that eases from 0.50 before the snap (line of scrimmage mid-screen) to 0.62 once live.
  - The horizon moves from 0.13 to 0.07.
  - Scale `s` is tuned so players near the line of scrimmage are ≥ 28 css px tall at A.
  - Dynamic zoom:
    - `zoomK` eases to 0.88 when the ball is in the air with a flight ≥ 1.2 s or an aim ≥ 25 yd
    - to 1.12 when 2 or more defenders are within 3 yd of the carrier
    - to 1 otherwise
    - Under reduced motion the zoom stays fixed at 1.
- **Run lane.** `FbOverlay` gains `runLane: boolean`. For run calls before the snap and through the mesh, draw:
  - the RB path to the hole, with the same landmarks as `PlayArt`, in purple with an arrowhead
  - each lineman's short block arrow, pushing away from the hole (assigned defender from `d.mark`)
  - the TE seal arrow
  - `Football2` sets `routes` for passes and `runLane` for runs.
- **Ball.** A minimum size of 4 css px, a shadow ring, and a 3-dot trail in flight. Render only.
- **P-3.**
  - `.fb2-playbook` gets `box-sizing: border-box; width: min(620px, calc(100vw - 24px - var(--sal) - var(--sar)))`.
  - `.fb2-book-shade` resets the UA dialog padding and border explicitly.
  - Grid cards get `min-width: 0`.
- **P-4, copy that is wrong today.**
  - `Arcade.tsx` NFL kickoff text "from your own 25" becomes "from where the kickoff leaves you".
  - "Run: drag to steer" becomes "Run: joystick, hold BURST · JUKE, SPIN or POWER at a tackler".
  - `tip()` hints are cleared on every phase change and in `lineUpNext`, so they no longer carry into the next play call.
  - Every tip string fits one line at C; long tips are rewritten.
- **Performance.** `rec.current.push` runs at 30 Hz (when `p.t − lastPush ≥ 1/30`), not every 60 Hz frame. This is done in `Football2`, and the shared `replay.ts` is left alone.

**Tests and measurements** (new `scripts/qa/nfl-presnap.mjs`; positions read through the hooked `draw` with `this.screenOf`)
- At A, B and C, every offensive body's head and feet and the line of scrimmage are above the tray top minus 6 px. Baseline: QB and RB hidden at 390 and 430; all 11 hidden at 320.
- At D, no offensive body is inside the tray rect.
- Tray height ≤ 150 px at A and ≤ 140 px at C. Baseline is about 236 px.
- The line of scrimmage sits at 45–58% of viewport height before the snap.
- Near-line player sprite height ≥ 28 css px at A. Baseline is 12–25.
- Sky, stands and score bug take ≤ 15% of the height at A before the snap. Baseline is about 27%.
- Ball ≥ 4 css px in flight. Baseline is 2–3.
- The playbook rect is within [12, vw − 12] at A, B, C and D, with `scrollWidth === clientWidth`. Baseline: x = −5, width vw + 10.
- Every control is ≥ 44×44.
- Each hint is ≤ 30 px tall (one line) at C.
- Replay snapshots are about 30 per second.
- Zero page errors. The existing `play-feedback.mjs` and `joystick.mjs` pass.

**Screenshots.** A, B, C and D:
- pass call
- run call with the lane
- 4th down
- playbook open
- collapsed tray

Each is set beside the audit's `*-01`, `-02`, `-08` and `-12` shots.

**Protocol.** None (UI and render only).

**Save compatibility.** None.

**Dependencies.**
- shell (`--sat`).
- players: tell them the camera scale changed, since sprite sizes and the sprite budget are theirs.

### nfl-3 (P0): pocket control and passing controls (C-2, C-3; A-1 drop and sack hooks)

**Engine changes (`engine.ts`, `types.ts`, `autopilot.ts`)**
- **Drop.** A scripted drop over 0–0.75 s to `los − 6.5`, with act `backpedal` while moving and `stance` when set. The players' existing backpedal and shuffle clips render it.
- **Pocket movement.**
  - When `phase === 'drop' && call === 'pass' && carrier === qb`, a `Pt` steer at t ≥ 0.45 s moves the QB at up to `lerp(3.6, 5.0, rt(AGI))` yd/s, with ACC-based acceleration.
  - His velocity feeds the existing `movement` term in `throwErrorRadius`.
  - `sight()` gains a movement penalty: × `lerp(1, 0.8, movement)`.
  - With `null` or a number (the AI), the QB keeps his spot, plus a 0.8 yd step-up when an edge rusher is free and the interior is held.
- **Tackle box.** `outsideBox(p)` is `|qb.x − p.bx| > 4.5 || qb.y > p.los`. Driving past the line of scrimmage becomes a scramble.
- **Scramble throw.** `throwTo` also accepts `phase === 'run' && carrier === qb && qb.y < p.los − 0.3`, with movement error. RUN IT stays.
- **`throwAway(p)`.**
  - Legal only when `outsideBox`.
  - The ball goes 3 yd beyond the nearer sideline and 10 yd downfield, with `Ball.away = true`.
  - `playPassingLane` skips such a ball, and `arrive()` makes it incomplete with the text 'THROWN AWAY'.
  - Inside the box it returns false.
  - There is no intentional-grounding flag; this is noted in the doc.
- **`slide(p)`.** For a QB carrier past the line: decelerate for 0.25 s, then `endPlay('tackle', …, 'QB SLIDES')`, with no fumble roll and no hit.
- **Sack.** At `endPlay('sack')`, set `act(qb, 'down')` and `act(rusher, 'tackle')`. No RNG draws are added.
- **Pressure ring.** It is visible from `winAt − 0.6 s` (render). Sack timing is calibrated in nfl-4.

**UI changes**
- **New `ReceiverIcons.tsx` and `pass-controls.css`.**
  - One button per eligible receiver, positioned over his head each frame through refs from `renderer.screenOf`.
  - A 44×44 hit area, a 26–30 px route-coloured disc and the jersey number.
  - A tap calls `throwToReceiver` with the current type.
  - When icons crowd, they are offset to keep overlap ≤ 30%.
- **Throw type.**
  - A chip near the QB cycles BULLET · AUTO · LOB (≥ 44 px). AUTO is the default and uses `loft()` by distance.
  - A second-finger tap anywhere during an active slingshot drag toggles BULLET and LOB, as in Retro Bowl.
- **Pass layout preference** `perfect-season:fb2-pass-layout`: `'field'` (default) or `'panel'`. The panel is the old PASS TO layout, kept as the "pro" layout.
- **Thumbs.** The left thumb drives the stick, which appears at the snap on pass plays and moves the QB. The right thumb drags the slingshot or taps icons.
- **Right-side buttons.**
  - RUN IT.
  - THROW AWAY, enabled only outside the box; disabled it reads "OUTSIDE THE BOX".
  - For a QB carrier past the line of scrimmage, SLIDE replaces SPIN.
- **In flight.** A faint landing reticle at `ball.to`. The receiver name chip shows at release whatever `sight` says; the landing ring stays sight-gated.
- **Copy.**
  - `play-feedback.ts` NFL lines 105–113 become: "Step up in the pocket, throw it away outside the tackle box, or RUN IT".
  - The run-lane line is now true, since nfl-2 draws the lane.
  - The `Arcade.tsx` kickoff pass row becomes "Pass: tap a receiver or drag back to aim · left stick moves the QB".
  - Tips are updated to match.
- **Docs.** Update `docs/NFL-DIRECT-CONTROL.md`.

**Tests and measurements**
- **`gameplay.test.ts`.**
  - With a `Pt`, the pocket move gives 1.5–5 yd of displacement in 1 s; with `null` there is none beyond the scripted drop.
  - `throwAway` inside the box returns false. Outside the box it is always incomplete, never `int` or `lane-int`, over 500 seeds.
  - A scramble throw is allowed before the line of scrimmage and refused after it.
  - A slide always ends as a tackle with no fumble, over 500 seeds.
  - A sack sets `qb.act = 'down'`.
  - The same seeds and inputs give an identical `PlayEnd` twice.
- **sim-kit human proxy with `pocket: true`.** The proxy steps away from the nearest free rusher when pressure > 0.5, and throws away when hurried outside the box.
  - On Pro gold, sack % is ≥ 3 points lower than with `pocket: false`. Baseline is 12.3%.
  - Throwaways are 1–4% of dropbacks.
  - INT % rises by no more than 0.3 points.
- **Browser, new `scripts/qa/nfl-passing.mjs`, at A, C and D.**
  - Icons are within 12 px of the receivers' heads, with hit areas ≥ 44 px.
  - Two-finger CDP touch: a held stick plus a slingshot drag throws, and a second-finger tap toggles the type.
  - THROW AWAY is enabled only outside the box.
  - At D, no control covers the RB or slot. Baseline: the PASS TO panel covers them.

**Screenshots.** A, C and D:
- dropback with icons
- QB moving in the pocket
- throwaway
- scramble throw
- slide
- sack fall frames

**Protocol.** Needed.

**Save compatibility.** New optional pref key `perfect-season:fb2-pass-layout`.

**Dependencies.**
- nba: shared `play-feedback.ts`, NFL strings only.
- players: no code needed; the drop and sack use existing clips.

### nfl-4 (P0): passing calibration (passing targets, facing-ball INTs, G-2, G-3, G-4, sacks, reads by awareness)

**Changes (`engine.ts`, `autopilot.ts`; icons UI)**
- **Facing rule.**
  - `facingBall(d, at)`: heading is the velocity when speed > 1, otherwise toward the QB and line of scrimmage, as when backpedalling.
  - An interception is possible only if the angle from heading to ball is ≤ 75° and `t ≥ breakAt`. Otherwise the INT chance becomes a deflection chance.
  - This applies in both `playPassingLane` and `arrive()`.
- **INT shape.**
  - Lane-pick chance is capped at 0.35.
  - Contested `pi` is scaled by air yards: × 0.3 behind the line, × 0.6 at 0–9, × 1.0 at 10–19, × 1.4 at 20+.
  - Ballhawk becomes additive +0.05, instead of +0.15 compounding in both lane and contested plays.
- **Deep balls (G-2).**
  - Deep zone defenders and the Cover 1 FS keep at least 1.5 yd deeper than the deepest receiver in their area until the throw. The FS shades to the deepest vertical.
  - On touch or lob throws with a flight ≥ 1.3 s, deep defenders' `breakAt` comes 0.06 s sooner.
  - At the catch point, a trailing defender within reach on a high ball cuts the catch chance by 0.08–0.15, by MCV and height.
- **YAC.** Defenders turning to pursue after a catch pay a reaction lag of `lerp(0.35, 0.15, PRC)`, and catch-in-stride momentum carries from C-1.
- **Top tier (G-4).**
  - `routeWinChance` is clamped to [0.15, 0.85].
  - Coverage lag gets a floor.
  - The lane-play chance including `defIQ` is capped at 0.55.
- **Reads by awareness (QB AI; G-3).**
  - `READS: Record<Concept, Slot[]>` is the ordered read list for each concept:
    - Smash: Z corner, X curl, TE out, RB flat
    - Flood: Z corner, SL out, TE flat
    - Dagger: X dig, SL seam, Z curl
    - Verts: the seams, then the outside go routes
    - Mesh: Z corner, then the drags
    - Curls: X and Z curls, then the flats
    - Posts: X and Z posts, then the TE drag
    - Slants: X, SL and Z slants, then the RB swing
  - `decide()` visits the reads in order:
    - First read at 1.0–1.4 s, by skill and AWR.
    - Each next read takes `lerp(0.55, 0.32, rt(AWR))` s.
    - Number of reads: 1 below AWR 60, 2 at 60–79, 3 at 80–89, 4 at 90+.
    - The RB checkdown comes only after the reads, or when hurried.
    - It throws away when hurried and nothing is open.
  - This is the AI QB's read floor: time to throw becomes 2.4–3.0 s.
- **AI scramble.** When pressure > 0.7, nobody is open and there is a lane of 5+ yd, the AI scrambles. Target 3–7% of dropbacks.
- **Sacks.** Tune `WIN_AT`, `POCKET` and free-rusher pursuit so a typical sack lands at 3.2–3.8 s, while the average pressure stays near 2.9 s.
- **UI.** Icons show the open / tight / covered tint only on the first N reads (research §8.2.4).
- **Harness.** `tune.test.ts` and `human.test.ts` are moved onto sim-kit, keeping their env flags.

**Tests and measurements**
- **Always-on.** A unit test for `facingBall`. Over 2,000 seeded passes, no interception by a defender whose heading is more than 75° off the ball.
- **CAL, AI Pro gold v gold, 300 games.**
  - Completion 62–67%.
  - By depth: behind the line 74–84%, 0–9 67–77%, 10–19 49–61%, 20+ 30–42%.
  - INT 1.8–2.6%, with each deeper band's INT % ≥ the shallower one's.
  - Sacks 5.5–8.5% (baseline 2.7).
  - Time to throw 2.4–3.0 s (baseline 1.4–1.6).
  - YAC 4.2–5.8; Y/A 6.3–8.0.
  - 20+ yd gains on 7–11% of attempts.
  - Scrambles 3–7%.
- **CAL, human proxy, Pro gold, pocket on.**
  - Completion 58–67%.
  - Deep (20+) completion 33–45% (baseline 57–62).
  - 20+ yd gains on 7–11% of attempts (baseline 19).
  - Sacks 6–9.5% on Pro (baseline 12.3) and ≤ 12% on Legend (baseline 26.6).
- **Targets (G-3), 1,500 AI passes.**
  - X, Z and SL each get 12–30% of targets; TE 12–25%; RB ≤ 22%. Baseline: Z 5.7%, RB 25–44%.
  - Putting a 95 WR at Z instead of a 70 gives Z ≥ 1.25× the catches and yards.
- **Top tier (G-4).**
  - Elite v elite on Legend scores within 15% of gold v gold on Legend in points per drive. Baseline: 1.22 vs 2.96.
  - INT ≤ 3.0% (baseline 6.9).
  - Turnovers ≤ 15% of drives (baseline 31).
  - Completion ≥ 58% (baseline 51).
- **Pressure.** Completion on throws released under pressure ≥ 0.5 is at least 15 points below throws under pressure ≤ 0.2. NFL: 49 vs 72.
- **QB spread.** A 92 QB vs a 75 QB, on otherwise identical teams: completion +4 to +9 points, with lower INT % and lower sack %.
- `ratings-matter.test.ts`, `gameplay.test.ts` and `juice.test.ts` stay green.

**Screenshots.** A:
- a deep shot against Cover 3
- an INT by a facing defender next to a swat by a trailing one
- icons with the read tint

**Protocol.** Needed.

**Save compatibility.** None.

**Dependencies.** packs: re-rated cards shift the CAL fixtures, so re-run CAL at integration.

### nfl-5 (P0): run game, ball-carrier moves and tackling (G-1, G-5, C-4; auto stiff arm and hurdle; hold-to-truck)

**Changes (`engine.ts`, `types.ts`, `drive.ts`, `autopilot.ts`, `Football2.tsx`, `render.ts` HUD only)**
- **Run identities.**
  - **Inside:** a double team at the point of attack (C and guard on the DT, climbing to the MLB at 0.6–0.9 s).
  - **Power:** the backside guard pulls (new Job `'pull'`) and kicks out or leads through the hole.
  - **Outside:** keeps the stretch landmark. A backside cutback lane opens when the backside DE crashes.
  - AI and untouched runners pick lanes by BCV.
- **Second-level variance.**
  - An LB overrun or misfit (fills one gap too far) on 10–20% of runs, by PRC.
  - Safety angle error, scaled by (1 − PUR) and speed.
  - The pursuit closing burst at `engine.ts:1020` drops from +4–8% to +2–5%.
- **Contact (G-5).**
  - A successful `tackle()` opens `p.contact = { since, tacklers, drive }`, where `drive = f(STR, TRK, wt vs TAK, HIT, wt)`.
  - For 0.3–0.6 s the carrier moves forward at `drive × 2.5` yd/s, decaying.
  - Each extra defender within 1.2 yd joins (a gang tackle) and shortens the contact by 0.15 s.
  - It ends at the spot with the text 'TACKLED BY <tag>', or '<tag> & <tag>' for a gang tackle. This is the V-2 piece that is ours.
  - Broken tackles on first contact stay rating-driven.
- **Moves (C-4).**
  - **JUKE direction:** `Football2` passes `dir` = sign of the stick's field-x when |x| > 0.3; otherwise "away from the man", as now. A left or right swipe on the JUKE button also sets it.
  - **DIVE:** a forward dive for +1.0–1.5 yd, then down, with fumble chance × 0.3. Reaching at the goal line is +0.3 yd, but fumble chance × 1.5 if he is hit.
  - **PROTECT (hold):** fumble chance × 0.3, speed × 0.9, no moves.
  - **Stamina across a drive:** `Game.fatigue[rbId]` is transient. The next play's `p.stamina` is `min(1, fatigue + 0.35)`; it resets at the end of the drive. The RB chip shows it before the snap.
- **Retro Bowl touches.**
  - Automatic stiff arm (by SFA/STR) and hurdle (by SPD/AGI, against a diving low tackler) when no move is pressed. The chance is seeded at 0.25× a manual move's edge, and never guaranteed.
  - Hold-to-truck: holding POWER for 0.4–0.6 s charges, at speed × 0.85 and tackleable from behind. Releasing near full gives the truck +0.1 edge. A tap stays today's POWER.
- **A-1 hooks.**
  - The RB gets act `catch` at the mesh for 0.2 s (the handoff exchange).
  - Downed non-carriers get act `getup` after 0.8–1.2 s.
- **Docs.** Update `docs/NFL-RUSHING.md`.

**Tests and measurements**
- **`rushing.test.ts`.**
  - A juke with dir −1 moves the carrier left (Δx < −1 yd in 0.4 s).
  - A dive in the open field gains ≥ 0.8 yd.
  - Over 5,000 seeded hits, PROTECT keeps the fumble rate at ≤ 0.4× the normal rate.
  - Average yards after first contact: ≥ 1.0 for a power back (TRK/STR 95, 245 lb) and ≤ 0.5 for a scat back.
  - A gang tackle with 2 or more defenders resolves within 0.35 s.
  - Fatigue carries across plays.
  - 99+ backs stay finite on every path (existing test).
- **CAL, AI Pro gold v gold designed runs, 300 games.**

  | Measure | Target | Baseline |
  |---|---|---|
  | ≤ 0 yd | 15–21% | 10% |
  | 1–3 yd | 32–40% | |
  | 4–6 yd | 20–27% | |
  | 7–9 yd | 8–13% | |
  | 10+ yd | 9–13% | 1% |
  | 20+ yd | 1.5–3% | 0.3% |
  | 40+ yd | 0.2–0.8% | |
  | Median | 2–4 | |
  | Mean | 4.0–4.7 | 3.76 |
  | P90 | 8–11 | |
  | P99 | ≥ 18 | 9.7 |

- **Matchups.**
  - An elite defense against a gold RB: 3.3–3.9 YPC, 21–29% stuffed.
  - An elite RB against a gold defense: 5.0–6.0 YPC, 13–18% of runs gaining 10+.
- **Run types.**
  - Inside has the lowest stuff % and the lowest P90.
  - Outside has the highest 10+ rate and the highest stuff %.
  - Power converts ≥ 65% on 3rd and 4th and 1.
- Missed tackles are 12–20% of attempts (baseline 30% at 75 v 75).
- Fumbles lost are 0.5–0.9% of carries.
- Human proxy with the 0.35 s stick: 3.8–4.8 YPC.
- **Ratings show in the tails.** An RB with SPD 95 against one with SPD 70: 10+ rate ≥ 1.5× and 20+ rate ≥ 2×.

**Screenshots.** A:
- Power with the pulling guard (lane before the snap, and mid-play)
- a gang tackle
- the truck charge meter
- a dive

**Protocol.** Needed.

**Save compatibility.** None.

**Dependencies.**
- players: the `getup` mapping and the juke, stiff-arm and truck clips.
- nfl-2: the run lane drawing shows the pull.

### nfl-6 (P0): difficulty ladder, kicking, conversions, overtime, punts and game shape (D-3, C-5, D-4)

**Changes**
- **`difficulty.ts` (shared, small hunk).**
  - `USER_DEFENSE_LEVEL = { rookie: 0.35, pro: 0, legend: 0 }`.
  - `userDefenseIQ(online, level)` returns `COMPETITIVE_DEFENSE` online, and `USER_DEFENSE_LEVEL[level]` offline.
  - `defenseDifficulty` is unchanged: the AI defense still faces you at −0.5 / 0 / 1.
- **`Arcade.tsx` NFL branch.**
  - `aiPlay(rival = true)` uses `userDefenseIQ`.
  - `POINTS` gains `TD6: 6`, `TD8: 8` and `FF: 0`.
  - A regulation count plus overtime entries replaces the fixed `TOTAL` for the NFL. `pointsThrough`, `finishedFrom` and the takeover code count the OT entries.
- **`ut/Match.tsx` (ut-owned, a few lines).** `simBoth` uses `userDefenseIQ` for the rival's offense against your defense, and the points and labels maps gain `TD6` and `TD8`.
- **`ut/match-debrief.ts` (ut-owned).** The allowed list gains `TD6`, `TD8` and `FF`, and `TD6`/`TD8` count as TDs.
- **AI ladder (`autopilot.ts`).** Per level:
  - read-count cap: Rookie 1–2, Pro 2–3, Legend by AWR
  - aim error
  - mistakes: Rookie locks onto a covered man 25% of the time
  - play-calling quality
  - pass share by down: 47 / 59 / 74 / 62%
  - time to throw 2.3–3.0 s at every level
- **Kicking (C-5), `drive.ts` and a rewritten `KickMeter`.**
  - **Tap 1 stops a vertical power needle.** It fills 0→1 over 0.9 s. Above 0.92 is a red overkick zone, which costs accuracy.
  - **Tap 2 stops a horizontal accuracy needle.** Its sweep period is `lerp(0.85, 1.35, rt(KAC))` s, so accurate kickers sweep slower. The window half-width is `lerp(0.10, 0.22, rt(KAC))` × a distance factor, with no shared floor.
  - **Wind.** Seeded per drive, −1…1, at most 2.5 yd of lateral drift at 50 yd. It shifts the window centre and shows as an arrow.
  - `kick(g, { power, aim })` decides the result, and `kickAI(g, skill)` samples the AI's errors.
  - Blocks happen on 0.5–1.5% of kicks, by DL BSH. The FG defense's rush is animated in render.
  - The needles are driven by refs or CSS, not by a per-frame setState.
- **Conversions (D-4).**
  - After a TD the drive pauses at a choice: **KICK XP** (one short tap meter, 94–97% for an average kicker) or **GO FOR 2** (one real play from the 2 using the normal tray).
  - Results: `TD` (7), `TD6` and `TD8`.
  - The AI goes for 2 by chart when it knows the score (solo), and on about 8% of TDs otherwise.
- **Overtime (D-4).**
  - When regulation is tied and both sides are done, each side plays one OT drive from the opponent's 25 (`ballOn` 75), with 4 downs and no clock. The seed is `seed + ':ot1'`, and the end is appended.
  - Still tied: a two-point try each, up to 2 rounds.
  - Still tied after that: the existing squad-rating tiebreak.
  - Online, both phones detect the tie from the wire and start OT. Solo, the AI's OT drive is run by the autopilot (played on defense after nfl-9).
  - The pure helper `src/game/football2/overtime.ts` (`needsOT`, `otSettle`) is unit-tested.
- **Punts.**
  - PUNT takes one power tap. Net distance is 36–46 yd by KPW and the tap, seeded, with the touchback rule.
  - Its value is a field-position exchange in your own next drive's start:
    - A punt that pins the opponent inside their 20 makes your next drive start 5–12 yd better than a kickoff start.
    - A turnover on downs in your own territory makes it 3–8 yd worse.
  - Solo, after nfl-9, the AI's next drive starts at the punt's landing spot or the DOWNS spot.
- **AI 4th-down chart.** Go for it on 4th and ≤ 2 past your own 40, and on 4th and 1 past your own 30. Kick in range. Otherwise punt.

**Tests and measurements**
- **Unit tests.**
  - `drive.test.ts`: conversion scoring; the OT start spot and appended ends; the punt's next-start effect.
  - `variance.test.ts`: wind and blocks are seeded and inside their bounds.
  - `overtime.test.ts`: two simulated clients get the same OT result from the seeds.
- **Kicking.**
  - At 55 yd, the window for a KAC 55 kicker differs from a KAC 95 kicker by ≥ 40%. Today they are identical (132 ms).
  - An average kicker's perfect 50-yd tap succeeds 85–90% of the time.
  - AI FG % by distance: < 30 yd 95–99, 30–39 90–96, 40–49 76–84, 50–59 65–76.
  - XP 94–97%.
- **Conversions.** Two-point tries succeed 40–50% in AI v AI.
- **Ties.** Games decided by squad rating are ≤ 2% of even-side games. Baseline: 10–13% (gold), 20% (elite Legend).
- **Game shape, AI v AI, gold v gold, Pro, 300 games** (after nfl-4 and nfl-5):

  | Measure | Target | Baseline |
  |---|---|---|
  | Points per drive | 1.9–2.4 | 3.75 |
  | TD, % of drives | 21–30 | 44 |
  | FG, % of drives | 13–20 | |
  | Turnovers, % of drives | 8–13 | |
  | DOWNS, % of drives | ≤ 9 | 12–55 |
  | Punts, % of drives | 18–35 | |
  | Red-zone TD | 50–64% | |
  | Red-zone any score | 80–92% | |
  | 3rd down, distance 1 | 60–76% | |
  | 3rd down, 2–3 | 45–61% | |
  | 3rd down, 4–6 | 37–51% | |
  | 3rd down, 7–10 | 25–39% | |
  | 3rd down, 11+ | 9–22% | |
  | 3rd down, overall | 35–44% | 49% |
  | Plays per drive | 5–7 | |
  | Pass share | 54–63%, with 3rd-down share ≥ 65% | |

- **Full-length 11-drive AI sim (research §8.1A).**
  - 21–25 points per team, P10 7–12, P90 32–40.
  - A 3-point margin in 10–17% of games and a 7-point margin in 6–12%.
  - OT in 4–8% of games.
- **Difficulty ladder.** Human proxy (skill 0.35, late reads, the 0.35 s stick, pocket on), gold v gold, 300 games per level, OT included:
  - Wins: Rookie ≥ 70% (baseline 47.5), Pro 45–55% (41.2), Legend 28–38% (29.9).
  - AI sack % 4–9% at every level (baseline 0.1–3.5).
  - AI time to throw 2.3–3.0 s.
- **Online smoke.** On the local relay (`scripts/qa/online.mjs`, NFL), a fixture tied after regulation goes to OT, and both clients settle the same winner.

**Screenshots.** A, C and D:
- the conversion choice
- the two-tap kick (power, accuracy and wind)
- the punt meter
- the OT banner
- the final card with OT marks

**Protocol.** Needed: scoring, kicks, AI, the wire codes `TD6`/`TD8` and the OT drives.

**Save compatibility.**
- Saved match records may now contain `TD6`, `TD8` or `FF`, so their readers must accept them (the `match-debrief` update).
- Old records contain only old codes.
- No key changes.

**Dependencies.**
- nba: the `difficulty.ts` and `Arcade.tsx` hunks.
- ut: the `Match.tsx` and `match-debrief.ts` hunks.
- lead: the protocol bump.
- Verify only (both files are ut's): every NFL Moment (`ut/moments.ts`, e.g. the run drill's 10 yd in 3 attempts) and Training drill is still completable by the Pro autopilot.

### nfl-7 (P0): match shell: pause and quit, HUD manager, broadcast feedback and box score (D-5, V-3, V-4 display, F-2, juice and audio, V-2 pieces)

**Changes**
- **Pause (new `src/game/football2/PauseMenu.tsx`; reuse nba's shared one if it lands first).**
  - A 44 px button at `top: calc(var(--sat) + 8px); right: calc(var(--sar) + 8px)`. It shows in every live and pre-snap state, and is hidden in final, in replays, and in `practice` (Training and Moments have their own Leave).
  - The menu has:
    - Resume
    - Controls: a diagram, the pass-layout toggle and a Precision Passing slot for nfl-10
    - Sound and Haptics, through the existing settings setters
    - Quit
  - Offline, pause freezes the fixed-step loop, replays, the kick meter and the between-play timers. A pause-aware scheduler replaces the `setTimeout` chains in `finish` and `nextUp`.
  - Online, the screen dims with "Online: the match keeps going for your rival". The rival is not paused, and their stall timer is shown.
- **Quit (D-5).**
  - A confirm sheet. Offline: "Quit match? It counts as a loss." Online: "Forfeit? Your rival wins."
  - The flow follows contract 1. `App.tsx` and `ut/Match.tsx` `finish` honour `forfeit` in at most 6 lines each.
- **HUD manager (new `src/game/football2/hud.ts` and `hud.css`, V-3).** One queue with priorities and minimum display times, cleared on phase change. Its slots:
  - **Top banner:** one-line hints.
  - **Lower-third broadcast strip:** the result pops from `say()`, moved off centre screen.
  - **Corner:** the LAST PLAY readout, positioned through our CSS; `PlayReadout` itself is unchanged.
  - **Over-head:** ability pops.

  Under reduced motion there are no slide-ins.
- **V-4 display.**
  - At most one ability pop per play: the first that changed the play.
  - Before the snap, a row of small "in the zone" chips for your players. It uses today's seeded roll until nfl-10.
- **Juice and audio (audit §9).**
  - Crowd states through the existing `crowd` and `sfx` APIs: a 3rd-down swell and roar before the snap, a red-zone swell, and a heartbeat in the two-minute drill.
  - TD sequence: a lower-third TOUCHDOWN strip, a scoreboard flip (CSS), the celebrate act and the existing replay, all skippable.
- **Box score (F-2), new `src/game/football2/boxscore.ts`.**
  - It folds each finished `Play` and `PlayEnd` into:
    - passing: completions, attempts, yards, TDs, INTs and sacks
    - rushing: attempts, yards, TDs and longest
    - receiving: catches, yards, TDs and longest
    - defense: tackles, sacks, INTs and pass breakups
    - kicking: FG and XP
  - Attribution comes from a new transient `PlayEnd.by?: string`, the player id of the tackler, interceptor or sacker. No RNG is involved.
  - `playerOfGame(box)` picks the best of (yards / 10 + 6·TD + 4·defensive INT + 3·sack + tackles − 6·turnovers).
  - `autoplay()` optionally fills a headless box for the AI side.
  - The final card is opaque: score, drive marks, the top 3 lines per side, and a player-of-the-game card. The pre-snap play is not drawn once `g.over`.
  - `onBoxScore` is passed up (contract 4).
- **V-2 pieces that are ours.**
  - The ball-carrier name chip is 1.5× larger (render HUD `label` scale).
  - Draft fill-ins: a new `realDepth(pos, level, seed, slot, exclude)` in `squad.ts` picks a real player from the draft data (`CELLS`) at the team's level for the WR2, slot, DL, LB, CB, S and RB fill-ins. It is seeded, excludes drafted names, and rates through `fromDraft`.
  - OL and K keep "POS #", since the draft data has no OL or K.
  - UT's `depth()` is untouched.

**Tests and measurements**
- **`boxscore.test.ts`.**
  - Passing and rushing yards reconcile with the sum of play gains, by the stated rules for sacks and penalties.
  - Points equal `g.score`.
  - The player of the game is deterministic.
- **`hud.test.ts`.** Priorities, the one-pop rule, and clearing on phase change.
- **`squad.test.ts`.** Fill-ins have real names, are deterministic, have no duplicates and have finite ratings.
- **New `scripts/qa/nfl-shell.mjs`.**
  - Offline pause holds `p.t` for 3 s, and resume continues.
  - Offline quit shows a loss.
  - Online, two clients on the local relay: A quits during drive 2, B shows a win within 5 s, and A shows a loss.
  - HUD overlap at A, B, C and D: the pairwise intersection area is 0 among the score bug, drive marks, pause button, readout chip, hint, lower-third strip and the controls. Baseline: LAST PLAY overlaps the hint in landscape, and sits 3 px from the marks in portrait.
  - Every hint and pop is one line at C.
- **Pops and strip.** Ability pops ≤ 1 per play (baseline 0.7–2.4). The result strip stays on screen 0.8–1.6 s.
- **Final card.** Opaque: a pixel sample behind it shows no route lines.

**Screenshots.** A, C and D:
- pause menu
- quit confirm, online and offline
- the box-score final
- the lower-third strip
- before-snap names with real fill-ins, against the audit's `390-01` ("WR 81")

**Protocol.** Needed for the draft (fill-ins become real rated players) and for the `FF` code.

**Save compatibility.** None.

**Dependencies.**
- nba: `Arcade.tsx` quit plumbing, and possibly a shared pause component.
- ut: `Match.tsx` `finish`, and consuming `onBoxScore`.
- `App.tsx` (shared): the forfeit hunk.
- shell: safe-area variables.

### nfl-8 (P1): playbook depth and the AI defensive call table (P-2, D-1)

**Changes (`engine.ts`, `types.ts`, `drive.ts`, `autopilot.ts`, `PlayTray`, `PlaybookDialog`, `play-feedback.ts` NFL labels)**
- **Formations (at least 5):**
  - Gun Spread (today's)
  - Gun Trips
  - Singleback (under centre, TE inline)
  - Pistol
  - Empty
  - Heavy/Goal Line, for short yardage, with the slot as a wing TE

  The personnel stays QB, RB, 3 WR, TE and 5 OL, so there is no I-Form fullback.
- **Plays, about 20 in all:** the 8 existing concepts and 3 runs, plus:
  - **PA Post and PA Boot.** `p.pa`: LBs and safeties read run keys for `lerp(0.6, 0.35, PRC)` s through the existing `readUntil`. Boot is a QB rollout.
  - **RB Screen and WR Bubble.** The OL releases after 1.0 s.
  - **HB Draw.** The QB drops for 1.2 s, then hands off.
  - **QB Sneak.**
  - **Toss.**
  - **Counter.**
  - **Hail Mary.**
  - **Spike**, in the two-minute drill only: an incompletion that takes 1 s off the clock.
- **Suggestions.**
  - `choices(g)` deals 3 cards from a situational table:
    - 3rd and ≤ 2: Sneak, Power, Slants
    - 3rd and 7+: Dagger, Smash, Flood, a screen
    - red zone: corner and fade routes, Power, play action
    - two-minute: outs, Hail Mary, Spike
    - 1st and 10: a run, play action, a quick pass
  - One card carries a Coach Pick badge with one line of reasoning ("Two deep shell: the seam is open").
  - Every card has a one-line "beats Cover 3 / man / blitz" note.
- **Hot routes.** Before the snap, tapping a receiver icon (from nfl-3) cycles default → go → slant → out. `setHotRoute` locks at the snap.
- **D-1, the defensive call table.** Calls:
  - Cover 0
  - Cover 1
  - Cover 1 Robber
  - Cover 2
  - Tampa 2
  - Cover 3
  - Cover 4 (Quarters)
  - Zone Blitz
  - Sim Pressure
  - Goal Line
  - Prevent

  Calls are keyed by down, distance, field zone, clock and difficulty:
  - **Rookie:** a random pick among 4 basic calls.
  - **Pro:** situational.
  - **Legend:** situational, plus counters to formation (for example rotating against Trips), plus disguise.

  Rushers range from 3 to 6. The RB on a `check` route and the TE stay in to pick up a free blitzer. A SVG "FREE RUSHER" flame marks an unblocked blitzer before the snap; it is rarer on Legend, because of disguise. The coverage shell shows before the snap and rotates after it on 25–35% of Legend snaps, 10–15% of Pro and 0% of Rookie.

**Tests and measurements (CAL)**
- **Call mix**, 1,000 Pro snaps:
  - at least 6 distinct calls
  - on 3rd and 7+, ≥ 30% two-high or blitz
  - in the red zone, ≥ 30% man, Cover 0/1 or Goal Line
- **Every call has a beater.** At least one concept completes ≥ 10 points above its average against that call, and every concept has a call that holds it ≥ 10 points below.
- **Blitz risk and reward.** Sack rate ≥ 1.5× base, and allowed 20+ yd play rate ≥ 1.3×.
- **Play action.** Completion is +5 points or more against the same concept without PA, when the defense is in a run-heavy call.
- **Screens.** Behind-the-line completion 74–84%, YAC ≥ 6.
- **Sneak.** 3rd and 4th and 1 converts 65–80%.
- **Suggestions.** Never offer Sneak on 3rd and long.
- **Bands.** Every band from nfl-4, nfl-5 and nfl-6 is still met on a CAL re-run.
- **UI.** The playbook shows formation tabs, at least 18 plays and the notes, within bounds at A, C and D (re-run `nfl-presnap.mjs`). Every control is ≥ 44 px.

**Screenshots.** A, C and D:
- playbook tabs
- the Coach Pick card
- the FREE RUSHER icon
- a hot route
- a PA boot
- Cover 2 against Smash

**Protocol.** Needed.

**Save compatibility.** None; the playbook is not saved.

**Dependencies.** players: an optional play-action fake and QB rollout animation. Until then the existing `run` and `throw` acts are used.

### nfl-9 (P1): solo defense, Big Hit, quick sim, pacing and crowd pressure (D-2, Big Hit ring, mobile pacing, crowd)

**Changes**
- **Engine (`engine.ts`).**
  - `Play.user?: { id: number; input: Pt; tackle?: boolean; swat?: boolean; hitAt?: number }`, read in `defense()` for the controlled defender.
  - TACKLE dives when the carrier is within 2.6 yd.
  - **Big Hit:** as the defender closes, a ring shows. A tap inside the green window, `lerp(90, 160)` ms by HIT and TAK, is a big hit with a 6–8% fumble chance (+2% for Enforcer). An early or late tap is a normal wrap tackle with a broken-tackle chance.
  - SWAT/PICK on a ball in the air within reach uses the facing rule from nfl-4.
  - Without `p.user`, results are unchanged.
- **Flow (`Football2.tsx` and new `DefenseDrive.tsx` with `defense.css`; `Arcade.tsx` NFL branch per contract 2).** This applies to solo games only: draft vs AI and UT Squad Battles, Cups, Club Season, Events and Draft games. It does not apply to Moments or Training.
  - The order is: your drive k, then the AI's drive k on defense, and so on, then OT.
  - A second `FootballRenderer` draws the defense with the kits swapped. The controlled defender gets a ring and a name chip.
  - **Defensive pre-snap:** 3 suggested calls from the D-1 table, plus ALL CALLS. Tap a defender to control him; the default is the deepest safety or the MLB, by call. SWITCH (44 px) moves control to the defender nearest the ball.
  - **AI side:** the AI offense is run by the pilot. Your other defenders run the call, at `userDefenseIQ`.
  - **Rival score:** it updates live through `onRival`.
- **Auto-defend and Sim Drive.**
  - The default is "play".
  - A SIM DRIVE button on the defensive call screen sims the drive on the `aiDrivesOf` seed path.
  - The default can be changed in pause → Controls (pref `perfect-season:fb2-defense`, `'play' | 'sim'`).
  - An offensive SIM DRIVE sims your current drive from the current spot at pilot skill 0.6. It is disabled when `manualOnly` (Circuit, League and Cup require a played match).
- **Pacing.**
  - After-play waits: non-scoring 1,350 → 800 ms; first down 1,300 → 900 ms.
  - TD celebrations skip on a tap at any time.
  - Replays stay skippable.
- **Crowd pressure (`crowd = 'road'`, solo only).**
  - A gentle shake on 3rd downs and in the red zone. Under reduced motion it becomes a pulsing border.
  - On red-zone 3rd downs, the icons' open/covered tints are hidden.
  - The kick meter fades after it appears.
  - A 20+ yd first-down gain silences the crowd for the rest of the drive.
  - `'home'` games get only crowd swells. Online games never get crowd pressure.

**Tests and measurements**
- **Engine.**
  - The controlled defender follows input.
  - TACKLE works only in range.
  - The facing rule applies to SWAT/PICK.
  - The Big Hit window matches its formula.
  - **Determinism guard:** a hash of 200 seeded AI plays with no `p.user` is identical before and after this task, so online play is untouched.
- **Proxy user-defender bot** (0.35 s reaction, average timing), Pro gold v gold:
  - The AI's points per drive against a played defense are within ±25% of the Sim Drive baseline, over 300 drives.
  - A perfectly timed Big Hit in range lands on ≥ 80% of attempts.
- **Timing.**
  - Median defensive drive wall time ≤ 75 s played (lab timing).
  - From the whistle to the next tray ≤ 0.9 s on non-scoring plays.
  - From a TD to the tray ≤ 2.5 s, or ≤ 0.4 s after a tap.
- **New `scripts/qa/nfl-defense.mjs`.**
  - A solo draft fixture alternates drives through a full match: a call is picked, SWITCH, a tackle and a Sim Drive all work.
  - Online on the local relay, the match stays parallel with no defense UI.
  - Every control is ≥ 44 px, with no overlaps at A, B, C and D.
  - The reduced-motion crowd variant works.

**Screenshots.** A, C and D:
- the defensive call screen
- the controlled defender with the Big Hit ring
- a swat
- a Sim Drive
- road crowd pressure, plus the reduced-motion border

**Protocol.** None. It is solo-only, and the engine additions are inert without `p.user`, as the determinism guard proves.

**Save compatibility.** New pref key `perfect-season:fb2-defense`.

**Dependencies.**
- nba: the shared `Arcade.tsx` solo-defense contract.
- ut: `Match.tsx` passes the `crowd` flag. The solo pre-match screen may show Play defense / Auto-defend. Rewards are unchanged.
- players: tackle and swat use the existing `tackle` and `catch` acts.

### nfl-10 (P1): momentum, timing skill, returns and the team's final QA (V-4 earned zone, defensive On Fire, Precision Passing, SNAG, G-6, A-1 leftovers, QA)

**Changes**
- **Earned zone (`engine.ts` and `drive.ts`; replaces the `ABILITY_ON` coin flip).** `Game.zones` is transient. Each ability enters on a trigger and leaves on a knockout:

  | Abilities | Enter on | Leave on |
  |---|---|---|
  | Cannon (QB) | a completion of 20+ air yards | a sack or an INT |
  | Surgeon (QB) | 3 straight completions | a sack or an INT |
  | Scrambler (QB) | a QB run of 8+ | a sack or an INT |
  | Deep Threat, Sure Hands, Red Zone (WR/TE) | 2 catches of 10+ (Red Zone: a red-zone catch) | 3 straight plays not targeted, or a drop |
  | Truck Stick, Juke Box (RB) | 2 runs of 8+, or a broken tackle | a run for a loss |
  | Pocket Wall, Road Grader (OL) | 3 clean dropbacks, or 2 runs of 5+ | a sack or a stuff allowed |
  | Edge Threat, Run Stopper (DL) | a sack, pressure or tackle for loss | a 20+ yd gain allowed |
  | Enforcer, Shutdown, Ballhawk (LB/DB) | a pass breakup, INT or big hit | a 20+ yd catch allowed in his area |

  - Big Leg stays always on. Heat Check and Icon are unchanged.
  - While in the zone, an ability's effect fires on about 50% of the plays where its conditions are met, by a seeded roll.
  - The pre-snap chips from nfl-7 show the zone, plus a "1 more catch" meter. Entry and exit pops count toward the one-pop rule.
- **Defensive On Fire.**
  - It lights after 2 straight sacks or a takeaway: rushers' `winAt` comes 0.3 s sooner and their speed rises 3%.
  - It goes out on a 10+ yd first down allowed.
  - It applies to the AI defense in every mode, and to your defense in solo. It gets a flame chip.
- **Precision Passing** (optional; pref `perfect-season:fb2-precision`; default on at Legend, off at Rookie and Pro).
  - For a BULLET, a ring sweeps once around the target in 0.5 s.
  - A release inside the green window, `lerp(90, 160)` ms by accuracy for that depth, multiplies `throwErrorRadius` by 0.7.
  - Early and late releases get normal accuracy. There is never a forced miss.
- **SNAG catch tap.**
  - While the ball is in the air to your receiver, a ring fills.
  - A tap in the green raises the contested-catch chance by 0.12. The window is 200 ms open, 140 ms covered and 90 ms smothered.
  - Missing the tap never forces a drop.
- **Returns (G-6), render only.**
  - After an INT or a lost fumble, a 1.2 s scripted return (render RNG, 5–25 yd, then the tackle). It is skippable and does not change the score.
  - An incompletion's ball bounces and tumbles for 0.6 s instead of vanishing.
- **A-1 leftovers.** Confirm the players team's mappings for `getup`, juke → `cut`, stiff arm → `stiff_arm` and truck. List any gaps in `nfl.md`.
- **Team final QA.**
  - `bash O/heavy.sh npm run typecheck`
  - `bash O/heavy.sh npm test` (all three sports)
  - `bash O/heavy.sh npm run build`, once
  - The QA scripts at A, B, C and D and under reduced motion: `joystick.mjs`, `rushing.mjs`, `core-gameplay.mjs`, `play-feedback.mjs`, `gameplay.mjs` (NFL), `online.mjs` (local relay) and every new `nfl-*.mjs`.
  - A full CAL re-run with every band.
  - A performance run like `nfl_perf.cjs` on port 5216.
  - The final before and after screenshot set.
  - `nfl.md` finished, including "Owner device checks".

**Tests and measurements**
- The zone state machine is unit-tested for triggers and knockouts.
- Ability pops ≤ 1 per play.
- A star is in the zone on 25–60% of plays, over 200 games.
- Defensive On Fire lights after 2 sacks and goes out on a 10+ yd first down.
- Precision window math is unit-tested.
- **SNAG property test, over 2,000 seeds.** The catch chance with any tap timing is ≥ the chance without a tap.
- Returns are render-only: seeded results are identical with returns on and off, in the style of `juice.test.ts`.
- **Final QA.**
  - Full `npm test`, typecheck and build pass.
  - Zero page errors.
  - Performance at 4× CPU throttle:
    - p99 ≤ 25 ms (baseline 33.4)
    - frames > 33 ms ≤ 5 in 15 s (baseline 10)
    - long tasks totalling ≤ 250 ms (baseline 527)
  - All CAL bands from nfl-1 to nfl-8 are met.
  - `nfl.md` has before and after tables for every metric in §3.

**Screenshots.** A, C and D:
- zone chips and meter
- defensive On Fire
- the Precision ring
- the SNAG ring
- an INT return
- an incompletion bounce

Plus the final full set beside the audit shots.

**Protocol.** Needed.

**Save compatibility.** New pref key `perfect-season:fb2-precision`.

**Dependencies.**
- players: the mapping list.
- lead: the bump.

---

## 7. Deliberately deferred

Each item is listed in `nfl.md` with its reason.

- **F-1: a 6-drive "Standard" length, timeouts and a running clock on drives 1–3.** These change the match format and session length (3–6 minutes is the mobile target, research §8.9). They also change UT pacing and the online takeover timing across both phones. The owner has not asked for a longer format. The spike is included in nfl-8, and the two-minute copy is fixed in nfl-2.
- **G-6: a kickoff-return mini-play, defensive TDs (pick-six), and safeties awarded to the opponent.** In the parallel format, scoring for the other side needs new wire and score semantics, which is a lead decision (the audit also calls it a later item). The return animations are included in nfl-10, render only.
- **Adaptive counters** (the AI shading to a concept called 3 times in 6 plays, research §8.8.2). This needs per-game tendency state on top of the new call table. Revisit once D-1 is calibrated.
- **Hot/Cold player states** (research §8.6.4). The research marks them as flair only, and earned zones cover the readable momentum layer.
- **Throwing lanes and height-based Field Vision with batted balls** (research §8.2.3). These are not in the stream's scope, and they risk feel-bad incompletions. Revisit after calibration.
- **A defensive camera rotated behind your defense.** The perspective floor (`pixel/persp.ts`, owned by players) assumes a camera looking up the field. The defense uses the broadcast camera behind the offense, and the landscape side camera works as is.
- **Floor yard-number LOD (V-1) and the 4-per-frame sprite budget (A-1, the frozen near players).** Both live in `pixel/**` and the player-drawing code, owned by players. They are requested in `nfl.md`.
- **Player looks (V-2), mocap clips for the juke, spin, stiff arm and truck, and the `getup` clip mapping.** These belong to players. We supply engine acts only.
- **The overall-99 cap** (research §8.12). This is card display, owned by packs and ut. The engine keeps above-99 bounded and finite.
- **Real names for OL and kicker fill-ins in draft games.** The draft data has no OL or K. Loading the UT card pool into draft games would add first-paint weight.
- **An intentional-grounding penalty for in-box throwaways.** The throwaway is simply refused inside the box, which is simpler on a phone.

## 8. Owner device checks (only a real iPhone can confirm)

- The catch-and-run feel without touching the stick. The HOLD TO RUN ghost while the ball is in the air.
- The play-call tray on the owner's phone (393×852 with the Dynamic Island): formation visible, cards readable, SNAP reachable with one thumb.
- Two-thumb passing: the stick moves the QB while the other thumb slingshots. The second-finger bullet/lob tap. Receiver icons tappable mid-route.
- Kick meter feel: two taps, wind readable.
- Defense controls: SWITCH, TACKLE and the Big Hit timing, and whether the camera reads well on defense.
- Pause during an OS interruption. Online forfeit confirm.
- Haptics on big hits and sacks. Crowd pressure (and its reduced-motion version) in a road Club Season game.

## 9. Risks

- **Calibration interplay.** nfl-4, nfl-5, nfl-6 and nfl-8 all move the same distributions. Every task re-runs the full CAL set, not just its own bands. Calibration first, then playbook depth (nfl-8 re-verifies).
- **Scoring will look lower.** At 2.1 points per drive (the brief's target), a 4-drive arcade game averages about 8–10 points a side. Research §8.1B suggested 3.1–3.5 for played arcade drives. The brief's number is followed, and the tension is flagged to the lead in `nfl.md`. Conversions and OT keep ties settled on the field.
- **Shared-file conflicts with nba in `Arcade.tsx`.** Pause and quit, solo defense and OT all touch its flow. Hunks stay in the NFL branch, and the contracts in §4 are shared early through the team docs.
- **Moments and Training.** Kicking and calibration changes must leave every NFL Moment and Training drill completable. This is checked in nfl-6 and nfl-10.
- **Performance on A13-class phones.** Receiver icons positioned every frame are written through refs, not React state. The second renderer for defense is created lazily and disposed between drives.
