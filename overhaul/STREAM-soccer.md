# Team soccer: football (soccer) that plays like the respected games, on a phone

Worktree `/home/user/ps-s-soccer`, branch `claude/studio-soccer`, port 5217. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` first.

## Why

This is the same owner request as the other sport teams: real-feeling play and stats, references from the mobile/console/PC games, mobile-first controls, smooth animation. The owner already asked for soccer aiming, shooting and passing touch-ups. The current aim/shoot/pass model (2026-11-02) is a base to keep and build on.

## Sources

- **`O/audit-soccer.md`:** read all of it.
  - Sections: S-1, §2 measured realism (2.1–2.3 tables), B-1 … B-6, C-1 … C-5, R-1 … R-3, V-1 … V-4, A-1/A-2, AI-1/AI-2, J-1 … J-4, U-1, performance, tests, preserve (§13), and the order of work (§14).
  - Harnesses: `O/audit-scripts/soccer_*` (`soccer_sim.ts` runs seeded matches; `soccer_human.ts` is the scripted human strategies, including the dominant no-skill run; `soccer_cam.ts`; `soccer_bend.ts`; `soccer_stuck.ts`).
- **`O/research-soccer.md`:** read all of it. It covers:
  - conversion by distance, computed from 70,426 StatsBomb shots
  - shot mix and on-target rates
  - keeper behaviour
  - passing and dribbling
  - mobile-first controls (references: FC Mobile, eFootball, Score! Hero and others)
  - skill moves, shot types (finesse, chip, driven, low), set pieces
  - camera practice in portrait
- **Code docs:** `docs/SOCCER-ENGINE.md` (with the 2026-11-02 release-tuning section), `docs/SOCCER.md`, the soccer lab at `?soccer-lab`, `scripts/audit_soccer_shots.ts`, `scripts/qa/soccer-lab.mjs` and `scripts/qa/soccer-app.mjs`.

## Scope

### P0: critical

- **V-1: the portrait camera shows only 16.9 m of the 68 m pitch width.**
  - Re-frame it so your passing options are on screen: a wider zoom with height-aware tilt, look-ahead in the direction of play, and off-screen teammate arrows/indicators at the screen edge.
  - The controlled player's name tag is never hidden behind SPRINT, and a wide overload never starts with your player off-screen.
  - V-2: near goal, stands must not eat 37% of the screen.
- **B-1: the dominant no-skill strategy** (sprint straight at goal and hold SHOOT at 16 m with no aim) scores 58.5% of counters, against the AI's 20%.
  - Defenders must close down, tackle and block.
  - Fouls must not be cheap to win: up to 30% of runs win a free kick or penalty today (R-3).
  - Sprinting must cost control and touch.
  - Measure with `soccer_human.ts` until skilled play clearly beats the no-skill run.
- **B-2: ratings act like a cliff** (1.7% vs 92.3%; `tackleWin` at `ratings.ts:115`). Make the curve smooth: better cards are better, never binary.
- **R-1: frozen ball.** A shot that stops short can't be touched and stops the clock, hanging the attack for up to 120 s. Make the ball always live or restartable; add a test.
- **R-2: parries into the goal** (14.3% of all goals; `engine.ts:1062`). Parry away from goal, and add the missing restarts (corners, goal kicks).
- **C-4: the free-kick BEND buttons are reversed.** Fix them and add a test.
- **V-3: HUD collisions.**
  - The first hint covers the goal and the aim reticle.
  - "FREE KICK" and "BEND" print over each other ("FBENDICK").
  - The opponent's penalty taker gets your yellow control ring.
- **J-3:** the opponent's goals throw confetti in your colours.
- **J-1:** the match plays the NFL crowd. Wire in the soccer sounds that exist but are unused. You own that wiring in `src/lib/sound.ts`.
- **C-5:** pause and quit (online quit means forfeit with a confirm).
- **A result screen** with a proper scoreline, scorers and a player of the match. A draw is a DRAW. The UT result sequence belongs to the ut team; you provide the match data.

### P0: realism (protocol bump: soccer draft + UT)

| Stat | Game today | Real football |
|---|---|---|
| Shots per side | 5 | 12–13 |
| On target | 53% | 33–35% |
| Converted | 20% | 10–11% |
| A player shooting from 30 m | 16–22% | ≤2% |

- Keep the realistic scorelines: about 2.3–2.7 goals a match and about 25% draws.
- **B-3: difficulty is flat or inverted.** The AI scores 1.17 a match on Rookie and Pro and 0.99 on Legend. Make difficulty a real ladder that changes the AI's side only.
- **B-4: no reward for aiming.** A deliberate corner aim must beat the assist (49% vs 40% the wrong way today) without making assist useless.
- **B-5 and B-6:** free kicks are a lottery; penalties are slightly too easy.
- Add seeded tests asserting each target within tolerances.

### P1: plays like football

- **S-1: you never defend, and the opponent is invisible.**
  - **Today:** every match is the same seven attack set-ups (`match.ts:52`), and the AI's attacks are simulated off-screen, with goals appearing silently in the scoreboard (`Soccer2.tsx:772`).
  - **For SOLO matches:**
    - Varied attack situations: build-up from the back, counters, wing play, set pieces.
    - Defending phases where the AI attacks and you control the nearest defender: switch player, jockey/contain, tackle/slide timing, and the keeper on one-on-ones.
    - The rival's goals come from those phases.
    - An "Auto-defend" option.
  - Online head-to-head keeps the current simultaneous format.
- **C-1 and C-3:**
  - Move sprint to the left thumb, and make the joystick floating.
  - Shot types: finesse, chip, driven/low, with a clear touch gesture. Keep the drag-to-aim and timing model.
  - Skill moves (at least 3) as swipes.
  - Dribble touches tied to dribbling rating.
- **AI-2:** the defending AI holds a shape, presses, and covers the shooting lane.
- **U-1:** the UT formation is cosmetic and most cards never play. The formation and all 11 cards matter: who appears in which attacks, and what the defensive shape is.
- **A-1: animation.** Left- and right-footed kicks, keeper dives, slide tackles, dribble touches, get-ups. This is coordinated with the players team, who own the player-drawing code; describe the actions you need in your doc and call their hooks.
- **J-2 and J-4:** juice and atmosphere: goal moments, net ripple, a scorer celebration, crowd swells, short commentary text lines.

## Notes

- **Player looks and the player-drawing parts of `render.ts` belong to the players team.** You own the camera, pitch, HUD, banners, engine, AI, ratings and controls.
- **Soccer has its own match flow** (`soccer2/arcade.ts`, `match.ts`), so you don't need `Arcade.tsx`.
- **Record in your doc:** "Protocol bump needed: soccer draft 2→3, UT 2→3 because …".
- **Keep the preserve list:**
  - the deterministic engine and ball physics
  - bounded ratings
  - realistic AI-vs-AI scorelines
  - the 2026-11-02 aim/shoot/pass controls with miss reasons
  - the keeper model, offside, and the shootout rules
- **Owner device checks:** the camera framing on their phone, sprint and stick feel, and defending controls.

## Owner decisions

Read the "OWNER DECISIONS (2026-11-09)" section at the end of BRIEF.md. It is binding and overrides this brief where they differ.
