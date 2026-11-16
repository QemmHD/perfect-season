# Team nba: studio overhaul team doc

Branch `claude/studio-nba`, worktree `/home/user/ps-s-nba`, dev server port **5215**, QA relay **7795**
(`ws://localhost:7795`, `scripts/audit/nba-relay.mjs`). The build plan is
[`nba-plan.md`](nba-plan.md) (revision 3, Game Design V2). This doc records what each task changed, the before and
after numbers, the tests, the protocol line, the contracts other teams build against, and what's left.

**Contents:** nba-1 (harness, baseline, QA isolation) · nba-2 (the shared controls) · nba-3 (the frame: camera, HUD, clock, text, held arena) · Contracts for nfl / soccer / ut (plan §4, verbatim) · Contract
changes · Requests to other teams · Escalations · Protocol · Touched outside my lane · Owner device checks · Left
undone.

---

## nba-1 · Harness, baseline, QA isolation and day-one contracts (2026-11-16)

### What changed

Nothing a player sees. nba-1 builds the measuring tools every later task proves itself with, and measures today's game.

- **The box score from the engine's own events** (`hoops2/box.ts`, `BoxTracker`).
  - The engine pushes five observation-only events beside its existing ones: `fga:<who>:<kind>:<2|3>`, `drb`, `stl`,
    `int` and `foul`. They never change state or the order of `p.rand` draws.
  - The tracker keys lines by player id, credits an assist for a catch then a make within 2.5 s and at most one move,
    and charges a picked-off or thrown-away pass to the passer.
  - V2 vocabulary: `BoxLine.pure` is now `perfect`, plus `perfect3` (PERFECT releases on three-point attempts, for ut's
    card mastery). Neither had shipped.
- **`hoops2/harness.ts`** (test-only): Squad Battles squads by displayed or rating-scale overall, made-up squads for the
  always-on tests, the modelled person (seven strategies, Gaussian release error, σ 50 / 35 ms), the six defender
  policies, the calibration summary and `thrAvg()`.
- **`hoops2/targets.ts`** (test-only, never in a bundle): every plan §3 row as data, with its band, source, owning task
  and today's baseline. nba-1 replaced the V2 rows:
  - §3.3, the gold ring: half-widths by THR (`goldBase`), the multipliers (`WINDOW_PARTS`), the ±30 ms floor and the
    cap, the states and range gates, the gold-rate and make-rate table (`MAKE_TABLE`), timing precision and drawing
  - §3.7, Heat (`HEAT_RULES`), §3.8, the A.5 geometry table (`GEO`, `GEO_GAPS`), §3.10, the held arena, §3.13, the
    haptic patterns (`HAPTIC_FOR`), audio and juice, and §3.14, the grade (`GRADE_PAR`, `GRADE_AT`, `gradeOf`)
  - removed: the HOT HAND / LOCKED IN stage rows, the RUN banner/factor row, and the card-pick rows
- **`practiceStart()`** moved from `Hoops2.tsx` into `game.ts`, so the harness sets drills up exactly as the screens do.
- **A dev-server-only probe** in `Hoops2.tsx`: `window.__hg2` (the live possession, the game, the camera's `screenOf`,
  the canvas and its zoom), guarded by `import.meta.env.DEV`, so the production build drops it.
- **QA isolation** (`scripts/audit/`, see below) and **the two V2 baseline probes**, `nba-geo.mjs` and `nba-rematch.mjs`.

### Tests

| Test | When | What it proves | Time |
|---|---|---|---|
| `determinism.test.ts` | always | 3 seeded games identical across a plain loop, uneven 8-34 ms frames, the juice's hit-stop and the box tracker; a recorded person's inputs replay to the same marks, scores, final `p.t` and shot chances, frame batching aside; the sim adds no `Math.exp/pow/log`, **trig or `hypot`** (since the review fix; today's per-declaration counts grandfathered) and never reads a clock or `Math.random`; the scan also covers `src/game/heat.ts` and `perfect.ts` once they land | 4.0 s |
| `golden.test.ts` (review fix) | always | 6 seeded AI games (`aiPossessionsOf`'s exact body, 4 skills × 4 defensive IQs, with a bench) score and mark exactly as **recorded from the base `78a1c86`**, and the same autoplay loop ends every possession with the same kind, points, scorer, text and final clock (to 1 µs); and `aiPossessionsOf` in `Hoops2.tsx` still is exactly that body | 3.3 s |
| `box.test.ts` | always (20 games; `NBA_BOX=1`: 200 with real squads) | Σ PTS = the score; made FG, threes, and-ones, turnovers and possessions = the marks; attempts, free throws, blocks, steals and defensive rebounds = the events counted independently; every line consistent (PERFECT ≤ FGA, PERFECT3 ≤ PERFECT and ≤ 3PA); pass → catch → make credits exactly one assist, and a hold past 2.5 s none | 7.6 s |
| `calibration-smoke.test.ts` (new) | always | 20 AI-v-AI games at the audit's even 78, Pro: the box agrees with the score every game, and 11 numbers per side sit inside wide bands that hold for today's engine and for §3.1's targets (PPP 0.95-1.40, TOV 3-20%, FTA/FGA 0-.40 until nba-5 raises the floor to .12, …) | 15.1 s |
| `calibration.test.ts` | `NBA_CAL=1` | the full §3.1 / §3.1b / §3.5 tables against targets.ts (`NBA_CAL_GAMES`, `NBA_CAL_CONFIGS`, `NBA_ERA`, `NBA_CAL_ASSERT` for nba-10) | 116 s at 150 games × 3 configs |
| `human.test.ts`, "the ladder" (new) | `HUMAN=1` | the median (σ 50) and skilled (σ 35) person, seven strategies, on each UT rung against the AI's possessions at that rung; the six defender policies run beside it and must not change a point until nba-6/7 wire them | 140 s at 20 games |
| `curve.test.ts` (new) | `NBA_CURVE=1` | make chance by offset × THR × contest × rung, the §3.3 gold rows today, and the 60 Hz quantisation | 0.5 s |
| `moments.test.ts` (new) | `NBA_MOMENTS=1` | every NBA Moment and Training drill 200 times under the median person | 81 s |

**Always-on additions: 17.7-26.7 s** depending on machine load (budget < 45 s; the smoke 9.8-15.1 s, budget < 20 s).
The standard set is green (see Verification).

### QA isolation (`scripts/audit/`)

- **`nba-lib.mjs`**: every probe's harness.
  - Port 5215 and relay 7795; `?ns=inspect&relay=ws://localhost:7795` on every URL.
  - Every request and WebSocket to a host other than localhost / 127.0.0.1 is aborted (Google Fonts excepted) and
    reported at the end of each run. Since the review fix this is `nba-guard.mjs` (below): a context route **plus** a
    guard on Playwright's Route itself, so no page-level route can `continue()` past it. The lab runs reported none; the UT-fixture runs reported the app's own call to the
    live Supabase host, which was aborted.
  - The 8 plan sizes with their insets (393×852 59/34, 320×568 20/0, 430×932, 375×667 and the four landscape sizes),
    injected both where the stage reads them (`window.__psInsets`) and where the game reads them (`.arcade-full`'s
    `--sat/--sab/--sal/--sar`, which otherwise come from `env()`).
  - Both reduced-motion modes, CDP touch, a local UT fixture profile (`utFixture`), frame timing.
- **`nba-relay.mjs`**: a signature-verifying Nostr relay on 7795 (the server half of `online.mjs`), using the WebSocket
  server bundled in playwright because the install has no `ws`.
- **`nba-qa-run.mjs` + `nba-qa-preload.mjs`**: runs a shared `scripts/qa/*.mjs` against 5215 with every browser it
  launches isolated the same way, and the shared relay moved to 7795. `online.mjs` keeps 7777 and runs only under
  `flock /tmp/ps-qa-relay-7777.lock`.
  - It refuses (exit 2): scripts outside `scripts/qa` / `scripts/audit`, `admin-registry` and `cloud-backend`, any
    script naming a remote host **in its own source or any local module it imports, followed transitively**, no dev
    server, or a failing guard self-test (`nba-qa-selftest.mjs`, run under the same preload before every script).
  - Checked: `admin-registry.mjs` refused; `cloud.mjs` ran against 5215 and its request to the live Supabase host was
    aborted (the script itself then timed out on a stale `DEVELOPMENT` selector, unrelated).
- **Ported from the audit:** `nba-shots`, `nba-clock`, `nba-deadstick`, `nba-perf`, `nba-final`, `nba-se` (`.mjs`, on
  nba-lib).
- **New V2 probes:** `nba-geo.mjs` (§3.8) and `nba-rematch.mjs` (§3.10).

### The baseline (2026-11-16, before any gameplay change)

Every baseline run went through `heavy.sh`. Raw JSON, logs and captures: `O/shots/nba/nba-1/baseline/` (`O` = the overhaul
scratchpad).

**The audit reproduced.** The audit's own config (Squad Battles squads at displayed team 78, its seeds, Pro skill and
defense), 150 games:

| | Audit (60 games) | nba-1, us (150) | nba-1, them (150) | Acceptance |
|---|---|---|---|---|
| PPP | 1.281 / 1.262 | **1.287** | **1.276** | 1.28 ± 0.05 ✓ |
| FTA / FGA | .019 / .021 | **.017** | **.024** | < .05 ✓ |
| Mid FG% | .652 / .623 | **.618** | **.628** | > .55 ✓ |
| 3PA / FGA | .327 / .243 | .333 | .242 | |
| TOV / poss | .066 / .078 | .069 | .082 | |
| FG% / 3P% / eFG | .539 / .431 / .610 | .538 / .461 / .614 | .552 / .439 / .605 | |
| Rim FG% | .576 / .602 | .565 | .592 | |
| ORB% | .223 / .263 | .223 | .261 | |
| AST / FGM | .837 / .788 | .906 | .843 | |
| Seconds / poss | 6.2 / 6.7 | 6.1 | 6.8 | |
| Passes / poss | 1.31 / 1.25 | 1.29 | 1.28 | |
| Top scorer's share | .632 / .622 | .621 | .596 | |
| Highest-overall card's FGA share | .154 / .136 | .150 | .140 | |

Differences, explained:
- **AST/FGM (.906 vs .837)** is a definition, not a change: the audit counted a make after any pass in the possession,
  while `BoxTracker` follows plan §3.1 (the catcher shoots within 2.5 s and at most one move). Fewer, longer
  possessions with one pass go the same way under both.
- **The margin SD (7.6) is not the audit's `scoreSd` (5.2):** the audit printed the SD of one side's score; §3.5's row is
  the SD of the final margin (two sides' variance added).
- **Plan §3.1's own "even 78" (the starting fives' mean rating-scale overall 78, `squadRaw`) plays a little hotter:**
  PPP 1.328 / 1.380, FGA/16 17.1, FTA/FGA .022 / .016, mid FG% .611 / .656. Those squads come from lower displayed
  targets with stronger starters, so they shoot better than the displayed-78 squads. nba-10's fit uses this config.

**§3.1 targets today** (even 78 raw, 150 games, us): PPP 1.33 (target 1.08-1.18), FGA/16 17.1 (13.4-15.4), 3PA/FGA .32
(.35-.45), FTA/FGA .022 (.18-.28), TOV .069 (.11-.15), STL/16 1.07 ✓, BLK/16 0.21 (0.6-1.0), PF/16 0.37 (2.5-3.5), ORB%
.284 ✓, AST/FGM .86 (.55-.68), FG% .546 / 3P% .416 / eFG .613 (all high), rim FG% .618 (.62-.72), mid FG% .611 (.38-.47),
FT% .73 (.74-.80, and-ones only), shot mix rim .31 ✓ / close .08 / mid .29 / three .32 (against 20-38 / 12-25 / 4-12 /
35-45), heavy share .45 ✓, passes 1.26 ✓, seconds 6.3 (6.5-9.5), top-usage FGA share .22 (.25-.36), top scorer .55
(≤ .45), scorers 3.2 (≥ 3.5), PG holds the ball 72% (≤ 45%), C 3PA share .01 ✓, transition 0 (12-17%), ties decided
off the floor 6% (0). 90 v 75: PPP 1.505 v 1.200, win 77%, heavy share .56, passes 1.06.

**§3.1b eras today** (150 squads near 80, by the five's median season): 3PA/FGA 1960-70s .11, 1980s .24, 1990s .46,
2000s .57, 2010s .46, 2020s .56; PPP 1.22 / 1.25 / 1.30 / 1.18 / 1.27 / 1.27. The 2000s shoot the most threes and the
1990s score the most (NBA-05 reproduced); turnovers are 1.0-1.6 per 16 in every era (targets 2.1-3.2).

**§3.5 today:** margin SD 7.6 (4-6), ties 6% ✓; displayed +5 wins 60% ✓, +10 93% (75-85), +20 93% ✓; 96 v 64 median
margin 19 ✓ (15 games each, so these four are rough).

**§3.2 ladder today** (the person against the AI at the same rung, even-78 fives, 20 games per strategy):

| Rung | AI offense PPP / TOV | Median person (σ 50), `mixed` PPP / wins | Skilled (σ 35) `mixed` | Best simple tactic (σ 50) |
|---|---|---|---|---|
| Rookie | 1.39 / .044 | 0.74 / 0% | 0.89 / 15% | step-back 1.15 |
| Pro | 1.29 / .078 | 0.87 / 8% | 0.83 / 15% | step-back 0.98 |
| All-Star | 1.41 / .119 | 0.72 / 5% | 0.88 / 15% | step-back 1.17 |
| Legend | 1.15 / .203 | 0.79 / 30% | 0.72 / 18% | cross-drive 1.19 |

The person scores 0.46-1.19 a trip against the AI's 1.15-1.41 (the audit's "0.4-0.9 against 1.17-1.28" reproduced).
Straight drives are among the worst tactics on every rung (0.48-0.63) and turn the ball over 11-15% of the time on Pro to Legend.
The AI's turnovers run 4% on Rookie to 20% on Legend (NBA-04). Rookie's AI scores *more* than Pro's (the rungs aren't a
ladder: NBA-19).

**§3.3 today** (`curve.test.ts`; open set three, Pro, fresh; σ 50 / σ 35):

| | Green ± today | V2 gold ± | Green rate σ 50 (V2 band) | Make rate σ 50 / σ 35 |
|---|---|---|---|---|
| THR 55, open | 6.6 ms | 30 | .107 (.40-.50) | .423 / .528 |
| THR_avg 73, open | 16.1 | 42.3 | .255 (.55-.65) | .617 / .735 |
| THR 85, open | 25.1 | 50.5 | | |
| THR 95, open | 34.1 | 57.3 | .507 (.70-.80) | .820 / .914 |
| THR 99, open | 36.0 | 60 | | |
| THR_avg, light | 11.3 | 31.7 (×0.75) | .178 (.42-.52) | .503 / .604 |
| THR_avg, heavy | 6.4 | amber | .099 (0) | .258 / .306 ✓ |
| THR_avg, smothered | 3.0 (the floor) | red | .048 (0) | .115 / .132 ✓ |

The rhythm catch is ×1.16 today (V2 ×1.20); a pull-up makes .966 of a set shot (V2 ≤ .90); the window never moves
later with fatigue (V2 +15 / +25 ms). A release placed exactly on the green centre lands up to 13.3 ms off through
today's 60 Hz quantisation (V2 < 1 ms).

**THR_avg** (the three-point rating of a 2024-25 player who shot 36.0% on ≥ 3 attempts a game, the median over the 46
cards within ±1.0%): **73 on the draft engine's scale, 80 on the UT card scale**, re-measured by every calibration run.
The §3.3 windows key off 73; the 7-point gap is with packs (Requests, below).

**§3.11 Moments today** (200 runs, σ 50, the drill's natural strategy): First Light 32%, Own the Paint 35%, Make the
Extra Pass 14%, **The Green Room 17.5%** (V2 band 35-65%), The Closer 15.5%; Training shoot 25 / 9.5 / 7.5%, finish
19.5 / 19 / 14.5%, pass 20 / 12 / 5.5% at pressures -0.6 / 0 / 0.8.

**§3.8 geometry today** (`nba-geo.mjs`, the lab game on `.arcade-full` with the insets injected; V2 value → today).
Today's controls map onto V2's slots as A = SHOOT, B = PASS, C = the SCREEN/CUT/SPACE calls, D = the CROSS/STEP
BACK/SPIN buttons, the stick = today's fixed stick, the toast = the hint line.

| Row | 393×852: V2 → today | 320×568: V2 → today |
|---|---|---|
| A (SHOOT) Ø, centre | 92 (323, 738) → 100 (329, 756) | 84 (266, 510) → 100 (256, 506) |
| B (PASS) Ø, centre | 64 (238, 778) → 70 (246, 685) | 56 (190, 536) → 70 (173, 435) |
| C (calls) Ø, centre | 48 (250, 694) → 44 (122, 190): a strip at the top | 44 (200, 468) → 44 (92, 151) |
| D (moves) Ø, centre | 48 (340, 652), hidden in NBA → 44 (195, 612): three buttons | 44 (282, 436) → 44 (122, 362) |
| Stick ring Ø, centre | 120 (84, 730) → 128 (78, 742), fixed | 104 (70, 496) → 114 (71, 492), fixed |
| Stick zone | x 0-189, y 383-818 → the ring only (x 14-142, y 678-806) | x 0-154, y 256-568 → x 14-128, y 428-556 |
| Score bug | 232×40 at (80, 65) → 281×34 at (56, 67) | 200×34 at (60, 24) → 228×29 at (46, 28) |
| Pause, Heat bar | 44×44 at (12, 63); 232×6 at (80, 108) → absent | 44×44 at (6, 20); 200×5 at (60, 60) → absent |
| Toast line bottom / height | 618 / 28 → the hint, 258 / 38 (mid-court) | 404 / 24 → 231 / 50 |
| Edge gaps A-B / A-C / A-D | 16 / 15 / 18 → 24 / 531 / 124 | 10 / 14 / 12 → 24 / 319 / 124 |
| Right-thumb targets / highest top | ≤ 4 / ≥ 1/3 of the height → 6 / 0.20 | ≤ 4 / ≥ 1/3 → 6 / 0.23 |
| Smallest target, overlaps | ≥ 44, 0 → 44, 0 | ≥ 44, 0 → 44, 0 |
| Handler and rim in the safe box (2,400 frames) | ≥ 98% → 55% | ≥ 98% → 41% |
| Handler under a control | (never) → 23% of frames | (never) → **84%** of frames (NBA-13) |
| Rim / handler's feet, share of the height | 20-24% / 50-55% → 36% / 66% | → 33% / 65% |
| On-ball defender overlap ≤ 35% at releases | ≥ 90% → 50% (10 releases) | → 50% (6 releases) |
| Zoom variation near the rim | ≤ 2% → 12.7% | → 19.5% |
| Stick response | ≤ 1 frame → 2 frames | → 3 frames |
| Smallest DOM text | ≥ 10 px → 10 (CROSS) | → 10 |

- The other sizes (430×932, 375×667 and the four landscape sizes): 0 overlapping controls (round buttons compared as
  circles), smallest target 44, nothing under the insets. At 375×667 the CROSS/STEP BACK/SPIN row covers the handler
  at tip-off; at 320×568 the moves, LAST PLAY and PASS all do (`nba-se.mjs`).
- Rows with no control today: the dead zone is 0 (the stick maps any offset), sprint is at 0.92 × the ring radius
  (inside it), the ring never follows, there are no gestures on SHOOT (moves are buttons or a court swipe), and the stick
  and SHOOT track separate pointers.
- **A thumb resting on the stick before the whistle is ignored for the whole possession** (`nba-deadstick.mjs`):
  0 ft moved in 2.5 s (V2 > 1.5 ft within 300 ms); lifted and pressed again, 1.6 ft in 300 ms (NBA-12 reproduced).
- **Pixel font:** F35 has 42 glyphs; **122 of 3,565 names** in `cards-nba.json` print with holes (Jokić, Dončić,
  Petrović, Marčiulionis…), as the audit found.
- **Duplicate on-court tags:** 76 of 500 courts (1,000 random Squad Battles squads) carry a repeated tag (JORDAN,
  JOHNSON, BROWN, …; V2: 0).
- **The shot clock froze** for 7.2 s at "8" with nobody touching anything (`nba-clock.mjs`, NBA-08 reproduced).

**§3.10 flow today** (`nba-rematch.mjs`, the UT Squad Battles fixture at 393×852, local profile, isolated; re-measured
after the review fix with no capture inside a timed span, on the pre-overhaul code; the first figures in brackets):

| Row | V2 | Today |
|---|---|---|
| Rung tap to the first controllable possession | ≤ 2 taps, ≤ 3.5 s | **3 taps** (the rung, the vote's PLAY, the Arcade's PLAY), **6.45 s** (median of 3 runs: 6.24 / 6.45 / 6.97; first figure 6.6) |
| Skipping the curtain | ≤ 0.3 s | not skippable: the VS card runs its 2.8 s (3.2 s measured) |
| Pause | 0 steps and 0 timers in 10 s; auto-pause on hide | no pause control; a hidden page plays on (10 s of sim in 10 s) |
| Final whistle → onFinish | ≤ 0.3 s | **1.60 s** (the 1.6 s timeout; first figure 1.53) |
| Rematch → first live frame, 4× CPU | ≤ 1.5 s | **2.54 s** (autoplay's 0.4 s VS card, no vote; first figure 2.77) |
| New canvases / renderers per rematch | 0 | a new game canvas and renderer every match; ~13,800 offscreen sprite canvases made per game |
| JS heap, game 3 vs game 1 | ≤ 1.10 | 1.02 (71.4 → 72.9 MB after GC); 1.028 game 2 vs 1 in the re-measure |
| Whistle → next tip-off, with a 5 s result sheet | ≤ 10 s | **13.05 s** (1.60 + 5 + the 6.45 s pre-game a person meets; first figure 13.2) |

**§3.9 performance today** (`nba-perf.mjs`, autoplay lab game, 8 s per sample):

| Size | 1×: median fps, frames > 20 ms, rAF callback p99 | 4× CPU: median fps, frames > 20 ms, callback p99 |
|---|---|---|
| 430×932 | 60, 1.1%, 13.0 ms | 60, **48%**, 49.5 ms |
| 320×568 | 60, 0.2%, 9.8 ms | 60, **21%**, 41.4 ms |
| 852×393 | 60, 0.2%, 9.9 ms | 60, **34%**, 45.3 ms |

The 1× p99 at 430 wide (13.0 ms) is over the 10 ms target; every 4× run is far over 5% of frames above 20 ms. The
per-game churn of offscreen sprite canvases (above) is a likely contributor; it's in players' sprite cache, flagged to
them with this number.

**Captures** at all 8 sizes (tip-off, dribble, meter, release, outcome, sprint drive, finish, crossover, SCREEN call,
pass, LAST PLAY), plus a reduced-motion pass at 393×852 and an autoplay game to the final (`nba-final.mjs`: 45 s at
`slowmo=4`, banners seen: SCREEN & ROLL, POSTERIZED, ALLEY-OOP, DOUBLE TEAM, "MCGEE IS ON FIRE!", FIRE PUT OUT, …).
They show what the audit described: the handler under PASS / LAST PLAY / the move row on small phones, the SCREEN / CUT /
SPACE strip at the top of the screen, and the landscape hint sitting on the handler.

### Verification

- `bash O/heavy.sh npm run typecheck`: clean.
- The standard set (plan §2), through heavy.sh: `npx vitest run src/game/hoops2 src/game/hud src/game/stick.test.ts
  src/game/perfect.test.ts src/game/heat.test.ts src/game/juice.test.ts src/game/play-feedback.test.ts
  src/game/difficulty.test.ts src/ut/match-debrief.test.ts src/ut/content.test.ts src/engine/sport-branches.test.ts`:
  **12 files passed, 5 skipped (the opt-in harnesses), 69 tests passed, 0 failed, 199 s.** The always-on additions took
  2.6 s (determinism) + 5.3 s (box) + 9.8 s (smoke) = 17.7 s in that run, 26.7 s in an earlier one on a busier machine.
- The opt-in harnesses, each run once for the baseline: `NBA_CAL=1` (150 games × 3 configs, then 15 games × 9 configs
  with `NBA_ERA=1`), `HUMAN=1 -t ladder`, `NBA_CURVE=1`, `NBA_MOMENTS=1`.
- Browser: `nba-geo`, `nba-deadstick`, `nba-clock`, `nba-se`, `nba-rematch`, `nba-shots` (8 sizes, plus 393×852 with
  reduced motion), `nba-perf` and `nba-final` against the team's dev server on 5215, each reporting the hosts it
  aborted: none, except the app's own call to the live Supabase host during the UT fixture runs, which was aborted.
- `nba-qa-run.mjs`: refuses `admin-registry.mjs` (exit 2); the preload's dry run reports playwright isolated.

### Review fixes (2026-11-16)

An independent review of nba-1 (`78a1c86..0e788b1`) found one high and five low issues. All are fixed on top of nba-2.

- **High: a shared QA script could reach live hosts past the isolation.** The isolation was a context route only. In
  Playwright a page route runs first, and its `route.continue()` goes straight to the network, so `scripts/qa/content.mjs`
  (which aborts the first card-registry POST and `continue()`s the retry) would have sent a pack registration to the live
  registry through `nba-qa-run`. Fixed with **`scripts/audit/nba-guard.mjs`**, which both `nba-lib.mjs` and the preload now
  install:
  - every route handler on any page or context is wrapped, and the first route patches Playwright's Route class once:
    `continue()` and `fetch()` to a host that isn't allowed abort instead (fetch then throws), whatever `url` override
    they carry; the HAR redirect too. `fallback()` ends at the context's abort-everything route.
  - a page-level `routeWebSocket` handler's `connectToServer()` to such a host closes the socket.
  - `APIRequestContext` (`page.request`, `context.request`, `playwright.request.newContext`, `route.fetch`) refuses such
    hosts before sending.
  - `unroute` / `unrouteAll` can't remove the guard route (it goes straight back).
  - every context blocks service workers (their requests never pass through routes), and a remote `baseURL` is refused.
  - the CDP Fetch domain and request interception, browser-level CDP sessions, persistent profiles, `launchServer` and
    connecting to an outside browser are refused.
  - in node: `fetch`, `WebSocket` and `http(s).request/get` to such a host throw.
- **`scripts/audit/nba-qa-selftest.mjs`** proves it, and `nba-qa-run` runs it under the same preload before every script and
  refuses the run if it fails. Two local servers stand in for the two kinds of host (127.0.0.1 allowed, 127.0.0.2 not):
  every probe must reach 127.0.0.1 (so it really fires) and never 127.0.0.2. **With the guard: 19/19 hold. Against the
  nba-1 isolation (`0e788b1`): 15 of 19 fail**, including the reviewer's case, `page.route + continue()` on a
  `/functions/v1/card-registry` POST, which reached 127.0.0.2.
- **End to end:** `node scripts/audit/nba-qa-run.mjs scripts/qa/content.mjs` against 5215: self-test passed, and the
  script's `continue()`d registry retry was aborted (the only host recorded is the live Supabase host; the script then
  timed out waiting for the pack it couldn't register, as expected for a run that may not register anything).
- **`nba-qa-run`'s static gate now follows local imports transitively** (relative `import`, `import()`, `require`) and
  refuses a remote host or a refused script anywhere in that tree, and a file outside the worktree. Checked with a
  throwaway script importing a helper that names a remote host: refused, naming the helper. It also clears
  `PS_QA_PROXY` for the child.
- **Low: no golden pinned the engine's outcomes.** New **`golden.test.ts`** (always on, 3.3 s): 6 seeded AI games
  (`aiPossessionsOf`'s exact body) and the same autoplay loop with every possession's end and final clock, recorded on
  the base `78a1c86` (`NBA_GOLDEN_RECORD=1`). Today's engine, nba-2 included, matches byte for byte. The Protocol section
  now cites it.
- **Low: the transcendental scan missed trig and `hypot`.** `determinism.test.ts` now counts `sin/cos/tan/asin/acos/atan/
  atan2/hypot` too, with the base's per-declaration counts grandfathered (engine.ts 18 declarations, autopilot.ts 3,
  ratings.ts 2), and also scans `src/game/heat.ts` and `perfect.ts` once they land. It found one new call from nba-2:
  `driving()` used `Math.hypot` for the handler's speed; it now uses `Math.sqrt(vx² + vz²)` (correctly rounded on every
  engine). `driving()` only picks a person's euro-step, never the AI (the golden is unchanged), and nba-2's protocol line
  already covers a person's moves.
- **Low: targets.ts lacked nba-1's baselines.** The new rows now carry them: every §3.8 geometry row from `nba-geo.json`
  (`GEO_BASELINE`, both sizes), the camera, safe-box, stick, text, tag and glyph rows, §3.9 perf (`perf.1x.p99Ms` 8.9 →
  **13.0**, the worst of 13.0 / 9.8 / 9.9 ms; the 4× rows) and §3.10 flow. Rows for things that don't exist yet (pause
  button, Heat bar, gold ring, haptics, grades) have none, which the `baseline` doc comment now says.
- **Low: `nba-rematch.mjs` timed its own screenshots.** The pre-game is now timed in a pass that only polls and taps; a
  second, untimed pass takes the captures and the VS-tap check, and also reports the old single-pass number for
  comparison. Whistle → result is timed before its capture, and the loop is the sum of its timed parts. Measured on the
  pre-overhaul code, the inflation was within run-to-run noise: the capture pass took 0.67 s of screenshots yet came out
  at 6.10 s against 6.45 s for the clean pass, because the captures overlap the VS card's and the vote's own timers. The
  §3.10 table above has the re-measured figures (pre-game 6.45 s, loop 13.05 s).

Verification: `bash O/heavy.sh npm run typecheck` clean; `npx vitest run src/game/hoops2 src/game/stick.test.ts
src/game/hud src/engine/sport-branches.test.ts`: 13 files passed, 5 skipped (opt-in), 80 tests passed; the guard
self-test 19/19 (and 15 failures against `0e788b1`, the negative control); `nba-rematch.mjs` against the pre-overhaul
code; `nba-qa-run` on `content.mjs` and on `admin-registry.mjs` (refused).

---

## nba-2 · The shared controls: geometry tokens, floating stick, A/B/C/D cluster, gestures on A, CALL with ISO, tap-to-pass, toast line, pause (2026-11-16)

### What changed

The whole control layer of a basketball game, rebuilt on V2 A.5's thumb geometry, as shared pieces nfl
and soccer mount too ([`shared-controls.md`](shared-controls.md) has the mounting guide and a 20-line
example).

- **Shared files (plan §4.1-4.3, §4.7):** `src/game/controls-geometry.css` (the A.5 table as tokens on
  `.ps-geo`, interpolated with `clamp()` between the 320 and 393 values; `.ps-geo.land` for sideways),
  `src/game/stick.ts` + `Stick.tsx`, and `src/game/hud/` `gestures.ts`, `Cluster.tsx` (with `Radial`),
  `ToastLine.tsx`, `PauseButton.tsx`, `PauseSheet.tsx`, `prefs.ts`, `feel.ts`, `timers.ts`, `hud.css`,
  `index.ts`.
- **Look (V2 C.3, the mockup's NBA phone):** A is a lit gold sphere with the ball icon and a dark label,
  B teal with the pass arrow, C dark glass with a 1.5 px stroke ring, a white SVG play icon and a 10 px
  label; SVG direction labels round A (▲ SPIN, ◀ CROSS, ▼ STEP); the floating stick is a teal knob in a
  dashed gold ring that turns gold past the sprint ring; a bottom scrim; the pause button and sheet are
  bevelled glass with a gold RESUME.
- **NBA wiring** (`hoops2/HoopsControls.tsx` maps the plan §5 contexts to slots; the loop stays in
  `Hoops2.tsx`):
  - **SHOOT (A):** touch-down starts a provisional gather with the meter timed from the touch's own
    timestamp (`pressShoot(p, { at, provisional: true })`); he leaves the floor at 125 ms. A tap is a
    **pump fake** (`pumpFake`), a swipe takes the gather back for free and is the move: ← / → crossover,
    ↓ step-back, ↑ spin, and **euro-step** (`euroStep`) on ← / → while driving. The release is timed from
    the lift's timestamp too.
  - **PASS (B):** a 120 ms wind-up to the man the stick aims at (else the most open); still held at
    120 ms it's a **lob**: an alley-oop to a dunker near the rim even before he cuts, a lofted pass to
    anyone else (slower, half as easy to jump).
  - **CALL (C):** a radial with **SCREEN / CUT / ISO**, fanned up and right of C so it never reaches the
    stick's zone. Slide from C and lift on an item, or tap the item. **ISO** (`callPlay(p, 'iso')`)
    clears the other four to the weak side and gets the ball to the top-usage card on the strong wing
    (`isoStar`: overall, then his best way to score; nba-8 swaps in the real usage split).
  - **Tap a teammate** to pass to him (a 52 px circle round each man): anywhere outside the stick's
    zone, or anywhere while the stick is held by another finger. A stick finger can never pass.
  - **BOARD** in a rebound race (B and C hidden); dead balls dim the cluster; D is hidden.
  - **The dimmed state comes from the loop** every frame (`offOf` → `data-off`), NBA-18.
  - **Buttons-only** (pause sheet → Controls): tap = pump, hold = shot, no swipes; CROSS / STEP / SPIN as
    three 46 px buttons round D's spot, firing on down.
- **The engine** (`engine.ts`, protocol below): the provisional gather and `cancelGather`; `pumpFake`
  (one per 0.8 s; his closest defender bites from `p.rand` by the shooter's threat from there against
  his perimeter defense and the defense's discipline, and leaves his feet); **"make him land"**: a man who
  bit and is still in the air contests one tier lighter; `euroStep` and `driving`; `pass(p, to, lob)`;
  `callPlay(p, 'iso')` with the weak-side clear-out and the feed; `step(p, dt, stick, sprintHeld?)`, so
  the floating stick's own sprint ring (1.15 R) decides sprint for a person, while the autopilot and the
  tests keep the old rule. `render.ts` draws `pump` and `euro` with existing poses until players' land.
- **The toast line** replaces the hint strip and the mid-court `.hg2-pop` banners: one line above the
  controls (bottom edge 618 at 393×852), priorities hints 0 / calls and banners 1 / results 2. The
  one-line hints show once per device (prefs `hints.nba`): the stick, SHOOT, PASS, CALL, and BOARD.
- **Pause (offline):** the 44 px button top-left; `PausableTimers` carries every delayed match step (the
  next possession, replays, the buzzer, the fire banners, the hints); stepping and the juice freeze; the
  toast's clock stops; a hidden page or `pagehide` pauses by itself. The sheet has RESUME, Controls
  (Gestures / Buttons), a four-line controls guide, and QUIT GAME → "QUIT THIS GAME? It counts as a
  loss." → `onQuit`. `Arcade.tsx` ends the game at once with the unplayed possessions as empty marks and
  `onFinish(..., forfeit 'us')`; the draft host and UT's `Match.tsx` settle it as a loss whatever the
  score. **Online** the button opens the same sheet titled "THE GAME KEEPS GOING" with Resume only
  (forfeit lands in nba-9).
- **Haptics through `feel.ts`:** `tick` on the sprint edge and the CALL pick, `long` on a turnover.
- **Copy:** `Arcade.tsx`'s NBA tip-off card describes the new controls; the score bug takes its V2
  width (232 / 200) and drops the "5/16" (the marks row under it shows it); LAST PLAY moves out of the
  stick's zone to the top-left, under the look chip.
- **Removed (dead after this):** the CROSS / STEP BACK / SPIN button row and its CSS, the SCREEN / CUT /
  SPACE strip and its CSS, the court-swipe layer, the fixed stick. SPACE is now ISO (V2).

### Before → after (`scripts/audit/nba-controls.mjs`, CDP touch, the dev server on 5215, isolated)

Before = nba-1's `nba-geo.mjs` baseline above. After = run on 2026-11-16 (JSON and captures in
`O/shots/nba/nba-2/`).

| Row | 393×852 (59/34): before → after | 320×568 (20/0): before → after | V2 |
|---|---|---|---|
| A Ø, centre | 100 (329, 756) → **92 (323, 738)** | 100 (256, 506) → **84 (266, 510)** | exact |
| B Ø, centre | 70 (246, 685) → **64 (238, 778)** | 70 (173, 435) → **56 (190, 536)** | exact |
| C Ø, centre | a strip at (122, 190) → **48 (250, 694)** | (92, 151) → **44 (200, 468)** | exact |
| D (hidden in NBA; token rect) | 3 buttons at (195, 612) → **48 (340, 652)** | → **44 (282, 436)** | exact |
| Stick ghost Ø, centre | 128 (78, 742), fixed → **120 (84, 730)**, floating | 114 (71, 492) → **104 (70, 496)** | exact |
| Stick zone | the ring only → **x 0-188.6, y 383.4-818** | → **x 0-153.6, y 255.6-568** | 0-189, 383-818 / 0-154, 256-568 |
| Pause | absent → **44×44 at (12, 63)** | → **(6, 20)** | exact |
| Score bug | 281×34 at (56, 67) → **232×40 at (80, 65)** | 228×29 → **200×34 at (60, 24)** | exact |
| Toast line bottom / height | the hint at 258 / 38 → **618 / 28** | 231 / 50 → **404 / 24** | exact |
| Edge gaps A-B / A-C / A-D | 24 / 531 / 124 → **15.9 / 15.2 / 17.7** | 24 / 319 / 124 → **10.3 / 14.2 / 11.7** | 10-18 |
| Rects off by more than 2 px | — → **0** | → **0** | 0 |
| Right-thumb targets / highest top | 6 / 0.20 of the height → **3 / 0.786** | 6 / 0.23 → **3 / 0.785** | ≤ 4 / ≥ 0.667 |
| Overlaps, smallest target | 0, 44 → **0, 44** (Buttons-only too) | → **0, 44** | 0, ≥ 44 |
| Handler under a control (tip-off + 30 frames of a drive) | 23% of frames → **0** | **84%** → **0** | never |

- **The other six sizes** (430×932, 375×667, 852×393, 932×430, 667×375, 568×320): 0 overlaps, smallest
  target 44, nothing outside the insets (the stick's zone now starts at `--sal`), the handler under no
  control at tip-off.
- **Pre-held thumb (NBA-12):** a thumb pushed 300 ms before the whistle moves the handler **3.6 ft in the
  first 300 ms** of game time (before: 0 ft for the whole possession; V2 > 1.5).
- **Stick response:** the ring is drawn and the game's input set in the **same frame** as the touch (0
  frames); a move reaches the game **1 frame** later (before: 2 frames at 393, 3 at 320; V2 ≤ 1).
- **Sprint edge:** a push out past 1.15 R and wobbling out there fired **exactly 1** `tick`.
- **Two pointers:** the stick held and SHOOT pressed together: the handler moved 2.7 ft and the shot
  went up.
- **Accidental passes from 24 stick touches** (taps and drags all over the zone): **0**.
- **Gestures in the game:** tap → `pump` (no shot), hold → the shot, L / R → crossover, U → spin, D →
  step-back. Tap a teammate → a pass to him; B held → a lofted pass (`high`); B tapped → a pass.
- **CALL → ISO:** the star had the ball **0.79 s** after the pick (1.08 s of game time; V2 ≤ 2 s).
- **Pause:** over 10 s, **0 engine steps, 0 timer callbacks**, the clock held; the paused-and-resumed
  autoplay game ended with **the same marks** as the uninterrupted one (`2 X 2 2 X A 2 X 2 2 X 2 2 2 X 2`).
  A hidden page paused the UT game by itself (0 steps in 3 s). **Quit** in a Squad Battles game → the
  result screen says **LOSS** (0-11).
- **0 page errors.** Requests to other hosts: none from the lab; the UT fixture's own call to the live
  Supabase host was aborted (as in nba-1).

### Tests (all new; the standard set is green, see Verification)

| Test | What it proves |
|---|---|
| `src/game/stick.test.ts` (9) | spawn in the zone only, home band, a second finger ignored; 12% dead zone and the linear rescale; sprint at 1.15 R with exactly one edge per push out; no sprint ring when asked; the ring follows past 1.6 R and turns back at once; never-null output; a held direction survives; fixed (permanent) mode |
| `src/game/hud/gestures.test.ts` (6) | 200 jittered gestures per class (tap, hold, four swipes) through the cluster's own tracker: **0-4 misreads per class allowed, ≤ 2%**; the thresholds; `down` delivered on the finger's down; two fingers tracked on separate slots; a swipe goes out once; the OS cancel clears everything |
| `src/game/hud/prefs.test.ts` (5) | missing / corrupt / old-shape / bad fields → defaults; read-modify-write with the per-sport maps merged; no other key touched; a hint once per device; no storage at all |
| `src/game/hud/pause.test.ts` (3) | 10 s of pause run 0 callbacks, each job then runs after the time it had left, in order; jobs set while paused wait; cancel / clear; double pause / resume are no-ops |
| `src/game/hoops2/controls.test.ts` (13) | the gather's meter runs from the touch and rises at GATHER_S; a swipe cancels it at no cost and the move goes at once; an early lift still shoots; the pump fake never shoots, one per 0.8 s, baits by rating (95 shooter on a 60 defender far more than 55 on 95), and a bitten man in the air contests a tier lighter; the euro-step on a drive; the lob and the lofted pass; **ISO puts the ball in the star's hands within 2 s in > 95% of 120 seeds** and the four clear out; the §5 slots; the loop's dimmed state; **the AI's race is byte-identical to nba-1** (18 seeded autopilot games against a golden recorded at `0e788b1`) |

`cluster.test.ts` in the plan became the tracker half of `gestures.test.ts` (the install has no jsdom,
and adding one is a heavy dependency); the DOM half is the browser probe's two-pointer and gesture
checks.

### Verification (nba-2)

- `bash O/heavy.sh npm run typecheck`: clean.
- The standard set (plan §2) through heavy.sh: 16 files passed, 5 skipped (opt-in), 104 tests passed;
  the one failure on the first run (`gameplay.test.ts`, "does not cancel a committed shot or a finish")
  was a real regression, fixed: an OS cancel now takes back only a jumper's gather, and a finish already
  under way plays on as before. Re-run: `gameplay`, `controls`, `hud`, `stick` 51/51.
- `node scripts/audit/nba-controls.mjs` against the dev server on 5215 (all sections, then `--only=play,quit`
  after the last edits): the numbers above, 0 page errors.

### Reduced motion (plan §3.15 rows)

| Element | With reduced motion |
|---|---|
| toast-line words | no pop scale, no slide-in; colour kept |
| CALL radial | instant (no spring) |
| pause sheet | no fade or rise |
| buttons | no press-sink |
| stick ghost | no fade |

Captured at 393×852 with `reducedMotion: 'reduce'` (`ctl-393-reduced-motion.png`).

**Protocol bump needed: NBA draft + UT**, because a person's possessions now play differently: the pump
fake and "make him land" change contests, ISO moves the four and feeds the star, the euro-step and the
lob are new actions, the gather is timed from the touch, and the floating stick's sprint ring replaces
the 0.92 edge. The AI's possessions are unchanged (the golden test).

---

### Review fixes (nba-2, 2026-11-16)

An independent review of `0e788b1..98cb6ed` found 11 issues; all are fixed except the bundle-size one, which is
measured in nba-10's build (below). Probe: `scripts/audit/nba-controls-fix.mjs` (CDP touch, isolated), JSON and
captures in `O/shots/nba/nba-2-fix/`.

| # | Severity | Issue | Fix | Measured after |
|---|---|---|---|---|
| 1 | high | A tap on SHOOT could come out as a **shot**: the jumper rose on the meter's backdated clock (touch time + 125 ms), often before the lift's handler ran, so a 90-121 ms tap found him in the air | The **gesture decides**, not the engine's clock. `HoopsControls.liftShoot(p, tap)`: a tap is a pump fake while he's on the floor, and still one if the gather rose ≤ `UNRISE_S` (60 ms, three frames) before the lift was heard; the new `unrise()` takes that rise back (the shooter and the man who closed out with him come back down exactly as they were). And the rise now waits `GATHER_S` on the **handler's** clock (`Meter.gatherAt`, the game time the down was heard); only the meter's `t0` stays backdated, so release timing is unchanged | Browser: **24 / 24** taps of 89-119 ms (event timestamps), lift heard 21-67 ms late, are pump fakes, 0 shots (review: 6 / 6 shots). Unit: 84 tap / lag / late-frame combinations (90-115 ms, 0-60 ms lag, 0-3 frames late) all pump fakes |
| 2 | medium | An offline **Quit paid the full loss reward** (+30 coins, card XP, +80 season points): a 3-second loop where SIM isn't offered | `settle()` takes `forfeit` (ut's `play.ts`, small additive hunk): **no coins, no card XP, no season points, no paid game used**; the loss is recorded once and Cup / Club Season / Circuit advance. `settleDraft` too (no season points). `Match.tsx` passes it, skips Evolution progress, and the result screen says "You quit this game: it counts as a loss and pays no coins, XP or season points." | `src/ut/forfeit.test.ts` (3): Squad Battles, a forfeit-win rejected, a Cup round. Browser (`nba-controls.mjs --only=quit`): Squad Battles quit → "LOSS 0 – 8 … You quit this game: it counts as a loss and pays no coins, XP or season points", no reward lines |
| 3 | low | A quit could report **us > them** with a loss; Cup and Club Season settlement reject that pair and recorded nothing | `Arcade.quit()` reports the rival at `max(their score, ours + 1)` | the Cup forfeit test settles |
| 4 | medium | LAST PLAY (then top-left) sat under the **Moments / Training Camp** Leave button | nba-3 moved LAST PLAY to the top-right beside the bug; the probe then found its opened card under Camp's **Restart** button. LAST PLAY is now **hidden in practice** (Camp and Moments report each attempt in their own overlay) | Camp and Moments at 393 and 320, overlays placed at a real phone's `env(sat)`: **0 overlaps** with the pause button |
| 5 | medium | Buttons-only: the open **CALL radial landed on CROSS / STEP / SPIN** (5 overlaps per size) | `Cluster` takes `arcOff`; NBA hides the move arc while the radial is open (it comes back when the radial closes) | radial open: **0 overlaps** in Gestures and Buttons-only at 393 and 320; arc back after close |
| 6 | low | A near-instant tap on CALL picked a radial item (ISO) from under the finger while the menu was still opening | `onC` up reads the item under the finger only after a real slide (≥ `TAP_PX`) or a non-tap | quick tap: radial **open, nothing picked** (both sizes, both modes) |
| 7 | low | Swipe labels rendered at 9.25-9.75 px; STEP ran off the bottom at 320×568 / 375×667 | labels 11.5 user units (**10.64 px at 320, 11.07 at 375, 11.21 at 393**); the down hint is arrow-and-word side by side in the band under A | all labels and arrows inside the screen at 320 / 375 / 393 |
| 8 | low | The toast line covered the handler at tip-off | re-checked with nba-3's camera | **0 of 53** sampled frames with a toast had the handler under it (393 and 320) |
| 9 | low | `PauseSheet` had basketball copy | `quitNote` prop, neutral default ("The rest of the game scores nothing."); NBA passes its possessions line | — |
| 10 | low | `Stick.tsx` and `stick.ts` differed only in case (misresolves on macOS / Windows) | renamed to **`StickPad.tsx`** (the component is still `Stick`; `src/game/hud` re-exports it) | contract log below |
| 11 | low | Moments imports Hoops2 statically, so the HUD kit loads with UT (plan §3.9's +2 KB UT budget) | not changed: needs a build to measure, and full builds are for final QA. **nba-10 measures it**; if it's over, the Moments game is lazy-loaded like Training | — |

Verification: `heavy.sh npm run typecheck` clean; `heavy.sh npx vitest run src/game/hoops2 src/game/hud
src/game/stick.test.ts src/ut/{forfeit,cup-settlement,match,league,overhaul,cup}.test.ts
src/engine/sport-branches.test.ts`: 22 files passed (5 opt-in skipped), 152 tests, golden and determinism green.
Browser: `nba-controls-fix.mjs` (all sections) and `nba-controls.mjs --only=quit`, 0 page errors; the only
aborted outside request is the UT fixture's Supabase call (as in nba-1).

Tests added: `controls.test.ts` +3 (late-heard taps, the handler-clock rise, hold / late lift / released shot never
taken back; the existing gather test now times the rise from `gatherAt`), `src/ut/forfeit.test.ts` (3).

**Protocol:** no new bump. The provisional gather is a person's input only (the AI never uses it; the golden
autopilot test is unchanged), and it's already inside nba-2's "Protocol bump needed: NBA draft + UT".

## nba-3 · The frame: three-quarter camera, action-safe box, score bug and Heat bar, live clock, readable text, held arena (2026-11-16)

### What changed

What a player sees: a new broadcast camera; a glossy score bug with a Heat bar under it; a shot clock
that counts every second; names spelled with their accents' letters; the scorer plate and one badge a
possession in the toast line; and, in hosts that use it, the next game tipping off in the same arena.

- **The camera** (`hoops2/camera.ts`, pure; the camera section of `render.ts`):
  - **The view (V2 B.1.3):** a high three-quarter half-court view, pitched 55° down and yawed 12° off the rim line.
  - **Placement:** the camera pans on its own axes, `a` across and `b` along, so a pan across never changes a
    point's depth. That keeps the zoom fixed.
  - **Framing:** the rim is pinned at 16% of the safe box down from its top (22% of the height at both V2 sizes).
    The zoom is set by the safe box's height (39 ft of floor), so every phone frames the same floor.
  - **The follow:** a ±3 ft dead zone across, which leans 35% toward a ball in the air. Damping is time-based
    (`1 − e^(−k·dt)`), so 30 and 60 fps settle to within 0.5 px.
  - **Hard limits:** the follow is clamped every frame to stay inside the safe box. The rim stays 40 px under
    the HUD (the Heat bar, or the toast line when sideways). The handler's feet stay above the box's bottom,
    then his head below its top. The handler keeps 34 px from the screen's sides, and the rim and backboard
    keep 60 px.
  - **On a shot:** it holds the shooter (the focus moves ≤ 2 ft in the test) and tilts 2% toward the rim. The
    tilt moves the axis row, not the camera, so the zoom never moves.
  - **Zoom:** fixed within 26 ft of the rim. Out at the tip-off walk it eases back up to 25%, so the man and the
    rim both fit. While the ball is in the air its distance counts, so a pass into the paint brings the zoom home.
  - **Clutch and replays:** Clutch is 6% tighter (not with reduced motion); a replay is 1.35× on its spot.
  - **Turning the yaw:** a turn orbits the camera round the rim, so a change of sign never reads as a pan or a zoom.
  - **The yaw rule (`yawFor`):** the sign is chosen so the man with the ball and the man guarding him
    separate on screen, with 1 ft of hysteresis. It is the same rule on defense.
  - **V2's "your basket at the bottom" (`v2b`)** is in the camera's math: the base yaw is π and the rim is
    framed at the box's bottom. It is unit-tested for the defensive overlap. It shows on screen once nba-6
    plays defensive possessions: wiring `?arcade&cam=v2b` to them is nba-6's (Left undone).
  - **Players' drawings:** facing and look-down angle are taken relative to the yawed camera
    (`facingIndex`, `pitchAt`). This is one hunk in the players' section of `render.ts` (Touched outside my lane).
  - **The stick:** it turns with the camera (`stickToCourt`): up the screen is the camera's forward.
- **The floor** (`hoops2/floor.ts`): players' court picture and wall of fans (`courtTexture`), cast through the
  yawed camera.
  - A screen row meets the floor on a straight line, so whole-floor rows step two adds a pixel. Only rows that
    reach the stands are cast pixel by pixel.
  - **NBA-29:** the last cast is reused while the camera has moved under half a pixel (`floorStats`). A cast
    costs 0.7 ms (median) at 430×932 at 1×.
- **HUD kit, part 2** (`src/game/hud/`, plan §4.3; nfl and soccer mount the same pieces):
  - **`ScoreBug`:** a 232×40 capsule (200×34 on the SE). It has two skewed team blocks in the kits' colours
    (the trim for a white away kit), big italic scores, a dark centre with the period and the possession
    (`1ST · 5/16`), and a glowing shot clock that turns red and pulses at ≤ 5 s.
    - It has a 3 px possession line along the bottom.
    - In the last 4 possessions it turns gold and reads CLUTCH. OT is violet; the phase is wired in nba-6.
    - LAST PLAY is a 44 px icon beside it, mirroring the pause button (`aside`; `PlayReadout icon`).
    - The bug and the Heat bar CSS are in `bug.css`.
  - **`HeatBar`:** 232×6 under the bug, with an inset track, a gold-to-red fill with moving stripes, the
    HEATING UP tick at 66, the rival's thin violet line, and the stage word. It is fed zeros until `heat.ts` (nba-4).
  - **`geometry.ts` `readGeometry(el)`:** reads the safe box, the HUD's bottom edge, the toast and the cluster
    as pixels, from hidden probes positioned by the tokens. It is re-read only when the size or the
    orientation changes.
  - **Removed (dead after this):** the old `.hg2-bug`, the marks strip and the defense-look chip. The look
    is read in the toast line at the start of each possession ("MAN-TO-MAN · beat your man").
- **The shot clock (NBA-08):** written from the rAF loop straight into the bug's element, only when
  `ceil(p.clock)` or the warning changes.
  - The warning shows at ≤ 5 s, and `sfx.tick()` plays each new second under 4 s.
  - A violation reads 0 before the buzzer and the toast.
- **Text (NBA-22)** (`hoops2/labels.ts`):
  - **`foldName`:** NFD with the combining marks dropped. Ø Ł Đ Ð ß Æ Œ Þ, Cyrillic look-alikes and curly
    quotes are spelled out.
  - **F35:** adds `& / : + ( ) ,` and a middle dot.
  - **`uniqueTags`:** J.JOHNSON / M.JOHNSON, then JA. / JE., then a number. It applies across both fives and
    the bench, at game creation, to display copies only: the engine's numbers and the AI race are untouched.
  - **`layoutLabels`:** chips are placed by priority (the meter's words, then the handler's name, the pass
    target, the shot %, the play call). Each is nudged up or down to find room, else left out. Chips anchored
    off the screen's side are dropped.
  - **Chip size:** chips are 7 art px tall (14 px) on a dark plate.
- **The toast line:**
  - **The scorer plate** ("CURRY · 3PT · 11 PTS", points from a `BoxTracker` that the screen now runs).
  - **One badge pop a possession**, through `BADGE_LABEL` with original names (escalation 2): Ice Water, Deep
    Range, Poster Maker, Lockdown, Paint Wall, Ankle Taker, Table Setter. The top tiers read Elite / Legend.
  - The badge pops over heads are gone.
- **The pass target (NBA-16):** a teal ring at his feet, and a chip with his name and his shot as it will be
  when the ball gets there.
  - The shot comes from `catchChance` (autopilot.ts): his man's closeout during the flight, the same closeout
    `catchValue` reads, through the new `shotChanceWith`.
  - It is read-only and takes no draw on `p.rand`. `catchValue` shares the closeout helper and its results are
    unchanged (golden).
- **The held arena (plan §4.8, V2 D.1):**
  - **`Arcade` changes:** `Arcade` is now a `forwardRef`. It takes `hold` and exposes
    `ArcadeHandle.rematch(next?)`.
    - The first match follows the host's props exactly as before.
    - A rematch plays a new seed (by default `<seed>:r<n>`), with an optional new rival, team or lineup.
    - Offline only: online, `rematch` does nothing.
  - **With `hold`:**
    - Hoops2 reports done at the whistle itself and Arcade calls `onFinish` with no delay.
    - The court stays mounted, dimmed by its own layer (`held.css`); the in-game final card is not shown.
  - **On a rematch:**
    - Hoops2 builds a new `HoopsGame` and keeps the same renderer, canvas and sprite caches
      (`renderer.reset`).
    - The opponent curtain shows the rival and his five, tap to skip. It counts its 1.4 s from the rematch
      call, inside V2's 1.5 s.
    - The rematch's AI side is worked out a possession per task (`aiPossessionsLater`, autopilot.ts) behind the
      curtain, so it never blocks a frame.
  - **nfl and soccer** remount on a rematch (`key`) until they adopt the in-place version.
  - **The stub host:** `HeldLab.tsx` (`?arcade&hold`, one line in `Lab.tsx`): whistle → a 5 s stub sheet →
    `rematch()`.
- **Probes:** `nba-hud.mjs` (§3.8 rows live, 8 sizes), `nba-held.mjs` (§3.10 held rows), `nba-clock.mjs` (now
  against the engine, every frame and at 20 Hz), `nba-frame-shots.mjs` (the captures). `nba-lib`'s `openLab`
  waits on the new bug clock.

### Before → after

**Camera** (`camera.test.ts`, `NBA_CAM=1`: the engine's own autoplay frames through both cameras, 6 games at
393/320 and 3 elsewhere; before = the 143eee7 camera re-implemented in the test):

| Row (V2 target) | 393×852 before → after | 320×568 before → after | 430 / 375 after | 852 / 568 sideways after |
|---|---|---|---|---|
| Rim row (0.20-0.24) | 0.385 → **0.220** | 0.359 → **0.216** | 0.215 / 0.193 | 0.364 / 0.419 (below the top HUD) |
| Handler's feet, median (0.50-0.55) | 0.661 → **0.536** | 0.661 → **0.522** | 0.514 / 0.501 | 0.772 / 0.778 |
| Handler and rim in the safe box (≥ 0.98) | 0.555 → **0.996** | 0.387 → **0.994** | 0.996 / 0.991 | 0.986 / **0.891** |
| Zoom variation near the rim (≤ 0.02) | 0.206 → **0.017** | 0.206 → **0.020** | 0.016 / 0.022 | 0.013 / 0.000 |
| Jump-shot releases, defender hides ≤ 35% (≥ 0.90) | 1.00 → **1.00** (98) | 1.00 → **1.00** | 1.00 / 0.94 | 1.00 / 0.97 |
| All releases (finishes too) | 0.933 → 0.882 | 0.899 → 0.882 | 0.957 / 0.852 | 0.978 / 0.957 |

- **Overlap definitions:** shoulder-wide silhouettes (1.7 ft), each drawn where he is, in the air too. With
  nba-1's 2.4 ft box, all releases score 0.824 → 0.849 at 393.
- **Why finishes miss:** a chase-down from right behind a layup can't be split by any 12° view. Every miss is a
  finish with the defender trailing 1-2.5 ft straight behind.
- **Either man hiding the other:** 0.866 → 0.765 at 393 and 0.605 → 0.765 at 320. The steeper view stacks a
  trailer under the man in front more often.
- **The defensive yaw rule:** 1,000 synthetic releases (AI shooter 6-26 ft out, your man 2.5-5 ft toward the
  rim, ±1.5 ft across). It holds in **977/1000** looking up the floor and **964/1000** in `v2b`, against
  948 with one fixed sign in `v2b`.

**Live, in the browser** (`nba-hud.mjs`, 900 autoplay frames a size, isolated; the safe box read by the game):

| | 393 | 320 | 430 | 375 | 852L | 932L | 667L | 568L |
|---|---|---|---|---|---|---|---|---|
| Bug, pause, Heat bar rects ±2 px | ✓ ✓ ✓ | ✓ ✓ ✓ | | | | | | |
| Safe box = the table (115-568 / 76-368) | ✓ | ✓ | | | | | | |
| Rim row | 0.220 | 0.216 | 0.215 | 0.193 | 0.364 | 0.346 | 0.374 | 0.419 |
| Handler median | 0.494 | 0.513 | 0.526 | 0.505 | 0.849 | 0.736 | 0.875 | 0.821 |
| In the safe box | **1.000** | **0.994** | 0.994 | 0.993 | 0.981 | 0.991 | 0.968 | 0.824 |
| Zoom variation near the rim | 0.008 | 0 | 0 | 0 | 0.004 | 0 | 0.005 | 0 |
| Frames with a DOM element within 40 px of the rim | **0** | **0** | **0** | **0** | 4 | 0 | 12 | 107 |

- **Before (nba-1, `nba-geo.mjs`):** rim 0.36 / 0.33 of the height, handler 0.66 / 0.65, safe box 0.55 / 0.41,
  zoom variation 12.7% / 19.5%.
- **The handler median:** the 393 live median (0.494, one 900-frame slice of one lab game) sits just under the
  band. Over 6 simulated games it is 0.536.
- **The sideways contacts:** all are the toast line's bottom edge meeting the rim's 40 px margin when a toast
  is up.

**Shot clock** (`nba-clock.mjs`, 20 s untouched at 393): **0 of 401** 20 Hz samples differ from
`ceil(p.clock)`, **0** mismatch runs over a frame, the longest still value while live is **1.0 s**
(before: "8" for 7.2 s), and the warning is on exactly at ≤ 5 s.

**Text** (`labels.test.ts`):
- **Glyph misses:** names with holes went from 122 of 3,565 to **0** (plus every tag).
- **Duplicate tags:** courts with a duplicate tag went from 76 / 500 (nba-1's draw) to **0 / 500**. The
  test's own draw has more than 10 courts that collide before the fix.
- **Chip layout:** **0** overlaps in 1,000 clustered frames.

**Held arena** (`nba-held.mjs`, 393×852, `?arcade&hold&auto`, each game fast-forwarded to its last possession):

| Row (V2) | Before (nba-1, UT flow) | After |
|---|---|---|
| Whistle → onFinish (≤ 0.3 s) | 1.60 s | **0.009-0.013 s** |
| rematch() → first live frame at 4× CPU, curtain included (≤ 1.5 s) | 2.54 s | **1.40 / 1.42 s**, one run 2.70 s |
| A tap on the curtain → live | not skippable | **0.25 s** |
| New canvases / renderers per rematch (0) | a new canvas and renderer every match | **0** (identity kept, 5 rematches) |
| JS heap after the 5th rematch vs the 1st (≤ 1.10) | — | **1.035** (24.95 → 25.83 MB) |
| Whistle → next tip-off with a 5 s sheet (≤ 10 s) | 13.05 s | **6.55 s** |

The 2.70 s run: the third 4× rematch in a row came in late in each of three runs, while the first two were
on 1.40-1.52 s. It is recorded, not explained (Left undone).

**Frame budget** (`nba-perf.mjs`, autoplay, 8 s per sample):

| Size | 1×: frames > 20 ms, rAF callback p99 | 4×: frames > 20 ms, callback p99 |
|---|---|---|
| 430×932 | 1.1% (1.1%), **12.2 ms** (13.0) | **34.5%** (48%), 39.2 ms (49.5) |
| 320×568 | 0% (0.2%), **7.7 ms** (9.8) | **2.8%** (21%), 22.1 ms (41.4) |
| 852×393 | 0% (0.2%), **5.9 ms** (9.9) | **9.2%** (34%), 25.2 ms (45.3) |

The floor cast is 0.7 ms and a reused frame's draw is 0.2 ms (median), so the rest is the players' sprite
drawing (players-2's near-first budget, a dependency). 320 meets §3.9. 430 and sideways improve but miss it.

### Tests

| Test | What it proves |
|---|---|
| `camera.test.ts` (6 + 1 opt-in) | the camera rows above at 393/320 (rim 0.20-0.24, handler 0.50-0.55, safe ≥ 0.98, zoom ≤ 2%, jumpers ≥ 0.90, all releases ≥ 0.85) and at 430/375/sideways (safe ≥ 0.98, 568 sideways ≥ 0.85; zoom ≤ 3.5%); 30 vs 60 fps within 0.5 px; the shooter hold ≤ 2 ft with the 2% tilt; the defensive yaw rule ≥ 90% of 1,000 releases in both orientations and never worse than a fixed sign; the stick and the facing turn with the yaw. `NBA_CAM=1` prints the before/after table |
| `labels.test.ts` (7) | 0 glyph misses across `cards-nba.json` names and tags; the folds (Jokić, Dončić, Petrović, Marčiulionis, Ø Ł Đ ß Æ Œ, curly quotes); the V2 punctuation; unique tags (initial, two letters, number) and 0 duplicates on 500 random courts; 0 chip overlaps in 1,000 frames with the top priority where it asked; 14 px chips |
| `held.test.ts` (3) | a possession per task gives exactly `aiPossessionsOf` (3 seeds, real squads, a bench, defIQ); it cancels; `autoplaySteps` drained is `autoplay` |
| `determinism.test.ts` (changed) | `camera.ts`, `floor.ts` and `labels.ts` join the render-only list (they read a possession to draw it); `shotChance`'s grandfathered `hypot` moved with its body into `shotChanceWith` (the same call). Neither was a bug fix: the scan's lists followed the refactor |

`golden.test.ts` and `controls.test.ts` (the AI race byte-identical) pass unchanged.

### Verification (nba-3)

- **Typecheck:** `bash O/heavy.sh npm run typecheck`: clean.
- **The standard set:** `bash O/heavy.sh npx vitest run src/game/hoops2 src/game/hud src/game/stick.test.ts
  src/game/juice.test.ts src/game/play-feedback.test.ts src/game/difficulty.test.ts src/ut/match-debrief.test.ts
  src/engine/sport-branches.test.ts`. Result: 20 files passed, 5 skipped (opt-in), 111 tests passed (7 skipped), 235 s. The run
  before the determinism-list update had 1 failure, that scan.
- **Browser** (against 5215, every host other than localhost aborted, none tried):
  - `nba-hud.mjs` (8 sizes)
  - `nba-clock.mjs 393 20`
  - `nba-held.mjs`
  - `nba-perf.mjs`
  - `nba-frame-shots.mjs`
- **Captures** in `O/shots/nba/nba-3/`, all looked at:
  - `nba3-393-release`, `-scorer-plate`, `-clutch-bug`, `-ot-bug`, `-name-chips`, `-reduced-motion`
  - `nba3-320-rim-area`, `nba3-852land`
  - `held-393-sheet`, `held-393-curtain`
  - `hud-<size>-play` / `-auto` for the 8 sizes

### Reduced motion (plan §3.15 rows added)

| Element | With reduced motion |
|---|---|
| clock warning | colour only (no pulse) |
| camera easing | ×2 faster settle; no shake (as before) |
| Clutch staging | gold bug only, no 6% tighten |
| Heat bar | static stripes, no fill transition |
| tip-off curtain | static card, no fades or row rises |
| rematch dim | instant |

**Protocol:** none. The changes are render, DOM, text and a held-mount flow. `golden.test.ts` and the AI-race
golden in `controls.test.ts` are byte-identical, and the rematch's AI side is proven equal to `aiPossessionsOf`.

---

## Contracts for nfl / soccer / ut

The section below is plan §4, copied verbatim on 2026-11-16 (revision 3, commit `78a1c86`). nfl and soccer build against
it until nba's files land in their branches; ut reads the grade, the box and the held-arena handle from it. Any change
to a signature is logged under "Contract changes", after it.

## 4. The shared V2 pieces nba writes: interface contracts

nfl and soccer write against this section until the files land in their branch (OWNERSHIP V2 grants). Signatures are
binding. Bodies may change. Any change to a signature is announced in `nba.md` under "Contract changes" with the date.
The files are listed in landing order.

| File | Lands in | Consumers |
|---|---|---|
| `src/game/controls-geometry.css` | nba-2 | nba, nfl, soccer, ut (the One-More bar sits at A's position) |
| `src/game/stick.ts` (pure) + `src/game/StickPad.tsx` (was `Stick.tsx`) | nba-2 | all three sports |
| `src/game/hud/gestures.ts`, `Cluster.tsx`, `ToastLine.tsx`, `PauseButton.tsx`, `PauseSheet.tsx`, `prefs.ts`, `feel.ts`, `hud.css`, `index.ts` | nba-2 | all three |
| `src/game/hud/ScoreBug.tsx`, `HeatBar.tsx`, `geometry.ts` | nba-3 | all three |
| `Arcade.tsx` held-arena props and `ArcadeHandle` | nba-3 | ut hosts; nfl and soccer adopt them for their branches |
| `src/game/perfect.ts` (pure) + `src/game/hud/ring-draw.ts` | nba-4 | all three |
| `src/game/heat.ts` (pure, integer) | nba-4 | all three; ut reads the counts |
| `src/game/hud/grade.ts` + optional `Progress.grade` / `Progress.box` | nba-4 | each sport fills them; ut reads them |
| `src/game/hud/BoxSheet.tsx` | nba-9 | ut's BOX SCORE button, every sport |
| `src/game/hoops2/daily-play.ts` | nba-10 | ut hosts the Daily Play |

### 4.1 `controls-geometry.css` (tokens only, on the class `.ps-geo`)

Hosts add `ps-geo` to `.arcade-full`; ut's result sheet adds it too, so the One-More bar can sit on A. Each token
interpolates linearly by viewport width between the 320 and 393 values and clamps outside that range. For example:
`--ctl-a-d: clamp(84px, calc(84px + (100vw - 320px) * 8 / 73), 92px)`.

Insets come from `--sat/--sab/--sal/--sar` on the same element. The values below are the 320 → 393 endpoints. Offsets are
measured from the safe-inset edge to the element's outer edge.

| Token | 320 → 393 | Meaning |
|---|---|---|
| `--ctl-a-d`, `--ctl-a-r`, `--ctl-a-b` | 84 → 92, 12 → 24, 16 → 34 | A: diameter, right gap, bottom gap (+ `--sab`) |
| `--ctl-b-d`, `--ctl-b-r`, `--ctl-b-b` | 56 → 64, 102 → 123, 4 → 8 | B |
| `--ctl-c-d`, `--ctl-c-r`, `--ctl-c-b` | 44 → 48, 98 → 119, 78 → 100 | C |
| `--ctl-d-d`, `--ctl-d-r`, `--ctl-d-b` | 44 → 48, 16 → 29, 110 → 142 | D |
| `--stick-d`, `--stick-l`, `--stick-b` | 104 → 120, 18 → 24, 20 → 28 | stick ghost: diameter, left gap (+ `--sal`), bottom gap |
| `--stick-zone-w`, `--stick-zone-top` | 48vw, 45vh | the zone where the stick may spawn |
| `--bug-w`, `--bug-h`, `--bug-t` | 200 → 232, 34 → 40, 4 → 6 | score bug (centred; top = `--sat` + `--bug-t`) |
| `--pause-l`, `--pause-t` | 6 → 12, 0 → 4 | pause button, 44×44 |
| `--heat-h`, `--heat-t` | 5 → 6, 40 → 49 | Heat bar (width = `--bug-w`) |
| `--toast-b`, `--toast-h` | 164 → 234, 24 → 28 | toast line: bottom edge above the viewport bottom, and height |
| `--safe-t`, `--safe-b` | 56 → 56, 200 → 284 | action-safe box: top below `--sat`; bottom edge above the viewport bottom |
| `--scrim-h` | 240 | bottom gradient scrim, transparent → `rgba(7,21,33,0.55)` |

Colour tokens (V2 C.3) are also declared here: `--ps-gold #f6b93b`, `--ps-teal #4fe3c1`, `--ps-red #ff5d5d`,
`--ps-violet #8b7cf6`, `--ps-glass rgba(7,21,33,0.72)`, `--ps-stroke #1d3a50`.

The class `.ps-geo.land` switches to the landscape rule (the 393 sizes, corner-anchored). The host sets the class from
JS; there are no media queries.

### 4.2 `stick.ts` (pure) and `StickPad.tsx` (was `Stick.tsx`)

```ts
// src/game/stick.ts — no DOM, no timers; unit-tested
export interface StickGeom { zone: { x: number; y: number; w: number; h: number }; ringR: number; ghost: { x: number; y: number };
  deadZone: number /* 0.12 */; sprintAt: number /* 1.15 × ringR, 0 = no sprint ring (nfl "Burst button" pref) */;
  followAt: number /* 1.6 × ringR */; floating: boolean /* false = fixed ring at the ghost (a permanent stick) */; homeBand: number /* px above sab never spawns */ }
export interface StickPointer { id: number; x: number; y: number; t: number /* PointerEvent.timeStamp */ }
export interface StickState { id: number | null; origin: { x: number; y: number }; pos: { x: number; y: number }; since: number | null }
export interface StickOut { x: number; y: number; mag: number /* 0..1 after the dead-zone rescale */; sprint: boolean; active: boolean }
export const stickIdle: (g: StickGeom) => StickState;
export function stickDown(s: StickState, p: StickPointer, g: StickGeom): StickState;   // ignored outside the zone or in the home band
export function stickMove(s: StickState, p: StickPointer, g: StickGeom): StickState;   // origin clamped so the ring stays on screen; follows past followAt
export function stickUp(s: StickState, p: StickPointer, g: StickGeom): StickState;
export function stickOut(s: StickState, g: StickGeom): StickOut;  // never null: centred = {0,0,0,false,active} (nfl's "never turn centred input into null")
export function sprintEdge(prev: StickOut, next: StickOut): boolean;  // true once when sprint turns on (the haptic tick)
export function geomFrom(el: Element): StickGeom;  // reads the §4.1 tokens; DOM helper, not called by the pure functions
```

`StickPad.tsx` (was `Stick.tsx`; the component is still `Stick`) is `<Stick geom? disabled? onChange={(o: StickOut) => void} onSprintEdge?={() => void} />`. It provides:
- non-passive listeners, `touch-action: none` and `setPointerCapture`
- the ghost ring at rest
- a pre-held thumb: a pointer already down when the component enables (at the whistle) is adopted at once, and its
  direction is applied on the first frame
- `onChange` fired at most once per animation frame, and on down and up

### 4.3 The HUD kit: `src/game/hud/*` (React, `hud.css`)

```ts
// gestures.ts (pure)
export type Gesture = { kind: 'tap' | 'hold' | 'swipe'; dir?: 'L' | 'R' | 'U' | 'D'; heldMs: number };
export function classify(points: { x: number; y: number; t: number }[], tDown: number, tUp: number | null): Gesture | null; // tap < 120 ms & < 12 px; swipe ≥ 36 px within 250 ms

// Cluster.tsx: the right-thumb A/B/C/D buttons at the §4.1 positions
export type Slot = 'A' | 'B' | 'C' | 'D';
export interface SlotSpec { label: string; icon?: ReactNode; hidden?: boolean; disabled?: boolean; tone: 'gold' | 'teal' | 'glass';
  swipes?: boolean /* A only */; hints?: { up?: string; side?: string; down?: string } /* the small SPIN / CROSS / STEP labels */; pips?: number }
export interface ClusterInput { slot: Slot; phase: 'down' | 'move' | 'up' | 'cancel'; t: number /* PointerEvent.timeStamp */; gesture?: Gesture }
export function Cluster(props: { slots: Record<Slot, SlotSpec>; onInput: (e: ClusterInput) => void; buttonsOnly?: boolean;
  arc?: { id: string; label: string }[] /* Buttons-only mode: the swipes as small buttons in an arc above A, firing on down */; onArc?: (id: string, t: number) => void }): JSX.Element;
// Every 'down' is delivered on pointerdown (actions start on touch-down); the gesture arrives with 'up' or 'move'.

export function Radial(props: { items: { id: string; label: string }[]; at: Slot; open: boolean; onPick: (id: string, t: number) => void; onClose: () => void }): JSX.Element; // ≥ 44 px items above the slot

// ToastLine.tsx: the one line above the controls (V2 A.5)
export type ToastTone = 'gold' | 'teal' | 'red' | 'violet' | 'plain';
export interface Toast { text: string; tone?: ToastTone; ms?: number /* default 1200 */; priority?: number /* higher replaces lower */; pop?: boolean /* the PERFECT 1.0→1.25→1.0 scale in 220 ms */ }
export function useToast(): { show(t: Toast): void; clear(): void };
export function ToastLine(): JSX.Element; // reads the queue from context

// PauseButton.tsx / PauseSheet.tsx
export function PauseButton(props: { onPause: () => void }): JSX.Element;
export function PauseSheet(props: { open: boolean; online: boolean; onResume: () => void; onQuit?: () => void /* offline: confirm, then a loss */;
  onForfeit?: () => void /* online: confirm, then a forfeit */; children?: ReactNode /* sport items: controls help, calibrate, Auto-defend, sound */ }): JSX.Element;

// ScoreBug.tsx / HeatBar.tsx (nba-3)
export interface BugProps { you: number; rival: number; youName?: string; rivalName?: string; period: string /* 'Q2' · '2ND & 4' · "67'" */;
  clock?: string; clockLow?: boolean; progress?: number /* 0..1, the 3 px possession line */; phase?: 'normal' | 'clutch' | 'ot';
  heat?: { you: HeatView; rival?: HeatView } }
export interface HeatView { v: number /* 0..100 */; stage: 'cold' | 'heating' | 'fire' }
export function ScoreBug(p: BugProps): JSX.Element; // the 232×40 capsule; gold with "CLUTCH" in that phase
export function HeatBar(p: { you: HeatView; rival?: HeatView }): JSX.Element;

// geometry.ts (nba-3)
export function readGeometry(el: Element): { safeTop: number; safeBottom: number; toastBottom: number; controlTop: number; land: boolean };
// prefs.ts and feel.ts: §4.7 and §4.6
```

### 4.4 `perfect.ts`: the gold ring

This file holds the window maths and the judging. It is pure and has no clock.

```ts
export type RingState = 'gold' | 'amber' | 'red';
export type Dial = 'TIMING' | 'PRESSURE' | 'RANGE';
export const GOLD_FLOOR_MS = 30;            // half-width; nothing ever shrinks gold below it
export const WINDOW_CAP = { mult: 1.45, ms: 90 };
export interface WindowPart { id: string; mult: number }   // e.g. { id: 'fire', mult: 1.25 }
export function windowScale(baseMs: number, parts: WindowPart[]): number;  // product, then cap, then floor (the only place parts meet)
export interface RingSpec { idealMs: number /* from the touch-down to the perfect moment */; goldMs: number /* half-width */; state: RingState; dial?: Dial }
export interface Judged { step: -3 | -2 | -1 | 0 | 1 | 2 | 3 /* 0 = PERFECT */; inGold: boolean; offMs: number; dial?: Dial; word: string /* 'PERFECT', 'SLIGHTLY LATE', … */ }
export function judge(spec: RingSpec, offMs: number): Judged;  // inGold only when spec.state === 'gold' and |offMs| ≤ goldMs
export interface TouchClock { real: number; game: number; acc: number; rate: number }   // updated each rAF
export function gameTimeAt(c: TouchClock, timeStamp: number, now: number): number;   // falls back to `now` when |timeStamp − now| > 1000 ms
export function calibrate(taps: number[], beats: number[]): { offsetMs: number; sdMs: number };  // 4 taps (V2), outliers > 150 ms dropped
export const STEP_WORDS: readonly string[]; // VERY EARLY … PERFECT … VERY LATE
```

**The honesty rule every consumer must keep and test:** a sport passes `state: 'gold'` only when its outcome function
returns the best possible result for an in-gold release. Each sport adds a test that, over 10,000 seeded gold releases,
none is worse than that result.

`hud/ring-draw.ts` draws the ring on canvas, and the mockup's arc meter is the same call:
`drawRing(ctx, { x, y, rx, ry, t: 0..1, spec, px /* design px per ms */, reduced })`. It guarantees the gold band is
≥ 8 design px by stretching the ring's time-to-pixel scale, never the window.

### 4.5 `heat.ts`: Heat, deterministic and integer-only

```ts
export type HeatEvent = 'perfect' | 'score' | 'stop' | 'clean' | 'turnover' | 'conceded';
export interface HeatState { v: number /* 0..100 */; fire: number /* units of On Fire left */; peak: number; fires: number /* On Fire spells this match */ }
export const HEAT: { gain: Record<HeatEvent, number>; up: 66; fire: 100; spell: number; windowMult: 1.25 };  // built with pickFor(sport)
//   gain.score: nba 10 · nfl 25 · soccer 40 ; spell: nba 2 · nfl 3 · soccer 1 ; the others are shared (+12 +15 +5 −20 −10)
export const heatStart: HeatState;
export function heatAfter(s: HeatState, ev: HeatEvent, sport: SportId): HeatState;   // clamps 0..100; reaching 100 starts a spell
export function heatUnitEnd(s: HeatState): HeatState;                                // one possession/snap/attack used; at 0 the bar returns to 0
export function heatHalf(s: HeatState): HeatState;                                   // the half-time reset (peak and fires kept)
export function heatStage(s: HeatState): 'cold' | 'heating' | 'fire';
export const heatWindow: (s: HeatState) => 1 | 1.25;  // the WindowPart multiplier
```

The engine stores `HeatState` per side in `HoopsGame`. It is the same on both phones for the same marks, and is never
saved. ut reads `fires` and `peak` through the grade.

### 4.6 What nba consumes from other teams (with local shims until they land)

| From | What | Shim until it lands |
|---|---|---|
| ut: `src/lib/haptics.ts` | `haptic(p: 'tick' \| 'double' \| 'long' \| 'heartbeat')`. nba asks for `heartbeat` (Clutch, B.0.4) on day one. | `src/game/hud/feel.ts` exports the same signature over today's `vibrate()`; the lead swaps one import at integration |
| soccer: `src/lib/sound.ts` addition | `sfx.perfect(streak: number)`, `sfx.ringTick()` | `feel.ts` falls back to the existing `sfx.swish`/`sfx.tick` |
| shell: insets / Fix A | `--sat` raised by 22 px on Dynamic Island phones | §3.8 rows are re-measured with sat 81 once shell merges |
| players | the near-first sprite budget (players-2), kits per possession at the call site (revision 2 §6.1), the poses `pump`, `euro`, `stepback`, `contest`, `reach`, `stumble`, FT routine | every act falls back to an existing pose |
| ut | the One-More bar, the result slam/tally, the Daily Play host and board | nba tests against a stub sheet |
| lead | the `Progress` field review and the protocol bump | — |

### 4.7 `hud/prefs.ts`: one sport-neutral, per-device key

```ts
// key 'perfect-season:touch-prefs:v1' (new; never in recovery lists or the profile)
export interface TouchPrefs { v: 1; offsetMs?: number /* calibration, shared by all sports */; controls?: 'gestures' | 'buttons';
  meter?: 'on' | 'off'; hints?: Partial<Record<SportId, number>> /* bitmask of seen one-line hints */;
  autoDefend?: Partial<Record<SportId, boolean>> /* ready for the lead's unification (F.2 lead #3) */ }
export function loadPrefs(): TouchPrefs;          // missing / corrupt / old shape → defaults; never throws
export function savePrefs(patch: Partial<TouchPrefs>): void;  // read-modify-write; touches no other key
```

### 4.8 Grade and box on `Progress` (F.1) and the held arena

```ts
// src/game/hud/grade.ts — dependency-free (it lands in the UT chunk)
export interface MatchGrade { v: 1; letter: 'S' | 'A' | 'B' | 'C'; flawless: boolean; perfects: number; moments: number /* gold chances taken, for ut's Touch rating */;
  bestHeat: number; fires: number; ppu: number /* points per possession / drive / attack */; par: number }
export function gradeLetter(ppu: number, par: number): MatchGrade['letter'];   // S ≥ 1.25·par, A ≥ 1.10·par, B ≥ 0.90·par
// src/game/progress.ts (two optional lines, type-only imports): box?: BoxData; grade?: MatchGrade — both stripped before the wire
```

`BoxData` is `{ us: BoxLine[]; them: BoxLine[]; pog?: string }`. NBA's `BoxLine` has `perfect` and `perfect3`, which ut's
card-mastery feats read ("10 PERFECT threes with Curry").

**`Arcade.tsx`, the held arena** (nba writes the sport-agnostic block once; nfl and soccer adopt it):
- New optional prop `hold?: boolean`, default false, so legacy hosts are unchanged. When it is set:
  - the final whistle dims the arena (its own CSS)
  - `onFinish` fires within 0.3 s instead of after the 1.6/2.6 s timeout
  - the component stays mounted under the host's sheet
- A `ref` exposes `ArcadeHandle { rematch(next?: { seed?: string; rival?: Rival; them?: Squad }): void }`. It re-seeds the
  same engine and renderer, shows the 1.5 s opponent curtain (skippable), and tips off.
- `onFinish(us, them, how, took, pens?, forfeit?)` keeps nfl's revision-2 shape.

---

## Contract changes

Every change to a signature above is logged here with its date, so nfl, soccer and ut can follow it.

| Date | Contract | Change | Why |
|---|---|---|---|
| 2026-11-16 | all of §4 | First publication, copied verbatim from the plan (revision 3) | nba-1: day-one contracts |
| 2026-11-16 | §4.8 `BoxLine` | `pure` renamed to `perfect`; `perfect3` added (PERFECT releases on three-point attempts). Neither had shipped. | V2's PERFECT vocabulary; ut's card-mastery feat ("10 PERFECT threes") |
| 2026-11-16 | §4.3 `ClusterInput` | optional `dist`, `x`, `y` added (how far the finger has travelled, where it is) | a provisional action is taken back once a finger drifts; the radial's slide-and-lift |
| 2026-11-16 | §4.3 toast | `ToastProvider({ paused, apiRef, children })` exported; `ToastLine()` reads it | the toast's clock stops with a pause; the match loop says things through `apiRef` |
| 2026-11-16 | §4.2 stick | `geomFrom(el, opts?)` takes `{ floating, sprint }`; new `stickGeom(zone, ghost, ringR, opts?)` and the `DEAD_ZONE` / `SPRINT_RING` / `FOLLOW_RING` constants | one place for the ratios |
| 2026-11-16 | §4.3 pause | `PauseButton` takes an optional `label`; `PauseSheet.tsx` also exports `SheetToggle`; new `hud/timers.ts` `PausableTimers` | sport items in the sheet; "0 timers while paused" |
| 2026-11-16 | §4.7 prefs | new helper `firstTime(sport, bit)` | the once-per-device hints |
| 2026-11-16 | §4.8 `Arcade.onFinish` | a sixth optional argument `forfeit?: 'us'` (offline Quit). nba-9 adds `'them'` for the online forfeit | quit = a loss in every host |
| 2026-11-16 | §4.3 `BugProps` (nba-3) | optional `sub` (a second line under the period), `clockRef` (the host writes the clock every frame), `youColor` / `rivalColor`, `aside` (an icon beside the bug) | the live clock without re-renders; LAST PLAY in the bug |
| 2026-11-16 | §4.3 `readGeometry` (nba-3) | also returns `hudBottom` (the Heat bar's bottom; sideways the toast line's); `intersects()` exported | the rim keeps 40 px under the HUD |
| 2026-11-16 | §4.8 `ArcadeHandle.rematch` (nba-3) | `next?: { seed?: string; rival?: string /* name */; them?: { lineup?: Lineup; teams?: ArcadeTeams } }`: the plan's `Rival` and `Squad` types don't exist, so these are the shapes Arcade already takes. `Arcade` is a `forwardRef`; `hold` is offline only | the stub host and ut's One-More bar |
| 2026-11-16 | §4.2 `Stick.tsx` (nba-2 review) | renamed **`src/game/StickPad.tsx`**; the export is still `Stick`, and `src/game/hud` re-exports it. Import `{ Stick } from '../StickPad'` or from `'../hud'` | `Stick.tsx` and `stick.ts` differed only in case: on macOS / Windows `'../Stick'` resolved to `stick.ts` |
| 2026-11-16 | §4.3 `Cluster` / `PauseSheet` (nba-2 review) | `Cluster` takes optional `arcOff` (hide the Buttons-only arc); `PauseSheet` takes optional `quitNote` (the confirm's line in the sport's words; neutral default) | the radial over the arc; sport-neutral copy |
| 2026-11-16 | §4.8 forfeit (nba-2 review) | a quit's `them` score is at least `us + 1`; UT `settle()` / `settleDraft()` take `forfeit` and pay nothing for it | Cup / Club Season reject a loss with more points; a quit is not a reward loop |
| 2026-11-16 | `controls-geometry.css` (nba-3) | sideways `--safe-t` 64 → 100 px | the toast line sits under the bug sideways (to --sat + 94) |

---

## Requests to other teams (plan §4.6)

- **To ut: a `heartbeat` pattern in `src/lib/haptics.ts`.** nba calls `haptic('tick' | 'double' | 'long' | 'heartbeat')`.
  `heartbeat` plays once per Clutch possession when the margin is one score (V2 B.0.4). Until ut's file lands in this
  branch, `src/game/hud/feel.ts` (nba-2) exports the same signature over today's `vibrate()`, and the lead swaps one
  import at integration.
- **To soccer: `sfx.perfect(streak: number)` and `sfx.ringTick()` in `src/lib/sound.ts`.**
  - `perfect` is the two-note PERFECT chime, one semitone higher per consecutive PERFECT, up to 5 steps.
  - `ringTick` is the ring-fill tick in the last 200 ms.
  - Until they land, `feel.ts` falls back to the existing `sfx.swish` / `sfx.tick`.
- **To shell:** nothing new. The §3.8 rows are re-measured with sat 81 once Fix A merges (the geometry probe takes an
  inset override).
- **To players:** the poses and kits listed in plan §4.6. Every act falls back to an existing pose until they land.
  Also a number for their sprite cache: an NBA game makes about 13,800 offscreen canvases (`nba-rematch.mjs`), and at
  4× CPU 21-48% of frames run over 20 ms (`nba-perf.mjs`). Worth a look alongside the near-first sprite budget.
- **To packs (open since 2026-11-10):** the UT card rating puts THR_avg at 80, the draft engine at 73 (see "THR_avg"
  above). The §3.3 windows key off the engine value. If UT cards carry +7 on the three-point rating, every UT shooter gets
  a wider gold window than the same player in a draft. Packs either align `ut/rate.ts`'s 3PT with the engine scale, or
  confirm the offset is intended so nba-4 can key UT windows off 80.

---

## Escalations to the lead (revision 2 §4, updated for V2)

1. **Owner decision 2 vs modes with no arcade match.** The decision lists Moments, Gauntlet and draft season/playoff
   games among the solo games where defense is played by default.
   - Gauntlet (`ui/Gauntlet.tsx`), `engine/season.ts playSeason()` and the playoffs are rating sims with no arcade match.
   - Moments are Hoops2 `practice` drills.
   - **nba ships what the engine can:**
     - the alternate format, available to any host with two fives (nba-6)
     - a defend drill (`practice.drill: 'defend'`: "get N stops in M AI possessions", nba-7), so ut can add a defensive
       Moment
   - **Options for the lead:** (a) keep Gauntlet, season and playoffs as sims this round (recommended: no arcade match
     exists there); (b) add an optional "play this game" arcade entry for playoff games or the Gauntlet boss (ut and shell
     screens; nba's format is ready); (c) play only the Finals.
2. **In-game names that echo other games.** The BRIEF bans copied names; owner decision 1 covers mode names only.
   - nba-3 ships one exported `BADGE_LABEL` map in `hoops2/badges.ts` with original names: Deadeye → Ice Water,
     Limitless → Deep Range, Dimer → Table Setter, Posterizer → Poster Maker, Clamps → Lockdown, Ankle Breaker → Ankle
     Taker, Rim Protector → Paint Wall. The badge tier "Hall of Fame" becomes "Elite" in display. Internal ids stay.
   - **Shipped in nba-3** (`BADGE_LABEL`, `tierLabel`). **Lead decision still open:** have packs' `ut/rate.ts BADGE_NAMES` read the same map (a one-line import), so cards and the
     in-game pop agree. If the lead declines, nba flips its pop to the card names (one constant) and records it here.
   - **Withdrawn:** the Heat-stage rename (HOT HAND / LOCKED IN). V2 names the stages HEATING UP / ON FIRE, and "Hot
     Hand" is now ut's win-streak coin bonus (D.14).
3. **UT mode ideas without an owner** (research §5.13: Top Plays/Flashbacks, Clutch mode, card-once Gauntlet, one-use
   boosts). nba exposes cheap engine options on `newHoopsMatch` (`possessions`, `clock`, `startersOnly`, nba-6). The
   4-point "logo" zone needs a new mark and a protocol change, so it is built only if ut and the lead commit to it (V2
   D.9: solo only).
4. **Score-scale handoffs.** Typical scores change: PPP 1.28 → about 1.145, plus free throws and overtime.
   - `src/engine/broadcast.ts` (the draft GameCast's uniform 206 ± 17) has no owner in OWNERSHIP.md: the lead's.
   - `ut/league.ts`'s AI-only "arcade-length scoring" (`league.ts:303`) is ut's.
   - nba-10 hands both over with the measured mean and SD per side per 16 possessions (alternate format) and the
     era-aware totals.
5. **Tie copy** (ut-owned files). `ut/Match.tsx` "A tie goes to the better squad" and `ui/Results.tsx` "Tied on points:
   the better team (by rating) takes it" become, for NBA, "Tied after regulation: overtime decided it". The proposed
   copy goes to ut; soccer's penalties line is untouched.
6. **Online quit is an instant loss** (not an AI-finished game), as agreed with ut and nfl (revision 2 §6.3). A killed app
   mid-match still falls back to ut's "match in progress" marker and the existing takeover.
7. **The shared `scripts/qa/online.mjs` needs `ws`, which this install doesn't have** (`require('ws')` fails; the
   machine has no `ws` package anywhere). nba's own relay (`nba-relay.mjs`) uses the WebSocket server bundled in
   playwright instead. The shared script stays as it is (not nba's file); whoever owns `scripts/qa` may want the same
   fallback.

---

## Protocol

**Protocol bump needed: NBA draft 10 → 11, UT NBA 10 → 11 because** of the outcome changes the later tasks append here
(gold windows, fouls, format, Heat, moves, transition, usage, eras, OT). **nba-2 adds:** a person's possessions play differently: the pump fake and "make him land" (contest
grades), ISO's clear-out and feed, the euro-step, PASS held for a lob, the gather timed from the touch, and
the floating stick's own sprint ring in place of the 0.92 edge. The AI's possessions are byte-identical
(`controls.test.ts`), so the AI race and `aiPossessionsOf` are unchanged. **nba-1 adds nothing to it:** its engine events
(`fga`, `drb`, `stl`, `int`, `foul`) are pushed beside the existing ones and never change state or the order of
`p.rand` draws. `golden.test.ts` pins it: 6 seeded AI games (score, marks, and every possession's end and final clock)
recorded on the base `78a1c86` come out byte-identical on today's engine, nba-2 included. Any later task that moves
them is an outcome change (re-record from that commit and add it here). **nba-3 adds nothing to it:** the camera, HUD,
text and held arena are render/DOM/flow; `shotChanceWith`, `catchChance` and `autoplaySteps` are refactors with the
golden and the AI-race golden byte-identical, and the rematch's AI side is proven equal to `aiPossessionsOf`.

---

## Touched outside my lane

- None in nba-1. Every file is the team's: `src/game/hoops2/**` and `scripts/audit/nba-*.mjs`.
- **nba-2:**
  - `src/game/Arcade.tsx` (shared with nfl): `onFinish` takes an optional sixth `forfeit?: 'us'`; an
    offline `quit()` that ends the game as a loss with the unplayed possessions as `X`; Hoops2 gets
    `online` and `onQuit`; the NBA tip-off card's controls copy. NBA branch only.
  - `src/App.tsx` (shared): the draft host passes `quit` into `finish`, and `vsWon` is false for a quit
    (2 lines).
  - `src/ut/Match.tsx` (shared): `finish` takes `forfeit`; a quit settles as `{ won: false }` (4 lines).
  - **Review fixes:** `src/ut/play.ts` (ut): `settle()` takes an optional `forfeit` (rejected with a win; pays
    no coins / XP / season points and uses no paid game). `src/ut/draft-mode.ts` (ut): `settleDraft` takes
    `forfeit` (no season points). `src/ut/Match.tsx`: passes `forfeit`, skips `recordEvoMatch` for a quit, and
    a result-screen note. `src/game/Arcade.tsx`: a quit reports the rival at `max(them, us + 1)`. New test
    `src/ut/forfeit.test.ts`. ut: please keep the flag when you rework settlement.
  - `src/game/play-readout.css` (shared with nfl): removed the dead `.hg2-skills` rules (NBA's old
    move buttons).
  - `src/game/hoops2/render.ts`, players section: two fallback poses, `pump` and `euro` (players' own
    poses replace them, plan §4.6).
  - `src/game/hoops2/coach-controls.css` keeps the two hint rules soccer's `.hg2.sc2` hint uses and the
    football/soccer dimmed buttons, unchanged; NBA's own rules moved to the HUD kit.
- **nba-3:**
  - `src/game/Arcade.tsx` (shared with nfl): the sport-agnostic held-arena block (`forwardRef`, `hold`,
    `ArcadeHandle.rematch`, the round state, `onFinish` with no delay when held) and the NBA branch (`hold`,
    `round`, `roundAt`, the rematch's AI side a possession per task). nfl and soccer get only a `key` so a
    rematch remounts them. The first match reads the host's props exactly as before.
  - `src/game/Lab.tsx`: one line (`?arcade&hold` → `HeldLab`) and its import.
  - `src/game/hoops2/render.ts`, players section: one hunk in `sprite()`. The facing and the look-down angle
    are taken relative to the yawed camera (`facingIndex`, `pitchAt` from camera.ts); there is no look, pose or
    cache change.
  - `src/game/PlayReadout.tsx` and `play-readout.css` (shared with nfl): an optional `icon` mode (a 44 px
    button). nfl's pill is unchanged.
- One hunk in the team's own `Hoops2.tsx` worth knowing about: a dev-server-only probe (`window.__hg2`, guarded by
  `import.meta.env.DEV`, so the production build drops it) that the geometry, camera and flow probes read.

---

## Owner device checks

**nba-3:**
- The camera's look on a real phone: 55° and 12° yaw, with the court receding. Do the stands, the slanted key
  and the steeper view read as a broadcast? Is the tip-off zoom-back noticeable?
- The shot clock's tick under 4 s and the red pulse at 5 s.
- Accented names on the chips (Jokić → JOKIC) and the J.JOHNSON-style tags.
- The rematch loop once ut's sheet is wired: the curtain's 1.4 s, a tap to skip, and the dimmed arena behind
  the sheet.
- The Dynamic Island: re-measure the bug, LAST PLAY and the safe box once shell's `--sat` fix merges.

**nba-2:**
- Thumb reach on the owner's phone: A / B / C with the right thumb, the stick anywhere low on the left;
  the CALL radial's reach (SCREEN / CUT / ISO up and right of C).
- The sprint ring: does pushing past it feel deliberate, and is the haptic tick felt (iOS plays one tick,
  only inside a touch; the sprint edge comes from a move, so iOS may play it on the next touch)?
- Gestures on SHOOT under a real thumb: taps that should be pump fakes, swipes that should be moves
  (thresholds 120 ms / 12 px / 36 px in 250 ms). After the review fix a quick tap should never brick a
  shot: try fast taps on a busy moment (a crowded paint, right after a pass).
- Auto-pause when a call comes in or the app is switched away, and Resume.
- The Dynamic Island: re-measure the pause button and the bug once shell's `--sat` fix merges.

None for nba-1 (test and QA infrastructure only). Plan §11's list starts with nba-2: thumb reach, the sprint ring, the
ring's feel, haptics, defense, the rematch loop and accented names.

---

## Left undone

**nba-3:**
- **`?arcade&cam=v2b`** (V2's "your basket at the bottom" on defense): the framing and the yaw rule are in
  `camera.ts` and tested. Wiring the flag to the defensive possessions is nba-6's (there are none to show
  yet), including the backboard and rim drawn from behind.
- **The OT phase** of the bug is drawn and captured (forced through the dev probe). nba-6's overtime sets it.
- **Frame budget at 430×932 and sideways** misses §3.9: 4×, 34.5% and 9.2% of frames over 20 ms; 1× p99 at 430
  is 12.2 ms. What's left is the players' sprite drawing, so the near-first budget (players-2) is the fix.
  Flagged to players with these numbers.
- **The 568×320 sideways safe box** (196 px under the bug and the toast) keeps the handler in only 89% of
  frames. A man walking up from half court dips under it. Every other size is ≥ 98%.
- **Finishes with a trailing defender:** at 11.8% of all releases at 393, he hides more than 35% of the
  finisher. Jump shots: 0%.
- **One 4× rematch in three** tipped off at 2.7 s, not 1.4 s; the cause isn't found yet.
- **The 393 live handler median** is 0.494 in one 900-frame lab slice (0.536 over 6 simulated games).

**nba-2:**
- ~~A quit still pays the ordinary loss reward~~: fixed in the review fixes (a quit pays nothing). The
  debrief still coaches the empty possessions (ut's).
- The euro-step and the pump fake use fallback poses until players' `euro` and `pump` land.
- The radial's open animation and the euro-step were on the cut line; both shipped.
- The online forfeit (the sheet's Forfeit) is nba-9's, as planned.
- **The UT chunk's size** with the HUD kit (Moments imports Hoops2 statically): estimated by the review at about
  +7 KB gzip JS and +4 KB CSS against plan §3.9's +2 KB. nba-10's build measures it; over budget, the Moments
  game gets lazy-loaded like Training.

- Nothing from nba-1's Must list. The probes measure only what today's game has; rows for controls that don't exist yet
  (pause, Heat bar, sprint ring, gestures on A) print "absent", and the tasks that build them add their measurements.
- `hold.heapGrowth` is measured after the 3rd autoplay game against the 1st, not after the 5th rematch: a full autoplay
  game takes about 90 s at 1×. nba-3's held arena re-measured it across 5 rematches: 1.035.
