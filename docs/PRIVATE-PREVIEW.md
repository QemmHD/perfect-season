# Private preview — implemented by Codex, 2026-10-29

Latest update: the **Codex researched fixes and polish** are deployed privately; see the final section for the exact source/version/deployment and [UT-POLISH.md](UT-POLISH.md) for the latest complete handoff. Main/Pages remains unchanged.

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


## Previous pack cinema preview — Codex, 2026-10-30

- GitHub implementation: `8e1611fde2f58905278ac0bcf16536d7500030f1`, exact tree `f1a8893c6225d17c7a0f2df0f7a4256f2dde19c4`; local implementation `85d9aadeeee5a6274b3d7338f59de8a3bca735a4` has the same tree.
- Sites source: `c60c61367f0c51cd4d46b34086d7c99e1757a55a`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_cc1a2bc71a4c8191a5c0fa0c66e8c6f0`.
- Deployment: `appgdep_6ae471a49ba08191b11e0cee10192aa8`, **succeeded**, 2026-10-30.
- URL remains https://perfect-season-private-preview.qem.chatgpt.site . Confirmed owner-private access (one allowed owner, no groups), same origin, namespace and installed app identity. Existing preview progress remains in place. No fixture profile, boosted odds or forced GOAT demo is included in the shipped client.
- Changes: arena arrival, charge/foil tear, mystery clues, GOAT-only 99 limit break, procedural effects, card entrance and cancellable synthesized score. Existing pack outcomes, transactions, progress and backend functions are unchanged. [PACK-CINEMA.md](PACK-CINEMA.md) maps every connection; [previews/README.md](previews/README.md) records actual rendered fixtures.
- Exact pushed source built and packaged successfully. Production-build boot, forced namespace override, bootstrap-before-modules order, preview manifest identity, clean source and absence of the Pages deployment workflow all passed without page errors. Seven touch-browser reveal cases and both-sport real pack/reload/content flows passed; physical installed-iPhone checks remain unverified. Final GitHub CI reference is in CODEX-UPDATE-LOG.md.

Restore point before this presentation revision: `backup/pre-pack-cinema-2026-10-30` → `e9a35dbd1e10d29c524579112608d847747c1dcd`. Main and the original restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. This release-record follow-up changes documentation only; the deployment above contains the verified implementation.


## Current NFL rushing preview — Codex, 2026-10-30

- GitHub implementation: `152ec94e7d7d7e339c83facd8a8e2785449005e2`, exact tree `d5e7a7d3c9b805804afe0cf549bc6ddffdff2abd`; local implementation `fb9a527bc66b807aa12cc340a2e96edc2d669d8f` has the same tree.
- Sites source: `91dca4a555c365031685e02676f2697dff16341d`. All 292 tracked application source files were checked identical to the verified GitHub tree.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_f37dad903af4819184e4fb722394e032`.
- Deployment: `appgdep_6ae477ee618c819180c36745f2465f35`, **succeeded**, 2026-10-30.
- Same URL: https://perfect-season-private-preview.qem.chatgpt.site . Confirmed owner-private (one owner, no groups); existing origin, preview namespace, installed app identity and saved progress remain.
- Changes: neutral/forward input follows the blocking lane, deliberate flick threshold, real outside edge path, assigned front blocks, rated TE seals and existing-style Juke/Spin/Power buttons. NFL queues use rules 5; NBA remains 4. Both phones must use the same updated NFL preview. No card rating, pack odds, progress schema or backend function changed. [NFL-RUSHING.md](NFL-RUSHING.md) and the Codex update log record methods, measurements and verification limits.
- Exact pushed source built and packaged successfully. Production boot, forced namespace override, bootstrap ordering, preview PWA identity, clean source and exclusion of the Pages deployment workflow passed. Full tests, phone-size pointer/animation/layout checks, preservation of 69 original fixture copies and signed online settlements passed; physical installed-iPhone feel remains a device check. Final GitHub CI reference is in CODEX-UPDATE-LOG.md.

Pre-fix source restore: `backup/pre-nfl-rushing-2026-10-30` → `7f1cfbd0b85fe9c2f100f31d60294a3eb3ca7ae5`. Main/original restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. This release-record follow-up changes documentation only; the deployment above contains the verified application.


The rushing deployment's independent check is [Review build #15](https://github.com/QemmHD/perfect-season/actions/runs/41044676433), job `124025749338`, **passed**: 288 NBA / 255 NFL tests, whole-pool audit, TypeScript and production build. CI ran on `a143e12151852d6dca11b93f3b1ce79d29dd620e`, which adds a deterministic tamper-test fixture correction and this deployment record to runtime implementation `152ec94e7d7d7e339c83facd8a8e2785449005e2`; runtime code is identical to the deployed application. Details of the earlier test-only CI failure are retained in CODEX-UPDATE-LOG.md.


## Ultimate Team clubhouse overhaul — Codex, 2026-10-30

- Original GitHub implementation: `cc5179fd00fa4a3d494d08a2e368e18cf7097a0a` on `feature/season-evolution`; local source `3e874eab4b3dc99bceb832408109d5411cf06f8d`, identical tree `2bcc7c817592d32f88631f7efd920eadf65200e9`.
- Pushed Sites source: `ff7b468ef2ff36c0acfbbdf7d37c7db635b885f5`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_15cfefa597fc81918446d581d90af8f5`.
- Deployment: `appgdep_6ae4e14ec8a48191817acac2811e30bf`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site .
- The same owner-private access policy, origin, `preview2026` namespace and `./preview` PWA identity are retained. The namespace bootstrap precedes the bundled module in the built HTML. Preview branding/namespace patches remain only in the hosting copy; the Pages deploy workflow is excluded there.
- Production build, boot/manifest/namespace smoke and clean pushed source passed. [Review build #17](https://github.com/QemmHD/perfect-season/actions/runs/41106465021), job `124237473199`, independently passed 575 tests, whole-pool audit and build. Both-sport new-flow, server HQ restore/conflict, existing content, real-engine input/progress and two-client H2H QA passed without page errors. Phone-size Chromium captures are in `docs/previews`; physical installed-iPhone feel remains a device playtest.

[UT-OVERHAUL.md](UT-OVERHAUL.md) documents the complete module map, free-season/goal/Circuit/Moment rewards, exact-copy development, saved lineups, card story, real NBA/NFL calls and rule-6 compatibility. Pre-overhaul source restore: `backup/pre-ut-overhaul-2026-10-30` → `8e7773bc329cf9cdf10431bb95ec72a022a15603`. Main/original restore remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. This final record follow-up affects documentation only; it does not require re-deploying the already verified runtime.


## Researched fixes and polish — Codex, 2026-10-30

- GitHub implementation: `f2ad6df57b45e22f1e4aa19952061f11e8d41ab4`; local `e0ad4bb44997aed953eb901efc608e341a37cbe5`, identical tree `6633946c382d8dc5e29e0c9d6a9abdf899abbd0f`.
- Pushed Sites source: `8ed7d0391455d599380d525c0adc0d32eaa2f8a4`.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_546a72c062a88191b3b0ea2ee1fe6c4d`.
- Deployment: `appgdep_6ae4eca9ef088191af6f95cff1fe12ed`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site .
- Exact source production build, namespace bootstrap ordering, forced `preview2026`, manifest/installed PWA identity and zero-error boot passed. Owner-private access and the same origin are retained; existing preview progress remains on its original keys/server identity.
- [Review build #19](https://github.com/QemmHD/perfect-season/actions/runs/41113183845), job `124260552711`, independently passed **589 tests**, ratings audit, TypeScript and build. Both-sport browser interruption, modality, reward/exact-copy, full clubhouse, registered-pack/content, server restore/conflict and signed H2H checks passed; seven pack-cinema viewport/motion cases passed. Physical iPhone/two-phone testing remains separate.

Read [UT-POLISH.md](UT-POLISH.md) for research, prioritized findings, exact fixes and preservation guarantees. Mechanics queues are NBA 7 / NFL 6; leaderboard/data history and identities remain. Pre-polish source restore: `backup/pre-ut-polish-2026-10-30` at `f5f4e5138e7bf3bf60cd67f61c6795dbf24bb4d1`. Main/original restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. The release-record follow-up changes documentation only; the deployed runtime above is already verified.


### Verified core gameplay publication — Codex

- GitHub runtime implementation: `37c640fb116dfe25dc94667a9cf76751d6c72508`; local source `a4ece2c741c700437fdd9bd99b06f6c104fee405`, identical tree `7c31dc1ce2687dc9798b7f7544e1e8906ae1374e` (remote equality verified).
- [Review build #21](https://github.com/QemmHD/perfect-season/actions/runs/41118840959), job `124280015967`, **passed**: independently confirmed 322 NBA / 289 NFL tests, all-edition rating audit with no invalid entries, TypeScript and production build.
- Pushed preview source: `4a8ff15f63840a10dbd88ee3ba0c7d377721a1cf`. Exact source built and passed zero-error production boot, forced namespace, bootstrap-before-module and preview PWA identity checks; source Git is clean.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_d5c3e014595c8191b02e872f60230617`.
- Deployment: `appgdep_6ae4f634498881918b569ba9e0ebc451`, **succeeded**, https://perfect-season-private-preview.qem.chatgpt.site . The same owner-private audience, origin, `preview2026` namespace and `./preview` PWA identity are preserved.
- Main and original restore were rechecked at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; the pre-core restore is `backup/pre-core-gameplay-2026-10-30` at `0bfe5a54bbf9f87c5865325fd8bd605f20140177`.

This release-record follow-up changes documentation only; deployed runtime is the verified implementation above. No live Pages merge/deploy, account reset, backend migration or transfer of live accounts into preview. The known physical-iPhone testing limit and existing bundle-size warning remain as documented.


## Verified direct-control publication — Codex

- GitHub runtime: `1cbf5dfd0b2d4b290e09e5941006f0604690c611`; local runtime `67b56bab53446bb158a2fe0c762952456ff7a363`; identical tree `7b37c39e6191e0316af865660d5feced52aeea45` was checked before updating the feature ref.
- [Review build #23](https://github.com/QemmHD/perfect-season/actions/runs/41125107355), job `124301297402`, **passed**: 343 NBA / 310 NFL tests (**653 total**, 31/63 existing skips), all-card rating audit with zero invalid entries, TypeScript and production build. The final rear-end-zone boundary is included.
- Pushed private source: `b76a1d5c83df133c048e607cf4e089e62bafea48`. Exact source build, clean Git, zero-error production boot, forced namespace/bootstrap ordering and retained preview PWA ID passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_2e7b381b4904819194847d589359f452`.
- Deployment: `appgdep_6ae5015e9cf4819194108372d7ded62d`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Owner-private audience, origin, `preview2026` namespace and `./preview` PWA identity are retained.
- Main/original restore were rechecked unchanged at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Source restore before this correction is `backup/pre-nfl-direct-stick-2026-10-30` at `aad7e9b4b747527945a481ad03857a8539bc6f05`.

No account reset, inventory/progress migration, backend deployment or promotion to live Pages. This provenance follow-up changes documentation only; the deployed runtime is the verified implementation above. Physical installed-iPhone feel remains an owner playtest; existing large bundle warnings remain.
