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
- **Isolation is now built into `browser.mjs`.** Every non-localhost request is aborted. Scripts that talked to the live registry or cloud saves (`content.mjs`, `circulation.mjs`, `cloud.mjs`) now see those calls fail as if offline; do not work around this against live hosts.
- **ut / packs: the heavy first-render costs and the rating costs** are in "UT open: costs" below. The rating step (packs-owned `rate.ts`, `card-face.ts`, `ut-scale.ts`) is most of the open; the first render after the pool is 120–210 ms.

## shell-1 · QA harness core, production fixtures, team QA snippet and baselines (done)

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
| Card-detail bar shows content below it at 393/390/402, not at 320 | **Met.** The bar floats 34 pt above the sheet bottom at 393/390/402 (and 375×812/420/430/440) with 2–7 text runs showing under it (NBA/NFL at top, middle and end; soccer at top and middle). At 320 and 375×667 the gap is 0–0.4 pt and nothing shows. |
| Home classes on 9 phones match the computed table | **Met.** 432/432 matrix states and 27/27 edge-headers runs: `''`/`normal` on the 7 notch/island phones, `snug`/`tight` on 375×667 and 320×568. |
| Snippet on untouched `acdf3e2` at 393: arcade `--sat` 81 px, stage 81/k frame px, LV ring 22 pt down | **Met.** 81 px; 80.382 frame px (k = 1.00769, 80.99 screen px); 65 → 87 pt. |
| perf-ut standard 1× within ±15% of 2,123 / 2,092 / 679 ms | **Partly met.** See below: NBA 2,214 ms (+4%); NFL 2,484–2,708 (+19–29%); soccer 838–881 (+23–30%). With the audit's own 0-card player (`utNoStarter`) and its readiness test the port gives 2,195 / 2,355 / 737 ms (+3% / +13% / +9%), all within ±15%, and the heap numbers match the audit to 0.1–0.6 MB. The gap is the standard player's 40–69 owned cards, not the harness. |
| Heavy numbers recorded; heavy first-render table names the top 5 per sport | **Met** (below). |
| edge-headers for one sport over 9 phones ≤ 4 min; `screen-fit.mjs` still passes | **Met.** Kept build: 90 s NBA, 95 s NFL, 70 s soccer (3 contexts at a time; 120 s/sport on the dev server). `screen-fit.mjs` passes (Safari and standalone, 5 sizes, keyboard, rotation, 0 errors). |

### Baseline: top edge (kept build `acdf3e2`, standard player, `O/shots/shell/before/`)

Topmost text/control in pt (insets t/b). "Band" = text runs / controls inside the band over the whole walk.

| Phone | Home / UT Home | UT tabs | SKIP | Toast cap top | Draft | Match frame | Detail bar gap | Band (text/ctl) |
|---|---|---|---|---|---|---|---|---|
| 393×852 (59/34) | 65.0 | 74.1 | 71.1 | 80.6 | 63.0 | 73 | 34 | 26–27 / 6 |
| 402×874 (62/34) | 68.2 | 77.5 | 74.4 | 84.1 | 66.1 | 76 | 34 | 22–27 / 6 |
| 420×912 (68/34) | 74.5 | 84.2 | 80.9 | 91.1 | 72.3 | 82 | 34 | 21–26 / 6 |
| 440×956 (62/34) | 68.8 | 78.9 | 75.5 | 86.2 | 66.5 | 76 | 34–34.7 | 12–19 / 6 |
| 430×932 (59/34) | 65.6 | 75.5 | 72.2 | 82.6 | 63.4 | 73 | 34 | 19–26 / 6 |
| 390×844 (47/34) | 53.0 | 62.0 | 59.0 | 68.4 | 51.0 | 61 | 34–34.5 | 20–26 / 6 |
| 375×812 (50/34) | 55.8 | 64.4 | 61.5 | 70.6 | 53.8 | 64 | 34–34.2 | 22–27 / 6 |
| 375×667 (20/0) | 24.8 | 33.5 | 31.5 | 39.7 | 21.0 | 34 | 0–0.4 | 0 / 5 |
| 320×568 (20/0) | 24.1 | 31.5 | 29.8 | 36.8 | 20.8 | 33 | 0–0.3 | 1 / 5 |

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
- A local registry/cloud stand-in so `content.mjs`, `circulation.mjs` and `cloud.mjs` can run isolated again (not in the plan; listed as a follow-up).
- The 420×912 top inset (68) is an estimate until read on a device.
