# Play tab and football overlay — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** for the owner's request to group playable Ultimate Team content under a new Play tab and remove the large black rectangle appearing over football.

## Navigation and original-style UI

The bottom bar now reads **Home · Play · Squad · Club · Store · SBC**. Play contains Champions Circuit (or Continue Your Circuit with the saved match/win count), Moments, Squad Battles, Head to Head, Division Rivals and Legends Series. Each competition keeps Play selected and its top-left back action returns to Play. Returning from a match still uses the existing retained view. Home's Play HQ button opens the same tab; direct competition launchers have moved out of Home. Home keeps club, collection, season, objectives, development and records management. Draft and Training Camp remain available from the game's existing main menu.

The tab uses the existing outlined Play icon, gold active indicator, Archivo typography and navy/teal materials. Six equal-width targets have slightly tighter label spacing; the bar reserves at least 60 logical pixels vertically so its targets remain at least 44 screen pixels in the tested narrow/desktop-frame layouts. No new art, font or dependency is needed. Circuit resume uses the current saved run, with no new state or migration. Head to Head retains connection and complete-squad checks.

## Football black-box root cause

Football's root also has the shared `.hg2` class. Basketball's newer `.hg2:not(.wide) .hg2-hint` rule supplied `top:161px` while football supplied `bottom:196px`. Both insets applied to an absolutely positioned auto-height tip. On a 390×844 viewport it stretched into a **487px-high dark rectangle**, blocking the middle of the field. Existing practice-only gameplay captures suppressed onboarding tips and missed this normal-match state.

Basketball's coach/hint placement is now explicitly scoped away from `.fb2`. Football hints use intrinsic text height and a compact content width, with only a top anchor below the scoreboard/drive/On Fire area. This keeps them clear of the pre-snap play calls and live joystick. Tips retain their existing text, one-time behavior, 4.2-second timeout and pointer-event transparency. The actual playbook, score popups, canvas and run/pass controls stay functional.

## Files and checks for Claude

- `src/ut/UltimateTeam.tsx`: sixth tab, competition parent/back mapping, Play online-entry guard.
- `src/ut/Clubhouse.tsx`: Play mode list and saved Circuit resume presentation.
- `src/ut/Hub.tsx`: management home; removed duplicate playable entries.
- `src/game/hoops2/coach-controls.css` and `src/styles.css`: sport-scoped hint placement, intrinsic football tip and six-tab sizing.
- `scripts/qa/play-tab.mjs`: both sports, every competition/back route, all six targets at 320×568, 390×844 and 844×390, saved Circuit resume and original wallet/squad/copy-field preservation. Normal, **non-practice** football is mounted and snapped at the same three sizes; its hint must be ≤80px, inside the viewport and clear of the scoreboard/play calls. Viewport env safe areas are represented by explicit QA-only CSS variables on the game portal. `PS_FOOTBALL_ONLY=1` runs just the final hint checks. `PS_FOOTBALL_BASELINE=1` captures the old issue without enforcing the corrected geometry.
- Existing clubhouse/content/polish/cloud/online/reveal/UI QA entry locators follow the new Play navigation. `docs/play-tab-layout-audit.json` and `docs/football-hint-layout-audit.json` retain measured geometry; [selected captures](previews/README.md#play-tab-and-football-overlay--codex-2026-10-30) show real components with isolated QA profiles.

No accounts, card editions/copy UIDs, serials, levels/XP, coins, squads, rewards, records, save keys/schema, backend endpoints or game mechanics change. Queues stay NBA 8 / NFL 9. Source restore before this update: `backup/pre-play-tab-2026-10-30` at `c24b293c76441d7552c1d4b03a87aa8e5a1bb306`. The original restore and live main remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. No player backup-file workflow is added.

Browser QA does not establish physical installed-iPhone behavior. Normal football hint checks use 0.1× simulation only to hold a reproducible snap state; UT navigation and online checks use normal UI timing. The existing bundle-size warning remains. Verified test/publication results are recorded below when complete.

## Verified local validation

- Full suites: **653 passed** (343 NBA / 310 NFL; 31/63 existing skips). TypeScript and production build pass; existing large-bundle warning only.
- Both-sport Play navigation: six tabs at three sizes, all five competition-page/back routes, preserved wallet/squad/original fields on all 56 NBA / 69 NFL fixture copies, and exact saved Circuit ID continuation. Minimum measured tab target: **44.25 screen px**.
- Final non-practice football: all six pre-snap/post-snap cases pass with simulated safe areas. Tip height **28–42px**, inside the viewport, clear of scoreboard and pre-snap calls; zero page errors. Baseline at 390×844 was 487px tall.
- UI consistency: 30 layout/stress checks plus modal Tab/Escape/return focus pass in both sports, including new Play parent/back paths.
- Complete clubhouse flows pass in both sports: Circuit reload/resume, development, saved lineups, objective/season claims and manual Moments attempts (five NBA / three NFL).
- Content flows pass in both sports: registered pack recovery, collection/card inspection and Legends Series entry from Play, with displayed result/history settlement checked exactly once.
- Signed two-client Head to Head passes from Play in both sports: one win/one loss each, correct Rivals points and settlement.

The source was preserved before edits; GitHub/private-preview provenance follows after publication. Main remains unmerged.


## Verified Play-tab / football-hint publication — Codex

- GitHub implementation: `4a4d4afa234cb521ab8cf2e4dc9baf733145f621`; local `a7d12d83420b843ea1f4ceec516d39c94e4abf72`; identical tree `ac3c4e3d2c1a118167a1396265cfb78005720092` verified before updating the feature ref.
- [Review build #27](https://github.com/QemmHD/perfect-season/actions/runs/41143845149), job `124364191243`, **passed**: full NBA/NFL tests (653), all-card rating audit, TypeScript and production build.
- Pushed private source: `2f4eb7ad979fd98eab052a80cca1f64eaada4e9f`. Exact pushed-source production build, clean Git, forced `preview2026`, early namespace bootstrap, preview PWA identity and zero-error static boot all passed.
- Saved version: `appgprj_6ae3270ad3608191af6024b57d2c2939~appgver_622801bc1a208191a493ff3b25152bd6`.
- Deployment: `appgdep_6ae5266b08a881919d00ea23f0c1739c`, **succeeded** at https://perfect-season-private-preview.qem.chatgpt.site . Same owner-private audience, origin, namespace and preview install identity.
- Main/original restore remain at `7285ced3e66cb76c4a38d7bda134d6554fe04d33`; pre-update restore is `backup/pre-play-tab-2026-10-30` at `c24b293c76441d7552c1d4b03a87aa8e5a1bb306`.

This provenance follow-up is documentation only. The deployed runtime is the exact verified source above; no runtime redeploy is needed for this record. No account reset, progress migration, backend deployment or live Pages/main promotion. Physical installed-iPhone playtesting remains an owner check.
