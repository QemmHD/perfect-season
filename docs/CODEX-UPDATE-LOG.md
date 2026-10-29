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

## Implemented by Codex — Ultimate Team content expansion (current work)

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
