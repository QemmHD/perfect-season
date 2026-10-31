# Ultimate Team research, fixes and polish — Codex, 2026-10-30

**Implemented by Codex (OpenAI).** This is the follow-up audit to `UT-OVERHAUL.md`. Work is on `feature/season-evolution`, with the existing owner-private preview as delivery target. Main/Pages is not promoted. Pre-polish source: `backup/pre-ut-polish-2026-10-30` at `f5f4e5138e7bf3bf60cd67f61c6795dbf24bb4d1`.

## Research and prioritized plan

Exa reviewed 15 search-result slots across three angles, then read four primary documents directly. Sources support the interaction requirements below; they are not a claim of commercial-game parity or copied EA/2K mechanics.

| Priority | Confirmed finding / reproduction | Planned correction and evidence |
| --- | --- | --- |
| High | NBA SHOOT does not explicitly capture its pointer; moving a mouse off the button before release can leave the meter held. Cancellation calls the normal release handler. | Track one shooting pointer, capture it, separate actual release from cancellation, and clear held input on interruption. Test real dragged releases and canceled shots. |
| High | Neither engine consistently clears held input on window blur, page hiding and rotation; a stale stick/drag can survive an interrupted interaction. | Clear transient stick/drag/swipe/tap state on interruption and lost capture. Do not reset the possession, profiles, paid limits or online timers. Browser checks reproduce canceled/interrupted input. |
| Medium | The NFL playbook marks itself modal but does not contain focus; Tab can reach SNAP behind the overlay. | Use a native modal dialog with Escape, focus containment, inert background and focus return. Test keyboard selection/close and phone/landscape layout. |
| Medium | Changing Circuit weeks drops the old week's best/entry summary; the global reward receipt prevents re-payment but the UI can show an earned prize as unearned. | Add optional per-week summaries and reconstruct old reward state from existing receipts. Preserve active runs and enforce existing three-entry limits. Test rollover, returning weeks and duplicate payouts through migration. |
| Medium | Development only receives club-visible cards; swap the active copy into duplicate storage and its card art/name disappears despite valid owned progress. | Look up the active copy in full inventory, identify whether the exact copy is equipped, and offer the existing explicit stored-copy swap. Never create a copy or transfer XP. |
| Polish | Season rewards require many individual claims, and a new-season ribbon can count older rewards without taking the player to them. | Add replay-safe Claim Ready for the selected track and a clear earlier-rewards action. Keep every old season's earned levels and claim receipts. |
| Polish | NFL completion Moments say MAKES; All-Star Moments are labeled Pro; persisted best scores are not shown on the cards. Progress bars lack names. | Use the actual objective units/difficulty, show saved bests/targets and add progress-bar names plus mobile-sized targets. |

## Primary sources

- [MDN: pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event): app switching, rotation and native gestures can cancel active pointer input. Cancellation must be distinguished from release.
- [MDN: visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event): mobile app switching/page hiding is an observable interruption point.
- [W3C APG: Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): contain focus, make background inert, support Escape and return focus to the invoking control.
- [EA: Ultimate Team Objectives](https://help.ea.com/en/articles/ea-sports-fc/ultimate-team-objectives/): communicate relevant objectives, requirements, completion and earned rewards. Perfect Season retains its own explicit saved-earned-reward policy.

## Verification and release

Status: implemented, independently verified and published to the existing owner-private preview. Main/Pages remains unchanged. Final module map, checks, screenshots, exact source/CI/private deployment references and observed limitations will be recorded here and in `CODEX-UPDATE-LOG.md` once verified. No account reset, card replacement, pack-odds change or backend migration is planned.


## Implemented source map and preservation

- `src/game/hoops2/Hoops2.tsx`, `engine.ts`, `render.ts`: one captured shooting pointer, correct dragged release, canceled uncommitted jumper without a fabricated result, keyboard shooting/passing, pointer-ID-aware stick and lost-capture cleanup. A committed finish/shot keeps playing. Cancellation does not rewind the shot clock, teleport the player or change ratings/odds.
- `src/game/useInputInterrupt.ts`: clear transient inputs on blur, hidden/pagehide and orientation changes. `Football2.tsx` also clears lost capture, stale double-taps and drag aim, and supports keyboard Run It. This is input cleanup, not an online pause or a clock reset.
- `src/game/football2/PlaybookDialog.tsx`, `playbook.css`, `Football2.tsx`: native modal/inert background, contained keyboard focus, Escape and explicit invoker focus return. Browser QA caught that native auto-return alone did not survive React unmount; layout-effect cleanup now restores the correct invoking button.
- `src/ut/PackOpening.tsx`, `UltimateTeam.tsx`: reveal focus containment, Escape skip/finish, initial/return focus, and inert underlying topbar/Store/tabs. The audit also found this older modal gap; keyboard users can no longer reach purchases behind the pack reveal. Pack outcomes/receipt transactions/odds and the animation timeline remain the original paths.
- `src/ut/progression.ts`, `Clubhouse.tsx`, `UltimateTeam.tsx`: Claim Ready for the selected season uses the original stable per-tier receipts in one profile update, with a correct pack-count receipt. An earlier-rewards action reveals archived earned tracks. The default current track follows real calendar rollover; explicitly selected older tracks remain accessible.
- `src/ut/circuit.ts`, `hq-state.ts`: optional `hq.circuitHistory` stores week summaries when moving to another week, including used entries, exact best and claimed milestones. Existing prize receipts reconcile the UI for older saves. Active previous-week runs remain active. Previously discarded history cannot be invented; receipt-only older weeks show their known earned milestones. No additional paid entry, free-entry reset or duplicate prize is introduced.
- `src/ut/Clubhouse.tsx`, `UltimateTeam.tsx`: full-inventory lookup for an enrolled development UID, exact-copy squad/storage status and the existing explicit `useStoredCopy` action to return that copy. Eligibility lists retain club-only organization. The other duplicate, both copies' XP/levels/mint serials and the program progress remain.
- `src/ut/moments.ts`, `Moments.tsx`, `clubhouse.css`: actual All-Star/Pro/Legend labels, Baskets/Completions/Field Goals/Green Releases/Yards, persisted bests and clearer targets; named progress bars and 44px reward/preset action targets.

`DATA_V`, leaderboard history, profile version/storage keys, Nostr identities, pack prices/odds, existing owned UIDs/edition IDs, card levels/XP, mint serials, account wallets and encrypted save endpoints are retained. No backend migration/deployment or manual backup-file workflow is needed. NBA draft/UT mechanics use rule **7** for canceled-jumper handling; NFL stays on **6**. Updated peers match each other; main/Pages is untouched.

## Reproduction and verification map

- `src/ut/polish.test.ts`: batch claims/selected-track isolation/reload, archived weekly best/entry/claim persistence, legacy receipt display, exact-copy development through duplicate swaps, and accurate Moment units/difficulty.
- `src/game/hoops2/gameplay.test.ts`: interrupted held shot, preserved physical height/clock/ratings and committed finish/shot protection.
- `scripts/qa/polish.mjs`: both actual UT UIs, six-tier batch claim/reload, pack-modal keyboard/background safety, development art/exact-copy return, labels, real NBA dragged-release/cancel/blur and NFL cancel/blur/hidden/rotation signals, native modal focus/Escape/selection, mirrored diagrams, manual throw result and original-copy/wallet checks. A real SeasonView supplied an explicit future date tests earlier-season navigation without changing the OS/server clock. Weak synthetic defenders isolate interruption behavior; those inputs are QA-only and no product test hook is shipped.
- Existing `clubhouse.mjs`, `content.mjs`, `cloud.mjs`, `online.mjs`, `pack-cinema.mjs` cover the connected game, real inspect server restore/conflicts, signed local-relay H2H and normal/reduced-motion pack presentation.

The complete source/CI/private deployment references and final results will be appended after verification. Chromium event-signal and phone-size checks do not claim a physical iPhone system-gesture/audio/background playtest.


## Verified local results

- **589 unit tests passed**: 311 NBA / 278 NFL; the 31/63 existing skips remain. TypeScript and production build passed on the final runtime. The all-edition audit checked 22,082 NBA / 32,242 NFL editions with zero invalid entries; it does not claim every historical attribute is an official licensed 2K/Madden value.
- Both-sport `polish.mjs` passed all reward/reload, modal/background safety, stored development-copy, canceled/dragged release and interrupted throw cases with zero page errors. Future-season navigation/batch claim passed with the real styled component and an explicit date. The first input QA exposed that NBA controls looked ready during the initial possession delay; controls now dim/disable until a live possession and the test waits for the actual clock/readiness state.
- The complete `clubhouse.mjs` passed in both sports: presets, active development, Circuit reload/launch, claims and actual five/three-attempt Moments. Original 56/69 fixture copies retained all original fields.
- `content.mjs` passed in both sports: collection rewards, failed registered pack/reload/single charge, actual registered reward and event progress. `cloud.mjs` passed real inspect-server restore/conflicts for both sports including full HQ/copy equality. `online.mjs` passed one H2H win/one loss and Rivals progress for two independent signed local-relay clients per sport under NBA 7 / NFL 6.
- All seven `pack-cinema.mjs` cases passed: normal GOAT/Spotlight/Gold and NFL Legend, 320px GOAT, touch landscape NFL GOAT and reduced-motion GOAT. Open/skip, final control/card bounds, inventory preservation and zero page errors were verified.

[Actual rendered captures](previews/README.md#researched-fixes-and-polish--codex-2026-10-30) preserve the game's materials. Physical installed-iPhone system gestures/audio/background behavior and a real two-phone network match remain device playtests; Chromium event tests are not represented as those checks.


## Verified publication

GitHub implementation `f2ad6df57b45e22f1e4aa19952061f11e8d41ab4` matches local `e0ad4bb44997aed953eb901efc608e341a37cbe5`, tree `6633946c382d8dc5e29e0c9d6a9abdf899abbd0f`. Remote tree equality was checked before moving the feature ref. [Review build #19](https://github.com/QemmHD/perfect-season/actions/runs/41113183845), job `124260552711`, **passed**: 311 NBA / 278 NFL tests, whole-pool ratings audit, TypeScript and production build. PR #1 remains open and unmerged.

Private preview: https://perfect-season-private-preview.qem.chatgpt.site . Pushed source `8ed7d0391455d599380d525c0adc0d32eaa2f8a4`; saved version `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_546a72c062a88191b3b0ea2ee1fe6c4d`; deployment `appgdep_6ae4eca9ef088191af6f95cff1fe12ed` returned **succeeded**. Exact pushed source built successfully and passed production boot/forced namespace/PWA manifest checks with no page errors. Owner-private access, origin, `preview2026` namespace and installed PWA ID are retained. Main/original restore were checked at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-polish restore remains `f5f4e5138e7bf3bf60cd67f61c6795dbf24bb4d1`. This release-record follow-up changes documentation only.
