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


## Ultimate Team Club Season — Codex, 2026-10-31

**Designed and implemented by Codex (OpenAI)**. Added the full NBA/NFL season competition under Play, using the player's owned UT squad and real court/field runtime. Every completed match advances a deterministic whole-league round, with stable AI rosters, records, team stats and simulated AI player leaders. Performance form changes actual isolated AI attributes/OVRs and bounded between-game behavior. Added standings, schedule, scouting, eight-team playoffs (NBA best of seven / NFL knockout), champion/finale and next-season history. Normal manual match rewards retain daily caps; AI simulation pays nothing. Optional `ut.league` migrates additively and round-trips through existing encrypted server saves. Match cursor/fixture replay validation precedes all rewards; incomplete games keep their fixture. No original account/card/serial/XP/squad reset, backend migration, new currency faucet or online queue change (NBA 8 / NFL 9). Source restore: `backup/pre-ut-league-season-2026-10-31` at `846f0d6364bbbc912408b537eba5eca772d2d238`. [Full rules, module map, tests and limits](UT-CLUB-SEASON.md). 671 full-suite tests pass, with final season-focused tests, TypeScript/build and real both-sport browser flows; verified publication references follow.


## Verified Club Season publication — Codex

- GitHub implementation: `3417c1af36457a1638548b5970ebd9e749676b72`; local `6fdebc5272004a33795a67d84914a752fcb72566`; identical tree `4056d0a9b5b7380d7e6e01601b5da5c62250d8da` verified before moving the feature ref.
- [Review build #29](https://github.com/QemmHD/perfect-season/actions/runs/41151373240), job `124388440621`, **passed**: 671 tests (352 NBA / 319 NFL), all-card rating audit, TypeScript and production build.
- Private pushed source: `76032bcac02ef75af814bfe0472676953be94dcd`. Exact pushed-source production build and clean Git verified. Static boot had zero page errors; early forced `preview2026`, retained `./preview` install identity/title and the Club Season bundle passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_4af7e7309a24819196628dae30776a82`.
- Deployment: `appgdep_6ae53946c094819186716fb5a74d310a`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Same owner-private audience, origin, namespace and install identity.
- Browser evidence: both real App/UT/Arcade matches settled correctly (NBA loss / NFL win), all AI club records advanced once, reload and next-season history survived, 56 NBA / 69 NFL original copies and squads remained. Four season sections at three sizes, manual shot/snap, real runtime autopilot, seeded postseason/finale, Play back/parent navigation and prior football tip bounds passed. Signed two-client H2H still settles in both sports. The unit suite also round-trips the season through encrypted server snapshots.
- Main/original restore remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Pre-season source restore: `backup/pre-ut-league-season-2026-10-31` at `846f0d6364bbbc912408b537eba5eca772d2d238`.

This release-record follow-up changes documentation only; the deployed runtime is the exact verified implementation above. No live Pages/main promotion, account reset, backend migration, queue change or transfer of live player saves into preview. Physical installed-iPhone playtesting remains an owner check.

## Claude follow-up: independent review and fixes — Claude (Anthropic), 2026-11-01

**Implemented by Claude (Anthropic) via Claude Code.** The owner asked Claude to independently verify Codex's work on `feature/season-evolution` (handoff commit `77a86a10e6ef8cb9dd5f0f718e84acf69e7dedc4`) and fix concrete bugs without removing features. Everything above this section remains **implemented by Codex (OpenAI)**. This section covers only the Claude commit whose subject starts "Claude:" (see git history on this branch).

### Independent verification of Codex's release (before any change)

- Branch head matched the handoff commit. `npm ci`, `npm run typecheck` and `npm test` all passed: **671 tests (352 NBA / 319 NFL)**, matching Codex's record.
- Codex's `scripts/qa/league-season.mjs` was re-run against a local dev server and relay and passed in both sports:
  - NBA: 30 clubs, 82 games, season start 347 ms.
  - NFL: 32 clubs, 17 games, season start 751 ms.
  - Each sport: a real match settled, the round advanced once, the season survived reload, the championship fixture and history were kept, all 56 NBA / 69 NFL original copies remained, and there were no page errors.
- Code review of settlement found the replay, duplicate and malformed guards sound. `settle()` rejects a league result that is online, simulated, from a stale fixture, out of range, inconsistent with `won`, or a repeated `matchId` before paying anything. League games use the normal 8-a-day paid cap.

### Fixes (Claude)

| Area | Bug found | Fix | Files |
| --- | --- | --- | --- |
| Club Season sim | NFL AI-vs-AI games could finish tied (equal drive totals) yet record a winner and W/L. | The recorded winner takes it with an overtime field goal (+3). Saved results are untouched; later seeded rounds differ only where a tie would have occurred. | `src/ut/league.ts`, `src/ut/league.test.ts` |
| Club Season UI | Starting a season, or switching hub tabs, left the hub scrolled ~89px down, hiding the record card (fully at 320px). The reset targeted `.ut-body`, but `.page.league-page` is the scroller. | Also reset the page element. | `src/ut/LeagueSeason.tsx` |
| Shared sheets (owner report) | Bottom sheets show a grab bar but couldn't be swiped down; only X or a scrim tap closed them. | Native touch swipe-to-close in the shared `Sheet` (details below). | `src/ui/common.tsx`, `src/ui/Card.tsx` |
| Ranks (owner screenshot) | THIS WEEK / ALL TIME vanished when a board was long. `.spantoggle` (overflow hidden) is a flex child of the scrolling `.page` column, so it shrank to its 2px border. | `flex-shrink: 0`. A probe of every main tab, UT tab and Club Season tab in both sports found no other squeezed elements. | `src/styles.css` |

How the swipe-to-close works:
- The drag works anywhere on the sheet once its content is scrolled to the top. It follows the finger and dims the scrim.
- Releasing past about a quarter of the sheet's height (at most 140px), or a downward flick, closes it through the existing `close()`. Anything else springs back.
- Horizontal drags, form controls, tiltable cards (`data-tilt`), `touch-action: none` regions and scrolled content keep their own gestures. A lift after a drag doesn't click what's underneath.
- Escape, X and scrim tap still slide the sheet away after a snap-back. Reduced motion skips the transitions.

Connections: `Sheet` is used by Settings, Cloud Save, Store, card details, SBC, Clubhouse, Leaderboard, Results, Binder and other modals. Their content, focus trap and keyboard handling are unchanged. Codex's Draft drawer has its own grip drag and isn't affected.

### Validation (Claude)

**Automated checks:**
- `npm run typecheck` and `npm run build` pass. The existing chunk-size warning remains.
- `npm test`: **673 passed (353 NBA / 320 NFL**; skips unchanged at 31 / 63). The one new test per sport is the no-tie regression, which fails on Codex's original `league.ts` for NFL and passes with the fix.
- Codex's `scripts/qa/ui-consistency.mjs` passes in both sports: 0 header or card-stat collisions, modal keyboard/return OK, 56 / 69 original copies, wallet and squad preserved, no page errors.
- Codex's `scripts/qa/play-tab.mjs` passes at 320, 390 and 844px. Football tips stay clear of the call and the score.
- Codex's `scripts/qa/league-season.mjs` passed in both sports before the fixes (see above).

**Real-touch Chromium checks (CDP touch events, 390px, normal and reduced motion):**
- A short pull springs back and a sideways drag is ignored.
- A long pull, a flick and a mid-drag release past the threshold all close the sheet.
- Escape after a snap-back still closes it.
- No page errors.

**Layout probes (390px; 320px for the hub):**
- With 80 rows injected into the Ranks board, the toggle now measures 32px. It was 2px before the fix.
- Started season hub: scrollTop 0 (was 89).
- No flex item is squeezed on any main tab (Home, Daily, Ranks, Boosters, Profile), any UT tab (Home, Play, Squad, Club, Store, SBC) or any Club Season tab, in either sport.
- A 3× capture at 320px confirmed the standings OVR column isn't clipped.

### Not changed / boundaries

- No storage keys, profile version, account, identity, wallet, owned copy IDs, serials, levels, XP, squads or saved seasons changed. No reset or migration.
- Nostr and Supabase connections are untouched. No downloadable backup workflow was added.
- Online queues stay NBA 8 / NFL 9.
- Work is pushed only to `feature/season-evolution`. **Not merged to main, not deployed to live Pages**, and the owner-private Sites preview has **not** been redeployed with these fixes: that deployment is controlled from Codex's/the owner's OpenAI Sites project. Physical installed-iPhone checks of the swipe gesture and season flow remain owner checks.

### Pack fix after owner testing — Claude, 2026-11-01

**Found by the owner on the test page ("packs don't work"), reproduced and fixed by Claude.**

Bug, reproduced in Chromium and WebKit:
- Buying a Spotlight pack reserves it (`ut.pendingPromo`) and asks the card registry for the pull.
- If that request failed (offline, a dropped connection, or the test page, where the sandbox blocks the registry), the Store showed "Failed to fetch".
- **Every other pack was then blocked** ("Finish your reserved pack in the Store first."), including Bronze through Premium, the starter pack and reward packs. This lasted until the registry answered, which on the test page is never.

Fix:
- `openNow` in `src/ut/UltimateTeam.tsx` now waits only while a registry request is actually in flight. A reserved Spotlight that failed no longer holds other packs.
- The reservation, its same-ID retry, charge-on-arrival and receipt validation in `promo.ts` are unchanged. Only one Spotlight can be reserved at a time, as before.
- `src/ut/registry.ts` turns a failed connection into "Can't reach the card registry right now. No coins were charged. Retry when you're back online." The Store adds "Your other packs still open normally."

Validation:
- New check `reserved-pack` (Chromium, both sports, registry blocked):
  - The Spotlight is reserved and not charged.
  - A Gold pack opens and is charged 900, adding its cards (5 NBA / 12 NFL).
  - The reservation is kept.
  - With the connection back, RETRY SAME PACK completes the Spotlight once (charged 3,500, reservation cleared).
  - Original copies are kept and there are no page errors.
- WebKitGTK on the restricted test build: starter, Gold and Silver open, and Silver opens while a Spotlight is reserved.
- Codex's `scripts/qa/content.mjs` (failed Spotlight → reload recovery, inspect namespace), typecheck and both test suites: see the commit message.

### Spotlight packs on the test page — Claude, 2026-11-01

The test page's sandbox blocks the card registry, so a Spotlight pack there could only stay reserved. The owner asked how to open it. Builds made with `vite build --mode testpage`, used only for the claude.ai test page, now roll Spotlight packs and Spotlight rewards on the device:

- They use the server's own odds (`chaseTier` in `supabase/functions/card-registry/contract.ts`) and the same chase catalog.
- The rare card gets **no worldwide serial**, and nothing is sent to the registry.
- `registry.ts` exports `TEST_PAGE`, and `promo.ts` accepts an unnumbered rare pull only when `TEST_PAGE` is true. Pricing, charge-once and the reservation are unchanged.
- Any other build mode, including GitHub Pages and the Sites preview, removes this path at build time. A production build was checked: no `testpage` code and no catalog chunk.

Validation on the restricted test-page build:
- Buying a Spotlight opened 8 cards and charged 3,500 once.
- A reservation left over from the earlier build opened by itself on the next visit to Ultimate Team and was charged once.
- No page errors.
- Both suites still pass: 353 NBA / 320 NFL.

### Separate Claude test copy (owner-private claude.ai page)

At the owner's request, Claude published the production build of `02ccdbc` (`npm run build`, version `20261101.0606-02ccdbc`) as an owner-private claude.ai page: https://claude.ai/artifact/38vSryyQVZLARkNKvq1g6W . It is **not** the Sites preview, and it doesn't replace it.

What differs from the Sites preview:
- It starts with its own fresh local save, separate from both the live game and the Sites preview.
- The page sandbox blocks every outside connection: Nostr relays, the Supabase card registry and server saves, and the service worker. So it can't touch live boards, serial counts or saves, and online features, cloud save and offline install don't work there.
- The only change from the branch build is the page title ("Perfect Season Test"), with `sw.js` and the launch images left out.

Use it for offline checks: Club Season, Ultimate Team, packs, the sheet swipe and Ranks layout. Updated in place at the same URL after each fix below. It is now built with `vite build --mode testpage`. Saves on the page carry over.

Before publishing, the same build was booted locally under an equivalent policy (own files only, `connect-src 'self'`). The app loaded and onboarding worked with no page errors; the blocked connections only log console errors.

## Expanded game-rating references — Claude (Anthropic), 2026-11-01

Branch `claude/ratings-refs` (not merged). Same-season game-rating references grow from 8,938 to 11,009 NBA and from 2,114 to 19,509 NFL player-seasons: season cards with a reference go from 44% to 55% (NBA; 96% from 1999) and from 7% to 63% (NFL; 99% from 2000). New `scripts/build_expanded_references.py` adds prioritised `sets` blocks (final / next / preseason / retro) to `src/data/season-references-<sport>.json`, keeping the original rows. `seasonReference()` in `src/ut/cards.ts` reads them; `ratingReference.kind` marks fallbacks; the card detail prints the snapshot label. No rating formula changed, but UT ratings move (UT queue splits via `pool.print`; draft queues stay NBA 8 / NFL 9). No save, card ID or backend change. Sources, terms, mapping and coverage: `docs/RATINGS-AUDIT.md` (last section) and `docs/CREDITS.md`. Tests: new `src/ut/season-references.test.ts`; Rodman 1995-96 floor 89 → 86 (2K26 rates him 87); pool-loading hooks get 60 s timeouts.

## Ultimate Team ratings rework — Claude (Anthropic), 2026-11-01

Branch `feature/season-evolution` (includes the merge of `claude/ratings-refs`); not deployed. Owner request: balance card overalls, make the stats match the overall, make it feel like real Ultimate Team. Full method, tables and numbers: [RATINGS-AUDIT.md, "Claude rework 2026-11-01"](RATINGS-AUDIT.md).

What changed:
- Estimate-path fixes A–G from the ratings audit (era-normalised NBA overall, 3PT ceiling/floor and Limitless, centre/PG bias, reference trust incl. down-weighted `preseason`/`retro` fallbacks, nearest-season borrowing, NFL group maps quantile-matched to 19.5k Madden ratings, career floor, attribute bias), plus NFL Combine athleticism (`src/data/nfl-combine.json`, credited in CREDITS.md).
- Card face: NBA cards print six categories OUT/INS/PLY/ATH/DEF/REB weighed in the card's best role; football keeps position keys. `supportOverall()` moves the role's main skills so the overall sits within ~3 of the weighted face (gold median gap +7 → +1.7 NBA / +7.2 → +1.4 NFL).
- Per-position (NBA per decade) gold balance; one isolated, configurable UT display scale (`src/ut/ut-scale.ts`) set to the EA FC 27-style pyramid: Bronze 40–64 / Silver 65–74 / Gold 75–99 (≈35/35/30%), base golds mostly 75–82, ~14 (NBA) / 25 (NFL) base cards at 90+, top 91; Hot Season 94–97 (no 99s), Legends 88–95; Spotlight/GOAT unchanged. Every threshold follows (tiers, `onScale`, SBC targets, Squad Battles rungs, quick-sell ranges, walkout 86+).
- Levels: +1 overall at levels 3 and 5 only (max +2, was +4); +1 key attributes per level. XP/levels unchanged.
- NBA shot curve (hoops2 engine): poor shooters' green window and off-green threes fall (open-three make% at 70 rating 78 → 69), elite unchanged.

Before → after (season cards): NBA bronze/silver/gold 10,895/7,507/2,902 → 7,471/7,513/6,320; NFL 20,846/5,600/4,409 → 10,840/10,780/9,235. Hot Season at 99: 50% / 37% → 0. Legends at 99: 22 / 42 → 0. Out-of-sample estimate MAE / tier agreement: NBA 5.2 / 63% → 4.3 / 70% vs raw 2K (2.6 / 85% vs the final pipeline); NFL 6.0 / 66% → 4.0–4.4 / 76–77% on the original sample, 4.2 / 78% vs the final pipeline on the expanded one.

Files: `src/ut/{ut-scale,card-face,nfl-combine}.ts` (new), `rate.ts`, `calibration.ts`, `season-reference.ts`, `cards.ts` (career lookup, combine load), `nfl-identity.ts`, `types.ts` (`face`, `rawOvr`, `rawExact`), `CardArt.tsx`, `CardDetail.tsx`, `league-form.ts`, `packs.ts`, `battles.ts`, `Match.tsx`, `src/net/match.ts`, `src/game/hoops2/engine.ts`, `src/styles.css`; scripts `fit_ut_scale.ts`, `fit_ut_balance.ts`, `build_nfl_combine.mjs`, `audit_ut_ratings.ts`; regenerated `docs/ratings-audit-summary.json`.

Tests: `ratings-audit.test.ts` adds the scale pyramid, edition ranges, per-position/era balance, face consistency, level ≤ +2 and famous-season regressions (Curry 2022 3PT ≥ 95 + Limitless, Jokić, Mahomes 2024 rating ≥ 88 and gold, Tyreek Hill 2016/2018 SPD, Brady ≤ 66, Vick ≥ 93, Calvin Johnson ≥ 93, OL no longer dominating); identity tests compare `rawOvr` (2K/Madden-comparable); `rate.test.ts` levels/tiers/promo rules; pool-load hooks get 60 s. `npm run typecheck` and `npm test` pass (NBA 361 / NFL 328).

Compatibility: draft queue NBA 8 → 9 (shot curve; NFL draft 9 unchanged); UT queue rules NBA 8 → 9, NFL 9 → 10, and the pool fingerprint changes. No profile/key/ID/serial/level/XP change; numbered eligibility files untouched (numbering still keys on the 2K/Madden-comparable 90+). Owned cards show new displayed overalls and tiers. Server `SPOTLIGHT_RATES` unchanged.


### UT content drop 2 — Claude, 2026-11-01 (branch `claude/ut-content`, not deployed)

Built by Claude from the research spec; the full record is in [UT-CONTENT-2.md](UT-CONTENT-2.md).

What it adds:
- **Five new packs:** Daily Drop (with a 7-day streak), Scout's Choice (pick 1 of 3), Elite Gold, Jumbo Premium, and Standout Guarantee with a weekend Lightning copy.
- **Rare golds:** the top 35% of each position's golds. Gold, Premium and Position packs now guarantee some, and the cards get a shimmer.
- **Two promos:** Weekly Standouts (`<sport>:standout:<week>:…`) and Landmark Seasons (`<sport>:landmark:…`). Both resolve lazily in `pool.ts`, so owned copies load forever. Each has its own card art and walkout flourish.
- **New modes and screens:** Scout Market and Swap Desk; Pack Helper tags and a quick-sell-dupes bar on the reveal; Set Collections; UT Draft, which plays real `Match.tsx` games with exactly-once settlement; chemistry pips; and the one-time New Era bundle (an Icon pick plus 65,000 coins).

Saves and connections:
- New state lives only in optional `ut.content` (`content-state.ts`). `profile.ts` gains one hook that stamps New Era eligibility.
- No key, ID, serial or backend changes. `SPOTLIGHT_RATES` and the registry are untouched.

Online: `pool.print` mixes in `CONTENT_PRINT`, so this build's UT queue doesn't pair with older builds that can't resolve the new editions. `UT_RULES` stays NBA 8 / NFL 9, and no gameplay rule or existing rating changes.

Tests:
- New: `content2.test.ts` (both sports).
- Changed: `economy.test.ts` now skips free and pick packs in its quick-sell bound.
- Browser QA: `scripts/qa/ut-content.mjs` at 390 and 320 in both sports, with zero page errors.

### UT content wave 2 (FC 27 mechanics) — Claude, 2026-11-01 (branch `claude/ut-content`, not deployed)

Added:
- Item Score and Streamlined SBCs.
- A Daily hub: login calendar plus an all-three objectives bonus.
- The Preview Pack.
- Holographic variants (`holo~` ids).
- The walkout clue sequence: era → conference/division → franchise, with promo stage colours.
- An Evolutions lab: `evo~` play ids, while the owned copy's id stays unchanged.
- A Rewards inbox with CLAIM ALL.

Saves and online:
- New state stays inside optional `ut.content`.
- `CONTENT_PRINT` is now `ut-content-3`; no rule or base rating changes.

Validation and details: the "Wave 2" section of [UT-CONTENT-2.md](UT-CONTENT-2.md), `content3.test.ts`, and `scripts/qa/ut-content.mjs`.

### UT wave 3: Live Calendar — Claude, 2026-11-01 (branch `claude/ut-content`, not deployed)

What it adds:
- The 12-month schedule, with the owner's renames and Finale SBC-only decision applied.
- A rule-based, deterministic selection of program cards. Ids `<sport>:live:<promo>[.f]:…` rebuild from the id forever.
- A 364-day repeat after the scheduled year.
- Program packs, guarantees and picks, built on the content-drop packs.
- Season SBCs.
- A Home "This Season" banner with "Coming next".
- Standout Guarantee and Elite prices retuned to a 45–60% quick-sell EV.

Saves and online:
- `CONTENT_PRINT` is now `ut-content-4`, and the fingerprint includes the schedule version.
- No new state field.

Scope, what isn't built yet, and tests: "Wave 3" in [UT-CONTENT-2.md](UT-CONTENT-2.md) and `calendar.test.ts`.

### Ratings rework merged into `claude/ut-content` — Claude, 2026-11-01

`feature/season-evolution` d64921c is merged into the content branch.

Changes on the content side:
- Content thresholds use the new display scale (`fc-scale.ts`). Standouts land at ~80–93, Landmarks at 85–93, programs inside their bands, and the New Era Legends at 88+.
- Edition faces follow the new card face.
- Every paid pack is retuned to 45–60% quick-sell EV.
- The Live Calendar selections are frozen in `src/data/live-editions.json` by `scripts/freeze_live_editions.ts`.

Queues come from the rework (UT NBA 9 / NFL 10), plus this branch's `CONTENT_PRINT` fingerprint.

Details: the "After the ratings rework" section of [UT-CONTENT-2.md](UT-CONTENT-2.md).
## Gameplay ratings pass — Claude (Anthropic), 2026-11-01

Branch `claude/gameplay` (from `feature/season-evolution` d64921c); not merged, not deployed. Owner request: make every rating matter in play and balanced, NBA 2K / Madden / EA FC as the reference for play and animation, and make the gameplay enjoyable. Full tables: [GAMEPLAY-RATINGS.md](GAMEPLAY-RATINGS.md).

What changed:
- NBA (`hoops2/autopilot.ts`, `engine.ts`, `game.ts`, `types.ts`, new `badges.ts`): autopilot pass cost and six-pass limit, pick and roll and step-backs, Pro release 66 ms (elite shooters 0.71 → 1.18 PPP; even teams 1.01 PPP); contact stonewall by STR/weight/PRD vs handle; shot curve with rating-scaled contest caps (open three 36/51/67/81/87% for 45/60/75/90/99), green window unchanged; PRD contest, closeout caps, driving-dunk rules, IND at the rim, PAS, and-one FT, defender stamina, ACC; 2K26-tiered badges (Deadeye per shot type); Lob City, Heat Check, Icon now work.
- NFL (`football2/engine.ts`, `autopilot.ts`, `drive.ts`, `types.ts`): all 16 abilities (seeded ~50% zone, pop events); truck/stiff arm by TRK/SFA + STR + weight with contact timing, AI/POWER button pick the move that beats the man; accuracy now shows (receivers read the ball late), THP speed, route-break wins, contested catch/SPC, power/finesse rush, BCV, AWR, STR leverage; run game 7.75 → 4.53 ypc; cliffs removed (pancake, big hit, press, kick window); steep coverage spans halved.
- Feel (render only): `src/game/juice.ts` (trauma shake, kick, zoom, hit-stop, pooled particles), dunk styles and rim hang (`pixel/poses.ts`, `hoops2/render.ts`), ball squash/stretch, SPD 92+ afterimage, badge/ability pops, weight gait and sprint lean (`pixel/style.ts`), NFL catch leap/bobble (`football2/render.ts`), haptics inside pointer handlers and gesture-gated iOS ticks (`lib/sound.ts`), `Hoops2.tsx`/`Football2.tsx` wiring.

Compatibility: match rules bumped once — draft NBA 9 → 10, NFL 9 → 10; UT NBA 9 → 10, NFL 10 → 11 (`net/match.ts`, `ut/Match.tsx`, pinned in `net.test.ts`/`nfl-net.test.ts`). No profile, key, card ID, serial, level, XP, rating or backend change.

Tests: new `hoops2/ratings-matter.test.ts` (offensive monotonicity, curve targets, contact, PRD, FT, stamina, tiers, Lob City/Heat Check/Icon), `football2/ratings-matter.test.ts` (move inversions, AI move choice, accuracy, rush, route wins, kick window, ability rolls/effects/events), `juice.test.ts` (seeded NBA/NFL games identical with and without juice); opt-in `balance.test.ts` (`BAL=1`). Existing gameplay tests unchanged and passing; typecheck, full `npm test` both sports, build and the gameplay/core-gameplay/rushing/joystick QA scripts pass.

Open: NFL 90-vs-75 synthetic teams still win ~99% (adjacent real-lineup tiers are ~80%); NBA 90 v 75 is 89%. NBA draft "overall" (value rank) doesn't track attributes, so OVR-matched real NBA lineups aren't a fair balance check.

## UI reorganisation — Claude (Anthropic), 2026-11-01 (branch `claude/ui-reorg`, not deployed)

Purpose: organise the whole app like a current sports-game app (FC 26 "For You"/Play menu, FC 27 Campaign Hub, MUT/MyTEAM manage areas; sources in [UI-NAVIGATION.md](UI-NAVIGATION.md)), implement the UI/IA audit's P0–P2 items, and give every feature added since the audit one clear home.

What changed:
- Main tabs HOME · ULTIMATE TEAM · RANKS · PROFILE. The Daily is Home's Daily tile (result and countdown), Boosters are in Profile, the Gauntlet chip opens a sheet, and PLAY never leaves the screen (Home's content scrolls above it).
- UT tabs HOME · PLAY · SQUAD · CLUB · CHALLENGES · STORE, mapped in `src/ut/nav.ts` (one title, tab and parent per view; root tabs have no back button; Home's is EXIT). Home is an action hub (Continue, Rewards with CLAIM ALL, This Season + Season Pass, Daily, Standouts, featured Store promo, squad, records). Play is Solo / Online with live status rows and one Rivals card. Club and Challenges use segments. Store is ordered Your packs → Daily Drop → This Season → Featured → Picks & previews → by price.
- Shared pieces in `src/ut/ui.tsx` and `src/ut/nav.css`; per-mode status lines in `src/ut/play-status.ts`; new SVG icons in `src/ut/icons.tsx`.
- Fixes: squashed buttons in scrolling columns (START SEASON, sheet buttons), tap targets ≥44 design px, truncation, the NUMBERING placeholder, dev-wording leaks, one name per thing (glossary in UI-NAVIGATION.md), badges count only claimables and things to open, card details keep their actions in a sticky bar.

Connections and saves: none changed. No profile field, storage key, claim ID, card ID, price, odds, reward or queue changes. Only UI text changed in `progression.ts` (objective plurals) and `inbox.ts` (the Sets item title).

Commits: `2d780ba` (UT navigation model, Home, Play), `2f505ef` (UT screens), `cd5b11a` (main tabs), then the QA and docs commits on `claude/ui-reorg`.

Validation (Claude, 2026-11-01, before merging the gameplay pass): `npm run typecheck`; `npm test` both sports (NBA 415 passed, NFL 382 passed); `npm run build`. `scripts/qa/ui-reorg.mjs` (new): 204 screens — every main tab and sheet, every UT tab, segment and sub-screen, card details and the filter sheet, at 430×932, 390×844 and 320×568, NBA and NFL — with no horizontal overflow, clipped text, sub-44 targets, squeezed items, wrong tab/back/title or page errors (card name plates still ellipsize the longest surnames, by design). Updated and passing: `play-tab.mjs`, `ui-consistency.mjs`, `clubhouse.mjs`, `league-season.mjs`, `ut-content.mjs`. WebKit (WebKitGTK MiniBrowser over a `vite preview` build, both sports at 390 and 320): Home, Profile, all six UT tabs, card details, Season Pass and Club Season with no page errors or overflow.

After merging `feature/season-evolution` 713c63f (gameplay ratings pass) into `claude/ui-reorg` (`5797e59`): typecheck, `npm test` (NBA 439 passed, NFL 406 passed), `npm run build`, the five navigation QA scripts, `ui-reorg.mjs` (204 screens clean) and the WebKit pass (44 screens clean) all re-run and pass.

## Soccer, the third sport — Claude (Anthropic), 2026-11-01 (branch `claude/soccer-data`, not deployed)

Purpose: wire the soccer data (SOCCER-DATA.md) and the Attacks engine (SOCCER-ENGINE.md) into the app as a full third sport, as polished as NBA/NFL, without changing anything for basketball and football players. Player and developer guide: [SOCCER.md](SOCCER.md).

What changed:
- Sport layer: `SportId`/`UtSport` gain `'soccer'`; `pick({ nba, nfl, soccer })` / `pickFor` replace every two-way sport branch on a soccer path; `src/engine/sport-branches.test.ts` fails on new `NFL ? a : b`-style branches. Home's switch is NBA · NFL · SOCCER (reload model unchanged).
- Draft game: soccer cells (40 clubs × decade), spots GK CB FB DM/CM CM/AM W ST FLEX, attack/midfield/defense/goalkeeping rating with a simulated win curve, a 38-game W-D-L season with points and scores, a one-game-a-round knockout cup with penalties, GameCast in halves with scorers and the shootout, missions, rewards, rarity, Binder sets, Gauntlet, share text and poster, soccer leaderboards (`perfect-season/soccer/v1`).
- Head to head: `Soccer2` in `Arcade.tsx` (lazy), draws to penalties (played on the pitch against the AI; online and simmed an agreed deterministic shootout, the host kicking first), soccer draft queue `ps1-soccer-…-1`.
- Ultimate Team: lazy `cards-soccer.json`, the file's own overall and six-stat faces, FC tiers, formations 4-3-3 / 4-4-2 / 4-2-3-1 / 3-5-2 on a pitch (optional `ut.formation`), club/league chemistry, soccer pack shapes and position packs, Squad Battles, Circuit, UT Draft, Standouts, SBCs, Rivals (UT soccer queue 1). Hidden in soccer: Club Season, Legends Events, Moments, Spotlight/GOAT and serials (the registry allows nba/nfl only), Landmarks, the Live Calendar, Training Camp.
- Saves: additive `perfect-season:profile:soccer:v1` and optional soccer checkpoint/training keys in recovery and the cloud snapshot (older saves validate and restore without touching soccer; a player without soccer progress saves exactly what older builds wrote); favorites gain an optional soccer club.
- Loading: soccer data by top-level await (`engine/soccer-raw.ts`, es2022 build target), engine and cards via `src/soccer-lazy.ts`; soccer chunks and sounds are left out of the service worker's install precache (cached on first use). The artifact build aliases both to stubs (NBA/NFL only). `npm run build` uses a 4 GB heap.
- Sounds: Mixkit soccer SFX (#3022, #438, #2108, #2112, #2077, #614) via `scripts/build_sfx.py`, venue `'pitch'`.
- Engine: set pieces tuned (`SP_TUNE`): corners 33.7% → 11.6%, free-kick attacks 28.3% → 12.9%, penalties 79.0% → 74.9% (`setpieces.test.ts`).

Connections, saves and queues for NBA/NFL: unchanged (no profile field, key, card id, rating, price, odds or queue changes). Basketball's and football's `DATA_V` are the same as before.

Validation (Claude, 2026-11-01): `npm run typecheck`; `npm test` — NBA 481 passed, NFL 448 passed, soccer run (`PS_SPORT=soccer vitest run soccer sport-branches`) 53 passed; `npm run build` (static entry 3.71 → 3.76 MB, gzip 1.19 → 1.22 MB; install precache 17.46 → 17.52 MB with no soccer chunk or sound in it; soccer data chunks 1.0 MB and 3.7 MB load on first use); the artifact build (NBA/NFL only, no soccer data). Browser QA (Chromium): `scripts/qa/soccer-app.mjs` switch, draft → season → cup → results, a 1 vs 1 autopilot match, UT starter → squad (formation change) → Squad Battles match → Store, and Home/draft/UT at 430/390/320, all without page errors; `scripts/qa/online.mjs soccer` (two clients, soccer UT queue, settled once each); `scripts/qa/ui-reorg.mjs all all` for NBA and NFL: 204 screens clean. Not yet: an iPhone playtest of the soccer controls.

## Final release QA — Claude (Anthropic), 2026-11-01 (branch `claude/final-qa`, from `1cc9835`, not deployed)

Purpose: the last pass before the live Pages release. Builds (`npm run build`, `npm run audit:ratings`, the testpage build), every browser QA script, a WebKit smoke, an old-save migration check and a visual sweep at 390×844 and 320×568 in all three sports.

Fixed (display only; no save, key, card ID, claim ID, price, odds, reward or queue change):
- `8d0f5a0` first-launch team picker: the soccer change had flipped `FavPicker`'s opening tab (a new NBA player saw the NFL grid under "PICK AN NBA TEAM"; a soccer player the NBA grid under "PICK A CLUB"). `firstFavTab` in `lib/favorites.ts` (+ test); Welcome asks for this sport first; SOCCER tab label upper case.
- `4a31ca3`, `ebbac9b` match HUD at 320px: the score bug (football's clock; basketball's two-digit scores and eight-letter rival) and basketball's 16 possession marks were wider than the screen. A `max-width: 350px` block in `styles.css` (football also drops the spot). `gameplay.mjs` asserts both at 320.
- `bb3f714` soccer UT result: attack outcomes were bare letters with goals unhighlighted; now GOAL/SAVE/WIDE/BLK/LOST/OFF, goals highlighted.
- `55691cb` NFL squad pitch: an offset RB, so on 320×568/375×667 his card no longer covers the QB tag. `75ce69a` soccer pitch: wider centre backs, 3-5-2's CB/CDM higher, 4-2-3-1's holding pair wider (3-5-2's CB hid the keeper's rating at every size). Measured card/tag overlaps: none at 390×844; at 320×568 only 3-5-2's CB tag still touches the keeper.
- `7117a12` QA scripts `content`, `polish`, `reveal`, `circulation`, `ui-extras` updated to the reorganised UT navigation and renamed labels (assertions unchanged).

Verified: typecheck; UT/lib/ui tests both sports, soccer run; all QA scripts except `cloud.mjs`/`cloud-backend.mjs` (they write to the live save backend); WebKitGTK 2.52 MiniBrowser smoke (preview build, 3 sports × 2 sizes, 48 steps, no page errors); old saves made by the 7285ced build and by the Codex 3417c1a build keep every copy, level, XP, squad slot, serial, duplicate-storage UID, `ut.hq` field, coin and key; New Era pays 65,000 once across sports and reloads, one Icon pick per eligible sport (waits in the Store if left), never for a new player.

QA side effect to note: generating the Codex-era fixture with the 3417c1a build without `?ns=inspect` registered three throwaway NBA copies in the **live** registry namespace (1961 Richie Guerin NYK, 1996 Tim Hardaway GSW, 1973 Wes Unseld WAS, each serial 1) and saved one encrypted cloud save for a throwaway identity. No player data was touched.

## Pack Tracker — Claude (Anthropic), 2026-11-01 (branch `claude/pull-tracker` from `1cc9835`, not deployed)

Purpose: the owner's ask, "add a tracker so you can see all cards pulled to weigh packs". Guide: [PULL-TRACKER.md](PULL-TRACKER.md).

What changed:
- State: optional `ut.content.pulls` (`src/ut/pull-log-state.ts`, normalised in `content-state.ts` → `migrateUt`): the newest 300 packs (at most 1,500 cards) with each card's id, overall and tier at pull time, plus uncapped totals per pack type (opened, paid, coins, quick-sell value, tiers, overall buckets, 86+/90+/special packs, walkouts, legends, best pull). Worst case about 95 KB per sport; typical a few KB.
- Logging: `recordPull` (`src/ut/pull-log.ts`) in the same update that deposits a pack's cards, before they land, skipping a pack whose id is logged or whose first card is owned. Call sites: `UltimateTeam.openNow` (Store packs, limited/program packs, Daily Drop, Preview Pack, starter, waiting reward/gift packs with their source read from the pack id), `UltimateTeam.keep` (Scout's Choice and every other pick, with the Store price when bought), `promo.ts registeredOpening` (Spotlight packs and event rewards).
- UI: the `tracker` view (`PullTracker.tsx`, `pull-tracker.css`; `nav.ts` Club → Pack Tracker, back to Club), linked from Club's Players segment and the Store (PULL HISTORY). BY PACK compares your return / 86+ / 90+ / special rates with expected rates drawn through the real pack code from the published slot odds; RECENT is the pack feed with pack-type and card filters; ALL CARDS lists every copy the save knows, marking cards from before the tracker.

Connections, saves and queues: no new storage key, profile version 1, no odds, price, card id, pack content, transaction, `packsOpened`, protocol or queue change. Saves with and without `pulls` validate and round-trip through file recovery and the encrypted cloud snapshot unchanged.

Validation (Claude, 2026-11-01): `npx tsc --noEmit -p .`; `npx vitest run src/ut` (NBA: 220 passed, 9 skipped), `PS_SPORT=nfl npx vitest run src/ut` (218 passed, 10 skipped), `PS_SPORT=soccer npx vitest run soccer sport-branches` (8 files, 64 passed, the tracker's 11 cases included) — new `pull-tracker.test.ts` / `soccer-pull-tracker.test.ts` (exactly-once incl. reload and replays, caps vs uncapped totals, aggregates, pick and Spotlight receipt logging, all-cards marking, expected rates, old saves, cloud/recovery round trip). Browser (Chromium): new `scripts/qa/pull-tracker.mjs all all` — NBA, NFL and soccer at 390×844 and 320×568, real Store/Daily/Scout's Choice/reward openings, all three sections and filters, card details from a mini, reload with no double logging, no page errors, overflow or sub-44 targets. Regression: `ui-reorg.mjs nba 390` and `nfl 320` (34 screens each, clean), `ut-content.mjs` (all ok). Not yet: an installed-iPhone check.

## Soccer aim, shoot and pass — Claude (Anthropic), 2026-11-02 (branch `claude/soccer-shooting` from `262ba97`, not deployed)

Purpose: the owner's playtest of the live soccer match: "the aiming and shooting needs touched up", then "the closer to green the more accurate it is" and a passing touch-up that keeps passes free (no lock-on). Details, sources and the before/after tables: [SOCCER-ENGINE.md](SOCCER-ENGINE.md), "Aim and shoot, and free passing".

What changed (soccer only):
- Controls (`soccer2/Soccer2.tsx`, `render.ts`, `soccer2.css`): the stick only runs; a drag on SHOOT aims (snapped gently toward the corners), no drag = aim assist (the open side, low); a small goal over the meter and a reticle whose ring tightens toward the green; the release word (PERFECT / GOOD / EARLY / LATE) and a reason on a miss; a dashed pass line. Set-piece takers can still aim with the stick; keyboard: arrows aim while Space is held. Hints, the intro card and Arcade's how-to text match.
- Engine (`soccer2/engine.ts`): continuous shot accuracy in the release (`coneMult`), range and across-the-body accuracy, aim assist (`assistAim`, `openSide`), `TOP` 0.72 → 0.62 s; keeper: narrows tight angles, sets on the backlift, spreads close in, dives toward where the ball passes him; free passing (`passPlan`, `pass(…, free)`), receivers run on, passes run past teammates they aren't for; `SP_TUNE` penalties/free kicks retuned. Autopilot aims in the old scale.
- Queues: soccer draft `ps1-soccer-…-2` and UT soccer 2 (were 1). NBA/NFL engines, protocols, keys and saves untouched.

Measured (`scripts/audit_soccer_shots.ts`, 300 each): a run-in one-on-one 0 % → 50 %; wide-angle shots 68–83 % → 14 %; SHO and keeper ratings monotone; autopilot whole attacks within about a point per scenario (corners 11.7 %, free kicks 14.7 %, penalties 73.3 %; wide overloads 12.0 → 9.7 % the largest drop).

Validation (Claude, 2026-11-02): `npx tsc --noEmit -p .`; `PS_SPORT=soccer npx vitest run soccer sport-branches` (9 files, 74 passed, new `shooting.test.ts` 10); the full NBA (518 passed, 46 skipped) and NFL (485 passed, 78 skipped) suites, since `Arcade.tsx`, `net/match.ts` and `ut/Match.tsx` are shared files (soccer-only text and constants changed there). Browser (Chromium, real CDP touch, 390×844 and 320×568): `scripts/qa/soccer-lab.mjs` (run, drag-aim shot, buttons, a whole autopilot match with a goal, set-piece set-ups, a 13-kick shootout; 0 page errors, 60 fps median), `scripts/qa/soccer-app.mjs arcade` (draft → autopilot match → result), and a HUD pass (pass line, assisted and dragged meters, release word, miss reasons, penalty drag). Not yet: an iPhone playtest (thumb feel of the drag, meter timing).


## Implemented by Codex (OpenAI) — Admin Studio, 2026-11-03

Review branch `feature/admin-studio`, based on current main `7db37b6`, source restore branch `backup/pre-admin-studio-2026-11-03`. Full feature list, file/connection map, compatibility, server entitlement design, progress protections and final QA/deployment record: [ADMIN-STUDIO.md](ADMIN-STUDIO.md). Original owner access and all giving/local controls remain. Added native Control Room, GOAT/Icon/team/exact-player rewards, XP/booster gifts, preset bundles/history, precise card-copy levels and three signed configurable store packs. No main deployment/account reset or download-backup workflow is part of this review update. Claude's current New Era/Soccer/rating/gameplay work is retained.

Admin Studio review/preview: [PR #2](https://github.com/QemmHD/perfect-season/pull/2), initial implementation `4a6c569b9c26c484e4c06a87a5845214cdf7b20c`; [owner-private preview](https://perfect-season-private-preview.qem.chatgpt.site), deployed source `6dc57f3b75ad84dca8ae369db60a229ba7451785`. Existing card-registry function ACTIVE v4; no schema/data reset; live count/authentication/rejection smoke passes. Final validation and exact Sites release IDs are in [ADMIN-STUDIO.md](ADMIN-STUDIO.md).

Completed local Admin Studio verification: full `npm test` NBA 537 passed/46 skipped, NFL 505 passed/78 skipped, Soccer 74 passed; additional registered GOAT deposit/replay admin tests 9/9 for NBA and NFL; ratings audit, production builds, typecheck and final three-sport phone QA pass. No main deployment.

Final owner-private Admin Studio deployment: source `ca5701f67bbc4e04844d95f8c809fedadeb63cda`, Sites version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_30d563a251f481919dade4cdcb54692e`, deployment `appgdep_6aea5eb0e3a8819189ad8fb9c9efc549`; succeeded 2026-11-03. Main remains `7db37b6`; actual owner-signed delivery/catalog publication is the remaining phone acceptance check.


### Admin navigation clarity — Codex (OpenAI), 2026-11-03

Explicit section names, Recipients → Rewards → Review gifting, four reward categories, preserved cross-tab drafts, post-send feedback and grouped local tools. Existing access/actions/protocols/progress remain; no backend changes. Files: `src/ui/Admin.tsx`, `src/admin/AdminStudio.tsx`, `src/admin/admin-studio.css`; updated three-sport UI QA in `scripts/qa/admin-studio.mjs`. Current screenshots and full behavior/verification: [Admin Studio](ADMIN-STUDIO.md#navigation-clarity-follow-up--codex-openai-2026-11-03).

Navigation preview deployed successfully from `c99cff26d4957318c0dff2b87e59f7c4503db82d`: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_9cb01154f2e48191b657b4b00ae1b369`, deployment `appgdep_6aea629dc6fc819182c0605f519bee8d`. NBA 21 / NFL 16 / Soccer 15 focused tests pass (one Soccer GOAT-only skip); three-sport phone flows, typecheck, builds and static namespace smoke pass. Full release notes and screenshots are in ADMIN-STUDIO.md; main and the backend are unchanged by this follow-up.


## Game overhaul and screen-fit audit — Codex (OpenAI), 2026-11-07

Implementation branch `feature/perfect-season-next`, based on current main `7db37b6` plus the preserved admin branch `ea03347`. Source restore: `backup/pre-overhaul-2026-11-07`. Full verified findings, shipped changes, priorities and release status: [OVERHAUL-AUDIT.md](OVERHAUL-AUDIT.md).

Added own-club Open/Silver/Chemistry Cups across three sports, recent-run Play recommendations/filters, NBA direct move buttons and actual Last Play feedback, observed match debriefs with NBA/NFL practice and earned-pack Store routes, complete canonical reward claims, lazy per-sport startup/first-offline ratings cache and actual visible-viewport sizing. No account reset, canonical card/copy rename, mint change, backend deployment or gameplay-queue change. All prior Claude New Era/rating/engine/admin progress is retained.

Detailed source/connection maps and validation: [Cups](OVERHAUL-CUP.md), [Gameplay](OVERHAUL-GAMEPLAY.md), [UX](OVERHAUL-UX.md), [Performance](OVERHAUL-PERFORMANCE.md), [Rewards](OVERHAUL-REWARDS.md), [Screen fit](OVERHAUL-SCREEN-FIT.md), [Integration QA](OVERHAUL-QA.md). Final publication references and checks are recorded in the audit release section.

Overhaul owner-private publication succeeded: source `d4c7a01a44b9075f91dac99ce6e4655122e387c7`, version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_05b8c909ff188191b6e1cd74bbb80aa6`, deployment `appgdep_6aef8bc1d7248191b7b3600e1af404ad`. Full tests: NBA 571/46 skipped, NFL 551/78 skipped, Soccer 74 passed; new focused25eachsport and13viewportgeometry cases pass. Real Cup, control, reward, admin and offline-worker browser regressions pass with zero page errors. Main remains `7db37b6`; review branch includes the preserved admin changes. Complete artifact/device limits and final file map: OVERHAUL-AUDIT.md.

## Claude UI pass on the overhaul screens — Claude (Anthropic), 2026-11-08 (branch `claude/next-ui` from `6461f8a`, not deployed)

Owner request: make Codex's new screens feel like the rest of the game (FC / 2K Ultimate Team menus). Presentation only: no reward, settlement, save, odds, physics or queue changes; every button label, route, `aria-*` name and QA selector is kept.

- **Play hub** (`Clubhouse.tsx` PlayHQ markup, `play-hq.css`, new `play-art.tsx`/`play-art.css`): mode tiles with art per mode (your squad's pixel players vs a rival silhouette, the Cup trophy on a bracket, a league table, legend card backs, a stopwatch, the Circuit route, draft card backs), a short tagline instead of three text lines (the full purpose stays in each tile's accessible name), CONTINUE / FREE ENTRY flags, a sliding session switch and a featured next-play banner (your top three cards fanned in real card art). An odd tile count leads with one wide tile. The list keeps `.play-mode.hq-mode.ut-row` and gains `up-list`, which `play-tab.mjs` already waited for.
- **Club Cups** (`CupView.tsx`, `cup.css`): a trophy SVG per Cup (Open gold, Silver silver, Chemistry teal) in a cabinet and picker, the entry rule and an ELIGIBLE / NOT ELIGIBLE YET badge with a progress bar, three rule chips, a QF → SF → Final bracket built from the saved run (other quarterfinal/semifinal drawn as ghosts), a your-club-vs-rival card, the prize as pack art, a sticky main action, and a title moment (rays, cheering pixel player, the shared `Confetti`, prize pack) that shows first when a run is done.
- **Match result** (`match-debrief.css`, `MatchDebrief.tsx`; `Match.tsx` only moves the breakdown below the rewards): a broadcast FINAL scoreboard in the score-bug materials, gold WIN with rays, reward tiles that pop in, stat tiles with fill bars for real ratios, a coach's note.
- **Last Play / NBA moves** (`PlayReadout.tsx` SVG marks instead of text glyphs, `play-readout.css`): the score bug's glass and type, a compact two-column card, football's toggle moves under the score bug while the play-call panel is up; CROSS / STEP BACK / SPIN use the beveled violet CROSS material.
- **Admin Control Room** (`admin-studio.css`, SVG arrow in `AdminStudio.tsx`): the Play hub's selected pill and tile materials.

Checks: typecheck, `npm test`, build; QA `play-discovery`, `overhaul`, `play-feedback`, `admin-studio`, `ui-consistency`, `league-season` pass; `ui-reorg` reports only the UT Home Season-banner target that fails the same way on `6461f8a`; `play-tab` now passes its 320/390 loops and stops at the 844×390 tab-bar size check (it stopped earlier, on the removed `.up-list`, before this pass). No QA script changed.
