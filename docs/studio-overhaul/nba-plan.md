# Team nba: build plan (studio overhaul, revision 3: Game Design V2, 2026-11-16)

Worktree `/home/user/ps-s-nba`, branch `claude/studio-nba`, dev-server port **5215**.
`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Binding sources, in this order:**
1. BRIEF.md: the hard constraints and the owner decisions of 2026-11-09.
2. `O/design-v2/GAME-DESIGN-V2.md`: the V2 bible. This plan implements its §F.2 "nba" list, builds the §F.1 pieces nba
   owns, and follows the §F.4 first-impression slice as the build order.
3. `O/DESIGN-V2-DECISIONS.md`: the lead's F.6 decisions. Planning cards are cut. nba also owns
   `src/game/controls-geometry.css` and the held arena that makes a rematch take ≤ 10 s. ut owns haptics.
4. `O/design-v2/mockups.html`: the visual target. Section 1's NBA phones show the score bug with the Heat bar, the toast
   line, the gold arc and ground ring, the teal pass ring, the red on-ball arc, and the CALL / SHOOT / PASS cluster at
   393 and 320 wide.
5. `O/STREAM-nba.md`, `O/audit-nba.md` and `O/research-basketball.md`: the audit P0 fixes, kept wherever V2 does not
   replace them.
6. `O/design-v2/research-engagement.md`: only items #4 (Daily Play) and #19 (juice) land on this team.

Revision 2 (`git show 58bcc10:docs/studio-overhaul/nba-plan.md`) holds the critique response index (M1–M27, R1–R12,
K1–K21, T1–T22). Every answer there still stands, except the ones §0 below changes. When a task says "as revision 2",
the engineer reads that section from `58bcc10`.

Team doc: `docs/studio-overhaul/nba.md` (created in nba-1).

---

## 0. What V2 changes in this plan

**Order (F.4).** The first-impression slice items come straight after nba-1, in V2's order:
- the shared stick, the A/B/C/D cluster and pause (nba-2)
- the camera, the action-safe box, the HUD kit, the live shot clock and the held arena (nba-3)
- the gold ring with the PERFECT chime and haptic, plus Heat and the match grade (nba-4)

The rest follows: fouls and free throws, then defense by default, then the duel, stats, online and the fit.

**Changes to existing tasks (F.2 nba #1–#8):**

| F.2 | What changes | Task |
|---|---|---|
| #1 | The controls become **shared** pieces: `Stick.tsx`/`stick.ts`, the A/B/C/D cluster built from the geometry tokens, swipes that start on A, and the CALL radial with **ISO** in place of SPACE. nba also writes `controls-geometry.css` (lead decision). | nba-2 |
| #2 | The meter becomes the **gold ring** in `perfect.ts`: a ±30 ms floor, three states (gold, amber, red), "gold never lies", touch timestamps, a 4-tap calibration, and a rating-scaled gold segment ≥ 8 px on screen. | nba-4 |
| #3 | The camera is the B.1.3 three-quarter view: 12° yaw, fixed zoom near the rim, anchored to the safe box. The HUD kit is shared: score bug, Heat bar, toast line and pause. | nba-3 |
| #4 | Kept: fouls, free throws, real misses; defense by default with Auto-defend and SIM; overtime. | nba-5, nba-6 |
| #5 | New: timing cues on CONTEST and STEAL; the ankle-breaker gold flash; ramped move velocities. | nba-7 |
| #6 | New: shared `heat.ts` and On Fire; the match grade on `Progress`. | nba-4 |
| #7 | Promoted: transition possessions after steals and long rebounds (they were on revision 2's cut line). | nba-7 |
| #8 | Kept: usage, eras, the difficulty ladder, pause/quit/forfeit, the box score. | nba-8, nba-9 |
| #10 | New (P1): NBA Daily Play scenarios. | nba-10 |

**Cut (F.2 nba #9 and the knock-on effects):**
- **Play and look cards** (revision 2's nba-10), with their `'cards:'` stream and the card-pick context. The CALL radial
  covers the planning beat.
- **The defensive look chip.** It cost a tap every possession for the same reason. DROP stays as an AI scheme that the
  AI picks for your five automatically.
- **Per-player two-stage Heat** ("HOT HAND / LOCKED IN", 2 or 3 straight makes) and today's per-player `g.fire`. V2's
  team Heat bar replaces both. "Hot Hand" is now ut's win-streak coin bonus (D.14), so the old name would clash.
- **RUN's ×1.08 window factor.** RUN survives only as text in the toast line ("RUN 8-0"). Heat is the one published
  modifier.
- **nba's own `hoops2/haptics.ts` and the `vibrateLive` append to `sound.ts`.** We call ut's `src/lib/haptics.ts`
  patterns instead (§4.6).
- **The in-game final overlay.** ut's D.1 result sequence and One-More bar end every match. nba provides the data, the
  held arena and a `BoxSheet` that ut opens from BOX SCORE.
- **The 10-tap calibrator** becomes V2's 4-tap "tap on the beat".
- **The three-line post-shot chip** becomes one toast line: the timing step plus the failed dial.

**Renamed for V2's vocabulary (none of these have shipped, so no save is touched):**
- PURE → **PERFECT**: `BoxLine.pure` → `perfect`, plus a new `perfect3`.
- Heat stages → **HEATING UP / ON FIRE**.
- The prefs key `perfect-season:hoops-prefs:v1` → the sport-neutral `perfect-season:touch-prefs:v1` (§4.7). The old key
  only ever existed in this branch's plan.

**Kept unchanged from revision 2:** every audit P0 fix (NBA-01…06, 08…10, 12…22), plus the §3.1 per-16 box targets,
the eras, the four-rung ladder, variance, defense-rewards-playing, the online OT/forfeit design, QA isolation, the test
budget and the determinism rules.

**Protocol.** One running line in `nba.md`: **"Protocol bump needed: NBA draft 10 → 11, UT NBA 10 → 11 because …"**
(gold windows, fouls, format, Heat, moves, transition, usage, eras, OT). The lead bumps once at integration (F.3).

---

## 1. Goals

1. **Rhythm hoops (V2 A.4).** Find the beat, hit the gold. Every skill moment uses the same gold ring:
   - the jumper, the finish, the board, the contest, the steal and the ankle-breaker
   - gold always delivers the best outcome the situation allows
   - an NBA player who learns it can already play the other two sports
2. **It plays like basketball (owner decisions 2 and 3).** Solo games:
   - four quarters of 4 + 4 possessions, alternating offense and defense
   - defense played by default
   - a staged Clutch finish
   - overtime instead of rating tiebreaks
   - fouls and free throws, fast breaks, Heat
   - 4–6 minutes
3. **Stats feel legit.** AI against AI lands on the 2024-25 per-16-possession targets (§3.1), with the right shot mix, a
   star's share for stars, eras in order and a real four-rung ladder.
4. **Thumbs first.** The control grammar and geometry come from V2 A.5:
   - a floating stick, with sprint past the ring
   - at most four right-thumb targets, none in the top two thirds of the screen
   - everything fires on touch-down
   - the handler and the rim always inside the action-safe box
   - a pause button in every match
5. **Readable and honest.** The clock never freezes. Banners live in the toast line, never over the rim. Names print with
   their accents. Every miss names its dial (TIMING, PRESSURE or RANGE).
6. **The next game in ≤ 10 s.** The arena stays mounted through ut's result sheet and re-seeds in place.
7. **Keep what works** (audit §12, V2 B.1.9):
   - the deterministic engine and its tests
   - physical rebounds and catches
   - the recorded jumper and its shot tempos
   - the scheme read and LAST PLAY coaching
   - contest grades
   - replays, hit-stop and the posterizer
   - landscape layout and reduced motion
   - the ~2 ms frame cost

---

## 2. Hard rules and working conventions

These are revision 2's rules, with V2's additions.

- **Saves.** No profile, storage key, card/edition/copy id or saved-field meaning changes.
  - `Hooper`, `HoopsGame`, `Possession` and `Progress` gain *optional* in-memory fields only.
  - The one new key is `perfect-season:touch-prefs:v1` (§4.7). It is read with try/catch, falls back to defaults, and is
    not in the `recovery.ts` lists.
- **Protocol.** We never edit `DRAFT_RULES` or `UT_RULES`. Every outcome change appends its reason to the running line.
- **Determinism.**
  - Seeded RNG only (`p.rand`, `pl.rand`). No `Math.random()` or `Date.now()` in `engine.ts`, `game.ts`, `autopilot.ts`,
    `heat.ts` or the outcome functions of `perfect.ts`.
  - Touch timestamps only feed your own offense's release offset; each phone plays its own offense.
  - New random draws use named seed streams (`'ai:'`, `'break:'`, `'daily:'`). The race's `aiPossessionsOf` RNG order
    stays byte-identical (tested).
  - New sim-side math uses only `+ − × ÷`, `sqrt`, `min`, `max` and lookup tables, never new `Math.exp/pow/log`, because
    JSC and V8 differ. `heat.ts` is integer-only. `determinism.test.ts` scans the new files.
- **Branching.** `pick({ nba, nfl, soccer })` only. The shared files (`stick.ts`, `perfect.ts`, `heat.ts`, `hud/*`) take
  per-sport values through `pick`. Run `sport-branches.test.ts` whenever they, `Arcade.tsx` or `difficulty.ts` change.
- **Layout.**
  - Use the 390 design-px frame. `.arcade-full` is portaled outside the stage, so its sizes are real CSS px taken from
    the V2 table (§3.8).
  - No width media queries. Geometry tokens interpolate with `clamp()`/`calc()` on `100vw`, and landscape is a JS class.
  - Taps ≥ 44 px. Text ≥ 10 px. Canvas name chips are 7 art px tall, which is 10.5 design px at 1.5 px per art pixel.
  - Symbols are SVG.
- **CSS files.**
  - Shared pieces: `src/game/controls-geometry.css` and `src/game/hud/hud.css`, prefixed `.ps-ctl-*` / `.ps-hud-*`,
    with no `.hg2` scope.
  - nba-only CSS: `src/game/hoops2/{hud,match}.css`, scoped `.hg2:not(.fb2)`, because football reuses `.hg2-*`.
- **Reduced motion.** Every new animated element gets a row in the `nba.md` table (§3.15). Screenshots use
  `reducedMotion: 'no-preference'`, and every task also runs one `'reduce'` pass.
- **Shared files** get small local hunks, are never reformatted, and are each listed under "Touched outside my lane":
  `Arcade.tsx`, `difficulty.ts`, `progress.ts`, `ut/Match.tsx`, `App.tsx`, `PlayReadout.tsx`, `play-feedback.ts`, the
  `render.ts` player sections, `Lab.tsx` and `evolution/Training.tsx`.
- **QA isolation.** As revision 2 §2:
  - `scripts/audit/nba-lib.mjs` route-aborts every host but localhost/127.0.0.1 (fonts.googleapis.com and
    fonts.gstatic.com allowed)
  - base URL `http://localhost:5215/?ns=inspect&relay=ws://localhost:7795`; 7795 is the team's own relay, recorded in
    `nba.md`
  - insets injected on `.arcade-full`
  - the shared `scripts/qa/*.mjs` run only through `nba-qa-run.mjs`
  - `online.mjs` runs only under `flock /tmp/ps-qa-relay-7777.lock`
  - nothing ever writes to live Supabase, relays or boards
- **Machine.**
  - Every heavy command goes through `bash O/heavy.sh …`.
  - Dev server: `nohup npx vite --port 5215 --strictPort > /tmp/ps-nba-vite.log 2>&1 & echo $! > /tmp/ps-nba-vite.pid`.
    Stop it with `kill $(cat /tmp/ps-nba-vite.pid)`. Never `pkill -f` or `pgrep -f`.
- **The standard test set** runs after every task, through heavy.sh:
  `npx vitest run src/game/hoops2 src/game/hud src/game/stick.test.ts src/game/perfect.test.ts src/game/heat.test.ts src/game/juice.test.ts src/game/play-feedback.test.ts src/game/difficulty.test.ts src/ut/match-debrief.test.ts src/ut/content.test.ts src/engine/sport-branches.test.ts`.
  - `balance.test.ts` is opt-in (nba-8, nba-10).
  - The full `npm test` and the single `npm run build` run only in nba-10.
- **Test budget.**
  - New always-on tests add ≤ 60 s to the NBA run: determinism < 15 s, box 20 games < 10 s, calibration smoke < 20 s,
    OT 200 ties < 5 s, plus unit tests.
  - Opt-in tests: `NBA_CAL`, `HUMAN`, `NBA_CURVE`, `NBA_OT`, `NBA_BOX`, `NBA_ERA`, `NBA_MOMENTS`.
- **Compute.** Iterate at `NBA_CAL_GAMES=15` (report only). Accept at 150 games/config. Hold a heavy.sh slot ≤ 20 minutes
  at a time.
- **Docs.** Each task updates the NBA parts of `docs/ARCADE-V2.md`, `docs/CORE-GAMEPLAY.md` and
  `docs/GAMEPLAY-RATINGS.md` where they change; nba-10 does the final pass. The shared pieces get
  `docs/studio-overhaul/shared-controls.md` (§4, written in nba-2 and extended in nba-3/4).
- **Commits.** One or more per task, staged by explicit path, never `git add -A`.
  - Message: `Claude: …`, then the body, then the two trailer lines from BUILD-RULES.
  - Then `git push -u origin claude/studio-nba`, retrying after 2/4/8/16 s on network errors.
  - No model names in commits, code or docs.

---

## 3. Targets (the numbers the tasks prove)

Scale and sample are as revision 2. "Even 78" means the starting fives' mean `rawOvr`. Acceptance runs use 150
games/config (2,400 possessions per side; PPP SE ≈ 0.022). Every asserted band is ≥ ±2 SE wide. 15-game runs are never
asserted. `hoops2/targets.ts` holds every row as data. **nba-1 updates the rows this revision changes:** §3.3 windows,
§3.7 Heat, §3.8 geometry, §3.10 rematch, §3.13 feel, §3.14 grade.

### 3.1 Per 16 possessions, one side, even 78 Pro, AI vs AI, modern era: unchanged

| Stat | Accept |
|---|---|
| PPP | 1.08–1.18 |
| FGA | 13.4–15.4 |
| 3PA/FGA | .35–.45 |
| FTA/FGA | .18–.28 |
| TOV% | 11–15% |
| STL | 1.0–1.5 |
| BLK | 0.6–1.0 |
| PF | 2.5–3.5 |
| ORB% | 22–29% |
| AST/FGM | 55–68% |
| FG% / 3P% / eFG | .44–.50 / .33–.39 / .52–.57 |
| Rim FG% | 62–72% |
| Mid FG% | 38–47% |
| FT% | 74–80% |
| Shot mix rim / close / mid / three | 20–38 / 12–25 / 4–12 / 35–45% |
| Heavy + smothered share of jumpers | ≤ 45% |
| Passes per possession | ≥ 1.2 |
| Seconds per possession | 6.5–9.5 |
| Top-usage card's FGA share | 25–36% |
| Top scorer's points share | ≤ 45% |
| Scorers per game | ≥ 3.5 |
| PG time | ≤ 45% |
| C slot's 3PA | ≤ 10% |
| Transition share / PPP | 12–17% / 1.15–1.35 |
| Ties decided off the floor | 0 |

The per-player sanity rows are as revision 2.

### 3.1b Eras: unchanged (revision 2 §3.1b)

3PA/FGA is non-decreasing by decade (0.02 slack). Pre-1980 3PA/FGA ≤ .05. The 2020s have the highest PPP by ≥ 0.02.

### 3.2 Difficulty ladder (NBA-19): four rungs, measured with the median human, defense played

| | Rookie | Pro | All-Star | Legend |
|---|---|---|---|---|
| AI offense PPP vs a median-human defender | ≤ 1.00 | 1.08–1.18 | 1.12–1.22 | ≥ 1.18 |
| Median-human offense PPP vs that AI defense | ≥ 1.15 | 1.05–1.20 | 0.98–1.12 | 0.90–1.05 |
| Median human wins | 60–80% | 40–60% | 30–50% | 20–40% |
| AI TOV% | 11–15% | 11–15% | 11–15% | 11–15% |

- **Difficulty only ever changes the AI's side**, plus how often you are offered gold (§3.3). It never shrinks gold below
  the floor.
- `releaseSd(skill)` is a table-interpolated, monotone curve. Revision 2's anchors (95 / 58 / 50 / 44 ms) are now only
  **starting values**: V2's wider gold windows mean the anchors are re-fitted in nba-10.
- `windowFactor(def)` = ×1.25 / 1 / 0.9 / 0.8, floored at ±30 ms.
- Three more rows, as revision 2:
  - every simple honest tactic scores ≥ 0.80 PPP on Pro, and the step-back exploit ≤ 1.30
  - straight-drive strips: Pro ≤ 7%, Legend ≤ 10%
  - autopilot PPP ≤ the median human's − 0.05

### 3.3 The gold ring for the jumper (V2 B.0.1, B.1.5; replaces revision 2 §3.3)

**Timing.** Press and release are timed from `PointerEvent.timeStamp` and converted to game time (`perfect.ts`). A
release that falls between two 60 Hz steps lands with |off| < 1 ms (baseline: up to 16.7 ms).

**Gold half-width** (open, catch-and-shoot, Pro, fresh):
`base(thr) = 30 + 30 · clamp((thr − 55) / 44, 0, 1)` ms, plus 0.4 ms per point above 99 (at most +5).
These are starting values, fitted in nba-4 and nba-10.

| THR | 55 | THR_avg (73, measured in nba-1) | 85 | 95 | 99 |
|---|---|---|---|---|---|
| Gold ± (ms) | 30 | 42 | 50 | 57 | 60 |

- **Multipliers go through the single `windowScale(parts)`:**
  - light contest ×0.75
  - rhythm catch (shot within 0.4 s of the catch) ×1.20
  - On Fire ×1.25
  - meter Off ×1.10
  - difficulty ×1.25 / 1 / 0.9 / 0.8
  - pull-up ×0.88, with the window centre moved +10 ms later
  - fatigue: +15 ms later at 60% energy and +25 ms at 40%, and up to 15% narrower
- **The product is capped at ×1.45 and ±90 ms.** The **±30 ms floor** is applied last and always wins ("anyone,
  anywhere"). The worst stack (THR 99, rhythm, On Fire, Off, Rookie) lands on ±87–90 ms, the top of V2's "±30 to ±85"
  range.

**States** (`perfect.ts`, recomputed every frame from the live contest):

| State | When (jumpers) | Outcome |
|---|---|---|
| **gold** | the contest is open or light (Legend: open only), **and** the shot is in range | a release in gold is a **make**: no block roll, no rim-out. **Gold never lies.** |
| **amber** | a heavy contest; a light contest on Legend; or out of range (RANGE) | no guarantee. Timing raises the chance up to a rating-scaled cap. Toast: PRESSURE or RANGE. |
| **red** | smothered, or more than 4 ft beyond range, or no angle | ≤ 15% even when perfectly timed. Toast: PRESSURE / TOO FAR. |

- **Range** (a jumper's distance from the rim):
  - THR ≥ 85: in range to 27.75 ft
  - THR 70–84: to 25.75 ft
  - THR 60–69: to the arc (23.75 ft; 22 in the corner)
  - THR < 60: to 16 ft
  - a big with real 3PA < 1 a game: threes are always amber RANGE
- **On Fire** turns amber into gold only for *uncontested* (open) attempts, which means range-amber and Legend-light.
  Heavy stays amber and red stays red.

**Drawing.** The ring around the shooter's feet closes on the inner target ring, and a short arc meter sits above his
head (mockup NBA phone).
- The gold segment is drawn at its true time-size and position and is **≥ 8 design px** at 320 and 393 wide (baseline:
  about 4 px for THR 75 open).
- Amber and red have their own colours. There is no gold slice unless the state is gold.
- The arc radius is 0.13 × min(W, H).

**Make rates.** The median human is σ 50 ms, the skilled human σ 35 ms. Catch-and-shoot threes, Pro, fresh:

| | Gold offered | Gold rate at σ 50 (asserted) | Make rate at σ 50 (asserted) | At σ 35 |
|---|---|---|---|---|
| THR 55, open | yes (in range) | 40–50% | ≤ gold + 8 pts | report |
| THR_avg, open | yes | 55–65% | ≤ gold + 8 pts | ceiling 80% |
| THR 95, open | yes | 70–80% | ≤ gold + 6 pts | ceiling 92% |
| THR_avg, light | yes (not Legend) | 42–52% | ≤ gold + 8 pts | report |
| THR_avg, heavy | amber | 0 | 22–30% | ≤ 34% |
| any, smothered | red | 0 | ≤ 15% | ≤ 15% |
| Pull-up | — | — | ≤ 0.90 × catch-and-shoot | — |

**Documented divergence** (written into `nba.md`). V2's ±30 ms floor and "gold never lies" mean a median human makes
45–80% of *open* looks, well above real open-three rates (35–45%).
- Realism is held at the **box level** instead, through three things:
  - how often gold is offered: the AI defense's contest mix and closeouts, and the range gate
  - the steeper off-gold fall-off
  - the AI's release spread
- The asserted numbers are the §3.2 human PPP bands and §3.1's AI-vs-AI box. This is the skill game V2 asks for.
- The lead revisits it if the owner's own calibrated σ (nba-4's calibrator) is under 35 ms.

**Free throws.** A 2-second band meter (B.1.5 #7) at σ 50 lands within ±6 points of `freeThrow(rating)`.

### 3.4 Format and length (owner decision 3, V2 B.1.1)

- **Solo:** four quarters of 4 + 4 possessions, alternating, 16 + 16 in all.
  - **Clutch** = the last 2 + 2 possessions of Q4.
  - **OT** = 2 + 2 possessions, repeated until decided (cap 10; never hit in 10k sims).
- **Online race:** 16 possessions of offense, in four quarters of 4, plus 2-possession OT periods when tied. Clutch staging
  covers your possessions 15–16.

| Part | Budget |
|---|---|
| Live possession, median, both ends | 7–9 s |
| Dead time between possessions | ≤ 1.2 s |
| Free throw | ≤ 4 s each (online auto-shoots after 4 s idle) |
| Replays | ≤ 1 per quarter plus the Clutch "FOR THE WIN" replay, ≤ 4 s, tap skips |
| Tip-off curtain + halftime | ≤ 5 s total |
| A SIM'd defensive possession | ≤ 0.3 s |
| **Whole solo game, median human at 1×, defense played** | **4:00–6:00 (expected ≈ 5:30)** |

Auto-defend games (≈ 4:15) and all-SIM games (≈ 3:30) are reported.

### 3.5 Variance and squad strength: unchanged

- Even game: margin SD 4–6; ties before OT 4–8%; ≥ 1.5 lead changes.
- Win probability: OVR edge +5 → 60–70%, +10 → 75–85%, +20 → ≥ 90%.
- Displayed 96 v 64: median margin ≤ 20.

### 3.6 Defense must reward playing (owner decision 2): unchanged, plus V2's rings

- A median-human defender concedes ≤ the Auto-defend PPP − 0.03.
- A poor defender concedes ≤ Auto + 0.12.
- SIM ≡ Auto-defend (same marks, same seed).
- Full-game SIM win % is within ±5 of an Auto-defend game's.
- **CONTEST ring:** a PERFECT contest forces the lowest shot grade the geometry allows. Over 600 AI jumpers from ≤ 4 ft,
  a median-human contester at σ 50 hits gold on 35–55% of them and lowers AI PPP by ≥ 0.06 against idle-assist.
- **STEAL flash** (the ball is exposed during a crossover or a lazy pass): a tap inside it at σ 50 strips 30–45% of the
  time with no foul roll. Outside it the steal rate is ≤ 8%, with a 25–35% foul rate when repeated inside 1 s.
- **Camera on defense:** your defender overlaps the AI handler by ≤ 35% at ≥ 90% of AI releases, and is never under a
  control.

### 3.7 Heat (V2 B.0.2; replaces revision 2's two-stage Heat and the RUN factor)

**Rules (`heat.ts`, integer, published in the Help sheet):**
- **Gains:** PERFECT skill moment +12; a basket +10; a stop or forced turnover +15; a clean possession with ≥ 2 passes +5.
- **Losses:** a turnover −20; conceding −10.
- **Stages:** HEATING UP at 66; ON FIRE at 100.
- **On Fire** lasts your next **2** possessions, and the bar returns to 0 when it ends.
- The bar resets to 0 at halftime.
- The AI earns Heat by the same rules, and its bar is visible in solo play. Online, only your own bar is shown, because the
  rival's Heat is not on the wire.

**Targets, per solo game, median human, Pro, even 78:**

| Row | Band |
|---|---|
| You reach HEATING UP | 70–95% of games |
| You reach ON FIRE | 25–55% of games |
| AI reaches HEATING UP | 60–90% of games |
| AI reaches ON FIRE | 15–45% of games |
| On Fire spells per side per game | mean ≤ 2.0 |
| PPP on On Fire possessions, vs that side's baseline | ≤ +0.25 |
| Intentional fouls (as revision 2) | 0 outside the qualifying state; fired in ≥ 70% of qualifying states |

If a band fails, nba-10 tunes the published numbers and updates the Help text; V2 marks them as starting values.

### 3.8 Controls geometry (V2 A.5; replaces revision 2's HUD-share rows)

**Exact rects.** Measured on `.arcade-full` with injected insets. ±2 px at the two V2 sizes:

| Element | 393×852 (sat 59 / sab 34) | 320×568 (20 / 0) |
|---|---|---|
| A (SHOOT / CONTEST / BOARD / FT) | Ø92, centre (323, 738) | Ø84, centre (266, 510) |
| B (PASS / STEAL) | Ø64, centre (238, 778) | Ø56, centre (190, 536) |
| C (CALL / SWITCH) | Ø48, centre (250, 694) | Ø44, centre (200, 468) |
| D (hidden in NBA) | Ø48, centre (340, 652) | Ø44, centre (282, 436) |
| Stick ghost ring | Ø120, centre (84, 730) | Ø104, centre (70, 496) |
| Stick zone | x 0–189, y 383–818 | x 0–154, y 256–568 |
| Score bug | 232×40 at (80, 65) | 200×34 at (60, 24) |
| Pause | 44×44 at (12, 63) | 44×44 at (6, 20) |
| Heat bar | 232×6 at (80, 108) | 200×5 at (60, 60) |
| Toast line | one line, 28 px tall, bottom edge at y = 618 | bottom edge at y = 404 |
| Action-safe box | y 115–568 | y 76–368 |

- **Gaps.** Button-to-button gaps are 10–18 px at both sizes (A–B 16/10, A–C 15/14, A–D 18/12). Every target is ≥ 44 px.
  There are at most four right-thumb targets, and none sits above 2/3 of the height.
- **Other sizes.** 430×932 and 375×667 use the interpolated tokens (§4.1): no overlaps, everything ≥ 44 px, everything
  inside the insets.
- **Landscape** (852×393, 932×430, 667×375, 568×320) keeps the 393 sizes anchored to the corners inside `--sal/--sar`,
  with the safe box below the bug.
- **Safe box.** The handler and the rim are inside it in ≥ 98% of 300 sampled offense frames at every size. On defense
  the same holds for your defender and the AI handler.
- **Camera (V2 B.1.3):**
  - rim centre at 20–24% of the viewport height
  - handler's feet at 50–55% (median)
  - on-ball defender overlap ≤ 35% at ≥ 90% of releases
  - zoom varies ≤ 2% while the ball is within 15 ft of the rim (no zoom-in pile-ups)
- **Gestures** (as revision 2):
  - ≤ 2% misclassification over 200 jittered gestures per class (tap, hold, four swipes)
  - 0 accidental passes from stick touches
  - two pointers (the stick plus A) both tracked
  - the stick responds within 1 frame
  - a thumb resting in the zone 300 ms before the whistle moves the handler > 1.5 ft within 300 ms of it (baseline 0 for
    2.25 s)
- **Sprint ring.** Pushing ≥ 1.15 × the ring radius sets `sprint`, and the edge fires one `tick` haptic. The ring follows
  the thumb beyond 1.6 R.
- **Text.** Every DOM text ≥ 10 px at 320 wide. Name chips carry 0 glyph misses for every name in `cards-nba.json`. 0
  duplicate on-court tags across 1,000 random UT squads.

### 3.9 Performance, bundle and test time

- **Frames:** at 4× CPU, median ≥ 55 fps and ≤ 5% of frames > 20 ms; at 1×, p99 ≤ 10 ms. Measured in offense, defense,
  FT trips, replays and the On Fire flames.
- **Bundle:**
  - game chunk ≤ +18 KB gzip; this includes the shared stick/ring/heat/HUD that nfl and soccer also load
  - main / first-paint chunk +0 KB
  - UT chunk ≤ +2 KB: only the type-light `hud/grade.ts` and `hoops2/usage.ts`, both dependency-free (source-scan test)
  - `targets.ts` and `daily-play` data stay out of the main chunk
- **Test time:** ≤ +60 s on the NBA `npm test`.

### 3.10 Flow, pause and the held arena

- **Pre-game:** the PLAY tap to the first controllable possession takes ≤ 2 taps and ≤ 3.5 s. Skipping the curtain takes
  ≤ 0.3 s.
- **Pause:** 0 engine steps and 0 timer callbacks during a 10 s pause. A paused-and-resumed scripted game ends with marks
  identical to the unpaused run. It auto-pauses on `visibilitychange`/`pagehide`.
- **Held arena (V2 D.1):**
  - whistle → `onFinish` ≤ 0.3 s when the host holds the arena
  - `rematch()` → first controllable frame ≤ 1.5 s at 4× CPU, with the 1.5 s opponent curtain included and skippable
  - no new canvas or renderer instance (identity kept)
  - JS heap after the 5th rematch within +10% of after the 1st
  - **whole loop:** whistle → next tip-off ≤ 10 s with ut's 5 s slam/tally, measured end to end once ut's sheet is in the
    branch; until then against a stub sheet that waits 5 s

### 3.11 Practice drills and Moments: unchanged

0 FT trips, OT periods, alternation and pip limits in practice. Drills count every attempt; a pump fake is not one.
Moment completion bands before and after go to ut (The Green Room counts PERFECT releases).

### 3.12 Online overtime and forfeit: unchanged (revision 2 §3.12)

The four-case two-client matrix on relay 7795, 0 mismatches in 20 seeded runs, ≤ 37 ends on the wire.

### 3.13 Feel: haptics and audio (V2 B.0.5)

**Haptic patterns.** We call ut's `src/lib/haptics.ts`, and test with a spy that the right pattern fires for the right
event:

| Pattern | Events |
|---|---|
| `tick` | input accepted: stick sprint edge, CALL pick, STEAL tap |
| `double` | PERFECT: release, finish, board, contest, steal, ankle-breaker |
| `long` | a score, a block, a turnover against you |
| `heartbeat` | Clutch with a one-score margin, once per possession; requested from ut (§4.6) |

**Audio** (consumed from soccer's `sound.ts` addition, §4.6):
- the PERFECT chime is two notes, +1 semitone per consecutive PERFECT up to 5
- a ring-fill tick in the last 200 ms
- the shot-clock tick each second under 4 s
- rim, glass and net sounds on their real events

**Juice:**
- hit-stop 33–120 ms, capped at 150 ms per second (dunk rim contact 70 ms, block 60 ms, PERFECT release 1 frame)
- at most one slow-motion beat per score
- reduced motion removes scale and shake and keeps colour and sound

### 3.14 Match grade (V2 B.0.3)

- **Letter** from offense points per possession against the par for the rung:
  - par: Rookie 1.20, Pro 1.10, All-Star 1.05, Legend 0.97, online 1.10
  - S ≥ 1.25 × par; A ≥ 1.10 × par; B ≥ 0.90 × par; otherwise C
- **FLAWLESS** = a win with 0 turnovers.
- **Median human at Pro over 300 games:** S 5–15%, A 20–35%, B 30–45%, C 15–35%. The grade never changes coin pay; ut
  reads it.

### 3.15 Reduced-motion table (in `nba.md`; one row per element)

| Element | With reduced motion |
|---|---|
| clock warning | colour only |
| camera easing | ×2 faster settle, no shake |
| toast-line words | no scale; colour kept |
| gold ring | static fill colour change, no shrink animation (the timing is the same) |
| Heat trail and flames | static tint |
| CALL radial | instant |
| tip-off curtain | static lineup card |
| release pop and hit-stop | none; gold flash kept |
| Clutch staging | gold bug and crowd sound only, no camera tighten |
| rematch dim | instant |
| FT meter | unchanged (it is input) |

---

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

## 5. The NBA controls context table (V2 B.1.2; one meaning per gesture per context; tested in nba-2)

The left thumb is the floating stick everywhere: push past the ring to sprint. Every action starts on touch-down.

| Context | A (Ø92, gold) | B (Ø64, teal) | C (Ø48, glass) | D | Court |
|---|---|---|---|---|---|
| **Offense, ball in hand** | **SHOOT.** Down: the gather starts, ring t0 = the touch timestamp. Up < 120 ms and < 12 px: a pump fake. Held ≥ 120 ms, then up: the shot (stopped = jumper; driving to the rim = automatic finish: layup, dunk or floater). Swipe ≥ 36 px within 250 ms (cancels the gather for free): ← / → crossover, ↓ step-back, ↑ spin, or **euro-step** when driving. | **PASS.** Down starts a 120 ms wind-up to the stick-aimed man (else the most open). Still held at 120 ms = lob (alley-oop to a cutter). | **CALL:** opens a radial above C with SCREEN / CUT / **ISO**. Slide to an item and lift, or tap it. | hidden | tap a teammate (a ≥ 44 px target) = pass to him. Outside the stick zone, or anywhere while the stick is held by another pointer. |
| **Rebound race** | **BOARD:** jump on down; the gold ring closes on the ball's last drop | hidden | hidden | hidden | — |
| **Free throw** | hold: the marker rises over ≤ 2 s; release in the band | — | — | — | — |
| **Defense** (nba-6 stick; nba-7 buttons) | **CONTEST:** jump on down; the ring closes on the shooter as he rises; gold = PERFECT contest; early = foul risk | **STEAL:** tap; a gold flash on the ball marks it as exposed | **SWITCH** to the man nearest the ball | hidden | — |
| **Dead ball / celebration** | held: ignored ("LET GO TO SHOOT"); tap: skip | hidden | hidden | hidden | the stick direction is stored and applied at the whistle |
| **Buttons-only pref** | tap = pump, hold = shot, no swipes | as offense | as offense | — | CROSS / STEP / SPIN arc above A (≥ 44 px each), firing on down |

- **Removed:** the card-pick row (cut), the look chip (cut) and "circle = spin" (already cut).
- **ISO** clears the strong side for your highest-usage card and feeds him the ball (NBA-03: star usage).
- Practice drills use the offense row; the pass drill also allows B.

---

## 6. Cross-team contracts carried over from revision 2

Revision 2 §6 stands as written, except for the items below.
- **§6.1 `render.ts`, with players:**
  - nba's `hoops2/hud-draw.ts` draws the gold ring (through `hud/ring-draw.ts`), the gold ground ring under the
    controlled player, the teal pass ring, the red on-ball arc, the FT meter, the BOARD ring, the Heat trail and the On
    Fire flames
  - `draw()` keeps one call line after the items loop
  - the per-possession kits go through `kitOf` at the call site
  - V2 C.2's venue palette is players' (OWNERSHIP V2 grant); nba keeps the court geometry, the floor cache and the camera
- **§6.2 `Arcade.tsx` / `difficulty.ts` with nfl:**
  - unchanged (`onQuit`, the forfeit `onFinish`, `'FF'`, `onRival`, `userDefenseIQ`, `onBoxScore` stripped from the wire)
  - plus the held arena in §4.8
- **§6.4 pre-game:** ut's pre-match screen is the only screen with buttons. Arcade's 1.5 s curtain is also the rematch
  curtain.
- **§6.7 marks with ut:** unchanged (`NBA_MARK_LABEL`, `markPoints()`, `'4'`, `'F0'…'F3'`).
- **§6.8 settings:** the pause sheet's Sound/Haptics toggles use the read-modify-write `withSettings` helper (tested).
- **New, with ut (V2 D.1, D.5, D.6):**
  - ut's One-More bar sits at `--ctl-a-*`
  - ut reads `Progress.grade` (letter, PERFECTs, best Heat, fires, moments) and the box for objectives, the Touch rating
    and card mastery
  - ut's REMATCH and NEXT call `ArcadeHandle.rematch()`

---

## 7. Scope map: every source item → task

| Item | Source | Task |
|---|---|---|
| Shared stick, A/B/C/D, geometry tokens, pre-held thumb, sprint ring, swipes on A, CALL with ISO, tap teammate, Buttons-only | V2 F.2 #1, A.5, F.4 #2; NBA-12, 13, 17, 18 | nba-2 |
| Pause button and offline pause/quit | V2 A.5, F.4 #2; NBA-09 | nba-2 (online in nba-9) |
| Three-quarter camera, fixed zoom, safe box, defensive overlap | V2 F.2 #3, B.1.3, F.4 #3; NBA-20 | nba-3 (defense measured in nba-6) |
| HUD kit: bug, Heat bar, toast line; banners off the rim | V2 F.1, C.3; NBA-21 | nba-2 (toast), nba-3 |
| Live shot clock, 5 s warning, tick under 4 s | NBA-08; V2 B.1.1, F.4 #4 | nba-3 |
| Pixel font (& / : + ' and the diacritic fold), unique tags, labels | NBA-22; V2 C.3 | nba-3 |
| Pass-target % with the closeout; floor cache | NBA-16, NBA-29 | nba-3 |
| Held arena, rematch ≤ 10 s | lead decision; V2 D.1 | nba-3 |
| Gold ring: windows, states, touch timestamps, calibration, honesty; layup ring | V2 F.2 #2, B.0.1, B.1.5; NBA-14, 15 | nba-4 |
| PERFECT chime and haptic, toast words, release pop, net snap | V2 B.0.5, B.1.7, F.4 #5 | nba-4 |
| Heat and On Fire, team bars; ball trail and flames | V2 F.2 #6, B.0.2 | nba-4 (AI Heat in nba-6) |
| Match grade on `Progress` | V2 F.2 #6, B.0.3 | nba-4 (par per rung in nba-6) |
| Fouls, FT band meter, and-ones, turnovers, real misses, rim rattle, rebounding AI, BOARD ring | NBA-01, 04, 11, 24; V2 B.1.5 | nba-5 |
| Defense by default, Auto-defend, SIM, the rival's real score, OT, Clutch staging | owner decisions 2 and 3; NBA-06, 07; V2 B.0.4, B.1.1 | nba-6 |
| CONTEST / STEAL rings, SWITCH, ankle-breaker, movement feel, moves, pips, ramps, contact, transition, intentional fouls | V2 F.2 #5, #7, B.1.4–5; NBA-24 | nba-7 |
| Shot value, usage and ISO, eras, four rungs, AI playbook, hot/cold zones (P1) | NBA-02, 03, 05, 19; V2 B.1.8 | nba-8 |
| Online OT and forfeit, online pause, tip-off curtain, box sheet and POG, attrs skip, clip preload | NBA-06 online, 09, 10, 30 | nba-9 |
| NBA Daily Play (P1) | V2 F.2 #10, D.3 | nba-10 |
| The single global fit, final QA, handoffs | revision 2 R2 | nba-10 |

---

## 8. Tasks (ordered)

Each task has a **Must** list, a **Cut line**, measurable **Acceptance**, tests, screenshots (under
`O/shots/nba/<task>/`), protocol, saves, files outside the lane, and dependencies. Every task ends with:
- the standard test set (§2)
- its one-line hints, through the toast line
- its doc updates and its reduced-motion rows
- a commit and a push

P0 items and owner decisions are never on a cut line.

---

### nba-1 · Enabling · Finish the harness, baseline, QA isolation and day-one V2 contracts (partly done: keep first)

**Already in the worktree from before the pause (uncommitted):**
- `hoops2/box.ts` (`BoxTracker`)
- the observation-only engine events (`fga`, `drb`, `stl`, `int`, `foul`)
- `harness.ts`, with squads, the human model and the six defender policies
- `targets.ts`, with THR_avg measured at 73 (engine) and 80 (UT), and the UT gap escalated to packs
- `determinism.test.ts`, `calibration.test.ts` and `box.test.ts`
- `practiceStart()` moved into `game.ts`

**Must (the rest):**
1. **V2 vocabulary and rows:**
   - `BoxLine.pure` → `perfect`, plus `perfect3` (unshipped, so this is safe)
   - `targets.ts` rows replaced for §3.3 (V2 windows and gold rates), §3.7 (Heat), §3.8 (the geometry table), §3.10
     (rematch), §3.13 (patterns) and §3.14 (grade)
   - the HOT HAND / LOCKED IN, RUN-factor and card rows removed
2. **The remaining harnesses:**
   - `calibration-smoke.test.ts`: always on, 20 games, wide bands, < 20 s
   - `human.test.ts` (opt-in `HUMAN`): σ 50 / σ 35 and the four-rung sweep
   - `curve.test.ts` (opt-in `NBA_CURVE`)
   - `moments.test.ts` (opt-in `NBA_MOMENTS`)
3. **QA isolation:**
   - `scripts/audit/nba-lib.mjs`: route-abort, the 8 sizes with insets, both reduced-motion modes, port 5215, relay 7795
   - `nba-relay.mjs`
   - `nba-qa-run.mjs`, which refuses to run unpatched
   - the audit's `nba-shots/clock/deadstick/perf/final/se` scripts, ported
4. **Two V2 baseline probes:**
   - `nba-geo.mjs` measures today's control rects against the §3.8 table at 393×852 and 320×568
   - `nba-rematch.mjs` measures today's whistle → next tip-off through the UT Squad Battles fixture
5. **The baseline run** (heavy.sh):
   - calibration at 150 games for even 78 Pro and 90 v 75; 15 games for the other configs
   - the human harness, 20 games per strategy × 4 rungs
   - the curve dump
   - perf at 1× and 4× (430×932, 320×568)
   - captures at the 8 sizes
6. **`docs/studio-overhaul/nba.md` (new):**
   - the baseline, THR_avg and the running protocol line
   - **§4's contracts copied verbatim**, under "Contracts for nfl / soccer / ut", with a "Contract changes" log
   - revision 2's §4 escalations, updated: the Heat-name escalation is withdrawn because V2 names it
   - the §4.6 requests: `heartbeat` to ut, `sfx.perfect`/`ringTick` to soccer
   - "Touched outside my lane", "Owner device checks" and "Left undone"

**Acceptance:**
- The baseline reproduces the audit within noise: PPP 1.28 ± 0.05, FT rate < .05, mid FG% > .55. Any difference is
  explained in `nba.md`.
- The determinism test passes: 3 seeded games are identical across loops, uneven `dt`, juice and the tracker. The
  recorded person replays exactly.
- `box.test.ts`: Σ PTS = the score, attempts match the marks, and one assist is credited for pass → catch → make.
- The standard set is green. Always-on additions are < 45 s in total.
- The probes print a baseline for every §3.8 and §3.10 row.

**Cut line:** none (enabling).
**Protocol:** none (observation events only). **Saves:** none. **Outside lane:** none.

---

### nba-2 · P0 · F.4 slice #2 · The shared controls: geometry tokens, floating stick, A/B/C/D cluster, gestures on A, CALL with ISO, tap-to-pass, toast line, pause

Covers V2 F.2 #1, A.5, C.3 (buttons); NBA-12, 13, 17, 18, 27; NBA-09 (offline); the §5 table.

**Must:**
- **Shared files built to the §4.1–4.3 and §4.7 contracts:**
  - `controls-geometry.css`
  - `stick.ts` + `Stick.tsx`
  - `hud/gestures.ts`, `Cluster.tsx` (with `Radial`), `ToastLine.tsx`, `PauseButton.tsx`, `PauseSheet.tsx`, `prefs.ts`,
    `feel.ts`, `hud.css`, `index.ts`
  - `docs/studio-overhaul/shared-controls.md`: how a sport mounts them, with a 20-line example
- **Visual style (V2 C.3, mockup):**
  - A gold with a dark label; B teal; C/D dark glass with a 1.5 px stroke ring, a white SVG icon and a 10 px label
  - small direction labels around A (▲ SPIN, ◀ CROSS ▶ · ▼ STEP) drawn in SVG
  - the bottom gradient scrim
- **NBA wiring in `Hoops2.tsx`** (the new `HoopsControls.tsx` maps §5 contexts to slot specs; the loop stays in
  `Hoops2.tsx`):
  - the provisional gather on A-down (`pressShoot(p, at)` with the touch timestamp)
  - a tap cancels into `pumpFake(p)`
  - a swipe cancels into the move: crossover, step-back, spin, or euro-step when driving (new `Act` `'euro'`)
  - B's 120 ms wind-up, turning into a lob when held
  - CALL's radial with SCREEN / CUT / ISO (`callPlay(p, 'iso')`: teammates clear the strong side and the ball goes to the
    highest-usage card)
  - tap a teammate = pass, under the §5 hit rule
  - the `disabled` state recomputed from the loop as a class toggle (NBA-18)
- **Pump fake and "make him land" in `engine.ts`** (as revision 2 nba-3):
  - the bite chance from `p.rand`
  - one fake per 0.8 s
  - a descending closest defender grades the contest one tier lighter
- **The toast line** replaces the hint strip and the `.hg2-pop` banners from this task on. One-line hints, once per device
  (prefs `hints.nba`): the stick, SHOOT / pump / swipes, PASS / lob, CALL.
- **Pause (offline, F.4 slice):**
  - the pause button at the V2 position
  - `PausableTimers` replaces the `setTimeout` chain in `finish()`/`next()`
  - stepping stops (`p.t` frozen)
  - auto-pause on `visibilitychange`/`pagehide`
  - `PauseSheet` with Resume and Quit; Quit confirms, then calls `onQuit` → a defined loss
  - online: the button opens the sheet with "Online: the game keeps going" and Resume only; forfeit lands in nba-9
- **Haptics** through `feel.ts`: `tick` on the sprint edge and the CALL pick; `long` on a turnover.
- **Copy:** `Arcade.tsx`'s NBA `arc-how` text matches §5.

**Acceptance** (`scripts/audit/nba-controls.mjs`, CDP multi-touch, the 8 sizes):
- every §3.8 rect within ±2 px at 393×852 and 320×568
- gaps 10–18 px; every target ≥ 44 px; 0 overlaps; ≤ 4 right-thumb targets; none above 2/3 of the height
- the handler is never under a control at tip-off or in 30 sampled frames
- a pre-held thumb moves the handler > 1.5 ft within 300 ms of the whistle
- the stick responds in ≤ 1 frame; the sprint edge fires exactly one `tick`
- tap → `pump`; hold → the shot; L / R / D / U → cross / cross / step-back / spin; euro-step while driving
- tap a teammate → pass; B held → lob; CALL → ISO puts the ball in the star's hands within 2 s
- 0 accidental passes from stick touches
- pause: 0 engine steps and 0 timers in 10 s; marks identical after resume; quit → a loss shown
- 0 page errors; only localhost requests

**Tests:**
- `stick.test.ts`: dead zone, rescale, sprint at 1.15 R, follow at 1.6 R, home band, pre-held adoption, never-null output,
  fixed mode
- `gestures.test.ts`: 200 jittered gestures per class, ≤ 2% wrong
- `cluster.test.ts` (jsdom): `down` fires on pointerdown; two pointers are tracked
- `prefs.test.ts`: corrupt / old / missing → defaults; no other key touched
- `pause.test.ts`
- `gameplay.test.ts`: the pump fake baits by rating and never shoots; a swipe cancels the gather at no cost; ISO targets
  the top-usage card

**Screenshots:** tip-off and a mid-drive at the 8 sizes; the CALL radial; Buttons-only; a hint in the toast line; the
pause sheet. Each with its nba-1 twin, and compared with the mockup's NBA phone.

**Cut line:** the radial's open animation; the euro-step (it falls back to spin).
**Protocol:** bump needed (the pump fake, "make him land", ISO's movement, the euro-step).
**Saves:** the new touch-prefs key only.
**Outside lane:**
- `Arcade.tsx` (NBA copy)
- `PlayReadout.tsx` (an additive controlled `open` prop, so LAST PLAY moves into the bug in nba-3)
- `render.ts` (the `'pump'`/`'euro'` pose fallback lines)

**Dependencies:** shell (insets); nfl and soccer review §4 within the task (posted in `nba.md`).

---

### nba-3 · P0 · F.4 slice #3, #4, #8 · The frame: three-quarter camera, action-safe box, score bug and Heat bar, live clock, readable text, held arena

Covers V2 F.2 #3, B.1.3, C.3; NBA-08, 16, 20, 21, 22, 29; the lead's held-arena decision (V2 D.1).

**Must:**
- **Camera** (new pure `hoops2/camera.ts` plus the camera section of `render.ts`):
  - the high three-quarter half-court view: pitch ≈ 55°, yaw 12° off the rim line
  - rim at 20–24% of the height; the handler held at 50–55%
  - follow = a dead-zone blend of handler and ball with `1 − exp(−k·dt)` damping (render-side)
  - fixed zoom near the rim
  - on a shot it holds the shooter and tilts 2% toward the rim
  - anchored to `readGeometry()`'s safe box
  - zoom only in replays and in the Clutch tighten (6%)
- **The defensive camera rule** (the same orientation, so the layout never flips): the yaw sign follows the side your
  defender is not on, so the AI handler stays visible (revision 2's overlap rule).
  - Unit-tested here; measured live in nba-6.
  - V2 B.1.3's "defend from your basket at the bottom" variant ships behind `?arcade&cam=v2b` for the owner device check.
- **HUD kit, part 2:**
  - `ScoreBug` with YOU / period-clock / RIV, the 3 px possession line and the CLUTCH and OT phases
  - `HeatBar` (fed zeros until nba-4)
  - `geometry.ts`
  - LAST PLAY becomes a 44 px icon in the bug
  - the old top strip and chips are removed
- **Shot clock (NBA-08):**
  - written from the rAF loop whenever `Math.ceil(p.clock)` changes
  - ≤ 5 s: the `clockLow` warning
  - < 4 s: `sfx.tick()` once a second
  - a violation shows "0" before the toast
- **Text:**
  - `foldName` (NFD, strip combining marks, ø ł đ ß æ œ)
  - F35 gains `& / : + ' ( ) ,`
  - `uniqueTags` on collision (J.JOHNSON / M.JOHNSON)
  - `layoutLabels` priority placement
  - name chips 7 art px tall on a dark plate
  - one badge pop per possession, in the toast line, through `BADGE_LABEL`
  - the scorer plate ("CURRY · 3PT · 11 PTS") in the toast line, from `BoxTracker`
- **Pass-target % (NBA-16)** from `catchValue()` with the closeout, shown on the teal target ring with the receiver's
  name.
- **Floor cache (NBA-29):** reuse the floor `ImageData` while the camera has moved ≤ 0.5 px.
- **Held arena (§4.8):**
  - `hold` and `ArcadeHandle.rematch()` in `Arcade.tsx` (a sport-agnostic block written once, plus the NBA branch)
  - `Hoops2` re-seeds in place: new `HoopsGame`, the same renderer and sprite caches
  - the 1.5 s curtain shows the opponent
  - a stub host in `Lab.tsx` (`?arcade&hold`) runs whistle → stub 5 s sheet → rematch, for the probe

**Acceptance:**
- `nba-hud.cjs` at the 8 sizes:
  - bug, pause and Heat bar rects per §3.8 (±2 px)
  - nothing DOM-drawn intersects the projected rim ± 40 px
  - rim at 20–24%; handler at 50–55% (median of 300 frames)
  - handler and rim inside the safe box in ≥ 98% of frames
  - on-ball defender overlap ≤ 35% at ≥ 90% of releases
  - zoom variation ≤ 2% near the rim
- `nba-clock.cjs`: the bug text equals `ceil(p.clock)` at 20 Hz, with 0 mismatches longer than a frame (baseline: "8" shown
  for 7.2 s).
- `labels.test.ts`: `foldName` covers every character in `cards-nba.json` (0 misses); 0 duplicate tags across 1,000
  squads; 0 label overlaps in 1,000 frames.
- `camera.test.ts`: 30 vs 60 fps end within 0.5 px; the shooter hold moves the focus ≤ 2 ft; the defense rule's overlap
  ≤ 35% at ≥ 90% of 1,000 synthetic releases.
- `nba-rematch.mjs`: whistle → `onFinish` ≤ 0.3 s; `rematch()` → controllable ≤ 1.5 s at 4× CPU; renderer identity kept;
  heap after 5 rematches ≤ +10%; the full stub loop ≤ 10 s.
- `nba-perf.cjs`: the §3.9 frame budget at 1× and 4×.

**Screenshots:**
- a release with a visible defender
- the Clutch bug, the OT bug
- the 320 rim area
- Jokić / Dončić chips, a renamed same-surname pair
- the scorer plate
- 852 landscape
- the rematch curtain
- each next to its nba-1 twin and the mockup

**Cut line:** a floor reflection under the handler; typed-array replay snapshots (only if §3.9 fails).
**Protocol:** none (render, DOM, text, and a held-mount flow that changes no outcome).
**Saves:** none.
**Outside lane:**
- `Arcade.tsx` (the `hold`/`ref` block plus the NBA branch)
- `render.ts` (the single HUD call line, §6.1)
- `Lab.tsx` (one line)

**Dependencies:** players (the sprite budget; the venue palette is theirs); ut (the real result sheet; tested against the
stub until it lands).

---

### nba-4 · P0 · F.4 slice #5 · The gold ring, PERFECT, Heat and the grade

Covers V2 F.2 #2 and #6, B.0.1–B.0.3, B.0.5, B.1.5 #1/#3, B.1.7; NBA-14 (fixes 1–4), NBA-15; research §5.1, §5.7.

**Must:**
- **`perfect.ts` + `hud/ring-draw.ts`** to the §4.4 contract. `windowScale` is the only place multipliers meet. The
  engine's `releaseProbability`/`shoot()` read `RingSpec` from it.
- **Touch timestamps:**
  - the `TouchClock` is updated every rAF
  - `pressShoot(p, at)` / `releaseShoot(p, lag, at)`, with `lag` = prefs `offsetMs` (default 25)
- **Windows, states and range per §3.3:**
  - the ±30 ms floor
  - gold only for open/light (Legend: open), in range
  - amber for heavy, Legend-light and out of range
  - red for smothered, too far or no angle
  - **gold = make** (no block roll, no rim-out)
  - a steeper off-gold fall-off
  - fatigue shift and shrink, plus the −5% speed/burst cap below 50% energy
  - pull-up ×0.88 and +10 ms
  - rhythm ×1.2
  - difficulty `windowFactor`
- **The finish ring** (B.1.5 #3): hold A while driving and release as the ring closes at the rim, for layups and
  floaters. Dunkers with a lane dunk automatically. A PERFECT finish through contact is an and-one; the FT trip arrives
  in nba-5, and until then the and-one plays as today.
- **Drawing:**
  - the ground ring plus the arc meter, with gold ≥ 8 px
  - the gold ground ring under the controlled player, the teal ring on the pass target, the red arc on the on-ball defender
  - amber and red have their own colours
  - meter Off (pref) draws only the ground ring's colour and gets ×1.10
- **Feedback** (one toast line, no three-line chip):
  - `word · dial`, e.g. "PERFECT", "SLIGHTLY LATE · TIMING", "SMOTHERED · PRESSURE", "TOO FAR · RANGE"
  - a pre-shot coverage word ("OPEN · release on gold")
  - `missReason` (counterfactual: timing / contest / range / fatigue)
  - `play-feedback.ts basketballFeedback` gets the same facts (the nba function only)
- **The 4-tap calibration:**
  - `TimingCalibrator.tsx`, built on `perfect.calibrate()`
  - it writes `offsetMs` and shows the player's own σ
  - offered once before the first match on the device (skippable), and from the pause sheet
- **`heat.ts`** to the §4.5 contract:
  - `HoopsGame.heat: { us, them }`
  - gains from the engine's events (PERFECT, basket, clean ≥ 2 passes, turnover) in the race now; stops and conceding in
    nba-6
  - On Fire: `heatWindow` through `windowScale`; amber → gold for uncontested attempts; 2 possessions
  - the half-time reset
  - removes `g.fire`/`fireAt`; the Heat Check badge now gains +16 per PERFECT, instead of +12, by that player, published
  - HEATING UP gives a ball trail and a crowd lift; ON FIRE gives flames on the ball and a court-edge glow, and the first
    On Fire score triggers the slow-motion replay
- **The grade** (§4.8): `hud/grade.ts`, plus `Progress.grade` and `Progress.box` (optional, stripped from the wire),
  filled at the final.
  - `perfects` = PERFECT releases, finishes and boards
  - `moments` = gold rings offered and attempted
  - `bestHeat`, `fires`, and `ppu` against the par for the rung
- **Juice:**
  - PERFECT: a 1-frame hit-stop, the gold arc flash, `double` haptic, `sfx.perfect(streak)`
  - a ring-fill tick in the last 200 ms
  - a net snap on every make (3 frames of net stretch)
  - all through `juice.ts`; reduced motion keeps the flash and the sound
- **Practice:** a drill's `green` counts `perfect`, so The Green Room stays completable.

**Acceptance:**
- `perfect.test.ts` (closed-form over the Gaussian, no sampling):
  - every §3.3 window and gold-rate band at σ 50, and the σ 35 ceilings
  - the floor holds after the worst shrink stack (Legend × heavy fatigue × pull-up)
  - the worst grow stack ≤ ×1.45 and ≤ ±90 ms
  - pull-up ≤ 0.90 × catch-and-shoot
  - range gates by THR
  - above-99 values finite and ≤ +5 ms
- **Honesty test:** 10,000 seeded gold releases (jumpers and finishes) → 10,000 makes, 0 blocks. 0 gold states drawn on
  heavy or smothered.
- A release between two steps gives |off| < 1 ms.
- `nba-meter.cjs`: the gold band ≥ 8 px at 320 and 393 for THR 55 open; amber in heavy range; red when smothered; the
  toast sequence after a scripted release; the pop seen with `no-preference` and absent with `reduce`.
- `heat.test.ts` (shared): every gain and loss; the stage thresholds; the spell length per sport; the half reset; integer
  only (source scan); `pick` for the per-sport values.
- `game.test.ts`: On Fire widens by exactly ×1.25 through `windowScale`; amber → gold only for open attempts.
- `grade.test.ts`: the letter thresholds; FLAWLESS; `Progress.grade` survives the host path and is absent from the
  `arcadeOf` wire.
- Feel spy test: `double` on every PERFECT, `long` on a score; 0 haptics while paused.
- `calibrator.test.ts`: offset and σ from synthetic taps; outlier drop.
- Human harness report (15 games): green rate per contest and Heat stage rates (asserted in nba-10).
- `ratings-matter.test.ts`: the shot-curve block replaced (documented); every monotonicity test green.

**Screenshots:** open / light / heavy (amber) / smothered (red) / out of range (RANGE) rings at 393 and 320; a tired
shooter; the PERFECT toast; the HEATING UP trail; the ON FIRE flames; the calibrator; the finish ring.

**Cut line:** meter Off mode; the court-edge glow (the flames stay).
**Protocol:** bump needed (windows, states, gold = make, range gate, fatigue, pull-up, finish ring, Heat replacing `fire`).
**Saves:** prefs `offsetMs` and `meter` only.
**Outside lane:**
- `progress.ts` (two optional type lines)
- `play-feedback.ts` (the nba function)
- `juice.ts` (nba usage only)
- `ut/Match.tsx` (one line: keep `grade`/`box` on the progress it settles)

**Dependencies:** ut (haptics, `heartbeat`); soccer (`sfx.perfect`); shims in `feel.ts` until those land.

---

### nba-5 · P0 · Every point and every miss: fouls, free throws, turnovers, real misses, rebounding AI, the BOARD ring

As revision 2 nba-5 (NBA-01, 04, 11, 24; audit §5 rebounding; research §5.5–5.6), with V2's ring and juice.

**Must:**
- **`era.ts` stub**, returning neutral factors until nba-8.
- **Fouls:**
  - `foulChance(kind, contest, shooter, defender, defIQ, era.foul)`, arithmetic only: drives and finishes 12–18%, heavy
    jumpers 2–3%, threes ~1%; up with STR and the new optional `Hooper.fd`
  - and-ones (2+1, 3+1); 2 or 3 FTs on a miss
  - team fouls per half, with the bonus from the 3rd team foul
  - reach-in fouls
- **The FT band meter** (V2 B.1.5 #7, §5 FT row):
  - hold A; the marker rises over ≤ 2 s; release in the band
  - the band's half-width is set by FT rating, so σ 50 lands within ±6 points of `freeThrow(rating)`
  - online auto-shoots after 4 s idle; the AI, sims and skip use `autoFreeThrow`
  - for Heat, a FT trip that scores at least 1 point counts as one score event (+10); a trip never adds more than that
- **Marks:** `'4'` and `'F0'…'F3'`; `markPoints()`, `NBA_MARK_LABEL`; consumers `Arcade.tsx` POINTS (nba branch),
  `ut/Match.tsx` (one line), `ut/match-debrief.ts`.
- **Turnovers:**
  - directional steals; reach-in ×0.4 when the handler separates, ×0.2 from behind
  - a failed poke stuns 0.25 s
  - the pass lead uses the receiver's path (no "PASS OUT OF REACH" to a teammate who changes direction)
- **Real misses (NBA-24):**
  - front rim / back rim / glass / airball, chosen by the deciding uniform; airballs only for heavy+ or |off| > 150 ms
  - caroms: threes 6–14 ft, rim attempts 3–8 ft
  - the rim rattle and an "ooh" on rim-outs; the rim, glass and net sounds
- **Rebounding AI:** a noisy, converging landing estimate (the user's assist uses the same one); box-outs by the two
  nearest each side for 0.4 s.
- **The BOARD ring** (V2 B.1.5 #6) uses `perfect.ts`: the ring closes on the ball's last drop toward your nearest man's
  ideal jump. A gold tap = a PERFECT board: +25% reach radius, `double`, +12 Heat. Ratings and height still decide.
- **Box data to hosts:** `onBoxScore`; `Progress.box` filled.
- **Practice rules:** no fouls or FT trips; no box-out requirement.
- Delete `void shooter` (NBA-11).

**Acceptance:**
- `fouls.test.ts`: bands by situation; monotone in STR/`fd` (up) and discipline/`defIQ` (down); the bonus; marks ↔
  points; the online FT auto-shoot after 4 s; airballs only under the stated conditions.
- `rebound.test.ts`: the estimate error shrinks as the ball drops; box-outs seal ≥ 0.3 s in ≥ 70% of misses; a gold board
  is +25% reach and nothing else; the assist never reads the exact endpoint.
- Calibration report (15 games/config, report only): FTA/FGA, FT%, and-ones, TOV% by rung, steals 50–65% of turnovers,
  "PASS OUT OF REACH" < 1%, ORB%, three misses landing ≥ 10 ft.
- Human harness: straight-drive strips ≤ 7% on Pro and ≤ 10% on Legend; the FT meter within ±6 points at σ 50; BOARD at
  σ 50 adds +3 to +6 ORB% points over not jumping.
- `ratings-matter`: FT 90 > 75; `fd` 90 draws more fouls; REB still matters.
- `moments.test.ts`: drills within ±5 points of baseline; 0 FT trips in practice.

**Screenshots:** the FT meter (portrait, landscape, 320); the 3+1 toast; a front-rim miss and a glass miss; a box-out;
the BOARD ring and a PERFECT board.

**Cut line:** charges (they move to nba-7's contact rules if time allows); out-of-bounds turnovers.
**Protocol:** bump needed. **Saves:** none.
**Outside lane:** `Arcade.tsx` (POINTS, nba branch), `ut/Match.tsx` (one line), `ut/match-debrief.ts`.
**Dependencies:** ut (labels, box consumer); players (FT routine pose, falling back to idle).

---

### nba-6 · P0 (owner decisions 2 and 3) · Defense played by default: four quarters, Auto-defend, SIM, the rival's real score, OT, Clutch

As revision 2 nba-6 (NBA-06, 07), with V2's format and staging.

**Must:**
- **`newHoopsMatch(us, them, usBench, themBench, seed, { possessions = 16, clock = 14, startersOnly = false, defIQ, aiSkill })`:**
  - linked energy and subs across both ends
  - **quarters of 4 + 4, Clutch = the last 2 + 2 of Q4, OT 2 + 2** repeated (cap 10)
  - seeds `'h2:'`/`'ai:'`; the race's `aiPossessionsOf` stays byte-identical
- **`Hoops2` `format: 'race' | 'alternate'`, `aiSkill`, `onRival`:**
  - your possession, then theirs: the autopilot with the rival's cards; your five defends
  - your controlled defender `Possession.userD` is steered with the shared `Stick`
  - idle = the existing `defend()` (idle-assist, never worse than today's AI)
  - hands go up automatically within 4 ft
  - the bug shows "Q2 · 3/4" on the possession line
- **Heat at both ends:** stops (+15), conceding (−10) and the AI's own Heat by the same rules. The rival's bar is visible
  in solo.
- **Auto-defend** (prefs `autoDefend.nba`; on ut's pre-game screen and in the pause sheet): defensive possessions play
  themselves at 3× with a ticker.
- **SIM chip** (44 px): the same headless engine path as Auto-defend.
- **Reward integrity:** `how: 'played'` with Auto-defend and SIMs in `manualOnly` modes (tested, confirmed with ut).
- **`Arcade.tsx` (nba branch):**
  - every AI-rival path (including the queue fallback) uses `alternate`
  - `shown`/`them` come from `onRival`
  - online stays `race`, untouched
- **Ties:** OT in both formats. `simHoopsMatch()` (headless, idle-assist defense, with OT) feeds Arcade's SIM IT and
  `ut/Match.tsx simBoth` (the nba line only), so `decide()` never sees an NBA tie.
- **Clutch staging (V2 B.0.4)**, presentation only, with no rule change:
  - the bug turns gold and reads CLUTCH
  - the crowd bed rises
  - the camera tightens 6%
  - `heartbeat` when the margin is one score
  - "FOR THE WIN" when the final possession can tie or win, and it always gets the replay
- **Grade par per rung** (§3.14) from the host's level; online uses Pro.
- **Defensive feedback (minimal):** the toast after each AI possession ("OPEN 3 · your man 7.2 ft away").
- **RUN** is text only: "RUN 8-0" in the toast after 3 straight scoring possessions.
- **Kits per possession** (§6.1); a `?arcade&def` lab hook.
- **Hints:** "Defense: steer your man · or tap AUTO / SIM".

**Acceptance:**
- `game.test.ts`: linked arrays; quarter, Clutch and OT indices; in `alternate` the rival's score = the points of the
  played AI possessions; 200 forced ties → OT with 0 rating decisions; the race `aiPossessionsOf` byte-identical over 50
  seeds; Heat stop and conceded events.
- `defense-format.test.ts`: idle-assist drifts ≤ 0.5 ft over 5 s from the AI path; SIM ≡ Auto-defend; `how: 'played'`;
  opt-in 300-game SIM vs Auto-defend win % within ±5.
- `nba-alt.cjs` (UT Squad Battles fixture):
  - a full solo game with the median-human script at 1× lasts **4:00–6:00**, broken down by §3.4 part
  - Auto-defend and all-SIM lengths reported
  - defensive camera overlap ≤ 35% at ≥ 90% of AI releases at the 8 sizes
  - your defender never under a control
  - frame budget during defense
  - the draft head to head vs AI alternates
  - Clutch staging seen in Q4's last 2 + 2
  - 0 page errors
- Human harness (alternate): median defender ≤ Auto − 0.03; poor ≤ Auto + 0.12 (re-asserted in nba-10); Heat stage rates
  reported against §3.7.
- Online regression (`online.mjs` under the lock): two clients still race and settle one win and one loss.

**Screenshots:** a defensive possession (portrait, landscape, 320); the Auto-defend ticker; the SIM chip; the Clutch bug
with "FOR THE WIN"; the OT bug; the rival's Heat bar.

**Cut line:** quarter-break toasts; "watch at 1×" during Auto-defend (the ticker stays).
**Protocol:** bump needed (OT, Heat at both ends; the format itself is solo-only).
**Saves:** prefs `autoDefend` only.
**Outside lane:** `Arcade.tsx` (nba branch), `ut/Match.tsx` (`simBoth` nba line), `Lab.tsx` (one line), `render.ts` (kit
mapping at the call site).
**Dependencies:** ut (the pre-game screen, `how` semantics, the result sheet reading both sides' box); nfl (the same
`onRival` shape); players (kits).

---

### nba-7 · P0/P1 · The duel at both ends: CONTEST and STEAL rings, SWITCH, the ankle-breaker, movement feel, moves and pips, transition

Covers V2 F.2 #5 and #7, B.1.4, B.1.5 #2/#4/#5, B.1.6's control frames; STREAM moves, fast breaks; NBA-24 ramps; NBA-01
intentional fouls; research §5.4–5.5.

**Must (P0 first):**
- **Defense buttons (§5):**
  - **CONTEST** (A, jump on down): a ring closes on the shooter as he rises. Gold = a PERFECT contest (the lowest grade the
    geometry allows, a block chance by BLK/VRT/height, +12 Heat). Early = landing at the release, or a shooting foul on a
    late, close jump.
  - **STEAL** (B): a 150 ms gold flash on the ball when it is exposed (during a crossover, or on a lazy pass). A tap inside
    it = a PERFECT steal (a clean strip, no foul roll, +12 Heat). Outside it, a low chance and a reach-in foul that grows
    when repeated inside 1 s. Cooldown 0.6 s.
  - **SWITCH** (C): to the man nearest the ball.
  - The AI pump-fakes a defender who leaves his feet early.
- **Movement feel (V2 B.1.4)**, as engine constants in lookup tables:
  - 0 → top speed in 0.30 s (ACC 95) to 0.55 s (ACC 60)
  - top speed with the ball 13 ft/s (SPD 60) to 17 ft/s (SPD 99)
  - a direction change > 90° costs 35% of speed at AGI 60 and 12% at AGI 95
  - big men carry further before stopping
  - chest-to-chest contact slows the handler to 40% and starts a 0.4 s bump; STR + momentum beats it (bully-through
    stays)
- **Moves:**
  - velocity ramps over 3 steps (50 ms); no single-step Δv > 0.5 × top speed
  - control returns at the V2 B.1.6 frames: crossover 9 f, step-back 13 f (SHOOT buffered from 6 f), spin 12 f, pump 6 f,
    euro-step 12 f
  - cancellable by shoot or pass ≥ 150 ms after the start
  - tiers by handle: < 60 / 60–84 / 85+ (travel 60 / 80 / 100%; the defender loses 0.15 / 0.30 / 0.45 s)
  - **3 pips** per possession, refilled by a pass, a new possession, or On Fire starting; a 4th move is slow and loose
  - pips show as dots on A
- **The ankle-breaker (V2 B.1.5 #2):**
  - when the on-ball defender lunges or reaches, a 150 ms gold flash rings his feet
  - a crossover or step-back started inside it = a PERFECT move: he plays `slip`/`stumble` for 0.8 s, with `double` and
    +12 Heat
  - emitted as `ankles-perfect:<idx>`
- **Transition (promoted, V2 B.1.1):**
  - `newPossession(..., start: 'half' | 'break')`: after your steal or a long defensive rebound (≥ 12 ft carom), your
    next possession is a 3-on-2 (or 2-on-1) with 7 s on the clock
  - the AI's steals feed its breaks too
  - the race (online and sims) gets a seeded 8–10% break share from the `'break:'` stream, identical on both phones
- **Intentional fouls** (revision 2 rule): the last 2 possessions, the AI trailing by 3–6, the user in the bonus; they go
  to your worst FT shooter.
- **Defensive feedback:** `defenseReason()` (late jump / early jump / your man N ft away / beaten off the dribble / switch
  mismatch) in the toast and in LAST PLAY's defensive branch.
- **`practice.drill: 'defend'`** ("N stops in M possessions") for ut's defensive Moment.
- **DROP** as an AI scheme the AI picks for your five (no chip). BOARD at the defensive end.

**Acceptance:**
- `defense.test.ts` (75 vs 75):
  - SWITCH picks the man nearest the ball
  - STEAL: a gold-flash tap at σ 50 strips 30–45% with no foul; untimed ≤ 8%; repeated inside 1 s fouls 25–35%
  - CONTEST: gold rate 35–55% at σ 50 over 600 jumpers from ≤ 4 ft; a PERFECT contest never grades lighter than heavy
  - an early jump ≥ 200 ms downgrades the contest
- `moves.test.ts`:
  - travel 100 / 80 / 60% ± 5% by tier; lost step 0.45 / 0.30 / 0.15 s
  - control returns at the B.1.6 frames ± 1
  - a 4th move without pips is slow
  - a cancel at ≥ 150 ms starts the shot
  - max Δv ≤ 0.5 × top speed per step
  - 0 → top speed in 0.30 ± 0.03 s (ACC 95) and 0.55 ± 0.05 s (ACC 60)
  - the turn penalty at AGI 60 / 95
- `transition.test.ts`: race break share 8–10%, identical across two runs; alternate transition share 12–17% with PPP
  1.15–1.35 (report; asserted in nba-10).
- Defender policies over 600 AI possessions (Pro): median ≤ Auto − 0.03; poor ≤ Auto + 0.12; good contester ≤ idle −
  0.06; early jumper ≥ idle + 0.05; steal spammer fouls more with PPP ≥ idle.
- Human harness: cross-drive with pips ≥ 0.85 PPP; PERFECT ankle-breakers 10–30% of moves at σ 50 (report).
- `nba-def.cjs`: the defense cluster per §3.8; CONTEST jumps within 1 frame; your defender never under a control; the
  frame budget; 0 page errors.

**Screenshots:** the defense HUD (portrait, landscape, 320); a PERFECT contest / block; the STEAL flash; a reach-in foul;
the ankle-breaker flash and stumble; elite vs basic crossover; pips; a 3-on-2 break.

**Cut line (P1):**
- the lob ring (B held with a cutter: one ring for the pass and the dunk); the lob stays as today
- zone 2-3
- early offense after long offensive rebounds
- the repeat-move decay

**Protocol:** bump needed (moves, pips, ramps, movement constants, contact, transition, defense outcomes).
**Saves:** none.
**Outside lane:** `play-feedback.ts` (the nba defensive branch).
**Dependencies:** players (crossover, step-back, spin, euro, contest, reach, stumble/slip poses per B.1.6; existing poses
as the fallback).

---

### nba-8 · P0 · Who shoots and how eras play: shot value, usage with ISO, eras, the four-rung ladder, the AI playbook

As revision 2 nba-8 (NBA-02, 03, 05, 19; audit §5 AI offense). **Mechanisms with local acceptance only; the §3 bands
are asserted once, in nba-10.**

**Must:**
- **Shot value:** mid and close fall toward their targets; rim finishes rise (a lookup table, no `pow`); the value order is
  rim > corner three > above-break three > mid.
- **Usage:**
  - optional `Hooper.usg` from real data
  - `usageShares()` in the dependency-free `hoops2/usage.ts`
  - the autopilot weights touches to real shares (star 28–35% of FGA, soft cap 36%)
  - **ISO** (the user's CALL and the AI's Iso Star play) feeds the top-usage card
  - build-up rule: no heavily contested three before 5 s of the clock unless < 4 s remain
- **Eras (`era.ts`):** three-point appetite by decade (pre-1980 ×0.05 plus the late-clock rule, 1980s ×0.35 … 2020s
  ×1.0), pace, post-ups, mid tolerance, turnover, crash and foul factors. No displayed rating changes.
- **The four-rung ladder:**
  - difficulty changes only the AI's side (`userDefenseIQ` shared with nfl in `difficulty.ts`)
  - the table-interpolated, monotone `releaseSd(skill)`
  - the continuous `windowFactor`
  - **the gold-offer gate by rung** (§3.3: Legend offers gold on open looks only)
  - all four UT rungs plus Club Season's adaptive skill covered
- **AI playbook (`hoops2/plays.ts`):** High Pick, Iso Star, Drive and Kick, Post Feed, Floppy, Horns, from the existing
  primitives. Picked by archetype and era. The AI uses SPIN / CROSS / STEP by tier; bigs get set post-ups.
- **Hot and cold zones (P1, V2 keeps them):**
  - `Hooper.zones` from real splits vs that season's league average
  - the effect (lethal +5, hot +3, cold −2 points) goes into the off-gold make chance and the amber cap, never into gold
  - shown as a faint floor glow for the handler only (V2 B.1.8)

**Acceptance:**
- `era.test.ts`, `usage.test.ts` (shares sum to 1; the soft cap; source scan: no imports beyond types), `plays.test.ts`
  (actors reach their spots within 3 s; plays never change a Hooper or ring inputs).
- `difficulty.test.ts`: `releaseSd` monotone over [0.42, 0.94]; `windowFactor` continuous; the gate by rung.
- `toHooper-fields.test.ts`: `usg`, `yr`, `fd` and `zones` survive packs' `toHooper`.
- `ratings-matter`: usage follows creation ratings; the star takes the most shots; a hot zone never lowers makes; each
  rung is harder than the one below.
- Provisional report (`NBA_CAL=1`, 60 games/config):
  - era order (pre-1980 3PA/FGA ≤ .05)
  - concentration rows (usage 25–36%, top scorer ≤ 45%, ≥ 3.5 scorers, PG time ≤ 45%, C slot 3PA ≤ 10%)
  - 0 heavy threes before 5 s with > 4 s left
  - for 90 v 75: 3PA rate ≤ .55, heavy+smothered ≤ 50%, passes ≥ 1.0, seconds ≥ 6
- Human harness: ISO puts the top-usage card on 28–35% of the human's FGA when used on every possession.

**Screenshots:** a hot-zone glow, a cold mark, an AI post-up, an AI spin.

**Cut line:** hot/cold zones as a whole (data, effect and glow ship together or not at all); the Horns and Floppy plays.
**Protocol:** bump needed. **Saves:** none (derived fields).
**Outside lane:** `difficulty.ts` (nfl's helper name), `Arcade.tsx` and `ut/Match.tsx` (pass `userDefenseIQ` in the nba
lines).
**Dependencies:** nfl (`difficulty.ts`), packs (`toHooper`), ut (`usageShares()` for `league.ts`).

---

### nba-9 · P0 · Match flow and online: online OT and forfeit (design first), online pause, the tip-off curtain, the box sheet

As revision 2 nba-9 (NBA-06 online, 09, 10, 30), with the offline pause already in nba-2 and the result screen now ut's.
**Order inside the task:** (1) the design note, committed alone; (2) online OT and forfeit with the matrix; (3) the online
pause sheet and full pause items; (4) the curtain and the box sheet.

**Must:**
1. **`docs/studio-overhaul/nba-online-ot.md`:**
   - `matchState(mine.ends, theirs.ends) → { need, over, winner }`, with `need = 16 + 2m`
   - a monotonic `done`
   - `rivalLive` and `finishedFrom` slice to `need`
   - the stall and gone timers key on "mine reached `need`, theirs hasn't"
   - the `'FF'` forfeit
   - ≤ 37 ends
   - every changed `Arcade.tsx` line listed and announced to nfl
2. **Online OT and forfeit** built from the note. QA-only hooks behind `ns=inspect` on localhost can force a tie, a stall
   or a forfeit. `scripts/audit/nba-online.mjs` runs the §3.12 matrix.
3. **The pause sheet, complete:**
   - Resume, Controls help (a §5 diagram), Calibrate, meter mode, Auto-defend, Sound and Haptics (`withSettings`), Quit
   - online: "the game keeps going" and Forfeit with a confirm → `'FF'`
   - "Today 27 min · next reward at 30" when ut's minutes API is present (V2 E.9 #2; optional prop, absent otherwise)
4. **Start and end:**
   - skip `loadAttrs()` when fives are given
   - the 1.5 s skippable curtain: both fives with numbers and names and one controls reminder; the same curtain as
     `rematch()`
   - players' clip preload during it
   - `kickoff={false}` from hosts with a pre-game screen
   - between possessions a tap advances
5. **`hud/BoxSheet.tsx`** (shared, generic columns):
   - NBA columns PTS FG 3P FT REB AST STL BLK TO PF PERFECT
   - a sticky name column scroller at 320
   - a "real-game pace ×6.2" toggle
   - player of the game by game score, with his line
   - opened by ut's BOX SCORE button from `Progress.box`

**Acceptance:**
- `arcade-ot.test.ts` (pure): `matchState` tie → 18 → 20…; `done` monotonic; a takeover with OT gives the same score on
  both phones; `'FF'` ends at once and is never inferred from a missing field; ≤ 37 ends.
- `nba-online.mjs`: tie → OT on both; OT + stall; OT + forfeit; OT + 30 s in the background. 0 mismatches in 20 seeded
  runs, plus the old race regression (one win, one loss).
- `nba-match.cjs`:
  - the pre-game flow per §3.10 (≤ 2 taps, ≤ 3.5 s; the curtain skipped in ≤ 0.3 s)
  - a UT mount without the 1.1 MB attrs load
  - the online pause doesn't freeze; forfeit → a loss here, a win there
  - the box sheet at 320 with no page scroll and text ≥ 10 px
  - 0 page errors
- `pause.test.ts` extended: `withSettings` touches only `settings.sound/haptics` and keeps a just-settled UT state.

**Screenshots:** the pause sheet (393, 320, landscape); the online forfeit confirm; the OT bug on both phones; the
curtain (and its reduced-motion version); the box sheet at 320 and 393; the POG.

**Cut line:** the POG's mini replay; a landscape-specific box layout; the controls diagram (text instead).
**Protocol:** bump needed (OT possessions and `'FF'` on the wire; the takeover with OT).
**Saves:** none.
**Outside lane:**
- `Arcade.tsx` (the shared online paths, design-noted)
- `App.tsx` (settings listener, forfeit mapping)
- `ut/Match.tsx` (forfeit → won)
- `evolution/Training.tsx` (`onQuit`)

**Dependencies:** nfl (the same OT/forfeit shape); ut (forfeit settlement, the in-progress marker, BOX SCORE); shell;
players (clip preload); lead (`arcadeOf` unchanged).

---

### nba-10 · P0 + P1 · Daily Play (P1, cut first), the single global fit, final QA and handoffs

**Must (in this order):**
1. **The NBA Daily Play** (P1, V2 D.3; cut first if the session overruns). `hoops2/daily-play.ts`:
   ```ts
   export interface DailyPlay { id: string /* 'nba:<ET day key>' */; title: string /* "Down 2 · 14 s · ball in Curry's hands" */;
     us: { ids: string[]; star: string }; them: { ids: string[] }; start: { you: number; rival: number; clock: number; possessions: 1 | 2; startAt: 'half' | 'break' };
     goal: 'win' | 'tie-or-win'; par: { seconds: number; perfects: number } }
   export function dailyPlayFor(day: string): DailyPlay;     // seeded from 'daily:nba:' + day; real era squads from the draft data; same for everyone
   export function scoreDailyPlay(r: { won: boolean; perfects: number; seconds: number }): { score: number; stars: 0 | 1 | 2 | 3 };
   ```
   - `Hoops2` gets a `scenario` prop: the start state and 1–2 possessions; no curtain, alternation or OT
   - a pool of ≥ 30 hand-written scenario templates (down 1–3, 8–24 s, end-of-quarter heave, defend-the-last-shot)
     filled from real era squads
   - ut hosts the three attempts, the board and the share card
2. **The global fit.** Named knobs only:
   - `releaseSd` anchors, `windowFactor`
   - the off-gold fall-off and amber caps
   - the foul and steal bases
   - break share, box-out timing
   - era factors
   - Heat gains (only if §3.7 fails; the Help text is updated with them)

   Iterate at 15 games, then accept with `NBA_CAL=1 NBA_CAL_ASSERT=1` at **150 games/config** for every row in §3.1,
   §3.1b, §3.2, §3.3 (gold and make bands), §3.5, §3.6, §3.7 and §3.14, plus the per-player sanity rows. The human harness
   covers all four rungs. `ratings-matter` stays green. Moments bands go to ut. At most 6 acceptance runs through heavy.sh.
3. **Handoffs in `nba.md`:**
   - the score scale per 16 (alternate and race) for `ut/league.ts` and `engine/broadcast.ts`
   - the Moments bands
   - the tie copy
   - `BADGE_LABEL`
   - the published Heat numbers
   - the lead's post-merge re-check (`NBA_CAL=1 NBA_CAL_GAMES=60` on the integration branch after packs' re-rate, plus a
     1-hour knob re-fit if a §3.1 row leaves its band)
4. **Final QA:**
   - `npm run typecheck`, the full `npm test` once and one `npm run build`, all through heavy.sh
   - every `scripts/audit/nba-*` at the 8 sizes in both reduced-motion modes
   - the shared `scripts/qa/core-gameplay.mjs`, `gameplay.mjs`, `play-feedback.mjs` and `online.mjs` through
     `nba-qa-run.mjs`
   - the online matrix again
   - the §3.4 game length re-measured
   - the §3.9 frames in offense, defense, FT trips, replays and On Fire
   - bundle and test-time budgets
   - the §3.10 rematch loop end to end with ut's real sheet, if it is in the branch
5. **Docs:**
   - `ARCADE-V2.md` (format, length, defense, Clutch, Heat)
   - `CORE-GAMEPLAY.md` (the §5 table, the gold ring, BOARD, FT, defense)
   - `GAMEPLAY-RATINGS.md` (the §3.3 model, eras, usage, the ladder)
   - `shared-controls.md` final
   - the complete `nba.md`, with the final line "Protocol bump needed: NBA draft 10 → 11, UT NBA 10 → 11 because …"

**Acceptance:**
- Every asserted band above passes at 150 games/config, each number next to its nba-1 baseline in `nba.md`.
- `daily-play.test.ts`:
  - the same day gives the same scenario on two runs
  - 365 consecutive days give ≥ 30 distinct templates
  - every scenario is winnable by the autopilot in ≥ 25% of 200 runs and ≤ 85%
  - its chunk stays out of main
- Full `npm test` green. Build OK. Main chunk +0 KB. Game chunk ≤ +18 KB gzip. UT ≤ +2 KB.

**Cut line:** Daily Play (P1).
**Protocol:** bump needed (fit values).
**Saves:** none.
**Dependencies:** lead (integration, the bump, the re-check); ut (Daily Play host and board).

---

## 9. Deferred and cut, with reasons

1. **Cut by V2:** play and look cards; the defensive look chip; per-player two-stage Heat; RUN's window factor; nba's
   own haptics module; the in-game final overlay; the 10-tap calibrator; HOT HAND / LOCKED IN names (§0).
2. **Players' work:** NBA-23 foot sliding, NBA-24 pose cross-fades, NBA-25 30/15 fps clips, NBA-26 looks, 5-head sprites,
   crowd rows, venue palette, celebrations. nba exposes every act and event they need (§4.6).
3. **Gauntlet and draft season/playoff games as arcade matches:** the owner-decision-2 conflict stays escalated (revision
   2 §4.1). The engine format is ready for any host.
4. A button-layout editor and a left-handed mirror (V2: "a later setting").
5. A ticking 12:00 game clock. The format counts possessions.
6. Shared real-time defense online: not possible over relays. Online keeps the race.
7. Per-player shot-DNA timing offsets. They would move the fitted windows; next round, with players' motion DNA.
8. The NBA-28 soundscape (announcer, chants, music). Sounds come only through soccer's `sound.ts` additions.
9. The NBA-30 chunk split. `vite.config.ts` is shell's; flagged.
10. A 4-point zone and modifier weekends. They need a protocol and a queue (V2 D.9: solo only, unless the lead commits).
11. **Cut-line items** (shipped only if the task's Must list is green within its session; otherwise listed in `nba.md`):
    - nba-2: the radial animation, the euro-step
    - nba-3: floor reflection, replay snapshots
    - nba-4: meter Off, the court-edge glow
    - nba-5: charges, out-of-bounds turnovers
    - nba-6: quarter toasts, watch-at-1×
    - nba-7: the lob ring, zone 2-3, early offense, repeat-move decay
    - nba-8: hot/cold zones, Horns, Floppy
    - nba-9: the POG replay, the landscape box, the controls diagram
    - nba-10: Daily Play

## 10. Risk register

Revision 2's rows stand. V2 adds these:

| Risk | Mitigation | Checked in |
|---|---|---|
| nfl and soccer build their own stick or ring before ours lands | §4 contracts published in nba-1 (`nba.md`), shims allowed, signatures frozen, a "Contract changes" log | nba-1, nba-2, nba-4 |
| ±30 ms gold floor pushes human makes far above real rates | the gold-offer gate (contest, range, rung), off-gold fall-off and AI release spread; box realism asserted on AI-vs-AI and the human PPP ladder; the divergence documented | nba-4, nba-8, nba-10 |
| "Gold never lies" broken by a stray block or rim-out path | the honesty test: 10,000 gold releases, 0 misses, in every sport that consumes `perfect.ts` | nba-4, nba-5 (board), nba-7 (contest, steal) |
| Heat snowballs (On Fire → easy scores → more Heat) | spell of 2 possessions, bar back to 0, half reset, §3.7 bands including On Fire PPP ≤ +0.25 | nba-4, nba-6, nba-10 |
| Interpolated geometry wrong on 375/430 or in landscape | the 8-size probe; `.ps-geo.land` class; no media queries | nba-2 |
| The held arena leaks memory or stale state between matches | renderer identity and heap test across 5 rematches; a `HoopsGame` rebuilt from scratch each time | nba-3 |
| `progress.ts` is unowned and also read by nfl, soccer and ut | two optional type-only lines, stripped before the wire, listed outside lane, lead review | nba-4 |
| ut's haptics or soccer's chime don't land in our branch | `feel.ts` shims with the same signatures; one-line swap at integration | nba-2, nba-4 |
| Defensive camera variant (V2 B.1.3 "your basket at the bottom") is ambiguous | ship the same-orientation rule by default and the V2 variant behind `?arcade&cam=v2b`; owner device check decides | nba-3, nba-6 |
| Daily Play eats the fit's time | Daily Play is first in nba-10 but is the cut line; the fit is never cut | nba-10 |

## 11. Owner device checks (filled in `nba.md` as tasks land)

- **Controls:**
  - thumb reach of the V2 cluster and stick on the owner's iPhone, portrait and landscape
  - the sprint ring push
  - swipes on A vs Buttons-only
  - CALL radial reach
- **Ring:**
  - the 4-tap calibration offset and the owner's own σ (< 35 ms → the lead revisits §3.3)
  - whether gold feels fair for an average shooter and clearly fatter for a star
  - `timeStamp` sanity
- **Feel:**
  - the `double` vs `long` haptics, the PERFECT chime ladder
  - the On Fire spell length
  - Clutch staging and the heartbeat
- **Defense:**
  - the stick, CONTEST and STEAL rings, SWITCH, Auto-defend and SIM
  - **the defensive camera variant** (default vs `cam=v2b`)
- **Flow:** solo game length; the tip-off curtain; the rematch loop ≤ 10 s; pause on a real phone call.
- **Display:** accented names (the NFD fold on WebKit); the safe box under the Dynamic Island once shell's Fix A merges.
