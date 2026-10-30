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


### Published pack cinema source and preview — Codex

Implementation [`8e1611fde2f58905278ac0bcf16536d7500030f1`](https://github.com/QemmHD/perfect-season/commit/8e1611fde2f58905278ac0bcf16536d7500030f1) matches verified local commit `85d9aadeeee5a6274b3d7338f59de8a3bca735a4`, exact tree `f1a8893c6225d17c7a0f2df0f7a4256f2dde19c4`. [Review build #12](https://github.com/QemmHD/perfect-season/actions/runs/41040999207), job `124013477880`, **passed**: independently confirmed 283 NBA / 250 NFL tests (533 passing, 31/63 skips), whole-pool ratings audit, TypeScript and production build. Original large-chunk warnings remain.

Existing owner-private Sites source `c60c61367f0c51cd4d46b34086d7c99e1757a55a` built successfully and passed production boot/namespace/manifest checks. Saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_cc1a2bc71a4c8191a5c0fa0c66e8c6f0`; deployment `appgdep_6ae471a49ba08191b11e0cee10192aa8` returned **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Same owner-only audience, existing origin, preview namespace and installed PWA identity. No preview save reset, main merge, live Pages deployment or backend change. Exact connections and restore source are in PRIVATE-PREVIEW.md and PACK-CINEMA.md. This release-record follow-up changes documentation only.


## NFL rushing execution fix — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** after the owner reported near-impossible running. [NFL-RUSHING.md](NFL-RUSHING.md) records findings, exact modules, changes, before/after measurements, limits and restoration. The complete read-only diagnostic is in `scripts/audit_nfl_rushing.ts` and `docs/nfl-rushing-balance.json`.

Found that neutral/forward stick input overrode the called lane, normal stick travel met the spin threshold, outside paths crossed inside the edge, nearest-man blocking could double the guard's DT instead of taking the assigned edge, and defenders could follow the back as a pass route before the exchange. Corrected those interactions; initial normal run blocks last 0.25s longer with actual RBK/BSH dependence, tight ends get useful rated seals, and normal carry speed is 94% instead of 90% of rated speed. Manual cuts, early block losses, physical tackles, stamina, move cooldowns and existing difficulty reads remain. No invulnerability/guaranteed-yardage window or card-stat change was added.

Added Juke/Spin/Power buttons using the game's existing NFL control skins, including smaller sizes for short portrait screens and keyboard activation/focus. Deliberate flicks and double-tap remain; the outside play-card arrow uses the actual edge landmark. Main module connections: `football2/engine.ts`, `Football2.tsx`, `rushing-controls.css`. NFL matching rules advance to 5 in draft/UT; NBA stays 4. `DATA_V`, boards, records and save namespaces remain unchanged. No profile/owned copy/XP/wallet/pack/backend migration or server deployment.

Validation: **288 NBA / 255 NFL tests pass (543 total)**, 31/63 existing skips. Five new engine regressions cover the outside edge, distinct RT/RG blocks, lateral override, a legitimate backfield loss and finite 99+ runs. TypeScript/production build passed with the existing chunk warnings. The read-only audit ran 6,480 plays before and after across three team fixtures/three run concepts/three difficulties/three control strategies. Equal-gold Legend Outside Zone with old held-forward had a −0.4-yard median and 60% nonpositive runs; corrected held-forward produced a 1.7-yard median and 0% nonpositive in that 80-seed sample. These finite samples do not establish universal outcomes or human fun; the complete means/medians/distributions and limits are retained.

Real-component browser checks passed at 390×844, 320×568 and 844×390: held-forward exactly matched no-input outcomes, a normal 50px push did not spin, move buttons exercised actual run animations/outcomes, controls/safe areas fit, populated canvases and all 69 original fixture copies/levels/XP were preserved without page errors. The short-portrait layout was refined after screenshot review and rechecked. Two independent signed local-relay clients per sport agreed on one win/one loss and 30 combined Rivals points; NFL rule-5/unchanged NBA rule-4 matching passed. Physical installed-iPhone feel remains a device check.

Restore source: `backup/pre-nfl-rushing-2026-10-30` → `7f1cfbd0b85fe9c2f100f31d60294a3eb3ca7ae5`. The original main/restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Work stays on the feature branch/PR and existing owner-private preview. Final publication/CI references follow after verification.


### Independent CI follow-up: deterministic tamper fixture — Codex

GitHub Review build #14 (`41044181933`, job `124024056003`) passed NBA and all NFL rushing checks but exposed an existing flaky cloud-data test: it always replaced the first Base64 ciphertext character with A, which leaves random ciphertext unchanged when it already begins with A (about 1/64 cases). Codex corrected **only `src/lib/cloud-data.test.ts`** to choose A/B so the first significant character always changes, and asserts that the fixture differs before requiring authenticated decryption to reject it. No runtime save/encryption code, backend, player data or rushing physics changed. Final independent verification is recorded below after the follow-up run.


### Verified NFL rushing publication — Codex

Runtime implementation `152ec94e7d7d7e339c83facd8a8e2785449005e2` matches local `fb9a527bc66b807aa12cc340a2e96edc2d669d8f`, tree `d5e7a7d3c9b805804afe0cf549bc6ddffdff2abd`. Test-fixture correction/release record `a143e12151852d6dca11b93f3b1ce79d29dd620e` matches local `6b7cd2259c35a53ea1296b49872deb4d17290ff8`, tree `82c850b6baca4e5125255eb1e73cc8a51d621f22`. [Review build #15](https://github.com/QemmHD/perfect-season/actions/runs/41044676433), job `124025749338`, **passed**: independently confirmed **288 NBA / 255 NFL tests (543)**, 31/63 existing skips, whole-pool ratings audit, TypeScript and production build. The earlier CI failure and exact test-only correction are documented above; no runtime encryption change was needed.

Existing owner-private preview source `91dca4a555c365031685e02676f2697dff16341d` built and passed production bootstrap/namespace/manifest checks. Saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_f37dad903af4819184e4fb722394e032`; deployment `appgdep_6ae477ee618c819180c36745f2465f35` returned **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . It contains the verified runtime implementation; subsequent changes affect the cloud-data test fixture and documentation only. Existing private access, origin, preview namespace and installed PWA ID are retained.

Main/original restore refs were checked unchanged at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-rushing restore remains `7f1cfbd0b85fe9c2f100f31d60294a3eb3ca7ae5`. No live Pages promotion, account reset or backend deployment. This final release-record commit changes documentation only.


## Connected Ultimate Team clubhouse overhaul — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** for the owner's request to overhaul Ultimate Team with more features and gameplay. [UT-OVERHAUL.md](UT-OVERHAUL.md) is the complete source/connection/economy/research handoff for Claude. It includes five official EA/2K research references, original implementation choices and limitations.

The update adds a new clubhouse/Play HQ, a free 25-level/28-day Season Pass, daily/weekly/lifetime objectives with saved earned rewards, six-played-match solo Champions Circuit with three free weekly entries and 2/4/6-win milestone prizes, five manually played Moments per sport, three Development Lab programs for exact owned copies, three named squad presets, recent club form and per-copy squad appearances/wins. NBA screen/cut/space calls include real movement, planted collision, defender path reading, a brace pose and on-court guides. NFL Full Playbook exposes eight pass concepts/three runs plus a pre-snap physical formation/route/coverage/lane flip and matching diagrams. The control skins follow the existing game. No new package, copied commercial art, backend project/migration or account reset is introduced.

Optional `ut.hq` stays in profile v1 and the existing encrypted save snapshot. Inventory updates preserve canonical owned UIDs, edition IDs, serials, XP/levels and storage. Match coins/card XP retain the existing eight-game cap; the first 16 matches/day can earn SP, while explicit earned goal/season/Circuit/Moment rewards are separate. Pending-pack rewards reuse Store/registered receipt/reveal paths and normal published odds. Duplicate/stale settlements are blocked before payments; claims retain persistent receipts across reload and period changes. No Sim option or simulated settlement is allowed in Circuit. Original other-mode Sim, online, Rivals, events, collection, duplicate storage, gifts and admin paths remain.

Both draft and UT mechanics rules become **6 for NBA and NFL**; save keys, identities, `DATA_V` and leaderboard history stay unchanged. This isolates older mechanics from new-match queues. The pre-overhaul Git restore branch is `backup/pre-ut-overhaul-2026-10-30`, remote source `8e7773bc329cf9cdf10431bb95ec72a022a15603`. Main/original restore are not promoted.

Local verification: **575 unit tests passed** (304 NBA, 271 NFL; 31/63 existing skips), all-edition ratings audit, and production TypeScript/build. Final focused gameplay/progression/encryption checks passed **31/31** after UI/gameplay polish. Both-sport initial new-flow browser QA passed with 56/69 original copies preserved, full manual Moment attempt sets, reward/reload/preset/development/Circuit checks and no page errors. Prior collection/event/registered-pack retry flows and independent two-client rule-6 H2H also passed in both sports. Final screenshots, server-save QA and publication records are appended below when complete.

The extended cloud QA exposed a comparison defect: JSON serialization order of mint fields differed despite identical serial/request/namespace/count values. The test now compares the actual structures, keeping exact copy/serial checks and adding full HQ equality. No runtime save, encryption or registry behavior was changed for that test correction.


Final local browser verification passed in both sports: the complete clubhouse script, expanded real-server save/restore/conflict script (including full HQ equality), prior registered-pack/event/collection script, two-client rule-6 H2H, and real engine manual-input/full-autoplay smoke. Every script reported zero page errors. The engine smoke finished with finite scores/progress and preserved all 56/69 original fixture copies. [Thirteen actual captures](previews/README.md#connected-ultimate-team-clubhouse--codex-2026-10-30) show the new screens and responsive controls. Whole-pool audit checked 22,082 NBA / 32,242 NFL editions with zero invalid entries. Build/typecheck and final 31 focused assertions passed. Device-specific iPhone playtesting remains separate.


### Verified clubhouse publication — Codex

Runtime/source implementation `cc5179fd00fa4a3d494d08a2e368e18cf7097a0a` matches local `3e874eab4b3dc99bceb832408109d5411cf06f8d`, tree `2bcc7c817592d32f88631f7efd920eadf65200e9` (remote tree equality verified before moving the feature ref). [Review build #17](https://github.com/QemmHD/perfect-season/actions/runs/41106465021), job `124237473199`, **passed**: independently confirmed 304 NBA / 271 NFL tests, 31/63 existing skips, whole-pool ratings audit, TypeScript and production build. PR #1 remains open/unmerged.

Owner-private preview source `ff7b468ef2ff36c0acfbbdf7d37c7db635b885f5` built and passed production bootstrap ordering, forced `preview2026` namespace, PWA manifest/identity and zero-error boot. Saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_15cfefa597fc81918446d581d90af8f5`; deployment `appgdep_6ae4e14ec8a48191817acac2811e30bf` returned **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Owner-only access, origin, namespace and installed preview PWA ID were retained. This deployment contains the complete verified implementation; this release-record follow-up changes documentation only.

Main and `backup/original-working-2026-10-28` were checked unchanged at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; `backup/pre-ut-overhaul-2026-10-30` was checked at `8e7773bc329cf9cdf10431bb95ec72a022a15603`. No live Pages promotion, account reset, backend deployment or source-account transfer. Localhost/inspect QA fixture accounts are separate from players.


## Researched fixes and polish — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** after the owner requested research, a fix/polish plan and end-to-end verification. [UT-POLISH.md](UT-POLISH.md) records the prioritized findings, four primary MDN/W3C/EA references (15 Exa result slots), exact modules, economy/progress guarantees, reproduction steps and checks. Pre-change Git restore is `backup/pre-ut-polish-2026-10-30` at `f5f4e5138e7bf3bf60cd67f61c6795dbf24bb4d1`.

Confirmed fixes: explicit NBA shooting capture, dragged releases, canceled uncommitted jumpers and possession-readiness states; OS interruption/lost-capture cleanup in both sports; native modal NFL playbook with explicit focus return; inert Store/background and contained keyboard focus during pack reveals; replay-safe season batch claims and earlier-earned-reward navigation; optional weekly Circuit history preserving entries/bests/prize display; full-inventory development card/status and explicit original-copy return from duplicate storage; correct Moment units/difficulty/persisted bests and named progress bars/mobile action targets. No card ID/UID/mint replacement, account reset, pack-odds/price change, paid cap change, backend migration or main deployment.

NBA draft/UT mechanics advance to **7** for canceled-jumper handling; NFL stays **6**. Data versions/board history, profile keys, encrypted-save endpoints and signed identities are unchanged. `hq.circuitHistory` is optional and stored in the original snapshot. Current active runs and existing per-tier/objective/Circuit receipts stay authoritative.

Local verification: **589 tests** (311 NBA/278 NFL, 31/63 existing skips), final TypeScript/production build, all 54,324 card editions audited with zero invalid entries. Both-sport new polish/input/modality/batch/exact-copy and full clubhouse scripts passed. Existing content/registered-pack, real inspect-server save/restore/conflict and two-client signed H2H scripts passed both sports. All seven normal/reduced-motion/phone/landscape pack-cinema cases passed. Every completed browser script reported zero page errors; original copies/metadata/XP/wallet checks remain. [New captures](previews/README.md#researched-fixes-and-polish--codex-2026-10-30) show actual components/fixtures. Physical iPhone/two-phone tests remain separate. Independent CI and exact private deployment references will be appended when published.


### Verified polish publication — Codex

Implementation `f2ad6df57b45e22f1e4aa19952061f11e8d41ab4` matches local `e0ad4bb44997aed953eb901efc608e341a37cbe5`, tree `6633946c382d8dc5e29e0c9d6a9abdf899abbd0f` (remote equality checked). [Review build #19](https://github.com/QemmHD/perfect-season/actions/runs/41113183845), job `124260552711`, **passed**: independently confirmed 311 NBA / 278 NFL tests, the all-edition audit, TypeScript and production build. The local/both-sport browser checks and source research are recorded above and in UT-POLISH.md.

Owner-private preview source `8ed7d0391455d599380d525c0adc0d32eaa2f8a4` built and passed zero-error production boot, bootstrap-before-module, forced namespace and PWA identity checks. Saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_546a72c062a88191b3b0ea2ee1fe6c4d`; deployment `appgdep_6ae4eca9ef088191af6f95cff1fe12ed` returned **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . The origin, owner-only access, preview namespace and installed PWA ID are retained.

Main and original restore were checked unchanged at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-polish restore was checked at `f5f4e5138e7bf3bf60cd67f61c6795dbf24bb4d1`. No live Pages merge/deploy, account reset, backend migration/deploy or transfer of live accounts into preview. This final release-record commit affects documentation only; the deployed runtime is the verified implementation above.


## Actual court and field overhaul — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** after the owner's clarification that actual gameplay needed overhaul. [CORE-GAMEPLAY.md](CORE-GAMEPLAY.md) records concrete mechanics, controls, primary research, module connections, measurements and limits. This supersedes the latest mechanics queue description; both draft and UT queues are **8**, while data/board history and account/save/inventory keys remain unchanged.

NBA now resolves real reachable rebounds with BOARD control, physical pass/lob arrivals, context-specific shot meter/animation rhythm, direct teammate taps, help/weakside rotation and gradual teammate spacing. NFL now has explicit bullet/touch/lob trajectories and route-leading receiver buttons, momentum-preserving open catches with persistent catch animation, captured held burst using move stamina, assigned-blocker proximity/contact and bounded observed-velocity pursuit. These are original simulation/control changes inside the existing art/engine format, not an engine replacement or added playable defense.

Verification: 611 full-suite tests, focused post-edit physics/catch/input regressions, TypeScript/build, 6,480 before + 6,480 after rushing plays, 1,152 before + 1,152 after NBA possessions and a further Legend probe. Normal-speed actual match input/completion, responsive slow-motion control captures, both-sport inspect-server restoration/conflicts and signed two-client H2H pass. No live profile or backend mutation; no reset/migration. See the linked reports for actual distributions and hardware-testing limits. Source restore: `backup/pre-core-gameplay-2026-10-30` at `0bfe5a54bbf9f87c5865325fd8bd605f20140177`.


### Verified core gameplay publication — Codex

- GitHub runtime implementation: `37c640fb116dfe25dc94667a9cf76751d6c72508`; local source `a4ece2c741c700437fdd9bd99b06f6c104fee405`, identical tree `7c31dc1ce2687dc9798b7f7544e1e8906ae1374e` (remote equality verified).
- [Review build #21](https://github.com/QemmHD/perfect-season/actions/runs/41118840959), job `124280015967`, **passed**: independently confirmed 322 NBA / 289 NFL tests, all-edition rating audit with no invalid entries, TypeScript and production build.
- Pushed preview source: `4a8ff15f63840a10dbd88ee3ba0c7d377721a1cf`. Exact source built and passed zero-error production boot, forced namespace, bootstrap-before-module and preview PWA identity checks; source Git is clean.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_d5c3e014595c8191b02e872f60230617`.
- Deployment: `appgdep_6ae4f634498881918b569ba9e0ebc451`, **succeeded**, https://perfect-season-private-preview.qem.chatgpt.site . The same owner-private audience, origin, `preview2026` namespace and `./preview` PWA identity are preserved.
- Main and original restore were rechecked at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; the pre-core restore is `backup/pre-core-gameplay-2026-10-30` at `0bfe5a54bbf9f87c5865325fd8bd605f20140177`.

This release-record follow-up changes documentation only; deployed runtime is the verified implementation above. No live Pages merge/deploy, account reset, backend migration or transfer of live accounts into preview. The known physical-iPhone testing limit and existing bundle-size warning remain as documented.


## Direct NFL joystick correction — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** after the owner reported sideways strafing and missing direct joystick movement. [NFL-DIRECT-CONTROL.md](NFL-DIRECT-CONTROL.md) records the actual defect, superseded test assumption, input contract and module map. The old control discarded one axis and mixed lateral targeting with auto-forward movement; fast stick travel could trigger a skill and zero input. Humans now send normalized two-axis vectors, including reverse/diagonal/analog movement and release-to-stop. A permanent original-style stick and adjacent BURST support two thumbs; skills remain explicit buttons. Numeric/null lane-following remains for AI/simulation. NFL mechanics are 9; NBA stays 8; identities, wallet, owned copies/XP/serials, squads, rewards, saved progress and data history are untouched. Pre-fix source is `backup/pre-nfl-direct-stick-2026-10-30` at `aad7e9b4b747527945a481ad03857a8539bc6f05`.

Local full suites passed 651 tests; focused direction/release/speed/boundary regressions, TypeScript and production build passed. Actual two-axis coordinate movement, simultaneous touch steering/burst, release/interrupt stopping and responsive non-overlapping controls passed at three sizes; all 69 original fixture copies/squad/wallet survived. Separate normal Legend-defense play completed and both-sport signed H2H settled correctly. See the measured report for isolation/physical-device limits. Verified CI/private release provenance follows; main is not promoted.


## Verified direct-control publication — Codex

- GitHub runtime: `1cbf5dfd0b2d4b290e09e5941006f0604690c611`; local runtime `67b56bab53446bb158a2fe0c762952456ff7a363`; identical tree `7b37c39e6191e0316af865660d5feced52aeea45` was checked before updating the feature ref.
- [Review build #23](https://github.com/QemmHD/perfect-season/actions/runs/41125107355), job `124301297402`, **passed**: 343 NBA / 310 NFL tests (**653 total**, 31/63 existing skips), all-card rating audit with zero invalid entries, TypeScript and production build. The final rear-end-zone boundary is included.
- Pushed private source: `b76a1d5c83df133c048e607cf4e089e62bafea48`. Exact source build, clean Git, zero-error production boot, forced namespace/bootstrap ordering and retained preview PWA ID passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_2e7b381b4904819194847d589359f452`.
- Deployment: `appgdep_6ae5015e9cf4819194108372d7ded62d`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Owner-private audience, origin, `preview2026` namespace and `./preview` PWA identity are retained.
- Main/original restore were rechecked unchanged at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Source restore before this correction is `backup/pre-nfl-direct-stick-2026-10-30` at `aad7e9b4b747527945a481ad03857a8539bc6f05`.

No account reset, inventory/progress migration, backend deployment or promotion to live Pages. This provenance follow-up changes documentation only; the deployed runtime is the verified implementation above. Physical installed-iPhone feel remains an owner playtest; existing large bundle warnings remain.


## UI consistency and flow polish — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** for the owner's request that all new UI match Perfect Season's original quality/style. [UI-CONSISTENCY.md](UI-CONSISTENCY.md) records current-run screenshot findings, fixes, file map, numbered flow checks and limits. Fixed long header/wallet collisions, parent-tab state, undersized new labels/actions, three-digit stat column overlap and missing lineup Close; unified court/field panel tokens and selected/disabled feedback. Shared sheets now handle top-modal Tab/Escape/return focus without auto-opening the phone keyboard or drawing a border around the whole screen. Existing Archivo/type hierarchy, teal/gold actions, dark panels, foil/pixel art and round game controls remain the reference.

Local full suites pass 653 tests, TypeScript/build, measured both-sport UI/modal/layout checks at three sizes, complete clubhouse/content/polish/control flows, companion screens and inspect-server restore/conflicts. All original fixture copies/wallet/squads are preserved. Content QA checks event progression/history against the actual displayed win/loss rather than assuming a random simulated fixture must win. Gameplay/ratings/odds/transactions/save schema are unchanged; no queue bump (NBA 8 / NFL 9). Pre-polish restore: `backup/pre-ui-consistency-2026-10-30` at `86d64586271da62ea0fa9934d2c3bd5060307ecb`. Verified publication/CI references follow after release; main is not promoted.


## Verified UI polish publication — Codex

- GitHub implementation: `d11d0ad43979caadea3805a4a9901624e134eddb`; local `3b3dbd16b6b50a2b2e968c02ae380b5797e9a655`; identical tree `2625b65a1b4477c830296dc0f2d42020d7176b1c` checked before moving the feature ref.
- [Review build #25](https://github.com/QemmHD/perfect-season/actions/runs/41141703266), job `124357289800`, **passed**: 343 NBA / 310 NFL tests (**653 total**), all-card rating audit with zero invalid entries, TypeScript and production build.
- Pushed private source: `78f58146d3e0d7021118b41d7b23413a5c0fe958`. Exact source build, clean Git, namespace bootstrap ordering, forced `preview2026`, retained preview PWA identity and zero-error production boot passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_e341e61ba69c8191a27f10e39894a910`.
- Deployment: `appgdep_6ae521f1c618819181520822c14f870a`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . The same owner-private audience, origin, `preview2026` namespace and `./preview` PWA ID remain.
- Main/original restore were rechecked at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-polish source restore is `backup/pre-ui-consistency-2026-10-30` at `86d64586271da62ea0fa9934d2c3bd5060307ecb`.

This release-record follow-up changes documentation only; the deployed UI/runtime is the verified implementation above. No live Pages promotion, account reset, save migration, backend deployment, rating/odds/physics changes or transfer of live accounts into preview. Queues stay NBA 8 / NFL 9. Physical installed-iPhone/VoiceOver testing and the existing bundle-size warning remain documented limits.


## Play tab and football black-box correction — Codex, 2026-10-30

**Implemented by Codex (OpenAI)**. Added the sixth Ultimate Team Play tab and moved all competition entry points there, including saved Circuit continuation. Competition pages keep Play active and return to Play; Home retains club/progression management and a shortcut to the tab. Matched the existing icon/type/material language and retained six usable navigation targets. Fixed the reproduced normal-football 487px dark hint panel caused by basketball top-inset CSS combining with football bottom-inset CSS; football now has compact hints below the scoreboard and clear of play calls. See [file map, cause, QA and screenshots](PLAY-TAB-AND-FOOTBALL-HINT.md). Source restore: `backup/pre-play-tab-2026-10-30` at `c24b293c76441d7552c1d4b03a87aa8e5a1bb306`. No gameplay, account/progress/schema/backend/odds changes; NBA 8 / NFL 9 remain. Publication and exact verification references follow.

Local verification for this update: 653 full-suite tests, TypeScript/build, 30 UI layout/modal checks, both-sport six-tab/all-competition/back/resume checks, six normal-football tip cases (28–42px rather than 487px), complete clubhouse progression and signed two-client NBA/NFL H2H all pass. Original test copies, squad and wallet are preserved. See the new handoff's validation section for scope and limits.


## Verified Play-tab / football-hint publication — Codex

- GitHub implementation: `4a4d4afa234cb521ab8cf2e4dc9baf733145f621`; local `a7d12d83420b843ea1f4ceec516d39c94e4abf72`; identical tree `ac3c4e3d2c1a118167a1396265cfb78005720092` verified before updating the feature ref.
- [Review build #27](https://github.com/QemmHD/perfect-season/actions/runs/41143845149), job `124364191243`, **passed**: full NBA/NFL tests (653), all-card rating audit, TypeScript and production build.
- Pushed private source: `2f4eb7ad979fd98eab052a80cca1f64eaada4e9f`. Exact pushed-source production build, clean Git, forced `preview2026`, early namespace bootstrap, preview PWA identity and zero-error static boot all passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_622801bc1a208191a493ff3b25152bd6`.
- Deployment: `appgdep_6ae5266b08a881919d00ea23f0c1739c`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Same owner-private audience, origin, namespace and preview install identity.
- Main/original restore remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-update restore is `backup/pre-play-tab-2026-10-30` at `c24b293c76441d7552c1d4b03a87aa8e5a1bb306`.

This provenance follow-up is documentation only. The deployed runtime is the exact verified source above; no runtime redeploy is needed for this record. No account reset, progress migration, backend deployment or live Pages/main promotion. Physical installed-iPhone playtesting remains an owner check.
