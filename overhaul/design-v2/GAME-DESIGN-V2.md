# Perfect Season: Game Design V2 (the design bible)

**Status:** design, 2026-11-16. Nothing in any repo was edited. Written by the lead game designer for the owner and the seven build teams (shell, ut, packs, players, nba, nfl, soccer).

**How to read the labels.** Every claim is tagged where it matters:
- **[audit X]** = measured in our own game (`audit-nba.md` NBA-nn, `audit-nfl.md` C/P/G/D/F/A/V-n, `audit-soccer.md` S/B/C/R/V/A/AI/J/U-n, `audit-likeness-animation-perf.md` L/A/P-n, `audit-ut-ui.md`, `audit-packs-promos.md`).
- **[research X §n]** = from the research files (basketball, football, soccer, likeness-animation, ultimate-team).
- **[plan team-n]** = already in a team's 10-task plan; V2 keeps it.
- **[new]** = invented here. These are design decisions, not measured facts, and every number in them is a starting value to be fitted in the build.

**What binds this document.** BRIEF.md's hard constraints and the six owner decisions: mode names stay; defense is played by default in solo games; a solo game takes 4–6 minutes; pack odds are realistic with protection; cards are re-rated accurately; the iPhone top-edge fix ships early. Coins only. Deterministic seeded engines. A 390 px portrait frame. Touch only.

**What the owner said (latest):** the gameplay is "pretty bad: animations, movement, buttons and all"; the art and players "don't look how they should"; there is no "addictive hook that makes players wanna keep playing forever"; it needs "a freshen up to keep it lively"; and they want "a leaderboard tracker for time played" with "time played rewards" that are "worth it".

The seven existing plans already fix most measured defects. They are repair plans. They do not yet give the game **an identity, a feel, a look or a reason to come back**. V2 adds those four things and re-orders the work so the first release feels dramatically different.

---

## A. The pitch

### A.1 One sentence

**Perfect Season is the five-minute sports game where every touch can be PERFECT: one gold timing ring shared by basketball, football and soccer, played with real stars from every era who look and move like themselves.**

### A.2 Why this and not a smaller 2K

| Game | What it is loved for | What it cannot be on our terms |
|---|---|---|
| NBA 2K / Madden / EA FC (console) | depth, likeness, signature motion [research likeness §0.1] | 40-minute games, two sticks and eight buttons, paid packs |
| 2K Mobile / FC Mobile / Madden Mobile | collection and short sessions [research football §0.12] | auto-play beats the player, stamina timers, pay-to-win [research basketball §0.9, football §4] |
| Retro Bowl | one great touch verb (the slingshot), 4.8★ from 937K ratings [research football §5] | offense only, one sport, no real players, repetition complaints |
| Hoop Land | pixel players who "each have a distinct look", easy to learn, hard to master [research basketball §3.2] | one sport, no card collection |
| NBA Jam / NFL Blitz | one big memorable hook: ON FIRE [research basketball §0.11, football §0.14] | no depth |

Nobody offers **three sports, one control grammar, real stars across eras, offense and defense in five minutes, with no money and no timers**. That is our lane. The identity has five pillars.

### A.3 The five pillars

1. **PERFECT is the verb. [new]** Every skill moment in every sport uses the same visual: a **gold ring** that closes on the thing you are timing (the shooter's feet, the tackler, the ball at the keeper). Release on gold and the game says PERFECT, plays the same two-note chime and guarantees the best outcome that the situation allows. **Gold never lies**: if a perfect cannot be guaranteed, the ring is drawn amber and no gold is offered (this is the fix for NBA-15, "PERFECT shots miss"). Learn it once in basketball and you can already play football and soccer.
2. **HEAT. [new, built on existing On Fire code in football2 and research basketball §5.8]** Perfects and good plays fill a team Heat bar: HEATING UP at two thirds, ON FIRE when full. On Fire widens every gold ring by a fixed, published amount for a short spell and sets the ball alight. One hook, three sports, always visible.
3. **Stars feel like stars.** A star's gold ring is visibly bigger in his signature skill, his sprite is recognisable at 40 px, he moves in his own way, and the game calls his name. The rating is something you see and feel in your thumbs, not a number on a card.
4. **Five-minute legends.** A full solo game, offense and defense, takes 4–6 minutes (owner decision 3) and always ends in a **Clutch** phase that is staged like a broadcast final minute.
5. **Chase the perfect season.** The name is the long hook. Every match is graded, flawless stretches are celebrated, and the Home screen's 38–0 fantasy becomes a visible campaign. The loop rewards you generously, says when you are done for the day, and never sells or rations play.

### A.4 The feel, per sport

| | Identity line | Feel words | The signature moment |
|---|---|---|---|
| **NBA** | **Rhythm hoops.** Find the beat, hit the gold. | bouncy, snappy, loud | the catch-and-shoot PERFECT with a net snap and a two-frame hit-stop |
| **NFL** | **Sling and smash.** Read it, sling it, break one tackle. | tense, then explosive | the slingshot release into a PERFECT juke that leaves a tackler on the turf |
| **Soccer** | **One-touch flow.** Pass, move, finish. | smooth, wide, sudden | a through ball into a first-time PERFECT finish, net bulge, crowd |
| **Whole game** | **Every touch can be perfect.** | crisp, generous, readable | the gold ring, the chime, the word PERFECT |

### A.5 The shared control grammar [new; consolidates plan nba-3, nfl §6, soccer §5.8]

All three sports use the same hands, so the owner's "buttons" complaint is answered once.

- **Left thumb = a floating stick.** It appears under the thumb anywhere in the left zone. A thumb already resting there before the whistle is live at the whistle (fixes NBA-12, NFL C-1's late thumb, soccer C-1.3). **Pushing past the ring is sprint/burst** in every sport, so sprint never costs the right thumb (fixes soccer C-1.4).
- **Right thumb = one big action button A, one medium B, two small C and D.** A is always "the timed thing" (SHOOT, THROW/JUKE, SHOOT/TACKLE). Its position never changes between sports or between offense and defense.
- **Swipes start on A.** A swipe off A is a move or shot variant. There is no invisible full-screen swipe layer (fixes NBA-17).
- **Tap a teammate on the field = pass to him**, in all three sports.
- **At most four right-thumb targets at any moment**, none in the top two thirds of the screen (fixes NBA-13's coach calls 600 px from the thumbs, NFL C-3's ten-button panel).
- **Everything fires on touch-down**, never on touch-up, except a deliberate hold-and-release.

**Exact geometry (CSS px, origin top-left). [new]** `sat`/`sab` are the safe-area insets.

| Element | 393×852 (insets 59/34) | 320×568 (insets 20/0) | Rule |
|---|---|---|---|
| **A** (primary) | circle Ø92, centre (323, 738) | Ø84, centre (266, 510) | right edge margin 24; bottom margin `sab`+34 |
| **B** (secondary) | Ø64, centre (238, 778) | Ø56, centre (190, 536) | 10–16 px gap to A |
| **C** (context) | Ø48, centre (250, 694) | Ø44, centre (200, 468) | above B |
| **D** (context) | Ø48, centre (340, 652) | Ø44, centre (282, 436) | above A |
| **Stick zone** | x 0–189, y 383–818 | x 0–154, y 256–568 | left 48% of width, lower 55% of height |
| **Stick ring** | Ø120; ghost at (84, 730) | Ø104; ghost at (70, 496) | floats to the first touch; clamp so the ring stays on screen |
| **Sprint ring** | push ≥ 1.15× ring radius | same | haptic tick when crossed |
| **Score bug** | 232×40 at (80, 65) | 200×34 at (60, 24) | top = `sat`+6 |
| **Pause** | 44×44 at (12, 63) | 44×44 at (6, 20) | always present (fixes NBA-09, NFL D-5, soccer C-5) |
| **Heat bar** | 232×6 at (80, 108) | 200×5 at (60, 60) | directly under the bug |
| **Toast line** (hints, PERFECT words, coach line) | 1 line, 28 px tall, bottom edge at y=618 | bottom edge at y=404 | above the controls, never over the goal or rim (fixes NBA-21, soccer V-3.1) |
| **Action-safe box** | y 115–568 | y 76–368 | the controlled player and the target (rim, receiver, goal) are always inside it (fixes NBA-13, NFL P-1, soccer V-1) |

Gaps between all four buttons are 10–18 px at both sizes (checked: A–B 16/10, A–C 15/14, A–D 18/12). Every target is ≥ 44 px. A **Buttons-only** preference turns swipes into visible small buttons in an arc for players who prefer them [plan nba-3]. A left-handed mirror is a later setting.

---

## B. The new match design, sport by sport

Shared rules first, then each sport.

### B.0 Shared systems

**B.0.1 The gold ring (the PERFECT system). [new]**
- **Drawn as** a ring on the ground around the subject, shrinking toward a fixed inner target ring, plus a short arc meter above the head for shots. The gold segment is **never thinner than 8 design px** on screen and its angular size is the real window (fixes NBA-14: a 2–4 px green slice; windows below one frame).
- **Timed from the touch event**, not the 60 Hz step: press and release use `PointerEvent.timeStamp` deltas converted to game time [audit NBA-14 fix 1; plan nba-4].
- **Minimum gold window ±30 ms** for anyone, anywhere. Difficulty and contests move outcomes through **what gold is worth and whether gold is offered**, never through sub-frame windows [audit NBA-14; research basketball §5.1].
- **Three states only:** gold (a perfect is available and guaranteed), amber (contested or out of range: timing still helps, no guarantee), red (do not do this: too far, smothered, no angle). The toast line names the dial that failed: TIMING, PRESSURE or RANGE [research basketball §0.2].
- **A one-time calibration** ("tap on the beat" four times) sets device lag [audit NBA-14 fix 4; plan nba-4].
- **Ratings set the ring size.** The same shot by a 95 shooter shows a visibly fatter gold segment than by a 70. That is how a rating is seen.

**B.0.2 Heat. [new; replaces the scattered pops in NFL V-4 and adds NBA/soccer]**
- A team bar of 100 points under the score bug. It resets to 0 at each half.
- Gains: PERFECT skill moment +12; score +15 (NBA basket +10, NFL TD +25, soccer goal +40); stop/turnover forced +15; a clean possession with ≥ 2 passes +5. Losses: turnover −20; conceding −10.
- **HEATING UP** at 66: ball trail, crowd lifts. **ON FIRE** at 100: lasts for your next 2 NBA possessions / 3 NFL snaps / 1 soccer attack; every gold window is ×1.25 wide and amber rings become gold for uncontested attempts; the ball burns; the first score while On Fire triggers the slow-motion replay.
- The opponent AI earns Heat by the same rules, and you can see its bar. Heat is the same engine state on both phones, so it is deterministic. **It changes outcomes, so it needs the protocol bump** (section F.3).
- Solo and online. Published in the Help sheet with the exact numbers above, so it is never a hidden rubber band. There is **no comeback assistance** anywhere in V2.

**B.0.3 The match grade. [new]**
After every match a single screen line shows: PERFECTS (count), best Heat, and a letter grade S/A/B/C from points per possession/drive/attack against par for the difficulty. A match with no turnovers and a win is tagged **FLAWLESS**. Grades feed objectives and mastery (section D), never coin pay directly.

**B.0.4 The Clutch phase. [new]**
The last segment of every match is staged: the crowd bed rises, the bug turns gold and reads CLUTCH, the camera sits 6% tighter, and the heartbeat haptic runs when the margin is one score. If the final possession/drive/attack can tie or win the game, it is announced ("FOR THE WIN") and always gets the replay. The rules do not change in Clutch; only staging does. Ties are settled on the field in every sport (fixes NBA-06, NFL D-4, hidden squad-rating tiebreaks) [plan nba-6/9, nfl-2, soccer-7].

**B.0.5 Juice budget (all sports).** Values from research likeness §4.8, kept inside the existing `juice.ts` and reduced-motion rules: hit-stop 33–120 ms, capped at 150 ms per second; trauma shake scaled by mass × speed; one slow-motion beat per score at most; banners live in the toast line or attach to the scorer, never at 38% height over the rim (NBA-21). Haptics: three distinct patterns (tick = input accepted, double = PERFECT, long = score/big hit) instead of one delayed tick (NBA §9, soccer J-2). Audio: the PERFECT chime (two notes, pitch +1 semitone per consecutive perfect up to 5), ring-fill tick in the last 200 ms, a crowd bed per sport (soccer currently plays the NFL crowd, J-1), rim/glass/post/pad sounds on their real events.

**B.0.6 What an online match is.** Unchanged in structure (owner decision 2): each phone plays its own offense on the shared seed and the phones exchange results. Everything above (ring, Heat, Clutch, grade) applies to your offense. Defense is solo only.

---

### B.1 NBA: "Rhythm hoops"

**Problems this design must fix:** offense-only score attack with a precomputed rival (NBA-07); 2–2.5 minute games with rating tiebreaks (NBA-06); frozen shot clock (NBA-08); dead stick at tip-off (NBA-12); handler under the buttons and calls out of reach (NBA-13); sub-frame green window (NBA-14); PERFECT that misses (NBA-15); misleading pass % (NBA-16); moves on the shooting thumb firing on release (NBA-17); camera hides the on-ball defender (NBA-20); HUD covers the rim (NBA-21); font holes (NBA-22); 29% skating frames (NBA-23); no transitions and teleport moves (NBA-24); everyone looks the same (NBA-26); no fouls or free throws (NBA-01); inverted shot values (NBA-02); hero-ball AI and vanishing stars (NBA-03); turnovers wrong at both ends (NBA-04); symmetric difficulty (NBA-19).

**B.1.1 Format. [plan nba-6, with V2 staging]**
- **Solo:** 4 quarters. Each quarter is 4 of your possessions and 4 of theirs, alternating, so 16 + 16. A 14 s shot clock that ticks from the engine every frame with a tick sound under 4 s (NBA-08).
- **Defense is played by default.** Auto-defend switch and a per-possession SIM chip (owner decision 2).
- **Clutch = the last 2 + 2 possessions of Q4.** Overtime = 2 + 2 possessions, repeated until decided.
- **Online:** the 16-possession offense race, plus overtime periods when tied [plan nba-9].
- **Time budget:** live possession 7–9 s, dead time ≤ 1.2 s, intro + half ≤ 5 s, one replay per quarter: **about 5:30** [plan nba §3.4].
- **Transition [new, P1; research basketball §0.14]:** a steal or a long rebound on your defensive possession starts your next possession as a 3-on-2 fast break with 7 s on the clock. Defense now feeds offense, which is what makes playing defense feel worth it.

**B.1.2 Controls.**

| Context | Left stick | A (Ø92) | B (Ø64) | C (Ø48) | D (Ø48) |
|---|---|---|---|---|---|
| **Offense, ball in hand** | move; past the ring = sprint | **SHOOT.** Hold: gather, ring closes; release on gold. Tap (< 120 ms): pump fake. Swipe off A: ←/→ crossover, ↓ step-back, ↑ spin (or euro-step when driving). Driving to the rim, hold = finish chosen by ratings (layup, dunk, floater) | **PASS.** Tap: to the stick-aimed man, else the most open. Hold: lob (alley-oop to a cutter). Or tap a teammate | **CALL.** Opens a 3-way radial under the thumb: SCREEN / CUT / ISO | hidden |
| **Rebound** | steer the nearest man | **BOARD**: ring closes on the ball; tap on gold | hidden | hidden | hidden |
| **Free throw** | – | hold, release in the band | – | – | – |
| **Defense** | steer your defender; idle = assisted positioning | **CONTEST**: a ring closes on the shooter as he rises; tap on gold = PERFECT contest (heavy), early = foul risk | **STEAL**: tap when the ball is exposed (a brief gold flash on the ball during a crossover or a lazy pass) | **SWITCH** to the man nearest the ball | hidden |

This is the plan's context table [plan nba §5] with three V2 changes: the gold ring replaces the arc-only meter, STEAL and CONTEST get a visible timing cue so defense is a skill and not a button mash, and CALL's ISO replaces SPACE (ISO clears a side for your star, which is how stars get the ball: NBA-03).

**B.1.3 Camera. [new framing on audit NBA-20's direction]**
- A **high three-quarter half-court view**, pitched about 55° and yawed 12° off the rim line, so the on-ball defender reads as a separate silhouette instead of hiding behind the handler.
- Rim at 20–24% of screen height; handler held at 50–55%; the follow is a dead-zone blend of handler and ball with time-based damping `1 − exp(−k·dt)`.
- **Fixed zoom near the rim**: no zoom-in pile-ups. On a shot the camera does not chase the ball; it holds the shooter and tilts 2% toward the rim.
- On defense the same view is used from behind your defense's rim, so the layout never flips: you always attack "up" and defend "up-court from your basket at the bottom". [new; check on device]

**B.1.4 Movement feel. [new targets; fitted in plan nba-7/8]**
- **Acceleration:** 0 to top speed in 0.30 s (ACC 95) to 0.55 s (ACC 60). **Top speed with the ball:** 13 ft/s (SPD 60) to 17 ft/s (SPD 99); the audit's 90th-percentile body speed is 14.2 ft/s.
- **Momentum:** a direction change > 90° costs 35% speed at AGI 60 and 12% at AGI 95. Big men carry further before stopping. This is the difference between a guard and a centre in your left thumb.
- **Moves ramp, never teleport** (NBA-24): crossover and step-back reach burst speed over 3 engine steps (50 ms), cancellable after 150 ms [research basketball §0.7].
- **Move tiers and pips:** three tiers by handle rating (< 60, 60–84, 85+) with a per-possession budget of 3 pips; the fourth move in a possession is slow and loose [research basketball §0.6; plan nba-7].
- **Contact:** chest-to-chest slows the handler to 40% and starts a 0.4 s bump animation; STR + momentum beats it (the existing bully-through stays). A drive into a set defender is a charge; a reach on a protected ball is a foul (NBA-01, NBA-04).

**B.1.5 Skill moments.**
1. **The jumper.** Gather on touch-down, release at the top. Gold window ±30 to ±85 ms by rating and openness [plan nba §3.3]. Gold = make, always. Contested looks show amber. A catch-and-shoot within 0.4 s of the catch gets a "rhythm" bonus: +20% window [research basketball §5.1].
2. **The ankle-breaker. [new]** When a defender lunges or reaches, a 150 ms gold flash rings his feet. A crossover or step-back started inside it is a PERFECT move: the defender stumbles (the existing `slip` clip) for 0.8 s.
3. **The finish.** Hold A while driving; release as the ring closes at the rim for layups; dunks are automatic for dunkers with a lane. A PERFECT finish through contact is an and-one.
4. **The lob.** Hold B with a cutter in the lane; the pass and the dunk are one ring.
5. **The stop.** A PERFECT contest forces the lowest shot grade; a PERFECT steal is a clean strip with no foul roll.
6. **The board.** Tap as the ring closes on the ball's last bounce [research basketball §0.5].
7. **Free throws.** A 2-second band meter, different from the jumper on purpose (Hoop Land's is liked for this) [plan nba-5].

**B.1.6 Animation set.** The recorded jump shot stays untouched: it is the best animation in the game (audit NBA §12). Everything else follows the players team's rules R1–R14 [research likeness §4.3]: speed-matched gait, stance-foot anchoring, 80–120 ms pose blends, key-pose holds.

Frame plans at 60 Hz (f = 16.7 ms). "Control" is when input is accepted again.

| Action | Frames | Notes |
|---|---|---|
| **Jump shot** (keep) | gather 0–12 f (dip starts on the touch frame), rise 12–31 f, **release at 31 f (0.52 s)**, follow-through hold 14 f, land 6 f | set-point hold 3 f; lefties mirror; per-player set point and follow-through from motion DNA |
| **Crossover** (use the unused mocap `crossover` clip) | plant 0–5 f, ball crosses at 8 f, push-off 8–14 f, settle 14–20 f; control at 9 f | 1 smear frame on the ball hand at 7 f; shoe squeak at 5 f |
| **Step-back** (new, not the reversed crossover) | load 0–4 f, hop back 4–13 f (root moves 4–5 ft), land 13–17 f; control at 13 f; SHOOT buffered from 6 f | 1 px squash on landing |
| **Spin** | plant 0–4 f, back-to-defender at 9 f, exit at 16 f; control at 12 f | ball hidden frames 6–11 |
| **Pump fake** | ball up 0–6 f, hold 3 f, down 6 f; control at 6 f | defender jump roll at 4 f |
| **Layup** (mocap `layup`) | gather 2 steps = 16 f, jump 10 f, release at apex, land 8 f | euro-step variant shifts the second step ±2 ft |
| **Dunk** | gather 14 f, flight 22–30 f, **rim contact: hit-stop 70 ms**, hang 8–20 f by flair, drop 8 f | rim springs 3 px for 6 f; posterizer adds 0.5× slow-mo for 300 ms |
| **Contest / block** (split the shared pose; use mocap `jump`) | crouch 4 f, rise 10 f, apex hold 3 f, swat 2 f with smear | block hit-stop 60 ms |
| **Steal reach** | 6 f out, 6 f back | whiff leaves the defender flat for 12 f |
| **Rebound** | crouch 4 f, rise 12 f, secure 4 f, land 6 f with elbows out | box-out is a 1-pose lean |
| **Catch** (mocap `catch`, `catch_run`) | hands up 4 f, ball in 2 f, tuck 4 f | never relocates the player |
| **Dribble** (mocap `dribble`) | 30 f period standing, 20 f sprinting | squeak on plant frames |
| **Celebrations** | 3 short (0.8 s) per archetype | teammates run to the scorer [research likeness §0.14] |

Handler and his defender animate at 30 fps; everyone else at 15 fps (NBA-25). The near-first sprite budget is the players team's [plan players-2] and is a hard dependency (audit A-1).

**B.1.7 Juice.** Net snap on every make (3 f of net stretch); rim rattle and an "ooh" on rim-outs; misses fly to front rim, back rim or glass, never to the rim centre (NBA-24); ball trail when HEATING UP; flames when ON FIRE; floor reflection under the ball handler; the crowd's first three rows stand on makes in Clutch; scorer name plate "CURRY · 3PT · 11 PTS" in the toast line.

**B.1.8 Ratings you can see.**
- Ring size by shooting rating and zone. Hot zones glow faintly on the floor for the handler only [research basketball §0.18; plan nba-8].
- Speed and acceleration as above; handle tier decides which moves exist and how far they travel.
- Dunkers dunk; non-dunkers lay it in. Shot-blockers get a bigger CONTEST ring.
- **Usage:** ISO and the AI's usage model put the ball in the star's hands for 28–35% of shots (NBA-03).
- Badge pops stay, limited to one per possession, in the toast line.

**B.1.9 Keep.** The deterministic engine and tests; physical rebounds and catches; the recorded jumper and shot tempos; the scheme chip and LAST PLAY coaching; contest grades; replays, hit-stop and the posterizer; landscape layout; reduced motion (audit NBA §12).

---

### B.2 NFL: "Sling and smash"

**Problems this design must fix:** carrier brakes to a stop after a catch or handoff (C-1, critical); play-call panel hides the formation (P-1, critical); no pocket movement, throwaway or slide (C-2); ten-button passing panel in a 2–3 s window (C-3); moves without direction, stamina resets (C-4); trivial kick meter (C-5); shallow playbook with random suggestions (P-2); no explosive runs (G-1); deep balls too reliable (G-2); the Z receiver gets 5% of targets (G-3); turnover explosion at the top tier (G-4); first-contact tackles (G-5); static two-coverage defense (D-1); you never defend or see their drives (D-2); symmetric difficulty with a superhuman AI QB (D-3); ties decided by squad rating (D-4); no pause (D-5); thin format (F-1); hand-keyed juke/spin/truck and missing sacks, handoffs, piles (A-1); small players and wasted screen (V-1); identical players, "WR 81" fill-ins (V-2); HUD overlaps (V-3); noisy ability pops (V-4).

**B.2.1 Format. [plan nfl §5, with V2 staging]**
- **Solo:** 4 drives each, alternating. Your drive is played in full. On their drive you play the **key snaps**: every 3rd and 4th down, every snap inside your 20, and two-point tries; the other snaps run at 3× and can be skipped. Auto-defend and a per-drive SIM exist (owner decision 2).
- **Clutch = drive 4**, the two-minute drill with a running clock and three timeouts shown as pips.
- **Ties:** overtime is alternating two-point tries from the 2-yard line [plan nfl-2].
- **Time:** offense drive median ≤ 45 s, defense 35–40 s: **4–6 minutes** [plan nfl §5].
- **Takeaways are played [plan nfl-8]:** an interception or fumble on a key snap gives you the return with the stick.

**B.2.2 Controls.**

| State | Left stick | A (Ø92) | B (Ø64) | C (Ø48) | D (Ø48) | Field |
|---|---|---|---|---|---|---|
| **Pre-snap** | – | **SNAP** | **AUDIBLE** (flip run/pass) | – | – | a **124 px play tray** of 3 suggested cards (swipe for the book); the formation stays visible above it; drag the field to look around (tray collapses) |
| **Pocket** | move the QB (slide, step up, roll) | **RUN IT** past the line; **THROW AWAY** outside the tackles (same slot, label changes) | – | **BULLET / LOB** toggle chip (default TOUCH) | – | **Slingshot:** drag anywhere on the right two thirds and release to throw to the spot. **Or tap a receiver's icon** over his head: an auto-led touch pass. A landing reticle is always drawn |
| **Ball carrier** | steer; **momentum carries until first touch** (C-1); past the ring = burst (shares stamina) | **JUKE** toward the stick side | **SPIN** | **POWER**: tap = stiff arm/lower shoulder, hold = truck charge | **DIVE** (near the sticks/goal line) or **SLIDE** (QB) | – |
| **Defense, key snap** | move your defender | **TACKLE**: ring closes on the carrier as you close; gold = BIG HIT (fumble chance). In the air: **SWAT / PICK** ring on the ball | – | **SWITCH** | – | pre-snap: pick 1 of 3 defensive calls (BLITZ / MAN / ZONE) in the same tray |
| **Kick** | – | two taps: power, then accuracy on a sweep whose speed scales with the kicker's rating | – | – | – | – |

V2 changes against the plan: burst moves onto the stick (push past the ring) so the right thumb is free for moves. The repo's rule of "a permanent stick and separate skill buttons" (CLAUDE.md, NFL direct control) is kept: JUKE, SPIN and POWER stay separate buttons; a "Burst button" preference restores the old hold button on D. **Owner device check required.**

**B.2.3 Camera. [audit V-1 direction; plan nfl-3]**
- Behind the offense, field running up the screen. **Pre-snap the line of scrimmage sits at 45% of the height**, not 68%, so the whole formation and the defense's shell are visible above the 124 px tray at every size including 320×568 (P-1).
- Horizon at 6% so the stands take ≤ 12% of the height.
- **Dynamic zoom:** pulls back up to 25% on deep routes and lobs so the landing reticle is always on screen; pushes in 15% on the carrier in traffic and on contact.
- Near players are **34 design px tall**, far players 22 px; the ball has a shadow ring and a trail (V-1: the ball is 2–4 px today).
- On defense: the same broadcast view behind the AI offense [plan nfl §9]; your defender wears the gold ground ring.

**B.2.4 Movement feel. [new targets; fitted in plan nfl-6/7]**
- **The carrier never gives up (C-1).** On a handoff or catch he keeps his momentum and follows his lane until the thumb first touches the stick. Measured cost of today's behaviour: yards per carry 3.9 → 1.2 with a 0.35 s reaction.
- **Acceleration and cuts by ACC/AGI:** a 90° cut keeps 80% of speed for an elite back and 55% for a lineman; the plant foot shows it (mocap `cut`).
- **Runs need tails (G-1):** blocking creates a visible crease (a faint lane arrow drawn pre-snap for run calls), second-level defenders can be made to miss, and pursuit angles are honest, so 10+ yard runs reach about 11% and 20+ about 2% [research football §0.3].
- **Tackles are contests (G-5):** contact starts a 0.25–0.5 s wrap; the carrier's POWER/JUKE/SPIN inside it, timed to the gold flash, breaks it by rating. Gang tackles end it.
- **The pocket moves (C-2):** the stick slides the QB; pressure draws a red arc on the side it comes from; a throw on the run narrows the ring.

**B.2.5 Skill moments.**
1. **The sling.** The drag shows an arc and a landing reticle with the receiver's name chip even for weaker QBs (C-3). The reticle's ring is the gold ring: release when the receiver's break lines up and the ball arrives in stride for YAC. Deep throws (20+ air yards) use a narrower ring and amber under pressure, bringing deep completion to 35–40% (G-2).
2. **The tap throw.** Tap a receiver icon for a safe, auto-led touch pass. It is always available and is never better than a PERFECT sling (the "auto must not beat manual" rule) [research basketball §0.9].
3. **The PERFECT juke.** The tackler's wind-up ring already exists (audit NFL §11). V2 makes it the gold ring: a JUKE or SPIN inside the gold leaves him on the turf (hit-stop 50 ms, he plays `stumble`/`slip`). Early = slowed; late = wrapped.
4. **The truck.** Hold C to charge for up to 0.6 s; release into contact. Wins on STR + momentum; 90 ms hit-stop on a win [research likeness §4.8].
5. **The BIG HIT (defense).** Close on the carrier and tap A on gold: a hit-stick with a timing cue, as Madden 26 does [research football §0.7]. Whiff = you fly past.
6. **The pick.** A ring closes on the ball at the catch point when your defender faces it [research football §0.9]. Gold = interception, then you return it.
7. **The kick.** Two taps; a rating-scaled sweep (C-5) [research football §5].

**B.2.6 Animation set.**

| Action | Frames (60 Hz) | Notes |
|---|---|---|
| **Snap and drop** | snap catch 6 f; shotgun settle 2–3 steps × 12 f | QB faces downfield while backpedalling (today he skates in an idle clip, A-1) |
| **Throw** (mocap `throw`) | cock 0–8 f, stride 8–14 f, **release at 18 f (0.30 s)**, follow-through hold 10 f | arm smear at 17 f; arm slot from motion DNA; lefties mirror |
| **Handoff exchange** (new) | QB reach 8 f, mesh 4 f, RB tuck 6 f | ball visibly changes hands |
| **Juke** (mocap `cut`, not the basketball crossover) | plant 0–6 f, lateral 2.0–2.5 yd over 6–14 f, recover 14–20 f; control at 12 f | dust puff at the plant; 1 px dip |
| **Spin** | plant 4 f, rotate through 8 facings at 2 f each, exit 4 f | ball arm tucks inside |
| **Stiff arm** (mocap `stiff_arm`) | extend 6 f, hold 8–20 f, recoil 6 f | tackler slides off with `stumble` |
| **Truck** | lower 6 f, impact with 90 ms hit-stop, drive 10 f | loser plays `fall_back` |
| **Wrap tackle** | contact, 15–30 f drag, down | pile for 3+ bodies: stacked `fall` poses |
| **BIG HIT** | 4 f launch, impact 80–100 ms hit-stop, carrier `fall_back` | trauma 0.5; pad crack |
| **Sack** (new) | wrap 6 f, both down 14 f | QB `getup_front` after (unused today) |
| **Catch variants** | in stride (3 f hands, 4 f tuck), high-point (jump 10 f, apex 3 f hold), sideline toe-tap | spectacular catch: 0.5× slow-mo for 250 ms |
| **Incompletion** | ball bounces twice and rolls | today it vanishes (A-1) |
| **TD celebrations** | 4 generic (spike, point up, flex, team mob) | 1.2 s, tap skips |

**B.2.7 Juice.** Pad crack and grunt layers by hit size; turf pellets on cuts and hits; the first-down line flashes on a conversion; chain-move sting; ON FIRE flames stay (already there); a slow-motion replay for TDs and takeaways only; "TACKLED BY <name>" in the toast line (V-2); one ability pop per play (V-4).

**B.2.8 Ratings you can see.** QB accuracy = ring size and how far the arc is drawn (the existing "sight" mechanic stays); arm strength = max reticle distance and ball speed; a back's AGI = juke distance and cut speed kept; STR = truck wins; receivers show separation as a coloured halo on their icon (green = step open, amber = tight); every card in the squad gets touches because the AI's reads and your suggested plays spread targets (G-3).

**B.2.9 Keep.** The 11-on-11 deterministic engine; the `RunInput` contract and direct-control stick; the physical blocking, rush, route and coverage models; BULLET/TOUCH/LOB physics; the tackler wind-up ring; penalties; replays, hit-stop, On Fire, the stamina bar, afterimages; the landscape side camera as the readability reference (audit NFL §11).

---

### B.3 Soccer: "One-touch flow"

**Problems this design must fix:** attack drills only, the same seven, opponent invisible (S-1, critical); a 17 m keyhole camera with teammates off screen (V-1, critical); sprint-and-shoot scores 58.5% (B-1, critical); ratings cliff, 1.7% vs 92.3% (B-2, critical); frozen ball up to 120 s (R-1); keepers parry into their own net, 14.3% of goals (R-2); cheap fouls (R-3); shot model off: 53% on target, 20% converted, 16–22% from 30 m (§2); flat or inverted difficulty (B-3); manual aim loses to the assist (B-4); inverted free-kick bend (C-4); ball glued to the boot, no skill moves, fixed stick, sprint on the wrong thumb (C-1); no range gate, slow 0.62 s wind-up for tap-ins (C-3); stands eat the screen (V-2); HUD collisions, "FBENDICK" (V-3); tiny players (V-4); one right-footed kick, belly-flop dives (A-1); identical players (A-2); NFL crowd audio (J-1); thin juice (J-2); formation cosmetic (U-1).

**B.3.1 Format. [plan soccer-6/8/9, with V2 staging]**
- **Solo:** two halves. 7 attack phases for you and 7 for them, interleaved, dealt from a **weighted, varied bag** (build-up, counter, wide, turnover high up, keeper long ball; corners and free kicks are *earned* from play, not dealt every match) (S-1). Each phase runs on a 20–30 s phase clock.
- **Their attacks are defend phases** you play by default, with Auto-defend and SIM THIS DEFENCE (owner decision 2).
- **Clutch = the last attack each**, shown as 90'+ stoppage time. League games may end level; knockouts go to the existing shootout (kept).
- **Time:** about 14 phases × 15–18 s + restarts and goal moments: **4–6 minutes** [plan soccer-9].

**B.3.2 Controls.**

| Phase | Left stick | A (Ø92) | B (Ø64) | C (Ø48) | D (Ø48) | Pitch |
|---|---|---|---|---|---|---|
| **Attack** | run; past the ring = sprint (longer, losable touches) | **SHOOT.** Hold: power ring fills (0.35 s inside 11 m up to 0.62 s at 25 m); drag to aim at the mini-goal; release on gold. **Flick up off A = chip. Curved drag = finesse. Double-tap = low driven** | **PASS.** Tap: ground pass along the stick. Hold ≥ 0.22 s: lob/cross | **THRU.** Tap: ground through ball. Hold: lofted through ball | **TRICK.** One skill move chosen by the stick direction and the player's skill stars | tap a teammate = pass to him; off-screen teammates show edge arrows with initials |
| **Defend** | move your defender; past the ring = sprint | **TACKLE.** A ring closes on the dribbler between his touches; tap on gold = clean win. Early = foul risk | **CONTAIN** (hold): jockey, facing the ball, auto-distance | **SWITCH** (auto-switch on by default) | **KEEPER**: hold to rush him out | swipe on the pitch = slide tackle along the swipe |
| **Set piece** | – | SHOOT (drag aim; swipe on pitch bends, and the reticle shows the bend) | CROSS (tap target) | SHORT | – | – |
| **Penalty** | – | drag to aim, release on the meter | – | – | – | as keeper: swipe to dive at the kick (replaces the pre-commit, P1) |

V2 changes against the plan: the shot types and skill moves from the plan's **Appendix A are promoted from "deferred" to P1** because "sprint and shoot" being the only verb is the owner's "gameplay is pretty bad" in one line; TRICK is a **button**, not an invisible swipe zone, so it is discoverable; THRU gains the lofted hold (C-2).

**B.3.3 Camera. [audit V-1/V-2; plan soccer-3]**
- **Portrait, high and steep:** about 34 m across at the carrier's row (`s ≈ W/34`, up from W/19), pitch 0.9, following 85–100% of the ball's x.
- **Action-safe framing:** carrier, his two nearest options and the goal stay inside the safe box above the controls. Zoom eases out up to 15% to keep a through-ball target in frame.
- Horizon clamped so stands are ≤ 12% of the height. Corners are framed from the flag side with the goal in the upper third (V-2).
- The controlled player is **34 design px tall**, far players 22 px, with the readability head (section C). The ball is 5 px with a shadow and a trail on shots.
- Landscape stays supported as today; it is not the default because the app is portrait-locked.

**B.3.4 Movement feel. [new targets; plan soccer-5 and Appendix A]**
- **The ball is touched, not glued (C-1.1).** A touch every 2 strides at a jog (ball 0.6–1.0 m ahead), every 3–4 at a run, every 5–6 at a sprint (3–5 m ahead) [research likeness §4.6]. Between touches the ball can be won. High DRI = shorter, tighter touches. This one change kills the dominant sprint strategy (B-1) and makes tackling a timing skill.
- **Acceleration archetypes [research soccer §0.7]:** Explosive (small, agile: fast first 5 m), Lengthy (tall, strong: slow start, high top speed), Controlled. Derived from PAC/DRI/PHY and height under our own names.
- **Turns:** radius grows with speed; a turn > 120° at sprint needs a 2–3 step brake.
- **Shielding:** stick back toward your own goal with a defender within 1.5 m = shield, decided by PHY.
- **First touch:** a pass arriving fast or from behind adds a heavier first touch by rating [research soccer §0.9].
- **AI defenders contain; they do not auto-tackle the dribbler every time** [research soccer §0.13].

**B.3.5 Skill moments.**
1. **The finish.** Power ring + aim. Gold = the ball goes where the reticle is. Range gate: beyond the shooter's range the ring is red and says TOO FAR (C-3). Conversion follows real xG × about 1.6 [research soccer §0.3; plan soccer-4].
2. **Shot types** (finesse, chip, low driven, power) from one button [research soccer §0.1].
3. **The through ball.** THRU draws the runner's lane; release as his run crosses the last defender. Offside is judged at the pass (kept).
4. **The one-two. [new]** After a pass, tapping B again within 1 s returns it first time: the passer keeps running automatically.
5. **TRICK.** A feint, roulette or drag-back by stars; a PERFECT trick is one started as the defender commits (gold flash at his feet).
6. **The PERFECT tackle.** Tap between the dribbler's touches. Slide = swipe, higher reward, card risk.
7. **The reflex save. [new, P1, solo only]** On a shot on target inside 16 m in a defend phase, time runs at 0.5× for 300 ms and a swipe adds reach to your keeper's dive in that direction. The keeper's ratings set the base save; the swipe adds up to +15% reach. Without a swipe the keeper plays as rated.
8. **Set pieces.** The bend swipe is drawn on the reticle and goes the way you swipe (C-4).

**B.3.6 Animation set.**

| Action | Frames (60 Hz) | Notes |
|---|---|---|
| **Dribble touch** (new) | touch on the stance-foot frame every 2/3–4/5–6 strides | ball visibly leaves and returns; `touchAt` from the engine [plan soccer §5.5] |
| **Pass** | plant 4 f, swing 4 f, **contact at 8 f**, follow 6 f | left and right foot by `kickFoot`; inside-foot pose |
| **Shot** (replaces the single kick) | run-up plant 6 f, backlift scales with power 4–10 f, **contact locked to launch**, follow-through 12 f with a hop | smear on the leg at contact −1; power shot hit-stop 33 ms |
| **Finesse / chip** | open-body pose / short stab | 2 extra poses |
| **Header** (not the basketball jump) | crouch 4 f, rise 10 f, neck snap at contact, land 6 f | |
| **Volley** | side-on swing, contact at ball height | |
| **Trick moves** | step-over 14 f, roulette 20 f, drag-back 16 f; control at 60% | star-gated |
| **Standing tackle** | lunge 6 f, contact, recover 8 f (miss: 14 f) | variants by DEF tier [research soccer §0.14] |
| **Slide tackle** (not the belly-flop) | drop 4 f, slide 14–20 f, get up 16 f | turf spray |
| **Keeper** | **set (split step) 4 f before every shot**, dive low/mid/high 14–18 f, land and roll 12 f, parry pushes **wide** | catch vs parry by HAN; `getup` after |
| **Goal celebration** | 4 generic (knee slide, arms wide, point, team pile) | net bulges 3 f; hit-stop 66 ms |

**B.3.7 Juice.** A real soccer crowd bed with a rising "ooooh" on shots and the roar on goals (J-1); post and bar "clang" with a 1 px post vibration; net bulge; a goal plate "HAALAND 67' · 2nd of the match"; the rival's goals are shown, with a replay (S-1.4); grass spray on slides; ball trail on shots over 22 m/s.

**B.3.8 Ratings you can see.** SHO = ring size and range gate distance; PAC archetype = how he gets away; DRI = touch tightness and skill stars (the `skillStars` formula in plan soccer §5.10); PAS = pass-lane preview width; DEF = tackle ring size; keeper ratings = how far the dive reaches. The human rating curve is smoothed so 70s can score and 90s can miss (B-2) [plan soccer-5].

**B.3.9 Keep.** The ball physics (drag, Magnus, bounces, woodwork); the "stick only runs, drag on SHOOT aims" contract; the mini-goal and reticle; timing words and miss reasons; free passing with a narrow assist; receivers running onto passes; the keeper model; offside at the pass; shootout rules; intro cards and LAST PLAY coaching (audit soccer §13).


---

## C. Art direction: "Broadcast Pixel"

**The problem, measured.** Every player has the same skin tone `#a8714f` and hash-picked hair, so looks are confidently wrong (L-1). Shaq and Manute Bol share a 20 px torso (L-2). There is no appearance data for any of 19,938 players (L-3). Every card shows the same 54 px mannequin (L-4). Numbers are unreadable below 26 px (L-5). Players in soccer are 10–42 px tall and the goal is 45 px wide (soccer V-4). The crowd is a static noise texture that is brighter and busier than the players in front of it (see `audit-shots/nba/390-03-meter-rising.png`).

**The direction in one line:** chunky, big-headed, hard-outlined pixel athletes on calm, darker venues, lit like a night broadcast, so the eye lands on the players first and on *who* each one is second.

### C.1 Player sprites

**C.1.1 Proportions: the 5-head hero. [new; goes further than research likeness §3.4's +25% head]**
A real athlete is about 7.5 heads tall. At 34 px that leaves a 4 px head, which cannot carry identity. NBA Jam, Retro Bowl and Hoop Land all cheat the head. We do too, deliberately and consistently:

| Sprite height (art px) | Heads tall | Head box (w×h, with hair) | Shoulders | Limb thickness | Use |
|---|---|---|---|---|---|
| 16–20 | 4.5 | 5×5 | 6–7 | 2 | far players (LOD 0) |
| 22–26 | 5 | 6×6 | 8–9 | 2–3 | NFL and soccer near players |
| 32–36 | 5.5 | 7×8 | 10–12 | 3 | NBA near players |
| 56–72 | 6 | 12×13 | 18–22 | 5 | intros, replays, pack walkouts |
| card bust | – | 26×28 | 44 | – | card faces |

Implementation in the code-drawn rig (`pixel/body.ts`): scale the head capsule radius by `headScale = clamp(1.55 − px/120, 1.2, 1.45)` and limb radii by 1.15; body height from data is unchanged, so height differences survive. Height spread is exaggerated ×1.15 around the sport's mean, and weight drives torso width from 8 to 13 px at NBA size so that Shaq and Bol cannot share an outline (L-2). **Render-only: no protocol bump.**

**C.1.2 Pixel size.** One art pixel = 1.5 design px at match scale (4–5 device px on a 3× iPhone), nearest-neighbour, snapped to whole device pixels. Target on-screen heights at 393 wide:

| Sport | Controlled player | Other near players | Far players | Ball |
|---|---|---|---|---|
| NBA | 34 art px = **51 px** | 30–34 art px | 24 art px | 5 px + shadow |
| NFL | 23 art px = **34 px** | 20–23 | 15 | 4×3 px + shadow ring + trail |
| Soccer | 23 art px = **34 px** | 20–23 | 15 | 4 px + shadow + trail on shots |

Far players are **drawn at their own native size** (level of detail), never scaled down from the big sprite, so they stay crisp.

**C.1.3 Outline and shading.**
- Outer silhouette: 1 art px, colour `#14121c` (near-black violet), on every sprite. Inner separations use the part's shadow tone, not black.
- Three tones per material: base, shadow (lightness −22%, hue rotated 10° toward blue), highlight (lightness +14%). One light from the top-left. No dithering below 56 px.
- A soft elliptical ground shadow, `rgba(0,0,0,0.32)`, 70% of shoulder width. The controlled player adds a 2 px **gold ground ring `#f6b93b`**; your pass target a teal ring `#4fe3c1`; the on-ball defender a red arc `#ff5d5d`.
- Dark skin on dark kits gets a 1 px rim highlight on the lit side [research likeness §3.2].

**C.1.4 What carries identity, in priority order** [research likeness §2.4]: build and height → hair silhouette → hair colour → head gear → skin tone → facial hair → asymmetric limb gear → socks and shoes → number (≥ 28 px only) → handedness → signature motion.

**The appearance record** is the players team's typed `Appearance` [plan players-4]. V2 fixes the palettes and the option lists so artists and code agree:

- **Skin: 10 tones** on the Monk scale, each a 3-tone ramp [research likeness §3.2]. Base hexes: `#f6ede4 #f3e7db #f7ead0 #eadaba #d7bd96 #a07e56 #825c43 #604134 #3a312a #292420`, saturation raised 8–15% in-game.
- **Hair colours: 15.** Black `#1d1612`, dark brown `#3b2a20`, brown `#6a4a32`, light brown `#8f6a48`, auburn `#8a3f22`, ginger `#b5562a`, blond `#d6b36a`, platinum `#ece6d2`, grey `#9b9b9b`, dyed red `#c8343c`, blue `#3a6fd8`, green `#3fae5a`, pink `#e070b0`, purple `#7a4ac8`, team colour.
- **Hair silhouettes: 18** (bald, buzz, short, fade, high-top, afro, big afro, cornrows, short locs, long locs, braids, ponytail, bun, mohawk, curly top, long flow, receding, headband-bound). Below 24 px they collapse to four: none, cap, tall, long.
- **Facial hair:** none, goatee, full beard, long beard, moustache. Off below 20 px except full beard.
- **Gear:** headband (colour), goggles, mouthguard dot, one arm sleeve (L/R), both sleeves, leg tights (L/R/both), knee pad, wristbands, high/low socks, shoe colour; NFL: visor (clear/tinted), towel, hair out of the helmet (locs, flow), gloves, neck roll, bare arms; soccer: captain's armband, gloves, hair band, taped wrists, sock height.
- **Never:** tattoos, brand marks, shoe logos, real team logos, or any trait inferred from name or nationality [research likeness §0.7]. Uncurated players keep the neutral default and seeded *plausible-range* hair, never a confident guess.
- **Coverage:** Tier A hand-curated for every GOAT and Legend plus the top 60 by rating per sport, then the 50 most-pulled golds [plan players-7]. **V2 adds:** the 12 players shown in each sport's first-run flow and starter pack must be Tier A, because the first five minutes decide whether "you can tell who is who".

**C.1.5 Signature motion (render-only "motion DNA").** Shot form (set-point height, release speed look, follow-through hold), handedness, dribble style, QB arm slot, run style, kick foot, one signature celebration for Tier A [research likeness §3.8; plan players-9]. A lefty looks lefty. None of it changes engine timing.

**C.1.6 Kits.** Original two-colour kits per franchise identity (home/away), drawn as jersey base + trim stripe + number. Three-tone ramps generated from the base. NFL helmets carry a centre stripe and a blank side (no logos). Clashing kits are resolved by an automatic away swap when the two primaries are within ΔE 25.

### C.2 Venues

**Principle: the venue is 30% darker and 50% calmer than the players.** Values are starting points.

| Element | NBA court | NFL field | Soccer pitch |
|---|---|---|---|
| Playing surface | planks `#c98f52` / `#bf8548` alternating every 6 px, grain at 4% contrast (today's grain is far louder) | mow stripes `#2f8f46` / `#2a8240` every 5 yards | mow stripes `#2e9a4a` / `#288a41` every 5.5 m |
| Lines | `#f4ead8`, 2 px | `#eaf5ea`, 2 px; yard numbers 14 px tall in a simple block font, only every 10 yards, 60% opacity | `#f2fff2` at 85%, 2 px |
| Team colour | the paint and the centre circle, at 85% saturation | end zones, with the team *name* in block type (no logo) | none on the pitch; boards carry it |
| Surround | 10 px apron in team dark | 8 px white sideline + team-dark bench strip | 6 px run-off + ad boards with original word marks |
| Sheen | a vertical light pool: +8% lightness under the rim | – | – |

- **Lighting:** a night-game vignette: corners −18% lightness; four soft light pools on the surface. A 1 px bright rim on the top-left of every sprite ties them to the lights.
- **Crowd:** three value bands only (`#221d36`, `#342d52`, `#4a426e`) with 6% team-colour flecks and 2% white flecks (phones). Drawn in 2 px blocks, not 1 px noise. The front three rows are sprites that **stand, bounce and wave** in 4-frame loops on scores, On Fire and Clutch [research likeness §0.14]. The crowd never takes more than 12% of the screen height in portrait (soccer V-2).
- **Depth:** objects higher on the screen are 6% darker and 6% less saturated, so the near action pops.
- **Sidelines:** two bench sprites and one coach per team; a referee sprite in NBA and NFL. Static, 4-frame idles.

### C.3 UI chrome

Keep the existing brand: deep navy, teal, italic condensed headlines (see `owner-iphone-home.jpg`). Tighten it into tokens:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#071521` | app background |
| `--panel` | `#0e2233` | cards, sheets |
| `--stroke` | `#1d3a50` | 1 px panel borders |
| `--teal` | `#4fe3c1` | brand, primary, "you" |
| `--gold` | `#f6b93b` | PERFECT, coins, the A button, Clutch |
| `--violet` | `#8b7cf6` | the rival |
| `--red` | `#ff5d5d` | pressure, danger |
| `--text` / `--dim` | `#f2f7fa` / `#8aa3b5` | text |

- **In-match buttons:** A is gold with a dark label; B is teal; C and D are dark glass (`rgba(7,21,33,0.72)` with a 1.5 px `--stroke` ring) with a white icon and a 10 px label. All controls sit on a bottom gradient scrim (transparent → `rgba(7,21,33,0.55)` over 240 px) so they read on any surface without hiding it.
- **Score bug:** one 232×40 capsule: YOU score, period/clock, RIVAL score; the Heat bar underneath. No second and third rows of chips. The possession/drive/attack pips move *into* the bug as a thin 3 px progress line.
- **Pixel font:** add `& / : + '` and fold diacritics so Jokić, Dončić and "CATCH & SHOOT" print correctly (NBA-22) [plan nba-2].
- **Motion:** 120–180 ms ease-out for UI; the PERFECT word scales 1.0 → 1.25 → 1.0 in 220 ms; reduced motion removes scale and shake but keeps colour and sound.
- **Top edge:** the solid status plate from the shell early-ship unit [plan shell-2/3] is the frame every screen sits in.

### C.4 Card art

- **The card shows the player, not a mannequin (L-4).** A **pixel bust** from the same appearance record at card scale (head 26×28 art px): hair, skin, beard, head gear, kit and number, in a **signature pose** chosen by position and motion DNA (shooter at the set point, QB cocked to throw, striker mid-strike) [plan players-6].
- **Frame ladder** by edition with distinct silhouettes, not only colours: Bronze/Silver/Gold flat frames; Rare Gold with a bevel and sheen; Standout with a diagonal slash; Program with the program's pattern; Hot Season with a heat gradient; Legend with a carved stone-and-gold frame; Spotlight with a holo prism; GOAT with a full-bleed animated background [plan players-3; research ultimate-team §8.10].
- **Anatomy:** OVR top-left (≥ 20 px at the 80 px card width), position under it, bust centre, name plate, three headline stats, edition mark, serial. Era shown as a small year chip.
- **Walkout:** the full 56–72 px sprite walks out and performs its celebration before the card flips [research likeness §0.13; plan packs-9].

### C.5 A one-page style guide for whoever draws it

1. Sprites: 5–5.5 heads tall at match size; 1 px `#14121c` outline; 3 tones per material; light from top-left.
2. Head first: hair silhouette must change the head's outline by at least 1 px on two sides.
3. One art pixel = 1.5 design px; never scale a sprite by a non-integer device factor; draw LOD sizes natively.
4. Venues: surfaces −30% contrast against sprites; crowd in three dark bands; stands ≤ 12% of screen height.
5. Rings: gold = you/perfect, teal = teammate target, red = pressure, violet = rival. Nothing else uses those four colours on the field.
6. Text on the field: only the toast line, name chips (pixel font, 7 px cap height, dark plate) and the score bug.
7. No logos, tattoos, or brand marks. Original kit colours and word marks only.

`mockups.html` shows the lineup concept at match size and at 4× zoom.

---

## D. The hook: ethical, coins-only, and hard to put down

**The rules we hold ourselves to** [research ultimate-team §7]: every random reward shows its odds first; no energy, stamina or wait timers; no real money; no escalating prices; streaks have a shield; the game tells you clearly when you are done for the day; skip and bulk actions always exist; cues never over-promise. We do not stack the predatory combinations (pity + batch pulls + limited discounts) that the research lists as the patterns to avoid. The pull comes from **mastery, clear goals, collection and people**, not from scarcity of play.

**The diagnosis** [research engagement §3]: the app already has plenty of reward faucets (daily drops, objectives, a calendar, a Season Pass, ladders) and very little reason to come back. What is missing is the layer above the faucets: **an identity that grows forever, a weekly social stake, a daily ritual worth sharing, and a "one more" moment at the end of every match.** Section D builds those four; section E is the time-played system that ties them together. Items are tagged with their rank in the engagement research's list of 22 (for example [eng #5]).

### D.1 The session loop: next game in under 10 seconds [new]

Today a finished match drops the player onto a bare final screen (NBA-10, NFL F-2, soccer J-3) and several taps from another game. Target: **final whistle to next tip-off in ≤ 10 s, with one thumb, without moving it.**

| t | What happens |
|---|---|
| 0.0 s | Final whistle. The arena stays mounted behind a dimmed sheet. |
| 0.0–2.5 s | **Result slam:** WIN/LOSS, score, grade letter, PERFECTS count. Tap anywhere skips. |
| 2.5–5.0 s | **Reward tally** [plan ut-5; eng #5]: coins, Career XP, card XP, objective ticks, Season Pass bar, **Active Minutes** ("+4 min, now 27") and **league position change** count up together with a rising-pitch tick; anything completed pops; a win in the day's first three reveals a **Scout Drop** (D.12). One CLAIM ALL. A loss still shows what moved: "little victories, even if you lose". |
| 5.0 s | **The One-More bar** appears where the A button was: a single gold button with the best next match already chosen and loaded (next Squad Battles rung, next Cup round, REMATCH for a loss by one score, next Circuit game). Its label states the stake: "NEXT: '96 Bulls · 1 win to Gold Pack". |
| ≤ 8 s | Tap. The curtain shows the opponent for 1.5 s while the engine re-seeds. Tip-off. |

Secondary, smaller: BOX SCORE, HOME. The One-More bar never auto-starts a match; there is no countdown that plays for you. The same sequence ends every mode, including draft seasons ("RUN IT BACK"). Leaving instead shows a two-line **session summary**: what you earned, and what is waiting tomorrow.

**What makes "one more" honest:** it always shows a real, near goal (section D.5), and after the daily goals are done it changes to a calm "You're done for today · Keep playing" state [plan ut-3 step 9].

### D.2 The loops, from 10 seconds to 10 weeks

| Loop | Length | What it is | Built on |
|---|---|---|---|
| **Touch** | 0.5 s | the gold ring, PERFECT | section B.0.1 [new] |
| **Possession** | 10–40 s | Heat builds toward On Fire | B.0.2 [new] |
| **Match** | 4–6 min | grade, Clutch finish | B.0.3–4 [new] |
| **Session** | 15–60 min | 3 daily objectives, the Daily Play, 3 Scout Drops, the Minutes daily ladder; a clear "Done for today" | ut-1/ut-6 objectives; Daily draft (exists); sections D.3, E [new] |
| **Week** | 7 days | weekly objectives, Champions Circuit, Rivals week, Squad Battles ladder refresh, the Minutes weekly track and board, a program wave on Friday | existing UT systems; packs-7 |
| **Week** (social) | 7 days | **the weekly league on capped minutes**: promote, stay or drop; a rival | section E.6 [eng #2] |
| **Season** | 28 days / 6 weeks | Season Pass; **the Perfect Season campaign** (D.4); the league season | `progression.ts` pass (exists); [new] |
| **Career** | forever | **one Career Level across all three sports with a 100-level Career Road, then Prestige** (D.6); collection, card mastery, lifetime Minutes badges, the Hall of Fame | the shared account `xp`/level (exists); D.6; E |

### D.3 The Daily Play [new]

One seeded 60–90 second scenario per sport per day, the same for everyone, built on the deterministic engines (this is the arcade twin of the existing Daily draft, "same spins for everyone").

- Examples: "Down 2, 14 seconds, ball in your star's hands"; "4th and goal from the 6"; "90'+2, free kick at 22 m". Each uses a real era squad and names the player [research basketball §0.20].
- **Three scored attempts a day**, best one counts; unlimited practice attempts after that. Score = outcome + PERFECTS + time.
- **A daily board** (new, additive Nostr board, tag in section E.7).
- **A share card [eng #4]:** a spoiler-free result line plus a small SVG grid, shared as text with a link through the existing `lib/share.ts`, for example `PS NFL #214 · TD in 3 plays · 0:41 · ★★★`. The existing Daily draft gets the same card. This is the Wordle mechanic: one shared puzzle a day, a natural stopping point, and a result worth showing someone.
- First clear of the day: 75 coins and one daily-objective tick. Playing it also keeps the streak (D.13).
- It takes one minute, it is the same for everybody, and it teaches the sport's best skill moment. It is the "open the app" reason that needs no grind.

### D.4 The Perfect Season campaign [new; frames existing modes]

The title promise becomes the season-long goal. Each Season Pass season, a **Perfect Season run** tracks your record across solo UT modes (Squad Battles, Cups, Club Season) as one streak line on Home: "PERFECT SEASON · 11–0".

- Milestones at 5–0, 10–0, 16–0 (NFL-length), 20–0 pay Season Pass points and a cosmetic (a gold nameplate tier). They pay **once per season**, so losing a run is never a coin loss.
- A loss ends the run and starts a new one immediately. **One Mulligan per week** (a streak shield [plan ut-6]) restores it. The best run of the season is kept and shown.
- Rookie-difficulty wins do not count beyond 5–0, so the run asks for real games.
- There is no power reward. It is a status chase, which is what the name sells.

### D.5 Next best action, everywhere

The ut team already specified `nextBestAction()` for UT Home with a fixed priority list and near-miss chips [plan ut-3]. V2 makes it the **spine of the whole app**:

1. **On the main Home** (the draft-mode screen in the owner's screenshot): the big PLAY button gets a one-line **"Next up" strip** directly above it, fed by the same function across draft and UT: "Daily Play ready · 75 coins", "1 win to Finalist", "3 min to a Scout Stamp", "6 rewards to claim". One tap goes there. The four mode tiles stay exactly as named.
2. **After every match:** the One-More bar (D.1) is the same function with match context.
3. **In UT Home:** as planned [ut-3].
4. **One engine, four surfaces [eng #9]:** the same function powers the Home strip, the One-More bar, the session-end summary and (if the owner enables them) notification text. It ranks across all three sports and personalises only by which sport and mode you played most recently.
5. **Priority order (extends ut-3's list):** unclaimed rewards → an unfinished run → streak at risk today → something expiring within 24 h → 1–2 steps from a milestone (a Minutes rung within 5 minutes, the league promotion line, a Career level) → the Daily Play if unplayed → a daily objective at 2 of 3 → Season Pass within 30% of a named reward → new program wave → unopened packs → best next match in your recent sport → **Done for today**.

### D.6 Mastery and progression

- **One Career Level across all three sports. [eng #3]** The profile already shares one wallet, XP and level across sports (`SHARED` in `profile.ts`; the "LEVEL 19" ring on Home; 50 coins a level). V2 makes that the spine: **Career XP** comes from every match, draft run, SBC and Daily Play in any sport, and a **100-level Career Road that never resets** pays something at every level: the existing 50 coins, plus a pack every 5 levels, a profile frame every 10, and cross-sport nudges ("Level 12: a free Gold Pack in Soccer Ultimate Team"). Per-mode levels and the Season Pass stay as sub-tracks. Road rewards replace, and are sized to, today's level-up coins (about 50 a level, a level every 2–3 games), plus roughly one Silver-equivalent per 5 levels.
- **Prestige. [eng #10]** At Career Road level 100 the level rolls into **Prestige 1, 2, 3…**: a permanent star on the badge, a new frame tier and a Prestige board. It never resets and never drops. Cards at max level can be prestiged for a **cosmetic finish only** (applied by copy UID; ids never change). The research's "+1 card level cap" is **not** adopted: it would change ratings used in matches.
- **Player skill, visible. [new]** A per-sport **Touch rating**: your rolling PERFECT rate over the last 50 skill moments, shown on the profile and after matches ("Touch 41% ↑"). It is the cleanest mastery number: it only goes up when you get better.
- **Card mastery. [new; on top of existing card XP/levels in `play.ts`]** Each card has three feats tied to what the player is known for ("10 PERFECT threes with Curry", "5 broken tackles with Henry", "3 goals from outside the box with Beckham"). Completing them earns a mastery star on the card and a cosmetic (gold shoes in-match, a foil corner). **No rating changes**, so nothing here touches online balance.
- **Difficulty ladder** stays Rookie / Pro / All-Star / Legend (`battles.ts`), fixed so harder means a better opponent, not a worse you (NBA-19, NFL D-3, soccer B-3).
- **Evolutions, card levels, Season Pass:** unchanged systems, now fed by in-match feats via objectives.

### D.7 Collection

Existing: sets, the collection gallery, editions, serials, the Pack Tracker. V2 adds meaning rather than systems: once players look like themselves (section C), a squad screen and a binder page are worth looking at; the walkout shows the player moving; set pages show the era kit. **Era pages** in the collection ("1996 Chicago", "2004 Invincibles") get a completion ring and a small one-time coin reward, because "real stars from every era" is a pillar.

### D.8 Social competition (designed for a small population)

The owner's Home screenshot reads "1 online · 0 in queue". The social layer must feel alive with ten players, not ten thousand.

- **Boards that are never empty:** every board shows **your own last week / personal best as a pinned row**, so there is always someone to beat.
- **Asynchronous by default:** the Daily Play board, the weekly Minutes league and boards (section E.6–E.7) and the existing draft and head-to-head boards need nobody online at the same time.
- **Weekly leagues [eng #2]** are the main social stake: six tiers, promotion and relegation on capped minutes, with a threshold fallback that works even with one player (E.6).
- **Later, not now:** friends by Nostr follow and friend quests [eng #12], clubs with a co-op weekly goal [eng #18, XL]. They need group membership and moderation; ship leagues first.
- **Nemesis. [new]** The profile already stores a per-opponent record (`addVs` in `profile.ts`). Surface it: "You're 2–3 vs KOBE4EVER" before an online match and on boards; a REMATCH prompt when your nemesis is in the queue.
- **Rivals, Champions, Head to Head:** names and rules unchanged.
- **The row above you:** every board highlights the next rank and the exact gap ("12 minutes behind MAYA").

### D.9 Live events

- **Friday program waves** with a launch moment [plan packs-7].
- **Era Nights. [new, solo only]** A weekend solo event that pits you against three squads from one era with a readable presentation twist (retro score bug, era crowd colours, era kits) and its own short objective track. No rule changes, so no protocol impact.
- **Double-Heat weekends. [new]** Heat-related *objectives* pay double Season Pass points. The Heat rules themselves never change (online parity).
- **Weekly Showdown [eng #13]:** Era Nights is its first form. Modifier weekends that change rules ("Golden Goal", "2-minute drill only") are solo-only unless that sport's protocol is bumped for a modifier queue.
- All events return on a rotation published four weeks ahead; nothing is "last chance forever".

### D.10 Near-miss and one-more design, done fairly

- Near-miss chips only show **true, deterministic distances** to a goal ("1 win", "120 SP", "4 min") [plan ut-3 `near-miss.ts`]. No fake near-misses in pack reveals: reveal cues must match the awarded card [plan packs-9, D11].
- A loss by one score offers REMATCH first. A third straight loss offers a lower rung or a practice drill instead ("Try the timing drill · 60 s"), not another identical game.
- After a FLAWLESS match the bar says so and offers the harder rung.

### D.11 Healthy-play limits

**Red lines (never ship)** [research engagement §8.2]: no real money or any way to buy coins, packs or time; no casino mechanics (stake wheels, coin wagers, losable entry fees); no fake near-misses or deceptive reveals; no escalating-cost or one-shot-forever offers; **no punishment for not playing** (nothing owned ever decays; league relegation is the only "loss" and it is small, weekly and recoverable); no guilt or shame copy; no social-pressure loops; no notifications at night or more than one a day.

**Must-haves:**
- **"Done for today" states** when the Minutes ladder caps at 90, when dailies are done, and when the 8-paid-games cap is hit, each with "matches still count for your league and Career XP" so stopping is a choice, not a wall [plan ut-3].
- **Paid matches stay capped at 8 a day** (`PAID_GAMES_A_DAY`); Minutes rewards, leagues and boards stop counting at 90 minutes a day. Nothing in the game pays more for a third hour.
- **A break reminder** after 60 continuous active minutes, default on, shown at the next stoppage, one tap to dismiss, never during a live possession.
- **A playtime panel** in Profile: today and this week, counted and raw.
- **Opt out of public boards** with one switch.
- **Rested bonus on return** (E.5) and a 5-day "Back in the Game" mission set after a long break [eng #16].
- **Notifications [eng #15] are opt-in, asked from a button after day 1, at most one a day, quiet 21:00–08:00 local.** The home-screen badge count (`navigator.setAppBadge`) needs no server and ships first. Push needs a small sender function and is an owner decision (F.6).
- **Reduced motion** keeps colour and sound and drops movement.

### D.12 Scout Drops: three free surprises a day [eng #8]

Surprise matters: Brawl Stars' retention only recovered when randomised free drops came back [research engagement §0.3]. Ours are free, capped and honest.

- The **first 3 wins each day**, in any mode or sport, each grant a Scout Drop. Tap to reveal; each tap has a **shown** chance to upgrade a tier (Common 20%, Rare 25%, Epic 30%). The animation never teases a tier that was not rolled.
- **Sized to the real economy:** the ut plan already converts the daily bonus (100 coins + Silver Pack) into a "Scout Reveal" worth about 439 coin-equivalents [plan ut-6]. **Drop 1 is that Scout Reveal**, starting one tier higher. Drops 2 and 3 are small: 20–60 coins, Career XP, or a Scout Stamp, expected value about 40 coins each. **Net addition: about 80 coins a day.**
- After three, wins pay normally. There is no fourth drop, no paid drop and no timer.

### D.13 Streaks with slack [eng #6]

The profile already has a daily streak (`nextStreak` in `missions.ts`). Duolingo's tests show slack raises retention [research engagement §0.4]. Changes:

- **One finished match, draft or Daily Play keeps the streak**, not all dailies.
- **One free Shield a week**, holding at most 2; a **Weekend Off** toggle; a free **Repair** within 48 hours by playing 3 matches.
- Milestone celebrations at 3, 7, 14, 30, 50, 100 and 365 days: a cosmetic and a small pack, never a power item.
- **Not adopted:** the research's optional coin **wager** on keeping a streak. It is a stake that can be lost, which sits too close to the red line above for a game that children may play.

### D.14 Hot Hand [eng #11]

Consecutive wins in any mode raise a flame: 2 wins +10% match coins, 3 wins +20%, 5 or more +25% and a cosmetic flame trail on the ball. A loss drops it **one step**, not to zero. Against the real economy this is at most +25% of 384 = **about +96 coins a day**, typically 20–40. It applies only inside the 8 paid games.

### D.15 The first five minutes and Rookie Week [eng #7]

- **Minute 0–1:** pick a sport and be in a match within 60 seconds, on easy, with the gold ring taught on the first possession.
- **Minutes 2–4:** the starter pack, with Tier A recognisable players (section C).
- **Minute 5:** streak day 1, Career Level 2, the Daily Play teased, 3 of 5 Minutes pre-filled.
- **Days 1–7:** a Rookie Week of 3 tasks a day across modes; the day-7 Player Pick is shown from day 1. This reuses the ut plan's starter chain [plan ut-7].

### D.16 What the hook adds to the economy, in one table

All against the code's real numbers (E.4). Coin-equivalents per day for the engaged 60-minute player:

| Addition | Per day | Note |
|---|---|---|
| MINUTES daily + weekly ladders | ≈ 514 | E.5; hard ceiling 750 at 90 minutes every day |
| League week-end rewards | ≈ 15–64 | E.6 |
| Scout Drops 2 and 3 | ≈ 80 | Drop 1 is the already-planned Scout Reveal |
| Hot Hand | ≈ 20–96 | inside the 8 paid games |
| Daily Play first clear | 75 | |
| Career Road, streak milestones, Perfect Season, mastery | ≈ 0 net | re-skins of existing level-up coins, or cosmetic |
| **Total new** | **≈ 700–830** | on top of ≈ 1,470 today (≈ 1,860 planned) |

That is **about +50% over today's engaged income, or about +40% over the planned overhaul**, and it is why F.6 asks for an explicit economy decision. The lean option (E.5) brings the total to about +30%.

---

## E. MINUTES: the time-played tracker, rewards, leagues and boards

**Name.** In the app it is **MINUTES** (as in "minutes played", a real box-score stat); the unit is the **Active Minute (AM)**. No mode is renamed.

**Sources.** The spec follows `research-engagement.md` §10 (Active Time ladder, caps, leagues, anti-farm). **Its reward sizes are not adopted**: that research assumed "a strong player earns about 1,000–2,000 coins an hour from play". The code says otherwise (E.4), so every number below is re-sized against the real economy. One research warning shapes the whole section: paying for raw time is the reward type most likely to kill intrinsic interest, so time rewards are **capped, framed as milestones, smaller than rewards for playing well, and status-heavy at the top** [research engagement §0.5].

### E.1 What counts as active time

A 1 Hz ticker using `performance.now()` deltas (not the wall clock) counts a second only when **all** of these hold [research engagement §10.1]:

1. The app is visible and focused (`document.visibilityState === 'visible'`).
2. **Only one tab ticks** (a `BroadcastChannel`/`localStorage` lock).
3. The context is an activity with recent input:

| Context | Counts if | Notes |
|---|---|---|
| Live match, any sport or mode, Daily Play, Moments | a gameplay or play-call input in the last **45 s** | Auto-defend alone does not count; paused does not count |
| SIM possessions/drives/phases | real elapsed time only | a 4 s sim counts 4 s; a whole-match SIM counts its few seconds |
| Draft picks, re-spins, lineup | input in the last **30 s** | |
| Draft season sim and playoffs viewing | while it animates, max **3 min per run** | |
| UT squad, SBC, pack opening, store, card detail; menus, boards | input in the last **20 s** | **menu and UT-builder seconds are at most 25% of the day's counted total** |
| Online queue | up to 2 min per queue | |
| Replays and reward sequences | up to 2 min per match | |

4. **Banking.** Match and draft-run seconds are provisional and are **banked when the match or run completes**, or on a forfeit once the match has run ≥ 2 minutes. Menu seconds bank every 60 s.
5. **Input variety [new]:** at least 6 input events in the last 60 s of a match, not all at the same coordinates, so a taped thumb or a one-spot auto-tapper stops the clock.

Raw in-app time (visible, regardless of input) is tracked separately and shown **only to the player** in the playtime panel (self-awareness is a healthy-play feature).

### E.2 Caps

- **Daily cap: 90 AM.** Beyond it, matches still pay their normal coins (up to the existing 8-paid-games cap), Career XP and objectives; they do not count for the ladders, leagues or boards.
- **Weekly cap: 630 AM** (7 × 90). Day and week use the app's existing Eastern-time day key and `weekKey()`.
- **Shape:** most of the value by 30 minutes, the headline at 60, a token at 90, nothing after.

### E.3 How it is stored (additive only)

A new **optional** field on the profile, added to the cross-sport `SHARED` list in `src/lib/profile.ts` (the wallet, level and streak are already shared this way). No existing key or field changes; an old save loads with `playtime` undefined and gets the default.

```ts
// profile.playtime?: Playtime
interface Playtime {
  v: 1;
  life: number;                  // lifetime counted active seconds (already capped per day)
  rawLife: number;               // raw in-app seconds, private, display only
  day: string; daySec: number;   // ET day key; counted seconds today (≤ 5400)
  dayMenuSec: number;            // for the 25% menu rule
  week: string;                  // weekKey(), e.g. "2026-W47"
  weekDays: number[];            // 7 entries of counted seconds, each ≤ 5400
  bySport: { nba: number; nfl: number; soccer: number };   // lifetime seconds
  acts: number; weekActs: number[];   // completed matches/runs (plausibility), lifetime and per day
  claimed: { day: number[]; week: number[]; life: number[] };  // rung indexes already claimed
  league: { tier: number; season: string; best: number; lastWeek?: { week: string; rank: number; am: number; moved: -1|0|1 } };
  pending: number;               // provisional seconds of the activity in progress (dropped if it never banks)
}
```

- **Ticker:** `src/lib/playtime.ts` (new) exposes `usePlaytime(context)`; hosts call it in one line. It writes at most every 15 s and on `visibilitychange`, never on the per-frame path.
- **Cloud save:** rides with the profile; merge = field-wise max for seconds, union for `claimed`, so two devices can neither double-claim nor lose minutes. A relaunch cannot reset a cap because the ledger is in the save.
- **A test loads an old-shape save** and checks every existing field is preserved.

### E.4 The real economy, from the code

| Source (code) | What it pays |
|---|---|
| UT match (`ut/play.ts`: `COINS_WIN = 60`, `COINS_LOSS = 30`, × difficulty `pay` 0.6 / 1 / 1.5 / 2.2 in `battles.ts`) | 30–60 coins at Pro; **only the first 8 games a day pay** (`PAID_GAMES_A_DAY = 8`) → **240–480 coins a day, about 384 at a 60% win rate** |
| The ninth match onward | **0 coins** |
| Draft modes (`packs.ts` header) | about **400 coins a day** from grades, missions (30–80 each) and level-ups (50 a level) |
| UT daily objectives (`progression.ts`) | 50 + 75 + 75 = 200 coins |
| Daily bonus (`daily-hub.ts`) | 100 coins + Silver Pack; login calendar averages about 180 coins a day plus a Silver, a Gold and a pick per 5 days |
| Circuit milestones (`circuit.ts`) | 150 / 350 / 750 coins + Silver / Gold / Spotlight at 2 / 4 / 6 wins |
| Pack prices, NBA (`packs.ts`) | Bronze 250, Silver 400, **Gold 900**, Premium 1,800; quick-sell value is about half the price |

Totals from the ut team's coin-flow table (built from the same constants): an engaged UT player earns about **1,470 coin-equivalents a day today** (about 1,860 after the planned overhaul); a casual one about **1,030** (1,260 after). Raw match coins are only a quarter of that. **An hour of matches pays about 380 coins, and the second hour pays nothing.**

### E.5 The reward ladders, sized to that economy

Rule used: the time ladder's **coins stay below what the matches themselves pay** (so playing well always beats merely playing), and the rest comes as ordinary packs and Scout Stamps.

**Daily ladder** (resets at midnight ET; no streak attached):

| Active minutes today | Reward | Coin-equivalent (packs at quick-sell) |
|---|---|---|
| 5 | 25 coins | 25 |
| 15 | 50 coins | 50 |
| 30 | 75 coins + 1 Scout Stamp | 75 + stamp |
| **60** | **Silver Pack** + 50 coins | 250 |
| 90 | 50 coins + the "Done for today" card | 50 |
| **Total** | **250 coins + Silver Pack + 1 stamp** | **≈ 450** |

**Weekly ladder** (ISO week, counted AM, max 630):

| Weekly AM | Reward | Coin-equivalent | Who reaches it |
|---|---|---|---|
| 60 | 150 coins | 150 | 10 minutes most days |
| 150 | Silver Pack | 200 | 30 minutes, 5 days |
| 300 | **Gold Pack** | 450 | 45 minutes most days |
| 450 | 400 coins | 400 | an hour most days |
| 600 | **Premium Pack** + "Iron Man week" flair | 900 | about 86 minutes every day |
| **Total** | | **≈ 2,100 (300 a day)** | |

**The headline promise:** "An hour a day earns a Silver Pack a day and a Gold Pack a week." (The research's "a Gold Pack a day" would pay 450–900 coin-equivalents for an hour in which matches pay 380; it does not fit this economy.)

**Exactly how much MINUTES adds** (coin-equivalents per day; "today" = the code as it stands, "planned" = after the ut/packs overhaul):

| Player | Counted AM | Daily ladder | Weekly ladder ÷ 7 | **Adds per day** | vs today | vs planned |
|---|---|---|---|---|---|---|
| Casual: 3 matches, ≈ 17 min, 5–7 days | ≈ 120 a week | 75 | 150 ÷ 7 = 21 | **≈ 96** | 1,030 → **+9%** | 1,260 → +8% |
| Regular: 30 min a day | 210 a week | 150 + stamp | 350 ÷ 7 = 50 | **≈ 200** | ≈ 1,250 → **+16%** | ≈ 1,500 → +13% |
| Engaged: 60 min a day | 420 a week | 400 + stamp | 800 ÷ 7 = 114 | **≈ 514** | 1,470 → **+35%** | 1,860 → +28% |
| Maximum: 90 min every day | 630 a week | 450 + stamp | 2,100 ÷ 7 = 300 | **≈ 750 (hard ceiling)** | 1,470 → **+51%** | 1,860 → +40% |

- **In raw coins** the engaged player gets 200 + 21 = **221 coins a day from time, against about 384 from matches**: time pays 58% of what playing pays, and never more.
- **Is it "worth it"?** Today the 9th match of the day pays nothing. With MINUTES a one-hour day pays about 450 more in coins and packs than it does now, a full week of them adds a Gold Pack, and a player who never misses adds a Premium. For the casual player the first 15 minutes pay 75 coins on top of roughly 135 from three matches, which is a 55% lift on match pay for simply finishing a short session.
- **Against the packs ladder [plan packs D5]:** for the engaged player a Program card (6,600–10,000) arrives about 20% sooner and a Legend (40,000–55,000) in about 20 days instead of 25. Every rung scales together, so adjacent rungs stay ≥ 1.5× apart.
- **Against the ut plan's cap:** ut-7 capped the overhaul at +30% for the engaged player and is already at +26.8% without MINUTES. Adding the engaged row above takes the total to about **+62% over today** for a 60-minute-a-day player. **Decision needed (F.6):** accept it (recommended: the addition is hard-capped, front-loaded, mostly packs on the realistic odds curve, and it is what the owner asked for), or ship the **lean table**: all ladder coins × 0.6, the 60-minute Silver on 5 of 7 days, and the 600 rung paying a Gold instead of a Premium (maximum player ≈ +30% over today).
- Packs granted here are ordinary packs: realistic odds, and they count toward Scout Stamps like any other [plan packs-2, packs-6]. NFL and soccer use the same coin numbers; pack values follow each sport's prices. A pack is granted in the sport you are in when you claim.
- **Rested bonus:** on the first day back after 3 or more days away, the 5/15/30-minute rewards are doubled (+150 coins once) and the weekly ladder gets a one-time +60 AM credit. Breaks are rewarded, not punished [research engagement §10.3].
- New players start with **3 of the first 5 minutes pre-filled** (endowed progress [research ultimate-team §7]).

**Lifetime milestones** (lifetime counted AM; never reset; **power stops at 25 hours**, everything after is status [research engagement §10.4]):

| Lifetime hours | Badge | One-time reward |
|---|---|---|
| 1 | Rookie | Gold Pack |
| 5 | Starter | 1,000 coins |
| 10 | Pro (bronze frame) | Premium Pack |
| 25 | All-Star (silver frame) | Player Pick: 1 of 3 golds, 84+ |
| 50 | MVP (gold frame) | profile banner + animated nameplate |
| 100 | Hall of Famer (platinum frame) | a cosmetic card finish for one card of your choice (applied by copy UID; ids never change) |
| 250 | Legend (diamond) | title + Hall of Fame wall entry |
| 500 / 1,000 | Icon / GOAT | neon frame; crown on board rows; a unique gold ground-ring colour in matches |

100 hours takes at least 67 active days because of the daily cap. One-time value up to 25 hours ≈ 450 + 1,000 + 900 + about 1,000 = 3,350 coin-equivalents.

### E.6 Weekly leagues on capped minutes

The weekly social stake [research engagement §9.2 item 2, §10.5]. Score = the week's counted AM (max 630), so the league rewards **showing up, not staying up**.

- **Tiers:** Rookie, Starter, Pro, All-Star, MVP, Hall of Fame. Everyone starts in Rookie.
- **Divisions of about 30,** computed the same way on every phone with no server: sort last week's valid board entries for the tier by pubkey hash with the week key, chunk by 30.
- **Movement:** top 20% promote, bottom 20% relegate (never from Rookie), anyone with 0 AM is simply not shown. Week ends Sunday 23:59 ET; a countdown shows in the last 24 hours.
- **Small-population fallback [new]:** the owner's Home shows "1 online". When a tier has fewer than 10 active entries, movement is by threshold instead of rank: **≥ 300 AM promotes, < 60 AM relegates**, and the division view shows everyone in the tier plus your own last week as a ghost row. The league works with one player.
- **Rewards at week end (sized to E.4):** promote = Silver Pack (Gold Pack from All-Star upward); stay = 100 coins; finish first = a crown for the week (cosmetic). Relegation takes nothing away. Worst case this adds 450 coin-equivalents in a week (about 64 a day) for a player who promotes into the top tiers; typical is 100–200 a week.
- **Season:** 6 weeks; at season end everyone above Pro drops one tier and keeps a season badge of the highest tier reached.
- **Rival:** the player directly above you in the division is shown as this week's rival with the exact gap ("14 min behind MAYA").

### E.7 The boards (additive Nostr tags)

Built like `src/net/leaderboard.ts`: one replaceable, signed `KIND_APP` event per player per board; fetched, validated and ranked on the phone.

- **New, sport-neutral namespace, so no existing tag is touched:**
  - weekly (also the league's data): `perfect-season/minutes/v1/w/<weekKey>` + `NS_SUFFIX`
  - all-time Hall of Fame: `perfect-season/minutes/v1/all` + `NS_SUFFIX`
  - Daily Play (D.3): `perfect-season[/nfl|/soccer]/v1/play/<day>` + `NS_SUFFIX`
- **`BoardKind` gains `'minutes'` and `'play'`** as new union members with new branches in `boardTag`, `readEntry`, `rankRows` and `prune`. A test asserts `boardTag` output for `daily | classic | blind | h2h` is byte-identical before and after.
- **Entry content:** `{ v: 1, name, tier, perDay: [7 ints], acts: [7 ints], s: [nba, nfl, soccer] }` weekly; `{ v: 1, name, hours, acts, s }` all-time.
- **Validation (every reader, untrusted input):** integers only; each `perDay[i]` ≤ 90; no minutes on a future day; sum ≤ 90 × days elapsed; plausibility: no more than 25 counted minutes per completed activity on average, and at least 1 activity per 12 minutes on any day above 30 AM; `created_at` inside the claimed week; updates no more often than every 5 minutes; names through `displayName()`; the existing `BLOCKED` list applies.
- **Views:** default is "near me" (you, two above, two below, the top 3); tabs for League, Global and All-time; a per-sport filter. A **MAX** badge marks 630. Your own last week is always pinned as a ghost row, so no board is ever empty.
- **Ranking ties:** more days active, then more activities, then earliest to reach the score.
- **Honesty about trust:** entries are self-reported and signed, like the existing head-to-head board. A determined spoofer can fake a capped number. **The cap limits the damage to "appears to play 90 minutes a day"**, which any honest regular can reach; global rank pays cosmetics only; league pay is small. QA uses `?ns=inspect` and a local relay and never writes to live relays.

### E.8 Anti-farm and integrity rules

| Threat | Rule |
|---|---|
| Leave the app open | visibility + focus + input recency per context (E.1) |
| Start a match and idle | banks only on completion or a forfeit after ≥ 2 min; 45 s input rule; Auto-defend alone never counts |
| Taped thumb or auto-tapper | the input-variety rule (E.1.5) |
| Loop the draft sim | max 3 counted minutes per run |
| Menu idling | 20 s input rule; menus ≤ 25% of the day |
| Multiple tabs | single-ticker lock |
| Relaunch to reset caps | the ledger lives in the save, keyed by ET day |
| Clock tampering | `performance.now()` intervals; if the device date goes backwards or a day key repeats, accrual freezes for that day |
| Two devices | field-wise max merge; `claimed` is a union, so a rung pays once |
| Forged board entries | E.7 validation; `BLOCKED` as the manual backstop |
| Alt accounts | rewards are per profile and nothing is tradeable |

### E.9 Where it lives in the UI

1. **Home chip (main and UT):** a ring that fills toward the next rung: "23 / 30 min · 75 coins + stamp next". At 60: "Silver Pack ready". At 90: "Done for today. Great session." It feeds the Next-up strip when a rung is ≤ 5 minutes away.
2. **In a match:** nothing on the field. The pause sheet shows "Today 27 min · next reward at 30". Play is never interrupted by a reward or a reminder.
3. **After a match:** the tally shows "+4 active min (now 27) · 3 more for your Scout Stamp", the league position change, and reached rungs under the same CLAIM ALL.
4. **The Minutes screen** (a tab under RANKS, linked from the profile): Today, This Week and Career rails with the next rung enlarged; the league tile ("Pro League · 3rd of 12 · promotion line: 2nd (+12 min) · 2 d 4 h left"); then the board.
5. **Profile:** the playtime panel (today and week, counted and raw), lifetime hours, split by sport, badge tier, and a "hide me from public boards" switch.
6. **One explainer sheet:** "We count time you're actually playing, up to 90 minutes a day. Menus count a little. Idle time doesn't. Rewards stop at 90 minutes so you can do other things. Matches still pay coins as usual."
7. **Never:** red guilt states, "Don't lose your progress!", or any countdown on the daily ladder.

Mock-ups of the chip, the tally and the Minutes screen are in `mockups.html`.

---

## F. Build plan

### F.1 New shared pieces (who writes them)

File ownership follows `OWNERSHIP.md`. `src/net/**` and cloud code belong to the lead only.

| New piece | File (new unless noted) | Author | Consumers |
|---|---|---|---|
| Control geometry tokens (section A.5 table as CSS variables for 393 and 320, scaled by the stage) | `src/game/controls-geometry.css` | **shell** | nba, nfl, soccer |
| Floating stick + sprint ring + pre-held thumb, one component | `src/game/Stick.tsx`, `stick.ts` (pure, tested) | **nba** (first user), reviewed by nfl and soccer | all three |
| The gold ring: window maths, three states, touch-timestamp timing, calibration value | `src/game/perfect.ts` (pure, seeded-safe), `PerfectRing` draw helper | **nba** | all three |
| Heat: state, gains, On Fire spell | `src/game/heat.ts` (pure, deterministic) | **nba** | all three; ut reads it for objectives |
| Match grade and PERFECT counts on the final `Progress` | field `grade` beside the planned `Progress.box` | each sport | ut |
| HUD kit: score bug with Heat bar, toast line, pause button | `src/game/hud/*` | **nba**, small hunks by nfl/soccer | all three |
| Haptic patterns and the PERFECT chime | `src/lib/haptics.ts`; additions to `src/lib/sound.ts` | **shell** (haptics), **soccer** (sound wiring, already theirs) | all |
| Playtime ticker and hook | `src/lib/playtime.ts`, `usePlaytime` | **shell** | Arcade, UT Match, draft screens (one-line calls) |
| Profile field `playtime`, cloud merge rule, Minutes and Daily Play board branches | `src/lib/profile.ts`, `src/lib/cloud*`, `src/net/leaderboard.ts` | **lead** | ut |
| Minutes ladders, claims, tiers | `src/ut/minutes.ts` + tests | **ut** | Home, tally, Minutes screen |
| Next-up strip on main Home, One-More bar, Minutes screen | `next-action.ts` (planned), `Pages.tsx` strip, `MatchDebrief`, a RANKS tab | **ut** | – |
| Daily Play scenarios (3 sports) | `src/game/*/daily-play.ts` | each sport (P1) | ut hosts it |

### F.2 Per team: add, change, cut (in priority order)

#### shell
1. **ADD (P0, into shell-6):** `controls-geometry.css` and the action-safe box variables; verify with the existing fit harness at 393×852 and 320×568 that A/B/C/D never overlap and the safe box is honoured. This is the foundation for all three sports' controls.
2. **ADD (P0, into shell-6):** keep the arena mounted through the result sheet so a rematch needs no reload; target final whistle → next tip-off ≤ 10 s at 4× CPU (D.1). Add this timing to the frame sampler.
3. **ADD (P0, new half-task shared with shell-5):** `src/lib/playtime.ts` + `usePlaytime`, with unit tests for every E.1/E.2/E.8 rule (visibility, single tab, input windows per context, variety, banking on completion, the 25% menu rule, caps, rollover, clock tampering).
4. **ADD (P1):** `src/lib/haptics.ts` three patterns; a "Session reminder" and "Hide leaderboards" setting.
5. **CHANGE (shell-9):** the splash and launch continuity work stays, but the launch lands on the "Next up" strip already resolved (no pop-in).
6. **CUT / push to the buffer:** shell-10's optional fetch-as-JSON (6b) fallback and any offline polish beyond "UT works offline after one online open". The top-edge early ship (shell-2/3) is untouched and still first.
7. **Protocol:** none.

#### ut
1. **CHANGE (ut-3):** `nextBestAction()` gains the V2 priority list (D.5) and is exported for the main Home; add the **"Next up" strip above PLAY** on the main Home inside ut's `Pages.tsx` strip grant.
2. **CHANGE (ut-5):** the end-of-match sequence becomes the 5-second D.1 flow ending in the **One-More bar** at the A-button position, fed by `nextBestAction` with match context. Show grade, PERFECTS and the Minutes ring in the tally.
3. **ADD (P0, new, replaces part of ut-8):** `src/ut/minutes.ts` (the daily, weekly and lifetime ladders with the E.5 numbers behind one constants table, claims, the rested bonus, league tier maths with the small-population fallback), the **Minutes ring chip**, and the **Minutes screen** under RANKS. Local ladders ship first; the league and boards appear when the lead's `leaderboard.ts` branch lands.
4. **CHANGE (ut-7):** the coin-flow table and `scripts/ut_coinflow.ts` add every row of D.16; the economy decision (accept about +50% over today, or the lean table) is escalated on day one.
5. **CHANGE (ut-6):** the planned Scout Reveal becomes **Scout Drop 1 of 3** (D.12); the streak gains slack (one match keeps it, shield, weekend off, repair; D.13); add Hot Hand (D.14) inside `matchRewards`' caller.
6. **ADD (P1):** the Career Road on the existing shared level (D.6), Prestige after 100, the session-end summary, the playtime panel and board opt-out in Profile, `setAppBadge(claimables)`.
5. **ADD (P1, into ut-6):** objectives that read `grade`, PERFECT counts and Heat ("3 PERFECT releases", "reach ON FIRE once"); the Perfect Season campaign line and its weekly Mulligan (shares the planned streak shield).
6. **ADD (P1):** card mastery feats (3 per card archetype, cosmetic rewards), Touch rating on the profile, Nemesis line from the existing `vs` record.
7. **ADD (P1):** host screen for the Daily Play and its board.
8. **CUT / defer:** in ut-8, the navigation-motion polish and applying the visual kit to the least-visited screens move behind items 1–3; Sets rework (M5) stays, Development (M4) rework is deferred. Season Pass v2 stays deferred as already planned.
9. **Protocol:** none (the grade and Heat are read-only here).

#### packs
1. **KEEP as is:** packs-1 to packs-6 (odds curve, disclosure, re-rate, protection, ladder). These are owner decisions 4 and 5.
2. **CHANGE (packs-6):** the ladder-in-days model adds MINUTES income (E.5) and the other D.16 rows; re-check that adjacent rungs stay ≥ 1.5× apart and re-price only if they do not. MINUTES packs are ordinary packs and count toward Scout Stamps.
3. **ADD (small):** the **Player Pick: 1 of 3 golds, 84+** used by the 25-hour milestone and Rookie Week, drawn from the gold curve with an odds sheet; Scout Drop tier tables with their upgrade chances shown; Scout Stamps granted by the 30-minute rung use the planned stamp fields unchanged.
4. **CHANGE (packs-9):** the walkout uses the players team's recognisable sprite and signature celebration; reveal cues must never fake a near-miss (D.10).
5. **ADD (P1, into packs-7):** Era Nights as a rotating solo event entry in the Program Hub; the published return rotation.
6. **CUT / defer:** packs-8's pack-art variety beyond the tier ladder; any new buyable pack kinds.
7. **Protocol:** the re-rate changes ratings used in matches: **all three sports bump** (already recorded in the packs plan).

#### players (the owner's "players don't look how they should" lands here: this team moves up)
1. **CHANGE (players-4/5), now the team's first priority:** adopt the **5-head hero proportions**, the 1.5 px art pixel, native LOD sizes, the `#14121c` outline and 3-tone ramps (C.1). Update the silhouette tests so Shaq and Bol differ by ≥ 3 px in torso width at 34 px.
2. **CHANGE (players-7):** Tier A coverage adds "every player in the first-run flow and each sport's starter pack".
3. **KEEP and protect (players-2):** the near-first sprite budget. It is a hard dependency: 81% of the nearest NFL sprites are stale today (A-1).
4. **CHANGE (players-8/9):** implement the frame plans in B.1.6, B.2.6 and B.3.6 in this order: locomotion without skating → NFL juke/throw/handoff/sack → soccer touch/shot/keeper/slide → NBA crossover/step-back/contest → celebrations. Use the five unused mocap clips first (A-3).
5. **ADD (P1, into players-9):** crowd front rows as 4-frame sprites, bench and coach idles, the venue palette from C.2 (in `persp.ts`/floor drawing, shared with the sport teams).
6. **CHANGE (players-3/6):** card faces use the signature-pose pixel bust; frame silhouettes per C.4.
7. **CUT / defer:** `PlayerPortrait` on every secondary surface (keep cards, squad, walkout, match intro; defer binder and poster); the long tail of celebration variants beyond 4 per sport.
8. **Protocol:** none (render-only; keep the import-graph test that proves it).

#### nba
1. **CHANGE (nba-3):** build the shared `Stick`, the A/B/C/D cluster from the geometry tokens, swipes that start on A, CALL radial with ISO. Deliver it as the reference the other two sports copy.
2. **CHANGE (nba-4):** the meter becomes the **gold ring** (`perfect.ts`): ±30 ms floor, three states, gold never lies, touch timestamps, calibration. Rating-scaled ring size on screen ≥ 8 px.
3. **CHANGE (nba-2):** the camera in B.1.3 (three-quarter, 12° yaw, fixed zoom near the rim, safe-box anchoring) and the HUD kit (bug + Heat bar + toast line + pause).
4. **KEEP (nba-5, nba-6):** fouls, free throws, real misses; defense by default with Auto-defend and SIM; overtime.
5. **ADD (into nba-7):** timing cues on CONTEST and STEAL; the ankle-breaker gold flash; ramped move velocities.
6. **ADD (new, small, with nba-4):** `heat.ts` and On Fire; match grade on `Progress`.
7. **ADD (P1, into nba-7):** transition possessions from steals and long rebounds (already in the plan's cut line: promote it).
8. **KEEP (nba-8, nba-9):** usage, eras, difficulty ladder, pause/quit/forfeit, box score.
9. **CUT:** nba-10's planning cards (play/look cards) are dropped: the CALL radial covers the planning beat and the cards cost time per possession. Hot/cold zone floor art stays P1.
10. **ADD (P1):** Daily Play scenarios for NBA.
11. **Protocol:** **NBA draft 10 → 11 and UT 10 → 11** (windows, fouls, format, Heat, moves).

#### nfl
1. **KEEP first (nfl-1):** the momentum carry (C-1). It is the single biggest feel fix in the sport.
2. **CHANGE (nfl-3):** the 124 px tray with SNAP on A, line of scrimmage at 45%, dynamic zoom, 34 px near players, run-lane arrow; HUD kit.
3. **CHANGE (nfl-4):** receiver icons over heads + slingshot + always-on landing reticle; pocket stick; context A slot (RUN IT / THROW AWAY). Adopt the shared `Stick` with **burst on the ring** and a "Burst button" preference (owner device check; CLAUDE.md's separate skill buttons are kept).
4. **CHANGE (nfl-7):** the tackler wind-up ring becomes the gold ring for JUKE/SPIN; truck charge on C; wrap-tackle contests; run tails.
5. **CHANGE (nfl-8):** BIG HIT and PICK rings on defense key snaps; played takeaway returns.
6. **ADD (with nfl-3):** Heat replaces the standalone On Fire meter (same visuals, shared rules); one ability pop per play.
7. **KEEP (nfl-2, nfl-5, nfl-6, nfl-9, nfl-10):** pause/OT, AI brain, passing realism, kicking and box score, final fit.
8. **CUT / keep deferred:** Precision Passing extras, hot routes, crowd pressure, earned-zone abilities (all already deferred; V2 agrees).
9. **ADD (P1):** Daily Play scenarios for NFL.
10. **Protocol:** **NFL draft 10 → 11 and UT 11 → 12.**

#### soccer
1. **KEEP first (soccer-1):** the rule bugs: frozen ball (R-1), parry direction (R-2), bend inversion (C-4).
2. **CHANGE (soccer-2):** adopt the shared `Stick` and the A/B/C/D cluster; **add the TRICK button on D** and the lofted THRU hold; toast line replaces the hint over the goal.
3. **KEEP (soccer-3):** the portrait camera at about 34 m with edge markers and safe-box framing. This is the largest visual change in the sport.
4. **PROMOTE (Appendix A → P1, scheduled inside soccer-5 and soccer-4):** touch-based dribbling (ball winnable between touches), shot types on SHOOT, star-gated TRICK moves, shielding. If only one fits, ship touch dribbling: it fixes B-1 and creates the tackle timing skill.
5. **CHANGE (soccer-4):** SHOOT uses the gold ring with a range gate and distance-scaled wind-up (0.35–0.62 s).
6. **CHANGE (soccer-8/9):** TACKLE with the between-touches ring; CONTAIN hold; KEEPER on D; **reflex save** as P1 solo-only.
7. **ADD (with soccer-3):** Heat bar and On Fire; goal moments for the rival's goals too.
8. **KEEP (soccer-6, soccer-7, soccer-10):** weighted deal and earned set pieces, match shell and box score, QA.
9. **CUT / keep deferred:** formation templates (Appendix B), commentary ticker (Appendix C), substitutions, the swipe-to-dive shootout keeper (P2).
10. **ADD (P1):** Daily Play scenarios for soccer.
11. **Protocol:** **soccer draft 2 → 3 and UT 2 → 3.**

#### lead (integration)
1. Profile `playtime` field + cloud merge + old-save test; `leaderboard.ts` branches for `minutes` and `play` with the byte-identical-tags test.
2. One protocol bump per sport at integration (F.3).
3. Unify the three sports' `autoDefend` preferences (already flagged by the soccer plan).
4. The economy decision (D.16, E.5) and the owner device checks: burst on the stick ring, the NBA defensive camera, 5-head proportions on a real phone.

### F.3 Protocol bumps

| Change | Alters match outcomes? | Bump |
|---|---|---|
| Gold ring windows, "gold never lies", touch-timestamp timing | yes | NBA, NFL, soccer (draft + UT) |
| Heat and On Fire | yes | NBA, NFL, soccer |
| NBA fouls/free throws/misses/turnovers/usage/eras/transition/move ramps/overtime | yes | NBA draft 10 → 11, UT 10 → 11 |
| NFL momentum carry, pocket movement, passing/run/tackle models, burst on the ring (input mapping only if stamina maths is unchanged), OT | yes | NFL draft 10 → 11, UT 11 → 12 |
| Soccer rule bugs, shot model, touch dribbling, shot types, tricks, fouls, deal | yes | soccer draft 2 → 3, UT 2 → 3 |
| Re-rated cards used in matches (packs-5) | yes | all three (already planned) |
| Solo defense, Clutch staging, grade, cameras, HUD, controls layout, floating stick | no (solo-only or presentation/input layer) | none |
| Appearance, proportions, animation, venues, crowd, juice, haptics, audio | no (render-only; proven by the import-graph and state-hash tests) | none |
| MINUTES, leagues, Daily Play boards, Next up, One-More, Scout Drops, Hot Hand, streak slack, Career Road, Prestige, Perfect Season campaign, mastery | no (cosmetic or economy only; no rating or rule changes) | none (new board tags are additive) |

**Net: one bump per sport, done once by the lead at integration:** draft NBA 11 / NFL 11 / soccer 3; UT NBA 11 / NFL 12 / soccer 3. Old and new clients never meet.

### F.4 The "first impression" slice

The smallest set that makes someone who played last week say "this is a different game" in the first 60 seconds. Owner decision 6 says everything after the top-edge fix ships together; this slice is therefore **the build order and the must-not-slip list**, and it is also a coherent early release if the owner chooses to ship in two steps.

| # | Item | Team | Why it is in the slice |
|---|---|---|---|
| 1 | iPhone top edge | shell | already first (decision 6) |
| 2 | Shared floating stick, A/B/C/D cluster, pre-held thumb, sprint ring, pause button, in all three sports | shell + nba → nfl, soccer | "buttons" (NBA-12/13/17, NFL C-6, soccer C-1) |
| 3 | Cameras and the action-safe box | nba, nfl, soccer | you can finally see the play (NBA-20, NFL P-1/V-1, soccer V-1) |
| 4 | NFL momentum carry; soccer frozen ball, parry and bend bugs; NBA live shot clock | nfl, soccer, nba | the worst "it's broken" moments (C-1, R-1, R-2, C-4, NBA-08) |
| 5 | The gold ring with honest windows, the PERFECT chime and haptic, the toast line | nba → nfl, soccer | the game's new verb (NBA-14/15) |
| 6 | 5-head sprites, appearance data with Tier A for first-run and starter players, calmer venues | players | "players don't look how they should" (L-1 to L-4, NBA-26, V-2, A-2) |
| 7 | Near-first sprite budget + locomotion without skating | players | "animations, movement" (A-1, NBA-23, A-5) |
| 8 | One-More bar, "Next up" on Home, Minutes ring with the daily and weekly ladders (local), "Done for today" | ut + shell | the hook and the owner's time rewards [eng #1, #5, #9] |

Second wave: solo defense in all three with its rings, Heat, fouls and realism fits, the weekly league and Minutes boards, the Daily Play with its share card, Scout Drops, streak slack, the Career Road, shot types and tricks, signature motion, card busts, Perfect Season campaign, mastery. Third wave: Era Nights, reflex save, transition, crowd sprites.

### F.5 What V2 invents (so nobody mistakes it for measured fact)

The gold-ring unification and "gold never lies" as a cross-sport rule; Heat's numbers; the Clutch staging; the match grade; the exact control coordinates; burst on the stick ring for NFL; ISO in the NBA radial; the ankle-breaker flash; the TRICK button; the one-two; the reflex save; 5-head proportions and the 1.5 px art pixel; all colour tokens for venues and chrome; the One-More timing; the Daily Play; the Perfect Season campaign; Touch rating; card mastery; Nemesis surfacing; Era Nights; every MINUTES number. Each is a starting value to be tested on the owner's phone and fitted with the existing harnesses.

### F.6 Decisions the owner or lead must make

1. **Economy ceiling:** the whole hook adds about +50% to today's engaged daily income (D.16), of which MINUTES is about +35% for a 60-minute day and +51% at the 90-minute cap. Accept (recommended) or ship the lean table (about +30% in total).
2. **Burst on the stick ring in NFL** instead of a held button (device check).
3. **Big-head sprites:** approve from `mockups.html` and one on-device build.
4. **Two-step release** (the F.4 slice first) or one release as decided on 2026-11-09.
5. **NBA planning cards cut** in favour of the CALL radial.
6. **Soccer Appendix A promoted** into this release.
7. **Push notifications:** the badge count ships; real push needs a small sender function on the existing backend and an explicit yes (opt-in, one a day, quiet hours).
8. **No streak wager** (D.13): confirm it stays out.

### F.7 How the engagement research was folded in

`design-v2/research-engagement.md` ranks 22 mechanics. V2's position on each:

| # | Mechanic | V2 |
|---|---|---|
| 1 | Active Time ladder + "Done for today" | **Adopted**, re-sized to the real economy (E.5): Silver a day and Gold a week instead of Gold a day |
| 2 | Weekly leagues on capped minutes | **Adopted** with a small-population threshold fallback (E.6) |
| 3 | Career Level + Career Road | **Adopted** on the existing shared level (D.6) |
| 4 | Daily challenge + share card | **Adopted** as the Daily Play (D.3) |
| 5 | Post-match "One More" | **Adopted** (D.1), in the first-impression slice |
| 6 | Streak with slack | **Adopted without the coin wager** (D.13) |
| 7 | First five minutes, Rookie Week | **Adopted** (D.15) on the ut starter chain |
| 8 | Scout Drops | **Adopted**, merged with the planned Scout Reveal (D.12) |
| 9 | App-wide next-best-action engine | **Adopted** (D.5) |
| 10 | Prestige | **Adopted, cosmetic only** (D.6) |
| 11 | Hot Hand | **Adopted**, capped at +25% (D.14) |
| 12 | Rivals and friends | Rival and Nemesis now (D.8, E.6); follows and friend quests later |
| 13 | Weekly Showdown | Era Nights now (D.9); rule modifiers solo-only |
| 14 | Draft meta-progression and Heat modifiers | **Deferred**; note the name clash with in-match Heat (B.0.2): call the draft version "Stakes" if built |
| 15 | Notifications and badge | Badge now; push is an owner decision (F.6) |
| 16 | Rested bonus, return missions | **Adopted** (E.5, D.11) |
| 17 | Lifetime milestones, Hall of Fame, recap card | **Adopted** (E.5, E.7); the season recap card is P2 |
| 18 | Clubs | **Deferred** (XL, needs moderation) |
| 19 | Juice pass | **Adopted** (B.0.5 and each sport's juice list) |
| 20 | Card and team mastery | **Adopted, cosmetic only** (D.6) |
| 21 | Scenario Road | **Deferred**; the Daily Play scenarios are its seed content |
| 22 | Healthy-play kit | **Adopted** (D.11) |

Where V2 departs from that research: its reward sizes assumed 1,000–2,000 coins an hour from play, and the code pays about 380 in the first hour and nothing after, so every amount was re-derived (E.4–E.5, D.16); the streak wager and the card-level-cap prestige are refused; leagues gain a fallback for a population of one.
