# Arcade v2 + Ultimate Team: the agreed scope

Decisions from the owner's answers (2026-10-27). Everything ships in one release.

## The played games (both sports)
- **Look:** HD pixel art, Hoop Land / Retro Bowl quality: large detailed sprites, many animation
  frames. No paid image generation: art is made in code (free) or from free-licensed sources.
- **Players look like themselves:** real jersey number, height scale (a 7-footer towers over a
  point guard), build from weight, uniforms in the player's **favorite team's** colors.
  Same favorite team on both sides: the rival wears the away set.
- **Orientation:** player's choice. Games work held upright or sideways; layout adapts.
- **Offense only.** The rival's drafted defenders guard you as AI with their real ratings.
- **Length:** about 5-6 minutes a game.
- **Ratings:** Madden / 2K style 0-99 attributes per player season, computed from real stats and
  physicals, calibrated against well-known reference overalls (not copied rating files).
  Attributes decide what a player can do (who can shoot threes, who dunks, who has contact dunks).
- **Basketball:** hold-and-release shot meter with a 2K-style green window. Arcade-forgiving:
  a good open shooter greens often; contests shrink the window a lot. Contest system
  (open / light / heavy / smothered) from the closest defender's closeout, height and rating.
  Dunk types gated by attributes: layup, driving dunk, standing dunk, contact dunk (posterizer).
- **Football:** Retro Bowl slingshot passing: drag back from the QB, a dotted arc shows the landing
  spot, let go to throw. Runs: steer, juke/spin/stiff-arm by attributes. Kicks with a meter.
  AI defense from the rival's drafted defenders: pass rush, man/zone coverage, tackling.

## Head to head
- **Sim or play vote:** both players vote with a countdown; each sees the other's vote live and can
  vote with or against it. Same vote: done. Different: an animated coin toss decides
  (deterministic from the match seed, so both phones agree).
- **Sim:** the original sim screen (GameCast: win probability, who scored, play by play).
- **Play:** both play their offense at the same time; live rival score; most points wins,
  tie to the better team.

## Football rosters
- Real defensive players replace the team-defense card, **in the draft and Ultimate Team**:
  names, years, stats, heights, numbers. Needs a defensive-player data pipeline.

## Favorite teams
- Pick an NBA and an NFL favorite at first launch (existing players asked once), changeable in
  Profile. Used for uniforms in head to head and Ultimate Team.

## Ultimate Team (each sport)
- Its own mode, played vs AI challenges and **online UT head to head matched by squad rating**.
- Cards: season cards (Bronze/Silver/Gold by rating), Legends/Icons, hot-season promos
  (MVP or record seasons), upgradable cards that level up as you play them.
- Packs bought with earned coins only (never real money). **Balanced** economy: a Gold squad in
  about a week of play; Legends very rare (~1 in 150 premium packs).
- Quick-sell for coins, squad building challenges, team chemistry (same team / era / decade).
- Squads: **NBA 5 starters + 5 bench** (bench subs in on fatigue). **NFL full 11 + 11 and a K**:
  QB, RB, WR x3, TE, OL x5; DL x4, LB x3, CB x2, S x2.

## Round 2 decisions (asked after seeing the first builds)
- **Motion:** real motion capture drives the pixel players (free CMU Graphics Lab recordings:
  jump shot, layup, runs, cuts, falls, throws), retargeted to each player's height and build.
  Keeps the HD pixel art, team uniforms, numbers and heights. No hand-keyed robot poses.
- **Contact reactions, basketball (all):** posterizer (defender knocked down, slow-mo), blocked
  shot (shooter swatted, blocker's flex), ankle breaker (defender drops), and-one bump (shooter
  absorbs contact, still finishes).
- **Contact reactions, football:** big hit (runner driven back or flipped, slow-mo, shake),
  truck / stiff arm (tackler on his back), juke whiff (defender dives at air). Not diving plays.
- **Basketball camera:** behind the basket with perspective, the same upright and sideways
  (sideways shows more of the floor across). **Fine pixels in both games** (one art pixel per
  screen point), like the football.
- **Dunks:** automatic by ratings: attack the rim and hold SHOOT; layup, dunk or contact dunk from
  the dunk ratings, vertical, size and the defender in the way.
- **Shot meter:** the 2K-style arch over the shooter's head: it fills from the left end as he rises, the green slice sits at the top of his jump, and a green release lights the whole arch.
- **Football play call:** pick one of three play cards each down (routes drawn), then snap.
- **Moves by swipe, both sports:** football: steer by dragging, swipe left/right juke, up spin,
  double-tap truck (no move buttons). Basketball: stick to move, swipe left/right crossover, swipe
  back step-back, circle spin; SHOOT and PASS stay buttons.
- **Assets:** free only (CC0 / free-for-commercial-use with attribution where required).
- **Sound:** real recorded sounds (crowd, squeaks, swish, rim, whistle, pads, horn). No announcer.
- **Replays:** an automatic 2-3 s slow-motion replay after highlights, closer camera, REPLAY banner,
  tap to skip.
- **Who's open (football):** live open/tight/covered rings on receivers only in a player's first
  games, then off.
- **Tutorial:** tips only (hint banners in the first games), no guided practice.
