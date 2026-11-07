# Gameplay execution and skill feedback

Implemented by **Codex (OpenAI), 2026-11-07** for the Perfect Season overhaul preview.

## Audit findings

The current engines already have physical NBA containment/help rotations, deterministic 2K-style shot timing/contests, real NFL blocking and two-axis human movement, and soccer's drag-to-aim/continuous timing. Those mechanics are covered by existing seeded tests. This pass preserves that work rather than guessing at new probability curves.

Three concrete execution/learning gaps were found:

1. NBA crossovers, spins and step-backs are reachable only through joystick flick gestures after a timed hint disappears. NFL already exposes its corresponding moves as buttons. Players can therefore miss important NBA tools entirely.
2. NBA/NFL outcome feedback is largely transient. The actual release offset, contest, coverage, run concept, gain and spent energy are present in the engines but are not available to inspect after the banner disappears. It is hard to distinguish a poorly timed shot from a contested one, or a stopped run from an exhausted burst.

3. NBA `finishNow` used actual layup timing to settle the shot but then wrote `lastShot.off = 0` for every finish, including blocked layups. Early/late layups therefore appeared on time in result telemetry. It also discarded green timing on blocked layups. This pass records the existing measured offset/green flag without changing the accuracy calculation or RNG sequence. Automatic dunk/contact/oop finishes are labeled as automatic; they are not given invented release timings.

## Added controls

NBA now has **CROSS / STEP BACK / SPIN** buttons beside the existing thumb controls. They invoke the original `crossover`, `stepback` and `spin` actions, using the existing shared cooldown, physical motion, animations, defender interactions and turnover risks. The joystick flicks remain available. Buttons respect shot/pass/finish/replay/possession state; a blocked repeat gives cooldown feedback. No ability, rating or action probability is changed.

## Actual Last Play breakdowns

A compact **LAST PLAY** button at the HUD edge opens an optional corner card. It never pauses or hides the existing run/shoot buttons, and explicitly states that live play continues. The expanded card collapses as a new play starts or the play counter advances. Feedback is an immutable snapshot of completed engine values, not a new roll or a reason invented after the outcome.

- **NBA:** actual shot type, measured early/late release, actual contest, pass count and a relevant next action. Timing clipped by the existing NBA `lastShot.off` field is labeled “250+ ms”, not presented as exact. An old shot after an offensive rebound is not blamed when the eventual possession ends on a turnover.
- **NFL:** actual run/concept, man/zone coverage, raw play gain and stamina at the whistle. An accepted flag shows the settled flag result and labels raw gain as “before flag”; it does not contradict the new down/distance. Suggestions respond to the actual sack/interception/low energy/short run/completion context without claiming telemetry that does not exist.
- **Soccer:** actual attack scenario, shot type, continuous measured release timing, assisted/manual aim, attack outcome and remaining sprint energy. Offside and timeouts give different advice from a blocked or saved shot.

Feedback does not claim a new proprietary 2K/Madden formula or that perfect timing guarantees every shot. The cards' actual attributes, selected difficulty and existing ratings-based simulation remain authoritative.

## File map

- `src/game/play-feedback.ts`: pure three-sport snapshot builders and honest timing labels.
- `src/game/PlayReadout.tsx`, `play-readout.css`: optional responsive HUD readout and explicit NBA skill controls styling.
- `src/game/hoops2/Hoops2.tsx`: exposes original moves and snapshots completed possessions.
- `src/game/hoops2/engine.ts`, `gameplay.test.ts`: corrects and verifies recorded layup timing; physics/probability remain unchanged.
- `src/game/football2/Football2.tsx`: snapshots after actual flag settlement.
- `src/game/soccer2/Soccer2.tsx`: snapshots completed attacks.
- `src/game/play-feedback.test.ts`: verifies observed timing/coverage/results, accepted penalties, stale-shot exclusion and no random rolls/state mutation.
- `scripts/qa/play-feedback.mjs`: isolated manual-component QA, real engine outcomes, narrow/landscape bounds and original inventory/wallet checks. The test-only time scale accelerates the clock; those captures are not ordinary-speed playtests or player achievements.

## Preservation and validation

No engine physics/probability/difficulty changes, no extra RNG draws, no queue-version changes, no save migrations, no card-ID/UID/serial/XP/wallet changes and no backend operations. Focused NBA/NFL control/execution and feedback tests: **45 passed** in the final integrated NBA run and again in the NFL run (15 NBA execution, 14 NFL execution, 9 direct-control and 7 feedback cases). Overall build/typecheck/release results belong in the final overhaul release record.


## Remaining gameplay direction from the audit

- The current online format is a parallel offensive challenge: each phone plays its attacks against the other squad’s AI defense and exchanges signed progress (`Arcade.tsx`). Human-controlled defense and both phones sharing one real-time ball would be a new authoritative networking project, not a cosmetic tweak to “fake defenders”. Preserve the working format while developing that separately.
- Both selected difficulty and card attributes influence timing tolerance and defensive reads. Keep difficulty labels and training explanations aligned with those existing rules; removing one effect without calibration would change balance across offline, online and simulations.
- Rushing and shooting should be audited with real manual inputs and distributions, not only autoplay win rates. The current regression suites cover physical movement, contact, blocking and rating monotonicity; future balance changes should retain those suites and publish human input captures with their test-only speed settings clearly disclosed.


## Final browser verification

NBA, NFL and Soccer isolated manual-component checks passed with **zero page errors**. Captures at **390×844, 320×568 and 844×390** verify the optional breakdown stays in the viewport and does not overlap joystick/pass/shoot/BURST controls. NBA move buttons are separately bounded above PASS/SHOOT. The test also confirms unchanged original wallet, card IDs/UIDs, levels and XP.

The NBA test instruments only the localhost response for `HoopsRenderer.draw` (no product debug hook) to observe actual engine action/timestamp: a CROSS button click must enter `cross` and set `lastMoveAt`; immediate SPIN must leave that timestamp unchanged and show the recharge cue; a later STEP BACK click must advance it. This verifies the input callback reaches the real engine, rather than merely checking button labels.

Final screenshots: `/tmp/next-gameplay-qa/coach-{nba,nfl,soccer}-{390,320,844}.png`. These use accelerated test-only time (**2× NBA, 8× NFL/Soccer**) and are not normal-speed performance or balancing evidence. Initial browser attempts during concurrent build pressure and an incomplete Soccer fixture were rerun with the corrected isolated harness; only the final zero-error runs are claimed here. Production engines, RNG, selected difficulty and accounts were not altered by the QA.
