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
