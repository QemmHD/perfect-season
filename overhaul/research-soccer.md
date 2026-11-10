# Soccer research: what the respected games do, real-football calibration, and what to build

Research track: soccer. Prepared 2026-11-09 for the Perfect Season studio overhaul (read-only research;
the repo was not edited). Scope: EA SPORTS FC 25 / 26 / 27 on console and PC, EA SPORTS FC Mobile,
eFootball (console and mobile), the mobile arcade references (Retro Goal, Score! Hero, Dream League
Soccer, Pixel Cup Soccer, Football Manager Touch and FM26), the classic Sensible Soccer, and real-football
statistics for calibration. Each section ends with what it means for **our** game: an iPhone PWA arcade
soccer game with pixel-art players, touch controls (virtual stick and buttons) and an Ultimate Team mode,
which must stay original (no brand names or assets).

**Method notes.**
- About 55 web searches and fetches went to official EA, Konami and Sports Interactive pages, patch
  notes, Opta / The Analyst and Premier League data pieces, reviews, wikis and community forums.
- The search budget shared by all agents ran out partway through. Physical tracking data (top speeds,
  distance covered) and a few community sources were not verified. They are flagged where they come up.
- To get distance-binned conversion rates that no web page published, I downloaded the public
  StatsBomb open-data shot set (Hugging Face `ClementeH/statsbomb-open-data-shots`, train split, 70,426
  shots from La Liga, Premier League, Serie A, Bundesliga, Ligue 1, World Cups, Euros and others) and
  computed the tables in section 6.2 myself. Script:
  `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/scripts/shots.py`
  and `shots2.py`. Source: https://huggingface.co/datasets/ClementeH/statsbomb-open-data-shots
  (CC BY-SA 4.0).
- Our engine's current state comes from `docs/SOCCER-ENGINE.md` and `docs/SOCCER.md` in
  `/home/user/ps-studio`. In summary: 7 "attacks" per side (3 a half plus stoppage time), each a seeded
  scenario (build-up, counter, wide overload, corner, free kick, penalty from fouls). There are 30 s of
  open play per attack, a joystick, SPRINT, PASS/THRU and a hold-drag-release SHOOT meter (green at
  0.62 s). Cards have six face stats, and the soccer online protocol is draft 2 / UT 2.

---

## 0. The 20 recommendations that matter most

1. **Shot types on one button, no new buttons.**
   - Hold-drag-release SHOOT stays as the normal (placed) shot.
   - A curved drag gives a **finesse** shot (FC Mobile's gesture rule).
   - A quick upward flick off the button gives a **chip**.
   - A **double-tap** gives a **low driven** shot (FC 26's input).
   - Holding past the green into a red "power zone" gives a **power** shot: longer wind-up, faster ball,
     less accurate.

   Section 7.1 has the parameters.
2. **Shrink the release meter's grip on accuracy.**
   - FC removed Timed Finishing in FC 26 because green-timed long shots became "too reliable" and it
     "didn't add meaningful skill depth" (§1.4).
   - Our meter changes the error cone by 6.4× (0.5 to 3.2). Cap it at about 0.8 to 1.6.
   - Let attributes, distance, angle, pressure, body shape and shot type decide the rest.
3. **Re-shape conversion by distance to match real football (§6.2), times an arcade factor of about 1.6.**
   - Real foot shots convert 56% inside 6 yd, 20% at 10–12 yd, 11% at 16–18 yd, 7.6% at 18–20 yd and
     2.5% at 25–30 yd.
   - Our edge-of-box drill (38–44% in the release tuning) is 4–5× real.
   - Target 12–18% for a clean edge-of-box look by a 75 finisher, and 20–25% for an elite finisher with
     the curl trait.
4. **Make counters the best open-play chance, not the worst.**
   - Real counter-attack shots convert 15.8% versus 10.7% from regular play (§6.2).
   - Ours run counter 10.3% < build-up 13.3% per attack.
5. **Rebalance set pieces by their share of goals, not by the per-corner rate.**
   - Real: set pieces are about 20% of goals. Per shot, corner-sequence shots convert 8.7% and direct
     free kicks 5.2–6.4% (§6.1, §6.2).
   - One dealt corner stands for about 5 real corners, so a corner *attack* scoring about 10–12% is fine.
   - What's wrong is the mix. We deal a corner and a free kick in every match, and open play converts
     only 10–13% (autopilot), so set pieces make up about 32% of our goals.
   - Fix: deal from a weighted bag and raise open-play conversion (§7.6).
6. **Add Counter Chances: let the player defend.** FC Mobile's attack-only mode includes AI attacks
   that you defend. Use one jockey/tackle button, auto-switch you can turn off, and a slide by swipe
   (§2.3, §7.4).
7. **Acceleration archetypes from card stats and height.**
   - FC 26 has three: Explosive (Agility ≥ 65, Agility − Strength ≥ 10, Acceleration ≥ 80, ≤ 182 cm),
     Lengthy (Strength ≥ 65, Strength − Agility ≥ 4, Acceleration ≥ 40, ≥ 183 cm) and Controlled.
   - Map them onto PAC/DRI/PHY and `ht` under original names (§1.2, §7.3).
8. **Skill moves by swipe, gated by a skill-star tier and limited to 3 in a row.**
   - The three tiers follow FC 26's simplified mapping (§1.2, §7.3).
   - Each chained move is slower and adds touch error (FC Mobile, §2.2).
9. **First-time and back-to-goal penalties.** FC 26 made 135° and 180° first-time passes "significantly
   less accurate". Apply an angle-based error multiplier to first-time passes and shots (§1.3, §7.2).
10. **Traits ("PlayStyle"-like) with a gold "+" tier, under our own names.**
    - Keep them modest, because FC 26 and FC 27 walked back trait power so that "attributes have a bigger
      role" (§1.5, §7.13).
    - A trait should add 8–15%, never decide an outcome.
11. **Roles with familiarity drive AI teammates' runs** inside each scenario (FC 25's roles; familiarity
    weighs 10–40% of positioning; §1.6, §7.7).
12. **Keepers steer parries wide.** FC 26 steers deflections out of bounds or into space to cut cheap
    rebounds. Use real save% by distance as the target (23% inside 6 yd to 92% from 25–35 yd; §6.2, §7.5).
13. **AI defenders must not auto-tackle the dribbler.** FC 27 removed this after complaints, and a
    reviewer said constant AI tackling made it "impossible to develop any sort of flow" (§1.1, §1.7).
14. **Animation fidelity rules for the pixel rig:**
    - anticipation (backlift) scales with shot power;
    - the contact frame is locked to the ball's launch;
    - feet are planted, with no skating;
    - turn radius grows with speed;
    - the keeper sets (split step) before every dive;
    - better DEF unlocks more tackle animations (FC 26: below 71, 71–84 and 85+ unlock more).

    See §7.9.
15. **The post-match stats sheet must look like real football**: shots 26 per match (34% on target),
    xG, possession, about 900 passes at 84%, corners about 10, fouls about 22, cards about 4.3, and
    saves. Generate the unplayed minutes from the real distributions (§6.1, §7.12).
16. **Shot map and xG on every shot** (FM26 uses xG in its dugout advice). "Big chance" means
    xG ≥ 0.30, and a big chance should go in about 40% of the time (§6.1, §6.2).
17. **Dynamic highlights.** FM26 shows more highlights when a game is close and fewer at 4–0. Scale our
    stoppage-time attack and replays by drama (§4.5, §7.10).
18. **Touch settings FC Mobile players expect**:
    - button spacing and joystick size;
    - power-up rate;
    - auto-switch off, with an exception for crosses and lofted balls;
    - "keep running on release";
    - a gestures-only mode.

    See §2.1, §7.11.
19. **Ultimate Team soccer card face:**
    - skill stars, weak-foot stars, acceleration archetype, traits with a "+" tier, and roles with
      familiarity pips;
    - pack odds shown as minimum probabilities (EA's format), plus a cosmetic "foil variant" roll of
      about 5% on special pulls (FC 27's Holographic Variant).

    See §7.13.
20. **Protocol.** Every engine change above alters how attacks resolve. Bump **soccer draft 2 → 3 and
    UT 2 → 3** together and leave NBA and NFL alone (BRIEF hard constraint).

---

## 1. EA SPORTS FC on console and PC (FC 25 → FC 26 → FC 27)

### 1.1 What the series is optimising for now

- **Two presets, from FC 26.** *Competitive* is "tuned for added responsiveness and higher player
  control". It is mandatory in Ultimate Team, Clubs and online. *Authentic* is "tuned for higher realism
  and true-to-life match tempo/speed" and is the default in Career
  (https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive). In Competitive,
  short- and long-term fatigue affect **only AI-controlled players**, and the user's player is unaffected
  (same source).
- **Reception of FC 26.** Reviewers called it "arcade-fast, fluid and energetic". They praised rebounds,
  kickoff goals and "clunky ball physics" being "much less noticeable". But defending felt like "trying
  to plug leaks in a dam" and some matches ended "basketball-like"
  (https://www.khaleejtimes.com/entertainment/gaming/ea-fc-26-review-fast-fluid-and-finally-listening-to-the-fans).
- **FC 25 reception.** PS5 77 and Xbox 70 on Metacritic, 63% recommended on OpenCritic, and Best
  Sports/Racing at The Game Awards 2024. EA said it underperformed financially
  (https://en.wikipedia.org/wiki/EA_Sports_FC_25).
- **FC 27 (released 18 September 2026)** shifts control back to the user. AI defenders "no longer
  auto-tackle a dribbler who comes close", their interception reach is smaller, and the manual defender
  reaches further. It adds triggered curved runs (L1+R1) and Pass & Follow runs (L1+R1+X), and a corner
  "Avoidance" mechanic (hold R1)
  (https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-gameplay-deep-dive).
- **FC 27 reception.** An early review found the AI defence "a little too aggressive… impossible to
  develop any sort of flow or rhythm", and the corner system "ridiculously overpowered": over half of the
  reviewer's goals came from corners
  (https://www.gfinityesports.com/article/fc-27-review-promising-ideas-undermined-by-poor-execution).

**Lesson for us.** Players reward *responsiveness*: input→action latency, snappy close-range finishes and
few AI-decided outcomes. Two failures cost the series the most goodwill: AI defenders that take the ball
for you, and exploitable set pieces or long shots.

### 1.2 Locomotion, dribbling, skill moves, first touch

**Acceleration types (FC 26, exact thresholds).** Source:
https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive

| Type | Rule | Feel |
| --- | --- | --- |
| Explosive | Agility ≥ 65, Agility − Strength ≥ 10, Acceleration ≥ 80, height ≤ 182 cm (male) | fastest first 5–10 m, lower late |
| Lengthy | Strength ≥ 65, Strength − Agility ≥ 4, Acceleration ≥ 40, height ≥ 183 cm | slow start, strong top end |
| Controlled | everyone else | linear |

FC 26 "return[ed] to three acceleration types" for "a more predictable pace of play" (same source).

**Dribbling and movement.**
- **Controlled Sprint** (FC 24): a speed between jog and sprint with "more controlled touches, keeping
  the ball closer" (https://www.ea.com/games/ea-sports-fc/pitch-notes/news/fc-24-gameplay-deepdive).
- **FC 26 removed Agile Dribbling** for "low usage", raised jog-dribble speed, made the jog Drag Back
  "10% more effective", and keeps the ball closer on skill moves while sprinting (FC 26 deep dive).
- **FC 25** removed Orbit Dribble and added Effort Dribble and Let Ball Run
  (https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive).

**Simplified skill moves (FC 26).** Right-stick direction × skill-star tier. Source: FC 26 deep dive.

| Stars | Forward | Left/Right | Back |
| --- | --- | --- | --- |
| 1–2 | Low Skill Roulette | Ball Roll | Feint Forward and Turn |
| 3–4 | Roulette | Stop and Turn | Feint Forward and Exit |
| 5 | 3-Touch Roulette | Drag Turn | Flair Nutmeg 180 |

- Skill moves are "limited to 3 in a row, and they take longer and are more error-prone".
- New in FC 26: Explosive Stepover (3–5★), Advanced Heel Flick (4–5★), Drag To Chop (4–5★), Elastico
  Variation (5★) and Trickster Rainbow (1–5★).
- FC 27 adds stepover combos, FakeTurn, Ball Roll Spin and Kneel Header (FC 27 deep dive).

**First touch and physicality (FC 26).**
- **First Touch Precision** (hold L2): an earlier input gives more control at the cost of speed.
- Consecutive flick-ups get "progressively less effective".
- **Shield Trap** (hold L2).
- Contested box-outs are decided by the **Strength difference**.

(FC 26 deep dive.)

**FC 27 off-balance dribbling** is driven by Balance, Agility and Dribbling (FC 27 deep dive).

### 1.3 Passing

- **Pass types.** FC 25/26 use ground, through, lofted, lobbed through and driven passes. FC 24 added
  **Precision Pass**, a manual bend and shape. Swerved versions require "power of the pass above (40)",
  and accuracy weights **Long Passing and Short Passing**, with "Vision and Composure contributing to a
  lesser extent, Curve for Swerve attempts" (https://ea.com/games/ea-sports-fc/news/fc-24-gameplay-deepdive).
- **FC 26 changes** (FC 26 deep dive):
  - **first-time 135° and 180° through passes are "significantly less accurate"**;
  - passing angles cover a broader range;
  - short, low-power passes use faster animations;
  - lob passes are more driven when the path is clear;
  - in Competitive, first-time pass accuracy is reduced.
- **FC 26 1.0.2 patch.** Driven ground passes are "less accurate on difficult attempts, such as
  first-time passes taken at 180 degrees". It also fixed ground passes falling behind the receiver
  (https://beebom.com/ea-fc-26-first-update-1-0-2-patch-notes).
- **FC 27.** "Ground and lobbed through passes strictly follow directional input", and dinked passes are
  fully manual (FC 27 deep dive).

**Lesson.** The direction the player has to turn through is the single most important passing-error
input after the PAS rating. Our engine already scales error under pressure (×1.35) and when sprinting
(×1.15). It does not yet scale by turn angle on first-time balls.

### 1.4 Shooting, and the rise and fall of the timing meter

**FC 26 shot types and inputs** (FC 26 deep dive):
- **Lace** (normal) shot.
- **Finesse** (R1 + Shot).
- **Power Shot** (L1+R1+Shot).
- **Chip.**
- **Trivela**, which since FC 26 needs the Gamechanger trait.
- **Flair.**
- **Volley** and **Header.**
- **Low Driven** is now a "global modifier" (except for chips): double-tap the shot button after powering
  up.
- Close-range shots use "more reactive animations with minimal wind-up".

**Timed Finishing history.**
- Introduced in FIFA 19. A second tap at contact gives red or yellow (too early: more error), **green**
  (perfect) or white (too late: no effect)
  (https://www.ea.com/games/fifa/news/fifa-19-pitch-notes-gameplay).
- A fan summary of FIFA 20 says the green window was cut "from 2–4 frames to 2 frames for all shots".
  I could not find the EA note itself, so treat this as secondhand
  (https://www.magicgameworld.com/?p=39804).
- **FC 26 removed it.** EA: "We felt Timed Finishing didn't add meaningful skill depth and proved
  difficult to balance… Removing it allows us to balance shooting to produce more consistent outcomes."
  The problem it named was that green-timed **trivela and finesse shots from outside the box** had become
  a reliable way to score (https://insider-gaming.com/is-timed-finishing-in-ea-fc-26/).
- Some players still want it back, saying shots from outside the box are "basically not an option"
  without it (https://forums.ea.com/discussions/fc-26-general-discussion-en/bring-back-timed-finishing/13032051).

**Patches after launch show what goes wrong** (FC 26 1.0.2, 1.0.4, 1.4.3 and 1.5.0; FC 27):
- "Low Driven Shots less accurate when shot with extreme power" (1.0.2,
  https://beebom.com/ea-fc-26-first-update-1-0-2-patch-notes).
- Finesse shots "curl[ed] in the wrong direction or accidentally trigger[ed] Trivela" (1.0.4).
- Finesse shots with the trait were "sometimes unexpectedly slow" (1.4.3,
  https://mp1st.com/title-updates-and-patches/ea-sports-fc-26-update-1-4-3address-finesse-shot-playstyle-issues-patch-1-17-1-000-016).
- In FC 27, "attributes have a bigger role in shot outcome" for Finesse, and Low Driven "shot speed boost
  is removed" (FC 27 deep dive).

**Lesson.** A pure timing check on top of a strong rating creates a dominant long-range strategy. Fix it
in two ways: make the result depend continuously on context, and make long range genuinely hard.

### 1.5 Traits (PlayStyles): the full current list and the direction of travel

FC 27 lists base (silver) and "+" (gold) tiers in six groups
(https://www.ea.com/games/ea-sports-fc/fc-27/news/what-are-playstyles):

- **Finishing (7):**
  - Acrobatic: volleys;
  - Chip Shot;
  - Dead Ball: set-piece speed, curve and accuracy, and a longer trajectory preview;
  - Finesse Shot: faster, more curve, more accurate;
  - Gamechanger: fancy and trivela shots;
  - Low Driven Shot;
  - Precision Header.
- **Passing (6):**
  - Incisive Pass: through balls, swerve, precision passes;
  - Inventive;
  - Long Ball Pass: lobbed and lofted through balls, harder to intercept;
  - Pinged Pass: faster ground passes;
  - Tiki Taka: first-time and short passes;
  - Whipped Pass: crosses.
- **Ball control (5):**
  - First Touch: less trap error, faster transition to dribbling;
  - Press Proven: close control at jog, shielding;
  - Rapid: faster sprint dribbling, fewer knock-on errors;
  - Technical: faster Controlled Sprint, tighter wide turns;
  - Trickster: flick skill moves.
- **Defending (6):** Aerial Fortress, Anticipate (stand tackles), Block (reach), Intercept, Jockey (faster
  sprint-jockey and exit), Slide Tackle.
- **Physical (5):** Bruiser (strength in tackles), Enforcer (shoulder challenges, shielding), Long Throw,
  Quick Step (faster acceleration in Explosive Sprint), Relentless (less fatigue, faster half-time
  recovery).
- **Goalkeeper (6):** 1v1 Close Down, Cross Claimer, Deflector (parries to safer areas), Far Reach (long
  dives), Far Throw, Footwork (low shots).

**Direction of travel:**
- **FC 26** added Enforcer, Aerial Fortress, Precision Header, Gamechanger and Inventive, and removed
  Power Header, Aerial, Trivela and Flair. EA's stated reason: "In many cases, high-rated players without
  PlayStyles were underperforming on core mechanics." High base attributes now unlock some behaviour
  without the trait (https://insider-gaming.com/every-ea-fc-26-playstyle-change-explained/).
- **FC 27** trimmed traits again:
  - Rapid's boost "slightly reduced";
  - Quick Step reduced, "giving Acceleration more importance";
  - Pinged Pass and Tiki Taka lose their trap-error reduction;
  - Low Driven loses its speed boost;
  - the gap between base and "+" is narrowed on Technical and Precision Header.

  (FC 27 deep dive.)

**Lesson.** Traits are great for card identity and for animation variety, but they must stay *modifiers*.

### 1.6 Tactics and roles (FC IQ, FC 25)

Source: https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-fc-iq-deep-dive

**Roles.**
- **31 roles and 52 role+focus combinations at launch.** Work Rates and Player Instructions were removed.
- Examples: ST = Advanced Forward, Poacher, False 9, Target Forward. W = Winger, Inside Forward, Wide
  Playmaker. FB = Fullback, Wingback, Falseback, Attacking Wingback. CM = Box-to-Box, Holding,
  Deep-Lying Playmaker, Playmaker, Half-Winger. GK = Goalkeeper, Sweeper Keeper.

**Familiarity.**
- The levels are: base, "+" (accomplished; every player has at least one) and "++" (world-class). Playing
  out of position simplifies the role.
- Familiarity "is used in every formula, accounting for roughly **10% to 40%** of the result".
- It changes run timing, support range, marking, cover and pressing, and how fast a player switches
  between attack and defence.

**Formation and roles.** The formation sets the defensive shape. Roles drive behaviour on the ball and
off-ball habits, such as overlap or underlap runs and coming short to receive.

**Team tactics.**

| Defensive approach | Line height (default) | Behaviour |
| --- | --- | --- |
| Deep | 1–30 (25) | the line drops with runs |
| Balanced | 31–60 (50) | flexible |
| High | 61–90 (70) | rarely tracks runs, minimal pressure |
| Aggressive | 91–100 (95) | never tracks, offside trap, presses heavy touches, extra stamina drain |

- **Build-up styles:** Short Passing (patient), Balanced, and Counter (quick; runs in behind).
- **Presets:** FC Preset 4-3-3 Flat; Direct Play 4-1-4-1, Balanced build-up with a High line; Cautious
  4-1-2-1-2 Narrow, Counter build-up with a Deep line.
- **Smart Tactics:** a temporary Attacking or Defending focus moves build-up and line one level each way.

### 1.7 Defending

- **Professional Foul** (FC 25) is always a yellow, and repeated use leads to a red. Red Card Advantage
  lets play continue (FC 25 deep dive).
- **FC 26 stand-tackle "personality" by attribute.** Below 71 a player gets basic animations, 71–84 most,
  and 85+ all. Tackles from behind are less effective (FC 26 deep dive).
- **FC 27.** AI defenders no longer auto-tackle. Teammate Contain marks from "slightly longer distance".
  Jockey speed and stand-tackle range are up (FC 27 deep dive).

### 1.8 Goalkeeping

- **FC 25.** Manual keeper movement is limited to "1–2 steps" with a cooldown before returning to base.
  Rush to Contain is tap+hold Y; Rush to Centre is tap+tap Y (FC 25 deep dive).
- **FC 26.** Deflections are "steered out of bounds, toward teammates, or into open space". Authentic
  rebounds are more physics-based (FC 26 deep dive). Patches fixed keepers "overcommitting to one side"
  on first-time far-post shots
  (https://forums.ea.com/blog/ea-sports-fc-game-info-hub-en/ea-sports-fc-26-version-1-2-0-update-notes/12906902).

### 1.9 Set pieces

- **FC 25.** Three corner roles: Near Post, Back Post and Target Player. A quick free-kick precision
  pass. The speed of the penalty "Composure Circle" scales with the Composure attribute (FC 25 deep dive).
- **FC 27.** Attackers can trigger "Avoidance" movement before delivery. The camera shifts into the box
  for a brief window. Crosses go into space more often, and clean headers are harder but more accurate
  (FC 27 deep dive). Corners were the most criticised balance problem at launch (Gfinity review above).

### 1.10 Animation, camera and presentation

- **HyperMotion (FIFA 22).** All 22 players were captured at once in Xsens suits, giving "over 4000 new
  animations". ML-Flow learned from about 8.7 million frames (EA; TweakTown reports 7.8M)
  (https://www.techradar.com/news/hypermotion-technology-in-fifa-22-sounds-like-a-game-changer-but-what-is-it,
  https://www.xsens.com/resources/blog/fifa-22-motion-capture).
- **FC 25.** Full-body AI Mimic of **1,847 athletes**, up from 1,373 upper-body in FC 24. Eval Engine pass
  maps (FC 25 deep dive).
- **FC 26.** "Close-range shots use more reactive animations with minimal wind-up." Short passes use faster
  animations (FC 26 deep dive).
- The common thread: **animation selection is gated by ratings and traits** (tackle personality,
  acrobatic volleys, trickster flicks, keeper Footwork and Far Reach dives), so a better player *looks*
  better as well as rolling better.

---

## 2. EA SPORTS FC Mobile (the touch reference)

### 2.1 Controls

FC Mobile offers **buttons** (virtual stick plus Pass, Shoot, Through and Sprint & Skill) or
**gestures**, or both. Sources: https://www.fifamobileguide.com/gameplay-controls and
https://www.ea.com/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive.

| Action | Buttons | Gesture |
| --- | --- | --- |
| Move | virtual stick; "Release it and the player keeps moving" | — |
| Pass | tap Pass | tap a teammate |
| Pass and go | double-tap Pass | double-tap a teammate |
| Through | tap Through | tap space near a teammate |
| Lobbed through | hold Through, swipe up | double-tap space |
| Long pass / cross | hold Pass, swipe up (longer hold = further) | tap a man or a spot in the box |
| Shot | hold Shoot (longer = stronger and higher) | swipe toward goal (faster = stronger and higher) |
| Low shot | quick tap and release | slow swipe |
| Finesse | hold Shoot, swipe down | **curve the swipe** (better with the Curve stat) |
| Chip | hold Shoot, swipe up | tap and hold the goal area |
| Power shot | swipe right from Shoot | back-and-forth swipe toward goal |
| Fake shot | tap Shoot, swipe left | — |
| Sprint / skill | hold / tap Sprint & Skill (skill moves by direction) | — |
| Tackle / hard tackle | hold Sprint & Tackle / swipe left from it | tap the ball carrier |
| Slide | tap Slide | swipe at the ball |
| Switch | tap Switch | tap a player |
| Free kick / penalty | — | swipe path; speed sets height or power; curve bends |

**Settings players rely on:**
- button spacing (normal or wide);
- **resizable joystick**;
- fast or normal power-up rate;
- **Gestures Only**;
- tap or double-tap gesture passing;
- **Auto-Pass and Shoot**;
- auto face-up dribbling.

Sources for the settings: the two above.

### 2.2 How EA tuned touch shooting and defending

From the FC Mobile gameplay deep dive (link above):
- **Power shots** are the fastest shots, with a "much longer wind-up that leaves the shooter open to
  tackles". They are "fully assisted", but aim, context and attributes still matter. **Keeping the
  power-up near 50% gives the highest success rate.**
- **Hard Tackle** is a long-reach standing tackle, "the counter to Power Shots".
- **Context matters.** Shots from difficult spots, under pressure or on the volley are "much harder";
  taking "an extra touch or step to set up a better position helps".
- **Dribbling.**
  - Jog dribble was made *slower*, so "the first sprint touch [is] more explosive".
  - **Turn speed depends on Agility and Height.**
  - Low stamina reduces acceleration and top speed.
  - "Dribblers slow between touches so defenders can catch up."
- **Skill moves.** The second and later consecutive moves are slower and add touch error. Agility and
  Ball Control reduce that.
- **Aerial play.** Header error is higher, and pressing in a duel lowers the attacker's accuracy. Crosses
  under pressure or at full sprint are less accurate. Keepers rush to air balls they can reach first.
- **Presentation.** Star players' **run styles** are recreated, shot animations were refreshed, and
  **net physics** got more impact and ripple.

### 2.3 Modes: VS Attack is our format's closest relative

- **VS Attack.** A "fast-paced 90-second mode". You play only attacking chances, generated from a
  comparison of the two teams' ratings. Chances are Basic, Good or Great, and there are Counter Chances
  where you defend the AI's attack. Clearing weak chances faster earns more chances
  (https://gamingonphone.com/guides/fc-mobile-the-complete-vs-attack-mode-guide-and-tips).
- **Ranking.** Division Rivals uses stars: a win earns +1, a draw 0 and a loss −1. Divisions reset
  every 28 days (https://en.wikipedia.org/wiki/EA_Sports_FC_Mobile).
- **Head to Head** is a sped-up full match of about 6–8 minutes, and **Manager Mode** is AI play with
  tactical control (Wikipedia, above).
- **The June 2025 VS Attack rework lists the exact problems an attack-based format runs into**
  (https://www.ea.com/games/ea-sports-fc/fc-mobile/news/rivals-update-gameplay):
  - "Adjusted Good and Great Chances to better match team OVR, leading to fewer very difficult ones";
  - "Made Basic Chances more varied and challenging";
  - "Significantly reduced how often Fullbacks start with the ball";
  - "**Chances end sooner after GK deflected saves, defender tackles, fouls far from goal, or missed
    crosses**";
  - "Reduced the GK's tendency to rush out on certain chances";
  - ground passes "respect the target player's momentum", through balls have "longer lead distance when
    there's space ahead";
  - camera presets can now be chosen.

### 2.4 What mobile players complain about

- **Auto-switch picks the wrong defender.** Players report the closest player isn't selected, forced
  switches on loose balls to defenders "who cannot even reach the ball", and manual switches selecting
  "a completely different player". They ask for auto-switch "ONLY to crosses and lofted passes"
  (https://forums.ea.com/discussions/fc-mobile-bug-reports-en/exclude-loose-balls-from-auto-switching/13651599,
  https://forums.ea.com/discussions/fc-mobile-limited-beta-3-en/defense-feedback-honest-feedback/12546076).
- **Auto-defending** "keeps perfect distance no matter how tricky you are"
  (https://forums.ea.com/discussions/fc-mobile-general-discussion-en/auto-defending-needs-an-overhaul-or-completely-removed/12404628).
- **Progression grind.** "Tens of thousands of shards for elite players feels excessive", and players feel
  "pressured to spend"
  (https://forums.ea.com/discussions/fc-mobile-general-discussion-en/fc-mobile-has-gone-backwards---its-time-to-fix-the-game/13514347).
- **VS Attack fairness.** Chance counts are perceived as unequal ("11/12 turns where your opponent gets
  14") (https://forums.ea.com/discussions/fc-mobile-general-discussion-en/the-urgency-to-revamp-or-remove-vs-attack-mode-in-fc-mobile/12977936).

---

## 3. eFootball (console and mobile)

**Two touch schemes.** *Classic* is a stick plus buttons. *Touch & Flick* was formerly "Advanced": you
tap players and flick to pass or shoot (https://www.konami.com/efootball/en-us/page/new_controls).

**Signature mechanics** (same source):
- **Stunning kicks** (passes, crosses, shots): flick the button sideways. They take "a longer striding
  motion", so "you must draw defenders away first". This is a risk/reward that's easy to read.
- **Sharp Touch:** "dribble at a relaxed pace, then accelerate to beat a defender".
- **Match-up:** the defender "takes smaller steps, faces the opponent, and can stick out a foot".
- **Shoulder Charge**, which can be a foul from behind.
- **Call for Pressure:** a teammate presses while others block lanes.

**Reception.**
- Launch (2021–22) was a disaster: Metacritic PC 25 and PS5 34, 92% negative Steam reviews within a day,
  "finicky" controls (https://en.wikipedia.org/wiki/EFootball).
- It later recovered on gameplay. Passing became "more accurate and stat-based", defenders and keepers
  react faster, and first touches feel tighter
  (https://gamingonphone.com/news/efootball-2025-five-important-gameplay-changes-following-v4-4-0-update).
- Players cite "realistic passing, shooting and player movement"
  (https://vaporlens.app/app/1665460/e_football™).
- It is still criticised for graphics and modes against FC, and for "jarring transitions" in animation
  (https://legacy.prod.metacritic.com/game/xbox-series-x/efootball-2025).

**Lesson.** eFootball's identity is *weighty, stat-driven passing* and visible commitment: big strikes
take a big stride. That is cheap to copy in pixel art: a longer backlift animation is the cost of a
better shot.

---

## 4. Mobile arcade references

### 4.1 Retro Goal (New Star Games): the closest product to ours

**Structure.** You control only the attacking moves with a goal chance, "half-dozen-or-so" per game. The
rest is simulated and told in text, and you can adjust tactics in between
(https://www.nintendolife.com/reviews/switch-eshop/retro-goal).

**Touch controls** (https://defector.com/this-little-soccer-game-on-my-phone-is-fun-as-hell):
- swipe anywhere to run;
- **flick to pass**: a pass onto the yellow circle above a teammate sets up a header;
- **double-tap for a quick shot** that "you can't aim as precisely";
- **swipe without the ball** to slide tackle, where bad angles give yellows or reds;
- "time slows while you set up a pass".

**What people like:**
- quick, repeatable matches for commutes;
- the club-management layer: transfers, youth loans, contracts, relegation, random events;
- the "**Bosh!**" celebration;
- catchy music;
- "addictive 'one more game' feel", "looks great, with humorous animations".

Sources: Defector and Nintendo Life, above.

**What people dislike:**
- shooting "can at times feel a little fiddly";
- "the controls of dribbling compared to shooting as well as the team AI can be rage inducing" (App Store
  user, via https://apps.apple.com/nz/app/retro-goal/id1535765855);
- it can't match Retro Bowl's "simple brilliance".

### 4.2 Score! Hero (First Touch Games)

**How it plays.** Matches are cut into short puzzle sections. You **swipe a path to pass or shoot, with
curl**, and "each move has to end in a goal". Levels give star ratings. The reviewer calls swiping
"through a perfect through-ball" "surprisingly pleasing" (https://www.pocketgamer.com/score-hero/review/).

**Criticisms:**
- "The score is decided before you even get a chance to touch the screen".
- It is "played out almost entirely on rails".
- Energy timers on retries.

Sources: Pocket Gamer above and https://www.commonsensemedia.org/app-reviews/score-hero-2.

**Lesson.** Drawing the path before the ball goes (a preview line) is the most satisfying touch input in
the genre. Scripted outcomes are the most resented thing in it.

### 4.3 Dream League Soccer (First Touch Games)

- It is the long-running "full 11v11 on a phone" reference: a virtual stick plus three action buttons.
  Controller support was added in DLS 2025
  (https://gamingonphone.com/guides/dream-league-soccer-controller-support-guide-how-to-play-dls-with-a-controller).
- Players praise stadiums and player models and criticise monetisation and stability (user score 62%
  from 10k reviews, https://gamebrain.co/game/dream-league-soccer-2025).
- The developer frames it as balancing "fun with realism", not a strict sim
  (https://support.ftgames.com/hc/en-us/articles/360000842697-Something-happened-in-the-game-that-s-not-realistic-Why-is-this).

### 4.4 Pixel Cup Soccer

- A retro 80s/90s arcade soccer game with "simplified controls covering shooting, passing, and running",
  "many options and assists", and an AI that is "tough even on Easy" (https://www.148apps.com/reviews/pixel-cup-soccer-review/,
  https://apps.apple.com/app/id6452803093).
- Its nostalgia pixel art and soundtrack are the main draw. One reviewer compares it to NBA Jam but finds
  it less fun (https://gertlushgaming.co.uk/pixel-cup-soccer-ultimate-edition-review-steam/).

### 4.5 Football Manager (Touch and FM26)

**FM26 "Dynamic Highlight Mode."** "The more important and more dramatic a game, the more highlights
you'll see". At 4–0 the number drops.

**Between highlights,** a **Match Overview** shows:
- a 2D pitch;
- data cards;
- staff advice based on **xG and xA**, for example lowering tempo when comfortably ahead late.

**Replays** are chosen by "the type of goal scored". Broadcast mode mixes camera points with cinematic
angles.

Source: https://www.footballmanager.com/fm26/features/where-storytelling-evolves-fm26s-match-day-experience.
FM24 Touch got "a new skin designed for iPhone screen"
(https://www.cultofmac.com/836165/football-manager-2024-touch-now-playing-on-apple-arcades-pitch/).

### 4.6 Sensible Soccer (the classic that pixel soccer is judged against)

- **Controls:** "Quick-tap to pass, hold down longer to shoot – that was it."
- **Aftertouch:** holding a direction right after the strike curls shots, crosses and headers. This
  "physics-defying aftertouch" is central to its appeal.
- **Ball control:** a short "adhesion" window right after receiving, unlike Kick Off 2's ball that is
  never glued to the feet.

Sources: https://mitvblog.blogspot.com/2014/06/retrospective-sensible-soccer.html and
https://walletsandswords.blogspot.com/2014/08/a-z-games-s-t.html.

The bending began as a bug in Tehkan World Cup that MicroProse Soccer kept as a feature
(https://gb.readly.com/magazines/retro-gamer-uk/2023-09-01/64eca5464e8df5a067aa1d3f).

**Lesson.** A post-strike swipe to bend is memorable, native to touch, and generic enough to be ours.

---

## 5. What makes each reference liked and remembered (summary)

| Game | Remembered for | Hated for |
| --- | --- | --- |
| FC 25–27 (console) | responsiveness, star players who feel distinct (traits and animations), FC IQ roles, tactics codes, presentation | AI auto-defending, overpowered metas (green long shots, corners), slow patches |
| FC Mobile | pick-up-and-play gestures, VS Attack's 90-second chances, run styles and net ripple | wrong auto-switch, auto-defending, shard grind |
| eFootball | weighty stat-driven passing, "stunning" strikes with a visible wind-up | launch quality, finicky controls, jarring transitions |
| Retro Goal | quick highlight attacks, flick passing, slow-mo pass set-up, "Bosh!", management layer | fiddly shooting, dribble/shoot conflict, AI teammates |
| Score! Hero | drawing the perfect through ball, curl | rails, scripted results, energy timers |
| FM / FM26 | dynamic highlights, xG-literate advice, replays by goal type | — |
| Sensible Soccer | tap-pass/hold-shoot simplicity, aftertouch curl, speed | — |

---

## 6. Real football: per-match calibration

### 6.1 League per-match averages (Premier League unless noted)

| Stat (both teams, per match) | Value | Source |
| --- | --- | --- |
| Goals | 2.82 (21/22), 2.85 (22/23), 3.28 (23/24, a record 1,246), 2.99 (24/25 to March); 2.88 after 100 games of 24/25 | https://www.premierleague.com/news/4271974, https://theanalyst.com/articles/premier-league-2024-25-data-trends-stats |
| Shots | 25.7 / 25.3 / 27.6 / 26.1; Opta: "about 25 shots per game" | PL link above; https://theanalyst.com/articles/what-are-expected-goals-xg/ |
| Shot conversion | 10.99% / 11.28% / 11.88% / 11% | PL link above |
| Inside-box vs outside-box conversion | 14.7% vs 4.2% (24/25) | https://theanalyst.com/articles/premier-league-2024-25-shot-data |
| Shots from outside the box | 8.3 per game, 31.7% of shots (lowest on record; 48.2% in 05/06) | same |
| Goals from outside the box | 11.7% of goals (24/25); record high 20.2% (06/07) | same |
| Shots on target share | 33–37% (league guides), 37.6% across leagues (CIES 18/19); 34.5% computed in §6.2 | https://football-observatory.com/IMG/sites/b5wp/2018/254/en/ |
| Goals per shot on target | about 31% (EPL, La Liga); 30.2% computed | https://www.statscore.com/sport/soccer/what-does-the-shot-conversion-rate-for-goals-means-in-soccer |
| Keeper save % | elite 72.5–73.5% (Raya, Sels, Flekken, Alisson); worst regulars 57–59% | https://theanalyst.com/articles/premier-league-goalkeeper-stats-2024-25 |
| Penalties awarded | 0.22–0.28 per match | PL link above |
| Penalty conversion | 73–80% (PL 05/06 73%; European leagues 76.5–79.8%; World Cup shootouts 69.4%); Opta penalty xG 0.79 | https://en.wikipedia.org/wiki/Penalty_kick_(association_football), Analyst xG link |
| Passes | 907 / 906 / 941 / 899 per match; 2025/26 down to 849 (lowest since 2010/11) | PL link above; https://theanalyst.com/articles/premier-league-2025-26-more-direct-football |
| Pass accuracy | 81.3% (22/23), 82.9% (23/24), 83.7% (24/25) | Opta passing table via The Analyst (https://theanalyst.com/articles/premier-league-teams-still-more-direct-2025-26) |
| Completed passes | 780 (23/24 peak), 748 (24/25), 713 (25/26 so far) | https://www.premierleague.com/en/news/4461793/what-are-the-biggest-trends-from-202526-so-far |
| Long-pass share | 12.2% → 10.4% (21/22 → 24/25), back up to 11.5% (25/26) | PL links above |
| Corners | about 10.8 per match (758 in 70 matches; team rates 5–6.6) | https://theanalyst.com/articles/premier-league-corners-2024-25 |
| Goals from corners | 2.8% of corners (24/25 early), 4.2% the season before; xG per corner 0.016–0.067 by team | same |
| Set-piece share of goals | 20.1% non-penalty set pieces; 74.7% open play (24/25 early) | Analyst data-trends link |
| Headed goals | 15.6% of goals (24/25) → 21.3% (25/26 so far) | PL 25/26 trends link |
| Cards | about 4.34 per game (24/25) | https://www.goal.com/en-gb/betting/premier-league-cards-betting/bltd650e84c266fcf43 |
| Fouls | about 22.8 per game (per-referee average; proxy) | https://www.olbg.com/blogs/men-middle-premier-league-referee-performances |
| Ball in play | 54.5–58.1 minutes | PL link above |
| Stoppage time | 7:29 → 11:36 → 9:43 per match (21/22 → 24/25) | PL link above |
| Goals in the first 15 min | 13.5–14.4% of goals (0.38–0.43 per match) | PL link above |
| Goals at 90'+ | 8.3–8.6% (23/24, 24/25); 13.3% (25/26 so far) | Analyst / PL trends links |
| Comeback wins | 16.6% of matches (23/24), 21% early 24/25 | Analyst data-trends link |
| Goalless draws | 11 in 380 (23/24, record low), 24 in 289 (24/25 to March) ≈ 3–8% | PL link above |
| Big-chance conversion | about 39–41% (Opta; a "big chance" is roughly xG ≥ 0.25–0.30) | https://www.premierleague.com/en/news/2910303, https://eplindex.com/14159/opta-stats-analysis-epl-strikers-reliance-clear-cut-chances.html |

Per team, halve the match figures:
- about 13 shots, 4.5 on target, 1.4–1.5 goals and 1.3–1.5 xG;
- about 450 passes at 84%;
- about 5.4 corners, 11 fouls, 2.2 cards and about 3 saves.

**Not verified in this pass** (the search budget ran out): sprint top speeds, distance covered per
player, and sprints per match. Our engine's PAC 40→99 maps to 6.8→9.4 m/s (24.5–33.8 km/h). That is
plausible but uncalibrated.

### 6.2 Shot outcomes by distance (computed from 65,931 StatsBomb open-play shots)

Distances are in yards to the centre of the goal (StatsBomb 120×80 pitch). Totals for open play:
conversion **10.3%**, mean xG 0.099, on target **34.5%**, blocked **24.7%**, off target or post about
40%, and goals ÷ (goals + saves) **30.2%**.

**Conversion and outcome mix by distance**

| Distance (yd) | Share of shots | Goal % (all) | Foot | Head | On target | Blocked | Keeper save % of on-target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–6 | 3.2% | 44.7 | 55.9 | 32.2 | 57.8% | 7.4% | 22.7% |
| 6–8 | 5.8% | 24.6 | 36.0 | 16.7 | | | |
| 8–10 | 7.9% | 17.4 | 27.3 | 10.3 | | | |
| 10–12 | 8.5% | 13.7 | 20.0 | 5.8 | 39.1% (6–12) | 15.3% | 54.2% |
| 12–14 | 8.7% | 13.6 | 17.1 | 4.5 | | | |
| 14–16 | 8.1% | 12.2 | 13.7 | 2.0 | | | |
| 16–18 | 8.1% | 10.5 | 10.9 | 2.8 | 39.5% (12–18) | 24.6% | 69.4% |
| 18–20 | 7.7% | 7.6 | 7.6 | — | | | |
| 20–22 | 7.1% | 5.1 | 5.1 | — | | | |
| 22–25 | 10.6% | 3.9 | 3.9 | — | 30.4% (18–25) | 32.7% | 82.6% |
| 25–30 | 14.3% | 2.5 | 2.5 | — | | | |
| 30–35 | 7.0% | 1.6 | 1.6 | — | 26.1% (25–35) | 28.9% | 91.6% |

**Angle, technique, pressure and pattern**

- **Central versus wide** at the same distance: 16–18 yd converts 12.4% central (y 30–50 on the
  120×80 pitch) against 8.2% wide, and 18–20 yd 9.0% against 6.1%.
- **Technique:**
  - chips/lobs 26.9% overall (48% inside 12 yd, 38% at 12–18 yd, 26% at 18–25 yd, 12.5% at 25–40 yd;
    these are chosen situations, usually 1v1 with the keeper off his line);
  - diving headers 20.7%;
  - volleys 12.2%;
  - half volleys 10.2%;
  - normal shots 9.9%;
  - overheads 8.4%.
- **Under pressure** 9.1% against 10.7% not; 25.4% of shots are under pressure.
- **Pattern of play** (per shot): counter 15.8%, regular play 10.7%, from a throw-in 9.6%, from a free
  kick 9.2%, from a corner 8.7%.
- **Set-piece shots:** direct free kicks convert 6.4% (n = 3,360) and penalties 73.3% (n = 1,115). A
  second dataset gives free kicks 5.2% and penalties 0.792
  (https://databallpy.readthedocs.io/en/v0.5.0/features/simple_xG_models.html).
- **Headers** are 17.1% of open-play shots. They convert like feet overall (10.9% against 10.1%) only
  because they are taken close in. At equal distance a header is roughly half as likely.
- **xG distribution of open-play shots:**

  | xG band | Share of shots |
  | --- | --- |
  | ≤ 0.02 | 14.4% |
  | 0.02–0.05 | 31.5% |
  | 0.05–0.10 | 26.1% |
  | 0.10–0.20 | 15.5% |
  | 0.20–0.30 | 5.4% |
  | 0.30–0.50 | 4.8% |
  | 0.50–0.70 | 1.5% |
  | > 0.70 | 0.8% |

  So **72% of real shots are under 0.10 xG**, and only about **7% are "big chances" (≥ 0.30)**.
- **Distance spread:** the median shot is 17.9 yd out; the middle half lie between 11.9 and 24.8 yd.

### 6.3 What "arcade compression" means for us

A real team gets about 13 shots and 1.4 goals in 90 minutes. We give each side **7 attacks** of up to
30 s. To keep scorelines real (2.6–3.2 goals a match, 3–8% goalless), each side should score **about
20% of attacks**. That is roughly **1.4–1.7× real per-shot conversion**, assuming 1.1–1.3 shots per
attack including rebounds. This document uses **1.6** as the arcade factor.

The same logic applies to set pieces. A real team takes about 5.4 corners a match, and we deal about
one. So a dealt corner stands for a batch of real corners, and its per-*attack* rate should be compared
with the corner share of goals (about 13%), not with 3.5% per corner. Compare per-*shot* rates with
real per-shot rates × 1.6 (corner-sequence shot 8.7% → about 14%; direct free kick 6.4% → about 10%).

Our attacks are already the *good* minutes, so the right shape is "real curve × about 1.6", not a
flattened curve. Section 8 gives a target table.

---

## 7. Recommendations for our game

**Parameters.** Numbers are concrete starting points to tune with `scripts/audit_soccer_shots.ts`.
Bracketed names point at existing code in `src/game/soccer2/`.

**Originality.** Use our own names throughout: no "PlayStyles", "FC IQ", "HyperMotion", "Team of the
Week", "TOTY" or "FUT". Generic football vocabulary (finesse, chip, low driven, trivela, poacher,
wingback, sweeper keeper) is fine.

### 7.1 Shooting: four shot types on one SHOOT button

**Current state.**
- Hold SHOOT, drag on it to aim, release on the green at 0.62 s.
- `coneMult` runs from 0.5 at the green's centre to 3.2 off it, and `rangeCone` from 1 to 2.25.
- There is aim assist toward the open side.

Keep all of that and add:

| Shot | Input (touch) | Wind-up (to green) | Speed vs normal | Error cone vs normal | Notes and sources |
| --- | --- | --- | --- | --- | --- |
| Placed (normal) | hold, drag to aim, release | 0.62 s at 12 m; 0.40 s inside 8 m | 1.0 | 1.0 | Close range gets "minimal wind-up" (FC 26) |
| Finesse | the same, but the drag **curves** (path deviates more than 15° from a straight line), or a sideways swipe in the 0.25 s after release ("aftertouch") | +0.08 s | 0.80–0.85 | 0.8 to the far corner, 1.3 to the near post; curl 3–6 m/s² sideways decaying | FC Mobile "curve the swipe"; Sensible aftertouch; trait "Curler"/"Curler+" (−15% / −25% cone) |
| Chip | a quick upward flick off SHOOT (more than 40 px in under 150 ms) | 0.35 s | lob solved to drop under the bar | ×1.6, but real conversion is 38–48% in a 1v1 when the keeper is more than 4 m off his line | FC Mobile "hold Shoot, swipe up"; §6.2 chip table |
| Low driven | **double-tap** SHOOT (second tap within 250 ms) | 0.45 s | 1.05, height capped at 0.6 m | ×1.1; +40% error at full power (the FC 26 1.0.2 lesson) | FC 26 double-tap; good through crowds, worse over a falling keeper |
| Power | hold past the green into a red **power zone** (0.85–1.0 s) | 0.90 s, so it can be tackled | 1.25 (SHO·PHY 21→31 m/s becomes 26→38) | ×1.35; trait "Rocket" brings it to ×1.1 | FC Mobile "much longer wind-up… open to tackles"; best near the middle of the zone ("near 50% highest success") |

**Make the meter an "execution" meter, not a lottery.**
- Change `coneMult` from 0.5…3.2 to **0.8 at the green's centre, 1.0 at its edge, 1.3 at two greens,
  capped at 1.6**.
- Move timing's main consequence to **height and power**: an early release is weak and low; a late
  release rises (keep the existing `timingMiss` verbs).
- Context should carry the rest. Multiply the cone by:
  - distance (below);
  - angle: ×1.5 when the shot is wide of the posts at under 12 m;
  - pressure: ×1.35 with a defender within 2 m (Opta's "intense pressure" is 2 m,
    https://theanalyst.com/articles/opta-vision-stats-tracking-data-premier-league);
  - body shape: across the body ×1.3, weak foot ×1.1–1.5 by weak-foot stars;
  - first time: ×1.2 at a 90° turn and ×1.6 at 135° or more (FC 26: 135°/180° "significantly less
    accurate").

**Steeper range.** The real per-shot rate halves about every 5 yards past the penalty spot (10.9% at
16–18 yd, 5.1% at 20–22, 2.5% at 25–30). Grow `rangeCone` exponentially: ×1 at 11 m, ×1.6 at 16.5 m,
×2.4 at 20 m, ×3.2 at 25 m. Keep a separate **"Long Shot" trait** that cuts it by 15%, so specialists
exist without becoming a meta.

**Volleys and headers** use the same button pressed while the ball is incoming (already wired). Headers
get ×2 the foot cone beyond 8 m. Real headers convert about half as often as feet at equal distance:
6–8 yd 17% versus 36%, 10–12 yd 6% versus 20%.

**Telegraph the result.** Keep the miss reasons ("STRAIGHT AT HIM", "IT ROSE OVER"). Add the shot's
**xG pill** on release (for example "xG 0.12") and on the shot map afterwards. Players love learning why.

### 7.2 Passing

- **First-time angle penalty.** Ground, through and driven passes take error ×(1 + 0.6·max(0,
  turn° − 60°)/120°): about ×1.6 at 180°. This follows FC 26 and its 1.0.2 patch.
- **Pass and go.** A **double-tap on PASS** makes the passer bomb forward (FC Mobile; FC 27's Pass &
  Follow). One run, for 1.5 s or 15 m (FC 27: triggered runs last "for a limited distance").
- **Through-ball lead** scales with the space ahead (FC Mobile 2025: "longer lead distance when there's
  space ahead"). Ground passes **respect the receiver's momentum**: aim at where he will be, never
  behind him (FC 26 1.0.2 and FC Mobile 2025 both fixed "passes behind the receiver").
- **Swerve passes only above 40% power** (FC 24 Precision Pass rule). A pass-preview line, as we already
  draw, extended with a bend arrow when the "Bender" trait applies.
- **Lofted and crossing error** grows ×1.3 under pressure and ×1.2 at full sprint (FC Mobile deep dive).
  Crosses go into **space** more often than onto a head (FC 27).

### 7.3 Dribbling, skill moves, first touch, acceleration archetypes

**Acceleration archetypes.** Rename them to avoid EA wording, for example **Burst / Steady / Long
Strider**:
- **Burst:** DRI ≥ 65, DRI − PHY ≥ 10, PAC ≥ 80 and `ht` ≤ 182 cm. Reaches 90% of top speed in 1.1 s;
  top speed −2%.
- **Long Strider:** PHY ≥ 65, PHY − DRI ≥ 4, PAC ≥ 40 and `ht` ≥ 183 cm. Reaches 90% in 1.7 s; top
  speed +2%.
- **Steady:** everyone else. Reaches 90% in 1.4 s.

These are FC 26's thresholds re-expressed for our six stats (Agility ≈ DRI, Strength ≈ PHY,
Acceleration ≈ PAC). Show the archetype as an icon on the card. It's a cheap, real-feeling identity
marker.

**Turning.** Turn rate depends on **DRI and height**: shorter turns faster (FC Mobile). Cap heading
change at 540°/s at a jog and 240°/s at a sprint, so no instant 180s.

**Controlled sprint.** Holding SPRINT lightly, or for less than 0.3 s, gives 90% of top speed with close
control. Full sprint gives knock-ons: the touch distance grows from 1.2 m to 2.5 m, and tackles get +6
points (already in `tackleWin` as −6 for sprinting). FC Mobile made the jog *slower* so the first sprint
touch feels explosive. Do the same: jog 75% (currently 80%).

**Skill moves by swipe on the right side of the screen, away from the buttons.** The forward, side and
back moves change with the skill-star tier, following FC 26's simplified mapping:

| Stars | Forward | Side | Back |
| --- | --- | --- | --- |
| 1–2 | ball roll forward | ball roll | feint and turn |
| 3–4 | roulette | stop and turn | feint and exit |
| 5 | three-touch roulette | drag turn | nutmeg spin |

- Each consecutive move within 1.2 s is 15% slower with +40% touch error.
- **Hard cap of 3 in a row**, after which a heavy touch is forced (FC 26 rule; FC Mobile chaining
  penalty).
- Defenders lunge at a skill move's exit only if their read delay has passed (`DEF` read 0.24→0.07 s
  already exists).

**First touch.** A trap error ∝ ball speed × (1 − DRI factor) × (1.3 if sprinting) × (1.4 if turning
more than 90°). The **"Velvet Touch" trait** halves it.

**Shielding.** Holding the stick back toward your own goal while a defender is within 1.5 m shields.
Shield strength is a PHY difference (FC 26 "contested box outs… Strength difference").

### 7.4 Add Counter Chances: a defensive phase

FC Mobile's attack-only mode includes **Counter Chances, where you defend the AI's attack**. Retro Goal
uses a swipe-to-slide. Today our rival's attacks are simulated, and the human never defends.

Play **2 of the rival's 7 attacks as defend chances** (the rival attacking us, 15–20 s each). The other 5 stay simulated, and your own 7 attacks are unchanged.

**Controls:**
- the stick moves your defender;
- **hold TACKLE** to jockey and contain: back-pedal at 80% pace facing the ball, which FC 27 strengthened
  as "Jockey speed… increased";
- **tap TACKLE** to make a standing tackle;
- **swipe** to slide;
- **tap SWITCH**, or tap a player on the field, to switch.

**Auto-switch:**
- off by default except **on crosses and lofted balls**, which is exactly FC Mobile users' request;
- never switch to a man who can't reach a loose ball first;
- switch to the defender *nearest the ball's path*, not the nearest to the ball.

**Teammate contain** (FC 27) keeps a second defender **3–4 m off** the carrier, not tight, so the human
still has to win the ball.

**AI defenders never auto-tackle a dribbler who merely comes close** (FC 27). Keep AI tackles to those
the human can see coming: a 0.25 s wind-up pose.

**Tackle outcome.** Use the existing logistic `tackleWin`. From behind it is ×0.8 and can be a foul.
Add an **animation tier**: DEF below 71 gets a poke and a block, 71–84 adds a hook tackle and shoulder,
85+ adds a recovery slide and ball-stop. This is FC 26's "tackle personality" thresholds.

**Online.** Keep online asynchronous. In H2H, defend chances run against the rival squad's
**autopilot**, seeded identically on both phones. Nobody waits on the other phone, and protocol
complexity stays flat.

### 7.5 Goalkeeping

**Save rates by distance should land near real** (§6.2), with the arcade factor:

| Shot distance | Real goals per on-target shot | Our target |
| --- | --- | --- |
| inside 6 yd | 77% | 70–80% |
| 6–12 yd | 46% | 45–55% |
| 12–18 yd | 31% | 30–40% |
| 18–25 yd | 17% | 18–25% |
| beyond 25 yd | 8% | 8–12% |

Elite keepers (93 overall) should be about 20–25% better than average, not 2×. The release tuning
already pulled 1v1-vs-93 from 8% to 27%. Real elite save% is 73% against a league average around 70%.

**Parry direction.** Steer parries **wide or out of play** in proportion to HAN and position. FC 26:
"Deflections are steered out of bounds… or into open space". Real rebound goals should be rare: about
1 in 8 parries back into the central 18 m, and fewer for 85+ HAN.

**Keeper behaviour:**
- He **sets** (a 0.12 s split-step pose) when he sees the backlift. This is already there as the 60%-pace
  "get set".
- Only one dive per shot. Reaction comes from REF (0.30→0.12 s) and the dive is a committed arc.
- He comes for crosses he can reach first (FC Mobile).
- Fewer rushes on chances he can't win (the FC Mobile 2025 fix).
- Far-post first-time shots should not make him over-commit (FC 26 1.2.0).

**Keeper traits (our names):**
- "Shot Stopper" (Far Reach: longer dive);
- "Low Blocker" (Footwork);
- "Sweeper" (rushes and smothers);
- "Commander" (crosses);
- "Deflector" (safer parries).

### 7.6 Set pieces

**Deal by frequency, not "every kind once".** Real goal sources are about 75% open play, about 20% set
pieces and about 6–7% penalties (§6.1). Suggested weighted bag per side per match:

| Scenario | Share of attacks |
| --- | --- |
| build-up | 32% |
| counter | 22% |
| wide | 22% |
| corner | 15% |
| free kick (direct within 30 m, or a crossed one) | 9% |
| (separately) defend chances, §7.4 | 2 of the rival's 7 attacks |

Allow a match with zero corners and a match with three.

**Targets** (arcade factor 1.6 on per-shot rates; the autopilot at skill 0.75):

| Attack | Target | Real basis |
| --- | --- | --- |
| Build-up / counter / wide attack | 18–21% / 24–28% / 17–20% per attack | regular play 10.7% and counters 15.8% per shot |
| Corner attack | 9–12% per attack (about 14% per shot) | 8.7% per corner-sequence shot; corners ≈ 13% of goals |
| Free-kick attack (direct or crossed) | 11–14% per attack | |
| Direct free-kick shot | 9–11% per shot | 5.2–6.4% per shot |
| Penalty | 74–78% | league 76.5–79.8% |
| Shootout kick | 70–75% | 69.4% at World Cups |

Today we have corners at 11.7%, free kicks at 14.7%, and build-up / counter / wide at 13.3 / 10.3 /
9.7%. So the set pieces are about right per attack. Open play is too low, and counters are inverted.

With these weights and mid-range targets, the autopilot scores about 1.3 a side from open play and set
pieces, plus about 0.15 a match from penalties. That is about 2.8 a match, with set pieces about 14% of
goals. Human players will score more.

**Corner control.** Use three target zones (near post, penalty spot, back post), mirroring FC 25's three
corner roles. Add an **attacker "Avoidance" dash**: tap during the 1.0 s run-up to shake your marker
(FC 27). The header contest is decided by PHY·height vs DEF·height, the cone ×3.8 as now.

**Free kicks.** Swipe to bend (already there). The "Dead Ball" trait adds a longer trajectory preview
(FC 27: "longer trajectory preview"). Compose the wall from the 4 tallest.

**Penalties.** Keep drag-to-aim. Add a **composure ring** whose shrink speed scales with the taker's SHO
and stage pressure (FC 25: "Composure Circle speed scales with the Composure attribute"). Keepers read
the right way 36–50% of the time (REF·POS, existing).

### 7.7 AI teammates and roles

Give every card **1–3 roles with familiarity pips** (● base, ●● strong, ●●● elite), using generic
football role names. In each scenario, a role picks the teammate's **run template**:
- **ST:**
  - Poacher: runs off the last man's shoulder, attacks the near post;
  - Target: holds the ball up, attacks the far post on crosses;
  - False 9: drops 10–15 m to receive;
  - Complete: mixes.
- **W:**
  - Winger: holds the touchline, crosses;
  - Inside Forward: cuts in onto his strong foot to shoot;
  - Wide Playmaker: underlaps to combine.
- **FB:**
  - Fullback: stays;
  - Wingback: overlaps on the wide overload;
  - Attacking Wingback: overlaps early and high;
  - Inverted Back: steps into midfield.
- **CM:**
  - Box-to-Box: late run into the box;
  - Playmaker: shows short;
  - Holding: stays behind the ball as cover;
  - Deep-Lying: drops between the centre-backs.
- **GK:** Goalkeeper, or Sweeper (a higher line and more rushes).

**Familiarity** moves run timing and accuracy by 10–40%, as FC 25 states. Concretely:
- base: run start delay 0.6 s and run-line error 2.0 m;
- ●●: 0.35 s and 1.2 m;
- ●●●: 0.15 s and 0.6 m.

A player out of position gets the "simplified" generic run.

**Team plan (UT pre-match, one tap).**
- **Build-up:** Short / Balanced / Direct. This shifts the deal weights by ±10 points between build-up
  and counter.
- **Line:** Deep / Balanced / High. A deep line gives the rival fewer counters and more build-up looks; a
  high line gives the reverse, plus offside chances for you.

This mirrors FC 25's Defensive Approach and Build-Up Style at negligible engine cost.

### 7.8 Stamina

- Keep the shared sprint bar (−0.2/s sprinting, +0.09/s jogging). Below 30%, scale acceleration and top
  speed down to 0.88 (already in `lerp(0.88, 1, stamina)`). FC Mobile: "Low stamina reduces
  acceleration and top speed".
- Add **match fatigue for AI and teammates only**, the FC 26 Competitive rule. It shows as a slower read
  late in the match: the defender's read delay grows +0.03 s per attack after the 5th.
- A **"Relentless"-style trait** halves the drain.

### 7.9 Animation: making pixel players move "like the real games"

We already drive a rig with CMU mocap clips. Rules that make it read as "real" at 60 Hz:

1. **Anticipation scales with power.**

   | Kick | Backlift frames | Contact frame | Follow-through |
   | --- | --- | --- | --- |
   | Pass | 6–8 | — | 8–10 |
   | Placed shot | 10–14 | — | 12–16 |
   | Power shot | 18–24 | — | 16–20, with a **visible longer final stride** (eFootball "stunning" stride) |

   - The **contact frame triggers the ball launch exactly**. A 1-frame desync reads as a "ghost kick".
   - Close-range snap shots use the short backlift (FC 26 "minimal wind-up").
2. **No foot skating.**
   - Pick the gait clip by speed (jog, run, sprint; already done) and adjust the clip's playback rate
     to ground speed / clip stride speed, clamped 0.8–1.25.
   - Lock the plant foot on the kick's last stride.
3. **Lean and turn arcs.**
   - Body lean up to 12° into acceleration and 8° into turns.
   - Deceleration takes 2–3 shuffle steps before a turn of more than 120°.
   - Heading change is capped (§7.3).
4. **First-touch variety.** Use a cushion (sole or instep) for soft balls, a chest or thigh trap for
   balls above 0.8 m, and a **heavy touch** pose (ball bounces 2–3 m) on a failed trap.
5. **Keepers:**
   - a set pose with a split hop when the backlift starts;
   - a shuffle step for far shots;
   - three dive heights (low-ground, mid, high-tip), chosen by the ball's crossing height;
   - parry versus catch poses;
   - smother on 1v1s;
   - a 1.0 s get-up so rebounds feel earned.
6. **Defenders:** a jockey back-pedal; poke, hook and slide tackle tiers by DEF (§7.4); a block pose with
   arms behind the back for shots within 3 m; a stumble on a missed tackle.
7. **Trait animations** are the cheapest "star feel":
   - Acrobatic gets scissor and bicycle on volleys;
   - Trickster gets flick-ups;
   - Curler gets an open-body shape on finesse;
   - Shot Stopper gets the extended dive.

   FC gates many animations behind traits and attributes, and we should too.
8. **Run styles.** Give 4–6 gait variants (upright, low-crouched, long-stride, choppy) and assign them
   by archetype plus height. FC Mobile markets "star player run styles" as a feature.
9. **Celebrations.** Have 6–10 short loops: knee slide, arms out, badge-less chest thump, a backflip for
   high DRI, team pile-on. Retro Goal's "Bosh!" celebration is singled out by reviewers, so a signature
   celebration per Legend card is a cheap dopamine hit.

### 7.10 Camera, presentation and juice

- **Broadcast camera** behind the attack (current), with presets players can choose: FC Mobile added
  camera presets in 2025.
- **Replays chosen by goal type** (FM26): a curler gets a reverse angle from behind the shooter; a
  header gets a side angle in slow-mo at 0.4×; a rocket gets a net-cam with ripple. Add **net ripple and
  impact** strength by shot speed (FC Mobile).
- **Dynamic stoppage time** (FM26 logic): the stoppage-time attack is dealt only when the match is
  within one goal, or when a goal would change the result. At 3–0 skip it.
- **Scorebug and GameCast between attacks:**
  - a mini 2D pitch;
  - possession bar;
  - shots (on target);
  - xG;
  - "momentum" arrows.

  FM26's "Match Overview" does this.
- **Commentary text** keyed to the event: "far post!", "off the bar", and so on.
- **Haptics on contact** (navigator.vibrate is unsupported on iOS Safari, so use a visual 2-frame
  hit-stop instead):
  - 2-frame freeze on a power-shot strike;
  - 4 frames on a goal;
  - 3 frames on a big save.

### 7.11 Touch controls and settings (iPhone)

- **Layout.** Left: a floating or fixed stick, with a size setting at 0.8×, 1.0× or 1.2×. Right: SHOOT
  (largest, ≥ 64 design px), PASS, THRU and SPRINT, all at least 44 px, with spacing 8–16 px (FC
  Mobile "button spacing"). Defence reuses the same buttons, relabelled TACKLE / CONTAIN / SWITCH.
- **Run behaviour.** Keep release-to-stop as default, and offer "keep running on release" (FC Mobile
  behaviour).
- **Toggles:**
  - **Power-up rate** normal or fast;
  - **auto-switch** off, cross-only (default) or on;
  - **auto-aim when you don't drag** (exists);
  - **gesture passing:** tap a teammate to pass (exists).
- **Never conflict the run thumb with aiming** (already fixed on 2026-11-02). Retro Goal reviewers
  complain about dribble-versus-shoot conflicts, so keep it fixed.
- **Slow-mo pass set-up** (Retro Goal: "time slows while you set up a pass"). Holding PASS for over
  0.3 s drops time to 0.5× for at most 0.8 s, with the existing dashed pass line. It must be identical
  on both online phones, and it is purely local because our attacks are played separately.
- **Respect reduced motion.** Shorten replays and remove screen shake when it is set (BRIEF).

### 7.12 Match stats that feel legit

Show after each match, in a broadcast-style table, numbers drawn from real distributions:

| Item | How to generate |
| --- | --- |
| Shots / on target / blocked | Count real shots from played attacks. Add simulated "unplayed-minute" shots (per team about 13 total, minus played shots, floor 0), so team totals land at 8–18. On-target share 34% (±8), blocked 25%. |
| xG | Sum per-shot xG from the §6.2 curve (distance, angle, head or foot, pattern) for played shots, plus simulated shots at the real xG distribution (72% under 0.10). Show a shot map. |
| Possession | 50 ± (team rating diff × 1.2) ± noise, clamped 30–70%. Passes = 900 × possession share × (0.85–1.15). Accuracy 75–90%, scaled by PAS. |
| Corners | Poisson(5.4) per team, minus/plus 1 for the team rating gap. Include those played. |
| Fouls / cards | Fouls Poisson(11); yellows Poisson(2.1); red about 0.1 per match. |
| Saves | On-target shots minus goals. Keeper save % shown. |
| Offsides | Poisson(1.8). |
| Player ratings (6.0–10.0) | 6.5 base; +1.0 per goal, +0.6 per assist, +0.3 per key pass or tackle won, −0.5 per error leading to a goal. Man of the Match. |

Clamp so that **goals ≤ shots on target ≤ shots** and team **xG ≥ 0.1 per goal-less shot**. Test it: across
1,000 autopilot matches at equal 80 overall, mean goals should be 2.6–3.2, shots 22–30, on-target share
30–38%, goalless 3–9%, and goals at 90'+ 8–13%.

### 7.13 Ultimate Team (soccer-specific)

**Card face additions** (all derivable without new external data, and additive in state):
- **Skill stars** 1–5. Derive from DRI and position, for example W/AM/ST: DRI ≥ 88 → 5, 80–87 → 4,
  70–79 → 3, 60–69 → 2, else 1. CB/GK cap at 2–3.
- **Weak-foot stars.** Default 3. Legends and promos are set by hand. This is the honest option until a
  real source exists, and it should be marked as an estimate in the docs.
- **Acceleration archetype** icon (§7.3).
- **Traits**, 2–4 per gold card with **at most one "+" (gold) on base gold, 2 on promos, 3 on top Legends**.
  This is our own cap. FC's own caps weren't confirmed in this pass.
- **Role pips** (§7.7).

**Trait list (our names; effects 8–15% each, a "+" is 1.6×):**
- *Finishing:* Curler, Rocket, Low Driver, Chipper, Acrobat, Aerial Threat, Dead-Ball.
- *Passing:* Maestro (through balls), Pinger (fast ground), Quick Combos (first-time), Bender (swerve and
  cross), Long Ranger (lofted).
- *Control:* Velvet Touch (first touch), Escapologist (press resistance and shielding), Flier (fast
  dribble), Trickster (extra skills).
- *Defending:* Reader (intercept), Wall (block), Clean Tackler (stand tackle), Slider, Shadow (jockey).
- *Physical:* Bulldozer (strength), Burst (acceleration), Engine (stamina), Long Throw.
- *Keeper:* Shot Stopper, Low Blocker, Sweeper, Commander, Deflector.

FC 26 and FC 27 both cut trait power so that **a high attribute alone still performs**. Copy that
lesson: a trait never flips a 50/50 by itself.

**Pack odds display.** Use EA's format: "minimum probability of one or more items in this range". For
example, EA's sample Large Gold Pack shows 75+ 100%, 82+ 18% and 84+ 4.2%. Every open is an independent
event, and a specific card is far rarer than its band, "often under 1%"
(https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities).

**Rating distribution inside a band.** One community sample of an "84+ player pick" gave:

| Rating | Share |
| --- | --- |
| 84 | 54% |
| 85 | 11% |
| 86 | 16% |
| 87 | 5% |
| 88 | 8% |
| 89 | 5% |

That is a steep decay with the floor rating most common
(https://futmind.com/pack/1030/84+-rare-gold-player-pack; small sample). Use a geometric decay of about
0.55 per rating point above the floor, so a "guaranteed 84+" gives 84 about 45%, 85 about 25%, 86 about
14%, 87 about 8% and 88+ about 8%.

**Foil variant.** Randomly awarded special items roll a 5% chance of a cosmetic **foil variant**. EA's
Holographic Variants in FC 27 are "about a 5% chance" on randomly awarded non-Bronze/Silver/Gold items,
and guaranteed items are not eligible (same EA page). This is a free dopamine spike that never changes
stats.

**Promo cadence (structure only, our names):**
- weekly best XI (we have Weekly Standouts);
- a January "Year's Best XI": vote, then a reveal staggered by line over about 10 days (attack →
  midfield → defence → full team);
- an April–June "Season's Best" released league by league weekly over about 6 weeks, ending with an
  "all-leagues" drop;
- a July celebration;
- a late-August pre-season.

FC 25's leaked TOTY schedule ran from voting on 6 January to the full team on 23 January. Its TOTS ran
week by week from 25 April to 6 June
(https://www.si.com/soccer/ea-sports-fc-25-team-of-the-year-dates-voting-release-dates-leaked,
https://www.futwiz.com/news/article/confirmed-dates-for-fc-25-team-of-the-season-and-what-to-expect-from-tots-warm-up/10833).

**Rivals ladder.** Stars per win: +1 win, 0 draw, −1 loss. Divisions reset every 28 days (FC Mobile).
The chance quality in our attacks scales with the **rating gap** (VS Attack's Basic, Good and Great
chances). Cap the effect so that a 10-overall gap shifts the per-attack goal rate by about 5–7 points,
not more. FC Mobile's 2025 rework explicitly reduced "very difficult" chances.

**Avoid the FC Mobile grind complaint.** Card levelling costs should be reachable in about 1–2 weeks of
play per elite card.

### 7.14 Online protocol

Shot types, cones, keeper changes, deal weights and defend chances all change how attacks resolve and
the agreed shootout.

Per the hard constraints:
- bump `DRAFT_RULES.soccer` **2 → 3** in `src/net/match.ts`;
- bump `UT_RULES.soccer` **2 → 3**;
- leave NBA (draft 10 / UT 10) and NFL (draft 10 / UT 11) unchanged.

Anything purely visual (animation, camera, replays, stats sheet, foil cosmetics) does not need a bump.

---

## 8. Acceptance targets for the soccer audit

Run with `scripts/audit_soccer_shots.ts` and the soccer tests. Targets assume 75-rated sides unless
noted, with the arcade factor of about 1.6.

| Check | Target | Real anchor |
| --- | --- | --- |
| 1v1 from 12–16 m, keeper set, average finisher | 35–45% | big chance ≈ 40% |
| 1v1, SHO 95 vs GK 75 / SHO 75 vs GK 93 | 50–58% / 25–32% | elite +25% |
| Clean edge-of-box shot (18–21 m), one man closing, SHO 75 | 12–18% | real 7.6–10.5% (16–20 yd) |
| Same, SHO 95 + Curler+ | 20–26% | — |
| 25–30 m long shot, SHO 75 / 95 + Long Shot | 3–5% / 6–9% | real 2.5% |
| Header from a cross at 8–10 yd | 14–18% | real 10.3% |
| Chip 1v1 with keeper more than 4 m off line | 45–55% | real 38–48% |
| Shot on-target share (all shots) | 32–40% | 34.5% |
| Blocked share (shots from 18 m+) | 25–33% | 25–33% |
| Keeper save % overall | 66–72% | 70% |
| Per-attack goals: build / counter / wide | 18–21% / 24–28% / 17–20% | counters 1.5× regular |
| Corner attack / direct FK shot / penalty | 9–12% per attack / 9–11% per shot / 74–78% | 8.7% per corner shot / 5.2–6.4% / 76.5–79.8% |
| Goals per match (both sides, autopilot) | 2.6–3.2 | 2.8–3.0 |
| Goalless matches | 3–9% | 3–8% |
| Set-piece share of goals (excl. penalties) | 12–22% | 20.1% |
| First-time 180° pass error vs straight | ×1.5–1.7 | FC 26 "significantly less accurate" |
| 4th chained skill move | impossible (heavy touch) | FC 26 cap of 3 |

---

## 9. Sources (key ones; each is also cited inline above)

**EA official:**
- FC 24 gameplay deep dive: https://ea.com/games/ea-sports-fc/news/fc-24-gameplay-deepdive
- FC 25 gameplay deep dive: https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive
- FC 25 FC IQ deep dive: https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-fc-iq-deep-dive
- FC 26 gameplay deep dive: https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive
- FC 27 gameplay deep dive: https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-gameplay-deep-dive
- FC 27 PlayStyles: https://www.ea.com/games/ea-sports-fc/fc-27/news/what-are-playstyles
- Pack probabilities: https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities
- FC Mobile gameplay deep dive: https://www.ea.com/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive
- FC Mobile Rivals update: https://www.ea.com/games/ea-sports-fc/fc-mobile/news/rivals-update-gameplay
- FIFA 19 pitch notes: https://www.ea.com/games/fifa/news/fifa-19-pitch-notes-gameplay
- FC 26 1.2.0 notes: https://forums.ea.com/blog/ea-sports-fc-game-info-hub-en/ea-sports-fc-26-version-1-2-0-update-notes/12906902

**Patches and changes:**
- https://beebom.com/ea-fc-26-first-update-1-0-2-patch-notes
- https://mp1st.com/title-updates-and-patches/ea-sports-fc-26-update-1-4-3address-finesse-shot-playstyle-issues-patch-1-17-1-000-016
- https://insider-gaming.com/is-timed-finishing-in-ea-fc-26/
- https://insider-gaming.com/every-ea-fc-26-playstyle-change-explained/
- https://www.magicgameworld.com/?p=39804

**Reviews:**
- https://www.khaleejtimes.com/entertainment/gaming/ea-fc-26-review-fast-fluid-and-finally-listening-to-the-fans
- https://www.gfinityesports.com/article/fc-27-review-promising-ideas-undermined-by-poor-execution
- https://en.wikipedia.org/wiki/EA_Sports_FC_25
- https://en.wikipedia.org/wiki/EA_Sports_FC_Mobile
- https://en.wikipedia.org/wiki/EFootball

**FC Mobile guides and forums:**
- https://www.fifamobileguide.com/gameplay-controls
- https://gamingonphone.com/guides/fc-mobile-the-complete-vs-attack-mode-guide-and-tips
- https://forums.ea.com/discussions/fc-mobile-bug-reports-en/exclude-loose-balls-from-auto-switching/13651599
- https://forums.ea.com/discussions/fc-mobile-general-discussion-en/auto-defending-needs-an-overhaul-or-completely-removed/12404628
- https://forums.ea.com/discussions/fc-mobile-general-discussion-en/fc-mobile-has-gone-backwards---its-time-to-fix-the-game/13514347

**eFootball:**
- https://www.konami.com/efootball/en-us/page/new_controls
- https://gamingonphone.com/news/efootball-2025-five-important-gameplay-changes-following-v4-4-0-update

**Arcade references:**
- Retro Goal: https://defector.com/this-little-soccer-game-on-my-phone-is-fun-as-hell and
  https://www.nintendolife.com/reviews/switch-eshop/retro-goal
- Score! Hero: https://www.pocketgamer.com/score-hero/review/
- Dream League Soccer: https://gamebrain.co/game/dream-league-soccer-2025
- Pixel Cup Soccer: https://www.148apps.com/reviews/pixel-cup-soccer-review/
- FM26: https://www.footballmanager.com/fm26/features/where-storytelling-evolves-fm26s-match-day-experience
- Sensible Soccer: https://mitvblog.blogspot.com/2014/06/retrospective-sensible-soccer.html

**Animation:**
- https://www.techradar.com/news/hypermotion-technology-in-fifa-22-sounds-like-a-game-changer-but-what-is-it
- https://www.xsens.com/resources/blog/fifa-22-motion-capture

**Real-football data:**
- https://www.premierleague.com/news/4271974
- https://www.premierleague.com/en/news/4461793/what-are-the-biggest-trends-from-202526-so-far
- https://theanalyst.com/articles/premier-league-2024-25-shot-data
- https://theanalyst.com/articles/premier-league-2024-25-data-trends-stats
- https://theanalyst.com/articles/premier-league-corners-2024-25
- https://theanalyst.com/articles/premier-league-goalkeeper-stats-2024-25
- https://theanalyst.com/articles/what-are-expected-goals-xg/
- https://en.wikipedia.org/wiki/Penalty_kick_(association_football)
- https://databallpy.readthedocs.io/en/v0.5.0/features/simple_xG_models.html
- https://football-observatory.com/IMG/sites/b5wp/2018/254/en/
- StatsBomb open data via https://huggingface.co/datasets/ClementeH/statsbomb-open-data-shots (own analysis, §6.2)
