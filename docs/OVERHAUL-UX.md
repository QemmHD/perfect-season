# Play discovery and UX audit

Audited and implemented by **Codex (OpenAI), 2026-11-07**, for the Perfect Season overhaul. Based on current main `7db37b6` plus the preserved Admin Studio review branch. Existing Claude navigation, typography, card art and account/save design remain authoritative.

## Verified findings and decisions

| Finding in current code | Effect for players | Resolution |
| --- | --- | --- |
| PlayHQ in `Clubhouse.tsx` offered six similarly presented solo rows whose secondary text was mostly progression counters. It did not distinguish a one-game ladder from a long season, a short scenario or a temporary draft. | New and returning players had to enter each mode to learn its purpose/session/squad source. Adding more mode rows alone worsened discovery. | Play now filters **All Modes / Quick Play / Runs / Online**. Cards give a concrete purpose, factual session length, team source and challenge type, plus relevant continue/free-entry/claim status. No speculative minute estimates. |
| The footer said every mode played the player's own squad, but `draft-mode.ts` builds a temporary drafted roster. | Players could expect Draft selections to join or train their club. | UT Draft explicitly says **Drafted squad**, up to four matches and a loss ends the run. The reward guide distinguishes mode prizes from daily match caps. Moments was separately verified in `Moments.tsx` to use the owner's squad. |
| `continueRun` always chose Club Season, Circuit, then Draft, regardless of recent activity. An old season could displace a run just started or played. | Home could repeatedly send players to the wrong current activity. | `ModeStatus.lastPlayedAt` is computed from existing run timestamps and matching `hq.history`; the most recent live run is recommended. Legacy/tied saves retain the old stable order. No new persisted recency state. Cup recency comes from `cupStatus`, and root integration handles the Home Cup selection. |
| Club Records fell through to “Squad Battles” for UT Draft. New Cup results would have inherited that label. | Incorrect match history undermined mode identity. | Explicit **UT DRAFT** and **CLUB CUPS** labels were added. Existing labels remain. |
| Match result messages directed players to the Store or “clubhouse” without a direct reward action, and explained little about outcomes. | Players left a reward screen without a useful next step or training insight. | Root overhaul integration owns result feedback/direct reward routes. This audit did not alter settlement or replay receipts. |

Additional factual follow-up: `Hub.tsx`/Leaderboard still contained “both sports” wording after Soccer was added; correct to “all sports” when editing those surfaces. No new gameplay mode was invented simply to repackage existing Training or Moments.

## Implemented interaction

Play retains the one-title shell and six existing UT tabs. The game uses its existing 390px design frame, so the new CSS has no width media queries. Buttons meet the existing 44-design-pixel standard. Existing `.ut-row`/`.hq-mode` selectors and uppercase mode names remain for previously verified journeys.

**All Modes** begins with a small, actionable next play: open an unclaimed starter pack, continue the most recent run, inspect a finished Cup result, claim completed Draft rewards, or start a single Squad Battles game. **Quick Play** limits the list to one-match/scenario options. **Runs** groups Cups/Club Season/Events/Circuit/Draft. **Online** focuses the Rivals division and Find Match, with the existing highest-difficulty/real-player progression rules explained.

Cup integration is additive: `PlayHQ` accepts `onCup` and `cupStatus` props. The Cup status's `ready` means a completed result, including losses; its badge therefore says **RESULT READY**, not a guaranteed reward. The Club Cups card explains three knockout rounds, the owner's squad and chosen difficulty. Root owns the mode's route/state/rewards.

The reward explanation is behind a short disclosure rather than another permanent panel. It states the existing first-eight paid standard matches and first-sixteen Season Points limits and defers special mode prizes to their existing claim rules. It does not grant anything.

## Ownership and save safety

| Files | Responsibility |
| --- | --- |
| `src/ut/Clubhouse.tsx` | Play discovery/recommendations and accurate Records labels. Other clubhouse tools stay intact. |
| `src/ut/play-hq.css` | Native panel/icon/filter materials, scoped overrides and phone-safe sizing. |
| `src/ut/play-status.ts` | Read-only active-run recency and Club Cups name. |
| `src/ut/play-status.test.ts` | Recent Circuit/Draft priority, inactive exclusion, legacy fallback, empty state. |
| `scripts/qa/play-discovery.mjs` | Isolated three-sport filter/Cup-discovery/phone-overflow checks. |

No profile schema, card ID/copy UID, serial, XP, wallet, owned/squad array, global pack odds, owner access, backend connection or queue protocol is changed by these files. Continue recommendations never settle, claim, abandon or replace a run.

## Verification

- Recency/sport-branch focused suite: **6 passed**.
- NBA browser flow: **passed**, zero page errors; All/Quick/Runs/Online, Club Cups discovery, 390px/320px overflow checks. Real current screenshots under `/tmp/next-ux-play/play-nba-*.png` in the execution workspace.
- Initial browser screenshot review caught an early loading frame; final capture waits for the actual mode controls, not just the tab shell.
- NFL/Soccer browser checks should run after concurrent heavy build/test tasks finish. The first concurrent NFL attempt crashed the browser page during initial navigation; the parent confirmed the executor’s 8 GiB cgroup was under memory pressure. Independent browser/build/test work was stopped so parent verification can run serially. This is an observed verification limit, not a claimed application defect.
- Full project build/test/release status belongs to the parent overhaul release record. Early whole-project typecheck identified unrelated in-progress feedback type references; this UX implementation had no remaining reported type errors after its unused import was removed.
