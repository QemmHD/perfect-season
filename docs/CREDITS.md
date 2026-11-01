# Credits

## Motion capture (arcade players)

The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with
funding from NSF EIA-0196217.

The arcade games' players move with real recorded motion from the CMU Graphics Lab Motion Capture
Database (free to use, including in commercial products; not to be resold as data). We use the
BVH conversion by Bruce Hahne (cgspeed.com), downloaded from its mirror at
https://github.com/una-dinosauria/cmu-mocap. `scripts/build_mocap.py` turns the stretches below
into the clips in `src/data/mocap/` (bone directions on our own pixel skeleton, 30 fps); the raw
files are not kept in the repository.

| Our clip | CMU trial | CMU description | Stretch used | Downloaded from |
| --- | --- | --- | --- | --- |
| `jumpshot` | 124_05 | Basketball Jump Shot (Sports Related Motions) | 2.75-4.15 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/124/124_05.bvh |
| `layup` | 124_06 | Basketball Lay Up (Sports Related Motions) | 2.45-3.98 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/124/124_06.bvh |
| `jump` | 016_03 | high jump (run, jump, walk) | 0.80-2.60 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/016/16_03.bvh |
| `dribble` | 006_13 | basketball - low, fast free style dribble, dribble through legs | 2.00-3.16 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/006/06_13.bvh |
| `crossover` (+ mirrored `crossover_l`) | 006_12 | basketball - forward dribble, 90-degree right turns, crossover dribble | 1.00-2.00 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/006/06_12.bvh |
| `shuffle` (+ mirrored `shuffle_l`) | 102_27 | DefensiveMoveSideToSide (Basketball) | 0.45-1.38 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/102/102_27.bvh |
| `ready` | 140_06 | Idle (Getting Up From Ground) | 4.40-7.10 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/140/140_06.bvh |
| `jog` | 016_35 | run/jog (run, jump, walk) | 0.20-1.00 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/016/16_35.bvh |
| `run` | 102_10 | RunningNoBall (Basketball) | 0.10-0.75 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/102/102_10.bvh |
| `sprint` | 143_01 | Run (General Subject Capture) | 0.10-0.82 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/143/143_01.bvh |
| `cut` (+ mirrored `cut_l`) | 102_18 | FeintLeftMoveRight (Basketball) | 0.40-1.40 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/102/102_18.bvh |
| `backpedal` | 136_11 | Walk Backwards Crouched (Weird Walks) | 2.00-3.70 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/136/136_11.bvh |
| `celebrate` | 079_69 | very happy (actor everyday activities) | 6.00-8.40 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/079/79_69.bvh |
| `stumble` (+ mirrored `stumble_m`) | 104_13 | StumbleWalk | 0.70-1.77 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/104/104_13.bvh |
| `fall_back` (+ mirrored `fall_back_m`) | 090_18 | RugPullFall (cartwheels; acrobatics; dances) | 0.55-2.38 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/090/90_18.bvh |
| `slip` (+ mirrored `slip_m`) | 090_17 | BannanaPeelSlip (cartwheels; acrobatics; dances) | 2.40-4.40 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/090/90_17.bvh |
| `fall_forward` (+ mirrored `fall_forward_m`) | 090_16 | fall on face (cartwheels; acrobatics; dances) | 3.10-4.60 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/090/90_16.bvh |
| `dive` | 090_16 | fall on face (cartwheels; acrobatics; dances) | 2.45-4.58 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/090/90_16.bvh |
| `getup` | 140_08 | Get Up From Ground Laying on Back | 1.50-5.60 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/140/140_08.bvh |
| `getup_front` | 140_01 | Get Up Face Down | 1.80-4.80 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/140/140_01.bvh |
| `throw` | 079_91 | football (actor everyday activities) | 2.30-5.00 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/079/79_91.bvh |
| `catch` | 033_01 | football - throw, catch (2 subjects - subject A) | 8.90-9.80 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/033/33_01.bvh |
| `catch_run` | 143_22 | Catch And Throw Football (General Subject Capture) | 1.15-2.35 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/143/143_22.bvh |
| `block` | 082_06 | Pushing on heavy object (jumping; pushing; emotional walks) | 3.00-4.46 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/082/82_06.bvh |
| `stiff_arm` | 143_23 | Punching (General Subject Capture) | 0.95-1.48 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/143/143_23.bvh |
| `kick` | 010_01 | soccer - kick ball (kick soccer ball) | 4.00-5.60 s | https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/010/10_01.bvh |

Notes on the data, for whoever rebuilds the clips:

- Subjects 75, 77, 79 and 80 were captured at 60 fps; their BVH files say 120, so the script reads
  them at 60 (`SOURCE_FPS_60`).
- 079_91's skeleton fit bends both knees backward in every frame; the script puts each knee on
  the other side of its hip-to-ankle line (`flip_knees`), which keeps the hips, ankles and leg
  lengths.
- Mirrored clips are made in the game at load time, not stored.

## Game-rating references (Ultimate Team benchmarks)

Ultimate Team uses the published video-game ratings of a player's season as numeric reference anchors (see
[RATINGS-AUDIT.md](RATINGS-AUDIT.md), "Expanded game-rating references"). The ratings belong to their publishers:
NBA 2K by 2K / Take-Two Interactive / Visual Concepts, Madden NFL by Electronic Arts. Perfect Season is not affiliated
with or endorsed by them, the NBA or the NFL. Only numbers are used; no names, art, logos or game files are copied.
They were collected by:

| Source | What we read | Terms |
| --- | --- | --- |
| [2K Archive](https://2karchive.com/) | NBA 2K–2K27 rosters; Madden 27 launch roster | free fan site, provided as is |
| [2KRatings](https://www.2kratings.com/), via [ReinerJasin/NBA2k25_Web_Scraping](https://github.com/ReinerJasin/NBA2k25_Web_Scraping) and [wkoverfield/nba2kapi](https://github.com/wkoverfield/nba2kapi) | NBA 2K25 and 2K26 rosters, 2K26 classic teams; all-time player profiles (`nba-rating-references.json`) | repositories say MIT (no licence file) |
| [theedgepredictor/nfl-madden-data](https://github.com/theedgepredictor/nfl-madden-data) (from maddenratings.weebly.com) | Madden 2002–26 launch rosters | no licence file |
| [nflscraPy MaddenRatings](https://github.com/blnkpagelabs/nflscraPy/releases/tag/MaddenRatings) | Madden 22–24 roster iterations | code MIT ([licence](NFLSCRAPY-LICENSE.txt)) |

## NFL Combine measurements (Ultimate Team football athleticism)

`src/data/nfl-combine.json` (40-yard dash, 3-cone, vertical, combine year for 4,029 card players) feeds UT football
speed/acceleration/agility where no same-season Madden rating exists (`src/ut/nfl-combine.ts`; Claude, 2026-11-01).

| Source | What we read | Terms |
| --- | --- | --- |
| [nflverse](https://github.com/nflverse/nflverse-data) combine data | 2000+ combine results | **nflverse (CC-BY 4.0), data from Pro-Football-Reference** |
| nflcombineresults.com, via the josedv82 combine dataset | 1987–98 hand-timed results (facts used at build time; +0.06 s hand-timing correction) | facts only |

## Sounds

The arcade games' sounds are real recordings: cut, layered, levelled and made mono by
`scripts/build_sfx.py` (its RECIPES say exactly which part of which recording each file is).
Mixkit's license allows free use in commercial games without attribution (credit given anyway);
the recordings may not be redistributed on their own, outside the app. Kenney's are public domain (CC0).
The menus' clicks, coins and card sounds are still synthesized in `src/lib/sound.ts`.

<!-- sounds:start (written by scripts/build_sfx.py) -->
| Our files (src/assets/sfx/*.mp3) | Recording | Author | Source | License |
| --- | --- | --- | --- | --- |
| cheer-arena | "Stadium crowd light applause" (Mixkit #362) | Mixkit | https://mixkit.co/free-sound-effects/discover/stadium-crowd-light-applause-362/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| crowd-arena, crowd-stadium | "Big crowd talking loop" (Mixkit #364) | Mixkit | https://mixkit.co/free-sound-effects/discover/big-crowd-talking-loop-364/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| dribble-1, dribble-2 | "Basketball falling indoor" (Mixkit #394) | Mixkit | https://mixkit.co/free-sound-effects/discover/basketball-falling-indoor-394/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| cheer-arena | "Male crowd cheering short" (Mixkit #459) | Mixkit | https://mixkit.co/free-sound-effects/discover/male-crowd-cheering-short-459/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| roar-arena | "Huge crowd cheering victory" (Mixkit #462) | Mixkit | https://mixkit.co/free-sound-effects/discover/huge-crowd-cheering-victory-462/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| ooh | "Crowd disappointment long boo" (Mixkit #463) | Mixkit | https://mixkit.co/free-sound-effects/discover/crowd-disappointment-long-boo-463/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| groan | "People moaning sadly" (Mixkit #469) | Mixkit | https://mixkit.co/free-sound-effects/discover/people-moaning-sadly-469/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| whistle | "Police short whistle" (Mixkit #615) | Mixkit | https://mixkit.co/free-sound-effects/discover/police-short-whistle-615/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| squeak-1, squeak-2, squeak-3 | "Rubber squeaking" (Mixkit #1009) | Mixkit | https://mixkit.co/free-sound-effects/discover/rubber-squeaking-1009/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| squeak-4 | "Rubber fast squeak" (Mixkit #1013) | Mixkit | https://mixkit.co/free-sound-effects/discover/rubber-fast-squeak-1013/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| buzzer | "Basketball buzzer" (Mixkit #1647) | Mixkit | https://mixkit.co/free-sound-effects/discover/basketball-buzzer-1647/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| horn | "Distant train horn" (Mixkit #1654) | Mixkit | https://mixkit.co/free-sound-effects/discover/distant-train-horn-1654/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| dribble-3 | "Basketball ball bouncing in the floor" (Mixkit #2076) | Mixkit | https://mixkit.co/free-sound-effects/discover/basketball-ball-bouncing-in-the-floor-2076/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| catch-1 | "Catching a basketball ball" (Mixkit #2081) | Mixkit | https://mixkit.co/free-sound-effects/discover/catching-a-basketball-ball-2081/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| swish, dunk | "Basketball ball hitting the net" (Mixkit #2084) | Mixkit | https://mixkit.co/free-sound-effects/discover/basketball-ball-hitting-the-net-2084/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| catch-2 | "Hand receiving a basketball" (Mixkit #2090) | Mixkit | https://mixkit.co/free-sound-effects/discover/hand-receiving-a-basketball-2090/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| rim-2 | "Basketball ball hit" (Mixkit #2091) | Mixkit | https://mixkit.co/free-sound-effects/discover/basketball-ball-hit-2091/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| rim-1, backboard, dunk | "Basketball ball, hard hit" (Mixkit #2093) | Mixkit | https://mixkit.co/free-sound-effects/discover/basketball-ball-hard-hit-2093/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| crowd-arena, crowd-stadium | "Ambient sports crowd sound" (Mixkit #2097) | Mixkit | https://mixkit.co/free-sound-effects/discover/ambient-sports-crowd-sound-2097/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| kick | "Soccer ball kick" (Mixkit #2099) | Mixkit | https://mixkit.co/free-sound-effects/discover/soccer-ball-kick-2099/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| roar-stadium | "Crowd yelling at stadium" (Mixkit #2110) | Mixkit | https://mixkit.co/free-sound-effects/discover/crowd-yelling-at-stadium-2110/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| cheer-stadium | "Crowd at the stadium" (Mixkit #2111) | Mixkit | https://mixkit.co/free-sound-effects/discover/crowd-at-the-stadium-2111/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| hit-2, hit-3 | "Hard and quick punch" (Mixkit #2143) | Mixkit | https://mixkit.co/free-sound-effects/discover/hard-and-quick-punch-2143/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| hit-3 | "Impact of a blow" (Mixkit #2150) | Mixkit | https://mixkit.co/free-sound-effects/discover/impact-of-a-blow-2150/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| hit-1 | "Body punch quick hit" (Mixkit #2153) | Mixkit | https://mixkit.co/free-sound-effects/discover/body-punch-quick-hit-2153/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| hit-3 | "Wood hard hit" (Mixkit #2182) | Mixkit | https://mixkit.co/free-sound-effects/discover/wood-hard-hit-2182/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| thud | "Body impact falling into the sand" (Mixkit #2498) | Mixkit | https://mixkit.co/free-sound-effects/discover/body-impact-falling-into-the-sand-2498/ | Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree) |
| rim-1, dunk | impactMetal_heavy_000.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| rim-2 | impactMetal_medium_000.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| backboard | impactPlate_heavy_000.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| dunk | impactPlate_medium_001.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| hit-2 | impactPunch_heavy_000.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| hit-3 | impactPunch_heavy_002.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| thud | impactSoft_heavy_000.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
| hit-1 | impactSoft_heavy_001.ogg from Impact Sounds | Kenney (kenney.nl) | https://kenney.nl/assets/impact-sounds | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) |
<!-- sounds:end -->

## Soccer data (not yet in the app)

`src/data/soccer.json` and `src/data/cards-soccer.json` (scripts `soccer_sources.py`,
`build_soccer_cards.py`, `build_soccer_data.py`; details in [SOCCER-DATA.md](SOCCER-DATA.md)) are
built from:

| Source | What we use | License |
| --- | --- | --- |
| [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) by dcaribou (facts scraped from transfermarkt.co.uk) | league games, minutes, goals, assists, cards, lineups, substitutions, heights, birth dates and caps, 2012-13 to 2025-26 | CC0 1.0 (the dataset). We ship facts and our own ratings only: no market values, agents or photos. |
| [Wikidata](https://www.wikidata.org) | legends' and older players' club spells (games, goals), heights, birth dates, Transfermarkt ids, Ballon d'Or winners | CC0 1.0 |
| [openfootball/football.json](https://github.com/openfootball/football.json) | league results, to cross-check champions | CC0 1.0 / public domain |

All overall ratings and face stats are our own model and estimates. They are not taken from or
fitted to any video game. Club colors are plain identity colors; no crests, kits or photos are used.
