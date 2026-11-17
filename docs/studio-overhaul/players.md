# Team players: team doc (studio overhaul, Game Design V2)

Real-life likeness, "Broadcast Pixel" sprites, animation that looks real, and card faces. Branch `claude/studio-players`, worktree `/home/user/ps-s-players`, dev-server port 5214. The plan is [`players-plan.md`](players-plan.md) (revision 3); this doc is the running record: what changed, the numbers, the contracts other teams rely on, and what is left.

`O` means the overhaul scratch folder (`/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`). Screenshots and JSON reports live in `O/shots/players/<task>/`.

**For the lead and the other teams:** the contracts are in [section 4](#4-cross-team-contracts-v1), the requests to the lead in [section 5](#5-requests-to-the-lead), and the post-merge check is `bash O/heavy.sh node scripts/qa/players-verify.mjs --run all --port <port>` (section 3).

**V2 revision note.** `GAME-DESIGN-V2.md` was revised at 13:09 on 2026-11-16, after this team's plan (12:40). The players-1 fix (section 1) brought the harness rows, the published contracts and this doc into line with the revised text: on-screen sizes are **floors** with camera guides (no team is asked to shrink), the stands take 30–40% of the screen above the far boundary, shading is five tones plus a rim light, shadows are cast silhouettes, the crowd is head-and-shirt blocks, and the visual target is `mockups-v2.html`. The plan's ledger is `players-plan.md` §0 "Revision 3.1 ledger".

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
| `players-screen.mjs` (new) | **V2 rows** on the match screen: the art pixel's design and device scale at DPR 1/2/3, on-screen sprite heights in design px against C.1.2's floors and camera guides, the venue (grain, stands vs sprites neighbour contrast and chroma, the crowd's colour families, vignette; venue vs sprite lightness reported), the stands' share of the screen height | new |
| `players-strips.mjs` | animation strips, pose jump at hard cuts, the golden per-frame sequence under the virtual clock | audit `strips.cjs` |
| `players-burst.mjs` | 0.25× slow-motion bursts and contact sheets | audit `burst.cjs` |
| `players-cards.mjs` | every `UtCard` width 34–190 at 393 and 320 (box, type sizes, truncation, head size, animations), 13 UT surfaces, badge contrast for every team, CardDetail (links, brand names, tiles), UT first open and portrait fill at 1×/4×, a reduced-motion sweep | audit `utui` harness |
| `players-keep.mjs` | the keep-list: what the audits say works must survive | likeness audit Part 4, NBA/NFL "what works" |
| `players-slide-{nba,nfl,soccer}.ts` | foot sliding per body-frame (vite-node, seeded autopilot) | audit `soccer_slide.ts`, NBA audit method; NFL is new |
| `players-targets.mjs` (new) | renders the visual target `mockups-v2.html` (gameplay, juice, walkout and card frames, `target-v2-*.png`); with `--superseded` also `mockups.html`'s lineups and HUD (control geometry only) | new |
| `players-verify.mjs` | every plan section 3 row, PASS/FAIL/N/A, plus the route log | new |

**Fixes made while finishing the harness:**
- The soccer burst stopped at frame 37 of 48 with "Target page, context or browser has been closed". The most likely cause is the dev server's state, not the burst: a freshly started `vite` re-optimises its dependencies (`Re-optimizing dependencies because vite config has changed` in the log) and reloads open pages on the first visit, and this session reproduced that fresh-server state as a 90 s canvas timeout on the first soccer visit; a renderer crash on the loaded machine would look the same. Fix for both: `warmUp()` opens each bench once before it is measured, `watchErrors` now records renderer crashes, and the burst restarts a sport once if its page still closes or navigates mid-capture (the report carries `restarts`). The rerun completed 48/48 frames in all three sports with 0 restarts.
- `players-cards.mjs` could not reach the Scout Market: the Store's sections are a `Segmented` control (`role="tab"`), not buttons. Its new reduced-motion pass keeps its error and a screenshot in the report instead of ending the run (one run timed out on the shared machine; the next two completed).
- The isolation router now lets `file:` URLs through (local files never leave the machine), so `players-targets.mjs` can open the mock-ups page from disk.
- The golden sequences: NBA's two repeats were identical except that one drew 1 more frame (the virtual clock's last step), and soccer's started at different game times (the lab needs the clock to mount, and the clock moved while chunks were still arriving on the loaded machine). The digests now cover the frames every repeat drew (`commonFrames`), and the clock only moves while the network is quiet (`sameStart` is reported).

**Verification.** See section 2 for every number and section 3 for the verify runs. `bash O/heavy.sh npm run typecheck`: pass. `npx vitest run scripts/qa/players-lib.test.ts`: 7 tests pass (sprite keys, size buckets, the stale and animation-rate summary, the new per-frame height reduction, contrast, URL isolation, options). Every script ran on the base commit and printed its JSON line. 0 non-localhost requests in every report; the route logs show the live Supabase host blocked by the router (the UT fixture's cloud-save attempts), never reached. Screenshots looked at: the lineups, in-game and screen frames for all three sports, the card detail, and the mock-up targets.

**Protocol bump needed:** none (no source change).

**Fix after the independent review** (players-1 was reviewed over `1d14201..79682ba`; fixed on HEAD `2940ccd`, scripts and docs only):

1. **V2 rows on the revised text (high).** S6 is now a floor check (controlled ≥51 NBA / ≥34 NFL and soccer, far ≥36 / ≥22.5 design px) with the camera guides (≈95 / 70 / 75) printed beside it, so a camera that follows V2 is never failed for being bigger. L7 is inverted to C.5 rule 4 (stands 30–40% of the screen above the far boundary; 27–43% accepted). S1 gates whole device pixels only and prints "pending the lead ruling" for the 1.5 design px half (`S1_RULING` in `players-verify.mjs`; request 7). The doc's §2.1 sentence, §4.4 and request 5 no longer ask anyone to shrink.
2. **Visual target (medium).** `players-targets.mjs` renders `mockups-v2.html` by default: `target-v2-{nba,nfl,soccer}.png` (+ `-3x` close-ups), `target-v2-{dunk,ankle,hit,goal,walkout}.png`, `target-v2-cards.png` (+ `-2x`). The `mockups.html` captures stay, labelled "superseded: control geometry only" (§2.6).
3. **S3, S8, L6 on the revised C.1.3 and C.2 (medium).** `players-lineup.mjs` reads `rasterBody`'s material slots: tones per main material and the rim light (the share of pixels with nothing above-left drawn in their material's brightest tone). S3 = edge `#14121c` 100%, 0 inner outline-colour px, ≥3 tones and a rim (≥90% lit), plus `shading.test.ts` (players-4) for five tones and contact shadows. S8 adds `cast-shadow.test.ts` (players-4). L6 = grain ≤4%, stands softer and foggier than the sprites (neighbour contrast and chroma ratios <1), a mixed crowd (≥3 colour families at ≥3%, none above 55%, near-white ≤20%), a vignette, plus `venue.test.ts` for C.2's exact shirt shares; "venue ≥30% darker" is reported only. §4.4's venue tokens are re-published.
4. **L4 (medium)** reads the appearance record (`appearanceFor`, players-3) and its source rows: Iverson cornrows + headband, Kareem goggles, Haaland blond + a long silhouette, Rodman a V2 dyed tone in a 1994–98 season, Mbappé short/buzz + no facial hair, Shaq bald, Brady curated with `reviewed: true`. Until players-3 lands the row reads "not built yet (players-3)"; nothing is judged from today's hashed looks.
5. **Fonts (medium).** Verify prints each report's font mode and marks C4, C5 and C7 N/A unless the cards report says `archivo-local`. The four Archivo woff2 files (OFL) are shared at `O/qa-fonts`: run with `PS_QA_FONT_DIR=O/qa-fonts` (the lib header says how to fetch them otherwise).
6. **A18 (low)** no longer passes on a missing sample: it needs ≥200 lookups of ≥48 px bodies (or ≥32 px; the probe now records `32px-0-19`) in the 20 frames after a snap. Today's NFL camera shows no body ≥32 px that early, so the row reads "no sample".
7. **C9 (low)** measures what the plan row asks: on a 140-card club (`utFixture({ extra: 100 })`), the first row, a 120-card fill and a club-grid scroll at 24 design px a frame with a frame sampler (p95, max) and a long-task observer, at 1× and 4×. UT first open is reported beside it, not gated (dev-server runs spread 2×); players-10 gates it on `vite preview`.
8. **C5 (low)** adds every cut-off text in the CardDetail sheet (scrollWidth > clientWidth with hidden overflow or an ellipsis), so "Throw under pressure" counts.
9. **Tests by path (low).** Verify names each proving test by its repo path (`TEST` table); a basename that also exists elsewhere under `src/` is printed as a warning, never used.
10. **Doc (low).** Request 6 runs verify through `heavy.sh`; §10 now says 10 of 15 runs missed at 1×.
11. **Found while re-running:** `players-screen.mjs`'s venue sampler imported a fresh copy of the renderer after source edits (the dev server serves edited modules as `?t=…`), so on players-2's tree it recorded 0 venue frames and every venue value was null. It now imports the copies the page loaded, like the probe.

**Fix verification** (HEAD `2940ccd`, dev server 5214, `O/shots/players/players-1/fix/`, tag `fix`): every changed script passes `node --check`; `players-lib.test.ts` 7 pass (via heavy.sh). Re-run via heavy.sh: `players-lineup` (S3 at HEAD: edge `#14121c` 100% and 0 inner outline px in all three sports; tones per main material min 2–3, rim lit 54–64% min, so S3 waits for players-4; L4 "not built yet (players-3)" for all 7 looks: `appearance.ts` does not exist yet), `players-screen --secs 12` (S6: NBA 73.4 ≥ 51, NFL 29.8 < 34, soccer 33.7 < 34 by a hair; L7 stands 13.5–24.6% of the screen against 30–40%; the L6 venue values in §2.2), `players-sprites` (NFL: 0 lookups of a ≥32 px body in the 20 frames after a snap, so A18 reads "no sample"; NBA 714 at ≥48 px), `players-cards` with `PS_QA_FONT_DIR=O/qa-fonts` (`fonts: archivo-local`; all 13 surfaces at 393 and 320 in all three sports; "Throw under pressure" cut off in the NFL CardDetail at **393 and 320**; the fill and scroll numbers in §2.4), `players-targets --superseded …/mockups.html` (13 mockups-v2 captures at 393×852 design px and 3×, cards at 1× and 2×, plus the 7 superseded ones; 0 external requests). Verify on these reports (`--tag fix`, vitest on): **2 PASS · 38 FAIL · 7 N/A** (S1 N/A pending the ruling; S5 and A17 pass; the other N/A rows have no report in this folder because the fix did not re-run matchperf, readiness, strips, keep or the slide classifiers, whose rows did not change). A copy of the cards report marked `fonts: fallback` turns C4, C5 and C7 N/A. 0 non-localhost requests in every report (the live Supabase host blocked 297 times by the router, never reached). Looked at: `target-v2-{nba,nfl,soccer}.png`, `target-v2-cards.png` and the fix screen frames.

### players-2 · Broadcast Pixel sprite core (done)

Base `79682ba` (players-1). Six commits; everything render only (proved below), so **Protocol bump needed: none**. No storage key, save field, card/edition/copy id or engine number changed.

**What changed**

1. **Selection extracted** (`50910ce`). `lookFor`, `animOf`, `gait`, `poseOf`, `dunkStyle`/`spins360`, the rim hang, the dribble arm and the NFL ball arm moved verbatim from the three `render.ts` files into `src/game/pixel/select-{nba,nfl,soccer}.ts`; `hoops2/render.ts` re-exports `dunkStyle`/`spins360`, `soccer2/render.ts` re-exports `lookFor`. The moved lines are byte-identical apart from `export`.
2. **Family fallback** (`fd0bf4e`, `select-family.ts`). An act a sport doesn't animate yet resolves to one it does: the act, either half of `kind:variant`, the contract's aliases (`board`→`rebound`, `switch`→`run`, `ankle`→`fall`, `sack`→`tackle`, `keeper:dive`→`dive`…), then its family (shot, pass, kick, contact, ground, locomotion). Unclassified acts run while the body moves and hold the set pose while it stands, so nobody idles on the move. (Refinement of the contract's "otherwise the last action pose": replaying an earlier action out of context is worse than the set pose; recorded here.) Known acts take the old path untouched.
3. **Raster split** (`1c3b077`). `Buf`/`buffer`/`put`/`capsule`/`ball` and the light moved to `raster.ts`; `drawBody` = `rasterBody` (pure: RGBA + anchors + per-pixel slot/part) + `toSprite` (canvas). The 24-sprite golden raster hash reproduced the base `e36f4a3b` exactly before any style change.
4. **Broadcast Pixel style** (`b058e3d`).
   - `proportions.ts`: the head sized in whole rows from V2's table (`headRows`, `targetHeads`; see "Review fixes" below: the first cut's `headScale` × `HEAD_FIT` 0.92 only held at the band centres), round up to 6 rows, limbs ×1.15, drawn heights spread ×1.15 around each sport's mean (NBA 78.5 in, NFL 74, soccer 71.5), torso 8–13 art px face-on at 34 px from BMI (`8 + 5·clamp((BMI−18)/15)`), a V-taper, the arms set outside the torso (moved whole: no bone changes length), NFL pads +2.2 px per pad unit. Hair volume on the crown for short/headband/locs styles.
   - Outline and tones: a 1 art px `#14121c` ring; inner separations, pinholes, 2-px gaps and concave corners in the farther part's shadow tone (corners turn on the diagonal); `ramp3` (`color.ts`): shadow L−22 with the hue turned 10° toward blue along the shorter arc (gold → orange, red → magenta, navy → blue), highlight L+14, ends nudged so the three tones stay distinct and never equal the outline; light from the top-left; no dithering (accidental 2×2 checkerboards are cleaned); a lit-side skin rim when skin and jersey are both dark (wired on any look; curated skin arrives in players-3).
   - `ground.ts`: `drawGroundMark` (soft `rgba(0,0,0,0.32)` at 70% of shoulder width, 1 px halo; rings `you #f6b93b`, `target #4fe3c1`, `pressure #ff5d5d` arc, `rival #8b7cf6`, `color` override) and `groundEllipse`. The three renderers' player shadows now use it (airborne bodies shrink and fade); the rings are the HUD owners' call.
   - The "everyone shares one skin tone" comments in `sprites.ts` and `body.ts` now describe the neutral default.
5. **The art pixel** (`430c52a` + this task's last commit): `art-scale.ts` (`devPerArt = max(2, round(1.5·k·dpr))`, k = the stage's design scale), sprites rasterised at their own art size (far players natively), `toView`/`blitSprite` (whole canvas px position and scale), `quantPx` steps 1/2/4/6 art px restarting at each band (≤14, <30, <62, above) at a 1.5 view px art pixel, 1/2/3/4 at today's grain (review fix). Cache keys gain `|cpa/backing` only away from today's grain.

**The art-pixel decision (measured; plan §2, §6.4).** `players-matchperf.mjs --vp 393 --cpu 1,4 --dpr 3`, dev server, the shared machine:

| Option | NBA 1× / 4× fps | NFL 1× / 4× | Soccer 1× / 4× | 4× long tasks (NBA/NFL/soccer) |
|---|---|---|---|---|
| Base (players-1) | 59.0 / 34.8 | 57.5 / 33.3 | 60.0 / 40.1 | 17 / 24 / 11 |
| **A** device-resolution backing, 1.5 design px art pixel (5 device px at 393 DPR 3) | 58.7 / **14.7** | 57.9 / **18.6** | 58.5 / **19.7** | 106 / 85 / 79 |
| **C** today's grain + the new proportions (run 1 / run 3; best single runs, see the paired rows under "Review fixes") | 57.7 / 34.2 · 59.6 / 49.3 | 59.5 / 42.5 · 59.9 / 53.7 | 59.4 / 37.9 · 59.6 / 54.5 | 21 / 14 / 10 · 5 / 6 / 8 |

A fails the §3.3 4× row by half (the ×9 backing store's fills, not the sprites), so **C is adopted** (`ADOPTED = 'C'`). B (a 2× backing) was not built: at DPR 3 it can't give a 1.5 design px art pixel a whole device-px size (3 canvas px = 4.5 device px), and at 1 view px it draws what C draws. A stays selectable with `?artpx=A` for owner device check 2. C's sprite area peak 5.78 Mpx at 393 (≤6), heap 23.4→24.3 / 19.8→20.3 / 24.6→25.6 MB.

**Whole device pixels** (`players-artpx.mjs`: every sprite blit instrumented, DPR 1/2/3 × 393/320 × three sports × A and C): **0 of 126,687 blits** at a non-integer device scale or position. A draws at 2/3/5 device px per art px at 393 (DPR 1/2/3); C at 1/2/3.

**Measured on the raster** (V2 C.1.1; after the review fixes, `proportions.test.ts`):

| Band (art px figure) | Heads tall target | Mean over the band (6 hair styles, every height) | Heads within ±0.25 | Head rows = nearest whole row to figure ÷ target | At the centre: heads, box w×h (target) |
|---|---|---|---|---|---|
| 16–20 | 4.5 | 4.50 (was 4.50) | 18/30 (was 12/30) | 30/30 | 18: 4.50, 4×5 (5×5) |
| 22–26 | 5 | 4.92 (was 4.73) | 30/30 (was 18/30) | 30/30 | 24: 4.80, 5×6 (6×6) |
| 32–36 | 5.5 | 5.50 (was 5.10) | 18/30 (was 13/30) | 30/30 | 34: 5.67, 6×7 (7×8) |
| 56–72 | 6 | 5.92 (was 5.19) | 90/102 (was 9/102) | 102/102 | 64: 5.82, 13×13 (12×13) |

Heads tall is the figure (feet to crown; the outline and the hair over the skull excluded, so a high top doesn't count as body) over the skull's rows; the box includes hair. A head is whole pixels, so ±0.25 heads is finer than one row below 56 art px (at 18 px one row is 1.1 heads, at 34 px 0.9): there the gate is the nearest whole row, and at 56–72 the two heights with no row inside ±0.25 (57 = 6.33 or 5.70, 63 = 6.30 or 5.73) are the only misses. The "was" columns are the same sweep run on `f5d87be` before this fix (figure including hair, as the review measured). V2's own table can't hold under players-1's harness definition (figure ÷ box-with-hair: 34/8 = 4.25, never 5.5), so the verify row S2 still reads the old definition; the unit test is the gate.

Torso at 34 art px face-on: **Shaq 13, Bol 9 (difference 4)**, BMI 31 vs 20 at 78 in: 13 vs 9 (**+44%**); Jokić 11, Giannis 11 (players-4 re-runs with real weights).

**Kept identical** (the extraction acceptance): node-side golden digests over every body every other frame, base vs moved: NBA `556ad50a` (88,750 samples), NFL `ed52d518` (104,852), soccer `326e398f` (31,656). These digests are the proof that the moved selection code is byte-for-byte the old behaviour. (The three slide classifiers also still read NBA 29.1%, NFL 40.4%, soccer 13.7%, but they carry their own copy of the old branches and never import `select-*.ts`, so they are not evidence for the move; see section 10.) (The browser golden sequence includes sprite px, which players-2 changes on purpose; as players-1 recorded, the node digests are the byte-identical gate.)

**Render only, proved** (`render-only.test.ts`, `render-only-soccer.test.ts`): no module reachable by static import from any sport's simulation (NBA engine/autopilot/game/ratings/badges, NFL engine/autopilot/drive/ratings/squad, soccer engine/autopilot/match/ratings/shootout) is in `src/game/pixel/` or `src/data/appearance/` (`soccer2/arcade.ts` is excluded as the lazy-load barrel that re-exports the screen); a seeded NBA, NFL and soccer game hashes the same full engine state after every step with the whole drawing pipeline (look, clip selection, proportions, art scale, a raster every 20 steps) run on every body.

**Other numbers after players-2** (393, dev server): stale draws NBA 2.7% (was 4.4), NFL 40.8% (41.4; players-5), soccer 1.8% (1.9); keep-list PASS.

**Harness fixes** (`scripts/qa/players-lib.mjs`, `players-artpx.mjs` new): the in-match probe now imports the exact module copies the page runs (after a source edit the dev server serves `body.ts?t=…`, and a bare import patched an unused copy: sprite area read 0); `parseSpriteKey` drops the `|cpa/backing` suffix; `--artpx A|C` passes through every match URL.

**Tests added:** `select-golden.test.ts`, `select-golden-soccer.test.ts` (+ `select-golden.helpers.ts`), `select-family.test.ts`, `raster.test.ts` (hash `d53fc0a0` after the review fixes; `38046b9e` at `b058e3d`, `e36f4a3b` at base), `proportions.test.ts`, `outline.test.ts`, `ground.test.ts`, `art-scale.test.ts`, `render-only.test.ts`, `render-only-soccer.test.ts` (+ `render-only.helpers.ts`), `players-lib.test.ts` (key suffix).

**Looked at** (`O/shots/players/players-2/`): `after-p2-lineup-{nba,nfl,soccer}.png` beside `players-1/before-lineup-*.png` and `after-p2-vs-target-nba.png`; `after-p2-ingame-sheet.png` (three sports at 393 and 320); `p2-artpx-{A,C}-<sport>-393-dpr3.png` and the crops `crop-{A,C}-nba.png` (DPR 3 close-ups). The outline, build and head size read as V2 asks; front-on poses, hair, skin and gear are players-3/4.

#### players-2 review fixes (`9ed8a59`, `b2d86ed`, `5b74686`, `b6f63d3`)

An independent review of `79682ba..2940ccd` found two medium issues and five low ones. Fixed on HEAD `f5d87be`; all render only, **Protocol bump needed: none** (no engine, timing or rating code touched; `render-only.test.ts` still passes).

1. **Heads held only at the band centres (medium).** `headScale × HEAD_FIT` was one constant fitted to 18/24/34/64; swept over every height it read 5.08–5.73 heads at 56–72 (near and replay players had heads too big) and 3×3 boxes for some styles at 16–18. Now (`proportions.ts`): `targetHeads(fig)` reads V2's table (linear between bands), `headRows(rigHeadR, px)` = the nearest whole row to the standing figure (`figurePx(px) = 0.8·px + 1.8`, fitted on the raster) over the band's heads (a taller player's smaller rig head still shows), `headCols` = rows (round heads; hair volume makes them taller), and `snapCentre` puts the head on a pixel edge or centre so it gets exactly that many rows and columns at any sub-pixel offset. The head now covers the torso and neck it sits on (`ball(..., over)` in `raster.ts`), so its chin no longer sinks into the chest and the visible head is the drawn head. The high-top block and the locs are hair volume (part 7) behind the skull, not skull; short, headband and locs hair rises a little more over the crown (V2's box "with hair": 13×13 at 64 against 12×13). `proportions.test.ts` sweeps every figure height in each band with all six hair styles: nearest-row heads ≥95% (100% measured), band mean within ±0.1, ±0.25 heads for the most heights whole rows allow at 56–72 (15/17), head boxes ±1 of V2's box or of it scaled to the head's rows. Table above.
2. **Dark kits swallowed the outline (medium).** `ramp3('#000000')` gave `#060607/#121212/#363636` and `#101820` a shadow darker than `#14121c`. Now every kit tone keeps ΔE ≥ 10 (CIE76, `deltaE`/`toLab` in `color.ts`) from the outline and is lighter than it: the shadow lifts along its own hue until clear, the base stays ≥ 6 points over it. Black kits draw `#28282f / #3b3b3b / #5e5e5e` (the outline around them reads as the black), `#101820` `#1b2437 / #25384b / #3d5c7a`. White kits keep their base up to 0.95 lightness with a pure white highlight (`#ffffff` → `#b5b6c0 / #f2f2f2 / #ffffff`, was a `#e6e6e6` base). Skin, hair, buzz and numbers use the identity rule (`ramp3(c, true)`): the base stays exactly as curated (the darkest Monk tones and black vs dark-brown hair stay distinct; lifting them would have merged Monk 9 and 10), and only the shadow is held ≥ ΔE 6 off the outline where there is room. `outline.test.ts` loops over every colour in `teams.ts` (jersey, trim, alt, helmet, mask, pants, plus the defaults) and checks all three tones, the white kit rule and the identity rule. I used ΔE 10 rather than the review's example 12: at 12 a black kit's base lands at `#424242` and reads grey on the phone; 10 keeps a visible shadow step (ΔE ≥ 5 between tones) and the silhouette.
3. **Slide classifiers (low).** Verified: they hard-code the old branches and never import `select-*.ts`, and a port is not an import swap (see section 10). The golden digests remain the proof of the move; the classifiers are no longer cited as evidence.
4. **Art-pixel fps (low).** The headline 4× numbers in the table above (49–54 fps, "run 3") were best single runs and are not reproducible; use the paired rows below. `players-matchperf.mjs --vp 393 --cpu 1,4 --dpr 3 --window 10`, dev server 5214, the two trees served alternately on the same port and measured back to back (`O/shots/players/players-2/fix/perf*/`, 0 external requests). Each cell is round 1 / round 2, fps:

   | Pair | NBA 1× · 4× | NFL 1× · 4× | Soccer 1× · 4× | Sprite-area peak (NBA, Mpx) |
   |---|---|---|---|---|
   | players-1 base `79682ba` | 59.8/59.5 · 51.5/49.0 | 59.8/59.3 · 53.9/50.7 | 60.0/60.0 · 57.9/55.5 | 5.42/5.61 |
   | these fixes, first cut (no ramp memo) | 57.9/59.4 · **38.3/37.7** | 58.7/59.6 · 48.0/51.2 | 59.8/59.8 · 53.3/51.6 | 5.41/4.93 |
   | pre-fix HEAD `f5d87be` | 59.9/59.6 · 51.5/41.7 | 60.0/58.2 · 56.5/47.4 | 60.0/59.6 · 58.6/56.9 | 5.79/5.18 |
   | **these fixes** (`b6f63d3`) | 60.0/59.6 · 48.5/48.8 | 59.8/60.0 · 54.6/53.4 | 60.0/60.0 · 55.9/56.0 | 5.62/5.07 |

   The paired runs caught a regression in the first cut: the outline-clearance ramp walks a dark kit's lightness up in steps and was recomputed for every sprite rasterised (NBA 4× 38 fps against 49–51). `ramp3` now memoises by colour (`b6f63d3`), and the fixed tree sits within the machine's run-to-run spread of both the pre-fix HEAD and the base (round 2 of "these fixes" was re-run once after its first two tries timed out waiting for the page's canvas while the shared dev-server dep cache re-optimised after a tree switch). NBA 1× holds 59.5–60.0 in these runs. The sprite-area peak stays under the 6 Mpx cap but within 0.4 Mpx of it at its highest (5.79 on the pre-fix tree); players-5 re-checks it with the 60 s window. These are dev-server numbers on a machine shared by seven teams; players-10 repeats them on `vite preview`.
5. **Size pops under option C (low).** `quantPx(artPx, viewPerArt)` scales the 1/2/4/6 art px steps by `viewPerArt / 1.5` (rounded up): 1/2/3/4 at today's grain, so a 64 px near player steps 4 px (6%, was 6 px = 9%); option A keeps the plan's steps. The three renderers pass `this.art.viewPerArt`. Re-checked (`players-sprites.mjs --tag p2fix`, 393, 18 s): stale draws NBA 2.9% (2.7 before the fix), NFL 40.6% (40.8; players-5's A-1), soccer 1.4% (1.8); sprite-area peak NBA 5.68 Mpx, NFL 1.83, soccer 3.54; 0 external requests.
6. **White kits read light grey (low).** Fixed with item 2.
7. **Orphaned JSDoc in `select-nba.ts` (low).** Removed (its `shotAt` note moved into `animOf`'s comment); "2K-style" reworded to "tiered".

Raster golden hash `38046b9e` → `d53fc0a0` (intended: heads, hair volume, ramps). Looked at: `O/shots/players/players-2/fix/p2fix-before-after.png` (six kits, before and after, 20/28/40/76 art px) and `p2fix-lineup-{nba,nfl,soccer}.png` (`players-lineup.mjs --tag p2fix`, 0 external requests).

### players-3 · Appearance model, data pipeline, readiness, first-run Tier A (done)

Base `4b13e67` (players-2's last commit). Render-only and static data: **Protocol bump needed: none.** No storage key, save field, card/edition/copy id or engine number changed; the simulation imports none of it (`render-only*.test.ts` still pass, the per-step engine hashes identical).

**What changed**

1. **`src/game/pixel/appearance.ts`, V2 C.1.4's record.** Option lists: 18 hair silhouettes, 15 hair colours with V2's hexes (`team` = kit colour), facial hair V2's 5 + stubble, chinstrap, short (8), head (band, wrap, skullcap), eyes (goggles, visor clear/dark/tint), arm/leg gear, socks, accent colours, builds, hand, foot, and the NFL and gear fields: `mouthguard`, `neckRoll`, `helmetHair` (locs, flow, curly), `towel`, `gloves`, visor tint. A key whitelist (`checkKeys`) rejects anything else: there is no race, ethnicity or nationality field and nothing is derived from a name, nation, birthplace or team.
   - Palettes: the 10 Monk Skin Tone bases, 12% more saturated in game, `skinRamp(i)` = shadow, base, light (`ramp3`), the `#14121c` outline and a lit rim; `NEUTRAL_SKIN = '#a8714f'` (unchanged, = `DEFAULT_SKIN`) for every uncurated player.
   - LOD: `lodHair` collapses to none/cap/tall/long below 24 art px; `lodFacial` drops facial hair below 20 except a full beard (players-4 draws with them).
   - **One build formula, `buildOf(sport, ctx)`**: the card line or engine body, else the draft cell's attrs (`CELL:pid`), else the position's typical build; soccer heights clamp to 155–205 cm with 181 cm missing (the match's own rule) and weights come from V2's BMI by position, so Messi weighs the same in the match and on his card.
   - **Seeded defaults** (`defaultAppearance`, FNV-1a per pid and field, the same on every phone): neutral skin; hair by decade from the plan's table (no style above 40%, at least five per bucket); tone black 55% / dark brown 30% / brown 15%; facial none 60 / stubble 15 / short 12 / goatee 7 / full 6; the accepted gear priors (NBA shooting-arm sleeve 12% from 2004, knee sleeve 10%, era high socks; NFL clear visor 25% at skill positions from 2005, towel 30% QB/RB/WR from 1990, gloves 90% WR/RB from 2000, OL long sleeves 15%, hair out of the helmet from the hair; soccer long sleeves 15%, low socks 8%, keeper gloves); shoes by era. Never defaulted: headbands, goggles, dyed or blond hair, left hands.
   - `appearanceFor(sport, pid, season?, {pos, span})`: defaults, then the curated base, then each era that covers the season (a draft cell's whole span, else the base: Rodman is natural in Detroit, platinum in San Antonio, red in Chicago). `refOf` reads every id form (draft cells, every card edition, `standout:<week>`, `live:<promo>[.f]`, `holo~`, `evo~a+b~`, soccer `pid:season:fr`; stand-ins return null). `encodeAppearance`/`decodeAppearance` are shared with the build script.
2. **`src/game/pixel/looks.ts`:** `matchLook(sport, ref, kit, {num, ht, wt, pos, gk, pads, cosmetic})` and `cardLook(line)` return today's `Look` (legacy `hair`/`beard`/`skin`/`hairColor` filled from the record, so the current raster draws curated looks as they are) plus `app` (the record) and the reserved `cosmetic` hook (`shoes`, `ring`) for ut's mastery and Minutes rewards. **Not wired into the renderers or `CardArt` yet**: that is players-4 step 3, with the raster that draws the 18 silhouettes.
3. **Data and pipeline.** `src/data/appearance/source/<sport>.looks.json` (names, `src`, `skinSrc`, `reviewed`; never imported by the app) → `src/data/appearance/<sport>.json` (one base-36 character per field, `|from-to:` eras). `scripts/build_appearance.ts`: `--build`, `--check`, `--candidates <sport> [n]` (GOAT, Legend, top overall, the starter gold slot's odds, edition count, the first-run list), `--first-run [--write]`, `--find`, `--photos` (Wikidata image → Commons thumbnail into the git-ignored `.cache/`, a contact sheet beside the 10 swatches; a generic User-Agent, no personal data; the Wikimedia API answered 429 on the shared IP, so the script reads Wikidata's search page and entity JSON, which answered), `--soccer-feet <players.csv.gz>`.
4. **First-run list, `src/data/appearance/first-run.json` (508 bytes).** Derived by `--first-run` from today's code: the starter pack draws one gold from the squad's position mix (packs.ts `starterCards`), with odds so flat (top card 0.32% NBA) that no fixed "most likely" list exists, so the list is the stars Home and the Hub headline and the starter's featured gold should come from (§4.8): **the newest season's top golds by position** (NBA 3 per position = 15; NFL 2 QB, 2 RB, 2 WR, 1 TE/DE/DT/LB/CB/S = 12; soccer 2 per position = 16). `FIRST_RUN_RULE` in the script.
5. **Seeds: 73 curated rows** (NBA 28, NFL 20, soccer 25): 100% of the first-run list, the 7 owner-named examples (Shaq bald from the Lakers years with an Orlando fade; Iverson cornrows, headband and right-arm sleeve from 2000/2001; Kareem goggles from 1974-75; Rodman platinum 1994-95 and red 1996-98; Haaland long blond, left-footed; Mbappé buzz and clean-shaven; Brady), the mockup archetypes (Curry with his mouthguard, LeBron's headband years, Jokić, Mahomes with curls out of the helmet, Henry, Messi left-footed with eras, Ronaldinho's long hair and headband) and a few more greats (Jordan, Kobe, Bird, Magic, Duncan, Wilt, Dirk, Rice, Montana, Moss, Manning, Deion, Ronaldo, R9, Zidane, Neymar, Pelé, Maradona). **Skin only from a cited photo**: 57 rows carry a tone picked by eye against the swatches from a Commons photo (`skinSrc`); 16 stay neutral (no photo found, a coloured or stage-lit photo, a colourised one). Uncertain fields are left out: four NFL rows (Gibbs, Nacua, Stingley, Henry) carry no confident field yet and stay on defaults; the second review is due in players-9/10.
6. **Soccer feet** from transfermarkt-datasets (CC0): of 9,008 card players, left 2,255, both 273, right 6,266, not recorded 214 (**97.6% recorded**). `soccer.json` is 8.9 KB gzipped (NBA 0.6 KB, NFL 0.3 KB; limit 20 KB).
7. **Readiness.** Per-sport clip bundles `src/data/mocap/clips-{nba,nfl,soccer}.ts` (13/15/13 clips; `BUNDLED`, `clipsFor`, `preloadClips` in `mocap.ts`; the glob keeps only the five clips no sport plays yet as loose files, so a bundled clip is never split into its own chunk). `src/game/pixel/ready.ts`: `pixelReady(sport)` = clips + looks (resolves true/false, never rejects); `preloadPixels(sport)` starts it as `select-<sport>.ts` is evaluated, for this page's sport only (the arcade screen imports every sport's game: the first version loaded the other sport's clips and looks too, 20 clip requests in an NBA match, and was fixed); `drawGate(sport)`, one line at the top of each renderer's `draw()`, holds the first frame until they are in, at most `GATE_MS` = 1.5 s, and never if a load failed (offline). The renderer constructors no longer load clips.

**Numbers** (`players-readiness.mjs`, dev server 5214, DPR 3, 393×852, 3 fresh contexts each, median; before = the base tree `4b13e67` exported to the scratchpad and served the same way, back to back; `O/shots/players/players-3/players-readiness-{before,after}-p3.json`):

| Sport, CPU | PLAY → first frame before → after (ms) | clip requests before → after | default-look / stand-in frames after frame 1 |
|---|---|---|---|
| NBA 1× | 3,232 → 2,960 | 13 → 13 (dev: one per JSON module; production: 1–2 chunks) | all (no data) → **0** / 0 → 0 |
| NBA 4× | 5,780 → 4,813 | 13 → 13 | all → **0** / 0 |
| NFL 1× (7 runs each) | 2,472 → 2,466 | 15 → 15 | all → **0** / 0 |
| NFL 4× | 4,880 → 4,185 | 15 → 15 | all → **0** / 0 |
| Soccer 1× | 3,926 → 2,634 | 13 → 13 | all → **0** / 0 |
| Soccer 4× | 5,496 → 4,820 | 13 → 13 | all → **0** / 0 |

PLAY-to-first-frame is at or under the base everywhere (target ≤ +100 ms; the 3-run NFL 1× median read +127 ms, within run-to-run spread of 2.1–3.7 s, so both trees were re-measured with 7 runs: −6 ms). The looks and clips arrive 0.3–2.2 s before the first frame in every run, so the gate never held a frame in these runs; it is the guarantee for a slow network. 320×568: 0 stand-in frames in all three sports. Screens looked at: `after-p3-readiness-sheet.png` (three sports, 1× and 4×) and `after-p3-320-sheet.png`.

**The owner-named looks (L4, `players-lineup.mjs --tag after-p3`):** 7 of 7 right on the record: Shaq bald, Iverson cornrows + headband, Kareem goggles, Rodman dyed 1994–98, Brady curated and reviewed, Haaland long blond, Mbappé short and clean-shaven. The harness now judges Iverson's and Kareem's looks across their card seasons (like Rodman's), because their best cards (1999, 1972) predate the look, and reads `reviewed` as the reviewer's note. The drawn sprites still show today's hashed looks until players-4 wires `matchLook`.

**Tests added:** `appearance.test.ts` (18/15/8 and the hexes; the whitelist; neutral skin for 600 uncurated pids; a 30-pid defaults snapshot; diversity over 2,000 pids in each of 18 era buckets; 18 gear priors within ±3 points; LOD; the code round trip; every id form; Rodman per cell; the legacy look and the cosmetic hook; helmet hair), `appearance-data.test.ts` (in step with `--build`; ≤20 KB gzip; `src`/`reviewed`/`skinSrc`; every pid a card player with a matching name and eras inside his seasons; 100% of first-run curated; the seeds and owner looks), `appearance-soccer.test.ts` (BMI by position; Messi's match weight = card weight; feet decoding and ≥85% recorded; keeper gloves), `build-of.test.ts` (Shaq, Bol and Bogues from their draft cells' attrs), `readiness.test.ts` (`pixelReady` per sport; each bundle covers every clip its `select-*.ts` can play; bundle files = `BUNDLED`; loose clips = the rest; `drawGate`; **no main-bundle file imports `appearance`, `looks`, `ready`, `data/appearance` (except `first-run.json`) or a clip bundle**). **Changed:** `select-family.test.ts`'s stand-in case assumed the clips were never loaded, which `select-nba.ts` now starts at evaluation; it now holds the load back on a fresh module copy to check the stand-ins, then checks the recorded stride once they're in.

**Verification:** `bash O/heavy.sh npm run typecheck` pass; `npx vitest run src/game/pixel scripts/qa/players-lib.test.ts src/engine/sport-branches.test.ts` 139 tests pass (4 skipped by sport); `PS_SPORT=nfl npx vitest run src/game/pixel` 130 pass; `PS_SPORT=soccer npx vitest run soccer sport-branches` 82 pass; `npx vite-node scripts/build_appearance.ts --check` in sync.

#### players-3 review fixes (on HEAD `fc687b1`)

An independent review of `4b13e67..f5d87be` found two medium and three low issues. All five are fixed. **Protocol bump needed: none.** No simulation step, input rule or result changed. The hold only delays when the first fixed step runs (the same steps run with the same inputs), and the rest is render or static data.

1. **Medium: blank frames during live play.** While `drawGate` held, `draw()` returned before drawing anything, but the screens kept stepping the game. The reviewer saw a dark canvas under a live HUD for up to 1.5 s, with the NBA shot clock running 14 to 12. **Fix:** the gate now holds game time, not the frame.
   - `ready.ts` exports `holdPlay(sport, now)`. Each sport screen's loop (Hoops2, Football2, Soccer2) has one announced line, `if (holdPlay('<sport>', now)) acc = 0;` (soccer: `const held = holdPlay(...)` plus `if (held) acc = 0;`). So no fixed step runs while the first load of clips and looks is on its way. That is at most `GATE_MS` = 1.5 s, and never after a load has failed.
   - The renderers no longer return early. `draw()` begins with `wantPixels('<sport>')` and always draws the venue and the players as they are.
   - Measured with `scratchpad/p3fix/slow.mjs`: dev server 5214, 393×852, clip bundles and looks held back 2.5 s. Every sport draws from its first frame (mean canvas lightness 79–101, against 0 for the reviewer's blank frames). Soccer's attack clock stayed at 0:30 for 1.7 s while the gate held, then ran (0:29, 0:28 …). NBA and NFL showed the court or field at once. Sheet: `O/shots/players/players-3/after-p3fix-slow-sheet.png`.
   - Tests in `readiness.test.ts`:
     - the hold opens at `GATE_MS` and once the load arrives;
     - a loop driven by `holdPlay` adds no game time while held, then runs;
     - every renderer draws with no early return, and every screen zeroes `acc` while held.
2. **Medium: "100% of first-run curated" held in letter only.** Several first-run rows and Henry still drew pure seeded defaults while counting as Tier A. **Fix, data:** every first-run row now carries the Tier A minimum (hair, hair colour, facial hair) from a cited photo, with one honest exception. New skin tones came only from photos seen in this pass.
   - NBA: SGA and Booker clean-shaven; Edwards short hair; Barnes curly top and moustache.
   - NFL:
     - Gibbs: box braids out of the helmet, clean-shaven, skin 5 (Commons `JahmyrGibbs (cropped).jpg`; Wikidata has no image).
     - Nacua: swept-back hair with curls out of the helmet, stubble, skin 5 (`Puka Nacua FanDuel Interview (cropped).png`; the Wikidata photo is helmeted).
     - Smith-Njigba: curly top, goatee, skin 6.
     - Derwin James: cornrows and a moustache.
     - Allen and Roquan Smith: clean-shaven.
     - Henry: skin 8 and a full beard from `Derrick Henry 2019 12-08.jpg`, next to players-4's locs.
     - Explicit `helmetHair` on the NFL first-run rows.
   - Soccer:
     - Gabriel: found by his full name, since the card's single name defeated the Wikidata search. Short black hair, goatee, skin 7 (`1 Gabriel Magalhães 2026 (cropped).jpg`).
     - O'Reilly: brown.
     - Olmo: his natural dark brown. The cited photo's bleached summer-2024 look is not drawn because its seasons are uncertain.
   - **How the new skin tones were picked:** the swatch nearest the mean colour of a clean cheek patch in the cited photo, checked by eye. A first by-eye pass had JSN 4, Gibbs 6, Nacua 4 and Henry 7. The measurement moved each of them by one or two steps.
     - Henry's two photos measure 7 and 8, and their average is nearest 8.
     - Gabriel's slightly grey photo is a near tie, 7 just ahead of 6.
     - Nacua's photo is under warm studio light. 5 is nearest, by a wide margin.
     - Henry at 7 had matched Ray Lewis (7) and failed `likeness.test.ts` (NFL Henry/Ray Lewis 5.2% at 34 art px, floor 12%). The measured value separates them, but the tone was set by the measurement, not to pass the test.
   - **The exception is Derek Stingley.** Every public photo found shows him helmeted: Wikidata's, and the four files a Commons search for "Derek Stingley Jr" returns (all from LSU games). His hair and facial hair stay unknown and are not guessed.
   - **Fix, code:**
     - A row with an empty look now reports `src: 'default'` (`appearanceFor`), not `curated`, so Stingley counts as a shortfall.
     - `appearance-data.test.ts` requires the minimum for every first-run row. The rows short of it must equal a named `SHORTFALL` list (NFL: Stingley), at most 1 in 12 per sport.
     - The mockup archetypes (Curry, LeBron, Jokić, Mahomes, Henry, Messi, Ronaldinho) must have hair and hair colour, and facial hair except Ronaldinho's.
   - Tier A today: NBA 15/15, NFL 11/12, soccer 16/16.
3. **Low: draft cells without `ctx` covered the whole decade.** No era could ever apply, and the players-4 wiring (`select-*.ts lookFor`) calls `refOf` without `ctx`. So `CHI-1980:jordami01` drew bald, `ORL-1990:onealsh01` bald, and `PHI-1990:iversal01` drew cornrows and a headband. **Fix:**
   - The build writes `cells` into each sport's data file: every curated player with eras, and his own `[from, to]` in each draft cell he plays in (NBA 45 cells, NFL 7, soccer 4; read from the draft datasets' columns, `DRAFT_COLS` in `build_appearance.ts`).
   - `refOf` takes the span from `ctx`, else from `cells`, else claims no span and uses the decade's middle season.
   - Tests: Jordan short-haired in CHI-1980 and bald in CHI-1990; Shaq's Orlando fade and bald Lakers; Iverson short-haired with no headband or sleeve in PHI-1990 and cornrows in PHI-2000; Rodman from the id alone.
4. **Low: one failed fetch left stand-ins for the whole session.** **Fix:** `ready.ts` tracks success (`ok`) apart from "settled". A failed load is forgotten. `wantPixels`, called on every renderer frame, tries again at most every `RETRY_MS` = 5 s until both are in, and costs nothing after that. Test: fail, no retry inside 5 s, retry at 5 s, then ready.
5. **Low: "≤2 requests" was never measured.** A small isolated Vite build of the clip bundles and looks (`scratchpad/p3fix/chunk/build.mjs`, same Rollup, no app build) confirmed the reviewer: NBA needed 2 clip requests, NFL and soccer 3. Rollup split the shared JSONs into a chunk for all sports (`sprint-*.js`) and an NFL-and-soccer chunk (`kick-*.js`). **Fix:**
   - `src/data/mocap/clips-shared.ts` holds the 12 clips two or more sports play. Each sport bundle imports it plus only its own clips. Re-measured: **2 clip requests per sport** (`clips-<sport>-*.js` + `clips-shared-*.js`). NBA pays for 4 clips it doesn't play (catch, dive, fall_forward, kick; about 15 KB raw).
   - The looks now load through `src/data/appearance/looks-<sport>.ts`, so the production chunk is `looks-<sport>-*.js`. Before, it was a bare `<sport>-*.js`, the same name the draft dataset's chunk gets.
   - `players-readiness.mjs` matches `clips-shared` and `looks-<sport>` (production) in its `CLIP` and `LOOKS` patterns.
   - Test: `clips-shared` holds exactly the clips in more than one `BUNDLED` list, and no sport bundle imports a shared clip's JSON itself.
   - Section 5 request 3, shell's on-demand pattern, is updated for the soccer looks wrapper.

**Verification (review fixes):**
- `bash O/heavy.sh npm run typecheck`: pass.
- `npx vitest run src/game/pixel scripts/qa/players-lib.test.ts src/engine/sport-branches.test.ts src/game/hoops2`: 226 pass (11 skipped by sport).
- `PS_SPORT=nfl npx vitest run src/game/pixel src/game/football2`: 250 pass, including `likeness.test.ts` NFL (min pair at 34 art px ≥ 12%).
- `PS_SPORT=soccer npx vitest run soccer sport-branches`: 83 pass.
- `npx vite-node scripts/build_appearance.ts --check`: in sync.
- Browser (`scratchpad/p3fix/slow.mjs`, isolated: `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted, `routeLog.external` 0, no page errors): see item 1.
- Chunk count: see item 5.

---

### players-4 · Looks drawn in all three engines, C.1.6 kits, calmer C.2 venues (done)

Base `4dc58d0` (the last commit before this task: the players-2 review-fix doc). The machine restarted during an earlier attempt at this task; its uncommitted work in this worktree was reviewed, kept and finished here. Render-only: **Protocol bump needed: none.** No storage key, save field, card/edition/copy id or engine number changed. The simulation imports none of this code (`render-only.test.ts` import graph), and a seeded game in each sport hashes the same engine state after every step with and without the whole drawing pipeline, which now includes `matchLook` with the appearance data loaded and the crowd hook.

**What changed**

1. **`src/game/pixel/head.ts` (new): the head.** The skull, the face and every head trait, painted into the body's pixel grid with the same depth test.
   - **18 hair recipes** (V2 C.1.4): bald, buzz, short, fade, high top (a flat block on the crown), afro and big afro (rings round the skull), cornrows (alternating rows), short and long locs and braids (hanging strands), ponytail and bun (knots), mohawk (a ridge with faded sides), curly top (a bumpy crop), long flow, receding, headband-bound.
   - **Each style changes the head's outline by at least one art pixel on two sides** against bald (C.5 rule 2), at 24, 34 and 60 art px, in three facings. On a big head (a radius of 4.5 art px or more) a crop stands a pixel higher over the crown than at the sides, so the box with hair keeps V2's 12×13 shape.
   - **LOD:** below 24 art px the 18 collapse to four silhouettes (none, cap, tall, long). Facial hair goes below 20, except a full beard.
   - **Faces:** 8 facial masks (goatee, full, long, moustache, stubble, chinstrap, short, none). Eyes and brows come in two sizes (small and big heads).
   - **Gear:** headband, wrap and skullcap in the record's colour; goggles (lens and frame); a mouthguard from 24 art px.
   - **NFL helmet:**
     - a shell in the helmet colour with the centre stripe and blank sides (no logos);
     - the facemask, and a clear, dark or tinted visor;
     - the face showing through a clear visor;
     - locs, a flow or curls out of the back of the helmet, readable at 23 art px.
     The helmet now always covers the shoulder pads, the way the head covers the torso; before, the pads swallowed the helmet in low views.
   - `sec` (hair lag) is in the signature for players-7's secondary motion.
2. **`body.ts`: gear and numbers.**
   - **Gear:**
     - arm gear from the record: full sleeve, shooting sleeve, elbow sleeve, long sleeves, and wristbands and tape from 34 art px;
     - leg gear: knee pad, knee sleeve, brace, tights, calf sleeve;
     - sock height (low, crew, high, over the knee) per sport;
     - an NFL towel from 24 art px.
   - **Colours:** gear colours resolve against the kit (`looks.ts`). Close-cropped dyed hair keeps its colour (Rodman's red shows through the skin far less than natural hair does).
   - The palette slots moved to `slots.ts`, so `head.ts` and `body.ts` paint the same materials.
   - **Numbers (L-5):** a 3×5 font below 34 art px, 4×7 from 34 to 59 and 6×10 from 60.
     - The glyphs are exact or the number is hidden, never scrambled.
     - A turned chest closes the gap between digits, never a glyph's columns.
     - The number is hidden when `squeeze < 0.6`, or where it doesn't fit whole on the jersey (an arm across it). The back number is kept.
     - The trim border goes on only where the chest has room: the shirt must still show twice as much shirt as number. Otherwise a 4×7 number on a 34 px chest took every mid-tone pixel off the jersey (C.7 #8).
   - **Kit trim:** a collar in the trim colour, so the kit reads as base + trim + number.
3. **Wiring.**
   - **Match:** `select-{nba,nfl,soccer}.ts` `lookFor` is now `matchLook(sport, refOf(sport, id), kit, {...})`:
     - NFL: pads by position;
     - soccer: `buildOf`'s weight by position, and the keeper's kit and gloves.
     The renderers no longer call `hairFor`/`beardFor`; the galleries still use them.
   - **Late data:** a look made before the sport's appearance data arrived (the first-frame gate gave up on a slow network) is marked `withData: false`. The renderer rebuilds it once the data is in (`staleLook`) and lets its drawings go through the sprite budget.
   - **Cards:** `ut/CardArt.tsx` `lookOf` is now `looks.ts` `cardLook(line)`, so today's card figures show the real looks before players-8.
     - The UT chunk starts loading this page's sport's looks.
     - A portrait drawn before they are in is not cached, and `usePortrait` redraws it once they arrive.
4. **Kits, `src/game/uniforms.ts` (V2 C.1.6).**
   - **Clash rule:** two kits clash when their primaries are within **CIEDE2000 ΔE 25**. `deltaE2000` is in `color.ts` and checked against Sharma, Wu and Dalal's published test pairs.
   - **Away swap:** a clash always sends the rival to his away set; if that also clashes, to a change kit in his second colour, white or charcoal (`clearOf`, `CHANGE_COLORS`).
   - **Soccer:** `soccer2/kits.ts` uses the same rule, a 2-line hunk (section 7).
   - **Ramps:** the 3-tone ramps come from the body raster.
   - **Ring colours:** no kit primary of any NBA, NFL or soccer team is one of the four ground-ring colours.
5. **Calmer venues (`venue.ts`, `crowd.ts`; colour only, through the V2 grant).**
   - **Tokens:**
     - NBA planks `#c98f52`/`#bf8548` every 6 texels, lines `#f4ead8`;
     - NFL mow stripes `#2f8f46`/`#2a8240` every 5 yards, lines `#eaf5ea`, yard numbers at 60% ink;
     - soccer mow stripes `#2e9a4a`/`#288a41` every 5.5 m, lines `#f2fff2` at 85%.
   - **Team colour:** team paint (the key, the centre circle, the end zones) at 85% saturation; the apron and boards in the team's dark.
   - **Light, baked into each texture once:** four soft light pools, a +8% pool under the rim, and the far end 6% darker.
   - **Vignette:** one cached canvas darkens the screen's corners by 18%. It is drawn over the venue and under the players, one blit a frame.
   - **The crowd** (`crowdPalette`, `crowdAt`): three dark value bands (`#4a426e`, `#342d52`, `#221d36`, nearest the lightest, each leaning 10% toward the home colour), flecked with the home colour (5%, at most 6%) and white (1.5%, at most 2%) in 2×2 blocks.
     - It is the same in the far stands (`persp.ts` `standsWall`), the courtside and touchline seats (`persp.ts`, `pitch.ts`) and the side-on stands (`court.ts`, `field.ts`).
     - Line, stand, horizon and camera positions are untouched.
   - `crowd.excite(kind, t)` is a safe no-op for the sport teams to wire now; players-9 animates it.
6. **The looks gallery, `?pixel=looks`** (`LooksGallery.tsx`).
   - **How it loads:** its own lazy chunk inside the pixel gallery's, unlinked, storage-free (0 items in local and session storage after a visit).
   - **What it shows:**
     - the owner's seven examples in the seasons that show their looks, at 60/34/24 art px, with the record each one drew;
     - all 18 hair styles × 16/20/24/34/60 art px × 4 facings, plus a light kit;
     - facial hair, head gear, goggles, the mouthguard, arm and leg gear and socks;
     - the football helmet, visors, hair out of the helmet and the towel;
     - 10 skin tones × 8 kits;
     - each sport's 12 lineup stars in their own colours and in one shared kit at 60/34/24;
     - the venue tokens, crowd strips, the three textures and the vignette.
   - **QA:** `scripts/qa/players-looks.mjs` saves it at 393×852 (insets 59/34) and 320×568 and reads every sheet straight off its canvas.
7. **Data.**
   - **Lineup stars:** five NFL lineup stars gained a skin tone picked from a cited Commons photo (Ray Lewis, Aaron Donald, Barry Sanders, Tyreek Hill, Justin Tucker).
   - **Henry:** Derrick Henry's long locs, out of the back of the helmet.
   - **Brady:** curated with no visor. The seeded default (25% of skill players from 2005) had given him a clear one, and he never wore one.
   - The rebuilt data is `nfl.json`, 790 bytes.

**Before → after**

**Identity.** `likeness.test.ts` and `players-lineup.mjs --tag after-p4` measure the 12 lineup stars in one shared kit, all drawn at the same height.

| Measure | NBA | NFL | Soccer |
|---|---|---|---|
| Pairs ≥8% different at 24 art px | 94% → **100%** (target ≥80%) | 95% → **100%** (≥75%) | 86% → **100%** (≥75%) |
| Smallest pair at 34 art px | 6.9% → **16.5%** (≥12%) | 4.4% → **15.0%** | 1.7% → **12.8%** |
| Smallest pair at 60 art px | 2.4% → **19.2%** (100% ≥8%) | 5.6% → **17.2%** | 2.4% → **11.5%** |
| Distinct skin tones / hair colours among the stars | 1/1 → 5/3 | 1/1 → 6/4 | 1/1 → 6/5 |
| Closest pairs | LeBron/Giannis | Rice/Moss | Pelé/Maradona |

**Build at 34 art px, real height and weight through `cardLook`.**

| Method | Shaq | Bol | Difference | Other pairs |
|---|---|---|---|---|
| Torso, arms raised (`body-build.test.ts`) | 13 | 9 | **4** (≥3) | Haaland 11 vs Messi 8 (≥2) |
| Audit chest band (harness) | 20 | 17 | **3** | was 18 vs 17 at the base |

**Numbers** (`numbers.test.ts`): 23, 80, 88, 99, 7 and 12 are exact in the 3×5 font at 28 px front-on in all three sports. At 34, 56 and 80 art px and facings 0.6–0.9 they are exact or hidden, never scrambled, and shown in more than half the cases. The 4×7 font from 34 and the 6×10 from 60.

**Venue (`players-screen.mjs --secs 12 --tag after-p4`, 393; soccer at 320, because its 393 run caught 0 venue frames).**

| Row | NBA | NFL | Soccer | Target |
|---|---|---|---|---|
| Surface grain | 14.2% → **2.4%** | 3.0% → **0.9%** | 2.6% → **0.9%** | ≤4% |
| Venue mean L* vs sprites' (negative = venue lighter) | −24.6% → −2.6% | −29.7% → −15.4% | −47.7% → −40.0% | ≥30% darker: **not met** (below) |
| Crowd: pixels equal to their right neighbour (2 px blocks) | 0.83 → 0.93 | 0.70 → 0.92 | 0.83 → 0.91 | 2 px blocks |
| Crowd: top-3 colours' share in the detected stands band | 0.22 → 0.36 | 0.12 → 0.32 | 0.19 → 0.33 | three bands plus flecks (below) |
| Stands vs sprites, neighbour contrast | 1.30 vs 14.0 | 1.33 vs 19.5 | 1.16 vs 17.3 | softer than the play |
| Corner tiles vs centre (L*) | −26% → −41% | −43% → −52% | −42% → −49% | vignette layer −18% (below) |

- **Grain, the crowd's palette, 2 px blocks and the vignette layer are met exactly** in `venue.test.ts`, which reads the textures and the vignette canvas:
  - every crowd pixel of the far stands is one of the three bands, the home fleck or the white fleck;
  - home 2–6%, white ≤2%, every fleck a whole 2×2 block;
  - the courtside and touchline fans are drawn in the same palette;
  - the vignette gradient ends at exactly 18%.
- **Why the screen numbers read differently:**
  - The screen harness's "stands band" also takes in the LED ribbon, facades, roof lamps and boards (the sport teams' geometry), and the perspective resampling of the stands. That is why its top-3 share is 0.32–0.36, and not ≥0.9.
  - Its "corner vs centre" measures the whole frame (dark stands and HUD in the top corners), not the vignette layer.
- **Venue ≥30% darker than the players is not met, and conflicts with the spec's own tokens.**
  - NBA planks at `#c98f52` (L* ≈ 64) can't sit 30% under sprites whose mean L* is 42. The NFL and soccer grass tokens are mid-greens.
  - V2's 13:09 revision dropped this row: it is reported, not gated; the plan's §3.2 ledger records this. Players pop through the outline, rim and contrast instead: stands neighbour contrast 1.2–1.3 against the sprites' 14–19.
  - If the lead still wants it, the lever is the tokens themselves. That is a lead call, recorded in section 5.

**Engine render** (393, dev server, the machine shared with six teams).

| Measure | NBA | NFL | Soccer | Notes |
|---|---|---|---|---|
| Stale body draws (`players-sprites.mjs`), players-2 → now | 2.9% → 2.9% | 40.6% → 40.5% | 1.4% → 2.1% | NFL 48–71 px 80.9% (A-1 is players-5) |
| fps 1×/4× at DPR 3, paired with the players-2/3 tree `4dc58d0` on the same port (`players-matchperf.mjs --vp 393 --cpu 1,4 --dpr 3 --window 10`, `O/shots/players/players-4/perf-paired/`) | base 59.9/50.7, 60.0/43.7, 58.4/44.6 → players-4 59.8/41.1, 59.7/46.0 (4× draw p50 11.2–11.4 → 11.7–12.7 ms) | base 60.0/56.7, 59.8/56.6, 59.1/50.7 → 59.5/53.7, 59.9/53.5 | base 60.0/58.6, 60.0/58.5, 58.8/54.8 → 59.9/53.5, 59.9/56.8 | runs alternate base, base, players-4, base, players-4 |

- **1×** holds 59.5–60.0 in every sport.
- **4× sits inside the base tree's own run-to-run spread** in NBA (43.7–50.7 base, 41.1–46.0 here) and soccer. NFL runs 1–3 fps under the base's two best runs.
- **Raster cost.** A sprite build costs more: hair shells, gear, and the number's font search. On the node bench (`vite-node`, 540 rasters), the cost per raster went:
  - from 0.37 to 0.40 ms at 34 art px;
  - from 0.47 to 0.51 ms at 64;
  - from 0.63 to 0.86 ms at 90.

  That is after cutting the collar scan to the rows round the shoulder line, and removing the per-pixel allocations in it and in the number border, which first measured 0.48 / 0.86 / 1.48 ms. The browser NBA 4× draw p50 is about 0.5–1 ms higher.
- **Followup:** players-5's near-first sprite budget re-checks this.
- **Stale draws:** soccer's 2.1% sits within players-1's spread (1.7–1.9% over 18 s windows).
- **The first paired attempt was invalid:** a stale server kept the port, and its "players-4" rows were the base tree. It is kept under `perf-paired/bad/` and not used.

The keep-list (`players-keep.mjs --tag after-p4`) passes all 13 items, with 0 page errors.

**The owner's seven examples, checked by eye in the gallery** (`O/shots/players/players-4/after-p4-gallery-01-the-owner-s-seven-examples.png`):

| Player and season | What the gallery shows |
|---|---|
| Shaq, 2000 | bald with a goatee, the heaviest build |
| Iverson, 2001 | cornrows, a white headband, a right-arm shooting sleeve |
| Kareem, 1985 | goggles over a receding hairline |
| Rodman, 1997 | a red buzz |
| Haaland, 2023 | long blond hair, falling to the shoulders from behind |
| Mbappé, 2023 | a black buzz, clean-shaven |
| Brady, 2007 | the helmet with its stripe and facemask, no visor, light-brown hair in the record |

The harness's L4 reads 7 of 7 correct on the records.

**Tests added:**
- `head.test.ts`: each of the 18 silhouettes changes the outline on ≥2 sides at 24/34/60 in 3 facings; the collapse to 4 below 24 art px; facial hair from 20 (full below); NFL hair out of the helmet at 23 art px; the stripe and the three visor tints.
- `numbers.test.ts` (above).
- `likeness.test.ts` with `likeness.helpers.ts`: the identity row in each sport under its own `PS_SPORT`.
- `body-build.test.ts`: Shaq − Bol ≥3; Haaland − Messi ≥2.
- `kits.test.ts`: CIEDE2000 against the published pairs; every NBA, NFL and soccer pair within ΔE 25 swaps to a kit that doesn't clash; the soccer keepers read against both outfield sets; 0 primaries on the ring colours.
- `venue.test.ts`: grain on all three textures, the crowd palette and 2 px blocks, the band order, courtside and touchline fans, team paint at 85%, depth −6% and pools, the vignette at 18%.

**Tests changed, and why:**
- `select-golden*.test.ts`: `lookFor` changes the look half of every sample on purpose. Run with the three `lookFor`s as they stood before (`LEGACY_LOOK` in the helper), the modules still hash to players-2's digests (NBA `556ad50a`, NFL `ed52d518`, soccer `326e398f`). That proves clip, pose and gait selection are untouched. The new digests are pinned beside them, with the data loaded.
- `raster.test.ts`: the head, gear, collar and numbers redraw the pinned sprites; the hash is re-pinned to `88fb19d9`.
- `proportions.test.ts`: on a big head, buzz and the high top now show a pixel of hair past the skull's sides, so the "no hair at the sides" width check accepts V2's box as well as the box less the hair.
- `render-only.helpers.ts`: the drawn run loads the appearance data and calls `crowd.excite`.

**Verification:**
- **Typecheck:** `bash O/heavy.sh npm run typecheck` passes.
- **Tests:**
  - NBA (default sport): `npx vitest run src/game/pixel src/game/kits.test.ts src/game/uniforms.test.ts scripts/qa/players-lib.test.ts src/engine/sport-branches.test.ts`: 202 pass, 9 skipped by sport.
  - NFL: `PS_SPORT=nfl npx vitest run src/game/pixel src/game/kits.test.ts`: 184 pass, 10 skipped.
  - Soccer: `PS_SPORT=soccer npx vitest run soccer sport-branches src/game/pixel src/game/kits.test.ts`: 259 pass, 9 skipped.
- **Browser runs:** dev server 5214, Playwright with touch, isolated: 0 external requests in every report. Each was run as `node scripts/qa/<script> --out O/shots/players/players-4`:
  - `players-looks.mjs`: 10 sections at 393×852 (insets 59/34) and at 320×568; no horizontal scroll, 0 page errors, 0 storage items.
  - `players-screen.mjs --secs 12`;
  - `players-sprites.mjs`;
  - `players-lineup.mjs`;
  - `players-keep.mjs`: 13 of 13 PASS;
  - `players-matchperf.mjs`, paired (above).
- **Looked at:**
  - the 10 gallery sheets;
  - `after-p4-lineup-{nba,nfl,soccer}.png`;
  - `after-p4-screen-{sport}-{393,320}-*.png` beside players-1's `before-screen-*`;
  - `after-p4-perf-match-*.png`.

---

### players-5 · Near-first sprite budget (A-1), locomotion without skating (A-5), HUD and rematch anchors (done; NBA 4× within the paired base's spread, see "Left undone")

Base `c66413e` (the players-4 doc commit). The machine restarted during an earlier attempt at this task; its uncommitted work (sprite-budget.ts, locomotion.ts, anchors.ts, the walk clip, the three renderers' sprite sections, the tests and the classifier rewrite) was reviewed, measured, fixed and finished here. Render-only: **Protocol bump needed: none.** No storage key, save field, card/edition/copy id or engine number changed; the simulation imports none of this code, and `render-only.test.ts` now runs the budget, locomotion and every touch in its per-step engine hash (unchanged).

**What changed**
- **`src/game/pixel/sprite-budget.ts` (new).** Each renderer plans every body's sprite first (`SpritePlan`: key, how to draw it, the next stride frame), resolves them in budget order (`resolveSprites`) into a map, then draws in its existing depth order.
  - **Must set, always fresh:** the handler/carrier (NFL: the QB until the throw), the pass target, his nearest defender, the NBA rebounder in a race, the body the player controls in any phase (`renderer.controlled`, set by the screen when it isn't the ball body: the default solo defense), and any body `pin()`ned. Then `px + 24 × frames stale`; a body of 32 art px or more stale 2 frames is forced.
  - **Count:** an EWMA (0.15) of per-draw cost from each frame's total time over its draws (robust to iOS's 1 ms timer clamp), `clamp(floor(budgetMs / cost), 3, 14)`, `budgetMs` 5 (3 after a frame over 20 ms).
  - **Starts** (snap, kickoff, inbound, replay jump, rematch / `resetMotion`): the first frame may draw 14, the next 30 spend 10 ms, and up to 2 leftover draws a frame pre-draw the next stride frames of the 6 nearest bodies. A new state object counts as a start only if its clock starts (<0.25 s) or jumps, so replays, which hand over a new snapshot each frame, don't (an earlier cut warmed every replay frame).
  - **`tight`** (the 5 ms buys fewer than 3 drawings, or a slow frame outside a start): no start budget, the must set at 15 fps and inside the count, big bodies forced after 4 stale frames, and fewer variants per frame (no side lean, head lead or plant dip; forward lean in 0.1 rad steps).
  - **Area:** every match `SpriteCache` shares `MATCH_AREA`, a 6 Mpx art-px account (module-level, so it outlives a rematch); over the cap the oldest drawings not on screen go first. `Steady` holds a body's size and pitch through the camera's small moves (6% / 0.1).
- **`src/game/pixel/locomotion.ts` (new), used by `select-{nba,nfl,soccer}.ts` `motionOf`.**
  - `pickGait`: the nearest recorded stride at 0.8–1.25×, shorter steps (10% steps, floor 25%, the slide 15%) below the slowest; a stride already showing stays while within 8%. Forward walk/jog/run/sprint (+ the NFL block step for blockers), back the backpedal then walk/jog played backward, sideways the shuffle. `openHips` turns a defender to run when he moves back or sideways faster than any stride that way.
  - **Walk clip:** CMU 035_01, 1.14 s, footfalls from `build_mocap.py` (new `step_lift`/`step_dwell` for a walk's low swing), in all three bundles.
  - **Dead bands gone:** NBA `run` under 2.5 ft/s showing `ready`, the static `defend` pose at 1–3 ft/s, soccer `ready` while drifting 0.15–1 m/s, the backpedal rate caps; NFL `stance`/`run`/`backpedal` showing the stance or `ready` under 0.6–1 yd/s.
  - **Planted foot (R4):** in a contact beat (first 40% of each step after `stepL`/`stepR`) the drawn body moves with the feet; between contacts it leads back through a damper of at most half the stride's own travel a frame; airborne it decays; capped at 5% of his height. The NBA ground mark, dribble floor and hand anchor, the soccer ball at his feet, and the NFL ball arm take the same offset.
  - **Rates:** step 1 (30 fps) for the must set, step 2 (15 fps) for everyone else including far NFL/soccer bodies (they were step ≥3); a must-set stride under rate 1 at half frames, rasterised fresh from the joints between two recorded frames (never two drawings blended).
  - **Turns (R5):** 90° per 100 ms; under 45° glide, 45–120° plant (a 1 art px dip for 0.1 s), over 120° two-thirds-speed steps then the plant; the head leads by one frame; spins, falls, dives and the 360 dunk are exempt.
  - **Facing:** NBA the engine's facing; NFL the QB faces downfield from the snap (a 6-frame catch of the snap, then a rate-matched back stride while he drops: never the idle clip while he moves), backpedalling defenders watch the QB until they open their hips, any defender retreating from the ball faces it; soccer defenders getting back (<4.5 m/s) face the ball.
  - **Lean (R6):** up to 12° forward into a burst (with the sprint lean, capped at 12° total), 8° into turns, a 6° brake lean-back for 5 frames; head bob −1, −1, +2 art px per stride at 34 art px.
  - **Game-time clock:** every memo runs on `t`; Δt < 0, Δt > 0.25 s or `resetMotion()` restarts the turn, the planted foot, the lean and the stride; a frozen clock (pause, hit-stop) holds the frame.
- **HUD anchors** (§4.3), on each renderer, keyed by body index (NBA) or body id (NFL, soccer): `drawnOffset`, `headTop`, `feetAt`, `groundEllipse`, `handAnchor`, `pin`, `resetMotion`, plus the `controlled` field (`src/game/pixel/anchors.ts`).

**Before → after** (393×852, dev server 5214, `players-sprites.mjs`, 18 s autoplay; before = players-1's baseline on the base tree; after = `--tag final-p5`, `O/shots/players/players-5/`):

| Row | Target | Before | After |
|---|---|---|---|
| NFL stale | ≥48 px <2%, 32–47 <5%, overall <10% | 82.5% / 57.5% / 41.4% | **0% / 0.1% / 0.7%** (320: 0 / 0 / 0.7%) |
| NBA stale | ≥48 px <2%, first 10 frames <5% | 5% (72+ 9.9%) / 26.8% | **0.4% / 0%** (320: 0.1% / 0%; ≥48 px 0.3–1.2% and first 10 frames 0–1.8% across the 393 and 320 runs after the last `tight` fix; one 393 run of an earlier `tight` threshold read 10.8%, and one 320 run made while the vitest suites ran (56.8 fps) read 11.5%) |
| Soccer stale | ≤1% | 1.9% | **0–0.4%** |
| Pre-warm, ≥32 px, first 30 frames | ≤1% | NBA 17.7%, NFL 3%, soccer 0% | **NBA 0%, NFL 0%, soccer 0%**; after 3 `resetMotion()` rematches (`players-rematch.mjs`): NBA 1.0%, NFL 0.7%, soccer 0% |
| Must-set rate (handler/carrier, defender, target) in a stride or stance | ≥28 fps | NBA ball body –, NFL 2.8, soccer 12.3 | pooled **NBA 38.1, NFL 42.2, soccer 38.1**; median body 34.1 / 38.7 / 39.6; lowest body 30.1 / 38.3 / 21.9 |
| Every other body | ≥12 fps, none <10 | NBA min 5.7, NFL 0.7, soccer 10.9 | **min 14.2 / 17.3 / 18.1**, 0 under 12 |
| Foot sliding (`players-slide-*.ts`, `motionOf`) | NBA ≤8%, soccer ≤4%, NFL ≤5% + 0 idle QB frames | 29.1%, 13.7%, 40.4% + 20,418 | **3.9%** (3 games), **2.6%** (120 attacks), **3.8%** + **0** (24 games, 408 dropbacks, 0 yd skated) |
| Planted-foot drift in a contact beat (art px at 34) | ≤1 | — | p99 0.56 / 0.13 / 0; max 1.36 / 1.93 / 1.03 (NBA/NFL/soccer) |
| Sprite area | ≤6 Mpx, across rematches | peak 6.61 (NBA 430) | NBA 6.00 (the cap) at 393/430, NFL 2.4–2.6, soccer 3.7; 3 rematches: peak 6.0 / 2.51 / 3.69, never over; NFL 22 bodies at 4× for 60 s: peak 1.94 |
| Heap over 40 s and 3 rematches | within +10% | — | **+5.7% / +3.2% / +4.7%** |

**Frame rate** (`players-matchperf.mjs`, DPR 3, 10 s windows, `O/shots/players/players-5/perf/`). 1× at the five viewports, `--tag after2-p5`: 59.7–60.0 in every run (NFL 393 58.1 in one earlier run while other teams' builds ran). 4×, **paired** with the base tree (`c66413e` exported to the scratchpad, served on the same port, alternated twice per round, `pair.sh`):

| 4× fps | NBA 393 | NBA 430 | NBA 375 | NFL (five vps) | Soccer (five vps) |
|---|---|---|---|---|---|
| base | 53.4, 53.5, 52.5, 49.0, 49.3 | 50.8, 51.0, 46.7, 49.2, 47.3 | 53.2, 53.2, 53.4, 50.2, 52.2 | 53.6–57.8 | 56.8–59.2 |
| first cut | 49.6, 48.9 | 47.3, 47.4 | 53.3, 49.7 | 51.9–57.0 | 55.4–57.8 |
| with `tight` (final) | 48.5, 48.7, 48.9, 47.4 | 47.8, 47.0, 48.4, 44.8 | 54.0, 54.4, 50.4, 51.5 | 51.7–56.1 | 56.4–58.6 |

The base's own spread at NBA 393 is 4.5 fps. Taking the rounds where both trees ran back to back on a quiet machine, NBA is 0.6–2.5 fps under the base at 393/430 and 2 over at 375; NFL and soccer within 0.5–3. The first cut was 4–8 fps under at NBA 375/393 (its 14-draw start frames and 30 fps must set at 4× CPU), which `tight` fixed. The remaining NBA cost is the freshness itself: the base left 4.4% of NBA draws stale; now 0.3–0.7%.

**Why the plan's numbers moved (recorded deviations):** the budget is 5 ms, not 3 (with 3 ms NBA ≥48 px stayed at 5.3% stale: 10 large bodies, each a new drawing every few frames as the camera drifts); the start window spends 10 ms for 30 frames instead of only 2 leftover draws (measured: after an NBA replay the zoom eases from 1.35 to 1 and every body changes size each frame, so leftover-only pre-warm left 26.8% stale); "every sprite ≥34 art px at 30 fps" was dropped (it doubled an NBA frame's new drawings past the budget and froze the near players it was meant to help).

**Tests added:** `sprite-budget.test.ts` (7: the must set and pins always fresh and no ≥32 px body stale over 2 frames under a 4-draw budget across 400 frames of 22 bodies; near-first order; the EWMA within ±20% in 30 frames through a 1 ms clock, count in [3, 14], the slow-frame budget; pre-warm ≤2 a frame for 30 frames; the start window; `tight`; the area cap never exceeded across 3 rematches), `locomotion.test.ts` (12: 0.8–1.25× and ≤15% off from a drift to a sprint; walk below the jog; planted toe ≤1 art px at 34 through each contact beat; ≤5% of height; airborne decay; footfalls; turn classes, 80–120 ms per 90° and ≤1 of 16 facings a frame; the one-frame head lead; 6° brake for 4–6 frames, ≤12° burst; bob −1, −1, +2; the clock), `time.test.ts` (6: rewind, SIM jump, inbound and rematch start exactly like a body seen for the first time; pause and hit-stop hold the frame and resume within 20% of his height). `render-only.helpers.ts` runs `motionOf`, the touches and a `SpriteBudget` in the per-step hash. **Changed:** `select-golden.test.ts` and `select-golden-soccer.test.ts` re-pinned (NBA `0fb1e2aa`/`eee73918`, NFL `f83f9e62`/`4ea8a66d`, soccer `c99b29e8`/`30da6afa`), because locomotion changes the selection on purpose and the runner now hashes the whole `motionOf` frame; the players-2/4 values stay in git history as the move's proof.

**Harness:** the three slide classifiers now run `motionOf` (they carried their own copy of the old branches); the sprite probe resets the budget's dev counters (`window.__pixelDebug`, written only while a harness sets it), reports the must set's rate (`animFps.priority`) and matches soccer keys; `players-rematch.mjs` (new); verify row A4 now gates the must set (pooled and median ≥28) and everyone ≥12.

**Verification:** `bash O/heavy.sh npm run typecheck` pass. `npx vitest run src/game/pixel scripts/qa/players-lib.test.ts src/engine/sport-branches.test.ts src/game/hoops2 src/game/juice.test.ts`: 254 pass, 11 skipped. `PS_SPORT=nfl npx vitest run src/game/pixel src/game/football2`: 275 pass, 12 skipped. `PS_SPORT=soccer npx vitest run soccer sport-branches src/game/pixel`: 285 pass, 9 skipped. Browser runs (dev server 5214, Playwright, touch, isolated, 0 external requests in every report): `players-sprites.mjs --vp 393,320`, `players-matchperf.mjs` (5 viewports, 1× and 4×) and the paired runs, `players-rematch.mjs`, `players-burst.mjs`, and `vite-node scripts/qa/players-slide-{nba,nfl,soccer}.ts`.

**Looked at:** `after-p5-ingame-{nba,nfl,soccer}-{393,320}-{0..5}.png`, `after-p5-burst-{nba,nfl,soccer}-sheet.png` (0.25×: poses change every capture, no frozen near player, no figure off its shadow), `perf/after-p5-perf-match-*.png`.

## 2. Baselines (base commit `1d14201` = source of `acdf3e2`, dev server, players-1, 2026-11-16)

Unless noted: 393×852 with insets 59/34, `deviceScaleFactor` 1, the autoplay benches (`?arcade&auto`, `?soccer-lab&auto&qa`), `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted. **The machine was shared with six other teams** (load average 5–6 on 4 CPUs) throughout, which matters for the 4× CPU rows (see "Against the audit").

### 2.1 Broadcast Pixel sprites (V2 C.1) — `players-lineup.mjs`, `players-screen.mjs`

| Row | NBA | NFL | Soccer | V2 target |
|---|---|---|---|---|
| Art pixel at 393 (design px per art px; device px per art px at DPR 1/2/3) | 0.992; 1/2/3 | 0.992; 1/2/3 | 0.992; 1/2/3 | an integer; 1.5 design px pending the lead ruling (V2 C.6 vs C.5 rule 3) |
| Art pixel at 320 | 1.219; 1/2/3 | 1.219; 1/2/3 | 1.219; 1/2/3 | 1.5 |
| Heads tall / head box (w×h, art px) at a 20, 24, 34, 60 art px sprite | 4.5 / 4×4 · 4.4 / 5×5 · 4.57 / 8×7 · 4.46 / 14×13 | same body code | same body code | 4.5 / 5×5 · 5 / 6×6 · 5.5 / 7×8 · 6 / 12×13 |
| Outer silhouette edge pixels in `#14121c` | 0% (8 edge colours per sprite, p50: a dark version of each part) | 0% (7) | 0% (7) | 100% |
| Inner outline-colour pixels at 34 art px (p50 per star; max share of the inside) | 36 (17.6%) | 26 (11.1%) | 34 (16.4%) | 0 (inner separations in the shadow tone) |
| Body width at 34 art px (chest band, arms in; audit method) | Curry 15, Giannis 16, Jokić 16, Shaq 18, Bol 17, Bogues 13, Yao 18; BMI 20 vs 31: 16 vs 16 | per star in `players-lineup-before.json` | per star | Shaq − Bol ≥3 (now 1); BMI 31 ≥25% wider (now 0%) |
| Same, at 40 px (the audit's size) | Curry 17, Giannis 19, Jokić 19, Shaq 20, Bol 20, BMI 20/31 17/19 | | | |
| On-screen height, controlled (ball body) / nearest / median / far, design px at 393 | 75.4 / 89.3 / 63.5 / 47.6 | 27.8 / 33.7 / 27.8 / 17.9 | 39.7 / 47.6 / 27.8 / 23.8 | floors: NBA ≥51 / far ≥36; NFL and soccer ≥34 / far ≥22.5. Guides: NBA ≈95, NFL ≈70, soccer ≈75 |
| Same at 320 (design px) | 75.6 / 90.2 / 63.4 / 48.8 | 29.3 / 34.1 / 26.8 / 19.5 | 39.0 / 46.3 / 29.3 / 24.4 | |
| Sprite px p10 / p50 / p90 (art = CSS px at 393, `players-sprites`) | 44 / 64 / 88 | 22 / 28 / 42 | 20 / 32 / 50 | |

On-screen heights and the stands share are **reported, not owned**: the sport teams' cameras set them. Against V2's revised C.1.2 (the table is a floor, the camera guides larger), NBA's controlled player (75.4) is above its 51 floor and below the ≈95 guide; NFL's (27.8) is under its 34 floor; soccer's (39.7) is above its 34 floor and below the ≈75 guide. Bigger is what V2 now asks for.

### 2.2 Likeness and venues — `players-lineup.mjs`, `players-screen.mjs`

| Row | NBA | NFL | Soccer | Target |
|---|---|---|---|---|
| Distinct skin tones / hair colours among the 12 stars | 1 / 1 | 1 / 1 | 1 / 1 | the curated looks |
| Identity in one shared kit: pairs ≥8% different at 24 px; min pair at 34; min pair at 60 | 94% · 6.9% · 2.4% | 95% · 4.4% · 5.6% | 86% · 1.7% · 2.4% | ≥80% (NBA) / ≥75%; ≥12%; ≥8% |
| Owner-named looks (drawn today, from hashed looks) | Shaq not bald, Iverson no cornrows, Kareem no goggles, Rodman not dyed | Brady: no curated row | Haaland not blond, Mbappé hashed hair | all right, judged on the appearance record (L4, players-3) |
| Missing stars in the card file | none | William Perry (no card) | none | |
| Surface grain (Michelson, median 12×12 tile) | 14.2% | 3.0% | 2.6% | ≤4% |
| Venue mean L* vs sprites' (negative = venue **lighter**) | −24.6% | −29.7% | −47.7% | reported (V2 13:09 dropped "≥30% darker"; the players must be crisper and rim-lit) |
| Crowd: top-3 colours' share; pixels equal to the right neighbour | 0.22; 0.83 | 0.12; 0.70 | 0.19; 0.83 | reported (the old three-band target is superseded) |
| Stands vs sprites at HEAD `2940ccd` (fix run): neighbour \|dL*\| ratio; chroma ratio | 0.30; 1.03 | 0.31; 0.95 | 0.22; 0.76 | both <1 (softer and foggier than the play) |
| Crowd colour mix at HEAD (fix run): hue families ≥3%; largest family; near-white | 3; 0.33; 0.12 | 3; 0.23; 0.02 | 4; 0.24; 0.02 | ≥3; ≤0.55; ≤0.20 (exact C.2 shirt shares in `venue.test.ts`) |
| Corner vignette (corner tiles vs centre, L*) | −26% | −43% | −42% | darker corners (≤−15%) |
| Stands share of the screen height at 393 / 320 (everything above the surface) | 13.0% / 15.8% (36.9%) | 16.9% / 25.0% (34.3%) | 17.6% / 26.2% (34.0%) | about 30–40% (C.5 rule 4; sport teams) |

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
| 120-card fill at 1× / 4× (140-card club, fast flick; HEAD `2940ccd`, fix run) | NBA 382 / 2,524 · NFL 595 / 3,811 · soccer 565 / 3,319 ms | ≤1,200 / ≤3,500 |
| Club-grid scroll frame p95 at 1× / 4× (24 design px a frame) | NBA 18.4 / 31.5 · NFL 21.8 / 74.1 · soccer 29.0 / 51.5 ms | ≤17.5 / ≤34 |
| Long tasks over the fill and scroll at 1× / 4× (count, longest) | NBA 0 / 5 (149 ms) · NFL 2 (58 ms) / 30 (207 ms) · soccer 5 (138 ms) / 15 (227 ms) | 0 over 50 ms |
| Surfaces reached | 13 of 13 (hub, squad, club, detail, store, Scout Market, reveal, tracker, SBC, standouts, sets, evolutions, draft) at 393 and 320 | 13 |
| Reduced motion (393 sweep) | 0 running animations on 220 NBA, 176 NFL, 154 soccer cards | 0 |

### 2.5 The keep-list (`players-keep.mjs`)

13 items, all PASS; 8 observed in play this run (NFL heavy gait, On Fire, stamina, the gold ring, NBA ankle-breaks, the heavy man's wider stride, the sprint lean, the club portrait pump). Not observed in this 40 s window (no failure): the NFL afterimage, leap, bobble, the posterized reaction and the posterizer slow-mo; their anchors are present.

### 2.6 The visual target

**`mockups-v2.html` is the target** (BRIEF, V2 C). `players-targets.mjs` renders it into `O/shots/players/players-1/`: `target-v2-{nba,nfl,soccer}.png` (the gameplay hero frames, 393×852) and `-3x` (sprite close-ups: volume shading, rim light, cast shadows), `target-v2-{dunk,ankle,hit,goal}.png` (replay-camera juice, hero sprites at 4.5–5×), `target-v2-walkout.png`, `target-v2-cards.png` (+ `-2x`, the tier ladder and the bust). Every later "after" sheet is set beside these.

*Superseded, control geometry only:* `target-mockups-{lineup-nba,lineup-nfl,lineup-soccer,hud}.png` (and the lineups at 4×), rendered from `O/design-v2/mockups.html`, the page the owner called "too simple and boring" and "too flat". Its flat, unshaded lineups are not a likeness or shading target. The before set beside it: `before-lineup-<sport>.png`, `before-numbers.png`, `before-ingame-<sport>-393-*.png`, `before-screen-<sport>-<vp>-*.png`, `before-anim-strips.png`, `before-burst-<sport>-sheet.png`, `before-cards-*.png`.

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

`node scripts/qa/players-verify.mjs --run none --tag before --out O/shots/players/players-1` evaluates the reports above; `bash O/heavy.sh node scripts/qa/players-verify.mjs --run all --port <port>` (or a list) re-runs the scripts first, through the semaphore. Every row prints PASS, FAIL or N/A with its numbers, and the route log closes the table. A row whose proving unit test doesn't exist yet FAILs as "not built yet (<task>)".

**Base-commit run** (`--run none --tag before`, the reports in section 2): **2 PASS · 44 FAIL · 1 N/A**, 0 external requests (route log: 45943 localhost requests across 11 reports; the live Supabase host was blocked 277 times by the router, never reached).

**End-to-end run** (`node scripts/qa/players-verify.mjs --run all --quick --tag verify`, every script re-run from scratch into `O/shots/players/players-1/verify-e2e/`, 13 min 23 s): sprites ok (54 s), screen ok (85 s), matchperf ok (93 s), readiness ok (50 s), lineup ok (11 s), strips ok (71 s), cards ok (353 s), keep ok (53 s), players-slide-nba ok (10 s), players-slide-soccer ok (8 s), players-slide-nfl ok (13 s). Result **3 PASS · 43 FAIL · 1 N/A**, 0 external requests. The rows agree with the base-commit run; A6 passes in the quick run because it skips the 430 viewport (the only one over 6 Mpx).

Expected today (as first run): the two PASS rows were the ones the audits say work (K1 keep-list, C9 portrait fill). After the review fix, C9 also measures the 120-card fill and the scroll, and the rows S1, S3, S6, S8, L4, L6, L7, A18, C5 and C9 changed as listed in section 1 ("Fix after the independent review"); the table below keeps the first run's targets and results, with the revised targets in the plan's §3 and in `players-verify.mjs`. A5 (1× fps) should pass on a quiet machine and fails here only from the shared CPUs (section 10). Every other row fails until its owner task lands, either on the measurement or as "not built yet" for its proving test.

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

**As built (players-5):** `who` is the body index on `HoopsRenderer` (`b.idx`) and the body id on `FootballRenderer` and `SoccerRenderer` (`b.id`). Points are the renderer's canvas px (before the screen's own CSS scale); each anchor is where the body was drawn on the last frame drawn, `null` before his first. `pin(who)` forces the next frame's sprite. `resetMotion()` keeps the drawings and the area account and pre-draws the next 30 frames. A screen whose player controls a body that isn't the ball's (the default solo defense) sets `renderer.controlled = <who>` (null otherwise) so that body is always drawn fresh at 30 fps. Pauses of 0.25 s or less need nothing: the game-time clock holds the frame.

### 4.4 Ground marks and the art pixel (players-2)

**Re-published in the players-1 fix (V2 revised 13:09; v1.1).**

- `drawGroundMark(ctx, { x, y, shoulderPx, mark?: 'you'|'target'|'pressure'|'rival', color? })` in `src/game/pixel/ground.ts`: today the soft shadow (`rgba(0,0,0,0.32)`, 70% of shoulder width). From players-4 the same call draws V2 C.1.3's cast shadow (the sprite's silhouette sheared away from the lights at 34–42% alpha, anchored at the ground) plus a small occlusion ellipse; the signature does not change. When asked, it draws the 2 px ring in gold `#f6b93b`, teal `#4fe3c1`, red arc `#ff5d5d` or violet `#8b7cf6`. Nothing else on the field uses those four colours. `color` is the hook for ut's cosmetic ring colour (the Minutes 500/1,000-hour reward).
- `artScale(canvas) → { backing, devPerArt, artPxFor(cssHeight) }` in `src/game/pixel/art-scale.ts`. **To the sport teams:** your cameras set the on-screen heights. V2 C.1.2 (revised) makes its table a **floor**: controlled ≥51 design px (NBA) / ≥34 (NFL, soccer), far ≥36 / ≥22.5; the camera guides at 393 are NBA handler ≈95, NFL QB ≈70, soccer carrier ≈75 (far ≈60 / 45 / 55). Bigger than the floor is right; nobody needs to shrink. `players-screen.mjs` measures them and `players-verify.mjs` row S6 reports them. Today 1 art px = 1 canvas px = about 1 design px (section 2); whether V2 still wants a fixed 1.5 design px art pixel is request 7. If players-2 picks backing A or B, the resize code sets `canvas.width = W × backing` and draws through one `setTransform(backing)`; everything else keeps CSS px. That hunk is announced here before it lands.
- **Venue palette tokens (v1.2, as built in players-4).** `src/game/pixel/venue.ts` holds the surface tokens (`VENUE`: NBA planks `#c98f52`/`#bf8548`, lines `#f4ead8`; NFL mow `#2f8f46`/`#2a8240` every 5 yd, lines `#eaf5ea`, numbers at 60%; soccer mow `#2e9a4a`/`#288a41` every 5.5 m, lines `#f2fff2` at 85%), `teamPaint` (85% saturation), `teamDark`, `lit(c, x, y, pools, along)` (light pools and the far end 6% darker, baked into textures), `drawVignette(ctx, W, H)` (corners −18%, one cached canvas). `src/game/pixel/crowd.ts` holds the crowd: `crowdPalette(home)`, `crowdAt(palette, x, y, band, seed)`: three dark bands, nearest lightest, flecked with the home colour (≤6%) and white (≤2%) in 2 px blocks. **The task spec for players-4 asked for this three-band crowd** (the earlier C.2 text); V2 13:09's head-and-shirt crowd with shirt shares, six skin tones, arms up, shimmer and flashes is the living-venue work of players-9, which builds on `crowd.ts`. `crowd.excite('score'|'onfire'|'clutch', t)` exists now and does nothing yet; wire it on a score, ON FIRE and Clutch. **Stands height** stays the sport teams' (C.5 rule 4; row L7).

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

`pixelReady(sport): Promise<boolean>` (`src/game/pixel/ready.ts`, players-3) resolves true when the sport's clips and appearance data are in, and false when a load failed. It never rejects, and a failed load is tried again.

- `select-<sport>.ts` starts the load for the page's sport as the game chunk is evaluated.
- Each sport screen's loop holds game time with `holdPlay(sport, now)` (one line, `acc = 0`) while the first load is on its way: at most 1.5 s, never after a failure.
- Each renderer's `draw()` begins with `wantPixels(sport)`. It always draws, and it retries a failed load every 5 s.
- A loading gate may still `await pixelReady(sport)` to show its own spinner, but nothing depends on it.
- `players-readiness.mjs` and verify row A7 measure it.

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
   `const onDemandModule = /[\\/](?:game[\\/]soccer2[\\/]|game[\\/]pixel[\\/](?:pitch|select-soccer)\.ts|data[\\/](?:cards-(?:nba|nfl|soccer)|soccer)\.json|data[\\/]appearance[\\/](?:looks-)?soccer\.(?:json|ts)|data[\\/]mocap[\\/](?:clips-soccer\.ts|jump\.json))/;`
   (players-3: the soccer looks file, which loads through `looks-soccer.ts` since the review fix, and the soccer clip bundle, whose chunk holds `clips-soccer.ts` and `jump.json`, the one clip only soccer plays. `clips-shared.ts`, the clips two or more sports play, stays in install.) Until shell merges it, about 9 KB gzip of soccer looks and the small soccer clip chunk are precached for every sport.
4. **Reports (players does not edit these):**
   - brand-like badge names in `abilityName`/`ABILITY_HELP` (`hoops2/ratings.ts:200-207`) and `rate.ts:114` "Heat Check", now also a name clash with V2's in-match Heat;
   - missing NFL (26%) and soccer (7.7%) jersey numbers in the data files (L-5 backfill, the lead's data);
   - the NFL squad OL row overlapping at 320 (ut).
   - **New from players-1:** the CardDetail still shows a "2K" (NBA) / "Madden" (NFL) reference link with `target=_blank` (H6/M11; players-8 removes it); team badges under 4.5:1 ink contrast: NBA 5/55, NFL 11/47, soccer 69/250 teams (players-8).
5. **On-screen heights and the stands share are the sport teams'.** Rows S6 (V2 C.1.2 floors: controlled ≥51 / ≥34 design px, with the ≈95 / 70 / 75 camera guides beside them) and L7 (C.5 rule 4: stands about 30–40% of the screen above the far boundary) report them (section 3); the numbers today are in section 2. Nothing asks a camera to shrink. Please re-run `players-screen.mjs` after a camera change.
6. **Post-merge:** run `bash O/heavy.sh node scripts/qa/players-verify.mjs --run all --port <port>` on the merged tree (players-10 step 8), with `PS_QA_FONT_DIR=O/qa-fonts` so the card-text rows are measured in Archivo.
7. **Art-pixel ruling (new, V2 13:09).** V2 now contradicts itself: C.6 says perspective scaling "replaces the flat '1.5 px per art pixel' rule in C.1.2: size is whatever the camera says", while C.5 rule 3 and lead decision 3 still say one art pixel = 1.5 design px. players-2 adopted today's grain (option C, about 1 design px per art px, whole device pixels) on measured 4× fps. Please rule `camera` (no fixed art-pixel size; S6's floors apply) or `flat-1.5`; row S1 gates only whole device pixels until then (`S1_RULING` in `players-verify.mjs`).
8. **Venue darkness (players-4).** The players-4 spec asks for both the plank/grass tokens (NBA `#c98f52`, L* ≈ 64) and a venue mean lightness ≥30% below the sprites' (≈42 L* on the NBA court). Both can't hold on a wood floor; the tokens are built and the darkness row is reported (NBA −2.6%, NFL −15.4%, soccer −40% at 320), as V2 13:09's revision already treats it. If the lead wants the 30%, the lever is darker tokens (and a sport-team look check); please rule.

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
| players-3 | same three | top imports | `loadClips` and `CLIPS` imports dropped; `import { wantPixels } from '../pixel/ready'` (was `drawGate` until the review fix) |
| players-3 | same three | `constructor(` | the `loadClips(CLIPS)` call removed (the body is now `{}`): `select-*.ts` starts the sport's bundle as the game chunk loads |
| players-3 | same three | `draw(ctx…` first line | `wantPixels('<sport>');` (one line and a comment; the review fix replaced the early-return `drawGate`, so every frame draws) |
| players-3 fix | `hoops2/Hoops2.tsx`, `football2/Football2.tsx`, `soccer2/Soccer2.tsx` | the loop's `acc += …` line (soccer: also after `const slow = …`) | `if (holdPlay('<sport>', now)) acc = 0;` and its import: no fixed step while the first clips and looks load (≤1.5 s) |
| players-4 | same three | top imports | `staleLook` from `../pixel/looks`, `drawVignette` from `../pixel/venue` |
| players-4 | same three | `let look = this.looks.get(who)` in the sprite method | `if (!look \|\| staleLook(look))`: a look made before the appearance data arrived is rebuilt, and the drawings let go (`this.sprites.dispose(this.last.values())`) |
| players-4 | same three | the floor blit (`ctx.drawImage(fl.canvas, …)`; NFL also its early-return field blit) | `drawVignette(ctx, this.W, this.H)` right after it: one cached canvas, colour only |
| players-5 | `hoops2/render.ts`, `football2/render.ts`, `soccer2/render.ts` | top imports | `locomotion`, `sprite-budget`, `anchors` imports; `motionOf` (was `animOf`), `groundEllipse`, `clipMeta`/`mocapJointsAtFrame` |
| players-5 | same three | renderer fields after `sprites`/`last` | `SpriteCache(…, MATCH_AREA)`; `budget = new SpriteBudget()`, `steady`, `frameAt`, `lastT`, the last state, `anchors`, `pinned`, `controlled` (soccer also `ballShift`) |
| players-5 | same three | `private sprite(` (now `private plan(`) | returns a `SpritePlan` (key, make, next stride frame) built from `motionOf`; the old inline budget/`CanvasOut` block moved to `resolveSprites`; then `mustSet`, the anchor methods and `resetMotion` |
| players-5 | same three | `draw(` where `this.budget = 4` (NBA, NFL) or `5` (soccer) was | the start detection and `this.budget.begin(…)`; every body planned and `resolveSprites` run before the shadows; shadows, sprites and anchors at the drawn spot (engine spot + planted-foot offset) |
| players-5 | `hoops2/render.ts` | the ball block (`// the ball: in a flight, on the dribble`) | the dribble floor (two lines) reads the handler's drawn feet (`this.anchors`) |
| players-5 | `soccer2/render.ts` | the ball drawing (`const b = a.ball`) | the owned ball rides with its owner's planted-foot offset (`ballShift`) |
| players-4 | `pixel/persp.ts` `standsWall`, `courtTexture`; `pixel/court.ts` `drawCourt`/`drawCrowd`; `pixel/field.ts` `drawField`; `pixel/pitch.ts` `pitchTexture` | the colour picks inside the per-texel loops | colours from `venue.ts`/`crowd.ts` (tokens, `lit`, `teamPaint`, `crowdAt`); no geometry, line, stand or camera position changed |

## 7. Touched outside my lane

- **players-2, announced backing hunk** (plan §2, request 2 in section 5): `src/game/hoops2/Hoops2.tsx`, `src/game/football2/Football2.tsx`, `src/game/soccer2/Soccer2.tsx`, the resize code in the draw loop: one import of `artScale` plus 4 lines (`renderer.art = artScale(canvas, W, H)`; the backing size `bw`/`bh`; the size check and `canvas.width/height` use it). With the adopted option C the backing is 1, so the canvas is exactly as before; `?artpx=A` turns on the device-resolution backing.
- players-1 changed only `scripts/qa/players-*` and this doc.
- **players-5:** only the players sections of the three `render.ts` files (section 6), plus three small hunks next to the sport teams' code: the budget's start detection and `begin()` at the top of each `draw()` (where `this.budget = 4` or `5` was), the NBA dribble-floor lines and the soccer owned-ball offset in the ball drawing (two lines each), and the anchor methods appended to each renderer class. `scripts/build_mocap.py` (players-owned per the plan) gained the walk clip and the walk's footfall thresholds. No screen file (`Hoops2.tsx`, `Football2.tsx`, `Soccer2.tsx`) was touched: wiring `renderer.controlled`, `resetMotion()` on rematch and the HUD's use of the anchors is the sport teams'.
- **players-4:** `src/game/soccer2/kits.ts` (soccer's), two lines in `soccerKits`: the rival changes whenever the first colours are within CIEDE2000 ΔE 25, to the first of the away set and three change kits that reads (`clearOf`, `CHANGE_COLORS` from `uniforms.ts`); before, he changed only when the away set was "further" by the redmean distance. The `drawVignette` line and the look-rebuild line in each sport's `render.ts` (section 6) sit next to the sport teams' floor and sprite code.
- **players-3 review fix:** one announced line plus an import in each sport screen's game loop (`Hoops2.tsx`, `Football2.tsx`, `Soccer2.tsx`): `if (holdPlay('<sport>', now)) acc = 0;`, right after the `acc +=` line (soccer: `const held = holdPlay('soccer', now)` beside `slow`, and `if (held) acc = 0;` in the live branch). It holds game time, never inputs or results, while the first load is on its way (section 6).
- **players-3:** `docs/CREDITS.md`, a new "Player appearance" section (Monk Skin Tone CC BY 4.0, transfermarkt-datasets CC0, Commons photos as references only). The one-line `drawGate` hunks in the three `render.ts` `draw()` methods (section 6) sit at the top of a method the sport teams also edit.

## 8. Deviations from STREAM, recorded

- **A-5 "interpolating 15 fps clips".** Research R2 says never interpolate between cached frames (pixel joints shimmer). We sample clips natively at 30 fps for the near, large and ball bodies instead, and blend only *between clips*. V2 B.1.6's rates (handler and defender 30 fps, others 15) agree.
- **players-5 sprite budget:** 5 ms (not 3) and a 10 ms start window for 30 frames (not 2 leftover draws) at 1×; on a slow phone (`tight`) it falls back below the plan's numbers. "Every sprite ≥34 art px at 30 fps" was dropped: only the must set runs at 30. Measured reasons in section 1, players-5.
- **players-5 NFL drop:** the 3/5/7-step footwork comes from the stride rate-matched to the engine's drop speed (the steps the engine's movement implies), not from a keyed 3/5/7-step table; the engine has no `dropSteps` field yet (§4.1 reserves it).
- **players-4's crowd is three dark bands with flecks** (the task's spec), not yet V2 13:09's head-and-shirt crowd; that, and the shimmer and flashes, land with players-9 on the same `crowd.ts`.
- **"Venue ≥30% darker than the players" is not met** (NBA −2.6%, NFL −15.4%, soccer −40% at 320): the spec's own plank and grass tokens set the surface lightness. V2 13:09 made the row reported only; section 5 request 8 asks the lead.
- **STREAM's skin-palette crowd recolour** is replaced by V2 C.2's head-and-shirt crowd (revised 13:09: shirt colours by team share and six skin tones), so the crowd is still not one tone.

## 9. Owner device checks

1. "Can you tell who is who?" at a glance: the NBA five, the NFL backfield, the soccer front three, in portrait and landscape.
2. The 5-head proportions and the art pixel on a real iPhone (V2 decision 3): crisp, even pixels, nothing blurred. Compare the adopted grain with `?artpx=A` (1.5 design px art pixel on a device-resolution canvas) in each sport: A was 15–20 fps at 4× CPU on this machine, so check whether the phone holds 60 with it before anyone switches.
3. Calmer venues: do the players pop off the court, field and pitch?
4. Card readability on the phone at every size; frame and foil rendering in iOS Safari.
5. A 100+ card club scroll.
6. Animation: transitions, planted feet and turns in a real match; NFL near-player smoothness; the handoff and the sack; keeper dives.
7. Celebration, walkout and crowd timing; reduced motion on the device.
8. After a full match and two rematches, background the PWA and return: it must still be alive.
9. Skin tones of curated stars look right (players-3 picked 57 by eye from Commons photos; they show on cards and in matches from players-4).
10. The first match frame never pops from stand-in poses to recorded motion, and no curated star changes look mid-match (players-3 readiness), on a cold start over mobile data.
12. players-4: open `?pixel=looks` on the phone and check the owner's seven (Shaq bald, Iverson cornrows + headband + sleeve, Kareem goggles, Rodman's dyed hair, Haaland long blond, Mbappé short and clean-shaven, Brady), then a match per sport: can you tell the stars apart, do numbers read from about 28 px, and is the calmer floor and three-band crowd still "a lit arena" rather than dull?
13. Kits: two teams with close colours (Lakers vs Kings, Bulls vs Heat, Liverpool vs Arsenal) get a change kit that reads at a glance.
14. players-5: in a match per sport, do the near players ever freeze or slide? Watch the NBA inbound after a replay, the NFL snap and drop (the QB faces downfield and steps back, never gliding), soccer defenders backing off facing the ball, and slow drifts (a walk, never a frozen stance). On an older iPhone, does the frame rate hold at the start of a possession?
11. Black kits (Nets, Spurs, Raiders, Saints, Steelers, Juventus) on the phone: they now draw as charcoal (`#3b3b3b` base) inside the `#14121c` outline so the silhouette and the shaded side show; check they still read as black kits in a match, and that white kits read white.

## 10. Left undone, and why

- **players-2:** the slide classifiers still carry their own copy of the renderer's branches, so they measure the old branches, not the moved `select-*.ts` code (the golden digests prove the move). Pointing them at `select-*.ts` is not an import swap: `animOf`/`gait` return clips and poses with their own memo, and the classifiers count slide categories the selection doesn't name; that rewrite lands with players-5, which replaces locomotion and its classifier together. The verify row S2 still uses players-1's heads-tall definition (figure ÷ box with hair), which V2's table can't meet; `proportions.test.ts` is the gate (section 1, players-2). V2 C.1.3's five-tone shading, cast-shadow silhouettes and general rim light are newer than this task's spec (three tones); they are recorded for players-4, with their gates in rows S3 (`shading.test.ts`) and S8 (`cast-shadow.test.ts`).

- **The NFL golden sequence is not deterministic in the browser.** Two repeats under Playwright's virtual clock diverge at frame 29: one draws a defender in the hand-keyed `stance` pose (`st2`, the pre-snap branch of `poseOf`), the other the `ready` clip, so the play's phase differs between runs (something in the NFL bench still follows real time, or a clip arrives late). NBA and soccer are deterministic after this task's fixes. **For players-2's extraction check, the node-side `select-golden.test.ts` (seeded engine, no browser) and the three slide classifiers are the byte-identical gate**; the browser sequence stays a diff aid. Whether this is a readiness race is a players-3 question (row A7).
- **The 4× CPU numbers are not comparable with the audit's** (dev server on a machine shared by seven teams vs the audit's production build on a quiet machine). players-10 repeats `players-matchperf.mjs` on `vite preview`; the relative rows (A5) compare like with like in the meantime. Row A5 also fails at 1× today for the same reason (55.4–59.0 fps in 10 of 15 runs while other teams ran builds and Playwright), not because of the game.
- **Crowd detection is approximate.** `players-screen.mjs` finds the stands as the band of textured rows above the surface; the screenshots it saves beside the numbers are the check by eye. The numbers agree with the screenshots looked at (NFL 393: stands ≈ y 120–270 of 852, measured 16.9%).
- **players-3:** the looks are loaded and ready but not drawn yet: `matchLook`/`cardLook` replace `lookFor`/`lookOf` in players-4 (step 3), with the raster for the 18 silhouettes, facial hair and gear. A look that arrives after the gate gave up is not yet re-drawn (the renderers cache `Look` per body); players-4 marks such looks stale when it wires `matchLook` (the gate makes that case rare: 0 in every run). The second, independent review of the 73 rows is players-9/10's; Tier A beyond the seeds (GOAT, Legend, top 60) is players-9. Sixteen rows keep the neutral skin until a usable photo is found. ut and packs still need to draw the first-run showcase and the starter's featured gold from `first-run.json` (§4.8). In production the appearance chunk is named after its JSON (`nba-<hash>.js`), which `players-readiness.mjs`'s `LOOKS` pattern does not match; players-10 adds the production names when it runs readiness on `vite preview`. The NFL browser golden sequence (below) was not re-run.
- **players-4:**
  - The plan listed V2 13:09's five-tone shading (`shading.test.ts`) and cast-shadow silhouettes (`cast-shadow.test.ts`) under players-4, but this task's spec does not include them. Sprites keep three tones with the outline (C.7 #8's three tones are met for the jersey, skin and shorts in `outline.test.ts`). The harness's lineup row still reads `tonesMin 2` for one NBA star's minor material at 34 art px, and the rim light is lit on 58–72% of the qualifying pixels, against V2's "every". Both are carried as followups.
  - Also from the plan, not built here, to a later task:
    - the head-and-shirt crowd, shimmer and flashes (players-9);
    - the soccer captain's armband and soccer kit patterns (L-6, stretch);
    - wiring `crowd.excite` (the sport teams);
    - the ledger-only C.2 items the sport teams own: layers, beams, haze, drift.
  - The venue screen row: soccer's 393 run caught 0 venue frames (its 320 run is reported). The screen harness's crowd top-3 share counts the ribbons and facades inside its detected stands band; the palette itself is proved in `venue.test.ts`.
- **players-5:**
  - **NBA at 4× CPU** stays 0.6–2.5 fps under the paired base at 393 and 430 (inside the base's own 4.5 fps run-to-run spread, and 2 fps over it at 375); NFL and soccer within 0.5–3. The extra cost is the freshness (stale NBA draws 4.4% → 0.3%). players-10 repeats the pairing on `vite preview`; if the phone needs it, the next lever is fewer touch variants per frame at 1× too.
  - **The must set's lowest body** reads 21.9 fps in soccer (pooled 38–39, median body 39–41) and 29–30 in NBA: the harness's must set (the ball's body, the target, his nearest opponent) is a stand-in for the renderer's (which also holds the controlled man and the soccer pass target), and one soccer body the harness counts was not always in the renderer's set. Not yet traced to the frame.
  - **`renderer.controlled`, `resetMotion()` on the One-More rematch, and the HUD reading `headTop`/`feetAt`** are the sport teams' hunks in their screens; until they land, the controlled defender in solo defense is fresh only through the ≥32 px force rule, and a rematch re-mount starts cold (the caches go with the old renderer).
  - **16 facings from 18 art px** "when the area cap allows" was not done: NBA already runs at the 6 Mpx cap at 393/430, so far bodies keep 8 facings under 26 (NBA) / 22 (NFL, soccer) art px.
  - The `?pixeldebug` counter is the harness-set `window.__pixelDebug` (frames, draws, forced, limit, cost, drawing time); stand-in poses, default looks and blend draws are counted by the existing readiness probe and land with players-6's blends.
- **Nothing else from players-1 is left.** Every later row in section 3 belongs to the task named in its row.
