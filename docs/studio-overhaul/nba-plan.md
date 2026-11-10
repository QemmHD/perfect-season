# Team nba: build plan (studio overhaul, revision 2, 2026-11-10)

Worktree `/home/user/ps-s-nba`, branch `claude/studio-nba`, dev-server port **5215**.
`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

Sources read in full: `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-nba.md`, `O/audit-nba.md` (NBA-01 … NBA-30,
§4, §5, §11, §12, §13), `O/research-basketball.md` (all sections), `CLAUDE.md`, `docs/ARCADE-V2.md`, `docs/CORE-GAMEPLAY.md`,
`docs/GAMEPLAY-RATINGS.md`, `docs/GAMEPLAY-RESEARCH.md`, every file in `src/game/hoops2/`, `src/game/Arcade.tsx`,
`src/game/difficulty.ts`, `src/game/play-feedback.ts`, `src/game/progress.ts`, the hosts (`src/ut/Match.tsx`, `src/App.tsx`,
`src/ut/Moments.tsx`, `src/ut/moments.ts`, `src/evolution/Training.tsx`, `src/game/Lab.tsx`), the mark consumers
(`src/ut/match-debrief.ts`, `ut/Match.tsx` label tables, `src/ui/Results.tsx`), `src/ut/play.ts decide()`, `src/ut/battles.ts`
levels, `src/ut/league.ts`, `src/ut/rate.ts toHooper`, `src/engine/broadcast.ts`, `src/net/match.ts arcadeOf`,
`src/lib/sound.ts`, `scripts/qa/browser.mjs`, `scripts/qa/online.mjs`, the audit harnesses in `O/audit-scripts/`, the other
teams' STREAM briefs, and (read-only) the nfl team's plan, whose shared-file contracts this plan adopts.
The team doc for results is `docs/studio-overhaul/nba.md` (created in nba-1).

## 0. What changed in revision 2

An independent critique found gaps, ordering problems and oversized tasks. Every point is answered in §11 (index), either
by a change below or by a stated reason for rejecting it. The main changes:

1. **Owner decisions 2 and 3 come early.** A minimal "defense played by default" format lands in **nba-6**, right after
   fouls. SWITCH/STEAL/CONTEST and the rest of defense come in nba-7, on top of it. If time runs out, polish is cut, not
   the owner's decision.
2. **One global fit, at the end.** nba-8 builds the stats mechanisms (usage, eras, difficulty, zones, AI playbook) and
   checks only local properties. The §3 bands are asserted once, in **nba-10**, after every mechanic that moves PPP, TOV,
   ORB or the shot mix has landed. The lead gets a post-merge re-check recipe, because packs is re-rating cards.
3. **Every task has a Must list and a Cut line.** The cap is 10 tasks, so tasks were rebalanced rather than split into
   20. Cut-line items move to §9 if a session overruns. P0 items and owner decisions are never on a cut line.
4. **Online overtime and forfeit** get a design note, committed before any code, and a two-client matrix (nba-9). They
   follow the nfl team's contract (`'FF'` end mark, `onFinish(..., forfeit)`), so `Arcade.tsx` gets one shared shape.
5. **Shooting targets state the human model.** The model uses two release spreads: σ 50 ms for a median human and σ 35 ms
   for a skilled one. nba-1 measures which THR is a "league-average shooter". The plan adopts the research's per-contest
   bands. Where its three statements cannot all hold, the math is shown (§3.3).
6. **One controls context table** (§5) settles every gesture before nba-3 starts. "Circle = spin" is cut. The research's
   "swipe up = dunk" and "swipe down = floater" are replaced by automatic finish choice.
7. **Day-one contracts and lead escalations** (§4, §6) are written into `nba.md` in nba-1, not task by task.

## 1. Goals

1. **It plays like basketball.** Solo matches alternate offense and defense, and defense is played by default. The
   rival's score comes from possessions you defend, and ties go to overtime. The game has fouls, free throws, fast breaks,
   runs, and a box score with a player of the game. A solo game takes 4–6 minutes.
2. **Stats feel legit.** An even Pro game lands on the research's 2024-25 per-16-possession targets (§3), with:
   - the right shot-zone mix
   - a star's share for stars
   - eras that play in the right order
   - a real four-rung difficulty ladder
   - no hidden-rating tiebreaks
3. **Touch controls are built for thumbs.**
   - Nothing sits on top of the ball handler or your defender.
   - The stick never ignores a thumb.
   - Every gesture has one meaning per context.
   - The release is measured from the touch, and the green is drawn at its true size.
   - A PURE release is clearly good.
4. **Readable, fair, taught.**
   - The clock never freezes.
   - Banners stay off the rim and labels never stack.
   - Names print with their accents, and no two players share a tag.
   - Every miss, and every rival score, explains itself.
   - Each new mechanic gets a one-time, one-line hint.
5. **Keep what works (audit §12):**
   - the deterministic fixed-step engine
   - physical rebounds and catches
   - the recorded jump shot timed to the meter
   - the rating tests
   - landscape and safe areas
   - the render-only juice layer
   - input hygiene and `rescue()`
   - the ~2 ms frame cost

## 2. Hard rules and working conventions

- **Saves.** No profile, storage key, card/edition/copy id or saved-field meaning changes.
  - Everything new is in memory: `Hooper`, `HoopsGame`, `Possession` and `Progress` gain *optional* fields.
  - The one exception is a new per-device key, `perfect-season:hoops-prefs:v1`
    (`{ v: 1, controls, meter, offsetMs, autoDefend, hints }`). It is read with try/catch, falls back to defaults when
    missing or corrupt, and is not in `recovery.ts` lists.
  - Writing it triggers a harmless cloud-save queue (`cloud-save.ts:186-191`); this is documented in `nba.md`.
- **Protocol.** We never edit `DRAFT_RULES` or `UT_RULES`. One running line in `nba.md` collects every reason:
  **"Protocol bump needed: NBA draft 10→11, UT NBA 10→11 because …"**. NFL and soccer are not changed by this team.
- **Determinism.**
  - Seeded RNG only (`p.rand`, `pl.rand`). No `Math.random()` or `Date.now()` in `engine.ts`, `game.ts` or `autopilot.ts`.
  - Touch timestamps only feed your own offense's release offset (each phone plays its own offense).
  - New random draws use their own named seed streams: `'ai:'` for alternate-format AI possessions and `'cards:'` for
    dealt cards. They never shift the RNG order that `aiPossessionsOf` uses for online takeovers.
  - New sim-side math uses only `+ − × ÷`, `sqrt`, `min`, `max` and lookup tables, never new `Math.exp/pow/log`. Those
    are not guaranteed bit-identical between JSC (iPhone) and V8, and takeovers must match on both phones.
    `determinism.test.ts` enforces this rule for the new functions.
- **Branching.** `pick({ nba, nfl, soccer })` only. Run `src/engine/sport-branches.test.ts` whenever `Arcade.tsx` or
  `difficulty.ts` is touched.
- **Layout.**
  - 390 design-px frame. No width media queries in new CSS. Taps ≥ 44 design px. Text ≥ 10 design px. SVG for symbols.
  - New CSS goes in new nba-owned files imported from hoops2 components: `hud.css`, `controls.css`, `match.css`.
  - Every rule is scoped `.hg2:not(.fb2)`, because football reuses `.hg2-*`.
  - `.arcade-full` is portaled outside the 390 stage, so its sizes are real CSS px. Controls read `--sat/--sab/--sal/--sar`.
- **Reduced motion.** Every new animated element has a defined `prefers-reduced-motion` behaviour (the table in nba-2,
  extended by each task).
  - Screenshots of animation use `reducedMotion: 'no-preference'`.
  - Each task also runs one `'reduce'` pass, because `browser.mjs` fixtures default to `'reduce'`.
- **Shared files.** These get small local hunks only, never reformatted, each listed under "Touched outside my lane":
  - `Arcade.tsx`, `difficulty.ts`, `ut/Match.tsx`, `App.tsx`
  - `PlayReadout.tsx`, `play-feedback.ts`, `play-readout.css`
  - `lib/sound.ts` (append-only, away from soccer's crowd wiring)
  - `render.ts` player sections
  - `Lab.tsx` and `evolution/Training.tsx` (unowned)
- **QA isolation** (nba-1 builds it; every browser run uses it):
  - `scripts/audit/nba-lib.mjs` is copied from `O/audit-scripts/utui/lib.mjs`. Every context gets
    `route('**/*')`, aborting any host that is not localhost/127.0.0.1 (fonts.googleapis.com and fonts.gstatic.com are
    allowed).
  - Base URL `http://localhost:5215/` with `?ns=inspect&relay=ws://localhost:7795`. **7795 is the team's own relay
    port**, so we never share a relay with another team; nba's copy of the relay runs there. BUILD-RULES names 7777; the
    isolation it asks for still holds, because 7795 is localhost. The deviation is recorded in `nba.md`.
  - Inset injection: `page.addStyleTag` sets `.arcade-full { --sat --sab --sal --sar }` to the iPhone values in §3.8.
    Chromium reads `env()` as 0, and shell's QA override (Fix D) isn't merged yet.
  - The shared `scripts/qa/*.mjs` (core-gameplay, gameplay, play-feedback, online) don't route-abort and default to port
    5173. They run only through `scripts/audit/nba-qa-run.mjs`, which:
    - sets `PS_QA_URL=http://localhost:5215/`
    - preloads an isolation patch that wraps Playwright's `newContext` with the same route-abort
    - refuses to start if the patch can't attach
  - `scripts/qa/online.mjs` binds 7777, so it runs only under `flock /tmp/ps-qa-relay-7777.lock`.
  - The heavy.sh semaphore wraps every heavy command. Dev server start: `nohup npx vite --port 5215 --strictPort > /tmp/ps-nba-vite.log 2>&1 & echo $! > /tmp/ps-nba-vite.pid`;
    stop: `kill $(cat /tmp/ps-nba-vite.pid)`. Never `pkill -f` or `pgrep -f`.
- **The standard test set** runs after every task, through heavy.sh:
  `npx vitest run src/game/hoops2 src/game/juice.test.ts src/game/play-feedback.test.ts src/game/difficulty.test.ts src/ut/match-debrief.test.ts src/ut/content.test.ts src/engine/sport-branches.test.ts`.
  `src/game/balance.test.ts` runs (opt-in) in nba-8 and nba-10. The full `npm test` and the single `npm run build` run
  only in nba-10.
- **Test budget.** New always-on tests add **≤ 60 s** to the NBA run of `npm test`, which already spends ~170 s in
  `ratings-matter`. Always-on tests:
  - determinism, < 15 s
  - box, 20 games, < 10 s
  - calibration smoke, 20 games with wide bands, < 20 s
  - OT, 200 forced ties, < 5 s
  - unit tests
- **Opt-in tests** (each behind an environment variable):
  - calibration (`NBA_CAL`)
  - human harness (`HUMAN`)
  - curve dump (`NBA_CURVE`)
  - 10k-game OT (`NBA_OT`)
  - 200-game box (`NBA_BOX`)
  - era runs (`NBA_ERA`)
  - Moments harness (`NBA_MOMENTS`)
- **Compute on the shared machine.** Iteration runs use `NBA_CAL_GAMES=15` (report only, never asserted). Acceptance runs
  use 150 games/config, once per task where a task asks for them. No task holds a heavy.sh slot for more than 20 minutes
  in one go; long runs are split by config.
- **Docs.** Each task updates the NBA parts of `docs/ARCADE-V2.md`, `docs/CORE-GAMEPLAY.md` or `docs/GAMEPLAY-RATINGS.md`
  where it changes what they describe. nba-10 does a final pass. Known stale lines: ARCADE-V2 "Offense only" and
  "5–6 min"; GAMEPLAY-RATINGS "75 open three 67%" and the curve numbers; CORE-GAMEPLAY "SHOOT becomes BOARD" and the
  controls.
- **Commits.** One or more per task, staged by explicit path. Message `Claude: …` plus the two trailer lines from
  BUILD-RULES, then `git push -u origin claude/studio-nba` (retry 2/4/8/16 s on network errors).

## 3. Targets (the numbers the tasks prove)

**Scale and sample.** "Even 78" means each starting five's mean **rating-scale overall** (`RatedCard.rawOvr`, the
2K-comparable number, as `aiOpponent()` builds squads). nba-1 prints the displayed (`ut-scale.ts`) mean beside it.
Acceptance runs use **150 games/config** (2,400 possessions per side; PPP SE ≈ 0.022), and every asserted band is at least
±2 SE wide. 15-game iteration runs are never asserted.

### 3.1 Per 16 possessions, one side, even 78 Pro (AI vs AI, Pro skill, Pro defense, modern era)

From the research's B-R per-100 table for 2024-25 (§4.7), and its §5.14 table. Tolerances are ours.

| Stat | Real (per 16) | Accept | Audit baseline |
|---|---|---|---|
| Points (PPP) | 18.3 (1.145) | 1.08–1.18 | 1.28 |
| FGA | 14.4 | 13.4–15.4 | not reported |
| 3PA (3PA/FGA) | 6.0 (.42) | .35–.45 | .327 |
| FTA (FTA/FGA) | 3.5 (.24) | .18–.28 | .019 |
| Turnovers (TOV%) | 2.3 (12.6%) | 11–15% | 6.6% |
| Steals | 1.31 | 1.0–1.5 | not reported |
| Blocks | 0.78 | 0.6–1.0 | not reported |
| Personal fouls | 2.98 | 2.5–3.5 | ~0 |
| Offensive rebounds (ORB%) | 1.8 (25%) | 22–29% | 22.3% |
| Assists (AST/FGM) | 4.3 (63.5%) | 55–68% | 84% (generous count) |
| FG% / 3P% / eFG | .467 / .360 / .543 | .44–.50 / .33–.39 / .52–.57 | .539 / .431 / .610 |
| Rim FG% (0–3 ft) | 69.6% | 62–72% | 58% |
| Mid-range FG% | 40–44% | 38–47% | **65%** |
| FT% | 78% | 74–80% | n/a |
| Shot mix rim / close / mid / three | 23 / 30 / 5 / 42% | 20–38 / 12–25 / 4–12 / 35–45% | 27 / 14 / 26 / 33% |
| Heavy + smothered share of jumpers | — | ≤ 45% (all configs) | 46% (89% for 90 v 75) |
| Passes per possession | ~3 | ≥ 1.2 (incl. 90 v 75) | 1.31 (0.37 for 90 v 75) |
| Seconds per possession (14 s clock) | — | 6.5–9.5 | 6.2 (2.6 for 90 v 75) |
| Highest-usage card's share of FGA | 28–35% | 25–36% | 15% |
| Top scorer's share of team points | — | ≤ 45% | 62% |
| Players who score per game | — | ≥ 3.5 | 2.9 |
| PG slot's share of possession time | — | ≤ 45% | 74% |
| C slot's share of team 3PA | — | ≤ 10% unless his real 3PA ≥ 3/g | not reported |
| Transition share / its PPP | 15.7% / 1.22 | 12–17% / 1.15–1.35 | none |
| Ties decided off the floor | 0 | 0 (OT cap never hit in 10k sims) | 5–10% |

**Per-player sanity rows** (research §5.11), from the fit's box lines:
- bigs with real 3PA < 1/g take < 1 three per 4 games
- shooters with real 3P% ≥ .40 on ≥ 4 3PA/g shoot 40–45%
- every player's FT% stays within 50–93%

### 3.1b Eras (research §4.6–4.7), fives grouped by the median season of the starting five

| Decade | 3PA/FGA | PPP | TOV per 16 | ORB per 16 | FT/FGA |
|---|---|---|---|---|---|
| 1960s–70s | ≤ .05 | 1.00–1.10 (B-R estimates) | 2.6–3.2 | ≥ 2.2 | ≥ 2020s + .04 |
| 1980s | ≤ .12 | 1.02–1.12 | 2.6–3.0 | ≥ 2020s + 0.2 | > 2020s |
| 1990s | .10–.25 | 1.02–1.12 | 2.5–2.9 | — | — |
| 2000s | .15–.28 | 1.02–1.12 | 2.3–2.7 | — | — |
| 2010s | .25–.38 | 1.02–1.12 | 2.2–2.6 | — | — |
| 2020s | .36–.46 | 1.10–1.18, highest decade by ≥ 0.02 | 2.1–2.5 | 1.6–2.0 | — |

3PA/FGA is non-decreasing by decade (0.02 slack), and seconds per possession are lower in the 1980s than the 2000s.

### 3.2 Difficulty ladder (NBA-19): four rungs, one continuous curve

UT has four rungs (`ut/battles.ts` LEVEL: skill −0.15 / 0 / +0.08 / +0.15 and def −0.5 / 0 / 0.5 / 1 on top of the base,
plus Club Season's adaptive skill). Draft uses `AI_SKILL` 0.45 / 0.68 / 0.88. So difficulty is defined as two
**continuous** functions; the rungs are just points on them:

- `releaseSd(skill)`: the AI release spread. It is monotone decreasing on skill ∈ [0.42, 0.94] and passes through 95 ms at
  0.45, 58 ms at 0.68, ~50 ms at 0.76 and 44 ms at 0.88 (±5 ms). It is a table lookup with linear interpolation, so no
  `pow`.
- `windowFactor(def)`: the AI defense's effect on your windows: `def < 0 ? 1 − 0.5·def : 1 − 0.2·def`. That gives
  ×1.25 / ×1 / ×0.9 / ×0.8.

Rows are measured with the median-human harness (nba-1), with defense played (alternate format):

| | Rookie | Pro | All-Star | Legend | Baseline |
|---|---|---|---|---|---|
| AI offense PPP vs a median-human defender | ≤ 1.00 | 1.08–1.18 | 1.12–1.22 | ≥ 1.18 | 1.27 / 1.28 / 1.16 (inverted) |
| Median-human offense PPP vs that AI defense | ≥ 1.15 | 1.05–1.20 | 0.98–1.12 | 0.90–1.05 | 0.4–0.9 |
| Median human wins | 60–80% | 40–60% | 30–50% | 20–40% | Rookie loses most |
| AI turnover rate | 11–15% | 11–15% | 11–15% | 11–15% | 5.6% / 6.6% / 18% |

Three more rows:
- On Pro, every simple honest human tactic (drive, cross-drive, three, elbow, kick) scores ≥ 0.80 PPP, and the step-back
  exploit ≤ 1.30.
- Human straight-drive possessions ending in a strip: Pro ≤ 7%, Legend ≤ 10% (baseline 10–25%).
- Autopilot vs the median human, same fives, Pro: autopilot PPP ≤ human − 0.05 (research §5.3).

### 3.3 Shooting (NBA-14/15, research §5.1)

**Human model.** The **median human** releases with σ = **50 ms** Gaussian error around the window centre. That covers up
to ~32 ms of iPhone touch-latency jitter plus casual timing. It is the reference for every asserted band. The **skilled
human** is σ = **35 ms** (the research's figure); those numbers are reported and only held to ceilings. nba-4's timing
calibrator measures the owner's own σ on the phone (Owner device checks). If it is < 40 ms, the lead revisits these bands.

**League-average shooter.** THR_avg is the THR that `hoops2/ratings.ts` (and `ut/rate.ts` for UT) gives a 2024-25 player
who shot 36.0% on ≥ 3 3PA/g. nba-1 measures it (expected ≈ 72) and writes it into `targets.ts`. "Elite" is THR ≥ 92.

**Window sizes** (full width, Pro, fresh, catch-and-shoot):

| | Open | Light | Heavy | Smothered |
|---|---|---|---|---|
| THR 55 | 20–25 ms | ×0.75 (≥ 20 ms floor) | amber, ×0.42 | amber, ×0.17 |
| THR_avg | 44–50 ms | ×0.75 | amber | amber |
| THR 75 | 45–55 ms | ×0.75 | amber | amber |
| THR 85 | — | — | **25–30 ms** | **10–12 ms** |
| THR 95+ | 70–85 ms (rhythm catch ≤ 95) | — | — | — |

Heavy and smothered contests draw an amber sweet spot instead of a green slice; their makes follow a rating-scaled cap.

- **Floors.** Open and light windows are ≥ **20 ms** at every difficulty, including Legend and online. Heavy and smothered
  are ≥ 8 ms. This settles the research's own conflict:
  - §5.1.2 gives a poor shooter 15–25 ms.
  - §5.15 says "open ≥ ~40 ms on Pro"; we read that as the average shooter, who gets 44–55 ms.
  - So a THR-55 open three is a real risk (≈ 25% at σ 50), never pure luck.
- **Pull-up / moving / fade.** The window is ×0.88 and moved +10 ms later, so a pull-up makes ≤ 0.90× a catch-and-shoot for
  the same shooter and contest (NBA.com 32.9 vs 37.4%).
- **Fatigue** (research §5.7) moves the window +15 ms at 60% energy and +25 ms at 40%. It also shrinks it by up to 15%
  (×(1 − 0.15·clamp((0.70 − e)/0.40, 0, 1))). Below 50% energy, speed and burst are capped −5%.
- **One combined cap.** `windowScale(parts)` in engine.ts is the only place window multipliers meet:
  - heat (nba-4), RUN (nba-6), meter mode (nba-4), difficulty (nba-4 and nba-8)
  - rhythm (existing), fatigue and pull-up (nba-4), zones (nba-8, if they ever touch the window)
  - The product is capped at **×1.45** of the base window, and the absolute full green at **≤ 110 ms**.
  - A unit test runs the worst stack: On Fire ×1.25 · RUN ×1.08 · meter Off ×1.10 · Rookie ×1.25 · rhythm, THR 99.
- **Green = make where drawn.** An open or light release inside the green always scores, with no block roll. Heavy and
  smothered draw an **amber** sweet spot labelled "PURE · HEAVY", where the best result is the rating-scaled cap. The
  colour follows the live contest every frame.

**Make rates, threes, catch-and-shoot, Pro, fresh** (research §5.1.6 anchors 39.1 / 35.0 / 29.7 / 27.1%):

| Contest | THR_avg at σ 50 (asserted) | Elite (THR 95) at σ 50 | THR_avg at σ 35 (ceiling) |
|---|---|---|---|
| Open | **38–41%** | **50–56%** | ≤ 55% |
| Light | **33–36%** | — | ≤ 46% |
| Heavy | **25–29%** | — | 25–31% |
| Smothered | **15–22%** | — | 15–24% |
| Pull-up | ≤ 0.90 × the catch-and-shoot rate | — | — |

Open mid-range for THR_avg: 40–46%. Free throws: the FT meter at σ 50 lands within ±6 points of `freeThrow(rating)`.

**Documented divergence** (recorded in `nba.md`). The research's three statements cannot all hold at σ 35:
- the windows (§5.1.2)
- "an open green always goes in" (§5.1.5)
- "THR_avg open 38–41% at σ 35" (§5.1.6)

The arithmetic: a 47 ms window gives P(|e| < 23.5 ms) = 2Φ(23.5/35) − 1 ≈ 0.50 from greens alone. All three hold at
σ ≈ 50 except the elite row: 70–85 ms windows give ≥ 50% greens even at σ 50. We keep the STREAM's windows and the green
rule. We assert the bands at σ 50, and accept elite open at 50–56% (research 48–52%). Skilled thumbs beat the real rates,
by design (it is a skill game). Box-level realism comes from the AI's release spread, the contest mix and the off-green
fall-off.

- **Release precision.** A release at exactly `t0 + top`, landing between two 60 Hz steps, gives |off| < 1 ms (baseline:
  up to 16.7 ms).
- **Meter.** The radius is 0.13 × min(W, H) (was 0.09). The slice is drawn at true size and position, with a centre notch.
  A THR-75 open green is ≥ 8 px wide at 390 px (baseline ~4 px).

### 3.4 Game format and length (owner decision 3)

Solo games (alternate format) are 16 + 16 possessions, in quarters of 4 + 4, with OT periods of 2 + 2. Online head to head
stays the 16-possession offense race, plus OT periods when tied.

**Time budget**, measured with the median-human script at 1× with defense played, replays on:

| Part | Budget |
|---|---|
| Live possession, median, both ends | 7–9 s |
| Dead time between possessions | ≤ 1.2 s |
| Free-throw attempt | ≤ 4 s each (online auto-shoot after 4 s idle) |
| Card or look pick (nba-10) | median ≤ 1 s; first touch on the court picks; auto-pick at 2.5 s |
| Replays | ≤ 1 per quarter, ≤ 4 s, tap skips |
| Tip-off intro + halftime | ≤ 5 s total |
| A SIM'd defensive possession | ≤ 0.3 s |
| **Whole solo game** | **4:00–6:00** (sum of medians ≈ 5:30) |

Auto-defend games and all-SIM-defense games are reported separately (expected ≈ 4:15 and ≈ 3:30). Length is measured in
nba-6 and again in nba-10, after cards.

### 3.5 Variance and squad strength (research §4.5; ut-ui M3's 24-2 blowout)

- **Even game** (AI vs AI, alternate): final-margin SD 4–6 points; ties before OT 4–8%; lead changes ≥ 1.5 per game.
- **Win probability by OVR edge** (displayed ut-scale overall, mean of the starting fives): +5 → 60–70%; +10 → 75–85%;
  +20 → ≥ 90%.
- **Displayed 96 v 64:** median margin ≤ 20 (baseline blowouts of 24-2).

### 3.6 Defense must reward playing (owner decision 2)

- A median-human defender policy concedes ≤ the Auto-defend PPP − 0.03. The policy stays in front of his man, contests
  within ±100 ms of the release (σ 50 ms), and switches when beaten.
- A poor policy (random stick, no contests) concedes ≤ Auto-defend PPP + 0.12. The downside is bounded, so beginners
  aren't blown out.
- Auto-defend and per-possession SIM run the same engine path: PPP within ±0.03 (identical by construction; tested).
- Full-game SIM win % is within ±5 points of an Auto-defend game's win % (same fives, 300 games).
- **Defensive camera:** your controlled defender's sprite overlaps the AI handler by ≤ 35% at ≥ 90% of AI releases. He is
  never under a control rect in 30 sampled frames at all eight sizes.

### 3.7 Heat, runs and late-game fouls

- Per alternate game: "Hot Hand" (stage 1) in 50–80% of games, "Locked In" (stage 2) in 15–35%. The final stage names
  are a lead decision (§4).
- RUN banner: 0.8–2.0 per alternate game.
- Intentional fouls happen only when the AI trails by 3–6, the user is in the bonus, and it is the last 2 possessions:
  0 outside that state, and fired in ≥ 70% of qualifying states.

### 3.8 Controls, HUD and text

**Eight QA sizes, with injected insets:**

| Orientation | Size (insets) |
|---|---|
| Portrait | 393×852 (sat 59 / sab 34), 430×932 (59/34), 375×667 (20/0), 320×568 (20/0) |
| Landscape | 852×393 (sal/sar 59, sab 21), 932×430 (59/21), 667×375 (0), 568×320 (0) |

The Dynamic Island sizes also run once with sat **81** (59 + shell Fix A's 22 px edge), because Fix A raises the in-game
`--sat`. Everything is re-measured after shell's merge.

**Gestures:**
- ≤ 2% misclassification over 200 jittered synthetic gestures per class (tap, hold, 4 swipe directions).
- 0 accidental passes from stick touches in the scripted run.
- Stick + SHOOT held together are both tracked (two-pointer test).
- The stick responds within 1 frame of pointerdown, and never spawns from the bottom `sab + 12 px` band (home indicator).

**HUD share.** These replace the critique's portrait numbers, which can't all hold: 852 − 59 − 96 − 34 − 210 = 453 px,
which is 53%, not 55%.

| Size | Top HUD | Bottom controls | Court share | Baseline |
|---|---|---|---|---|
| 393×852 | ≤ sat + 96 px | ≤ sab + 190 px | ≥ 55% of the height at sat 59; ≥ 52% at sat 81 | ≈ 45% |
| 320×568 | ≤ sat + 84 | ≤ sab + 170 | ≥ 50% | — |

At 320 wide, SHOOT is 84, PASS 56 and the stick base r = 48.

The rim-box check (the projected rim ± 40 px) covers the post-shot chip, the heat/RUN banners, the FT meter, the play
cards, the CALL radial and hints.

**Readable text.** Every new DOM text is ≥ 10 px at 320 wide: chip, box score, cards, pause menu, CALL radial and hints.
The box score fits 320 px with no horizontal page scroll; an internal scroller with a sticky name column is allowed. Canvas
labels keep ≥ 10 px glyph height.

**Name tags.** 0 duplicate on-court tags across 1,000 random UT squads (a first-initial prefix on collision), and 0 glyph
misses for F35.

### 3.9 Performance, bundle and test time

- **Absolute frame budget** in offense, defense, FT trips and replays alike:
  - at 4× CPU: median ≥ 55 fps and ≤ 5% of frames over 20 ms (baseline 51.8–56.7 fps, up to 62 frames > 20 ms in 10 s)
  - at 1×: p99 ≤ 10 ms
- **Bundle:**
  - game chunk ≤ +15 KB gzip
  - main / first-paint chunk +0 KB
  - UT chunk ≤ +2 KB (only `hoops2/usage.ts`, which is dependency-free)
  - no new hoops2 imports from `main.tsx`, `App.tsx` or the UT entry
  - `targets.ts` is imported by tests only
- **Test time:** ≤ 60 s added to the NBA `npm test` run (§2).

### 3.10 Flow and pause

- **Pre-game:** from the PLAY tap to the first controllable possession takes ≤ 2 taps and ≤ 3.5 s. That counts ut's solo
  pre-match screen (M13), shell's loading state (M9) and our tip-off intro. Skipping the intro takes ≤ 0.3 s.
- **Pause:** 0 engine steps and 0 timer callbacks during a 10 s pause. A scripted game paused mid-possession and resumed
  ends with marks identical to the same run without the pause.

### 3.11 Practice drills and Moments

- Practice mode has 0 FT trips, 0 OT periods, 0 alternation, 0 card picks and no pip limit.
- Shoot, finish and pass drills still count every attempt; a pump fake is not an attempt.
- Each NBA Moment's completion rate under the median-human harness is measured before (nba-1) and after (nba-10). Each
  band goes to ut, for example The Green Room (2 PURE releases in 5): 35–65%.

### 3.12 Online overtime and forfeit (two-client matrix on relay port 7795)

Four cases:
- a tie goes to OT on both phones
- OT plus a rival stall: both phones show the same takeover score
- OT plus a forfeit
- OT plus 30 s in the background

0 mismatched results across 20 seeded two-client runs. The wire never carries more than 37 ends (16 + 2×10 OT + `FF`;
`arcadeOf` caps at 40).

### 3.13 Haptics (owner's phone)

- **Android:** distinct patterns for green, make, dunk, block, turnover and clock.
- **iOS:**
  - A green is 2 ticks about 60 ms apart inside the release gesture; a make is 1 tick.
  - Loop-side events (block, turnover, shot clock) are **dropped**, not delayed.
  - Both are stated in `nba.md` and checked on the owner's phone. If WebKit refuses the second tick outside the
    activation, the green falls back to 1 tick plus the visual pop, and that is documented.

## 4. Owner-decision conflicts and lead decisions (escalated in `nba.md` on day one)

1. **Owner decision 2 vs modes with no arcade match.** The decision lists Moments, Gauntlet and draft season/playoff games
   among the solo games where defense is played by default.
   - Gauntlet (`ui/Gauntlet.tsx`), `engine/season.ts playSeason()` and the playoffs are rating sims with no arcade match.
   - Moments are Hoops2 `practice` drills.
   - **nba ships what the engine can:**
     - the alternate format available to any host with two fives (nba-6)
     - a new drill, `practice.drill: 'defend'` ("get N stops in M AI possessions", nba-7), so ut can add a defensive Moment
   - **Options for the lead:**
     - (a) keep Gauntlet/season/playoffs as sims this round (recommended; no arcade exists there)
     - (b) add an optional "play this game" arcade entry for playoff games or the Gauntlet boss (ut and shell screens;
       nba's format is ready)
     - (c) play only the Finals
2. **In-game names that echo other games.** The BRIEF bans copied names; owner decision 1 covers mode names only. nba
   ships one exported `BADGE_LABEL` map in `hoops2/badges.ts` with the research §5.8 originals: Deadeye → Ice Water,
   Limitless → Deep Range, Dimer → Table Setter, Posterizer → Poster Maker, Clamps → Lockdown, Ankle Breaker → Ankle Taker,
   Rim Protector → Paint Wall.
   - Heat stages "HEATING UP" / "ON FIRE" and "<TAG> IS ON FIRE!" (`Hoops2.tsx:394`) become **"HOT HAND" / "LOCKED IN"**.
   - The badge tier "Hall of Fame" becomes **"Elite"** in display.
   - Internal ids (`fire`, badge ids) stay. nba's in-game surfaces use the map by default.
   - **Lead decision:** have packs' `ut/rate.ts BADGE_NAMES` read the same map (a one-line import), so cards and the
     in-game pop agree. If the lead declines, nba flips its pop to the card names (one constant) and records it.
3. **UT mode ideas without an owner** (research §5.13: Top Plays/Flashbacks, Clutch mode, card-once Gauntlet, one-use
   boosts). STREAM-ut doesn't include them.
   - nba exposes cheap engine options on `newHoopsMatch`: `possessions`, `clock` seconds and `startersOnly` (nba-6).
   - The 4-point "logo" zone needs a new mark and a protocol change, so it is built only if ut/lead commit to Clutch mode.
4. **Score-scale handoffs.** Typical scores change: PPP 1.28 → ~1.145, plus FTs and OT.
   - `src/engine/broadcast.ts` (the draft GameCast's uniform 206 ± 17) has no owner in OWNERSHIP.md: lead.
   - `ut/league.ts` AI-only "arcade-length scoring" (`league.ts:303`) is ut's.
   - nba-10 writes both handoffs with the measured mean and SD per side per 16 (alternate format), plus the era-aware
     totals from research §5.11.
5. **Tie copy** (ut-owned files): `ut/Match.tsx ~1449` "A tie goes to the better squad" and `ui/Results.tsx:250` "Tied on
   points: the better team (by rating) takes it" become, for NBA, "Tied after regulation: overtime decided it". Proposed
   copy goes to ut; soccer's penalties line is untouched.
6. **Online quit = instant loss** (not an AI-finished game). This is agreed with ut and nfl in §6.3. The app being killed
   mid-match still falls back to ut's "match in progress" marker and the existing takeover.

## 5. The controls context table (one meaning per gesture per context; tested in nba-3)

Slots on the right: **A** = SHOOT (92 px; 84 at 320 wide), **B** = PASS (64; 56), **C** = small (48): CALL on offense,
SWITCH on defense. The left thumb is the floating stick everywhere.

| Context | Left thumb | A (SHOOT slot) | B (PASS slot) | C | Hint (first time) |
|---|---|---|---|---|---|
| Offense, ball in hand | Stick: move; edge = sprint | **Down:** the gather starts and the meter t0 = the touch timestamp. **Up < 120 ms, < 12 px:** the gather is cancelled into a pump fake. **Held ≥ 120 ms, then up:** the shot. Stopped = pull-up jumper (also inside 11.5 ft). Moving to the rim = an automatic finish: layup, dunk by ratings, or a **floater** 6–12 ft with a defender between him and the rim. **Swipe ≥ 36 px within 250 ms:** the gather is cancelled at no cost into a move: left/right = crossover that way, down = step-back, up = spin. | Tap: pass to the stick-aimed or most open man. Hold, release over the rim: lob (alley-oop to a cutting dunker). Tapping a teammate's body passes to him. | CALL radial: SCREEN / CUT / SPACE | "Hold SHOOT, release on the green · tap = pump fake · swipe off it = moves" |
| Offense or defense, rebound race | Stick: your nearest man (assist toward the *estimated* landing) | **BOARD:** jump on pointerdown (no tap/hold split) | hidden | hidden | "BOARD: jump as the ring fills" |
| Free throw | — | Hold: raise the marker; release in the band | hidden | hidden | "Hold, release in the band" |
| Defense, AI has the ball (nba-6 stick; nba-7 buttons) | Stick: your defender; idle = AI positioning (assist) | **CONTEST:** jump on pointerdown; hands up are automatic within 4 ft | STEAL: tap | SWITCH: tap (nearest to the ball) | "Defense: steer your man · CONTEST on the release" |
| Dead ball, inbound, celebration | Stick direction stored and applied at tip-off (NBA-12) | Held: ignored, with a "LET GO TO SHOOT" state. Tap: skip the celebration or replay. | hidden | hidden | — |
| Card pick (nba-10) | First touch on the court picks the highlighted card | same | same | same | "Pick a play, or just start" |
| Buttons mode (pref) | Same stick | Tap = pump, hold = shot, **no swipes** | as offense | CALL | CROSS / STEP / SPIN buttons (≥ 44 px) in an arc above SHOOT, firing on pointerdown |

Design notes:
- **Gesture timing conflict resolved.** The gather starts on pointerdown, so the meter's t0 is exact. The tap and swipe
  classes resolve inside the first 120–250 ms, which is far before the window top (0.52 s jumper, 0.42 s layup). Both
  cancel the gather at no cost; the existing cancellable capture is reused. BOARD and CONTEST jump on pointerdown, so they
  never wait for pointerup.
- **What is cut.** "Circle = spin" is gone (it duplicated "up"). The research's swipe-up dunk and swipe-down floater are
  replaced by the automatic finish choice above, so "up" and "down" have one meaning each.
- **Practice drills** use the offense row; the pass drill also allows B.

## 6. Cross-team contracts (written into `nba.md` in nba-1, announced in the team doc)

1. **`render.ts` `draw()`, with players.**
   - nba moves its HUD drawing out of `draw()` into a new nba-owned `src/game/hoops2/hud-draw.ts`: rings, arrows, labels,
     the meter, the FT meter, energy rings, the BOARD ring and heat trails.
   - `draw()` keeps **one call line** after the sprite items loop (`render.ts` ~659-756), which players will rewrite for
     A-1. nba never edits the items loop; players keep that one line.
   - Kits per possession: in the alternate format the offense isn't always "ours". nba passes a per-possession
     `kitOf(bodyIdx)` into the existing look selection at its call site. That is a 2–3 line hunk in players' section,
     agreed here. `lookFor` itself (`render.ts:61-77`) stays players'.
2. **`Arcade.tsx` and `difficulty.ts`, with nfl.** nba adopts nfl's contract names exactly:
   - `onQuit?: () => void` on the game component.
   - `onFinish(us, them, how, took, pens?, forfeit?: 'us' | 'them')`.
   - The `'FF'` end mark (worth 0, ≤ 8 chars, in `POINTS`/`owns`). A quitter pads its ends with `'FF'` to at least the
     regulation count, plus one `'FF'` if already past regulation.
   - The solo rival's progress comes from `onRival`.
   - `userDefenseIQ(online, level)` in `difficulty.ts`, which our §3.2 `windowFactor` mirrors.
   - `onBoxScore`, never sent over the wire.
   - OT ends are appended after regulation.
   - Whoever lands a sport-agnostic block first writes it, and the other reuses it. nba hunks sit inside
     `pick({ nba: … })` branches.
   - Each sport keeps its own pause scheduler; no new shared file. The pause-menu look is aligned with nfl.
3. **Forfeit, with ut and nfl.**
   - The quitter's phone settles a loss.
   - The rival's Arcade sees `'FF'` and finishes at once with a win (`forfeit: 'them'`). `'FF'` is in-band, so it
     survives `net/match.ts arcadeOf`, which strips unknown fields.
   - The existing `left`/`gone` signals (`App.tsx:553, 632`, `ut/Match.tsx:940`) stay as the backup when `'FF'` never
     arrives: today's takeover.
   - ut's "match in progress" marker settles an app-kill as a loss.
   - No new wire field, and no change to the lead's validator.
4. **Pre-game sequence, with ut and shell.**
   - UT solo: ut's M13 pre-match screen is the **only** screen with buttons (PLAY / SIM / Auto-defend toggle). Arcade
     gets `kickoff={false}` from that host and skips its kickoff.
   - Shell's M9 loading state shows only while the chunk loads (0 s when cached) and hands over to nba's tip-off intro,
     which shows the matchup.
   - Draft head to head vs AI: Arcade's kickoff is the pre-game screen.
   - Target §3.10.
5. **Clips, with players.** nba calls players' clip preload (if exported) during the 1.5 s tip-off intro, so first frames
   don't pop from hand-keyed poses to mocap (NBA-30).
6. **Ratings plumbing, with packs.**
   - `ut/rate.ts toHooper` keeps building on `hooper(nbaLineOf(line))`, so the optional `usg`, `yr`, `fd` and `zones` fields
     survive when packs makes matches use the card's own ratings.
   - nba adds `src/game/hoops2/toHooper-fields.test.ts`, which asserts that a rated UT card's Hooper carries them.
   - nba changes no displayed rating (see §11 M4).
7. **Marks, with ut.**
   - New marks are exported from `hoops2/game.ts` as `NBA_MARK_LABEL` and `markPoints()`.
   - `ut/Match.tsx` uses `nba: { ...HOOPS_FOOTBALL_LABEL, ...NBA_MARK_LABEL }`, a one-line hunk; the shared table that nfl
     also extends is not grown.
   - `ut/match-debrief.ts` allows the new marks.
   - Box data reaches hosts through `onBoxScore` from nba-5 on, so ut's result screen (M3) can be built before nba's
     in-game overlay.
8. **Settings, with ut** (whose hunks `App.tsx` holds).
   - The pause menu's Sound/Haptics toggles call `setFeedback()` and dispatch `ps:settings`.
   - The `App.tsx` listener (~8 lines) does **read-modify-write on the stored profile at that moment**, via a pure helper
     `withSettings(stored, patch)` that only touches `settings.sound/haptics`. A UT match that just settled its profile
     can't be overwritten by a stale snapshot. Tested.
9. **AI fallback after a queue.**
   - UT's fallback (`UT_AI_AFTER = 50 s`, `ut/Match.tsx ~1177`) mounts with `online: null`, so it becomes the alternate
     format (defense played).
   - Draft's queue fallback is checked in nba-6. Rule: the format is "alternate whenever the rival is the AI".
10. **Shell.**
    - `.arcade-full --sat` moves with Fix A; all our offsets use `var(--sat/--sab/--sal/--sar)`.
    - Fix D's QA override replaces our injection after merge.
    - The NBA/NFL chunk split (NBA-30) is flagged to shell (`vite.config.ts`).

## 7. Scope map: every STREAM item → task

| STREAM item | Task |
|---|---|
| NBA-08 shot clock every tick, 5 s warning | nba-2 |
| NBA-12 thumb on the stick at tip-off | nba-3 |
| NBA-13/17 layout, floating stick, gestures, reachable calls, nothing over the handler, all sizes | nba-3 (8 sizes) |
| NBA-14/15 touch timestamps, true-size green, research sizes, moving window, 7-step feedback, PURE, contest design, meter-off | nba-4 |
| NBA-14 fix 4 timing calibration | nba-4 (10-tap calibrator) |
| NBA-09 pause and quit everywhere; online quit = forfeit with confirm | nba-9 |
| NBA-10 box score + player of the game | nba-1 (tracker), nba-5 (`onBoxScore` to hosts), nba-9 (overlay) |
| NBA-20/21 camera, banners, rim pile | nba-2 (both ends), nba-6 (live defense measurement) |
| NBA-22 pixel font | nba-2 |
| Haptics | nba-3 |
| Per-16 calibration and era scaling | nba-8 (mechanisms), nba-10 (single fit, asserted) |
| NBA-01 fouls, FT meter, and-ones | nba-5 |
| NBA-01 late intentional fouls | nba-7 |
| NBA-02 mid ~42%, eFG, zone mix | nba-8 (shot value), nba-10 (fit) |
| NBA-03 usage; AI not 83% threes / 89% heavy | nba-8 |
| NBA-04 turnovers ~12% | nba-5, re-measured nba-8, asserted nba-10 |
| NBA-05 eras | nba-5 (stub), nba-8 |
| NBA-19 difficulty ladder | nba-8 (four rungs), nba-10 (fit) |
| NBA-06 ties → OT | nba-6 (every solo path), nba-9 (online) |
| Prove it: seeded tests, `ratings-matter` meaningful | nba-1, every task, nba-10 |
| NBA-07 play defense in solo matches | nba-6 (format, stick), nba-7 (SWITCH/STEAL/CONTEST) |
| Rival score from those possessions; Auto-defend; SIM per possession | nba-6 |
| Online keeps the race | nba-6 (untouched), nba-9 (OT/forfeit, matrix), nba-10 |
| Game length 4–6 min | nba-6 (v1), nba-10 (final) |
| Fast breaks | nba-7 (steal → break; long rebound → early is cut line) |
| Heating Up / On Fire | nba-4 (names per §4.2) |
| Team RUN | nba-6 |
| Hot and cold zones | nba-8 (cut line) |
| Three play cards; defensive looks | nba-7 (drop look and a look chip), nba-10 (cards, cut first) |
| BOARD timing | nba-5 |
| Moves: tiers, pips, cancel | nba-7 |
| Owner device checks | §12, filled task by task |

Audit items outside the STREAM list are covered too:
- NBA-11 → nba-5
- NBA-16 → nba-2
- NBA-18 → nba-3
- NBA-24 velocity ramps → nba-7; real miss endpoints → nba-5
- NBA-27 → nba-3
- NBA-29 floor cache → nba-2
- NBA-30 attrs skip, intro, clip preload → nba-9
- audit §5 AI: rebounding → nba-5; playbook → nba-8
- §11 #13 pass lead → nba-5; §11 #14 pull-up/floater → nba-3 table, nba-4
- research §5.7 → nba-4; §5.8 refill and glow → nba-4/nba-7; §5.10 → nba-4/nba-7; §5.12 box ×6.2 → nba-9; §5.11 sanity rows → nba-10

## 8. Tasks (ordered)

Each task lists **Must** (the task isn't done without it), a **Cut line** (moves to §9 if the session overruns), tests,
screenshots (under `O/shots/nba/<task>/`), protocol, saves, files touched outside the lane, and dependencies. Every task
ends with:
- the standard test set (§2)
- the hints for the controls it adds (§5)
- its doc updates
- its rows in the reduced-motion table
- a commit and push

---

### nba-1 · Enabling · Harness, baseline, box tracker, QA infrastructure and day-one contracts

**Why.** Every later task needs before/after numbers against §3. NBA-10 needs per-player lines from the engine's own
events. Cross-team shapes have to be settled before anyone writes them twice.

**Must**
- **`hoops2/box.ts` (new).**
  - `BoxLine { id, name, tag, pts, fgm, fga, tpm, tpa, ftm, fta, orb, drb, ast, stl, blk, tov, pf, pure }`.
  - `BoxTracker` with `onStep(p, handlerBefore)`, `onEnd(p)`, `lines(side)` and `team(side)`, keyed by player id.
  - An assist is a catch followed by a make within 2.5 s and ≤ 1 dribble move. No RNG.
- **`engine.ts` observation-only events:** `drb:<idx>`, `stl:<idx>`, `int:<idx>`, `fga:<idx>:<kind>:<2|3>`. They never
  change state or RNG order.
- **`hoops2/targets.ts` (new, test-only):** every §3 row as data `{ key, real, lo, hi, source }`, including THR_avg
  (measured here).
- **`determinism.test.ts`** (always on, < 15 s):
  - 3 seeded games (autopilot, with and without juice, uneven `dt` batches) give identical marks, scores and final `p.t`.
  - A recorded human input script replays to the same marks.
  - A source scan finds no new `Math.exp/pow/log` in the new sim functions (§2).
- **`calibration.test.ts`** (opt-in `NBA_CAL=1`; `NBA_CAL_GAMES`, default 15 for iteration, 150 for acceptance):
  - Ported from the audit's `nba-box` and `nba-conc` using `BoxTracker`.
  - Configs: even 70/78/86 Pro, 78 Rookie/All-Star/Legend, 90 v 75, displayed 96 v 64, OVR edges +5/+10/+20, and the
    by-decade era run (`NBA_ERA=1`).
  - Writes JSON to `$NBA_CAL_OUT` (OS temp; not committed) and prints a table against `targets.ts`.
  - `NBA_CAL_ASSERT=1` turns the bands into assertions; that switch is used only in nba-10.
- **`calibration-smoke.test.ts`** (always on, 20 games, wide bands, < 20 s): PPP 0.95–1.30, FTA/FGA ≥ .12 once nba-5 lands,
  TOV 8–18%.
- **`human.test.ts`:**
  - Gaussian release error with `HUMAN_SD` (default **0.050**; also reports 0.035).
  - A `mixed` median-human strategy for offense, and the §3.6 defender policies (median, poor, idle, good contester,
    early jumper, steal spammer) as no-ops until nba-6/7 wire them.
  - A four-rung difficulty sweep (`HUMAN_LEVELS=rookie,pro,allstar,legend`) that plays the AI's possessions against the
    same fives and reports win %.
- **`curve.test.ts`** (opt-in `NBA_CURVE=1`): make % against offset × THR × contest × difficulty, to `$NBA_CURVE_OUT`.
- **`moments.test.ts`** (opt-in `NBA_MOMENTS=1`): every NBA Moment and Training drill run 200 times under the median human,
  reporting the completion rate. Baseline for §3.11.
- **QA infrastructure** (§2):
  - `scripts/audit/nba-lib.mjs`: route-abort, inset injection for the 8 sizes, reduced-motion modes, port 5215, relay 7795.
  - `scripts/audit/nba-relay.mjs`: a localhost relay on 7795, copied from `online.mjs`'s server part.
  - `scripts/audit/nba-qa-run.mjs`: the isolation preload, `PS_QA_URL` and a refusal check.
  - The audit's `nba-shots.cjs`, `nba-clock.cjs`, `nba-deadstick.cjs`, `nba-perf.cjs`, `nba-final.cjs` and `nba-se.cjs`,
    ported to it.
- **Baseline run** (heavy.sh): calibration at 150 games for even 78 Pro and 90 v 75, 15 games for the rest; the human
  harness at 20 games/strategy × 4 rungs; the curve dump; perf at 1× and 4× CPU (absolute fps, frames > 20 ms) at
  430×932 and 320×568; Playwright captures at the 8 sizes. The numbers must reproduce the audit within noise:
  - PPP 1.28 ± 0.05
  - FT rate < .05
  - mid FG% > .55

  Differences are explained in `nba.md` before nba-2.
- **`docs/studio-overhaul/nba.md` (new):** baseline, THR_avg, the running protocol line, §4 escalations, §6 contracts,
  "Touched outside my lane", "Owner device checks", "Left undone".

**Cut line:** none (enabling).

**Tests:** `box.test.ts` (always-on 20 games; `NBA_BOX=1` for 200):
- Σ player PTS = team score; FGA/3PA/FTA match the marks; 0 mismatches.
- A hand-built pass → catch → make credits one assist.

**Screenshots:** baseline tip-off, meter and final at the 8 sizes.

**Protocol:** none (observation events only). **Saves:** none.
**Outside lane:** none (`scripts/audit/*` are new team files).
**Dependencies:** reads `ut/pool.ts`, `ut/battles.ts aiOpponent` and `ut/teams.ts` read-only.

---

### nba-2 · P0 · Readable court at both ends: live HUD, camera framing, floor cache, banners, labels, font, unique tags

Covers NBA-08, NBA-20, NBA-21, NBA-22, NBA-16, NBA-29 (floor cache), the defensive camera rule, unique tags, the in-game
badge names (§4.2) and the reduced-motion table. Render and DOM only.

**Must**
- **Shot clock (NBA-08), `Hoops2.tsx`.**
  - A `clockRef` written from the rAF loop when `Math.ceil(p.clock)` changes.
  - At ≤ 5 s: `.low` (a pulse; with reduced motion, colour only) and `sfx.tick()` once a second.
  - The clock haptic goes through nba-3's module once it exists. Until then it is Android-only, and on iOS it is dropped
    (it is loop-side).
  - A shot-clock violation shows "0" before the banner.
- **Camera, new pure `hoops2/camera.ts`** plus the camera section of `render.ts`:
  - `follow(cam, target, dt)` with time-based easing `1 − exp(−k·dt)` (render-side, so `exp` is fine there).
  - Offense:
    - Track 70% handler + 30% ball, with a 1.5 ft dead zone.
    - **Hold the shooter:** from `pressShoot` until the ball is 60% of the way to the rim, the focus moves ≤ 2 ft toward
      the rim.
    - A lateral offset of 4–6 ft away from the ball side, plus a +0.08 pitch, so the on-ball defender separates from the
      handler.
  - **Defense** (used from nba-6): the behind-the-shooter camera depth-sorts by `cx` (`render.ts:719-756`). Your defender
    stands between the AI handler and the rim, so he would hide the handler (NBA-20 in reverse). The rule:
    - a lateral offset of 5–7 ft toward the side your defender is **not** on
    - pitch +0.12
    - focus at 60% handler / 40% your defender
    - The target is §3.6's defensive camera row. It is unit-tested here with synthetic positions and measured live in nba-6.
  - A fixed zoom near the rim; zoom only in replays.
  - A responsive anchor: `renderer.setControlTop(px)` from the controls' bounding rect. The handler (or your defender)
    sits at 52–55% of the height, always ≥ 8 px above the highest control.
  - A ground ring and short arrow under the on-ball defender (the contest colour), drawn in `hud-draw.ts` so it survives
    occlusion.
- **HUD hook (§6.1).** Create `hoops2/hud-draw.ts` and move the existing meter, ring and label drawing there. `draw()` keeps
  one call line after the items loop.
- **Floor cache (NBA-29).** Reuse the rasterised floor `ImageData` when the camera has moved ≤ 0.5 px. The dead zone makes
  that common. Typed-array replay snapshots are on the cut line, only if §3.9 still fails.
- **Banners (NBA-21), `hud.css`.**
  - `.hg2-pop` moves to the top band under the score bug (portrait `top: calc(var(--sat) + 96px)`; landscape beside the
    bug, inside `--sal/--sar`).
  - The look chip and the hint merge into one line.
  - Nothing DOM-drawn sits over the rim/paint rect.
  - Score bug at 320 wide: the pause slot (44 px) at its left edge, LAST PLAY as a 44 px icon, and "Q2 3/4 · D" as one
    chip (filled in nba-6/9).
- **Labels, new `hoops2/labels.ts`.** `layoutLabels(reqs)` does greedy priority placement:
  meter result > contest grade > handler name > pass-target % > badge pop > call label > defender name.
  It tries two alternate offsets and drops the lowest priority on a conflict. Badge pops use `BADGE_LABEL` (§4.2).
- **Font (NBA-22).** `foldName(s)`: NFD, strip combining marks, plus `ø→O, ł→L, đ→D, ß→SS, æ→AE, œ→OE`. F35 gains
  `& / : + ( ) ,`. `tagOf` keeps the full surname up to 14 letters. DOM text keeps the accents.
- **Unique tags.** `uniqueTags(ours, theirs, benches)` in `game.ts` runs at match start: on a collision (Johnson, Davis,
  Jones…) both become "J.JOHNSON" / "M.JOHNSON", still ≤ 14 glyphs. Display only.
- **Pass-target % (NBA-16)** comes from `catchValue()` (closeout-adjusted), with a contest icon, and the receiver's and his
  defender's names on the target marker.
- **Reduced-motion table** in `nba.md`, one row per new animated element:

  | Element | With reduced motion |
  |---|---|
  | clock pulse | colour only |
  | camera easing | ×2 faster settle, no shake |
  | banners | fade, no slide |
  | ember trail and flame | static tint |
  | RUN banner | fade |
  | CALL radial | instant |
  | card deal | instant |
  | tip-off intro | static lineup card |
  | release pop | no hit-stop, green flash kept |
  | FT meter | unchanged (it's input) |

  Later tasks add their rows.

**Cut line:** typed-array replay snapshots (only needed if the 4× budget fails after the floor cache).

**Tests and measurements**
- `camera.test.ts`:
  - 1 s of input at 30 vs 60 fps ends within 0.5 px.
  - The jumper hold keeps the focus ≤ 2 ft from where it started.
  - The anchor keeps feet ≥ 8 px above the control top at 320×568 and 393×852.
  - Defense rule: synthetic AI handler and defender positions → projected overlap ≤ 35% at ≥ 90% of 1,000 sampled
    release frames.
- `labels.test.ts`:
  - `foldName` covers every character of every name in `cards-nba.json` (122 non-ASCII), 0 misses.
  - `layoutLabels` gives no overlaps on 1,000 random frames.
  - `uniqueTags`: 0 duplicates across 1,000 random UT squads.
- `nba-clock.cjs`: the bug text equals `ceil(p.clock)` at 20 Hz; 0 mismatches longer than a frame (baseline "8" for 7.2 s).
- `nba-hud.cjs` (new) at the 8 sizes:
  - `.hg2-pop` never intersects the rim box.
  - On-ball defender overlap ≤ 35% at ≥ 90% of releases (`__hoopsDebug` hook).
  - Top HUD within §3.8.
  - 0 page errors; only localhost requests.
- `nba-perf.cjs`: §3.9 absolute budget at 1× and 4× (430×932 and 320×568).

**Screenshots:** release with a visible defender, make banner, 320 rim pile, Jokić/Dončić names, a renamed pair of
same-surname tags, 852 landscape release, 932 landscape; each with its nba-1 twin.

**Protocol:** none (render, DOM and text). **Saves:** none.
**Outside lane:** none, except `render.ts`'s single HUD call line (agreed in §6.1).
**Dependencies:** shell (bug plate, Fix A/C), players (sprite drawing; the HUD hook line).

---

### nba-3 · P0 · Thumb-first controls: input layer, the context table, gestures, pump fake, CALL radial, haptics, hints

Covers NBA-12, NBA-13, NBA-17, NBA-18, NBA-27, STREAM "Haptics", research §5.3 and the §5 table.

**Must**
- **Input layer, new `HoopsControls.tsx` + `controls.css`** (the loop stays in `Hoops2.tsx`):
  - `touch-action: none`, non-passive listeners, one tracker per pointer, and `setPointerCapture` always.
  - **Floating stick.**
    - It spawns where the thumb lands in the left 45% of the screen, below the HUD band, and **not** in the bottom
      `sab + 12 px`.
    - In landscape it stays inside `--sal`.
    - A ghost ring at rest. Base radius 52 (48 at 320 wide), round and `flex: none` (fixes the 114×128 oval).
    - A **12% dead zone** with rescaled output; sprint at 92%.
    - The direction is kept in `stickRef` through dead balls and applied at tip-off (**NBA-12**).
    - A touch that starts on a teammate and lifts in < 200 ms without moving is a pass.
  - **Right cluster** per §5: A/B/C slots whose meaning comes from `context(p)` (offense / rebound / FT / defense / dead /
    cards). The `disabled` state is recomputed from the loop through a class toggle (NBA-18).
  - **CALL** (C, 48 px) opens a left-thumb radial of SCREEN / CUT / SPACE (each ≥ 44 px), within 250 px of the stick
    centre. It replaces the strip at `sat + 104px`.
  - **Buttons mode** (pref `controls: 'buttons'`): today's CROSS / STEP / SPIN buttons move into an arc above SHOOT and fire
    on pointerdown; swipes are off.
  - **LAST PLAY** moves into the score bug. `PlayReadout` gets an optional controlled `open`/`onToggle` prop (an additive
    hunk in a shared file; football keeps its toggle).
- **Gestures, new pure `gestures.ts`:** `classify(points, tDown, tUp) → { kind: 'tap' | 'hold' | 'swipe', dir }`. No circle
  class. `contextTable.ts` holds §5 as data, and both the UI and the tests read it.
- **Provisional gather (§5 design note).**
  - pointerdown calls `pressShoot(p, at)` at once.
  - A tap cancels it into `pumpFake(p)`.
  - A swipe cancels it into the move.
  - Cancels inside 250 ms cost nothing (the existing cancellable capture).
- **Pump fake and "make him land", `engine.ts`.**
  - New `Act` `'pump'`.
  - The nearest defender within 6 ft bites with chance
    `clamp(0.15 + (70−prd)/120 + (70−ind)/200 − 0.15·defIQ + (shooterRating−70)/150, 0.05, 0.6)` from `p.rand`.
  - One fake per 0.8 s.
  - A closest defender who is descending at release grades one contest tier lighter.
  - `render.ts poseOf` gets a 2-line `'pump'` fallback (players' section; listed).
- **Haptics, new `hoops2/haptics.ts`:** `haptic(kind)`.
  - Android patterns: green `[12,30,12]`, make `18`, dunk `[25,40,25]`, block `[30,20,30]`, turnover `60`, clock `8`.
  - iOS (§3.13): pointer handlers call it directly. A green tries 2 ticks about 60 ms apart; a make is 1 tick; loop-side
    calls are dropped.
  - `lib/sound.ts` gets an appended `vibrateLive(pattern)` (~6 lines, away from soccer's crowd code); `vibrate()` is
    unchanged for NFL and soccer.
- **First-time hints, new `hoops2/hints.ts` + one DOM line in the HUD band.**
  - One line each, never over the court centre or the rim box.
  - Shown once per device (a bitmask in hoops-prefs `hints`), dismissed on first use or after 3 s.
  - This task adds the lines for the stick, SHOOT/pump/swipes, PASS/lob and CALL.
  - Later tasks register theirs: meter (nba-4), FT and BOARD (nba-5), defense (nba-6/7), cards (nba-10).
- **`prefs.ts`:** `loadPrefs()` / `savePrefs()` for the key in §2.
- **Copy.** `Arcade.tsx`'s NBA `arc-how` text and `Hoops2`'s hints match §5. The old "flick the stick" did nothing.

**Cut line:** the CALL radial's open animation (instant only); a resize option for the stick.

**Tests and measurements**
- `gestures.test.ts`:
  - 200 jittered synthetic gestures per class (tap, hold, 4 swipe directions), with timing jitter ±40 ms and path noise
    ±6 px: ≤ 2% misclassified.
  - Every §5 context × slot maps to exactly one action.
- `controls-input.test.ts` (jsdom):
  - Two pointers (stick + SHOOT) are both tracked.
  - A stick touch never produces a pass.
  - The bottom band never spawns the stick.
- `prefs.test.ts`: missing, corrupt or old-shape JSON → defaults; never touches other keys.
- `haptics.test.ts`: patterns on a `navigator.vibrate` spy; the iOS path drops loop-side calls and emits 2 ticks for a green
  inside a gesture.
- `hints.test.ts`: once per device; a corrupt prefs value shows them again.
- `gameplay.test.ts`:
  - A pump fake baits by rating and never fires a shot.
  - A landing defender lightens the contest.
  - A swipe inside the gather cancels the shot at no cost.
- `scripts/audit/nba-controls.mjs` (CDP multi-touch) at the **8 sizes**:
  - every control ≥ 44×44 with no overlaps (4 px gaps)
  - the handler is never under a control at tip-off or in 30 sampled frames
  - CALL within 250 px of the stick (baseline ~600)
  - a thumb down 300 ms before tip-off moves the handler > 1.5 ft within 300 ms of tip-off (baseline 0 for 2.25 s)
  - the stick responds within 1 frame
  - tap → `pump`; hold → meter; swipe L/R/D/U → cross/cross/stepback/spin
  - tap a teammate → pass; PASS hold to the rim → lob
  - §3.8 HUD share
  - 0 page errors
- Practice: the green-room and finish drills still count attempts; a pump fake is not an attempt.

**Screenshots:** tip-off and mid-drive at the 8 sizes, CALL radial open, buttons mode, a first-time hint; each with its
nba-1 twin.

**Protocol:** bump needed (the pump fake and "make him land" change outcomes). **Saves:** the new prefs key only (tested).
**Outside lane:** `PlayReadout.tsx` (an additive prop), `lib/sound.ts` (appended), `Arcade.tsx` (NBA copy), `render.ts`
(`'pump'` pose fallback).
**Dependencies:** shell (insets, Fix D), players (pump pose), nfl (`PlayReadout` prop).

---

### nba-4 · P0 · The shot: touch timestamps, windows and one cap, green rule, meter, feedback, fatigue, Heat, release pop, timing calibrator

Covers NBA-14 (fixes 1–4), NBA-15, research §5.1, §5.2, §5.7, §5.8 (Heat, court-edge glow), §5.10 (release pop) and the
§3.3 targets.

**Must**
- **Touch timestamps.** `clockMap = { real, game, acc, rate }` is updated every rAF.
  - `gameTimeAt(ts) = game + acc + max(0, ts − real)/1000 × rate`, using `e.timeStamp`.
  - It falls back to `performance.now()` when |`e.timeStamp` − `performance.now()`| > 1 s.
  - `pressShoot(p, at)` / `releaseShoot(p, lag, at)`. `lag` = prefs `offsetMs` (default 25 ms; set by the calibrator).
- **Windows per §3.3:**
  - the curve `full(thr) = 20 + 58·clamp((thr−55)/40, 0, 1)` ms, extended to 99 (+0.6 ms/pt) and above (+0.3 ms/pt,
    ≤ 11 pts); refined within the bands by the test
  - contest factors open 1, light 0.75, heavy 0.42, smothered 0.17
  - floors 20 / 8 ms
  - `windowFactor(def)` (§3.2)
  - meter mode ×1.00 / 1.05 / 1.10 through `p.meterBonus` (sims and AI use 1)
  - pull-up ×0.88 and +10 ms
  - fatigue: shift and shrink (§3.3) plus the −5% speed/burst cap below 50%
  - **`windowScale(parts)`, the single combined cap** (×1.45, ≤ 110 ms)
- **Green = make where drawn.** In `shoot()`/`releaseProbability`, open and light greens return 1 and skip the block roll.
  Heavy and smothered never set `greened`; they set `pure: true` for an in-window release and use the lowered caps. The
  off-window fall-off gets steeper. All of it is fitted to §3.3 by `shot-curve.test.ts`.
- **Meter drawing** (in `hud-draw.ts`):
  - R = 0.13 × min(W, H), a true-size slice at `top + shift`, a centre notch
  - amber for heavy/smothered
  - Cue-only flashes at the release point; Off draws nothing
  - the colour follows `contestOf` live
- **Feedback.**
  - `lastShot` gains `green`, `shift`, `cr`, `energy` and `pure`.
  - A pure `missReason(p, shot)` returns `timing | contest | rating | fatigue`, from counterfactual make chances.
  - Post-shot chip (~900 ms, `hud.css`, top band):
    - line 1 is one of seven steps (Very Early … **PURE** … Very Late)
    - line 2 is the coverage ("Wide open · 7.2 ft")
    - line 3, on a miss, is the reason
  - `play-feedback.ts basketballFeedback` gets Timing and "Why it missed" facts (the nba function only).
- **Two-stage Heat** (STREAM P1; display names per §4.2: "HOT HAND" / "LOCKED IN").
  - `HoopsGame.heat: { idx, stage, makesSince }`, optional and in memory.
  - Stage 1 after 2 straight makes: ×1.10 and an ember trail.
  - Stage 2 after 3: ×1.25 and a **court-edge glow**. Heat Check cards reach it at 2.
  - It ends on a miss, a turnover, or after 4 further makes. Stage 2 also refills burst pips; that hook is wired in nba-7
    when pips exist.
  - Both multipliers go through `windowScale`.
- **Release pop** (render only, through `juice.ts`): a one-frame hit-stop on a PURE release, the arc flashing green, and a
  swish particle (reduced motion: the flash only).
  - The engine emits an observation-only `stumble:<idx>` when a big takes a heavy rim contest; players may draw it, and
    until then there is a 2-frame lean in our juice.
- **Timing calibrator, new `TimingCalibrator.tsx`** (10 taps on a beat). It writes `offsetMs` = −mean and shows the
  player's own SD (the owner's σ for §3.3). It opens from the kickoff controls help now, and from the pause menu in nba-9.
  No Settings screen is touched.
- **Practice:** a drill's `green` measure counts `ls.greened || ls.pure` (`Hoops2.tsx:369`), so The Green Room stays
  completable when a drill draws a heavy contest.

**Cut line:** a visible layup-meter arc; the Cue-only mode (Full and Off stay); energy rings under players.

**Tests and measurements**
- `shot-curve.test.ts` (always on, closed-form expectation over the Gaussian, no sampling):
  - windows inside the §3.3 bands for THR 55 / THR_avg / 75 / 85 / 95 × contests × the 4 rungs
  - floors hold
  - **the worst `windowScale` stack ≤ ×1.45 and ≤ 110 ms**
  - an open or light green always makes and is never blocked; heavy/smothered never `greened`
  - the §3.3 make-rate table at σ 50 (asserted) and σ 35 (ceilings)
  - pull-up ≤ 0.90 × catch-and-shoot
  - above 99 finite and ≤ +5 points over 99
- `ratings-matter.test.ts`: the "shot curve" block is replaced by the new targets (documented as intentional); every
  monotonicity test stays green.
- `gameplay.test.ts`:
  - a release between steps gives |off| < 1 ms
  - fatigue shifts +15 ± 2 ms at 60% and shrinks ≤ 15%
  - `missReason` names "contest" for a smothered pure release and "timing" for a 120 ms-late open one
  - Heat stages and endings
- `play-feedback.test.ts`: the seven labels and the reason line.
- `calibrator.test.ts`: the offset and SD from synthetic taps.
- Human harness (σ 50): open-jumper green rate 30–50%; green kick-out makes = 100% of greens drawn.
- `nba-meter.cjs`:
  - slice ≥ 8 px for THR-75 open at 390
  - amber in heavy range
  - the chip sequence after a scripted release
  - the release pop seen with `no-preference`, absent with `reduce`

**Screenshots:** meter open / light / heavy (amber) / tired (shifted and shrunk), the PURE chip, a "Contest" miss chip,
Hot Hand trail, Locked In glow, the calibrator.

**Protocol:** bump needed (window sizes and positions, green rule, caps, fall-off, fatigue, heat stages, pull-up).
**Saves:** prefs `meter` / `offsetMs` only.
**Outside lane:** `play-feedback.ts` (the nba function), `juice.ts` (nba usage only).
**Dependencies:** players (stumble pose, optional; per-player release speed is deferred, §9).

---

### nba-5 · P0 · Every point and every miss: fouls, free throws, turnovers, real misses, rebounding AI, BOARD, practice rules

Covers:
- NBA-01 (fouls, FT, and-ones), NBA-04, NBA-11
- NBA-24 (miss endpoints), §11 #13 (pass lead)
- audit §5 AI rebounding (perfect information, no box-outs)
- STREAM "BOARD timing", research §5.5 steals and §5.6
- box data to hosts, and practice-mode regressions

**Must**
- **Era stub, new `hoops2/era.ts`.** `eraStyle(five)` returns neutral factors (`foul`, `tov`, `orb`, `threeAppetite`,
  `pace`, all 1) until nba-8 fills it. This removes the forward dependency.
- **Fouls.**
  - `foulChance(kind, contest, shooter, defender, defIQ, era.foul)`, arithmetic only: contested drives/finishes 12–18%,
    heavy jumpers 2–3%, threes ~1%.
  - It rises with STR and a new optional `Hooper.fd` (from FTA per 36 in `hooper()`), and falls with defensive discipline
    `(prd+ind)/2` and `defIQ`.
  - A foul on a make is an and-one (2+1 or 3+1); on a miss, 2 or 3 free throws.
- **Free-throw trips.**
  - `Possession.ft?: { shooter, total, made, taken, and1 }`, with dead-ball placement and the clock stopped.
  - `shootFreeThrow(p, off)` for the user; `autoFreeThrow(p)` = `p.rand() < freeThrow(rating)` for the AI, sims and skip.
  - A missed last FT goes to the defense (~15% ORB on FT misses is simplified away; documented).
  - **Online, the trip auto-shoots after 4 s idle**, so a phone sitting on the FT prompt never trips `STALL_MS`/`GONE_MS`.
    Offline it waits.
- **FT meter** (`hud-draw.ts` + the §5 FT context):
  - A vertical bar with a fixed band; hold to raise the marker (0.6 s to the top) and release in the band.
  - The band's half-width is set by FT rating, so σ 50 lands within ±6 points of `freeThrow(rating)`.
  - A calm bonus (no contest), −10% when tired. Skippable.
- **Team fouls and the bonus.** `HoopsGame.fouls` per half per side; from the 3rd team foul, non-shooting fouls give 2 FTs.
  The defenders' reach roll resolves to steal / **reach-in foul** / nothing.
- **Marks** (§6.7):
  - `'4'` (3+1) and `'F0'…'F3'` (made FTs of a trip)
  - `MARK_POINTS` and the strip text; `markPoints()` and `NBA_MARK_LABEL` exported
  - Consumers: `Arcade.tsx POINTS` (nba branch), `ut/Match.tsx` (one line) and `ut/match-debrief.ts`
- **Turnovers.**
  - Reach-in steals ×0.4 when the handler separates > 4 ft/s, and ×0.2 from behind.
  - **Directional** steals (the ball side).
  - A failed poke stuns the handler 0.25 s.
  - **Pass lead** uses the receiver's intended path and a 3.6 ft reach, so "PASS OUT OF REACH" no longer happens to a
    teammate changing direction.
- **Real misses (NBA-24).**
  - The same uniform that decided the miss chooses front rim / back rim / glass / airball. Airball only for heavy+
    contests or |off| > 150 ms.
  - Carom length: threes 6–14 ft, rim attempts 3–8 ft.
  - The `rim`, `glass` and `airball` events play `sfx.rim`, the backboard sample and an "ooh".
- **Rebounding AI (audit §5).**
  - Today every defender runs to the exact landing spot the moment a miss is decided (`engine.ts:1284`), and the user's
    assist gets it too (988-989).
  - Now each player reads a **landing estimate**: the true endpoint + seeded noise ∝ remaining flight time × (1 − rebIQ),
    which converges as the ball drops. The user's assist uses the same estimate.
  - **Box-outs:** the two players nearest the rim on each side seal their man (body between man and rim) for the first
    0.4 s before releasing to the ball.
- **BOARD timing.**
  - On a miss, the controlled player shows a ring that fills toward the ideal jump moment: the ball dropping through his
    max reach minus his time to peak.
  - A jump in the 120 ms before it is a **green board**: +25% reach-race radius, plus a green flash.
  - Ratings, height and position still decide. AI rebounders time with skill noise.
  - Offense end now; the defense end comes free in nba-6 (same code, "your nearest man").
- **Box data to hosts.** `HoopsGame.box` via `BoxTracker`; `onBoxScore(box)` from Hoops2 and Arcade (§6.2). Stripped from
  the wire.
- **Practice rules** (`practice` prop): no fouls or FT trips (a fouled drill attempt counts as a make if it went in, else a
  miss), no box-outs requirement, no pip limit later.
- `game.ts`: delete `void shooter` (NBA-11).

**Cut line:** offensive fouls (charges); out-of-bounds turnovers; the "ooh" sample.

**Tests and measurements**
- `fouls.test.ts`:
  - `foulChance` bands by situation; monotone in STR/`fd` (up) and discipline/`defIQ` (down)
  - the bonus at the 3rd team foul; marks map to points
  - a FT trip never changes ratings
  - online auto-shoot after 4 s; airballs only under the stated conditions
- `rebound.test.ts`:
  - the AI estimate error shrinks as the ball falls
  - box-outs put the sealer between his man and the rim for ≥ 0.3 s in ≥ 70% of misses
  - a green board raises the reach radius by 25% and nothing else
  - the assist no longer reads the exact endpoint
- `gameplay.test.ts`: a direction-changing receiver catches a led pass; the steal direction rule.
- Calibration report (15 games/config, report only):
  - FTA/FGA, FT% and and-ones per 16
  - TOV% at Rookie/Pro/All-Star/Legend
  - steals as a share of turnovers (50–65%), PF and STL per 16
  - "PASS OUT OF REACH" < 1% of passes
  - ORB% and three misses landing ≥ 10 ft
- Human harness: straight-drive strips Pro ≤ 7%, Legend ≤ 10%; FT meter at σ 50 within ±6 points; BOARD with σ 50 board
  timing adds +3 to +6 ORB% points over not jumping.
- `ratings-matter.test.ts` adds: FT 90 vs 75 scores more; `fd` 90 draws more fouls; REB still matters with box-outs.
- `moments.test.ts` (opt-in): the green-room and finish drills unchanged within ±5 points of baseline; 0 FT trips.

**Screenshots:** FT line-up and meter (portrait and landscape), the 3+1 banner, a front-rim miss and a glass miss, a box-out,
the BOARD ring and a green board.

**Protocol:** bump needed (fouls, FT, new marks on the wire, turnovers, miss endpoints, rebounding AI, board timing).
**Saves:** marks aren't saved (`ends` feed only the result screen and debrief).
**Outside lane:** `Arcade.tsx` (POINTS, nba branch), `ut/Match.tsx` (one line), `ut/match-debrief.ts`.
**Dependencies:** ut (labels, box consumer), players (FT routine pose; falls back to idle).

---

### nba-6 · P0 (owner decisions 2 and 3) · Defense played by default: alternate format, Auto-defend, per-possession SIM, the rival's real score, solo overtime, RUN

Covers:
- NBA-07 (format), STREAM "rival score from those possessions", "Auto-defend and SIM", "Online keeps the race"
- game length v1, the team RUN, NBA-06 on every solo path
- the defensive camera (live), a minimal defensive feedback line, the AI fallback format, and engine options for UT modes

**Must**
- **`game.ts` `newHoopsMatch(us, them, usBench, themBench, seed, { possessions = 16, clock = 14, startersOnly = false, defIQ, aiSkill })`.**
  - It returns `{ us, them }` with linked arrays: one five's energy and subs serve both ends (`them.theirs === us.ours`,
    `them.theirEnergy === us.energy`).
  - Quarters of 4 + 4 and OT of 2 + 2.
  - Seeds `'h2:'` and `'ai:'`; the race's `aiPossessionsOf` RNG order is untouched.
- **`Hoops2.tsx`: prop `format: 'race' | 'alternate'`, `aiSkill`, `onRival(progress)`.**
  - In alternate it runs your possession, then theirs: the autopilot with the rival's cards at `aiSkill`, your five
    defending.
  - The controlled defender `Possession.userD` (body 5–9): `step(p, dt, stick, guard)`. With the stick he slides at
    `topSpeed × lerp(0.82, 0.95, prd)`. With no input, the existing `defend()` logic plays him (**idle-assist**), so idling
    is never worse than today's AI.
  - Hands up are automatic within 4 ft.
  - The score bug shows one chip, "Q2 3/4 · D".
- **Auto-defend** (prefs `autoDefend`, default off; the toggle is on the pre-game screen and, from nba-9, the pause menu):
  defensive possessions play themselves at 3× with a ticker; tap to watch at 1×.
- **SIM** (a 44 px chip at the start of each defensive possession): resolves it instantly through **the same engine path as
  Auto-defend** (idle-assist, headless), so the result is identical by construction.
- **Reward integrity.** In `manualOnly` modes (Circuit, Club Season, Cup), Auto-defend and per-possession SIM keep
  `how: 'played'` when you played your offense. A whole-game SIM stays `'sim'`. Tested and confirmed with ut.
- **`Arcade.tsx` (nba branch, §6.2):**
  - Solo (`!online`, and every AI-rival path including the queue fallback, §6.9) uses `format: 'alternate'`.
  - `shown`/`them` come from `onRival`.
  - Online stays `race`, untouched.
- **Solo ties never go to a rating.**
  - Alternate: tied after 16 + 16 → OT periods (you start odd periods). The cap is 10, and only beyond it does `decide()`
    run (never hit; opt-in `NBA_OT=1` 10k test).
  - Full-game sims use a new `simHoopsMatch(us, them, seed, opts) → { us: Progress; them: Progress }`, exported from
    `Hoops2.tsx` (the module `ut/Match.tsx` already imports). It runs the alternate engine headless with idle-assist
    defense, so a whole-game SIM matches an Auto-defend game. It is used by:
    - **Arcade's kickoff "SIM IT"** (nba branch)
    - **`ut/Match.tsx simBoth`**: the nba line at 895/913 switches to `simHoopsMatch`; nfl's pairs are untouched
  - Both include OT, so `decide()` never sees an NBA tie.
- **RUN** (§3.7):
  - Alternate: three straight scoring possessions by one team without the other scoring in between → "RUN 7-0" (the real
    run points) and ×1.08 for that team's next possession, through `windowScale`. Symmetric for the AI.
  - Online race version: **your own three straight scoring possessions** only, so it never depends on wire timing.
  - In alternate, stage 2 Heat also ends when the rival scores 2 straight possessions (research §5.8).
- **Defensive feedback (minimal):** after each AI possession, the chip shows their shot's coverage ("Open 3 · your man
  7.2 ft away" / "Heavy contest · missed"). nba-7 adds the reasons.
- **Defensive camera live:** `?arcade&def` lab hook (`Lab.tsx`, one line) starts a defensive possession; nba-2's rule is
  measured.
- **Kits per possession** (§6.1) so your team keeps its colours at both ends.
- **Hints:** "Defense: steer your man · or tap AUTO / SIM".

**Cut line:** quarter-break banners; the "watch at 1×" tap during Auto-defend (the ticker stays).

**Tests and measurements**
- `game.test.ts` (always on):
  - linked energy and subs across both ends
  - quarter and OT indices; halftime and Icon "clutch" indices kept
  - in alternate, the rival's score equals the points of the played AI possessions (no precomputed path)
  - 200 forced ties → OT, 0 rating decisions (< 5 s)
  - RUN and Heat-end transitions
  - the race-format `aiPossessionsOf` output is byte-identical to before for 50 seeds (takeover safety)
- `defense-format.test.ts`:
  - idle-assist matches the AI path (≤ 0.5 ft drift over 5 s)
  - SIM ≡ Auto-defend (same marks, same seed)
  - `how: 'played'` with Auto-defend and SIMs in a `manualOnly` match
  - full-game SIM vs Auto-defend game win % within ±5 points (opt-in, 300 games)
- `toHooper-fields.test.ts` (§6.6).
- Human harness (alternate): §3.6 policies (median ≤ Auto − 0.03; poor ≤ Auto + 0.12, as far as the stick-only defense
  allows; re-asserted in nba-10).
- `scripts/audit/nba-alt.cjs` (UT Squad Battles fixture through `nba-lib.mjs`):
  - a full solo game with the median-human script at 1× lasts 4:00–6:00, broken down by §3.4 part
  - Auto-defend and all-SIM lengths reported
  - defensive camera overlap ≤ 35% at ≥ 90% of AI releases, at the 8 sizes
  - your defender never under a control
  - frame budget §3.9 during defense
  - the draft head-to-head vs AI also alternates
  - 0 page errors
- Online regression: `nba-qa-run.mjs scripts/qa/online.mjs` (locked port) — two NBA clients still race and settle one
  win / one loss.

**Screenshots:** a defensive possession in a UT match (portrait, landscape and 320), the Auto-defend ticker, the SIM chip,
the RUN banner, an OT banner, the "their shot" chip.

**Protocol:** bump needed (transition rules arrive in nba-7; here the RUN window factor touches the online race).
**Saves:** prefs `autoDefend` only.
**Outside lane:** `Arcade.tsx` (nba branch), `ut/Match.tsx` (`simBoth` nba line), `Lab.tsx` (one line), `render.ts`
(kit mapping at the call site, §6.1).
**Dependencies:** ut (M13 pre-game screen, result screen reads both sides' box, `how` semantics), nfl (same `onRival`
shape), players (kits).

---

### nba-7 · P1 · The on-ball duel at both ends: SWITCH/STEAL/CONTEST, move tiers and burst pips, drop look, fast breaks, intentional fouls, defensive feedback

Covers:
- NBA-07 controls, STREAM "Moves: three tiers, three pips, cancellable after ~150 ms", "Fast breaks", "defensive looks (drop)"
- NBA-24 velocity ramps, NBA-01 intentional fouls
- research §5.4, §5.5 steals, §5.8 (On Fire refills pips), §5.10 contact reads
- the defensive drill for owner decision 2 (§4.1)

**Must**
- **Defense buttons** (the §5 defense row):
  - `switchDefender(p, to?)`: the defender nearest the ball, or a tapped one.
  - `reachIn(p)` (STEAL): in front of or beside the ball hand within 3 ft, with a chance from STL vs HND and the dribble
    beat (ball low = better). Otherwise a whiff (0.35 s off balance) or a **reach-in foul** (likelier when repeated within
    1 s; feeds the bonus). Cooldown 0.6 s.
  - `jumpContest(p)` (CONTEST, jump on pointerdown): timed to the release from ≤ 4 ft, it grades one tier heavier and adds
    a block chance by BLK, VRT, height and timing. Early, he is landing at the release (make-him-land). Contact on a late
    jump can be a shooting foul.
  - The AI pump-fakes a defender who leaves his feet early.
- **Moves (research §5.4), `engine.ts`:**
  - tiers by HND: 85+ elite (100% travel, defender loses 0.45 s), 60–84 standard (80%, 0.30 s), < 60 basic (60%, 0.15 s,
    higher strip risk)
  - **3 burst pips** per possession, refilled by a pass, a new possession or **stage 2 Heat** (the nba-4 hook)
  - a defender's bump costs a pip (`move:nopip` when empty)
  - **cancel window**: a shoot or pass input ≥ 150 ms after a move starts ends it
  - **velocity ramps** over 3 steps (no one-step change > 0.5 × top speed)
  - Pips show as 1–3 dots on SHOOT (gesture mode) or on each move button (buttons mode).
  - The engine emits `stumble:<idx>` when an elite-tier move beats a defender (contact read; players draw it, with our
    lean as the fallback).
- **Drop look.**
  - `Scheme` adds `'drop'`: the screener's defender stays back near the rim on a pick (pull-up open, roll covered).
  - `schemeFor` weights it by the offense's shooting and handling. `LOOK_TEXT/TIP` gain it.
  - On defense a 44 px **look chip** cycles MAN / SWITCH / DROP before the AI possession. It is tapped during the dead
    ball and costs no time; the default is the AI's choice for your five.
- **Fast breaks.**
  - `newPossession(..., start: 'half' | 'break')`: a break is a 2-on-1 or 3-on-2, with trailing defenders behind the ball
    and the handler at speed near midcourt.
  - Alternate: after your steal → break; after the AI's steal → its break.
  - Race (online and sims): a seeded 8–10% break from the possession seed, identical on both phones.
  - "FAST BREAK" banner.
- **Intentional fouls.** In the last 2 possessions, an AI trailing by 3–6 with the user in the bonus fouls your worst FT
  shooter (§3.7). You can do the same with STEAL. The FT meter plays it out.
- **Defensive feedback.** A pure `defenseReason(p, shot)` names the main cause of a rival score: late jump / early jump /
  your man N ft away / beaten off the dribble / switch mismatch / the look. It shows in the chip and in Last Play's
  `basketballFeedback` (the defensive branch).
- **`practice.drill: 'defend'`** ("get N stops in M AI possessions") for ut's defensive Moment (§4.1).
- **BOARD at the defensive end** (nba-5's code, "your nearest man").
- **Hints** for CONTEST, STEAL, SWITCH, the look chip and pips.

**Cut line:**
- **zone 2-3** look (defenders hold zone spots by ball position)
- early-offense starts after long rebounds (4-on-4, 6–8%)
- the repeat-move ×0.6 decay
- contact-read stumbles

**Tests and measurements**
- `defense.test.ts`:
  - SWITCH picks the defender nearest the ball
  - STEAL: ≈ 15–20% well timed and ≈ 5% untimed for 75 vs 75; foul rate 25–35% when repeated inside 1 s
  - a timed jump from ≤ 4 ft upgrades the contest; ≥ 200 ms early downgrades it
  - drop: the screener's man ≥ 8 ft nearer the rim than the screen
  - intentional fouls fire only in the qualifying state
- `moves.test.ts`:
  - travel 100 / 80 / 60% ± 5% by tier; lost step 0.45 / 0.30 / 0.15 s
  - the 4th move without pips is refused; stage 2 Heat refills them
  - a cancel at ≥ 150 ms stops the move and starts the shot
  - max one-step Δv ≤ 0.5 × top speed
- `transition.test.ts`: race-format break share 8–10% (seeded, identical across two runs); a break starts with defenders
  behind the ball.
- Scripted defender policies over 600 AI possessions (Pro):
  - median ≤ Auto − 0.03
  - poor ≤ Auto + 0.12
  - good contester ≤ idle − 0.05
  - early jumper ≥ idle + 0.05
  - steal spammer: more fouls, PPP ≥ idle
  - versus drop, the AI's pull-up mid share rises
- Human harness: cross-drive with pips ≥ 0.85 PPP; transition PPP 1.15–1.35 (report).
- `nba-def.cjs` (`?arcade&def`) at the 8 sizes:
  - defense buttons ≥ 44 px with no overlap; your defender never under a control
  - the CONTEST tap jumps within 1 frame
  - frame budget during defense
  - 0 page errors

**Screenshots:** the defense HUD (portrait and landscape), a timed block, a reach-in foul, the drop look, a 3-on-2 break,
elite vs basic crossover, pips on SHOOT, the defensive reason chip.

**Protocol:** bump needed (moves, pips, cancel, ramps, fast breaks and drop also play in online races; board timing).
**Saves:** none.
**Outside lane:** `play-feedback.ts` (the nba defensive branch).
**Dependencies:** players (steal reach, contest jump, block vs rebound poses, tiered moves, stumble; all fall back to
existing poses).

---

### nba-8 · P0 · Who shoots and how eras play: shot value, usage, eras, four-rung difficulty, AI playbook, hot/cold zones

Covers NBA-02, NBA-03, NBA-05 (including the 1960s/70s three-point leak), NBA-19 (four rungs, continuous), audit §5 AI
offense (no SPIN, CUT, SPACE or set post-up), and STREAM P1 hot/cold zones. **Mechanisms with local acceptance only. The
§3 bands are asserted once, in nba-10.**

**Must**
- **Shot value (NBA-02).**
  - Mid and close fall toward their targets (`offGreenBase` / `perfectCap`).
  - Rim finishes rise for an average finisher: `0.9^(crowd+spacingHelp)` becomes a lookup table equal to `0.95^n`
    (arithmetic rule), capped.
  - The value order holds: rim > corner three > above-break three > mid (unit test on `shotValue`).
- **Usage (NBA-03).**
  - Optional `Hooper.usg` from real data (FGA estimated from `ppg`, `fg2`, `fg3`, `a3`, `ft`, `fta`; + `0.44·FTA + TOV`,
    per 36), falling back to the points rank.
  - **`usageShares()` lives in a new dependency-free `hoops2/usage.ts`**, so the UT chunk stays ≤ +2 KB.
  - `autopilot.ts` weights touches toward each five's real shares (star 28–35% of FGA, soft cap 36%). The PG enters the
    ball to the star.
  - **Build-up rule:** no heavily contested three before 5 s of clock is used, unless the clock is under 4 s.
- **Eras (NBA-05), `era.ts` filled.**
  - `eraStyle(five)` reads the median `Hooper.yr` and sets:
    - three-point appetite: pre-1980 ×0.05, plus "no three unless the clock is < 3 s or trailing late"; 1980s ×0.35,
      1990s ×0.65, 2000s ×0.75, 2010s ×0.9, 2020s ×1.0
    - pace
    - post-up weight
    - mid-range tolerance
    - a turnover factor and a crash-the-glass factor (for the §3.1b TOV/ORB rows)
    - a defensive foul factor
  - **No displayed rating changes:** pre-1980 `thr` keeps its touch-based estimate (see §11 M4). The 1960s/70s leak is
    closed by behaviour, to 3PA/FGA ≤ .05.
- **Difficulty (NBA-19).**
  - Difficulty changes only the AI's side. `difficulty.ts` gets nfl's `userDefenseIQ(online, level)` (§6.2): offline the
    user defends at the standard level; online `COMPETITIVE_DEFENSE`.
  - `autopilot.ts releaseSd(skill)` becomes the §3.2 table-interpolated curve; decision sharpness also scales with skill.
  - `windowFactor(def)` is continuous.
  - All four UT rungs plus Club Season's adaptive skill and def are covered.
- **AI playbook, new `hoops2/plays.ts`.**
  - Six plays from the existing `screen` / `cut` / `space` primitives: High Pick, Iso Star, Drive and Kick, Post Feed,
    Floppy, Horns. Each is a list of timed teammate actions and starting spots; they never touch ratings or odds.
  - The autopilot calls a play per possession, weighted by the five's archetypes and era.
  - The AI handler uses SPIN, CROSS and STEP by tier and situation.
  - Bigs with post skill get set post-ups. Now that the user picks the defensive look, the AI's plays matter.
  - Card dealing (nba-10) reuses this file, with its own `'cards:'` stream.
- **Hot and cold zones (P1).**
  - Optional `Hooper.zones` from real splits against that season's league average (`LEAGUE_3P` anchors from §4.6,
    interpolated; no 3P zones before 1979-80; the corner gets +2.7).
  - Hot ≥ +3 on ≥ 2 3PA/g, lethal ≥ +6 on ≥ 4, cold ≤ −4. Effect: lethal +5, hot +3, cold −2 points.
  - A small flame or frost mark under the handler, only while he stands in that zone.
- `ratings-matter.test.ts` keeps every monotonicity test and adds:
  - usage follows creation ratings
  - a five's star takes the most shots
  - a hot zone never lowers makes
  - each of the four rungs is harder than the one below

**Cut line:** hot/cold zones as a whole (data, effect and mark ship together or not at all: no hidden modifiers); the
Horns and Floppy plays (four plays stay).

**Tests and measurements**
- `era.test.ts`: `eraStyle` factors by decade, monotone in appetite.
- `usage.test.ts`: shares sum to 1, the soft cap holds, and there are no imports beyond types (a source scan).
- `plays.test.ts`: each play's actors reach their spots within 3 s; plays never change a Hooper or `releaseProbability`
  inputs.
- `difficulty.test.ts` (shared, nba cases): `releaseSd` monotone over [0.42, 0.94] through the anchors ±5 ms;
  `windowFactor` continuous.
- `toHooper-fields.test.ts`: `usg`, `yr`, `fd` and `zones` present on rated UT cards (§6.6).
- **Provisional report** (`NBA_CAL=1`, 60 games/config; report only):
  - era order (3PA by decade, 1960s/70s ≤ .05)
  - concentration rows (usage 25–36%, top scorer ≤ 45%, ≥ 3.5 scorers, PG time ≤ 45%, C slot 3PA ≤ 10%)
  - 0 "heavy three before 5 s with clock > 4"
  - the TOV bands re-measured after the split (the critique's forward dependency)
  - for 90 v 75: 3PA rate ≤ .55, heavy+smothered ≤ 50%, passes ≥ 1.0, seconds per possession ≥ 6
- `balance.test.ts` (opt-in) re-run and reported.

**Screenshots:** a hot-zone flame, a cold frost mark, an AI post-up, an AI spin move.

**Protocol:** bump needed (shot value, AI usage and tempo, era behaviour, difficulty split, zones, AI plays).
**Saves:** new optional `Hooper` fields are derived, never saved.
**Outside lane:** `difficulty.ts` (nfl's helper name, shared), `Arcade.tsx` and `ut/Match.tsx` (pass `userDefenseIQ` in
nba lines).
**Dependencies:** nfl (`difficulty.ts`), packs (`toHooper`, §6.6), ut (`usageShares()` for `league.ts`).

---

### nba-9 · P0 · Match flow and online: pause, quit and forfeit, online overtime (design first), tip-off intro, box score and player of the game

Covers NBA-09, NBA-06 online, NBA-10 (overlay), NBA-30 (attrs skip, intro, clip preload), research §5.12 (×6.2), and
online stall safety. **Order inside the task: (1) the online design note, committed alone; (2) online OT and forfeit with
the two-client matrix; (3) pause and the menu; (4) intro and box overlay.** The online part touches the three-sport
`Arcade.tsx` paths, so it is done first and nothing else in the task touches them.

**Must**
- **(1) Design note** `docs/studio-overhaul/nba-online-ot.md`. It is a pure-function design for the race with OT.
  - `matchState(mine.ends, theirs.ends) → { need, over, winner }`:
    - `need = 16 + 2m`, where m is the smallest number of OT periods after which the scores differ, counting each side's
      points through `need` only.
    - It is computed identically on both phones from the two `ends` arrays.
  - A phone plays while `mine.ends.length < need`, and shows the WaitLine when it is ahead of the rival.
  - The wire's `done` is `ends.length ≥ need && over`, so it is monotonic: `need` only grows while a side is waiting.
  - `rivalLive` (`Arcade.tsx:179`) replaces `wire.done && ends.length >= TOTAL` with `matchState`.
  - **Takeover:**
    - `finishedFrom` (`Arcade.tsx:60`) slices to `need`, not `TOTAL`, and the AI sim continues the same seeded game
      (`aiPossessionsOf(..., 16 + 2·10)` precomputed).
    - The stall and gone timers (`STALL_MS`, `GONE_MS`) key on "mine reached `need`, theirs hasn't", not on `mine.done`.
  - **Forfeit:** the `'FF'` contract (§6.2–6.3).
  - **Limits:** ≤ 37 ends; 10 OT periods, then the old `decide()`; old clients can't meet new ones after the lead's bump.
  - The note lists every changed line in `Arcade.tsx` and is announced in `nba.md` for nfl, whose OT drives follow the
    same shape.
- **(2) Online OT and forfeit**, built from the note.
  - QA-only hooks behind `ns=inspect` on localhost, so the matrix can force cases: an all-miss script to force a tie, and
    stall or forfeit at a chosen possession.
  - `scripts/audit/nba-online.mjs`: two clients on relay 7795 run the §3.12 matrix (20 seeded runs).
- **(3) Pause and quit**, new `PauseMenu.tsx` + `match.css`:
  - A pause button in the score bug (44 px).
  - Offline: stepping stops (`p.t` frozen), and every between-possession timer goes through a `PausableTimers` helper
    (replacing the `setTimeout` chain in `finish()` / `next()`).
  - It auto-pauses on `visibilitychange` / `pagehide`.
  - Menu:
    - Resume
    - Controls help (a §5 diagram)
    - meter mode
    - timing calibrator (nba-4)
    - Auto-defend
    - Sound and Haptics (§6.8: read-modify-write)
    - Quit
  - Online: "Online: the game keeps going" (no freeze) and Forfeit with a confirm.
  - Offline Quit confirms, then calls `onQuit` → a defined loss. Moments and Training pass their existing exit as `onQuit`
    (one line in `Training.tsx`); hosts without it show Resume only.
- **(4) Tip-off and the end.**
  - Hoops2 skips `loadAttrs()` when `five`/`rivalFive` are given; Arcade's nba branch skips it for `teams`.
  - The 700 ms blank timer becomes a 1.5 s skippable intro: both fives with numbers and names, the defensive look, one
    controls reminder.
  - Players' clips are preloaded during it (§6.5). Arcade takes `kickoff={false}` from hosts that already showed a
    pre-game screen (§6.4).
  - Between possessions a tap advances (skips the celebration and replay). Control is never lost after a score.
  - **Final overlay:** a two-tab card, Box score / Player of the game.
    - Columns PTS FG 3P FT REB AST STL BLK TO PF PURE, in an internal scroller with a sticky name column at 320 wide.
    - A "real-game pace ×6.2" toggle.
    - The POG by game score `PTS + 0.4·FGM − 0.7·FGA − 0.4·(FTA−FTM) + 0.7·ORB + 0.3·DRB + STL + 0.7·AST + 0.7·BLK − TOV − 0.4·PF`,
      with his line.
  - `Progress.box` reaches hosts and is stripped before the wire.

**Cut line:** the POG card's "best moment" mini replay; the landscape-specific box layout (it uses the scroller); the
controls diagram (text instead).

**Tests and measurements**
- `arcade-ot.test.ts` (always on, pure):
  - `matchState` on synthetic `ends` pairs: tie → need 18 → 20…
  - `done` monotonic
  - takeover with OT gives the same score on both "phones"
  - `'FF'` ends the match at once and is never inferred from a missing field
  - ≤ 37 ends
- `nba-online.mjs` matrix (§3.12): tie → OT on both; OT + stall; OT + forfeit; OT + 30 s background; 0 mismatches in 20
  seeded runs. Plus the old race regression: one win / one loss.
- `pause.test.ts`:
  - 0 engine steps and 0 timer callbacks in a 10 s pause
  - a paused-and-resumed scripted game ends with identical marks
  - `withSettings` touches only `settings.sound/haptics` and keeps a just-settled UT state
- `nba-match.cjs`:
  - pause freezes the clock text
  - auto-pause on hide
  - quit → loss shown
  - **pre-game §3.10** (≤ 2 taps, ≤ 3.5 s; intro skipped ≤ 0.3 s) on the UT fixture, with the M13/M9 parts reported
    separately until ut and shell merge
  - UT mount without the 1.1 MB attrs load
  - the final card at 320 with no page scroll and text ≥ 10 px

**Screenshots:** the pause menu (393×852, 320×568, landscape), the online forfeit confirm, the OT banner (online, both
phones), the tip-off intro (and its reduced-motion version), the box score at 320 and 393, the POG card.

**Protocol:** bump needed (OT possessions and `'FF'` on the wire; the tie rule; the takeover with OT).
**Saves:** none saved; `Progress` fields optional; the `App.tsx` settings listener is read-modify-write (tested).
**Outside lane:** `Arcade.tsx` (the shared online paths: design-noted, adopting nfl's names), `App.tsx` (settings listener
and forfeit mapping, per §6.3/6.8, coordinated with ut), `ut/Match.tsx` (forfeit → won), `evolution/Training.tsx` (`onQuit`).
**Dependencies:** nfl (the same forfeit/OT shape), ut (forfeit settlement, in-progress marker, tie copy §4.5), shell (M9),
players (clip preload), lead (`arcadeOf` unchanged; the bump).

---

### nba-10 · P0 + P1 · Planning cards (cut first), the single global fit, final QA and handoffs

Covers STREAM "Three play cards before a possession, plus defensive looks", the one asserted calibration (restructure
point 2), the re-measured game length, the final QA, and the handoffs.

**Must (in this order)**
1. **The global fit.** All mechanics are in. The fit turns only named knobs:
   - `offGreenBase`, `perfectCap`
   - the foul base, the steal base
   - the `releaseSd` anchors, `windowFactor`
   - break share, box-out timing
   - era factors

   Iterate at `NBA_CAL_GAMES=15`, then accept with `NBA_CAL=1 NBA_CAL_ASSERT=1` at **150 games/config** for every row in
   §3.1, §3.1b, §3.2, §3.3, §3.5, §3.6 and §3.7, plus the per-player sanity rows. The human harness covers all four rungs.
   `ratings-matter` stays green. `moments.test.ts` gives the §3.11 after-numbers per Moment, with bands for ut. Budget:
   ≤ 6 heavy.sh acceptance runs.
2. **Handoffs written in `nba.md`:**
   - the score scale per 16 (mean and SD, alternate and race) for `ut/league.ts` and `engine/broadcast.ts` (§4.4)
   - the Moments bands
   - the tie copy
   - the `BADGE_LABEL` decision
   - **the post-merge re-check for the lead:** packs re-rates every card (owner decision 5) and makes matches use card
     ratings, so the squads the fit used will shift. The lead runs `NBA_CAL=1 NBA_CAL_GAMES=60` on the integration
     branch, then a 1-hour knob re-fit if any §3.1 row leaves its band.
3. **Final QA:**
   - `npm run typecheck`, the full `npm test` once, and one `npm run build` (4 GB heap); all through heavy.sh
   - every `scripts/audit/nba-*.cjs/mjs` at the 8 sizes, with both reduced-motion modes
   - the shared `scripts/qa/core-gameplay.mjs`, `gameplay.mjs`, `play-feedback.mjs` and `online.mjs` through
     `nba-qa-run.mjs`
   - the online matrix again
   - game length §3.4 re-measured with cards
   - frame budget §3.9 in offense, defense, FT trips and replays
   - bundle §3.9 (game chunk ≤ +15 KB gzip, main +0, UT ≤ +2 KB)
   - test time ≤ +60 s
4. **Docs:** `ARCADE-V2.md` (format, length, defense), `CORE-GAMEPLAY.md` (the §5 controls table, BOARD, FT, defense) and
   `GAMEPLAY-RATINGS.md` (curve numbers, §3.3 model, eras, usage, difficulty), plus the complete `nba.md`: protocol line,
   "Touched outside my lane", owner device checks, "Left undone".

**Cut line (cut first in the whole plan): play and look cards.**
- New `PlayCards.tsx`: chalk diagrams in SVG over the plays from `plays.ts`, three dealt by the five's archetypes
  (`'cards:'` stream).
- Before your possessions: offense cards. Before AI possessions: defensive look cards (Man, Switch, Drop, Zone if it
  shipped, Trap).
- **The first touch on the court picks the highlighted card**, and it auto-picks at 2.5 s (online too: no stall), so cards
  cost ~0 s for players who ignore them.
- Not in practice mode.
- Tests: `cards.test.ts`:
  - picking never changes a Hooper or a shot probability
  - a shooter five sees Floppy ≥ 2× as often over 1,000 deals
  - the deal stream doesn't shift any other RNG order
- Human harness per play: every play 0.90–1.25 PPP, none > 1.30. Length re-measured with cards on.

**Tests and measurements:** as listed in Must; every number goes into `nba.md` next to its nba-1 baseline.

**Screenshots:** offense and defense card picks (393, 320, landscape), and the final contact sheet of every nba screen at
393×852 and 320×568, with the before twins.

**Protocol:** bump needed (fit values; plays move teammates). Final line: "Protocol bump needed: NBA draft 10→11, UT NBA
10→11 because …".
**Saves:** none.
**Outside lane:** none new.
**Dependencies:** lead (integration, the bump, the post-merge re-check).

---

## 9. Deferred (deliberately), with reasons, plus the cut lines

1. **NBA-23 foot sliding, NBA-24 pose cross-fades, NBA-25 30 fps clips, NBA-26 looks.** Owned by players. We expose every
   action as an `Act` or event: `pump`, steal reach, contest jump, FT, floater, stumble, tiered moves.
2. **A button layout editor and stick resize** (research §5.3). Not in the brief; the floating stick plus the
   gestures/buttons option cover reach. Revisit after the owner's device check.
3. **A ticking 12:00 game clock.** The format counts possessions; we show "Q2 3/4".
4. **Shared real-time defense online.** Not possible over relays (brief). Online keeps the race.
5. **"Clutch Stop" card** (research §5.5). Superseded by real solo defense.
6. **Era-aware GameCast totals** (`engine/broadcast.ts`). No owner; the handoff carries the numbers (§4.4).
7. **Club Season AI box scores by usage** (`ut/league.ts`). ut's; we ship `hoops2/usage.ts` and the numbers.
8. **Card-screen surfaces** (category bars, a hot-zone court map, shot-DNA grades; research §5.12). Card UI belongs to
   players and packs; `Hooper.zones` and `usg` are exposed.
9. **Per-player shot DNA timing** (release-speed offsets −40…+30 ms; research §5.1.1). It would move the freshly fitted
   windows; it is a next-round item with players' signature motion (A-4).
10. **NBA-28 soundscape** (announcer, chants, music). No new audio assets. Countdown ticks and rim/glass sounds ship.
11. **NBA-30 chunk split.** `vite.config.ts` is shell's; flagged (§6.10).
12. **Gauntlet and draft season/playoff games played as arcade matches.** Escalated as an owner-decision conflict (§4.1),
    with the engine ready.
13. **A 4-point logo zone and Clutch mode.** Only if ut/lead commit (§4.3).
14. **Rejected research items:** swipe-up dunk and swipe-down floater (replaced by automatic finish choice, §5); 2K-size
    Takeover; a pre-1980 `thr` rating change (§11 M4).
15. **Cut-line items** (shipped only if the task's Must list is green within its session; otherwise listed here in
    `nba.md`):
    - nba-2: typed-array replay snapshots
    - nba-3: the CALL animation and stick resize
    - nba-4: the layup arc, Cue-only mode and energy rings
    - nba-5: charges, out-of-bounds turnovers and the "ooh"
    - nba-6: quarter banners and watch-at-1×
    - nba-7: zone 2-3, early offense, repeat-move decay and stumbles
    - nba-8: hot/cold zones, Horns and Floppy
    - nba-9: the POG replay, the landscape box layout and the controls diagram
    - nba-10: play and look cards

## 10. Risk register (each risk → mitigation → where it is checked)

| Risk | Mitigation | Checked in |
|---|---|---|
| `arcadeOf` strips unknown wire fields, so a forfeit flag never arrives. The rival waits, and the AI may finish the quitter's game as a win. | In-band `'FF'` end mark (≤ 8 chars, in POINTS/owns) per nfl's contract; ≤ 37 ends < the 40 cap. `left`/`gone` stay as the backup. | nba-9 `arcade-ot.test.ts`, matrix |
| `Arcade.tsx` collisions with nfl (solo defense, pause, forfeit, difficulty, box) | Adopt nfl's names (§6.2); nba hunks only inside `pick({ nba })`; sport-agnostic blocks written once; the OT design note shared | nba-6, nba-9 |
| `ut/Match.tsx` collisions (`simBoth` pairs, M3/M13, the `UT_RULES` line, the shared label table) | One-line nba hunks: `simHoopsMatch` in the nba line, `{ ...HOOPS_FOOTBALL_LABEL, ...NBA_MARK_LABEL }`; never the shared table or `UT_RULES` | nba-5, nba-6 |
| `App.tsx`, `lib/sound.ts`, `render.ts draw()`, kits, unowned `Lab.tsx` / `Training.tsx` | §6.1 HUD hook and kit mapping; `vibrateLive` appended away from crowd code; one-line hunks; all listed in `nba.md` | every task |
| Packs' `toHooper` change drops `usg/yr/fd/zones` | Contract §6.6 plus `toHooper-fields.test.ts` | nba-6, nba-8, re-check at integration |
| A stale profile snapshot from the pause-menu settings overwrites a UT match's save | Read-modify-write `withSettings` helper plus a test; the prefs key is outside recovery lists; the cloud-save queue is documented | nba-9 |
| Reward integrity: SIM/Auto-defend in `manualOnly` modes; the Moments green-reward drift | `how: 'played'` test, confirmed with ut; drill `green` counts `pure`; before/after Moment bands to ut | nba-6, nba-4, nba-10 |
| Determinism: new streams shift takeover RNG; JSC vs V8 float differences | Named seed streams (`'ai:'`, `'cards:'`); race `aiPossessionsOf` byte-identical test; arithmetic-only rule for new sim math (source scan) | nba-1, nba-6 |
| Gesture timing: the meter t0 vs tap/swipe recognition; BOARD latency | Provisional gather on pointerdown with free cancel; BOARD and CONTEST on pointerdown (§5) | nba-3 |
| iPhone layout: tight 320 cluster; landscape insets; home indicator; Chromium `env()` = 0; Fix A moves the HUD | Per-width sizes; `--sal/--sar`; bottom `sab + 12` exclusion; injected insets; re-measure after shell's merge | nba-3, nba-10 |
| Small-phone overflow (box score, score bug at 320) | Internal scroller with a sticky name column; one merged bug chip; text ≥ 10 px tests | nba-2, nba-9 |
| Reduced motion was specified only for the clock | The table (nba-2) with a row per element; a `reduce` pass per task | every task |
| QA isolation: `browser.mjs` doesn't route-abort; port 5173; UT fixtures open packs | `nba-qa-run.mjs` preload isolation + `PS_QA_URL`; refuses to run unpatched | nba-1 onward |
| Relay port collisions on 7777 | The team relay on 7795; `flock` around shared `online.mjs` | nba-1, nba-6, nba-9 |
| Performance below 50 fps at 4× | Floor cache (NBA-29) in nba-2; the absolute budget measured in defense, FT and replays too | nba-2, nba-6, nba-10 |
| Bundle: NBA growth loads with football; the UT chunk pulls the engine | `usage.ts` dependency-free; `targets.ts` test-only; chunk split flagged to shell | nba-8, nba-10 |
| Compute: fitting and long Playwright runs compete for 3 slots | 15-game iteration mode; 150-game acceptance only where asked; ≤ 20 min per slot hold | every task |
| Branding: Heat banners and badge names echo 2K/Jam | `BADGE_LABEL` and Heat stage names (§4.2) by default; lead decision for card-side names | nba-2, nba-4 |
| Windows stack until greens are trivial | `windowScale` ×1.45 / 110 ms cap; worst-stack test | nba-4 |
| Defense by default backfires ("auto beats manual") | Idle-assist; median ≤ Auto − 0.03; poor ≤ Auto + 0.12; SIM ≡ Auto | nba-6, nba-7, nba-10 |
| Tiny windows online (THR-55 at Legend) | 20 ms open floor at every difficulty; the live shot % warns before the shot | nba-4 |
| WebKit can't be tested headless | Owner device checks (§12) cover release feel, `timeStamp` clock sanity (calibrator readout), pointer capture, NFD, haptics, pause on a call | nba-10 |

## 11. Critique response index

M = missing, R = restructure, K = risk, T = target. "→" gives where it is handled.

| ID | Point | Response |
|---|---|---|
| M1 | Owner decision 2 conflict (Moments, Gauntlet, season/playoffs) | → §4.1 escalation with options; `practice.drill: 'defend'` in nba-7; format available to any host (nba-6) |
| M2 | NBA-06 tie paths (`simBoth`, SIM IT, `finishedFrom`) and the tie copy | → nba-6 `simHoopsMatch` for `simBoth` and SIM IT; nba-9 `finishedFrom`/`rivalLive`; copy handoff §4.5 |
| M3 | Practice-mode regressions (Training, Moments, green-room) | → nba-4 (`green` counts `pure`), nba-5 (practice rules), §3.11 bands, nba-1/nba-10 Moments harness |
| M4 | Pre-1980 `thr`; era PPP/TOV/ORB | **Rating change rejected:** `thr` is the estimate of "could he shoot it". UT's `thr` comes from packs' `rate.ts` anyway, and packs is re-rating everything with documentation (owner decision 5); a second, nba-side displayed change would conflict. The 3PA leak is closed by behaviour (≤ .05, nba-8). Era PPP/TOV/ORB rows → §3.1b. |
| M5 | Audit §5 AI: box-outs, perfect-information rebounding, no SPIN/CUT/SPACE/post-up | → nba-5 (landing estimate, box-outs, assist parity); nba-8 (AI playbook, moves, post-ups) |
| M6 | Camera design on defense | → nba-2 rule (offset away from your defender, pitch, focus mix); measured live in nba-6 (§3.6) |
| M7 | SHOOT context table | → §5, tested in nba-3 |
| M8 | Research §5.1.6 per-contest targets; THR_avg undefined | → §3.3 (bands asserted at σ 50; σ 35 ceilings; THR_avg measured in nba-1; pull-up ≤ 0.90; documented divergence with the math) |
| M9 | Fatigue shrink; On Fire pip refill and glow | → nba-4 (shrink ≤ 15%, glow); nba-7 (refill hook) |
| M10 | Release pop; contact-read events | → nba-4 (hit-stop, green arc, swish, big's stumble event); nba-7 (elite-move stumble) |
| M11 | NBA-27 iOS haptics | → §3.13, nba-3 |
| M12 | NBA-14 fix 4 calibrator | → nba-4 `TimingCalibrator` (offset and SD); in the pause menu in nba-9 |
| M13 | First-time teaching | → nba-3 `hints.ts`; every task registers its lines |
| M14 | Defensive feedback | → nba-6 (coverage line), nba-7 (`defenseReason`, Last Play) |
| M15 | Online stalls on prompts | → FT auto-shoot 4 s online (nba-5); cards auto-pick 2.5 s (nba-10); no defensive picks online |
| M16 | RUN online | → race version counts your own possessions only (nba-6) |
| M17 | Score-scale handoffs | → §4.4; numbers in nba-10 |
| M18 | UT mode ideas unowned | → §4.3 escalation; engine options in nba-6; 4-point zone conditional |
| M19 | Badge names in the in-game pop | → §4.2 `BADGE_LABEL` default plus a lead decision |
| M20 | Box ×6.2; per-player sanity rows | → nba-9 (×6.2 toggle); §3.1 sanity rows asserted in nba-10 |
| M21 | Four UT rungs; continuous `releaseSd` | → §3.2; nba-8 |
| M22 | Area docs updates | → §2 Docs; each task; nba-10 final pass |
| M23 | Tests outside hoops2 | → §2 standard set (match-debrief, content, difficulty, sport-branches; balance opt-in) |
| M24 | AI fallback after the queue | → §6.9; nba-6 |
| M25 | Duplicate surnames | → nba-2 `uniqueTags`; §3.8 |
| M26 | NBA-30 clip preload during the intro | → §6.5; nba-9 |
| M27 | 430×932 and 932×430 | → §3.8 eight sizes |
| R1 | Minimal alternate right after nba-5 | → nba-6 |
| R2 | Calibrate after mechanics; post-merge re-check | → nba-8 local only; nba-10 single asserted fit; lead re-check recipe |
| R3 | Split oversized tasks | **Partly accepted.** The cap is 10 tasks, so we rebalanced instead: misses and the glass → nba-5; Heat stays with the window code; moves → nba-7; eras/usage separated from the fit; pause → nba-9; final QA with the fit. Every task has Must and Cut lines (§9.15). |
| R4 | Online OT/forfeit as a separate task with a written design | **Partly accepted:** it is nba-9's first two deliverables, with the design note committed alone before code and its own matrix. Pause/quit/intro/box share the task because they trigger forfeit and live in the same files, and the 10-task cap holds. |
| R5 | Forward dependency (`eraFoul`, TOV before the split) | → era stub in nba-5; TOV re-measured in nba-8; asserted in nba-10 |
| R6 | Game length after cards | → §3.4 budget; first touch picks; re-measured in nba-10 |
| R7 | Combined window cap | → `windowScale` (nba-4) with a worst-stack test |
| R8 | Day-one contracts (`render.ts` hook, `Arcade.tsx` with nfl, pre-game sequence) | → §6.1, §6.2, §6.4, written in nba-1 |
| R9 | Inject insets until shell's Fix D | → `nba-lib.mjs` (§2, §3.8) |
| R10 | Test budget: heavy tests opt-in | → §2 (≤ 60 s; the 10k OT and 200-game box are opt-in) |
| R11 | Forfeit via `left`/`gone`, not a new wire flag; agree loss vs AI-finish | **Partly accepted:** no new wire field. We use nfl's in-band `'FF'` because `left` alone starts an AI takeover (the quitter could win). `left`/`gone` stay as the backup. An online quit is an instant loss (§4.6, §6.3). |
| R12 | Cut circle = spin; settle the swipe overloads | → §5 |
| K1–K21 | Risks | → §10 (one row each) |
| T1 | Game length budget | → §3.4 |
| T2 | Variance and squad strength | → §3.5 |
| T3 | Defense rewards playing | → §3.6 |
| T4 | Defensive camera | → §3.6 |
| T5 | STL/BLK/PF; C slot; 1960s/70s | → §3.1, §3.1b |
| T6 | Era PPP/TOV/ORB | → §3.1b |
| T7 | Combined cap | → §3.3 |
| T8 | Contest-tier 3P% | **Modified:** asserted at σ 50; σ 35 as ceilings (§3.3, math shown) |
| T9 | Heat/RUN pacing and intentional fouls | → §3.7 |
| T10 | Gestures | → §3.8 |
| T11 | HUD share | **Modified:** the critique's portrait numbers can't all hold (453/852 = 53%), so bottom controls ≤ sab + 190; court ≥ 55% at sat 59, ≥ 52% once Fix A makes it 81 (§3.8) |
| T12 | Absolute frame budget | → §3.9 |
| T13 | Bundle | → §3.9 |
| T14 | Test time | → §2, §3.9 |
| T15 | Pre-game flow | → §3.10, §6.4 |
| T16 | Pause | → §3.10 |
| T17 | Readable text | → §3.8 |
| T18 | Name tags | → §3.8 |
| T19 | Moments and drills | → §3.11 |
| T20 | Calibration hygiene (scale, SE) | → §3 preamble (rawOvr; 150 games; bands ≥ ±2 SE) |
| T21 | iOS haptics | → §3.13 |
| T22 | Online OT/forfeit matrix | → §3.12, nba-9 |

## 12. Owner device checks (filled in `nba.md` as tasks land)

- **Controls:**
  - thumb reach of the stick, SHOOT gestures and CALL on the owner's iPhone, portrait and landscape
  - pointer capture with two thumbs
- **Timing:**
  - the timing calibrator's offset and **the owner's own release SD** (if it is under 40 ms, the §3.3 bands are revisited)
  - whether the green window feels fair for an average shooter
  - `e.timeStamp` vs `performance.now()` sanity (the calibrator's debug line)
- **Feel:**
  - haptic distinctness: green 2 ticks vs make 1 tick
  - the FT meter
  - defense controls (stick, CONTEST, STEAL, SWITCH), Auto-defend and SIM
- **Flow:**
  - solo game length
  - the tip-off intro
  - pause on a real phone call or app switch
- **Display:** accented names (NFD fold on WebKit).
