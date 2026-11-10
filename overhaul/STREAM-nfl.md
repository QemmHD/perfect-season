# Team nfl: football that plays like the respected games, on a phone

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, port 5216. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` first.

## Why

This is the same owner request as the NBA team's: "play better, stats feel more legit, like the respected sports games (mobile, console, PC), unique gameplay people love, mobile controls must be good, loads, runs and animates".

## Sources

- **`O/audit-nfl.md`:** read all of it.
  - Sections: C-1 … C-6, P-1 … P-4, G-1 … G-6, D-1 … D-5, F-1/F-2, A-1, V-1 … V-4, juice/audio, performance, preserve, order and protocol notes.
  - Harnesses: `O/audit-scripts/nfl_*` (`nfl_sim.ts` runs the real drive engine for seeded games; `nfl_catchstop.cjs` reproduces the critical catch-stop).
- **`O/research-football.md`:** read all of it. Above all:
  - completions, interceptions and sacks by throw depth
  - the run distribution
  - third-down conversion by distance
  - real score shapes (23 points per team; 3- and 7-point margins; 57% red-zone touchdowns; 2.1 points per drive)
  - Retro Bowl's slingshot plus its second-finger bullet/lob, auto stiff-arms and hurdles, the hold-to-truck meter and two-tap kicks
  - Madden-style optional timing skill (perfect release, catch tap, Big Hit ring)
  - QB reads by awareness
  - defensive On Fire and zone traits
  - crowd pressure (solo road games only)
  - mobile pacing (auto-advance, skippable celebrations, quick sim, a hard 99 cap)
- **Code docs:** `docs/NFL-DIRECT-CONTROL.md`, `docs/NFL-RUSHING.md`, `docs/CORE-GAMEPLAY.md`, `docs/GAMEPLAY-RATINGS.md`; tests in `src/game/football2/*.test.ts`.

## Scope

### P0: critical bugs and controls

- **C-1: the ball carrier brakes to a stop after a catch or handoff** unless the stick is already held (`engine.ts:785-797`).
  - The carrier must keep running upfield with natural momentum and steer when the thumb lands.
  - Prove it in the live browser and in simulation: yards per carry and yards after catch return to their no-reaction-delay levels.
- **P-1: the play-call panel hides your own team before the snap.**
  - Redesign it so the formation, QB, RB and line of scrimmage stay visible at 393, 430 and 320 widths and in landscape.
  - Show the run lane on the field for run plays.
  - Make it compact, readable and quick to pick.
- **C-2: no pocket control.** Let the QB move in the pocket with the stick.
  - Add a throwaway (outside the tackle box) and a slide for QB runs.
  - Add a sack animation.
  - RUN IT stays, but escape is no longer the only option.
- **C-3: the passing UI asks too much in 2–3 s.** Simplify reads on a phone, with clear target icons.
  - Keep the slingshot. Add a second-finger bullet/lob toggle as in research.
- **C-4: moves.** Add a chosen direction for jukes, dive/slide/protect-ball, and stamina that persists across a drive.
- **C-5: kicking.** Two-tap kicking with real variation. Make punting a sensible option.
- **D-5:** pause and quit in every match. In online matches, quit means forfeit with a confirm.
- **F-2:** an end-of-game box score with a player of the game.
- **P-3 and P-4:** the playbook dialog overflows the screen, and stale copy contradicts the UI.
- **V-1, V-3 and V-4:** camera framing (players are tiny and the screen is wasted), HUD overlaps, and noisy ability pops.

### P0: stats feel legit (protocol bump: NFL draft + UT)

Calibrate to the research's real 2024–25 numbers, with seeded simulation tests asserting them within tolerances (use `nfl_sim.ts` as the base).

- **Passing:**
  - 64–65% completions
  - about 2.2% interceptions
  - a 6.9% sack rate
  - by throw depth: 79% behind the line, 72% at 0–9 yards, 55% at 10–19, 35% at 20+, with interception rates rising with depth
  - a defender only intercepts when facing the ball
- **G-1, runs:**
  - a median gain of 3 yards and 4.3 yards per designed run
  - 18% of runs gaining zero or less, 10–11% gaining 10+, 2.2% gaining 20+, 0.5% gaining 40+
  - the run plays meaningfully different from each other
- **G-2, deep passes:** too easy for a human today (about 60% completed against a real 35–40%, and 19% of throws gaining 20+ against 8–9%). Fix this while keeping big plays possible.
- **G-3, targets:** WR2 and TE matter. Fix the play designs so targets spread realistically, and so swapping cards changes outcomes.
- **G-4, turnovers:** no collapse at the top tier (elite on Legend: 4.9 points a game, 6.9% interceptions, turnovers on 31% of drives).
- **D-3, difficulty:**
  - Difficulty changes the AI's side only.
  - The AI QB is no longer superhuman (a 1.5 s release, 0.1% sacked on Legend).
  - Rookie is genuinely easy, Legend fair.
- **D-4, ties:** no ties decided off the field. Add overtime (a possession each) and a two-point try option.
- **Game shape:** about 23 points per team in AI-vs-AI simulation, about 2.1 points per drive, and about 57% of red-zone trips ending in a touchdown.
- **G-5, tackles:** tackles don't always end the play on first contact. Allow broken tackles by rating, and add gang tackles.

### P1: plays like football

- **D-2: you never play defense; the opponent's drives are invisible.** For SOLO matches, play defense on the AI's drives:
  - pick a defensive call from a small, real-feeling playbook (coverages, blitzes, situational calls)
  - before the snap, control one defender (the user picks or the game switches to the nearest defender)
  - tackle and swat timing
  - AI teammates execute the call
  - An "Auto-defend / Sim drive" option; the default is to play.
  - Online head-to-head keeps the simultaneous offense format.
- **D-1 and P-2: playbook depth.**
  - A real defensive AI mix: man/zone variety, blitzes, situational calls.
  - More offensive formations and plays (at least 3 formations, about 15–20 plays), with sensible suggestions based on down and distance.
- **Optional forgiving timing skill:** perfect release on bullets, a catch tap for contested catches (never forcing a drop), and a Big Hit ring.
- **Momentum:**
  - defensive On Fire after 2 straight sacks or a takeaway
  - star "zone" traits with visible triggers and knockouts that fire about 50% of the time
  - crowd pressure on solo road games only, with a reduced-motion version
- **Mobile pacing:** auto-advance plays, skippable celebrations, and quick sim for a drive.
- **G-6:** returns where they fit.
- **A-1: animation gaps** — the mocap cut and stiff-arm clips, QB drop, get-ups. Coordinate through your doc: animation is the players team's, but call their hooks when you need specific actions shown.

## Notes

- **Player looks and the player-drawing parts of `render.ts` belong to the players team.** You own the camera, field, HUD and everything else.
- **Shared files.** `Arcade.tsx` and `difficulty.ts` are shared with the nba team. Edit only NFL branches, in small hunks.
- **Record in your doc:** "Protocol bump needed: NFL draft 10→11, UT 11→12 because …".
- **Keep the audit's preserve list.**
- **Owner device checks:** the catch-run feel, the play-call panel on their phone, and defense controls.

## Owner decisions

Read the "OWNER DECISIONS (2026-11-09)" section at the end of BRIEF.md. It is binding and overrides this brief where they differ.
