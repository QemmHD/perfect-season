# Team packs: build plan

Team **packs**: the pack economy, real odds, promos, pack opening, and the Store and SBC screens. Worktree `/home/user/ps-s-packs`, branch `claude/studio-packs`, dev-server port **5213**. Base: `claude/studio-overhaul` = `acdf3e2`.

This is the planning step only. No code changed. The builder for each task reads this file, plus `BRIEF.md`, `BUILD-RULES.md`, `OWNERSHIP.md` and `STREAM-packs.md`, before starting.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full:**
- `O/audit-packs-promos.md`
- `O/research-ultimate-team.md`
- `O/audit-ut-ui.md`: M2, H7 and §4, plus the rest for context
- `docs/PACK-CINEMA.md`, `PULL-TRACKER.md`, `CARD-CIRCULATION.md`, `UT-CONTENT-2.md`, `UT-CONTENT-UPDATE.md`, `RATINGS-AUDIT.md`, `GAMEPLAY-RATINGS.md`

**Code read:**
- `packs.ts`, `rate.ts`, `ut-scale.ts`, `fc-scale.ts`, `rating-quality.ts`, `specials.ts`, `card-stats.ts`, `editions.ts`, `variants.ts`, `rare.ts`, `walkout.ts`, `pack-sequence.ts`
- `market.ts`, `preview-pack.ts`, `content-packs.ts`, `content-state.ts`, `content-sbc.ts`, `content-progress.ts`, `live-packs.ts`, `live-cards.ts`, `calendar*.ts`, `standouts.ts`, `promo.ts`, `pool.ts`, `pull-log.ts`, `sbc.ts`
- `Store.tsx`, `PackOpening.tsx`, `PackArt.tsx`, `Challenges.tsx`
- `admin/catalog.ts`, `economy.test.ts`, `engine/sport-branches.test.ts`, `supabase/functions/card-registry/contract.ts`, `scripts/build_numbered_catalog.ts`
- the buy, open and sell flows in `UltimateTeam.tsx`

---

## 0. Goals

The owner asked: "fix packs to make them more how real packs work for odds and for promos … people wanna do challenges to get more … attract dopamine … make cards appeal to the eye … make stats more accurate". Coins only.

Measured goals for this team:

1. **No economy-breaking bugs.**
   - Spotlight and GOAT cards sell for their real value: ≥1,400 and ≥5,000 coins (NBA), from 30 today.
   - SBC auto-fill never spends a special, numbered or high-value card.
   - The Scout Market no longer sells the top non-registry tier.
   - The Preview, Club Collection and program-pack exploits are closed.
   - Soccer never sees an NFL-position SBC.
2. **Real-pack odds.**
   - Golds are drawn from a per-OVR curve (research §8.1).
   - Per gold slot: about 94% land in 75–82, 83+ is 5.8% and 85+ is 1.0%. Today 64.7% of Gold-pack golds sit in 75–79.
   - Guarantees are OVR floors ("3 golds, one 78+").
   - Every sold pack's quick-sell EV is 40–60% of its price.
3. **Honest disclosure.**
   - Every pack shows a "chance of at least one" sheet before purchase: OVR bands, tiers and holo, with a timestamp.
   - The sheet is computed from the pack definition and proven by a test to match a 10,000-pack simulation within ±1.5 points.
4. **Bad-luck protection.**
   - Scout Stamps: 1 per 100 coins of packs, never expire.
   - A guaranteed program card on the 13th program pack of a wave.
5. **A coherent power ladder.**
   - Expected coins to get a tier rise with its displayed rating: Standout < Program < Legend < Hot Season ≤ Finale ≤ Spotlight < GOAT.
   - The face numbers a card prints are the numbers the match uses (Hot Season and Legend).
   - GOAT and Spotlight faces keep the player's shape, with no walls of 110s.
6. **Promos that feel live.**
   - Season rating caps that climb through the year: 94 → 95 → 97 → 96 → 97, with the Finale at 99.
   - Headliners, spread sets, repeat caps and a fresh second year.
   - A Program Hub page and a once-per-wave launch takeover.
   - Live Calendar check-in stamps, Season Path and seeded surprise flash windows.
   - A soccer calendar with Matchday Standouts and original program names.
7. **Pack opening that hits.**
   - Three cinema levels (≈1.2 s / 2.6 s / 4.2 s) plus Legend (≈5.0 s) and GOAT (6.6 s).
   - The tier colour shows in the first second, two specials give two flares, and every special gets its own walkout.
   - The best card comes last, Skip and Open-all always work, and reduced motion is respected.
   - Per-card actions after opening, with total value, OPEN NEXT and BUY AGAIN.
8. **Readable long pages.**
   - Store and SBC get sections, sticky chips, a featured hero, reward card faces and "1 card away" states.
   - SBC page length drops from 5.7 screens (393 wide) to ≤ 2.5 on open.

---

## 1. Ground rules for every task

### Commands (shared machine)

| What | Command |
|---|---|
| Typecheck | `cd /home/user/ps-s-packs && bash O/heavy.sh npm run typecheck` |
| NBA tests | `bash O/heavy.sh npx vitest run src/ut/<files>` |
| NFL tests | `PS_SPORT=nfl bash O/heavy.sh npx vitest run src/ut/<files>` |
| Soccer tests | `PS_SPORT=soccer bash O/heavy.sh npx vitest run soccer sport-branches` (add our new `soccer-*.test.ts` files) |
| Measurement | `PS_SPORT=<sport> bash O/heavy.sh npx vite-node scripts/packs/<script>.ts` |
| Dev server start | `nohup npx vite --port 5213 --strictPort > /tmp/ps-packs-vite.log 2>&1 & echo $! > /tmp/ps-packs-vite.pid` |
| Dev server stop | `kill $(cat /tmp/ps-packs-vite.pid)` |

- Run the full `npm test` and `npm run build` only in packs-10.
- Never use `pkill -f` or `pgrep -f`.

### Browser QA

- Every page opens with `?ns=inspect&relay=ws://localhost:7777`.
- Every Playwright context runs `context.route('**/*')` and aborts every host except localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com. Copy the harness from `O/audit-scripts/utui/lib.mjs`.
- Never open a Spotlight or registry pack in QA.
- To force a given walkout without shipping a hook, seed the save with pending packs:
  - `admin-card:<card id>` opens exactly that card.
  - `studio:` recipes give multi-card packs.
- Viewports: 393×852 with insets 59/34 (the owner's phone) and 320×568, touch on.
  - Use `deviceScaleFactor: 1` for our own checks.
  - Screenshots go to `O/shots/packs/<task>/<sport>-<width>-<screen>.png`. Look at every one.

### Saves

- Never change a storage key, card/edition/copy id, uid format, claim id or the meaning of a saved field.
- New state goes only in optional `ut.content.*` fields. Add each one to `ContentState` **and** to `normalizeContent` (`content-state.ts`), or it is dropped on load.
- Every task that adds state adds an old-shape-save test. It loads, round-trips through `captureProgress` / `checkedSnapshot` / `applyProgress` / `validateSaveValues` (see `pull-tracker.test.ts`), and keeps every coin, card, level and claim.

### Protocol

- Never edit `DRAFT_RULES` or `UT_RULES`.
- Pack odds, prices, stamps, pity and presentation need no bump.
- Ratings a match reads do: write "Protocol bump needed: …" in `docs/studio-overhaul/packs.md`.
- `CONTENT_PRINT` (`pool.ts`) is ours. Bump it when we change what the online pool can contain or how it rates.

### Cutoffs (so started content never moves)

- **`PROMO_EDIT_FROM = '2026-12-04'`**, a new constant in `calendar.ts`.
  - Only promos with `start >= PROMO_EDIT_FROM` may change band, delta, featured, rule or selection.
  - Every earlier promo and its frozen selection stays byte-identical. A test pins a hash of those entries in `live-calendar.json` and `live-editions.json`.
  - s1-first-tip (11-13), s1-landmark (11-06) and s2-feast-week (11-27) are therefore untouched.
  - If integration slips past 2026-11-27, the lead moves the constant later. It must never move earlier.
- Registered Spotlight/GOAT packs always rebuild their common slots with the **legacy** draw (`legacyFill`), so a retried receipt reconstructs exactly the cards it was minted with.

### Outside our lane

- `UltimateTeam.tsx`, `nav.ts`, `state.ts`, `progression.ts`, `inbox.ts` and `Hub.tsx` belong to ut.
- Every hook there stays a few lines, never reformats, and is listed under "Touched outside my lane" in `packs.md`, with the exact hunk.
- New CSS goes into our own files: `pack-cinema.css`, `pack-reveal.css`, `pack-art.css`, `content.css`, `pull-tracker.css`, plus the new `store.css`, `odds-sheet.css`, `program-hub.css` and `sbc-page.css`. Never `styles.css`.

### Layout

- 390 frame, taps ≥ 44 design px (use the `::before` hit-area pattern for compact chips), text ≥ 10 design px.
- No width media queries. SVG for symbols. Reduced motion honoured.

### Commits

- Start with `Claude: `, end with the two trailer lines from BUILD-RULES, stage explicit paths, then push `claude/studio-packs`.
- Update `docs/studio-overhaul/packs.md` in the same commit as the work.

---

## 2. Baseline (from the audits; re-measured in packs-1)

| Measure | Now | Target |
|---|---|---|
| QS of a Spotlight / GOAT (NBA) | 30 / 30 (NFL 10 / 10) | ≥ 1,400 / ≥ 5,000 (×0.35 NFL), monotone by tier |
| Auto-fill with a Spotlight 104 MJ in the club | puts it in Bronze Upgrade | never chosen |
| Market top tier | 2 Hot Season (94–97) a day at ≈2,100; Featured Standout 2,750 | none above the best Premium gold band (≤ 91); no specials |
| Preview: coins per special (Premium) | 1,800 (vs ≈27,100 by odds) | ≥ 15,000 under the optimal check-every-24 h policy |
| NFL Captains vs Standout Guarantee | 1,000 vs 1,800 | price per guaranteed Standout ≥ the Standout Guarantee price, every sport |
| Program pack vs guarantee (NBA) | 3,000 vs 3,200 | guarantee ≥ 2.2× the program pack |
| Soccer NFL-position SBCs | 44 appearances in 28 days | 0 |
| Golds in a Gold pack: 75–79 / 80–82 / 83–85 / 86+ | 64.7 / 28.7 / 5.7 / ≈1.0% | 45.0 / 49.2 / 5.2 / 0.7% (G75 curve) |
| Per G75 slot: 83+ / 85+ / 88+ | n/a | 5.8% / 1.0% / 0.20% (±0.5 / 0.3 / 0.1) |
| Lightning EV / price | 0.67 NBA/NFL, **0.84** soccer | 0.40–0.60 |
| Odds sheet | tiers per slot only, no bands or holo, wrong Scout copy | per-band, tier and holo "at least one", timestamp, ±1.5 pts of simulation |
| Ladder (NBA expected coins) | HS ≈2,100 (Market), Spotlight ≈17,500, Legend ≈177,000 | monotone with rating (§0.5) |
| Hot Season face vs played (worst, NFL Ferguson '77) | face THP 99, played 79 | face − played ≤ 2 on every face key; displayed OVR unchanged |
| GOAT faces at the cap (Brady) | 5 of 6 at 110 | ≤ 2 at the cap, ≥ 3 distinct values, order of strengths kept |
| Program repeats (NBA, year 1) | MJ '88 in 8 editions; LeBron 14 | ≤ 2 per (player, season), ≤ 4 per player per cycle (promos from the cutoff) |
| Promos with a headliner | 3 of 42 | every future promo with ≥ 6 cards |
| Walkouts per pack | 1 (best card only); an 82 Standout walks out | every 86+ or special card; Standouts only at 86+ or featured |
| Reveal headline | counts golds only ("10 GOLDS" over 12) | counts every tier, plus best card and total value |
| Pack-screen small targets | SKIP 65×36, QUICK SELL DUPES 133×34, TAP TO CONTINUE 224×42 at 320 | all ≥ 44 design px |
| SBC page length (393 / 320) | 5.7 / 6.7 screens | ≤ 2.5 / ≤ 3.0 on open |
| Store | 3.8 screens, Club Collection above Featured | sticky chips, hero first, Club Collection last among sections |

---

## 3. Task overview (ordered; P0 first, enabling work first)

| # | Id | Pri | Title | Est | Depends on |
|---|---|---|---|---|---|
| 1 | packs-1 | P0 | Measurement harness, quick-sell / auto-fill / SBC-confirm fixes, soccer SBCs and the sport-branch guard | 2.5 h | n/a |
| 2 | packs-2 | P0 | Per-OVR gold curve, OVR-floor slot lists, new pack tiers (Headliners, Franchise Vault, Elite re-spec), holo rule, chase duplicate protection | 3 h | packs-1 |
| 3 | packs-3 | P0 | Economy levers and exploits: Market, Preview, Club Collection, program-pack pricing and Friday boost, Lightning and seeded flash windows, EV band for every sold item | 2.5 h | packs-2 |
| 4 | packs-4 | P0 | Odds sheets everywhere, Store information architecture, purchase confirm, per-pack art | 3 h | packs-2, packs-3 |
| 5 | packs-5 | P0 | Bad-luck protection: Scout Stamps and the 13th-program-pack guarantee | 2.5 h | packs-2, packs-4 |
| 6 | packs-6 | P0 | Ratings truth and the tier ladder: Hot Season/Legend shown = used, shape-keeping GOAT/Spotlight attributes, rarity ladder, monthly Legend SBC | 3 h | packs-2, packs-3 |
| 7 | packs-7 | P1 | Promo content: season caps, headliners and spread, repeat caps, fresh second cycle, released-wave rewards, Standout reason lines, soccer Live Calendar | 3 h | packs-6 |
| 8 | packs-8 | P1 | Promo presence and calendar loops: promo-hub API for ut, Program Hub page, launch takeover, check-in stamps, Season Path | 3 h | packs-5, packs-7 |
| 9 | packs-9 | P1 | Pack opening that hits: cinema levels, flares, multiple walkouts, ordering, program walkout, post-open management, Open all, OPEN NEXT / BUY AGAIN | 3 h | packs-2, packs-6 |
| 10 | packs-10 | P1 | SBC long page (categories, reward faces, "1 card away"), final QA (full tests, build, walks) and docs | 3 h | all |

---

## 4. Tasks in detail

### packs-1 (P0): Measurement harness and the critical bug fixes

**Why:** audit C1 (critical) and H4, plus the brief's P0 items 1 and 6. It also provides the before numbers every later task compares against.

**Changes:**

1. **Harness.** Port the audit scripts into the repo, with relative imports (they hard-code `/home/user/ps-studio`):
   - `scripts/packs/packsim.ts` from `O/audit-scripts/packsim.ts`:
     - Keep N, the week (`2026-W46`), band edges, the EV / special / walkout / dupe columns and Spotlight via `SPOTLIGHT_RATES`.
     - Write to `O/packs-out/<label>/packsim-<sport>.json`, where `<label>` comes from `PACKSIM_LABEL` (default `now`).
     - Add per-gold-slot OVR histograms (75..91) and "at least one" rows (80+, 82+, 83+, 84+, 85+, 86+, 88+).
   - `scripts/packs/promos.ts`, `scripts/packs/autofill.ts`, `scripts/packs/promoattrs.ts`: same port. `promoattrs` prints face versus played attributes for every Hot Season, Legend, GOAT and Spotlight edition.
   - Run all three sports with `PACKSIM_LABEL=before`. Copy the headline tables into `packs.md`.
2. **Quick-sell (C1).** `packs.ts quickSellValue`: make the tier chain one `if / else if`.
   - GOAT: `5000 + 500·(ovr−106)`. Spotlight: `1400 + 100·(ovr−100)`. Both × `PACK_SHAPE[sport].qs`.
   - The legend/promo/… branches must no longer overwrite them.
   - Export `TIER_VALUE_ORDER` for the test.
3. **Auto-fill (C1).** `sbc.ts autoFill`:
   - Never take a card when any of these holds:
     - its tier is in `{goat, spotlight, legend, landmark, promo, program}`;
     - `line.programKind === 'finale'`;
     - it has `mint` (numbered);
     - it is locked;
     - its `quickSellValue` is more than the reward's value.
   - A card can still be picked by hand.
   - This needs a `FillCard.mint?` field. `ClubCard.oc.mint` already exists; `Challenges.tsx` maps it.
   - Add `rewardValue(reward, sport)` in `sbc.ts`: the pack's mean QS EV from `packDefs`, a gold card's QS at its `minOvr`, a Standout's mean QS, and so on. Coins count as themselves.
4. **Confirm warning (C1, research §8.8).** In the `Challenges.tsx` `Confirm` body:
   - Always say "These cards are removed permanently."
   - Add a red warning row when any submitted card is special, numbered or 90+, or has a QS value above `rewardValue`. Name the card ("Michael Jordan · Spotlight 104 · #8/20").
   - Change the yes label to `TRADE IN ANYWAY` in that case.
5. **Soccer SBCs (H4).** In `sbc.ts`, rewrite the five `nba(c) ? … : …` templates with `pickFor(c.pool.sport, { nba, nfl, soccer })`. Keep each list's length and order, so the NBA and NFL day/week picks are byte-identical.

   | Template | Soccer version | Positions |
   |---|---|---|
   | Pickup Game | "Kickabout" | — |
   | Backcourt / Pass Catchers | "Front Three" | W ST W |
   | A Full Five / Skill Set | "Back Four" | FB CB CB FB |
   | Frontcourt / No Fly Zone | "Midfield Engine" | DM CM AM |
   | Gold Standard / Gold Front Seven | "Gold Spine" | GK CB DM ST |

   Delete the `nba` helper.
6. **Guard (H4).** `src/engine/sport-branches.test.ts`:
   - Add patterns `/\b(?:nba|nfl|isNba|isNfl)\([^)]*\)\s*\?/` (it matches across lines because the test scans the joined code).
   - Add a self-test case `const t = nba(c)\n ? a : b`.
   - Brief-sanctioned; list it as touched outside the lane.

**Tests (new `src/ut/packs-economy.test.ts`; NBA, NFL and soccer runs):**
- `quickSellValue` is non-decreasing along `bronze < silver < gold < standout < program ≈ promo < landmark < legend < spotlight < goat` at each tier's median OVR, in every sport.
- Spotlight QS ≥ 1,400·qs and GOAT QS ≥ 5,000·qs.
- Auto-fill fixture (the audit's): a club holding an unplayed Spotlight MJ 104 with a mint, a GOAT, a Legend, a Hot Season, 12 bronzes and 12 silvers. Run every SBC of 28 days. No returned uid is a special or numbered card, and every SBC fillable from the commons still fills.
- Soccer: `sbcsFor(pool, day)` for 60 days. Every `positions` requirement names only soccer positions (`GK CB FB DM CM AM W ST`).
- NBA/NFL: `sbcsFor` for the same 60 days is identical to a snapshot taken before the change (titles, reqs and rewards, apart from the soccer-only branch).
- `branchHits` flags `nba(c)\n ? a : b`. The full scan returns `[]`.

**Measurements:**
- `scripts/packs/autofill.ts` before (MJ goes into 7 SBCs) and after (0).
- `packsim` after: Spotlight pack EV/price NBA 0.31 → ≈0.39, NFL 0.19 → ≈0.35 (audit's corrected values).

**Screenshots:**
- The SBC confirm with the red warning (NBA 393).
- The soccer SBC list showing "Back Four" (393 and 320).

**Protocol:** none. No match rules or ratings change.

**Save-compat risks:**
- None for NBA/NFL: same SBC ids and templates.
- Soccer: on the release day a soccer daily slot may change template under the same id `d:<day>:<i>`. A finished one still shows DONE, because claims are by id. Accept and note.

**Cross-team:** none.

**Acceptance:**
- Tests above pass in all three sports.
- Typecheck is clean.
- The before tables are in `packs.md`.

---

### packs-2 (P0): Per-OVR gold curve, OVR-floor slots, new tiers, holo, chase duplicates

**Why:** the brief's P0 "Gold OVR curve" and "Guarantees as OVR floors", research §8.1/§8.2 (Headliners, Franchise Vault, holo), and audit M7/M8 plus H2's duplicate clause. This is the enabling task: prices (packs-3), sheets (packs-4), stamps (packs-5) and the ladder (packs-6) are all built on these definitions.

**Changes (`src/ut/packs.ts` unless noted):**

1. **Curves.**
   - `export const GOLD_CURVE: [number, number][]` (display OVR → weight): 75 4.56, 76 5.02, 77 6.71, 78 13.46, 79 15.29, 80 17.67, 81 16.22, 82 15.28, 83 3.40, 84 1.38, 85 0.43, 86 0.22, 87 0.16, 88 0.15, 89 0.034, 90 0.011, 91 0.005. This is research §8.1; `O/calc/odds.py` reproduces the slot tables.
   - `SILVER_CURVE`: 65–69 at 9% each, 70–74 at 11% each (the 45/55 split).
   - Bronze stays flat.
   - Write every OVR relative to `TIER_CUTS[sport].gold` / `.silver`, so a re-targeted scale follows.
2. **`curvePick(list, curve, floor, rand)`**, replacing `weighted()` for live draws:
   - Index the list by OVR once (`WeakMap`).
   - Draw an OVR from the curve restricted to `≥ floor` and renormalised.
   - Resolve to the nearest OVR the list has, stepping −1, +1, −2, +2, … but never below `floor` and never above the curve's top.
   - Pick uniformly at that OVR.
   - When the position has nothing ≥ floor, use the best gold at that position, then any position (the current fallback order).
   - Keep the old `weighted()` as `legacyWeighted()`.
3. **Floor slot kinds.**
   - `SlotTier` adds `'g78' | 'g80' | 'g82' | 'g84' | 'g86'` (gold with an OVR floor).
   - `DRAW_ORDER` and `drawSlot` route them to `curvePick(bucket.gold[pos], GOLD_CURVE, floor)`.
   - The legacy slot `rare` stays readable, because saved `studio:` recipes and old tests use it. It maps to `g78`.
   - "Rare" becomes the shimmer only: `rare.ts` and `isRare` are unchanged.
4. **Slot lists.** Research §8.2; NBA / soccer / NFL card counts follow `PACK_SHAPE` / `CONTENT_SHAPE`. The table gives NBA.

   | Pack | NBA slot list | Special slot | Limit |
   |---|---|---|---|
   | Gold | 2 S, 2 G75, 1 G78 | special slot `{g78, standout .015, promo .005, legend .002}` (packs-6 re-tunes promo/legend) | — |
   | Premium | 2 S, 3 G75, 3 G78 | last G78 is the premium slot `{standout .04, promo .02, legend .0066}` | — |
   | Jumbo | 4 S, 4 G75, 7 G78, 1 premium slot | as Premium | 1/day |
   | Position / Unit | (k−1) G75 + 1 G78 at the chosen position(s) | none | — |
   | **Elite Gold** (re-spec) | 5 G82 + 1 G84 slot | G84 slot `{g84 .89, standout .10, legend .01}` | 2/day |
   | **Headliners** (new kind `headliners`) | 5 G80 + 2 G82 + 1 slot | `{g82 .79, program .12, standout .08, legend .01}`; with no live program, the 0.12 goes to `standout` | 2/day |
   | **Franchise Vault** (new kind `vault`) | 9 G82 + 2 G84 + 1 slot | `{g84 .68, program .30, legend .02}`; no live program → `standout` | 1/week |
   | Program pack (`live-packs.ts LIVE_SHAPE` → slot lists) | 4 G75 + 3 G80 + 1 program slot | `{program odds, legend .005, standout rest}` | — |
   | Program Guarantee | 5 G82 + program 1.0 | — | — |
   | Standout Guarantee / Lightning | G75 / G78 for the old G / R | `{standout: 1}` | — |
   | Club Collection (`studio:` recipes) | `gold` → G75, `rare` → G78 | `standout` | — |
   | Spotlight (local slots only) | 7 G75 common + server chase slot | — | — |

   NFL and soccer scale the counts the same way, using `pick({nba, nfl, soccer})`: NFL Headliners 10 G80 + 5 G82 + 1 slot; Vault 18 G82 + 5 G84 + 1 slot; soccer about ×1.4.
5. **Program slot outside live packs.**
   - New `programDrawFor(pool, day)` in `live-packs.ts` returns a `ProgramDraw` over the released cards of the program-kind promos live that day (`promosOn` → `promoCards`), or null.
   - `openPack` passes it to `fill` for `headliners` and `vault`.
6. **Prices** (initial; packs-3 fixes them with the EV test).
   - `CONTENT_PRICES` gains `headliners`: NBA 3,800 / NFL 3,000 / soccer 3,400, and `vault`: 9,000 / 7,000 / 8,000.
   - Elite: 3,000 / 2,100 / 2,600.
   - `content-packs.ts LIMITS` gains `headliners: {per:'day', n:2}` and `vault: {per:'week', n:1}`.
   - Export `LIMITED_PACKS` so `UltimateTeam.tsx` reads it (a 1-line hook replacing its local `LIMITED` array).
7. **Holo** (`variants.ts`, `fill`).
   - `HOLO_CHANCE = 0.05`, applied only when the slot's chance of that card's tier was < 1, so guaranteed slots never go holo (FC 27 rule).
   - Export `holoChanceOf(slot)` for the sheet.
8. **Registered packs.**
   - `registeredPack` and every reconstruct-from-receipt path call `legacyFill`: today's `fill` with `legacyWeighted` and the old `rare` handling.
   - Freeze 20 receipt seeds per sport into a test **before** touching `fill`.
9. **Chase duplicate protection (M7, H2).**
   - `openPack(pool, kind, seed?, week?, opts?: { avoid?: Set<string> })`.
   - When a Standout or program slot draws a card whose `line.id` is in `avoid`, redraw up to 6 times. While the whole set isn't owned, fall back to an unowned card of the set.
   - Hook in `UltimateTeam.openNow`, 2 lines: `openPack(pool, kind, undefined, undefined, { avoid: ownedIdSet })`.
10. **Pull log and art.**
    - `pull-log.ts packGroup` and `defFor` handle `headliners` / `vault`.
    - The Store gets minimal tiles for both under Featured (packs-4 restyles). `PackArt` maps the two kinds to `premium` art until packs-4.
    - New kinds are **never** awarded as pending reward packs, so an older client restoring a cloud save never meets an unknown pending kind.

**Tests (`src/ut/pack-curve.test.ts`, all three sports):**
- For each floor (75/78/80/82/84), 200,000 `curvePick` draws over the real pool reproduce the curve's "≥ x" chances within ±0.5 points for x ≤ 84, and within ±0.3 for 85+ and 88+.
- For NFL K/OL and soccer GK, assert the step-down fallback moved ≤ 1.5% of mass.
- Every pack's slots sum to 1, and the card counts match the table.
- Studio recipes with `rare` still open.
- Registered seeds: the 20 frozen seeds per sport rebuild the same card ids.
- Holo: 0 holos in guaranteed slots over 10k Standout Guarantee packs, and 5% ± 0.6 of special cards from random slots.
- Avoid: with every current Standout but one owned, the Standout Guarantee gives the unowned one in ≥ 99% of 2,000 packs.
- Existing `packs.test.ts`, `content2.test.ts` (slot counts and guarantees) and `pull-tracker.test.ts` are updated to the new slot names, never weakened.

**Measurements:** `PACKSIM_LABEL=after-curve`, all three sports. Record in `packs.md`:
- the gold-slot histograms;
- Gold-pack golds 75–79 / 80–82 / 83–85 / 86+: target 45 / 49 / 5 / 0.7 (±2);
- "at least one" for Gold, Premium, Jumbo, Headliners, Elite and Vault against research §8.2. For example Premium NBA: 82+ 79%, 84+ 15%, 86+ 3.7%, each ±3 points. Explain any pool-shape deviation;
- EV/price per pack, which packs-3 re-prices;
- duplicate rates at 100 and 200 packs.

**Screenshots:** the Store Featured section with the Headliners and Vault tiles (NBA 393).

**Protocol:** none. Pack contents do not affect matches or `pool.print`.

**Save-compat risks:**
- Unopened earned packs roll on the new curve when opened. They are random anyway.
- The current Preview Pack's cards change once after the update (`previewCards` re-derives them). Accepted; noted in `packs.md`.
- Registered packs: protected by `legacyFill` and the seed test.
- Saved studio recipes: `rare` → `g78`, tested.

**Cross-team:**
- ut: the `LIMITED_PACKS` and `avoid` hooks in `UltimateTeam.tsx`.
- shell: owns how `pool.ts` loads. We only read buckets.

**Acceptance:**
- All the tests above pass in NBA, NFL and soccer.
- Measured curves are within tolerance.
- The new tiles buy and open in the browser at 393 with 0 page errors.

---

### packs-3 (P0): Economy levers and exploits

**Why:** audit C2, H1, H2, H3, M2 and M5, plus H7's flash windows; the brief's P0 items 2 and 5. Research §8.2 covers the promo boost and flash windows.

**Changes:**

1. **Scout Market (C2), `market.ts`.**
   - `MARKET_MIX = ['silver','silver','gold','gold','gold','gold','rare','rare','rare','rare','rare','star']`.
   - `star` is one *base season* gold ≥ 86, priced `max(1,500, 4×QS)`.
   - No `promo` and no `standout` tags any more. `MarketTag` keeps them in the union so old screens type-check.
   - Change the price rule to `max(floor, round50(3×QS))` with floors silver 100, gold 300, rare 400, star 1,500.
   - Bump the market seed (`'ut-market:v2:' + sport + ':' + day`), so the new mix doesn't reuse old slot meanings.
   - `Store.tsx Market` drops the `TAG.promo` / `TAG.standout` labels.
2. **Preview Pack (H1), `preview-pack.ts`.**
   - `PREVIEW_COOLDOWN_MS = 24 h`, applied after **both** buy and skip (`nextPreview` sets `until` in both cases).
   - The preview binds its week at creation: new optional `preview.wk` (additive, normalised). `previewCards` uses `wk ?? week`, so a Monday rollover cannot reroll it.
   - Existing previews without `wk` adopt the current week on first read and save it.
   - `PreviewPack.tsx` shows "Next preview in 23 h". The `UltimateTeam` toast text comes from the constant (1-line hook).
3. **Club Collection (H2), `src/admin/catalog.ts`.**
   - `checkedCatalog(raw, sport?)` **clamps** (never rejects) each pack's price up to `floorPrice(sport, counts)`:
     - `counts.standout × CONTENT_PRICES[sport].standout`, plus
     - the QS EV of its gold, rare and silver slots ÷ 0.6.
   - Defaults are raised to satisfy it: NBA Captains ≥ 3,000 and NFL Captains ≥ 1,800.
   - `LIMITS` gains `roster` 2/day, `captains` 1/day and `dynasty` 1/week. Studio buys go through `buyLimited` (`UltimateTeam.buy`'s studio branch already normalises the kind; 1 line to route it).
   - The Store order moves Club Collection after Featured and This Season (also in packs-4).
4. **Program packs (H3), `live-packs.ts`.**
   - The guarantee price is `max(round100(tplPrice × PRICE_FACTOR.guarantee), ceil100(2.2 × the same promo's program-pack price))`. NBA 3,000 → ≥ 6,600.
   - **Friday boost:** `boostOf(promo, at)` is active from a wave's date (ET) 18:00 until +48 h (Fri 18:00 → Sun 18:00).
   - While it is active, the program-slot odds are × 1.5, capped at 0.6 (30% → 45%).
   - `livePackDef(sport, pack, at?)` returns `boost: { until } | null` and the boosted `slots`. `openLivePack` takes `at`.
   - The sheet shows the boosted number and when it ends (packs-4).
5. **Lightning and flash windows** (H7 part, `content-packs.ts`).
   - `flashWindowsOf(week)`: seeded by `'flash:' + week`, pick 2 of the 4 `defaults.flashWindows.slots` (Sat 12–14, Sat 20–22, Sun 13–15, Sun 19–21 ET).
   - `lightningWindow(at)` opens only those two.
   - The limit key format stays `lightning:<day>:<hour>`.
   - Lightning's discount drops from 25% to **15%**, so its EV fits the band.
   - The Store says "2 surprise Lightning windows this weekend" and shows the countdown only while one is open.
6. **Prices by value (M5).** One table, `PRICE_BY_VALUE[sport]`, exported from `packs.ts` and used by `CONTENT_PRICES`, `PACK_SHAPE.price` and the studio floors. Re-price every sold pack so its 10k-pack QS EV / price is inside **0.40–0.60**. Chase packs are listed apart:
   - Spotlight: packs-6.
   - Program Guarantee: ≥ 2.2× the program pack, and EV ≥ 0.25.
   - Vault: EV ≥ 0.35, because it carries a 30% program slot.

**Tests (extend `economy.test.ts`; new `src/ut/exploits.test.ts`):**
- **EV band:** every sold non-chase item in every sport has 3,000-pack QS EV / price in [0.40, 0.60]. That covers Bronze, Silver, Gold, Premium, Position/Unit (each key), Jumbo, Elite, Headliners, Standout Guarantee, Lightning, the base program pack, every studio pack and the Preview (= Premium). Each guaranteed Standout costs at least the Standout Guarantee.
- **Market:** 60 days × 3 sports have no promo, legend, program, standout, landmark, spotlight or goat item. Every item's displayed OVR ≤ 91 and every price ≥ 2.5×QS.
- **Preview:** after a buy, `previewStatus(at + 24 h − 1).ready === false`. The cards are identical across a simulated week change.
  - Simulation: a player checking every hour for 30 days who buys only previews holding a special. Coins per special ≥ 15,000 (was ≈1,800).
- **Club Collection:** `checkedCatalog` clamps NFL Captains 1,000 → ≥ 1,800. A live catalog below the floor still loads.
- **Program packs:** the guarantee is ≥ 2.2× the program pack for every scheduled pack in NBA and NFL. The boost is 1.5× inside the window and 1.0× outside, at Sun 18:00 ± 1 min.
- **Flash windows:** exactly 2 a weekend, deterministic per week, different across ≥ 50% of 52 weeks. `content2.test.ts`'s Lightning cases are updated to the seeded windows.

**Measurements:**
- `packsim` (`PACKSIM_LABEL=after-economy`): the EV / price table for every pack and sport.
- Market OVR max over 28 days: before 97, target ≤ 91.

**Screenshots:**
- The Market at 393 (NBA and soccer).
- A Program pack tile with a BOOSTED tag (clock set to a Friday 19:00 ET wave).
- The Lightning "2 surprise windows" note.

**Protocol:** none.

**Save-compat risks:**
- `preview.wk` is additive.
- The market `bought[]` indices for the release day point at new items. They are day-scoped, so this only affects that day; noted.
- Lightning limit keys are unchanged.
- Studio packs pending as rewards keep their frozen `studio:` recipe and open as before.

**Cross-team:** ut gets 1–2 line hooks in `UltimateTeam.tsx` (the preview toast text, the studio packs routed through `buyLimited`).

**Acceptance:** all the tests above pass in three sports, and the EV table sits inside the band. `packs.md` gets a coin-flow note: the engaged player's coins per pack-equivalent before and after.

---

### packs-4 (P0): Odds sheets everywhere, Store IA, purchase confirm, pack art

**Why:** audit H5, M4 (purchase confirm), M6, M8, L1, L2 and H6's pack art; the brief's "Odds sheets everywhere" and "Long pages (M4) for Store"; research §8.3 and the §8.12 Store layout.

**Changes:**

1. **`src/ut/odds.ts` (new): the one source of published numbers.**
   - `slotDist(pool, slot, ctx)` gives each slot's exact distribution over (tier, displayed OVR), computed from the pool:
     - curve slots: position mix × curve × the `curvePick` resolution rule;
     - specials: uniform over the bucket, Standout featured share, released program cards;
     - holo.
   - `oddsTable(pool, def, ctx)` returns:
     ```ts
     {
       cards: number;
       slotsText: string;                       // "8 cards: 2 silvers, 6 golds (3 of them 78+) and 1 Premium slot"
       bands: [80, 82, 83, 84, 85, 86, 88].map(x => ({ x, p })); // P(at least one ≥ x)
       tiers: { standout?, program?, promo?, landmark?, legend?, goat?, spotlight? }; // P(at least one)
       holo: number;
       perSlot: { label: string; curve: [number, number][] }[];
       boosted?: { until: number };
       updated: string;                          // ODDS_UPDATED
     }
     ```
     `1 − Π(1 − p_slot)`, with no-repeat redraws ignored (the test bounds this).
   - `pickTable(pool, kind)` handles picks: Scout's Choice best of 3 on G84 (85+ 81%, 86+ 56%, 87+ 39%, 88+ 23%) and the real Standout-option chance.
   - Scout's options are drawn on `curvePick(G84)` instead of uniform among 84+ (`content-packs.ts scoutOptions`). Open picks are saved, so nothing reshuffles.
   - `fmtPct(p)`: anything below 0.1% reads "less than 0.1%", ≥ 99.5% reads "100%", and otherwise one decimal below 10%. Never a sum that misleads.
2. **`OddsSheet.tsx` + `odds-sheet.css` (new)**, replacing `Store.tsx OddsSheet`:
   - The header is the slots text.
   - The main table is "Chance of at least one" (bands, then tier rows, then holo).
   - A PER CARD toggle shows the per-slot curve as a bar list.
   - The footer: "Each pack is independent. Updated <ODDS_UPDATED>." The stamps line arrives with packs-5. A BOOSTED tag shows with a countdown.
   - Fixed Scout copy: "three different 84+ golds from the same curve; each option is a Weekly Standout 3% of the time".
   - A "Rare = shimmer only" note (M8).
   - A Spotlight note: the GOAT/Spotlight contract numbers are unchanged.
   - Opened from: every Store tile's "%" chip, the Preview Pack, pending "Your packs" (before opening), the program packs and the confirm sheet.
3. **Store IA (M6, M4).** Restructure `Store.tsx` + new `store.css`:
   - Sticky section chips: FEATURED · THIS SEASON · DAILY · PACKS · PICKS · STAMPS · CLUB COLLECTION. Scroll-spy; taps ≥ 44 via `::before`.
   - Section order: Your packs (when any, with OPEN ALL from packs-9) → **Featured hero** (the live program pack or Headliners, with large `PackArt`, its BOOSTED tag and its odds chip) → This Season → Daily (Daily Drop, the Market link) → Packs, ascending price → Picks & Preview → Stamps (packs-5) → Club Collection → PULL HISTORY.
   - Coin numbers use `toLocaleString('en-US')` everywhere: the wallet pill, tiles and the Market.
   - Unaffordable tiles show a disabled visual with "Need N more", instead of failing on tap.
   - A "BEST VALUE" badge goes on the pack with the highest EV / price among sold non-chase packs.
   - The Daily Drop blurb shows the sheet's numbers (L2).
4. **Purchase confirm (audit M4).**
   - Packs ≥ 1,500 coins open `BuyConfirm`: pack art, price, the three most informative "at least one" rows, a VIEW ODDS link and BUY / CANCEL.
   - "Don't ask again" stores `ut.content.prefs.skipBuyConfirm` (additive, normalised).
   - The confirm lives inside `Store.tsx` before `onBuy`. The pref writes through a new `onPrefs` prop (2-line hook in `UltimateTeam.tsx`).
5. **Pack art (H6, L1), `PackArt.tsx` + `pack-art.css`.**
   - New optional props `accent?: [string, string]`, `title?: string` and `pattern?: number`.
   - A program pack draws an SVG pattern (stripes, chevrons or dots, chosen by `hashString(promoId) % 3`) in its two accent colours. The promo name sits on two lines with font-size fit by character count, so nothing truncates ("STANDOUT G…").
   - The NFL position art reads UNIT.
   - The new kinds `headliners` / `vault` get their own foil classes.
   - Callers pass these through: Store, PackOpening and Program Hub.

**Tests (`src/ut/odds.test.ts`, three sports):**
- For every sold pack, plus Daily, Preview, a program pack (boosted and not), Headliners and Vault: 10,000 seeded opens give each "at least one" band and tier row within **±1.5 points** of `oddsTable`.
- Holo is within ±0.5.
- Scout's `pickTable` matches 10,000 `scoutOptions` within ±1.5.
- `fmtPct` cases.
- Every Store tile has a working odds chip (React test or QA).
- The Spotlight sheet's tier rows equal `SPOTLIGHT_RATES` exactly.

**Measurements (Playwright, 393 and 320, three sports):**
- 0 targets < 44, no text < 10, no horizontal overflow, 0 page errors.
- Time from a tile tap to the odds sheet < 150 ms.
- Store length in screens, recorded. The first screen must show the chips and the hero.

**Screenshots:** for NBA, NFL and soccer at 393 and 320:
- Store top (hero and chips);
- an odds sheet (Premium), the PER CARD toggle, the Scout's sheet;
- the confirm;
- program pack art at full and small size.

**Protocol:** none.

**Save-compat risks:** `prefs` is additive. Sheet numbers are display-only.

**Cross-team:**
- ut: the `onPrefs` hook.
- players: card faces are theirs; we only use `UtCard`.
- shell: our new CSS files don't touch the `.ut-top` rules.

**Acceptance:**
- The odds tests pass in three sports.
- Every buyable item shows odds before purchase.
- QA is clean at both sizes.

---

### packs-5 (P0): Bad-luck protection

**Why:** the brief's P0 "Bad-luck protection" and research §8.4.

**Changes:**

1. **State** (`content-state.ts`, additive and normalised):
   ```ts
   stamps?: { n: number; earned: number; spent: number };     // balance and lifetime totals
   pity?: Record<string, number>;                             // '<promoId>@w<wave>' → program packs opened without a program card (keep the last 8 keys)
   prefs?: { skipBuyConfirm?: boolean };                      // (from packs-4)
   ```
2. **Earning** (`pull-log.ts recordPull`, which already runs exactly once per opening on the pre-deposit state):
   - `stamps += floor(nominalPrice / 100)`. `nominalPrice` is the price paid, or for an earned pack the store price of its kind (`packDefs` / `livePackDef`).
   - The Daily Drop, picks, the starter and `admin-*` award packs give **0**.
   - **+10 stamps** for each special card (Standout, program, Hot Season, Landmark, Legend) whose `line.id` the player already owned before this pack.
   - This needs no new call sites. Every opening path (`openNow`, `keep`, `registeredOpening`) already calls `recordPull`.
3. **Redemption** (`src/ut/stamps.ts`, new):
   - `STAMP_SHELF`:

     | Cost | Reward | Claim id |
     |---|---|---|
     | 50 | 1-of-3 82+ gold pick, drawn on G82 | `stamps:g82:<uuid>` |
     | 120 | Scout's Choice | `stamps:scout:<uuid>` |
     | 300 | Program Pick, 1 of 3 current program cards | `stamps:prog:<uuid>` |

     The Program Pick is offered only while a program is live, via `livePick`.
   - `redeemStamps(ut, pool, item, id, day, at)` debits the balance and calls `addPick` (or `livePick`) under the claim `stamps:<id>`. It is exactly-once and fails safely when the balance is short.
   - Store **STAMPS** section: the balance, a progress bar to the next shelf item ("38/50 to your next pick") and three tiles with REDEEM.
   - A `Store` prop `onRedeem(item)` and the `UltimateTeam` callback: a ~10-line hook following the `buyScout` pattern.
   - The odds sheet footer: "This pack adds 18 stamps."
4. **13th program pack** (`live-packs.ts`):
   - `pityKey(promoId, day)` = promo id plus the wave index released by `day`.
   - `openLivePack(pool, kind, rand, day, week, { force })` forces the program slot when `force` is set.
   - `programPityLeft(ut, pack, day)` = `13 − misses`.
   - The `UltimateTeam.buyLive` hook (~3 lines): `preset = openPack(pool, pack.id, undefined, week, { forceProgram: misses >= 12, avoid })`.
   - `recordPull` updates `pity`: it resets on any program card from a `live:` pack and otherwise increments.
   - The tile and sheet show "Program card guaranteed within N packs".

**Tests (`src/ut/stamps.test.ts`; NBA, NFL and soccer for stamps; NBA and NFL for pity):**
- Stamps are earned once per opening: a replayed pack id or a reloaded deposit earns 0.
- Zero for Daily, picks and the starter. Earned packs use their nominal price. The +10 duplicate bonus fires only for an already-owned special.
- Redeeming: balance −50 and exactly one pick sheet. A repeat with the same id is a no-op. A short balance returns `null`.
- Pity: a Monte Carlo of 100,000 program packs at 30% has max misses 12, and the 13th is always a program card.
  - The fraction of packs where the pity fired is 1.4% ± 0.2 (0.7^12).
  - The counter resets on a natural program card.
- Old-save test: a profile without `stamps` / `pity` loads and round-trips unchanged; with them, it round-trips through cloud capture and validation.

**Measurements:** the expected stamps per day for the casual and engaged players in the audit's economy section (≈650 and ≈1,300 coins a day plus earned packs). Days to each shelf item go in `packs.md`.

**Screenshots:**
- Store STAMPS section (NBA 393, soccer 320).
- A program tile showing "guaranteed within 3 packs".
- The redeem pick sheet.

**Protocol:** none.

**Save-compat risks:** additive fields only. Stamps start at 0 for everyone; no back-pay is computed from old logs, which keeps it simple and honest. Say so in `packs.md`.

**Cross-team:** ut gets the `buyLive` preset and `onRedeem` hooks. Optionally, ut can show the stamps balance in their hub.

**Acceptance:** the tests above pass, and QA redeems a pick end to end in NBA and soccer.

---

### packs-6 (P0): Ratings truth and the tier ladder

**Why:**
- Audit C3 (rarity inverted) and C4 (Hot Season cards lie).
- H7 (walls of 110s; the face design is players', the attribute generation is ours).
- L4 (soccer "Hot Season" 73–77).
- The brief's P0 items 3–4 and P1 "H7".

**Decision (no reductions to owned cards):** we fix "shown ≠ used" by making the **match use the card's own numbers**: raise the played attributes to support the displayed overall and face. We do **not** re-rate any owned edition's displayed overall downward.
- The audit's alternative, re-rating Hot Season to season +3..+6 with a cap of 95, would lower owned cards. It is listed for the lead's approval in §11 and not done.
- Displayed OVR, tier, `rawOvr` and numbered eligibility of every existing edition stay identical.

**Changes:**

1. **Hot Season / Legend, shown = used** (`rate.ts rateCard`, the `promo || legend` branch for NBA and NFL).
   - Today: `editionAttributes(attrs, boost, 99, false)`, then `faceLift = shownBase − round(shownFaceMean)`.
   - New: after `editionAttributes`, call `supportShown(sport, facePos, attrs, shownBase)` in `rating-quality.ts`. It raises the role's meaningful strengths (weights ≥ 0.075; never FT; physicals SPD/ACC/AGI/VRT at most +4) one step at a time, biggest-weight strengths first and proportionally to their current value, until `round(shownFaceMean(...)) ≥ shownBase − 1`. Cap 99.
   - Weaknesses (< 65) rise at most +2. `faceLift` then becomes ≤ 1.
   - Keep `baseOvr` / `rawOvr = cap(baseOvr + boost)` exactly as today, so the numbered catalog is unchanged.
   - Soccer is unchanged: its face *is* its attributes.
2. **GOAT / Spotlight shape** (H7, `rating-quality.ts supportEdition`).
   - Replace the round-robin +1 with a shape-keeping lift. The needed quality deficit is split across strong attributes in proportion to `(value − 60)^1.5`, capped at `limit`.
   - When an attribute would hit the cap, its overflow spreads to the next strengths.
   - Stop when `profileQuality + 8 ≥ minimum`. If more than 2 face-driving attributes would reach the cap, raise the next-ranked strengths instead (up to `limit − 1`).
   - `editionAttributes(special)` keeps its weakness rule.
   - The displayed OVR formula is unchanged. Test it against a snapshot.
3. **Tier ladder (C3).** Acquisition and price only; the server contract `SPOTLIGHT_RATES` is untouched (never deploy).
   - `PROMO_PREMIUM` 0.02 → **0.01**, `PROMO_GOLD` 0.005 → **0.002**. `LEGEND_PREMIUM` 0.0066 → **0.01**. Elite legend 0.01 (packs-2); Headliners 0.01; Vault 0.02.
   - **Spotlight pack:** price 3,500 → **15,000** in every sport, plus a weekly limit of 1 (`LIMITS.spotlight {per:'week', n:1}`).
     - Hook in `UltimateTeam.startPromo`: about 3 lines, checking `buysLeft` and calling `recordBuy` on reservation.
     - A pending reservation keeps the price it was reserved at.
   - **Weekly SBCs** (`sbc.ts WEEKLY`): templates that paid `card:{tier:'promo'}` ("Dynasty: …", "Hall of Fame Class", "Rival Dynasties", "Hot Season Hunt") now pay `standout: true` + a Premium pack, keeping list length and order.
   - **Monthly Legend SBC** (`content-sbc.ts`): `legend:<yyyy-mm>`, 11 cards (NFL 15, soccer 11), team OVR `fcToDisplay(84)`, 2 Standouts or better. Reward `{ pack: 'admin-icon' }`: the existing Icon Pack, which opens one random Legend, so no new reward type.
     - Done once a month via the claim `sbc:legend:<yyyy-mm>`.
     - Hook in `UltimateTeam.submitSbc`: 1 line, adding `'legend'` to the content-kind check. `Sbc.kind` gains `'legend'`.
   - **Soccer (L4):** promo editions below 80 are left out of `pool.buckets.promo` (`pool.ts poolBuilder`, ours), so they never come from packs, rewards or the market again. Owned copies still resolve via `base`.
4. **`CONTENT_PRINT` → `'ut-content-5'`** (`pool.ts`). `pool.print` changes anyway, because it hashes `rc.attrs`.

**Ladder model** (`scripts/packs/ladder.ts` + a test): the expected coins to own one card of each tier by its cheapest coin route, using the actual defs, odds, prices, limits and SBC fodder QS (fodder at its quick-sell value).

| Route | Inputs |
|---|---|
| Standout | the Standout Guarantee |
| Program | the guarantee |
| Legend | min(Elite, Vault, Legend SBC fodder) |
| Hot Season | min(Premium, Spotlight) |
| Finale | the SBC: a Legend + 6 program fodder |
| Spotlight | the pack |
| GOAT | the pack |

**Tests (`src/ut/ratings-truth.test.ts`; NBA and NFL; soccer for L4):**
- Every Hot Season and Legend edition at levels 1 and 5:
  - displayed `ovr`, `tier` and `rawOvr` are equal to a snapshot taken **before** the change;
  - each NFL face key satisfies `|face − round(toDisplay(attrs[key]))| ≤ 2`;
  - for NBA, each face category recomputed from `attrs` is within ±2 of the printed one;
  - `faceLift ≤ 1`.
- `scripts/build_numbered_catalog.ts --check` mode (added; it writes nothing): the generated `numbered-{nba,nfl}.json` is identical to the committed files.
- Every GOAT and Spotlight edition: `ovr` equal to the snapshot. Its six face values have ≥ 3 distinct values and ≤ 2 at the cap. The rank order of the six matches the base season card's (Kendall τ ≥ 0.8). If the base face spread is ≥ 10, the weakest face is ≤ strongest − 8.
- Ladder: E[standout] < E[program] < E[legend] < E[promo] ≤ E[finale] ≤ E[spotlight] < E[goat], in NBA and NFL. Soccer has no Spotlight/GOAT/Landmark/Finale, so it uses its subset.
- `economy.test.ts` legend cadence is updated to the new `LEGEND_PREMIUM` (about 1 in 100). Weekly SBCs keep their ids. Soccer buckets have no promo < 80, and owned soccer promos < 80 still resolve.

**Measurements:**
- `scripts/packs/promoattrs.ts` before and after: for every Hot Season/Legend, the worst face − played gap. Before: Ferguson 99 vs 79. Target ≤ 2.
- GOATs at the cap: Brady 5/6 → ≤ 2/6.
- The ladder table before and after, in coins, NBA and NFL.
- The `rate.test.ts` / `ratings-audit.test.ts` deltas, explained.

**Screenshots:** card detail for Brady GOAT and Kareem GOAT (shared `CardDetail`), and Ferguson Hot Season, NBA/NFL 393. Before and after go side by side in `packs.md`.

**Protocol:** **Protocol bump needed: NBA UT and NFL UT**, because Hot Season, Legend, Spotlight and GOAT played attributes change. `pool.print` changes and `CONTENT_PRINT` is `ut-content-5`. Draft queues are unaffected (draft never uses UT editions). Soccer UT is not bumped by this task.

**Save-compat risks:**
- Owned cards keep ids, displayed OVR, tier, level, XP and serials. They now *play* at their printed numbers.
- SBC `teamOvr` uses displayed OVR (unchanged), and numbered eligibility is unchanged (tested).
- Spotlight price: reservations keep their price.
- Weekly SBC reward text changes mid-week for SBCs not yet done. Claims are by id.

**Cross-team:**
- **lead:** the bump.
- **nba and nfl teams:** UT squads built from these editions get stronger attributes. Their `ratings-matter` tests use draft ratings and should be unaffected. Tell them through `packs.md`.
- **players:** GOAT faces now vary; their face design shows a 99+ badge if they choose.
- **ut:** the 3 small hooks. Suggestion only: the Circuit 6-win weekly Spotlight pack becomes a Program Pick (research §8.9), which keeps the Spotlight route priced.

**Acceptance:**
- The tests above pass in NBA and NFL; the soccer bucket test passes.
- The numbered-catalog check is identical.
- The ladder is monotone.
- `packs.md` carries the bump line.

---

### packs-7 (P1): Promo content and the soccer Live Calendar

**Why:** audit H8, M3, H9 (reason line) and H7 (soccer calendar); the brief's P1 "Promo cadence", "Promo sets" and "Soccer gets a calendar"; research §8.5.

**Changes:**

1. **Season caps** (`calendar.ts`).
   - `seasonCap(promo)` by the cycle-relative season number `raw.n`:

     | Season | 1–2 | 3 | 4 | 5–7 | 8 | 9–12 |
     |---|---|---|---|---|---|---|
     | Cap | 94 | 95 | 97 | 96 | 97 (Finale 99) | 97 |

   - `live-cards.ts rateLive` uses `top = finale ? 99 : min(PROGRAM_CAP, seasonCap(promo))`. `PROGRAM_CAP` stays 97.
   - Started promos are all below these caps; the test proves no started card moves.
2. **Headliners and spread** (`src/data/live-calendar.json`, only promos with `start >= PROMO_EDIT_FROM`).
   - Widen `ovrBand` so the delta decides the OVR: `lo = hi − 6`.
   - Add `featured: { count: 1 (count < 12) or 2, band: [min(hi + 2, cap), min(hi + 4, cap)] }` where it is missing.
   - Bump `version` → `pool.print` changes (documented).
3. **Repeat caps** (`live-cards.ts selectPromo`).
   - Build a cycle-wide usage map from every promo of the same cycle that starts earlier, frozen selections included.
   - In the strict pass, skip a candidate whose (pid, season) already has 2 program editions this cycle, or whose pid already has 4.
   - The relaxed pass still fills a short promo, logged in the freeze script output.
4. **Fresh second cycle.**
   - The seeded order uses `'live:' + sport + ':' + promo.id + ':' + wi`. That is `promo.id`, which carries `-y2`; it was `baseId`.
   - `excludePrevious` applies to every promo from cycle 1: drop the pids the same `baseId` selected in the previous cycle. The flag exists in the type but nothing reads it.
5. **Re-freeze future promos** (`scripts/freeze_live_editions.ts`).
   - New flag `--refreeze-from <date>` rewrites only promos with `start >= date`. It refuses any earlier one, and it refuses if any rewritten promo has already started on the machine's date.
   - `--check` still verifies.
   - Run it with `PROMO_EDIT_FROM`, then update `live-editions.json`.
6. **Released-wave rewards (M3)** (`live-cards.ts programReward`): use `promoCards(pool, promoId, day)` (released waves only). With nothing released, fall back to the featured card of wave 1.
7. **Standout reason lines (H9, light).**
   - `standouts.ts standoutReason(line): string`, built from honors and ranks, for example:
     - "MVP · 1st in scoring (30.1 PPG)"
     - "All-Pro 1st team · 1,512 rec yds"
     - soccer: "Golden Boot · 27 goals"
     - fallback: the best stat line
   - Shown in `StandoutsView.tsx`, on the walkout stamp (packs-9) and in the Program Hub (packs-8).
   - Exported for players' card back.
   - The selection is unchanged.
8. **Soccer Live Calendar.**
   - New `src/data/live-calendar-soccer.json` (same schema) and `src/data/live-editions-soccer.json`.
   - `calendar.ts loadSchedule` imports the soccer files when `SPORT === 'soccer'`, inside the lazy soccer chunk. The NBA/NFL files and their `version` are untouched by this step.
   - Fixes:
     - `per()` must detect `soccer` keys (today it checks only `nba` / `nfl`);
     - `shiftWaves` must keep `soccer` waves;
     - `parseLiveId` must accept `soccer`;
     - `LIVE_SHAPE` / `PRICE_FACTOR` soccer entries already exist.
   - 12 seasons, Monday-aligned, from 2026-11-23 (cycle and `-y` logic as NBA/NFL). Original program names from research §8.5:

     | Program | When | Rule |
     |---|---|---|
     | Golden Boot Race | Nov | `honor:BOOT \| stat:g>=20` |
     | Winter Fixtures | late Dec | seeded |
     | Midseason XI | Jan; the Hot Season equivalent, cap 97 | `honor:POTY\|UEFA\|BDOR` |
     | Wonderkids | Feb | `careerYear:1-2` |
     | Knockout Nights | Mar | `honor:UCL` |
     | Title Run | Apr | `honor:CHAMP` |
     | Season XI | May–Jun | 5 league waves, top by base per league |
     | Summer Tournament | Jun–Jul | seeded |
     | Opening Day | Aug–Sep | `career:first` |
     | Derby Days | Oct | `{pair}` same club |

     Each has program packs and guarantees, 1–2 program SBCs and a program pick. No Landmarks, no Finale; soccer's cap is 97.
   - **Matchday Standouts:** soccer's weekly Standouts (already 11) are labelled "Matchday Standouts" via `pickFor` in `StandoutsView.tsx`, `standoutSbc` and the walkout stamp. Ids are unchanged.
   - Rules use only fields the soccer cards have: `honors` CHAMP UCL BOOT ASSIST BDOR UEFA POTY, `stats` g a cs apps, `fr`, `league`, `pos`, `career*`. Check coverage in `docs/SOCCER-DATA.md`.

**Tests (`calendar.test.ts` extended, plus `soccer-calendar.test.ts`):**
- A golden hash of every promo and manifest entry with `start < PROMO_EDIT_FROM` is unchanged. Every owned-possible card id of started promos rates to the same ovr, attrs and face as before (snapshot).
- Every rated program card is ≤ `seasonCap`; the Finale is 98–99.
- Promos from the cutoff with count ≥ 8 have ≥ 3 distinct OVRs. Those with count ≥ 6 have ≥ 1 featured card.
- Across the cutoff cycle and cycle 2: (pid, season) ≤ 2 and pid ≤ 4. Before: MJ '88 ×8, LeBron ×14.
- Cycle-2 promos share ≤ 20% of pids with their cycle-1 base.
- `programReward` never returns an unreleased card over 200 random days.
- Soccer: the schedule loads only in soccer, every rule compiles, every promo selects ≥ 90% of its count, packs open, SBCs list, and `sport-branches` is clean.
- `freeze_live_editions --check` passes for both files.

**Measurements:** `scripts/packs/promos.ts` before and after:
- per-promo OVR spread (distinct values, min–max);
- headliner presence;
- the top-10 repeated players per sport.

**Screenshots:**
- StandoutsView with reason lines (NBA, soccer "Matchday Standouts").
- Soccer This Season Store row (clock 2026-11-27).
- The soccer program SBC.

**Protocol:**
- **Protocol bump needed: soccer UT.** New soccer program editions enter the pool, and `pool.print` changes via the soccer schedule version.
- NBA/NFL: `pool.print` changes via the schedule `version`. Future-promo ratings change, but no released card's rating changes. The rules version is the lead's call (the print alone separates the queues).

**Save-compat risks:**
- Started promos are pinned by test.
- Soccer has no prior calendar state.
- Program card ids are stable and re-derivable.
- `-y2` ids are not yet live (2027-11+).

**Cross-team:**
- ut: show the This Season banner in soccer; it is hidden today.
- players: the program frame per accent; `standoutReason` on the card back.

**Acceptance:** the tests above pass in NBA, NFL and soccer, and the freeze check is green.

---

### packs-8 (P1): Promo presence and calendar loops

**Why:**
- Audit H6 (no hub, no launch moment) and H7 (check-in, Season Path).
- The brief's P1 "launch moment (banner, takeover, countdown) and a Program Hub page … Hook into the ut team's hub through a small exported API" and "Live Calendar: finish the half-built parts".
- Research §8.12 (Program Hub).

**Changes:**

1. **`src/ut/promo-hub.ts` (new): the API for ut.** Write the contract into `packs.md`.
   ```ts
   export interface LiveDrop {
     id: string;                                   // 'drop:<promoId>:w<i>' | 'standouts:<week>' | 'flash:<window>' | 'checkin:<season>'
     kind: 'program' | 'wave' | 'standouts' | 'landmark' | 'flash' | 'checkin' | 'path';
     title: string; subtitle?: string;
     accent: [string, string];
     start: number; end: number;                   // ms
     band?: [number, number];
     heroCardId?: string;                          // the featured/headliner card
     progress?: { have: number; need: number };    // released cards, stamps, path goals
     isNew: boolean;                               // first 48 h
     boosted?: { until: number };
     cta: { view: 'program' | 'store' | 'standouts' | 'sbc'; arg?: string };
   }
   export function liveNow(pool: Pool, ut: UtState, at: number): LiveDrop[];            // soonest-ending first
   export function upcomingDrops(sport: UtSport, at: number, n?: number): { id: string; title: string; start: number; band: [number, number]; needs?: string }[];
   export function launchDue(pool: Pool, ut: UtState, at: number): LiveDrop | null;     // first unseen wave start (≤ 7 days old)
   export function markLaunchSeen(ut: UtState, id: string): UtState;                    // ut.content.seenDrops
   export function calendarClaimables(pool: Pool, ut: UtState, day: string): { id: string; label: string; coins: number; pack?: string }[];
   export function claimCalendar(p: Profile, pool: Pool, id: string, day: string, at: number): Profile; // exactly once
   export function calendarPassExtras(day: string, levels: number): Record<number, { coins?: number; pack?: string }>; // for ut's Season Pass
   ```
2. **Calendar loops (`src/ut/calendar-progress.ts`, new).** The data is already in `live-calendar.json defaults`.
   - **Check-in.** The stamp count is the number of distinct ET days in `[season.start, min(day, season.end)]` with `ut.hq.days[d].games ≥ 1`, capped at 10. It is derived from existing hq data, so there are no new writes until a claim.
     - Stamp `n` pays `defaults.checkIn.stamps[n−1].reward` (`resolvePackKind`) under the claim `cal:checkin:<seasonId>:<n>`.
     - A pack lands as `PendingPack { id: 'cal:checkin:<seasonId>:<n>' }`. That kind is always an existing kind.
   - **Season Path.** `path-play` / `path-win` / `path-build` sum `games` / `wins` / `sbcs` over the season's `hq.days`.
     - `path-program` counts wins with ≥ 3 current-program cards in the squad.
     - It is recorded by extending `content-progress.ts recordStandoutWin` (already called by `Match.tsx` with `cardIds`; no new hook) into a new additive `ut.content.progWins { season, ids[] }` (cap 50).
     - Claims: `cal:path:<seasonId>:<pathId>`.
   - **Soccer** gets check-in and path once its schedule exists (packs-7).
3. **`ProgramHub.tsx` + `program-hub.css` (new), view `program` with arg promo id.** From top to bottom:
   - **Hero:** the headliner card (`UtCard` w = 190), the promo name with the wave label, a band chip, and a countdown to the next wave or the end.
   - **Waves:** released cards in a grid (tap opens the card detail). Future waves show as locked silhouettes, in the program's accent at 40%, with a countdown. Players are never revealed early.
   - **Packs:** program pack and guarantee tiles with art, BOOSTED, odds chip and the pity counter (packs-5), plus BUY via the Store callbacks.
   - **SBCs:** this promo's season SBCs, with the reward card face.
   - **Season check-in:** a 10-stamp card.
   - **Season Path:** 4 goals with bars and CLAIM.
   - **Objectives:** an optional `objectives?: ReactNode` slot for ut's program objective group.
   - Taps ≥ 44 and reduced motion are respected.
4. **Launch takeover: `PromoLaunch.tsx` (new).**
   - A full-screen modal over UT on the first UT open after a wave starts (`launchDue`).
   - It shows the accent gradient, "<PROGRAM> · WAVE 2 IS LIVE", 3 face-down cards that flip to the released headliner, the countdown, SEE THE PROGRAM (→ the hub) and LATER.
   - It shows once per drop id (`ut.content.seenDrops`, additive, cap 200).
   - Reduced motion: static, no flips. Focus trap and Escape.
5. **Hooks** (ut-owned, ~20 lines total, listed):
   - `UtView` gains `'program'`.
   - `nav.ts` gains `program: { title: 'Program', tab: 'store', parent: 'store' }`.
   - `UltimateTeam` renders `<ProgramHub>` with existing buy/inspect callbacks and mounts `<PromoLaunch>` when `launchDue` is set.
   - A `claimCalendar` callback.
   - Store hero and This Season tiles link to the hub (ours).

**Tests (`src/ut/promo-hub.test.ts`, NBA, NFL and soccer):**
- `liveNow` on 2026-11-14 (first-tip live) and 2027-01-16 (Honors) lists the right drops with ends ≥ now. It never includes an unreleased card id.
- `launchDue` returns each wave once, and null after `markLaunchSeen`.
- Check-in: 0 stamps with no games, 3 after games on 3 distinct days. Days outside the season don't count. Each stamp is claimable once, and a pack id is never reused.
- Path counters come from `hq.days`. `progWins` counts a match id once.
- `claimCalendar` round-trip: the coins added once; a repeat is a no-op.
- Old-save test with and without `seenDrops` / `progWins`.

**Measurements (Playwright):** with the clock at 2026-11-14 19:00 ET and 2027-01-16 (NBA, NFL) and a soccer date after 2026-11-23:
- the takeover appears once and not after reload;
- the hub renders with 0 page errors, no target < 44 and no overflow at 393 and 320;
- the time from UT open to the takeover is < 500 ms after the pool is ready.

**Screenshots:** the takeover (wave 1 and wave 2), the hub top and bottom, check-in with 3 stamps, Season Path; NBA, NFL and soccer at 393 and 320.

**Protocol:** none.

**Save-compat risks:**
- Additive `seenDrops` and `progWins`.
- New claim id families `cal:checkin:*` and `cal:path:*`. Claims are capped at 5,000; a season adds ≤ 14.
- Packs land as ordinary pending packs of existing kinds.

**Cross-team (ut):**
- consume `liveNow` / `upcomingDrops` in the Hub (Live Now carousel, Upcoming strip, next-best-action #6 "new program wave");
- add `calendarClaimables` to the inbox and CLAIM ALL;
- wire `calendarPassExtras` into their Season Pass (`progression.ts` is theirs);
- pass their program objective group into `objectives`.

If ut doesn't wire the inbox or the pass, the hub's own CLAIM buttons still work; record anything unwired in `packs.md`.

**Acceptance:** the tests above pass, the browser QA passes, and the contract is in `packs.md`.

---

### packs-9 (P1): Pack opening that hits

**Why:** the brief's P1 "Pack opening that hits", "Multiple walkouts" and "M2"; audit H6 (walkout and heading), M1 and H9 (Standout walkout), and UT-UI M2/M6; research §8.11.

**Changes:**

1. **Cinema levels** (`packs.ts`, `pack-sequence.ts`).
   - `cinemaLevel(cards)`, decided from the already-awarded best card, so it is truthful by construction:

     | Level | When |
     |---|---|
     | 0 | best < 80 and no special |
     | 1 | best 80–84 |
     | 2 | best ≥ 85, or any program, or a Standout ≥ 86 or featured |
     | 3 | Legend, Hot Season, Landmark, Spotlight |
     | 4 | GOAT |

   - `walkoutLevel(rc)` follows the same rule per card. A Standout under 86 that isn't featured is now level 1, a "promo flash" without a full walkout.
   - `packSequence(level)` returns:

     | Level | Beats | Total to Continue |
     |---|---|---|
     | 0 | tear 450, fan-out flips at a 70 ms stagger | ≈ 1.2 s |
     | 1 | tear 600, teal flare 300, position 450, team 700, card slam | ≈ 2.6 s |
     | 2 | tear 680, flare within the first 400 ms, era, position, crest, OVR count-up (60 ms/pt over the last 6), walk-in, card | ≈ 4.2 s |
     | 3 | as level 2 with a white flare and an extra crest beat | ≈ 5.0 s |
     | 4 (GOAT) | unchanged | 6.6 s |

   - `pack-sequence.test.ts` is updated.
2. **Flares.** `flareFor(rc)` gives the colour:

   | Card | Flare |
   |---|---|
   | gold 85–89 | gold |
   | 80–84 | teal |
   | program | the promo accent |
   | Landmark | sepia |
   | Hot Season | ember |
   | Legend | white |
   | Spotlight | prismatic |
   | GOAT | black-gold |
   | holo | plus a rainbow edge (L5) |

   - It shows by 1.0 s after the tear starts. When ≥ 2 cards are level ≥ 2, show **two** flares (FUT's double-walkout cue). A single special never shows two.
3. **Multiple walkouts.**
   - Every level ≥ 2 card gets its own walkout, in ascending order with the best last.
   - Each has SKIP (to the next) and SKIP ALL (to the grid).
   - The `Opening` → `PackOpening` sequence is driven by a queue in component state.
4. **Order (research §8.11).**
   - Packs of ≤ 8 cards: the grid reveals in ascending order, with the walkout card(s) last.
   - Packs of ≥ 9 (NFL, Jumbo): walkouts first, then the grid sorted by OVR descending, with Pack Helper tags.
5. **Program walkout (H6).**
   - The stamp reads `<PROMO NAME> · <wave label>` (from `line.label` / promo waves) on the promo's accent scenery: the `ut-prog-scenery` class in `pack-cinema.css`, built on the Standout pulse template.
   - The tier word shows the promo name, never "PROGRAM".
   - The Standout stamp shows `standoutReason` (packs-7). Soccer reads "MATCHDAY STANDOUT".
6. **Headline.** `revealHeadline(cards)` counts every tier: "12 cards · 1 Program · 3 rare golds · 8 golds". It adds the best card ("Best: 97 Name") and the total QS value.
7. **Post-open management (M2).**
   - Tapping a grid card opens a small action sheet:
     - VIEW: opens the card detail.
     - QUICK SELL +N: two-step for specials, 90+ or numbered cards, and never for locked cards.
     - STORE or SEND TO CLUB, for duplicates.
   - The bulk bar offers QUICK SELL ALL UNDER [75 | 80 | 82]. It never touches specials, locked, new-to-club or squad-upgrade cards, and confirms showing the total.
   - The existing QUICK SELL DUPES stays, raised to ≥ 44 px.
8. **Follow-ups (M1).**
   - OPEN NEXT (n left), when other openable pending packs exist.
   - BUY AGAIN, for store packs, disabled when short or at the limit, with the price.
   - SKIP, TAP TO CONTINUE and every button ≥ 44 × 44 design px.
9. **Open all.**
   - The Store "Your packs" gets OPEN ALL (n), for local packs only: never registered Spotlight/GOAT, picks or the starter.
   - `openMany(pool, ut, ids, at)` (new, `src/ut/open-many.ts`) returns per-pack cards and a single state transform.
     - It calls `recordPull` per pack (stamps and pity follow) and deposits each pack's copies under `pack:<id>:<i>` uids.
     - It removes those pending packs, exactly once.
   - One cinema plays for the best card across all packs, then a combined grid grouped by pack.
10. **Hooks** (`UltimateTeam`, ~25 lines): `PackOpening` props `onSell(uids)` (the existing `quickSell`), `onView(uid)` (`setDetail`), `onStore(uid)` / `onToClub(uid)` (existing `storage.ts` functions), `onNext()`, `onBuyAgain()` and `onOpenAll(ids)`.
11. **Reduced motion.** A static card with its coloured edge, the OVR shown at once and the grid immediately. No flares animate.
12. **Sound and haptics.** Existing `packSound` cues with pitch by level, a tick per flip, `vibrate` light at level ≥ 1 and heavier at level ≥ 2. Nothing plays when sound is off.

**Tests:**
- `pack-cinema.test.ts` (new): `cinemaLevel` and `walkoutLevel` tables, including the 82 Standout → 1 and the featured Standout → 2.
- `flareFor` is monotone in tier, and two flares appear only when ≥ 2 cards are level ≥ 2.
- `revealHeadline` cases.
- The order rules for 5-, 8-, 12- and 16-card packs.
- `open-many.test.ts`: each pending pack is logged once and deposited once. A replay is a no-op, registered and pick packs are excluded, and stamps and pity update per pack.

**Measurements (Playwright, NBA, NFL and soccer, 393 and 320).** Use fixture pending packs: `admin-card:` for a single Legend, Standout 82, Standout 86 and a program card, and `studio:` recipes for multi-special packs.
- Time from the tap to Continue per level, from the DOM `data-phase` timestamps. Targets 1.2 / 2.6 / 4.2 / 5.0 / 6.6 s, each ±15%.
- The flare class appears ≤ 1.0 s after the tear.
- SKIP responds in ≤ 100 ms in every phase.
- With 2 specials there are 2 walkouts and 2 flares.
- Reduced motion: the grid is visible ≤ 300 ms after the tap.
- Every target ≥ 44, 0 page errors, and Open all of 3 pending packs produces 3 Pack Tracker entries.

**Screenshots:**
- Each level mid-flare and at the card.
- A double walkout and the program walkout stamp.
- A Matchday Standout (soccer).
- The grid with the action sheet and the bulk bar.
- OPEN NEXT / BUY AGAIN; the reduced-motion grid.
- NBA, NFL and soccer at 393 and 320.

**Protocol:** none (presentation; QS uses the existing path).

**Save-compat risks:**
- Selling from the reveal goes through the existing `quickSell` / `removeCards`, so retirements of numbered cards queue as today.
- `openMany` keeps the uid format and the exactly-once guards.

**Cross-team:**
- ut: hooks.
- players: card faces and `GoatCrown`, unchanged in use.
- shell: owns the `styles.css` small-target rules for pack screens. Our new pack CSS sets sizes in our files; tell shell in `packs.md` to avoid double rules.

**Acceptance:** the tests above pass, the browser measurements are within target, the screenshots are reviewed, and reduced motion is verified.

---

### packs-10 (P1): SBC long page, then final QA and docs

**Why:** UT-UI M4 (SBCs 5.7–6.7 screens) and the brief's "Long pages (M4) for … SBC: … SBC reward card faces shown, and '1 card away' states". Plus BUILD-RULES' final QA task.

**Changes:**

1. **SBC page (`Challenges.tsx` + new `sbc-page.css`).**
   - **Category tiles at the top:** This Season, Standouts & Landmarks, Legend (monthly), Daily, This Week, Upgrades. Each shows its count, NEW (unseen), an amber "ends in < 24 h" marker and a DONE count.
   - Tapping a tile scrolls to its section. Sticky chips mirror the tiles.
   - Sections other than This Season and Daily start collapsed, with a "Show 6" row.
   - **Reward previews:** a `cardId` / `program` / `standout` / Legend reward shows the actual card face (`UtCard` w = 56, the featured card for `standout`/`program`). Packs show `PackArt` small. Coins show a coin chip.
   - **"1 card away":** `nearlyDone(s, club)` in `sbc.ts`, true when `autoFill` succeeds for `size − 1` cards under every per-card requirement. Tiles show the chip, and the page lists a "Ready / 1 card away" row first.
2. **Final QA.**
   - `bash O/heavy.sh npm run typecheck`, then `bash O/heavy.sh npm test` (all three sports), then `bash O/heavy.sh npm run build` once.
   - `scripts/packs/qa-packs.mjs` (new, from the audit harness) walks Store → odds → confirm → open (levels 0–3 via fixtures) → management → Program Hub → takeover → stamps redeem → SBC page → submit with warning.
     - Sports: NBA, NFL, soccer. Sizes: 393×852 (59/34) and 320×568.
     - Checks: 0 page errors, 0 targets < 44, 0 text < 10, no overflow, and no request to a non-localhost host except fonts.
   - Re-run `packsim`, `promos`, `promoattrs` and `ladder` with `PACKSIM_LABEL=final`.
3. **Docs.**
   - Finish `docs/studio-overhaul/packs.md` with:
     - before/after tables;
     - tests added;
     - Protocol bump lines;
     - touched outside my lane;
     - owner device checks;
     - the promo-hub API contract;
     - what is left undone.
   - Update `docs/PACK-CINEMA.md`, `docs/PULL-TRACKER.md` (stamps and pity) and `docs/UT-CONTENT-2.md` (an addendum: new tiers, curve, odds, calendar).

**Tests:**
- `sbc-page.test.ts`: `nearlyDone` true and false fixtures. Category counts equal the list.
- The full suite is green.

**Measurements:**
- SBC page length on open: 393 ≤ 2.5 screens (from 5.7), 320 ≤ 3.0 (from 6.7). Every SBC is reachable in ≤ 2 taps from the top.
- The final packsim / ladder tables against the targets in §0 and §2.

**Screenshots:** the SBC page top, a reward face, a "1 card away" chip and an expanded section; NBA, NFL and soccer at 393 and 320. Plus the full walk set in `O/shots/packs/final/`.

**Protocol:** none (consolidates earlier lines).

**Save-compat risks:** none (UI). The QA verifies the fixture's coins and owned copies are unchanged after a no-op reload.

**Cross-team:** ut owns the shared `Sheet` / `ui.tsx` styles, which we only use.

**Acceptance:** the full `npm test` passes, the build passes, QA is clean in 3 sports × 2 sizes, and `packs.md` is complete and pushed.

---

## 5. New saved state (all optional under `ut.content`; normalised in `content-state.ts`)

| Field | Shape | Task | Old saves |
|---|---|---|---|
| `preview.wk` | `string` (ISO week) | packs-3 | absent → set on first read |
| `prefs` | `{ skipBuyConfirm?: boolean }` | packs-4 | absent → confirm shown |
| `stamps` | `{ n, earned, spent }` | packs-5 | absent → 0 |
| `pity` | `Record<'<promo>@w<i>', number>` (last 8 keys) | packs-5 | absent → 0 |
| `seenDrops` | `string[]` (cap 200) | packs-8 | absent → takeover once per live wave |
| `progWins` | `{ season: string; ids: string[] }` (cap 50) | packs-8 | absent → 0 |

**New claim-id families** (in the existing `claims` list; never re-used):
- `stamps:<item>:<uuid>`
- `sbc:legend:<yyyy-mm>`
- `cal:checkin:<seasonId>:<n>`
- `cal:path:<seasonId>:<pathId>`

**New buy-limit keys** (in the existing `buys`):
- `headliners:<day>`, `vault:<week>`, `spotlight:<week>`
- `roster:<day>`, `captains:<day>`, `dynasty:<week>`

**New pending-pack ids:** `cal:checkin:<seasonId>:<n>` and `cal:path:<seasonId>:<pathId>`. Kinds are always existing kinds.

No storage key, card/edition/copy id, uid format or existing field meaning changes.

## 6. Contracts and hand-offs

- **To ut:**
  - `promo-hub.ts` (packs-8) and `stamps.ts` balance (`contentOf(ut).stamps?.n`).
  - Hooks we add to `UltimateTeam.tsx` and `nav.ts`, each listed with its hunk in `packs.md`:

    | Task | Hook |
    |---|---|
    | packs-2 | `LIMITED_PACKS`, `avoid` |
    | packs-3 | preview toast, studio routed through limits |
    | packs-4 | `onPrefs` |
    | packs-5 | `buyLive` preset, `onRedeem` |
    | packs-6 | `startPromo` limit, `'legend'` content kind |
    | packs-8 | the program view, launch mount, claim callback |
    | packs-9 | `PackOpening` props, open all |

  - Suggestions for ut's own work:
    - the Circuit 6-0 reward → Program Pick (ladder);
    - unhide This Season for soccer;
    - their objective group fills the Program Hub `objectives` slot;
    - `labels.ts` names for "Hot Season", "Weekly Standouts" / "Matchday Standouts" and "Program": we route our new strings through it once it exists.
- **To players:**
  - holo Regular (≤ 87) / Pristine (88+) looks on `CardArt`;
  - per-program frame accents (`line.accent`);
  - `standoutReason(line)` for the card back;
  - GOAT faces now vary (their 99+ badge choice).
- **To shell:**
  - our pack CSS sets the pack-screen target sizes, so avoid duplicate rules in `styles.css`;
  - we read pool buckets but do not change loading.
- **To nba / nfl:** UT Hot Season, Legend, Spotlight and GOAT play at their printed numbers after packs-6. Re-check any UT-squad balance numbers you report.
- **To the lead:** the protocol bumps (§7), `PROMO_EDIT_FROM`, and the decisions in §11.

## 7. Protocol summary (copy into `packs.md` as the tasks land)

- **Protocol bump needed: NBA UT and NFL UT** (packs-6). Hot Season, Legend, Spotlight and GOAT played attributes change (shown = used; GOAT/Spotlight shape). `CONTENT_PRINT` → `ut-content-5`; `pool.print` changes.
- **Protocol bump needed: soccer UT** (packs-7). New soccer program editions enter the pool, and `pool.print` changes via the soccer schedule.
- NBA/NFL `pool.print` also changes in packs-7 (future-promo bands and selection, schedule `version`). No released card's rating changes. This rides on the packs-6 bump.
- No draft protocol change.
- Packs-1, 2, 3, 4, 5, 8, 9 and 10 change no match rule or rating.

## 8. Scope mapping (nothing silently dropped)

**STREAM-packs brief → task**

| Brief item | Task |
|---|---|
| P0.1 Spotlight/GOAT QS, auto-fill, confirm warning, tests | packs-1 |
| P0.2 Market Hot Season | packs-3 |
| P0.3 Rarity against rating; Spotlight 20%; finale over a routine pack | packs-6, with prices and limits from packs-3 |
| P0.4 Hot Season shown vs used ("Protocol bump needed") | packs-6 |
| P0.5 Preview exploit, admin packs, program pack pricing | packs-3 |
| P0.6 Soccer NFL SBCs and guard | packs-1 |
| P0 gold OVR curve with packsim before/after | packs-2 |
| P0 guarantees as floors; rare = shimmer | packs-2 |
| P0 odds sheets, Scout fix, View Odds before purchase, test against simulation | packs-4 |
| P0 Scout Stamps and 13th-pack guarantee | packs-5 |
| P0 Program Bag (optional) | **deferred** (§9) |
| P1 promo cadence: two Friday waves, weekly in-forms | packs-7 (data), packs-3 (Friday boost) |
| P1 launch moment and Program Hub; API for ut | packs-8 |
| P1 program walkout name; headline counts the whole pack; no full walkout for an 82 Standout | packs-9 |
| P1 promo sets: spread, repeats, season caps; owned ids kept | packs-7 |
| P1 H7 walls of 110s | packs-6 |
| P1 Live Calendar: check-in, Season Path, flash windows | packs-8, packs-8, packs-3 |
| P1 Live Calendar: extra pass tiers | packs-8 API; ut wires it |
| P1 soccer calendar, Matchday Standouts, program names | packs-7 |
| P1 three cinema levels, first-second colour, two flares, best last, truthful cues, Skip / Open all, reduced motion | packs-9 |
| P1 multiple walkouts | packs-9 |
| P1 M2 management after opening | packs-9 |
| P1 long pages for Store | packs-4 |
| P1 long pages for SBC | packs-10 |
| Owner device checks | §10 |

**Audit (packs/promos) findings → task**

| Findings | Task |
|---|---|
| C1, H4 | packs-1 |
| C2, H1, H2, H3, M2, M5 | packs-3 |
| C3, C4, L4 | packs-6 |
| H5, M4 (purchase confirm), M6, M8, L1, L2 | packs-4 |
| H6 | packs-4 (pack art), packs-8 (hub and takeover), packs-9 (walkout and heading) |
| H7 | packs-3 (flash), packs-7 (soccer), packs-8 (check-in, path, pass API) |
| H8, M3 | packs-7 |
| H9 | packs-9 (walkout threshold), packs-7 (reason line); themed selection deferred |
| M1, L5 | packs-9 |
| M7 | packs-2 (chase avoid) and packs-5 (dupe stamps); 3× QS auto-swap deferred |
| M9 | ut, via `calendarPassExtras` |
| M10 | deferred (§9) |
| L3 | QA rules in every task |

**UT-UI audit:** M2 → packs-9. H7 → packs-6. M4 (Store, SBC) → packs-4, packs-10. M6 (pack-screen targets) → packs-9.

**Research items:**

| Research | Task |
|---|---|
| §8.1 | packs-2 |
| §8.2 tiers, boost, holo | packs-2, packs-3 |
| §8.3 | packs-4 |
| §8.4 | packs-5 (bag deferred) |
| §8.5 caps and soccer | packs-7 |
| §8.5 Momentum | deferred |
| §8.5 rhythm | flash in packs-3; Wednesday deferred |
| §8.8 Legend SBC and confirm copy | packs-6, packs-1 |
| §8.11 | packs-9 |
| §8.12 Store layout and Program Hub | packs-4, packs-8 |
| §8.12 Hub | ut |

## 9. Deferred, with reasons

1. **Program Bag** (optional in the brief). Its keys come from ut's program objective group and weekly 6/6 chest, which don't exist yet. Scout Stamps and the 13th-pack guarantee already cap bad luck. Revisit after integration.
2. **Legend base / mid / prime versions** (audit C3 suggestion). This needs new card lines from the data build scripts, which our brief doesn't authorise. The ladder is fixed through acquisition and price instead.
3. **Re-rating Hot Season down to season +3..+6** (audit C3/C4 option). It would lower owned cards' displayed ratings, which needs the lead's approval. We fix truth by "used = shown" instead (packs-6).
4. **Spotlight/GOAT chase odds** (`SPOTLIGHT_RATES`). These are a shared server contract and we never deploy. Only price and the weekly limit change.
5. **Themed Standout selection** ("this week in history"). There is no game-level data, and changing the current weeks' selection risks mid-week reshuffles. Reason lines ship instead (packs-7).
6. **Standouts dropping Wednesday instead of Monday** (M10). The ISO week is part of Standout ids and of claim and limit keys used across ut-owned modules, so a shift risks double or missed drops. Keep Monday, and fix the calendar's rhythm text to match.
7. **Momentum cards** (research §8.5). Per-copy upgrade rules belong with ut's Evolutions and need a protocol bump; outside our stream.
8. **New SBC families** (Foundations, Rivalry Puzzles, Flash SBCs; research §8.8). Not in the stream scope. Only the monthly Legend SBC ships (needed for the ladder).
9. **Duplicate → 3× QS auto-swap for specials** (M7 second half). The +10 duplicate stamps (packs-5) cover the same pain without new sell paths.
10. **Holo Regular/Pristine looks and the card-back reason line.** These are card faces, owned by players. We supply the data.
11. **Global Lightning stock.** This needs a server. Per-player limits stay.
12. **Season Pass themed tiers** (M9). `progression.ts` is ut's. We provide `calendarPassExtras` and the season data.
13. **Share poster from the reveal** (UT-UI M2 idea). `poster.ts` is players'; optional polish.

## 10. Owner device checks (only a real iPhone can confirm)

- Pack-opening feel and length at each level, haptics on levels 1–2, and that SKIP and SKIP ALL feel instant.
- Odds sheets readable at arm's length: band rows and the PER CARD toggle.
- The launch takeover appears once per wave, and its countdown is correct in Eastern time.
- The Store sticky chips scroll smoothly; the featured hero pack art looks premium.
- The Hot Season and GOAT card details now read as legit: varied faces, numbers that match play.

## 11. Open decisions for the lead (flagged, not acted on)

1. **Spotlight pack price and limit.** The plan has 3,500 → 15,000 coins, 1 per week, so the 100–105 tier is rarer than Hot Season and the Finale. This is visible to players; the lead or owner may prefer 12,000. The ladder test decides the minimum.
2. **`PROMO_EDIT_FROM = 2026-12-04`.** Move it later if integration ships after 2026-11-27. Never earlier.
3. **Optional down-rating of existing Hot Season editions** (audit C3). Not done. Needs approval because it reduces owned cards.
4. **Circuit 6-0 weekly Spotlight pack** (ut-owned). The ladder works best if it becomes a Program Pick.
