# Browser QA for Codex additions

**Implemented by Codex, 2026-10-28–2026-10-29.** These scripts create new, isolated localhost browser contexts. They never open the user's browser profile. Fixture coins/cards exist only in those test contexts; preview copy numbers are not real pulls.

## Setup

Run `npm run dev -- --host 0.0.0.0`. Install optional QA tools outside the app's dependency tree:

```sh
npm install --prefix /tmp/ps-qa-tools playwright@1.64.1 ws@8.18.3
```

Use `/usr/bin/chromium` when available, otherwise install the Playwright Chromium browser. Set `PS_QA_PACKAGE_JSON` to that scratch package's `package.json`. In a managed environment requiring an HTTP proxy, set `PS_QA_PROXY` to the configured proxy URL; preserve environment network policy. `PS_QA_ARTIFACTS` optionally selects a screenshot directory; default `/tmp/perfect-season-qa`.

```sh
PS_QA_PACKAGE_JSON=/tmp/ps-qa-tools/package.json node scripts/qa/content.mjs
PS_QA_PACKAGE_JSON=/tmp/ps-qa-tools/package.json node scripts/qa/online.mjs
PS_QA_PACKAGE_JSON=/tmp/ps-qa-tools/package.json node scripts/qa/reveal.mjs
```

The scripts refuse non-localhost app URLs. `browser.mjs` creates fresh fixture profiles, retains original fixture IDs/levels/XP for comparisons, and uses `?ns=inspect&relay=ws://localhost:7777`.

## What is exercised

- **Content:** both sports; collection milestone claim; failed registered-pack request; unchanged coins/cards while pending; reload recovery; exactly one coin charge; original copy preservation; real signed Spotlight reward; live registered-count refresh; event match through the existing Sim vote; stage reward/progress.
- **Online:** two independent browser clients per sport, using a signature-verifying local Nostr relay started by the script. The revised pools contain GOAT cards. Tests matchmaking, squad exchange, both clients voting Sim, one H2H win/one loss and Rivals progress. It does not claim a physical two-iPhone network test.
- **Reveal:** normal-motion GOAT and Spotlight at 390×844 with simulated top/bottom safe areas; reduced motion at 320×568; actual game stage/font/skin inheritance; position/team/card sequence; serial stamp and continue-control bounds; early-skip stability. Preview `#8 / 20` is explicitly a visual fixture, not a real registered claim.

Content tests contact the real new registry only in the **inspect** namespace. Live global pull totals use the empty namespace and remain separate. Additional direct backend checks verify invalid-signature rejection, eight parallel requests for one reward producing one receipt/mint, and SQL atomicity/access controls. [`supabase/tests/registry.sql`](../supabase/tests/registry.sql) rolls all of its test writes back.

## Device checks

Chromium verifies layout, input and state transitions. Before claiming device-specific behavior, check on installed iPhones: safe areas, Cloud Save restore/conflicts, audio permissions, background/reload, orientation, and a two-phone match/rematch. The scripts' proxy certificate exception is a QA-environment setting, not a production security setting.


## Automatic server saves (Codex follow-up)

`node scripts/qa/cloud.mjs` tests both sports using real UI and isolated identities: successful server save, exact owned-copy/XP/squad/wallet restoration for the same identity, an offline divergent device, paused conflict, and server choice only after preserving the device copy. It uses Settings → Cloud Save and does not rely on file inputs or UI-global test hooks. It waits for the actual reload before reading restored state. New identities are required because inspect saves persist on the real backend.

`NODE_USE_ENV_PROXY=1 node scripts/qa/cloud-backend.mjs` tests signed API idempotency, one winner/one 409 for concurrent saves, per-identity isolation and invalid-signature rejection in qacloud. `supabase/tests/cloud_saves.sql` tests database invariants with rollback. No user saves are loaded. See AUTOMATIC-SAVES.md for the identity/recovery boundary.


## Codex gameplay revision, 2026-10-30

`node scripts/qa/gameplay.mjs` mounts the actual NBA/NFL match components with rated isolated fixture squads at Legend defense. It sends manual pointer shooting/throwing input, checks populated canvas pixels, runs complete autoplay possessions/drives, checks finite progress and unchanged original owned copies, and captures release/aim/action screenshots. The same optional QA-tool path/proxy environment variables apply. `online.mjs` also verifies the revised rules/pool handshake and deterministic Sim settlement with two independent signed local-relay clients per sport. See GAMEPLAY-RESEARCH.md and CODEX-UPDATE-LOG.md for final results and device-test limits.


## Codex 90+ circulation revision

`node scripts/qa/circulation.mjs` tests two signed identities per sport against the existing registry's inspect namespace: first registration, a different player's next issue, live aggregate change within 12 seconds (before polling fallback), repeated sold-copy retirement, and an offline SBC queue through reload/reconnect. It checks other original copies/levels/XP and captures actual numbered gold cards. Whole UI flows accept additive metadata while still requiring every original field to survive. Details: CARD-CIRCULATION.md.


## Codex pack cinema revision — 2026-10-30

`node scripts/qa/pack-cinema.mjs` tests the real pack modal within the existing `.stage`: GOAT, Spotlight, gold and NFL Legend at 390×844, GOAT at 320×568 and touch-rotated landscape 844×390, plus reduced motion at 320×568. It checks keyboard open, final-card/control bounds, safe areas, no premature GOAT crown, mid-tear/mid-walkout Skip stability, particle cleanup, reduced-motion CSS and unchanged original copy/level/XP fields. The first case records a video; install the optional tool's FFmpeg once (`/tmp/ps-qa-tools/node_modules/.bin/playwright install ffmpeg`). Output goes to the regular QA artifact directory. `browser.mjs` accepts optional context options for that recording; ordinary fixtures are unchanged.

Displayed 8/20 and `packart` aggregate responses are presentation-only fixtures. No visual-fixture card is deposited/minted; the ordinary isolated profile remains in inspect. No preview cheat UI or altered pack odds is shipped. Run `content.mjs` alongside this to verify real pending-pack/reload settlement and collection/event flows. [Design, sound, timing and connections](PACK-CINEMA.md).


## Codex NFL rushing revision — 2026-10-30

`node scripts/qa/rushing.mjs` mounts the actual NFL component with equal real gold squads at Legend, inside isolated profiles. Uses manual pointer input at 390×844, 320×568 and 844×390; compares held-forward against no-input lane following, checks no accidental spin from a normal 50px push, checks move-button/safe-area bounds, captures actual Juke/Spin/Power animations and uses the existing practice callback to observe real outcomes. Pressing a move does not imply a successful beat. Original copy/level/XP fields remain checked, with additive serial metadata permitted. `PS_RUSHING_WIDTH=320` selects a single viewport for a focused layout follow-up.

`npx vite-node scripts/audit_nfl_rushing.ts` measures 80 fixed seeds across 81 cases without a profile or online write. Two-client `online.mjs` checks the revised NFL rule-5 queue/settlement and unchanged NBA rule-4 queue. [Findings, metrics and limits](NFL-RUSHING.md).


## Ultimate Team clubhouse overhaul — Codex, 2026-10-30

`node scripts/qa/clubhouse.mjs` checks both NBA and NFL with fresh inspect profiles: original wallet through navigation, all new mode entry screens, free Circuit enrollment/reload, manual-only match launch, development enrollment/reload, saved lineup save/load, objective and season claims/reload, complete manual Moment attempts and first-clear claim UI, NFL rush-only book/full 11-play book/left-side formation, 320px controls and landscape. Original owned fields must all survive. The explicit successful-Moment fixture is confined to localhost and separate from the manual engine attempt coverage. It supplies no product cheat hook.

The updated `cloud.mjs` enrolls development, saves a lineup and enters a Circuit through the actual UI before server save/second-device restore/conflict handling. It checks structural equality of the whole HQ object and all owned fields, including serial metadata. Mint normalization may reorder JSON object keys, so equality compares values rather than raw JSON text. The original serialized-text assertion incorrectly rejected a correctly restored serial when property order differed; only that QA comparison changed, with no runtime encryption/restore change.

`online.mjs` verifies the new rule-6 handshake for both sports. `content.mjs` retains the paid-pack failure/retry, registered rewards, collection claims and themed-event checks. Final source/CI/private deployment references are in `CODEX-UPDATE-LOG.md`. See `UT-OVERHAUL.md` for implementation and economy limits. Installed-iPhone background/audio/safe-area behavior remains a device playtest, separate from Chromium verification.


## Researched Ultimate Team polish — Codex, 2026-10-30

`node scripts/qa/polish.mjs` checks batch season rewards/reload, selected-copy development recovery, pack focus/inert background, actual canceled/dragged NBA releases and input cleanup, native NFL playbook containment/Escape/focus return/choice/mirrored diagrams, interrupted throw gestures and a completed manual throw attempt. `PS_POLISH_SPORT=nba` or `nfl` selects a focused case. Future-season UI coverage mounts the real SeasonView with an explicit date instead of forging the clock. Browser fixtures stay on localhost/inspect; weak defense in the dedicated input-isolation case is never a shipped game setting. Original wallet/copy fields are still compared.

Unit regressions are in `src/ut/polish.test.ts` and the basketball gameplay tests. Current online mechanics are NBA 7 / NFL 6, with unchanged data/leaderboard history. See [UT-POLISH.md](UT-POLISH.md) for confirmed reproductions, primary-source research, implementation, results and device-test limits.


## Shell harness: isolation, phones, fixtures and the top edge — Claude, 2026-11-10 (studio overhaul, shell-1)

### Isolation (every script that uses `browser.mjs`)

`fixture()` contexts now abort every request and WebSocket to a host other than `localhost` / `127.0.0.1`. Google Fonts (`https://fonts.googleapis.com`, `https://fonts.gstatic.com`) stay allowed so text measures as it does on a phone; `data:` and `blob:` URLs are local. Each refused host is listed in `f.blocked`. `isolate(context)` and `allowedUrl(url)` are exported for scripts that make their own contexts. The relay passed to `fixture()` must be on this machine.

This is deliberate: an earlier QA run registered cards on the live registry. Scripts that used to call the live Supabase registry or cloud saves in the `inspect` namespace (`content.mjs`, `circulation.mjs`, `cloud.mjs`) now see those calls fail as if offline, and need a local registry/cloud stand-in before they can pass again. A script that answers a backend call itself with `page.route` (as `pack-cinema.mjs` does) is unaffected, because page routes run before the context's. `cloud-backend.mjs` and `admin-registry.mjs` do not use `browser.mjs` and must not be run against live hosts during the overhaul.

### Options

`fixture(browser, sport, name, width, contextOptions, options)` keeps its first five arguments. The optional sixth:

| Option | Default | Effect |
|---|---|---|
| `insets` | none | `[t, r, b, l]` pt. Sets `window.__psInsets` before the app loads; the stage reads it instead of `env()`. |
| `height` | 844 | Viewport height. |
| `standalone` | false | `navigator.standalone = true`, and CDP `display-mode: standalone` where Chromium supports it (it doesn't today: `f.displayMode` says so; use `edge-lib.forceStandaloneRule`). |
| `dsf` | context default | Device scale factor. |
| `motion` | `'reduce'` | `reducedMotion` of the context. |
| `profile` | `'standard'` | `standard`, `heavy`, `utNoStarter`, `checkpoint` or `fresh` (see Fixtures). |
| `serialized` | false | Use the serialized `standard` file on the dev server too (always used for the other profiles and on a build). |
| `relay` | `ws://localhost:7777` | Must be local. |

### Environment

| Variable | Meaning |
|---|---|
| `PS_QA_URL` | The app on this machine (dev server or `vite preview` of a build). |
| `PS_QA_BUILD_ROOT` | Set when `PS_QA_URL` serves a production build. Fixtures then come only from the serialized files; nothing imports `/src`. |
| `PS_QA_FIXTURES` | Directory of the serialized fixtures (default `<PS_QA_ARTIFACTS>/fixtures`). The overhaul keeps them in the scratchpad, never in the repo. |
| `PS_QA_SHOTS` | Root for `edge-headers`, `home-matrix` and `perf-ut` output (default `<PS_QA_ARTIFACTS>/shots`). |
| `PS_QA_ARTIFACTS`, `PS_QA_PACKAGE_JSON`, `PS_QA_PROXY` | As before. |

### Fixtures (`scripts/qa/fixtures.mjs`)

- `node scripts/qa/fixtures.mjs make [--sports …] [--profiles …]` runs on the **dev server** only. It builds each profile through the app's own modules (`openPack`, `recordPull`, `organizeStorage`, `recordMatchProgress`, `startCircuit`, `savePreset`, …), lets the app load and re-save it, and writes the app's own localStorage values to `<PS_QA_FIXTURES>/<profile>-<sport>.json` with a summary.
- `node scripts/qa/fixtures.mjs check` loads every fixture on the dev server or a build: Home, then Ultimate Team, with 0 page errors, the same summary as when made, no foreign keys, and an isolation probe (`fetch('https://example.com')` must be aborted and listed).
- Keys: only `RECOVERY_KEYS` (`src/lib/recovery.ts`) without the signing key; `fixtures.test.mjs` keeps the lists equal. The init script writes only on `localhost`/`127.0.0.1`, only into storage that has no profile yet (so the app's own later writes survive reloads), and sets today's daily-chest day.
- Profiles: `standard` (the original ~30-card player plus a pack), `heavy` (about 2,000 copies, a third levelled 2–5, 60 evolved and 2 evolving, a full 300-pack Pack Tracker log, seasons/objectives/circuit history/saved squads/development/moments/match history, 59,672 coins, Level 19), `utNoStarter` (UT opened, starter unclaimed, 0 cards), `checkpoint` (standard plus a saved draft run) and `fresh` (first launch).

### Phones and the top edge (`scripts/qa/edge-lib.mjs`)

- `DEVICES`: 393×852 (59/34, the owner's phone), 402×874 (62/34), 420×912 (68/34, inset to confirm on a device), 440×956 (62/34), 430×932 (59/34), 390×844 (47/34), 375×812 (50/34), 375×667 (20/0), 320×568 (20/0, regression only).
- `edgeOf(inset)` mirrors the stage's top edge (22 pt on island phones, 19 on a 47-pt notch, 8 under a 20-pt bar). `TEXT_CLEAR` is how far below the inset text must start to be clear of the band's fade.
- `simulateBand(page, inset)` draws the iOS 26 status-bar blur for screenshots only (pointer events pass through).
- `auditScreen(page, device)`: `textInBand` (cap top of each visible text line above inset + TEXT_CLEAR), `controlInBand` (controls above inset + edge), `bottomCut`, `small` (< 44 design px, counting a `::before` hit area), `overlap` (intersecting hit areas), `tiny`, `lowContrast`, `docScroll`, `hOverflow`, `offscreen`, and the topmost text/control. What is covered by a sheet, pack or match does not count.
- `homeAudit(page)`: Home's classes, every row, the PLAY bar and its fade, the gap to PLAY, overflow, and whether the last row clears the fade at scroll end. `detailBarAudit(page)`: the card-detail action bar against the sheet bottom and any text showing below it.
- `forceStandaloneRule(page, inset)`: `index.html`'s standalone height rule without its media query (Chromium cannot emulate `display-mode`). `arcadeInsets(page, insets)`: gives `.arcade-full` the device's raw insets when it resolves none (Chromium's `env()` is 0). `contactSheet(browser, files, out)`: a labelled PNG grid.

### Runners

- `node scripts/qa/edge-headers.mjs [--sports] [--devices 393,…|all] [--phase before] [--band 393] [--shots 393] [--jobs 3]`: Home, Settings, UT Home and its five tabs, a card detail at top/middle/end, the pack SKIP, the Respin toast, the Draft after a spin and a match frame, per sport and phone. Output: `<PS_QA_SHOTS>/<phase>/<sport>-<device>/NN-screen.png`, `report.json`, a summary JSON and contact sheets. A production build has no soccer bench, so soccer's match frame is dev-only. About 2 minutes per sport for 9 phones.
- `node scripts/qa/home-matrix.mjs [--sports] [--devices] [--phase]`: 4 modes × saved run off/on × online off/on × 3 sports × 9 phones. "Online" starts a signature-verifying relay on this machine with two signed stand-in players (presence and the head-to-head queue). Measurement only.
- `node scripts/qa/perf-ut.mjs [--sports] [--profiles standard,heavy] [--rates 1,4] [--runs 3] [--cpu-profile first|all|none]`: tap → UT ready, long tasks, heap after GC and decoded bytes, medians over the runs; a production build is profiled per chunk, the dev server per named function (pool build vs first render, and rate.ts per 1,000 lines).

### The shell QA snippet for other teams

`scripts/qa/edge-snippet.mjs` (shared copy: `<overhaul scratchpad>/qa-snippets/shell-edge.mjs`, kept identical) shows the final top-edge geometry on a branch without the shell fix: `await applyShellEdge(context, { insets: [59, 0, 34, 0] })` before the first navigation sets `__psInsets`, the `--ps-inset-*`/`--ps-edge` variables, the stage's `--sat` (inset + edge, in frame px) and `.arcade-full`'s `--sat`/`--sab`/`--sal`/`--sar` (screen px). `rawEnvRules(page)` lists rules that read `env(safe-area-inset-*)` directly, which it cannot move.

### Limits

Chromium has no Dynamic Island, no iOS blur and no `display-mode: standalone` emulation; the band is a simulation and `env()` is 0. Installed-iPhone screenshots stay the final check (see `docs/studio-overhaul/shell.md`, "Owner device checks").
