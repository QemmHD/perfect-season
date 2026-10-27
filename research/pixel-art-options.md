# Pixel art options: HD players without paid image generation

Research date: 2026-10-27. All licenses are quoted from the asset's own page (or its bundled license file) on that date. Where a page states no license, this document says so and does not guess one.

## Bottom line

- **No free sprite pack is good enough for the players.** The free basketball and American football player sprites on OpenGameArt, itch.io, Kenney and GitHub are tiny (10-16 px), crude, the wrong sport (soccer), or have no license. One even shows a real NBA player by name. None of them supports per-team colors, real heights or jersey numbers.
- **The best free path is code-drawn sprites, done properly.** Pose a skeleton for each frame and draw it into a small grid of palette indices. Add hand-made head, hair and face pieces, then run outline and shading passes. Color the grid from each team's palette and scale it up by a whole number with smoothing off. This gives exact heights and builds, any team's colors, real numbers and as many frames as we want. The in-progress `src/game/pixel/` rig already takes this route.
- **What free assets are good for:** small supporting pieces. Kenney's Sports Pack (CC0) has field and court line tiles and balls. Kenney's Pixel UI Pack (CC0) has scoreboard and menu panels. Daniel Linssen's m5x7 font (CC0) suits score digits. Courts, fields and crowds are easier to draw in code in each team's colors.
- **If spending under $10 once (not image-generation credits) is allowed,** the only pack near Hoop Land quality is *Hoops in Pixel* ($6.74 on sale, custom license, basketball only). It would only serve as a pose and timing reference. Football has no equivalent.

---

## 1. Free sprite assets

How to read the tables:

- **Commercial / modify** means what the license allows.
- **Recolor** means how hard it would be to swap in team colors by palette. A clean palette (few colors, no anti-aliasing) is easy. Hundreds of colors or soft shading is hard.
- **Not free** marks the few paid items. They are listed only because they come closest.

### 1a. Basketball players

| Asset | URL | License (exact) | Commercial / modify | Attribution | Size, frames | Quality | Recolor |
|---|---|---|---|---|---|---|---|
| Basketball Player (juanmotor, OGA) | https://opengameart.org/content/basketball-player | "CC-BY 3.0" and "CC-BY-SA 3.0" (dual-listed; OGA FAQ: "You must follow only one of the licenses") | Yes / yes (SA option: derivatives must stay CC-BY-SA) | Required (author: juanmotor); no credit text given | `gasol_botando.png` 153x420 (dribble, ~7 frames in ~100 px rows), `gasol_lanzando.png` 150x399 (shot, ~6 frames). Side view, thin figure ~90-100 px tall | Low: amateur, stiff | Hard: 598 and 383 unique colors |
| Dunkmaster Darius (R1games1, itch) | https://r1games1.itch.io/darius-dunk-master | No named license. Page text: "You can use this pixel art for anything that you want." | Stated as anything / anything | Not required by the page | One file: `New Piskel.gif` (141 kB), one character; size and frame count not stated | One-off character | Unknown |
| Basketball Pack (looneybits, OGA) | https://opengameart.org/content/basketball-pack | CC0 | Yes / yes | None | `alleyapp.zip`: balls, coins, catch-game items. **No players** | n/a | n/a |
| Asset Pack 'Basketball' NES (chasersgaming, itch). **Not free: £2 minimum** | https://chasersgaming.itch.io/asset-pack-basketball-nes | No license field. Creator comment: "These assets are CC0 License. :)". The cover image reads "LICENSE: PUBLIC DOMAIN" | Creator: "You can do what you want with them." | Not required | Player A/B: IDLE, RUN, DRIBBLE, JUMP SHOOT, SHOOT, BLOCK, JUMP BLOCK. Referees, court tiles (8x8 and 16x16). Frame counts and sizes not stated; NES-sized players | Clean NES look, small | Easy: NES palette limits |
| Hoops in Pixel (Josee / n3cloud, itch). **Not free: $8.99, $6.74 on sale** | https://n3cloud.itch.io/basketball-hoops-in-pixel | Custom: "You CAN edit, alter, and use these assets in any commercial or non-commercial video game project." / "You CANNOT resell, redistribute, sub-license, or share the raw assets, sprite sheets, or source files, even if modified." / "You CANNOT use these assets, in whole or in part, to train generative AI/ML models" | Yes / yes, in games | Not stated | Large move list: 3 dribbles L/R, crossover, between the legs, behind the back, 3 jump shots, free throw, fadeaway, layup, floater, 7 dunks, 3 blocks, 3 rebounds, steal, slide, run and sprint. Includes a layered character customizer (hair, skin, jerseys, accessories, colors) and `.ase` source. Frame counts and sprite size not stated; preview players look about 30-40 px tall on a Hoop Land-style 3/4 court | Closest to Hoop Land of anything found. Status: "In development" | Built for it (layered customizer) |

### 1b. American football players

| Asset | URL | License (exact) | Commercial / modify | Attribution | Size, frames | Quality | Recolor |
|---|---|---|---|---|---|---|---|
| American Football Sprite Sheets (Not Bedtime Yet, itch) | https://notbedtimeyet.itch.io/football-spritesheet | **No license stated.** Only text: "Optional: If you want to include in credits - Not Bedtime Yet on Itch or @NotBedtimeYet on YouTube." | Not granted in writing; ask the author first | Optional | 6 player sets x 8 animations (run, run with ball, aim, throw, idle, dive, get up, jump), ball and ball shadow, 3 grass sets, 4 logos. 12 kB zip; previews show ~10-12 px figures | Very small, blob-like | Easy (few colors), but too small for numbers |
| Football Sprites 2D (SpawnCampGames, itch) | https://spawncampgames.itch.io/football-sprites-2d | **No license stated** | Not granted in writing | Not stated | `FootballField.png` (641 kB) and an unbranded version, power meter, aim arrow, touchdown markers, referee, 2 teams with bench | The top-down field is decent; the players are tiny | n/a |
| American Football Assets (BananaCat, OGA) | https://opengameart.org/content/american-football-assets | CC-BY 3.0. Notice: "Credit me is all I ask if you use any of them." | Yes / yes | Required (BananaCat) | One 64x64 GIF, 12 frames: 2 blue and 2 red player icons, referee, ball, goalpost, flags | Placeholder-level | Easy |
| Football Player Overworld Sprite Sheet (OGA) | https://opengameart.org/content/football-player-overworld-sprite-sheet | CC0 | Yes / yes | "No attribution required. But if you do attribute, give credit to the Superpowers Asset Packs." | 64x112 sheet = 16x16 frames, 4 directions, walk plus "ninja-style attack moves" | RPG overworld chibi, not sports | Easy (12 colors) |
| Football Pack (looneybits, OGA) | https://opengameart.org/content/football-pack | CC0 | Yes / yes | None | Gloves, balls, misc items for catch games. **No player sheet** | n/a | n/a |
| Football sprite based on LPC set (asalinasci, OGA) | https://opengameart.org/content/football-sprite-based-on-lpc-set | CC-BY-SA 3.0 | Yes / yes, share-alike | Required: "www.vedoque.com" plus the LPC base authors | 770x64 strip, about 12 frames of 64x64 | **Soccer**, not American football | Hard: 1,392 colors |
| American Football (keatura!, itch) | https://keatura.itch.io/american-football | "CC Attribution". Page: "model is creative commons attribution license, so just remember to give credit!" | Yes / yes | Required | A 3D model (FBX/Blender, 26 kB), not sprites | n/a | n/a |
| Duck Punt Sprites (OGA) | https://opengameart.org/content/duck-punt-sprites | GPL 3.0, GPL 2.0 | Yes / yes, under the GPL | Geoff Draper | Scanned hand drawings of ducks | Not pixel art | n/a |

The OGA "Football Player Overworld" uploader says "I DID NOT MAKE THIS!!" and names the Superpowers Asset Packs as the source. That repository (https://github.com/sparklinlabs/superpowers-asset-packs) is CC0, but none of its packs is sports-related, so where this sheet came from can't be confirmed. Treat its provenance as unverified.

### 1c. Courts, fields, crowds, scoreboards, UI, balls

| Asset | URL | License (exact) | What it really contains (checked) | Use for us |
|---|---|---|---|---|
| Kenney Sports Pack | https://kenney.nl/assets/sports-pack (also https://opengameart.org/content/sports-pack-350) | Bundled License.txt: "License (Creative Commons Zero, CC0) ... You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory." | Characters in Blue, Red, Green and White, 14 each, 21x31 or 19x13 px, seen straight down with no animation. Balls (basketball 18x18, American football). 81 field and court line elements, 208 ground tiles in 10 color schemes. Flat vector-like style | Line pieces and balls at most. The characters don't fit |
| Kenney Pixel UI Pack | https://kenney.nl/assets/pixel-ui-pack | "Creative Commons CC0" | 9-slice panels and buttons (48x48) in Outline, Ancient and Colored styles, plus spritesheets. No meters or bars | Scoreboard and menu frames |
| m5x7 font (Daniel Linssen) | https://managore.itch.io/m5x7 | Listed as "Creative Commons Zero v1.0 Universal". Page: "free to use but attribution appreciated" | 5x7-style pixel font (TTF) | Scoreboard digits, clock |
| m6x11 font (Daniel Linssen) | https://managore.itch.io/m6x11 | Page says "free to use with attribution" (no license name shown) | Pixel font (TTF) | Headers. Credit him |
| Football/Soccer Assets (chasersgaming, OGA) | https://opengameart.org/node/81006 | CC0. "no credit or permission needed" | `Pitch 1.png`, 1296x672, usable as 16x16 tiles | **Soccer pitch**; grass texture reference only |
| Stadium background 16 bit (bcsilva, OGA) | https://opengameart.org/content/stadium-background-16-bit | CC-BY 3.0 | `bg_stadium.png`, 2.4 kB | Too small and generic |
| basketball field (Cookie, OGA) | https://opengameart.org/content/basketball-field | CC-BY 3.0 | `expfence.png` (615.7 kB), "basketball field with wooden fence" | Not our camera |
| Sport Balls Pixel-art Pack (BeeMaxStudio) | https://beemaxstudio.itch.io/sport-balls-pixel-pack | "Creative Commons Zero v1.0 Universal". "You are free to use these assets for both personal and commercial projects." | 7 balls at 64x64, including a basketball | Optional ball art |
| Pixel Sports Ball Assets - Free (hamu) | https://hamuko27.itch.io/pixel-sports-ball-assets | No named license. Use and modify allowed, credit optional, no resale or redistribution | 6 balls (no American football) | Optional |

**Crowds:** I found no usable CC0 or CC-BY pixel crowd set. Hoop Land's crowd uses the same character style as its players in team-colored shirts. Our rig can do the same: tiny seated figures with 2 cheer frames and shirts weighted toward the home team's colors.

### 1d. Generators with free output

- **Universal LPC Spritesheet Character Generator**: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
  - **License:** a mix per piece: CC0, CC-BY, CC-BY-SA, OGA-BY and GPL. The README says CC-BY-SA is "the most restrictive license for any art supplied by this generator" and that you "must at least credit all the authors (except for CC0 licensed artwork)." It provides a credits CSV.
  - **Format:** a top-down RPG style in 64x64 frames, 4 directions. The original LPC page confirms walk = 9 frames (1 idle + 8 cycle), thrust = 8 and shoot (bow) = 13. Run, jump and climb were added later, and many items aren't drawn for them yet.
  - **Recolor:** WebGL palette recoloring of body colors.
  - **For us:** it's an RPG look, not sports. Share-alike and credit duties apply. Not recommended for players.
- **Mixamo** (Adobe, free account): free 3D characters and animations.
  - Adobe's community FAQ: "unlimited commercial or non commercial use"; "really the only thing you can't do is distribute the raw character and animation files." Check https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html before relying on it.
  - Sports motion is thin, per a Mocap Online review.
  - Useful only for an offline Blender 3D-to-pixel pipeline, or as pose reference.
- **Rokoko free sports mocap:** 12 FBX clips on a Mixamo skeleton, available after a registration form. Terms: "you can use them in any animation, VFX, game, 3D art etc project you want, from passion project to commercial use." The clip list isn't published, so it's unknown whether basketball or football moves are included.
- **AI sprite generators** (PixelLab, Retro Diffusion and similar) run on paid credits. Excluded by the brief.

### 1e. Avoid

- **Rip archives such as The Spriters Resource.** They host sprites extracted from commercial games (NBA Jam, Tecmo Bowl, Double Dribble and so on). Those come with no license to reuse.
- **"Unblocked games" GitHub mirrors of Retro Bowl.** Web pages describe unofficial uploads of the game to GitHub, including "unblocked games" hubs such as one called "3kh0". Any art in them is New Star Games' copyrighted art. Never use Hoop Land or Retro Bowl art, even edited.
- **Real-person likeness.** The OGA "Basketball Player" files are named `gasol_*` and described as "inspired in the Spanish basketball team" (Pau Gasol). Avoid it. Our own players should look generic: real number, height and build, but no attempt at a portrait.
- **No-license "free" packs** (Not Bedtime Yet, SpawnCampGames). Without license text they are all-rights-reserved by default. Use them only with written permission.
- **Unverified provenance:** the "Football Player Overworld" sheet (see note above 1c).
- **AI-made packs** (for example Leckie Pixel Studio's Retro Football Kit, "Created with AI assistance", which is soccer anyway). Avoid for quality and licensing clarity.

---

## 2. Free tools and techniques

### 2a. Editors (all free)

| Tool | License | Notes |
|---|---|---|
| LibreSprite | GPL-2.0 | Fork of Aseprite's last GPLv2 commit. Layers, timeline, onion skin, indexed color. Linux, macOS, Windows, Android. https://github.com/LibreSprite/LibreSprite |
| Pixelorama | MIT | Godot-based. Layers, onion skin, palettes, sprite-sheet export, tilemaps, 3D layers, a **web version**. https://github.com/Orama-Interactive/Pixelorama |
| Piskel | Apache-2.0 | Browser-based, simple; exports GIF and sprite sheets. https://github.com/piskelapp/piskel |
| GrafX2 | GPL-2.0 (LICENSE file) | "The ultimate 256 color painting program": strict indexed palette, good for palette-swap masters. https://gitlab.com/GrafX2/grafX2 |
| Aseprite | EULA | Source is public; the EULA allows you to "compile and modify the source code ... for your own personal purpose". Binaries are paid. It includes RotSprite rotation. |
| Blender | GPL | Only for an optional 3D-to-pixel pipeline (see 2c). |

Practical use for us: author and preview the small hand-made pieces (heads, hair, hands, shoes, digits) in Pixelorama or LibreSprite. Then transcribe them into code as small text grids, the way `src/game/sprites.ts` already stores digits. The code draws the full body.

### 2b. Techniques indie games use for recolorable pixel sprites

1. **Palette swap with index maps.**
   - Wargroove draws every unit against a reference palette with ranges for faction color, skin and fixed colors. A build step turns each sprite into a greyscale image whose value is the palette index, and a shader looks the color up per pixel. This "saves a lot of video memory and bandwidth" and lets any unit wear any team color and skin tone (https://wargroove.com/palette-swapping/).
   - For our canvas-2D web game no shader is needed. Keep each frame as a `Uint8Array` of indices and map it to RGBA once per team at bake time.
2. **Layered parts ("paper doll").**
   - Skin, jersey, shorts, shoes, hair, accessories and number are separate layers in fixed order. Hoops in Pixel's customizer and the LPC generator work this way.
   - Drawn bitmaps can't change body proportions, so taller players need extra drawn variants of every frame.
3. **Skeletal posing rasterized at low resolution.**
   - Joint angles per keyframe are turned into limb positions. Limbs are filled straight into a low-res grid (no rotated bitmaps, no anti-aliasing), then scaled up with nearest neighbor.
   - Dead Cells did the 3D version: 3ds Max models rendered "in low resolution, without any anti-aliasing" with cel shading, about 50 px tall, so animators could "adjust the timing of the animations dozens of times in minutes." Their open issue was flickering pixels (https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-).
   - This is the only technique where height and build are exact and free: change bone lengths and limb widths, not the bitmap.
4. **Outline and shading passes.**
   - Shading: three-tone ramps per material (shadow, base, light), with shadows shifted toward cool purple-blue and lights toward warm. Light comes from the upper left. One extra pixel of contact shadow goes under the arms and at the shorts line.
   - Outline: 1 px around the silhouette. Use near-black for the Hoop Land look, or a darkened neighbor color ("selective outline") for a softer look.
   - Inner lines: separate overlapping limbs with a 1-px darker line only where the depth jump is large.
5. **Pixel-perfect cleanup.**
   - Remove "L-corners" (doubled pixels at stair steps) from limb edges.
   - Never rotate a finished bitmap with plain nearest neighbor. If a rotated item is needed (ball, arm band), use RotSprite, which scales up 8x with a modified Scale2x, rotates and scales back down without adding colors (https://info.sonicretro.org/RotSprite).
6. **Sub-pixel animation and smears.**
   - Shift one or two edge pixels (or change their shade) between frames to suggest motion smaller than a pixel: breathing, jersey sway, hair bounce (https://tinywarriorgames.com/2019/01/04/game-development-pixel-art-sub-pixel-animation/; Pedro Medeiros' tutorials at https://saint11.org/blog/pixel-art-tutorials).
   - Use 1-2 smear frames for fast moves (dunk, throw, spin).
7. **Whole-pixel world.**
   - Draw the scene on a low-res canvas, snap every sprite and the camera to whole art pixels, and scale the whole frame up by a whole number.
   - Today's games use `dpr = Math.min(2.5, devicePixelRatio)`. That makes uneven pixel sizes and shimmer on 3x phones, so pick a whole number of device pixels per art pixel instead.

### 2c. Which approach fits our case

| Approach | Height and build | Team colors | Cost per new move | Quality ceiling | Fit |
|---|---|---|---|---|---|
| Hand-drawn sheets (needs an artist) | 3-5 drawn body variants x every frame | Index map | Very high | Highest | No artist; no budget |
| Paper-doll layers of drawn frames | Variants only | Easy | High | High | Same problem |
| Free packs (section 1) | Fixed body | Mixed | n/a | Low | No |
| **Code skeleton plus hand-made head pieces, index palette** | **Exact, continuous** | **Trivial** | **Low (keyframes)** | **Good, near Hoop Land if the heads are well made** | **Best** |
| Offline 3D-to-pixel (Blender + Mixamo/Rokoko) | Re-render per height class | Material-ID pass becomes the index map | Medium, needs a person running Blender | High motion quality | Plan B for tricky moves (dunks) |

The code skeleton wins on every point the owner asked for: real height, real build, any team's home or away set, a real number on every player, and many frames at almost no extra cost.

Its weak spots are stiff-looking limbs and blurry faces. To avoid them:
- Spend the hand-made effort on **heads**: face, hair styles, headbands, beards and helmets, in front, back and 3/4 views.
- Clean up limb outlines after rasterizing.
- Design **key poses** carefully, with anticipation, squash and overshoot, instead of interpolating everything evenly.

### 2d. Sprite size for a phone (both orientations)

Measured reference points (section 3): Hoop Land players are about 28-30 art px tall on a 640x360 screen. Retro Bowl players are about 15-16 art px on a screen about 315x177 art px. Both games put a player at about 8-9% of screen height.

Integer scaling on a 3x phone (an iPhone 15 is 1179x2556 device px):

| Orientation | Short side, device px | Scale | Visible art px |
|---|---|---|---|
| Landscape | 1179 | 1179 ÷ 270 → 4 | About 639 x 295 |
| Portrait | 1179 | Same factor 4 | About 295 x 639 |

So the art window is 270 px on its short side at minimum, and the long side grows to fill the screen. Here 4 device px per art px is 1.33 CSS px.

| Sport | Player height | CSS px on screen | Share of landscape height |
|---|---|---|---|
| Basketball | 36-47 art px | 48-63 | 12-16% |
| Football | 24-29 art px | 32-39 | 8-10% (Retro Bowl-like) |

The basketball players come out bigger and more detailed than Hoop Land's while still fitting a half court. The football size leaves room for 22 players. Optionally drop the scale one step in portrait (to 3) to show more of the field.

Frame cells: **64x64 for basketball** (room for raised arms and dunks) and **48x48 for football** (dives and stretched catches). The anchor is the feet center, and jump height is a draw offset, not part of the cell.

---

## 3. How Hoop Land and Retro Bowl look and move

Method:
- I measured official store screenshots and the Hoop Land Steam trailer frame by frame. Hoop Land: 13 Steam screenshots at 1920x1080 and the launch trailer, 1920x1080 at 60 fps. Retro Bowl: App Store screenshots at 2208x1242.
- Art pixel size came from overlaying a grid and from color-run lengths.
- Neither developer has published sprite sizes or frame counts, and I found no developer talk on their art. Frame counts below are therefore not stated as facts.

### Hoop Land (Koality Game)

- **Facts from the Steam page** (https://store.steampowered.com/app/2453660/Hoop_Land/):
  - "a 2D hoops sim inspired by the greatest retro basketball games of the past".
  - "Every shot is determined by true 3D rim and ball physics".
  - Leagues let you customize "team names, uniform colors, court designs". Uniform colors are data-driven, which implies a recolor system.
  - Steam lists it as released Oct 21, 2025; it is also on iOS. Career mode lets you edit "hair, height, city" (https://mechanicsofmagic.com/?p=51442).
- **Camera:** **not a pure side view.** A high 3/4 overhead camera looks across a horizontal court from the near sideline. You see the floor, the far bench and crowd, and the near crowd as a strip of heads. The camera pans along the court with the ball, and in the trailer it cuts to a 2x zoom for free throws.
- **Screen and pixel size:** the game draws at about **640x360** and scales 3x to 1080p. A 3-screen-pixel grid lines up exactly with the art.
- **Players:**
  - About **28-31 px tall** while running or standing, with **chibi proportions**: the head is about 14 px tall and 11-12 px wide, roughly half the body height.
  - A 1-px black outline, 3-tone shading, an elliptical floor shadow (a separate sprite).
  - Lots of variety from hair (high tops, locs, buns), headbands, beards, skin tones and accessories.
  - Body height barely differs between players in the screenshots. Identity comes from heads and hair, not size.
- **Facings:** front views (facing the camera) and back views (facing away) are common, plus 3/4 running views.
- **Numbers:** **two-digit jersey numbers on both chest and back** (45, 44, 26, 35, 5, 50, 19 in the crops). The digits are about 3x5 px, in the trim color on the jersey color.
- **Court and crowd:**
  - The home team's name runs along the baseline in big letters, with its logo at center court and the paint in team color.
  - Camera operators sit along the baseline. Crowd, bench and coaches use the player art style.
  - The scoreboard is a pixel-font bar at the top.
- **Frame counts:** not published. I could not count them reliably from the trailer, because the camera pans constantly and players overlap. The motion reads as smooth arcade animation, roughly 8-12 drawn frames per second of action, but treat that as an impression, not a measurement.

### Retro Bowl (New Star Games)

- **Background:**
  - Made by Simon Read in GameMaker. The art is by John Savage (@pixelnfl); Read: "His player animations and character designs took the visuals to a whole new level" (https://www.pocketgamer.biz/interview/77507/new-star-games-simon-read-retro-bowl-making-of/).
  - Read says "the revered Tecmo Bowl on NES was a huge inspiration" (https://www.nintendolife.com/features/from-retro-bowl-to-retro-goal-how-new-star-games-returned-to-its-grass-roots).
  - Wikipedia: "8-bit styled"; defense is simulated; the unlimited version lets you edit uniforms, logos and end zones (https://en.wikipedia.org/wiki/Retro_Bowl).
- **Camera:**
  - The field runs **horizontally** and the offense drives left to right. A high sideline camera with strong vertical foreshortening shows roughly the whole field width.
  - About 35 yards are visible across a landscape screen.
  - The top edge is a sideline strip with bench, coaches, cheerleaders and a chain crew.
- **Screen and pixel size:** about 7 screen px per art px on a 2208x1242 screenshot, so roughly **315x177 art px** on screen.
- **Players:**
  - About **15-16 px tall and 8-9 px wide**: 8-bit proportions with no black outline.
  - Flat team-color jerseys and pants, dark helmets with a light stripe or facemask, and a small shadow.
  - **No numbers are readable on the field sprites.** Identity is shown with a yellow highlight outline plus a star over the selected player, and drawn route arrows.
  - A player is about 1.8 yards tall in field units, about 2-3x real scale.
- **Field and UI:**
  - Yard numbers, hash marks, end zones painted in team color with lettering.
  - A full-width black score strip at top in a pixel font.
  - The kick meter is a plain red, green and black bar.
- **Portraits:** draft and press screens use bigger bust portraits, about 32 px tall, separate from the field sprites. This is a cheap way to show faces.
- **Passing:**
  - You pull back to throw. Tapping the screen with a second finger turns it into a bullet pass (https://gamerjournalist.com/how-to-throw-a-bullet-pass-in-retro-bowl/).
  - Exact arc and aim-line details aren't confirmed by any reliable source I found. Our ARCADE-V2 spec already defines its own slingshot with a dotted arc.
- **Frame counts:** not published.

### What to borrow (feel, not art)

- High 3/4 overhead camera, a horizontal court or field in landscape, a 1-px outline, 3-tone shading and floor shadows.
- A big home logo and team-colored paint or end zones.
- Pixel-font score bars, plain colored meters, and a highlight outline on the player you control.
- **Do not copy:** their characters, heads, palettes, logos or layouts pixel for pixel. Our players should differ visibly. Use semi-chibi proportions (about 4 heads tall, not Hoop Land's 2), real height differences, and our own head designs.

---

## 4. Recommendation and spec

### 4a. The path

Build all players, crowds, courts and fields in code. No external character art.

1. **Skeleton and poses** (already started in `src/game/pixel/rig.ts`): joint angles per keyframe with lean, crouch and lift, seen through a tilted orthographic camera.
2. **Hand-made pieces** in code as text grids:
   - Basketball heads: front, back and 3/4 views; 10-12 hair styles, beard options, headband and face details.
   - Football helmets: front, back and 3/4, with stripe and facemask variants.
   - Hands, shoes and the 3x5 digit font.
3. **Drawing into an index grid:** limbs as thick lines and capsules with a depth test (the near arm in front of the chest), the torso as a polygon, then outline, shading and L-corner cleanup.
4. **Coloring:** map indices to RGBA through the team's palette for home or away, at bake time.
5. **Caching:**
   - Bake each frame the first time it's used into a per-player atlas at 1x resolution. Draw it scaled by a whole number with smoothing off.
   - A 64x64 RGBA frame is 16 kB at 1x. Cropping to the bounding box and baking only what's used keeps it to about 1-3 MB per player.
6. **Courts, fields, crowds and scoreboards** in the same pipeline, so the home team's colors run through everything.
7. **Free assets used** (optional): m5x7 (CC0) for score digits and Kenney Pixel UI panels (CC0). Credit Kenney and Daniel Linssen anyway; it's free goodwill.

Plan B, only if dunks or throws look stiff after a real try: block out those few moves in Blender from Mixamo or Rokoko clips. Render them orthographic at final size with flat per-material ID colors to get the index maps directly, then color them in code the same way.

### 4b. Screen and scale

- Draw at a virtual resolution whose short side is **270 art px**. The long side fills the screen.
- Scale = `floor(shortSideDevicePx / 270)`, at least 2: 4 on 3x phones, 3 on 2x tablets in portrait. Only draw at whole art-pixel positions.
- Draw UI text (names, menus) at device resolution on top, not in the pixel layer.
- Optional "broadcast" close-up at 2x the scale for free throws, dunk replays and touchdowns, as Hoop Land does.

### 4c. Body size from real data

Basketball: body height in art px = `round(inches × 0.52)`. That is true to scale, because the head stays a fixed size and the legs and torso take the difference.

| Height | 5'9" | 6'0" | 6'3" | 6'6" | 6'9" | 7'0" | 7'3" | 7'6" |
|---|---|---|---|---|---|---|---|---|
| Art px | 36 | 37 | 39 | 41 | 42 | 44 | 45 | 47 |

- Head is 10 px tall without hair; hair adds 0-3 px. Proportions are about 4 heads tall, semi-chibi.
- Shoulder width = `round(0.29 × body px)`, plus a build bonus from BMI (`703 × lb / in²`):
  - under 23: +0
  - 23-26: +1
  - 26-29: +2
  - 29 and up: +3, plus 1 px thicker arms and legs

Football: body height in art px = `round(inches × 0.36)`. That gives 5'8" = 24, 6'0" = 26, 6'3" = 27, 6'6" = 28, 6'8" = 29.
- The helmet is 8 px.
- Shoulders = `round(0.42 × body px)`, plus BMI bonus +0 to +3, plus pads by position: OL and DL +1, WR, CB and S −1.
- A 330-lb tackle is visibly wider than a 180-lb corner.

### 4d. Palette (one byte per pixel, at most 32 slots)

| Slots | Meaning |
|---|---|
| 0 | Transparent |
| 1 | Outline (near-black `#1b1622`, or a darkened neighbor) |
| 2-4 | Skin: shadow, base, light. Keep the README's current one-skin-tone policy unless the owner decides otherwise |
| 5-7 | Jersey primary: shadow, base, light |
| 8-9 | Trim, piping |
| 10-11 | Number fill, number outline |
| 12-14 | Shorts / pants: shadow, base, light |
| 15-16 | Socks |
| 17-18 | Shoes, sole |
| 19-20 | Hair |
| 21-22 | Headband, sleeve, accessory |
| 23-26 | Football helmet: shadow, base, light, stripe |
| 27 | Facemask |
| 28-29 | Eye white, eye dark |

- **Building the ramps:** each team hex makes a 3-tone ramp. The shadow is darkened and shifted toward cool blue-purple; the light is lifted and shifted warm. Very dark and very light bases get special-cased so black and white uniforms still read (`src/game/pixel/color.ts` already does this).
- **Home and away:** home is the primary-color jersey with trim and numbers in the secondary color (or white). Away is a white or alternate jersey with primary trim and primary numbers.
- **Clash check:** if the two teams' jersey colors are within about ΔE 20-25 (OKLab), the visitors switch to their alternate. Same favorite team on both sides means the rival wears the away set, as the spec says.
- **Ball shadows and floor shadows** are separate translucent ellipses, not palette entries.

### 4e. Numbers

- Use the 3x5 digit font, 1 px between digits, a 1-px outline in the number-outline slot, and center it on the torso. Two digits take 9x7 px with the outline. That fits every basketball torso (11 px or wider) and football torsos of 9 px or wider.
- The narrow "1" is 1-2 px wide, so "11" still fits.
- **Front view:** number on the chest. **Back view:** number on the back. **3/4 views:** keep the number but squeeze it 1 px if the torso is foreshortened.
- Use 3/4 front and 3/4 back facings rather than pure profiles, so the number is visible in almost every frame. Football at 24-29 px has no room for readable sleeve numbers.
- **Mirroring:** the left-facing sprite is the right-facing body mirrored. **Draw the number after mirroring**, or it reads backwards.
- In the 2x close-up the same digits simply get bigger. A crisp UI label (name and number) can float over the ball carrier or shooter for readability; it is not a replacement for the number on the jersey.

### 4f. Facings

- **Basketball:** front, back, 3/4 front right, 3/4 back right. Left is the mirror.
- **Football:** the same four. In landscape the offense moves right, so most frames are 3/4 right. In portrait the offense moves up, so back views dominate, which shows numbers well.

### 4g. Animation list

The game runs at 60 Hz. Each drawn frame is held 5 ticks (12 fps) unless noted. Run cycles scale playback to speed (8-15 fps). Contact frames (release, catch, tackle, rim hang) are held 2-3x longer. The ball is always a separate sprite: each frame exports a hand anchor, and the ball follows it, or physics when it is released.

**Basketball (about 85 frames per facing for v1; the full list is about 150)**

| Animation | Frames | Notes |
|---|---|---|
| Idle, no ball | 4 | Loop; breathing done with sub-pixel shifts |
| Idle, dribbling in place | 6 | Ball touches the floor on frames 3 and 6 |
| Run | 8 | Loop |
| Run dribbling | 8 | Bounce every 4 frames |
| Sprint (turbo) | 8 | More lean, longer stride |
| Defensive slide | 6 | Loop |
| Crossover / between the legs / behind the back | 6 each | v1: crossover only |
| Spin move | 8 | 1 smear frame |
| Step-back | 6 | |
| Pass (chest/bounce) | 5 | |
| Catch | 3 | |
| Jump shot | 11 | Gather 2, rise 3, set and release 2 (the release frame lines up with the meter's green window), hang 2, land 2 |
| Free throw | 8 | |
| Layup | 9 | |
| Floater | 8 | |
| Dunk: one-hand / two-hand | 10 each | Hang on rim: 4 (loop) |
| Dunk: tomahawk / reverse | 12 each | Later |
| Dunk: windmill | 14 | Later |
| Dunk: contact / posterizer | 12 | Defender knocked down: 8, gets up: 6 |
| Block | 7 | |
| Rebound | 8 | |
| Steal reach | 5 | |
| Pump fake | 4 | |
| Celebrate | 8 | Loop |
| Dejected | 4 | Loop |

**Football (about 70 frames per facing for v1)**

| Animation | Frames | Notes |
|---|---|---|
| Stance (2- or 3-point) | 2 | Breathing loop |
| QB under center / shotgun | 2 | |
| Idle upright | 4 | |
| Run | 8 | |
| Run with ball (tucked) | 8 | |
| Sprint | 8 | |
| QB drop-back | 6 | Loop |
| QB set and aim | 2 | Held while the slingshot is dragged |
| Throw | 7 | Wind-up 3, release 2 (ball leaves on frame 4), follow-through 2 |
| Hand-off give / take | 4 each | |
| Catch | 4 | Hands up 2, secure 2 |
| Diving catch | 7 | |
| Juke | 5 | Spin, stiff-arm and hurdle are gated by ratings |
| Spin | 8 | |
| Stiff-arm | 5 | Arm out held |
| Hurdle | 7 | |
| Dive forward | 6 | |
| Block engage (OL vs DL) | 4 | Loop |
| Pass-rush swim | 6 | |
| Tackle lunge / wrap | 6 | |
| Tackled: fall | 6 | |
| On the ground | 1 | |
| Get up | 5 | |
| Kick (FG/punt) | 8 | Holder: 2 |
| Kickoff | 8 | Later |
| Celebrate | 8 | Loop |
| Spike | 6 | Later |
| Referee touchdown signal | 4 | |

The thrown ball is a separate sprite with a ground shadow. Its height is drawn as a vertical offset, and the shadow shows where it will land.

### 4h. Courts, fields, crowds, UI (all code-drawn)

- **Basketball court:**
  - Wood planks from 2-3 tones with dithered grain, and lines 1 px.
  - Paint and center logo in the home team's colors, with the home team name along the baseline in a pixel font.
  - Hoop and backboard drawn in perspective, with the rim as a separate front and back layer so the ball passes through.
- **Football field:**
  - Striped grass in 2 tones with noise, yard numbers in a big blocky font, hash marks.
  - End zones in team color with the team name.
  - A sideline strip with bench players (the same rig at idle) and a crowd band.
- **Crowd:** tiny seated rig figures (8-10 px), 2-frame cheer, shirts 60% home colors. Each row is baked once and animated by swapping rows.
- **UI:** a score bar in m5x7 (or our own digit font). Plain-rectangle meters in the pixel layer: a shot meter with a green window, a kick meter. Kenney Pixel UI 9-slice frames for menus inside the game screen.

### 4i. Quality checks before shipping

- At 1x, a 5'9" guard, 6'8" forward and 7'2" center standing side by side read clearly as different heights and builds.
- Every number from 0 to 99 is legible at scale 4 in front and back views. Mirrored sprites never show reversed digits.
- Every team in the data (both sports, home and away) passes the clash check and keeps outline contrast against the court or grass.
- No sprite or camera moves by less than a whole art pixel; the frame is scaled by a whole number on 2x and 3x phones.
- Side-by-side with a Hoop Land screenshot at the same screen size, our players are at least as big and detailed, and visibly not the same characters.

---

## Sources

- Hoop Land Steam page and store data: https://store.steampowered.com/app/2453660/Hoop_Land/ and https://store.steampowered.com/api/appdetails?appids=2453660 (screenshots and the 1080p60 trailer measured for section 3)
- Hoop Land MDA analysis: https://mechanicsofmagic.com/?p=51442
- Retro Bowl App Store (screenshots measured): https://apps.apple.com/us/app/retro-bowl/id1478902583
- Retro Bowl making-of, PocketGamer.biz: https://www.pocketgamer.biz/interview/77507/new-star-games-simon-read-retro-bowl-making-of/
- Nintendo Life on Retro Bowl and Retro Goal: https://www.nintendolife.com/features/from-retro-bowl-to-retro-goal-how-new-star-games-returned-to-its-grass-roots
- Retro Bowl on Wikipedia: https://en.wikipedia.org/wiki/Retro_Bowl
- Retro Bowl bullet pass: https://gamerjournalist.com/how-to-throw-a-bullet-pass-in-retro-bowl/
- Wargroove palette swapping: https://wargroove.com/palette-swapping/
- Dead Cells 3D-to-2D pipeline: https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
- RotSprite: https://info.sonicretro.org/RotSprite
- Sub-pixel animation: https://tinywarriorgames.com/2019/01/04/game-development-pixel-art-sub-pixel-animation/ ; https://saint11.org/blog/pixel-art-tutorials
- OpenGameArt FAQ (multiple licenses): https://opengameart.org/content/faq
- LPC generator: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator ; original LPC sheets: https://opengameart.org/content/character-animations-clothes-armor-weapons-skeleton-enemy-combat-dummy
- Mixamo FAQ (community copy): https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400 ; Mocap Online review of Mixamo sports coverage: https://mocaponline.com/blogs/mocap-news/mixamo-alternatives-character-animations ; Rokoko free sports mocap: https://rokoko.com/resources/rokoko-mocap-12-free-sports-animations
- Tools: https://github.com/LibreSprite/LibreSprite , https://github.com/Orama-Interactive/Pixelorama , https://github.com/piskelapp/piskel , https://gitlab.com/GrafX2/grafX2 , https://github.com/aseprite/aseprite (EULA.txt)
- Every asset URL is in its table in section 1.
