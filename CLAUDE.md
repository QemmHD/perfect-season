# Perfect Season — handoff for Claude and future contributors

This is the existing React/TypeScript iPhone home-screen PWA, served by GitHub Pages. NBA and NFL share a wallet/settings/identity and keep separate sporting progress. Read `docs/GAMEPLAY-RESEARCH.md` for the latest ratings/gameplay revision, then `docs/CODEX-UPDATE-LOG.md` for additions **implemented by Codex**, their file map, validation and release status.

## Preserve player progress

- Keep profile version 1 and the existing localStorage keys. Never reset profiles, rename existing card IDs, regenerate signed player identities, auto-sell cards, or clear collections to ship an update.
- `ut.owned` is the canonical list of **every** owned copy. `ut.duplicateStorage` is a list of UIDs for UI placement. The original restore build can still read all cards. Equipped UIDs, levels and XP must survive migrations.
- New fields are optional and migrate additively in `src/ut/state.ts`. Automatic server saves include both sports; the player signing key stays on the device and admin credentials are excluded. See docs/AUTOMATIC-SAVES.md for identity/recovery limits.
- Original source restore: branch `backup/original-working-2026-10-28`, commit `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. A source restore is separate from restoring phone-local saves.

## Connections and module map

- `src/net/nostr.ts`: original five-relay Nostr transport and signed player identity. `match.ts`: existing matchmaking/live matches. `leaderboard.ts`: original boards. `gifts.ts`: admin gifts. These are **not Supabase features**.
- `src/ut/UltimateTeam.tsx`: UT routing, transactions, packs, card details and SBC submission.
- `src/ut/state.ts`, `storage.ts`: additive profile migration and duplicate storage.
- `src/ut/cards.ts`, `rate.ts`, `pool.ts`, `teams.ts`: stable edition IDs → rated gameplay attributes → pool fingerprint → playable squads.
- `src/game/hoops2/` and `src/game/football2/`: existing actual match engines. The Codex 2026-10-30 revision changes shared gameplay for both draft and UT. Above-99 ratings must stay finite and affect actual play; preserve the original pixel/mocap visual style.
- `src/evolution/`: Codex Cloud Save status/conflict UI (replacing the file-backup screen), continuation, Training Camp and SVG marks. `src/lib/cloud-{save,sync,data}.ts`: original signed identity → encrypted server saves → revision/conflict protection. `src/lib/recovery.ts`: checkpoints/shared validation and unreachable legacy file helpers.
- `src/game/difficulty.ts`: selected offline defensive settings and equal Legend defense online (including simulations/takeovers). Match protocol rules are 4; `DATA_V`/leaderboard history is retained. The NBA/NFL `gameplay.test.ts` regressions and `scripts/qa/gameplay.mjs` check the revised engines.
- `src/ut/rivals.ts`, `rivals-net.ts`, `Rivals.tsx`: Codex division progress/rewards and separate signed Nostr standings.
- `src/ut/rating-quality.ts`, `calibration.ts`, `nfl-identity.ts`: all-tier position/season-supported ratings, 372 public NBA anchors and explicitly estimated NFL physical identities; no universal promo attribute floors. New `season-reference.ts` and lazy `season-references-<sport>.json` add exact-matched public same-era benchmarks, before edition boosts. Read docs/RATINGS-AUDIT.md and GAMEPLAY-RESEARCH.md before tuning; ordinary draft rating formulas remain separate from UT calibration.
- New collection, event and card-registry modules are detailed in the update log. `src/ut/pack-reveal.css` and `PackOpening.tsx` implement the Codex Spotlight/GOAT reveal sequences; `GoatCrown` in `CardArt.tsx` is the shared card/reveal mark. Keep globally registered mint serials separate from player-local copy UIDs.

## Private test copy

[docs/PRIVATE-PREVIEW.md](docs/PRIVATE-PREVIEW.md) records the separate owner-private Sites test URL, exact project/source/deployment IDs, and `preview2026` namespace. Keep its preview bootstrap and hosting identity out of the live Pages build. Main and the original restore branch remain unchanged.

## Working and verification

`npm run dev`, `npm run typecheck`, `npm test` (both sports), `npm run build`. Test browser profiles with `?ns=inspect&relay=ws://localhost:7777`; do not submit fixtures to live boards. Verify phone widths, reduced motion, storage migration, exact-once rewards, and online pool compatibility. Installed-iPhone and two-phone checks complement Chromium tests.

Use the existing Archivo typography, teal/gold palette, pixel players and game card proportions. New symbols use SVG instead of unsupported Unicode glyphs.

## Attribution and maintenance

Codex implemented the changes recorded in `docs/CODEX-UPDATE-LOG.md`. Keep attribution factual: distinguish original Claude/game code, Codex additions, subsequent fixes and source-backed estimates. Each future change should update that log (or its successor) with author/tool, date, commit or release reference, purpose, file/connection map, tests and deployment state. Never mark unverified or undeployed work as live.
