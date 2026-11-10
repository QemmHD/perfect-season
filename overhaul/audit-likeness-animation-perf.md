# Audit: player likeness, animation system, loading and performance

Area: how players look (in the three match engines, on Ultimate Team cards and in menus), the animation pipeline (motion capture, hand-keyed poses, sprite cache, transitions), and loading and runtime performance (cold start, warm start, offline, Ultimate Team open, in-match frame time, memory, bundle).

Repo `/home/user/ps-studio`, branch `claude/studio-overhaul` (= main `acdf3e2`). Audit only: no tracked file was changed. Written 2026-11-09.

## How this was measured

- **Data:** `roster.ts` and `goats.ts` (vite-node on the real UT pool, `PS_SPORT=nba|nfl|soccer`).
- **Likeness renders** (dev server 5206): `lineup.cjs` draws real stars exactly as the app does (`CardArt.lookOf`/`portraitUrl`, `drawBody` on mocap at match sizes), in their own kits and in one shared kit; `silhouette.cjs` measures widths by build; `numbers.cjs` checks number legibility.
- **Animation:** `strips.cjs` renders actions as each renderer samples them and measures the pose jump at hard cuts; `spritestats.cjs`/`stalebypx.cjs` patch `SpriteCache` during autoplay to count hits, new drawings and **stale drawings** (a body shown last frame's sprite because the per-frame budget ran out); `soccer_slide.ts` classifies 776k soccer body-frames for foot sliding; `burst.cjs` captures 0.25× slow motion.
- **Performance:** production build (`vite build --outDir <scratch>/build`, 25 s) on `vite preview --port 5206`. `coldstart.cjs` (390×844 DPR 3, `isMobile`, `hasTouch`): cold visit at desktop CPU and at 4× CPU + "4G" (9 Mbps, 60 ms RTT), warm relaunch, **offline** relaunch, first UT open at 1× and 4×. `matchperf.cjs`: the shipped `?arcade&auto` bench at 390×844, 430×932 and 320×568, 1× and 4×. `heap.cjs`: CDP heap after GC.
- **Isolation and noise:** every run used `?ns=inspect&relay=ws://localhost:7777` with all non-localhost requests aborted (so Google Fonts were blocked; font cost is inferred from code). The machine was shared, so absolute times carry some noise; runs were sequential.

Scripts: `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/likeness/`. Screenshots: `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/likeness-perf/`. File names cited below are in that folder.

This audit complements the per-sport audits (`audit-nba.md`, `audit-nfl.md`, `audit-soccer.md`) and the research file `research-likeness-animation.md`. Where a sport audit already measured something (NBA foot sliding 29%, NFL QB drop skating, soccer's thin clip set), I cite it rather than repeat it. The new measurements here are mostly cross-cutting.

---

## Top findings

| # | Sev | Finding |
|---|---|---|
| L-1 | **Critical** | **Nobody looks like who he is.** Every player in every engine and on every card has the same skin tone (`#a8714f`) and the same hair colour. Hair style and beard come from a hash of the player id, which produces confidently wrong looks (bald Iverson, high-top Shaq, dark-haired Haaland, bearded Mbappé). |
| L-2 | High | **Weight barely shows.** Shaq (325 lb) and Manute Bol (200 lb) are drawn with the same 20 px torso at the same scale. Jokić (284 lb) and Giannis (243 lb) have identical outlines at 24 and 60 px and are within 1 px at 40 px. Soccer has no weight data at all, and the two places that invent it use different formulas. |
| L-3 | High | **No appearance dataset exists.** There is no skin, hair, facial hair, accessories, handedness, preferred foot, era look or kit pattern for any of the 19,938 UT players. Only height, weight and number exist. |
| L-4 | High | **Cards show one generic mannequin.** Every card draws the same 54 px standing figure in the same pose and angle. On the club grid that is about 52 CSS px with a head about 8 px across, so the card's hero art never tells you who the player is. Draft-mode cards show an SVG jersey with initials. |
| L-5 | Medium | **Jersey numbers can't carry identity.** Numbers vanish below about 26 px when the player is turned, scramble at 40 px (80 becomes a block, 88 a "B"), and use a fixed 4×7 font even on 80 px sprites. 26% of NFL cards and 7.7% of soccer cards have no number. |
| A-1 | **Critical (NFL), Medium (NBA)** | **The per-frame drawing budget starves the nearest players.** In NFL autoplay, 41% of all body draws are stale frames, rising to **81% for the biggest, nearest sprites (48–71 px)**. The cause: the budget of 4 new drawings per frame is spent in far-to-near draw order. NBA close-ups are stale 8.4% of the time. |
| A-2 | High | **No transitions.** Every clip or pose change is a hard cut. Measured pose jumps at common cuts are 22–60% of body height, against 11–18% for a normal frame-to-frame step. |
| A-3 | High | **Most signature actions are hand-keyed stick poses**, not mocap: dunks (including the "windmill", whose arm never circles), crossover, spin, pass, block and rebound, and the NFL juke, stiff arm and truck. 5 of the 26 recorded clips are never played: `dribble`, `crossover`, `cut`, `stiff_arm`, `getup_front`. |
| A-4 | High | **Everyone moves the same.** One jump shot, one throw, one kick (right foot only) and one celebration for every player in every sport. There is no handedness, signature form or motion DNA. |
| A-5 | Medium | **Low and uneven animation rates and feet that slide.** Clips play at 15 fps, idles at 10 fps, and everything under 22 px drops to 10 fps. Soccer feet slide on 12.8% of body-frames (NBA 29%, per the NBA audit). Facing snaps in 45° steps below 22–26 px. |
| P-1 | High | **Opening Ultimate Team is slow and heavy.** From the tap to the UT screen takes 2.1 s at desktop speed and **7.4 s (NBA) / 9.0 s (NFL)** at 4× CPU. That opening parses 4.2–6.3 MB of JS-encoded card data with long tasks up to 669 ms, and retains **+41–57 MB of heap** for the session. |
| P-2 | High | **Ultimate Team doesn't work offline unless it was opened online on this build.** All three sports show "The cards didn't load. TRY AGAIN". The install still precaches 3.2 MB of UT-only rating references that are useless without the cards. |
| P-3 | Medium | **Every launch pays a fixed splash of at least 1.15 s** (a 700 ms minimum spin plus a 450 ms fade), even fully cached. The UI also waits up to 2.2 s for Google Fonts behind a render-blocking third-party stylesheet. Offline relaunch took 3.9–4.0 s to Home in all three sports. |
| P-4 | Medium | **Matches are smooth on fast hardware but have little headroom.** At 4× CPU, NBA drops to 51.8–56.7 fps with p99 frame intervals of 33–50 ms and up to 62 frames over 20 ms in 10 s. NFL reaches its drawing cap every frame (231 new sprites/s). |
| P-5 | Low–Medium | **The bundle is large.** 116 assets, 22.6 MB raw / 6.35 MB gzip; the three card files are 2.9–3.7 MB of JS object literals each. Precache has grown to 11.5 MB from the 8.79 MB the performance doc records. |

---

## Part 1: Player appearance and likeness

### 1.1 How a player is drawn today, on every surface

There is one renderer for all players: `src/game/pixel/body.ts` `drawBody(look, pose|joints, view, px)`. It fills capsules for the limbs and torso into a small grid with a depth test, shades them in three tones from one light, and outlines them. Sprites are cached per pose key. What varies per player is the `Look`, defined at `body.ts:9-38`:

- height and weight in inches and pounds;
- jersey number;
- `hair` 0–5: short, buzz, high top, bald, headband, locs;
- `beard`;
- `skin` and `hairColor`;
- uniform colours: jersey, trim, shorts, socks, shoes;
- NFL helmet, stripe, mask, pants, pads and sleeves;
- soccer keeper gloves.

Each surface builds its `Look` as follows.

| Surface | Code | Skin | Hair / beard | Build | Number |
|---|---|---|---|---|---|
| NBA match | `hoops2/render.ts:61-77` | `DEFAULT_SKIN` | `hairFor(id)`, `beardFor(id)` (hash) | card ht/wt | yes |
| NFL match | `football2/render.ts:56-77` | `DEFAULT_SKIN` | `hair: 0` (under the helmet anyway) | ht/wt, pads ×1.25 for OL/DL | yes |
| Soccer match | `soccer2/render.ts:69-89` | `DEFAULT_SKIN` | hash | ht only; **wt = 23 × (ht m)² kg in lb**, so everyone has a BMI of 23 | yes, when known |
| UT cards (all sizes), Cup/Play art (`play-art.tsx:53` `PixelPlayer`) | `ut/CardArt.tsx:26-62`, `portraitUrl:70-98` | `DEFAULT_SKIN` | hash | ht/wt; soccer **wt = in × 2.35**, a different formula from the match | yes |
| Draft-mode trading cards | `ui/Card.tsx:68-125` | — | — | — | SVG jersey with the player's **initials** |
| Legacy v1 sprites (dead code) | `game/sprites.ts:1-8` | the comment says *"Everyone shares one skin tone… the games don't guess"* | — | — | — |

`body.ts:592-611` makes the policy explicit:

- `DEFAULT_SKIN = '#a8714f'` and `DEFAULT_HAIR = '#1d1612'`;
- `hairFor(id)` picks from `[0,0,0,1,1,2,3,4,5,0,1]` by a hash of the id;
- `beardFor(id)` gives a beard to one player in four by hash.

### 1.2 Appearance data that exists, per sport (measured)

| | NBA | NFL | Soccer |
|---|---|---|---|
| UT players / UT cards (all editions) | **3,587 / 22,082** | **7,343 / 32,242** | **9,008 / 30,352** |
| Draft-mode distinct players (team-era cells) | 4,506 (180 cells, 14,174 rows) | 4,970 (183 cells, 8,982 rows) | 6,748 (287 cells, 11,153 rows) |
| Height coverage (UT) | 100% | 98.7% | 98.9% (cm) |
| Weight coverage (UT) | 100% | 98.7% | **0%** |
| Cards missing a jersey number | 20 | **8,351 (26%)** | **2,352 (7.7%)** (Pelé, Maradona and Cruyff legends have none) |
| Height range p10–p90 (min–max) | 74–83 in (63–91) | 70–77 in (65–82) | 174–191 cm (159–206) |
| Weight range p10–p90 (min–max) | 180–250 lb (133–330) | 189–310 lb (156–390) | — |
| Skin tone, hair, facial hair, accessories | none | none | none |
| Handedness / preferred foot | none | none | none |
| Era-specific look (per season) | none: one ht/wt per player for the whole career (Shaq is 325 lb in 1993 and 2011) | none | none |
| Kit pattern (stripes, hoops, sashes) | n/a | n/a | none: shirts are flat `c1` (`soccer2/kits.ts:22-30`) |
| GOAT / Legend players | 20 / 120 | 20 / 130 | 0 / 132 |

**Stars (the cards players chase and see most):**

- **NBA GOATs:** Jordan, Kareem, Wilt, LeBron, Duncan, Kobe, Magic, Hakeem, Oscar, Bird, Garnett, Russell, Giannis, Curry, Shaq, West, Durant, Dirk, Pippen and Wade.
  - Most editions: LeBron 39, Kareem 35, Kobe 33, then Malone, Shaq, Duncan and Garnett with 31–32 each.
- **NFL GOATs:** Peyton Manning, Rice, Brady, Barry Sanders, L. Taylor, R. White, A. Donald, B. Smith, R. Lewis, Brees, Payton, Ed Reed, E. Smith, Montana, Gonzalez, Mahomes, Deion, Lott, Moss and Gronkowski.
  - Most editions: Rice 31, Bruce Smith 30, Brady and Brees 29 each.
- **Soccer top overalls (97):** Suárez, Messi, Benzema, Cristiano Ronaldo, Lewandowski, De Bruyne, Kane, Salah, Rodri, Haaland, Pelé and Maradona.
  - Most editions: Lewandowski 25, then Messi and De Bruyne 21 each, Ronaldo 19, Kane and Mbappé 18 each.

A curated "Tier A" look table of GOATs, Legends and the top 60 by overall comes to about **150–200 players per sport**. That is a realistic authoring target. Data: `audit-scripts/likeness/out/roster-<sport>.json`.

### L-1 · Critical · Every player shares one skin tone and hair colour; hashed features actively mislead

**Evidence**

- See the code table above and `body.ts:592-611`.
- `lineup-nba.png` draws twelve real stars as the app draws them. Card portraits are in row 1, the 40 px match size in row 2, 24 px in row 3, and row 4 is all twelve in one shared kit.
- In row 4, Shaq, Curry, Rodman, Iverson, Jordan, LeBron, Bogues, Manute Bol, Jokić, Kareem, Yao and Giannis can be told apart **only by height**.
- The hash assigns (logged by `lineup.cjs`):
  - Allen Iverson '99: `hair 3` (bald). Real look: cornrows.
  - Shaquille O'Neal '01: `hair 2` (high top). Real look: shaved head.
  - Manute Bol: beard.
  - Erling Haaland: dark hair (`DEFAULT_HAIR`) and a beard. Real look: blond.
  - Mbappé '19 and Ronaldo '13: beard.
  - Ronaldinho '06: short hair, beard. Real look: long hair.
  - Pogba and Kanté: `hair 4`, a headband.
- `lineup-nfl.png` and `lineup-soccer.png` show the same in the other sports. NFL is worst: helmets hide hair, so 11 stars in one kit are clones.
- In matches (`ingame-nba-390-1.png`, `perf-match-*.png`) NBA sprites are 46–100 px tall (p10–p90; up to 266 px in close-ups), so identical heads and skin are plainly visible.

**Player impact.** This is the owner's explicit ask: "add different characters … that match them in real life … so we know who is who". Today a LeBron card, a Curry card and a bench player look the same. Random hair is worse than none, because it is visibly wrong for players fans know.

**Fix direction**

1. An optional, render-only appearance table keyed by `pid`, lazy-loaded with the card data and game chunk (about 20 KB gzip for 3,000 entries). Fields: `skin` (index into a 10-step palette; Monk-scale anchors in `research-likeness-animation.md` §3.2); `hair` (short, fade, buzz, bald, high top, afro, cornrows, braids, locs, ponytail, long, mohawk, receding); `hairColor`; `facial` (none, stubble, goatee, full, moustache); accessories (headband, goggles, arm/leg sleeves, tights, NFL visor, towel, undershirt); optional era overrides by season range (Rodman's hair, Jordan high top to bald).
2. Hand-author Tier A (about 150–200 per sport) from public photos. **Never infer** skin or hair from name, nationality or position; no classifiers, tattoos or logos. Unlisted players get a neutral default and a neutral short dark hair style, not a random one; drop the hashed headbands and beards.
3. In `body.ts`, add the hair silhouettes (cornrows and braids as dark rows, afro as a round cap, long hair and ponytail as a trailing capsule), goggles on the eye band, sleeves as a material switch and a visor tint.
4. Render-only, no protocol bump; add a `juice.test.ts`-style assertion that looks never touch seeded results.

### L-2 · High · Body weight hardly changes the silhouette; soccer has no weight

**Evidence.** `silhouette.cjs` measured each build at the same scale and pose, same kit, facing the camera. At the 40 px reference size:

| Player (ht/wt) | Bounding box (w×h) | Torso width |
|---|---|---|
| Curry 74/185 | 19×29 | **17** |
| Rodman 79/210 | 21×31 | 19 |
| Giannis 83/243 | 21×32 | **19** |
| Jokić 83/284 | 22×32 | **19** |
| Shaq 85/325 | 22×33 | **20** |
| Manute Bol 91/200 | 24×35 | **20** |
| Yao 90/310 | 23×34 | 21 |

The causes in `rig.ts:87-110`:

- `bulk = clamp(BMI/24.5, 0.85, 1.5)`, so Bol's BMI of 17 is floored.
- The torso radius scales only `0.78 + 0.22 × bulk`, and shoulders `0.84 + 0.16 × bulk`, so a 325 lb center is about 6% wider than a 185 lb guard.
- Width scales with height, so the thinnest man in history (Bol) is as wide as Shaq.

`style.ts` `widen()` adds a wider stride base for heavy players, but only while striding. Soccer has no weight column. The match invents `wt = 23 × h²` (`soccer2/render.ts:76`) and the card invents `wt = in × 2.35` (`CardArt.tsx:47`): Messi is 146 lb in the match and 157 lb on his card.

**Player impact.** Size is the strongest identity cue at 20–60 px (see the research doc, §2.4). Shaq vs Curry, Derrick Henry vs Tyreek Hill and Haaland vs Messi should read from across the court. Today only height reads.

**Fix direction**

- Widen the bulk range and apply it to the torso, shoulders and upper arms with a steeper curve: about ±25% torso width between BMI 20 and 32.
- Add a **lean / heavy** axis independent of height, so Bol is narrow and Shaq broad.
- Add a soccer `wt` column (public data exists for most current players) or a curated build class (slight, average, strong).
- Use one shared fallback formula in `body.ts`.
- Add a test that asserts a measurable width difference between BMI 20 and 31 at 40 px.
- Render-only.

### L-3 · High · The appearance dataset is missing entirely

**Evidence.** See §1.2. Across `src/data/*`, the card files and `nba-attrs`/`nfl-attrs`, the only appearance fields are `ht`, `wt` and `num`. Searches found no handedness, foot, skin, hair or accessory data anywhere in `src/`.

**Player impact.** Without data, no renderer improvement can make Messi left-footed, Kareem wear goggles, Rodman's hair change colour, or a lefty QB throw left-handed.

**Fix direction.** Add `src/data/looks-<sport>.json` (optional, additive, keyed by `pid`, with a build script and provenance column) carrying `hand` (Russell, Harden, Ginóbili, Mullin, Steve Young, Vick, Tua), `foot` (Messi, Robben, Salah, Maradona, Roberto Carlos, Bale), soccer club-era `pattern` (stripes: Juventus, Barça, Inter, Milan, Atlético; hoops: Celtic; sash: River Plate) and NFL accessories. Handedness can use the existing load-time mirror machinery (`mocap.ts:107-114`). Render-only unless handedness ever changes the sim (then bump the protocol).

### L-4 · High · Card art is one tiny mannequin; draft cards have no player at all

**Evidence**

- `portraitUrl` (`CardArt.tsx:70-98`) draws every card at about 54 px tall (`px = 54 × ht / 80`) into a 72×78 canvas, always in `idle(0.15)` (or `celebrate(0.25)`) at facing 1.2, pitch 0.1.
- Measured on screen (`cards.cjs`):
  - the 80 px club-grid card shows the art at **75 CSS px**, with the figure about 52 px tall and the head about 8 px;
  - the 150 px detail card shows it at 141 px;
  - the 320 px viewport gives 66 px cards and 62 px art.
- `cards-nba-390-club.png` and `cards-soccer-390-club.png` show a grid of identical figures that differ only in shirt colour and number.
- `cards-nba-390-reveal-2.png` shows a gold reveal: the walkout's hero art is the same generic stance.
- The UT Home "Standouts" tile (`perf-ut-nba-390.png`) shows a figure about 20 px tall.
- Draft cards (`ui/Card.tsx:68-125`) show an SVG jersey with **initials**, not a person.

**Player impact.** In every Ultimate Team game, the player's face is the card. The owner asks for "cards [that] appeal to the eye" and for knowing "who is who". Today the reveal, the most dopamine-heavy moment, shows a mannequin, and the club and squad screens are a wall of clones.

**Fix direction.** Add a **bust portrait** mode to `body.ts`: head and shoulders with a 32–40 px head (about 3× today's), same palette and outline rules, with brow, eyes, nose shadow, mouth, beard, hair silhouette and L-1 accessories. Use it on cards 70 px and wider and on draft cards (instead of initials); keep the full body for the smallest chips. Give each player a signature card pose from motion DNA, and a mocap idle or celebration walkout in Legend/GOAT reveals. Still original code-drawn pixel art.

### L-5 · Medium · Jersey numbers are unreliable as identity

**Evidence** (`numbers-legibility.png`, numbers 23, 80, 88, 12, 99, 7)

- **26 px:** only the front view shows digits. Any turn removes them, because the number is skipped when `total × squeeze > width + 1` (`body.ts:177-227`).
- **40 px at facing 0.9:** "80" becomes a solid block, "88" reads as "B" and "99" as a blob.
- **56 px at 0.6:** "23" reads as "9" and "80" as "0". Column dropping (`keepW`) changes digits.
- **80 px:** the font is still the fixed 4×7 glyph, so a 30 px chest carries a 7 px number.
- **In context:** NFL sprites have a median of 26 px (p10 20 px), so most NFL numbers are invisible in play.
- **Data:** 26% of NFL cards and 7.7% of soccer cards have no number.

**Fix direction**

- Scale the glyphs with chest width: 3×5, 4×7, then a 6×10 font at 60 px and above.
- Instead of dropping columns, skew or compress the whole glyph block, or hide the number when the chest is too turned.
- Put the number on the **back** for the camera-behind views (hoops and football offense are mostly seen from behind).
- Backfill NFL numbers from public rosters.
- Keep the existing name tags (they work: see "Preserve").

### L-6 · Low · Soccer kits ignore patterns; NBA/NFL uniforms have no era detail

- Soccer: `homeKit`/`awayKit` (`kits.ts:22-30`) produce flat shirts. Barça, Juve, Inter, Milan and Atlético, the most recognisable kits, look generic (`cards-soccer-390-club.png`).
  - Add a `pattern` material slot in `body.ts`'s torso capsule: vertical stripes by x-parity, hoops by y-band, a sash diagonal.
- NBA/NFL: one jersey, trim and shorts per team-era colour. There are no side panels, shorts trim, sleeves (NBA sleeved jerseys), throwback cuts or NFL helmet decals.
  - The helmet stripe exists; keep logos out (original-game rule).

---

## Part 2: Animation system

### 2.1 Inventory

**Pipeline.** 26 CMU motion-capture clips at 30 fps, plus 7 mirrors made at load. They are built by `scripts/build_mocap.py` and credited in `docs/CREDITS.md`, retargeted onto each player's bone lengths (`mocap.ts`), with event-time warping (`warp()`) so the release or contact lands when the engine decides. Hand-keyed poses (`poses.ts`, 28 functions) fill the gaps and stand in until the clips load.

Clips load as about 15–26 separate tiny chunks (2–10 KB each) after the renderer is created. The NBA lab drew its first frame at 1,082 ms; the clips were all in at 1,218 ms (local). Until then the hand-keyed poses show, then pop to mocap.

Sprite cache:

- key: clip:frame plus facing (8 directions below 22–26 px, 16 above), size and pitch (0.15 rad steps);
- caps: 360 sprites (NBA), 700 (soccer);
- new drawings per frame: **4** (NBA, NFL) or **5** (soccer).

Frames actually drawn per action (`anim-strips.png`; "drawn frames" is the count of distinct sprites the renderer would request):

| Sport | Action | Source | Drawn frames / duration | Rate | Notes |
|---|---|---|---|---|---|
| NBA | Jump shot | mocap `jumpshot` (124_05) | 33 over 1.0 s | 30 fps (step 1) | Release warped to the meter top; warp 1.0–1.13×. The best animation in the game. |
| NBA | Layup / driving finish | mocap `layup` | 19 over 0.95 s | 15 fps | Warp up to 1.7×; feet pinned. |
| NBA | Dunks: one, two, tomahawk, **windmill**, contact, stand | hand-keyed `P.dunk` | 13 over 0.62 s | 12 phases | The "windmill" arm never circles (strip row 3). A 360 is a sprite yaw spin. One- or two-handed is chosen by **id parity** (`hoops2/render.ts:53`). |
| NBA | Crossover, step-back | hand-keyed `P.crossover` | 7 over 0.35 s | 6 phases | The arm is stiff and straight out; no hand-to-hand ball. Step-back is the crossover reversed. The mocap `crossover` clip is unused. |
| NBA | Spin | hand-keyed | 7 over 0.45 s | | |
| NBA | Pass, catch | hand-keyed | 7 / 6 | | No bounce, lob or overhead variants. |
| NBA | Contest, block, rebound | **one** hand-keyed pose | 11 over 0.7 s | | The block has no swat; the rebound has no box-out. |
| NBA | Dribble standing / on the move | hand-keyed / gait plus a synthesized arm | | 8 phases | The mocap `dribble` clip is unused. |
| NBA | Idle, run, sprint, backpedal, shuffle | mocap | 81/20/22/51/28 frames | 10/15 fps | Rate-matched to speed, clamped 0.65–1.5×. |
| NBA | Stumble, posterized fall, ankle-break slip, get-up | mocap | | 15 fps | Good contact reactions. |
| NBA | Celebrate | mocap `celebrate` (arms up) | | | The same clip in all three sports. |
| NFL | Throw | mocap `throw` | 24 from the cocked frame | 30 fps | Held cocked while aiming. Good. |
| NFL | Juke | **NBA crossover pose** | 7 | | Mocap `cut` (with a plant event) is unused. |
| NFL | Stiff arm, truck, spin | hand-keyed | 7 each | | Mocap `stiff_arm` is unused. |
| NFL | Tackle, dive | mocap `dive` | 25 over 0.9 s | 15 fps | |
| NFL | Catch, catch on the run, block, kick, falls | mocap | | 15–30 fps | |
| NFL | QB drop | `ready` idle clip while moving | | | Skates 6.5 yd (NFL audit). |
| Soccer | Every pass, shot, cross, clearance | mocap `kick` (010_01, right foot) | 19 over 0.55 s | 30 fps | Warp up to 1.7×; no left foot, chip, volley or inside-foot pass. |
| Soccer | Keeper dive **and** slide tackle | mocap `dive` (forward belly dive) | 25 over 0.9 s | 15 fps | Warp up to 2.18×. A keeper flies chest-first sideways (`anim-strips.png` row 14). |
| Soccer | Header | mocap `jump` (a two-foot basketball jump) | 25 over 0.7 s | 30 fps | No glancing, diving or flick header. |
| Soccer | Dribble | none: the plain run cycle | | | `act 'dribble'` (`engine.ts:1186`) has no render case. No touches, no skill moves. |
| Soccer | Throw-in, keeper kick, distribution | none | | | |
| All | Get-up from the front | mocap `getup_front` | | | **Loaded nowhere.** |

Unused recorded clips: **`dribble`, `crossover` (+`_l`), `cut` (+`_l`), `stiff_arm`, `getup_front`**, 5 of 26 (19%). Soccer loads `shuffle`, `shuffle_l` and `fall_back` and never plays them.

There is no secondary motion anywhere: hair, jersey hem and shorts don't trail, the head doesn't turn to track the ball, and there is no foot IK or hand IK beyond the synthesized dribble and tuck arms.

### A-1 · Critical (NFL) / Medium (NBA) · The drawing budget makes the nearest players freeze

**Evidence.** `spritestats.cjs` and `stalebypx.cjs`, dev lab, 390×844, about 19 s of autoplay per sport:

| Sport | Lookups/frame | Cache hit | New drawings/s | **Stale draws overall** | Stale by on-screen size |
|---|---|---|---|---|---|
| NFL | 20.8 | 40% | 231 (3.9/frame, at the cap of 4) | **41.3%** | <24 px 3.0% · 24–31 px 36.2% · 32–47 px 60.0% · **48–71 px 81.0%** |
| NBA | 10.0 | 71% | 146 | 4.5% | 32–47 px 0% · 48–71 px 2.2% · 72+ px 8.4% |
| Soccer | 7.8 | 68% | 142 | 1.7% | all sizes ≤ 0.9% |

**Cause.**

- `this.budget = 4` per frame (`football2/render.ts:672`, `hoops2/render.ts:659`; soccer 5 at `soccer2/render.ts:700`).
- Once the budget is spent, a body gets its last sprite (`football2/render.ts:508`, `hoops2/render.ts:474`).
- Bodies are drawn **far to near** (`football2/render.ts:794`), so the small, far players use the budget and the big players nearest the camera freeze.
- The only exemption is the ball carrier (or, in hoops, the dribbler).
- NFL has 22 bodies whose sprites change size as the camera moves, so the misses never stop.

**Player impact.**

- In football, the linemen and the backfield in front of the camera hold a frame about 4 times out of 5. Their legs stall while they slide across the turf, a stutter that reads as "the game is lagging" even at 60 fps.
- This is the biggest single animation-quality bug, and it is cheap to fix.

**Fix direction** (render-only, no protocol bump). Spend the budget **near to far** (the carrier, then his nearest defenders, then by on-screen size), round-robin the rest so nobody is stale more than one frame in three, and budget by time (about 3 ms a frame) rather than count. Pre-draw gait cycles per size bucket at the snap or kickoff, and quantize sizes in 2 px steps above 30 px so camera zoom doesn't empty the cache. Add a regression test: stale rate under 10% for sprites of 32 px and up in an autoplay drive.

### A-2 · High · Every animation change is a hard cut

**Evidence.**

- There is no cross-clip or clip-to-pose blending anywhere. `mocap.ts` `sample()` blends only within a clip, and the renderers use whole frames via `frameAt`.
- `strips.cjs` measured the largest joint displacement, as a share of body height, between the last frame shown and the next:

| Cut | Jump |
|---|---|
| Soccer kick (0.55 s) → run | **59.8%** |
| Jump shot (1.0 s) → ready | 53.5% |
| Run → soccer kick | 52.7% |
| Sprint → NFL stiff-arm pose | 44.6% |
| Run → hand-keyed crossover | 44.1% |
| Run → jump shot | 42.2% |
| Sprint → NFL juke pose | 33.0% |
| Run → hand-keyed dunk | 32.4% |
| Ready → contest | 26.7% |
| Ready → pass | 22.4% |

- For comparison, within-clip steps are: run at 15 fps p50 16.0% / p95 18.5%; sprint 20.8% / 26.6%; jump shot at 30 fps 5.1% / 11.2%; idle at 10 fps 1.8% / 3.5%.
- The NBA audit also records velocity snaps (crossover or step-back burst in one step) and instant turns.

**Player impact.** Players "teleport" between poses 2–4 times a possession. The owner's "make animations seem real" is mostly about these seams, not the clips themselves.

**Fix direction**

- Blend joints for 80–150 ms on every animation change before `drawBody`: lerp positions or slerp bone directions from the outgoing pose. That is 5–9 extra drawings per transition; the sprite key includes the blend step, quantized to 3–4 steps.
- Pick entry frames phase-matched to the current gait (left or right foot down).
- Hold the last action frame until the next clip's matching frame.
- Render-only.

### A-3 · High · Signature moves are hand-keyed stick poses; recorded clips sit unused

**Evidence.**

- See the inventory table and `anim-strips.png`, rows 3–7 and 9–11.
- The NFL juke is literally the basketball crossover pose (`football2/render.ts:117`).
- The windmill dunk has 13 frames and the arm never rotates. Crossover, spin and pass have 7 frames each, with a rigid outstretched arm.
- The mixture of mocap and hand-keyed poses is visibly two art styles: smooth weight shift against stiff limbs.

**Fix direction.**

1. Wire up the existing clips: `crossover`/`crossover_l` (NBA crosses), `dribble` (standing dribble), `cut`/`cut_l` (NFL juke, NBA hesitation), `stiff_arm`, `jump` (rebounds and blocks, arms overridden) and `getup_front` (after face-first falls).
2. Add licence-clear research mocap through `build_mocap.py`: for basketball, dunk variants, rim hang, bounce and chest passes, block swat, box-out, free throw, fadeaway and hook; for football, spin, truck, 3/5/7-step drops, scramble, slide, handoff and punt; for soccer, inside-foot pass, laces shot, chip, volley, trap, chest control, keeper side dives low and high both ways, keeper catch and throw, feet-first slide, standing tackle, diving header, dribble touches on `stepL`/`stepR`, throw-in and 4–6 celebrations.
3. Keep hand-keyed poses only as load-time stand-ins.

### A-4 · High · Everyone moves the same

**Evidence.**

- One `jumpshot` clip for every shooter: Curry, Shaq, Kareem (no skyhook), Dirk (no fadeaway) and Wilt.
- One `throw` for every QB (no arm slot), one right-footed `kick` for every soccer player (Messi included) and one `celebrate` in three sports.
- Dunk style is part rating (fine) and part **id parity** (`hoops2/render.ts:53-56`).
- The only per-player motion variation is the sprint lean by speed rating and the heavy-man stride (`style.ts`), which is good.

**Player impact.** The reference games sell stars through motion: signature jumpers, QB release styles, striker celebrations. Without it, even a perfect look table leaves the game feeling generic.

**Fix direction.** Add **motion DNA** (`research-likeness-animation.md` §3.8):

- per player: `hand`/`foot` (mirror the clips), shot set point and release speed (warp the existing clip), shot form family (set shot, one-motion, fade, hook), QB arm slot (rotate the upper-arm bone), and a celebration id;
- derived defaults from ratings and size, with Tier A overrides.

It stays render-only **if** release timing stays as the engine decides. If DNA ever changes sim timing, bump that sport's protocol.

### A-5 · Medium · Low and irregular frame rates, sliding feet, snapping facings

**Evidence.**

- **Frame rates.**
  - Most clips are drawn at 15 fps (`step: 2`) and idles at 10 fps (`step: 3`).
  - In NFL and soccer, every clip on a sprite under 22 px is forced to step ≥ 3, i.e. 10 fps (`football2/render.ts:495`, `soccer2/render.ts:274`). Measured NFL sprites: p10 20 px, p50 26 px. Combined with A-1, NFL players effectively animate at about 4–10 fps.
- **Soccer foot sliding** (`soccer_slide.ts`, 776k body-frames, autopilot):
  - 9.8% of body-frames play the `ready` idle while drifting at 0.15–1 m/s (`soccer2/render.ts:158`);
  - 3.0% have the stride rate clamped off the ground speed;
  - total **12.8% sliding**, plus 2.4% of action clips (kick, tackle) played while moving over 1.5 m/s.
- **Other sports' sliding.** The NBA audit measured 29% sliding frames, and the NFL QB drop skates.
- **Unused or mis-tuned clips.** Soccer's `backpedal` clip has a ground speed of 0.56 m/s and a fixed rate of 1.1×; it never triggers, because facing follows velocity, so defenders never back off facing the ball.
- **Facings.** Facings snap in 45° steps under 22–26 px, and hoops has no render-side turn smoothing.

**Fix direction.**

- Use 30 fps for the ball carrier, his marker and any sprite of 40 px or more, keeping 15 fps for the far field. A-1's budget fix makes this affordable.
- Add a walk clip and a speed-blended locomotion set (idle, walk, jog, run, sprint) with no dead band.
- Anchor the stance foot: shift the sprite so the planted toe stays fixed for its contact beats; the clips already carry `stepL` and `stepR` beats.
- Let soccer defenders face the ball while retreating, using `backpedal` and `shuffle` at speed-matched rates.
- Interpolate facing over 80–120 ms in every sport.

### A-6 · Low · Thin presentation around the animation

- Crowds are a static noise texture with a colour pulse in all three sports (`ingame-*.png`); there are no referees, coaches or bench. Canvas labels ("POSTERIZER SILVER") are drawn at 1× and upscaled ×3 pixelated, so they read chunky.
- **Fix:** crowd reaction frames (seated, standing, arms up) recoloured per team, a few non-player figures, labels at 2× pixel scale.

---

## Part 3: Loading and runtime performance

### 3.1 Measurements (production build, Chromium, 390×844 DPR 3, isolated)

**Build output.**

- 116 assets, 22.6 MB raw / 6.35 MB gzip; 81 JS files (21.4 MB raw).
- Largest JS: `cards-soccer` 3.69 MB, `cards-nba` 3.27 MB, `cards-nfl` 2.92 MB, `season-references-nfl` 2.55 MB, `nba` draft 1.48 MB, `nfl` draft 1.19 MB, `nba-attrs` 1.10 MB, `nfl-attrs` 1.04 MB, `soccer` 1.0 MB, `season-references-nba` 0.65 MB.
- App chunks: UltimateTeam 253 KB, main index 235 KB plus 228 KB, `state` 233 KB, the Football2/Hoops2 shared chunk 174 KB, the soccer engine (`arcade`) 91 KB.
- `scripts/audit_startup.py` gives startup JS of **NBA 2.34 MB (773 KB gzip), NFL 2.04 MB (645 KB), soccer 1.86 MB (592 KB)**, and a precache of **11.5 MB in 111 files**.

**Cold first launch** (no cache, no worker). The time is until the welcome name field is interactive:

| Sport | JS files / transferred (gzip) / decoded | FCP (fast) | Interactive (fast) | FCP (4× CPU, 4G) | Interactive (4× CPU, 4G) | Long tasks (4× CPU, 4G) |
|---|---|---|---|---|---|---|
| NBA | 42 / 785 KB / 2.34 MB | 288 ms | 1,389 ms | 1,572 ms | **2,612 ms** | 3, 494 ms total, longest 295 |
| NFL | 42 / 657 KB / 2.04 MB | 276 ms | 1,385 ms | 1,260 ms | 2,206 ms | 3, 415 ms, longest 214 |
| Soccer | 42 / 603 KB / 1.86 MB | 248 ms | 1,344 ms | 1,284 ms | 2,284 ms | 3, 463 ms, longest 232 |

(Google Fonts were blocked in the harness. On a real first launch, add the third-party font CSS and woff2 round trips; see P-3.)

**Relaunch** (to the Home tab bar):

| Sport | Warm (worker, cached) | **Offline** | UT offline, never opened online |
|---|---|---|---|
| NBA | 1,027 ms | **3,965 ms** | "The cards didn't load. TRY AGAIN" |
| NFL | 927 ms | 3,942 ms | same |
| Soccer | 940 ms | 3,974 ms | same |

**Opening Ultimate Team for the first time in a session** (tap → UT screen ready):

| Sport | 1× CPU | 4× CPU | Longest task at 4× | JS decoded for UT | Heap at Home → after UT (CDP, after GC) |
|---|---|---|---|---|---|
| NBA | 2,123 ms | **7,395 ms** | 385 ms (6 tasks, 1,089 ms) | 4.56 MB | 14.0 → **55.5 MB** |
| NFL | 2,092 ms | **8,974 ms** | **669 ms** (5 tasks, 1,135 ms) | 6.26 MB | 11.4 → **68.8 MB** |
| Soccer | 679 ms | 1,834 ms | 431 ms (5 tasks, 902 ms) | 4.23 MB | 12.1 → 46.2 MB |

**In-match** (`?arcade&auto`, 10 s windows):

| Sport, viewport | 1× fps / p99 interval / rAF cost p99 | 4× fps / p99 interval / max | Frames > 20 ms in 10 s at 4× | rAF cost p99 at 4× | Long tasks at 4× | Heap (stable over 40 s) |
|---|---|---|---|---|---|---|
| NBA 390×844 | 60.0 / 16.8 / 7.8 ms | 54.8 / 33.4 / 100 ms | 40 | 31.6 ms | 2 (157 ms) | 37.8 MB |
| NBA 430×932 | 60.0 / 16.8 / 9.1 ms | **51.8 / 50.0 / 133 ms** | **62** | **39.9 ms** | 6 (405 ms) | 35.6 MB |
| NBA 320×568 | 59.9 / 16.8 / 6.5 ms | 56.7 / 33.4 / 133 ms | 17 | 27.7 ms | 4 (345 ms) | 40.1 MB |
| NFL 390×844 | 60.0 / 16.8 / 7.0 ms | 57.5 / 33.4 / 100 ms | 12 | 27.8 ms | 5 (390 ms) | 35.6 MB |
| NFL 430×932 | 60.0 / 16.8 / 7.1 ms | 56.7 / 33.4 / 117 ms | 17 | 33.3 ms | 4 (378 ms) | 35.6 MB |
| NFL 320×568 | 60.0 / 16.8 / 7.2 ms | 57.4 / 33.3 / 133 ms | 9 | 29.8 ms | 5 (424 ms) | 33.5 MB |

Soccer has no production bench (`?soccer-lab` is dev-only). The soccer audit's dev-lab figures are 60.0 fps at 1×, 59.0 fps at 4× (p99 33 ms), and 53 fps at 6×. Load to first match frame was 0.98–1.10 s in the lab (including the splash floor); the game chunks arrived at about 0.95–1.02 s. Precise heap during an arcade match was 17–20 MB. No leak trend appeared over 40 s.

### P-1 · High · Opening Ultimate Team stalls for seconds and keeps 40–57 MB

**Evidence.**

- See the UT table: 7.4–9.0 s at 4× CPU for NBA and NFL, with single long tasks of 385–669 ms (frozen UI, no input).
- The work done:
  - parsing `cards-<sport>` (2.9–3.7 MB of **JS object literals**: `import()` of JSON compiled to a JS module) plus the 2.55 MB `season-references-nfl`;
  - `buildPoolInSlices` rating 22–32k editions (`pool.ts:115-128`), which yields every 12 ms but can't slice the parse;
  - keeping every `RatedCard` in memory for the session (`getPool` cache, `pool.ts:131-140`).
- Soccer is 4× faster because its overalls are precomputed in the file.

**Player impact.** Ultimate Team is the core loop. On older iPhones (A12–A14, roughly 2–4× slower than this desktop CPU) the first tap on the UT tab hangs for several seconds and drops taps. The +57 MB of heap on top of the canvases raises the risk that iOS kills the backgrounded PWA, which costs a cold reload.

**Fix direction.** Precompute base ratings at build time, as soccer already does, and ship compact columnar data fetched as `.json` (`JSON.parse` is far cheaper than JS object literals). Parse and rate in a **Web Worker** behind the animated "Preparing your club…" screen, prefetch on Home idle for players with UT progress, index buckets lazily and release `season-references` after rating. Keep edition IDs and `pool.print` identical (online queues depend on them) and add a precomputed-vs-runtime pool equality test.

### P-2 · High · Ultimate Team is not available offline; precache spends 3.2 MB on files that don't help

**Evidence.**

- Every sport showed "The cards didn't load" offline (`perf-offline-ut-<sport>-390.png`).
- `vite.config.ts:40` classes `cards-(nba|nfl|soccer).json` as on-demand. The worker caches a file only after it has been fetched online on the current build (`sw.js` `cacheFirst`), so every deploy (new hashed file names) makes UT online-only again until the player reopens it.
- Meanwhile `season-references-nfl` (2.55 MB) and `season-references-nba` (0.65 MB) are in the **install precache** for every player, soccer-only players included, yet they are useless without the card files.
- Precache is 11.5 MB in 111 files, against the 8.79 MB recorded in `docs/OVERHAUL-PERFORMANCE.md`.

**Player impact.** A mobile game played on trains and planes loses its main mode offline, and each deploy silently re-breaks it.

**Fix direction.** After the worker is ready, background-cache the **current sport's** card file and its references (the `update.ts` warmer already does similar work), and stop installing references for sports the player doesn't play. Keep the Codex rule that NBA/NFL `attrs` stay installed for offline drafts. Extend `startup.mjs`: Home online, go offline, open UT.

### P-3 · Medium · A fixed splash floor, a render-blocking third-party font, and a slow offline relaunch

**Evidence.**

- **Splash floor.** `main.tsx:66-80` waits for `fontsReady()` (up to **2.2 s**), then at least **700 ms** from start ("let the ball finish its spin"), then a **450 ms** fade. A fully cached warm relaunch therefore takes about 0.93–1.03 s to render Home and about 1.4 s to reveal it, on a fast desktop CPU.
- **Fonts.** `index.html:29-31` loads Archivo from `fonts.googleapis.com` as a render-blocking stylesheet: the variable axes `wdth 62..125` and `wght 400..900`, roman and italic. A first launch on a slow network waits on a third-party CSS round trip plus woff2 downloads before first paint, and Home waits up to 2.2 s more in `fontsReady`.
- **Offline relaunch.** It took **3.94–3.97 s** to Home in all sports, against about 1.0 s online. That is consistent with the worker's network-first page timer of 3.5 s (`sw.js:66`) being hit instead of the fast-fail path. **Verify on device:** iOS airplane mode fails fast, but weak "lie-fi" signal will wait the full 3.5 s.

**Fix direction.** Keep the spin only on the very first launch (or only while something is pending). Self-host a subset Archivo woff2 (the weights and widths actually used) in the precache with `font-display: swap` and a preload, and drop the third-party blocking CSS. Serve the cached page immediately and revalidate in the background (the existing version check can prompt for updates), or cut the page timeout to about 800 ms.

### P-4 · Medium · Frame headroom in matches is thin on slower phones

**Evidence.**

- At 1× everything holds 60 fps with rAF cost p99 of 6.5–9.1 ms.
- At 4× CPU:
  - NBA at 430×932 drops to 51.8 fps, with p99 interval 50 ms, max 133 ms and 62 frames over 20 ms in 10 s;
  - NFL holds 56.7–57.5 fps but has 4–5 long tasks totalling about 400 ms in 10 s.
- The cost is new sprite drawings: NBA 146/s and NFL 231/s, each a per-pixel fill of a canvas up to 339×458 for close-up NBA sprites of 266 px (`spritestats.cjs` max).
- The NFL cost is capped only by the budget that causes A-1.

**Fix direction.** Use a time budget instead of a count, quantize sizes more coarsely, pre-warm sprites during play calls and dead balls, draw into pooled canvases or an atlas instead of a new canvas per sprite (lighter on iOS canvas memory), cap close-up sprites at about 120 px drawn and scale 2× pixelated, and profile `drawBody`'s per-pixel `finish()` loop. Keep `juice.test.ts`-style proof that rendering never touches the sim.

### P-5 · Low–Medium · Bundle shape and loading details

- Card and attribute data ship as JS modules (2.9–3.7 MB each). See P-1 for the parse cost; JSON assets would also gzip a little better and avoid JS compile caches.
- The **mocap clips are 15–26 separate requests** issued only after the match renderer starts, so the first frames use stand-in poses and then pop (NBA local: first frame at 1,082 ms, clips in at 1,218 ms).
  - Bundle the clips a sport needs into one chunk (about 100 KB), preloaded when the match screen is requested.
- Game chunks are fetched twice on a first, uncontrolled visit: once by the page and once by the cache warmer (seen in `matchperf.cjs` resource timings). The warmer is by design; consider a `cache.add` of the URL from the HTTP cache (`cache: 'force-cache'`).
- `src/game/sprites.ts`, `game/hoops/*` and `game/football/*` (the v1 engines) are dead code for live play. `Lab.tsx` imports only `football/model.rankOf`. Tree-shaking keeps them out of the bundle, but `sprites.ts`'s "one skin tone" comment documents a policy the overhaul should retire.

---

## Part 4: What works well and must be preserved

- **One code-drawn rig for every surface** (`body.ts`, `rig.ts`): depth-tested capsules, three-tone shading, outline by nearest part, crisp `pixelated` upscaling, no image assets. Extend it; don't replace it.
- **The mocap pipeline:** CMU clips retargeted to each player's bones; `warp()` lands releases and contacts on engine time (jump-shot release = meter top, `hoops2/render.ts:85`); root motion, `stepL`/`stepR` beats, events and load-time mirrors; `scripts/build_mocap.py` plus `docs/CREDITS.md` make new clips cheap. The jump shot, throw, falls, posterized/ankle-break reactions and get-ups are the best motion in the game.
- **Speed-matched gaits**, the heavy-man stride and speed-rated sprint lean (`style.ts`): the base for locomotion blending.
- **Render-only discipline:** `juice.test.ts` proves seeded results are unchanged by rendering; likeness and animation work can stay protocol-neutral.
- **iOS canvas-memory care:** capped `SpriteCache`, `freeCanvas`, `CanvasOut` recovery, disposal on resize and match end. Heap stayed flat at 34–40 MB over 40 s of play.
- **Name tags** (NBA ball handler; NFL receivers pre-snap and the carrier; soccer controlled player and everyone before kickoff): today's only identity carrier. Keep them.
- **Real data foundation:** exact ht/wt for 100% of NBA and 98.7% of NFL players, soccer heights, per-season numbers and team colours.
- **Codex startup work:** selected-sport data only, lazy admin/arcade/training, robust worker registration, NBA/NFL attributes installed for offline drafts. Matches hold 60 fps at 1× on every viewport tested.
- **Paced portrait drawing** (`CardArt.tsx:104-130`, 6 ms a frame): keep it for richer bust portraits.

---

## Part 5: Suggested order and constraints

1. **Render-only quick wins, about one week, no protocol bump:**
   - A-1: the budget order and time budget;
   - A-2: 80–150 ms joint blending;
   - wire the 5 unused clips (A-3, step 1);
   - P-3: the splash floor and font self-hosting;
   - the L-5 number font.
2. **Likeness data and art:** the appearance schema, a Tier A table of about 150–200 per sport, and L-2 body builds. Then the bust card portraits (L-4) and soccer kit patterns (L-6). Re-shoot `lineup.cjs`: the same-kit row should be distinguishable.
3. **Ultimate Team load:** precomputed pool, JSON or worker parse, offline caching of the current sport's cards (P-1, P-2). Guard pool fingerprint equality.
4. **Motion breadth:** about 40 new clips across the three sports (A-3, step 2), motion DNA with handedness and foot (A-4), locomotion blending and foot anchoring (A-5).

**Constraints:** keep appearance and animation out of the simulation (no queue bumps; if release timing or handedness ever changes outcomes, bump that sport's draft and UT protocol). No photos, logos, tattoos or licensed likeness assets, and never infer skin or hair from name, nationality or position. New data is optional, additive and lazy; never rename card or edition IDs; keep `pool.print` stable; test reduced motion.

## Appendix: evidence files

- **Likeness:**
  - `lineup-nba.png`, `lineup-nfl.png`, `lineup-soccer.png`;
  - `numbers-legibility.png`;
  - `cards-nba-{390,430,320}-{reveal-*,club,detail}.png`, `cards-{nfl,soccer}-390-*.png`;
  - `perf-ut-<sport>-390.png`.
- **Animation:**
  - `anim-strips.png`;
  - `ingame-{nba,nfl,soccer}-390-*.png`;
  - `burst-nba-sheet.png`, `burst-nfl-sheet.png` (0.25× slow motion; frames in `burst/`).
- **Performance:**
  - `perf-home-<sport>-390.png`;
  - `perf-offline-ut-<sport>-390.png`;
  - `perf-match-{nba,nfl}-{390,430,320}.png` (at 320 the NFL camera puts the line of scrimmage at the bottom edge with the backfield off-screen, as the NFL audit also found).
- **Data and scripts:** `audit-scripts/likeness/out/roster-{nba,nfl,soccer}.json`, `coldstart-*.json`, plus every script named above. The build output is in `audit-scripts/likeness/build/`.
