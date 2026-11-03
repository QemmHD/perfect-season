# Admin Studio

Designed and implemented by **Codex (OpenAI), 2026-11-03**, on `feature/admin-studio`, based on current main `7db37b6ea7e1b39cf1eb350273fdabfad625a03c`. This extends Claude's current New Era/Soccer game; it does not replace the gameplay or rating work.

## Access and navigation

Settings → ADMIN uses the **original password, key derivation, public key, session and lock behavior**. The Control Room follows the game's Archivo type, teal/gold palette, pack art and sheet layout. Four clearly named sections (navigation polish by Codex, 2026-11-03):

- **Home:** pack/reward/club shortcuts and current wallet/inventory counts.
- **Store Packs:** edit three Club Collection templates, review all changes, then publish an owner-signed store update.
- **Send Gifts:** the original **ME / PICK / RANDOM / EVERYONE** modes, plus the expanded reward toolbox.
- **My Account:** all previous local controls, plus exact-copy card-level editing and special pack shortcuts.

Preserved local controls: add/set coins, account level/XP, boosters, all normal pending packs, paid-game reset, SBC replay, Squad Battles ladder restart, Daily replay, missions reset and daily reward reset. The original self/online/multiple/random/everyone gift abilities remain. A player search and a full hexadecimal public-key field additionally allow offline recipients. Random selection uses the existing unbiased shuffle.

## Added reward tools

All can be composed with coins and a note, and sent to the original recipient modes:

| Reward | Actual result |
| --- | --- |
| Icon Pack | One guaranteed canonical Legend/Icon edition. |
| GOAT Pack, NBA/NFL | Seven NBA or fifteen NFL common golds, then one guaranteed server-registered GOAT; this is an owner award, not a change to public shop odds. |
| Gold Squad Pack | A gold player for every weighted starting slot: NBA 5, NFL 23, Soccer 11, with distinct player IDs. |
| All-Time Squad Pack | Legends for positions with eligible Legends; a gold fallback covers positions without one. Not advertised as all Legends. |
| Specific player | Search the current canonical pool, inspect card art/season/position/OVR, choose an exact ordinary edition and give 1–50 copies. These arrive as Player Award packs. |
| Specific GOAT, NBA/NFL | Selecting a GOAT attaches its edition ID to the signed award; every GOAT pack in that award gives that edition with its own serial. |
| Account XP | Up to 100,000 per gift, using the existing account progression. |
| Squad training XP | Up to 700 for each **currently equipped** recipient card, using existing level caps and the existing XP routine. Unequipped cards are unchanged. |
| Boosters | Up to 50 of each existing booster per gift. |
| Expanded normal packs | Bronze, Silver, Gold, Premium, Elite Gold, Jumbo Premium, Standout Guarantee, Roster Builder, Captains and Dynasty. |
| Reward bundles | Welcome, All-Time, Train My Squad, Gold Team, plus NBA/NFL GOAT Bundle. Loading one fills the composer; it does not immediately send. |
| Saved presets | Up to 12 named bundles on this browser, scoped by sport and namespace. Voucher proofs/signing keys are never saved inside templates. |
| Gift history | Latest 50 local summaries with recipients and time. Network success means a relay accepted the event; it does **not** prove a player claimed it. |

The composer groups special, collection and classic packs in disclosures and provides a Clear Rewards action. Review the recipient selection and final reward summary before sending. Existing 10-million coin and 50-per-pack gift bounds remain.

### Local versus shared state

Self rewards use the same profile update/save path as before. Online rewards use the existing Nostr owner signature and player keys. Presets/history are browser-local conveniences, not a shared player database or a recipient inventory viewer. Remote profiles remain encrypted; this panel does not pretend to edit arbitrary remote saves or confirm gift claims.

Ordinary specific-player awards resolve exact `pool.base` canonical `season/promo/legend/standout/landmark` IDs. Unsupported live/holographic/evolved variants are not fabricated. GOATs cannot be minted by the ordinary exact-card opener; they require the signed registry flow. Spotlight awards are not added as an unverified bypass.

## Three configurable public store packs

New Store → **Club Collection**, with the game's existing art, purchase/opening flow, duplicate storage, Collection and Pack Tracker.

| Template | NBA coins | NFL coins | Soccer coins | Base contents |
| --- | ---: | ---: | ---: | --- |
| Roster Builder | 1,500 | 900 | 1,000 | 6 silver + 3 gold + 1 rare gold |
| Captains Pack | 2,400 | 1,000 | 2,300 | 3 gold + 2 rare gold + 1 weekly standout |
| Dynasty Pack | 4,400 | 1,900 | 4,300 | 5 gold + 4 rare gold + 2 weekly standouts |

NFL doubles the silver and regular-gold counts above. Defaults satisfy the existing 45–60% quick-sell-return price checks; owner edits can intentionally change that balance. These packs do not include GOAT/Spotlight rolls. Existing Spotlight **0.05% GOAT odds** and all existing pack recipes remain unchanged.

Pack Studio edits a name (1–32 characters), coin price (500–100,000), availability and guaranteed silver/gold/rare/standout counts (0–20 each, 1–40 total). It configures these three templates, not unlimited arbitrary new pack types. Review shows all three before publishing. Failed publication keeps the current store.

`studio:<template>:<silver,gold,rare,standout>:<encoded-name>` is a frozen pack recipe. Purchased/awarded pending packs retain their contents and name even after the owner changes or hides that template. No previously owned packs/cards are rewritten.

### Shared catalog trust

`catalog-net.ts` publishes replaceable Nostr kind 30078 events with `d=ps-admin-catalog<namespace-suffix>:<sport>`, version 1 JSON. Only the existing exact admin public key and a valid signature are accepted. Events must match sport/schema and bounded timestamps; a fresh wire object prevents reliance on cached signature-verification symbols. Latest events are selected by timestamp, then lexical event ID. Signed cached events remain usable offline. Publishing requires the real owner key and a relay acknowledgement.

## Gift compatibility and GOAT registry

Legacy four-pack gifts retain `ps1-gift<suffix>` / `ps1-gift-all<suffix>`. Rewards with new packs/XP/boosters/exact players use **`ps1-gift-studio<suffix>` / `ps1-gift-studio-all<suffix>`**. Old builds ignore an upgraded gift completely instead of consuming its coins and losing unsupported rewards. Gifts remain available from relays for the original two-week lookup period. GOAT/exact-player gifts defer in other sports until the player opens the matching sport.

A GOAT pending pack stores only a **public owner-signed event and award index**. The player signs the registry request with their original Nostr identity. `admin-packs.ts` verifies the fixed owner key, fresh-wire signature, recipient/all tag, namespace, sport, signed count, index and optional selected GOAT edition. Request IDs derive deterministically from event ID + award index, preventing a recipient from minting extra copies through retries. The existing database receipt key includes actor/sport/namespace, so each player in a shared award gets their own copy.

The additive `admin-goat` function route uses existing service-only `ps_registry_open` internally with its original `spotlight` layout, forcing tier GOAT only after entitlement validation. The response is labeled `admin-goat`. It retains the original atomic serial allocation, retirement/circulation counters, 30 packs/hour and 100/day limits. Copy UIDs end in `:7` NBA / `:15` NFL to match the existing server layout. Client reservation is persisted before contact, failures retain the pending pack, and the existing registered-opening guard commits a receipt once.

**Connection:** existing Supabase project `ryqaibujweiwwvdtswxj`, function `card-registry`; own NIP-98 authentication with existing `verify_jwt=false`. No database migration, keys, authentication policy, catalogs, card IDs, counts or existing receipts are reset. `catalog.json` and `numbered.json` are semantically identical to the deployed originals. Deployment/QA status is recorded below when completed. Existing Nostr matchmaking/leaderboards/gifts and encrypted server saves remain connected as before.

## File map for Claude

| File | Responsibility |
| --- | --- |
| `src/admin/AdminStudio.tsx`, `admin-studio.css` | Control Room home, pack editor/review, exact-owned-copy level editor, native styling. |
| `src/admin/AdminPlayerPicker.tsx`, `rewards.ts` | Canonical edition selection, built-in/local reward presets and local history. |
| `src/admin/catalog.ts`, `catalog-net.ts` | Bounded templates, frozen recipes, reactive updates and owner-signed shared catalog. |
| `src/ui/Admin.tsx`, `src/net/gifts.ts` | Existing unlock/abilities, reward composer/application and compatible Nostr envelopes. |
| `src/App.tsx` | Starts/stops the shared catalog subscription; existing gift collection uses the expanded `withGift`. |
| `src/ut/packs.ts`, `Store.tsx`, `PackArt.tsx` | New pack definitions, recipes, exact-card/team/Icon openers, store section and existing foil wrapper. |
| `src/ut/UltimateTeam.tsx`, `state.ts`, `registry.ts`, `promo.ts` | Frozen purchases, optional voucher persistence, reserved GOAT opening and validated atomic deposit/Pack Tracker. |
| `supabase/functions/card-registry/admin-packs.ts`, `index.ts` | Owner entitlement validation and additive registered GOAT route. |
| `src/admin/*.test.ts`, `supabase/functions/card-registry/handler.test.ts` | Real-pool content, save preservation, compatibility, signature/recipient/namespace/replay and mocked HTTP/RPC contracts. |
| `scripts/qa/admin-studio.mjs`, `admin-registry.mjs`, `browser.mjs` | Isolated Chromium profiles; three-sport admin/store/reward flow and shared-wallet fixture reads. |

## Progress and rollback

No player account reset, roster replacement, original UID/card-ID rename, serial renumbering, wallet migration or queue-protocol change. Optional voucher fields survive normal profile/cloud-save serialization. Existing card edits target one exact UID and preserve its mint, identity, squad membership and other copies. Booster/XP gifts add only their requested values. Reward receipt IDs keep claims idempotent.

Source restore branch **`backup/pre-admin-studio-2026-11-03`** points to current pre-update main `7db37b6`; it contains source only, not player save files. Main/GitHub Pages must remain untouched during review. Source rollback alone cannot teach old clients to open newly introduced pending pack kinds; preserve those entries and update clients rather than deleting player inventory. Never clear accounts to test or revert this feature.

## Validation and release record

In-progress release work: use the final appended record for completed checks and publication references. Synthetic test keys do not impersonate the owner. A real owner-valid GOAT award/public-catalog publication cannot be live-tested without the owner's key; no password is requested or committed. Cryptographic validation uses separate fixture owners, HTTP tests mock only the entitlement boundary/database, and production rejection/count smoke checks cover the deployed endpoint. Actual owner delivery remains a device acceptance check, not a claimed completed test.

### Backend activation and targeted checks — 2026-11-03

The existing `card-registry` function is now **ACTIVE version 4**, with `verify_jwt=false` and the same custom authentication, deployed with explicit `deno.json` import map. Server catalogs and numbered-edition data were retained from the deployed version 3 (identical JSON to current main). No schema migration or data writes were performed by this deployment.

Live read/rejection smoke passed: NBA and NFL count endpoints return HTTP 200 with total/active/revision maps; a player-signed forged GOAT award returns 403, and an invalid player signature returns 401. This smoke mints no cards and edits no accounts. Unit handler checks also preserve original Spotlight RPC behavior and chosen-edition/entitlement validation.

Targeted checks: NFL 62 passed (admin rewards/catalog, original gift tests, content economy, state and mocked registry HTTP); Soccer 89 passed (admin plus soccer/sport-branch suite); corrected HTTP handler 4 passed. Three-sport phone QA passes at 390px and narrow pack review at 320px, zero page errors: original recipient modes, offline recipient field, forged publication blocked, self gift, Welcome XP/booster bundle, Icon pending pack, exact-player gift, forged self-GOAT refusal, exact-copy level edit, three store packs, actual purchase and preservation of original card IDs/UIDs/other-copy XP. Build/typecheck pass. Full suite result and preview/PR references follow in the completed release record.

### Review and private preview

- GitHub review: https://github.com/QemmHD/perfect-season/pull/2 , initial implementation commit `4a6c569b9c26c484e4c06a87a5845214cdf7b20c`. Source restore branch remains at `7db37b6`. Main/GitHub Pages were not merged or deployed.
- Owner-private playable preview: https://perfect-season-private-preview.qem.chatgpt.site . Settings → ADMIN uses the same existing owner password; Home/Packs/Players/Club opens the new tools. Existing preview progress is retained. The preview is a different origin from GitHub Pages, with its existing `preview2026` backend namespace and separate PWA identity. It does not automatically import the live game's phone profile.
- Sites publication succeeded on 2026-11-03: source `6dc57f3b75ad84dca8ae369db60a229ba7451785`, version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_1a97244001608191b8d4ed69396c7935`, deployment `appgdep_6aea5d24ea3c8191bf5d19c6901b5ffb`. The archive was built from that exact pushed source; no production Pages workflow exists in the hosting copy. Access remains owner-only.
- Static production-preview smoke passed with zero page errors and forced namespace override, title/manifest verified. Main source production build, preview production build, typecheck and ratings audit pass. Existing large-data chunk-size notices remain build warnings.
- Additional real-pool GOAT deposit/receipt replay tests: NBA **9/9**, NFL **9/9**, including preserved wallet/original copies, matching minted UID/serial, consumed pending pack exactly once and mismatched receipt rejection.
- [Actual screenshots](previews/README.md#admin-studio--codex-openai-2026-11-03) are committed for Claude and review. The PR stays draft for owner review; no automatic merge is enabled.

### Completed full-suite verification

`npm test` completed successfully: NBA **537 passed / 46 skipped**, NFL **505 passed / 78 skipped**, Soccer **74 passed**. Skips are the existing sport-specific/manual/tuning cases. The additional GOAT deposit test was then verified separately with all **9 admin reward tests passing for each NBA/NFL**. Ratings audit, main/preview builds and typecheck passed. Final three-sport browser rerun also passes, including 320px XP/booster grid layout, with zero page errors. Specific-player recipients receive the same Store guidance as other pack awards. GitHub Actions review CI is a separate remote run; its current status is visible in PR #2.

Final private refresh succeeded on 2026-11-03: pushed source `ca5701f67bbc4e04844d95f8c809fedadeb63cda`, version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_30d563a251f481919dade4cdcb54692e`, deployment `appgdep_6aea5eb0e3a8819189ad8fb9c9efc549`. This includes the final mobile booster layout, specific-player Store guidance and GOAT replay tests. Final build and static boot/namespace smoke pass; only hosting identity and release-note bookkeeping differ from the GitHub review source.

## Navigation clarity follow-up — Codex (OpenAI), 2026-11-03

The admin navigation now reads **Home / Send Gifts / Store Packs / My Account**, in readable two-column buttons that stay available while scrolling. Home shortcuts state exactly what each section does. Store headings say “Store Packs”, “Edit Pack” and “Review Store Packs”. The close action reads “Close Admin”.

**Send Gifts** now follows **Recipients → Rewards → Review**. It starts with Myself, while Choose Players, Random Online and Everyone retain their original behavior. The offline public-key field is behind “Send to an offline player”. Rewards have four categories: **Packs / Player cards / Coins, XP & boosters / Reward bundles**. Selection is cumulative across categories. The review shows recipients and a readable item-by-item reward list, plus the optional note; only this screen can send. Successful sends show completion feedback and replace the send button with an explicit edit/send-another action.

Top-level sections stay mounted during the unlocked visit, preserving gift selection, recipient choices, pack-editor drafts and card-editor input when navigating. Closing/locking retains the original session behavior; this does not create a new cloud-save format or persist an unfinished gift to another browser session.

**My Account** groups the original abilities into Coins/level/boosters, Card levels, Give myself packs, and Replay/reset tools. The first group is open; the others expand on demand. No existing action, owner access, gift signature, backend endpoint, public pack odds, player progress or online queue changes. No Supabase deployment or database operation is required for this navigation update.

Validation: three-sport Chromium flows pass with zero page errors, including recipient gating, review-before-send, post-send guard, cross-tab draft retention, all recipient modes and reset tools, exact-copy edits and real store purchases. Responsive checks include 320px and 390px widths. Admin/gift tests: NBA 21 passed, NFL 16 passed; Soccer 15 passed / 1 skipped (the NBA/NFL-only GOAT case). Production build and typecheck pass. The private-preview release reference is recorded after publication. These targeted checks cover the UI-only change; the earlier full gameplay suite remains documented above.

Navigation preview publication succeeded: source `c99cff26d4957318c0dff2b87e59f7c4503db82d`, version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_9cb01154f2e48191b657b4b00ae1b369`, deployment `appgdep_6aea629dc6fc819182c0605f519bee8d`. Owner-private URL remains https://perfect-season-private-preview.qem.chatgpt.site . Both production builds and final static boot/namespace smoke pass. Main remains `7db37b6`; this follow-up stays in PR #2. No backend or player-data changes.
