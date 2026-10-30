# Browser QA for Codex additions

**Implemented by Codex, 2026-10-28–2026-10-29.** These scripts create new, isolated localhost browser contexts. They never open the user's browser profile. Fixture coins/cards exist only in those test contexts; preview copy numbers are not real pulls.

## Setup

Run `npm run dev -- --host 0.0.0.0`. Install optional QA tools outside the app's dependency tree:

```sh
npm install --prefix /tmp/ps-qa-tools playwright@1.64.1 ws@8.18.3
```

Use `/usr/bin/chromium` when available, otherwise install the Playwright Chromium browser. Set `PS_QA_PACKAGE_JSON` to that scratch package's `package.json`. In a managed environment requiring an HTTP proxy, set `PS_QA_PROXY` to the configured proxy URL; preserve environment network policy. `PS_QA_ARTIFACTS` optionally selects a screenshot directory; default `/tmp/perfect-season-qa`.

```sh
PS_QA_PACKAGE_JSON=/tmp/ps-qa-tools/package.json node scripts/qa/content.mjs
PS_QA_PACKAGE_JSON=/tmp/ps-qa-tools/package.json node scripts/qa/online.mjs
PS_QA_PACKAGE_JSON=/tmp/ps-qa-tools/package.json node scripts/qa/reveal.mjs
```

The scripts refuse non-localhost app URLs. `browser.mjs` creates fresh fixture profiles, retains original fixture IDs/levels/XP for comparisons, and uses `?ns=inspect&relay=ws://localhost:7777`.

## What is exercised

- **Content:** both sports; collection milestone claim; failed registered-pack request; unchanged coins/cards while pending; reload recovery; exactly one coin charge; original copy preservation; real signed Spotlight reward; live registered-count refresh; event match through the existing Sim vote; stage reward/progress.
- **Online:** two independent browser clients per sport, using a signature-verifying local Nostr relay started by the script. The revised pools contain GOAT cards. Tests matchmaking, squad exchange, both clients voting Sim, one H2H win/one loss and Rivals progress. It does not claim a physical two-iPhone network test.
- **Reveal:** normal-motion GOAT and Spotlight at 390×844 with simulated top/bottom safe areas; reduced motion at 320×568; actual game stage/font/skin inheritance; position/team/card sequence; serial stamp and continue-control bounds; early-skip stability. Preview `#8 / 20` is explicitly a visual fixture, not a real registered claim.

Content tests contact the real new registry only in the **inspect** namespace. Live global pull totals use the empty namespace and remain separate. Additional direct backend checks verify invalid-signature rejection, eight parallel requests for one reward producing one receipt/mint, and SQL atomicity/access controls. [`supabase/tests/registry.sql`](../supabase/tests/registry.sql) rolls all of its test writes back.

## Device checks

Chromium verifies layout, input and state transitions. Before claiming device-specific behavior, check on installed iPhones: safe areas, Safari share-to-Files backup/restore, audio permissions, background/reload, orientation, and a two-phone match/rematch. The scripts' proxy certificate exception is a QA-environment setting, not a production security setting.


## Automatic server saves (Codex follow-up)

`node scripts/qa/cloud.mjs` tests both sports using real UI and isolated identities: successful server save, exact owned-copy/XP/squad/wallet restoration for the same identity, an offline divergent device, paused conflict, and server choice only after preserving the device copy. It uses Settings → Cloud Save and does not rely on file inputs or UI-global test hooks. It waits for the actual reload before reading restored state. New identities are required because inspect saves persist on the real backend.

`NODE_USE_ENV_PROXY=1 node scripts/qa/cloud-backend.mjs` tests signed API idempotency, one winner/one 409 for concurrent saves, per-identity isolation and invalid-signature rejection in qacloud. `supabase/tests/cloud_saves.sql` tests database invariants with rollback. No user saves are loaded. See AUTOMATIC-SAVES.md for the identity/recovery boundary.


## Codex gameplay revision, 2026-10-30

`node scripts/qa/gameplay.mjs` mounts the actual NBA/NFL match components with rated isolated fixture squads at Legend defense. It sends manual pointer shooting/throwing input, checks populated canvas pixels, runs complete autoplay possessions/drives, checks finite progress and unchanged original owned copies, and captures release/aim/action screenshots. The same optional QA-tool path/proxy environment variables apply. `online.mjs` also verifies the revised rules/pool handshake and deterministic Sim settlement with two independent signed local-relay clients per sport. See GAMEPLAY-RESEARCH.md and CODEX-UPDATE-LOG.md for final results and device-test limits.
