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

`src/game/soccer2/v2/index.ts` (new in soccer-1) is the **only** place soccer code and soccer tests import these from. Today it re-exports the sounds above and declares the interfaces below as types. The task that first needs a piece adds a stand-in beside it (`stick.ts`, `perfect.ts`, `heat.ts`, `hud.tsx`, `haptics.ts`, `playtime.ts`, `geometry.ts`), each headed `// merge: replace with <team>'s <file>, then delete this file`, and lists it here. At merge the lead points `index.ts` at the shared files and deletes the stand-ins. Nothing in the folder may be read by the engine, the AI's simulations or anything both phones compute.

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

Solo quit, after a confirm, calls the host's `onQuit` with both progresses; the host decides (Squad Battles: leave with no result; Cup, Circuit, Season, Draft: ut-4's forfeit). Soccer shows the host's confirm note, default "It counts as a loss." No soccer-side settlement and no `'T'` padding.

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

`ps:arena-ready` dispatched once per match after the first frame (soccer-3). HUD offsets relative to `--sat`/`--sab`; layout checks at sat 59 and 81. `soccer-lazy.ts` follows `arcade.ts`'s exports, so it needs no edit. Tip lines for `src/shell/arena-tips.ts`, **draft** (final in soccer-9):
1. "Drag on SHOOT to aim; let go as the ring turns gold."
2. "Bend free kicks with the arrows: the ball curls the way they point."
3. "A save pushed over the line is a corner: whip it in to a big man."
4. "Leave a set piece and AUTO KICK takes it for you after 12 seconds."
5. "Hold PASS to loft it over the line; tap it to keep it on the grass."
6. "Shots from 25 metres rarely beat a good keeper: work it into the box."

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
| `src/lib/sound.ts` | soccer owns the soccer crowd wiring; V2 F.1 gives soccer the PERFECT chime | `sfx.perfect`, `sfx.ringTick`, `sfx.post` and their constants (`PERFECT_ROOT`, `PERFECT_MAX_STEP`, `perfectStep`, `RING_TICK`): additive, about 40 lines, nothing existing changed. Tested in the new `src/lib/sound-perfect.test.ts` (default suite). | soccer-1 |

## Protocol

**Protocol bump needed: soccer draft 2 → 3, UT 2 → 3, because** soccer-1 changes how attacks end and therefore the AI simulations both phones compute: R-1 (a shot or parry that dies short is a loose ball and the clock runs) and R-2 (parries go away from the goal line; corners off a defender or a parry, goal kicks and quick throw-ins played inside the attack). The golden hash was re-based for R-2 (reason in `golden.test.ts`); both phones still agree (agreement tests green). One bump covers every later soccer task too (V2 F.3); the lead does it at integration. NBA and NFL are unaffected: the only shared change is three new synthesized sounds in `sound.ts`.

## Hand-offs

- **shell:** the draft tip lines for `arena-tips.ts` are in §5.7 above (final in soccer-9).
- **nba / nfl:** `sfx.perfect(streak)`, `sfx.ringTick(i)` and `sfx.post()` are ready to call from your first ring task (§5.0.1 a).
- **players:** a quick throw-in's thrower carries `passKind: 'throw'` and act `'catch'` (arms up) while he holds the ball; route it to a throw clip if you add one (§5.5).

## Owner device checks

- The new sounds on a real iPhone speaker: the soccer crowd building as the ball nears goal, the bounce, the woodwork clang with the crowd's "ooh" (the PERFECT chime and ring tick are heard from soccer-4).
- An earned corner after a parry and a quick throw-in, played with a thumb: the camera's jump to the corner flag, the "CORNER!" call and the AUTO KICK countdown if you wait.
- The BEND arrows at 44 px on the phone (free kick): the ball curls the way the arrow points.

