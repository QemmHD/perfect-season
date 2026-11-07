# Complete Rewards inbox

Implemented by **Codex (OpenAI), 2026-11-07** as part of the app overhaul.

The audit found that the Home Rewards inbox described itself as every earned reward, but only included daily/calendar objectives, season tiers, sets, Standouts, Draft, Evolutions and the New Era bundle. Ready Moments, Collection Gallery milestones, earned Rivals prizes and card-development rewards were missing. The new Cup title reward also needs to appear there.

`src/ut/inbox.ts` now lists and claims those ready sources through their existing canonical helpers. NBA/NFL Moments are included; Soccer does not fabricate NFL Moments, because the current Moments catalog has no Soccer scenarios. Eligible collection rewards use permanent discoveries and original collection receipt IDs. Old Rivals rewards remain claimable after weekly reset. Card development grants only its existing earned XP/SP to the exact target UID. Cup claims use the completed run's saved week and original sport/kind entitlement.

A completed loss or a replayed Cup whose weekly prize was already claimed appears as a **Club Cup result** shortcut, not as a promised free reward. `InboxItem.view` and optional `InboxView.onOpen` let that button open Club Cups instead of incorrectly opening the Store. Existing pack/pick shortcuts still open the Store.

`claimAll` finishes with the original objective/daily-bonus/season claim helpers until no newly ready receipts remain. This matters because Moments, Cup titles and development can grant Season Points and unlock more tiers during the same transaction. A second Claim All therefore does not pay another reward merely because the first call unlocked it.

`claimRivals` in `src/ut/rivals.ts` is extracted from the existing Rivals screen and is shared by that screen and the inbox. The helper normalizes the stored division through `DIVISIONS`, retains the original `rivals:<sport>:<reward-id>` pack identity, writes the same claimed receipt and rejects a repeated claim. No separate reward amounts or pack recipes are introduced.

Owned cards, inventory identity/mints, squad assignments, wallet fields outside the actual earned coin grant, gifts, settings and other profile fields are retained. Development intentionally applies its earned upgrade to its one selected copy. There is no schema/backend change, queue change, new currency or special-card mint bypass.

Files: `src/ut/inbox.ts`, `InboxView.tsx`, `rivals.ts`, `Rivals.tsx`; tests in `src/ut/inbox-completeness.test.ts`. The focused tests use a real sport pool, mixed ready rewards, a saved old-week Cup/Rivals award, a retained numbered copy, JSON migration/reload and a repeated claim. Test results are recorded after execution; no live account or backend write is used.

Root validation: the four mixed-source tests pass in NBA/NFL/Soccer as part of each 25-case focused suite, and the full NBA/NFL suites pass with the original content/reward cases. See OVERHAUL-AUDIT.md for exact final totals and publication status.
