# Actual court and field overhaul — Codex, 2026-10-30

**Implemented by Codex (OpenAI).** This revision changes actual NBA/NFL play after the owner clarified that menus and reliability polish were not the intended gameplay overhaul. Source restore: `backup/pre-core-gameplay-2026-10-30` at `0bfe5a54bbf9f87c5865325fd8bd605f20140177`. Work remains on `feature/season-evolution`, PR #1 and the existing owner-private preview. Main/Pages and the original restore remain unchanged.

## Play direction and controls

Responsive arcade play with believable, rating-driven defense and deliberate choices. The original offense-possession/drive match format, pixel court/field, kits and licensed existing mocap remain. This is a rebuilt set of play interactions inside those engines; it does not add a playable defensive possession or a new full-length 5v5/11v11 match format.

### NBA

- **Physical rebound contests:** misses no longer roll offensive/defensive possession before the race. Players must reach the actual moving ball with sufficient hand/jump height. REB, VRT, height, position, fatigue and timing affect the contest. No winner is moved to the ball endpoint. The nearest suitable offensive rebounder becomes controlled; neutral input helps approach the landing spot, the stick can override, and the existing SHOOT button becomes **BOARD** for a real jump. Teal player and gold landing rings identify the race. Teammates yield space gradually instead of standing on the same feet.
- **Actual catches and alley-oops:** the receiver moves toward the pass endpoint; an alley-oop requires reaching the location and jumping high enough. Out-of-reach attempts fail instead of snapping the player into a dunk. A normal catch remains where the receiver actually stands and finishes its catch animation.
- **Shot rhythm:** a ready catch-and-shoot release uses a quicker 0.45-second rhythm, a set shot 0.52 seconds, a moving pull-up 0.59 seconds. The real meter and recorded shot animation use the same tempo. Recent stationary catches slightly widen the timing window; motion, player shooting ratings, fatigue, contest and chosen difficulty still matter. The meter identifies the shot context.
- **Read and pass:** tap a teammate on the court to pass directly, or use the original PASS/stick controls. A canceled touch does not pass. The defense sends a helper when the on-ball man is beaten inside, then rotates another defender to the abandoned assignment; it must recover on the kick-out. No hidden offensive scoring bonus is awarded by a play-call button.

### NFL

- **Choose the real throw:** **BULLET / TOUCH / LOB** change speed and arc at the same distance. Those trajectories drive the actual ball, swept passing lanes, receiver lead and drag preview. Underneath defenders can play reachable passes; a high ball buys clearance at the cost of time. THP/accuracy/pressure/movement remain authoritative, including bounded above-99 advantages.
- **Read receivers:** field markers and buttons share X/SL/Z/TE/RB colors. Tap a receiver to lead his remaining route using the selected flight time; dragging to a free target still works. A receiver button does not promise a completion or bypass coverage, range or throw error.
- **Catch and run:** an open in-stride catch retains 96% of the receiver's current momentum with a short gather. Traffic and reaching catches cost more speed. Catching never moves a receiver to the ball endpoint. The recorded moving catch remains visible while he brings the ball into his body, then transitions to carrying.
- **Set up blocks, then burst:** hold **BURST** through the handoff or after a catch. Sprinting uses the same stamina as Juke/Spin/Power, has a bounded speed increase and recovers on release. Normal pace keeps the original play-designed lane and deliberate steering. Pointer capture, keyboard release, blur, cancellation and play-end handling clear held input.
- **Physical defense/blocking:** an active hold requires the assigned blocker to be close; a detached timer cannot freeze a defender. Engaged players yield small amounts of ground by actual leverage/weight. Pursuit predicts from observed velocity, uses PUR/PRC, takes a bounded angle from farther away, then attacks the runner's body close down. The original readable tackle wind-up, committed dives, move timing, break-tackle and fumble systems remain.

## Implementation and connections

| Module | Responsibility |
| --- | --- |
| `src/game/hoops2/types.ts`, `engine.ts` | Optional transient catch/rebound/shot-tempo/rotation state; fixed-step simulation and real physical outcomes. The obsolete preselected `BallFlight.orb` flag is removed. |
| `src/game/hoops2/Hoops2.tsx`, `render.ts` | BOARD control and landing guide, direct teammate hit testing, input cancellation, meter context and animation tempo. |
| `src/game/hoops2/autopilot.ts` | AI approaches a loose ball and times the same real rebound jump. |
| `src/game/football2/types.ts`, `engine.ts` | Pass type/lead, burst/stamina, catches and catch animation duration, assigned blocker contact, bounded pursuit. |
| `src/game/football2/Football2.tsx`, `render.ts`, `rushing-controls.css` | Receiver/trajectory controls and field labels, captured burst button, existing gait/catch clips, responsive HUD using the original Archivo/teal/gold skin. |
| `src/net/match.ts`, `src/ut/Match.tsx` | Both draft and UT mechanics queues advance to **8**; old physics clients cannot pair with new clients. `DATA_V` and board history remain. |
| Both `gameplay.test.ts` files; `scripts/qa/core-gameplay.mjs` | Physical-outcome regressions and real pointer/keyboard/browser checks. |

No runtime dependencies, commercial art/animations or borrowed game code were added. Both draft and Ultimate Team use these same core engines. Existing account identities, owned card/edition IDs and UIDs, levels/XP, serial ledger, squads, wallets, rewards, records and encrypted server saves retain their existing keys/schema. There is no database migration, backend deployment or account reset. The private build keeps its separate origin and `preview2026` namespace; no live accounts are transferred into it.

## Research

Eight Exa search-result slots across NBA/NFL gameplay angles, followed by direct reading of the two primary reports below. These supply design principles, not proprietary algorithms or claims of matching commercial game quality.

- [NBA 2K26 Gameplay Courtside Report](https://nba.2k.com/2k26/courtside-report/gameplay/): planting/cutting, motion-aware shot rhythm, rebound timing and help/recovery that create drive-and-kick choices.
- [Madden NFL 26 Gameplay Deep Dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive): trajectory decisions, receiver/coverage leverage, catch/run momentum, blocking and physical tackle execution.

## Measurements and validation

[Full rushing report](core-gameplay-rushing-audit.json): the same 80 seeds across 81 cases before and after (**6,480 plays per version**), covering silver/gold/depth squads, inside/power/outside calls, three difficulties and lane/straight/pilot controls. Every play completes with finite state. The following are equal-case averages of yards/run; they are synthetic behavior probes, not NFL statistical targets or a user study. The burst button is not used by this unchanged comparison harness.

| Control | Rookie before → after | Pro before → after | Legend before → after |
| --- | --- | --- | --- |
| Follow designed lane | 6.24 → 6.66 | 4.76 → 5.78 | 3.56 → 4.75 |
| Straight steering | 6.93 → 6.83 | 5.79 → 5.91 | 3.51 → 4.33 |
| Existing move/steer pilot | 11.98 → 13.26 | 10.04 → 9.93 | 8.15 → 6.91 |

A failed early pursuit candidate produced excessive fly-bys and long runs. It was corrected before release: close-range lead is bounded and current visible position is not delayed a second time. Final figures above use the corrected model. All modes remain harder on aggregate at Legend; individual seeds and roster matchups vary.

[NBA report](core-gameplay-nba-audit.json): six strategies × two legacy roster fixtures × six seeded games, **1,152 possessions per version**, with human-like release error; an additional same-size Legend probe is retained. Pro results distinguish cross-and-drive, stationary three, elbow, step-back and kick-out choices. Examples for the stronger fixture: straight drive 0.96 → 0.86 PPP, cross-drive 1.04 → 1.20, three 0.85 → 0.85, step-back 2.03 → 1.65, kick-out 1.43 → 1.28. These are regression/balance evidence, not proof of subjective fun or every roster's balance.

Local verification: **611 tests** (322 NBA / 289 NFL; 31/63 existing skips); focused physical/catch/run regressions also pass after the final animation/input edits. TypeScript and production build pass. New regressions cover reachable rebound ownership without relocation, actual rebound jump height/cooldown, physical pass catch and shot rhythm, unreachable lobs, help rotation, trajectory ordering/arm strength, receiver lead, open catch momentum/animation, bounded burst/recovery, detached blocking timers and finite pursuit.

Browser checks cover normal-speed actual NBA/NFL match input and completed matches, plus slow-motion (0.5×) real component captures/control tests at 320×568, 390×844 and 844×390. New controls, selected trajectory, outside-button release, keyboard and OS interruption pass with zero page errors; original fixture copies, metadata, squads and wallet survive. Signed two-client Nostr H2H settles one win/one loss in both sports under the new queues. Inspect-server restore/offline/conflict tests restore 56 NBA / 69 NFL copies, identity, wallet and clubhouse without backup files. All checks use isolated test accounts/local relay or the inspect save namespace.

[Actual component screenshots](previews/README.md#actual-court-and-field-overhaul--codex-2026-10-30) retain the original art and UI. Physical installed-iPhone touch/animation feel and two physical phones still need owner playtesting; Chromium and deterministic probes cannot establish those. Existing dataset/bundle size warning remains a performance limitation on older phones.

Exact GitHub/CI and owner-private deployment provenance will be appended after publication.
