# Team players: team doc (studio overhaul, Game Design V2)

Real-life likeness, "Broadcast Pixel" sprites, animation that looks real, and card faces. Branch `claude/studio-players`, worktree `/home/user/ps-s-players`, dev-server port 5214. The plan is [`players-plan.md`](players-plan.md) (revision 3); this doc is the running record: what changed, the numbers, the contracts other teams rely on, and what is left.

`O` means the overhaul scratch folder (`/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`). Screenshots and JSON reports live in `O/shots/players/<task>/`.

**For the lead and the other teams:** the contracts are in [section 4](#4-cross-team-contracts-v1), the requests to the lead in [section 5](#5-requests-to-the-lead), and the post-merge check is `node scripts/qa/players-verify.mjs` (section 3).

---

## 1. Task log

### players-1 · Harness, baselines, V2 targets and contracts (done; no `src/` change)

**What changed.** Only `scripts/qa/players-*` and this doc. No source file, save, storage key, card id or protocol was touched, so there is nothing to bump.

**The harness** (`scripts/qa/`, every script prints one JSON line and writes `<out>/players-<name>-<tag>.json`):

| Script | Measures | Source |
|---|---|---|
| `players-lib.mjs` (+ `players-lib.test.ts`) | Isolation (every non-localhost request and WebSocket aborted, Archivo answered from a local copy, route log in every report), phone contexts (393×852 insets 59/34, 430, 320×568, 375×667, 844×390, 390×844), the UT fixture, the in-match sprite probe (stale draws by size and by frames since the play started, effective animation rates, sprite canvas area, per-frame sprite heights), `warmUp` | copied from `O/audit-scripts/utui/lib.mjs` and the likeness audit's `spritestats.cjs`/`stalebypx.cjs` |
| `players-sprites.mjs` | A-1 stale draws, animation rates, sprite area | audit `spritestats.cjs` + `stalebypx.cjs` |
| `players-matchperf.mjs` | fps, p99, frames over 20/34 ms, rAF cost, long tasks, heap, sprite area at 5 viewports, 1× and 4× CPU, DPR 3 | audit `matchperf.cjs`/`heap.cjs` |
| `players-readiness.mjs` | navigation → first drawn frame, clip and appearance arrival, frames drawn before them | audit `coldstart.cjs` |
| `players-lineup.mjs` | the stars per sport (card portrait, own kit at 40/24 px, a shared kit), identity in one shared kit at 24/34/40/60 px, torso width by build, owner-named looks, the numbers sheet, and the **V2 rows**: heads tall and head box at 20/24/34/60 art px, the outline histogram | audit `lineup.cjs`, `silhouette.cjs`, `numbers.cjs` |
| `players-screen.mjs` (new) | **V2 rows** on the match screen: the art pixel's design and device scale at DPR 1/2/3, on-screen sprite heights in design px against C.1.2, venue calm (grain, venue vs sprite lightness, crowd colours and blocks, vignette), crowd share of the screen height | new |
| `players-strips.mjs` | animation strips, pose jump at hard cuts, the golden per-frame sequence under the virtual clock | audit `strips.cjs` |
| `players-burst.mjs` | 0.25× slow-motion bursts and contact sheets | audit `burst.cjs` |
| `players-cards.mjs` | every `UtCard` width 34–190 at 393 and 320 (box, type sizes, truncation, head size, animations), 13 UT surfaces, badge contrast for every team, CardDetail (links, brand names, tiles), UT first open and portrait fill at 1×/4×, a reduced-motion sweep | audit `utui` harness |
| `players-keep.mjs` | the keep-list: what the audits say works must survive | likeness audit Part 4, NBA/NFL "what works" |
| `players-slide-{nba,nfl,soccer}.ts` | foot sliding per body-frame (vite-node, seeded autopilot) | audit `soccer_slide.ts`, NBA audit method; NFL is new |
| `players-targets.mjs` (new) | renders `mockups.html`'s three lineups and the HUD as the visual target | new |
| `players-verify.mjs` | every plan section 3 row, PASS/FAIL/N/A, plus the route log | new |

**Fixes made while finishing the harness:**
- The soccer burst stopped at frame 37 of 48 with "Target page, context or browser has been closed". The most likely cause is the dev server's state, not the burst: a freshly started `vite` re-optimises its dependencies (`Re-optimizing dependencies because vite config has changed` in the log) and reloads open pages on the first visit, and this session reproduced that fresh-server state as a 90 s canvas timeout on the first soccer visit; a renderer crash on the loaded machine would look the same. Fix for both: `warmUp()` opens each bench once before it is measured, `watchErrors` now records renderer crashes, and the burst restarts a sport once if its page still closes or navigates mid-capture (the report carries `restarts`). The rerun completed 48/48 frames in all three sports with 0 restarts.
- `players-cards.mjs` could not reach the Scout Market: the Store's sections are a `Segmented` control (`role="tab"`), not buttons. Its new reduced-motion pass keeps its error and a screenshot in the report instead of ending the run (one run timed out on the shared machine; the next two completed).
- The isolation router now lets `file:` URLs through (local files never leave the machine), so `players-targets.mjs` can open the mock-ups page from disk.
- The golden sequences: NBA's two repeats were identical except that one drew 1 more frame (the virtual clock's last step), and soccer's started at different game times (the lab needs the clock to mount, and the clock moved while chunks were still arriving on the loaded machine). The digests now cover the frames every repeat drew (`commonFrames`), and the clock only moves while the network is quiet (`sameStart` is reported).

**Verification.** See section 2 for every number and section 3 for the verify runs. `bash O/heavy.sh npm run typecheck`: pass. `npx vitest run scripts/qa/players-lib.test.ts`: 7 tests pass (sprite keys, size buckets, the stale and animation-rate summary, the new per-frame height reduction, contrast, URL isolation, options). Every script ran on the base commit and printed its JSON line. 0 non-localhost requests in every report; the route logs show the live Supabase host blocked by the router (the UT fixture's cloud-save attempts), never reached. Screenshots looked at: the lineups, in-game and screen frames for all three sports, the card detail, and the mock-up targets.

**Protocol bump needed:** none (no source change).


### players-2 · Broadcast Pixel sprite core (done)

Base `79682ba` (players-1). Six commits; everything render only (proved below), so **Protocol bump needed: none**. No storage key, save field, card/edition/copy id or engine number changed.

**What changed**

1. **Selection extracted** (`50910ce`). `lookFor`, `animOf`, `gait`, `poseOf`, `dunkStyle`/`spins360`, the rim hang, the dribble arm and the NFL ball arm moved verbatim from the three `render.ts` files into `src/game/pixel/select-{nba,nfl,soccer}.ts`; `hoops2/render.ts` re-exports `dunkStyle`/`spins360`, `soccer2/render.ts` re-exports `lookFor`. The moved lines are byte-identical apart from `export`.
2. **Family fallback** (`fd0bf4e`, `select-family.ts`). An act a sport doesn't animate yet resolves to one it does: the act, either half of `kind:variant`, the contract's aliases (`board`→`rebound`, `switch`→`run`, `ankle`→`fall`, `sack`→`tackle`, `keeper:dive`→`dive`…), then its family (shot, pass, kick, contact, ground, locomotion). Unclassified acts run while the body moves and hold the set pose while it stands, so nobody idles on the move. (Refinement of the contract's "otherwise the last action pose": replaying an earlier action out of context is worse than the set pose; recorded here.) Known acts take the old path untouched.
3. **Raster split** (`1c3b077`). `Buf`/`buffer`/`put`/`capsule`/`ball` and the light moved to `raster.ts`; `drawBody` = `rasterBody` (pure: RGBA + anchors + per-pixel slot/part) + `toSprite` (canvas). The 24-sprite golden raster hash reproduced the base `e36f4a3b` exactly before any style change.
4. **Broadcast Pixel style** (`b058e3d`).
   - `proportions.ts`: head radius × `clamp(1.55 − artPx/120, 1.2, 1.45)` × `HEAD_FIT` 0.92 (the fit that lands V2's table on the raster), heads 0.88 as wide as tall, limbs ×1.15, drawn heights spread ×1.15 around each sport's mean (NBA 78.5 in, NFL 74, soccer 71.5), torso 8–13 art px face-on at 34 px from BMI (`8 + 5·clamp((BMI−18)/15)`), a V-taper, the arms set outside the torso (moved whole: no bone changes length), NFL pads +2.2 px per pad unit. Hair volume on the crown for short/headband/locs styles.
   - Outline and tones: a 1 art px `#14121c` ring; inner separations, pinholes, 2-px gaps and concave corners in the farther part's shadow tone (corners turn on the diagonal); `ramp3` (`color.ts`): shadow L−22 with the hue turned 10° toward blue along the shorter arc (gold → orange, red → magenta, navy → blue), highlight L+14, ends nudged so the three tones stay distinct and never equal the outline; light from the top-left; no dithering (accidental 2×2 checkerboards are cleaned); a lit-side skin rim when skin and jersey are both dark (wired on any look; curated skin arrives in players-3).
   - `ground.ts`: `drawGroundMark` (soft `rgba(0,0,0,0.32)` at 70% of shoulder width, 1 px halo; rings `you #f6b93b`, `target #4fe3c1`, `pressure #ff5d5d` arc, `rival #8b7cf6`, `color` override) and `groundEllipse`. The three renderers' player shadows now use it (airborne bodies shrink and fade); the rings are the HUD owners' call.
   - The "everyone shares one skin tone" comments in `sprites.ts` and `body.ts` now describe the neutral default.
5. **The art pixel** (`430c52a` + this task's last commit): `art-scale.ts` (`devPerArt = max(2, round(1.5·k·dpr))`, k = the stage's design scale), sprites rasterised at their own art size (far players natively), `toView`/`blitSprite` (whole canvas px position and scale), `quantPx` steps 1/2/4/6 art px restarting at each band (≤14, <30, <62, above). Cache keys gain `|cpa/backing` only away from today's grain.

**The art-pixel decision (measured; plan §2, §6.4).** `players-matchperf.mjs --vp 393 --cpu 1,4 --dpr 3`, dev server, the shared machine:

| Option | NBA 1× / 4× fps | NFL 1× / 4× | Soccer 1× / 4× | 4× long tasks (NBA/NFL/soccer) |
|---|---|---|---|---|
| Base (players-1) | 59.0 / 34.8 | 57.5 / 33.3 | 60.0 / 40.1 | 17 / 24 / 11 |
| **A** device-resolution backing, 1.5 design px art pixel (5 device px at 393 DPR 3) | 58.7 / **14.7** | 57.9 / **18.6** | 58.5 / **19.7** | 106 / 85 / 79 |
| **C** today's grain + the new proportions (run 1 / run 3) | 57.7 / 34.2 · 59.6 / 49.3 | 59.5 / 42.5 · 59.9 / 53.7 | 59.4 / 37.9 · 59.6 / 54.5 | 21 / 14 / 10 · 5 / 6 / 8 |

A fails the §3.3 4× row by half (the ×9 backing store's fills, not the sprites), so **C is adopted** (`ADOPTED = 'C'`). B (a 2× backing) was not built: at DPR 3 it can't give a 1.5 design px art pixel a whole device-px size (3 canvas px = 4.5 device px), and at 1 view px it draws what C draws. A stays selectable with `?artpx=A` for owner device check 2. C's sprite area peak 5.78 Mpx at 393 (≤6), heap 23.4→24.3 / 19.8→20.3 / 24.6→25.6 MB.

**Whole device pixels** (`players-artpx.mjs`: every sprite blit instrumented, DPR 1/2/3 × 393/320 × three sports × A and C): **0 of 126,687 blits** at a non-integer device scale or position. A draws at 2/3/5 device px per art px at 393 (DPR 1/2/3); C at 1/2/3.

**Measured on the raster** (band centres; V2 C.1.1):

| Figure height (art px) | Heads tall (target) | Head box w×h (target) |
|---|---|---|
| 18 | 4.50 (4.5) | 4×5 (5×5) |
| 24 | 4.80 (5) | 5×5 (6×6) |
| 34 | 5.67 (5.5) | 6×7 (7×8) |
| 64 | 5.82 (6) | 12×13 (12×13) |

Heads tall is the figure height over the skull's rows (hair volume is not head); the box includes hair. V2's own table can't hold under players-1's harness definition (figure ÷ box-with-hair: 34/8 = 4.25, never 5.5), so the verify row S2 still reads the old definition; the unit test is the gate. Between band centres the ratio drifts with pixel rounding (e.g. 5.14 at 36, 5.45 at 60), recorded for players-4.

Torso at 34 art px face-on: **Shaq 13, Bol 9 (difference 4)**, BMI 31 vs 20 at 78 in: 13 vs 9 (**+44%**); Jokić 11, Giannis 11 (players-4 re-runs with real weights).

**Kept identical** (the extraction acceptance): node-side golden digests over every body every other frame, base vs moved: NBA `556ad50a` (88,750 samples), NFL `ed52d518` (104,852), soccer `326e398f` (31,656). The three slide classifiers reproduce players-1 to the count: NBA 29.1% (1,129,920 frames), NFL 40.4% (2,003,766; QB idle-moving 20,418, 1.97 yd per dropback), soccer 13.7% (564,490). (The browser golden sequence includes sprite px, which players-2 changes on purpose; as players-1 recorded, the node digests are the byte-identical gate.)

**Render only, proved** (`render-only.test.ts`, `render-only-soccer.test.ts`): no module reachable by static import from any sport's simulation (NBA engine/autopilot/game/ratings/badges, NFL engine/autopilot/drive/ratings/squad, soccer engine/autopilot/match/ratings/shootout) is in `src/game/pixel/` or `src/data/appearance/` (`soccer2/arcade.ts` is excluded as the lazy-load barrel that re-exports the screen); a seeded NBA, NFL and soccer game hashes the same full engine state after every step with the whole drawing pipeline (look, clip selection, proportions, art scale, a raster every 20 steps) run on every body.

**Other numbers after players-2** (393, dev server): stale draws NBA 2.7% (was 4.4), NFL 40.8% (41.4; players-5), soccer 1.8% (1.9); keep-list PASS.

**Harness fixes** (`scripts/qa/players-lib.mjs`, `players-artpx.mjs` new): the in-match probe now imports the exact module copies the page runs (after a source edit the dev server serves `body.ts?t=…`, and a bare import patched an unused copy: sprite area read 0); `parseSpriteKey` drops the `|cpa/backing` suffix; `--artpx A|C` passes through every match URL.

**Tests added:** `select-golden.test.ts`, `select-golden-soccer.test.ts` (+ `select-golden.helpers.ts`), `select-family.test.ts`, `raster.test.ts` (hash `38046b9e`, was `e36f4a3b`), `proportions.test.ts`, `outline.test.ts`, `ground.test.ts`, `art-scale.test.ts`, `render-only.test.ts`, `render-only-soccer.test.ts` (+ `render-only.helpers.ts`), `players-lib.test.ts` (key suffix).

**Looked at** (`O/shots/players/players-2/`): `after-p2-lineup-{nba,nfl,soccer}.png` beside `players-1/before-lineup-*.png` and `after-p2-vs-target-nba.png`; `after-p2-ingame-sheet.png` (three sports at 393 and 320); `p2-artpx-{A,C}-<sport>-393-dpr3.png` and the crops `crop-{A,C}-nba.png` (DPR 3 close-ups). The outline, build and head size read as V2 asks; front-on poses, hair, skin and gear are players-3/4.

---

## 2. Baselines (base commit `1d14201` = source of `acdf3e2`, dev server, players-1, 2026-11-16)

Unless noted: 393×852 with insets 59/34, `deviceScaleFactor` 1, the autoplay benches (`?arcade&auto`, `?soccer-lab&auto&qa`), `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted. **The machine was shared with six other teams** (load average 5–6 on 4 CPUs) throughout, which matters for the 4× CPU rows (see "Against the audit").

### 2.1 Broadcast Pixel sprites (V2 C.1) — `players-lineup.mjs`, `players-screen.mjs`

| Row | NBA | NFL | Soccer | V2 target |
|---|---|---|---|---|
| Art pixel at 393 (design px per art px; device px per art px at DPR 1/2/3) | 0.992; 1/2/3 | 0.992; 1/2/3 | 0.992; 1/2/3 | 1.5; an integer (4 or 5 on a 3× phone) |
| Art pixel at 320 | 1.219; 1/2/3 | 1.219; 1/2/3 | 1.219; 1/2/3 | 1.5 |
| Heads tall / head box (w×h, art px) at a 20, 24, 34, 60 art px sprite | 4.5 / 4×4 · 4.4 / 5×5 · 4.57 / 8×7 · 4.46 / 14×13 | same body code | same body code | 4.5 / 5×5 · 5 / 6×6 · 5.5 / 7×8 · 6 / 12×13 |
| Outer silhouette edge pixels in `#14121c` | 0% (8 edge colours per sprite, p50: a dark version of each part) | 0% (7) | 0% (7) | 100% |
| Inner outline-colour pixels at 34 art px (p50 per star; max share of the inside) | 36 (17.6%) | 26 (11.1%) | 34 (16.4%) | 0 (inner separations in the shadow tone) |
| Body width at 34 art px (chest band, arms in; audit method) | Curry 15, Giannis 16, Jokić 16, Shaq 18, Bol 17, Bogues 13, Yao 18; BMI 20 vs 31: 16 vs 16 | per star in `players-lineup-before.json` | per star | Shaq − Bol ≥3 (now 1); BMI 31 ≥25% wider (now 0%) |
| Same, at 40 px (the audit's size) | Curry 17, Giannis 19, Jokić 19, Shaq 20, Bol 20, BMI 20/31 17/19 | | | |
| On-screen height, controlled (ball body) / nearest / median / far, design px at 393 | 75.4 / 89.3 / 63.5 / 47.6 | 27.8 / 33.7 / 27.8 / 17.9 | 39.7 / 47.6 / 27.8 / 23.8 | NBA 51 / far 36; NFL and soccer 34 / far 22.5 |
| Same at 320 (design px) | 75.6 / 90.2 / 63.4 / 48.8 | 29.3 / 34.1 / 26.8 / 19.5 | 39.0 / 46.3 / 29.3 / 24.4 | |
| Sprite px p10 / p50 / p90 (art = CSS px at 393, `players-sprites`) | 44 / 64 / 88 | 22 / 28 / 42 | 20 / 32 / 50 | |

On-screen heights and the crowd share are **reported, not owned**: the sport teams' cameras set them. NBA's controlled player is 48% over V2's 51 design px; NFL's is 18% under 34; soccer's 17% over.

### 2.2 Likeness and venues — `players-lineup.mjs`, `players-screen.mjs`

| Row | NBA | NFL | Soccer | Target |
|---|---|---|---|---|
| Distinct skin tones / hair colours among the 12 stars | 1 / 1 | 1 / 1 | 1 / 1 | the curated looks |
| Identity in one shared kit: pairs ≥8% different at 24 px; min pair at 34; min pair at 60 | 94% · 6.9% · 2.4% | 95% · 4.4% · 5.6% | 86% · 1.7% · 2.4% | ≥80% (NBA) / ≥75%; ≥12%; ≥8% |
| Owner-named looks | Shaq not bald, Iverson no cornrows, Kareem no goggles, Rodman not dyed | Brady judged by eye (players-3/4) | Haaland not blond, Mbappé hashed hair | all right |
| Missing stars in the card file | none | William Perry (no card) | none | |
| Surface grain (Michelson, median 12×12 tile) | 14.2% | 3.0% | 2.6% | ≤4% |
| Venue mean L* vs sprites' (negative = venue **lighter**) | −24.6% | −29.7% | −47.7% | venue ≥30% darker |
| Crowd: top-3 colours' share; pixels equal to the right neighbour | 0.22; 0.83 | 0.12; 0.70 | 0.19; 0.83 | three bands (≥0.90); 2 px blocks (≥0.5) |
| Corner vignette (corner tiles vs centre, L*) | −26% | −43% | −42% | −18% |
| Crowd share of the screen height at 393 / 320 (everything above the surface) | 13.0% / 15.8% (36.9%) | 16.9% / 25.0% (34.3%) | 17.6% / 26.2% (34.0%) | ≤12% (sport teams) |

Read the venue rows together with the screenshots (`before-screen-<sport>-<vp>-<n>.png`): NBA's floor grain is the loud one; the NFL and soccer grass is already calm, but all three venues are lighter than the players on them, and every crowd is a many-coloured 1–2 px texture rather than three dark bands.

### 2.3 Animation and engine render — `players-sprites.mjs`, `players-slide-*.ts`, `players-strips.mjs`, `players-matchperf.mjs`, `players-readiness.mjs`

| Row | NBA | NFL | Soccer |
|---|---|---|---|
| Lookups a frame · cache hit · new drawings/s | 10.0 · 70% · 151 | 20.8 · 40% · 234 (the cap of 4 a frame) | 8.0 · 67% · 148 |
| **Stale draws** overall | 4.4% | **41.4%** | 1.9% |
| Stale by sprite size (<24 · 24–31 · 32–47 · 48–71 · 72+) | – · – · 0 · 2.0 · 9.9% | 2.2 · 39.5 · 57.5 · **82.5** · – | 2.0 · 1.9 · 2.5 · 0.3 · 0% |
| Stale (≥32 px) by frames since the play started (0–9 · 10–29 · 30–119 · 120+) | **26.8** · 13.1 · 2.2 · 2.4% | 7.5 · 0 · 76.9 · 61.6% | 0 · 0 · 3.9 · 1.6% |
| Longest stale run, a body ≥32 px (frames) | 18 | 296 | 6 |
| Effective animation rate, every animated body: min / p50 (fps); bodies under 10 fps | 5.7 / 9.6; 5 of 10 | **0.7** / 9.3; 11 of 22 | 10.9 / 14.2; 0 of 14 |
| Nearest six bodies: min / p50 · ball body | 7.0 / 9.6 · – | 0.7 / 2.8 · 2.8 | 12.5 / 15.7 · 12.3 |
| Draw cost p50 / p99 (renderer only, ms) | 1.9 / 8.5 | 1.6 / 7.2 | 1.3 / 6.7 |
| Cached sprite area, peak (Mpx) | 6.47 (6.61 at 430) | 1.78 | 3.87 |
| **Foot sliding** (share of on-ground body-frames) | **29.1%** (24 games) | **40.4%** (24 games); QB idle-while-moving 22.2% of QB frames, 1.97 yd skated per dropback (408) | **13.7%** (120 attacks); action clips while moving 2.6% |
| Pose jump at hard cuts (share of body height) | jumper→ready 53.5, run→crossover 44.1, run→jumper 42.2, run→dunk 32.4, ready→contest 26.7, ready→pass 22.4% | sprint→stiff-arm 44.6, sprint→juke 33.0% | kick→run 59.8, run→kick 52.7% |
| Recorded clips never played | `dribble`, `crossover`, `cut`, `getup_front`, `stiff_arm` (loaded by no renderer) | | |
| Golden sequence (20 s, virtual clock, 2 repeats) | deterministic (`3d1099d6`, 1,206 frames) | **not deterministic**: the repeats diverge at frame 29 (a defender in `stance` vs the `ready` clip), see section 10 | deterministic (`e991f153`) |

**Match performance** (dev server, DPR 3, 10 s windows; 1× fps / p99 interval / frames >20 ms | 4× fps / p99 / >20 ms / long tasks | heap start→end MB | sprite area peak Mpx):

| Sport | 393×852 | 430×932 | 320×568 | 375×667 | 844×390 |
|---|---|---|---|---|---|
| NBA | 59.0/16.8/4 \| 34.8/83/160/17 \| 23.9→24.0 \| 5.41 | 58.7/33.3/8 \| 21.7/150/181/47 \| 23.3→24.0 \| 6.61 | 58.0/33.4/11 \| 33.2/133/156/17 \| 23.0→23.9 \| 3.58 | 55.4/50/25 \| 37.1/83/146/16 \| 23.4→24.1 \| 5.14 | 58.2/33.4/14 \| 30.6/200/172/26 \| 23.4→24.0 \| 3.18 |
| NFL | 57.5/33.4/16 \| 33.3/117/158/24 \| 19.2→20.3 \| 1.73 | 59.0/33.3/8 \| 37.5/83/148/16 \| 19.2→20.5 \| 1.89 | 58.7/33.4/11 \| 37.6/117/132/17 \| 19.4→20.2 \| 1.09 | 59.8/16.8/2 \| 38.0/83/139/13 \| 19.4→20.3 \| 1.52 | 59.7/16.8/2 \| 39.1/117/131/20 \| 19.3→20.3 \| 1.56 |
| Soccer | 60.0/16.8/0 \| 40.1/83/140/11 \| 24.6→24.5 \| 2.40 | 58.6/33.4/7 \| 38.5/100/163/11 \| 24.5→25.2 \| 2.87 | 59.8/16.8/1 \| 46.4/83/101/9 \| 24.9→24.6 \| 1.70 | 59.7/16.8/3 \| 38.2/100/137/14 \| 24.4→24.6 \| 2.26 | 57.7/33.4/16 \| 33.7/83/177/20 \| 24.3→25.1 \| 3.97 |

**Readiness** (median of 3 fresh contexts, DPR 3; navigation → first drawn game frame · canvas mounted · clips done; clip chunks; stand-in frames after the first):

| Sport | 1× CPU | 4× CPU |
|---|---|---|
| NBA | 3,101 · 1,959 · 1,996 ms; 13; 0 | 5,972 · 3,885 · 3,934 ms; 13; 0 |
| NFL | 2,691 · 2,299 · 2,346 ms; 15; 0 | 4,739 · 3,587 · 3,334 ms; 15; 0 |
| Soccer | 2,884 · 2,200 · 2,277 ms; 13; 0 | 5,823 · 4,127 · 4,182 ms; 13; 0 |

No appearance data exists yet, so every frame draws default looks (the second half of the readiness row fails today).

### 2.4 Cards — `players-cards.mjs` (393 and 320, all three sports)

| Row | Today | Target |
|---|---|---|
| Card art head width (design px) at w 34 · 44 · 80 · 150 · 190 | 2.1 · 2.7 · 4.8 · 7.8 · – (NBA/soccer); NFL helmets 2.9 · – · 6.8 | ≥11 · ≥14 · ≥24 · ≥45 · ≥57 |
| Figure height on the 80-px card | 42.5–45.4 design px | a bust |
| OVR / POS / name (smallest, design px) at w 80 | 21.6 / 8.4 / 9 | ≥20 / ≥10 / ≥10 |
| OVR / POS at w 34 | 9.2 (10.5 soccer) / 7 | ≥10 / ≥10 |
| Smallest text on any card (w 34 · w 80) | 2.7 · 6.2 design px | ≥10 for anything a player reads |
| Long names truncated (Antetokounmpo, Gilgeous-Alexander) | at w 80 (and Gilgeous-Alexander at 170) | whole at 44, 80, 170 |
| Team badges under 4.5:1 ink (worst) | NBA 5/55 (2.64), NFL 11/47 (1.76), soccer 69/250 (1.0) | 0 |
| CardDetail | NBA "2K" and NFL "Madden" link with `target=_blank`; soccer none; first six-tile row in view at 393 and 320; labels 11 px | 0 links, 0 brand names |
| Running card animations at w<120 | 0 | 0 |
| `UtCard` outer box | exactly w × 1.4w at every width 34–190 | unchanged |
| UT first open (tap → club ready) at 1× / 4×, median of 3 runs | NBA 2,534 / 8,942 · NFL 5,097 / 12,337 · soccer 1,590 / 3,096 ms (runs spread up to 2×: NBA 1× 2,220–4,361) | ≤ +5% (players-10 re-measures on a production build) |
| First club row with art at 1× / 4× (last run) | NBA 76 / 129 · NFL 92 / 160 · soccer 150 / 421 ms | ≤300 / ≤900 |
| Surfaces reached | 13 of 13 (hub, squad, club, detail, store, Scout Market, reveal, tracker, SBC, standouts, sets, evolutions, draft) at 393 and 320 | 13 |
| Reduced motion (393 sweep) | 0 running animations on 220 NBA, 176 NFL, 154 soccer cards | 0 |

### 2.5 The keep-list (`players-keep.mjs`)

13 items, all PASS; 8 observed in play this run (NFL heavy gait, On Fire, stamina, the gold ring, NBA ankle-breaks, the heavy man's wider stride, the sprint lean, the club portrait pump). Not observed in this 40 s window (no failure): the NFL afterimage, leap, bobble, the posterized reaction and the posterizer slow-mo; their anchors are present.

### 2.6 The visual target

`target-mockups-{lineup-nba,lineup-nfl,lineup-soccer,hud}.png` (and the lineups at 4×), rendered from `O/design-v2/mockups.html` by `players-targets.mjs`. The before set beside it: `before-lineup-<sport>.png`, `before-numbers.png`, `before-ingame-<sport>-393-*.png`, `before-screen-<sport>-<vp>-*.png`, `before-anim-strips.png`, `before-burst-<sport>-sheet.png`, `before-cards-*.png`.

### Against the audit (±10% or explained)

| Number | Audit | players-1 | Verdict |
|---|---|---|---|
| NFL stale overall | 41.3% | 41.4% | within |
| NFL stale 48–71 px / 32–47 / 24–31 / <24 | 81.0 / 60.0 / 36.2 / 3.0% | 82.5 / 57.5 / 39.5 / 2.2% | within, except <24 px (2.2 vs 3.0; a tiny share of lookups) |
| NBA stale overall / 72+ px | 4.5% / 8.4% | 4.4% / 9.9% | overall within; 72+ is 1.5 points higher. At the audit's own 390×844 the harness gives 4.3% / 9.9% (`players-sprites-audit390.json`), so it isn't the viewport: 72+ is the smallest bucket (3,673 lookups) and moves with which plays the seed produces |
| Soccer stale | 1.7% | 1.9% | +0.2 points; within noise of a 18 s window |
| NBA foot sliding | 29.1% | 29.1% | identical |
| Soccer foot sliding | 12.8% | 13.7% | within (+7%) |
| NFL foot sliding | not measured | 40.4% (QB idle-while-moving 22.2% of QB frames, 1.97 yd skated per dropback) | new baseline; the NFL audit's 6.5 yd was one hand-picked dropback, this is the mean of 408 |
| Pose jump at hard cuts | kick→run 59.8% … ready→pass 22.4% | identical list | same method and clips |
| 1× fps | 60.0 everywhere | 55.4–60.0 | NBA 375 (55.4) and NFL 393 (57.5) dropped frames to other teams' builds on the shared CPUs; 10 of 15 runs ≥58.6 |
| 4× fps (NBA 390 / 430 / 320, NFL 390) | 54.8 / 51.8 / 56.7 / 57.5 | 34.8 / 21.7 / 33.2 / 33.3 (393 not 390) | **not comparable**: the audit ran a production build on a quiet machine; this is the dev server (unbundled modules, React development build) at DPR 3 while other teams ran builds, Playwright and vitest. The relative rows in `players-verify.mjs` compare against these same-method numbers; players-10 repeats them on `vite preview` |
| Heap | 33.5–40.1 MB | 19.2–25.2 MB | the harness forces a GC before reading (`HeapProfiler.collectGarbage`); the audit did not. Flat over each run in both |
| First frame / clips in | 1,082 ms / 1,218 ms (NBA, local) | NBA canvas 1,959 ms, clips done 1,996 ms, first game frame 3,101 ms (median of 3, 1×) | the dev server serves ≈300 unbundled modules; clips now arrive before the first game frame, so 0 stand-in-pose frames at 1× and 4× in every sport. The default-looks half of the row still fails (no appearance data) |
| Clip chunks | 15–26 | 13 (NBA, soccer), 15 (NFL) | within the audit's range at the bottom (the dev server loads each JSON once) |
| UT first open (tap → club ready) | — | NBA 2,534 / NFL 5,097 / soccer 1,590 ms at 1× (median of 3) | new baseline for the "≤ +5%" row |
| Card art head | ≈8 design px on the 80-px card, figure ≈52 px | head 4.8 (NBA, soccer) / 6.8 (NFL helmet) design px wide at 80; figure 42.5–45.4 | the audit estimated by eye; this is a pixel probe of the head's skin/hair box |

---

## 3. `players-verify.mjs`: the section 3 gate

`node scripts/qa/players-verify.mjs --run none --tag before --out O/shots/players/players-1` evaluates the reports above; `--run all` (or a list) re-runs the scripts first. Every row prints PASS, FAIL or N/A with its numbers, and the route log closes the table. A row whose proving unit test doesn't exist yet FAILs as "not built yet (<task>)".

**Base-commit run** (`--run none --tag before`, the reports in section 2): **2 PASS · 44 FAIL · 1 N/A**, 0 external requests (route log: 45943 localhost requests across 11 reports; the live Supabase host was blocked 277 times by the router, never reached).

**End-to-end run** (`node scripts/qa/players-verify.mjs --run all --quick --tag verify`, every script re-run from scratch into `O/shots/players/players-1/verify-e2e/`, 13 min 23 s): sprites ok (54 s), screen ok (85 s), matchperf ok (93 s), readiness ok (50 s), lineup ok (11 s), strips ok (71 s), cards ok (353 s), keep ok (53 s), players-slide-nba ok (10 s), players-slide-soccer ok (8 s), players-slide-nfl ok (13 s). Result **3 PASS · 43 FAIL · 1 N/A**, 0 external requests. The rows agree with the base-commit run; A6 passes in the quick run because it skips the 430 viewport (the only one over 6 Mpx).

Expected today: the two PASS rows are the ones the audits say work (K1 keep-list, C9 portrait fill). A5 (1× fps) should pass on a quiet machine and fails here only from the shared CPUs (section 10). Every other row fails until its owner task lands, either on the measurement or as "not built yet" for its proving test.

| ID | Row | Target | Owner | Status on the base commit | Measured |
|---|---|---|---|---|---|
| S1 | Art pixel | 1 art px = 1.5 design px (±0.05); a whole number of device px at DPR 1, 2 and 3 | players-2 | **FAIL** | nba 0.992 design/art, 3 dev/art @3x · nfl 0.992 design/art, 3 dev/art @3x · soccer 0.992 design/art, 3 dev/art @3x · 0/18 non-integer · not built yet (players-2): art-scale.test.ts |
| S2 | Heads tall and head box | C.1.1: 4.5/5/5.5/6 heads (±0.25) and 5x5, 6x6, 7x8, 12x13 (±1) at 20/24/34/60 art px | players-2 | **FAIL** | 20px 4.5h 4x4 · 24px 4.4h 5x5 · 34px 4.57h 8x7 · 60px 4.46h 14x13 · not built yet (players-2): proportions.test.ts |
| S3 | Outline and shading | 100% of silhouette edge pixels #14121c; 0 inner black (outline-colour) pixels; 3 tones per material | players-2 | **FAIL** | nba edge #14121c 0%, 8 edge colours, inner line px p50 36 · nfl edge #14121c 0%, 7 edge colours, inner line px p50 26 · soccer edge #14121c 0%, 7 edge colours, inner line px p50 34 · not built yet (players-2): outline.test.ts |
| S4 | Body width by build (34 art px) | Shaq − Bol >=3; BMI 31 vs 20 >=25% wider; Jokic − Giannis >=1 (chest band, arms in) | players-2/4 | **FAIL** | Curry 15 · Giannis 16 · Jokic 16 · Shaq 18 · Bol 17 · BMI20/31 16/16 · not built yet (players-2/4): proportions.test.ts, body-build.test.ts |
| S5 | Height spread | drawn height spread x1.15 (±0.02) around the sport mean; sim height untouched | players-2 | **FAIL** | not built yet (players-2): proportions.test.ts, render-only.test.ts |
| S6 | On-screen heights (reported) | C.1.2 at 393: controlled NBA 51 / NFL, soccer 34 design px (±10%); far 36 / 22.5 (±15%) | sport teams (cameras); re-run players-10 | **FAIL** | nba controlled 75.4 (47.8%) far 47.6 (32.2%) · nfl controlled 27.8 (-18.2%) far 17.9 (-20.4%) · soccer controlled 39.7 (16.8%) far 23.8 (5.8%) |
| S7 | Level of detail | far bodies drawn at native art size; hair collapses to 4 below 24 art px; facial hair off below 20 except a full beard | players-2/4 | **FAIL** | not built yet (players-2/4): head.test.ts, art-scale.test.ts |
| S8 | Ground marks | shadow rgba(0,0,0,0.32) at 70% shoulder; you #f6b93b, target #4fe3c1, pressure #ff5d5d, rival #8b7cf6; no other field use of those | players-2 | **FAIL** | not built yet (players-2): ground.test.ts |
| L1 | Identity in one shared kit | pairs >=8% different at 24 px (NBA 80%, NFL/soccer 75%); all >=12% at 34; all >=8% at 60 | players-4/9 | **FAIL** | nba 94%/6.9%/2.4% · nfl 95%/4.4%/5.6% · soccer 86%/1.7%/2.4% (24 px share >=8%, 34 px min, 60 px min) |
| L2 | Default looks | no style >40% per era bucket; >=5 silhouettes; 0 goggles/headband/dyed/blond/left defaults | players-3 | **FAIL** | not built yet (players-3): appearance.test.ts |
| L3 | Tier A coverage | first-run 100% (>=12 per sport) + 7 owner-named; then GOAT + Legend + top 60; src + reviewed on every row; <=20 KB gzip | players-3/9 | **FAIL** | not built yet (players-3): appearance-data.test.ts |
| L4 | Owner-named looks | Shaq bald, Iverson cornrows, Kareem goggles, Rodman dyed, Haaland blond, Mbappe clean-shaven, Brady | players-3/4 | **FAIL** | wrong: O'Neal, Iverson, Abdul-Jabbar, Rodman, Haaland, Mbappé · 1 judged by eye only |
| L5 | Numbers | exact front-on from 28 design px; exact or hidden, never scrambled; 6x10 font at >=60 art px | players-4 | **FAIL** | not built yet (players-4): numbers.test.ts |
| L6 | Venue calm | grain <=4%; venue mean L* >=30% below sprites; crowd 3 bands (top-3 colours >=90%) in 2 px blocks; corners -18% | players-4 | **FAIL** | nba grain 14.17% · darker -24.6% · crowd top3 0.22/blocks 0.83 · corners -26% · nfl grain 3.03% · darker -29.7% · crowd top3 0.12/blocks 0.7 · corners -43.3% · soccer grain 2.55% · darker -47.7% · crowd top3 0.19/blocks 0.83 · corners -41.7% · not built yet (players-4): venue.test.ts |
| L7 | Crowd share of screen (reported) | crowd <=12% of the screen height in portrait (393 and 320) | sport teams (horizon); re-run players-10 | **FAIL** | nba/393 13% (all above the surface 36.9%) · nba/320 15.8% (all above the surface 36.6%) · nfl/393 16.9% (all above the surface 34.3%) · nfl/320 25% (all above the surface 35.6%) · soccer/393 17.6% (all above the surface 34%) · soccer/320 26.2% (all above the surface 33.8%) |
| L8 | Crowd reactions | front rows stand/bounce/wave within 6-12 frames of a score, ON FIRE or Clutch; back within 1.5 s | players-9 (stretch) | **FAIL** | not built yet (players-9 stretch): crowd.test.ts |
| A1 | Stale body draws, NFL autoplay | >=48 px <2%, 32-47 px <5%, overall <10% | players-5 | **FAIL** | >=48 82.5% · 32-47 57.5% · overall 41.4% |
| A2 | Stale draws, NBA / soccer | NBA >=48 px <2% and first 10 frames <5%; soccer <=1% | players-5 | **FAIL** | NBA >=48 5% · NBA first 10 frames 26.8% · soccer 1.9% |
| A3 | Pre-warm after snap, kickoff, inbound | stale <=1% for >=32 px in the first 30 frames | players-5 | **FAIL** | nba 17.7% · nfl 3% · soccer 0% |
| A4 | Effective animation rate | handler/carrier, nearest and large bodies >=28 fps; every body >=12, none <10 (1x) | players-5 | **FAIL** | nba min 5.7/p50 9.6 (near 7, ball -) · nfl min 0.7/p50 9.3 (near 0.7, ball 2.8) · soccer min 10.9/p50 14.2 (near 12.5, ball 12.3) |
| A5 | In-match fps | 1x holds 60.0 at 5 viewports; 4x at or above before; >20 ms frames no worse than +10% | players-2/5/6/7/9/10 | **FAIL** | 10 misses, e.g. nba 393 1x 59 · nba 430 1x 58.7 · nba 320 1x 58 · nba 375 1x 55.4 |
| A6 | Canvas memory | cached sprite area <=6 Mpx per match; heap within +10% | players-2/5/6 | **FAIL** | peak 6.61 Mpx (nba 430) · heap grew >10% in 0 runs |
| A7 | Readiness at match start | 0 frames with stand-in poses or default looks after frame 1; PLAY-to-first-frame <= before +100 ms | players-3 | **FAIL** | nba 1x no appearance data: every frame draws default looks · nba 4x no appearance data: every frame draws default looks · nfl 1x no appearance data: every frame draws default looks (+3) · not built yet (players-3): readiness.test.ts |
| A8 | Foot sliding | NBA <=8%, soccer <=4%, NFL <=5% and 0 idle-while-moving QB frames | players-5 | **FAIL** | NBA 29.1% · soccer 13.7% · NFL 40.4% · QB idle-moving 20418 |
| A9 | Time discontinuities | replay, pause, SIM, rematch, hit-stop: 0 frames blend from the pre-jump pose; first resumed jump <=20% | players-5/6 | **FAIL** | not built yet (players-5): time.test.ts |
| A10 | HUD anchors and sprite budget | drawn offset <=5% of body height; drawnOffset/headTop/feetAt/handAnchor exported; near bodies never stale >2 frames | players-5 | **FAIL** | not built yet (players-5): locomotion.test.ts, sprite-budget.test.ts |
| A11 | Pose jump at hard cuts | every listed cut <=20% of body height via 80-120 ms blends | players-6 | **FAIL** | not built yet (players-6): transitions.test.ts · raw cuts today kick->run 59.8%, jumper->ready 53.5%, run->kick 52.7%, sprint->stiffarm 44.6%, run->crossover 44.1% |
| A12 | Frame plans (V2 B.1.6, B.2.6, B.3.6) | event frames on engine time (±0 f); frame counts ±1 f; the five recorded clips played | players-6/7 | **FAIL** | not built yet (players-7): actions-nba.test.ts · not built yet (players-6): actions-nfl.test.ts · not built yet (players-6): actions-soccer.test.ts |
| A13 | Hit-stop and shake | impactOf ±10 ms; <=150 ms hit-stop per second; trauma by mass x speed; reduced motion <=30 ms, 0 shake | players-6 | **FAIL** | not built yet (players-6): impact.test.ts |
| A14 | Celebrations | <=4 per sport; NBA 0.8 s, NFL/soccer 1.2 s; skippable from 0.25 s; 0 frames at the next start; 0 s added | players-7 | **FAIL** | not built yet (players-7): celebrate.test.ts |
| A15 | Motion DNA and handedness | set point >=3 art px apart at 60; QB slot 15/35/55 ±5; run lean >=4 deg; lefties mirrored on 100% of releases | players-7/9 | **FAIL** | not built yet (players-9): motion-dna.test.ts · mocap.test.ts pass |
| A16 | Soccer feet | >=85% recorded foot; >=95% of left-footers kick with kick_l | players-9 | **FAIL** | not built yet (players-3/9): appearance-soccer.test.ts · not built yet (players-6): actions-soccer.test.ts |
| A17 | Simulation untouched | import graph and per-step seeded state hash identical with rendering on | players-2 | **FAIL** | not built yet (players-2): render-only.test.ts |
| A18 | Blends under load | stale <=2% for >=48 px in the 20 frames after an NFL snap; blend sprites <=10% of cache | players-6 | **FAIL** | no blends yet (players-6 adds the ?pixeldebug counters) · stale after snap >=48 px no sample |
| C1 | Card art head size (design px) | head >=24 at 80, >=45 at 150/170, >=57 at 190, >=14 at 44, >=11 at 34-40 | players-8 | **FAIL** | nba/393 w34 2.1 · nba/393 w40 2.4 · nba/393 w44 2.7 · nba/393 w80 4.8 · nba/393 w150 7.8 (+37) |
| C2 | Bust recognisability | 12 stars in one kit differ pairwise >=15% on the 80 px card; locked >=10% | players-8 | **FAIL** | not built yet (players-8): bust.test.ts |
| C3 | Frame ladder (C.4) | a distinct silhouette per family; metals dE >=15; programs dE >=10 or a motif; 100% non-fallback; 0 running animations at w<120 | players-8 | **FAIL** | not built yet (players-8): card-frames.test.ts · running animations on w<120: 0 |
| C4 | Card text at every size | OVR and POS >=10 design px at w>=34; name >=10 at w>=52; 0 overflow at 393 and 320 | players-8 | **FAIL** | 156 misses, e.g. nba/393 w34 ovr 9.2 pos 7 · nba/393 w40 ovr 10.8 pos 7 · nba/393 w44 ovr 11.9 pos 7 |
| C5 | 3-digit values and long names | OVR 105 >=20 px at 80 with 0 overflow; long names whole at w=44, 80, 170 | players-8 | **FAIL** | 6 misses, e.g. nba/393 Antetokounmpo at w80 · nba/393 Gilgeous-Alexander at w80 · nba/393 Gilgeous-Alexander at w170 · nba/320 Antetokounmpo at w80 |
| C6 | Team badges | badge ink >=4.5:1 for every team | players-8 | **FAIL** | nba 5/55 under 4.5 (min 2.64) · nfl 11/47 under 4.5 (min 1.76) · soccer 69/250 under 4.5 (min 1) |
| C7 | CardDetail | first six-tile row above the action bar at 393 and 320; labels >=11; 0 a[target]; 0 brand names | players-8 | **FAIL** | nba/393 row in view · labels 11 · target links 1 · brands 2K · nba/320 row in view · labels 11 · target links 1 · brands 2K · nfl/393 row in view · labels 11 · target links 1 · brands Madden |
| C8 | UtCard outer box | identical (±0.5 px) at every width 34-190; classes and aria-label kept | players-8 | **FAIL** | boxes identical · not built yet (players-8): card-contract.test.ts |
| C9 | Portrait fill and UT first open | first club row <=300 ms at 1x, <=900 ms at 4x; UT first open <= before +5% | players-8 | **PASS** | nba 1x row 76 ms · open 2220 ms · nba 4x row 129 ms · open 7727 ms · nfl 1x row 92 ms · open 5097 ms |
| C10 | Portrait memory | cache <=6 MB per 300 portraits; no main-thread toDataURL | players-8 | **FAIL** | toDataURL in src/ut/CardArt.tsx · not built yet (players-8): portrait.test.ts |
| C11 | Walkout figure | 56-72 art px, 6 heads tall; walk-in + celebration <=2.0 s; reduced motion a static bust for 600 ms | players-7 | **FAIL** | not built yet (players-7): walkout.test.ts |
| C12 | Bundle | appearance only in lazy chunks; budgets in plan section 2 | players-10 | **N/A** | measured on the production build in players-10 (scripts/audit_startup.py) |
| K1 | Keep-list | everything the audits say works still draws (anchors, observations, measurements) | every task | **PASS** | 13 items, 8 observed in play |

---

## 4. Cross-team contracts v1

Published in players-1 (plan section 6). Other teams can rely on these names and shapes; a change is announced here first.

### 4.1 Action contract and intake

**Today's acts** (all mapped by players-6/7; unknown acts fall back by family from players-2):
- **NBA:** `idle screen run dribble shoot layup dunk contact standdunk pass catch defend contest block cross stepback spin stumble fall land celebrate rebound`
- **NFL:** `stance run block throw catch carry juke spin stiff truck windup tackle down rush backpedal celebrate kick`
- **Soccer:** `idle run dribble kick tackle down dive catch header celebrate set wall`

**V2 acts, reserved now** so engines can emit them safely (family fallback until animated):

| Sport | Acts (V2 source) | Animated in |
|---|---|---|
| NBA (B.1.2, B.1.5, B.1.6) | `pumpfake`, `steal`, `ft` (set, dip, release, hold), `lob`, `euro`, `board` (= rebound), `ankle` (defender stumble → `slip`), `charge`, `foul`, `switch` (= run), `boxout`, `inbound` | players-7 (`pumpfake`, `steal`, `ankle`, `board`; `euro` and `boxout` stretch) |
| NFL (B.2.2, B.2.5, B.2.6) | `snap`, `drop`, `handoff`, `sack`, `slide` (QB), `throwaway`, `dive`, `truck` (with `charge` 0–1), `wrap`, `bighit`, `swat`, `pick`, `pile`, `hold` (FG holder), `catch:stride\|high\|toe` | players-5 (`snap`, `drop`), players-6 (`handoff`, `sack`, `wrap`, `bighit`; the rest stretch or phase 2) |
| Soccer (B.3.2, B.3.5, B.3.6) | `touch` (via `touchAt`), `shot:power\|finesse\|chip\|driven`, `header`, `volley`, `trick:stepover\|roulette\|dragback\|feint`, `tackle:stand\|slide`, `contain`/`jockey`, `shield`, `onetwo`, `keeper:set\|dive\|parry\|catch\|rush\|getup`, `throwin`, `corner`, `goalkick` | players-6 (`touch`, shots, `tackle:*`, `keeper:*`; tricks, header, volley stretch) |

**Optional Body fields, read defensively:** `kickFoot`, `diveHeight` (`'low'|'mid'|'high'`), `touchAt`, `passKind`, `shotKind`, `skill`, `contactAt`, `controlAt`, `windowMs` (dead-ball length), `charge`, `dropSteps` (3/5/7), `reach` (the reflex-save swipe; render reach only).

**Family fallback table:** shot-like → `shoot`; pass-like → `pass`; kick-like → `kick`; contact-like → `stumble`; ground → `down`; locomotion while moving; otherwise the last action pose, never idle while moving.

**Intake.** A sport team that adds an act adds a row to "Animation requests" in its own team doc (or tells the lead): the act name, which body, the start and end, the engine field holding the contact event time, and any Body fields. Players keeps the registry below. Rows registered before players-6 (NFL, soccer) or players-7 (NBA) starts are must-tier there; later rows get the family fallback and are listed for phase 2.

**Please do not hand-key poses in `select-*.ts` or the `render.ts` player sections.** If a pose is urgent, send the request; players adds a placeholder within the task in progress. Contact events come from engine fields; rendering never moves them.

**Animation request registry** (sport, act, body, start/end, event field, Body fields, registered, tier):

| Sport | Act | Body | Start → end | Event field | Registered | Tier |
|---|---|---|---|---|---|---|
| — | none registered yet | | | | | |

### 4.2 Ownership splits

- **Players own:** body poses and clip selection, act names and the fallback, celebration body motion, the walkout figure, sprite proportions and the art pixel, appearance, kits (`src/game/uniforms.ts`), ground marks, the venue *palette* (V2 grant: colours, textures, lighting and crowd colour in `persp.ts`, `court.ts`, `field.ts`, `pitch.ts`), crowd colour and reaction frames, portraits and card faces.
- **Sport teams own:** timing windows, the dead-ball window, confetti, skip input, banners, the ball's own visuals (trail, flames, incompletion bounce, net bulge), slow-mo application, the camera and on-screen sprite sizes (C.1.2 targets), floor/field/pitch line geometry, the horizon and stands geometry, bench/coach/referee placement, and the events themselves (sack, handoff, touches, tricks). The NFL sack is split: nfl owns the event and timing; players own the QB and sacker bodies.
- **nba's HUD kit** (`src/game/hud/*`) owns the score bug, toast line, pause, Heat bar and **name chips** (C.5 rule 6); it reads our anchors.
- **`juice.ts`:** nba+nfl own it. Players add an ≈8-line hit-stop cap and an optional `ms` argument (players-6), listed under "Touched outside my lane".
- **`card-face.ts`:** read-only for players (see the request in section 5).

### 4.3 HUD and rematch contract (players-5)

| API (on each sport's renderer) | What it does |
|---|---|
| `drawnOffset(who) → {dx, dy}` | screen px, ≤5% of body height |
| `headTop(who) → {x, y}` | anchor above the drawn head (name chips) |
| `feetAt(who) → {x, y}` | the drawn feet (PerfectRing, ground marks, tap-to-pass) |
| `groundEllipse(who) → {rx, ry}` | the ellipse aspect at that depth, so rings drawn by others match ours |
| `handAnchor(who, 'L'\|'R') → {x, y}` | ball in hand: snap, handoff, dribble |
| `pin(who)` | forces a fresh sprite this frame (rings, chips) |
| `resetMotion()` | at replay start, SIM jumps, pauses over 0.25 s and rematch re-seeds |

Hit tests and HUD placement use these, never `b.p.ht`, because the drawn height is exaggerated ×1.15 (render-only). Sprite caches survive a rematch with the arena mounted; the 6 Mpx art-px area cap holds across rematches.

### 4.4 Ground marks and the art pixel (players-2)

- `drawGroundMark(ctx, { x, y, shoulderPx, mark?: 'you'|'target'|'pressure'|'rival', color? })` in `src/game/pixel/ground.ts`: the soft shadow (`rgba(0,0,0,0.32)`, 70% of shoulder width) and, when asked, the 2 px ring in gold `#f6b93b`, teal `#4fe3c1`, red arc `#ff5d5d` or violet `#8b7cf6`. Nothing else on the field uses those four colours. `color` is the hook for ut's cosmetic ring colour (the Minutes 500/1,000-hour reward).
- `artScale(canvas) → { backing, devPerArt, artPxFor(cssHeight) }` in `src/game/pixel/art-scale.ts`. **To the sport teams:** your cameras set the on-screen heights; V2 C.1.2's targets are in design px (NBA controlled 51, NFL and soccer controlled 34, far 36 / 22.5); `players-screen.mjs` measures them and `players-verify.mjs` row S6 reports them. Today 1 art px = 1 canvas px = about 1 design px (section 2). If players-2 picks backing A or B, the resize code sets `canvas.width = W × backing` and draws through one `setTransform(backing)`; everything else keeps CSS px. That hunk is announced here before it lands.
- **Venue palette tokens** (players-4, V2 C.2): the surface grain at ≤4% contrast, the venue at least 30% darker than the players, the crowd in three value bands `#221d36`, `#342d52`, `#4a426e` with ≤6% team and ≤2% white flecks in 2 px blocks, corners −18%, objects higher on screen 6% darker and less saturated. Colour-only hunks through `src/game/pixel/venue.ts`, one line each, ledgered below. `crowd.excite('score'|'onfire'|'clutch')` is a no-op-safe call from players-4; reactions land in players-9.

### 4.5 PlayerPortrait and WalkoutFigure (players-7, players-8)

`<PlayerPortrait sport pid season c1 c2 num pos ht wt size variant="bust"|"cheer"|"locked"|"dim" pose? />` (`src/ui/PlayerPortrait.tsx`): main-bundle safe, shows a fallback until drawn, cached. Not a tap target; no text inside.

`<WalkoutFigure rc|ref sizeArt={56–72} maxMs={≤2000} onDone reduced />` (`src/ut/WalkoutFigure.tsx`): no text inside; reduced motion shows a static bust for 600 ms.

| Team | Uses (V2 cut applied) |
|---|---|
| ut | UT cards and squad (through `UtCard`), Collection (`UtCard mode`), MOTM, mastery and prestige (`finish`, `mastery`) |
| packs | reveal (`cheer`), the walkout (packs-9) per their cinema levels; several walkouts play one after another, each ≤2.0 s |
| nba / nfl / soccer | player of the game; nba's match intro uses `WalkoutFigure` |
| deferred | binder, poster (V2 F.2 players #7) |

`UtCard`'s new props (`mode`, `finish`, `mastery`) are optional with today's behaviour as the default; its outer box, `.utc-*` classes and `aria-label` stay as they are.

### 4.6 `impactOf` call sites (a hand-off, not counted done until seen at merge)

`impactOf(kind, { mass, speed, reduced }) → { stopMs, shake, slowMo }` in `src/game/pixel/impact.ts` (players-6), with the ≤150 ms-per-second hit-stop cap in `juice.ts`:
- **nba:** `Hoops2.tsx` `J.hitStop('green'|'dunk'|'posterize'|'block', now)` → `J.hitStop(kind, now, impactOf(kind, …).stopMs)`, plus `slowMo` where they already slow time; the PERFECT moment uses `green`.
- **nfl:** `Football2.tsx` (`truck`, `bighit`, `int`, the PERFECT juke).
- **soccer:** its J-2 call sites (goal, big save, woodwork, power strike).

### 4.7 Readiness

`pixelReady(sport): Promise<void>` (players-3) resolves when the sport's clips and appearance data are in. Shell and the sport teams add `await pixelReady(sport)` to the match loading gate (one line). Players also starts it at module load. `players-readiness.mjs` and verify row A7 measure it.

### 4.8 First-run showcase (ut, packs)

- Players ships `src/data/appearance/first-run.json` (`{ nba, nfl, soccer }`, ≥12 pids each, ≤1 KB, may be imported statically) and keeps 100% of it Tier A (curated by hand).
- **ut** (first-run flow, the ut-7 starter chain): export `firstRunShowcase(sport): string[]` (the card line ids shown in the first five minutes), or draw the shown stars from `first-run.json`.
- **packs** (starter pack): draw the starter's featured gold and its walkout from `first-run.json` ∩ the gold bucket. This changes no odds sheet for paid packs and no match protocol; it is packs' call.
- Post-merge verify checks 100% Tier A on whatever list they export.

### 4.9 Portrait (card faces) for ut's Collection

The Collection screen is ut's. Players gives it `PlayerPortrait` with `variant="locked"` (a recognisable silhouette: the player's own build, hair outline and gear in one flat tone) for unowned cards, and `UtCard mode="collection"` for owned ones. Busts are canvas-drawn once per player and size, cached in memory, and filled a few per frame, so a 100-card grid scrolls at the plan's p95 target.

---

## 5. Requests to the lead

1. **`card-face.ts` ruling.** It holds rating logic used by `rate.ts`; players only reads `faceWeights`. We ask that it move to packs (ratings), with players keeping read access.
2. **The backing-store hunk** in `Hoops2.tsx`, `Football2.tsx` and `Soccer2.tsx`: players-2 made it (≈4 lines each, section 7). Option C is adopted, so it changes nothing at runtime unless `?artpx=A`; at merge keep it beside the sport teams' resize edits.
3. **The `vite.config.ts` on-demand diff for shell** (players never edits `vite.config.ts`):
   `const onDemandModule = /[\\/](?:game[\\/]soccer2[\\/]|game[\\/]pixel[\\/]pitch\.ts|data[\\/](?:cards-(?:nba|nfl|soccer)|soccer)\.json|data[\\/]appearance[\\/]soccer\.json)/;`
4. **Reports (players does not edit these):**
   - brand-like badge names in `abilityName`/`ABILITY_HELP` (`hoops2/ratings.ts:200-207`) and `rate.ts:114` "Heat Check", now also a name clash with V2's in-match Heat;
   - missing NFL (26%) and soccer (7.7%) jersey numbers in the data files (L-5 backfill, the lead's data);
   - the NFL squad OL row overlapping at 320 (ut).
   - **New from players-1:** the CardDetail still shows a "2K" (NBA) / "Madden" (NFL) reference link with `target=_blank` (H6/M11; players-8 removes it); team badges under 4.5:1 ink contrast: NBA 5/55, NFL 11/47, soccer 69/250 teams (players-8).
5. **On-screen heights and the crowd share are the sport teams'.** Rows S6 and L7 report them (section 3); the numbers today are in section 2. Please re-run `players-screen.mjs` after a camera change.
6. **Post-merge:** run `node scripts/qa/players-verify.mjs --run all` on the merged tree (players-10 step 8).

---

## 6. render.ts hunk ledger

Every players hunk in a sport team's `render.ts` (or venue file), with its line anchor, so merges can find it.

| Task | File | Anchor | Hunk |
|---|---|---|---|
| players-2 | `hoops2/render.ts`, `football2/render.ts`, `soccer2/render.ts` | top imports | selection imports from `pixel/select-*`; `art-scale`, `ground`, `proportions` imports; re-exports of `dunkStyle`/`spins360` (NBA) and `lookFor` (soccer) |
| players-2 | same three | the old `lookFor` … `poseOf` block (NBA lines 41–351, NFL 56–301, soccer 42–159 at the base) | removed: moved to `pixel/select-*.ts` |
| players-2 | same three | renderer fields `sprites`/`last` | `SpriteCache<ArtSprite>`, `last: Map<string, ArtSprite>`, `art: ArtScale = ART_C` |
| players-2 | same three | `private sprite(` sizing lines (`const raw = …`, `const px = …`) | `drawnHeight` + `art.artPxFor` + `quantPx`; cache key `+ this.art.keySuffix`; `spr = toView(make(), this.art)` |
| players-2 | same three | `draw(ctx…` first line | `ctx.setTransform(this.art.backing, 0, 0, this.art.backing, 0, 0);` (identity at today's grain) |
| players-2 | same three | the player `// shadows` loop | `drawGroundMark(…)` per body |
| players-2 | same three | player blits `ctx.drawImage(s.canvas…` | `blitSprite(ctx, s, x, y)`; NBA `headOf.right` uses `s.w` |

## 7. Touched outside my lane

- **players-2, announced backing hunk** (plan §2, request 2 in section 5): `src/game/hoops2/Hoops2.tsx`, `src/game/football2/Football2.tsx`, `src/game/soccer2/Soccer2.tsx`, the resize code in the draw loop: one import of `artScale` plus 4 lines (`renderer.art = artScale(canvas, W, H)`; the backing size `bw`/`bh`; the size check and `canvas.width/height` use it). With the adopted option C the backing is 1, so the canvas is exactly as before; `?artpx=A` turns on the device-resolution backing.
- players-1 changed only `scripts/qa/players-*` and this doc.

## 8. Deviations from STREAM, recorded

- **A-5 "interpolating 15 fps clips".** Research R2 says never interpolate between cached frames (pixel joints shimmer). We sample clips natively at 30 fps for the near, large and ball bodies instead, and blend only *between clips*. V2 B.1.6's rates (handler and defender 30 fps, others 15) agree.
- **STREAM's skin-palette crowd recolour** is replaced by V2 C.2's three dark value bands with team flecks; the front-row sprites (players-9) use the 10 skin tones, so the crowd is still not one tone.

## 9. Owner device checks

1. "Can you tell who is who?" at a glance: the NBA five, the NFL backfield, the soccer front three, in portrait and landscape.
2. The 5-head proportions and the art pixel on a real iPhone (V2 decision 3): crisp, even pixels, nothing blurred. Compare the adopted grain with `?artpx=A` (1.5 design px art pixel on a device-resolution canvas) in each sport: A was 15–20 fps at 4× CPU on this machine, so check whether the phone holds 60 with it before anyone switches.
3. Calmer venues: do the players pop off the court, field and pitch?
4. Card readability on the phone at every size; frame and foil rendering in iOS Safari.
5. A 100+ card club scroll.
6. Animation: transitions, planted feet and turns in a real match; NFL near-player smoothness; the handoff and the sack; keeper dives.
7. Celebration, walkout and crowd timing; reduced motion on the device.
8. After a full match and two rematches, background the PWA and return: it must still be alive.
9. Skin tones of curated stars look right.

## 10. Left undone, and why

- **players-2:** the slide classifiers still carry their own copy of the renderer's branches (they reproduce players-1 exactly); switching them to import `select-*.ts` lands with players-5, which rewrites locomotion and its classifier together. The verify row S2 still uses players-1's heads-tall definition (figure ÷ box with hair), which V2's table can't meet; `proportions.test.ts` is the gate (section 1, players-2). V2 C.1.3's five-tone shading, cast-shadow silhouettes and general rim light are newer than this task's spec (three tones); they are recorded for players-4.

- **The NFL golden sequence is not deterministic in the browser.** Two repeats under Playwright's virtual clock diverge at frame 29: one draws a defender in the hand-keyed `stance` pose (`st2`, the pre-snap branch of `poseOf`), the other the `ready` clip, so the play's phase differs between runs (something in the NFL bench still follows real time, or a clip arrives late). NBA and soccer are deterministic after this task's fixes. **For players-2's extraction check, the node-side `select-golden.test.ts` (seeded engine, no browser) and the three slide classifiers are the byte-identical gate**; the browser sequence stays a diff aid. Whether this is a readiness race is a players-3 question (row A7).
- **The 4× CPU numbers are not comparable with the audit's** (dev server on a machine shared by seven teams vs the audit's production build on a quiet machine). players-10 repeats `players-matchperf.mjs` on `vite preview`; the relative rows (A5) compare like with like in the meantime. Row A5 also fails at 1× today for the same reason (55.4–59.0 fps in 9 of 15 runs while other teams ran builds and Playwright), not because of the game.
- **Crowd detection is approximate.** `players-screen.mjs` finds the stands as the band of textured rows above the surface; the screenshots it saves beside the numbers are the check by eye. The numbers agree with the screenshots looked at (NFL 393: stands ≈ y 120–270 of 852, measured 16.9%).
- **Nothing else from players-1 is left.** Every later row in section 3 belongs to the task named in its row.
