# Studio overhaul, team soccer: build plan (revision 2)

Planner: Claude (Anthropic). Revision 1 was 2026-11-09 (`0daa00a`). Revision 2 (2026-11-10) answers the independent critique of revision 1. §0 lists every critique point and what happened to it. Risks are in §11 and targets in §4.

Worktree `/home/user/ps-s-soccer`, branch `claude/studio-soccer`, dev port 5217. Team doc (the engineers keep it current): `docs/studio-overhaul/soccer.md`.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full:**
- `O/BRIEF.md` (including the binding OWNER DECISIONS), `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-soccer.md`
- `O/audit-soccer.md`, `O/research-soccer.md`, the audit harnesses `O/audit-scripts/soccer_*` and their outputs
- `docs/SOCCER-ENGINE.md`, `docs/SOCCER.md`, `CLAUDE.md`
- all of `src/game/soccer2/`, plus the soccer paths in `Arcade.tsx`, `ut/Match.tsx`, `ut/teams.ts`, `lib/sound.ts`, `game/juice.ts`, `game/replay.ts`, `play-feedback.ts`, `soccer-lazy.ts`

**Read for revision 2,** for the contracts we adopt:
- nba-plan: nba-7 (forfeit, `Progress.forfeit`, box) and nba-9 (alternate format, SIM, `autoDefend`)
- nfl-plan: contract 1 (`'FF'`, the 6th `onFinish` argument), contract 2 (`onRival`), Sim Drive
- ut-plan: §3 contracts A and B, ut-4 (`ut.live`, forfeit settlement) and ut-5 (MatchRecap, verdict)
- shell-plan: Fix A (`--sat` = inset + edge), ArenaCurtain/`arenaReady`, `arena-tips.ts`, the 375×667 preset
- players-plan: players-1 (sprite budget), players-5 (locomotion, facing), players-8 (action contract, `impact.ts`, `HitStopCap`), players-9 (`celebrate.ts`, run-ins on `goalAt`)
- `O/audit-likeness-animation-perf.md` A-5 and `O/audit-ut-ui.md` M3

## 0. What changed in revision 2

- **The binding owner decisions now drive the plan.**
  - Every rival attack in a solo match is a defend phase by default. There is one Auto-defend switch, plus SIM per attack and per defend phase (decision 2).
  - The solo match is tuned to a measured 4–6 minutes, using human-proxy input (decision 3).
  - Both are covered by soccer-8 (engine) and soccer-9 (flow).
- **Guards come first.** soccer-1 records every harness baseline before any engine edit and creates:
  - the golden hash, including post-whistle state;
  - the two-phone agreement test (takeover, taken, simBoth, agreed shootout);
  - the test wall-time baseline.
- **Shared contracts replace soccer-only hooks.** Soccer adopts the contracts the other teams already published (§5): ut contract A (`Progress.box`), ut contract B (`onQuit(us, them)`), the nba/nfl forfeit (`'FF'`, `Progress.forfeit`), solo `onRival`, the players action fields and `impactOf`/`HitStopCap`/`celebrate.ts`, and shell's `ps:arena-ready`. Soccer wires each one once.
- **One calibration point.** The whole-match fit moves to soccer-6, after the last task that changes AI-vs-AI outcomes. soccer-7 to soccer-9 are presentation or solo-only and must keep the golden hash unchanged. That is how revision 2 meets the critique's "recalibrate after everything" within the 10-task limit (§0.2 #7).
- **Re-cut tasks.** Each task now covers one subsystem with one test loop. The control layout comes before the camera. Shooting and keeping share one loop. Defending is split from the rolling-ball dribble. Defend phases are two tasks. The QA gate is a task of its own.
- **Three P1 blocks are deferred, with full specs kept,** so the plan stays at ten tasks of one session each:
  - shot types and skill moves (C-3), together with the rolling-ball touch model and shielding (Appendix A);
  - formation templates (U-1 part 2; Appendix B);
  - the commentary ticker (J-4; Appendix C).

  What stays of each is listed in §12. If the lead grants an 11th session, Appendix A is next.

### 0.1 Critique: missing items

| # | Point | Resolution | Task |
|---|---|---|---|
| 1 | Per-phase SIM (decision 2) | Accepted. **SIM THIS DEFENCE**: a 44 px chip at each defend phase, in any solo mode. It auto-defends that phase on the same engine and seed path that Auto-defend uses. **SIM THIS ATTACK**: solo only, hidden when `manualOnly`. The autopilot at 0.6 plays the attack from its set-up on the same seed path (as `Arcade.sim` does for a whole match). | soccer-9 |
| 2 | Defense played by default (decision 2) | Accepted. All seven rival attacks are defend phases. One boolean pref `autoDefend`, default `false`, with the same meaning as nba's. The rev-1 `'key'` mode is dropped. Research §7.4's "2 of 7" is overridden by the owner decision; this is recorded in the team doc. | soccer-9 |
| 3 | A 4–6 min solo match (decision 3) | Accepted: measured targets (§4 F1–F3) and named pacing knobs (`PACE` table), tuned with human-proxy real-time play. | soccer-9 |
| 4 | Online quit is a forfeit; adopt the shared forfeit | Accepted. `'FF'` (worth 0) goes into the soccer `POINTS` (`Arcade.tsx:33`), the soccer `END_LABEL` (`ut/Match.tsx:201`) and `END_TEXT`/`AttackEnd` in `soccer2/match.ts`. `Progress.forfeit` is honoured. The rev-1 "remaining attacks = T" fallback is removed (it was an exploit). | soccer-7 |
| 5 | ut contract A (`Progress.box`) | Accepted. `buildBox` maps played events to `BoxLine[]` with the soccer keys `goals assists shots onTarget saves tackles keyPasses conceded` and a 1–10 rating. It is stripped before the wire. The `onSoccerReport` prop is dropped. | soccer-7 |
| 6 | ut contract B (`onQuit(us, them)`) | Accepted. Solo quit calls it. The host decides between "leave with no result" (Squad Battles) and the ut-4 forfeit (Cup, Circuit, Season, Draft). | soccer-7 |
| 7 | Shell hooks | Accepted. Soccer dispatches `ps:arena-ready` once after the first frame drawn with pitch and sprites. That is the event shell's `arenaReady()` sends, so no shell module is imported, and the lead may swap in the call at merge. Soccer's 4–6 tip lines for `src/shell/arena-tips.ts` go in our team doc for shell: drafted in soccer-2, final in soccer-9. | soccer-3, soccer-2, soccer-9 |
| 8 | Last-play coaching (`soccerFeedback`) | Accepted. Each task adds the lines and miss reasons for its own mechanics in small hunks inside `soccerFeedback` (`play-feedback.ts:135`), tested in a new `src/game/play-feedback-soccer.test.ts`. The file is now in the §8 table. | soccer-4, 5, 6, 8 |
| 9 | Research §7.5 keeper items untested | Accepted. Cross claims, far-post no over-commit, save% by distance band, one dive per shot, and lost rush races are all tested. | soccer-4 |
| 10 | Shootout kick 70–75% and both-phones agreement | Accepted. The agreement guard exists from soccer-1; the target is fitted in soccer-6. | soccer-1, soccer-6 |
| 11 | PAC-only gradient | Accepted. | soccer-5 |
| 12 | B-6 keeper skill tell (run-up stutter) | Deferred (§12). Today the human keeper pre-commits DIVE/STAY before the run-up, so a tell has nothing to inform. It belongs with the swipe-to-dive shootout keeper (deferred C-4 item). | — |
| 13 | Per-level 0-0 and draw targets | Accepted: AI-vs-AI per level in soccer-6, and with human defending in soccer-9. | soccer-6, soccer-9 |
| 14 | Rating-gap target (research §7.13) | Accepted (§4 A13). | soccer-6 |
| 15 | Research §7.7 Team plan | Deferred (§12). The one-tap choice lives on ut's PreMatch screen (ut-4), and online it would need a wire field. P2, after the deal is calibrated. | — |
| 16 | First-time pass test; jog 75%; SHOOT ≥ 64 px and 8–16 px spacing | Accepted: first-time multiplier test in soccer-4, jog 75% in soccer-5, button sizes and a spacing setting in soccer-2. | soccer-4, 5, 2 |
| 17 | Redraw the q=2 floor only when the camera moves (audit §11) | Accepted: an offscreen floor cache keyed by the quantised camera. | soccer-3 |
| 18 | Half-time, kick-off, substitutions, highlight replays, +XP tick | **Accepted:** half-time and kick-off cards (they are also pacing knobs). **Deferred:** substitutions (eleven-a-side engine, no bench in `Squad`, no stamina model) and per-attack highlight replays on the full-time card (P2; the goal replay exists). **Handed off:** the +XP tick goes to ut, because card XP lives in their recap. | soccer-9, §12 |
| 19 | Attack-loss target (§2.3); AI-1 switch play untested | Accepted (§4 A10 and a switch-play test). | soccer-5 |
| 20 | Likeness A-5 coordination | Accepted. A render-only `Body.look` (facing at the ball) and act `'jockey'`. Players route `'jockey'` to `shuffle`/`shuffle_l` and drifting to walk (players-5); written into the §5 contract. | soccer-5 |
| 21 | Action contract does not match players' | Accepted. Soccer uses players' field names `kickFoot`, `diveHeight`, `touchAt`, `passKind`, `slide`, plus `look`. Hit-stop goes through one seam (`fx.ts`) that the lead points at `impactOf`/`HitStopCap`. Celebrations come from players' `celebrate.ts` and their run-ins on `goalAt`. Soccer's own celebration picker and the `settle()` celebration steering are dropped. | §5, soccer-3, 4, 5, 8 |
| 22 | ut M3: "A tie goes to the better squad: yours." after a penalty shootout | Accepted as a hand-off. The report says `outcome 'D'` plus `pens`. ut fixes the note (`ut/Match.tsx:1449`; the flag is set at ~700) in ut-5's `verdictOf`. Written in our team doc. | soccer-7 |
| 23 | Gesture-conflict matrix | Accepted (§5.8). Rows for in-scope gestures are implemented in soccer-2 and soccer-8; the skill-swipe and shot-trace rows are reserved for Appendix A. | soccer-2, soccer-8 |
| 24 | QA tooling: lab params; local relay by PID | Accepted. Each task adds the lab params it needs (listed per task). The H2H relay runs in-process, as `scripts/qa/online.mjs` does. A standalone relay, if ever used, is started and stopped by PID file. | soccer-1 + tasks |
| 25 | Credit for the xG tables | Accepted: a `docs/CREDITS.md` entry for StatsBomb open data (CC BY-SA 4.0). | soccer-4 |
| 26 | 375×667 (20/0) preset | Accepted. | soccer-1 |
| 27 | Scorer plate "1st goal" | Accepted: it means "in this match" ("1ST GOAL TODAY"). Career goals need UT state, so they are handed to ut. | soccer-7 |

### 0.2 Critique: restructure items

| # | Point | Resolution |
|---|---|---|
| 1 | soccer-1 baseline first; golden there; re-baseline with a reason | **Accepted.** soccer-1 step A commits the harness port, the baseline tables, the golden hash, the agreement test and the wall-time baseline before any engine edit. Every outcome-changing task (soccer-1 step B, soccer-4, 5, 6) re-baselines golden and writes the reason in the team doc. Every other task must leave it unchanged. |
| 2 | Control layout before the camera | **Accepted.** soccer-2 builds the floating stick, the left-thumb sprint, button sizes and spacing, and the safe box. soccer-3 frames the camera against that final cluster. |
| 3 | Split rev-1 soccer-2 | **Accepted.** soccer-2 is the control cluster and HUD. soccer-3 is the pure `camera.ts`, framing, markers, floor cache and render juice. |
| 4 | Rev-1 soccer-3 as three tasks | **Partly accepted: two tasks.** soccer-4 is shots, keepers and xG, because conversion by distance is shot cone × keeper; fitting them apart would mean fitting twice. soccer-6 is restarts, set pieces, the deal and the whole-match fit. Reason for not making three: the 10-task cap. |
| 5 | Split rev-1 soccer-4 into 4a/4b | **Partly accepted.** soccer-5 is 4a plus only the sprint-cost parts that P0 B-1 needs: sprint and DRI touch length as the poke's exposure, turn caps, first-touch error, lofted error, jog 75%, and close control at partial stick. The ball still sits at the feet between frames. The rolling-ball touch model and shielding are deferred with skill moves (Appendix A), which removes the "changes every scenario" risk from this overhaul. |
| 6 | Move defend phases earlier and split them | **Accepted.** Defend phases are soccer-8 (engine API, keeper RUSH, auto-switch) and soccer-9 (flow, Auto-defend, SIM, ladder, 4–6 min). Rev-1 8c is split between them. Formations no longer come first (their templates are deferred). |
| 7 | A recalibration task after the last gameplay task | **Accepted in substance, not as a task.** Every AI-vs-AI outcome change now lands in soccer-1, 4, 5 and 6, and soccer-6 ends with the whole-match fit. soccer-7 to soccer-9 are golden-guarded (presentation, or solo-only paths with `human` unset). The outcome changes the critique named after the fit (shapes, shot types, skill moves) are deferred. Rule: any later task that changes AI-vs-AI outcomes re-runs `sim.ts 400 all`, `realism`, `human.ts`, `ratings-human.ts` and `setpieces` inside that task. soccer-10 re-measures everything. |
| 8 | Split rev-1 soccer-6; start the report earlier | **Partly accepted.** It stays one task (soccer-7) because of the cap, and is written against the published contracts (nba-7, nfl contract 1, ut A/B), as the critique allows. "Earlier gives ut data sooner" is rejected: branches merge only at integration, and ut reads contract A duck-typed (`match-ratings.ts`), so the order inside our branch doesn't change when ut gets data. |
| 9 | Gate as its own task | **Accepted.** soccer-10 is the gate only. Juice moved to soccer-3; commentary is deferred. |
| 10 | Replace soccer-specific Arcade hunks with the shared contracts | **Accepted** (§5, §8). The remaining soccer lines in `Arcade.tsx`: <br>• the soccer branch of `aiPlay` calls one soccer function (soccer-1); <br>• `'FF'` in the soccer `POINTS` and the `onQuit` prop (soccer-7); <br>• the solo `onRival` props in the same shape as nba-9/nfl contract 2, so the lead can fold the three into one block (soccer-9); <br>• two lines of kick-off copy (soccer-9). |
| 11 | Gate the ladder's role to `!online` before anything builds on it | **Accepted.** soccer-1 routes Arcade's soccer `aiPlay` and ut `simBoth` through `aiProgressFor(..., { rival, online })`, identical to today. The agreement test guards it from day one. The offline-only ladder lands in soccer-9. |
| 12 | Post-integration re-measure | **Accepted as a soccer-10 deliverable, not a task:** `scripts/soccer/remeasure.sh` and a checklist the lead runs on the merged branch (re-rates, sprite budget, feet, Fix A). Soccer re-tunes when the lead asks. |
| 13 | Owner decision 3 needs human-proxy real-time measurement | **Accepted** (soccer-9). |
| 14 | Test runtime budget | **Accepted** (§3.3). Wide guards live in vitest and tight bands live in the harnesses. Cap: the soccer suite runs in ≤ 120 s wall time, with the baseline recorded in soccer-1. |

## 1. Goals

1. **It looks like football on a phone.**
   - Your passing options are on screen, the goal is in view near the box, and nothing in the HUD covers the ball, the goal or your man.
   - Players stay big enough to tell apart, and the crowd sounds like a football ground.
2. **Skill beats exploits.**
   - Sprinting at goal and holding SHOOT stops being the best play.
   - Better cards are better on a smooth curve.
   - Aiming, passing, timing and good defending are rewarded.
3. **The numbers look real.**
   - Shots, on-target share, conversion and save% by distance, blocks, penalties and free kicks land near real top-flight football (times the documented arcade factor).
   - Scorelines stay believable: about 2.4–2.7 goals and about 25% draws.
4. **It is a match** (owner decisions 2 and 3).
   - In solo play you defend every rival attack by default, with Auto-defend and SIM. A match takes 4–6 minutes.
   - The difficulty ladder is honest.
   - There is a proper full-time moment, and ut gets real per-player data.
   - Pause, quit and forfeit work.
5. **It feels like the respected games, on a thumb.** A floating stick with sprint on the left thumb, readable controls, juice that respects reduced motion, and animation hooks in the players team's format.
6. **Nothing breaks.**
   - No save, storage key, card or copy id changes.
   - Online soccer gets one protocol bump, done by the lead. NBA and NFL are untouched.
   - Preserved: determinism, bounded ratings, the 2026-11-02 aim/shoot/pass contract with its miss reasons, the keeper model, offside and the shootout rules.

## 2. Baseline (measured by the audit on `acdf3e2`; re-measured in soccer-1 step A before any edit)

| Area | Baseline | Source |
|---|---|---|
| AI vs AI, Pro (400 matches) | 2.33 goals/match, draws 26.8%, 0–0 7.8%, 5.21 shots/side, on target 53.7%, goals/shot 20.4%, save% 61.9%, blocked 11.3%, woodwork 4.2%, pens 93% (n=43), direct FK 2.3% | `soccer_table_all.txt` |
| Legend | 0–0 14.5%, draws 31% | same |
| Conversion by distance (Pro, open play) | 0–6 m 59.5%, 6–11 m 45.0%, 11–16.5 m 23.4%, 16.5–22 m 15.8%, 22–30 m 5.5% (Legend 12.3%), 30 m+ 3.1% (Legend 14.5%). Only 3.3% of shots come from 22 m+. | same |
| Attack ends (Pro) | goal 16.7%, lost 33.7% (intercepted 13.2%, aerial 8.4%, tackled 6.4%), wide 22.5%, saved 15.2%, blocked 8.4%, offside 3.0%, time 0.6% | audit §2.3 |
| Difficulty (AI goals per side) | Rookie 1.17, Pro 1.17, Legend 0.99 (inverted) | same |
| Dominant no-skill run (counter, beeline, SHOOT @16 m) | 58.5% (Pro) / 40.0% (Legend), against the autopilot's 20.0% / 12.5% | `soccer_human_out2.txt` |
| Same at 30 m | counter 22.5%, build 16.0% (real ≤ 2%) | same |
| Fouls won by beelines | FK up to 28% of runs, penalties up to 15.5% | same |
| Rating cliff (counter beeline vs a 78 defence) | 60: 0.7%, 70: 1.7%, 80: 32.7%, 90: 92.3%, 99: 99.3% | `soccer_ratings_human_out.txt` |
| Manual aim vs assist (counter, 20 m) | drag 40.0% < assist 49.0% | `soccer_human_out2.txt` |
| Free kicks by a person | 3.5–4.5%; "far top + bend" goes wide 51%, over 23% | same |
| Penalties by a person | low corner 84.5% | same |
| Frozen ball | 25 of 3,000 attacks (0.83%) hang until the 120 s hard stop | `soccer_probe_out.txt` |
| Parries into own net | 65 of 456 goals (14.3%) | same |
| BEND buttons | "Bend left" ends 3.40 m right; "Bend right" ends 3.11 m left | `soccer_bend.ts` |
| Portrait camera at kick-off (390×844) | 16.9 m of 68 m visible. Teammates on screen: build 1/5, counter 0/3, wide 1/5. Wide carrier off-screen (x −36 / 426). Corner taker 17 px at x=17. Stands take 30–37% of the height near goal. | `soccer_cam_out.txt` |
| Frame pacing (lab autopilot, 390×844, dev) | 1×: 60 fps; 4×: 59 fps, p99 33.3 ms; 6×: 53.1 fps, p99 50.1 ms | `soccer_perf_out.txt` |
| Match length | attacks use 4.3–7.2 s of the 30 s clock; a whole match is about 1.5–2 min of real time | audit §2.3 |
| Tests | 33/33 soccer2 tests pass; `soccer.test.ts:269` allows the 120 s freeze | audit §12 |

**New baselines recorded in soccer-1 step A:**
- the soccer suite's wall time;
- the golden hash;
- `cam.ts` mid-attack framing (carrier in frame, zoom changes per second);
- soccer stale draws;
- per-level AI-vs-AI 0–0 and draw rates;
- the autopilot's per-attack goal rate against a rating gap.

## 3. How every task measures

### 3.1 Commands

- **Heavy commands** go through the semaphore: `bash O/heavy.sh <cmd>`. An env var goes through `env`: `bash O/heavy.sh env PS_SPORT=soccer npx vitest run soccer sport-branches`.
- **Typecheck:** `bash O/heavy.sh npm run typecheck`.
- **Tests:** soccer tests live under paths containing "soccer" (`src/game/soccer2/*.test.ts`, `src/game/play-feedback-soccer.test.ts`), so the soccer suite picks them up. The full `npm test` and `npm run build` run once each, in soccer-10 only.
- **Harnesses** (ported into `scripts/soccer/` in soccer-1): `bash O/heavy.sh npx vite-node scripts/soccer/<name>.ts [n] [part]`.

| Harness | What it measures |
|---|---|
| `sim.ts [matches] [rookie\|pro\|legend\|sim0.6\|all\|gap\|ladder]` | The §2 table: per-level 0–0 and draws, the attack-end mix, the rating gap (`gap`), and the solo ladder with proxies (`ladder`, from soccer-9) |
| `human.ts [n]` | Scripted person strategies, including the `skilled` proxy (soccer-5) and the defender proxies `idle`/`good`/`spam` (soccer-8) |
| `ratings-human.ts [n]` | Person and autopilot gradients, plus a PAC-only gradient |
| `probe.ts [n]` | Frozen balls, over-time attacks, parry own-goals, rebound share, step cost |
| `bend.ts` | Bend direction |
| `cam.ts [attacks]` | Kick-off and mid-attack framing through the real `camera.ts` |
| `scripts/audit_soccer_shots.ts [n]` | Shooting, keeper and pass drills (existing) |

- **Dev server:** `cd /home/user/ps-s-soccer && nohup npx vite --port 5217 --strictPort > /tmp/ps-soccer-vite.log 2>&1 & echo $! > /tmp/ps-soccer-vite.pid`. Stop it with `kill $(cat /tmp/ps-soccer-vite.pid)`. Never use `pkill -f` or `pgrep -f`.
- **Production build:** frame pacing on a production build (`vite preview` on 5217) happens only in soccer-10, after its single build. Earlier tasks compare dev-lab numbers before and after.

### 3.2 Browser QA isolation, insets and devices

- **Isolation helper** (`scripts/soccer/qa-isolate.mjs`, new in soccer-1). `isolate(context)` registers one route handler per context (guarded by a WeakSet):
  - localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com → `route.fallback()`;
  - everything else → `route.abort()`, counted.

  Because it uses `fallback()`, it composes with any handler shell later adds to `browser.mjs` (both enforce the same allowlist), so the two never fight at merge. Every URL carries `?ns=inspect&relay=ws://localhost:7777`. The blocked-host count is logged.
- **Insets.** `insets(page, [t, r, b, l])` sets `window.__psInsets` and also injects `.arcade-full{--sat:<t>px!important;--sab:<b>px!important;--sal:…;--sar:…}`. Today `.arcade-full` reads `env()` directly (`styles.css:7826-7833`), so `__psInsets` alone does nothing in Chromium; the audit used the same injection. Once shell's Fix A is in the base, the helper detects the computed `--sat` and stops injecting. Each layout check runs at **sat 59** (the raw island) and **sat 81** (59 + shell's 22 px edge). No soccer CSS hard-codes Dynamic Island compensation; every top offset is relative to `--sat`.
- **Presets** (touch, `deviceScaleFactor: 1` for checks, 3 for screenshots the owner sees). Insets are listed as [top, right, bottom, left].

  | Viewport | Insets |
  |---|---|
  | 393×852 | [59, 0, 34, 0] |
  | 393×852 | [81, 0, 34, 0] |
  | 390×844 | [47, 0, 34, 0] |
  | 430×932 | [59, 0, 34, 0] |
  | 375×667 | [20, 0, 0, 0] |
  | 320×568 | [0, 0, 0, 0] |

  Landscape 844×390 is checked once, in the gate.
- **H2H relay.** `soccer-app.mjs` starts an in-process `ws` relay on 7777, as `scripts/qa/online.mjs` does; it lives and dies with the script. If 7777 is busy (another team's run on the shared machine), it retries every 10 s for 3 min and then fails. It never falls back to a live relay, and route-abort also blocks any non-localhost `wss:`. A standalone relay, if ever needed, is started with `nohup … & echo $! > /tmp/ps-soccer-relay.pid` and stopped with `kill $(cat /tmp/ps-soccer-relay.pid)`.
- **Screenshots** go to `O/shots/soccer/<task>/`, as before/after pairs. Every screenshot is opened and looked at.

### 3.3 Test budget and brittleness

- **Vitest holds guards, not fits.** Tests use wide tolerances (about 1.5× the harness band) and small samples (n = 60–100 per row). The tight bands live in the `scripts/soccer` harnesses, whose output each task pastes into the team doc. Later tuning doesn't break `npm test`, and the shared box isn't loaded.
- **Wall time.** `PS_SPORT=soccer npx vitest run soccer sport-branches` must finish in ≤ 120 s on the shared box. soccer-1 records the baseline, and each task records its own number. A task that pushes past 120 s moves samples into a harness before it commits.
- **Golden.** `golden.test.ts` hashes:
  - 60 seeded autopilot attacks (six scenarios × two mirrors × five seeds): end, `t`, ball position, and every body's position at the whistle **and after 3 s of post-whistle `settle()`**;
  - 20 `aiProgress` matches;
  - 50 agreed shootouts.

  Outcome-changing tasks re-baseline it with the reason written down. All others must keep it green.
- **Agreement.** `agreement.test.ts`: over 500 seeds, phone A's and phone B's views of takeover, taken and simBoth give identical ends and scores. `agreedShootout` is mirrored and identical over 1,000 seeds. It runs in every task.

### 3.4 Every engine task

Every engine task re-runs `sim.ts 400 pro`, `human.ts 200` and `probe.ts 3000`, and pastes before/after into the team doc next to its own measurements.

## 4. Targets

**Source governance.**
- **Goals per match:** STREAM says 2.3–2.7, research says 2.6–3.2, and the audit's real figure is 2.7–2.9. STREAM governs: it is the owner-facing brief, and the audit lists "realistic AI-vs-AI scorelines" as a preserve item. The target is 2.4–2.7.
- **Elsewhere:** the binding owner decisions override STREAM, STREAM overrides research, and research overrides the audit's suggestions. Every disagreement is noted in the team doc.

**Column key:**
- **H** = harness target (tight).
- **G** = vitest guard (wide).
- **Task** = where it is fitted or built. soccer-10 re-measures every row.

### 4.1 Whole match, AI vs AI (`sim.ts 400`, Pro unless noted)

| Id | Metric | Baseline | H | G | Task |
|---|---|---|---|---|---|
| A1 | Goals per match | 2.33 | 2.4–2.7 | 2.0–3.1 | 6 |
| A2 | Draws; 0–0 | 26.8%; 7.8% (Legend 14.5%) | 22–29%; 4–10% at every level | 15–35%; ≤ 14% | 6 |
| A3 | Per level: draws; 0–0 | Legend 31% / 14.5% | 20–30%; ≤ 10% at Rookie, Pro and Legend | — | 6 |
| A4 | Better side (ΔOVR ≥ 8) W/D/L | 69/24/7 | 60–72 / 18–28 / 7–15 | — | 6 |
| A5 | Shots per side (played attacks) | 5.21 | 9–13 | ≥ 8 | 6 |
| A6 | On target; goals per shot; save% | 53.7; 20.4; 61.9% | 32–40; 9–14; 64–72% | 28–44; 8–16; — | 4 (interim), 6 |
| A7 | Blocked; woodwork; headers | 11.3; 4.2; 18.3% | 20–30; 2–4; 8–14% | ≥ 16; —; — | 4, 6 |
| A8 | Shots from outside the box | about 10% (3.3% from 22 m+) | 25–35% of all shots | ≥ 18% | 4 (appetite), 6 |
| A9 | Per attack: build / counter / wide; corner / FK attack | 21.6 / 19.4 / 18.9; 5.4 / 10.6% | 15–21 / 19–28 (counter ≥ build + 2) / 14–20; 8–12 / 10–14% | — | 6 |
| A10 | Attack ends (the AI's attacks) | lost 33.7, intercepted 13.2, tackled 6.4, offside 3.0, time 0.6% | lost ≤ 30, intercepted ≤ 15, tackled + poked ≥ 8, offside 2–5, time ≤ 1% | lost ≤ 35, time ≤ 2% | 5, 6 |
| A11 | Set-piece share of goals (excluding pens) | about 32% | 12–22% | 8–28% | 6 |
| A12 | Penalties awarded per team per match; pens from fouls; shootout kicks; direct FK per shot | —; 93%; —; 2.3% | 0.2–0.3; 74–78% (n ≥ 300); 70–75% (n ≥ 2,000); 6–11% | —; 68–84%; 64–81%; 4–14% | 5, 6 |
| A13 | Rating gap: the autopilot's per-attack goal rate per +10 OVR (everything else equal) | — | +5 to +7 points | +3 to +9 | 6 |
| A14 | AI goals per side vs a fixed 75 reference defence: Rookie / Pro / Legend | 1.17 / 1.17 / 0.99 | 0.8–1.0 / 1.1–1.35 / 1.45–1.8, monotone | monotone; Legend ≥ 1.3× Rookie | 6 (sim paths), 9 (solo) |

### 4.2 Shooting and keeping (`audit_soccer_shots.ts 200`, `xg-bands`, 75-rated sides)

| Id | Metric | Baseline | H | G | Task |
|---|---|---|---|---|---|
| S1 | Conversion by band: 0–6 / 6–11 / 11–16.5 / 16.5–22 / 22–30 / 30+ m | 59.5 / 45 / 23.4 / 15.8 / 5.5 / 3.1% | 35–55 / 18–32 / 8–15 / 4–8 / 1.5–4 / ≤ 1.5%, monotone | each band ±5 points wider, monotone | 4 |
| S2 | Keeper goals per on-target shot: < 6 yd / 6–12 / 12–18 / 18–25 / > 25 yd | — | 70–80 / 45–55 / 30–40 / 18–25 / 8–12% | ±7 points | 4 |
| S3 | Exactly one dive per shot; lost rush races; claims crosses he reaches first | — | 100%; ≤ 20% of rushes; ≥ 80% | 100%; ≤ 28%; ≥ 70% | 4 |
| S4 | Far-post first-time shot: the dive starts after the strike, with no pre-shift > 0.5 m to the near post | — | 100% | 100% | 4 |
| S5 | GK 93 vs GK 75 on identical shots (goals conceded ratio) | — | 0.70–0.85× | 0.62–0.92× | 4 |
| S6 | 1v1 12–16 m; SHO 95 vs GK 75; SHO 75 vs GK 93; edge 18–21 m; 25–30 m (SHO 75 / 95) | 62% (1v1) | 35–45; 50–58; 25–32; 12–18; 3–5 / 6–9% | — | 4 |
| S7 | Header from a cross at 8–10 yd | — | 12–18% | 8–22% | 4 |
| S8 | Manual corner aim vs assist (16–20 m) | 40 < 49% | manual ≥ assist + 5 points; assist ≥ 70% of manual | manual ≥ assist + 2 | 4 |
| S9 | First-time error multiplier, shots and passes | — | ×1.5–1.7 at 180°, ×1.15–1.25 at 90° | exact (pure function) + drill ±0.1 | 4 |
| S10 | Parry own-goals; parries back into the central 18 m | 14.3% of goals; — | ≤ 1% of goals; ≤ 12.5% of parries (fewer at HAN ≥ 85) | ≤ 2%; ≤ 18% | 4 |
| S11 | Free kick, person: skilled / careless | 3.5–4.5% | 6–9% / 1–4% | — | 6 |
| S12 | Penalty, person: low corner / centre; PERFECT / GOOD release | 84.5% | 80–88 / ≤ 40; about 85 / about 70% | — | 6 |

### 4.3 Person vs AI (`human.ts`, `ratings-human.ts`; guard `balance.test.ts`)

| Id | Metric | Baseline | H | G | Task |
|---|---|---|---|---|---|
| P1 | Every no-skill beeline row vs the Pro autopilot on the same attacks | up to 2.9× | ≤ 1.3× | ≤ 1.35× | 5 |
| P2 | A person shooting from 30 m, every scenario | 9.5–22.5% | ≤ 2% | ≤ 3% | 4 |
| P3 | Beeline penalties won; free kicks won (per run) | 15.5%; 28% | ≤ 3%; ≤ 8% | ≤ 4%; ≤ 9% | 5 |
| P4 | `skilled` vs the best no-skill row (counter, build) | — | +5 points | +4 | 5 |
| P5 | Counter beeline at 60/70/80/90/99 vs a 78 defence | 0.7 / 1.7 / 32.7 / 92.3 / 99.3% | 3–12 / 8–20 / 15–30 / 22–40 / 30–55%; no adjacent step > ×2.5; the autopilot's 60→99 gap ≥ 15 points | monotone; 60 ≥ 3%; 99 ≤ 60% | 5 |
| P6 | PAC-only gradient 60→99 (other stats fixed) | — | monotone; no adjacent 10-point step > ×2.5 | monotone | 5 |
| P7 | `tackleWin` at a 10-point gap | cliff | 0.55–0.75 | same | 5 |
| P8 | A breakaway foul from behind is a yellow | — | ≥ 90% | ≥ 85% | 5 |

### 4.4 Solo match with defending (soccer-8, soccer-9)

| Id | Metric | H | G |
|---|---|---|---|
| D1 | Concede per defend phase: `idle` ≥ auto + 3 points; `good` ≤ auto − 3; `spam` ≥ good + 5 with fouls ≥ 2× good | as stated | as stated, n=100 |
| D2 | The `good` proxy concedes within ±3 points of the Pro autopilot defence (defIQ 0, no human). Auto-defend (`OWN_DEF_IQ`) concedes 3–5 points more than `good`. | as stated | ±5 |
| D3 | Switch applied in the same step as the tap (≤ 17 ms); auto-switch picks the earliest meet point on crosses, never one who can't reach a loose ball first; a timed keeper rush smothers vs an untimed one; a slide from behind in the box that misses the ball gives a penalty | same step; ≥ 90%; ≥ 1.5×; ≥ 50% | same step; ≥ 85%; ≥ 1.3×; ≥ 40% |
| D4 | Ladder with human defending (`skilled` + `good` proxies, 200 matches per level): win% Rookie / Pro / Legend; every level 0–0 and draws | 70–85 / 45–60 / 25–40; ≤ 10%, 20–30% | monotone |
| D5 | SIM parity: SIM win% (Arcade `sim`, ut `simBoth`) ≤ the `skilled` + `good` win%, and within 5 points of it, at each level | as stated | ≤ played + 2 |
| D6 | The rival's solo goals come from played or auto-defended phases | 100% | 100% |
| D7 | Every outfield slot touches the ball or makes a defensive action | ≥ 80% of matches | ≥ 70% |

### 4.5 Time, flow and online

| Id | Metric | Target | Task |
|---|---|---|---|
| F1 | Solo match length in the default mode, real time with human-proxy input (not autoplay), including intros, replays, highlights, half-time and full time | median 4.0–6.0 min; p10 ≥ 3.5; p90 ≤ 7.0 (20 matches) | 9 |
| F2 | Defend phase | ≤ 20 s of game time; median 10–15 s real | 8, 9 |
| F3 | Online H2H | unchanged: simultaneous, no defend phases, same length | 9 |
| F4 | Online agreement: takeover, taken, simBoth from phone A's and B's views; `agreedShootout` | 100% identical over 500 seeds; 100% over 1,000 seeds | 1 (guard), 6, 9 |
| F5 | Settlement: `onFinish` is not delayed by the full-time card; the card renders after the whistle; the rival-goal pop after the score change | not delayed (today's 1.6 s / 2.6 s beat unchanged); ≤ 300 ms; ≤ 200 ms | 7, 9 |
| F6 | SKIP / SIM fast-forward | no long task > 200 ms at 4× CPU (chunked ≤ 6 ms of steps per frame) | 9 |

### 4.6 Camera, controls, performance, bundle

| Id | Metric | Target | Task |
|---|---|---|---|
| V1 | Kick-off framing (all six presets) | carrier in safe box 100%; teammates on screen build ≥ 3/5, counter ≥ 2/3, wide ≥ 3/5, corner ≥ 4/5, FK 4/4; stands ≤ 12% of H; corner taker ≥ 22 px with x in [20, W − 20]; goal mouth ≥ 60 px wide inside 30 m | 3 |
| V2 | Mid-attack framing (200 autopilot attacks per scenario) | carrier in the safe box ≥ 98% of frames; goal mouth fully in frame ≥ 95% of frames with the carrier inside 25 m; ≤ 4 zoom changes per second; name tag ∩ control rects = 0 in 100% of frames | 3 |
| V3 | Sprite size | carrier ≥ 28 px at 393 and ≥ 24 px at 320; every on-screen teammate ≥ 16 px (otherwise the trade-off agreed with players is written in both team docs); pitch width at the carrier's row 24–32 m | 3 |
| V4 | Frame pacing, production build, 393×852, DPR 3, 4× CPU | fps ≥ 58; p99 ≤ 33.4 ms; no long task > 200 ms, including SKIP; soccer stale draws ≤ 1% | 10 (dev before/after in 3) |
| C1 | Touch layout | SHOOT ≥ 64 px; every button ≥ 44 px; gaps 8–16 px; floating-stick zone bottom ≥ sab + 12 px and left ≥ sal + 12 px; text ≥ 10 px (incl. full-time table, shot-map labels and marker tags at 320); no horizontal overflow at 320 | 2, 3, 7 |
| C2 | Input latency, touch → visible change | ≤ 100 ms p95 (stick knob, SHOOT meter, TACKLE/SWITCH ring) | 2, 8 |
| C3 | Gesture accuracy (in-scope gestures) | tap-to-pass misread as a swipe or stick ≤ 2%; FK bend swipe vs tap 100% separated; slide swipe vs SWITCH tap 100% separated; tap-a-player hit radius ≥ 22 px with nearest-player resolution | 2, 8 |
| C4 | Sprint under SHOOT | a left-thumb sprint held while the right thumb winds up keeps ≥ 0.85 × sprint top speed | 2 |
| R1 | Reduced motion | zero shake, slow motion and slide-ins; zoom steps cut instantly; replays ≤ 1.0 s or skipped; no confetti, net ripple or edge-marker pulse; no sprint-ring flash; no full-time count-ups; no marquee text; hit-stop ≤ 30 ms | 2, 3, 7, 9, 10 |
| B1 | Bundle | the soccer arcade chunk grows ≤ 40 KB raw / ≤ 12 KB gzip over its 91 KB baseline; 0 bytes of soccer2 code in the first-paint entry; startup JS ≤ +2 KB gzip over 592 KB | 10 |
| T1 | Test wall time | the soccer suite in ≤ 120 s | 1 (baseline), every task |

## 5. Shared contracts (published in the team doc in soccer-1; wired once each)

Branches merge only at integration. Where another team's code isn't in our base, soccer writes against the published contract. Any stand-in is ≤ 8 lines, marked `// merge: replace with <team>'s <name>`, and listed in the team doc so the lead keeps one copy.

### 5.1 ut contract A: `Progress.box` (soccer-7)

- `BoxLine { id; name; tag; pos?; side: 'us' | 'them'; rating: number /* 1.0–10.0 */; stats: { goals, assists, shots, onTarget, saves, tackles, keyPasses, conceded } }` on the final `Progress` that `onFinish` receives.
- Built from **played engine events only**: your attacks, and the rival's attacks on the engine (simulated before soccer-9, defend phases after).
- Online, the rival's detail is letters only, so the rival's box is absent and ut hides that block.
- Rating: 6.5 base, +1.0 per goal, +0.6 per assist, +0.3 per key pass or tackle won, −0.5 per error leading to a goal; keepers +0.3 per save and −0.4 per goal conceded inside 12 m; clamped 1.0–10.0.
- Stripped before the wire. If nba-7's strip in `Arcade.progress()` isn't in our base, soccer adds the same one-line sport-agnostic strip (marked for merge). A test asserts the wire object has no `box`.

### 5.2 ut contract B: `onQuit(us, them)` (soccer-7)

- Solo quit, after a confirm, calls the host's `onQuit` with both progresses. The host chooses:
  - Squad Battles: leave with no result;
  - Cup, Circuit, Season and Draft: the ut-4 forfeit settlement.
- Soccer shows the host's confirm note; the default is "It counts as a loss."
- There is no soccer-side settlement and no `'T'` padding.

### 5.3 The nba/nfl forfeit (soccer-7)

- **Online FORFEIT**, after "Forfeit? Your rival wins.", sends a final `Progress` with `done: true` and `forfeit: true` (nba-7), with `ends` padded with `'FF'` (worth 0) up to `TOTAL` (nfl contract 1).
- The rival's `Arcade` finishes at once. `onFinish`'s optional 6th argument `forfeit: 'us' | 'them'` is passed through.
- **Soccer's own pieces:**
  - `'FF'` in the soccer `POINTS` (so the wire may carry it);
  - the soccer `END_LABEL` in `ut/Match.tsx`;
  - `AttackEnd`/`END_TEXT` "FORFEIT" in `soccer2/match.ts`.
- **ut hand-off:** add `'FF'` to the soccer letters in `match-debrief.ts`. That is ut's file, so soccer doesn't edit it.

### 5.4 Solo `onRival` (soccer-9)

- `Soccer2` reports the rival's `Progress` after each defend phase.
- In the soccer branch of `Arcade`, when `!online`, `them`/`shown` come from it, in the same state shape as nba-9 and nfl contract 2, so the lead can fold the three into one block.
- The precomputed `ai` stays for the kick-off "SIM IT" of a whole match.

### 5.5 players: action contract (soccer-4, 5, 8)

**Fields.** `Body` gains optional, render-only fields. The engine writes them from deterministic geometry and never reads them; it consumes no `a.rand` for them. A test randomises them every step and expects identical outcomes.

| Field | Meaning | Written in |
|---|---|---|
| `kickFoot: 'L' \| 'R'` | the ball's side relative to the strike direction | soccer-4 |
| `passKind: 'ground' \| 'lofted' \| 'cross' \| 'through' \| 'shot' \| 'header' \| 'pen' \| 'fk' \| 'clear' \| 'throw'` | what the kick is | soccer-4, soccer-6 (`throw`) |
| `diveHeight: 'low' \| 'mid' \| 'high'` | the keeper's dive | soccer-4 |
| `touchAt: number` | the time of the last dribble touch | soccer-5 |
| `slide: { at: number; dx: number; dy: number }` | block lunges and slide tackles | soccer-4, soccer-8 |
| `look: { x: number; y: number }` | facing at the ball while jockeying; sim facing `fx/fy` stays velocity-based | soccer-5 |

The renderer reads `look ?? (fx, fy)`.

**Acts:** `'jockey' | 'poke' | 'block' | 'getup' | 'slide'`.

**Routing** (players-5 and players-8 own it):
- `'jockey'` → `shuffle`/`shuffle_l` at a speed-matched rate;
- drifting at 0.15–1 m/s → walk, not `ready`;
- `'getup'` → `getup_front`;
- dives rolled sideways by `diveHeight`;
- kicks by `kickFoot`;
- unknown acts fall back safely.

If players' routing isn't in our base when soccer-5 lands, soccer adds a ≤ 10-line routing to existing clips in the players section of `render.ts`, marked for merge.

Players' preferred-foot data (players-3) is render-only. The engine never imports `appearance*` (an import-graph test), so the two phones can never disagree because of chunk load timing.

### 5.6 players: impact and celebrations (soccer-3)

- Hit-stop goes through `soccer2/fx.ts` `hitStopFor(kind)`. It returns ms in [33, 120], with a local rolling cap of ≤ 150 ms per second and a reduced-motion clamp of ≤ 30 ms. At merge the lead points this one function at players' `impactOf(kind, …).stopMs` and `HitStopCap`.
- Soccer calls only the existing `Juice` API, and doesn't edit `juice.ts`.
- Celebrations and teammate run-ins are players' (`celebrate.ts`, run-ins on `goalAt`), render-only. Soccer exposes `goalAt` and the scorer's id. It has no celebration picker and does no post-whistle steering in `settle()`.

### 5.7 shell

- `ps:arena-ready` is dispatched once per match after the first frame drawn (soccer-3).
- Tip lines for `arena-tips.ts` go into our team doc (soccer-2 draft, soccer-9 final).
- HUD offsets are relative to `--sat`/`--sab`.
- `soccer-lazy.ts`'s `SoccerGame` type follows the new `arcade.ts` exports automatically, so it needs no edit.

### 5.8 Gesture-conflict matrix (soccer-2 for attack rows, soccer-8 for defence rows)

**Thresholds:**
- A **tap** moves < 12 px and lasts < 200 ms.
- A **swipe** moves ≥ 40 px in ≤ 250 ms.

**Precedence:** button hit rects, then the stick zone, then the pitch.

**Stick zone:**
- x from sal + 12 to 0.45 W;
- y from 0.40 H to H − sab − 12.

| Input | Where | Attack (open play) | Defend phase | Set piece |
|---|---|---|---|---|
| Touch down, hold | stick zone | floating stick spawns under the thumb; past 1.15× the ring = sprint | same (defender moves; sprint) | inert |
| Tap | a button | PASS / SHOOT (hold) / THRU | TACKLE / CONTAIN (hold) / SWITCH | CROSS · HOLD, BEND row, SHOOT |
| Tap | a teammate on the pitch (hit radius max(22 px, half his sprite height), nearest player wins) | pass to him (exists) | switch to him | corner: pick a target (existing behaviour kept) |
| Swipe | pitch, outside the zones | ignored (reserved for skill moves, Appendix A) | slide tackle along the swipe | free kick: bend (`-dx/140`, already right) |
| SHOOT trace | SHOOT button | hold, drag to aim, release in the meter (today's model). Chip, finesse and low are reserved (Appendix A). | — | penalty/FK aim (today's model) |

The phase decides what a swipe means, so a slide and a (later) skill swipe are separated 100% of the time.

### 5.9 Device preferences

- **Key:** `perfect-season:soccer-prefs:v1`.
- **Shape:** `{ v: 1, stick: 'floating' | 'fixed', stickSize: 0.8 | 1 | 1.2, spacing: 'normal' | 'wide', autoDefend: boolean, autoSwitch: 'off' | 'cross' | 'on' }`.
- `autoDefend` has the same meaning as nba's `perfect-season:hoops-prefs:v1` `autoDefend`. nfl uses `perfect-season:fb2-defense` with `'play' | 'sim'`. The lead may unify the three at merge; soccer flags this in the team doc.
- `prefs.ts` imports no soccer engine code (so a Settings import can't pull soccer into first paint).
- No engine, `aiProgress`, takeover or sim ever reads prefs (an import-graph test).
- It stays out of cloud saves and checkpoints.

### 5.10 Single sources

- `skillStars(p)` is exported from `soccer2/ratings.ts` (soccer-5) as the one formula: W/AM/ST DRI ≥ 88 → 5, 80–87 → 4, 70–79 → 3, 60–69 → 2, else 1; CB/GK capped at 2. Players' and ut's card faces should import it rather than write a second formula (hand-off).
- `xgOf` (soccer-4) is display-only.

## 6. Scope map (nothing silently dropped)

### 6.1 STREAM-soccer

| Brief item | Task |
|---|---|
| V-1 portrait camera: wider zoom, height-aware tilt, look-ahead, off-screen arrows | soccer-3 |
| V-1 name tag never behind SPRINT; wide overload never starts off-screen | soccer-2 (SPRINT leaves the right cluster), soccer-3 (framing, tag rule) |
| V-2 stands ≤ 12% near goal | soccer-3 |
| B-1 defenders close down, tackle, block | soccer-5 (press, tackles), soccer-4 (blocks) |
| B-1 / R-3 fouls not cheap | soccer-5 |
| B-1 sprinting costs control and touch | soccer-5 |
| B-1 measure with `human.ts` until skilled beats no-skill | soccer-1 (port), soccer-5 (targets), soccer-6 (re-check after the fit) |
| B-2 smooth rating curve | soccer-5 |
| R-1 frozen ball + test | soccer-1 |
| R-2 parries away from goal | soccer-4 |
| R-2 restarts (corners, goal kicks) | soccer-6 |
| C-4 BEND reversed + test | soccer-1 |
| V-3 hint, FBENDICK, opponent ring | soccer-2 |
| J-3 opponent confetti | soccer-1 |
| J-1 crowd: wire the soccer sounds | soccer-1 |
| C-5 pause and quit; online quit = forfeit with a confirm | soccer-2 (pause sheet), soccer-7 (quit, forfeit) |
| Result screen: scoreline, scorers, POTM, DRAW; data to ut | soccer-7 (full-time card, contract A) |
| Realism: shots/side, on target, conversion, 30 m ≤ 2% | soccer-4, soccer-6 |
| Keep 2.4–2.7 goals and about 25% draws | soccer-6 (fit), soccer-10 (re-measure) |
| B-3 difficulty ladder (AI side only) | soccer-6 (sim paths), soccer-9 (solo with defending, offline only) |
| B-4 aiming beats assist | soccer-4 |
| B-5 free kicks; B-6 penalties | soccer-6 |
| Seeded tests for each target | soccer-4 (`xg-bands`, keeper), soccer-5 (`balance`), soccer-6 (`realism`, `setpieces`) |
| S-1 varied situations | soccer-6 (weighted deal, every card plays); template variants deferred (Appendix B) |
| S-1 defending phases: switch, jockey, tackle/slide, keeper 1v1; rival goals from them; Auto-defend; online unchanged | soccer-8, soccer-9 |
| C-1 sprint on the left thumb, floating stick | soccer-2 |
| C-3 shot types and skill moves | **Deferred** (Appendix A). Kept: drag-to-aim and timing, B-4 aim reward, close control at partial stick (soccer-5), `skillStars` (soccer-5) |
| Dribble touches tied to DRI | soccer-5 (touch length by DRI and sprint, `touchAt` beats); rolling ball deferred (Appendix A) |
| AI-2 shape, press, lane cover | soccer-5 |
| U-1 the formation and all 11 cards matter | soccer-6 + soccer-9 (every card plays: rotation, defend phases with your back line and keeper; D7); shape templates deferred (Appendix B) |
| A-1 animation actions | soccer-4, 5, 8 (fields and acts in players' format), §5.5 |
| J-2 juice | soccer-3 (trail, ripple, shake, near-miss slow-mo, hit-stop seam), soccer-7 (goal plate) |
| J-4 crowd swells | soccer-1 (by distance, through the existing `crowd.level`) |
| J-4 commentary text | **Deferred** (Appendix C) |
| Protocol bump line | soccer-1 (first), soccer-10 (final) |
| Preserve list | every task; golden + agreement from soccer-1 |
| Owner device checks | §13 |

### 6.2 Audit items not named in STREAM

| Audit item | Task or deferral |
|---|---|
| V-4 tiny players | soccer-3 (V3 sprite targets) |
| A-2 identical players | players team; soccer passes ids through |
| A-5 backpedal never triggers; `ready` while drifting | soccer-5 (`look`, `'jockey'`), players-5 (routing) |
| AI-1 range shots, THRU into space, switching play | soccer-4 (appetite), soccer-5 (THRU, switch + test) |
| AI-1 team styles | Deferred with formations (Appendix B) |
| C-2 edge arrows; one name per control | soccer-3; soccer-2 |
| C-2 lofted through ball, runner trigger | Deferred (P2) |
| C-4 shootout keeper reverse camera / swipe to dive | Deferred (P2) |
| C-4 online interactive shootout | Deferred (needs `src/net/**`, lead-only) |
| S-1 continuous 11v11 halves | Deferred (new mode, queue, protocol) |
| S-1 kick-off, half-time | soccer-9 |
| S-1 substitutions | Deferred (§12) |
| R-2 throw-ins | soccer-6 (quick throw-in near the box) |
| R-2 yellow cards | soccer-5 |
| §11 zoom redraws, floor redraw, prewarm | soccer-3 (zoom quantisation, floor cache); players-1 (sprite budget, prewarm) |
| §12 test/QA gaps | soccer-1 (isolation, insets, tighter time test), soccer-2 (layout checks, `.compact`) |
| J-3 bare final screen, goal ceremony | soccer-7; +XP tick → ut |
| J-3 per-attack highlight replays on the full-time card | Deferred (P2) |
| B-6 keeper skill tell | Deferred (§12) |

### 6.3 Research recommendations (§0 and §7)

| # | Recommendation | Task or deferral |
|---|---|---|
| 1 | Shot types on one SHOOT button | Deferred (Appendix A) |
| 2 | Meter grip on accuracy | soccer-4 |
| 3 | Conversion by distance × about 1.6 | soccer-4 |
| 4 | Counters the best open-play chance | soccer-6 |
| 5 | Set pieces by share of goals (weighted deal) | soccer-6 |
| 6 | The player defends | soccer-8, soccer-9 (all 7 by owner decision; research said 2) |
| 7 | Acceleration archetypes | Deferred (another rating lever right after B-2's flattening; card icon belongs to players/ut) |
| 8 | Skill moves | Deferred (Appendix A); `skillStars` single source now (soccer-5) |
| 9 | First-time turn penalty (shots and passes) | soccer-4 (S9) |
| 10 | Traits | Deferred (new per-card data; players/packs card faces; protocol-heavy) |
| 11 | Roles with familiarity | Deferred with formations (Appendix B) |
| 12 | Keepers steer parries wide | soccer-4 |
| 13 | AI defenders don't auto-tackle | soccer-5 |
| 14 | Animation fidelity | players; soccer supplies §5.5 fields |
| 15 | A stats sheet that looks real | soccer-7 (played events + a labelled estimate block) |
| 16 | xG per shot, shot map | soccer-4 (`xg.ts`), soccer-7 (readout, full-time shot map) |
| 17 | Dynamic stoppage time and highlights | Deferred (`TOTAL = 7` is the wire contract) |
| 18 | Touch settings | soccer-2 (stick floating/fixed, size, spacing), soccer-8 (auto-switch), soccer-9 (Auto-defend); power-up rate, keep-running and gestures-only deferred (P2) |
| 19 | UT card face additions | players/packs/ut; `skillStars` exported (soccer-5) |
| 20 | Protocol bump, soccer only | team doc |
| 7.2 | Lofted/cross error under pressure and at sprint | soccer-5 |
| 7.2 | Pass-and-go, swerve passes | Deferred (P2) |
| 7.3 | Turn caps, first touch, jog 75%, close control | soccer-5 |
| 7.3 | Shielding | Deferred (Appendix A) |
| 7.4 | Contain, tackle, slide, switch, auto-switch, teammate contain | soccer-8 |
| 7.5 | Save% by distance, one dive, crosses, rushes, far post | soccer-4 |
| 7.5 | Keeper traits | Deferred with traits |
| 7.6 | Deal, corner/FK/pen/shootout targets, wall from the 4 tallest | soccer-6 |
| 7.6 | Corner zones, avoidance dash, penalty ring | Deferred (P2; a second timing UI would conflict with the meter) |
| 7.7 | Roles; Team plan | Deferred (Appendix B; §12) |
| 7.8 | Late-match fatigue | Deferred (low value in seven attacks) |
| 7.10 | Camera presets, replays by goal type | Deferred (P2) |
| 7.10 | Running stats, haptics | soccer-7 (stats), soccer-2/3 (haptics) |
| 7.10 | Commentary | Deferred (Appendix C) |
| 7.11 | SHOOT ≥ 64, spacing, slow-mo pass set-up | soccer-2; slow-mo set-up deferred (P2) |
| 7.12 | Stats that feel legit | soccer-7 (played events; estimates labelled) |
| 7.13 | Rating gap 5–7 points per 10 OVR | soccer-6 (A13) |
| 7.13 | Rivals ladder, packs, promos, foil | ut / packs teams |

## 7. Ordered tasks

Engine tasks that change outcomes are marked **Protocol: bump needed**. There is one bump for the whole branch, done by the lead (§9). The rest need none and must keep the golden test green.

| Order | Id | Title | Priority | Est. | Depends on | Golden |
|---|---|---|---|---|---|---|
| 1 | soccer-1 | Baseline first, guards and contracts, then the rule bugs | P0 enabling | 3.5 h | — | created, then re-based (R-1) |
| 2 | soccer-2 | Control cluster, safe box, HUD fixes and the pause sheet | P0 | 3.5 h | soccer-1 | unchanged |
| 3 | soccer-3 | Portrait camera, edge markers, pitch cache and render juice | P0 | 3.5 h | soccer-2 | unchanged |
| 4 | soccer-4 | Shooting and keeping fitted to real conversion, with xG | P0 realism | 3.5 h | soccer-1 | re-based |
| 5 | soccer-5 | Defending AI, fouls, sprint cost and a smooth rating curve | P0 | 3.5 h | soccer-4 | re-based |
| 6 | soccer-6 | Restarts, set pieces, the weighted deal and the whole-match fit | P0 realism | 3.5 h | soccer-4, soccer-5 | re-based (last time) |
| 7 | soccer-7 | Match shell: quit and forfeit, the box score, full time and goal moments | P0 | 3.5 h | soccer-2, soccer-4, soccer-6 | unchanged |
| 8 | soccer-8 | Defend phases: the engine side | P0 (owner decision 2) | 3.5 h | soccer-2, soccer-5 | unchanged |
| 9 | soccer-9 | Solo matches with defending by default, Auto-defend, SIM, the ladder and a 4–6 min match | P0 (owner decisions 2–3) | 3.5 h | soccer-6, soccer-7, soccer-8 | unchanged (rows added) |
| 10 | soccer-10 | Final QA gate and the post-merge re-measure kit | gate | 3 h | all | re-measured |

---

### soccer-1 · Baseline first, guards and contracts, then the rule bugs (P0, enabling)

**Scope:**
- Harness port and baseline, before any engine edit.
- The golden, agreement and wall-time guards.
- QA isolation, insets, presets and the relay.
- The shared contracts.
- R-1, C-4, J-1 (with the crowd swell by distance), J-3, and BEND buttons ≥ 44 px.

**Files:**
- New: `scripts/soccer/{lib,sim,human,ratings-human,probe,bend,cam}.ts`, `scripts/soccer/qa-isolate.mjs`, `src/game/soccer2/{golden,agreement,rules}.test.ts`, `docs/studio-overhaul/soccer.md` (team doc).
- Changed: `scripts/qa/soccer-lab.mjs`, `scripts/qa/soccer-app.mjs`.
- In `src/game/soccer2/`: `engine.ts`, `Soccer2.tsx`, `render.ts` (`burst` only), `soccer2.css`, `arcade.ts` (`aiProgressFor`), `soccer.test.ts`.
- `src/game/Arcade.tsx`: the soccer branch of `aiPlay`, 1 line.
- `src/ut/Match.tsx`: the `simBoth` soccer branch, 2 lines.

**Step A: measure before touching the engine** (its own commit, "baseline")
1. **Harness port.**
   - Copy the six audit scripts into `scripts/soccer/`, rewriting imports to `../../src/...`.
   - Move the shared parts into `lib.ts`: the real-squad loader (club-seasons with ≥ 14 lines), pair picker, synthetic `player()`/`squad()`, `beeline()`, `setPieceHuman()` and `tally()`.
   - `sim.ts` prints the whole §2 table. JSON is written only when `SOCCER_OUT=<path>` is set.
   - New parts: per-level 0–0 and draws, the attack-end mix, and `gap` (per-attack goal rate against ΔOVR 0/5/10/15).
2. **Run on the untouched engine:** `sim.ts 400 all`, `sim.ts 400 gap`, `human.ts 200`, `ratings-human.ts 300` (with a PAC-only row), `probe.ts 3000`, `bend.ts`, `cam.ts`, `audit_soccer_shots.ts 200`. Paste the results into the team doc. They must match §2 within sampling noise (±2 points, ±0.1 goals), or the difference is explained.
3. **`golden.test.ts`** as in §3.3. The snapshot hash is committed with the baseline.
4. **`aiProgressFor`.** Add `aiProgressFor(att, def, seed, skill, defIQ, ctx: { rival: boolean; online: boolean })` to `arcade.ts`. Today it forwards to `aiProgress` and ignores `ctx`. Arcade's soccer `aiPlay` and ut's `simBoth` call it.
5. **`agreement.test.ts`** as in §3.3. Phone A's takeover of B's remaining attacks (`rival: true, online: true, seed + ':takeover'`) must equal B's own `taken` (`rival: false, online: true`), and simBoth must agree from both seats. `agreedShootout(A, B, seed, host=true)` mirrors `agreedShootout(B, A, seed, host=false)`.
6. **Wall time.** Time the soccer suite and record it (T1 cap 120 s).
7. **QA.**
   - `qa-isolate.mjs` (§3.2) is used by both soccer QA scripts.
   - Add the six presets and the inset injection.
   - Add the in-process relay with retry to `soccer-app.mjs`.
   - New lab param: `start=x,y`, which places the carrier for drills and screenshots. Later tasks add their own params.

**Step B: rule bugs**

8. **R-1 frozen ball** (`step`, `contact`, `keeper`):
   - A `'shot'` or `'parry'` flight under 3 m/s ground speed with `h < 0.3`, or after two bounces, becomes `{ kind: 'clear', from: last, to: null }`. Clear `a.gkPlan` and push `'shot-dead'`; `contact()` resolves it.
   - `a.used` advances whenever the ball is under 3 m/s.
   - A set piece a person leaves untaken goes to the autopilot's taker after 12 s, with a countdown shown from 5 s.
   - `soccer.test.ts:269` tightens to `a.t < a.clock + 15`.
9. **C-4 bend.** `bendCurl(k) = -k * 0.75` in `engine.ts`, used by the BEND handler. The pitch swipe (`-dx/140`) stays. Check that the arrow points where the ball goes.
10. **J-1 sounds.**
    - `loadSamples('pitch')` and `crowd.start(0.24, 'pitch')`.
    - A render-only `'bounce'` event (landing with |vh| > 1.6) plays `sfx.bounce()`.
    - The crowd level follows the ball's distance to goal through the **existing** `crowd.level(x)`: at most 4 times a second, eased from 0.24 at 35 m to 0.5 at 12 m. `crowd.swell` keeps its event uses. No new `sound.ts` API.
11. **J-3.** `burst(..., 'confetti')` uses the scorer's kit side.
12. **BEND buttons** ≥ 44 px.
13. **Golden is re-based** with the reason "R-1: slow shots go dead and play on; set pieces auto-taken after 12 s". C-4 and the sounds change no autopilot outcome.

**Step C: contracts and doc.** §5 goes into the team doc, along with the first "Protocol bump needed" line and the baseline tables.

**Tests (`rules.test.ts`)**
- A slow shot is no longer a `'shot'` within 1 s, and the attack ends within 15 s with a valid letter.
- `bendCurl(-1)` gives a mean crossing x − aim x below −1.5 m over 40 kicks; `bendCurl(1)` above +1.5 m; `bendCurl(0)` within ±0.5 m.
- The bounce event changes no outcome.
- Golden and agreement are green.

**Measurements**
- `probe.ts 3000`: frozen 25 → 0, attacks over clock + 15 s → 0.
- `bend.ts`: left ≤ −1.5 m, right ≥ +1.5 m.
- `sim.ts 400 pro`: 2.1–2.8 goals and 20–32% draws (interim).
- `soccer-lab.mjs` smoke at all six presets: zero page errors, the blocked-host count logged, and the computed `--sat` on `.arcade-full` equal to the injected value.

**Screenshots:** the free kick with BEND left and its arrow (393 at sat 59, and 320); a rival's shootout goal with the rival's confetti.

**Protocol:** bump needed (R-1 changes attack outcomes and the AI simulations both phones compute).

**Save-compat:** none.

**Cross-team:** contracts published for players, ut, nba/nfl, shell and the lead. The `Arcade.tsx` and `ut/Match.tsx` hunks are listed under "Touched outside my lane".

**Acceptance:**
- The baseline commit comes before any engine edit.
- Golden, agreement and rules tests are green under `PS_SPORT=soccer` and the default sport.
- The probe and bend targets are met.
- Wall time is recorded and ≤ 120 s.
- QA isolation is proven (blocked count > 0 on a live-host probe; zero page errors).
- The team doc is created. The commits are pushed.

---

### soccer-2 · Control cluster, safe box, HUD fixes and the pause sheet (P0; UI only)

**Scope:**
- C-1 floating stick and sprint on the left thumb (moved from rev-1 soccer-9).
- Button sizes and spacing (research §7.11).
- The safe box.
- V-3, C-2 copy, `.compact`.
- The pause button and sheet: RESUME, HOW TO PLAY, CONTROLS. Quit and forfeit are wired in soccer-7.
- Prefs.
- The attack rows of the gesture matrix.
- Haptics on a green release.
- Draft arena tips.

**Files:**
- New in `src/game/soccer2/`: `controls.ts` (pure: zones, stick maths, sprint hysteresis, tap/swipe, hit tests), `hud.ts` (pure: `safeBox`, `layoutLabels`), `prefs.ts`, `PauseSheet.tsx`, `controls.test.ts`, `hud-layout.test.ts`, `prefs.test.ts`.
- Changed in `src/game/soccer2/`: `Soccer2.tsx`, `soccer2.css`, `match.ts` (`SCENARIO_SHORT`, copy), `render.ts` (HUD only: tag placement, ring for our side only, label pass).
- `scripts/qa/soccer-lab.mjs`: part `layout`.

**Changes**
1. **Floating stick.**
   - A touch in the stick zone (§5.8) spawns the base under the thumb, clamped so the ring stays in the zone. Release hides it.
   - `prefs.stick` (floating, the default, or fixed) and `prefs.stickSize`.
   - NFL's `screenRunInput` (`football2/controls.ts`) is used unchanged. A soccer test pins the inputs soccer relies on (two-axis vector, release-to-stop), so an NFL change shows up here.
2. **Sprint on the left thumb.**
   - Past 1.15× the ring radius sprints; back under 1.0× stops (hysteresis).
   - A sprint ring lights (no flash under reduced motion), with a light gesture-gated `tapHaptic`.
   - Shift still sprints on the keyboard.
   - SPRINT leaves the right cluster.
   - `a.sprinting` keeps its meaning, so the golden test is unchanged.
3. **Right cluster.** SHOOT ≥ 64 px; PASS and THRU ≥ 44 px. Gaps are 8 px (`spacing: 'normal'`) or 16 px (`'wide'`). The corner shows CROSS · HOLD; set pieces show the BEND row.
4. **Safe box.** `hud.safeBox(rects, W, H, insets)`:
   - top = the bottom of the scoreboard and marks + 8;
   - bottom = the top of the right cluster − 8;
   - left and right = 12 px plus sal/sar.

   Exported as `renderer.safe`. It is recomputed on resize, on prefs changes, when the phase's cluster changes and on `.compact`. soccer-3 frames the camera against it.
5. **V-3.**
   - The tip becomes a bottom toast above the cluster, never shown while SHOOT is held or a set-piece meter is up.
   - `layoutLabels` stacks colliding labels upward (fixes FBENDICK).
   - The yellow ring and name tag are drawn only for our side; the rival's taker gets a rival-coloured tag.
   - `SCENARIO_SHORT` (BUILD-UP, COUNTER, WIDE, CORNER, FREE KICK, PENALTY) shows with no ellipsis at 320.
   - The intro card at 320 no longer covers name tags.
   - The `@media (max-width: 350px), (max-height: 600px)` rules become a `.compact` class set from the measured wrap size.
   - One name per control in all copy ("Hold CROSS to whip it in"; BEND everywhere).
6. **Pause.**
   - A 44 × 44 button at `top: calc(var(--sat) + 6px)`, left, clear of the scoreboard at sat 59 and 81.
   - The sheet: RESUME, HOW TO PLAY, CONTROLS (stick type, size, spacing). The QUIT/FORFEIT row is present but disabled until soccer-7.
   - While paused: the loop's accumulator stops, input clears, and next-attack timers hold.
   - It also pauses on `visibilitychange`/`pagehide` (soccer's own listener; nba's `useInputInterrupt` change is not relied on).
   - Online, the sheet says your attacks pause while the rival plays on.
   - Sound and haptics toggles stay in the app's Settings (`App.tsx` owns them).
7. **`prefs.ts`** per §5.9.
8. **Gesture zones.** `controls.zoneOf(x, y, phase, layout)` implements the §5.8 attack and set-piece rows. Tap-a-teammate uses a hit radius of max(22 px, half the sprite height) with the nearest player winning. Pitch swipes in open play return `'none'` (reserved).
9. **Haptic** on a green release (the existing `vibrate`, gesture-gated).
10. **Arena tips.** 4–6 soccer lines for shell's `arena-tips.ts` go in the team doc, for example "Push the stick past the ring to sprint" and "Hold SHOOT, drag to aim, release in the green".

**Tests**
- **`controls.test.ts`:**
  - 2,000 synthetic touches per preset are classified into the right zone;
  - the knob centre is the touch ± 2 px;
  - sprint hysteresis works;
  - tap vs swipe thresholds hold;
  - tap-a-teammate resolves to the nearest player in the radius;
  - the zone bottom is ≥ sab + 12 and there is no spawn in the left 12 px;
  - the pinned `screenRunInput` behaviour holds.
- **`hud-layout.test.ts`:** no overlapping labels at 320/375/390/393/430; `safeBox` is right for each preset and for `.compact`.
- **`prefs.test.ts`:**
  - absent, garbage and old-shape values give defaults; a round trip keeps unknown fields;
  - import graph: `prefs.ts` imports nothing from `engine.ts`, `match.ts`, `arcade.ts` or `autopilot.ts`, and none of them imports `prefs.ts`.
- Golden unchanged.

**Browser** (`soccer-lab.mjs layout`, two-pointer CDP touch, all six presets)
- Every button ≥ 44 × 44 and SHOOT ≥ 64, with gaps of 8–16 px and no overlaps. Nothing sits in the home-indicator band (bottom ≥ sab + 12).
- Text ≥ 10 px; no horizontal overflow at 320; `.mid small` not truncated.
- The hint's rect never meets the goal mouth or the reticle, and there is no hint while SHOOT is held.
- C4: a left-thumb sprint held during the right thumb's wind-up keeps ≥ 0.85 × sprint top speed.
- C2: touchstart to knob moved or meter shown ≤ 100 ms at p95 over 50 taps (performance marks).
- Pause stops `a.t` for 3 s and resume continues. The pause button doesn't overlap the scoreboard at sat 59 or 81.
- Reduced motion: the sheet appears with no slide.

**Screenshots** (before/after): the control cluster at 393 (sat 59 and 81), 375×667 and 320×568; the free kick with no FBENDICK; the pause sheet and CONTROLS panel; the rival penalty taker's tag.

**Protocol:** none (input mapping and UI; golden unchanged).

**Save-compat:** the new device-local key, with tests.

**Cross-team:**
- shell: offsets relative to `--sat`; arena tips.
- nfl: `screenRunInput` used read-only and pinned.

**Acceptance:** tests green; golden unchanged; browser checks pass at six presets; screenshots looked at; owner device check noted (stick and sprint feel).

---

### soccer-3 · Portrait camera, edge markers, pitch cache and render juice (P0; render only)

**Scope:**
- V-1, V-2 and V-4.
- Off-screen teammate markers.
- Audit §11 (floor redraw, zoom quantisation).
- Shell's `ps:arena-ready`.
- J-2 render juice: trail, net ripple, shake through trauma, near-miss slow motion, and hit-stop through the `fx.ts` seam.
- Reduced motion for all of it.

**Files:**
- New in `src/game/soccer2/`: `camera.ts` (pure), `fx.ts` (hit-stop seam and rolling cap), `camera.test.ts`, `juice-soccer.test.ts`.
- Changed in `src/game/soccer2/`: `render.ts` (camera, floor cache, markers, ripple, trail; HUD and pitch sections only), `Soccer2.tsx`.
- `scripts/soccer/cam.ts`: rewritten to call `camera.ts`, with no replicated maths.

**Changes**
1. **`camera.ts`** (pure functions over `Attack`, used by `render.ts`, the harness and the tests):
   - `camParams(W, H, zoom)` for portrait. The scale is chosen so the carrier is ≥ 28 px at 393 and ≥ 24 px at 320, about 24–32 m of width at the carrier's row (about W/25 per metre there, with perspective).
     - Height-aware tilt: the pitch angle runs 0.62–0.80, steeper on taller phones.
     - `fov` 0.45.
     - `row`/`horizon` are solved so stands and sky never exceed 12% of H.
     - Landscape keeps today's parameters.
   - `cameraTarget(a, W, H, safe)`:
     - x follows 90% of the ball's offset;
     - look-ahead of velocity × 0.6 s, capped at 6 m, plus 3 m toward goal;
     - a framing pass adjusts target and zoom (0.85–1.15) until the carrier, the two best options and (inside 30 m) the goal mouth fit the safe box, with the carrier kept above `safe.bottom − 0.1 H` so the thumb rarely covers him;
     - corners are aimed at the box from the flag's side with the taker in frame (zoom about 1.0);
     - penalties put the goal in the upper third.
   - Zoom is quantised to 0.05 steps with at most 4 changes a second (≥ 0.25 s apart), so sprite sizes don't change every frame. Under reduced motion the steps cut instantly, with no tween and no extra pan easing.
   - `offscreenMarkers(cam, a, safe)` returns up to 4 markers `{ id, x, y, angle, tag }` clamped to the safe box.
2. **`render.ts`.**
   - Markers are drawn as teal chevrons with the tag (≥ 10 px), with no pulse under reduced motion.
   - The controlled player's tag moves above his head when its rect would fall under a control rect (V2: zero intersections).
   - **Floor cache:** the q = 2 pitch floor is drawn to an offscreen canvas keyed by the quantised camera (x to 1 px, zoom step, tilt), and redrawn only when the key changes.
3. **Render juice** (the existing `Juice` API only; held back through the real-time accumulator like `slowUntil`):
   - hit-stop through `fx.hitStopFor`: PERFECT strike 40, save 60, woodwork 80 ms, inside [33, 120], with a rolling cap of ≤ 150 ms per second and ≤ 30 ms under reduced motion;
   - a ball trail on shots over 25 m/s;
   - net ripple by shot speed (off under reduced motion);
   - shake through trauma (none under reduced motion);
   - 0.4× near-miss slow motion for 0.6 s when a shot passes within 0.3 m of a post (off under reduced motion).
   - No celebration picker and no `settle()` steering (§5.6).
4. **First frame.** `window.dispatchEvent(new Event('ps:arena-ready'))` once per match, after the first frame drawn with pitch and sprites (§5.7).
5. **Sprite budget.** The per-frame sprite cap (`render.ts:700`) is players' (players-1 `SpriteBudget`). Soccer only keeps px stable through the zoom quantisation.

**Tests**
- **`camera.test.ts`:**
  - V1 at the six presets;
  - V3 sprite sizes;
  - every off-screen teammate has a marker;
  - V2 over 30 autopilot attacks per scenario (engine + camera, no DOM), with thresholds 1–2 points looser than the harness.
- **`juice-soccer.test.ts`:**
  - a seeded match with and without hit-stop, slow motion, trail, ripple and shake gives identical ends, `t` and ball positions;
  - the `fx` cap holds ≤ 150 ms per second under a burst;
  - the reduced-motion clamps hold.
- Golden unchanged.

**Measurements**
- `cam.ts`: before/after kick-off table; V2 over 200 attacks per scenario.
- Dev-lab frame pacing at 393×852, 4× CPU: fps ≥ 58, p99 ≤ 33.4 ms, no long task > 200 ms, compared with the baseline; 6× not worse than 53.1 fps.
- Stale draws ≤ 1% (players' `players-sprites.mjs` if it is in the base, otherwise the lab counter).
- The production DPR 3 run is in soccer-10.

**Screenshots** (before/after; 393 at sat 59 and 81, 375, 320, and 430 once):
- each scenario at kick-off and mid-attack;
- the wide overload with the carrier on screen;
- a corner, a penalty;
- off-screen markers;
- net ripple, trail, a near miss.

**Protocol:** none.

**Cross-team:**
- **players:** sprite sizes against their 28 px readable-number threshold (any trade-off goes in both docs); the quantised zoom; the stale-draw budget.
- **shell:** the arena-ready event; offsets relative to `--sat`.

**Acceptance:** V1–V3 met in tests and harness; dev frame pacing not worse than baseline; juice test and golden green; screenshots looked at; owner device check noted (framing and readability).

---

### soccer-4 · Shooting and keeping fitted to real conversion, with xG (P0 realism)

**Scope:**
- §2.2 conversion.
- The meter's grip; range and TOO FAR.
- Context multipliers, including the first-time multiplier for shots **and** passes.
- Blocks and the block lunge.
- Keeper behaviour (research §7.5).
- Parry direction and steering (R-2, moved here from rev-1 soccer-1).
- B-4.
- The autopilot's long-shot appetite.
- `xg.ts` and its credit.
- `soccerFeedback` lines.
- The `kickFoot`, `passKind`, `diveHeight` and `slide` fields.

**Files:**
- In `src/game/soccer2/`:
  - `engine.ts`: `strikeShot`, `rangeCone`, `coneMult`, `assistAim`, `aimPoint`, `pressShoot`, `releaseShoot`, `pass`, `keeperSave`, `planKeeper`, `duringFlight`, `KEEP`;
  - `ratings.ts`: shot and keeper effects only;
  - `autopilot.ts`: `beginShot` uses `a.meter.top`; range appetite;
  - `xg.ts` (new);
  - `render.ts`: the meter label TOO FAR;
  - tests: `xg-bands.test.ts`, `keeper.test.ts`, `first-time.test.ts`, `render-fields.test.ts` (new); `shooting.test.ts`, `rules.test.ts`.
- `src/game/play-feedback.ts` (`soccerFeedback` hunk) and `src/game/play-feedback-soccer.test.ts` (new).
- `docs/CREDITS.md` (one entry).
- Lab params: `gk=`, `sho=` (rating overrides for drills).

**Changes**
1. **Execution meter.** `coneMult` is 0.8 at the green's centre, 1.0 at its edge and 1.3 at two greens, capped at 1.6 (was 0.5–3.2). Timing mainly sets height and power; `timingWord` stays.
2. **Range.**
   - `rangeCone(d)` grows: ×1 at ≤ 11 m, 1.6 at 16.5 m, 2.4 at 20 m, 3.2 at 25 m, about 4.3 at 30 m.
   - `meter.top = lerp(0.40, 0.62, (d − 8)/17)`.
   - `maxRange(p) = lerp(24, 34, rt(SHO))`; beyond it the meter reads **TOO FAR** in red.
3. **Context.**
   - Pressure ×1.35 with a defender within 2 m.
   - ×1.5 from wide of the posts inside 12 m.
   - Across the body as today.
   - Headers ×2 the foot cone beyond 8 m.
   - `firstTimeMult(turnDeg)`: ×1.2 at 90°, ×1.6 at ≥ 135°, used by `strikeShot` **and** `pass()`.
4. **Blocks.** Body block width 0.45 → 0.7 m. `blockLunge`: a defender within 3 m of the lane at the press of SHOOT steps across it with a DEF-scaled reach of 0.4–1.0 m, writing `Body.slide`.
5. **Keeper.**
   - From ≥ 20 m: save radius +0.15 m and reaction ×0.85.
   - One committed dive per shot: a second `planKeeper` call returns the committed plan.
   - He rushes only when he reaches the ball's next touch point first.
   - He claims crosses whose meet point he reaches first.
   - On first-time far-post shots his dive starts no earlier than the strike, with no pre-shift > 0.5 m to the near post.
   - `Body.diveHeight` records the dive.
6. **Parries (R-2).**
   - The "out" branch sends the ball away from the goal line (`norm(side*0.9, -0.35)`). It goes round the post only when x is outside ±(GHALF − 0.3).
   - The outward share is `lerp(0.5, 0.85, rt(HAN))`, never back across the six-yard box unless HAN < 55.
7. **B-4.** A full manual drag lands `assistMargin(SHO, d)` inside the post; the assist aims at 70% of that reach.
8. **The autopilot** takes 20–28 m shots when the lane is clear, with probability by SHO and skill. The final whole-match fit is in soccer-6.
9. **`xg.ts`** (`xgOf({ dist, angle, head, pattern, firstTime, pressured })`, from research §6.2) is display-only. `docs/CREDITS.md`: "Shot conversion tables derived from StatsBomb Open Data (CC BY-SA 4.0), via research-soccer §6.2."
10. **Fields** `kickFoot`, `passKind`, `diveHeight`, `slide` per §5.5.
11. **`soccerFeedback` lines:**
    - TOO FAR ("Too far out: get inside 25 m or wait for a clear lane");
    - BLOCKED ("A defender was in your lane: move it first");
    - first time across the body ("Hit first time across your body: take a touch to open up");
    - keeper claim; parried wide.

**Tests** (vitest guards, ≤ 25 s for this task's files)
- **`xg-bands.test.ts`:** n ≥ 80 per band, S1 guard bands, monotone.
- **`keeper.test.ts`:**
  - S3: one dive per shot 100% over 300 shots; claims ≥ 70%;
  - S4: no early dive 100%;
  - S5: guard;
  - the parry rule: initial `vy ≤ 0` unless x is outside ±(GHALF − 0.3).
- **`first-time.test.ts`:** S9 exact on the pure function, plus a seeded pass drill ratio.
- **`render-fields.test.ts`:** randomising `kickFoot`/`passKind`/`diveHeight`/`slide` every step gives identical outcomes, and `engine.ts` does not import `appearance*`. soccer-5 extends it to `look` and `touchAt`.
- **`shooting.test.ts`:** `coneMult(0) = 0.8`; 1v1 assist bounds 0.25–0.55.
- **`play-feedback-soccer.test.ts`:** the new lines.
- Golden re-based (reason written).

**Measurements (harness, tight)**
- `audit_soccer_shots.ts 200`: S2, S5, S6, S7.
- `probe.ts 3000`: S10.
- `human.ts 200`: P2 ≤ 2%, S8.
- `sim.ts 400 pro` (interim): S1 inside its bands; on target 32–42%; blocked ≥ 18%; save% 64–72%; woodwork 2–4%.

**Screenshots:** the meter showing TOO FAR at 30 m (`start=` param); a block lunge; the keeper claiming a cross; a parry steered wide.

**Protocol:** bump needed (shot outcomes, keeper, passes, AI sims).

**Save-compat:** none.

**Cross-team:**
- players: `kickFoot`/`passKind`/`diveHeight`/`slide`.
- nba/nfl: a `soccerFeedback`-only hunk in `play-feedback.ts`.

**Acceptance:** guards green; S1–S10 and P2 met in the harness, or a deviation explained with numbers; tables in the team doc.

---

### soccer-5 · Defending AI, fouls, sprint cost and a smooth rating curve (P0)

**Scope:**
- B-1, R-3, AI-2, B-2 and the PAC gradient.
- The sprint cost B-1 needs: touch length by sprint and DRI as the poke's exposure, turn caps, first-touch error, lofted error, jog 75%, close control at partial stick.
- Contact pace loss.
- Yellows.
- AI-1 THRU into space and switching play.
- Likeness A-5, engine half.
- The `skilled` proxy.
- `skillStars` as the single source.

**Files:**
- In `src/game/soccer2/`:
  - `engine.ts`: `defend`, `tackles`, `separate`, `human`, the at-feet block (~1190), `contact` first touch, `setPieceAfterFoul`;
  - `ratings.ts`: `tackleWin`, `dribblePace`, new `touchOf`, `turnRate`, `skillStars`;
  - `types.ts`: `Act` adds `'poke' | 'block' | 'jockey' | 'getup'`; `Attack.yellows?`; the §5.5 fields;
  - `autopilot.ts`: THRU into space, switch play;
  - `balance.test.ts` (new).
- `scripts/soccer/lib.ts` (`skilled`).
- `src/game/play-feedback.ts` (`soccerFeedback` hunk).
- `render.ts`, players section: a ≤ 10-line stand-in routing only if players' routing isn't in our base (§5.5).

**Changes**
1. **Lane-blocking press (AI-2).**
   - The first presser goes goal-side onto the carrier–goal line at a jockey distance of `lerp(2.5, 1.5, rt(DEF))`, at 80% pace inside 4 m.
   - Act `'jockey'`, with `Body.look` set at the ball. The simulation's facing `fx/fy` stays velocity-based, because it feeds first touch, pass targeting, the across-body cone and the foul-from-behind test (`engine.ts:472–1703`).
   - Inside 22 m a second defender covers the shooting lane 3–5 m ahead of the carrier.
   - A beaten defender gets a recovery sprint after `stunUntil`.
2. **Tackles on timing and angle.**
   - A standing tackle can start only when the ball is exposed (the touch has put it > 0.6 m ahead, or he turns > 60°), after the defender's read delay, with a visible 0.25 s wind-up (`'poke'`).
   - Success = `tackleWin` × angle (front 1.0, side 0.85, behind 0.6) × exposure.
   - A miss stuns for `lerp(0.95, 0.6, rt(DEF))`.
   - The AI never auto-tackles a dribbler who merely comes close.
3. **Sprint cost** (the ball stays at the feet; there is no rolling-ball rewrite):
   - The at-feet offset becomes `touchOf(p, speed, sprint)`: 0.5 m at a jog, up to 1.2–2.0 m at full sprint, shorter with DRI. That offset is the exposure the poke reads.
   - `Body.touchAt` marks the touch beats for players' dribble-touch animation.
   - `turnRate(p, speed)`: 540°/s at a jog, 240°/s at a sprint, scaled by DRI and height.
   - First-touch error ∝ ball speed × (1 − DRI factor) × 1.3 sprinting × 1.4 when turning > 90°.
   - Lofted/cross error ×1.2 at full sprint and ×1.3 under pressure.
   - Jog 75% (was 80%).
   - Close control: a stick magnitude of 0.5–0.85 gives 90% pace and the shortest touch. (Copy never says "Controlled Sprint".)
4. **Contact.** A carrier running into a defender's body within 0.9 m in front loses pace (×0.6–0.85 by PHY difference). `separate()` stays.
5. **Fouls (R-3).**
   - `clamp(0.02 + 0.11·(1 − rt(DEF)) + (behind ? 0.10 : 0) + 0.04·rt(DRI) − 0.05·defIQ, 0.015, 0.2)`.
   - A frontal mistimed tackle in the box is a foul half as often.
   - A breakaway foul from behind is a yellow (event `'yellow'`, pop "YELLOW · <tag>", counted; no sending-offs).
6. **B-2.**
   - `tackleWin`'s logistic scale 11 → 20, bounded 0.15–0.85.
   - DRI buys options rather than immunity.
   - PAC's chase and recovery effect is smoothed so the PAC-only gradient has no adjacent step above ×2.5.
7. **AI-1.** The autopilot plays THRU into space for a runner, and switches play wide when the near side has ≥ 3 defenders within 12 m and the far side has a free man.
8. **`skilled` proxy:**
   - carry at a jog or sprint;
   - when a defender is within 3 m ahead, pass to the most open teammate further forward;
   - shoot only inside 16 m with a clear lane, dragged to the open side;
   - release sd 0.05 s.
9. **`skillStars(p)`** per §5.10: pure, and unused by the engine now.
10. **`soccerFeedback` lines:**
    - TACKLED ("Your touch ran too far ahead at full sprint: ease off near a defender");
    - POKED AWAY; HEAVY TOUCH; YELLOW.

**Tests** (`balance.test.ts`, n = 60 per row, ≤ 25 s)
- P1, P3, P4, P5 and P6 at guard level.
- P7.
- P8 ≥ 85%.
- Switch play: in crafted overload states the autopilot switches ≥ 60% of the time.
- `render-fields.test.ts` extended: randomising `look` and `touchAt` every step gives identical outcomes.
- Golden re-based.

**Measurements**
- `human.ts 200`: P1, P3, P4.
- `ratings-human.ts 300`: P5, P6.
- `sim.ts 400 pro`: A10 (the attack-end mix) and penalties awarded per team (A12, interim).
- soccer-4's targets re-checked.

**Screenshots:** a defender jockeying goal-side and facing the ball; a poke tackle; the yellow pop; a heavy sprint touch.

**Protocol:** bump needed.

**Cross-team:**
- players: acts and fields (§5.5); `skillStars` for card faces (hand-off).

**Acceptance:** guards green; harness targets met or explained; soccer-4 targets still hold; tables in the team doc.

---

### soccer-6 · Restarts, set pieces, the weighted deal and the whole-match fit (P0 realism)

**Scope:**
- R-2 restarts: earned corners, goal kicks, a quick throw-in near the box.
- B-5, B-6 and the shootout.
- The weighted deal (research §5, §7.6).
- Every card plays (rotation).
- The rating-gap fit.
- The whole-match fit per level, AI vs AI.
- `realism.test.ts`.

This is the **last AI-vs-AI outcome change**: everything in §4.1 is fitted here.

**Files:**
- In `src/game/soccer2/`:
  - `engine.ts`: new `setPieceAfterOut`, shared `cornerLayout`, `fkArrival`, `SP_TUNE`, `duringFlight`;
  - `match.ts`: weighted `dealOf`, carrier rotation;
  - `shootout.ts` and `arcade.ts`: the shootout kick model;
  - `autopilot.ts`: appetite;
  - `ratings.ts`: chance-quality coupling for A13;
  - `render.ts`: the reticle at the bend-corrected arrival point;
  - `Soccer2.tsx`: the `'corner-won'`, `'goal-kick'` and `'throw'` events;
  - tests: `realism.test.ts` (new), `setpieces.test.ts`, `rules.test.ts`, `soccer.test.ts:289`.
- `src/game/play-feedback.ts` (lines).
- `scripts/soccer/sim.ts` (`gap`).

**Changes**
1. **Restarts.**
   - A ball over the byline off a defender or a parry calls `setPieceAfterOut(a, 'corner', side)`, which uses the shared `cornerLayout` and pushes `'corner-won'`. At most `a.restarts ≤ 2` per attack.
   - Off an attacker it ends `'W'` with "GOAL KICK".
   - A ball over the touchline off a defender with y > 75 becomes a quick throw-in to the nearest attacker (`passKind: 'throw'`, h = 2.0 m).
   - Off an attacker it ends `'L'` with "THROW-IN · THEIRS".
2. **B-5.**
   - `SP_TUNE.fkCone` 3.0 → about 1.5.
   - The wall is the 4 tallest outfield players.
   - `fkArrival(a, aim, curl)` traces the curl and dip with no RNG, and the reticle sits where the ball will arrive.
   - The meter's release height controls dip versus height.
3. **B-6.** Penalty green ×0.85, cone ×1.1 (PERFECT low corner about 85%, GOOD about 70%). The keeper's read is unchanged.
4. **Shootout.** `simShootout(..., 0.75)` uses the same kick model, fitted to A12 (70–75% per kick). `agreedShootout` mirroring is re-checked by the agreement test.
5. **Weighted deal.**
   - Each of the six regular attacks is drawn from build 32%, counter 22%, wide 22%, corner 15%, free kick 9%.
   - At most two set pieces are dealt.
   - Stoppage time is a counter or a wide overload.
   - Earned corners add to the set-piece share.
6. **Every card plays.** For each attack, the carrier, the runners and the defending block are drawn from the eleven by position with a deterministic rotation (`hashString(seed + ':cast:' + i)`), so each outfield player features across the dealt attacks. Defend phases (soccer-9) add your back line and keeper (D7). Shape templates are deferred (Appendix B).
7. **Fit.** Autopilot appetite, the deal and small engine constants are tuned until §4.1 holds at every level against a fixed 75 reference. The A13 rating gap is tuned through the chance-quality coupling; rating effects are compressed if the gap is steeper than 7 points per 10 OVR.
8. **`soccerFeedback` lines:** CORNER WON, GOAL KICK, THROW-IN, "The wall blocked it", and "The keeper read it" on a penalty.

**Tests**
- **`setpieces.test.ts`:** corners 8–12% per attack; FK attacks 10–14%; direct FK, pens and shootout kicks at the A12 guards; the wall is the 4 tallest.
- **`rules.test.ts`:** a parry over the byline gives a corner in the same attack; ≤ 2 restarts; GOAL KICK; throw-ins in both directions.
- **`realism.test.ts`** (60 Pro matches, ≤ 30 s): the G column of A1, A2, A5–A8 and A11.
- **`soccer.test.ts:289`:** the deal's weights over 2,000 seeds, each within ±3 points.
- **Rotation:** over 200 dealt matches, every outfield player appears in at least one attack (as carrier, runner or defender) in ≥ 80% of matches.
- Agreement green. Golden re-based (the last time).

**Measurements:**
- `sim.ts 400 all` and `sim.ts 400 gap`: all of §4.1.
- `human.ts 200`: S11, S12, and soccer-4/5's P rows still hold.
- `ratings-human.ts 300`: P5 and P6 still hold.
- `setpieces` harness: A12 with n ≥ 300 pens and n ≥ 2,000 shootout kicks.
- `bend.ts`.

**Screenshots:** the free-kick reticle at the bend-corrected point (left and right); an earned corner ("CORNER"); a goal kick; a throw-in near the box.

**Protocol:** bump needed (restarts, set pieces, deal, rotation, shootout, AI sims).

**Acceptance:**
- Guards green.
- §4.1 met at every level, or a deviation explained with numbers.
- Agreement 100%.
- Before/after tables in the team doc.
- The note "fit complete: later tasks must keep golden green" written.

---

### soccer-7 · Match shell: quit and forfeit, the box score, full time and goal moments (P0)

**Scope:**
- C-5 quit and forfeit through ut contract B and the nba/nfl forfeit (§5.2, §5.3).
- ut contract A (§5.1).
- The full-time card.
- The goal-moment plate.
- Running stats and xG per shot.
- The M3 hand-off.
- Reduced motion for count-ups and slide-ins.

**Files:**
- New in `src/game/soccer2/`: `report.ts` (pure), `FullTime.tsx`, `soccer2-shell.css`, `report.test.ts`, `shell.test.ts`.
- Changed in `src/game/soccer2/`:
  - `Soccer2.tsx` and `PauseSheet.tsx`;
  - `engine.ts`: `Attack.log`, report-only, never reads `a.rand`;
  - `match.ts`: the `AttackLog` capture; `aiAttacksOf` returns `detail`; `'FF'` in `AttackEnd`/`END_TEXT`;
  - `arcade.ts`: re-export `FullTime`, `buildBox`, `buildReport`. `Arcade` uses `import type` only.
- `src/game/Arcade.tsx`, in soccer lines:
  - `'FF'` in the soccer `POINTS`;
  - the soccer return passes `onQuit`;
  - stand-ins for the shared forfeit and box strip only if nba-7's block isn't in our base (≤ 8 lines, marked for merge).
- `src/ut/Match.tsx`: soccer `END_LABEL` `'FF'`, 1 line.

**Data (`report.ts`)**
- `ShotLog`, `AttackLog` as in revision 1. Every logged event is a played engine event.
- `buildBox(logs)` → `BoxLine[]` (§5.1).
- `buildReport(match, myLogs, rival, seed, pens?)` → `SoccerMatchReport`, which **only the full-time card reads**:
  - `outcome 'W' | 'D' | 'L'`; a level score is `'D'`, with `pens` when there was a shootout;
  - scorers with minute, assist and PEN;
  - team totals from played events;
  - a shot map;
  - POTM, the top box rating, ties going to the winning side and then the scorer;
  - a separate block labelled **MATCH ESTIMATE · 90 MIN** (possession, passes, corners, fouls, offsides, yellows) drawn from `rng(hashString('box:' + seed))` with research §7.12's distributions. It never feeds the box, ratings or POTM.
  - Online: `rivalDetail: 'goals-only'`.

**Changes**
1. `Attack.log` collects shots (assist = the last teammate pass's `from`), passes, key passes, tackles, corners, fouls, yellows and saves.
2. **The box.** The final `onDone` progress carries `box` (ours, and the rival's when the detail is known). The wire never does (§5.1).
3. **Quit and forfeit.**
   - The pause sheet's QUIT/FORFEIT row is enabled. Solo QUIT, after the host's confirm note, calls `onQuit` (contract B).
   - Online FORFEIT, after "Forfeit? Your rival wins.", sends the §5.3 final progress, and the other phone finishes at once.
   - There is no `'T'` fallback.
4. **Full-time card.**
   - It renders ≤ 300 ms after the whistle.
   - Settlement is **not** delayed: Arcade's existing 1.6 s / 2.6 s beat before `onFinish` is unchanged, and CONTINUE ends it early.
   - Contents:
     - the result word; a level match reads "DRAW · WON 4–3 ON PENALTIES";
     - scorers by side;
     - the played-event stats table;
     - the shot map (SVG, labels ≥ 10 px at 320);
     - a POTM plate (name, position, rating; players' portrait when merged);
     - the estimate block, labelled.
   - The readable result screen afterwards is ut's MatchRecap, from the box.
5. **Goal moment.** A scorer plate with name, position, OVR, "1ST GOAL TODAY" / "2ND GOAL TODAY" (this match) and the assist, for 1.6 s. Under reduced motion it is shown with no slide.
6. **Running stats.** The intro card shows each side's played shots, on target and xG. Each shot's readout shows "xG 0.12".
7. **Hand-offs in the team doc:**
   - ut: the M3 note (`Match.tsx:1449`) must say penalties when `pens` is set;
   - ut: `'FF'` in `match-debrief.ts`;
   - ut: +XP tick and career goals;
   - ut/players: `UtCard` for the POTM.

**Tests**
- **`report.test.ts`:**
  - deterministic for a seed;
  - goals ≤ on target ≤ shots;
  - ratings in 1.0–10.0;
  - the POTM rules;
  - level → `'D'` (+ `pens`);
  - the box has exactly contract A's soccer keys;
  - the estimate block never changes the box or POTM;
  - online gives no rival box;
  - `'FF'` is worth 0.
- **`shell.test.ts`:**
  - logging consumes no RNG (golden unchanged);
  - the object passed toward the wire has no `box`;
  - `'FF'` padding reaches `TOTAL`.

**Browser** (`soccer-lab.mjs shell`; `soccer-app.mjs`)
- Solo quit with confirm calls the host's `onQuit(us, them)`. A lab stub logs it, and in the app the UT Cup path reaches ut's handler when it is merged.
- An online forfeit between two local contexts finishes the other phone at once with a win.
- F5 timings (performance marks).
- Full-time text ≥ 10 px at 320, with no overflow.

**Screenshots:** the pause sheet with QUIT/FORFEIT (393 at sat 59 and 81, and 320); the forfeit confirm; the goal plate; full time for a win, a draw on penalties, a loss and online goals-only; the running-stats intro.

**Protocol:** the `'FF'` wire code is covered by the soccer bump (nba and nfl bump for theirs). Everything else is presentation.

**Save-compat:** none.

**Cross-team:**
- ut: contracts A and B, the hand-offs.
- nba/nfl: one forfeit block.
- players: portrait.

**Acceptance:** tests and golden green; browser checks pass; screenshots looked at; the contract section in the team doc updated with the final shapes.

---

### soccer-8 · Defend phases: the engine side (P0 by owner decision 2)

**Scope:**
- The human `'D'` API: stick, contain, tackle, slide, switch (button and tap-a-player), auto-switch (off, cross-only by default, on), keeper RUSH, teammate contain.
- The defence control cluster.
- The defence rows of the gesture matrix.
- `OWN_DEF_IQ`.
- `defend.test.ts` with the proxies.
- `soccerFeedback` lines for defending.

**Files:**
- In `src/game/soccer2/`:
  - `engine.ts`: `Attack.human?: 'A' | 'D'`, `Attack.dctl?`; `setDefStick`, `defContain`, `defTackle`, `defSlide`, `defSwitch`, `keeperRush`; the `humanDefender` branch;
  - `arcade.ts`: `OWN_DEF_IQ`;
  - `controls.ts`: the defence rows;
  - `Soccer2.tsx`: the defence cluster and slide swipe;
  - `render.ts` (HUD): the controlled defender's ring and the switch target;
  - `defend.test.ts` (new).
- `scripts/soccer/lib.ts`: the `idle`, `good` and `spam` proxies.
- `src/game/play-feedback.ts`: lines.
- Lab param: `side=D` (with `scenario=`) opens a defend phase directly.

**Changes**
1. A defend phase is `setupAttack(scenario, them, us, seed, { defIQ: OWN_DEF_IQ, human: 'D' })`. The rival attacks with the autopilot. The stick drives `dctl.id`.
2. **Contain** (hold CONTAIN): backpedal at 80% pace with `look` at the ball, auto-positioned goal-side on the carrier–goal line at 1.5–2.5 m.
3. **Tackle** (tap): soccer-5's model (exposure, angle, wind-up, a foul from behind).
4. **Slide** (a swipe on the pitch, §5.8):
   - 2.5 m along the swipe; it wins the ball by DEF and timing against an exposed ball;
   - a miss puts him down for 1.0 s, then `'getup'`;
   - hitting the man first is a foul, and in the box a penalty;
   - writes `Body.slide`.
5. **Switch.**
   - SWITCH, or a tap on a defender (§5.8 radius, nearest wins), moves control to the defender nearest the ball's path (by `meetPoint`), never to one who can't reach a loose ball first.
   - It is applied in the same engine step as the tap.
   - `prefs.autoSwitch` selects the auto-switch mode.
6. **Keeper RUSH** appears on a one-on-one (carrier inside 18 m and no defender goal-side within 3 m). It smothers better when timed at the carrier's touch (ball > 1 m ahead).
7. **Teammate contain.** AI defenders keep 3–4 m off the carrier while you control the presser, and only tackle with the visible wind-up.
8. **End of phase:** your side wins the ball, the attack ends, or 20 s of game time pass.
9. **`OWN_DEF_IQ`** (your AI teammates and Auto-defend; fixed, not by difficulty) is set so that D2 holds. The `good` proxy is within ±3 points of the Pro autopilot defence (defIQ 0). Auto concedes 3–5 points more than `good`. SIM uses the same constant, so SIM equals auto.
10. **UI.** In defence the right cluster becomes TACKLE (tap), CONTAIN (hold) and SWITCH, in the same positions and sizes as PASS/SHOOT/THRU. RUSH appears above it when offered. Kits swap as in the shootout.
11. **`soccerFeedback` defend lines:**
    - "Won it: you stayed goal-side and tackled when his touch went long";
    - "Beaten: you dived in. Hold CONTAIN until the ball is loose";
    - "Foul from behind: YELLOW";
    - "Penalty: a slide from behind in the box".

**Tests (`defend.test.ts`, n = 100 per row)**
- D1, D2 and D3 at guard level.
- With `human` unset, golden is unchanged.
- An online-flagged match never builds a defend phase.
- `controls.test.ts` additions: a slide swipe and a SWITCH tap are separated 100% of the time; tap-a-defender resolves to the nearest.

**Measurements:**
- `human.ts` defender part (n = 200): D1–D3 tight.
- Lab `side=D` in the browser:
  - TACKLE, CONTAIN and SWITCH ≥ 44 px;
  - the ring moves within 100 ms of the tap (C2);
  - slide swipe and RUSH work;
  - no overlap at 320 at sat 59 and 81.

**Screenshots:** a defend-phase intro; contain; a slide tackle and the get-up; the switch ring; RUSH on a one-on-one; the defence cluster at 320.

**Protocol:** none (a solo-only path; golden unchanged).

**Cross-team:**
- players: `'slide'`, `'getup'`, `look`.

**Acceptance:** tests and golden green; D1–D3 met; browser checks pass; owner device check noted (defending controls).

---

### soccer-9 · Solo matches with defending by default, Auto-defend, SIM, the ladder and a 4–6 minute match (P0 by owner decisions 2 and 3)

**Scope:**
- The interleaved solo flow.
- `autoDefend` (default off: you defend all seven).
- SIM THIS ATTACK and SIM THIS DEFENCE.
- Auto-defended highlights with SKIP, as a chunked fast-forward.
- `onRival` (§5.4).
- The rival-goal pop (online and highlights).
- The B-3 ladder, offline only, through `aiProgressFor`.
- SIM parity.
- Kick-off and half-time cards.
- 4–6 min pacing.
- D7 with defend phases.
- Final arena tips and kick-off copy.

**Files:**
- In `src/game/soccer2/`:
  - `Soccer2.tsx`: the flow, chips, highlight and SKIP;
  - `match.ts`: the rival schedule from `'ai:' + seed`, the `PACE` table, kick-off and half-time;
  - `arcade.ts`: the `aiProgressFor` role, offline only; ladder constants;
  - `prefs.ts`: `autoDefend`, `autoSwitch` in CONTROLS;
  - `PauseSheet.tsx`;
  - `soccer-flow.test.ts` (new).
- `src/game/Arcade.tsx`, soccer lines only, ≤ 12 lines:
  - `onRival` → `them`/`shown` when `!online`;
  - the solo props (`rivalSkill`, `manualOnly`);
  - 2 lines of kick-off copy.
- `scripts/soccer/sim.ts`: the `ladder` part.
- `scripts/qa/soccer-app.mjs`: parts `pace` and `solo`.

**Changes**
1. **Flow** (solo only; `online` runs today's simultaneous format unchanged):
   - the order is a kick-off card, your attack i, then their attack i (a defend phase), with a half-time card after attack 3 (`halfOf`), then stoppage;
   - the rival's attacks are dealt from `'ai:' + seed`, each built when reached, with the autopilot at the ladder's skill and iq;
   - the rival's score and scorer names come only from these phases (D6).
2. **Auto-defend.**
   - `prefs.autoDefend`, default `false`, toggled on the kick-off card and in Pause → CONTROLS.
   - When on, phases play themselves on the same engine at 2× with an AUTO ticker (no marquee). Tap to watch at 1×; SKIP fast-forwards.
3. **SIM chips** (44 px):
   - SIM THIS DEFENCE at each defend phase's start, in any solo mode. It equals the Auto-defend result for that seed.
   - SIM THIS ATTACK at your attack's intro, hidden when `manualOnly`. The autopilot at 0.6 plays it from the attack's set-up, equal to `aiPlay`'s 0.6 path for that attack.
4. **Chunked fast-forward.** ≤ 6 ms of engine steps per frame (about 250 steps at 1×), so a 20 s phase finishes in ≤ 5 frames at 1× and about 20 at 4× CPU, with no long task (F6). The result is identical to real-time play.
5. **`onRival`** per §5.4.
6. **Rival-goal pop.**
   - "<RIVAL> SCORE · 34' · RODRIGO": the name in highlights; online from the wire, without the name.
   - Shown within 200 ms of the score change, with `sfx.scoreThem()` and a scoreboard pulse.
7. **Ladder.**
   - `aiProgressFor` applies the role only when `!online` (and `simBoth` only when `!setup.online`). The rival's attack pilot gets skill and iq by level; your defence plays at `OWN_DEF_IQ`.
   - Online is unchanged (Legend defence both ways, as today).
   - Agreement is re-run, and new golden rows are added for the offline `'rival'` role.
8. **Pacing to F1.** One `PACE` table with these starting values:

   | Knob | Starting value |
   |---|---|
   | Kick-off card | 2.5 s |
   | Attack intro | 1.8 s |
   | Defend intro | 1.5 s |
   | Readout | 1.6 s |
   | Goal replay | ≤ 3 s (reduced motion ≤ 1.0 s or skipped) |
   | Half-time card | 4 s, skippable |
   | Defend-phase cap | 20 s of game time |

   They are tuned against a human-proxy Playwright run: scripted stick, SHOOT and defender inputs through the lab's `qa` hooks at real time, 20 matches, not autoplay. `TOTAL = 7` is kept; the counts aren't changed because they are the wire contract.
9. **D7** is measured with defend phases on.
10. **Copy.** The final arena-tip lines go to shell through the team doc. The kick-off "how to play" names CONTAIN, TACKLE, SWITCH, the slide swipe and Auto-defend.

**Tests (`soccer-flow.test.ts`)**
- D6: the rival's score equals the goals of the played phases.
- An online flag gives no defend phase and no prefs read.
- SIM THIS DEFENCE equals Auto-defend for the same seed; SIM THIS ATTACK equals the 0.6 path.
- Fast-forward equals real time.
- The agreement test passes with the role gated.
- Import graph: `prefs.ts` is never imported by `arcade.ts`, `match.ts`, `engine.ts` or `autopilot.ts`.
- Golden unchanged (default role), plus the new offline-role rows.

**Measurements**
- `sim.ts ladder` (`skilled` + `good` proxies, 200 matches per level): D4 and D5, and idle < auto < good per phase with ≥ 3-point gaps.
- `soccer-app.mjs pace` (20 human-proxy matches): F1 and F2.
- F6 at 4× CPU: no long task > 200 ms.
- F5: rival-goal pop ≤ 200 ms.
- D7 ≥ 80%.
- `soccer-app.mjs solo`: a UT Squad Battle with defend phases, a draft match vs the AI, and an online H2H between two local contexts (F3: still simultaneous, no defend phases).

**Screenshots:** the kick-off card with the Auto-defend toggle; the half-time card; a defend-phase intro; the SIM chips; an Auto-defend highlight with SKIP; the rival-goal pop; the defence cluster at 320×568 and 375×667.

**Protocol:** no extra bump. The flow is solo-only, and the ladder is offline only and never reaches the wire. Online paths are guarded by golden and agreement.

**Save-compat:** the `autoDefend` and `autoSwitch` prefs only, with tests.

**Cross-team:**
- **Arcade.tsx:** soccer lines, folded at merge with nba-9 and nfl contract 2.
- **ut:**
  - Squad Battles, Cups and Circuit solo matches now include defend phases (their PreMatch can say so);
  - `manualOnly` hides SIM THIS ATTACK.
- **shell:** tips.

**Acceptance:** tests and golden green; D4–D7 and F1–F6 met, or a deviation explained with numbers; owner device checks noted (match length and defending).

---

### soccer-10 · Final QA gate and the post-merge re-measure kit

Each command runs once, through `heavy.sh`.

1. **Checks.** `npm run typecheck`, then the full `npm test` (NBA, NFL, soccer); every suite green. T1: the soccer suite's wall time is ≤ 120 s.
2. **Build.** `npm run build` once. B1:
   - the soccer chunk delta against 91 KB;
   - 0 bytes of soccer2 code or `cards-soccer.json` in the first-paint entry;
   - the startup JS delta against 592 KB;
   - Arcade imports report types only.
3. **Harness finals.** `sim.ts 400 all`, `sim.ts gap`, `sim.ts ladder`, `human.ts 200`, `ratings-human.ts 300`, `probe.ts 3000`, `bend.ts`, `cam.ts`, `audit_soccer_shots.ts 200`. Every §4 row is tabled as met or missed, with the reason.
4. **Production frame pacing.**
   - `vite preview` of the build on 5217, at 393×852, DPR 3, 4× CPU: V4, including SKIP, plus stale draws.
   - 320×568 and landscape 844×390 are not worse than baseline.
5. **Browser walks** (isolation, the six presets with sat 59 and 81, zero page errors, the blocked-host count logged):
   - **the lab:** all scenarios, defend phases, SIM, Auto-defend, shootout, pause, quit, full time;
   - **`soccer-app.mjs all`:** Home → SOCCER, a draft match → result, a UT Squad Battle with defend phases, a Cup quit through contract B (stubbed if ut isn't merged), and an online H2H between two local contexts, including a forfeit;
   - **reduced-motion walk:** every R1 item.
6. **Copy lint.** `copy-soccer.test.ts` fails on EA feature names in soccer player-facing strings: "Controlled Sprint", "Timed Finishing", "PlayStyle", "Avoidance", "Composure Circle", "VS Attack", "Counter Chances". It also checks that commentary-like text is original.
7. **Re-measure kit for the lead.** `scripts/soccer/remeasure.sh` runs `sim.ts 400 all`, `human.ts 200`, the realism, setpieces and agreement tests, `cam.ts`, lab frame pacing and stale draws. The team doc gets a checklist to run on the merged branch:
   - after packs' and players' re-rates (owner decision 5, packs H7 shown = used), which move soccer card attributes through `rateCard`/`pitchCardsOf`;
   - after players-1/3/4 (sprite budget, feet, faces at the new sizes);
   - after shell's Fix A (the HUD moves about 22 px).

   If any §4 row leaves its band, the lead asks soccer to re-tune.
8. **Docs.**
   - `docs/SOCCER-ENGINE.md` and `docs/SOCCER.md`: the controls table, rating effects, set pieces, defend phases, the measured tables.
   - The team doc completed:
     - before/after;
     - tests added;
     - the final protocol line;
     - "Touched outside my lane" (every hunk with file and line range, and every `// merge:` stand-in);
     - hand-offs;
     - "Owner device checks";
     - "Left undone and why".
9. **Owner screenshots** at DPR 3 (393×852, sat 59).

**Protocol:** none for this task.

**Save-compat:** the gate re-runs `soccer-saves`, `soccer-ut` and `prefs` (old-shape round trips).

**Acceptance:** the gate passes in full; every §4 row is tabled; docs updated; the commits pushed.

## 8. Shared files and hunks outside the lane (all small, all listed in the team doc)

| File | Owner | Soccer hunk | Task |
|---|---|---|---|
| `src/game/Arcade.tsx` | nba/nfl shared | Soccer branch of `aiPlay` → `aiProgressFor` (1 line) | soccer-1 |
| `src/game/Arcade.tsx` | nba/nfl shared | `'FF'` in the soccer `POINTS`; soccer return passes `onQuit`; stand-ins for nba-7's forfeit block and box strip only if absent (marked for merge) | soccer-7 |
| `src/game/Arcade.tsx` | nba/nfl shared | Soccer return: `onRival`/solo props; `them`/`shown` from `onRival` when `!online` (same shape as nba-9/nfl contract 2); 2 lines of kick-off copy | soccer-9 |
| `src/ut/Match.tsx` | ut shared | `simBoth` soccer → `aiProgressFor` (2 lines) | soccer-1 |
| `src/ut/Match.tsx` | ut shared | Soccer `END_LABEL` gains `'FF'` (1 line) | soccer-7 |
| `src/game/play-feedback.ts` | nba/nfl shared | `soccerFeedback` lines only | soccer-4, 5, 6, 8 |
| `src/game/progress.ts` | nba/ut contract | Optional `box?`, `forfeit?` fields only if not in our base (2 lines, marked for merge) | soccer-7 |
| `src/game/soccer2/render.ts`, players section | players | ≤ 10-line stand-in routing of new acts, only if players' routing isn't in our base (marked for merge) | soccer-5 |
| `docs/CREDITS.md` | unlisted | One StatsBomb entry | soccer-4 |
| `scripts/qa/soccer-lab.mjs`, `soccer-app.mjs` | soccer QA scripts | Isolation helper, presets, parts | soccer-1, 2, 3, 7, 8, 9 |

**Not edited:**
- `juice.ts` (existing API through the `fx.ts` seam);
- `replay.ts` (soccer already skips replays under reduced motion; replays record frames through `Recorder`, so skill-dependent inputs never need re-simulation);
- `useInputInterrupt.ts` (soccer pauses on `visibilitychange` itself);
- `lib/sound.ts` (the existing `crowd.level`/`crowd.swell` only);
- `football2/controls.ts` (read-only, pinned by a soccer test);
- `scripts/qa/browser.mjs` (soccer's own helper);
- `ut/teams.ts` (shapes deferred).

**Rules:**
- Every Arcade hunk uses `pick({ nba, nfl, soccer })` or the existing `SOCCER` constant, and `sport-branches.test.ts` stays green.
- `DRAFT_RULES` and `UT_RULES` are never edited.

## 9. Protocol

One line in the team doc, first written in soccer-1 and final in soccer-10:

> Protocol bump needed: soccer draft 2→3, UT soccer 2→3, because the frozen-ball rule, the shot/keeper/pass model, parries and restarts, set pieces and the shootout kick model, the defending/tackle/foul model and the rating curve, the weighted deal and squad rotation, the AI simulations both phones compute in takeovers and sims, and the `'FF'` forfeit code on the wire all change how attacks and agreed shootouts come out. NBA and NFL unchanged by soccer.

- **One bump for two teams.** packs (H7, shown = used) and the owner decision 5 re-rates may also raise "Protocol bump needed: soccer UT". The lead bumps each sport once, so the soccer doc asks the lead to treat both lines as **one** soccer UT 2→3 bump.
- **No bump from these on their own:** the solo-only and offline paths (defend phases, Auto-defend, SIM chips, the offline ladder) and the presentation work (camera, HUD, juice, full time). They are guarded by golden and agreement.

## 10. Save compatibility

- No storage key, card id, edition id, copy UID, profile field or UT state changes.
- **One new device-local key**, `perfect-season:soccer-prefs:v1` (§5.9):
  - optional, read in try/catch;
  - defaults when missing or corrupt; unknown fields kept;
  - not in cloud saves or checkpoints;
  - never read by simulations;
  - tested with absent, garbage and old-shape values.
- `Progress.box` and `Progress.forfeit` are optional, match-time values, never stored by soccer. The rotation and `OWN_DEF_IQ` are derived, never stored.
- The gate re-runs `soccer-saves`, `soccer-ut` and `prefs`.

## 11. Risk register (from the critique and our own reading)

| # | Risk | Mitigation | Task |
|---|---|---|---|
| 1 | **CRITICAL: online desync from the ladder role.** Phone A computes B's attacks as `'rival'` and B as `'mine'`. | The role is applied only `!online` / `!setup.online`, through one function `aiProgressFor` that Arcade and `simBoth` both call from soccer-1. `agreement.test.ts` covers 500 seeds plus 1,000 shootouts in every task. | 1, 9 |
| 2 | Facing is simulation state (`fx/fy` feed first touch, passes, the cone, foul-from-behind). | Render-only `Body.look`; sim facing untouched; `render-fields.test.ts` randomises `look` and expects identical outcomes. | 5 |
| 3 | Quit exploit (voiding the rest keeps a lead). | No `'T'` fallback; solo quit → contract B (ut-4 forfeit); online → `'FF'` forfeit. | 7 |
| 4 | Full-time hold opens a forfeit window while `ut.live` is set. | No hold: Arcade's beat is unchanged and the card renders within 300 ms; CONTINUE only shortens the beat; ut's recap is the readable result. | 7 |
| 5 | Merge collisions in `Arcade.tsx`. | Shared contracts; soccer edits only soccer lines in three small hunks; stand-ins marked `// merge:`; every hunk listed with line ranges. | 1, 7, 9 |
| 6 | Hidden dependencies on files soccer doesn't own. | Each one is pinned or avoided: `screenRunInput` pinned by a test; `play-feedback.ts` soccer-only hunks with a soccer test; `replay.ts`/`useInputInterrupt.ts`/`juice.ts`/`sound.ts` unedited (soccer's own pause listener, existing crowd API, `fx` seam); `progress.ts` fields additive. All listed in §8. | all |
| 7 | Inset QA silently ineffective (`.arcade-full` reads `env()`). | CSS injection in `qa-isolate.mjs` plus a check that the computed `--sat` equals the injected value. | 1 |
| 8 | Shell Fix A moves the HUD by about 22 px. | Every check at sat 59 **and** 81; offsets relative to `--sat`; no hard-coded Dynamic Island px. | 1, 2, 3, 7 |
| 9 | A wider camera shrinks players (identity regression). | V3 sizes (carrier ≥ 28/24 px, teammates ≥ 16 px) are part of the camera fit; edge markers carry the rest; any trade-off with players is written in both docs. | 3 |
| 10 | Performance after merge (more sprites on screen, dev-only lab). | Zoom quantisation and the floor cache; production-build pacing at DPR 3 / 4× in the gate; stale draws ≤ 1%; the re-measure kit after merge. | 3, 10 |
| 11 | SKIP as one long task. | Chunked fast-forward ≤ 6 ms per frame; F6. | 9 |
| 12 | SIM easier than playing. | D5 (SIM ≤ played and within 5 points); `OWN_DEF_IQ` shared by Auto-defend and SIM; SIM THIS ATTACK hidden in `manualOnly`. | 8, 9 |
| 13 | Prefs fragmentation and desync. | One boolean `autoDefend` with nba's meaning; the lead may unify keys; never read by sims (import-graph test); `prefs.ts` imports no engine code. | 2, 9 |
| 14 | Invented stats. | Box, ratings and POTM from played events only; the estimate block is labelled and isolated by a test. | 7 |
| 15 | Re-rates move the calibration. | The re-measure kit and checklist after merge; one combined soccer UT bump line. | 10, §9 |
| 16 | Preferred-foot data loads lazily. | Render-only; the engine never imports `appearance*` (test). | 4 |
| 17 | Two skill-star formulas. | `skillStars` exported once from `ratings.ts`; hand-off to players/ut. | 5 |
| 18 | Gesture misreads; home-indicator swipe. | §5.8 matrix with thresholds and phase precedence; zone bottom ≥ sab + 12 and left ≥ sal + 12; C3 tests. Skill/chip gestures are deferred, so their conflicts don't ship. | 2, 8 |
| 19 | Reduced-motion gaps. | R1 lists every effect (zoom tweens, look-ahead easing, marker pulse, sprint flash, confetti, ripple, ticker, count-ups, slide-ins, replays, hit-stop) and the gate walks it. | 2, 3, 7, 9, 10 |
| 20 | 44 px for tap-a-player. | Hit radius max(22 px, half the sprite height) with nearest-player resolution; at 320 the BEND row is laid out by `layoutLabels`/`safeBox` and checked against the taker; pause vs scoreboard checked at sat 59 and 81. | 2, 8 |
| 21 | Determinism details. | §5.5 fields from geometry, no `a.rand`; golden includes post-`settle()` state; no celebration steering; replays play recorded frames (`Recorder`), never re-simulate; skill moves (which would consume `a.rand` on input) are deferred. | 1, 3, 4, 5 |
| 22 | Test brittleness and runtime. | §3.3: wide guards in vitest, tight harness bands, a 120 s cap. | all |
| 23 | Bundle and laziness. | `import type` only in Arcade; `FullTime`/`buildBox` through `sg`; B1 measured in the gate; `prefs.ts` free of engine imports. | 7, 10 |
| 24 | Branding. | No EA feature names in copy or settings; the copy-lint test; commentary deferred. | 10 |
| 25 | QA isolation overlap with shell's `browser.mjs`. | Soccer's own helper with `route.fallback()` and a WeakSet guard; the same allowlist, so it composes; no live-relay fallback in H2H. | 1 |

## 12. Deferred items (with reasons)

| Item | Reason; what remains in this overhaul |
|---|---|
| **C-3 shot types (finesse, chip, low, power) and skill moves; rolling-ball touch model; shielding** (Appendix A) | With the binding owner decisions (defend phases, SIM, 4–6 min) and the P0 list, ten one-session tasks don't fit them. They are also the outcome changes most likely to force a refit after soccer-6. **Kept now:** drag-to-aim and the timing meter, rewarded aim (B-4), close control at partial stick, DRI and sprint touch length, turn caps, first touch, `skillStars`. First in line for an 11th session. |
| **U-1 part 2: formation templates** (4-4-2 / 4-2-3-1 / 3-5-2 set-ups and defensive shapes), template variants, team styles, roles (Appendix B) | Needs slot plumbing through `ut/teams.ts` (unowned) and a refit. **Kept now:** every card plays (rotation, and your back line and keeper in defend phases; D7). |
| **J-4 commentary ticker** (Appendix C) | Audit rates it Low. Text needs original phrasing (branding risk) and a HUD slot that competes with the safe box. **Kept now:** the crowd builds by distance; event sounds. |
| Landscape match portal | Portrait-locked app (shell-owned); the owner plays in portrait. |
| Continuous 11v11 halves (S-1 #3) | New mode, queue, wire and protocol. |
| Online interactive shootout; shootout keeper reverse camera / swipe to dive (C-4) | `src/net/**` is lead-only; a new camera mode and input. P2. |
| B-6 keeper skill tell (run-up stutter) | The human keeper pre-commits before the run-up; it comes with the swipe-to-dive keeper. |
| Online defend phases | Owner decision 2 and STREAM: online stays offense-only. |
| Dynamic stoppage and highlights (research 17); changing the attack count | `TOTAL = 7` is the Arcade and wire contract; pacing uses timings instead. |
| Substitutions | The engine is eleven-a-side with no bench in `Squad`, and there is no stamina model. |
| Per-attack highlight replays on the full-time card | P2; the goal replay exists. |
| +XP tick on the goal moment; career-goal counts | Card XP and career stats are ut state (hand-off). |
| Team plan (research §7.7) | ut's PreMatch (ut-4); online needs a wire field. P2. |
| Acceleration archetypes; traits; keeper traits; weak foot; roles with familiarity | New per-card data and card-face work owned by players/packs/ut; protocol-heavy; archetypes could re-create the cliffs B-2 removes. |
| Lofted through ball, pass-and-go, runner trigger, swerve passes | P2: passing is the strongest existing area; its main defect is fixed by the camera and markers. |
| Corner target zones and avoidance dash; penalty composure ring | P2: a second timing UI would conflict with the meter. |
| Late-match fatigue | Low value in seven attacks. |
| Camera presets, replays by goal type, slow-mo pass set-up, power-up rate, keep-running-on-release, gestures-only | P2 settings after the core control rework. |
| Pack odds, foil, promo cadence, Rivals ladder | packs and ut teams. |
| Appearance data, new mocap clips, kit patterns | players team; soccer supplies §5.5. |

## 13. Owner device checks (only a real iPhone can confirm)

- Camera framing and readability (soccer-3), at the real Dynamic Island, after shell's Fix A.
- The pause button beside the island (soccer-2).
- Floating-stick and push-to-sprint feel; holding a sprint while winding up SHOOT (soccer-2).
- Defending controls: contain, tackle timing, the slide swipe, SWITCH and tap-to-switch, keeper RUSH (soccer-8).
- Solo match length and flow with defend phases, Auto-defend and SIM (soccer-9).
- Haptics through the gesture-gated path (soccer-2, soccer-3).

## Appendix A · On-ball skill (deferred C-3), ready to schedule

**Shot types** (a SHOOT trace classifier in `gestures.ts`; per-type strike parameters in `releaseShoot(a, aim, lag, kind)`):

| Type | Gesture | Wind-up | Speed | Cone | Notes |
|---|---|---|---|---|---|
| Placed | today's hold, drag, release | `meter.top` | 1.0 | 1.0 | |
| Finesse | a curved drag (> 15°) | +0.08 s | ×0.82 | 0.8 far corner / 1.3 near post | curl 3–6 m/s² |
| Chip | a quick upward flick (> 40 px in < 150 ms) | 0.35 s | drops under the bar | ×1.6 | |
| Low driven | a double tap within 250 ms | 0.45 s | ×1.05, height ≤ 0.6 m | ×1.1 | +40% error at full power |
| Power | hold past the green into a red zone | 0.90 s | ×1.25 | ×1.35 | open to tackles |

**Skill moves** (swipes in the reserved right-half zone, open play only):

| Stars | Forward | Side | Back |
|---|---|---|---|
| 1–2 | ball roll forward | ball roll | feint and turn |
| 3–4 | roulette | stop and turn | feint and exit |
| 5 | three-touch roulette | drag turn | nutmeg spin |

- Star-gated by `skillStars`.
- Each move within 1.2 s of the last is 15% slower with +40% touch error; a 4th forces a heavy touch.
- Defenders bite only after their read delay.

**Rolling-ball touch:** between touches the ball rolls (`Attack.touch = { next, out }`) and can be won by a poke. **Shielding:** stick back toward your own goal with a defender within 1.5 m, decided by PHY difference.

**Targets:**
- Gesture accuracy: tap-to-pass misread as a skill move ≤ 2%; aim drag misread as a chip ≤ 1%; slide vs skill swipe 100% separated by phase.
- Chip 1v1 against a keeper > 4 m off his line: 45–55%; ≤ 15% against a keeper on his line.
- Finesse to the far corner from 16–20 m: +3–6 points over placed.
- Low driven: blocked ≥ 5 points less often.
- Skill move against a closing defender: 25–45% success at 4–5★; 5★ ≥ 2× 1★.
- No skill-move or single-shot-type strategy above 1.3× the autopilot.
- The autopilot's use of the types is fitted with a full soccer-6-style refit inside the same task.

**Protocol:** bump (covered if it lands before release).

## Appendix B · Formation templates (deferred U-1 part 2)

- **Shapes from slot ids:** `Squad.shape` (`'433' | '442' | '4231' | '352'`) and `Squad.slots`, inferred from UT slot ids that are already on the wire.
- **Set-ups:** `setups.ts` holds `ATTACK[shape][scenario][variant]` and `DEFENCE[shape][scenario]`, for example:
  - 4-4-2 build-ups with two strikers;
  - 3-5-2 wing-back overlaps;
  - the 4-2-3-1 CAM between the lines.
- **Variants:** build-up from the back, a high turnover, 3v2 and 2v1 counters, overlap and underlap, near/far-post and short corners, edge-of-box and crossed free kicks.
- **Team styles from squad stats**, within ±15% of the autopilot's option weights: possession, direct, wing play.
- **Targets:** per-shape win% at equal OVR within ±5 points; possession squads make ≥ 20% more passes per attack than direct ones.
- **Cost:** a `ut/teams.ts` hunk (`pitchCardsOf` adds `slot`), a refit, and a protocol bump.

## Appendix C · Commentary ticker (deferred J-4)

- **`commentary.ts`** (pure): event → line, picked by `hashString(seed + event index)`, never `a.rand`. Original phrasing, checked by the copy lint.
- **Ticker:** one line, ≥ 10 px, ≤ 28 characters, at most one line per 1.5 s. It never overlaps the scoreboard or the safe box, and has no marquee under reduced motion.
- **Test:** a seeded match with and without commentary gives identical outcomes.
