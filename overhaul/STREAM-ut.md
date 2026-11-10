# Team ut: Ultimate Team menus, hub, objectives, rewards loop, results

Worktree `/home/user/ps-s-ut`, branch `claude/studio-ut`, port 5212. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` first.

## Why

The owner wants Ultimate Team overhauled "to the max 1000x so it looks plays feels and has the addictive style of the ultimate team". It should make people "wanna do challenges to get more", "attract dopamine", and "have the menus wanna lead players to places and be clear and have good objectives and rewards", with "all menus work and taps … production studio quality". The UI should look "detailed and beautiful".

## Sources

- **`O/audit-ut-ui.md`:** all of it except §1, which is shell's.
  - **High:** H4 (Home never surfaces UT claimables), H5 (dead-end progress screens), H6 (mode names: centralise only, don't rename).
  - **Medium:** M3 (match result: player ratings, man of the match, animated progress; a soccer draw shows as WIN), M4 (long flat pages, except SBC and Store, which are packs'), M5, M7 (first-run funnel), M10 (Season Pass hero), M12 (Collection filters and silhouettes), M13 (solo games show the online vote screen).
  - **Low:** L items.
  - **§4** screen-by-screen notes; **§5** dopamine loop (missing hooks 1-10); **§6** what to preserve.
  - Screenshots are in `O/audit-shots/ut-ui/`.
- **`O/research-ultimate-team.md`.** Read it all. Especially:
  - the objective layers
  - the Season Pass (30 × 1,000 SP over 28 days, applied from the next season so current progress is untouched)
  - competitive pay (Circuit, Rivals weekly, Squad Battles)
  - the Hub ("Next best action" hero, a Live Now carousel with countdowns, an Upcoming strip)
  - the end-of-match sequence
  - badges and amber clocks
  - ethics (a "done for today" state, a streak shield)
- **Existing docs:** `docs/UT-OVERHAUL.md`, `docs/UI-NAVIGATION.md`, `docs/OVERHAUL-REWARDS.md`, `docs/OVERHAUL-UX.md`, `docs/UT-POLISH.md`, `docs/UT-CLUB-SEASON.md`, `docs/OVERHAUL-CUP.md`.

## Scope

### P0: lead players somewhere, everywhere

1. **A bridge from the landing screen (H4).**
   - Add a UT claimables badge on the main tab.
   - Add a Home strip ("6 rewards · 2 packs · Day 3 drop ready") that deep-links into UT.
2. **GO links on every progress surface (H5).**
   - Objectives, missions, Gauntlet, Season Pass ("Earn 300 SP → Play"), Sets ("1 card away → SBC / Store") and Evolutions.
   - Each one routes to the exact screen where the task gets done.
3. **UT Home becomes a hub.**
   - One "Next best action" hero, chosen by a clear priority list that starts with unclaimed rewards.
   - A Live Now carousel with countdowns, and an Upcoming strip.
   - Near-miss chips ("1 card away", "2 wins to Pro", "1 game to daily bonus").
   - A clear "done for today" state.
   - It must look studio-made: depth, motion, art, readable hierarchy.
4. **End-of-match reward sequence (M3).**
   - Score and result first (a soccer draw must read DRAW).
   - Then player ratings and a man of the match, built from the match's real box score or events where the engine exposes them.
   - Then animated coin count-up, Season Pass bar, objective ticks and card XP/level-ups.
   - Finish with "next unlock in X" and ONE primary "What's next" button.
   - Keep the existing `MatchDebrief`.
5. **Solo games skip the online vote screen (M13).** Solo Squad Battles, Cups and similar must not show the online "HEAD TO HEAD · SIM OR PLAY?" vote with a 10 s countdown. Give solo a clean pre-match screen: matchup, both squads' ratings, difficulty, rewards on offer, PLAY and SIM.
6. **Pre-existing exploit.** Killing the app mid-match lets a Cup, Circuit or Season round be replayed.
   - Fix it by recording a "match in progress" marker when the match starts.
   - On relaunch, offer to resume where possible; otherwise settle it as a forfeit, explained clearly.
   - Use additive saved state, test it, and never punish a crash during the menus.

### P1: objectives and progression depth (from research)

- **Objectives in layers:**
  - Daily: 3 objectives done in about 3 matches, plus a bonus "Scout Reveal" (coins-only rewards; odds shown).
  - Weekly: 6, with chests at 4/6 and 6/6.
  - Program/promo objective groups that award a promo card. Coordinate the card source with packs through your doc; use existing editions.
  - Card-attached signature objectives, if the data allows.
- **Season Pass presentation (M10).**
  - The top-tier reward is shown as a hero from day 1, along with the track and what's worth grinding for.
  - Any new 30-level scheme applies from the next season only. Existing SP and claimed levels stay intact.
- **Competitive pay.** Circuit pays every win, and Rivals has weekly rewards at 5 and 10 wins, both coins-only. Only rebalance economy numbers inside the ut-owned modes, and document the coin-flow change.
- **Retention hooks:**
  - a streak-loss warning in the last hours, plus a weekly streak shield
  - an account level-up celebration inside UT
  - a session-end teaser on EXIT ("Tomorrow: Day 2 of 7 — 300 coins")
  - a starter objectives chain for new players
- **First run (M7).** Mention UT and reorder or merge the two stacked modals into one welcoming flow.

### P1: make every UT screen beautiful and clear

- **M4 long flat pages** (Development, Collection; SBC and Store are packs'): sections, sticky segment chips, collapsible groups, summary headers.
- **M5:** replace the collection meter "39 / 22,082" with meaningful set-based goals.
- **M12:** filters that are always empty must hide or explain themselves; silhouettes must preview the chase.
- **A consistent visual system across every UT screen.** Header plates, section titles, cards-on-rails, reward chips with real art, countdown chips, claim buttons with feedback (haptic plus burst), and empty states. Keep the identity in §6: Archivo condensed italic, teal and gold.
- **Every tap and every screen works.** Walk every UT screen in all three sports at 393×852 and 320×568 with the audit harness. There must be no dead taps, overlaps or unreadable text.

### P2

- **Labels (H6).** Create `src/ut/labels.ts` with every player-facing mode name ("Ultimate Team", "Squad Battles", "Rivals", "SBC", "Evolutions", "Moments", "Champions"…), and route visible strings through it. The owner decided to KEEP every current name. labels.ts is optional; never change wording.
- **A Depth Gauntlet event** every two weeks (from research), if time permits.

## Notes

- **Saves.** New state is additive. Never alter claimed rewards, streaks, SP or Season Pass progress already earned.
- **Coin flow.** Any change to coin rewards must be documented with a before/after estimate of coins per hour.
- **Protocol.** UT match outcome rules are unchanged by this team, so no bump. If the forfeit logic changes how a result is settled online, say so.
- **Card faces belong to players.** Packs and their opening belong to packs. Use the existing card components; the new art arrives at merge.
- **Owner device checks:** the Home strip and badge feel, the post-match sequence length, and haptics.

## Owner decisions

Read the "OWNER DECISIONS (2026-11-09)" section at the end of BRIEF.md. It is binding and overrides this brief where they differ.
