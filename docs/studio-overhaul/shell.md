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
- **shell-3: the header plate API (D4), every team that draws a top bar.** `src/shell/plates.css` publishes `--plate-top`, `--plate-bot`, `--plate-line` and the UT set `--plate-top-ut`, `--plate-bot-ut`, `--plate-line-ut` on `:root`. shell owns the surfaces: `.shell-top` carries the plate itself, and every `.screen > .topbar` (UT `.ut-top`, Results, Gauntlet, UT Match) gets a `::before` plate from y = 0 to its bottom, ending on a 1 px hairline. ut owns what sits on them. Please don't give a top bar its own background, and keep the class names `.shell-top`, `.topbar` (as a direct child of `.screen`), `.ut-top`, `.scrim`, `.ut-open-screen`, `.splash`, `.vs-splash` and `.screen.reveal`: the status plate keys its colour and visibility on them. **Review fix (2026-11-16):** the status plate is transparent unless a header is on screen, and stays transparent over these full-screen overlays drawn over a header screen: `.champ` (Champions / Perfect Season), `.cast` (GameCast), `.ut-pick-screen` (UT player pick), `.promotion` (Rivals) and `.sportfade` (sport switch). **ut, packs, players:** keep those class names on the overlays' root elements. A new full-screen overlay that sits over a header screen and is not a `.scrim` needs its class added to that rule in `src/shell/plates.css` (plain class, no combinators); tell shell, or the band shows a strip of the screen underneath.
- **players: keep `.ut-detail-btns`** in the CardDetail redesign (the H1 rule is `.sheet.bottom .ut-detail-btns`), or move the card actions into a non-scrolling sheet footer, which makes the rule unnecessary. Tell shell either way.
- **ut: a tap-blocking bug in Squad (found by shell-3's H1 probe, not fixed here, outside shell's lane).** In `src/ut/SquadView.tsx` the picker's DETAILS chip calls `close(() => props.onInspect(cur.uid))`. `Sheet.close(after)` runs `after` *instead of* `onClose`, so the picker is never unmounted: its scrim stays in the DOM as `scrim bottom closing`, invisible (its fade-out ends at opacity 0) and still covering the whole frame. After a player opens a card's DETAILS from the squad and closes the card, every tap on the Squad screen and the UT tab bar is swallowed until UT is reopened. Reproduced in all three sports at 393 and 320 (QA runs with reduced motion); with motion on, the code path is the same, because the 200 ms timer only delays `after`. One-line fix (ut's file): `onInspect={(uid) => { setPick(null); props.onInspect(uid); }}` at `SquadView.tsx:235`. A defensive second line for the shared sheet (whoever owns `styles.css` sheets): `.scrim.closing { pointer-events: none; }`.

## Early-ship unit (shell-1 + shell-2 + shell-3): handoff to the lead

Owner decision 6: the iPhone top-edge fix ships on its own as soon as it passes review. This section is the lead's review packet.

- **Commit range:** `acdf3e2..claude/studio-shell-edge`. The plan commits (`e951c09`, `68123cc`) are docs only. The code is in:
  - `05ea3f4` and `7f7655d` (shell-1, QA harness only);
  - `25c6f6a` (shell-2: Fix A, Fix D, M1, L6);
  - `05a6beb` (shell-3: Fix B, Fix C part 1, H1, L2);
  - `52f347e` (the shell-2 review fixes: Classic hint slot, saved-run Home tiles under PLAY, `.save-warning` sideways, legacy `Hoops.tsx` `--sat`; see shell-2 "Review fixes");
  - `55127fd` (the shell-3 review fix: the status plate is transparent on screens without a header and over full-screen overlays; see shell-3 "Review fixes").
  - `9729de6` and the branch tip are docs only (this handoff text). **The ship gate below ran on `55127fd`'s tree**, the code tip of the edge branch.
- **Pointer branch:** `claude/studio-shell-edge`, at `55127fd` plus the docs-only tip. Every move was a plain fast-forward push; no force, no rebase. It is **not** `claude/studio-shell`: that branch also carries shell-4 (recovery screens, the danger zone) and later shell work, which are not in the early ship. The shell-3 review fix is on both branches, as the same diff (`603cb7b` on `claude/studio-shell`), so the later merge applies it once.
- **Rollback:** revert the range, newest first: `git revert --no-edit 55127fd 52f347e 05a6beb 25c6f6a` reverts the app changes; the QA-harness commits can stay. Fix B alone can be switched off with one line in `src/shell/plates.css` (`html .status-plate { display: none; }`), and every plate with the `PLATES_OFF_CSS` rule in `scripts/qa/edge-lib.mjs`.
- **Protocol bump needed:** none. Layout and paint only; no engine reads any of it. **Save-compat risk:** none. No storage key, id, saved field or reward changes.

### Files in the unit (`git diff --stat acdf3e2..claude/studio-shell-edge`)

| What | Files |
|---|---|
| Ships in the app | `index.html` (status plate, its inline base, the description), `public/manifest.webmanifest` (description), `src/main.tsx` (1 import), `src/shell/plates.css` (new), `src/stage.tsx`, `src/stage-layout.ts`, `src/styles.css` (`.arcade-full` insets, Home budget, LV label, saved-run tiles), `src/ui/Pages.tsx` (Home class token and hint), `src/ut/nav.css` (H1), `src/evolution/evolution.css` (3 `top` declarations, D3, and `.save-warning` sideways), `src/game/hoops/Hoops.tsx` (legacy `--sat`) |
| Tests | `src/stage-layout.test.ts`, `src/shell/plates.test.mjs`, `scripts/qa/*.test.mjs` |
| QA harness (never shipped) | `scripts/qa/browser.mjs`, `fixtures.mjs`, `edge-lib.mjs`, `edge-snippet.mjs`, `edge-headers.mjs`, `home-matrix.mjs`, `perf-ut.mjs`, `plates.mjs`, `screen-fit.mjs`, `online.mjs` |
| Docs | `docs/BROWSER-QA.md`, `docs/studio-overhaul/shell-plan.md`, `docs/studio-overhaul/shell.md` |

32 files at the edge tip. The 11 files that ship in the app account for 269 added and 28 removed lines; the rest is tests, the QA harness and docs.

### shell-3 · Fix B (status plate), Fix C part 1 (solid header plates), H1, L2 (done)

#### Review fixes (2026-11-16)

An independent review of `7f7655d..9729de6` found four issues. Code fix: `603cb7b` on `claude/studio-shell`, the same diff as `55127fd` on `claude/studio-shell-edge`.
- **High: a flat strip over every screen without a header.** The `@supports selector(:has(a))` base painted the plate `--bg` on screens with no `.shell-top`/`.topbar`. Those screens draw a glow at the top (Draft, Playoffs, Welcome, Vote, Search), so the plate cut it with a hard line at the inset (review, CIEDE2000 across the line: Draft 5.99, Playoffs 13.98, Welcome 10.86, Vote 10.21, Search 3.28; Fix A alone 1.03 on the Draft). **Fixed:** the base is now `transparent`, and the header rules after it make the plate opaque only where a header plate sits under it. Header-less screens now look exactly as with Fix A alone.
- **Medium: a strip of the screen underneath over full-screen overlays.** Champions (`.champ`), GameCast (`.cast`), the UT player pick (`.ut-pick-screen`), the Rivals promotion (`.promotion`) and the sport switch (`.sportfade`) sit inside the stage, under the plate, over a header screen (review: dE 6.0 to 8.6). **Fixed:** they join the open sheet's transparent rule, `html:has(.scrim:not(.closing), .champ, .cast, .ut-pick-screen, .promotion, .sportfade) .status-plate`. Plain classes only, for the `:has()` cost. The class list is in the D4 message above so ut, packs and players keep it.
- **Low: the `:has()` cost was at the noise floor.** Re-measured after the fix, but the machine was not quiet (load 7.4 to 10 on 4 CPUs, against the perf-ut guard of 4). Result: **unconfirmed**, see the table and the `:has()` paragraph.
- **Low: the edge branch had moved past the gated tree.** The gate is re-run on the edge branch's code tip `55127fd` (which contains `52f347e`), and the commit range, pointer branch, rollback list and file list above are updated.

Measured after the fix (393 × 852, 59/34, standard player, isolated dev server, 3 sports, the same in each; `plates.mjs --parts seams`, CIEDE2000 1.5 pt above against 1.5 pt below the inset line, max of x = 20/195/370; `O/shots/shell/shell-3/edge-gate/plates/seams.json`):

| Screen | With every plate | Fix A alone | Acceptance |
|---|---|---|---|
| Draft (real, reached with PLAY) | **0.86** | 0.86 | ≤ 2 |
| Playoffs / Welcome / Vote / Search (the real class over the Draft) | **1.08 / 1.00 / 0.35 / 1.28** | the same | ≤ 2 |
| Champions / Perfect Season / GameCast / Rivals promotion / sport switch (the real class over Home) | **0.85 / 0.34 / 1.21 / 0 / 0** | the same | ≤ 2 |
| UT player pick (over UT Home) | **0.63** | 0.48 | ≤ 2 |
| Home / UT Home (unchanged) | 0.68 / 0.00 | | ≤ 2 |

The review's numbers compare the band's mean with the strip just below it, so they are not the same measure; the page test below also checks that the old `--bg` rule gives dE > 2 on Draft, Playoffs and Welcome, so the guard can fail. Screenshots: `O/shots/shell/shell-3/fix-seams/seams-nba/draft-top.png` (no strip under the clock) and `edge-gate/plates/seams-<sport>/`.

#### What changed

- **Fix B: the status plate.** `index.html` has `<div class="status-plate" aria-hidden="true">` before `#root`, outside the scaled stage. Its base rule is in index.html's inline `<style>` (fixed, top 0, `height: env(safe-area-inset-top)`, the launch colour `#04121a`, z-index 2, `pointer-events: none`), so it paints from the first frame and nothing new flashes between the launch image and the splash.
  - The plan put the base in a `style` attribute. That cannot work: an inline style outranks every stylesheet rule, so `plates.css` could never set the plate's colour or its QA-settable height. The page test caught it.
  - `src/shell/plates.css` (imported in `main.tsx` right after `styles.css`) sets the height to `var(--ps-inset-top, env(...))`, so QA sees the real inset through `__psInsets`, and sets the colour from what is on screen:
    - main screens (`.shell-top`, or a screen's own `.topbar`): `--plate-top`;
    - UT (`.ut-top`): `--plate-top-ut`, the UT header plate's top colour, so the inset line has no seam;
    - screens without a top bar (Draft, Playoffs, Welcome, Vote, Search…): **transparent** (review fix), so the band shows the screen's own top exactly as with Fix A alone. The first version painted `--bg` there, which cut those screens' top glow with a hard line; the plan's `--plate-top` everywhere would have been worse;
    - an open sheet (`.scrim:not(.closing)`): **transparent**, so the band shows the scrimmed header exactly like the rest of the screen. This replaces the plan's fixed `#030c10`, which matches only one background; transparent matches every one by construction. It fades with the scrim (0.22 s), and returns while the sheet closes;
    - full-screen overlays drawn over a header screen (`.champ`, `.cast`, `.ut-pick-screen`, `.promotion`, `.sportfade`): transparent, in the same rule as the open sheet (review fix), so the band shows the overlay;
    - pack opening, the launch splash, the versus splash and the season reveal: `display: none`. The band shows the screen's own tier colour or background;
    - matches portal `.arcade-full` to `<body>` at z-index 50, so they already cover it;
    - sideways (`--ps-inset-top: 0`) and on framed desktop layouts its height is 0.
  - The colour is set on the plate itself, never as an inherited custom property on `<html>`, so a state change restyles one element. The `:has()` arguments are plain classes, with no combinators, so they cost less to invalidate. Under reduced motion there is no transition.
- **Fix C part 1: solid header plates** (in `plates.css`):
  - Tokens on `:root` (the shared header API, D4): `--plate-top #08222d`, `--plate-bot #0b2b38`, `--plate-line #1f4e5b`, `--plate-top-ut #182625`, `--plate-bot-ut #1c2c2a`, `--plate-line-ut #4b4229`.
  - `--plate-top` is the mean colour the Chromium band showed on Home with Fix A alone (8, 34.5, 45), and `--plate-top-ut` the same on UT Home (23.8, 38.5, 37). The plan's suggested `#061820` would have darkened the band by about 4% of full scale, failing the ≤ 2% acceptance; these keep it at 1.3–1.5%.
  - `.shell-top` (the main TopBar) has the plate on itself: `--plate-top` down to the inset line, then a gradient to `--plate-bot`, a 1 px inset hairline in `--plate-line` and a soft drop shadow.
  - Every `.screen > .topbar` (UT `.ut-top`, Results, Gauntlet, UT Match) becomes `position: relative; isolation: isolate` and gets a `::before` plate (`inset: calc(-1 * var(--sat)) 0 0`, `z-index: -1`). It reaches y = 0 through the screen's `--sat` padding and sits under the bar's contents. UT uses the gold-tinted set.
  - No noise, no accent and no `backdrop-filter` (the premium pass is shell-5).
- **H1: the card-detail bar** (`src/ut/nav.css`, shell's granted hunk). `.sheet.bottom .ut-detail-btns { bottom: calc(-18px - var(--sab, 0px)); margin-bottom: calc(-18px - var(--sab, 0px)); }`.
  - The sheet pads its bottom by 18 px + `--sab`, and a sticky box sticks inside its scroller's padding, so `bottom: -18px` left the bar one home-indicator inset (34 pt) above the sheet's edge, with stats showing under it.
  - The bar's own padding (16 px + `--sab`) and panel gradient already fill the home-indicator strip.
  - Scoped to bottom sheets, so the unscoped rule (a future pack-grid entry outside a sheet) is unchanged.
  - Grep of every in-sheet sticky bar with a negative `bottom`: `.ut-detail-btns` is the only one. `.ut-cta-bar` (`nav.css`, Club Season page) and `.cup-page > .cup-go` (`cup.css`) are on pages, not sheets. Home's `.evo-home-actions .actionbar` uses `bottom: 0`.
  - Today the detail opens from Club, Storage, Squad, Evolutions and the Pack Tracker (`UltimateTeam.tsx` `setDetail`). The Collection gallery opens its own edition sheet with no sticky bar (checked: 0 bars). SBC, Store/Preview Pack and the pack grid don't open the card detail today.
- **L2:** the level ring's "LV" label is 8 → 10 px (`styles.css` `.level-ring span`). The ring stays 42 px and its button 44 px tall.

#### Before / after (393 × 852, insets 59/34, standard player unless noted, dev server)

"Before" is `7f7655d` (Fix A only) on the same harness: `O/shots/shell/shell-3/before/`. "After" is this task: `O/shots/shell/shell-3/ship/`.

| Check | Before | After | Acceptance |
|---|---|---|---|
| Status plate (main / UT) | none | y 0, 59 pt (= inset), `#08222d` / `#182625` | y = 0, height = inset |
| Main header from y = 0 | `.shell-top` transparent | opaque; 9/9 probes (y 2 / 79 / 135 × x 20 / 195 / 370) on the header | opaque to the hairline |
| UT Home and 5 tabs, header from y = 0 | no surface above the bar | opaque; 9/9 probes on each of 6 screens | same |
| Hairline vs first content row | (no hairline) | 0.0 pt on Home, UT Home and all 5 tabs | ± 1 pt |
| Header text contrast on the plate (min) | | 5.83 main ("LV", "Level"), 4.95 UT (the title's darkest gold stop) | ≥ 4.5 |
| Hairline contrast | | 1.62 main, 1.46 UT | ≥ 1.25 |
| UT seam across the inset line (CIEDE2000, x 20/195/370) | 0.83 (no plate, the background's own gradient) | **0.00** | ≤ 2 |
| Band luminance, all plates vs Fix A alone (mean per-pixel luma difference) | 0 (nothing to compare) | **1.28%** main, **1.49%** UT | ≤ 2% |
| Sheet open over Home: band vs the scrimmed area below | −3.68% relative (−0.17% of full scale) | **−0.26%** (−0.01%) | ± 3% |
| Sheet open in UT (Club filter) | +4.56% relative (+0.22%) | **0.00%** | ± 3% |
| Plate on pack opening / splash / vs-splash / season reveal | n/a | hidden on all four (vs-splash and season reveal by a synthetic stand-in) | hidden |
| Plate after closing the sheet | n/a | back to `#08222d` | |
| Card-detail bar gap at top / mid / end (393, 390, 402, 440) | **34–34.5 pt** | **0–0.5 pt** | ± 1 pt |
| Text showing below the bar, max runs top / mid / end | 8 / 4 / 0 | 0 / 0 / 0 | none |
| A tap 4 pt above the sheet's edge lands on the bar | 0 of 360 | **540 of 540** (5 entry points × 3 positions × 3 x × 4 phones × 3 sports) | all |
| 320 × 568 (sab 0): bar-region pixels vs before | | **0.00%** changed (3 sports) | ≤ 1% |
| LV label | 8 px | 10 px; ring 42, tap target 44 | ≥ 10 px, 44 |
| Seam at the inset line on screens without a header (Draft / Playoffs / Welcome / Vote / Search) | first version (flat `--bg`): visible line (review: 5.99 / 13.98 / 10.86 / 10.21 / 3.28) | **0.86 / 1.08 / 1.00 / 0.35 / 1.28**, the same as Fix A alone (review fix) | ≤ 2 |
| Seam on overlays over a header screen (Champions, GameCast, Rivals promotion, sport switch, UT pick) | first version: a strip of the screen underneath (review: 8.24 / 7.74 / 6.86 / 6.01 / 8.6) | **0.85 / 1.21 / 0 / 0 / 0.63** (review fix) | ≤ 2 |
| `:has()` style recalc, UT Home → Club (heavy) | | **unconfirmed**: +1.5 ms pooled before the review fix, +0.34 ms after it (paired +0.29), both on a loaded machine (load 3.6–10, runs swing 7–32 ms) | ≤ 2 ms, on a quiet machine |
| `plates.css` | | 3,670 B, **1,583 B gzipped** (after the review fix), no images | ≤ 2 KB gz |
| Reduced motion | | no transition (computed 1e-05 s from the global rule) | no new animation |

**`:has()` cost** (CDP `RecalcStyleDuration` for UT Home → Club, heavy NBA player, 2,003 copies; `plates.css` toggled on and off in the same page, interleaved, one unmeasured cycle after each toggle):
- **Status: unconfirmed.** Neither measurement ran on a quiet machine (the perf-ut load guard is a 1-minute load below 4), so the ≤ 2 ms criterion is neither met nor failed. Re-measure before the early ship when the machine is quiet: `node scripts/qa/plates.mjs --phase has-quiet --parts has --runs 9` on a dev server, with `uptime` before and after. The plan's fallback (a `data-top` attribute written by an observer) stays available.
- Before the review fix: two runs of 9 pairs each, median rise −1.5 ms and +2.15 ms (paired medians −0.17 and +1.93 ms); one of the two is over 2 ms. Pooled over 18 pairs: on 9.91 ms, off 8.40 ms, rise 1.5 ms. Load 3.6–7.0 on 4 CPUs.
- After the review fix (6 more `:has()` arguments in the transparent rule), on `55127fd`: one run of 9 pairs, on 12.90 ms, off 12.56 ms, **median rise +0.34 ms** (paired +0.29 ms). Load 7.4 at the start and 10.1 at the end, and single runs swing from 7 to 32 ms, so this run says only that the rule adds nothing that stands out of that noise. `O/shots/shell/shell-3/edge-gate/has/has.json`.
- Two design choices keep it low: the colour rules restyle only the plate (an inherited custom property set on `<html>` would restyle the whole tree on every state flip), and the `:has()` arguments use no combinators (`.screen > .topbar` became `.topbar`, which only appears on screens).
- Measurement note: three earlier runs without the warm-up cycle read +1.4, +1.9 and +3.1 ms. In those, every "on" run paid the engine's selector rebuild after the sheet was re-enabled, which is a harness artifact (now fixed), not a cost players see.

#### Ship gate (lead decision D2)

**Re-run after the review fix (2026-11-16) on `55127fd`**, the edge branch's code tip (`05a6beb` + `52f347e` + the shell-3 review fix), with the branch checked out in the shell worktree; dev server on 5211, isolated (`?ns=inspect`, local relays on ephemeral ports, every other host aborted). Logs: `O/shots/shell/shell-3/edge-gate/`. Across every run: **0 page errors**; the only host refused is the app's own Supabase launch call, aborted before it leaves the machine. (The first gate ran on `05a6beb`; its results were the same apart from the test counts.)

| Step | Result |
|---|---|
| `heavy.sh npm run typecheck` | pass |
| `heavy.sh npm test` (full, once) | pass, exit 0: NBA 75 files / 648 tests (58 skipped), NFL 73 / 601 (104 skipped), soccer 9 / 74 |
| `heavy.sh npm run build` (once) | pass, built in 38.7 s. In `dist/index.html` the app's CSS links come after the inline `<style>`, and the built CSS has all seven plate rules, including `@supports selector(:has(a)){html .status-plate{background-color:transparent}}` and the overlay rule. `dist/` removed afterwards |
| `screen-fit.mjs`: 9 phones, Safari and forced standalone | pass, including the new plate assertions (y 0, height = inset on every phone; 0 sideways), `safe 59/34 · edge 22`, and the score bug at inset + edge + 8 in 3 sports |
| `edge-headers.mjs --phase shell-3/edge-gate-headers --devices all` (27 runs, band shots at 393) | 0 failed steps; text in the band 0, controls in the band 0, bottom cuts 0; 189 header checks all opaque from y = 0 with 9/9 probes and the hairline on the first row (min text 4.95, min hairline 1.46); detail bar gap 0–0.5 pt, 0 text below; plate hidden on every pack SKIP screen; Home classes match on all 27 |
| `home-matrix.mjs --phase shell-3/edge-gate-home --devices all` (432 states) | 0 class mismatches; text/controls in the band 0; bottom cuts 0; last row hidden at scroll end 0; tiles under the fade at rest 16 of 432, all NBA/NFL saved run at 320 by 0.6 pt (the allowed scroll fallback, as in shell-2's review-fix run). Against shell-2's review-fix run: the PLAY rect and every row height identical in all 432 states |
| `plates.mjs --phase edge-gate/plates --parts plates,seams` | Home band 1.28%, UT band 1.49%, UT seam 0.00, sheet −0.26% / UT sheet 0.00%, plate back after the sheet, hidden on pack opening, splash, vs-splash and season reveal (3 sports); every seam in "Review fixes" above |
| `plates.mjs --phase edge-gate/has --parts has --runs 9` | +0.34 ms; unconfirmed (loaded machine), see above |
| `plates.mjs --phase ship` (h1), first gate on `05a6beb` | the H1 numbers in the table above; `55127fd` changes no H1 code, and edge-headers re-measured the bar (gap 0–0.5 pt, 0 text below) |
| Self-containment | `git diff --name-only acdf3e2..HEAD`: no change to `vite.config.ts` or `sw.js`; no unit file imports `src/shell/arena`, `cards-load` or `pool-cache` (grep of import lines) |

Screenshots: `O/shots/shell/shell-3/` (`before/`, `ship/`, `ship-edge/` with contact sheets `sheet-<sport>.png` and `sheet-<sport>-band.png`), and DSF 3 crops of the top 140 pt of Home and UT Home, plain and under the simulated band, in `O/shots/shell/ship/` for comparison with the owner's photo.

#### Tests

- `src/shell/plates.test.mjs` (11 tests; the review fix adds 2: transparent by default inside `@supports`, ahead of the header rules, with `--plate-top` kept for old Safari; the overlay rule lists `.champ`, `.cast`, `.ut-pick-screen`, `.promotion`, `.sportfade`, and every `:has()` argument is a plain class): the plate sits before `#root` with its base in index.html's inline `<style>` (not a style attribute); `plates.css` is imported once, right after `styles.css`; ≤ 2 KB gzipped, no `url()`, no `backdrop-filter`; the six tokens exist; header text ≥ 4.5:1 and hairlines ≥ 1.25:1 from the tokens; the UT plate starts with the colour the status plate takes on UT; the colour rules' order; hidden on the four immersive screens, transparent under an open sheet, no transition under reduced motion; the H1 rule is scoped to `.sheet.bottom` and the unscoped one is unchanged; LV 10 px with the ring and tap target unchanged. Plain JS, because it reads files with `node:fs` (vitest hands CSS imports back empty, even `?raw`).
- `scripts/qa/plates.page.test.mjs` (11 tests, real Chromium, a static page built from the real CSS; the review fix adds 3: on `.screen.draft`, `.playoffs`, `.welcome`, `.vote` and `.search` with their real backgrounds the plate is transparent and dE ≤ 2 across the inset line; a control where the old `--bg` rule gives dE > 2 on Draft, Playoffs and Welcome; the overlays make the plate transparent, GameCast and Champions keep dE ≤ 2, and a header screen without an overlay keeps its opaque plate): main plate 59 pt in `--plate-top` with 9 probes on the header and the hairline on the first row; UT colour and no seam (CIEDE2000 ≤ 2 on real pixels); transparent under a scrim and back while it closes; `--bg` on a header-less screen; hidden on all four immersive screens; no transition under reduced motion; the H1 bar flush at top/mid/end with a tap 4 pt above the edge on the bar; unchanged at sab 0; and a control that shows the old rule floating > 30 pt (so the test can fail).
- `scripts/qa/edge-lib.test.mjs` (+3): CIEDE2000 against Sharma's reference pairs, colour parsing, WCAG contrast and luma, and the band-difference metric.
- `scripts/qa/screen-fit.mjs` now asserts the plate is the inset tall at y = 0 on Home on all 9 phones (Safari and standalone) and 0 tall sideways.
- New runner `scripts/qa/plates.mjs` (see `docs/BROWSER-QA.md`); the review fix adds its `seams` part. `edge-headers.mjs` records the plate audit on every screen.

#### Protocol bump needed

None.

#### Touched outside my lane

- `src/ut/nav.css`: the H1 rule (7 lines; shell's granted card-detail hunk).
- `src/shell/plates.css` targets other teams' classes (`.topbar`, `.ut-top`, `.scrim`, `.ut-open-screen`, `.vs-splash`, `.screen.reveal`) from shell's own file. No other team's file changed.

#### Owner device checks (early ship)

1. Installed-app screenshots of Home and UT Home on the 393 × 852 phone, measured with the audit's method: "LEVEL N" peak luminance ≥ 160 against "x/y XP" at about 168 (ratio ≥ 0.95); edge sharpness ≥ 90 (today 21–26); nothing looks cut off at the top.
2. Settings → the bottom note reads `safe 59/34 · edge 22`. On an iPhone Air it also tells us the real top inset (the plan assumes about 68).
3. Fix B: does the band under the clock become one flat colour on Home and on UT Home, with no seam where the header starts? With a sheet open (Settings), is the strip dimmed like the rest? On pack opening, does the band show the pack screen's own colour? On the Draft, the Playoffs and the first-run Welcome screen, does the screen's own top glow run up under the clock with no dark strip or line at the inset? On the Champions screen and a live playoff game (GameCast), does the band show the overlay rather than the screen under it?
4. The card detail from Club, Squad and the Pack Tracker: the bar sits flush with the bottom edge, with no stats showing under it, at the top and the end of the sheet.
5. Home in every mode: nothing sits under the PLAY fade (shell-2).

If check 3 shows the plate looking worse than the system's own blur, switch Fix B off with the one line under "Rollback"; the header plates (Fix C) stand on their own.

#### Left for later tasks

- The premium plate pass (noise, accent, depth), the sub-page headers, toasts, the HUD scrim and the pack SKIP: shell-5.
- The Squad picker tap-blocking bug: ut (see "Messages to other teams").
- Gauntlet's gold background gets the main (teal) plate; give it the UT set in shell-5 if the owner wants it.
- Old iOS (Safari before 15.4, no `:has()`): an `@supports selector(:has(a))` guard keeps the plate in `--plate-top` there, which matches Home and is close on UT. It also stays opaque over pack opening, under sheets, over the overlays and on screens without a header on those phones (where it draws the first version's strip). Acceptable for a few old devices.

## shell-2 · Fix A (top-edge clearance), Fix D (hygiene), M1 (Home in every state), L6 (done)

Layout only. No saves, storage keys, ids, match rules or protocol changed. Part of the early-ship unit with shell-1 and shell-3.

### Review fixes (2026-11-16)

An independent review of `05ea3f4..25c6f6a` found two medium and two low issues. All four are fixed; the sections below this one describe the state after the fix where they were wrong.

- **Medium: Classic Home had a blank 40-px band between the tiles and PLAY** (62 pt at 393 in NBA/NFL, 68 in soccer). The hint slot kept its height while its line was removed, and `homeAudit` counted the empty slot as the last row, so the 8–24 pt gap check passed on empty space.
  - Fix (review option A): the Classic line is back in its slot, "1 free team respin and 1 free decade respin every draft." (soccer: "club"). The reason for removing it, the 26-px PLAY shadow, is gone: the fade is 8 px and the spacer floor is 10 px, so the line sits fully clear of the fade (gap 8.2–11.2 pt to PLAY on all 9 phones). Every mode fills the slot again, so the tiles still never move when a mode is picked.
  - `homeAudit.rowsNow()` now skips rows that paint nothing (no text, canvas, svg, img, button or input), so an empty slot can never pass the gap check again.
  - Also: at the hero's 88-px floor the scoreboard box touched the hero frame (1.9 pt each side). Home's `.jumbo` is 5 px slimmer (padding 7/8), leaving 5.4 pt each side.
- **Medium: with a saved run, NBA/NFL Home overflowed by 74 pt and the DAILY / HEAD TO HEAD tiles sat 8–26 pt under PLAY's fade at rest at 393** (every phone with an island or notch was similar).
  - Fix: Home gets a `has-run` class when a run is saved (`Pages.tsx`, the class line), and that state wins back 34 frame px: the hero's floor is 64 (its scoreboard shrinks to 34-px numbers and stays 5.7 pt clear of the frame), Training Camp becomes one 44-px row (its subtitle hides), the continue card's padding is 9 and the actions gap 6.
  - `homeAudit` now also reports `modesBottomAtRest`, `modesClearFadeAtRest` and the rows the fade cuts at rest; `home-matrix` lists every state whose tiles don't clear the fade as `tilesUnderFadeAtRest`.
  - Result (432 states): the tiles clear the fade at rest everywhere except NBA/NFL with a saved run at 320×568, by 0.6 pt (the allowed scroll fallback). At 393 they clear by 8.8 pt; 402 11.1, 420 9.8, 430 20.2, 440 22.7, 390 21.3, 375×812 13.1, 375×667 5.5. The only row the fade cuts at rest is the hint line under the tiles. NBA/NFL saved-run Homes scroll 27–43 pt (was 61–79); soccer saved-run Homes now fit on all 9 phones (was 2–17 pt of scroll).
- **Low: `.save-warning` read the screen's top inset although it renders inside the transformed stage.** Sideways, the stage counter-rotates and the warning sat under the island. It now reads `var(--sat, …)` (frame px, follows rotation) with the screen-px form as the fallback. Measured at 393×852: upright `top` 80.38 frame px (= 81 pt, unchanged); sideways (insets 0/59/21/59) 58.5 frame px, so the bar starts 59 px in from the island side instead of at 0. `.camp-overlay` keeps `--ps-inset-top`; it is portaled to `<body>`.
- **Low: the legacy `game/hoops/Hoops.tsx` parsed `--sat` with `parseFloat`**, which is NaN inside `.arcade-full`, where `--sat` is now a `calc()`. It now falls back to `--ps-inset-top` + `--ps-edge` when `--sat` is not a plain length. The component has no importer, so no player was affected. **Every team:** inside `.arcade-full`, `--sat` is a `calc()`; read it through CSS, or measure a probe, never `parseFloat`.

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
  - The hint slot under the modes keeps its height in every mode, so picking a mode never moves a tile. (The first version removed the Classic hint line and left its slot empty; the review fix puts it back, see "Review fixes".)
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
| NBA/NFL, saved run | scrolls 83–96 | scrolls 27–43 (first version 61–79); the tiles clear the fade at rest on every phone but 320 (−0.6 pt) |
| Soccer, saved run | scrolls 17–30 | **fits on all 9 phones**, gap 8.2–11.2 (first version scrolled 2–17) |
| Last row clears the fade at scroll end | 0 of 360 overflowing states | **144 of 144** |
| A fitting state's last row under PLAY or its fade | n/a | 0 of 288 |
| Mode tiles under the fade at rest | | 16 of 432, all NBA/NFL saved run at 320 (by 0.6 pt) |
| PLAY bar and tab bar rects vs baseline | | identical (0 moved by > 1 pt) |
| Text/control in the band; bottom cut; document scroll > 1 | 432 / 0 / 0 | 0 / 0 / 0 |

- Numbers in this table are after the review fix (`O/shots/shell/shell-2/review-fix/home-matrix/`).
- In the overflowing (saved-run) states the hint line under the tiles scrolls under the 8-px fade at rest. That is the scroll cue: PLAY never moves, and every row is reachable and clears the fade at the end.
- The remaining hit-area overlaps the audit lists in those states (AI chips × PLAY) come from `::before` hit areas that the scroller clips. A tap there lands on PLAY.
- Sport-switch neighbours overlapping by 2 px is pre-existing (unchanged).

### Home budget (D5: shell owns Home's vertical layout, ut owns its strip's contents)

Row heights in pt, from the top: logo / sport switch / hero / stat strip / actions / modes / hint slot. Online on; Classic and 1v1 are identical, because the slot height never changes. After the review fix; with a saved run the hero's floor is 64 (`has-run`). "Slack" is what the column can give up before it scrolls: the hero above its 84-px box minimum, plus the spacer above its 10-px floor.

| Phone | Sport | Saved run | Rows | Gap to PLAY | Slack |
|---|---|---|---|---|---|
| 393 | NBA/NFL | none | 76.2 / 38.3 / 88.4 / 30.2 / 54.4 / 139.1 / 40.3 | 10.1 | ≈ 4 |
| 393 | NBA/NFL | yes | 76.2 / 38.3 / 66.5 / 30.2 / 115.9 / 139.1 / 40.3 | scrolls 40 (tiles clear the fade by 8.8) | − 40 |
| 393 | soccer | none | 76.2 / 38.3 / 146.5 / 30.2 / – / 139.1 / 40.3 | 15.5 | ≈ 67 |
| 393 | soccer | yes | 76.2 / 38.3 / 77.3 / 30.2 / 65.5 / 139.1 / 40.3 | 10.1 | ≈ 13 |
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
- **Review fix re-run** (dev server on 5211): typecheck pass; `vitest run src/stage-layout.test.ts src/engine/sport-branches.test.ts scripts/qa` 8 files, 76 pass; `PS_SPORT=nfl` and `PS_SPORT=soccer` stage-layout + sport-branches 28 + 28 pass; `home-matrix --devices all --phase review-fix`: 432 states, 0 errors, 0 class mismatches, PLAY and tab bars unmoved vs `fixA`, 0 band text/controls, 0 bottom cuts; `screen-fit.mjs` passes (its first run timed out opening UT on the loaded dev server; the re-run passed unchanged). The save-warning check upright and sideways is a scratch probe (`scratchpad/shell2fix/savewarn.mjs`). Screens looked at: NBA Home with a saved run at 393, NFL Classic without one at 393, soccer with a saved run at 320.
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

- `src/evolution/evolution.css`: `.save-warning` and `.camp-overlay` (portrait and landscape), 3 `top` declarations. These are the D3 grant the plan requests. The review fix changed `.save-warning` to the stage's `--sat`.
- `src/game/hoops/Hoops.tsx` (nba's legacy v1 file, no importer): 3 lines in the review fix so it no longer reads `--sat` with `parseFloat`.
- `src/ui/Pages.tsx` (shared): the Home class token, the `has-run` class and the Classic hint line, within shell's granted Home hunk.

### Owner device checks

- In the installed app on the 393×852 phone, screenshot Home and UT Home. The LV ring, "LEVEL N" and the coins should sit fully below the blurred band, with "LEVEL N" as bright as "x/y XP".
- Settings → bottom note reads `safe 59/34 · edge 22`.
- In a match, the score bug sits clear of the band.
- On Home, nothing is hidden under PLAY. With a saved run, all four mode tiles sit above PLAY's fade without scrolling; the column scrolls only for the hint line, which stops above the fade.
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
