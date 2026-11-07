# Club Cups — own-club knockout competition

Designed and implemented by **Codex (OpenAI), 2026-11-07**, as part of the Perfect Season overhaul. This adds a replayable roster-building competition using the real NBA, NFL and Soccer match engines. It preserves Claude's existing content, Club Season, Circuit, Draft, card scale and online protocols.

## Why this mode

The source audit found that the game already has several ways to play a standard AI ladder: eight-rung Squad Battles, six-match Champions Circuit, a four-match temporary-team Draft, Club Season, nine one-time Legends Event stages and five one-time Moments. Adding another unrestricted ladder would repeat their core experience.

Soccer particularly lacks own-club solo variety: `Clubhouse.tsx` explicitly hides Club Season, Legends Events and Moments, and Live Calendar is unsupported there. Club Cups fills that gap across all three sports while giving collected lower-rated cards and themed squads a practical role.

This is separate from Circuit: **free entry, three consecutive knockout wins, permanent own-club cards, bracket-specific roster eligibility, weekly rotating chemistry requirements and three independently claimable weekly titles**. A loss ends the entry; players can adjust their squad and enter again without paying or consuming cards.

## Brackets and rules

| Bracket | Eligibility | Weekly first-title prize |
| --- | --- | --- |
| Open Club Cup | Any complete club lineup; all playing positions valid and no duplicate player identities | 200 coins, Gold Pack, 200 Season Points |
| Silver Cup | Every playing card at or below the current silver ceiling: 74 displayed OVR, including the NBA playing bench | 300 coins, Premium Gold Pack, 250 SP |
| Chemistry Cup | A weekly rotation between a common franchise/club and common decade among starters; player chooses which team or era | 300 coins, Premium Gold Pack, 250 SP |

Chemistry minimums: same franchise **NBA 3 / NFL 8 / Soccer 4**; same decade **NBA 3 / NFL 12 / Soccer 6**. The stable hash of sport + entry week selects the rule. The existing displayed rating scale determines Silver eligibility; actual current playable card editions/positions are resolved through the pool, including variants and Evolutions.

Silver entrants snapshot the entered copy levels. Those exact copies remain eligible as they earn normal card XP during the run, while actual gameplay keeps their earned current ratings. New/swapped copies are checked at their current level. Evolution edition upgrades still count. This avoids stranding a valid entry when a 74 OVR card levels up between rounds. No owned level, XP, UID, mint or card ID is reset to implement that grace.

Players choose Rookie, Pro, All-Star or Legend before entry. The opening run is Rookie by default. Each match advances to a stronger opponent and slightly sharper defense; the initial club overall anchors opponent targets so ordinary upgrades between games are useful. Existing difficulty modifiers affect actual AI strength and defensive settings, not just a label. The AI roster is built from actual canonical card IDs with unique players and valid positions. Its seed is deterministic for the saved run, round and selected formation. Opponents are solo AI squads; no new matchmaking queue is introduced.

## Save, resume and rewards

`ut.cup` is optional and additive. An active run contains a stable ID, original sport/week/bracket, difficulty, entry overall, optional entry-level map, current round and results. Quarterfinal, semifinal and final progress survives reload and normal encrypted cloud saves. `state.ts` only adds `normalizeCup` preservation; all original profile/inventory/save keys remain authoritative.

The match request is `{runId, round}`. Match setup rechecks the current eligible squad. Settlement requires the saved active run/current round, a manual match, valid scores and a new match ID. Simulated/stale/combined-mode results are rejected by the root settlement integration before ordinary coins, XP or records are paid. Cup progression itself also rejects simulations, replay IDs and inconsistent scores. `cupOpponent` never consumes cards or grants rewards.

A run that wins all three matches becomes a claimable title. A loss can be archived with no extra completion prize. The normal daily match coin/card-XP and Season Point caps still apply to the actual matches; weekly Cup title rewards are separate and bounded.

Each first weekly bracket title uses permanent receipt **`cup:<sport>:<entry-week>:<bracket>`**. The receipt, pack, coin delta, Season Points and trophy count are returned in the same profile transaction. A retry claims nothing more. Replaying the same bracket/week is free but pays no second completion prize or extra weekly trophy. Entering an old-week run and finishing it later preserves its original rule and reward receipt; the claim day determines only which current Season Pass receives SP.

The trophy cabinet counts weekly titles in each bracket. A separate last-20 run archive records champions, losses and retirements. Trimming the visual archive never trims permanent claim receipts or resets trophy counts. Retiring an unfinished run archives it without removing cards/claims/trophies. A finished title cannot accidentally be discarded with the retirement action; the result must be collected/archived through its explicit completion button.

## Files and integration contract

| File | Role |
| --- | --- |
| `src/ut/cup-state.ts` | Optional saved types, stable bracket IDs, normalization of results/entry levels, permanent receipts and capped presentation history. |
| `src/ut/cup.ts` | Roster requirements, entry, deterministic opponents/difficulty, request/score guards, settlement, title claims, retirement and mode status. |
| `src/ut/CupView.tsx`, `cup.css` | Original Archivo/teal/gold materials, three bracket choices, eligibility feedback, difficulty, knockout path, next opponent, completion rewards, trophy cabinet and retire confirmation. |
| `src/ut/state.ts` | Additive `cup` type and migration only. |
| `src/ut/cup.test.ts` | Real-pool eligibility, difficulty/determinism, guard/replay tests, late claims, migration, original inventory and Silver level-up grace. |
| Root-owned integration | `UltimateTeam.tsx`, `Match.tsx`, `play.ts`, `nav.ts`, `Clubhouse.tsx`, `hq-state.ts`, `play-status.ts`; route Cup requests into the existing real match and daily progression flow. |

Exports: `CupRequest`, `CupKind`, `CUP_NAMES`, `CUP_ROUNDS`, `CUP_PRIZES`, `cupOf`, `cupStatus`, `cupRule`, `cupEligibility`, `startCup`, `validCupRequest`, `cupOpponent`, `settleCup`, `claimCup`, `retireCup`. `CupView` takes `ut/pool/week` and `onStart(kind, level)`, `onPlay(request)`, `onClaim`, `onRetire`, `onSquad`. `cupStatus.lastPlayedAt` helps the common Play screen choose a recent saved session.

No new currency, packs, special-card entitlement, Supabase function/schema, player identity or Nostr protocol is introduced. Gold/Premium rewards use the current store opening, duplicate storage, Collection and Pack Tracker. Online rule versions and gameplay engines remain under the root's separate audit work; this module does not change them.

## Verification status

The initial core passed **8 real-pool tests for each NBA/NFL/Soccer**. The final Silver XP-entry grace case then passed **9/9 NBA tests** before the parent paused parallel heavy runs to avoid memory pressure. NFL/Soccer final-grace reruns and integrated settlement/browser checks are deliberately delegated to the root's serial validation; they are not claimed here as already run. An earlier typecheck had no Cup errors after correcting the Confirm props and ES2020 array access; the root's independent lazy-data typing work was still in progress. Use the final overhaul release record for completed combined checks and deployment references.

Browser verification should cover entry in all three sports, roster gating, a real match/reload/continue, finishing or retiring, one-time prize deposit, earlier-week completion, copy/serial preservation, phone widths and all existing modes remaining reachable. Presentation fixtures for a champion screen must be labeled as fixtures rather than real player achievements.
