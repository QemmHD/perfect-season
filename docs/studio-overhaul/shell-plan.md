# Team shell: build plan

Team **shell**: iPhone fit, app shell, loading, offline and performance. Branch `claude/studio-shell`, worktree `/home/user/ps-s-shell`, dev-server port **5211**.

Planned 2026-11-09 against `acdf3e2`. No code was changed while planning.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`. Commands in this plan use `heavy.sh` as shorthand for `bash $O/heavy.sh`.

**Sources read in full:** `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-shell.md`, `CLAUDE.md`, `O/audit-ut-ui.md` (all of it), `O/audit-likeness-animation-perf.md` (all of it), `O/research-likeness-animation.md` (all of it), `docs/OVERHAUL-SCREEN-FIT.md`, `docs/OVERHAUL-PERFORMANCE.md`, `docs/BROWSER-QA.md`, the audit scripts (`O/audit-scripts/utui/{lib,edge}.mjs`, `O/audit-scripts/likeness/{coldstart,heap,matchperf}.cjs`) and the owner's screenshot.

**Code read:**
- the stage: `stage-layout.ts`, `stage.tsx`, `stage-layout.test.ts`
- the launch path and worker: `index.html`, `main.tsx`, `vite.config.ts`, `pwa/sw.js`, `lib/update.ts`
- UT data loading: `soccer-lazy.ts`, `ut/pool.ts`, `ut/cards.ts`, `ut/season-reference.ts`, the `RatedCard` type, the `rateCard` entry
- screens and hooks:
  - `App.tsx`: lazy screens, the reset handler, update checks
  - `Pages.tsx`: the Home layout and Settings
  - `Arcade.tsx`: game mounting
  - `UltimateTeam.tsx`: pool loading and the loading/error UI
- CSS: the `styles.css` and `nav.css` rules named in OWNERSHIP
- QA scripts: `scripts/qa/{browser,screen-fit,startup}.mjs`

---

## 1. Goals

1. **The iPhone top edge looks native and crisp.** On iOS 26, nothing the player reads or taps may start inside the status-bar blur band, which runs from the inset down to inset + about 22 pt.
   - Every top bar sits on a real, premium header plate that starts at y = 0.
   - "LEVEL N" must be as bright as "x/y XP" on the owner's phone.
2. **Nothing is cut off, and every tap target is at least 44 design px.** This covers:
   - the card-detail action bar (H1)
   - the Home hint and PLAY-bar fade (M1)
   - the small targets (M6)
3. **Loading looks intentional.**
   - A branded arena curtain covers the black gap between PLAY and the first frame (M9).
   - A UT skeleton with real progress replaces the spinner.
   - Reset Progress becomes a protected danger zone (M8).
4. **Ultimate Team opens fast.**
   - Under 2.5 s at 4× CPU on a warm cache, and under 1.5 s after Home has been idle.
   - No long task over 200 ms.
   - Heap retained by the source data is cut.
5. **The app works offline.**
   - UT works for every sport the player has opened before, including after an update.
   - A first offline visit to soccer shows a friendly screen, not a blank page.
   - The install precache is lean and split per sport.
6. **Launch is fast.**
   - No fixed 1.15 s splash floor.
   - No render-blocking third-party font.
   - Offline relaunch to Home in under 1.5 s.
   - Auto-update keeps working.
7. **Taps and transitions answer within 100 ms** (Nielsen's "instantaneous" limit, per the research doc). Matches lose no frame headroom because of shell work.

Hard rules for every task:
- Saves, storage keys, card/edition/copy ids and `pool.print` never change.
- No protocol bump is expected. `DRAFT_RULES` and `UT_RULES` are never edited.
- QA is isolated:
  - every run uses `?ns=inspect&relay=ws://localhost:7777`;
  - every Playwright context aborts non-localhost hosts, except Google Fonts.
- Sport branches use `pick` / `pickFor`.
- The 390 design frame is kept, with no width media queries and no `screen.height` guesses.
- Reduced motion is respected.
- Symbols are SVG.
- Heavy commands go through `heavy.sh`.
- Commits stage explicit paths.

## 2. Scope map: every STREAM item → task

| STREAM item | Task |
|---|---|
| P0 C1 Fix A: edge clearance in `stage-layout.ts`/`stage.tsx`. `--sat` = inset + edge, new `--inset-top`, `.arcade-full` `--sat`. Keep `sat` raw and add `edge` tests. Compute `fit` so the class doesn't flip. | shell-2 |
| P0 C1 Fix B: fixed `status-plate` outside the transformed stage | shell-3 |
| P0 C1 Fix C: premium header plates from y = 0 for the main TopBar, `.ut-top`, sub-page headers, game HUD score bugs, toasts and pack SKIP | shell-3 |
| P0 C1 Fix D: `index.html` comment, `viewportInfo()` edge, `screen-fit.mjs` topmost ≥ sat + edge, QA override for `.arcade-full` insets | shell-2 (the harness side in shell-1) |
| P0 C1 verify every screen of 3 sports at 393×852 (59/34), 430×932, 390×844 (47/34), 375×667 (20/0) with the simulated band, plus before/after contact sheets in `O/shots/shell/` | shell-1 (before), shell-4 (after), shell-10 (final re-run) |
| P0 H1: card-detail sticky action bar floats 34 pt | shell-4 |
| P0 M1: NBA/NFL Home hint under the PLAY shadow; Soccer Home dead gap | shell-2 (ships with Fix A, as the audit requires) |
| P0 M6: respins 38, boosters 40, SKIP 65×36, season chip 141×41 (plus QUICK SELL DUPES 133×34 and TAP TO CONTINUE 224×42 at 320 from the audit) | shell-4 |
| P0 M9: black arena gap of about 1.2 s; branded loading state (matchup, colours, tip, shimmer) | shell-5 |
| P0 M8: Reset Progress danger zone, type-to-confirm | shell-5 |
| P0 P-1: UT open 7.4–9.0 s at 4×, long tasks up to 669 ms, 41–57 MB. Profile, lazy/indexed pools, chunked/idle parsing, no full-pool scans on first paint, memoisation, skeleton. Target < 2.5 s at 4× and no task > 200 ms. | shell-6 (pipeline), shell-7 (rated-pool cache, idle prefetch, skeleton) |
| P0 P-2: UT offline for sports opened before; a sensible per-sport precache; fix "UT offline for a sport not opened since the update" and "offline first visit to soccer is blank" | shell-8 |
| P0 P-3: splash floor ≥ 1.15 s; render-blocking Google Fonts (preload, `font-display: swap`, fallback metrics); offline relaunch 3.9 s → < 1.5 s | shell-9 |
| P0 P-4/P-5: frame headroom; bundle-shape quick wins that keep lazy chunks | P-5: shell-6 (`json.stringify`, fetch-as-JSON), shell-8 (precache groups), shell-9 (one mocap chunk). P-4: shell-10 (harness, background-work guard). The renderer fixes are deferred to players (§5). |
| General: check every screen transition and tap for jank; input → visible change ≤ 100 ms | shell-10 |
| General: keep the `update.ts` flow; the home-screen app must still auto-update | shell-8 (test b), shell-9, shell-10 |
| Owner device checks (Home and UT Home screenshots, `safe 59/34 · edge 22`, whether Fix B flattens the band) | §7, copied to `shell.md` in shell-10 |

**Audit L items read** (`audit-ut-ui.md` §3 Low):
- Done by shell:
  - L2 header part: the "LV" ring label at 8 px (shell-3)
  - L6: the `index.html`/manifest description mentions only NBA/NFL and says "Super Bowl" (shell-2)
  - L7: QA can't emulate standalone or arcade insets (shell-1 and shell-2)
- Deferred with owners (§5): L1, the rest of L2, L3, L4, L5, L8, L9.

## 3. Baselines (before numbers to beat)

From `audit-likeness-animation-perf.md` §3.1. Production build `acdf3e2` at 390×844, DSF 3, isolated. This build is kept at `O/audit-scripts/likeness/build`; serve it with `vite preview --outDir` for re-measurement.

| Metric | NBA | NFL | Soccer |
|---|---|---|---|
| UT open, tap → ready, 1× / 4× | 2,123 / **7,395 ms** | 2,092 / **8,974 ms** | 679 / 1,834 ms |
| Longest task during UT open at 4× | 385 ms | **669 ms** | 431 ms |
| Heap, Home → after UT (CDP, after GC) | 14.0 → 55.5 MB | 11.4 → 68.8 MB | 12.1 → 46.2 MB |
| Warm relaunch to Home | 1,027 ms | 927 ms | 940 ms |
| Offline relaunch to Home | **3,965 ms** | 3,942 ms | 3,974 ms |
| UT offline (never opened online on this build) | "cards didn't load" | same | same |
| Cold visit at 4× + 4G: FCP / interactive / longest task | 1,572 / 2,612 / 295 ms | 1,260 / 2,206 / 214 ms | 1,284 / 2,284 / 232 ms |
| Match at 390, 4×: fps / p99 interval | 54.8 / 33.4 ms | 57.5 / 33.4 ms | (lab) 59.0 |

Precache:
- 11.5 MB in 111 files.
- `season-references-nfl` (2.55 MB) and `-nba` (0.65 MB) are installed for every player.

Mocap:
- 15–26 clip requests per match.
- In the NBA lab, the first frame came at 1,082 ms and the clips at 1,218 ms.

**Profiling done for this plan.**
- Method: vite-node, desktop CPU, the scratchpad script `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/shell-plan/poolprof.ts`, run through heavy.sh.
- What it shows: today's UT open cost is **dominated by evaluating the card file as a JS object literal**. Vite 5.4.10 emits JSON imports as object literals.

| Step | NBA (22,082 lines) | NFL (32,242) | Soccer (30,352) |
|---|---|---|---|
| `JSON.parse` of `cards-<sport>.json` | 21 ms | 20 ms | 36 ms |
| The same data imported as a JS-literal module | **1,531 ms** | **1,158 ms** | **1,987 ms** |
| `expandCards` (one synchronous call today) | 178 ms | 279 ms | 151 ms |
| Rate every line (`buildPool`) | 1,103 ms | 1,060 ms | 109 ms |
| `pool.print` (no schedule loaded) | `18ii7ih` | `10lot1s` | `1nj8cee` |

At 4×, rating alone is about 4.2–4.4 s. So:
- the < 2.5 s target needs ratings cached per build (shell-7);
- or the pool must be built before the tap (idle prefetch, shell-7).

Parse and expand must be sliced so that no task exceeds 200 ms (shell-6).

**UI baseline** (`audit-ut-ui.md` §1):
- Topmost text/control on every header at 393×852 sits at 65–76 pt, which is sat + 6…17 and inside the band.
- Toasts sit at sat + 6, SKIP at sat + 12, and the in-game bug at sat + 8.
- The H1 bar floats 34 pt high on notch/island phones.
- Small targets: respins 172×38, boosters 90–107×40, SKIP 65×36, QUICK SELL DUPES 133×34, season chip 141×41, TAP TO CONTINUE 224×42 (320 only).

## 4. Tasks (in order)

Each task is one focused session of about 1–3 h on one coherent set of files.

Every task ends the same way:
- typecheck: `heavy.sh npm run typecheck`
- tests for its own area (NBA default, `PS_SPORT=nfl`, and `PS_SPORT=soccer npx vitest run soccer sport-branches` when soccer is touched)
- its screenshots
- an update to `docs/studio-overhaul/shell.md`, covering what changed, before/after numbers, tests, touched-outside-lane and device checks
- a commit of explicit paths with a `Claude: ` message and the BUILD-RULES trailer
- `git push -u origin claude/studio-shell`

Dev server:
- start: `nohup npx vite --port 5211 --strictPort > /tmp/ps-shell-vite.log 2>&1 & echo $! > /tmp/ps-shell-vite.pid`
- stop: `kill $(cat /tmp/ps-shell-vite.pid)`

QA environment:
- `PS_QA_URL=http://localhost:5211/`
- `PS_QA_PACKAGE_JSON=/opt/node-tools/package.json` if `require('playwright')` doesn't resolve from the repo.

**Production builds for measurement.** The service worker, precache and real chunk timings exist only in a production build. Tasks shell-6 to shell-9 each run at most one measurement build:
- build: `heavy.sh npx vite build --manifest --outDir /tmp/claude-0/.../scratchpad/shell-build`
- serve: `npx vite preview --outDir … --port 5211 --strictPort`

This is not `npm run build`. "Before" numbers come from the audit's kept build. If the lead refuses this exception, those acceptance measurements move into shell-10.

---

### shell-1 · P0 · QA harness: isolation, iOS 26 band simulation, screen walker, baselines (enabling)

**Why.** Every later task is proven with these tools.
- `scripts/qa/browser.mjs` currently does **not** abort non-localhost requests. An earlier QA run registered cards live by accident.
- The audit's `walk.mjs` was not kept.
- The audit's `edge.mjs` and `lib.mjs` live outside the repo.

**Changes**
- `scripts/qa/browser.mjs`. The existing exports and signature stay compatible: `fixture(browser, sport, name, width, contextOptions)`.
  - Add `context.route('**/*', …)`:
    - continue `localhost`, `127.0.0.1`, `fonts.googleapis.com`, `fonts.gstatic.com`, `data:` and `blob:`;
    - abort everything else;
    - push each aborted host to `f.blocked`, which is returned.
  - Add an optional 6th parameter `{ insets: [t,r,b,l], height, standalone, dsf = 1, motion = 'reduce' }`:
    - it sets `window.__psInsets` via `addInitScript`;
    - it overrides `navigator.standalone`;
    - it attempts the CDP display-mode emulation, as `lib.mjs` does.
  - The base defaults to `PS_QA_URL`.
- New `scripts/qa/edge-lib.mjs`:
  - `DEVICES`:
    - `393` = 393×852 [59,0,34,0]
    - `430` = 430×932 [59,0,34,0]
    - `390` = 390×844 [47,0,34,0]
    - `375` = 375×667 [20,0,0,0]
    - `320` = 320×568 [20,0,0,0] (regression only)
  - `edgeOf(t) = Math.min(22, Math.round(t * 0.4))`. It mirrors `topEdge` in `stage-layout.ts`, with a comment pointing at it.
  - `simulateBand(page, insetTop)`: the audit's iOS 26 overlay. Backdrop blur 2.6 px plus brightness 0.66, masked from 0 to inset+26 with the fade starting at inset+12. Screenshots only.
  - `auditScreen(page, device)` extends `lib.mjs`'s `audit`. It returns:
    - `inBand`: text/controls not inside a vertical scroller whose top is above `(inset + edgeOf(inset)) / k` in frame px. It also covers fixed overlays (`.toast`, `.ut-skip`) and the portaled `.arcade-full` HUD, measured in screen px.
    - `bottomCut`: text/controls below `H − sab`, plus PLAY bar/tab bar bottoms outside the viewport.
    - `small`: < 44 design px, counting a `::before` hit area.
    - `overlap`: pairs of effective hit rects that intersect.
    - `tiny` (< 10 px), `lowContrast`, `docScroll`, `hOverflow`, `offscreen`.
  - `forceStandaloneRule(page)`: injects `index.html`'s `html{min-height:min(100lvh,calc(100% + env(safe-area-inset-top)))}` without its media query. CDP cannot emulate `display-mode` (L7).
  - `contactSheet(files, out, cols = 6)`: grids PNGs as data URLs in `page.setContent` and screenshots the grid. No Python is needed.
- New `scripts/qa/edge-walk.mjs`.
  - CLI: `--sports nba,nfl,soccer --devices 393,430,390,375 --phase before|after|<name> --shots all|failures --band`.
  - It walks the audit's screen list per sport through the real UI, with role and name selectors:
    - **Main app:** Home (top and scrolled), How to play, Missions, Gauntlet, the 4 mode tiles, Draft after a spin, Ranks, Profile, Settings.
    - **UT, first part:** UT Home, Rewards, Daily, Records, Play and every Play mode. Soccer's hidden modes are recorded as `n/a`.
    - **UT, second part:** Squad, Club Players, Filter, Card detail (scrolled top/mid/end), Tracker, Storage, Collection, Sets, Development, Evolutions.
    - **UT, third part:** SBCs, SBC detail, Standouts, Objectives, Season Pass, Store, Odds, Market.
    - **Pack opening:** tear, walkout with SKIP, the grid.
    - **Other:** a toast (tap Respin before spinning, which shows "Spin first, then you can respin." from `Draft.tsx:625`), plus an in-game frame from `?arcade&auto&sport=X`, where the HUD is portaled outside the stage.
  - A missing screen is reported, not fatal.
  - Output:
    - `O/shots/shell/<phase>/<sport>-<w>/NN-<screen>.png`
    - `report.json`, with every `auditScreen` field per screen
    - `O/shots/shell/<phase>/sheets/<sport>-<w>.png`
- `docs/BROWSER-QA.md`: a "Shell harness" section covering env vars, isolation, devices, outputs, and the fact that `display-mode` cannot be emulated.
- New `docs/studio-overhaul/shell.md`, the team doc skeleton with the BUILD-RULES sections.
- Run `--phase before` on the unchanged branch:
  - 393 with `--band` and all shots;
  - 430, 390 and 375 measurement-only.

**Tests and measurements**
- A probe `fetch('https://example.com')` from a fixture page is aborted and appears in `blocked`.
- The walker logs every attempted non-localhost host. Expected: the project's Supabase host only, which is aborted.
- Run the existing `screen-fit.mjs` once after the `browser.mjs` change. It still passes, so callers are unaffected.

**Acceptance**
- All fixtures are isolated: 0 requests reach any non-localhost host except Google Fonts.
- The before-walk covers ≥ 45 screens each for NBA and NFL and ≥ 38 for soccer at 393, with 0 page errors.
- One sport at one size takes ≤ 6 min.
- It reproduces the audit:
  - main and UT header topmost at 65–76 pt at 393, so ≥ 95% of walked screens have `inBand` > 0;
  - the card-detail bar shows content below it at 393 and not at 320;
  - `small` contains respins (~38), boosters (40) and SKIP (65×36).
- Contact sheets exist for 3 sports × 393 with the band, plus measurement reports for the other 3 sizes.

**Screenshots:** `O/shots/shell/before/**`.

**Protocol impact:** none. QA only.
**Save-compat risk:** none. Fixtures stay in inspect contexts.
**Dependencies:** none.
**Files:** `scripts/qa/browser.mjs`, `scripts/qa/edge-lib.mjs` (new), `scripts/qa/edge-walk.mjs` (new), `docs/BROWSER-QA.md`, `docs/studio-overhaul/shell.md` (new).

---

### shell-2 · P0 · Fix A (top-edge clearance) + Fix D (hygiene) + M1 (Home rebalance) + L6

**Why.** This is the systemic C1 fix.
- Every screen offsets its content by `--sat`, so moving `--sat` below the blur band clears every header, toast and SKIP at once.
- The audit requires M1 to ship together with it: NBA/NFL Home has no slack, so its content would otherwise slide under PLAY.

**Changes**
- `src/stage-layout.ts`
  - `export const EDGE_MAX = 22;`
  - `export function topEdge(insetTop: number): number { return Math.min(EDGE_MAX, Math.round(Math.max(0, insetTop) * 0.4)); }`. This gives 59 → 22, 47 → 19, 20 → 8, 0 → 0.
  - `Layout` gains `edge: number` in frame px.
  - `stageBox`, phone branch:
    - `edge = rot ? 0 : topEdge(top) / k`. In a portrait-locked rotated frame the island is on a side and the band is not at the frame top.
    - `content = Math.max(0, h - sat - edge - sab)`, the real room, used by Home and Results through `useLayout().content`.
    - **`fit = fitFor(Math.max(0, h - sat - sab))`**, computed from the raw room. Classes therefore never flip because of the edge. The 393×852 margin is 731 vs a threshold of 730, which is too thin to rely on.
  - Framed (desktop/tablet) branch: `edge = 0`.
  - `sat` stays the raw inset, so `sat * k === inset` still holds.
- `src/stage.tsx`
  - Stage style: `'--sat': (box.sat + box.edge) + 'px'`, `'--inset-top': box.sat + 'px'`, `'--edge': box.edge + 'px'`. `--sab` is unchanged.
  - In the layout effect, set root vars on `document.documentElement` from the same `readInsets()`. That function honours `window.__psInsets`. The vars are in raw screen px:
    - `--ps-inset-top`, `--ps-inset-right`, `--ps-inset-bottom`, `--ps-inset-left`
    - `--ps-edge`, which is 0 when rotated or framed
  - The `setBox` equality check includes `edge`.
  - `DEFAULT` layout gets `edge: 0`.
  - `viewportInfo()` appends ` · edge N` in screen px after `safe t/b`, so a phone shows `safe 59/34 · edge 22`.
- `src/styles.css`, the `.arcade-full` block (~7826–7833), Fix D's QA override:
  - `--sat: calc(var(--ps-inset-top, env(safe-area-inset-top, 0px)) + var(--ps-edge, 0px));`
  - `--sab`, `--sal` and `--sar` from `--ps-inset-*` with the `env()` fallback.
  - On a device these equal `env()`. In Chromium they follow `__psInsets`, so the game HUD is finally tested at the real inset.
- `index.html`:
  - Fix the stale comment: the standalone `min-height` rule lives only here, and the `styles.css` copy was removed (see `docs/CODEX-UPDATE-LOG.md`).
  - L6 description: "Spin a random NBA, NFL or soccer team and decade, draft a lineup of legends, and go for a perfect season." No "Super Bowl".
- `public/manifest.webmanifest`: the same description.
- `src/ui/Pages.tsx`, Home only (shell's allowed hunk). M1:
  - Drop the classic-mode `.under` line "1 free team respin and 1 free decade respin every draft." The How-to sheet already says it (`Pages.tsx:588`).
  - Keep the 1v1 bot chips and the daily/blind lines.
  - If NBA/NFL Home still overflows at 393/390/430 after the edge, adjust only the spacer/snug logic on the Home root's `className` line (`content < 730` → measured) and record it.
- `src/styles.css` ~11653, `.home .playbar`: clamp the PLAY shadow.
  - Replace `box-shadow: 0 -14px 18px -6px var(--bg)` with a `::before` fade at most 8 px tall and `pointer-events: none`.
  - It must never cover a content row at rest.
  - Soccer Home's dead gap (~50 px, ~28 px after the edge): let the spacer split it above and below the mode block, or grow `.hero`, via `.home:not(:has(.training-entry))`. `:has` works on Safari 15.4+.
- `src/stage-layout.test.ts`. Keep every existing assertion unchanged in meaning, and add:
  - `topEdge` values for 59/47/20/0;
  - for the 5 sizes × insets {[59,0,34,0], [47,0,34,0], [20,0,0,0], [0,0,0,0]}: `b.edge * b.k ≈ topEdge(inset)` and `b.content * b.k ≈ H − inset − edge − bottom`;
  - `b.fit` equals a hard-coded table of today's classes, computed from `fitFor(h − sat − sab)` on `acdf3e2`;
  - rotated frames → `edge 0`; framed → `edge 0`.
- `scripts/qa/screen-fit.mjs`:
  - assert topmost text/control ≥ inset + edge (screen px) on Home and UT Home at all 5 sizes, standalone and Safari;
  - add a run with `forceStandaloneRule` (docScroll ≤ 1, PLAY above the tabs);
  - add an in-game check: `?arcade&auto&sport=nba` with `__psInsets [59,0,34,0]` → `.hg2-bug` top ≥ 59 + 22 + 8 screen px.

**Measurements and targets**
- At 393×852 (59/34), edge-walk `--phase fixA` gives `inBand = 0` on Home, UT Home and all main/UT headers.
- Expected geometry from the audit's simulation: LV ring at 88–131 pt, "LEVEL" at 91–103 pt.
- PLAY bar (673–756) and tab bar (756–852) unchanged within ±1 pt.
- Minimum topmost per device: 390×844 ≥ 66 pt, 375×667 ≥ 28 pt, 430×932 ≥ 81 pt.

**Acceptance**
- `stage-layout.test.ts` is green, including the new edge and fit tests, and all 13 prior assertions still hold.
- At 393×852, every main and UT header's topmost text/control is ≥ 81 pt; the LV ring top ≥ 81; "LEVEL" ≥ 88.
- The in-game `.hg2-bug` top is ≥ inset + edge + 8 for NBA, NFL and soccer in QA (it is 8 pt today).
- Fit classes are identical to baseline on 5 sizes × 4 inset sets.
- Home in all 3 sports at 393/390/430/375:
  - no `.home-scroll` row intersects the PLAY bar or its fade at rest;
  - soccer's gap between the last row and PLAY is ≤ 24 pt.
- Settings diagnostics read `safe 59/34 · edge 22` under QA insets.
- `screen-fit.mjs` passes. These are green: `npx vitest run src/stage-layout.test.ts src/engine/sport-branches.test.ts` and the soccer `sport-branches` run.

**Screenshots:** `O/shots/shell/fixA/`:
- Home and UT Home, 3 sports at 393, with the band simulated, side by side with `before`;
- Home at 375 and 320.

**Protocol impact:** none. Layout only, and the HUD moves render-only.
**Save-compat risk:** none.
**Dependencies and announcements** (written to `shell.md`):
- Every team's screens gain 22 pt of top clearance on island phones (19 on notch phones, 8 on 20 pt status bars).
- HUD and overlay offsets must stay relative to `--sat`, never hard-coded px.
- Other teams' screenshots taken without this branch will sit 22 pt higher.

**Touched outside lane:** none beyond OWNERSHIP grants (Home hint/spacer in `Pages.tsx`, `.arcade-full` vars).
**Files:** `src/stage-layout.ts`, `src/stage.tsx`, `src/stage-layout.test.ts`, `src/styles.css`, `index.html`, `public/manifest.webmanifest`, `src/ui/Pages.tsx`, `scripts/qa/screen-fit.mjs`.

---

### shell-3 · P0 · Fix B (status plate) + Fix C (premium header plates), toasts, SKIP, header text

**Why.** Today a transparent bar sits over a gradient inside a transformed stage.
- WebKit has no solid fixed element to sample, so it draws its soft blur band.
- The owner asked for headers that look "production studio made".

**Changes**
- `index.html`: add `<div class="status-plate" aria-hidden="true"></div>` before `#root`. Inline style:
  - `position:fixed; left:0; right:0; top:0; height:env(safe-area-inset-top,0px)`
  - `background:#061820` (= `--plate-top`)
  - `z-index:2; pointer-events:none`
  - It sits above `#root`, so it is the fixed element at the edge. After Fix A no app content sits in that band.
- New `src/shell/plates.css`, imported in `src/main.tsx` right after `./styles.css`. It is shell's own cascade file for header surfaces, and no JSX changes are needed.
  - Tokens on `:root`:
    - `--plate-top: #061820`, `--plate-bot: #071d27`
    - `--plate-line: rgba(140,220,230,.14)`, `--plate-hi: rgba(255,255,255,.05)`
    - `--plate-noise`: an inline SVG `feTurbulence` data URI, ≤ 1 KB, drawn at about 4% opacity
    - `--plate-shadow: 0 10px 18px -12px rgba(0,0,0,.7)`
    - accents: teal `rgba(25,227,201,.35)` for the main app, gold `rgba(245,184,61,.35)` for UT
  - Plate look:
    - noise over `linear-gradient(180deg, var(--plate-top) 0, var(--plate-top) var(--inset-top), var(--plate-bot) 100%)`;
    - a 1 px hairline plus a centred 1 px accent highlight (`linear-gradient(90deg, transparent, accent, transparent)`);
    - the drop shadow for depth.
  - Not a flat grey strip, and no `backdrop-filter`, which is costly on iOS.
  - Targets:
    - `.shell-top` (main TopBar; it already starts at y = 0) gets the plate on itself.
    - `.topbar` outside `.shell-top` (UT `.ut-top`, Results, Gauntlet, UT Match `.topbar.ut-top`) gets a `::before` plate with `top: calc(-1 * var(--sat))` and `z-index: -1`. `.ut-top` is already `position:relative; z-index:2`. UT keeps a gold tint below the inset.
    - `.draft-head` (Draft, Search), `.po-head` (Playoffs), `.vote-head` and `.evo-top` (Training) get the same `::before` plate. The engineer confirms each starts at `--sat`; any that doesn't is skipped and reported.
  - Immersive screens get no plate, only Fix A clearance: pack opening `.ut-open-screen`, splash, Welcome, the season reveal and the arena.
  - Game HUD: a top scrim `.arcade-full::after` from y = 0 to `var(--sat)`, using `linear-gradient(#0b0f19 70%, transparent)`, `pointer-events:none`, below the score bug.
    - Check the z-order in `hg2`, `fb2` and `sc2`. The score bug stays crisp.
    - If a sport's HUD stacking makes this unsafe, skip it for that sport and report it to the owner team.
- `src/styles.css`:
  - Toast (~3498–3510) stays at `top: calc(var(--sat) + 6px)`, which is now below the band. Make its background opaque with the plate hairline. Apply the same to any other toast class found by `grep toast`.
  - `.ut-skip` (~9874) stays at `top: calc(var(--sat) + 12px)`, now below the band; its size is fixed in shell-4.
  - L2: the `.level` ring "LV" label goes from 8 to 10 px. Check the ring still fits 44 px.

**Measurements and targets**
- The edge-walk plate probe on every header screen: `elementFromPoint` at y = 2, y = sat + edge − 2 and y = header bottom − 2, at x = 20/195/370, resolves to the header (or its `::before`), and the computed background is opaque.
- Scroll Club Players and SBCs: the header region stays plate-coloured, so content passes under the plate.
- Header texts have contrast ≥ 4.5:1 on `--plate-bot`.

**Acceptance**
- Every listed header has an opaque surface from y = 0 to its bottom hairline.
- The hairline y equals the first content row's top ±1 pt, so the plate eats no layout.
- No header text in `lowContrast`.
- `.status-plate` is in the DOM at y = 0, height = inset, `#061820`.
- In Chromium, the Fix A + B + C top band differs from Fix A alone by ≤ 2% mean luminance. The real effect of B is a device check.
- `plates.css` ≤ 3 KB gzip; no raster images.
- Reduced motion: no new animations.

**Screenshots** (`O/shots/shell/plates/`, before and after):
- Home, UT Home, Draft, Results, Playoffs, Training, UT Match result, a toast, pack SKIP and the in-game HUD, for 3 sports at 393, plain and with the band;
- DSF 3 crops of the top 140 pt of Home and UT Home, to compare with the owner's photo.

**Protocol impact:** none.
**Save-compat risk:** none.
**Dependencies:**
- `ut`, `packs` and the sport teams keep these class names: `.topbar`, `.ut-top`, `.shell-top`, `.draft-head`, `.po-head`, `.vote-head`, `.evo-top`, `.arcade-full`, `.ut-skip`.
- They add no competing top backgrounds. Listed in `shell.md`.

**Touched outside lane:**
- `plates.css` targets other teams' classes from shell's own file.
- No edits to their files.

**Files:** `index.html`, `src/main.tsx`, `src/shell/plates.css` (new), `src/styles.css`.

---

### shell-4 · P0 · H1 card-detail bar, M6 small targets, full-matrix verification and contact sheets

**Why.**
- H1 is the most-seen card screen after every pull, and its main actions float over content on every notch or island phone.
- M6 lists the taps still under 44.
- The brief requires every screen of all three sports to be verified at 4 sizes once Fixes A–C are in.

**Changes**
- H1, `src/ut/nav.css` ~1119–1127 (shell's granted hunk), `.ut-detail-btns`:
  - `bottom: calc(-18px - var(--sab, 0px))`
  - `margin: 2px -18px calc(-18px - var(--sab, 0px))`
  - `padding: 12px 18px calc(16px + var(--sab, 0px))`
  - `background: linear-gradient(180deg, rgba(10,31,42,0), var(--panel) 28%, var(--panel))`

  This compensates the whole `.sheet.bottom` padding-bottom of `calc(18px + var(--sab))` (`styles.css` ~3374–3375), so the bar sits flush with the sheet's bottom edge.

  Then grep every `position: sticky` with a negative `bottom` in all CSS. `.ut-cta-bar` (`nav.css:294`) is used only on the `LeagueSeason` page, not in a sheet; verify that. Fix any in-sheet case the same way and list it.
- M6: new `src/shell/targets.css`, imported in `src/main.tsx` after `plates.css`.
  - Rules for lazily loaded UT/pack CSS get one extra class of specificity, so they win when that CSS is injected later.
  - Draft `.respin` (38, 36 at tight) and `.boost` (40): a `::before` hit area to ≥ 44 (`inset: -4px -1px`, adjusted by measurement). The visuals are unchanged, matching the pattern at `styles.css:11826–11846`.
  - `.ut-open-screen .ut-skip` (65×36): `min-height: 44px; min-width: 64px`, with the pill visual kept through inner padding or a `::before`.
  - `.ut-open-screen .ut-dupes-bar .btn` (QUICK SELL DUPES, 133×34): `min-height: 44px`.
  - The pack TAP TO CONTINUE button (224×42 at 320): `min-height: 44px`.
  - `.ut-season-chip` on UT Home (141×41): a `::before` to 44.
- Full-matrix verification: `edge-walk.mjs --phase after-layout`.
  - 3 sports × {393, 430, 390, 375}, plus 320 regression.
  - `--band` with all shots at 393; failure shots elsewhere.
  - Fix in-lane stragglers: stage, shell CSS, toasts, SKIP, sheet offsets, plates.
  - Record out-of-lane violations in `shell.md` (owner team, selector, measured y) and tell owners via the doc.

**Acceptance**
- H1 at 393×852 and 390×844 (sab 34) for NBA, NFL and soccer:
  - bar bottom = sheet bottom ±1 pt at scroll top, mid and end;
  - `elementFromPoint` 4 pt above the sheet's bottom edge hits the bar;
  - the buttons' bottom is ≤ H − 34;
  - no stat text or "ALL 6 ATTRIBUTES" is visible below the bar.
- At 320×568 (sab 0) the bar region matches baseline pixels within 1% (no regression).
- M6: the edge-walk `small` list has none of respins, boosters, SKIP, QUICK SELL DUPES, TAP TO CONTINUE or season chip at 393 and 320. `overlap` reports 0 new intersecting hit areas.
- Matrix, every walked screen of all three sports at all 4 sizes:
  - `inBand = 0`, including toasts, SKIP and in-game HUD;
  - `bottomCut = 0`: PLAY bar, tab bars and sticky CTAs above `H − sab`;
  - `docScroll`, `hOverflow` and `offscreen` all 0;
  - 0 page errors.
- Every exception is listed with an owner.
- Contact sheets exist: `O/shots/shell/after/sheets/<sport>-<size>.png` for 3 × 4, next to `before/`.

**Protocol impact:** none.
**Save-compat risk:** none.
**Dependencies:** `packs` and `ut` keep these class names: `.ut-skip`, `.ut-dupes-bar`, the pack continue button's class, `.ut-season-chip`, `.ut-detail-btns`.
**Touched outside lane:** `src/ut/nav.css`, H1 rule only (granted in OWNERSHIP).
**Files:** `src/ut/nav.css`, `src/shell/targets.css` (new), `src/main.tsx`, `src/styles.css` (only if a straggler is in a shell-granted rule), `docs/studio-overhaul/shell.md`.

---

### shell-5 · P0 · M8 Reset Progress danger zone + M9 branded arena curtain

**Why.**
- RESET PROGRESS is one confirm away and styled like any other button. It erases the UT club in every sport (`App.tsx:1212` and `resetOtherSport`).
- About 1.2 s of black or empty court follows PLAY with no indicator.

**Changes, M8**
- New `src/shell/danger.ts`, pure functions:
  - `canErase(text) = text.trim().toUpperCase() === 'ERASE'`
  - `cloudLine(status: CloudStatus | null, now: number): string`, giving one of:
    - "Cloud save: saved 3 min ago"
    - "Cloud save: waiting to save"
    - "Cloud save: offline, last saved …"
    - "Cloud save isn't set up on this phone"
- New `src/shell/DangerZone.tsx` and `src/shell/danger-zone.css`:
  - An "Advanced" disclosure: a 44 px button with an SVG chevron and `aria-expanded`.
  - It opens a panel styled apart: red-tinted surface `rgba(229,72,77,.07)`, 1 px `#e5484d66` border, an SVG warning icon, and the title "ERASE ALL PROGRESS".
  - An explicit list of what is erased and what stays. The engineer writes the copy only after reading `onReset` and `resetOtherSport`; the expected copy is "coins, level and XP, Ultimate Team clubs, cards, packs and squads, draft history and boosters in all three sports; your name and leaderboard entries stay".
  - A live cloud line, from read-only use of `cloudStatus()`, `subscribeCloud()` and `syncCloudNow()` in `src/lib/cloud-save.ts`. SAVE NOW shows when not saved. State whether the erased profile will then be cloud-saved, verified in `cloud-save.ts` before writing it.
  - A text input "Type ERASE to confirm": 16 px font, `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck=false`.
  - KEEP MY PROGRESS: primary, receives focus.
  - ERASE EVERYTHING: danger style, `aria-disabled` and a no-op until `canErase`. When enabled it calls the unchanged `onReset`.
- `src/ui/Pages.tsx` `SettingsSheet` (shell's granted Reset hunk): replace the `confirm` / RESET PROGRESS block with `<DangerZone onErase={() => close(props.onReset)} />`, placed last, after the diagnostics.
- Test: new `src/shell/danger.test.ts`.

**Changes, M9**
- New `src/shell/arena.ts`:
  - `arenaActive(): boolean` and `useArenaActive()`, a ref-count of mounted `Arcade` components;
  - `arenaReady()`, which dispatches `ps:arena-ready`;
  - `onArenaReady(cb)`.
- New `src/shell/ArenaCurtain.tsx` and `src/shell/arena-curtain.css`.
  - Portaled to `document.body`, at z 60, above `.arcade-full` (z 50).
  - Laid out on the 390 frame, honouring `--ps-inset-*` and the edge.
  - Content:
    - a sport mark SVG;
    - "YOU" vs rival name;
    - two shield crests drawn in CSS/SVG from the `kits` colours when given (original art, no logos);
    - optional OVRs and mode label props;
    - one tip from new `src/shell/arena-tips.ts`. It uses `pick({ nba: [...], nfl: [...], soccer: [...] })` with 4–6 tips per sport checked against current controls, chosen by a hash of the seed. Sport teams review the tip lines through `shell.md`.
    - an indeterminate shimmer bar, static under reduced motion.
  - The curtain lifts on either:
    - `ps:arena-ready`; or
    - a `.arcade-full canvas` being mounted **and** `loadClip('ready')` resolved (read-only use of `src/game/pixel/mocap.ts`, which also starts the mocap chunk), then 2 rAFs.
  - It always lifts by 2,500 ms after mount.
  - Minimum on-screen time is 350 ms once shown (no flash). Fade is 200 ms, or 0 under reduced motion.
  - It does not own `arenaActive`. That count is held by `useArenaActive()` (in `arena.ts`) for the whole lifetime of the `Arcade` component, through the hook below, so it stays true after the curtain lifts and until the match unmounts.
- `src/game/Arcade.tsx` (nba/nfl shared; small hook): one import, one `useArenaActive()` call at the top of `Arcade`, plus a helper `withCurtain(el)` that renders `<>{el}<ArenaCurtain …/></>`. It wraps the `Soccer2`, `Hoops2` and `Football2` returns. About 10 lines.
- `src/App.tsx`: the Arcade `Suspense` fallback becomes `<ArenaCurtain …/>` (1 line), so the look is the same from the tap through the chunk load to the first frame.
- UT matches reach this through `Match.tsx` → `Arcade` with no edit to `Match.tsx`.
- Optional precise hook, documented for the nba/nfl/soccer/players teams: call `arenaReady()` after the first frame drawn with mocap loaded.

**Measurements**
- At 393, for NBA, NFL and soccer, draft vs AI and one UT Squad Battle: screenshot every 100 ms from the PLAY tap until gameplay.
- A frame is "empty" when there is no curtain element and the stage luminance variance is below a threshold calibrated on the audit's `match-*-01-pre.png`.
- 5 runs per sport for curtain duration p50/p95.

**Acceptance, M8**
- Unit tests are green.
- QA (`scripts/qa/settings-danger.mjs`, new, isolated):
  - Settings → Advanced opens the panel.
  - ERASE EVERYTHING is disabled until "erase" is typed.
  - KEEP MY PROGRESS closes with coins, `ut.owned`, levels and XP deep-equal to before (`current()`).
  - All targets ≥ 44.
  - With a 310 px visual viewport (keyboard), the input and both buttons stay visible.
  - QA never performs the erase.

**Acceptance, M9**
- 0 empty frames between tap and gameplay in all 3 sports.
- Curtain on screen p95 ≤ 2.5 s.
- Under reduced motion, `animation-name` is `none` on the shimmer.
- Curtain text ≥ 10 px and inside the safe area.
- `arenaActive()` is true for the whole match, tested with a mounted-count unit test.

**Screenshots:** `O/shots/shell/danger/` (collapsed, open, typed, keyboard) and `O/shots/shell/curtain/` (3 sports, normal and reduced motion).

**Protocol impact:**
- None. The curtain is an overlay.
- The match starts and runs exactly as before. The engine clock is untouched, and the curtain draws nothing into the sim.
- If any engine starts its clock before the first frame, the curtain only covers that time. It never pauses the sim.

**Save-compat risk:** none. The reset handler and its kept fields are unchanged; this only adds friction.

**Dependencies:**
- `nba`/`nfl` own `Arcade.tsx`; the hook is ≤ 10 lines.
- `ut` owns parts of `App.tsx`; 1 line.
- `players` owns `mocap.ts`; read-only use.
- The sport teams optionally add `arenaReady()`.

**Touched outside lane:** `src/game/Arcade.tsx`, `src/App.tsx`.
**Files:** `src/shell/danger.ts`, `src/shell/danger.test.ts`, `src/shell/DangerZone.tsx`, `src/shell/danger-zone.css`, `src/shell/arena.ts`, `src/shell/arena-tips.ts`, `src/shell/ArenaCurtain.tsx`, `src/shell/arena-curtain.css`, `src/ui/Pages.tsx`, `src/game/Arcade.tsx`, `src/App.tsx`, `scripts/qa/settings-danger.mjs`.

---

### shell-6 · P0 · UT data pipeline: JSON parse, fetch-as-JSON, sliced expand, unclamped yields (P-1 part 1, P-5)

**Why.** The profiling shows where the time goes:
- The single biggest cost and the 385–669 ms long tasks come from evaluating 2.9–3.7 MB JS-literal modules.
- `expandCards` is one 150–280 ms synchronous call at 1×, which is 600–1,100 ms at 4×.
- `buildPoolInSlices` yields with `setTimeout(0)`, which is clamped to ≥ 4 ms after nesting. That adds about 350 slices × 4 ms of idle time at 4×.

**Changes**
- `vite.config.ts`: `json: { stringify: true }`. Every JSON module becomes `export default JSON.parse("…")`.
  - Safe because every consumer uses `default`, checked by grep: `cards.ts`, `numbered-sync.ts`, `calendar.ts`, `calibration.ts`, `specials.ts`, `sport-raw*.ts`, `soccer-raw.ts`, `game/attrs.ts`, `pixel/mocap.ts`, `ut/registry.ts`, `soccer2/Lab.tsx`.
  - This also speeds the startup draft data (`nba.json` 1.5 MB is top-level-awaited) and the attrs files.
- New `src/ut/cards-load.ts` (shell):
  - `loadCardsFile(sport): Promise<CardsFile>` and `loadReferences(sport): Promise<SeasonReferences | undefined>`.
  - Browser path: `import.meta.glob(['../data/cards-*.json', '../data/season-references-*.json'], { query: '?url', import: 'default', eager: true })`, then `fetch(url).then(r => r.ok ? r.json() : Promise.reject(...))`. The parsed source objects are no longer pinned by the module cache, so they can be collected after expand.
  - Node/vitest/vite-node and the artifact build keep the module path in a sibling `src/ut/cards-load.module.ts`, selected by:
    - the existing artifact alias list in `vite.config.ts` (add `{ find: /^\.\/cards-load$/, … }`);
    - a vitest `test.alias`;
    - for vite-node scripts, a `typeof document === 'undefined'` dynamic import inside `cards-load.ts`. Its JSON must not be emitted in the production build.
  - **Decision rule:** if `dist` contains any card or reference file twice (once as a `.json` asset and once as a JS chunk) and that can't be removed cleanly, fall back to module imports with `stringify` only, and record the heap.
- `src/ut/cards.ts` (UT loading path, shell):
  - `loadCards` uses `cards-load`. `soccer-lazy.ts` `loadSoccerCards` gets the same fetch path.
  - New `expandCardsAsync(f, refs, yieldNow)` shares one inner implementation with `expandCards`, so the output is identical. It yields every 8 ms inside the seasons loop and between the promos/legends/`specialEditions` stages.
  - `expandCards` stays for scripts and tests.
- New `src/shell/yield.ts`:
  - `yieldToMain()`: `scheduler.yield` when present, else a `MessageChannel` postMessage. No 4 ms clamp.
  - `nextFrameSlice()`: rAF, then `MessageChannel`. Used for background work in shell-7.
- `src/ut/pool.ts`, loading paths only (`packs` owns buckets, `CONTENT_PRINT` and the print formula, and they are untouched):
  - `buildPoolInSlices` uses `yieldToMain` with an 8 ms budget.
  - Add `poolProgress(): { phase: 'fetch' | 'expand' | 'rate' | 'done'; done: number; total: number }` and `onPoolProgress(cb): () => void`.
  - The `getPool()` signature and caching are unchanged.
- `vite.config.ts` `pwa()`: classify the new `.json` assets by name (Rollup 4 `names` / `originalFileNames`). `cards-*.json` stay on demand, and references stay as today until shell-8.
- `src/lib/update.ts`: the warmer regex also takes `.json` under `/assets/`.
- New `scripts/qa/perf-ut.mjs`: an isolated port of `coldstart.cjs` phase C.
  - Production build via `PS_QA_BUILD_ROOT` and `vite preview`.
  - Tap → UT ready, long tasks, heap after GC (CDP), decoded JS/JSON bytes.
  - At 1× and 4×, N = 3, median.

**Tests**
- New `src/ut/pool-load.test.ts`, run under NBA and `PS_SPORT=nfl`:
  - `expandCardsAsync` deep-equals `expandCards`: ids, order and every field;
  - a pool built from the async path has the same `print` as the sync path;
  - `getPool()` print equals the value recorded on `acdf3e2` with `loadSchedule()`. Record it before the change by running the test once on the base commit.
- New `src/ut/pool-load-soccer.test.ts`: the same for soccer, picked up by the soccer filter.
- The UT suites (`npx vitest run src/ut`, `PS_SPORT=nfl npx vitest run src/ut`) and the soccer run stay green.

**Acceptance** (`perf-ut.mjs`; before = §3)
- Longest task during UT open ≤ **200 ms** at 4× in all sports (from 385/669/431).
- Tap → UT ready, cold (no rated cache yet):
  - 1×: ≤ 1,500 ms NBA/NFL, ≤ 400 ms soccer;
  - 4×: ≤ 6,000 ms NBA/NFL (from 7,395/8,974), ≤ 1,000 ms soccer (from 1,834).
  - The < 2.5 s target is reached in shell-7.
- Heap after UT open (CDP after GC) is ≥ 8 MB lower per sport than §3; record the real values.
- `dist`:
  - each card/reference file appears exactly once;
  - no card data is a JS object literal (`.json` asset or `JSON.parse(` chunk);
  - the artifact build config still resolves; it is not built here, which is noted for the lead.
- `pool.print` is unchanged for all 3 sports, and the UT tests are green.

**Protocol impact:**
- None. `pool.print` is the UT queue guard and must be identical, which is tested.
- No ratings or card ids change.

**Save-compat risk:** none. No profile fields change.
**Dependencies:**
- `packs` edits `pool.ts` content in parallel, so keep hunks inside `buildPoolInSlices`/`getPool` and the new exports.
- `players`' mocap JSON also goes through `stringify` (default export only, verified).

**Files:** `vite.config.ts`, `src/ut/cards.ts`, `src/ut/cards-load.ts` (new), `src/ut/cards-load.module.ts` (new), `src/soccer-lazy.ts`, `src/ut/pool.ts`, `src/shell/yield.ts` (new), `src/lib/update.ts`, `src/ut/pool-load.test.ts` (new), `src/ut/pool-load-soccer.test.ts` (new), `scripts/qa/perf-ut.mjs` (new).

---

### shell-7 · P0 · Rated-pool cache per build, Home-idle prefetch, UT skeleton (P-1 part 2)

**Why.** Rating 22–32k lines costs about 1.1 s at 1× and 4.2–4.4 s at 4× on every session. It is deterministic for a given build: no date, profile or random input.
- Caching it per build removes the work from every UT open after the first on that build.
- Prefetching on Home idle hides the first one.
- The brief also asks for a skeleton instead of a spinner.

**Why not precompute at build time:** four teams change rating code in parallel. A precomputed file would go stale against `pool.print`. A runtime cache keyed by `APP_VERSION` can never be stale.

**Changes**
- New `src/ut/pool-cache.ts` (shell):
  - `cacheKey(sport, lines) = [APP_VERSION, sport, CONTENT_PRINT, schedule()?.version ?? '', lines.length].join('|')`.
  - Disabled when `APP_VERSION === 'dev'`, unless `enablePoolCacheForTests()` is called.
  - Storage is **Cache Storage** `ps-pool`. It is not localStorage, not a save, and not in cloud saves.
    - Entries: `./__pool/<sport>/meta.json` holds `{ v: 1, key, n, chunks, print, dict }`.
    - Chunks: `./__pool/<sport>/<i>.json`, 2,500 cards each.
    - Writing a new key deletes the older entries.
  - Per-card encoding, columnar per chunk:
    - `id`: the order is verified on read;
    - `ovr`, `rawOvr`, `rawExact` (exact number);
    - `tier` and `pos` as dictionary indices;
    - `attrs` as a code-set index plus values;
    - `key` and `face` as code index plus value, with names from `dict`;
    - `abil` as dictionary indices;
    - `ratingSource` as a dictionary index.
  - The field list mirrors `RatedCard` (`types.ts:116-135`). The equality test compares **all own keys**, so a field another team adds later fails the test instead of silently dropping.
  - `writePoolCache(pool)` runs after the pool is handed to the UI, in `nextFrameSlice` slices of ≤ 6 ms, and is skipped while `arenaActive()`.
  - `readPoolCache(sport, lines, byId)` returns a `Map<id, RatedCard>` rebuilt in 8 ms slices with `line` reattached from `byId`. Any key, `n` or id-order mismatch returns `null`.
- `src/ut/pool.ts`, loading paths only:
  - `poolBuilder` gains `addRated(l, rc)`. It runs the same bucket and print code without `rateCard`, so the print is computed by the same lines of code.
  - `getPool()`: after expand, try `readPoolCache`.
    - On a hit, build with `addRated` and compare the computed print to `meta.print`. A mismatch discards the cache and rates normally.
    - On a miss, rate as in shell-6, then `writePoolCache`.
  - `getPool({ background: true })` builds with `nextFrameSlice`. A later plain `getPool()` upgrades the same in-flight build to `yieldToMain`; it is one shared promise.
- New `src/ut/pool-prefetch.ts`: `usePoolPrefetch(enabled: boolean)`. After Home has been visible for 2 s, it calls `getPool({ background: true })` when all of these hold:
  - `enabled` (the caller passes `screen === 'tab' && profile.ut.owned.length > 0`);
  - `document.visibilityState === 'visible'`;
  - `!arenaActive()`;
  - not `navigator.connection?.saveData`.

  It pauses while `arenaActive()`.
- `src/App.tsx` (small hooks):
  - one line `usePoolPrefetch(...)`;
  - the UT `Suspense` fallback becomes `<UtSkeleton/>` (1 line).
- `src/ut/UltimateTeam.tsx` (small hooks):
  - the `!pool` branch becomes `<UtSkeleton progress />`;
  - the `failed` branch becomes `<UtLoadError onRetry={load} />`;
  - 2 lines, ~1272–1287.
- New `src/shell/UtSkeleton.tsx` and `src/shell/ut-skeleton.css`:
  - the UT header plate (shell-3) with the sport's title;
  - four shimmering blocks shaped like a generic hub (hero card, rewards row, two tiles) and the UT tab bar outline;
  - a determinate bar plus "Preparing your club · 64%" from `onPoolProgress`, or indeterminate when unknown;
  - reduced motion: static, no shimmer.
- `UtLoadError`, offline-aware:
  - offline (`!navigator.onLine`): "You're offline. Ultimate Team needs one online visit after each update.";
  - otherwise the existing copy;
  - RETRY at 44 px.
  - Kept generic so it doesn't contradict `ut`'s parallel hub redesign.

**Tests**
- New `src/ut/pool-cache.test.ts` (NBA, `PS_SPORT=nfl`) and `src/ut/pool-cache-soccer.test.ts`. They use an in-memory fake Cache Storage and check:
  - write → read → every `RatedCard` deep-equal on all own keys, with `rc.line === byId.get(id)`;
  - buckets have identical membership and order;
  - print is identical;
  - a wrong key, a truncated chunk or a reordered id gives `null` and falls back;
  - prefetch does not start, or stops slicing, while `arenaActive()` (fake timers).

**Acceptance** (`perf-ut.mjs`, with phases cold / warm = second page load on the same build / prefetch = 8 s idle on Home)
- **Warm**, tap → UT ready:
  - 4×: ≤ **2,500 ms** for NBA and NFL (from 7,395 / 8,974), ≤ 800 ms soccer;
  - 1×: ≤ 900 ms.
- **Prefetch**: ≤ 600 ms at 1×, ≤ 1,500 ms at 4×.
- Longest task ≤ 200 ms in every phase.
- During Home-idle prefetch at 4×:
  - no long task > 50 ms;
  - a tap on a mode tile paints in ≤ 100 ms at 1×.
- 0 prefetch or cache-write slices while `.arcade-full` is mounted (instrumented counter).
- Cache size recorded per sport (expected 2–6 MB). After a version change, exactly 1 key per sport remains.
- The skeleton appears in the first frame after the UT tap (no blank frame). Screenshots at 393 for 3 sports, normal and reduced motion.
- `pool.print` unchanged; UT tests green.

**Protocol impact:** none. The cached path produces the identical pool, guarded by the print test.

**Save-compat risk:**
- None to saves.
- New Cache Storage name `ps-pool`, disposable. It is not deleted by the worker, whose `activate` only removes `ps-app-*`.

**Dependencies:**
- `ut` owns `UltimateTeam.tsx` and the `App.tsx` UT bridge; 3 one-line hooks.
- `packs` keeps `RatedCard` fields additive. The test flags new fields.

**Touched outside lane:** `src/App.tsx`, `src/ut/UltimateTeam.tsx`.
**Files:** `src/ut/pool-cache.ts` (new), `src/ut/pool-prefetch.ts` (new), `src/ut/pool.ts`, `src/shell/UtSkeleton.tsx` (new), `src/shell/ut-skeleton.css` (new), `src/App.tsx`, `src/ut/UltimateTeam.tsx`, `src/ut/pool-cache.test.ts` (new), `src/ut/pool-cache-soccer.test.ts` (new), `scripts/qa/perf-ut.mjs`.

---

### shell-8 · P0 · Offline UT: per-sport precache groups, carry-over on update, soccer offline boot (P-2)

**Why.**
- Card files are cached only after being fetched online **on the current build**. The new worker's `activate` deletes the old cache, so every deploy makes UT online-only again, even for files whose hashed names didn't change.
- Every player installs 3.2 MB of references they may never use.
- An offline first visit to soccer rejects the top-level-await data import inside `App`'s static import graph, so nothing renders.

**Changes**
- `vite.config.ts` `pwa()`: build `GROUPS` from Rollup `moduleIds` and asset names:
  - `ut:nba` = cards-nba, season-references-nba, numbered-nba
  - `ut:nfl` = cards-nfl, season-references-nfl, numbered-nfl, nfl-combine
  - `ut:soccer` = cards-soccer
  - `sport:soccer` = `game/soccer2/**` chunks, `pixel/pitch.ts`, `data/soccer.json`, `soccer-*.mp3`

  `PRECACHE` is everything else:
  - the shell and every UI chunk, including UT UI;
  - **both NBA/NFL draft datasets and both attrs files**, kept by the Codex and Claude review rules;
  - the calendar files;
  - icons and the manifest;
  - fonts (shell-9).

  Inject `__GROUPS__` into `sw.js`, and log precache bytes and per-group bytes in the build output.
- `pwa/sw.js`:
  - `message` `{ type: 'ps-warm', groups: string[] }` → `event.waitUntil(warm(groups))`. For each URL:
    - already in `CACHE` → skip;
    - in an older `ps-app-*` cache → copy it;
    - else `fetch` and `put` (ok responses only).

    Record the group names in cache `ps-meta`, entry `./__groups.json`.
  - `activate`: **before** deleting old `ps-app-*` caches, carry over every URL that belongs to a recorded group or to `PRECACHE` and exists in an old cache under the same hashed name. Unchanged files are never re-downloaded. Then delete the old caches and `clients.claim()`.
  - Keep `version.json`/`sw.js` bypass, `cacheFirst` and font SWR unchanged.
- `src/lib/update.ts`: after `ready` and the existing warm, `warmGroups()` posts `ps-warm` with:
  - `sport:soccer` when this page is soccer or a soccer profile exists;
  - `ut:<s>` for every sport whose profile shows `ut.owned.length > 0`, read-only from the existing keys `perfect-season:profile:v1`, `perfect-season:profile:nfl:v1`, `perfect-season:profile:soccer:v1`. The current sport goes first; others after 10 s.

  It is skipped under `navigator.connection?.saveData`, and deferred while `arenaActive()`. It repeats on each launch, which costs nothing when cached.
- `src/main.tsx`: load `App` lazily:
  - `React.lazy(() => import('./App').catch(bootFailure))`;
  - offline, `bootFailure` resolves to new `src/shell/OfflineBoot.tsx`;
  - online, it calls `reloadForMissingFiles()` and shows a Reload screen.
  - The splash stays until `App` resolves; shell-9 retunes the timing.
- `OfflineBoot`:
  - plate-styled;
  - copy: "Soccer isn't downloaded on this phone yet. Connect to the internet once to play it offline.";
  - PLAY NBA / PLAY NFL buttons write the existing `perfect-season:sport` key with a valid value (exactly what `SportSwitch` does) and reload;
  - TRY AGAIN.
- `UtLoadError` (shell-7) already gives the offline-aware UT copy.

**Tests**
- New `src/lib/sw.test.ts`. It evaluates `pwa/sw.js`, with placeholders filled, in `node:vm` with fake `self`, `caches`, `fetch` and `clients`:
  - install caches exactly `PRECACHE` and no group URL;
  - `ps-warm` caches exactly the group URLs and records the group;
  - `activate` after a version change copies unchanged group files from the old cache with 0 fetches, and deletes old caches;
  - a changed file is fetched on the next warm;
  - a navigation with a network error gets the cached page;
  - `version.json` and `sw.js` are never cached.
- `scripts/qa/startup.mjs` extended (production build, isolated):
  - **(a)** Per sport with a UT fixture: online Home → wait until every `ut:<sport>` URL is cached → offline → reload → open UT → `.ut-tabs` visible, no "didn't load".
  - **(b)** Update without a rebuild: serve a copy of the build with the `sw.js` VERSION and `version.json` patched.
    - Reload online on NBA only, then go offline and open NFL UT (opened before the "update"). It must work.
    - Auto-update: the app reloads into the patched version on Home and toasts "Updated to the latest version."
  - **(c)** Fresh context, NBA visited online only, then offline `?sport=soccer` → `OfflineBoot` within 2 s, 0 page errors. PLAY NBA returns to NBA Home offline.

**Acceptance**
- UT offline works for **3/3** sports opened online before (from 0/3), including a sport not reopened since an update.
- An offline first visit to soccer shows `OfflineBoot`, not a blank screen. 0 page errors.
- Install precache:
  - ≤ **8.3 MB** (from 11.5 MB);
  - contains no cards/season-references/numbered/combine files;
  - a soccer-only player downloads 0 NBA/NFL UT bytes.
- 0 re-downloads of unchanged group files after a version change (`sw.test` plus the `startup.mjs` request log).
- Auto-update still applies on the next menu visit (b).
- Warm relaunch to Home is no worse than baseline +50 ms (the lazy `App` must not regress; measured again in shell-9).

**Protocol impact:** none.

**Save-compat risk:**
- No profile writes. `OfflineBoot` writes `perfect-season:sport` only with a valid value, exactly as the sport switcher does.
- New cache `ps-meta`.
- The `ps-app-<version>` naming is kept, so old workers' caches clean up as before.

**Dependencies:**
- lead: the integrated build must re-check the precache list.
- `soccer`: their lazy chunk paths must stay under `game/soccer2/` for the group regex; told via `shell.md`.

**Files:** `vite.config.ts`, `pwa/sw.js`, `src/lib/update.ts`, `src/main.tsx`, `src/shell/OfflineBoot.tsx` (new), `src/lib/sw.test.ts` (new), `scripts/qa/startup.mjs`.

---

### shell-9 · P0 · Launch path: splash floor, self-hosted fonts, fast offline relaunch, one mocap chunk (P-3, P-5)

**Why.** Every launch pays a fixed splash floor of ≥ 1.15 s:
- `fontsReady` waits up to 2.2 s;
- then a 700 ms minimum;
- then a 450 ms fade.

On top of that:
- The first launch waits on a render-blocking third-party font stylesheet.
- Offline relaunch takes 3.9 s.
- Mocap arrives as 15–26 separate requests after the renderer starts, so stand-in poses pop.

**Changes**
- **Root cause first.** New `scripts/qa/perf-startup.mjs`, an isolated port of `coldstart.cjs` phases A and B. It records:
  - navigation TTFB (`responseStart`);
  - `App`-module-ready, `fontsReady` duration and splash-out time;
  - for cold, warm and offline runs, per sport.

  Record whether the offline 3.9 s is the worker's 3,500 ms page timer or something else (the splash/fonts chain).
- `pwa/sw.js` `page()`:
  - stays network-first, because auto-update depends on it;
  - `NAV_TIMEOUT = 1000` (from 3,500);
  - uses `event.preloadResponse` with navigation preload enabled in `activate`;
  - a fetch rejection serves the cached page immediately.
- `src/main.tsx` `Root`:
  - drop the 700 ms floor;
  - `ready` = `App` resolved **and** fonts ready. The fonts wait is ≤ 1,000 ms on a first launch and 0 when `document.fonts.check('italic 900 48px Archivo')` already passes;
  - the ball spins only if not ready within 250 ms;
  - fade 180 ms, or 0 under reduced motion.
- `src/styles.css` `.splash`: the transition goes from 0.45 s to 0.18 s (small hunk).
- **Fonts, self-hosted.**
  - Archivo is SIL OFL 1.1 from Google Fonts. Use the variable woff2 files for **latin + latin-ext** (player names such as Jokić and Dončić need latin-ext), roman and italic, wdth 62–125, wght 400–900.
  - Put them in `public/fonts/archivo-*.woff2`, with `public/fonts/OFL.txt`.
  - New `src/shell/fonts.css`, imported first in `main.tsx`: `@font-face` with `font-display: swap` and `unicode-range`.
  - Add `'Archivo Fallback'` (`src: local('Arial')`, with `size-adjust`/`ascent-override`/`descent-override` tuned so a 14 px body line box matches within 1 px). Append it to the `:root` font stacks in `styles.css` (small hunk).
  - `index.html`: remove the Google Fonts preconnects and stylesheet; add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the two latin files.
  - `vite.config.ts`: add the font files to the precache shell list.
  - `docs/CREDITS.md`: font credit.
  - Budget ≤ 260 KB total.
  - **Fallback:** if the font files can't be fetched in this environment, keep Google Fonts but non-blocking (`rel=preload as=style` with an onload swap) plus the worker's font cache, and record it.
- `vite.config.ts` (non-artifact only): `build.rollupOptions.output.manualChunks` puts `src/data/mocap/*.json` (not `index.json`) into one `mocap` chunk, about 164 KB of source.
  - No code change in `mocap.ts` (`players`).
  - The `ArenaCurtain` (shell-5) `loadClip('ready')` call fetches it in parallel with the match chunk.

**Acceptance** (`perf-startup.mjs` and the `perf-match.mjs` load phase, production build, isolated, 390×844 DSF 3 as in the audit)
- Warm relaunch: Home tab bar ≤ **700 ms** (from 927–1,027); splash fully gone ≤ 900 ms (from ≈ 1,400).
- **Offline relaunch to Home ≤ 1,500 ms** in all 3 sports (from 3,942–3,974).
- Cold first visit at 4× CPU + 4G, NBA:
  - welcome interactive ≤ 2,100 ms (from 2,612);
  - FCP ≤ 1,200 ms (from 1,572);
  - longest task ≤ 150 ms (from 295).
- 0 requests to third-party font hosts. An offline first launch after install renders Archivo from the precache.
- Mocap:
  - 1 clip request per match (from 15–26);
  - clips loaded by first frame + 50 ms (from +136 ms);
  - every other lazy chunk unchanged (manifest check: Arcade, soccer and admin chunks are still dynamic).
- `startup.mjs` (a–c from shell-8) still green, including auto-update.

**Protocol impact:** none. Clip data and timings are unchanged; only chunking.
**Save-compat risk:** none.
**Dependencies:** `players` is told that clips load as one chunk (no API change). The lead checks the integrated precache.
**Files:** `pwa/sw.js`, `src/main.tsx`, `src/styles.css`, `src/shell/fonts.css` (new), `public/fonts/*` (new), `index.html`, `vite.config.ts`, `docs/CREDITS.md`, `scripts/qa/perf-startup.mjs` (new).

---

### shell-10 · P0 · Responsiveness and frame headroom (P-4, taps/transitions ≤ 100 ms) + final QA

**Why.**
- The brief: "all menus work and taps and movements all work good", and "check every screen transition and tap for jank".
- The research doc: input → visible change ≤ 100 ms.
- This is also the team's final QA task: the full suite, one build, the full matrix.

**Changes**
- New `scripts/qa/tap-latency.mjs`. For NBA, NFL and soccer at 393 (DSF 1, touch), dispatch real CDP touch taps on about 30 primary actions:
  - the 4 main tabs, the sport switch, the mode tiles, PLAY → Draft, a respin, a draft pick;
  - Settings open/close, the UT tab, the 6 UT tabs, segments, a card open/close;
  - pack open → SKIP, a sheet swipe-close, back buttons.

  It measures input → next paint with the Event Timing API (`PerformanceEventTiming.duration` by `interactionId`) plus long animation frames, at 1× and 4×. Transitions: frame intervals over the 600 ms after each navigation.
- New `scripts/qa/perf-match.mjs`: an isolated port of `matchperf.cjs` (fps, p99 interval, frames > 20 ms, rAF cost p99, long tasks, heap) for NBA and NFL at 390/430/320 and 1×/4×. Soccer goes through the dev `?soccer-lab` bench, documented as such.
- Fix in-lane offenders:
  - stage remeasure churn (`ResizeObserver` → `setBox`) during transitions;
  - shell CSS (plates, toasts, splash, skeleton, curtain): no costly filters or layout thrash;
  - verify the background-work guard: pool prefetch, cache writes and worker warms pause while `arenaActive()`.
- Report out-of-lane offenders in `shell.md`: owner, file/selector, measured ms.
- **Final QA:**
  - `heavy.sh npm run typecheck`;
  - the full `heavy.sh npm test` (NBA, NFL, soccer);
  - `heavy.sh npm run build`, once;
  - `startup.mjs`, `screen-fit.mjs`, `settings-danger.mjs`, `perf-ut.mjs`, `perf-startup.mjs`, `perf-match.mjs`, `tap-latency.mjs`;
  - `edge-walk.mjs --phase final` over 3 sports × 4 sizes, with contact sheets.
- Docs:
  - `docs/OVERHAUL-SCREEN-FIT.md` (edge clearance, plates, QA overrides);
  - `docs/OVERHAUL-PERFORMANCE.md` (pipeline, rated cache, groups, launch);
  - `docs/BROWSER-QA.md`.
- `shell.md`, completed:
  - before/after tables;
  - tests;
  - "Protocol bump needed: none";
  - touched outside lane;
  - owner device checks (§7);
  - what was left undone.
- Stop the dev server.

**Acceptance**
- Every measured tap: next paint ≤ **100 ms at 1×** (p95) and ≤ 200 ms at 4× (the INP "good" threshold). Otherwise it is listed with owner and cause.
- No long task > 200 ms within 1 s of any navigation at 4×. The first UT open is covered by the shell-6/7 numbers.
- Match numbers are no worse than §3 (NBA 390 at 4× ≥ 54.8 fps with p99 ≤ 33.4 ms; NFL ≥ 57.5 fps). There are 0 prefetch slices and 0 worker warm fetches during matches.
- Full `npm test` green, typecheck clean, the single build succeeds.
- Every shell QA script passes with 0 page errors and 0 non-localhost requests (except fonts if the shell-9 fallback was taken).
- The final matrix holds `inBand = 0` and `bottomCut = 0` on all screens and sizes.
- All before/after numbers are recorded in `shell.md` and the docs.

**Protocol impact:** none.
**Save-compat risk:** none.
**Dependencies:** owner teams receive the offender lists.
**Files:** `scripts/qa/tap-latency.mjs` (new), `scripts/qa/perf-match.mjs` (new), in-lane fix files as found, `docs/OVERHAUL-SCREEN-FIT.md`, `docs/OVERHAUL-PERFORMANCE.md`, `docs/BROWSER-QA.md`, `docs/studio-overhaul/shell.md`.

---

## 5. Deferred (deliberately), with reasons

- **Rating the pool in a Web Worker.**
  - CDP's 4× CPU throttle does not represent worker cost, so the target can't be measured honestly.
  - It doubles transient memory (about +50 MB), which is risky for iOS background kills.
  - It complicates the single-file artifact build.
  - Revisit only if the owner's device shows a slow *first* UT open after an update despite the Home-idle prefetch.
- **Build-time precomputed ratings.** Four teams change rating code in parallel, and a precomputed file would drift from `pool.print`. The per-build runtime cache (shell-7) gives the same warm-path win without that risk.
- **P-4 renderer work:**
  - the A-1 sprite budget near-to-far and time budget;
  - size quantization and pre-warming;
  - pooled canvases or an atlas;
  - a cap on close-up sprites;
  - the `drawBody` `finish()` loop.

  These are owned by `players` (sprite caching sections of each `render.ts`) and the sport teams. Shell supplies the `perf-match.mjs` harness and the numbers, and guarantees no shell work runs during matches.
- **Removing dead v1 code** (`src/game/sprites.ts`, `game/hoops/*`, `game/football/*`). It is owned by `players`/`nba`/`nfl` and is already tree-shaken. Only the `sprites.ts` "one skin tone" comment matters, and `players` retires that policy.
- **The warmer double-fetching game chunks** (audit P-5). The warmer already uses `cache: 'force-cache'`, and GitHub Pages sends cacheable headers. The duplicate is likely a `vite preview` artifact; re-check in shell-10 only.
- **Audit L items owned by other teams:**
  - L1, tab badge contrast: `ut`.
  - L2 outside the header: "Find your rhythm" 9 px, the Cloud Save subtitle, mission pills, login-calendar numbers. Owners: `ut`/`players`.
  - L3, the events scroller fade: `ut`.
  - L4, name truncation: `players`/`ut`.
  - L5, the Standouts back label: `ut`.
  - L9, a difficulty nudge: `ut`.
- **L8, Ranks offline skeleton 5 s → 3 s.** The fetch timeout lives in `src/net/leaderboard.ts`, which is lead-only. `Leaderboard.tsx` already shows `cachedBoard` when one exists. Reported to the lead.
- **Per-screen status-plate colours** (e.g. on immersive pack and arena screens). Only if the owner's device check shows that the uniform `#061820` plate looks wrong there.
- **Push notifications** ("Your Daily Drop is ready"). They need a push backend; out of scope.
- **Mode renames and labels** (audit H6). Owner decision; `ut` centralises labels.

## 6. Cross-team dependencies and coordination

| Team | What shell needs or changes | Size |
|---|---|---|
| all | Fix A moves content 22 pt down on island phones (19 notch, 8 SE). HUD and overlay offsets stay relative to `--sat`. Keep the class names listed in shell-3 and shell-4. | announcement |
| ut | `App.tsx`: `usePoolPrefetch`, UT and Arcade `Suspense` fallbacks (3 lines). `UltimateTeam.tsx`: skeleton and error branches (2 lines). The Settings reset handler is unchanged. | small hooks |
| packs | `pool.ts`: shell edits only `buildPoolInSlices`/`getPool`/new exports. `RatedCard` fields stay additive (the cache test flags new ones). Pack button class names kept. | coordination |
| players | `mocap.ts`: read-only `loadClip('ready')`. Clips become one chunk (config only). JSON `stringify` (default export, verified). | none to their code |
| nba / nfl | `Arcade.tsx`: the `withCurtain` hook (≤ 10 lines). Optional `arenaReady()` after the first real frame. | small hook |
| soccer | `Soccer2` is wrapped by the curtain inside `Arcade.tsx`. Keep chunks under `game/soccer2/` for the `sport:soccer` group. Optional `arenaReady()`. | none |
| lead | Approve ≤ 1 measurement `vite build` per perf task (shell-6 to shell-9). Integrated build: re-check the precache list and the `dist` duplicates. L8 timeout in `src/net`. No protocol bump from shell. | decisions |

Merge hot spots: keep every hunk small and never reformat these files: `src/styles.css`, `src/App.tsx`, `src/ui/Pages.tsx`, `src/game/Arcade.tsx`, `src/ut/pool.ts`, `src/ut/nav.css`, `src/ut/UltimateTeam.tsx`.

## 7. Owner device checks (copied into `shell.md`)

1. Installed-app screenshots of Home and UT Home. "LEVEL N" must be as bright as "x/y XP" (peak luminance about 168 vs 168, against about 110 vs 168 today), and nothing may look cut off at the top.
2. Settings → diagnostics reads `safe 59/34 · edge 22` on an iPhone 15/16 Pro.
3. Fix B: does the band become a flat colour? Compare with screenshots of both fixes and of B alone, if the lead builds a variant. Watch for a visible seam on immersive screens (pack opening, matches).
4. The card detail on a Face ID iPhone: the action bar sits flush with the bottom and no stats show below it.
5. PLAY → match: the curtain shows the matchup, and there is no black flash.
6. Airplane mode:
   - relaunch to Home in < 1.5 s;
   - open UT for each sport played before;
   - after an update, UT still opens offline for a sport not reopened since;
   - lie-fi (weak signal) relaunch is capped at about 1 s by the worker timeout.
7. First UT open after a deploy, then a second open: the second is near-instant.
8. Archivo renders on the first offline launch after install.
9. Reset Progress needs ERASE typed, and Keep closes without changes.

## 8. Risks and decision points

- **`fit` margin.** `fit` comes from `h − sat − sab`, so classes can't flip. Home's own `content` thresholds (`snug` < 730) can still sit at the edge on 393×852 (731), so shell-2 measures Home and adjusts only the Home spacer/snug line.
- **Fix B is unverifiable in Chromium.** It ships per the audit, and the owner's check decides. Disabling it is a one-line CSS change.
- **The edge on non-iOS-26 devices** (older iOS, Android) costs 8–22 px of top room. It is accepted for consistency, with no UA sniffing.
- **Fetch-as-JSON dual paths** (shell-6) could emit duplicate data in `dist`. The acceptance check catches it, and the fallback is `stringify`-only.
- **Rated cache correctness.** It is keyed by `APP_VERSION`, compares all own keys in tests, and verifies print on every read, so any mismatch falls back to rating.
- **The prefetch raises session heap by +40–57 MB** for players with UT progress, the same as opening UT. It is gated to UT players and paused in matches; heap is recorded.
- **Production measurement builds** need the lead's OK (see §4 intro). Otherwise the numbers move to shell-10.
