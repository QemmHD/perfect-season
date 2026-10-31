# Ultimate Team Club Season — Codex, 2026-10-31

**Designed and implemented by Codex (OpenAI)** for the owner's request to use their Ultimate Team in a full season, with adaptive AI, simulated opponents' records and season statistics. Open **Ultimate Team → Play → Club Season**. This is a solo league saved per player and per sport; AI clubs play one another. It is distinct from the existing Season Rewards track (`ut.hq.seasons`).

## What players get

- **Basketball:** 30 clubs, 82 regular-season games per club. **Football:** 32 clubs, 17 regular-season games per club. Your club replaces the favorite franchise, or the first franchise if no favorite is set. These are custom Ultimate Team calendars, not official NBA conference/divisional or NFL bye-week schedules.
- Choose Rookie, Pro, All-Star or Legend when starting. Take the current owned/equipped Ultimate Team squad into the real court/field runtime. Change the squad between games normally; no cards are consumed. Matchups show the actual AI rating/form. The current squad's OVR is shown even after changing lineups.
- Every completed human game advances the entire league by one matchday. AI clubs keep their roster, wins/losses, points for/against, last-ten form and player totals. Around the League shows results. Standings, your full schedule, scouting and AI league leaders are separate sections in the existing gold/navy/teal/Archivo design.
- **Top eight qualify.** Basketball has three best-of-seven rounds; football has three single-elimination rounds. When the club is eliminated or misses the cut, the AI finishes the bracket and crowns a champion. The next season archives the previous record/place/champion/title. Ten previous season summaries remain, plus the complete current season.
- Scores and matches use the existing **arcade length**: a full season means 82/17 games, not full-length NBA/NFL broadcasts. Human scores come from actual gameplay. AI-only team and player box scores are simulated. AI player leaders are explicitly labeled; no invented individual human shooting/tackle statistics are presented as recorded gameplay.

## Adaptive AI and rating integrity

Rosters are generated once from the actual card pool, preferring the franchise and filling every position with distinct player identities. All-time editions can appear. Roster IDs stay fixed throughout the season; this is a fantasy league, not a claim about current official rosters.

The starting difficulty establishes the opponents' initial target strength and offense/defense skill. A bounded league challenge follows the user's results and normalized scoring margins with smoothing (`adaptive = clamp(.96 × previous + .38 × win/loss sign + .4 × margin, -5, 5)`). The last played club-OVR change contributes only a bounded amount around the starting anchor. AI clubs' own expected wins/results move team form; individual form also follows their simulated contribution. Team/player form is smoothed and bounded to ±6. Effective attribute shifts are capped at ±10, actual attributes at 1–110. Card overalls remain supported by their shifted attribute profile. The roster/table/VS show the same rated AI data used by the runtime; team chemistry still uses the original squad formula.

`league-form.ts` and `league-match.ts` make copies of AI ratings/runtime players. They never edit canonical pool cards, owned UIDs, card levels, XP, mint metadata or the user's players. Opponent behavior and ratings lock before the game; there is no mid-play rubber band. The same fixture seed returns after interruption; leaving cannot roll a different opponent. Difficulty is set for the season and can be changed for the next one.

AI simulation uses seeded rating-sensitive win probabilities, a small home advantage and arcade-scale scoring. Football AI scores come from four TD/FG/empty drives; its passing/receiving yards and TD totals are allocated consistently. Basketball AI player points sum to the club's points. Regular-season records conserve total wins/losses and points for/against across the league. Postseason results do not inflate regular-season standings or leaders.

## Save, settlement and connections

`ut.league` is **optional additive profile-v1 data**: `active` holds the current season, rosters, stats, fixture cursor, results, challenge and bracket; `history` holds ten summaries. No existing storage key/version, `DATA_V`, owned-copy identity or backend schema changes. `migrateUt` normalizes this field while preserving all original inventory/progress. The existing encrypted automatic save already includes the full sport profiles; this season uses that same path. There is no player backup download.

The match request carries a stable season ID, cursor and fixture key. `play.ts` validates them before *any* rewards/XP/record changes, rejects instant-sim, online, mixed-mode, stale, malformed and duplicate requests, then settles the full matchday atomically with the normal match rewards. Replaying an old fixture under a new match ID still cannot pay or advance the league. Incomplete matches keep the same fixture. Season requires a played match (the existing QA autopilot can still exercise the actual runtime).

Normal played-game coins/card XP and Season Points retain existing daily limits. AI-only games earn nothing and do not alter club achievements/development. No new champion currency/pack faucet is added; the championship/title and archived season are recorded. Other UT modes, draft and online rules remain unchanged: **NBA queue 8 / NFL queue 9**.

## File map for Claude

| File | Responsibility |
| --- | --- |
| `src/ut/league-state.ts` | Serializable optional state, bounds/normalization, summaries and player totals. |
| `src/ut/league.ts` | Stable roster generation, round-robin calendars, deterministic AI scores/box scores, adaptation, standings, fixtures, series and settlement. |
| `src/ut/league-form.ts`, `league-match.ts` | Isolated actual AI attribute/overall changes and runtime-player copies. |
| `src/ut/LeagueSeason.tsx`, `league.css` | Season setup/hub, table, schedule, scouting/leaders, playoffs/finale/history; scroll reset on section/new-season changes. |
| `src/ut/UltimateTeam.tsx`, `Clubhouse.tsx` | Play entry/continuation, Play parent/back, squad access and correct Club Records label. Existing reward-track Season remains separate. |
| `src/ut/Match.tsx`, `play.ts` | Validated real match setup, fixed fixture seed, AI runtime ratings, manual play and atomic settlement. Existing non-season paths are retained. |
| `src/ut/state.ts`, `hq-state.ts` | Additive league migration and `league` history mode; existing cloud profiles include it automatically. |
| `src/ut/league.test.ts` | Both-sport full seasons/series/elimination, conservation, roster stability, actual attributes, bounds, replay/cap/malformed guards and encrypted-save roundtrip. |
| `scripts/qa/league-season.mjs`, `play-tab.mjs` | Real UI and match flows, all responsive sections, interruptions, actual game settlement, seeded postseason/history presentation and Play parent/back coverage. |

## Validation and limits

Local full suites: **671 passed** (352 NBA / 319 NFL; 31/63 existing skips). Nine new substantive tests run for each sport. Final season-focused checks and TypeScript/production build pass. Existing bundle-size warning remains.

Browser QA covers four sections at 320×568, 390×844 and 844×390; current header/page overflow checks; normal manual shot/snap controls; interruption with fixture retention; a complete real court/field match through App/UtMatch/Arcade; correct win/loss/rewards and all 30/32 club records; reload; scouting; postseason/finale; and next-season history with all 56 NBA / 69 NFL original fixture copies/squad preserved. Full-match QA uses the existing autopilot plus a QA-only 8× physics time scale. Presentation fixtures fast-forward the pure season engine before a new app boot and are labeled as QA, not real player seasons. The encrypted server-snapshot test restores season progress alongside the same wallet, owned copy IDs/mint fields and squad. The existing two-client signed H2H regression also passes in both sports; adding this solo season does not change online settlement. Physical installed-iPhone feel remains an owner check.

[Current-run screenshots](previews/README.md#ultimate-team-club-season--codex-2026-10-31) and `docs/ut-league-browser-audit.json` record browser evidence. The original restore remains `backup/original-working-2026-10-28` at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Pre-season source restore is `backup/pre-ut-league-season-2026-10-31` at `846f0d6364bbbc912408b537eba5eca772d2d238`. Work remains on the unmerged feature branch and the same owner-private preview; live Pages/main is not promoted. Exact publication provenance follows after verification.
