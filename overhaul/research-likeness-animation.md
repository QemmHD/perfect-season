# Player likeness and animation: research and recommendations

Track: player likeness and animation, for the Perfect Season overhaul (BRIEF.md). Written 2026-11-09 by a research agent. No repo files were edited.

**How this was researched.** The WebSearch budget for this turn had already been used up by the other research agents when this track started. Every source below was therefore fetched directly by URL: Wikipedia, EA and 2K official pages, App Store and Steam listings, reviews, GDC Vault, pixel-art tutorials and technical blogs. A few URLs were first found by the sibling files (`research-basketball.md`, `research-football.md`, `research-soccer.md`) and re-read here where possible. Claims marked **[mem]** come from general knowledge and were not re-verified this session. Numbers marked **[design]** are our proposals, not sourced. If more searching is wanted, a follow-up turn can add community sources such as Reddit threads and YouTube breakdowns.

---

## 0. The short version

1. **Identity has three layers: look, motion and ability.** The big studios spend as much on motion likeness as on faces: 2K25 added 9,000 ProPLAY animations, 1,100 of them signature shots; Madden 26 added QB DNA with 9 ball holds, 3 arm slots and signature run cycles; FC 25's AI Mimic covers 1,847 athletes' full-body movement. Tecmo's Bo Jackson and NBA Jam are remembered for what the players *did*. At 20–60 px tall we need all three layers.
2. **Today every player shares one skin tone (`DEFAULT_SKIN #a8714f`) and gets a hashed hair style (6 styles) and a 1-in-4 beard.** Two stars of the same size look identical. This is the single biggest gap against the owner's ask: "so we know who is who".
3. **Traits that carry identity at 20–60 px, in order:** build and height silhouette, hair silhouette and colour, head accessories (headband, goggles, visor), skin tone, facial hair, asymmetric limb gear (one sleeve, one knee pad, tights), socks and shoes, number (≥28 px only), handedness, then signature motion and celebration.
4. **Adopt a compact `Appearance` record (about 15 enum fields) with per-era overrides.** Players look different across a long career, and Hoop Land even greys hair with age.
5. **Skin palette:** 10 tones anchored on the open Monk Skin Tone scale (hex values in §3.2), each with a generated 3-tone ramp and outline that fit our existing 3-tone shader.
6. **Author in tiers.** Tier A: about 150 icons per sport, fully curated, with motion DNA. Tier B: about 1,000 per sport with base looks. Tier C: deterministic defaults. Write in readable YAML and build to compact JSON, lazy-loaded with the game chunk (about 20 KB gzipped for 3,000 entries).
7. **Avoid sensitive inference.** Never derive skin or hair from name, nationality, birthplace, team or position. Store no race or ethnicity field. Run no face or skin classifier on photos. Uncurated players keep a neutral default tone. Don't draw tattoos (2K was sued twice over tattoo likeness) or brand marks on shoes and headbands.
8. **Level of detail by sprite height.** Below 24 px, hair collapses to 4 silhouettes and facial hair is dropped. From 24 to 40 px, add beards, goggles and sleeves. At 40 px and above, add numbers and braids. A small "readability head scale" of up to +25% at small sizes nods to NBA Jam's big heads without caricature.
9. **Motion DNA, render-only.** Shot form (release speed, set-point height, one or two motion, fade, follow-through hold), dribble style, dunk set, QB arm slot and ball hold, run style and celebration. Derive them from ratings and size with rule tables like FC 26's acceleration types, and override them for Tier A. If DNA ever changes simulation timing, bump that sport's protocol.
10. **Animation rules that make pixel sports look real:**
    - Lock contact events to game time and warp only the anticipation and recovery.
    - Match playback rate to ground speed (clamped 0.8–1.25×) and anchor the sprite to the stance foot so nothing skates.
    - Hold key poses (set point, apex, contact) 2–4 frames.
    - Use one smear frame on fast swings, and 1 px overshoot on recovery.
    - Bob the head −1, −1, +2 px per stride.
    - Let hair and jersey trail the body by 1–2 frames.
    - Keep hit-stop at 33–120 ms, about a third of fighting-game values.
    - Scale trauma shake with mass × speed.
11. **Player-initiated actions must change the picture within 100 ms** (6 frames at 60 Hz, Nielsen's "instantaneous" limit). Anticipation longer than that must *be* the response, for example the dip starting on the press frame. AI telegraphs can be longer.
12. **Frame plans for 27 actions are in §4.4–4.6** (basketball, football, soccer), with frames at 60 Hz, pixel deltas, events and juice. Our existing CMU mocap timings already land close to real sport timing. The jump shot clip releases 0.6 s after the gather, which matches Curry-style "under half a second upon jumping".
13. **Spend likeness outside the match too.** A pixel portrait on the card, a pack walkout where the player performs his signature celebration, and a 1.5 s name tag over the ball handler (Hoop Land has name/number toggles). This connects the card collection to the match.
14. **Crowd and celebrations are where pixel sports games lose polish.** Hoop Land reviewers call out identical crowd hair and static seating, and celebrations that only raise hands. Recolour the crowd from the same palettes, have it react within 6–12 frames, and give teammates a run-to-shooter celebration.
15. **Keep it original.** Use generic celebration names and our own names for systems (not ProPLAY, HyperMotion, QB DNA), no logos, and no copied likeness art. Every sprite is still drawn in code.

---

## 1. Where the game is today (code snapshot, `/home/user/ps-studio`)

- **`src/game/pixel/body.ts` `Look`:**
  - `hair` 0–5: short, buzz, high top, bald, headband, locs.
  - `beard?: boolean`, `skin`, `hairColor`.
  - Uniform colours, and football helmet, mask, pads and sleeves; soccer keeper gloves.
  - `DEFAULT_SKIN = '#a8714f'` and `DEFAULT_HAIR = '#1d1612'`.
  - `hairFor(id)` hashes into `[0,0,0,1,1,2,3,4,5,0,1]`, and `beardFor(id)` gives one player in four a beard.
- **`src/game/sprites.ts`** says it outright: *"Everyone shares one skin tone: the data has no reliable source for what a player looks like, and the games don't guess."* `hoops2` and `soccer2` call `hairFor(b.p.id)`; `football2` hard-codes `hair: 0`.
- **Sprite size.** `px = height_ft × scale` (minimum 10 px), rounded to even above 14. Players use 8 facings below 26 px and 16 above (hoops2 `render.ts` around line 444).
- **Mocap.** 26 CMU clips at 30 fps with event tags and root motion (`src/data/mocap/index.json`). Relevant timings:

  | Clip | Length | Events / beats |
  |---|---|---|
  | `jumpshot` | 1.40 s | gather 0.10, dip 0.29, set 0.375, takeoff 0.467, apex 0.692, release 0.70, land 0.917 |
  | `layup` | 1.53 s | takeoff 0.65, release 0.99 |
  | `jump` | 1.8 s | dip 0.48, takeoff 0.74, apex 1.0, land 1.275 |
  | `crossover` | 1.0 s | cross 0.4 |
  | `run` | 0.65 s loop | |
  | `sprint` | 0.717 s loop | |
  | `throw` | 2.7 s | release 1.85 |
  | `catch` | 0.9 s | catch 0.358 |
  | `kick` | 1.6 s | plant 0.75, contact 0.975 |
  | `dive` | 2.13 s | takeoff 0.458, impact 1.325 |
  | `fall_back` | | impact 0.5 |
  | `stiff_arm` | | extend 0.225 |

  `warp()` already retimes a clip so that an event lands when the game decides (hoops2 warps the jumper's release to `JUMPER_TOP`, and the layup's takeoff and release to 0.26 and 0.57 s).
- **`src/game/pixel/style.ts`.** `heaviness()` from BMI, `leanForward()`, `widen()`, `sprintLean()`: body-type touches on the mocap.
- **`src/game/juice.ts`:**
  - Trauma² shake on smooth noise: `maxShake` 9 px, trauma decays 1.6 per s.
  - A directional kick, a zoom punch, and pooled particles.
  - Render-only hit-stop: `dunk 70, block 60, truck 90, int 50, green 40, bighit 80, posterize 90` ms. Reduced motion caps hit-stop at 30 ms and removes shake.

So the motion pipeline is already ahead of most pixel sports games. What is missing is visual identity data, signature variation, and a handful of animation rules: foot anchoring, holds, smears, secondary motion and crowd.

---

## 2. How the reference games make players recognisable

### 2.1 Console and PC

**NBA 2K**

- **Faces.**
  - The series was first to give every player a unique face (ESPN NBA Basketball era).
  - NBA 2K15 added consumer face scanning: about 30 s, 6–12 in from the camera, turning the head 30° each way ([Wikipedia: NBA 2K15](https://en.wikipedia.org/wiki/NBA_2K15)).
  - Recreated player tattoos led to two lawsuits against Take-Two. Solid Oak Sketches sought a US$1.1 M licence first, then sued in 2016; James Hayden sued in 2017 ([Wikipedia: NBA 2K](https://en.wikipedia.org/wiki/NBA_2K)). **Lesson for us: never reproduce tattoo designs.**
- **Motion likeness: ProPLAY.**
  - 2K24 introduced ProPLAY, which turns NBA game footage into animations for jumpers, dunks, layups, dribble moves, passes and signature movement ([Wikipedia: NBA 2K24](https://en.wikipedia.org/wiki/NBA_2K24)).
  - The director noted it helps with retired and deceased players, who are hard to mocap.
  - The marketing names recognisable movement: Durant's jumper and free-throw form, Curry's dribbles and pull-ups, Jokić's "methodical moves and touch around the rim" ([Hoopsgamers 2K24](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)).
  - 2K25 added **9,000 ProPLAY animations, 1,100 of them signature shots** ([NBA2KLab](https://www.nba2klab.com/nba-2k25-gameplay-courtside-report), [Wikipedia: NBA 2K25](https://en.wikipedia.org/wiki/NBA_2K25)), plus 1,500 dribble animations (sibling research).
- **2K26 foot planting and shot feel.** "Lower-body pose matching … eliminates sliding by replicating realistic foot planting and cuts" ([Hoopsgamers 2K26](https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more)). The shot animation reads the input timing:
  - Delaying the push makes the player "hold the set point and hang a bit".
  - A rushed push rushes the animation.
  - A slow stick throw gives a "lazier looking follow through".
  
  This is the clearest published example of **animation as feedback for timing**. Faster motion styles are gated by ratings.

**Madden NFL**

- **Madden 26, QB DNA** ([EA Gridiron Notes](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)):
  - **9 ball holds**, with one-hand holds switching to two hands under pressure.
  - **3 arm slots** (Over-Top, ¾ High, ¾ Low), assigned from each QB's real default throw angle.
  - **Signature run cycles** for scrambling QBs (Murray, Hurts, Mahomes), after Barkley and McCaffrey got them in 25.
  - **Signature off-platform throws** for specific players: jump passes, no-looks, cross-body.
  - **Field Vision** that cuts accuracy for shorter QBs.
  - 500+ new QB animations (40 QB "recipes"), 700+ tackle animations, and **4,000+ celebration elements with 20 solo celebrations across 9 hot spots**.
  - Physics animation extended to catch tackles, stiff arms and trucks.
  - "A 4.2 is a 4.2": one shared movement model, with speed from data.
- **Madden 25, BOOM Tech.** Physics tackling and ball-carrier balance, 700+ catch animations, 500+ blocking animations, 16 signature QB sets, and "hundreds" of new jukes, spins and hesitations ([mut.gg deep dive](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive), [Wikipedia: Madden 25 (2024)](https://en.wikipedia.org/wiki/Madden_NFL_25_(2024_video_game))).
- **Madden 24, SAPIEN.** New skeletons and "more lifelike player models", plus 1,000+ new hit and tackle animations ([Wikipedia: Madden NFL 24](https://en.wikipedia.org/wiki/Madden_NFL_24)). EA presented SAPIEN as body-type-accurate skeletons, so that a lineman and a corner are built differently **[mem]**.
- **Madden 27.** "Signature animation differentiation" is listed as a pillar. Uniforms and helmets get dirty with weather and field conditions ([EA Madden 27 gameplay](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay)).

**EA SPORTS FC / FIFA**

- **FIFA 18.** Real Player Motion Technology, plus named star celebrations: Ronaldo's jump, Rooney's "Knockout", Eto'o's "Old Man", Lewandowski's "X" ([Wikipedia: FIFA 18](https://en.wikipedia.org/wiki/FIFA_18)). Celebrations are part of identity.
- **FIFA 22, HyperMotion.** 22 players captured in a full match in Xsens suits, powering "over 4000 new animations" ([Xsens](https://www.xsens.com/resources/blog/fifa-22-motion-capture)). A machine-learning model learned from 8.7 million frames ([Wikipedia: FIFA 22](https://en.wikipedia.org/wiki/FIFA_22)).
- **FC 24, HyperMotionV.**
  - Volumetric data from **180 matches**.
  - **34 PlayStyles in 6 categories**.
  - **AcceleRATE: 7 acceleration archetypes assigned automatically from physical features** ([Wikipedia: EA Sports FC 24](https://en.wikipedia.org/wiki/EA_Sports_FC_24)).
  - Fans attacked the poor likeness on the cover art, and EA promised in-game fixes. Likeness is something fans check.
- **FC 25, AI Mimic.** Full-body movement for **1,847 athletes**, up from 1,373 upper-body in FC 24 ([EA FC 25 deep dive](https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive)).
- **FC 26** ([EA FC 26 deep dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive)):
  - Close-range shots and quick passes use "minimal wind-up".
  - "Animation selection now better matches the player's current speed".
  - Faster deceleration, and "Effort Touch" animations for sharp dribble turns.
  - **Stand-tackle animation access gated by attribute**: below 71 basic, 71–84 most, 85+ all.
  - Three acceleration types from rule thresholds:
    - **Explosive:** AGI ≥ 65, AGI−STR ≥ 10, ACC ≥ 80, height ≤ 182 cm.
    - **Lengthy:** STR ≥ 65, STR−AGI ≥ 4, ACC ≥ 40, height ≥ 183 cm.
    - **Controlled:** everyone else.
  - **The lesson: a stat- and size-driven rule table can assign a recognisable movement style to tens of thousands of players.**
- **FC 27.** "Off-balance dribbling" stumble-but-keep-control animations, gated by attributes ([EA FC 27 deep dive](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-gameplay-deep-dive)).
- **College Football 25.** NIL opt-ins from **10,000+ athletes**, a likeness problem at our scale ([Wikipedia: CFB 25](https://en.wikipedia.org/wiki/EA_Sports_College_Football_25)). The page does not say how faces were produced at that scale.

### 2.2 Mobile versions

- **FC Mobile 24** ([EA FC Mobile deep dive](https://www.ea.com/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive)):
  - Brought **run styles to mobile for the first time**: "body movements were recreated for certain star players".
  - Power Shots have a **longer wind-up that leaves the shooter open to a tackle**, so anticipation is a risk/reward lever.
  - The Power Shot camera zoom can be switched off.
  - Button spacing is a setting, and the joystick size was optimised.
- **NBA 2K Mobile** (Cat Daddy, 2018):
  - It promised "console quality graphics", and reviewers called the realistic look "simply impressive".
  - Cards have **built-in shooting advantages that reflect real shooting ability**, and shooting uses a timing bar (green guarantees a make).
  - Its auto mode beat manual play, which reviewers criticised ([Wikipedia: NBA 2K Mobile](https://en.wikipedia.org/wiki/NBA_2K_Mobile)).
  - 2K now ships Apple Arcade editions and a separate MyTEAM Mobile ([Wikipedia: NBA 2K](https://en.wikipedia.org/wiki/NBA_2K)).
- **Madden Mobile** defaults to a **one-button** scheme where "tapping and swiping handle most of the action". Manual controls add jukes, stiff arms and user tackles ([EA Madden Mobile 26 how-to](https://www.ea.com/en/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-how-to-play)). Metacritic score: 68 ([Wikipedia](https://en.wikipedia.org/wiki/Madden_NFL_Mobile)).
- **What mobile tells us:** on a small screen, the console games keep **motion identity** (run styles, signature shots) and **ability identity** (card shooting boosts) more than facial detail. Our pixel approach can compete on those two layers.

### 2.3 Small-scale and pixel sports games

| Game | How players read as "who" | What people remember |
|---|---|---|
| **NBA Jam (1993)** | Players were digitised from video of amateur players. Real names and teams sat on exaggerated bodies. The 2010 remake put **high-resolution photo heads on 3D bodies** ([Wikipedia 1993](https://en.wikipedia.org/wiki/NBA_Jam_(1993_video_game)), [2010](https://en.wikipedia.org/wiki/NBA_Jam_(2010_video_game))). Big Head mode was a Tournament Edition code **[mem]**. | Physics-defying dunks; "on fire" after 3 straight baskets (ball and net burn); the announcer's catchphrases; hidden characters. About $1 B in quarters in year one. |
| **NFL Blitz** | Low-poly models (a few hundred polygons) moved by mocap from Mortal Kombat's performer. Late-hit and piledriver animations were the identity until the NFL objected ([Den of Geek](https://www.denofgeek.com/games/nfl-blitz-history-making-of-too-violent-retrospective-midway/)). | 60 fps, 7-a-side, 30-yard first downs, exaggerated hits. |
| **Tecmo Bowl / Tecmo Super Bowl** | First NES games with real NFLPA players. Identity came from **abilities**: Bo Jackson's speed ("absurdly unstoppable") and Lawrence Taylor on defence ([Wikipedia TSB](https://en.wikipedia.org/wiki/Tecmo_Super_Bowl), [Tecmo Bowl](https://en.wikipedia.org/wiki/Tecmo_Bowl)). Cinematic close-up cut-scenes on big plays **[mem]**. | Still modded with annual roster updates; 161,076 viewers for a 2016 tournament stream. |
| **Sensible Soccer** | Tiny sprites on a zoomed-out view, and no licensed players ([Wikipedia](https://en.wikipedia.org/wiki/Sensible_Soccer), [retrospective](https://mitvblog.blogspot.com/2014/06/retrospective-sensible-soccer.html)). | "Physics-defying aftertouch" swerve and responsive controls. It topped Amiga Power's all-time list. |
| **Retro Bowl** (New Star) | 8-bit style influenced by Tecmo; the unlimited version lets you **change player avatars** ([Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl)). Reaction animations are praised: tacklers "crash to the ground" after a dodge, which is "exhilarating" ([Pocket Gamer](https://ee.pocketgamer.com/articles/084147/retro-bowl-review-a-must-play-sports-game/)). **NFL Retro Bowl '27** (Apple Arcade, 2026) is a licensed pixel-art version with "all the teams & stars of the NFL & NFLPA" ([New Star Games](https://www.newstargames.com)). | Drag-to-aim throws ("a pinpoint pass … almost as good as a touchdown"), short "one more game" sessions, and light management ([MobileSyrup](https://mobilesyrup.com/2020/09/27/retro-bowl-football-game-review/)). |
| **Retro Goal** (New Star) | 16-bit style, with **refreshed character art plus an option to switch back** to the original ([App Store](https://apps.apple.com/nz/app/retro-goal/id1535765855)). | Art and management praised; dribble and shoot controls criticised. |
| **Hoop Land** (Koality Game) | Every player has his own look: "put faces to names", "every player also has their own look" ([148Apps](http://www.148apps.com/reviews/hoop-land-review/)). The editor: **v1.09.5 added 48 hairstyles, 7 facial-hair styles and 3 accessories**; secondary head accessories; team sole and lace colours. **Deceased players' sprites are drawn in black and white, and hair greys with age.** Toggles show the ball handler's and target's name, number and position ([App Store](https://apps.apple.com/us/app/hoop-land/id1605197976)). | "True 3D rim and ball physics", attention to "the minutia of little physics details". Steam rating 95% positive. **Complaints:** crowd members share hairstyles and stay seated; game-winner celebrations only raise hands, and a reviewer wants teammates to run to the shooter ([App Store](https://apps.apple.com/us/app/hoop-land/id1605197976), [Steam](https://store.steampowered.com/app/2453660/Hoop_Land/)). |
| **Pixel Cup Soccer** | Cute pixel art; slide tackles **leave marks on the pitch**; slow motion "brilliantly implemented"; 44 stadiums with different grass ([GertLush](https://gertlushgaming.co.uk/pixel-cup-soccer-ultimate-edition-review-steam/)). | Arcade "Nintendo World Cup vibe", but "too basic" and sluggish passing ([148Apps](https://www.148apps.com/reviews/pixel-cup-soccer-review/)). |
| **Mario Strikers** | Captains have unique super abilities, and each character has a class (Balanced, Playmaker, Power, Offensive, Defensive) ([Wikipedia](https://en.wikipedia.org/wiki/Mario_Strikers_Charged)). | Identity through a signature move. |

Super Arcade Football (OutOfTheBit) and Basketball Stars (Miniclip) were in the brief, but no independent page on them could be fetched this session. We draw no conclusions from them.

**Synthesis.** Pixel games that are remembered for "who is who" do it with (a) a few readable visual markers (Hoop Land), (b) an exaggerated signature *thing* each star does (Tecmo, Jam, Strikers), and (c) reactions that sell contact (Retro Bowl, Blitz).

### 2.4 What carries identity at 20–60 px

A sprite 20–60 px tall has a head of about 3–9 px. SLYNYRD's small-sprite guidance says to prioritise "basic readability", that a few strong markers do the job (the example is "shoulder pads and flaming red hair"), and to leave other details implied ([Pixelblog 47](https://www.slynyrd.com/blog/2023/11/26/pixelblog-47-tiny-pixels)). The ranking below is a [design] synthesis.

| Rank | Trait | Readable from | Pixel cost | Why it works |
|---|---|---|---|---|
| 1 | **Height and build silhouette** | 10 px | none (from data) | Already modelled (`shapeOf`, `heaviness`). Exaggerate the extremes slightly: a 7'3" centre and a 5'9" guard should differ by about 25% in height. |
| 2 | **Hair silhouette** (afro, high-top, long locs, mohawk, long flow, bald) | 12 px | 1–3 px outside the head | Changes the head outline, the first thing the eye reads. |
| 3 | **Hair colour against the jersey** (bleached, blond, red, dyed) | 12 px | 0 extra | Very high signal. Era-dependent, as with dyed-hair seasons. |
| 4 | **Head accessory** (headband, goggles, tinted visor, soccer hair band) | 16 px | 1 px band | A bright band breaks the head and reads at distance. |
| 5 | **Skin tone** | 12 px | 0 extra | Matters most in close-ups and on cards. Correct only when curated. |
| 6 | **Facial hair** (full beard, goatee) | 24 px | 2–6 px | A full beard reads as a dark lower face. At 20 px use only 1 px or drop it. |
| 7 | **Asymmetric limb gear** (one arm sleeve, one knee pad, tights, gloves) | 20 px | 1–2 px per limb | Asymmetry is rare, so it is very identifying. |
| 8 | **Socks and shoes** (high or low socks, bright or white shoes) | 16 px | 1–2 px | Flicks on every stride. |
| 9 | **Jersey number** | 28 px | 3×5 font | Already drawn. Only legible on large sprites. |
| 10 | **Handedness and footedness** | in motion | 0 | Lefty jumpers and lefty QBs stand out. Only 33 left-handed QBs have played in the NFL ([Wikipedia](https://en.wikipedia.org/wiki/List_of_left-handed_quarterbacks)). Two-footed players are about one sixth of Europe's top leagues ([Wikipedia: Footedness](https://en.wikipedia.org/wiki/Footedness)). |
| 11 | **Signature motion** (shot form, run style, arm slot, celebration) | in motion | animation params | This is what 2K, Madden and FC invest in most. |

---

## 3. Recommended appearance model

### 3.1 Schema (render-only; add-only and optional, like `src/ut/state.ts` rules)

```ts
// src/game/pixel/appearance.ts (new)
export interface Appearance {
  v: 1;
  /** 0-9, index into SKIN (Monk-anchored). undefined -> NEUTRAL_SKIN */
  skin?: number;
  hair: HairStyle;          // 18 styles below
  hairTone: HairTone;       // 0-14 below (9 natural, 5 dyed, 'team')
  facial: Facial;           // none|stubble|mustache|goatee|chinstrap|short|full|long
  head: HeadGear;           // none|band-thin|band-wide|wrap|alice|cap-under(NFL skull cap)
  headC?: Accent;           // white|black|team1|team2|neon|tone(skin-like)
  eyes: Eyewear;            // none|goggles|mask-clear (protective face mask)|visor-clear|visor-dark|visor-tint (NFL)
  armL: ArmGear; armR: ArmGear;   // none|sleeve|shooter(to elbow)|elbow|wrist|tape|forearm|long(NFL/soccer long sleeve)
  armC?: Accent;
  legL: LegGear; legR: LegGear;   // none|kneepad|kneesleeve|brace|tights|calf
  legC?: Accent;
  socks: Socks;             // low|crew|high|over-knee (soccer 'rolled-down' = low)
  shoe: Accent;             // white|black|team1|team2|neon|gold
  gloves?: Accent;          // NFL skill players, soccer winter/keeper
  towel?: boolean;          // NFL: towel tucked at the waist (QB/RB/WR)
  armband?: boolean;        // soccer captain (by squad role, not stored per player)
  build?: Build;            // override only: lean|avg|muscular|stocky|heavy (default from ht/wt)
  hand: 'R' | 'L';          // shooting/throwing hand
  foot?: 'R' | 'L' | 'B';   // soccer
  motion?: MotionDNA;       // §3.8
  src: 'curated' | 'default' | 'user';
}
/** per-era override: only the fields that changed */
export type LookEra = { from: number; to: number } & Partial<Omit<Appearance, 'v' | 'src'>>;
```

**Hair styles (18).** Each is a [design] pixel recipe for a ~36 px sprite (head about 6×6 px); scale with the head radius.

| id | Style | Recipe on the head sphere (the renderer already shades hair on the head via `u`/`ar`) |
|---|---|---|
| 0 | bald | Skin everywhere. Add a 1 px specular highlight on the crown; this is how bald reads. |
| 1 | buzz | Top cap tinted `mix(hair, skin, 0.35)` (existing BUZZ slot). |
| 2 | short | Solid 1 px cap. |
| 3 | fade/crop | 1 px top cap; sides use the buzz tint. |
| 4 | waves/brush | Like short, with an alternating 1 px highlight row at ≥40 px. |
| 5 | high-top | Flat-topped block, +3–4 px above the crown. |
| 6 | afro-small | +1 px ring all round. |
| 7 | afro-large | +2–3 px ring all round, round outline. |
| 8 | twists/sponge | +1–2 px with a jagged top (alternate pixels). |
| 9 | locs-short | Strands to the ears and nape, 2–3 px, with 1-frame lag. |
| 10 | locs-long | Strands to the shoulders, 4–6 px, with 2-frame lag and bounce. |
| 11 | braids/cornrows | Alternating hair and skin rows front to back at ≥40 px; otherwise a short cap. |
| 12 | bun/ponytail | 2×2 knot at the back; a ponytail swings. |
| 13 | long-flow | Back hair to the collar, 2–3 px, lagging. |
| 14 | mohawk/frohawk | Central strip 2 px wide, +2–3 px tall; sides bald or buzz. |
| 15 | mullet | Short top, 2–3 px hanging at the back. |
| 16 | curly-top | +1–2 px irregular top, faded sides. |
| 17 | receding | Cap at the back and sides only; the forehead is skin. |

**Facial hair (8):** none, stubble, mustache, goatee, chinstrap, short beard, full beard, long beard. The renderer already has a beard test (`u < -0.32 && ar < 0.78`). Extend it with region masks:

- **Mustache:** 1 px row above the mouth.
- **Goatee:** chin centre, 2×2.
- **Chinstrap:** jaw outline only.
- **Short beard:** the lower 35% of the face.
- **Full beard:** the lower 45%, plus 1 px beyond the jaw.
- **Long beard:** the full-beard mask, plus 1–2 px hanging below the chin.
- **Stubble:** the short-beard mask in `mix(hair, skin, 0.5)`.

### 3.2 Palettes

**Skin: 10 tones anchored on the Monk Skin Tone scale.** The MST is an open 10-tone scale built with Google for more inclusive representation, with 40% of its levels in the darker range, against Fitzpatrick's 6 types ([Wikipedia: MST](https://en.wikipedia.org/wiki/Monk_Skin_Tone_Scale), [Fitzpatrick](https://en.wikipedia.org/wiki/Fitzpatrick_scale)). The anchors are MST's published hexes. The shadow, highlight and outline columns are a [design] starting ramp for our 3-tone shader: warm shadow (R×0.80, G×0.72, B×0.70), a highlight toward warm white, and a near-black outline for the darkest three.

| # | Anchor (MST) | Shadow | Highlight | Outline |
|---|---|---|---|---|
| 0 | `#f6ede4` | `#c5aba0` | `#f8f0e6` | `#675552` |
| 1 | `#f3e7db` | `#c2a699` | `#f6ebde` | `#66534f` |
| 2 | `#f7ead0` | `#c6a892` | `#f9edd5` | `#68544b` |
| 3 | `#eadaba` | `#bb9d82` | `#efe0c3` | `#624e43` |
| 4 | `#d7bd96` | `#ac8869` | `#e0c9a4` | `#5a4436` |
| 5 | `#a07e56` | `#805b3c` | `#b5976f` | `#432d1f` |
| 6 | `#825c43` | `#68422f` | `#9e7c5f` | `#372118` |
| 7 | `#604134` | `#4d2f24` | `#81614f` | `#0e0a09` |
| 8 | `#3a312a` | `#2e231d` | `#625346` | `#0e0a09` |
| 9 | `#292420` | `#211a16` | `#53483d` | `#0e0a09` |

Tuning notes [design]:

- MST swatches are fairly desaturated. Raise saturation by 8–15% for in-game pixels, then check contrast:
  - The light tones (0–3) against white jerseys need the outline.
  - The dark tones (7–9) against dark jerseys and night pitches need a 1 px lighter rim on the lit side. Keep the highlight at least 25 L* above the base.
- Test all 10 tones on every kit colour in the existing `Gallery.tsx`.
- `NEUTRAL_SKIN` for uncurated players stays as today (`#a8714f`, between MST 5 and 6), so current visuals do not change for anyone uncurated.

**Hair tones (15)** [design]:

- **Natural:** black `#1d1612` (current default), dark brown `#3b2a20`, brown `#6a4a32`, light brown `#8f6a48`, auburn `#8a3f22`, ginger `#b5562a`, blond `#d6b36a`, platinum/bleached `#ece6d2`, grey `#9b9b9b`.
- **Dyed:** red `#c8343c`, blue `#3a6fd8`, green `#3fae5a`, pink `#e070b0`, purple `#7a4ac8`.
- **Team:** the kit's primary colour.

**Accent colours for gear:** white, black, team1, team2, neon (`#c6ff3a`), gold, and skin-tone (sleeves that match skin). Never draw logos or swooshes; colour only.

### 3.3 Level of detail by sprite height (the renderer already knows `px`)

| px | Hair | Facial | Head gear | Limb gear | Number |
|---|---|---|---|---|---|
| < 16 | 3 silhouettes: none, cap, tall/big | off | band as 1 px of colour if band-wide | off | off |
| 16–23 | 4 silhouettes: none, cap, tall, long | full beard only (1 px chin row) | yes | sleeves and tights only | off |
| 24–39 | all 18 (braids drawn as a short cap) | all except stubble | yes, including goggles | all | ≥ 28 px |
| ≥ 40 | all, with braid rows and wave highlights | all | all | all, plus wristbands and tape | yes |

### 3.4 A small readability head scale

NBA Jam's photo heads (and its Big Head code **[mem]**) made faces read at arcade distance. We don't want caricature. A gentle, size-dependent head boost does help the head markers survive at small sizes [design]:

- `headScale = clamp(1 + (32 − px) / 64, 1, 1.25)`: no change at 32 px and above, and +25% at 16 px.
- Apply it to the head capsule radius only, not to body height. The silhouette ranking stays intact.

### 3.5 Era overrides

Cards are season-specific (a 1996 card and a 2003 card of the same player). Store the base look plus optional `LookEra` entries keyed by season range. For example, a player who shaved his head in his 30th season gets `{from: 2015, to: 2026, hair: 0}`. Hoop Land's greying with age shows players notice this ([App Store](https://apps.apple.com/us/app/hoop-land/id1605197976)). Optional extra: a grey-tone shift for players over 35 when the birth year is known, applied to tiers B and C only.

### 3.6 Deterministic defaults (Tier C)

A seeded choice per field, using the existing `hash()`, each field with its own salt (`id + ':hair'` and so on), with distributions by sport, era and position. All weights below are [design]; tune them by eye in the gallery.

- **Skin:** `NEUTRAL_SKIN`, always. **Never infer it.**
- **Hair, by era:**
  - NBA 1970s: afro-small and afro-large together about 30%, short 40%, others 30%.
  - NBA 2010s: fade 30%, buzz 20%, short 15%, locs and twists 12%, bald 8%, others 15%.
  - NFL: helmets hide most hair, so draw only hair below the helmet (locs-long, long-flow or mullet at about 12%).
  - Soccer: short or fade 55%, long-flow 10%, buzz 15%, curly 8%, others 12%.
- **Hair tone:** black or dark brown 85%, brown 10%, other natural 5%. No dyed tones by default.
- **Facial hair:** none 60%, stubble 15%, short 12%, goatee 7%, full 6%. Zero for anyone under 21 when age is known.
- **Gear by era and position:**
  - NBA: arm sleeve p = 0.12 (2004+), headband p = 0.06 (1990–2015), knee pad or sleeve p = 0.10, high socks p = 0.5 (1970s) falling to 0.15.
  - NFL: visor p = 0.25 for skill positions (2005+), towel p = 0.3 for QB, RB and WR (1990+), gloves p = 0.9 for WR and RB (2000+), long sleeves p = 0.15 for OL in cold games.
  - Soccer: long sleeves p = 0.15, low socks p = 0.08, keeper gloves always.
- **Shoe colour by era:** 1970s–80s white about 80%; 2010s team or black 50%, neon 15%.
- **Handedness:** from data when present. Otherwise about 10% left-handed for NBA shooters and 0% for QBs unless known. For soccer footedness, use data or 75/20/5 (R/L/B).

### 3.7 Authoring thousands of real historical players

1. **Tiers.** Rank players by how often users see them: UT card circulation and pack weights, promo appearances, all-time ranks and draft-pool frequency.
   - **Tier A (about 150 per sport):** all fields, era overrides and motion DNA.
   - **Tier B (about 1,000 per sport):** skin, hair, tone, facial hair, main gear and hand.
   - **Tier C:** deterministic defaults.
2. **Format.**
   - Write readable YAML per sport (`src/data/looks/nba.yaml`): `- id, name, skin: 6, hair: high-top, tone: black, facial: none, head: band-wide/white, armR: sleeve/black, hand: R, eras: [...]`.
   - Build to compact JSON with a script (like `scripts/build_mocap.py`): one base-36 character per enum field, plus an optional accent suffix.
   - That is about 20–25 bytes per player, so 3,000 entries is about 70 KB raw, about 20 KB gzipped.
   - Lazy-load it with each sport's game chunk; soccer and the games already load lazily.
3. **Sources and rules for curators.**
   - Use public, non-sensitive *visual* description of how the player looked in that era: hairstyle, hair colour, facial hair, worn gear, and a skin-tone index chosen visually from public match photos.
   - **Prohibited:**
     - race or ethnicity fields;
     - deriving any field from name, nationality, birthplace, team or position;
     - automated face or skin classification;
     - medical reasons (goggles are just "goggles");
     - tattoos (2K lawsuits);
     - logos.
   - Each entry keeps `src` and a review flag. Corrections from users or the owner are a one-line data change.
4. **Validation tests:**
   - All enums are valid.
   - Every id exists in the player data, and era ranges fall inside the player's seasons.
   - The file stays inside its size budget.
   - Defaults are stable for a given id (snapshot).
   - Rendering never touches simulation; copy the `juice.test.ts` pattern, where a seeded game must come out identical with looks on and off.
5. **Tools.**
   - Add an appearance editor to the existing pixel `Gallery.tsx` or Admin Studio, previewing all LOD sizes and facings with both kits.
   - Curated data ships in the bundle. Do not write it to the live registry during QA (BRIEF).
   - Optional: user overrides stored as additive local state (`looks.user`), as Retro Bowl's avatar editing and Hoop Land's editor allow.

### 3.8 Motion DNA (signature motion, render-only)

| Field | Values | Default rule [design] (ratings → style) | Curated for |
|---|---|---|---|
| `shot.speed` | −2…+2 (warp gather→release ±15%) | high 3PA rate and quick release = +1; bigs = −1 | Tier A shooters |
| `shot.set` | low / mid / high (set point at chin / forehead / above the head) | height + 3PT | icons |
| `shot.motion` | one or two (one fluid motion vs a pause at the set point) | guards one, bigs two | icons |
| `shot.kick` / `fade` | leg kick, fade-away | mid-range specialists get fade | icons |
| `shot.hold` | follow-through hold of 12 / 18 / 24 f | random by id | — |
| `dribble` | low-quick / upright / hesi | handle + speed | Tier A guards |
| `dunk` | subset of the existing `DunkStyle` (one, two, contact, tomahawk, windmill, hang) | vertical + height | Tier A dunkers (1–2 signature) |
| `qb.slot` | over / high¾ / low¾ | random, weighted 50/35/15 | Tier A QBs (Madden assigns from real throw angle) |
| `qb.hold` | two-hand-high / one-hand-low / chest | | Tier A |
| `run` | upright / low / long / choppy / glide | like FC 26: AGI−STR and ACC give explosive/choppy; STR, ACC and height ≥183 cm give long; otherwise controlled/upright | Tier A |
| `celebrate` | generic library id (§4.7) | by position archetype | Tier A |

Each DNA value is a **pose modifier** on the mocap joints, like the existing `leanForward` and `widen`, or a `warp()` key. It is not a new clip, so the cost is a few lines per variant.

**Protocol warning (BRIEF):** if any DNA value changes simulation timing (release time, block exposure, hitboxes), that sport's online protocol must be bumped. The recommended path is to keep DNA cosmetic and keep timing in the existing rating-driven simulation.

### 3.9 Where likeness pays off outside the match

- **Card portrait.** A head-and-shoulders pixel portrait at 3–4× scale, drawn from the same `Appearance`, so the card and the match player visibly match. Hoop Land also draws deceased players' sprites in black and white; we could use a sepia filter for "Legend" frames as a respectful option.
- **Pack walkout.** For a high-rated pull, the player's sprite runs in, stops, and performs his signature celebration over 1.5–2.0 s, with the rating then revealed. This reuses the celebration library and makes the moment unique to each card.
- **Name tag.** Show the ball handler's or receiver's name and number for 1.5 s after a possession change, with a setting to keep it on, as Hoop Land's toggles do.

---

## 4. Animation realism

### 4.1 How the big studios do it, and what we can borrow

| Technique | Who | What it buys | Our cheap equivalent |
|---|---|---|---|
| Studio mocap, full-team capture | FIFA 22 HyperMotion: 22 players, Xsens, 4,000+ animations, an ML model on 8.7M frames ([Xsens](https://www.xsens.com/resources/blog/fifa-22-motion-capture)) | Natural team movement, duels | We already play CMU mocap. Add a few clips for missing actions (§5). |
| Footage or volumetric capture | 2K ProPLAY (game footage) and FC HyperMotionV (180 matches); AI Mimic for 1,847 athletes | Per-player motion likeness at scale | Parametric **motion DNA** (§3.8) from ratings and size, plus curated overrides |
| Motion matching | Ubisoft, For Honor (Clavet, GDC 2016): each frame, search the mocap for the best pose plus future trajectory, with a small blend ([GDC Vault](https://www.gdcvault.com/play/1023280/Motion-Matching-and-The-Road)) | Seamless starts, stops and turns | Choose a gait by speed, plant/cut clips on direction changes over 90°, and 4–6 frame pose blends via `blend()` |
| Physics reactions | Madden BOOM Tech: weight, speed, momentum and ratings decide tackle outcomes; Madden 26 extends physics to catch tackles, stiff arms and trucks ([mut.gg](https://mut.gg/news/madden-nfl-25-gameplay-deep-dive), [EA](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive)) | Contact that looks caused | Choose the reaction clip and knockback by mass × closing speed (`heaviness` exists) |
| Anti-sliding foot planting | 2K26 "lower-body pose matching" ([Hoopsgamers](https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more)) | No skating | Stance-foot anchoring plus speed-matched playback (rules R3–R4) |
| Animation gated by rating | FC 26 stand tackles (<71 basic, 71–84 most, 85+ all); 2K faster motion styles need ratings | Stars look better | Gate variants by rating tier (rule R12) |
| Wind-up as risk | FC Mobile Power Shot longer wind-up "leaves the player open to being tackled"; FC 26 "minimal wind-up" close range | Anticipation becomes a choice | Shot and pass wind-up length scale with power (§4.6) |

Daniel Holden's analysis of displacement ([theorangeduck.com](https://theorangeduck.com/page/code-vs-data-driven-displacement)) explains the core tension:

- Syncing the character to the simulation gives "foot sliding or sudden spinning".
- Syncing the simulation to the character gives "grounded and weighty, but often sluggish".
- His fix is to adjust the character toward the simulation with a damper, limited to a ratio of the character's own velocity (0.5 in his example). This cuts sliding when standing or doing plant-and-turns.
- Rotation should adjust more slowly than position.
- Mocap was sped up about 10% for responsiveness.
- A procedural head look-at toward the travel direction increases perceived responsiveness.
- Foot locking with IK is the "last resort".

Our game positions are code-driven (the simulation owns them), so the version that fits is anchoring the *sprite* to the planted foot at pixel scale (R4).

### 4.2 How great 2D and pixel games fake it, with the numbers

**Responsiveness against anticipation**

- The game-animation tension: designers want little anticipation, animators want more. Too much "removes agency from the player". Enemy telegraphs should be longer. Animators should be able to mark the frame where the player regains control ([GAME ANIM excerpt](https://www.gameanim.com/2019/05/15/the-12-principles-of-animation-in-video-games/)).
- **0.1 s is the limit for feeling instantaneous** ([Nielsen Norman Group](https://www.nngroup.com/articles/response-times-3-important-limits/)). Rule: a player's button press must produce visible motion within 6 frames at 60 Hz.

**The twelve principles in practice** ([Wikipedia](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation))

- Squash and stretch keep volume constant. At pixel scale that means 1 px shorter goes with 1 px wider, or simply compressing the legs.
- Slow in and slow out: more frames near the extremes.
- Arcs, overlapping action, and "drag" (parts lag a few frames).
- Secondary action, exaggeration.

**Frame counts and timing from pixel artists (SLYNYRD)**

- **Run:** an 8-frame run at **80 ms** per pose. Cut to 6 frames by dropping the recoil (6 "work well in most cases"), or to 4 frames by dropping the high point, played at **160 ms** to keep the energy. "Too many in-betweens can make motion look sluggish" ([Pixelblog 8](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation)).
- **Top-down run** (6 frames): the head bob moves **−1, −1, +2 px** per stride, and the rise is faster than the fall. Use variable bounce, not a sine wave. Hair shifts on frames 2 and 4 only. Keep limb thickness consistent: "at this size, one pixel matters" ([Pixelblog 55](https://www.slynyrd.com/blog/2025/3/24/pixelblog-55-top-down-character-animation)).
- **Walk:** 8 frames is "optimum", with 6 and 4 as cut-downs. The key poses are contact (lowest), down, pass (tallest) and swing. Head height should follow a **triangle wave**, since a pure sine "feels unnatural" ([Pixelblog 50](https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle)).
- **Idle stance:** 8 frames, **frames 1–4 at 100 ms, 5–8 at 50 ms**. Moves are 1 px for the body and 2–4 px for the hands, with heel lifts and knee bends shifting the weight ([Pixelblog 52](https://www.slynyrd.com/blog/2024/9/26/pixelblog-52-idle-fighting-stance)).
- **Attacks:**
  - A jab has 5 frames: Smear, Hit, Follow Through, Recover, Overshoot. A cross has 7: Load, Pull, Smear, Hit, Follow Through, Recover, Overshoot.
  - The hit frame is held slightly longer.
  - **Overshoot is 1 px back for 1 frame.**
  - Wind-up "adds input delay", so heavy moves belong at the end of combos ([Pixelblog 53](https://www.slynyrd.com/blog/2024/11/25/pixelblog-53-punches-and-kicks)).
  - "Usually a single smear frame can get the job done."
  - Hold anticipation, and on strong hits the impact, for "a few extra frames".
  - Hold the follow-through slightly longer to suggest weight.
  - Elongate the limb by about 1 px at full extension ([Pixelblog 9](https://www.slynyrd.com/blog/2018/9/8/pixelblog-9-melee-attacks)).
- **Small sprites:**
  - Every frame should shift **at least one pixel**.
  - 1–2 px shifts can sell a head turn ([Pixelblog 47](https://www.slynyrd.com/blog/2023/11/26/pixelblog-47-tiny-pixels)).
  - "A single orphan or misplaced pixel in a loop is obvious" ([Pixelblog 8](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation)).

**3D rendered down to pixels (our exact pipeline)**

- Dead Cells renders 3D models, about **50 px** tall in game, at small size with no anti-aliasing.
- Animators key poses first and add interpolation later; attacks are pose-to-pose, and VFX carry much of the impact.
- **Flickering pixels remained an unsolved problem** ([Game Developer](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)).
- Arc System Works' Guilty Gear Xrd talk covers keeping "old-school 2D charms" in 3D ([GDC Vault](https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The)). The widely reported technique is stepped, held keys instead of smooth interpolation **[mem]**.

**Hit-stop**

- The game freezes both characters at the point of contact, so the eye registers the hit and it feels like force.
- **Street Fighter 2 used about 10 frames** ([critpoints](https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/)).
- Smash Ultimate: `(damage × 0.65 + 6)` frames, so **15 frames for a 15% hit**, capped at 30. Melee gave 8 frames for the same hit. Victims shake during hitlag, horizontally on the ground and vertically in the air ([SmashWiki](https://www.ssbwiki.com/Hitlag)).
- Sports keep the ball live and many bodies moving, so use about ⅓–½ of fighting-game values (table in §4.8).

**Screen shake and juice**

- Our `juice.ts` already follows Eiserloh's trauma² noise shake (GDC 2016, [Vault](https://www.gdcvault.com/play/1023557/Math-for-Game-Programmers-Juicing)) and Vlambeer.
- "Juice It or Lose It" (GDC Europe 2012) is the canonical demonstration: particles, tweening and feedback layered on a dull game ([Vault](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose)).

### 4.3 Engine rules for our renderer (apply to every sport) [design, grounded in the sources above]

- **R1, event-locked contact.** Every contact event (release, catch, kick contact, tackle impact, block touch) happens on the game-decided frame, and the ball's state changes on that exact frame. Only anticipation and recovery are warped (`warp()` already supports this). A 1-frame desync reads as a "ghost kick" (soccer sibling report).
- **R2, stepped sampling with key holds.**
  - Keep sampling poses at 30 fps (every second frame at 60 Hz), as `frameAt` does now.
  - Add **holds** on key poses: set point 3 f, apex 2–4 f, contact 2 f, follow-through 12–24 f. These are where the eye reads the action.
  - Do not interpolate between cached frames. Smooth sub-frame motion makes pixel joints shimmer (Dead Cells' flicker problem).
- **R3, speed-matched gait.** Gait playback rate = ground speed ÷ the clip's recorded root speed, clamped to 0.8–1.25×. Outside that range, switch clip: walk, jog (0.8 s cycle), run (0.65 s) or sprint (0.717 s). This matches FC 26's "animation selection matches current speed".
- **R4, stance-foot anchoring (anti-skate at pixel scale).**
  - While a foot is in contact (the clip beats `stepL` and `stepR` are already tagged), compute the sprite's screen x/y from the **planted foot** projected to the ground, not from the pelvis.
  - Let the simulation position lead and pull the sprite toward it with Holden's ratio-limited damper (≤ 0.5 of the gait's own velocity).
  - Re-anchor at each foot strike. The planted foot then never drifts sub-pixel, which removes the 1 px shimmer that reads as skating.
- **R5, turns.**
  - A direction change under 45° rotates through the intermediate facings at 1 frame each (8 or 16 facings already exist).
  - From 45° to 120°, play a plant frame (the `cut` clip: plant at 0.55 s, warped to 0.15 s) with a 1 px dip.
  - Over 120°, decelerate first with 2–3 shuffle steps, then plant (soccer sibling report).
  - Add a procedural head look 1 frame ahead into the new direction (Holden).
- **R6, lean.** Lean up to 12° into acceleration and 8° into turns (soccer sibling report). Sprint lean scales with speed rating (`sprintLean` exists). On hard braking, lean back 6° for 4–6 f, with a 1 px squash and dust.
- **R7, squash and stretch in 1 px units.**
  - Takeoff frame: stretch +1 px (+2 px at ≥48 px).
  - Landing: squash −1 to −2 px for 3–6 f, legs compressed and the body slightly wider.
  - The ball squashes 1 px for 1 frame on hard bounces and kicks.
- **R8, smears.** One smear frame on fast swings (windmill dunk, spin moves, a kicking leg at contact −1, a QB arm at release −1, a keeper's flight start): draw the limb in 2 positions joined by a 1 px streak of its colour with a gradation.
- **R9, overshoot and settle.** After any big recovery (landing, plant, catch tuck), shift the whole body 1 px past rest for 1 frame, then settle.
- **R10, secondary motion.**
  - Long hair, locs, ponytail, towel and loose jersey hem lag the head or pelvis by 1–2 frames, and shift only on frames 2 and 4 of a cycle (SLYNYRD 55).
  - Shorts and jersey flutter 1 px on alternate sprint frames.
  - NFL: the towel swings ±1 px.
  - Soccer: the captain's armband stays rigid.
- **R11, reaction priority.** Contact reactions are chosen by **mass × closing speed** plus ratings (BOOM idea). A light hit gives a 6–10 f flinch and a stumble; a heavy one gives `fall_back` or `fall_forward`. Reaction start lags the impact by 0 frames (on contact), but the get-up has a minimum lie time (0.4 s light, 1.0 s heavy).
- **R12, variety gated by rating.** 1–2 variants per action for base cards and 3–4 for 85+ or Tier A cards, as FC 26 gates stand tackles (<71 / 71–84 / 85+). A variant never changes outcome probabilities.
- **R13, control return.** Each action declares `controlAt`: the frame where input is accepted again. The follow-through can continue under new input by blending out over 4 frames.
- **R14, reduced motion.** No shake or zoom punch, hit-stop ≤ 30 ms (as now), no auto slow-motion. Holds and smears stay, since they are not vestibular triggers.

### 4.4 Basketball frame plans (60 Hz frames "f"; pixel deltas for a ~40 px sprite, scale with px)

Real-world anchors:

- Curry releases "in under half a second upon jumping" ([Wikipedia: Stephen Curry](https://en.wikipedia.org/wiki/Stephen_Curry)).
- Our CMU jumper releases 0.6 s after the gather begins, with 0.45 s of airtime.
- Airtime = 2√(2h/g): a 0.3 m jumper hop gives about 0.49 s, and a 0.9 m dunk jump about 0.86 s.
- A jumper spends **71% of its airtime in the top half of its height** (√½). This is why "hang time" looks real, and why holding the apex works.

**Dribble (loop)**

| Speed | Bounce period | Notes |
|---|---|---|
| Stand | 30 f (0.50 s) | |
| Jog | 26 f | |
| Run | 22 f | |
| Sprint | 20 f, ball pushed 0.5–1.0 m ahead | |

[design] Each period breaks down as:

- push 2 f (wrist snap down, hand 1 px lower);
- ball descends 40% of the period, faster than it rises (push plus gravity);
- floor contact 1 f with a 1 px ball squash and a squeak sound;
- ball rises 50% of the period, the hand meeting it over the last 25%, rising with it (hand follows ball).

Use the `dribble` clip's bounce beats as phase. Basketballs are 75 cm and 580–620 g ([Wikipedia](https://en.wikipedia.org/wiki/Basketball_(ball))). Dribble styles: low-quick (ball at 0.35 of the player's height, period −15%), upright (0.45), hesi (stalls the ball 2 f at the top).

**Crossover (total about 20 f, 0.33 s; the `crossover` clip, cross at 0.4, warped from 1.0 s)**

| Phase | f | Pose and pixels | Event / juice |
|---|---|---|---|
| Plant outside foot | 5 | Lean 8° away from the new direction; hips drop 1 px | — |
| Ball across | 6 | Ball below the knee, crossing the midline; 1 bounce at the centre | Ball contact frame = R1 |
| Receive | 3 | Other hand cups; shoulders turn 1 facing | — |
| Push-off | 6 | Lean 12° toward the new direction, first step long; jersey flutter | Defender reaction: late by 4–6 f; if beaten badly, `slip` with 50 ms hit-stop when he lands |

Control returns at frame 14.

**Step-back (about 34 f to release)**

- Gather dribble: 6 f.
- Plant lead foot: 4 f (brake, lean back 6°).
- Hop back: 10 f. Both feet leave the floor, 0.6–0.9 m back, with a 1 px stretch.
- Land: 4 f, 1 px squash.
- Then the jumper from **"set" with the dip shortened to 4 f**. The landing *is* the dip, which is the read 2K players learn.

**Spin move (about 26 f)**

- Plant pivot foot: 4 f, with the foot anchor locked (R4).
- Rotate 360°: 14–16 f. Each facing gets 1 f at 16 facings (2 f at 8). Use **one smear frame at the back-facing**. The ball pulls to the hip and switches hands at 180°.
- Push out: 6 f with a lean of 10°.

**Jump shot (typical: gather to release 32 f, 0.53 s; total to recovery about 70 f)**

| Phase | f | Pose and pixels | Event / juice |
|---|---|---|---|
| Gather | 10 | Ball to the shot pocket; feet square, toes toward the rim | Press frame = gather starts (R13 ≤ 6 f rule) |
| Dip | 7 | Hips −2 px, knees bend, elbow tucks | — |
| Rise | 10 | Legs extend; +1 px stretch at takeoff; ball climbs to the set point | Takeoff |
| Set point hold | 4 (DNA two-motion: 6; one-motion: 2) | Ball above the forehead (DNA set: chin / forehead / above head) | The readable "signature" frame |
| Release | 1 | Wrist flick; ball spawns at `sprite.handR` | Release (R1); on a perfect release 40 ms hit-stop + ring flash (exists) |
| Follow-through | 12 / 18 / 24 (DNA hold) | Shooting arm held high, wrist down ("gooseneck"); body drifts if fade | Ball spin: visible seam rotation 2–3 cycles per s |
| Land | 6 | −1 px squash, knees bend | Squeak |
| Recover | 8 | Into backpedal or idle | Control from land +2 f |

Variants:

- Shot speed DNA warps the gather, dip and rise ±15% only.
- A rushed or early release shortens the set to 1 f and the follow-through to 8 f, the visual of a rushed shot (2K26 shows exactly this).
- Lefties mirror the clip (the `_l` mirror exists).

**Layup (about 40 f gather to release; our warp takes off at 0.26 s and releases at 0.57 s)**

| Phase | f | Notes |
|---|---|---|
| Gather step | 12 | Long stride, ball to the outside hip |
| Plant step | 9 | Brake, 1 px dip |
| Rise (one foot) | 18 | Knee drives up, 1 px stretch |
| Release | 1 | At the apex, arm fully extended |
| Hang and drift | 8 | |
| Land | 6 | |

Variants by DNA:

- **Finger roll:** wrist rolls.
- **Reverse:** the body passes the rim and releases facing away (rotate 4 facings during the rise).
- **Euro:** the plant step goes lateral, 0.8 m, with a lean.
- **Floater:** release 6 f before the apex, high arc.

**Dunk (approach to land about 75–95 f)**

| Phase | f | Pose and pixels | Event / juice |
|---|---|---|---|
| Approach 2 steps | 20 | | |
| Load | 6 | Deep squash −2 to −3 px; arms swing back | |
| Rise | 22 | Stretch +2 px; ball wound up per style. Tomahawk: ball behind the head at contact −6 f. Windmill: arm circle with **1–2 smear frames**. Hang: legs tucked | |
| Apex hold | 3 | | |
| Slam | 1 | Ball snaps through | Hit-stop 70 ms (dunk), 90–120 ms + 0.5× slow-mo for 300 ms on a **posterizer**; trauma 0.35 / 0.6; zoom punch 3% (exists) |
| Rim | 3 + 2 | Rim bends 2 px down for 3 f, springs 1 px up for 2 f (overshoot); net whips 2 f | Backboard shake 1 px, 4 f |
| Hang on rim | 12–30 | Legs swing 1 px | Crowd reacts at +6 to 12 f |
| Drop and land | 10 + 6 | Squash −2 px | Defender `fall_back` if posterized |

**Block**

- **Defender jump:** the `jump` clip's dip→takeoff (0.26 s) is warped down to **0.12 s** (7 f) for reactive blocks. AI telegraphs can stay longer.
- **Contact:**
  - 1 f with a swat-arm smear;
  - the ball's velocity reflects with an outward bias, and the ball spins fast (2-frame seam cycle);
  - hit-stop 60 ms (exists), trauma 0.25, and a kick of 2 px along the ball's new direction;
  - the shooter flinches 4 f.
- **Chase-down variant:** one-arm, body angled 20°, contact pins the ball to the glass: 1 px backboard shake, hit-stop 80 ms.

**Rebound**

- **Box-out:** wide base (`widen()`), arms out, for 0.2–0.5 s.
- **Jump:** two-foot, timed to the ball's last rim bounce (2K26 teaches this moment).
- **Secure:** hands high at the apex; the ball snaps in for 1 f.
- **"Chin it":** 8 f with elbows out 1 px.
- **Land:** squash.
- A tip-in is a one-hand flick at the apex with no secure frame.

### 4.5 Football frame plans

Real-world anchors:

- League average time to throw is **2.81 s (2024) and 2.86 s (2025)** (PFF via sibling report: [PFF](https://www.pff.com/news/nfl-quarterbacks-are-holding-the-ball-longer-than-ever-the-trends-behind-time-to-throw/)).
- Average pressure arrives at **2.9 s** ([NFL NGS](https://www.nfl.com/news/next-gen-stats-introduction-to-pressure-probability)).
- Our engine already uses about 2.9 s (ARCADE-V2).

**QB drop (from snap) [design]**

- **Snap catch:** 6 f.
- **3-step:** 3 × 14 f, then a hitch of 10 f. The ball can come out at about 1.0 s.
- **5-step:** 5 × 12 f, then a 12 f hitch, about 1.35 s.
- **7-step:** 7 × 11 f, then a 14 f hitch, about 1.7 s.
- **Shotgun:** a 2–3 step settle.
- Use the `backpedal` clip played faster, with the eyes and head facing downfield: procedural look at the first read.
- Shorter QBs sink 1 px lower in the pocket. Madden's Field Vision ties height to sightlines; ours is a visual only.

**QB throw (cock to release 18 f, 0.30 s; the `throw` clip warped so release lands at game time)**

| Phase | f | Pose and pixels | Event / juice |
|---|---|---|---|
| Cock | 6 | Ball to the ear (DNA hold: two-hand high / one-hand low first); off-arm points at the target | Press = cock starts |
| Stride | 8 | Front foot lifts and plants toward the target; the foot anchor locks | — |
| Rotate | 4 | Hips, then shoulders (2 + 2) | — |
| Release | 1 | Arm at its slot: over (15° from vertical), high ¾ (35°), low ¾ (55°); 1 smear frame at release −1 | Release (R1); lob vs bullet changes only the arc |
| Follow-through | 12 | Hand finishes at the opposite hip; back foot drags 1–2 px | Ball: tight spiral = 2-frame lace flicker; inaccurate = nose wobble ±15° at about 6 Hz |
| Recover | 8 | | Control at +4 f |

Variants:

- Quick-release DNA gives 15 f cock to release; a long wind-up gives 22 f.
- **Pump fake:** cock 6 f, forward 4 f, back 4 f.
- **On the run:** skip the stride, rotate 3 f, release with the shoulders open.
- **Lefties:** mirror.

**Catches**

| Type | Frames | Notes |
|---|---|---|
| Possession / chest | hands up 4 f **before** arrival (the readable cue), catch 1 f (ball snaps), absorb 4 f (arms in, −1 px squash), tuck 6 f to the outside arm | `catch` clip: event at 0.358 s |
| High-point | jump 8 f, arms fully extended at the apex (+1 px stretch), catch 1 f, land 6 f | Contested: hit-stop 40 ms |
| Diving | launch 4 f, flight 12–16 f horizontal, arms out, catch in the air, chest landing 1 f, slide 8 f with turf particles | Trauma 0.15 on landing; `dive` clip |
| One-handed | Trait- or rating-gated (R12); reach 4 f, 1-hand catch | Hit-stop 60 ms + 0.5× slow-mo for 250 ms |
| Sideline toe-tap | Catch, then both feet drag 2 steps (8 f) with the toes pointed | Line flash if in bounds |
| Drop / bobble | Ball pops 0.3–0.6 m and falls, 1 bounce; hands flail 6 f | Crowd groan |

**Ball carrier**

| Move | Frames | Notes |
|---|---|---|
| Juke | plant 4 f (outside foot, lean away 15°), cut 4 f (lateral 0.8–1.2 m), burst 6 f | Defender bites: lunges 6 f the wrong way, then `stumble`. Retro Bowl's dodge-then-tackler-crash is what reviewers loved |
| Spin | plant 3 f, rotate 12–14 f (smear at 180°), out 5 f | Ball switches to the arm away from the tackler at 180° |
| Truck | lower shoulder 4 f (body −2 px), contact 1 f | Hit-stop 90 ms (exists), trauma 0.4, kick 3 px along the carrier's path; defender `fall_back`; carrier stumbles 8 f at −30% speed for 0.4 s |
| Stiff arm | extend 4 f (the `stiff_arm` extend 0.225 s warped to 0.07 s), hold 8–12 f, retract 4 f | Defender's head snaps back 1 px; he slows or falls |
| Hurdle | takeoff 4 f, knees tucked 12 f, land 6 f | Speed-gated, as in Retro Bowl where fast players hurdle more |
| Dive or reach for yards | takeoff 4 f, flight 10–14 f with the ball extended in front, land 1 f, skid 8 f | Madden 26 "reach for the sticks" risk: fumble chance if hit during the reach |

**Tackles**

| Type | Frames | Juice |
|---|---|---|
| Wrap | close 6 f (low, arms open), contact 1 f, drive 8–12 f (both bodies along the tackler's vector), fall 20–30 f (`fall_forward` impact 0.675 s) | Hit-stop 33–40 ms, trauma 0.15 |
| Big hit | wind-up 4 f (shoulder load), launch 4 f, contact 1 f | Hit-stop 80–100 ms (`bighit` 80), trauma 0.5, kick 4 px; carrier `fall_back`; fumble pop: ball pops with a 2-frame spin |
| Ankle / dive | `dive` clip: takeoff, then a trip; the carrier's `stumble`, then a fall | Hit-stop 33 ms |
| Gang tackle | A second tackler arrives within 0.3 s, so the pile moves at the summed vector | Pile shuffles 1 px |

Get-ups: 0.6–1.2 s using `getup` or `getup_front` (play the clip at 1.5–2× and skip its first 40%).

### 4.6 Soccer frame plans

Real-world anchors:

- A size-5 ball is 68–70 cm and 410–450 g ([Wikipedia](https://en.wikipedia.org/wiki/Ball_(association_football))).
- An 11 m penalty at 25–30 m/s reaches the goal in **0.37–0.44 s**, so keepers "will usually start their dive before the ball is actually struck" ([Wikipedia: Penalty kick](https://en.wikipedia.org/wiki/Penalty_kick_(association_football))).
- League penalty conversion is 74–80% (same page).

**Run**

- Use the jog (0.8 s cycle), run (0.65 s) and sprint (0.717 s) clips with R3 rate matching and R4 anchoring.
- Head bob −1, −1, +2 px per stride.
- Run DNA:
  - **upright:** lean −2°;
  - **low:** lean +4°, knee lift −1 px;
  - **long:** stride +10%, cadence −8%;
  - **choppy:** stride −10%, cadence +10%;
  - **glide:** bob halved.

**Dribble touch**

- **Touch rhythm:** every 2 strides at jog (ball 0.6–1.0 m ahead), every 3–4 at run, and every 5–6 on a knock-on sprint (ball 3–5 m ahead).
- **A touch:** 1 contact frame, using the outside or inside of the foot by the turn side (sole for stops). The ball impulse fires on that exact frame (R1).
- **Turns over 60°:** an effort touch (FC 26) with 2 shuffle steps of 4 f each and a 1 px dip.
- **Failed trap:** a heavy-touch pose, the ball bouncing 2–3 m away (soccer sibling report).

**Pass, and the shot table** (soccer sibling report: anticipation scales with power)

| Kick | Approach / plant | Backlift | Contact | Follow-through | Juice |
|---|---|---|---|---|---|
| Short pass | plant 4 f | 6–8 f | 1 f | 8–10 f | — |
| Driven / long pass | plant 6 f | 10 f | 1 f | 12 f | — |
| Placed shot | plant 6 f, foot anchor locked | 10–14 f | 1 f | 12–16 f | — |
| Power shot | **longer last stride** 8 f | 18–24 f (an interruptible risk window, as in FC Mobile) | 1 f + **2 f hit-stop** | 16–20 f, hop onto the kicking foot | Trauma 0.2; 1 px ball squash; motion trail 3 f |
| Close-range snap | plant 3 f | 4–6 f ("minimal wind-up", FC 26) | 1 f | 8 f | — |
| Volley / scissor | jump 8 f | leg cock 6 f | 1 f | 10 f + fall | Trait-gated (R12) |

Ball flight cues:

- **Finesse:** visible side-spin, 2-frame panel rotation, with a lateral curl.
- **Knuckle:** a 1 px wobble.
- The `kick` clip's plant at 0.75 s and contact at 0.975 s set the ratio; warp the backlift by power.

**Header**

| Phase | f | Notes |
|---|---|---|
| Load | 6 | One-foot running or two-foot standing |
| Rise | 10 | +1 px stretch |
| Neck cock | 3 | Anticipation: head back 1 px |
| Contact | 1 | Head snaps forward 2 px; 33 ms hit-stop on power headers |
| Follow-through | 6 | |
| Land | 6 | |

Defensive headers have the head angled up; attacking headers angle the head down.

**Slide tackle**

- **Drop:** 4–6 f, lean back, plant.
- **Slide:** 20–24 f (0.35–0.4 s, 2–3 m, decelerating). The leading leg is extended, with turf particles and a **turf mark that persists 8–10 s** (Pixel Cup Soccer).
- **Contact:** ball first means the ball deflects (33 ms hit-stop); man first means the man's `stumble` or `fall_forward` and a whistle.
- **Get-up:** 24–30 f. This is a vulnerable window, which is the real cost of sliding.

**Goalkeeper**

- **Set:** a split-step hop of 4 f when the shooter's backlift begins (soccer sibling report).
- **Dive:**
  - push off the near leg 4–6 f;
  - flight 12–18 f, body horizontal, arms extended, +1 px stretch, smear on the first flight frame;
  - three heights (low-ground, mid, high-tip) by crossing height;
  - contact 1 f: a catch snaps the ball into the hands; a parry deflects it wide (FC 26 steers parries to safer areas);
  - **hit-stop 50 ms (3 f) on a big save**, trauma 0.2;
  - land 6 f with dust, then a get-up of 1.0 s (60 f), so rebounds feel earned.
- **Smother** on 1v1s: 8 f, low and wide.
- **Reach:** an 11 m shot arrives in about 0.4 s, so the keeper must commit on the backlift or about 0.25 s before contact to reach the corners, as real keepers do.

**Celebrations:** see §4.7.

### 4.7 Celebrations and crowd

- **Library [design].** 10–12 generic, original loops of 1.2–2.5 s, skippable after 0.5 s:
  - arms-wide run;
  - knee slide (soccer, dust trail);
  - fist pump;
  - jump-spin landing;
  - chest thump;
  - point to the sky;
  - "too small" shrug;
  - flex;
  - team huddle (teammates run in: Hoop Land's top celebration complaint);
  - finger-wag (block);
  - salute;
  - backflip for high-agility cards only.
- **Assignment.** By position archetype and context: game-winner, dunk, TD, goal, block. Madden places its 20 solo celebrations across 9 hot spots, so ours should be spot-aware (corner flag, end zone, baseline). Tier A players get one signature celebration from the library.
- **Naming.** Use generic names, never a player's trademarked gesture name. FIFA 18 shows how much star celebrations matter to fans; we capture the *kind* of gesture, not the copyrighted presentation.
- **Crowd.**
  - Recolour crowd sprites from the same skin and hair palettes (fixes Hoop Land's "same hairstyles").
  - Use a 3-frame cheer loop triggered by region with a random 6–12 f delay, so it ripples.
  - Stand-ups on big plays, and 1-frame flash-bulb sparkles on dunks, TDs and goals.
  - A hush with fewer moving sprites on misses.
  - Crowd motion follows reduced motion: bob only, no sparkle flashes.

### 4.8 Juice table (hit-stop and trauma), extending `juice.ts` HITSTOP

Fighting games run 8–15 f for a mid hit (SF2 ~10 f; Smash Ultimate 15 f at 15%). Sports keep about a third to half of that, because the ball and other bodies keep moving. Values marked "exists" are already in `juice.ts`.

| Moment | Hit-stop ms (f @60) | Trauma | Other |
|---|---|---|---|
| Perfect release (green) | 40 (2–3) (exists) | 0 | Ring flash |
| Block | 60 (exists) to 80 (chase-down) | 0.25 | Kick 2 px along the ball |
| Dunk | 70 (exists) | 0.35 | Zoom 3%, rim spring |
| Posterizer | 90 (exists) to 120 | 0.6 | 0.5× slow-mo for 300 ms |
| Ankle-breaker (defender lands) | 50 | 0.15 | — |
| Wrap tackle | 33–40 | 0.15 | — |
| Big hit | 80 (exists) to 100 | 0.5 | Kick 4 px |
| Truck | 90 (exists) | 0.4 | Kick 3 px |
| Interception | 50 (exists) | 0.2 | — |
| Spectacular catch | 60 | 0.1 | 0.5× slow-mo for 250 ms |
| Power shot or power header strike | 33 (2) | 0.2 | Ball trail |
| Goal | 66 (4) | 0.3 | Net bulge 3 f |
| Big save | 50 (3) | 0.2 | — |
| Woodwork | 33 | 0.25 | Post vibrates 1 px for 4 f |

Cap total hit-stop per second at about 150 ms so chains of events don't stutter [design].

---

## 5. Implementation order, tests and constraints

1. **P1, appearance foundation (render-only).**
   - Add `appearance.ts`: types, palettes, LOD and head scale.
   - Add `defaultLook(player, season)`, which replaces `hairFor` and `beardFor` while keeping today's visuals for anyone uncurated.
   - Add drawing for the 18 hair styles, 8 facial styles, head gear, limb gear, socks and shoes in `body.ts`, with an appearance hash in the sprite cache key.
   - Add a gallery page showing every trait × LOD × facing × kit.
2. **P2, curated data.**
   - YAML, a build script, a loader and validation tests.
   - Tier A for all three sports (about 450 players), with era overrides for long careers.
3. **P3, motion DNA.**
   - Shot form, dribble style, dunk set, QB slot and hold, run style, celebrations, all as pose modifiers and warp keys on the existing clips.
   - Verify with the `juice.test.ts`-style determinism test that simulation output is identical.
4. **P4, animation rules R1–R14.**
   - Foot anchoring, speed-matched gait, holds, smears, overshoot, secondary motion, the reaction table, crowd, and the juice table.
   - Fill hand-keyed gaps listed in ARCADE-V2.md: step-back, spin, rebound secure, slide tackle, keeper dive heights, header.
   - CMU has more clips if needed: jumps, falls, kicks.
5. **P5, likeness outside the match.** Card pixel portraits, the pack walkout with signature celebration, and the name tag. Then Tier B curation in batches.

**Constraints checklist (BRIEF):**

- Render-only, so no protocol bump; bump only if DNA ever touches simulation.
- No new heavy dependencies or raster images; all drawing stays in code and the data file is about 20 KB gzipped.
- Respect reduced motion.
- No brand names, logos or tattoos.
- No writes to the live registry during QA.
- Saves untouched; user look overrides are a new optional key.

---

## 6. Sources (fetched this session unless noted)

**Console and PC**
- NBA 2K series: https://en.wikipedia.org/wiki/NBA_2K
- NBA 2K15 face scan: https://en.wikipedia.org/wiki/NBA_2K15
- NBA 2K24 ProPLAY: https://en.wikipedia.org/wiki/NBA_2K24 · https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more
- NBA 2K25: https://en.wikipedia.org/wiki/NBA_2K25 · https://www.nba2klab.com/nba-2k25-gameplay-courtside-report
- NBA 2K26: https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more
- Madden 26 Gridiron Notes: https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-gameplay-deep-dive
- Madden 25: https://mut.gg/news/madden-nfl-25-gameplay-deep-dive · https://en.wikipedia.org/wiki/Madden_NFL_25_(2024_video_game)
- Madden 24 (SAPIEN): https://en.wikipedia.org/wiki/Madden_NFL_24
- Madden 27: https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-gameplay
- FIFA 18: https://en.wikipedia.org/wiki/FIFA_18
- FIFA 22: https://en.wikipedia.org/wiki/FIFA_22 · https://www.xsens.com/resources/blog/fifa-22-motion-capture
- FC 24: https://en.wikipedia.org/wiki/EA_Sports_FC_24
- FC 25: https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive
- FC 26: https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-gameplay-deep-dive
- FC 27: https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-gameplay-deep-dive
- College Football 25: https://en.wikipedia.org/wiki/EA_Sports_College_Football_25

**Mobile**
- FC Mobile: https://www.ea.com/games/ea-sports-fc/fc-mobile/news/fc-mobile-gameplay-deep-dive · https://en.wikipedia.org/wiki/EA_Sports_FC_Mobile
- NBA 2K Mobile: https://en.wikipedia.org/wiki/NBA_2K_Mobile
- Madden Mobile: https://en.wikipedia.org/wiki/Madden_NFL_Mobile · https://www.ea.com/en/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-how-to-play

**Pixel and arcade**
- NBA Jam: https://en.wikipedia.org/wiki/NBA_Jam_(1993_video_game) · https://en.wikipedia.org/wiki/NBA_Jam_Tournament_Edition · https://en.wikipedia.org/wiki/NBA_Jam_(2010_video_game)
- NFL Blitz: https://www.denofgeek.com/games/nfl-blitz-history-making-of-too-violent-retrospective-midway/
- Tecmo: https://en.wikipedia.org/wiki/Tecmo_Super_Bowl · https://en.wikipedia.org/wiki/Tecmo_Bowl
- Sensible Soccer: https://en.wikipedia.org/wiki/Sensible_Soccer · https://mitvblog.blogspot.com/2014/06/retrospective-sensible-soccer.html
- Retro Bowl: https://en.wikipedia.org/wiki/Retro_Bowl · https://ee.pocketgamer.com/articles/084147/retro-bowl-review-a-must-play-sports-game/ · https://mobilesyrup.com/2020/09/27/retro-bowl-football-game-review/ · https://retrobowl.gg/blog/retro-bowl-passing-guide/
- New Star Games (NFL Retro Bowl '27): https://www.newstargames.com
- Retro Goal: https://apps.apple.com/nz/app/retro-goal/id1535765855
- Hoop Land: https://apps.apple.com/us/app/hoop-land/id1605197976 · http://www.148apps.com/reviews/hoop-land-review/ · https://store.steampowered.com/app/2453660/Hoop_Land/
- Pixel Cup Soccer: https://www.148apps.com/reviews/pixel-cup-soccer-review/ · https://gertlushgaming.co.uk/pixel-cup-soccer-ultimate-edition-review-steam/
- Mario Strikers Charged: https://en.wikipedia.org/wiki/Mario_Strikers_Charged

**Animation craft and technique**
- Twelve basic principles of animation: https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- GAME ANIM excerpt: https://www.gameanim.com/2019/05/15/the-12-principles-of-animation-in-video-games/
- SLYNYRD Pixelblog 8: https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation
- SLYNYRD Pixelblog 9: https://www.slynyrd.com/blog/2018/9/8/pixelblog-9-melee-attacks
- SLYNYRD Pixelblog 25: https://www.slynyrd.com/blog/2020/1/23/pixelblog-25-motion-cycles
- SLYNYRD Pixelblog 40: https://www.slynyrd.com/blog/2022/9/25/pixelblog-40-3d-animation
- SLYNYRD Pixelblog 47: https://www.slynyrd.com/blog/2023/11/26/pixelblog-47-tiny-pixels
- SLYNYRD Pixelblog 50: https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle
- SLYNYRD Pixelblog 52: https://www.slynyrd.com/blog/2024/9/26/pixelblog-52-idle-fighting-stance
- SLYNYRD Pixelblog 53: https://www.slynyrd.com/blog/2024/11/25/pixelblog-53-punches-and-kicks
- SLYNYRD Pixelblog 55: https://www.slynyrd.com/blog/2025/3/24/pixelblog-55-top-down-character-animation
- Dead Cells 3D-to-2D pipeline: https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
- Guilty Gear Xrd art style (GDC 2015): https://www.gdcvault.com/play/1022031/GuiltyGearXrd-s-Art-Style-The
- Motion Matching (GDC 2016): https://www.gdcvault.com/play/1023280/Motion-Matching-and-The-Road
- Animation Bootcamp: indie procedural animation (GDC 2014): https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach
- Juicing Your Cameras With Math (GDC 2016): https://www.gdcvault.com/play/1023557/Math-for-Game-Programmers-Juicing
- Juice It or Lose It (GDC Europe 2012): https://www.gdcvault.com/play/1016487/Juice-It-or-Lose
- Code vs data-driven displacement: https://theorangeduck.com/page/code-vs-data-driven-displacement
- Hitstop: https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/
- Smash hitlag: https://www.ssbwiki.com/Hitlag
- Response-time limits: https://www.nngroup.com/articles/response-times-3-important-limits/

**Palettes, handedness and real-world reference**
- Monk Skin Tone Scale: https://en.wikipedia.org/wiki/Monk_Skin_Tone_Scale
- Fitzpatrick scale: https://en.wikipedia.org/wiki/Fitzpatrick_scale
- Left-handed quarterbacks: https://en.wikipedia.org/wiki/List_of_left-handed_quarterbacks
- Footedness: https://en.wikipedia.org/wiki/Footedness
- Stephen Curry (release speed): https://en.wikipedia.org/wiki/Stephen_Curry
- Basketball (ball): https://en.wikipedia.org/wiki/Basketball_(ball)
- Football (ball): https://en.wikipedia.org/wiki/Ball_(association_football)
- Penalty kick: https://en.wikipedia.org/wiki/Penalty_kick_(association_football)

**Via the sibling football research, not re-fetched here**
- PFF time to throw: https://www.pff.com/news/nfl-quarterbacks-are-holding-the-ball-longer-than-ever-the-trends-behind-time-to-throw/
- NFL Next Gen Stats pressure: https://www.nfl.com/news/next-gen-stats-introduction-to-pressure-probability

**Repo files read**
- `src/game/pixel/body.ts`, `style.ts`, `mocap.ts`
- `src/data/mocap/index.json`
- `src/game/juice.ts`, `src/game/sprites.ts`
- `src/game/hoops2/render.ts`

All in `/home/user/ps-studio`.
