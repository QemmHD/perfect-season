# Team shell: iPhone fit, app shell, loading, offline, performance

Branch `claude/studio-shell`. Plan: [shell-plan.md](shell-plan.md). `O` below means the overhaul scratchpad (`/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`). Nothing in this file is live until the lead merges and ships it.

## Messages to other teams (read this first)

- **QA snippet: see final top-edge geometry on your branch today.** `O/qa-snippets/shell-edge.mjs` (repo copy `scripts/qa/edge-snippet.mjs`, identical). Before your first `page.goto`:
  ```js
  import { applyShellEdge, rawEnvRules } from '<O>/qa-snippets/shell-edge.mjs';
  await applyShellEdge(context, { insets: [59, 0, 34, 0] }); // 393×852, the owner's phone
  ```
  It sets `window.__psInsets`, `--ps-inset-*`/`--ps-edge` on `<html>`, the stage's `--sat` (inset + 22 pt edge, in frame px) and `.arcade-full`'s `--sat`/`--sab`/`--sal`/`--sar` (screen px). Without it Chromium's `env()` is 0, so match HUDs and overlays sit **81 pt higher** than they will on the phone. Measured on untouched `acdf3e2` at 393: `.arcade-full --sat` 0 → **81 px**, stage `--sat` 58.55 → **80.382 frame px** (= 81/k), Home's LV ring 65 → **87 pt** (+22), the NBA score bug 8 → 89 pt. **Lead: please forward this path to every team.**
- **Rules that read `env(safe-area-inset-*)` directly** can't be moved by the snippet and stay inside the blurred band on a phone. `rawEnvRules(page)` lists them; on Home today: `.save-warning` and `.camp-overlay` (`src/evolution/evolution.css`, shell-2 asks the lead for that grant). UT CSS loaded later adds `.hq-moment-overlay` (`ut/clubhouse.css`), `.ut-so-stamp` and `.ut-lm-ticker` (`ut/content-ui.css`): **ut team**, please write those as `var(--ps-inset-top, env(safe-area-inset-top, 0px))` (+ `var(--ps-edge, 0px)` for anything with text). That form works on your branch before shell merges.
- **Fixtures.** `O/fixtures/<profile>-<sport>.json` for `standard`, `heavy`, `utNoStarter`, `checkpoint` (and `fresh`) in all three sports, made on `68123cc` (= `acdf3e2` source). Use them with `fixture(browser, sport, name, width, ctxOptions, { profile: 'heavy', insets, height, standalone: true })` and `PS_QA_FIXTURES=O/fixtures`. `heavy` is the long-time player the UT redesign must stay fast for (2,003 / 1,998 / 2,005 copies).
- **Isolation is now built into `browser.mjs`.** Every non-localhost request is aborted. Scripts that talked to the live registry or cloud saves (`content.mjs`, `circulation.mjs`, `cloud.mjs`) now see those calls fail as if offline; do not work around this against live hosts. Their local stand-in is task **shell-1b** (owner shell, with shell-5; `shell-plan.md`).
- **Never bind a QA relay to port 7777** (2026-11-16). `ws://localhost:7777` is where every team's isolated app points, and nothing listens there normally; a relay on it would hand your fake peers and events to every other team's run. Start yours on an ephemeral port and pass `fixture(…, { relay: 'ws://localhost:' + port })`. `home-matrix.mjs` and `online.mjs` now do this.
- **The fixtures are week-stamped** (2026-11-16). The `O/fixtures` files were made 2026-11-10 (app week 2026-W46); from 2026-11-16 (W47) `heavy`'s circuit run, battles week and objectives describe last week. Cards, levels, evolutions and the Pack Tracker are unaffected. `loadFixture` now warns once per stale file; remake weekly with `node scripts/qa/fixtures.mjs make` on a dev server.
- **perf-ut: compare by ratio to the same-run control, not by ms** (2026-11-16). Default N is 5; each sport also runs the 0-card `utNoStarter` control interleaved; rows carry `ratioToControl`. Above a 1-minute load of 4 the result is saved as `.noisy.json` and is not a baseline.
- **shell-2 landed Fix A (every team, read "Announcements" under shell-2):** `--sat` now includes the 22-pt status-bar edge on island phones; `<html>` carries `--ps-inset-*` / `--ps-edge`; `useLayout()` gains `edge` and `room` (`content` is now the room below the edge). **Lead:** D3 (evolution.css) was used for 3 `top` declarations; D5 (Home budget) has shell's proposal and the measured table under shell-2.
- **ut / packs: the heavy first-render costs and the rating costs** are in "UT open: costs" below. The rating step (packs-owned `rate.ts`, `card-face.ts`, `ut-scale.ts`) is most of the open; the first render after the pool is 120–210 ms.

## shell-2 · Fix A (top-edge clearance), Fix D (hygiene), M1 (Home in every state), L6 (done)

Layout only. No saves, storage keys, ids, match rules or protocol changed. Part of the early-ship unit with shell-1 and shell-3.

### What changed

- **Fix A: content starts below the blurred band.** `src/stage-layout.ts`:
  - `topEdge(t) = min(22, round(0.4 t))` (`EDGE_MAX = 22`): 59/62/68 → 22, 50 → 20, 47 → 19, 20 → 8, 0 → 0.
  - `Layout` gains `edge` (frame px; 0 when rotated, where iOS hides the status bar, and on framed desktop/tablet layouts) and `room` (`h − sat − sab`, the old `content`).
  - `content` is now `room − edge`. `fit` is `fitFor(room)`, so the edge never changes a phone's class. `sat` stays the raw inset.
- `src/stage.tsx`:
  - The stage sets `--sat` = inset + edge, plus `--inset-top` (raw) and `--edge`.
  - A layout effect publishes `--ps-inset-{top,right,bottom,left}` and `--ps-edge` (screen px) on `<html>`, from `readInsets()`, which honours `window.__psInsets`.
  - The `setBox` equality check includes `edge` and the four raw insets.
  - `viewportInfo()` reads `… · safe 59/34 · edge 22 · …`.
- `src/styles.css` `.arcade-full`: `--sat` = `var(--ps-inset-top, env()) + var(--ps-edge, 0px)`; `--sab/--sal/--sar` = `var(--ps-inset-*, env())`. On a phone these equal `env()` (+ the edge on top). In Chromium they follow `__psInsets`, so match HUDs are QA'd where they will really sit (audit L7).
- **Raw-env rules (grant D3)**, `src/evolution/evolution.css`:
  - `.save-warning` → `var(--ps-inset-top, env()) + var(--ps-edge, 0px)`.
  - `.camp-overlay`, portrait and landscape → `var(--ps-inset-top, env())` (raw inset, no edge). Measured in Training Camp at 393: score bug 89–123 pt, camp overlay 146–184. With the edge it would have collided with the play-call row at `--sat + 104` (185).
- **M1, Home in every state** (`src/ui/Pages.tsx` granted hunk, `src/styles.css` Home block):
  - Home's class reads `room` (one token), so it is identical to `acdf3e2` on all 9 phones.
  - The Classic hint "1 free team respin and 1 free decade respin every draft." is gone; How to play already says it. The hint slot under the modes keeps its height in every mode, so picking a mode never moves a tile.
  - The 26-px upward shadow on PLAY becomes an 8-px `::before` fade (`pointer-events: none`). The spacer has a 10-px floor, so the last row never sits under the fade, at rest or scrolled to the end.
  - Home's vertical budget is tightened by 50 frame px, scoped to `.page-view.home`:
    - logo margins 9/10 → 3/4;
    - hero `flex: 4 0 82px`, min 82 (was 88), margin 12 → 10;
    - actions row margin 9/9 → 9/0, and hidden when empty (soccer without a saved run: its 18-px margins were the dead gap);
    - modes margin 12 → 10;
    - mode tiles 72 → 64 on non-snug Homes;
    - Training Camp card padding 11 → 9.
    Room left over goes to the hero (4:1 with the spacer) instead of a gap above PLAY. That is the soccer dead-gap fix: the hero takes the room, rather than a second spacer splitting it, which keeps the gap inside 8–24 pt on every phone.
- **Fix D hygiene:**
  - `index.html`: the stale comment ("the same rule is in styles.css") now says the inline standalone rule is the only copy, and that QA injects it.
  - **L6:** the description is now "Spin a random NBA, NFL or soccer team and decade, draft a lineup of legends, and go for a perfect season." in `index.html` and `public/manifest.webmanifest`.
- `scripts/qa/screen-fit.mjs` now covers:
  - all 9 phones with their own insets, in Safari and with the standalone rule forced;
  - `textInBand = 0`, `controlInBand = 0` and topmost ≥ inset + edge on Home and UT Home;
  - Settings diagnostics `safe 59/34 · edge 22`;
  - `--ps-edge` 0 when rotated;
  - the in-game `.hg2-bug` ≥ inset + edge + 8 on 9 phones × 3 sports.
- `scripts/qa/browser.mjs` `dismissPack`: SKIP is replaced mid-animation in the pack cinema. A plain click could time out (it crashed the first `edge-headers` run on NBA 440), so it now falls back to a forced click.

### Before / after

**Top edge**, kept build `acdf3e2` → this branch (dev server), standard player, `edge-headers --phase fixA`, 9 phones × 3 sports, `O/shots/shell/shell-2/fixA/`. Each cell is the topmost text/control in pt.

| Phone | Home / UT Home | UT tabs | SKIP | Draft | Match frame | Band text runs / controls (whole walk) |
|---|---|---|---|---|---|---|
| 393×852 (59/34) | 65.0 → **87.0** | 74.1 → 96.1 | 71.1 → 93.1 | 63.0 → 85.0 | 73 → 95 | 22–27 / 6 → **0 / 0** |
| 402×874 (62/34) | 68.2 → 90.2 | 77.5 → 99.5 | 74.4 → 96.4 | 66.1 → 88.1 | 76 → 98 | 22–27 / 6 → 0 / 0 |
| 420×912 (68/34) | 74.5 → 96.5 | 84.2 → 106.1 | 80.9 → 102.9 | 72.3 → 94.3 | 82 → 104 | 21–26 / 6 → 0 / 0 |
| 440×956 (62/34) | 68.8 → 90.8 | 78.9 → 100.9 | 75.5 → 97.5 | 66.5 → 88.5 | 76 → 98 | 12–19 / 6 → 0 / 0 |
| 430×932 (59/34) | 65.6 → 87.6 | 75.5 → 97.5 | 72.2 → 94.2 | 63.4 → 85.4 | 73 → 95 | 19–26 / 6 → 0 / 0 |
| 390×844 (47/34) | 53.0 → 72.0 | 62.0 → 81.0 | 59.0 → 78.0 | 51.0 → 70.0 | 61 → 80 | 20–26 / 6 → 0 / 0 |
| 375×812 (50/34) | 55.8 → 75.8 | 64.4 → 84.4 | 61.5 → 81.5 | 53.8 → 73.8 | 64 → 84 | 22–27 / 6 → 0 / 0 |
| 375×667 (20/0) | 24.8 → 32.8 | 33.5 → 41.5 | 31.5 → 39.5 | 21.0 → 29.0 | 34 → 42 | 0 / 5 → 0 / 0 |
| 320×568 (20/0) | 24.1 → 32.1 | 31.5 → 39.5 | 29.8 → 37.8 | 20.8 → 28.8 | 33 → 41 | 1 / 5 → 0 / 0 |

- At 393, in all three sports:
  - topmost control (the LV ring) 87.0 pt (≥ 81);
  - "LEVEL" cap top 92.7 (≥ 85);
  - UT Home's first text cap top 100.7.
- The match frame's `.arcade-full --sat` resolves to 81 px from the app itself (`arcade: app`); before, it was 0 and had to be emulated.
- 27 runs, 0 page errors, 0 failed steps; the only blocked host is the app's own Supabase launch call (aborted).
- The card-detail bar still floats 34 pt (H1 is shell-3).

**Score bug** (`screen-fit.mjs`), top in pt, the same in NBA, NFL and soccer: 393 **89** (inset + edge + 8 = 89), 402 92, 420 98, 440 92, 430 89, 390 74, 375×812 78, 375×667 36, 320 36. Before: inset + 8 (67 at 393).

**Home in every state** (`home-matrix --phase fixA`): 432 states (4 modes × saved run × online × 3 sports × 9 phones), 0 page errors, 0 class mismatches.

| | Before (`acdf3e2`) | After |
|---|---|---|
| NBA/NFL, no saved run | overflows on every phone (6–19 pt); the hint line sits under PLAY | **fits on all 9 phones**; gap to PLAY 8.2–11.2 pt |
| Soccer, no saved run | fits with a 27–39 pt dead gap | fits; gap 12.0–19.8 pt; the hero takes the rest |
| NBA/NFL, saved run | scrolls 83–96 | scrolls 61–79 |
| Soccer, saved run | scrolls 17–30 | scrolls 2–17 (fits at 390 and 440) |
| Last row clears the fade at scroll end | 0 of 360 overflowing states | **200 of 200** |
| A fitting state's last row under PLAY or its fade | n/a | 0 of 232 |
| PLAY bar and tab bar rects vs baseline | | identical (0 moved by > 1 pt) |
| Text/control in the band; bottom cut; document scroll > 1 | 432 / 0 / 0 | 0 / 0 / 0 |

- In the overflowing (saved-run) states the column scrolls under the 8-px fade at rest. That is the scroll cue: PLAY never moves, and every row is reachable and clears the fade at the end.
- The remaining hit-area overlaps the audit lists in those states (AI chips × PLAY) come from `::before` hit areas that the scroller clips. A tap there lands on PLAY.
- Sport-switch neighbours overlapping by 2 px is pre-existing (unchanged).

### Home budget (D5: shell owns Home's vertical layout, ut owns its strip's contents)

Row heights in pt, from the top: logo / sport switch / hero / stat strip / actions / modes / hint slot. Online on; Classic and 1v1 are identical, because the slot height never changes. "Slack" is what the column can give up before it scrolls: the hero above its 84-px box minimum, plus the spacer above its 10-px floor.

| Phone | Sport | Saved run | Rows | Gap to PLAY | Slack |
|---|---|---|---|---|---|
| 393 | NBA/NFL | none | 76.2 / 38.3 / 88.4 / 30.2 / 54.4 / 139.1 / 40.3 | 10.1 | ≈ 4 |
| 393 | NBA/NFL | yes | 76.2 / 38.3 / 84.6 / 30.2 / 132.0 / 139.1 / 40.3 | scrolls 74 | − 74 |
| 393 | soccer | none | 76.2 / 38.3 / 146.5 / 30.2 / – / 139.1 / 40.3 | 15.5 | ≈ 67 |
| 393 | soccer | yes | 76.2 / 38.3 / 84.6 / 30.2 / 69.5 / 139.1 / 40.3 | scrolls 12 | − 12 |
| 402 | NBA/NFL | none | 78.0 / 39.2 / 92.5 / 30.9 / 55.7 / 142.2 / 41.2 | 10.3 | ≈ 6 |
| 402 | soccer | none | 78.0 / 39.2 / 151.6 / 30.9 / – / 142.2 / 41.2 | 16.3 | ≈ 71 |
| 420 | NBA/NFL | none | 81.5 / 40.9 / 94.8 / 32.3 / 58.2 / 148.6 / 43.1 | 10.8 | ≈ 4 |
| 420 | soccer | none | 81.5 / 40.9 / 156.9 / 32.3 / – / 148.6 / 43.1 | 16.6 | ≈ 72 |

- **Proposal for D5 (lead decision).**
  - The `.tagline` slot is 0 pt on all 9 phones: it shows only on `tall` Homes, ≥ 816 frame px of room, which no phone has. So ut's H4 strip cannot get room from it alone. On NBA/NFL a strip of any height makes the no-saved-run Home scroll.
  - shell proposes the strip **takes the `.tagline` slot in the DOM, and replaces the stat-strip row (30 pt + 8 margin) by absorbing its four chips** (streak, live count, missions, Gauntlet). Then the budget holds at ≈ 38 pt.
  - Alternatively it sits inside the hero, which keeps 82 px minimum.
  - shell-10 re-runs `home-matrix` on the integrated branch either way.

### Tests

- `src/stage-layout.test.ts`: all 13 prior tests unchanged and green, plus 13 new ones:
  - the `topEdge` table, including NaN/∞/negative;
  - for each of the 9 phones: raw `sat`, `edge × k`, `room × k = H − t − b`, `content × k = H − t − edge − b`, `room` and `fit` equal to `acdf3e2`'s values;
  - the 393 class-threshold case;
  - edge 0 when rotated (both ways) and when framed;
  - no inset and a 30-px viewport.
- `scripts/qa/edge-lib.test.mjs` (changed because the meaning of `content` changed by design, not because it was a bug): `expectedLayout.room` is compared with `stageBox.room`, `roomAfterEdge` with `content` and `edge` with `edge`, and the edge table also checks the app's `topEdge`.

### Verification

- `bash O/heavy.sh npm run typecheck`: pass.
- `PS_QA_FIXTURES=O/fixtures PS_QA_SNIPPET=O/qa-snippets/shell-edge.mjs bash O/heavy.sh npx vitest run src/stage-layout.test.ts src/engine/sport-branches.test.ts scripts/qa`: 6 files, 58 tests pass.
- `PS_SPORT=nfl … vitest run src/stage-layout.test.ts src/engine/sport-branches.test.ts`: 28 pass. `PS_SPORT=soccer … vitest run stage-layout sport-branches`: 28 pass.
- Dev server on 5211:
  - `screen-fit.mjs` passes: Safari and standalone, 9 phones, keyboard, browser controls, rotation, UT Home, diagnostics, score bug × 3 sports, 0 errors.
  - `edge-headers.mjs --phase fixA --devices all`: 27 runs, 0 errors or failed steps, 0 band findings.
  - `home-matrix.mjs --phase fixA --devices all`: 432 states, 0 errors or class mismatches.
- No width media query and no `screen.height` were added (grep of the diff).
- Screens looked at:
  - Home at 393: NBA Blind, NBA 1v1 with a saved run, soccer Classic; Home at 375×667 (1v1).
  - UT Home with the band at 393; NFL pack SKIP with the band; soccer match frame with the band; NBA match at 320.
  - NBA Training Camp at 393 (`O/shots/shell/shell-2/camp/`).

### Announcements (every team)

- **Every screen now starts 22 pt lower on island phones** (19–20 on notch phones, 8 under a 20-pt status bar), because `--sat` includes the edge.
  - Offsets written as `calc(var(--sat) + N)` move with it, and that is intended. HUDs and overlays stay relative to `--sat`.
  - Inside `.arcade-full`, `--sat` is the screen-px inset + edge.
  - A layout that needs the raw inset can read `--inset-top` (stage, frame px) or `--ps-inset-top` (`<html>`, screen px).
- Rules that use raw `env(safe-area-inset-top)` must become `var(--ps-inset-top, env(safe-area-inset-top, 0px))`, plus `var(--ps-edge, 0px)` for anything with text. **ut:** `ut/clubhouse.css:1366`, `ut/content-ui.css:1021` and `:1038` still read raw `env()`.
- `useLayout().content` is now the room below the edge; `room` is the old value. `Results.tsx` ShareSheet's `content − 310` card cap is therefore 22 px smaller on island phones, matching the 22-px-shorter sheet.
- The QA snippet (`O/qa-snippets/shell-edge.mjs`) stays valid: on this branch it sets the same values the app already sets.

### Protocol bump needed

None. Layout only; the HUD moves are render-only. No engine reads `--sat`. The only reader, the legacy `game/hoops/Hoops.tsx`, has no importer.

### Touched outside my lane

- `src/evolution/evolution.css`: `.save-warning` and `.camp-overlay` (portrait and landscape), 3 `top` declarations. These are the D3 grant the plan requests.
- `src/ui/Pages.tsx` (shared): the Home class token and the Classic hint line, within shell's granted Home hunk.

### Owner device checks

- In the installed app on the 393×852 phone, screenshot Home and UT Home. The LV ring, "LEVEL N" and the coins should sit fully below the blurred band, with "LEVEL N" as bright as "x/y XP".
- Settings → bottom note reads `safe 59/34 · edge 22`.
- In a match, the score bug sits clear of the band.
- On Home, nothing is hidden under PLAY. With a saved run, the column scrolls and its last row stops above PLAY's fade.
- The 420×912 phone's top inset (68) is still an estimate; its diagnostics line confirms it.

## shell-1 · QA harness core, production fixtures, team QA snippet and baselines (done)

### Review fixes (2026-11-16)

An independent review of `68123cc..05ea3f4` found two medium and three low issues. All five are fixed or tracked. QA only: no saves, keys, ids, match rules or protocol changed.

- **The detail-bar audit counted hidden text (medium).** `detailBarAudit` counted a text run when the hit-tested element was the run's own element, a descendant of it, or an **ancestor** of it. In the empty strip under the floating bar the hit is the `.sheet` itself, so the rows of the closed "ALL n ATTRIBUTES" `<details>` were reported as showing.
  - A run now counts only when its element passes `checkVisibility({ contentVisibilityAuto, opacityProperty, visibilityProperty })` and the point hits that element or a descendant.
  - `auditScreen`'s `invisible()` runs the same `checkVisibility()` test first, so closed `<details>` text can no longer enter `tiny`, `lowContrast` or `textInBand`.
  - New `scripts/qa/edge-lib.page.test.mjs` (3 tests) builds a static 393×852 sheet in real Chromium: a closed `<details>` whose rows lie in the strip and hit-test to the sheet, a tiny label inside it, and one visible row. With the old code all 3 tests fail (`['Run block 31', …]` reported, `Juke move 98 8px` in `tiny`). With the fix they pass. Opening the `<details>` brings the tiny label back, which proves the check still finds real text.
  - `edge-headers --phase before --devices all` was re-run on the kept build: 27 runs, 0 page errors, 0 failed steps, 274 s. Every topmost, band, control and bottom-cut number is identical to the first run (0 differences across 27 runs × 15 screens). Only `textBelowBar` changed; see the corrected H1 row and table below.
- **The stand-in relay could bind 7777 (medium).** `home-matrix.mjs` tried `127.0.0.1:7777` first, which is where every team's isolated app connects. It now always listens on an ephemeral port and passes that URL to `fixture()`. `online.mjs`, an older script, had the same problem (`new WebSocketServer({ port: 7777 })`) and is fixed the same way. `BROWSER-QA.md` now says QA relays never bind 7777.
- **perf-ut timings were not reproducible at N = 3 (low).**
  - The default is now N = 5.
  - Each sport and rate also runs the audit's `utNoStarter` control with the audit readiness test, interleaved run by run, and every row gets `ratioToControl`.
  - Each run records the 1-minute load average and the heavy.sh slots in use. Above a median load of 4 the result is saved as `perf-ut-<label>.noisy.json` and the script exits 3 instead of writing a baseline (`--allow-load` overrides).
  - The existing 1× numbers below were taken at N = 3 without a control. They stay as recorded, but later comparisons should use the ratio.
- **Serialized fixtures drift (low).** `loadFixture` now reports `age` (`days`, `madeWeek`, `nowWeek`, `stale`) and warns once per file when the file is more than 6 days old or from another app week. `fixtures.mjs check` prints the age and a summary warning; `browser.mjs` returns it as `f.fixture.age`. `BROWSER-QA.md` documents a weekly `fixtures.mjs make`.
  - The `O/fixtures` files are from 2026-11-10 (W46) and are stale as of today (W47). They were **not** remade in this fix, because other teams may be mid-way through before/after comparisons on them. The lead or shell should remake them at a quiet point (followup).
- **content/circulation/cloud lost their isolated coverage (low).** This is now tracked as task **shell-1b** in `shell-plan.md`: a local registry and cloud-save stand-in (`scripts/qa/local-backend.mjs`), owned by shell and scheduled with shell-5, with the shell-10 buffer as its fallback.
- **Found while re-running.** The shell-2 session had left a dev server (`vite --port 5211`, started 12:43) running with no PID file pointing at it. My first `vite preview` therefore failed with "port in use", and that first re-run measured the shell-2 dev server instead of the kept build. I caught this from the topmost numbers (+22 pt everywhere), stopped that server by its PID, confirmed `index.html` matched the kept build byte for byte, and re-ran. The `before/` directory now holds kept-build results again. The figures quoted above all come from the second run.
  - **Root cause (lead, every team):** the BUILD-RULES start line `nohup npx vite … & echo $! > pid` records the PID of the `npx` wrapper. `kill $(cat pid)` stops that wrapper, but the `vite` child can keep running and keep the port; this happened twice here. Start the server as `nohup ./node_modules/.bin/vite --port <port> --strictPort … & echo $! > pid`, so the PID is vite itself. Before you start a server, also check that `vite.log` does not say "Port … is already in use".

QA only: no app code, CSS, saves or protocol changed.

### What changed

- `scripts/qa/browser.mjs`
  - `isolate(context)`: aborts every request and WebSocket to a host other than `localhost`/`127.0.0.1` (Google Fonts over https allowed; `data:`/`blob:` local) and lists each host in `f.blocked`. `allowedUrl(url)` is the rule. Every `fixture()` context uses it.
  - Optional sixth `fixture()` argument `{ insets, height, standalone, dsf, motion, profile, serialized, relay }`; the old five-argument calls behave as before (the standard fixture is still built from source on the dev server).
  - With `PS_QA_BUILD_ROOT` (a `vite preview` of a production build), fixtures come from the serialized files, never from `/src`.
- `scripts/qa/fixtures.mjs` (new): `make` (dev only, through the app's own modules) and `check` (dev or build, with an isolation probe), `inject(context, profile, sport)` (localhost only, only into empty storage, only `RECOVERY_KEYS` minus the signing key), `summarize`, `waitForHome`, `openUt`.
- `scripts/qa/edge-lib.mjs` (new): the 9 phones, `edgeOf` (mirrors `topEdge`, which shell-2 adds), `TEXT_CLEAR`, `expectedLayout`, `simulateBand`, `auditScreen`, `homeAudit`, `detailBarAudit`, `forceStandaloneRule`, `arcadeInsets`, `contactSheet`.
- `scripts/qa/edge-headers.mjs` (new): Home, Settings, UT Home and 5 tabs, card detail top/mid/end, pack SKIP, the Respin toast, Draft after a spin and a match frame, per sport × phone, with band shots.
- `scripts/qa/home-matrix.mjs` (new): 4 modes × saved run × online (a signature-verifying local relay with two signed stand-in players) × 3 sports × 9 phones.
- `scripts/qa/perf-ut.mjs` (new): the isolated port of the audit's UT-open measurement for production builds, with per-chunk (build) or per-function (dev) CPU profiles.
- `scripts/qa/edge-snippet.mjs` (new) and its shared copy `O/qa-snippets/shell-edge.mjs`.
- `docs/BROWSER-QA.md`: "Shell harness" section (env vars, isolation, options, devices, fixtures, runners, snippet, limits).

### Tests added

`scripts/qa/edge-lib.test.mjs`, `edge-snippet.test.mjs`, `fixtures.test.mjs`, `perf-ut.test.mjs` (30 tests; vitest picks them up in `npm test`):
- the 9 phones and their insets; the edge table (0/20/47/50/59/62/68 → 0/8/19/20/22/22/22) for edge-lib and the snippet; `expectedLayout` equals `stageBox` for every phone and reproduces the plan's room/class table;
- the snippet's init script at 393 gives exactly `.stage{--sat:80.382px}` and `.arcade-full{--sat:81px;--sab:34px}`, follows resizes, leaves landscape alone, and the shared copy is byte-identical (`PS_QA_SNIPPET`);
- `FIXTURE_KEYS` equals `RECOVERY_KEYS` without the signing key; the injector writes only allowed keys, only on localhost, never over an existing profile, and survives throwing storage; `allowedUrl` refuses example.com, Supabase, public relays, http fonts and look-alike hosts;
- with `PS_QA_FIXTURES` set, every serialized fixture holds only fixture keys and the promised player (heavy: 1,900–2,100 copies, ≥ 30% levelled, ≥ 50 evolved, 300 pull-log packs, full `ut.hq`);
- the CPU-profile aggregation splits at the end of the pool build.

### Acceptance results

| Acceptance | Result |
|---|---|
| Probe fetch to example.com aborted and listed; 0 requests to other non-local hosts | **Met.** `fixtures.mjs check`, 15 runs on dev and 15 on the kept build: probe `aborted`, `blocked` = `example.com` plus `ryqaibujweiwwvdtswxj.supabase.co` (the app's own launch call, aborted). Every edge-headers, home-matrix, perf-ut and snippet run lists only that Supabase host as blocked; nothing else left the machine. |
| heavy: 2,000 ± 5% copies, ≥ 30% levelled, ≥ 50 evolved (NBA/NFL), 300 pull-log packs, full `ut.hq` | **Met.** NBA 2,003 / 33.2% / 60 evolved + 2 evolving / 300 packs (1,200 cards); NFL 1,998 / 34.9% / 60 + 2 / 300 (1,050); Soccer 2,005 / 32.7% / 60 + 2 / 300 (1,480). `ut.hq`: season track (25 tiers claimed), 133–277 claims, 388–560 journal entries, 151 days, 23 weeks, 3 saved squads, 8 development programs done + 1 running, 5 moments, 6 circuit weeks + an active run, 160 matches, 6 SBCs. 59,672 coins, Level 19. |
| Every fixture loads on dev and on the kept build with 0 page errors, writes only existing keys, only on localhost | **Met.** 5 profiles × 3 sports on each: 0 page errors, summary unchanged after load, 0 foreign keys. Localhost-only and existing-keys-only are unit tested. |
| Main/UT header topmost at 65–76 pt at 393 | **Met.** Home and UT Home topmost control 65.0 pt (cap top of "LEVEL" text 70.7), UT tab headers 74.1, in all three sports. |
| Card-detail bar shows content below it at 393/390/402, not at 320 | **Met** (corrected 2026-11-16 with the fixed audit). The bar floats 34–34.7 pt above the sheet bottom on all 7 notch and island phones. Visible content shows under it in these cases (each checked against the screenshots):<br>- NBA: at the top (2 runs, "Lob City · Finishes alley-oops") and the middle (4 runs, the "ALL 19 ATTRIBUTES" row).<br>- NFL: at the top (3 runs, "THE 2007 SEASON"), plus the middle at 390 only (1 run, "LOCK AS FAVOURITE").<br>- Soccer: at the top (1–4 runs, the "ALL 6 ATTRIBUTES" row).<br>At the end of every sheet the 34-pt strip is empty (0 runs). The first run reported 4–7 runs there, all text of the closed `<details>`, which never paints. At 320 and 375×667 the gap is 0–0.4 pt and nothing shows. |
| Home classes on 9 phones match the computed table | **Met.** 432/432 matrix states and 27/27 edge-headers runs: `''`/`normal` on the 7 notch/island phones, `snug`/`tight` on 375×667 and 320×568. |
| Snippet on untouched `acdf3e2` at 393: arcade `--sat` 81 px, stage 81/k frame px, LV ring 22 pt down | **Met.** 81 px; 80.382 frame px (k = 1.00769, 80.99 screen px); 65 → 87 pt. |
| perf-ut standard 1× within ±15% of 2,123 / 2,092 / 679 ms | **Partly met** (N = 3, before the 2026-11-16 load guard and control; compare later runs by `ratioToControl`). See below: NBA 2,214 ms (+4%); NFL 2,484–2,708 (+19–29%); soccer 838–881 (+23–30%). With the audit's own 0-card player (`utNoStarter`) and its readiness test the port gives 2,195 / 2,355 / 737 ms (+3% / +13% / +9%), all within ±15%, and the heap numbers match the audit to 0.1–0.6 MB. The gap is the standard player's 40–69 owned cards, not the harness. |
| Heavy numbers recorded; heavy first-render table names the top 5 per sport | **Met** (below). |
| edge-headers for one sport over 9 phones ≤ 4 min; `screen-fit.mjs` still passes | **Met.** Kept build: 90 s NBA, 95 s NFL, 70 s soccer (3 contexts at a time; 120 s/sport on the dev server). `screen-fit.mjs` passes (Safari and standalone, 5 sizes, keyboard, rotation, 0 errors). |

### Baseline: top edge (kept build `acdf3e2`, standard player, `O/shots/shell/before/`)

Topmost text/control in pt (insets t/b). "Band" = text runs / controls inside the band over the whole walk.

Detail bar: the gap in pt, then the text runs showing below the bar at the top / middle / end of the sheet as NBA · NFL · soccer (re-measured 2026-11-16 with the fixed audit).

| Phone | Home / UT Home | UT tabs | SKIP | Toast cap top | Draft | Match frame | Detail bar gap; runs below (top/mid/end) | Band (text/ctl) |
|---|---|---|---|---|---|---|---|---|
| 393×852 (59/34) | 65.0 | 74.1 | 71.1 | 80.6 | 63.0 | 73 | 34; 2/4/0 · 3/0/0 · 4/0/0 | 26–27 / 6 |
| 402×874 (62/34) | 68.2 | 77.5 | 74.4 | 84.1 | 66.1 | 76 | 34; 2/4/0 · 3/0/0 · 4/0/0 | 22–27 / 6 |
| 420×912 (68/34) | 74.5 | 84.2 | 80.9 | 91.1 | 72.3 | 82 | 34–34.1; 2/4/0 · 3/0/0 · 4/0/0 | 21–26 / 6 |
| 440×956 (62/34) | 68.8 | 78.9 | 75.5 | 86.2 | 66.5 | 76 | 34–34.7; 2/4/0 · 3/0/0 · 1/0/0 | 12–19 / 6 |
| 430×932 (59/34) | 65.6 | 75.5 | 72.2 | 82.6 | 63.4 | 73 | 34; 2/4/0 · 3/0/0 · 1/0/0 | 19–26 / 6 |
| 390×844 (47/34) | 53.0 | 62.0 | 59.0 | 68.4 | 51.0 | 61 | 34–34.5; 2/4/0 · 3/1/0 · 1/0/0 | 20–26 / 6 |
| 375×812 (50/34) | 55.8 | 64.4 | 61.5 | 70.6 | 53.8 | 64 | 34–34.2; 2/4/0 · 3/0/0 · 4/0/0 | 22–27 / 6 |
| 375×667 (20/0) | 24.8 | 33.5 | 31.5 | 39.7 | 21.0 | 34 | 0–0.4; none | 0 / 5 |
| 320×568 (20/0) | 24.1 | 31.5 | 29.8 | 36.8 | 20.8 | 33 | 0–0.3; none | 1 / 5 |

Every header starts 6–17 pt below the inset, inside the 22-pt edge, on every notch and island phone. Match frames: NBA/NFL from the kept build's bench with the raw insets emulated; soccer's from the dev server (`O/shots/shell/shell-1/before-dev/`), because a build has no soccer bench. Contact sheets: `O/shots/shell/before/sheet-<sport>.png` and `sheet-<sport>-band.png`.

### Baseline: Home in every state (kept build, `O/shots/shell/before/home-matrix/`)

432 states, 0 page errors; the local relay brought the live count and "N in queue" up in every online state (216/216).

- **NBA and NFL: the last row is under the PLAY bar in all 144 states per sport.** The hint line (`.under`) ends 5.7–17.8 pt below the PLAY top with no saved run, and with a saved run the mode tiles go under too (33–93 pt under). Home overflows by 6–19 px without a saved run and 83–96 px with one, and at scroll end the last row still does not clear the fade: the scroller has no room for the PLAY bar. This is M1, and worse than the audit's single-state view; shell-2 fixes it.
- **Soccer:** fits with no saved run (27–39 pt dead gap above PLAY, the audit's M1 dead gap); with a saved run its last row goes 17–30 pt under PLAY in all 72 states.
- PLAY at 393: 672.9–755.5 pt; tab bar 755.5–852.
- Header in the band on every island/notch phone: 8–9 text runs and 3 controls (NBA/NFL), 2–3 / 3 (soccer).

### Baseline: UT open (perf-ut, kept build, 390×844, DSF 3, 1×, median of 3)

| Sport | Player | Tap → UT ready | Longest task | Long-task total | Heap Home → UT (after GC) | JS/JSON decoded |
|---|---|---|---|---|---|---|
| NBA | standard | 2,214 ms | 224 ms | 308 ms | 13.8 → 55.2 MB | 4.46 MB |
| NBA | heavy | 2,644 ms | 247 ms | 477 ms | 14.3 → 56.6 MB | 4.46 MB |
| NFL | standard | 2,708 ms (N=7: 2,484) | 300 ms | 386 ms | 11.4 → 68.7 MB | 6.11 MB |
| NFL | heavy | 2,716 ms | 245 ms | 452 ms | 11.9 → 69.8 MB | 6.11 MB |
| Soccer | standard | 881 ms (N=7: 838) | 225 ms | 304 ms | 11.5 → 45.7 MB | 4.13 MB |
| Soccer | heavy | 859 ms | 192 ms | 285 ms | 12.1 → 46.6 MB | 4.13 MB |

With the audit's readiness test (any `ut-` element, no spinner), median of 5: `utNoStarter` 2,195 / 2,355 / 737 ms and standard 2,001 / 2,481 / 750 ms. The audit's own (0 cards): 2,123 / 2,092 / 679 ms. Runs vary by ±20% on this shared 4-CPU machine (NFL standard: 3,002 / 2,230 / 2,708 ms), so later comparisons should use N ≥ 5. The 4× runs move to shell-7 (cut line).

Production profile, first run, self time by chunk: the shared `state-*.js` chunk (UT logic, rating and the card pool) takes 1.3–1.6 s of the NBA/NFL open and 0.26–0.31 s of soccer's; GC 0.09–0.26 s; `ratings-*.js` 0.12–0.25 s. Names are minified (no source maps), so function names come from the dev-server profile below.

### UT open: costs (for ut and packs)

Dev server, real function names, self time, one profiled run each (`O/shots/shell/shell-1/perf-ut/perf-ut-dev-attribution.json` and the `.cpuprofile` files next to it).

**Heavy player, first render after the card pool is built** (total self time: NBA 174 ms, NFL 210 ms, soccer 120 ms):

| Sport | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| NBA | `rateCard` (rate.ts) 10.2 ms | `context` (sbc.ts) 8.3 | `leader` (landmarks.ts) 7.7 | `nbaLandmarks` (landmarks.ts) 7.6 | `hashString` (engine/rng.ts) 7.5 |
| NFL | anonymous in standouts.ts:37 19.6 ms | `hashString` 9.6 | `standoutProgram` (standouts.ts) 8.8 | `context` (sbc.ts) 8.5 | `rateCard` 7.6 |
| Soccer | `context` (sbc.ts) 7.9 ms | anonymous in standouts.ts:37 7.5 | `hashString` 6.4 | `finish` (game/pixel/body.ts) 6.2 | `sbcsFor` (sbc.ts) 5.5 |

The heavy club adds little to the first render today (heavy 120–210 ms against standard 114–237 ms, within run-to-run noise); SBC context, Weekly Standouts and Landmarks are each computed in the first render and are the targets for memoising or deferring.

**Card pool build (rating every card line), standard player, ms per 1,000 lines** (packs owns `rate.ts`; `card-face.ts` and `ut-scale.ts` are on the same path):

| Sport (lines) | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| NBA (22,082) | `meanOf` (card-face.ts) 8.97 | `rateCard` 6.92 | `expandCards` (cards.ts) 5.35 | GC 5.03 | `along` (ut-scale.ts) 3.73 |
| NFL (32,242) | `along` (ut-scale.ts) 11.75 | `toDisplay` (ut-scale.ts) 5.34 | GC 4.85 | `expandCards` 2.85 | `calibrateNflReference` (season-reference.ts) 2.72 |
| Soccer (30,352) | GC 2.78 | `expandCards` 2.55 | anonymous in rate.ts:285 0.67 | `specialEditions` (specials.ts) 0.63 | `hashString` 0.55 |

### Verification

- `bash O/heavy.sh npm run typecheck`: pass.
- `PS_QA_FIXTURES=O/fixtures PS_QA_SNIPPET=O/qa-snippets/shell-edge.mjs bash O/heavy.sh npx vitest run scripts/qa`: 4 files, 30 tests pass.
- Dev server on 5211 (untouched `acdf3e2` source): `fixtures.mjs check` (15/15), `screen-fit.mjs` (pass), the snippet check, `perf-ut --cpu-profile all` (attribution), `edge-headers --devices all` (kept as `O/shots/shell/shell-1/before-dev/`; its pack-SKIP step failed under reduced motion before the fix below, then passed at 393/320 for NBA and soccer).
- Review fixes (2026-11-16): `PS_QA_FIXTURES=O/fixtures PS_QA_SNIPPET=O/qa-snippets/shell-edge.mjs bash O/heavy.sh npx vitest run scripts/qa`: 5 files, 37 tests pass (the 3 new page tests fail on the old `edge-lib.mjs`). `edge-headers --phase before --devices all` was re-run on the kept build (`index.html` md5 equal to the kept build's): 27 runs, 0 errors, 0 failed steps, 274 s; screenshots of the detail strips looked at for NBA/NFL/soccer at 393 and NFL at 390.
- Kept build (`vite preview` of `O/audit-scripts/likeness/build` on 5211): `fixtures.mjs check` (15/15), `edge-headers --phase before --devices all` (27 runs, 0 errors, 0 failed steps, 255 s), `home-matrix --phase before --devices all` (432 states, 0 errors, 0 class mismatches, 255 s), `perf-ut` 1× standard + heavy N=3, audit-readiness N=5, standard N=7.
- Screens looked at: the band shots of Home/UT Home/SKIP at 393, the card detail at its end (H1), Home with a saved run at 393 (tiles under PLAY), and the snippet's Home and match frame.

### Found and fixed while finishing the harness

- `fixtures.mjs` read `browser.mjs`'s `artifacts` while the two modules were still loading (they import each other). It only worked when `PS_QA_FIXTURES` was set; without it any script entering through `browser.mjs` would have crashed. It now computes its default directory itself.
- The pack-SKIP step waited for SKIP under reduced motion, where the pack reveals every card at once and never shows SKIP. That one pack now opens with motion on.

### Protocol bump needed

None (QA only).

### Touched outside my lane

None. The new `scripts/qa/*` files are shell's harness (OWNERSHIP: "`scripts/qa/browser.mjs` (harness improvements)" and the plan's file list).

### Owner device checks

None for this task (QA only). The device checks for the early ship (LEVEL brightness, `safe 59/34 · edge 22`, Fix B) are listed with shell-3.

### Left for later tasks

- 4× `perf-ut` runs: shell-7 (the plan's cut line).
- A local registry/cloud stand-in so `content.mjs`, `circulation.mjs` and `cloud.mjs` can run isolated again: now task shell-1b (owner shell, with shell-5).
- Remake `O/fixtures` (stale since 2026-11-16, week W47) at a point when no team is mid-comparison.
- The 420×912 top inset (68) is an estimate until read on a device.
