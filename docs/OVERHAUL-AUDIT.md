# Perfect Season: gameplay, content and app audit

Audited and implemented by **Codex (OpenAI), 2026-11-07**. Source: current `main` (`7db37b6`) plus the preserved admin work (`ea03347`); work stays on `feature/perfect-season-next`. This is an incremental overhaul of the existing React/TypeScript game, not an engine replacement or a reset of Claude's New Era work.

## Findings that drove this release

| Priority | Verified finding | Change and player benefit |
| --- | --- | --- |
| High | App statically imports game/admin/practice UI; draft data loaded NBA and NFL together. Initial mandatory JS graph measured 3.81 MB before this pass (4.81 MB with Soccer). | Lazy screen boundaries, pure gift-helper extraction and sport-specific data loading. Faster cold launch and less unused sport data. The performance report records exact graph measurements and offline checks. |
| High | SW registration relies on adding a `load` listener after async sport modules finish; the event can already have fired. | Register immediately when the document is already complete and warm loaded hashed assets into the active worker cache. Previously used sports remain available offline. |
| High | Play lists many overlapping modes without distinguishing session commitment, squad source and difficulty. Its footer incorrectly implies UT Draft uses the owned club. | A filtered Play hub, factual mode descriptions and a next-action recommendation. Continue favors recent activity instead of always favoring a season. |
| High | Soccer hides Club Season, Legends Events and Moments; its own-club solo options are narrower. Existing static events also provide limited repeatable roster-building reasons. | Club Cups across **NBA, NFL and Soccer**: Open, Silver and rotating Chemistry brackets, three real knockout matches, selectable difficulty, trophies, weekly bounded prizes and saved continuation. |
| High | NBA dribble moves rely on discovering joystick flick gestures. Layup telemetry records an offset of zero even when real release timing was early/late. | Visible CROSS / STEP BACK / SPIN controls reuse the existing actions/cooldowns. Correct recorded layup timing; no probability or physics change. |
| High | Results mostly show scores/end codes and rewards; the player has little useful feedback for the next game. | Optional in-game Last Play feedback, observed post-match breakdowns, NBA/NFL practice access and a reward-pack shortcut. No invented causes, shooting percentages or player box scores. |
| High | Rewards inbox claims to collect everything but omits ready Moments, Collection Gallery, Rivals and development. | Canonical claim helpers cover these sources plus Cup titles, with the same original receipts and mixed-source idempotency tests. |
| High | User-reported phone fit exposed height-driven app shrinking, layout/visible viewport disagreement and keyboard-driven false landscape detection. | Width-stable phone scaling, actual visible viewport geometry and safe-area-aware scrolling; dedicated short/tall/keyboard tests. See OVERHAUL-SCREEN-FIT.md for device limits. |
| Medium | Ongoing entry requirements can strand a Silver Cup after legitimate card XP raises its rating. | Entry-copy level snapshots preserve eligibility for earned normal level gains during that run. Gameplay still uses the actual earned levels; new/swapped/evolved editions are checked correctly. |

## What this overhaul contains

- **A new play loop:** use your own club in short knockout Cups. Open is accessible with a complete club; Silver makes lower-rated cards useful; Chemistry rotates between franchise and decade requirements. No card consumption or entry fee. Every round is a full played match, not a simulated claim button.
- **Better control and learning:** dribble action buttons, actual Last Play readouts, readable team-result metrics and direct access to existing NBA/NFL practice. NBA/NFL/Soccer physics, ratings, difficulty curves, random streams and queue versions are retained. The telemetry correction changes reported timing only.
- **Useful navigation:** mode categories, session/difficulty/team-source labels, recent-run continuation, Cup resumes on Home, honest reward/result badges and clear routes back to Store/practice.
- **Progression that connects:** Cup trophies/history, weekly title rewards through existing coins/packs/Season Points, complete Rewards inbox and one-time claim guards. Normal eight-paid-games/day limits still apply to base match coins/card XP.
- **Faster and more reliable loading:** per-sport draft data, lazy game/practice/admin screens, explicit loading/missing-file recovery and a tested service-worker registration fix.

Detailed ownership and connections: [Cups](OVERHAUL-CUP.md), [Gameplay](OVERHAUL-GAMEPLAY.md), [Play UI](OVERHAUL-UX.md), [Performance](OVERHAUL-PERFORMANCE.md), [Rewards](OVERHAUL-REWARDS.md). Root integration: `ut/UltimateTeam.tsx`, `Match.tsx`, `play.ts`, `nav.ts`, `Hub.tsx`, `return-view.ts`, `MatchDebrief.tsx`, `match-debrief.ts`, `hq-state.ts`. See the final release record for completed validation, screenshots and actual publication state.

## Preserve accounts and progress

All original profile keys, card/edition IDs, owned-copy UIDs, squads, levels, XP, mint metadata, wallets, collections, receipts, existing seasons/runs and admin access remain authoritative. `ut.cup` is optional/additive and normalized independently; old saves load without it. Existing claimed rewards are never reset. Ordinary match settlement rejects stale, mixed-mode, simulated or malformed Cup requests **before** advancing payouts/records/XP. Cup title claims use saved sport/week/bracket receipts; late finishes retain their entry rules/rewards and weekly replay cannot farm title prizes. Match results, cup state and wallet are committed through the existing update/save path.

No new database, account provider, Supabase project, server function or schema migration is introduced. Nostr gifts/matchmaking/leaderboards and the existing encrypted cloud-save/card registry links remain. Main/GitHub Pages are not deployed during review. Source restore branch `backup/pre-overhaul-2026-11-07` points at `ea03347`; it is source control, not a player-save download.

## Recommended next additions, after this release

1. **Soccer Club Season and practice parity.** A proper soccer schedule/table and season simulation needs its own football-specific rules and tests; Cups immediately improve Soccer content but are not a substitute for a complete league season.
2. **Player-level post-match box scores.** Some local engines already track individual contributions, but the shared final progress message only carries score/endings. Carry verified local telemetry through a bounded match-report contract, with explicit handling for simulations and online takeover; do not invent assists, attempts or tackles from end codes.
3. **Opponent strategy identities.** Distinct defensive adjustments and scouting should be measured with seeded gameplay balance tests before changing ratings/difficulty. This pass retains the current physics rather than risking the recent running/shooting work with unmeasured tuning.
4. **Device acceptance.** Real iPhone touch reach, installed-PWA background/resume and two-phone online gift/rematch checks should complement automated Chromium. Browser fixtures cannot establish every Safari or relay-delivery behavior.
5. **Further content with earned roles.** Add new cards/promos only when they bring a playing style or collection objective, with reference-backed ratings and explicit odds. Avoid escalating overalls or adding currencies simply to create more menu items.

## Validation and release

In progress. Do not read an implementation claim as a deployed result; the completed release record below will identify actual checks and private preview publication.

### Completed implementation verification

- Full integrated `npm test`: **NBA 571 passed / 46 skipped; NFL 551 passed / 78 skipped; Soccer 74 passed**. Expected sport/manual/tuning skips remain. New current Cup/reward/debrief/Rivals focused tests separately pass **25/25 in each sport**; viewport geometry passes **13/13**.
- Three-sport browser integration passes with **zero page errors**: actual played Cup matches, selected difficulty, 320/390px Play/Cup layouts, resume/reload, original 56/69/40 owned-copy preservation, observed debriefs and one-time title claims. Championship screens are explicitly seeded fixtures, not claimed played tournaments. A further actual NBA ladder match earns a pack and the result shortcut opens the Store.
- Gameplay browser checks pass in NBA/NFL/Soccer at 390/320/844px: Last Play comes from actual engine state, controls/readouts do not overlap, and NBA CROSS/cooldown/STEP BACK execution is measured. Test clocks are documented in OVERHAUL-GAMEPLAY.md.
- Screen-fit checks render actual Soccer Home in **10 viewport/safe-area cases**, plus browser controls, keyboard/restoration and landscape. The matching 393×852 simulated phone keeps PLAY and navigation visible; no physical iOS device result is claimed.
- Final integrated production build/typecheck pass. Actual production workers cache the selected draft data, defer Admin execution, relaunch offline in all sports and serve real NBA/NFL attribute data on the first offline request. Both NBA/NFL attribute chunks intentionally remain install-cached; otherwise first-offline gameplay could use fallback ratings.
- Final integrated mandatory startup JS is NBA **2,338,196 B**, NFL **2,042,705 B**, Soccer **1,855,713 B** (about **39–61% less** than the measured baseline). Install precache is **8,792,185 B**, about **50% less**; these are byte measurements, not a promised phone speed multiplier.
- [Screenshots](previews/README.md#game-overhaul-and-screen-fit--codex-openai-2026-11-07) and the specific file/connection maps are committed for Claude. The final preview/review references follow below after publication.

Additional final regressions: the integrated single-file artifact build passes; the original three-sport admin navigation/gift/store QA also passes with zero page errors after lazy helper extraction and viewport changes. Existing owner abilities, signed-publication guards, exact-copy edits and real pack purchases remain intact.

### Private preview release — 2026-11-07

Owner-private preview: https://perfect-season-private-preview.qem.chatgpt.site . Source `d4c7a01a44b9075f91dac99ce6e4655122e387c7`, version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_05b8c909ff188191b6e1cd74bbb80aa6`, deployment `appgdep_6aef8bc1d7248191b7b3600e1af404ad`; publication succeeded. Hosting source is clean and its archive was built from that exact pushed commit. The separate preview origin/`preview2026` namespace and PWA identity are retained; live-phone profiles are not automatically imported into it. Root source differs only in hosting identity, minor helper-file whitespace and release bookkeeping.

Review source is `feature/perfect-season-next`, based on `ea03347` and including the still-unmerged admin work. A draft PR targets main for full release review; this does not merge or deploy main. Source restore: `backup/pre-overhaul-2026-11-07`. Main remains `7db37b6`. No backend/database deployment or account reset occurred. Actual iPhone and two-phone acceptance checks remain separate from automated Chromium evidence.
