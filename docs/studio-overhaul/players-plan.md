# Team players: build plan (revision 3, Game Design V2)

Real-life likeness, "Broadcast Pixel" sprites, animation that looks real, and card faces. Branch `claude/studio-players`, worktree `/home/user/ps-s-players`, dev-server port 5214.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full for this revision:**
- `O/BRIEF.md` (owner request, hard constraints, owner decisions 2026-11-09, the V2 paragraph), `O/BUILD-RULES.md`, `O/OWNERSHIP.md` (with the 2026-11-16 V2 grants), `O/STREAM-players.md`, `CLAUDE.md`
- `O/design-v2/GAME-DESIGN-V2.md` (all of it; F.2 "players" is our add/change/cut list), `O/design-v2/research-engagement.md`, `O/DESIGN-V2-DECISIONS.md`
- `O/design-v2/mockups.html`, rendered with Playwright from `file://` and looked at: the HUD frames for all three sports, the 320×568 check, and the three "Broadcast Pixel" lineups (Curry, LeBron, Shaq, Iverson, Jokić, Rodman; Mahomes, Henry, Brady, a lineman; Messi, Haaland, Ronaldinho, Mbappé, a keeper) at match size and 4× zoom
- Revision 2 of this plan (commit `835fd70`) and its sources: the likeness/animation/perf audit, the likeness research, the UT UI audit and the sport audits' animation sections

## 0. What changed in revision 3

The owner said the art and players "don't look how they should" and the gameplay's "animations, movement" are bad. V2 answers both through this team, so the team moves up and its order changes. Every V2 F.2 "players" item is mapped to a task in §9.

| V2 F.2 players item | Where it lands now |
|---|---|
| 1. 5-head hero proportions, 1.5 px art pixel, native LOD, `#14121c` outline, 3-tone ramps; Shaq and Bol differ by ≥3 px torso at 34 px. **First priority** | players-2 (it was split across old players-4/5) |
| 2. Tier A adds every player in the first-run flow and each sport's starter pack | players-3 (seeds) and players-9 (coverage) |
| 3. Keep and protect the near-first sprite budget (A-1) | players-5, together with locomotion (F.4 slice item 7) |
| 4. Frame plans B.1.6 / B.2.6 / B.3.6 in the order: locomotion → NFL juke/throw/handoff/sack → soccer touch/shot/keeper/slide → NBA crossover/step-back/contest → celebrations; the five unused mocap clips first | players-5 (locomotion), players-6 (NFL, soccer), players-7 (NBA, celebrations) |
| 5. P1: crowd front rows as 4-frame sprites, bench and coach idles, the C.2 venue palette | palette in players-4 (it is in the F.4 slice as "calmer venues"); crowd rows, bench and coach in players-9 (V2's third wave) |
| 6. Card faces use the signature-pose pixel bust; frame silhouettes per C.4 | players-8 |
| 7. Cut: `PlayerPortrait` on secondary surfaces (binder and poster deferred); celebration variants beyond 4 per sport | applied (§8) |
| 8. Protocol: none; keep the import-graph test | `render-only.test.ts` (players-2, extended in 4–7, 9) |

### Revision 3.1 ledger: GAME-DESIGN-V2 revised at 13:09 (after this plan, 12:40)

V2 was revised after the owner called the first mock-ups "too simple and boring" and "too flat"; `mockups-v2.html` is now the visual target. An independent review of players-1 found the harness and this plan still on the superseded text. Changed in the players-1 fix:

| V2 change (13:09) | Was in this plan | Now |
|---|---|---|
| C.1.2: the flat size table is the **minimum** ("kept as a floor"); camera guides NBA handler ≈95 px, NFL QB ≈70, soccer carrier ≈75 at 393 | on-screen heights ±10% of 51/34 (S6 failed NBA for being 48% *over*) | S6 is a floor check (controlled ≥51 / ≥34, far ≥36 / ≥22.5 design px); the guides are reported beside it. No team is asked to shrink |
| C.6: perspective scaling "replaces the flat 1.5 px per art pixel rule"; C.5 rule 3 and lead decision 3 still say 1.5 | 1 art px = 1.5 design px (S1) | S1 gates whole device pixels only; the 1.5 half waits for the lead's ruling (team doc §5 request 7, `S1_RULING` in `players-verify.mjs`) |
| C.1.3: **five tones** per material, a **rim light** on every silhouette pixel with nothing above-left, contact shadows; C.7 #8 bar: ≥3 tones + a rim highlight | 3 tones (S3) | S3: edge `#14121c` 100%, 0 inner outline-colour px, ≥3 tones per main material and a rim highlight (≥90% of exposed pixels lit); five tones and contact shadows proved by `shading.test.ts` (players-4) |
| C.1.3: a **cast shadow** (the sprite's silhouette sheared away from the lights at 34–42% alpha) plus an occlusion ellipse | soft `rgba(0,0,0,0.32)` ellipse (S8, §6.4) | S8 adds `cast-shadow.test.ts` (players-4); `drawGroundMark` keeps its signature and gains the cast shadow there |
| C.2: crowd of head + shirt blocks (2 / 3 / 5–6 px by tier), shirts 40% home, 22% second colour, 12% white, 12% third, rest dark neutrals, six skin tones, shimmer and flashes; stands softer and foggier than the play | three dark value bands `#221d36/#342d52/#4a426e`, top-3 colours ≥90% (L6) | L6: grain ≤4%, stands softer and foggier than the sprites (edge and chroma ratios <1), a mixed crowd, a vignette; the C.2 shares exactly in `venue.test.ts`. "Venue ≥30% darker than the players" is reported, no longer gated |
| C.5 rule 4: the stands take about 30–40% of the height above the far boundary | crowd ≤12% of the screen (L7) | L7 inverted: stands 30–40% of the screen height (27–43% accepted), reported for the sport teams |
| BRIEF / C: the visual target is `mockups-v2.html`; `mockups.html` keeps only the control geometry | targets rendered from `mockups.html` | `players-targets.mjs` renders mockups-v2 (`target-v2-*.png`); the old captures are labelled "superseded: control geometry only" |

**The F.4 first-impression slice is built first:** players-2 to players-5 are exactly V2's slice items 6 ("5-head sprites, appearance data with Tier A for first-run and starter players, calmer venues") and 7 ("near-first sprite budget + locomotion without skating").

**Kept from revision 2:**
- every audit P0 fix V2 does not replace: A-1 stale near sprites, A-2 hard cuts, A-5 foot sliding, L-1 to L-4 likeness, H2/H3 card art, H6/M11 brand links leaving the app
- the guardrails, the render-only proof, the save rules, the contract-first approach, the must/stretch tiers and the carry-over rule
- revision 2's critique ledger (§9 of commit `835fd70`) still holds, except where this revision's ledger (§9) changes it

**Changed by V2 against revision 2:**
- `headScale` is V2's `clamp(1.55 − px/120, 1.2, 1.45)` on art px (was `clamp(1 + (32 − px)/64, 1, 1.25)`).
- The hair, hair-colour and facial-hair option lists follow V2 C.1.4, so artists and code agree.
- The crowd follows C.2 as revised at 13:09: head + shirt blocks by tier with the shirt shares and six skin tones (it was "three dark value bands" before the revision; see the 3.1 ledger above). This replaces STREAM's "recolour the crowd from the skin palettes".
- Celebrations are capped at 4 per sport with V2's lengths (NBA 0.8 s, NFL 1.2 s), not a 12-loop library.
- Name-chip drawing moves to nba's HUD kit (`src/game/hud/*`, V2 F.1 and C.5 rule 6). We keep the anchors (`headTop`, `feetAt`). `name-tag.ts` is dropped.
- Kits follow C.1.6 (`src/game/uniforms.ts` is ours): 3-tone ramps, an NFL helmet centre stripe, and an automatic away swap when the primaries are within ΔE 25.
- The walkout figure is now must work (players-7), because packs-9 uses our sprite and celebration (V2 F.2 packs #4).

## 1. Goals

1. **"So we know who is who."** Chunky, 5-heads-tall, hard-outlined pixel athletes on calmer, darker venues. Each is drawn from one typed appearance record, in all three engines, on UT and draft cards, in the walkout and in the match intro.
   - Tier A: every player in the first five minutes (first-run flow, starter pack), every GOAT and Legend, the top 60 by rating, then the 50 most-pulled golds.
   - Everyone else gets neutral, era-plausible defaults that never contradict a star's known look.
2. **Animation and movement that read like the respected games.**
   - The nearest players never freeze (A-1).
   - Feet stay planted and gait matches speed (A-5).
   - Clips blend instead of cutting, and contact frames lock to game time (A-2).
   - Every frame plan in V2 B.1.6, B.2.6 and B.3.6 is implemented, in V2's order.
   - Stars move like themselves (motion DNA, A-4).
3. **Cards that look like a production UT.** A signature-pose bust, a frame ladder with distinct *silhouettes*, readable type at every size, original badges, and a CardDetail that never leaves the app.
4. **Everything render-only.** No protocol bump. Proven by an import-graph walk and a per-step seeded state hash.

## 2. Constraints this plan is built around

### Lane

**Path-owned by players** (OWNERSHIP plus the V2 grant):
- `src/game/pixel/**`, `src/game/sprites.ts`, `src/game/uniforms.ts`, `src/data/mocap/**`
- New: `src/game/pixel/appearance*.ts`, `src/data/appearance/**`, `scripts/build_appearance*`
- Card faces: `src/ut/CardArt.tsx`, `card-editions.css`, `CardDetail.tsx`, `CardSerial.tsx`, `src/ui/Card.tsx`, `src/ui/Binder.tsx`, `src/ui/poster.ts`, and the `.utc*` / `.tc-*` / `.card*` face blocks in `styles.css`
- In the three `render.ts` files: the player-drawing sections only (look, pose and clip selection, blending, sprite caching, sprite blit)
- **V2 grant:** the venue *palette* in `src/game/pixel/persp.ts`, `court.ts`, `field.ts` and `pitch.ts` (colours, textures, lighting, crowd colour). Camera, floor geometry, horizon and stands geometry stay with the sport teams.

**Read-only for players:** `src/ut/card-face.ts` (ratings logic used by `rate.ts`; we only read `faceWeights`; revision 2's request to move it to packs stands).

**Strategy against merge conflicts.** players-2 moves the selection code (`lookFor`, `animOf`, `gait`, `poseOf`, `dunkStyle`/`spins360`) out of the three `render.ts` files into players-owned `src/game/pixel/select-{nba,nfl,soccer}.ts`, verbatim and proven identical. After that:
- Every later players change lands in players-owned modules.
- `render.ts` hunks shrink to thin calls, listed with line anchors in the team doc's "render.ts hunk ledger".
- We never reformat or reorder those files. The sport teams are changing cameras and HUDs in the same files at the same time (V2 B.1.3, B.2.3, B.3.3).

**New files claimed as players-owned:**
- `src/game/pixel/{select-nba,select-nfl,select-soccer,art-scale,proportions,raster,head,ground,venue,crowd,appearance,looks,bust,portrait,blend,locomotion,impact,motion-dna,modifiers,celebrate,sprite-budget}.ts`, `LooksGallery.tsx`
- `src/data/mocap/clips-{nba,nfl,soccer}.ts`, `src/data/appearance/{nba,nfl,soccer}.json`, `src/data/appearance/first-run.json`, `src/data/appearance/source/*.looks.json`
- `src/ui/PlayerPortrait.tsx`, `src/ut/WalkoutFigure.tsx`, `src/ut/card-frames.ts`, `src/ut/card-frames.css`, `src/ut/card-portrait.css`, `src/ut/TeamBadge.tsx`
- `scripts/qa/players-*.mjs|ts`, `scripts/build_appearance.ts`

**Outside our lane**, a few lines each, every one listed under "Touched outside my lane" in the team doc:
- `src/game/juice.ts` (nba+nfl): an ≈8-line hit-stop cap and an optional `ms` argument (players-6).
- The canvas backing-store line in `Hoops2.tsx`, `Football2.tsx` and `Soccer2.tsx` resize code (≈4 lines each), only if the art-pixel decision in players-2 picks a device-resolution backing. We announce it in the team doc first, and the sport teams may make the hunk themselves instead.
- `docs/CREDITS.md` (Monk Skin Tone CC BY 4.0, Transfermarkt CC0 feet data, CMU clips), `scripts/build_mocap.py` (mirrored and new clips).

`vite.config.ts` is shell's. We hand shell the one-line soccer-appearance on-demand diff (§6.9) and never edit it.

### Saves

- No storage key, card/edition/copy id or saved field changes. Appearance, kits, frames and venue tokens are shipped static data. Portrait and sprite caches live in memory only.
- `portraitUrl(line, pose)`, `lookOf(line)` and every existing `UtCard` prop keep their signatures. New `UtCard` props (`mode`, `finish`, `mastery`) are optional with today's behaviour as the default. The `aria-label` text is unchanged.
- `LooksGallery` (`?pixel=looks`) is lazy, unlinked in production and storage-free.

### Protocol

- Rendering reads engine state (`b.act`, `b.p.*`, positions, `p.end`, phases, the new V2 fields such as `touchAt`, `shotKind`, Heat) and never writes it. The engines never import pixel or appearance code.
- **Proportions are render-only.** The ×1.15 height spread, the head scale and the torso width change the drawn sprite only. Hit tests and HUD placement use the drawn anchors (§6.3), never `b.p.ht`.
- Left-handed mirroring moves only the *drawn* ball, never a sim spawn point.
- The hit-stop cap only ever *shortens* hit-stop (B.0.5's 150 ms per second). players-6 confirms that no online timer or rival-score race depends on hit-stop length.
- If any piece would change sim timing, stop and write "Protocol bump needed: <sport> draft/UT, because …". None is planned. V2 F.3 lists appearance, proportions, animation, venues, crowd and juice as "none".

### Game time and game length

- Every animation clock is game time (`Juice.gameTime`), never `performance.now()`. Hit-stop freezes blends, slow-mo slows them, pause stops them.
- A time discontinuity resets all motion state: replay rewind, SIM fast-forward, resume after pause, a **rematch re-seed with the arena still mounted** (nba's V2 D.1 work), or a sport team calling `resetMotion()`.
- Celebrations, run-ins, get-up lie times and walkouts are render-only. They fit inside the engine's dead-ball window and are cut at the next possession, snap or attack. They add **0 s** to a game (owner decision 3: 4–6 minute solo games).

### Bundle

- Appearance data loads per sport from lazy chunks (game and UT), never in first paint. Draft cards reach portrait code only through `import()`. `src/game/pixel/color.ts` is in the main bundle (via `Favorites.tsx`), so no palettes go there.
- `src/data/appearance/first-run.json` is a tiny id list (≤1 KB) and may be imported statically by ut/packs.
- Budgets: Football2/Hoops2 shared chunk ≤ +25 KB gzip; UltimateTeam chunk ≤ +12 KB gzip; main index ≤ +2 KB gzip; each appearance JSON ≤ 20 KB gzip; mocap additions ≤ 80 KB raw; install precache ≤ +60 KB with soccer appearance on demand; the soccer appearance glob guarded by `__SOCCER__`.

### Likeness guardrails (unchanged; V2 C.1.4 agrees)

- No race, ethnicity or nationality field; a key-whitelist test enforces it. No trait derived from name, nationality, birthplace, team or position. No classifiers, tattoos, logos or brand marks.
- **Skin tone comes only from a cited public photo, picked by eye against the 10 swatches.** `scripts/build_appearance.ts --photos` builds contact sheets of public Wikimedia Commons thumbnails into the git-ignored `.cache/`. The row records the Commons file title in `skinSrc`. No photo, a stage-lit photo or any doubt means skin is omitted (neutral). If the hosts are unreachable, every row keeps neutral skin and the team doc says "skin pending".
- **The mockup's per-player hexes are concept art, not data.** We never copy a skin hex from `mockups.html` for a named player.
- Hair, facial hair, gear and build come from widely known public appearance in that era. Uncertain fields stay default. Preferred foot from the CC0 Transfermarkt dataset is a recorded fact.
- Every curated row has `src` and `reviewed`; an independent second review is required (players-9 or players-10).

### Code rules

- `pick({ nba, nfl, soccer })` / `pickFor(sport, …)`, never a two-way ternary.
- Appearance defaults are seeded by pid hash, so every phone draws the same look. Rendering-only randomness is fine elsewhere.
- **Reduced motion.** Canvas renderers don't receive it, so every new canvas module calls `reducedMotion()` from `src/ui/motion.tsx` itself (crowd, celebrations, run-ins, walkout, bust `cheer`). Every new CSS animation has a `prefers-reduced-motion` rule. Reduced motion keeps colour and sound and drops movement (V2 C.3).
- Portraits, frames and walkouts are not tap targets. The 390 frame is kept, with no width media queries.
- **Deviation from STREAM A-5, recorded in the team doc.** STREAM says "interpolating 15 fps clips". Research R2 says never interpolate between cached frames (pixel joints shimmer). We sample clips natively at 30 fps for near, large and ball bodies instead, and blend only *between clips*. V2 B.1.6's rates (handler and defender 30 fps, others 15) agree.

### Machine and tests

- Every `tsc`, `vitest`, Playwright or long vite-node run goes through `bash O/heavy.sh`.
- Dev server: `nohup npx vite --port 5214 --strictPort > /tmp/ps-players-vite.log 2>&1 & echo $! > /tmp/ps-players-vite.pid`; stop with `kill $(cat /tmp/ps-players-vite.pid)`. Never `pkill -f` or `pgrep -f`.
- Every Playwright context aborts non-localhost requests (Google Fonts excepted), opens `?ns=inspect&relay=ws://localhost:7777`, and uses `scripts/qa/players-lib.mjs` (copied from `O/audit-scripts/utui/lib.mjs`). The route log is printed.
- Own checks at 393×852 (insets 59/34) and 320×568, `deviceScaleFactor: 1`. Match checks also at 844×390 landscape and 375×667. **Art-pixel checks also at `deviceScaleFactor: 3`** (players-2), because whole-device-pixel snapping can only be seen there. Reduced-motion runs use `reducedMotion: 'reduce'`.
- Only Chromium is installed; Safari-specific checks are owner device checks.
- Test commands: NBA `npx vitest run src/game/pixel …`; NFL `PS_SPORT=nfl npx vitest run …`; soccer `PS_SPORT=soccer npx vitest run soccer sport-branches` (soccer tests named `*-soccer.test.ts`). Sport-specific tests guard on `PS_SPORT` with `describe.skipIf`.
- Timing assertions in vitest are report-only or carry a 3× margin; hard timing targets are measured in Playwright.
- The full `npm test` and one `npm run build` happen only in players-10.

## 3. Baselines and targets

players-1 measures every baseline on this machine's dev server, so before and after use the same method. In-task fps comparisons are dev-vs-dev; players-10 repeats them on a production build.

**Units.** *Design px* = CSS px ÷ stage scale *k* (0.82 at 320, 1.0 at 393, 1.103 at 430). *Art px* = one pixel of the sprite grid. V2's 13:09 revision contradicts itself on the art pixel (C.6: the camera sets the size and replaces the 1.5 px rule; C.5 rule 3 and lead decision 3: 1.5 design px): pending the lead's ruling.

### 3.1 Broadcast Pixel sprites (V2 C.1)

| Area | Baseline | Target (task) |
|---|---|---|
| Art pixel | 1 art px = 1 canvas px = 1 CSS px (≈3 device px on a 3× phone) | an **integer** number of device px in every sprite; 0 sprites drawn at a non-integer device scale at DPR 1, 2 and 3 (players-2). 1 art px = 1.5 design px only if the lead rules for the flat rule (3.1 ledger) |
| Head proportion (heads tall) | to be measured in players-1 at 20/24/34/60 px | C.1.1 table ±0.25 heads: 4.5 at 16–20 art px, 5 at 22–26, 5.5 at 32–36, 6 at 56–72; head box with hair 5×5, 6×6, 7×8, 12×13 (±1 px) (players-2) |
| Outline and shading | per-material outline from `outlineOf`; light from above-front | 1 art px `#14121c` outer outline on 100% of silhouette edge pixels; inner separations use the shadow tone (0 black inner pixels); 3 tones per material (shadow L −22% hue −10° toward blue, highlight L +14%); light from the top-left; no dithering below 56 art px (players-2). **V2 13:09:** five tones per material (bright highlight, highlight, base, shadow, deep shadow), a rim light on every silhouette pixel with nothing above-left, contact shadows; the gate is C.7 #8: ≥3 tones per main material and a rim highlight (players-4, `shading.test.ts`) |
| Torso width by build | at 40 px: Curry 17, Giannis 19, Jokić 19, Shaq 20, Bol 20 | at 34 art px: lightest 8, heaviest 13; **Shaq − Bol ≥3** (V2), aiming at ≥4; BMI 31 vs 20 ≥25% wider; Jokić − Giannis ≥1 (players-2, re-run with real ht/wt in players-4) |
| Height spread | data height × camera scale | drawn height spread ×1.15 around the sport's mean height; sim height untouched (players-2) |
| On-screen heights (design px), set by the sport teams' cameras | sprite px p50/p10: NBA 64/44, NFL 28/22, soccer 32/20 (CSS px at 393) | **reported, not owned; floors (V2 13:09):** controlled ≥51 (NBA) / ≥34 (NFL, soccer), far ≥36 / ≥22.5 design px; camera guides NBA handler ≈95, NFL QB ≈70, soccer carrier ≈75 reported beside them. `players-verify.mjs` prints the row for the sport teams (players-1, re-run in 10 and post-merge) |
| LOD | one raster path, scaled grids | far players drawn at their own native art size, never scaled down from a big raster; hair collapses to 4 silhouettes below 24 art px; facial hair off below 20 except a full beard (players-2, players-4) |
| Ground marks | per-sport shadows | soft ellipse `rgba(0,0,0,0.32)` at 70% of shoulder width under every sprite (players-2); **V2 13:09:** a cast shadow (the sprite's silhouette sheared away from the lights at 34–42% alpha) plus a small occlusion ellipse at the feet; airborne bodies separate from it (players-4, `cast-shadow.test.ts`); `you` 2 px gold `#f6b93b`, `target` teal `#4fe3c1`, `pressure` red arc `#ff5d5d`, `rival` violet `#8b7cf6`; nothing else on the field uses those four colours (players-2 helper, §6.4) |

### 3.2 Likeness and venues

| Area | Baseline | Target (task) |
|---|---|---|
| Identity in one shared kit | one skin `#a8714f`; hashed hair and beards (bald Iverson, high-top Shaq, dark-haired Haaland, bearded Mbappé) | pairs differing by ≥8% of pixels at **24 art px**: ≥80% of the 66 NBA pairs, ≥75% of NFL and soccer pairs; ≥12% for all pairs at 34 art px; 100% at 60 (players-4, re-run in players-9) |
| Default looks | hashed headbands and beards | no single hair style above 40% within an era bucket; ≥5 silhouettes per bucket; 0 default rows with goggles, headband, dyed tone, blond or left hand (players-3) |
| Tier A coverage | 0 curated | **first-run must (players-3):** 100% of `first-run.json` pids (≥12 per sport) plus the 7 owner-named examples. **must (players-9):** 100% of GOAT + Legend (NBA 20+120, NFL 20+130, soccer 0+132) plus the top 60 by OVR. **target:** plus the 50 most-pulled golds, ≈170–200 per sport. 100% of rows carry `src` and `reviewed`; the second review finds ≤5% field errors |
| Numbers | gone below ≈26 px when turned; scrambled at 40 px | exact front-on from 28 design px; never scrambled (exact glyphs or hidden); 6×10 font at ≥60 art px (players-4) |
| Venue (C.2, revised 13:09) | floor grain louder than players; crowd a bright 1 px noise texture | surface grain ≤4% contrast; the stands softer and foggier than the play (neighbour contrast and chroma below the sprites'); crowd of head + shirt blocks 2 / 3 / 5–6 px by tier, shirts 40% home, 22% second colour, 12% white, 12% third, the rest dark neutrals, six skin tones, a quarter with arms up, each tier dimmer and foggier; shimmer and flashes; a vignette at the corners (players-4; exact shares in `venue.test.ts`). Venue vs sprite lightness is reported |
| Stands share of screen height (portrait) | stands 13–26% of the screen | C.5 rule 4: about 30–40% of the screen height above the far boundary (27–43% accepted): **reported for the sport teams**, who own the horizon (players-1, players-10) |
| Crowd reactions | static | front three rows stand, bounce or wave in 4-frame loops within 6–12 frames of a score, ON FIRE or Clutch, back within 1.5 s (players-9, stretch-1) |

### 3.3 Animation and engine render

| Area | Baseline | Target (task) |
|---|---|---|
| Stale body draws (players-1 rerun of the audit method, 393) | NFL **41.4%** overall; 24–31 px 39.5%, 32–47 px 57.5%, **48–71 px 82.5%**. NBA 4.4% (72+ px 9.9%, first 10 frames 26.8%). Soccer 1.9% | NFL ≥48 px **<2%**, 32–47 px <5%, overall <10%; NBA ≥48 px <2% and first 10 frames <5%; soccer ≤1% (players-5) |
| Pre-warm after snap, kickoff, inbound or rematch | first frames stale (NBA 26.8% in frames 0–9) | stale ≤1% for sprites ≥32 px in the first 30 frames, ≤2 extra pre-warm draws a frame (players-5) |
| Effective animation rate | NBA p50 9.6 fps, NFL 9.3, soccer 14.2; clips 15 fps, idles 10, <22 px 10; facings snap 45° | handler/carrier, his defender and the controlled body ≥28 fps (V2: 30); every other on-screen body ≥12 (V2: 15), none under 10 at 1×; ≤1 facing step per drawn frame (players-5) |
| In-match fps | NBA 390 4×: 54.8 fps / p99 33.4 ms; NBA 430 4×: 51.8 / 50; NFL 390 4×: 57.5 / 33.4; soccer 844×390 4×: 56.9 / p99 50 | 1× holds 60.0 at 393/430/320/375×667/844×390; 4× at or above baseline; frames over 20 ms no worse than +10% (players-2 art pixel, 5, 6, 7, 9, 10) |
| Canvas memory | heap flat 34–40 MB; sprite area not measured | total cached sprite area ≤6 Mpx (in art px) per match; peak measured with 22 NFL bodies at 4× over 60 s; heap within +10% over 40 s and across 3 rematches with the arena kept mounted (players-2, 5, 6) |
| Readiness | first frame 1,082 ms; clips at 1,218 ms in 15–26 chunks → stand-in poses pop | 0 frames with stand-in poses or default looks after frame 1; PLAY-to-first-frame ≤ +100 ms (players-3) |
| Foot sliding | NBA **29.1%** of on-ground frames; soccer **12.8%**; NFL to be measured (QB drop skates 6.5 yd on the idle clip) | NBA ≤8%, soccer ≤4%, NFL ≤5% plus 0 idle-while-moving QB frames; planted-foot drift ≤1 art px at 34 art px (players-5) |
| Time discontinuities | replays, pause, SIM, rematch never handled | 0 frames blend from the pre-jump pose; first resumed pose jump ≤20% of body height (players-5, players-6) |
| HUD alignment | anchoring would move sprites off the sim position | drawn offset ≤5% of body height; `drawnOffset`, `headTop`, `feetAt`, `handAnchor` exported (players-5) |
| Pose jump at hard cuts (share of body height) | kick→run 59.8%, jumper→ready 53.5%, run→kick 52.7%, sprint→stiff-arm 44.6%, run→crossover 44.1%, run→jumper 42.2%, sprint→juke 33.0%, run→dunk 32.4%, ready→contest 26.7%, ready→pass 22.4% | every listed cut ≤20% via 80–120 ms blends (V2 B.1.6) (players-6) |
| Frame plans (V2 B.1.6, B.2.6, B.3.6) | stick poses; the five recorded clips `dribble`, `crossover`, `cut`, `stiff_arm`, `getup_front` never played | every row's event frame lands on engine time at 30 fps (±0 f); keyed frame counts within ±1 f of the V2 table; control-return frames as listed (players-6 NFL and soccer, players-7 NBA) |
| Hit-stop and shake | fixed `HITSTOP` table, no cap | `impactOf` within ±10 ms of the V2/research table; ≤150 ms of hit-stop per rolling second; trauma by mass × closing speed; reduced motion ≤30 ms and 0 shake (players-6) |
| Celebrations | arms-up only; get-ups instant | ≤4 per sport; NBA 0.8 s, NFL 1.2 s, soccer 1.2 s; skippable by tap from 0.25 s; 0 frames remain when the next possession, snap or attack begins; 0 s added (players-7) |
| Motion DNA visibility | everyone identical; dunk style by id parity | set-point hand height differs ≥3 art px low vs high at 60 art px; QB slot 15°/35°/55° ±5°; run styles differ ≥4° in torso lean; lefties use the mirrored clip on 100% of releases (players-7 mirrors, players-9 DNA) |
| Soccer feet | hashed | ≥85% of soccer pids have a recorded foot; ≥95% of recorded left-footers' kicks use `kick_l` unless the ball is on the right (players-9) |

### 3.4 Cards

| Area | Baseline | Target (task) |
|---|---|---|
| Card art | back-turned mannequin, head ≈8 design px on the 80-px card, figure ≈52 px | front-facing signature-pose bust (head 26×28 art px at portrait detail, shoulders 44): head ≥24 design px at 80, ≥45 at 150/170, ≥57 at 190, ≥14 at 44, ≥11 at 34–40 (players-8) |
| Bust recognisability | every gold identical | 12 stars' busts in one shared kit on the 80-px card differ pairwise by ≥15% of pixels; `locked` silhouettes ≥10% (players-8) |
| Frame ladder (C.4) | every gold identical; promos share frames | each family has a distinct **silhouette**, not only colours: Bronze/Silver/Gold flat; Rare Gold bevel + sheen; Standout diagonal slash; Program pattern; Hot Season heat gradient; Legend carved stone-and-gold; Spotlight holo prism; GOAT full-bleed animated background. Frame masks of any two families differ (IoU <0.9) or carry a different motif; bronze/silver/gold metals ΔE ≥15; any two program frames ΔE ≥10 or a different motif; `frameOf` non-fallback for 100% of `TIER_NAMES` and live-calendar promos; 0 running CSS animations on cards w<120 (players-8) |
| Card anatomy and text | text 3–9 design px | OVR top-left ≥20 design px at 80 wide; position under it; name plate; three headline stats; edition mark; serial; era year chip. OVR and POS ≥10 design px on every `UtCard` w≥34; name ≥10 at w≥52; anything smaller aria-hidden; 0 overflow at 393 and 320 on every surface in the `players-cards.mjs` list (players-8) |
| 3-digit values and long names | walls of 110; ANTETOKOUNMPO, GILGEOUS-ALEXANDER, PEDRO REBOCHO, "Throw under pressure" truncated | OVR 100–110 fits the 80-px face at OVR ≥20 px; the four strings show without ellipsis at w=44, 80 and 170 (players-8) |
| Badges | contrast as low as 1.25:1 | ink ≥4.5:1 for every team (players-8) |
| CardDetail | "2K"/"Madden" link with `target=_blank` (`CardDetail.tsx:160-166`) | 0 `a[target]`; 0 matches of `/2K\|Madden\|FIFA\|EA ?(FC\|Sports)\|MUT\|FUT\|PES\|eFootball\|Konami/i`; first row of six stat tiles visible above the action bar's top edge at 393×852 (59/34) and 320×568; labels ≥11 design px (players-8) |
| UtCard box | — | outer box identical (±0.5 px) at every width in use (34–190); every `.utc-*` class used outside `CardArt.tsx` still exists; `aria-label` unchanged (players-8) |
| Portrait fill | portraits pumped 6 ms a frame | first visible row ≤300 ms at 1× and ≤900 ms at 4×; a 120-card fill ≤1.2 s / ≤3.5 s; no long task >50 ms; club-grid scroll p95 ≤17.5 ms at 1× and ≤34 ms at 4×; UT first open not regressed by more than 5%; portrait cache ≤6 MB per 300 (players-8) |
| Walkout figure | none | 56–72 art px, 6 heads tall, walks in and plays the player's celebration in ≤2.0 s; reduced motion shows a static bust for 600 ms (players-7) |

## 4. Shared V2 pieces: what players writes, what it consumes

V2 F.1 assigns no F.1 row to players. Section C gives players the art pieces every other team draws with. The contracts in §6 are the interface; this table is the map.

### 4.1 Players writes (other teams rely on these)

| Piece | File | Consumers | Task |
|---|---|---|---|
| Selection modules (look, clip, pose, gait) | `src/game/pixel/select-{nba,nfl,soccer}.ts` | the three `render.ts` files (thin calls) | players-2 |
| Art pixel and blit | `src/game/pixel/art-scale.ts` | the three renderers' player sections; the sport teams' canvas resize | players-2 |
| Proportions and LOD | `src/game/pixel/proportions.ts`, `rig.ts`, `body.ts` | every sprite, bust and walkout | players-2 |
| Ground marks | `src/game/pixel/ground.ts` | sport teams and nba's HUD kit (`you`, `target`, `pressure`, `rival` rings) | players-2 |
| Appearance record and lookup, readiness | `src/game/pixel/appearance.ts`, `looks.ts`, `src/data/appearance/*` | sport teams (loading gate), packs (walkout), ut (collection) | players-3 |
| First-run Tier A list | `src/data/appearance/first-run.json` | ut (first-run flow), packs (starter pack) | players-3 |
| Kits | `src/game/uniforms.ts` | the three engines | players-4 |
| Venue palette and crowd API | `src/game/pixel/venue.ts`, `crowd.ts` | sport teams' floor/pitch/field geometry; `excite()` called on score, ON FIRE, Clutch | players-4 (palette and a no-op `excite`), players-9 (reactions) |
| Sprite budget and HUD anchors | `src/game/pixel/sprite-budget.ts`; renderer methods `pin`, `drawnOffset`, `headTop`, `feetAt`, `handAnchor`, `resetMotion` | nba's HUD kit (`src/game/hud/*` name chips), `PerfectRing` placement, tap-to-pass hit tests, the One-More rematch path | players-5 |
| Action contract | §6.1 (act names, Body fields, intake) | nba, nfl, soccer engines | players-1 (published), players-6/7 (animated) |
| Impact table and hit-stop cap | `src/game/pixel/impact.ts`, the `juice.ts` hunk | nba, nfl, soccer juice call sites (V2 B.0.5) | players-6 |
| Celebrations and walkout | `src/game/pixel/celebrate.ts`, `src/ut/WalkoutFigure.tsx` | sport teams (dead-ball window, skip), packs-9 (walkout), nba (match intro) | players-7 |
| Card faces | `CardArt.tsx` (`UtCard` + `mode`, `finish`, `mastery`), `card-frames.ts`, `TeamBadge.tsx`, `PlayerPortrait.tsx` | ut (squad, collection, mastery, prestige, the Minutes 100-hour finish), packs (reveal), nba/nfl/soccer (player of the game) | players-8 |
| Motion DNA | `src/game/pixel/motion-dna.ts`, `modifiers.ts` | render only | players-9 |

### 4.2 Players consumes (written by other teams)

| Piece (V2 F.1) | Author | What we need from it | If it is not on our branch yet |
|---|---|---|---|
| Control geometry tokens and the action-safe box (`src/game/controls-geometry.css`) | nba (was shell) | nothing in code. Our measurement row checks that the controlled sprite and its ground ring sit inside the safe box, and reports to the sport team | report only |
| The gold ring (`src/game/perfect.ts`, `PerfectRing`) | nba | its ring is drawn around `feetAt(who)` with our `groundEllipse(who)` aspect, so it lines up with our ground mark; ring colours follow C.5 rule 5 | our anchors are ready first; they align at merge |
| Heat (`src/game/heat.ts`) | nba | `heat.level` (0–100) and `onFire` to drive `crowd.excite('onfire')` and the HEATING UP crowd lift. The ball trail and flames are the sport teams' | `excite()` is a no-op-safe call; the sport team wires it |
| Clutch staging (B.0.4) | each sport | a `clutch: boolean` on the frame's `fx`, so the front rows stand on makes in Clutch | defaults to false |
| HUD kit (`src/game/hud/*`): score bug, toast line, pause, name chips | nba | name chips call `headTop(who)`; pause and resume call `resetMotion()` only for pauses over 0.25 s (the clock reset covers the rest) | anchors exported regardless |
| Arena kept mounted through the result sheet (D.1) | nba (shared `Arcade.tsx`) | on rematch, the host calls `resetMotion()`; sprite caches are kept, so tip-off needs no warm-up; the 6 Mpx area cap holds across rematches | caches survive either way |
| New engine acts and fields (B.1.6, B.2.6, B.3.6) | nba, nfl, soccer | act names and Body fields per §6.1 | family fallback (players-2) |
| `firstRunShowcase` | ut (first-run flow, ut-7 starter chain) and packs (starter pack) | ≤12 card line ids per sport that a new player sees in the first five minutes | players-3 derives the list from today's code; post-merge verify checks 100% Tier A on the exported list |
| Mastery and prestige cosmetics (D.6, E.5) | ut | which copy UID shows which `finish`, the mastery star count, and per-pid in-match cosmetics (gold shoes, ground-ring colour) | props default to none |
| Daily Play scenarios (`src/game/*/daily-play.ts`) | each sport (P1) | the named star in each scenario | listed stars join players-9's batch if they exist by then |

## 5. Ordered tasks

### How the tasks are sized

Ten tasks, each one session. Large tasks have an ordered **must** tier and a **stretch** tier.

**Carry-over rule.** A must item not finished becomes the first step of the next task and is recorded in the team doc. A stretch item not reached goes to §8's phase-2 list by name; nothing is dropped silently. Act names for anything deferred stay reserved in the contract (§6.1), so an engine can emit them safely.

**Every task ends with:** its own tests via heavy.sh; screenshots it looked at; the keep-list probe where render code changed; an update to `docs/studio-overhaul/players.md` (including the render.ts hunk ledger and "Touched outside my lane"); a commit staged by explicit paths with a `Claude: ` message and the trailer; `git push -u origin claude/studio-players`.

---

### players-1 · P0 · Harness, baselines, V2 targets and contracts (no `src/` change) — *partly done, finish first*

**Done before the pause (uncommitted in the worktree):**
- 14 scripts in `scripts/qa/`: `players-lib.mjs` (+ `players-lib.test.ts`), `players-sprites.mjs`, `players-matchperf.mjs`, `players-readiness.mjs`, `players-lineup.mjs`, `players-strips.mjs`, `players-burst.mjs`, `players-cards.mjs`, `players-keep.mjs`, `players-verify.mjs`, `players-slide-{nba,nfl,soccer}.ts`
- In `O/shots/players/players-1/`: before lineups (3 sports), in-game frames at 393 (3 sports, 6 each), animation strips and per-frame golden sequences (3 sports), NBA and NFL bursts (48 frames each), the numbers sheet, `players-sprites-before.json` (the §3.3 stale and rate baselines) and the lineup and strips JSON

**Must, to finish**
1. **Re-run the soccer burst.** It stopped at frame 37 of 48 with "page closed" (`batch-errors.log`). Fix the cause (a navigation during capture) rather than retrying blindly.
2. **Run the remaining baselines:** `players-cards.mjs` (every `UtCard` width, 393 and 320, plus reduced motion), `players-matchperf.mjs` (5 viewports, 1× and 4×), `players-readiness.mjs`, `players-keep.mjs`, and the three slide classifiers (NFL foot sliding is new).
3. **Add the V2 measurements**, as rows in `players-lineup.mjs` and `players-verify.mjs`:
   - heads-tall and head-box size at 20/24/34/60 px (§3.1)
   - outline colour histogram and inner black pixels
   - on-screen sprite heights in design px per sport against C.1.2 (reported for the sport teams)
   - venue calm: surface grain contrast, venue-vs-sprite mean lightness, crowd share of screen height, distinct crowd colours
   - sprite device-pixel scale at DPR 1, 2 and 3 (integer or not)
4. **Save the visual target:** `O/shots/players/players-1/target-v2-*.png`, rendered from `mockups-v2.html` (the gameplay frames, the juice frames, the walkout and the cards), so every later "after" sheet is compared with the target and not only with "before". (The first capture, `target-mockups-*.png` from `mockups.html`, is kept, labelled "superseded: control geometry only".)
5. **`players-verify.mjs` runs end to end** against every §3 row and prints PASS/FAIL per row.
6. **Team doc `docs/studio-overhaul/players.md`:** all baselines; the §6 contracts copied in (V2 act names, anchors, ground marks, venue tokens, portrait, walkout, impact, readiness, first-run list); the requests to the lead (§6.9); the render.ts hunk ledger (empty); the A-5 deviation note.
7. Commit `scripts/qa/players-*` and `docs/studio-overhaul/players.md`, then push.

**Stretch.** None. This task must finish whole.

**Acceptance**
- Every script runs on the base commit and prints JSON; `players-lib.test.ts` passes.
- The §3 baselines are reproduced within ±10% of the audit's numbers where the audit measured them, or the difference is explained. (Already within range: NFL stale 41.4% vs the audit's 41.3%.)
- `players-verify.mjs` FAILs the rows expected to fail today and prints the new V2 rows.
- 0 non-localhost requests; the route log is printed.
- The team doc holds every contract in §6, and the lead has been told where to find them.

**Protocol impact.** None. **Save risk.** None.

---

### players-2 · P0 · F.4 slice · Broadcast Pixel sprite core: selection extraction, 5-head proportions, outline and ramps, the 1.5 px art pixel

**Why first after the harness.** V2 makes this the team's first priority, and every later sprite, bust and walkout is drawn through it. The extraction comes first inside the task because the sport teams are editing the same `render.ts` files for cameras and HUDs right now.

**Must, in order (four commits)**

1. **Extraction (behaviour-neutral).** Move `lookFor`, `animOf`, `gait`, `poseOf` and `dunkStyle`/`spins360` with their memo types into `src/game/pixel/select-{nba,nfl,soccer}.ts`. `render.ts` keeps thin calls and re-exports the old names (`soccer2/render.ts` `lookFor` is used by audit tooling; `hoops2/render.ts` exports `dunkStyle`/`spins360`).
   - **Golden check:** the players-1 strips sequence (`clip, frame, poseHash` per body per frame, seeded autoplay, three sports) is byte-identical; the slide classifiers import `select-*.ts` and reproduce players-1's numbers exactly.
   - **Safe fallback for unknown acts** (separate commit): an act the selection doesn't know maps through the family table (§6.1) to the nearest family pose, never `ready` while moving. This makes the sport teams' new V2 acts safe now.
2. **Proportions (`src/game/pixel/proportions.ts`, `rig.ts` `shapeOf`, `body.ts`).**
   - `headScale(artPx) = clamp(1.55 − artPx/120, 1.2, 1.45)` on the head capsule radius; limb radii ×1.15; bone lengths from data unchanged, so `legScale` and the mocap retarget hold.
   - `drawnHeight(sport, htIn) = mean + (htIn − mean) × 1.15`, using the sport's mean height.
   - Torso width from build: 8 art px (lightest) to 13 (heaviest) at 34 art px NBA size, scaled by art height, from BMI (`bulk = clamp(BMI/24.5, 0.72, 1.6)`). NFL pads add shoulder width by position. `style.ts` `heaviness`, the `widen` stride and `sprintLean` stay consistent (keep-list).
   - The C.1.1 table is the test: heads tall and head box per size band.
3. **Outline, ramps and LOD (`body.ts`, `color.ts` only for pure helpers, `raster.ts`).**
   - Move `Buf`, `buffer`, `put`, `capsule` and `ball` into `src/game/pixel/raster.ts` and add a pure `rasterBody(look, pose|joints, view, artPx)`; `drawBody` becomes `rasterBody` plus a canvas. A golden raster hash for 6 looks × 4 views guards the move *before* the style change lands.
   - Outer outline 1 art px `#14121c`; inner separations use the part's shadow tone.
   - Three tones per material: shadow L −22% with hue −10° toward blue, highlight L +14%; light from the top-left; no dithering below 56 art px.
   - A 1 px lit-side rim for dark skin on dark kits (the skin index arrives in players-3; the rule is wired here on the neutral tone).
   - Far players are rasterised at their own art size (LOD), never downscaled from a bigger raster.
   - `src/game/pixel/ground.ts`: `drawGroundMark(ctx, { x, y, shoulderPx, mark?: 'you'|'target'|'pressure'|'rival', color? })` and `groundEllipse(who)` (§6.4). Wired in the player sections for the shadow only; the coloured rings are the HUD owners' call.
   - Retire the "everyone shares one skin tone" policy comments (`sprites.ts:6-7`, `body.ts:591`).
4. **The 1.5 px art pixel (`src/game/pixel/art-scale.ts`).**
   - `artScale(canvas)` measures device px per canvas px at runtime (`rect.width × dpr / canvas.width`) and returns `{ backing, devPerArt, artPxFor(cssHeight) }`, where `devPerArt = max(2, round(1.5 × k × dpr))` device px. Sprites are rasterised at art size (smaller than today, so cheaper) and blitted at an **integer** device scale with smoothing off, snapped to whole device px.
   - **The decision, measured, with a fallback.** Whole device pixels need the canvas backing store at device resolution. We measure three options with `players-matchperf.mjs` at 4× CPU, DPR 3 emulation, in all three sports:
     - (A) backing = device px per CSS px (≈3 on iPhone)
     - (B) backing 2 with `devPerArt` 3
     - (C) today's 1 CSS px art pixel, keeping only the new proportions
   - We adopt the highest option that meets the §3.3 fps rows, record the numbers in the team doc, and list it as an owner device check. The backing line is the ≈4-line hunk in each sport's resize code (§2 "Outside our lane"), announced first.
   - The floor and HUD keep drawing in CSS px through one `setTransform(backing)`; only sprite blits use device px.
   - `quantPx` steps move to art px: 1 px steps ≤14, 2 px ≤30, 4 px ≤60, 6 px above.

**Stretch.** None: the art-pixel decision may land as option C with A/B recorded, which still meets the must line.

**Tests and acceptance**
- `select-golden.test.ts` and the slide classifiers: identical to players-1 after step 1.
- `proportions.test.ts`: heads tall per C.1.1 band ±0.25; head box ±1 px; at 34 art px Shaq (85 in / 325 lb) torso ≥12 and Bol (91 in / 200 lb) ≤9, **difference ≥3**; BMI 31 vs 20 ≥25% wider; drawn height spread ×1.15 ±0.02; bone lengths unchanged.
- `outline.test.ts`: 100% of silhouette edge pixels `#14121c`; 0 inner pixels `#14121c`; per material exactly 3 tones (plus outline and rim) below 56 art px; light-side highlight on the top-left of the torso.
- `art-scale.test.ts`: `devPerArt` integer for DPR 1/2/3 and k 0.82/1.0/1.103; every blit's device scale is an integer; `quantPx` monotone and idempotent.
- `render-only.test.ts` (new): the import graph from each sport's simulation modules (`engine`, `autopilot`, `game`, `drive`, `ratings`, `match`, `arcade`) never reaches `pixel/*` or `data/appearance`; a seeded NBA, NFL and soccer game hashes identical full engine state per step with and without the selection, proportion and art-scale code running on every body.
- Playwright at DPR 3: 0 sprites at a non-integer device scale (sampled pixel runs); `players-matchperf.mjs` meets §3.3 for the chosen option; `players-keep.mjs` passes.
- **Looked at:** `after-p2-lineup-{nba,nfl,soccer}.png` beside `target-mockups-lineup-*.png` and `before-lineup-*.png`; `after-p2-ingame-{sport}-393.png`; a DPR-3 close-up.

**Protocol impact.** None (render-only, proven). **Save risk.** None.

---

### players-3 · P0 · F.4 slice · Appearance model, data pipeline, readiness, and first-run Tier A

**Must**

1. **`src/game/pixel/appearance.ts`**, with V2 C.1.4's option lists:
   ```ts
   export const HAIR = ['bald','buzz','short','fade','hightop','afro','afro-big','cornrows','locs-short','locs-long','braids','ponytail','bun','mohawk','curly-top','flow','receding','band-bound'] as const; // 18, V2 C.1.4
   export const HAIR_TONE = ['black','dark-brown','brown','light-brown','auburn','ginger','blond','platinum','grey','red','blue','green','pink','purple','team'] as const; // 15, V2 hexes
   export const FACIAL = ['none','goatee','full','long','mustache','stubble','chinstrap','short'] as const; // V2's 5 + 3 = STREAM's ≥8
   export const HEAD = ['none','band','wrap','skullcap'] as const;
   export const EYES = ['none','goggles','visor-clear','visor-dark','visor-tint'] as const;
   export const ARM = ['none','sleeve','shooter','elbow','wrist','tape','long'] as const;
   export const LEG = ['none','kneepad','kneesleeve','brace','tights','calf'] as const;
   export const SOCKS = ['low','crew','high','over-knee'] as const;
   export const ACCENT = ['white','black','team1','team2','neon','gold','tone'] as const;
   export const BUILD = ['lean','avg','muscular','stocky','heavy'] as const;
   export interface Appearance { v: 1; skin?: number; skinSrc?: string; hair; hairTone; facial; head; headC?; eyes; armL; armR; armC?; legL; legR; legC?; socks; shoe; gloves?; towel?; mouthguard?; neckRoll?; helmetHair?: 'none'|'locs'|'flow'|'curly'; build?; hand: 'R'|'L'; foot?: 'R'|'L'|'B'; motion?: MotionDNA; src: 'curated'|'default' }
   export type LookEra = { from: number; to: number } & Partial<Omit<Appearance, 'v'|'src'>>;
   ```
   - **Palettes:** `SKIN_TONES`, the 10 Monk bases from V2 C.1.4 (`#f6ede4 … #292420`) with saturation +8–15% in-game and a generated ramp; `skinRamp(i) → [shadow, base, light, outline, rim]`; `NEUTRAL_SKIN = '#a8714f'` unchanged for uncurated players; `HAIR_TONES` with V2's 15 hexes (`'team'` resolves to kit c1). Credit Monk Skin Tone (Google, CC BY 4.0) in `docs/CREDITS.md`.
   - **LOD:** below 24 art px hair collapses to `none | cap | tall | long`; facial hair is off below 20 art px except `full`.
   - **One build formula, `buildOf(sport, ref, ctx) → { htIn, wt, bmi }`**, for match, cards, draft cards and the walkout. It reads the card line, else the install-cached `nba-attrs.json` / `nfl-attrs.json` (keyed `CELL:pid`), else soccer `ht`, else `weightFor(sport, htIn, null, pos)` (soccer BMI by position: GK 23.5, CB 23.6, FB 22.3, DM/CM 22.6, AM/W 22.0, ST 23.2).
   - **Defaults** (`defaultAppearance(sport, pid, season, pos)`, seeded per field): skin always neutral; hair by era bucket (revision 2's distribution table, with no style above 40%); hair tone black/dark-brown 85%, brown 15%; facial none 60%, stubble 15%, short 12%, goatee 7%, full 6%; the accepted non-signature gear priors; shoes by era. Curated-only, never defaulted: headbands, goggles, dyed tones, blond, left hand.
   - **Lookup and ids:** `appearanceFor(sport, pid, season?, ctx?)` resolves base, then era override, then defaults (memoised). `refOf(sport, engineId, ctx?)` parses every id form (draft `CHI-1990:jordami01`, UT `nba:season:…`, `holo~`, `evo~a+b~`, live `nba:live:…`, soccer `108830:2019:BAR`, and the reserve/depth/squad forms that return null). A draft cell uses the midpoint of the player's own seasons inside the cell.
   - `encodeAppearance` / `decodeAppearance`, shared with the build script.
2. **Data and build.** Compact `src/data/appearance/<sport>.json` (one base-36 char per field, era overrides, motion codes; ≈25–35 bytes per curated player). Source `src/data/appearance/source/<sport>.looks.json` holds names, `src`, `skinSrc` and `reviewed`, and is never imported by app code. `scripts/build_appearance.ts`: `--build`, `--check`, `--candidates <sport> [n]` (tier, top OVR, pack weight × circulation, edition count, newest-season top OVR by position, **and the first-run list**), `--find`, `--photos` (a generic User-Agent and no personal data), `--soccer-feet`.
3. **First-run list, `src/data/appearance/first-run.json`.** `{ nba: string[], nfl: string[], soccer: string[] }` of card pids. It is derived from today's code: the Welcome flow and first match (`src/ui/Welcome.tsx`, ut's first-run order), the starter pack's gold slot candidates (`packs.ts` `starterCards` → the gold bucket's most likely draws), and each sport's headline stars on Home. ≥12 per sport. ut and packs are asked (§6.8) to publish `firstRunShowcase(sport)` and, where the starter pack is random, to draw its featured gold and walkout from `first-run.json`; until they do, players-10 and post-merge verify check whatever list they export.
4. **Loader and readiness.** `loadAppearance(sport)` (one lazy chunk per sport, soccer guarded by `__SOCCER__`); per-sport clip bundles `src/data/mocap/clips-{nba,nfl,soccer}.ts` with `clipsFor(sport)` and `preloadClips(sport)` (≤2 requests instead of 15–26); `pixelReady(sport)` = clips + appearance, started at module evaluation of `select-<sport>.ts`. The renderer constructor's `loadAppearance` call goes. A late arrival marks looks stale by version and redraws only through the budget, never in bulk.
5. **`src/game/pixel/looks.ts`:** `matchLook(sport, ref, kit, { pos, ht, wt, gk, pads, cosmetic? })` and `cardLook(line)`, both returning the existing `Look` plus `app: Appearance`. `cosmetic` (`{ shoes?, ring? }`) is the reserved hook for ut's mastery and Minutes cosmetics.
6. **Seeds, curated now (the F.4 "Tier A for first-run and starter players"):** 100% of `first-run.json` (≥12 per sport), the 7 owner-named examples (Shaq bald late; Iverson cornrows, headband and arm sleeve; Kareem goggles; Rodman dyed by season; Haaland long blond; Mbappé short and clean-shaven; Brady), and the mockup's named archetypes (Curry, LeBron, Jokić, Mahomes, Henry, Messi, Ronaldinho). Skin through `--photos`, or omitted. ≈25–35 rows per sport.

**Stretch.** None.

**Tests and acceptance**
- `appearance.test.ts`: option counts (18/15/8) and V2 hexes; key whitelist (fails on `race`, `ethnicity`, `nation`, …); uncurated → `NEUTRAL_SKIN`; a defaults snapshot for 30 pids; **defaults diversity** over 2,000 pids per era bucket (no style >40%, ≥5 silhouettes, 0 goggles/headband/dyed/blond/left); gear priors within ±3 pp; era resolution including Rodman per cell; encode/decode round trip; `refOf` for every id form.
- `appearance-data.test.ts`: every pid exists in `cards-<sport>.json` with a matching name; eras inside card seasons; sync with `--build`; gzip ≤20 KB per sport; every curated `skin` has a `skinSrc`; **100% of `first-run.json` pids are curated** with `src` and `reviewed`.
- `appearance-soccer.test.ts`: `weightFor` by position; Messi's match weight equals his card weight; foot decoding.
- `build-of.test.ts`: the Shaq, Bol and Bogues draft cells return their attrs ht/wt.
- `readiness.test.ts`: `pixelReady` resolves clips and appearance; `clipsFor('nba')` covers every clip `select-nba.ts` can return.
- Static: no main-bundle file imports `appearance`, `looks` or `data/appearance` (except the tiny `first-run.json`).
- `players-readiness.mjs` at 1× and 4×, three sports: **0 stand-in-pose or default-look frames after frame 1**; PLAY-to-first-frame ≤ +100 ms vs players-1.
- **Looked at:** `readiness-{sport}-frame1.png`; the seed photo contact sheets `looks-src-*` (kept in `O/`, never committed).

**Protocol impact.** None. **Save risk.** None: static data.

**Other teams.** Shell and the sport teams: the `pixelReady` line in the loading gate (§6.7). ut and packs: `firstRunShowcase` and the starter-pack draw (§6.8).

---

### players-4 · P0 · F.4 slice · Looks drawn in all three engines, kits, and calmer venues

**Must, in order (four commits)**

1. **`src/game/pixel/head.ts`:** `paintHead(buf, ox, oy, head, hr, frame, look, detail, sec?)`.
   - The 18 hair recipes (the mockup's recipes are the visual reference: high-top block, afro ring, cornrows rows, locs and flow as trailing capsules, ponytail and bun knots, mohawk strip, curly top); the 8 facial masks; headband and wrap colours; goggles; mouthguard dot at ≥24 art px.
   - NFL: helmet with a centre stripe and blank sides, visor clear/dark/tint, under-helmet hair (`locs`, `flow`, `curly`) at the nape, towel and gloves.
   - Hair must change the head's outline by ≥1 art px on two sides (C.5 rule 2).
   - `sec` (hair lag) is reserved for secondary motion (players-7 stretch).
2. **`body.ts` gear and numbers:** the skin ramp and lit rim from appearance; sleeves (`sleeve`, `shooter`, `long`), wristbands and tape at ≥34 art px; knee pads/sleeves, tights, calf sleeves; socks height and shoe colour; soccer captain armband from match context.
   - **Numbers (L-5):** 3×5 below 34 art px, 4×7 from 34–59, a 6×10 at ≥60. The turned chest compresses gaps, never glyph columns. Hidden when `squeeze < 0.6`. The back number is kept.
3. **Wiring.** `select-{nba,nfl,soccer}.ts` `lookFor` becomes `matchLook(sport, refOf(...), kit, {...})` (NFL pads by position; soccer `buildOf` and keeper gloves). `ut/CardArt.tsx` `lookOf` becomes `cardLook(line)`, so today's card figures show real looks before players-8. Renderers stop calling `hairFor`/`beardFor` (still exported for the galleries).
4. **Kits (`src/game/uniforms.ts`, C.1.6):** original two-colour kits as jersey base + trim stripe + number with generated 3-tone ramps; NFL helmet centre stripe; an automatic away swap when the two primaries are within CIEDE2000 ΔE 25; the controlled team never loses the gold `you` ring colour to a kit.
5. **Calmer venues (`src/game/pixel/venue.ts`, C.2), the V2 grant.**
   - Tokens per sport: NBA planks `#c98f52`/`#bf8548` every 6 px with grain at 4%, lines `#f4ead8` 2 px, team paint and centre circle at 85% saturation, a 10 px apron in team dark, a vertical light pool +8% under the rim; NFL mow stripes `#2f8f46`/`#2a8240` every 5 yards, lines `#eaf5ea`, yard numbers at 60% opacity, end zones with the team *name* in block type; soccer mow stripes `#2e9a4a`/`#288a41` every 5.5 m, lines `#f2fff2` at 85%, ad boards with original word marks.
   - Lighting: a corner vignette, four soft light pools, depth (higher on screen darker and less saturated; the stands softer and foggier than the play).
   - Crowd (V2 C.2 as revised at 13:09): head + shirt blocks of 2 px (top tier), 3 px (middle) and 5–6 px (courtside); shirts 40% home, 22% second colour, 12% white, 12% third colour, the rest dark neutrals; six skin tones; a quarter with arms up; each tier dimmer and foggier than the one below; 25–60 shimmering pixels a frame and 8–26 flashes (render-only randomness; off under reduced motion). Replacing the 1 px noise in `persp.ts` `standsWall`, `court.ts` `drawCrowd`, `field.ts` `crowdBand` and `pitch.ts` touchline fans, through one-line calls into `venue.ts`/`crowd.ts`.
   - `crowd.excite(kind, t)` exists now as a safe no-op, so sport teams can wire it early; players-9 animates it.
   - Geometry, horizon, camera and line *positions* are untouched; only colour and texture change. Each hunk goes in the ledger.
6. **Gallery and render-only proof.** `LooksGallery.tsx` (`?pixel=looks`, lazy, unlinked in production, storage-free): every trait × 16/20/24/34/60 art px × 4 facings × 2 kits; a 10-tone × 8-kit contrast grid; the seeded stars per sport in their own kits and a shared kit; venue swatches. `render-only.test.ts` is extended with `matchLook` and the venue code in the per-step state hash.

**Stretch (L-6).** Soccer kit patterns (stripes, hoops, sash, halves) from `src/data/appearance/kits-soccer.json`; the mockup's Messi stripe is the reference.

**Tests and acceptance**
- `head.test.ts`: each of the 18 silhouettes changes the head outline by ≥1 art px on two sides vs `bald`; the collapse to 4 below 24 art px; facial off below 20 except `full`; NFL under-helmet hair visible at 23 art px.
- `numbers.test.ts`: 23/80/88/99/7/12 exact at 28 design px front-on; exact or hidden at 34/56/80 art px and facings 0.6–0.9; the 6×10 font at ≥60.
- `likeness.test.ts`: the §3.2 identity row at 24, 34 and 60 art px for NBA (12, 66 pairs), NFL (11) and soccer (11).
- `body-build.test.ts` re-run with real ht/wt via `buildOf`: Shaq − Bol ≥3 at 34 art px; Haaland vs Messi ≥2.
- `kits.test.ts`: every pair of franchises within ΔE 25 swaps to away; 0 kit primaries equal to the four ring colours.
- `venue.test.ts` (pixel statistics on rendered floor and stands canvases): grain contrast ≤4%; shirt shares within ±4 pp of 40/22/12/12 and the rest dark neutrals; six skin tones; block sizes 2 / 3 / 5–6 px by tier; each tier darker than the one below; a corner vignette.
- `shading.test.ts` (V2 C.1.3): five tones per main material at ≥34 art px; every silhouette pixel with nothing above-left in its material's bright highlight; a contact shadow below-right where a nearer limb overlaps a farther one; no dithering below 56 art px.
- `cast-shadow.test.ts`: the silhouette sheared `transform(s, 0, 0.62·s, 0.30·s, x, y)` at 34–42% alpha, anchored at the ground (an airborne pose separates from it), plus the occlusion ellipse; the ring colours unchanged.
- `players-screen.mjs`: the §3.2 venue row (L6) PASS in all three sports; `players-sprites.mjs` stale numbers no worse than players-1 (the budget is fixed next); `players-matchperf.mjs` at the players-2 numbers; `players-keep.mjs` passes.
- The gallery shows the 7 owner examples correct, checked by eye and recorded.
- **Looked at:** `after-p4-lineup-{nba,nfl,soccer}.png` beside `target-mockups-lineup-*` and `before-*`; `closeup-{sport}-*.png` at DPR 3; `ingame-{sport}-{393,320,844land}.png`; `venue-{sport}.png`; `gallery-looks.png`.

**Protocol impact.** None (`render-only.test.ts`). **Save risk.** None.

**Other teams.** nba, nfl, soccer: the venue hunks are colour-only, listed in the ledger with line anchors, and announced in the team doc before they land; they keep geometry, horizon and camera.

---

### players-5 · P0 · F.4 slice · Near-first sprite budget (A-1) and locomotion without skating (A-5)

**Must, in order**

1. **`src/game/pixel/sprite-budget.ts`** (pure; revision 2's design, now on art-size rasters):
   - `interface DrawReq { who; px; must; staleFor; near }`; `class SpriteBudget { begin(now, frameMs); order(reqs); allow(); spent(ms, draws); stale(who); pin(who) }`.
   - **Must set**, always fresh: the ball carrier or handler, the pass target, his nearest defender, **the body the human controls in any phase** (including the default solo defense of owner decision 2), and any body `pin()`ned this frame (HUD rings and chips). Then the order is `px + 24·staleFor`; anyone ≥32 px stale for 2 frames is forced.
   - A time budget robust to iOS timer clamping: an EWMA of per-draw cost from each frame's total, `clamp(floor(budgetMs / ewma), 3, 14)` draws, `budgetMs` 3.0 (2.0 after a frame over 20 ms).
   - **Pre-warm** from leftover budget only, ≤2 extra draws a frame, at snap, kickoff, inbound and **rematch**: the next gait frames of the 6 nearest bodies. No `requestIdleCallback`.
   - **Area-capped caches:** all caches in a match share a 6 Mpx art-px cap with LRU eviction, kept across rematches; count caps rise only if measured evictions cause misses.
   - Each `render.ts` `draw()` resolves sprites in priority order into a `Map<who, Sprite>`, then draws in the existing depth order. `this.budget = 4|5` becomes `this.budget.begin(...)`. A dev-only `?pixeldebug` counter (stand-in poses, default looks, blend draws, cache area) feeds the harness.
2. **Game-time clock and discontinuities** (shared by locomotion, blends and the crowd): every memo runs on `t`; `Δt < 0`, `Δt > 0.25 s` or `resetMotion()` resets blend memos, foot-anchor dampers, turn state and the crowd ripple.
3. **`src/game/pixel/locomotion.ts`** (pure, used by `select-*.ts`):
   - `pickGait(speed, clipSpeeds)` with the playback rate clamped to **0.8–1.25×**, keeping the `widen` heavy stride and `sprintLean`.
   - A new `walk` clip (a CMU walking trial via `scripts/build_mocap.py --inspect`, with `stepL`/`stepR` beats, using `MOCAP_CACHE=<worktree>/.cache/mocap/bvh`).
   - Remove the dead bands: NBA `run` below 2.5 ft/s showing `ready`; the static NBA `defend` pose at 1–3 ft/s (use `shuffle`/`backpedal` at matched rates); soccer `ready` while drifting 0.15–1 m/s (`walk`); the NBA backpedal rate cap.
   - **Stance-foot anchoring (R4):** the planted toe holds its screen anchor for the contact beat; the sim leads through a damper ≤0.5× the gait's own displacement a frame, re-anchors at each strike, decays to 0 airborne; capped at 5% of body height; the ball and hands take the same offset.
   - **Rates (V2 B.1.6, NBA-25):** step 1 (30 fps) for the handler or carrier, his defender, the controlled body and any sprite ≥34 art px; step 2 for the rest; NFL and soccer bodies under 22 art px move from step ≥3 to step 2 within the area cap.
   - **Turns (R5):** `turnToward(memo, target, dt)`, 80–120 ms per 90°; under 45° rotate through the facings; 45–120° a `cut` plant frame with a 1 px dip; over 120° 2–3 decel steps then the plant; a 1-frame head lead. Spins, dives and falls are exempt. 16 facings from 18 art px when the area cap allows.
   - **Defenders face the ball while retreating:** backpedal/shuffle at matched rates, for soccer defenders and the NBA/NFL defense phases (which are now played by default).
   - **NFL snap and drop (B.2.6):** snap catch 6 f, then a rate-matched `backpedal` facing downfield with 3/5/7-step drop footwork from the engine's drop depth (shotgun: 2–3 settle steps × 12 f), then `ready` once set. Never an idle clip while the QB moves.
   - **Lean (R6):** up to 12° into acceleration and 8° into turns; a 6° brake lean-back for 4–6 f; head bob −1, −1, +2 px per stride at 34 art px.
4. **HUD anchors**, exported from each renderer (§6.3): `drawnOffset(who)`, `headTop(who)`, `feetAt(who)`, `handAnchor(who, side)`, `groundEllipse(who)`, `pin(who)`, `resetMotion()`.

**Stretch.** None; any must item not reached carries over to players-6 first.

**Tests and acceptance**
- `sprite-budget.test.ts` (synthetic 22-body sequence): carrier, controlled defender and pinned bodies always fresh; no body ≥32 px stale more than 2 frames in a row under a 4-draw-equivalent budget; with a clock quantised to 1 ms the EWMA converges within 30 frames to the true per-draw cost ±20% and the count stays in [3, 14]; the area cap is never exceeded, including across 3 simulated rematches.
- `locomotion.test.ts`: rate within 0.8–1.25; planted toe drift ≤1 art px; drawn offset ≤5% of body height; turn classes; head lead 1 f; brake lean 6° for 4–6 f; head bob −1, −1, +2.
- `time.test.ts`: on replay rewind, pause/resume, SIM jump, rematch and hit-stop, 0 frames blend from the pre-jump pose; the first resumed pose jump ≤20% of body height.
- Slide classifiers (`PS_SPORT`-guarded, importing `select-*.ts`): NBA ≤8% (baseline 29.1%; 3 seeded games always, 24 with `PS_SLOW=1`); soccer ≤4% (12.8%); NFL ≤5% and 0 idle-clip frames while the QB moves over 1 yd/s.
- `players-sprites.mjs`: NFL stale ≥48 px <2%, 32–47 px <5%, overall <10%; NBA ≥48 px <2% and first-10-frames <5%; soccer ≤1%; pre-warm ≤1% for ≥32 px in the first 30 frames; effective fps ≥28 for handler/defender/controlled and ≥12 for every other body.
- `players-matchperf.mjs` at 5 viewports: 1× holds 60.0; 4× at or above players-1; peak sprite area ≤6 Mpx with 22 NFL bodies at 4× over 60 s; heap within +10% over 40 s and over 3 rematches.
- `render-only.test.ts` extended with the budget, anchoring and locomotion in the per-step hash. `players-keep.mjs` passes.
- **Looked at:** `after-a1-nfl-{393,844land}-{0..5}.png` (line and backfield close-up); `burst-{nba,nfl,soccer}-after-p5.png` at 0.25×; `turns-{sport}.png`; `qb-drop-{3,5,7}.png`.

**Protocol impact.** None: render order, cache, budget and sprite offsets only. **Save risk.** None.

**Other teams.** nba (HUD kit, PerfectRing, rematch path) gets the anchors and `resetMotion()`; shell gets the performance numbers.

---

### players-6 · P0 · Transitions core, impact, and the NFL and soccer frame plans (V2 B.2.6, B.3.6)

**Must, in V2's order**

1. **`src/game/pixel/blend.ts`:** `blendJoints(a, b, t)` (bone-direction slerp from the pelvis, target bone lengths); a transition memo blending **80–120 ms** on a clip or pose-family change, quantised to 3 steps; a separate ≤96-entry blend LRU skipped under 24 art px (a blend the budget can't afford becomes a cut and never makes a fresh pose stale).
   - **Contact lock (R1):** a blend never spans an event frame (`release`, `catch`, `contact`, `plant`, `impact`); contact reactions cut in at 0 frames; a player-initiated action changes the acting limb on its first frame.
   - **Key holds (R2)** by warping anticipation and recovery only; **squash and stretch (R7)**: takeoff +1 px, landing −1 to −2 px for 3–6 f; **overshoot (R9)** 1 px past rest for 1 frame; **control return (R13)** at each action's `controlAt`.
2. **`src/game/pixel/impact.ts`:** `impactOf(kind, { massA, massB, closing }, reduced) → { stopMs, trauma, kickPx, slowMo?, reaction: 'flinch'|'stumble'|'fall', lieMs }` with the V2/research table (green 40, block 60, dunk rim contact 70, posterizer 90–120 + 0.5× for 300 ms, ankle-breaker/PERFECT juke 50, wrap 33–40, BIG HIT 80–100, truck 90, int 50, spectacular catch 60 + 0.5× for 250 ms, power shot 33, goal 66, big save 50, woodwork 33). R11 reactions by mass × closing speed with minimum lie times 0.4 s light, 1.0 s heavy. `HitStopCap` ≤150 ms per rolling second. Reduced motion ≤30 ms, 0 trauma, no slow-mo. The ≈8-line `juice.ts` hunk makes `Juice.hitStop(kind, now, ms?)` honour the cap. Wiring at the call sites is a hand-off (§6.6), not counted as done until seen at merge.
3. **NFL (B.2.6), the five unused clips first:**
   - **Juke** with mocap `cut`/`cut_l` (not the basketball crossover): plant 0–6 f, lateral 2.0–2.5 yd over 6–14 f, recover 14–20 f, control at 12 f, dust puff at the plant.
   - **Throw** (mocap `throw`): cock 0–8 f, stride 8–14 f, **release at 18 f**, follow-through hold 10 f, arm smear at 17 f.
   - **Handoff exchange (new act `handoff`):** QB reach 8 f, mesh 4 f, RB tuck 6 f, the ball visibly changes hands through `handAnchor(who, side)`; the snap exchange likewise.
   - **Sack (new act `sack`):** wrap 6 f, both down 14 f, then the QB plays mocap `getup_front`.
   - **Stiff arm** (mocap `stiff_arm`): extend 6 f, hold 8–20 f, recoil 6 f; the tackler slides off with `stumble`.
   - **Wrap tackle** with a 15–30 f drag, and the **BIG HIT** (4 f launch, carrier `fall_back`).
4. **Soccer (B.3.6):**
   - **Dribble touch** on the stance-foot frame every 2 / 3–4 / 5–6 strides from the engine's `touchAt`; the ball visibly leaves and returns.
   - **Pass** by `kickFoot` with an inside-foot pose: plant 4 f, swing 4 f, **contact at 8 f**, follow 6 f.
   - **Shot:** run-up plant 6 f, backlift scaled by power 4–10 f, **contact locked to launch**, follow-through 12 f with a hop, a leg smear at contact −1.
   - **Keeper:** the set split-step 4 f before every shot; dives low/mid/high 14–18 f (the `dive` clip rolled about the forward axis, never a belly-flop), land and roll 12 f, a parry reaching **wide**, a catch-and-gather, then `getup`.
   - **Slide tackle** feet-first: drop 4 f, slide 14–20 f, get up 16 f, turf spray; **standing tackle**: lunge 6 f, contact, recover 8 f (miss 14 f).
5. **The act map** in `select-nfl.ts` and `select-soccer.ts` covers every act in today's unions plus every V2 act registered through the intake (§6.1) by the time this task starts. The family fallback stays for later ones.

**Stretch (each named in §8 if not reached):** NFL spin (8 facings × 2 f), truck (lower 6 f, drive 10 f), catch in stride and high-point, gang pile with stacked `fall` poses; soccer header (crouch 4 f, rise 10 f, neck snap at contact), volley, finesse and chip poses, trick moves (step-over 14 f, roulette 20 f, drag-back 16 f, control at 60%), shielding pose.

**Tests and acceptance**
- `transitions.test.ts` (importing `select-*.ts` and `rasterBody` joints) on §3.3's cut list: max joint displacement between consecutive displayed frames ≤20% of body height; event frames equal engine times at step 1; the acting limb differs on the first frame after a press; holds within ±1 f.
- `impact.test.ts`: the table ±10 ms; ≤150 ms/s under a burst; reduced motion ≤30 ms and 0 shake; lie times 0.4/1.0 s. The existing `juice.test.ts` passes (identical seeded results).
- `actions-nfl.test.ts` (`PS_SPORT=nfl`) and `actions-soccer.test.ts`: every union act, every intake act and an unknown act map without throwing and never to idle while moving; the juke uses `cut`; the throw releases at 18 f; the handoff ball is in a hand on every frame of the mesh; a keeper dive rolls the torso ≥60°; every pass and shot contact lands on engine time; each listed frame count within ±1 f of V2's table.
- `players-sprites.mjs`: blends under load: stale ≤2% for ≥48 px in the 20 frames after an NFL snap; blend sprites ≤10% of cache entries; hit rate ≥ players-5 −5 points. `players-matchperf.mjs` at the players-5 numbers. `render-only.test.ts` extended with blends and impact. `players-keep.mjs` passes (afterimage, On Fire flames, red tackler ring).
- **Looked at:** `anim-strips-after-p6.png` beside `before-anim-strips.png`; `nfl-exchange.png`, `nfl-sack.png`; `burst-soccer-keeper.png`; `soccer-touch.png`.

**Protocol impact.** None: pose choice, offsets and hit-stop length (the cap only shortens). **Save risk.** None.

**Other teams.** nfl: emits `handoff`, `sack`, the drop depth and the snap event (§6.1); soccer: `touchAt`, `kickFoot`, `shotKind`, `diveHeight`; nba+nfl approve the `juice.ts` hunk.

---

### players-7 · P1 · NBA frame plans (B.1.6), celebrations, mirrored clips and the walkout figure

**Must, in V2's order**

1. **NBA (B.1.6), the unused clips first.** The recorded jump shot stays untouched (it is the best animation in the game).
   - **Crossover** (mocap `crossover`/`crossover_l`): plant 0–5 f, ball crosses at 8 f, push-off 8–14 f, settle 14–20 f, control at 9 f, a smear on the ball hand at 7 f.
   - **Step-back** (new, not the reversed crossover): load 0–4 f, hop back 4–13 f, land 13–17 f, control at 13 f, 1 px squash.
   - **Contest and block**, split from the shared pose (mocap `jump`): crouch 4 f, rise 10 f, apex hold 3 f, swat 2 f with a smear.
   - **Dribble** (mocap `dribble`): 30 f period standing, 20 f sprinting, bounce beats synced to the ball phase.
   - **Catch** (mocap `catch`, `catch_run`): hands up 4 f, ball in 2 f, tuck 4 f; never relocates the player.
   - **Steal reach** 6 f out, 6 f back; a whiff leaves the defender flat for 12 f. **Rebound:** crouch 4 f, rise 12 f, secure 4 f, land 6 f with elbows out. **Pump fake:** ball up 0–6 f, hold 3 f, down 6 f. **Spin:** plant 0–4 f, back-to-defender at 9 f, exit 16 f, ball hidden 6–11. **Dunk family:** gather 14 f, flight 22–30 f, rim contact (hit-stop 70 ms), hang 8–20 f, drop 8 f; the windmill arm sweeps a full circle with 1–2 smear frames. **Ankle-breaker:** the defender plays `slip` for 0.8 s.
2. **Mirrored clips** through the load-time mechanism: `jumpshot_l`, `layup_l`, `throw_l`, `kick_l`. Lefties use them on 100% of releases. The renderer reports the shooting hand for the drawn ball only.
3. **`src/game/pixel/celebrate.ts`, ≤4 per sport (the V2 cut):**
   - NBA: 3 short (0.8 s) per position archetype from `point-sky`, `flex`, `chest-thump`, `arms-up`.
   - NFL: `spike`, `point-up`, `flex`, `team-mob`, 1.2 s each.
   - Soccer: `knee-slide`, `arms-wide`, `point`, `team-pile`, ≈1.2 s.
   - Generic ids only, no player-named ids, no trademarked gestures. `celebrationFor(who, ctx)` by archetype and context, or by Tier A `motion.celebrate`.
   - **Teammate run-ins:** teammates in range jog to the scorer (render-only offset, the jog clip, anchored feet) and high-five; the NFL TD mob in the end zone.
   - Played inside the dead-ball window, skippable by the sport team's tap from 0.25 s, cut at the next possession's first frame. Reduced motion: the key pose only, no run-in.
4. **`src/ut/WalkoutFigure.tsx`** (V2 C.4, packs-9): props `{ rc | ref, sizeArt: 56–72, maxMs ≤ 2000, onDone, reduced }`. The full 6-heads-tall sprite walks in (walk clip, anchored feet) and plays the player's celebration before the card flips. No text inside the figure (packs owns the copy). Reduced motion: a static bust for 600 ms. The same figure serves nba's match intro (§6.5).

**Stretch:** secondary motion (R10: hair, locs, ponytail and towel lag 1–2 f through `head.ts` `sec`; jersey flutter on alternate sprint frames; head look-at); the layup family (finger roll, reverse, euro-step shifting the second step ±2 ft); box-out lean.

**Tests and acceptance**
- `actions-nba.test.ts`: every NBA union act, every intake act and an unknown act map without throwing and never to idle while moving; the crossover uses the recorded clip with the ball crossing at 8 f; the step-back control frame is 13 f; the windmill hand angle sweeps ≥330°; each listed frame count within ±1 f; every contact event on engine time.
- `mocap.test.ts` passes with the mirrored clips; a lefty releases with the `_l` clip on 100% of releases in a seeded game.
- `celebrate.test.ts`: ≤4 ids per sport; lengths 0.8 s NBA and 1.2 s NFL/soccer ±0.05; skippable from 0.25 s; 0 frames remain at the next possession's first frame; reduced motion uses the key pose only.
- `walkout.test.ts` (node raster) and a Playwright reveal check with packs' sequence stubbed: completes in ≤2.0 s; the sprite is 56–72 art px and 6 heads tall ±0.25; reduced motion shows the static bust for 600 ms ±50; 0 text nodes inside the figure.
- `players-matchperf.mjs` at the players-5 numbers; `render-only.test.ts` extended with celebrations; `players-keep.mjs` passes (posterized and ankle-break reactions, posterizer slow-mo).
- **Looked at:** `anim-strips-after-p7-nba.png`; `celebrations-{sport}.png`; `teammates-runin-{sport}.png`; `walkout-{sport}.png`.

**Protocol impact.** None. **Save risk.** None.

**Other teams.** nba emits `stepback`, `pumpfake`, `steal`, `contest`, `ft`, the ankle-breaker trigger (§6.1); packs-9 uses `WalkoutFigure`; nba's match intro uses it too.

---

### players-8 · P1 · Card faces: signature-pose bust, the C.4 frame ladder, type at every size, CardDetail

**Why here.** V2 F.2 puts card faces after the frame plans (V2's second wave). The bust reuses `head.ts` (players-4) and the appearance data (players-3), and `cheer` reuses the celebration poses (players-7).

**Must**

1. **`src/game/pixel/bust.ts`:** `rasterBust(look, app, { size, pose, variant: 'bust'|'cheer'|'locked' })`, front-facing, head 26×28 art px and shoulders 44 at portrait detail; brows, eyes with a highlight at large sizes, nose shadow, mouth, ears; shared hair, facial hair and gear; kit neckline, shoulders and a chest number; NFL busts helmet-off. **Signature pose by position and motion DNA** (shooter at the set point, QB cocked to throw, striker mid-strike; a static "ready" pose until players-9's DNA lands). `locked` is the real silhouette in a dark tone with a rim light.
2. **`src/game/pixel/portrait.ts`** (byte-capped LRU ≤6 MB per 300, ≤400 entries; canvases or `toBlob` URLs, never main-thread `toDataURL`; keyed by `pid|season|c1|c2|num|variant|pose|size|appearanceVersion`; the existing 6 ms/frame pump moved here unchanged and ordered visible-first) and **`src/ui/PlayerPortrait.tsx`** (main-bundle safe via `import()`, a fallback until drawn). Kept surfaces per the V2 cut: **UT cards, the squad (through `UtCard`), the walkout, the match intro and player-of-the-game.** The binder and poster are deferred.
3. **`src/ut/card-frames.ts` + `card-frames.css`: the C.4 ladder, data-driven.** `frameOf(rc) → { id, family, colors, motif, foil: 'none'|'sheen'|'holo'|'prism', premium, fallback }`: Bronze/Silver/Gold flat; Rare Gold bevel + sheen; Standout diagonal slash; Program = the live-calendar accent × one of 8 original motifs by promo-id hash; Hot Season heat gradient; Legend carved stone-and-gold; Spotlight holo prism; GOAT full-bleed animated background (crown and laurel SVGs kept); holo and evo overlays kept. Unknown editions get a generic fallback with `fallback: true`, listed loudly by a test. Original names and designs only. Foil animates only on cards w≥120, and stops under `prefers-reduced-motion`.
4. **Anatomy and type by width (`CardArt.tsx`).** OVR top-left (≥20 design px at 80 wide), position under it, bust centre, name plate, three headline stats (highest role weight from `card-face.ts` `faceWeights`, read-only), edition mark, serial, era year chip. The width table: 34–43 OVR/POS ≥10, name aria-only; 44–51 adds a condensed surname ≥10 with a two-line fallback; 52–75 adds the name and year; 76–119 the 3-stat strip; ≥120 the full six. True 3-digit values (100–110) in a condensed tabular numeral; ANTETOKOUNMPO, GILGEOUS-ALEXANDER and PEDRO REBOCHO without ellipsis.
5. **`src/ut/TeamBadge.tsx`:** an original shape (NBA disc, NFL shield, soccer crest) split c1/c2 plus the abbreviation, ink chosen for ≥4.5:1 or outlined. No logo silhouettes.
6. **`ut/CardDetail.tsx` (H6, M11):** the benchmark `<a target="_blank">` and the "2K"/"Madden" text become a plain `referenceNote(rc)` line with brand tokens stripped; the card grows to 170 px with the bust; a profile row (height, weight, number, position, hand/foot, build); the six face stats as large tiles with bars, labels ≥11 design px. The sticky bar and its offset stay shell's.
7. **`UtCard` additive props:** `mode?: 'locked'|'dim'` (ut's Collection, M12, and V2 D.7 era pages); `finish?: 'mastery'|'prestige'|'hof'` and `mastery?: 0|1|2|3` (V2 D.6 and the E.5 100-hour reward; ut decides which copy UID shows what). One look each: a foil corner, a prestige edge, a hall-of-fame plate.
8. **Box and contract invariance:** `card-contract.test.ts` lists every `.utc-*` selector used outside `CardArt.tsx` (`content-ui.css`, `play-art.css`, `content.css`, `pack-cinema.css`, `pack-reveal.css`, `pull-tracker.css`, `styles.css`, `scripts/qa/circulation.mjs`, `scripts/qa/ut-content.mjs`) and asserts each still exists; it snapshots the `aria-label` builder for 10 fixture cards.

**Stretch:** the draft `TradingCard` (`src/ui/Card.tsx`) shows `PlayerPortrait` over the era pattern with `buildOf` (the `Jersey` stays the fallback); per-program motif tuning by eye.

**Tests and acceptance**
- `bust.test.ts`: deterministic; head bbox ≥55% of the grid width; eyes present front-on; Kareem's goggles, Iverson's cornrows and Haaland's blond visible; 12 stars in one shared kit differ pairwise by ≥15% of pixels, `locked` ≥10%; draw cost reported (3× margin vs 1.0 ms median).
- `card-frames.test.ts`: non-fallback for every `TIER_NAMES` tier and every live-calendar promo; frame-mask IoU <0.9 between families or a different motif; bronze/silver/gold ΔE ≥15; program frames ΔE ≥10 or a different motif; GOAT and Spotlight premium; badge ink ≥4.5:1 for every team; `referenceNote` never matches the brand regex and returns no URL.
- `card-contract.test.ts` passes.
- `players-cards.mjs` at 393 and 320 with a reduced-motion pass meets every §3.4 row: head sizes in design px; OVR/POS ≥10 at every w≥34; 0 overflow on club, detail, reveal, squad (44), SBC (44/72), Store (34/66), UT Draft (40), Hub (44/56), Evolutions (46/58), Match (54), PullTracker (44/70), Sets/Standouts (70/74); outer box ±0.5 px vs players-1 at every width; 0 running animations on w<120; CardDetail tiles above the bar top; 0 `a[target]`.
- **Fill under throttle:** first visible row ≤300 ms at 1× and ≤900 ms at 4×; a 120-card fill ≤1.2 s / ≤3.5 s; no long task >50 ms; scroll p95 ≤17.5 / ≤34 ms; UT first open not regressed by more than 5% (P-1 method); portrait memory ≤6 MB per 300.
- **Looked at:** `frames-sheet.png` (every family at 34/44/80/150/190); `cards-{nba,nfl,soccer}-{393,320}-{club,detail,reveal}.png`; `cards-widths-*.png`; `cards-locked-dim-finish.png`.

**Protocol impact.** None: display only, no ids, no edits to `card-face.ts` or `rate.ts`. **Save risk.** None: signatures and `aria-label` kept.

**Other teams.** packs: the reveal uses `frameOf` and `PlayerPortrait variant="cheer"`; ut: `mode`, `finish`, `mastery`; nba/nfl/soccer: player of the game.

---

### players-9 · P1 · Tier A to coverage, signature motion (motion DNA), and the living venue

**Must**

1. **Curation, NBA then NFL then soccer (three commits, each ending in a reviewed contact sheet).** `--candidates`; **must line:** 100% of GOAT and Legend plus the top 60 by OVR (deduplicated, on top of players-3's first-run set). **Target:** plus the 50 most-pulled golds and cover-level current stars, ≈170–200 per sport. Fields per §5 players-3, skin only from `--photos`, era overrides for every GOAT with 10+ seasons (Jordan, Kareem's goggles era, Shaq early and late, Rodman by season), handedness only where well known (Russell, Ginóbili, Harden, Mullin; Steve Young, Vick, Tua, Stabler; Messi, Robben, Salah, Maradona, Roberto Carlos, Bale). Every row has `src` and `reviewed: true`. Any Daily Play star the sport teams have named by then joins the batch.
2. **Soccer feet:** `players.csv.gz` once into `.cache/` from the CC0 transfermarkt-datasets mirror used by `scripts/soccer_sources.py`; `--soccer-feet` writes `source/soccer-feet.json`; a provenance line in `docs/CREDITS.md`. If the download is blocked, curated feet only, recorded.
3. **Motion DNA (`src/game/pixel/motion-dna.ts`, `modifiers.ts`), render-only (C.1.5).** Defaults by rule: shooters by 3PT and height; **dunk set by DNK/VRT, replacing the id-parity choice** (exported `dunkStyle`/`spins360` signatures kept); run style by AGI/STR/ACC/height; QB slot 50/35/15 by pid hash; kick foot from data. Curated `motion` (≥30 stars per sport: Kareem hook, Dirk one-leg fade, QB slots, signature celebration by generic id) overrides them. Modifiers: `shotForm` (set-point height, follow-through hold, fade lean, hook), `qbSlot` (15°/35°/55°), `runStyle` (lean, knee lift, arm carriage), `dribbleStyle`. **Release, throw and kick events stay exactly where the engine puts them.**
4. **Independent second review** of 100% of GOAT/Legend rows plus a random 20% of the rest, requested from the lead's reviewer; otherwise it is players-10's first step (a different session from the curator). Target ≤5% field errors; every error fixed and logged.

**Stretch, in V2's third-wave order (each named in §8 if not reached):**
1. **Crowd front three rows** as 4-frame sprites (seated, stand, bounce, wave) using the 10 skin tones and natural hair tones; `crowd.excite(kind, t)` on score, ON FIRE (from `heat.ts`) and Clutch, rippling in within 6–12 frames on game time and back within 1.5 s; 1-frame flash-bulb sparkles on dunks, TDs and goals; reset on discontinuity. Reduced motion: bob only, no sparkles, never the arms-up frame.
2. **Bench and coach** sprites (two bench players and one coach per team) and a referee in NBA and NFL, as static 4-frame idles drawn with `drawBody`; placement is the sport teams' (one call each).
3. R12 rating-gated action variants (1–2 per action for base cards, 3–4 for 85+/Tier A).

**Tests and acceptance**
- `appearance-data.test.ts` passes (pids, names, eras, sync, ≤20 KB gzip, `skinSrc` on every curated skin). A coverage report per sport: 100% of the must line; the count against the target; the short-fall listed by pid as the first phase-2 batch.
- The 7 owner examples render correctly; every 10+-season GOAT has its eras checked (a checklist in the doc); soccer foot coverage ≥85%.
- `likeness.test.ts` and `bust.test.ts` recognisability re-run with real data and still pass.
- `motion-dna.test.ts`: DNA on vs off gives identical release/throw/kick engine times; defaults deterministic; curated overrides apply; dunk style independent of id parity; bone lengths kept; visibility: set-point hand ≥3 art px low vs high at 60 art px, QB slot 15/35/55° ±5°, run-style torso lean ≥4° apart; recorded left-footers kick with `kick_l` on ≥95% of kicks unless the ball is on the right.
- Stretch 1, if built: `crowd.test.ts` (first standing band within 6–12 frames of `excite`, back within 1.5 s, reduced motion never selects arms-up, reset on discontinuity) and `players-matchperf.mjs` at the players-5 numbers with crowd frames on.
- `render-only.test.ts` extended with `motion-dna`, `modifiers` and `crowd`; `players-keep.mjs` passes.
- **Looked at:** `curated-{nba,nfl,soccer}-{24,34,60}.png`, `curated-busts-{sport}.png`, `shot-forms-nba.png`, `qb-slots.png`; if built, `crowd-react-{sport}-{0,6,12}.png`.

**Protocol impact.** None. If any DNA value would need sim timing, stop and record "Protocol bump needed". **Save risk.** None.

---

### players-10 · Release gate, verify runner and hand-over

1. **Fix-up first:** anything open from the card walk (players-8), the match walks (players-5 to 7) and carry-overs. The second curation review if no lead reviewer did it.
2. **Isolated match walk:** an autoplay match per sport at 393×852, 320×568 and 844×390 with a reduced-motion pass and a rematch with the arena kept mounted: 0 page errors, the keep-list, screenshots looked at.
3. `bash O/heavy.sh npm run typecheck`, then `bash O/heavy.sh npm test` (all three suites, once). Fix any failure.
4. `bash O/heavy.sh npm run build`, once, into a scratch `--outDir` (never commit `dist`). Then: `scripts/audit_startup.py` (NBA/NFL/soccer startup gzip ≤ +2 KB over base `acdf3e2`: 773/645/592 KB); chunk sizes against §2; a curated pid absent from `index-*.js`; the service worker precache list (soccer appearance on demand once shell's regex lands, else the interim cost recorded); `players-matchperf.mjs` on `vite preview` at 5 viewports, 1× and 4×, at DPR 1 and 3; `players-readiness.mjs` and UT first open on the production build. The artifact IIFE build only with the lead's OK; otherwise a static check that the soccer appearance glob is guarded.
5. **`players-verify.mjs`** on the production build: every §3 row PASS, or explained. The V2 rows the sport teams own (on-screen heights, crowd share, controlled sprite inside the safe box) are reported with numbers.
6. **Final before / after / target set:** lineups beside the mockup lineups, close-ups at DPR 3, in-game, cards at every width, strips, celebrations, walkout. Look at every image.
7. **Team doc final:** before/after for every §3 row; tests added; **"Protocol bump needed: none. Simulation code (`engine`, `autopilot`, `game`, `drive`, `ratings`, `match`, `arcade`) was untouched; `render-only.test.ts` proves it with an import-graph walk and a per-step seeded state hash."**; Touched outside my lane; the render.ts hunk ledger; every hand-off with its status (`impactOf` wiring, `pixelReady` gates, `firstRunShowcase`, the backing line: "not done until seen at merge"); the deviation note; owner device checks; phase-2 list.
8. **Post-merge verification (a lead step):** `node scripts/qa/players-verify.mjs` on the merged tree re-measures sprite heights under the sport teams' new cameras, A-1 stale %, LOD, act coverage, readiness, `frameOf` on merged editions and 100% Tier A on the exported first-run list. A FAIL names the row and opens a players fix session.
9. Push.

**Owner device checks** (in the team doc)
1. "Can you tell who is who?" at a glance: the NBA five, the NFL backfield, the soccer front three, in portrait and landscape.
2. **The 5-head proportions and the 1.5 px art pixel on a real iPhone** (V2 decision 3): crisp, even pixels, nothing blurred.
3. Calmer venues: do the players pop off the court, field and pitch?
4. Card readability on the phone at every size; frame and foil rendering in iOS Safari (mix-blend-mode, masks, `background-clip:text`, pixelated upscaling).
5. A 100+ card club scroll.
6. Animation: transitions, planted feet and turns in a real match; NFL near-player smoothness; the handoff and the sack; keeper dives.
7. Celebration, walkout and (if built) crowd timing; reduced motion on the device.
8. After a full match and two rematches, background the PWA and return: it must still be alive (canvas memory at the chosen backing).
9. Skin tones of curated stars look right. Report any wrong row; it is a one-line fix.

**Protocol impact.** None. **Save risk.** None.

## 6. Cross-team contracts v1 (published in players-1; other teams can rely on these)

### 6.1 Action contract and intake

**Today's acts** (all mapped by players-6/7; unknown acts fall back by family from players-2):
- **NBA:** `idle screen run dribble shoot layup dunk contact standdunk pass catch defend contest block cross stepback spin stumble fall land celebrate rebound`
- **NFL:** `stance run block throw catch carry juke spin stiff truck windup tackle down rush backpedal celebrate kick`
- **Soccer:** `idle run dribble kick tackle down dive catch header celebrate set wall`

**V2 acts, reserved now** so engines can emit them safely (family fallback until animated):

| Sport | Acts (V2 source) | Animated in |
|---|---|---|
| NBA (B.1.2, B.1.5, B.1.6) | `pumpfake`, `steal`, `ft` (set, dip, release, hold), `lob`, `euro`, `board` (= rebound), `ankle` (defender stumble → `slip`), `charge`, `foul`, `switch` (= run), `boxout`, `inbound` | players-7 (`pumpfake`, `steal`, `ankle`, `board`; `euro` and `boxout` stretch) |
| NFL (B.2.2, B.2.5, B.2.6) | `snap`, `drop`, `handoff`, `sack`, `slide` (QB), `throwaway`, `dive`, `truck` (with `charge` 0–1), `wrap`, `bighit`, `swat`, `pick`, `pile`, `hold` (FG holder), `catch:stride\|high\|toe` | players-5 (`snap`, `drop`), players-6 (`handoff`, `sack`, `wrap`, `bighit`; the rest stretch or phase 2) |
| Soccer (B.3.2, B.3.5, B.3.6) | `touch` (via `touchAt`), `shot:power\|finesse\|chip\|driven`, `header`, `volley`, `trick:stepover\|roulette\|dragback\|feint`, `tackle:stand\|slide`, `contain`/`jockey`, `shield`, `onetwo`, `keeper:set\|dive\|parry\|catch\|rush\|getup`, `throwin`, `corner`, `goalkick` | players-6 (`touch`, shots, `tackle:*`, `keeper:*`; tricks, header, volley stretch) |

**Optional Body fields, read defensively:** `kickFoot`, `diveHeight` (`'low'|'mid'|'high'`), `touchAt`, `passKind`, `shotKind`, `skill`, `contactAt`, `controlAt`, `windowMs` (dead-ball length), `charge`, `dropSteps` (3/5/7), `reach` (the reflex-save swipe, render reach only).

**Intake.** A sport team that adds an act adds a row to "Animation requests" in its own team doc (or tells the lead): the act name, which body, the start and end, the engine field holding the contact event time, and any Body fields. Players keeps the registry in `players.md`. Rows registered before players-6 (NFL, soccer) or players-7 (NBA) starts are must-tier there; later rows get the family fallback and are listed for phase 2.

**Family fallback table:** shot-like → `shoot`; pass-like → `pass`; kick-like → `kick`; contact-like → `stumble`; ground → `down`; locomotion while moving; otherwise the last action pose, never idle while moving.

**Please do not hand-key poses in `select-*.ts` or the `render.ts` player sections.** If a pose is urgent, send the request; players adds a placeholder within the task in progress. Contact events come from engine fields; rendering never moves them.

### 6.2 Ownership splits

- **Players own:** body poses and clip selection, act names and the fallback, celebration body motion, the walkout figure, sprite proportions and the art pixel, appearance, kits (`uniforms.ts`), ground marks, the venue *palette* (V2 grant), crowd colour and reaction frames, portraits and card faces.
- **Sport teams own:** timing windows, the dead-ball window, confetti, skip input, banners, the ball's own visuals (trail, flames, incompletion bounce, net bulge), slow-mo application, the camera and on-screen sprite sizes (C.1.2 targets), floor/field/pitch line geometry, the horizon and stands geometry, bench/coach/referee placement, and the events themselves (sack, handoff, touches, tricks). The NFL sack is split: nfl owns the event and timing; players own the QB and sacker bodies.
- **nba's HUD kit** (`src/game/hud/*`) owns the score bug, toast line, pause, Heat bar and **name chips** (C.5 rule 6); it reads our anchors.
- **`juice.ts`:** nba+nfl own it. Players add the ≈8-line cap and `ms` hunk.
- **`card-face.ts`:** read-only for players; the move to packs is still requested.

### 6.3 HUD and rematch contract (players-5)

| API (on each sport's renderer) | What it does |
|---|---|
| `drawnOffset(who) → {dx, dy}` | screen px, ≤5% of body height |
| `headTop(who) → {x, y}` | anchor above the drawn head (name chips) |
| `feetAt(who) → {x, y}` | the drawn feet (PerfectRing, ground marks, tap-to-pass) |
| `groundEllipse(who) → {rx, ry}` | the ellipse aspect at that depth, so rings drawn by others match ours |
| `handAnchor(who, 'L'\|'R') → {x, y}` | ball in hand: snap, handoff, dribble |
| `pin(who)` | forces a fresh sprite this frame (rings, chips) |
| `resetMotion()` | at replay start, SIM jumps, long pauses and rematch re-seeds |

Hit tests and HUD placement use these, never `b.p.ht`, because the drawn height is exaggerated ×1.15 (render-only). Sprite caches survive a rematch with the arena mounted; the 6 Mpx area cap holds across rematches.

### 6.4 Ground marks and the art pixel (players-2)

- `drawGroundMark(ctx, { x, y, shoulderPx, mark?: 'you'|'target'|'pressure'|'rival', color? })`: today the soft shadow (`rgba(0,0,0,0.32)`, 70% of shoulder width); from players-4 (V2 13:09) the sprite's cast shadow (silhouette sheared away from the lights at 34–42% alpha) plus an occlusion ellipse, same signature; and, when asked, the 2 px ring in gold `#f6b93b`, teal `#4fe3c1`, red arc `#ff5d5d` or violet `#8b7cf6`. `color` is the hook for ut's cosmetic ring colour (the Minutes 500/1,000-hour reward).
- `artScale(canvas) → { backing, devPerArt, artPxFor(cssHeight) }`. **To the sport teams:** your cameras set the on-screen heights; V2 C.1.2's table is a floor (controlled ≥51 / ≥34 design px) with camera guides (≈95 / 70 / 75); `players-verify.mjs` reports them. If the chosen backing is A or B, the resize code sets `canvas.width = W × backing` and draws through one `setTransform(backing)`; everything else keeps CSS px.

### 6.5 PlayerPortrait and WalkoutFigure (players-7, players-8)

`<PlayerPortrait sport pid season c1 c2 num pos ht wt size variant="bust"|"cheer"|"locked"|"dim" pose? />`: main-bundle safe, a fallback until drawn, cached.

`<WalkoutFigure rc|ref sizeArt={56–72} maxMs={≤2000} onDone reduced />`: no text inside; reduced motion = a static bust for 600 ms.

| Team | Uses (V2 cut applied) |
|---|---|
| ut | UT cards and squad (through `UtCard`), Collection (`mode`), MOTM, mastery and prestige (`finish`, `mastery`) |
| packs | reveal (`cheer`), the walkout (packs-9) per their cinema levels; several walkouts play one after another, each ≤2.0 s |
| nba / nfl / soccer | player of the game; nba's match intro uses `WalkoutFigure` |
| deferred | binder, poster (V2 F.2 players #7) |

### 6.6 `impactOf` call sites (a hand-off, not counted done until seen at merge)

- **nba:** `Hoops2.tsx` `J.hitStop('green'|'dunk'|'posterize'|'block', now)` → `J.hitStop(kind, now, impactOf(kind, …).stopMs)`, plus `slowMo` where they already slow time; the PERFECT moment uses `green`.
- **nfl:** `Football2.tsx` (`truck`, `bighit`, `int`, the PERFECT juke).
- **soccer:** its J-2 call sites (goal, big save, woodwork, power strike).

### 6.7 Readiness

Shell and the sport teams add `await pixelReady(sport)` to the match loading gate (one line). Players also starts it at module load.

### 6.8 First-run showcase (ut, packs)

- Players ships `src/data/appearance/first-run.json` (`{ nba, nfl, soccer }`, ≥12 pids each) and keeps 100% of it Tier A.
- **ut** (first-run flow, ut-7 starter chain): export `firstRunShowcase(sport): string[]` (card line ids shown in the first five minutes), or draw the shown stars from `first-run.json`.
- **packs** (starter pack): draw the starter's featured gold and its walkout from `first-run.json` ∩ the gold bucket. This changes no odds sheet for paid packs and no match protocol; it is packs' call.
- Post-merge verify checks 100% Tier A on whatever list they export.

### 6.9 Requests to the lead

- The `card-face.ts` ruling (read-only for players; move to packs).
- The backing-store hunk in the three sport TSX files, if players-2 picks option A or B: who makes it.
- The `vite.config.ts` on-demand diff for shell:
  `const onDemandModule = /[\\/](?:game[\\/]soccer2[\\/]|game[\\/]pixel[\\/]pitch\.ts|data[\\/](?:cards-(?:nba|nfl|soccer)|soccer)\.json|data[\\/]appearance[\\/]soccer\.json)/;`
- The art-pixel ruling (V2 13:09 contradicts itself: C.6 "size is whatever the camera says" vs C.5 rule 3 and lead decision 3, 1.5 design px).
- Reports (players does not edit these): brand-like badge names in `abilityName`/`ABILITY_HELP` (`hoops2/ratings.ts:200-207`) and `rate.ts:114` "Heat Check", now also a name clash with V2's in-match Heat; missing NFL (26%) and soccer (7.7%) jersey numbers in the data files; the NFL squad OL row overlapping at 320 (ut).

## 7. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| **Device-resolution backing costs frame time** (3× the floor fill) | Three options measured at 4× CPU and DPR 3 in players-2; the highest that meets §3.3 is adopted, with option C (today's grain plus the new proportions) as the floor; owner device check 2; memory checked over rematches |
| Exaggerated drawn height moves HUD and tap targets off the sim | Render-only by design; HUD and hit tests use `headTop`/`feetAt` (§6.3); `render-only.test.ts` per-step hash |
| Sport teams' camera changes alter sprite sizes under us | Targets are in art px; on-screen heights are reported, not owned; post-merge `players-verify.mjs` re-measures |
| The venue palette collides with the sport teams' floor and stands edits in the same files | Colour-only hunks through `venue.ts` calls, one line each, ledgered with line anchors and announced before landing; geometry untouched |
| Blend sprites thrash the cache | Separate ≤96-entry blend LRU, skipped under 24 art px, unaffordable blends become cuts; targets after a snap (players-6) |
| iOS clamps `performance.now()`; no `requestIdleCallback` | EWMA per-draw cost, count fallback [3, 14], a 1 ms-quantised clock test, pre-warm from leftover budget only (players-5) |
| Mid-match look or clip swaps | Per-sport clip bundles, `pixelReady` at module load and in the gate, no bulk dispose (players-3) |
| The starter pack is random, so "first-run players are Tier A" can't hold for bronze and silver fill | `first-run.json` and the §6.8 request: the shown stars and the featured gold come from the list; post-merge verify checks the exported list |
| The engines emit V2 acts late or with different names | Reserved names now (§6.1), the family fallback (players-2), the intake registry, must-tier only for rows registered before the task |
| Determinism | Import graph plus a per-step seeded state hash, extended in every render task; mirroring moves only the drawn ball |
| Likeness guardrail (skin from memory, or copied from the mockup) | Photo-sourced skin with `skinSrc`, else neutral; mockup hexes never used for named players; second review; owner check |
| Card CSS and QA depending on card internals | Class-existence and `aria-label` static test, outer-box invariance at every width (players-8) |
| Bundle and performance | §2 budgets, static import checks per task, UT first open ≤ +5%, the build measurement in players-10 |
| iOS canvas memory (backing, caches, portraits, crowd frames) | One 6 Mpx art-px area cap per match kept across rematches, portrait byte cap and blobs, owner check 8 |
| Reduced motion | `reducedMotion()` in every canvas module; `reduce` runs for cards and all three matches |
| Game length | Celebrations and run-ins cut at the next possession, snap or attack; 0 s added; tested (players-7) |
| CMU mirror, Transfermarkt or Commons unreachable | Keyed poses, curated feet only, neutral skin; recorded |

## 8. Cut, deferred and phase 2

**Cut by V2 (F.2 players #7) and the lead's decisions:**
- `PlayerPortrait` on the binder and the share poster (and revision 2's binder performance target). The binder and poster keep today's art.
- Celebration variants beyond 4 per sport (revision 2's 12-loop library: backflip, jump-spin, shrug, salute, finger-wag and spot-aware celebrations).
- `name-tag.ts`: name chips belong to nba's HUD kit; we keep the anchors.
- STREAM's skin-palette crowd recolour, replaced by C.2's head-and-shirt crowd (revised 13:09; it was three dark bands before).
- The frames-plus-busts gallery page for packs.

**Deferred, with reasons (each named in the team doc if a stretch is not reached):**
- Tier B curation (≈1,000 per sport) and anything short of players-9's target line, listed by pid. Accuracy over count; neutral defaults cover them.
- The draft `TradingCard` bust if players-8's stretch is not reached.
- Secondary motion (R10), the NBA layup family, box-out (players-7 stretch).
- NFL spin, truck, catch variants, pile, throw on the run; soccer header, volley, finesse/chip, tricks, shielding (players-6 stretch). The names stay reserved.
- Crowd front-row sprites, bench, coach and referee (players-9 stretch, V2 third wave), and R12 rating-gated variants.
- Soccer kit patterns (players-4 stretch, L-6); era kits for Era Nights (V2 D.9, packs-7) once that event exists.
- User look overrides (new saved state; nothing asks for it); the L-5 jersey-number backfill (lead's data files); greying hair with age (needs birth years).
- The full ≈40-clip studio set, motion matching and physics reactions (needs more licence-clear capture than CMU offers); a sprite atlas (only if the area cap shows pressure).
- Loading performance P-1 to P-5 (shell); H7 attribute generation (packs).

## 9. V2 response ledger

| V2 item | Decision |
|---|---|
| F.2 players #1: 5-head hero, 1.5 px art pixel, LOD, outline, ramps, Shaq/Bol ≥3 px | **Accepted, first.** players-2. The art pixel is a measured decision with a fallback (§7), because whole device pixels need a device-resolution canvas |
| F.2 #2: first-run and starter players Tier A | **Accepted.** `first-run.json` curated in players-3; the starter-pack draw is a request to packs (§6.8) because today's starter is random |
| F.2 #3: keep the near-first budget | **Accepted.** players-5, now on art-size rasters, with the controlled defender and rematch pre-warm |
| F.2 #4: frame plans in V2's order, unused clips first | **Accepted.** Locomotion players-5; NFL then soccer players-6; NBA then celebrations players-7; `dribble`, `crossover`, `cut`, `stiff_arm`, `getup_front` are each in a must list |
| F.2 #5: crowd rows, bench, coach, venue palette | **Split by V2's waves.** The palette is in the F.4 slice ("calmer venues"), so players-4 must; rows, bench and coach are third wave, so players-9 stretch |
| F.2 #6: signature-pose bust, C.4 silhouettes | **Accepted.** players-8; the pose comes from motion DNA when players-9 lands, a ready pose before |
| F.2 #7: cuts | **Applied** (§8) |
| F.2 #8: protocol none, keep the import-graph test | **Accepted.** `render-only.test.ts` from players-2 |
| F.4 slice items 6 and 7 | players-2 to players-5, in that order, before any other work |
| C.1.4 option lists | **Accepted** for hair (18), hair colours (15) and skin (10). Facial hair keeps STREAM's ≥8 as a superset of V2's 5 |
| C.1.6 kits | **Accepted.** players-4 (`uniforms.ts` is ours) |
| C.2 crowd (three dark bands, then the 13:09 head-and-shirt crowd) | **Accepted**, as revised (3.1 ledger). Replaces STREAM's skin-palette crowd recolour |
| C.4 walkout | **Promoted** from revision 2's stretch to players-7 must |
| C.5 rule 6 (name chips in the pixel font on a dark plate) | Name chips move to nba's HUD kit; `name-tag.ts` dropped |
| B.0.5 juice budget | **Accepted.** `impactOf` and the 150 ms/s cap (players-6) |
| B.1.6 rates (handler and defender 30 fps, others 15) | **Accepted** as ≥28 and ≥12 measured floors (players-5) |
| D.1 arena kept mounted, rematch ≤10 s | Caches survive rematch, pre-warm on re-seed, `resetMotion()` contract (players-5) |
| D.6 / E.5 cosmetics (card finish, mastery star, gold shoes, ring colour) | Hooks only: `UtCard finish`/`mastery` (players-8), `matchLook` `cosmetic` (players-3), `drawGroundMark` `color` (players-2). ut decides who gets what |
| Mockups' per-player skin hexes | **Not used as data** (guardrail) |
