# Team nba: basketball that plays like the respected games, on a phone

Worktree `/home/user/ps-s-nba`, branch `claude/studio-nba`, port 5215. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` first.

## Why

The owner says: "make it play better stats feel more legit more like how there respected sports game plays so find all aspects dont miss them … use the mobile version and console and pc versions … the game play unique that makes people like them … this is a mobile game so controls have to be good for it … make sure the games loads runs and has animations".

## Sources

- **`O/audit-nba.md`.** Read all of it: NBA-01 … NBA-26, §4 rating-to-outcome curves, §5 AI, §11 unfair/confusing, §12 preserve, and §13 order and protocol notes.
  - Its harnesses are in `O/audit-scripts/` (`nba-box.test.ts`, `nba-curve.test.ts`, `nba-conc.test.ts`, `nba-anim.test.ts`, `nba-*.cjs`). Copy them into your worktree under `scripts/audit/` or a test, and use them for before/after numbers.
- **`O/research-basketball.md`.** Read all of it:
  - shot timing and window sizes for touch
  - the moving green window
  - post-shot feedback
  - touch controls
  - move tiers and burst pips
  - three play cards
  - shooting fouls and free throws
  - fast breaks
  - rebound timing
  - Heating Up / On Fire
  - hot and cold zones
  - per-16-possession calibration targets and the era table
  - UT mode ideas
  - box-score usage split
- **Code docs:** `docs/ARCADE-V2.md`, `docs/CORE-GAMEPLAY.md`, `docs/GAMEPLAY-RATINGS.md`, `docs/GAMEPLAY-RESEARCH.md`, plus the existing tests in `src/game/hoops2/*.test.ts`.

## Scope

### P0: bugs and controls (no protocol impact unless noted)

- **NBA-08: the HUD shot clock freezes.** Update it every tick, and warn at 5 s (flash plus tick sound).
- **NBA-12: a thumb already on the stick at tip-off is ignored for the whole possession.**
- **NBA-13 and NBA-17: layout.**
  - Small phones (375×667, 320×568) hide the handler under the buttons.
  - The SCREEN / CUT / SPACE coach calls sit about 600 px from either thumb.
  - The skill buttons are on the shooting thumb.
  - Redesign the control layout for thumbs:
    - a floating left stick with a 12% dead zone
    - a big hold-to-shoot button, tap for a pump fake, swipes off it for moves
    - tap a teammate to pass
    - calls reachable
    - nothing over the ball handler
  - Test at 393×852, 375×667 and 320×568, in portrait and landscape.
- **NBA-14 and NBA-15: release timing.**
  - Measure release from the touch event timestamp, not the 60 Hz tick.
  - Make the green window drawn at its true size and position. Use the research's touch-friendly sizes (about 70–85 ms for an elite open shooter, 45–55 ms average, 10–12 ms smothered).
  - The window moves later with fatigue and fades.
  - Seven-step timing feedback, plus the coverage and the main reason for a miss.
  - A "PERFECT" release must be clearly good. Design how contest still matters, and state the targets.
  - Optional meter-off mode (+10% window).
  - Changing the shot make model is a protocol bump.
- **NBA-09 and NBA-10:**
  - Pause and quit in every match. In online matches, quit means forfeit with a confirm.
  - An end-of-game box score with player of the game, built from the real per-player events.
- **NBA-20 and NBA-21: camera and HUD.**
  - Don't hide the on-ball defender behind your own man.
  - Don't pan the shooter under the buttons.
  - De-stack the pile-up near the rim.
  - Keep banners off the rim.
- **NBA-22: the pixel font.** Support accented letters (Jokić, Dončić) and "&".
- **Haptics:** distinct patterns for a make, a green, a block and a turnover, where the platform allows.

### P0: stats feel legit (protocol bump: NBA draft + UT)

Calibrate to the research's per-16-possession targets for 2024-25, with era scaling from its era table.

| Stat | Target per 16 possessions |
|---|---|
| Points | 18.3 (1.145 per possession) |
| Shots | 14.4 |
| Threes | 6.0 |
| Free throws | 3.5 |
| Turnovers | 2.3 |
| Offensive rebounds | 1.8 |
| Assists | 4.3 |

- **NBA-01: free throws.** Add shooting fouls and a free-throw meter sized by the player's FT rating. Add and-ones and late-game intentional fouls if they fit.
- **NBA-02: efficiency.** Mid-range should go in about 42%, not 65%. Team eFG should be about 54.7%, with the real shot-zone mix.
- **NBA-03: usage.** Stars must take and make a star's share, split by each player's real usage.
  - The AI must stop shooting 83% threes with 89% heavily contested.
- **NBA-04: turnovers.** About 12% of possessions across difficulties, not 6.6% on Pro and 18% on Legend; human drives must not be brutal.
- **NBA-05: eras.** Eras must play in the right order: modern teams shoot the most threes.
- **NBA-19 and §5: difficulty.** It must only change the AI's side. Make Rookie/Pro/Legend a real ladder.
  - A simple human tactic must stop being far worse than the AI (0.4–0.9 points per possession against 1.17–1.28).
- **NBA-06: no hidden-rating tiebreaks.** Ties go to overtime possessions, never to a hidden squad rating.
- **Prove it** with seeded box-score tests (thousands of possessions) asserting the targets within tolerances, and keep `ratings-matter.test.ts` meaningful.

### P1: the game format plays like basketball

- **NBA-07: play defense too.** Today it's offense-only, and the rival's score is precomputed (`Arcade.tsx:196, 243-250`). For every SOLO match (UT Squad Battles, Cups, Club Season, Moments, Gauntlet, and draft season/playoff games against AI), alternate offense and defense.
  - On defense you control one defender:
    - a stick to move
    - SWITCH to the nearest man to the ball
    - STEAL (a timing risk that can foul)
    - CONTEST/BLOCK (a jump timing)
  - AI teammates defend sensibly.
  - The AI offense uses the existing autopilot logic and the rival's cards.
  - The rival's score comes from those possessions, not a precomputed number.
  - Provide an "Auto-defend" toggle and a SIM button per possession for players who want speed. The default is to play.
- **Online head-to-head keeps the simultaneous offense race.** Two humans can't share live defense over relays. Make sure nothing breaks it.
- **Game length:** about 4–6 minutes for a solo game. Tune the possession counts.
- **Fast breaks:** about 15% of possessions start in transition, worth about 1.2–1.3 points each.
- **Heat and runs:** two visible stages, "Heating Up" after 2 makes and "On Fire" after 3, plus a team "RUN" banner after 3 straight scores. Hot and cold zones per card from real era-adjusted splits, shown subtly.
- **Three play cards before a possession** (as football has), plus defensive looks (drop, zone).
- **Rebounds:** BOARD timing with a green flash.
- **Moves:** three power tiers by ball handling, three burst pips per possession, and every move cancellable after about 150 ms.

## Notes

- **Player looks and the player-drawing parts of `render.ts` belong to players.** You own the camera, court, HUD, banners, controls, engine, AI and ratings. Keep `render.ts` hunks local.
- **Determinism.** Seeded RNG only. Online play must stay deterministic and identical on both phones.
- **Record in your doc:** "Protocol bump needed: NBA draft 10→11, UT 10→11 because …".
- **Keep §12's list:** the deterministic engine, physical rebounds, the recorded jump shot, the rating tests, landscape, and the render-only effects layer.
- **Owner device checks:** thumb reach on their phone, green-window feel, and defense controls.

## Owner decisions

Read the "OWNER DECISIONS (2026-11-09)" section at the end of BRIEF.md. It is binding and overrides this brief where they differ.
