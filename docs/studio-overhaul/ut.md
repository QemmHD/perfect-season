# Team ut: running record (Ultimate Team, the hook, MINUTES and the end of match)

Worktree `/home/user/ps-s-ut`, branch `claude/studio-ut` (cut from live main `acdf3e2`). The plan is [`ut-plan.md`](ut-plan.md) (revision 3, Game Design V2). Every task appends to this file: what changed and why, before/after numbers, tests, "Protocol bump needed", "Touched outside my lane", owner device checks and anything left undone.

`O` = the studio overhaul's shared scratch folder (briefs, heavy.sh, audit scripts, screenshots).

## Status

| Task | State | Commits |
|---|---|---|
| ut-0 foundation: QA harness, compat, kit with V2 tokens, labels, haptics | done | `6aad8dd` compat, `4c78ad1` harness and fixtures, `e71b88e` haptics, `b1ee784` kit and labels, `92e85c9` kit case in design px, then the dead-tap rule and this doc |
| ut-1 progress core and the light next-best-action engine | done | see the ut-1 section |
| ut-2 MINUTES engine: ticker, profile ledger and cloud merge, ladders and league maths | done | see the ut-2 section |
| ut-3 … ut-9 | not started | |

## Protocol

**Protocol bump needed: none from team ut** (plan §9). ut-0 changes no match physics, rules, ratings, pairing or settlement: labels are display text, the kit and haptics are presentation, the harness and fixtures are QA-only. ut-2 (MINUTES) reads input and time and writes its own ledger only: no match outcome, rating or queue changes.

## Touched outside my lane

- `src/ut/Match.tsx` (shared): the screen title and the VS / result eyebrows read their mode names from `labels.ts` (same words). String constants only; no logic, no `UT_RULES` line.
- ut-1: nothing outside the lane. (`src/ut/packs-claimables.ts` is a new ut file whose body packs fills at merge; see "Merge stand-ins".)
- ut-2, `src/App.tsx` (shared; the MINUTES host lines are outside ut's App grant, plan W1): one import; `registerPlaytimeSink(update)` and the root `usePlaytime(...)` next to `update`; the `PLAY_CTX` screen map and `playId` (2 lines); one `bankActivity` in the draft `finish`; Reset progress keeps `playtime` (the onReset `setProfile` line). No other App logic changes.
- ut-2, `src/ut/Match.tsx` (shared, ut's result path): one import, one `usePlaytime` line, one `bankActivity` line at the top of `finish()`. No `UT_RULES` change, nothing that decides a result.
- ut-2, `src/lib/cloud-save.ts` (V2 grant `src/lib/cloud*`): the other-tab storage listener ignores the ticker's device-only `perfect-season:playtime-*` keys (one condition), so they never queue a cloud save.

## Merge stand-ins (for the lead)

- `src/ut/packs-claimables.ts` (ut-1): returns zero. Packs owns the body: their new claims (calendar check-in and path claims, stamp redemption ready, Program Bag keys), with the same rows added to `inbox.ts` `inboxItems`, and no imports from pool/packs/cards/sbc/rate/squad (`claimables-graph.test.ts`).
- **MINUTES stamps and the 25-hour Player Pick** (ut-2, `src/ut/minutes.ts`): packs' stamp field and Player Pick API are not on this branch, so a claim records an owed receipt in `playtime.owed` (`stamp:day:<ET day>:30:0`, `pick:life:life:1500`; merged as a union, never lost, never paid twice). At merge, packs (or the lead) converts each receipt once by its id. Until then the 30-minute rung pays its 75 coins and the 25-hour rung pays nothing yet.
- **Cross-sport hook state** (ut-2): `profile.career` is not granted yet, so ut-7/ut-8 use the fallback `playtime.hook` (typed as an open record; merged by the same rule: numbers max, lists union, strings newest).
- `claimables.ts` copies of packs-owned checks (Daily Drop `dailyStatus`, `previousDay`, `STREAK_DAYS`; login calendar `calendarStatus`; New Era; Standouts objective): if packs changes the originals, `claimables-reimpl.test.ts` names the copy to update (integration checklist item 5).

---

## ut-0 · Finish the foundation

### What changed

**QA harness** `scripts/qa/ut-studio.mjs` (cases `selfcheck`, `fixtures`, `deadtaps`, `kit`; flags `--sport --size --fixture --edge/--no-edge --cpu --rm --clock --out --dead`):
- Copied from the UI audit's harness (iPhone insets, standalone, touch, `deviceScaleFactor: 1`, shell's Fix A simulated with `--edge`) and extended with per-screen metrics: horizontal overflow, clipping/truncation, targets < 44 (including `::before` hit areas), text < 10 px, contrast (computed, and sampled from the screenshot over gradients), the topmost control against the safe-area top + edge, page errors, long tasks, the `data-primary` count, and tap-feedback latency (pointerdown → first style change or DOM mutation, clicks swallowed). A dead-tap walk taps every control on a screen in a fresh context, with a denylist for anything that spends, sells, submits, goes online or opens a registered pack.
- **Screens:** Home, **Ranks, Profile** (added in this task), UT Home, Play, Squad, Club (Players, Storage, Collection, Development), Challenges (SBCs, Objectives, Season Pass), Store and the Rewards inbox; 3 sports × 393×852 (insets 59/34), 375×667 (20/0), 320×568 (20/0).
- **Isolation:** every HTTP(S) request to a host other than localhost/127.0.0.1 is aborted (Google Fonts excepted), and the app runs on `?ns=inspect&relay=ws://localhost:7777`.
- **Dead taps:** the walk no longer taps the tab or segment that is already open (`aria-current`, a selected `role=tab`): tapping it again rightly does nothing. Switches and toggle buttons are still tapped.
- **Kit case:** sizes are measured in design px (the stage scales the 390 frame to the phone), so 320- and 375-wide phones are judged against the same 44/56 px minimums.
- **Relay guard (new, V2):** every WebSocket goes through Playwright's `routeWebSocket`. Only the local relay (`localhost:7777`, `127.0.0.1:7777`) and the dev server's own HMR socket connect; any other socket is refused with code 1008, listed in the report (`sockets.nonLocal`) and fails the run (exit code 1). The HMR socket is allowed because it is the dev server itself (localhost), not a relay.

**Fixtures** `scripts/qa/ut-fixtures.mjs` → `scripts/qa/fixtures/ut/<sport>-<name>.json` (36 NBA, 36 NFL, 35 soccer; soccer has no Moments). Built through the dev server with the app's own modules at a pinned clock, so they are exactly what localStorage holds. Existing 26 (fresh, starter, new drafter, the audit's club, one per claimable source, runs, expiring, all done, near miss, streak at risk, cold start) plus **10 MINUTES fixtures (new, V2)**: a ledger at 0, 27, 58, 89 and 90+ minutes today; 161 minutes this week (Thursday, the 150 rung waiting) and 600 (Sunday evening, the Premium rung and the daily 60 waiting); a rested return (4 days away, the ledger still on last week); a frozen clock day (the ledger's day is tomorrow, `frozenDay` today); and a played club with `playtime` absent. The ledger has the V2 E.3 shape from plan §2 and is stored only in the basketball profile key, where ut-2 puts it (`SHARED`), for every sport.

**Kit** `src/ut/kit.tsx` + `src/ut/ut-system.css`:
- **V2 C.3 tokens** `--ps-bg #071521`, `--ps-panel #0e2233`, `--ps-stroke #1d3a50`, `--ps-teal #4fe3c1`, `--ps-gold #f6b93b`, `--ps-violet #8b7cf6`, `--ps-red #ff5d5d`, `--ps-text #f2f7fa`, `--ps-dim #8aa3b5`, defined only on `:where(.screen.ut, .ps-v2)` and on a kit piece outside both (`:where([class*='ut-k-']):not(:where(.screen.ut, .ps-v2) *)`, after review) (the UT screen, main-app surfaces that opt in with `.ps-v2`, and each kit piece's own root, so a piece inside a portal still has them). Nothing outside those roots changes; the app-wide `--teal`/`--gold` stay as they are. The kit's own rules draw only with `--ps-*` (a test fails on the old palette).
- **Motion** 120–180 ms ease-out (push 180, pop 140, tab 120, sheet 180), all 0 under reduced motion; `motionMs()` for JS motion.
- Pieces: `SectionTitle`, `RewardChip`, `GoChip` (44 px hit area), `ClaimButton`, `PrimaryButton` (≥ 56 px, `data-primary`), `Countdown` (amber < 24 h), `ProgressRing` (fills from empty on mount), `EmptyState` (icon + line + CTA required by type). **New:** `MinutesRing` (ring + "23 / 30 min" + reward line; states next / ready with a gold dot / done "Done for today"; a ≥ 44 px button when it leads somewhere) and `GoldBar` (the "Next up" strip and the One-More bar: eyebrow, title, stake, chevron; bevelled metallic gold with a sheen; `primary` only for the One-More bar).
- Reduced motion: the CLAIM burst, the CLAIM/primary/gold-bar sheens and the ring fill compute `animation-name: none` (and no ring transition); colour stays.

**Haptics** `src/lib/haptics.ts` (new; contract W2): `haptic('tick' | 'double' | 'long')` (8 ms; 12-40-12; 30 ms) and `hapticsAvailable()`. It wraps sound.ts's `vibrate` unchanged, so the Haptics setting still turns everything off. **The gate:** a haptic plays only while a trusted input event (`pointerdown`, `pointerup`, `click`, `touchstart`, `touchend`, `mousedown`, `mouseup`, `keydown`) is being dispatched (`window.event`); from a timer, promise or animation frame it is dropped, never queued (iOS would otherwise play it on the next, unrelated tap). In an engine without `window.event`, the fallback is `navigator.userActivation.isActive` where present plus an input in the last 800 ms. *Deviation from the plan's "1 s window":* 800 ms keeps the fallback strictly inside sound.ts's own 900 ms iOS gesture window, so sound.ts never queues the tick. `ClaimButton` calls `haptic('tick')`, or `haptic('long')` when the claim grants a pack (`pack` prop), from its click handler; `GoldBar` ticks from its click handler (both moved off `pointerdown` after review: see "ut-0 review fixes").

**Labels** `src/ut/labels.ts`: every existing name unchanged (snapshot), routed through `nav.ts`, `play-status.ts` (`MODE_NAME`) and `Match.tsx` (title and eyebrows). New constants (new names, not renames): Minutes, Active Minutes, Next up, Done for today, Scout Drop, Hot Hand, Perfect Season, Career Road, Prestige. A banned-term test keeps other publishers' program shorthand out of player-facing strings in ut-owned files.

**Compat** (committed earlier in `6aad8dd`): three `acdf3e2` old-save fixtures (`src/ut/compat/`), `studio-compat` tests in 3 sports, and the mixed-client round trip `scripts/compat/old-client.ts` (new → `acdf3e2` → new).

### Numbers

All browser numbers: `scripts/qa/ut-studio.mjs` against the dev server on port 5212, touch, `deviceScaleFactor: 1`, `--edge` (shell's Fix A simulated), `?ns=inspect&relay=ws://localhost:7777`. Reports and screenshots: `O/shots/ut/ut-0/` (`report.json`, `fixtures-report.json`, `deadtaps-report.json`, `kit-report.json`, `kit-report-rm.json`).

**Selfcheck: the before-baseline for every later ut task** (15 screens: Home, Ranks, Profile, UT Home, Play, Squad, Club × 4, Challenges × 3, Store, Inbox; fixture `audit`). Sizes are design px.

| Run | Screens | Failed | Overflow | Clipped | Targets < 44 | Text < 10 px | Low contrast | Top not clear | Page errors | Long tasks | `data-primary` | Tap probes / no visible feedback / > 100 ms | Tap median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NBA 320×568 | 15 | 0 | 0 | 0 | 1 | 136 | 78 | 0 | 0 | 6 | 0 | 148 / 95 / 0 | 15 ms |
| NBA 375×667 | 15 | 0 | 0 | 0 | 1 | 136 | 80 | 0 | 0 | 8 | 0 | 148 / 94 / 0 | 15 ms |
| NBA 393×852 | 15 | 0 | 0 | 0 | 1 | 153 | 81 | 0 | 0 | 6 | 0 | 150 / 89 / 0 | 14 ms |
| NFL 320×568 | 15 | 0 | 0 | 0 | 1 | 140 | 67 | 0 | 0 | 5 | 0 | 148 / 97 / 0 | 15 ms |
| NFL 375×667 | 15 | 0 | 0 | 0 | 1 | 140 | 72 | 0 | 0 | 5 | 0 | 148 / 96 / 0 | 15 ms |
| NFL 393×852 | 15 | 0 | 0 | 0 | 1 | 155 | 72 | 0 | 0 | 6 | 0 | 150 / 91 / 0 | 13 ms |
| Soccer 320×568 | 15 | 0 | 0 | 0 | 0 | 103 | 98 | 0 | 0 | 4 | 0 | 148 / 97 / 0 | 14 ms |
| Soccer 375×667 | 15 | 0 | 0 | 0 | 0 | 104 | 99 | 0 | 0 | 5 | 0 | 148 / 97 / 0 | 15 ms |
| Soccer 393×852 | 15 | 0 | 0 | 0 | 0 | 127 | 106 | 0 | 0 | 6 | 0 | 150 / 92 / 0 | 14 ms |
| **Total** | **135** | **0** | **0** | **0** | **6** | **1,194** | **753** | **0** | **0** | **51** | **0** | **1,338 / 848 / 0** | |

- **Sockets: 376 local (the local relay and the dev server), 0 non-local.** Aborted HTTP host: the live Supabase project only (never reached).
- The 6 small targets are UT Home's promo chips (141×41) in NBA and NFL. "Text < 10 px" and "low contrast" count every offending text node per screen (the same chip counts on each screen it appears on); they are the raw material for ut-4 and ut-9. 0 screens carry a `data-primary` yet (the kit's `PrimaryButton` and `GoldBar` add them from ut-4 on). "No visible feedback" means no computed-style change and no DOM change within 400 ms of a press: most UT controls have no pressed state (the kit's press rule covers new UT surfaces once they use it).
- **Dead taps at 393×852 (fresh context per screen; the open tab or segment is not tapped): 9 per sport, 27 in all.** The same 8 kinds in every sport: the current sport button on Home (NBA) or the selected draft mode (CLASSIC), Ranks' selected GLOBAL toggle, Profile's level ring, Play's selected ALL MODES filter, a Squad slot or formation chip that opens nothing (SG card in NBA, OFFENSE + K in NFL, 4-3-3 in soccer), Collection's selected ALL EDITIONS and ALL filters, Development's active BREAKOUT row, Objectives' selected DAILY chip. Most are already-selected filter chips without `aria-pressed`/`aria-selected`; the rest are real leads for ut-9's walk. (A first walk without the open-tab rule counted 28 / 26 / 28.)

**Fixtures:** 107 (36 NBA, 36 NFL, 35 soccer) load with **0 failures, 0 page errors, 0 non-local sockets**; all **27 MINUTES ledgers** (9 per sport; the 10th fixture has none) are **byte-identical** in storage after the app has loaded, migrated and saved them.

**Round trip** (`scripts/compat/old-client.ts`, new → `acdf3e2` → new): the three `acdf3e2` saves lose nothing in all 3 sports; 15 MINUTES fixtures (27, 90+, week 600, frozen, absent × 3 sports) lose nothing and the old client drops nothing (`oldClientDrops: []`; the NBA path carries `playtime` through both clients).

**Kit** (`kit` case, 3 sports × 3 sizes): CSS **2,684 → 3,457 bytes gzip** (≤ 5,120); `PrimaryButton` 56 px, `GoldBar` 58–60 px, `ClaimButton` 44 px, `GoChip` hit area 44 px, `MinutesRing` 46–48 px high at every size (design px); V2 tokens resolve inside UT (`#071521`, `#4fe3c1`, `#f6b93b`, `#8aa3b5`); 0 page errors; 9/9 pass. **Under `--rm`: 9/9 with the CLAIM burst, the CLAIM, primary and gold-bar sheens and the ring fill all at `animation-name: none`.**

**Haptics:** 100 timer callbacks calling sound.ts `vibrate` directly → **100** vibrations (before); the same 100 through `haptic()` → **0** (after).

### Tests

- `src/lib/haptics.test.ts` (new, 13): the three patterns from inside an input handler; **0 vibrate calls across 100 timer callbacks** (40 timeouts scheduled from inside a tap, an interval, 30 delayed beats), against 100 for the same callbacks through sound.ts directly; a promise after a tap; untrusted and non-input events; the Haptics setting off (through the real sound.ts); the fallback window and user activation; `hapticsAvailable`; haptics.ts never calls `vibrate` directly.
- `src/ut/kit.test.tsx` (24): ClaimButton haptic only from its pointer handler (tick, long for packs, none on keyboard activation or when disabled, no burst under reduced motion); Countdown text and amber tone; EmptyState requires icon, line and CTA (type errors); PrimaryButton; the 120–180 ms motion spec; reduced-motion CSS for burst, sheens and ring fill; the V2 tokens and their scope; MinutesRing states; GoldBar.
- `src/ut/labels.test.ts`: wording snapshot (old names unchanged plus the V2 names), nav titles/tabs/segments equal the constants, no mode name typed out again in nav.ts or Match.tsx, the banned-term scan.
- `src/ut/studio-compat.test.ts`, `src/ut/soccer-studio-compat.test.ts` (from `6aad8dd`).
- **Results** (`bash O/heavy.sh npx vitest run` on labels, kit, haptics, sound, studio-compat, soccer-studio-compat, sport-branches): NBA 74 passed (+1 skipped: the soccer-only compat file), NFL 74 passed (+1 skipped), soccer 84 passed. `npm run typecheck` clean.

### ut-0 review fixes (independent review of `8223f52..8033a4b`)

- **Medium, fixed: haptics on scroll.** `ClaimButton` and `GoldBar` fired their haptic on `pointerdown`, so a scroll that started on them buzzed (the reviewer measured a 279 px scroll from the gold bar calling `vibrate(8)` with no click). Both now fire from `onClick`, a finished tap; a click with `detail` 0 (keyboard, assistive activation) stays silent. On iOS the click follows `pointerup`, which sound.ts counts as the gesture, so the tick still plays at once. haptics.ts's fallback window now also starts on `pointerup`/`touchend`, so the click after a long press counts in an engine without `window.event`. **Measured in Chromium with touch** (kit case, 9 runs: 3 sports × 393/375/320): a touch-drag starting on the gold bar scrolls 223-359 px (with and without `--rm`) with **0** vibrations and 0 clicks (before: 1 vibration per drag); a tap gives **1** click and **1** vibration of 8 ms.
- **Low, fixed: press feedback scope.** The bare `[data-pressed='true']` in the press rule (and its reduced-motion copy) applied app-wide; it is now `.screen.ut [data-pressed='true'], .ps-v2 [data-pressed='true']`. Browser check: a `data-pressed` element outside both roots computes `none none`.
- **Low, fixed: token scope.** The tokens were declared again on every kit element, so a parent that re-tinted `--ps-teal` could not reach a kit piece inside it, and `[class^='ut-k-']` missed a piece whose first class was something else. Now: `:where(.screen.ut, .ps-v2)` plus `:where([class*='ut-k-']):not(:where(.screen.ut, .ps-v2) *)`. Browser check: a piece in a portal (`class="x ut-k-count"`) still reads `--ps-teal #4fe3c1`; a piece under a wrapper that sets `--ps-teal: #123456` reads `#123456`.
- **Low, fixed: focus on the primary button.** Its slanted `clip-path` cut the global focus outline away. `.ut-k-primary:focus-visible` now draws a two-line inset ring (dark `--ps-bg` 2 px, then light `--ps-text` 3 px), readable on teal, gold and the dark page.
- **Low, fixed: press probe.** The kit case read the tab button one frame after `mouse.down`, too early, and the kit host covered the tab bar, so every run reported `none none`. The host is now taken out (`display: none`) for the probe, the report records what sits under the pointer, the probe polls each frame (up to 600 ms) until the style moves and then reads it 250 ms later, and the run fails unless the press scales to 0.97 (under `--rm`: transform stays `none` and brightness still changes). Measured in 9 runs each: `matrix(0.97, 0, 0, 0.97, 0, 0) brightness(1.08)`; under `--rm`, `none brightness(1.08)`.
- **Low, fixed: playtime round trip.** The fixtures case now counts the app's own `localStorage.setItem` calls per key (an init script registered after the fixture is seeded) and only reports `playtimeKept` when `perfect-season:profile:v1` was rewritten at least once. Measured: 107 fixtures in 3 sports, 0 failed, 0 page errors; all 27 fixtures with a MINUTES ledger kept it byte-equal over **4-5** app writes each (none relied on the seeded value alone); 0 non-local sockets.
- **Low, fixed: W2 contract.** §3.1 W2 now says what haptics.ts does (the `window.event` gate, the 800 ms fallback inside sound.ts's 900 ms window, call from `onClick` for buttons, never from a timer).
- Tests: `kit.test.tsx` asserts no haptic on `pointerdown`, none after `pointerdown` then `pointercancel` (a scroll), one on a tap, none on keyboard activation, for both CLAIM and the gold bar, plus the press scope, token scope and focus ring in the CSS; `haptics.test.ts` adds the `pointerup`/`touchend` fallback.
- **Protocol bump needed: none** (presentation and QA only).

### Owner device checks (ut-0)

- Haptics: a tick on CLAIM, the long pattern on a pack claim, nothing late on an unrelated tap (iOS plays one tick for any pattern), and nothing when a scroll starts on a CLAIM button or the gold bar.

---

## ut-1 · Progress core and the light next-best-action engine

### What changed

**Objectives move** `src/ut/objectives.ts` (new, light: imports only `engine/sport`, `hq-state` and types). `Reward`, `Prize`, `Objective`, `DAILY`, `WEEKLY`, `LIFETIME` (the lifetime table, now named), `objectiveDeck`, `hqOf`, `seasonFor`, `seasonReward`, `seasonReady`, `SEASON_TIERS`, `SEASON_STEP`, `readyRewards`, `rewardLabel`, `DEVELOPMENT_PATHS`, `developmentReady` moved unchanged; `progression.ts` and `club-management.ts` re-export them, so every import compiles as before. `weekKey` is a local copy of the ISO-week algorithm (equal to `sbc.ts weekOf` and the boards' `weekKey` for 800 days across two year boundaries), so `progression.ts` no longer reaches `sbc.ts` and the card pool. One internal change: `objectiveDeck` looks receipts up in a `Set` instead of `claims.includes` per objective (same answers; a club with thousands of receipts was the slowest part of the count). Also `clubStatsOf(ut, uid)` → `{ games, wins, since? }` for players' card back.

**Pool-free claimables** `src/ut/claimables.ts`: `utClaimables(ut, day, week, sport, now)` → `{ count, ids, lines, packs, picks, dropReady, dropDay, calendarReady, streak, streakAtRisk, hoursLeft, approx }`. It counts the Rewards inbox's claimable rows by the inbox's own rules. Checks whose originals live next to the pool are local copies (Daily Drop status, login calendar, New Era, Standouts objective, the Cup title, Season Pass tiers), each pinned to its original. The three pool-dependent rows (Sets, Collection milestones, Moments) come from the new optional cache `hq.poolClaimables = { sig, n }`, which `UltimateTeam.tsx` rewrites whenever it computes the inbox (only when it changes, and never over a newer state). `sig` is an order-independent hash of owned and discovered editions plus set/collection receipts and Moments progress (≤ 80 chars). When it does not match (cards gained outside UT, an old client stripped it) the count is the light one with `approx: true`, and the next UT open makes it exact. `streakAtRisk` = Daily Drop waiting, a streak of 2+ days running and ≤ 4 h to Eastern midnight. `inbox.ts` gains `poolRowCount(items)`.

**Packs seam** `src/ut/packs-claimables.ts`: `packsClaimables(ut, day, sport) → { n, ids, lines }`, zero on this branch (merge stand-in above).

**Seen state** `src/ut/seen.ts`: `isUnseen`, `markSeen`, `showDot` (a dot only for something unseen *and* actionable) over the new optional `hq.seen` (≤ 64 keys, key and token ≤ 80 chars, oldest key dropped). Keys reserved: `store:wave`, `live:<id>`, `objectives:week`, `pass:season` (consumers arrive with the hub in ut-4).

**Stamps** `src/ut/stamps.ts`: `ensureStudio(ut, day)` writes `studio:since:<ET day>` and `pid:<12 base36>` (from `crypto.getRandomValues`) into `hq.claims` once; `studioSince` (the earliest, if two phones race) and `playerKey`. `UltimateTeam.tsx` calls it on the first UT open of this build.

**GO targets** `src/ut/go.ts`: `GoTarget = { view, label, odds? }`; `goForCounter` (games/wins/points → Squad Battles PLAY; online wins → Rivals; packs → OPEN your packs, else the Store with odds; SBCs → SBC; Moments → Moments, in soccer a match instead; development → TRAIN; collect → the cards route); `goForObjective` (null once complete or claimed); `goForCards` with **the ethics rule** (SBC, then Scout Market, then a pick, the Store last and flagged `odds`); `openUtAt(view, open)` for the main app.

**GO chips on Objectives and Daily** (`Clubhouse.tsx` ObjectivesView, `DailyHubView.tsx`, new `GoLink.tsx` + `progress-go.css`): every unfinished objective's dead "IN PROGRESS" chip is now the kit's `GoChip` leading where it moves; a Store route says "ODDS SHOWN" under the chip. Daily's unfinished rows get the same chip next to their count, and the all-three bonus leads to the first objective still open. Objectives opens on the first group that holds a ready reward, and "1 REWARD READY" is singular.

**Next best action** `src/ut/next-action.ts` (contract W6): `nextCtxOf(ut, sport, now, extras)` builds a plain `NextCtx` from one sport's save; `nextUp(ctx)` returns `{ id, line, cta, target, stake?, amber?, done? }`. Priority (V2 D.5): 1 unclaimed rewards (this sport, then another sport's stored count via `extras.elsewhere`, the starter pack, Minutes rungs via `extras.minutes`), with the Daily Drop claim drawn **amber** when its streak is at risk; 2 the most recently played unfinished run (Cup, Circuit with "1 win to Finalist", Club Season, UT Draft); 3 a play streak at risk (`extras.streak`, ut-7); 4 something ending within 24 h (Sunday: a weekly objective ≤ 2 games/wins short, a Rivals division ≤ 2 wins short); 5 a milestone 1–2 steps away (Rivals' next division reward; Minutes, league and Career Road arrive through `extras.milestones`); 6 Daily Play (`extras.dailyPlay`, B1); 7 the last of today's three objectives; 8 Season Pass within 30% of the next pack level; 9 a program wave (`extras.wave`, packs); 10 unopened packs or picks; 11 the best next match in the recent mode (Squad Battles rung with its pack stake, Rivals, Legends Events); 12 **Done for today** (dailies done, the 8 paid games played, or Minutes capped) with KEEP PLAYING. With `extras.after` it is the One-More bar (V2 D.10): a third straight loss → a lower rung, an easier difficulty or a 60 s Moments drill (never in soccer); a loss by one score (NBA 3 points, NFL 8, soccer 1 goal) → REMATCH; a FLAWLESS Squad Battles win → the harder rung; a run that continues → its next game; otherwise the next rung. After the day's goals the bar keeps the match one tap away but turns calm (`done`, KEEP PLAYING). Constants mirrored from heavy modules (paid-game cap, rungs and rung packs, Circuit steps) are pinned to their originals.

**Near-miss chips** `src/ut/near-miss.ts`: `nearMisses(ut, sport, now, { sets? })` → at most three chips at 1–2 true steps, closest first, each with a `GoTarget`: "1 win to Finalist", "2 wins to Pro", "1 game to today's bonus", "120 SP to level 7", "1 win to Gold Pack", and sets one card away when the pool-holding caller passes them. Nothing is shown unless the reward is genuinely reachable (a Circuit prize the games left cannot reach gets no chip).

`rivals.ts` names its win reward `RIVALS_WIN_RP = 30` (same value).

**Not done here (plan rev. 2 extras):** the reserved `program` / `stamps` views in `nav.ts` were not added: packs owns those screens, and adding views nobody renders would be dead routes. Packs adds them with their screens.

### Numbers

- **Dead "IN PROGRESS" chips** (`scripts/qa/ut-go-chips.mjs`, isolated phone, touch, fixtures `audit` and `near-miss`): **before 32** at 393×852 on Objectives (near-miss: DAILY 1, WEEKLY 3, LIFETIME 6–7 per sport; Daily's unfinished rows had no control at all) → **after 0** in 3 sports × 393×852 and 320×568 × 2 fixtures, with **176 GO chips** drawn; **88 / 88** GO taps (one fresh phone each, 393×852) opened their screen (Squad Battles, Challenges, Store, Moments, Development, Rivals; soccer's Moments objective opens Squad Battles); 0 page errors; sockets 438 local, **0 non-local**. Screenshots: `O/shots/ut/ut-1/` (before in `before/`).
- **Claimables = inbox count:** 35–36 QA fixtures per sport (all of them), NBA, NFL and soccer: **100%** with a valid cache, and each also equals the inbox the app recorded when it built the fixture. Cold start: `approx` and the light count, then exact after one UT open; a gift outside UT invalidates the cache.
- **Speed** (3,000 owned, 5,000 hq receipts, 5,000 content receipts, 120 banked days): vite-node, mean of 100 — `utClaimables` **0.89 ms**, `nextCtxOf + nextUp` **0.85 ms** (`poolSig` 0.26 ms). Inside vitest (median of 41, parallel workers): 0.99–1.66 ms and 1.27–1.79 ms across the three sport runs. Before the `Set` lookup in `objectiveDeck` the count took 18 ms.
- **Import graph:** from `claimables`, `go`, `stamps`, `next-action`, `near-miss`, `packs-claimables`, `objectives`, `seen` (and now `progression`) no path reaches pool, packs, cards, sbc, rate, squad, content-packs, daily-hub, moments or inbox.
- **Round trip** (`scripts/compat/old-client.ts`): the three `acdf3e2` saves lose nothing; a stamped save (studio stamps, cache, seen) loses nothing, keeps both stamps, and the old client drops only `ut.hq.poolClaimables` and `ut.hq.seen` (caches, rebuilt on the next UT open).

### Tests

- `objectives.test.ts` (10): deck, claim ids, targets, progress, reward amounts and ready counts for six clubs, plus the Season Pass track and calendar, against a snapshot written by the **pre-move** code; re-exports are the same functions; `weekKey` over 800 days; `clubStatsOf`.
- `claimables.test.ts` (≈ 40 per sport): every QA fixture equals the inbox; cold start; stale cache; idempotent cache write; the streak window at 19:59 vs 20:01 ET.
- `claimables-reimpl.test.ts` (≈ 37 per sport): every copy equals its original over every fixture and a 60-day calendar; next-action's mirrored constants equal play.ts, battles.ts and circuit.ts.
- `claimables-graph.test.ts` (9): the static import walk (type-only imports skipped), with a sanity check that it sees the heavy path.
- `progress-core.test.ts` (13): seen state, stamps (once, earliest, survives reload, ignored by objectives), GO targets exist and are shown in this sport, packs/odds, the ethics order, additive hq fields (old saves gain no keys; malformed cache dropped).
- `next-action.test.ts` (27): one case per priority level 1–12 (several for 1), recency tie-break, each `after` rule (rematch by each sport's score, lower rung, easier difficulty, drill / none in soccer, FLAWLESS, run continues, next rung, calm Done), never Done while anything is claimable (400 fuzzed clubs), near-miss chips (three, sorted, deterministic, none out of reach), speed.
- `soccer-claimables.test.ts` runs claimables, reimpl, next-action and progress-core under soccer's run.
- **Results:** NBA 15 files / 212 tests (with inbox-completeness, overhaul, polish, play-status, labels, kit, studio-compat, rivals, sport-branches) green; NFL the same 212 green; soccer `vitest run soccer sport-branches` 11 files / 201 green. `npm run typecheck` clean. Existing tests unedited.

### Protocol

None. Nothing here touches match physics, ratings, pairing or settlement; the objectives move changes no id, target or reward.

### Owner device checks (ut-1)

- GO chips on Objectives and Daily under the thumb at 375 and 320 widths; the "ODDS SHOWN" line reads at arm's length.

---

## ut-2 · MINUTES engine: the ticker, the ledger and the ladders

### What changed

**The ticker** `src/lib/playtime.ts` (contract W1, V2 E.1/E.2/E.8). One 1 s interval on `performance.now()` deltas (a gap after sleep counts at most 2 s) and one capture-phase input listener (`pointerdown`, `keydown`, and `pointermove` at most 4 times a second so a held joystick drag counts). A second counts only when the page is visible and focused, this tab holds the single-tab Web Lock (released on hide or blur; storage-lock fallback), the screen's context allows it, and the sport has not paused it:

| Context | Counts when | Cap | Class |
|---|---|---|---|
| `match` | an input in the last 45 s **and** variety: in the last 60 s at least min(6, age/10) inputs, not all within 8 px of the first | none | provisional (banks with the match) |
| `sim` | always (real time) | none | provisional |
| `draft` | an input in the last 30 s | none | provisional |
| `draftSim` | always | 180 s a run | provisional |
| `replay` (result and reward screens) | always | 120 s a match | play, banked |
| `queue` | always | 120 s a queue | menu |
| `menu` | an input in the last 20 s | menus ≤ 25% of the day | menu |
| `off` | never | | |

Provisional seconds stay in memory and, when the page hides, in the device-only key `perfect-season:playtime-pending:v1` (no profile write). `bankActivity(id, 'complete')` banks them in one profile write, together with any menu/raw buffer, and counts a completed activity (a whole-match SIM counts as completed with its few seconds); `'forfeit'` banks only after 120 s of the match and is not a completed activity; a new activity drops an unbanked one; a second bank of the same id is a no-op, and a finished match's screen counts nothing more until the screen changes. Menu seconds bank once a minute and never while a match or run is live; raw time alone (app open, no input) writes at most every 10 minutes. A relaunch the same day resumes the parked seconds (so ut-6 can settle a killed match as a forfeit); an earlier day's are dropped.

**The ledger** (pure, in `playtime.ts`): `credit(ledger, { sec, menu, raw, sport, act }, now, endowed)` rolls to the Eastern day and ISO week, applies the caps (5,400 s a day, 37,800 a week, also against a tampered `weekDays`), the menu rule (menu ≤ ⅓ of play, i.e. ≤ 25% of the day), keeps raw time apart, marks a **rested** day (first day back after 3+ days away) and, when the date goes back (or a day key repeats), freezes the day: `frozenDay` is set and only raw lifetime time grows. A new player's ledger is born with `endowed: <day>` (3 of the first 5 minutes on that day's ladder only; counted seconds and boards are untouched). `playtimeView` and `playtimeLine` ("Today 27 min · next reward at 30", "… · done for today", "Minutes paused: the date changed") are ready for ut-3 and the sports' pause sheets.

**Profile** `src/lib/profile.ts`: `playtime?: Playtime` in `SHARED` (it lives in the basketball key for every sport); `settings.hideBoards?` and `settings.breakReminder?` (absent = boards shown, reminder on; no default is written, so old saves stay byte-equal). `src/App.tsx` Reset progress keeps the ledger (time played is a record, and a reset must not pay the day's rungs again).

**Cloud** `src/lib/cloud-data.ts`: `mergePlaytime(a, b)` (max of every count, per day and weekday when they match; the later day's and week's values otherwise; union of claimed rungs per day/week key and of lifetime rungs; union of owed receipts; newer league with the best tier kept; hook state numbers max / lists union) and `withDeviceLedger`, which `applyProgress` runs on the basketball key: a restore keeps this phone's minutes and claims and changes nothing else (a snapshot without a ledger, onto a phone without one, is applied byte for byte). `cloud-save.ts` ignores the ticker's device keys in its other-tab listener.

**Ladders and league** `src/ut/minutes.ts` (contract W5): `ladders(table)`, `LADDERS`, `MINUTES_TABLE = 'full'`; `minutesView` (three tracks, next rung, ready rungs, rested, frozen, capped), `nextRung` (nearest on any track, the day wins ties), `claimMinutes` (pure, idempotent: coins to the wallet, packs into the club of the sport you claim in with ids `minutes:<track>:<period>:<at>:<sport>:<t>`, stamps and the Player Pick as owed receipts), `minutesExtras` (the NextExtras feed for `next-action.ts`: claimable count and line, the cap, a rung ≤ 5 minutes away as a milestone), `freshForMinutes`, `rewardText`, `coinValue`. League: `leagueResult` (a tier's entries with minutes, shuffled by an FNV+avalanche hash of week and key, divisions of about 30, top/bottom 20% move, never down from Rookie or up from Hall of Fame, < 10 entries → thresholds 300/60 with everyone shown, rival = the entry above with the gap, minutes to the promotion line), `leagueReward`, `leagueSeason` (6-week seasons from 2026-W47), `seasonEndTier`.

**Host wiring:** App (sink, root context, the draft run as the activity, its bank in `finish`), `ut/Match.tsx` (context by stage, bank at the top of `finish()`, so the bank write and the match's rewards are one React update).

### Numbers

- **Before:** no time tracking at all (no ledger, no ticker).
- **Browser, full autoplay Squad Battles match** (`node scripts/qa/ut-minutes.mjs --sport all`, dev server 5212, 393×852 touch, isolated: `?ns=inspect&relay=ws://localhost:7777`, every non-local host aborted — only the live Supabase host was attempted and blocked —, 0 sockets refused, game at 4x speed, CPU throttled 4x, a stand-in thumb tapping a different spot every 1.5 s):

| Sport | Active s | Counted s | Diff | Profile writes during play | At bank | Ticker ms/call (thread time, 4x CPU, median / p90) | Page errors |
|---|---|---|---|---|---|---|---|
| NBA | 35.2 | 35 | −0.46% | 0 | 1 | 0.059 / 0.875 | 0 |
| NFL | 76.2 | 76 | −0.20% | 0 | 1 | 0.067 / 0.787 | 0 |
| soccer | 60.6 | 60 | −0.98% | 0 | 1 | 0.068 / 0.483 | 0 |

  The p90/max include slices of the CPU throttler itself; the largest single call was 2.5 ms, so the ticker causes no long task (> 50 ms). With `BroadcastChannel` as the lock the median was 0.18 ms at 4x and 0.13 ms at 1x; the Web Lock (and caching `navigator.locks`, and building the cap key only where a cap applies) took it to ≈ 0.06 ms.
- **Size:** `playtime.ts` **3,055 B** gzip (esbuild minified, React and `engine/sport` external) ≤ 3,072. The merge rule adds 784 B gzip to `cloud-data.ts`. `minutes.ts` 2,899 B gzip; nothing imports it at runtime yet (ut-3's Minutes screen will, lazily).
- **E.5 economy reproduced** (`minutes.test.ts`, a simulated week claimed every evening, coin-equivalents per day from the day and week ladders): casual (17 min) **96**, regular (30) **200**, engaged (60) **514**, maximum (90) **750**, three hours a day still **750**; daily ladder 250 coins + Silver + a stamp = **450**, weekly **2,100**; raw coins from time for the engaged player **221**/day (< ≈ 384 from matches). `lean` is cheaper on every row.
- **Mixed clients** (`npx vite-node scripts/compat/old-client.ts`, 3 sports): an old save is written **byte for byte** as the live build writes it; new → old (acdf3e2) → new loses nothing; with a ledger and both settings in the shared key, both come back byte-equal from the old client in the profile keys **and** through the encrypted cloud snapshot (new capture → old apply/capture → new apply).

### Tests

- `src/lib/playtime.test.ts` (36, a fake page on fake timers, one named test per rule): E.1.1 visible+focused, sleep gap; E.1.2 two tabs count one (Web Lock and storage fallback); E.1.3 match 45 s / Auto-defend alone / draft 30 s / menus 20 s / SIM 4 s = 4 s / draft sim 3 min / replay and queue 2 min / paused / a finished match's screen; E.1.5 taped thumb, ±8 px auto-tapper, < 6 inputs a minute, joystick drag counts; E.1.4 0 writes in a 5-minute match and exactly 1 at bank, forfeit 119 s → 0 and 121 s → banks, unfinished match never banks, menu banks once a minute and never during a match, hide parks on the device and a relaunch resumes, an earlier day's parked seconds are dropped, raw-only writes every 10 min; E.1 menus ≤ 25%; E.2 5,400/day, 37,800/week (and a tampered week), midnight-ET and Monday rollover, `etDay`/`isoWeek` = `easternDateKey`/boards `weekKey` for 800 days, rested; E.8 date set back freezes, repeated day key freezes, a relaunch cannot reset the cap; endowed only for a new player; view and line; an hour of ticks with a full input buffer.
- `src/ut/minutes.test.ts` (23): the tables (full, lean, power stops at 25 h, pack values = half the NBA price), the E.5 per-day values, every rung of the three ladders pays once, rungs of another day are not paid, packs land in the claiming sport's club, a frozen day pays no daily rung, two phones that both claimed before syncing never pay twice and keep every minute, rested (doubled 5/15/30 coins once, +60 weekly minutes for that week only, 2 days away is not rested), endowed, `nextRung`, `minutesExtras`, the league with 31, 60, 30, 9, 1 and 0 entries, ties, rewards and seasons.
- `src/lib/profile-playtime.test.ts` (8): the acdf3e2 save loads with `playtime` undefined and no new settings key and saves back with none; the ledger and settings load and save in the basketball key from every sport; `mergePlaytime` same day / different days / new week / hook; a server save applied over this phone keeps its minutes and claims; byte-for-byte apply without a ledger.
- `src/lib/soccer-playtime.test.ts` runs all three suites under soccer's run.
- **Results:** typecheck clean. NBA `vitest run src/lib src/ut src/engine/sport-branches.test.ts`: 49 files, 566 passed. NFL the same: 563 passed, 1 failed once (`next-action.test.ts` ut-1 speed test, ≤ 2 ms, while the machine was loaded; 27/27 green on its own re-run; not touched here). Soccer `vitest run soccer sport-branches`: 12 files, 268 passed. Existing tests unedited.

### Protocol

None. MINUTES reads input and time and writes the ledger; nothing in a match's physics, ratings, pairing or settlement changes (plan §9 item 5).

### Known limits (documented, not bugs of this task)

- Two sports open at once in two tabs both hold the shared profile in memory; the last one to save writes the shared part (wallet, and now the ledger). This is the app's existing multi-tab behaviour for the wallet; only one tab ticks, but a claim made in one tab can be overwritten by a stale tab's save. Single-app use (the iPhone home-screen app) is unaffected.
- Resolving a cloud conflict with "this phone" keeps the phone's whole save, so the other phone's minutes since the last sync are not merged in (the merge runs on the apply path, as specified). Choosing "server" merges.
- A file backup restore (`recovery.ts restoreBackup`, outside the grant) replaces the ledger like any other field.

### Owner device checks (ut-2)

- A real 20-minute session of matches and menus counts about 20 minutes (Profile panel arrives in ut-3); switching to another app or locking the phone stops the count at once; a phone call mid-match does not bank the match; killing the app mid-match and relaunching the same day keeps the match's seconds pending (ut-6 settles them).

---

## V2 shared pieces: interface contracts (plan §3)

Other teams can code against these now. Each contract is copied into `ut.md`. Where another team's piece is not on ut's branch yet, ut keeps a ≤ 8-line local stand-in marked `// merge: replace with <team>'s <name>`, listed in `ut.md` for the lead.

### 3.1 Written by ut

**W1. `src/lib/playtime.ts`: the active-time ticker (V2 E.1, E.2, E.8; owned by ut per DESIGN-V2-DECISIONS).**
```ts
export type PlayCtx = 'match' | 'sim' | 'draft' | 'draftSim' | 'menu' | 'queue' | 'replay' | 'off';
export interface Activity { id: string; sport: SportId; kind: 'match' | 'draft' | 'daily' }
export function usePlaytime(ctx: PlayCtx, activity?: Activity): void;   // one line in a host component
export function bankActivity(id: string, how: 'complete' | 'forfeit'): void; // host calls on finish/quit
export function setPlaytimePaused(paused: boolean): void;              // sports' pause menus (optional, 1 line)
export function registerPlaytimeSink(update: (fn: (p: Profile) => Profile) => void): () => void; // App, once
export function playtimeLine(p: Profile, now?: number): string;        // "Today 27 min · next reward at 30"
export function playtimeView(p: Profile, now?: number): PlaytimeView;  // today/week/life, counted and raw, done
```
- **As built (ut-2):** the single-tab lock is a **Web Lock** (`navigator.locks`, same browsers as `BroadcastChannel`: Safari 15.4+, Chrome 69+) with the `localStorage` lock as the fallback. `BroadcastChannel` was built first and measured: its per-second `postMessage` was the ticker's biggest cost inside a match (≈ 0.1 ms of the 4x budget); a held lock costs nothing per second. `mergePlaytime` lives in `src/lib/cloud-data.ts` (the apply path; it keeps `playtime.ts` under 3 KB gzip). Also exported: `enterPlaytime(ctx, activity) → leave()` (the hook's body, for non-React hosts and tests), `credit`, `rollTo`, `freshPlaytime`, `etDay`, `isoWeek`, `weekday`, `DAY_RUNGS`, `DAY_CAP`, `WEEK_CAP`, `ENDOWED_SEC`.
- Rules (each with a unit test): visible + focused only; one ticking tab (`BroadcastChannel` with a `localStorage` lock fallback; as built, a Web Lock, see above); per-context input windows (match 45 s, draft 30 s, menus 20 s); `sim` counts real elapsed time only; draft season sim max 3 min per run; queue max 2 min; replay/reward sequences max 2 min per match; menus ≤ 25% of the day's counted total; input variety (≥ 6 events in the last 60 s of a match, not all within 8 px of one point); match and draft seconds are provisional and bank on `bankActivity('complete')` or on a forfeit after ≥ 120 s; menu seconds bank every 60 s; caps 5,400 s a day and 37,800 a week; ET day key and `weekKey()`; date going backwards or a repeated day key freezes accrual for that day.
- **Performance rule:** during a match the ticker makes **0 profile writes** (provisional seconds sit in memory and in the device-local pending key, written on `visibilitychange: hidden`); one write when the activity banks; menu writes at most every 60 s. Never on the per-frame path.
- **Input source:** one capture-phase `pointerdown`/`keydown` listener on `document`. Sports do not have to wire anything; `setPlaytimePaused` is the only optional hook (without it, a paused match stops counting after the 45 s window).
- **Hosts (one line each):** `App.tsx` root (`'menu'`, plus `registerPlaytimeSink`), `ut/Match.tsx` (`'match'`/`'sim'`), the draft play-out host in `App.tsx` (`'match'`), draft screens (`'draft'`). The `App.tsx` lines are outside ut's App grant and are listed under "Touched outside my lane". **As built:** App's one `usePlaytime` maps its screens (`search` queue, `draft` draft, `arcade` match, `reveal`/`playoffs` draftSim, `results` replay, everything else menu) with the draft run as the activity (`draft:<saveId | online matchId>`); `ut/Match.tsx` maps `play` match, `result` replay, `search` queue, the rest menu, with `ut:<req.id>` as the activity.

**W2. `src/lib/haptics.ts`: three patterns (V2 B.0.5; owned by ut per DESIGN-V2-DECISIONS).**
```ts
export type Haptic = 'tick' | 'double' | 'long';   // input accepted / PERFECT / score or big hit
export function haptic(kind: Haptic): void;         // no-op unless settings.haptics and a user gesture is active
export function hapticsAvailable(): boolean;
```
- It wraps the existing `vibrate` in `src/lib/sound.ts` (unchanged, so the Haptics setting still turns every pattern off) and adds a gesture gate. **The gate is `window.event`:** a haptic plays only while a trusted input event (`pointerdown`, `pointerup`, `click`, `touchstart`, `touchend`, `mousedown`, `mouseup`, `keydown`) is being dispatched. In an engine without `window.event`, the fallback is `navigator.userActivation.isActive` (where present) plus an input (`pointerdown`, `pointerup`, `touchstart`, `touchend` or `keydown`) in the last **800 ms**, which sits inside sound.ts's own 900 ms iOS gesture window so the tick plays at once and is never queued. Anything else (a timer, a promise, an animation frame, a count-up) is dropped, never queued, because iOS replays a queued vibrate on the next unrelated tap.
- **How to call it:** from the input handler itself, never from a timer. For a button, call it from `onClick` (a finished tap), **not** `onPointerDown`: a pointerdown can be the start of a scroll, and a scroll must never buzz (the kit's CLAIM button and gold bar do this). A game control that acts on touch-down (a stick, a shoot button held for a meter) may call it from its own `pointerdown`, because there the touch-down is the action. Patterns: tick 8 ms; double 12-40-12; long 30. nba/nfl/soccer call `haptic()` from their input handlers; the PERFECT chime stays soccer's `sound.ts` wiring (V2 F.1).

**W3. `src/lib/profile.ts`, `src/lib/cloud*` (V2 grant):** `playtime?: Playtime` (§2) in `SHARED`; `settings.hideBoards?: boolean` (default false) and `settings.breakReminder?: boolean` (default true); additive `streak` fields; `career?` pending the lead's OK (§2). `mergePlaytime` in the cloud apply path. Tests: an old-shape save loads with every field byte-equal; the round trip keeps `playtime`.

**W4. `src/net/leaderboard.ts` (V2 grant): `BoardKind` gains `'minutes'` and `'play'`.**
- Tags exactly as V2 E.7: `perfect-season/minutes/v1/w/<weekKey>` + `NS_SUFFIX` (weekly and league), `perfect-season/minutes/v1/all` + `NS_SUFFIX` (Hall of Fame), `perfect-season[/nfl|/soccer]/v1/play/<day>` + `NS_SUFFIX` (Daily Play; the branch ships ready, its host is buffer item B1).
- Content: weekly `{ v: 1, name, tier, perDay: number[7], acts: number[7], s: [nba, nfl, soccer] }`; all-time `{ v: 1, name, hours, acts, s }`; play `{ v: 1, name, score, perfects, ms }`.
- Reader validation (untrusted input): integers only; each `perDay[i]` ≤ 90; no minutes on a future day; sum ≤ 90 × days elapsed; ≤ 25 counted minutes per completed activity on average and ≥ 1 activity per 12 minutes on any day above 30; `created_at` inside the claimed week; updates at most every 5 min; names through `displayName()`; the existing `BLOCKED` list.
- Ranking ties: more active days, then more activities, then earliest to the score.
- **`settings.hideBoards` stops all publishing** for every board kind at the one publish function; reading still works.
- **Test:** `boardTag` output for `daily | classic | blind | h2h` × every `Span` × 3 sports × `NS_SUFFIX` on/off is byte-identical to a snapshot taken from `acdf3e2`, and with `hideBoards` off every existing publish payload is byte-identical too.

**W5. `src/ut/minutes.ts`: ladders, claims and the league maths (V2 E.5, E.6).**
```ts
export const MINUTES_TABLE: 'full' | 'lean';                 // the lead's lever (§7); default 'full' per decision 1
export const LADDERS: { daily: Rung[]; weekly: Rung[]; life: Rung[] };  // E.5 numbers, one constants table
export function minutesView(pt: Playtime | undefined, now: number): MinutesView; // tracks, next rung, done, rested
export function nextRung(pt: Playtime | undefined, now: number): { track: 'day' | 'week' | 'life'; atMin: number; minutesLeft: number; reward: Reward } | null;
export function claimMinutes(p: Profile, now: number, sport: SportId): { profile: Profile; granted: Reward[] }; // pure, idempotent
export function leagueResult(entries: WeekEntry[], me: string, tier: number, week: string): LeagueResult;   // divisions of 30, top/bottom 20%, < 10 entries → thresholds 300/60
```
Rewards are coins (shared wallet), ordinary packs deposited in the UT of the sport you claim in, and Scout Stamps through packs' planned stamp field (stand-in: none granted, a line in `ut.md`, until packs' API lands).

**W6. `src/ut/next-action.ts`: one engine, four surfaces (V2 D.5).**
```ts
export interface NextAction {
  id: string;                       // stable, e.g. 'claim', 'run:cup', 'minutes:day:30'
  line: string;                     // "3 min to 75 coins + a Scout Stamp"
  cta: string;                      // "GO", "CLAIM ALL", "PLAY"
  target: Target;                   // { app: 'ut'; view: UtView } | { app: 'draft'; mode } | { app: 'minutes' } | { app: 'match'; setup: MatchSetupRef }
  stake?: string; amber?: boolean; done?: boolean;
}
export function nextUp(ctx: NextCtx): NextAction;   // light: no pool/packs/cards/sbc/rate/squad imports
```
Priority, first match wins (V2 D.5 order): unclaimed rewards (UT claimables, Minutes rungs, the first-run starter) → an unfinished run → streak at risk today → something expiring within 24 h → 1–2 steps from a milestone (a Minutes rung ≤ 5 min away, the league promotion line, a Career Road reward level) → the Daily Play if unplayed (slot; null until B1) → a daily objective at 2 of 3 → Season Pass within 30% of a named reward → a new program wave in its first 48 h → unopened packs or picks → the best next match in your most recent sport and mode → **Done for today**. With `ctx.after` (a finished match) it returns the One-More target: next rung / next Cup round / next Circuit game / REMATCH after a loss by one score / a lower rung or drill after a third straight loss / the harder rung after a FLAWLESS win (V2 D.10). It reads other sports only through their stored claimables count (cheap `localStorage` read), never their pools.

**W7. Surfaces ut owns:** the main Home "Next up" strip and Minutes ring chip (in ut's `Pages.tsx` strip grant), the UT tab badge and `navigator.setAppBadge`, the Minutes screen as a RANKS segment (new lazy `src/ui/MinutesView.tsx`; a ≤ 6-line segment hunk in `RanksPage`, listed as outside the lane), the UT Hub, the PreMatch screen, the end-of-match sequence and One-More bar (`ut/Match.tsx` result path, `MatchDebrief`), Profile's playtime panel and the two settings.

### 3.2 Consumed by ut (published by other teams; ut's assumptions)

**C1. Match grade on the final `Progress` (each sport, V2 F.1; ut proposes the shape as the consumer).** `src/game/progress.ts` gains, once, by the lead:
```ts
grade?: { letter: 'S' | 'A' | 'B' | 'C'; perfects: number; chances: number; heatPeak: number; onFire: number; flawless: boolean };
```
- Only on the `Progress` passed to `onFinish`, never on `onProgress`. ut's `stripLocal(p)` also drops `grade` and `box` before `conn.update`, as a second guard.
- ut reads it duck-typed. Absent → the grade line, PERFECT/Heat objectives' progress from that match and the FLAWLESS rule are simply skipped. ut never imports `heat.ts` or `perfect.ts` (V2 F.2 ut #9: read-only).

**C2. Box data (nba/nfl/soccer, as already published):** `Progress.box?: BoxLine[]`, `BoxLine = { id; name; tag?; pos?; side: 'us' | 'them'; rating?: number /*1–10*/; stats: Record<string, number> }`, on the final `Progress` only. ut's `match-ratings.ts` rates lines that lack `rating` (NBA game score, NFL passer/rusher/receiver/defender lines) and uses soccer's own.

**C3. Quit and forfeit (as published):** `onQuit?(us, them)` on the game component and `onFinish(us, them, how, took, pens?, forfeit?: 'us' | 'them')`; `'FF'` end code worth 0. ut maps solo quit in Cup/Circuit/Club Season/UT Draft to a confirmed forfeit and in Squad Battles/Events to "leave without a result".

**C4. Arena kept mounted through the result (nba, per DESIGN-V2-DECISIONS; nfl/soccer adopt).** ut asks `Arcade` for `holdAfterFinish?: boolean` (after `onFinish` the arena stays drawn, input inert) and a re-seed by changing the `key`/`seed` props without re-fetching assets. ut's result sheet then overlays the dimmed arena. Until it lands, ut's result screen replaces the arena as today, and One-More starts the next match through the existing path.

**C5. Auto-defend preference:** today three keys (nba `perfect-season:hoops-prefs:v1`.autoDefend, nfl `perfect-season:auto-defend`, soccer `perfect-season:soccer-prefs:v1`.autoDefend); the lead unifies them (V2 F.2 lead #3). ut reads through `src/ut/defense-pref.ts` (registry; the lead registers the modules) and never writes those keys.

**C6. Packs:** `promo-hub.ts` (`liveNow`, `upcomingDrops`, `launchDue`, `calendarClaimables`) for Live Now; `packsClaimables(ut, day, sport)` body for the badge; the **Scout Drop tier tables** with upgrade chances (packs F.2 #3); the **Player Pick 1 of 3 golds 84+** (25-hour milestone, Rookie Week day 7); Scout Stamp grants on the planned stamp field. Until merge ut uses existing pack ids (Silver, Gold, Premium, Jumbo, Scout's Choice) and stubs that return zero.

**C7. Shell:** `--sat`/`--sab` on every top or bottom overlay; the arena curtain's `curtain: 'compact'` variant; Fix A injected in QA until the real CSS merges.

**C8. Daily Play scenarios (each sport, P1, `src/game/*/daily-play.ts`).** ut's host (buffer B1) expects `{ id: string; day: string; title: string; setup: MatchSetupRef; score(p: Progress): number }`.


---

## Integration checklist for the lead (plan §10)

1. `src/game/progress.ts`: add `box?`, `grade?` (C1 shape), `simmed?`, `ot?`, `forfeit?` once; re-run `match-how`, `match-recap`, `strip-local`, `objectives-v2`.
2. C4: confirm `holdAfterFinish` and re-seed; measure final whistle → next tip-off ≤ 10 s with one thumb at 4× CPU in 3 sports.
3. C5: unify the auto-defend keys and register the modules in `defense-pref.ts`.
4. C6: fill `packs-claimables.ts`; switch Scout Drop tiers, the 84+ Player Pick and stamp grants to packs' APIs; re-run `scout-drops.test.ts` and the coin flow.
5. Re-run `claimables.test.ts`/`claimables-reimpl.test.ts` against packs' final `content-packs.ts`, `daily-hub.ts`, `promo-hub.ts`.
6. Run `scripts/ut_daily_sim.ts` on the merged engines; change only `objective-targets.ts` values.
7. Re-run `live-match.test.ts` (3 sports) on the merged engines (defense possessions, OT, `simRest`).
8. Re-run `verdict.test.ts` and `end-codes.test.ts` with real OT, pens and `FF`.
9. Grant or refuse `profile.career` (§2); if refused, ut's fallback `playtime.hook` is already in place (typed and merged since ut-2).
10. Re-run `scripts/ut_coinflow.ts` with packs' prices and odds; choose `MINUTES_TABLE`.
11. Playtime host lines in `App.tsx` (in place since ut-2) and optional `setPlaytimePaused` in each sport's pause menu; `playtimeLine()` in the pause sheets. Convert `playtime.owed` receipts (`stamp:…`, `pick:…`) into packs' stamp field and Player Pick once, by id.
12. `haptics.ts` adopted by nba/nfl/soccer (no direct `vibrate` from timers anywhere).
13. Mixed clients: run the round trip with every team's merged normalizers and profile fields.
14. Shell: real Fix A CSS instead of the injected one; the dead `.ut-season-chip` rule; `curtain: 'compact'`; the Next up strip resolved before the splash lifts.
15. Protocol: confirm §9.
16. L2 "Find your rhythm. Own the game." (Pages.tsx Training Camp row, 9 px) is in no team's grant: raise it to ≥ 10 px.

## Lead decisions (plan §11: flagged, defaults applied)

1. **Economy:** full Minutes table lands at ≈ +53–62% over today vs the accepted "about +50%"; default `'full'`, lever `'lean'` (≈ +43–52%). Circuit/Rivals pay and the weekly chest upgrade are deferred to make room.
2. **`profile.career` in `SHARED`** (one line outside the playtime grant). Default: use it if granted, else `playtime.hook`.
3. **Interrupted matches:** auto-finish limit 2 a week; human-side handicap −0.15.
4. **Rivals rage-quit** (killing the app mid online Rivals match avoids −12 RP): not built; proposal kept from revision 2.
5. **Scout Drops count draft H2H and Gauntlet wins** (V2 says "any mode"). Default: yes; Daily Play clears count once B1 lands.
6. **"Hide leaderboards"** stops publishing to every board (existing ones too) but keeps reading. Default: yes.

## Owner device checks (plan §12; only a real iPhone can confirm)

- **Feel:** the Next up strip and Minutes chip under the Dynamic Island fix; the 5-second end of match and the One-More reach with the right thumb; Scout Drop rhythm.
- **Haptics:** tick on claims, long on packs; nothing fires late on an unrelated tap.
- **MINUTES (engine from ut-2):** a real 20-minute session counts about 20 minutes; backgrounding the app stops the count; a phone call mid-match does not bank a partial match; two phones on one account never double-pay.
- **App-icon badge:** `setAppBadge` on a home-screen app; it may need notification permission on iOS, which the app never asks for, so it may show nothing (acceptable).
- **WebKit-only:** Live Now scroll-snap and edge fade; sticky chips; sheet swipe-to-close against grids.
- **Flows:** force-quit during a Cup round and iOS eviction in the background; the first-run sheet on a fresh install; 375×667 on a real device.

