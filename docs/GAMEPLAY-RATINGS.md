# Gameplay ratings pass: every rating matters, balanced, and the games feel better

**Implemented by Claude (Anthropic), 2026-11-01**, branch `claude/gameplay` (from `feature/season-evolution` d64921c; not merged, not deployed).
Owner's ask: "make all ratings feel like they matter in game and balanced, use NBA 2K / Madden / EA FC as reference for that and for animation and how the game should play … make the gameplay actually enjoyable."

The research behind it (dead attributes, inversions, the autopilot stall, the measured plan) is in the scratch notes summarised in `docs/GAMEPLAY-RESEARCH.md`; this file records what changed, why, and the before/after measurements. Measurement harnesses: fixed-seed AI-vs-AI games, the Pro AI (skill 0.68, `defIQ` 0), synthetic teams with every attribute at the stated value (NFL speeds by position, +0.35 per point), 80 NBA games (1,280 possessions) / 60 NFL games (240 drives) per row unless noted. `src/game/balance.test.ts` (opt-in, `BAL=1`) repeats the team test with real rated lineups.

## Online compatibility

Engine rules change for both sports, so the match protocol is bumped once for this release: **draft NBA 9 → 10, NFL 9 → 10; UT NBA 9 → 10, NFL 10 → 11** (`src/net/match.ts`, `src/ut/Match.tsx`; pinned in `net.test.ts`, `nfl-net.test.ts`). No card ratings, IDs, saves, keys, levels, serials or backend links change. Juice and animation are render only (no rules effect).

## NBA (hoops2)

### P0
| Problem (before) | Fix | Measured |
|---|---|---|
| **Autopilot stall**: all-90 shooters 0.705 PPP vs 1.095 for 75s; after six passes the AI neither passed nor shot until the clock forced a bad one | A pass costs `(0.15 + 0.05·passes)·(1 − 0.4·rate(PAS))` of shot value; no passing after six (the ball handler plays); the AI also runs a pick and roll and steps back for space; Pro release spread 95 → 66 ms (Rookie 84, Legend 50; a good thumb is ~45) | thr/mid 60 / 75 / 90: **0.92 / 1.10 / 0.71 → 0.96 / 1.01 / 1.18 PPP**; new monotonicity test across THR, MID, HND, PAS, LAY, DNK, SPD, ACC, STR, FT |
| **Strength ignored at contact**: every drive into a set defender lost 96% of its momentum whatever the strength | One contact read per bump: stonewall chance `clamp(.5 + ΔSTR/70 + Δwt/250 + (PRD−HND)/200, .05, .9)`; stonewalled: speed ×0.35; otherwise he keeps half his momentum and moves the man back 0.35 ft (`bump-through`) | 95-STR big vs 55-STR guard: 6% stonewalled (was always); reverse: 90% |
| Dead badges: Lob City, Heat Check, Icon | Lob City lowers the alley-oop bar from DNK 80 to 74 and +6% oop finish; Heat Check fires after two makes; Icon plays +3 on every rating in the last four possessions | tests in `hoops2/ratings-matter.test.ts` |

### P1
| Attribute / rule | Before | After |
|---|---|---|
| Jump-shot curve | green window `0.12 + 0.88·r^1.6` (ratings agent); off-green three `lerp(.16,.50)`; perfect release through a contest fixed (.98/.70/.38) | **green window kept**; rating-scaled perfect caps (light .80→.97, heavy .32→.62, smothered .10→.30), touch width .014→.030 s, off-green base three .06→.40 (mid +.04, close +.08); above 99 +0.02/pt, max 11 pts |
| Open three, 45/60/75/90/99, σ 45 ms | 58/66/76/86/89% | **36/51/67/81/87%** (targets 36/51/68/82/87) |
| Heavy-contest three, same | 37/41/45/50/52% | **13/20/28/38/44%** (targets 12/20/29/39/44) |
| PRD in the contest | −(PRD−60)/60 ft | −(PRD−70)/30 ft (a 99 is a foot tighter than a 70) |
| Closeouts | room ≥5 ft → at most light, ≥3 → heavy | ≥7 → at most open, ≥5 → light, ≥3 → heavy (separation pays) |
| Deadeye | any jumper | only the shot type it was earned with, by tier |
| ACC | 0→top in 0.44 s (45) … 0.27 s (99) | 0.62 s … 0.26 s |
| On-ball defender speed | flat | ×clamp(1 + (quick_d − quick_o)/150, .85, 1.08), quick = (SPD+ACC)/2 |
| Driving dunk | any DNK 68+ | through a man only DNK 75+; open dunk .78→.97 (was .86→.97); rim contest heavy .80→.70, smothered .66→.50 |
| IND | dead | set big within 3.5 ft: block +(IND−60)/400, finish ×lerp(1.04, .86) |
| PAS | dead | pass speed dist/lerp(36,50) ft/s, lane picks ×lerp(1.4, .6) |
| FT | dead | the and-one's free throw: lerp(.45, .92) by FT 40→97 |
| Defender STA | defenders never tired | both sides drain `0.03·(1.6 − STA/80)` per possession |
| Reach-in steals | 0.13/s | 0.09/s (steals were one possession in six) |

### P2: tiered badges (NBA 2K26 thresholds)
`src/game/hoops2/badges.ts`. The card still gets the badge from `ratings.ts badges()` (unchanged lists); its **tier** is read from the ratings when it's used, and the effect is scaled by Bronze/Silver/Gold/HoF/Legend = .35/.55/.75/.90/1.0. Thresholds from Destructoid's NBA 2K26 badge requirements:

| Badge (2K26 name) | Bronze / Silver / Gold / HoF / Legend | Effect at full strength |
|---|---|---|
| Deadeye | 73/85/92/95/99 (the shot's own rating) | half the contest's window loss back; +25% of the gap to a clean make on a perfect release |
| Limitless Range | 3PT 83/89/93/96/99 | deep-three falloff floor 0.80 → 0.92 |
| Posterizer | DNK 73/87/93/96/99 + VRT 65/75/80/85/90 | dunks through contact; finish ×(0.8 + 0.2·tier) |
| Clamps (On-Ball Menace) | PRD 74/79/91/96/99 + ACC 70/76/80/84/86 | −0.6 ft contest; −0.10 shake |
| Ankle Breaker (Ankle Assassin) | HND 75/86/93/95/98 | +0.10 shake; drop 22% |
| Rim Protector (Paint Patroller) | IND 60/70/84/94/99 + BLK 74/84/93/97/99 | +8% block at the rim |
| Dimer | PAS 55/71/82/92/98 | lane picks −40%; catch-and-shoot window +12% |
| Lob City, Heat Check, Icon | not tiered | see P0 |

A badge that changes a play pops over the player's head in its tier colour (`badge:<id>:<body>:<tier>` events).

### NBA attribute sweep (O = all five offense, D = all five defense, others 75; PPP)
| Variant | Before | After |
|---|---|---|
| base (all 75) | 1.095 | **1.009** |
| O THR 60 / 90 | 0.916 / **0.705** | 0.963 / **1.178** |
| O HND 90 | 1.116 | 1.105 (shook 86 → 272) |
| O STR 90 | 1.141 | 1.080 |
| O PAS 90 | 1.095 (dead) | 1.066 (INTs 94 → 25 at base) |
| O FT 90 | 1.095 (dead) | 1.009 (and-one FTs are rare in AI play) |
| D PRD 90 | 0.891 | 0.879 |
| D IND 90 | 1.095 (dead) | 1.004 (rim finishes are ~10% of AI shots) |
| D STR 90 | 1.189 (inverted) | 1.059 (within noise at 200 games: base 1.010, D STR 55 1.040; contact is rare in AI play) |

## NFL (football2)

### P0
- **Move inversion**: a truck was judged against the better of TAK and HIT and got no timing bonus, so the numbers and the AI (+6 juke bias) sent every runner to the juke. Now (`moveEdge`): juke = JKM vs PUR; spin = SPM vs TAK; stiff arm = 0.7·SFA + 0.3·STR vs 0.7·TAK + 0.3·STR; truck = 0.7·TRK + 0.3·STR + (wt_c − wt_d)/8 vs 0.7·max(TAK, HIT) + 0.3·STR; a stiff arm/truck on at contact gets +0.18 (a juke timed to the dive +0.32, spin +0.20). The AI and the POWER button pick the move that beats the man; the AI throws a power move as the tackler leaves his feet (it was 0.15 s late) and a truck keeps the runner's speed. Power back (TRK/STR 95): broken tackles 338 → 391–432 per 60 games (two runs); a 95 juke back 385.
- **All 16 abilities** work (`engine.ts on()/used()`), each "in the zone" on about half the plays (a seeded roll at the snap; both phones agree) and pop over the player when they act (`ability:<id>:<body>`):

| Ability | Effect when on |
|---|---|
| Cannon (QB) | ball speed ×1.06, +4 yd range |
| Surgeon (QB) | throw error ×0.7 at 15 yd or less |
| Scrambler (QB) | ×1.04 speed on a scramble |
| Truck Stick (RB) | truck +0.12 |
| Juke Box (RB) | juke ×1.15 |
| Deep Threat (WR/TE) | man cushion −0.5 yd past 15 yd |
| Sure Hands | uncontested catch ≥ 96% |
| Red Zone | contested catch +0.15 inside the 20 |
| Pass Pro (pocket-wall) | his rusher wins 0.35 s later |
| Road Grader | run block +0.25 s, rusher's edge −0.2 |
| Edge Threat | wins 0.35 s sooner |
| Run Stopper | shed +0.2 |
| Enforcer | big hit possible from 6 yd/s closing, ≥30%; fumble +1% |
| Shutdown | man coverage reacts 3 frames sooner |
| Ballhawk | INT +0.15 (lane, contested, overthrows) |
| Big Leg (K) | +4 yd FG range (always on: the range shows before the kick) |
| Heat Check / Icon (UT promo/legend) | QB hot after two completions / +3 everything on the last drive |

### P1
| Attribute / rule | Before | After |
|---|---|---|
| Accuracy (SAC/MAC/DAC) | error `(1−acc)^1.5·(0.65 + 0.035·yd)`; receivers ran to the landing spot, so it never showed (cmp 0.59 vs 0.68 at 60/95 but scoring flat) | `(1.0 + 0.06·yd)`; receivers run to the aimed spot and read the ball only late in its flight (sooner with CTH); reaching costs more; cmp 0.62 → 0.69 |
| THP | 17→26 yd/s from THP 55 | 19→25 yd/s from THP 50 (+Cannon) |
| Run game | 7.75 ypc, 12% runs of 10+ | **4.53 ypc**, median 3–4 (reads/holds tightened, tackle base .76 → .82, pursuers' closing burst within 5 yd) |
| PRC split | PRC set the wind-up and lane plays | wind-up = (TAK+PUR)/2; lane play = ½ PRC + ½ coverage |
| Route break | none | RTE/AGI vs MCV/AGI: `clamp(.5 + (RTE−MCV)/60 + (AGI_o−AGI_d)/150, .1, .9)`; a win = defender 6 frames late, 80% speed for 0.25 s |
| Contested catch | `lerp(.25,.85,edge)·(.75+.3·CIT) − .08·cover` | `(.7 + .4·CIT) − .12·cover`; SPC adds up to .35 yd reach on lobs / high balls |
| Pass rush | max(PMV, FMV) − PBK, gently | best of power (PMV+STR)/2 vs (PBK+STR)/2 and finesse (FMV+AGI)/2 vs (PBK+AGI)/2 |
| BCV | dead | AI lane misjudgment ±3 yd (BCV 45) → ±0.5 (99) |
| AWR | dead | QB reads up to 0.3 s sooner; defenders break on the ball up to 0.05 s sooner |
| Block leverage | weight, RBK/BSH | + ΔSTR/200 |
| Cliffs | pancake only IBL ≥85; big hit only HIT ≥77; press only PRS >72; kick window flat below KAC 55 | pancake 0.12·rt(IBL,70,99); big hit 0.3·rt(HIT,50,99) at 7.5 yd/s closing; press chance rt(PRS,60,99); kick window .36 + .30·rt(KAC,40,99) |
| Coverage span | reaction lag 18→4 frames; break-on-ball .42→.16 s; zone/man cushions steep | 13→6.5 frames; .40→.20 s; cushions halved (each still monotone; they compounded to −85% scoring) |

### NFL attribute sweep (pts per 4-drive game; Y/run)
| Variant | Before | After |
|---|---|---|
| base (all 75) | 14.8 · 7.75 | **11.5 · 4.53** |
| RB SPD 60 / 95 | 8.6 · 3.4 / 18.6 · 13.6 | 7.5 · 2.1 / 14.8 · 6.6 |
| QB THP 60 / 95 | 12.7 / 18.7 | 10.2 / 12.8 |
| QB accuracy 60 / 95 (cmp) | 13.7 (.59) / 16.4 (.68) | 9.8 (.62) / 12.3 (.69) |
| WR RTE 60 / 95 | 16.0 / 16.4 | 10.7 / 12.2 |
| CB MCV 60 / 95 | 15.8 / 15.0 | 11.2 / 10.7 |
| OL PBK 60 / 95 | 14.4 / 15.3 | 11.1 / 11.9 |
| RB BCV 60 / 95 (Y/run) | 7.75 / 7.75 (dead) | 4.71 / 5.67 |
| WR CIT+SPC 95 | 15.0 | 12.3 |
| LB PRC 95 | 12.6 | 10.7 |

## Team balance (AI vs AI, both offenses against the other's defense)
| Matchup (synthetic) | Before | After |
|---|---|---|
| NBA 75 v 75 | 53% (18.4–17.8 pts / 16 poss) | 45% (15.1–16.1) |
| NBA 90 v 75 | 66% | **89%** |
| NBA 99 v 90 | 81% | 71% |
| NBA 60 v 75 | 17% | 9% |
| NFL 75 v 75 | 48% (15.0–16.3 pts / 4 drives) | 41% (10.0–11.9; same teams, seed noise) |
| NFL 90 v 75 | 100% (22.1–4.0) | 99% (20.2–3.1) |
| NFL 99 v 90 | 91% | 95% |
| NFL 60 v 75 | 1% | 1% |

Real rated lineups (`balance.test.ts`, NFL lineups matched by average overall): 90 v 75 95%, **90 v 82 79%, 82 v 75 80%**, 75 v 75 51%. The NBA real-lineup run is not a fair balance measure: the draft "overall" comes from a value rank, and the "90" five there (e.g. Cassell, D. Anderson, Bantom, A. Davis, R. Wallace) has weaker shooting and finishing attributes than the "82" five, so it loses; that's a draft-ratings issue for the ratings work, not the engine.

(Second pass below: NBA 90 v 75 87.5%, NFL real 90 v 75 80%.) Targets: **NBA 1.0–1.15 PPP for even teams on Pro — met (1.01; 1.065 after the second pass).** NFL "20–28 points per game" is a full-length-game number; these games are four drives a side, so the comparable rate is about 2–3 points a drive (NFL average ~2.0): even teams score 10–12 per four drives (2.5–3/drive) with a realistic mix (≈30% runs at 4.5 ypc, 66% completions, 8.4 Y/att). **90 v 75 at 70–80% is met for adjacent real-lineup tiers in the NFL but not for the extreme synthetic teams** (every one of 37 attributes 15 higher): the per-play edges compound over a 4-down drive; compressing every rating by 35% still left 95%, so a fix there means flattening ratings, which contradicts the brief. NBA 90 v 75 is 89% (the rating-scaled shot curve separates shooters far more than before). Above 99 everything stays finite (+0.009–0.02 per point, at most 11 points).

## Second pass: rim attacks, spacing and football's variance (Claude, 2026-11-01)

Same unreleased release, so the protocol numbers above stay (draft NBA 10 / NFL 10, UT NBA 10 / NFL 11). Engine and autopilot only (`hoops2/`, `football2/`); no ratings, saves or keys change. Measured with the same harnesses (100 games per row, Pro AI, synthetic all-X teams; NFL real lineups from `balance.test.ts`, 60 games).

### NBA: shot selection that attacks the rim
**Why the AI shot contested jumpers.** A drive was a flat number by the finish rating, it only started with no defender anywhere in the lane, and it was abandoned the moment anyone stepped in (checked every frame). Passes were valued at the receiver's room *now*, so the ball swung to "open" men who were contested by the release. Result: 87% of even-team shots were threes, 5% at the rim, 72% of releases heavily contested.

| Change | Where |
|---|---|
| `attackValue`: getting by the man (SPD+ACC and HND against his quickness and PRD; square in front, the bump: `stonewallChance`; on the block, a post-up by STR/size), the help in the lane weighted by IND/BLK, the finish (DNK 75+ through traffic, else LAY), the crowd, the and-one (STR, then FT), the strip risk | `hoops2/autopilot.ts` |
| A drive is committed: it finishes in stride, pulls out only when walled off (then a floater or a kick-out in the paint), and kicks to the open man when help comes | autopilot |
| `catchValue`: the receiver's man closes out while the pass is in the air; own jumpers are read at the release (a man within 4 ft rises with him; pull-up mids from 9 ft); floaters and contested long twos are discounted (the NBA's worst shots, ~0.8 pts) | autopilot |
| Driving dunk through a man: blocks+IND, size, bounce, a second man in the paint and a seeded read vs DNK − 4 (any 75 used to dunk over an even man); dunk contest heavy ×0.90, smothered ×0.80 | `hoops2/engine.ts` |
| Rim: each other set defender within 6 ft ×0.9, and **spacing**: every teammate who can't shoot (THR < 72) is part of a helper (`spacingHelp`); STR vs STR on a contested finish ±10%; IND anchor block +(IND−60)/320, finish ×lerp(1.06, 0.80) | engine |
| Help comes from ≤ 9 ft (+2·defIQ, +7 ft off a non-shooter); a better blocker is the first choice but no longer helps from further (more BLK had conceded more) | engine |
| On-ball sag no longer gives a non-shooter a 2.2-ft cushion to drive into; help digs strip a careless driver; reach-in steals by STL less steeply (0.35 + 0.65·rate) | engine |

| Even teams (all 75) | Before | After | NBA (Cleaning the Glass, league avg) |
|---|---|---|---|
| PPP | 1.016 | **1.065** | ~1.15 (ORtg 115) |
| Shot mix rim / mid+close / three | 5% / 8% / 87% | **64% / 4% / 31%** | ~31% / ~30% / ~39% |
| FG at the rim / three | 76% (79 att) / 37% | 60% / 43% | ~66% / ~36.5% |
| and-ones per 1,600 trips | 1 | 54 | |

The mix is rim-heavy rather than NBA-like: the arcade jump-shot curve (open threes 67% for a 75 with a good thumb) and the near-absent long two stay as designed; the AI now takes the shot that scores, and threes rise for shooters.

| Variant (O = offense five, D = defense five, PPP) | Before | After |
|---|---|---|
| base | 1.016 | 1.065 |
| O slashers (DNK/LAY 95, SPD/ACC/HND 90) | 1.172 (rim 15% of shots) | **1.465 (rim 84%)** |
| O shooters THR/MID 90 / poor 60 | 1.167 / 0.988 | 1.131 (threes 84%) / **0.952** |
| O HND / STR / FT / CLS 90 | 1.101 / 1.086 / 1.017 / 1.129 | 1.143 / 1.134 / 1.093 / 1.121 |
| D PRD / IND / BLK / STR / STL 90 | 0.857 / 1.012 / 0.999 / 1.063 / 0.950 | 0.993 / **0.996** / 1.052 / 1.061 / 1.003 |
| synthetic 90 v 75 / 99 v 90 / 60 v 75 (win %) | 89 / 71 / 9 (first pass) | **87.5** / 57.5 / 1.5 |

D STR/BLK now show at the rim (rim FG 58% against them) but the AI shoots more threes instead, so their PPP effect stays small. New tests (`hoops2/ratings-matter.test.ts`, 60 games a point): no defensive attribute raised to 90 concedes more (PRD, IND, BLK, STL, STR, SPD, ACC, REB, VRT, and all of them together −0.15); CLS/SDK join the offensive monotonicity list; even teams take ≥25% rim and ≥25% threes at 0.95–1.18 PPP; slashers get ≥10 points more of their shots at the rim and score 0.1 more, shooters take ≥15 points more threes.

### NFL: why 90 v 75 compounds, and realistic variance
Investigation (synthetic all-90 vs all-75, before): the 90 offense scored a touchdown on 66% of drives, the 75 offense 4.6%. Not turnovers, sacks or kicking: per-play edges stack over ~37 attributes. Single groups at 90: RB +1.2 pts a drive, WR/TE +0.8, OL +0.7, DB −1.2; top speed alone (+5 SPD on the skill players) +44% YAC; missed tackles were 39% of attempts (NFL ~12–15%) and 20-yard plays averaged 17–29 yards after the catch. Saturating every head-to-head duel (tackle, moves, route break, rush, run block) still left 98–100%; only shrinking the whole gap gets there (synthetic 82 v 75 = 83%, 85 v 75 = 98%). The real lineups, where gaps differ by position, are where it now lands in range.

| Variance / realism source (new) | Rule |
|---|---|
| Kickoff field position | `startSpot`: 45% touchbacks at the 25, the rest returned around it (±5 yd, ±3 by returner speed vs LB/S coverage), ~8% big returns to the 38–52; seeded by game and drive (both phones agree) |
| Flags | offensive holding 2.2% of passes / 1.4% of runs (10 yd, replay the down), defensive holding/illegal contact 1.2% of passes (5 yd, first down), offside 0.8% (5 yd), DPI on 14% of contested incompletions 12+ yd downfield (spot, first down); AWR ±20%; the side that didn't foul declines when the play was better; never on a touchdown; shown as a FLAG banner |
| Blown coverage | per pass play `lerp(7.5%, 2.5%)` by the secondary's AWR+PRC (×(1−0.4·defIQ), floor 1.2%): in man he squats short (thinks zone), in Cover 3 a deep defender jumps the underneath route; average gain ~20 yd when thrown at |
| Loose balls | a forced fumble is recovered by the offense 45% of the time (always lost before) |
| Tackling | tackle `0.90 + 0.16·TAK − 0.20·BTK (+0.20 help)`, wrap range 1.0 + 0.4·TAK yd: missed tackles 39% → 30% at 75 v 75 |
| AI fourth down | kick in range, otherwise go: in this format a punt scores nothing and the next drive starts from a kickoff, so it equals a turnover on downs |

| NFL result | Before | After |
|---|---|---|
| 75 v 75: pts / 4 drives, Y/att, Y/run, missed tackles | 11.7, 8.8, 4.60, 39% | 12.3, 7.8, 3.92, 30% |
| synthetic 82 / 85 / 90 v 75 (win %) | 85.5 / 95 / 99.5 | 82.5 / 98.5 / 100 |
| synthetic 99 v 90 / 60 v 75 | 95 / 1 | 98 / 0.5 |
| **real lineups 90 v 75 / 90 v 82 / 82 v 75 / 75 v 75** (`BAL=1`, 60 games) | 95 / 79 / 80 / 51 | **80 / 82 / 72 / 57** |

NFL references: 2024 per-drive TD rate 23.8%, turnovers 10.7% of drives, ~10.2 drives a game (Sharp Football Analysis); 22.9 points a team game (Pro-Football-Reference), so ~2.2–2.3 points a drive; completions 65.3%, INT 2.17% of attempts (2024, Sharp Football Analysis). Even teams here score 3.1 a drive (arcade four-drive game, as before) with 63% completions and 2.8% INT; penalties and busts make drive outcomes noisier for both sides.

**A person against the AI** (`HUMAN=1` human-pace pilot, real rated lineups; pts / 4 drives, avg O v avg D): Rookie 14.6 → 14.9, Pro 9.5 → 12.8, Legend 9.3 → 8.7; good O v good D 12.1/8.9/4.8 → 12.0/11.6/8.5. Every cell now drops Rookie → Pro → Legend (Pro and Legend were nearly equal before); plays per drive 5.2 → 6.3 with the flags and fourth-down tries.

Sources (second pass): Cleaning the Glass league shooting (cleaningtheglass.com/stats/league/shots); The Ringer on mid-range decline (2021); Sharp Football Analysis per-drive scoring/turnover tables and 2024 completion/INT rates; Pro-Football-Reference season team offense.

## Feel and animation (render only)
- `src/game/juice.ts`: trauma² shake on smooth noise, directional kick, zoom punch, hit-stop (dunk 70 ms, block 60, truck 90, INT 50, green 40, posterize 90, big hit 80) through the same accumulator path as slow motion; pooled pixel particles (sweat, sparks, team-colour confetti) on their own PRNG. `juice.test.ts` plays a seeded NBA game and NFL game with and without it on uneven frame times: identical results. Reduced motion: no shake/zoom, hit-stop ≤ 30 ms, few confetti.
- NBA dunk tiers (`dunkStyle`, `poses.ts`): windmill (or a 360 for some) at DNK 92+/VRT 85+, tomahawk at DNK 85+/VRT 75+, two-hand power for STR 80+ bigs 6'9"+, one/two hands otherwise, through-contact for Posterizer; rim hang after a posterizer or a STR 85+/DNK 92+ slam.
- Ball squash on the dribble, stretch in flight; SPD 92+ afterimage at full stride (both sports, NFL with the ball).
- Heavier builds run with a wider base and slower cadence; fast men lean into a sprint (`pixel/style.ts` on the mocap joints).
- NFL catches: high-point leap for SPC 85+ on high balls, bobble for CTH under 70, catch-in-stride clip when moving (existing).
- Badge/ability pops over the head.
- iOS haptics fire inside the pointer handlers (WebKit bug 285120: the switch-toggle haptic needs a user gesture); loop-side haptics play within a recent gesture or on the next touch, one tick.

## Validation
`npm run typecheck`; full `npm test` both sports; `npm run build`; QA scripts `gameplay.mjs`, `core-gameplay.mjs`, `rushing.mjs`, `joystick.mjs` pass on the dev server; a frame-by-frame render bench and 390×844 recordings checked the dunk styles, trail, pops and particles. New tests: `hoops2/ratings-matter.test.ts`, `football2/ratings-matter.test.ts`, `juice.test.ts`.

Sources: NBA 2K26 badge requirements (Destructoid, nba2klab.com), Madden ability/X-Factor "zone" model, Eiserloh "Juicing Your Cameras With Math" (GDC 2016), Nijman "The Art of Screenshake", WebKit bug 285120.
