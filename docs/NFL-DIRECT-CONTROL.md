# Direct NFL joystick control — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** after the owner reported that running felt like strafing and the joystick did not move the runner properly. This supersedes the manual-input assumptions in NFL-RUSHING.md and CORE-GAMEPLAY.md. Source restore: `backup/pre-nfl-direct-stick-2026-10-30` at `aad7e9b4b747527945a481ad03857a8539bc6f05`.

## Confirmed cause

`Football2.steerNow` discarded the forward/back screen axis and returned only an across-field target. The engine combined that target with a forced positive upfield velocity. A quick long drag could also become a skill move, zero the stick and resume lane assistance. The previous test comparing a forward stick with no input explicitly protected that behavior; it did not establish direct control. The owner's report exposed this gap.

## Resulting behavior

- A permanent joystick uses the original court-control artwork, teal thumb, bevels and safe-area offsets. Its position stays fixed; dragging elsewhere on the field also controls movement.
- The human controls **forward, backward, left, right and diagonals**, with a radial dead zone and analog speed. Diagonals share the same speed budget. ACC/AGI determine responsive acceleration, reversal and braking; SPD, fatigue and burst still determine speed. No player attributes were increased.
- The rear end-zone boundary ends a backward run through the existing out/safety path. Letting go or centering the joystick brakes to a stop; it does not silently resume automatic running. The scripted handoff still completes before direct control of the ball carrier. The stick can be held in advance, and it also works after catches and QB scrambles.
- Normal stick movement cannot trigger a spin, juke or truck. Skill moves remain on **Juke / Spin / Power**. BURST is beside the stick so a second thumb can hold it while steering. Holding burst at rest does not spend stamina.
- Movement is relative to the displayed camera: portrait up is upfield; landscape right is upfield. Arrow keys/WASD work while the joystick is focused. Release, cancellation, lost capture, blur, orientation changes and play completion clear held inputs.

## Files and contracts for Claude

| File | Connection |
| --- | --- |
| `src/game/football2/controls.ts` | Screen-relative two-axis input and radial dead zone. |
| `types.ts`, `engine.ts` | `RunInput = Pt | number | null`. A `Pt` is direct human velocity intent, including `{x:0,y:0}` to stop. Numeric/null inputs preserve the existing autopilot/simulation lane API. Do not convert a centered human vector to null. |
| `Football2.tsx` | Fixed/captured joystick, optional field drag, focused keyboard state, updated hints and input cleanup; passes both axes into each fixed step. Removes ambiguous automatic flick/double-tap moves. |
| `rushing-controls.css` | Uses existing game tokens/control art; separates joystick, burst and right-side skill controls in portrait/landscape/small-phone layouts. |
| `controls.test.ts`, `rushing.test.ts` | Measure screen-axis mapping, actual field displacement in eight directions, analog/diagonal speed, release braking, reversing, idle burst and unchanged AI lanes. |
| `scripts/qa/joystick.mjs` | Real component, actual pointer/touch/keyboard input and observed engine coordinates. The direction-isolation fixture holds defenders away; a separate normal-defense run also completes. No runtime debug hook is shipped. |
| `scripts/qa/rushing.mjs` | Existing entry point delegates to the new direction/displacement checks, replacing the obsolete forward-equals-auto-lane assertion. |

NFL draft and UT mechanics advance to **9**; NBA remains **8**. Old controls cannot pair with new controls online. Data/leaderboard history, existing profile keys/schema, identity, wallet, owned UIDs/edition IDs, levels/XP, serials, rewards, records and squads remain. No backend migration, reset or live-account transfer. Main/Pages remains unchanged; update goes to the same owner-private preview.

## Verification

New regressions check the actual runner's world coordinates and velocity, rather than whether the knob moves. Browser checks run at normal 1× time at 390×844, 320×568 and 844×390. They measure positive/negative displacement for each axis and diagonals, no automatic spin, stopping on release, focused keyboard, two simultaneous touch pointers for joystick + burst, input interruption, control bounds/non-overlap and preservation of all 69 original fixture copies, squad and wallet. The isolated direction fixture removes tackles to measure the input contract; it is not a difficulty or fun benchmark. Normal-defense play is checked separately.

Local full suites passed **651 tests** (342 NBA / 309 NFL; 31/63 existing skips); the final rear-end-zone boundary addition passes focused regressions as well. TypeScript and production build passed. Both-sport signed local-relay H2H settled one win/one loss with 30 combined Rivals points; no pairing/account regressions were observed. [Measured browser results](nfl-direct-control-qa.json) retain actual displacements: a full forward/back/lateral input moved about 2.7–2.9 yards in each 450ms hold after acceleration, and diagonals about 1.9 yards per axis. Release and interruption stopped real velocity, not just the knob. The normal Legend-defense fixture completed for 2 yards and a tackle; that is a smoke result, not a fun/balance claim.

[Normal-defense portrait capture](previews/nfl-direct-390.png), [small-phone control-isolation capture](previews/nfl-direct-320.png), [landscape control-isolation capture](previews/nfl-direct-844.png). Exact GitHub/CI and private deployment provenance are appended when verified. Physical installed-iPhone touch latency/feel still requires owner testing; Chromium cannot establish that.
