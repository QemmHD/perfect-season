# Private preview — implemented by Codex, 2026-10-29

Test URL: https://perfect-season-private-preview.qem.chatgpt.site

This is a separate owner-private copy hosted using Sites. It does not merge the feature branch, deploy GitHub Pages, or modify main. Sign in with the same ChatGPT account when prompted. Open in Safari; optionally use Share → Add to Home Screen. Its installed name is **PS Preview**. Keep the existing Perfect Season icon for the live game.

## Isolation and behavior

- Separate HTTPS origin means separate browser saves, identity, localStorage and service-worker caches from the original qemmhd.github.io game.
- The preview copy's index.html sets `ns=preview2026` before modules initialize, overriding an omitted or different query parameter. The existing NS_SUFFIX mechanism isolates Nostr queues, boards, presence, admin gifts, Rivals, and Supabase card serial totals. Reloads and installed launches retain that namespace; the preview manifest starts at `./?ns=preview2026`.
- It starts with a normal fresh profile; no fixture coins/cards or altered odds are shipped. Earn/spend coins and test packs, collections, storage, events and training normally. Preview progress does not automatically transfer to the live game.
- Head-to-head needs another player/client on the same preview namespace; it will not pair with live-game players.
- The original service connections remain Nostr plus the separate Supabase card registry. The registry uses the preview namespace for this copy, so test pulls do not change live counts.

## Source and hosting connections

Based on GitHub feature commit `661c51411c865efbe0c231801d0fca03a0dd3ca9` (tree `e2191d3553ba2d68326174e816041b0e9d691a29`). Hosted source commit: `e9325cb7790d9d8a8fa267a0694511d27b75c926`.

Sites project ID: `appgprj_6ae3270ad3608191af6024b57d2c2939`.
Deployment ID: `appgdep_6ae32772d6588191b5e59c02c1f03f1d`.
Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_42e7ed8be43c8191b97e61328b42e965`.

The hosting copy has `.openai/hosting.json` with that exact project ID and `static.directory=dist`. Keep its audience owner-private and reuse this project for updates. The full source is in the Sites source repository returned by its credential tool. Local checkout: `/workspace/sites/perfect-season-preview`. Source differences from GitHub: preview namespace bootstrap in index.html, preview title/PWA name/start URL, hosting metadata and PREVIEW.md. The original GitHub Pages workflow is omitted in this separate hosting-only copy. Never copy the preview bootstrap/hosting identity into the original Pages build.

No credentials are stored in this document. Native Sites deployment returned `succeeded` on 2026-10-29. TypeScript/production build passed; localhost production-build boot at 390px passed with no page errors, wrong/missing namespace override and preview PWA manifest checked. Device-specific iPhone installation remains unverified. Full gameplay/content tests for the underlying feature build are recorded in CODEX-UPDATE-LOG.md.


## Follow-up client update (Codex)

The preview is updated in place from the feature branch with automatic encrypted server saves and the all-tier ratings corrections. Its original origin, `preview2026` namespace, profile keys and installed app ID remain; existing preview progress is preserved. The old file-backup UI is replaced by Cloud Save. New saved-version/source/deployment references are listed below; the original deployment references above remain historical evidence.


### Previous deployed follow-up (2026-10-29)

- GitHub content: `967599c4f5f2be556a3de1d80d29cba53c1244f6` (tree `df86d3708469f7847d1268068c8905e3a2978506`), with 493 passing tests and a passing GitHub Review build.
- Sites source: `5deb0d2e04a2375eb74ad50c0421748c8c2ac22e`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_8580ca16b3cc8191a72ebeba1f1f251c`.
- Deployment: `appgdep_6ae3373a88d88191928a2266010ad020`, **succeeded**, 2026-10-29.
- URL stays https://perfect-season-private-preview.qem.chatgpt.site . Its current private audience, origin and installed app ID remain unchanged.
- New server-save function: `player-save` version 2 in the existing approved Supabase project, isolated by `preview2026` alongside card counts. It uses the existing Nostr player identity; no downloaded backup file or new username/password system is required. Identity recovery limits are explicit in AUTOMATIC-SAVES.md.

Main/Pages still serves the original release. The first deployment references above are retained as history; this section records the previous private test copy; the next entry identifies the current deployment.


## Previous gameplay/research preview — Codex, 2026-10-30

- GitHub feature source: `4769e4507b632c55aeb7f4e05937ce3db356fb2e`, exact tree `769a8730d43addab9d8667665cb7052967d0262c`. Local implementation commit `0c6543f32ed8a935a4cb62c38244611978613f02` has that same tree.
- Sites source: `b888d32ca308732555f529dea6e0295c6e5731e3`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_a9425ecd555881918843d3dac97ddae1`.
- Deployment: `appgdep_6ae45a5c0d1c8191a68be82610af09cd`, **succeeded**, 2026-10-30.
- URL: https://perfect-season-private-preview.qem.chatgpt.site . Same owner-private audience, origin, `preview2026` namespace and `./preview` installed-app ID. Existing preview saves remain in place.
- Changes: same-era card benchmarks, shared defensive/motion/shooting/passing revision and equal Legend defense online. Sources, coverage, limitations and file connections: [GAMEPLAY-RESEARCH.md](GAMEPLAY-RESEARCH.md). Screenshots: [previews/README.md](previews/README.md).
- Local production build passed; packaged output explicitly checked for namespace bootstrap, installed app identity and omission of the original Pages deployment workflow. GitHub [Review build #8](https://github.com/QemmHD/perfect-season/actions/runs/41029135522) passed: NBA 275 / NFL 242 passing tests, whole-pool audit, TypeScript and build.

Main/GitHub Pages and the original restore branch still point to `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. New source restore point before the gameplay revision: `backup/pre-gameplay-research-2026-10-30` → `f3ccd941475bc209c750557df0ef4850385bce49`. No new backend deployment or account migration was required. Both online clients must use the same revised preview/rules.


## Previous 90+ circulation preview — Codex, 2026-10-30

- GitHub implementation: `47f498592a01535e8684a735bedef988ed0cc006`, tree `4eb2c4c63b757090bdbe42ec9e8377cf824d69d8`; local implementation `f6159c34fe51bcec0fe65fdc8610e21d69fa495b` has the same tree.
- Sites source: `612ebbd3ef53201082728584caee2f6d24f21f73`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_69fa63fa507c8191bb42a459b6e45974`.
- Deployment: `appgdep_6ae46abe5d888191adc4258f5d0c4d0a`, **succeeded**, 2026-10-30.
- Same URL: https://perfect-season-private-preview.qem.chatgpt.site . Owner-private audience, existing origin, `preview2026` namespace and `./preview` installed-app identity remain.
- Card feature: [CARD-CIRCULATION.md](CARD-CIRCULATION.md). Number all 90+ holdings including upgrades; old unnumbered copies register in first-connection order; left issue number stays fixed while the active total rises/falls. Existing rare serials stay fixed. Offline sales/SBC removals retry idempotently.
- [Review build #10](https://github.com/QemmHD/perfect-season/actions/runs/41037238347) passed for the exact GitHub implementation: full tests, whole-pool ratings audit, TypeScript and production build. Private source install/build and namespace/PWA/Pages isolation checks passed.
- Existing registry now runs Edge Function v3 with additive copy/circulation migrations; `player-save` v2 and original Nostr features stay connected. Test traffic remains in separate namespaces.

No merge or GitHub Pages deployment. Main/original restore remains `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-circulation source backup is `backup/pre-card-circulation-2026-10-30` at `e7a4ac7a5426b89b66d7f36037a5ab5af56ef7f8`. This release-record follow-up is documentation only; the deployed implementation is the exact code identified above.


## Current pack cinema preview — Codex, 2026-10-30

- GitHub implementation: `8e1611fde2f58905278ac0bcf16536d7500030f1`, exact tree `f1a8893c6225d17c7a0f2df0f7a4256f2dde19c4`; local implementation `85d9aadeeee5a6274b3d7338f59de8a3bca735a4` has the same tree.
- Sites source: `c60c61367f0c51cd4d46b34086d7c99e1757a55a`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_cc1a2bc71a4c8191a5c0fa0c66e8c6f0`.
- Deployment: `appgdep_6ae471a49ba08191b11e0cee10192aa8`, **succeeded**, 2026-10-30.
- URL remains https://perfect-season-private-preview.qem.chatgpt.site . Confirmed owner-private access (one allowed owner, no groups), same origin, namespace and installed app identity. Existing preview progress remains in place. No fixture profile, boosted odds or forced GOAT demo is included in the shipped client.
- Changes: arena arrival, charge/foil tear, mystery clues, GOAT-only 99 limit break, procedural effects, card entrance and cancellable synthesized score. Existing pack outcomes, transactions, progress and backend functions are unchanged. [PACK-CINEMA.md](PACK-CINEMA.md) maps every connection; [previews/README.md](previews/README.md) records actual rendered fixtures.
- Exact pushed source built and packaged successfully. Production-build boot, forced namespace override, bootstrap-before-modules order, preview manifest identity, clean source and absence of the Pages deployment workflow all passed without page errors. Seven touch-browser reveal cases and both-sport real pack/reload/content flows passed; physical installed-iPhone checks remain unverified. Final GitHub CI reference is in CODEX-UPDATE-LOG.md.

Restore point before this presentation revision: `backup/pre-pack-cinema-2026-10-30` → `e9a35dbd1e10d29c524579112608d847747c1dcd`. Main and the original restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. This release-record follow-up changes documentation only; the deployment above contains the verified implementation.
