# Team ut build plan: Ultimate Team menus, hub, objectives, rewards loop, results

Planner output, 2026-11-09. Worktree `/home/user/ps-s-ut`, branch `claude/studio-ut` (cut from `acdf3e2`), dev-server port 5212. The build engineers follow this plan task by task, in order. The running record (what changed, measurements, "Protocol bump needed", "Touched outside my lane", owner device checks) goes in `docs/studio-overhaul/ut.md`, which every task updates.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`. Sources read in full: `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-ut.md`, `O/audit-ut-ui.md`, `O/research-ultimate-team.md`, `CLAUDE.md`, `docs/UT-OVERHAUL.md`, `docs/UI-NAVIGATION.md`, `docs/OVERHAUL-REWARDS.md`, `docs/OVERHAUL-UX.md`, `docs/UT-POLISH.md`, `docs/UT-CLUB-SEASON.md`, `docs/OVERHAUL-CUP.md`, plus the code they point to (`Hub.tsx`, `UltimateTeam.tsx`, `Clubhouse.tsx`, `Match.tsx`, `play.ts`, `progression.ts`, `hq-state.ts`, `state.ts`, `inbox.ts`, `daily-hub.ts`, `DailyHubView.tsx`, `circuit.ts`, `rivals.ts`, `play-status.ts`, `nav.ts`, `ui.tsx`, `CollectionGallery.tsx`, `collection.ts`, `sets.ts`, `SetsView.tsx`, `EvolutionsView.tsx`, `MatchDebrief.tsx`, `match-debrief.ts`, `pool.ts`, `App.tsx`, `ui/Pages.tsx`, `ui/Rewards.tsx`, `ui/Welcome.tsx`, `engine/missions.ts`, `game/progress.ts`).

---

## 1. Goals

The owner wants Ultimate Team to look, play and feel like a production UT: "lead players to places", "good objectives and rewards", "attract dopamine", "all menus work and taps", "detailed and beautiful". Concretely, when this team is done:

1. **Nothing is a dead end.** The landing screen shows what UT has waiting (badge + strip). Every progress surface (objectives, missions, Gauntlet, Season Pass, Sets, Evolutions, Development, Daily) has a GO button to the exact screen where the task is done.
2. **UT Home is a hub with one obvious next step**: a "Next best action" hero chosen by a fixed priority list (claimables first), a Live Now carousel with countdowns, an Upcoming strip, near-miss chips, and an honest "done for today" state.
3. **Every match ends on a reward sequence**: result first (a level score reads DRAW/TIE, never WIN), player ratings and a man of the match when the engine provides per-player data, then coins, card XP, Season Pass and objective ticks animating, then one "What's next" button.
4. **Solo play has no online friction or exploits**: solo games get a clean pre-match screen (no 10 s vote), and killing the app mid-match can no longer replay a Cup, Circuit, Club Season or UT Draft game.
5. **Progression has depth** (P1): daily/weekly/program objective layers with a Scout Reveal, a 30-level Season Pass from the next season with a hero reward from day 1, pay for every Circuit win and Rivals weekly rewards, streak warning and shield, an in-UT account level-up, an exit teaser, a starter chain, and a single welcoming first-run flow.
6. **Every UT screen is beautiful and clear** (P1): one visual system (header plates come from shell; ut adds section titles, reward chips with art, countdown chips, claim buttons with haptic + burst, empty states), shorter Development/Collection pages, meaningful collection goals.
7. **Every tap works** in all three sports at 393×852 (59/34) and 320×568, and player-facing mode names are centralised in `src/ut/labels.ts` without changing their wording (P2).

Hard constraints applied in every task: never reset or re-meaning saves, storage keys, card/edition/copy ids or claim ids (new state is optional, additive, normalised, tested with an old-shape save); coins only; never touch live Supabase/Nostr/boards (QA uses `?ns=inspect&relay=ws://localhost:7777` + route-abort of non-localhost hosts except Google Fonts); never edit `DRAFT_RULES`/`UT_RULES`; seeded RNG only in simulation code; `pick({ nba, nfl, soccer })`/`pickFor` and never a two-way sport ternary; 390 frame, no width media queries, taps ≥ 44 design px, text ≥ 10 design px, reduced motion respected, SVG symbols; keep the §6 "what works well" list (nav map, claimables-only badges, CLAIM ALL inbox, Daily loop, YOUR NEXT PLAY, Archivo condensed italic + teal/gold); new CSS in new ut-owned files; small local hunks in shared files.

---

## 2. Scope map: every brief item to a task

| Brief item (STREAM-ut) | Task | Notes |
|---|---|---|
| P0-1 Bridge from landing (H4): main-tab UT badge, Home strip deep-linking into UT | ut-1 (data), ut-2 (UI) | pool-free claimables module, lazy-imported |
| P0-2 GO links on objectives, missions, Gauntlet, Season Pass, Sets, Evolutions (H5) | ut-1 (`go.ts`), ut-2 | also Daily objectives and Development |
| P0-3 UT Home hub: next-best-action hero, Live Now carousel, Upcoming strip, near-miss chips, done-for-today, studio look | ut-3 | |
| P0-4 End-of-match reward sequence (M3), soccer draw reads DRAW, keep MatchDebrief | ut-5 | ratings/MOTM from engine box data only |
| P0-5 Solo games skip the online vote (M13) | ut-4 | new `PreMatch` screen |
| P0-6 Mid-match kill exploit (Cup/Circuit/Season replay) | ut-4 | `ut.live` marker + forfeit, UT Draft included |
| P1 Objectives in layers: daily 3 + Scout Reveal, weekly 6 + chests 4/6, 6/6, program groups, card-attached | ut-6 | card-attached is conditional on box data |
| P1 Objective placement (chips on Play tiles, pre-match, end-of-match claim) | ut-6 (+ ut-4, ut-5 hooks) | in-match HUD chip deferred (sport HUDs) |
| P1 Season Pass presentation (M10), 30 × 1,000 SP from next season only | ut-7 | v1 season untouched |
| P1 Competitive pay: Circuit every win, Rivals weekly 5 and 10 wins, coins only, coin-flow doc | ut-7 | |
| P1 Retention hooks: streak warning + weekly shield, account level-up in UT, exit teaser, starter chain | ut-8 | |
| P1 First run (M7): mention UT, merge the two stacked modals | ut-8 | gift id unchanged |
| P1 Long flat pages (M4) Development, Collection | ut-9 | SBC/Store are packs' |
| P1 M5 collection meter, M12 empty filters + silhouettes | ut-9 | |
| P1 Consistent visual system across every UT screen | ut-9 (components), applied in ut-2..ut-9 | header plates are shell's |
| P1 Every tap and every screen works, 3 sports × 393 & 320 | ut-10 | own QA script |
| P2 Labels (H6): `src/ut/labels.ts`, route visible strings, no wording change | ut-1 (module + nav/mode names), ut-10 (sweep) | |
| P2 Depth Gauntlet every two weeks | deferred (§6) | |
| Notes: owner device checks (strip/badge feel, post-match length, haptics) | ut-2, ut-5, ut-8, ut.md | |

### Audit items (audit-ut-ui.md, all but §1)

| ID | Owner | Task / reason |
|---|---|---|
| C1, H1, M1, M6, M8, M9, L6, L7 | shell | not ut; our new UI keeps clear of `--sat` + edge and uses shell's header plates |
| H2, H3, M11, L4 (grid cards) | players | card faces/CardDetail; we only consume `UtCard` |
| H7, M2, M4 (SBC, Store) | packs | |
| H4 | ut | ut-1, ut-2 |
| H5 | ut | ut-1, ut-2 |
| H6 | ut (centralise only) | ut-1, ut-10; the 2K/Madden link text in `CardDetail.tsx` is players', listed for them |
| M3 | ut | ut-5; rung-1 opponent floor deferred (§6); scorelines are sport teams' |
| M4 (Development, Collection) | ut | ut-9 |
| M5, M12 | ut | ut-9 |
| M7 | ut | ut-8 |
| M10 | ut | ut-7 |
| M13 | ut | ut-4 |
| L1 badge contrast | ut | ut-2 (`.ut-dot` in nav.css, main `.tab-ut` badge) |
| L2 tiny text | ut-owned parts | ut-9 (login-calendar day numbers, mission difficulty pills, "NEW"); LV ring/TopBar/Cloud Save are shell's |
| L3 Legends Events tab edge | ut | ut-9 (`Events.tsx`) |
| L4 squad name plate, NFL OL row at 320 | ut | ut-9 (`SquadView.tsx`) |
| L5 Standouts back label | none | by design, kept |
| L8 Ranks offline | not ut | flagged for lead (Ranks page unassigned) |
| L9 recommended difficulty nudge | ut | ut-9 (`Battles.tsx`) |

### §4 screen notes

Main Home stat chips lead to dead-end sheets → ut-2. How-to text wall → deferred (§6, unassigned file area). Draft "DM/CM" legend → not ut (draft screen). Profile zero grid for a new drafter + UT claimables → ut-2. UT Home missing "next unlock" teasers → ut-3. Rewards/Daily → kept, extended in ut-6/ut-8. Play → objective chips in ut-6. Squad Battles L9 → ut-9. Legends/Moments L3 → ut-9. Squad L4 → ut-9. Collection/Sets/Development/Evolutions → ut-9 (+ GO links ut-2). Objectives/Season Pass → ut-2, ut-7. Match/Result → ut-4, ut-5. Store/pack/SBC → packs.

### §5 missing hooks 1-11

1 bridge → ut-2 · 2 GO links → ut-2 · 3 post-match sequence → ut-5 · 4 starter chain → ut-8 · 5 pack management → packs · 6 visible goals with art → ut-7 (Season Pass hero), ut-3 (hub art); SBC reward faces and pick previews → packs · 7 near-miss chips → ut-3 · 8 streak warning + HOME dot → ut-8 (dot wiring in ut-2) · 9 account level-up in UT → ut-8 · 10 exit teaser → ut-8 · 11 push "Daily Drop ready" → deferred (§6).

---

## 3. Cross-team contracts (written here and in `ut.md` so the lead can wire them at merge)

**A. Per-player match data (nba, nfl, soccer → ut).** The ut result screen shows player ratings and a man of the match only from real engine data; it never invents stats (same rule as `match-debrief.ts`). Proposed additive field on `Progress` (`src/game/progress.ts`; a 2-line optional field the sport teams add):

```ts
export interface BoxLine {
  id: string;            // the card line id (RatedCard.line.id) of the player
  name: string;
  stats: Record<string, number>; // nba: pts reb ast stl blk tov fgm fga tpm; nfl: passYds passTd int rushYds rushTd rec recYds recTd tkl sacks defInt; soccer: goals assists shots onTarget saves tackles keyPasses conceded
  rating?: number;       // 1.0-10.0 if the engine rates players itself
}
// Progress.box?: BoxLine[]
```

`src/ut/match-ratings.ts` (ut-5) reads it duck-typed (`(p as { box?: unknown }).box`), so the result screen compiles and works before and after the field exists. Absent → the ratings block is hidden.

**B. Solo quit (nba/nfl `Arcade.tsx`, soccer flow → ut).** If the sport teams add Pause → Quit, solo quit should call an optional `onQuit?: (us: Progress, them: Progress) => void`. `Match.tsx` maps it: Cup/Circuit/Club Season/UT Draft → the same forfeit settlement as an interrupted match (ut-4); Squad Battles/Legends Events → leave without a result. Online quit stays theirs.

**C. Live Now / Upcoming feed (packs → ut).** packs' brief asks them to export "what's live now / upcoming". Proposed shape (ut-3 has one seam function to swap from the direct `calendar.ts` reads to this at merge):

```ts
export interface LiveFeedItem { id: string; kind: 'program' | 'standouts' | 'flash' | 'lightning' | 'boost' | 'sbc'; title: string; sub: string; startsAt: number; endsAt: number; view: string; art?: { pack?: string; cardId?: string }; accent?: [string, string] }
export function liveFeed(day: string, sport: UtSport, now: number): { live: LiveFeedItem[]; upcoming: LiveFeedItem[] };
```

**D. Program card picks (packs ↔ ut).** Program objective groups (ut-6) and Season Pass named cards (ut-7) award "1 of 3" picks built from existing live-program editions (`promoCards` in `live-cards.ts`, read-only), seeded from the claim id, deposited with `addPick`. No new editions. If packs ships a Program Key/Program Bag, the weekly 6/6 chest adds one key (else a Scout's Choice pick). If packs ships Scout Stamps, the hub Store tile shows the stamp meter.

**E. Header plates and top clearance (shell → ut).** Shell owns `.ut-top`/`.topbar` and the `--sat` edge clearance. All new ut UI positions from the existing page body, never with its own top offsets, and toasts stay shell's.

---

## 4. Tasks (ordered: P0 first, enabling work first)

Common to every task:
- **Before you change anything**, capture "before" screenshots and numbers for the task's screens with the ut QA script (`scripts/qa/ut-studio.mjs`, created in ut-2 from `O/audit-scripts/utui/lib.mjs`; until then use `O/audit-scripts/utui/walk.mjs` pointed at port 5212). Save shots to `O/shots/ut/<task-id>/<sport>-<width>-<name>.png`.
- **Dev server:** `nohup npx vite --port 5212 --strictPort > /tmp/ps-ut-vite.log 2>&1 & echo $! > /tmp/ps-ut-vite.pid`; stop with `kill $(cat /tmp/ps-ut-vite.pid)`. Browser QA always at `?ns=inspect&relay=ws://localhost:7777` with route-abort of non-localhost hosts (except fonts.googleapis.com, fonts.gstatic.com), `hasTouch`, `isMobile`, `deviceScaleFactor: 1`, 393×852 with insets 59/34 and 320×568.
- **Tests** through the semaphore: `bash O/heavy.sh npm run typecheck`; `bash O/heavy.sh npx vitest run src/ut/<files>`; `PS_SPORT=nfl bash O/heavy.sh npx vitest run src/ut/<files>`; soccer runs only files whose path contains "soccer", so each task's soccer cases go in a `src/ut/soccer-*.test.ts` file and run with `PS_SPORT=soccer bash O/heavy.sh npx vitest run soccer sport-branches`.
- **Commit** each task with explicit paths, "Claude: …" message and the BUILD-RULES trailer; push `claude/studio-ut`. Update `docs/studio-overhaul/ut.md`.

---

### ut-1 · P0 · Progress core: light objectives module, pool-free claimables, GO targets, labels

**Why first.** The main-app badge/strip (ut-2) must not pull the UT chunk (pool, packs, cards) into first paint, and every GO link, hub and recap reads the same objective/claimable logic. Today `progression.ts` imports `weekOf` from `sbc.ts`, which imports `packs.ts` and `pool.ts`, so nothing in `progression.ts` can be used outside the UT chunk.

**Changes**
- **NEW `src/ut/objectives.ts`** (light: imports only `hq-state.ts`, `state.ts` types, `../engine/sport`, `../net/leaderboard` `weekKey`). Move here from `progression.ts` without behaviour change: `Reward`, `Objective`, `DAILY`, `WEEKLY`, the lifetime table, `objectiveDeck`, `hqOf`, `seasonFor`, `SEASON_TIERS`, `SEASON_STEP`, `seasonReady`, `readyRewards`, `rewardLabel`. `progression.ts` re-exports all of them (every existing import keeps compiling) and keeps the write paths (`addSeasonXP`, `recordActivity`, `recordMatchProgress`, `depositPrize`, `claimSeason`, `claimReadySeason`, `claimObjective`). Switch the week function to `weekKey` (the same ISO-week algorithm as `sbc.ts weekOf`).
- **Move** `DEVELOPMENT_PATHS` and `developmentReady` from `club-management.ts` into `objectives.ts` (re-exported from `club-management.ts`).
- **NEW `src/ut/claimables.ts`** (light, no pool): `utClaimables(ut: UtState, day: string, week: string, sport: UtSport): Claimables` where
  ```ts
  interface Claimables { count: number; rewards: number; packs: number; picks: number; dropReady: boolean; dropDay: number; calendarReady: boolean; streak: number; streakAtRisk: boolean; hoursLeft: number; lines: string[] }
  ```
  It counts, with the same rules as `inboxItems`: New Era, Daily Drop, login calendar, objectives, daily bonus, Season Pass tiers, Weekly Standouts objective, finished UT Draft, ready Evolutions, Rivals rewards, development, Cup title; plus `packs` = `ut.packs.length` and `picks`. The pool-dependent sources (Sets, Collection milestones, Moments) come from an in-memory cache: `rememberPoolClaimables(sport, n)` (called by `UltimateTeam.tsx` whenever it computes `inboxItems`) and `poolClaimables(sport)`. Re-implement the tiny checks that live in heavy modules (`newEraReady`, `draftOf(..).done`, `cupClaimId`, `standoutWins`) only where importing them would reach `packs.ts`/`pool.ts`; each re-implementation gets an equality test against the original. `streakAtRisk` = drop ready, streak ≥ 2, ≤ 4 h to Eastern midnight.
- **NEW `src/ut/go.ts`**: `type GoTarget = { view: UtView; label: string }`; `goForCounter(counter: Counter | 'collect', sport): GoTarget` (games/wins/points → `battles` "PLAY"; onlineWins → `rivals` "FIND MATCH"; packs → `store` "STORE"; sbcs → `sbc` "SBCs"; moments → `moments` (soccer → `battles`); development → `development`; collect → `store`); `goForSet(set: CardSet): GoTarget` (era/decade → `store`, standouts → `standouts`, landmarks → `sbc`, rare → `store`); `openUtAt(view)` for the main app = `rememberUtReturn(view)` then open UT.
- **NEW `src/ut/labels.ts`**: every player-facing mode/feature name as constants with today's exact wording (`ULTIMATE_TEAM = 'Ultimate Team'`, `UT = 'UT'`, `SQUAD_BATTLES`, `RIVALS`, `SBC`/`SBCS`/`SBC_LONG`, `EVOLUTIONS`, `MOMENTS`, `CHAMPIONS_CIRCUIT`, `CLUB_CUPS`, `CLUB_SEASON`, `LEGENDS_EVENTS`, `UT_DRAFT`, `SEASON_PASS`, `DEVELOPMENT`, `COLLECTION`, `SETS`, `STORE`, `CHALLENGES`, upper-case variants via a helper) and `modeName(view)`. Route through it now: `nav.ts` titles and tab labels, `play-status.ts` `MODE_NAME`, `Match.tsx` `title` chain and VS/result eyebrows. Everything else is routed as later tasks touch each file; ut-10 sweeps the rest.

**Tests (new)**
- `src/ut/objectives.test.ts`: `weekKey(day) === weekOf(day)` for 800 consecutive days spanning two year boundaries; objective claim ids and decks byte-identical to the pre-move output for 6 fixture saves (snapshot the `objectiveDeck` result before the move, commit it as a fixture).
- `src/ut/claimables.test.ts`: for ≥ 8 fixtures (fresh; starter unclaimed; the audit fixture with 6 rewards + 2 packs; season tiers ready; Rivals reward; Cup title; Evolution ready; finished Draft; New Era eligible) `utClaimables(...).rewards + poolClaimables === inboxCount(pool, ...)`. `streakAtRisk` window at 19:59 vs 20:01 ET.
- `src/ut/claimables-graph.test.ts`: static import walk (regex over `import … from`, ignoring `import type`) from `claimables.ts` must not reach `pool.ts`, `packs.ts`, `cards.ts`, `sbc.ts`, `rate.ts`, `squad.ts`.
- `src/ut/labels.test.ts`: snapshot of every label (wording unchanged); `nav.ts` titles equal the label constants.
- `src/ut/soccer-claimables.test.ts`: soccer fixture (no Moments, Spotlight → Elite).
- Existing `overhaul.test.ts`, `inbox-completeness.test.ts`, `polish.test.ts`, `play-status.test.ts` pass with no edits.

**Measurements / acceptance**
- Typecheck 0 errors; the NBA, NFL and soccer suites listed above pass.
- Consistency: claimables count equals `inboxCount` in 100% of fixtures.
- Graph test green (0 heavy modules reachable).
- No claim id, objective id or reward amount changes (fixture snapshot equal).

**Screenshots:** none (logic only).
**Protocol impact:** none (no match, rating or settlement change).
**Save-compat risk:** none; no saved field touched. Risk is accidental behaviour drift in the move, covered by the snapshot test.
**Dependencies:** none. Unblocks ut-2, ut-3, ut-5, ut-6.
**Files:** `src/ut/objectives.ts` (new), `src/ut/claimables.ts` (new), `src/ut/go.ts` (new), `src/ut/labels.ts` (new), `src/ut/progression.ts`, `src/ut/club-management.ts`, `src/ut/nav.ts`, `src/ut/play-status.ts`, `src/ut/Match.tsx` (title strings only), tests above.

---

### ut-2 · P0 · Lead players somewhere: main-app bridge (H4) and GO links on every progress surface (H5)

**Changes**
- **Main tab badge** (`src/ui/Pages.tsx` `Tabs`, `src/App.tsx`): App dynamically imports `./ut/claimables` after first paint (`requestIdleCallback`/`setTimeout` fallback) and keeps the module in state; `useMemo` computes `utClaimables(profile.ut, todayKey, weekKey(todayKey), SPORT)` on profile/day change. `Tabs` gets `ut?: { count: number; atRisk: boolean }`: a red number badge (≥ 4.5:1 contrast: `#e5484d` background, 11 px bold, L1) when `count > 0`, an amber clock dot when `atRisk`, and the existing FREE pill while the starter is unclaimed. Accessible name adds "6 rewards ready". Optional, feature-detected and wrapped in try/catch: `navigator.setAppBadge(count)` / `clearAppBadge()` (owner device check).
- **Home UT strip** (NEW `src/ui/UtBridge.tsx` + `src/ui/ut-bridge.css`, one hunk in `HomePage`): shown only when `count > 0 || dropReady`: "ULTIMATE TEAM · 6 rewards · 2 packs · Day 3 drop ready" with the UT mark and a chevron, one 48 px row between `.statstrip` and `.evo-home-actions`. Tap → `openUtAt(count ? 'inbox' : 'daily')`. When Home is `short`/`snug` (layout class from `useLayout`), render instead as a compact chip inside `.statstrip` so Home gains no height (coordinate with shell, who owns the hint/spacer rule and the 22 px edge clearance).
- **Profile** (`ProfilePage`): the UT card shows the claimables line ("6 rewards ready · 2 packs") and deep-links to the inbox; a new drafter (`stats.games === 0`) sees "Play your first draft" with a PLAY button instead of the 10-tile grid of zeros (§4).
- **Missions sheet** (`src/ui/Rewards.tsx` `MissionsSheet`, `src/engine/missions.ts`): each `Mission` gets `go: 'any' | 'daily' | 'blind' | '1v1'` (static data; H2H missions → `'1v1'`, `daily` → `'daily'`, `blind` → `'blind'`, the rest `'any'`). An unfinished mission shows a GO button: selects that mode (`onMode`) and closes the sheet; `'any'` closes and starts a draft (`startRun`). DONE stays as the footer.
- **Gauntlet sheet** (`GauntletSheet`, App): App passes `last?: { label: string; start: () => void }` when a finished draft for this sport exists in memory (`run?.result`); the primary button becomes "CLIMB WITH YOUR <1996 BULLS>" (same code path as Results' `onGauntlet`). Otherwise "PLAY A DRAFT" closes and starts a draft; copy changes to "Finish any draft, then take that team up this week's eight." GOT IT becomes a secondary CLOSE.
- **Objectives** (`Clubhouse.tsx` `ObjectivesView`): the disabled "IN PROGRESS" chip becomes a GO chip from `goForCounter` (`onGo` prop wired in `UltimateTeam.tsx`); the view opens on the first group that holds a ready reward (daily → weekly → lifetime → saved); "1 REWARDS READY" pluralises.
- **Daily** (`DailyHubView.tsx`): unfinished objective rows get the same GO chip.
- **Season Pass** (`SeasonView`): under the head, "Earn 180 SP → Level 7: Gold Pack" with a PLAY button to `play` and "≈ 2 played matches" (SP per played match from `recordMatchProgress` rules).
- **Sets** (`SetsView.tsx`): rows with `need - have ≤ 2` show a "1 CARD AWAY" pill and a GO button from `goForSet`.
- **Evolutions** (`EvolutionsView.tsx`): active rows show "2 games, 1 win to go" and PLAY (card in squad) or ADD TO SQUAD (not in squad → `squad`). **Development** (`DevelopmentView`): PLAY next to MANAGE SQUAD when the copy is equipped.
- **UT badges** (`nav.css` `.ut-dot`): same contrast fix as the main badge (L1).
- **NEW `scripts/qa/ut-studio.mjs`**: the team QA harness, copied from `O/audit-scripts/utui/lib.mjs` (fixture, insets, isolation, audit metrics), port 5212, cases selectable by argument (`walk`, `bridge`, `interrupt`, `recap`, `firstrun`, `hub`), shots to `O/shots/ut/`.

**Tests**
- `src/engine/missions.test.ts` (new or extended): every mission in every sport list has a `go` value; the mode it selects exists.
- `src/ut/go.test.ts`: every `Counter` and set kind maps to a view that exists in `nav.ts` and is shown for that sport (soccer: no `moments`/`events`/`league`); `src/ut/soccer-go.test.ts`.
- Browser (`ut-studio.mjs bridge`): audit fixture (6 rewards + 2 packs): main tab badge reads 6, UT HOME badge reads 6, the strip reads "6 rewards · 2 packs", tapping it lands on UT Rewards with the back label HOME.

**Measurements / acceptance**
- Every unfinished objective/mission/daily row has an enabled action: count of disabled-only "IN PROGRESS" chips 0 (before: every unfinished objective, `41-ut-ch-objectives.png`).
- Missions sheet and Gauntlet sheet each have a primary action other than DONE/GOT IT.
- Main badge = UT HOME badge in 100% of fixture runs (3 sports).
- Home at 393×852 and 320×568 (3 sports): `.playbar` top y unchanged ±1 px vs before; 0 clipped text; 0 targets < 44; strip text ≥ 10 px.
- Badge contrast ≥ 4.5:1 (before 4.28:1).
- Entry chunk unaffected: `claimables.ts` is only reached through a dynamic import (graph test + build check in ut-10).

**Screenshots:** main Home with strip (nba/nfl/soccer 393; nba 320 compact chip), tab-bar crop with badge and amber dot, Profile (UT card; new drafter), Missions sheet, Gauntlet sheet (with and without a last team), Objectives with GO chips, Daily, Season Pass "Earn N SP", Sets near-miss, Evolutions.
**Protocol impact:** none.
**Save-compat risk:** none (no new saved state; `go` is static mission data).
**Dependencies:** ut-1. shell (Home spacer/hint and edge clearance: placement agreed through ut.md; shell's `screen-fit.mjs` must still pass). Touches shared `App.tsx` (claimables memo, Tabs prop, Missions/Gauntlet callbacks) and `Pages.tsx` (Tabs, Home strip hunk, Profile, GauntletSheet): small hunks, listed under "Touched outside my lane" only if outside the ut-owned parts in OWNERSHIP.md.
**Files:** `src/App.tsx`, `src/ui/Pages.tsx`, `src/ui/Rewards.tsx`, `src/ui/UtBridge.tsx` (new), `src/ui/ut-bridge.css` (new), `src/engine/missions.ts`, `src/ut/Clubhouse.tsx`, `src/ut/DailyHubView.tsx`, `src/ut/SetsView.tsx`, `src/ut/EvolutionsView.tsx`, `src/ut/UltimateTeam.tsx`, `src/ut/nav.css`, `scripts/qa/ut-studio.mjs` (new), tests.

---

### ut-3 · P0 · UT Home becomes a hub

**Changes**
- **NEW `src/ut/next-action.ts`**: `nextBestAction(ctx): Action` with `ctx = { ut, pool, day, week, now, claimables, sport }` and
  ```ts
  interface Action { id: string; kind: 'starter' | 'chain' | 'claim' | 'continue' | 'expiring' | 'daily' | 'pass' | 'wave' | 'packs' | 'play' | 'done'; eyebrow: string; title: string; line: string; cta: string; view?: UtView; act?: 'claimAll' | 'starter'; art: { pack?: string; mode?: string; cardId?: string; squad?: true }; endsAt?: number }
  ```
  Priority (first match wins; research §8.12 plus the brief):
  0. starter pack unclaimed → "Open your starter pack"; (ut-8 inserts the starter-chain step here);
  1. claimables > 0 → "Claim 6 rewards" (CLAIM ALL in place, with burst);
  2. an unfinished run (Cup/Circuit/Club Season/UT Draft, most recent first; the logic now inline in `Hub.tsx`) → CONTINUE;
  3. something with progress that expires < 24 h (weekly objectives on Sunday, the Standout objective, a calendar program SBC ending within 24 h, Rivals week) → GO, amber clock;
  4. daily objectives 2 of 3 → "1 more for today's bonus";
  5. Season Pass within 30% of a named reward ("2 levels to a Premium Gold Pack") → PLAY;
  6. a program wave in its first 48 h (calendar) → STORE;
  7. unopened packs/picks → OPEN PACKS;
  8. otherwise "Play: Champions Circuit" if a free entry is left, else Squad Battles at the recommended level;
  9. **done for today** when the Daily Drop, calendar, all three dailies and their bonus are claimed, nothing is claimable and no run is live: a calm card "You're done for today", tomorrow's teaser ("Day 4 of 7 · Gold Pack in 3 days") and the reset countdown, with a quiet "Keep playing" link (ethics: research §7).
- **NEW `src/ut/live-now.ts`**: `liveNow(ctx): LiveItem[]` and `upcomingDrops(ctx): LiveItem[]`, `LiveItem = { id, title, sub, endsAt, progress?: [number, number], view, art, tone, amber: boolean }`. Live: Weekly Standouts (featured card, ends at the weekly reset), live calendar programs (`promosOn`, OVR band, end), Lightning window (`lightningWindow`), Daily Drop (Eastern midnight), Champions Circuit entries left (Monday), Club Cups titles left this week, Rivals week (progress to the next weekly reward), Season Pass season end. Upcoming: `upcoming(day, 3, sport)`, next Standouts Wednesday, next Lightning window (`minutesToLightning`), next season if ≤ 5 days, each with a date and a requirement line where one exists (e.g. Silver Cup "every card ≤ 74"). `amber` when `endsAt - now < 24 h`. One seam `programFeed()` to switch to packs' `liveFeed` (contract C). Soccer (no calendar) still gets Standouts, Lightning, Circuit, Cups, Rivals, Daily.
- **NEW `src/ut/near-miss.ts`**: `nearMisses(ctx): Chip[]` (≤ 3, sorted by fraction remaining, each with a `GoTarget`): sets 1 card away, Circuit next milestone ("1 win to Finalist"), Rivals next division ("2 wins to Pro" = ceil(RP gap / 30)), daily bonus ("1 game to today's bonus"), Season Pass ("120 SP to level 7"), Standout objective ("2 Standout wins to a pick"), an Evolution ("1 game to apply"), Squad Battles next rung pack.
- **`src/ut/Hub.tsx` rebuild**, top to bottom: hero (art left: `PackArt` large / `SquadFan` / `ModeArt` / `UtCard`; eyebrow; Archivo condensed italic title; one line; one primary button ≥ 48 px); near-miss chip row; Live Now carousel (scroll-snap cards 264 px, countdown chip, SVG progress ring, edge fade); Rewards row with CLAIM ALL only when the hero is not already the claim action; Daily + Standouts tiles (kept); Season Pass ribbon with a "next 3 rewards" teaser (`seasonReward` of the next three levels with art); Upcoming strip; "Your club": squad OVR/CHEM fan (kept) and a 2×2 quick-tile grid (Store: packs to open, later the stamp meter; Challenges: objectives ready / SBCs; Squad: "upgrade available" when a club card outrates the starter at its position; Collection: closest set); Club Records (kept). New Era card and starter keep their place at the top.
- **`src/ut/ui.tsx`**: `Countdown` (formats "2d 4h" / "3h 12m" / "12m"; amber < 24 h; updates every 30 s; no ticking animation under reduced motion) and `ProgressRing`.
- **NEW `src/ut/hub.css`**: layered plate gradients, inner highlight, soft drop shadow, gold/teal glows, sheen on the hero (off under `prefers-reduced-motion`), `rise-in` stagger kept.
- All hub derivations memoised on `[ut, day, week, pool, minuteTick]`.

**Tests**
- `src/ut/next-action.test.ts`: one fixture per priority level (≥ 11 cases incl. done-for-today and the tie-break by recency), and "never shows done-for-today while anything is claimable".
- `src/ut/live-now.test.ts`: countdown math across Eastern midnight and across the 2026-11-01 DST change; amber at 23:59 left vs 24:01; soccer has no calendar items and no crash; every item's `view` exists in `nav.ts`.
- `src/ut/near-miss.test.ts`: ordering, ≤ 3 chips, Rivals wins math.
- `src/ut/soccer-hub.test.ts`: soccer next-action never routes to `league`/`events`/`moments`.

**Measurements / acceptance**
- Exactly one primary CTA in the hero; at 393×852 the hero, the near-miss row and the first Live Now card are above the tab bar (y < 852 − 96) in all 3 sports.
- Every carousel card, chip, tile and upcoming row navigates to the expected view (QA taps each and asserts the top-bar title) — 0 dead taps.
- 0 overflow, 0 clipped, 0 targets < 44, 0 text < 10 px at 393 and 320.
- Performance: with Playwright CDP CPU throttle ×4, the Hub's derivations take ≤ 30 ms (performance.measure around the memo) and add no long task > 50 ms (shell's whole-UT-open target is < 2.5 s with no task > 200 ms).
- Reduced motion: no running animations on the Hub (computed `animation-name` none on hero/sheen).
- Kept from §6: Rewards CLAIM ALL, Daily and Standouts tiles, squad fan, Club Records, Continue semantics.

**Screenshots:** UT Home × 3 sports × 393/320 for: new player (starter), claimables, run in progress, expiring item (amber), done-for-today; plus reduced-motion and the carousel scrolled.
**Protocol impact:** none.
**Save-compat risk:** none (read-only; CLAIM ALL uses the existing `claimAll`).
**Dependencies:** ut-1 (claimables, go, labels). packs (contract C; Program Hub view id when it exists; stamps tile). shell (header plate; UT open performance P-1).
**Files:** `src/ut/next-action.ts` (new), `src/ut/live-now.ts` (new), `src/ut/near-miss.ts` (new), `src/ut/Hub.tsx`, `src/ut/hub.css` (new), `src/ut/ui.tsx`, `src/ut/UltimateTeam.tsx` (Hub props), tests.

---

### ut-4 · P0 · Match flow integrity: solo pre-match screen (M13) and interrupted-match settlement (exploit)

**Changes: solo pre-match**
- `src/ut/Match.tsx`: for any setup with `online === null` (Squad Battles, Legends Events, Circuit, Club Season, Cups, UT Draft, and the Rivals AI stand-in from `goAI`), the stage after setup is a new `'pre'` stage that renders `PreMatch` and **waits** (no timer). Online keeps `vs` (2.8 s) → `Vote`. `autoplay` still goes straight to `play` (QA path unchanged).
- **NEW `src/ut/PreMatch.tsx` + `src/ut/prematch.css`**: eyebrow (label · difficulty · "Rung 3 of 8" / "Semi-final" / "Match 4 of 6" / "Game 2 of 4"); both `SideCard`s (top-3 fan, OVR, CHEM); AI skill name; **On offer**: coins for a win/loss (`matchRewards(won, pay)`) or "Today's 8 paid games are played" when capped, rung pack (`packName`), Circuit next milestone, Cup title prize (`CUP_PRIZES`), Season Points (played vs sim, from `recordMatchProgress` rules); **This match can advance**: up to 3 objective chips whose counter it moves (games/wins/points, Standout wins when the squad has Standouts, an active Evolution/Development card in the squad); buttons PLAY (primary, 56 px) and SIM (secondary; hidden for Circuit, Club Season and Cups, which are manual-only); back via the top bar.

**Changes: interrupted matches**
- **`src/ut/state.ts`** (additive): `live?: LiveMatch`, normalised in `migrateUt` (dropped if malformed):
  ```ts
  interface LiveMatch { id: string /* 'ut-ai:'+req.id */; kind: 'cup' | 'league' | 'circuit' | 'draft'; req: { cup?: CupRequest; league?: LeagueRequest; circuit?: { runId: string; round: number }; draft?: { runId: string; game: number } }; at: number; opponent: string; us: number; them: number; ends: number }
  ```
- **NEW `src/ut/live-match.ts`**: `startLive(ut, setup, at)`, `progressLive(ut, us, them)`, `clearLive(ut)`, `forfeitScore(us, them)` (= `them > us ? {us, them} : {us, them: us + pick({ nba: 2, nfl: 3, soccer: 1 })}`), and `resolveInterrupted(ut, pool, day, at): { ut; outcome: 'none' | 'not-started' | 'stale' | 'forfeit'; text?: string }`:
  - request no longer valid (run retired, round already settled, matchId in `ut.settled`) → clear, `stale`;
  - `ends === 0 && us === 0 && them === 0` → clear, `not-started`: the match is simply playable again from kickoff ("resume where possible"); nothing is recorded;
  - otherwise → settle a forfeit through the mode's own path (`settle` with `forfeit: true` for cup/league/circuit, `settleDraft` for the draft) and clear in the same transaction.
- **`src/ut/play.ts`**: `settle(..., { forfeit?: true })` → won = false, how 'played', 0 coins, 0 card XP, 0 SP, the record/run/league/cup/circuit advance as a loss; history entry gets `ff: true`. **`src/ut/hq-state.ts`**: `ClubMatch.ff?: true` kept by `normalizeHQ`. `ClubRecords` shows "FF".
- **`Match.tsx`**: when stage becomes `'play'` for those four kinds, `props.update(p => ({ ...p, ut: startLive(...) }))` (App's save effect persists it in the same commit); solo `onProgress` → `progressLive` only when the number of ended possessions changes; `finish()` clears `live` in the same update that settles; the draft branch likewise. If contract B's `onQuit` exists, solo quit → forfeit path.
- **`src/ut/UltimateTeam.tsx`**: when the pool is ready and `ut.live` exists, call `resolveInterrupted` once and show a centered sheet: "Match interrupted · Your Club Cups semi-final stopped at 12–18. Interrupted matches count as a forfeit, so rounds can't be replayed." (OK), or a toast "Your match hadn't started. It's ready to play again." Cup/Circuit/Season/Draft PLAY buttons are inert while `ut.live` is unresolved.
- A crash in menus (VS, pre-match, result, any UT screen) never writes a marker, so it is never punished.

**Tests**
- `src/ut/live-match.test.ts` (NBA + NFL) and `src/ut/soccer-live-match.test.ts`:
  1. Cup: marker after 1 possession → JSON round-trip through `migrateUt` (the "kill") → resolve → the round is a loss, the run is over, coins/XP/SP unchanged, history `ff`, same round not playable;
  2. Circuit: loss recorded at that round, next round active, entry count unchanged;
  3. Club Season: fixture settled once, cursor advanced once, AI matchday advanced once;
  4. UT Draft: run ends;
  5. 0–0 with no ended possessions → cleared, round still playable, nothing recorded;
  6. stale marker (finish already settled it) → no double settlement;
  7. no marker for Squad Battles, Legends Events or online;
  8. old-shape save without `live` loads identically; malformed `live` is dropped.
- `src/ut/prematch.test.ts` (pure helper `preMatchOffer(setup, ut, day)`): capped → "paid games played"; SIM hidden for manual-only kinds; objective chips match counters.

**Measurements / acceptance**
- Vote screen on solo games: before 3.0 s → ~13 s countdown (`vote.mjs`); after: 0 s, no countdown; PreMatch interactive ≤ 300 ms after setup.
- Exploit reproduction (`ut-studio.mjs interrupt`, NBA and soccer): start a Cup round, finish ≥ 1 possession, reload the page → before: same round shows PLAY; after: interrupted sheet, round recorded as a loss, coins unchanged.
- 0 overflow/clipped/small targets on PreMatch at 393 and 320.

**Screenshots:** PreMatch for Squad Battles, Cup, Circuit, UT Draft (3 sports, 393; NBA 320); capped variant; interrupted sheet; Club Records with an FF row.
**Protocol impact:** none. Only solo settlement changes; online H2H, `teams.ts`, ratings and `UT_RULES` are untouched. State this in ut.md.
**Save-compat risk:** new optional `ut.live`; an old client drops it (that client simply lacks the protection). Forfeits never remove cards, coins or receipts.
**Dependencies:** none blocking. Optional contract B from nba/nfl/soccer. Touches the ut-owned parts of shared `Match.tsx` (stage flow before play, result) only.
**Files:** `src/ut/Match.tsx`, `src/ut/PreMatch.tsx` (new), `src/ut/prematch.css` (new), `src/ut/live-match.ts` (new), `src/ut/state.ts`, `src/ut/play.ts`, `src/ut/hq-state.ts`, `src/ut/Clubhouse.tsx` (`ClubRecords` FF), `src/ut/UltimateTeam.tsx`, tests.

---

### ut-5 · P0 · End-of-match reward sequence (M3)

**Changes**
- **NEW `src/ut/match-recap.ts`**: `recapOf(before: UtState, after: UtState, settled: Settled, ctx: { day: string; pool: Pool; coinsBefore: number }): Recap`:
  ```ts
  interface Recap {
    coins: { from: number; to: number };
    sp: { season: string; from: number; to: number; levelFrom: number; levelTo: number; next?: { level: number; label: string; spLeft: number } };
    cards: { uid: string; name: string; cardId: string; levelFrom: number; levelTo: number; xpFrom: number; xpTo: number; need: number }[]; // played squad, level-ups first, max 6
    objectives: { id: string; title: string; from: number; to: number; target: number; done: boolean; claimable: boolean }[]; // only those that moved
    milestones: string[]; // rung pack, Circuit prize, Cup title, Event cleared
    nextUnlock?: string;  // "180 SP to Season Pass level 7: Gold Pack" / "1 more win: Finalist prize"
  }
  ```
  Computed in `finish()` from the `ut` it already reads (before) and `settle(...).ut` (after); stored on `Outcome.recap`.
- **Verdict** (`verdictOf(out, sport)` in `match-recap.ts`): higher score WIN, lower LOSS; level scores read `pick({ nba: 'TIE', nfl: 'TIE', soccer: 'DRAW' })` with a sub-line: penalties ("Penalties 4–3 · you go through") or the squad-rating tiebreak ("Squad rating tiebreak · counts as a win"). A level score never shows WIN in the headline. Settlement (`won`) is unchanged.
- **NEW `src/ut/match-ratings.ts`**: reads contract A (`box`) duck-typed; per-sport rating 1.0–10.0 when the engine gives none (NBA game-score scaled; NFL passer rating / yards+TD for skill players / tackles+sacks+INT for defenders; soccer goals, assists, shots on target, saves, tackles); MOTM = highest rating, ties to the winning side. No `box` → `null` → block hidden.
- **NEW `src/ut/MatchRecap.tsx` + `src/ut/match-recap.css`**, used by `ResultView` in `Match.tsx`. Beats (normal motion): t0 verdict + score count-up (400 ms) → t≈500 ms player ratings and MOTM card (`UtCard` of the MOTM) when present → t≈900 ms coin count-up (600 ms) and card XP bars with level-up pops → t≈1.5 s Season Pass bar fill with level-up burst and the reward name → t≈2.1 s objective ticks (completed ones get an inline CLAIM that calls `claimObjective` and bursts) → t≈2.6 s "Next unlock" line and ONE primary "What's next" button (existing `again` logic: NEXT RUNG / NEXT CUP ROUND / NEXT CIRCUIT MATCH / SEASON HUB, or "CLAIM 2 REWARDS" when the match unlocked claimables) with DONE as a secondary text button. Tap anywhere jumps to the final state. Reduced motion → final state immediately, no count-ups or bursts. Haptics: light tap on a level-up and on CLAIM (gesture-gated `vibrate`). Existing blocks (rung cleared, Event cleared, Draft run, Circuit prize, VIEW REWARD PACKS) fold into milestones. `MatchDebrief` stays below the sequence.
- The capped-day case shows "Today's 8 paid games are played" instead of a 0 count-up.

**Tests**
- `src/ut/match-recap.test.ts`: SP crossing a level (levelFrom/To and next reward), an objective completing, a card levelling up, capped day (coins equal), Circuit milestone, the TIE/LOSS/WIN verdicts.
- `src/ut/match-ratings.test.ts`: monotonic in each stat, MOTM is the max, empty/absent box → null, malformed values ignored.
- `src/ut/soccer-recap.test.ts`: 2–2 reads DRAW with the tiebreak line; 1–1 with `pens` reads DRAW + "Penalties"; never WIN for a level score.

**Measurements / acceptance**
- From result mount to the primary button visible: ≤ 3.0 s (normal), ≤ 100 ms (reduced motion); tap-to-skip ≤ 100 ms (Playwright timing).
- Soccer 2–2 result headline reads DRAW (before: WIN, `match-soccer-393-04-result.png`).
- One primary button on the result; 0 overflow/clipped/small targets at 393 and 320.
- `MatchDebrief` still renders with the same metrics.

**Screenshots:** result win/loss (NBA, NFL), draw (soccer) at 393 and 320; a level-up + SP level crossing; an objective completing with inline CLAIM; reduced-motion final state; with an injected `box` fixture (ratings + MOTM) and without.
**Protocol impact:** none (presentation of settled data; draw wording only). If the soccer team changes how UT draws settle (shootouts), that is their soccer UT bump; this screen already reads `pens`.
**Save-compat risk:** none (no new saved state; inline CLAIM uses existing receipts).
**Dependencies:** ut-4 (Match.tsx stage changes land first), ut-3 (`next-action` reused for the What's next label), contract A from nba/nfl/soccer for ratings (works without it), players' `UtCard`.
**Files:** `src/ut/match-recap.ts` (new), `src/ut/match-ratings.ts` (new), `src/ut/MatchRecap.tsx` (new), `src/ut/match-recap.css` (new), `src/ut/Match.tsx` (`finish`, `Outcome`, `ResultView`), tests.

---

### ut-6 · P1 · Objectives in layers, Scout Reveal, and objective placement

**Changes**
- **Versioning (save safety):** `objectives.ts` gets `OBJ_V2_FROM` (an Eastern date the lead sets at release; default the first Monday after merge). Days before it keep the legacy `DAILY` defs and weeks before its ISO week keep the legacy `WEEKLY` defs, so banked unclaimed objectives and their claim ids never change meaning. v2 objectives use new ids under the same `daily:<day>:<id>` / `weekly:<week>:<id>` pattern (no collision).
- **New counters** (`hq-state.ts` `COUNTERS`, additive; `normalizeHQ` picks them up automatically): `skill` (per-sport, counted from the match's own ends: NBA `'3'`, NFL `'TD'`, soccer `'G'`), `circuitWins`, `cupWins`. `settle` (`play.ts`) gets an optional `ends?: string[]` input (Match passes `us.ends`), and `recordMatchProgress` adds `skill`/`circuitWins`/`cupWins` deltas.
- **Daily v2 (3, done in ≤ 3 matches):** play ("Play 2 matches", games 2), skill (`pickFor`: NBA "Hit 4 threes", NFL "Score 2 touchdowns", soccer "Score 2 goals"), club task rotating by a day hash ("Open a pack" / "Complete an SBC" / "Win a match"). Reward 100 coins each + SP (80 SP on v1-season days, 200 SP on v2-season days, see ut-7). This also fixes today's soccer bug: "Score 24 points" in a day is unreachable in soccer (≈ 10 matches at ~2.5 goals).
- **Scout Reveal** (all three dailies done; replaces the all-three bonus on v2 days, same claim `daily-bonus:<day>` and pack id `daily-bonus:<sport>:<day>`, so it can't double-pay): NEW `src/ut/scout-reveal.ts` + `src/ut/ScoutReveal.tsx`. Starts as today's bonus (Silver Pack + 100 coins); three taps, each a chance to upgrade: Silver → Gold 35%, → Premium Gold 25%, → Jumbo Premium 15%. Final odds shown before the first tap: Silver 65.0%, Gold 26.25%, Premium 7.44%, Jumbo 1.31%. Outcome seeded by `hashString('scout-reveal:' + sport + ':' + day)` (reload can't reroll). Each tap 600 ms with a rising pitch; tap-to-skip resolves all three; reduced motion shows the result. Coins only.
- **Weekly v2 (6, Monday):** Play 8 matches; Win 5; Complete 2 SBCs; Win 2 Champions Circuit matches (`circuitWins`); Open 3 packs; Win a Club Cup round (`cupWins`; soccer has Cups). Each 150 coins + SP. **Chests:** 4/6 → Premium Gold Pack (`weekly-chest:<week>:4`), 6/6 → Scout's Choice pick (`weekly-chest:<week>:6`), plus a Program Key if packs ships one (contract D). Claimed through the inbox and the Objectives view; counted by `claimables.ts`.
- **Program objective groups** (NEW `src/ut/program-objectives.ts`): while a calendar promo is live (`promosOn`), a group of 4 objectives scoped to the wave's dates (play 6, win 3, open 2 packs, complete 1 SBC; counted from `hq.days` within the window); group complete → a Program pick (1 of 3 of that promo's released cards via `promoCards`, seeded by the claim id `program-group:<promoId>`, deposited with `addPick`). Shown as a section in Objectives and as a Live Now card. NBA/NFL now; soccer when packs ships its calendar.
- **Card-attached signature objectives:** only with contract A data (`box`): 1 per active Evolution card ("Score 60 points with <name>", "6 TD passes", "5 goals"), progress per owned copy in `content.evo`-adjacent state `hq.signature?`. If `box` is not on `Progress` at merge, this item is deferred (see §6) and the code path is not shipped.
- **Placement:** PlayHQ mode tiles show up to 2 objective chips ("Win 1 · daily", "1 win → Finalist"); PreMatch (ut-4) lists the objectives the match advances; the end-of-match sequence (ut-5) ticks and claims them. In-match HUD chip: deferred (§6).
- `Clubhouse.tsx` `ObjectivesView`: groups DAILY · WEEKLY (with the 4/6, 6/6 chest bar) · PROGRAM · CLUB · SAVED; `DailyHubView.tsx`: the Scout Reveal tile replaces the bonus row on v2 days.

**Tests**
- `src/ut/objectives-v2.test.ts`: a legacy day keeps legacy defs, banked legacy rewards still claim once; v2 day has 3 objectives; chests claim once each; program group pick once and its options are 3 released cards of that promo; new counters normalise from old saves (absent → 0).
- `src/ut/scout-reveal.test.ts`: 100,000 seeds → each final-odds bucket within ±0.5 points of 65.0/26.25/7.44/1.31; the same day/sport always gives the same result; exactly-once deposit.
- `src/ut/soccer-objectives.test.ts`: soccer skill objective and targets.
- **Doability measurement** (`scripts/ut_daily_sim.ts`, run with `bash O/heavy.sh npx vite-node scripts/ut_daily_sim.ts`): 200 seeded AI-played matches per sport at Pro skill through the existing sims (`aiPossessionsOf`, `aiDrivesOf`, soccer `aiProgress`); target ≥ 80% of 3-match sessions complete all three v2 dailies (the club task assumed done). Tune targets until it passes; record numbers in ut.md.

**Measurements / acceptance**
- Daily v2 completion within 3 matches ≥ 80% per sport (measured above).
- Scout Reveal odds shown = simulated within ±0.5 points.
- No banked legacy objective changes meaning (fixture test).
- PlayHQ tiles show chips without growing tile height beyond today's 2 lines at 320.
- Coin-flow line in ut.md: daily objective coins 200 → 300/day; daily bonus EV in pack price 400 → ≈ 670/day (0.65 × 400 + 0.2625 × 900 + 0.0744 × 1,800 + 0.0131 × 3,200; +100 coins unchanged); weekly 250 coins + Gold + Silver → 900 coins + Premium Gold + Scout's Choice.

**Screenshots:** Objectives (daily/weekly with chests/program), Daily with Scout Reveal before/after taps, PlayHQ tiles with chips, PreMatch chips (3 sports, 393; NBA 320).
**Protocol impact:** none (rewards and counters only).
**Save-compat risk:** handled by date-versioned defs; new counters additive. An old client loading a save drops unknown counters (transitional, same as every additive field).
**Dependencies:** ut-1, ut-4 (PreMatch), ut-5 (recap ticks). packs (contract D: `promoCards`, Program Key; soccer calendar). nba/nfl/soccer (contract A for signature objectives).
**Files:** `src/ut/objectives.ts`, `src/ut/hq-state.ts`, `src/ut/progression.ts`, `src/ut/play.ts`, `src/ut/Match.tsx` (pass ends), `src/ut/daily-hub.ts`, `src/ut/scout-reveal.ts` (new), `src/ut/ScoutReveal.tsx` (new), `src/ut/scout-reveal.css` (new), `src/ut/program-objectives.ts` (new), `src/ut/DailyHubView.tsx`, `src/ut/Clubhouse.tsx`, `src/ut/inbox.ts`, `src/ut/claimables.ts`, `src/ut/PreMatch.tsx`, `scripts/ut_daily_sim.ts` (new), tests.

---

### ut-7 · P1 · Season Pass v2 from the next season, Season Pass hero (M10), competitive pay

**Changes: Season Pass**
- **NEW `src/ut/pass.ts`**: `PASS2_FROM` (season number; default 2 = 23 Nov 2026; the lead confirms it at release so it is a season that has not started on any client) and `schemeOf(seasonNumber, ut)`: a season is **v2** only if `number ≥ PASS2_FROM` **and** it has no v1 record with xp > 0 or claims (a season already started under v1 finishes under v1). v1 = 25 × 300 SP, existing rewards. v2 = 30 × 1,000 SP, level 1 granted at season start (the record is created with xp 1,000 on first touch), overflow every 1,500 SP after 30,000 = one Gold Pack, max 10 per season.
- **Storage:** v2 seasons live in a new optional `hq.pass2?: Record<'season:<n>', { xp: number; claimed: number[]; overflow: number }>` (normalised in `normalizeHQ`: xp ≤ 45,000, claimed 1–30, overflow ≤ 10). v1 data in `hq.seasons` (caps 7,500/25) is untouched. A separate store means an older client can never read v2 SP as 25 v1 tiers and claim old-scheme rewards from it.
- **Routing in `progression.ts`:** `addSeasonXP`, `claimSeason`, `claimReadySeason`, `seasonReward(tier, scheme)`, `seasonReady`, `readyRewards`, and `inbox.ts` `seasonsReady`, `claimables.ts` go through `pass.ts`. v2 SP rates: played match 120 (+40 win), sim 40 (+10), online +20 (within the existing 16-matches/day SP cap); other `addSeasonXP` grants ×1.5; objective SP per ut-6.
- **v2 rewards** (existing pack kinds and picks only): 1 Gold; 2 Gold; 3 300 coins; 4 Premium; 5 Standout pick; 6 Premium; 7 Premium; 8 Gold + 250 coins; 9 400 coins; **10 Season card A**: Program pick (1 of 3 of the season's calendar programs; soccer: Elite Gold Pack); 11–13 Gold/Premium/500 coins; 14 Jumbo Premium; 15 Scout's Choice; 16–19 Premium/Gold/600 coins/Premium; **20 Season card B**: featured Program pick (soccer: Elite); 21 Jumbo; 22 Premium; 23 800 coins; 24 Elite Gold; **25 Program pick**; 26 Premium; 27 Jumbo; 28 1,000 coins; 29 Elite Gold; **30 Season Headliner**: 1 of 3 of the season's top featured program cards + 1,000 coins (soccer: Elite Gold + 1,000 coins). Overflow: Gold Pack per 1,500 SP, ≤ 10.
- **Presentation (M10)** in `SeasonView` and `SeasonRibbon` (`Clubhouse.tsx`), NEW `src/ut/season-pass.css`: a hero with the top reward's art from day 1 (v2: the Headliner option faces via `UtCard`; v1 season 1: the level-25 Spotlight Pack, soccer Elite Gold, via `PackArt`) and the countdown to season end; "N levels to <named reward>" (goal gradient points at the next named reward, research §8.7); the track opens centred on the current level; a "next 3 rewards" strip; the overflow row after 30; claim buttons with feedback. The empty space below the track (`42-ut-ch-season-pass.png`) is gone. Hub teaser (ut-3) shows the next 3 rewards.

**Changes: competitive pay (coins only)**
- **Champions Circuit** (`circuit.ts`): `CIRCUIT_WIN_COINS = [40, 50, 60, 70, 80, 100]` by round, paid inside `settleCircuit` in the same transaction (the settled matchId is the receipt); milestones 2/4/6 unchanged; a 6-0 run adds a Scout's Choice pick (`circuit:<week>:perfect`). `CircuitView` shows the per-win ladder.
- **Rivals weekly** (`rivals.ts`): rewards at 5 and 10 weekly wins, ids `<week>:w5`, `<week>:w10`, coins only: 250 / 500 × division factor (Rookie 1, Pro 1.25, All-Star 1.5, Elite 2, Legend 2.5). `RivalsReward` gains `kind?: 'wins'` and a stored `coins`; `rivalsOf` keeps the stored coins for `kind: 'wins'` (division rewards keep today's recomputation). `Rivals.tsx` shows the weekly wins track. Claimed through `claimRivals`/inbox as today.
- **Coin-flow estimate** (documented in ut.md, before → after, NBA prices): engaged hour ≈ 8 paid matches. Before: 8 × 30–60 = 240–480 coins/day from matches + Circuit milestones up to 1,250/week. After: + Circuit per-win up to 400 per entry (≈ 200 at a typical 3.5 wins; ≤ 1,200/week at 3 perfect entries) + Rivals weekly ≤ 750 × factor. Typical engaged player ≈ +65 coins/day (Circuit, 2 entries/week at 3.5 wins ≈ 225 each) + ≈ +45/day (Rivals 5-win reward at Pro, 312/week) ≈ +110/day ≈ +27% over the 400/day the economy test assumes; `economy.test.ts` bounds unchanged. The engineer re-derives these with real match lengths and records them in ut.md.

**Tests**
- `src/ut/pass.test.ts`: the v1 fixture (Season 01, 2,400 SP, tiers 1–5 claimed) is byte-identical through migration and claims; a season with a v1 record stays v1 even when ≥ `PASS2_FROM`; v2 starts at level 1; 30 levels; overflow pays ≤ 10; every v2 claim exactly once; `normalizeHQ` caps; **pacing simulation**: casual (3 played matches/day, all dailies, half the weeklies) reaches level 30 on day 24–25 (±2), engaged (8 matches, all dailies and weeklies, program objectives) on day 13 (±2) — research §8.7.
- `src/ut/competitive-pay.test.ts`: Circuit pays each round once (replayed/stale settlement pays 0), perfect pick once; Rivals 5/10 once per week, old division rewards and their coins unchanged, a reload keeps receipts.
- `src/ut/soccer-pass.test.ts`: soccer v2 rewards contain no program picks or Spotlight.

**Measurements / acceptance**
- Season Pass at 393×852: hero with art and countdown above the fold; no empty band below the track (content fills to the tab bar or scrolls).
- Pacing targets above; coin-flow table in ut.md.
- No change to any v1 season's xp, claims or rewards (test).

**Screenshots:** Season Pass v1 (today) hero and track; v2 via a fixture date in season 2 (hero, endowed level 1, level 10/20/30 named rewards, overflow); Hub teaser; Circuit per-win ladder; Rivals weekly track (3 sports, 393; NBA 320).
**Protocol impact:** none (rewards only; Rivals points and boards unchanged).
**Save-compat risk:** v2 in a new optional field; v1 untouched; `PASS2_FROM` must be a not-yet-started season (lead). Old clients drop `pass2` (documented, as for every additive field).
**Dependencies:** ut-1, ut-6 (objective SP tables). packs (contract D for program picks).
**Files:** `src/ut/pass.ts` (new), `src/ut/progression.ts`, `src/ut/hq-state.ts`, `src/ut/inbox.ts`, `src/ut/claimables.ts`, `src/ut/Clubhouse.tsx` (`SeasonView`, `SeasonRibbon`, `CircuitView`), `src/ut/season-pass.css` (new), `src/ut/circuit.ts`, `src/ut/rivals.ts`, `src/ut/Rivals.tsx`, `src/ut/Hub.tsx` (teaser), tests.

---

### ut-8 · P1 · Retention hooks and the first-run funnel (M7)

**Changes**
- **Streak warning + weekly shield** (NEW `src/ut/streak.ts`; `content-packs.ts` stays untouched): `streakView(ut, day, now)` wraps `dailyStatus` and adds `atRisk` (drop ready, streak ≥ 2, ≤ 4 h to Eastern midnight), `hoursLeft`, `shieldReady`, `shielded`. Shield: one per ISO week, state `hq.shield?: { week: string; used?: string }` (additive, normalised). When the last claim was exactly two days ago and this week's shield is unused, `applyShield(ut, day)` bridges `content.daily.day` to yesterday before `claimDaily`, so the streak continues; used by every claim path (`UltimateTeam.tsx claimDailyDrop`, `inbox.ts claimAll`). UI: amber clock + "Claim before midnight ET or your Day 5 streak resets" on the Hub Daily tile, DailyHubView and the main Home strip; a shield pip on the streak row ("Weekly shield ready" / "Streak saved by your shield").
- **Account XP and level-up inside UT** (`Match.tsx`, NEW `src/ut/LevelUp.tsx` + css): a paid UT match grants account XP (`profile.xp`): played +20 (+10 win), sim +5, within the 8 paid games/day; each account level gained pays `LEVEL_UP_COINS` (50) like the draft and unlocks boosters as today (`unlockedAt`). The end-of-match sequence (ut-5) gets a level-up beat with the same visual language as `Results.tsx`; UT Home shows it once if a level was gained elsewhere in UT.
- **Exit teaser** (`UltimateTeam.tsx` EXIT): a non-blocking toast after leaving: "Tomorrow: Daily Drop Day 3 of 7 · Calendar Day 4: Gold pick" (from `streakView` and `calendarStatus` for tomorrow).
- **Starter objectives chain** (NEW `src/ut/starter.ts`): 4 steps for new UT players, each paid once (`starter:<n>` in `hq.claims`): 1 open your free pack (200 coins), 2 set your squad (all starters filled; Silver Pack), 3 win a Squad Battle (Gold Pack), 4 complete your first SBC (Premium Gold Pack). Offered only when `ut.packsOpened ≤ 1 && record.w + record.h2hW === 0` at first sight (existing players are never paid retroactively); shown as the hero's step 0 (ut-3) and a compact chain card until done.
- **First run** (`App.tsx` modal order, `src/ui/Welcome.tsx`, `src/ui/Rewards.tsx`): Welcome perks add "Build an Ultimate Team: open packs, collect legends, play squad matches". For a brand-new player (no draft history, no UT cards, tester gift not yet collected) the tester gift and the Day 1 chest become one sheet: "Welcome gift · 9,000 coins + Day 1 chest" with COLLECT ALL (claims both with their existing ids: `TESTER_GIFT.id` into `gifts`, `rewardDay`/`nextStreak` as today) and "OPEN YOUR FREE STARTER PACK" (collects, then `openUtAt('hub')`). Existing testers who haven't collected keep the "Thank you for testing" copy. Fav prompt and admin gifts keep their order.

**Tests**
- `src/ut/streak.test.ts`: warning window; shield bridges one missed day once per week; two missed days reset; shield not consumed when unnecessary; old save without `shield` loads; claim paths (direct and CLAIM ALL) agree.
- `src/ut/starter.test.ts`: step detection, exactly-once claims, hidden after completion, never offered to an existing player.
- `src/ut/account-xp.test.ts`: XP per settled match once (duplicate matchId pays 0), capped day pays 0, level-up coins once.
- `src/ut/soccer-retention.test.ts`.
- Browser (`ut-studio.mjs firstrun`): fresh profile → name → teams → one welcome sheet → COLLECT ALL → coins +9,000 +25, `gifts` contains `testers-2026-10`, `rewardDay` = today; starter CTA lands on UT Home with the starter hero.

**Measurements / acceptance**
- First run: stacked modals before Home 2 → 1; UT mentioned on Welcome and the sheet.
- Streak warning visible only in the last 4 h (fixture clock).
- Exit toast appears and does not delay leaving UT (≤ 1 frame).
- Coin-flow addition documented (account level-ups ≈ +50 coins per level).

**Screenshots:** Welcome step 1 (perks), welcome sheet (393/320), Hub Daily tile with amber warning, DailyHubView shield pip, level-up beat on the result, starter chain on UT Home, exit toast.
**Protocol impact:** none.
**Save-compat risk:** `hq.shield` additive; the shield rewrites `content.daily.day` to yesterday only at claim time with the shield receipt (documented). Gift/chest ids unchanged.
**Dependencies:** ut-1, ut-3 (hero step 0), ut-5 (recap beat). shell (Welcome/first screens' top inset).
**Files:** `src/ut/streak.ts` (new), `src/ut/starter.ts` (new), `src/ut/LevelUp.tsx` (new), `src/ut/level-up.css` (new), `src/ut/hq-state.ts`, `src/ut/UltimateTeam.tsx`, `src/ut/inbox.ts`, `src/ut/Hub.tsx`, `src/ut/DailyHubView.tsx`, `src/ut/Match.tsx`, `src/ut/claimables.ts`, `src/App.tsx` (modal order), `src/ui/Welcome.tsx`, `src/ui/Rewards.tsx`, `src/ui/UtBridge.tsx`, tests.

---

### ut-9 · P1 · Beautiful, clear UT screens: visual system, long pages, collection

**Changes**
- **Components** (`src/ut/ui.tsx`) and NEW `src/ut/ut-system.css` (tokens for plate depth, glows, chip materials; Archivo condensed italic + teal/gold kept): `SectionTitle`, `RewardChip` (mini `PackArt`/coin/card + label), `Countdown` (from ut-3), `ClaimButton` (on success: `sfx.coin`, gesture-gated `vibrate([20, 40, 20])`, a CSS spark burst; none under reduced motion), `StickyChips`, `Collapsible`, refined `EmptyState`. Apply across Inbox, Daily, Objectives, Season Pass, Sets, Collection, Development, Evolutions, Records, Play, Circuit, Cups, Rivals, Moments, Events, Draft (layout and classes only; no behaviour change).
- **Development (M4)** (`Clubhouse.tsx` `DevelopmentView`): a summary header (active program card, progress, CLAIM/PLAY); the "select your owned copy" grid moves into a bottom `Sheet` picker with search (data-sheet-noswipe on the grid); Evolutions Lab row stays first.
- **Collection (M4, M5, M12)** (`CollectionGallery.tsx`): header leads with the three closest sets ("1990s Bulls · 7/8 · 1 card away" → GO) and per-tier completion bars; "39 / 22,082 editions" becomes a footnote; filters collapse behind one sticky chip row. M12: the tier list includes the resolvable special editions (Weekly Standouts of weeks seen via `standoutProgram`, Landmarks via `landmarkCards`, started live programs via `promoCards`; all stable ids, read-only use of packs' modules), and any tier that still has 0 editions is hidden; missing cards render in full colour at 40% opacity with an SVG lock (CSS around `UtCard`, not a change to the face) so each promo's design is the lure.
- **Sets** (`SetsView.tsx`): summary header (ready / near / done counts).
- **L3** (`Events.tsx`): mask edge fade and a "more" chevron on the series tab row. **L9** (`Battles.tsx`): when club OVR exceeds the ladder's top rung by ≥ 8, a nudge "Your squad outclasses Rookie. Try All-Star (×1.6 coins)" with one tap to switch level (existing `onLevel`). **L4** (`SquadView.tsx`): two-line name plates for long names; fix the NFL OL row overlap at 320 (`nfl-320/27-ut-squad.png`). **L2**: ut-owned text under 10 design px raised (login-calendar day labels in DailyHubView, mission difficulty pills in Rewards.tsx, "NEW" tags in ut screens).

**Tests**
- `src/ut/collection-goals.test.ts`: closest-sets ordering; special tiers non-empty for a pool with standouts/landmarks; empty tiers hidden; `src/ut/soccer-collection.test.ts` (soccer has no Landmarks/programs → those chips hidden).
- `src/ut/battles-nudge.test.ts` (pure helper `recommendedLevel(clubOvr, ladder)`).

**Measurements / acceptance** (walk metric = content height / viewport, `report.json` "scroll")
- Development: 4.8 (NBA) / 6.1–6.2 (NFL) / 5.5 (320) → ≤ 2.0 at 393 and ≤ 2.5 at 320.
- Collection: 3.4 / 4.0 → ≤ 2.5 / ≤ 3.0.
- 0 Collection tier chips showing "0 editions" (before: LANDMARK, PROGRAM, STANDOUT always 0).
- ut-owned text < 10 design px: 0; targets < 44: 0; reduced motion: no running animations on these screens.

**Screenshots:** before/after Development, Collection (incl. a LANDMARK/STANDOUT filter and the missing-card look), Sets, Evolutions, Battles nudge, Events tabs edge, NFL Squad at 320, Daily calendar, plus one contact sheet per sport (`sheet.py`) of all ut screens.
**Protocol impact:** none (UI only; the nudge only changes which difficulty the player picks).
**Save-compat risk:** none.
**Dependencies:** players (`UtCard`; the opacity/lock overlay wraps it), packs (`landmarkCards`, `promoCards`, `standoutProgram` read-only; Challenges/Store/Standouts styling is theirs), shell (header plates).
**Files:** `src/ut/ui.tsx`, `src/ut/ut-system.css` (new), `src/ut/Clubhouse.tsx`, `src/ut/CollectionGallery.tsx`, `src/ut/SetsView.tsx`, `src/ut/Events.tsx`, `src/ut/Battles.tsx`, `src/ut/battles.ts` (pure helper), `src/ut/SquadView.tsx`, `src/ut/DailyHubView.tsx`, `src/ui/Rewards.tsx`, ut CSS files (`clubhouse.css`, `content-ui.css`, `nav.css`, `play-hq.css`, `cup.css`, `league.css`, `storage.css`), tests.

---

### ut-10 · P2 + final QA · Labels sweep (H6), every-tap walk in three sports, full verification

**Changes**
- **Labels sweep:** route every remaining ut-owned visible mode name through `labels.ts` with no wording change: `Hub.tsx`, `Clubhouse.tsx` (PlayHQ titles, ObjectivesView, SeasonView), `inbox.ts`/`InboxView.tsx` titles, `Rivals.tsx`, `CupView.tsx`, `LeagueSeason.tsx`, `Moments.tsx`, `Events.tsx`, `DraftView.tsx`, `EvolutionsView.tsx`, `SetsView.tsx`, `CollectionGallery.tsx`, `UltimateTeam.tsx` toasts, `Pages.tsx` ("ULTIMATE TEAM" tab, Profile card), `UtBridge.tsx`, `Welcome.tsx`. List the strings owned by other teams in ut.md for a later rename (`PackArt` "UT", `Challenges.tsx`/`Store.tsx` SBC wording, `CardDetail.tsx` "2K/Madden reference" link text).
- **Walk** (`scripts/qa/ut-studio.mjs walk <sport> <width>`): every UT tab, segment and sub-screen, PreMatch, a played-out result (autopilot ×8), the interrupted sheet, main Home/Profile/Missions/Gauntlet, in NBA, NFL and soccer at 393×852 (59/34) and 320×568. Automated checks per screen: horizontal overflow, clipped text, targets < 44 (counting `::before`), text < 10 px, contrast < 4.5 for text, topmost control below the shell's edge clearance when present, page errors, and a **dead-tap detector** (click every enabled button/link; flag any that changes neither the DOM nor the view within 600 ms, except toggles that change `aria-pressed`/`aria-expanded`). Contact sheets per sport to `O/shots/ut/final/`.
- **Full verification:** `bash O/heavy.sh npm run typecheck`; `bash O/heavy.sh npm test` (all three sports, once); `bash O/heavy.sh npm run build` (once) and compare the entry chunk size to `acdf3e2` (UT code must stay lazy); fix what the walk finds.
- **Docs:** finish `docs/studio-overhaul/ut.md` (before/after numbers per task, tests, "Protocol bump needed" = none with reasons, "Touched outside my lane", owner device checks, coin-flow table, deferred list); update `docs/UI-NAVIGATION.md` (hub, PreMatch, GO links, badges) and add the studio section to `docs/UT-OVERHAUL.md`.

**Tests:** `labels.test.ts` snapshot unchanged (wording identical); the full suite.

**Measurements / acceptance**
- Walk: 0 dead taps, 0 overflow, 0 clipped, 0 ut-owned targets < 44, 0 ut-owned text < 10 px, 0 page errors, in 3 sports × 2 sizes.
- `npm test` passes in NBA, NFL and soccer; `npm run build` passes; entry chunk growth ≤ 2 KB gzip vs `acdf3e2`.
- ut.md complete; every deferred item listed with its reason.

**Screenshots:** the full walk (all screens, both sizes, 3 sports) and contact sheets.
**Protocol impact:** none.
**Save-compat risk:** none (strings only). Final check: an old-shape save fixture from `acdf3e2` (each sport) loads with every coin, card, level, XP, squad, streak, receipt and season intact (`src/ut/studio-compat.test.ts`, plus `soccer-studio-compat.test.ts`).
**Dependencies:** all previous tasks.
**Files:** the label call sites above, `scripts/qa/ut-studio.mjs`, `src/ut/studio-compat.test.ts` (new), `src/ut/soccer-studio-compat.test.ts` (new), `docs/studio-overhaul/ut.md`, `docs/UI-NAVIGATION.md`, `docs/UT-OVERHAUL.md`.

---

## 5. Order and dependencies

```
ut-1 ─┬─ ut-2 ─────────────┐
      ├─ ut-3 ─┐           │
      │        ├─ ut-5 ─┬─ ut-6 ─ ut-7 ─ ut-8 ─ ut-9 ─ ut-10
      └─ ut-4 ─┘        │
```

P0: ut-1 (enabling), ut-2, ut-3, ut-4, ut-5. P1: ut-6, ut-7, ut-8, ut-9. P2/QA: ut-10. ut-2 and ut-4 can run in either order after ut-1; ut-5 needs ut-4's Match.tsx stage changes and ut-3's next-action.

## 6. Deferred (with reasons)

| Item | Reason |
|---|---|
| Depth Gauntlet every two weeks (P2) | A new mode (3 rounds × 3 distinct lineups, new lineup validation and settlement). Lowest priority in the brief ("if time permits"); P0/P1 first. It can reuse `cup.ts` machinery later. |
| Card-attached signature objectives | Needs per-player match data (contract A). Shipped in ut-6 only if `Progress.box` exists at merge; otherwise deferred, no fabricated stats. |
| In-match HUD objective chip | The HUD belongs to the sport teams (`render.ts`/HUD). ut shows objectives pre-match and post-match; a `trackedObjective?: string` prop is offered in ut.md. |
| Resume an interrupted match mid-game | The engines keep no restorable state; "resume" is offered where possible (not started → replay from kickoff). An AI-finish from the saved score would need the takeover helper in `Arcade.tsx` (nba/nfl) and soccer; requested in ut.md. |
| Squad Battles rung-1 opponent floor (M3) | Changes the weekly ladder shape that `match.test.ts` asserts; L9's difficulty nudge (ut-9) addresses the blowout without changing ladders. |
| Squad Battles 4 opponents / weekly ranks, Solo Run, Rivals Bounties, breakable checkpoints, season milestones, tiered lifetime achievements (research §8.6, §8.9) | Not in the ut brief's scope list; they change mode structures. Recorded for a later round. |
| Push "Your Daily Drop is ready" (hook 11) | Needs a push backend; live services are off limits. |
| How-to carousel (§4 "How to play") | `HowToSheet` in `Pages.tsx` is not assigned to ut in OWNERSHIP.md; flagged to the lead. |
| Draft "DM/CM" legend, Ranks offline L8 | Not UT screens (draft screen, Ranks page); flagged to the lead. |
| Program Hub page, Scout Stamps, Program Bag/Keys, Headliners pack | packs' scope; ut consumes them through contracts C/D when they land. |
| Mode rename (H6) | Owner decision; labels are centralised so it is one edit later. |
| Main-app daily chest streak shield | The chest is claimed on every app open (`DailyReward`), so the risk is low, and its state lives in the shared profile schema (`src/lib/profile.ts`, lead). The shield ships for the UT Daily Drop streak. |

## 7. Protocol summary

No change in this plan alters match physics, ratings used in matches, `teams.ts`, online pairing or how an online UT result is decided. Solo forfeits, pre-match screens, rewards, objectives, Season Pass and presentation are local. Expected ut.md line: "Protocol bump needed: none from team ut." If the soccer team changes how UT draws settle, that bump is theirs.

## 8. Owner device checks (to list in ut.md)

- Main tab badge and Home strip: feel, placement under the Dynamic Island fix, and whether the home-screen icon badge (`setAppBadge`) appears.
- Post-match sequence length (≈ 3 s) and tap-to-skip.
- Haptics on CLAIM, level-ups and the Scout Reveal taps (gesture-gated iOS vibration).
- Interrupted-match sheet after force-quitting during a Cup round.
- First-run welcome sheet on a fresh install.
