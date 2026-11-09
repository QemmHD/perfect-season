# Team players: build plan

Real-life likeness, card faces, and animation that looks real. Branch `claude/studio-players`, worktree `/home/user/ps-s-players`, dev-server port 5214.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`. Sources read in full: `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-players.md`, `O/audit-likeness-animation-perf.md`, `O/research-likeness-animation.md` and `O/audit-ut-ui.md`. Also read: the animation and identity sections of `O/audit-nba.md` (§6–8, §10, §12–13), `O/audit-nfl.md` (§7–8, §10–12) and `O/audit-soccer.md` (§6.4, §7, §9, §11, §13). The other teams' STREAM briefs were read for the hand-offs.

## 1. Goals

1. **"So we know who is who."** Every surface draws a player from one typed appearance record: all three match engines, UT cards, draft cards, the poster, and portraits for other teams' screens. That record holds skin tone, hair, facial hair, gear, build from height and weight, and handedness or preferred foot.
   - About 150–180 hand-curated stars per sport come from widely known public appearance.
   - Everyone else gets neutral, era-plausible defaults. Defaults never contradict a star's known look, because curated entries override them.
2. **Animation that reads like the respected games.**
   - The nearest players never freeze (A-1).
   - Clip changes blend instead of cutting (A-2).
   - Feet stay planted (A-5).
   - Recorded clips replace stick poses (A-3).
   - Stars move like themselves (A-4).
   - Contact has weight: hit-stop, shake, reactions and the crowd.
3. **Cards that look like a production UT.**
   - A big front-facing pixel bust on every card.
   - A distinct frame per edition and promo.
   - Readable type (at least 10 design px) and original team badges.
   - A CardDetail sheet that never leaves the app and never names other games.
4. **Everything render-only.** Simulation code is untouched, so no protocol bump. Tests prove it.

## 2. Constraints this plan is built around

- **Lane.**
  - We own `src/game/pixel/**`, `src/game/sprites.ts`, `src/game/uniforms.ts` and `src/data/mocap/**`.
  - We own new `src/game/pixel/appearance*.ts`, `src/data/appearance/**` and `scripts/build_appearance*`.
  - We own the card faces: `src/ut/CardArt.tsx`, `card-face.ts`, `card-editions.css`, `CardDetail.tsx`, `CardSerial.tsx`, `src/ui/Card.tsx`, `src/ui/Binder.tsx`, `src/ui/poster.ts` and the `.utc*` / `.tc-*` / `.card*` face blocks in `styles.css`.
  - In the three `render.ts` files we own only the player-drawing parts: `lookFor`, `poseOf`, `animOf`, `gait`, `sprite()` and the bodies loop in `draw()`.
  - **Strategy against merge conflicts.** Each sport team will be editing its own `render.ts` (camera, HUD). Put all new logic in new modules under `src/game/pixel/`, and keep each `render.ts` hunk a thin call. Never reformat or reorder those files.
- **New files we create and claim as players-owned:**
  - `src/game/pixel/{appearance,looks,raster,head,bust,portrait,blend,locomotion,sprite-budget,impact,motion-dna,celebrate}.ts` and `LooksGallery.tsx`
  - `src/ui/PlayerPortrait.tsx`
  - `src/ut/card-frames.ts`, `src/ut/card-frames.css`, `src/ut/TeamBadge.tsx`, `src/ut/WalkoutFigure.tsx`
  - `scripts/qa/players-*.mjs`
- **Outside our lane, kept to a few lines and listed in the team doc:**
  - `src/game/juice.ts` (owned by nba and nfl): a hit-stop cap of about 8 lines (players-8).
  - Nothing else is planned.
- **Saves.**
  - No storage keys, card, edition or copy ids, or saved fields change.
  - Appearance is shipped static data, not saved state. Portrait caches live in memory only.
  - `portraitUrl(line, pose)` and `lookOf(line)` keep their signatures, because ut's `play-art.tsx` uses them.
- **Protocol.**
  - Rendering reads engine state (`b.act`, `b.p.*`, positions, `p.end`) and never writes it. The engines never import appearance or pixel code.
  - Online play is unaffected, because each phone draws its own view.
  - If any piece would change sim timing, stop and write "Protocol bump needed: <sport> draft/UT, because …" in the team doc. None is planned.
- **Bundle.**
  - Appearance data loads per sport from lazy chunks (game and UT), never in first paint.
  - Draft cards are in the main bundle (`Draft.tsx`, `Results.tsx`), so they reach the portrait code only through `import()`.
  - `src/game/pixel/color.ts` is imported by `src/ui/Favorites.tsx` (main bundle), so no palettes go there.
- **Guardrails on likeness data.**
  - No race, ethnicity or nationality field.
  - No trait is derived from name, nationality, birthplace, team or position.
  - No classifiers, tattoos, logos or brand marks.
  - Accuracy beats count: an uncertain field is left to the default.
  - Preferred foot from the CC0 Transfermarkt dataset is a recorded fact, not an inference, so it is allowed.
- **Code rules.**
  - Branch on the sport with `pick({ nba, nfl, soccer })` / `pickFor(sport, …)`, never a two-way ternary. `sport-branches.test.ts` enforces this.
  - Rendering-only randomness is fine, but appearance defaults are seeded by pid hash so every phone draws the same look.
  - Taps are untouched: portraits and frames are not tap targets.
  - The 390 frame is kept, with no width media queries.
- **Machine rules.**
  - Every `tsc`, `vitest`, Playwright or long vite-node run goes through `bash O/heavy.sh`.
  - Dev server: `nohup npx vite --port 5214 --strictPort > /tmp/ps-players-vite.log 2>&1 & echo $! > /tmp/ps-players-vite.pid`. Stop it with `kill $(cat /tmp/ps-players-vite.pid)`.
  - Never use `pkill -f` or `pgrep -f`.
  - Every Playwright context aborts non-localhost requests (Google Fonts excepted), opens `?ns=inspect&relay=ws://localhost:7777`, and uses the harness from `O/audit-scripts/utui/lib.mjs`.
  - Own checks run at 393×852 (insets 59/34) and 320×568 with `deviceScaleFactor: 1`. Pixel close-ups may use DPR 2.
- **Test commands.**
  - NBA: `npx vitest run src/game/pixel …`
  - NFL: `PS_SPORT=nfl npx vitest run …`
  - Soccer: `PS_SPORT=soccer npx vitest run soccer sport-branches`. This only picks up files with "soccer" in the path, so soccer-specific tests are named `*-soccer.test.ts`.
  - The full `npm test` and one `npm run build` happen only in players-10.

## 3. Baselines to beat (from the audits)

| Area | Baseline | Target (task) |
|---|---|---|
| Stale body draws, NFL autoplay | 41.3% overall; by size: 24–31 px 36.2%, 32–47 px 60.0%, **48–71 px 81.0%** | ≥48 px **<2%**, 32–47 px <5%, overall <10% (players-1) |
| Stale draws, NBA / soccer | NBA 72+ px 8.4% (4.5% overall); soccer ≤0.9% | NBA ≥48 px <2%; soccer stays ≤1% (players-1) |
| New sprite drawings | NFL 231/s (at the cap of 4 a frame), NBA 146/s, soccer 142/s | Within a ≈3 ms/frame time budget (players-1) |
| In-match fps, 4× CPU (prod build) | NBA 390: 54.8 fps / p99 33.4 ms; NBA 430: 51.8 / 50; NFL 390: 57.5 / 33.4 | At or above baseline. Frames over 20 ms no worse than +10%. 1× holds 60.0 everywhere (players-1, players-10) |
| Pose jump at hard cuts (share of body height) | kick→run 59.8%, jumper→ready 53.5%, run→kick 52.7%, sprint→stiff-arm 44.6%, run→crossover 44.1%, run→jumper 42.2%, sprint→juke 33.0%, run→dunk 32.4%, ready→contest 26.7%, ready→pass 22.4% | Every listed cut **≤20%** (the run clip's own p95 is 18.5%) (players-5) |
| Foot sliding | NBA **29.1%** of on-ground frames; soccer **12.8%**; NFL QB drop skates 6.5 yd on the idle clip | NBA ≤8%, soccer ≤4%, NFL drop 0 idle-while-moving frames; planted foot drift ≤1 px at 40 px (players-5) |
| Animation rate | Clips 15 fps, idles 10 fps, <22 px 10 fps; facings snap 45° | Near/large/ball players ≥28 effective fps; ≤1 facing step per drawn frame (players-5) |
| Body width at 40 px (torso) | Curry 17, Giannis 19, Jokić 19, Shaq 20, Bol 20 | Shaq ≥24, Curry ≤18, Bol ≤18 (≥5 px narrower than Shaq), Jokić−Giannis ≥2 px, BMI 31 vs 20 ≥25% wider (players-4) |
| Identity | One skin `#a8714f`, one hair colour; hashed hair and beard (bald Iverson, high-top Shaq, dark-haired Haaland, bearded Mbappé) | 12 NBA stars in one shared kit are pairwise distinguishable (players-4) |
| Numbers | Gone below ≈26 px when turned; scrambled at 40 px ("80" a block, "88" a "B"); fixed 4×7 font | Legible front-on from 28 px; never scrambled (exact glyphs or hidden); 6×10 font at ≥60 px (players-4) |
| Card art | Head ≈8 px on the 80-px club card; figure ≈52 px; art 141 px on the 150-px detail card | Bust head ≥24 CSS px at 80, ≥45 at 150, ≥57 at 190, ≥14 at 44 (players-6) |
| Card text and badges | Card text 3–9 design px; badge contrast as low as 1.25:1 (VIL), 1.28 (LPA), 1.76 (PIT) | All readable card text ≥10 design px on cards ≥76 px; badge ink ≥4.5:1 for every team (players-7) |
| Brand and links | "2K"/"Madden" benchmark link, `target=_blank` (`CardDetail.tsx:160-166`) | Plain in-app text, no brand names (players-7) |

The players-1 harness re-measures every baseline on this machine's dev server first, so before and after use the same method. The audit's fps figures come from a production build, and a full build is only allowed in players-10, so in-task fps comparisons are dev-vs-dev. players-10 repeats them on a production build.

## 4. Scope map: every brief item, with the task that delivers it

| STREAM item | Task |
|---|---|
| P0 appearance record and `appearanceFor(sport, playerId, season?)`: skin (10 tones, own shadow/highlight/outline), hair ≥18 + colour, facial ≥8, headband/goggles/NFL visor and tint, sleeves L/R, leg sleeve/knee pad, socks, shoes, build from ht+wt (soccer weight default by position and height), hand/foot, per-era overrides | players-2 (model), players-3 (data), players-4 (drawing) |
| Curated 150+ marquee players per sport, accuracy over count | players-3 |
| Guardrails (no race field, no inference, no tattoos or logos) | players-2 (key whitelist test), players-3 (curation rules) |
| Uncurated players: era/position-seeded neutral defaults, neutral skin; curated entries override the misleading hash | players-2 (defaults), players-4 (renderers stop calling `hairFor`/`beardFor`) |
| Weight changes the silhouette; one build formula for match and card | players-2 (`weightFor`), players-4 (`shapeOf` widths, test) |
| Data ≈20 KB gzip per sport, lazy with game/UT chunk, optional source + build script + sync test | players-2 |
| Wire looks into all three engines (`render.ts` player sections + `body.ts`) | players-4 |
| Detail scales with sprite height; up to +25% head at small sizes | players-4 |
| Numbers readable from 28 px | players-4 |
| Recolour the crowd from the same palettes | players-4 (recolour); players-9 (reaction frames) |
| Before/after screenshots: NBA five, NFL lineup, soccer XI, close-ups → `O/shots/players/` | players-1 (before), players-4 (after), players-10 (final set) |
| A-1 sprite budget: near-first, cache by quantised pose/size, time budget; <2% stale for nearest; 60 fps; acceptable at 4× | players-1 |
| A-2 blends over 4–6 frames; contact frames locked to game time | players-5 |
| A-5 foot sliding; gait 0.8–1.25×; higher rates; facing snaps | players-5 |
| A-3 wire unused clips (dribble, crossover, cut, stiff arm, get-up front); replace stick poses (dunks with a circling windmill, spin, pass, block, NFL juke/stiff/truck); distinct block/rebound/contest; soccer keeper dives, slide tackles, dribble touches, L/R kicks by foot, get-ups | players-8 |
| A-4 render-only signature motion (shot speed/height/set point/fade, dribble style, QB arm slot and hold, run style, celebration); curated stars plus rule defaults | players-9 |
| Juice: hit-stop 33–120 ms with a capped budget; shake by mass × speed | players-8 (`impact.ts` and cap) |
| Juice: teammate run-in celebrations; crowd reactions in 6–12 frames | players-9 |
| H2/H3/L-4: front-facing bust on every card, much larger than today's | players-6 |
| Edition frame system (bronze/silver/gold distinct, rare shimmer, every promo/program/special its own frame, premium GOAT and Spotlight) | players-7 |
| Legible typography (OVR and position large, name readable, attribute labels ≥10 design px) | players-7 |
| Readable original team badges in team colours | players-7 |
| Draft cards get the portrait instead of initials | players-6 |
| Collection silhouettes become recognisable; give ut a component and document it | players-6 |
| CardDetail: remove 2K/Madden links (H6), stay in the app (M11), bigger portrait, rich stat layout; leave the sticky bar to shell | players-7 (links, layout), players-6 (portrait) |
| Portraits canvas/SVG-drawn and cached; a 100-card grid scrolls smoothly | players-6 (portrait cache), players-7 (frame CSS cost) |
| Audit L-5 data side (NFL/soccer missing numbers), L-6 kit patterns, A-6 non-player figures and 2× labels | See §6 (L-6 soccer patterns are a players-4 stretch item) |
| Team doc, "simulation untouched" statement, owner device checks | players-10 (updated by every task) |

## 5. Ordered tasks

Each task ends with its own focused tests (via heavy.sh), screenshots it looked at, an update to `docs/studio-overhaul/players.md`, a commit staged by explicit paths with a `Claude: ` message and the trailer, and `git push -u origin claude/studio-players`.

---

### players-1 · P0 · Measurement harness, baselines and the near-first sprite budget (A-1)

**Why first.** A-1 is the critical animation bug ("the game is lagging" at 60 fps) and is independent of the likeness work. The harness and the "before" captures must exist before anything changes how players look.

**Changes**

1. **Harness** in `scripts/qa/`, all isolated, port 5214, writing to `O/shots/players/` and printing JSON.
   - Shared: `scripts/qa/players-lib.mjs`. It copies `O/audit-scripts/utui/lib.mjs`: route-abort, `?ns=inspect&relay=ws://localhost:7777`, `__psInsets`, the localhost fixture, and the text-size, contrast and overflow audit helpers.
   - Ported from `O/audit-scripts/likeness/*.cjs`, with the repo root, port and output directory parameterised:
     - `players-sprites.mjs`: `spritestats` + `stalebypx`. Hit rate, new/s, stale by size bucket, `?arcade&auto&seed=spr` for NBA/NFL and `?soccer-lab&auto` for soccer.
     - `players-matchperf.mjs`: rAF fps, p99 interval, frames over 20 ms, rAF cost p99. 1× and 4× CDP CPU throttle, at 393×852, 430×932 and 320×568.
     - `players-lineup.mjs`: twelve stars per sport as the app draws them, in their own kits and one shared kit, at 24/40/60 px plus the card portrait.
     - `players-strips.mjs`: action strips and pose jumps at cuts.
     - `players-cards.mjs`: club grid, detail and reveal screenshots, plus card text sizes, badge contrast and portrait head size via a DOM probe.
2. **Before captures**, saved as `O/shots/players/before-*.png`:
   - lineups for NBA, NFL and soccer
   - card club, detail and reveal at 393 and 320
   - in-game frames
   - action strips
   Record every baseline number from §3, re-measured here, in the team doc.
3. **`src/game/pixel/sprite-budget.ts`** (new, pure):
   - `interface DrawReq { who: string; px: number; must: boolean; staleFor: number; near: number }`
   - `class SpriteBudget { begin(now: number, frameMs: number); order(reqs: DrawReq[]): DrawReq[]; allow(): boolean; spent(ms: number); stale(who): number }`
   - **Order:**
     - `must` first: the ball carrier or handler, the pass target, his nearest defender.
     - Then a score of `px + 24·staleFor`. Anyone ≥32 px who has been stale for 2 frames is forced.
   - **Budget is time, not count.** It stops once measured `drawBody` time passes 3.0 ms, or 2.0 ms when the last frame interval was over 20 ms. Minimum 3 draws, hard cap 14.
4. **In each `render.ts` `draw()`:**
   - Resolve sprites in priority order into a `Map<who, Sprite>`, then draw them in the existing depth order. Painter's order is unchanged.
   - The hunks:
     - NBA: `hoops2/render.ts` `sprite()` and the loop near line 722.
     - NFL: `football2/render.ts` `sprite()` and the loop near line 794 (`order` far-to-near).
     - Soccer: `soccer2/render.ts` `sprite()` and the loop near line 742.
   - `this.budget = 4|5` becomes `this.budget.begin(...)`.
5. **Size quantisation**, `quantPx(raw)` in `sprite-budget.ts`: 1 px steps ≤14, 2 px steps ≤30, 4 px steps ≤60, 6 px steps above. Camera zooms then stop emptying the cache. The blit stays 1:1, so pixels stay crisp.
6. **Pre-warm.**
   - When nothing is being drawn new (pre-snap, before a possession or attack, after a replay), spend up to 2 extra draws a frame.
   - It draws the next gait frames (jog/run/sprint/ready at the body's current facing and size) for the 6 nearest bodies, plus `requestIdleCallback` where available.
7. **Cache caps.** Raise the cache caps only if the measurement shows evictions causing misses: NBA 360 → 480, NFL 600 → 800, soccer 700 → 800. Keep `CanvasOut` recovery and `freeCanvas` as they are.

**Tests and measurements**

- **`src/game/pixel/sprite-budget.test.ts`, on a synthetic 22-body frame sequence:**
  - the carrier is always fresh
  - no body ≥32 px is stale more than 2 frames in a row under a 4-draw-equivalent budget
  - order is `must` > size
  - `quantPx` is monotone and idempotent
- **`players-sprites.mjs`, before and after:**
  - NFL stale ≥48 px <2%, 32–47 px <5%, overall <10%
  - NBA ≥48 px <2%
  - soccer ≤1%
- **`players-matchperf.mjs`, dev-vs-dev:** 1× holds 60.0 fps; at 4× fps is at or above before, and frames over 20 ms are no worse than +10%.
- **Heap:** `players-matchperf.mjs` reads CDP heap after GC. It must not rise more than 10% over 40 s of play.

**Screenshots.** `before-*` (above). `after-a1-nfl-390-{0..5}.png`: autoplay frames with the line and backfield in close-up.

**Protocol impact.** None. Rendering order and budget only.

**Save risk.** None.

**Other teams.** Shell owns overall perf. Report the numbers to them through the team doc.

---

### players-2 · P0 · Appearance model, palettes, one build formula, neutral defaults, data pipeline and lazy loader

**Why now.** It is the enabling layer for data (players-3), drawing (players-4), cards (players-6, players-7) and motion DNA (players-9).

**Changes**

1. **`src/game/pixel/appearance.ts`** (new). Types and enums from research §3.1:
   ```ts
   export const HAIR = ['bald','buzz','short','fade','waves','hightop','afro-s','afro-l','twists','locs-s','locs-l','braids','bun','long','mohawk','mullet','curly','receding'] as const; // 18
   export const HAIR_TONE = ['black','dark-brown','brown','light-brown','auburn','ginger','blond','platinum','grey','red','blue','green','pink','purple','team'] as const; // 15
   export const FACIAL = ['none','stubble','mustache','goatee','chinstrap','short','full','long'] as const; // 8
   export const HEAD = ['none','band-thin','band-wide','wrap','alice','skullcap'] as const;
   export const EYES = ['none','goggles','mask-clear','visor-clear','visor-dark','visor-tint'] as const;
   export const ARM = ['none','sleeve','shooter','elbow','wrist','tape','long'] as const;
   export const LEG = ['none','kneepad','kneesleeve','brace','tights','calf'] as const;
   export const SOCKS = ['low','crew','high','over-knee'] as const;
   export const ACCENT = ['white','black','team1','team2','neon','gold','tone'] as const;
   export const BUILD = ['lean','avg','muscular','stocky','heavy'] as const;
   export interface Appearance { v: 1; skin?: number /*0-9*/; hair; hairTone; facial; head; headC?; eyes; armL; armR; armC?; legL; legR; legC?; socks; shoe; gloves?; towel?; build?; hand: 'R'|'L'; foot?: 'R'|'L'|'B'; motion?: MotionDNA /* filled in players-9 */; src: 'curated'|'default' }
   export type LookEra = { from: number; to: number } & Partial<Omit<Appearance,'v'|'src'>>;
   ```
   - **Skin.** `SKIN_TONES`: the 10 Monk Skin Tone anchors with research §3.2's shadow, highlight and outline. Saturation is raised 8–15% for game pixels. `skinRamp(i)` returns `[shadow, base, light, outline, rim]`, where `rim` is a 1 px lighter edge for tones 7–9.
   - `NEUTRAL_SKIN = '#a8714f'` stays exactly as today for every uncurated player.
   - **Hair tones.** `HAIR_TONES` holds the 15 hexes from research. `'team'` resolves to kit c1.
   - **Level of detail.** `detailFor(px)` implements the LOD table in research §3.3. `headScale(px) = clamp(1 + (32 − px)/64, 1, 1.25)`.
   - **Build.** `weightFor(sport, htIn, wt | null, pos)` is the one shared formula. It returns the real weight when known. Otherwise:
     - Soccer uses a BMI by position: GK 23.5, CB 23.6, FB 22.3, DM/CM 22.6, AM/W 22.0, ST 23.2. Messi gets one weight in the match and on his card, ending today's 146 vs 157 lb split.
     - NBA/NFL keep the `teams.ts` SIZE fallbacks.
   - **Defaults.** `defaultAppearance(sport, pid, season, pos)` is seeded by `hash(pid + ':field')` per field:
     - skin is always neutral
     - hair is drawn only from the neutral silhouettes for the era: short/fade/buzz/waves/crop; 1970s NBA adds afro-s at ≈15%; NFL draws only under-helmet hair (long/locs-l/mullet ≈10%); soccer long ≈8%
     - hair tone only from black, dark-brown or brown
     - facial: none 70%, stubble 15%, short 10%, goatee 5%
     - no headbands, goggles or sleeves by default
     - era-plausible socks and shoe colour
     - hand R. Foot comes from data, else R.

     This drops the hashed headbands and beards that misled.
   - **Lookup.** `appearanceFor(sport, pid, season?, ctx?)` resolves base, then the era override, then defaults. It is memoised.
   - **Id parsing.** `refOf(sport, engineId): { pid: string | null; season: number | null }` parses every id form the engines carry:
     - draft `CHI-1990:jordami01`, using the cell decade as the season
     - UT `nba:season:1996:jordami01:CHI`
     - `holo~…` and `evo~a+b~…`
     - live `nba:live:<promo>[.f]:<season>:<pid>:<fr>`
     - soccer engine `108830:2019:BAR`
     - `reserve:PG`, `depth:WR:…` and `squad-3`, which return null and use defaults
   - **Loading.**
     - `loadAppearance(sport): Promise<void>` uses `import.meta.glob('../../data/appearance/*.json')`, one chunk per sport, never imported by main-bundle code.
     - `appearanceReady(sport)`.
     - `appearanceVersion()` is incremented on load so caches can invalidate.
   - **Encoding.** `encodeAppearance` / `decodeAppearance` are shared with the build script.
2. **Compact data format**, `src/data/appearance/<sport>.json`:
   - `{ v: 1, sport, fields: [...], players: { [pid]: "<one base-36 char per field, '.' = default>[|<from>-<to>:<codes>]…" }, feet?: { L: string[], B: string[] }, motion?: {...} }`
   - About 25–35 bytes per curated player.
3. **Source format.** `src/data/appearance/source/<sport>.looks.json` holds one readable object per line with named enum strings plus `name`, `src` and `reviewed`. It is never imported by app code; the glob is one level deep and does not reach `source/`.
4. **`scripts/build_appearance.ts`** (vite-node):
   - `--build`: source to compact files
   - `--check`: exits 1 if out of sync
   - `--candidates <sport> [n]`: ranks pids by tier (GOAT/Legend), best overall and edition count from `cards-<sport>.json`, for curation
   - `--find <sport> <name>`: pid, seasons and teams
   - `--soccer-feet <players.csv.gz>`: used in players-3
5. **`src/game/pixel/looks.ts`** (new). The shared Look builders the renderers and cards switch to in players-4:
   - `matchLook(sport, ref, kit, { pos, ht, wt, gk, pads })`
   - `cardLook(line)`
   - Both return the existing `Look` plus `app: Appearance`. `Look` gains optional `app?` and `pattern?`.
   - The legacy `hair`/`beard` fields stay so `Scene.tsx` and the galleries keep working.
6. **Fixtures.** A handful of fixture entries (2–3 per sport) so the tests have curated rows. Real curation is players-3.

**Tests**

- `src/game/pixel/appearance.test.ts`:
  - enum validity and 18/15/8 counts
  - a key whitelist on `Appearance`: the test fails if `race`, `ethnicity`, `nation` or similar ever appear
  - uncurated players are always `NEUTRAL_SKIN`
  - a defaults snapshot for 30 fixed pids (stable)
  - defaults never pick blond, red, dyed, headband or goggles
  - era resolution
  - encode/decode round trip
  - `refOf` for every id form listed above
- `src/game/pixel/appearance-data.test.ts`:
  - every pid exists in `cards-<sport>.json` and its `name` matches
  - eras fall within that player's card seasons
  - the built file matches `--build` output (sync)
  - gzip size ≤20 KB per sport (`zlib.gzipSync`)
- `src/game/pixel/appearance-soccer.test.ts` (runs in the soccer suite): `weightFor` by position, Messi's match weight equals his card weight, foot decoding.

**Measurements.** Built file sizes, raw and gzip. The main bundle does not import `appearance.ts`; checked by grepping the import graph in the test (see players-4).

**Screenshots.** None (no visual change yet).

**Protocol impact.** None.

**Save risk.** None. Static data, no storage.

**Other teams.** Shell: three small JSON chunks of ≤20 KB gzip each. Ask whether `src/data/appearance/soccer.json` should join the on-demand soccer pattern in `vite.config.ts`; that is shell's file. By default the chunks precache.

---

### players-3 · P0 · Curated Tier A looks for NBA, NFL and soccer, plus soccer preferred foot

**Changes**

1. **Candidate lists** from `scripts/build_appearance.ts --candidates`:
   - every GOAT: 20 NBA (Jordan, Kareem, Wilt, LeBron, Duncan, Kobe, Magic, Hakeem, Oscar, Bird, Garnett, Russell, Giannis, Curry, Shaq, West, Durant, Dirk, Pippen, Wade) and 20 NFL (Peyton Manning, Rice, Brady, Barry Sanders, L. Taylor, R. White, A. Donald, B. Smith, R. Lewis, Brees, Payton, Ed Reed, E. Smith, Montana, Gonzalez, Mahomes, Deion, Lott, Moss, Gronkowski)
   - Legends
   - the top 60 by overall
   - the 25 with the most editions
   - current stars on the newest cards
2. **Author ≥150 per sport, aiming for 180**, in `source/<sport>.looks.json`, from widely known public appearance in that era.
   - **Fields:** skin index chosen visually, hair, tone, facial, head gear, eyewear, sleeves and knee gear with the side, socks, shoes, build override, hand, and soccer foot.
   - **NFL:** visor and tint, towel, gloves, under-helmet hair (for example Polamalu's long hair). The full hair also shows on the card bust.
   - **Era overrides** for long careers: Jordan's hair over time, Rodman's dyed seasons, Shaq early and late, Kareem's goggles era, and so on.
   - **Required examples, correct by era:** Shaq bald (late career), Iverson cornrows with headband and arm sleeve, Kareem goggles, Rodman's dyed hair by season, Haaland long blond hair, Mbappé short and clean-shaven, Brady.
   - **Uncertain fields are omitted.** Every entry has `src: "public photos, <years>"` and `reviewed: true`.
   - **Handedness** only where well known: Russell, Ginóbili, Harden, Mullin; Steve Young, Vick, Tua, Stabler; Messi, Robben, Salah, Maradona, Roberto Carlos, Bale.
3. **Soccer preferred foot from data.**
   - Download `players.csv.gz` once into the git-ignored `.cache/` from the CC0 transfermarkt-datasets mirror already used by `scripts/soccer_sources.py` (`TM_BASE`). The host answered HTTP 200 when this plan was written.
   - `--soccer-feet` writes `source/soccer-feet.json`: the `L` and `B` lists for pids present in `cards-soccer.json`, with R implicit.
   - Add a provenance line to `docs/CREDITS.md`.
   - If the download is blocked, keep the curated feet only and record that.
4. **Soccer build.** Run `--build` and commit the compact files.

**Tests and measurements**

- `appearance-data.test.ts` passes: pids, names, eras, sync, size.
- Counts per sport are ≥150 curated, including 100% of the GOATs and of the top-60-by-overall list.
- Soccer foot coverage: the share of soccer pids with a recorded foot is reported, with a target of ≥85%.
- Gzip size per sport is ≤20 KB, soccer included.

**Screenshots.** Not yet; players-4 renders them. Accuracy fixes found there go back into this data, as one-line edits.

**Protocol impact.** None.

**Save risk.** None.

**Other teams.** None. NFL number backfill is out of scope (§6).

---

### players-4 · P0 · Likeness drawn in `body.ts` and live in all three engines

Covers: skin ramps, hair, facial hair, gear, weight silhouette, LOD and head scale, numbers, crowd palettes and the render-only proof.

**Changes**

1. **Refactor without visual change first** (guard: a golden raster hash for 6 looks × 4 views before and after):
   - Move `Buf`, `buffer`, `put`, `capsule` and `ball` from `body.ts` into `src/game/pixel/raster.ts`.
   - Add a pure `rasterBody(look, pose|joints, view, px): { w, h, px: Uint32Array, ax, ay, handL, handR, top }`.
   - `drawBody` becomes `rasterBody` plus a canvas, so node tests can measure sprites without a DOM.
2. **`src/game/pixel/head.ts`** (new). `paintHead(buf, ox, oy, head, hr, frame, look, detail)`:
   - the 18 hair recipes from research §3.1, using `u`/`f`/`r` on the head sphere plus capsules for volume: high-top block, afro ring, locs and long hair as trailing capsules, bun/ponytail knot, mohawk strip
   - braids as hair/skin rows at ≥40 px
   - the 8 facial-hair region masks (stubble = `mix(hair, skin, .5)`)
   - headband/wrap colours from `headC`
   - goggles on the eye band
   - NFL helmet with a visor tint on the mask region (clear/dark/tint), and under-helmet hair at the nape
   - The LOD from `detailFor(px)` collapses hair silhouettes below 24 px and drops facial hair below 16 px.
   - The head radius is multiplied by `headScale(px)`.
   - The bust (players-6) reuses this module.
3. **`body.ts`:**
   - the `SKIN` and `SKINDARK` ramps come from `skinRamp(app.skin)`, with a 1 px lit-side rim for tones 7–9 on dark kits
   - sleeve materials: `sleeve` full arm, `shooter` to the elbow, `long`
   - wrist bands and tape at ≥40 px
   - knee pads/sleeves, tights and calf sleeves on the shin capsule
   - socks height (low/crew/high/over-knee moves the sock threshold `t`) and shoe accent
   - gloves for NFL skill players and keepers
   - an NFL towel (1 px strip at the waist, ≥24 px)
   - **Numbers (L-5):**
     - fonts 3×5 below 40 px, 4×7 from 40–59 px, a new 6×10 at ≥60 px
     - the turned chest compresses the gap between digits, never the digit columns
     - when `squeeze < 0.6` the number is hidden instead of scrambled
     - the back number is kept for camera-behind views
4. **`rig.ts` `shapeOf`.** Widths only; bone lengths are untouched, so `legScale` and the gait calibration hold.
   - `bulk = clamp(BMI/24.5, 0.72, 1.6)`
   - `rTorso = 0.082·(0.62 + 0.38·bulk)`
   - `shoulderW = (0.128 + pads·0.035)·(0.74 + 0.26·bulk)`
   - `rUpper·(0.7 + 0.3·bulk)`, `rThigh·(0.8 + 0.2·bulk)`
   - The curated `build` multiplies bulk: lean 0.9, muscular 1.08, stocky 1.12, heavy 1.2.
   - `style.ts` `heaviness` is kept consistent.
5. **Wire into the engines.** The thin hunks:
   - NBA: `hoops2/render.ts` `lookFor` becomes `matchLook('nba', refOf('nba', b.p.id), kit, {…})`.
   - NFL: `football2/render.ts` `lookFor` does the same, with pads by position.
   - Soccer: `soccer2/render.ts` `lookFor` does the same, using `weightFor` and gk gloves.
   - Each renderer's constructor calls `loadAppearance(sport)` (next to `loadClips`). In `draw()`, when `appearanceVersion()` changes, it clears `looks` and disposes the sprites it isn't showing.
   - `ut/CardArt.tsx` `lookOf` becomes `cardLook(line)`, so the existing full-body portraits already show real looks before players-6.
   - Renderers stop calling `hairFor`/`beardFor`. Those stay exported for the galleries.
6. **Crowd recolour.** The skin of fans comes from the 10 `SKIN_TONES` and hair caps from the natural `HAIR_TONES` (noise-seeded), replacing the two-colour `mix([200,156,118],[74,46,30])` in:
   - `persp.ts` `standsWall` (≈line 129) and the courtside fans (≈189)
   - `pitch.ts` touchline fans (≈115)
   - `field.ts` `crowdBand`
   - `court.ts` `drawCrowd` (5 tones → 10)
7. **`LooksGallery.tsx`** (new, `?pixel=looks`, routed from `Gallery.tsx`):
   - every hair/facial/gear trait × 16/24/32/40/60/80 px × 4 facings × 2 kits
   - a 10-tone × 8-kit contrast grid
   - the 12 stars per sport in their own kits and a shared kit
8. **Stretch, Low (L-6):**
   - A soccer kit `pattern` material in the torso capsule: stripes by x-parity, hoops by y-band, a sash diagonal, halves.
   - The club → pattern table goes in `src/data/appearance/kits-soccer.json`, holding public kit facts by franchise code: Juventus, Barcelona, Inter, Milan, Atlético, Athletic, Porto, Newcastle, Sporting (hoops), Feyenoord (halves), Ajax (band) and the like.
   - If time runs out, record it as deferred in the team doc. It must not be dropped silently.

**Tests and measurements**

- `src/game/pixel/body-build.test.ts` (node, `rasterBody`), at 40 px front-on:
  - Shaq (85/325) torso ≥24 px
  - Curry (74/185) ≤18
  - Bol (91/200) ≤18 and ≥5 px narrower than Shaq
  - |Jokić − Giannis| ≥2 px
  - BMI 31 vs 20 ≥25% wider
  - Haaland vs Messi ≥3 px
  - `headScale` gives +25% at 16 px
- `src/game/pixel/numbers.test.ts`, for numbers 23, 80, 88, 99, 7 and 12:
  - at 28 px front-on, every drawn digit equals its glyph exactly
  - at 40/56/80 px and facings 0.6–0.9, digits are exact glyphs or hidden; never partial columns
  - at ≥60 px the 6×10 font is used
- `src/game/pixel/likeness.test.ts`:
  - the 12 NBA stars in one shared kit at 40 px: all 66 pairs differ by ≥12% of silhouette-or-colour pixels
  - at 60 px all pairs differ
  - repeated for NFL (11 in one kit) and soccer
- `src/game/pixel/crowd.test.ts`: the `standsWall` texture uses ≥8 skin-palette colours and ≥4 hair tones.
- `src/game/pixel/render-only.test.ts`:
  - **Import graph:** a regex walk from each sport's simulation modules (`engine`, `autopilot`, `game`, `drive`, `ratings`, `match`, `arcade`) never reaches `pixel/appearance`, `pixel/looks` or `data/appearance`.
  - **Runtime:** a seeded NBA, NFL and soccer game logs identical events with `loadAppearance` called first and without it.
- Re-run `players-sprites.mjs`: the A-1 targets still hold with the more detailed sprites.

**Screenshots** in `O/shots/players/`:
- `after-lineup-{nba,nfl,soccer}.png`, compared side by side with the before set
- `closeup-{nba,nfl,soccer}-*.png` at DPR 2
- `ingame-{nba,nfl,soccer}-393-*.png`
- `stands-{nba,nfl,soccer}.png`
- `gallery-looks.png`

Look at every one. Data mistakes found go back into players-3's data as one-line fixes.

**Protocol impact.** None. The render-only test proves it.

**Save risk.** None.

**Other teams.** The three `render.ts` hunks are small and local; they sit in nba/nfl/soccer files we co-own. Shell may later move or precache the appearance chunks.

---

### players-5 · P0 · Transitions and grounded locomotion (A-2, A-5)

**Changes**

1. **`src/game/pixel/blend.ts`** (new):
   - `blendJoints(a: Joints, b: Joints, t)` slerps bone directions from the pelvis out and rebuilds them with the target body's bone lengths. Hand-keyed poses go through `rig.joints()` first.
   - A transition `Memo` field `{ fromKey, fromJoints, start, dur }`.
   - When the animation's identity (clip or pose family) changes, blend for 100 ms (6 frames at 60 Hz), quantised to 3 steps. The sprite key becomes `key + '~' + fromKey + step`, which is cacheable. That costs at most 3 extra draws per transition, inside the players-1 budget.
   - **Contact lock (R1):**
     - A blend never spans an event frame (`release`, `catch`, `contact`, `plant`, `impact`). It is shortened so the warped event lands on the engine-decided frame.
     - Contact reactions (falls, stumbles, posterized) cut in at 0 frames, per R11.
     - A player-initiated action changes the drawn picture on its first frame, so the response stays within 100 ms.
   - **Phase-matched gait entry:** entering jog/run/sprint picks the cycle phase whose planted foot matches the outgoing pose (from `stepL`/`stepR` beats).
2. **`src/game/pixel/locomotion.ts`** (new). Pure, shared by the three renderers' `gait()`:
   - `pickGait(speed, clipSpeeds)` chooses walk/jog/run/sprint with the rate clamped to **0.8–1.25×**, switching clips outside that range. This replaces today's 0.65–1.5/1.7 clamps.
   - **Remove the dead bands:**
     - NBA `run` below 2.5 ft/s showing `ready`
     - the static NBA `defend` pose at 1–3 ft/s; use `shuffle`/`backpedal` at matched rates
     - soccer `ready` while drifting 0.15–1 m/s; use the walk clip
     - the NBA backpedal rate cap
   - **New `walk` clip:** a CMU walking trial chosen with `scripts/build_mocap.py --inspect`, added to `CLIPS` with `stepL`/`stepR` beats; regenerate `src/data/mocap/walk.json` and `index.json`. The CMU mirror answered HTTP 200 at planning time. Use `MOCAP_CACHE=<worktree>/.cache/mocap/bvh`, which is git-ignored, seeded from the main checkout's cache.
   - **Stance-foot anchoring (R4):**
     - `plantedFoot(clip, frame)` comes from the beats and the clip's foot heights.
     - The renderer offsets the sprite so the planted toe stays at its screen anchor for the contact beat.
     - The sim position leads, through a damper limited to ≤0.5 × the gait's own displacement per frame. It re-anchors at each strike and decays to 0 when airborne.
     - The ball and hand positions take the same offset.
   - **Rates:**
     - step 1 (30 fps) for the ball carrier or handler, his marker and any sprite ≥40 px
     - step 2 for the rest
     - idles at step 2 for sprites ≥32 px
     - NFL/soccer sprites under 22 px move from step ≥3 to step 2 when the budget allows
   - **Facing.** `turnToward(memo, target, dt)` is used by all three sports; hoops has none today. A 90° turn completes in 80–120 ms. Spins, dives and falls are exempt. Use 16 facings from 18 px (today 22–26) when the budget allows.
   - **NFL QB drop:** in phase `drop` while moving, play `backpedal` (rate-matched, facing downfield) instead of the `ready` idle clip that skates 6.5 yd; `ready` only once set.
3. **Hooks in the three `render.ts` files:** `animOf`, `gait`, `sprite()`, and the sprite x/y in the bodies loop.

**Tests and measurements**

- `src/game/pixel/transitions.test.ts` (node, the renderer's real animation choice plus `rasterBody` joints), on the cut list in §3:
  - the max joint displacement between consecutive displayed frames is ≤20% of body height
  - event frames equal engine times exactly at step 1
  - the first frame after an action press differs from the prior frame in the acting limb
- `src/game/pixel/locomotion.test.ts`: the rate is always within 0.8–1.25 in the gait band, and the planted toe drifts ≤1 px at 40 px across a contact beat.
- Slide classifiers that import the renderer's pure selection, not a copy of it:
  - `slide-nba.test.ts`: 3 seeded games always; 24 games opt-in with `PS_SLOW=1`. NBA ≤8% (baseline 29.1%).
  - `slide-soccer.test.ts`: soccer ≤4% (baseline 12.8%).
  - `slide-nfl.test.ts` (run with `PS_SPORT=nfl`): 0 frames of the idle clip while the QB moves over 1 yd/s.
- `players-sprites.mjs`: effective animation rate for the 4 nearest moving bodies ≥28 fps; the A-1 stale targets still hold.
- `players-matchperf.mjs`: as in players-1.
- `mocap.test.ts` gains walk-clip checks.

**Screenshots.** `anim-strips-after-a2.png` (cuts) and `burst-{nba,nfl}-after.png` (0.25× slow motion, as the audit's `burst.cjs`), compared with the before set.

**Protocol impact.** None. Sprite placement offsets and pose choice only; sim positions are untouched.

**Save risk.** None.

**Other teams.** nba/nfl/soccer: the QB drop and defend-pose choices read existing `act` and `phase` values only.

---

### players-6 · P1 · Bust portraits on every card and portrait surface (H2, L-4)

**Changes**

1. **`src/game/pixel/bust.ts`** (new). `rasterBust(look, app, { size, facing = π/2 ± 0.3, variant: 'bust'|'cheer' })`:
   - A head-and-shoulders crop drawn at portrait detail on a ≈44×48 grid, with a head radius of ≈11–13 grid px.
   - Facial features: brows, eyes with a highlight at large sizes, a nose shadow, mouth, ears and cheek shading.
   - Shared `head.ts` hair, facial hair and gear; the jersey neckline and shoulders in kit colours, NFL pads; a small chest number when known.
   - NFL busts show the player without a helmet, so the face and hair read.
   - `drawBust` wraps it in a canvas.
   - The facing is verified front-on. The audit says today's card figure reads as "back of the head", so check it visually.
2. **`src/game/pixel/portrait.ts`** (new):
   - `portraitFor(ref, kit, opts) → dataURL`
   - an LRU of 1,500 entries, keyed by `pid|season|c1|c2|num|variant|size|appearanceVersion`
   - the existing 6 ms/frame pump moved here from `CardArt.tsx`
3. **`src/ui/PlayerPortrait.tsx`** (new). Main-bundle safe:
   - It reaches `portrait.ts`, `appearance` and `body` through `import()` only, and shows a fallback until the chunk and the drawing are ready.
   - Props: `sport, pid, season, c1, c2, num, pos, ht, wt, size, variant: 'bust'|'cheer'|'locked'|'dim'`.
   - `locked` is the real bust silhouette (hair and build shape) in a dark tone with a rim light. `dim` is full colour at 40%. Both are for ut's Collection (M12).
4. **`ut/CardArt.tsx` `UtCard`:**
   - `.utc-px` becomes the bust at every size: chips at 44–51 px get a tight head-and-collar crop; ≥52 px get the full bust.
   - `portraitUrl(line, pose)`, the full-body figure, stays exported unchanged for ut's `play-art.tsx`.
   - The reveal's `pose='cheer'` maps to the bust `cheer` variant.
5. **Draft cards.**
   - `src/ui/Card.tsx` `TradingCard`: the `.tc-art` shows `PlayerPortrait` over the era pattern. `Jersey` stays the fallback until the portrait loads.
   - The draft `Player` has pid, c1, c2 and era; ht/wt come from `weightFor` defaults.
   - `src/ui/Binder.tsx` inherits this; check the pump with 100+ cards.
   - `src/ui/poster.ts` `card()` uses the cached bust if it is ready, else the initials (no async in the poster path).
6. **CardDetail.** The bigger portrait comes with the 150 → 170 px card in players-7. The bust gives a head ≥45 px.
7. **CSS.** `src/ut/card-portrait.css` (new) and the `.tc-art` face rules. No width media queries.

**Tests and measurements**

- `src/game/pixel/bust.test.ts` (node):
  - deterministic output
  - the head bbox fills ≥55% of the grid width
  - eyes are present on front views
  - curated features show: Kareem's goggles pixels, Iverson's braids rows, Haaland's blond tone
  - each draw takes ≤1.0 ms on a 40-run median at 1×
- `players-cards.mjs` at 393 and 320, measuring the bust head width in CSS px:
  - ≥24 on the 80-px club card (today ≈8)
  - ≥45 on the 150/170 detail card
  - ≥57 on the 190 reveal card
  - ≥14 on 44-px chips
- **100-card grid**, via a fixture with 120 cards in the club:
  - all portraits drawn ≤1.2 s at 1×
  - no long task >50 ms while filling
  - p95 frame interval while scrolling 3 screens ≤17.5 ms at 1× and ≤34 ms at 4× CPU
  - heap growth for 300 portraits ≤6 MB
- **Bundle:** the main `index-*.js` chunk grows by ≤2 KB gzip. Measure with `vite build --outDir <scratch>` only in players-10; meanwhile assert that `Card.tsx` imports contain no `pixel/` path (a static test).

**Screenshots** in `O/shots/players/`:
- `cards-{nba,nfl,soccer}-393-{club,detail,reveal}.png`
- `cards-nba-320-club.png`
- `draft-{nba,nfl,soccer}-393.png`
- `binder-nba-393.png`
- `collection-locked-sample.png`, rendered in the gallery

**Protocol impact.** None.

**Save risk.** None. `portraitUrl` and `lookOf` signatures are kept.

**Other teams.**
- **ut:** use `<PlayerPortrait variant="locked"|"dim">` in `CollectionGallery.tsx` (M12). MatchDebrief MOTM and Hub tiles may use it too. The contract goes in the team doc.
- **shell:** the M9 arena loading card and the NBA-26 roster intro can show `PlayerPortrait`.

---

### players-7 · P1 · Production card faces: edition frames, typography, badges, stats and CardDetail (H3, H6, M11)

**Changes**

1. **`src/ut/card-frames.ts`** (new). `frameOf(rc): { id, kind, colors: [a, b, c], pattern, foil: 'none'|'sheen'|'holo'|'prism', premium: boolean }`:
   - bronze, silver and gold each distinct: different metal ramps, emboss pattern and plate style
   - `gold-rare`, `silver-rare` and `bronze-rare` add a shimmer, animated only on big cards
   - promo (Hot Season), legend, standout (+featured), landmark
   - program/live: each Live Calendar season's `accent` colourway (12 seasons) × a pattern chosen from a library of 8 motifs by a hash of the promo id: chevrons, rays, hex, waves, pinstripe, halftone, circuit, bolts
   - **Premium GOAT and Spotlight:** double border, animated foil on big cards, the crown and laurel SVGs kept
   - holo and evo overlays stay
2. **`src/ut/card-frames.css`** (new, imported by `CardArt.tsx`), plus the `.utc*` base blocks in `styles.css` that must change.
   - Foil animates only on `.big` cards; the `:not(.big)` static foil rule is kept for performance.
   - Animation stops under `prefers-reduced-motion` and the app's reduced-motion setting.
3. **Typography and layout** (`CardArt.tsx`, `.utc-*`). At the 80-px club card:
   - OVR ≥20 px
   - POS ≥10 px
   - name ≥10 px, with a condensed width for long names and a two-line fallback for very long ones (L4: "ANTETOKOUNMPO")
   - year ≥10 px, or hidden below 70 px
   - **Stats:**
     - a 3-stat strip at 76–119 px: the face stats with the highest role weight, value and label each ≥10 design px
     - the full six at ≥120 px
     - none below 76 px
   - "GREATEST OF ALL TIME" microtext is dropped below 8 px; the crown alone stands for it.
4. **`src/ut/TeamBadge.tsx`** (new). Original SVG shapes: an NBA disc, an NFL shield, a soccer crest, each split c1/c2. The ink colour is chosen by contrast ≥4.5:1, or else gets an outline. No logos.
5. **`ut/CardDetail.tsx`:**
   - The benchmark `<a href target="_blank">` and the "2K"/"Madden" text are replaced by a plain text line from a pure `referenceNote(rc)`: "Public ratings benchmark · <season>, season-calibrated attributes, then edition and level boosts". No brand names; snapshot strings are stripped of brand tokens.
   - The card grows from 150 to 170 px.
   - A body profile row: height, weight, hand/foot from appearance, number, build.
   - The six face stats become large tiles with bars and role-weight markers (extending `.ut-keys`).
   - The sticky action bar and its offset are not touched; they are shell's (H1).

**Tests and measurements**

- `src/ut/card-frames.test.ts`:
  - every tier, rare/holo variant and Live Calendar season/promo gets a distinct `(id, colors, pattern)`
  - bronze, silver and gold differ
  - GOAT and Spotlight are premium
  - badge ink contrast ≥4.5:1 for every team colour pair in `cards-{nba,nfl,soccer}.json` (fails today: 1.25, 1.28, 1.45, 1.76, 1.85, 2.61, 2.98, 3.37)
  - `referenceNote` never matches `/2K|Madden|FIFA|EA ?FC/i` and returns no URL
- `players-cards.mjs` text audit inside `.utc` on the Club grid, detail and reveal at 393 and 320:
  - 0 readable text nodes under 10 design px on cards ≥76 px (aria-hidden decoration excluded)
  - 0 overflow
  - card detail has no `a[target=_blank]`
- **100-card grid scroll:** as in players-6, with the frames on; no running CSS animations on non-big cards.

**Screenshots.**
- `frames-sheet.png`: every frame at 44/80/150/190 px, built in the gallery from fixture cards
- `cards-{sport}-393-{club,detail,reveal}-final.png`
- `cards-nba-320-club-final.png`

**Protocol impact.** None.

**Save risk.** None. Display only; no ids.

**Other teams.**
- **packs** owns the ratings shown on faces (H7 walls of 110) and the pack art. The frames read `l.accent`, `l.label` and the tier the packs data already provides.
- **ut** uses `UtCard` unchanged (same props). The new stat strip appears automatically at 76–119 px.

---

### players-8 · P1 · Real actions: the clip library, action mapping and contact (A-3, plus the impact half of the juice)

**Changes**

1. **Wire the recorded clips that are never played:**
   - `crossover`/`crossover_l` for NBA `cross` (the `cross` event warped to the engine's 0.35 s); the step-back as a planted `cut` plus a hop
   - `dribble` for the standing dribble, with bounce beats synced to the ball phase
   - `cut`/`cut_l` for the NFL juke (plant event at engine time) and NBA hesitations
   - `stiff_arm` for NFL `stiff` (extend at engine time, hold the extend frame)
   - `getup_front` after face-first falls in all sports
   - `catch`/`catch_run` for NBA catches
   - `jump` with arm overrides for NBA `block`, `rebound` and `contest`, each distinct:
     - **block:** one-arm swat, 1 smear frame
     - **rebound:** two hands high, a 1-frame secure, landing squash
     - **contest:** hands up, small hop
   - soccer: the `shuffle`/`shuffle_l` it already loads, for the jockey
2. **Replace stick poses** in `poses.ts` with keyed poses that follow research §4.4–4.6 frame plans, or with mocap where it fits:
   - the dunk family, with the **windmill arm sweeping a full circle** (with 1–2 smear frames), a tomahawk with the ball behind the head, two-hand and hang
   - spin with a smear at the back facing
   - pass variants (chest, bounce, overhead), chosen from the ball kind
   - NFL truck: shoulder drop over run frames, then a stumble
   - NFL spin
   - **Soccer:**
     - **keeper side dives:** the `dive` clip rolled about the forward axis so the body flies sideways, at low, mid and high heights; never a belly-flop
     - feet-first slide tackle
     - knee slide
     - dribble touches on `stepL`/`stepR` (the soccer `dribble` act has no render case today)
     - left/right kicks by the card's foot or the ball side
     - get-ups after `down`
     - a header with neck cock and snap
   - **NFL:** sack (QB `fall_back`/`fall_forward` when `p.end.kind === 'sack'`), and get-ups for downed non-carriers after 0.8–1.2 s
3. **New clips through `scripts/build_mocap.py`:**
   - Mirrors through the existing load-time mechanism: `kick_l`, `jumpshot_l`, `throw_l`, `layup_l`.
   - New CMU trials only where a licence-clear trial fits, found with `--inspect`. Candidate subjects: 10/11 (soccer kicks), 6/102/124 (basketball), 143 (sports), 90/140 (falls and get-ups).
   - Target ≥6 new or mirrored clips, each ≤12 KB, ≤80 KB raw in total. Credits go in `docs/CREDITS.md`.
4. **Loading API in `mocap.ts`:** `clipsFor(sport)` and `preloadClips(sport)`, so shell or the sport teams can fetch clips when the match screen is requested (P-5). Until clips arrive, blending (players-5) hides the pop from stand-in poses.
5. **`src/game/pixel/impact.ts`** (new):
   - `impactOf(kind, { massA, massB, closing }, reduced)` → `{ stopMs ∈ [33, 120], trauma, kickPx, reaction: 'flinch'|'stumble'|'fall' }`, from research §4.8 and R11. It covers the hit-stop length, the trauma and kick for shake by mass × speed, and the reaction choice.
   - The renderers use `reaction` to choose the contact clip.
   - `HitStopCap`: at most 150 ms of hit-stop in any rolling second.
   - **Outside our lane:** a ≈8-line hunk in `src/game/juice.ts` (nba/nfl) so `Juice.hitStop` honours the cap and accepts an optional `ms`. Reduced motion keeps its 30 ms clamp. Listed under "Touched outside my lane".
6. **Action contract for the sport teams**, written in the team doc:
   - the act names each renderer understands
   - the optional `Body` fields it reads defensively if a sport team adds them: `kickFoot`, `diveHeight`, `touchAt`, `passKind`, `slide`
   - unknown acts fall back safely

**Tests and measurements**

- `src/game/pixel/actions.test.ts` (NBA and NFL suites), with `actions-soccer.test.ts` for soccer:
  - every `Act` of each sport plus an unknown act maps to an animation without throwing
  - the NFL juke uses `cut`
  - the windmill hand angle sweeps ≥330° over the rise
  - a keeper dive rolls the torso ≥60° from upright (not a belly-flop)
  - a left-footed card kicks with `kick_l`
  - every warped contact event lands on engine time
- `impact.test.ts`: `stopMs` stays in [33, 120]; the cap holds at ≤150 ms/s under a burst of events; reduced motion ≤30 ms.
- `src/game/juice.test.ts` (existing) still passes: identical seeded results.
- `mocap.test.ts` passes for the new clips.
- Strip re-measure: the transitions targets from players-5 still hold for the new actions.

**Screenshots.** `anim-strips-after.png` (all actions, matching the audit's `anim-strips.png` rows) and `burst-soccer-keeper.png`.

**Protocol impact.** None. Clip choice, poses and render-side sprite effects only. The cap changes only how long the real-time accumulator is held, which `juice.test.ts` proves keeps outcomes identical. If a sport team asks for a timing change instead, that is theirs to record.

**Save risk.** None.

**Other teams.**
- **nba/nfl/soccer:** read the action contract; wire `impactOf` at their own hit-stop and shake call sites in `Hoops2.tsx`/`Football2.tsx`. Soccer wires `Juice` itself (its J-2).
- **nba/nfl:** approve the `juice.ts` hunk.

---

### players-9 · P1 · Signature motion, celebrations and crowd reactions (A-4, plus the moment half of the juice)

**Changes**

1. **`src/game/pixel/motion-dna.ts`** (new). `MotionDNA` from research §3.8:
   - `shot { speed −2…+2, set: low|mid|high, motion: one|two, fade, hold: 12|18|24 }`
   - `dribble: low|upright|hesi`
   - `dunk: DunkStyle[]`
   - `qb { slot: over|high|low, hold: high2|low1|chest }`
   - `run: upright|low|long|choppy|glide`
   - `celebrate: CelebrationId`

   Defaults are rule tables over ratings and size:
   - shooters by 3PT and height
   - dunk set by DNK/VRT. This **replaces the id-parity choice** in `hoops2/render.ts` `dunkStyle`/`spins360`; the exported signatures are kept.
   - run style by FC 26-like thresholds on AGI/STR/ACC/height
   - QB slot weighted 50/35/15 by pid hash

   Tier A overrides in the appearance data (`motion`), for ≥30 stars per sport: shooters, QBs, strikers, dunkers.
2. **Pose modifiers**, applied after mocap retargeting:
   - `shotForm`: the set-point arm height; the follow-through hold extends only after the release; fade lean
   - `qbSlot`: upper-arm rotation of 15°/35°/55° on the throw frames
   - `runStyle`: lean, knee lift, arm carriage, head bob; cadence changes stay within the anchoring tolerance
   - `dribbleStyle`: the ball height in `dribbleArm`
   - Lefties play mirrored clips, and the renderer reports the shooting hand for the ball position.
   - **Release, throw and kick events stay exactly where the engine puts them.**
3. **`src/game/pixel/celebrate.ts`** (new). About 8 generic, original celebrations: arms-up (existing clip), fist-pump, chest-thump, point-sky, flex, salute, knee-slide (soccer), arms-wide run, and finger-wag after a block.
   - Assigned by position archetype and context (game-winner, dunk, TD, goal, block), or by Tier A signature.
   - Skippable after 0.5 s. Generic names only.
4. **Teammate run-ins.** During dead-ball time after a score (`p.end` make or TD, `goalAt`):
   - teammates within range jog toward the scorer (a render-only sprite offset, jog clip) and high-five on arrival
   - fixes Hoop Land's "only raise hands" complaint
   - under reduced motion it is shorter, with no camera effect
5. **Crowd reactions in 6–12 frames:**
   - `standsWall` produces 3 frames: seated, standing, arms-up.
   - `drawFloor`'s wall sampling (`persp.ts`) picks a frame per column band, with a random 6–12 frame ripple delay after `excite(level, now)`. Touchline fans in `pitch.ts` get the same.
   - **Triggers:** NBA `fx.crowd` rising; NFL `p.end.kind` td/int or long gains, read in the renderer; soccer `goalAt`.
   - A hush on misses. Reduced motion bobs only, with no flash sparkles.
6. **`src/ut/WalkoutFigure.tsx`** (new, P2). A canvas of the card's player performing his celebration for 1.5–2 s in his look and kit, for packs to place in `PackOpening`. Reduced motion shows a static bust. If time runs out, defer it and record that in the team doc.

**Tests and measurements**

- `src/game/pixel/motion-dna.test.ts`:
  - with DNA on and off, the drawn release, throw and kick frames are the same engine times
  - DNA defaults are deterministic per pid
  - curated overrides apply
  - the dunk style no longer depends on id parity
  - every modifier keeps bone lengths
- `render-only.test.ts` is extended: the import graph includes `motion-dna` and `celebrate`; seeded games are identical.
- `crowd.test.ts`: excite → the first standing band within 6–12 frames; all bands back within 1.5 s; reduced motion never selects the arms-up frame.
- Performance: `players-matchperf.mjs` stays at the players-1 targets with crowd frames on; wall frames are precomputed once per texture.

**Screenshots.**
- `shot-forms-nba.png` (5 shooters side by side at the set point)
- `qb-slots.png`
- `celebrations-sheet.png`
- `crowd-react-{nba,nfl,soccer}-{0,6,12}.png`
- `teammates-runin-nba.png`

**Protocol impact.** None. If any DNA value would need sim timing, stop and record "Protocol bump needed: <sport> draft/UT".

**Save risk.** None.

**Other teams.**
- **packs:** `WalkoutFigure` contract (props `rc`, `size`, `onDone`).
- **nba/nfl/soccer:** crowd triggers read existing state only. Soccer's own juice is its J-2.

---

### players-10 · P0 (release gate) · Release QA, full suites, build, final measurements and team doc

**Steps**

1. `bash O/heavy.sh npm run typecheck`.
2. `bash O/heavy.sh npm test`: all three suites, once. Include `juice.test.ts`, `mocap.test.ts`, `sport-branches.test.ts` and every players test. Fix any failures.
3. `bash O/heavy.sh npm run build`, **once**, into a scratch `--outDir`; never commit `dist`. Then:
   - `scripts/audit_startup.py` for startup JS. NBA/NFL/soccer startup gzip grows ≤2 KB over this branch's base `acdf3e2` (audit: 773/645/592 KB).
   - Confirm the appearance data is absent from `index-*.js` (grep a curated pid).
   - Record the appearance chunk sizes.
   - Run `players-matchperf.mjs` on `vite preview` (production) at 393/430/320, 1× and 4×, against the audit table in §3.
4. **Isolated browser walk** at 393×852 (59/34) and 320×568, all three sports, DPR 1:
   - UT club, detail, reveal, squad, collection
   - draft, results and binder
   - an autoplay match per sport
   - pixel gallery pages

   Check: 0 page errors, 0 overflow, no card text under 10 design px, and reduced motion on (no foil animation, no shake or zoom, crowd bob only).
5. **Final before/after set** in `O/shots/players/`, with contact sheets: lineups, close-ups, in-game, cards, strips, crowd. Look at every image.
6. **Team doc** `docs/studio-overhaul/players.md`:
   - what changed and why, with before/after numbers for every §3 row
   - tests added
   - **"Protocol bump needed: none. Simulation code (`engine`, `autopilot`, `game`, `drive`, `ratings`, `match`, `arcade`) was untouched; `render-only.test.ts` proves it."**
   - Touched outside my lane: `src/game/juice.ts`, ≈8 lines
   - the hand-offs: the portrait contract (ut, shell), the action contract (sport teams), the walkout contract (packs), the precache note (shell)
   - owner device checks
   - anything left undone and why
7. Push.

**Owner device checks** (to list in the team doc):
1. "Can you tell who is who?" at a glance in each sport: the NBA five, the NFL backfield, the soccer front three.
2. Card readability on the phone: club grid, detail and reveal.
3. The feel of animation transitions and planted feet in a real match.
4. Smoothness of the near players in NFL.
5. Crowd and celebration timing.
6. Portrait fill-in speed on a 100+ card club.

**Protocol impact.** None.

**Save risk.** None.

## 6. Deferred or handed off, with reasons

- **Tier B curation (about 1,000 per sport).** Accuracy over count. Neutral defaults cover them. It is the next data batch.
- **User look overrides (`looks.user`).** That would be new saved state, and the brief does not ask for it.
- **L-5 data: backfilling missing NFL (26%) and soccer (7.7%) jersey numbers.** The `src/data/*.json` player files belong to the lead and change only through their build scripts when a brief says so. This one does not. Handed to the lead.
- **L-6, NBA/NFL era uniform detail** (side panels, sleeved jerseys, throwbacks, helmet decals). Low severity; kit data belongs to the sport teams (`uniforms.ts` is ours, but the era kit data is not). Soccer patterns are a players-4 stretch item.
- **A-6, non-player figures (referees, coaches, bench) and 2× canvas labels.** Their placement, camera and HUD belong to the sport teams. `drawBody` and `matchLook` are available to them.
- **Name tags over ball handlers or targets, and the defender's name on markers** (NBA-26, NFL V-2, soccer A-2). HUD, owned by the sport teams.
- **Ball-side visuals** (incompletion bounce, rim-outs and banks, ball trails). Sport teams. NBA-24's velocity ramps would also need a protocol bump.
- **The full ≈40-clip studio set (research §5) and motion matching or physics reactions.** players-8 adds ≥6 clips plus keyed poses. The rest needs more licence-clear capture than CMU offers; next phase.
- **P-1 to P-5 loading and runtime performance** (UT parse, offline, splash, bundle). Shell. We supply `preloadClips(sport)` and the sprite-drawing work.
- **A sprite atlas or pooled canvases** (a P-4 idea). Only if players-1 shows canvas-memory pressure. Today heap is flat at 34–40 MB.
- **H7 attribute walls of 110.** Generation belongs to packs (`specials`/`card-stats`). Faces show what packs produce.
- **Placing the pack walkout in `PackOpening`, the NBA tip-off roster intro, and the M9 loading card.** Packs, nba and shell place our components.
- **Greying hair with age for defaults, and a sepia Legend frame.** Needs birth years; it is an optional design idea and was not requested.

## 7. Risks and how the plan handles them

- **Merge conflicts in `render.ts`** with three sport teams editing the camera and HUD. Logic lives in new `src/game/pixel/*` modules, the hunks are thin, there is no reformatting, and every touched function is listed in the team doc.
- **Sprite cost rises** from more detail, blends and 30 fps for near bodies. The players-1 time budget and quantisation come first, and `players-matchperf.mjs` is re-run in every animation task with the same targets.
- **Data accuracy (likeness errors fans notice).** Uncertain fields are omitted, the `src`/`reviewed` flags are required, the gallery is reviewed by eye, and fixes are one-line data changes.
- **The main bundle grows from draft-card portraits.** `PlayerPortrait` uses `import()` only, backed by a static import test and the players-10 startup check.
- **The CMU mirror or Transfermarkt CC0 file becomes unreachable.** Keyed poses and curated feet are the fallback, recorded in the team doc.
