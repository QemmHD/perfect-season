# Team nfl: build plan (studio overhaul), revision 3 (Game Design V2)

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, dev-server port **5216**. Cut from `claude/studio-overhaul` = main `acdf3e2`.
`O` below means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**What revision 3 is.** The owner asked for a redesign "by a huge margin". The lead designer's `O/design-v2/GAME-DESIGN-V2.md` is now binding for this team, under the owner decisions in `O/BRIEF.md`. Revision 3 rebuilds the task list around V2 §F.2 "nfl":
- the first-impression slice (§F.4) goes first;
- the V2 cuts are applied;
- every audit P0 fix that V2 does not replace is kept.

Revision 2 (commit `5745ed6`) answered an independent critique point by point. Its response map is not repeated here. Every point it placed still has a home below, or is listed as superseded by V2 in §12.

**Read in full for revision 3:**
- `O/BRIEF.md` (owner decisions and the V2 section)
- `O/BUILD-RULES.md`, `O/OWNERSHIP.md` (including the V2 grants) and `O/STREAM-nfl.md`
- `O/design-v2/GAME-DESIGN-V2.md` (all of it; §F.2 "nfl" is the team list)
- `O/design-v2/research-engagement.md`
- `O/design-v2/mockups.html` (opened in Playwright from `file://`, all of it screenshotted and looked at)
- `O/DESIGN-V2-DECISIONS.md`
- the repo `CLAUDE.md`
- the team doc `nfl.md`
- the nfl-1 fast baseline in `nfl-calibration/`
- `nba-plan.md`: it has no V2 interface contract yet, so §4 states the one we build against.

**Lead decisions that shape this plan** (`DESIGN-V2-DECISIONS.md`):
- Burst moves onto the stick ring by default, with a "Burst button" preference that restores the old layout. This is an owner device check.
- Big-head sprites are approved. They belong to players; we size the camera for them.
- There is ONE release. §F.4 is the build order and the must-not-slip list.
- `controls-geometry.css` and the arena staying mounted through the result sheet move from shell to **nba**.
- `playtime.ts`, `haptics.ts` and the board branches move to **ut**.

The team doc is `docs/studio-overhaul/nfl.md`. Every task appends to it:
- what changed and why, with measurements
- "Protocol bump needed"
- "Touched outside my lane"
- the cross-team contracts
- "Merge steps for the lead"
- owner device checks
- what was left undone

---

## 1. Goals

**Binding owner decisions:**
- **OD-2:** defense is played by default in solo games, with an Auto-defend switch and a per-drive SIM. Online head to head stays offense-only.
- **OD-3:** a solo game takes 4–6 minutes including defense.
- **OD-4/5** (packs) re-rate the cards our fixtures use. We pin the fixtures.

**V2's identity for NFL is "Sling and smash: read it, sling it, break one tackle"** (V2 §A.4). The team's goals, in build order:

1. **The carrier never gives up (C-1).** After a catch or handoff he keeps his momentum until the thumb lands. This is the single biggest feel fix in the sport (V2 §F.2 nfl #1).
2. **One control grammar shared with NBA and soccer (V2 §A.5).**
   - A floating left stick; pushing past the ring is burst.
   - At most four right-thumb targets, A/B/C/D.
   - A is always the timed action and never moves.
   - Taps on receivers, a slingshot with an always-on landing reticle, and a pocket you can move in.
   - A pause button is always present.
3. **You can see the play (V2 §B.2.3).**
   - The line of scrimmage sits at 45% of the height above a 124 px play tray.
   - Near players are 34 px tall.
   - Dynamic zoom keeps the reticle on screen.
   - There is one score bug and one toast line, and no HUD overlaps (P-1, V-1, V-3).
4. **PERFECT is the verb (V2 §B.0.1, §B.2.5).**
   - The gold ring drives the sling, the juke and spin, the BIG HIT, the pick and the kick.
   - It is timed from touch timestamps, with a ±30 ms floor.
   - **Gold never lies.**
   - Heat replaces the standalone On Fire (V2 §B.0.2). Every match is graded (V2 §B.0.3).
5. **Stats read as real.** Per-play distributions and rating spreads are calibrated to 2024–25 NFL numbers, and seeded tests assert them with 95% intervals.
6. **Football, not half of it.**
   - A real defensive call table.
   - Solo defense on the AI's key snaps, with BIG HIT and PICK rings and played takeaway returns.
   - All of it inside a 4–6 minute game.
7. **A finished match flow.**
   - Pause, quit and online forfeit.
   - Ties settled on the field.
   - A staged Clutch drive and a box score with a player of the game.
   - A rematch in ≤ 10 s, with the arena kept mounted.

**Preserve** (audit §11 and V2 §B.2.9):
- **The engine:** seeded, fixed-step and deterministic, 11-on-11, with render-only juice (`juice.test.ts`).
- **The `RunInput` contract:**
  - A `Pt` is human intent. A touched, centred stick is `{0,0}`, which brakes. It is never turned into `null`.
  - A number is the AI's lane.
  - `null` means "nobody is steering". This is the one documented case nfl-1 adds: a designed run follows its lane, and any other carrier carries his momentum.
- **The physical, rating-driven sub-systems:** blocking proximity, power and finesse rush, route breaks, coverage lag, one swept play on the ball per defender, catch-point reach, the tackler wind-up (it becomes the gold ring), move counterplay, and the 16 abilities.
- **Rules and feel:**
  - BULLET/TOUCH/LOB physics
  - penalties with accept/decline, blown coverages, the seeded kickoff spot
  - replays, hit-stop, the stamina bar, afterimages
- **The landscape side camera**, which is the readability reference.
- **Accessibility:** reduced motion, ARIA labels on every control, and the keyboard/WASD fallback.
- **CLAUDE.md's "permanent stick and separate skill buttons".** JUKE, SPIN and POWER stay separate buttons. Burst on the ring is an input mapping only, and stamina maths is unchanged (V2 §F.3).

## 2. Rules applied to every task

### Lane

- **We own** `src/game/football2/**` and `src/game/football/**`, except the player-drawing sections of `render.ts`: `lookFor`, `poseOf`, `animOf`, `sprite`, the sprite budget and the cache.
- **Shared with nba**, NFL branches only, in small hunks that never reformat a file:
  - `Arcade.tsx`, `difficulty.ts`
  - `play-feedback.ts`, `PlayReadout.tsx`/`play-readout.css`
  - `juice.ts`, `replay.ts`, `useInputInterrupt.ts`, `attrs.ts`
- **V2 shared files**, written by others, which we consume and may touch in small hunks (OWNERSHIP V2 grants):
  - nba: `src/game/controls-geometry.css`, `Stick.tsx`, `stick.ts`, `perfect.ts`, `heat.ts`, `src/game/hud/*`
  - ut: `src/lib/playtime.ts`, `src/lib/haptics.ts`
- **One import point for V2 shared code: `football2/shared-v2.ts`.**
  - NFL code imports Stick, the ring maths, Heat, the HUD kit, haptics, the chime and playtime **only** through it.
  - Until nba's and ut's pieces reach our branch, it holds a thin local implementation of the §4 contract.
  - At the merge, the lead replaces its body with re-exports (a merge step).
  - A test (`imports.test.ts`) fails if any other NFL file imports those modules directly.
- **Keeping `render.ts` hunks small.** New camera and overlay logic goes in new files, `football2/camera.ts` and `football2/overlay.ts`. The `render.ts` hunks are calls only.
- **Keeping `Arcade.tsx` hunks small.** Match arithmetic goes in new pure modules, `football2/match-flow.ts` and `football2/sim-match.ts`.
- **New CSS** goes in new files under `src/game/football2/`, imported from our components: `play-tray.css`, `hud.css`, `pause.css`, `pass-controls.css`, `defense.css`. `src/styles.css` does not grow.
- **"Touched outside my lane"** in `nfl.md` lists every edit outside the lane. The known ones are:
  - `src/game/progress.ts`: the optional fields `box` and `grade`
  - `src/evolution/Training.tsx`: NFL tip strings
  - small hunks in `App.tsx`, `ut/Match.tsx` and `ut/match-debrief.ts`
  - `src/game/match-prefs.ts`, if nba has not written it

### Sport branches and determinism

- In shared files use `pick({ nba, nfl, soccer })`. Never write a two-way sport ternary.
- Engine, drive and autopilot code uses `p.rand` or `rng(hashString(…))` only. `Math.random()` is allowed in render-only code.
- **Timed inputs** (gold-ring releases, Big Hit, swat, kick taps) are handled the same way:
  - Each is converted from `PointerEvent.timeStamp` to engine time once, at the input, through `shared-v2.ts` `touchTime()`.
  - The result is stored as an engine-time number and applied at the next fixed engine step.
  - Wall-clock time is never read inside the engine.
- **Heat is integer engine state** in `Game` and is stepped only by engine events.
- Engine logic never reads `Body.act`. A test enforces this (contract C9).

### Protocol

- Never edit `DRAFT_RULES` or `UT_RULES`.
- One line in `nfl.md` reads **"Protocol bump needed: NFL draft 10→11, UT 11→12, because …"**, and each task adds its reason (§7).
- NBA and soccer are unchanged by us.
- New wire values are drive-end strings of at most 8 characters. `net/match.ts` `arcadeOf` accepts at most 40 such strings, `drive` ≤ 99 and `score` ≤ 999, and drops every other field.
- `box` and `grade` never reach the wire (test). No net code changes.

### Saves

- No profile, storage-key, card, edition or copy id changes.
- New state is local, optional preference keys only, read through `football2/prefs.ts` (try/catch, typed defaults):

  | Key | Values | Added in |
  |---|---|---|
  | `perfect-season:fb2-burst-button` | boolean, default `false` (burst on the ring) | nfl-2 |
  | `perfect-season:fb2-defense-snaps` | `'key'` / `'all'` | nfl-8 |
  | `perfect-season:auto-defend` | shared with nba through `src/game/match-prefs.ts` (C6) | nfl-8 |
  | `perfect-season:fb2-playlog` | local play-stats roll-up | nfl-6 (cut line) |

- Revision 2's `fb2-pass-layout` (`'panel'`) is **cut**. The ten-button panel breaks V2's "at most four right-thumb targets", and the key never shipped.
- The device timing calibration value belongs to nba's `perfect.ts`. We read it and never write our own copy.
- Each key gets a test: missing, garbage and a throwing `localStorage` each give the default.
- None of these keys is in the cloud-save key list (checked, not edited). `perfect-season:fb2-played` is untouched.

### Commands (all through the semaphore)

- **Area tests:** `bash O/heavy.sh env PS_SPORT=nfl npx vitest run src/game/football2 src/game/play-feedback.test.ts src/game/juice.test.ts src/engine/sport-branches.test.ts`
- **Typecheck:** `bash O/heavy.sh npm run typecheck`
- **Fast calibration** (about 100 games per case, ≤ 15 min; the nfl-1 baseline took 539 s): `bash O/heavy.sh env MODE=fast CASES=… npx vite-node scripts/nfl_calibrate.ts`
- **Full calibration** (≥ 400 events behind every percentage band, each with a 95% Wilson interval, ≤ 60 min): `MODE=full`. It runs at the end of nfl-7 and in nfl-10, plus the dedicated kick and two-point harnesses in nfl-9.
- **Human proxy timing** (new in nfl-4). `sim-kit`'s human pilot releases with a Gaussian σ = 50 ms around each ring centre. This is the same human model as nba-4 (`nba-plan.md` §3.2), so "gold" rates are comparable across sports.
- **Fallback when a band can't be met in the session:** record the closest result with its interval, and follow this priority order:
  1. determinism and safety
  2. OD-2 and OD-3
  3. "gold never lies"
  4. turnovers and INT
  5. completion by depth and sacks
  6. the run distribution
  7. game shape
  8. secondary bands
- Full `npm test` and the single `npm run build` run only in nfl-10.

### Browser QA, isolated from live services

- **Dev server:** `nohup npx vite --port 5216 --strictPort > /tmp/ps-nfl-vite.log 2>&1 & echo $! > /tmp/ps-nfl-vite.pid`. Stop it with `kill $(cat /tmp/ps-nfl-vite.pid)`. Never use `pkill -f` or `pgrep -f`.
- **URL:** `http://localhost:5216/?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=…`
- **New scripts use `scripts/qa/nfl-lib.mjs`:**
  - `context.route('**/*')` aborts every host except localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com, and logs what it blocked.
  - Insets are injected.
  - `reducedMotion` is set explicitly on every run.
- **Legacy scripts** run only through `node -r ./scripts/qa/nfl-guard.cjs …`. A run that attempts a non-local request fails.
- **Relay runs** take `flock -w 1800 /tmp/ps-qa-relay-7777.lock` and check the port first.
- **Positions** are read by hooking `FootballRenderer.prototype.draw` from the dev server, QA-only. No product debug hooks are shipped.

### Viewports

Use touch, `isMobile` and `deviceScaleFactor: 1`. Every UI task runs all five, plus a reduced-motion run:

| Name | Viewport | Insets |
|---|---|---|
| A | 393×852 | 59/34 (owner's phone; the V2 geometry's first column) |
| B | 430×932 | 59/34 |
| C | 320×568 | 20/0 (the V2 geometry's second column) |
| D | 844×390 landscape | top 0, bottom 21, left/right 59 |
| E | 375×667 | 20/0 |

Screenshots go to `O/shots/nfl/<task>/`, and each one is looked at, next to the matching `mockups.html` frame where one exists.

### Layout acceptance on every UI task

- Controls take their positions from the geometry variables (C15) and never hard-code the V2 §A.5 numbers.
  - At A, measured centres are within 4 px of A (323, 738), B (238, 778), C (250, 694) and D (340, 652).
  - At C, they are within 4 px of A (266, 510), B (190, 536), C (200, 468) and D (282, 436).
- Every target is ≥ 44×44 design px. Gaps between A/B/C/D are 10–18 px.
- **At most four right-thumb targets at any moment, none in the top two thirds of the screen** (the pause button excepted).
- Every text a player must read is ≥ 10 design px.
- The tray and controls sit ≥ 8 px above `var(--sab)`. In landscape they are ≥ 8 px inside `--sal`/`--sar`.
- No horizontal overflow.
- Nothing is drawn on the field except the score bug, the toast line, name chips and the ground rings (V2 §C.5 rule 6).

### Reduced motion, decided once

| Element | Normal | Reduced motion |
|---|---|---|
| Dynamic zoom, Clutch 6% push | eases | fixed at 1 |
| Tray collapse, bug flip, box-score reveal | animate | instant |
| PERFECT word | scales 1.0 → 1.25 → 1.0 over 220 ms | no scale; same colour and chime |
| Gold rings (sling, juke, BIG HIT, pick, kick) | close and glow | still close and still show the window (they carry information); no glow or flash |
| Heat flames, burning ball, ball trail | animate | a static flame icon on the bug |
| Incompletion bounce | 0.6 s tumble | the ball fades in place |
| Takeaway return (render) | 1.2 s run | a cut to the spot |
| Slow-motion replays | play | skipped; the result card shows |
| Momentum hint | toast line | toast line (it is text) |

### Performance

- Rings, icons, meters, the stick knob and needles are written through refs, never React state.
- During live play, outside input events, there are at most 2 React commits per second (Profiler).
- One `FootballRenderer` per match; the defense draws with swapped kits.
- The renderer stays mounted across a rematch (nfl-9).

### Commits

- Stage explicit paths after each task, at the commit points each task lists.
- Messages start `Claude: ` and end with the two trailer lines from BUILD-RULES.
- Push with `git push -u origin claude/studio-nfl`, retrying 4 times (2/4/8/16 s) on network errors.
- Never `git add -A`, force-push, rebase or bare `git stash`.

## 3. Baseline to beat

Measured by nfl-1's fast calibration at `acdf3e2`: 100 games per case, gold fixtures pinned in `nfl-calibration/fixtures.json`, 95% intervals in `baseline-fast.md`.

| Metric | Target | Measured now |
|---|---|---|
| Completion % | 64–65 | AI Pro gold 68.9; Legend elite 49.5; human proxy Pro 66.7 |
| By depth: behind / 0–9 / 10–19 / 20+ | 79 / 72 / 55 / 35 | audit: AI deep 55%, human proxy 57–62% |
| INT % | 2.2, rising with depth | AI Pro gold 3.0; Legend elite 7.4; Legend promo 8.2 |
| Sack % | 6.9 (≈ −6.5 yd each) | AI Pro gold 3.2, Legend gold 0.2; human proxy 11.9 / 12.2 / 25.1 (Rookie / Pro / Legend) |
| Time to throw | ~2.8 s | AI 1.31–1.63 s; human proxy 2.27 s |
| 20+ yd gains, % of attempts | 8–9 | human proxy Pro 19.3; AI Pro gold 7.5 |
| YAC | 5.2 | AI Pro gold 4.09; human with the stick held 5.32, with the stick 0.35 s late 2.10 |
| Runs: YPC / ≤0 / 10+ | 4.3 / 18% / 10–11% | AI Pro gold 4.01 / 8.9% / 1.1% |
| C-1 cost: YPC with the stick held / 0.35 s late / never touched | late ≥ 0.95× held | 4.15 / **1.06** / **−3.67** |
| Points per drive (AI v AI) | ~2.1 | Pro gold 3.50; Legend elite 1.06; 11-drive shape 3.99 |
| Turnovers / DOWNS, % of drives | ~10 / ~6 | Pro gold 16.8 / 15.0; Legend elite 32.8 / 35.3; Legend promo 37.3 / 22.5 |
| 3rd-down conversion | 35–44 | Pro gold 45.8 |
| Tie odds after 4 drives | ≤ 12% | 9.5–20.7%, decided by squad rating today |
| Human proxy wins (Rookie / Pro / Legend) | ≥ 70 / 45–55 / 28–38 | 48.0 / 42.0 / 34.0 (stick in time); 24.0 / 22.0 / 19.0 (stick 0.35 s late) |
| Offensive drive wall time (model, human) | ≤ 45 s median | median 42.3 s, P90 66.8 s; 4 drives 174 s |
| Catch with no stick (live) | keeps running | audit: 5 of 5 braked to 0 within 0.25 s |
| Line of scrimmage / formation visible pre-snap (393) | LOS at 45%, all 11 above the tray | audit: QB and RB hidden; all 11 hidden at 320 |
| Ability pops per play | ≤ 1 | 0.7 (gold); 2.0–2.4 (elite) |
| Frame pacing, 4× throttle, 15 s | frames > 33 ms ≤ 5; long tasks ≤ 250 ms | 10 frames; 6 long tasks (527 ms) |
| PLAY tap → first playable tray | ≤ 1.6 s at 1×, ≤ 4 s at 4× | measured by nfl-1 in the browser (still to do) |
| Final whistle → next snap (rematch) | ≤ 10 s at 4× CPU | measured by nfl-9 (new V2 target) |
| Heap, solo game | ≤ 45 MB with defense | 35.6 MB (offense only) |

## 4. Cross-team contracts

nfl-1 writes these into `nfl.md` under "Cross-team contracts", each with its exact signature and owner. C1–C14 are already there (commit `2a54e41`). Revision 3 **amends C2, C3, C6 and C9** for V2 and **adds C15–C23**.

### Contracts kept from revision 2

- **C1. Forfeit:** the `'FF'` drive-end marker, padded to the units required, with `done: true`. `onFinish(..., forfeit?: 'us' | 'them')`. Unchanged.
- **C2. Overtime: amended to V2 §B.2.1.**
  - **What changes.** Overtime is **alternating sudden-death two-point tries from the 2-yard line**, straight after the 4 regulation drives. Revision 2's extra OT drive from the 25 is dropped: it cost up to 90 s and V2 does not have it.
  - **Units:** 4 regulation drives, then rounds of one try each. `'P2'` is good (2 points), `'P0'` is no good. A round decides it when the two results differ.
  - **The cap** is 20 rounds (at most 24 ends, inside the wire's 40). With a round-tie chance of about 0.505, 20 rounds leave about 1.2 × 10⁻⁶ unresolved. Only past the cap does the old `decide()` path run.
  - **`football2/match-flow.ts` exports:** `required(us, them)`, `final(us, them)`, `forfeitBy(ends)`, `pointsOf(ends)`, `isTouchdown(end)`, `MAX_ROUNDS = 20`.
  - `done` stays monotonic.
  - **Takeovers** use the seeds `seed + ':takeover:ot<n>'`.
  - **To nba:** the same shape through a `pick`-chosen `flowFor`.
- **C3. Box score: ut contract A, adopted and extended.**
  - `Progress.box?: BoxLine[]` with `rating` 1.0–10.0, the single source for our player of the game and ut-5's MOTM.
  - V2 adds three stat keys for ut's card-mastery feats (V2 §D.6), on the NFL lines:
    - `pf`: PERFECT moments by that player
    - `bt`: broken tackles
    - `bh`: BIG HITs
  - ut reads them duck-typed.
  - `box` is attached to finished `Progress` only and never to `onProgress` (test).
- **C4. Solo quit: ut contract B, adopted.** `onQuit?(us, them)` and `quitText?`. Without `onQuit` the pause menu shows Resume and Controls only.
- **C5. Difficulty:** `rivalOffenseFaces(online, level?)` in `difficulty.ts` (nba's name). Unchanged.
- **C6. Auto-defend: amended for playtime.**
  - The shared key `perfect-season:auto-defend` and `getAutoDefend`/`setAutoDefend` in `src/game/match-prefs.ts` are unchanged.
  - V2 §E.1 adds: auto-played snaps and Auto-defend never call the playtime `input()` (C21). Auto-defend alone does not count as playing.
- **C7. Crowd flag:** not added (crowd pressure is cut, V2 §F.2 nfl #8).
- **C8. Drive-end codes:** `TD` 7, `TD6`, `TD8`, `FF`, `P2`/`P0`. The requests to ut are unchanged: `match-debrief` counts all touchdown codes, the counters use `isTouchdown`, `verdictOf` honours a forfeit, and `Match.tsx` gets the maps.
- **C9. Acts for players: amended for the V2 §B.2.6 frame plans.**
  - The engine sets the existing acts:
    - `backpedal` while the QB drops
    - `down` on a sacked QB and `tackle` on the sacker
    - `catch` on the RB at the handoff mesh
    - `juke`/`spin`/`stiff`/`truck` on moves
    - `windup` on a tackler
  - Events in `p.events`:
    - `catch:poss`, `catch:yac`, `catch:high`
    - V2 adds `perfect:juke`, `perfect:spin`, `bighit`, `stumble:<id>` (the beaten tackler), `handoff:mesh` and `incomplete:bounce`
  - Players choose clips from these: the `cut` clip for the juke, `stumble`/`slip` for a beaten tackler, `fall_back` for BIG HIT and truck losers, and `getup_front` after a sack.
  - No new act type.
  - A test proves engine logic never reads `act`.
- **C10. Juice and clips.**
  - Every NFL hit-stop and shake goes through `football2/feel.ts` `impact(kind, a, b)`.
  - At the merge its body becomes players' `impactOf`.
  - `preloadClips('nfl')` is called on mount.
  - The V2 §B.0.5 budget applies: hit-stop 33–120 ms, capped at 150 ms per second; at most one slow-motion beat per score.
- **C11. Shell.**
  - HUD offsets use `var(--sat/--sar/--sab/--sal)`.
  - `ps:arena-ready` fires after the first drawn frame.
  - shell's `withCurtain` wraps `Football2`.
- **C12. Club Season sim (request to ut).** For played games, touchdowns come from `isTouchdown()` or `box`. For AI sims, ut uses nfl-10's `DRIVE_ODDS`. `DRIVES` stays 4.
- **C13. packs (request).**
  - The display label "Truck Stick" becomes "Bulldozer" (the id is unchanged).
  - Fixtures are pinned, and calibration is re-run on the merged pool.
- **C14. players (request and notice).**
  - A notice: the camera reframe (nfl-3) sets near players to **34 design px**, the V2 §C.1.2 target at 23 art px × 1.5.
  - Requests: the floor yard-number LOD and the per-frame `drawFloor` in `persp.ts`. V2 §C.2's venue palette is players' (V2 grant) and covers both.

### New V2 contracts: what we consume

All of these are reached only through `football2/shared-v2.ts` (§2). Where an author's file differs at the merge, the lead adapts `shared-v2.ts`, not NFL code.

**C15. Control geometry: `src/game/controls-geometry.css` (author: nba; V2 §A.5).**
- **What we read:** CSS custom properties on `.arcade-full`, inset-aware and switched by the stage, never by a width media query:

  | Group | Properties |
  |---|---|
  | Buttons | `--ctl-a-d`, `--ctl-b-d`, `--ctl-c-d`, `--ctl-d-d` (diameters) |
  | Button centres | `--ctl-{a,b,c,d}-right`, `--ctl-{a,b,c,d}-bottom` (centre offsets from the right and bottom edges) |
  | Stick | `--stick-d` (ring diameter), `--stick-ghost-left`, `--stick-ghost-bottom`, `--stick-zone-w`, `--stick-zone-h` |
  | Action-safe box | `--safe-top`, `--safe-bottom` |
  | Score bug | `--bug-w`, `--bug-h`, `--bug-top` |
  | Heat bar | `--heat-h` |
  | Toast line | `--toast-bottom` |
  | Pause | `--pause-top`, `--pause-left` |

- **Before nba's file lands:** `football2/hud.css` declares the same names with the A.5 values as fallbacks, so nothing moves when the real file arrives.
- **Our acceptance:** the §2 layout checks.

**C16. Stick: `src/game/Stick.tsx` + `stick.ts` (author: nba).**
- **Pure `stick.ts`:**

  ```ts
  stickFrom(origin: Pt, point: Pt, radius: number, sprintAt = 1.15): { vec: Pt; mag: number; sprint: boolean }
  ```

  `vec` is in −1..1 with y up, after the dead zone.
- **`Stick.tsx` props:**
  - `onDown(e)`: every **new** pointerdown in the zone, including one already resting there before the whistle (live at the whistle)
  - `onMove(vec, sprint, e)`
  - `onUp(e)`
  - `ghost?: boolean`, `label?: string`
- **An imperative handle** `read(): { vec: Pt | null; sprint: boolean; heldSince: number | null }`, so the per-frame read needs no React state.
- **Haptic** `tick` when the sprint ring is crossed.
- **What NFL needs from it, and why:**
  - `onDown` is the "new touch" that nfl-1's `CarryGate.touch()` requires.
  - The world vector stays ours: `controls.ts` `screenRunInput` maps `vec` to the field for the end and side views.
  - `sprint` drives burst unless the Burst-button preference is on.

**C17. The gold ring: `src/game/perfect.ts` + the `PerfectRing` draw helper (author: nba; V2 §B.0.1).**
- **Pure, with no DOM and no RNG:**

  ```ts
  type Ring = 'gold' | 'amber' | 'red';
  interface RingWindow { center: number; half: number; state: Ring }  // engine seconds
  const MIN_HALF = 0.030;
  const FIRE_SCALE = 1.25;
  windowHalf(base: number, scale: number, fire: boolean): number       // ≥ MIN_HALF, × FIRE_SCALE on fire
  judge(at: number, w: RingWindow): 'perfect' | 'good' | 'early' | 'late' // 'perfect' only when state === 'gold'
  touchTime(e: { timeStamp: number }, anchor: { perf: number; engine: number }, lagMs: number): number
  calibrationLag(): number                                              // ms; nba's one-time "tap on the beat"
  drawRing(ctx, x, y, r, progress, w, state)                            // gold segment ≥ 8 design px on screen
  ```

- **What NFL adds:**
  - Each sport decides whether gold is offered (state) and what gold guarantees.
  - The NFL rules are "gold never lies" in §6.2. The toast names the failing dial: TIMING, PRESSURE or RANGE.

**C18. Heat: `src/game/heat.ts` (author: nba; V2 §B.0.2).**
- **Pure and integer:**

  ```ts
  interface Heat { pts: number; fire: number; best: number; lit: number }
  // pts 0–100; fire = On Fire units left; best = max pts; lit = times On Fire this match
  type HeatEv = 'perfect' | 'score' | 'stop' | 'clean' | 'turnover' | 'conceded' | 'half';
  addHeat(h: Heat, ev: HeatEv, sport: SportId): { h: Heat; heating: boolean; lit: boolean }
  spendFire(h: Heat): Heat     // one On Fire unit used
  HEATING = 66;
  FULL = 100;
  ```

- **The NFL table, filled by us through `pick` (V2 numbers):**

  | Event | Points |
  |---|---|
  | perfect | +12 |
  | score (TD) | +25 |
  | stop or turnover forced | +15 |
  | clean | +5 |
  | turnover | −20 |
  | conceded | −10 |

- **What "clean" means for NFL.** We map it to "a first down gained on a drive with ≥ 2 completions and no sack". This is our reading of V2's "clean possession with ≥ 2 passes"; nfl-10 fits it.
- **On Fire** lasts **3 of your snaps**. `half` resets `pts` and `fire` after drive 2.
- **Online,** the rival's bar is computed **from their wire `ends` only** (TD +25, turnover −20), for display only. No wire change.

**C19. HUD kit: `src/game/hud/*` (author: nba; V2 §C.3).**
- `ScoreBug` props:

  ```ts
  { us: number; them: number; label: string;   // e.g. 'DRIVE 3' | 'OT' | 'CLUTCH'
    clock?: string; heatUs: number; heatThem: number;
    fireUs: boolean; fireThem: boolean; progress: number /* 0–1, the 3 px pip line */ }
  ```

- `Toast`: one line, 28 px. `toast(text, { prio, ms, key })` queues by priority and clears on `clear(phase)`.
- `PauseButton({ onPause })`.
- nfl adds small hunks only for NFL labels.

**C20. Haptics and the chime (authors: ut for `src/lib/haptics.ts`; the `sound.ts` chime is whoever lands it, per V2 §F.1).**
- `haptic('tick' | 'double' | 'long')`.
- `perfectChime(streak: number)`: two notes, +1 semitone per consecutive perfect, up to 5.
- **Before they land,** `shared-v2.ts` maps them to the existing `sfx`/vibrate calls.

**C21. Playtime: `src/lib/playtime.ts` (author: ut; V2 §E.1).**
- **What we need:** `usePlaytime('match')` returns `{ input(): void; pause(on: boolean): void; complete(): void; abandon(elapsedMs: number): void }`.
- **The one-line Arcade hunk** (NFL branch) calls the hook.
- **`Football2` calls:**
  - `input()` on every gameplay or play-call pointerdown or keydown: stick, A–D, tray card, slingshot, icon or kick tap. Never on an auto snap, Auto-defend, SIM or replay.
  - `pause(true/false)` from the pause menu and auto-pause.
  - `complete()` at the final whistle.
  - `abandon()` on a quit or forfeit.
- **Before ut's module lands,** the adapter is a no-op.

### New V2 contracts: what we produce

**C22. Match grade: `Progress.grade` (ours, V2 §B.0.3 and §F.1).**
- One optional field in `src/game/progress.ts`, next to `box`, attached to **finished** `Progress` only, never on the wire (test):

  ```ts
  interface MatchGrade {
    letter: 'S' | 'A' | 'B' | 'C';
    perfects: number;     // your PERFECT moments
    chances: number;      // gold rings offered to you
    heatBest: number;     // 0–100
    lit: number;          // times On Fire
    flawless: boolean;    // won with 0 turnovers
  }
  ```

- **The letter** comes from your points per drive against `PAR[level]`:

  | Letter | Rule |
  |---|---|
  | S | ≥ par + 1.5 |
  | A | ≥ par + 0.5 |
  | B | ≥ par − 0.5 |
  | C | otherwise |

  `PAR` is a constants table that nfl-10 fits.
- **Consumers:**
  - ut-5's tally and the One-More bar
  - ut-6's objectives ("3 PERFECT releases", "reach ON FIRE once")
  - the Touch rating, which uses `perfects / chances`
- Grades never pay coins directly (V2 §B.0.3).

**C23. Daily Play scenarios: `football2/daily-play.ts` (ours, P1, V2 §D.3; ut hosts it and owns the board).**

```ts
interface NflScenario {
  id: string;                                  // 'nfl:<ET day key>'
  title: string;                               // '4th and goal from the 6'
  squad: { era: string; edition?: string };
  start: { ballOn: number; down: number; toGo: number; clock: number | null; need: 'td' | 'fd' | 'score' | 'win'; margin: number };
  maxPlays: number;
}
dailyPlay(dayKey: string): NflScenario   // deterministic from the day key; same for everyone
```

- `Football2` prop `scenario?: NflScenario` plays it on the normal engine.
- It reports through `onDaily({ ok, plays, secs, perfects })`.
- **The score formula belongs to ut:** outcome + PERFECTs + time. We return the parts.
- **Pool:** at least 28 scenarios rotate by day key.
- Practice attempts after the 3 scored ones use the same scenario.

### Contract status

The table in `nfl.md` gains:

| Contract | Counterpart | Status |
|---|---|---|
| C15 geometry | nba | proposed names, local fallbacks |
| C16 Stick | nba | proposed |
| C17 gold ring | nba | proposed |
| C18 Heat | nba | proposed |
| C19 HUD kit | nba | proposed |
| C20 haptics and chime | ut, soccer | adapter |
| C21 playtime | ut | proposed |
| C22 grade | ut | offered |
| C23 Daily Play | ut | offered (P1) |

## 5. The solo format, Clutch and session length (OD-2, OD-3, V2 §B.2.1)

**Format.** Solo games alternate: your drive k, then the AI's drive k on defense.
- `DRIVES` stays 4 for online, solo and `league.ts`.
- On the AI's drives you play the **key snaps**:
  - every 3rd and 4th down
  - every snap inside your own 20
  - the AI's two-point tries
- The other AI snaps play themselves at 3×, watchable and skippable.
- Auto-defend plays every AI snap at 3×. SIM DRIVE resolves one AI drive at once and shows the recap.
- **Online** head to head stays the parallel offense race.

**Ties** go to two-point rounds from the 2 (C2). In solo you also defend the AI's tries; they are key snaps.

**Clutch = drive 4** (V2 §B.0.4). This is your drive 4 and, in solo, the AI's drive 4 too.
- **Rules:** a two-minute drill with a running clock and **three timeouts shown as pips in the bug**, plus HURRY and SPIKE. The clock and timeouts are rules (protocol).
- **Staging** (presentation only):
  - the crowd bed rises
  - the bug turns gold and reads CLUTCH
  - the camera sits 6% tighter
  - the heartbeat haptic runs while the margin is one score
  - "FOR THE WIN" is announced when the drive can tie or win
  - that drive's score always gets the replay

**Time budget.** Model from `pacing.ts`; nfl-1 measured an offensive drive median of 42.3 s.

| Drive | Make-up | Target |
|---|---|---|
| Offense | about 6 plays × (2.5 s pick + live play + 0.6–0.8 s whistle-to-tray) | median ≤ 45 s |
| Defense | about 2.5 key snaps × (call + play + 0.7 s) + about 3.5 auto snaps at 3× + 3 s of transitions | median 35–40 s |
| OT | each round ≈ 2 × 12 s | median ≤ 30 s when it happens |

**Replays** play only on TDs and takeaways (V2 §B.2.7), so revision 2's second fallback is now the default.

**Fallbacks**, in order:
1. auto snaps at 4×
2. 0.6 s whistle-to-tray
3. last resort: `SOLO_DRIVES = 3` (never `DRIVES`), with the OT target relaxed and recorded

**What "solo" covers:**
- **Covered:** Squad Battles, Cups, Club Season, Events, UT Draft games and draft games against the AI.
- **Not covered:** Gauntlet (a pure sim) and NFL Moments (drills). Both are deliberate readings of OD-2, recorded.
- **Defensive SIM DRIVE** is allowed in manual-only modes, and the match stays `how: 'played'`.

## 6. Controls: the V2 grammar for NFL

### 6.1 Pointer ownership and gestures

`football2/gestures.ts` is pure and unit-tested, built in nfl-2.

**Ownership is decided on pointerdown, in this order:**
1. on A/B/C/D or the pause button → that control
2. inside the stick zone (left 48% of the width, lower 55% of the height; C15) → the stick until it lifts
3. on a receiver icon → the icon
4. anywhere else on the right two thirds → the slingshot surface

**Tap or drag.** A tap moves < 10 design px and lasts < 250 ms. Anything else is a drag. The slingshot starts at 10 px of travel.

**Receiver icon.** A tap throws an auto-led TOUCH pass to that receiver. A drag of ≥ 10 px from it becomes a slingshot from there.

**Swipes start on A** (V2 §A.5): for the carrier, a swipe ≥ 36 px within 250 ms off JUKE is a juke that way. There is no invisible full-screen swipe layer.

**Everything fires on pointerdown**, except holds (POWER's truck charge) and the slingshot release.

**Before the snap,** a drag of ≥ 10 px on the field above the tray collapses it to look around. Taps on receivers do nothing.

**Cover ball.** The right thumb held still on the field, not on a control, for ≥ 0.3 s while carrying. It is kept from revision 2 for STREAM C-4's "protect ball"; it is a hold, not a swipe layer.

**Second-finger toggle** (cut line). During a slingshot drag, a tap by another pointer cycles the throw type, exactly like C. It never counts the stick's pointer.

### 6.2 The context map (V2 §B.2.2)

| State | Left stick | A (Ø92, gold) | B (Ø64, teal) | C (Ø48) | D (Ø48) | Field |
|---|---|---|---|---|---|---|
| **Pre-snap** | – | **SNAP** | **AUDIBLE** (flip the picked play to its run/pass mirror) | – | – | the 124 px tray (3 cards; swipe for the book); drag to look around |
| **Pocket** | moves the QB (slide, step up, roll); crossing the line of scrimmage makes him a runner automatically | **RUN IT** inside the tackle box; **THROW AWAY** outside it (same slot, label changes) | – | **TOUCH / BULLET / LOB** chip (tap cycles; resets to TOUCH each snap) | – | slingshot anywhere on the right two thirds, or tap a receiver icon; the landing reticle is always drawn |
| **Ball carrier** | steer; momentum carries until the first touch (C-1); **past the ring = burst** (shares stamina) | **JUKE** toward the stick side (a swipe off A picks the side) | **SPIN** | **POWER**: tap = stiff arm, hold ≤ 0.6 s = truck charge | **DIVE** within 3 yd of the line to gain or the goal line; **SLIDE** for a QB past the line; hidden otherwise | – |
| **Defense, pre-snap** | – | **READY** (the AI snaps 1.0 s later anyway) | – | **SWITCH** | – | the tray shows 3 calls (BLITZ / MAN / ZONE family, from the nfl-5 table); ALL CALLS swipes |
| **Defense, live key snap** | moves your defender | **TACKLE**: the ring closes on the carrier as you close; gold = BIG HIT. Ball in the air and your man facing it: **PICK** ring on the ball (gold = INT); facing away: **SWAT** | – | **SWITCH** (to the man nearest the ball) | – | – |
| **Kick** | – | two taps: power, then accuracy on a sweep scaled by the kicker's rating | – | – | – | – |

**The Burst-button preference** (`fb2-burst-button`, pause → Controls): when on, D is a hold-BURST button as before. DIVE/SLIDE replaces it only while in context, and the stick ring then does nothing. The default is off (lead decision 2). This is an owner device check.

**The gold ring in NFL. "Gold never lies"** means gold is offered only when the outcome below can be guaranteed. Otherwise the ring is amber or red, and the toast names the dial.

| Moment | Ring | Gold is offered when | Gold guarantees | Amber / red |
|---|---|---|---|---|
| **Sling** (nfl-4) | the landing reticle; release as the break lines up | the target's separation halo is green, the spot is in his catch radius and within the QB's arm range | a catchable ball in stride: no placement error, no drop, no interception | amber under pressure ≥ 0.5, or a tight halo (the timing still narrows error); red out of arm range (RANGE) |
| **Tap throw** | none | – | never better than a PERFECT sling (auto must not beat manual) | – |
| **Juke / spin** (nfl-4) | the tackler's wind-up ring (`windupOf`) | the tackler is in his wind-up and the carrier has the move ready | that tackler misses and stumbles for 0.8 s | early = the cut is slowed; late = wrapped (contest, nfl-7) |
| **Truck** (nfl-7) | the POWER charge meter | – (STR + momentum decides; no gold) | – | – |
| **BIG HIT** (nfl-8) | ring on the carrier as you close | your defender is in range (2.6 yd) and closing | a tackle that ends the play now (the fumble roll still applies) | amber when he is out of range; early or late = a wrap with a broken-tackle chance |
| **PICK** (nfl-8) | ring on the ball at the catch point | your defender faces the ball (75° rule) and can reach the catch point | an interception | facing away = SWAT, amber |
| **Kick** (nfl-9) | the accuracy sweep's gold band | the distance is inside the kicker's range | the kick is good | beyond range the band is amber (the make chance falls off over 5 yd) |

- **Gold windows.** The half-width is `windowHalf(base, scale, fire)`, with the ±30 ms floor. Ratings set the size:
  - the sling: QB accuracy (ACC/THP short/mid/deep)
  - juke/spin: JKM/SPM and AGI
  - BIG HIT: HIT and TAK
  - pick: the defender's catching and play recognition
  - kick: KAC
- **Seeing it.** On screen the gold segment is ≥ 8 px, so a 95 visibly gets a fatter gold than a 70 (V2 §B.0.1).
- **The deep throw (G-2).** 20+ air yards scale `base` by 0.7 and are never gold under pressure. This, with nfl-6's coverage fixes, is how deep completion reaches 33–45% for the human proxy.

## 7. Protocol summary

**Protocol bump needed: NFL draft 10→11, UT 11→12** (V2 §F.3). Reasons by task:

| Task | Reason |
|---|---|
| nfl-1 | input semantics after a carrier change (the momentum carry) |
| nfl-2 | pocket movement, throwaway, slide, the automatic scramble across the line, scramble throws, the throw-type chip |
| nfl-4 | gold-ring windows and guarantees, touch-timestamp timing, Heat and On Fire (replacing the QB's 3-completion On Fire) |
| nfl-5 | defensive calls, AI reads, play calling, formations |
| nfl-6 | passing calibration and catch types |
| nfl-7 | runs, contact, wrap contests, truck charge, moves |
| nfl-9 | OT two-point rounds, the `FF`/`P2`/`P0` codes, `done`, conversions, kicking, punts, the Clutch clock and timeouts, draft fill-ins |
| nfl-10 | calibration tuning |

**No bump:**
- **nfl-3** is camera, HUD, tray, overlays, load and pacing: render and UI only.
- **nfl-8** is solo-only. Its engine additions are inert without `p.user`. A determinism guard over AI plays, `aiDrivesOf`, `simMatch` and takeovers proves it.
- **Burst on the ring** is an input mapping only, if stamina maths is unchanged, which a test checks.

NBA and soccer are not bumped by us.

---

## 8. Ordered tasks

Order follows V2 §F.4:
- **nfl-1 to nfl-4 are the NFL part of the first-impression slice:** the carry (slice #4), the controls (#2), the camera and safe box (#3), and the gold ring with the chime, haptic and toast line (#5).
- Then the realism and depth tasks (nfl-5 to nfl-8), the match shape (nfl-9) and final QA (nfl-10).

Each task lists its commit points (so a session can push partial progress) and a **cut line**. The slice items, the P0 audit fixes, OD-2 and OD-3 are never the ones cut.

### nfl-1 (P0, slice #4, IN PROGRESS): contracts, calibration harness, baselines and the momentum carry (C-1)

**State at the pause:**

| Step | State |
|---|---|
| Contracts C1–C14 in `nfl.md` | done, commit `2a54e41` |
| `sim-kit.ts`, `scripts/nfl_calibrate.ts`, `calibration.test.ts`, `imports.test.ts`, `nfl-calibration/fixtures.json`, the fast baseline (`baseline-fast.{json,md}`) | written, **not committed** |
| `controls.ts` `CarryGate`, the engine's `null` carry (`CARRY_HOLD` 0.35 s, `CARRY_TURN` 0.6, `carrierAt`), `rushing.test.ts` and `controls.test.ts` cases, the knob by ref and the HOLD TO RUN ghost in `Football2.tsx`/`rushing-controls.css` | in the worktree, **not committed or verified** |
| `prefs.ts`, `prefs.test.ts`, `nfl-lib.mjs`, `nfl-guard.cjs`, `nfl-catch-run.mjs`, `nfl-baselines.mjs`, `joystick.mjs` hunk | written, **not committed** |

**Remaining changes:**
- Verify and commit what is written, at these points:
  1. harness and baselines
  2. C-1
  3. prefs and the QA harness
- **V2 additions to `nfl.md`:**
  - the amended C2, C3, C6 and C9
  - the new C15–C23 with the status table (§4)
  - the §6 control map in place of revision 2's
  - the Clutch format (§5)
- **New `football2/shared-v2.ts`.** Local fallbacks for C15–C21, plus the `imports.test.ts` rule that only it imports the V2 shared modules. It holds no behaviour yet beyond pass-throughs to existing sound and vibrate.
- **The HOLD TO RUN ghost stays on today's stick for now.** nfl-2 moves it onto the floating Stick, and nfl-3 moves its text into the toast line as "Momentum carries · steer when ready" (the mock-up's wording).
- **Remaining baselines:**
  - the full CAL
  - PLAY tap → first playable tray at 1× and 4× CPU (a draft game and a UT Squad Battle)
  - `nfl-attrs` bytes in a UT match
  - heap after 2 drives
  - 5 browser autoplay games at 1× to check the wall-clock model (± 10%)

**Acceptance:**
- **`rushing.test.ts`:**
  - `null` after an open-field catch: speed at +0.5 s ≥ 0.85 × catch speed, and ≥ 4 yd gained in 1 s.
  - A touched `{0,0}` brakes to < 0.01 yd/s.
  - A pre-held upfield `Pt` drives at once.
  - **Pocket drift:** the stick held back-left at the catch gives an upfield heading at +0.3 s in 20 of 20 seeds.
- **`controls.test.ts`:** `CarryGate` covers a handoff with the stick deflected, an upfield pre-hold, a back-left pre-hold, a move of ≥ 0.25, a new touch, and release-to-brake.
- **Determinism:** the hash of 200 seeded AI plays, `aiDrivesOf` and the takeover outputs is unchanged. The autopilot never sends `null` to a non-run carrier.
- **CAL stick cases** (gold v gold, Pro, full mode):
  - YPC with the stick 0.35 s late ≥ **0.95×** held (baseline 1.06 vs 4.15)
  - untouched YPC ≥ 0.95× held (baseline −3.67)
  - YAC at +0.35 s ≥ 0.85× held (baseline 2.10 vs 5.32)
  - A miss is recorded with its cause and carried into nfl-7.
- **Live `nfl-catch-run.mjs`** (6 seeds, viewports A and C, a pass to the RB with the stick never touched):
  - 6 of 6 carriers keep ≥ 70% of catch speed at +0.25 s and ≥ 50% at +0.5 s
  - YAC > 1 yd on ≥ 5 of 6
  - `joystick.mjs` passes through the guard
- **Profiler:** ≤ 10 `Football2` commits during a 2 s drag.
- **Prefs and isolation:** the pref tests pass. The guard blocks a probe `fetch('https://example.com')`.
- **Budgets:** fast CAL ≤ 15 min and full ≤ 60 min, with the measured times recorded.

**Screenshots.** A and C: a catch at +0.25 s with no stick, and the ghost, with normal and reduced motion.

**Protocol:** needed. **Saves:** none. **Cut line:** none; this task enables every other one. **Dependencies:** none.

### nfl-2 (P0, slice #2): the V2 control grammar: floating stick, A/B/C/D, pocket and passing surface, pause (C-2, C-3, C-6, D-5 pause)

**Commit points:**
1. Stick adoption, burst on the ring, and the Burst-button preference
2. `gestures.ts` and the A–D context map
3. the pocket engine
4. receiver icons, slingshot and reticle, and the throw-type chip
5. pause button, menu and scheduler
6. QA

**Changes**
- **Stick (C16), through `shared-v2.ts`.**
  - It floats under the first touch in the zone, and a thumb resting there before the snap is live at the snap.
  - The ghost ring sits at the C15 position.
  - `onDown` feeds `CarryGate.touch()`.
- **Burst on the ring.** `sprint` → `setBurst(p, true)`; stamina maths is untouched. The `fb2-burst-button` pref restores hold-BURST on D (§6.2).
- **The A/B/C/D cluster** per the §6.2 map, positioned by the C15 variables.
  - `rushing-controls.css`'s fixed move buttons are replaced. The class names `.fb2-move-*` are kept for the legacy QA scripts' selectors where possible.
  - Landscape uses the same cluster, mirrored inside `--sar`.
- **New `football2/gestures.ts`.** Ownership, tap/drag, icon tap vs drag, swipe off A, cover-ball hold, and the second-finger cycle (cut line).
- **The pocket (engine: `engine.ts`, `types.ts`, `autopilot.ts`):**
  - **Drop:** to `los − 6.5` over 0–0.75 s, with act `backpedal`, then `stance`.
  - **Moving in the pocket:** a `Pt` at t ≥ 0.45 s moves the QB at up to `lerp(3.6, 5.0, rt(AGI))` yd/s. The movement feeds `throwErrorRadius`, and `sight()` is multiplied by `lerp(1, 0.8, movement)`.
  - **AI QB:** holds, plus a 0.8 yd step-up against a free edge rusher.
  - **The box:** `outsideBox(p)` is `|qb.x − p.bx| > 4.5`.
  - **The automatic scramble:** a human QB crossing the line of scrimmage becomes a runner (`scramble(p)`), with no button.
  - **`throwAway(p)`:** legal only outside the box. It lands 3 yd past the near sideline, is never intercepted, and shows 'THROWN AWAY'.
  - **`slide(p)`:** for a QB past the line, 0.25 s of deceleration, then a tackle with no fumble roll.
  - **Sack:** QB `down` and sacker `tackle`, with no RNG draws.
  - Scramble throws are allowed until the line of scrimmage.
- **The passing surface:**
  - **New `ReceiverIcons.tsx` and `pass-controls.css`.** Name chips (V2 §B.2.2) in the route colour above each eligible receiver's head, ≥ 44×44 hit areas, de-overlapped or fanned out on touch-down.
  - **Labels:** the surname at ≥ 10 px, or the number, or the slot letter when both are missing (26% of cards have no number).
  - **The slingshot:** anywhere on the right two thirds.
  - **The landing reticle:** always drawn, through `overlay.ts`, from the drag or the icon target.
  - **The C chip:** cycles TOUCH → BULLET → LOB.
  - **A:** RUN IT / THROW AWAY by `outsideBox`.
- **Pause (D-5, slice):**
  - **The button:** `PauseButton` (C19), 44×44 at the C15 slot, in every live and pre-snap state. It is hidden in the final, replays and `practice`.
  - **The menu (`PauseMenu.tsx`, `pause.css`):**
    - Resume
    - Controls: the §6.2 map, the Burst-button pref, and later the Auto-defend switch
    - Sound and Haptics
    - Quit, offline through `onQuit`/`quitText` (C4)
  - **Offline,** pause freezes the fixed-step loop, replays, the kick meter and every between-play timer, through the new pause-aware `football2/clock.ts` `after(ms, fn)`.
  - **Auto-pause** on `visibilitychange` to hidden and on `pagehide`.
  - **Online,** pause freezes only your own game and shows your takeover deadline. Forfeit is added in nfl-9.
  - Playtime `pause()` is wired here (C21).
- **Copy:**
  - `play-feedback.ts` NFL lines
  - `Arcade.tsx` pass and run rows: "Pass: tap a receiver or drag back to aim · left stick moves the QB · push past the ring to burst"
  - the Training NFL tips (an unowned file, listed)
  - `docs/NFL-DIRECT-CONTROL.md`

**Acceptance**
- **`gameplay.test.ts`:**
  - Pocket displacement is 1.5–5 yd in 1 s with a `Pt`, and none beyond the drop with `null`.
  - `throwAway` inside the box returns false; outside it is never intercepted over 500 seeds.
  - The automatic scramble fires when the QB crosses the line and never before.
  - A scramble throw is refused after the line.
  - A slide always ends as a tackle with no fumble (500 seeds).
  - A sack sets the acts.
  - The same inputs give an identical `PlayEnd`.
  - The C9 "engine never reads act" test passes.
- **Burst:** `stamina` traces are identical over 200 seeded runs whether burst comes from the ring or from the D button.
- **`gestures.test.ts`:** synthetic sequences for every ownership rule, tap vs drag at the thresholds, icon tap vs drag, swipe off A (left/right), the cover-ball hold with the stick held, and the second finger never being the stick pointer.
- **Human proxy, `pocket: true`, Pro gold:**
  - sacks ≥ 3 points lower than `pocket: false` (baseline 12.2%)
  - throwaways 1–4% of dropbacks
  - INT up by ≤ 0.3 points
- **New `scripts/qa/nfl-controls.mjs`** (A–E plus reduced motion):
  - The §2 layout checks: centres within 4 px of V2 §A.5 at A and C, ≥ 44 px, gaps 10–18 px, at most 4 right-thumb targets in every state, none in the top two thirds.
  - A thumb held in the zone before the snap moves the QB on the first engine step after the snap, on 10 of 10 tries.
  - Crossing the sprint ring at 1.15× the radius sets `p.bursting` within 1 frame.
  - With the Burst-button pref on, D bursts and the ring does not.
  - Icons sit within 12 px of the receivers' heads, with an effective ≥ 44×44 hit area for every eligible receiver in the tightest alignment (slot and TE stack).
  - pointerdown to throw ≤ 16 ms.
  - THROW AWAY shows only outside the box.
  - In landscape no control covers the RB or slot.
  - **Pause:** `p.t` drifts 0 over 3 s; a hidden-page event pauses within one frame; offline quit reaches the host's `onQuit`.
  - 0 page errors.
- **Regression:** `joystick.mjs`, `rushing.mjs` and `core-gameplay.mjs` pass through the guard, with selectors updated where the cluster moved.

**Screenshots.** A, C and D: pre-snap with SNAP/AUDIBLE, the pocket with icons and the reticle, THROW AWAY, the C chip, the carrier cluster, the pause menu, and the Burst-button layout. Each sits beside the mock-up's "NFL · pre-snap" and "NFL · ball carrier" frames.

**Protocol:** needed. **Saves:** the `fb2-burst-button` pref (tested).

**Cut line, in order:**
1. the second-finger cycle → nfl-10's polish list
2. the Controls diagram drawing → nfl-3

The Stick, the cluster, the pocket, THROW AWAY/SLIDE, the icons, the reticle and pause are never cut.

**Dependencies:**
- nba: C15, C16 and C19 (we build on the local fallbacks if they haven't landed)
- players: the C9 acts

### nfl-3 (P0, slice #3): the screen: camera, action-safe box, 124 px tray, HUD kit, overlays, load and pacing (P-1, P-3, P-4, V-1, V-3, V-4 display)

**Commit points:**
1. **`camera.ts` alone, committed, with the C14 notice to players that day**
2. the tray
3. HUD kit adoption and the toast queue
4. overlays and copy
5. load and pacing
6. QA

**Changes**
- **New `football2/camera.ts`** (V2 §B.2.3). The `render.ts` hunk is a call only.
  - **Framing:**
    - Pre-snap, the line of scrimmage sits at **45%** of the height; live, the row eases to 0.58.
    - The horizon is at **6%**, so stands take ≤ 12%.
    - Scale makes near players **34 design px** tall and far players about 22.
  - **Dynamic zoom:**
    - pull back up to **25%** (0.75) while a deep route or lob's landing reticle would leave the action-safe box
    - push in **15%** (1.15) with 2+ defenders within 3 yd of the carrier or on contact
    - Clutch staging adds 6% (nfl-9 sets the flag)
    - fixed at 1 under reduced motion
  - The controlled player and his target (the reticle, or the carrier on defense) are kept inside the C15 action-safe box.
- **New `PlayTray.tsx` and `play-tray.css`, replacing `.fb2-call`.**
  - **Size:** ≤ **124 px** tall at A, above the controls' row.
  - **Cards:** 3 suggested cards, with a horizontal swipe into the full book. On 4th down the cards become [best play] [FIELD GOAL] [PUNT].
  - **Header:** down and distance, and LAST PLAY as one line. The readout leaves the field (V2 §C.5 rule 6).
  - SNAP is on A and AUDIBLE on B (nfl-2).
  - Dragging the field collapses the tray to a 44 px bar.
  - **The defense variant** (3 calls) is laid out here and wired in nfl-8.
- **HUD kit (C19)** through `shared-v2.ts`:
  - **One 232×40 score bug:** YOU, the drive label and clock, RIVAL, and the 3 px drive-progress line. The drive marks and the old chips move into it.
  - **The Heat bar** under it. It shows today's QB On Fire streak until nfl-4 swaps in Heat.
  - **The toast line:** one line, its bottom edge at the C15 position. It carries hints, results ("TACKLED BY <name>", "FIRST DOWN"), PERFECT words, the ability pop and the momentum hint.
  - **V-4:** at most **one** ability pop per play, the first that changed the play, in the toast line. The existing seeded per-play roll is unchanged.
- **New `football2/overlay.ts`:**
  - **Ground rings** in V2 §C.1.3 colours, drawn under the sprites:
    - the gold ring under your controlled player
    - a teal ring under the pass target
    - a red pressure arc on the side the rush comes from
  - **Run lane:** a faint lane arrow to the hole for run calls, pre-snap and through the mesh.
  - **The ball:** ≥ 4×3 px, with a shadow ring and a 3-dot trail.
  - **The incompletion bounce** (G-6): 0.6 s, render-only. Under reduced motion the ball fades in place.
  - **The first-down line** flashes on a conversion.
- **P-3:** the playbook dialog fits within [12, vw − 12] at A–E (`box-sizing`, `min-width: 0` on its grid cards).
- **P-4 copy:**
  - every `Football2` tip
  - `Arcade.tsx:390`'s "a tie goes to the better team", which becomes the C2 OT line
  - "from your own 25", which becomes "from where the kickoff leaves you"
  - the Training NFL tips
  - shell's `arena-tips.ts` NFL lines, reviewed in `nfl.md`
- **Branding:** "Truck Stick" is displayed as "Bulldozer" (C13). New copy avoids "Hit Stick", "X-Factor", "Superstar" and "in the zone".
- **Load:**
  - `Football2` and `Arcade` skip `loadAttrs()` when `offense` and `rivalDefense` (or `teams`) are given, with `attrs = () => null`. UT matches therefore fetch none of `nfl-attrs`.
  - `ps:arena-ready` is dispatched after the first drawn frame.
- **Pacing:**
  - whistle to tray 0.6–0.8 s (from 1.35 s), 0.8 s on a first down
  - TD to tray ≤ 2.5 s, or ≤ 0.4 s after a tap
  - celebrations (1.2 s) skip on a tap
  - replays only on TDs and takeaways
- **Playtime (C21):** the one-line Arcade hunk, plus the `input()` calls on the inputs nfl-2 built.

**Acceptance** (`scripts/qa/nfl-presnap.mjs`, A–E plus reduced motion):
- **Formation visible:** every offensive body and the line of scrimmage sit above the tray top − 6 px at A, B, C and E. At D, no body is inside the tray.
- **Line of scrimmage** at 43–47% of the height pre-snap at A and C.
- **Tray:** ≤ 124 px at A, ≤ 124 px at C and E (baseline ≈ 236).
- **Sizes:**
  - near players 32–36 css px at A (baseline 12–25); far players ≥ 20
  - the ball ≥ 4 px in flight
  - stands, sky and bug take ≤ 15% of the height at A (baseline 27%)
- **Dynamic zoom is not vacuous:** with reduced motion off, zoom drops below 0.85 on a seeded deep ball, and the reticle stays inside the safe box on 20 of 20 deep throws. With reduced motion on, zoom stays at 1.
- **No overlaps:** pairwise intersection area 0 at A–E among the bug, Heat bar, pause button, toast line, tray, icons and the A–D cluster.
- **Text:** every HUD text ≥ 10 px; every toast is one line (≤ 28 px) at C and E.
- **Playbook:** `scrollWidth === clientWidth` at A–E.
- **`hud.test.ts`:** toast priorities, the one-pop rule, and clearing on phase change.
- **Ability roll:** fires on 45–55% of ≥ 2,000 eligible plays; pops ≤ 1 per play (baseline 0.7–2.4).
- **Load:** PLAY to first playable tray ≤ 1.6 s at 1× and ≤ 4 s at 4×; 0 bytes of `nfl-attrs` in a UT match.
- **Pacing:** whistle to tray 0.6–0.8 s over 20 plays.
- **Profiler:** ≤ 2 commits per second during live play outside input.
- **Determinism:** the incompletion bounce and rings are render-only. Seeded results are identical with them on and off, in the style of `juice.test.ts`.

**Screenshots.** A–E: pass call, run call with the lane, 4th down, collapsed tray, the toast line with TACKLED BY, and a deep ball zoomed out. Each sits beside the audit's `*-01`, `-02`, `-08` and `-12` shots and the mock-up's pre-snap frame.

**Protocol:** none. **Saves:** none.

**Cut line:** the crowd-swell audio cues → nfl-10's polish list. The camera, the tray, the bug, the toast line and load are never cut.

**Dependencies:**
- nba: C19 (local fallback until it lands)
- players: the C14 notice; the venue palette (theirs)
- shell: `--sat`
- ut: C21

### nfl-4 (P0, slice #5): the gold ring, Heat and the match grade

**Commit points:**
1. `shared-v2.ts` ring and Heat fallbacks, and touch timestamps into engine time
2. the sling ring
3. PERFECT juke and spin
4. Heat replaces the QB's On Fire
5. chime, haptics and words
6. the grade, with the human proxy timing model and fast CAL

**Changes**
- **Timing.**
  - Every timed input carries `touchTime(e, anchor, calibrationLag())` (C17). The anchor is refreshed each frame from `performance.now()` and `p.t`.
  - The engine applies an input at the next step and judges it against the ring with its exact engine time.
- **The sling ring** (§6.2). `engine.ts` `throwTo` takes `judge` and the ring state:
  - **gold + perfect** → zero placement error, catch guaranteed, no INT roll
  - **good** → today's accuracy model
  - **early or late** → error × 1.3
  - **amber or red** follow the §6.2 rules
- **The separation halo:** green or amber on each icon, from the same openness value the AI reads. It is computed in the engine and drawn by `ReceiverIcons`.
- **Tap throws** use the `good` path, so they never beat a PERFECT sling.
- **PERFECT juke and spin.** The tackler's existing wind-up (`windupOf`, `WIND_R`) becomes the gold ring around him:
  - The window is centred on the moment he commits, with a half-width of `windowHalf(lerp(0.035, 0.075, rt(JKM or SPM, AGI)), …)`.
  - **Perfect:** he misses and plays `stumble` for 0.8 s (event `stumble:<id>`), and the carrier keeps 90% of his speed.
  - **Early:** the cut is slowed (today's early penalty).
  - **Late:** wrapped. Until nfl-7 adds the contest, this is today's tackle.
- **Heat (C18)**, stored in `Game` for each side.
  - **Gains:** PERFECT moments, TDs, takeaways (from nfl-8), clean first downs, turnovers, and points conceded (solo only).
  - **The reset** is after drive 2.
  - **HEATING UP (66):** the ball trail, and the crowd lifts.
  - **ON FIRE (100), for your next 3 snaps:**
    - gold windows ×1.25
    - amber becomes gold on uncontested attempts
    - the ball burns
    - the first score while On Fire gets the slow-motion replay
  - **It replaces** `drive.ts`'s 3-completion `fire` and `fireAtFor()`. The QB's "sees the whole arc and throws quicker" On Fire effect is removed, because ON FIRE's wider gold covers it.
  - **The AI side.** The AI earns Heat by the same rules. Its "perfects" are seeded rolls at its skill. Its On Fire scales its defenders' tackle-ring and pick odds ×1.25 in solo. The AI defense in online games has no Heat (symmetric, C5).
  - **Revision 2's defensive On Fire (§8.6.1) is cut,** replaced by Heat (V2 §F.2 nfl #6).
- **Words and feel** (V2 §B.0.5):
  - PERFECT in the toast line, scaling 1.0 → 1.25 → 1.0 over 220 ms
  - `perfectChime(streak)` and `haptic('double')`
  - a juke hit-stop of 50 ms through `feel.ts`
  - the toast names TIMING, PRESSURE or RANGE on a non-gold result
- **`MatchGrade` (C22)**, accumulated in `Game`: `perfects`, `chances`, `heatBest`, `lit` and `flawless`. The letter uses a provisional `PAR` that nfl-10 fits. It is attached to finished `Progress` only. Per-player PERFECT counts are kept for nfl-9's `pf` box key.
- **`sim-kit` human pilot:** release error σ = 50 ms around each ring centre, at a 0.35 s stick reaction (§2).

**Acceptance**
- **`perfect.test.ts`** (or our fallback's test):
  - Property test over ratings 40–110, every difficulty, and On Fire on or off: the half-width is ≥ 30 ms, and ≤ 110 ms full width before the On Fire scale.
  - At 60 Hz the window never falls between two steps unjudged.
- **"Gold never lies"**, over 10,000 seeded releases at the ring centre for each moment:
  - gold slings: 0 incompletions and 0 interceptions
  - gold jukes/spins: that tackler misses on 100%
- **Gold is honest the other way:** it is never offered in a red or amber state (property test on the state function).
- **Screen size:** the gold segment is ≥ 8 css px at A and at C for a 70-rated QB and a 70-rated back, and ≥ 1.4× wider for a 95 than for a 70 on the same throw.
- **Human proxy (σ 50 ms), Pro gold:**
  - PERFECT on 25–45% of gold chances
  - completion stays in nfl-6's guard band (55–75%)
  - deep completion ≤ 50% (it is fitted in nfl-6)
- **Heat:**
  - unit tests for every gain, the 66 and 100 thresholds, 3 snaps of On Fire, the reset after drive 2, and the rival bar computed from `ends`
  - the same inputs give identical Heat
  - the human proxy at Pro reaches HEATING UP in ≥ 50% of games and ON FIRE in 20–45% (a starting band, fitted in nfl-10)
- **Grade:** `grade` is never in an `onProgress` payload. `flawless` iff win and 0 turnovers. The letter is deterministic.
- **Live (A and C, normal and reduced motion):**
  - the gold arc is visible on the reticle and on a tackler
  - PERFECT shows on a scripted gold release, with the chime called once
  - reduced motion keeps the ring and colour and drops the scale
  - pointerdown to judged release is computed from the event `timeStamp`, not from the frame (a CDP check with an injected 30 ms frame delay gives the same judgement)
- **Regression:** `ratings-matter.test.ts`, `juice.test.ts` and `gameplay.test.ts` stay green.

**Screenshots.** A and C: the sling gold, amber under pressure, RANGE red, a PERFECT juke with the stumble, HEATING UP, ON FIRE with the burning ball, and a final with the grade fields shown in the existing result card.

**Protocol:** needed. **Saves:** none (the calibration value is nba's).

**Cut line:** none for the ring, Heat and the grade; this is slice #5. The AI's seeded perfect rolls fall back to "AI earns Heat only from scores and takeaways" if needed, and that is recorded.

**Dependencies:**
- nba: C17, C18 (local fallbacks until they land)
- ut and soccer: C20

### nfl-5 (P0/P1): the AI's football brain: defensive calls, AI QB reads, play calling, suggestions and difficulty (D-1, D-3, P-2)

This comes before passing calibration, so nfl-6 calibrates against the real coverage mix.

**Commit points:**
1. the difficulty helper
2. `calls.ts` and the alignment
3. AI reads and wind-up
4. AI play calling
5. tray suggestions and AUDIBLE
6. formations (cut line)
7. fast CAL and QA

**Changes**
- **`difficulty.ts`:** `rivalOffenseFaces(online, level?)` (C5).
- **New `football2/calls.ts`, the D-1 call table.**
  - **Calls:** Cover 0, 1, 1 Robber, 2, Tampa 2, 3, 4, Fire Zone, Sim Pressure, Goal Line and Prevent.
  - **Per call:** the shell, each defender's job and 3–6 rushers.
  - **Protection:** the RB on a check route and the TE pick up a free blitzer.
  - **Calling:** Rookie random among 4 calls; Pro situational; Legend situational plus counters and disguise.
  - **Rotation** after the snap: Legend 25–35%, Pro 10–15%, Rookie 0%.
  - **The FREE RUSHER flame** (SVG) shows only for a truly unblocked rusher.
  - **Families:** every call carries a family tag (BLITZ / MAN / ZONE), which nfl-8's defensive tray uses.
- **AI QB reads (`autopilot.ts`):**
  - Reads are timed relative to the set: the first at set + 0.15–0.45 s by AWR, then `lerp(0.55, 0.32, rt(AWR))` between reads.
  - A release wind-up of 0.35–0.45 s.
  - Read caps: Rookie 1–2, Pro 2–3, Legend by AWR.
  - Rookie locks onto a covered man 25% of the time.
  - Then a checkdown, or a throwaway when hurried.
  - Scrambles when pressure > 0.7 with a 5+ yd lane.
- **AI play calling:** pass share by down from `situation(g)`, plus the 4th-down chart.
- **Tray suggestions (P-2):**
  - `choices(g)` deals the tray's 3 cards from the same table.
  - **Coach Pick:** a badge and a one-line reason from the shown shell ("Two deep: the seam is open"), shown in the toast line.
  - Every card carries a "beats Cover 3 / man / blitz" note.
- **AUDIBLE on B:** flips the picked play to its run/pass mirror in the same formation. The defense keeps its call. Re-opening the tray allows a full change before the snap.
- **Formations (cut line):** Gun Trips and Singleback, with playbook tabs. `nfl-controls.mjs` re-checks icon hit areas on Trips at C and E.

**Acceptance:** revision 2's nfl-5 bands, unchanged:
- **Call mix** (1,000 Pro snaps):
  - ≥ 6 distinct calls
  - 3rd and 7+: ≥ 30% two-high or blitz
  - red zone: ≥ 30% man, Cover 0/1 or Goal Line
- **Beaters:** every call has a concept that completes ≥ 10 points above its average against it, and every concept has a call that holds it ≥ 10 points below.
- **Blitz risk and reward:** sacks ≥ 1.5× base; allowed 20+ yd plays ≥ 1.3× base.
- **FREE RUSHER is honest:** the rusher is unblocked ≥ 90% of the times it shows; it shows on 40–60% of unblocked blitzes on Pro and 20–35% on Legend.
- **Coach Pick is useful:** its card beats the mean of the other two on ≥ 60% of counterfactually replayed snaps.
- **AI pass share by down:** 41–53 / 53–65 / 68–80 / 56–68%.
- **AI behaviour:** goes for it on 4th down 1.0–2.0 times per 11-drive game; time to throw 2.4–3.0 s (baseline 1.31–1.63); scrambles 3–7%.
- **Fast-CAL guard bands:** completion 55–75%, INT ≤ 4%, YPC 3–6.
- **UI at A–E:** the tray with Coach Pick and notes, the AUDIBLE flip, FREE RUSHER, the §2 layout checks.

**Screenshots.** A, C and D: Coach Pick, FREE RUSHER, a Legend rotation before and after, AUDIBLE, and Trips if built.

**Protocol:** needed. **Saves:** none.

**Cut line, in order:**
1. formations → §9
2. Cover 1 Robber and Tampa 2 → §9

The call table core, AI reads, play calling, suggestions and the helper are never cut.

**Dependencies:** nba (C5).

### nfl-6 (P0): passing realism (completion and INT by depth, sacks, deep balls, targets, top tier, rating spread, catch types)

**Commit points:**
1. the INT facing rule and shape
2. deep balls, the deep ring and targets
3. sacks and scrambles
4. catch types and spreads
5. the promo tier
6. the play log (cut line)

**Changes** (`engine.ts`, `autopilot.ts`): revision 2's nfl-6, with V2's ring folded in.
- **Facing rule:** `facingBall(d, at)` within 75° and after `breakAt`, or it is a deflection. It is shared with nfl-8's PICK ring.
- **INT shape:**
  - the lane pick is capped at 0.35
  - contested `pi` scales × 0.3 / 0.6 / 1.0 / 1.4 by air yards
  - Ballhawk +0.05
  - interceptable throws under pressure ≈ 5.5%
- **Deep balls (G-2):**
  - deep defenders keep ≥ 1.5 yd over the deepest receiver until the throw
  - `breakAt` comes 0.06 s sooner on flights ≥ 1.3 s
  - a trailing defender cuts the catch chance by 0.08–0.15
  - **plus V2's deep ring:** base × 0.7, and never gold under pressure (§6.2)
- **YAC:** pursuers pay a reaction lag of `lerp(0.35, 0.15, PRC)` after a catch.
- **Targets (G-3):** route and read fixes so WR2 and the TE draw real targets.
- **Top tier (G-4):**
  - `routeWinChance` clamped to [0.15, 0.85]
  - a floor on coverage lag
  - the `defIQ` lane-play chance capped at 0.55
  - checked on the elite and promo fixtures
- **Sacks:** the pressure ring at 2.6–3.4 s (mean 2.9 ± 0.3); median time to sack 3.8–4.5 s; sack yardage −6.5 ± 1.5; scrambles 7.5 ± 2 yd.
- **Automatic catch type** (possession / YAC / contested), emitted as `catch:*` for players' clips.
- **Rating spreads:** QB accuracy, pressure and pocket sense; receiver CTH/CIT and YAC.
- **Pass plays (cut line):** PA Post and RB Screen.
- **Play log (cut line):** `playlog.ts` and the `fb2-playlog` pref, shown under pause → Controls → "My play stats".

**Acceptance:** revision 2's bands, measured with the nfl-4 timing proxy.
- **Facing rule:** no interception by a defender turned more than 75° from the ball, over 2,000 seeded passes.
- **AI Pro gold v gold:**

  | Measure | Band |
  |---|---|
  | Completion | 62–67% |
  | By depth: behind / 0–9 / 10–19 / 20+ | 74–84 / 67–77 / 49–61 / 30–42% |
  | INT | 1.8–2.6%, rising with depth (baseline 3.0) |
  | Sacks | 5.5–8.5% (baseline 3.2), at −6.5 ± 1.5 yd |
  | Time to throw | 2.4–3.0 s (baseline 1.51) |
  | YAC | 4.2–5.8 |
  | Y/A | 6.3–8.0 |
  | 20+ yd gains | 7–11% of attempts |
  | Scrambles | 3–7% |

- **Human proxy, Pro gold:**
  - completion 58–67%
  - deep completion **33–45%** (baseline 57–62)
  - 20+ yd gains 7–11% (baseline 19.3)
  - sacks 6–9.5% (baseline 12.2), and ≤ 12% on Legend (baseline 25.1)
  - "gold never lies" still holds (0 failures on gold over 10,000 releases)
- **Pressure:** completion under pressure ≥ 0.5 is ≥ 15 points below throws under ≤ 0.2 pressure.
- **Targets:** X, Z and SL 12–30% each, TE 12–25%, RB ≤ 22%. A WR 95 at Z instead of a 70 gives Z ≥ 1.25× the catches and yards.
- **QB clamps:**
  - 99 QB: completion ≤ 74%, INT ≥ 0.8%, sacks ≥ 3%
  - 60 QB: completion ≥ 54%, INT ≤ 4.5%, sacks ≤ 12%
  - 92 vs 75: +4 to +9 points of completion
- **Receiver spread:** catch rate 57–77% from CTH 60 to 95; YAC 3.0–6.7.
- **Top tier:** elite and promo on Legend within 25% of gold in points per drive, with INT ≤ 3.5% and turnovers on ≤ 15% of drives (baseline promo: INT 8.2%, turnovers on 37.3% of drives).
- **Catch types:** each ≥ 10% of catches.
- **Rigour:** every band from ≥ 400 events, with its interval.

**Screenshots.** A: a deep shot against Cover 3 with an amber ring under pressure, a facing INT next to a trailing swat, a contested high-point.

**Protocol:** needed. **Saves:** `fb2-playlog` if built.

**Cut line, in order:**
1. the play log → nfl-10's polish list
2. PA Post and RB Screen → §9

**Dependencies:** nfl-4 (ring), nfl-5 (calls); packs (fixtures, C13).

### nfl-7 (P0): run game, moves, wrap contests and the truck charge (G-1, G-5, C-4; V2 §B.2.4)

**Commit points:**
1. run designs and run tails
2. contact as a contest, and `PlayEnd.by`
3. POWER/truck on C and DIVE/SLIDE on D
4. stamina and the automatic moves
5. juice
6. the first full CAL

**Changes** (`engine.ts`, `types.ts`, `drive.ts`, `autopilot.ts`, `Football2.tsx`)
- **Run identities:**
  - **Inside:** a double team climbing to the MLB at 0.6–0.9 s.
  - **Power:** a pulling backside guard (Job `'pull'`).
  - **Outside:** a stretch with a cutback when the backside DE crashes.
  - Lanes are picked by BCV. They match nfl-3's lane arrow.
- **Run tails (V2 §B.2.4):**
  - LB overrun or misfit on 10–20% of runs, by PRC
  - safety angle error × (1 − PUR)
  - the closing burst drops to +2–5%
- **Cuts by rating:** a 90° cut keeps 80% of speed for an elite back and 55% for a lineman. The plant shows through the `cut` clip (C9).
- **Wrap tackles are contests (G-5, V2 §B.2.4).**
  - Contact starts a 0.25–0.5 s wrap, by the tackler's TAK and the carrier's momentum: `p.contact = { since, tacklers, drive }`.
  - A POWER/JUKE/SPIN inside the wrap breaks it by rating. Timed to the wrap's gold flash (C17; ±30 ms floor; gold offered only when one tackler is wrapping), it **always** breaks that tackler.
  - Each extra defender within 1.2 yd joins and shortens it by 0.15 s; 3+ bodies is a pile.
  - The play ends with 'TACKLED BY <tag>' or '<tag> & <tag>' in the toast line.
  - `PlayEnd.by?: string[]` (no RNG) feeds the box score and the recap.
- **Moves (C-4), per §6.2:**
  - **JUKE direction:** the stick side, or a swipe off A.
  - **POWER on C:** a tap is the stiff arm; a hold charges a truck for up to **0.6 s** at speed × 0.85 (tackleable from behind); a release near full adds +0.1 truck edge. A truck win has a 90 ms hit-stop and the loser plays `fall_back`.
  - **DIVE/SLIDE on D:**
    - DIVE: +1.0–1.5 yd, fumble × 0.3
    - a goal-line reach: +0.3 yd, but fumble × 1.5 if hit
    - SLIDE: from nfl-2
  - **Cover ball:** fumble × 0.3, speed × 0.9, no moves.
- **Stamina across a drive:** `Game.fatigue[rbId]` carries into the next play and resets at the end of the drive. It is shown on the RB chip pre-snap.
- **Automatic stiff arm and hurdle:** by STR/SFA and SPD/AGI against a low diving tackler, at 0.25× a manual move's edge, never guaranteed.
- **`football2/feel.ts` `impact()`** is the single hit-stop and shake site (C10). V2 §B.2.7 adds pad-crack layers by hit size and turf pellets on cuts and hits (render only).
- **Run plays (cut line):** HB Draw, QB Sneak, Toss and Counter.
- **Copy:** Training run tips, the Arcade run row, `play-feedback.ts`, and `docs/NFL-RUSHING.md`.

**Acceptance**
- **`rushing.test.ts`:**
  - a juke with dir −1 moves Δx < −1 yd in 0.4 s
  - a dive gains ≥ 0.8 yd
  - cover ball keeps fumbles ≤ 0.4× normal over 5,000 hits
  - yards after first contact ≥ 1.0 for a power back and ≤ 0.5 for a scat back
  - a gang tackle resolves within 0.35 s
  - the wrap lasts 0.25–0.5 s
  - **a gold-timed break beats a single wrapping tackler 100% over 5,000 seeds**
  - the truck charge takes ≤ 0.6 s
  - fatigue carries across plays
  - 99+ backs stay finite
  - `PlayEnd.by` names the right ids
- **CAL, AI Pro gold v gold, designed runs:**

  | Measure | Target | Baseline |
  |---|---|---|
  | ≤ 0 yd | 15–21% | 8.9% |
  | 1–3 yd | 32–40% | |
  | 4–6 yd | 20–27% | |
  | 7–9 yd | 8–13% | |
  | 10+ yd | 9–13% | 1.1% |
  | 20+ yd | 1.5–3% | |
  | 40+ yd | 0.2–0.8% | |
  | Median | 2–4 | |
  | Mean | 4.0–4.7 | 4.01 |
  | P90 | 8–11 | |
  | P99 | ≥ 18 | |

- **Spreads and matchups:**
  - RB spread YPC 3.75–5.2 from the 10th to the 90th percentile back
  - elite D v gold RB: 3.3–3.9 YPC
  - elite RB v gold D: 5.0–6.0 YPC
  - Power converts ≥ 65% on 3rd/4th and 1
- **Other bands:**
  - missed tackles 12–20%
  - fumbles lost 0.5–0.9% of carries
  - human proxy 3.8–4.8 YPC
  - SPD 95 v 70: 10+ rate ≥ 1.5×
  - automatic moves fire on 3–8% of contacts for 90+ backs and ≤ 1% for ≤ 70
- **Controls QA** (`nfl-controls.mjs` re-run, A–E and landscape): C hold charges and releases; D shows only in context; the cover-ball hold works with the stick held (two CDP touches); the §2 layout checks.
- **First full CAL:** every band from nfl-4 to nfl-7 in one run. Any band that moved is fixed or recorded.

**Screenshots.** A, C and D: Power with the pulling guard, a wrap with the gold flash, a gang tackle and pile, the truck charge, a dive, the stamina chip.

**Protocol:** needed. **Saves:** none.

**Cut line:**
1. the four run plays → §9
2. the automatic hurdle → §9 (the stiff arm stays)

**Dependencies:** nfl-4 (ring); players (`cut`, `stiff_arm`, `stumble`, `fall_back` clips; `impactOf` at merge).

### nfl-8 (P0 by OD-2/OD-3): solo defense with BIG HIT and PICK rings, Auto-defend, SIM DRIVE, played takeaway returns and a 4–6 minute game (D-2)

**Commit points:**
1. the engine user-defender, the BIG HIT and PICK rings, and the determinism guard
2. the alternate flow and the defensive tray
3. key snaps, Auto-defend, SIM and the recap
4. played takeaway returns
5. session-length tuning and QA

**Changes**
- **Engine:**
  - `Play.user?: { id; input: Pt; tackleAt?: number; pickAt?: number; swatAt?: number }`, in engine seconds, applied at the next step.
  - **TACKLE (A)** dives in range (2.6 yd).
  - **BIG HIT:** the gold ring on the carrier (C17). The window is `windowHalf(lerp(0.045, 0.080, rt(HIT, TAK)), …)`. Gold = a tackle that ends the play now, with a 6–8% fumble roll (+2% Enforcer), an 80–100 ms hit-stop and the carrier's `fall_back`. Early or late = a wrap with nfl-7's broken-tackle contest.
  - **PICK:** the ring on the ball at the catch point when your man faces it and can reach it (nfl-6's facing rule). Gold = an interception. Facing away gives SWAT, amber.
  - Everything is inert without `p.user`.
- **Flow:**
  - `Football2` gets `solo?: { rivalOffense; ourDefense; skill; defIQ }` and `onRival(p)`.
  - Online is unchanged.
  - One renderer with swapped kits.
  - The camera keeps the broadcast view behind the AI's offense, and your defender wears the gold ground ring (V2 §B.2.3).
- **`DefenseDrive.tsx` and `defense.css`:**
  - the tray shows 3 calls from nfl-5's table at your level, one per family where possible, plus ALL CALLS
  - READY on A, SWITCH on C
  - tap a defender to take him; the default is the deepest safety or the MLB, by call
- **Key snaps, SKIP, and the `fb2-defense-snaps` pref** (`'key'` default, `'all'` "Longer games").
- **Auto-defend (C6):** every AI snap at 3×. The toggle is on the defensive tray and in pause → Controls, through `src/game/match-prefs.ts`. It **never calls playtime `input()`** (C21).
- **SIM DRIVE** resolves the rest of an AI drive instantly from its seed. It is allowed in manual-only modes, and the match stays `'played'`.
- **The D-2 recap** (≤ 20 s, skippable): a drive chart, 2–3 key plays replayed through the renderer, and your defenders' names from `PlayEnd.by`.
- **Played takeaway returns (V2 §B.2.1):**
  - After your INT or forced fumble on a key snap, **you steer the returner** with the stick, using the carrier controls (JUKE/SPIN/POWER), until he is down or out.
  - Your next drive starts where the return ended, clamped between your own 20 and their 20, through a pure `nextStart(prevEnd)`.
  - On auto snaps, the return is a seeded render with a cut under reduced motion.
  - The AI's next drive starts from your punt landing spot or your turnover-on-downs spot.
  - The slow-motion replay is kept for takeaways.
- **Heat on defense:** a stop or a takeaway +15 for you; points conceded −10.
- **Online rival ticker (cut line):** "RIVAL · DRIVE 2 · TOUCHDOWN" in the toast line as each rival end arrives.
- **Defend drill (cut line):** `practice.drill = 'defend'`, offered to ut as a defensive Moment.

**Acceptance**
- **Engine:**
  - the defender follows input
  - TACKLE only in range
  - the window matches its formula and its ±30 ms floor
  - **gold BIG HIT ends the play on 100%**, and **gold PICK intercepts on 100%**, over 5,000 seeds each
  - PICK gold is never offered to a defender facing away (property test)
- **Determinism guard:** identical hashes before and after for 200 seeded AI plays without `p.user`, `aiDrivesOf`, `simMatch` (with OT) and takeovers.
- **Proxy defender bot** (0.35 s reaction, σ 50 ms timing), Pro gold: the AI's points per drive against a played defense are within ±25% of SIM DRIVE over 300 drives.
- **Takeaways:** the next drive after a played return is worth **+1.5 to +2.5 expected points** over a kickoff start (≥ 400 takeaways).
- **Session length (OD-3):** the wall-clock model over ≥ 20 games each at Rookie, Pro and Legend, with defense played, replays on TDs and takeaways, and OT included:
  - **median 4–6 min, P90 ≤ 6.5 min**
  - defensive drive median 35–40 s; offensive median ≤ 45 s
  - 3 browser autoplay games at 1× match the model within ±10%
  - the §5 fallbacks are applied in order if needed, and recorded
- **Speed:** SIM resolves in ≤ 50 ms. Auto-defend is ≥ 3× and watchable. The recap is ≤ 20 s and skippable.
- **Settlement:** a defensive SIM keeps `how: 'played'`. ut's Cup settlement test still passes in our worktree.
- **`nfl-defense.mjs`** (A–E plus reduced motion):
  - a full solo fixture: call pick, SWITCH, TACKLE, BIG HIT gold, PICK gold, SWAT, a played return, SKIP, SIM DRIVE with its recap, Auto-defend
  - online on the local relay: no defense UI
  - the §2 layout checks
  - the reduced-motion rings still close and show the window
- **Playtime:** a scripted Auto-defend-only stretch makes 0 `input()` calls.
- **Prefs:** tests for `fb2-defense-snaps` and `auto-defend`.
- **Heap:** ≤ 45 MB with defense. **Profiler:** ≤ 2 commits per second.

**Screenshots.** A, C and D: the defensive tray, your defender's gold ring and the BIG HIT ring, a PICK ring, SWAT, a played return, an auto snap at 3×, SIM DRIVE and the recap, the Auto-defend toggle.

**Protocol:** none (solo-only; the guard proves it). **Saves:** prefs.

**Cut line, in order:**
1. the online ticker → nfl-10's polish list
2. the defend drill → §9
3. "Longer games" → §9

The defender, the BIG HIT and PICK rings, the flow, key snaps, Auto-defend, SIM, played returns and the length target are never cut.

**Dependencies:**
- nfl-4 (ring, Heat), nfl-5 (call families), nfl-6 (facing rule), nfl-7 (contest)
- ut: the PreMatch Auto-defend switch
- players: acts

### nfl-9 (P0): match shape: OT as two-point rounds, online forfeit, conversions, two-tap kicking, punts, the Clutch drive, the box score and the rematch; Daily Play (P1) (D-4, D-5 forfeit, C-5, F-1, F-2, V-2, V2 §B.0.4, §D.1, §D.3)

**Commit points:**
1. `match-flow.ts`, `sim-match.ts` and `tryFrom2`, with the two-client tests
2. forfeit and the Arcade hunks
3. conversions
4. kicking and punts with the kick harness
5. the Clutch drive
6. the box score and the final sheet
7. the rematch
8. Daily Play (cut line)
9. fill-ins (cut line)
10. QA

**Changes**
- **OT (C2, amended):**
  - `tryFrom2(g)`: one snap from the 2 with the normal tray, success only on a TD, recorded `P2` or `P0`. It is reused for conversions.
  - `simMatch(...)` appends rounds deterministically for `Arcade.sim()`, takeovers, and `ut/Match.tsx` `simBoth` (a ≤ 6-line hunk, listed).
  - The Arcade NFL branch uses `match-flow` in place of `TOTAL` in `rivalLive`, `finishedFrom`, `shown`, takeover and `taken`.
  - The OT line: "Level after 4 drives: two-point shootout from the 2".
- **Forfeit (C1):**
  - the pause menu's online "Forfeit? <rival> wins" confirm pads `ends` with `FF`
  - `App.tsx` and `ut/Match.tsx` map it in ≤ 6 lines each
  - playtime `abandon()` (C21)
- **Conversions (D-4):** after a TD, KICK XP (94–97% for an average kicker) or GO FOR 2 (`tryFrom2`). Codes `TD`/`TD6`/`TD8`. The AI goes for 2 by chart.
- **Two-tap kicking (C-5), on A:**
  - **Tap 1, power.** KPW sets the range, about `lerp(48, 63, rt(KPW))` yd (+3 for Big Leg). Beyond it, the make chance falls off over 5 yd. Overkick above 0.92 costs accuracy.
  - **Tap 2, accuracy:**
    - the sweep period is `lerp(0.85, 1.35, rt(KAC))` s
    - **the gold band** is the C17 ring: its half-width is `windowHalf(lerp(0.05, 0.11, rt(KAC)) × distance factor, …)`, gold only inside the range (§6.2)
    - wind is seeded per drive and shown as an arrow
  - `kick(g, { power, aim, judge })` decides; `kickNow`'s render follows that result.
  - Blocks happen on 0.5–1.5% of kicks.
  - The snap and hold are shown (the holder pose is requested from players).
  - The AI samples errors; 18–26% of its FGAs are from 50+.
- **Punts:**
  - one power tap; 36–46 yd net
  - in the parallel format, a pin inside the 20 makes your next start 5–12 yd better
  - in solo, the real exchange through `nextStart`
- **The Clutch drive (§5):**
  - drive 4's two-minute drill gains **3 timeouts as pips in the bug**, HURRY (snap the same play without the tray, runoff halved) and SPIKE (an incompletion that takes 1 s)
  - the staging flag for the camera (+6%), the gold CLUTCH bug, the crowd bed, and the heartbeat `haptic('long')` while the margin is one score
  - "FOR THE WIN" in the toast line when the drive can tie or win
  - that drive's score is always replayed
- **Box score (F-2, C3):**
  - `football2/boxscore.ts` folds each `Play`/`PlayEnd` (with `by`) into passing, rushing, receiving, defense and kicking lines, plus `pf`/`bt`/`bh`
  - a `rating` of 1.0–10.0 on every line; the highest is the player of the game
  - in solo, your defenders' lines come from your defensive snaps
  - `Progress.box` and `Progress.grade` go on finished progress only
- **The final sheet (V2 §D.1).** The arena stays mounted behind a dimmed, opaque sheet:
  - 0–2.5 s: WIN/LOSS, the score, the grade letter and the PERFECTS count
  - then the box score's top 3 lines per side and the player-of-the-game card
  - tap skips
  - the One-More bar is ut's (`MatchDebrief`) and the host's. Our part is that the renderer, sprite cache and attrs survive a `seed` change, so a rematch re-seeds without a reload.
  - The draft path (`App.tsx`) gets "RUN IT BACK" through the same re-seed, in a ≤ 6-line hunk.
  - nba writes the shared Arcade "keep mounted" path; we plug the NFL branch into it, or write it if we land first, as with C2.
- **Daily Play (P1, cut line, C23):** `football2/daily-play.ts` with ≥ 28 scenarios, using the Clutch clock, conversions and kicking from this task:
  - "4th and goal from the 6"
  - "down 4, 1:12, from your 35"
  - "two-point try to win"
  - and more of the same kind
  The engine starts from `start`, and `onDaily` reports the parts. ut hosts it and its board.
- **Fill-ins (cut line, V-2):** `fillins.ts` `realDepth(...)`, real seeded names for WR2, slot, DL, LB, CB, S and RB, lazily imported by the draft path only.

**Acceptance**
- **`match-flow.test.ts`:**
  - the `required` sequence, `final` and `forfeitBy`
  - **10,000 seeded tied regulations** through `simMatch`: 0 decided by squad rating, and the most rounds used is reported (< 20)
  - OT adds ≤ 30 s median in the wall-clock model
- **`overtime.test.ts`:** two simulated clients over 500 seeds with random delays agree on the final in regulation, forced OT, a takeover in regulation, a takeover in OT, a quit in OT (`FF`), and `GONE` during OT.
- **Kick-only harness** (≥ 1,000 kicks per 5-yd bin, gold kickers, human proxy σ 50 ms):

  | Distance | Made |
  |---|---|
  | < 30 | 95–99% |
  | 30–39 | 90–96% |
  | 40–49 | 76–84% |
  | 50–59 | 65–76% |
  | 60+ | 30–50% |

  - **Gold inside range is good on 100%.**
  - At 55 yd the window for KAC 55 differs from KAC 95 by ≥ 40%.
  - The range rule holds: KPW 60 ≈ 48 yd and 99 ≈ 63 yd (± 2).
- **Other kicking bands:**
  - XP 94–97% (≥ 2,000 tries)
  - **two-point tries 40–50%** (≥ 2,000)
  - AI goes for 2 on 6–12% of TDs
  - blocks 0.5–1.5%
  - punts 36–46 yd net
- **Clutch:** unit tests for timeouts, spike and hurry-up. Staging is render-only: seeded results are identical with the staging flag on and off.
- **`boxscore.test.ts`:**
  - yards reconcile with the plays
  - points equal the score
  - the player of the game is deterministic
  - `box` and `grade` never appear in an `onProgress` payload
- **`nfl-shell.mjs`** (A–E plus reduced motion; relay runs under the lock):
  - **online, two clients:**
    - A forfeits in drive 2; B shows a win within 5 s and A a loss
    - a forced tie plays two-point rounds on both phones, which settle the same winner
    - the takeover countdown shows below 30 s
  - **final whistle → next snap ≤ 10 s at 4× CPU**, through a scripted REMATCH on a draft game and a UT fixture
  - the renderer instance is the same object before and after (no remount)
  - the final sheet is opaque (a pixel sample behind it shows no route lines)
  - controls ≥ 44 px, text ≥ 10 px, no overlaps
- **Daily Play** (if built): the same day key gives the same scenario; every scenario is completable by the Pro autopilot within `maxPlays` on ≥ 1 of 20 seeds; `onDaily` reports deterministic parts.
- **Moments:** every NFL Moment and Training drill is still completable by the Pro autopilot (verified, not edited).

**Screenshots.** A, C and D: the OT shootout banner, the forfeit confirm, the conversion choice, the two kick taps with wind and the gold band, the Clutch bug with timeout pips, the final sheet with the grade and the player of the game, the rematch tray, and real fill-in names beside the audit's `390-01` ("WR 81").

**Protocol:** needed.

**Saves:** saved match records may contain the new codes (C8 readers). There are no key changes.

**Cut line, in order:**
1. fill-ins → §9
2. HURRY → §9
3. Daily Play → next wave (it is V2 P1 / second wave); the contract stays offered

OT, forfeit, conversions, kicking, the Clutch clock, the box score and the rematch are never cut.

**Dependencies:**
- nba: the Arcade keep-mounted path, C1/C2 shape
- ut: C3/C8 consumers, the One-More bar, the Daily Play host
- players: the holder pose
- lead: the bump

### nfl-10 (P0): game shape, the difficulty ladder, grade and Heat fits, and the team's final QA

This task tunes and measures only. No new features beyond carried-in cut-line items, and those only if the QA budget allows.

**Changes**
- **Game shape:** tuning knobs only, with the full CAL in the real format (4 drives, conversions, OT, defense, Heat, the gold-ring human proxy) and in an 11-drive simulation.
- **Publish `DRIVE_ODDS`** for ut's Club Season sim (C12).
- **Fit `PAR`** (C22) and the "clean" Heat gain (C18).
- **Difficulty ladder:** re-run in the alternate solo format with the proxy defender, plus the online parallel format.
- **Final review:** the Training tips and `arena-tips.ts` NFL lines against the final controls. `nfl.md` is finished: before/after for every §3 metric, "Owner device checks", "Merge steps", "Left undone".
- **Team final QA:**
  - `bash O/heavy.sh npm run typecheck`, `bash O/heavy.sh npm test` (all three sports), and `bash O/heavy.sh npm run build` once
  - every QA script at A–E and under reduced motion (legacy ones through the guard, relay ones under the lock)
  - the full CAL and the kick and two-point harnesses
  - a performance run like `nfl_perf.cjs` on port 5216
  - the final before/after screenshots beside the mock-up frames

**Acceptance**
- **Game shape, AI v AI, gold v gold, Pro** (≥ 400 drives per band):

  | Measure | Target | Baseline |
  |---|---|---|
  | Points per drive | 1.9–2.4 | 3.50 |
  | TD, % of drives | 21–30 | 40.0 |
  | FG, % of drives | 13–20 | |
  | Turnovers, % of drives | 8–13 | 16.8 |
  | DOWNS, % of drives | ≤ 9 | 15.0 |
  | Punts, % of drives | 18–35 | |
  | Red-zone TD / any score | 50–64% / 80–92% | |
  | 3rd down: 1 / 2–3 / 4–6 / 7–10 / 11+ | 60–76 / 45–61 / 37–51 / 25–39 / 9–22% | |
  | 3rd down overall | 35–44% | 45.8% |
  | Plays per drive | 5–7 | |

- **Ties:** OT in ≤ 12% of even games, 0-0 finals ≤ 2%, and 0 decided by squad rating.
- **11-drive simulation:** 21–25 points per team, P10 7–12, P90 32–40; a 3-point margin in 10–17% and a 7-point margin in 6–12% of games.
- **Ladder, alternate solo with the proxy defender** (gold v gold, ≥ 300 games per level):
  - Rookie ≥ 70% wins, Pro 45–55%, Legend 28–38% (baseline 48 / 42 / 34)
  - AI sacks 4–9% at every level
  - AI time to throw 2.3–3.0 s
- **Grade distribution, human proxy at Pro:** S 10–20%, A 25–35%, B 30–40%, C 15–30%. FLAWLESS in 15–35% of wins.
- **Heat, human proxy at Pro:** ON FIRE in 20–45% of games; AI v AI within ±10 points of the human proxy.
- **"Gold never lies":** 0 failures over 10,000 releases per moment (sling, juke/spin, BIG HIT, PICK, kick, wrap break) in the final build.
- **Top tier:** promo v promo on Legend within 25% of gold in points per drive, INT ≤ 3.5%.
- **Session length:** solo median 4–6 min, P90 ≤ 6.5; online race median ≤ 5 min; whistle → next snap ≤ 10 s at 4×.
- **Bundle** (the one build):
  - entry chunk +0 KB gzip
  - Football2/arcade chunk ≤ +35 KB gzip over shell's baseline
  - `daily-play` and fill-ins absent from the UT match chunk unless dynamically imported
  - draft data (`CELLS`) absent from the UT match chunk
- **Performance** at 393×852, 4× CPU, 15 s: frames > 33 ms ≤ 5; long tasks ≤ 250 ms in total; heap ≤ 45 MB with defense.
- **Whole suite:** `npm test`, typecheck and build pass, with 0 page errors in every script.

**Protocol:** needed (calibration). **Saves:** none.

**Cut line:** a band that can't be met is recorded with its closest value, its interval and the §2 priority. Carried-in polish items are dropped before any QA step is:
- the second-finger cycle
- the crowd cues
- the play log
- the ticker

---

## 9. Deferred, cut and rejected

Each item is copied into `nfl.md` with its reason.

**Cut by V2 §F.2 nfl #8** (already deferred in revision 2; V2 agrees):
- **Precision Passing extras and the SNAG catch tap.** The sling's gold ring is the one passing timing skill.
- **Hot routes.** AUDIBLE on B covers changing the call.
- **Crowd pressure on solo road games.** C7 stays as the rule if it ever returns.
- **Earned zones** (per-ability trigger and knockout state, pre-snap zone chips, trigger and knockout on the card face). The one-pop rule ships in nfl-3. Hand-off note: if built, the trigger and knockout text belongs on the card face (players) and in the card detail (packs/ut).

**Cut by revision 3 because V2 replaces them:**
- **The `'panel'` pass layout and its `fb2-pass-layout` pref.** It breaks the four-target rule; the key never shipped.
- **Revision 2's OT drive from the 25.** V2's two-point shootout is shorter (C2).
- **Revision 2's QB On Fire pips and its defensive On Fire (§8.6.1, §8.6.2).** Heat replaces both.
- **The separate lower-third strip, corner readout and drive-clock chip.** They fold into the score bug and the toast line (V2 §C.3, §C.5).
- **Revision 2's "≤ 3 context buttons + the BURST exception" map.** It is replaced by V2's A/B/C/D map with burst on the ring.

**Deferred:**
- **The one-button assist.** Rookie, the momentum carry, tap throws and automatic catch types cover new players.
- **Adaptive counters and Hot/Cold.**
- **Throwing lanes and batted balls.**
- **A defensive camera rotated behind your defense.** V2 keeps the broadcast view behind the AI offense.
- **Player looks, 5-head sprites, the mocap frame plans (V2 §B.2.6), venue palette, crowd sprites, bench and referee.** These belong to players; we supply the C9 acts and events and set the camera scale.
- **The overall-99 cap.** packs/ut.
- **Real names for OL and K fill-ins.**
- **An intentional-grounding penalty.**
- **Kickoff-return mini-plays, pick-sixes and opponent safeties in the parallel format.** These need new wire semantics, a lead decision. Solo played returns ship in nfl-8.
- **A 6-drive "Standard" length.**
- **Era Nights presentation twists (V2 §D.9).** No rule changes; a later ut/packs event can pass era kits and a retro bug label through existing props.
- **Daily Play**, if nfl-9's cut line drops it. It is P1 / second wave in V2 §F.4.

Cut-line items a task had to drop land here, each with the task that dropped it.

**Rejected:**
- **Kneel.** No situation where it helps: the parallel clock never affects the rival, and OT has no clock.
- **OT for `App.tsx` `simH2H`.** It decides by season rating, so no tie arises. This is recorded as a format proposal for the lead.
- **More than 10 tasks.** The work is regrouped with commit points and cut lines.

## 10. Owner device checks (only a real iPhone can confirm)

- **Burst on the stick ring vs the Burst-button preference** (lead decision 2). Which one feels right for the owner's thumbs.
- **The floating stick:** a thumb resting before the snap; the sprint-ring haptic tick.
- **The momentum carry:** catch-and-run without touching the stick; "Momentum carries · steer when ready".
- **The 124 px tray** on the 393×852 phone: formation visible, SNAP on A reachable with one thumb, AUDIBLE, swiping into the book.
- **Two-thumb passing:** the pocket stick plus the slingshot; receiver chips tappable mid-route; the C chip; the reticle readable.
- **The gold ring:** is the sling gold readable at 34 px players; PERFECT jukes; does the chime and double haptic feel right; is the ±30 ms floor fair on the device after the calibration tap.
- **Heat:** HEATING UP and ON FIRE readable; the burning ball.
- **Run controls:** POWER hold-to-truck on C, DIVE/SLIDE on D, cover ball, the wrap gold flash.
- **Defense:** the defensive tray, SWITCH, BIG HIT and PICK timing; whether the broadcast camera reads on defense; Auto-defend at 3×; SIM DRIVE and its recap; steering a takeaway return.
- **Kicking:** the two taps, the gold band, and whether the wind is readable.
- **The Clutch drive:** timeout pips, the heartbeat haptic, "FOR THE WIN".
- **Solo game length with defense,** timed across 3 Squad Battles games (target 4–6 min); a rematch in ≤ 10 s.
- **OT and forfeit on two phones.**
- **Pause** during a phone call (auto-pause) and on resume.
- **Frame pacing** at the start of a play and in a pile; haptics on big hits and sacks (iOS PWA haptics may be unavailable, research-engagement §4.1, so the visual must carry it alone).

## 11. Risks

- **Shared V2 pieces not landed.** nba's Stick, ring, Heat and HUD and ut's playtime may arrive after our tasks.
  - **Mitigation:** one adapter (`shared-v2.ts`) with local fallbacks that follow the §4 contract, plus an import test.
  - At the merge the lead swaps the adapter body (a merge step).
  - Any signature difference is absorbed there, never in NFL code.
- **"Gold never lies" against calibration.** Guaranteed outcomes on gold could push completion and YPC above the bands.
  - **Mitigation:** gold is offered only where the outcome was already likely (green halo, one wrapping tackler, a facing defender, inside the range).
  - The human proxy uses σ 50 ms. nfl-6 and nfl-7 tune the non-gold paths, and nfl-10 checks both together.
  - If a band and the guarantee conflict, the guarantee wins (§2 priority 3), and the band is recorded.
- **Heat changes outcomes online.** It is integer engine state from engine events, deterministic, with no wire field. It is covered by the protocol bump and the two-client tests.
- **Calibration interplay.** nfl-4 to nfl-7 move the same distributions. Each runs fast CAL with guard bands; full CAL at the end of nfl-7 and in nfl-10.
- **Calibration validity.** packs re-rates cards (OD-5). Fixture ids and the snapshot are pinned, and the CAL re-runs on the merged pool (merge step).
- **Scoring looks low in played games.** About 8–10 points a side at 2.1 per drive. The stream's realism target is followed; ties go to the shootout, and the grade compares against `PAR`, so a low-scoring win still grades well.
- **Session length.** The §5 budget is modelled from nfl-1's measured 42.3 s offensive median; the fallbacks are ordered. The last resort, `SOLO_DRIVES = 3`, raises ties to about 16%, recorded.
- **Online OT edge cases.** Covered by the two-client tests in nfl-9.
- **Determinism.** Timed inputs go through `touchTime` and are applied at steps. The kick path follows `kick()`. Staging, rings, bounce and juice are render-only (identity tests). The hash guard covers AI plays, `aiDrivesOf`, `simMatch` and takeovers.
- **File collisions.**

  | File | Also edited by | Mitigation |
  |---|---|---|
  | `Arcade.tsx` | nba (keep-mounted, C1/C2 shape, playtime line), shell-5 `withCurtain` | logic in pure football2 modules; hunks stay tiny |
  | `difficulty.ts` | nba | one helper (C5) |
  | `progress.ts` | nba (its own `grade`) | one shared `grade?: MatchGrade` shape proposed in C22 |
  | `ut/Match.tsx` | ut | `simBoth` → `simMatch`, maps, `onQuit` (≤ 6 lines each) |
  | `App.tsx` | ut, nba | forfeit and re-seed hunks ≤ 6 lines |
  | `football2/render.ts` | players | calls only (`camera.ts`, `overlay.ts`) |
  | `src/game/hud/*`, `Stick.tsx` | nba | small NFL-label hunks only, listed |
  | `styles.css` `.fb2` rules | nba scopes `.hg2:not(.fb2)` | the HUD is re-screenshotted after nba and shell merge |

- **QA isolation.** New scripts use `nfl-lib`; legacy ones run through `nfl-guard`; relay runs take the lock.
- **Performance.** One renderer, kept across a rematch; refs for all per-frame UI; 30 Hz replay snapshots. The 34 px near sprites depend on players' sprite budget, re-measured at integration.
- **Bundle.** `sim-kit`, `nfl_calibrate` and fixtures are never imported by product code (test). Fill-ins and `daily-play` are lazy.
- **Branding.** "Bulldozer"; no "Hit Stick", "X-Factor", "Superstar" or "in the zone". "BIG HIT", "PERFECT", "Heat", "Coach Pick" and "FREE RUSHER" are our own or generic.

## 12. How V2 §F.2 "nfl" maps to this plan

| V2 §F.2 nfl item | Where it is |
|---|---|
| 1. KEEP first: the momentum carry (C-1) | nfl-1 (in progress, kept first) |
| 2. CHANGE: 124 px tray with SNAP on A, LOS at 45%, dynamic zoom, 34 px near players, run-lane arrow; HUD kit | nfl-3 (camera, tray, HUD, overlays); SNAP/AUDIBLE on A/B in nfl-2 |
| 3. CHANGE: receiver icons, slingshot, always-on reticle, pocket stick, RUN IT/THROW AWAY on A; shared Stick with burst on the ring and a Burst-button pref | nfl-2 |
| 4. CHANGE: wind-up ring → gold ring for JUKE/SPIN; truck charge on C; wrap contests; run tails | nfl-4 (PERFECT juke/spin); nfl-7 (truck on C, wrap contests, run tails) |
| 5. CHANGE: BIG HIT and PICK rings on defense key snaps; played takeaway returns | nfl-8 |
| 6. ADD: Heat replaces the standalone On Fire; one ability pop per play | nfl-4 (Heat); nfl-3 (one pop) |
| 7. KEEP: pause/OT, AI brain, passing realism, kicking and box score, final fit | nfl-2 (pause), nfl-9 (OT, forfeit, kicking, box score), nfl-5, nfl-6, nfl-10 |
| 8. CUT: Precision Passing extras, hot routes, crowd pressure, earned zones | §9 |
| 9. ADD (P1): Daily Play scenarios | nfl-9 cut line; contract C23 |
| 10. Protocol: NFL draft 10→11, UT 11→12 | §7 |

| V2 §F.4 slice item (NFL part) | Task |
|---|---|
| #2 shared stick, A/B/C/D, pre-held thumb, sprint ring, pause | nfl-2 |
| #3 camera and the action-safe box | nfl-3 |
| #4 NFL momentum carry | nfl-1 |
| #5 the gold ring, the PERFECT chime and haptic, the toast line | nfl-4 (toast line in nfl-3) |
| #8 One-More / Next up / Minutes (ut) | consumers: C21 playtime calls (nfl-3, nfl-8), C22 grade (nfl-4), the arena kept mounted for the rematch (nfl-9) |

**Shared systems we deliver for V2 §B.0:**
- the gold ring: nfl-4, nfl-7, nfl-8, nfl-9
- Heat: nfl-4, nfl-8
- the grade: nfl-4, with `PAR` fitted in nfl-10
- the Clutch phase: nfl-9
- the juice budget: nfl-3, nfl-4, nfl-7
- online structure: unchanged (OD-2)

**Audit P0 fixes kept, with their tasks:**

| Fix | Task |
|---|---|
| C-1 | nfl-1 |
| C-2, C-3, C-6, D-5 pause | nfl-2 |
| P-1, P-3, P-4, V-1, V-3, V-4 | nfl-3 |
| D-1, D-3, P-2 | nfl-5 |
| G-2, G-3, G-4 and passing realism | nfl-6 |
| G-1, G-5, C-4 | nfl-7 |
| D-2 | nfl-8 |
| D-4, D-5 forfeit, C-5, F-1, F-2, V-2, G-6 returns (solo) | nfl-9, nfl-8 |
| Game shape | nfl-10 |

**Superseded revision-2 items**, listed here so no critique point is silently dropped:
- the `'panel'` layout
- the OT drive from the 25
- the QB On Fire pips and the defensive On Fire
- the lower-third and corner HUD slots
- the "≤ 3 context buttons + BURST exception" map
- the second-finger toggle as the primary throw-type switch (it is now the C chip, with the second finger as a cut-line extra)
