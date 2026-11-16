# Arcade soccer engine ("Attacks", phase P2a)

> **Update (Claude, 2026-11-01):** soccer is now wired into the app as the third sport; see
> [SOCCER.md](SOCCER.md) for the app wiring, saves, queues, Ultimate Team and the set-piece tuning
> (which supersedes the set-piece rates quoted below). The "not wired" notes below describe the earlier phase.

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
| Joystick (left, fixed) | Two-axis run, screen-relative (up the screen is up the pitch), radial dead zone and release-to-stop: the NFL direct-control contract (`football2/controls.ts` reused). **Since 2026-11-02 it only runs in open play** (it no longer aims while SHOOT is held, so you keep your run). At a corner it picks the target; a free-kick or penalty taker (who can't run) can also aim with it. |
| SPRINT (hold) | Top speed instead of 80 %; drains shared stamina (bar under the player), refills when you jog. Sprinting with the ball costs 6 points of dribble control in tackles. |
| PASS (tap / hold) | Free and directional (2026-11-02): the ball goes the way the stick points. A teammate whose run is within 22° of that way (18° lofted, 30° through, 32° with the stick centred = the way he faces) pulls it gently toward him (fully when aimed right at him, not at all at the cone's edge); nobody there and it goes into space along the stick, weighted to be level with the nearest man that way, for whoever reaches it first. A dashed line on the grass shows where it's going (teal: a man's on it). Hold ≥ 0.22 s: lofted ball, a cross into the box from wide. The receiver runs onto the ball himself while the stick is centred or still held the way of the pass; move the stick off that way to take him over. |
| THRU | Through ball into the space ahead of a runner in the stick's way (the same gentle assist); he runs onto it. Forwards time runs in behind on their own; a pass to a man already past the second-last defender is offside. |
| SHOOT (hold, drag, let go) | The power meter arches over the shooter; the **green slice** sits at **0.62 s** (0.72 s before 2026-11-02). **Drag your thumb on SHOOT to aim**: left/right across the goal, up high, down low, a gentle snap toward the four corners (inside the posts); no drag = **aim assist**: the side the keeper leaves open as you see it, low, as far inside the post as your SHO allows. Accuracy is **continuous in the release**: tightest dead in the middle of the green, a little looser at its edge (PERFECT), looser again within 2.2 greens (GOOD), then EARLY (weak and low) or LATE (rises); no step at the slice's edge. A small goal over the meter shows the keeper and your aim dot with the ring a release now would have (it tightens toward the green); the reticle in the goal mouth is the same ring. Pressed while a pass is on its way it's a first-time volley or header (the drag counts). |
| After the shot | The meter stays a moment with the word for the release (PERFECT / GOOD / EARLY / LATE), and a miss says why: "STRAIGHT AT HIM · AIM FOR THE GAP", "LATE RELEASE · IT ROSE OVER", "EARLY RELEASE · NOT ENOUGH ON IT", "TOO FINE · AIM INSIDE THE POST", "BLOCKED · GET A YARD OF SPACE". |
| Field | Tap a teammate to pass to him; at a free kick swipe across to bend it (or use the BEND buttons). |
| Shootout, their kick | DIVE ◀ / STAY / DIVE ▶ before the kick (or trust your keeper's read). |
| Keyboard (QA) | Arrows/WASD run, Space shoot (hold; the arrows aim while it's held, centred = assist), J pass (hold: lob), K through, Shift sprint. |

## Aim and shoot, and free passing (Claude, 2026-11-02)

The owner's playtest of the live build: "the aiming and shooting needs touched up", then "the closer to
green the more accurate it is" and a passing touch-up that keeps passes free (no lock-on).

**What was wrong (measured, before):** while SHOOT was held the run stick also aimed, so the natural
input, still running at goal, aimed at the top centre of the goal, at the keeper: **0 %** of 300
one-on-ones went in that way (the browser playtest showed the same: `aim (34, 2.15)` on every run-in
shot). Aiming meant pulling the stick sideways or back, which steered the runner off his line or
stopped him; centring it stopped him dead. The 0.72 s wind-up at 75 % pace let a man closing down
tackle **47 %** of edge-of-box shooters before the strike. The aim ring sat tiny on the crossbar 30 m
away. From a tight angle the keeper ran straight at the ball and left the far post open (**68–83 %** of
wide-angle shots scored); keeper saves were judged where the ball crossed his y line, wrong for a shot
across him from near the byline. Accuracy was a step: ×0.55 inside the green, ×1.0 just outside. A miss
said only WIDE or SAVED. Passing locked onto the teammate nearest the stick's way: aimed 35° off a man,
**95 %** still went to *someone* (69 % to a different man), a through ball went to a different runner a
third of the time even when aimed at the right one, and a thumb still on the stick after the pass ran
the receiver away from a lofted ball (8 % cut out vs 2.5 % with the stick let go).

**Sources and the choice.** EA FC Mobile's Elite Shooting rests on manual aim, shot context and
attributes, keeps power shots "fully assisted" and gives finesse/chip as swipes *from the SHOOT
button* ([EA deep dive](https://www.ea.com/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive),
[FIFA Mobile controls guide](https://www.fifamobileguide.com/gameplay-controls)); EA removed console
Timed Finishing in FC 26 as a binary press that "lacked meaningful skill depth"
([Insider Gaming](https://insider-gaming.com/is-timed-finishing-in-ea-fc-26/)); Retro Goal's quick
shot trades aim for speed and its players complain the runner stops while they swipe
([Defector](https://defector.com/this-little-soccer-game-on-my-phone-is-fun-as-hell),
[user reviews](https://justuseapp.com/en/app/1535765855/retro-goal/reviews)); Score! Hero shows the
shot's path before it goes ([Pocket Gamer](https://www.pocketgamer.com/score-hero/review/)); console
aim assist uses magnetism/friction toward targets ([Insomniac, GDC](https://www.gdcvault.com/play/1017942/Techniques-for-Building-Aim-Assist))
and area-cursor/magnetism assists work best in studies (Vicencio-Moreira et al., CHI 2014); FIFA's
semi-assisted passing assists the power and only slightly the direction
([EA accessibility](https://www.ea.com/able/resources/fifa/fifa-22/ps4/customise-controls-settings)).
For one stick + buttons that gives: **aim on the SHOOT thumb (a drag), never on the run stick**; a
**visible assist** (the open side, low) when you don't drag, with a gentle area-cursor snap when you
do; **continuous timing**; a small goal by the meter and a reticle in the goal; **reasons** for misses;
passes **free** with a narrow, fading pull (semi-assisted style), a pass line, and receivers that run on.

**Engine changes** (`engine.ts`): `assistAim` / `openSide` (the angular gap the keeper leaves, slight
far-post lean, hysteresis so the reticle doesn't flicker; how fine it cuts it comes from SHO and range),
`snapAim`, `setAim` (the live drag; a first-time hit held at contact uses it), `AIM_X` 3.1 m,
`coneMult` / `timingMiss` / `timingWord` (continuous accuracy; late rises `8 × (off − 0.3·green)` m,
early drops and loses power continuously), `rangeCone`, a cone penalty for shooting across the body,
`shotVerdict` (the miss reason), `TOP` 0.62 s (wind-up pace 0.85, was 0.75). Keeper (`KEEP`): from a
tight angle (> 9 m wide) he narrows along the bisector instead of running at the ball; he gets set
(60 % pace) when he sees the backlift; he spreads (DIV) for a shot struck within 8 m; he dives toward
where the ball passes him (2-D, misread across its line) and saves are judged at that point; a long shot
he has time for he shuffles across faster; one-on-ones from 18 m (was 20). Passing: `passPlan` (free pass
with `PASS_ASSIST` cones), `pass(…, free)` (a person's; the autopilot and a corner's "stick picks the
man" keep the old pick), a PAS-scaled weight error on free ground passes, the lead solved from the
pass's own travel time, a pass into space goes to whoever reaches it first, a moving pass runs past a
teammate it isn't for, and the receiver runs onto it while the stick is centred or still held the way
of the pass (`receiving`). `SP_TUNE`: `penRead` 0.15 → 0.07, `fkCone` 4.2 → 3.0 (back in range after
the keeper changes). The autopilot aims in the old 3.3 m scale.

**Measured** with `npx vite-node scripts/audit_soccer_shots.ts 300` (seeded drills, a simulated
person: release timing spread 0.06 s, the thumbs as described; 75-rated sides; the same drills run on
the old engine with the old controls for "before"). 1v1 = through from 22–25 m, the keeper set, a
sprint in to 13–16 m; edge = 18.5–21.5 m with a man closing from 4 m; wide = 11–15 m off centre, 7–11 m
out; cross = a lofted ball from the wing met first time.

| Drill | Before | After |
| --- | --- | --- |
| 1v1, still running at goal (before: that aimed top centre; after: aim assist) | 0.0 % | 50.3 % |
| 1v1, aimed at the open corner (before: stick pulled him sideways) | 50.7 % | 49.0 % |
| 1v1, aimed at the keeper's side | 38.0 % | 17.3 % |
| Edge of the box, running / aimed | 5.0 % / 19.7 % (47 % tackled in the wind-up) | 32.3 % / 50.7 % (14–21 % tackled) |
| Wide angle, running / aimed | 67.7 % / 83.0 % | 13.7 % / 14.3 % |
| Cross met first time (stick still / aimed) | 25.3 % / 26.3 % | 25.0 % / 29.3 % |
| 1v1 by SHO 55 / 75 / 95 (aimed) | 35.7 / 51.3 / 66.0 % | 39.7 / 55.7 / 61.0 % |
| Edge by SHO 55 / 75 / 95 | 11.3 / 17.3 / 25.7 % | 28.7 / 50.7 / 81.7 % |
| 1v1 against keepers 52 / 75 / 93 | 71.7 / 51.3 / 38.0 % | 77.3 / 52.0 / 8.0 % |
| Edge against keepers 52 / 75 / 93 | 26.0 / 20.0 / 9.0 % | 65.7 / 46.0 / 4.7 % |
| 1v1 by timing spread 0 / 0.06 / 0.15 s | 56.7 / 52.3 / 38.7 % | 57.7 / 48.7 / 32.7 % |

Notes: the edge drill is a clean look (one man closing, nobody else); in matches the whole-attack rates
below are what counts. Elite keepers (all six stats 93) now dominate one-on-ones and long shots more
than before; a 93 is the top of the card range. Aim assist is about as good as a manual corner from
close in (it adapts to range and SHO), clearly worse from range; the drag's main job is choosing the
side and the height.

The autopilot's whole attacks (skill 0.75, 300 per scenario over three real matchups, before → after):
build-up 13.7 → 13.3 %, counter 10.7 → 10.3 %, wide 12.0 → 9.7 %, corners 13.0 → 11.7 %, free kicks
14.0 → 14.7 %, penalties 74.7 → 73.3 % (`setpieces.test.ts` keeps corners 6–14 %, free kicks 8–17 % with
direct ones 5–15 %, penalties 70–80 %).

Passing (build-up, the stick aimed at a teammate N° off his line, 200 each, before → after: to him /
to any teammate): 0° 99.5 / 99.5 → 98.5 / 98.5 %; 10° 98.0 / 98.0 → 81.0 / 96.5 %; 20° 80.5 / 98.0 →
56.5 / 96.0 %; 35° 26.5 / 95.0 → 9.5 / 67.5 % (it now goes where you pointed: 18 % cut out, 14.5 %
loose); a through ball aimed at a runner reaches him 67.0 → 97.5 %; a lofted ball with the thumb still on
the stick is cut out 8.0 → 2.5 %; PAS 50 / 75 / 95 cut out 4.0 / 1.5 / 0.0 → 4.0 / 3.5 / 0.5 %.

Tests: `shooting.test.ts` (assist and snap deterministic and on the open side; cone, miss distance and
goal rate monotone in |release − green|; higher SHO scores more, a better keeper concedes fewer; free
passes go the stick's way with a fading pull; the receiver runs on; a shootout kick goes where it's
dragged), plus the existing `soccer.test.ts` and `setpieces.test.ts`.

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
| SHO | shot error cone (1 sd); since 2026-11-02 × `coneMult`: 0.5 dead centre, 0.85 at the green's edge, 1.3 at two greens, ≤ 3.2; × `rangeCone` 1 → 2 from 12 to 26 m; ×1 → 1.5 across the body | 5.5° → 1.3° |
| SHO | how far inside the post aim assist goes (two cones' worth, 0.7–1.6 m) | wider → finer |
| SHO | green window half-width | 0.028 → 0.085 s |
| SHO·PHY | shot speed at full power | 21 → 31 m/s |
| PHY·SHO | header speed, jump reach, aerial duels | 10 → 17 m/s; height + 0.35 → 0.75 m |
| DEF vs DRI | tackle win (logistic over the gap, PHY ±, sprinting −6, difficulty +5) | bounded 10–90 % |
| DEF | interception reach and chance, shot blocks, read delay | 0.55 → 1.05 m; 0.24 → 0.07 s |
| GK REF | reaction to a strike; misread of the shot (1 sd) | 0.30 → 0.12 s; 0.7 → 0.18 m |
| GK DIV | dive carry and time; hands beyond the body | 1.05 → 1.85 m in 0.60 → 0.42 s; 0.85 → 1.15 m |
| GK HAN | hold rather than parry (less for hard, stretched, high shots) | 38 → 86 % base |
| GK POS | standing off the angle's bisector (1 sd) | 1.3 → 0.12 m |
| GK DIV | spreading himself, a shot struck within 8 m of him (2026-11-02) | 1.05 → 1.25 m half-width |
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
- Sounds: soccer's own ground (`sound.ts` venue `'pitch'`, loaded when the match mounts: its chant
  bed, roar, kicks, bounce and full-time whistle), swells on plays, the crowd building as the ball
  nears goal, ooh on saves and the woodwork, groans, tackles (the NFL stadium bed until 2026-11-10).

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
| `src/game/soccer2/soccer.test.ts`, `setpieces.test.ts`, `shooting.test.ts` | tests |
| `scripts/audit_soccer_shots.ts` | the shooting/passing audit (drills with a simulated person, autopilot rates) |
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

### Release tuning (Claude, 2026-11-02)

Before merging, elite ratings swung too far: a 93 keeper stopped 91% of one-on-ones and a 95
finisher scored 85% from the edge of the box. Changed: `shotCone` floor 1.3° → 1.6° (SHO 99),
`gkMisread` floor 0.18 → 0.30 m, `gkPositionError` floor 0.12 → 0.35 m, the close-range spread
`KEEP.spread` [1.05, 1.25] → [1.0, 1.12], and `rangeCone` now grows faster (x2 at 20 m, capped at
x2.25). `scripts/audit_soccer_shots.ts 200 shots` (75 sides unless noted): 1v1 running 62%, edge
running/aimed 38/44%, 1v1 vs keeper 52/75/93 = 81/60/27%, 1v1 by SHO 55/75/95 = 44/62/68%.
Soccer tests 74/74.

### Studio overhaul soccer-1 (Claude, 2026-11-10)

Rule bugs, with the guards that hold them (team doc: `docs/studio-overhaul/soccer.md`; the
before/after numbers are there):
- **Dead shots (R-1).** A `'shot'` or `'parry'` flight that rolls slower than `DEAD.speed` (3 m/s)
  below `DEAD.h` (0.3 m), or has bounced `DEAD.bounces` (2) times, becomes a `'clear'` from whoever
  touched it last (`deadShot`, event `'shot-dead'`): anyone can play it and the keeper drops his read
  of it. The attack's clock runs whenever the ball is slower than 3 m/s, shot or not. Before, a weak
  shot or header that stopped short stayed a "shot" nobody could touch and froze the clock until the
  120 s hard stop (25 of 3,000 real-squad attacks; now 0, and no attack runs past its clock + 15 s).
  A ball the keeper last touched that rolls over the byline is still his save ("SAVED · TURNED ROUND").
- **Untaken set pieces.** A set piece a person leaves goes to the autopilot's taker after
  `SET_PIECE_WAIT` (12 s of match time, `match.ts`), with an "AUTO KICK IN 5…1" countdown over the
  last five seconds (`setPieceCountdown`); shootout kicks too. The AI takes its own in about a second.
- **BEND (C-4).** `bendCurl(k)` turns the button's arrow (k −1 left, 0, 1 right) into curl
  (`-0.75k`: + bends the ball to its left); the buttons used `k * 0.75` and bent against their arrows.
  The swipe (`-dx/140`) always agreed with `bendCurl`. BEND buttons are 44 px tall.
- **Sounds (J-1).** `'bounce'` (render-only; nothing in the engine reads events) when the ball comes
  down hard enough to bounce (`sfx.bounce`); the crowd level follows the ball's distance to goal
  through `crowd.level` (0.24 at 35 m+ to 0.5 at 12 m, at most four times a second, never over a
  swell that is still settling).
- **Confetti (J-3)** comes out in the scorer's kit (the rival's goals threw yours), and not at all
  with reduced motion.
- **Guards:** `golden.test.ts` (a hash of 60 seeded attacks with their whistle and post-whistle
  state, 20 `aiProgress` matches and 50 agreed shootouts: presentation work must leave it alone),
  `agreement.test.ts`/`agreement-ut.test.ts` (both phones' views of takeover, taken and `simBoth`
  over 500 seeds, the agreed shootout mirrored over 1,000), `rules.test.ts` (the rules above).
  `aiProgressFor(…, { rival, online })` in `arcade.ts` is the one door to the AI's simulations.
- **Harnesses:** `scripts/soccer/` (`sim`, `human`, `ratings-human`, `probe`, `bend`, `cam`; run with
  `npx vite-node scripts/soccer/<name>.ts [n] [part]`); browser QA isolation, insets and the six
  device presets in `scripts/soccer/qa-isolate.mjs`; an in-process QA relay in `scripts/soccer/relay.mjs`;
  the lab's `start=x,y` puts the man on the ball at a spot.
