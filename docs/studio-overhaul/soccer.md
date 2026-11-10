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

## Touched outside my lane

| File | Owner | Hunk | Task |
|---|---|---|---|
| `src/game/Arcade.tsx` (~line 185) | nba/nfl shared | The soccer branch of `aiPlay` calls `sg.aiProgressFor(..., { rival, online })` instead of `sg.aiProgress(...)`: same results today (1 line). | soccer-1 |
| `src/ut/Match.tsx` (`simBoth`, ~line 858) | ut shared | Soccer's two simulations call `sg.aiProgressFor(..., { rival, online: !!setup.online })` (3 lines). | soccer-1 |
