# Team ut build plan: Ultimate Team, the hook, MINUTES and the end-of-match loop

Planner output, **revision 3 (Game Design V2)**, 2026-11-16. Worktree `/home/user/ps-s-ut`, branch `claude/studio-ut` (cut from `acdf3e2`), dev-server port 5212. Build engineers follow this plan task by task, in order. Every task updates the running record `docs/studio-overhaul/ut.md` (created in ut-0): what changed, before/after numbers, "Protocol bump needed", "Touched outside my lane", owner device checks, the integration checklist and lead decisions.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Binding sources for this revision (read in full):** `O/BRIEF.md` (owner decisions 2026-11-09 and the V2 section), `O/BUILD-RULES.md`, `O/OWNERSHIP.md` (with the V2 grants), `O/STREAM-ut.md`, `O/design-v2/GAME-DESIGN-V2.md` (all of it; F.2 "ut" is this team's list), `O/design-v2/research-engagement.md`, `O/design-v2/mockups.html` (opened in Playwright; sections 1 and 3 are the visual target for every ut surface below), `O/DESIGN-V2-DECISIONS.md`, `CLAUDE.md`. Revision 2 (git `237337a`) is the base; its critique mapping is in that commit and is not repeated here.

**What revision 3 changes.**
- **The first-impression slice comes first** (V2 F.4 item 8): MINUTES with local daily and weekly ladders (ut-2, ut-3), the "Next up" strip and one next-best-action engine (ut-1, ut-4), and the 5-second tally ending in the One-More bar (ut-5). The solo PreMatch and the mid-match-kill fix (audit P0s that V2 does not replace) follow at ut-6.
- **New V2 work owned by ut** (V2 F.2 "ut" and the lead's grants): `src/lib/playtime.ts`, `src/lib/haptics.ts`, the profile `playtime` field with its cloud merge, the `minutes` and `play` board branches in `src/net/leaderboard.ts`, `src/ut/minutes.ts`, the Minutes screen under RANKS, healthy-play settings, Scout Drops, streak slack, Hot Hand, the Perfect Season campaign, objectives that read the match grade, the Career Road and Prestige, the weekly league.
- **Cuts applied** (V2 F.2 ut #8 and the economy decision): navigation motion and the kit pass on the least-visited screens move behind the slice; Development (M4) is deferred; Season Pass v2 stays deferred; Circuit per-win pay, Rivals weekly pay and the weekly-objective chest upgrade are deferred because the accepted economy ceiling is spent on the V2 hook (§7).
- **Task 1 (ut-0) stays first.** Its compat fixtures are committed (`6aad8dd`); the harness, kit and labels are written but uncommitted in the worktree. ut-0 finishes them, adds the V2 tokens and `haptics.ts`.

---

## 1. Goals (what "done" looks like for this team)

1. **The game has a hook you can see.** From the main Home, one gold "Next up" strip above PLAY says the single best thing to do, with a true distance ("3 min to 75 coins + a Scout Stamp", "6 rewards to claim", "1 win to Finalist"). A Minutes ring fills toward the next rung. Every match ends in ≤ 5 s on a gold One-More bar with the next match already chosen. When the day's goals are met, every surface says "Done for today" and stops pushing.
2. **Time played is counted honestly and rewarded** (V2 E): active minutes only, capped at 90 a day and 630 a week, daily, weekly and lifetime ladders sized to the real economy, a weekly league that works with one player, and boards that never write to live services during QA.
3. **Ultimate Team leads players somewhere, everywhere** (audit H4/H5): badges and GO links on every progress surface, a UT Home hub with one hero action, Live Now, Upcoming and near-miss chips.
4. **Solo play is honest and quick** (audit M3/M13 and the exploit): a pre-match screen instead of the online vote, a correct verdict (a soccer draw reads DRAW), player ratings when the engines provide them, and killing the app can no longer replay a Cup, Circuit, Club Season or UT Draft round.
5. **The loop rewards you generously and fairly** (V2 D): three Scout Drops a day with odds shown, a streak with slack, Hot Hand, the Perfect Season run, a Career Road that never resets, Prestige. No real money, no timers on play, no fake near-misses, no guilt copy (V2 D.11 red lines).
6. **Every ut surface looks studio-made** by one measurable checklist (kept from revision 2): hero art ≥ 96 design px; section titles 18–22 px Archivo condensed italic; 8 px grid; ≤ 2 accent colours per card; every target ≥ 44 px; every empty list has icon + line + CTA; exactly one `data-primary` per screen; V2 C.3 tokens (`--bg #071521`, `--panel #0e2233`, `--stroke #1d3a50`, `--teal #4fe3c1`, `--gold #f6b93b`, `--violet #8b7cf6`, `--red #ff5d5d`, `--text #f2f7fa`, `--dim #8aa3b5`); UI motion 120–180 ms ease-out; reduced motion keeps colour and sound and drops movement.

**Hard constraints in every task:**
- **Saves.** Never reset or change the meaning of saves, storage keys, card/edition/copy ids or claim ids. New state is additive with defaults; §2 says where it goes. Every task that adds saved state runs the old-save fixtures and the mixed-client round trip.
- **Coins only.** No purchases, ads or anything that buys time.
- **Live services.** QA always opens `?ns=inspect&relay=ws://localhost:7777` and route-aborts every host that is not localhost/127.0.0.1 (Google Fonts excepted). Board code is exercised only against the local relay at `ws://localhost:7777`.
- **Protocol lines.** Never edit `DRAFT_RULES` or `UT_RULES`. Anything that would change a match outcome is written as "Protocol bump needed" instead (§9).
- **Determinism.** Seeded RNG only inside simulation code. `playtime.ts` uses `performance.now()` deltas and the ET day key; it is not simulation code and never runs on the per-frame path.
- **Sport branches.** `pick({ nba, nfl, soccer })` / `pickFor`, never a two-way ternary.
- **Layout.** 390 design frame, no width media queries, taps ≥ 44, text ≥ 10, reduced motion respected, SVG symbols.
- **Process.** Heavy commands through `bash O/heavy.sh`; never `pkill -f`/`pgrep -f`; never `git add -A`; never push `main`, force-push, rebase or bare `git stash`. No model names, secrets or emails in code or commits.

---

## 2. Saved state: where new state goes (applies to every task)

**What an old client drops.** `acdf3e2`'s `migrateUt`, `normalizeHQ` and `totals()` are whitelists, so a not-yet-updated phone strips unknown `ut` fields, and cloud save carries whole storage keys back. Profile-level fields behave differently: `loadFrom` spreads `...p`, and the NFL/soccer save path writes the shared part as `{ ...base, ...pick(p, SHARED) }`, so an unknown top-level profile field in the basketball key survives an old client. The round trip proves this per field before any reward depends on it.

| Kind | Where | If an old client strips it |
|---|---|---|
| UT claim receipts (Scout Drops, Rookie Week steps, Perfect Season milestones and Mulligans, auto-finish quota, Career Road packs) | strings in `ut.hq.claims` | kept verbatim, so nothing pays twice |
| UT per-day counters (skill, PERFECT, ON FIRE, Perfect Season results) | `ut.hq.journal` entries `x:<day>:<counter>:<n>:<matchId>` written in the same update as `recordMatchProgress` | kept; never new `COUNTERS` keys |
| Switch-over stamps `studio:since:<day>`, `pid:<12 base36>` | `ut.hq.claims` | kept, never move |
| UI caches `hq.poolClaimables`, `hq.seen` | additive optional `hq` fields | lost harmlessly, rebuilt on the next UT open |
| Live-match marker `ut.live` | additive optional field | that client lacks the protection; `ut.settled` still blocks double settlement |
| **MINUTES ledger** `profile.playtime` (V2 E.3 shape, below) | new optional field in the cross-sport `SHARED` list of `src/lib/profile.ts` (V2 grant) | survives old clients (spread), proven by test; rung claims live in `playtime.claimed`, so a strip would be caught by the test before shipping |
| **Cross-sport hook state** (Scout Drop count of the day, Hot Hand step, Career Road claims and the Road start level) | `profile.career?` in `SHARED`. **Lead OK needed** (one entry in `SHARED`, outside the playtime grant). Fallback without the OK: the same object nested as `profile.playtime.hook`, which is inside the granted field and uses the same merge rule | as above |
| Streak slack (`shield`, `off`, `repairBy`, `shieldWeek`) | additive fields on the existing shared `profile.streak` object; written by ut-owned `engine/missions.ts` | an old client's `nextStreak` rebuilds `{count,last,best}`; worst case the week's free shield is offered again (bounded: 1 a week), documented |
| Settings `hideBoards`, `breakReminder` | additive fields on `profile.settings` (shared; spread with defaults) | default restored (break reminder on, boards shown) |
| Device-only data | `perfect-season:ut-device:v1`, `perfect-season:ut-live:v1` (score snapshot on hide), `perfect-season:playtime-lock:v1` (single-tab lock), `perfect-season:playtime-pending:v1` (provisional seconds of the activity in progress) | never cloud-synced |

**The V2 E.3 ledger, as implemented** (`src/lib/playtime.ts` exports the type; `profile.ts` adds `playtime?: Playtime` and the `SHARED` entry):

```ts
export interface Playtime {
  v: 1;
  life: number; rawLife: number;            // counted / raw seconds, lifetime
  day: string; daySec: number; dayMenuSec: number; rawDaySec: number; // ET day key; daySec ≤ 5400
  week: string; weekDays: number[];          // weekKey(); 7 × counted seconds, each ≤ 5400
  bySport: { nba: number; nfl: number; soccer: number };
  acts: number; weekActs: number[];          // completed matches/runs, lifetime and per weekday
  claimed: { day: number[]; week: number[]; life: number[]; dayKey?: string; weekKey?: string };
  league: { tier: number; season: string; best: number; lastWeek?: { week: string; rank: number; am: number; moved: -1 | 0 | 1 } };
  restedDay?: string;                        // the ET day a rested bonus applied (once)
  frozenDay?: string;                        // clock went backwards: accrual frozen for this day
}
```

**Cloud merge (V2 grant on `src/lib/cloud*`).** Cloud save is whole-key snapshots with revision/conflict handling. Where a snapshot is applied over a device save, a new pure `mergePlaytime(device, server)` runs first on the basketball profile key: per field max for seconds and counts (per day and weekday index when the keys match), union for `claimed` index lists, the newer `league` by week. So two phones can neither double-claim nor lose minutes, and a relaunch cannot reset a cap. Nothing else in the snapshot changes.

**Switch-over without release dates (kept).** The first UT open of the new build writes `studio:since:<ET day>` once per sport profile. Daily objectives v2 start the day after it. The Career Road pays only for levels gained after the build first runs (`career.roadFrom = current level`), so no one is paid retroactively for past levels.

**Proof in every task that adds saved state** (ut-1, ut-2, ut-6, ut-7, ut-8):
- the `acdf3e2` old-save fixtures (3 sports) load with every coin, card, level, XP, squad, streak, receipt and season intact (`studio-compat.test.ts`, committed);
- `scripts/compat/old-client.ts` (new → `acdf3e2` → new) loses no receipt and makes nothing claimable twice; from ut-2 on it also round-trips the **profile** keys (`playtime`, `career`, `streak`, `settings`) and the cloud snapshot.

---

## 3. V2 shared pieces: what ut writes and what ut consumes (interface contracts)

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
- It wraps the existing `vibrate`/`tapHaptic` in `src/lib/sound.ts` (unchanged), adds a gesture gate (as built: a trusted input event in `window.event`; without `window.event`, `navigator.userActivation.isActive` plus an input in the last 800 ms, inside sound.ts's 900 ms window; buttons call it from `onClick`, never `onPointerDown`, so a scroll never buzzes; the published contract is W2 in `ut.md`), and drops calls fired from timers, because iOS replays a queued vibrate on the next unrelated tap. Patterns: tick 8 ms; double 12-40-12; long 30. nba/nfl/soccer call `haptic()` from their input handlers; the PERFECT chime stays soccer's `sound.ts` wiring (V2 F.1).

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

## 4. Scope map

| Source item | Task | Notes |
|---|---|---|
| **V2 F.2 ut #3** MINUTES: ladders, claims, rested bonus, league maths, ring chip, Minutes screen; playtime ticker, haptics, settings (decisions) | ut-2 (engine, ledger, cloud), ut-3 (UI, healthy play), ut-8 (league and boards) | slice item 8 |
| **V2 F.2 ut #1** `nextBestAction` with the D.5 list, exported; "Next up" strip above PLAY | ut-1 (engine), ut-4 (surfaces) | slice item 8 |
| **V2 F.2 ut #2** D.1 sequence ending in the One-More bar; grade, PERFECTS, Minutes in the tally | ut-5 | slice item 8 |
| **V2 F.2 ut #4** coin-flow table with every D.16 row | ut-2 (Minutes constants test), ut-7 (`scripts/ut_coinflow.ts`), ut-9 re-run | decision 1: ACCEPT (§7) |
| **V2 F.2 ut #5** Scout Drop 1 of 3; streak slack; Hot Hand | ut-7 | second wave |
| **V2 F.2 ut 5b** objectives reading grade, PERFECT and Heat; Perfect Season campaign + Mulligan | ut-7 | second wave |
| **V2 F.2 ut #6** Career Road, Prestige; session-end summary; playtime panel; board opt-out; `setAppBadge` | ut-8 (Road, Prestige), ut-4 (summary, badge), ut-3 (panel, opt-out) | |
| **V2 F.2 ut 6b** card mastery, Touch rating, Nemesis | Nemesis: ut-6. Touch rating, mastery: buffer B2, B3 | needs C1 `chances` and per-player PERFECT counts |
| **V2 F.2 ut #7** Daily Play host and board | `play` board branch: ut-8. Host: buffer B1 | waits on each sport's P1 scenarios (C8) |
| **V2 F.2 ut #8** cuts | §8 | |
| V2 D.11 healthy play: Done for today (3 caps), break reminder, playtime panel, opt-out, rested bonus | ut-3, ut-4 | |
| V2 D.15 first five minutes, Rookie Week | ut-4 (first-run sheet), ut-7 (Rookie Week deck) | replaces revision 2's starter chain |
| Audit H4 bridge (badge + Home) | ut-4 | the "Next up" strip replaces revision 2's Home pill |
| Audit H5 GO links | ut-1 (Objectives, Daily), ut-4 (Missions, Gauntlet, Results, Profile, Season card), ut-8 (Sets, Evolutions) | |
| Audit H6 labels | ut-0 | names never change (decision 1) |
| Audit M3 result (DRAW, ratings, MOTM, animated progress) | ut-5 | |
| Audit M13 solo vote screen; mid-match kill exploit | ut-6 | |
| Audit M7 first run | ut-4 | |
| Audit M10 Season Pass hero | ut-4 (hub Season card with the top reward and "N levels to …") | v2 scheme deferred |
| Audit M5/M12 Collection and Sets | ut-8 (with V2 D.7 era pages) | M4 Development deferred |
| Audit L1 badge contrast; L2 tiny text; L3, L4, L9 | ut-4 (L1), ut-7 (L2 calendar labels), ut-9 (L3/L4/L9 walk fixes) | |

---

## 5. Tasks (ordered)

**Common to every task:**
- **Before numbers and shots** with `scripts/qa/ut-studio.mjs` into `O/shots/ut/<task>/<sport>-<w>x<h>-<name>.png`, at 393×852 (insets 59/34), 375×667 (20/0) and 320×568, touch, `deviceScaleFactor: 1`, `--edge` (shell's Fix A injected). Look at every image yourself.
- **Dev server:** `nohup npx vite --port 5212 --strictPort > /tmp/ps-ut-vite.log 2>&1 & echo $! > /tmp/ps-ut-vite.pid`; stop with `kill $(cat /tmp/ps-ut-vite.pid)`.
- **Tests through the semaphore:** `bash O/heavy.sh npm run typecheck`; `bash O/heavy.sh npx vitest run <files>`; `PS_SPORT=nfl bash O/heavy.sh npx vitest run <files>`; soccer cases in `src/ut/soccer-*.test.ts` via `PS_SPORT=soccer bash O/heavy.sh npx vitest run soccer sport-branches`.
- **Commit** at each split point with explicit paths, "Claude: …" and the BUILD-RULES trailer; push `claude/studio-ut` (retry 2/4/8/16 s). Update `ut.md`.

---

### ut-0 · P0 enabler · finish the foundation: harness, compat, kit with V2 tokens, labels, haptics  *(in progress)*

**State at the pause.** Committed: old-save fixtures, `studio-compat` tests and the mixed-client round trip (`6aad8dd`). Written, uncommitted: `scripts/qa/ut-studio.mjs`, `scripts/qa/ut-fixtures.mjs`, `src/ut/kit.tsx`, `src/ut/ut-system.css`, `src/ut/labels.ts` and their tests, and the label routing in `nav.ts`, `play-status.ts`, `Match.tsx`.

**Changes**
- **Harness** (as revision 2): cases `selfcheck, walk, bridge, firstrun, hub, prematch, interrupt, recap, objectives, minutes, nextup, pages`; flags `--edge --cpu 4 --rm --clock`; per-screen metrics (overflow, clipping, targets < 44 incl. `::before`, text < 10, sampled contrast, topmost control ≥ sat + edge, page errors, long tasks, `data-primary` count, tap-feedback latency); the dead-tap detector with its denylist and a fresh context per screen. **V2 additions:** a `--relay` guard that fails the run if any WebSocket opens to a host other than `localhost:7777`; fixtures for Minutes (0, 27, 58, 89, 90+ min today; 161 and 600 min this week; a rested return; a frozen clock day) and a profile with `playtime` absent.
- **Kit with the V2 C.3 tokens.** `ut-system.css` defines `--ps-bg/panel/stroke/teal/gold/violet/red/text/dim` scoped to `.ut-app` and the new main-app surfaces (`.ps-v2`), mapped onto the existing teal/gold so nothing outside these roots changes. Motion tokens 120–180 ms (push 180, pop 140, tab 120, sheet 180), 0 under reduced motion. Components kept: `SectionTitle`, `RewardChip`, `GoChip`, `ClaimButton`, `PrimaryButton` (≥ 56 px, `data-primary`), `Countdown` (amber < 24 h), `ProgressRing`, `EmptyState`. **New:** `MinutesRing` (ring + "23 / 30 min" + reward line) and `GoldBar` (the One-More / Next-up gold strip: eyebrow, title, stake line, chevron).
- **`src/lib/haptics.ts`** (contract W2). `ClaimButton` switches from `tapHaptic` to `haptic('tick')`, and to `haptic('long')` on a claim that grants a pack.
- **Labels** unchanged in wording; adds "Minutes", "Active Minutes", "Next up", "Done for today", "Scout Drop", "Hot Hand", "Perfect Season", "Career Road", "Prestige" as constants (new names, not renames).
- **`docs/studio-overhaul/ut.md`** with all its sections, the contracts of §3 and the lead decisions of §11.

**Tests:** `labels.test.ts` (snapshot of every label; nav titles equal constants; the banned-term regex); `kit.test.tsx` (`Countdown`, `EmptyState` requires a CTA, `ClaimButton` haptic only from the pointer handler); `haptics.test.ts` (no vibrate outside a gesture window; patterns; settings off → no call); compat tests in 3 sports (already green).

**Acceptance**
- `ut-studio.mjs selfcheck` writes the before-baseline (`O/shots/ut/ut-0/report.json`) for Home, Ranks, Profile, UT Home, Play, Squad, Club (4), Challenges (3), Store and Inbox × 3 sports × 3 sizes with every metric, and 0 sockets to non-local hosts.
- Fixtures load in 3 sports with 0 page errors; the round trip loses nothing.
- Kit CSS ≤ 5 KB gzip; under `--rm` the kit's burst, sheen and ring fill compute `animation-name: none`.
- `haptics.test.ts`: 0 `navigator.vibrate` calls from timers across 100 simulated timer callbacks.
- Typecheck clean; labels, kit, haptics and compat tests green in NBA, NFL and soccer.

**Files:** `scripts/qa/ut-studio.mjs`, `scripts/qa/ut-fixtures.mjs`, `scripts/qa/fixtures/ut/*.json`, `src/ut/kit.tsx`, `src/ut/ut-system.css`, `src/ut/kit.test.tsx`, `src/ut/labels.ts`, `src/ut/labels.test.ts`, `src/lib/haptics.ts`, `src/lib/haptics.test.ts`, `src/ut/nav.ts`, `src/ut/play-status.ts`, `src/ut/Match.tsx` (string constants only), `docs/studio-overhaul/ut.md`.
**Commit split:** (1) harness and fixtures; (2) kit, tokens, labels; (3) haptics and ut.md. **Protocol:** none. **Depends on:** nothing.

---

### ut-1 · P0 · Progress core and the next-best-action engine (light)

**Why.** Every slice surface (Home strip, Minutes chip, One-More bar, hub hero, badge) reads one light engine. It must not pull `pool`, `packs`, `cards`, `sbc`, `rate` or `squad` into the first-paint chunk.

**Changes**
- **As revision 2 ut-1:** `src/ut/objectives.ts` (the move of `Reward`, `Objective`, `DAILY`, `WEEKLY`, `objectiveDeck`, `seasonFor`, `SEASON_TIERS`, `readyRewards`, `DEVELOPMENT_PATHS`… with re-exports, no behaviour change); `src/ut/claimables.ts` `utClaimables(ut, day, week, sport, now)` equal to the inbox count, with the local re-implementations and the `hq.poolClaimables` cold-start cache; `src/ut/packs-claimables.ts` stub (packs owns the body); `src/ut/seen.ts` (`hq.seen`); `src/ut/stamps.ts` (`studio:since`, `pid`); `src/ut/go.ts` (`GoTarget`, the ethics rule: SBC → Scout Market → pick before Store, odds chip when the Store is the only route; `openUtAt`); `clubStatsOf` for players' card back; GO chips on Objectives and Daily.
- **`src/ut/next-action.ts`** (contract W6) as a pure function over a `NextCtx` built by `nextCtxOf(profile, sport, now, extras)`. Slots that later tasks fill return null now: Minutes rung (ut-2), streak at risk (existing Daily Drop rule now, D.13 in ut-7), Career Road level (ut-8), league line (ut-8), Daily Play (B1). The `after` mode (One-More) is included with its D.10 rules and fed by ut-5.
- **`src/ut/near-miss.ts`:** ≤ 3 true, deterministic distance chips with a `GoTarget` ("1 card away", "1 win to Finalist", "2 wins to Pro", "1 game to today's bonus", "120 SP to level 7", "3 min to 75 coins + a stamp" once ut-2 lands).

**Tests:** revision 2's `objectives`, `claimables`, `claimables-graph`, `claimables-reimpl`, `seen`, `stamps`, `go`/`soccer-go`, `soccer-claimables`; **new** `next-action.test.ts`: ≥ 16 cases (one per priority level, each `after` rule, recency tie-break, never "Done for today" while anything is claimable); the graph test extended to `next-action.ts` and `near-miss.ts`.

**Acceptance**
- The import graph from `claimables`, `go`, `stamps`, `next-action`, `near-miss` and `packs-claimables` reaches none of `pool, packs, cards, sbc, rate, squad, content-packs, daily-hub, moments, inbox`.
- Claimables equal the inbox count in 100% of ≥ 10 fixtures × 3 sports (valid cache); cold start gives `approx` and the light count.
- `nextUp` ≤ 2 ms in node for a large fixture (3,000 owned, 5,000 claims); `utClaimables` ≤ 2 ms.
- 0 disabled-only "IN PROGRESS" chips on Objectives and Daily in 3 sports.
- No claim id, objective id or reward amount changes (snapshot). Old-save fixtures and the round trip green.

**Files:** `src/ut/objectives.ts`, `claimables.ts`, `packs-claimables.ts`, `seen.ts`, `stamps.ts`, `go.ts`, `next-action.ts`, `near-miss.ts` (new); `progression.ts`, `club-management.ts`, `hq-state.ts`, `nav.ts`, `Clubhouse.tsx` (ObjectivesView), `DailyHubView.tsx`, `UltimateTeam.tsx`; tests.
**Commit split:** (1) objectives move and claimables; (2) seen, stamps, GO and the two views; (3) next-action and near-miss. **Protocol:** none. **Save-compat:** `hq.poolClaimables`, `hq.seen`, `hq.claims` stamps. **Depends on:** ut-0.

---

### ut-2 · P0 (slice) · MINUTES engine: the ticker, the ledger and the ladders

**Changes**
- **`src/lib/playtime.ts`** (contract W1) with every E.1/E.2/E.8 rule, the single-tab lock, the pending key, banking, the menu 25% rule, caps, ET rollover, clock-tamper freeze, and the zero-writes-during-a-match rule.
- **`src/lib/profile.ts`:** `playtime?` in `SHARED`; `settings.hideBoards?`, `settings.breakReminder?`; the `career?` field only after the lead's OK, else `playtime.hook` (§2). **`src/lib/cloud*`:** `mergePlaytime` in the apply path.
- **`src/ut/minutes.ts`** (contract W5): the E.5 daily ladder (5/15/30/60/90 → 25, 50, 75 + stamp, Silver + 50, 50 + "Done for today"), weekly ladder (60/150/300/450/600 → 150, Silver, Gold, 400, Premium + "Iron Man week"), lifetime milestones (1/5/10/25/50/100/250/500/1,000 h, power stops at 25 h), the rested bonus (first day back after ≥ 3 days away: 5/15/30 rewards doubled once, +60 AM weekly credit once), endowed progress (new players start with 3 of the first 5 minutes), the `lean` table behind `MINUTES_TABLE`, and the pure league maths (divisions, movement, thresholds for < 10 entries, season of 6 weeks, rival = the entry directly above).
- **App wiring:** `registerPlaytimeSink` and the root `usePlaytime('menu')` in `App.tsx`; `usePlaytime('match'|'sim', activity)` and `bankActivity` in `ut/Match.tsx`; the draft play-out host and draft screens in `App.tsx` (listed outside the lane).

**Tests**
- `playtime.test.ts` (fake timers, fake visibility, fake `performance.now`): one test per rule above, plus: two tabs → one counts; a 4 s SIM counts 4 s; Auto-defend with no input stops counting after 45 s; a taped thumb (all events within 8 px) stops the clock; a forfeit at 119 s banks 0 and at 121 s banks; menus capped at 25%; 5,400 s/day and 37,800 s/week caps; a date set back a day freezes accrual; a repeated day key freezes; 0 profile writes during a simulated 5-minute match and exactly 1 at bank.
- `minutes.test.ts`: every rung of the three ladders pays once (claim twice → once); `lean` numbers; rested once per return; endowed 3 min only for a profile with no `playtime` and no games; league movement with 31, 30, 9 and 1 entries; ties by days, then activities, then time.
- `profile-playtime.test.ts`: an old-shape save (the 3 `acdf3e2` fixtures) loads with every field byte-equal and `playtime` undefined → defaults; NFL and soccer save paths keep `playtime` in the basketball key; `mergePlaytime` max/union, and a two-device sequence never double-claims or loses minutes.
- `old-client.ts` extended to the profile keys and the cloud snapshot: `playtime` and `settings` survive new → old → new.

**Acceptance**
- All rules covered by named tests; `playtime.ts` ≤ 3 KB gzip; the ticker's per-second work ≤ 0.2 ms at 4× CPU (performance marks); 0 long tasks > 50 ms caused by it.
- In a Playwright run of a full autoplay UT match: 0 profile writes during play, 1 at the end; counted minutes for the match within ±5% of the active-input time.
- The E.5 totals reproduce: daily 250 coins + Silver + 1 stamp (≈ 450 coin-equivalent), weekly ≈ 2,100 (≈ 300/day), engaged 60-min player ≈ 514/day, maximum ≈ 750/day (asserted in `minutes.test.ts`).
- Old-save fixtures and the extended round trip green in 3 sports.

**Files:** `src/lib/playtime.ts`, `src/lib/playtime.test.ts`, `src/lib/profile.ts`, `src/lib/cloud-sync.ts` or `cloud-data.ts` (merge hook), `src/lib/profile-playtime.test.ts`, `src/ut/minutes.ts`, `src/ut/minutes.test.ts`, `src/ut/Match.tsx` (2 lines), `src/App.tsx` (≤ 6 lines), `scripts/compat/old-client.ts`.
**Commit split:** (1) ticker and tests; (2) profile field, cloud merge, compat; (3) `minutes.ts` and host wiring. **Protocol:** none. **Save-compat:** `profile.playtime`, `profile.settings` fields, device-local keys. **Depends on:** ut-0. **Touched outside my lane:** the `App.tsx` lines.

---

### ut-3 · P0 (slice) · MINUTES on screen and healthy play

**Changes** (visual target: mockups §3 "The Minutes screen" and the chip row)
- **Minutes ring chip** (`MinutesRing`) on the main Home chip row and on UT Home: "23 / 30 min · 75 coins + stamp next"; at 60 "Silver Pack ready"; at 90 "Done for today. Great session." Tap → the Minutes screen. A reached rung shows a gold dot (claimable).
- **Minutes screen** (`src/ui/MinutesView.tsx`, lazy; a RANKS segment "MINUTES" next to the existing boards): Today, This Week and Career rails with the next rung enlarged; CLAIM on reached rungs (`ClaimButton`, haptic `long` on packs); the explainer sheet with V2 E.9.6 wording; "Active play only · resets midnight ET". League tile and board tabs are present but show "Leagues start next week" until ut-8.
- **Profile playtime panel:** today and this week, counted and raw ("You've had the app open 1 h 12 min today"), lifetime hours, split by sport, badge tier. Settings rows: **Session reminder** (break reminder, default on) and **Hide me from leaderboards** (`settings.hideBoards`, honoured by the publish guard in ut-8; until then it is stored and shown).
- **Break reminder:** after 60 continuous active minutes, a one-line sheet at the next stoppage only (UT result, PreMatch, draft Results, menus), never during a match: "Good time for a stretch. Your progress is saved." One tap dismisses; once per 60 minutes.
- **`playtimeLine()`** published for the sports' pause sheets (contract W1).
- **Done for today (Minutes cap):** at 90 counted minutes the chip, Minutes screen and `nextUp` show the calm state with "Matches still pay coins as usual and count for your Career XP".

**Tests:** `minutes-view.test.tsx` (labels per state: 0, 27, 58, 60 ready, 89, 90 done, rested); `break-reminder.test.ts` (fires once after 60 active minutes, never while ctx = match, respects the setting); harness case `minutes` (3 sports × 3 sizes).

**Acceptance**
- Chip on the main Home adds 0 px of scroll at 393×852 (and ≤ before at 375 and 320) with `--edge`; PLAY bar top y unchanged ± 1 px.
- Claim → coins and packs land once (fixtures at 30, 60, 300 weekly); claim feedback ≤ 100 ms; second tap is a no-op.
- The Minutes screen: next rung visible without scrolling at 320×568; 0 targets < 44, 0 text < 10, contrast ≥ 4.5:1 on the rails.
- Break reminder: 0 appearances during a match in a 70-minute fake-clock run; exactly 1 at the next stoppage.
- No copy matches the guilt list (test: "Don't lose", "miss you", "hurry" in ut-owned strings → fail).
- Reduced motion: ring fills show their final value at once.

**Files:** `src/ui/MinutesView.tsx`, `src/ui/minutes.css`, `src/ui/BreakReminder.tsx` (new); `src/ui/Pages.tsx` (Home chip row hunk; Profile panel; RanksPage segment, ≤ 6 lines, outside the lane), `src/ut/Hub.tsx` (chip only), `src/App.tsx` (reminder mount, settings rows); tests; harness case.
**Commit split:** (1) chip and Minutes screen; (2) Profile panel, settings, break reminder. **Protocol:** none. **Depends on:** ut-2. **Touched outside my lane:** the RanksPage segment hunk; the settings rows if Settings is not in ut's grant.

---

### ut-4 · P0 (slice) · Next best action everywhere: Home strip, badges, first run and the UT Hub

**Changes** (visual target: mockups §3 "Home with Next up" and "Ultimate Team hub hero")
- **Main Home "Next up" strip** directly above PLAY (`GoldBar`): eyebrow NEXT UP, one line, GO. One tap goes to the target (`openUtAt`, a draft mode, the Minutes screen). The four mode tiles keep their names and order. The strip takes the tagline's line so Home gains no height; when a layout effect measures too little room, it collapses to a 44 px one-line chip. The engine is loaded by a dynamic import after first paint (`requestIdleCallback`, 1 s fallback), memoised per profile, day and minute, and resolved before the splash lifts where shell's launch continuity allows (V2 F.2 shell #5).
- **Perfect Season line** slot in the chip row ("PERFECT SEASON · 11–0"), filled by ut-7.
- **UT tab badge** (`#c62828`, white 11 px bold, ≈ 5.6:1; amber clock when the streak is at risk) and `.ut-dot` in `nav.css` (L1). **`navigator.setAppBadge(count)`** where available, `clearAppBadge()` at 0, in try/catch; the app never asks for notification permission (decision 7: no push sender).
- **GO links in the main app (H5):** Missions sheet (`go: 'any' | 'daily' | 'blind' | '1v1'`), Gauntlet sheet ("CLIMB WITH YOUR <TEAM>" / "PLAY A DRAFT"), draft Results bridge row ("6 rewards waiting in Ultimate Team ›"), Profile UT card and the new-drafter state. Difficulty pills ≥ 10 px (L2).
- **First run (M7, V2 D.15):** one welcoming sheet instead of two stacked modals (tester gift + Day 1 chest with COLLECT ALL, ids unchanged), then "OPEN YOUR FREE STARTER PACK" → UT Home. `firstRunPlan(profile)` decides.
- **UT Hub rebuild** (`Hub.tsx`, `hub.css`, kit): the **hero** is `nextUp` (eyebrow NEXT BEST ACTION, Archivo italic title, one line, one `PrimaryButton`, art ≥ 96 px); near-miss chips; the Minutes chip; **Live Now** carousel (scroll-snap, `Countdown`, amber < 24 h, "new" dots, `promo-hub` seam); a **Season card** (top reward art from day 1, "N levels to <named reward>", countdown, GO → PLAY; M10 within the v1 scheme); today's objectives card (2/3 with ticks); Upcoming strip; Daily and Standouts tiles, squad fan and Club Records kept; **Done for today** state when dailies, Daily Drop, calendar and Minutes 90 are done and nothing is claimable, with tomorrow's teaser and a quiet "Keep playing". `SeasonBanner` stops rendering here (shell told: `.ut-season-chip` is dead).
- **Modal queue** (`ut-modal-queue.ts`): interrupted-match sheet → packs' launch takeover → New Era bundle, one at a time.
- **Session-end summary on EXIT** (replaces revision 2's teaser toast): two lines, non-blocking, after the view has changed: what you earned this session (coins, packs, minutes) and what waits tomorrow ("Daily Drop Day 3 of 7 · 3 Scout Drops").

**Tests:** `missions.test.ts` (every mission's `go` exists); `first-run.test.ts` (sheet plan; ids unchanged; exactly once); `hub-feed.test.ts` (countdowns across ET midnight and DST; amber at 23:59 vs 24:01; ≥ 3 live items every day in NBA/NFL, ≥ 2 soccer; every view exists for that sport); `modal-queue.test.ts`; `soccer-hub.test.ts` (never routes to hidden soccer modes); `session-summary.test.ts`; harness cases `nextup`, `bridge`, `firstrun`, `hub`.

**Acceptance**
- **Home:** the strip is fully visible above PLAY with no added scroll at 393×852 (0 px where it was 0), ≤ before at 375 and 320, in 3 sports, with `--edge`; tap feedback ≤ 100 ms; the target screen visible ≤ 2.5 s after the tap at 4× CPU (re-measured at integration with shell's loading work); the dynamic import + compute ≤ 10 ms at 4× CPU after first paint; entry chunk growth ≤ 2 KB gzip (measured in ut-9).
- **Badges:** contrast ≥ 4.5:1 measured; main badge = UT HOME count in 100% of fixtures × 3 sports.
- **The strip's line is true:** for each of ≥ 12 fixtures, the distance it states equals the engine's computed distance, and tapping lands on a screen where that action is available (Playwright).
- **First run:** stacked modals 2 → 1; COLLECT ALL 1 tap; coins rise by gift + chest; the starter CTA lands on UT Home.
- **Hub:** hero CTA above the tab bar at 320×568 in 3 sports; exactly 1 `data-primary`; Done for today in 100% of all-done fixtures and 0% when anything is claimable; Hub derivations ≤ 30 ms at 4× CPU; 0 dead taps on chips, cards and rows.
- 0 overflow, clipped, < 44 or < 10 px on every changed surface at 3 sizes; reduced motion: no running animations.

**Files:** `src/ui/NextUpStrip.tsx`, `src/ui/next-up.css`, `src/ut/hub-feed.ts`, `src/ut/ut-modal-queue.ts`, `src/ut/session-summary.ts`, `src/ut/hub.css` (new); `src/App.tsx` (badge, first-run order), `src/ui/Pages.tsx` (strip, Profile UT card), `src/ui/Rewards.tsx`, `src/ui/Welcome.tsx`, `src/ui/Results.tsx`, `src/ui/Gauntlet.tsx`, `src/engine/missions.ts`, `src/ut/Hub.tsx`, `src/ut/UltimateTeam.tsx`, `src/ut/nav.css`; tests; harness cases.
**Commit split:** (1) Home strip, badges, `setAppBadge`; (2) Missions/Gauntlet/Results/Profile GO and first run; (3) Hub, modal queue, session summary. **Protocol:** none. **Depends on:** ut-1, ut-3; packs (C6) at merge.

---

### ut-5 · P0 (slice) · The 5-second end of match and the One-More bar (M3, V2 D.1)

**Changes** (visual target: mockups §3 "Post-match, 5 seconds")
- **Recap data** `src/ut/match-recap.ts`: coins, Career XP (account XP), card XP and level-ups, objectives that moved, SP bar, Rivals RP and division, **Active Minutes "+4 min, now 27" and the next rung**, milestones, the grade (C1) and the box (C2). Slots for the Scout Drop reveal (ut-7) and the league position change (ut-8).
- **Verdict** `verdictOf(out, sport)`: `WIN · OT`/`LOSS · OT` (from `Progress.ot` or the end count), `WIN · PENS`/`LOSS · PENS`, `DRAW` (soccer) or `TIE` only for a level score; the squad-rating tiebreak line only for a safety cap. The dormant soccer three-way `draw` settlement branch with tests (contract kept from revision 2).
- **Player ratings and MOTM** (`match-box.ts`, `match-ratings.ts`), hidden when there is no box. Nothing is invented.
- **The sequence** (`MatchRecap.tsx`, `match-recap.css`), V2 D.1 timing: 0–2.5 s **result slam** (WIN/LOSS/DRAW, score count-up, opponent, GRADE letter, PERFECTS, BEST HEAT tiles, FLAWLESS tag, MOTM card); 2.5–5.0 s **tally** (all bars count up together with a rising-pitch tick; completions pop; one CLAIM ALL; a loss still shows what moved); at 5.0 s the **One-More bar** (`GoldBar`, "NEXT UP · LOADED", the stake line, e.g. "PLAY '86 BOSTON › Rung 5 of 8 · 1 win to a Gold Pack") from `nextUp({ …, after })`. Secondary: BOX SCORE (the existing `MatchDebrief` behind it) and HOME. Tap anywhere skips to the final state. The bar never auto-starts and has no countdown. Online H2H keeps its rules; the bar there offers REMATCH-queue or HOME.
- **One-More launches the next match directly** (no PreMatch: the stake was shown on the bar; defense preference unchanged). With C4 the arena stays mounted and is re-seeded; without it the existing path is used.
- **Career XP** for UT matches: played +20 (+10 win), sim +5, within the 8 paid games; level coins once per level as today (`LEVEL_UP_COINS`); the level-up beat inside the tally.
- **Haptics:** timer-driven beats use sound only; `haptic('long')` only from the CLAIM ALL tap.
- **`stripLocal`** drops `box` and `grade` before `conn.update`.
- **Leaving instead** shows the session summary (ut-4).

**Tests:** `match-recap.test.ts` (SP crossing a level; an objective completing; a card levelling; capped day "Today's 8 paid games are played"; Circuit milestone; Rivals promotion; account level-up once; Minutes +N and the next rung; grade absent → line hidden); `verdict.test.ts`; `soccer-recap.test.ts` (2–2 reads DRAW, pens, never WIN for a level score); `match-ratings.test.ts`; `end-codes.test.ts` (pins every code per sport incl. `FF`, `TD6`, `TD8`, OT drives); `one-more.test.ts` (each D.10 `after` rule picks the right target; never auto-starts); `strip-local.test.ts`.

**Acceptance**
- Result mount → One-More bar visible ≤ 5.0 s; tap-to-skip ≤ 100 ms; reduced motion: final state ≤ 100 ms.
- **The bar's tap area covers the A-button centre** (V2 A.5: (323, 738) at 393×852 and (266, 510) at 320×568), is ≥ 64 px tall and exactly the one `data-primary`.
- **One-More → next match:** tap → first game frame ≤ 3.0 s at 1× on ut's branch (chunks warm); final whistle → next tip-off ≤ 10 s with one thumb measured at integration with C4 (§10).
- Count-ups ≥ 55 fps at 4× CPU, no long task > 50 ms; 0 `vibrate` calls outside pointer handlers (spy over a full sequence).
- Soccer 2–2 reads DRAW (before: WIN, `match-soccer-393-04-result.png`).
- The stake line is true: in ≥ 10 fixtures the stated reward is exactly what the next win pays.
- 0 overflow, clipped or small targets at 3 sizes; `MatchDebrief` renders with the same metrics.

**Files:** `src/ut/match-recap.ts`, `match-box.ts`, `match-ratings.ts`, `MatchRecap.tsx`, `match-recap.css` (new); `src/ut/Match.tsx` (`finish`, `Outcome`, `ResultView`, one hook block), `src/ut/play.ts` (optional `ends`/`box`/`grade` inputs, the draw branch, Career XP), `src/ut/MatchDebrief.tsx`; tests.
**Commit split:** (1) recap logic, verdict, ratings; (2) sequence UI and One-More. **Protocol:** none (presentation of settled data; §9). **Depends on:** ut-1 (engine), ut-2 (minutes); C1, C2, C4 at merge.

---

### ut-6 · P0 (audit) · Solo match flow: PreMatch, interrupted matches, Nemesis

**Changes** (as revision 2 ut-4, with V2 adjustments)
- **PreMatch (M13; decisions 2–3)** for every `online === null` setup entered from a menu (Squad Battles, Events, Circuit, Club Season, Cups, UT Draft, the Rivals AI stand-in): matchup with both `SideCard`s; label · difficulty · stage; "About 5 min · you defend their possessions" (or "About 3 min" with Auto-defend); the Defense control from `defense-pref.ts` (hidden until registered); **On offer** (coins or "Today's 8 paid games are played", rung pack, Circuit milestone, Cup prize, SP played vs sim, **Active Minutes still to the next rung**); up to 3 objective chips the match can move (including PERFECT/ON FIRE objectives from ut-7 when present); PLAY (56 px, "LOADING ARENA…" within 100 ms, `curtain: 'compact'`) and SIM (hidden for Circuit, Club Season, Cups). No timer. Online keeps `vs → Vote`.
- **`how` rule** (`match-how.ts`): only the human's offensive possessions decide played vs sim; Auto-defend and defensive SIM never count.
- **Interrupted matches** (`live-match.ts`): `ut.live` marker at kickoff and at the first ended possession (≤ 2 profile writes during play); a device-local score snapshot on hide/pagehide (≤ 1 ms); on relaunch: another device's fresh marker is left alone; stale → cleared; not started → cleared and replayable; otherwise **auto-finish by seeded simulation** of the remaining possessions (`simRest`, seed `'resume:' + id`, human side −0.15) settled with `finish: 'auto'`; max 2 a week (`auto:<isoWeek>:<id>`), then a forfeit (0 coins/XP/SP, `ff: true`). The sheet explains exactly what happened. A crash in any menu writes no marker. Confirmed solo quit (C3) takes the forfeit path for the four kinds. **Playtime:** an interrupted match banks its minutes only under the E.1 forfeit rule (≥ 2 min).
- **Nemesis line (V2 D.8)** from `profile.vs`: "You're 2–3 vs KOBE4EVER" on the online VS/Vote screen and on PreMatch for the Rivals stand-in; nothing when there is no record.

**Tests:** `prematch.test.ts`; `match-how.test.ts`; `live-match.test.ts` and `soccer-live-match.test.ts` (the 10 cases of revision 2: settle once per kind, not-started, stale, other device < 30 min / ≥ 30 min, third interruption → forfeit, snapshot preferred, no marker for Battles/Events/online, old save loads and malformed `live` is dropped, round trip, `simRest` deterministic per seed); `nemesis.test.ts`.

**Acceptance**
- Vote screen on solo games: before ≈ 13 s with a countdown (`vote.mjs`), after 0 s.
- PreMatch interactive ≤ 300 ms; PLAY and SIM visible without scrolling at 3 sizes; PLAY feedback ≤ 100 ms.
- ≤ 2 profile writes per match during play, each ≤ 8 ms at 4× CPU; 0 long tasks > 50 ms from saves in a full autoplay match; hide snapshot ≤ 1 ms.
- `ut-studio.mjs interrupt` (NBA and soccer): before, the same Cup round shows PLAY after a reload; after, the sheet shows, the round settles once and coins follow the auto-finish rule.
- 0 overflow, clipped or small targets on PreMatch at 3 sizes.

**Files:** `src/ut/PreMatch.tsx`, `prematch.css`, `match-how.ts`, `defense-pref.ts`, `live-match.ts`, `nemesis.ts` (new); `src/ut/Match.tsx` (stage hunk, same hook block as ut-5), `state.ts`, `play.ts`, `hq-state.ts`, `Clubhouse.tsx` (ClubRecords AUTO/FF chips), `UltimateTeam.tsx`; tests.
**Commit split:** (1) PreMatch, `how`, Nemesis; (2) marker, auto-finish and the sheet. **Protocol:** none while §9 holds. **Save-compat:** `ut.live`, the device-local keys, `hq.claims` quota strings. **Depends on:** ut-4 (modal queue), ut-5 (`Match.tsx` block back to back); C3, C5, C7 at merge.

---

### ut-7 · P1 (second wave) · The daily loop: Scout Drops, streak slack, Hot Hand, grade objectives, Perfect Season, Rookie Week, the coin-flow table

**Changes**
- **Scout Drops (V2 D.12)** `src/ut/scout-drops.ts`, `ScoutDrop.tsx`: the first 3 wins each day in any UT mode or sport, plus draft head-to-head and Gauntlet wins (Results/Gauntlet hooks, ut-owned), each grant a Drop. **Drop 1 is revision 2's Scout Reveal** (claim `daily-bonus:<day>`, pack id `daily-bonus:<sport>:<day>`, so it cannot double-pay with the old daily bonus), and it starts one drop tier higher than Drops 2 and 3 (Rare, not Common). Its contents keep revision 2's sizing so the economy row stays ≈ 439: Silver Pack + 100 coins, three taps each with a shown chance to upgrade (→ Gold 35%, → Premium 25%, → Jumbo 15%; final odds 65.0 / 26.25 / 7.44 / 1.31%), switched to packs' published tier table at merge (C6). Drops 2 and 3: 20–60 coins, Career XP or a Scout Stamp, EV ≈ 40 coins each, odds shown. Seed `hashString('scout-drop:' + pid + ':' + day + ':' + n)`; a reload cannot reroll; reveal cues never tease a tier that was not rolled. Count of the day in `career` (cross-sport); receipts `drop:<day>:<n>` in `hq.claims`. The tally (ut-5 slot) reveals a drop earned by that win.
- **Streak with slack (V2 D.13)** in `engine/missions.ts` and `src/ut/streak.ts`: one finished match, draft or Daily Play keeps the shared streak; one free Shield a week (hold ≤ 2); a Weekend Off toggle; a free Repair within 48 h by playing 3 matches; milestone celebrations at 3/7/14/30/50/100/365 days (a cosmetic and a small pack). The same Shield bridges the UT Daily Drop streak (revision 2's design, packs' `grace` option at merge). **No wager** (decision 8).
- **Hot Hand (V2 D.14)** inside `settle`'s caller: consecutive wins in any UT mode +10% / +20% / +25% match coins at 2 / 3 / 5+, inside the 8 paid games only; a loss drops one step; a flame chip on PreMatch and in the tally; ball-trail cosmetic left as a request to the sport teams (render-only, not built here).
- **Objectives that read the grade (V2 F.2 ut 5b)** in `objectives.ts` v2 dailies (from the day after the stamp; legacy days keep legacy defs and ids): play 2; a skill objective by day hash from {score N (threes/TDs/goals, box first, end codes as fallback), **N PERFECT releases** (`grade.perfects`), **reach ON FIRE once** (`grade.onFire`), **an A grade or better**}; a club task (open a pack / complete an SBC / win a match). Rewards unchanged (75/75/50 coins, 70/90/90 SP). Counters via `hq.journal` (`x:<day>:perfects|onfire|grade:<n>:<matchId>`). Grade-based objectives are offered only when the match engine supplies `grade` (feature-detected from the last 3 matches); otherwise the score objective is used. Weekly objectives keep the legacy definitions (chest upgrade deferred, §7).
- **Perfect Season campaign (V2 D.4)** `src/ut/perfect-season.ts`: per Season Pass season, the run across Squad Battles, Cups and Club Season, derived from journal entries `x:<day>:ps:<w|l>:<matchId>` (`hq.history` keeps only 20). Milestones 5–0, 10–0, 16–0, 20–0 pay SP and a nameplate tier once per season (`ps:<season>:<n>` in `hq.claims`); Rookie wins stop counting past 5–0; one Mulligan a week restores a broken run (`psm:<isoWeek>`); the best run is kept. Fills ut-4's Home line and a hub chip.
- **Rookie Week (V2 D.15)** `src/ut/rookie-week.ts`: enrolment `starter:enrolled` (first eligible open, never retroactive), 3 tasks a day for 7 days across modes (first match, open the starter pack, fill the squad, a Squad Battle win, an SBC, a draft, 15 minutes played…), daily rewards sized like revision 2's starter chain (200 coins, Silver, Gold, Premium spread over the week) and the **day-7 Player Pick** (packs' 84+ pick, C6) shown from day 1. It is `nextUp`'s first claimable source while active.
- **Coin-flow table** `scripts/ut_coinflow.ts`: one table, per day and per first/later hour, casual / regular / engaged / maximum, today vs after, every D.16 row and every ut faucet, `MINUTES_TABLE` full and lean, NBA prices with the NFL and soccer factors; written into `ut.md`.
- **L2:** login-calendar day labels ≥ 10 px.

**Tests:** `scout-drops.test.ts` (100,000 seeds → shown odds ± 0.5 points; same seed same result; ≥ 2 outcomes across 100 pids; 3 a day across sports; one deposit each; Drop 1 claim id equals the old daily bonus id); `streak-slack.test.ts` (shield once a week, hold ≤ 2; weekend off; repair within 48 h; one match keeps it; old save loads; old client's `nextStreak` worst case documented); `hot-hand.test.ts` (steps; one-step drop; only paid games; ≤ +25%); `objectives-v2.test.ts` (legacy days unchanged; grade objectives only with grade present; counters once per matchId; survive the round trip); `perfect-season.test.ts` (milestones once per season; Rookie cap; Mulligan once a week; a loss is never a coin loss); `rookie-week.test.ts` (never retroactive; each step once; every GO target exists); `coinflow.test.ts`; `economy.test.ts` passes unedited; `scripts/ut_daily_sim.ts` (1,000 seeded sessions per sport).

**Acceptance**
- Dailies doable: median ≤ 3 matches, ≥ 80% within 3, ≥ 95% within 5 per sport (sim on ut's branch; re-run on merged engines, §10).
- Scout Drop shown odds = simulated odds ± 0.5 points; 0 reveals that show a higher tier than the one rolled (test over 10,000 reveals).
- Economy (§7): the script reproduces V2 D.16/E.5 rows; engaged total ≤ +62% over today with the full table and ≤ +52% with the lean one; every adjacent packs-ladder rung check is handed to packs in `ut.md`.
- Streak: the at-risk warning shows only in the last 4 h; the shield is used ≤ 1 per ISO week.
- CLAIM ALL clears every claimable in 1 tap including drops and Rookie Week steps.
- 0 targets < 44 and 0 text < 10 px on Daily, Objectives, Inbox and the Drop reveal at 3 sizes; reduced motion shows reveal results at once.

**Files:** `src/ut/scout-drops.ts`, `ScoutDrop.tsx`, `scout-drop.css`, `streak.ts`, `hot-hand.ts`, `perfect-season.ts`, `rookie-week.ts`, `objective-targets.ts` (new); `objectives.ts`, `progression.ts`, `play.ts`, `daily-hub.ts`, `inbox.ts`, `InboxView.tsx`, `claimables.ts`, `next-action.ts`, `Clubhouse.tsx` (ObjectivesView), `DailyHubView.tsx`, `UltimateTeam.tsx`, `src/engine/missions.ts`, `src/ui/Results.tsx`, `src/ui/Gauntlet.tsx`; `scripts/ut_coinflow.ts`, `scripts/ut_daily_sim.ts`; tests.
**Commit split:** (1) Scout Drops; (2) streak slack and Hot Hand; (3) grade objectives and Perfect Season; (4) Rookie Week and the coin-flow table. **Cut line if the session overruns:** Rookie Week moves to buffer B0 (the existing starter pack and objectives still cover a new player). **Protocol:** none. **Save-compat:** `career` (or `playtime.hook`), `streak` fields, `hq.claims`, `hq.journal`. **Depends on:** ut-1, ut-5; C1, C6 at merge.

---

### ut-8 · P1 (second wave) · The long hook: weekly league and Minutes boards, Career Road and Prestige, collection goals

**Changes**
- **`src/net/leaderboard.ts` branches** (contract W4) with reader validation, ranking ties, the `hideBoards` publish guard and the byte-identical test. Publishing the weekly entry: at bank time, at most every 5 min, only from a profile with a name and `hideBoards` off.
- **Minutes screen, league and boards:** the league tile ("Pro League · 3rd of 12 · promotion line: 2nd (+12 min) · 2 d 4 h left"), LEAGUE / GLOBAL / ALL-TIME tabs and a per-sport filter; default view "near me" (you, two above, two below, the top 3); the row above you with the exact gap ("12 min behind MAYA · rival"); a MAX badge at 630; your own last week pinned as a ghost row so no board is empty; week-end rewards (promote: Silver, Gold from All-Star up; stay: 100 coins; first: a crown) claimed once per week (`lg:<week>` in `playtime.claimed`-style receipts); season of 6 weeks with the one-tier drop above Pro and a season badge. Feeds `nextUp`'s league-line slot and ut-5's league-change slot.
- **Career Road and Prestige (V2 D.6)** `src/ut/career-road.ts` + a Road screen from the Profile level ring: 100 levels on the existing shared `xp`/level, the existing 50 coins a level, a pack every 5 levels (in the sport you claim in), a profile frame every 10, cross-sport nudges ("Level 12: a free Gold Pack in Soccer Ultimate Team"); pays only levels gained after `career.roadFrom` (§2), each once (`road:<level>` receipts in `career`). At 100 the badge shows Prestige 1, 2, 3… (a star and a frame tier; never resets, never drops). Card prestige finishes are cosmetic only and deferred with card mastery (B3). Feeds `nextUp`'s Career slot.
- **Collection and Sets goals (M5, M12, V2 D.7):** Collection header with the three closest sets ("1996 Chicago · 7/8 · 1 card away" → GO by the ethics rule) and per-tier completion bars; set grades S/A/B; **era pages** with a completion ring and a small one-time coin reward (`era:<id>` in `hq.claims`, ≤ 100 coins each); the "39 / 22,082" meter becomes a footnote; filters that would be empty hide; missing cards in full colour at 40% with an SVG lock. Sets view: summary header and near-miss GO. Evolutions: "2 games, 1 win to go" with PLAY or ADD TO SQUAD.

**Tests:** `leaderboard-tags.test.ts` (byte-identical snapshot vs `acdf3e2`, 4 kinds × spans × 3 sports × suffix on/off; payloads unchanged with `hideBoards` off; no publish with it on); `minutes-board.test.ts` (validation rejects > 90/day, future days, sums, implausible acts, out-of-week `created_at`, too-frequent updates; ties); `league.test.ts` (divisions stable across phones for the same inputs; thresholds with < 10 entries; week-end rewards once; relegation takes nothing); `career-road.test.ts` (never retroactive; each level once; packs every 5; prestige display; a level-19 fixture gets nothing for 1–19); `collection-goals.test.ts`, `soccer-collection.test.ts`; a local-relay Playwright case (`ut-studio.mjs minutes --relay ws://localhost:7777`) that publishes and reads entries from 3 fake identities.

**Acceptance**
- Existing board tags and payloads byte-identical (test); 0 sockets to non-local hosts in the QA run.
- League tile and near-me board visible without scrolling at 393×852; with 1 player the league shows the threshold rule and the ghost row.
- Career Road: the Profile ring opens the Road in 1 tap; a reached reward is claimable once; no coins for levels before the build.
- Collection: content height / viewport ≤ 2.5 at 393 and ≤ 3.0 at 320 (before 3.4 / 4.0); 0 chips showing "0 editions"; first render ≤ 300 ms at 4× CPU.
- 0 overflow, clipped, < 44 or < 10 px on the changed screens at 3 sizes.

**Files:** `src/net/leaderboard.ts`, `src/net/leaderboard-tags.test.ts`, `src/ut/minutes-board.ts`, `src/ut/career-road.ts`, `src/ui/CareerRoad.tsx` (new); `src/ui/MinutesView.tsx`, `src/ui/Pages.tsx` (Profile ring link), `src/ut/minutes.ts`, `src/ut/next-action.ts`, `src/ut/CollectionGallery.tsx`, `collection.ts`, `SetsView.tsx`, `sets.ts`, `EvolutionsView.tsx`; tests.
**Commit split:** (1) board branches and tests; (2) league and boards UI; (3) Career Road and Prestige; (4) collection goals. **Cut line:** collection goals (4) move to buffer B0b if the session overruns. **Protocol:** none (new tags are additive). **Save-compat:** `playtime.league`, `career` receipts, `hq.claims`. **Depends on:** ut-2, ut-3, ut-7.

---

### ut-9 · Final QA · every-screen walk, defect fixes, full verification, docs

- **Walk** `ut-studio.mjs walk <sport> <size> --edge`: every UT tab and sub-screen, PreMatch, a played-out result with the One-More bar, the interrupted sheet, Scout Drop, the Minutes screen and boards (local relay), Career Road, main Home with Next up, Ranks, Profile, Missions, Gauntlet, draft Results, the first run; NBA, NFL, soccer × 393×852, 375×667, 320×568. Checks as revision 2 (overflow, clipping, < 44, < 10, contrast, topmost control, page errors, dead taps, feedback ≤ 100 ms, reduced motion) plus 0 non-local sockets. Fix every defect in ut-owned files (L3 Events tab edge, L4 two-line name plates and NFL OL at 320, L9 the Battles "outclasses Rookie" nudge); list the others for their teams.
- **Full verification once each, via heavy.sh:** typecheck, `npm test`, `npm run build`; entry chunk, UT chunk and new CSS vs `acdf3e2`; old-save fixtures and the round trip (UT, profile and cloud keys); `ut_coinflow.ts` and `ut_daily_sim.ts` re-run.
- **A 90-minute fake-clock soak** (Playwright clock, autoplay matches and menu taps): counted minutes stop at 90; Done for today appears on every surface; the break reminder appears once at a stoppage; no reward pays twice; 0 profile writes during matches.
- **Docs:** `ut.md` complete (before/after per task, tests, Protocol, Touched outside my lane, owner device checks, coin-flow table, deferred list with reasons, integration checklist, lead decisions); `docs/UI-NAVIGATION.md` (Next up, hub, PreMatch, One-More, Minutes); `docs/UT-OVERHAUL.md` (a studio section); a new `docs/MINUTES.md` (rules, numbers, tags, validation, anti-farm).

**Acceptance:** walk results 0 dead taps / 0 overflow / 0 clipped / 0 ut-owned < 44 / 0 ut-owned < 10 px / 0 contrast failures / 0 page errors / 0 non-local sockets in 3 sports × 3 sizes; `npm test` and `npm run build` pass; entry chunk ≤ +3 KB gzip (strip, chip, engine stub, `playtime.ts`, `haptics.ts`), UT chunk ≤ +45 KB gzip, new ut CSS ≤ 14 KB gzip; saves verified; every deferred item has its reason. **Protocol:** none (§9).

---

## 6. Order, dependencies and the slice

```
ut-0 ─ ut-1 ─ ut-2 ─ ut-3 ─ ut-4 ─ ut-5 ─ ut-6 ─ ut-7 ─ ut-8 ─ ut-9
        └───────────── first-impression slice (V2 F.4 #8): ut-2..ut-5 ─────────────┘
```
- **Must-not-slip (slice):** ut-2 Minutes engine, ut-3 Minutes ring and Done for today, ut-4 Next up on Home, ut-5 One-More bar. If time is short, ut-7 and ut-8 shrink along their cut lines before any slice item does.
- **P0 audit fixes V2 keeps:** ut-1/ut-4 (H4, H5), ut-5 (M3, soccer DRAW), ut-6 (M13, the mid-match kill exploit), ut-4 (L1).
- **`Match.tsx`** changes only in ut-5 and ut-6, back to back, in one hook block (plus ut-2's two playtime lines).
- **Buffer, in order, pulled in only when a task finishes early:** B0 Rookie Week / B0b collection goals (if cut from ut-7/ut-8); B1 Daily Play host + share card (needs each sport's C8 scenarios; the `play` board branch is ready from ut-8); B2 Touch rating ("Touch 41% ↑" from `grade.perfects/chances` over the last 50 moments, in the tally and Profile); B3 card mastery feats (3 per archetype, cosmetic only; needs per-player PERFECT counts in the box); B4 navigation motion and edge-swipe back; B5 kit pass on the least-visited screens.

---

## 7. Coin and pack flow (decision 1: ACCEPT; recomputed by `scripts/ut_coinflow.ts`)

Assumptions as revision 2 (NBA prices; packs at quick-sell EV ≈ 0.5 × price: Silver 200, Gold 450, Premium 900, Jumbo 1,800; solo games ≈ 5 min at Pro; engaged = 8 paid matches a day at 60% wins, all dailies, 60 active minutes; casual = 3 matches, ≈ 17 min).

| Engaged UT value per day | Today | After revision 3 | Change |
|---|---|---|---|
| Matches (8 paid × 48) | 384 | 384 + Hot Hand 20–96 | +20 to +96 |
| Daily objectives | 200 | 200 | 0 |
| Daily bonus → Scout Drop 1 | 300 | ≈ 439 (revision 2's Scout Reveal sizing; packs' table at merge) | +139 |
| Scout Drops 2 and 3 | 0 | ≈ 80 | +80 |
| Weekly objectives ÷ 7 | 129 | 129 (chest upgrade deferred) | 0 |
| Circuit milestones ÷ 7 | 164 | 164 (per-win pay deferred) | 0 |
| v1 Season Pass ÷ 28 | 291 | 291 | 0 |
| Career XP from UT matches (level coins) | 0 | ≈ 13 | +13 |
| MINUTES daily + weekly (full table) | 0 | ≈ 514 (lean ≈ 369) | +514 |
| League week-end ÷ 7 | 0 | ≈ 15–64 | +15 to +64 |
| Career Road packs, streak milestones, Perfect Season, era pages | 0 | ≈ 0 net (re-skins or cosmetic; era pages one-time) | ≈ 0 |
| **Total** | **≈ 1,468** | **≈ 2,249–2,374 (full) · ≈ 2,104–2,229 (lean)** | **≈ +53–62% (full) · ≈ +43–52% (lean)** |

- **Against the decision.** The lead accepted "about +50% for the engaged player (the full D.16/E.5 tables)". With the full table the engaged total lands at about +53–62% over today because Drop 1 (the planned Scout Reveal) and Career XP stay on top. To stay near the decision, this plan **cuts** revision 2's Circuit per-win pay (+65), Rivals weekly pay (+45) and the weekly chest upgrade (+132), and keeps `MINUTES_TABLE` as a one-line lever: `'lean'` lands at ≈ +43–52%. Default `'full'` per decision 1; flagged in §11.
- **Casual** (3 matches, ≈ 17 min, 5–7 days): ≈ 1,030 → ≈ 1,280 (≈ +24%), mostly Drop 1 (+139), the first Minutes rungs (≈ +96) and about half a small drop (≈ +20).
- **Raw coins from time stay below match coins** (V2 E.5 rule): engaged ≈ 221 coins a day from MINUTES vs ≈ 384 from matches.
- **Program supply:** ut adds no free program cards this round (the Circuit 6-0 swap is deferred with competitive pay).
- **Other sports:** match coins identical; pack values follow each sport's prices; the script prints all three.

---

## 8. Cut and deferred (with reasons)

| Item | Status | Reason |
|---|---|---|
| Navigation motion (push/pop/tab transitions, edge-swipe back) | buffer B4 | V2 F.2 ut #8: behind items 1–3 |
| Kit pass on Club Players, Storage, LeagueSeason, StreamlinedView, Events, Battles, Moments, CupView, DraftView | buffer B5; walk defects still fixed in ut-9 | V2 F.2 ut #8 |
| Development (M4) rework | deferred | V2 F.2 ut #8 |
| Season Pass v2 (30 × 1,000 SP) | deferred | V2 F.2 ut #8; revision 2's safety design is kept in git (`237337a` §8) for the next round |
| Circuit per-win pay; Rivals weekly 5/10 pay; weekly chest upgrade (4/6 Premium, 6/6 pick) | deferred | the accepted economy ceiling is spent on the V2 hook (§7) |
| Program/promo objective groups; card-attached signature objectives | deferred | supply under packs' odds; signature objectives become card mastery (B3) |
| Daily Play host and share card | buffer B1 | each sport's scenarios are P1 on their side (C8); the board branch ships in ut-8 |
| Touch rating; card mastery | buffer B2, B3 | need C1 `chances` and per-player PERFECT counts |
| Push notifications | out | decision 7: badge only |
| Streak wager | out | decision 8 |
| Clubs, friends by follow, friend quests | out | V2 D.8 "later" |
| Depth Gauntlet; Squad Battles structure changes; rung-1 floor | deferred | outside V2 and the brief's priorities |
| In-match HUD objective chip | sport teams | the HUD is theirs; ut offers `playtimeLine()` and objective text |
| Mode renames | never | owner decision 1 |

---

## 9. Protocol

**Expected `ut.md` line: "Protocol bump needed: none from team ut"**, as long as all of these hold:
1. `how` comes only from the human's offensive possessions; Auto-defend and defensive SIM never change settlement.
2. Auto-finish, forfeit and solo quit apply only to solo modes.
3. Soccer does not change how UT draws settle (if it does, that is soccer's UT bump; ut ships the dormant branch).
4. ut changes nothing in `teams.ts`, ratings used in matches, pairing, or how the grade, Heat or PERFECT are computed (read-only, C1).
5. MINUTES, leagues, boards, Next up, One-More, Scout Drops, Hot Hand, streak slack, Career Road, Prestige and the Perfect Season campaign are economy and presentation only (V2 F.3 last row); the new board tags are additive and existing tags are byte-identical.

---

## 10. Integration checklist for the lead (also in ut.md)

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

## 11. Lead decisions (flagged; defaults applied)

1. **Economy:** full Minutes table lands at ≈ +53–62% over today vs the accepted "about +50%"; default `'full'`, lever `'lean'` (≈ +43–52%). Circuit/Rivals pay and the weekly chest upgrade are deferred to make room.
2. **`profile.career` in `SHARED`** (one line outside the playtime grant). Default: use it if granted, else `playtime.hook`.
3. **Interrupted matches:** auto-finish limit 2 a week; human-side handicap −0.15.
4. **Rivals rage-quit** (killing the app mid online Rivals match avoids −12 RP): not built; proposal kept from revision 2.
5. **Scout Drops count draft H2H and Gauntlet wins** (V2 says "any mode"). Default: yes; Daily Play clears count once B1 lands.
6. **"Hide leaderboards"** stops publishing to every board (existing ones too) but keeps reading. Default: yes.

## 12. Owner device checks (only a real iPhone can confirm)

- **Feel:** the Next up strip and Minutes chip under the Dynamic Island fix; the 5-second end of match and the One-More reach with the right thumb; Scout Drop rhythm.
- **Haptics:** tick on claims, long on packs; nothing fires late on an unrelated tap.
- **MINUTES:** a real 20-minute session counts about 20 minutes; backgrounding the app stops the count; a phone call mid-match does not bank a partial match; two phones on one account never double-pay.
- **App-icon badge:** `setAppBadge` on a home-screen app; it may need notification permission on iOS, which the app never asks for, so it may show nothing (acceptable).
- **WebKit-only:** Live Now scroll-snap and edge fade; sticky chips; sheet swipe-to-close against grids.
- **Flows:** force-quit during a Cup round and iOS eviction in the background; the first-run sheet on a fresh install; 375×667 on a real device.
