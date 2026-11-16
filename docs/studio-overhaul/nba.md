# Team nba: studio overhaul team doc

Branch `claude/studio-nba`, worktree `/home/user/ps-s-nba`, dev server port **5215**, QA relay **7795**
(`ws://localhost:7795`, `scripts/audit/nba-relay.mjs`). The build plan is
[`nba-plan.md`](nba-plan.md) (revision 3, Game Design V2). This doc records what each task changed, the before and
after numbers, the tests, the protocol line, the contracts other teams build against, and what's left.

**Contents:** nba-1 (harness, baseline, QA isolation) · Contracts for nfl / soccer / ut (plan §4, verbatim) · Contract
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
| `determinism.test.ts` | always | 3 seeded games identical across a plain loop, uneven 8-34 ms frames, the juice's hit-stop and the box tracker; a recorded person's inputs replay to the same marks, scores, final `p.t` and shot chances, frame batching aside; the sim adds no `Math.exp/pow/log` and never reads a clock or `Math.random` | 4.0 s |
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
    reported at the end of each run. The lab runs reported none; the UT-fixture runs reported the app's own call to the
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
    script naming a remote host, no dev server, or a dry run in which playwright is not isolated.
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

**§3.10 flow today** (`nba-rematch.mjs`, the UT Squad Battles fixture at 393×852, local profile, isolated):

| Row | V2 | Today |
|---|---|---|
| Rung tap to the first controllable possession | ≤ 2 taps, ≤ 3.5 s | **3 taps** (the rung, the vote's PLAY, the Arcade's PLAY), **6.6 s** |
| Skipping the curtain | ≤ 0.3 s | not skippable: the VS card runs its 2.8 s (3.2 s measured) |
| Pause | 0 steps and 0 timers in 10 s; auto-pause on hide | no pause control; a hidden page plays on (10 s of sim in 10 s) |
| Final whistle → onFinish | ≤ 0.3 s | **1.53 s** (the 1.6 s timeout) |
| Rematch → first live frame, 4× CPU | ≤ 1.5 s | **2.77 s** (autoplay's 0.4 s VS card, no vote) |
| New canvases / renderers per rematch | 0 | a new game canvas and renderer every match; ~13,800 offscreen sprite canvases made per game |
| JS heap, game 3 vs game 1 | ≤ 1.10 | 1.02 (71.4 → 72.9 MB after GC) |
| Whistle → next tip-off, with a 5 s result sheet | ≤ 10 s | **13.2 s** (1.5 + 5 + the 6.6 s pre-game a person meets) |

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
| `src/game/stick.ts` (pure) + `src/game/Stick.tsx` | nba-2 | all three sports |
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

### 4.2 `stick.ts` (pure) and `Stick.tsx`

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

`Stick.tsx` is `<Stick geom? disabled? onChange={(o: StickOut) => void} onSprintEdge?={() => void} />`. It provides:
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
   - **Lead decision:** have packs' `ut/rate.ts BADGE_NAMES` read the same map (a one-line import), so cards and the
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
(gold windows, fouls, format, Heat, moves, transition, usage, eras, OT). **nba-1 adds nothing to it:** its engine events
(`fga`, `drb`, `stl`, `int`, `foul`) are pushed beside the existing ones and never change state or the order of
`p.rand` draws; `determinism.test.ts` proves seeded games come out identical with and without them.

---

## Touched outside my lane

- None in nba-1. Every file is the team's: `src/game/hoops2/**` and `scripts/audit/nba-*.mjs`.
- One hunk in the team's own `Hoops2.tsx` worth knowing about: a dev-server-only probe (`window.__hg2`, guarded by
  `import.meta.env.DEV`, so the production build drops it) that the geometry, camera and flow probes read.

---

## Owner device checks

None for nba-1 (test and QA infrastructure only). Plan §11's list starts with nba-2: thumb reach, the sprint ring, the
ring's feel, haptics, defense, the rematch loop and accented names.

---

## Left undone

- Nothing from nba-1's Must list. The probes measure only what today's game has; rows for controls that don't exist yet
  (pause, Heat bar, sprint ring, gestures on A) print "absent", and the tasks that build them add their measurements.
- `hold.heapGrowth` is measured after the 3rd autoplay game against the 1st, not after the 5th rematch: a full autoplay
  game takes about 90 s at 1×. nba-3's held arena re-measures across 5 rematches.
