# Studio overhaul, team soccer: build plan (revision 3, Game Design V2)

Planner: Claude (Anthropic).
- **Revision 1:** 2026-11-09 (`0daa00a`).
- **Revision 2:** 2026-11-10 (`312069c`). It answered the independent critique point by point (its §0.1/§0.2 tables). Read it with `git show 312069c:docs/studio-overhaul/soccer-plan.md`.
- **Revision 3:** 2026-11-16, this file. It folds in **Game Design V2**, which is binding together with the owner decisions of 2026-11-09. Everything revision 3 keeps from revision 2 is restated here, so this file stands alone.

Worktree `/home/user/ps-s-soccer`, branch `claude/studio-soccer`, dev port 5217. The engineers keep the team doc current: `docs/studio-overhaul/soccer.md`.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full for revision 3:**
- `O/design-v2/GAME-DESIGN-V2.md`, all of it. Section F.2 "soccer" is this team's list, F.1 the shared pieces, F.3 the protocols, F.4 the build order.
- `O/design-v2/research-engagement.md`.
- `O/design-v2/mockups.html`, opened in Chromium from `file://` with every non-file request aborted. The HUD row and the soccer lineup were looked at. The soccer target is:
  - the pause button top left;
  - the score bug "YOU 1 · 67' · 5/7 · 1 RIV" with the Heat bar under it;
  - a teal edge arrow "R9" for an off-screen teammate;
  - the toast line "THRU · release as he breaks the line" above the controls;
  - the stick bottom left; gold SHOOT (A), teal PASS (B, "HOLD: LOB"), dark-glass THRU (C) and TRICK (D); hints "flick ▲ CHIP" and "curve = FINESSE";
  - a gold ring under the controlled player, a teal ring on the pass target, a red arc on the defender.
- `O/DESIGN-V2-DECISIONS.md`.
- `O/BRIEF.md` (owner decisions and the V2 section), `O/BUILD-RULES.md`, `O/OWNERSHIP.md` (including the V2 grants), `O/STREAM-soccer.md`, `CLAUDE.md`.
- The worktree as it stands: Step A of soccer-1 committed (`fa45ebb`); most of Step B in the working tree, uncommitted (see soccer-1).

## 0. What revision 3 changes

### 0.1 V2's soccer list (F.2), item by item

| F.2 | Item | Where now | Note |
|---|---|---|---|
| 1 | KEEP first: frozen ball (R-1), parry direction (R-2), bend (C-4) | soccer-1 | The parry rule moves here from revision 2's soccer-4. The rest of R-2 (the missing restarts) moves here from revision 2's soccer-6, because V2 makes set pieces *earned* from play and restarts are how they are earned. R-1, C-4, J-1 and J-3 are already in the worktree. |
| 2 | CHANGE soccer-2: the shared `Stick` and A/B/C/D cluster; TRICK on D; the lofted THRU hold; the toast line replaces the hint over the goal | soccer-2. TRICK goes live on D in soccer-6. | Revision 2's own stick maths, SPRINT button, button sizes and spacing pref are replaced by nba's shared pieces and the geometry tokens. |
| 3 | KEEP soccer-3: the portrait camera, edge markers, safe-box framing | soccer-3 | The width goes from 24–32 m to about **34 m** (V2 B.3.3). The safe box is now V2's fixed action-safe box (A.5). |
| 4 | PROMOTE Appendix A to P1 (lead decision 6: touch dribbling first, then shot types and TRICK) | soccer-5: touch dribbling, shielding, acceleration archetypes. soccer-6: shot types, TRICK, the one-two. | If soccer-6 slips, touch dribbling has already shipped. Touch dribbling fixes B-1 and creates the tackle timing skill. |
| 5 | CHANGE soccer-4: SHOOT uses the gold ring with a range gate and a distance-scaled wind-up (0.35–0.62 s) | soccer-4 | Replaces revision 2's "meter grip" (`coneMult` 0.8–1.6). |
| 6 | CHANGE soccer-8/9: TACKLE ring between touches; CONTAIN hold; KEEPER on D; the reflex save (P1, solo only) | soccer-8 | The reflex save is the last item of soccer-8 and the only one that may drop (F.4 third wave). |
| 7 | ADD (with soccer-3): the Heat bar and On Fire; goal moments for the rival's goals too | The bar's slot: soccer-2 (HUD kit). Rival goal moments: soccer-3 (plate and pop), soccer-9 (replays from defend phases). The Heat engine: soccer-7. | Heat changes outcomes (On Fire widens gold windows), so its engine lands in the fit task, not the render task. The bar is hidden until soccer-7 fills it. |
| 8 | KEEP soccer-6, soccer-7, soccer-10 | Deal, set pieces and the fit: soccer-7. Revision 2's match shell is split: quit/forfeit in soccer-2 (C-5 done early), the goal plate in soccer-3, the box and report in soccer-9. The gate: soccer-10. | |
| 9 | CUT / keep deferred: formation templates (Appendix B), commentary ticker (Appendix C), substitutions, the swipe-to-dive shootout keeper | §12 | V2 B.3.2's penalty row calls swipe-to-dive P1, but F.2 #9 cuts it to P2. F.2 is the team's list, so it is cut. This is recorded in the team doc. |
| 10 | ADD (P1): Daily Play scenarios | soccer-10, first half | |
| 11 | Protocol: soccer draft 2 → 3, UT 2 → 3 | §9 | One bump by the lead at integration. |

### 0.2 The first-impression slice (F.4) is the build order

| F.4 | Slice item | Soccer task |
|---|---|---|
| 4 | Soccer frozen ball, parry and bend bugs | soccer-1 |
| 2 | Shared floating stick, A/B/C/D cluster, pre-held thumb, sprint ring, pause button | soccer-2 |
| 3 | Camera and the action-safe box | soccer-3 |
| 5 | The gold ring with honest windows, the PERFECT chime and haptic, the toast line | soccer-4. The chime is written in soccer-1 (soccer owns it for all three sports, F.1), and the toast line in soccer-2. |

soccer-1 to soccer-4 are the slice and the **must-not-slip list**.
- **Second wave:** soccer-5 to soccer-9 (touch dribbling, shot types and tricks, Heat and the fits, solo defence with rings, the 4–6 minute match), then the Daily Play in soccer-10.
- **Third wave:** the reflex save, at the end of soccer-8.

### 0.3 Cuts and replacements against revision 2

| Revision 2 | Revision 3 | Why |
|---|---|---|
| Soccer's own full-time card (`FullTime.tsx`, shot map, POTM plate, the MATCH ESTIMATE block) | **Cut.** Soccer supplies the data (`Progress.box`, `Progress.grade`, scorers, POTM). ut's shared result sequence shows it. | V2 D.1: one result slam, tally and One-More bar over the still-mounted arena, in every mode. |
| The meter grip (`coneMult` 0.8–1.6) | The gold ring (`perfect.ts`): three states; gold places the ball on the reticle | V2 B.0.1, B.3.5 |
| Soccer's own floating stick, sprint hysteresis, button sizes, `stick: 'fixed'` and `spacing` prefs | nba's `Stick` and the geometry tokens; soccer keeps only its zone and gesture classifier | V2 A.5, F.1 |
| `autoSwitch` default `'cross'` | Default `'on'` | V2 B.3.2 |
| A RUSH button above the cluster | KEEPER on D (hold) | V2 B.3.2 |
| Corners (15%) and free kicks (9%) dealt as attacks | A weighted bag of open play only (build-up, counter, wide, turnover high up, keeper long ball). Corners, free kicks and penalties are earned from play. | V2 B.3.1 |
| Auto-defended phases replayed at 2× with an AUTO ticker | An instant chunked sim. The rival's goals are shown as goal moments and replayed; WATCH plays the phase at 1×. | V2 B.3.7 (S-1.4); shorter matches |
| A haptic on a green release | Three patterns through ut's `haptics.ts`: tick (input accepted), double (PERFECT), long (goal, big tackle) | V2 B.0.5 |
| Running-stats intro card, xG on each shot readout | **Cut to P2.** `xg.ts` stays as data (the box carries xG). | V2 C.5 #6: on the field the only text is the toast line, name chips and the score bug |

### 0.4 What stays from revision 2

- Guards first: golden, two-phone agreement, test wall time.
- One calibration point: the whole-match fit is now soccer-7, after the last task that changes AI-vs-AI outcomes. soccer-8 to soccer-10 are solo-only or presentation and must keep golden green.
- ut contracts A (`Progress.box`) and B (`onQuit`), the nba/nfl forfeit (`'FF'`), solo `onRival`.
- The players action contract (now with V2's extra fields), `impactOf`/`HitStopCap` through the `fx.ts` seam, players' `celebrate.ts`, and shell's `ps:arena-ready` and `--sat`.
- QA isolation and the six device presets; the measured targets (§4); the 4–6 minute check with human-proxy input.
- Every audit P0 fix that V2 does not replace: V-1, V-2, B-1, B-2, R-1, R-2, R-3, C-4, C-5, V-3, J-1, J-3, the realism table, B-3, B-4, B-5, B-6, S-1 (defend phases), U-1 (every card plays), and the A-1 action fields.

## 1. Goals (V2: "One-touch flow. Pass, move, finish.")

The feel words are smooth, wide, sudden. The signature moment is a through ball into a first-time PERFECT finish, with the net bulge and the crowd.

1. **You can see the play.**
   - About 34 m across, inside the action-safe box.
   - Off-screen teammates show as edge arrows you can tap.
   - The stands take at most 12% of the height.
   - Nothing on the field hides the ball, the goal or your man.
2. **One control grammar.**
   - A floating stick, with sprint past its ring.
   - A = SHOOT / TACKLE, B = PASS / CONTAIN, C = THRU / SWITCH, D = TRICK / KEEPER.
   - Swipes start on A. Tap a teammate to pass to him.
   - At most four right-thumb targets at once. Everything fires on touch-down.
3. **Every touch can be PERFECT.**
   - The gold ring on SHOOT, TACKLE and TRICK. Gold never lies.
   - On gold: the chime, the double haptic and the word PERFECT.
   - Heat builds to ON FIRE.
4. **Skill beats exploits.**
   - Touch dribbling ends sprint-and-shoot.
   - Better cards are better on a smooth curve.
   - Aim, timing, tricks and defending are rewarded.
5. **The numbers look real.**
   - Shots, on-target share, conversion by distance, save%, blocks, penalties and free kicks land near top-flight football, times the documented arcade factor.
   - About 2.4–2.7 goals and about 25% draws a match.
6. **It is a match** (owner decisions 2 and 3).
   - In solo play you defend every rival attack by default, with Auto-defend and SIM.
   - A match takes 4–6 minutes and ends in a staged Clutch.
   - Every match gets a grade. The difficulty ladder is honest. A rematch is one tap and under 10 s.
7. **Nothing breaks.**
   - No save, storage key, card or copy id changes.
   - One soccer protocol bump, done by the lead. NBA and NFL are untouched by soccer.
   - Preserved: determinism, bounded ratings, the 2026-11-02 aim/shoot/pass contract and its miss reasons, the keeper model, offside, the shootout rules.

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
- Owner decisions override Game Design V2. V2 overrides STREAM, STREAM overrides research, and research overrides the audit's suggestions. Every disagreement is noted in the team doc.
- **Goals per match:** STREAM says 2.3–2.7, research 2.6–3.2, the audit's real figure 2.7–2.9. STREAM governs (the owner-facing brief, and "realistic AI-vs-AI scorelines" is a preserve item), so the target is 2.4–2.7.
- **V2 numbers** marked [new] in V2 are starting values. Each one is fitted with the harnesses and recorded in the team doc.

**Column key:**
- **H** = harness target (tight).
- **G** = vitest guard (wide).
- **Task** = where it is fitted or built. soccer-10 re-measures every row.

### 4.1 Whole match, AI vs AI (`sim.ts 400`, Pro unless noted)

| Id | Metric | Baseline | H | G | Task |
|---|---|---|---|---|---|
| A1 | Goals per match | 2.33 | 2.4–2.7 | 2.0–3.1 | 7 |
| A2 | Draws; 0–0 | 26.8%; 7.8% (Legend 14.5%) | 22–29%; 4–10% at every level | 15–35%; ≤ 14% | 7 |
| A3 | Per level: draws; 0–0 | Legend 31% / 14.5% | 20–30%; ≤ 10% at Rookie, Pro and Legend | — | 7 |
| A4 | Better side (ΔOVR ≥ 8) W/D/L | 69/24/7 | 60–72 / 18–28 / 7–15 | — | 7 |
| A5 | Shots per side (played attacks) | 5.21 | 9–13 | ≥ 8 | 7 |
| A6 | On target; goals per shot; save% | 53.7; 20.4; 61.9% | 32–40; 9–14; 64–72% | 28–44; 8–16; — | 4 (interim), 7 |
| A7 | Blocked; woodwork; headers | 11.3; 4.2; 18.3% | 20–30; 2–4; 8–14% | ≥ 16; —; — | 4, 7 |
| A8 | Shots from outside the box | about 10% (3.3% from 22 m+) | 25–35% of all shots | ≥ 18% | 4, 7 |
| A9 | **(V2)** Per-attack goal rate by dealt scenario; earned set pieces per side per match | build 21.6 / counter 19.4 / wide 18.9%; corners and FKs dealt | counter ≥ build + 2; turnover-high ≥ counter; long ball ≤ build. Corners won 1.0–2.5; free-kick attacks inside 30 m 0.4–1.2 [new] | each scenario 8–30%; corners ≥ 0.6 | 7 |
| A10 | Attack ends (the AI's attacks) | lost 33.7, intercepted 13.2, tackled 6.4, offside 3.0, time 0.6% | lost ≤ 30, intercepted ≤ 15, tackled + poked ≥ 8, offside 2–5, time ≤ 1% | lost ≤ 35, time ≤ 2% | 5, 7 |
| A11 | Set-piece share of goals (excluding pens) | about 32% | 12–22% | 8–28% | 7 |
| A12 | Penalties awarded per team per match; pens scored; shootout kicks; direct FK per shot | —; 93%; —; 2.3% | 0.2–0.3; 74–78% (n ≥ 300); 70–75% (n ≥ 2,000); 6–11% | —; 68–84%; 64–81%; 4–14% | 5, 7 |
| A13 | Rating gap: the autopilot's per-attack goal rate per +10 OVR | +6.2 points (`sim.ts gap`) | +5 to +7 points | +3 to +9 | 7 |
| A14 | AI goals per side vs a fixed 75 defence: Rookie / Pro / Legend | 1.17 / 1.17 / 0.99 | 0.8–1.0 / 1.1–1.35 / 1.45–1.8, monotone | monotone; Legend ≥ 1.3× Rookie | 7 (sims), 9 (solo) |

### 4.2 Shooting and keeping (`audit_soccer_shots.ts 200`, `xg-bands`, 75-rated sides)

| Id | Metric | Baseline | H | G | Task |
|---|---|---|---|---|---|
| S1 | Conversion by band: 0–6 / 6–11 / 11–16.5 / 16.5–22 / 22–30 / 30+ m | 59.5 / 45 / 23.4 / 15.8 / 5.5 / 3.1% | 35–55 / 18–32 / 8–15 / 4–8 / 1.5–4 / ≤ 1.5%, monotone | each band ±5 points wider, monotone | 4 |
| S2 | Keeper goals per on-target shot: < 6 yd / 6–12 / 12–18 / 18–25 / > 25 yd | — | 70–80 / 45–55 / 30–40 / 18–25 / 8–12% | ±7 points | 4 |
| S3 | One dive per shot; lost rush races; claims crosses he reaches first | — | 100%; ≤ 20% of rushes; ≥ 80% | 100%; ≤ 28%; ≥ 70% | 4 |
| S4 | Far-post first-time shot: dive after the strike, no pre-shift > 0.5 m to the near post | — | 100% | 100% | 4 |
| S5 | GK 93 vs GK 75 on identical shots (goals conceded ratio) | — | 0.70–0.85× | 0.62–0.92× | 4 |
| S6 | 1v1 12–16 m; SHO 95 vs GK 75; SHO 75 vs GK 93; edge 18–21 m; 25–30 m (SHO 75 / 95) | 62% (1v1) | 35–45; 50–58; 25–32; 12–18; 3–5 / 6–9% | — | 4 |
| S7 | Header from a cross at 8–10 yd | — | 12–18% | 8–22% | 4 |
| S8 | **(V2)** A gold release aimed at the corner vs the assist (16–20 m) | drag 40 < assist 49% | gold ≥ assist + 5 points; assist ≥ 70% of gold | gold ≥ assist + 2 | 4 |
| S9 | First-time error multiplier, shots and passes | — | ×1.5–1.7 at 180°, ×1.15–1.25 at 90° | exact (pure) + drill ±0.1 | 4 |
| S10 | Parry own-goals; parries back into the central 18 m | 14.3% of goals; — | ≤ 1% of goals; ≤ 12.5% of parries (fewer at HAN ≥ 85) | ≤ 2%; ≤ 18% | 1 (rule), 4 (fit) |
| S11 | Free kick, person: skilled / careless | 3.5–4.5% | 6–9% / 1–4% | — | 7 |
| S12 | Penalty, person: low corner / centre; PERFECT / GOOD release | 84.5% | 80–88 / ≤ 40; about 85 / about 70% | — | 7 |

### 4.3 Person vs AI (`human.ts`, `ratings-human.ts`; guard `balance.test.ts`)

| Id | Metric | Baseline | H | G | Task |
|---|---|---|---|---|---|
| P1 | Every no-skill beeline row vs the Pro autopilot on the same attacks | up to 2.9× | ≤ 1.3× | ≤ 1.35× | 5 |
| P2 | A person shooting from 30 m, every scenario | 9.5–22.5% | ≤ 2% | ≤ 3% | 4 |
| P3 | Beeline penalties won; free kicks won (per run) | 15.5%; 28% | ≤ 3%; ≤ 8% | ≤ 4%; ≤ 9% | 5 |
| P4 | `skilled` vs the best no-skill row (counter, build) | — | +5 points | +4 | 5 |
| P5 | Counter beeline at 60/70/80/90/99 vs a 78 defence | 0.7 / 1.3 / 32.0 / 92.3 / 99.3% | 3–12 / 8–20 / 15–30 / 22–40 / 30–55%; no adjacent step > ×2.5; the autopilot's 60→99 gap ≥ 15 points | monotone; 60 ≥ 3%; 99 ≤ 60% | 5 |
| P6 | PAC-only gradient 60→99 (now with acceleration archetypes) | counter 3.3 → 90% | monotone; no adjacent 10-point step > ×2.5 | monotone | 5 |
| P7 | `tackleWin` at a 10-point gap | cliff | 0.55–0.75 | same | 5 |
| P8 | A breakaway foul from behind is a yellow | — | ≥ 90% | ≥ 85% | 5 |

### 4.4 Solo match with defending (soccer-8, soccer-9)

| Id | Metric | H | G |
|---|---|---|---|
| D1 | Concede per defend phase: `idle` ≥ auto + 3 points; `good` ≤ auto − 3; `spam` ≥ good + 5 with fouls ≥ 2× good | as stated | as stated, n=100 |
| D2 | The `good` proxy concedes within ±3 points of the Pro autopilot defence (defIQ 0). Auto-defend (`OWN_DEF_IQ`) concedes 3–5 points more than `good`. | as stated | ±5 |
| D3 | Switch applied in the same step as the tap; auto-switch picks the earliest meet point on crosses and never one who can't reach a loose ball first; a KEEPER rush timed at the carrier's touch smothers ≥ 1.5× an untimed one; a slide from behind in the box that misses the ball gives a penalty | same step; ≥ 90%; ≥ 1.5×; ≥ 50% | same step; ≥ 85%; ≥ 1.3×; ≥ 40% |
| D4 | Ladder with human defending (`skilled` + `good`, 200 matches per level): win% Rookie / Pro / Legend; every level 0–0 and draws | 70–85 / 45–60 / 25–40; ≤ 10%, 20–30% | monotone |
| D5 | SIM parity: SIM win% ≤ the `skilled` + `good` win%, and within 5 points of it, at each level | as stated | ≤ played + 2 |
| D6 | The rival's solo goals come from played or auto-defended phases | 100% | 100% |
| D7 | Every outfield slot touches the ball or makes a defensive action | ≥ 80% of matches | ≥ 70% |

### 4.5 Time, flow and online

| Id | Metric | Target | Task |
|---|---|---|---|
| F1 | Solo match length in the default mode, real time with human-proxy input (not autoplay), including intros, replays, goal moments, half-time and the result sheet's first 2.5 s | median 4.0–6.0 min; p10 ≥ 3.5; p90 ≤ 7.0 (20 matches) | 9 |
| F2 | **(V2)** Phase clock | every attack and defend phase runs on a 20–30 s clock; median real length 15–18 s | 7, 8, 9 |
| F3 | Online H2H | unchanged: simultaneous, no defend phases, same length | 9 |
| F4 | Online agreement: takeover, taken, `simBoth` from phone A's and B's views (now including Heat); `agreedShootout` | 100% identical over 500 seeds; 100% over 1,000 seeds | 1 (guard), 7, 9 |
| F5 | **(V2)** Settlement and goal moments | `onFinish` not delayed (today's 1.6 s / 2.6 s beat unchanged); a rival-goal moment shows ≤ 200 ms after the score changes | 3, 9 |
| F6 | SKIP / SIM / Auto-defend fast-forward | no long task > 200 ms at 4× CPU (chunked ≤ 6 ms of steps per frame) | 9 |

### 4.6 Camera, controls, performance, bundle

| Id | Metric | Target | Task |
|---|---|---|---|
| V1 | **(V2)** Kick-off framing, all six presets | pitch width at the carrier's row 32–36 m; carrier inside the action-safe box 100%. Teammates on screen: build ≥ 3/5, counter ≥ 2/3, wide ≥ 3/5, corner ≥ 4/5, FK 4/4. Stands ≤ 12% of H. Corners framed from the flag side with the goal in the upper third, taker ≥ 22 px with x in [20, W − 20]. Goal mouth ≥ 60 px wide inside 30 m. | 3 |
| V2 | Mid-attack framing (200 autopilot attacks per scenario) | carrier in the safe box ≥ 98% of frames; goal mouth fully in frame ≥ 95% of frames with the carrier inside 25 m; ≤ 4 zoom changes a second; name tag ∩ control rects = 0 in 100% of frames | 3 |
| V3 | **(V2)** Sizes at 393 (players' LOD, C.1.2) | the controlled player 34 ± 2 design px tall (≥ 30 at 320); other near players 30–34; far players ≥ 22; ball ≥ 5 px with a shadow, and a trail on shots over 22 m/s. Any trade-off agreed with players is written in both team docs. | 3 |
| V4 | Frame pacing, production build, 393×852, DPR 3, 4× CPU | fps ≥ 58; p99 ≤ 33.4 ms; no long task > 200 ms, including SKIP; soccer stale draws ≤ 1% | 10 (dev before/after in 3) |
| C1 | **(V2)** Touch layout, from the geometry tokens (A.5), checked from the DOM | at 393×852 (insets 59/34): A Ø92 centred (323, 738), B Ø64 (238, 778), C Ø48 (250, 694), D Ø48 (340, 652), each ±2 px. At 320×568: Ø84/56/44/44 at (266, 510), (190, 536), (200, 468), (282, 436). Gaps 10–18 px. Every target ≥ 44 px. Stick zone x 0–189, y 383–818 (320: x 0–154, y 256–568). Score bug top = sat + 6. Pause 44×44. Toast line bottom edge at y 618 (320: 404). No right-thumb target in the top two thirds. Text ≥ 10 px. No horizontal overflow at 320. | 2 |
| C2 | Input latency, touch → visible change | ≤ 100 ms p95 (stick knob, SHOOT ring, TACKLE ring, TRICK) | 2, 4, 6, 8 |
| C3 | Gesture accuracy | tap-to-pass misread as a swipe or stick ≤ 2%; aim drag misread as a chip ≤ 1%; FK bend swipe vs tap 100% separated; slide swipe vs SWITCH tap 100% separated; tap-a-player hit radius ≥ 22 px with nearest-player resolution | 2, 6, 8 |
| C4 | Sprint under SHOOT | a left-thumb sprint (past the stick ring) held while the right thumb winds up keeps ≥ 0.85 × sprint top speed | 2 |
| C5 | **(V2)** Pre-held thumb | a thumb down in the stick zone 500 ms before the kick-off whistle moves the carrier within 100 ms after it | 2 |
| R1 | Reduced motion | No shake, slow motion or slide-ins. Zoom steps cut instantly. Replays ≤ 1.0 s or skipped. No confetti, net bulge or edge-marker pulse. No sprint-ring flash. No count-ups. No PERFECT scale (colour and sound stay). Hit-stop ≤ 30 ms. | 2, 3, 4, 9, 10 |
| B1 | Bundle | the soccer arcade chunk grows ≤ 60 KB raw / ≤ 18 KB gzip over its 91 KB baseline (V2 adds shot types, tricks, Heat, the Daily Play); 0 bytes of soccer2 code in the first-paint entry; startup JS ≤ +2 KB gzip over 592 KB | 10 |
| T1 | Test wall time | the soccer suite in ≤ 120 s | 1 (baseline), every task |

### 4.7 V2 targets (new rows)

| Id | Metric | H | G | Task |
|---|---|---|---|---|
| G1 | Gold window: half-width ≥ 30 ms for every SHO, distance and context on the grid; the gold arc is drawn ≥ 8 design px at 320 and 393 | as stated | as stated | 4 |
| G2 | **Gold never lies.** (a) Over 1,000 seeded gold releases with the keeper and blockers removed, 100% cross the line within 0.25 m of the reticle. (b) Gold is never offered with a defender within 2 m, beyond `maxRange`, first time across the body > 90°, or for a header beyond 8 m: those are amber (or red beyond range), and the toast names the dial (PRESSURE, RANGE, TIMING). | 100%; 100% | 100%; 100% | 4 |
| G3 | Ratings you can see: the gold window for SHO 95 is ≥ 1.5× SHO 70 at 16 m; the tackle ring's gold for DEF 95 is ≥ 1.5× DEF 70; a trick's gold flash for 5★ is ≥ 1.5× 1★ | as stated | as stated | 4, 6, 8 |
| G4 | Wind-up: `meter.top` = 0.35 s at ≤ 11 m, rising linearly to 0.62 s at 25 m | exact | exact | 4 |
| G5 | Timing from the touch: releases are judged from `PointerEvent.timeStamp` deltas minus the device lag; a synthetic press/release pair across frame boundaries is judged to ±1 ms of its true offset (not quantised to 16.7 ms) | ±1 ms | ±2 ms | 4 |
| G6 | PERFECT feedback: the word in the toast line, `sfx.perfect(streak)` and the double haptic fire in the same frame as a gold release; the chime rises 1 semitone per consecutive PERFECT, up to +4 | same frame | same frame | 1 (sound), 4 |
| G7 | Touch cadence: a touch every 2 strides at a jog with the ball 0.6–1.0 m ahead; every 3–4 at a run; every 5–6 at a sprint with the ball 3–5 m ahead. A DRI 95 touch travels ≤ 0.75× a DRI 60 one at the same speed. | as stated | ±1 stride; ±0.3 m | 5 |
| G8 | Ball won between touches: ≥ 80% of open-play tackles the AI wins happen while the ball is > 0.6 m from the carrier's feet | ≥ 80% | ≥ 70% | 5 |
| G9 | Shielding (stick back toward your own goal, a defender within 1.5 m): the shield holds ≥ 2 s in ≥ 60% of tries at PHY +10 over the defender, and ≤ 35% at PHY −10 | as stated | ≥ 50% / ≤ 45% | 5 |
| G10 | Shot types: chip 1v1 vs a keeper > 4 m off his line 45–55%, ≤ 15% vs one on his line; finesse to the far corner from 16–20 m +3–6 points over placed; low driven blocked ≥ 5 points less often; power +25% speed with ×1.35 cone | as stated | direction of each effect | 6 |
| G11 | TRICK: success against a closing defender 25–45% at 4–5★, 5★ ≥ 2× 1★. A trick started inside the gold flash beats the defender 100% (he stumbles 0.8 s). A 4th trick within 1.2 s forces a heavy touch. | as stated | as stated | 6 |
| G12 | One-two: B tapped again within 1 s returns the ball first time ≥ 95% of the time when the return lane is open; the passer keeps running | ≥ 95% | ≥ 90% | 6 |
| G13 | No single verb dominates: no shot-type, trick or one-two strategy above 1.3× the Pro autopilot | ≤ 1.3× | ≤ 1.35× | 6, 7 |
| G14 | Heat rules (V2 B.0.2), exact in a pure test: PERFECT +12, goal +40, stop or turnover forced +15, a clean possession with ≥ 2 passes +5, turnover −20, conceding −10; HEATING UP at 66; ON FIRE at 100 for the next 1 attack; gold windows ×1.25 and uncontested amber becomes gold while On Fire; reset at half-time | exact | exact | 7 |
| G15 | Heat frequency [new starting values]: an AI side reaches ON FIRE in 15–40% of AI-vs-AI Pro matches; the `skilled` proxy in 30–60% of solo matches; A1–A4 still hold with Heat on | as stated | AI 8–50% | 7, 9 |
| G16 | Heat parity: identical Heat from both phones' seats in takeover, taken and `simBoth`; online Heat uses each side's own attack events only | 100% | 100% | 7 |
| G17 | TACKLE ring: a tap on gold wins the ball cleanly 100% of the time (gold only when the ball is exposed between touches and the angle is front or side); a tap before the ring opens fouls ≥ 3× as often as a gold tap | as stated | as stated | 8 |
| G18 | Reflex save (solo only): on an on-target shot inside 16 m in a defend phase, time runs at 0.5× for 300 ms; a swipe adds ≤ +15% reach in its direction; with no swipe the outcome equals the rated keeper (seeded identity test); never offered online; save-rate gain with a well-timed swipe at 8–16 m: +5 to +12 points [new] | as stated | as stated | 8 |
| G19 | Clutch staging (B.0.4) on each side's stoppage attack: the bug reads CLUTCH in gold; the camera sits 6% tighter; the crowd bed rises; the heartbeat haptic runs when the margin is ≤ 1 goal; "FOR THE WIN" / "TO TIE IT" shows when your last attack can win or tie; a goal in Clutch always replays (≤ 1.0 s or skipped under reduced motion). Golden unchanged. | as stated | as stated | 3, 9 |
| G20 | Grade [new starting values]: S/A/B/C from your goals per attack against the level's par; the `skilled` proxy at Pro: S 5–15%, A 20–35%, B 30–45%, C the rest. FLAWLESS = a win with no `'L'` end in your attacks. | as stated | every letter occurs | 9 |
| G21 | Rematch: final whistle to the next kick-off ≤ 10 s with one tap at 4× CPU, without reloading the arena | ≤ 10 s | ≤ 12 s | 9 |
| G22 | Daily Play: the same day gives an identical scenario on every device; 365 consecutive days give valid scenarios; the autopilot succeeds on each in 20–80% of 200 seeds; an attempt takes 60–90 s of real time | as stated | as stated | 10 |

## 5. Shared contracts

Branches merge only at integration. Where another team's code isn't in our base, soccer writes against the contract below. The lead keeps one copy at merge.

### 5.0 The V2 shared pieces (F.1): what soccer writes and what it consumes

#### 5.0.1 Pieces soccer WRITES (other teams can rely on these)

**(a) The PERFECT chime, the ring tick and the woodwork clang, in `src/lib/sound.ts`.** These are soccer's under F.1, because soccer already owns the sound wiring. They are written in soccer-1, so nba and nfl can call them from their first ring task.

```ts
// added to the existing `sfx` object; synthesized on the existing AudioContext; no new audio files
sfx.perfect(streak?: number): void // two notes: a root, then a fifth above it 70 ms later (~180 ms in all).
                                   // Both rise by min(streak - 1, 4) semitones. streak defaults to 1.
sfx.ringTick(i?: number): void     // one short tick for the last 200 ms of a closing ring. The caller
                                   // schedules up to 4 (i = 0..3); each step is 2 semitones higher.
sfx.post(): void                   // ball off the woodwork: a short metallic clang and the crowd's ooh
```

- All three are silent when sound is off (`setFeedback`).
- No new files; under 1.5 KB gzip.
- Tested in `src/lib/sound-perfect.test.ts`, which runs in the default suite.
- The soccer crowd bed (venue `'pitch'`) is already wired (soccer-1 Step B).

**(b) Soccer's fields on the final `Progress` (soccer-9).** ut reads them duck-typed. Like `box`, they are stripped before the wire.

```ts
grade?: {
  letter: 'S' | 'A' | 'B' | 'C';
  perfects: number;   // your gold releases: shots, tackles, tricks
  bestHeat: number;   // 0..100
  fire: number;       // times you went ON FIRE
  flawless: boolean;  // a win with no 'L' end in your attacks
  perAttack: number;  // your goals per attack
  par: number;        // the level's par (goals per attack)
};
box?: BoxLine[];      // ut contract A (§5.1), soccer keys plus the optional extras below
```

- **`BoxLine.stats` optional extras for card mastery (V2 D.6):**
  - `perfects`;
  - `longGoals` (goals from ≥ 16.5 m);
  - `firstTime` (first-time goals);
  - `tricks` (tricks that beat a man);
  - `xg`.
- **If nba publishes a different `grade` shape** in `src/game/progress.ts` first, soccer adopts nba's names. `gradeOf` is one function, so only it changes.

**(c) The Daily Play (soccer-10).** It lives in `src/game/soccer2/daily-play.ts`, is re-exported from `arcade.ts`, and loads lazily with the soccer chunk. ut hosts it.

```ts
export interface DailyPlay {
  id: string;        // 'soccer:2026-11-20'
  day: string;       // the app's ET day key, passed in by ut
  title: string;     // "90'+2 · FREE KICK AT 22 M"
  brief: string;     // one line naming the star: "1–1. Beckham over the ball. Win it."
  star: string;      // the card id or name of the player the scenario is about
  clockS: number;    // game seconds on the clock
}
export function dailyPlayFor(day: string): DailyPlay; // pure: same day → same scenario everywhere
export interface DailyRun {
  id: string;
  outcome: 'goal' | 'saved' | 'miss' | 'lost';
  perfects: number;
  t: number;         // game seconds used
  practice: boolean;
}
export function scoreDailyPlay(run: DailyRun): { score: number; stars: 0 | 1 | 2 | 3; result: string };
// result: a spoiler-free text, e.g. "GOAL 90+2' · 0:41"; ut adds the "PS SOC #n" prefix,
// draws the stars as SVG and builds the share card
```

- **Host:** `<Soccer2 daily={dp} onDaily={(run) => …} />` plays the one scenario: no intro cards, no defend phase, no SIM, no prefs read. It calls `onDaily` once per attempt.
- **ut's side:** attempts (three scored, then practice), coins, the board, the share sheet and the Daily Play screen. The board tag belongs to ut and the lead.

**(d) Small soccer hunks in nba's shared V2 files** (allowed by the V2 grant), only if those files are in our base. Examples: a D-slot label prop, a hold-to-rush prop. Each one is listed in the team doc.

#### 5.0.2 Pieces soccer CONSUMES, and the interface soccer writes against

nba's published names win at merge, and soccer adapts only in its adapter folder (below).

| Piece (author) | What soccer relies on |
|---|---|
| `src/game/controls-geometry.css` (nba) | CSS custom properties for A, B, C and D, the stick zone and ring, the sprint ring, the score bug, pause, the Heat bar, the toast line and the action-safe box, at 393 and 320, scaled by the stage (V2 A.5). Soccer reads **rects from the DOM** (`getBoundingClientRect` of the cluster, bug and toast nodes). It reads the safe box through one function, `v2/geometry.ts: safeBox()`, so no other soccer file names a token. |
| `src/game/stick.ts` + `Stick.tsx` (nba) | `<Stick zone onVector={(v, sprint) => …} live ghost />`: <br>• the base floats to the first touch in the zone and is clamped on screen; <br>• a thumb resting in the zone before the whistle is live at the whistle; <br>• `v` is a two-axis vector with \|v\| ≤ 1, and release gives `{0, 0}` (release-to-stop); <br>• sprint is on past 1.15× the ring radius and off back under 1.0×, with a `'tick'` haptic on crossing; <br>• one pointer id per stick. |
| `src/game/perfect.ts` + `PerfectRing` (nba) | `ringWindow({ baseHalfMs, rating01, contested, inRange, fire }) → { state: 'gold' \| 'amber' \| 'red'; goldHalfMs /* ≥ 30 */; dial?: 'TIMING' \| 'PRESSURE' \| 'RANGE' }` (fire: ×1.25, and uncontested amber becomes gold). <br>`judge(pressTs, releaseTs, targetMs, win, lagMs) → { offMs; word: 'PERFECT' \| 'GOOD' \| 'EARLY' \| 'LATE'; gold: boolean }`. <br>`deviceLagMs()` (the one-time calibration value). <br>`drawRing(ctx, { x, y, r, progress, goldFrom, goldTo, state })` with the gold arc ≥ 8 px. <br>All pure: no `Math.random`, no `Date.now`. **The engine never reads a pointer timestamp:** soccer converts the judged offset into the release time in game seconds that `releaseShoot` already takes, so AI simulations stay deterministic. |
| `src/game/heat.ts` (nba) | `newHeat()`; `heatStep(h, ev: 'perfect' \| 'score' \| 'stop' \| 'clean' \| 'turnover' \| 'conceded' \| 'half', sport) → { v /* 0..100 */; fire /* units left */; heating; best }`. Gains come through `pick({ nba, nfl, soccer })`; for soccer, `score` = +40 and On Fire lasts 1 attack. `FIRE_MULT = 1.25`. Pure and deterministic. Soccer keeps the state on `Match`, and in the AI sims inside `aiProgressFor`. |
| `src/game/hud/*` (nba) | `<ScoreBug you rival clock heat rivalHeat? clutch progress />`: the 232×40 capsule, the 6 px Heat bar and the 3 px progress line. For soccer, `clock` reads "67' · 5/7". `<Toast text kind />`: one line, 28 px, bottom edge on the toast line. `<PauseButton onPress />`: 44×44. |
| Arena kept mounted through the result sheet (nba, in `Arcade.tsx`) | A rematch re-seeds the sport component in place. Soccer exposes a `Soccer2` that re-seeds without remounting its canvas or sprite caches, and adopts nba's path in its own branch of `Arcade.tsx` (soccer-9). |
| `src/lib/haptics.ts` (ut) | `haptic(kind: 'tick' \| 'double' \| 'long')`, gesture-gated on iOS, a no-op where unsupported. Clutch's heartbeat is two ticks 120 ms apart every 1.2 s, built by soccer from `'tick'` unless ut publishes `'heartbeat'`. |
| `src/lib/playtime.ts` `usePlaytime` (ut) | `usePlaytime('match', { paused, auto, stoppage })`. <br>• `auto`: true while only Auto-defend or SIM is playing, so that time alone never counts. <br>• `stoppage`: true between phases, the only moment a break reminder may show. <br>• Banking on completion is the host's, through `onFinish`/`onQuit`. <br>• If the hook returns a `todayLine`, the pause sheet shows it ("Today 27 min · next reward at 30"). |
| players: sprites, actions, impact, celebrations | Sprites at V2 sizes through their LOD (C.1.2); routing of the §5.5 fields and acts; `impactOf(kind).stopMs` and `HitStopCap` behind soccer's `fx.ts`; `celebrate.ts` and the run-ins on `goalAt`; the crowd's front-row sprites. |
| shell | `ps:arena-ready` (soccer dispatches it); `--sat`/`--sab` after Fix A. |
| ut | The result sequence (D.1) built from `Progress.box`/`grade`; the One-More bar; the Daily Play host and board; objectives that read `grade`. |
| lead | The protocol bump; unifying the three sports' `autoDefend` prefs; the `play` board branch. |

**The adapter folder `src/game/soccer2/v2/`:**
- `index.ts` is the only place soccer code imports the shared V2 pieces from.
- Until a piece is in our base, a stand-in beside it implements exactly the interface above: `stick.ts`, `perfect.ts`, `heat.ts`, `hud.tsx`, `haptics.ts`, `playtime.ts`, `geometry.ts`. Each starts with `// merge: replace with <team>'s <file>, then delete this file`.
- Soccer's tests import only through `v2/index.ts`, so they run against either the stand-in or the real piece.
- At merge, the lead points `index.ts` at the shared files and deletes the stand-ins. Every stand-in is listed in the team doc.
- We never merge another team's branch (BUILD-RULES).

### 5.1 ut contract A: `Progress.box` (soccer-9)

- `BoxLine { id; name; tag; pos?; side: 'us' | 'them'; rating: number /* 1.0–10.0 */; stats: { goals, assists, shots, onTarget, saves, tackles, keyPasses, conceded, …the §5.0.1(b) extras } }` on the final `Progress` that `onFinish` receives.
- **Built from played engine events only:** your attacks and the rival's attacks (simulated, or defend phases from soccer-9). Online the rival's detail is letters only, so the rival's box is absent and ut hides that block.
- **Rating:**
  - 6.5 base;
  - +1.0 per goal, +0.6 per assist, +0.3 per key pass or tackle won, −0.5 per error leading to a goal;
  - keepers +0.3 per save, −0.4 per goal conceded inside 12 m;
  - clamped to 1.0–10.0.
- **Stripped before the wire.** If nba's strip in `Arcade.progress()` isn't in our base, soccer adds the same one-line, sport-agnostic strip, marked for merge. A test asserts the wire object has no `box` and no `grade`.

### 5.2 ut contract B: `onQuit(us, them)` (soccer-2)

- Solo quit, after a confirm, calls the host's `onQuit` with both progresses. The host decides:
  - Squad Battles: leave with no result;
  - Cup, Circuit, Season and Draft: ut-4's forfeit settlement.
- Soccer shows the host's confirm note; the default is "It counts as a loss."
- No soccer-side settlement and no `'T'` padding.

### 5.3 The nba/nfl forfeit (soccer-2)

- **Online FORFEIT**, after "Forfeit? Your rival wins.", sends a final `Progress` with `done: true` and `forfeit: true`, with `ends` padded with `'FF'` (worth 0) up to `TOTAL`.
- The rival's `Arcade` finishes at once. `onFinish`'s optional 6th argument `forfeit: 'us' | 'them'` is passed through.
- **Soccer's own pieces:**
  - `'FF'` in the soccer `POINTS`;
  - the soccer `END_LABEL` in `ut/Match.tsx`;
  - `AttackEnd`/`END_TEXT` "FORFEIT" in `soccer2/match.ts`.
- **ut hand-off:** `'FF'` in the soccer letters in `match-debrief.ts`. That is ut's file, so soccer doesn't edit it.

### 5.4 Solo `onRival` (soccer-9)

- `Soccer2` reports the rival's `Progress` after each defend phase.
- In the soccer branch of `Arcade`, when `!online`, `them`/`shown` come from it, in the same state shape as nba-9 and nfl contract 2, so the lead can fold the three into one block.
- The precomputed `ai` stays for the kick-off "SIM IT" of a whole match.

### 5.5 players: the action contract (V2 B.3.6)

`Body` gains optional, render-only fields. The engine writes them from deterministic geometry and never reads them, and it consumes no `a.rand` for them. A test randomises them every step and expects identical outcomes. The engine never imports `appearance*` (import-graph test).

| Field | Meaning | Task |
|---|---|---|
| `kickFoot: 'L' \| 'R'` | the ball's side relative to the strike direction | 4 |
| `passKind` | `'ground' \| 'lofted' \| 'cross' \| 'through' \| 'loftedThrough' \| 'shot' \| 'header' \| 'pen' \| 'fk' \| 'clear' \| 'throw' \| 'oneTwo'` | 1 (`throw`), 2 (`loftedThrough`), 4, 6 (`oneTwo`) |
| `shotKind: 'placed' \| 'power' \| 'finesse' \| 'chip' \| 'low'` and `power: 0..1` | the shot type; the backlift scales with power (4–10 frames); contact is locked to the launch | 4 (placed, power), 6 |
| `contact: 'foot' \| 'head' \| 'volley'` | header (crouch, rise, neck snap) and volley (side-on swing) poses | 4 |
| `diveHeight: 'low' \| 'mid' \| 'high'` | the keeper's dive | 4 |
| `keeperSet: number` | when the keeper's split step lands (≥ 4 frames before every strike) | 4 |
| `touchAt: number` | the time of the last dribble touch (now a real knock-on) | 5 |
| `trick: { kind: 'feint' \| 'stepover' \| 'roulette' \| 'dragback' \| 'ballroll'; at: number }` | step-over 14 f, roulette 20 f, drag-back 16 f; control returns at 60% | 6 |
| `slide: { at: number; dx: number; dy: number }` | block lunges and slide tackles | 4, 8 |
| `look: { x: number; y: number }` | facing at the ball while jockeying; sim facing `fx/fy` stays velocity-based | 5 |

- **Acts:** `'jockey' | 'poke' | 'block' | 'getup' | 'slide' | 'shield' | 'trick'`.
- **Routing (players-5/players-8 own it):**
  - `'jockey'` → `shuffle`/`shuffle_l`;
  - drifting → walk;
  - `'getup'` → `getup_front`;
  - dives by `diveHeight`;
  - kicks by `kickFoot`;
  - unknown acts fall back safely.
- **Stand-in:** if players' routing isn't in our base, soccer adds a routing of ≤ 10 lines to existing clips in the players section of `render.ts`, marked for merge.

### 5.6 players: impact and celebrations (soccer-3)

- Hit-stop goes through `soccer2/fx.ts` `hitStopFor(kind)`:
  - power shot 33 ms, goal 66, save 60, woodwork 80 (V2 B.3.6 and B.0.5);
  - always in [33, 120];
  - a rolling cap of ≤ 150 ms per second;
  - ≤ 30 ms under reduced motion.
- At merge the lead points `hitStopFor` at players' `impactOf(kind).stopMs` and `HitStopCap`. Soccer calls only the existing `Juice` API.
- Celebrations and run-ins are players' (`celebrate.ts`, on `goalAt`). Soccer exposes `goalAt` and the scorer's id, and does no celebration steering in `settle()`.

### 5.7 shell

- `ps:arena-ready` is dispatched once per match, after the first frame drawn (soccer-3).
- Tip lines for `arena-tips.ts` go into our team doc (drafted in soccer-2, final in soccer-9).
- HUD offsets are relative to `--sat`/`--sab`; every layout check runs at sat 59 and sat 81.
- `soccer-lazy.ts` follows `arcade.ts`'s exports, so it needs no edit.

### 5.8 Controls and gestures (V2 A.5 and B.3.2)

**Thresholds:**
- A **tap** moves < 12 px and lasts < 200 ms.
- A **swipe** moves ≥ 40 px in ≤ 250 ms.
- A **flick up** off A moves > 40 px upward in < 150 ms.
- A **curved drag** turns > 15°.
- A **double-tap** is two taps within 250 ms.

**Precedence:** button hit rects, then the stick zone, then the pitch. Taps fire on touch-down; holds and releases are deliberate.

| Phase | Stick | A (Ø92) | B (Ø64) | C (Ø48) | D (Ø48) | Pitch |
|---|---|---|---|---|---|---|
| **Attack** | run; past the ring = sprint (longer, losable touches) | **SHOOT.** Hold: the ring fills; drag to aim at the mini-goal; release on gold. Flick up = chip. Curved drag = finesse. Double-tap = low driven. Hold past gold into red = power. | **PASS.** Tap: ground pass along the stick. Hold ≥ 0.22 s: lob or cross. Tap again within 1 s of a pass: the one-two return. | **THRU.** Tap: ground through ball. Hold: lofted through ball. | **TRICK** by the stick direction and the player's skill stars (from soccer-6; hidden before) | tap a teammate or his edge arrow = pass to him; a pitch swipe is ignored |
| **Defend** | move your defender; past the ring = sprint | **TACKLE.** A ring closes on the dribbler between his touches; tap on gold = clean win; early = foul risk | **CONTAIN** (hold): jockey goal-side, facing the ball, at auto-distance | **SWITCH** (auto-switch on by default) | **KEEPER** (hold): rush him out (offered on a one-on-one) | swipe = slide tackle along the swipe; tap a defender = switch to him |
| **Set piece** | – | **SHOOT** (drag aim; the reticle shows the bend) | **CROSS** (tap a target) | **SHORT** | – | free kick: swipe = bend (`-dx/140`) |
| **Penalty** | – | drag to aim, release on the meter | – | – | – | as keeper: today's DIVE/STAY pre-commit (swipe-to-dive is cut, §12) |

- **Buttons-only preference** (V2 A.5): while A is held, C and D become CHIP and FINESSE and B becomes LOW. There are still at most four right-thumb targets, and each is ≥ 44 px.
- **Left-handed mirror:** a later setting (V2).

### 5.9 Device preferences

- **Key:** `perfect-season:soccer-prefs:v1`. It has never shipped, so revision 3 may still set its shape.
- **Shape:** `{ v: 1, autoDefend: boolean /* false */, autoSwitch: 'on' | 'cross' | 'off' /* 'on' */, buttonsOnly: boolean /* false */ }`. Unknown fields are kept on a round trip.
- `autoDefend` has nba's meaning. The lead may unify the three sports' keys.
- **Imports:** `prefs.ts` imports no soccer engine code. No engine, `aiProgress`, takeover, sim or Daily Play reads prefs (an import-graph test).
- Prefs stay out of cloud saves and checkpoints.

### 5.10 Single sources

- `skillStars(p)` lives in `soccer2/ratings.ts` (soccer-5): W/AM/ST with DRI ≥ 88 → 5, 80–87 → 4, 70–79 → 3, 60–69 → 2, else 1; CB/GK capped at 2. Card faces import it.
- `xgOf` (soccer-4) is display and box data only.
- `gradeOf` (soccer-9).
- `dailyPlayFor` (soccer-10).

## 6. Scope map (nothing silently dropped)

| Source item | Task |
|---|---|
| **STREAM P0** | |
| V-1 camera: wider zoom, tilt, look-ahead, off-screen arrows; name tag never under a control; the wide carrier never starts off-screen | 3 (framing, arrows, tag rule); 2 (sprint leaves the right cluster) |
| V-2 stands ≤ 12% near goal | 3 |
| B-1 defenders close down, tackle and block; sprinting costs touch; skilled beats no-skill | 5 (touch dribbling, contain, tackles), 4 (blocks), 7 (re-check after the fit) |
| R-3 fouls not cheap | 5 |
| B-2 smooth rating curve | 5 |
| R-1 frozen ball + test | 1 (in the worktree) |
| R-2 parries away from goal; the missing restarts | 1 (rule and restarts), 4 (HAN-steered fit) |
| C-4 BEND reversed + test | 1 (in the worktree) |
| V-3 hint over the goal, FBENDICK, the opponent's ring | 2 (toast line, label pass, rings by side) |
| J-3 confetti in the scorer's colours | 1 (in the worktree) |
| J-1 the soccer crowd | 1 (in the worktree) |
| C-5 pause and quit; online quit = forfeit with a confirm | 2 |
| Result screen data: scoreline, scorers, POTM, DRAW | 9 (data); ut's D.1 sequence shows it |
| Realism: shots per side, on target, conversion, 30 m ≤ 2%; 2.4–2.7 goals, about 25% draws | 4, 7 |
| B-3 difficulty ladder (AI side only) | 7 (sims), 9 (solo, offline only) |
| B-4 aiming beats the assist | 4 (gold = the reticle) |
| B-5 free kicks; B-6 penalties | 7 |
| **STREAM P1** | |
| S-1 varied situations; defend phases; Auto-defend; online unchanged | 7 (V2 bag), 8, 9 |
| C-1 sprint on the left thumb, floating stick | 2 (shared `Stick`) |
| C-3 shot types and skill moves; dribble touches by DRI | 5 (touches), 6 (types, TRICK) |
| AI-2 shape, press, lane cover | 5 |
| U-1 the formation and all 11 cards matter | 7 (rotation), 9 (D7 with defend phases); shape templates cut (Appendix B) |
| A-1 animation actions | 4, 5, 6, 8 (§5.5 fields) |
| J-2 / J-4 juice, atmosphere, commentary | 3 (juice, goal moments, Clutch); commentary cut (Appendix C) |
| **Audit items not in STREAM** | |
| V-4 tiny players | 3 (V3 with players' LOD) |
| A-2 identical players | players; soccer passes ids through |
| A-5 backpedal never triggers; `ready` while drifting | 5 (`look`, `'jockey'`), players-5 (routing) |
| AI-1 range shots, THRU into space, switching play | 4 (appetite), 5 |
| C-2 edge arrows; one name per control; lofted through ball | 3, 2 |
| §11 floor redraw, zoom churn | 3 |
| §12 QA gaps | 1 (isolation, insets), 2 (layout checks) |
| **Game Design V2** | |
| A.5 control grammar and geometry | 2 |
| B.0.1 gold ring | 4 (SHOOT), 6 (TRICK), 8 (TACKLE) |
| B.0.2 Heat | 2 (bar slot), 7 (engine) |
| B.0.3 grade | 9 |
| B.0.4 Clutch | 3 (staging), 9 (the rival's stoppage defend phase) |
| B.0.5 juice budget, haptics, chime | 1 (chime, tick, clang), 3 (juice), 2 and 4 (haptics) |
| B.3.1 format: the V2 bag, earned set pieces, phase clock | 7, 9 |
| B.3.3 camera | 3 |
| B.3.4 movement: touches, archetypes, turns, shielding, first touch, contain | 5 |
| B.3.5 skill moments 1–8 | 4 (finish), 6 (types, one-two, TRICK), 2 (THRU lofted), 8 (tackle, reflex save), 7 (set pieces) |
| B.3.6 animation set | §5.5 fields, tasks 4–8 |
| B.3.7 juice | 3 |
| B.3.8 ratings you can see | 4, 5, 6, 8 (G3) |
| C.1.3 ground rings, C.2 pitch and crowd bands, C.3 buttons and bug | 3, 2 |
| D.1 rematch ≤ 10 s | 9 |
| D.3 Daily Play | 10 |
| E.1 playtime contexts | 2 (`paused`, `stoppage`), 9 (`auto`) |
| F.3 protocol | §9 |

## 7. Ordered tasks

Tasks that change AI-vs-AI outcomes are marked **Protocol: bump needed**. One bump covers the whole branch, done by the lead (§9). Every other task must keep the golden test green.

| Order | Id | Title | Priority | Est. | Depends on | Golden |
|---|---|---|---|---|---|---|
| 1 | soccer-1 | Rule bugs, restarts, guards, the shared sounds and the V2 contracts | P0, slice #4 | 3 h (Step A done; Step B mostly in the tree) | — | re-based (R-1, R-2) |
| 2 | soccer-2 | The shared control cluster, HUD kit, toast line, pause, quit and forfeit | P0, slice #2 | 3.5 h | 1 | unchanged |
| 3 | soccer-3 | Camera at 34 m, action-safe box, edge arrows, the pitch, render juice, goal moments and Clutch staging | P0, slice #3 | 3.5 h | 2 | unchanged |
| 4 | soccer-4 | The gold ring on SHOOT, fitted to real conversion | P0, slice #5 | 3.5 h | 2 | re-based |
| 5 | soccer-5 | Touch dribbling, shielding and defenders who contain (B-1, B-2, R-3) | P0 + promoted P1 | 3.5 h | 4 | re-based |
| 6 | soccer-6 | Shot types, TRICK and the one-two | P1 (promoted) | 3.5 h | 5 | re-based |
| 7 | soccer-7 | Heat and On Fire, set pieces, the V2 deal and the whole-match fit | P0 realism | 3.5 h | 4, 5, 6 | re-based (last time) |
| 8 | soccer-8 | Defend phases with the V2 rings: TACKLE, CONTAIN, SWITCH, KEEPER, slide, reflex save | P0 (owner decision 2) | 3.5 h | 2, 5, 7 | unchanged |
| 9 | soccer-9 | The solo match: defend by default, Auto-defend, SIM, the ladder, Clutch, 4–6 minutes, the match data and the rematch | P0 (owner decisions 2–3) | 3.5 h | 7, 8 | unchanged (rows added) |
| 10 | soccer-10 | Daily Play scenarios, then the final QA gate | P1 + gate | 4 h | all | re-measured |

**Rule for every task.**
- Each task commits and pushes.
- It pastes before/after harness tables into the team doc.
- It records the soccer suite's wall time.
- It screenshots its UI work at 393×852 (sat 59 and 81) and 320×568, and looks at the images.
- An engine task re-runs `sim.ts 400 pro`, `human.ts 200` and `probe.ts 3000` (§3.4).

---

### soccer-1 · Rule bugs, restarts, guards, the shared sounds and the V2 contracts (P0; F.4 #4)

**State of the worktree.**
- **Step A is committed** (`fa45ebb`): harnesses, baselines, golden, agreement, `aiProgressFor`, QA isolation.
- **Step B is in the working tree, uncommitted:**
  - R-1 (`deadShot`, `DEAD`, the clock runs under 3 m/s, `'shot-dead'`);
  - untaken set pieces auto-taken after `SET_PIECE_WAIT` (12 s) with an AUTO KICK countdown;
  - C-4 `bendCurl`;
  - J-1 (venue `'pitch'`, `'bounce'`, the crowd level by distance);
  - J-3 (confetti in the scorer's kit, none under reduced motion);
  - BEND buttons at 44 px;
  - `rules.test.ts`;
  - the `soccer.test.ts` bound tightened to `a.clock + 15`;
  - the `docs/SOCCER-ENGINE.md` section.
- **Not done yet:** the golden re-base, the step's measurements, R-2, the sounds, the contracts, the browser QA.

**Steps**
1. **Verify Step B as it stands.**
   - Run `rules.test`, golden (expected red: re-base it with the reason "R-1: dead shots play on; set pieces auto-taken after 12 s"), agreement and the soccer suite.
   - Run `probe.ts 3000`, `bend.ts` and `sim.ts 400 pro`.
   - Commit "soccer-1 Step B" with the numbers in the team doc.
2. **R-2, the parry rule** (moved here from revision 2's soccer-4; the HAN fit stays in soccer-4):
   - the "out" branch sends the ball away from the goal line, `norm(side*0.9, -0.35)`;
   - it goes round the post only when x is outside ±(GHALF − 0.3);
   - the outward share is `lerp(0.5, 0.85, rt(HAN))`;
   - it never comes back across the six-yard box unless HAN < 55.
3. **R-2, the restarts** (moved here from revision 2's soccer-6). V2 earns set pieces from play.
   - A ball over the byline off a defender or a parry calls `setPieceAfterOut(a, 'corner', side)`. It uses a shared `cornerLayout` and pushes `'corner-won'`. At most `a.restarts ≤ 2` per attack.
   - Off an attacker it ends `'W'` with "GOAL KICK".
   - A ball over the touchline off a defender with y > 75 is a quick throw-in to the nearest attacker (`passKind: 'throw'`).
   - Off an attacker it ends `'L'` with "THROW-IN · THEIRS".
4. **The shared sounds** (§5.0.1 a): `sfx.perfect`, `sfx.ringTick`, `sfx.post`.
   - Soccer wires `sfx.post` on the woodwork now: a `'post'` render event and a 1 px post shake from soccer-3.
   - The PERFECT chime and ring tick are wired in soccer-4.
5. **Golden** is re-based again with the reason "R-2: parries go wide; corners, goal kicks, throw-ins". Agreement must be green.
6. **The adapter skeleton.** `src/game/soccer2/v2/index.ts` (types and re-exports only), so every later task imports the V2 pieces from one place (§5.0.2).
7. **Team doc.**
   - §5 in full, including §5.0, so ut, nba, nfl, players and shell can rely on it from day one.
   - The first "Protocol bump needed" line.
   - The 4–6 shell tip lines (draft).
8. **Browser.** The `soccer-lab.mjs` smoke on the six presets.

**Files**
- `src/game/soccer2/`: `engine.ts`, `match.ts`, `Soccer2.tsx`, `render.ts` (`burst` only), `soccer2.css`, `types.ts`, `rules.test.ts`, `golden.test.ts` (hashes), `soccer.test.ts`, `v2/index.ts` (new).
- `src/lib/sound.ts` (soccer's wiring plus the three `sfx` additions) and `src/lib/sound-perfect.test.ts` (new).
- `scripts/soccer/{probe,bend,human}.ts`, `scripts/qa/soccer-lab.mjs`.
- `docs/SOCCER-ENGINE.md`, `docs/studio-overhaul/soccer.md`.

**Tests**
- **`rules.test.ts`** (existing): a slow shot is no longer a `'shot'` within 1 s and the attack ends within 15 s with a valid letter; `bendCurl` ±1.5 m; the bounce changes no outcome.
- **`rules.test.ts`** additions:
  - a parry's initial `vy ≤ 0` unless x is outside ±(GHALF − 0.3);
  - a parry over the byline gives a corner in the same attack;
  - ≤ 2 restarts per attack;
  - GOAL KICK;
  - throw-ins both ways.
- **`sound-perfect.test.ts`:** pitch steps cap at +4 semitones; no audio nodes when sound is off; no file fetched.
- Golden (re-based twice, reasons written) and agreement green under `PS_SPORT=soccer` and the default sport.

**Acceptance**
- `probe.ts 3000`: frozen balls 25 → **0**; attacks past their clock + 15 s → **0**.
- `bend.ts`: Bend left ends ≤ −1.5 m from the aim, Bend right ≥ +1.5 m, straight within ±0.5 m.
- `probe.ts`: goals straight from a parry 14.3% → **≤ 2%** of goals (S10 guard; ≤ 1% after soccer-4).
- `sim.ts 400 pro` (interim): 2.1–2.8 goals, 20–32% draws. Corners won per side per match are reported as A9's baseline.
- Smoke on all six presets: zero page errors, the blocked-host count logged, computed `--sat` equal to the injected value.
- Screenshots looked at: the free kick with Bend left and its arrow; a rival goal's confetti; the AUTO KICK countdown; a parry going wide; an earned corner.
- Team doc: §5 published; wall time ≤ 120 s. Committed and pushed.

**Protocol:** bump needed (R-1 and R-2 change attack outcomes and the AI sims both phones compute).

---

### soccer-2 · The shared control cluster, HUD kit, toast line, pause, quit and forfeit (P0; F.4 #2)

**Scope**
- **Stick.** nba's `Stick` (stand-in until merge, §5.0.2):
  - floating in the V2 stick zone;
  - a pre-held thumb is live at the whistle;
  - past the ring = sprint, so the SPRINT button leaves the right cluster (Shift still sprints on a keyboard).
- **The A/B/C/D cluster** from the geometry tokens:
  - A SHOOT;
  - B PASS (hold = lob/cross);
  - C THRU (tap = ground; **hold = lofted through ball**, a new human-only pass kind `loftedThrough`);
  - D: an empty slot in attack until soccer-6 (TRICK), KEEPER in defence from soccer-8.
- **Rules of the grammar:**
  - tap a teammate = pass;
  - fire on touch-down;
  - at most four right-thumb targets;
  - swipes off A are reserved until soccer-6.
- **Button skin** (V2 C.3): A gold with a dark label, B teal, C and D dark glass; a bottom scrim, transparent to `rgba(7,21,33,0.55)` over 240 px.
- **HUD kit** (nba's, stand-in until merge):
  - the score bug "YOU 1 · 67' · 5/7 · 1 RIV" with a 3 px attack-progress line;
  - the Heat bar slot, hidden until soccer-7;
  - the **toast line**: it replaces the hint over the goal (V-3.1), shows nothing while SHOOT is held or a set-piece meter is up, and carries miss reasons and goal plates later;
  - the pause button.
- **V-3:**
  - `layoutLabels` stacks colliding labels (fixes FBENDICK);
  - the gold ground ring and name tag only for our side; the rival's taker gets a violet tag;
  - `SCENARIO_SHORT` with no ellipsis at 320;
  - the intro card never covers name tags;
  - the `@media (max-width: 350px), (max-height: 600px)` rules become a `.compact` class set from the measured wrap;
  - one name per control in all copy.
- **Pause sheet.**
  - Rows: RESUME, HOW TO PLAY, CONTROLS (`autoSwitch`, `buttonsOnly`; `autoDefend` arrives in soccer-9), and the playtime line if the hook gives one.
  - **QUIT** (solo, contract B) and **FORFEIT** (online, the `'FF'` contract) are live, which completes C-5 here.
  - While paused: the loop's accumulator stops, input clears and next-phase timers hold. It also pauses on `visibilitychange`/`pagehide`.
  - Online, the sheet says your attacks pause while your rival plays on.
- **Prefs** (§5.9).
- **Playtime:** `usePlaytime('match', { paused, auto: false, stoppage })` (stand-in until ut's lands).
- **Haptics:** `'tick'` on accepted taps and on crossing the sprint ring, through the stand-in.
- **Arena tips:** the draft lines for shell.

**Files**
- New:
  - `src/game/soccer2/v2/{stick.ts,hud.tsx,haptics.ts,playtime.ts,geometry.ts}` (stand-ins);
  - `controls.ts` (pure: zones, the gesture classifier, tap-a-player resolution);
  - `prefs.ts`, `PauseSheet.tsx`, `soccer2-controls.css`;
  - `controls.test.ts`, `hud-layout.test.ts`, `prefs.test.ts`, `forfeit.test.ts`.
- Changed:
  - `Soccer2.tsx`, `soccer2.css`;
  - `match.ts` (`SCENARIO_SHORT`, copy, `'FF'` in `AttackEnd`/`END_TEXT`);
  - `engine.ts` (`loftedThrough`: a human-only pass kind with the lofted flight onto the runner's lane);
  - `render.ts` (HUD and labels only).
- `src/game/Arcade.tsx`, soccer lines: `'FF'` in the soccer `POINTS`; the soccer return passes `onQuit`; stand-ins for nba-7's forfeit block and box strip only if absent (≤ 8 lines, marked for merge).
- `src/ut/Match.tsx`: the soccer `END_LABEL` gains `'FF'` (1 line).
- `src/game/progress.ts`: `forfeit?` only if absent (marked for merge).
- `scripts/qa/soccer-lab.mjs`: part `layout`.

**Tests**
- **`controls.test.ts`:**
  - 2,000 synthetic touches per preset are classified into the right zone;
  - tap vs swipe thresholds hold;
  - tap-a-teammate resolves to the nearest in the radius;
  - the D slot is empty in attack before soccer-6;
  - the stand-in `Stick` meets §5.0.2 (two-axis vector, release-to-stop, sprint hysteresis 1.15 / 1.0, pre-held thumb).
- **`hud-layout.test.ts`:** no overlapping labels at 320/375/390/393/430; the toast line never meets the goal mouth or the reticle.
- **`prefs.test.ts`:** absent, garbage and old-shape values give defaults; a round trip keeps unknown fields; the import graph.
- **`forfeit.test.ts`:** `'FF'` is worth 0 and pads to `TOTAL`; the wire object has no `box`.
- Golden unchanged (the lofted through ball is human-only).

**Browser** (`soccer-lab.mjs layout`, two-pointer CDP touch, six presets at sat 59 and 81)
- C1 to the pixel against the tokens.
- C2: p95 ≤ 100 ms over 50 taps.
- C4: sprint held under the SHOOT wind-up keeps ≥ 0.85 × top speed.
- C5: the pre-held thumb.
- Pause stops `a.t` for 3 s, and RESUME continues.
- Solo QUIT with its confirm calls `onQuit(us, them)` (a lab stub logs it).
- An online FORFEIT between two local contexts finishes the other phone at once with a win (in-process relay).
- Text ≥ 10 px; no overflow at 320; reduced motion (no slide on the sheet).

**Screenshots** (before/after):
- the cluster at 393 (sat 59 and 81), 375×667 and 320×568;
- the free kick without FBENDICK;
- the pause sheet and CONTROLS;
- the forfeit confirm;
- the rival taker's violet tag;
- the toast line.

**Protocol:** none of its own. `'FF'` on the wire is covered by the soccer bump; the layout and the human-only through ball keep golden green.

**Save-compat:** the new device-local key, tested.

**Acceptance:** tests green; golden unchanged; C1–C5 pass on all six presets; quit and forfeit work end to end; screenshots looked at. Owner device check noted: stick, sprint ring and button feel.

---

### soccer-3 · Camera at 34 m, the action-safe box, edge arrows, the pitch, render juice, goal moments and Clutch staging (P0; F.4 #3)

**Changes**

1. **`camera.ts`** (pure; used by `render.ts`, `scripts/soccer/cam.ts` and the tests):
   - **Scale and tilt:** about 34 m across at the carrier's row (`s ≈ W/34`), with a high, steep pitch angle of about 0.9.
   - **Follow:** 85–100% of the ball's x.
   - **Look-ahead:** velocity × 0.6 s, capped at 6 m, plus 3 m toward goal.
   - **Framing pass:** keeps the carrier, his two nearest options and (inside 30 m) the goal mouth inside the **action-safe box** (V2: y 115–568 at 393×852, y 76–368 at 320×568, read through `v2/geometry.ts`).
   - **Zoom:** eases out up to 15% to keep a through-ball target in frame; quantised to 0.05 steps with at most 4 changes a second; cut instantly under reduced motion.
   - **Horizon:** clamped so the stands take ≤ 12% of the height.
   - **Set pieces:** corners framed from the flag's side with the goal in the upper third; penalties put the goal in the upper third.
   - **Landscape** keeps today's parameters.
2. **Edge arrows.**
   - A teal chevron with the player's initial and number (the mockup's "R9"), text ≥ 10 px.
   - Clamped to the safe box. Tapping one passes to him (44 px hit).
   - No pulse under reduced motion.
3. **The pitch** (V2 C.2, in the pitch section of `render.ts` as one exported `PITCH` palette that players can retune under their venue grant):
   - mow stripes `#2e9a4a` / `#288a41` every 5.5 m;
   - lines `#f2fff2` at 85%, 2 px;
   - a 6 px run-off and ad boards with original word marks;
   - a night vignette (corners −18% lightness) and four light pools;
   - depth: 6% darker and less saturated higher up the screen;
   - the crowd in three value bands (`#221d36`, `#342d52`, `#4a426e`) of 2 px blocks, with 6% team flecks and 2% white. The standing front rows are players' sprites.
   - **Floor cache:** the floor is drawn to an offscreen canvas keyed by the quantised camera and redrawn only when the key changes.
4. **Ground rings** (C.1.3, drawn by soccer under the sprites): gold `#f6b93b` 2 px under the controlled player, teal `#4fe3c1` under the pass target, a red `#ff5d5d` arc on the on-ball defender. The name tag moves above the head when it would fall under a control rect.
5. **Render juice** (the existing `Juice` API through `fx.ts`, §5.6):
   - hit-stop;
   - a 3-frame net bulge;
   - a ball trail on shots over 22 m/s;
   - the post clang (`sfx.post`) with a 1 px post shake;
   - shake through trauma;
   - 0.4× near-miss slow motion for 0.6 s.
   - Everything above is off or clamped under reduced motion (R1).
6. **Goal moments for both sides** (V2 B.3.7):
   - a scorer plate in the toast line, "HAALAND 67' · 2ND OF THE MATCH" (ours teal, theirs violet);
   - the rival's simulated or online goals pop within 200 ms with `sfx.scoreThem` and a bug pulse (F5);
   - confetti in the scorer's kit (soccer-1).
7. **Clutch staging** (G19) on the stoppage attack:
   - the bug turns gold and reads CLUTCH;
   - the camera sits 6% tighter;
   - the crowd bed rises by 0.1;
   - the heartbeat haptic runs at a ≤ 1 goal margin;
   - "FOR THE WIN" or "TO TIE IT" shows in the toast line;
   - a goal in Clutch always replays.
   - Rules unchanged. The rival's stoppage defend phase gets the same in soccer-9.
8. **`ps:arena-ready`** once per match, after the first frame drawn with pitch and sprites.

**Files**
- New in `src/game/soccer2/`: `camera.ts`, `fx.ts`, `camera.test.ts`, `juice-soccer.test.ts`.
- Changed in `src/game/soccer2/`: `render.ts` (camera, pitch, rings, markers, HUD, juice; never the player-drawing sections), `Soccer2.tsx`.
- `scripts/soccer/cam.ts`: calls `camera.ts`, with no replicated maths.

**Tests**
- **`camera.test.ts`:** V1 at the six presets; V3 (amended); every off-screen teammate has an arrow; V2 over 30 autopilot attacks per scenario.
- **`juice-soccer.test.ts`:** a seeded match with and without juice and Clutch staging gives identical ends, `t` and ball positions; the `fx` cap; the reduced-motion clamps.
- Golden unchanged.

**Measurements**
- `cam.ts` before/after: kick-off table, and V2 over 200 attacks per scenario.
- Dev-lab frame pacing at 393×852 and 4× CPU, against the baseline: fps ≥ 58, p99 ≤ 33.4 ms, no long task > 200 ms; 6× not worse than 53.1 fps.
- Stale draws ≤ 1%.

**Screenshots:**
- each scenario at kick-off and mid-attack;
- the wide overload with the carrier on screen;
- a corner and a penalty;
- an edge arrow;
- the net bulge and the trail; a post hit;
- our goal plate and the rival's;
- CLUTCH with FOR THE WIN;
- the pitch beside `mockups.html`'s soccer cell, compared side by side.

**Protocol:** none.

**Cross-team:** players (sizes against their LOD, the palette, crowd rows, the stale-draw budget); shell (arena-ready, `--sat`).

**Acceptance:** V1–V3, G19 (staging) and F5 (rival pop) met; dev frame pacing not worse than the baseline; juice test and golden green; screenshots looked at. Owner device check noted: framing and readability at 34 m with the 5-head sprites.

---

### soccer-4 · The gold ring on SHOOT, fitted to real conversion (P0; F.4 #5)

**Changes**

1. **The ring** (`perfect.ts` through `v2/`, stand-in until merge):
   - **Wind-up:** SHOOT held fills a power ring to `meter.top = lerp(0.35, 0.62, (d − 11)/14)`, clamped to that range (G4).
   - **Gold window:** `ringWindow`, with its base by SHO and openness and a floor of ±30 ms (G1, G3). Drawn as a ring under the shooter plus a short arc over his head, with the gold arc ≥ 8 px.
   - **Gold** (open and in range): the ball goes exactly where the reticle is, with a cone of 0 (G2a). The keeper can still save it: gold guarantees placement, not a goal.
   - **Amber:** a defender within 2 m, first time across the body > 90°, a header beyond 8 m, or a wide angle inside 12 m. Timing narrows the cone with no guarantee, and the toast names PRESSURE (G2b).
   - **Red:** beyond `maxRange(p) = lerp(24, 34, rt(SHO))`. The ring reads TOO FAR and the toast says RANGE.
2. **Touch timing (G5).**
   - Release offsets come from `PointerEvent.timeStamp` deltas minus `deviceLagMs()`, converted to the release time in game seconds that `releaseShoot` already takes.
   - The engine never reads a timestamp, and the autopilot keeps its seeded release noise, judged against the same window maths, so AI PERFECTs exist for Heat (soccer-7).
3. **Feedback (G6).**
   - `sfx.ringTick` over the last 200 ms.
   - On gold: the word PERFECT in the toast, `sfx.perfect(streak)`, `haptic('double')`, and a PERFECT count on the attack.
   - The miss reasons (`timingWord`, `shotVerdict`) stay and print in the toast line.
4. **The fit** (revision 2's soccer-4, kept):
   - **Cone by range:** ×1 at ≤ 11 m, 1.6 at 16.5 m, 2.4 at 20 m, 3.2 at 25 m, about 4.3 at 30 m.
   - **Context multipliers**, now the amber causes: pressure ×1.35, ×1.5 from wide inside 12 m, headers ×2 beyond 8 m, `firstTimeMult` ×1.2 at 90° and ×1.6 at ≥ 135° for shots **and** passes.
   - **Blocks:** body width 0.7 m and `blockLunge`.
   - **The keeper:**
     - from ≥ 20 m, save radius +0.15 m and reaction ×0.85;
     - one committed dive per shot;
     - he rushes only when he reaches the ball's next touch point first;
     - he claims crosses whose meet point he reaches first;
     - on far-post first-time shots he dives no earlier than the strike;
     - his split step lands ≥ 4 frames before every strike (`keeperSet`).
   - **Parries:** the outward share is steered by HAN (S10 to ≤ 1%).
   - **B-4:** the assist aims at 70% of `assistMargin`, so gold beats it (S8).
   - **The autopilot** takes 20–28 m shots when the lane is clear.
5. **`xg.ts`** (display and box data; credited in `docs/CREDITS.md` to StatsBomb Open Data, CC BY-SA 4.0).
6. **`soccerFeedback` lines:** TOO FAR, PRESSURE, BLOCKED, FIRST TIME ACROSS YOUR BODY, KEEPER CLAIM, PARRIED WIDE.
7. **Fields** (§5.5): `kickFoot`, `passKind`, `shotKind` (placed/power), `power`, `contact`, `diveHeight`, `keeperSet`, `slide`.

**Files**
- `src/game/soccer2/`:
  - `engine.ts` (`strikeShot`, `rangeCone`, `coneMult`, `assistAim`, `pressShoot`, `releaseShoot`, `pass`, `keeperSave`, `planKeeper`, `duringFlight`);
  - `ratings.ts` (shot and keeper effects);
  - `autopilot.ts`;
  - `xg.ts` (new), `v2/perfect.ts` (stand-in);
  - `render.ts` (the ring, TOO FAR), `Soccer2.tsx`.
- Tests in `src/game/soccer2/`: `perfect-soccer.test.ts`, `xg-bands.test.ts`, `keeper.test.ts`, `first-time.test.ts`, `render-fields.test.ts` (new); `shooting.test.ts`, `rules.test.ts`.
- `src/game/play-feedback.ts` (the `soccerFeedback` hunk) and `src/game/play-feedback-soccer.test.ts` (new).
- `docs/CREDITS.md` (one entry).
- Lab params `gk=`, `sho=`.

**Tests**
- **`perfect-soccer.test.ts`:** G1, G2 (both parts), G3 (shooting) and G4, exact on the pure functions.
- **`xg-bands.test.ts`:** S1 guard bands, monotone (n ≥ 80 per band).
- **`keeper.test.ts`:** S3, S4, S5, the parry rule.
- **`first-time.test.ts`:** S9.
- **`render-fields.test.ts`:** randomising the §5.5 fields every step gives identical outcomes; `engine.ts` doesn't import `appearance*`.
- **`play-feedback-soccer.test.ts`:** the new lines.
- Golden re-based with the reason written.

**Measurements**
- `audit_soccer_shots.ts 200`: S2, S5, S6, S7.
- `probe.ts 3000`: S10.
- `human.ts 200`: P2 ≤ 2%, S8.
- `sim.ts 400 pro` (interim): S1 inside its bands; on target 32–42%; blocked ≥ 18%; save% 64–72%; woodwork 2–4%.

**Browser**
- G5 through CDP touch with synthetic timestamps across frame boundaries.
- G6: same-frame word, chime and haptic call (performance marks).
- The gold arc ≥ 8 px at 320 and 393.

**Screenshots:** the ring gold, amber (PRESSURE) and red (TOO FAR at 30 m, with the `start=` param); the PERFECT toast; a block lunge; a keeper claim; a parry steered wide.

**Protocol:** bump needed (windows, shot outcomes, the keeper, passes, the AI sims).

**Acceptance:** guards green; G1–G6 met; S1–S10 and P2 met in the harnesses, or a deviation explained with numbers; tables in the team doc. Owner device check noted: the ring's feel and the device-lag calibration.

---

### soccer-5 · Touch dribbling, shielding and defenders who contain: B-1, B-2, R-3 (P0 + Appendix A, first half)

Lead decision 6: touch dribbling comes first. It is this task's must-ship item. If the session runs short, archetypes move to soccer-6, and the team doc says so.

**Changes**

1. **The touch model** (V2 B.3.4; Appendix A's rolling ball):
   - **Knock-ons:** `Attack.touch = { next, out }`. The carrier knocks the ball ahead on touch beats at the G7 cadence; between touches it rolls under `stepBall`.
   - **Winnable:** anyone who reaches the ball between touches can poke it.
   - **Touch length:** DRI shortens the touch; sprint lengthens it. Close control at a stick magnitude of 0.5–0.85 gives the shortest touch at 90% pace.
   - `Body.touchAt` marks every touch.
   - Jog pace is 75%.
2. **Movement:**
   - **Acceleration archetypes,** under our own names (Explosive, Lengthy, Controlled), derived from PAC/DRI/PHY plus height where the card has one. They are curves for the first 5 m against top speed, guarded by P6.
   - **Turns:** the radius grows with speed; a turn > 120° at a sprint needs a 2–3 step brake (`turnRate`).
   - **First touch:** heavier for fast passes or passes from behind, scaled by DRI.
   - **Lofted and cross error:** ×1.2 at full sprint, ×1.3 under pressure.
3. **Shielding.** Stick back toward your own goal with a defender within 1.5 m: act `'shield'`, the ball on the far foot, decided by the PHY difference (G9).
4. **Defending AI (AI-2).**
   - **Contain:** the first presser goes goal-side at `lerp(2.5, 1.5, rt(DEF))`, as act `'jockey'` with `look` at the ball.
   - **Lane cover:** inside 22 m a second defender covers the shooting lane.
   - **Tackles:**
     - only when the ball is exposed between touches (> 0.6 m from the feet) or he turns > 60°;
     - after the defender's read delay, with a visible 0.25 s `'poke'` wind-up;
     - success = `tackleWin` × angle × exposure;
     - a miss stuns him.
   - **Never** an auto-tackle on a dribbler who merely comes close.
   - **Contact:** pace loss ×0.6–0.85 by the PHY difference.
5. **Fouls (R-3).**
   - `clamp(0.02 + 0.11·(1 − rt(DEF)) + (behind ? 0.10 : 0) + 0.04·rt(DRI) − 0.05·defIQ, 0.015, 0.2)`.
   - Frontal mistimed tackles in the box are fouls half as often.
   - A breakaway foul from behind is a yellow (`'yellow'`).
6. **B-2.** `tackleWin`'s logistic scale goes from 11 to 20, bounded 0.15–0.85. PAC's chase effect is smoothed.
7. **AI-1.** THRU into space for a runner; switch play when the near side is crowded.
8. **The `skilled` proxy** is updated to the touch model: it carries at a jog near defenders.
9. **`skillStars`** (§5.10).
10. **`soccerFeedback` lines:** TACKLED BETWEEN TOUCHES, HEAVY TOUCH, SHIELDED, YELLOW.

**Files**
- `src/game/soccer2/`:
  - `engine.ts` (the touch model, `defend`, `tackles`, `human`, `contact`, `setPieceAfterFoul`);
  - `ratings.ts` (`tackleWin`, `touchOf`, `turnRate`, `accelOf`, `skillStars`);
  - `types.ts` (acts, `Attack.touch`, `Attack.yellows?`);
  - `autopilot.ts`;
  - `balance.test.ts` (new), `touch.test.ts` (new), `render-fields.test.ts`.
- `scripts/soccer/lib.ts` (`skilled`).
- `src/game/play-feedback.ts`.
- The stand-in routing in `render.ts`'s players section, if needed (§5.5).

**Tests**
- **`touch.test.ts`:** G7 (cadence and distance by DRI), G9.
- **`balance.test.ts`** (n = 60 per row, ≤ 25 s): P1, P3–P8, G8, switch play ≥ 60% in crafted overloads.
- **`render-fields.test.ts`:** randomising `look` and `touchAt` changes nothing.
- Golden re-based.

**Measurements**
- `human.ts 200`: P1 (2.9× → ≤ 1.3×), P3, P4.
- `ratings-human.ts 300`: P5, P6.
- `sim.ts 400 pro`: A10 and A12 (interim).
- soccer-4's S rows re-checked.

**Screenshots:** the ball visibly ahead between touches at a jog and at a sprint; a poke between touches; a jockeying defender facing the ball; a shield; the yellow toast.

**Protocol:** bump needed.

**Acceptance:** guards green; G7–G9 and P1–P8 met, or a deviation explained with numbers; soccer-4's targets still hold; tables in the team doc. Owner device check noted: dribble feel.

---

### soccer-6 · Shot types, TRICK and the one-two (P1, promoted; Appendix A, second half)

**Changes**

1. **Shot types on A** (the §5.8 gestures, classified in `controls.ts`). `releaseShoot(a, aim, lag, kind)` takes the parameters below. Every type keeps the gold ring: gold means the type's ideal execution.

   | Type | Gesture | Wind-up | Speed | Cone | Notes |
   |---|---|---|---|---|---|
   | Placed | hold, drag, release | `meter.top` | 1.0 | 1.0 | |
   | Finesse | a curved drag (> 15°) | +0.08 s | ×0.82 | 0.8 far corner / 1.3 near post | curl 3–6 m/s² |
   | Chip | a flick up (> 40 px in < 150 ms) | 0.35 s | drops under the bar | ×1.6 | |
   | Low driven | a double-tap within 250 ms | 0.45 s | ×1.05, height ≤ 0.6 m | ×1.1 | +40% error at full power |
   | Power | hold past gold into red | 0.90 s | ×1.25 | ×1.35 | open to tackles |

   The Buttons-only preference (§5.8) is honoured.
2. **TRICK on D** (D Ø48; 44 at 320). The move comes from the stick direction and `skillStars`:

   | Stars | Forward | Side | Back |
   |---|---|---|---|
   | 1–2 | ball roll forward | ball roll | feint and turn |
   | 3–4 | roulette | step-over | drag-back |
   | 5 | three-touch roulette | drag turn | step-over and exit |

   - Frames: step-over 14, roulette 20, drag-back 16; control returns at 60%.
   - **PERFECT trick:** a 150 ms gold flash at the defender's feet when he commits (a lunge or a poke wind-up). A trick started inside it leaves him stumbling for 0.8 s (G11).
   - **Chaining:** a trick within 1.2 s of the last is 15% slower with +40% touch error; a 4th forces a heavy touch.
3. **The one-two** (V2 B.3.5 #4). After a pass, tapping B again within 1 s returns it first time (first-time error applies). The passer runs on a lane automatically (G12).
4. **The autopilot** uses types, tricks and one-twos with probabilities by rating. The refit happens inside this task: `sim.ts 400 all`, `human.ts`, `ratings-human.ts`. A1 and A2 must stay in their interim bands.
5. **Fields:** `shotKind`, `power`, `trick`, `passKind: 'oneTwo'`, act `'trick'`.

**Determinism.**
- A human's shot type or trick changes only that phone's own attacks, which the other phone never re-simulates: the phones exchange results.
- The autopilot's choices use the seeded engine RNG, so takeovers and sims agree, and the agreement test proves it.
- Replays play recorded frames.

**Files**
- `src/game/soccer2/`: `engine.ts`, `autopilot.ts`, `controls.ts`, `Soccer2.tsx`, `render.ts` (the gold flash, the TRICK label).
- Tests: `shot-types.test.ts`, `tricks.test.ts` (new); `controls.test.ts`, `balance.test.ts`.
- `src/game/play-feedback.ts`.

**Tests**
- **`shot-types.test.ts`:** G10 guards.
- **`tricks.test.ts`:** G11, G12.
- **`balance.test.ts`:** G13.
- **`controls.test.ts`:** C3 (aim drag misread as a chip ≤ 1%; tap-to-pass misread as a swipe ≤ 2%); the Buttons-only mapping keeps ≤ 4 targets.
- Agreement green. Golden re-based.

**Measurements:** `human.ts` with the new verb strategies: G10, G13; `ratings-human.ts`: G11 by stars; `sim.ts 400 all` (interim A1/A2).

**Browser:** the TRICK button at its token position; chip, finesse and low through CDP touch; Buttons-only; C2 for TRICK.

**Screenshots:** each shot type in flight; a roulette past a defender; the gold flash; a one-two; the Buttons-only arc.

**Protocol:** bump needed.

**Acceptance:** guards and agreement green; G10–G13 and C3 met; A1/A2 inside the interim bands; screenshots looked at. Owner device check noted: gesture discoverability and the TRICK button.

---

### soccer-7 · Heat and On Fire, set pieces, the V2 deal and the whole-match fit (P0 realism; the last AI-vs-AI outcome change)

**Changes**

1. **Heat** (`heat.ts` through `v2/`, stand-in until merge; V2 B.0.2):
   - **Events from the engine:**
     - PERFECT (a gold shot, tackle or trick);
     - goal;
     - stop or turnover forced (the defending side wins the ball);
     - a clean possession with ≥ 2 passes ending in a shot;
     - turnover (an `'L'` end);
     - conceding.
   - **Phases:** reset at half-time (after attack 3). On Fire lasts the next attack: gold windows ×1.25, uncontested amber becomes gold, and the ball burns (render).
   - **The first goal while On Fire** gets the slow-motion replay.
   - **Both sides:** the AI earns Heat by the same rules, and the rival's bar shows in solo.
   - **Online:** each side's Heat comes from its own attack events only, and the rival's bar is hidden (no wire field), so takeovers agree (G16).
   - Heat lives on `Match` and inside `aiProgressFor`'s sims. The bug's Heat bar slot from soccer-2 is turned on.
2. **Set pieces.**
   - **B-5:** `SP_TUNE.fkCone` about 1.5; the wall is the 4 tallest; `fkArrival` puts the reticle where the curled ball will arrive; the release height controls dip.
   - **B-6:** penalty green ×0.85, cone ×1.1.
   - **Shootout:** the same kick model, fitted to 70–75% per kick; the `agreedShootout` mirror is re-checked.
3. **The V2 deal** (B.3.1).
   - Each side gets 6 regular attacks plus 1 stoppage attack, drawn from a weighted bag of **open play**: build-up, counter, wide, **turnover high up** (new: the ball won 35–45 m from goal by a press) and **keeper long ball** (new: a flick-on duel).
   - Corners come from restarts (soccer-1), free kicks and penalties from fouls (soccer-5). None is dealt.
   - The weights are fitted to A9. The stoppage attack is a counter or a wide overload.
   - **Phase clock:** 20–30 s per phase (F2).
   - **Every card plays:** a deterministic rotation of carrier, runners and the defending block by position (`hashString(seed + ':cast:' + i)`).
4. **The fit.** Autopilot appetite, the deal weights and small engine constants, until §4.1 holds at every level with Heat on, including A13. Rating effects are compressed if the gap is steeper than 7 points per 10 OVR.
5. **`soccerFeedback` lines:** CORNER WON, GOAL KICK, THROW-IN, "The wall blocked it", "The keeper read it", ON FIRE.

**Files**
- `src/game/soccer2/`:
  - `engine.ts` (Heat events, `fkArrival`, `SP_TUNE`, the two new set-ups);
  - `match.ts` (`dealOf` bag, rotation, Heat on `Match`);
  - `arcade.ts` (`aiProgressFor` carries Heat);
  - `shootout.ts`, `autopilot.ts`, `ratings.ts`, `types.ts` (`Scenario` gains `'turnover' | 'longball'`);
  - `render.ts` (the burning ball, the reticle at the bend-corrected point);
  - `v2/heat.ts` (stand-in).
- Tests: `heat-soccer.test.ts`, `realism.test.ts` (new); `setpieces.test.ts`, `soccer.test.ts` (deal weights), `agreement*.test.ts`.
- `scripts/soccer/sim.ts` (Heat columns).

**Tests**
- **`heat-soccer.test.ts`:** G14 exact; G16 (both seats over 500 seeds).
- **`setpieces.test.ts`:** A12 guards; the wall is the 4 tallest.
- **`realism.test.ts`** (60 Pro matches, ≤ 30 s): A1, A2, A5–A8, A11 guards.
- **Deal weights** over 2,000 seeds, ±3 points each.
- **Rotation:** every outfield player appears in ≥ 80% of 200 matches.
- Agreement green. Golden re-based for the last time.

**Measurements**
- `sim.ts 400 all` and `sim.ts 400 gap`: all of §4.1; G15 (the AI part).
- `human.ts 200`: S11, S12, and the P rows still hold.
- `ratings-human.ts 300`: P5, P6.
- The `setpieces` harness: A12 with n ≥ 300 penalties and n ≥ 2,000 shootout kicks.
- `bend.ts`.

**Screenshots:** the Heat bar at HEATING UP and ON FIRE; the burning ball; the free-kick reticle bending left and right; a turnover-high attack; a keeper long ball.

**Protocol:** bump needed (Heat, the deal and set-ups, set pieces, the shootout, the AI sims).

**Acceptance:**
- Guards green and agreement 100%.
- §4.1, G14–G16 (AI part) and S11–S12 met at every level, or a deviation explained with numbers.
- The note "fit complete: later tasks must keep golden green" is written in the team doc.

---

### soccer-8 · Defend phases with the V2 rings: TACKLE, CONTAIN, SWITCH, KEEPER, slide, reflex save (P0 by owner decision 2)

**Changes**

1. **The setting.** A defend phase is `setupAttack(scenario, them, us, seed, { defIQ: OWN_DEF_IQ, human: 'D' })`. The rival attacks with the autopilot, and the stick drives `dctl.id`.
2. **The defence cluster, in the same slots** (§5.8):
   - **A TACKLE.** A ring closes on the dribbler between his touches. Gold appears only when the ball is exposed and the angle is front or side, and then the tackle wins it cleanly (G17). Amber is by rating. Tapping before the ring opens is a foul risk. DEF sets the ring's size (G3).
   - **B CONTAIN** (hold): backpedal at 80% pace, goal-side, at auto-distance, with `look` at the ball.
   - **C SWITCH.** Moves control to the defender nearest the ball's path, applied in the same engine step. `autoSwitch` defaults to `'on'`. Tapping a defender also switches.
   - **D KEEPER** (hold): offered on a one-on-one. A rush timed at the carrier's touch smothers better (D3).
   - **Pitch swipe = slide** along the swipe, 2.5 m. A miss puts him down for 1.0 s, then `'getup'`. Man before ball is a foul, and in the box a penalty. Writes `Body.slide`.
3. **Teammate contain.** AI defenders keep 3–4 m off the carrier while you control the presser.
4. **Phase end:** your side wins the ball, the attack ends, or the phase clock runs out.
5. **`OWN_DEF_IQ`** is fitted so D2 holds. SIM and Auto-defend use the same constant.
6. **Heat events:** a stop is +15 and a PERFECT tackle +12, feeding soccer-7's Heat.
7. **The reflex save** (P1, solo only; the last item; the only one that may drop, F.4 third wave). Spec G18.
8. **`soccerFeedback` defend lines:** "Won it: you tackled when his touch went long"; "Beaten: you dived in. Hold CONTAIN until the ball is loose"; "Foul from behind: YELLOW"; "Penalty: a slide from behind in the box".

**Files**
- `src/game/soccer2/`:
  - `engine.ts` (`Attack.human?: 'A' | 'D'`, `dctl`, `setDefStick`, `defContain`, `defTackle`, `defSlide`, `defSwitch`, `keeperRush`, `reflexSave`);
  - `arcade.ts` (`OWN_DEF_IQ`);
  - `controls.ts` (the defence rows);
  - `Soccer2.tsx`, `render.ts` (rings);
  - `defend.test.ts`, `reflex.test.ts` (new).
- `scripts/soccer/lib.ts` (the proxies `idle`, `good`, `spam`).
- `src/game/play-feedback.ts`.
- Lab param `side=D`.

**Tests**
- **`defend.test.ts`** (n = 100 per row): D1–D3, G17.
- **`reflex.test.ts`:** G18 (an identity test with no swipe; the online flag never offers it).
- An online-flagged match never builds a defend phase.
- With `human` unset, golden is unchanged.
- **`controls.test.ts`:** slide swipe vs SWITCH tap 100% separated.

**Measurements:** the `human.ts` defender part (n = 200): D1–D3 tight.

**Browser** (lab `side=D`, six presets):
- the cluster at its token positions;
- the TACKLE ring within 100 ms of the tap (C2);
- slide, KEEPER hold and the reflex swipe;
- no overlap at 320 at sat 59 and 81.

**Screenshots:** a defend-phase intro; the TACKLE ring in gold; contain; a slide and the get-up; the switch ring; KEEPER on a one-on-one; the reflex save's slow moment.

**Protocol:** none (solo-only; golden unchanged).

**Acceptance:** tests and golden green; D1–D3 and G17 met; G18 met, or dropped with the reason written; browser checks pass. Owner device check noted: defending controls.

---

### soccer-9 · The solo match: defend by default, Auto-defend, SIM, the ladder, Clutch, 4–6 minutes, the match data and the rematch (P0 by owner decisions 2 and 3)

**Changes**

1. **Flow** (solo only; online runs today's simultaneous format unchanged):
   - **Order:** your attack i, then their attack i as a defend phase; the half-time card after attack 3 (Heat resets); then the stoppage pair, both staged as Clutch (G19).
   - **The rival's attacks** are dealt from `'ai:' + seed`, each built when reached, with the autopilot at the ladder's skill and IQ.
   - **The rival's score and scorers** come only from these phases (D6). Their goals get a goal moment and a replay (V2 B.3.7).
2. **Auto-defend and SIM.**
   - **Auto-defend:** `prefs.autoDefend`, default `false`, toggled on the kick-off card and in Pause → CONTROLS. When on, defend phases resolve at once as a chunked sim (≤ 6 ms of steps a frame, F6). The rival's goals are shown and replayed; WATCH plays the phase at 1×.
   - **SIM THIS DEFENCE:** a 44 px chip, any solo mode; equal to Auto-defend for the seed.
   - **SIM THIS ATTACK:** solo, hidden when `manualOnly`; the autopilot at 0.6 on the same seed path.
3. **`onRival`** per §5.4.
4. **The ladder** (B-3), offline only, through `aiProgressFor` (`!online` / `!setup.online`). Online keeps Legend defence both ways. Agreement is re-run, and golden rows are added for the offline `'rival'` role.
5. **Pacing to F1** with the `PACE` table:

   | Knob | Starting value |
   |---|---|
   | Kick-off card | 2.5 s |
   | Attack intro | 1.8 s |
   | Defend intro | 1.5 s |
   | Toast readout | 1.6 s |
   | Goal replay | ≤ 3 s (reduced motion ≤ 1.0 s or skipped) |
   | Half-time card | 4 s, skippable |

   It is tuned with a human-proxy Playwright run (scripted stick, SHOOT, TACKLE and CONTAIN through the lab's `qa` hooks, at real time, 20 matches). `TOTAL = 7` stays: it is the wire contract.
6. **The match data** (§5.0.1 b, §5.1).
   - `Attack.log` collects shots with xG, PERFECTs, passes, key passes, tackles, saves and tricks. It is report-only and consumes no RNG.
   - `buildBox` → `Progress.box`; `gradeOf` → `Progress.grade` (G20); scorers and POTM in a report object ut may read.
   - Both are stripped before the wire.
   - Hand-offs to ut: the M3 note says penalties when `pens` is set; `'FF'` in `match-debrief.ts`; PreMatch copy that says solo matches include defending.
7. **The rematch (G21).** Adopt nba's mounted-arena path in the soccer branch of `Arcade.tsx`. `Soccer2` re-seeds in place, keeping its canvas, floor cache and sprite caches.
8. **Playtime:** `usePlaytime` gets `auto: true` while Auto-defend or SIM is playing, and `stoppage: true` between phases.
9. **Copy:** the kick-off how-to-play names TACKLE, CONTAIN, SWITCH, KEEPER, the slide swipe and Auto-defend. The final arena tips go to shell.

**Files**
- `src/game/soccer2/`:
  - `Soccer2.tsx` (flow, chips, re-seed);
  - `match.ts` (the rival schedule, `PACE`, half-time);
  - `arcade.ts` (the ladder role, offline only);
  - `report.ts` (new: `Attack.log` capture, `buildBox`, `gradeOf`), `prefs.ts`, `PauseSheet.tsx`;
  - `soccer-flow.test.ts`, `report.test.ts` (new).
- `src/game/Arcade.tsx`, soccer lines only (≤ 15): `onRival` → `them`/`shown` when `!online`; solo props; the rematch path; 2 lines of kick-off copy.
- `src/game/progress.ts`: `box?`/`grade?` only if absent (marked for merge).
- `scripts/soccer/sim.ts` (`ladder`), `scripts/qa/soccer-app.mjs` (parts `pace`, `solo`, `rematch`).

**Tests**
- **`soccer-flow.test.ts`:**
  - D6;
  - online: no defend phase and no prefs read;
  - SIM equals Auto-defend; fast-forward equals real time;
  - agreement with the role gated;
  - the import graph.
- **`report.test.ts`:**
  - contract A's keys plus the extras;
  - ratings in 1.0–10.0; the POTM rules;
  - grade letters against par; FLAWLESS;
  - deterministic; no RNG consumed;
  - the wire object has no `box` and no `grade`.
- Golden unchanged, plus the offline-role rows.

**Measurements**
- `sim.ts ladder`: D4, D5.
- `soccer-app.mjs pace` (20 human-proxy matches): F1, F2.
- F6 at 4× CPU.
- G15 (the `skilled` part), G20, G21, D7.
- `soccer-app.mjs solo`: a UT Squad Battle with defend phases, a draft match against the AI, and an online H2H between two local contexts (F3).

**Screenshots:** the kick-off card with the Auto-defend toggle; half-time; a defend-phase intro; the SIM chips; a rival goal moment and its replay; Clutch on the rival's stoppage attack; the result sheet over the dimmed arena (ut's sequence, when merged) or the lab stub.

**Protocol:** no extra bump (solo-only flow; the offline ladder never reaches the wire).

**Save-compat:** the `autoDefend` pref only.

**Acceptance:** tests and golden green; D4–D7, F1–F6, G15 (skilled), G19–G21 met, or a deviation explained with numbers. Owner device checks noted: match length, defending, rematch.

---

### soccer-10 · Daily Play scenarios, then the final QA gate (P1 + gate)

**Part 1: the Daily Play** (first in the session). The gate is never cut. If time runs short, the Daily Play is what drops, and the team doc says so.

1. **`daily-play.ts`** per §5.0.1(c):
   - **Generator:** seeded by the day key, over about 12 scenario templates. Examples:
     - "90'+2, free kick at 22 m";
     - "90'+3, 1–1, corner";
     - "88', 0–1, counter 3v2";
     - "sudden death: your penalty to win";
     - "one-two at the edge".
   - **Squads:** real club-season squads from the soccer data. The brief names the star.
   - **Play:** one phase on the existing engine and set-ups, with its own clock (60–90 s real).
   - **Score:** outcome + PERFECTS + time.
2. **The `<Soccer2 daily>` host path:** no intro cards, no defend phase, no SIM, no prefs, never online. Lab param `daily=YYYY-MM-DD`.
3. **Tests (`daily-play.test.ts`):** G22; determinism across two fresh module loads; the score is monotone in outcome, PERFECTS and time; the import graph (no prefs).

**Part 2: the gate.** Each heavy command runs once, through `heavy.sh`.

1. **Checks.** `npm run typecheck`, then the full `npm test` (NBA, NFL, soccer), all green. T1: the soccer suite ≤ 120 s.
2. **Build.** `npm run build` once. B1: the soccer chunk delta; 0 bytes of soccer in the first-paint entry; the startup delta; Arcade imports report types only.
3. **Harness finals.** `sim.ts 400 all`, `gap`, `ladder`, `human.ts 200`, `ratings-human.ts 300`, `probe.ts 3000`, `bend.ts`, `cam.ts`, `audit_soccer_shots.ts 200`. Every §4 row, including §4.7, is tabled as met or missed, with the reason.
4. **Production frame pacing.** `vite preview` on 5217, 393×852, DPR 3, 4× CPU: V4 including SKIP and Auto-defend, and stale draws. 320×568 and landscape 844×390 not worse than the baseline.
5. **Browser walks** (isolation, six presets at sat 59 and 81, zero page errors, the blocked-host count logged):
   - **the lab:** every scenario including turnover and long ball; defend phases with all rings; SIM; Auto-defend; shot types; tricks; one-two; Heat to ON FIRE; Clutch; the shootout; pause, quit, forfeit; the Daily Play;
   - **`soccer-app.mjs all`:** Home → SOCCER; a draft match → result; a UT Squad Battle with defend phases; a Cup quit through contract B (stubbed if ut isn't merged); an online H2H between two local contexts, including a forfeit; a rematch;
   - **the reduced-motion walk:** every R1 item.
6. **Copy lint.** `copy-soccer.test.ts` fails on EA feature names in soccer player-facing strings: "Controlled Sprint", "Timed Finishing", "PlayStyle", "Avoidance", "Composure Circle", "VS Attack", "Counter Chances".
7. **The re-measure kit for the lead.** `scripts/soccer/remeasure.sh` and a checklist for the merged branch:
   - after the re-rates (packs-5, owner decision 5);
   - after players' sprites and LOD;
   - after nba's shared V2 pieces replace soccer's stand-ins (re-run the C1, G1–G6 and G17 checks);
   - after shell's Fix A.
8. **Docs.**
   - `docs/SOCCER-ENGINE.md` and `docs/SOCCER.md`: the controls table, the ring, Heat, touch dribbling, shot types and tricks, defend phases, the measured tables.
   - The team doc completed: before/after, tests, the final protocol line, "Touched outside my lane" (every hunk and every `// merge:` stand-in), hand-offs, owner device checks, and what was left undone and why.
9. **Owner screenshots** at DPR 3 (393×852, sat 59), beside the matching `mockups.html` cell.

**Protocol:** none for this task.

**Save-compat:** the gate re-runs `soccer-saves`, `soccer-ut` and `prefs`.

**Acceptance:** G22 met (or the Daily Play dropped with the reason); the gate passes in full; every §4 row tabled; docs updated; commits pushed.

## 8. Shared files and hunks outside the lane (all small, all listed in the team doc)

| File | Owner | Soccer hunk | Task |
|---|---|---|---|
| `src/lib/sound.ts` | soccer's wiring (OWNERSHIP) + V2 F.1 | the `'pitch'` crowd (done); `sfx.perfect`, `sfx.ringTick`, `sfx.post` | 1 |
| `src/game/Arcade.tsx` | nba/nfl shared | the soccer branch of `aiPlay` → `aiProgressFor` (1 line, done) | 1 |
| `src/game/Arcade.tsx` | nba/nfl shared | `'FF'` in the soccer `POINTS`; the soccer return passes `onQuit`; stand-ins for nba-7's forfeit block and box strip only if absent (marked for merge) | 2 |
| `src/game/Arcade.tsx` | nba/nfl shared | the soccer return: `onRival`/solo props; `them`/`shown` from `onRival` when `!online`; nba's mounted-arena rematch path for soccer; 2 lines of kick-off copy | 9 |
| `src/ut/Match.tsx` | ut shared | `simBoth` soccer → `aiProgressFor` (done) | 1 |
| `src/ut/Match.tsx` | ut shared | the soccer `END_LABEL` gains `'FF'` (1 line) | 2 |
| `src/game/play-feedback.ts` | nba/nfl shared | `soccerFeedback` lines only | 4, 5, 6, 7, 8 |
| `src/game/progress.ts` | nba/ut contract | optional `forfeit?`, `box?`, `grade?` only if not in our base (marked for merge) | 2, 9 |
| `src/game/soccer2/render.ts`, players section | players | a ≤ 10-line stand-in routing of new acts, only if players' routing isn't in our base (marked) | 5, 6 |
| nba's V2 files (`controls-geometry.css`, `Stick.tsx`, `perfect.ts`, `heat.ts`, `hud/*`) | nba (V2 grant) | small soccer-only props, only if the files are in our base; otherwise stand-ins in `soccer2/v2/` | 2, 4, 6, 7, 8 |
| `docs/CREDITS.md` | unlisted | one StatsBomb entry | 4 |
| `scripts/qa/soccer-lab.mjs`, `soccer-app.mjs` | soccer QA | isolation, presets, parts | all |

**Not edited:**
- `juice.ts` (the existing API through `fx.ts`);
- `replay.ts` (replays play recorded frames);
- `useInputInterrupt.ts` (soccer pauses on `visibilitychange` itself);
- `src/lib/haptics.ts` and `src/lib/playtime.ts` (ut's; consumed through `v2/`);
- `football2/controls.ts` (no longer used by soccer);
- `scripts/qa/browser.mjs`;
- `ut/teams.ts` (shape templates are cut);
- `src/net/**` and `src/lib/cloud*`.

**Rules:**
- Every Arcade hunk uses `pick({ nba, nfl, soccer })` or the existing `SOCCER` constant, and `sport-branches.test.ts` stays green.
- `DRAFT_RULES` and `UT_RULES` are never edited.

## 9. Protocol

One line in the team doc, first written in soccer-1 and final in soccer-10:

> Protocol bump needed: soccer draft 2→3, UT soccer 2→3, because the following all change how attacks and agreed shootouts come out, in the AI simulations both phones compute (takeovers, `simBoth`) and in each phone's own attacks:
> - the dead-ball rule and the restarts;
> - the gold-ring shot windows and the shot, keeper and pass model;
> - parries;
> - touch dribbling, the defending, tackle and foul model and the rating curve;
> - shot types, tricks and the one-two;
> - Heat and On Fire;
> - set pieces and the shootout kick model;
> - the V2 deal with its new set-ups, and squad rotation;
> - the `'FF'` forfeit code on the wire.
>
> NBA and NFL are unchanged by soccer.

- **One bump for two teams.** packs (shown = used) and the owner decision 5 re-rates also raise "Protocol bump needed: soccer UT". The lead treats both as **one** soccer UT 2→3 bump (V2 F.3: draft NBA 11 / NFL 11 / soccer 3; UT NBA 11 / NFL 12 / soccer 3).
- **No bump from these on their own** (V2 F.3):
  - the solo-only and offline paths (defend phases, rings on defence, the reflex save, Auto-defend, SIM, the offline ladder);
  - presentation (camera, HUD, the toast line, the pitch, juice, Clutch staging, the grade, goal moments);
  - input layout (the floating stick, the cluster).

  Golden and agreement guard them.

## 10. Save compatibility

- No storage key, card id, edition id, copy UID, profile field or UT state changes.
- **One new device-local key,** `perfect-season:soccer-prefs:v1` (§5.9). It has never shipped, so its shape is set here.
  - Optional, read in try/catch.
  - Defaults when missing or corrupt; unknown fields kept.
  - Not in cloud saves or checkpoints; never read by simulations or the Daily Play.
  - Tested with absent, garbage and old-shape values.
- `Progress.box`, `Progress.grade` and `Progress.forfeit` are optional match-time values that soccer never stores.
- Heat, the rotation and `OWN_DEF_IQ` are derived and never stored.
- The Daily Play stores nothing in soccer: attempts and rewards are ut's state, additive.
- The playtime ledger is ut's.
- The gate re-runs `soccer-saves`, `soccer-ut` and `prefs`.

## 11. Risk register

| # | Risk | Mitigation | Task |
|---|---|---|---|
| 1 | **CRITICAL: online desync from the ladder role or from Heat.** | The role applies only `!online` / `!setup.online`, through one function, `aiProgressFor`. Online Heat uses each side's own attack events only (no conceding term, no rival bar). `agreement.test.ts`: 500 seeds plus 1,000 shootouts in every task, with Heat from soccer-7 (G16). | 1, 7, 9 |
| 2 | **nba's shared V2 pieces aren't in our base, or their names differ from §5.0.2.** | Stand-ins in `soccer2/v2/` only, behind one `index.ts`. Soccer's tests import through it, so they run against either. Geometry is read from the DOM, not from token names. The re-measure kit re-checks C1, G1–G6 and G17 after the swap. | 1, 2, 4, 7, 10 |
| 3 | **"Gold never lies" against realism.** | Gold guarantees placement, not a goal: the keeper and blocks still act. The S1 bands are measured with the real gold rate of the `skilled` proxy and the autopilot. Gold is withheld under pressure, out of range and first time across the body (G2b). | 4, 7 |
| 4 | **The timestamp-judged ring leaks into determinism.** | The engine never reads a pointer timestamp. The judged offset becomes the release time in game seconds that `releaseShoot` already takes. The autopilot keeps its seeded release noise. Golden and agreement guard it. | 4 |
| 5 | **The touch model changes every scenario** (the reason revision 2 deferred it). | Lead decision 6 makes it first. Golden is re-based with its reason. soccer-5 re-runs every harness, and soccer-7 is the one whole-match fit after it. | 5, 7 |
| 6 | **Shot types or tricks become the new exploit.** | G13 (no verb above 1.3× the autopilot); chaining penalties; tricks star-gated; the power shot is open to tackles. | 6, 7 |
| 7 | **Facing is simulation state** (`fx/fy` feed first touch, passes, the cone, the foul-from-behind test). | A render-only `Body.look`; sim facing untouched; `render-fields.test.ts` randomises it. | 5 |
| 8 | **Quit exploit.** | No `'T'` fallback; solo quit goes to contract B, online to `'FF'`. | 2 |
| 9 | **Merge collisions in `Arcade.tsx`.** | Soccer lines only, in small hunks; shared contracts; `// merge:` stand-ins; every hunk listed with its line range. | 1, 2, 9 |
| 10 | **Inset QA silently ineffective; shell's Fix A moves the HUD 22 px.** | CSS injection plus a check of the computed `--sat`; every check at sat 59 and 81; offsets relative to `--sat`. | 1, 2, 3 |
| 11 | **A 34 m camera shrinks players.** | Sprites come from players' LOD at V2 sizes (V3), not from the camera scale; edge arrows carry the rest; any trade-off is written in both docs. | 3 |
| 12 | **Performance** (more players on screen, the ring, Heat flames). | Zoom quantisation, the floor cache, the ring drawn once a frame; production pacing at DPR 3 and 4× in the gate; stale draws ≤ 1%. | 3, 10 |
| 13 | **SKIP, SIM or Auto-defend as one long task.** | Chunked fast-forward ≤ 6 ms a frame (F6). | 9 |
| 14 | **SIM is easier than playing.** | D5; `OWN_DEF_IQ` shared by Auto-defend and SIM; SIM THIS ATTACK hidden in `manualOnly`. | 8, 9 |
| 15 | **Prefs fragmentation.** | One `autoDefend` with nba's meaning; the lead may unify; never read by sims (import-graph test). | 2, 9 |
| 16 | **Invented stats.** | The box, ratings, POTM and grade come from played events only. The MATCH ESTIMATE block is cut. | 9 |
| 17 | **Re-rates move the calibration.** | The re-measure kit after merge; one combined soccer UT bump line. | 10, §9 |
| 18 | **Gesture misreads** (A's variants against aim drags; the slide against SWITCH). | §5.8 thresholds and phase precedence; C3 tests; Buttons-only as the fallback. | 2, 6, 8 |
| 19 | **Reduced-motion gaps.** | R1 lists every effect, including the PERFECT scale, Clutch slow motion and the reflex save's slow moment (colour and sound stay). The gate walks it. | 2, 3, 4, 8, 9, 10 |
| 20 | **Heavy tasks** (soccer-4, 5, 7 and 9 carry V2 additions). | Each names its must-ship part first: the ring before the fit (4); touch dribbling before archetypes (5); Heat before the deal's new set-ups (7); the flow before the rematch polish (9). The reflex save and the Daily Play are the named drops. Any spill is written in the team doc and goes into the next session, never past the gate. | 4, 5, 7, 8, 9, 10 |
| 21 | **Haptics on an iPhone PWA.** | The research notes iOS Safari lacks the Vibration API. The existing gesture-gated path stays, and an owner device check records what the phone really does. | 2, 3, 4 |
| 22 | **Branding.** | No EA feature names in copy; the copy lint; commentary cut. | 10 |
| 23 | **Bundle and laziness.** | `import type` only in Arcade; the Daily Play and report code ride the soccer chunk; B1 in the gate. | 9, 10 |

## 12. Cut, deferred and promoted

**Cut in this release** (V2 F.2 #9 and the V2 replacements in §0.3):

| Item | Why; what remains |
|---|---|
| **Formation templates** (Appendix B), template variants, team styles, roles | V2 F.2 #9. **Kept:** every card plays (rotation, and your back line and keeper in defend phases; D7). |
| **Commentary ticker** (Appendix C) | V2 F.2 #9 and C.5 #6 (no extra text on the field). **Kept:** the crowd builds by distance; goal plates in the toast line. |
| **Substitutions** | V2 F.2 #9: an eleven-a-side engine, no bench in `Squad`, no stamina model. |
| **Swipe-to-dive shootout keeper**, and with it the B-6 keeper tell | V2 F.2 #9 (P2). B.3.2's penalty row lists it as P1; F.2 is the team's list. **Kept:** today's DIVE/STAY pre-commit. |
| Soccer's own full-time card, shot map and MATCH ESTIMATE block | V2 D.1: ut's shared result sequence. Soccer supplies the data. |
| Running-stats intro and xG on each shot readout | V2 C.5 #6. `xg.ts` stays as box data. |
| `stick: 'fixed'` and `spacing` prefs; soccer's own SPRINT button | V2 A.5: the shared stick and cluster. |

**Still deferred from revision 2** (unchanged reasons; see `git show 312069c:docs/studio-overhaul/soccer-plan.md` §12):
- a landscape match portal;
- continuous 11v11 halves;
- the online interactive shootout (`src/net/**` is lead-only);
- online defend phases (owner decision 2);
- dynamic stoppage time and changing the attack count (`TOTAL = 7` is the wire contract);
- per-attack highlight replays;
- the Team plan;
- traits, weak foot and roles with familiarity;
- swerve passes, pass-and-go, the runner trigger;
- corner target zones and the penalty composure ring;
- late-match fatigue;
- camera presets;
- the left-handed mirror (V2: "a later setting").

**Promoted into this release** (lead decision 6, V2 F.2 #4):
- shot types, skill moves (TRICK), the rolling-ball touch model, shielding (soccer-5, soccer-6);
- acceleration archetypes (soccer-5);
- the lofted through ball (soccer-2);
- the one-two (soccer-6).

## 13. Owner device checks (only a real iPhone can confirm)

- **Camera:** framing and readability at 34 m with the 5-head sprites, beside the real Dynamic Island, after shell's Fix A (soccer-3).
- **Controls:** the stick, the sprint ring, the pre-held thumb, and the A/B/C/D cluster under the thumbs (soccer-2).
- **The gold ring:** its feel, the device-lag calibration, and the chime. What the haptic really does in the home-screen app (soccer-4).
- **Dribbling and on-ball skill:** touch dribbling feel; the discoverability of the shot gestures and the TRICK button; Buttons-only (soccer-5, soccer-6).
- **Defending:** TACKLE ring timing, CONTAIN, SWITCH, KEEPER hold, the slide swipe, the reflex save (soccer-8).
- **The match:** length and flow with defend phases, Auto-defend and SIM; Clutch; the rematch (soccer-9).
- **The pause button** beside the island (soccer-2).

## Appendices B and C (cut in this release, V2 F.2 #9; kept as specs for a later release)

### Appendix B · Formation templates (cut; U-1 part 2)

- **Shapes from slot ids:** `Squad.shape` (`'433' | '442' | '4231' | '352'`) and `Squad.slots`, inferred from UT slot ids that are already on the wire.
- **Set-ups:** `setups.ts` holds `ATTACK[shape][scenario][variant]` and `DEFENCE[shape][scenario]`, for example:
  - 4-4-2 build-ups with two strikers;
  - 3-5-2 wing-back overlaps;
  - the 4-2-3-1 CAM between the lines.
- **Variants:** build-up from the back, a high turnover, 3v2 and 2v1 counters, overlap and underlap, near/far-post and short corners, edge-of-box and crossed free kicks.
- **Team styles from squad stats**, within ±15% of the autopilot's option weights: possession, direct, wing play.
- **Targets:** per-shape win% at equal OVR within ±5 points; possession squads make ≥ 20% more passes per attack than direct ones.
- **Cost:** a `ut/teams.ts` hunk (`pitchCardsOf` adds `slot`), a refit, and a protocol bump.

### Appendix C · Commentary ticker (cut; J-4)

- **`commentary.ts`** (pure): event → line, picked by `hashString(seed + event index)`, never `a.rand`. Original phrasing, checked by the copy lint.
- **Ticker:** one line, ≥ 10 px, ≤ 28 characters, at most one line per 1.5 s. It never overlaps the scoreboard or the safe box, and has no marquee under reduced motion.
- **Test:** a seeded match with and without commentary gives identical outcomes.
