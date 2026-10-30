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


## Current gameplay/research preview — Codex, 2026-10-30

- GitHub feature source: `4769e4507b632c55aeb7f4e05937ce3db356fb2e`, exact tree `769a8730d43addab9d8667665cb7052967d0262c`. Local implementation commit `0c6543f32ed8a935a4cb62c38244611978613f02` has that same tree.
- Sites source: `b888d32ca308732555f529dea6e0295c6e5731e3`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_a9425ecd555881918843d3dac97ddae1`.
- Deployment: `appgdep_6ae45a5c0d1c8191a68be82610af09cd`, **succeeded**, 2026-10-30.
- URL: https://perfect-season-private-preview.qem.chatgpt.site . Same owner-private audience, origin, `preview2026` namespace and `./preview` installed-app ID. Existing preview saves remain in place.
- Changes: same-era card benchmarks, shared defensive/motion/shooting/passing revision and equal Legend defense online. Sources, coverage, limitations and file connections: [GAMEPLAY-RESEARCH.md](GAMEPLAY-RESEARCH.md). Screenshots: [previews/README.md](previews/README.md).
- Local production build passed; packaged output explicitly checked for namespace bootstrap, installed app identity and omission of the original Pages deployment workflow. GitHub [Review build #8](https://github.com/QemmHD/perfect-season/actions/runs/41029135522) passed: NBA 275 / NFL 242 passing tests, whole-pool audit, TypeScript and build.

Main/GitHub Pages and the original restore branch still point to `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. New source restore point before the gameplay revision: `backup/pre-gameplay-research-2026-10-30` → `f3ccd941475bc209c750557df0ef4850385bce49`. No new backend deployment or account migration was required. Both online clients must use the same revised preview/rules.
