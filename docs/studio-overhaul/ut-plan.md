# Team ut build plan: Ultimate Team menus, hub, objectives, rewards loop, results

Planner output, revision 2, 2026-11-09. Worktree `/home/user/ps-s-ut`, branch `claude/studio-ut` (cut from `acdf3e2`), dev-server port 5212. Build engineers follow this plan task by task, in order. Every task updates the running record `docs/studio-overhaul/ut.md`: what changed, measurements, "Protocol bump needed", "Touched outside my lane", owner device checks and the integration checklist. ut-0 creates that file.

`O` = `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full:** `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-ut.md`, `O/audit-ut-ui.md`, `O/research-ultimate-team.md`, `CLAUDE.md`, and the UT docs (`UT-OVERHAUL`, `UI-NAVIGATION`, `OVERHAUL-REWARDS`, `OVERHAUL-UX`, `UT-POLISH`, `UT-CLUB-SEASON`, `OVERHAUL-CUP`), plus the code they point to.

**Read for this revision:**
- The other teams' committed plans, read from their branch objects with `git show claude/studio-<team>:docs/studio-overhaul/<team>-plan.md`; no other worktree was touched.
- `STREAM-nba/nfl/soccer/shell/packs.md`.
- `state.ts migrateUt`, `hq-state.ts normalizeHQ`, `rivals.ts rivalsOf`, `play.ts settle`, `Match.tsx` and `Pages.tsx HomePage`.

**What revision 2 changes.** This revision answers the independent critique point by point; §13 maps each point to where it is handled, or says why it is rejected.
- **New ut-0** for the QA harness, the old-save fixtures and the visual kit.
- **Mixed-client save rule.** A save-safety design (§2) keeps new receipts readable by old clients.
- **Contracts match the sport teams' published hooks:** defense preference, `how`/`simmed`, overtime, box score, quit, and shell's arena curtain.
- **Packs' published API is used** (`promo-hub.ts`, the `program` view, a launch slot).
- **Interrupted matches** are finished by seeded simulation instead of an automatic forfeit.
- **One coin and pack flow table** (§7), given per hour and per day.
- **Deviations from the research** are documented.
- **An integration checklist** for the lead (§10).
- **Stamp-based switch-over** replaces hard-coded release dates.
- **Ten session-sized tasks.** Scope was trimmed: Season Pass v2 and program objective groups are deferred with reasons (§8).

---

## 1. Goals

The owner wants Ultimate Team to look, play and feel like a production UT: "lead players to places", "good objectives and rewards", "attract dopamine", "all menus work and taps and movements all work good", "detailed and beautiful". When this team is done:

1. **Nothing is a dead end.**
   - The landing screen shows what UT has waiting, with a badge, a Home pill and an app-icon badge where iOS allows.
   - Every progress surface has a GO button to the exact screen where the task is done.
2. **UT Home is a hub with one obvious next step:**
   - a "Next best action" hero, chosen by a fixed priority list with claimables first;
   - a Live Now carousel with countdowns (built on packs' `promo-hub.ts`);
   - an Upcoming strip, near-miss chips, "new" dots, an amber clock in the last 24 h, and an honest "done for today" state.
3. **Every match ends on a reward sequence:**
   - the result first: OT, penalties and draws are labelled correctly, and a level score never reads WIN;
   - then player ratings and a man of the match, from the sport teams' real box data;
   - then coins, card XP, account XP, Season Pass, Rivals points and objective ticks animating;
   - then one "What's next" button.
4. **Solo play is honest and quick:**
   - a pre-match screen with the matchup, a defense choice (owner decision 2), the expected length (owner decision 3), PLAY and SIM;
   - no 10 s online vote;
   - killing the app mid-match can no longer replay a Cup, Circuit, Club Season or UT Draft game, and an honest eviction is finished by simulation instead of a forfeit.
5. **Progression has depth** (P1):
   - daily objectives that can be done in about 3 matches;
   - a Scout Reveal;
   - weekly objectives with chests at 4/6 and 6/6;
   - a streak warning and a weekly shield;
   - a Season Pass hero (M10);
   - pay for every Circuit win, and Rivals weekly rewards;
   - a starter chain, and one welcoming first run;
   - an account level-up inside UT, and an exit teaser.
6. **Every UT screen is beautiful and clear**, by one measurable "studio look" checklist:
   - hero art at least 96 design px;
   - section titles 18–22 px in Archivo condensed italic;
   - spacing on an 8 px grid;
   - at most 2 accent colours per card;
   - every target at least 44 px;
   - every list that can be empty has an empty state with an icon, a line and a CTA;
   - exactly one primary CTA per screen (`data-primary`).
7. **Every tap and movement works:**
   - each tap shows a visible change within 100 ms;
   - push, pop and tab transitions use one motion spec;
   - there is an edge-swipe back;
   - there are 0 dead taps in all three sports at 393×852 (59/34), 375×667 (20/0) and 320×568.

**Hard constraints in every task:**
- **Saves.** Never reset or change the meaning of saves, storage keys, card/edition/copy ids or claim ids. New state is additive and normalised, and §2 says where it goes.
- **Coins only.**
- **Live services.** Never touch live Supabase, Nostr or the boards. QA uses `?ns=inspect&relay=ws://localhost:7777` and aborts every non-localhost host except Google Fonts.
- **Protocol lines.** Never edit `DRAFT_RULES` or `UT_RULES`.
- **Determinism.** Seeded RNG only in simulation code.
- **Sport branches.** Use `pick({ nba, nfl, soccer })` / `pickFor`, never a two-way sport ternary.
- **Layout.** 390 frame, no width media queries, taps ≥ 44, text ≥ 10, reduced motion respected, SVG symbols.
- **Keep the audit's §6 list:** the nav map, claimables-only badges, the CLAIM ALL inbox, the Daily loop, YOUR NEXT PLAY, and Archivo + teal/gold.
- **CSS and shared files.** New CSS goes in new ut-owned files. Shared files get small local hunks only.
- **Commits.** Never `git add -A`, never push `main`, never force-push, rebase or use bare `git stash`. Never use `pkill -f` or `pgrep -f`.

---

## 2. Saved state: the mixed-client rule (applies to every task)

**What an old client drops.** `acdf3e2`'s `migrateUt`, `normalizeHQ` and `totals()` are whitelists. A client that has not updated yet (a second phone, or a PWA before its update) drops every field it does not know. Cloud save is whole-profile with revision handling, so a stripped profile can come back to a new client. What an old client keeps verbatim:
- `ut.hq.claims` (strings < 200 chars);
- `ut.hq.journal` (the last 5,000 strings);
- `ut.settled` (the last 1,000);
- `ut.content.claims` (the last 5,000);
- all existing fields.

**Where new state goes:**

| Kind | Where | If an old client strips it |
|---|---|---|
| Claim receipts for every new reward (chests, starter steps, Rivals 5/10, pass extras, auto-finish quota, shield use). Scout Reveal reuses the existing `daily-bonus:<day>` claim. Circuit per-win pay is receipted by the settled match id in `ut.settled`. | strings in `hq.claims` (ids in each task) | kept, so nothing can be claimed twice |
| Enrolment and switch-over stamps: `studio:since:<day>`, `pid:<12 base36>`, `starter:enrolled` | `hq.claims` | kept |
| New per-day counters (`skill`, `circuitWins`, `cupWins`) | `hq.journal` entries `x:<day>:<counter>:<n>:<matchId>`, written in the same update as `recordMatchProgress` | kept; never as new `COUNTERS` keys, which `totals()` would drop |
| Caches and UI memory: `hq.poolClaimables`, `hq.seen` | additive optional fields | lost harmlessly and rebuilt on the next UT open |
| Live-match marker `ut.live` | additive optional field | that client lacks the protection; settlement receipts in `ut.settled` still stop double settlement |
| Device-only data: `perfect-season:ut-device:v1` (a random device id) and `perfect-season:ut-live:v1` (the score snapshot written on hide) | new device-local keys, never cloud-synced | n/a |

**Switch-over without release dates.**
- On its first UT open, the new build writes `studio:since:<ET day>` once per sport profile.
- Objective v2 dailies start the day after the stamp; weeklies start the ISO week after it.
- Circuit's 6-0 reward swap starts the ISO week after it. Pass extras apply to seasons that start after it.
- Nothing recorded before the stamp changes meaning. Old clients keep the stamp, so it never moves.

**Proof in every task that adds saved state** (ut-1, ut-4, ut-5, ut-6, ut-7):
- the `acdf3e2` old-save fixtures load with every coin, card, level, XP, squad, streak, receipt and season intact (`studio-compat.test.ts`, created in ut-0);
- the mixed-client round trip (`scripts/compat/old-client.ts`: the `acdf3e2` `migrateUt` applied to a new save, then the new normalizer) shows that no receipt is lost and no reward becomes claimable twice.

---

## 3. Scope map

### Brief items (STREAM-ut) to tasks

| Brief item | Task | Notes |
|---|---|---|
| P0-1 Bridge from landing (H4): main-tab badge, Home strip deep-linking into UT | ut-1 (data), ut-2 (UI) | pool-free claimables with a persisted cache; packs' claimables seam |
| P0-2 GO links on every progress surface (H5) | ut-1 (Objectives, Daily), ut-2 (missions, Gauntlet, Profile, draft Results), ut-7 (Season Pass), ut-8 (Sets, Evolutions, Development) | `go.ts` in ut-1 |
| P0-3 UT Home hub: hero, Live Now, Upcoming, near-miss, done-for-today, studio look | ut-3 | visual kit from ut-0 |
| P0-4 End-of-match reward sequence (M3); a soccer draw reads DRAW; keep MatchDebrief | ut-5 | plus OT labels, Rivals, account level-up |
| P0-5 Solo games skip the online vote (M13): PreMatch | ut-4 | plus defense choice and expected length (owner decisions 2–3) |
| P0-6 Mid-match kill exploit | ut-4 | marker, auto-finish by simulation, forfeit only past the weekly limit |
| P1 Daily 3 + Scout Reveal; weekly 6 + chests | ut-6 | |
| P1 Program/promo objective groups | **deferred** (§8) | supply decision with packs (owner decision 4) |
| P1 Card-attached signature objectives | **deferred** (§8) | needs merged box data |
| P1 Season Pass presentation (M10) | ut-7 | v1 scheme kept |
| P1 New 30-level scheme from the next season | **deferred** (§8) | the brief makes it optional; the safety design is recorded |
| P1 Competitive pay: Circuit every win, Rivals 5 and 10 weekly wins | ut-7 | coins only |
| P1 Streak warning and weekly shield | ut-3 (warning), ut-6 (shield) | |
| P1 Account level-up inside UT | ut-5 | |
| P1 Exit teaser | ut-3 | |
| P1 Starter objectives chain | ut-7 | enrolment stamp |
| P1 First run (M7) | ut-2 | |
| P1 M4 long pages (Development, Collection); M5; M12 | ut-8 | |
| P1 Consistent visual system across every UT screen | ut-0 (kit); ut-2 to ut-8 apply it; ut-8 kit pass on the remaining screens | |
| P1 Every tap and every screen works, 3 sports | ut-9 (walk); motion in ut-0 and ut-8 | |
| P2 `labels.ts` (H6), no wording change | ut-0 (module, nav and Match titles); each task routes its new strings | old strings beyond those: §8 |
| P2 Depth Gauntlet | **deferred** (§8) | |
| Notes: coin flow per hour before and after | ut-7 (table), re-run in ut-9 and at integration | §7 has the estimate |
| Notes: owner device checks | §12 | |

### Audit items (audit-ut-ui.md, all but §1)

| ID | Owner | Task / reason |
|---|---|---|
| C1, H1, M1, M8, M9, L6, L7 | shell | Not ut. ut overlays position from `--sat`, and QA injects shell's Fix A CSS (ut-0). M9: the curtain contract (§4 E). |
| M6 season chip 141×41 | ut decides | ut-3 folds the season chip into Live Now and removes it from the Hub, its only user. Shell's `.ut-season-chip` rule becomes dead; this is told to shell in ut.md. |
| H2, H3, M11, L4 (grid cards) | players | card faces; ut uses `UtCard` and offers `clubStatsOf` (§4 J) |
| H7, M2, M4 (SBC, Store) | packs | |
| H4, H5 | ut | ut-1, ut-2, ut-7, ut-8 |
| H6 | ut (centralise only) | ut-0; "2K/Madden reference" in `CardDetail.tsx` is listed for players |
| M3 | ut | ut-5. The rung-1 opponent floor is deferred (§8). Scorelines belong to the sport teams. |
| M4 (Development, Collection), M5, M12 | ut | ut-8 |
| M7 | ut | ut-2 |
| M10 | ut | ut-7 |
| M13 | ut | ut-4 |
| L1 badge contrast | ut | ut-2: `#c62828` (≈ 5.6:1). The earlier `#e5484d` gives about 3.9:1 and fails. |
| L2 tiny text (ut-owned) | ut | ut-6 (calendar day labels), ut-2 (mission difficulty pills), ut-8 ("NEW" tags). The Training Camp line "Find your rhythm. Own the game." (9 px, `Pages.tsx` ~217) is in no team's grant: listed for the lead (§10). |
| L3, L4, L9 | ut | ut-8 |
| L5 | none | by design, kept |
| L8 Ranks offline | not ut | flagged for the lead |

**§4 screen notes and §5 missing hooks.** Each one maps to the task named above:
- Home stat chips and Profile → ut-2. UT Home teasers → ut-3. Play chips → ut-7. Squad Battles, Legends, Squad, Collection, Sets, Development and Evolutions → ut-8. Objectives → ut-1/ut-6. Season Pass → ut-7. Match → ut-4/ut-5. Store and SBC → packs.
- Hooks 1–2 → ut-2; 3 → ut-5; 4 → ut-7; 5 → packs; 6 → ut-3/ut-7; 7 → ut-3; 8 → ut-3/ut-6; 9 → ut-5; 10 → ut-3.
- Hook 11 (push) is deferred: it needs a push backend.

---

## 4. Cross-team contracts

Each contract is written in `ut.md`. The parts other teams publish are mirrored as minimal local types, which the lead replaces with imports at merge.

### A. Per-player match data (nba, nfl, soccer → ut), read-only

As the sport teams published them:
- **nba:** `Progress.box?: BoxLine[]` (`hoops2/box.ts`), stripped before the wire in `Arcade.progress()`.
- **nfl:** `onBoxScore?: (box: FbBox) => void` on `Arcade`/`Football2`. It is never sent over the wire.
- **soccer:** `onReport` passthrough with `SoccerMatchReport`, which already carries `ratings` and `potm`.

**ut side.** ut-5 adds `src/ut/match-box.ts` with three adapters to one `RecapBox` (`{ lines: { id, name, side, rating, stats }[]; potm?: string }`) and `match-ratings.ts`:
- NBA rating from nba's game score, scaled to 1.0–10.0;
- NFL from passer/rusher/receiver/defender lines;
- soccer uses the report's own ratings.

**At merge.** The lead wires `onBoxScore`/`onReport` from `Match.tsx` into `Arcade` (≤ 6 lines; the props do not exist on ut's branch). Until then the ratings block stays hidden and nothing is invented.

**Never on the wire.** `Match.tsx` `onProgress` gets `stripLocal(p)` (drops `box`) before `conn.update`, as a second guard behind nba's own strip.

**`src/game/progress.ts` has no owner.** ut does not edit it. The lead adds `box?`, `simmed?`, `ot?` and `forfeit?` once (§10).

### B. Quit and forfeit (nba/nfl/soccer → ut)

The sport teams add `onQuit` and a forfeit flag (nba: `Progress.forfeit`; nfl: a 6th `onFinish` argument). In `Match.tsx`:
- solo quit in Cup, Circuit, Club Season or UT Draft is an explicit, confirmed forfeit (ut-4's settlement);
- solo quit in Squad Battles or Legends Events leaves without a result;
- online forfeit stays the sport teams' wire rule, settled as a loss or win.

### C. Live Now and Upcoming (packs → ut)

From `src/ut/promo-hub.ts` (packs-8): `liveNow(pool, ut, at)`, `upcomingDrops(sport, at, n)`, `launchDue`, `markLaunchSeen`, `calendarClaimables`.
- ut-3's `hub-feed.ts` has one seam, `programFeed()`. On ut's branch it reads `calendar.ts`; at merge it calls packs' functions.
- ut's own module is named `hub-feed.ts`, not `live-now.ts`, so it does not collide with packs' `liveNow`.

### D. Picks, keys and cheap routes (packs ↔ ut)

- **Program picks.** ut deposits picks of existing editions only, through `addPick`. Program cards are not a ut source this round: the program groups are deferred.
- **Circuit 6-0 Spotlight pack → Program Pick** (soccer: Elite Gold). Packs requested this. It applies from the ISO week after the studio stamp (ut-7).
- **Circuit 4-win and weekly 6/6 chest:** each adds one Program Key only if packs ships keys (`PROGRAM_KEY` exported). Otherwise nothing.
- **v1 Season Pass tier 25 (Spotlight).** Season 1 is never changed. For later seasons the swap is a packs decision (§11); the default is unchanged.
- **Season Pass extras.** `calendarPassExtras(day, levels)` pays only in seasons that start after the studio stamp, under `pass-extra:<season>:<level>` (ut-7). It is counted in the coin flow (§7).
- **Supply rule agreed with packs.** ut adds at most 1 free program card per player per week (the Circuit 6-0) and no Headliners. Scout Reveal tops out at a Jumbo, and the starter chain at a Premium.

### E. Shell (header, curtain, Home)

**Header.** Shell owns `.ut-top` and the `--sat` edge. Every top-anchored ut overlay (PreMatch, recap, level-up, Scout Reveal, the interrupted sheet) positions from `--sat`. Every sticky footer includes `--sab`.

**Curtain (M9).** PreMatch already shows the matchup. On PLAY, the button changes within 100 ms to a pressed "LOADING ARENA…" state. `Match.tsx` passes `curtain: 'compact'` through `Arcade` to `ArenaCurtain`, which then shows the tip and shimmer only. If shell does not add the variant, the curtain repeats the matchup once; this is accepted and recorded, and the lead decides at merge.

**Home.**
- **Space.** The ut pill takes the tagline's line, so Home gains no height (ut-2).
- **Shell's hunks.** Shell's hint/spacer and `fit` changes stay in shell's own hunks.
- **Checks.** ut measures with shell's Fix A CSS injected (ut-0 harness).

### F. Defense choice and `how` (owner decisions 2–3; nba, nfl, soccer → ut)

**Where the preference lives.** It is device-local, owned by each sport:
- nba: `perfect-season:hoops-prefs:v1` `.autoDefend`;
- soccer: `perfect-season:soccer-prefs:v1` `.defend` (`'key' | 'all' | 'auto'`);
- nfl: requested to follow the same pattern.

ut never writes those keys. ut-4 adds `src/ut/defense-pref.ts`, a small registry of the shape `{ get(): string; set(v): void; options: { id, label }[] }` per sport. The lead registers the three sport modules at merge (3 imports). Until then the PreMatch control is hidden, and tests use a fake.

**How `how` is set.** `match-how.ts`:
- `how = 'sim'` when `Arcade` reports a whole-match SIM, or when `Progress.simmed / own possessions > 0.25`;
- otherwise `how = 'played'`.

`simmed` counts only the human's own **offensive** possessions or drives that were simulated. Auto-defend and per-possession SIM on **defense** never count.

**Consequences:**
- SP (played 80, sim 30), the paid rules and `settle`'s manual-only checks keep their meaning.
- Manual-only modes (Cup, Club Season, Circuit) hide the whole-match SIM. Defensive SIM stays allowed there (nba plan nba-9), so a manual-only match the human played always settles.

**Expected length.** PreMatch shows "About 5 min · you defend their possessions" from a per-sport constant `EXPECTED_MIN`, and "About 3 min" when Auto-defend is on. Both are re-measured at integration.

### G. Overtime, draws and end codes (nba, nfl, soccer → ut)

**Verdict (ut-5):**
- `WIN · OT` / `LOSS · OT` when `Progress.ot > 0`. If `ot` is absent, ut falls back to `ends.length` above the sport's regulation count.
- `WIN · PENS` / `LOSS · PENS` when `pens` is present.
- `DRAW` (soccer) or `TIE` only for a level score.
- The squad-rating tiebreak line remains only for nba's 10-OT safety cap, or a level result with no other rule.

**Soccer three-way draws, if soccer settles UT draws that way.** This is a contingency, and ut owns it:
- `UtMatchResult.draw?: true`;
- `settle` pays a draw 45 × pay coins, played SP 80 + 15 and card XP 40 + 10;
- `record.d?` additive (old clients drop it; stats only);
- `ClubMatch.draw?`; the Win counters are unchanged; Club Records shows "D";
- a Circuit draw counts as not-a-win;
- Cups are knockout, so penalties decide them.

The protocol bump would be soccer's. ut-5 includes a dormant `draw` branch with tests.

**End codes.** `src/ut/end-codes.test.ts` pins every code per sport, with points and a label: today's codes, plus nfl's `TD6`, `TD8`, `FF` and OT drives. The skill counters (ut-6) prefer box stats (NBA `tpm`; NFL `passTd + rushTd + recTd`; soccer `goals`) and fall back to end codes (`'3'`; `'TD' | 'TD6' | 'TD8'`; `'G'`).

### H. Packs' claimables, views and launch moment (packs → ut)

**Claimables seam.** ut-1 creates `src/ut/packs-claimables.ts`. Packs owns its body and fills it at merge: calendar check-in and path claims, stamp redemption ready, Program Bag keys. The shape is `packsClaimables(ut, day, sport): { n: number; ids: string[]; lines: string[] }`, with no imports from `pool`, `packs`, `cards`, `sbc`, `rate` or `squad`, so the main-tab badge stays light. `claimables.ts` includes it, and the inbox lists packs' `calendarClaimables` under CLAIM ALL.

**Reserved views.** `nav.ts` gains `program` (packs' id: title "Program", tab store, parent store) and `stamps` (title "Scout Stamps", tab store). Both render the Store until packs' screens land. Packs' identical hook lines merge cleanly.

**Launch moment.** ut-3 adds `ut-modal-queue.ts`: one modal at a time, in this order:
1. the interrupted-match sheet;
2. packs' wave launch takeover (`launchDue` → `PromoLaunch`, mounted through the queue's slot);
3. the New Era bundle.

**"New" dots.** These use `hq.seen` (ut) for the Store tab and Live Now. Packs' `content.seenDrops` stays theirs, for the takeover.

### I. Labels (ut → packs, players)

`src/ut/labels.ts` (ut-0) holds the exact current names. Packs' "Hot Season", "Weekly/Matchday Standouts" and "Program" are added when packs routes its strings. Mode names never change (owner decision 1).

### J. Card back "With your club" (ut → players)

ut-1 adds `clubStatsOf(ut, uid): { games; wins; since?: number }`, read from `hq.cardStats` and `hq.history`. The card back belongs to players.

---

## 5. Tasks (ordered)

**Common to every task:**
- **Before shots.** Capture "before" shots and numbers with `scripts/qa/ut-studio.mjs` (ut-0) into `O/shots/ut/<task>/<sport>-<w>x<h>-<name>.png`.
- **Dev server:** `nohup npx vite --port 5212 --strictPort > /tmp/ps-ut-vite.log 2>&1 & echo $! > /tmp/ps-ut-vite.pid`; stop it with `kill $(cat /tmp/ps-ut-vite.pid)`. Never use `pkill -f` or `pgrep -f`.
- **Browser QA** always runs at `?ns=inspect&relay=ws://localhost:7777`, with route-abort and `--edge` (shell's Fix A injected), on touch at `deviceScaleFactor: 1`. Sizes: 393×852 (59/34), 375×667 (20/0) and 320×568.
- **Tests run through the semaphore:**
  - `bash O/heavy.sh npm run typecheck`
  - `bash O/heavy.sh npx vitest run <files>`
  - `PS_SPORT=nfl bash O/heavy.sh npx vitest run <files>`
  - soccer cases live in `src/ut/soccer-*.test.ts`: `PS_SPORT=soccer bash O/heavy.sh npx vitest run soccer sport-branches`
- **Commit** each commit-split point with explicit paths, a "Claude: …" message and the BUILD-RULES trailer, then push `claude/studio-ut`. Update `ut.md`.
- **Saved state.** If the task adds saved state, run the old-save fixtures and `scripts/compat/old-client.ts` (§2).

---

### ut-0 · P0 enabler · QA harness, save-compat fixtures, UT visual kit, labels

**Why first.**
- **Before shots and the interrupt case need a harness.** ut-3's before-shots, ut-4's interrupt case and every acceptance number need an isolated harness with shell's top edge applied.
- **New saved state needs a check.** Every task that adds saved state needs old-save fixtures and a mixed-client check.
- **New UI needs one kit.** ut-2 to ut-8 build UI that would otherwise invent its own pieces and get restyled twice.

**Changes**

**QA harness** (`scripts/qa/ut-studio.mjs` and `scripts/qa/ut-fixtures.mjs`):
- **Base.** It is copied from `O/audit-scripts/utui/lib.mjs`, on port 5212.
- **Cases** are chosen by argument: `selfcheck`, `walk`, `bridge`, `firstrun`, `hub`, `prematch`, `interrupt`, `recap`, `objectives`, `pass`, `pages`.
- **Isolation** follows BUILD-RULES. Each screen in a dead-tap run gets a fresh context.
- **Flags:**
  - `--edge`, on by default: injects `FIX_CSS` from `O/audit-scripts/utui/edge.mjs`, with the edge from shell's `topEdge` (59 → 22, 20 → 8);
  - `--cpu 4` (CDP throttle);
  - `--rm` (reduced motion);
  - `--clock <ET time>` (Playwright clock, for expiry and streak fixtures).
- **Per-screen metrics:**
  - horizontal overflow and clipped text;
  - targets < 44 (counting `::before`) and text < 10 px;
  - contrast: computed colours, and pixel-sampled behind text that sits on a gradient;
  - the topmost control's y ≥ sat + edge;
  - page errors and long tasks;
  - primary-CTA count (`[data-primary]`);
  - **tap feedback:** the time from `pointerdown` to the first DOM mutation or computed-style change on the target or an ancestor (MutationObserver + rAF).
- **Dead-tap detector.** It clicks every enabled button or link and flags any that changes neither the DOM nor the view within 600 ms. `aria-pressed`/`aria-expanded` toggles are excepted.
  - **Denylist** (by text or selector): QUICK SELL, SELL, SUBMIT, BUY, OPEN on Spotlight/GOAT/registered packs, RESET PROGRESS, ERASE, FIND MATCH, PLAY ONLINE, ADMIN, SEND.
- **Fixtures** (3 sports, JSON under `scripts/qa/fixtures/ut/`):
  - fresh; starter unclaimed;
  - the audit fixture (6 rewards + 2 packs); one per claimable source;
  - runs in progress (Cup, Circuit, Club Season, Draft);
  - expiring < 24 h; all done for today;
  - near-miss (a set 1 card away; Rivals 2 wins short);
  - a new drafter; streak at risk;
  - a completed set at a cold start.

**Save compatibility:**
- **Fixtures.** `src/ut/compat/acdf3e2-{nba,nfl,soccer}.json` are old-shape saves that cover every field family:
  - owned copies with mint; squad and presets; `sbc.done`;
  - packs with voucher; battles, record and paid;
  - all of hq: seasons with claims, circuit active and history, development, moments, history;
  - content: daily streak, claims, pulls, locked;
  - cup, league, rivals with rewards, settled, collected, collectionClaims and retirements.
- **Tests.** `src/ut/compat/expect-preserved.ts` (deep-equal per preserved family), `src/ut/studio-compat.test.ts`, `src/ut/soccer-studio-compat.test.ts`.
- **Mixed-client script.** `scripts/compat/old-client.ts`, run with `bash O/heavy.sh npx vite-node scripts/compat/old-client.ts <save.json>`, does this:
  1. it runs `git archive acdf3e2 src` into `O/compat/acdf3e2/` (scratchpad, never committed);
  2. it imports that tree's `migrateUt` and applies it to a new-shape save, then applies the current `migrateUt`;
  3. it prints the fields lost and asserts the must-survive list: every `hq.claims`/`journal`/`settled`/`content.claims` string, coins, owned uids, levels, XP, squads and season claims.

**Visual kit** (`src/ut/kit.tsx` + `src/ut/ut-system.css`, ≤ 4 KB gzip):
- **Tokens:**
  - plate depth (base, inner highlight, drop shadow), gold and teal glows, chip materials;
  - an 8 px spacing scale; section titles at 20 px Archivo condensed italic; radii.
- **Motion tokens:**
  - push 200 ms (translateX 16 px + fade); pop 160 ms; tab 120 ms crossfade; sheet 240 ms;
  - all of them 0 under reduced motion.
- **Press feedback.** `:where(.ut-app) button:not(:disabled):active` scales to 0.97 and brightens to 1.08 within one frame; `data-pressed` mirrors it for custom controls.
- **Components:**
  - `SectionTitle`; `RewardChip` (mini `PackArt`, coin or `UtCard` plus a label); `GoChip`;
  - `ClaimButton`: `tapHaptic()` called only inside its pointer handler, a CSS spark burst and `sfx.coin`; none under reduced motion;
  - `PrimaryButton` (≥ 56 px, `data-primary`);
  - `Countdown`: "2d 4h" / "3h 12m" / "12m"; amber under 24 h; updates every 30 s; no ticking animation under reduced motion;
  - `ProgressRing`;
  - `EmptyState`: icon, line and CTA are all required props.

**Labels** (`src/ut/labels.ts`):
- **Contents.** Every player-facing mode and feature name with today's exact wording, an upper-case helper, and `modeName(view)`.
- **Routed now:** `nav.ts` titles and tabs, `play-status.ts` `MODE_NAME`, and the `Match.tsx` title and eyebrow strings.

**Team doc.** Create `docs/studio-overhaul/ut.md` with its sections: changes, measurements, Protocol, Touched outside my lane, owner device checks, the integration checklist and lead decisions.

**Tests:**
- `labels.test.ts`:
  - a snapshot of every label (wording unchanged);
  - `nav.ts` titles equal the constants;
  - **banned terms:** player-facing strings in ut-owned files must not match `/\b(TOTW|TOTS|TOTY|FUT|MUT|MyTEAM|Campaign Hub|Lightning Rounds?|Icon cards?|Hero cards?)\b/`. Existing hits are allowlisted by file and reported.
- `kit.test.tsx`: `Countdown` formatting and the amber edge; `EmptyState` requires a CTA; `ClaimButton` calls the haptic only from the pointer handler (spy).
- The compat tests in 3 sports.

**Measurements and acceptance:**
- **Baseline.** `ut-studio.mjs selfcheck` writes a before-baseline (`O/shots/ut/ut-0/report.json`). It covers Home, UT Home, Play, Squad, Club (4), Challenges (3), Store and Inbox, in 3 sports × 3 sizes, with every metric above.
- **Fixtures** load in all 3 sports with 0 page errors.
- **Round trip.** `old-client.ts` on today's fixtures loses nothing.
- **Kit.** Kit CSS ≤ 4 KB gzip. Under `--rm` the kit's burst and sheen compute `animation-name: none`.
- Typecheck is clean; labels and compat tests pass in NBA, NFL and soccer.

**Other details:**
- **Screenshots:** the baseline set above.
- **Protocol:** none.
- **Save-compat:** none (fixtures and tooling only).
- **Dependencies:** none.

**Files:** `scripts/qa/ut-studio.mjs`, `scripts/qa/ut-fixtures.mjs`, `scripts/qa/fixtures/ut/*.json`, `scripts/compat/old-client.ts`, `src/ut/compat/*`, `src/ut/studio-compat.test.ts`, `src/ut/soccer-studio-compat.test.ts`, `src/ut/kit.tsx`, `src/ut/ut-system.css`, `src/ut/kit.test.tsx`, `src/ut/labels.ts`, `src/ut/labels.test.ts`, `src/ut/nav.ts`, `src/ut/play-status.ts`, `src/ut/Match.tsx` (string constants only), `docs/studio-overhaul/ut.md`.

**Commit split:** (1) the harness and fixtures; (2) the compat test and round trip; (3) the kit and labels.

---

### ut-1 · P0 · Progress core: light objectives, complete pool-free claimables, GO targets, seen state, stamps

**Why.**
- **Keep the entry chunk light.** The main-app badge and pill must not pull pool, packs or cards into first paint. Today `progression.ts` → `sbc.ts` → `packs.ts`/`pool.ts`.
- **One shared logic.** Every GO link, hub and recap reads the same claimables logic.

**Changes**

**Light objectives module.** NEW `src/ut/objectives.ts` (imports only `hq-state`, `state` types, `../engine/sport` and `../net/leaderboard` `weekKey`).
- **Moved here with no behaviour change:** `Reward`, `Objective`, `DAILY`, `WEEKLY`, the lifetime table, `objectiveDeck`, `hqOf`, `seasonFor`, `SEASON_TIERS`, `SEASON_STEP`, `seasonReady`, `readyRewards`, `rewardLabel`, `DEVELOPMENT_PATHS`, `developmentReady`.
- **Re-exports.** `progression.ts` and `club-management.ts` re-export them, so every existing import compiles. The week function becomes `weekKey`, the same ISO algorithm as `sbc.ts weekOf`.

**Pool-free claimables.** NEW `src/ut/claimables.ts`: `utClaimables(ut, day, week, sport, now): Claimables` returns `{ count, rewards, packs, picks, dropReady, dropDay, calendarReady, streak, streakAtRisk, hoursLeft, approx, lines }`.
- **Counted, with the same rules as `inboxItems`:**
  - New Era, Daily Drop, the login calendar, objectives and the daily bonus;
  - Season Pass tiers and the Weekly Standouts objective;
  - finished UT Draft, ready Evolutions, Rivals rewards, development and the Cup title;
  - `packsClaimables` (§4 H).
- **Re-implemented locally,** each with an equality test against the original, because importing these would reach `packs.ts`/`pool.ts`:
  - `newEraReady`, `draftOf(..).done`, `cupClaimId` and the Cup title;
  - `standoutWins`; `dailyStatus` and `dailyPackId` (content-packs → packs);
  - `calendarStatus` and `dailyBonusReady` (daily-hub → content-packs);
  - `momentsFor` readiness (moments → progression; after the move progression no longer reaches `sbc`; the engineer verifies the `battles.ts` path).
  - Several originals live in packs-owned files that packs is changing (the Daily Drop and calendar), so the lead re-runs these tests at merge (§10).
- **Persisted cache.** `hq.poolClaimables?: { sig: string; n: number }` holds the pool-dependent sources: Sets, Collection milestones and Moments.
  - It is additive and normalised (`sig` ≤ 80 chars, `n` ≤ 999).
  - `UltimateTeam.tsx` writes it only when the value changes, whenever it computes `inboxItems`.
  - `sig` = owned count : collected count : collectionClaims count : moments-claimed count : week.
- **Cold-start rule:**
  - a matching `sig` means light + cache = exact;
  - otherwise the light count is used with `approx: true`, and the UT open rewrites the cache;
  - only cards gained outside UT (admin gifts) can leave it approximate.
- **Streak at risk:** `streakAtRisk` = Daily Drop ready, streak ≥ 2 and ≤ 4 h to Eastern midnight.

**Packs seam and reserved views.** `src/ut/packs-claimables.ts` is a stub that returns zero; packs owns its body. `nav.ts` gets the reserved `program` and `stamps` views (§4 H).

**Seen state.** NEW `src/ut/seen.ts`: `hq.seen?: Record<string, string>` (≤ 64 keys, values ≤ 80 chars), with `isUnseen(ut, key, token)` and `markSeen(ut, key, token)`.
- **Keys:** `store:wave`, `live:<id>`, `objectives:week`, `pass:season`.
- **Dot rule:** a dot shows only when something is unseen and the player can act on it; it clears on first view.

**Stamps.** NEW `src/ut/stamps.ts`:
- `ensureStudio(ut, day)` writes `studio:since:<day>` and `pid:<12 base36 chars>` (from `crypto.getRandomValues`; not simulation code) into `hq.claims` once, on the first UT open of the new build.
- `studioSince(ut)` and `playerKey(ut)` read them.

**GO targets.** NEW `src/ut/go.ts` (light). `GoTarget = { view: UtView; label: string; odds?: true }`:
- `goForCounter`: games/wins/points → `battles` "PLAY"; onlineWins → `rivals`; packs → `store`; sbcs → `sbc`; moments → `moments` (soccer → `battles`); development → `development`.
- `goForSet` follows the **ethics rule:** SBC → Scout Market → a pick first. The Store is used only when it is the only route, and then the chip shows "odds" (research §7).
- `openUtAt(view)` = `rememberUtReturn(view)`, then open UT.

**Card back selector:** `clubStatsOf(ut, uid)` (§4 J).

**First consumers:**
- **Objectives** (`Clubhouse.tsx` `ObjectivesView`):
  - the disabled "IN PROGRESS" chip becomes a `GoChip`;
  - the view opens on the first group that holds a ready reward;
  - "1 REWARDS READY" pluralises.
- **Daily** (`DailyHubView.tsx`): unfinished rows get the GO chip.
- **Stamp and cache writes:** `UltimateTeam.tsx` calls `ensureStudio` and writes the cache.

**Tests:**
- `objectives.test.ts`:
  - `weekKey === weekOf` for 800 consecutive days across two year boundaries;
  - a deck and claim-id snapshot equal to the pre-move output for 6 fixtures.
- `claimables.test.ts`:
  - ≥ 10 fixtures × 3 sports: `utClaimables(...).count === inboxCount(pool, ...)` with a valid cache;
  - a cold start with a completed set (valid cache gives equality; an invalid cache gives `approx` and the light count);
  - the `streakAtRisk` window at 19:59 vs 20:01 ET.
- `claimables-graph.test.ts`: a static import walk from `claimables.ts`, `go.ts`, `stamps.ts` and `packs-claimables.ts` reaches none of `pool`, `packs`, `cards`, `sbc`, `rate`, `squad`, `content-packs`, `daily-hub`, `moments` or `inbox`.
- `claimables-reimpl.test.ts`: each re-implementation equals its original over the fixtures and a 60-day calendar.
- `seen.test.ts`; `stamps.test.ts` (written once; survives the round trip); `go.test.ts` and `soccer-go.test.ts` (every target exists in `nav.ts` and is shown for that sport); `soccer-claimables.test.ts`.
- Existing `overhaul`, `inbox-completeness`, `polish` and `play-status` tests pass unedited.

**Measurements and acceptance:**
- The import graph is green.
- Claimables count equals the inbox count in 100% of fixtures.
- `utClaimables` takes ≤ 2 ms in node for a large fixture (3,000 owned, 5,000 claims).
- 0 disabled-only "IN PROGRESS" chips on Objectives and Daily in 3 sports (browser; before: every unfinished objective).
- No claim id, objective id or reward amount changes (snapshot).
- Old-save fixtures and the round trip are green; losing `poolClaimables` or `seen` is harmless (test).

**Other details:**
- **Screenshots:** Objectives and Daily with GO chips (3 sports, 393; NBA 320 and 375).
- **Protocol:** none.
- **Save-compat:** additive `hq.poolClaimables` and `hq.seen`, plus new `hq.claims` strings (§2).
- **Dependencies:** ut-0.

**Files:** `src/ut/objectives.ts`, `claimables.ts`, `packs-claimables.ts`, `seen.ts`, `stamps.ts`, `go.ts` (new); `progression.ts`, `club-management.ts`, `hq-state.ts`, `nav.ts`, `Clubhouse.tsx` (ObjectivesView), `DailyHubView.tsx`, `UltimateTeam.tsx`; tests above.

**Commit split:** (1) objectives and claimables with their tests; (2) seen, stamps, GO and the two views.

---

### ut-2 · P0 · Main-app bridge (H4) and first run (M7)

**Changes**

**Main tab badge** (`App.tsx`, `Pages.tsx` `Tabs`):
- **Loading.** App dynamically imports `./ut/claimables` after first paint (`requestIdleCallback`, with a 1 s `setTimeout` fallback) and memoises per profile, day and minute.
- **Props.** `Tabs` gets `ut?: { count; atRisk; dot }`.
- **Look.** A number badge on `#c62828` with white 11 px bold text (≈ 5.6:1). An amber clock when `atRisk`. The existing FREE pill while the starter is unclaimed.
- **Accessible name:** "Ultimate Team, 6 rewards ready".
- **App icon.** `navigator.setAppBadge(count)` / `clearAppBadge()` are feature-detected and wrapped in try/catch. The app never requests notification permission (§12).
- **UT's own badges.** `.ut-dot` in `nav.css` gets the same colour fix (L1).

**Home bridge** (NEW `src/ui/UtBridge.tsx` + `src/ui/ut-bridge.css`; one hunk in `HomePage`; imports only `go.ts` and types):
- **The chip.** A `statchip ut` in `.statstrip` shows the UT mark and the count. It has a ≥ 44 px hit area and shows when `count > 0 || dropReady`.
- **The pill.** "ULTIMATE TEAM · 6 rewards · 2 packs · Day 3 drop ready ›" takes the tagline's line, so Home gains no height.
  - It is ≤ 32 px tall, with a `::before` hit area of 44 px.
  - It shows only when a layout effect measures enough room in `.home-scroll` (no width query); otherwise only the chip shows.
  - It is checked with shell's edge injected.
- **Tap.** Either one gives a pressed state within one frame, then `openUtAt(count ? 'inbox' : 'daily')`.

**Profile:** the UT card shows the claimables line and deep-links to the inbox. A new drafter (`stats.games === 0`) sees "Play your first draft" with PLAY instead of the zero grid.

**Missions sheet** (`Rewards.tsx`, `engine/missions.ts`):
- each mission gets `go: 'any' | 'daily' | 'blind' | '1v1'`;
- an unfinished mission shows GO, which selects the mode, or for `'any'` starts a draft;
- the difficulty pills are ≥ 10 px (L2).

**Gauntlet sheet:**
- "CLIMB WITH YOUR <TEAM>" when a finished draft for this sport is in memory;
- otherwise "PLAY A DRAFT", with the copy "Finish any draft, then take that team up this week's eight.";
- GOT IT becomes a secondary CLOSE.

**Draft reward moments** (`ui/Results.tsx`, `ui/Gauntlet.tsx`): the draft flow keeps its one primary button. A secondary bridge row appears when UT has claimables: "6 rewards waiting in Ultimate Team ›".

**First run** (`App.tsx` modal order, `Welcome.tsx`, `Rewards.tsx`):
- **Welcome perks** add "Build an Ultimate Team: open packs, collect legends, play squad matches".
- **For a brand-new player,** the tester gift and the Day 1 chest become one sheet with COLLECT ALL and "OPEN YOUR FREE STARTER PACK" (collects, then `openUtAt('hub')`). COLLECT ALL claims both with their existing ids: `TESTER_GIFT.id` into `gifts`, and `rewardDay`/`nextStreak` as today. The pure helper `firstRunPlan(profile)` decides which sheets show.
- **Kept as before:** testers who haven't collected keep their copy; the fav prompt and admin gifts keep their order.
- **Layout:** the sheet's top offset comes from `--sat`, and its footer includes `--sab`.

**Tests:**
- `missions.test.ts`: every mission has a `go` value whose mode exists.
- `first-run.test.ts`: the sheet plan per profile; ids unchanged; exactly once.
- `ut-studio.mjs bridge|firstrun` (browser, below).

**Measurements and acceptance** (with `--edge`):
- **Badge contrast** ≥ 4.5:1, measured (expect ≈ 5.6:1; before 4.28:1).
- **Badge equality.** The main badge equals the UT HOME badge in 100% of fixtures × 3 sports, including a cold start with a completed set (valid cache) and the documented invalid-cache rule.
- **No added scroll on Home.**
  - `.home-scroll` overflow after ≤ before, at 393×852, 375×667 and 320×568 × 3 sports.
  - At 393×852 the overflow is 0 px where it was 0 before.
  - The PLAY bar's top y is unchanged ±1 px.
- **Feedback.** The pill or chip shows feedback within 100 ms. UT Rewards is visible ≤ 2.5 s after the tap at 4× CPU. That figure depends on shell's P-1 work: if UT open is still 7–9 s on ut's branch, record it and re-measure at integration.
- **Cost.** The dynamic import plus compute takes ≤ 10 ms at 4× CPU after first paint. The graph test proves `UtBridge` reaches no heavy module. The entry-chunk growth (≤ 2 KB gzip) is measured in ut-9's build.
- **Sheets.** Missions and Gauntlet each have a primary action other than DONE/GOT IT.
- **First run:**
  - stacked modals before Home go from 2 to 1;
  - COLLECT ALL is 1 tap;
  - coins rise by the gift + chest amounts, and `gifts` contains the tester id;
  - the starter CTA lands on UT Home.
- 0 targets < 44 and 0 text < 10 px on the changed surfaces at 3 sizes.

**Other details:**
- **Screenshots:**
  - Home with the pill (3 sports, 393) and with only the chip (NBA/NFL at 375 and 320);
  - a tab-bar crop with the badge and the amber clock;
  - Profile (UT card; new drafter); Missions; Gauntlet (with and without a last team);
  - the Results bridge row; the Welcome sheet (393, 375, 320).
- **Protocol:** none.
- **Save-compat:** none (`go` is static mission data; first-run ids unchanged).
- **Dependencies:** ut-1; shell (the measurements use Fix A injected; re-check with the real CSS at merge).
- **Touched outside my lane:** the `Pages.tsx` tagline hunk; it is inside ut's Home strip grant, but listed anyway.

**Files:** `src/App.tsx`, `src/ui/Pages.tsx`, `src/ui/Rewards.tsx`, `src/ui/Welcome.tsx`, `src/ui/Results.tsx`, `src/ui/Gauntlet.tsx`, `src/ui/UtBridge.tsx` (new), `src/ui/ut-bridge.css` (new), `src/engine/missions.ts`, `src/ut/nav.css`, tests, harness cases.

**Commit split:** (1) badge and Home bridge; (2) Profile, Missions, Gauntlet and Results; (3) first run.

---

### ut-3 · P0 · UT Home becomes a hub

**Changes**

**Next best action.** NEW `src/ut/next-action.ts`: `nextBestAction(ctx): Action` (one card, one primary button). Priority, first match wins:
0. Starter pack unclaimed. A `chain` slot sits here: ut-7's starter chain fills it, and until then it returns null.
1. Claimables > 0: "Claim 6 rewards", with CLAIM ALL in place and a burst.
2. An unfinished run (Cup, Circuit, Club Season, UT Draft; most recent first) → CONTINUE.
3. Progress that expires in < 24 h (Sunday weeklies, the Standout objective, a program SBC ending, the Rivals week) → GO, with an amber clock.
4. Daily objectives at 2 of 3 → "1 more for today's Scout Reveal" (wording switches when ut-6 lands).
5. Season Pass within 30% of a named reward → PLAY.
6. A new program wave in its first 48 h (packs' `liveNow(...).isNew`) → the Program view.
7. Unopened packs or picks → OPEN PACKS.
8. "Play: Champions Circuit" if a free entry is left; else Squad Battles at the recommended level.
9. **Done for today.**
   - **When:** the Daily Drop, calendar, all three dailies and their bonus are claimed, nothing is claimable and no run is live.
   - **The card:** a calm "You're done for today", tomorrow's teaser ("Day 4 of 7 · Gold Pack in 3 days") and the reset countdown.
   - **The link:** a quiet "Keep playing" (research §7).

**Hub feed.** NEW `src/ut/hub-feed.ts`: `hubFeed(ctx): { live: HubItem[]; upcoming: HubItem[] }`.
- **Merges:** `programFeed()` (contract C) with ut's own items:
  - Weekly Standouts; the Daily Drop (with streak at risk); the Lightning window;
  - Circuit entries left; Cup titles left; the Rivals week;
  - **the Season Pass card** ("Season 01 · 12d left · Level 14"), which replaces the `SeasonBanner` chip.
- **Upcoming:** the next 3 drops, each with a date and a requirement line.
- **Amber:** when < 24 h is left.

**Near misses.** NEW `src/ut/near-miss.ts`: ≤ 3 chips, sorted by the fraction remaining, each with a `GoTarget` (ethics rule):
- a set 1 card away; "1 win to Finalist"; "2 wins to Pro" (ceil of the RP gap / 30);
- "1 game to today's bonus"; "120 SP to level 7"; Standout wins; an Evolution 1 game from applying; the next Squad Battles rung pack.

**`Hub.tsx` rebuild with the kit**, top to bottom:
- **Hero:** art ≥ 96 design px (`PackArt` / `SquadFan` / `ModeArt` / `UtCard`), an eyebrow, an Archivo condensed italic title, one line and one `PrimaryButton`.
- **Near-miss row.**
- **Live Now carousel:**
  - scroll-snap cards 264 px wide, each with a `Countdown`, a `ProgressRing`, a mask fade and "new" dots from `hq.seen`;
  - `scroll-behavior: auto` under reduced motion.
- **Rewards row,** only when the hero is not already the claim action.
- **Daily and Standouts tiles,** kept. The Daily tile shows the amber **streak warning** in the last 4 h: "Claim before midnight ET or your Day 5 streak resets".
- **Season Pass ribbon** with a next-3 teaser.
- **Upcoming strip.**
- **Your club:** the squad fan, kept, and 2×2 tiles:
  - Store: packs to open, a "new" dot and the stamps meter seam;
  - Challenges; Squad ("upgrade available"); Collection (closest set and its grade).
- **Club Records,** kept.

**SeasonBanner.** `Hub.tsx` stops rendering it; it is the only user. Tell shell that the `.ut-season-chip` target is gone.

**Modal queue.** NEW `src/ut/ut-modal-queue.ts` with the order in contract H. Packs mounts `PromoLaunch` through its slot.

**Exit teaser** (`UltimateTeam.tsx` EXIT):
- a non-blocking toast after the view has changed: "Tomorrow: Daily Drop Day 3 of 7 · Calendar Day 4: Gold pick";
- the exit tap's own work takes ≤ 16 ms.

**Styles:** NEW `src/ut/hub.css`. Derivations are memoised on `[ut, day, week, pool, minuteTick]`.

**Tests:**
- `next-action.test.ts`: ≥ 12 cases (one per level, done-for-today, and a recency tie-break), and never done-for-today while anything is claimable.
- `hub-feed.test.ts`:
  - countdowns across Eastern midnight and the 2026-11-01 DST change;
  - amber at 23:59 vs 24:01;
  - a 28-day calendar: ≥ 3 live items every day in NBA/NFL and ≥ 2 in soccer;
  - every `view` exists for that sport.
- `near-miss.test.ts`; `modal-queue.test.ts` (one at a time, in order); `soccer-hub.test.ts` (never routes to `league`/`events`/`moments`).

**Measurements and acceptance:**
- **Layout.** The hero CTA is fully above the tab bar at 320×568, 375×667 and 393×852, with the edge, in 3 sports. Exactly 1 `data-primary`.
- **Done for today** shows in 100% of all-done fixtures and in 0% when anything is claimable.
- **Taps.** Every carousel card, chip, tile and upcoming row lands on the expected view: 0 dead taps; feedback ≤ 100 ms.
- **Performance.** Hub derivations take ≤ 30 ms at 4× CPU. The Hub renders ≤ 150 ms after the pool is ready, with no long task > 50 ms added.
- **Text.** Text on the new gradient plates is ≥ 4.5:1 (sampled).
- **Reduced motion.** The hero, sheen and amber pulse compute `animation-name: none`.
- **Checks.** 0 overflow, clipped, < 44 or < 10 px. The studio-look checklist is recorded per section in ut.md.
- **Exit toast** never delays leaving.
- **Kept:** CLAIM ALL, the Daily and Standouts tiles, the squad fan, Club Records and the Continue behaviour.

**Other details:**
- **Screenshots:**
  - 3 sports × {393, 375} × 5 states (new player, claimables, run in progress, expiring with amber, done for today);
  - NBA 320 × 5 states; reduced motion; the carousel scrolled; the exit toast.
- **Protocol:** none.
- **Save-compat:** read-only, except `hq.seen` (ut-1).
- **Dependencies:** ut-0, ut-1; packs (contract C at merge).

**Files:** `src/ut/next-action.ts`, `hub-feed.ts`, `near-miss.ts`, `ut-modal-queue.ts`, `hub.css` (new); `Hub.tsx`, `UltimateTeam.tsx`; tests.

**Commit split:** (1) logic and tests; (2) Hub UI, queue and exit teaser.

---

### ut-4 · P0 · Solo match flow: PreMatch with the defense choice, and interrupted matches

**A. PreMatch (M13; owner decisions 2–3)**

**Stage flow** (`Match.tsx`):
- For `online === null` setups, the stage after setup is a new `'pre'` stage, which renders `PreMatch` and **waits**, with no timer.
  - These setups are Squad Battles, Legends Events, Circuit, Club Season, Cups, UT Draft and the Rivals AI stand-in.
- Online keeps `vs` → `Vote`. `autoplay` goes straight to `play`.

**The screen.** NEW `src/ut/PreMatch.tsx` + `src/ut/prematch.css` (kit), top to bottom:
- an eyebrow: label · difficulty · stage ("Rung 3 of 8", "Semi-final", "Match 4 of 6", "Game 2 of 4");
- both `SideCard`s; the AI's skill name;
- the length line (contract F);
- the **Defense** control from the `defense-pref.ts` registry ("PLAY · AUTO"; soccer "KEY CHANCES · ALL · AUTO"); hidden online and while no module is registered;
- **On offer:**
  - coins for a win or loss, or "Today's 8 paid games are played";
  - the rung pack; the Circuit milestone; the Cup title prize; SP played vs sim;
- **This match can advance:** ≤ 3 objective chips whose counter it moves;
- **PLAY** (`PrimaryButton`, 56 px) and **SIM** (secondary; hidden for the manual-only modes Circuit, Club Season and Cups);
- a sticky footer that includes `--sab`.

**PLAY:**
- a pressed "LOADING ARENA…" state within 100 ms;
- `curtain: 'compact'` passed through `Arcade` (contract E);
- `Match.tsx` passes stable `useCallback` handlers, so `Arcade` does not re-render on profile saves.

**`how` rule.** NEW `src/ut/match-how.ts`: `howOf(arcadeHow, us)` (contract F). `finish()` uses it.

**B. Interrupted matches (the exploit, without punishing honest evictions)**

**Marker.** `state.ts` (additive): `live?: { id; kind: 'cup' | 'league' | 'circuit' | 'draft'; req; dev; at; opponent; us; them; ends; seed }`, normalised in `migrateUt`. A malformed marker is dropped.

**Device-local keys** (§2):
- `perfect-season:ut-device:v1`: a random id;
- `perfect-season:ut-live:v1`: `{ id, us, them, ends, at }`, written synchronously on `visibilitychange: hidden` and on `pagehide` (≤ 1 ms). This captures the score at the moment iOS can evict the app or the player swipes it away.

**Logic.** NEW `src/ut/live-match.ts`:
- **`startLive`:** a profile write at kickoff. **`progressLive`:** one profile write at the first ended possession only. So there are ≤ 2 profile writes during play.
- **`snapshotOnHide`;** **`clearLive`**, inside the settle transaction.
- **`resolveInterrupted(ut, pool, day, at, dev)`:**
  - **Another device's marker under 30 min old:** left alone, because it may still be playing.
  - **Stale** (already in `ut.settled`, run retired, round settled): cleared.
  - **Not started** (0 ended possessions): cleared. The round is playable again from kickoff ("resume where possible").
  - **Otherwise, auto-finish:**
    - the start score is the device snapshot if its id matches, else the marker;
    - the remaining possessions are simulated with the per-sport sims (`simRest`: the `simBoth` logic moved out of `Match.tsx`), seeded `'resume:' + id`, with the human side at a −0.15 skill handicap, so killing the app is never better than playing on;
    - it settles through the mode's own path with `how: 'played'` and `finish: 'auto'`: SP at the sim rate, coins and card XP as normal, history `auto: true` (an AUTO chip in Club Records);
    - limit: 2 auto-finishes per ISO week, receipts `auto:<isoWeek>:<id>` in `hq.claims`;
    - **beyond the limit, forfeit:** a loss with 0 coins, XP and SP, history `ff: true`.

**Settlement** (`play.ts`): `settle(..., { finish?: 'auto' | 'forfeit', liveId })`.
- It is valid only with the matching marker id, and still rejects online, stale and mixed requests.
- `hq-state.ts` adds `ClubMatch.ff?` and `auto?`, kept by `normalizeHQ`.

**The sheet** (`UltimateTeam.tsx`, through the modal queue, once the pool is ready):
- "Match interrupted · Your Club Cups semi-final stopped at 12–18 in Q3. We finished it by simulation: 24–30, a loss. 1 more auto-finish this week; after that an interrupted match counts as a forfeit."
- A toast for a match that hadn't started.
- Cup, Circuit, Season and Draft PLAY buttons are inert until the marker is resolved.

**Never punished:** a crash in the menus (VS, pre-match, result, any UT screen) writes no marker.

**Contract B:** a confirmed solo quit takes the forfeit path for the four kinds.

**Tests:**
- `prematch.test.ts` (pure helper `preMatchOffer`): the capped day; SIM hidden for manual-only modes; objective chips match their counters; the length line per sport.
- `match-how.test.ts`:
  - offensive simmed share ≤ 0.25 → played, > 0.25 → sim;
  - defensive sims never count;
  - a manual-only human-played result always settles.
- `live-match.test.ts` (NBA + NFL) and `soccer-live-match.test.ts`:
  1. Auto-finish settles once each for Cup, Circuit, Club Season and Draft, with the right advancement.
  2. A not-started marker → cleared, playable again, nothing recorded.
  3. Stale → no double settlement.
  4. Another device < 30 min → untouched; ≥ 30 min → resolved.
  5. The third interrupted match in a week → forfeit.
  6. The device snapshot is preferred when its id matches.
  7. No marker for Squad Battles, Events or online.
  8. An old-shape save loads identically; a malformed `live` is dropped.
  9. Round trip: an old client drops `live`, and `ut.settled` still stops double settlement.
  10. The `simRest` result is deterministic per seed.

**Measurements and acceptance:**
- **Vote screen on solo games:** before about 13 s with a countdown (`vote.mjs`); after 0 s.
- **PreMatch:**
  - interactive ≤ 300 ms after setup;
  - PLAY and SIM visible without scrolling at 320×568, 375×667 and 393×852;
  - PLAY feedback ≤ 100 ms;
  - the first game frame, or the loading state, appears ≤ 1.5 s at 1×.
- **Marker cost:**
  - ≤ 2 profile writes per match during play, each ≤ 8 ms at 4× CPU (performance marks around App's save);
  - 0 long tasks > 50 ms from saves during a match (PerformanceObserver over a full autoplay match);
  - the hide snapshot takes ≤ 1 ms.
- **Interrupted sheet** shows ≤ 1 s after the pool is ready.
- **`ut-studio.mjs interrupt`** (NBA and soccer):
  - start a Cup round, finish ≥ 1 possession, hide the page, reload;
  - **before:** the same round shows PLAY;
  - **after:** the sheet shows, the round is recorded once, and coins match the auto-finish rules.
- 0 overflow, clipped or small targets on PreMatch at 3 sizes.

**Other details:**
- **Screenshots:**
  - PreMatch for Squad Battles, Cup, Circuit and UT Draft (3 sports, 393; NBA 375 and 320); a capped day; Auto-defend on (fake registry);
  - the interrupted sheet (auto-finish and forfeit); Club Records with AUTO and FF rows.
- **Protocol:** none. This holds while auto-finish and forfeit stay solo-only and the `how` rule counts offense only (§9).
- **Save-compat:** additive `ut.live`, the two device-local keys, and `hq.claims` quota strings.
- **Dependencies:** ut-3 (modal queue); contracts B, E and F wired at merge.
- **Touched outside my lane:** the `Match.tsx` stage hunk and one hook block. They are ut-owned parts, kept local; the same block is extended in ut-5.

**Files:** `src/ut/Match.tsx`, `PreMatch.tsx`, `prematch.css`, `match-how.ts`, `defense-pref.ts`, `live-match.ts` (new); `state.ts`, `play.ts`, `hq-state.ts`, `Clubhouse.tsx` (ClubRecords chips), `UltimateTeam.tsx`; tests.

**Commit split:** (1) PreMatch and the `how` rule; (2) the marker, auto-finish and the sheet.

---

### ut-5 · P0 · End-of-match reward sequence (M3), with OT, Rivals and the account level-up

**Changes**

**Recap data.** NEW `src/ut/match-recap.ts`: `recapOf(before, after, settled, ctx): Recap` holds:
- `coins {from, to}`;
- `sp {season, from, to, levelFrom, levelTo, next?}`;
- `cards[]`: the played squad, level-ups first, max 6;
- `objectives[]`: only those that moved;
- `rivals?`: points from and to, division from and to, promoted;
- `account?`: xp and level from and to, and level coins;
- `milestones[]`;
- `nextUnlock?`.

It is computed in `finish()` from the `ut` it already reads and the result of `settle`, and stored on `Outcome.recap`.

**Verdict:** `verdictOf(out, sport)` (contract G), including the dormant soccer `draw` branch.

**Ratings:** NEW `src/ut/match-box.ts` and `match-ratings.ts` (contract A). If there is no box, `null`, and the block is hidden.

**Sequence.** NEW `src/ut/MatchRecap.tsx` + `src/ut/match-recap.css`, used by `ResultView`. Beats under normal motion:
- **t0:** the verdict and a score count-up (400 ms).
- **≈ 500 ms:** player ratings and an MOTM card (`UtCard`), when present.
- **≈ 900 ms:** the coin count-up (600 ms), card XP bars and level-up pops. **Online:** the Rivals RP count-up (+30 / −12), the division bar, and a promotion beat inside the sequence, which replaces the `setPromotion` overlay for H2H results.
- **≈ 1.5 s:** the Season Pass bar, with a level burst and the reward name. The **account level-up** beat comes here, in the same language as `Results.tsx`.
- **≈ 2.1 s:** objective ticks. A completed objective gets an inline CLAIM (`ClaimButton`).
- **≈ 2.6 s:** the "Next unlock" line and ONE `PrimaryButton` "What's next", in the bottom 40%.
  - It uses the existing `again` logic (NEXT RUNG / NEXT CUP ROUND / NEXT CIRCUIT MATCH / SEASON HUB), or "CLAIM N REWARDS" from `utClaimables`.
  - DONE is a secondary text button. This needs no `next-action` and no dependency on ut-3.

**Sequence rules:**
- **Skip.** A tap anywhere jumps to the final state.
- **Reduced motion.** The final state shows at once: no count-ups, no bursts.
- **Haptics** fire only inside the CLAIM pointer handler. Timer-driven beats use sound only, because iOS queues a timed `vibrate` for the next touch.
- **Capped day.** It shows "Today's 8 paid games are played" instead of a 0 count-up.
- **Folded in.** The rung-cleared, Event-cleared, Draft-run, Circuit-prize and VIEW REWARD PACKS blocks fold into the milestones.
- **MatchDebrief** stays below the sequence.

**Account XP:**
- **What a paid UT match grants:** played +20 (+10 for a win), sim +5, within the 8 paid games.
- **Level coins.** Each level gained pays `LEVEL_UP_COINS` once (`profile.xp` only rises) and unlocks boosters as today.
- **Where.** In the same update as settlement, through `props.update`.

**`Match.tsx`** (the hook block from ut-4):
- `finish` builds the recap and passes `ends` and the adapted box into `settle` as optional inputs, for ut-6's counters, so ut-6 needs no `Match.tsx` edit;
- `stripLocal` before `conn.update`.

**Tests:**
- `match-recap.test.ts`: SP crossing a level; an objective completing; a card levelling; a capped day; a Circuit milestone; a Rivals promotion; an account level-up paid once.
- `verdict.test.ts`: OT by `ot` and by regulation count per sport; pens; draw; the tiebreak fallback.
- `match-ratings.test.ts`: monotonic per stat; MOTM is the maximum; absent or malformed data → null or ignored; soccer uses the report's `potm`.
- `account-xp.test.ts`: once per matchId; a capped day pays 0.
- `end-codes.test.ts` (contract G); `soccer-recap.test.ts` (2–2 reads DRAW; pens; never WIN for a level score).

**Measurements and acceptance:**
- **Timing.** Result mount to the primary button: ≤ 3.0 s. Reduced motion: ≤ 100 ms. Tap-to-skip: ≤ 100 ms.
- **Smoothness.** Count-ups hold ≥ 55 fps at 4× CPU, with no long task > 50 ms.
- **Primary button:** ≥ 56 px tall, in the bottom 40% of the frame, and exactly 1.
- **Haptics.** 0 `vibrate` calls outside pointer handlers (spy across a full sequence).
- **Online and Rivals.** Online results show the RP change and any promotion inside the sequence; the overlay no longer shows.
- **Soccer** 2–2 reads DRAW (before: WIN, `match-soccer-393-04-result.png`).
- **MatchDebrief** renders with the same metrics.
- 0 overflow, clipped or small targets at 3 sizes.

**Other details:**
- **Screenshots:**
  - win and loss (NBA, NFL), draw and pens (soccer), at 393, 375 and 320;
  - a level-up with an SP crossing; inline CLAIM; reduced motion;
  - with an injected box fixture (ratings + MOTM) and without;
  - online with Rivals promotion; the account level-up.
- **Protocol:** none. This is the presentation of settled data; draw wording only (§9).
- **Save-compat:** no new UT state. `profile.xp` and coins move through their existing fields.
- **Dependencies:** ut-4 (the `Match.tsx` block, back to back); contracts A and G at merge.

**Files:** `src/ut/match-recap.ts`, `match-box.ts`, `match-ratings.ts`, `MatchRecap.tsx`, `match-recap.css` (new); `Match.tsx` (`finish`, `Outcome`, `ResultView`, promotion), `play.ts` (optional `ends`/`box` inputs, the draw branch); tests.

**Commit split:** (1) recap logic, verdict and ratings with tests; (2) the sequence UI, Rivals and the account level-up.

---

### ut-6 · P1 · Objectives in layers, Scout Reveal, the streak shield, and full inbox coverage

**Changes**

**Dated definitions** (`objectives.ts`):
- v2 dailies start the day after `studioSince`; v2 weeklies start the ISO week after it;
- earlier days and weeks keep the legacy `DAILY`/`WEEKLY`, so banked objectives and their claim ids never change meaning;
- v2 ids use the same `daily:<day>:<id>` / `weekly:<week>:<id>` patterns, with new ids.

**Journal-backed counters** (§2):
- `recordMatchProgress` appends `x:<day>:skill|circuitWins|cupWins:<n>:<matchId>`;
- `extraTotals(hq, day | week)` reads them, memoised;
- skill comes from the box (adapter), with the end-code fallback (contract G).

**Per-sport targets.** NEW `src/ut/objective-targets.ts`, through `pick`. These targets are the only values tuned by the simulation; ids never change.

**Daily v2** (3, done in ≤ 3 matches):
- play 2;
- skill: NBA "Hit N threes", NFL "Score N touchdowns", soccer "Score N goals";
- a club task by day hash: open a pack / complete an SBC / win a match.
- **Rewards:** 75/75/50 coins (200 in all, unchanged) and 70/90/90 SP (unchanged).

**Scout Reveal** (the all-three bonus on v2 days; NEW `scout-reveal.ts`, `ScoutReveal.tsx`, `scout-reveal.css`):
- **Ids.** It uses the same claim `daily-bonus:<day>` and pack id `daily-bonus:<sport>:<day>`, so it cannot double-pay.
- **Odds.** It starts as a Silver Pack + 100 coins. Each of three taps may upgrade it: Silver → Gold 35%, → Premium Gold 25%, → Jumbo Premium 15%. The final odds are shown before the first tap: Silver 65.0%, Gold 26.25%, Premium 7.44%, Jumbo 1.31%.
- **Seed.** `hashString('scout-reveal:' + playerKey + ':' + sport + ':' + day)`: different per player, and a reload can't reroll it.
- **Presentation:**
  - each tap is a 600 ms beat with a rising pitch;
  - the haptic fires only in the tap handler;
  - tap-to-skip resolves all three; reduced motion shows the result.
- **CLAIM ALL** resolves it automatically with the same seeded outcome and lists the result. The Daily tile keeps the 3-tap ritual.

**Weekly v2** (6, Monday):
- **The six:** play 8; win 5; complete 2 SBCs; win 2 Champions Circuit matches; open 3 packs; win a Club Cup round.
- **Each pays** 100 coins and 120 SP.
- **Chests:** 4/6 → a Premium Gold Pack (`weekly-chest:<week>:4`); 6/6 → a Scout's Choice pick (`weekly-chest:<week>:6`), plus a Program Key if packs ships keys (contract D).

**Inbox and CLAIM ALL** (`inbox.ts`, `InboxView.tsx`, `claimables.ts`):
- the chests and Scout Reveal become items;
- `claimAll` cascades up to 3 passes when one claim unlocks a chest in the same transaction;
- InboxView is restyled with the kit, with an `EmptyState` when everything is claimed.

**Streak shield.** NEW `src/ut/streak.ts`:
- **`streakView(ut, day, now)`** gives `atRisk`, `hoursLeft`, `shieldReady` and `shielded`.
- **One shield per ISO week:**
  - the receipt is `shield:<isoWeek>:<day>` in `hq.claims`;
  - when exactly one day was missed, it bridges `content.daily.day` to yesterday before packs' `claimDaily`, in the same update;
  - every claim path uses it (`claimDailyDrop` and CLAIM ALL).
- **Packs.** If packs adds a `grace` option to `claimDaily`, ut switches to it at merge. Until then, writing that one packs-owned field is listed under "Touched outside my lane", with packs' sign-off requested.
- **UI:** the shield pip on DailyHubView and the hub Daily tile.

**ObjectivesView:** groups DAILY · WEEKLY (with the 4/6 and 6/6 chest bar) · CLUB · SAVED.

**DailyHubView:** the Scout Reveal tile; login-calendar day labels ≥ 10 px (L2).

**Doability simulation.** NEW `scripts/ut_daily_sim.ts`, run with `bash O/heavy.sh npx vite-node scripts/ut_daily_sim.ts`:
- **Sessions:** per sport, 1,000 seeded 3-match and 5-match sessions at Pro skill, through the engines' exported sims (`aiPossessionsOf`, `aiDrivesOf`, soccer `aiProgress`). Possession and drive counts are read from the engines, never hard-coded.
- **Reports:** the median number of matches to finish all three v2 dailies; % finished within 3 and within 5; and weekly 6/6 reachability for the engaged profile (8 matches a day × 5 days, 500 sims).

**Tests:**
- `objectives-v2.test.ts`:
  - a legacy day keeps the legacy defs, and banked legacy rewards claim once;
  - a v2 day has 3 objectives;
  - the chests claim once each;
  - the stamp boundary for day and week.
- `journal-counters.test.ts`: counted once per matchId; they survive the old-client round trip.
- `scout-reveal.test.ts`:
  - 100,000 seeds → each bucket within ±0.5 points;
  - the same player, day and sport always give the same result;
  - ≥ 2 distinct outcomes across 100 player keys on one day;
  - exactly one deposit;
  - CLAIM ALL gives the same outcome as the taps.
- `streak.test.ts`:
  - the 4 h window;
  - one missed day is bridged once per ISO week; two missed days reset;
  - the shield is not used when not needed;
  - an old save loads; both claim paths agree.
- `inbox-completeness.test.ts`, extended to the new items; `claim-all-cascade.test.ts`; `soccer-objectives.test.ts`.

**Measurements and acceptance:**
- **Dailies** (sim on ut's branch; re-run on the merged engines, §10), per sport: median matches ≤ 3; ≥ 80% done within 3; ≥ 95% within 5.
- **Weekly 6/6** is reachable by the engaged profile in ≥ 90% of sims.
- **Scout Reveal** shown odds = simulated odds, ±0.5 points.
- **Save meaning.** No banked legacy objective changes meaning (fixture test). The old-save fixtures and round trip are green.
- **Streak.** The warning shows only in the last 4 h (fixture clock). The shield is used ≤ 1 per ISO week.
- **CLAIM ALL** clears every claimable in 1 tap, including the cascade.
- 0 targets < 44 and 0 text < 10 px on Objectives, Daily and Inbox at 3 sizes.

**Other details:**
- **Screenshots:**
  - Objectives (daily, weekly with chests); Daily with Scout Reveal before, during and after; the odds sheet;
  - the shield pip; Inbox before and after CLAIM ALL;
  - 3 sports at 393; NBA at 375 and 320.
- **Protocol:** none (rewards and counters only).
- **Save-compat:** date-versioned by the stamp; counters in `hq.journal`; receipts in `hq.claims`.
- **Dependencies:** ut-1 and ut-5 (settle inputs); packs (`grace` option, Program Key).

**Files:** `src/ut/objectives.ts`, `objective-targets.ts` (new), `progression.ts`, `daily-hub.ts`, `scout-reveal.ts`, `ScoutReveal.tsx`, `scout-reveal.css`, `streak.ts` (new), `inbox.ts`, `InboxView.tsx`, `claimables.ts`, `Clubhouse.tsx` (ObjectivesView), `DailyHubView.tsx`, `UltimateTeam.tsx` (claim paths), `scripts/ut_daily_sim.ts` (new), tests.

**Commit split:** (1) dated defs, counters, daily and weekly v2, chests, inbox and the simulation; (2) Scout Reveal; (3) the streak shield.

---

### ut-7 · P1 · Season Pass hero (M10), competitive pay, the starter chain, and the coin-flow table

**Changes**

**Season Pass presentation (M10)** (`Clubhouse.tsx` `SeasonView`/`SeasonRibbon`, NEW `season-pass.css`). The v1 scheme is kept; §8 explains why.
- **The hero:**
  - the top reward's art from day 1 (the level-25 pack via `PackArt`; soccer Elite Gold);
  - the calendar season's name and accent (packs' season data through a seam; a plain theme without it);
  - the countdown to the season's end;
  - "N levels to <named reward>" (the goal gradient points at the next named reward).
- **Track and claiming:**
  - the track opens centred on the current level; a next-3 strip;
  - claiming uses `ClaimButton`;
  - the GO line: "Earn 180 SP → Level 7: Gold Pack" with PLAY and "≈ 2 played matches".
- **Space:** no empty band below the track.
- **Extras:** packs' `calendarPassExtras` show as a second chip, only in seasons that start after the stamp (contract D).

**Champions Circuit** (`circuit.ts`, `CircuitView`, PreMatch offer):
- `CIRCUIT_WIN_COINS = [40, 50, 60, 70, 80, 100]` by round, paid inside `settleCircuit` in the same transaction; the settled matchId is the receipt;
- milestones at 2, 4 and 6 wins are unchanged;
- 6-0 from the week after the stamp → a Program Pick (soccer: Elite Gold); 4 wins add a Program Key only if packs ships keys (contract D);
- a per-win ladder in `CircuitView`; PreMatch's offer shows "+70 coins for this win".

**Rivals weekly** (`rivals.ts`, `Rivals.tsx`, `inbox.ts`):
- **Rewards:** 5 and 10 wins in the current week (`rivals.w`), coins only: 250 / 500 × the division factor (Rookie 1, Pro 1.25, All-Star 1.5, Elite 2, Legend 2.5).
- **Receipts** in `hq.claims`: earned `rivals:<week>:w5` when the win settles, claimed `rivals:<week>:w5:c`. `rivals.rewards` is never touched, so an old client's `rivalsOf` can't turn them into division packs.
- **Where it shows:** an inbox item, a recap line and a track row in `Rivals.tsx`.
- **Counting:** online wins only; AI stand-ins don't count (a lead decision, §11). Copy: "Online wins count".

**Starter chain.** NEW `src/ut/starter.ts`:
- **Enrolment:** `starter:enrolled` goes into `hq.claims` the first time the chain is eligible (`packsOpened ≤ 1 && record.w + record.h2hW === 0`). It is saved, so step 4 never disappears after step 3. Existing players are never paid after the fact.
- **Four steps, each paid once** (`starter:<n>`):
  1. open your free pack: 200 coins;
  2. fill your squad: a Silver Pack;
  3. win a Squad Battle: a Gold Pack;
  4. complete your first SBC: a Premium Gold Pack.
- **Where it shows:** next-action step 0 (ut-3's `chain` slot), a compact chain card with a 1-tap GO per step, and inbox items.

**PlayHQ tiles** (`Clubhouse.tsx`): up to 2 objective chips per tile ("Win 1 · daily", "1 win → Finalist"). The tile is no taller at 320.

**Coin-flow script.** NEW `scripts/ut_coinflow.ts`: ONE table for every ut faucet (§7):
- per first hour, per later hour and per day; casual and engaged; before and after;
- NBA prices, with the NFL and soccer factors; packs and picks valued at quick-sell EV from `packDefs`;
- it writes the table into ut.md, and runs again in ut-9 and at integration with packs' final prices and odds.

**Tests:**
- `season-pass-view.test.ts`: next named reward; levels-to; extras only in future seasons and only once.
- `circuit-pay.test.ts`: each round pays once (replayed or stale settlement pays 0); the 6-0 swap only after the stamp week, once.
- `rivals-weekly.test.ts`:
  - 5/10 once per week; old division rewards and their coins unchanged; a reload keeps the receipts;
  - the round trip through `acdf3e2`'s `rivalsOf` pays nothing extra.
- `starter.test.ts`: enrolment survives step 3; never retroactive; once per step; each GO target exists.
- `coinflow.test.ts` asserts the §7 caps.
- `economy.test.ts` still passes unedited.

**Measurements and acceptance:**
- **Economy:**
  - engaged UT value per day ≤ +30%, casual ≤ +35% (quick-sell valued, including packs and picks);
  - the per-hour lines are stated;
  - `economy.test.ts` bounds hold (days to a gold squad: 3–9 seller, 5–12 keeper).
- **Season Pass:** the hero, with art and countdown, is above the fold at 320×568, 375×667 and 393×852.
- **Starter chain:** finished in ≤ 25 min from a fresh profile in a Playwright run (autoplay matches). Each step's GO lands on the right screen in 1 tap.
- **Play page:** ≤ 2.1 screens at 393 and ≤ 2.4 at 320 after the chips (before measured in ut-0).

**Other details:**
- **Screenshots:**
  - the Season Pass hero and centred track (3 sports at 393; NBA at 375 and 320);
  - the Circuit ladder; the Rivals weekly track; the starter chain on UT Home; PlayHQ chips.
- **Protocol:** none (rewards only; Rivals points and boards unchanged).
- **Save-compat:** `hq.claims` receipts only.
- **Dependencies:** ut-3 (chain slot), ut-5 (recap lines), ut-6 (inbox items); packs (season data, `calendarPassExtras`, keys, the Program Pick source).

**Files:** `src/ut/Clubhouse.tsx` (SeasonView, SeasonRibbon, CircuitView, PlayHQ), `season-pass.css` (new), `circuit.ts`, `rivals.ts`, `Rivals.tsx`, `starter.ts` (new), `next-action.ts`, `inbox.ts`, `claimables.ts`, `PreMatch.tsx` (offer line), `progression.ts` (extras), `scripts/ut_coinflow.ts` (new), tests.

**Commit split:** (1) competitive pay and the coin-flow table; (2) the Season Pass hero; (3) the starter chain and chips.

---

### ut-8 · P1 · Collection, Development and Sets (M4, M5, M12); navigation motion; the kit on the remaining screens

**Changes**

**Development (M4)** (`Clubhouse.tsx` `DevelopmentView`):
- a summary header: the active program card, its progress, and CLAIM or PLAY (GO);
- the owned-copy grid moves into a bottom `Sheet` picker with search (`data-sheet-noswipe` on the grid);
- the Evolutions Lab row comes first.

**Collection (M4, M5, M12)** (`CollectionGallery.tsx`):
- **Header:** the three closest sets ("1990s Bulls · 7/8 · 1 card away" → GO, following the ethics rule) and per-tier completion bars.
- **Set grades** on each set tile: S complete, A ≥ 75%, B ≥ 50%.
- **The old meter.** "39 / 22,082 editions" becomes a footnote.
- **Filters** collapse into one sticky chip row.
- **Special tiers** list the special editions that can be resolved, through packs' modules, read-only: weeks seen via `standoutProgram`, `landmarkCards` and started programs via `promoCards`. A tier with 0 editions is hidden.
- **Missing cards** render in full colour at 40% opacity with an SVG lock (CSS around `UtCard`).
- **Grid performance:**
  - the grid is windowed;
  - portraits are lazy: an IntersectionObserver renders `CardArt` only for visible rows, with a plate placeholder otherwise.

**Sets** (`SetsView.tsx`): a summary header (ready / near / done), a near-miss pill with GO, and a grade chip.

**Evolutions** (`EvolutionsView.tsx`): "2 games, 1 win to go", with PLAY (card in squad) or ADD TO SQUAD.

**Navigation motion** (`UltimateTeam.tsx` view switch; kit tokens):
- **Transitions:** push and pop transitions; a tab crossfade.
- **Edge-swipe back on UT sub-pages:**
  - starts ≤ 16 px from the left edge, travels ≥ 64 px, with |dy| < 32;
  - ignored on `[data-noswipe]`, sheets, carousels and matches;
  - nothing under reduced motion, except an instant back.

**Kit pass on screens no other task restyles:** Club Players, Storage, SquadView headers, LeagueSeason, StreamlinedView, Events, Battles, Moments, CupView and DraftView.
- `SectionTitle`, `EmptyState` and spacing tokens only; no layout restructure;
- ≤ 20 lines per file where possible.

**Low-priority audit items:**
- **L3** (`Events.tsx`): an edge fade and a "more" chevron on the tab row.
- **L4** (`SquadView.tsx`): two-line name plates; the NFL OL row at 320.
- **L9** (`Battles.tsx`): the "outclasses Rookie" nudge, with the pure helper `recommendedLevel`.
- **L2:** the remaining ut-owned "NEW" tags ≥ 10 px.

**Tests:**
- `collection-goals.test.ts`: closest-sets ordering; grades; special tiers non-empty for a pool with Standouts and Landmarks; empty tiers hidden. `soccer-collection.test.ts`.
- `battles-nudge.test.ts`.
- `swipe-back.test.ts`: the pure gesture classifier; ignore rules.

**Measurements and acceptance** (walk metric = content height / viewport):
- **Development:** before 4.8 (NBA) / 6.1–6.2 (NFL) / 5.5 (320); after ≤ 2.0 at 393 and ≤ 2.5 at 320.
- **Collection:** before 3.4 / 4.0; after ≤ 2.5 / ≤ 3.0.
- **Club Players** ≤ 2.8 (no growth).
- **Collection chips:** 0 chips showing "0 editions".
- **Collection performance:** first render ≤ 300 ms at 4× CPU; 0 long tasks > 100 ms while scrolling the whole grid.
- **Motion:**
  - push ≤ 220 ms; 0 under reduced motion;
  - edge-swipe back works on 5 sub-pages and never fires in a match, sheet or carousel (Playwright touch).
- **Feedback** ≤ 100 ms on every button of these screens.
- **Empty states.** Every list that can be empty shows an icon, a line and a CTA: Collection filters, Storage, Sets done, Evolutions none, Moments none.
- **Reduced motion:** no running animations on these screens.

**Other details:**
- **Screenshots:**
  - before and after: Development, the picker sheet, Collection (a LANDMARK/STANDOUT filter and the missing-card look), Sets, Evolutions;
  - the Battles nudge; the Events tab edge; NFL Squad at 320; one contact sheet per sport.
- **Protocol:** none (UI; the nudge only changes which difficulty is chosen).
- **Save-compat:** none.
- **Dependencies:** ut-0 and ut-1; players (`UtCard`); packs (read-only modules).

**Files:** `src/ut/Clubhouse.tsx` (DevelopmentView), `CollectionGallery.tsx`, `collection.ts`, `SetsView.tsx`, `sets.ts`, `EvolutionsView.tsx`, `UltimateTeam.tsx` (transitions, swipe), `Events.tsx`, `Battles.tsx`, `battles.ts`, `SquadView.tsx`, `Club.tsx`, `LeagueSeason.tsx`, `StreamlinedView.tsx`, `Moments.tsx`, `CupView.tsx`, `DraftView.tsx`, the ut CSS files, tests.

**Commit split:** (1) Development, Collection and Sets; (2) motion and swipe; (3) the kit pass and L items.

---

### ut-9 · Final QA · every-screen walk, defect fixes, full verification, docs

**Changes**

**The walk.** `ut-studio.mjs walk <sport> <size> --edge` covers:
- every UT tab, segment and sub-screen; PreMatch; a played-out result (autoplay); the interrupted sheet; Scout Reveal;
- the main Home, Profile, Missions, Gauntlet, draft Results and the first run;
- NBA, NFL and soccer at 393×852 (59/34), 375×667 (20/0) and 320×568.

**Per-screen checks:**
- overflow, clipping, targets < 44 and text < 10 px;
- contrast ≥ 4.5:1, or ≥ 3:1 for bold text ≥ 18.66 px;
- the topmost control ≥ sat + edge; page errors;
- dead taps (with the denylist, a fresh context per screen) and tap feedback ≤ 100 ms;
- under `--rm`: every new animated class computes `animation-name: none`, and count-ups show their final values;
- contact sheets per sport go to `O/shots/ut/final/`.

**Fixes.** Fix every defect found in ut-owned files. List the others in ut.md for their teams.

**Full verification** (each heavy command once, through `heavy.sh`):
- typecheck; `npm test`; `npm run build`;
- compare against `acdf3e2`: entry chunk, UT chunk and new ut CSS;
- the old-save fixtures and the round trip on the final state;
- re-run `ut_coinflow.ts` and `ut_daily_sim.ts`.

**Docs:**
- `ut.md` complete:
  - before/after numbers for each task, and tests;
  - the Protocol line (§9), "Touched outside my lane", owner device checks and the coin-flow table;
  - deferred items, the integration checklist (§10) and lead decisions (§11);
  - the strings owned by other teams, for a later rename.
- `docs/UI-NAVIGATION.md`: hub, PreMatch, GO links, badges, motion.
- `docs/UT-OVERHAUL.md`: a studio section.

**Measurements and acceptance:**
- **Walk results** (3 sports × 3 sizes): 0 dead taps; 0 overflow; 0 clipped; 0 ut-owned targets < 44; 0 ut-owned text < 10 px; 0 contrast failures; 0 page errors; tap feedback ≤ 100 ms on claim, GO and CTA taps.
- **Tests and build.** `npm test` passes in NBA, NFL and soccer; `npm run build` passes.
- **Size against `acdf3e2`:** entry chunk ≤ +2 KB gzip (including `UtBridge` and `ut-bridge.css`); UT chunk ≤ +40 KB gzip; new ut CSS ≤ 12 KB gzip.
- **Saves.** The old-save fixtures (3 sports) load with every coin, card, level, XP, squad, streak, receipt and season intact. The round trip loses no receipt.
- **Docs.** ut.md is complete; every deferred item has its reason.

**Other details:**
- **Screenshots:** the full walk and the contact sheets.
- **Protocol:** none (§9).
- **Save-compat:** verified.
- **Dependencies:** all previous tasks.

**Files:** fixes across ut-owned files; `scripts/qa/ut-studio.mjs`; `docs/studio-overhaul/ut.md`; `docs/UI-NAVIGATION.md`; `docs/UT-OVERHAUL.md`.

---

## 6. Order and dependencies

```
ut-0 ─ ut-1 ─┬─ ut-2
             ├─ ut-3 ─ ut-4 ─ ut-5 ─ ut-6 ─ ut-7 ─┐
             └─ ut-8 ─────────────────────────────┴─ ut-9
```

- **P0:** ut-0, ut-1, ut-2, ut-3, ut-4, ut-5. **P1:** ut-6, ut-7, ut-8. **QA:** ut-9.
- **`Match.tsx` changes** happen only in ut-4 and ut-5, back to back, in one hook block. ut-6 gets `ends`/`box` through `settle` inputs, so it needs no `Match.tsx` edit.
- **ut-5** does not depend on ut-3: its "What's next" uses the existing `again` logic and the claimables count.
- **ut-2 and ut-8** can run in any slot after ut-1. ut-8 is ordered last before QA so it applies the kit after the other screens settle.

---

## 7. Coin and pack flow (one table; estimate, recomputed by `scripts/ut_coinflow.ts`)

**Assumptions:**
- **Prices and values.** NBA prices. Packs and picks are valued at quick-sell EV ≈ 0.5 × store price (packs targets 0.40–0.60): Silver 200, Gold 450, Premium 900, Jumbo 1,800, Scout's Choice 325, Bronze 125, Spotlight ≈ 1,085 (packs' measured 0.31).
- **Matches.** Solo games about 5 min (owner decision 3), at Pro pay: win 60 coins, loss 30.
- **Engaged player:**
  - 8 paid matches a day at a 60% win rate, then about 4 unpaid matches in the rest of the first hour;
  - all dailies and all weeklies;
  - 2 Circuit entries a week at 3.5 wins;
  - Rivals with online opponents at Pro; the full v1 pass.
- **Casual player:** 3 matches a day at a 50% win rate, all dailies, weeklies as listed, no Circuit or Rivals.
- **Scope.** Unchanged sources are left out on both sides: Rivals division rewards, Cups, Club Season, SBCs and packs' Daily Drop/calendar.

| UT value | Before | After | Change |
|---|---|---|---|
| Matches (8 paid × 48 avg) | 384 | 384 | 0 |
| Daily objectives (coins) | 200 | 200 (75/75/50) | 0 |
| Daily bonus → Scout Reveal | 100 + Silver = 300 | 100 + EV(0.65·200 + 0.2625·450 + 0.0744·900 + 0.0131·1,800 = 339) = 439 | +139 |
| Weekly objectives ÷ 7 | (250 + Gold + Silver) / 7 = 129 | (6 × 100 + Premium + Scout's Choice) / 7 = 261 | +132 |
| Circuit milestones ÷ 7 (2 and 4 wins hit) | 164 | 164 | 0 |
| Circuit per win (2 entries × ≈ 228) ÷ 7 | 0 | 65 | +65 |
| Rivals weekly 5 wins at Pro (312) ÷ 7 | 0 | 45 (0 with no opponents) | +45 |
| Account level-ups (≈ 208 XP/day, ≈ 0.26 level × 50) | 0 | 13 | +13 |
| v1 Season Pass ÷ 28 (2,400 coins + 5,760 in packs) | 291 | 291 | 0 |
| **Engaged per day** | **1,468** | **≈ 1,862** | **+26.8% (cap +30%)** |
| **Casual per day** (3 × 45 matches; dailies; Scout Reveal; weeklies before 2/3, after 4/6 + Premium chest) | **1,026** | **≈ 1,256** | **+22.4% (cap +35%)** |
| **Engaged, first hour** (8 paid + 4 unpaid games, dailies done) | 884 (384 + 200 + 300) | ≈ 1,023, + up to ≈ 390 if those games are a Circuit entry | +16% to +60% (the upper end is front-loaded Circuit pay) |
| **Engaged, each later hour** (12 unpaid games) | 0 coins; SP only (matches 9–16 ≈ 760 SP ≈ 290 in pass value until the pass is full) | the same + Circuit per win (≤ 390 per entry, ≤ 3 entries a week) + Rivals thresholds when hit | lumpy, bounded weekly |
| One-time starter chain (new players only) | 0 | 200 + Silver + Gold + Premium = 1,750 | one-time |

**Other sports.** Match coins are the same in NFL and soccer. Pack values scale by each sport's prices: NFL Silver 320, Gold 900, Premium 1,400, Scout 250, Jumbo 2,700; soccer 380, 900, 1,600, 500, 3,200. The script prints all three sports.

**Program supply:** ≤ 1 free program card a week (the Circuit 6-0 Program Pick), and 0 Headliners.

**Re-run at integration** with packs' final prices and odds, and with `calendarPassExtras` added (§10).

### Deviations from the research, with reasons

| Item | Research | This plan | Why |
|---|---|---|---|
| Circuit per-win pay | 100, 150, 200, 250, 300, 400 | 40, 50, 60, 70, 80, 100 | The research numbers fit a FUT-sized coin scale. Ours pays 60 coins a win, and the research pay alone would add ≈ +100% to an engaged Circuit week, past the +30% cap. |
| Scout Reveal | starts at Gold; 30 / 20 / 10% up to Headliners (final 34.3 / 50.7 / 14.4 / 0.6) | starts at Silver; 35 / 25 / 15% up to Jumbo (65.0 / 26.25 / 7.44 / 1.31) | The research version is worth ≈ +580 a day against ≈ +139. Headliners is packs' new kind under owner decision 4. Revisit with packs' final prices. |
| Daily rewards | 150 coins + 200 SP each | 75 / 75 / 50 coins + 70 / 90 / 90 SP (totals unchanged) | The v1 Season Pass stays (§8), so v2 SP amounts don't apply. The coin budget goes into the Scout Reveal instead. |
| Weekly rewards | 500 SP each; 4/6 Premium; 6/6 Front Office Pick + Program Key | 100 coins + 120 SP each; 4/6 Premium; 6/6 Scout's Choice (+ a Program Key only if packs ships keys) | No "Front Office Pick" item exists. Keys belong to packs. v1 SP scale. |
| Season Pass | 30 × 1,000 SP from the next season | v1 kept; M10 presentation only | deferred (§8) |
| Program objective group | 5–8 objectives; group complete = a free program card | deferred | supply under packs' new odds (owner decision 4) |
| Login stamp 50 SP; Evolutions on the pass | yes | deferred with Season Pass v2 | On v1, 50 SP a day adds ≈ 4.7 tiers a season. |

---

## 8. Deferred (with reasons)

| Item | Reason |
|---|---|
| **Season Pass v2** (30 × 1,000 SP, level 1 granted, overflow; Evolutions at 7 and 22; program picks at 10/20/25; 50 SP login stamp) | **The brief makes it optional** ("Any new 30-level scheme…"), and the 10-task cap forces a choice. **Highest save risk:** an old client strips v2 state, and the release date is unknown (season 2 starts 23 Nov 2026). **Safety design recorded for the next round:** v2 decided by season number alone (from the first season after the studio stamp); v1 records ignored for those seasons; level receipts `pass2:<season>:<level>` in `hq.claims`, with the SP floor rebuilt from the highest claimed level; a mixed-client round-trip test; total value ≤ 2× v1 unless the lead approves. Themed extras through `calendarPassExtras` still ship (ut-7). |
| Program/promo objective groups | **Supply.** Free program cards are an economy decision under packs' new odds and pity (owner decision 4). Packs' Program Hub has an `objectives` slot. **Rule recorded for the next round:** one group per wave, 5–8 objectives needing ≥ 10 matches, ≤ 1 program card per wave, counted from `hq.journal` within the wave, claims in `hq.claims`. |
| Card-attached signature objectives | Need the merged box data (contract A). No invented stats. |
| Depth Gauntlet | A new mode, the lowest brief priority ("if time permits"). |
| In-match HUD objective chip | The HUD belongs to the sport teams. ut shows objectives before and after the match; a `trackedObjective` prop is offered in ut.md. |
| Labels: routing the remaining legacy strings | P2, and the brief says "labels.ts is optional; never change wording". The module, nav titles, Match titles and every new string go through it. The remaining call sites are listed in ut.md. |
| Restructuring LeagueSeason, StreamlinedView, Club Players and Storage | They get the kit pass (ut-8) and all walk defects fixed (ut-9). A layout restructure is a later round: these are Codex screens with their own QA scripts, and no audit item asks for it. |
| Squad Battles rung-1 opponent floor (M3) | Changes the ladder shape `match.test.ts` asserts. The L9 nudge covers the blowout. |
| Squad Battles 4 opponents and weekly ranks; Solo Run; Rivals Bounties; breakable checkpoints; season milestones; tiered achievements | Outside the brief's scope list; they change mode structures. |
| Push "Daily Drop ready" (hook 11) | Needs a push backend; live services are off limits. |
| How-to carousel; draft "DM/CM" legend; Ranks offline (L8) | Not ut files; flagged to the lead. |
| Mode renames (H6) | Owner decision 1: names stay. |
| A main-app daily chest streak shield | The chest is claimed on every open, and its state is in `src/lib/profile.ts` (lead). The shield ships for the UT Daily Drop streak. |

---

## 9. Protocol summary (conditional)

**Expected ut.md line:** "Protocol bump needed: none from team ut", **as long as all of these hold:**
1. `how` comes only from the human's offensive possessions. Auto-defend and defensive SIM never change how a result settles (contract F).
2. Interrupted-match auto-finish and forfeit, and solo quit, apply only to solo modes. They never apply to online H2H, whose forfeit is the sport teams' wire rule.
3. Soccer does not change how UT draws settle. If it adds three-way UT draws, that is soccer's UT bump, and ut ships the contingency (contract G).
4. ut changes nothing in `teams.ts`, the ratings used in matches, or pairing.

**When it is checked again:** at integration, by the lead (§10 item 14).

---

## 10. Integration checklist for the lead (also in ut.md)

1. **Claimables.** Re-run `claimables.test.ts` and `claimables-reimpl.test.ts` against packs' final `content-packs.ts`, `daily-hub.ts` and `promo-hub.ts`. Fill `packs-claimables.ts` with packs' body.
2. **Defense preference.** Register the sport modules in `defense-pref.ts`: nba `prefs.ts`, soccer `prefs.ts`, and nfl's module.
3. **Box data.** Wire `onBoxScore` (nfl) and `onReport` (soccer) from `Match.tsx` into `Arcade`. Check that no box rides the wire (nba's `Arcade.progress()` strip plus ut's `stripLocal`).
4. **`src/game/progress.ts`.** Add `box?`, `simmed?`, `ot?` and `forfeit?` once, and assign the file an owner. Re-run `match-how.test.ts`.
5. **Dailies.** Run `scripts/ut_daily_sim.ts` on the merged engines. Change only `objective-targets.ts` values, never ids.
6. **Interrupted matches.** Re-run `live-match.test.ts` (3 sports) on the merged engines: defense possessions, OT and the `simRest` sims.
7. **Verdict and end codes.** Re-run `verdict.test.ts` with real OT and pens, and `end-codes.test.ts` with the final vocabulary.
8. **Coin flow.** Re-run `scripts/ut_coinflow.ts` with packs' final prices and odds plus `calendarPassExtras`. The caps must hold.
9. **Recap screenshots** with real box data (3 sports).
10. **Curtain.** Shell's `curtain: 'compact'` variant, or a recorded decision to accept the double matchup.
11. **Packs' screens.** `PromoLaunch` goes through ut's modal queue. The `program` and `stamps` nav entries de-duplicate.
12. **Shell's real CSS.** Walk with shell's actual Fix A instead of the injected CSS (the topmost-control check).
13. **Mixed clients.** Run the round trip with every team's merged normalizers and additive fields.
14. **Protocol.** Confirm §9's conditions.
15. **Shell's season chip.** `.ut-season-chip` is gone, so shell's rule is dead.
16. **L2 tiny text** "Find your rhythm. Own the game." (`Pages.tsx` Training Camp row, 9 px). It is in no team's grant; raise it to ≥ 10 px.
17. **Streak shield.** Packs' `claimDaily` `grace` option, if added: switch `streak.ts` to it.

## 11. Open lead decisions (flagged, not acted on beyond the stated default)

1. **Rivals weekly wins.** Should AI stand-in wins count? Default: no, online wins only.
2. **Rivals rage-quit.** Killing the app mid online Rivals match avoids the −12 RP loss.
   - **Proposal:** an `ut.live` kind `'rivals'` that applies the loss on relaunch, and lets `rivals-net` re-publish the standing.
   - **Not built:** fairness with real crashes is a product call, and online settlement is not ut's to change alone.
3. **Interrupted matches.** The auto-finish limit (2 a week) and the human-side handicap (−0.15).
4. **Season Pass.** The v1 tier-25 Spotlight pack for seasons after the stamp (packs' ladder). Default: unchanged.
5. **Circuit 6-0** Spotlight pack → Program Pick from the week after the stamp. Packs requested it. Default: on.
6. **Account XP from UT matches.** About +13 coins a day.
7. **The owner of `src/game/progress.ts`.**

## 12. Owner device checks (things only a real iPhone can confirm)

**Chromium can't cover these: WebKit is not installed here.**
- the Live Now scroll-snap and edge fade;
- the sticky Collection chips and mask-image fades;
- the Development picker sheet's swipe-to-close against the grid;
- edge-swipe back in the installed app.

**Feel:**
- the main badge, Home pill and chip under the Dynamic Island fix;
- the length of the post-match sequence (≈ 3 s) and tap-to-skip;
- the Scout Reveal rhythm.

**Haptics:** they fire only on taps (CLAIM, Scout Reveal), never late on an unrelated tap.

**App-icon badge:** `setAppBadge` on a home-screen app. It may need notification permission on iOS, which the app never requests, so it may show nothing; that is acceptable.

**Flows:**
- the interrupted-match sheet after force-quitting during a Cup round, and after iOS evicts the app in the background;
- the first-run welcome sheet on a fresh install;
- 375×667 (iPhone SE) on a real device.

---

## 13. Critique response (every point)

### Missing

| # | Point | Where |
|---|---|---|
| 1 | Owner decision 2: defense control, Auto-defend, SIM, saved preference, `how` | contract F; ut-4 (PreMatch control, `match-how.ts`, length line) |
| 2 | Owner decision 3: per hour; per-sport targets; re-run on merged engines | §7 (per hour); ut-6 (`objective-targets.ts`; the sim reads engine counts); §10 item 5 |
| 3 | Ties, OT, three-way draws | contract G; ut-5 verdict and the dormant draw branch |
| 4 | Incomplete re-implementation list; re-run at merge | ut-1 (list extended); §10 item 1 |
| 5 | Cold-start badge | ut-1 (`hq.poolClaimables` + cold-start rule + test); ut-2 acceptance |
| 6 | Seams for packs' claimables, views and launch | contract H; ut-1 (stub, nav ids); ut-3 (modal queue) |
| 7 | New-and-unseen dot | ut-1 (`hq.seen`); ut-3 (dots) |
| 8 | Rivals in the recap; online promotion | ut-5 |
| 9 | Inbox and CLAIM ALL coverage; Scout Reveal under CLAIM ALL; cascade | ut-6 (chests, Scout Reveal resolved automatically, cascade test); ut-7 (Rivals 5/10, starter steps, extras). Pass v2 and program groups are deferred. |
| 10 | Visual pass skips screens; Gauntlet and Results get no work | ut-2 (Gauntlet, Results); ut-6 (InboxView); ut-3 (SeasonBanner); ut-8 (kit pass on the rest); ut-9 (defects on every screen). Restructures deferred (§8). |
| 11 | SeasonBanner chip | ut-3 folds it into Live Now; shell told (§10 item 15) |
| 12 | L2 Training Camp line | §10 item 16 |
| 13 | Rivals rage-quit | §11 item 2 |
| 14 | Starter enrolment | ut-7 (`starter:enrolled` in `hq.claims`) |
| 15 | PreMatch vs M9 | contract E; ut-4 ("LOADING ARENA…", compact curtain) |
| 16 | Research and audit items missing | Season theming: ut-7. Program picks at 10/20/25, 50 SP stamp and Evolutions on the pass: deferred with v2 (§8). Set grades: ut-8. "With your club": contract J. Circuit 4-win key: ut-7, conditional. |
| 17 | Deviations from research undocumented | §7 table |
| 18 | "Movements" spec; 100 ms rule | ut-0 (motion tokens, press feedback, probe); ut-8 (transitions, edge-swipe); ut-9 (measured) |
| 19 | Owner device checks: WebKit, `setAppBadge` | §12 |
| 20 | Cheap routes | contract D; ut-7 (Circuit 6-0 swap); §11 item 4 (tier 25) |

### Restructure

| # | Point | Response |
|---|---|---|
| 1 | Visual-system foundation early | Done: ut-0 |
| 2 | QA harness and fixtures first | Done: ut-0 (shell's Fix A injected, old-save fixtures, round trip) |
| 3 | Split ut-2 | Done: main app in ut-2; in-UT GO links spread to ut-1, ut-7 and ut-8, next to their screens |
| 4 | Split ut-3 | **Rejected as a separate task** (10-task cap). Logic and UI are separate commits; ut-5 no longer depends on it. |
| 5 | Split ut-4 | **Rejected as a separate task** (cap). Two commits. Scope grew deliberately to take in owner decisions 2–3; objective chips stay small. |
| 6 | Split ut-6 | 6c and signature objectives deferred. 6a and 6b stay in ut-6 as separate commits. |
| 7 | Split ut-7 | 7a (pass v2) deferred. 7b and 7c in ut-7, plus the starter chain, as separate commits. |
| 8 | Split ut-8 | Shield → ut-6; exit teaser → ut-3; first run → ut-2; account level-up → ut-5 (next to the recap); starter chain → ut-7 |
| 9 | Split ut-9 | Pages and the kit pass → ut-8; defects on every screen → ut-9 |
| 10 | Keep logic out of `Match.tsx` | New files (PreMatch, live-match, match-how, match-recap, match-box); `Match.tsx` edits only in ut-4 and ut-5, one hook block |
| 11 | Decouple ut-5 from ut-3 | Done |
| 12 | One consolidated coin table | §7; `scripts/ut_coinflow.ts` (ut-7), re-run in ut-9 and at merge |
| 13 | Integration checklist | §10 |
| 14 | Old-save fixtures early and in every state task | ut-0; §2 |
| 15 | Replace hard-coded switch-over dates | the studio stamp (§2) |

### Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Old clients strip state; double pay; scheme flip | §2: receipts in `hq.claims`; counters in `hq.journal`; pass v2 deferred with a season-number-only design; round trip in every state task |
| 2 | Old `rivalsOf` re-derives rewards | weekly rewards never enter `rivals.rewards` (ut-7); round-trip test |
| 3 | Forfeits hit honest players | auto-finish by seeded simulation from the hide-time snapshot; forfeit only past 2 a week (ut-4) |
| 4 | Marker saves stutter | ≤ 2 profile writes during play; a synchronous device-local snapshot on hide; stable callbacks; measured (ut-4) |
| 5 | `box` on the wire; `progress.ts` owner | contract A (`stripLocal`; nfl/soccer callbacks never on the wire); §10 item 4 |
| 6 | End-code drift | box stats first; `end-codes.test.ts` (contract G) |
| 7 | Badge contrast | `#c62828` (ut-2) |
| 8 | Home scroll | the pill takes the tagline line; chip-only fallback; measured with the edge (ut-2) |
| 9 | File collisions | contracts E, H; `Match.tsx` in one block; touched-outside-lane lists; §10 |
| 10 | iOS timer haptics | haptics only in pointer handlers; a spy test (ut-0, ut-5, ut-6) |
| 11 | Supply undercuts odds | program groups deferred; ≤ 1 program card a week; no Headliners (contract D) |
| 12 | Shared seeds | `pid` in the Scout Reveal seed; ≥ 2 outcomes across 100 ids (ut-6) |
| 13 | Near-miss ethics | the `go.ts` ethics rule; an odds chip when the Store is the only route |
| 14 | Rivals needs real opponents | online wins only; lead decision (§11) |
| 15 | Collection grid performance | windowing and lazy portraits; ≤ 300 ms and no long task > 100 ms (ut-8) |
| 16 | Dead-tap detector is destructive | denylist and a fresh context per screen (ut-0) |
| 17 | Top overlays vs shell's `--sat` | `--sat` and `--sab` everywhere; Fix A injected in QA (ut-0) |
| 18 | Reduced-motion final states | every effect has a final-state path; measured in ut-9 |
| 19 | Branding leaks | banned-term test (ut-0) |
| 20 | Small phones | 375×667 in every task |
| 21 | Hard-coded dates | the studio stamp |
| 22 | Protocol claim unconditional | §9 is now conditional |

### Targets

All adopted:
- **ut-2:** the badge contrast, Home and claimables numbers. The Home "no scroll" target reads "no added scroll vs before, and 0 where it was 0". Some sport/size pairs may already scroll before any ut change (for example 320×568 with a saved run), and ut-0's baseline measures which ones.
- **ut-3:** the Hub numbers.
- **ut-4:** PreMatch and the marker. The marker target counts profile writes; the hide snapshot is separate and ≤ 1 ms.
- **ut-5:** the recap numbers.
- **ut-6:** the dailies and Scout Reveal. The program-group target is deferred with the feature.
- **ut-7:** the economy numbers, with the Season Pass hero above the fold at 320. The v2 value target is deferred with v2.
- **ut-8:** the page targets.
- **ut-9:** the final QA numbers.
- **The studio look:** the checklist in §1, recorded per screen.
- **Coins per hour:** §7.
