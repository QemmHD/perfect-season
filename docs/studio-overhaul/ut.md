# Team ut: running record (Ultimate Team, the hook, MINUTES and the end of match)

Worktree `/home/user/ps-s-ut`, branch `claude/studio-ut` (cut from live main `acdf3e2`). The plan is [`ut-plan.md`](ut-plan.md) (revision 3, Game Design V2). Every task appends to this file: what changed and why, before/after numbers, tests, "Protocol bump needed", "Touched outside my lane", owner device checks and anything left undone.

`O` = the studio overhaul's shared scratch folder (briefs, heavy.sh, audit scripts, screenshots).

## Status

| Task | State | Commits |
|---|---|---|
| ut-0 foundation: QA harness, compat, kit with V2 tokens, labels, haptics | done | `6aad8dd` compat, `4c78ad1` harness and fixtures, `e71b88e` haptics, `b1ee784` kit and labels, `92e85c9` kit case in design px, then the dead-tap rule and this doc |
| ut-1 … ut-9 | not started | |

## Protocol

**Protocol bump needed: none from team ut** (plan §9). ut-0 changes no match physics, rules, ratings, pairing or settlement: labels are display text, the kit and haptics are presentation, the harness and fixtures are QA-only.

## Touched outside my lane

- `src/ut/Match.tsx` (shared): the screen title and the VS / result eyebrows read their mode names from `labels.ts` (same words). String constants only; no logic, no `UT_RULES` line.

## Merge stand-ins (for the lead)

None yet. (ut-0 consumes nothing from another team.)

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
- **V2 C.3 tokens** `--ps-bg #071521`, `--ps-panel #0e2233`, `--ps-stroke #1d3a50`, `--ps-teal #4fe3c1`, `--ps-gold #f6b93b`, `--ps-violet #8b7cf6`, `--ps-red #ff5d5d`, `--ps-text #f2f7fa`, `--ps-dim #8aa3b5`, defined only on `:where(.screen.ut, .ps-v2, [class^='ut-k-'])` (the UT screen, main-app surfaces that opt in with `.ps-v2`, and each kit piece's own root, so a piece inside a portal still has them). Nothing outside those roots changes; the app-wide `--teal`/`--gold` stay as they are. The kit's own rules draw only with `--ps-*` (a test fails on the old palette).
- **Motion** 120–180 ms ease-out (push 180, pop 140, tab 120, sheet 180), all 0 under reduced motion; `motionMs()` for JS motion.
- Pieces: `SectionTitle`, `RewardChip`, `GoChip` (44 px hit area), `ClaimButton`, `PrimaryButton` (≥ 56 px, `data-primary`), `Countdown` (amber < 24 h), `ProgressRing` (fills from empty on mount), `EmptyState` (icon + line + CTA required by type). **New:** `MinutesRing` (ring + "23 / 30 min" + reward line; states next / ready with a gold dot / done "Done for today"; a ≥ 44 px button when it leads somewhere) and `GoldBar` (the "Next up" strip and the One-More bar: eyebrow, title, stake, chevron; bevelled metallic gold with a sheen; `primary` only for the One-More bar).
- Reduced motion: the CLAIM burst, the CLAIM/primary/gold-bar sheens and the ring fill compute `animation-name: none` (and no ring transition); colour stays.

**Haptics** `src/lib/haptics.ts` (new; contract W2): `haptic('tick' | 'double' | 'long')` (8 ms; 12-40-12; 30 ms) and `hapticsAvailable()`. It wraps sound.ts's `vibrate` unchanged, so the Haptics setting still turns everything off. **The gate:** a haptic plays only while a trusted input event (`pointerdown`, `pointerup`, `click`, `touchstart`, `touchend`, `mousedown`, `mouseup`, `keydown`) is being dispatched (`window.event`); from a timer, promise or animation frame it is dropped, never queued (iOS would otherwise play it on the next, unrelated tap). In an engine without `window.event`, the fallback is `navigator.userActivation.isActive` where present plus an input in the last 800 ms. *Deviation from the plan's "1 s window":* 800 ms keeps the fallback strictly inside sound.ts's own 900 ms iOS gesture window, so sound.ts never queues the tick. `ClaimButton` now calls `haptic('tick')` from its pointer handler, and `haptic('long')` when the claim grants a pack (`pack` prop); `GoldBar` ticks from its pointer handler.

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

### Owner device checks (ut-0)

- Haptics: a tick on CLAIM, the long pattern on a pack claim, and nothing late on an unrelated tap (iOS plays one tick for any pattern).

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
- Rules (each with a unit test): visible + focused only; one ticking tab (`BroadcastChannel` with a `localStorage` lock fallback); per-context input windows (match 45 s, draft 30 s, menus 20 s); `sim` counts real elapsed time only; draft season sim max 3 min per run; queue max 2 min; replay/reward sequences max 2 min per match; menus ≤ 25% of the day's counted total; input variety (≥ 6 events in the last 60 s of a match, not all within 8 px of one point); match and draft seconds are provisional and bank on `bankActivity('complete')` or on a forfeit after ≥ 120 s; menu seconds bank every 60 s; caps 5,400 s a day and 37,800 a week; ET day key and `weekKey()`; date going backwards or a repeated day key freezes accrual for that day.
- **Performance rule:** during a match the ticker makes **0 profile writes** (provisional seconds sit in memory and in the device-local pending key, written on `visibilitychange: hidden`); one write when the activity banks; menu writes at most every 60 s. Never on the per-frame path.
- **Input source:** one capture-phase `pointerdown`/`keydown` listener on `document`. Sports do not have to wire anything; `setPlaytimePaused` is the only optional hook (without it, a paused match stops counting after the 45 s window).
- **Hosts (one line each):** `App.tsx` root (`'menu'`, plus `registerPlaytimeSink`), `ut/Match.tsx` (`'match'`/`'sim'`), the draft play-out host in `App.tsx` (`'match'`), draft screens (`'draft'`). The `App.tsx` lines are outside ut's App grant and are listed under "Touched outside my lane".

**W2. `src/lib/haptics.ts`: three patterns (V2 B.0.5; owned by ut per DESIGN-V2-DECISIONS).**
```ts
export type Haptic = 'tick' | 'double' | 'long';   // input accepted / PERFECT / score or big hit
export function haptic(kind: Haptic): void;         // no-op unless settings.haptics and a user gesture is active
export function hapticsAvailable(): boolean;
```
- It wraps the existing `vibrate`/`tapHaptic` in `src/lib/sound.ts` (unchanged), adds a gesture gate (`navigator.userActivation.isActive` where present, else "inside a pointer handler" via a 1 s window after the last `pointerdown`), and drops calls fired from timers, because iOS replays a queued vibrate on the next unrelated tap. Patterns: tick 8 ms; double 12-40-12; long 30. nba/nfl/soccer call `haptic()` from their input handlers; the PERFECT chime stays soccer's `sound.ts` wiring (V2 F.1).

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
9. Grant or refuse `profile.career` (§2); if refused, ut's fallback `playtime.hook` is already in place.
10. Re-run `scripts/ut_coinflow.ts` with packs' prices and odds; choose `MINUTES_TABLE`.
11. Playtime host lines in `App.tsx` and optional `setPlaytimePaused` in each sport's pause menu; `playtimeLine()` in the pause sheets.
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
- **MINUTES:** a real 20-minute session counts about 20 minutes; backgrounding the app stops the count; a phone call mid-match does not bank a partial match; two phones on one account never double-pay.
- **App-icon badge:** `setAppBadge` on a home-screen app; it may need notification permission on iOS, which the app never asks for, so it may show nothing (acceptable).
- **WebKit-only:** Live Now scroll-snap and edge fade; sticky chips; sheet swipe-to-close against grids.
- **Flows:** force-quit during a Cup round and iOS eviction in the background; the first-run sheet on a fresh install; 375×667 on a real device.

