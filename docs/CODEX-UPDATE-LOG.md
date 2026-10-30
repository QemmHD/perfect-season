# Codex implementation and connection log

**Implemented by Codex (OpenAI), 2026-10-28–2026-10-29.** This document distinguishes Codex changes from the original game and explains how they connect. Git history supplies exact commit authors and timestamps; “Codex” here identifies the implementation tool.

## Original working game and restore

Original baseline: `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. GitHub restore branch: [`backup/original-working-2026-10-28`](https://github.com/QemmHD/perfect-season/tree/backup/original-working-2026-10-28). Original hosting is GitHub Pages; original online matches, boards and admin gifts use Nostr. Source backup ZIP and full-history bundle were additionally verified in the development workspace. Phone-local saves need their own Save Locker export.

## Implemented by Codex — progress protection, training and Rivals

Remote commit `3092362b3275138229c65a211658117af855eb3c` (same tree as local `7897180`).

- Save Locker and continuation: `src/lib/recovery.ts`, `src/evolution/Recovery.tsx`, and `src/App.tsx`; profiles → encrypted two-sport export/restore; solo runs → per-sport checkpoints → Continue. AES-GCM/PBKDF2, restore preview, storage failure warnings, completed-run reward deduplication.
- Training Camp: `src/evolution/Training.tsx`, `training.ts`, `evolution.css`; mode → optional practice configuration → production Hoops2/Football2 engines. Six drills across both sports, defensive pressure, own squad option and personal bests. Practice leaves currency/ranked progression unchanged.
- UT Rivals: `src/ut/rivals.ts`, `Rivals.tsx`, `rivals-net.ts`, `play.ts`; eligible UT H2H settlement → RP/weekly rewards → namespaced Nostr standings. Five divisions and guarded claims. AI fallback earns no Rivals progress.
- UI missing-glyph correction: `src/evolution/Marks.tsx` supplies SVG symbols.

Full implementation notes: `docs/EVOLUTION-RELEASE.md`. Original validation: NBA 221 passed/30 skipped; NFL 189 passed/61 skipped; typecheck/build passed. Actual iPhone sharing/background and two-phone rematch checks remain device-specific release checks.

## Implemented by Codex — Duplicate Storage

Remote commit `96529054de7220a1b6abbd5ed8c2a987899bbdbf` (same tree as local `cb08de9`).

`src/ut/storage.ts` organizes exact edition duplicates and swaps/promotes copies. `state.ts` migrates the additive UID marker. `UltimateTeam.tsx`, `Club.tsx`, `storage.css`, `CardDetail.tsx` provide Club/Storage views and copy swapping. `PackOpening.tsx` shows deposit receipts. `Challenges.tsx` and `sbc.ts` expose spares directly to SBCs, preferring equally valued stored copies. `src/lib/recovery.test.ts` verifies encrypted storage round trips.

Every copy stays in `ut.owned`, including stored cards, preserving original-build restore readability. Levels, XP, timestamps and squad UIDs survive; different seasons/editions are distinct. Bulk sales require confirmation. Legacy lineups with multiple equipped identical copies remain valid.

Validation: NBA 228 passed/30 skipped; NFL 196 passed/61 skipped; typecheck/build passed. Chromium at 390px and 320px: five stored copies submitted to an SBC, reward pack received once, original NBA/NFL cards, squad and wallet unchanged, no page errors.

## Implemented by Codex — Ultimate Team content expansion

Requested scope: 0.05% GOAT odds per Spotlight Pack, genuine 99+ gameplay, all-time great editions, collection gallery/rewards, themed events, global serials and improved ratings. Implementation is on `feature/season-evolution`. The sections below identify the concrete additions, connections, validation and release status.

### Backend connection

A separate user-authorized Supabase project, **Perfect Season Card Registry**, project ref `ryqaibujweiwwvdtswxj`, in **QemmHD’s Org**, was created for globally serialized cards. This is separate from the original Nostr game. Public URL: `https://ryqaibujweiwwvdtswxj.supabase.co`. Frontend may contain only its public/publishable configuration. Service credentials remain in backend environment secrets.

The original online service is Nostr. This registry is a new isolated connection; other Supabase projects are unrelated to the original game and are left untouched.

### Release status

Review: https://github.com/QemmHD/perfect-season/pull/1 . Deployment state and final commit references are recorded in the final validation entry below; a feature-branch push alone does not deploy GitHub Pages.


### Implemented by Codex — additions and changed connections

| Added / changed | Purpose and connection map |
| --- | --- |
| Added edition manifest and generation | `src/data/special-editions.json`, `src/ut/specials.ts`; original season IDs → fixed Spotlight/GOAT IDs. `cards.ts` appends them without renaming old editions. 251 Spotlight / 40 GOAT cards across both sports, including a curated 2011 Gronkowski base. |
| Added NBA reference calibration | `src/data/nba-rating-references.json`, `src/ut/calibration.ts`; 111 public all-time reference profiles + historical season/honors → season-specific playable attributes. `rate.ts` applies edition/level changes and recomputes badges. [Audit and before/after examples](RATINGS-AUDIT.md). |
| Changed NFL normalization | `src/game/football2/ratings.ts` converts UT totals to rates before the existing rater. Pocket-QB speed no longer uses whole-season rushing yards as a per-game input. Raw source stats stay intact. Raw stat labels now display correctly in `card-stats.ts`, and the level/attribute-bar UI honors each edition’s cap. |
| Changed actual 99+ gameplay | `src/game/hoops2/engine.ts`, `src/game/football2/engine.ts` add bounded above-99 effects, preserving standard-rating behavior. Card → `teams.ts` → game engines uses the exact displayed attribute profile. |
| Added registered pack flow | `supabase/functions/card-registry/contract.ts` shares the probability contract with `packs.ts` / `Store.tsx`; `registry.ts` signs with the original Nostr identity; `promo.ts` validates/reconstructs the canonical receipt; `UltimateTeam.tsx` persists a pending opening and commits the price/cards once. |
| Added shared registry | `supabase/functions/card-registry/index.ts`, `catalog.json`, `deno.json`, `supabase/config.toml`; signed requests → service-only RPC → atomic counter/receipt. Both migrations under `supabase/migrations/` are applied. `CardSerial.tsx` refreshes the global denominator. No service credential is committed. |
| Added collection book/rewards | `src/ut/collection.ts`, `CollectionGallery.tsx`; owned cards and additive history → searchable/paged catalog → once-only milestone/franchise claims. `storage.ts` remembers discoveries through sales/SBCs. |
| Added themed matches | `src/ut/events.ts`, `Events.tsx`; three series × three stages per sport → `Match.tsx` → existing engines/vote → `play.ts` first-clear progression/rewards. Finale opponents include actual GOAT editions. Final reward entitlements are also deduplicated server-side. |
| Changed reward-copy IDs | `src/ut/acquisition.ts`; full pack IDs → new copy UIDs. This fixes collisions between different reward packs sharing a prefix. Already-owned UIDs are unchanged. |
| Changed card details | `src/ut/card-stats.ts`, `CardDetail.tsx`; raw season totals/percentages display separately from rating inputs. NFL passing/receiving rows now use actual source field names. Reference provenance and registered copy numbers are visible. |
| Changed online compatibility/AI balance | `src/ut/pool.ts` fingerprints full attributes/badges; `Match.tsx` uses UT rules 2 and a search display supporting 110 + chemistry. `battles.ts` maps revised NBA targets, keeps the closest discrete squad when tuning oscillates, and can build a strong special-edition AI fallback for 99+ squads. Original draft queues and gifting payloads are unchanged. |
| Added visual surfaces | `src/ut/content.css`, `card-editions.css`, `pack-art.css`; existing typography/tokens/pixel portraits with dedicated foil skins. `Hub.tsx` links Events/Gallery; `Club.tsx` filters new tiers; `sbc.ts` recognizes them. |
| Added special reveal / skip fix (2026-10-29) | `src/ut/PackOpening.tsx`, `pack-reveal.css`, shared `GoatCrown` in `CardArt.tsx`; matching foil/crown/light sequence, true serial stamp, existing sound cues and controls. An early tear skip clears timers and cannot restart the reveal. Reduced motion and small-screen bounds are verified. |
| Added additive persistence fields | `src/ut/state.ts`, `types.ts`; collection history/claims, event clears, pending opening, receipt IDs, optional copy mint metadata. Profile version/keys, original signed identity and canonical `owned` list remain. |
| Added maintenance/audit tooling | `scripts/build_registry_catalog.ts` (`npm run data:registry`); `scripts/audit_ut_ratings.ts` (`npm run audit:ratings`); `scripts/fetch_rating_references.py`; [committed audit summary](ratings-audit-summary.json). `package.json` exposes the commands and `.gitignore` excludes Supabase CLI scratch files. |
| Added/revised tests | `src/ut/content.test.ts`, `card-stats.test.ts`, `rate.test.ts`, `economy.test.ts`, `src/lib/recovery.test.ts`; full-pool bounds/provenance, rarity, real gameplay, receipt/claim idempotency, event progression, copy conservation, correct historical stats, encryption/migration. `scripts/qa/` supplies reproducible content/online/reveal checks. |

Detailed rules/API: [UT-CONTENT-UPDATE.md](UT-CONTENT-UPDATE.md). Reproduction and device-check boundaries: [BROWSER-QA.md](BROWSER-QA.md). The root [CLAUDE.md](../CLAUDE.md) points future contributors here and records the progress-preservation requirements.

### Verified backend behavior

The registry is deployed separately from the Pages client. PostgreSQL tests in `supabase/tests/registry.sql` passed with all writes rolled back: stable retry receipt, serial 1 then 2 for different players, exact counter, RLS enabled, anonymous mint/receipt access denied. Eight concurrent signed HTTP requests for one event entitlement returned one identical receipt and incremented the isolated QA global count once. Invalid signatures returned 401. Security and performance advisors were clean after explicit browser-role deny policies were applied.

The Edge Function uses a pinned `nostr-tools@2.25.2` import and custom signature verification (`verify_jwt=false` for that reason). Public client configuration lives in `registry.ts`; service credentials are provided only by the function environment. The canonical coin wallet/event outcomes remain client-owned: this is authoritative rarity/numbering, not a claim of full anti-cheat.

### Final validation and release record

Implemented and locally verified by Codex on 2026-10-29. The full suites passed NBA **241 / 31 skipped** and NFL **208 / 63 skipped**. The subsequent raw-stat display tests passed **2 additional tests in each sport**, and the final TypeScript/production build passed. The retained large-chunk warning is the existing dataset/bundle concern, not a failed build. Whole-pool level-1/level-5 audit: **zero invalid ratings** across 54,324 editions.

The content browser flow passed in both sports: originals preserved, no charge on a failed request, same-pack reload recovery, registered reward and live count, and event progression. Two independent clients per sport completed real signed local-relay H2H, one win/one loss and 30 combined Rivals points. Final GOAT/Spotlight motion, small-screen reduced motion, safe areas and skip stability passed without page errors. Backend Edge Function **version 2** is active, with the frozen 20/20 GOAT catalog and the committed signature-validation source.

At this source publication, the frontend update is on `feature/season-evolution` / PR #1; Pages/main remains the original baseline until promotion. The original restore branch remains at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. This distinguishes the live registry deployment from the separately deployed game client. CI/commit references are recorded in the following validation entry after GitHub verifies the uploaded source.

### UI preview evidence

The [committed reveal previews](previews/README.md) show the actual new components with explicit QA fixture captions. `scripts/qa/reveal.mjs` verifies the original scaled frame, simulated 59px/34px phone safe areas, normal GOAT/Spotlight motion at 390×844, reduced motion at 320×568, serial-stamp bounds and stable early skipping. `card-editions.css` is imported by the card component and `pack-art.css` by the pack art, so skins do not depend on visiting another UT screen first.

Both Review and Pages workflows now run the whole-pool level-1/level-5 audit in addition to the existing tests and production build.


### GitHub verification — Codex, 2026-10-29

Published content commit: [`ec59cda8afce7298efd93468a620959c8f5a6ae7`](https://github.com/QemmHD/perfect-season/commit/ec59cda8afce7298efd93468a620959c8f5a6ae7), with tree `7761619d954d4d0d97ec89a8b791fa708717fd28` (identical to local content commit `455db18ed42eec91048a157ed536ff9aa92ac8cc`).

GitHub [Review build #3](https://github.com/QemmHD/perfect-season/actions/runs/40859786388) **passed** on this exact uploaded code: NBA **243 passed / 31 skipped**, NFL **210 passed / 63 skipped**, whole-pool ratings audit, TypeScript check and production build. Skips are the sport-specific tests not applicable to each run. This final entry only changes documentation.

PR #1 contains the finished implementation and preview evidence. The shared registry is active at Edge Function version 2; the frontend remains on the feature branch for review. At verification, both `main` and `backup/original-working-2026-10-28` still point to the original `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; no live Pages client was replaced and no player account or save was reset. Physical iPhone behavior remains a device-specific verification limit, as documented in `BROWSER-QA.md`.


### Private test deployment — Codex, 2026-10-29

At the user's request to test without launching to main, Codex deployed a separate **owner-private Sites copy**: https://perfect-season-private-preview.qem.chatgpt.site . [Private preview handoff](PRIVATE-PREVIEW.md) records exact source/version/deployment IDs, update instructions and namespace isolation. Preview-only index bootstrap sets `ns=preview2026` before module initialization; preview PWA branding/start URL identify it as PS Preview. Origin-local saves are separate, Nostr features and card registry use the preview namespace, and ordinary game odds/economy remain. No accounts are copied or reset. The original main/Pages and restore branch are untouched.

The preview source is based on feature commit `661c51411c865efbe0c231801d0fca03a0dd3ca9`, published as Sites source commit `e9325cb7790d9d8a8fa267a0694511d27b75c926`; deployment returned `succeeded`. TypeScript/build and the production-build preview boot/namespace/PWA checks passed without page errors. This GitHub follow-up only documents the separate test hosting; it does not deploy the Pages client.


## Automatic server saves and all-card ratings correction — Codex, 2026-10-29

The user requested automatic server saves instead of backup files, then clarified that **every card in every tier** needs realistic stats and supported overalls. Existing phone-local saves already survive app updates; Codex kept those keys/identities and added a separate server copy rather than replacing the working save path. `backup/content-preview-2026-10-29` retains the pre-follow-up content build (`0807bf114a4625638630a6f98e2f22b83c9c6090`), alongside the original restore branch.

### Added / changed connections

- **Added automatic server saving:** `src/lib/cloud-data.ts`, `cloud-sync.ts`, `cloud-save.ts`, `save-events.ts`; original profile/checkpoint/training/favorite writes → original Nostr identity signs request → encrypted `player-save` service → private versioned database row. `src/lib/profile.ts`, `recovery.ts`, `favorites.ts`, `src/evolution/Training.tsx` send lightweight change notifications; offline local writes remain synchronous.
- **Replaced the file-backup UI:** `src/evolution/Recovery.tsx`, `evolution.css`, `src/ui/Pages.tsx`, `src/App.tsx`; Settings → Cloud Save shows acknowledgement/status, retry and explicit two-copy conflict choices. No file download/upload is required. Legacy encrypted-file helpers remain unreachable from UI for compatibility tests. [Automatic-save protocol and recovery boundary](AUTOMATIC-SAVES.md).
- **Added backend:** `supabase/functions/player-save/index.ts`, pinned `deno.json`, `supabase/config.toml`, migration `20261029111432_player_cloud_saves.sql`; verified signed actor → service-only `ps_cloud_write` → `ps_cloud_saves` / `ps_cloud_save_history`. Every request is authenticated, timestamps/endpoints are bound, RLS/browser-role denial is explicit, stale revisions return 409, last eight automatic previous versions and explicit conflict copies are retained. Existing card-registry/Nostr endpoints are untouched.
- **Changed all-tier NBA calibration:** `src/ut/calibration.ts`, `rating-quality.ts`, `src/data/nba-rating-references.json`; all 21,304 original seasons and their derived editions now use position-supported overalls, season shooting volume/accuracy, observed FT%, historical unknown-stat priors and better peak references. The 372 public anchors replace 111 first-team matches; `scripts/fetch_rating_references.py` chooses the strongest available all-time team version, preferring the player's peak franchise on ties. Numeric estimates are not represented as official season rosters.
- **Changed all-tier NFL adaptation:** `src/game/football2/ratings.ts`, `src/ut/nfl-identity.ts`; actual role production replaces draft-pick inflation, tiny samples regress toward ordinary efficiency, linemen distinguish starters/part-time players/honors, and explicitly estimated physical archetypes preserve pocket passers/runners. Original draft-mode rating math remains unchanged; these changes adapt the UT season-card path.
- **Changed edition/level treatment:** `src/ut/rate.ts`, `rating-quality.ts`; no universal 96/100 key floors. Signature skills justify the premium tier, secondary skills gain less, weaknesses/physicals remain bounded. All normal and special cards share the model; final displayed attrs drive actual play and both sports recompute badges. Original IDs, owned copies, XP, levels, squads, receipts/serials and collection/event progress survive. Corrected season overalls can change their derived Bronze/Silver/Gold classification.
- **Changed UT compatibility:** `src/ut/Match.tsx` rules 3 + existing full-attribute pool fingerprint prevents silently pairing mismatched rating builds. Ordinary draft queues are unchanged.
- **Added/expanded verification:** `cloud-data.test.ts`, `cloud-sync.test.ts`, `ratings-audit.test.ts`, `scripts/qa/cloud.mjs`, `cloud-backend.mjs`, `supabase/tests/cloud_saves.sql`. `scripts/audit_ut_ratings.ts` now also verifies supported overalls and numbered-edition strength, reports base/upgraded 99 counts and spot checks across ordinary cards. README, CLAUDE.md and content/QA/rating docs point to the current behavior.

### Concrete all-tier results

Whole-pool level-1/level-5 audit: zero invalid entries across **54,324 editions**. The earlier report of 1,078 NBA 99s included upgrades: before this correction, 95 ordinary NBA cards started at 99 and 1,078 started at 95+ (reachable 99 at level 5). The corrected model has **55 starting at 99 / 492 reaching 99 at level 5**. NFL has **95 / 1,072**, respectively. Counts and complete representative values are in `ratings-audit-summary.json`.

Examples: Bob Rule 1969 **95→78**, Neal Walk 1973 **95→82**; Nash's anchor is Phoenix **96**, McGrady's Orlando **95**, Chris Paul's New Orleans **97**. Kobe's 2006 and 2016 cards are differentiated by the actual season. Premium weakness examples: GOAT Shaq has **29 three-point / 54 free throw** with dominant paint attributes; GOAT Jordan 1989 has **62 three-point** while GOAT Brady has **60 speed** and elite above-99 passing. Those weak ratings are no longer forced to 100 by the card color.

### Verification and publication boundary

The SQL rollback assertions passed for CAS/retry/history/role isolation/RLS, effective rate limiting and bounded automatic history. Two simultaneous signed HTTP writes yielded exactly one 200 and one 409, the same request retried at the same revision, a different identity could not read the save, and a bad signature returned 401. Security/performance advisors were clean. `player-save` is active in the existing approved registry project; its source and migration are committed. No real player data was modified by the tests.

Real browser checks in **both sports** preserved the original 56/69 fixture cards, wallet, squad and signing identity through a server restore; kept an offline divergent copy; paused its conflicting upload; and preserved that copy before loading the server choice. No file input is exposed. Updated content/reward/pending-pack/reload/event flows and normal/reduced-motion pack reveals also passed without page errors. Final full-suite/online/GitHub CI and private-preview deployment references follow after verification.

Main/Pages remains the original working release. This client update is published only to the feature/test branch and the separate owner-private preview. Automatic server saves follow the existing identity; no new username/password or lost-identity recovery system is claimed. Installed-iPhone behavior still needs device-specific verification.

Final local validation for this follow-up: **NBA 263 passed / 31 skipped; NFL 230 passed / 63 skipped**, TypeScript and production build passed. Whole-pool level-1/level-5 audit: zero invalid entries. Both-sport content flows, reduced/normal reveal checks and two-client signed local-relay H2H passed; each sport recorded one win/one loss and 30 combined Rivals points. The existing dataset/large-bundle warning remains. Physical installed-iPhone behavior is not claimed as verified.

### Verified publication of this follow-up — Codex, 2026-10-29

GitHub content commit [`967599c4f5f2be556a3de1d80d29cba53c1244f6`](https://github.com/QemmHD/perfect-season/commit/967599c4f5f2be556a3de1d80d29cba53c1244f6) has tree `df86d3708469f7847d1268068c8905e3a2978506`, identical to local content commit `d22f800`. [Review build #6](https://github.com/QemmHD/perfect-season/actions/runs/40870472390) passed this exact uploaded code: **263 NBA / 230 NFL tests passed**, 31/63 sport-specific skips, whole-pool audit and TypeScript/production build. The retained large-chunk warning is documented.

The separate owner-private preview was updated successfully at **https://perfect-season-private-preview.qem.chatgpt.site**. Sites source commit: `5deb0d2e04a2375eb74ad50c0421748c8c2ac22e`; saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_8580ca16b3cc8191a72ebeba1f1f251c`; deployment: `appgdep_6ae3373a88d88191928a2266010ad020`, returned **succeeded**. The original private preview origin, profile keys, identity and installed PWA ID are unchanged. Preview-only namespace/branding patches remain in its separate hosting copy, not the GitHub Pages source. Production-build boot, forced namespace override and PWA manifest checks passed without page errors.

The matching `player-save` Edge Function is **ACTIVE version 2**, source SHA-256 `7168c4fb08a34607b0be7b004095be12c464d679aa1c92f5561513de90f6ff63`. Its pinned import map is explicitly `deno.json`; a v2 deployment/import-map-path error was corrected before successful deployment. The repeated v2 HTTP check again confirmed stable retries, exactly one 200/one 409 for concurrent writes, identity isolation and 401 for tampering. No service credentials were committed.

Main and the original restore branch remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; the pre-follow-up content restore branch remains at `0807bf114a4625638630a6f98e2f22b83c9c6090`. No main merge, live Pages replacement, account reset or progress reset occurred. PR #1 and the private preview contain the update. This final record only changes documentation.


## Ratings research and gameplay execution — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** for the owner's all-card accuracy and gameplay-quality follow-up. Read [GAMEPLAY-RESEARCH.md](GAMEPLAY-RESEARCH.md) for the primary sources, limitations, precise coverage, method, engine findings and reproducible checks. This entry supersedes earlier gameplay/queue descriptions; it retains their historical release record.

- Added `scripts/build_season_references.py`, lazy `src/data/season-references-{nba,nfl}.json`, `CardLine.ratingReference` and `src/ut/season-reference.ts`. Exact-name/position/height matches cover 8,938 NBA and 2,114 NFL unique player-seasons. `cards.ts` attaches references before deriving editions; `calibration.ts` / `rate.ts` combine source benchmarks and season evidence, then existing edition/level adjustments. Card Detail links the actual snapshot. All 54,324 editions remain audited at levels 1 and 5; unsupported historical attributes remain identified estimates. Archive hashes and NFL MIT attribution are retained.
- Changed shared NBA gameplay: planted on-ball containment, momentum-absorbing body contact, observed-motion anticipation, meaningful closeouts, persistent move cooldown and complete step-back/spin travel, shorter recoveries, tighter running gathers, continuous release timing and contest-aware perfect finishes. Renderer reuses recorded defensive backpedal/shuffle clips, adds brief contact response and clearer release feedback. Opening control tips rotate in shorter messages to reduce court obstruction.
- Changed shared NFL gameplay: actual bounded accuracy/pressure/movement dispersion, matching uncertainty ring, early visible pocket pressure, matchup-based rush windows, low passing-lane breakups/interceptions with reach/reaction/height restrictions, rating-based acceleration/turning and credible backpedal/shuffle/facing. Above-99 accuracy stays finite; above-99 throw power gains bounded range/flight-speed benefits. Existing run/tackle/playbook controls remain connected.
- Added `src/game/difficulty.ts`: selected offline difficulty reaches defense, and online uses Legend equally, including AI wrappers, simulation and takeovers. `Arcade.tsx` states online Legend defense in the existing kickoff eyebrow. NFL Legend Squad Battles target offset is 6 to retain a clear squad-quality increase after rerating. `DRAFT_RULES=4`, `UT_RULES=4`; original `DATA_V`/board history is unchanged.
- Added engine regressions in both `gameplay.test.ts` files and difficulty tests; expanded source/identity coverage tests. Human-like diagnostic harnesses accept `HUMAN_GAMES` / `HUMAN_DEF_IQ`. Added real-component browser input/render/completion checks in `scripts/qa/gameplay.mjs`; [diagnostic results](gameplay-balance-summary.json) and [whole-pool ratings](ratings-audit-summary.json) are committed. Updated CLAUDE.md, ARCADE-V2.md, RATINGS-AUDIT.md and BROWSER-QA.md with the current connection map and behavior.

### Validation

The full local suites passed NBA **274 / 31 skipped** and NFL **241 / 63 skipped**; a final additional above-99 throw-power regression passed with the focused gameplay/difficulty checks (**7 passing**). Whole-pool audit: **zero invalid entries**, including levels 1/5, edition floors, quality support and attribute bounds. TypeScript and production build passed; the retained large-bundle warning remains. GitHub CI records the exact final full-suite totals after source publication.

Content/browser flow passed in both sports with existing owned UIDs/levels/XP preserved, failed-pack no-charge and reload recovery, gallery claims, registered cards and event progression. Two independent clients per sport completed the revised signed local-relay matchmaking/squad exchange/Sim flow, agreeing on **one H2H win, one loss and 30 combined Rivals points**. Manual pointer shooting/throwing, populated actual canvases and complete rendered games passed with no page errors. Gameplay captures include 390×844 portrait, 320×568 reduced-motion and 844×390 landscape. These are Chromium checks; installed-iPhone input/animation feel and a two-phone Safari match remain device checks.

No profile/identity/owned-copy reset, backend migration or server function deployment was needed. Automatic saves, card mint serials, rewards, XP, wallet and existing keys/IDs stay connected. Source restore point before this revision: `backup/pre-gameplay-research-2026-10-30` at `f3ccd941475bc209c750557df0ef4850385bce49`. Original main/Pages and `backup/original-working-2026-10-28` remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Publication stays on the feature branch/PR #1 and the existing owner-private preview. Final source/CI/deployment IDs are appended after verification.


### Published private gameplay preview

GitHub implementation commit `4769e4507b632c55aeb7f4e05937ce3db356fb2e` matches verified local tree `769a8730d43addab9d8667665cb7052967d0262c`. It is published on `feature/season-evolution` / PR #1, with the original main/restore refs checked unchanged after publication. Existing Sites project `appgprj_6ae3270ad3608191af6024b57d2c2939` was updated in place from source `b888d32ca308732555f529dea6e0295c6e5731e3`. Native deployment `appgdep_6ae45a5c0d1c8191a68be82610af09cd` returned **succeeded**, saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_a9425ecd555881918843d3dac97ddae1`, URL https://perfect-season-private-preview.qem.chatgpt.site . No audience, origin, installed ID or namespace change. [PRIVATE-PREVIEW.md](PRIVATE-PREVIEW.md) records exact source/hosting connections and the preservation boundary.


GitHub [Review build #8](https://github.com/QemmHD/perfect-season/actions/runs/41029135522) passed for gameplay commit `4769e4507b632c55aeb7f4e05937ce3db356fb2e`, job `123974360887`: **NBA 275 passed / 31 skipped; NFL 242 passed / 63 skipped (517 passing)**. `npm ci`, full tests, whole-pool audit, TypeScript and production build all succeeded. These are the final independently verified code totals; the local counts above describe earlier local execution plus focused final checks. This release-record follow-up only changes documentation; its code tree remains the verified gameplay implementation.


## 90+ card stamps and active circulation — Codex, 2026-10-30

**Implemented by Codex (OpenAI)**. Owner clarified eligibility as **90+**, including upgrades, and explicitly chose first-connection registration order for existing unnumbered holdings. Existing numbered copies retain their serial. [CARD-CIRCULATION.md](CARD-CIRCULATION.md) records the exact frontend/backend file map, API, schema, source limitations, authorization model and restore procedure.

Added a matching inset serial stamp across owned cards, squad/club/storage/picker views, gallery and pack reveals. The left number is fixed; the right is active circulation, updated by Supabase Realtime with shared fetch fallback and monotonic revisions. Added generated 90+ eligibility (3,244 NBA / 7,952 NFL editions at an eligible level), additive metadata and persistent sold/SBC disposal queues. Registration races cannot recreate a consumed card; retries cannot assign a new serial or retire it twice. App sync only reads successfully persisted progress. Existing keys, profile v1, UIDs, levels, XP, squads and account identities are preserved.

Applied two additive migrations and deployed `card-registry` **v3**, SHA-256 `fc453c476fd8cbdf91e520c8757ab9dbcb114160d5e5c6979e6f91f324996a2f`. Original Nostr online features and `player-save` v2 are unchanged. Aggregate counts are publicly readable for Realtime; receipts/copy ownership and mutation RPCs remain private. Security/performance advisors are clean. Added pinned Realtime client dependency and lockfile; production dependency audit reports zero vulnerabilities.

Local full suites: **NBA 279 / 31 skipped, NFL 246 / 63 skipped (525 passing)**. TypeScript/build passed. SQL rollback tests verified ordering, exact-once retirement, zero, retained pack serials, no reuse/resurrection and access controls. Two-client signed browser tests in each sport verified rising totals, one-time sold decrease, actual Quick Sell confirmation, Realtime propagation and offline SBC/reload recovery while preserving 55/68 other fixture copies; no page errors. Updated content/pack/reload/gallery/event flows also passed in both sports with all existing fields preserved and additive number metadata allowed. Screenshots and final source/CI/deployment IDs follow after release verification.

Source safety point: `backup/pre-card-circulation-2026-10-30` → `e7a4ac7a5426b89b66d7f36037a5ab5af56ef7f8`. Main and original restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; source publication stays on the feature branch and existing owner-private preview.


### Published 90+ circulation source and preview

Feature implementation `47f498592a01535e8684a735bedef988ed0cc006` matches local verified tree `4eb2c4c63b757090bdbe42ec9e8377cf824d69d8`. GitHub [Review build #10](https://github.com/QemmHD/perfect-season/actions/runs/41037238347), job `124000981290`, passed: full tests, whole-pool audit, TypeScript and production build. Existing private Sites project source is `612ebbd3ef53201082728584caee2f6d24f21f73`; saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_69fa63fa507c8191bb42a459b6e45974`; deployment `appgdep_6ae46abe5d888191adc4258f5d0c4d0a` returned **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Exact source/hosting connections and isolation checks are in PRIVATE-PREVIEW.md. Main/original restore refs were checked unchanged. The follow-up release-record commit only changes documentation.


## Arena pack cinema — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** for the owner's request for a more surprising pack animation. [PACK-CINEMA.md](PACK-CINEMA.md) is the implementation/connection handoff; [previews/README.md](previews/README.md) includes actual-stage captures.

Added a floating foil pack, animated charge/seam rupture, opening arena doors, procedural light well/streaks, mystery-card and position/team staging, a late GOAT-only **99 SHATTERED** escalation, 3D card arrival, impact rings and restrained edition-colored confetti. The existing Archivo type, pixel players, crown, wrapper/card frames and registered serial stamps are retained. Ordinary cards have a shorter sequence; GOAT completes its entrance in 6.6 seconds. No fake GOAT promise is staged for other tiers.

Connections: `PackOpening.tsx` → presentation-only `pack-sequence.ts`, `PackAtmosphere.tsx`, `pack-cinema.css` and cancellable synthesized `packSound` cues in the original sound module. The canvas caps drawing at 30fps/72 motes/2× DPR and pauses when hidden. Skip clears timers/cues/canvas and disables motion. Reduced motion omits the cinematic sequence and particles. Keyboard opening/continue and safe-area controls are supported. No new dependencies, external visual/audio assets, backend deployment, pack odds, transaction logic or save-schema changes.

Validation: **283 NBA + 250 NFL tests passed (533 total)**; 31/63 existing skips. Focused final sound/timing checks: 17 passing. TypeScript/production build passed with the existing large-data/chunk warnings. Seven real-component touch-browser cases passed across GOAT, Spotlight, Gold, NFL Legend, 390×844 safe areas, 320×568, touch-rotated 844×390 and reduced motion. Keyboard open, serial/card/control bounds, mid-tear/mid-walkout Skip, particle cleanup and original copy/level/XP preservation passed without page errors. Browser fixture assertions were corrected for non-rare cards/reduced-motion completion; no game workaround was introduced. NBA/NFL pending paid-pack/reload/reward/gallery/event tests also passed, preserving all 56/69 original fixture copies with one recovered charge. Physical installed-iPhone sound/haptics/GPU/Safari behavior remains unverified.

Source restore branch: `backup/pre-pack-cinema-2026-10-30` at `e9a35dbd1e10d29c524579112608d847747c1dcd`. Main and the original restore branch were checked unchanged at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Final GitHub CI and existing owner-private preview deployment references follow after publication; no main merge or live Pages replacement is authorized or performed.
