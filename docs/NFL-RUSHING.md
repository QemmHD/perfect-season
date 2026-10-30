# NFL rushing execution — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** after the owner reported that running the ball felt almost impossible. This revision fixes the control/path/blocking interaction in the existing eleven-on-eleven NFL engine. It applies to draft, Ultimate Team, Training Camp, played matches and simulations through the shared engine. The original card ratings, saved progress, wallet, packs and account identity are preserved.

## Findings and resulting behavior

- **Forward thumb input cancelled the running lane.** `steerNow` returned the carrier's current x-coordinate for a neutral/upfield stick. That overrode the called hole, so holding forward could drive an Outside Zone straight into the tackle box. Neutral/upfield input now returns the engine's no-override signal; lateral input still cuts immediately.
- **Ordinary stick travel could trigger a spin.** The old flick threshold was 46px, exactly the floating stick's normal radius. A 50px push could become a move rather than steering. Moves now require a deliberate >70px flick within 200ms, after the handoff; normal stick travel steers. Existing directional flicks and double-tap Power remain available.
- **The outside path turned upfield too soon.** A constant forward velocity crossed the line near x+4 yards despite the outside hole being x+7.5. Outside Zone now stretches behind the line before planting upfield, around the edge at the new x+6.5 landmark. The play-card arrow uses the same edge landmark. Manual steering can override it; there is no forced rail or invulnerability.
- **Nearest-man blocking could leave an edge free.** A right tackle could chase the guard's DT while his assigned edge was untouched. Guards/tackles now maintain their assigned initial front block while engaged. The center still climbs to MLB and the tight end to SLB; subsequent open-field blocks retain their existing selection.
- **Blocks expired before the handoff path developed.** Normal initial holds gain 0.25 seconds, with actual RBK versus BSH still determining duration. The unchanged early-loss chance can still blow up a run. Tight ends use their full RBK with a meaningful seal duration instead of a receiver-length half hold. Lineman/receiver re-engagement duration, shedding, tackle timing, break-tackle odds, stamina and move cooldowns remain in force.
- **Defenders could follow the back as a pass route before the exchange.** During the existing PRC/difficulty read window, they now read run keys before pursuing the carrier. High-difficulty reads remain faster and misreads less frequent.
- **Ball carriers had a permanent 10% speed tax.** Normal carry pace is now 94% of rated speed (previously 90%); fatigue and broken-tackle slowdown remain. This also affects scramble/YAC running, while pass accuracy, pass rush win times and coverage formulas are unchanged.

Juke, Spin and Power buttons now appear while carrying, using the game's existing `.fb2-moves` / `.fb2-mv` materials, colors and typography. Power uses the carrier's better truck/stiff-arm attribute, as before. Buttons support immediate pointer input and keyboard Enter/Space. On short portrait screens they use the existing smaller control sizes to leave more field visible. The running hint explains following blocks, cutting and move controls. A performed move does not guarantee beating a defender; successful beats retain their original feedback.

## Code and connections

- [`src/game/football2/engine.ts`](../src/game/football2/engine.ts): run landmark, carry pace, front-block assignment/duration, tight-end seals and pre-handoff reads. No saved fields or runtime dependency added.
- [`src/game/football2/Football2.tsx`](../src/game/football2/Football2.tsx): neutral-stick behavior, deliberate flick threshold, existing-style move controls/hints and outside play-card arrow.
- [`src/game/football2/rushing-controls.css`](../src/game/football2/rushing-controls.css): short-portrait sizes and visible keyboard focus, loaded only by the NFL component.
- [`src/game/football2/rushing.test.ts`](../src/game/football2/rushing.test.ts): actual outside-lane crossing, distinct tackle/guard assignments, lateral override, early shed allowing a loss, and finite 99+ runs for all paths.
- [`scripts/audit_nfl_rushing.ts`](../scripts/audit_nfl_rushing.ts): read-only fixed-seed headless diagnostic using real UT squads and draft-depth players. [`nfl-rushing-balance.json`](nfl-rushing-balance.json) contains the complete before/after results.
- [`scripts/qa/rushing.mjs`](../scripts/qa/rushing.mjs): actual NFL component with isolated profiles, manual pointer and move-button input, practice-attempt callbacks and screenshots. It compares forward stick against no input and checks that a normal push does not spin, controls fit, pixels render and original owned-copy/XP fields survive. A button's animation is captured; a successful broken tackle is not assumed from pressing it.
- `src/net/match.ts` and `src/ut/Match.tsx`: NFL matchmaking rules become **5**, NBA stays **4**. Matching updated clients use the same physics; prior NFL clients remain in their prior queue. Existing storage namespaces, `DATA_V`, leaderboards, records and Rivals progression are retained. `net.test.ts` / `nfl-net.test.ts` assert the intended draft version.

## Measurements and limits

There are **6,480 plays per version**, 80 seeds per case: three Inside/Power/Outside plays × Rookie/Pro/Legend × lane/forced-straight/autopilot control × equal full UT silver/UT gold/draft-depth teams. UT fixtures choose the same 60th-percentile level-1 card per slot, without duplicate names. The headless script never reads or writes a player profile or contacts a relay/registry.

For the equal-gold Outside Zone fixture, the original held-forward input corresponds to `straight`; the corrected held-forward input corresponds to `lane`:

| Defense | Mean yards before → after | Median yards before → after | Runs at/below zero before → after |
| --- | --- | --- | --- |
| Rookie | 3.85 → 3.24 | 1.4 → 2.4 | 18.75% → 0% |
| Pro | 3.25 → 2.78 | 0.9 → 2.1 | 30% → 0% |
| Legend | 2.21 → 2.33 | −0.4 → 1.7 | 60% → 0% |

The improvement is consistency of reaching the intended edge, not a universal increase in average yards or automatic big plays. Those 0% values describe these finite fixture samples, not an immunity rule. Early sheds can still produce losses, as a regression verifies. Strong defenses, poor timing, mismatched blockers and badly chosen cuts still matter. Autopilot samples can exploit openings better than a person and are not evidence of human fun or a promise about every lineup. Legend remains demanding; using the opening and timing a move should remain useful.

`npm test`: **288 NBA / 255 NFL passing (543 total)**, 31/63 existing sport-specific/manual tuning skips. TypeScript/production build passed; original large-data/chunk warnings remain. Two signed local-relay clients in each sport agreed on one win/one loss and 30 combined Rivals points. Manual touch-browser results and publication IDs are recorded in CODEX-UPDATE-LOG.md. Chromium does not establish physical installed-iPhone latency, Safari behavior, audio or haptics.

Reproduce:

```sh
npx vite-node scripts/audit_nfl_rushing.ts > /tmp/rushing.json
npx vitest run src/game/football2/rushing.test.ts
# Optional browser tool setup / proxy variables: BROWSER-QA.md
node scripts/qa/rushing.mjs
node scripts/qa/online.mjs
```

The baseline source is retained at `backup/pre-nfl-rushing-2026-10-30` → `7f1cfbd0b85fe9c2f100f31d60294a3eb3ca7ae5`; the read-only audit can also run against that source. Main/original restore remain `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. Work is published only to the feature branch/PR and existing owner-private preview; no backend deployment, account migration or main/Pages promotion is part of this change.
