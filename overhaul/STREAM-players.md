# Team players: real-life likeness, card faces, animation that looks real

Worktree `/home/user/ps-s-players`, branch `claude/studio-players`, port 5214. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` first.

## Why

The owner asked to "add different characters for characters that match them in real life in game so we know who is who and make animations seem real like how the games do", "make cards appeal to the eye", and "make it all look productions studio made".

## Sources

- **`O/audit-likeness-animation-perf.md` Parts 1, 2 and 4.**
  - Part 1: L-1 … L-6.
  - Part 2: A-1 … A-6. A-1 is the frozen near players: in NFL autoplay 41% of player draws are stale.
  - Part 3 (performance) belongs to shell. Its renderer frame costs are relevant to you, though.
  - Screenshots are in `O/audit-shots/likeness-perf/` and scripts in `O/audit-scripts/likeness/`.
- **`O/research-likeness-animation.md`.** Read all of it:
  - the appearance record
  - the 10-tone skin palette anchored on the open Monk Skin Tone hexes
  - the tiers: about 150 curated icons per sport plus seeded defaults
  - the guardrails
  - what reads at 20–60 px
  - signature motion as pose tweaks
  - the animation rules: contact frames locked, foot anchoring, holds/smear/overshoot, secondary motion
  - hit-stop and shake
  - the frame-by-frame plans per action
  - likeness outside the match: card portrait, walkout, name tag
- **`O/audit-ut-ui.md`:**
  - H2: players unrecognisable on cards; tiny back-turned figure.
  - H3: card art falls short — every gold identical, the figure about 25% of the card, text 3–9 px, team badges illegible.
  - M11: the rating-reference link leaves the installed app.
  - H6: the "2K"/"Madden" reference links in `CardDetail.tsx:160-166` must go.
- **The sport audits' animation and identity sections:**
  - `audit-nba.md` §7–8 (NBA-23 foot sliding on 29% of frames, NBA-24, NBA-25, NBA-26)
  - `audit-nfl.md` §7 A-1 and §8 V-2
  - `audit-soccer.md` §7 A-1 and A-2

## Scope

### P0: appearance system, "so we know who is who"

- **Typed appearance record and lookup** (`appearanceFor(sport, playerId, season?)`) with these fields:
  - skin tone index (10 tones, each with its own generated shadow, highlight and outline)
  - hair style (≥18) and hair colour; facial hair (≥8)
  - headgear: headband, goggles, and for NFL helmet visor/tint
  - arm sleeve L/R, leg sleeve or knee pad, socks height, shoe colour
  - build (from height AND weight; give soccer a sensible weight default by position and height)
  - handedness / preferred foot
  - per-era overrides, because looks change across a career
- **Curated data.** Author about 150+ marquee players per sport by hand (more if you can do it accurately): greats, top-rated cards, current stars, cover-level names. Write it from widely known public appearance (hair, beard, headband, goggles, sleeves, build).
  - Examples: Shaq bald; Iverson cornrows with headband and arm sleeve; Kareem goggles; Rodman's dyed hair; Haaland long blond hair; Mbappé short; Brady.
  - Accuracy matters more than count. Leave an uncertain field to the default rather than guessing.
- **Guardrails:**
  - No race or ethnicity field.
  - Never derive skin, hair or any trait from a name, nationality or team.
  - No tattoos, logos or real brand marks.
- **Uncurated players** get era/position-seeded neutral defaults (hair style and colour plausible by era) and the neutral default skin tone.
  - Fix the hashed features that actively mislead (bald Iverson, high-top Shaq, dark-haired Haaland, bearded Mbappé): curated entries override the hash.
- **Build from data.** Weight must change the silhouette visibly (Shaq vs Manute Bol). One build formula shared by match and card.
- **Data size and loading.** Store the data compactly (target about 20 KB gzipped per sport) and load it lazily with the game or UT chunk.
  - Optionally keep a YAML/JSON source plus a build script, with a test that the built file is in sync.

### P0: players render with their looks in all three engines

- Wire appearance into the player-drawing code of all three sports (`render.ts` player sections plus `src/game/pixel/body.ts`).
  - Detail scales with sprite height; small sprites get up to a 25% head-size boost.
  - Numbers stay readable from 28 px.
- Recolour the crowd from the same palettes so it isn't one tone.
- **Before/after screenshots:** an NBA starting five of stars, an NFL lineup, a soccer XI, and close-ups. Save them to `O/shots/players/`.

### P0: animation correctness

- **A-1 (Critical, NFL).** Each frame may draw only 4 new sprites, spent on the far players first, so the near players freeze and slide.
  - Fix the sprite budget and cache: prioritise near and large players, cache by quantised pose, or raise the budget with a measured frame cost.
  - Target under 2% stale draws for the nearest players, while keeping 60 fps at normal speed and acceptable at 4× CPU.
- **A-2: blends instead of hard cuts.** Blend between clips over about 4–6 frames, and lock contact frames to game time (release, catch, kick, plant).
- **A-5: foot sliding.** Fix foot sliding (NBA 29% of on-ground frames, soccer 12.8%): anchor the planted foot and match gait speed at 0.8–1.25×.
  - Raise effective animation rates by interpolating 15 fps clips.
  - Fix snapping facings.

### P1: real motion and signature identity

- **A-3.** Wire in the recorded clips that are never played: dribble, crossover, cut, stiff arm, get-up-from-front.
  - Replace hand-keyed stick poses with mocap or properly keyed poses: dunks (the windmill arm must circle), spin, pass, block, and the NFL juke (which reuses the basketball crossover), stiff arm and truck.
  - Distinct block, rebound and contest poses. Soccer: keeper dives that aren't belly-flops, slide tackles, dribble touches, left- and right-footed kicks by preferred foot, and get-ups.
- **A-4: everyone moves the same.** Add render-only signature motion parameters:
  - shot release speed and height, set point, fade
  - dribble style
  - QB arm slot and hold
  - run style
  - celebration
  - Curated stars get their own; everyone else gets defaults from rating and size rules.
  - **Render-only.** Never change simulation timing. If a change would alter timing, stop and record "Protocol bump needed".
- **Juice:** hit-stop of 33–120 ms with a capped budget, shake scaled by mass times speed, teammate run-in celebrations, and crowd reactions within 6–12 frames.

### P1: card faces that look like a production UT

- **H2/H3.**
  - A front-facing pixel bust or portrait on every card, drawn from the appearance record. Make it much larger than today's tiny 52 px back-turned mannequin.
  - An edition frame system: base gold, silver and bronze each distinct; rare shimmer; every promo/program/special edition with its own frame and colourway; GOAT and Spotlight premium.
  - Legible typography: OVR and position large, name readable, attribute labels at least 10 design px at the club-grid size.
  - Readable team badges as original shapes in team colours. No real logos.
- **Draft cards** (`src/ui/Card.tsx`) get the same portrait instead of initials on a jersey.
- **Collection silhouettes** become recognisable shapes, not the same grey blob. The collection screen itself belongs to ut; give them a portrait component they can use, and describe it in your doc.
- **CardDetail:**
  - Remove the "2K"/"Madden" reference links (H6), and don't leave the installed app (M11).
  - Show a bigger portrait and a rich stat layout.
  - The sticky bar offset belongs to shell; don't change it.
- **Performance.** Portraits are canvas- or SVG-drawn and cached; a club grid of 100 cards must scroll smoothly.

## Notes

- **Ownership.** You own the player-drawing sections of the three `render.ts` files. The camera, field, HUD and banners belong to the sport teams, so keep hunks local and never restructure those files.
- **Protocol.** Everything here must be render-only: no protocol bump. Say explicitly in your doc that simulation code was untouched.
- **Owner device checks:** "can you tell who is who" at a glance in each sport, card readability on the phone, and the animation feel.

## Owner decisions

Read the "OWNER DECISIONS (2026-11-09)" section at the end of BRIEF.md. It is binding and overrides this brief where they differ.
