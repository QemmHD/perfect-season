# Studio overhaul, team soccer: team doc

Team soccer's running record for the studio overhaul (branch `claude/studio-soccer`, worktree `/home/user/ps-s-soccer`): what changed and why, before/after numbers, the tests, the protocol lines, the hunks outside our lane and what only the owner's phone can confirm. The plan is [`soccer-plan.md`](soccer-plan.md); the shared contracts we publish and adopt are in §Contracts below.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul` (the overhaul's scratch folder: briefs, audit, `heavy.sh`).

---

## soccer-1 · Baseline first, guards and contracts, then the rule bugs

### Step A: the baseline, before any engine edit

Commit "baseline" (see the git log for its hash). Nothing in the engine changed in it.

**Harnesses** (`scripts/soccer/`, ported from the audit's `O/audit-scripts/soccer_*`, same seeds; shared parts in `lib.ts`). Run any of them with `bash O/heavy.sh npx vite-node scripts/soccer/<name>.ts [n] [part]`:

| Harness | What it measures |
|---|---|
| `sim.ts [matches] [rookie\|pro\|legend\|sim0.6\|all\|gap]` | Whole AI-vs-AI matches on the 1,714 real club-season elevens: the plan's §2 table per level (goals, draws, 0–0, the better side, shots, on target, save%, blocks, woodwork, conversion by distance, kinds, attack ends, scenarios) and a summary row per level; `gap` is the autopilot's per-attack goal rate with one side Δ above a 75 reference. JSON only with `SOCCER_OUT=<path>`. |
| `human.ts [n]` | Scripted person strategies (no-skill beelines at 12–30 m, a drag, a jog, a weave) against the Pro and Legend autopilot on the same attacks, at defIQ 0 and 1; penalties and free kicks by a person. |
| `ratings-human.ts [n]` | The no-skill beeline with attackers rated 60–99 against a 78 defence, a PAC-only row, the keeper's effect, the autopilot for comparison, and over-time attacks by scenario. |
| `probe.ts [n]` | Frozen balls (on the 120 s hard stop, or a dead loose ball for 5 s+), attacks over the clock + 15 s, goals straight from a keeper's parry, rebound goals, the step cost. |
| `bend.ts` | Where each BEND button sends a free kick (every defender moved off the ball's line, so all 40 kicks per button reach the line). |
| `cam.ts [attacks]` | The portrait camera (a replica of `render.ts`'s): kick-off framing per scenario, and mid-attack framing over autopilot attacks with the 60 fps follow. |
| `scripts/audit_soccer_shots.ts [n]` | The repo's shooting, keeper and passing drills (existing). |

**The baseline reproduces the audit exactly.** The engine on this branch is the audit's (`acdf3e2`), and every harness keeps the audit's seeds, so the numbers are the audit's to the decimal: `sim.ts 400 all` (all four levels), `human.ts 200`, `probe.ts 3000` and the kick-off rows of `cam.ts` are identical. Two harnesses differ by design:
- `ratings-human.ts`: within 0.7 points of the audit in every cell (counter 70: 1.3% vs 1.7%; 80: 32.0% vs 32.7%; wide 99: 81.0% vs 81.3%). The shared `beeline()` in `lib.ts` holds the stick still when a teammate other than the controlled man has the ball, where the audit's ratings script let the brain run him; that touches 1–2 of 300 attacks.
- `bend.ts`: the audit let the keeper and the markers stop most kicks (n 11 / 3 / 24 of 40); ours moves them off the line, so n = 40 each. Same direction, same conclusion.

#### Whole matches, AI vs AI (`sim.ts 400 all`, real club-season pairs)

| Level | Goals/match | Draws | 0–0 | Shots/side | On target | Goals/shot | Save% | Blocked | Woodwork | Pens scored (n) | Direct FK | Better side ΔOVR ≥ 8 W/D/L |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rookie (0.45, defIQ −0.5) | 2.33 | 26.0% | 8.0% | 5.20 | 51.3% | 20.3% | 60.4% | 11.2% | 4.1% | 77.8% (36) | 3.4% | 66.4 / 19.3 / 14.3 |
| Pro (0.68, 0) | 2.33 | 26.8% | 7.8% | 5.21 | 53.7% | 20.4% | 61.9% | 11.3% | 4.2% | 93.0% (43) | 2.3% | 69.3 / 23.6 / 7.1 |
| Legend (0.88, 1) | 1.98 | 31.0% | 14.5% | 4.63 | 54.9% | 18.8% | 65.8% | 10.9% | 3.9% | 89.5% (38) | 4.3% | 67.1 / 20.7 / 12.1 |
| SIM 0.6 (0.6, 0) | 2.27 | 23.0% | 7.8% | 5.07 | 52.2% | 19.7% | 62.2% | 11.4% | 4.0% | 86.0% (50) | 4.5% | 64.3 / 24.3 / 11.4 |

Attack ends (the AI's attacks):

| Level | Goal | Saved | Wide | Blocked | Lost | Offside | Time |
|---|---|---|---|---|---|---|---|
| Rookie | 16.6% | 14.2% | 24.5% | 8.4% | 33.6% | 2.3% | 0.4% |
| Pro | 16.7% | 15.2% | 22.5% | 8.4% | 33.7% | 3.0% | 0.6% |
| Legend | 14.2% | 14.7% | 19.8% | 7.2% | 40.8% | 3.0% | 0.4% |
| SIM 0.6 | 16.2% | 14.6% | 23.3% | 8.2% | 34.8% | 2.5% | 0.4% |

Pro conversion by distance (open play): 0–6 m 59.5% · 6–11 m 45.0% · 11–16.5 m 23.4% · 16.5–22 m 15.8% · 22–30 m 5.5% · 30 m+ 3.1%. Per scenario (Pro): build 21.6%, counter 19.4%, wide 18.9%, free kick 10.6%, corner 5.4%.

**Rating gap** (`sim.ts 400 gap`, synthetic elevens, Pro autopilot, 2,800 attacks per cell; the plan's A13 is +5 to +7 points per +10 OVR):

| Side Δ above 75 | Δ0 | Δ5 | Δ10 | Δ15 |
|---|---|---|---|---|
| Attack +Δ: per-attack goal rate (goals/match) | 14.4% (1.00) | 17.9% (1.25) | 20.6% (1.44) | 24.5% (1.72) |
| Defence +Δ | 14.9% (1.04) | 11.3% (0.79) | 8.7% (0.61) | 6.2% (0.43) |

So today +10 OVR on the attack is worth +6.2 points per attack, and on the defence −6.2.

#### A person on the controls (`human.ts 200`, defIQ 0)

| Row (per attack) | Build | Counter | Wide |
|---|---|---|---|
| Beeline sprint, SHOOT at 16 m, assist | 26.5% | **58.5%** | 38.0% |
| Beeline sprint, SHOOT at 20 m, assist | 19.5% | 49.0% | 28.0% |
| Beeline sprint, SHOOT at 30 m, assist | 16.0% | 22.5% | 9.5% |
| Beeline sprint, SHOOT at 20 m, drag to the corner | 21.5% | 40.0% | 28.0% |
| Autopilot 0.68 (Pro AI) | 26.0% | 20.0% | 18.5% |
| Autopilot 0.88 (Legend AI) | 18.0% | 17.5% | 21.5% |
| Penalties won by the 16 m beeline | 7.5% | 6.0% | 12.0% |
| Free kicks won by the 16 m beeline | 20.0% | 2.0% | 8.5% |

At defIQ 1 the counter beeline still scores 40.0%. Set pieces by a person: penalty low corner 84.5%, high corner 76.0%, centre 35.5% (autopilot 77.0%); free kick far top with the BEND button that points back toward goal 3.5% (wide 51%, over 23%), far top no bend 4.5%, near low 4.5% (autopilot 14.0%).

#### Ratings for a person (`ratings-human.ts 300`, beeline at 16 m vs a 78 defence)

| Attackers | 60 | 70 | 80 | 90 | 99 |
|---|---|---|---|---|---|
| Counter (all stats) | 0.7% | 1.3% | 32.0% | 92.3% | 99.3% |
| Build | 0.0% | 0.7% | 21.7% | 70.0% | 88.7% |
| Wide | 4.3% | 6.7% | 27.3% | 60.7% | 81.0% |
| Counter, **PAC only** (other stats 78) | 3.3% | 10.0% | 27.0% | 50.0% | 90.0% |
| Build, PAC only | 2.3% | 4.3% | 18.7% | 36.0% | 52.3% |
| Wide, PAC only | 13.0% | 24.7% | 23.7% | 24.0% | 24.7% |

Keeper (attackers 80): counter GK 55 / 78 / 95 → 37.7 / 37.0 / 22.0%; build 22.7 / 21.3 / 18.7%. The autopilot (0.68) at 60 / 80 / 99: counter 7.0 / 14.7 / 33.7%, build 10.3 / 19.0 / 30.0%.

#### Rules (`probe.ts 3000`, `bend.ts`)

| Probe | Baseline |
|---|---|
| Frozen balls: on the 120 s hard stop | **25 of 3,000 (0.83%)**, all with the flight still `shot`, the ball dead, after a shot or header |
| A dead loose ball nobody plays for 5 s+ | 25 (the same attacks) |
| Attacks over the clock + 15 s | **25** |
| Attack length p50 / p90 / p99 / max (game s) | 5.1 / 10.3 / 15.7 / 120.0 |
| Goals straight from a keeper's parry | 65 of 456 (14.25%) |
| Goals after a rebound (parry, woodwork, block) | 88 (19.3%) |
| Step cost (engine + autopilot) | 22.5 µs |
| BEND "Bend left" (left arrow) | ends **+2.50 m right** of the aim (curl −0.75) |
| BEND "Bend right" (right arrow) | ends **−2.54 m left** (curl +0.75) |
| BEND straight | −0.07 m |

#### Camera (`cam.ts 60`, the audit's measured HUD rectangles)

Kick-off (390×844): 16.9 m of the 68 m width visible at the carrier's row; teammates on screen build 1/5, counter 0/3, wide 1/5 with the carrier **off-screen** (x −36 / 426), corner 3/5 with a 17 px taker at x = 17, free kick 4/4, penalty 1/3. 320×568: the same shape (wide carrier at x −30 / 350, corner taker 14 px).

Mid-attack (60 real-squad autopilot attacks per scenario, the man on the ball or the one a pass is for):

| 390×844 | Build | Counter | Wide | Corner | Free kick |
|---|---|---|---|---|---|
| On screen | 77.1% | 82.7% | 75.5% | 69.3% | 79.7% |
| On screen and clear of the controls | 75.7% | 81.3% | 74.7% | 69.3% | 72.5% |
| His sprite size changes per second | 3.82 | 2.30 | 3.00 | 2.06 | 6.04 |

(320×568: on screen 77.1 / 82.7 / 75.5 / 69.3 / 79.7%, clear of the controls 71.4 / 79.0 / 69.0 / 69.3 / 66.8%.)

#### Shooting drills (`scripts/audit_soccer_shots.ts 200`, 75 v 75)

1v1 62.0% (drag 61.3%, a bad release 23.3%); edge of the box run 39.3%, drag 47.3%, standing still 14.0% (32% blocked); wide 14.0%; volley 32–37%. By SHO (drag): 1v1 40.0 / 58.0 / 64.7% and edge 26.0 / 49.3 / 76.0% at SHO 55 / 75 / 95. By keeper: 1v1 80.7 / 58.0 / 24.0% and edge 62.0 / 41.3 / 16.0% at GK 52 / 75 / 93. Timing spread 0 → 0.15 s: 1v1 75.0 → 43.0%. Autopilot per scenario (0.75, three real matchups): build 10.0%, counter 16.4%, wide 17.4%, corner 14.9%, free kick 6.5%, penalty 69.2%. Passing: aimed dead on, 98.5% reach the man (ground), 97.5% (through), 97.5% (lofted).

#### Test guards and wall time

- **`golden.test.ts`** hashes 60 seeded autopilot attacks (six scenarios × both mirrors × five seeds: the end, its time and text, the clock used, the ball and every body at the whistle and again after 3 s of `settle()`), 20 `aiProgress` matches and 50 agreed shootouts, on synthetic seeded elevens (`squads.test-util.ts`), so a re-rate of the real cards can't move it. Baseline hashes (untouched engine): attacks `0f8f55a4585cb3`, matches `0b2cfdb283c412`, shootouts `13ebc2208d1307`.
- **`agreement.test.ts` + `agreement-ut.test.ts`** (the two-phone model in `phones.test-util.ts`): 500 seeds, each computed from phone A's seat and phone B's (each phone builds both elevens from the cards itself, with its own labels), must be identical: the Arcade's online takeover/taken at Legend on the 250 even seeds, Ultimate Team's `simBoth` on the 250 odd seeds (alternating which side's attacks are compared); `agreedShootout` from the host's seat and the guest's, mirrored over 1,000 seeds. A "has teeth" case in each file proves a ladder that leaked into online play (the rival's attacks played sharper even online) is caught. The two files split one 500-seed guard so the suite runs them side by side: as one file it was the suite's critical path (79 s under load).
- **`aiProgressFor(att, def, seed, skill, defIQ, { rival, online })`** in `arcade.ts`: identical to `aiProgress` today. Arcade's soccer `aiPlay` and ut's `simBoth` call it, so the offline ladder (soccer-9) has one door and the agreement test guards it from day one.
- **Wall time** (`PS_SPORT=soccer npx vitest run soccer sport-branches`, through `heavy.sh`, vitest's Duration): before soccer-1 **16.9 s** (9 files, 74 tests, idle machine); with the step A guards **64.0 s** (12 files, 94 tests) with the shared machine at load ≈ 5 on 4 CPUs (other teams' runs). Cap 120 s (plan T1). After step B: see Step B.

#### QA tooling

- `scripts/soccer/qa-isolate.mjs`: `isolate(context)` (one route handler per context, WeakSet-guarded: localhost, 127.0.0.1 and the two font hosts `route.fallback()`, everything else aborted and counted, WebSockets too through `routeWebSocket`), `isolateBrowser(browser)` (for helpers that make their own contexts, like `browser.mjs` `fixture`), `insets(context, [t, r, b, l])` (`window.__psInsets` plus `.arcade-full{--sat…}` injected unless the app already computes it), `computedSat(page)`, `PRESETS` (393×852 at sat 59 and 81, 390×844, 430×932, 375×667, 320×568), `phone()`, `urlFor()` (always `?ns=inspect&relay=ws://localhost:7777`), `blockedLine()`.
- `scripts/soccer/relay.mjs`: the in-process Nostr relay on 7777 (signature-checked, as `scripts/qa/online.mjs`'s), on `node:http` because the `ws` package isn't a project dependency. A busy port is retried every 10 s for 3 min, then it fails; no live fallback.
- `scripts/qa/soccer-lab.mjs`: every context isolated, the play parts at 393×852 (sat 59) and 320×568, and a new `smoke` part on all six presets. `scripts/qa/soccer-app.mjs`: isolated contexts, the in-process relay, `widths` on the six presets.
- Lab parameter **`start=x,y`**: the man on the ball starts at that spot (pitch metres) in open-play attacks, for drills and screenshots.

### Step B: the rule bugs R-1 and C-4, the soccer crowd (J-1), confetti (J-3)

**What changed** (details in `docs/SOCCER-ENGINE.md`, "Studio overhaul soccer-1"):
- **R-1, dead shots.** A `'shot'` or `'parry'` that rolls slower than 3 m/s below 0.3 m, or has bounced twice, becomes a loose ball (`deadShot`, event `'shot-dead'`): anyone can play it, the keeper drops his read, and the attack's clock runs whenever the ball is slower than 3 m/s.
- **Untaken set pieces** go to the autopilot's taker after `SET_PIECE_WAIT` = 12 s, with an "AUTO KICK IN 5…1" countdown (`setPieceCountdown`, `.sc2-autokick`). It is person-only: the AI takes its own in about a second, so no simulation reads it.
- **C-4, BEND.** `bendCurl(k)` = `-0.75k`, so each button bends the way its arrow points; the buttons are 44 px tall (40 before).
- **J-1.** The match plays soccer's own ground (`sound.ts` venue `'pitch'`: the chant bed, roar, kicks, the bounce and the full-time whistle), not the NFL stadium. A render-only `'bounce'` event plays `sfx.bounce`; the crowd level follows the ball's distance to goal (0.24 at 35 m+ to 0.5 at 12 m).
- **J-3.** Goal confetti comes out in the scorer's kit (the rival's goals threw yours), and none under reduced motion.
- `soccer.test.ts`: the "every scenario ends" bound tightened from the 120 s hard stop to `a.clock + 15`. The old bound allowed exactly the R-1 bug.

**Before → after** (same seeds):

| Measure | Before (Step A) | After Step B | Target |
|---|---|---|---|
| `probe.ts 3000`: frozen balls on the 120 s hard stop | 25 (0.83%) | **0** | 0 |
| A dead loose ball nobody plays for 5 s+ | 25 | **0** | 0 |
| Attacks over the clock + 15 s | 25 | **0** | 0 |
| Attack length p50 / p90 / p99 / max (game s) | 5.1 / 10.3 / 15.7 / 120.0 | 5.1 / 10.2 / 14.1 / 19.9 | — |
| Dead shots played on as loose balls | — | 192 (shot slow 51, shot bounced 68, parry 73); 30 of those attacks still ended in a goal | — |
| Goals straight from a parry | 65 of 456 (14.25%) | 65 of 461 (14.1%) | R-2 (below) |
| `bend.ts` Bend left / straight / Bend right | +2.50 / −0.07 / −2.54 m | **−2.54 / −0.07 / +2.50 m** | ≤ −1.5 / ±0.5 / ≥ +1.5 |
| `sim.ts 400 pro`: goals/match, draws, 0–0 | 2.33, 26.8%, 7.8% | 2.32, 25.5%, 7.8% | interim 2.1–2.8, 20–32% |
| Shots/side, on target, goals/shot, save% | 5.21, 53.7%, 20.4%, 61.9% | 5.22, 53.5%, 20.2%, 62.2% | (soccer-4/7) |
| Attack ends G / S / W / B / L / O / T | 16.7 / 15.2 / 22.5 / 8.4 / 33.7 / 3.0 / 0.6% | 16.6 / 15.4 / 22.4 / 8.5 / 34.2 / 3.0 / **0.0%** | — |
| Step cost (engine + autopilot) | 22.5 µs | 34.0 µs (shared machine at load ≈ 5; not comparable) | — |

**Tests.** New `rules.test.ts` (9 tests): a slow shot is no longer a `'shot'` within 1 s and the attack ends within 15 s with a valid letter; an idle person can't hang a dead ball; a ball that bounced twice is loose while a hard true shot stays the keeper's; 180 autopilot attacks all end inside `a.clock + 15`; the countdown's numbers and the autopilot taking a free kick, a corner and a penalty that were left alone; `bendCurl`'s signs and 40 kicks per button (left ≤ −1.5 m, right ≥ +1.5 m, straight within 0.5 m); stripping `'bounce'` events changes no attack.

**Golden.** The three hashes stayed green through Step B, so no re-base: none of the 60 hashed attacks, 20 matches or 50 shootouts has a shot that died short or a set piece left untaken (the AI takes its own at once), and the clock change only matters while such a ball rolls. Agreement green (both files). The R-2 commit re-bases it (below).

**Suite.** `PS_SPORT=soccer npx vitest run soccer sport-branches`: 13 files, 103 tests, all pass; Duration **124.6 s** with the shared machine saturated (four other teams' Playwright, calibration and vitest runs queued on `heavy.sh`). 64.0 s at Step A under lighter load. See soccer-1's final timing below.

### Step C: R-2 (parries and restarts), the shared ring sounds, the V2 adapter

**What changed** (details in `docs/SOCCER-ENGINE.md`):
- **The parry rule (R-2).** A parry leaves the keeper's hands away from the goal line. `PARRY.outLo`..`outHi` (50–85% by HAN) are pushed out wide at `(±0.9, −0.35)`, the rest back out in front at `(±0.3..1.1, −1)`. Both go to the side away from the middle of the goal unless HAN < 55 (then the side his body went: a poor handler can knock it back across his six-yard box). Only a ball parried from outside ±(GHALF − 0.3) goes on round the post `(±0.9, +0.45)`. Before, 45% went toward the line from anywhere across the goal. The HAN fit itself stays in soccer-4.
- **Earned restarts (R-2).** Over the byline off a defender or the keeper: a **corner in the same attack** (`setPieceAfterOut`, event `'corner-won'`, "CORNER!"), lined up from the new shared `CORNER`/`cornerLayout(side)` that the dealt corner now uses too. The corner's marking, duels, keeper's box and header cone apply after an earned one (`a.restart`). Off an attacker: `'W'` "GOAL KICK" (a shot reads "WIDE · GOAL KICK" / "OVER THE BAR · GOAL KICK"). Over the touchline off a defender beyond y 75: a **quick throw-in** to the nearest attacker (`'throw-in'`, the thrower holds it overhead 0.6 s, flight and `Body.passKind` `'throw'`, no offside). Off an attacker: `'L'` "THROW-IN · THEIRS" (was "OUT OF PLAY"). At most two restarts an attack, each leaving ≥ 5 s on its clock; past two, the keeper's save stands. No random numbers are drawn for any of it.
- **Soccer2:** "CORNER!" / "THROW-IN" calls; the end card reads GOAL KICK for a ball we put out; the woodwork plays `sfx.post()`.
- **Sounds (V2 F.1):** `sfx.perfect(streak)`, `sfx.ringTick(i)`, `sfx.post()` in `src/lib/sound.ts` (§5.0.1 a).
- **`src/game/soccer2/v2/index.ts`:** the adapter skeleton (re-exports and interface types only; §5.0.2).
- **Harnesses:** `sim.ts` prints earned corners and quick throw-ins per side per match and goals after an earned corner; `probe.ts` prints corners (and how many came from a parry), throw-ins and the most restarts in one attack. Lab QA part `restarts` (`scripts/qa/soccer-lab.mjs`).

**Before → after** (same seeds; "Step B" is the commit before R-2):

| Measure | Audit / Step A | Step B | After R-2 | Target |
|---|---|---|---|---|
| `probe.ts 3000`: goals straight from a keeper's parry | 65 of 456 (14.25%) | 65 of 461 (14.1%) | **0 of 404 (0.0%)** | ≤ 2% (≤ 1% after soccer-4) |
| Goals after a rebound (parry, woodwork, block) | 88 (19.3%) | 87 (18.9%) | 85 (21.0%) | — |
| Parries | — | 449 | 478 | — |
| Frozen balls / attacks over the clock + 15 s | 25 / 25 | 0 / 0 | **0 / 0** | 0 / 0 |
| Attack length p50 / p90 / p99 / max (game s) | 5.1 / 10.3 / 15.7 / 120.0 | 5.1 / 10.2 / 14.1 / 19.9 | 5.2 / 10.4 / 14.4 / 24.0 | — |
| Corners earned (3,000 attacks); from a parry; most restarts in one attack | — | — | 30; 30; 1 | ≤ 2 |
| `bend.ts` Bend left / straight / right | +2.50 / −0.07 / −2.54 m | −2.54 / −0.07 / +2.50 m | **−2.54 / −0.07 / +2.50 m** | ≤ −1.5 / ±0.5 / ≥ +1.5 |
| `sim.ts 400 pro`: goals/match; draws; 0–0 | 2.33; 26.8%; 7.8% | 2.32; 25.5%; 7.8% | **2.12; 25.3%**; 9.8% | interim 2.1–2.8; 20–32% |
| Shots/side; on target; goals/shot; save% | 5.21; 53.7; 20.4; 61.9% | 5.22; 53.5; 20.2; 62.2% | 5.42; 53.4; 19.5; 63.5% | (soccer-4/7) |
| Better side (ΔOVR ≥ 8) W/D/L | 69.3 / 23.6 / 7.1 | 70.7 / 23.6 / 5.7 | 72.1 / 19.3 / 8.6 | — |
| Attack ends G / S / W / B / L / O / T | 16.7 / 15.2 / 22.5 / 8.4 / 33.7 / 3.0 / 0.6 | 16.6 / 15.4 / 22.4 / 8.5 / 34.2 / 3.0 / 0.0 | 15.1 / 12.5 / 23.1 / 9.0 / 37.3 / 3.0 / 0.0 | — |
| **A9 baseline:** corners won per side per match (earned in play); dealt corners; quick throw-ins; goals after an earned corner | — | — | **0.07**; 1.00; 0.00; 6 (0.7% of goals) | corners won 1.0–2.5 (soccer-7) |

Reading the numbers:
- Removing the parry own-goals cost about 0.2 goals a match (2.32 → 2.12, still inside the interim band). A parry that used to roll in is now a corner, a ball back in front, or one the defence clears. Some of those clearances now end `'L'` ("CLEARED BY", "KEEPER COLLECTS") where they used to be saves (S 15.4 → 12.5%, L 34.2 → 37.3%). soccer-4 fits conversion, keeping and the save% (A6) on top of this, and soccer-7 fits the whole match back to 2.4–2.7.
- Earned corners are rare: 0.07 per side per match. Today nearly every defender's touch ends the attack at once (an interception, a header clear or a tackle), so almost only parries can go out off the defence. Quick throw-ins are 0.00 for the same reason: the rule is in and tested, but the AI's play hardly reaches it yet. A9's 1.0–2.5 is soccer-7's job (the deal, blocks and clearances that run out), and this row is its baseline.
- 0–0 rose from 7.8% to 9.8%, still inside the guard (≤ 14%). It is back in the fit for soccer-7 (A2: 4–10%).

**Tests.** `rules.test.ts` now has 17 tests, adding:
- a parry's initial `vy ≤ 0` unless x is outside ±(GHALF − 0.3), over 320 strikes against HAN 60 and HAN 42 keepers (round-the-post parries do occur);
- from a HAN 70 keeper, never back across his goal;
- the dealt corner lines up on `cornerLayout` (both flags);
- a parry over the byline is a corner in the same attack from the right flag, the taker on the ball, ≥ 5 s left, and it plays on to a valid end;
- off a defender too; no third restart (the save stands); a throw-in counts toward the two;
- off an attacker it is a GOAL KICK;
- the quick throw-in goes to the nearest teammate, is held overhead, has no offside, sets `passKind: 'throw'` and is not given short of y 75; off us it is THROW-IN · THEIRS;
- 300 autopilot attacks against a weak keeper: ≤ 2 restarts, every `'W'` a goal kick, all inside the clock + 15 s.

New `src/lib/sound-perfect.test.ts` (7 tests): the chime's root and fifth 70 ms apart; +1 semitone a PERFECT, capped at +4; streak edge cases; the tick's +2 semitone steps, clamped; the clang's inharmonic partials; no file fetched by the chime or the tick (the clang only asks for the existing "ooh"); no audio nodes at all with the sound off.

**Old tests changed, because part of their old margin was the R-2 bug** (keepers parrying shots into their own net):
- `soccer.test.ts` "a good finisher scores more": SHO 95 vs 55 scored 16.3% vs 4.4% from the same chances after R-2, missing the old `+0.12` margin by 0.1 point. It now requires `+0.10` **and** at least 2.5× the poor finisher. soccer-4 refits the SHO curve (S1, S6).
- `setpieces.test.ts` free kicks: free-kick attacks fell from about 10% to 7.3% and direct free kicks from about 6% to 3.0%: about half the direct goals were parried in. Floors lowered from 8% to 6% (attacks) and from 5% to 2% (direct). soccer-7 must restore them with its set-piece fit (A12: direct 6–11%).

**Golden** re-based once, for R-2 (reason in `golden.test.ts` REBASES #2): attacks `0f8f55a4585cb3` → `0dde30cbc63300`, matches `0b2cfdb283c412` → `07f3dde0f40f62`, shootouts unchanged `13ebc2208d1307` (penalties never parry into play).

**Suite.** `PS_SPORT=soccer npx vitest run soccer sport-branches`: 13 files, **111/111** pass. Duration **111.5 s** and **125.7 s** on two runs with the shared machine at load 7–8 on 4 CPUs (vitest's summed test time is 207–249 s; the critical path is `agreement.test.ts` at 78–89 s). The cap is 120 s; under normal load this suite runs in about 65 s (Step A measured 64 s). Default sport: golden, agreement, rules and both sound tests, 60/60. Typecheck clean.

**Browser** (`scripts/qa/soccer-lab.mjs` on the dev server at 5217; every context isolated: non-localhost requests and WebSockets aborted and counted; `?ns=inspect&relay=ws://localhost:7777`; touch, DPR 2). Screenshots are in `O/shots/soccer/soccer-1/` and were looked at.
- `smoke` on all six presets (393×852 at sat 59 and 81, 390×844, 430×932, 375×667, 320×568): **0 page errors**; the computed `--sat` equals the injected value on every preset (59, 81, 47, 59, 20, 0); **12 requests blocked**, all of them the page's own probe to `example.com` (a fetch and a WebSocket per preset). The app itself contacted no live host.
- `bend` (393 and 320): the three BEND buttons measure 46/88/46 × **44** px; Bend left sets curl +0.75 and shows pressed; the BEND arrow over the ball curls left.
- `autokick`: "AUTO KICK IN 5 … 1" shows, and the autopilot takes the kick at 12.07 s / 12.08 s of match time. The QA loop now recognises a kick that was taken and dealt the next attack.
- `confetti` (shootout, BAR v LIV): the rival's goal ("THEY SCORE · SALAH") throws confetti in Liverpool's red and teal, not ours.
- `restarts` (new): a parry staged running wide of the right post becomes a corner from the right flag in the same attack ("CORNER! · WON IT", CROSS button, taker on the ball, 29.5 s left, restarts 1). A ball then sent off a defender over the touchline at y 90 gives a quick throw-in (held at 2.05 m, `kick.kind 'throw'`, restarts 2). 0 errors at 393 and 320.
- **Seen, and left to soccer-3 (camera, V-1):** at an earned corner and a quick throw-in the camera frames the receiver, so the taker or thrower at the flag or touchline sits at or past the screen edge (the corner taker's name is cut at x 393). The dealt corner has the same framing today (audit: taker at x = 17). soccer-3's corner framing and edge arrows cover both.

## soccer-2 · The shared control cluster, HUD kit, toast line, pause, quit and forfeit

**What changed** (V2 A.5, C.3; audit C-1, C-5, V-3; plan soccer-2):
- **The left thumb is a floating stick** (`v2/stick.ts` + `Stick` in `v2/hud.tsx`, stand-ins with nba's interface). A thumb down anywhere in the lower-left zone (x 0–48% of the width, y 45% down to the bottom inset) spawns the ring under it. Past 1.15× the ring is sprint, back under 1.0× ends it (hysteresis), with a `'tick'` haptic as it turns on. Release is `{0, 0}`. A thumb resting there before the whistle is tracked and drives the carrier the frame the stick enables. A quick tap in the zone that never moved the stick, or a second finger there, is a tap on the pitch (tap a teammate to pass). **SPRINT leaves the right cluster** (Shift still sprints on a keyboard).
- **The A/B/C/D cluster** on the V2 geometry tokens (`v2/geometry.css`, nba's token names and values; `v2/geometry.ts` computes the same numbers). Slots per phase come from `controls.ts` `slotsFor`:
  - open play: A SHOOT, B PASS (hold ≥ 0.22 s = lob/cross), C THRU (tap = ground; **hold = the lofted through ball**, new), D empty until TRICK (soccer-6);
  - free kick: A SHOOT, B CROSS, C SHORT, **D BEND** (tap cycles straight → left → right; the swipe on the pitch still bends). The three BEND chips are gone, so a free kick has four right-thumb targets, not seven;
  - corner: B CROSS, C SHORT; penalty: A SHOOT only;
  - before the whistle A is KICK OFF / STEP UP / READY (it breathes, except under reduced motion), so the left thumb can already be down.
  - Taps, the cross, SHORT and BEND fire on touch-down; PASS, THRU and SHOOT are deliberate holds and fire on release. The pressed look (6 px sink, edge collapse, a halo ring) is on touch-down.
- **Button skin (C.3):** lit domes (three-stop radial body, a specular cap, an inner rim, a hard coloured edge below, a contact shadow and a glow): A gold with a dark label, B teal, C/D indigo glass. A bottom scrim (transparent to `rgba(7,21,33,0.55)` over 240 px). No `backdrop-filter` in the match.
- **The lofted through ball** (`engine.ts` `pass(a, 'loftedThrough', …)`): the through ball's runner and space, in the air (lofted flight, `kick.kind 'lofted'`, `kick.loftedThrough`), and `Body.passKind: 'loftedThrough'` for players. A person's pass only: the autopilot never plays it, so golden is unchanged.
- **HUD kit** (stand-ins in `v2/hud.tsx`): the score bug "YOU 1 · 67' 5/7 · 1 RIV" (232×40 at sat + 6 on the owner's phone; team-colour blocks with accent stripes; PENS / FULL TIME in the middle when they apply) with a 3 px line along its bottom that drains with the attack's clock (red in its last 5 s; it replaces the 0:30 read-out) and the hidden Heat-bar slot at sat + 49 (soccer-7 fills it); the pause button 44×44 top left; the **toast line** (one 28 px glass capsule, bottom edge at y 618 on the owner's phone, keyword coloured) in place of the hint card over the goal and the intro card. It carries the attack's line before the whistle ("BUILD-UP · find a runner in behind"), the tips, the AUTO KICK countdown and their-kick line, and shows nothing while SHOOT is held or a meter is up. The attack-ends row under the bug is gone (the bug's "5/7" replaces it).
- **V-3 fixes:**
  - **FBENDICK:** every tag on the pitch goes through one label pass (`render.ts` `layoutLabels`): the most important keeps its spot, the rest stack clear of it; and no tag prints under the toast line (it drops just below). "BEND" over the ball shows only before SHOOT is held.
  - **Rings by side:** the gold ground ring and gold tag only for our man; the rival's taker (their penalty in a shootout) gets a violet ring and tag, and no teal pass target.
  - **`SCENARIO_SHORT`** and one-line toasts with one name per control (SHOOT, PASS, THRU, CROSS, SHORT, BEND); nothing is ellipsised at 320.
  - The intro card is gone (its words are in the toast line and the bug), so nothing covers name tags before kick-off.
  - The `@media (max-width: 350px), (max-height: 600px)` rules are now the `.compact` class, set from the measured frame.
  - The LAST PLAY read-out shows between attacks only, under the pause button (it sat in the stick zone, over the toast line).
- **Pause (C-5)** (`PauseSheet.tsx`, `timers.ts`): the sheet has RESUME, HOW TO PLAY, CONTROLS and the playtime line when the hook gives one. While paused the loop drops its accumulator (a.t stops), input clears, and every beat between whistles (`PausableTimers`: next attack, replays, shootout kicks, pops, tips) holds its remaining time; a replay resumes where it stopped. It pauses itself on `visibilitychange: hidden` and `pagehide`. Esc / P pause on a keyboard.
- **QUIT (solo, ut contract B):** QUIT MATCH → "QUIT? It counts as a loss." (the host's `quitNote`) → `Soccer2 onQuit(progress)` → `Arcade` calls the host's `onQuit(us, them)` with the attacks played and the AI's progress. No soccer-side settlement, no padding. Shown only when the host passes `onQuit`.
- **FORFEIT (online):** FORFEIT → "FORFEIT? Your rival wins, and the match ends on both phones now." → `Arcade` pads your ends with `'FF'` to TOTAL, `done: true`, sends it, and finishes with `onFinish(…, forfeit 'us')`. The other phone sees the `'FF'` ends (the wire parser keeps them) and finishes at once with `forfeit 'them'`. `'FF'` is worth 0 in soccer's `POINTS` and labelled in ut's `END_LABEL`; `match.ts` has `MatchEnd`, `FORFEIT`, `forfeitEnds`, `forfeitBy` and `END_TEXT.FF = 'FORFEIT'`. `progress.ts` `wireOf(p)` sends only the five shared fields (no `forfeit`, box or grade), used by `Arcade.progress()` for every sport.
- **Prefs** (`prefs.ts`): `perfect-season:soccer-prefs:v1` = `{ v: 1, autoDefend: false, autoSwitch: 'on', buttonsOnly: false }`, unknown fields kept, every bad value a default. Nothing reads them yet: the switches arrive with what they switch (`buttonsOnly` with the shot types in soccer-6, `autoSwitch` with defend phases in soccer-8, `autoDefend` in soccer-9). A toggle that changes nothing would mislead, so CONTROLS is a control map for now.
- **Playtime and haptics** (stand-ins `v2/playtime.ts`, `v2/haptics.ts`): `usePlaytime('match', { paused, auto: autoplay, stoppage: between phases })`; `haptic('tick')` on an accepted button, a tap pass and the sprint edge, played only inside the player's own touch.

**Before → after** (`scripts/qa/soccer-lab.mjs layout`, dev server, touch, every context isolated; screenshots in `O/shots/soccer/soccer-2/`, all looked at):

| Measure | Before | After | Target |
|---|---|---|---|
| C1 A / B / C / D at 393×852 (sat 59 and 81), DOM centre and Ø | A at bottom-right from `hg2-btns`, SPRINT Ø62 over the stick, THRU 54, no D | A Ø92 (323, 738), B Ø64 (238, 778), C Ø48 (250, 694), D Ø48 (340, 652): exact | ±2 px |
| C1 at 320×568 | (the 350 px media query) | A Ø84 (266, 510), B Ø56 (190, 536), C Ø44 (200, 468), D Ø44 (282, 436): exact | ±2 px |
| Gaps A–B / A–C / A–D (393; 320) | — | 15.9 / 15.2 / 17.7; 10.3 / 14.2 / 11.7 | 10–18 |
| Stick zone (393; 320) | a fixed 118 px stick | x 0–189, y 383–818; x 0–154, y 256–568 | as V2 |
| Toast line bottom (393; 320) | hint card at sat + 76, over the goal | 618; 404 | 618; 404 |
| Bug top − sat; pause | — | 6 (393), 4 (320); 44×44 | sat + 6; ≥ 44 |
| Right-thumb targets at a free kick | 7 (PASS, SHOOT, 3 BEND) | 4 | ≤ 4 |
| C2 thumb down → stick drawn, p95 over 50 touches (6 presets) | — | 49–69 ms (p50 34–60) | ≤ 100 ms |
| C4 sprint speed kept while SHOOT winds up | 0.68 (the right thumb leaves SPRINT: jog 0.8 × wind-up 0.85) | **0.85** at equal stamina (raw 0.842–0.843: 0.3 s more sprinting drains stamina 0.78 → 0.71) | ≥ 0.85 |
| C5 thumb down 500 ms before the whistle → carrier moving | never (the stick took no thumb before kick-off; it had to be lifted and put down again) | 63–89 ms after the whistle | ≤ 100 ms |
| Pause: a.t over 3 s paused; after RESUME | — | unchanged (0.35 → 0.35); runs on (→ 1.15 after 0.8 s) | stops; runs |
| Toast line over the goal mouth (120 frames per preset) | the hint over the goal (V-3.1) | 0 | 0 |
| Text under 10 px; labels spilling; horizontal overflow | sub-labels 8 px | none; none; 0 px | — |
| Reduced motion | — | A's breathing and the sheet's slide: `animation: none` | none |
| Live hosts reached | — | 0 (every non-localhost request aborted) | 0 |

Also run and green after the change (393 sat 59 and 320): the older lab parts `play`, `buttons`, `bend` (D cycles to Bend left, curl +0.75), `autokick`, `restarts` (selectors updated to the cluster). Solo QUIT: the lab's stub gets `us` (the attacks played) and `them` (7 ends). Online (lab `?online`): the sheet offers FORFEIT and no QUIT, its confirm, and the stub gets the progress. The rival's taker in a shootout: violet ring and tag (screenshot `*-rival-taker.png`).

**Tests** (new): `controls.test.ts` (14: the V2 numbers at 393 and 320, gaps, ≥ 44 px, no button in the stick zone or the top third, 2,000 synthetic touches per preset and phase all in the right zone, tap misread ≤ 2% with a wobbling thumb and swipes never taps, nearest-teammate resolution ≥ 22 px, ≤ 4 targets, D empty in attack, the bend cycle, and the stand-in stick: floating, two axes, release-to-stop, the 1.15/1.0 hysteresis with one edge, the pre-held thumb, one pointer, the ring kept on screen); `hud-layout.test.ts` (6: FBENDICK at 320/375/390/393/430, 400 random tag crowds per width with no overlap and all on screen, the toast keep-out, 16 px chips, the toast line clear of the safe box, the cluster, the bug and the pause button, the Heat slot above the safe box, sideways); `prefs.test.ts` (7: defaults for absent/garbage/old shapes, round trip with unknown fields, a throwing store, and the import graph: prefs.ts imports nothing; engine, autopilot, match, shootout and ratings never reach prefs, controls or v2/); `forfeit.test.ts` (5: padding to TOTAL, 'FF' worth 0 in Arcade's soccer map and labelled in ut, forfeit only from an explicit 'FF', the wire carries no forfeit/box/grade, the wire parser keeps 'FF'); `rules.test.ts` +3 (the lofted through ball flies and is marked; a ground THRU isn't; the autopilot never plays it).

**Golden unchanged** (attacks `0dde30cbc63300`, matches `07f3dde0f40f62`, shootouts `13ebc2208d1307`); agreement green.

**Suite.** `PS_SPORT=soccer npx vitest run soccer sport-branches` (through `heavy.sh`): 17 files, **146/146**, Duration **119.3 s** on the shared machine under load (91.8 s on an earlier run of this task). Default sport, `npx vitest run src/game/soccer2 src/engine/sport-branches src/lib/sound`: 14 files, 130/130 (95.0 s). `npm run typecheck` clean.

**Not done here, and why:**
- The **two-phone forfeit in a browser** (two contexts on the in-process relay through a whole online soccer draft) is not scripted yet: soccer-app.mjs has no online flow. The forfeit path is covered by `forfeit.test.ts` and the lab's sheet; the two-phone run is a follow-up for soccer-10's gate.
- **CONTROLS toggles** (`autoSwitch`, `buttonsOnly`) wait for the features they switch (above).
- ~~**The hosts** (`ut/Match.tsx`, `App.tsx`) don't pass `onQuit` yet, and they settle on score, not the 6th `forfeit` argument.~~ Done in the review fixes below.

### soccer-2 review fixes (2026-11-16)

An independent review of `c239663..d861656` found seven issues. All are fixed on the current HEAD (after soccer-3).

- **(high) A forfeit did not decide the match.** Both hosts settled on the score, so a forfeiter who led (2–0 after three attacks) was recorded as the winner on both phones, and a level forfeit fell to the rating coin flip.
  - **Now:** a forfeit decides it on both sides of the wire.
  - `progress.ts` `awarded(us, them, by)` applies football's rule: the side that forfeits loses **3–0**, or by the score as played when that was already worse for it. Arcade applies it before `onFinish` on both phones, so even a host that ignores the 6th argument records the right winner.
  - Both hosts also read the 6th argument:
    - `ut/Match.tsx`: `finish(…, ff)` gives `d = { won: ff === 'them', tiebreak: false }`.
    - `App.tsx` (the draft play-out): `arcade.forfeit` decides `vsWon`. A rival forfeit records `online.forfeit: 'them'` ("… left"); your own records `'you'` (the field's existing type).
- **(medium) FORFEIT during an online shootout** (all 7 ends in, so nothing could be padded and the phones could disagree).
  - `canForfeit(p, TOTAL)` refuses once every attack is in. Arcade's `forfeitNow` goes through it, and also refuses once `mine.done`.
  - Soccer2 offers QUIT/FORFEIT only while `canLeave` (`!match.over && !shootout && !left`), and `leave()` refuses the same states.
  - The pause button is hidden in a shootout, where it was visible but did nothing.
- **(medium) A false "ALL SQUARE · PENALTIES" after a forfeit** (on the phone that left, and on the phone that received a level forfeit).
  - `leave()` sets a `left` ref. `endMatch`'s shootout branch, the level-score effect and `startShootout` all return when it is set.
  - Arcade passes `rival.forfeit` (an explicit `'FF'` on the rival's record) through `RivalLive`. On the receiving phone the match stops at once with "THEY FORFEIT · YOU WIN" and never starts penalties.
  - The final card says "Forfeit · <rival> wins" or "<rival> forfeits · you win".
- **(medium) Solo QUIT reached only the lab.**
  - Both real hosts now pass `onQuit`: ut `finish(us, them, 'played', undefined, 'us')`, and the draft `finish(…, { forfeit: 'us' })`.
  - Arcade's `quitNow` sends the AI's attacks through the ones you played (not all 7), and the same 3–0 award. So a quit always settles as a loss that ut's cup/league validators accept (they reject `won: false` with `us > them`).
  - Squad Battles therefore records a quit as a loss rather than "no result" (§5.2 said leave with no result). The loss reward (30 coins, 40 XP) is less than the existing instant SIM gives, so a quit cannot be farmed. ut-4 may refine this per mode.
- **(low) Tags pushed down into the cluster.**
  - `layoutLabels` walks every keep-out like a tag: above first, below only when there is no room above.
  - Soccer2 passes the toast/plates and every control (A–D, the stick ghost, the bug, the pause button) as keep-outs.
  - Those rects come from `readFrame` (every 30 frames, after each layout change of the toast/plates/cluster/frame, and on `animationend`), never per frame. The per-frame `querySelector`/`getBoundingClientRect` pair is gone.
- **(low) C4 margin.**
  - **Not changed in physics:** the wind-up multiplier is exactly 0.85 (`engine.ts human()`). Raising it would change the autopilot's runs (`human()` also drives the pilot) and re-base golden for a feel tweak.
  - The criterion is now stated as measured: **≥ 0.85 × sprint top speed at equal stamina** (raw 0.843 because 0.3 s more sprinting drains stamina 0.78 → 0.71; normalised 0.850 on every preset, which is the multiplier itself, not noise).
  - The plan's acceptance line (C4, §4 and §8) should read the same. `docs/studio-overhaul/soccer-plan.md` has a large uncommitted revision in this worktree that is not mine, so I left that file alone: a follow-up for the planner.
- **(low) Polish:**
  - The sheet's eyebrow is "Solo · <rival>" (no more "PAUSED / PAUSED").
  - THRU's sub-label is "LOFT" (it filled the 44–48 px dome).
  - Every cluster button has an `onClick` fallback for assistive tech and keyboard Enter: kick off, pass, through ball, cross, short and bend. It is ignored within 1 s of a pointer down or up, so a touch never fires twice. SHOOT needs the meter, so its keyboard route stays Space.

**Re-checked:**
- **The real hosts, isolated** (`scripts/qa/soccer-app.mjs quit`, new; 393×852 with insets 59/34, `?ns=inspect&relay=ws://localhost:7777`, live hosts aborted, 11 blocked Supabase requests and 0 reached):
  - UT Squad Battles rung 1, played, paused: the sheet shows QUIT MATCH and no FORFEIT. QUIT → result **LOSS 0–3**, `ut.record` l 0 → 1, w unchanged.
  - Draft 1 vs 1 against the AI, played, QUIT → **YOU LOST 0–3**, `history[-1].vs.won === false`.
  - Screenshots are in `O/shots/soccer/soccer-2-fix/`, and I looked at them.
- **`soccer-lab.mjs layout`** on all presets: cluster positions exact, text spill none, toast over the goal 0/121, pause holds `a.t`, the stub QUIT, C4 ratio 0.850 (raw 0.843).
- **Tests:**
  - `forfeit.test.ts` +3: a leading forfeiter loses 0–3 on both phones, a level forfeit is never a coin flip, worse than 3–0 keeps the score, a forfeit after 7 ends is refused, Soccer2's `canLeave`/no-penalties guards, and both hosts' wiring.
  - `hud-layout.test.ts` +1: 300 crowds per preset around the toast line and over D, with no tag under a control and a tag that meets the toast going above it.
- **Suite:** `PS_SPORT=soccer npx vitest run soccer sport-branches` (heavy.sh): 19 files, **168/168** (137 s), golden unchanged, agreement green. `npm run typecheck` clean.
- **Not done:** the two-phone online forfeit in a browser (two contexts on the local relay) is still unscripted (soccer-app.mjs has no online flow); it stays a soccer-10 gate item. The forfeit decision is covered by `forfeit.test.ts` on both phones' sides.

### soccer-2 re-review fixes, second round (2026-11-16)

A re-review of the first round found one high, one medium and four low issues. All are fixed on the current HEAD.

- **(high) A rival forfeit still did not decide the match on the phone that had already finished.**
  - **Cause:** Arcade read `forfeit` from state. The `rivalFF` effect sets that state one commit after the forfeiter's last Progress arrives. In that same render the finish effect saw `them` (now done) with `forfeit === null` and settled on the raw scores. For example, a rival 2–0 up forfeits and this phone, finished 1–x, records a 1–2 loss.
  - **Now:** `progress.ts` `settleInputs({ mine, rivalLive, forfeit, watchFF, … })` is a pure helper. It works out the forfeit in the same render: the state, else this phone's own padded record (`mine.forfeit`), else the rival's explicit `'FF'` ends (`forfeitedBy`, soccer online only).
  - The helper returns `ff`, `us`, `them`, `level` and `final` (with the 3–0 award applied). Arcade settles on `final`, passes `ff` to `onFinish`, and has `ff` in the effect's deps. `forfeitNow` refuses through `ff` (and when the other phone has taken this one over).
  - **Tested** (`forfeit.test.ts` +6), on the helper:
    - The receiver is done when the rival forfeits 2–0 up: 3–0 win, in the very render the forfeit lands, with the state still null.
    - The forfeiter's mirror: its own padded record gives 0–3, also with nothing heard from the rival.
    - A receiver still mid-match: 3–0.
    - A level forfeit never waits for penalties; a level match without one does.
    - `'FF'` is read only where it is watched; a normal finish and a solo match settle on the score.
    - Arcade's wiring.
- **(medium) A solo QUIT paid like a played loss.** It paid 30×pay coins, 40 XP a card, a paid-game slot, 80 Season XP, an objective "game" and Development/Evolution progress. Pause → QUIT at kick-off out-earned a sim.
  - **Now:** a quit settles as a loss that pays nothing.
    - `ut/play.ts` `settle(…, { quit: true })`: 0 coins, 0 card XP, no paid-game slot, and no `recordMatchProgress` (no Season XP, no objective game, no Development or card-stat game).
    - The loss itself stands: `record.l`, the ladder (no climb), and the Cup/Circuit/Season round as a loss, so a quit cannot be used to replay a cup game.
    - `ut/draft-mode.ts` `settleDraft(…, { quit: true })`: the run ends on the loss, with no Season XP.
    - `ut/Match.tsx`: `finish(…, quit)`. `onQuit` passes `true`, and Evolutions get no match.
    - `App.tsx` (the draft play-out): `how: 'sim'`. The draft's rewards come from the season, so a 1 vs 1 quit pays exactly what a played loss does, never more.
  - **§5.2 now matches the code:** in every mode a quit is a loss that pays nothing.
  - **Tested** (new `src/game/soccer2/quit-settle.test.ts`, 2): a quit at 0 attacks records the loss and credits no coins, card XP, Season XP, paid slot, objective game or development, and can't be settled twice; a played loss still pays.
  - **Browser** (`soccer-app.mjs quit`, real hosts, isolated): UT Squad Battles rung 1 QUIT → LOSS 0–3, "+0 coins / +0 XP", `record.l` 0 → 1. Paid slot, card XP, objective games and Season XP are all unchanged (0/42042/0/0 before and after). The draft 1 vs 1 QUIT → `vs.won false`.
- **(low) C4 margin.** The wind-up multiplier in `engine.ts` `human()` goes from 0.85 to **0.87**.
  - The autopilot's stick is still while a meter is up (`autopilot.ts`), so the AI's matches don't move: **golden unchanged** (attacks, matches and shootouts), agreement green.
  - Lab C4 (all six presets): **raw 0.862–0.863** (was 0.843), at equal stamina 0.870. The plan's C4 line stands as written (≥ 0.85 raw).
- **(low) C5 headroom.**
  - The stick reports a resting thumb's push before the whistle (`Stick onHeld`). `kickOffNow` puts it on the carrier on the whistle's own frame, so the first step after the whistle runs with it, not the stick's enable effect a commit later.
  - The lab records the carrier's speed too, and a new `c5` part runs 5 fresh kick-offs per preset:
    - `respondMs`, the first frame with any speed: median **0** on four presets, 13–17 on 375 and 320.
    - `movedMs`, 0.05 m moved (the gate): medians **76–85 ms** (393 sat 59: 80; 390: 78; 430: 83).
  - What is left is the carrier's acceleration from a standstill, not input latency. One run in 30 went past 100 ms (119, at 430). The gate is the median.
- **(low) THRU's "LOFT" read as the tap.** PASS and THRU now share one form: a press-and-hold glyph (an SVG ring and dot) and then what the hold does, "LOB" and "LOFT".
  - The aria labels read "Pass (hold: lob)" and "Thru (hold: loft)".
  - Both fit at 320, where C is 44 px (screenshots `*-cluster.png`).
- **(low) No pause in a shootout.** The pause button shows again for the whole shootout. The sheet still has no QUIT or FORFEIT there (`canLeave`).
  - Lab `layout`, rival-taker step, at 393 and 320: pause during their kick, the sheet reads RESUME / HOW TO PLAY / CONTROLS, and `a.t` holds over 0.8 s.
  - The pause button sits clear of the pen tally (screenshot `*-pens-paused.png`).
- **(low) (a) The stick's keep-out stayed on the ghost.** The stick reports its live ring (`onBase`) when it lands, when it has followed the thumb 8+ px, and when it goes (also on unmount). `readFrame` uses the ring while a thumb is down and the ghost otherwise, and re-reads at once.
  - Lab `c5`, every preset: the thumb lands 40/110 px off the ghost and a keep-out sits on the ring (0–1 px off). After the lift the nearest keep-out is 49–91 px away (back on the ghost).
- **(low) (b) `leave()` committed before the host accepted.** `onQuit`/`onForfeit` now return a boolean (Arcade's `quitNow`/`forfeitNow` return `false` when they refuse). Soccer2 ends the match (final, `left`, timers) only when the host accepts, and otherwise keeps the sheet open and the match on.

**Re-checked:**
- `npm run typecheck` clean.
- `PS_SPORT=soccer npx vitest run soccer sport-branches`: 20 files, **176/176** (116.9 s, heavy.sh); golden unchanged, agreement green.
- Default sport `npx vitest run src/ut src/game/soccer2 src/engine/sport-branches`: 32 files, 262 passed and 9 skipped (the ut settlement suites: match, overhaul, cup-settlement, league, rivals).
- Lab `layout` (all six presets): cluster positions exact, no text under 10 px or spilling, 0 px horizontal overflow, C4 raw 0.862–0.863, single-run C5 `movedMs` 69–90 with `respondMs` 0–22, the stub QUIT, and the shootout pause on both presets. Lab `c5` (above).
- `soccer-app.mjs quit` (above).
- Every context was isolated: 0 live requests reached, and the Supabase requests were blocked.
- Screenshots are in `O/shots/soccer/soccer-2-fix2/`, and I looked at them.

## soccer-3 · Camera at 34 m, the action-safe box, edge arrows, the pitch, render juice, goal moments and Clutch staging

**What changed** (V2 B.3.3, B.3.7, B.0.4, B.0.5, C.1.3, C.2; audit V-1, V-2, V-4, J-2; plan soccer-3). Render only: no engine, AI, rule or rating change.
- **`camera.ts`** (new, pure): the portrait camera. The man on the ball is the lens's anchor (`anchoredCam`): he sits on the axis, so the framing moves the whole picture rigidly up or down (a shift lens) and every framing rule is a plain interval.
  - **Scale and angle:** 34 m across at his row on the 393 phone (32 m at 320, still inside V1's 32–36), looking down at 0.9 rad. The lens is long (half-angle 0.2 rad). The reason is measured: at 32–36 m across, only a long lens keeps the goal mouth ≥ 60 px wide from 30 m out on a 320 px phone.
  - **Follow and look-ahead:** 85% of the ball's x, with a look-ahead of velocity × 0.6 s (at most 6 m) plus 3 m toward the goal.
  - **The framing pass (`frameFor`).** Hard limits:
    - the carrier's feet inside V2's action-safe box (read from the page: a hidden `.sc2-safe` probe on the geometry tokens);
    - the stands at most 12% of the height;
    - inside 30 m (and at every set piece), the whole goal mouth.

    Then it fits, if they still fit: a through ball's man, his two nearest options, and any other teammate ahead of him that a pan of at most 16% of the width brings in. The eased frame is clamped back into the hard limits every frame.
  - **Zoom:** it eases out only for a through ball's man or a corner, at most 15%. It moves in 0.05 steps, at most one step every 0.25 s (≤ 4 changes a second), and cuts straight there under reduced motion. The stoppage attack (Clutch) sits 6% tighter.
  - **Set pieces:** a corner is framed from the flag's side (the taker 22–30 px from his edge, at 40 m across) with the goal line in the upper third. A penalty puts the goal in the upper third.
  - **Landscape** keeps the earlier camera.
- **Sizes (V3):** `ART` makes the sprites larger than the ground scale, so a 1.80 m man under control is 34 px tall at 393 (35 at 320). The sprites are seen at their own 0.6 rad tilt (`SPRITE_TILT`), not the steep 0.9, so they read as before. Every world height (the goal frame and net, the ball's height, the particles) is lifted by the same factor (`heightK`), so a keeper still fits under his crossbar. The sprites' scale is snapped to 2.5 px/m steps, so men at about the same depth share sprite sizes. The ball is ≥ 6 px across with its shadow.
- **The pitch (`render.ts` `PITCH` + `pitchTex`).** One palette the players team can retune under its venue grant:
  - mow stripes `#2e9a4a` / `#288a41` every 5.5 m with a faint checker;
  - lines `#f2fff2` at 85%;
  - a darker run-off;
  - boards behind the goal with an original "PERFECT SEASON" word mark;
  - four floodlight pools baked into the texture;
  - the crowd (touchlines and far stand) in three value bands `#221d36` / `#342d52` / `#4a426e` of 2-texel blocks, with 6% team flecks and 2% white;
  - a cached screen overlay: the night vignette (corners −18%) and the depth haze (top 6% darker and greyer).

  **Floor cache:** the floor is redrawn only when the camera moves by about a pixel. A still camera (set pieces, before the whistle) costs one blit: 1 redraw in 64 frames at a free kick or a penalty.
- **Ground rings (C.1.3):** gold `#f6b93b` 2 px under the man you control (violet for the rival's taker), teal `#4fe3c1` under the pass's man, and a red `#ff5d5d` arc on the defender within 3.5 m of the carrier, facing him. The controlled man's name tag moves over his head when under his feet it would meet a button, the stick, the bug or pause (`ctrlTagSpot`).
- **Edge arrows:** a teal chevron with the man's initial and number ("P7", "N11") on the safe box's edge, pointing at him. Every teammate off the screen, under the bug, or more than 40 px below the box (under the thumbs) gets one. Two never overlap (`placeArrows`). Tapping one passes to him (22 px radius, a 44 px target, checked before the bodies). They have no pulse.
- **Juice (`fx.ts`, new; render only):** through the shared `Juice`.
  - **Hit-stop:** power shot (≥ 24 m/s) 33 ms, goal 66, save 60, woodwork 80. Every stop is clamped to 33–120 ms, a rolling ledger caps them at 150 ms in any second, and under reduced motion each is ≤ 30 ms.
  - **Trauma shake:** goal 0.45, woodwork 0.3, save 0.25, tackle or block 0.15, power shot 0.12.
  - **Slow motion:** one beat an attack, a near miss (the woodwork, or wide or over within 1 m) at 0.4× for 0.6 s, or a goal at 0.35× for 0.5 s (the earlier goal slow-down now respects reduced motion).
  - **The rest:** a 3-frame net bulge, then back over a quarter second; the ball's trail on shots or parries faster than 22 m/s; the post's 1 px shiver for 0.34 s with `sfx.post`.
  - **Reduced motion:** no shake, slow motion, bulge or shiver, the flash ≤ 30% and plates without their pop.

  Hit-stop and slow motion only hold back the real time fed to the fixed-step accumulator. A pause shifts them (`fx.shift`).
- **Goal moments (both sides):**
  - **Ours:** a teal plate in the toast line, "MESSI 45' · 1ST OF THE MATCH".
  - **Theirs:** a violet plate "RMA SCORE 45' · 1–1", `sfx.scoreThem()` and a violet pulse round the bug. A layout effect fires them in the same paint as the new score.
  - When both land together (the rival's attack is revealed as yours ends), the newer plate sits on the line and the other just above it.
- **Clutch staging on the stoppage attack** (rules unchanged):
  - the bug turns gold and reads CLUTCH;
  - the camera sits 6% tighter;
  - the crowd bed sits 0.1 higher;
  - at a margin of one goal or none, the heartbeat haptic (two ticks 120 ms apart, at most every 1.2 s, played inside the player's own touches: `v2/haptics.ts heartbeat()`);
  - the toast line says "FOR THE WIN" (level) or "TO TIE IT" (one down) before the whistle and during the attack;
  - a goal in Clutch always replays, the final whistle's included. That replay is shorter (2.3 s of play, starting 0.7 s after the goal), and none plays under reduced motion.
- **`ps:arena-ready`** is dispatched on `window` once per match (`detail: { sport: 'soccer' }`), after the first frame drawn with the pitch and the players.

**Before → after.** `scripts/soccer/cam.ts`, the real `camera.ts` on the V2 safe box. Before is the old replica at 390×844 and 320×568 with the audit's HUD rects.

| V1, kick-off | Before (390×844) | After, 393×852 sat 59 (sat 81, 390×844, 430×932 the same) | After, 375×667 / 320×568 | Target |
|---|---|---|---|---|
| Metres across at the carrier's row | 16.9 (corner 41.6) | 34.0 (corner 40.0) | 33.5 / 32.0 (corner 39.4 / 37.6) | 32–36 |
| Carrier in the safe box | wide off-screen (x −36 / 426) | 100% of 12 kick-offs (6 scenarios × 2 mirrors) | 100% | 100% |
| Teammates on screen: build / counter / wide / corner / FK | 1/5, 0/3, 1/5, 3/5, 4/4 | 3/5, 2/3, 4/5, 4/5, 4/4 | 3/5, 2/3, 4/5 (320: 3/5), 4/5 (320: **3/5**), 4/4 | ≥ 3, 2, 3, 4, 4 |
| Stands (share of the height) | 37% near goal (audit V-2) | ≤ 12.0% | ≤ 12.0% | ≤ 12% |
| Goal mouth inside 30 m: FK / penalty | 81 / 94 px (16 m across) | 73 / 77 px | 70 / 75; 62 / 67 px | ≥ 60 px |
| Corner taker | 17 px at x = 17 | 27 px at x = 22, goal line y 150 (H/3 = 284) | 27 px at x 16 / 30 | ≥ 22 px, x in [20, W − 20], goal in the upper third |

| V2, mid-attack, 200 real-squad autopilot attacks per scenario | Before (390×844): on screen / clear of the controls | After, all six presets: carrier in the safe box | Goal fully in frame inside 25 m | Zoom changes/s | Name tag over a control |
|---|---|---|---|---|---|
| Build | 76.7% / 75.4% | 100.0% | 99.9% | 0.01–0.05 | 0% |
| Counter | 84.6% / 83.5% | 100.0% | 99.9–100% | 0.01 | 0% |
| Wide | 74.5% / 73.8% | 100.0% | 100.0% | 0.01–0.02 | 0% |
| Corner | 70.4% / 70.4% | 100.0% | 99.4–99.5% | 0.81 | 0% |
| Free kick | 79.7% / 72.3% | 100.0% | 99.9% | 0.02 | 0% |
| Target | | ≥ 98% | ≥ 95% | ≤ 4 | 0% |

(The stands stay ≤ 12.0% in every mid-attack frame on every preset.)

**V3, measured in the browser** (the drawn sprite's head-to-feet height, lab `qa`, `stats.ctrlPx`):
- Controlled man at 393: 33–36 px in open play and at set pieces; 30 px for the free-kick taker once play moves on.
- At 320: 30–35 px.
- The corner taker at 40 m across: 26–27 px.
- Smallest man on screen (harness): 25 px at 393.
- Ball: 8 px (6 px at a corner), with its shadow.

**Frame pacing** (dev lab, autopilot, 393×852 at DPR 3, isolated; `O/scratchpad/s3/perf.cjs`). The shared machine was at a load average of 7–11 on 4 CPUs for every run, so only runs side by side compare. The baseline is this task's starting files (HEAD `d861656`) with a stale counter added, run in the same minute:

| 4× CPU | fps | p99 ms | Longest long task | Stale sprite draws |
|---|---|---|---|---|
| Baseline (HEAD), load 11 | 50.5 | 66.6 | 118 ms | 7.25% |
| After, first cut, load 7.5 | 41.5 | 99.9 | 105 ms | 9.7% |
| After (scale snapped to steps, three new sprites a frame after a long frame), load 9.5 | **46.5** | 66.7 | 99 ms | 11.8% |
| The 2026-11-09 audit, idle machine | 59 | 33.3 | — | — |

At 6×: baseline 35.6 fps, after 32.5. Floor redraws fell from every frame to about half the frames in open play, and to 1 in 64 at a still set piece.
- **The cost is the sprites, not the camera or the pitch.** V3's sizes put every man on screen at 30–45 px, where the players' LOD gives 16 facings and every second clip frame (before, far men were under 22 px: 8 facings, every third frame). So more new sprites are needed each frame than the build budget allows.
- **Not met here:** fps ≥ 58, p99 ≤ 33.4 ms and stale ≤ 1%. They need the players team's LOD at V2 sizes (followup below), and an idle machine to measure on.
- **Met:** no long task > 200 ms.

**Tests** (new):
- `camera.test.ts` (12 tests, about 2 s):
  - V1 on the six presets: width, carrier in the box, stands, goal ≥ 60 px inside 30 m, teammates (the 320 corner held at 3/5), the corner taker's place and size, and the goal line in the upper third at corners and penalties;
  - V3 sizes (34 ± 2 at 393, ≥ 30 at 320, far men ≥ 22, ball ≥ 5);
  - every hidden teammate has an arrow, inside the box, none overlapping;
  - the corner zoom;
  - V2 over 6 attack pairs × 5 scenarios at 393 and 320 (≥ 98% in the box, ≥ 95% goal in frame, ≤ 4 zoom changes/s, no tag over a control, stands ≤ 12%).
- `juice-soccer.test.ts` (6 tests):
  - 24 seeded attacks (6 scenarios × 4 seeds, a quarter in stoppage time with Clutch's camera) through an app-like loop with uneven 8–34 ms frames, `SoccerFx` hit-stop, shake and slow motion and `camStep` every frame end identically, to the 4th decimal, to plain stepping, with and without reduced motion;
  - each hit-stop's length and the 33–120 ms range;
  - the 150 ms-a-second cap over 400 requests;
  - the reduced-motion clamps;
  - slow motion once per attack, and a pause shifting it;
  - the event-to-moment map.
- `camera.test-util.ts` holds the measuring maths for the tests and `scripts/soccer/cam.ts` (rewritten: it calls the real camera, with no replica).

**Golden unchanged** (attacks `0dde30cbc63300`, matches `07f3dde0f40f62`, shootouts `13ebc2208d1307`); agreement green.

**Suite.** `PS_SPORT=soccer npx vitest run soccer sport-branches` (through `heavy.sh`): 19 files, **164/164**, Duration **138.6 s** at a load of about 10. That is over the 120 s cap. The two agreement files took 77 s and 53 s of it, and the new files add about 10 s. After that run the camera test's V2 sample was cut from 10 to 6 pairs. `npm run typecheck` clean.

**Browser QA** (dev server 5217, touch, every context isolated: 0 requests to live hosts; screenshots in `O/shots/soccer/soccer-3/`, all looked at):
- `final-*`: every scenario before the whistle and mid-attack at 393×852 sat 59, sat 81 and 320×568.
- `moment-*`: our plate and the rival's, stacked; the Clutch bug with "FOR THE WIN"; the replay; the same at 320 with reduced motion.
- `t1`/`t2`/`v3`: calibration.

The rival's plate appeared in the same mutation as the bug's new score (**0 ms**; F5 ≤ 200 ms). `ps:arena-ready` fired about 0.5 s after the lab mounted. A whole lab match with Clutch, two goals each, the replay and a shootout ran with no page errors.

**Seen and judged:**
- **The steep 34 m view shows about 65 m of pitch top to bottom,** so a corner leaves the lower half of the screen as empty grass under the box. That follows from V2's numbers (34 m across, stands ≤ 12%, the goal line in the upper third).
- **The 12% stands cap overrides C.5's "stands about 30–40% of the height"** (the acceptance governs).
- **The pitch is less dramatic in depth than `mockups-v2`'s soccer cell:** a long lens is the price of the 60 px goal mouth at 320.

**Protocol:** none (render only; golden unchanged).

### soccer-3 review fixes (2026-11-16)

An independent review of `d861656..bc9ea0e` found two high, one medium and three low issues. All six are fixed on the current HEAD (after soccer-4), except the corner width, where a waiver is needed (see below). Render and camera only: golden unchanged, no protocol change.

- **(high) The camera hard-cut on every pass.** The anchor was the subject's body. On a pass the subject became the receiver, so the receiver was drawn in one frame where the passer had been.
  - **Now:** the lens's anchor is a ground point (`CamState.gx/gy`) that glides after the man on the ball. It eases 20% a frame, at most 1.2 m a frame, and is never cut. Each frame the anchor's screen spot is re-expressed through last frame's camera, so moving the anchor does not move the picture.
  - The hard limits (carrier in the safe box, stands ≤ 12%, goal mouth inside 30 m) now pull the frame in at ≤ 14 px a frame instead of snapping. The whole picture moves ≤ 15 px a frame. The stands' 12% still holds every frame.
  - A zoom step scales about the screen's middle, not the anchor.
  - `CamState.subj/switches` count the subject changes the frame glided over.
  - **Measured** (`scripts/soccer/cam.ts` motion column, new; and a before/after probe through the HEAD and new `camStep`: 40 real-squad autopilot attacks × 5 scenarios, 65k frames, 421 subject switches):

    | Per-frame screen motion of fixed pitch points | 393×852 before | after | 320×568 before | after |
    |---|---|---|---|---|
    | p50 | 0.7 px | 0.6 | 0.8 | 0.6 |
    | p99 | 10.5 | 11.6 | 8.5 | 9.1 |
    | p99.9 | **232.0** | **16.0** | **198.4** | **14.0** |
    | max | 325.6 | 22.6 | 275.7 | 17.4 |
    | On a subject switch: median / max | 135.7 / 325.6 | **8.6 / 17.8** | 115.5 / 275.7 | **7.4 / 17.4** |

  - `cam.ts 60`, every preset, mid-attack: motion p99.9 7.8–19.4 px, max 9.7–26.7 px (the max is a corner's zoom step). The carrier is in the safe box in **99.2–100%** of frames (it was 100% by construction, because he was the clamped anchor). The misses are the glide just after a pass: about 0.2 s while the frame pulls the receiver in. The goal is fully in frame inside 25 m in 99.9–100% of frames. Zoom changes are ≤ 1.31 a second, the stands ≤ 12.0% and tags over a control 0%.
  - `camera.test.ts` V2 now asserts at 393 and 320 that the camera glided over at least one switch, the fixed points' motion p99.9 ≤ 20 px and max ≤ 30 px.
- **(high) Frame pacing was worse than the baseline.**
  - **The floor is reused while the picture only shifts.** It is drawn into a canvas 24 px wider and 72 px taller on each side than the screen. `floorShift(c0, c1)` (pure, tested) projects a grid of ground points and the far stand through the old and new cameras. While one whole-pixel offset matches everything to within 1.5 px (under a texel of the half-resolution floor), the floor is blitted at that offset. Otherwise it is redrawn; just after a redraw 2.5 px is allowed, so it is redrawn at most every other frame. The shift lens's row is a pure vertical blit.
  - **The sprite budget stays at 5,** with 12 before the whistle so the line-up's sprites are built while nothing moves.
  - **A man more than 15 m from the ball is drawn at the cheaper detail:** 8 facings, every third clip frame, sizes in 4 px steps instead of 2.
  - **Measured** (`perf.cjs`, dev lab autopilot at 393×852 DPR 3, 10 s per run, isolated, run back to back at a load of 4–8 on 4 CPUs; floor redraws are out of all draws):

    | Run | 4× fps / p99 / longest task | 6× fps / p99 / longest task | Stale sprites 4× / 6× | Floor redraws 4× / 6× |
    |---|---|---|---|---|
    | Baseline `d861656` (twice) | 57.3 / 33.4 / 73 ms; 58.6 / 33.4 / 53 ms | 51.4 / 50.1 / 87; 53.8 / 50.0 / 60 | (no counter) | (every camera move) |
    | HEAD `c15e435` (twice) | 58.0 / 33.4 / 85; 57.0 / 33.4 / 139 | 44.3 / 66.7 / 111; 42.8 / 83.4 / 122 | 3.3% / 12.8%; 3.7% / 14.9% | 50% / 44% |
    | Fixed, at 1 px (twice) | 58.3 / 33.3 / none; 56.6 / 50.1 / 107 | 49.2 / 66.7 / 80; 41.1 / 99.9 / 139 (load 6.8) | 2.4% / 4.2%; 2.8% / 6.6% | 28% / 27% |
    | Fixed with the 4 px far sizes (twice) | 58.1 / 33.4 / 80; 55.7 / 50.0 / 88 (load 8.4) | 53.9 / 50.0 / 84; 46.5 / 66.7 / 111 | **2.1% / 3.2%**; 2.6% / 5.2% | 28% / 26% |

    | **Final** (4 px far sizes and the 1.5 px floor tolerance; three runs, load 4.5–6.5) | **58.0 / 33.4 / 113; 58.2 / 33.4 / 60; 58.9 / 33.3 / none** | **51.1 / 50.1 / 88; 53.3 / 50.0 / 77; 54.5 / 50.0 / 73** | **2.4% / 3.8%; 2.1% / 3.7%; 2.0% / 3.5%** | **23–24% / 22–24%** |

    Over the same autopilot attacks offline, the 1.5 px tolerance cuts floor redraws from 41.7% (1 px) to 33.9% of live frames. (The lab's share is lower because it includes the still frames before each whistle.)
  - **Met:** "not worse than the baseline": the final build's 4× runs (58.0–58.9 fps, p99 33.3–33.4 ms) match `d861656`'s (57.3–58.6, 33.4), and at 6× it is at the baseline's level (51.1–54.5 fps vs 51.4–53.8, p99 50 ms both). No long task over 200 ms in any run (longest 113 ms). The floor is redrawn about half as often as at HEAD. Stale draws are 2.0–2.4% at 4× and 3.5–3.8% at 6×, against HEAD's 3.3–3.7% and 12.8–14.9%.
  - **Not met on this machine:** stale ≤ 1%, and fps ≥ 58 with p99 ≤ 33.4 at 6×. 6× swings ±6 fps between identical runs here. The rest of the stale draws come from new attacks (the kits swap, so every man's sprites are new) and from running clips at V2's 30–45 px sizes. The players team's LOD at V2 sizes is the follow-up (below). A measurement on an idle machine is part of the soccer-10 gate.
  - One earlier batch of these runs was thrown out: `kill` on `npx`'s PID left its vite child serving the baseline tree on 5217, so every run measured the baseline. The runner now starts `node_modules/.bin/vite` itself and prints the server's working directory.
- **(medium) Corner framing.** The relaxed asserts are gone. `camera.test.ts` again asks at a corner on every preset, both mirrors:
  - 4 of 5 teammates on screen;
  - the taker 20 px or more inside his edge, ≥ 22 px tall;
  - the whole goal mouth on screen;
  - the goal line in the upper third.
  - **Now:** `cornerZoom` picks the tightest zoom step (from 1 out to 0.75) at which the taker stands 20 px inside his edge, the whole goal mouth is on screen and at least four of his five box men are too. The box's men and the mouth may use the whole screen across (the HUD's sides don't matter at a dead ball). The goal line goes as low as the stands' 12% allows.
  - **Kick-off frames (`cam.ts`):**

    | | 393 / 393 sat 81 / 430 | 390×844 | 375×667 | 320×568 |
    |---|---|---|---|---|
    | Zoom, metres across at the flag's row | 0.80, 40.0 m | 0.75, 42.4 m | 0.75, 41.9 m | 0.75, 42.7 m |
    | Taker x (mirror) | 20 (373); 430: 22 (408) | 21 (369) | 22 (353) | 22 (298) |
    | Taker height | 27 px | 27 | 27 | 23 |
    | Mates on screen | 4/5 | 5/5 | 4/5 | 4/5 |
    | Goal mouth | all on screen, 72 / 78 px | all, 67 | all, 65 | all, 55 |
    | Goal line y (H/3) | 150 (284); 164 (311) | 146 | 123 | 105 (189) |

    Before, the taker was at x = 16 at 320 and 375, the mouth was cut on the mirrored corner at 393, 430, 375 and 320, and only 3/5 teammates were on screen at 320.
  - **Waiver needed (for the lead or planner to sign off): 32–36 m across at the corner.**
    - The taker stands at the flag, on the goal line. The far post is on the same row, 37.7 m from that flag (`GX + GHALF`).
    - With the taker 20 px inside his edge and the far post on screen, that row must show at least 37.7 × W / (W − 22) ≈ **40 m** at 393.
    - So V1's 32–36 m, its taker x in [20, W − 20] and the full goal mouth the review asks for cannot all hold at once. The build keeps the taker, the mouth and 4/5 men, and lets the width go to 40–42.7 m.
    - The review's alternative (the near post at 0.35 W with the taker at x ≥ 20) needs about 100 m across.
    - **The goal line cannot drop to 0.3 H.** The far stand's base sits a fixed 48 px (at 393) above the goal line at this scale and tilt. With the stands at ≤ 12% of H, the goal line is at most at y 150. The lower ~55% of a corner frame is grass, by V2's own numbers. In the screenshots the box now spans the width with no crushed tags.
    - `docs/studio-overhaul/soccer-plan.md` holds an uncommitted revision that is not mine, so the waiver is recorded here for the planner to carry into V1.
- **(low) Edge arrows and name tags.**
  - The arrows are placed before the label pass, and their chevron and chip rects are keep-outs (`arrowRects`), so no tag prints over a chip. They are painted after the tags.
  - A man who has an arrow gets no name tag (the pass target's included), so NEYMAR is no longer clamped next to N11.
  - "Under the thumbs" now means only a man whose body is under one of `frameInfo.controls` (the buttons and the stick), or below the screen. A man in plain view under the box gets none (the mid-pitch "B5").
  - Tests: `camera.test.ts` checks that every arrowed man is off the screen, above the box or under a control, and that tags placed against an arrow's keep-outs never meet them.
- **(low) A goal plate hid the toast line.**
  - The plates now stack just above the toast line (`.sc2-plates.over`, 6 px gap) instead of replacing it, so a set piece's "AUTO KICK · in N" countdown stays up when the rival scores.
  - Our plate is up 2.4 s, under the 2.5 s gap to the next attack's intro.
  - The label pass's keep-outs re-measure when the toast appears under a plate.
- **(low) The word mark on the boards was garbled.**
  - The boards behind the goal line now stand upright: a strip drawn once (F35 letters, one texel per letter pixel) and blitted as a rectangle 0.9 m tall (lifted like the goal frame) at PL + 4.8 m. The camera never yaws, so that rectangle is exact.
  - The texture under them is only their dark footing.
  - "PERFECT SEASON" reads in open play at 393 and 320 (screenshots below).

**Re-checked:**
- `PS_SPORT=soccer npx vitest run soccer sport-branches` (heavy.sh): 26 files, **208/208**, 141 s at a load of about 6 (the two agreement files 61 s and 83 s of it). Golden and agreement green. `npm run typecheck` clean.
- `camera.test.ts` 16 tests (+4: floor reuse ×3, arrow keep-outs).
- **Browser** (dev 5217, touch, isolated, 0 requests to live hosts; `O/shots/soccer/soccer-3-fix/`, all looked at):
  - `fix-*`: corner, build and free kick, before the whistle and mid-attack, at 393×852 sat 59, 375×667 and 320×568;
  - `plates-*`: a goal plate stacked above a set piece's countdown at 393 and 320 (plate y 556–584, toast 590–618 at 393; no overlap).
- Probes: `O/scratchpad/s3fix/motion.ts` (before/after motion), `floorsim.ts` (redraw rate by tolerance), `perfrun.sh`/`perfall.sh`/`perfab.sh` (pacing), `plates.mjs`.

## soccer-4 · The gold ring on SHOOT, fitted to real conversion

**What changed** (V2 B.0.1, B.3.5, B.3.8; audit B-4, AI-1; plan soccer-4). Engine, AI and ratings change, so this rides the soccer protocol bump (below). Details of the model are in `docs/SOCCER-ENGINE.md` ("Studio overhaul soccer-4").

- **The ring** (`engine.ts` `RING`, `shotRing`, `windup`; the stand-in `v2/perfect.ts` for nba's `perfect.ts`):
  - **Wind-up:** `meter.top = windup(d)`: 0.35 s at 11 m or nearer, rising linearly to 0.62 s at 25 m (it was 0.62 s everywhere).
  - **Window:** `greenHalf(SHO)` (18 → 66 ms; SHO 70 39 ms, 95 62 ms) × openness (0.85 at 2 m → 1.1 from 7 m clear) × sprint 0.88 × first time 0.9 × the defence's sharpness, through `windowScale` (product capped ×1.45 / 90 ms, then the **±30 ms floor**).
  - **States**, recomputed after every step while SHOOT is held and again at the release: **red** beyond `maxRange` = lerp(24, 34, SHO) ("TOO FAR"); **amber** with a defender within 2 m ("PRESSURE"), a first-time hit turning the ball more than 90° ("ACROSS YOUR BODY"), a header from beyond 8 m, or from wider than 0.8 rad inside 12 m ("TIGHT ANGLE"); else **gold**.
  - **Gold never lies:** a release inside the window on a gold ring is solved by `exactShot` (the real 60 Hz ball: drag, curl, dip, bounces) to cross the line on the reticle, and solved again at the strike from wherever the ball is then (he ran on during the swing, or a first-time ball dropped). No cone, no timing rise. The keeper can still save it. Amber and red use the cone; red gets nothing from good timing.
- **Touch timing (G5):** Soccer2 records SHOOT's `PointerEvent.timeStamp` (the key's for Space), and on the release passes `holdOf(press, release, deviceLagMs(), timeScale)` (`controls.ts`) to `releaseShoot(a, aim, 0, held)`. `RELEASE_LAG` is gone. The engine never reads a timestamp. The autopilot keeps its seeded release noise, aimed at `meter.top`, judged by the same window, so the AI has PERFECTs too (`a.perfects`, for soccer-7's Heat).
- **Feedback (G6):** over the last 200 ms before the gold, `sfx.ringTick(0..3)`. On a person's gold release, from the same pointer handler: the toast reads "PERFECT · on the gold" ("PERFECT · 3 IN A ROW" on a streak; a gold plate that pops, colour only under reduced motion: `soccer2-ring.css`), `sfx.perfect(streak)` (+1 semitone a PERFECT, to +4) and `haptic('double')`. Otherwise the word and what kept it from gold ("GOOD · PRESSURE", "LATE · TOO FAR"). While SHOOT is held the toast names the dial only when the ring can't be gold ("PRESSURE · no gold with a man on you", "TOO FAR · get closer for gold"). The old big "PERFECT!" pop is gone.
- **The ring on screen** (`render.ts` `meter`): a flattened ring on the grass round the shooter's feet and the arc over his head, both filling to the gold, in gold, amber or red, with the word over the arc (GOLD / PRESSURE / TOO FAR / …) and, after the release, PERFECT / GOOD / EARLY / LATE. `drawRing` keeps the gold band ≥ 8 px by stretching the ring's time scale around it (never the window). The reticle's cone ring is capped at the goal's half-width (a red ring's cone from 33 m used to circle the whole screen).
- **The fit** (revision 2's soccer-4):
  - `RANGE_CONE` ×1 / 1.6 / 2.4 / 3.2 / 4.3 at 11 / 16.5 / 20 / 25 / 30 m; `CONTEXT` pressure 1.35, tight angle 1.5, headers 2 beyond 8 m (1.4 inside), volleys 1.3; `CONE_SCALE` 2.1 on every release that isn't gold (before, 53% of shots were on target; real 34.5%).
  - `firstTimeMult` ×1 → 1.2 at 90° → 1.6 at 135°+, on first-time shots and on passes played within 0.35 s of a control (`a.recv`).
  - **Blocks** (`BLOCK`): 0.35 m of body plus a lunge of up to 1.2 m at 6 m/s from 0.08 s after the strike, low balls only, weaker at full stretch (`Body.slide`); `blockChance` 0.42 → 0.80 (0.25 → 0.62).
  - **The keeper** (`KEEPER`, `KEEP`): ratings narrowed round 75 (a 93 concedes about 0.7× a 75, research §7.5); from 18 m+ 0.15 m more reach and reaction ×0.85; one read and one dive a shot (a new strike drops the old read); a one-on-one race only when he gets to the next touch first (`'rush'`), else he comes out on the bisector to narrow it and spreads when struck within 11 m of him off his line; he sets for the receiver of a ball into the box (no pull to the near post); a cross he calls for (`a.claimFor`) his defenders leave to him and he takes it through the crowd; split step `keeperSet` ≥ 4 frames before every strike; parries steered by HAN (`lastShot.parried`).
  - **B-4:** the assist aims 80% of the way out to the finest spot his accuracy allows (`ASSIST.share`).
  - **The autopilot** (`SHOOTING`): shoots from up to lerp(18, 28, SHO) m, never red; beyond 20 m only through a lane clear by 1.6 m and half as eagerly; with a body in the lane still from inside 22 m.
  - Set pieces: the free kick's and corner header's cones divided by `CONE_SCALE` so their misses are unchanged; the penalty's gold ×0.8 (a gold penalty is exact). Their fit is soccer-7's.
- **`xg.ts`** (display and box data; never read by the engine): real conversion by distance, foot and head, central/wide, penalties 0.76, direct free kicks 0.064, from StatsBomb Open Data (CC BY-SA 4.0, `docs/CREDITS.md`). Soccer2 fills `lastShot.xg` for the read-out.
- **`soccerFeedback`** (`play-feedback.ts`): the next-step lines TOO FAR, PRESSURE, BLOCKED, FIRST TIME ACROSS YOUR BODY, KEEPER CLAIM, PARRIED WIDE; facts Ring ("Gold", "Amber · Pressure", "Red · Too far") and xG.
- **§5.5 fields** (render only, written from geometry, never read, no random number drawn): `kickFoot`, `passKind` (now also `shot`, `header`, `pen`, `fk`), `shotKind` (placed/power), `power`, `contact` (foot/head/volley), `diveHeight`, `keeperSet`, `slide`.
- **Lab:** `sho=N` (our outfielders' SHO) and `gk=N` (their keeper). QA part `ring` in `scripts/qa/soccer-lab.mjs`.
- **Harnesses:** `sim.ts` prints, per distance band, the gold share, gold → goal, on target, blocked and goals per on-target, the S2 keeper row by yards and the rings at the release. Every harness holds SHOOT for `a.meter.top`; `bend.ts` lets go just off the gold (a gold kick lands on its aim with the bend solved in): Bend left / straight / right end −2.58 / −0.16 / +2.36 m from the aim (soccer-1: −2.54 / −0.07 / +2.50).

**Before → after** (same seeds; before = HEAD `3762287`, measured in a detached copy of it).

`sim.ts 400 pro` (real club-season elevens, AI vs AI):

| Measure | Before | After | Target (plan) |
|---|---|---|---|
| Goals/match; draws; 0–0 | 2.12; 25.3%; 9.8% | **1.15; 43.3%; 32.5%** | soccer-7: 2.4–2.7; 22–29%; 4–10% |
| Shots/side | 5.42 | 5.54 | soccer-7: 9–13 |
| On target | 53.4% | **40.7%** | interim 32–42% ✓ |
| Goals/shot | 19.5% | **10.4%** | 9–14% ✓ |
| Save% of on target | 63.5% | 74.5% | interim 64–72% ✗ (+2.5) |
| Blocked | 11.6% | 12.4% | interim ≥ 18% ✗ |
| Woodwork | 4.4% | 1.7% | 2–4% ✗ (−0.3) |
| Shots from 16.5 m+ (open play) | 29.4% | 38.1% | A8 25–35% (soccer-7) |
| Attack ends G/S/W/B/L/O/T | 15.1/12.5/23.1/9.0/37.3/3.0/0.0 | 8.2/10.0/31.8/9.9/36.9/3.0/0.3 | — |

S1, conversion by distance (open play):

| Band | 0–6 m | 6–11 m | 11–16.5 m | 16.5–22 m | 22–30 m | 30 m+ |
|---|---|---|---|---|---|---|
| Before | 45.9% | 36.3% | 22.6% | 15.6% | 5.4% | 4.7% |
| **After** | 34.1% (n 44) | **23.6%** | **13.5%** | **5.8%** | 0.9% (n 108) | **0.0%** |
| Target (H) | 35–55 | 18–32 | 8–15 | 4–8 | 1.5–4 | ≤ 1.5, monotone |
| Gold share; gold → goal | — | 12.8%; 66.7% | 13.9%; 41.6% | 11.7%; 18.5% | 13.0%; 0% | 7.6%; 0% |

Monotone. 0–6 m sits 0.9 points under its band and 22–30 m 0.6 under (small n). Rings at the AI's open-play releases: amber/pressure 1,902, gold 961, amber/header 626, amber/angle 71, amber/first 23, red 4.

S2, the keeper's goals per on-target shot by yards (< 6 / 6–12 / 12–18 / 18–25 / > 25): **50.0% (n 16) / 50.8% / 30.4% / 17.9% / 2.8%** against 70–80 / 45–55 / 30–40 / 18–25 / 8–12. The middle three are in (18–25 by 0.1 short); point-blank and long range are not (long range is mostly free kicks, soccer-7).

`scripts/audit_soccer_shots.ts 200` (75 v 75, a person with timing sd 0.06 s):

| Row | Before | After | Target |
|---|---|---|---|
| 1v1 12–16 m, drag (S6) | 63.0% | 66.5% | 35–45% ✗ |
| 1v1, timing sd 0 / 0.03 / 0.06 / 0.1 / 0.15 | 75.5 / 68.5 / 60 / 55 / 43% | 99.5 / 88.5 / 65.5 / 47 / 37.5% | timing matters more ✓ |
| 1v1 SHO 95 vs GK 75; SHO 75 vs GK 93 | 67.0%; 28.5% | 86.0%; 59.5% | 50–58; 25–32 ✗ |
| Edge 18–21 m, drag | 45.0% | **15.5%** | 12–18% ✓ |
| Edge by GK 52 / 75 / 93 | 59.5 / 43 / 16.5% | 15.5 / 11.5 / 8.5% | monotone ✓ |
| Autopilot per scenario (build / counter / wide / corner) | 10.9 / 15.9 / 14.9 / 11.4% | 6.5 / 10.4 / 11.9 / 4.5% | — |

`human.ts 200` (defIQ 0):

| Row | Before | After | Target |
|---|---|---|---|
| P2: beeline, SHOOT pressed at 30 m (build / counter / wide) | 14.0 / 17.0 / 13.5% | 7.5 / 13.0 / 7.5% | ≤ 2% ✗ (he sprints on through the 0.62 s wind-up, so he strikes from about 25 m) |
| S8: 20 m drag to the corner vs assist (build / counter / wide) | 20.0 vs 20.5 / 39.5 vs 45.0 / 23.5 vs 24.0 | **11.0 vs 4.5 / 37.5 vs 23.0** / 16.0 vs 15.0 | gold ≥ assist + 5 ✓✓✗; assist ≥ 70% of gold ✗ |
| B-1 counter beeline at 16 m (assist) vs Pro autopilot | 60.5% vs 18.5% | 27.5% vs 5.0% | soccer-5 |
| Penalty low corner / high corner / centre; autopilot | 84.5 / 76.0 / 35.5; 77.0% | 73.0 / 60.5 / 39.0; 72.5% | S12 80–88 / ≤ 40 (soccer-7) |
| Free kick far top + BEND toward goal / no bend / near low; autopilot | 3.5 / 2.5 / 2.0; 7.5% | 10.0 / 15.5 / 1.0; 10.0% | S11 skilled 6–9% (soccer-7) |

`probe.ts 3000`: frozen balls 0; attacks over the clock + 15 s **0**; goals straight from a parry **0 of 219 (0.0%)** (S10 ≤ 1% ✓); after a rebound 29.7%; parries 487; a dead loose ball for 5 s+ 3 of 3,000 (0.10%, 0 before; all ended inside the clock).

**G1–G6** (unit tests and the browser, below):
- **G1:** every half-window ≥ 30 ms over 1,620 grid points (SHO 1–110, 6–30 m, a man at 0.5–9 m, defIQ −0.5/0/1, sprinting or not); the gold band drawn 8.0 px at 320 and 393 (arc and ground ring), measured in the browser (`stats.goldArc` 8.000000008).
- **G2a:** 1,000 seeded gold releases (open play from 7–27 m, a third running on through the swing, a tenth free kicks with random bend) with the keeper and blockers out of it: **100% within 0.25 m** of the reticle (worst < 0.01 m: the solver stops at 4 mm).
- **G2b:** no gold with a man at 0.6/1.2/1.9 m, past `maxRange` (SHO 40/70/99), on a cut-back turned more than 90° first time, or a header from beyond 8 m; and over 120 autopilot attacks, no gold ring ever showed with a man within 2 m or out of range.
- **G3:** SHO 95's window at 16 m is 1.58× SHO 70's.
- **G4:** `windup` exact over 11–25 m and clamped outside; `pressShoot` sets it from the shooter's distance.
- **G5:** 400 synthetic press/release pairs at random sub-frame times judged within 1 ms; 40 engine releases between frames land to the millisecond. Browser (CDP touch): the engine's offset equals the one from the page's own `pointerdown`/`pointerup` timestamps less 30 ms to 1e-10 ms (393: +105.05 ms both ways; 320: +59.35 ms).
- **G6:** browser, 320×568: the `sc2-perfect` mark, the toast's "PERFECT · on the gold", the double haptic (`navigator.vibrate([12, 40, 12])`) and the chime's oscillators all between the same two animation frames (frame 54 of 54). The +1 semitone a streak, capped at +4, is `sound-perfect.test.ts` (soccer-1).

**Tests** (new): `perfect-soccer.test.ts` (13: G1, G2a, G2b ×3, G3, G4 ×2, G5 ×3, On Fire, a gold shot at the keeper is saved); `first-time.test.ts` (2: S9 exact; a 180° first-time pass strays 1.6 ± 0.1× a settled one); `keeper.test.ts` (5: one dive a shot, the split step ≥ 4 frames before every strike, lost races ≤ 28% (S3); claims ≥ 70% of the crosses he calls for; GK 93 concedes 0.62–0.92× a GK 75 (S5); the far-post first-time finish (S4); HAN steers parries wide (S10)); `xg-bands.test.ts` (2: xG monotone and real; drilled conversion falling with distance, long range rare (S1 guard)); `render-fields.test.ts` (2: the §5.5 fields scribbled every step change nothing over 48 attacks, and are all written in play; the engine imports no `appearance*`, no HUD, sound or render, and from `v2/` only `perfect.ts`); `src/game/play-feedback-soccer.test.ts` (4: the new lines and facts).

**Old tests changed, and why:**
- `soccer.test.ts`, `shooting.test.ts`, `rules.test.ts`: held SHOOT for the constant `TOP` (0.62 s); now for `a.meter.top`, the wind-up by distance (holding 0.62 s from 16 m is now a late release).
- `rules.test.ts` C-4 BEND: a gold kick now lands on its aim with the bend solved in, so the bend is measured by the path's bow (Bend left bows right, i.e. bends left: +0.3 m or more; Bend right −0.3 m; straight within 0.1 m), each kick within 0.25 m of its aim. The R-1 idle-dead-ball case now wins a free kick on that seed: the autopilot takes it after `SET_PIECE_WAIT` as the match screen's AUTO KICK does. The R-2 parry case releases a little off the gold (a gold release lands exactly on aims that are never within a ball of the post).
- `soccer.test.ts`: the keeper's reach gap DIV 92 vs 55 was required > 0.5 m (now > 0.1 m: the narrowed keeper ratings, S5); "a good finisher scores more" from 21–24 m: +0.10 and 2.5× → +0.04 and 1.6× (real conversion there is 4–8%).
- `shooting.test.ts` "a better keeper concedes fewer": measured with the assist (a gold release dragged into the corner from 13–16 m is past any keeper: the ring's promise).
- `setpieces.test.ts`: corner floor 6% → 3%, direct free kick floor 2% → 1%, with soccer-7 to restore them (as soccer-1 did for R-2).
- `prefs.test.ts` import graph: the engine may reach `v2/perfect.ts` (pure, reaches nothing else), nothing else in `v2/`.

**Golden re-based** (REBASES #3 in `golden.test.ts`): attacks `0dde30cbc63300` → `1ef39a4bceedfe`, matches `07f3dde0f40f62` → `14489f6955b10b`, shootouts `13ebc2208d1307` → `1f1b284a6ae4a2` (the penalty's narrower gold). Agreement green.

**Browser QA** (dev server 5217; `scripts/qa/soccer-lab.mjs ring`; touch, isolated: 0 requests to live hosts, 0 page errors; screenshots in `O/shots/soccer/soccer-4/`, all looked at): 393×852 (sat 59) and 320×568.
- `*-ring-gold.png`: the gold ring at the feet and the arc over the head, "GOLD" over it, the reticle on the assist's spot.
- `320x568-ring-perfect.png`: PERFECT over the arc and the gold "PERFECT · on the gold" plate in the toast line. (At 393 the scripted release landed 105 ms late on the loaded machine: `393x852-sat59-ring-perfect.png` shows "GOOD".)
- `*-ring-amber.png`: a man at 1.4 m, the amber ring, "PRESSURE" over it and "PRESSURE · no gold with a man on you" in the toast.
- `*-ring-red.png`: 33 m with SHO 60, the red ring, "TOO FAR" over it and in the toast; after the release "LATE · TOO FAR" / "GOOD · TOO FAR".
- Seen and fixed: the reticle's cone ring circled the whole screen on a red shot (capped at the goal's half-width).

**Suite.** `PS_SPORT=soccer npx vitest run soccer sport-branches` (through `heavy.sh`): **26 files, 204/204**, Duration 104.3 s and 136.4 s on two runs with the shared machine at a load of 8–10 (over the 120 s cap on the second; the new files add about 25 s of test time, `perfect-soccer` (the 1,000 gold releases) and `keeper` the largest). Default sport: `play-feedback`, `sound-perfect`, golden, both agreement files, `juice`, `sport-branches`: 7 files, 39/39. `npm run typecheck` clean.

**Not met here, with numbers (followups):**
- Whole-match scoring: 1.15 goals a match (0–0 32.5%) at 5.5 shots a side; per-shot conversion is now real, so the plan's soccer-7 (9–13 shots a side, the V2 deal) must bring 2.4–2.7 back. Soccer must not ship online before it.
- S6: a gold release dragged into the corner from 12–16 m beats any keeper (1v1 drag 66.5%; SHO 95 vs GK 75 86%; SHO 75 vs GK 93 59.5%) against 35–45 / 50–58 / 25–32%. That is the ring's promise (gold places it exactly), so the 1v1 number moves only with how often a person gets gold (timing sd 0.06 s gives 60% gold here) or with keepers who save placed corners.
- P2: the 30 m beeline 7.5–13% (≤ 2%); it presses at 30 m and sprints on through the wind-up, striking from about 25 m.
- S8 partly (gold beats the assist by +6.5 and +14.5 points in build and counter, +1 in wide; the assist reaches 41–61% of gold, not 70%).
- Save% 74.5% (64–72), blocked 12.4% (≥ 18%), woodwork 1.7% (2–4%), S2 point-blank 50% (70–80) and beyond 25 yd 2.8% (8–12, mostly free kicks).

## Contracts (plan §5): what soccer publishes and what it adopts

Published in soccer-1 so ut, nba, nfl, players and shell can rely on them from now on. Branches merge only at integration: where another team's piece isn't in our base, soccer writes against the interface below, and the lead keeps one copy at merge. Where another team publishes different names first, theirs win and only `src/game/soccer2/v2/` changes.

### 5.0 Game Design V2's shared pieces (F.1)

#### 5.0.1 Pieces soccer WRITES

| Piece | Where | Interface | Status |
|---|---|---|---|
| **(a) PERFECT chime, ring tick, woodwork clang** (all three sports) | `src/lib/sound.ts`, on the existing `sfx` object | `sfx.perfect(streak = 1)`: a root (G5, `PERFECT_ROOT` 784 Hz) and the fifth above it 70 ms later, about 180 ms in all; both rise `perfectStep(streak)` = min(streak − 1, 4) semitones (`PERFECT_MAX_STEP` 4; a missing, zero, fractional or nonsense streak counts down to a whole number ≥ 1). `sfx.ringTick(i = 0)`: one 30 ms tick for the last 200 ms of a closing ring; the caller schedules up to four, i = 0..3, two semitones apart from E6 (`RING_TICK`); i is clamped to 0..3. `sfx.post()`: a struck-tube clang (three inharmonic partials over 620 Hz and a 35 ms edge) plus the crowd's existing "ooh". | **Done** (soccer-1). Synthesized on the existing AudioContext; no new files; about 0.6 KB gzip. Silent, with no audio nodes, when sound is off (`setFeedback`). `sfx.perfect` does not vibrate: the double haptic is shell's `haptic('double')`, fired by the caller in the same frame. Tested in `src/lib/sound-perfect.test.ts` (default suite). Soccer plays `sfx.post` on the woodwork now; the chime and tick are wired in soccer-4. |
| **(b) `Progress.grade` and `Progress.box`** (soccer-9) | final `Progress` passed to `onFinish`; stripped before the wire | `grade?: { letter: 'S'\|'A'\|'B'\|'C'; perfects; bestHeat /* 0..100 */; fire; flawless /* a win with no 'L' end */; perAttack; par }` (type `MatchGrade` in `soccer2/v2/index.ts`); `box?: BoxLine[]` (5.1) with optional mastery extras `perfects`, `longGoals` (≥ 16.5 m), `firstTime`, `tricks`, `xg`. If nba publishes a different `grade` shape in `src/game/progress.ts` first, soccer adopts nba's names (`gradeOf` is the one function). | Planned (soccer-9) |
| **(c) The Daily Play** (soccer-10) | `src/game/soccer2/daily-play.ts`, re-exported from `arcade.ts`, lazy with the soccer chunk | `dailyPlayFor(day): DailyPlay { id 'soccer:YYYY-MM-DD'; day; title "90'+2 · FREE KICK AT 22 M"; brief; star; clockS }` (pure: the same day gives the same scenario everywhere); `scoreDailyPlay(run: DailyRun { id; outcome 'goal'\|'saved'\|'miss'\|'lost'; perfects; t; practice }) → { score; stars 0–3; result }` (spoiler-free text; ut adds the "PS SOC #n" prefix, SVG stars and the share card). Host: `<Soccer2 daily={dp} onDaily={(run) => …} />`, one scenario, no intro cards, defend phase, SIM or prefs; `onDaily` once per attempt. ut owns attempts, coins, the board, the share sheet and the screen. | Planned (soccer-10) |
| **(d) Small soccer hunks in nba's shared V2 files** | only once those files are in our base (V2 grant) | e.g. a D-slot label prop, a hold-to-rush prop; each listed under "Touched outside my lane" | — |

#### 5.0.2 Pieces soccer CONSUMES, and the interface it writes against

**Stand-ins in this branch (soccer-2), each headed `// merge: replace with …`:** `v2/stick.ts` (nba's `stick.ts`; adds the 1.0× sprint-off hysteresis through an optional `prev` argument to `stickOut`), `v2/hud.tsx` (nba's `Stick.tsx`, ScoreBug, ToastLine, PauseButton), `v2/geometry.css` + `v2/geometry.ts` (nba's `controls-geometry.css`; tokens copied with the same names and values), `v2/haptics.ts` (ut's `haptics.ts`, same `haptic(kind)`), `v2/playtime.ts` (ut's `playtime.ts`: soccer reports `paused`/`auto`/`stoppage`; maps to ut's `usePlaytime('match')` + `setPlaytimePaused`). The CSS block "v2 stand-ins" in `soccer2-controls.css` goes with `hud.tsx`. **soccer-4:** `v2/perfect.ts` (nba's `perfect.ts` + `hud/ring-draw.ts`: `ringWindow`, `windowScale` (product, cap ×1.45 / 90 ms, then the ±30 ms floor), `judge`, `wordFor`, `deviceLagMs`/`setDeviceLag` (default 30 ms until nba's calibration), `ringMap`/`goldArcPx`/`drawRing` (the gold band ≥ 8 px by stretching the ring's time scale, never the window); nba's names `GOLD_FLOOR_MS`, `WINDOW_CAP`, `FIRE_MULT` kept). `ringWindow` takes an optional `amber` dial for a sport's own amber causes and `parts` (nba's `WindowPart[]`).

`src/game/soccer2/v2/index.ts` (new in soccer-1) is the **only** place soccer code and soccer tests import these from. Today it re-exports the sounds above and declares the interfaces below as types. The task that first needs a piece adds a stand-in beside it (`stick.ts`, `perfect.ts`, `heat.ts`, `hud.tsx`, `haptics.ts`, `playtime.ts`, `geometry.ts`), each headed `// merge: replace with <team>'s <file>, then delete this file`, and lists it here. At merge the lead points `index.ts` at the shared files and deletes the stand-ins. Nothing in the folder may be read by the engine, the AI's simulations or anything both phones compute, with one exception since soccer-4: `engine.ts` imports `ringWindow` and `windowScale` straight from `v2/perfect.ts` (pure window maths), because the AI's sims judge their own seeded releases against the same window as a person's. At merge nba's `perfect.ts` must keep those two pure, or soccer keeps its copy for the engine.

| Piece (author) | What soccer relies on | Type in `v2/index.ts` |
|---|---|---|
| `src/game/controls-geometry.css` (shell, per F.1) | CSS custom properties for A, B, C, D, the stick zone and ring, the sprint ring, the score bug, pause, the Heat bar, the toast line and the action-safe box, at 393 and 320, scaled by the stage (V2 A.5). Soccer reads **rects from the DOM** and the safe box through one function, `v2/geometry.ts: safeBox()`. | `SafeBox` |
| `src/game/Stick.tsx` + `stick.ts` (nba) | `<Stick zone onVector={(v, sprint) => …} live ghost />`: the base floats to the first touch; a thumb resting in the zone before the whistle is live at it; \|v\| ≤ 1, release gives `{0, 0}`; sprint on past 1.15× the ring radius, off under 1.0×, with a `'tick'` haptic; one pointer per stick. | `StickProps`, `Vec` |
| `src/game/perfect.ts` + `PerfectRing` (nba) | `ringWindow({ baseHalfMs, rating01, contested, inRange, fire }) → { state: 'gold'\|'amber'\|'red'; goldHalfMs /* ≥ 30 */; dial?: 'TIMING'\|'PRESSURE'\|'RANGE' }` (fire ×1.25; uncontested amber → gold); `judge(pressTs, releaseTs, targetMs, win, lagMs) → { offMs; word; gold }`; `deviceLagMs()`; `drawRing(ctx, { x, y, r, progress, goldFrom, goldTo, state })` with the gold arc ≥ 8 px. All pure. **The engine never reads a pointer timestamp:** soccer converts the judged offset into the release time in game seconds that `releaseShoot` already takes. | `RingWindowIn`, `RingWindow`, `RingState`, `RingDial`, `Judgement`, `JudgeWord`, `RingDraw` |
| `src/game/heat.ts` (nba) | `newHeat()`; `heatStep(h, ev, sport) → { v; fire; heating; best }`, gains through `pick({ nba, nfl, soccer })` (soccer: a goal +40, On Fire for 1 attack); `FIRE_MULT = 1.25`. Soccer keeps the state on `Match`, and in the AI sims inside `aiProgressFor`. | `HeatEvent`, `HeatState` |
| `src/game/hud/*` (nba) | `<ScoreBug you rival clock heat rivalHeat? clutch progress />` (soccer's clock reads "67' · 5/7"); `<Toast text kind />` (one 28 px line on the toast line); `<PauseButton onPress />` (44×44). | `ScoreBugProps`, `ToastProps`, `PauseButtonProps` |
| Arena kept mounted through the result sheet (nba, `Arcade.tsx`) | A rematch re-seeds the sport component in place; soccer re-seeds without remounting its canvas or sprite caches (soccer-9). | — |
| `src/lib/haptics.ts` (shell, per F.1) | `haptic(kind: 'tick'\|'double'\|'long')`, gesture-gated on iOS. Clutch's heartbeat = two ticks 120 ms apart every 1.2 s, unless `'heartbeat'` is published. | `HapticKind` |
| `src/lib/playtime.ts` `usePlaytime` (shell) | `usePlaytime('match', { paused, auto, stoppage })`; a returned `todayLine` shows on the pause sheet. Banking is the host's, through `onFinish`/`onQuit`. | `PlaytimeOpts`, `PlaytimeInfo` |
| players | Sprites at V2 sizes (C.1.2); routing of the 5.5 fields and acts; `impactOf(kind).stopMs` and `HitStopCap` behind soccer's `fx.ts`; `celebrate.ts` and the run-ins on `goalAt`; the crowd's front row. | — |
| shell | `ps:arena-ready` (soccer dispatches it); `--sat`/`--sab` after Fix A. | — |
| ut | The result sequence built from `Progress.box`/`grade`; the One-More bar; the Daily Play host and board; objectives that read `grade`. | — |
| lead | The protocol bump; unifying the three sports' `autoDefend` prefs; the `play` board branch. | — |

### 5.1 ut contract A: `Progress.box` (soccer-9)

`BoxLine { id; name; tag; pos?; side: 'us'|'them'; rating /* 1.0–10.0 */; stats: { goals, assists, shots, onTarget, saves, tackles, keyPasses, conceded, …5.0.1(b) extras } }` on the final `Progress`. Built from played engine events only (your attacks, the rival's simulated attacks or defend phases). Online the rival's detail is letters only, so the rival's box is absent and ut hides that block. Rating: 6.5 base; +1.0 a goal, +0.6 an assist, +0.3 a key pass or tackle won, −0.5 an error leading to a goal; keepers +0.3 a save, −0.4 a goal conceded inside 12 m; clamped 1.0–10.0. Stripped before the wire (a test asserts no `box`/`grade` on the wire object).

### 5.2 ut contract B: `onQuit(us, them)` (soccer-2)

Solo quit, after a confirm, calls the host's `onQuit` with both progresses (Arcade pads yours with `'FF'`, gives the AI its attacks through the ones you played, and applies the 3–0 award). **In every mode a quit is a loss that pays nothing** (soccer-2 re-review; it replaced "Squad Battles: leave with no result", which let a losing Cup game be replayed):
- **UT:** `settle(…, { quit: true })`, `settleDraft(…, { quit: true })`. The record, ladder and Cup/Circuit/Season round count the loss. There are no coins, card XP, paid slot, Season XP, objective game, Development or Evolution progress.
- **The draft 1 vs 1:** a loss (its rewards come from the season, as for a played loss).

Soccer shows the host's confirm note, default "It counts as a loss." `onQuit`/`onForfeit` may return `false` to refuse, and Soccer2 then keeps the match on.

### 5.3 The nba/nfl forfeit (soccer-2)

Online FORFEIT, after "Forfeit? Your rival wins.", sends a final `Progress` with `done: true`, `forfeit: true` and `ends` padded with `'FF'` (worth 0) up to `TOTAL`; the rival's `Arcade` finishes at once; `onFinish`'s optional 6th argument `forfeit: 'us'|'them'` is passed through. Soccer adds `'FF'` to the soccer `POINTS`, the soccer `END_LABEL` in `ut/Match.tsx` and `AttackEnd`/`END_TEXT` "FORFEIT". **ut hand-off:** `'FF'` in the soccer letters in `match-debrief.ts`.

### 5.4 Solo `onRival` (soccer-9)

`Soccer2` reports the rival's `Progress` after each defend phase; in the soccer branch of `Arcade`, when `!online`, `them`/`shown` come from it in nba-9 / nfl contract 2's shape. The precomputed `ai` stays for the kick-off "SIM IT".

### 5.5 players: the action contract (V2 B.3.6)

Optional, render-only `Body` fields. The engine writes them from deterministic geometry, never reads them and consumes no `a.rand` for them; it never imports `appearance*`.

| Field | Meaning | Task |
|---|---|---|
| `passKind` | `'ground'\|'lofted'\|'cross'\|'through'\|'throw'` today (set on every kick at launch); later `'loftedThrough'\|'shot'\|'header'\|'pen'\|'fk'\|'clear'\|'oneTwo'` | **1 (live: `throw`, and every pass)**, 2, 4, 6 |
| `kickFoot: 'L'\|'R'` | the ball's side relative to the strike | 4 |
| `shotKind`, `power: 0..1` | placed / power / finesse / chip / low; backlift 4–10 frames | 4, 6 |
| `contact: 'foot'\|'head'\|'volley'` | header and volley poses | 4 |
| `diveHeight: 'low'\|'mid'\|'high'`, `keeperSet` | the keeper's dive; split step ≥ 4 frames before every strike | 4 |
| `touchAt` | the last dribble touch | 5 |
| `trick: { kind; at }` | feint / stepover / roulette / dragback / ballroll | 6 |
| `slide: { at; dx; dy }` | block lunges and slide tackles | 4, 8 |
| `look: { x; y }` | facing the ball while jockeying | 5 |

Acts `'jockey'|'poke'|'block'|'getup'|'slide'|'shield'|'trick'`; routing is players' (`'jockey'` → `shuffle`/`shuffle_l`, drifting → walk, `'getup'` → `getup_front`, dives by `diveHeight`, kicks by `kickFoot`, unknown acts fall back safely). **Today:** a quick throw-in's thrower holds the ball overhead with act `'catch'` (the existing arms-up clip) and `passKind: 'throw'`; players may route that to a throw clip.

### 5.6 players: impact and celebrations (soccer-3)

Hit-stop through `soccer2/fx.ts` `hitStopFor(kind)` (power shot 33 ms, goal 66, save 60, woodwork 80; always 33–120; ≤ 150 ms per second; ≤ 30 ms under reduced motion); at merge pointed at players' `impactOf(kind).stopMs`/`HitStopCap`. Celebrations and run-ins are players' (`celebrate.ts`, on `goalAt`); soccer exposes `goalAt` and the scorer's id.

### 5.7 shell

`ps:arena-ready` dispatched once per match after the first frame (soccer-3). HUD offsets relative to `--sat`/`--sab`; layout checks at sat 59 and 81. `soccer-lazy.ts` follows `arcade.ts`'s exports, so it needs no edit. Tip lines for `src/shell/arena-tips.ts`, **draft** (final in soccer-9; revised in soccer-2 for the new controls):
1. "Drag on SHOOT to aim; let go as the ring turns gold."
2. "Bend free kicks with the arrows: the ball curls the way they point."
3. "A save pushed over the line is a corner: whip it in to a big man."
4. "Leave a set piece and AUTO KICK takes it for you after 12 seconds."
5. "Hold PASS to loft it over the line; tap it to keep it on the grass."
6. "Shots from 25 metres rarely beat a good keeper: work it into the box."
7. "Put your left thumb down before the whistle: you're running the moment it blows."
8. "Push the stick past its ring to sprint; your right thumb stays free to shoot."
9. "Hold THRU to lift the through ball over the last defender."
10. "Tap a teammate to pass straight to him."

### 5.8 Controls and gestures (V2 A.5, B.3.2)

Tap < 12 px and < 200 ms; swipe ≥ 40 px in ≤ 250 ms; flick up off A > 40 px in < 150 ms; curved drag > 15°; double-tap within 250 ms. Precedence: buttons, then the stick zone, then the pitch.

| Phase | Stick | A (Ø92) | B (Ø64) | C (Ø48) | D (Ø48) | Pitch |
|---|---|---|---|---|---|---|
| Attack | run; past the ring = sprint | SHOOT: hold, drag to aim, release on gold; flick up = chip; curved drag = finesse; double-tap = low; into red = power | PASS: tap ground; hold ≥ 0.22 s lob/cross; tap again within 1 s = one-two | THRU: tap ground; hold lofted | TRICK (soccer-6) | tap a teammate or his edge arrow = pass |
| Defend | move; sprint | TACKLE ring between touches | CONTAIN (hold) | SWITCH | KEEPER (hold) | swipe = slide; tap a defender = switch |
| Set piece | – | SHOOT (drag aim) | CROSS | SHORT | – | free kick swipe = bend (`-dx/140`) |
| Penalty | – | drag to aim, release on the meter | – | – | – | keeper: DIVE/STAY pre-commit |

Buttons-only preference: while A is held, C/D become CHIP/FINESSE and B LOW.

### 5.9 Device preferences

`perfect-season:soccer-prefs:v1` (never shipped): `{ v: 1, autoDefend: false, autoSwitch: 'on'|'cross'|'off' ('on'), buttonsOnly: false }`; unknown fields kept. `prefs.ts` imports no engine code; no engine, `aiProgress`, takeover, sim or Daily Play reads prefs (an import-graph test). Out of cloud saves and checkpoints.

### 5.10 Single sources

`skillStars(p)` in `soccer2/ratings.ts` (soccer-5); `xgOf` (soccer-4, display and box only); `gradeOf` (soccer-9); `dailyPlayFor` (soccer-10); `cornerLayout(side)` / `CORNER` in `engine.ts` (soccer-1: a dealt corner and an earned one line up from it).

## Touched outside my lane

| File | Owner | Hunk | Task |
|---|---|---|---|
| `src/game/Arcade.tsx` (~line 185) | nba/nfl shared | The soccer branch of `aiPlay` calls `sg.aiProgressFor(..., { rival, online })` instead of `sg.aiProgress(...)`: same results today (1 line). | soccer-1 |
| `src/ut/Match.tsx` (`simBoth`, ~line 858) | ut shared | Soccer's two simulations call `sg.aiProgressFor(..., { rival, online: !!setup.online })` (3 lines). | soccer-1 |
| `src/game/Arcade.tsx` | nba/nfl shared | soccer-2 (marked "merge: nba-7/nfl C1"): `'FF': 0` in the soccer `POINTS`; the `onQuit?(us, them)` prop (ut contract B) passed to Soccer2 offline as `quitNow`; the online forfeit block (`forfeit` state, `rivalFF` from an explicit `'FF'` end, `forfeitNow` padding to TOTAL, `us`/`them` when a side forfeits, no penalties after a forfeit); `onFinish`'s optional 6th `forfeit: 'us' \| 'them'`; `progress()` sends `wireOf(p)` (all sports: the same five fields as before) (~40 lines). | soccer-2 |
| `src/game/progress.ts` | shared | soccer-2 (marked merge): `Progress.forfeit?` and `wireOf(p)` (+14 lines). | soccer-2 |
| `src/ut/Match.tsx` (`END_LABEL`, soccer) | ut shared | `FF: 'FF'` (1 line). | soccer-2 |
| `src/ut/Match.tsx` (`finish`, the `<Arcade>` props) | ut shared | soccer-2 review fix: `finish(…, ff?)` decides a forfeit (`won: ff === 'them'`); `onFinish` passes the 6th argument; `onQuit={(us, them) => finish(us, them, 'played', undefined, 'us')}` (ut contract B) (~6 lines). | soccer-2 fix |
| `src/App.tsx` (draft `finish`, the `<Arcade>` props) | ut/lead shared | soccer-2 review fix: `arcade.forfeit?` decides `vsWon`; a rival forfeit is recorded like a rival who left, your own as `online.forfeit: 'you'`; `onFinish` passes `forfeit: ff`; `onQuit` settles a solo quit as a loss (~6 lines). | soccer-2 fix |
| `src/game/progress.ts` | shared | soccer-2 review fix: `awarded()` (football's 3–0 forfeit rule), `canForfeit()`, `RivalLive.forfeit?` (+22 lines, additive). | soccer-2 fix |
| `src/game/Arcade.tsx` | nba/nfl shared | soccer-2 review fix: `awarded()` before `onFinish` when a side forfeited; `forfeitNow` refused through `canForfeit`; `quitNow` sends the AI's attacks through the ones played and the award; Soccer2's `rival` carries `forfeit` (~12 lines). | soccer-2 fix |
| `src/game/progress.ts` | shared | soccer-2 re-review: `forfeitedBy()` and `settleInputs()` (the same-render forfeit decision Arcade settles on) (+40 lines, additive). | soccer-2 fix 2 |
| `src/game/Arcade.tsx` | nba/nfl shared | soccer-2 re-review: `us`/`them`/`level`/the award come from `settleInputs` (the forfeit read in the render, `ff` in the finish effect's deps); `forfeitNow`/`quitNow` return whether they accepted (~15 lines changed). | soccer-2 fix 2 |
| `src/ut/play.ts` (`settle`) | ut | soccer-2 re-review: optional `quit` input: 0 coins/XP, no paid slot, no `recordMatchProgress` (3 lines + type). | soccer-2 fix 2 |
| `src/ut/draft-mode.ts` (`settleDraft`) | ut | soccer-2 re-review: optional `quit` input: no `recordMatchProgress` (1 line + type). | soccer-2 fix 2 |
| `src/ut/Match.tsx` (`finish`, `onQuit`) | ut shared | soccer-2 re-review: `finish(…, quit?)` passes `quit` to `settle`/`settleDraft` and skips `recordEvoMatch`; `onQuit` passes `true` (~6 lines). | soccer-2 fix 2 |
| `src/App.tsx` (draft `onQuit`) | ut/lead shared | soccer-2 re-review: a quit settles with `how: 'sim'` (1 word). | soccer-2 fix 2 |
| `src/lib/sound.ts` | soccer owns the soccer crowd wiring; V2 F.1 gives soccer the PERFECT chime | `sfx.perfect`, `sfx.ringTick`, `sfx.post` and their constants (`PERFECT_ROOT`, `PERFECT_MAX_STEP`, `perfectStep`, `RING_TICK`): additive, about 40 lines, nothing existing changed. Tested in the new `src/lib/sound-perfect.test.ts` (default suite). | soccer-1 |
| `src/game/pixel/pitch.ts` | players | `onLine` is now exported (one word) so soccer's `pitchTex` draws the same markings; `pitchTexture` there is no longer used by soccer (players may adopt `PITCH`/`pitchTex` or delete it). | soccer-3 |
| `src/game/play-feedback.ts` (`soccerFeedback` only) | nfl/soccer shared | soccer-4: the ring's next-step lines (TOO FAR, PRESSURE, BLOCKED, FIRST TIME ACROSS YOUR BODY, KEEPER CLAIM, PARRIED WIDE), the Ring and xG facts (`SOCCER_RING` map + the function body; the NBA and NFL functions untouched). | soccer-4 |
| `docs/CREDITS.md` | shared | soccer-4: one section crediting StatsBomb Open Data (CC BY-SA 4.0) for `xg.ts` and the conversion targets. | soccer-4 |
| `src/game/soccer2/render.ts` players section (`sprite()`) | players (shared file) | Two hooks: the sprite's look-down angle comes from `tiltAt(y)` (≤ `SPRITE_TILT` 0.6, the camera's) instead of `min(0.9, pitchAt)`, and two counters (`stats.sprites`, `stats.stale`) for the stale-draw budget. The size passed in is the camera's (`spriteScale`). | soccer-3 |
| `src/game/soccer2/render.ts` players section (`sprite()`, the draw call) | players (shared file) | soccer-3 review fix: a `far` flag (a man > 15 m from the ball: 8 facings, every third clip frame, sizes in 4 px steps), and the new-sprite budget 5 always (12 before the whistle), no longer 3 after a long frame (~6 lines). Players may fold this into their LOD. | soccer-3 fix |

## Protocol

**Protocol bump needed: soccer draft 2 → 3, UT 2 → 3, because** soccer-1 changes how attacks end and therefore the AI simulations both phones compute: R-1 (a shot or parry that dies short is a loose ball and the clock runs) and R-2 (parries go away from the goal line; corners off a defender or a parry, goal kicks and quick throw-ins played inside the attack). The golden hash was re-based for R-2 (reason in `golden.test.ts`); both phones still agree (agreement tests green). One bump covers every later soccer task too (V2 F.3); the lead does it at integration. NBA and NFL are unaffected: the only shared change is three new synthesized sounds in `sound.ts`.

**soccer-2 review fix: rides the same bump.** A forfeit now decides the result (3–0 to the side left standing) instead of the score at the moment of the forfeit: that changes how a soccer online result is decided, so old and new soccer clients must not meet (soccer draft 2 → 3, UT 2 → 3, already needed). NBA/NFL never set `forfeit`, so their results are unchanged.

**soccer-2: no bump of its own.** The controls, HUD, pause and the human-only lofted through ball change no AI simulation (golden unchanged, agreement green). `'FF'` on the wire is new to soccer's online match and rides the same soccer bump (draft 2 → 3, UT 2 → 3): an old client would not recognise a forfeit and would wait for the AI to take over instead.

**soccer-2 re-review: rides the same bump.** The wind-up multiplier (0.85 → 0.87) touches only a person's carrier (the autopilot's stick is still under a meter): golden unchanged. The same-render forfeit and the no-reward quit change local settlement only; both phones already agree on a forfeit's winner.

**soccer-3: no bump.** Camera, pitch, rings, arrows, juice, goal moments and Clutch staging are render only: golden unchanged, agreement green, `juice-soccer.test.ts` proves identical outcomes.

**Protocol bump needed: soccer draft 2 → 3, UT 2 → 3, because** soccer-4 changes shot windows (the wind-up by distance, gold by SHO and openness, gold placing the ball exactly, amber and red), the shot, keeper and pass model (the cone by range and context, first-time shots and passes, blocks, the keeper's ratings, reads, races, claims and spread, the assist) and the AI's simulations (the autopilot's range and release against the wind-up). Golden re-based (REBASES #3); agreement green, so both phones of a new client still agree; old and new clients would not. The same single soccer bump covers it. **Do not release soccer online with soccer-4 alone:** the whole-match scoring is soccer-7's fit (below).

## Hand-offs

- **nba (soccer-4):** soccer's `v2/perfect.ts` follows your `perfect.ts` names (`GOLD_FLOOR_MS`, `WINDOW_CAP`, `windowScale(baseMs, parts)`, `FIRE_MULT`) and adds `ringWindow({ …, amber?, parts? })`, `judge(pressTs, releaseTs, targetMs, win, lagMs)`, `wordFor`, `deviceLagMs`/`setDeviceLag`, `ringMap`/`goldArcPx`/`drawRing`. Soccer's engine imports `ringWindow` and `windowScale` directly (pure), so at merge keep those pure and dependency-free, or soccer keeps its copy for the engine. Your calibrator should call `setDeviceLag(ms)` (or soccer reads yours through `v2/index.ts`).
- **players (soccer-4):** the §5.5 fields now written: `kickFoot` (shots and passes), `passKind` also `shot`/`header`/`pen`/`fk`, `shotKind` + `power` (backlift 4–10 frames), `contact` (`head`/`volley`/`foot`), `diveHeight` (low < 0.6 m, mid < 1.4 m, high), `keeperSet` (the split step, ≥ 4 frames before every strike) and `slide` (a block lunge: `{ at, dx: ±1, dy: 0 }`). Route them when your clips are in.
- **soccer-7 (whole-match fit):** per-shot conversion is now real football's (S1), so goals per match fell to 1.15 (0–0 32.5%) with 5.5 shots a side. The plan's 9–13 shots a side (A5) and the V2 deal are what bring 2.4–2.7 goals back; also the set-piece floors relaxed here (corners, direct free kicks), save% 74.5 → 64–72, blocked 12.4 → 18+, woodwork 1.7 → 2–4.

- **players (soccer-3):** the stale-draw budget at V2 sizes. Every man on the soccer screen is now 30–45 px, where `sprite()`'s LOD gives 16 facings and a clip frame every 2 steps. Stale draws are 11.8% at 4× CPU (7.3% before, when far men were small). A cheaper LOD for men away from the ball (8 facings, every 3rd frame) and pre-warming each attack's sprites before the whistle are yours; V3 fixes only the sizes. `PITCH` in `soccer2/render.ts` is the palette to retune under your venue grant, and the camera passes sprites `spriteScale(s, ART)` (2.5 px/m steps) at `SPRITE_TILT` 0.6.
- **players (soccer-3 review fix):** soccer now does the interim part in `sprite()` itself (the `far` flag: men > 15 m from the ball at 8 facings, every 3rd clip frame, 4 px size steps; 12 new sprites a frame before the whistle; the budget stays 5). Stale draws are 2.0–2.4% at 4× and 3.5–3.8% at 6×, still above the 1% target. What's left is yours: a clip-cycle pre-warm when a new attack swaps the kits, and the LOD at V2 sizes. Fold soccer's `far` hunk into it.
- **planner / lead (soccer-3 review fix):** sign off or amend V1's corner line. The taker 20 px inside his edge plus the whole goal mouth needs about 40 m across at the flag's row (geometry in the review-fix section). The build gives 40.0–42.7 m.
- **shell (soccer-3):** soccer dispatches `ps:arena-ready` (`window`, `detail: { sport: 'soccer' }`) once per match after the first frame with the pitch and players.
- **nba (soccer-3):** the hidden `.sc2-safe` probe reads the action-safe box from the tokens (`--safe-t`, `--safe-b`); at merge it reads yours.

- **ut (soccer-2):** ~~pass `onQuit` and read the 6th `forfeit` argument~~ (done by soccer's review fix, a few lines in `ut/Match.tsx` and `App.tsx`, listed above; ut-4 may refine what a quit means per mode, e.g. Squad Battles "no result", and pass a `quitNote`). Still yours: add `'FF'` to the soccer letters in `match-debrief.ts`.
- **nba / nfl:** soccer's `Arcade.tsx` hunks are marked "merge"; keep one forfeit block and one `wireOf` strip for all three sports. Soccer's stand-ins use nba's names (`stickGeom`, `stickOut`, `STICK_IDLE`…); soccer adds sprint-off hysteresis (1.0×) via `stickOut(s, g, prev)`, which the V2 contract asks for.
- **players:** `Body.passKind: 'loftedThrough'` now occurs (THRU held): the lofted kick clip.

- **shell:** the draft tip lines for `arena-tips.ts` are in §5.7 above (final in soccer-9).
- **nba / nfl:** `sfx.perfect(streak)`, `sfx.ringTick(i)` and `sfx.post()` are ready to call from your first ring task (§5.0.1 a).
- **players:** a quick throw-in's thrower carries `passKind: 'throw'` and act `'catch'` (arms up) while he holds the ball; route it to a throw clip if you add one (§5.5).

## Owner device checks

- soccer-4: the gold ring under a real thumb: is the ±30–66 ms window fair, and does the 30 ms default display lag feel right on the phone (nba's calibration will set it per device); the ring's closing ticks, the PERFECT chime climbing on a streak, and the double haptic on gold (iPhone plays it only inside the release touch, so a first-time hit still held as the ball arrives gets the word and the chime but no haptic); legibility of the ground ring and the arc in sunlight; whether "TOO FAR" and "PRESSURE" read in time to change your mind.

- soccer-3: the 34 m frame and readability with the bigger sprites beside the real Dynamic Island (sat 59); the edge arrows as tap targets; the heartbeat haptic in Clutch (iPhone plays it only during your touches); the post shiver and the hit-stop feel (do 66 ms on a goal read as weight or as a hitch?); frame pacing on the phone itself (the dev box was overloaded).

- soccer-2: the floating stick and the sprint ring under a real thumb (does 1.15× feel like a deliberate push?); a thumb resting on the stick at the whistle; A/B/C/D reach and size with one hand on the 393 phone; the pressed feel and the tick haptic (iPhone plays it only inside the touch); the pause button by the Dynamic Island; the toast line's legibility in sunlight.

- The new sounds on a real iPhone speaker: the soccer crowd building as the ball nears goal, the bounce, the woodwork clang with the crowd's "ooh" (the PERFECT chime and ring tick are heard from soccer-4).
- An earned corner after a parry and a quick throw-in, played with a thumb: the camera's jump to the corner flag, the "CORNER!" call and the AUTO KICK countdown if you wait.
- The BEND arrows at 44 px on the phone (free kick): the ball curls the way the arrow points.

