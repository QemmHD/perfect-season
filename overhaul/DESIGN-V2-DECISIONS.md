# Lead decisions on Game Design V2, section F.6 (2026-11-16)

These are the lead's defaults. The owner can still override any of them. They stand unless the owner overrides them.

1. **Economy ceiling:** ACCEPT about +50% for the engaged player (the full D.16/E.5 tables). It's hard-capped and mostly packs on the realistic odds curve.
2. **NFL burst:** burst on the stick ring, with a "Burst button" preference that restores the old layout. Default is the ring. This is an owner device check.
3. **Big-head sprites:** APPROVED. Use 5-head proportions, the 1.5 px art pixel and the #14121c outline (C.1). This is an owner device check.
4. **Release:** ONE release, as the owner decided on 2026-11-09. The top-edge fix ships early; the rest ships together. F.4 is the build order and the must-not-slip list.
5. **NBA planning cards:** CUT. The CALL radial replaces them.
6. **Soccer Appendix A:** PROMOTED. Touch dribbling comes first; shot types and TRICK follow.
7. **Push notifications:** the app badge count ships. NO push sender in this release.
8. **Streak wager:** stays OUT.

## Ownership changes, because shell's plan is already running

The shell team keeps its current plan. Its V2 items move to other teams:

- **nba** gets:
  - `src/game/controls-geometry.css` and the action-safe box variables.
  - Keeping the arena mounted through the result sheet, so a rematch takes ≤10 s. This is the shared `Arcade.tsx` path; nfl and soccer adopt it for their own sports.
- **ut** gets:
  - `src/lib/playtime.ts` + `usePlaytime`, with tests for every E.1/E.2/E.8 rule.
  - `src/lib/haptics.ts`.
  - The "Session reminder" and "Hide leaderboards" settings.
  - The lead's items from F.2 "lead" #1, granted to ut for this release:
    - the profile `playtime` field and its cloud merge rule, plus an old-save test (`src/lib/profile.ts`, `src/lib/cloud*`, additive only)
    - the `minutes` and `play` branches in `src/net/leaderboard.ts`, with a test proving every existing board tag stays byte-identical
  - Never write to live relays or boards during QA.
- **Protocol bumps** stay with the lead at integration (F.3).
