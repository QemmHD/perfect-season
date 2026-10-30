# Pack cinema — implemented by Codex, 2026-10-30

The pack opening now stages an arena arrival using the existing Archivo type, teal/gold palette, foil wrappers, pixel players and Ultimate Team card frames. **Codex (OpenAI)** implemented this presentation revision. It does not change pack odds, card selection, rewards, purchase/retry transactions, progression or backend functions.

## What players see

1. The sealed foil pack floats above a quiet light well. **BREAK THE SEAL** starts a rising synthesized cue, a charge strip and a seam rupture; the two wrapper halves fly apart.
2. Arena doors open onto a mystery card. Light streaks and position → franchise/season clues build anticipation.
3. A GOAT pull has an additional late escalation: the neutral arena turns gold, the crown appears and **99 / SHATTERED** precedes the actual above-99 card. This occurs only when the already-awarded best card is GOAT; ordinary pulls never stage that promise.
4. The actual card rotates into the arena with a bounded impact cue, shock rings, team/edition lighting and restrained confetti. Its player, overall and registered copy remain clear. Tap to continue reveals the complete pack with the original Done / See Club actions.

Ordinary golds are quicker. GOAT is the longest natural entrance: 1.05 seconds for the wrapper, then 5.55 seconds until Continue (6.6 seconds total). No unskippable timer or new reward gate is added.

## File and connection map

- `src/ut/PackOpening.tsx`: existing pack/reward modal and phases. Adds staging, keyboard-open/continue buttons, cancellable sound handles and the late GOAT surge. Uses the original `revealOrder` / `walkoutLevel`; preserves each matching owned copy and its mint metadata.
- `src/ut/pack-sequence.ts`: presentation-only tier timing, separated from pack RNG and transactions. Tested in `pack-sequence.test.ts`.
- `src/ut/PackAtmosphere.tsx`: original procedural Canvas2D motes, streaks and shock rings. A private seeded generator controls visuals only. Limits: 72 motes, 30 draws/second, 2× pixel ratio; drawing pauses in a hidden document. Live serial metadata updates do not restart its scene clock. It cleans up animation and resize handlers on dismissal.
- `src/ut/pack-cinema.css`: wrapper rupture, doors, mystery staging, GOAT limit break, card entrance, control focus, small-screen styling and reduced-motion overrides. Loaded after the retained `pack-reveal.css`; `CardArt.tsx` remains the original shared card renderer.
- `src/lib/sound.ts`: `packSound` generates short charge/surge/reveal chords with Web Audio through the existing sound-enabled context. No new recordings, downloads or dependencies. Returned stop handles cancel cues on Skip, Continue or unmount. `sound.test.ts` verifies cancellation and sound-off behavior.
- `src/ut/CardSerial.tsx` remains the source of each live fixed-issue / active-circulation stamp. No registry, Supabase, Nostr, profile version, storage key, UID, card ID, XP, squad or wallet schema changes are required.

## Skip, motion and accessibility

Skip works during the tear or the walkout. It clears staged timers and audio, removes the particle canvas and disables CSS motion, leaving the actual final card available immediately. Reduced-motion preference skips the staged entrance, omits particles/confetti and disables decorative animation. Sound-off stays silent. Buttons are keyboard accessible with visible focus. Top/bottom controls inherit the game's safe-area variables from its existing stage.

The effects are original code and CSS, with the existing card/crown/pack artwork reused. There are no newly downloaded/licensed external visual or audio assets.

## Verification and release boundary

`npm test`: **283 NBA + 250 NFL tests pass (533 total)**; 31/63 sport-specific or manual-tuning skips remain. Browser reproduction: `scripts/qa/pack-cinema.mjs` with the optional Playwright setup documented in BROWSER-QA.md. The video case also needs Playwright's `install ffmpeg` once in the separate QA tools environment.

The script uses actual components inside the real game stage in isolated localhost profiles: normal/reduced motion, keyboard opening, mid-tear/mid-walkout Skip, small portrait and touch-rotated landscape layouts, safe areas and original-copy preservation. Its display-only **8/20** card is not deposited or minted; mocked `packart` counts cannot change any worldwide total. No fixture hook or boosted odds are shipped in the game.

TypeScript and the production build pass. Full paid-pack retry/reload, exactly-once charge, registered reward, gallery and event flows pass in NBA/NFL, preserving all 56/69 original fixture copies. The original large-data/bundle warnings remain. Final browser/publication results are recorded in CODEX-UPDATE-LOG.md and PRIVATE-PREVIEW.md after verification. Chromium checks do not establish physical installed-iPhone audio, haptics, GPU performance or Safari behavior.

Source safety point: `backup/pre-pack-cinema-2026-10-30` → `e9a35dbd1e10d29c524579112608d847747c1dcd`. Publication stays on `feature/season-evolution`, PR #1 and the existing owner-private preview. Main/Pages and the original restore source stay unchanged.
