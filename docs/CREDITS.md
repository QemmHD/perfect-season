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
