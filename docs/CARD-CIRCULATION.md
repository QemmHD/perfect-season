# 90+ card numbers and live circulation

**Implemented by Codex (OpenAI), 2026-10-30.** Requested by the owner: a matching card stamp such as **12/32**, with the original issue number on the left and the number of copies still in circulation on the right.

## Player behavior

- Every owned card rated **90 or higher** qualifies, including cards that reach 90 through upgrades. The generated current catalog contains 3,244 eligible NBA editions and 7,952 NFL editions at one or more levels.
- Existing unnumbered copies register when the player first connects after this update, in the order the server accepts them. This is the owner's chosen rollout rule, not a reconstruction of historical pull order. New eligible cards register automatically; offline cards show a pending stamp until confirmed.
- Already-numbered GOAT/Spotlight copies keep their original serials. Each exact edition (`sport:kind:season:pid:franchise`) has its own sequence and active count. Duplicate copies are distinct; moving between Club, squad and Duplicate Storage does not create or remove a copy.
- **12/32** means issue #12 and 32 active copies worldwide. A new registration can make it **12/33**. A sale or SBC consumption can make it **12/31**. The left number never changes and retired numbers are never reused. Consequently **12/8** is possible after enough other copies leave circulation; it is an issue number, not a rank among survivors.
- Copies removed offline are saved in a retry queue before contacting the server. Reconnect/reload completes the same retirement once. Counts can reach zero. A retried request cannot resurrect a retired copy or decrease the count twice.
- Numbering and retirements do not modify existing UIDs, XP, levels, squad references, wallet, collection discovery/rewards, pack receipts or account identity. Numbering metadata and the retry queue are included in existing encrypted server saves.

## Source and service map

| File/system | Responsibility |
| --- | --- |
| `scripts/build_numbered_catalog.ts`, `npm run data:numbered` | Derives the first eligible level from the actual `rateCard()` model. Regenerate when rating/edition rules change. |
| `src/data/numbered-{nba,nfl}.json` | Small lazy eligibility lookup; does not load the entire UT catalog on the home screen. |
| `supabase/functions/card-registry/numbered.json` | Matching frozen server eligibility. Below-90 submissions are rejected. |
| `src/ut/numbered-sync.ts` | First-connection registration and persistent retirement retries; only attaches metadata to copies that are still owned, never recreates a removed card. |
| `src/App.tsx` | Starts sync using the last **successfully persisted** profile, preventing a failed local write from prematurely retiring a copy. |
| `src/ut/storage.ts`, `state.ts`, `types.ts` | Optional `retirements` queue and `CardMint.activeAtPull`; sale/SBC removal and queue addition are one local update; additive v1 migration. |
| `src/ut/UltimateTeam.tsx` | Quick Sell / SBC reasons, current mint metadata passed into the existing reveal. |
| `src/ut/circulation.ts` | Shared per-sport/namespace count cache, Supabase Realtime subscription, revision ordering and reconnect/focus/30-second polling fallback. Tiles share a connection/request batch. Older responses cannot overwrite a newer decrease. |
| `src/ut/CardSerial.tsx`, `CardArt.tsx`, `card-editions.css` | Inset numbered stamp and larger circulation explanation; existing typography/foil palettes, owned-card views, packs and collection gallery. Catalog/opponent templates never invent an owned serial. |
| `src/ut/registry.ts` | Existing signed Nostr identity → existing `card-registry` endpoint; live aggregate reads, registration/disposal validation. |

### Database

Supabase project remains `ryqaibujweiwwvdtswxj` (the existing approved free registry project). No new project or paid plan was created.

- `ps_card_totals.total`: cumulative issue sequence, retained for old clients and never decremented.
- `ps_card_totals.active_total`: currently active copies, incremented on mint/registration and decremented exactly once on retirement.
- `ps_card_totals.revision`: increases on every change, so delayed reads cannot reverse newer updates.
- `ps_card_copies`: private ledger keyed by namespace, sport, signing actor and original owned-copy UID; unique edition/serial; original receipt reference; immutable serial, optional retirement time/reason.
- `ps_registry_copy`: service-only, security-invoker RPC. Per-actor advisory locking and atomic counter writes make retries/concurrent requests safe. It cannot originate GOAT/Spotlight cards: those require the existing server-approved pack path.
- `ps_registry_open`: retains existing pack/retry/odds behavior, adds the copy ledger and active count. Paid Spotlight chase slots are 7 (NBA) / 15 (NFL); event rewards use slot 0. Existing numbered receipts are backfilled with those exact UIDs.

Only aggregate count rows are publicly readable for Realtime. Private copy ownership and pack receipts remain denied to browser roles; mint/retire RPCs are not anonymously executable. Mutations require the existing verified Nostr signature, and actor identity comes from that signature. Standard 90+ holdings use the game's existing client-owned inventory model; this does not claim a new server-authoritative economy. Rate limits and idempotent UID matching constrain accidental repeated registration.

Migrations created with the Supabase CLI and applied:

1. `20261030092417_live_card_circulation.sql`: additive counters/ledger, original receipt backfill, service-only functions and aggregate Realtime.
2. `20261030093533_circulation_policy_precision.sql`: one aggregate SELECT policy, separate explicit browser-write denial. Security/performance advisors are clean after this correction.

The `card-registry` Edge Function is **version 3**, active, pinned `nostr-tools@2.25.2`, custom signature verification (`verify_jwt=false`), source bundle SHA-256 `fc453c476fd8cbdf91e520c8757ab9dbcb114160d5e5c6979e6f91f324996a2f`. The original `player-save` function stays at version 2. Frontend Realtime uses pinned `@supabase/supabase-js@2.118.0` with browser auth persistence/auto-refresh disabled; no new login flow is introduced.

The GET API preserves cumulative `counts` for older clients and adds `activeCounts` / `versions`; new clients read the active values. Existing pack receipts remain readable. Historical disposals made by older clients were not reported, so the migration cannot infer them; this release records subsequent sales/SBC removals explicitly. Namespaces remain separate: QA uses `inspect`, private preview uses `preview2026`, original release uses the empty namespace.

## Verification and restore

`supabase/tests/circulation.sql` rolls back every write while checking global ordering, retry stability, one-time retirement, zero active count, no reused serial, no resurrection, original numbered pack retirement, wrong-owner rare-copy denial and table/function access boundaries. The existing registry tests remain compatible.

`src/ut/circulation.test.ts` checks decreasing/versioned counts, immutable metadata, unchanged owned-copy progression/squads, persisted sold/SBC queues, selective acknowledgement and all-tier/upgrade eligibility. `scripts/qa/circulation.mjs` uses two isolated browser identities per sport to test real signed registrations, Realtime changes within 12 seconds, a repeated retirement, offline SBC/reload recovery and preservation of other copies. Actual Quick Sell confirmation is exercised when the peer owns the selected fixture edition. Content/pack/event browser tests also preserve all original fields while allowing additive number metadata.

Reproduce with `npm test`, `npm run build`, `npm run data:numbered`, and the localhost QA scripts described in BROWSER-QA.md. Production dependency audit: zero vulnerabilities. The existing large-bundle warning remains; eligibility and Realtime SDK chunks are lazy.

Source restore branch before this revision: `backup/pre-card-circulation-2026-10-30` at `e7a4ac7a5426b89b66d7f36037a5ab5af56ef7f8`. Main remains `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Leave the additive database schema intact when reverting the frontend; legacy reads continue to use the cumulative counter. Do not delete ledger/receipt rows or reset player profiles as part of a source restore. Final feature/CI/private-deployment references are recorded in CODEX-UPDATE-LOG.md and PRIVATE-PREVIEW.md.
