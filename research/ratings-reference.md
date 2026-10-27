# Ratings Reference: NBA 2K and Madden calibration notes

Compiled 2026-10-27, when the current editions were **NBA 2K27** (launched Sept 2026) and **Madden NFL 27** (launched Aug 2026).
These notes help Perfect Season rate real players on a 0-99 scale that fans recognize. They are **not** a copy of either game's database. The file holds:

- a modest sample of publicly reported overall ratings, to use as anchors,
- the names of the attributes each game uses,
- summary statistics about how ratings are distributed,
- plain-language descriptions of the mechanics.

Confidence flags used throughout:

- **(s)**: the figure came from a search-engine summary of the page, not from a direct read. Treat it as lower confidence.
- **(fan)**: the figure comes from a fan-compiled database, not from the publisher.
- **(?)**: the sources conflict, or I could not verify the figure.

All other figures were read directly from the cited page.

---

## 1. Attribute vocabularies

### 1a. NBA 2K attributes (NBA 2K26 MyPLAYER/roster set)

The names and meanings below follow the in-game hover text as reproduced at [hoopsgamers.com/nba-2k26-attributes](https://hoopsgamers.com/nba-2k26-attributes) (B21). Wording is condensed.

| Group | Attribute | What it does in-game |
|---|---|---|
| Finishing | **Close Shot** | Makes shots while standing still out to about 10 ft. Also used for post hooks and for standing alley-oop and putback layups. |
| Finishing | **Driving Layup** | Makes regular, contact, alley-oop and putback layups while moving toward the rim. |
| Finishing | **Driving Dunk** | Makes the same set of dunk types while on the move. Also gates which dunk packages a player can use. |
| Finishing | **Standing Dunk** | Makes dunks from a standing position under the basket, the typical big-man finish. |
| Finishing | **Post Control** | Success of spins, drives and drop steps from the post. Combined with Strength and size, it decides who wins back-downs. |
| Shooting | **Mid-Range Shot** | Makes jumpers of all types from mid-range, including post fadeaways. |
| Shooting | **Three-Point Shot** | Makes jumpers of all types from three. |
| Shooting | **Free Throw** | Makes free throws. |
| Shooting (older/hidden) | **Shot IQ** (?) | Appears on full ratings sheets of roughly the 2K19-2K24 era. It governs how well a player picks good shots (mainly CPU logic) and is not a MyPLAYER build slider in 2K26. **Uncertain for 2K26/27.** |
| Playmaking | **Pass Accuracy** | Puts bounce, chest, lob, overhead, flashy and alley-oop passes on target. |
| Playmaking | **Ball Handle** | Which dribble moves are available, how well they chain, and how well the ball is protected from steals. |
| Playmaking | **Speed With Ball** | Run and sprint speed while dribbling. |
| Defense | **Interior Defense** | Guarding the paint on and off the ball, and contesting shots near the rim. |
| Defense | **Perimeter Defense** | Guarding the perimeter on and off the ball, and contesting outside shots. |
| Defense | **Steal** | Intercepting or deflecting passes, and stealing from ball-handlers. |
| Defense | **Block** | Chance to block shots of all types. |
| Rebounding | **Offensive Rebound / Defensive Rebound** | Grabbing boards. Together with Vertical, unlocks rebound animations and helps box-outs. |
| Physicals | **Speed** | Run and sprint speed without the ball. |
| Physicals | **Agility** (some older editions: **Acceleration** (?)) | Lateral defensive movement, off-ball launches and cuts. |
| Physicals | **Strength** | Wins contact battles, both in post play and on drives. |
| Physicals | **Vertical** | Gates dunk animations. Helps rebounds and blocks. |
| Physicals | **Stamina** | How quickly the player tires, including from contact and dribble moves. |
| Hidden, older sheets (?) | Draw Foul, Hands, Pass IQ, Pass Vision, Pass Perception, Help Defense IQ, Lateral Quickness, Offensive/Defensive Consistency, Hustle, Intangibles, Overall Durability, Potential | These appear on full 2K ratings sheets from about 2K20-2K24. They are mostly CPU-behavior or sim-only ratings, not player-adjustable. **Exact presence in 2K26/27 is unverified.** |

**Badges** are perk tiers layered on top of attributes. The tiers are Bronze, Silver, Gold, Hall of Fame and, since 2K25, **Legend** (B22). Each tier unlocks once the player meets attribute thresholds. The 2K25/2K26 set has about 40 badges (B22):

- **Shooting:** Deadeye (smaller contest penalty), **Limitless Range** (shoots effectively from deep), Mini Marksman, Set Shot Specialist, Shifty Shooter.
- **Inside:** **Posterizer** ("increases the chances of throwing down a dunk on your defender", i.e. contact dunks), Rise Up (standing dunks and posters in the paint), Physical Finisher (contact layups), Aerial Wizard, Float Game, Hook Specialist, Layup Mixmaster, Paint Prodigy, Post Fade Phenom, Post Powerhouse, Post-Up Poet.
- **Playmaking:** Ankle Assassin, Bail Out, Break Starter, Dimer, Handles for Days, Lightning Launch, Strong Handle, Unpluckable, Versatile Visionary.
- **Defense:** **On-Ball Menace** (perimeter hounding and body-ups), Challenger (perimeter contests), Glove (strips), Interceptor, High-Flying Denier, Immovable Enforcer, Off-Ball Pest, Paint Patroller (rim protection), Pick Dodger, Post Lockdown.
- **Rebounding:** Boxout Beast, Rebound Chaser.
- **General:** Brick Wall, Slippery Off-Ball, Pogo Stick.

Two badge names from older games map onto the current set:

- **Clamps** is the classic perimeter-lockdown badge from the 2K19-2K24 era. Its role is now covered by **On-Ball Menace** (my reading; not confirmed by a primary source) (?).
- The older "Contact Finisher" maps to **Physical Finisher**.

Example tier gates in 2K26 (s), from [destructoid](https://www.destructoid.com/all-nba-2k26-badge-requirements-for-every-build/) and nba2kw:

- **Posterizer:** Bronze needs Driving Dunk 73 and Vertical 65. Legend needs Driving Dunk 99 and Vertical 90.
- **Limitless Range:** Three-Point Shot of 83 / 89 / 93 / 96 / 99 for Bronze through Legend.
- **On-Ball Menace:** Bronze needs Perimeter Defense 74 and Agility 70. Legend needs Perimeter Defense 99 and Agility 86. Capped at 6'10".

> Design takeaway: badges act as **threshold perks** that sit on top of linear attributes. For example, "if 3PT ≥ 89, deep threes don't get a range penalty." This is an easy pattern to copy in an arcade game.

### 1b. Madden attributes (Madden NFL 27 ratings set)

The attribute keys below are the ones shown on EA's official ratings site ([ea.com/games/madden-nfl/ratings](https://www.ea.com/games/madden-nfl/ratings), F3). Its table columns are OVR, SPD, STR, AGI, COD, INJ and AWR, and each player card shows the full set. The descriptions are standard community and EA-style definitions, condensed:

- The BCV, POW, RLS and PRC wording follows an EA breakdown reposted for Madden 15 (s).
- The accuracy distance bands come from the [Madden wiki](https://madden.fandom.com/wiki/Attributes) (s).

| Group | Attribute (abbr.) | Meaning | Matters most for |
|---|---|---|---|
| Athletic | Speed (SPD) | Top speed. | Everyone. Dominant for WR, CB, HB. |
| Athletic | Acceleration (ACC) | How quickly the player reaches top speed. | CB, WR, HB, edge rushers. |
| Athletic | Agility (AGI) | Quickness and cutting. | HB, WR, CB. |
| Athletic | Change of Direction (COD) | Sharpness of cuts and breaks. | WR, HB, CB. |
| Athletic | Strength (STR) | Wins blocks and sheds, trucking, and contested balls. | OL, DL, TE, power HB. |
| Athletic | Jumping (JMP) | Leap height for catches and deflections. | WR, CB, TE. |
| Athletic | Stamina, Injury, Toughness (STA/INJ/TGH) | Fatigue, injury resistance, and playing through injury. | Sim/durability only. |
| Mental | Awareness (AWR) | Reaction and processing. The CPU uses it to read and react correctly, and it feeds almost every position's overall. | All, especially QB, S, LB, K. |
| QB | Throw Power (THP) | Maximum distance and ball velocity. | QB |
| QB | Short / Medium / Deep Accuracy (SAC/MAC/DAC) | Accuracy under 20 yards, 20-40 yards, and over 40 yards. | QB |
| QB | Throw on the Run (TOR) | Accuracy when outside the pocket and moving. | Mobile QB |
| QB | Throw Under Pressure (TUP) | Accuracy when defenders are closing in. | QB |
| QB | Play Action (PAC), Break Sack (BSK) | How well the fake sells the play; chance to escape sack attempts. | QB |
| Receiving | Catching (CTH) | Securing routine catches. | WR, TE, HB |
| Receiving | Catch in Traffic (CIT) | Possession catches while being hit. | Slot WR, TE |
| Receiving | Spectacular Catch (SPC) | Highlight one-handed and diving catches. | Deep-threat WR |
| Receiving | Short / Medium / Deep Route Running (SRR/MRR/DRR) | Crispness of route breaks at each depth, which creates separation. | WR, TE |
| Receiving | Release (RLS) | Beating press coverage at the line. | WR, TE |
| Ball carrier | Carrying (CAR) | Fumble resistance. | HB, QB |
| Ball carrier | Ball Carrier Vision (BCV) | Finding and hitting holes (in user play, the CPU blocking/hole logic). | HB |
| Ball carrier | Break Tackle (BTK) | Chance to break the first contact. | HB, TE |
| Ball carrier | Juke Move (JKM), Spin Move (SPM) | Success of elusive moves. | HB, WR |
| Ball carrier | Stiff Arm (SFA), Trucking (TRK) | Success of power moves. | Power HB, TE |
| Blocking | Run Block (RBK) + Power (RBP) / Finesse (RBF) | Run blocking overall, plus power vs. finesse variants. | OL, TE, FB |
| Blocking | Pass Block (PBK) + Power (PBP) / Finesse (PBF) | Pass protection, split by type of rush faced. | OL |
| Blocking | Impact Blocking (IBL), Lead Block (LBK) | Pancakes and second-level blocks; FB lead blocking. | OL, FB |
| Defense | Tackle (TAK) | Wrap-up tackle success. | LB, S, DL |
| Defense | Hit Power (POW) | Hit force, including fumble and injury chance. | S, LB |
| Defense | Pursuit (PUR) | Pursuit angles and chasing down ball carriers. | LB, S |
| Defense | Play Recognition (PRC) | Reading run vs. pass, play action and screens. | LB, S, DL |
| Defense | Man Coverage (MCV), Zone Coverage (ZCV), Press (PRS) | Coverage skills by scheme; jamming at the line. | CB, S, LB |
| Defense | Power Moves (PMV), Finesse Moves (FMV), Block Shedding (BSH) | Pass-rush move success and getting off blocks. | DL, edge |
| Special teams | Kick Power (KPW), Kick Accuracy (KAC), Kick Return (RET) | Leg strength, accuracy, and return ability. | K, P, KR |

**Abilities.** Madden layers abilities on top of attributes. Superstar abilities have existed since Madden 20.

- **Superstar abilities** are always on. Examples from EA's M27 cards (F3): "Mid In Elite" means more consistent catches 10-20 yards downfield inside the numbers; "Juke Box" gives steerable jukes; "Edge Threat" means faster pass-rush moves from the edge.
- **X-Factors** are zone abilities. The player must meet an in-game **trigger** to enter "the zone", such as two catches of 20+ yards or three straight completions. A **knockout** condition, such as consecutive incompletions, drops him back out ([Game Informer 2019](https://www.gameinformer.com/2019/04/25/madden-20s-new-ability-system-spotlights-the-leagues-superstars) (s); [Muthead M21](https://www.muthead.com/news/madden-nfl-21-superstar-x-factor-quarterbacks/) (s)).

Current X-Factor examples, as described on EA's M27 ratings cards (F3):

| X-Factor | Example player | Effect in the zone |
|---|---|---|
| Bazooka | Josh Allen | Maximum throw distance increased. |
| Dots | Stafford | Elite accuracy on all passes. |
| Run & Gun | Burrow | Elite accuracy on the run. |
| Pro Reads | Maye | First open receiver highlighted; ignores pressure. |
| Truzz | Lamar Jackson | No fumbles. |
| Double Me | Chase | Aggressive catches won against single coverage. |
| Freight Train | J. Taylor | Higher chance to break the next tackle. |
| First One Free | Bijan Robinson | Next juke, spin or hurdle more likely to fake the defender out. |
| YAC 'Em Up | McBride | Nearly guaranteed to break the first tackle after the catch. |
| Unstoppable Force | Garrett | Higher win rate against one-on-one pass blocks. |
| Relentless | Crosby | Rush moves cost nothing. |
| Fearmonger | Heyward | Pressures the QB even while engaged with a blocker. |
| Momentum Shift | Chris Jones | Knocks all opponents out of the zone. |
| Shutdown | Surtain | Tighter coverage and more interceptions on contested catches. |
| Universal Coverage | C. Gonzalez | Nearly guaranteed knockouts of the ball. |
| Bottleneck | Ramsey | Wins man-press encounters. |
| Reinforcement | Derwin James | Higher chance to beat run blocks and to break up catches with tackles. |

**46 of the top 100 players in M27 (Week 6) carry an X-Factor (F3).** In practice, X-Factor ≈ the top 2-3% of the league.

> Design takeaway: Madden overall is **position-specific**. A 99-speed kicker is not a good kicker. See §3c for fitted weights.

---

## 2. Reference overall ratings

Tier key:

- **S** = 90+
- **A** = 80-89
- **B** = 70-79
- **C** = below 70

The source IDs in each row are resolved to URLs in §2c.

Rating context to keep in mind when reading the tables:

- Launch ratings reflect the **previous** season. For example, NBA 2K27 launch ratings reflect 2025-26 play, and Madden 27 launch ratings reflect the 2025 season.
- Both games re-rate players during the season.
- Classic, all-time and all-decade versions are frozen "peak" versions of those players.

### 2a. NBA (130 data points)

**Modern era: NBA 2K27 launch ratings (season 2026-27; top-100 list published Aug 18, 2026)**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 1 | Shai Gilgeous-Alexander | PG | 2K27 launch | 97 | S | B1 |
| 2 | Victor Wembanyama | C | 2K27 launch | 97 | S | B1 |
| 3 | Nikola Jokić | C | 2K27 launch | 97 | S | B1 |
| 4 | Luka Dončić | PG | 2K27 launch | 96 | S | B1 |
| 5 | Jalen Brunson | PG | 2K27 launch | 96 | S | B1 |
| 6 | Giannis Antetokounmpo | PF | 2K27 launch | 96 | S | B1 |
| 7 | Anthony Edwards | SG | 2K27 launch | 95 | S | B1 |
| 8 | Cade Cunningham | PG | 2K27 launch | 94 | S | B1 |
| 9 | Stephen Curry | PG | 2K27 launch | 93 | S | B1 |
| 10 | Kevin Durant | PF | 2K27 launch | 93 | S | B1 |
| 11 | Tyrese Maxey | PG | 2K27 launch | 92 | S | B1 |
| 12 | LeBron James | SF | 2K27 launch | 91 | S | B1 |
| 13 | Joel Embiid | C | 2K27 launch | 91 | S | B1 |
| 14 | Anthony Davis | PF/C | 2K27 launch | 90 | S | B1 |
| 15 | Jamal Murray | PG | 2K27 launch | 89 | A | B1 |
| 16 | Austin Reaves | SG | 2K27 launch | 88 | A | B1 |
| 17 | James Harden | PG | 2K27 launch | 87 | A | B1 |
| 18 | Cooper Flagg (2nd yr) | F | 2K27 launch | 87 | A | B1 |
| 19 | Damian Lillard | PG | 2K27 launch | 86 | A | B1 |
| 20 | Dylan Harper (2nd yr) | G | 2K27 launch | 85 | A | B1 |
| 21 | Rudy Gobert | C | 2K27 launch | 84 | A | B1 |
| 22 | Ja Morant | PG | 2K27 launch | 84 | A | B1 |
| 23 | Derrick White | SG | 2K27 launch | 83 | A | B1 |
| 24 | Paul George | SF | 2K27 launch | 82 | A | B1 |
| 25 | Alex Caruso | SG | 2K27 launch | 81 | A | B1 |
| 26 | Walker Kessler (rank #100) | C | 2K27 launch | 81 | A | B1 |

**NBA 2K27 role players and deep bench (full team lists published Sept 5-6, 2026)**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 27 | Jalen Johnson (Hawks best) | F | 2K27 launch | 87 | A | B4 |
| 28 | Nic Claxton | C | 2K27 launch | 80 | A | B3 |
| 29 | Tre Jones | PG | 2K27 launch | 79 | B | B3 |
| 30 | Luguentz Dort | G/F | 2K27 launch | 78 | B | B4 |
| 31 | Caleb Wilson (rookie, #4 pick) | F | 2K27 launch | 77 | B | B3 |
| 32 | Isaac Okoro | G/F | 2K27 launch | 75 | B | B3 |
| 33 | Buddy Hield | SG | 2K27 launch | 74 | B | B4 |
| 34 | Patrick Williams | F | 2K27 launch | 74 | B | B3 |
| 35 | Kingston Flemings | G | 2K27 launch | 74 | B | B4 |
| 36 | Rob Dillingham | PG | 2K27 launch | 73 | B | B3 |
| 37 | Corey Kispert | F | 2K27 launch | 73 | B | B4 |
| 38 | Noa Essengue | F | 2K27 launch | 72 | B | B3 |
| 39 | Jalen Wilson | F | 2K27 launch | 71 | B | B4 |
| 40 | RayJ Dennis | G | 2K27 launch | 69 | C | B4 |
| 41 | Tobe Awaka | F | 2K27 launch | 68 | C | B3 |
| 42 | Keshon Gilbert (Hawks lowest) | G | 2K27 launch | 68 | C | B4 |

**NBA 2K26 launch ratings (season 2025-26)**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 43 | Nikola Jokić | C | 2K26 launch | 98 | S | B2 |
| 44 | Shai Gilgeous-Alexander | PG | 2K26 launch | 98 | S | B2 |
| 45 | Giannis Antetokounmpo | PF | 2K26 launch | 97 | S | B2 |
| 46 | Jayson Tatum | SF | 2K26 launch | 94 | S | B2 |
| 47 | Tyrese Haliburton | PG | 2K26 launch | 93 | S | B2 |
| 48 | Kawhi Leonard | SF | 2K26 launch | 92 | S | B2 |
| 49 | Trae Young | PG | 2K26 launch | 90 | S | B2 |
| 50 | Kyrie Irving | PG | 2K26 launch | 90 | S | B2 |
| 51 | Bam Adebayo | C | 2K26 launch | 88 | A | B2 |
| 52 | Zion Williamson | PF | 2K26 launch | 87 | A | B2 |
| 53 | Jimmy Butler | F | 2K26 launch | 87 | A | B2 |
| 54 | Cooper Flagg (rookie) | F | 2K26 launch | 82 | A | B2 |
| 55 | Draymond Green | F | 2K26 launch | 81 | A | B2 |
| 56 | Bobby Portis Jr. (rank #100) | F | 2K26 launch | 81 | A | B2 |
| 57 | Nic Claxton | C | 2K26 (Aug 29, 2025 list) | 79 | B | B5 |
| 58 | Terance Mann | G | 2K26 | 75 | B | B5 |
| 59 | Haywood Highsmith | F | 2K26 | 73 | B | B5 |
| 60 | Egor Demin (rookie) | G | 2K26 | 72 | B | B5 |
| 61 | Drake Powell (rookie) | G/F | 2K26 | 70 | B | B5 |
| 62 | Ben Saraf (rookie, Nets lowest) | G | 2K26 | 69 | C | B5 |

**Edition peaks across the series (HoopsHype compilation, published Aug 23, 2026).** These are each player's highest rating and the edition it came in. Early editions (2K1-2K9) ran "hotter" at the top, with more 99s, so do not treat those numbers as equivalent to modern 99s.

| # | Player | Pos | Edition (season) | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 63 | Allen Iverson | SG | NBA 2K (1999-00) | 97 | S | B6 |
| 64 | Kevin Garnett | PF | 2K1 (2000-01) | 99 | S | B6 |
| 65 | Gary Payton | PG | 2K1 (2000-01) | 97 | S | B6 |
| 66 | Jason Kidd | PG | 2K1 (2000-01) | 96 | S | B6 |
| 67 | Karl Malone | PF | 2K1 (2000-01) | 95 | S | B6 |
| 68 | Shaquille O'Neal | C | 2K2 (2001-02) | 99 | S | B6 |
| 69 | Chris Webber | PF | 2K2 (2001-02) | 95 | S | B6 |
| 70 | Michael Jordan (Wizards-era peak) | SG | 2K2 (2001-02) | 93 | S | B6 |
| 71 | Tim Duncan | PF | 2K4 (2003-04) | 99 | S | B6 |
| 72 | Tracy McGrady | SG | 2K5 (2004-05) | 98 | S | B6 |
| 73 | Kobe Bryant | SG | 2K5 (2004-05) | 99 | S | B6 |
| 74 | Dwyane Wade | SG | 2K7 (2006-07) | 98 | S | B6 |
| 75 | Chris Paul | PG | 2K9 (2008-09) | 99 | S | B6 |
| 76 | LeBron James | SF | 2K14 (2013-14) | 99 | S | B6 |
| 77 | Kevin Durant | SF | 2K19 (2018-19) | 97 | S | B6 |
| 78 | Kawhi Leonard | SF | 2K20 (2019-20) | 97 | S | B6 |
| 79 | Stephen Curry | PG | 2K22 (2021-22) | 96 | S | B6 |
| 80 | Luka Dončić | PG | 2K25 (2024-25) | 97 | S | B6 |

**Rookie-year anchors for future stars (Fadeaway World, Aug 2020).** These are useful as "unknown young player" floors.

| # | Player | Pos | Edition (season) | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 81 | Giannis Antetokounmpo | F | 2K14 (2013-14) | 60 | C | B7 |
| 82 | Stephen Curry | PG | 2K10 (2009-10) | 65 | C | B7 |
| 83 | Pascal Siakam | F | 2K17 (2016-17) | 67 | C | B7 |
| 84 | Nikola Jokić | C | 2K16 (2015-16) | 68 | C | B7 |
| 85 | Kawhi Leonard | SF | 2K12 (2011-12) | 76 | B | B7 |
| 86 | Kevin Durant | SF | 2K8 (2007-08) | 80 | A | B7 |

LeBron James's lowest rating was 78, as a rookie in 2K4 (s) (B6). Fadeaway labels it 2K3 (?).

**Classic teams (pre-2000 anchors).** All values are from NBA 2K19, in which classic-team ratings are frozen. These rows show full rotations, so role players from past eras get anchors too.

| # | Player | Pos | Team / season (NBA 2K19) | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 87 | Michael Jordan | SG | 1995-96 Bulls | 99 | S | B8 |
| 88 | Scottie Pippen | SF | 1995-96 Bulls | 93 | S | B8 |
| 89 | Dennis Rodman | PF | 1995-96 Bulls | 86 | A | B8 |
| 90 | Toni Kukoč | SF | 1995-96 Bulls | 80 | A | B8 |
| 91 | Ron Harper | PG | 1995-96 Bulls | 78 | B | B8 |
| 92 | Luc Longley | C | 1995-96 Bulls | 74 | B | B8 |
| 93 | Steve Kerr | PG | 1995-96 Bulls | 73 | B | B8 |
| 94 | Bill Wennington | C | 1995-96 Bulls | 67 | C | B8 |
| 95 | Larry Bird | SF/PF | 1985-86 Celtics | 97 | S | B9 |
| 96 | Kevin McHale | PF | 1985-86 Celtics | 90 | S | B9 |
| 97 | Robert Parish | C | 1985-86 Celtics | 85 | A | B9 |
| 98 | Danny Ainge | SG | 1985-86 Celtics | 78 | B | B9 |
| 99 | Bill Walton (6th man) | C | 1985-86 Celtics | 76 | B | B9 |
| 100 | Jerry Sichting | G | 1985-86 Celtics | 67 | C | B9 |
| 101 | Magic Johnson | PG | 1986-87 Lakers | 98 | S | B11 |
| 102 | Kareem Abdul-Jabbar (age 39) | C | 1986-87 Lakers | 92 (?) | S | B11 |
| 103 | James Worthy | SF | 1986-87 Lakers | 84 | A | B11 |
| 104 | Kurt Rambis | PF | 1986-87 Lakers | 72 | B | B11 |
| 105 | Isiah Thomas | PG | 1988-89 Pistons | 89 | A | B12 |
| 106 | Joe Dumars | SG | 1988-89 Pistons | 88 | A | B12 |
| 107 | Bill Laimbeer | C | 1988-89 Pistons | 80 | A | B12 |
| 108 | John Salley | PF | 1988-89 Pistons | 69 | C | B12 |
| 109 | Bill Russell | C | 1964-65 Celtics | 96 | S | B13 |
| 110 | Sam Jones | SG | 1964-65 Celtics | 89 | A | B13 |
| 111 | John Havlicek (young) | F | 1964-65 Celtics | 84 | A | B13 |
| 112 | John Thompson | C | 1964-65 Celtics | 66 | C | B13 |
| 113 | Kareem Abdul-Jabbar | C | 1970-71 Bucks | 97 | S | B15 |
| 114 | Oscar Robertson | PG | 1970-71 Bucks | 94 | S | B15 |
| 115 | Karl Malone | PF | 1997-98 Jazz | 91 | S | B14 |
| 116 | John Stockton | PG | 1997-98 Jazz | 90 | S | B14 |
| 117 | Jeff Hornacek | SG | 1997-98 Jazz | 81 | A | B14 |
| 118 | Greg Ostertag | C | 1997-98 Jazz | 69 | C | B14 |
| 119 | Shaquille O'Neal | C | 2000-01 Lakers | 97 | S | B10 |
| 120 | Kobe Bryant | SG | 2000-01 Lakers | 95 | S | B10 |
| 121 | Robert Horry | PF | 2000-01 Lakers | 74 | B | B10 |

Note on row 102: the article's heading says Kareem is 93, while its table says 92.

**All-time and all-decade teams (franchise and decade "best versions").** These ratings are compressed toward the top because every player on these rosters is a franchise great.

| # | Player | Pos | Team / edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 122 | Wilt Chamberlain | C | All-Time Warriors, 2K18 | 98 | S | B16 |
| 123 | Hakeem Olajuwon | C | All-Time Rockets, 2K18 | 98 | S | B16 |
| 124 | Julius Erving | SF | All-Time 76ers, 2K18 | 94 | S | B16 |
| 125 | Patrick Ewing | C | All-Time Knicks, 2K18 | 95 | S | B16 |
| 126 | Steve Kerr | PG | All-Time Bulls, 2K18 | 81 | A | B16 |
| 127 | Robert Horry | PF | All-Time Rockets, 2K18 | 81 | A | B16 |
| 128 | Moses Malone | C | 1980s All-Decade, 2K20 | 97 | S | B17 |
| 129 | Dominique Wilkins | SF | 1980s All-Decade, 2K20 | 94 | S | B17 |
| 130 | Dirk Nowitzki | PF | 2000s All-Decade, 2K20 | 98 | S | B17 |

Further context:

- **2K18 all-time teams** (B16): only Jordan (Bulls), LeBron, Kareem (Bucks version) and Magic reached 99. Bird and Russell were 98, and the Lakers version of Kareem was 96.
- **2K20 all-decade teams** (B17): Oscar Robertson (60s), Kareem (70s), Magic and Bird (80s), Jordan (90s), and Kobe and Duncan (00s) were all 99.

### 2b. NFL (128 data points)

**Madden NFL 27 launch ratings (2026 season). Reveal published July 29, 2026 (B/R) and EA's ratings overview.**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 1 | Matthew Stafford | QB | M27 launch | 99 | S | F2 |
| 2 | Josh Allen | QB | M27 launch | 99 | S | F2 |
| 3 | Joe Burrow | QB | M27 launch | 97 | S | F2 |
| 4 | Lamar Jackson | QB | M27 launch | 94 | S | F2 |
| 5 | Patrick Mahomes | QB | M27 launch | 93 | S | F2 |
| 6 | Drake Maye | QB | M27 launch | 92 | S | F2 |
| 7 | Dak Prescott | QB | M27 launch | 91 | S | F2 |
| 8 | Caleb Williams | QB | M27 launch | 90 | S | F2 |
| 9 | Jared Goff (QB10) | QB | M27 launch | 88 | A | F2 |
| 10 | Fernando Mendoza (top rookie QB) | QB | M27 launch | 74 | B | F1 |
| 11 | Kirk Cousins | QB | M27 launch | 73 | B | F1 |
| 12 | Ja'Marr Chase | WR | M27 launch | 99 | S | F2 |
| 13 | Jaxon Smith-Njigba | WR | M27 launch | 99 | S | F2 |
| 14 | Puka Nacua | WR | M27 launch | 98 | S | F2 |
| 15 | Amon-Ra St. Brown | WR | M27 launch | 95 | S | F2 |
| 16 | Justin Jefferson | WR | M27 launch | 94 | S | F2 |
| 17 | CeeDee Lamb | WR | M27 launch | 93 | S | F2 |
| 18 | Terry McLaurin | WR | M27 launch | 91 | S | F2 |
| 19 | Jahmyr Gibbs | HB | M27 launch | 98 | S | F2 |
| 20 | Christian McCaffrey | HB | M27 launch | 97 | S | F2 |
| 21 | Jonathan Taylor | HB | M27 launch | 96 | S | F2 |
| 22 | Bijan Robinson | HB | M27 launch | 95 | S | F2 |
| 23 | Derrick Henry | HB | M27 launch | 93 | S | F2 |
| 24 | Saquon Barkley | HB | M27 launch | 92 | S | F2 |
| 25 | Kyren Williams (HB10) | HB | M27 launch | 89 | A | F2 |
| 26 | De'Von Achane | HB | M27 launch | 88 | A | F1 |
| 27 | Jeremiyah Love (top rookie) | HB | M27 launch | 82 | A | F1 |
| 28 | Tyler Allgeier | HB | M27 launch | 81 | A | F1 |
| 29 | Trey McBride | TE | M27 launch | 99 | S | F2 |
| 30 | George Kittle | TE | M27 launch | 96 | S | F2 |
| 31 | Brock Bowers | TE | M27 launch | 93 | S | F2 |
| 32 | Travis Kelce | TE | M27 launch | 91 | S | F2 |
| 33 | Sam LaPorta | TE | M27 launch | 88 | A | F2 |
| 34 | Colston Loveland (TE10) | TE | M27 launch | 84 | A | F2 |
| 35 | Myles Garrett | DE/edge | M27 launch | 99 | S | F1 |
| 36 | Lane Johnson | RT | M27 launch | 97 | S | F1 |
| 37 | DeForest Buckner | DT | M27 launch | 91 | S | F1 |
| 38 | Aaron Brewer | C | M27 launch | 90 | S | F1 |
| 39 | Patrick Paul | LT | M27 launch | 80 | A | F1 |
| 40 | Rueben Bain Jr. (rookie) | edge | M27 launch | 80 | A | F1 |

**Madden NFL 27, Week 6 in-season ratings (EA official ratings site, read 2026-10-27)**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 41 | Fred Warner | MIKE LB | M27 Wk6 | 98 | S | F3 |
| 42 | Christian Gonzalez | CB | M27 Wk6 | 98 | S | F3 |
| 43 | Micah Parsons | edge (REDG) | M27 Wk6 | 98 | S | F3 |
| 44 | Penei Sewell | LT | M27 Wk6 | 98 | S | F3 |
| 45 | Pat Surtain II | CB | M27 Wk6 | 97 | S | F3 |
| 46 | Trent Williams | LT | M27 Wk6 | 97 | S | F3 |
| 47 | Maxx Crosby | edge (LEDG) | M27 Wk6 | 97 | S | F3 |
| 48 | Creed Humphrey | C | M27 Wk6 | 96 | S | F3 |
| 49 | Derrick Brown | DT | M27 Wk6 | 96 | S | F3 |
| 50 | Joe Thuney | LG | M27 Wk6 | 96 | S | F3 |
| 51 | Quinn Meinerz | RG | M27 Wk6 | 96 | S | F3 |
| 52 | T.J. Watt | edge (LEDG) | M27 Wk6 | 96 | S | F3 |
| 53 | Kyle Hamilton | SS | M27 Wk6 | 94 | S | F3 |
| 54 | Jessie Bates III | FS | M27 Wk6 | 94 | S | F3 |
| 55 | Denzel Ward | CB | M27 Wk6 | 94 | S | F3 |
| 56 | Roquan Smith | MIKE LB | M27 Wk6 | 93 | S | F3 |
| 57 | Zack Baun | WILL LB | M27 Wk6 | 93 | S | F3 |
| 58 | Minkah Fitzpatrick | SS | M27 Wk6 | 90 | S | F3 |
| 59 | Quinyon Mitchell | CB | M27 Wk6 | 90 | S | F3 |
| 60 | Drue Tranquill | WILL LB | M27 Wk6 | 89 | A | F3 |
| 61 | Brandon Aubrey (top K) | K | M27 Wk6 | 86 | A | F6 |
| 62 | Chris Boswell | K | M27 Wk6 | 85 | A | F6 |
| 63 | Nick Folk | K | M27 Wk6 | 83 | A | F6 |
| 64 | Harrison Butker | K | M27 Wk6 | 80 | A | F6 |
| 65 | Tyler Bass | K | M27 Wk6 | 74 | B | F6 |
| 66 | Blake Grupe (lowest K listed) | K | M27 Wk6 | 73 | B | F6 |
| 67 | Michael Dickson (top P) | P | M27 Wk6 | 85 | A | F7 |
| 68 | Tress Way | P | M27 Wk6 | 74 | B | F7 |

**Madden NFL 27 Week 6 role players and depth (EA team pages for Buffalo, a strong team, and Miami, a weak one)**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 69 | Jordyn Brooks | WILL LB | M27 Wk6 (MIA) | 87 | A | F5 |
| 70 | Zach Sieler | DT | M27 Wk6 (MIA) | 83 | A | F5 |
| 71 | Christian Benford | CB | M27 Wk6 (BUF) | 80 | A | F4 |
| 72 | Cole Bishop | FS | M27 Wk6 (BUF) | 79 | B | F4 |
| 73 | Bradley Chubb | edge | M27 Wk6 (BUF) | 78 | B | F4 |
| 74 | Keon Coleman | WR | M27 Wk6 (BUF) | 77 | B | F4 |
| 75 | Dawson Knox | TE | M27 Wk6 (BUF) | 76 | B | F4 |
| 76 | Ty Johnson | HB | M27 Wk6 (BUF) | 76 | B | F4 |
| 77 | Damar Hamlin | FS | M27 Wk6 (BUF) | 73 | B | F4 |
| 78 | Malik Willis (backup) | QB | M27 Wk6 (MIA) | 72 | B | F5 |
| 79 | Kyle McCord (backup) | QB | M27 Wk6 (MIA) | 65 | C | F5 |
| 80 | Tylan Grable (backup) | RT | M27 Wk6 (BUF) | 63 | C | F4 |
| 81 | Andrew Meyer (backup) | C | M27 Wk6 (MIA) | 62 | C | F5 |
| 82 | Kyle Allen (backup) | QB | M27 Wk6 (BUF) | 60 | C | F4 |
| 83 | Tucker Addington | LS | M27 Wk6 (MIA) | 56 | C | F5 |

**Madden NFL 26 launch ratings (2025 season; reveal published July 31, 2025)**

| # | Player | Pos | Edition | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 84 | Lamar Jackson | QB | M26 launch | 99 | S | F8 |
| 85 | Saquon Barkley | HB | M26 launch | 99 | S | F8 |
| 86 | Justin Jefferson | WR | M26 launch | 99 | S | F8 |
| 87 | Lane Johnson | RT | M26 launch | 99 | S | F8 |
| 88 | Derrick Henry | HB | M26 launch | 98 (?) | S | F8 |
| 89 | Dexter Lawrence II | DT | M26 launch | 97 | S | F8 |
| 90 | Sauce Gardner | CB | M26 launch | 94 | S | F8 |
| 91 | Budda Baker | SS | M26 launch | 92 | S | F8 |
| 92 | Bobby Wagner | MLB | M26 launch | 91 | S | F8 |
| 93 | Matthew Stafford | QB | M26 launch | 88 | A | F8 |
| 94 | A.J. Cole | P | M26 launch | 85 | A | F8 |
| 95 | Travis Hunter (rookie) | CB | M26 launch | 84 | A | F8 |
| 96 | Ashton Jeanty (rookie) | HB | M26 launch | 83 | A | F8 |
| 97 | Patrick Ricard | FB | M26 launch | 83 | A | F8 |

Note on row 88: ESPN and ABC syndication (F24, (s)) count **8** players at 99 at launch, including Henry. Insider Gaming's reveal list has Henry at 98.

Year-over-year swing: Stafford went from 88 in M26 to 99 in M27, and Lamar Jackson from 99 to 94.

**Historical 99 and 100 Club anchors.** Madden 99 and Madden 2000 allowed a rating of 100; read those as "99". The 99 cap has applied since Madden 2002, and Madden 98 and Madden 2001 had no 99s (F9).

| # | Player | Pos | Edition (season) | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 98 | Barry Sanders | HB | Madden 99 (1998) | 100 | S | F9 |
| 99 | Jerry Rice | WR | Madden 99 (1998) | 100 | S | F9 |
| 100 | Deion Sanders | CB | Madden 99 (1998) | 100 | S | F9 |
| 101 | Shannon Sharpe | TE | Madden 99 (1998) | 100 | S | F9 |
| 102 | Tony Boselli | OT | Madden 99 (1998) | 100 | S | F9 |
| 103 | Reggie White | DE | Madden 99 (1998) | 99 | S | F9 |
| 104 | Bruce Smith | DE | Madden 99 (1998) | 99 | S | F9 |
| 105 | Randall McDaniel | OG | Madden 99 (1998) | 99 | S | F9 |
| 106 | Dermontti Dawson | C | Madden 99 (1998) | 99 | S | F9 |
| 107 | Ken Norton Jr. | MLB | Madden 99 (1998) | 99 | S | F9 |
| 108 | Jason Sehorn | CB | Madden 99 (1998) | 99 | S | F9 |
| 109 | Morten Andersen | K | Madden 99 (1998) | 99 | S | F9 |
| 110 | Mike Alstott | FB | Madden 2000 (1999) | 100 | S | F9 |
| 111 | Matt Turk | P | Madden 2000 (1999) | 99 | S | F9 |
| 112 | Marshall Faulk | HB | Madden 2002 (2001) | 99 | S | F9 |
| 113 | Warren Sapp | DT | Madden 2002 (2001) | 99 | S | F9 |
| 114 | Ray Lewis | MLB | Madden 2002 (2001) | 99 | S | F9 |
| 115 | Brian Dawkins | FS | Madden 2004 (2003) | 99 | S | F9 |
| 116 | Adam Vinatieri | K | Madden 2004 (2003) | 99 | S | F9 |
| 117 | Peyton Manning | QB | Madden 06 (2005) | 99 | S | F9 |
| 118 | Ed Reed | FS | Madden 07 (2006) | 99 | S | F9 |
| 119 | Shane Lechler | P | Madden 07 (2006) | 99 | S | F9 |
| 120 | Darrelle Revis | CB | Madden 11 (2010) | 99 | S | F9 |
| 121 | Calvin Johnson | WR | Madden 13 (2012) | 99 | S | F9 |

**Historical anchors below the 99 tier**

| # | Player | Pos | Edition (season) | OVR | Tier | Src |
|---|---|---|---|---|---|---|
| 122 | Peyton Manning (rookie) | QB | Madden 99 (1998) | 84 (fan) | A | F14 (s) |
| 123 | Kurt Warner (pre-MVP) | QB | Madden 2000 (1999) | 69 (fan) | C | F13 (s) |
| 124 | Kurt Warner (post-MVP) | QB | Madden 2001 (2000) | 96 (fan) | S | F13 (s) |
| 125 | Tom Brady (backup) | QB | Madden 2002 (2001) | 51 | C | F10 |
| 126 | Tom Brady | QB | Madden 2003 (2002) | 84 | A | F10 |
| 127 | Michael Vick | QB | Madden 2004 (2003) | 90 | S | F11 |
| 128 | Tom Brady (age 43) | QB | Madden 21 (2020) | 90 | S | F10 |

Notes on these anchors:

- **Brady's full arc:** 57 (M2001), then 51, 84, 90, 95, 97 and 98 through M07, then 99 in M08 and M09, and 90-99 through M22 (F10).
- **Vick:** EA's ratings lead Donny Moore said that "before Vick, it was unheard-of to talk about a quarterback with 90 speed" ([Kotaku](https://kotaku.com/ten-years-later-michael-vick-would-have-a-harder-time-1022342172), F20). Vick's M2004 ratings were SPD 95 and THP 98, but his accuracy was only 84 (F11).

**About Madden "Legends" and Ultimate Team cards.** Ultimate Team issues several cards per legend, and each card has a different overall. For example, a fan database lists Barry Sanders cards from 89 to 99 and Jerry Rice cards from 86 to 99 ([mut.gg](https://www.mut.gg/players/10890-barry-sanders/23-42010890/) (s); the edition of each card is unverified). These cards follow a power curve tied to the content calendar, **not** the sim rating scale. Use the original-era ratings above as anchors for pre-2000 players instead.

### 2c. Source key

**NBA**

| ID | Source |
|---|---|
| B1 | NBA.com, "NBA 2K27 top 100 player ratings revealed" (Aug 18, 2026): https://www.nba.com/news/nba-2k27-top-100-player-ratings-announced |
| B2 | 2K official, NBA 2K26 Top 100 Player Ratings: https://nba.2k.com/2k26/top-100-players/ |
| B3 | SI, NBA 2K27 Bulls ratings (Sept 5, 2026): https://www.si.com/nba/bulls/onsi/nba-2k27-ratings-how-caleb-wilson-josh-giddey-and-every-bulls-player-rank-5 |
| B4 | SI, NBA 2K27 Hawks ratings (Sept 6, 2026): https://www.si.com/nba/hawks/onsi/nba-2k27-ratings-how-jalen-johnson-kingston-flemings-and-every-hawks-player-rank-01m1vfkmb20r |
| B5 | SI, Evaluating NBA 2K26 ratings for Nets (Aug 29, 2025): https://www.si.com/nba/nets/onsi/news/evaluating-nba-2k26-ratings-for-brooklyn-nets-players |
| B6 | HoopsHype, "NBA 2K: The players with the best average ratings in history" (Aug 23, 2026), as reprinted at https://www.galvnews.com/news_reuters/nation/nba-2k-the-players-with-the-best-average-ratings-in-history/article_fa505848-eac8-5fa6-a323-47cd6d4a0e2e.html |
| B7 | Fadeaway World, "NBA 2K rating history from rookies to superstars" (Aug 15, 2020): https://fadeawayworld.net/nba-2k-rating-history-from-rookies-to-superstars-lebron-james-kevin-durant-stephen-curry |
| B8 | RealSport101, 2K19 1995-96 Bulls: https://realsport101.com/article/nba-2k19-1995-1996-chicago-bulls-player-ratings-and-roster |
| B9 | RealSport101, 2K19 1985-86 Celtics: https://realsport101.com/article/nba-2k19-1985-1986-boston-celtics-player-ratings-and-roster |
| B10 | RealSport101, 2K19 2000-01 Lakers: https://realsport101.com/article/nba-2k19-2000-2001-los-angeles-lakers-player-ratings-and-roster |
| B11 | RealSport101, 2K19 1986-87 Lakers: https://realsport101.com/article/nba-2k19-1986-1987-los-angeles-lakers-player-ratings-and-roster |
| B12 | RealSport101, 2K19 1988-89 Pistons: https://realsport101.com/article/nba-2k19-1988-1989-detroit-pistons-player-ratings-and-roster |
| B13 | RealSport101, 2K19 1964-65 Celtics: https://realsport101.com/article/nba-2k19-1964-1965-boston-celtics-player-ratings-and-roster |
| B14 | RealSport101, 2K19 1997-98 Jazz: https://realsport101.com/article/nba-2k19-1997-1998-utah-jazz-player-ratings-and-roster |
| B15 | RealSport101, 2K19 1970-71 Bucks: https://realsport101.com/article/nba-2k19-1970-1971-milwaukee-bucks-player-ratings-and-roster |
| B16 | Game Informer, NBA 2K18 All-Time rosters (Aug 24, 2017): https://gameinformer.com/games/nba_2k18/b/playstation4/archive/2017/08/24/visual-concepts-reveals-nba-2k18-all-time-rosters-for-each-nba-team.aspx |
| B17 | RealSport101, NBA 2K20 All-Decade teams (Sept 2, 2019): https://realsport101.com/article/breaking-nba-2k20-all-decade-teams-ratings-unveiled-jordan-kareem-shaquille-lebron-bryant-harden-curry-legends-release-date-demo-beta-prelude |
| B18 | DBLTAP, NBA 2K21 classic team overalls (Sept 24, 2020): https://www.dbltap.com/posts/nba-2k21-classic-teams-tiers-and-overall-ratings-01ejyde6te7h |
| B19 | 2K official in-season ratings page (2K26): https://nba.2k.com/2k26/ratings/ |
| B20 | SI, Nets 2K26 (team rating uses the top 8 players; July 29, 2025): https://www.si.com/nba/nets/onsi/news/nba-2k26-ratings-brooklyn-nets-edition-cam-thomas-porter-jr |
| B21 | 2K26 attribute descriptions: https://hoopsgamers.com/nba-2k26-attributes |
| B22 | NBA2KLab badge descriptions (2K25/26): https://www.nba2klab.com/badge-descriptions-2k25 |
| B23 | NBA2KLab, 2K26 Mike Wang (gameplay director) FAQ: https://www.nba2klab.com/nba-2k26-mike-wang-faqs |
| B24 | NBA2KLab, 2K26 How to Shoot (window measurements): https://www.nba2klab.com/videos/nba-2k26-how-to-shoot |
| B25 | NBA2KLab, 2K27 Shooting Ratings Test: https://www.nba2klab.com/shooting-ratings-test |
| B26 | 2K official, 2K26 Courtside Report roadmap: https://nba.2k.com/2k26/courtside-report/roadmap/ |

**NFL**

| ID | Source |
|---|---|
| F1 | EA, Madden 27 Ratings Overview: https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-ratings-overview |
| F2 | Bleacher Report, Madden NFL 27 player ratings revealed (July 29, 2026): https://bleacherreport.com/articles/25458940-madden-nfl-27-player-ratings-revealed-stafford-chase-gibbs-and-top-10-qbs-wrs-rbs |
| F3 | EA official Madden 27 ratings (Week 6, top 100 and player cards): https://www.ea.com/games/madden-nfl/ratings |
| F4 | EA team ratings, Buffalo Bills (Week 6): https://www.ea.com/games/madden-nfl/ratings/teams-ratings/buffalo-bills/3 |
| F5 | EA team ratings, Miami Dolphins (Week 6): https://www.ea.com/games/madden-nfl/ratings/teams-ratings/miami-dolphins/12 |
| F6 | EA position ratings, Kickers (Week 6): https://www.ea.com/games/madden-nfl/ratings/positions-ratings/kicker/K |
| F7 | EA position ratings, Punters (Week 6): https://www.ea.com/games/madden-nfl/ratings/positions-ratings/punter/P |
| F8 | Insider Gaming, Madden 26 ratings reveal (July 31, 2025): https://insider-gaming.com/madden-26-ratings-reveal-continues-with-every-top-player/ |
| F9 | Outsider Gaming, Madden 99 Club list by edition: https://outsidergaming.com/madden-99-club-list-everything-you-need-to-know/ |
| F10 | ComicBook.com, Tom Brady's every Madden rating (Feb 7, 2022): https://comicbook.com/gaming/news/tom-brady-every-madden-nfl-rating-across-22-seasons/ |
| F11 | NBC Sports Washington via WTOP, best players in Madden history (Dec 29, 2021): https://wtop.com/nfl/2021/12/ranking-the-10-best-nfl-players-in-the-madden-video-game-franchise/ |
| F13 | NFL Draft Buzz fan Madden database, Kurt Warner (s): https://nfldraftbuzz.com/madden/player/187953-kurt-warner |
| F14 | NFL Draft Buzz fan Madden database, Peyton Manning (s): https://nfldraftbuzz.com/madden/player/187805-peyton-manning |
| F16 | EA Help, Madden NFL 27 passing styles (s): https://help.ea.com/en/articles/madden-nfl/passing-styles/ |
| F17 | Digital Trends, Madden 23 tips (s): https://www.digitaltrends.com/gaming/madden-23-tips-and-tricks/ |
| F24 | ABC/ESPN, "Madden NFL 26: how the top ratings developed in 2025" (s): https://6abc.com/post/madden-nfl-26-how-top-ratings-developed-2025/18343280/ |

---

## 3. Distribution facts

### 3a. NBA 2K

**Top of the scale.** Modern editions top out at 97-98, not 99.

| Edition | Highest launch rating | Players 90+ | 100th player | Source |
|---|---|---|---|---|
| 2K27 launch | Three players at 97 (SGA, Wembanyama, Jokić) | 21 | 81 | B1 |
| 2K26 launch | Jokić and SGA at 98 | 24 | 81 | B2 |

Active players reached 99 mostly in the early, more generous editions: Garnett, Shaq, Duncan, Kobe and Chris Paul between 2K1 and 2K9. Since then, LeBron in 2K14 is the notable case (B6). Today 99 is effectively reserved for frozen legends such as classic Jordan and all-time Magic and Kareem.

**Typical team (2K27 launch):**

| Team | Players listed | 90+ | 80-89 | 70-79 | Below 70 | Range | Source |
|---|---|---|---|---|---|---|---|
| Bulls | 16 | 0 | 4 | 10 | 2 | 84 down to 68 | B3 |
| Hawks | 20 | 0 | 5 | 13 | 2 | 87 down to 68 | B4 |
| Nets (2K26, Aug 2025) | 16 | 0 | 2 | 13 | 1 | 82 down to 69 | B5 |

**Approximate league-wide picture.** This is my extrapolation from the top-100 cutoff and the three team samples (?). It assumes about 450 standard and 90 two-way players.

| Rating band | Players | Share of league |
|---|---|---|
| 90+ | about 20-25 | about 4-5% |
| 80-89 | about 100-110 | about 20% |
| 70-79 | about 280-320 | about 55-60% |
| Below 70 | about 60-100 | about 15% (two-way players, rookies, end of bench) |

**Floor.** The lowest-rated rostered players usually sit at **66-69** at launch:

- 68 in the 2K27 samples (B3, B4).
- 69 for the Nets in 2K26 (B5).
- Raptors rookie Ulrich Chomche at 68 in 2K26 (s, RaptorsHQ).

Rookie "unknowns" who later became stars started at 60-68 (B7).

**Rookies.** High lottery picks launch in the mid-70s to low-80s:

- Cooper Flagg: 82 in 2K26 (B2).
- Caleb Wilson: 77 in 2K27 (B3).

**Classic rosters use the same bands** (B8-B15). A title team spans about 99 down to the high 60s: the 1995-96 Bulls run 99/93/86/80/78/74/73/67. Era-adjusted role players such as Kerr (73) and Wennington (67) sit where modern bench players do. All-time franchise rosters are compressed to about 80-99, because every player on them is a franchise great (B16).

**Team overall** is computed from the **top 8 players** (B20). Classic teams in 2K21 rated between 66 and 85 as teams (B18).

**In-season updates.** Ratings move during the season, typically ±1-3 per update. For example, Cooper Flagg reached 88 (+1) late in 2025-26 (B19).

**How OVR relates to attributes.** 2K does not publish its formula. The overall is clearly position-weighted:

- Guards' overalls track three-point shooting, ball handle, pass accuracy and speed.
- Bigs' overalls track interior defense, rebounding, standing dunk, block and post control.

Treat any 2K weights as unknown. You can fit your own using the Madden approach in §3c.

### 3b. Madden NFL (M27, Week 6, from EA's public pages)

**Pool size.** About 1,941 rostered players (F3).

**Top of the scale:**

- **93 players are 90+**, about 4.8%. The 100th-best player is 89.
- 5 players are rated 99 in Week 6. There were 6 at launch (F1).
- Historically, each edition has had 3-8 players at 99 since 2002 (F9).
- 99 status is volatile. In M26, 8 players were 99 at launch, but only 4 still were by Week 15 (F24 (s)).

**Typical team (Week 6):**

| Team | Roster | 90+ | 80-89 | 70-79 | 60-69 | Below 60 | Source |
|---|---|---|---|---|---|---|---|
| Buffalo (strong) | 56 | 3 | 9 | 32 | 12 | 0 | F4 |
| Miami (weak) | 58 | 1 | 5 | 26 | 25 | 1 | F5 |

Combined across both teams, that is roughly **3-4% 90+, about 12% in the 80s, about 50% in the 70s, and about 33% below 70.**

**Floor.** The lowest rostered players sit at about **55-62**: long snappers, third-string QBs and reserve OL. Examples are LS Tucker Addington at 56, QB Kyle Allen at 60, and C Andrew Meyer at 62 (F4, F5).

**By position** (EA position pages; complete lists unless marked "top 100"):

| Pos | n | Max | Median | Min | 90+ | 80-89 | 70-79 | Below 70 |
|---|---|---|---|---|---|---|---|---|
| QB | 92 | 99 | 69 | 57 | 8 | 11 | 25 | 48 |
| HB (top 100 of 125) | 100 | 98 | 76 | 69 | 9 | 29 | 58 | 4 |
| WR (top 100 of 207) | 100 | 99 | 80 | 74 | 12 | 38 | 50 | 0 |
| TE (top 100 of 139) | 100 | 99 | 71 | 65 | 5 | 15 | 39 | 41 |
| LT | 71 | 98 | 72 | 60 | 10 | 12 | 19 | 30 |
| C | 68 | 96 | 70 | 54 | 2 | 9 | 26 | 31 |
| DT (top 100 of 199) | 100 | 96 | 77 | 73 | 11 | 23 | 66 | 0 |
| Left edge | 97 | 97 | 75 | 59 | 6 | 15 | 53 | 23 |
| MIKE LB | 79 | 98 | 73 | 57 | 3 | 19 | 23 | 34 |
| CB (top 100 of 199) | 100 | 98 | 79 | 74 | 7 | 36 | 57 | 0 |
| FS | 82 | 94 | 73 | 60 | 3 | 13 | 45 | 21 |
| K | 33 | 86 | 77 | 73 | 0 | 13 | 20 | 0 |
| P | 33 | 85 | 76 | 73 | 0 | 7 | 26 | 0 |

The QB table shows the starter/backup cliff clearly. The roughly 32nd-best QB, the weakest would-be starter, is about **73**: Penix 75, Geno Smith and Brissett 74, Cam Ward and Mendoza 73. Backups sit at 57-72.

**Specialists are compressed.** In M27 no kicker or punter is above 86, even though kick power of 97-99 is common (F6, F7). Top kickers sit at 80-86 and the worst at 73. Historically, though, kickers have hit 99 (Andersen, Vinatieri, Vanderjagt) (F9), so this is an edition-specific choice.

**Rookies.** EA says the top rookies sit in the "low-80s to high-70s" (F1). The first-round rookie QB Mendoza was 74 (F1).

### 3c. How Madden overall relates to attributes (fitted, not official)

EA does not publish its OVR formulas (s) ([itechguides](https://www.itechguides.com/how-madden-ratings-and-player-attributes-work/)).

**Method.** I fit OVR ≈ intercept + Σ wᵢ·attributeᵢ for each position. The fit uses non-negative least squares on EA's public Week-6 position pages:

- The data covers 33-100 players per position.
- Some samples are the top 100 at the position only.
- Collinear attributes share weight, so treat individual weights as approximate.

**Fit quality is high:** R² = 0.97-0.99, with mean absolute error of 0.3-1.0 OVR points.

| Pos | Σw (stretch) | Intercept | Top weights (share of Σw) |
|---|---|---|---|
| QB | 2.19 | −108.5 | THP 24%, MAC 20%, SAC 16%, DAC 12%, AWR 7%, TOR 6%, SPD 6%, PAC 4%, AGI 3% |
| HB | 2.29 | −114.4 | SPD 15%, BCV 14%, AGI 12%, BTK 12%, AWR 11%, JKM 11%, CAR 9%, ACC 7%, SPM 5%, STR 4% |
| WR | 1.86 | −78.6 | SPD 22%, MRR 11%, SRR 11%, AGI 11%, CTH 9%, AWR 8%, SPC 8%, CIT 6%, RLS 6%, ACC 6% |
| TE | 1.96 | −67.0 | SRR 16%, RBK 14%, SPD 13%, CIT 13%, RLS 9%, AWR 8%, MRR 8%, PBK 6%, SPC 5% |
| LT | 1.43 | −37.4 | RBK 29%, PBP 16%, PBF 16%, PBK 15%, AWR 9%, STR 7%, IBL 6% |
| C | 1.54 | −47.5 | AWR 17%, PBF 15%, STR 14%, PBK 14%, RBP 11%, RBK 9%, IBL 8%, RBF 8% |
| DT | 1.71 | −61.4 | STR 20%, TAK 17%, BSH 17%, PRC 13%, PUR 9%, ACC 7% |
| Edge | 1.69 | −58.5 | TAK 18%, SPD 15%, AWR 12%, FMV 11%, STR 9%, ACC 8%, PUR 6%, POW 6%, PMV 6% |
| MIKE LB | 1.77 | −63.1 | PUR 20%, TAK 19%, ZCV 11%, PRC 11%, SPD 9%, STR 9%, BSH 8%, MCV 5% |
| CB | 1.80 | −71.6 | ACC 21%, SPD 16%, MCV 14%, AWR 12%, ZCV 9%, PRC 6%, AGI 5%, PRS 4% |
| FS | 1.67 | −55.4 | AWR 21%, SPD 19%, ZCV 15%, TAK 13%, ACC 11%, MCV 8%, PUR 7% |
| K | 1.13 | −12.2 | AWR 40%, KAC 30%, KPW 29% |
| P | 1.18 | −17.0 | KPW 43%, AWR 39%, KAC 18% |

Raw coefficients for the four most used positions. Multiply each by the attribute and add the intercept:

- **QB** (intercept −108.5): THP .533, MAC .438, SAC .350, DAC .254, AWR .156, TOR .122, SPD .121, PAC .094, AGI .061, BSK .037, TUP .024.
- **WR** (intercept −78.6): SPD .402, MRR .211, SRR .209, AGI .206, CTH .168, AWR .155, SPC .154, CIT .117, RLS .116, ACC .112.
- **CB** (intercept −71.6): ACC .381, SPD .288, MCV .260, AWR .222, ZCV .168, PRC .110, AGI .091, PRS .080, TAK .079, COD .077.
- **HB** (intercept −114.4): SPD .339, BCV .330, AGI .284, BTK .268, AWR .253, JKM .250, CAR .201, ACC .151, SPM .112, STR .095.

**What the fit means for Perfect Season:**

1. **Overall is a stretched weighted sum, not a weighted average.** Σw is 1.4-2.3, with a large negative intercept. A +1 change in every key attribute moves a QB about +2 OVR, while the same change moves an OL about +1.4. That is how Madden spreads players across 55-99 even though attributes cluster in the 60s-90s. To mirror it, compute a weighted average of position attributes A, then set OVR = clamp(k·A − c, 40, 99) with k ≈ 1.5-2.2. Calibrate k and c so your anchors in §2 land where they should.
2. **CB and WR overalls are speed-first.** For CBs, acceleration plus speed is about 37% of the weight, and man and zone coverage together about 23%. For WRs, speed alone is 22%.
3. **QB overall is throw power plus accuracy** (about 72% combined). Speed is a small bonus, which is why Vick at 95 SPD was "only" 90 overall.
4. **For specialists, use a small stretch** (Σw about 1.1). That keeps kickers and punters inside a narrow 73-86 band.

---

## 4. Shooting and passing mechanics in plain language

### 4a. NBA 2K's shot meter and "green window"

**The timing window.** Every jumper has an ideal release point. The **green window** is a small timing band around it, measured in milliseconds.

- Release inside the window and the shot is a "green", a guaranteed make.
- Release outside it and the shot misses. On lower difficulties the outcome is instead a probabilistic make, called a "white".
- NBA 2K26 and 2K27 use **"Green or Miss"** on higher difficulties and in most competitive modes, and the meter shows the window (B26).
- 2K's gameplay director described 2K26 as the first edition with a **"completely pure green window"** and **no RNG** in shooting (B23).

**Window size.** Community frame-timing tests put a 2K26 window at roughly **40-60 ms**. Individual shots ranged from about 20 to 59 ms. **Where** the window sits in time depends on the jumper animation and the distance from the basket, which can shift it by 30-40 ms (B24).

Older editions differed:

- 2K23 had about a 49 ms window.
- 2K24 had about 605-635 ms after shot start (s), per [nba2klab](https://nba2klab.com/nba2k-how-has-shooting-changed).

**What the shooting rating changes.** NBA2KLab ran an automated test in 2K27: 30,700 open shots, no badges, ratings from 65 to 99 (B25).

- The near-certain core of the window barely changes with rating. It goes from **±3.1 ms at a 65 to ±3.6 ms at a 99**.
- The "still usually goes in" shoulder **grows from ±5.8 ms to ±13.9 ms**, about 2.4× wider.
- In their words: **"Timing is what makes you green, and rating is what stops a slightly bad release from becoming a brick."**
- There is no breakpoint at 80, 85 or 90.

**What contests change.** Defensive coverage, measured as contest percentage, cuts make chance and the effective window. 2K re-balanced hands-up, no-jump and jump contests, and a defender who is landing when you shoot "drops considerably" in impact (B23). Shot feedback grades combine the **shooter's ratings, defensive coverage, and timing** (B23). An Excellent release on a wide-open shot by a good shooter is an instant green.

**Other modifiers.**

- Turning the meter off slightly enlarges the window (B23).
- Badges and takeovers widen it (s). In one 2K27 test, a takeover widened the window from 32.4 ms to 44 ms ([nba2klab takeover test](https://www.nba2klab.com/takeover-test)).
- Distance and fatigue matter (s).
- Open dunks and layups have much larger windows, which shrink with contest (B23).

**Arcade translation** (my suggestion, not 2K's formula):

- `window_ms = base(shotType, distance) × (0.6 + 0.4·rating/99) × (1 − 0.6·contest) × (fatigue factor) × (badge bonus)`
- Inside the window, the shot is a make.
- Within the "shoulder", which spans 1-2.5× the window and scales with rating, make chance = `rating_curve × (1 − contest)`.
- Outside that, the shot misses.
- Show the window on the meter so timing feels skill-based. Let ratings mainly forgive near-misses rather than make bad timing work.

### 4b. Madden passing accuracy

**Three passing styles** (EA Help, Madden 27, F16 (s)):

| Style | How it works | How much QB ratings matter |
|---|---|---|
| **Classic** | No meter. | The outcome comes from the QB's ratings (Throw Power and the accuracy for the throw's distance) and the context: throwing on the run or under pressure. |
| **Revamped** | A power meter; pushing into the yellow zone costs accuracy. | Ratings still matter; timing matters more for tight windows and under pressure. |
| **Placement & Accuracy** | The left stick places the ball, and a timed accuracy meter decides precision. | Ratings play a **smaller** role. |

Even without meter timing, a throw is resolved from the QB's accuracy, the pass rush, his abilities, and whether he is on the run (F17 (s)).

**Which rating applies:**

- **Short, medium or deep accuracy**, chosen by throw distance: under 20 yards, 20-40 yards, over 40 yards.
- **Throw on the Run** when the QB is outside the pocket and moving.
- **Throw Under Pressure** when defenders are closing in.
- **Throw Power** for ball speed and maximum distance.

**X-Factors temporarily override these**: Dots gives elite accuracy, Run & Gun gives elite accuracy on the run, Bazooka extends range, and Pro Reads ignores pressure (F3).

**Arcade translation** (my suggestion):

- Model each throw as an aim point plus a random **error cone**.
- `error_radius = base × (1 − acc_for_distance/120) × (pressure? 1 + (1 − TUP/99) : 1) × (on_run? 1 + (1 − TOR/99) : 1)`
- Ball speed equals THP, and maximum distance is a function of THP.
- An optional timing meter can shrink the cone. Bigger accuracy ratings should widen the forgiving part of the meter, just as 2K does for shooting.

### 4c. Retro Bowl passing (lower confidence; sources are fan guides)

- **Drag to aim.** Dragging sets the target and power: a short swipe makes a short pass, and a long swipe throws deep. Tapping with a second finger chooses a **bullet** pass (fast, for tight windows) or a **lob** ([gamerjournalist](https://gamerjournalist.com/how-to-throw-a-bullet-pass-in-retro-bowl/) (s)).
- **QB ratings.** Arm strength governs distance and velocity, and accuracy governs scatter or consistency.
- **Receiver catching.** It matters more on bullets because the ball arrives faster (s).
- Retro Bowl shows players with simple star or attribute bars rather than 0-99 numbers (?).

This model fits a phone game well:

1. The player chooses the target.
2. The QB's accuracy sets the scatter around it.
3. Arm sets the maximum range and the bullet speed.
4. The receiver's catch rating and the defender's coverage decide the catch roll.

---

## 5. Gaps and caveats

- **Fetch failures.** Several primary sources returned 403 errors to automated fetches: 2kratings.com, Sportskeeda, nfldraftbuzz, Prima Games and DotEsports. Data that only appeared in search-engine summaries is flagged **(s)**. Notable cases:
  - The nfldraftbuzz values for 1990s Madden. That fan database computes overalls for early games, and the site states its own method for converting the old scales.
  - Its Madden 99 QB table appears to show Elway, Young and Favre at 99, which contradicts the official 99 Club lists. I excluded those values.
- **No current all-time ratings.** I found no 2K27 or 2K26 all-time or classic-team player ratings that I could read directly. The classic anchors come from 2K18-2K20.
- **No Madden legends in sim ratings.** Madden has no sim-scale legend ratings in recent editions; legends appear only in Ultimate Team, whose card values are inflated.
- **Estimated NBA distribution.** League-wide NBA counts are extrapolated from the top-100 cutoffs and three teams, not counted.
- **Fitted Madden weights.** The Madden weights in §3c are my regression on public Week-6 data, not EA's formula.
- **Source discrepancies to note:**
  - Henry was 98 vs. 99 at M26 launch (F8 vs. F24).
  - Kareem on the 1986-87 Lakers is 92 vs. 93 (B11).
  - Sources disagree on how many 99s Brady received (four vs. five).
  - RealSport101's 2K20 all-decade table lists "George Hill 93" in the 1990s, an obvious error that I excluded.
