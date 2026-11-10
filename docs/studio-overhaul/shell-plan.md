# Team shell: build plan (revision 2)

Team **shell**: iPhone fit, app shell, loading, offline and performance. Branch `claude/studio-shell`, worktree `/home/user/ps-s-shell`, dev-server port **5211**.

Planned 2026-11-09 against `acdf3e2`. **Revised 2026-11-10** after an independent critique. No code was changed while planning. §9 maps every critique point to the task that handles it, or says why it is rejected.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`. Commands in this plan use `heavy.sh` as shorthand for `bash $O/heavy.sh`.

**Sources read in full:** `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-shell.md`, `CLAUDE.md`, `O/audit-ut-ui.md`, `O/audit-likeness-animation-perf.md`, `O/research-likeness-animation.md`, `docs/OVERHAUL-SCREEN-FIT.md`, `docs/OVERHAUL-PERFORMANCE.md`, `docs/BROWSER-QA.md`, the audit scripts (`O/audit-scripts/utui/{lib,edge}.mjs`, `O/audit-scripts/likeness/{coldstart,heap,matchperf}.cjs`) and the owner's screenshot. For revision 2 the cross-team parts of `O/STREAM-{ut,packs,players,nba,nfl,soccer}.md` were also read.

**Code read:** the stage (`stage-layout.ts`, `stage.tsx`, tests), the launch path and worker (`index.html`, `main.tsx`, `vite.config.ts`, `pwa/sw.js`, `lib/update.ts`), UT data loading (`soccer-lazy.ts`, `ut/pool.ts`, `ut/cards.ts`, `ut/season-reference.ts`, `ut/numbered-sync.ts`, `ut/rare.ts`), `App.tsx`, `Pages.tsx` (Home, Settings), `Arcade.tsx`, `UltimateTeam.tsx`, `evolution/Training.tsx`, `ut/Moments.tsx`, the three engines' portal code, `lib/errlog.ts`, `lib/cloud-save.ts`, `lib/cloud-sync.ts`, the CSS rules named in OWNERSHIP, and `scripts/qa/{browser,screen-fit,startup}.mjs`.

**Facts verified for revision 2** (they shape the tasks):
- `src` has no React error boundary (no `componentDidCatch` / `getDerivedStateFromError`). `errlog.ts` `watchErrors()` only logs.
- `Arcade.tsx:155-164` calls `loadSoccerGame()` / `loadAttrs()` without `.catch`. A failed chunk leaves soccer on "Walking out…" (`Arcade.tsx:450`) and NBA/NFL with no attributes.
- `evolution/Training.tsx:209,229` and `ut/Moments.tsx:74,84` mount `Hoops2`/`Football2` directly, not through `Arcade`.
- All three engines portal `.arcade-full` straight into `document.body` (`Hoops2.tsx:757/920`, `Football2.tsx:1207`, `Soccer2.tsx:957`) at z-index 50. A **non-subtree** `childList` observer on `<body>` therefore sees every arena at no per-frame cost, and the arena paints over a fixed status plate (z 2).
- `#root` is `position:fixed` with no z-index (`styles.css:66`), so a status plate at z 2 paints over every in-root overlay: sheets (`.scrim`, `rgba(2,8,12,.78)`, `styles.css:3331-3339`), pack opening, splash, `vs-splash`, the season reveal.
- Raw `env(safe-area-inset-top)` rules bypass `--sat`: `.hq-moment-overlay` (`ut/clubhouse.css:1366`), `.ut-so-stamp` (`ut/content-ui.css:1021`), `.ut-lm-ticker` (`ut/content-ui.css:1038`), and in unowned `evolution/evolution.css`: `.camp-overlay` (371, 1091) and `.save-warning` (667). `.save-warning` is a fixed banner at the inset line, inside the blur band.
- `UltimateTeam.tsx:316-334` rates every owned copy above level 1 during render through `ratedOf` (cached per `id@level`, `pool.ts:144-155`). `rareInfo` copies and sorts the gold buckets once per pool (`rare.ts:18-40`, WeakMap).
- Cloud `archive` runs only when resolving a conflict (`cloud-sync.ts:240`). After an erase, the automatic save uploads the fresh profile as the newest revision, so an accidental erase cannot be recovered from the server.
- `sw.js` installs the whole `PRECACHE` with `cache:'reload'` on every deploy. `page()` is network-first with `cache:'no-cache'` and a 3,500 ms timer. An offline fetch rejects at once, so the 3.9 s offline relaunch is mostly the splash/fonts chain (2.2 s font wait + 700 ms floor + 450 ms fade).
- `cards.ts:214,226` also loads `nfl-combine.json`; `numbered-sync.ts:7` loads `numbered-*.json`. No source file uses a named or namespace JSON import today.
- `index.html` ships launch images for 440×956, 430×932, 428×926, 420×912, 402×874, 393×852, 390×844, 375×812, 414×896 and 375×667. Each one shows the NBA ball; the splash then swaps to the sport's ball (`main.tsx:41`). `theme-color` and `background_color` are `#04121a`.
- Both font sources are reachable from this machine: `fonts.googleapis.com` (HTTP 200) and the npm package `@fontsource-variable/archivo` (5.3.0).

---

## 1. Goals

1. **The iPhone top edge looks native and crisp, and it ships first** (owner decision 6).
   - Nothing the player reads may start inside the iOS 26 status-bar blur band, and no control may start above inset + edge.
   - Every top bar sits on a real header plate that starts at y = 0.
   - "LEVEL N" must be as bright as "x/y XP" on the owner's phone.
2. **Nothing is cut off, and every tap target is at least 44 design px:** the card-detail bar (H1), Home (M1) in every state, and the small targets (M6).
3. **No blank screens and no accidental erase.**
   - A render error anywhere shows a recovery screen, never a blank installed app.
   - A failed match download shows recovery, never an endless "Walking out…".
   - Reset Progress is a protected danger zone that states plainly what happens to the cloud save (M8).
4. **Loading looks intentional:** a branded curtain at every match mount point (M9) and a UT skeleton built from the real UT chrome.
5. **Ultimate Team opens fast:** ≤ 2.5 s at 4× CPU from the second open on a build, no long task over 200 ms, and lower heap.
6. **The app works offline and updates cheaply:** UT works for every sport opened online once (including players with 0 cards), draft matches start offline, a deploy downloads only changed files, and auto-update never loops.
7. **Launch is fast and continuous:** no fixed splash floor, self-hosted fonts, offline relaunch under 1.5 s, and no ball swap at launch.
8. **Taps answer within 100 ms and matches keep their headroom.** Menu taps are measured by shell. In-game input → visible change is measured by shell and reported to the sport and players teams, who own the fixes.

Hard rules for every task:
- Saves, storage keys, card/edition/copy ids and the meaning of saved fields never change. New state is additive with defaults.
- No protocol bump is expected. `DRAFT_RULES` and `UT_RULES` are never edited. If a measurement shows shell work would change a match, it is written as "Protocol bump needed" instead.
- QA isolation:
  - every run uses `?ns=inspect&relay=ws://localhost:7777`;
  - every Playwright context aborts non-localhost hosts (except Google Fonts while the app still uses them);
  - QA never clicks SAVE NOW or ERASE.
- Sport branches use `pick` / `pickFor`.
- The 390 design frame is kept: no width media queries, no `screen.height` guesses.
- Reduced motion is respected. Symbols are SVG. Original branding: no EA/2K system names, no team logos.
- Heavy commands go through `heavy.sh`. Commits stage explicit paths.
- Dev server only via the PID file; never `pkill -f` / `pgrep -f`.

## 2. Scope map: every STREAM item → task

| STREAM item | Task |
|---|---|
| P0 C1 Fix A: edge clearance (`--sat` = inset + edge, `--inset-top`, `.arcade-full` `--sat`), `sat` stays raw, `edge` tests, `fit` must not flip | shell-2 |
| P0 C1 Fix B: fixed status plate outside the stage | shell-3 (ships early) |
| P0 C1 Fix C: header plates from y = 0 | shell-3 (solid main and UT plates, ships early); shell-5 (sub-page headers, toasts, HUD scrim, premium pass) |
| P0 C1 Fix D: `index.html` comment, `viewportInfo()` edge, `screen-fit.mjs` topmost ≥ sat + edge, QA override for `.arcade-full` insets | shell-2; harness side in shell-1 |
| P0 C1 verify every screen of 3 sports at 4+ sizes with the simulated band; contact sheets | shell-1 (headers and Home before), shell-3 (early-ship gate), shell-5 (full walker), shell-10 (final and integrated) |
| P0 H1 card-detail bar | shell-3 (ships early) |
| P0 M1 Home hint and dead gap | shell-2 (all Home states; joint budget with ut's Home strip) |
| P0 M6 small targets | shell-5 (Draft respins/boosters in shell CSS; pack and UT targets become ut/packs acceptance items, verified in shell-10) |
| P0 M9 arena loading gap | shell-6 (App-level curtain covering every mount point) |
| P0 M8 Reset Progress danger zone | shell-4 |
| P0 P-1 UT open (profile, lazy/indexed pools, chunked parsing, no full-pool scans on first paint, memoisation, skeleton) | shell-1 (production and heavy-profile baselines, first-render costs to ut/packs), shell-6 (skeleton), shell-7 (pipeline, rated-pool cache, gated prefetch) |
| P0 P-2 offline UT, per-sport precache, the two named bugs | shell-8 (groups, worker, warm-on-open, offline matches), shell-9 (offline first soccer visit) |
| P0 P-3 splash floor, render-blocking fonts, offline relaunch | shell-9 |
| P0 P-4/P-5 frame headroom, bundle quick wins | shell-4 (`arena.ts` work counter), shell-7 (`json.stringify`), shell-8 (precache groups), shell-10 (match fps; conditional fetch-as-JSON and per-sport mocap chunks) |
| General: every transition and tap; input → visible change ≤ 100 ms | shell-5 (menu taps at 1×), shell-6 (in-game input latency), shell-10 (4× pass) |
| General: keep the update flow | shell-8 (install/activate carry-over, no-loop throttled test), shell-9, shell-10 |
| Owner device checks | §7, copied to `shell.md` in shell-3 (early-ship items) and shell-10 |
| Error recovery (not in STREAM; required by "make sure the games loads runs" and "all menus work") | shell-4 |

**Audit L items:** shell does L2 (header "LV" label, shell-3), L6 (description, shell-2) and L7 (QA standalone and arcade insets, shell-1/2). L1, the rest of L2, L3, L4, L5, L8 and L9 have other owners (§5).

## 3. Baselines (the numbers to beat)

From `audit-likeness-animation-perf.md` §3.1: production build `acdf3e2` at 390×844, DSF 3, isolated. That build is kept at `O/audit-scripts/likeness/build` (the "kept build"); it is served with `npx vite preview --outDir <it> --port 5211 --strictPort`.

| Metric | NBA | NFL | Soccer |
|---|---|---|---|
| UT open, tap → ready, 1× / 4× | 2,123 / **7,395 ms** | 2,092 / **8,974 ms** | 679 / 1,834 ms |
| Longest task during UT open at 4× | 385 ms | **669 ms** | 431 ms |
| Heap, Home → after UT (CDP, after GC) | 14.0 → 55.5 MB | 11.4 → 68.8 MB | 12.1 → 46.2 MB |
| Warm relaunch to Home | 1,027 ms | 927 ms | 940 ms |
| Offline relaunch to Home | **3,965 ms** | 3,942 ms | 3,974 ms |
| UT offline (not opened online on this build) | "cards didn't load" | same | same |
| Cold visit at 4× + 4G, fonts blocked: FCP / interactive / longest task | 1,572 / 2,612 / 295 ms | 1,260 / 2,206 / 214 ms | 1,284 / 2,284 / 232 ms |
| Startup JS gzip | 773 KB | 645 KB | 592 KB |
| Match at 390, 4×: fps / p99 interval | 54.8 / 33.4 ms | 57.5 / 33.4 ms | (lab) 59.0 |

Precache: 11.5 MB in 111 files; `season-references-nfl` (2.55 MB) and `-nba` (0.65 MB) are installed for every player. Mocap: 15–26 clip requests per match; in the NBA lab the first frame came at 1,082 ms and the clips at 1,218 ms.

**Profiling done for this plan** (vite-node, desktop CPU, `…/scratchpad/shell-plan/poolprof.ts` through heavy.sh). Today's UT open cost is dominated by evaluating the card file as a JS object literal (Vite 5.4.10 emits JSON imports that way).

| Step | NBA (22,082 lines) | NFL (32,242) | Soccer (30,352) |
|---|---|---|---|
| `JSON.parse` of `cards-<sport>.json` | 21 ms | 20 ms | 36 ms |
| The same data imported as a JS-literal module | **1,531 ms** | **1,158 ms** | **1,987 ms** |
| `expandCards` (one synchronous call) | 178 ms | 279 ms | 151 ms |
| Rate every line (`buildPool`) | 1,103 ms | 1,060 ms | 109 ms |

At 4× the rating step alone is about 4.2–4.4 s for NBA/NFL. That is packs-owned code (`rate.ts`), so a first UT open on a new build at 4× cannot reach 2.5 s inside shell's lane (decision D6 in §6).

**Device matrix and Home room** (frame px; `k = W/390`; `edge = min(22, round(0.4 × inset))`; Home's classes are `short` < 620, `snug` < 730, `tall` ≥ 816, from `Pages.tsx:173`):

| Device (insets t/b) | Raw room (h − sat − sab) | Room after the edge | Class (both) | Margin to 730 |
|---|---|---|---|---|
| 393×852 (59/34), owner's phone | 753.2 | 731.4 | – | +1.4 |
| 402×874 (62/34) | 754.8 | 733.4 | – | +3.4 |
| 420×912 (≈68/34, inset to confirm on device) | 752.1 | 731.7 | – | +1.7 |
| 440×956 (62/34) | 762.3 | 742.8 | – | +12.8 |
| 430×932 (59/34) | 761.0 | 741.0 | – | +11.0 |
| 390×844 (47/34) | 763.0 | 744.0 | – | +14.0 |
| 375×812 (50/34) | 757.1 | 736.3 | – | +6.3 |
| 375×667 (20/0) | 672.9 | 664.6 | snug | – |
| 320×568 (20/0), regression | 667.9 | 658.1 | snug | – |

The class doesn't change on any device, but three island phones sit within 3.4 px of the `snug` threshold. shell-2 therefore takes Home's class from the raw room (like `fit`), so the edge can never flip it.

**UI baseline** (`audit-ut-ui.md` §1):
- The topmost text or control on every header at 393×852 sits at 65–76 pt (sat + 6…17), inside the band.
- Toasts sit at sat + 6, SKIP at sat + 12, and the in-game score bug at sat + 8.
- The H1 bar floats 34 pt high on notch and island phones.
- Small targets: respins 172×38, boosters 90–107×40, SKIP 65×36, QUICK SELL DUPES 133×34, season chip 141×41, TAP TO CONTINUE 224×42 (320 only).

**"Measure before and after" rule.** Each new harness runs first against the kept build (which never changes), and its numbers go into `shell.md` as "before" before that area's code changes. This covers:
- Home and header geometry: shell-1.
- UT open with the standard and heavy profiles: shell-1.
- Menu tap latency and transition frames: shell-5.
- Curtain and empty frames, and in-game input latency: shell-6.
- Startup with fonts allowed, served from a local mirror of the Google Fonts responses under the same 4G throttle: shell-9.

## 4. Tasks (in order)

Order and dependencies: shell-1 → shell-2 → **shell-3 (early ship)** → shell-4 → shell-5 → shell-6 → shell-7 → shell-8 → shell-9 → shell-10.
- shell-6, shell-7 and shell-8 use `arena.ts` from shell-4.
- shell-8 uses shell-7's first-successful-`getPool` hook.
- shell-9 builds on shell-8's worker.

**Sizes.** Each task is one focused session of about 3–5 h on one coherent set of files. Each task names a **cut line**: what moves to the shell-10 buffer if the session runs long.

**Every task ends the same way:**
- typecheck: `heavy.sh npm run typecheck`;
- tests for its own area: NBA by default, `PS_SPORT=nfl`, and `PS_SPORT=soccer npx vitest run soccer sport-branches` when soccer is touched;
- its screenshots, which the engineer looks at;
- an update to `docs/studio-overhaul/shell.md`: what changed, before/after numbers, tests, "Touched outside my lane", owner device checks, messages to other teams;
- a commit of explicit paths, with a `Claude: ` message and the BUILD-RULES trailer;
- `git push -u origin claude/studio-shell`, retrying up to 4 times on network errors.
- Every QA run asserts 0 page errors and 0 non-localhost requests.

**Dev server.** Start: `nohup npx vite --port 5211 --strictPort > /tmp/ps-shell-vite.log 2>&1 & echo $! > /tmp/ps-shell-vite.pid`. Stop: `kill $(cat /tmp/ps-shell-vite.pid)`. The same port serves `vite preview` of a build when the dev server is stopped.

**QA environment.** `PS_QA_URL=http://localhost:5211/`, plus `PS_QA_PACKAGE_JSON=/opt/node-tools/package.json` if `require('playwright')` doesn't resolve from the repo.

**Production builds for measurement** (decision D1). The worker, precache and real chunk timings exist only in a production build. shell-7, shell-8 and shell-9 each run at most one measurement build:
- build: `heavy.sh npx vite build --manifest --outDir …/scratchpad/shell-build`
- serve: `npx vite preview --outDir … --port 5211 --strictPort`

This is not `npm run build`. The lead must answer D1 **before shell-7 starts**. If the lead refuses, every P-1/P-2/P-3 acceptance moves to shell-10, and shell-10's buffer becomes the only time to fix failures.

---

### shell-1 · P0 · QA harness core, production fixtures, team QA snippet, baselines (enabling)

**Size:** about 4–5 h. **Cut line:** the 4× `perf-ut` runs move to shell-7. The 1× numbers and the heavy-profile cost report stay here, because ut and packs need them while they redesign UT.

**Why.**
- `scripts/qa/browser.mjs` does not abort non-localhost requests, and an earlier QA run registered cards live by accident.
- `browser.mjs` builds its fixture by importing `/src/...` modules through the dev server, so it cannot work against `vite preview`.
- Every baseline so far used a fresh or ~30-card profile. Real players hold hundreds to thousands of copies; the owner is Level 19 with 59,672 coins.
- The plan tested only 4 sizes, but launch images ship for 402/420/440/375×812, and those devices sit within 3.4 px of Home's `snug` threshold.
- The other teams are tuning new HUDs and headers today with `env()` = 0 in Chromium, 22 pt higher than final.
- The early ship (shell-3) needs before numbers for the headers, Home and H1. The full ~50-screen walker is not needed for that, so it moves to shell-5.

**Changes**
- `scripts/qa/browser.mjs`. Existing exports and the `fixture(browser, sport, name, width, contextOptions)` signature stay compatible.
  - `context.route('**/*', …)` continues `localhost`, `127.0.0.1`, `fonts.googleapis.com`, `fonts.gstatic.com`, `data:` and `blob:`. It aborts everything else and pushes each aborted host to `f.blocked`.
  - An optional 6th parameter `{ insets: [t,r,b,l], height, standalone, dsf = 1, motion = 'reduce', profile }`:
    - `window.__psInsets` is set via `addInitScript`;
    - `navigator.standalone` is overridden;
    - the CDP display-mode emulation is attempted.
  - `profile: 'standard' | 'heavy' | 'utNoStarter' | 'checkpoint' | 'fresh'`. With `PS_QA_BUILD_ROOT` set (a production build), fixtures come from the serialized files below; on the dev server they are built from source modules as today.
- New `scripts/qa/fixtures.mjs`:
  - **`make`** (dev server only, run once per sport) builds, through the same source modules `browser.mjs` uses:
    - `standard`: today's ~30-card fixture;
    - `heavy`: about 2,000 owned copies, 30% levelled 2–5, evolved variants where the sport has Evolutions, a 300-pack pull log (`ut.content.pulls`), a full `ut.hq` (seasons, objectives, circuit history), saved squads;
    - `utNoStarter`: UT opened, starter not claimed, 0 cards;
    - `checkpoint`: a saved draft run.
  - It serializes **only the existing localStorage keys** exactly as the app wrote them under `?ns=inspect`, to `O/fixtures/<profile>-<sport>.json`. The generator lives in the repo; the files stay in the scratchpad.
  - **`inject(context, profile, sport)`**: an `addInitScript` that writes those keys only when `location.hostname` is `localhost` or `127.0.0.1`, and only once per context, so the app's own later writes survive reloads.
- New `scripts/qa/edge-lib.mjs`:
  - `DEVICES`, nine entries:
    - `393` = 393×852 [59,0,34,0]
    - `402` = 402×874 [62,0,34,0]
    - `420` = 420×912 [68,0,34,0], top inset to confirm on device
    - `440` = 440×956 [62,0,34,0]
    - `430` = 430×932 [59,0,34,0]
    - `390` = 390×844 [47,0,34,0]
    - `375x812` = [50,0,34,0]
    - `375` = 375×667 [20,0,0,0]
    - `320` = 320×568 [20,0,0,0], regression only
  - `edgeOf(t)` mirrors `topEdge` in `stage-layout.ts`, with a comment pointing at it.
  - `TEXT_CLEAR` = {59: 26, 62: 26, 68: 26, 50: 24, 47: 24, 20: 10} (pt below the inset). The simulated band fades out at inset + 26 on island phones, so text between inset + edge and inset + 26 still sits in the fade.
  - `simulateBand(page, insetTop)`: the audit's iOS 26 overlay (backdrop blur 2.6 px, brightness 0.66, masked 0 → inset + 26, fade from inset + 12). Screenshots only.
  - `auditScreen(page, device)` extends the audit's `lib.mjs` `audit`:
    - `textInBand`: text-node line boxes (`Range.getClientRects`, adjusted by half-leading to the cap top) above `inset + TEXT_CLEAR`. Text inside a vertical scroller whose top is below that line is excluded.
    - `controlInBand`: control boxes above `inset + edge`. Fixed overlays (toasts, `.ut-skip`) and the portaled `.arcade-full` HUD are measured in screen px.
    - `bottomCut`: text or controls below `H − sab`, and PLAY bar / tab bar bottoms outside the viewport.
    - `small` (< 44 design px, counting a `::before` hit area) and `overlap` (pairs of **effective hit rects**, `::before` included, that intersect).
    - `tiny` (< 10 px), `lowContrast`, `docScroll`, `hOverflow`, `offscreen`.
  - `homeAudit(page)` returns:
    - the Home class;
    - every `.home-scroll` row rect;
    - the PLAY bar and fade rects;
    - the gap from the last row to the PLAY top;
    - whether the scroller overflows, and whether the last row clears the fade at scroll end.
  - `forceStandaloneRule(page)`: injects `index.html`'s standalone `min-height` rule without its media query, because CDP cannot emulate `display-mode` (L7).
  - `contactSheet(files, out, cols = 6)`: grids PNGs with `page.setContent`. No Python is needed.
- New `scripts/qa/edge-headers.mjs`: the header subset the early ship needs, per sport and device:
  - Home (top);
  - UT Home and the five other UT tab headers;
  - Draft after a spin;
  - the Settings sheet;
  - a card detail opened from Club, scrolled top/mid/end;
  - a toast: Respin before spinning shows "Spin first, then you can respin." (`Draft.tsx:625`);
  - pack opening with SKIP;
  - an in-game frame from the `?arcade&auto&sport=X` bench.
  - CLI `--sports --devices --phase --band --shots all|failures`. Output: `O/shots/shell/<phase>/<sport>-<device>/NN-<screen>.png`, `report.json` and contact sheets.
- New `scripts/qa/home-matrix.mjs`: 4 modes × checkpoint {off, on} × online {off, on} × 3 sports × 9 devices, measurement only, with screenshots at 393.
  - "Online on" means the signature-verifying local relay that `online.mjs` starts on `ws://localhost:7777`, so `LiveCount` and the queue text appear. "Off" means no relay.
- New `scripts/qa/perf-ut.mjs`: an isolated port of `coldstart.cjs` phase C on production builds (`PS_QA_BUILD_ROOT`, `vite preview`). Fixtures are injected; the dev-server import path is never used.
  - It measures tap → UT ready (`.ut-tabs` visible), long tasks (PerformanceObserver), heap after GC (CDP `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage`), and decoded JS/JSON bytes.
  - It records a CDP CPU profile of the first UT render (pool resolved → UT Home painted), aggregated by function (`ratedOf`/`rateCard`, `rareInfo`, the `club`/`stored` memos, squad rating, …).
  - Phases: cold, plus warm and prefetch (used from shell-7 on). 1× and 4×, N = 3, median.
- New team QA snippet: `O/qa-snippets/shell-edge.mjs`, with a repo copy at `scripts/qa/edge-snippet.mjs`. `applyShellEdge(context, { insets })` lets other teams see final geometry on their own branches before shell merges:
  - `addInitScript` sets `__psInsets` and `--ps-inset-*` / `--ps-edge` on `<html>`;
  - `addStyleTag` sets `.stage{--sat:<(t+edge)/k>px !important}` (frame px, `k = innerWidth/390`) and `.arcade-full{--sat:<t+edge>px !important;--sab:<b>px !important}`. Important author declarations beat the stage's inline style.
  - It lists the raw `env()` rules it cannot emulate. `shell.md` announces the snippet, and asks the lead to forward its path to every team the day it lands.
- `docs/BROWSER-QA.md`: a "Shell harness" section covering env vars, isolation, devices, fixtures, outputs and the `display-mode` limit.
- New `docs/studio-overhaul/shell.md`: the team doc skeleton with the BUILD-RULES sections.

**Baselines** (kept build for "before"; numbers in `shell.md`):
- `edge-headers --phase before` at 9 devices × 3 sports, with the band and all shots at 393.
- The full `home-matrix`.
- `perf-ut` at 1× with the standard and heavy profiles. The heavy first-render cost table goes to ut/packs under "Messages to other teams" in `shell.md`.
- A `rateCard` self-time profile goes to packs: its top 5 costs, in ms per 1,000 lines.

**Acceptance**
- Isolation: a probe `fetch('https://example.com')` is aborted and listed in `blocked`. Every run reports 0 requests to hosts other than localhost and Google Fonts.
- Fixtures:
  - `heavy` holds 2,000 ± 5% owned copies, ≥ 30% levelled, ≥ 50 evolved variants (NBA/NFL), 300 pull-log packs and a full `ut.hq`;
  - every fixture loads on the dev server and on the kept build with 0 page errors;
  - the injector writes only existing keys, and only on localhost.
- The audit is reproduced:
  - main and UT header topmost at 65–76 pt at 393;
  - the card-detail bar shows content below it at 393, 390 and 402, and not at 320;
  - Home classes on 9 devices equal the §3 table.
- Snippet: on an untouched `acdf3e2` dev server at 393, `.arcade-full` computes `--sat` = 81 px, the stage computes `--sat` = 81/k frame px, and Home's LV ring moves 22 pt down.
- `perf-ut` standard 1× numbers fall within ± 15% of §3 (2,123 / 2,092 / 679 ms). Heavy numbers are recorded. The heavy first-render table names the top 5 costs per sport in ms.
- `edge-headers` for one sport over all 9 devices takes ≤ 4 min. `screen-fit.mjs` still passes after the `browser.mjs` change.

**Protocol impact:** none (QA only). **Save-compat risk:** none. Fixtures stay in inspect contexts on localhost.
**Dependencies:** none. **Touched outside lane:** none.
**Files:** `scripts/qa/browser.mjs`, `scripts/qa/edge-lib.mjs`, `scripts/qa/edge-headers.mjs`, `scripts/qa/home-matrix.mjs`, `scripts/qa/fixtures.mjs`, `scripts/qa/perf-ut.mjs`, `scripts/qa/edge-snippet.mjs` (all new except `browser.mjs`), `docs/BROWSER-QA.md`, `docs/studio-overhaul/shell.md` (new). Scratchpad: `O/fixtures/`, `O/qa-snippets/`, `O/shots/shell/before/`.

---

### shell-2 · P0 · Fix A (top-edge clearance) + Fix D (hygiene) + M1 (Home in every state) + L6

**Size:** about 3–4 h. **Cut line:** none; all of it ships in the early unit.

**Why.**
- Every screen offsets its content by `--sat`, so moving `--sat` below the band clears every header, toast and SKIP at once.
- The audit requires M1 to ship with it: NBA/NFL Home has no slack.
- ut's Home strip (STREAM-ut P0.1, H4) wants room on the same Home, so the vertical budget must be settled here.

**Changes**
- `src/stage-layout.ts`:
  - `EDGE_MAX = 22`; `topEdge(t) = min(22, round(max(0, t) × 0.4))`, giving 59 → 22, 62/68 → 22, 50 → 20, 47 → 19, 20 → 8, 0 → 0.
  - `Layout` gains `edge` and `room` (raw `h − sat − sab`, frame px).
  - Phone branch: `edge = rot ? 0 : topEdge(top) / k`; `content = max(0, room − edge)`; **`fit = fitFor(room)`**, so the class can never flip because of the edge.
  - Framed branch: `edge = 0`. `sat` stays the raw inset (`sat × k === inset`).
- `src/stage.tsx`:
  - The stage style sets `--sat` = `sat + edge`, `--inset-top` = `sat`, `--edge` = `edge`.
  - A layout effect sets `--ps-inset-{top,right,bottom,left}` and `--ps-edge` (screen px; 0 when rotated or framed) on `document.documentElement` from `readInsets()`, which honours `__psInsets`.
  - The `setBox` equality check includes `edge`. `DEFAULT.edge = 0`.
  - `viewportInfo()` appends ` · edge N`, so the phone shows `safe 59/34 · edge 22`.
- `src/styles.css` `.arcade-full` (7826–7833), Fix D's QA override:
  - `--sat: calc(var(--ps-inset-top, env(safe-area-inset-top, 0px)) + var(--ps-edge, 0px))`;
  - `--sab`, `--sal` and `--sar` from `--ps-inset-*` with the `env()` fallback.
  - On a device these equal `env()`; in Chromium they follow `__psInsets`.
- `src/ui/Pages.tsx`, Home only (shell's granted hunk):
  - The Home root class (line 173) reads `room` instead of `content`, one token, so the classes match today's on every device (§3 table).
  - M1: drop the classic-mode `.under` line "1 free team respin and 1 free decade respin every draft." The How-to sheet already says it (`Pages.tsx:588`). Keep the 1v1 bot chips and the daily/blind lines.
- `src/styles.css` ~11653 `.home .playbar`:
  - Replace the `0 -14px 18px -6px` shadow with a `::before` fade at most 8 px tall, `pointer-events:none`.
  - Soccer's dead gap: the spacer splits it above and below the mode block via `.home:not(:has(.training-entry))`.
- **Home vertical budget** (joint with ut). shell owns Home's vertical layout: the spacer, the class line, the fade, and their measurement. ut owns the strip's contents.
  - From `home-matrix`, `shell.md` publishes a table of every Home row's height at 393/402/420 and the slack left in each state.
  - Expected: slack ≈ 0 at 393 after the edge and the dropped hint line, so ut's strip must take an existing row's slot. Proposal: the `.tagline` row (≈ 20 px), with the tagline moving to How-to.
  - The lead arbitrates (D5). shell-10 re-runs the matrix on the integrated branch.
- Raw-env rules:
  - In `src/evolution/evolution.css` (unowned; grant requested, D3): `.save-warning` → `top: calc(var(--ps-inset-top, env(safe-area-inset-top,0px)) + var(--ps-edge,0px))`; `.camp-overlay` (371, 1091) → `var(--ps-inset-top, env(…))`.
  - ut is asked to make the same switch in `clubhouse.css:1366`, `content-ui.css:1021` and `content-ui.css:1038`. The fallback form works on their branch before shell merges.
- `index.html`:
  - Fix the stale comment: the standalone `min-height` rule lives only here.
  - L6: "Spin a random NBA, NFL or soccer team and decade, draft a lineup of legends, and go for a perfect season." The same text goes in `public/manifest.webmanifest`.
- `src/stage-layout.test.ts`: every existing assertion stays. Add:
  - the `topEdge` table;
  - for the 9 devices × their insets: `edge × k ≈ topEdge(inset)` and `content × k ≈ H − inset − edge − bottom`;
  - `fit` equal to a hard-coded table of `acdf3e2`'s classes;
  - rotated → `edge 0`; framed → `edge 0`.
- `scripts/qa/screen-fit.mjs`, at 9 devices, Safari and forced standalone:
  - `textInBand = 0` and `controlInBand = 0` on Home and UT Home;
  - a forced-standalone run: `docScroll ≤ 1`, PLAY above the tabs;
  - an in-game check: `?arcade&auto&sport=X` with `__psInsets` → `.hg2-bug` top ≥ inset + edge + 8, for 3 sports.

**Acceptance**
- `stage-layout.test.ts` is green, with all 13 prior assertions and the new 9-device tables.
- `edge-headers --phase fixA` at 9 devices × 3 sports: `textInBand = 0` and `controlInBand = 0` on Home, UT Home and every main/UT header. At 393: topmost control ≥ 81 pt, LV ring top ≥ 81, "LEVEL" cap top ≥ 85.
- `home-matrix`, all states × 3 sports × 9 devices:
  - Home classes identical to the baseline;
  - no row intersects the PLAY bar or its fade at rest;
  - where content fits: gap from the last row to the PLAY top 8–24 pt;
  - where it overflows (expected only at 375×667 and 320 with checkpoint + online): the last row clears the fade at scroll end;
  - the PLAY bar and tab bar rects are identical to the baseline ± 1 pt (PLAY never moves).
- `.hg2-bug` top ≥ inset + edge + 8 in 3 sports. Settings diagnostics read `safe 59/34 · edge 22`.
- `screen-fit.mjs` passes. `npx vitest run src/stage-layout.test.ts src/engine/sport-branches.test.ts` and the soccer `sport-branches` run are green.
- No width media query and no `screen.height` added (grep of the diff).

**Screenshots:** `O/shots/shell/fixA/`: Home and UT Home for 3 sports at 393 with the band, next to `before`; Home at 375×667 and 320.
**Protocol impact:** none. Layout only; HUD moves are render-only. **Save-compat risk:** none.
**Announcements** (in `shell.md`):
- every team's screens gain 22 pt of top clearance on island phones (19 on notch, 8 on 20-pt bars);
- HUD and overlay offsets stay relative to `--sat`;
- raw `env()` top rules must use `var(--ps-inset-top, env(…))`.
**Touched outside lane:** `src/evolution/evolution.css` (2 rules, with the lead's grant).
**Files:** `src/stage-layout.ts`, `src/stage.tsx`, `src/stage-layout.test.ts`, `src/styles.css`, `src/ui/Pages.tsx`, `src/evolution/evolution.css`, `index.html`, `public/manifest.webmanifest`, `scripts/qa/screen-fit.mjs`, `docs/studio-overhaul/shell.md`.

---

### shell-3 · P0 · Early-ship unit: Fix B (status plate), solid header plates, H1; ship gate and handoff

**Size:** about 3 h, plus gate run time. **Cut line:** none.

**Why.**
- Owner decision 6: the iPhone top-edge fix ships on its own as soon as it passes review.
- The unit is shell-1 (QA only), shell-2 and this task. It must import nothing from later shell modules: no `arena.ts`, `cards-load`, pool cache, `sw.js` or `vite.config.ts` change.
- The status plate must not regress in-root overlays on day one. `#root` has no z-index, so a plate at z 2 would paint an undimmed strip over sheets, the pack cinema, the splash and the season reveal, and a seam against UT's gold-tinted header.

**Changes**
- **Fix B.** `index.html` gets `<div class="status-plate" aria-hidden="true">` before `#root`.
  - Inline base style, so it paints before CSS loads: `position:fixed;left:0;right:0;top:0;height:env(safe-area-inset-top,0px);background:#061820;z-index:2;pointer-events:none`.
  - New `src/shell/plates.css`, imported in `main.tsx` right after `./styles.css`, refines it:
    - `.status-plate{height:var(--ps-inset-top, env(safe-area-inset-top,0px));background:var(--status-plate, var(--plate-top))}`. QA sees the real inset through `__psInsets`.
    - **UT:** `html:has(.ut-top){--status-plate:var(--plate-top-ut)}`, the UT header plate's top colour, so there is no seam.
    - **Open sheet:** `html:has(.scrim){--status-plate:#030c10}`, the plate composited under `.scrim`'s `rgba(2,8,12,.78)`. It gets a 0.22 s colour transition matching the scrim fade, 0 under reduced motion.
    - **Immersive:** `html:has(.ut-open-screen, .splash, .vs-splash, .screen.reveal) .status-plate{display:none}`. The band then shows the screen's own tier or background colour.
    - **Matches:** `.arcade-full` is portaled to `<body>` at z 50, so it already paints over the plate. Its own raw-inset scrim is shell-5.
- **Fix C, part 1 (solid plates).** In `plates.css`:
  - Tokens on `:root`, published in `shell.md` as the shared header API (D4): `--plate-top: #061820`, `--plate-bot`, `--plate-line`, `--plate-top-ut`, `--plate-bot-ut`.
  - `.shell-top` (main TopBar, already at y = 0) gets the plate on itself.
  - `.topbar` outside `.shell-top`, which includes UT `.ut-top`, Results, Gauntlet and UT Match, gets a `::before` plate with `top: calc(-1 * var(--sat))` and `z-index:-1`.
  - The look is a solid gradient (`--plate-top` to the inset, then `--plate-bot`) with a 1 px hairline. UT keeps its gold tint below the inset. No noise or accent yet (shell-5), and no `backdrop-filter`.
- **H1**, `src/ut/nav.css` (shell's granted hunk), **scoped to `.sheet.bottom .ut-detail-btns`**:
  - `bottom: calc(-18px - var(--sab,0px))`; `margin: 2px -18px calc(-18px - var(--sab,0px))`; `padding: 12px 18px calc(16px + var(--sab,0px))`; panel gradient.
  - Outside a bottom sheet nothing changes, so a pack-grid entry from packs' M2 stays safe.
  - Grep every in-sheet sticky bar with a negative `bottom`. Fix them the same way and list them.
- **L2:** the `.level` ring's "LV" label goes from 8 to 10 px; the ring stays 44 px.

**Ship gate** (this unit's own final QA; D2 asks the lead to approve the full test and the build here):
1. `heavy.sh npm run typecheck`, `heavy.sh npm test` (full, once) and `heavy.sh npm run build` (once).
2. `screen-fit.mjs` at 9 devices, Safari and forced standalone.
3. `edge-headers --phase ship` at 9 devices × 3 sports with the band at 393; `home-matrix`; the H1 entry-point run below; the plate probes.
4. **Self-containment:** `git diff --stat acdf3e2..HEAD` lists only the unit's files. No unit file imports `src/shell/arena`, `cards-load`, `pool-cache` or anything from later tasks.
5. 0 page errors; 0 non-localhost requests.

**Handoff**
- A `shell.md` section "Early-ship unit": the commit range, the files, the gate results, before/after contact sheets, rollback (revert the range), and owner device checks 1–5 (§7).
- Push a pointer branch `claude/studio-shell-edge` at the gate commit (a plain push; no force, no rebase). The lead reviews and ships it.
- The owner's on-device result for Fix B goes back into shell-5's plate pass.
- Later shell tasks change these hunks only through additive follow-ups.

**Acceptance**
- Every main and UT header has an opaque surface from y = 0 to its hairline. `elementFromPoint` probes at y = 2, y = inset + edge − 2 and y = header bottom − 2 (x = 20/195/370) all resolve to the header or its `::before`.
- The hairline y equals the first content row's top ± 1 pt. Header text contrast is ≥ 4.5:1 on `--plate-bot`; hairline contrast is ≥ 1.25:1 against the plate.
- Status plate:
  - main screens: y = 0, height = inset, `--plate-top`;
  - UT: the seam across the inset line is ΔE2000 ≤ 2 (sampled at x = 20/195/370);
  - hidden on pack opening, splash, `vs-splash` and the season reveal;
  - over an open sheet, the band's mean luminance is within ± 3% of the scrimmed area just below it.
- Fix B in Chromium, luminance over y 0..inset, x 0..W: A + B + C against A alone ≤ 2% mean difference on main and UT. The real effect is a device check.
- `:has()` cost: style recalc when opening UT Club with the heavy fixture rises ≤ 2 ms (CDP). If it rises more, fall back to a single `data-top` attribute written by the plate's own observer, and record it.
- H1 at 393, 390, 402 and 440, for 3 sports, from every entry point (Club, Squad, SBC, Collection, Store/Preview Pack, and the pack-open grid if it opens the detail today):
  - bar bottom = sheet bottom ± 1 pt at scroll top, mid and end;
  - `elementFromPoint` 4 pt above the sheet's bottom edge hits the bar;
  - no stat text below the bar.
  At 320 (sab 0) the bar region matches baseline pixels within 1%.
- The LV label is ≥ 10 px. Reduced motion: no new animation. `plates.css` ≤ 2 KB gzip, with no raster images.
- The gate steps all pass, the handoff is written and the pointer branch is pushed.

**Screenshots:** `O/shots/shell/ship/`:
- Home, UT Home, a sheet open over Home, pack opening and card detail, for 3 sports at 393, plain and with the band;
- DSF 3 crops of the top 140 pt of Home and UT Home, to compare with the owner's photo.
**Protocol impact:** none. **Save-compat risk:** none.
**Dependencies:** ut, packs and the sport teams keep the class names `.topbar`, `.ut-top`, `.shell-top`, `.scrim`, `.ut-open-screen`, `.ut-detail-btns`, and add no competing top backgrounds. players keep `.ut-detail-btns` in the CardDetail redesign, or move the actions to a non-scrolling footer, which makes the H1 rule obsolete (told via `shell.md`).
**Touched outside lane:** `src/ut/nav.css` (H1, granted); `plates.css` targets other teams' classes from shell's own file.
**Files:** `index.html`, `src/main.tsx` (1 import), `src/shell/plates.css` (new), `src/ut/nav.css`, `src/styles.css` (L2), `scripts/qa/edge-headers.mjs` (probes), `docs/studio-overhaul/shell.md`.

---

### shell-4 · P0 · Recovery and save safety: error boundaries, match load failures, `arena.ts`, M8 danger zone

**Size:** about 4 h. **Cut line:** M8's per-state acknowledgement copy can simplify to a single sentence. Nothing else is cut.

**Why.**
- There is no error boundary. With 7 teams' code shipping straight to live, any render exception blanks the installed app.
- A failed match chunk leaves soccer on "Walking out…" forever, and NBA/NFL without attributes.
- shell-6, shell-7 and shell-8 need a reliable "a match is on screen" signal that also covers Training Camp, Moments and the new solo mount points (owner decision 2). A ref count inside `Arcade` can't see those.
- RESET PROGRESS is one confirm away. The automatic cloud save then uploads the erased profile, so the erase can't be undone.

**Changes, recovery**
- New `src/shell/Recovery.tsx` and `src/shell/recovery.css`: `class RecoveryBoundary` (`getDerivedStateFromError` + `componentDidCatch` → `logError('boundary:' + where, e)`, so Settings diagnostics show it).
  - Fallback: a plate-styled card with an SVG mark, "Something went wrong on this screen.", **RELOAD** (`location.reload()`) and **BACK TO HOME** (`onHome`, else reload).
  - When the error is a missing chunk ("Failed to fetch dynamically imported module", `ChunkLoadError`):
    - online, RELOAD calls `reloadForMissingFiles()`;
    - offline, the copy reads "This needs one download. Connect once, then try again."
  - It never calls `update` or `saveProfile`. Targets ≥ 44 px. The arena variant is `position:fixed`, full screen, z 60.
  - Placements:
    - root, in `src/main.tsx`, around the App/Lab branch inside `Stage`;
    - `src/App.tsx`: around the view body inside `<Transition id={viewId}>` (`resetKey={viewId}`, `onHome={() => goTab('home')}`) and around the tab body inside `<Transition id={tab}>`. That is 2 one-line wraps plus an import.
  - These cover every screen, including Arcade, Training, Moments and UT. React portals keep their React parent, so errors in the body-portaled `.arcade-full` reach the view boundary.
  - Dev-only `?qa-crash=root|view|arena|ut` (`import.meta.env.DEV`, a 6-line `QaCrash` child) for QA. shell-10 verifies it is absent from production.
- `src/game/Arcade.tsx` (nba/nfl shared; a 4-line hook in the loader effect at 155–164, away from their 449–474 rework):
  - `const [loadErr, setLoadErr] = useState<unknown>(null)`;
  - `.catch((e) => live && setLoadErr(e))` on both loaders;
  - `if (loadErr) throw loadErr;`.
  The view boundary then shows recovery. No new UI lives in their file.
- New `src/shell/arena.ts`, small and standalone:
  - `arenaActive()`, `onArenaChange(cb)`, `arenaElement()`;
  - one `MutationObserver` on `document.body` with `{ childList: true }` (**not** subtree), started on import. It checks added and removed body children for `.arcade-full`; in-game DOM updates never fire it.
  - `shellWork(kind)`: every later shell timer, slice, fetch and warm calls it. While an arena is active it increments `window.__psShellWorkDuringArena[kind]` (dev and QA) and returns `false`, so the caller defers.
  - A unit test (fake `body`) covers insert, remove, two arenas, and the counter.
  - A static test asserts the three engines still `createPortal(… document.body)`, so a change to inline rendering is caught. The fix would be a subtree observer scoped to `#root`.

**Changes, M8**
- New `src/shell/danger.ts` (pure):
  - `canErase(text)`: `text.trim().toUpperCase() === 'ERASE'`;
  - `cloudLine(status, now)`;
  - `eraseSummary()`: coins, level and XP from the current profile; cards per sport, from this sport's profile and **raw** `localStorage.getItem` + `JSON.parse` of the other sports' existing keys in `try/catch` (read-only; never `loadProfile`, which may migrate and write).
- New `src/shell/DangerZone.tsx` and `src/shell/danger-zone.css`:
  - an "Advanced" disclosure (44 px, SVG chevron, `aria-expanded`);
  - a red-tinted panel titled "ERASE ALL PROGRESS", listing the real amounts ("59,672 coins · Level 19 · NBA 412 cards · NFL 230 · Soccer 31") and what stays (name, leaderboard entries, H2H record, streak). The engineer checks this list against `App.tsx:1212-1219` and `resetOtherSport()`.
  - a live cloud line from read-only `cloudStatus()` / `subscribeCloud()`;
  - a type-to-confirm input (16 px font, `autocapitalize="characters"`, `autocomplete="off"`, `spellcheck=false`);
  - an **acknowledgement tick** worded by cloud state:
    - cloud on: "I understand my cloud save will be replaced too";
    - otherwise: "This phone isn't cloud-saving. There is no other copy.";
  - KEEP MY PROGRESS (primary, focused);
  - ERASE EVERYTHING, `aria-disabled` until Advanced is open, ERASE is typed and the tick is set (≥ 3 deliberate actions). It then calls the unchanged `onReset`.
- `src/ui/Pages.tsx` `SettingsSheet` (shell's granted Reset hunk): the old `confirm` block becomes `<DangerZone …/>`, placed last.
- **Decision D7** for the lead, who owns `cloud-*` and `recovery.ts`: before an erase, (a) call the existing server `archive` op so the server keeps the pre-erase copy, or (b) write a local pre-erase snapshot under a new additive key. Until the lead answers, the tick copy states the truth.

**Tests and QA**
- `src/shell/danger.test.ts`: `canErase`, `cloudLine`, and `eraseSummary` against fixture profiles; corrupt keys give 0, never a throw.
- `src/shell/arena.test.ts`.
- New `scripts/qa/recovery.mjs` (dev, isolated, 3 sports):
  - `?qa-crash=` at root, view, arena and ut: the recovery UI is visible in the next frame and 0 screenshots are blank;
  - RELOAD returns to Home with coins, `ut.owned`, levels and XP deep-equal to before (`current()`);
  - aborting the attrs chunk (NBA/NFL) or the soccer engine chunk shows recovery, not "Walking out…" or a disabled PLAY.
- New `scripts/qa/settings-danger.mjs` (isolated, never clicks SAVE NOW or ERASE):
  - instrumented `Storage.prototype.setItem` counts 0 writes, and the route log shows 0 non-localhost requests, while the panel is open;
  - KEEP closes with the profile deep-equal;
  - all targets ≥ 44;
  - with a 310 px visual viewport (keyboard), the input, the tick and both buttons stay visible.

**Acceptance**
- An injected render error in root, view, arena or UT shows recovery within 1 frame in all 3 sports, with 0 blank screenshots. RELOAD keeps every listed field deep-equal.
- A failed match chunk always ends in recovery within 1 s.
- `arenaActive()` is true from `.arcade-full` insertion to removal for draft matches, UT matches, Training Camp and Moments (QA plus unit test). The observer's callback time over a 60 s match is ≤ 0.1 ms in total (CDP).
- M8:
  - 0 localStorage writes until ERASE is confirmed;
  - the panel lists the actual coins, level and cards per sport;
  - ERASE needs ≥ 3 deliberate actions;
  - every control stays visible at a 310 px viewport;
  - unit tests green.

**Screenshots:** `O/shots/shell/recovery/` (3 boundary kinds), `O/shots/shell/danger/` (collapsed, open, typed, ticked, keyboard).
**Protocol impact:** none. The boundary and the loader catch change nothing in a running match.
**Save-compat risk:** none. The reset handler and its kept fields are unchanged; the boundary never writes.
**Dependencies:** nba/nfl: 4 lines in `Arcade.tsx`, told via `shell.md`. ut: 2 wraps in `App.tsx`. lead: D7.
**Touched outside lane:** `src/game/Arcade.tsx` (4 lines), `src/App.tsx` (2 wraps and an import).
**Files:** `src/shell/{Recovery.tsx,recovery.css,arena.ts,arena.test.ts,danger.ts,danger.test.ts,DangerZone.tsx,danger-zone.css}` (new), `src/main.tsx`, `src/App.tsx`, `src/game/Arcade.tsx`, `src/ui/Pages.tsx`, `scripts/qa/recovery.mjs` (new), `scripts/qa/settings-danger.mjs` (new).

---

### shell-5 · P0 · Fit completion: full-matrix walker with tap timing, premium plates, M6, preserve and edge-state checks

**Size:** about 4–5 h. **Cut line:** the noise/accent cosmetic pass moves to shell-10 first.

**Why.**
- The brief requires every screen of all three sports to be verified.
- The sub-page headers, toasts and game HUD still need plates.
- The owner wants "production studio" headers.
- The audit's "what works well" must be protected by assertions, not by memory.
- Menu tap latency has no before number.
- The in-game edge frame must come from the real match path, not the Lab bench.

**Changes**
- New `scripts/qa/edge-walk.mjs`: the audit's ~50-screen list per sport through the real UI, with role and name selectors:
  - **Main app:** Home (top and scrolled), How to play, Missions, Gauntlet, the 4 mode tiles, Draft after a spin, Ranks, Profile, Settings with Advanced open.
  - **UT:** Home, Rewards, Daily, Records, Play and every Play mode (soccer's hidden modes recorded as `n/a`), Squad, Club Players, Filter, card detail, Tracker, Storage, Collection, Sets, Development, Evolutions, SBCs, SBC detail, Standouts, Objectives, Season Pass, Store, Odds, Market.
  - **Packs:** tear, walkout with SKIP, the grid.
  - **Real matches:** draft → Vote → PLAY vs AI, and a UT Squad Battle. Frames: kick-off, live play, the PlayReadout, NFL play-call/playbook, soccer shootout, and the pause menu where the sport team has added it.
  - **Edge states:** the rotated frame (`__fitAngle` as in `screen-fit.mjs`), and the keyboard open at a 310 px visual viewport (Welcome name, Search, the DangerZone input).
  - It runs on the kept build (`--phase before`, snippet with edge 0) and on the branch (`--phase after`), at 9 devices × 3 sports: all shots at 393 with the band, failure shots elsewhere.
  - **Tap timing at 1×:** every walker tap records input → next paint from Event Timing (max `duration` per `interactionId`), and the frame intervals over the 600 ms after each navigation.
  - **Preserve assertions** (audit §6 and likeness Part 4):
    - the PLAY bar rect is identical on every Home state, sport and device (± 1 pt);
    - back labels and EXIT texts equal the before snapshot;
    - 0 `hOverflow`, `docScroll` and `offscreen`; `.page` children are never squeezed;
    - pack cinema under reduced motion runs the same steps as before, with no animation on the listed selectors;
    - Cups and the card detail keep their sticky CTA.
  - A missing screen is reported, not fatal.
- `src/shell/plates.css`, **Fix C part 2**:
  - sub-page headers `.draft-head`, `.po-head`, `.vote-head` and `.evo-top` get the `::before` plate. Each is confirmed to start at `--sat`; any that doesn't is skipped and reported.
  - every toast class is opaque with the hairline.
  - **premium pass:**
    - an inline SVG `feTurbulence` noise tile ≤ 1 KB at 3–5% opacity, on a non-scrolling pseudo-element with `contain: paint`;
    - a centred 1 px accent highlight (teal main, gold UT);
    - `--plate-shadow` for depth.
  - **HUD scrim:** `.arcade-full::after` from y = 0 to `var(--ps-inset-top)` only (the raw inset, never `--sat`), `pointer-events:none`, below the HUD. It ships per sport only if the sprite check below passes; otherwise it is skipped for that sport and the camera note goes to that sport team.
  - The owner's Fix B device result decides the final plate colours.
- New `src/shell/targets.css`, imported after `plates.css`. **M6:** Draft `.respin` (38) and `.boost` (40) get `::before` hit areas ≥ 44 that don't overlap their neighbours at 320 (k = 0.82). `Draft.tsx` is unowned, so this is CSS only.
- Pack SKIP, QUICK SELL DUPES, TAP TO CONTINUE, the season chip and packs' new per-card actions are written as ≥ 44 acceptance items for packs and ut in `shell.md`, with today's measured sizes. shell adds no CSS for classes those teams are rewriting; shell-10 verifies them on the integrated branch.

**Acceptance**
- Walker coverage: ≥ 45 screens each for NBA and NFL and ≥ 38 for soccer per device, 0 page errors, ≤ 6 min per sport per device.
- After, on every screen at every device:
  - `textInBand = 0` and `controlInBand = 0`, including toasts, SKIP and the real-match HUD;
  - `bottomCut = 0`;
  - `docScroll`, `hOverflow` and `offscreen` all 0;
  - 0 new `overlap` pairs of effective hit areas, including the respin row at 320.
  Every exception is listed with its owner, selector and measured value.
- M6: no respin or booster in `small` at any device. The pack/UT items are listed for their owners.
- Plates:
  - probes pass on the sub-page headers;
  - the noise tile is ≤ 1 KB at 3–5%;
  - header repaint while scrolling Club Players and SBCs is ≤ 1 ms per frame at 4× (CDP paint events);
  - `plates.css` is ≤ 3 KB gzip.
- HUD scrim: it covers exactly y 0..inset. In 20 sampled frames per sport, with the scrim hidden, the canvas region y < inset holds no player, ball or rim pixels (compared against the court/field background palette). Counts are reported per sport.
- Preserve assertions all hold.
- Rotated: edge 0, nothing clipped. Keyboard: the focused input and primary buttons are visible.
- Tap timing at 1×, before and after:
  - p95 input → next paint ≤ 100 ms;
  - per navigation, ≤ 1 frame > 33 ms within 600 ms;
  - ≥ 55 fps average.
  Offenders are listed with owner and cause.
- Contact sheets exist: `O/shots/shell/{before,after}/sheets/<sport>-<device>.png`.

**Protocol impact:** none. **Save-compat risk:** none. Fixtures only.
**Dependencies:** sport teams: HUD offsets relative to `--sat`; sprite-under-scrim counts and the 320 NFL backfield note go to nfl (camera is theirs). packs/ut: the ≥ 44 items.
**Touched outside lane:** none. `plates.css` and `targets.css` are shell's files.
**Files:** `scripts/qa/edge-walk.mjs` (new), `scripts/qa/edge-lib.mjs`, `src/shell/plates.css`, `src/shell/targets.css` (new), `src/main.tsx` (1 import), `docs/studio-overhaul/shell.md`.

---

### shell-6 · P0 · Loading surfaces and in-game response: App-level arena curtain (M9), UT skeleton, frame sampler, in-game input latency

**Size:** about 4–5 h. **Cut line:** if ut has not agreed the real-chrome skeleton, the shell-only skeleton ships instead (same acceptance).

**Why.**
- About 1.2 s of black or empty court follows PLAY, at every mount point.
- `Arcade.tsx` is being restructured by nba/nfl for defense alternation, and Training and Moments mount games directly. An `Arcade`-embedded curtain would miss two mount points and collide at `Arcade.tsx:449-474`.
- The research rule "player-initiated actions must change the picture within 100 ms" (research §0 item 11, §4.2) is about in-game actions. No team measures it.

**Changes, curtain**
- New `src/shell/ArenaCurtain.tsx`, `arena-curtain.css` and `arena-tips.ts`.
- **App-level host** `<ArenaCurtainHost/>`, mounted once in `App.tsx` (1 line):
  - on `onArenaChange` (shell-4), when an `.arcade-full` appears, it waits **150 ms** and shows the curtain only if the arena is not ready yet;
  - the curtain is portaled to `<body>` at z 60 and laid out on the 390 frame with `--ps-inset-*` and the edge.
- **Ready** = the optional `ps:arena-ready` event (sport teams may dispatch it after their first real frame); else players' stable `mocapReady()` if they export it (asked in `shell.md`), falling back to a read-only `loadClip('ready')`; **and** the arena canvas drawn (a 4-pixel sample differs from the clear colour), then 2 rAFs. Hard cap 2,500 ms.
- No minimum time. Fade 150 ms, 0 under reduced motion.
- Content:
  - a sport mark SVG;
  - the matchup from an optional `setArenaInfo({ us, them, kits, mode })` that owners may call; without it, a generic title via `pick({ nba: 'TIP-OFF', nfl: 'KICKOFF', soccer: 'KICK-OFF' })`;
  - crests drawn in CSS/SVG from kit colours only, with no logos;
  - one tip from `arena-tips.ts` (`pick`, 4–6 per sport, checked against current controls, no EA/2K system names, chosen by a render-only hash);
  - a shimmer, static under reduced motion.
- `src/App.tsx`: the Arcade `Suspense` fallback becomes `<ArenaCurtain standalone/>` (1 line), so the chunk wait looks the same.
- **0 edits to `Arcade.tsx`, `Training.tsx` or `Moments.tsx`.**

**Changes, UT skeleton**
- `src/ut/pool.ts`, loading path only: `poolProgress()` / `onPoolProgress(cb)` with phases `fetch | expand | rate | cache | done` and counts. It emits at least every 250 ms while working.
- New `src/shell/UtSkeleton.tsx` and `src/shell/ut-skeleton.css`:
  - the **real UT chrome**: the UT header plate with `.ut-top`'s layout and the 6-tab bar, exactly as `UltimateTeam` renders them;
  - content placeholders shaped by `utReturnView()` (`UltimateTeam.tsx:277`): Home/Play/Squad/Club/Challenges/Store variants;
  - "Preparing your club · 64%" from `onPoolProgress`; static under reduced motion.
  - **Preferred** (agreed with ut, their change of about 3 lines): `UltimateTeam` renders its own `.ut-top` and tabs while `!pool`, with `<UtSkeletonBody view progress/>` in the content area. That survives ut's hub redesign.
  - **Fallback:** shell's 2-line hook in the `!pool` branch renders `<UtSkeleton view/>`.
- `src/App.tsx`: the UT `Suspense` fallback becomes `<UtSkeleton/>` (1 line).
- `UtLoadError`, offline-aware: "You're offline. Ultimate Team needs one online visit after each update." RETRY at 44 px.

**Changes, measurement**
- New `scripts/qa/frames.mjs`: CDP screencast at the maximum frame rate with timestamps, from the PLAY tap to gameplay. Each frame is classed curtain, empty (no curtain and stage luminance variance below a threshold calibrated on the audit's `match-*-01-pre.png`) or game.
  - Mount points: draft vs AI (Vote → PLAY) and a UT Squad Battle in 3 sports; Training Camp and Moments in NBA/NFL.
  - First and warm second match; 5 runs; 1× and 4×.
  - **Game time at lift:** the HUD clock text (shot/game/match clock) on the first game frame against its initial value. Also the engine tick count at lift with and without the curtain.
- New `scripts/qa/input-latency.mjs`: a real draft-vs-AI match per sport.
  - CDP `Input.dispatchTouchEvent` on: NBA shoot/pass/juke/sprint; NFL throw/juke/burst/stiff-arm; soccer pass/shoot/sprint/tackle.
  - The screencast finds the first frame where the controlled sprite's pixels change, in a window around the name tag that marks the controlled player.
  - 20 inputs per action, 1× and 4×, p50/p95. Before on the kept build, after on the branch.

**Acceptance**
- Curtain:
  - shown only when the arena isn't ready within 150 ms;
  - on screen p50 ≤ 700 ms and p95 ≤ 1,200 ms at 1×, p95 ≤ 2,000 ms at 4×;
  - a warm second match adds ≤ 50 ms to tap → first game frame against before;
  - **0 empty frames** from tap to gameplay at all 4 mount points;
  - text ≥ 10 px and inside the safe area; reduced motion: no animation and fade 0;
  - 0 edits to `Arcade.tsx`, `Training.tsx` or `Moments.tsx` for the curtain.
- Game time at lift: measured per sport and mount point; target ≤ 0.1 s. A sport above it is reported to its team with the request to start its clock on the first drawn frame (their change; a protocol note if sim timing changes). The curtain never pauses the sim: the tick count at lift is the same with and without it (± 1).
- UT skeleton:
  - painted in the first frame after the UT tap at 4× (≤ 100 ms, no blank frame);
  - header and tab bar shift ≤ 1 px from skeleton to ready;
  - the progress label updates at least every 250 ms at 1× and 4×;
  - static under reduced motion.
- In-game input latency: numbers for every action and sport, before and after, with frame evidence, in `shell.md` for nba, nfl, soccer and players. The ≤ 100 ms p95 at 1× / ≤ 150 ms at 4× target is the owning teams'. shell's code is not in the input path (asserted: no shell listener on the arena).

**Screenshots:** `O/shots/shell/curtain/` (4 mount points × sports, normal and reduced motion), `O/shots/shell/skeleton/` (3 sports, 2 views).
**Protocol impact:** none. The curtain is an overlay; tick counts are asserted equal.
**Save-compat risk:** none.
**Dependencies:**
- ut: the skeleton hook agreement, plus 2 one-line fallbacks in `App.tsx`;
- players: a stable `mocapReady()` (or keep `loadClip` stable);
- sport teams: optional `ps:arena-ready` / `setArenaInfo`, and clock start;
- packs: `pool.ts` progress hunks stay in loading paths.
**Touched outside lane:** `src/App.tsx` (3 lines), `src/ut/UltimateTeam.tsx` (2 lines, fallback path only).
**Files:** `src/shell/{ArenaCurtain.tsx,arena-curtain.css,arena-tips.ts,UtSkeleton.tsx,ut-skeleton.css}` (new), `src/ut/pool.ts`, `src/App.tsx`, `src/ut/UltimateTeam.tsx`, `scripts/qa/frames.mjs` (new), `scripts/qa/input-latency.mjs` (new).

---

### shell-7 · P0 · UT opens fast: JSON-parse modules, unclamped yields, sliced expand, rated-pool cache, gated prefetch (P-1)

**Size:** about 4–5 h. **Cut line:** the gated Home prefetch moves to shell-10 first.

**Why.**
- Evaluating 2.9–3.7 MB JS-literal modules causes the 385–669 ms long tasks.
- `expandCards` is one 150–280 ms synchronous call at 1×.
- `setTimeout(0)` yields clamp to ≥ 4 ms.
- Rating costs 4.2–4.4 s at 4× on every session, though it is deterministic per build.

**Changes**
- `vite.config.ts`: `json: { stringify: true }`. Every JSON module becomes `export default JSON.parse("…")`. This covers `cards-*`, `season-references-*`, `nfl-combine` and `numbered-*`; every consumer uses `default` (grep-verified).
- New `src/shell/json-imports.test.ts`: fails on any `import { … } from '….json'` or `import * as … from '….json'` in `src`. `stringify` disables named JSON imports, and players' appearance data or packs' calendar data could add one.
- New `src/shell/yield.ts`:
  - `yieldToMain()`: `scheduler.yield`, else a `MessageChannel` post (no 4 ms clamp);
  - `nextFrameSlice()`: rAF, then `MessageChannel`.
- `src/ut/cards.ts`, **minimal yield hook** (packs is changing promo/legend/special derivation inside `expandCards`):
  - the body moves into `function* expandSteps(…)` with about 6 one-line `yield;` points (inside the seasons loop every 2,000 lines, and between the promos, legends and specials stages);
  - `expandCards` becomes a 5-line synchronous drain with the same signature;
  - new `expandCardsAsync` drains with `yieldToMain` on an 8 ms budget.
  No other line of the body changes.
- `src/ut/pool.ts`, loading paths only:
  - `buildPoolInSlices` uses `yieldToMain` with an 8 ms budget, and `onPoolProgress` gets per-phase counts;
  - `poolBuilder.addRated(l, rc)` runs the same bucket and print code without `rateCard`.
  - `getPool()` after expand tries `readPoolCache`:
    - **on a hit:** build with `addRated`, re-rate a **seeded sample of 64 cards** (ids picked by hash of `APP_VERSION + sport`) and compare all own keys, and compare the computed print to the stored print. Any mismatch discards the cache and rates normally.
    - **on a miss:** rate, hand the pool to the UI, then `writePoolCache`.
  - `getPool({ background: true })` builds with `nextFrameSlice`. A later plain `getPool()` upgrades the same in-flight build (one shared promise).
- New `src/ut/pool-cache.ts`:
  - Cache Storage `ps-pool` (not localStorage, not a save, not in cloud saves);
  - key `[APP_VERSION, sport, CONTENT_PRINT, schedule()?.version ?? '', lines.length]`; disabled when `APP_VERSION === 'dev'` unless tests enable it;
  - columnar chunks of 2,500 cards with a dictionary (field list mirrors `RatedCard`; the tests compare **all own keys**, so a field added later fails loudly);
  - writes in `nextFrameSlice` slices ≤ 6 ms, through `shellWork('pool-cache')`, so nothing is written while an arena is up;
  - `QuotaExceededError` is swallowed (no cache, no error);
  - writing a new key deletes older ones; ≤ 6 MB per sport.
- New `src/ut/pool-prefetch.ts` + 1 line in `App.tsx`: `usePoolPrefetch()`. It calls `getPool({ background: true })` after Home has been visible ≥ 1.5 s and its intro animation has finished, only when all of these hold:
  - UT was opened for this sport in ≥ 1 of the last 3 sessions, from `ps-meta` `./__ut-recent.json`, written when UT opens;
  - the page is visible;
  - not `saveData`;
  - `shellWork('prefetch')` allows it.
  This gate addresses the iOS background-kill risk of +40–57 MB on 3–4 GB iPhones.
- `scripts/qa/perf-ut.mjs`: phases cold / warm (second load on the same build) / prefetched (Home idle 8 s), standard and heavy fixtures, 1× and 4×, on a measurement build (D1).

**Tests**
- `src/ut/pool-load.test.ts` (NBA, `PS_SPORT=nfl`) and `src/ut/pool-load-soccer.test.ts`. The **lasting invariants**:
  - `expandCardsAsync` deep-equals `expandCards` (ids, order, every field);
  - an async-built pool equals a sync-built pool (print, bucket membership and order);
  - a cache-built pool equals a fresh pool: every `RatedCard` own key, `rc.line === byId.get(id)`, bucket order, print.
  The print against `acdf3e2` is a branch-local check only; owner decision 5 and packs' rating changes will change it at integration.
- Purity: build the pool under two fake dates (`vi.setSystemTime` 2026-01-01 and 2026-07-01). The print and the 64-card sample must be identical. If not, the cache stays off and packs is told.
- Cache: a wrong key, a truncated chunk or a reordered id → `null`; a sample mismatch → discard and re-rate; `QuotaExceededError` on put → swallowed; no writes while an arena is active (fake DOM).

**Acceptance** (`perf-ut.mjs`, production build; before = §3 and shell-1)
- Longest task during UT open ≤ **200 ms** at 4× in every phase, sport and fixture.
- **Warm** (cache hit), tap → UT ready: ≤ **2,500 ms** at 4× NBA/NFL (from 7,395 / 8,974), ≤ 800 ms soccer; ≤ 900 ms at 1×. With the heavy fixture, pool resolved → UT Home interactive ≤ 300 ms at 1×.
- **Prefetched:** prefetch completes ≤ 6 s after Home idle at 4×; tap → UT ready ≤ 1,500 ms at 4×, ≤ 600 ms at 1×. During prefetch, no long task > 50 ms, and a mode-tile tap paints in ≤ 100 ms at 1×. Prefetch never runs for a player who hasn't opened UT in the last 3 sessions.
- **Cold** (first open on a build, tapped within 2 s of Home): ≤ 1,500 ms at 1× NBA/NFL (≤ 400 soccer); ≤ 6,000 ms at 4× NBA/NFL, ≤ 1,000 soccer. This is below STREAM's unqualified 2.5 s: sign-off D6.
- **Heap** after UT open (after GC): NBA ≤ 45 MB, NFL ≤ 55, soccer ≤ 38 (from 55.5 / 68.8 / 46.2); a prefetched Home session within the same ceilings. A miss triggers 6b in shell-10.
- **Pool cache:** `writePoolCache` total main-thread time ≤ 150 ms at 1× and ≤ 600 ms at 4×, no slice > 8 ms; hit read + build ≤ 300 ms at 1×; sample re-rate ≤ 5 ms at 1×; ≤ 6 MB per sport; exactly 1 key per sport after a version change; `__psShellWorkDuringArena` shows 0 cache or prefetch slices during matches.
- `dist`: no card data as a JS object literal; each card or reference file appears once.
- UT suites green in 3 sports.

**Protocol impact:** none. The cached pool is identical (tested), and the print is the UT queue guard.
**Save-compat risk:** none. New disposable caches `ps-pool` and `ps-meta`; no profile fields.
**Dependencies:**
- packs: `RatedCard` stays additive; `rateCard` stays a pure function of line + level (purity test), or packs tells shell; the `rateCard` profile from shell-1 is theirs to act on;
- ut: 1 line in `App.tsx`.
**Touched outside lane:** `src/ut/cards.ts` (the `expandCards` hook; ownership claim D3), `src/App.tsx` (1 line).
**Files:** `vite.config.ts`, `src/shell/yield.ts` (new), `src/shell/json-imports.test.ts` (new), `src/ut/cards.ts`, `src/ut/pool.ts`, `src/ut/pool-cache.ts` (new), `src/ut/pool-prefetch.ts` (new), `src/App.tsx`, `src/ut/pool-load.test.ts`, `src/ut/pool-load-soccer.test.ts`, `src/ut/pool-cache.test.ts`, `src/ut/pool-cache-soccer.test.ts` (new), `scripts/qa/perf-ut.mjs`.

---

### shell-8 · P0 · Offline and updates: per-sport groups, warm on first UT open, install and activate carry-over, no-loop updates (P-2)

**Size:** about 4–5 h. **Cut line:** the per-owner precache log moves to shell-10.

**Why.**
- Card files are cached only when fetched online on the current build, and `activate` deletes the old cache, so every deploy makes UT online-only again.
- Install re-downloads the whole ~8–11 MB precache with `cache:'reload'`, even for unchanged hashed files.
- The planned warm keyed on `ut.owned.length > 0` misses players who opened UT without claiming the starter, and parses other sports' multi-MB profiles on the launch path.
- Offline draft matches were never tested.

**Changes**
- `vite.config.ts` `pwa()`:
  - `GROUPS`, built from Rollup `moduleIds` and asset names:
    - `ut:nba` = cards-nba, season-references-nba, numbered-nba
    - `ut:nfl` = cards-nfl, season-references-nfl, numbered-nfl, nfl-combine
    - `ut:soccer` = cards-soccer
    - `sport:soccer` = `game/soccer2/**` chunks, `pixel/pitch.ts`, `data/soccer.json`, `soccer-*.mp3`
  - `PRECACHE` is everything else: the shell and UI chunks, **both NBA/NFL draft datasets and both attrs files** (the CLAUDE.md Codex rule), the calendar files, icons and the manifest.
  - `__GROUPS__` is injected into `sw.js`. The build logs precache bytes per group and per owner path prefix (`src/game/pixel` and `data/mocap` → players, `src/ut` → ut/packs, `src/game/hoops2` → nba, …) for the integrated budget.
- `pwa/sw.js` (ownership claim D3):
  - **install:** each `PRECACHE` URL with a content hash (`assets/…-<hash>.*`) is copied from an older `ps-app-*` cache when present, else fetched with `cache:'reload'`. Un-hashed files (`./`, manifest, icons, launch images) are always fetched.
  - **message** `{ type: 'ps-warm', groups }` → `waitUntil(warm(groups))`: skip what's cached, copy from old caches, else fetch and `put` (ok responses only). The groups are recorded in `ps-meta` `./__groups.json`.
  - **activate:** before deleting old caches, carry over every recorded group URL and `PRECACHE` URL present under the same hashed name. Then delete and `clients.claim()`.
  - **page():** stays network-first with `cache:'no-cache'`, because GitHub Pages HTML is HTTP-cacheable for about 10 minutes and `no-cache` revalidates. No navigation preload: it ignores `no-cache` and could feed stale HTML into the version check, causing reload loops. `NAV_TIMEOUT` (from 3,500 ms) is set by the throttled test within 500–1,500 ms.
  - `QuotaExceededError` is swallowed in `warm` and `put`. `version.json`/`sw.js` bypass, `cacheFirst` and the font cache are unchanged.
- `src/ut/pool.ts` (loading path): after the first successful `getPool()` per sport and build, post `ps-warm` `['ut:<sport>']` and record it in `ps-meta`. Players with 0 cards are covered.
- `src/lib/update.ts`:
  - after `ready`, read `ps-meta`'s recorded groups (Cache Storage; **no profile `JSON.parse`**);
  - post `ps-warm` for them, current sport first and the others after 10 s, plus `sport:soccer` when this page is soccer or the soccer profile key **exists** (presence check only);
  - through `shellWork('warm')`, so nothing runs while an arena is up; skipped on `saveData`;
  - the warmer regex also takes `.json` under `assets/`.

**Tests**
- New `src/lib/sw.test.ts`: evaluates `sw.js`, with placeholders filled, in `node:vm` with fake `self`, `caches`, `fetch` and `clients`. It checks that:
  - install caches exactly `PRECACHE` and no group URL;
  - install after a version change copies unchanged hashed files with 0 fetches and fetches changed and un-hashed ones;
  - `ps-warm` caches exactly the group URLs and records them;
  - `activate` carries recorded groups over with 0 fetches and deletes old caches;
  - a navigation network error gets the cached page;
  - a slow navigation gets the cached page at `NAV_TIMEOUT`;
  - `version.json` and `sw.js` are never cached;
  - quota errors are swallowed.
- `scripts/qa/startup.mjs`, extended (production build, isolated, injected fixtures):
  - **(a) Offline UT**, per sport, with the `standard` and `utNoStarter` fixtures: online Home → open UT → `ut:<sport>` cached → offline → reload → open UT → `.ut-tabs`, no "didn't load".
  - **(b) Update without a rebuild** (a copy with the `sw.js` VERSION and `version.json` patched):
    - reload online on NBA only; offline, NFL UT (opened before) still works;
    - auto-update applies on Home with "Updated to the latest version.";
    - a deploy that changes one chunk downloads ≤ changed bytes + 60 KB (request log).
  - **(c) Throttled update:** 1.5 s RTT and 400 kbps for 5 min, with a version change at t = 0:
    - the new build is reached within ≤ 2 reloads;
    - 0 reload loops (navigation count);
    - lie-fi (navigation hangs) relaunch to Home ≤ `NAV_TIMEOUT` + 600 ms.
  - **(d) Offline matches:** draft vs AI starts offline in NBA and NFL; in soccer once `sport:soccer` is cached; with it missing, shell-4's recovery shows within 1 s.

**Acceptance**
- UT offline works in **3/3** sports for anyone who opened UT online once on any build since this change, including `owned = 0` and a sport not reopened since an update (from 0/3).
- Install precache:
  - ≤ **8.3 MB** (from 11.5);
  - no cards, season-references, numbered or combine files;
  - draft data and both attrs files present;
  - a soccer-only player downloads 0 NBA/NFL UT bytes.
- A one-chunk deploy downloads ≤ changed + 60 KB. 0 re-downloads of unchanged files after a version change (`sw.test` plus the request log).
- Auto-update reaches the new build within ≤ 2 reloads at 1.5 s RTT, with 0 loops over 5 minutes.
- Draft-vs-AI matches start offline in NBA and NFL, and in soccer when cached.
- 0 warm fetches while an arena is up (`__psShellWorkDuringArena`).
- Warm relaunch to Home no worse than baseline + 50 ms (shell-9 improves it).

**Protocol impact:** none.
**Save-compat risk:** none. No profile reads or writes on this path; new disposable cache `ps-meta`; `ps-app-<version>` naming is kept, so old workers' caches clean up as before.
**Dependencies:** soccer keeps its lazy chunks under `game/soccer2/`. The lead re-checks the precache list on the integrated build (D8).
**Touched outside lane:** `pwa/sw.js` (claim D3).
**Files:** `vite.config.ts`, `pwa/sw.js`, `src/ut/pool.ts`, `src/lib/update.ts`, `src/lib/sw.test.ts` (new), `scripts/qa/startup.mjs`.

---

### shell-9 · P0 · Boot and launch: lazy App started at once, OfflineBoot, splash floor, self-hosted fonts, launch continuity (P-2 offline soccer, P-3)

**Size:** about 4–5 h. **Cut line:** regenerating the launch images moves to shell-10 (the colour alignment stays).

**Why.**
- An offline first visit to soccer rejects a top-level-await data import in `App`'s static graph, and nothing renders.
- Every launch pays a fixed ≥ 1.15 s splash floor.
- The Google Fonts stylesheet blocks render.
- The offline relaunch takes 3.9 s.
- The launch images show the NBA ball for every sport, then the splash swaps to the sport's ball.

**Changes**
- New `scripts/qa/perf-startup.mjs`: an isolated port of `coldstart.cjs` phases A and B. Cold (4× CPU + 4G), warm, offline and lie-fi, per sport.
  - It records TTFB, App-module ready, the fonts wait, splash out, Home tab bar, FCP and CLS (`layout-shift` entries).
  - Google Fonts are served from a **local mirror** recorded once from `fonts.googleapis.com` / `fonts.gstatic.com` into the scratchpad, through `route.fulfill` under the same 4G throttle. Before (kept build, fonts allowed) and after are then measured the same way.
  - The root-cause split of the offline 3.9 s is recorded.
- `src/main.tsx`:
  - `const appModule = import('./App')` at module evaluation, and `const App = React.lazy(() => appModule.catch(bootFailure))`. The App fetch then overlaps the fonts wait instead of following it.
  - `ready` = App resolved **and** fonts: ≤ 1,000 ms on a first launch, 0 when `document.fonts.check('italic 900 48px Archivo')` passes.
  - The ball spins only if not ready within 250 ms. Fade 150 ms, 0 under reduced motion.
  - The Lab, Gallery and SoccerLab lines stay untouched (players may add `?pixel` routes there). The root boundary from shell-4 stays.
  - `bootFailure`: offline → `OfflineBoot`; online → `reloadForMissingFiles()` and a Reload screen.
- New `src/shell/OfflineBoot.tsx`:
  - plate-styled; "Soccer isn't downloaded on this phone yet. Connect to the internet once to play it offline.";
  - PLAY NBA / PLAY NFL write `perfect-season:sport` with a value from the existing sport list (as `SportSwitch` does) and call `location.reload()`;
  - TRY AGAIN calls `location.reload()`: a failed dynamic import is cached in the module map, so calling `import()` again would fail again.
- `src/styles.css` `.splash` transition: 0.45 s → 0.15 s.
- **Fonts, self-hosted:**
  - Archivo variable woff2 (SIL OFL 1.1), latin + latin-ext, roman and italic, wdth 62–125, wght 400–900. Source: Google Fonts or the `@fontsource-variable/archivo` npm package (both reachable).
  - Files go in `public/fonts/`, with `public/fonts/OFL.txt`.
  - New `src/shell/fonts.css`, imported first: `@font-face` with `font-display: swap` and `unicode-range`. `'Archivo Fallback'` (`local('Arial')`, with size/ascent/descent overrides tuned so a 14 px body line box matches within 1 px) is appended to the `:root` stacks (a small `styles.css` hunk).
  - `index.html`: remove the Google preconnects and stylesheet. A `preload` for a Home-first-paint face is added **only if** the A/B cold-4G measurement shows a net FCP gain; otherwise there is no preload.
  - `vite.config.ts`: the font files join `PRECACHE`. `docs/CREDITS.md`: a separate "Fonts" section (players also edit this file).
- New `src/shell/font-coverage.test.ts`: scans player and team names in `src/data/{nba,nfl,soccer}.json` and `cards-*.json` for codepoints outside the declared `unicode-range`. 0 allowed.
- **Launch continuity:**
  - one surface colour across the launch images, `background_color`, `theme-color`, the splash background and `--plate-top` (ΔE2000 ≤ 2);
  - new `scripts/make-launch-images.mjs` (Playwright) regenerates the 10 `public/launch-*.png` sport-neutral (wordmark only, no ball), each ≤ its current bytes;
  - the splash fades the sport's ball in, with no NBA → NFL swap.

**Acceptance** (`perf-startup.mjs`, production build, isolated, 390×844 DSF 3 as in the audit; before = kept build with the font mirror)
- Warm relaunch: Home tab bar ≤ **700 ms** (from 927–1,027); splash gone ≤ 900 ms.
- **Offline relaunch to Home ≤ 1,500 ms** in all 3 sports (from about 3,950).
- Cold at 4× + 4G, NBA: FCP ≤ 1,200 ms; interactive ≤ 2,100 ms; longest task ≤ 150 ms. Each is also no worse than the fonts-allowed before.
- CLS from the font swap ≤ 0.01 on Home and UT Home.
- 0 requests to third-party font hosts. An offline first launch after install renders Archivo from the precache.
- Fonts ≤ 260 KB in total; name coverage 100%.
- Startup JS gzip per sport ≤ §3 + 3% (773 / 645 / 592 KB).
- An offline first visit to soccer shows `OfflineBoot` within 2 s, with 0 page errors. PLAY NBA returns to NBA Home offline. A unit test proves `OfflineBoot` writes only `perfect-season:sport`, and only valid values.
- No ball in the launch images; the launch image, splash and plate colours are within ΔE2000 ≤ 2.
- `startup.mjs` (a–d) still green, including auto-update.

**Protocol impact:** none. **Save-compat risk:** none. The only write is `perfect-season:sport` with a valid value, as the sport switcher already does.
**Dependencies:** players: the `CREDITS.md` section and the untouched `?pixel` lines in `main.tsx`.
**Touched outside lane:** `docs/CREDITS.md` (a new section).
**Files:** `src/main.tsx`, `src/shell/OfflineBoot.tsx` (new), `src/shell/fonts.css` (new), `src/shell/font-coverage.test.ts` (new), `public/fonts/*` (new), `public/launch-*.png`, `public/manifest.webmanifest`, `index.html`, `src/styles.css`, `vite.config.ts`, `docs/CREDITS.md`, `scripts/qa/perf-startup.mjs` (new), `scripts/make-launch-images.mjs` (new).

---

### shell-10 · P0 · Final QA, docs, integration re-run and buffer

**Size:** part A about 3 h plus run time; part B about 2 h once the integrated branch exists; part C time-boxed to 2 h.

**Why.**
- The team's final QA: the full suite and one build.
- Fix A shifts every team's screens and HUDs by 8–22 pt, so the collisions appear only on the lead's integrated branch.
- Earlier cut lines and conditional items need a home.

**Part A, branch final QA (always):**
- `heavy.sh npm run typecheck`, the full `heavy.sh npm test`, and `heavy.sh npm run build` (once).
- The scripts: `screen-fit`, `edge-headers`, `edge-walk --phase final` (9 devices × 3 sports, contact sheets), `home-matrix`, `recovery`, `settings-danger`, `frames`, `input-latency`, `perf-ut`, `startup`, `perf-startup`.
- A **4× tap pass** on 30 primary actions (from `edge-walk`).
- The audit's `matchperf.cjs` (already isolated, line 17) for NBA and NFL at 390, 430 and 320, at 1× and 4×, plus the soccer lab bench.
- Build checks:
  - no `qa-crash` code in production;
  - the precache table by owner;
  - each card file once in `dist`;
  - the Arcade, soccer and admin chunks still dynamic.
- Docs:
  - `docs/OVERHAUL-SCREEN-FIT.md`: edge clearance, plates, QA overrides, devices;
  - `docs/OVERHAUL-PERFORMANCE.md`: pipeline, rated cache, groups, launch;
  - `docs/BROWSER-QA.md`;
  - `shell.md` completed: before/after tables, tests, "Protocol bump needed: none", touched outside lane, owner device checks, what's left undone.
- Stop the dev server.

**Part B, integration re-run** (when the lead publishes the integrated branch; otherwise handed to the lead as one command): new `scripts/qa/shell-matrix.mjs --base <url>` runs, against a detached read-only checkout under the scratchpad or the lead's own dev server:
- `edge-walk` at 9 devices, including the new HUDs (pause/quit, Auto-defend, SIM per possession, shot clock, play-call);
- `home-matrix` with ut's Home strip;
- M6 ≥ 44 for the packs and ut items;
- H1 from every entry point, including packs' M2 grid and players' redesigned CardDetail;
- `frames` at every mount point, including the new solo ones (owner decision 2);
- `input-latency`;
- the pool-cache invariants on re-rated cards (owner decision 5: sync == async == cached);
- font coverage on new data;
- the integrated precache ≤ 9.0 MB with per-team allowances.
Findings are reported by owner. shell-owned fixes go to `claude/studio-shell`.

**Part C, buffer** (in this order, each only if its trigger fires):
1. any failed acceptance from shell-1 to shell-9;
2. **6b, fetch-as-JSON**, if a heap ceiling was missed. It covers `cards-*`, `season-references-*`, `nfl-combine` and `numbered-*`. It needs four resolution paths (browser fetch, vitest alias, vite-node, the artifact build) and a `dist` duplicate rule: if a file can't appear exactly once, keep `stringify` and record the heap;
3. the gated prefetch, if it slipped from shell-7;
4. **per-sport mocap chunks**, after players' ~40 new clips have landed, only if clip requests per match are still > 3: `manualChunks` per sport, ≤ 60 KB gzip each, 1 request per match, no other sport's clips;
5. cosmetic items cut from shell-5 or shell-9.

**Acceptance**
- Part A:
  - typecheck clean, full `npm test` green, the single build succeeds;
  - every script passes with 0 page errors and 0 non-localhost requests;
  - 4× taps p95 ≤ 200 ms, and ≤ 4 frames > 33 ms within 600 ms per navigation at 4×;
  - match fps no worse than §3 (NBA 390 4× ≥ 54.8 fps, p99 ≤ 33.4 ms; NFL ≥ 57.5 fps);
  - `__psShellWorkDuringArena` = 0 in every match, Training and Moments included;
  - every before/after number recorded.
- Part B: on the integrated branch, `textInBand = 0`, `controlInBand = 0` and `bottomCut = 0` on every screen and device; the Home matrix passes; every target ≥ 44; precache ≤ 9.0 MB. Otherwise each exception is listed with owner, selector and measured value, and shell's own are fixed.
- Part C: each triggered item meets the acceptance written in its originating task.

**Protocol impact:** none. **Save-compat risk:** none.
**Files:** `scripts/qa/shell-matrix.mjs` (new), fix files as found, `docs/OVERHAUL-SCREEN-FIT.md`, `docs/OVERHAUL-PERFORMANCE.md`, `docs/BROWSER-QA.md`, `docs/studio-overhaul/shell.md`; for 6b: `src/ut/cards-load.ts`, `src/ut/cards-load.module.ts`, `src/ut/cards.ts`, `src/soccer-lazy.ts`, `vite.config.ts`.

---

## 5. Deferred or conditional, with reasons

- **Rating the pool in a Web Worker.** CDP's 4× throttle doesn't represent worker cost, it doubles transient memory (about +50 MB, an iOS background-kill risk), and it complicates the single-file artifact build. Revisit only if the owner's phone shows a slow first UT open after an update.
- **Build-time precomputed ratings.** Four teams change rating code in parallel, and owner decision 5 re-rates everything. A precomputed file would drift. The per-build runtime cache gives the warm-path win safely.
- **An owned-first lazy pool** (rating only owned cards before UT's first paint). It is the only route to < 2.5 s at 4× on a first open after a deploy, but it restructures `Pool` and buckets, which packs owns and is changing. Proposed jointly with packs after integration if D6 is refused.
- **Conditional, in the shell-10 buffer:** fetch-as-JSON (6b), a slipped prefetch, per-sport mocap chunks.
- **P-4 renderer work** (sprite budget, size quantization, pooled canvases, close-up caps, the `drawBody` `finish()` loop): players and the sport teams own it. Shell supplies the numbers and guarantees no shell work during matches.
- **Removing dead v1 code** (`game/sprites.ts`, `game/hoops/*`, `game/football/*`): owned by players/nba/nfl, and already tree-shaken.
- **The warmer double-fetching game chunks** (P-5): likely a `vite preview` artifact; re-checked in shell-10 only.
- **Audit L items owned by others:** L1 tab-badge contrast (ut); L2 outside the header (ut/players); L3 events scroller fade (ut); L4 name truncation (players/ut); L5 Standouts back label (ut); L9 difficulty nudge (ut).
- **L8, Ranks offline skeleton 5 s → 3 s:** the timeout is in lead-only `src/net/leaderboard.ts` (D10).
- **Status-plate colours beyond main, UT, sheet and immersive:** only if the owner's device check asks for them.
- **Push notifications:** they need a push backend; out of scope.
- **Mode renames:** owner decision 1, names stay.

## 6. Cross-team dependencies and lead decisions

| Team | What shell needs or changes | Size |
|---|---|---|
| all | Use the QA snippet from day 1 (`O/qa-snippets/shell-edge.mjs`). Fix A moves content 22 pt down on island phones; HUD and overlay offsets stay relative to `--sat`. Keep the class names listed in shell-3/4/5. | announcement |
| ut | Switch `clubhouse.css:1366` and `content-ui.css:1021/1038` to `var(--ps-inset-top, env(…))`. Agree the real-chrome skeleton (≈ 3 lines in `UltimateTeam.tsx`) or accept shell's 2-line fallback. Home strip within the published budget (D5). ≥ 44 for the season chip and the new hub targets. Header contents are ut's; the plate surface and `--plate-*` tokens are shell's (D4). `App.tsx`: 2 boundary wraps and 4 one-liners (curtain host, Arcade fallback, UT fallback, prefetch). | small hooks |
| packs | ≥ 44 for SKIP, QUICK SELL DUPES, TAP TO CONTINUE and per-card actions. `RatedCard` stays additive. `rateCard` stays pure (line + level), or packs tells shell. Act on shell-1's `rateCard` profile. `expandCards` gets only the generator hook. `pool.ts`: shell edits loading paths only. | coordination |
| players | A stable `mocapReady()` export (or a stable `loadClip`). Keep `.ut-detail-btns`, or move card actions to a non-scrolling footer. Default-only JSON imports for appearance data (guard test). `CREDITS.md`: separate sections. The final clip set before per-sport chunking. | small |
| nba / nfl | `Arcade.tsx`: 4 lines in the loader effect (shell-4). Optional `ps:arena-ready` / `setArenaInfo`. Start game clocks on the first drawn frame if shell-6 measures > 0.1 s. Receive in-game latency and sprite-under-scrim numbers. | small hook |
| soccer | Keep chunks under `game/soccer2/`. Optional `ps:arena-ready`. Clock start. Latency numbers. | none |

**Decisions needed from the lead** (written in `shell.md` on day 1):
- **D1.** Approve ≤ 1 measurement `vite build` per perf task (shell-7/8/9) into the scratchpad, before shell-7. If refused, every perf acceptance moves to shell-10.
- **D2.** Approve the early-ship gate's single full `npm test` and `npm run build` in shell-3 (the unit's own final QA). If refused, the lead's release build is the gate.
- **D3.** Ownership claims:
  - `pwa/sw.js` (unassigned);
  - `src/ut/cards.ts` loading path plus the `expandCards` generator hook;
  - `src/evolution/evolution.css` `.save-warning` / `.camp-overlay` (unowned);
  - a "Fonts" section in `docs/CREDITS.md`;
  - CSS-only targets for unowned `Draft.tsx`.
- **D4.** Header plates: shell owns the plate surface and the `--plate-*` tokens (the shared API); ut owns header contents (STREAM-ut P1 "Header plates").
- **D5.** Home's vertical layout has one owner, shell. ut's strip gets a fixed budget; the proposal is the `.tagline` row's slot.
- **D6.** Sign-off on the P-1 cold target: first UT open after a deploy, tapped within 2 s, ≤ 6,000 ms at 4× for NBA/NFL. STREAM says < 2.5 s, which is met for warm and prefetched opens.
- **D7.** M8: before an erase, call the server `archive` op, or write a local pre-erase snapshot (lead-owned `cloud-*` / `recovery.ts`).
- **D8.** An integrated precache budget of ≤ 9.0 MB, with per-team allowances from shell-8's per-owner log.
- **D9.** The pointer branch `claude/studio-shell-edge` for the early ship.
- **D10.** L8: the Ranks fetch timeout in `src/net`.

**Merge hot spots:** keep every hunk small and never reformat these files: `src/styles.css`, `src/App.tsx`, `src/ui/Pages.tsx`, `src/game/Arcade.tsx`, `src/ut/pool.ts`, `src/ut/cards.ts`, `src/ut/nav.css`, `src/ut/UltimateTeam.tsx`, `src/main.tsx`.

## 7. Owner device checks (copied into `shell.md`)

Early ship (shell-3):
1. Installed-app screenshots of Home and UT Home. Measured with the audit's method:
   - "LEVEL N" peak luminance ≥ 160 against "x/y XP" at about 168 (ratio ≥ 0.95);
   - edge sharpness ≥ 90 (today 21–26);
   - nothing looks cut off at the top.
2. Settings → diagnostics reads `safe 59/34 · edge 22`. On an iPhone Air, it also tells us the real top inset (the plan assumes ≈ 68).
3. Fix B: does the band become a flat colour? Is there a seam on UT Home? With a sheet open, is the strip dimmed like the rest? On pack opening, does the band show the tier colour?
4. The card detail: the bar sits flush with the bottom, with no stats below it, from Club and from a pack.
5. Home in every mode: nothing sits under the PLAY fade.

Later (shell-10):
6. PLAY → match in draft, Squad Battles, Training Camp and Moments: a curtain or the game, never black.
7. Airplane mode:
   - relaunch to Home in < 1.5 s;
   - UT opens for every sport opened before, including after an update;
   - a draft match vs AI starts;
   - weak signal (lie-fi) relaunch is capped by the worker timeout.
8. The first UT open after a deploy, then a second open: the second is near-instant.
9. Archivo renders on the first offline launch after install. NFL and soccer launches show no NBA ball.
10. Reset Progress needs Advanced, ERASE typed and the tick. KEEP closes with no change.

## 8. Risks and decision points

- **Home margin.** Three island phones sit within 3.4 px of `snug` after the edge. Mitigation: the class reads the raw room, the hint line goes, and the 9-device `home-matrix` runs in shell-2 and again on the integrated branch.
- **Text in the fade.** Glyph tops between inset + 22 and inset + 26 still sit in the simulated fade. `TEXT_CLEAR` checks text at inset + 26 and controls at inset + edge.
- **Fix B is unverifiable in Chromium.** The overlay-aware plate prevents the day-one regressions. Disabling it is a one-line CSS change. The device check decides.
- **`:has()` cost** on large UT pages is measured in shell-3, with a fallback.
- **HUD shift.** Fix A moves every HUD item down by up to 22 pt (`styles.css` 7856–8329, `coach-controls.css` up to sat + 185, `soccer2.css`, `play-readout.css`). shell-5 walks real matches; shell-10 re-walks the new HUDs. The scrim covers only the raw inset.
- **Rated-cache staleness.** If `rateCard` gains a date, schedule or profile input (weekly in-forms, calendar promo caps, owner decision 5), a cache would serve stale ratings into matches and split UT queues. Guards: the purity test, the per-hit 64-card re-rate, and the version key.
- **Game time under the curtain.** The curtain doesn't change it (the same time burns behind today's black screen), but it is now measured, and sport teams are asked to start clocks on the first frame.
- **Update loops.** No navigation preload, `no-cache` revalidation, and the throttled 5-minute no-loop test.
- **Heap.** Prefetch is gated on recent UT use; the ceilings are hard numbers; 6b is the fallback.
- **The precache budget erodes** as teams add art, clips and appearance data. Mitigation: the per-owner log and D8.
- **Fonts on the critical path.** The preload ships only if the A/B measurement shows a net FCP gain.
- **The edge on non-iOS-26 devices** costs 8–22 px of top room. Accepted for consistency, with no UA sniffing.
- **Measurement builds (D1)**: without them, perf acceptance lands in shell-10.
- **Ownership collisions** (`Arcade.tsx`, `App.tsx`, `Pages.tsx`, `main.tsx`, `cards.ts`, CardDetail, `CREDITS.md`): each is reduced to the hunks listed in the tasks, and the D3/D4/D5 claims go to the lead.

## 9. Critique response (revision 2)

Each critique point and where it is handled. "Partly" and "Rejected" give the reason.

**Missing items**
1. Early-ship path → **shell-3**: a self-contained unit with its own gate, a pointer branch and the handoff. Fix B's device result feeds shell-5.
2. No error boundary → **shell-4**: root, view and tab boundaries (arenas covered through React portal ancestry), RELOAD / BACK TO HOME, `errlog`, no save writes.
3. Arcade loaders without `.catch` → **shell-4** (4-line hook that throws into the boundary) and **shell-8 (d)** (offline startup cases).
4. Games mounted outside Arcade → **shell-4** `arena.ts` uses DOM detection (a non-subtree body observer, since all engines portal to `<body>`); **shell-6** the App-level curtain host.
5. In-game input latency → **shell-6** `input-latency.mjs` for 3 sports, numbers to the sport and players teams.
6. Heavy profile → **shell-1** fixture and first-render cost report to ut/packs; **shell-7** acceptance (pool → UT interactive ≤ 300 ms at 1×). Note: `rareInfo` is cached per pool and `ratedOf` per `id@level`, so the cost is first-render only, which is what is measured.
7. Production fixtures → **shell-1** serialized from dev, injected with `addInitScript`.
8. Device matrix → **shell-1/2**: 9 devices, including 402, 420, 440 and 375×812 (§3 table).
9. Raw `env()` rules → **shell-2**: listed for ut; the two unowned `evolution.css` rules switched with the lead's grant. `.save-warning` was found too.
10. The plate covering overlays → **shell-3**: overlay-aware plate (UT colour, scrim colour, hidden on immersive screens).
11. Home budget vs ut H4 → **shell-2** plus D5; re-run in shell-10.
12. M1 in every state → **shell-1** `home-matrix` baseline, **shell-2** acceptance.
13. Missing before numbers → §3 rule. **Partly:** each harness's first run is on the kept build (which never changes), not all in shell-1, because those harnesses are built in their own tasks. Fonts-allowed startup uses a local mirror under the same 4G throttle (shell-9).
14. Warm keyed on `owned > 0` → **shell-8**: warm on the first successful `getPool`, recorded in `ps-meta`; no profile parsing on launch.
15. Deploy bandwidth → **shell-8**: install copies unchanged hashed files from the old cache.
16. Lazy App ordering and TRY AGAIN → **shell-9**: `import('./App')` at module evaluation; TRY AGAIN calls `location.reload()`.
17. `nfl-combine` / `numbered-*` → **shell-7** (`stringify` covers them); 6b includes them if triggered.
18. Launch continuity → **shell-9**: neutral launch images and one colour (ΔE ≤ 2).
19. Preserve assertions → **shell-5** (audit §6, Part 4) and **shell-8** (draft data and attrs in the precache).
20. M8 beyond the copy → **shell-4**: real amounts, the acknowledgement, ≥ 3 actions, D7. **Partly rejected:** requiring cloud status "saved" before ERASE, because the server keeps only the latest revision (`archive` runs only on conflict, `cloud-sync.ts:240`). "Saved" would not make an erase recoverable, and it would block offline players. Replaced with the state-worded acknowledgement plus D7.
21. Real-match edge frames → **shell-5**: draft → Vote → PLAY and UT Squad Battle, with pause, play-call, shootout and readout states.
22. Font coverage → **shell-9** `font-coverage.test.ts`.

**Restructuring**
1. Split shell-1 → done: shell-1 = 1a; the walker = shell-5, after the early ship.
2. Split shell-3 → done: 3a in shell-3 (ships); 3b in shell-5. HUD verification after the sport teams' rework is in shell-10 B.
3. Split shell-5 (M8/M9) → done: M8 in shell-4; M9 an App-level host in shell-6 with 0 `Arcade.tsx` edits and optional `setArenaInfo`.
4. `arena.ts` early → **shell-4**, before every perf task.
5. Split shell-6 → done: 6a in shell-7 with a generator yield hook (no shared-inner refactor); 6b conditional in the shell-10 buffer.
6. Measurement builds and a buffer → D1 before shell-7; the buffer is shell-10 C.
7. Split shell-10 → **partly:** the 10-task cap. The harness half is spread over the tasks that need it (taps in shell-5, frames and input in shell-6, UT in shell-1/7, startup in shell-9). The audit's isolated `matchperf.cjs` replaces a new port. shell-10 holds final QA (A), the post-integration re-run (B) and the buffer (C), each with its own acceptance.
8. Early QA snippet → **shell-1**.
9. M6 on rewritten screens → **shell-5**: Draft only in shell CSS; pack/UT targets as their teams' acceptance items, verified in shell-10 B.
10. Mocap chunks → moved last and made per-sport (shell-10 C, after players' clips).
11. The `acdf3e2` print → the lasting invariants are sync == async == cached plus bucket order (shell-7); the print is a branch-local check only.
12. Real-chrome skeleton → **shell-6**, agreed with ut, with a fallback.

**Risks**
1. M8 QA → never clicks SAVE NOW or ERASE; asserts 0 writes and 0 non-localhost requests (shell-4).
2. Raw reads, quota → raw `getItem` + `JSON.parse` only in `eraseSummary`; no profile reads on warm or prefetch paths; the `OfflineBoot` write is tested; quota swallowed (shell-4/7/8/9).
3. Rated-cache staleness → purity test, 64-card re-rate on every hit (shell-7).
4. Curtain game time → measured, target ≤ 0.1 s; requests to the sport teams; tick-count equality (shell-6).
5. `sw.js` / `cards.ts` ownership → D3.
6. `Arcade.tsx` conflict → the curtain has 0 edits there; the load hook is 4 lines in the loader effect.
7. Header plates ownership → D4.
8. Shared `Pages.tsx` / `App.tsx` / `main.tsx` → hunks listed per task; `main.tsx` keeps the Lab/Gallery lines untouched.
9. CardDetail entry points → H1 scoped to `.sheet.bottom`, every entry point tested, request to players (shell-3); re-run in shell-10 B.
10. `loadClip` / `CREDITS.md` → `mocapReady()` request with a fallback; a separate credits section.
11. Named JSON imports → guard test (shell-7).
12. Precache erosion → per-owner log, D8.
13. Prefetch heap → gated on recent UT use (shell-7).
14. Cache write cost, noise repaint, font preloads → budgets in shell-7, shell-5 and shell-9.
15. Text in the fade → `TEXT_CLEAR` (shell-1/2).
16. HUD shift, scrim height, NFL at 320 → raw-inset scrim, sprite check, nfl note (shell-5).
17. Rotated, keyboard, hit-area overlap → shell-5.
18. Fixed 350 ms curtain → replaced: 150 ms show delay, no minimum (shell-6).
19. Navigation preload loops → **rejected** for navigation preload: dropped. `no-cache` kept; `NAV_TIMEOUT` tuned; no-loop throttled test (shell-8).
20. Branding → tips and crests rules (shell-6); OFL kept (shell-9).

**Targets.** Adopted as written, except:
- **P-1 cold:** the critique's "≤ 3,500 ms at 4× when tapped within 2 s of Home" is **rejected** as a shell acceptance. Rating alone costs 4.2–4.4 s at 4× in packs-owned code, so the plan sets ≤ 6,000 ms, asks for sign-off (D6), and sends packs the profile. Warm, prefetched and heap targets are adopted.
- **Lie-fi relaunch ≤ 1,100 ms:** **partly.** It is set to `NAV_TIMEOUT` + 600 ms, with the timeout tuned between 500 and 1,500 ms by the no-loop test. A lower timeout serves more stale pages and risks update reloads, so 1,100 ms holds only if 500 ms passes that test.
- **In-game input ≤ 100 / 150 ms:** shell measures and reports; the target belongs to the sport and players teams, who own the input and animation code.
- **Game time at lift ≤ 0.1 s:** measured and requested; engine clocks are not shell's code.
- **Owner photo luminance and sharpness:** an owner device check (§7.1), plus the band-simulated Chromium crops in shell-3.
