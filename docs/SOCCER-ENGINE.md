# Arcade soccer engine ("Attacks", phase P2a)

**Implemented by Claude (Anthropic), 2026-11-01, branch `claude/soccer-data`.** A playable,
self-contained soccer match engine in `src/game/soccer2/`, built on the conventions of the football
and basketball engines (fixed 60 Hz steps, pixel/mocap players under the perspective camera, the
shared HUD materials). It is **not wired into the app yet**: no `SportId`, profile, UT, draft, queue
or online change. It runs only in the dev-only lab (`?soccer-lab`, below). No saves, keys, card ids,
serials or NBA/NFL ratings change; online queues stay NBA 8 / NFL 9. Card data comes from
`docs/SOCCER-DATA.md` (phase P1).

## The format

- A match is **six attacks per side (three a half) plus one in stoppage time** (`match.ts`). Each
  phone plays its own attacks against the other side's defense, as in football's drives; the AI's
  attacks are played by the autopilot (`aiAttacksOf`). Most goals wins; **level → a penalty
  shootout** once the rival's score is final (five kicks each, best finishers first, then sudden
  death; `shootout.ts`).
- Each attack is a **scenario dealt from the seed**: build-up (6 v 6 from the halfway line),
  counter-attack (the front three break on two centre-backs, two midfielders chase back), wide
  overload (winger, overlapping full-back and a midfielder on one flank), corner, free kick (wall of
  four within 30 m), and stoppage time (a counter or a wide overload, 15 s). A **penalty** comes from
  a foul in the box (a mistimed tackle can be a foul: in the box a penalty, near the box a free kick,
  elsewhere advantage).
- **30 seconds of open play** per attack (set pieces before the kick and shots in the air don't
  use the clock). Results: **G** goal, **S** saved (held, parried out, claimed, smothered), **W** wide
  or over, **B** blocked (a body or the wall), **L** lost (tackled, intercepted, headed clear, out of
  play), **O** offside, **T** time.

## Controls (portrait first; landscape works with the same layout)

| Control | What it does |
| --- | --- |
| Joystick (left, fixed) | Two-axis run, screen-relative (up the screen is up the pitch), radial dead zone and release-to-stop: the NFL direct-control contract (`football2/controls.ts` reused). While SHOOT is held it aims: left/right across the goal, up high, down low; centred = the far side from the keeper, low. At a corner it picks the target; at a set piece it aims. |
| SPRINT (hold) | Top speed instead of 80 %; drains shared stamina (bar under the player), refills when you jog. Sprinting with the ball costs 6 points of dribble control in tackles. |
| PASS (tap / hold) | Tap: along the grass to the teammate the stick points at (ring + name shown). Hold ≥ 0.22 s: lofted ball, a cross into the box from wide or from a corner. |
| THRU | Through ball into the space ahead of a runner; he runs onto it. Forwards time runs in behind on their own; a pass to a man already past the second-last defender is offside. |
| SHOOT (hold, let go) | The power meter arches over the shooter; the **green slice** sits at 0.72 s. Let go in it for a perfect strike (tight cone, full power); early is weak and low, late rises over the bar. Pressed while a pass is on its way, it is a first-time volley or header. The ring in the goal mouth is the shot's error cone. |
| Field | Tap a teammate to pass to him; at a free kick swipe across to bend it (or use the BEND buttons). |
| Shootout, their kick | DIVE ◀ / STAY / DIVE ▶ before the kick (or trust your keeper's read). |
| Keyboard (QA) | Arrows/WASD, Space shoot (hold), J pass (hold: lob), K through, Shift sprint. |

## Physics (`engine.ts`)

The ball is 2.5D (x across, y up the pitch, h height), stepped at 60 Hz (path predictions at 120 Hz):
gravity 9.81 m/s²; air drag a = 0.013·v² (a match ball: ½ρC_dA/m ≈ 0.013); grass rolling
resistance 1.4 m/s² plus 80 % of drag; bounce keeps 55 % vertical / 80 % horizontal; spin (curl)
pushes sideways ∝ speed and decays; a struck free kick carries 5 m/s² of topspin dip so it can get
over the wall and come down. Ground passes are solved analytically for the speed that covers the
distance under that resistance; lobs and shots are solved by simulating the same physics (a shot
crosses the goal line within 0.3 m of its aim before the shooter's error). Goal frame 7.32 × 2.44,
posts and bar rebound the ball; the net catches it.

## How ratings play (bounded; promos above 99 get a capped extra, finite for any value)

`ratings.ts` maps each card face stat with `rt(v) = clamp((v−40)/59, 0, 1) + min(11, v−99)·0.009`
and a lerp between two marks. All effects are exported and the tests use the same functions.

| Rating | Effect | 40 → 99 |
| --- | --- | --- |
| PAC | top speed (jog = 80 %) | 6.8 → 9.4 m/s |
| PAC·DRI | acceleration | 9 → 15 m/s² |
| DRI | pace kept with the ball; first touch on hard passes; tackles against | 0.88 → 0.97 of top speed |
| PAS | pass direction error (1 sd; ×1.35 under pressure, ×1.15 sprinting) | 7° → 1.5° |
| SHO | shot error cone on a green release (×0.55 green, up to ×3 off it) | 5.5° → 1.3° |
| SHO | green window half-width | 0.028 → 0.085 s |
| SHO·PHY | shot speed at full power | 21 → 31 m/s |
| PHY·SHO | header speed, jump reach, aerial duels | 10 → 17 m/s; height + 0.35 → 0.75 m |
| DEF vs DRI | tackle win (logistic over the gap, PHY ±, sprinting −6, difficulty +5) | bounded 10–90 % |
| DEF | interception reach and chance, shot blocks, read delay | 0.55 → 1.05 m; 0.24 → 0.07 s |
| GK REF | reaction to a strike; misread of the shot (1 sd) | 0.30 → 0.12 s; 0.7 → 0.18 m |
| GK DIV | dive carry and time; hands beyond the body | 1.05 → 1.85 m in 0.60 → 0.42 s; 0.85 → 1.15 m |
| GK HAN | hold rather than parry (less for hard, stretched, high shots) | 38 → 86 % base |
| GK POS | standing off the angle's bisector (1 sd) | 1.3 → 0.12 m |
| GK SPD | coming off the line, smothering one-on-ones | 5.6 → 7.6 m/s |
| GK REF·POS | reading a penalty | 36 → 50 % right way |

Difficulty (`defIQ`, −0.5…1, as `difficulty.ts`) sharpens defenders' reads and tackles and narrows
the green slightly; it never changes a card.

**Measured** (seeded drills in `soccer.test.ts`, re-run for these numbers; synthetic 75-rated
teams, one stat varied):

| Drill | Low | Mid | High |
| --- | --- | --- | --- |
| Shot from 21 m aimed at the post, ±0.09 s timing spread: goal rate by SHO 55 / 75 / 95 | 14.7 % | 21.3 % | 46.3 % |
| Same shots against keepers 52 / 75 / 93 (all GK stats): save rate | 16.7 % | 35.0 % | 55.0 % |
| Counter, defender 3 m behind (PAC 76): winger PAC 58 / 80 / 95 caught in 4 s; metres gained | caught, 10 m | caught, 22 m | never, 33 m |
| Ground pass mean direction error by PAS 50 / 75 / 95 | 5.2° | 3.3° | 1.8° |

Whole attacks with the autopilot (skill 0.75), 80 per scenario: Barcelona 2014-15 against Real
Madrid 2016-17 score on 21 % of build-ups, 25 % of counters, 19 % of wide overloads, about a third of
corners and free kicks and 79 % of penalties; Everton 2015-16 against Liverpool 2018-19 (Alisson,
van Dijk) on 7–9 % of open-play attacks. A good human gets more than the autopilot.

## Drawing (`render.ts`, `pixel/pitch.ts`)

- `pixel/pitch.ts`: the pitch as a top-down texture (8 texels/m) for `persp.ts`' row-by-row floor:
  mowed stripes, all markings (both boxes, six-yard boxes, spots, arcs, centre circle, corner arcs),
  run-off, boards and fans along the touchlines, the far stand behind the goal (persp.ts' stands
  wall, now exported with its texture helpers).
- The camera is `persp.ts`' broadcast camera behind the attack, following the ball with the goal in
  view near the box; corners pull back toward the flag.
- Players are the existing rig with the CMU motion-capture clips (`ready`, `jog`/`run`/`sprint`
  gait matched to speed, `kick` timed to the strike, `dive` for slide tackles and keeper saves,
  `jump` for headers and the wall, `fall_forward`, `catch`, `celebrate`, `backpedal`). `pixel/body.ts`
  gains a `soccer` look (short sleeves, shorter shorts, socks to the knee, keeper's long sleeves and
  gloves); NBA/NFL looks are unchanged.
- Kits (`kits.ts`): club identity colors only, the rival changes into an away set on a clash
  (`uniforms.ts`' clash test), keepers in a color neither side wears. No crests or real kits.
- Goal frame with back/side/roof nets (the net bulges where the ball went in), ball with shadow
  and panels, the controlled player's ring, name (under his feet, not over the ball) and stamina,
  the pass target ring, the shot meter arch (hoops2 style) and the aim ring sized by the error cone,
  free-kick bend arrow, turf and confetti, and an instant replay of goals.
- Sounds reuse the existing samples: kick, whistle, the stadium crowd bed and swells, roar on a
  goal, ooh on saves and the woodwork, groans, tackles.

## Files

| File | What |
| --- | --- |
| `src/game/soccer2/types.ts` | players, squads, bodies, ball, attack state |
| `src/game/soccer2/ratings.ts` | `rateSoccerLine`, `soccerLines`, `clubSquad`/`squadFrom` (best 4-3-3), every rating effect |
| `src/game/soccer2/engine.ts` | ball physics and solvers, set-ups per scenario, controls API (`pass`, `pressShoot`/`releaseShoot`, `setSprint`, `setCurl`), defenders, keeper, tackles/fouls, offside, `step`/`settle` |
| `src/game/soccer2/autopilot.ts` | the AI on the ball (same controls as a person) and `autoplayAttack` |
| `src/game/soccer2/match.ts` | match flow, deal, minutes, `autoplayMatch`, `aiAttacksOf` (Arcade-style progress) |
| `src/game/soccer2/shootout.ts` | shootout rules and `simShootout` |
| `src/game/soccer2/render.ts`, `kits.ts`, `soccer2.css` | drawing, kits, HUD styles |
| `src/game/soccer2/Soccer2.tsx` | the component (Football2.tsx conventions: `onProgress`/`onDone`, `rival`, `autoplayHook`, `timeScale`) |
| `src/game/soccer2/Lab.tsx` | dev-only lab |
| `src/game/pixel/pitch.ts` | pitch texture |
| `src/game/soccer2/soccer.test.ts` | tests |
| `scripts/qa/soccer-lab.mjs` | browser QA |

Small additive changes outside: `pixel/body.ts` (`soccer` look, gloves slot), `pixel/persp.ts`
(exports `levels`, `standsWall`, `skyRamp`), `main.tsx` (dev-only lab route).

## The lab (dev only)

`npx vite --port 5187`, then `http://localhost:5187/?soccer-lab`. Parameters: `home=BAR&hs=2015&away=RMA&as=2017`
(club codes and season end years from the card file), `seed`, `auto` (autopilot), `slowmo=0.3`,
`attacks=N`, `scenario=corner` (deal only that), `pens` (straight to penalties), `tie` (rival's final
score made level, to reach a shootout), `def=-0.5..1`, `qa` (exposes `window.__soccer`). `main.tsx`
gates both the flag and the dynamic import on `import.meta.env.DEV`, so production builds contain
neither the engine nor `cards-soccer.json` (verified: no soccer chunk or card data in `dist/`).

## Tests and QA

- `src/game/soccer2/soccer.test.ts` (20 tests, ~14 s, runs under both `PS_SPORT`s): ball physics
  (a lob lands and settles, ground-pass distance, lob landing and shot crossing within tolerance,
  curl direction); every card line rates finite and in range, real elevens build; effect directions,
  bounds and above-99 finiteness; fast vs slow winger, elite vs poor finisher and keeper, passer
  accuracy, better team scores more over seeded matches; determinism (same seed and inputs replay
  exactly); every scenario ends with valid letters and finite values (150 attacks, all
  difficulties), an idle human attack times out; whole autopilot matches; shootout rules
  (can't-catch-up stop, sudden death, taker order) and deterministic simulated shootouts; the AI
  takes penalties.
- `scripts/qa/soccer-lab.mjs` (Playwright, Chromium, 390×844 and 320×568 portrait, touch via CDP
  `Input.dispatchTouchEvent`): kickoff card, two-finger stick + SPRINT run (measured: forward moves
  up the pitch, right moves across, release stops), shot meter, a whole autopilot match to full
  time with a goal, the corner/free-kick/counter/wide set-ups, a full shootout with touch aiming and
  keeper dives; zero page errors; median frame 16.7 ms (60 fps) in headless Chromium.

## What remains for app wiring (phase P2b)

- `SportId`/`UtSport` 'soccer', a typed `pick({nba, nfl, soccer})` for the sport branches,
  `engine/sport.ts`, profiles (additive `perfect-season:profile:soccer:v1`), recovery/cloud snapshot.
- `Arcade.tsx`: mount `Soccer2` for soccer, `POINTS` for `G` (1) and the other letters (0), a
  draw-aware result and the shootout result on the wire (the component reports it via
  `onShootout`), the AI's attacks via `aiAttacksOf`; a soccer online queue/protocol of its own.
- UT: soccer card registry (cards.ts glob), pool, squads/formations and chemistry, lazy loading of
  `cards-soccer.json` and per-sport precache, draft cells from `soccer.json`, season sim with draws.
- Optional extra sounds (Mixkit goal roar 3022, chant bed 438, kicks 2108/2112, bounce 2077, long
  whistle 614) through `scripts/build_sfx.py`.
- Physical iPhone feel (two-thumb play, meter timing) needs an owner playtest; Chromium can't judge it.
