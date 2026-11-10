# Team players: build plan (revision 2)

Real-life likeness, card faces, and animation that looks real. Branch `claude/studio-players`, worktree `/home/user/ps-s-players`, dev-server port 5214.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full:**
- `O/BRIEF.md`, `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-players.md`
- `O/audit-likeness-animation-perf.md`, `O/research-likeness-animation.md`, `O/audit-ut-ui.md`
- The animation and identity sections of `O/audit-nba.md` (§6–8, §10, §12–13), `O/audit-nfl.md` (§7–8, §10–12) and `O/audit-soccer.md` (§6.4, §7, §9, §11, §13)
- The other six STREAM briefs, for hand-offs

**What changed in revision 2.** An independent critique (25 gaps, 17 restructures, 18 risks, 28 targets) was applied:
- §9 maps every point to where it is handled, or says why it is rejected.
- Tasks are reordered so the most visible owner asks (A-1, card faces, likeness) land before the long animation work.
- The cross-team contracts are written now (§6), so players-1 can publish them on day one.
- Large tasks now have an ordered **must** tier and a **stretch** tier (§5 preamble).

## 1. Goals

1. **"So we know who is who."** Every surface draws a player from one typed appearance record: all three match engines, UT cards, draft cards, the binder, the poster, and portraits for other teams' screens. The record holds skin tone, hair, facial hair, gear, build from height and weight, handedness or preferred foot, and signature motion.
   - About 170–200 hand-curated stars per sport, from widely known public appearance. Skin tone comes only from a cited public photo.
   - Everyone else gets neutral, era-plausible defaults that never contradict a star's known look. Curated entries override them.
2. **Animation that reads like the respected games.**
   - The nearest players never freeze (A-1).
   - Clip changes blend instead of cutting, and contact frames are locked to game time (A-2).
   - Feet stay planted and turns plant (A-5).
   - Recorded clips and keyed poses replace stick poses, and every act the engines emit has an animation (A-3).
   - Stars move like themselves (A-4).
   - Contact has weight: hit-stop, shake, reactions, celebrations and the crowd.
3. **Cards that look like a production UT.**
   - A big front-facing pixel bust on every card.
   - A distinct, data-driven frame per tier, promo and program.
   - Readable type at every card size from 34 to 190 px.
   - Original team badges.
   - A CardDetail sheet that never leaves the app and never names other games.
4. **Everything render-only.** Simulation code is untouched, so no protocol bump. Tests prove it with an import-graph check and a seeded state hash.

## 2. Constraints this plan is built around

### Lane

**Path-owned by players:**
- `src/game/pixel/**`, `src/game/sprites.ts`, `src/game/uniforms.ts`, `src/data/mocap/**`
- New: `src/game/pixel/appearance*.ts`, `src/data/appearance/**`, `scripts/build_appearance*`
- Card faces: `src/ut/CardArt.tsx`, `card-editions.css`, `CardDetail.tsx`, `CardSerial.tsx`, `src/ui/Card.tsx`, `src/ui/Binder.tsx`, `src/ui/poster.ts`, and the `.utc*` / `.tc-*` / `.card*` face blocks in `styles.css`
- In the three `render.ts` files: the player-drawing sections (look, pose and clip selection, blending, sprite caching)

**Declared read-only for players, with a ruling requested from the lead (§6.2):**
- `src/ut/card-face.ts`. It is ratings logic: `faceOf`, `shownFaceMean` and `supportOverall` are used by `rate.ts`. OWNERSHIP gives it to players, but packs' H7 work, the shown-vs-used fix and owner decision 5's re-rating need it. Players only *reads* `faceWeights` for the 3-stat strip. Proposal: move it to packs.
- The camera, floor and stands code inside `persp.ts`, `court.ts`, `field.ts` and `pitch.ts`: `pcam`, `drawFloor`, `courtTexture`/`fieldTexture`, `standsWall`, `drawCrowd`, `crowdBand`. These are path-owned by players, but nba (NBA-20 camera, NBA-29 floor caching), nfl (V-1 zoom and yard numbers) and soccer (V-1 zoom, V-2 stands) change them. Proposal: camera, floor and stands geometry belong to the sport teams. Players' crowd work lives in a new `src/game/pixel/crowd.ts`, reached by one-line calls.

**Strategy against merge conflicts.** players-2 moves the selection code (`lookFor`, `animOf`, `gait`, `poseOf`, `dunkStyle`) out of the three `render.ts` files into players-owned `src/game/pixel/select-{nba,nfl,soccer}.ts`, verbatim and proven identical. After that:
- Every later players change lands in players-owned modules.
- The `render.ts` hunks shrink to thin calls, batched and listed with line anchors in the team doc ("render.ts hunk ledger").
- We never reformat or reorder those files.

**New files claimed as players-owned:**
- `src/game/pixel/{appearance,looks,raster,head,bust,portrait,blend,locomotion,modifiers,sprite-budget,select-nba,select-nfl,select-soccer,impact,motion-dna,celebrate,crowd,name-tag}.ts` and `LooksGallery.tsx`
- `src/data/mocap/clips-{nba,nfl,soccer}.ts` (per-sport clip bundles)
- `src/ui/PlayerPortrait.tsx`
- `src/ut/card-frames.ts`, `src/ut/card-frames.css`, `src/ut/card-portrait.css`, `src/ut/TeamBadge.tsx`
- `scripts/qa/players-*.mjs`

**Outside our lane.** Kept to a few lines each, and every one is listed under "Touched outside my lane" in the team doc:
- `src/game/juice.ts` (nba+nfl): an ≈8-line hit-stop cap and an optional `ms` argument (players-8).
- `docs/CREDITS.md` (no owner): attribution for Monk Skin Tone (Google, CC BY 4.0), the Transfermarkt CC0 feet data and new CMU clips.
- `scripts/build_mocap.py` (no owner): new and mirrored clips.
- The main checkout's mocap BVH cache: read-only, copied into our git-ignored `.cache/mocap/bvh`.
- One-line `crowd.ts` calls in `persp.ts`/`court.ts`/`field.ts`/`pitch.ts`, if the lead rules those functions sport-owned.

`vite.config.ts` is shell's. We hand shell a one-line diff (§6.2) and never edit it ourselves.

### Saves

- No storage keys, card, edition or copy ids, or saved fields change.
- Appearance is shipped static data, not saved state. Portrait caches live in memory only.
- `LooksGallery` (`?pixel=looks`) is lazy, unlinked in production and storage-free.
- `portraitUrl(line, pose)`, `lookOf(line)` and every `UtCard` prop keep their signatures.
- The `UtCard` `aria-label` text is unchanged, because QA scripts and screen readers read it.

### Protocol

- Rendering reads engine state (`b.act`, `b.p.*`, positions, `p.end`, phases) and never writes it.
- The engines never import pixel or appearance code.
- Left-handed mirroring moves only the *drawn* ball, never a sim spawn point.
- We do not edit `card-face.ts` or `rate.ts`, so displayed overalls and `pool.print` are unaffected by players.
- The hit-stop cap only ever *shortens* hit-stop. players-8 confirms that no online head-to-head wall-clock timer or rival-score race depends on hit-stop length, beyond `juice.test.ts`'s seeded-result check.
- If any piece would change sim timing, stop and write "Protocol bump needed: <sport> draft/UT, because …". None is planned.

### Game time and game length

- **Every animation clock is game time.** That is the `t` the renderer receives (`Juice.gameTime`), never `performance.now()`. Hit-stop then freezes blends, slow-mo slows them, and pause stops them.
- A time discontinuity resets all motion state (players-8): replay rewind, SIM fast-forward, resume after pause, or a sport team calling `resetMotion()`.
- Celebrations, run-ins, get-up lie times and walkouts are render-only. They must fit inside the engine-decided dead-ball window and are cut at the next possession, snap or attack. They add **0 s** to a game (owner decision 3: 4–6 min solo games). Needing more time would be a sim/flow change, and is not planned.

### Bundle

- Appearance data loads per sport from lazy chunks (game and UT), never in first paint.
- Draft cards are in the main bundle (`Draft.tsx`, `Results.tsx`), so they reach portrait code only through `import()`.
- `src/game/pixel/color.ts` is imported by `src/ui/Favorites.tsx` (main bundle), so no palettes go there.
- Budgets:
  - Football2/Hoops2 shared chunk ≤ +25 KB gzip; UltimateTeam chunk ≤ +12 KB gzip; main index ≤ +2 KB gzip
  - each appearance JSON ≤ 20 KB gzip; mocap additions ≤ 80 KB raw
  - install precache ≤ +60 KB, with soccer appearance on demand
  - the soccer appearance glob is guarded by `__SOCCER__`, so the artifact IIFE build never inlines it

### Likeness guardrails

- No race, ethnicity or nationality field. A key-whitelist test enforces this.
- No trait is derived from name, nationality, birthplace, team or position. No classifiers, tattoos, logos or brand marks.
- **Skin tone comes only from a cited public photo, picked by eye against the 10 swatches.**
  - `scripts/build_appearance.ts --photos` builds contact sheets of public Wikimedia Commons thumbnails next to the swatch strip.
  - Photos go to the git-ignored `.cache/` only. They are never committed or shipped.
  - The row records the Commons file title in `skinSrc`.
  - No photo, a stage-lit photo, or any doubt → skin is omitted (neutral).
  - Recalling skin tone from a player's name is the prohibited inference and is never done.
  - If the Commons/Wikidata hosts are unreachable, every row keeps neutral skin, the team doc says "skin pending", and the owner device check covers it.
- Hair, facial hair, gear and build come from widely known public appearance in that era (the brief's own list). Uncertain fields are left to the default.
- Preferred foot from the CC0 Transfermarkt dataset is a recorded fact, not an inference.
- Every curated row has `src` and `reviewed`. An independent second review is required (players-7).

### Code rules

- Branch on the sport with `pick({ nba, nfl, soccer })` / `pickFor(sport, …)`, never a two-way ternary.
- Rendering-only randomness is fine, but appearance defaults are seeded by pid hash, so every phone draws the same look.
- **Reduced motion.** There is no app setting, only `prefers-reduced-motion`, read through `reducedMotion()` in `src/ui/motion.tsx`. Canvas renderers do not receive it, so every new canvas module calls `reducedMotion()` itself (crowd, celebrations, run-ins, bust `cheer`, walkout), and every new CSS animation has a `prefers-reduced-motion` rule.
- Portraits and frames are not tap targets. The 390 frame is kept, with no width media queries.
- **Deviation from STREAM A-5, recorded in the team doc.** The brief says "interpolating 15 fps clips". Research R2 says never interpolate between cached frames, because pixel joints shimmer. We raise effective rates by sampling clips natively at step 1 (30 fps) for near, large and ball bodies instead, and blend only *between clips*.

### Machine and tests

- Every `tsc`, `vitest`, Playwright or long vite-node run goes through `bash O/heavy.sh`.
- Dev server: `nohup npx vite --port 5214 --strictPort > /tmp/ps-players-vite.log 2>&1 & echo $! > /tmp/ps-players-vite.pid`. Stop it with `kill $(cat /tmp/ps-players-vite.pid)`. Never use `pkill -f` or `pgrep -f`.
- Every Playwright context:
  - aborts non-localhost requests (Google Fonts excepted)
  - opens `?ns=inspect&relay=ws://localhost:7777`
  - uses the harness copied from `O/audit-scripts/utui/lib.mjs`
- Own checks run at 393×852 (insets 59/34) and 320×568, `deviceScaleFactor: 1`.
- Match checks also run at **844×390 landscape** and **375×667**. Pixel close-ups may use DPR 2. Reduced-motion runs use `reducedMotion: 'reduce'`.
- Only Chromium is installed (no WebKit). Safari-specific checks become owner device checks.
- **Test commands:**
  - NBA: `npx vitest run src/game/pixel …`
  - NFL: `PS_SPORT=nfl npx vitest run …`
  - Soccer: `PS_SPORT=soccer npx vitest run soccer sport-branches`. Soccer tests are named `*-soccer.test.ts`.
  - Sport-specific tests guard on `PS_SPORT` with `describe.skipIf`, so a bare `vitest run` never runs the NFL classifier under NBA.
- Timing assertions (bust draw cost, portrait fill) are report-only in vitest, or carry a 3× margin. Hard timing targets are measured in Playwright.
- The full `npm test` and one `npm run build` happen only in players-10.

## 3. Baselines and targets

players-1 re-measures every baseline on this machine's dev server first, so before and after use the same method. The audit's fps figures come from a production build, and a full build is only allowed in players-10. In-task fps comparisons are therefore dev-vs-dev, and players-10 repeats them on a production build.

**Design px** below means CSS px ÷ stage scale *k*: 0.82 at 320, 1.0 at 393, 1.103 at 430.

### Animation and engine render

| Area | Baseline | Target (task) |
|---|---|---|
| Stale body draws, NFL autoplay | 41.3% overall; by size: 24–31 px 36.2%, 32–47 px 60.0%, **48–71 px 81.0%** | ≥48 px **<2%**, 32–47 px <5%, overall <10% (players-2) |
| Stale draws, NBA / soccer | NBA 72+ px 8.4% (4.5% overall); soccer ≤0.9% | NBA ≥48 px <2%; soccer stays ≤1% (players-2) |
| Pre-warm after snap, kickoff or inbound | not measured | stale ≤1% for sprites ≥32 px in the first 30 frames, with ≤2 extra pre-warm draws a frame (players-2) |
| In-match fps | NBA 390 4×: 54.8 fps / p99 33.4 ms; NBA 430 4×: 51.8 / 50; NFL 390 4×: 57.5 / 33.4; soccer 844×390 4×: 56.9 / p99 50 / 14 frames over 20 ms in 8 s | 1× holds 60.0 at 393/430/320/375×667/844×390; 4× at or above baseline; frames over 20 ms no worse than +10% (players-2, re-run in 5, 8, 9, 10) |
| Canvas memory | heap flat 34–40 MB; sprite canvas area not measured | total cached sprite area ≤6 Mpx (≈24 MB RGBA) per match; peak measured with 22 NFL bodies at 4× over 60 s (players-2, players-8) |
| Readiness at match start | first frame 1,082 ms; clips in at 1,218 ms (15–26 chunks) → stand-in poses pop; looks load in the renderer constructor | 0 frames with stand-in poses or default looks after frame 1; PLAY-to-first-frame not worse than +100 ms (players-4) |
| Pose jump at hard cuts (share of body height) | kick→run 59.8%, jumper→ready 53.5%, run→kick 52.7%, sprint→stiff-arm 44.6%, run→crossover 44.1%, run→jumper 42.2%, sprint→juke 33.0%, run→dunk 32.4%, ready→contest 26.7%, ready→pass 22.4% | every listed cut **≤20%** (players-8) |
| Blends under load | — | with blending on: stale ≤2% for ≥48 px in the 20 frames after an NFL snap; blend sprites ≤10% of cache entries; hit rate ≥ players-2 "after" −5 points (players-8) |
| Foot sliding | NBA **29.1%** of on-ground frames; soccer **12.8%**; NFL not measured (QB drop skates 6.5 yd on the idle clip) | NBA ≤8%, soccer ≤4%, NFL ≤5% plus 0 idle-while-moving QB frames; planted foot drift ≤1 px at 40 px (players-8) |
| Animation rate | clips 15 fps, idles 10 fps, <22 px 10 fps; NFL bodies 4–10 fps; facings snap 45° | every on-screen body ≥12 effective fps, none below 10 at 1×; near, large and ball bodies ≥28; ≤1 facing step per drawn frame (players-8) |
| Time discontinuities | replays, pause and SIM never handled | on replay start, pause/resume, SIM jump and hit-stop: 0 frames blend from the pre-jump pose; first resumed pose jump ≤20% of body height; planted-foot drift back to ≤1 px within one stride (players-8) |
| HUD alignment | anchoring would move sprites off the sim position | drawn offset ≤5% of body height (≤2 px at 40 px); `drawnOffset(who)` exported (players-8) |
| Holds and secondary motion | none; "no secondary motion anywhere" | set point 3 f, apex 2–4 f, contact 2 f, follow-through 12–24 f at 60 Hz (±1 f); hair/towel lag 1–2 f; head bob −1, −1, +2 px per stride at 40 px (players-8) |
| Hit-stop | fixed `HITSTOP` table, no cap | `impactOf` matches research §4.8 within ±10 ms per moment; ≤150 ms per rolling second; reduced motion ≤30 ms and 0 shake (players-8) |
| Motion DNA visibility | everyone identical; dunk style by id parity | at 60 px, set-point hand height differs ≥3 px low vs high; QB slot 15°/35°/55° ±5°; run styles differ ≥4° in torso lean; lefties use the mirrored clip on 100% of releases (players-9) |
| Celebrations and get-ups | arms-up only; get-ups instant | each celebration 1.2–2.5 s and skippable after 0.5 s; 0 frames of a celebration, run-in or get-up remain when the next possession, snap or attack begins; 0 s added (players-6, players-8) |
| Soccer feet | hashed, not by foot | ≥85% of soccer pids have a recorded foot (players-7); ≥95% of recorded left-footers' kicks use `kick_l` unless the ball is on the right (players-9) |

### Likeness

| Area | Baseline | Target (task) |
|---|---|---|
| Body width at 40 px (torso) | Curry 17, Giannis 19, Jokić 19, Shaq 20, Bol 20 | Shaq ≥24, Curry ≤18, Bol ≤18 (≥5 px narrower than Shaq), Jokić−Giannis ≥2 px, BMI 31 vs 20 ≥25% wider (players-5) |
| Identity in one shared kit | one skin `#a8714f`, one hair colour; hashed hair and beards (bald Iverson, high-top Shaq, dark-haired Haaland, bearded Mbappé) | pairs differing by ≥8% of pixels at **24 px**: ≥80% of the 66 NBA pairs, ≥75% of NFL and soccer pairs; ≥12% difference for all pairs at 40 px; 100% of pairs differ at 60 px (players-5, re-run in players-7) |
| Default looks | hashed headbands and beards | no single hair style above 40% within an era bucket; ≥5 distinct silhouettes per bucket; 0 default rows with goggles, headband, dyed tone or left hand (players-4) |
| Tier A coverage and accuracy | 0 curated | **must:** 100% of GOAT+Legend (NBA 20+120, NFL 20+130, soccer 0+132) plus the top 60 by OVR, deduplicated. **target:** plus the 50 most-pulled golds by pack weight, ≈170–200 per sport. 100% of rows carry `src` and `reviewed`. Second review of 100% of GOAT/Legend rows plus a random 20% of the rest finds ≤5% field errors. All 7 owner-named examples correct. Every GOAT with 10+ seasons has its eras checked (players-7; 30 seeds per sport in players-4) |
| Numbers | gone below ≈26 px when turned; scrambled at 40 px; fixed 4×7 font | legible front-on from 28 px; never scrambled (exact glyphs or hidden); 6×10 font at ≥60 px (players-5) |

### Cards

| Area | Baseline | Target (task) |
|---|---|---|
| Card art (head, design px) | head ≈8 px on the 80-px club card; figure ≈52 px | bust head ≥24 at 80, ≥45 at 150/170, ≥57 at 190, ≥14 at 44, ≥11 at w=34–40 (players-6) |
| Bust recognisability | every gold identical | 12 stars' busts in one shared kit on the 80-px card differ pairwise by ≥15% of pixels; `locked` silhouettes of the same 12 differ by ≥10% (players-6, re-run players-7) |
| Card text, every size | text 3–9 design px; nothing specified below 76 px | OVR and POS ≥10 design px on every `UtCard` w≥34; name ≥10 at w≥52 (≥44 where it fits); anything smaller aria-hidden; 0 overflow at 393 and 320 on club, detail, reveal, squad (44), SBC (44/72), Store (34/66), UT Draft (40), Hub (44/56), Evolutions (46/58), Match (54), PullTracker (44/70), Sets/Standouts (70/74) (players-3) |
| 3-digit values and long names | walls of 110; ANTETOKOUNMPO, GILGEOUS-ALEXANDER, PEDRO REBOCHO, "Throw under pressure" truncated | OVR 100–110 and 110 attributes fit the 80-px face with OVR ≥20 px and the 3-stat strip, 0 overflow; the four strings show without ellipsis (two-line or condensed) at w=44, 80 and 170 (players-3) |
| Frames | every gold identical; promos share frames | bronze/silver/gold base metals differ by CIEDE2000 ΔE ≥15; any two program/promo frames differ by ΔE ≥10 or use a different motif; `frameOf` returns a non-fallback frame for 100% of `TIER_NAMES` and 100% of live-calendar promos (merged data checked post-merge); 0 running CSS animations on cards w<120 (players-3) |
| Badges | contrast as low as 1.25:1 (VIL), 1.28 (LPA), 1.76 (PIT) | badge ink ≥4.5:1 for every team (players-3) |
| UtCard box | — | outer box identical (±0.5 px) before/after at every w in use (34–190); every `.utc-*` class referenced outside `CardArt.tsx` still exists (static test); `aria-label` unchanged (players-3, re-checked players-6) |
| CardDetail | "2K"/"Madden" link, `target=_blank` (`CardDetail.tsx:160-166`) | at 393×852 (59/34) and 320×568, the first row of six stat tiles is visible without scrolling and above the action bar's top edge; stat labels ≥11 design px; 0 `a[target]`; 0 matches of `/2K\|Madden\|FIFA\|EA ?(FC\|Sports)\|MUT\|FUT\|PES\|eFootball\|Konami/i` (players-3) |
| Portrait fill under throttle | portraits pumped 6 ms a frame | first visible row of club busts in ≤300 ms at 1× and ≤900 ms at 4×; a 120-card fill in ≤1.2 s at 1× and ≤3.5 s at 4×; UT first open not regressed by more than 5% vs P-1 (NBA 2,123 / 7,395 ms, NFL 2,092 / 8,974, soccer 679 / 1,834 at 1× / 4×) (players-6) |
| Binder | — | with 1,000 drafted cards: only on-screen cards draw, ≤3 bust draws a frame, scroll p95 ≤17.5 ms at 1× and ≤34 ms at 4× (players-6) |
| Portrait memory | — | portrait cache ≤6 MB per 300 portraits; no main-thread `toDataURL` (players-6) |
| Bundle | startup gzip NBA/NFL/soccer 773/645/592 KB | budgets in §2 (static checks in each task; build measurement in players-10) |

## 4. Scope map: every brief item, with the task that delivers it

| STREAM / audit item | Task |
|---|---|
| P0 appearance record and `appearanceFor(sport, playerId, season?)` (skin ×10 with ramps, hair ≥18 + colour, facial ≥8, headgear, NFL visor/tint, sleeves, leg gear, socks, shoes, build from ht+wt, hand/foot, per-era overrides) | players-4 (model), players-5 (drawing), players-7 (data) |
| Curated 150+ marquee players per sport, accuracy over count | players-4 (30 seeds per sport), players-7 (coverage) |
| Guardrails | players-4 (whitelist test, photo-sourced skin tooling), players-7 (review) |
| Uncurated players: era/position defaults; curated entries override the misleading hash | players-4 (defaults), players-5 (renderers stop calling `hairFor`/`beardFor`) |
| Weight changes the silhouette; one build formula for match and card (draft cards included) | players-4 (`buildOf` reads the attrs chunks), players-5 (`shapeOf`) |
| Data ≈20 KB gzip per sport, lazy, source + build script + sync test | players-4 |
| Wire looks into all three engines | players-2 (selection modules), players-5 (wiring) |
| Detail scales with sprite height; up to +25% head; numbers from 28 px | players-5 |
| Recolour the crowd from the same palettes | players-5 (recolour), players-9 (reactions) |
| Before/after screenshots → `O/shots/players/` | players-1 (before), players-5/6 (after), players-10 (final set) |
| A-1 sprite budget | players-2 |
| A-2 blends, contact lock | players-8 |
| A-5 foot sliding, gait 0.8–1.25×, rates, facings | players-8 |
| A-3 unused clips, stick-pose replacements, block/rebound/contest, soccer keeper/slide/touches/feet/get-ups | players-9 |
| A-4 signature motion | players-4 (schema), players-7 (curated values), players-9 (code) |
| Juice: hit-stop with a capped budget, shake by mass × speed, reactions | players-8 (`impact.ts`) |
| Juice: run-in celebrations, crowd reactions in 6–12 frames | players-6 (celebration library and run-ins), players-9 (crowd) |
| H2/H3/L-4: front bust on every card | players-6 |
| Edition frames, typography, badges | players-3 |
| Draft cards get the portrait | players-6 |
| Collection silhouettes (M12) | players-3 (`locked`/`dim` card mode), players-6 (bust silhouettes) |
| CardDetail H6/M11, bigger portrait, rich stats | players-3 (links, layout), players-6 (portrait, hand/foot) |
| Portraits cached; a 100-card grid scrolls smoothly | players-6 |
| Research §4.3 rules R1–R14 | players-8 (R1–R7, R9–R11, R13, R14), players-9 (R8 smears, R12 variants) |
| What the audits say works well, in player-drawing code | players-1 (keep-list probe), re-checked in 2, 5, 6, 8, 9, 10 |
| Team doc, "simulation untouched", owner device checks | every task; players-10 finalises |

## 5. Ordered tasks

### How the tasks are sized

The critique's splits plus its added scope come to about 14 sessions of work. The workflow allows 10 tasks. We keep 10 by:
- writing the cross-team contracts now (§6), so players-1 only publishes them
- moving the selection code early, so every later task works in players-owned modules
- giving each large task an ordered **must** tier sized to one session, and a **stretch** tier

**Carry-over rule.**
- A must item not finished becomes the first step of the next task and is recorded in the team doc.
- A stretch item not reached goes to §7's phase-2 backlog by name. It is never dropped silently.
- Act names for anything deferred stay reserved in the contract (§6.1), so an engine can emit them safely.

**Every task ends with:**
- its own tests via heavy.sh
- screenshots it looked at
- the keep-list probe where render code changed
- an update to `docs/studio-overhaul/players.md`, including the render.ts hunk ledger and "Touched outside my lane"
- a commit staged by explicit paths with a `Claude: ` message and the trailer
- `git push -u origin claude/studio-players`

---

### players-1 · P0 · Harness, baselines, keep-list and cross-team contracts (no `src/` change)

**Why first.** Every later task is judged against these numbers. The contracts must reach nba, nfl and soccer now, while they are adding acts, so they don't hand-key poses inside players-owned code or ship acts that fall back to idle.

**Must**

1. **Harness**, in `scripts/qa/`. All runs are isolated, use port 5214, write to `O/shots/players/` and print JSON. Viewports: 393×852 (59/34), 430×932, 320×568, 375×667 and 844×390 landscape.
   - `players-lib.mjs`: copied from `O/audit-scripts/utui/lib.mjs`. It holds route-abort, `?ns=inspect&relay=ws://localhost:7777`, `__psInsets`, the localhost fixture, the text-size/contrast/overflow helpers, a design-px converter (÷k) and a reduced-motion context option.
   - Ported from `O/audit-scripts/likeness/*.cjs`, with root, port and output parameterised:
     - `players-sprites.mjs` (spritestats + stalebypx): adds stale-by-frame-since-snap and per-body effective animation fps.
     - `players-matchperf.mjs`: fps, p99, frames over 20 ms, rAF cost, 1× and 4× CDP throttle. It also reads heap after GC and **total sprite canvas area**.
     - `players-readiness.mjs` (from `coldstart.cjs`): PLAY-to-first-frame, clip/appearance arrival times, and frames drawn with stand-in poses or default looks after frame 1. This needs a dev-only `?pixeldebug` counter exposed by the renderer in players-2, so baseline it here from clip-arrival timing.
     - `players-lineup.mjs`, `players-strips.mjs` (plus a per-frame `(clip, frame, poseHash)` sequence for seeded autoplay, used as players-2's golden check), and `players-burst.mjs`.
     - `players-cards.mjs`. It covers club, detail and reveal, plus every `UtCard` width in use: squad 44, SBC 44/72, Store 34/66, UT Draft 40, Hub 44/56, Evolutions 46/58, Match 54, PullTracker 44/70, Sets/Standouts 70/74. It records the outer box per width, text sizes in design px, badge contrast, overflow, `document.getAnimations()` on `.utc`, and bust head size via a DOM probe.
   - Foot-slide classifiers as vite-node scripts. Baseline numbers use the audit's copied branch logic. players-2 switches them to the extracted selection modules and must reproduce the same numbers:
     - `scripts/qa/players-slide-nba.ts` (from `nba-anim.test.ts`)
     - `players-slide-soccer.ts` (from `soccer_slide.ts`)
     - new `players-slide-nfl.ts`
   - `players-keep.mjs`: the keep-list probe. It screenshots and asserts what the audits say works:
     - NFL: SPD 92+ afterimage, SPC 85+ high-point leaps, CTH<70 bobble, heavier lineman gait, On Fire flames, stamina bar, red tackler ring
     - NBA: posterized and ankle-break reactions, posterizer slow-mo
     - all: the `widen` heavy-man stride and `sprintLean` in sprite keys, and the 6 ms portrait pump
   - `players-verify.mjs`: one command that runs all of the above against §3's targets and prints PASS/FAIL per row. It is the post-merge runner (players-10).
2. **Before captures** as `O/shots/players/before-*.png`: lineups, cards at every width at 393/320, in-game frames per sport (including landscape), action strips, bursts and keep-list shots. Every §3 baseline goes into the team doc, including the new ones: NFL foot sliding, per-body animation rate, canvas area, stand-in frames, PLAY-to-first-frame.
3. **Publish the contracts.** Copy §6 into the team doc: action contract and intake, ownership splits, HUD contract, PlayerPortrait contract, walkout agreement, `impactOf` call sites, readiness hook, reports.
   - List "Requests to the lead": the rulings in §6.2, the name-tag and roster-intro assignments, the brand-name report, and the soccer precache diff for shell.
   - Push. The lead relays the requests to the named teams.

**Stretch.** None. This task must finish whole.

**Acceptance**
- Every script runs on the base commit and prints JSON.
- The §3 baseline column is reproduced within ±10% of the audit's numbers where the audit measured them, or explained.
- `players-verify.mjs` runs end to end and FAILs the rows that are expected to fail today.
- 0 non-localhost requests were made: the route log is printed.

**Protocol impact.** None. **Save risk.** None. **Commit:** `scripts/qa/players-*`, `docs/studio-overhaul/players.md`.

---

### players-2 · P0 · Render core: pure selection modules and the near-first time budget (A-1)

**Why now.** A-1 is the critical bug: 41% of NFL draws are stale, so the near players freeze. Moving selection out of the sport-owned files first does two things. Every later players change lands in our own modules, which shrinks the window in which a sport team's `render.ts` edit can collide with ours. And the tests can import the real animation choice.

**Must, in order (three commits)**

1. **Extraction (behaviour-neutral).**
   - Move `lookFor`, `animOf`, `gait`, `poseOf` and `dunkStyle`/`spins360`, with their memo types and constants, into `src/game/pixel/select-{nba,nfl,soccer}.ts`. Sport types come in by `import type`.
   - `render.ts` keeps thin calls and re-exports the old names: `soccer2/render.ts` `lookFor` is imported by audit tooling, and `hoops2/render.ts` exports `dunkStyle`/`spins360`.
   - **Golden check.** The players-1 strips sequence (`clip, frame, poseHash` per body per frame, seeded autoplay, all three sports) is byte-identical before and after. The slide classifiers switch to importing `select-*.ts` and reproduce the players-1 numbers exactly.
2. **Safe fallback for unknown acts** (separate commit). An act the selection doesn't know maps through the contract's family table (§6.1) to the nearest family pose: an action pose for action-like names, locomotion while moving. It never shows `ready` idle while moving. This makes the sport teams' new acts safe before players-9 animates them.
3. **`src/game/pixel/sprite-budget.ts`** (new, pure):
   - `interface DrawReq { who: string; px: number; must: boolean; staleFor: number; near: number }`
   - `class SpriteBudget { begin(now, frameMs); order(reqs); allow(); spent(ms, draws); stale(who); pin(who) }`
   - **Must set**, always drawn fresh:
     - the ball carrier or handler, the pass target, and his nearest defender
     - **the body the human controls in any phase**, including the user's defender in the new solo defense phases (owner decision 2), read from each sport's existing control index
     - any body `pin()`ned this frame, which the HUD uses for rings and tags
   - Then the order is a score of `px + 24·staleFor`. Anyone ≥32 px stale for 2 frames is forced.
   - **Time budget robust to iOS timer clamping.** WebKit clamps `performance.now()` to 1 ms without cross-origin isolation, which GitHub Pages cannot enable. So the budget does not time single draws. It keeps an EWMA of *per-draw cost* from each frame's total draw time divided by draws, and allows `clamp(floor(budgetMs / ewma), 3, 14)` draws. `budgetMs` is 3.0, or 2.0 when the last frame interval was over 20 ms.
   - **Pre-warm.** It uses leftover budget only, ≤2 extra draws a frame, when nothing is drawing new (pre-snap, before a possession or attack, after a reset). It draws the next gait frames for the 6 nearest bodies. No `requestIdleCallback`, which iOS Safari lacks.
   - `quantPx(raw)`: 1 px steps ≤14, 2 px ≤30, 4 px ≤60, 6 px above. The blit stays 1:1.
   - **Area-capped caches.** Each sprite cache tracks the total w×h of its canvases, and all caches in a match share a cap of 6 Mpx with LRU eviction. Count caps rise (NBA 360 → 480, NFL 600 → 800, soccer 700 → 800) only if measurement shows misses caused by evictions. `CanvasOut` recovery and `freeCanvas` are kept.
   - **Render hunks.** In each `render.ts` `draw()`, resolve sprites in priority order into a `Map<who, Sprite>`, then draw in the existing depth order. Painter's order is unchanged. Every hunk goes in the ledger with line anchors: NBA `sprite()` and loop ≈722; NFL `sprite()` and loop ≈794; soccer `sprite()` and loop ≈742; `this.budget = 4|5` becomes `this.budget.begin(...)`.
   - A dev-only `?pixeldebug` counter: stand-in poses drawn, default looks drawn, blend draws, cache area. It feeds `players-readiness.mjs` and `players-sprites.mjs`.

**Stretch.** None.

**Tests and acceptance**
- `sprite-budget.test.ts`, on a synthetic 22-body sequence:
  - the carrier, the controlled defender and pinned bodies are always fresh
  - no body ≥32 px is stale more than 2 frames in a row under a 4-draw-equivalent budget
  - with a **clock quantised to 1 ms**, the EWMA converges within 30 frames to the true per-draw cost ±20%, and the count stays in [3, 14]
  - `quantPx` is monotone and idempotent
  - the area cap is never exceeded
- `players-sprites.mjs`:
  - NFL stale ≥48 px <2%, 32–47 px <5%, overall <10%; NBA ≥48 px <2%; soccer ≤1%
  - pre-warm: stale ≤1% for ≥32 px in the first 30 frames after snap, kickoff or inbound
- `players-matchperf.mjs`, at 5 viewports:
  - 1× holds 60.0
  - 4× at or above before; frames over 20 ms no worse than +10%
  - peak sprite area ≤6 Mpx with 22 NFL bodies at 4× over 60 s
  - heap within +10% over 40 s
- `players-keep.mjs` passes.

**Screenshots.** `after-a1-nfl-{390,844land}-{0..5}.png`: the line and backfield in close-up.

**Protocol impact.** None: render order, cache and budget only. **Save risk.** None.

**Other teams.** Shell owns overall performance: numbers go to them in the team doc. The `pin(who)` API and the extracted modules are announced in the doc.

---

### players-3 · P1 · Card faces: edition frames, type at every size, badges, CardDetail

**Why now.** "Make cards appeal to the eye" is one of the most visible asks, and this work needs almost no appearance data. Landing it early also fixes the `UtCard` DOM and box before ut and packs build more CSS around it.

**Must**

1. **`src/ut/card-frames.ts`**: `frameOf(rc): { id, kind, colors: [a, b, c], pattern, foil: 'none'|'sheen'|'holo'|'prism', premium, fallback: boolean }`. It is **data-driven**:
   - base metals from `TIER_NAMES` tiers: bronze, silver and gold each distinct (metal ramp, emboss pattern, plate style), plus their rare shimmer
   - promo, legend, standout (+featured), landmark
   - program/live: each Live Calendar season's `accent` from `live-calendar.json` × one of 8 original motifs (chevrons, rays, hex, waves, pinstripe, halftone, circuit, bolts), picked by a hash of the promo id
   - GOAT and Spotlight premium: double border, animated foil on big cards; crown and laurel SVGs kept
   - holo and evo overlays stay
   - Any tier or promo it does not know returns a **generic fallback** frame with `fallback: true`, so new editions from packs (Matchday Standouts, Momentum, new program names) render sensibly. The test lists them loudly.
   - Frame ids and names are our own. No real UT promo names (TOTY/TOTS style) and no copied promo designs.
2. **`src/ut/card-frames.css`** (imported by `CardArt.tsx`), plus only the `.utc*` base blocks in `styles.css` that must change.
   - Foil animates only on cards w≥120 (`.big`); the static `:not(.big)` rule is kept.
   - `@media (prefers-reduced-motion: reduce)` stops it, and the JS reveal path checks `reducedMotion()`.
3. **Typography at every width** (`CardArt.tsx`, `.utc-*`), by a width table in `CardArt.tsx`:
   - **w 34–43:** OVR and POS ≥10 design px. Name hidden visually; `aria-label` keeps it.
   - **w 44–51:** OVR and POS ≥10. Surname at ≥10, condensed, with a hyphenated two-line fallback.
   - **w 52–75:** adds the name at ≥10 and the year if it fits.
   - **w 76–119:** the 3-stat strip. It shows the face stats with the highest role weight, read from `card-face.ts` `faceWeights` (read-only). Value and label each ≥10.
   - **w ≥120:** the full six.
   - Anything smaller than 10 design px is aria-hidden decoration. "GREATEST OF ALL TIME" microtext is dropped below 8 px; the crown stands for it.
   - **3-digit values (H7 display rule).** Faces show the true value: OVR 100–110 and attributes up to 110, in a condensed tabular numeral, so "105" fits at OVR ≥20 px on the 80-px card. We reject showing "99+": it would hide what makes Spotlight and GOAT cards the chase, and packs' H7 fix (shape-keeping attributes) removes the walls of 110 at the source. If packs prefers a cap, it is a one-line `faceNum()` change.
   - **Long names (L4):** ANTETOKOUNMPO, GILGEOUS-ALEXANDER and PEDRO REBOCHO show condensed or two-line, without ellipsis, at w=44, 80 and 170.
4. **`UtCard` `mode?: 'locked' | 'dim'`** (additive, default unchanged), for ut's CollectionGallery (M12).
   - `dim` is the whole card (frame plus figure) in full colour at 40% opacity with a lock SVG, so "each promo's design is the lure".
   - `locked` is the frame in a dark tone with a rim light.
   - players-6 swaps in the bust silhouette.
5. **`src/ut/TeamBadge.tsx`**: an original shape (NBA disc, NFL shield, soccer crest) split c1/c2, plus the abbreviation. Ink is chosen by contrast ≥4.5:1, or gets an outline. No logo silhouettes.
6. **`ut/CardDetail.tsx`:**
   - The benchmark `<a href target="_blank">` and the "2K"/"Madden" text become a plain line from a pure `referenceNote(rc)`: "Public ratings benchmark · <season>, season-calibrated attributes, then edition and level boosts". Brand tokens are stripped from `ratingReference.snapshot` with the extended regex in §3.
   - The card grows from 150 to 170 px.
   - A profile row: height, weight, number and position from card data. players-6 adds hand/foot and build.
   - The six face stats become large tiles with bars and role-weight markers (extending `.ut-keys`). Labels are ≥11 design px; long labels ("Throw under pressure") go two-line.
   - The sticky action bar and its offset are not touched (shell's H1). Visibility is judged against the bar's **top edge**, so shell's pending fix cannot skew the result. No local CSS patch is made.
7. **Box and contract invariance.**
   - `card-contract.test.ts` (static) lists every `.utc-*` selector used outside `CardArt.tsx` and asserts `CardArt.tsx` still emits each class. The files: `content-ui.css`, `play-art.css`, `content.css`, `pack-cinema.css`, `pack-reveal.css`, `pull-tracker.css`, `styles.css`, `scripts/qa/circulation.mjs` (`.utc-stamp`) and `scripts/qa/ut-content.mjs` (`.utc`).
   - It also snapshots the `aria-label` builder output for 10 fixture cards.
8. **Isolated card walk** at 393×852 and 320×568, with a reduced-motion pass, over every surface in the `players-cards.mjs` width list.

**Stretch.** Per-program motif tuning, by eye, in a frames gallery page.

**Tests and acceptance**
- `card-frames.test.ts`:
  - every `TIER_NAMES` tier and every live-calendar promo on this branch returns a non-fallback frame
  - bronze, silver and gold base ΔE ≥15 (CIEDE2000, implemented in the test)
  - any two program/promo frames ΔE ≥10, or a different motif
  - GOAT and Spotlight are premium
  - badge ink ≥4.5:1 for every team pair in `cards-{nba,nfl,soccer}.json`
  - `referenceNote` never matches the extended brand regex and returns no URL
- `card-contract.test.ts` passes.
- `players-cards.mjs` meets the §3 card rows: OVR/POS ≥10 at every w≥34, name rule, 0 overflow, 3-digit and long-name fixtures, outer box ±0.5 px vs players-1 at every width, 0 running animations on w<120, CardDetail tile visibility above the bar top, labels ≥11, 0 `a[target]`.
- 100-card club grid with frames on: scroll p95 ≤17.5 ms at 1× and ≤34 ms at 4×.

**Screenshots.**
- `frames-sheet.png`: every frame at 34/44/80/150/190
- `cards-{nba,nfl,soccer}-{393,320}-{club,detail,reveal}.png`
- `cards-widths-{squad,sbc,store,draft,hub,evo,match,tracker}.png`
- `cards-locked-dim.png`

**Protocol impact.** None: display only, no ids. **Save risk.** None.

**Other teams.**
- packs owns the ratings shown (H7 generation) and pack art; frames read `l.accent`, `l.label` and the tier.
- ut keeps `UtCard` props, plus the optional `mode`.
- The brand-like badge names in `abilityName`/`ABILITY_HELP` (§6.8) are reported, not renamed.

---

### players-4 · P0 · Appearance model, defaults, data pipeline, loader, readiness, and the first 30 looks per sport

**Must**

1. **`src/game/pixel/appearance.ts`.** Types and enums from research §3.1:
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
   export interface MotionDNA { shot?: { speed?: -2|-1|0|1|2; set?: 'low'|'mid'|'high'; motion?: 'one'|'two'; fade?: boolean; hook?: boolean; hold?: 12|18|24 }; dribble?: 'low'|'upright'|'hesi'; dunk?: DunkStyle[]; qb?: { slot?: 'over'|'high'|'low'; hold?: 'high2'|'low1'|'chest' }; run?: 'upright'|'low'|'long'|'choppy'|'glide'; celebrate?: CelebrationId }
   export interface Appearance { v: 1; skin?: number; skinSrc?: string; hair; hairTone; facial; head; headC?; eyes; armL; armR; armC?; legL; legR; legC?; socks; shoe; gloves?; towel?; build?; hand: 'R'|'L'; foot?: 'R'|'L'|'B'; motion?: MotionDNA; src: 'curated'|'default' }
   export type LookEra = { from: number; to: number } & Partial<Omit<Appearance,'v'|'src'>>;
   ```
   - **Palettes.**
     - `SKIN_TONES`: the 10 Monk Skin Tone anchors with research §3.2's shadow, highlight and outline, saturation +8–15%.
     - `skinRamp(i) → [shadow, base, light, outline, rim]`.
     - `NEUTRAL_SKIN = '#a8714f'` stays exactly as today for uncurated players.
     - `HAIR_TONES` (15 hexes); `'team'` resolves to kit c1.
     - Credit Monk Skin Tone (Google, CC BY 4.0) in `docs/CREDITS.md`.
   - **Level of detail.** `detailFor(px)` (research §3.3); `headScale(px) = clamp(1 + (32 − px)/64, 1, 1.25)`.
   - **One build formula, `buildOf(sport, ref, ctx) → { htIn, wt, bmi }`,** for match, cards and draft cards alike.
     - It reads real ht/wt from the card line, or, for draft cells, from the install-cached `nba-attrs.json`/`nfl-attrs.json` (keyed `CELL:pid`, fields `ht`/`wt`) when loaded.
     - It uses soccer `ht` from `cards-soccer.json` when present.
     - Otherwise it falls back to `weightFor(sport, htIn, null, pos)`:
       - soccer BMI by position: GK 23.5, CB 23.6, FB 22.3, DM/CM 22.6, AM/W 22.0, ST 23.2
       - NBA/NFL use the `teams.ts` SIZE fallbacks
     - So Shaq, Bol and Bogues draft busts get their real builds, and Messi gets one weight in the match and on his card.
   - **Defaults:** `defaultAppearance(sport, pid, season, pos)`, seeded per field by `hash(pid + ':field')`. It follows research §3.6:
     - **Skin:** always neutral.
     - **Hair style by era:**

       | Era bucket | Distribution |
       |---|---|
       | NBA 1970s | afro-s + afro-l 30%, short 40%, others 30% |
       | NBA 2010s | fade 30%, buzz 20%, short 15%, locs/twists 12%, bald 8%, others 15% |
       | NFL | under-helmet only: locs-l, long or mullet ≈12% |
       | Soccer | short/fade 55%, long 10%, buzz 15%, curly 8%, others 12% |

       Other decades are interpolated, with no style above 40% in a bucket.
     - **Hair tone:** black or dark-brown 85%, brown 15%. **Rejected from research:** "other natural 5%". A blond or ginger default on a dark-haired player is a salient false cue, and the base rate makes dark the most likely-correct default.
     - **Facial hair:** none 60%, stubble 15%, short 12%, goatee 7%, full 6%; none under 21 when age is known.
     - **Non-signature gear priors (accepted):**

       | Sport | Priors |
       |---|---|
       | NBA | arm sleeve p=.12 (2004+), knee pad/sleeve p=.10, high socks p=.5 in the 1970s falling to .15 |
       | NFL | clear visor p=.25 for skill positions (2005+), towel p=.3 for QB/RB/WR (1990+), gloves p=.9 for WR/RB (2000+), long sleeves p=.15 for OL |
       | Soccer | long sleeves p=.15, low socks p=.08, keeper gloves always |

     - **Shoes by era:** 1970s–80s white ≈80%; 2010s team/black 50%, neon 15%.
     - **Curated-only, never defaulted:** headbands, goggles, dyed or unnatural tones.
     - **Handedness defaults to R and soccer foot to data, else R.** **Rejected from research:** the 10% random NBA lefty and the 75/20/5 random foot. Expected accuracy falls: 0.9 → 0.82 for hands and 0.75 → 0.60 for feet. A wrong lefty is a checkable, salient error.
   - **Lookup:** `appearanceFor(sport, pid, season?, ctx?)` resolves base, then the era override, then defaults. It is memoised.
   - **Id parsing:** `refOf(sport, engineId, ctx?): { pid, season }` parses:
     - draft `CHI-1990:jordami01`
     - UT `nba:season:1996:jordami01:CHI`
     - `holo~…` and `evo~a+b~…`
     - live `nba:live:<promo>[.f]:<season>:<pid>:<fr>`
     - soccer `108830:2019:BAR`
     - `reserve:PG`, `depth:WR:…` and `squad-3`, which return null and use defaults

     **Era accuracy:** for a draft cell, the season is the midpoint of *the player's own seasons inside the cell* (`ctx.from/to` from the draft `Player`), not the cell decade. If an era override straddles that span, the base look is used. Rodman's DET 1990s cell is natural hair; his CHI 1990s cell is dyed.
   - **Encoding:** `encodeAppearance`/`decodeAppearance`, shared with the build script. `motion` is encoded too.
2. **Compact data, `src/data/appearance/<sport>.json`:**
   - `{ v: 1, sport, fields: [...], players: { [pid]: "<one base-36 char per field, '.' = default>[|<from>-<to>:<codes>]…[#<motion codes>]" }, feet?: { L: string[], B: string[] } }`
   - About 25–35 bytes per curated player.
   - `skinSrc`, `src` and `reviewed` stay only in the source file.
3. **Source format:** `src/data/appearance/source/<sport>.looks.json`, with named enums plus `name`, `src`, `skinSrc` and `reviewed`. It is never imported by app code; the glob is one level deep.
4. **`scripts/build_appearance.ts`** (vite-node):
   - `--build`: source to compact files
   - `--check`: exits 1 if out of sync
   - `--candidates <sport> [n]`: ranks pids by "what players see most" (research §3.7 step 1). The signals: tier (GOAT, Legend), top OVR, **pack weight × circulation** (bucket weights from `pool.ts` and the gold odds), edition count, and **newest-season top OVR by position** ("cover-level" current stars). It outputs the coverage lists players-7 must hit.
   - `--find <sport> <name>`: pid, seasons, teams
   - `--photos <sport> <pids…>`: Commons/Wikidata thumbnails into `.cache/looks-photos/`, and a contact sheet with the 10 swatches to `O/shots/players/looks-src-<sport>-<n>.png`. It sends a generic User-Agent and no personal data.
   - `--soccer-feet <players.csv.gz>`, used in players-7
5. **Loader and readiness, fixing the start-of-match pop (P-5, NBA-30):**
   - `loadAppearance(sport)`: `import.meta.glob('../../data/appearance/*.json')`, one chunk per sport, guarded by `__SOCCER__` for soccer. `appearanceReady(sport)`; `appearanceVersion()`.
   - **Per-sport clip bundles.** `src/data/mocap/clips-{nba,nfl,soccer}.ts` statically import the clip JSONs each sport uses. `mocap.ts` gains `clipsFor(sport)` and `preloadClips(sport)`, which load one dynamic chunk (≤2 requests with a shared chunk) instead of 15–26.
   - `pixelReady(sport): Promise<void>` is clips + appearance. It is started at module evaluation of `select-<sport>.ts`, which `render.ts` imports when the game chunk loads, long before the renderer's first frame. That needs no `render.ts` line.
   - **No mid-match storm.** If appearance arrives after frame 1 anyway, nothing is disposed in bulk. Looks are marked stale by version, and each body's sprite is redrawn only through the normal budget, stale-first. The constructor's `loadAppearance` call is removed.
   - **Hand-off (§6.7):** shell and the sport teams add `await pixelReady(sport)` to the match loading gate (M9). That makes readiness a guarantee rather than a race.
6. **Soccer precache.** `vite.config.ts:40` `onDemandModule` matches only `game/soccer2`, `game/pixel/pitch.ts` and `data/(cards-*|soccer).json`, so `src/data/appearance/soccer.json` would be installed for every sport. players-1 sends shell the one-line diff (§6.2). players-10 checks the service worker's precache list. Until shell merges it, the cost is ≤20 KB gzip in install, which is acceptable for an interim branch, and it is recorded.
7. **`src/game/pixel/looks.ts`:**
   - `matchLook(sport, ref, kit, { pos, ht, wt, gk, pads })` and `cardLook(line)`, both returning the existing `Look` plus `app: Appearance`.
   - `Look` gains optional `app?`.
   - Legacy `hair`/`beard` stay, so `Scene.tsx` and the galleries keep working.
8. **Seeds: 30 GOAT/Legend rows per sport.** They include all 7 owner-named examples: Shaq bald late, Iverson cornrows with headband and arm sleeve, Kareem goggles, Rodman dyed by season, Haaland long blond, Mbappé short and clean-shaven, Brady. Skin is photo-sourced via `--photos`, or omitted. players-5 and players-6 are then judged on real data.

**Stretch.** None.

**Tests and acceptance**
- `appearance.test.ts`:
  - enum validity and the 18/15/8 counts
  - a key whitelist (fails on `race`, `ethnicity`, `nation`, …)
  - uncurated → `NEUTRAL_SKIN`
  - defaults snapshot for 30 pids
  - **defaults diversity over 2,000 pids per era bucket:** no style >40%, ≥5 silhouettes, 0 goggles/headband/dyed/blond/left
  - gear prior frequencies within ±3 pp
  - era resolution, including Rodman per cell
  - encode/decode round trip, including `motion`
  - `refOf` for every id form
- `appearance-data.test.ts`:
  - every pid exists in `cards-<sport>.json` with a matching name
  - eras inside card seasons
  - sync with `--build`
  - gzip ≤20 KB per sport
  - every curated `skin` has a `skinSrc`
- `appearance-soccer.test.ts`: `weightFor` by position; Messi's match weight equals his card weight; foot decoding.
- `build-of.test.ts`: the draft cells for Shaq, Bol and Bogues return their attrs ht/wt; the fallback is used only when the attrs chunk is absent.
- `readiness.test.ts`: `pixelReady` resolves both clips and appearance; `clipsFor('nba')` covers every clip `select-nba.ts` can return.
- Static: no main-bundle file imports `appearance`, `looks` or `data/appearance`.
- `players-readiness.mjs`, at 1× and 4×, NBA/NFL/soccer: **0 stand-in-pose frames after frame 1**, and PLAY-to-first-frame ≤ +100 ms vs players-1.

**Screenshots.** `readiness-{nba,nfl,soccer}-frame1.png` and the seed photo contact sheets (`looks-src-*`).

**Protocol impact.** None. **Save risk.** None: static data.

**Other teams.** Shell: the regex diff and the `pixelReady` gate line. nba/nfl/soccer: the gate line.

---

### players-5 · P0 · Drawing the looks, live in all three engines

**Must, in order (four commits)**

1. **Refactor without visual change** (guard: a golden raster hash for 6 looks × 4 views):
   - Move `Buf`, `buffer`, `put`, `capsule` and `ball` from `body.ts` into `src/game/pixel/raster.ts`.
   - Add a pure `rasterBody(look, pose|joints, view, px) → { w, h, px: Uint32Array, ax, ay, handL, handR, top, hairAnchor }`.
   - `drawBody` becomes `rasterBody` plus a canvas.
   - Retire the "everyone shares one skin tone" policy comments (`sprites.ts:6-7`, `body.ts:591`).
2. **`src/game/pixel/head.ts`**: `paintHead(buf, ox, oy, head, hr, frame, look, detail, sec?)`.
   - The 18 hair recipes: high-top block, afro ring, locs and long hair as trailing capsules, bun/ponytail knot, mohawk strip; braids as hair/skin rows at ≥40 px.
   - The 8 facial-hair masks.
   - Headband/wrap colours, goggles, the NFL helmet with visor tint (clear/dark/tint), and under-helmet hair at the nape.
   - LOD: hair silhouettes collapse below 24 px; facial hair is dropped below 16 px. The head radius × `headScale(px)`.
   - The `sec` parameter (hair-lag offset) is reserved for R10 in players-8.
3. **`body.ts` gear and numbers:**
   - `skinRamp` with a 1 px lit rim for tones 7–9 on dark kits
   - sleeves (`sleeve`, `shooter`, `long`); wrist bands and tape at ≥40 px
   - knee pads/sleeves, tights, calf sleeves
   - socks height and shoe accent
   - gloves; the NFL towel (≥24 px)
   - **Numbers (L-5):** 3×5 below 40 px, 4×7 from 40–59, a new 6×10 at ≥60. The turned chest compresses gaps, never glyph columns. Hidden when `squeeze < 0.6`. The back number is kept.
4. **`rig.ts` `shapeOf`** (widths only; bone lengths untouched, so `legScale` holds):
   - `bulk = clamp(BMI/24.5, 0.72, 1.6)`
   - `rTorso = 0.082·(0.62+0.38·bulk)`, `shoulderW = (0.128+pads·0.035)·(0.74+0.26·bulk)`, `rUpper·(0.7+0.3·bulk)`, `rThigh·(0.8+0.2·bulk)`
   - curated `build` multiplies bulk: lean .9, muscular 1.08, stocky 1.12, heavy 1.2
   - `style.ts` `heaviness`, the `widen` stride and `sprintLean` stay consistent (keep-list)
5. **`LooksGallery.tsx`** (`?pixel=looks`, lazy, routed from `Gallery.tsx`, unlinked in production, storage-free):
   - every hair/facial/gear trait × 16/24/32/40/60/80 px × 4 facings × 2 kits
   - a 10-tone × 8-kit contrast grid
   - the 12 stars per sport in their own kits and in a shared kit
   - the seed lineup
6. **Wire into the engines and cards** (players-owned modules only, thanks to players-2):
   - `select-{nba,nfl,soccer}.ts` `lookFor` becomes `matchLook(sport, refOf(...), kit, {...})`: NFL pads by position; soccer gets `buildOf` and gk gloves.
   - `ut/CardArt.tsx` `lookOf` becomes `cardLook(line)`, so today's full-body portraits show real looks before players-6.
   - Renderers stop calling `hairFor`/`beardFor`; those stay exported for the galleries.
7. **Crowd recolour, `src/game/pixel/crowd.ts`:**
   - `crowdSkin(noise)` from the 10 `SKIN_TONES`; `crowdHair(noise)` from the natural `HAIR_TONES`.
   - They replace the two-colour `mix([200,156,118],[74,46,30])` through **one-line calls** in `persp.ts` `standsWall` (≈129) and the courtside fans (≈189), `pitch.ts` touchline fans (≈115), `field.ts` `crowdBand`, and `court.ts` `drawCrowd` (5 tones → 10).
   - Camera, floor and stands geometry are untouched (§6.2).
8. **Render-only proof, `src/game/pixel/render-only.test.ts`:**
   - **Import graph:** a regex walk from each sport's simulation modules (`engine`, `autopilot`, `game`, `drive`, `ratings`, `match`, `arcade`) never reaches `pixel/*` or `data/appearance`.
   - **Seeded state hash:** a seeded NBA, NFL and soccer game runs, and **every step** it also calls the pure selection code (`select-*.ts`), `matchLook` and (from players-8) the anchoring and modifier code on every body. A hash of the full engine state per step must equal the hash from the same run without those calls. This catches any write into `b`.

**Stretch (L-6).** A soccer kit `pattern` material (stripes, hoops, sash, halves) from `src/data/appearance/kits-soccer.json`. If not reached, it goes to phase 2.

**Tests and acceptance**
- `body-build.test.ts` (40 px, front-on):
  - Shaq (85/325) torso ≥24; Curry ≤18; Bol ≤18 and ≥5 px narrower than Shaq
  - |Jokić−Giannis| ≥2; BMI 31 vs 20 ≥25% wider; Haaland vs Messi ≥3
  - `headScale(16) = 1.25`
- `numbers.test.ts`: 23/80/88/99/7/12 are exact at 28 px front-on; exact or hidden at 40/56/80 px and facings 0.6–0.9; the 6×10 font at ≥60.
- `likeness.test.ts`: the §3 identity row at 24, 40 and 60 px for NBA (12, 66 pairs), NFL (11) and soccer (11).
- `crowd.test.ts`: `standsWall` uses ≥8 skin colours and ≥4 hair tones.
- `render-only.test.ts` passes for all three sports.
- The gallery shows all 7 owner examples correct, checked by eye and recorded.
- `players-sprites.mjs` still meets the A-1 targets with detailed sprites; `players-matchperf.mjs` at the players-2 targets; `players-keep.mjs` passes.

**Screenshots.**
- `after-lineup-{nba,nfl,soccer}.png` beside `before-*`
- `closeup-{sport}-*.png` (DPR 2)
- `ingame-{sport}-{393,844land}-*.png`
- `stands-{sport}.png`
- `gallery-looks.png`

**Protocol impact.** None; `render-only.test.ts` proves it. **Save risk.** None.

---

### players-6 · P1 · Bust portraits on every card and portrait surface, plus the celebration library

**Why here.** Busts reuse `head.ts`, and the card reveal's `cheer` bust shows the player's own celebration. So the celebration library is built once, here, for cards, the match and a later walkout.

**Must**

1. **`src/game/pixel/bust.ts`**: `rasterBust(look, app, { size, facing = π/2 ± 0.3, variant: 'bust'|'cheer'|'locked' })`.
   - A head-and-shoulders crop at portrait detail (≈44×48 grid, head radius ≈11–13).
   - Brows, eyes with a highlight at large sizes, a nose shadow, mouth, ears, cheek shading.
   - Shared `head.ts` hair, facial hair and gear; the jersey neckline and shoulders in kit colours; NFL pads; a small chest number.
   - NFL busts are helmet-off.
   - `locked` is the real silhouette (hair and build shape) in a dark tone with a rim light.
   - Front-on is verified by eye: the audit's figure read as "back of the head".
2. **`src/game/pixel/portrait.ts`**: `portraitFor(ref, kit, opts)`.
   - An LRU with a **byte cap** (≤6 MB per 300 portraits; ≤400 entries).
   - Entries are canvases, or blob URLs via `canvas.toBlob`, never main-thread `toDataURL`.
   - Keyed `pid|season|c1|c2|num|variant|size|appearanceVersion`.
   - The existing **6 ms/frame pump** moves here from `CardArt.tsx` unchanged (keep-list), ordered visible-first via `IntersectionObserver`.
3. **`src/ui/PlayerPortrait.tsx`** (main-bundle safe: `import()` only, with a fallback until ready). Props: `sport, pid, season, c1, c2, num, pos, ht, wt, size, variant: 'bust'|'cheer'|'locked'|'dim'`. The contract goes to ut, nba, nfl, soccer, shell and packs (§6.4).
4. **`UtCard`:**
   - `.utc-px` becomes the bust at every size: a tight head-and-collar crop at 34–51 px, the full bust at ≥52.
   - The `locked`/`dim` modes from players-3 use the bust silhouette.
   - `portraitUrl(line, pose)` stays exported unchanged for ut's `play-art.tsx`. The reveal's `pose='cheer'` maps to the bust `cheer` variant.
   - The box invariance and `card-contract.test.ts` from players-3 are re-run.
5. **Draft cards:**
   - `src/ui/Card.tsx` `TradingCard`: `.tc-art` shows `PlayerPortrait` with `buildOf` (attrs ht/wt) over the era pattern. `Jersey` stays the fallback.
   - `src/ui/Binder.tsx`: only on-screen cards draw, ≤3 bust draws a frame.
   - `src/ui/poster.ts`: uses the cached bust if ready, else initials (no async).
6. **CardDetail** shows the 170-px card with the bust (head ≥45 design px), and the profile row adds hand/foot and build from appearance.
7. **Celebration library, `src/game/pixel/celebrate.ts`**: 12 generic, original loops of 1.2–2.5 s (research §4.7):
   - arms-up (existing clip), fist-pump, chest-thump, point-sky, flex, salute, knee-slide (soccer, with a dust trail), arms-wide run, finger-wag (block), jump-spin, "too small" shrug
   - backflip, gated to AGI ≥85
   - Generic ids only: no player-named ids and no trademarked gestures.
   - `celebrationFor(who, ctx)` chooses by position archetype and context (game-winner, dunk, TD, goal, block), or by the Tier A `motion.celebrate`.
   - **In the match:** `select-*.ts` plays it from `p.end` make or TD, or `goalAt`, inside the dead-ball window. Skippable after 0.5 s via the sport team's skip input (§6.2). It is cut at the next possession's first frame.
   - **Teammate run-ins (the team huddle):** teammates within range jog toward the scorer (a render-only sprite offset with the jog clip, anchored feet) and high-five on arrival. An NFL TD gets a team run-in in the end zone.
   - **Reduced motion:** the celebration is shortened to its key pose, with no run-in camera effect.

**Stretch.**
- Spot-aware celebrations: the scorer drifts toward the corner flag, end zone or baseline, inside the window.
- A frames-plus-busts gallery page for packs.

**Tests and acceptance**
- `bust.test.ts` (node):
  - deterministic output
  - head bbox ≥55% of the grid width; eyes present front-on
  - Kareem's goggles, Iverson's braids and Haaland's blond tone visible
  - **recognisability:** the 12 stars in one shared kit differ pairwise by ≥15% of pixels; `locked` ≥10%
  - draw cost reported (report-only, 3× margin vs 1.0 ms median)
- `celebrate.test.ts`:
  - every loop is 1.2–2.5 s and skippable from 0.5 s
  - the backflip never appears for AGI <85
  - with the window cut, 0 frames remain at the next possession's first frame (synthetic `p.end` → `startPossession`)
  - reduced motion uses the key pose only
- `players-cards.mjs` at 393 and 320, in design px: head ≥24 at 80, ≥45 at 150/170, ≥57 at 190, ≥14 at 44, ≥11 at 34–40. Box invariance ±0.5 px; 0 overflow.
- **Fill under throttle:** first visible row ≤300 ms at 1× and ≤900 ms at 4×; a 120-card fill ≤1.2 s at 1× and ≤3.5 s at 4×; no long task >50 ms; scroll p95 ≤17.5/≤34 ms; portrait memory ≤6 MB per 300.
- **UT first open** (P-1 method): not regressed by more than 5% at 1× and 4× per sport.
- **Binder** with 1,000 drafted cards (fixture): ≤3 bust draws a frame; scroll p95 ≤17.5 ms at 1× and ≤34 ms at 4×.
- Static: `Card.tsx` imports contain no `pixel/` path.
- `players-keep.mjs` (the portrait pump) passes.

**Screenshots.**
- `cards-{nba,nfl,soccer}-393-{club,detail,reveal}-bust.png`, `cards-nba-320-club-bust.png`
- `draft-{sport}-393.png`, `binder-nba-393.png`
- `collection-locked-dim.png`
- `celebrations-sheet.png`, `teammates-runin-{nba,nfl,soccer}.png`

**Protocol impact.** None. **Save risk.** None: signatures kept.

**Other teams.**
- ut: `<PlayerPortrait variant="locked"|"dim">` and `UtCard mode` in CollectionGallery (M12), and MOTM (M3).
- nba/nfl/soccer: player-of-the-game screens (NBA-10, NFL F-2, the soccer result screen).
- shell: M9.
- The sport teams own celebration timing, confetti and skip (§6.2).

---

### players-7 · P0 · Tier A curation to coverage, soccer feet, motion overrides

**Why here.** The pipeline (players-4), drawings (players-5) and busts (players-6) exist, so every batch can be judged as rendered contact sheets in the match and on cards.

**Sizing.** We reject splitting this into three tasks (§9 S1) because of the 10-task cap. It stays one session through:
- the tooling and the 90 seeds from players-4
- three per-sport commits, each ending in a reviewed contact sheet
- a must line (GOAT + Legend + top-60) separate from the target line (+50 most-pulled)

**Must, per sport: NBA, then NFL, then soccer (three commits)**

1. Run `--candidates`. **Must coverage:** 100% of GOAT and Legend plus the top 60 by OVR, deduplicated. **Target:** plus the 50 most-pulled golds by pack weight and the cover-level current stars, ≈170–200 per sport.
2. Author rows in `source/<sport>.looks.json`:
   - **Fields:** hair, tone, facial, head gear, eyewear, sleeves and knee gear with the side, socks, shoes, build override, hand, NFL visor/tint, towel, gloves, under-helmet hair, and soccer foot.
   - **Skin:** only from a `--photos` contact sheet, with `skinSrc`, else omitted.
   - **Era overrides** for every GOAT with 10+ seasons: Jordan, Kareem (goggles era), Shaq (early and late), Rodman (dyed by season), and so on.
   - **Handedness** only where well known: Russell, Ginóbili, Harden, Mullin; Steve Young, Vick, Tua, Stabler; Messi, Robben, Salah, Maradona, Roberto Carlos, Bale.
   - Every row has `src` and `reviewed: true`.
3. **Motion overrides** (`motion`) for ≥30 stars per sport: shooters (set point, speed, fade/hook: Kareem hook, Dirk one-leg fade), QBs (slot, hold), dunkers, strikers, and signature celebrations by generic id.
4. `--build`, then a **contact sheet:** `LooksGallery` lineups at 24/40/60 px and bust sheets at 80/170 px for the whole batch. Fix errors as one-line edits, then commit.
5. **Soccer feet:**
   - Download `players.csv.gz` once into the git-ignored `.cache/` from the CC0 transfermarkt-datasets mirror used by `scripts/soccer_sources.py` (`TM_BASE`).
   - `--soccer-feet` writes `source/soccer-feet.json`.
   - Add a provenance line to `docs/CREDITS.md`.
   - If the download is blocked, keep the curated feet only and record it.
6. **Independent second review.** It is requested in the team doc: the lead's reviewer, or else the first step of players-10, which runs in a different session. It covers 100% of GOAT/Legend rows plus a random 20% of the rest, against the same photo sheets and public descriptions. Target: ≤5% field errors. Every error is fixed and logged.

**Stretch.** The 50 most-pulled golds and cover-level stars beyond the must line. Anything short of the target is listed by pid in the team doc as the first phase-2 batch.

**Tests and acceptance**
- `appearance-data.test.ts` passes: pids, names, eras, sync, size ≤20 KB gzip, `skinSrc` on every curated skin.
- Coverage report per sport: 100% of the must line; count vs target.
- 100% of rows have `src` and `reviewed`.
- The 7 owner examples render correctly.
- Every 10+-season GOAT has its eras checked (a checklist in the doc).
- Soccer foot coverage ≥85%.
- `likeness.test.ts` and `bust.test.ts` recognisability are re-run with real data and still pass.

**Screenshots.** `curated-{nba,nfl,soccer}-{24,40,60}.png`, `curated-busts-{sport}.png`, `looks-src-{sport}-*.png` (kept in `O/`, never committed).

**Protocol impact.** None. **Save risk.** None.

---

### players-8 · P0 · Animation core: transitions, game-time clock, grounded locomotion, turns and contact

**Must, in order**

1. **`src/game/pixel/blend.ts`:**
   - `blendJoints(a, b, t)` slerps bone directions from the pelvis out and rebuilds with the target body's bone lengths. Keyed poses go through `rig.joints()` first.
   - A transition memo `{ fromKey, fromJoints, start, dur }`. On an identity change (clip or pose family), blend for 100 ms (6 frames), quantised to 3 steps.
   - **A separate small blend LRU** (≤96 entries, area-counted), keyed `who|key~fromKey|step|px`, so blends never evict gait sprites. Blends are **skipped under 24 px**. A blend step the budget can't afford falls back to the target pose (a cut), and never makes a fresh pose stale.
   - **Contact lock (R1).** A blend never spans an event frame (`release`, `catch`, `contact`, `plant`, `impact`). Contact reactions cut in at 0 frames. A player-initiated action changes the acting limb on its first frame.
   - **Key holds (R2):** set point 3 f, apex 2–4 f, contact 2 f, follow-through 12–24 f, done by warping anticipation and recovery only. Event frames stay on engine time.
   - **Control return (R13):** an action's `controlAt` frame lets a new input blend out the follow-through over 4 frames.
   - **Phase-matched gait entry** from `stepL`/`stepR` beats.
2. **Game-time clock and discontinuities.**
   - All memos run on the renderer's game time `t`.
   - `Δt < 0` or `Δt > 0.25 s` between draws, or a `resetMotion()` call, resets blend memos, foot-anchor dampers, `turnToward` state and the crowd ripple. That covers replay rewind, SIM jumps and resume after a long pause. The sport teams call `resetMotion()` at replay start and SIM.
   - Hit-stop (game time held) freezes blends; slow-mo slows them.
3. **`src/game/pixel/locomotion.ts`** (pure, used by `select-*.ts`):
   - `pickGait(speed, clipSpeeds)` chooses walk/jog/run/sprint with the rate clamped to **0.8–1.25×** (R3), keeping the `widen` heavy stride and `sprintLean` (keep-list).
   - **New `walk` clip** (a CMU walking trial via `scripts/build_mocap.py --inspect`, with `stepL`/`stepR` beats). Use `MOCAP_CACHE=<worktree>/.cache/mocap/bvh`, seeded from the main checkout's cache.
   - **Remove the dead bands:** NBA `run` below 2.5 ft/s showing `ready`; the static NBA `defend` pose at 1–3 ft/s (use `shuffle`/`backpedal` at matched rates); soccer `ready` while drifting 0.15–1 m/s (walk); the NBA backpedal rate cap.
   - **Stance-foot anchoring (R4).**
     - `plantedFoot(clip, frame)`; the sprite is offset so the planted toe holds its screen anchor for the contact beat.
     - The sim leads through a damper ≤0.5× the gait's own displacement a frame, re-anchors at each strike, and decays to 0 airborne.
     - The offset magnitude is **capped at 5% of body height**.
     - The ball and hands take the same offset.
   - **HUD contract (§6.3):** `drawnOffset(who)`, `headTop(who)`, `handAnchor(who, side)` and `resetMotion()` are exported from the renderer. Rings, name tags, pass lines and tap-to-pass hit tests (NBA-13) use them.
   - **Rates:**
     - step 1 (30 fps) for the carrier/handler, his marker, the controlled body and any sprite ≥40 px
     - step 2 for the rest, so every on-screen body is ≥12 effective fps
     - idles step 2 at ≥32 px
     - NFL and soccer sprites under 22 px move from step ≥3 to step 2, within the area cap
   - **Facing and turns (R5):**
     - `turnToward(memo, target, dt)` for all three sports: a 90° turn takes 80–120 ms; spins, dives and falls are exempt. 16 facings from 18 px when the area cap allows.
     - Under 45°: rotate through the facings.
     - **45–120°:** a `cut` plant frame (plant warped to 0.15 s) with a 1 px dip.
     - **Over 120°:** 2–3 decel shuffle steps, then the plant.
     - A **1-frame head lead** into the new direction.
   - **Defenders face the ball while retreating (A-5):** a render facing override with backpedal/shuffle at matched rates, for soccer defenders and the NBA/NFL defense phases.
   - **NFL QB drop:** rate-matched `backpedal` facing downfield, with **3/5/7-step drop footwork** chosen from the engine's drop depth (planted beats), then `ready` once set.
   - **Lean (R6):** up to 12° into acceleration and 8° into turns; **6° brake lean-back** for 4–6 f with dust.
   - **Squash and stretch (R7):** takeoff +1 px (+2 at ≥48), landing −1 to −2 px for 3–6 f.
   - **Overshoot and settle (R9):** 1 px past rest for 1 frame after landing, plant or catch tuck.
4. **`src/game/pixel/impact.ts`** (the contact half of the juice):
   - `impactOf(kind, { massA, massB, closing }, reduced) → { stopMs, trauma, kickPx, slowMo?: { factor, ms }, reaction: 'flinch'|'stumble'|'fall', lieMs }`, carrying the full research §4.8 table:

     | Moment | Hit-stop ms | Trauma | Other |
     |---|---|---|---|
     | green | 40 | 0 | |
     | block | 60 | 0.25 | chase-down block 80 |
     | dunk | 70 | 0.35 | |
     | posterizer | 90–120 | 0.6 | 0.5× slow-mo for 300 ms |
     | ankle-breaker | 50 | 0.15 | |
     | wrap tackle | 33–40 | 0.15 | |
     | big hit | 80–100 | 0.5 | |
     | truck | 90 | 0.4 | |
     | int | 50 | 0.2 | |
     | spectacular catch | 60 | 0.1 | 0.5× slow-mo for 250 ms |
     | power strike | 33 | 0.2 | |
     | goal | 66 | 0.3 | |
     | big save | 50 | 0.2 | |
     | woodwork | 33 | 0.25 | |

   - **R11 reactions** by mass × closing speed, with **minimum lie times** of 0.4 s light and 1.0 s heavy, and a keeper get-up after 1.0 s. Get-ups are cut at the next snap, possession or attack.
   - `HitStopCap`: ≤150 ms of hit-stop per rolling second.
   - **Reduced motion (R14):** ≤30 ms, 0 trauma, no slow-mo.
   - **Outside our lane:** an ≈8-line hunk in `src/game/juice.ts` so `Juice.hitStop(kind, now, ms?)` honours the cap and the optional `ms`. The 30 ms reduced-motion clamp is kept.
   - **Check:** `Arcade.tsx`'s rival-score race and any online wall-clock timer do not depend on hit-stop length. The result is recorded.
   - **Acceptance is the API, the cap and tests.** Wiring at the call sites is a named hand-off (§6.6) and is **not** counted as done until the sport teams' branches show it at merge.
5. **Name-tag helper, `src/game/pixel/name-tag.ts`:** `drawNameTag(ctx, { name, num, kit, x, y, px })`, a pixel plate the HUD owners call (§6.3).
6. **Secondary motion (R10)** and the head bob, last in the must tier:
   - long hair, locs, ponytail and towel lag the head or pelvis by 1–2 frames, shifting only on frames 2 and 4 of a cycle (through `head.ts` `sec`)
   - shorts/jersey flutter 1 px on alternate sprint frames; the NFL towel swings ±1 px
   - **head look-at** toward the ball or travel direction
   - head bob −1, −1, +2 px per stride at 40 px
   - If R10 does not fit, it is the first must item of players-9 (carry-over rule).
7. Record in the team doc the A-5 "interpolating 15 fps clips" deviation and its reason (§2).

**Stretch.** None beyond the carry-over.

**Tests and acceptance**
- `transitions.test.ts` (importing `select-*.ts` and `rasterBody` joints), on §3's cut list:
  - max joint displacement between consecutive displayed frames ≤20% of body height
  - event frames equal engine times exactly at step 1
  - the first frame after an action press differs in the acting limb
  - holds at 3 / 2–4 / 2 / 12–24 f (±1)
- `time.test.ts`: on replay rewind, pause/resume, SIM jump and hit-stop, 0 frames blend from the pre-jump pose; the first resumed pose jump ≤20% of body height; planted drift back to ≤1 px within one stride.
- `locomotion.test.ts`:
  - rate within 0.8–1.25 in band; planted toe drift ≤1 px at 40 px
  - drawn offset ≤5% of body height
  - turn classes (plant at 45–120°, shuffle above 120°)
  - head lead 1 f; brake lean 6° for 4–6 f
  - hair/towel lag 1–2 f; head bob −1,−1,+2 at 40 px
- Slide classifiers (import `select-*.ts`, `PS_SPORT`-guarded):
  - `slide-nba.test.ts`: 3 seeded games always, 24 opt-in with `PS_SLOW=1`; ≤8% (baseline 29.1%)
  - `slide-soccer.test.ts`: ≤4% (12.8%)
  - `slide-nfl.test.ts`: ≤5% of on-ground frames, and 0 idle-clip frames while the QB moves over 1 yd/s
- `impact.test.ts`: the table ±10 ms per moment; the cap holds at ≤150 ms/s under a burst; reduced motion ≤30 ms with 0 shake; lie times 0.4/1.0 s.
- `juice.test.ts` (existing) still passes: identical seeded results.
- `render-only.test.ts` is extended with anchoring and modifiers in the per-step state hash.
- `players-sprites.mjs`:
  - effective fps ≥12 for every on-screen body (none <10), ≥28 for near/large/ball bodies
  - blends under load: stale ≤2% for ≥48 px in the 20 frames after an NFL snap; blend sprites ≤10% of cache entries; hit rate ≥ players-2 −5 points
- `players-matchperf.mjs`: as players-2, at 5 viewports. Peak sprite area ≤6 Mpx.
- `players-keep.mjs` passes, including `widen`/`sprintLean`, the afterimage and posterizer slow-mo.

**Screenshots.**
- `anim-strips-after-a2.png`
- `burst-{nba,nfl,soccer}-after.png` (0.25×)
- `turns-{sport}.png`
- `qb-drop-{3,5,7}.png`
- `secondary-hair-towel.png`

**Protocol impact.** None: sprite offsets, pose choice and hit-stop length only (the cap only shortens it). **Save risk.** None.

**Other teams.**
- nba/nfl/soccer: `resetMotion()` at replay start and SIM; HUD calls through `drawnOffset`/`pin`/`drawNameTag`; `impactOf` at their call sites.
- nba/nfl: approve the `juice.ts` hunk.

---

### players-9 · P1 · Actions, signature motion and crowd reactions

**Must, in priority order**

1. **The act map and coverage**, in `select-*.ts`:
   - every act in today's unions (§6.1), plus **every act registered through the intake by the time this task starts**, maps to a clip or keyed pose
   - the family fallback stays only for acts registered later
   - `actions.test.ts` iterates the union and the intake registry, with synthetic bodies for acts not yet on this branch
2. **Wire the unused recorded clips:**
   - `crossover`/`crossover_l` for NBA `cross` (warped to the engine's 0.35 s); the step-back as a planted `cut` plus a hop
   - `dribble` with bounce beats synced to the ball phase
   - `cut`/`cut_l` for the NFL juke (plant at engine time) and **NBA hesitations**
   - `stiff_arm` for NFL `stiff` (extend at engine time, hold)
   - `getup_front` after face-first falls
   - `catch`/`catch_run` for NBA catches
   - **Soccer:** `shuffle`/`shuffle_l` for the jockey; `fall_back` for heavy frontal contact (a §8.4 reaction). Any clip still unused after this task is dropped from that sport's load list.
3. **A-3 replacements (keyed poses or mocap)**, following research §4.4–4.6:
   - the **dunk family**: windmill (arm sweeps a full circle with 1–2 smear frames), tomahawk, two-hand, hang
   - spin (smear at the back facing)
   - pass variants (chest, bounce, overhead) by ball kind
   - distinct **block** (one-arm swat, 1 smear), **rebound** (two hands, a 1-frame secure, landing squash) and **contest** (hands up, small hop)
   - the NBA **screen** pose
   - NFL truck (shoulder drop, then a stumble), NFL spin, a **wrap-up tackle**, and the **sack** (QB `fall_back`/`fall_forward` when `p.end.kind === 'sack'`, the sacker wraps)
   - NFL get-ups after `impactOf` lie times
   - **Soccer:** keeper side dives (the `dive` clip rolled about the forward axis, low/mid/high, never a belly-flop); feet-first slide tackle; knee slide; dribble touches on `stepL`/`stepR`; **inside-foot pass vs laces shot**; left/right kicks by the recorded foot, or the ball side; a header with neck cock and snap; get-ups after `down`
4. **Smears (R8)**, 1 frame each: windmill, spin, the kicking leg at contact −1, the QB arm at release −1, the keeper's flight start.
5. **Mirrored clips** through the load-time mechanism: `kick_l`, `jumpshot_l`, `throw_l`, `layup_l`. Lefties use them on 100% of releases. The renderer reports the shooting hand for the **drawn** ball position only.
6. **NFL exchange gaps (audit A-1):**
   - the snap and handoff exchange: the QB extends and the RB pockets over the frames before the engine's transfer (`engine.ts:738-745` teleports at dist<1.8), with `handAnchor(who, side)` so nfl draws the ball in hand (§6.3)
   - the **FG holder** kneels, instead of standing
7. **Soccer keeper and defending (audit A-1, S-1):**
   - keeper **set split-step** (§4.6) and **side-shuffle**
   - catch-and-gather, then distribute (throw or kick)
   - standing poke/block tackle
   - throw-in pose
   - corners, goal kicks and keeper 1v1 when registered through intake
8. **Motion DNA, `src/game/pixel/motion-dna.ts`.** Defaults are rule tables (research §3.8):
   - shooters by 3PT and height
   - **dunk set by DNK/VRT, replacing the id-parity choice** in `dunkStyle`/`spins360` (exported signatures kept)
   - run style by AGI/STR/ACC/height
   - QB slot weighted 50/35/15 by pid hash
   - Curated `motion` from players-7 overrides them.

   **Modifiers** (`src/game/pixel/modifiers.ts`, after retargeting):
   - `shotForm`: set-point arm height; the follow-through hold from `shot.hold`; fade lean; a **hook** variant for bigs near the paint (Kareem, Dirk-style fade)
   - `qbSlot`: 15°/35°/55° upper-arm rotation on throw frames
   - `runStyle`: lean, knee lift, arm carriage, bob, within anchoring tolerance
   - `dribbleStyle`: the ball height in `dribbleArm`
   - **Release, throw and kick events stay exactly where the engine puts them.**
9. **Crowd reactions in 6–12 frames**, in `crowd.ts`:
   - `standsWall` textures get 3 frames (seated, standing, arms-up), precomputed once and area-counted
   - a per-column-band frame with a random 6–12 f ripple after `excite(level, t)` on **game time**; reset on discontinuity
   - 1-frame **flash-bulb sparkles** on dunks, TDs and goals; a hush on misses
   - triggers read existing state, via one-line calls: NBA `fx.crowd` rising; NFL `p.end.kind` td/int or long gains; soccer `goalAt`
   - reduced motion: bob only, no sparkles, never the arms-up frame
10. **Isolated match walk:** an autoplay match per sport at 393×852, 320×568 and 844×390, with a reduced-motion pass: 0 page errors, the keep-list, and screenshots looked at.

**Stretch** (each recorded by name in §7 if not reached):
- **R12 rating-gated variants:** 1–2 per action for base cards, 3–4 for 85+/Tier A
- **NBA:** the layup family (finger roll, reverse, euro, floater); behind-the-back and between-the-legs crossovers; box-out near the rim during shots
- **NFL:** diving and over-the-shoulder catches; sideline toe-tap; pass-breakup swat; a drop beyond the hand wobble; gang-tackle pile; throw on the run (gait legs plus throw upper body via a bone-masked `blendJoints`)
- **Soccer:** first touch (trap, chest, thigh, turn on receive); chip/volley; parry/punch/tip-over (direction from soccer's R-2); smother
- new CMU trials found with `--inspect` (subjects 10/11, 6/102/124, 143, 90/140), each ≤12 KB and ≤80 KB raw in total, credited in `docs/CREDITS.md`
- `src/ut/WalkoutFigure.tsx`, built to the §6.5 agreement

**Tests and acceptance**
- `actions.test.ts` (NBA, NFL) and `actions-soccer.test.ts`:
  - every union act, every intake act and an unknown act map without throwing, and never to idle while moving
  - the NFL juke uses `cut`
  - the windmill hand angle sweeps ≥330°
  - a keeper dive rolls the torso ≥60°
  - recorded left-footers kick with `kick_l` on ≥95% of kicks unless the ball is on the right
  - every warped contact event lands on engine time
- `motion-dna.test.ts`:
  - DNA on vs off gives the same release/throw/kick engine times
  - defaults deterministic; curated overrides apply; dunk style independent of id parity; bone lengths kept
  - **visibility:** set-point hand height ≥3 px low vs high at 60 px; QB slot 15/35/55° ±5°; run-style torso lean ≥4° apart; mirrored clip on 100% of lefty releases
- `crowd.test.ts`: excite → the first standing band within 6–12 frames; back within 1.5 s; reduced motion never selects arms-up; reset on discontinuity.
- `render-only.test.ts` is extended: the import graph includes `motion-dna`, `modifiers`, `celebrate`, `crowd`; the per-step state hash is identical.
- `mocap.test.ts` passes for the mirrored clips. `juice.test.ts` passes.
- The players-8 transition targets hold for the new actions.
- `players-matchperf.mjs` at the players-2 targets with crowd frames on; peak sprite area ≤6 Mpx.

**Screenshots.**
- `anim-strips-after.png` (all actions, matching the audit's `anim-strips.png` rows)
- `burst-soccer-keeper.png`, `nfl-exchange.png`
- `shot-forms-nba.png`, `qb-slots.png`
- `crowd-react-{sport}-{0,6,12}.png`
- `walk-match-{sport}-{393,320,844land}.png`

**Protocol impact.** None. If any DNA value or variant would need sim timing, stop and record "Protocol bump needed". **Save risk.** None.

---

### players-10 · Release gate, verify runner and hand-over

**Steps**

1. **Fix-up first.** Fix anything open from the card walk (players-3/6), the match walk (players-9) and carry-overs. If no lead reviewer did players-7's independent second review, do it now: this is a different session from the curator. Target ≤5% field errors, all fixed.
2. `bash O/heavy.sh npm run typecheck`, then `bash O/heavy.sh npm test`: all three suites, once. Fix any failures.
3. `bash O/heavy.sh npm run build`, **once**, into a scratch `--outDir`; never commit `dist`. Then:
   - `scripts/audit_startup.py`: NBA/NFL/soccer startup gzip ≤ +2 KB over base `acdf3e2` (773/645/592 KB).
   - Chunk sizes against the §2 budgets.
   - Grep a curated pid to confirm appearance is absent from `index-*.js`.
   - Read the service worker's precache list: soccer appearance is on demand once shell's regex lands. Until then, record the interim cost.
   - `players-matchperf.mjs` on `vite preview` at 5 viewports, 1× and 4×, against §3. `players-readiness.mjs` and the UT first-open check on the production build.
   - The artifact IIFE build (`vite build --mode artifact`, `__SOCCER__` false) runs only with the lead's OK, since BUILD-RULES allow one build. Otherwise a static check confirms the soccer appearance glob is guarded and the size check is handed to the lead's integration build.
4. **`players-verify.mjs`** on the production build: every §3 row PASS, or explained.
5. **Final before/after set** with contact sheets: lineups, close-ups, in-game, cards at every width, strips, crowd, celebrations. Look at every image.
6. **Team doc**, `docs/studio-overhaul/players.md`:
   - before/after for every §3 row
   - tests added
   - **"Protocol bump needed: none. Simulation code (`engine`, `autopilot`, `game`, `drive`, `ratings`, `match`, `arcade`) was untouched; `render-only.test.ts` proves it with an import-graph walk and a per-step seeded state hash."**
   - Touched outside my lane
   - the `render.ts` hunk ledger with line anchors
   - every hand-off with its status, including `impactOf` wiring and `pixelReady` gates "not done until seen at merge"
   - the deviation note; owner device checks; phase-2 backlog
7. **Post-merge verification.** This is a lead step, not a branch task. The merged tree exists only after the lead merges, and sport teams change cameras (NBA-20, NFL V-1 zoom and horizon 0.06, soccer V-1/V-2), defense phases and acts. The lead runs `node scripts/qa/players-verify.mjs` on the merged tree, re-measuring:
   - the sprite-size distribution, A-1 stale %, LOD visibility, act coverage (intake acts now real), readiness and `frameOf` non-fallback on merged editions
   - against the same §3 targets
   - On a FAIL, the lead opens a players fix session; the runner names the failing row.
8. Push.

**Owner device checks** (listed in the team doc)
1. "Can you tell who is who?" at a glance: the NBA five, the NFL backfield, the soccer front three, in portrait and landscape.
2. Card readability on the phone at every size: club grid, squad pitch, SBC, Store, detail, reveal.
3. Frame and foil rendering in iOS Safari (mix-blend-mode, masks, `background-clip:text`, pixelated upscaling), which Chromium cannot prove.
4. A 100+ card club scroll and the binder.
5. Animation transitions, planted feet and turns in a real match; NFL near-player smoothness.
6. Celebration and crowd timing; reduced motion on the device.
7. After a full match, background the PWA and return: it must still be alive (canvas memory).
8. Skin tones of curated stars look right. Report any wrong row; it is a one-line fix.

**Protocol impact.** None. **Save risk.** None.

## 6. Cross-team contracts v0 (published in players-1)

### 6.1 Action contract and intake

**Today's acts**, which all map to an animation by players-9; unknown acts fall back by family from players-2:
- **NBA:** `idle screen run dribble shoot layup dunk contact standdunk pass catch defend contest block cross stepback spin stumble fall land celebrate rebound`
- **NFL:** `stance run block throw catch carry juke spin stiff truck windup tackle down rush backpedal celebrate kick`
- **Soccer:** `idle run dribble kick tackle down dive catch header celebrate set wall`

**Intake.** A sport team that adds or needs an act adds a row to "Animation requests" in its own team doc, or tells the lead:
- the act name
- which body
- the start and end, and the engine field holding the contact event time
- any optional Body fields

Players keeps the registry in `players.md`. Rows registered before players-9 starts are must-tier there. Later rows get the family fallback and are listed for phase 2.

**Please do not hand-key poses in `select-*.ts` or `render.ts` player sections.** If a pose is urgent, send the request; players will add a placeholder within the task in progress.

**Reserved names**, proposed so engines can emit them safely now (family fallback until animated):

| Sport | Reserved acts |
|---|---|
| NBA | `ft` (set, dip, release, hold), `pumpfake`, `steal`, `foul`, `charge`, `hesi`, `post`, `putback`, `boxout`, `dive`, `inbound`. `board` = rebound, `switch` = run |
| NFL | `slide` (QB), `throwaway`, `protect`, `dive`, `hurdle`, `punt`, `hold` (FG holder), `snap`, `handoff`, `pitch`, `fake`, `pumpfake`, `pile`. A broken tackle uses `stumble` |
| Soccer | `skill:<id>` (≥3, e.g. stepover, drag-back, roulette), `shot:finesse\|chip\|driven\|low`, `throwin`, `corner`, `goalkick`, `jockey`, `poke`, `slide`, `keeper:set\|shuffle\|gather\|distribute\|parry\|punch\|smother\|1v1` |

**Family fallback table:**
- shot-like → `shoot`
- pass-like → `pass`
- kick-like → `kick`
- contact-like → `stumble`
- ground → `down`
- locomotion while moving
- otherwise the last action pose, never idle while moving

**Optional Body fields, read defensively:** `kickFoot`, `diveHeight`, `touchAt`, `passKind`, `shotKind`, `slide`, `skill`, `contactAt`, `windowMs` (dead-ball length).

**Events.** Contact events come from engine fields; rendering never moves them.

### 6.2 Ownership splits proposed (lead to confirm)

- **Players own:** body poses and clip selection, act names and the fallback, celebration body motion, crowd palettes and reaction frames (`crowd.ts`), and portraits.
- **Sport teams own:** timing windows, confetti (including soccer J-3 in the `soccer2/render.ts` celebrate branch ≈458/476), skip input, banners, slow-mo application, camera, floor/field/pitch and stands geometry. They also own the sack, hurdle and slide *events* and their banners.
  - The NFL sack is split: nfl owns the event and timing (STREAM-nfl C-2); players own the QB and sacker body animation.
- **`juice.ts`:** nba+nfl own it. Players add the ≈8-line cap and `ms` hunk. Soccer wires `Juice` in its J-2.
- **`card-face.ts`:** read-only for players. Proposal: the lead moves it to packs.
- **`persp.ts` / `court.ts` / `field.ts` / `pitch.ts`:** proposal: camera (`pcam`), floor textures (`drawFloor`, `courtTexture`, `fieldTexture`; NBA-29 caching, NFL yard-number LOD) and stands geometry go to the sport teams (persp+court nba, field nfl, pitch soccer). Players keep only one-line `crowd.ts` calls.
- **`vite.config.ts` (shell):** add soccer appearance to the on-demand regex. The diff:
  `const onDemandModule = /[\\/](?:game[\\/]soccer2[\\/]|game[\\/]pixel[\\/]pitch\.ts|data[\\/](?:cards-(?:nba|nfl|soccer)|soccer)\.json|data[\\/]appearance[\\/]soccer\.json)/;`

### 6.3 HUD contract (players-8)

| API | What it does |
|---|---|
| `drawnOffset(who) → {dx, dy}` | screen px, ≤5% of body height |
| `headTop(who) → {x, y}` | anchor above the head |
| `handAnchor(who, 'L'\|'R') → {x, y}` | for ball-in-hand draws: snap, handoff, dribble |
| `pin(who)` | forces a fresh sprite this frame (rings, tags) |
| `resetMotion()` | call at replay start and SIM jumps |
| `drawNameTag(ctx, { name, num, kit, x, y, px })` | the name plate |

**Name tags** (research §3.9: 1.5 s over a new ball handler, with a keep-on setting; NBA-26 names on target markers; NFL V-2 bigger carrier chip and "TACKLED BY <name>") are in no nba or nfl brief. **Request:** the lead assigns the ≈3-line calls to nba and nfl; soccer already has a name-tag item. If unassigned at integration, the lead wires them.

### 6.4 PlayerPortrait contract (players-6)

`<PlayerPortrait sport pid season c1 c2 num pos ht wt size variant="bust"|"cheer"|"locked"|"dim" />`. It is main-bundle safe, shows a fallback until drawn, and is cached.

| Team | Uses |
|---|---|
| ut | Collection (M12, with `UtCard mode`), MOTM (M3), Hub tiles |
| nba | player of the game (NBA-10); the NBA-26 tip-off roster intro, which is in no brief: **request the lead to assign it or defer it** |
| nfl | player of the game (F-2) |
| soccer | result screen |
| shell | the M9 arena loading card |
| packs | reveal (`cheer`) |

### 6.5 Walkout agreement with packs (agree before building)

| Packs' cinema level | Walkout |
|---|---|
| L1, best card under 80, ≈1.2 s | none |
| L2, 80–84, ≈2.6 s | no walkout figure, the `cheer` bust only (an 82 Standout gets no full walkout) |
| L3, 85+ or any promo, ≈4.2 s | `WalkoutFigure` for ≤2.0 s inside the sequence |

- Multiple walkouts play one after another, each ≤2.0 s.
- The figure shows no text, so a program walkout never says "PROGRAM"; the text is packs'.
- Props: `{ rc, size, maxMs, onDone, reduced }`. Reduced motion shows a static bust for 600 ms.
- The build is players-9 stretch, otherwise phase 2. Until then packs uses `PlayerPortrait variant="cheer"`.

### 6.6 `impactOf` call sites (wiring is a hand-off, not counted done until seen at merge)

- **nba:** `Hoops2.tsx:230-248` (`J.hitStop('green'|'dunk'|'posterize'|'block', now)`) → `J.hitStop(kind, now, impactOf(kind, …).stopMs)`, plus `slowMo` where they already slow time.
- **nfl:** `Football2.tsx:361-377` (`truck`, `bighit`, `int`), and the same.
- **soccer:** at its new J-2 call sites (goal, big save, woodwork, power strike).

### 6.7 Readiness

Shell and the sport teams add `await pixelReady(sport)` to the match loading gate (M9): one line. Players also starts it at module load.

### 6.8 Reports (players does not edit these files)

- **Brand-like names.** CardDetail shows 2K badge names verbatim through `abilityName`/`ABILITY_HELP` (`hoops2/ratings.ts:200-207`: Posterizer, Limitless Range, Deadeye, Clamps, Ankle Breaker, Dimer) and `rate.ts:114` (Heat Check). These are owned by nba/packs. Owner decision 1 protects mode names only, so the lead decides.
- **L-5:** missing NFL (26%) and soccer (7.7%) jersey numbers. These are data files for the lead.
- The NFL squad OL row already overlaps at 320 (ut).

## 7. Deferred / phase 2, with reasons

- **Tier B curation** (≈1,000 per sport) and anything short of players-7's target line, listed by pid. Accuracy over count; neutral defaults cover them.
- **User look overrides (`looks.user`).** That would be new saved state, and nothing asks for it.
- **L-5 jersey-number backfill.** The lead's data files (§6.8).
- **L-6:** NBA/NFL era uniform detail (the sport teams' kit data); soccer kit patterns if players-5 stretch is not reached.
- **A-6:** non-player figures (referees, coaches, bench) and 2× labels. Placement belongs to the sport teams; `drawBody`/`matchLook` are available.
- **Ball-side visuals** (incompletion bounce, rim-outs, trails). Sport teams. NBA-24's velocity ramps would need a protocol bump.
- **Acts with no engine source yet:** NBA post-up/back-down, putback/tip-in, loose-ball dive, foul/charge reactions, inbound; NFL carry-out fake, pitch, pump fake. Names are reserved (§6.1). They are animated once an engine emits them.
- **players-9 stretch items not reached,** each by name: R12 variants, the NBA layup family and crossover variants, box-out; NFL catch variants, toe-tap, swat, drop, pile, throw on the run; soccer first touch, chip/volley, parry/punch/tip-over, smother; new CMU trials; `WalkoutFigure`.
- **The full ≈40-clip studio set, motion matching and physics reactions.** This needs more licence-clear capture than CMU offers.
- **P-1 to P-5 loading performance** (UT parse, offline, splash). Shell. We supply `pixelReady`, clip bundles and portrait cost.
- **A sprite atlas or pooled canvases.** Only if players-2's area cap shows pressure.
- **H7 attribute generation.** Packs. Faces show true values (§5 players-3).
- **Greying hair with age for defaults, and a sepia Legend frame.** Needs birth years; optional.

## 8. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| Blend sprites thrash the cache (per-player keys; ≈66 extra draws at an NFL snap) | Separate ≤96-entry blend LRU, blends skipped under 24 px, a blend that can't afford a draw becomes a cut, targets on stale/hit-rate/share after a snap (players-8) |
| iOS clamps `performance.now()` to 1 ms; no `requestIdleCallback` | EWMA per-draw cost from frame totals, count fallback [3, 14], a test with a 1 ms-quantised clock, pre-warm from leftover budget only (players-2) |
| Mid-match swaps (looks or clips arriving after frame 1) | Per-sport clip bundles, `pixelReady` started at module load and awaited in the loading gate, no bulk dispose, stale-by-version redraw through the budget (players-4) |
| Determinism (render code touching `b`) | The import graph plus a per-step seeded state hash with selection, anchoring and modifiers running every step; mirroring moves only the drawn ball (players-5/8/9) |
| Protocol (overalls, `pool.print`, hit-stop) | No edits to `card-face.ts`/`rate.ts`; the cap only shortens; the Arcade rival-score and timer check is recorded (players-8) |
| File collisions (render.ts hunks in five tasks; scene files; `juice.ts`; celebrate/confetti; sack) | Selection extracted in players-2; later hunks one line each in a ledger with line anchors; rulings and splits in §6.2 |
| Card CSS and QA depending on card internals | Class-existence and `aria-label` static test, outer-box invariance at every width, no DOM nesting change of the outer `.utc` (players-3/6) |
| Bundle and performance (new modules in shared chunks; UT first open already 7.4–9.0 s at 4×) | §2 budgets, static import checks per task, UT first-open ≤+5% (players-6), the build measurement and artifact check (players-10) |
| iOS canvas memory (raised caps, 16 facings, blends, crowd frames, portraits) | One 6 Mpx area cap per match, portrait byte cap and blobs not dataURLs, the owner background-survival check |
| Likeness guardrail (skin from memory = prohibited inference) | Photo-sourced skin with `skinSrc`, else neutral; second review; owner check; never Tier B skin by heuristic |
| Era accuracy (decade cells) | The player's own seasons inside the cell; base look when an override straddles (players-4) |
| Branding (`referenceNote` regex too narrow; promo frames; badges; celebrations) | Extended regex; original frame names and motifs; shape+colour+abbreviation badges; generic celebration ids |
| iPhone layout (CardDetail growth; missing viewports; 320 head sizes) | Tile visibility above the bar top at 393×852 and 320×568; 375×667 and 844×390 in the harness; targets in design px |
| Reduced motion (no app setting; canvases don't get it) | `reducedMotion()` in every canvas module; `reducedMotion: 'reduce'` runs for cards and all three matches |
| Test reliability (timing on a shared machine; sport-specific tests) | Report-only or 3× margins; `describe.skipIf` on `PS_SPORT` |
| Browser coverage (Chromium only) | Foil/frames, pixelated upscaling and memory are owner device checks |
| Game length (render-only moments outliving dead balls) | Cut at the next possession, snap or attack; 0 s added; tested (players-6/8) |
| Saves | No saved state; the gallery is lazy, unlinked and storage-free; `aria-label` unchanged |
| The CMU mirror, Transfermarkt or Commons is unreachable | Keyed poses, curated feet only, neutral skin, recorded in the team doc |

## 9. Critique response ledger

Every point from the critique, with where it is handled. "Rejected" and "partial" say why.

### Missing (M)

| # | Point | Decision |
|---|---|---|
| M1 | Research §4.3 rules (R2, R6, R7, R8, R9, R10, R12, R13, head bob) | Accepted. players-8: R2 holds, R6 lean and brake, R7, R9, R10 secondary and look-at, R13, head bob. players-9: R8 smears (must), R12 gating (stretch) |
| M2 | R5 turns; defenders face the ball while retreating | Accepted. players-8: plant at 45–120°, 2–3 shuffles above 120°, 1-f head lead, facing override with backpedal/shuffle |
| M3 | NBA §7 "missing entirely", layup variants | Partial. players-9 must: hesitation (`cut`), screen pose, fade and hook (DNA). Stretch: layup family, behind-the-back/between-legs, box-out. Post-up, putback, loose-ball dive, foul/charge, inbound need engine acts: names reserved (§6.1), deferred (§7) |
| M4 | Acts the sport teams are adding now | Accepted. Contract and intake published in players-1 (§6.1); family fallback in players-2; registered acts are players-9 must |
| M5 | NFL A-1 gaps and research §4.5 | Partial. Must: snap/handoff exchange plus `handAnchor`, FG holder, wrap-up, sack (players-9); 3/5/7-step drop (players-8); team TD run-in (players-6). Stretch: dive/over-the-shoulder catches, toe-tap, swat, drop, pile, throw on the run. Carry-out fake, pitch, pump fake reserved |
| M6 | Soccer A-1 gaps, unused loads | Partial. Must: keeper split-step and side-shuffle, gather and distribute, inside-foot vs laces, poke tackle, throw-in, `fall_back` used, unused clips dropped (players-9). Stretch: first touch, chip/volley, parry/punch/tip-over, smother. Corners and goal kicks via intake |
| M7 | Research §4.8 juice table, R11 lie times, flash bulbs, spot-aware celebrations, library items | Accepted. Full table and lie times (players-8); flash bulbs (players-9); 12-item library with jump-spin, shrug, huddle, gated backflip (players-6); spot-aware is players-6 stretch |
| M8 | Default gear and handedness priors; narrow hair distributions | Accepted for gear priors and research's hair distributions (players-4). **Rejected:** random 10% lefty, random 75/20/5 foot, and "other natural 5%" hair tone. Expected accuracy drops (0.9→0.82, 0.75→0.60) and they are salient false cues. Headband, goggles and dyed stay curated-only |
| M9 | Tier A ranking ignores what players see most | Accepted. `--candidates` adds pack weight × circulation and cover-level current stars (players-4); coverage targets (players-7) |
| M10 | Mocap and look pop at match start | Accepted. Per-sport clip bundles, `pixelReady` at module load and in the loading gate, no constructor `loadAppearance`, 0 stand-in frames target (players-4) |
| M11 | No regression check for what works well | Accepted. `players-keep.mjs` (players-1), re-run in 2, 5, 6, 8, 9, 10 |
| M12 | Replays, pause, slow-mo, SIM | Accepted. Game-time clock, discontinuity reset, `resetMotion()` (players-8) |
| M13 | HUD alignment with anchored sprites | Accepted. `drawnOffset` capped at 5% of body height, `pin`, `headTop` (players-8, §6.3) |
| M14 | Name tags orphaned | Accepted. `drawNameTag` helper (players-8) and an explicit assignment request to the lead (§6.3) |
| M15 | NBA-26 roster intro, player-of-the-game screens | Accepted. PlayerPortrait contract to ut, nba, nfl, soccer, shell, packs; the roster intro is flagged for the lead to assign or defer (§6.4) |
| M16 | M12 whole-card locked/dim | Accepted. `UtCard mode` (players-3), bust silhouette (players-6) |
| M17 | H7 face display rule | Accepted, as a decision in players-3: true values in condensed numerals. "99+" rejected, with the reason given there |
| M18 | L4 truncations | Accepted. players-3 fixtures at w=44, 80, 170 |
| M19 | Card text below 76 px | Accepted. players-3 width table and the walk over every UtCard width |
| M20 | Draft busts get the wrong build | Accepted. `buildOf` reads the attrs chunks by cell id, and soccer `ht` (players-4) |
| M21 | A-5 interpolation deviation | Accepted. Recorded (§2, players-8 team doc) |
| M22 | Credits and lane | Accepted. Monk (players-4), Transfermarkt (players-7), CMU (players-8/9); `docs/CREDITS.md`, `scripts/build_mocap.py` and the mocap cache listed as touched outside lane (§2) |
| M23 | Retire the shared-skin policy comments | Accepted. players-5 |
| M24 | Brand-name hand-off (abilityName / ABILITY_HELP / Heat Check) | Accepted as a report (§6.8). Not our files |
| M25 | Owner decision 2: the controlled defender and HUD-tagged bodies in the must set | Accepted. players-2 must set and `pin()` |

### Restructure (S)

| # | Point | Decision |
|---|---|---|
| S1 | Split players-3 (curation) by sport | Partial. One task (now players-7) because of the 10-task cap, with three per-sport commits each ending in a contact sheet; 30 GOAT/Legend seeds per sport moved early (players-4); must and target lines separated |
| S2 | Split players-4 (drawing) | Partial. Extraction moved to players-2, so 4b's render.ts work disappears; 4a + 4b + crowd recolour are players-5 with four ordered commits; soccer patterns are stretch. Separate tasks rejected because of the cap |
| S3 | Split players-8 (actions) | Partial. 8c (impact and cap) moved to players-8; 8a + 8b are players-9 with must and stretch (new CMU trials are stretch, mirrors are must); the contract text moved to players-1 |
| S4 | The action contract comes too late | Accepted. §6 written now, published in players-1 |
| S5 | Add a post-integration verification task | Accepted in substance: `players-verify.mjs` (players-1), run on the production build (players-10) and on the merged tree by the lead. Not a separate branch task, because the merged tree exists only after the lead merges, and because of the cap |
| S6 | Reorder by owner value | Accepted. Card faces at players-3; busts at players-6; both before the animation core |
| S7 | Split players-1 | Accepted. players-1 is harness, baselines and contracts with no `src/` change; players-2 is the render core |
| S8 | Soccer precache conflict | Accepted. One-line diff for shell (§6.2), raised in players-1 before players-4 lands; verified in players-10 |
| S9 | `impactOf` hidden dependency | Accepted. Call sites agreed (§6.6); players-8 acceptance is the API, cap and tests; wiring is a named hand-off not counted as done |
| S10 | Frames depend on packs' parallel editions | Accepted. Data-driven from `TIER_NAMES` and `live-calendar.json` with a generic fallback and a loud test; the post-merge check covers 100% |
| S11 | CardDetail QA would show H1 | Accepted. Visibility judged against the bar's top edge, with no local patch (no risk of committing it) |
| S12 | Plan WalkoutFigure against packs' rules first | Accepted. Agreement in §6.5 (published in players-1); the build is players-9 stretch |
| S13 | players-10 has no buffer | Accepted. Card walk in players-3 (re-run in 6), match walk in players-9, players-10 opens with a fix-up step |
| S14 | `card-face.ts` ownership | Accepted. Read-only for players; move to packs requested (§6.2) |
| S15 | Ownership of persp/court/field/pitch | Accepted. Ruling requested; players' crowd work in `crowd.ts` via one-line calls |
| S16 | Owners for the cross-team overlaps | Accepted. §6.2 split: players own body poses and act names; sport teams own timing, confetti, skip and events |
| S17 | Selection in testable modules first | Accepted. Moved to players-2, earlier than asked, to shrink the conflict window too |

### Risks (K)

| # | Point | Decision |
|---|---|---|
| K1 | Blend cache thrash | Accepted, players-8 (§8) |
| K2 | iOS timing | Accepted, players-2 |
| K3 | Mid-match swaps | Accepted, players-4 |
| K4 | Determinism | Accepted. Per-step state-hash test in players-5, extended in 8 and 9 |
| K5 | Protocol | Accepted (§2; check in players-8) |
| K6 | File collisions | Accepted. players-2 extraction, hunk ledger, §6.2 |
| K7 | CSS and QA depending on card internals | Accepted. players-3 static test and box invariance |
| K8 | Bundle and performance | Accepted. §2 budgets, players-6 UT first open, players-10 build and artifact check |
| K9 | iOS canvas memory | Accepted. Area cap (players-2), portrait byte cap and blobs (players-6), owner check |
| K10 | Likeness guardrail | Accepted. Photo-sourced skin (§2, players-4/7) |
| K11 | Era accuracy | Accepted. `refOf` uses the player's seasons inside the cell (players-4) |
| K12 | Branding | Accepted. Extended regex (players-3), original frames and badges, generic celebration ids (players-6) |
| K13 | iPhone layout | Accepted. CardDetail check (players-3), viewports (players-1), design-px targets (§3) |
| K14 | Reduced motion | Accepted. `reducedMotion()` everywhere, Playwright `reduce` runs (players-3, 9, 10) |
| K15 | Test reliability | Accepted (§2) |
| K16 | Browser coverage | Accepted. Owner device checks 3, 4, 7 |
| K17 | Game length | Accepted (§2; players-6/8 tests) |
| K18 | Saves | Accepted (§2) |

### Targets (T)

| # | Target | Where it is measured |
|---|---|---|
| T1 | Curation accuracy | players-7 (+ seeds players-4, second review players-7/10) |
| T2 | Tier coverage | players-7: GOAT + Legend + top-60 is must; +50 most-pulled is the target, short-fall listed |
| T3 | Default looks | players-4 |
| T4 | Small-size likeness (24 px) | players-5, re-run players-7 |
| T5 | Pre-warm | players-2 |
| T6 | Blends under load | players-8 |
| T7 | Animation rate floor | players-8 |
| T8 | NFL foot sliding | players-1 baseline, players-8 ≤5% |
| T9 | Viewports | players-1 harness, used in 2, 5, 8, 9, 10 |
| T10 | Time discontinuities | players-8 |
| T11 | HUD alignment | players-8 |
| T12 | Cards below 76 px | players-3 |
| T13 | UtCard box invariance | players-3, re-checked players-6 |
| T14 | Head sizes in design px | players-6 |
| T15 | Bust recognisability | players-6, re-run players-7 |
| T16 | Frame distinctness | players-3, post-merge via `players-verify.mjs` |
| T17 | 3-digit values and long names | players-3 |
| T18 | CardDetail | players-3 |
| T19 | Portrait fill and UT first open | players-6 |
| T20 | Binder | players-6 |
| T21 | Bundle budgets | §2; players-10 |
| T22 | Canvas memory | players-2, 8, 9; portraits players-6 |
| T23 | Readiness | players-4 |
| T24 | Celebrations and get-ups | players-6, players-8 |
| T25 | Motion DNA visibility | players-9 |
| T26 | Holds and secondary motion | players-8 |
| T27 | Hit-stop table and cap | players-8 |
| T28 | Soccer feet | players-7 (coverage), players-9 (kick choice) |
