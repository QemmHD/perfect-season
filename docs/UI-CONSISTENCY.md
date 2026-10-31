# UI consistency and flow polish — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** at the owner's request to make all new UI match the existing game and flow cleanly. Reference: Perfect Season's existing Archivo family, condensed heavy italic headings, dark arena panels, teal actions, gold rewards, pill filters, card foil/pixel art and beveled court/field controls. Source restore: `backup/pre-ui-consistency-2026-10-30` at `86d64586271da62ea0fa9934d2c3bd5060307ecb`.

This is a polish/interaction revision. Player ratings, gameplay physics, odds/economy, reward conditions, backend links, account identity, card IDs/owned UIDs, serial ledger, XP/levels, squads and server-save schema are unchanged. Draft/UT queues remain NBA 8 / NFL 9; no reset, migration or live Pages promotion.

## Findings and resulting fixes

| Priority / evidence | Before | Result |
| --- | --- | --- |
| Header collision — [current-run baseline](previews/ui-before-circuit.png) | Champions Circuit overlaps the wallet; an absolute title reserves no real space. | A three-column header reserves back/title/wallet widths. Long titles use the same gold italic treatment at 19px. Normal 10,000-coin titles fit at three sizes; nine-digit wallet stress cannot overlap (the title may ellipsize). |
| Navigation orientation — Play HQ, Season, Objectives, Circuit and Moments captures | All bottom tabs appear inactive on new subpages. | Progression/management children use Home; Collection uses Club. The subsequent [Play-tab update](PLAY-TAB-AND-FOOTBALL-HINT.md) groups all competition children under Play and returns their back action to Play. Existing Squad/Store/SBC selection remains. |
| New label/action legibility — [baseline lineups](previews/ui-before-lineups.png) | Several rewards/actions are 6–8px while established UT controls are larger. | New clubhouse utility labels are generally 10px, actions 10–12px, descriptive copy 11–12px; heading sizes/Archivo style remain. Decorative hero watermark remains small/quiet. Hero text wraps clear of the card fan. |
| 100+ card stats | A fixed 34px number column lets a three-digit attribute crowd its label. | Attribute cells allocate actual number width, preserving card values, bars and the existing visual language. DOM checks explicitly test 100+ values. |
| Saved Lineups return flow | No visible Close action; small name text and tiny action labels. | Original-style full-width Close, 16px name input, readable save/load pills and existing 44px minimum action height. Save/load still reference the exact owned copies. |
| Sheet keyboard flow | Focus can leave a modal; Escape/return focus are inconsistent. | Shared sheets focus their dialog without opening the phone keyboard, keep Tab inside the top sheet, handle Escape and restore focus. Nested quick-sell confirmation cancels back to the card detail. Programmatic dialog focus does not draw a white border around the entire screen; buttons keep their existing gold focus ring. |
| Court/field panels | New coach/passing/playbook controls use separate near-green/gray panel values. | Shared dark arena HUD surface/border/elevation tokens, the existing Archivo/teal/gold palette, legible 11px call/trajectory labels and 44px new touch actions. Round joystick/burst/skill art and control mechanics stay intact. |
| Collection/storage interactions | New tabs and disabled rewards do not consistently use the original selected/disabled treatment. | Teal selected pills, readable actions, muted disabled states and reduced-motion-safe feedback. No claim/sell/transaction rule changes. |

## File connections and future style reference

- `src/styles.css`: original theme plus shared `--hud-surface`, `--hud-line`, `--hud-elevation`; space-reserving UT header, flexible 100+ stat columns and quiet programmatic scrim focus. Reuse these tokens rather than adding unrelated panel palettes.
- `src/ut/clubhouse.css`: typography, spacing, responsive action sizing and press/disabled/reduced-motion states for Home/Play HQ/Season/Objectives/Circuit/Moments/Development/Records/Lineups. Decorative art is unchanged.
- `src/ut/UltimateTeam.tsx`: child-view parent tab indication only; routes and transaction handlers retain their prior behavior.
- `src/ut/Clubhouse.tsx`: Saved Lineups gets a normal Close button; its save/load callbacks are unchanged.
- `src/ui/common.tsx`: shared Sheet keyboard/focus lifecycle, retaining existing layout/close animation/callbacks. No auto-focus of a name/search input on opening.
- `src/ut/content.css`, `storage.css`: original UT pills and disabled/action sizing for gallery, reward and duplicate-storage surfaces.
- `src/game/hoops2/coach-controls.css`, `src/game/football2/rushing-controls.css`, `playbook.css`: shared HUD materials and readable call/trajectory controls. No engine edits or change to direct joystick input.
- `scripts/qa/ui-consistency.mjs`: actual UI flows plus measured header/stat separation, tab families, 100+ stats, wallet stress, sheet focus/escape/nesting and original-copy preservation. `ui-extras.mjs` covers companion Rivals/Training navigation; other existing flow scripts remain in use.

Use the original game as the reference: Archivo for body/display, heavy italic display headings, teal for primary actions, gold for rewards, existing rounded panels/pills, and the existing circular beveled game controls. Keep playfield centers clear. Preserve meaningful state differences and visible focus; strong motion belongs to rewards/state changes, with reduced-motion alternatives. Card/player art and pack cinema do not need a replacement style to match the menus.

## Current-run flow review

All evidence was captured from actual current components in isolated localhost profiles, with existing rated fixture cards. These are screenshots of the game, not generated mockups. Each numbered UT step is checked for both sports in the [layout report](ui-layout-audit.json).

1. **UT Home — passed:** original card fan/Archivo/theme, clearer season/action labels, stable wallet.
2. **Play HQ — passed:** consistent mode cards, dedicated Play tab remains selected after the [Play-tab update](PLAY-TAB-AND-FOOTBALL-HINT.md), header separated from wallet.
3. **Season Rewards — passed:** readable tier/reward actions, original claims and archived rewards retained.
4. **Objectives — passed:** consistent filters and claims, 44px action sizing, rewards still settle once.
5. **Development — passed:** original card art, clearer paths/copy status, exact-copy squad/storage recovery retained.
6. **Moments — passed:** matching cards/briefing and both real game engines; playbook/fixed HUD remain readable.
7. **Club Records — passed:** same panel/type hierarchy and Home-family navigation.
8. **Spotlight Events — passed:** retained art/palette, separated header and correct win/loss settlement.
9. **Collection — passed:** Club tab stays active, matching filters/reward sheet and preserved discovery claims.
10. **Circuit at 320×568 — passed:** full normal-wallet title and no header collision/page overflow.
11. **Circuit at 390×844 — passed:** consistent header and layout.
12. **Circuit at 844×390 — passed:** frame layout and header remain bounded.
13. **Large-wallet stress at each size — passed:** no title/back/wallet overlap; truncation is allowed under extreme width pressure.
14. **Saved Lineups sheet — passed:** save, readable input, visible Close, Tab containment, Escape and return focus; original owned copies and squad survive.
15. **Card detail / nested sell confirmation — passed:** 100+ stat labels remain separate; Escape cancels the confirmation and returns to the card without selling.

Companion Rivals/Training surfaces were also inspected/reached in both sports and retain their existing style; local-relay board availability is separate from their static UI. Inspect-server save/restore/conflict checks pass in both sports, including identity/wallet/HQ data. Pack reservation/retry/recovery, registered cards, collection rewards and both event outcomes remain tested; the content QA now checks settlement against the displayed win or loss instead of assuming every stochastic fixture match wins.

## Validation and limits

**653 tests** pass (343 NBA / 310 NFL; 31/63 existing skips), with TypeScript/production build. Current browser checks pass both-sport layout/modal, complete clubhouse, content/registered-pack, polish/archive, actual court/field control and inspect-server restoration flows, with zero page errors and preservation of 56 NBA / 69 NFL original fixture copies. Companion screens pass too. No CSS behavior was substituted for successful transactions or saves.

[Selected before/after screenshots](previews/README.md#ui-consistency-and-flow-polish--codex-2026-10-30) include normal and small-phone headers, lineups, card stats, live passing and the playbook. The control captures use the existing lab's documented 0.5× mode; UI navigation is normal speed. A GOAT-detail fixture can show a pending numbering badge while the stat layout is already ready; the separate registered-card capture has a confirmed live serial.

Screenshots and keyboard/browser checks do not establish full WCAG conformance, physical installed-iPhone latency/VoiceOver behavior or live-player board availability. The existing bundle-size warning remains. Exact verified publication provenance follows below.


## Verified UI polish publication — Codex

- GitHub implementation: `d11d0ad43979caadea3805a4a9901624e134eddb`; local `3b3dbd16b6b50a2b2e968c02ae380b5797e9a655`; identical tree `2625b65a1b4477c830296dc0f2d42020d7176b1c` checked before moving the feature ref.
- [Review build #25](https://github.com/QemmHD/perfect-season/actions/runs/41141703266), job `124357289800`, **passed**: 343 NBA / 310 NFL tests (**653 total**), all-card rating audit with zero invalid entries, TypeScript and production build.
- Pushed private source: `78f58146d3e0d7021118b41d7b23413a5c0fe958`. Exact source build, clean Git, namespace bootstrap ordering, forced `preview2026`, retained preview PWA identity and zero-error production boot passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_e341e61ba69c8191a27f10e39894a910`.
- Deployment: `appgdep_6ae521f1c618819181520822c14f870a`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . The same owner-private audience, origin, `preview2026` namespace and `./preview` PWA ID remain.
- Main/original restore were rechecked at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-polish source restore is `backup/pre-ui-consistency-2026-10-30` at `86d64586271da62ea0fa9934d2c3bd5060307ecb`.

This release-record follow-up changes documentation only; the deployed UI/runtime is the verified implementation above. No live Pages promotion, account reset, save migration, backend deployment, rating/odds/physics changes or transfer of live accounts into preview. Queues stay NBA 8 / NFL 9. Physical installed-iPhone/VoiceOver testing and the existing bundle-size warning remain documented limits.
