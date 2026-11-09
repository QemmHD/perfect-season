# Team nba: build plan (studio overhaul, 2026-11-09)

Worktree `/home/user/ps-s-nba`, branch `claude/studio-nba`, dev-server port **5215**.
`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

Sources read in full for this plan: `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-nba.md`, `O/audit-nba.md`
(NBA-01 … NBA-30, §4, §5, §11, §12, §13), `O/research-basketball.md` (all sections), `CLAUDE.md`, `docs/ARCADE-V2.md`,
`docs/CORE-GAMEPLAY.md`, `docs/GAMEPLAY-RATINGS.md`, `docs/GAMEPLAY-RESEARCH.md`, every file in `src/game/hoops2/`
(engine, game, autopilot, ratings, badges, render, Hoops2, types, all tests), `src/game/Arcade.tsx`, `src/game/difficulty.ts`,
`src/game/play-feedback.ts`, `src/game/progress.ts`, the hosts that mount the game (`src/ut/Match.tsx`, `src/App.tsx`,
`src/ut/Moments.tsx`, `src/evolution/Training.tsx`, `src/game/Lab.tsx`), the mark consumers (`src/ut/match-debrief.ts`,
`src/ut/Match.tsx` label tables), `src/ut/play.ts decide()`, `src/ut/league.ts box()`, `src/lib/sound.ts` (haptics), and the
audit harnesses in `O/audit-scripts/` (`nba-box`, `nba-curve`, `nba-anim`, `nba-conc`, `nba-*.cjs`, `utui/lib.mjs`).
The team doc for results is `docs/studio-overhaul/nba.md` (created in nba-1).

---

## 1. Goals

1. **It plays like basketball.** Solo matches alternate offense and defense; the rival's score comes from possessions you
   defend; ties go to overtime; there are fouls, free throws, fast breaks, runs and a box score with a player of the game.
2. **Stats feel legit.** An even Pro game lands on the research's per-16-possession targets for 2024-25 (table in §3), with
   the right shot-zone mix, a star's share for stars, eras that play in the right order, and a real difficulty ladder.
3. **Touch controls are built for thumbs.** Nothing sits on top of the ball handler; the stick never ignores a thumb; the
   shot release is measured from the touch, the green is drawn at its true size and a PURE release is clearly good.
4. **Readable and fair.** The clock never freezes, banners stay off the rim, labels never stack, names print with their
   accents, and every miss explains itself (timing, contest, rating or fatigue).
5. **Keep what works (audit §12).** The deterministic fixed-step engine, physical rebounds and catches, the recorded jump
   shot timed to the meter, the rating tests, landscape and safe areas, the render-only juice layer, input hygiene,
   `rescue()`, and the ~2 ms frame budget.

## 2. Hard rules that shape every task

- **Saves:** no profile, storage key, card/edition/copy id or saved-field meaning changes. Everything new is in-memory
  (`Hooper`, `HoopsGame`, `Possession`, `Progress` gain *optional* fields) or a new per-device preference key
  `perfect-season:hoops-prefs:v1` (read with try/catch, defaults when missing or corrupt, never part of the cloud save).
- **Protocol:** we never edit `DRAFT_RULES` (`src/net/match.ts:21`) or `UT_RULES` (`src/ut/Match.tsx:110`). Every task that
  changes how an NBA match plays or comes out adds its reason to one running line in `nba.md`:
  **"Protocol bump needed: NBA draft 10→11, UT NBA 10→11 because …"**. NFL and soccer are not changed by this team.
- **Determinism:** the engine stays seeded (`p.rand`, `pl.rand`). No `Math.random()`/`Date.now()` in `engine.ts`, `game.ts`,
  `autopilot.ts`. Touch timestamps only feed *your own* offense's release offset (each phone plays its own offense), never
  a shared roll. `juice.test.ts` and the new `determinism.test.ts` stay green after every task.
- **Branching:** `pick({ nba, nfl, soccer })` only, never a two-way sport ternary; run `src/engine/sport-branches.test.ts`
  whenever `Arcade.tsx` or `difficulty.ts` is touched.
- **Layout:** 390 design-px frame, no width media queries in new CSS, taps ≥ 44 design px, text ≥ 10 design px, reduced
  motion respected, SVG for symbols. New CSS goes in **new nba-owned files** imported from hoops2 components:
  `src/game/hoops2/hud.css`, `src/game/hoops2/controls.css`, `src/game/hoops2/match.css`. Football reuses `.hg2-*`
  classes, so every new rule is scoped `.hg2:not(.fb2)`.
- **Shared files** (`Arcade.tsx`, `difficulty.ts`, `ut/Match.tsx`, `App.tsx`, `PlayReadout.tsx`, `play-feedback.ts`,
  `play-readout.css`, `render.ts` player sections): small local hunks only, never reformatted, each listed under
  "Touched outside my lane" in `nba.md`.
- **QA isolation:** browser QA uses `?ns=inspect&relay=ws://localhost:7777`, Playwright contexts `route('**/*')` and abort
  every host that is not localhost/127.0.0.1 (fonts.googleapis.com and fonts.gstatic.com allowed). Copy the harness from
  `O/audit-scripts/utui/lib.mjs`. Heavy commands go through `bash O/heavy.sh …`. Dev server:
  `nohup npx vite --port 5215 --strictPort > /tmp/ps-nba-vite.log 2>&1 & echo $! > /tmp/ps-nba-vite.pid`, stop with
  `kill $(cat /tmp/ps-nba-vite.pid)`. Never `pkill -f`/`pgrep -f`.
- **Tests while working:** `bash O/heavy.sh npx vitest run src/game/hoops2 src/game/juice.test.ts src/game/play-feedback.test.ts`.
  The full `npm test` and the single `npm run build` run only in nba-10 (final QA).
- **Commits:** one per task, explicit paths only, message `Claude: …` with the two trailer lines from BUILD-RULES, then
  `git push -u origin claude/studio-nba` (retry 2/4/8/16 s on network errors).

## 3. Targets (the numbers the tasks prove)

### 3.1 Per 16 possessions, one side, even Pro game (AI vs AI, UT themed squads ~78, Pro skill, Pro defense)

From the research's B-R per-100 table for 2024-25 (§4.7) and the §5.14 calibration table. Tolerances are ours.

| Stat | Real (per 16) | Accept | Audit baseline (even 78 Pro) |
|---|---|---|---|
| Points (PPP) | 18.3 (1.145) | 17.3–18.9 (1.08–1.18) | 20.5 (1.28) |
| FGA | 14.4 | 13.4–15.4 | not reported |
| 3PA (3PA/FGA) | 6.0 (.42) | 5.0–7.0 (.35–.45) | (.327) |
| FTA (FTA/FGA) | 3.5 (.24) | 2.8–4.2 (.18–.28) | (.019) |
| Turnovers (TOV%) | 2.3 (12.6%) | 1.8–2.6 (11–15%) | 1.06 (6.6%) |
| Offensive rebounds (ORB%) | 1.8 (25%) | 1.4–2.3 (22–29%) | (22.3%) |
| Assists (AST/FGM) | 4.3 (63.5%) | 3.5–5.0 (55–68%) | (84%, generous count) |
| FG% / 3P% / eFG | .467 / .360 / .543 | .44–.50 / .33–.39 / .52–.57 | .539 / .431 / .610 |
| Rim FG% (layup/dunk family) | 69.6% (0–3 ft) | 62–72% | 58% |
| Mid-range FG% (14 ft to arc) | 40–44% | 38–47% | **65%** |
| FT% | 78% | 74–80% | n/a |
| Shot mix rim / close / mid / three | 23 / 30 / 5 / 42% (B-R zones) | 25–38 / 12–25 / 4–12 / 35–45% | 27 / 14 / 26 / 33% |
| Heavy + smothered share of jumpers | — | ≤ 45% (all configs) | 46% (89% for 90 v 75) |
| Passes per possession | ~3 | ≥ 1.2 (all configs, incl. 90 v 75) | 1.31 (0.37 for 90 v 75) |
| Seconds per possession (14 s clock) | 14.5 of 24 | 6.5–9.5 | 6.2 (2.6 for 90 v 75) |
| Highest-usage card's share of FGA | 28–35% | 25–36% | 15% (highest OVR) |
| Top scorer's share of team points | — | ≤ 45% (game average) | 62% |
| Players who score per game | — | ≥ 3.5 | 2.9 |
| Possession share held by the PG slot | — | ≤ 45% | 74% |
| Transition share / its PPP | 15.7% / 1.22 | 12–17% / 1.15–1.35 | none |
| Ties decided off the floor | 0 | 0 (OT safety cap never hit in 10k sims) | 5–10% |

### 3.2 Difficulty ladder (NBA-19), measured with the "median human" harness (nba-1)

| | Rookie | Pro | Legend | Baseline |
|---|---|---|---|---|
| AI offense PPP vs the user's standard defense | ≤ 1.00 | 1.08–1.18 | ≥ 1.18 | 1.27 / 1.28 / 1.16 (inverted) |
| Median-human offense PPP vs that AI defense | ≥ 1.15 | 1.05–1.20 | 0.90–1.05 | 0.4–0.9 |
| Median human wins | 60–80% | 40–60% | 20–40% | Rookie loses most |
| AI turnover rate | 11–15% | 11–15% | 11–15% | 5.6% / 6.6% / 18% |
| Every simple honest human tactic (drive, cross-drive, three, elbow, kick) on Pro | ≥ 0.80 PPP | | | 0.37–0.62 |
| Step-back exploit on Pro | ≤ 1.30 PPP | | | 1.0–1.2 (vs 0.4–0.6 for the rest) |
| Human straight-drive possessions ending in a strip | Pro ≤ 7%, Legend ≤ 10% | | | 10–25% |
| Autopilot vs median human, same fives, Pro | autopilot PPP ≤ human − 0.05 (research §5.3, "auto must never beat manual") | | | |

### 3.3 Shooting (NBA-14/15, research §5.1)

Full green windows (twice the half-window), Pro, fresh, set shot. Legend ×0.8, Rookie ×1.25 (the AI defense's
difficulty applied to your offense), meter Cue-only ×1.05, meter Off ×1.10.

| | Open | Light | Heavy (amber, no green) | Smothered (amber) | Baseline (open full) |
|---|---|---|---|---|---|
| THR 55 | 15–25 ms | ×0.70 | ×0.42 | ×0.17 | ~13 ms |
| THR 75 | 45–55 ms | ×0.70 | ×0.42 | ×0.17 | 35 ms |
| THR 85 (good shooter) | | | **25–30 ms** | **10–12 ms** | |
| THR 95+ | 70–85 ms (rhythm catch up to ~95) | | | | ~68 ms |
| Floors | open ≥ 12 ms, any contest ≥ 8 ms (the audit's ±3 ms floor goes) | | | | 6 ms |

Proposed curve (the engineer may refine within the bands): `full(thr) = 20 + 58·clamp((thr−55)/40, 0, 1)` ms, extended
down to 12 ms at THR 40 and up +0.6 ms/pt to 99 (+0.3 ms/pt above 99, at most 11 pts).

- **A green is a make.** Open and light contests draw a green slice; a release inside it always scores (no block roll).
  Heavy and smothered contests draw an **amber** sweet spot instead and the label says "PURE TIMING · HEAVY": the best
  result there is the rating-scaled cap (heavy ≈ 38→60%, smothered ≈ 12→25% from THR 60→99, plus the existing block
  chance). The colour follows the live contest every frame, so what you see at release is what you get.
- **The window moves.** Fatigue shifts it later (+15 ms at 60% energy, +25 ms at 40%); a moving or fading pull-up +10 ms.
  It is drawn where it really sits.
- **Expected makes for a human thumb** (σ = 45 ms Gaussian release error, the convention of the existing curve test; also
  reported at σ = 35 ms): open three THR 45/60/75/90/99 → **15/28/45/60/67% (±4–5)**; light THR 75 → 36 ± 4%; heavy
  THR 75/90 → 24/30 ± 4%; smothered THR 75 → 12 ± 4%; open mid THR 75 → 40 ± 4%.
  - *Known divergence:* the research's §5.1.2 window table plus "a green always goes in" makes an elite open shooter
    (THR 90+) shoot ~60–68% with a good thumb, above the research's §5.1.6 48–52%. We keep the brief's windows and the
    green rule, and hold box-level realism through the contest mix, the AI's release spread and the steeper off-green
    fall-off. This is recorded in `nba.md`.
- **Release precision:** a release at exactly `t0 + top` between two 60 Hz steps gives |off| < 1 ms (baseline: up to 16.7 ms).
- **Meter on screen:** radius ≈ 0.13 × min(W, H) (was 0.09); the slice is drawn at true size and position, with a centre
  notch; a THR-75 open green is ≥ 8 px wide at 390 px (baseline ~4 px).

### 3.4 Game format (P1)

- Solo game: 16 possessions each way, alternating, 4 quarters of 4 + 4, OT periods of 2 + 2. Wall-clock length
  **4–6 minutes** at normal speed with replays on (baseline 2–2.5 min of offense only).
- Online head to head stays the simultaneous 16-possession offense race (plus OT periods when tied).

---

## 4. Scope map: every STREAM item → task

| STREAM item | Task |
|---|---|
| NBA-08 shot clock every tick, 5 s warning (flash + tick) | nba-2 |
| NBA-12 thumb on the stick at tip-off | nba-3 |
| NBA-13/17 layout: floating stick 12% dead zone, hold-to-shoot, tap pump fake, swipe moves, tap-to-pass, reachable calls, nothing over the handler, 393×852 / 375×667 / 320×568 portrait + landscape | nba-3 |
| NBA-14/15 touch timestamps, true-size green, research sizes, moving window, 7-step feedback + coverage + miss reason, PURE clearly good, contest design + targets, meter-off +10% | nba-4 |
| NBA-09 pause/quit everywhere, online quit = forfeit with confirm | nba-7 |
| NBA-10 box score + player of the game from real per-player events | nba-1 (tracker), nba-7 (screen) |
| NBA-20/21 defender not hidden, shooter not panned under buttons, de-stack the rim pile, banners off the rim | nba-2 |
| NBA-22 pixel font (Jokić, Dončić, "&") | nba-2 |
| Haptics: make / green / block / turnover | nba-3 |
| Per-16 calibration + era scaling | nba-6 (with nba-5 for FTA/TOV/ORB) |
| NBA-01 shooting fouls, FT meter by FT rating, and-ones | nba-5; late intentional fouls nba-9 |
| NBA-02 mid ~42%, eFG ~54.7%, real zone mix | nba-6 |
| NBA-03 star usage by real usage; AI not 83% threes / 89% heavy | nba-6 |
| NBA-04 turnovers ~12% everywhere, human drives not brutal | nba-5 |
| NBA-05 eras in the right order | nba-6 |
| NBA-19 difficulty only changes the AI's side; real ladder; simple tactics not far worse | nba-6 |
| NBA-06 ties → OT, never a hidden rating | nba-7 (race), nba-9 (alternate) |
| Prove it: seeded box tests, keep `ratings-matter.test.ts` meaningful | nba-1, nba-5, nba-6 |
| NBA-07 play defense in every solo match: stick, SWITCH, STEAL (can foul), CONTEST/BLOCK, AI teammates, AI offense from autopilot + rival cards | nba-8 (possession), nba-9 (match flow) |
| Rival score from those possessions; Auto-defend toggle; SIM per possession; default is to play | nba-9 |
| Online head to head keeps the offense race; nothing breaks | nba-7, nba-9 (online QA), nba-10 |
| Game length 4–6 min | nba-9 |
| Fast breaks ~15% at 1.2–1.3 PPP | nba-9 |
| Heating Up (2) / On Fire (3) | nba-4 |
| Team RUN banner after 3 straight scores | nba-9 |
| Hot and cold zones per card from real era-adjusted splits, shown subtly | nba-6 |
| Three play cards before a possession; defensive looks (drop, zone) | nba-10 (cards), nba-8 (drop/zone engine) |
| Rebounds: BOARD timing with a green flash | nba-8 (both ends) |
| Moves: 3 tiers by handle, 3 burst pips, cancellable after ~150 ms | nba-10 |
| §12 preserve list | acceptance of every task |
| Owner device checks: thumb reach, green-window feel, defense controls | nba-10 (listed in `nba.md`) |

Audit items outside the STREAM list are mapped too: NBA-11 → nba-5; NBA-16 → nba-2; NBA-18 → nba-3; NBA-24 engine parts
(velocity ramps → nba-10, real miss endpoints → nba-5); NBA-27 → nba-3; NBA-30 (skip `loadAttrs`, tip-off intro) → nba-7;
§11 #13 pass lead → nba-5; §11 #14 pull-up/floater inside 11.5 ft → nba-10; research §5.7 fatigue → nba-4; "no lost
control after a score" → nba-7. The rest is in §6 (deferred).

---

## 5. Tasks (ordered: enabling first, P0 before P1)

### nba-1 · P0 · Measurement harness, baseline and per-player box tracker (enabling)

**Why.** Every later task needs before/after numbers against §3, and NBA-10 needs per-player lines built from the
engine's own events.

**Changes**
- `src/game/hoops2/box.ts` (new): `export interface BoxLine { id: string; name: string; tag: string; pts; fgm; fga; tpm; tpa;
  ftm; fta; orb; drb; ast; stl; blk; tov; pf; pure: number }` (numbers) and `class BoxTracker { constructor(ours: Hooper[],
  theirs: Hooper[]); onStep(p: Possession, handlerBefore: number | null): void; onEnd(p: Possession): void; lines(side):
  BoxLine[]; team(side): BoxLine }`. Keyed by player id (subs keep their own lines). Assist = catch followed by a make within
  2.5 s and ≤ 1 dribble move (tighter than the audit's generous 3.5 s). Pure function of events + possession state, no RNG.
- `src/game/hoops2/engine.ts`: observation-only events where the tracker lacks a source: `drb:<idx>` when a defender
  grabs a miss, `stl:<idx>` / `int:<idx>` naming the defender in `end()` for steals and picks, `fga:<idx>:<kind>:<2|3>` at
  every attempt (release, finish, blocked). Events never change state or RNG order (juice/determinism tests prove it).
- `src/game/hoops2/targets.ts` (new): §3.1–3.3 as data (`{ key, real, lo, hi, source }`), so tests and the report share one
  table.
- `src/game/hoops2/determinism.test.ts` (new, always on, < 20 s): 3 seeded games (autopilot, with and without the juice
  layer, uneven `dt` batches) give identical marks, scores and final `p.t`; a recorded human input script replays to the
  same marks.
- `src/game/hoops2/calibration.test.ts` (new, opt-in `NBA_CAL=1`, games via `NBA_CAL_GAMES`, default 60): ported from
  `O/audit-scripts/nba-box.test.ts` + `nba-conc.test.ts` using `BoxTracker`; configs even 70/78/86 Pro, 78 Rookie, 78
  Legend, 90 v 75, plus the by-decade era run (squads from `aiOpponent()`). Writes JSON to `$NBA_CAL_OUT` (default in the OS
  temp dir; not committed) and prints a table against `targets.ts`; the numbers go into `nba.md`. `NBA_CAL_ASSERT=1` turns the bands into assertions (switched on by nba-6).
- `src/game/hoops2/human.test.ts`: release error becomes Gaussian with `HUMAN_SD` (default 0.045 s; also report 0.035), a new
  **`mixed` "median human" strategy** (jog to a spot; shoot if live % ≥ 45; pass if a teammate's closeout-adjusted catch %
  ≥ 50; drive if the man is ≥ 4 ft off; else one crossover and re-read), and a difficulty sweep (`HUMAN_LEVELS=rookie,pro,
  legend`) that also plays the AI's 16 possessions against the same fives and reports win %.
- `src/game/hoops2/curve.test.ts` (new, opt-in `NBA_CURVE=1`): port of `nba-curve.test.ts` (make % against offset 0–200 ms
  × THR 50–99 × 4 contests × 3 difficulties) into `$NBA_CURVE_OUT` (not committed).
- `scripts/audit/nba-shots.cjs`, `nba-clock.cjs`, `nba-deadstick.cjs`, `nba-perf.cjs`, `nba-final.cjs`, `nba-se.cjs` (copied from
  `O/audit-scripts/`, base URL → `http://localhost:5215/`, paths → this worktree, screenshots → `O/shots/nba/<task>/`,
  localhost-only routing kept).
- `docs/studio-overhaul/nba.md` (new): baseline section with the numbers this task measures, the running protocol line,
  "Touched outside my lane", "Owner device checks", "Left undone".

**Tests and measurements**
- `box.test.ts`: on 200 seeded autopilot games, Σ player PTS = team score, Σ FGM ≤ makes, FGA/3PA/FTA consistent with marks,
  0 mismatches; a hand-built possession (pass → catch → make) credits one assist.
- Baseline run (heavy.sh): calibration at 60 games/config, human harness at 20 games/strategy at Pro and Legend, curve dump,
  Playwright captures at 390×844 and 320×568. Numbers must reproduce the audit within noise (PPP 1.28 ± 0.05, FT rate
  < 0.05, mid FG% > 0.55); any big difference is explained in `nba.md` before nba-2 starts.

**Screenshots:** `O/shots/nba/nba-1/` baseline tip-off, meter, final at 393×852 and 320×568 (re-captured on this worktree).

**Protocol:** none (observation events only). **Save-compat:** none. **Dependencies:** reads `src/ut/pool.ts`,
`ut/battles.ts aiOpponent`, `ut/teams.ts` read-only.

---

### nba-2 · P0 · Readable court: live HUD, camera framing, banners, labels and the pixel font

Covers NBA-08, NBA-20, NBA-21, NBA-22, NBA-16, the NBA-26 "names on markers" note. Render and DOM only.

**Changes**
- **Shot clock (NBA-08)**, `Hoops2.tsx`: a `clockRef` on the `.hg2-bug .mid em` node, written from the rAF loop only when
  `Math.ceil(p.clock)` changes (no per-frame React state). At ≤ 5 s add `.low` (pulse, reduced-motion: colour only), play
  `sfx.tick()` once per second, a haptic at 5 and at 0 (through nba-3's haptics module once it exists; `vibrate()` until
  then). Shot-clock violation shows "0" before the SHOT CLOCK banner.
- **Camera (NBA-20)**, `render.ts` (camera section only) + new `src/game/hoops2/camera.ts` (pure, unit-tested):
  - `follow(cam, target, dt)` with time-based easing `1 − exp(−k·dt)` (replaces the per-frame 0.05–0.12 lerps).
  - Track a blend of handler and ball (70/30) with a 1.5 ft dead zone; **hold the shooter**: from `pressShoot` until the
    ball is 60% of the way to the rim the focus may not move more than 2 ft toward the rim.
  - Lateral offset of 4–6 ft away from the ball side and +0.08 pitch so the on-ball defender separates from the handler by
    parallax (pcam has no yaw; we only move the focus and pitch).
  - Fixed zoom near the rim (no zoom-in pile-ups) except replays.
  - **Responsive anchor:** `renderer.setControlTop(px)` read each resize from the controls' bounding rect (the `.hg2-pad`
    top); the handler is anchored at ~52–55% of the height and always ≥ 8 px above the highest control.
  - A ground ring and a short arrow under the on-ball defender (distance colour = contest colour), drawn after sprites so it
    survives occlusion.
- **Banners (NBA-21)**, `Hoops2.tsx` + new `src/game/hoops2/hud.css` (scoped `.hg2:not(.fb2)`): `.hg2-pop` moves to the top
  band under the score bug and marks (portrait `top: calc(var(--sat) + 96px)`, landscape beside the bug); the defensive look
  chip and the hint merge into one line; nothing DOM-drawn may sit over the rim/paint rectangle.
- **Labels**, new `src/game/hoops2/labels.ts`: `layoutLabels(reqs: {text, x, y, prio, color}[]): placed[]` greedy priority
  placement (meter result > contest grade > handler name > pass-target % > badge pop > call label > defender name), two
  alternate offsets, drops the lowest priority on conflict. `render.ts` collects labels per frame and draws through it.
- **Font (NBA-22)**, `labels.ts` `foldName(s)`: NFD + strip combining marks, plus `ø→O, ł→L, đ→D, ß→SS, æ→AE, œ→OE`;
  `render.ts F35` gains `& / : + ( ) ,` glyphs; `tagOf` (ratings.ts) keeps the full surname up to 14 letters, longer ones end
  with "." (ANTETOKOUNMPO prints whole). Tags keep their accents for DOM text; only canvas drawing folds.
- **Pass-target % (NBA-16)**: the % over the aimed teammate uses `catchValue()` (closeout-adjusted, autopilot.ts) converted to
  a make chance, with a small contest icon; the receiver's and his defender's names show on the target marker.

**Tests and measurements**
- `camera.test.ts`: the same 1 s of input at 30 fps and 60 fps ends within 0.5 px; during a jumper the focus moves ≤ 2 ft
  toward the rim; the anchor keeps the handler's feet ≥ 8 px above a given control top at 320×568 and 393×852.
- `labels.test.ts`: `foldName` maps every character of every name in `src/data/cards-nba.json` (122 non-ASCII names) to an
  F35 glyph — 0 misses; `layoutLabels` returns no overlapping rects on 1,000 random frames.
- `scripts/audit/nba-clock.cjs` (updated): the bug text equals `ceil(p.clock)` (read via a lab debug hook) at 20 Hz over an
  idle possession — 0 mismatches longer than one frame (baseline: "8" for 7.2 s); `.low` seen at ≤ 5 s.
- `scripts/audit/nba-hud.cjs` (new): over an autoplay game at 393×852, 375×667, 320×568 and 852×393: `.hg2-pop` never
  intersects the projected rim box (rim ± 40 px); on-ball defender sprite overlap with the handler's sprite ≤ 35% of its area
  at ≥ 90% of releases (renderer debug hook `__hoopsDebug`); 0 page errors; only localhost requests.
- Frame cost (`nba-perf.cjs`): p50 ≤ 3 ms, p99 ≤ 10 ms at 1× on 390×844 (baseline 2.2 / 8.9); no regression > 15% at 4× CPU.

**Screenshots** (`O/shots/nba/nba-2/`): `393-release-defender.png`, `393-make-banner.png`, `320-rim-pile.png`,
`393-names-jokic-doncic.png`, `852land-release.png`, each with a before twin from nba-1.

**Protocol:** none (render/DOM only; `tagOf` changes text only). **Save-compat:** none.
**Dependencies:** shell owns the score-bug plate and `.arcade-full` safe-area variables (Fix C) — we position inside the bug
only. Players own sprite drawing; the ring/arrow and labels are drawn in our HUD pass.

---

### nba-3 · P0 · Thumb-first controls, pump fake and haptics

Covers NBA-12, NBA-13, NBA-17, NBA-18, NBA-27, STREAM "Haptics", research §5.3.

**Changes**
- New `src/game/hoops2/HoopsControls.tsx` (extracted from `Hoops2.tsx`, which keeps the loop) + `controls.css`:
  - **Floating stick:** spawns where the thumb lands inside the left 45% of the screen, below the HUD band; ghost ring at
    rest; base radius 52 design px (flex: none, round — fixes the 114×128 oval); output rescaled from a **12% dead zone**;
    sprint at 92% (`SPRINT_AT`). Pointer captured always; the direction is kept in `stickRef` through dead balls and applied
    at tip-off (**NBA-12**). A touch that starts on a teammate and lifts in < 200 ms without moving is a pass, not a stick.
  - **SHOOT** 92 px: hold ≥ 120 ms = jumper/auto finish (unchanged); **tap < 120 ms = pump fake**; a swipe off it
    (≥ 36 px within 250 ms) = moves: left/right crossover that way, down step-back, up spin, a circle spin. Moves fire on
    pointerdown-gesture recognition, not on click (**NBA-17**). Held through an inbound it is ignored with a visible
    "LET GO TO SHOOT" state.
  - **PASS** 64 px: tap = pass to the stick-aimed or most open man; **hold and release over the rim = lob** (alley-oop to a
    cutting dunker). Disabled while a rebound race is on (NBA-18).
  - **CALL** button (48 px) above the stick opens a left-thumb radial of SCREEN / CUT / SPACE (each ≥ 44 px), replacing the
    strip at `top: sat + 104px` (~600 px from either thumb). Hidden in rebound races.
  - **Simple controls** option (prefs `controls: 'gestures' | 'buttons'`): CROSS / STEP / SPIN as an arc around SHOOT,
    firing on pointerdown, each with a direction arrow.
  - LAST PLAY toggle moves into the score bug (`PlayReadout` gets an optional controlled `open`/`onToggle` prop — shared
    file, small hunk), so nothing floats over the court's lower-left.
  - Hint copy fixed: "Swipe off SHOOT for moves · tap SHOOT to pump fake" (the old "flick the stick" did nothing).
  - Skill/PASS `disabled` state recomputed from the loop (a `controlsRef` class toggle), not at render (NBA-18).
- New `src/game/hoops2/gestures.ts` (pure): `classify(points[], tDown, tUp) → { kind: 'tap'|'hold'|'swipe'|'circle', dir }`.
- New `src/game/hoops2/prefs.ts`: `loadPrefs()/savePrefs()` for `perfect-season:hoops-prefs:v1`
  `{ v: 1, controls, meter, offsetMs, autoDefend }` with try/catch and defaults (meter/offset/autoDefend used by nba-4/9).
- **Pump fake**, `engine.ts`: `pumpFake(p)`; new `Act` `'pump'` (types.ts); the nearest defender within 6 ft bites (jumps)
  with chance `clamp(0.15 + (70−prd)/120 + (70−ind)/200 − 0.15·defIQ + (shooterRating−70)/150, 0.05, 0.6)` from `p.rand`;
  one fake per 0.8 s. **"Make him land"** (research §5.1.7) in `shoot()`: a closest defender who is descending at the release
  grades one contest tier lighter. `render.ts poseOf` gets a 2-line fallback mapping `'pump'` to an early jump-shot pose
  (players' section — listed outside lane; players may replace it).
- **Haptics**, new `src/game/hoops2/haptics.ts`: `haptic(kind: 'green'|'make'|'dunk'|'block'|'turnover'|'clock')` → Android
  patterns green `[12,30,12]`, make `18`, dunk `[25,40,25]`, block `[30,20,30]`, turnover `60`, clock `8`; on iOS one tick and
  only inside a gesture: pointer handlers call it directly; loop-side events are **dropped** on iOS instead of delayed
  (`src/lib/sound.ts` gets an opt-in `vibrate(pattern, { live: true })` flag, default behaviour unchanged for NFL/soccer —
  outside lane, ~6 lines).
- `Arcade.tsx` NBA kickoff help text (`arc-how`) updated to the new controls (nba branch only).

**Tests and measurements**
- `gestures.test.ts` (tap/hold/swipe/circle thresholds), `prefs.test.ts` (missing, corrupt, old-shape JSON → defaults; never
  touches other keys), `haptics.test.ts` (patterns on a `navigator.vibrate` spy; iOS path drops loop-side requests),
  `gameplay.test.ts` additions (pump fake baits by rating, never fires a shot, a landing defender lightens the contest).
- New `scripts/qa/nba-controls.mjs` (lab `?arcade&sport=nba&ns=inspect&relay=ws://localhost:7777&seed=…`, CDP multi-touch,
  localhost-only) at **393×852 (insets 59/34), 375×667, 320×568 and landscape 852×393, 667×375, 568×320**:
  - every control ≥ 44×44 design px; no two control rects overlap (4 px gap);
  - the handler's sprite rect never intersects a control rect at tip-off and in 30 sampled frames of an autoplay possession;
  - CALL centre within 250 px of the stick centre in portrait (baseline ~600 px);
  - thumb down 300 ms before tip-off and dragged: the handler moves > 1.5 ft within 300 ms of tip-off (baseline 0 for 2.25 s);
  - tap SHOOT → `pump` event, no meter; hold → meter; swipe left/right/down/up → cross/cross/stepback/spin events;
  - tap a teammate → pass; PASS hold to the rim with a cutting dunker → lob;
  - 0 page errors.

**Screenshots** (`O/shots/nba/nba-3/`): tip-off and mid-drive at all six sizes, CALL radial open, simple-controls mode,
before twins from nba-1 (`375x667-01-tipoff`, `320-01-tipoff-hint`).

**Protocol:** Protocol bump needed (pump fake and the make-him-land rule change outcomes). Stick/gesture changes alone would
not. **Save-compat:** new per-device prefs key only (test above).
**Dependencies:** shell (`.arcade-full` insets QA override; we read `--sat/--sab`), players (pump pose), nfl (shared
`PlayReadout.tsx` prop is additive; football keeps its toggle).

---

### nba-4 · P0 · Release timing, the green window, shot feedback and Heat

Covers NBA-14, NBA-15, research §5.1, §5.2, §5.7 and the two-stage Heat (STREAM P1 "Heat", lives in the same window code).

**Changes**
- **Touch timestamps**, `Hoops2.tsx`: a `clockMap = { real, game, acc, rate }` updated every rAF after stepping
  (`rate = timeScale × slow-mo × hit-stop`). `gameTimeAt(ts) = game + acc + max(0, ts − real)/1000 × rate`, with
  `e.timeStamp` (fallback `performance.now()` when it is not on the same clock).
- `engine.ts`: `pressShoot(p, at = p.t)` sets `meter.t0 = at`; `releaseShoot(p, lag = 0, at = p.t)` uses
  `held = at − m.t0 − lag`; `lag` comes from prefs `offsetMs` (default 25 ms; pause-menu slider −40…+40 ms in nba-7).
- **Windows** (`greenWindow`): the §3.3 curve and contest factors (open 1, light 0.70, heavy 0.42, smothered 0.17), floors
  12/8 ms full, difficulty factor `defIQ < 0 ? 1 − 0.5·defIQ : 1 − 0.2·defIQ` (Rookie −0.5 → ×1.25, Pro ×1, Legend 1 → ×0.8), meter mode ×1.00/1.05/1.10 via
  `p.meterBonus` (set by Hoops2 from prefs; sims and AI use 1), rhythm-catch bonus kept (elite ≤ ~95 ms full).
- **Moving window:** `Meter.shift` (seconds): fatigue `+15 ms at 60% energy → +25 ms at 40%`, pull-up/fade `+10 ms`;
  `off = held − (top + shift)`. The autopilot aims at `top + shift`. Fatigue also caps speed/burst −5% below 50% energy
  (`topSpeed`), and an energy ring colours under each of your players (render HUD).
- **Green = make where drawn (NBA-15):** in `shoot()`/`releaseProbability`, open/light greens return 1 and skip the block
  roll; heavy/smothered never set `greened` (they set `pure: true` for an in-window release) and use the lowered caps
  (`perfectCap` heavy `ext(0.38, 0.60, q)`, smothered `ext(0.12, 0.25, q)`); off-window fall-off steeper
  (`offGreenBase` three `0.04→0.30`, mid `+0.03`, close `+0.06`; `touchWidth` `0.010→0.022 s`) — refit to §3.3 by test.
- **Layup meter** made visible (smaller arc, same rules) — today its timing is hidden (audit §4).
- **Meter drawing** (`render.ts drawMeter`): R = 0.13 × min(W,H), true-size slice at `top + shift`, centre notch, amber zone for
  heavy/smothered, a release flash for Cue-only, nothing for Off; colour follows `contestOf` live.
- **Feedback:** `lastShot` gains `green` (window s), `shift`, `cr` (closest defender ft), `energy`, `pure`. New pure
  `missReason(p, shot)` in engine.ts compares counterfactual make chances (perfect timing / open / THR 99 / fresh) and names
  the biggest loss: `timing | contest | rating | fatigue`. Post-shot chip ~900 ms (DOM, hud.css): line 1 seven steps — Very
  Early, Early, A Touch Early, **PURE**, A Touch Late, Late, Very Late (bands: inside window; ≤ 25 ms; ≤ 80 ms; beyond);
  line 2 coverage "Wide open · 7.2 ft" / "Heavy contest"; line 3 on a miss the reason. `play-feedback.ts
  basketballFeedback` gets Timing and "Why it missed" facts (nba function only).
- **Heat (STREAM P1):** `HoopsGame.heat: { idx, stage: 0|1|2, makesSince }` (optional, in memory). Heating Up after 2
  straight makes (×1.10 window, ember trail), On Fire after 3 (×1.25, replaces today's ×1.2; Heat Check cards reach it at 2),
  out on a miss, a turnover or after 4 further makes (Jam rule). Banners "HEATING UP" / "ON FIRE" / "COOLED OFF".

**Tests and measurements**
- New `shot-curve.test.ts`: full windows inside the §3.3 bands for THR 55/75/85/95 × contests × difficulty; floors hold; an
  open or light green always makes and is never blocked; heavy/smothered never report `greened`; expected makes at σ 45 ms
  inside the §3.3 bands (and printed at σ 35 ms); above-99 finite and ≤ +5 points over 99.
- `ratings-matter.test.ts` "shot curve" block replaced by the new targets (documented as an intentional change); every
  monotonicity test stays green.
- `gameplay.test.ts`: a press at t = 1.0083 and release at `t0 + top` between steps gives |off| < 1 ms; fatigue shifts the
  centre by +15 ± 2 ms at 60% energy; `missReason` names "contest" for a smothered pure release and "timing" for a 120 ms-late
  open one.
- `play-feedback.test.ts`: the seven labels and the reason line.
- Human harness (σ 45): green rate on open jumpers 35–60% (baseline 0.3–21%), green kick-out makes = 100% of greens drawn.
- Playwright (`nba-meter.cjs`, new): the slice's pixel width at 390 px for a THR-75 open shot ≥ 8 px; amber when a defender
  is within heavy range; the chip text sequence after a scripted release.

**Screenshots** (`O/shots/nba/nba-4/`): meter open / light / heavy (amber) / tired (shifted), the PURE chip, a miss chip with
"Contest", Cue-only flash, Heating Up and On Fire trails.

**Protocol:** Protocol bump needed (window sizes and positions, green rule, caps, fall-off, fatigue, heat stages).
**Save-compat:** prefs `meter`/`offsetMs` only. **Dependencies:** players may later add per-player release speed (deferred,
§6); nfl shares `play-feedback.ts` (we only touch `basketballFeedback`).

---

### nba-5 · P0 · Fouls, free throws, turnovers and real misses

Covers NBA-01, NBA-04, NBA-11, NBA-24 (miss endpoints), §11 #13 (pass lead), research §5.5 steals and §5.6.

**Changes**
- **Fouls**, `engine.ts`: `foulChance(kind, contest, shooter, defender, defIQ, eraFoul)`: contested drives/finishes 12–18%,
  heavily contested jumpers 2–3%, threes ~1%; up with the shooter's STR and a new optional `Hooper.fd` (foul drawing, from FTA
  per 36 in `ratings.ts hooper()`), down with the defender's discipline (`(prd+ind)/2`) and `defIQ`. Shooting foul on a make
  = and-one (2+1 or **3+1**); on a miss = 2 or 3 free throws.
- **Free-throw trips:** `Possession.ft?: { shooter: number; total: 1|2|3; made: number; taken: number; and1: boolean }`.
  Players line up at FT spots (dead-ball placement), the clock stops, `shootFreeThrow(p, off)` for a person,
  `autoFreeThrow(p)` = `p.rand() < freeThrow(rating)` for the AI, sims and "skip". A missed last free throw is rebounded by the
  defense (simplification, noted in docs; NBA ORB on FT misses is ~15%).
- **FT meter** (`Hoops2.tsx` + `render.ts`): a vertical bar beside the shooter with a fixed target band; hold SHOOT to raise
  the marker (0.6 s to the top), release in the band. Band half-width by FT rating so a σ-45 ms thumb lands within ±6 points
  of `freeThrow(rating)` (FT 60/75/90 ≈ 61/74/86%); calm bonus (no contest), fatigue −10%; skippable (auto-shoot).
- **Team fouls and the bonus:** `HoopsGame.fouls: [half1, half2]` per side; from the 3rd team foul in a half, non-shooting
  fouls give 2 free throws. Reach-ins: the defenders' reach roll in `defend()` now resolves steal / **reach-in foul** / nothing.
- **New marks** (`game.ts`): `'4'` (3+1), `'F0' | 'F1' | 'F2' | 'F3'` (a trip's made free throws); `MARK_POINTS` and the
  Hoops2 strip text updated; `markPoints()` exported for consumers. Consumers updated in small hunks: `Arcade.tsx POINTS` (nba
  branch), `ut/Match.tsx HOOPS_FOOTBALL_LABEL/POINTS`, `ut/match-debrief.ts` allowed nba marks (both outside lane, listed).
- **Turnovers**, `engine.ts`: reach-in steals capped when the handler moves away (× 0.4 when separating > 4 ft/s) and from
  behind (× 0.2); **directional** steals (defender on the ball side); a failed poke stuns the handler 0.25 s (research);
  **offensive fouls**: 10–15% of stonewalled bumps by a handler at speed become a charge (TO); **out of bounds**: a handler
  carried over the sideline/baseline by contact or momentum (walking into the line stops at it, no TO); **pass lead** uses the
  receiver's intended path (home spot or cut target) and a 3.6 ft reach, so a teammate changing direction no longer causes
  "PASS OUT OF REACH".
- **Real misses (NBA-24)**, `shoot()`/`loose()`: the same uniform that decided the miss chooses front rim / back rim / glass /
  airball (airball only for heavy+ contests or |off| > 150 ms); the ball's endpoint and carom length follow (threes longer:
  6–14 ft; rim attempts 3–8 ft); `rim`, `glass`, `airball` events play `sfx.rim`, the existing `backboard` sample, and an
  "ooh". Misses no longer look like makes until the bounce.
- `game.ts`: delete `void shooter` (NBA-11).

**Tests and measurements**
- New `fouls.test.ts`: `foulChance` bands by situation and monotone in STR/`fd` (up) and discipline/`defIQ` (down); bonus starts
  at the 3rd team foul; marks map to points; a FT trip never changes ratings; airballs only under the stated conditions.
- `gameplay.test.ts`: walking into the sideline never ends the possession; a bump over the line does; a direction-changing
  receiver catches a led pass; a charge only from a stonewalled bump at speed.
- Calibration report (60 games/config): FTA/FGA .18–.28, FT% .74–.80, and-ones 0.3–0.8 per 16, TOV 11–15% at Rookie/Pro/Legend
  defense, steals 50–65% of turnovers, charges + out-of-bounds + bad passes 25–40%, shot clock ≤ 10% of turnovers,
  "PASS OUT OF REACH" < 1% of passes, ORB% .22–.29, threes' misses landing ≥ 10 ft from the rim 35–50%.
- Human harness: straight-drive strips Pro ≤ 7%, Legend ≤ 10% (baseline 10–25%); FT meter at σ 45 within ±6 points of rating.
- `ratings-matter.test.ts` gains: FT 90 vs 75 scores more; `fd` 90 draws more fouls; defensive monotonicity still holds.

**Screenshots** (`O/shots/nba/nba-5/`): FT line-up and meter (portrait + landscape), and-one "3+1" banner, a charge, a
front-rim and a glass miss frame.

**Protocol:** Protocol bump needed (fouls, free throws, new possession marks on the wire, turnovers, miss endpoints).
**Save-compat:** marks are not saved (checked: `ends` only feed the result screen and debrief). Old builds never meet new
ones in a queue after the bump. **Dependencies:** ut (debrief/label tables, two small hunks), players (FT routine pose;
falls back to the idle clip).

---

### nba-6 · P0 · Shot value, star usage, eras and the difficulty ladder (per-16 calibration)

Covers NBA-02, NBA-03, NBA-05, NBA-19, the STREAM's per-16 table and era scaling, `ratings-matter` kept meaningful, and the
STREAM P1 hot/cold zones (they share the era data).

**Changes**
- **Shot value (NBA-02)**, `engine.ts`: mid and close fall to their targets through `offGreenBase`/`perfectCap` (mid open
  perfect ≈ 0.9–1.0 points); rim finishes up to 64–68% for an average finisher by softening the crowd/spacing multiplier
  (`0.9^(crowd+spacingHelp)` → `0.95^…`, capped) and the layup base; the value order rim > corner three > above-break three >
  mid holds (unit test on `shotValue` for an average shooter).
- **Usage (NBA-03)**, `ratings.ts hooper()`: optional `Hooper.usg` (0–1 load) from real data: FGA estimated from
  `ppg`, `fg2`, `fg3`, `a3`, `ft`, `fta`, plus `0.44·FTA + TOV`, per 36 minutes; fallback the points rank. Works for draft lines
  and UT cards (both go through `hooper()`). `autopilot.ts`: a usage model weights who gets touches toward each five's real
  shares (star target 28–35% of FGA, soft cap 36%); the AI enters the ball to the star from the PG's bring-up; a **build-up
  rule** — no heavily contested three before 5 s of clock used unless the clock is under 4 s — and sharper skill means better
  shots, not earlier ones. `export usageShares(hoopers)` for other modules.
- **Eras (NBA-05)**: optional `Hooper.yr` (season, from `NbaLine.from`); `eraStyle(five)` from the median year: three-point
  appetite (pre-1980 ×0.1, 1980s ×0.35, 1990s ×0.65, 2000s ×0.75, 2010s ×0.9, 2020s ×1.0), pace (target seconds of clock used:
  older eras faster), post-up weight, mid-range tolerance, and a defensive foul factor (FT rate higher in older eras, per the
  §4.6 table). Behaviour weights only: no card rating changes.
- **Difficulty (NBA-19)**: difficulty changes only the AI's side. `difficulty.ts` gains
  `rivalOffenseFaces(online) = online ? COMPETITIVE_DEFENSE : 0` (the user's team defends at the standard level offline;
  sport-agnostic helper, NFL may reuse). `Arcade.tsx` (nba lines) and `ut/Match.tsx simBoth` (nba lines) pass it for the AI's
  possessions; `defenseDifficulty()` stays for your offense. `autopilot.ts releaseSd(skill)` becomes a difficulty curve
  (start: Rookie 95 ms, Pro 58 ms, Legend 44 ms) plus decision sharpness, fitted to §3.2 with the median-human harness.
- **Hot and cold zones (P1)**, `ratings.ts`: optional `Hooper.zones: { paint, mid, corner, arc }` ∈ {−1 cold, 0, 1 hot, 2 lethal}
  from real splits against that season's league average (new `LEAGUE_3P` anchors from the research §4.6 rows, linearly
  interpolated: 1985-86 .282, 1995-96 .367, 2004-05 .356, 2014-15 .350, 2024-25 .360, 2025-26 .360; held at .282 before 1985-86;
  no three-point zones before 1979-80): hot ≥ +3 pts on ≥ 2 3PA/g, lethal ≥ +6
  on ≥ 4, cold ≤ −4; corner gets the league's +2.7 split; paint from 2P%/rim and position, mid from `mid` vs era. Effect on
  make chance: lethal +5, hot +3, cold −2 points (`releaseProbability`). Shown subtly: a small flame or frost mark under the
  handler only while he stands in that zone.
- `ratings-matter.test.ts`: keep every monotonicity test; add "usage follows creation ratings", "a five's star takes the most
  shots", "a hot zone never lowers makes".
- `calibration.test.ts` turns on `NBA_CAL_ASSERT=1` bands for §3.1 and the era order.
- `usageShares()` is offered to ut for Club Season AI box scores (`ut/league.ts box()` invents rebounds/assists today) — a
  handoff recorded in `nba.md`, not edited by us.

**Tests and measurements**
- `NBA_CAL=1 NBA_CAL_ASSERT=1` (60 games/config, ≥ 7,680 possessions): every §3.1 row inside its band for even 78 Pro; for
  90 v 75: 3PA rate ≤ .55, heavy+smothered jumpers ≤ 50%, passes ≥ 1.0, seconds/possession ≥ 6; concentration rows (usage 25–36%,
  top scorer ≤ 45%, ≥ 3.5 scorers, PG ball share ≤ 45%); zero "heavy three before 5 s with clock > 4".
- Eras: 3PA rate 1980s ≤ .12, 1990s .10–.25, 2000s .15–.28, 2010s .25–.38, 2020s .36–.46, non-decreasing by decade (0.02 slack);
  seconds/possession 1980s < 2000s; FT rate 1980s > 2020s (baseline: 2000s/2010s above 2020s).
- Human harness (`HUMAN=1`, σ 45): §3.2 rows at all three difficulties (win %, PPP, tactics ≥ 0.80, step-back ≤ 1.30, autopilot ≤
  human − 0.05 on Pro).
- `ratings-matter.test.ts` (15+ tests, ~3 min) green; `balance.test.ts` (opt-in) re-run and reported.

**Screenshots:** `O/shots/nba/nba-6/` a hot-zone flame under a shooter, a cold frost mark (393×852).

**Protocol:** Protocol bump needed (shot value, AI usage/tempo, era behaviour, difficulty split, zone make bonuses). The
online setting stays Legend defense on both phones. **Save-compat:** new optional `Hooper` fields are derived, never saved.
**Dependencies:** nfl co-edits `difficulty.ts` (keep the helper sport-agnostic, small hunk); ut for the league box handoff;
packs/players may show `zones`/`usg` on cards later.

---

### nba-7 · P0 · Match flow: pause, quit and forfeit, overtime, box score and player of the game

Covers NBA-09, NBA-10 (screen), NBA-06, NBA-30 (load/intro), research "no lost control after a score".

**Changes**
- **Pause (NBA-09)**, `Hoops2.tsx` + new `src/game/hoops2/PauseMenu.tsx` + `match.css`: a pause button in the score bug (44 px).
  Offline: stops stepping (`p.t` frozen) and all between-possession timers (a small `PausableTimers` helper replaces the
  `setTimeout` chain in `finish()`/`next()`), auto-pauses on `visibilitychange`/`pagehide`. Menu: Resume, Controls help
  (diagram of nba-3's layout), meter mode and timing offset (prefs), Sound and Haptics toggles (call `setFeedback` and dispatch
  `ps:settings`; `App.tsx` gets a ~6-line listener that saves `profile.settings` — outside lane), Quit.
- **Quit / forfeit:** offline Quit asks to confirm, then `onForfeit()`; online the menu has no pause ("Game still running"),
  Forfeit with a confirm. `Progress.forfeit?: true` (additive). `Arcade.tsx` (shared block, sport-agnostic, written so nfl can
  reuse it): a forfeiting side reports `{ ...progress, done: true, forfeit: true }` on the wire; the rival's Arcade reads
  `wire.forfeit === true` and finishes at once. Hosts treat `forfeit` as a defined loss/win: 2–4-line hunks in
  `ut/Match.tsx finish()` and `App.tsx` draft arcade `onFinish` (outside lane; ut owns settlement and its "match in progress"
  marker). Moments/Training pass `onQuit` to Hoops2 (their existing exit); hosts without it show Resume only.
- **Overtime (NBA-06)**, `game.ts`: regulation stays 16 (so halftime and Icon "clutch" possessions keep their indices); OT
  periods of 2 possessions are added after it (`HoopsGame.ot`, OT counts as clutch). Ties never go to a rating:
  - Solo race (until nba-9 switches solo to alternate): the AI's progress is extended deterministically
    (`aiPossessionsOf(..., ot)` continues the same seeded game).
  - Online race: a side that finished period *k* and sees the rival's period *k* level plays period *k+1*; `done` is sent only
    when the result is known, so it stays monotonic; `rivalLive` accepts `TOTAL + 2·ot` marks; takeover finishes OT too.
  - Safety cap: 10 OT periods (never reached in 10k simulated ties); only beyond it does the old `decide()` path run.
- **Box score and player of the game (NBA-10):** `HoopsGame.box` via nba-1's `BoxTracker`; the final overlay becomes a
  two-tab card (Box score / Player of the game) with game score `PTS + 0.4·FGM − 0.7·FGA − 0.4·(FTA−FTM) + 0.7·ORB + 0.3·DRB +
  STL + 0.7·AST + 0.7·BLK − TOV − 0.4·PF`, his line and his best moment; the last pop is cleared under it. `Progress.box?:
  BoxLine[]` is passed to `onFinish` for ut's result screen (M3) and **stripped before the wire** in `Arcade.progress()`.
- **Load and tip-off (NBA-30):** Hoops2 skips `loadAttrs()` when `five` and `rivalFive` are given (UT); Arcade's nba branch
  skips it for `teams`. The fixed 700 ms blank timer becomes a 1.5 s skippable tip-off intro (both fives with numbers and
  names, the defensive look, one controls reminder); portraits arrive later from players.
- **No lost control after a score:** between possessions a tap advances (skips the celebration and a replay); auto-advance
  times stay as they are.

**Tests and measurements**
- `game.test.ts` (new): OT periods appended after regulation keep halftime/clutch indices; a forced tie produces OT; 10,000
  seeded even games → 0 results decided by rating, the cap never hit; box lines sum to the score in every game.
- `Arcade` unit test (`arcade-ot.test.ts`): wire marks beyond 16 are accepted only for OT; `forfeit` ends the match and is
  never inferred from a missing field.
- Playwright `nba-match.cjs` (new, lab + UT fixture via `utui/lib.mjs`): pause freezes `p.t` for 2 s and the clock text;
  auto-pause on a hidden-page event; resume continues; quit → loss shown; tip-off to first playable possession ≤ 1.6 s with the
  intro, ≤ 0.3 s when skipped (baseline 2.3–2.5 s); UT mount to pad without the 1.1 MB attrs load; final card shows box and POG.
- Online: `scripts/qa/online.mjs` (local relay `ws://localhost:7777`, isolated identities) — two clients settle one win/one loss;
  a forced tie plays OT on both; a forfeit gives the other phone the win; old-protocol pairing impossible after the lead's bump.

**Screenshots** (`O/shots/nba/nba-7/`): pause menu (393×852, 320×568, landscape), forfeit confirm (online), OT banner, final box
score and POG card, tip-off intro.

**Protocol:** Protocol bump needed (OT possessions and the forfeit flag on the wire; the tie rule). **Save-compat:** none saved;
`Progress` fields optional. **Dependencies:** ut (result screen consumes `us.box`, forfeit settlement, `App.tsx`/`Match.tsx`
hunks), nfl (same forfeit API in `Arcade.tsx`; whichever lands first, the lead keeps one copy), shell (score-bug plate),
players (tip-off portraits, optional).

---

### nba-8 · P1 · Defensive possessions: your defender, SWITCH / STEAL / CONTEST, new looks and the glass at both ends

Covers NBA-07 (the possession itself), STREAM "defensive looks (drop, zone)", "Rebounds: BOARD timing with a green flash".

**Changes**
- `engine.ts`/`types.ts`: `Possession.userD?: number` (controlled defender, body 5–9), `step(p, dt, stick, guard?: Pt | null)`.
  With a guard stick the controlled defender slides at `topSpeed × lerp(0.82, 0.95, prd)` (sprint at the edge on his burst bar),
  facing the ball; with no stick input the existing `defend()` logic plays him (assist), so idling is never worse than today's AI.
  - `switchDefender(p, to?)`: nearest defender to the ball (or a tapped one).
  - `reachIn(p)`: STEAL. In front/side of the ball hand within 3 ft: chance by STL vs HND and the dribble beat (ball low = better);
    otherwise a whiff (0.35 s off-balance) or a **reach-in foul** (higher when repeated within 1 s, feeds nba-5's bonus).
    Cooldown 0.6 s.
  - `jumpContest(p)`: CONTEST/BLOCK. A jump timed to the shooter's release from ≤ 4 ft grades the contest one tier heavier and
    adds a block chance by BLK, VRT, height and timing; jumping early leaves him landing (make-him-land, nba-3); contact on a
    late jump can be a shooting foul (nba-5).
  - The AI offense pump-fakes a defender who leaves his feet early (uses nba-3's `pumpFake`).
- **Schemes:** `Scheme` adds `'drop'` (the screener's defender stays back near the rim on a pick: pull-up open, roll covered)
  and `'zone'` (2-3: defenders guard zone spots by ball position; weak-side corner opens, paint crowded); `schemeFor` weights
  by the offense's shooting and handling. Hoops2 `LOOK_TEXT/TIP` gain both.
- **BOARD timing (both ends):** on a miss the controlled player (your nearest man, on offense or defense) shows a ring that
  fills toward the ideal jump moment (the ball dropping through his max reach minus his time to peak); jumping in the 120 ms
  before it is a **green board** (+25% reach-race radius); ratings, height and position still decide. AI rebounders time with
  skill noise. Events `board-green`.
- **Hoops2 defense HUD/controls:** right cluster becomes CONTEST (92 px; tap = jump, hold = hands up), STEAL (64), SWITCH (52);
  a teal ring under your defender, the AI shooter's live % shown (so a good contest visibly drops it); "DEFENSE" banner;
  `renderer.setKits()` swaps kits per possession so your team keeps its colours on either side.
- `Lab.tsx` (one-line hunk): `?arcade&def` starts a defensive possession for QA.

**Tests and measurements**
- New `defense.test.ts`: the controlled defender follows the stick; with no input he matches the AI path (≤ 0.5 ft drift over
  5 s vs an AI-only run); SWITCH picks the defender nearest the ball; STEAL success ≈ 15–20% well timed and ≈ 5% untimed for 75
  vs 75, foul rate 25–35% when repeated inside 1 s; a timed jump from ≤ 4 ft upgrades the contest; ≥ 200 ms early downgrades it;
  drop/zone positioning (drop: the screener's man ≥ 8 ft nearer the rim than the screen at the pick; zone: each defender within
  6 ft of his spot with the ball on the perimeter); green board raises the reach radius by 25% and nothing else.
- Scripted user-defender policies over 600 AI possessions (Pro skill): idle-assist PPP within §3.1 (1.08–1.18); good contester ≤
  idle − 0.05; early jumper ≥ idle + 0.05; steal spammer: more fouls and free throws, PPP ≥ idle. Versus zone the AI's 3PA rate
  rises by .05–.12 and its rim share falls ≥ .05; versus drop its pull-up mid share rises.
- BOARD: a human with σ 50 ms board timing gains +3 to +6 ORB% points over not jumping; AI-vs-AI ORB% stays .22–.29.
- Playwright `?arcade&def` at 393×852, 320×568 and 852×393: buttons ≥ 44 px, no overlap, the controlled defender never under a
  control, 0 page errors.

**Screenshots** (`O/shots/nba/nba-8/`): defense HUD portrait/landscape, a timed block, a reach-in foul, zone and drop looks,
the green board ring.

**Protocol:** Protocol bump needed (new AI defensive looks also play in online races; board timing and the AI's timed jumps
change rebounds). **Save-compat:** none. **Dependencies:** players (distinct steal reach, contest jump, block and rebound poses —
today they share one pose; falls back to the existing ones), nba-3/4/5/6 mechanics.

---

### nba-9 · P1 · Solo games alternate offense and defense: the rival's real score, Auto-defend/SIM, length, fast breaks, runs

Covers NBA-07 (format), STREAM "rival score from those possessions", "Auto-defend toggle and SIM", "Online keeps the race",
"Game length 4–6 min", "Fast breaks", "team RUN banner", NBA-01 "late-game intentional fouls", NBA-06 in this format.

**Changes**
- `game.ts`: `newHoopsMatch(us, them, usBench, themBench, seed, { total, defIQ, aiSkill })` returns `{ us: HoopsGame; them:
  HoopsGame }` with linked arrays (the same five's energy and subs serve both ends: `them.theirs === us.ours`,
  `them.theirEnergy === us.energy`), quarters of 4 + 4, OT of 2 + 2, separate seeds (`'h2:'` and `'ai:'`).
- `Hoops2.tsx`: prop `format: 'race' | 'alternate'` and `aiSkill`; in alternate it runs your possession, then theirs (autopilot
  with the rival's cards at `aiSkill`, your five defending through nba-8), and reports `onRival(progress)`. Score bug shows
  "Q2 · 3/4" and an O/D indicator.
- `Arcade.tsx` (nba branch): solo (`!online`) uses `format: 'alternate'`; `shown`/`them` come from `onRival` instead of the
  precomputed `ai` (still used for the kickoff SIM IT of the whole game). Online stays `race`, untouched except OT (nba-7).
- **Auto-defend** (prefs `autoDefend`, default off; toggle on the kickoff screen and in the pause menu): defensive possessions play
  themselves at 3× with a ticker, tap to watch at 1×. **SIM** (per defensive possession, a 44 px chip at its start): resolves it
  instantly with the same seeded engine (your defenders at the standard level) and shows the result. `manualOnly` (Circuit,
  Club Season, Cup) still allows per-possession SIM on defense — you play your offense.
- **Fast breaks:** `newPossession(..., start: 'half' | 'break' | 'early')`: break = 2-on-1/3-on-2 with trailing defenders behind
  the ball and the handler at speed near midcourt; early = 4-on-4 with defenders still running back. Alternate format: after your
  steal → break; after a long defensive rebound → early with a chance by the carom length; after a make → half. Race format
  (online and sims): a seeded ~15% (8–10% break, 6–8% early) from the possession seed, identical on both phones. "FAST BREAK"
  banner.
- **RUN:** three straight scoring possessions by your team without the rival scoring lights "RUN 7-0" and gives your five ×1.08
  window for the next possession (symmetric for the AI); in alternate, On Fire also ends when the rival scores twice in a row.
- **Intentional fouls:** in the last 2 possessions, an AI trailing by 3–6 and in the bonus fouls your worst FT shooter (and you
  can do the same with STEAL on defense); the FT meter plays it out.
- **Length tuning:** measure wall-clock time; trim dead time (celebration/replay caps) before touching possession counts; keep 16
  each way unless the 4–6 min target can't be met.

**Tests and measurements**
- `game.test.ts`: linked energy/subs across both ends; quarter/OT indices; in alternate the rival's score equals the points of
  played AI possessions (no precomputed path); RUN and fire transitions; intentional-foul trigger conditions only.
- Calibration report (alternate, autopilot both ends with idle-assist defense): transition share 12–17% and transition PPP
  1.15–1.35; §3.1 rows stay in band; race format seeded transition share 12–17%.
- Playwright `nba-alt.cjs` (UT Squad Battles fixture via `utui/lib.mjs`, localhost-only): a full solo game at 1× with replays on
  lasts 4–6 min (autoplay hook); Auto-defend plays defense at 3×; SIM resolves in < 50 ms and shows the result; pause works in
  both halves of the alternation; draft head to head vs AI also alternates.
- Online regression: `scripts/qa/online.mjs` two NBA clients (draft H2H and UT online) still race, settle one win/one loss, and
  OT/forfeit from nba-7 still work.

**Screenshots** (`O/shots/nba/nba-9/`): defense possession in a UT match, Auto-defend ticker, SIM chip, FAST BREAK 3-on-2, RUN
banner, Q4 bug, final with both sides' box.

**Protocol:** Protocol bump needed (transition starts and RUN change the online race; the alternate format is solo-only).
**Save-compat:** prefs `autoDefend` only. **Dependencies:** ut (solo pre-match screen M13 links to our kickoff; result screen reads
both sides' `box`), nba-7 (OT/forfeit/box), nba-8 (defense possession).

---

### nba-10 · P1 · Planning cards and ball skills, then final QA

Covers STREAM "Three play cards before a possession (as football has), plus defensive looks", "Moves: three power tiers, three
burst pips, cancellable after ~150 ms", NBA-24 velocity snaps, §11 #14 (pull-up/floater inside 11.5 ft), and the team's final QA.

**Changes**
- **Play cards:** new `src/game/hoops2/plays.ts` with six plays built from the existing `screen`/`cut`/`space` primitives — High Pick,
  Iso Star, Drive and Kick, Post Feed, Floppy, Horns — each a list of timed teammate actions and starting spots (never ratings or
  odds). `dealPlays(five, rand)` deals three, weighted by the five's archetypes (shooters see Floppy more, a dominant big Post Feed).
  New `PlayCards.tsx` (+ `controls.css`): chalk diagrams drawn in SVG, ~2 s to pick, the highlighted card auto-picks, 44 px+ cards.
- **Defensive look cards** (same component) before AI possessions: Man, Switch, Drop, Zone, Trap (three dealt by the AI five);
  your choice sets `p.scheme` (nba-8 looks).
- **Moves**, `engine.ts`: tiers by HND — 85+ elite (100% travel, defender loses 0.45 s), 60–84 standard (80%, 0.30 s), < 60 basic
  (60%, 0.15 s, higher strip risk); **3 burst pips** per possession refilled by a pass or a new possession, repeating the same move
  inside 2 s works less (×0.6 shake), a defender's bump costs a pip (event `move:nopip` when empty); **cancel window**: a shoot or
  pass input ≥ 150 ms after a move starts ends the move; **velocity ramps** over 3 steps (no one-step snap > 0.5 × top speed).
  Pips show as 1–3 dots on SHOOT (gesture mode) or on each move button (buttons mode).
- **Shot intents** from nba-3's gestures: swipe down off SHOOT in the paint = **floater** (a 'close' jumper with layup tempo, so a
  pull-up/floater is possible inside 11.5 ft); swipe up while attacking = power/flashy dunk when the ratings allow, else a layup.
- **Final QA:** full `npm test` once (heavy.sh), `npm run typecheck`, one `npm run build` (4 GB heap, heavy.sh); every hoops2
  Playwright script at the six sizes; `scripts/qa/core-gameplay.mjs`, `gameplay.mjs`, `online.mjs`, `play-feedback.mjs`; the
  calibration and human harness one last time with the final numbers in `nba.md`; the protocol line, "Touched outside my
  lane", "Owner device checks" (thumb reach on the owner's phone, green-window feel, defense controls, iOS haptics, FT meter feel,
  game length) and "Left undone" complete.

**Tests and measurements**
- `plays.test.ts`: picking any play never changes a Hooper or a shot probability (snapshot of `p.bodies[*].p` and
  `releaseProbability` inputs); the shooter five sees Floppy ≥ 2× as often as a non-shooting five over 1,000 deals; each play's
  actors reach their spots within 3 s.
- `moves.test.ts`: travel ratio 100/80/60% ± 5% by tier; lost step 0.45/0.30/0.15 s; the 4th move without pips is refused; cancel
  at ≥ 150 ms stops the move's velocity and starts the shot; max one-step Δv ≤ 0.5 × top speed; floater intent at 9 ft running
  gives a 'close' meter.
- Human harness per play (σ 45, Pro): every play 0.90–1.25 PPP, none > 1.30; cross-drive with pips ≥ 0.85; §3.1/§3.2 bands still
  hold after the cards and pips.
- Final: `npm test` green (all three sports), build passes, no new bundle-size warning for the game chunk beyond +15 KB gzipped.

**Screenshots** (`O/shots/nba/nba-10/`): offense and defense card picks (393×852, 320×568, landscape), pips on SHOOT, a floater,
an elite crossover vs a basic one; the final contact sheet of every nba screen at 393×852 and 320×568.

**Protocol:** Protocol bump needed (plays move teammates, move tiers/pips/cancel/ramps, floater/power intents).
**Save-compat:** none. **Dependencies:** players (floater and tiered move poses; fall back to existing), lead (integration and
the single protocol bump).

---

## 6. Deferred (deliberately), with reasons

1. **NBA-23 foot sliding, NBA-24 pose cross-fades, NBA-25 30 fps clips, NBA-26 player looks** — owned by the players team (render
   and appearance). We expose every action as an `Act` and event they need (`pump`, steal reach, contest jump, FT, floater).
2. **Button layout editor** (research §5.3: drag buttons, resize the stick) — not in the brief; the floating stick and the
   gestures/buttons option cover reach. Revisit after the owner's device check.
3. **A ticking 12:00 game clock** — the format counts possessions; a broadcast clock would misstate it. We show "Q2 · 3/4".
4. **Shared real-time defense online** — not possible over relays (brief). Online keeps the race.
5. **"Clutch Stop" card** (research §5.5) — superseded by real solo defense.
6. **Era-aware simulated totals in `src/engine/broadcast.ts`** (research §5.11) — the draft GameCast sim, outside our files; passed
   to the lead.
7. **Club Season AI box scores by usage** (`src/ut/league.ts`) — ut-owned; we ship `usageShares()` and the handoff note.
8. **Badge display names that are 2K's** (Deadeye, Limitless, Dimer, Posterizer…; research §5.8) — names also show on cards
   (packs/players) and naming is the owner's call; flagged to the lead with suggested originals.
9. **Card-screen surfaces** (category bars, hot-zone court map, shot-DNA grades; research §5.12) — card UI belongs to players and
   packs; we expose `zones` and `usg` on `Hooper`.
10. **UT mode ideas** (Top Plays/Flashbacks, card-once Gauntlet, Clutch mode, one-use boosts; research §5.13) — ut scope.
11. **Per-player shot DNA timing** (release-speed offsets −40…+30 ms; research §5.1.1/§5.9) — changes each player's timing; not in
    the brief and it would move the freshly calibrated windows; a next-round item with players' signature motion (A-4).
12. **NBA-28 soundscape** (announcer, chants, music; squeaks on plant frames) — no new audio assets; plant frames are players'.
    Countdown ticks ship in nba-2.
13. **NBA-29 performance** (floor cache, typed-array replay snapshots) — not in the brief; frame cost is ~2 ms. nba-2 measures
    and acts only if the camera work regresses it by > 15%.
14. **NBA-30 chunk split and mocap preloading** — `vite.config.ts` is shell's, clip loading is players'. We do the attrs skip and
    the tip-off intro.
15. **A defensive Moment** — Moments are scored drills with no rival; defense applies to matches. ut may add a "Stop" drill.
16. **Gauntlet and draft season/playoff games** — simulated by the draft engine; no arcade match exists there. Defense covers every
    arcade solo match: UT Squad Battles, Cups, Club Season, Circuit, Events, UT Draft, and draft head to head against the AI.
17. **A guided "tap to the beat" timing calibration screen** (NBA-14 fix 4) — replaced by the ±40 ms offset in the pause menu;
    Settings screens are not ours.

## 7. Cross-team dependencies (summary)

| Team | What we need or give |
|---|---|
| players | Poses for `pump`, steal reach, contest jump, block vs rebound, FT routine, floater, tiered moves; tip-off portraits; appearance. We give the events/acts and keep our `render.ts` hunks to camera, court, HUD, meter, labels. |
| ut | Result screen reads `Progress.box` (both sides) for player ratings and man of the match (M3); forfeit settlement and the match-in-progress marker; new nba marks in `match-debrief.ts`; `usageShares()` for `league.ts`; Moments/Training `onQuit`. |
| shell | `.arcade-full` safe-area variables and the QA inset override; the score-bug plate (we only add buttons inside it); M9 pre-mount loading vs our in-game tip-off intro. |
| nfl | Shared `Arcade.tsx` forfeit block (one sport-agnostic copy), `difficulty.ts` helper, `PlayReadout.tsx` controlled prop, `play-feedback.ts` (we touch only `basketballFeedback`). |
| packs | Optional display of `zones`/`usg`; badge display names (deferred). |
| lead | The single bump: draft NBA 10→11, UT NBA 10→11, `net.test.ts`; CLAUDE.md/update log. |

## 8. Owner device checks (filled in `nba.md` as tasks land)

Thumb reach of stick, SHOOT gestures and CALL on the owner's iPhone; whether the green window feels fair at 45–55 ms for an
average shooter; iOS haptic ticks inside gestures; the FT meter; defense controls (SWITCH/STEAL/CONTEST) and Auto-defend; solo
game length; the tip-off intro and pause on a real phone call.
