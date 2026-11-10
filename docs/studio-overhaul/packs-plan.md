# Team packs: build plan (revision 2)

Team **packs**: the pack economy, real odds, promos, pack opening, and the Store and SBC screens. Worktree `/home/user/ps-s-packs`, branch `claude/studio-packs`, dev-server port **5213**. Base: `claude/studio-overhaul` = `acdf3e2`.

This is the planning step only. No code changed. The builder for each task reads this file, plus `BRIEF.md`, `BUILD-RULES.md`, `OWNERSHIP.md` and `STREAM-packs.md`, before starting.

`O` means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Revision 2 (2026-11-10).** An independent critic reviewed revision 1. This revision:
- re-plans the ratings work against owner decision 5 (re-rate accurately, owned cards included, every change documented);
- adds the missing cheap-route caps, SBC value rules, Standout caps, wave structure and disclosure rows;
- moves every "before" snapshot and every cross-team contract into packs-1;
- makes stamps and pity survive an older build re-saving the profile;
- replaces vague targets with numbers.

Section 13 answers every critique point: where it is handled, or why it is rejected or deferred. Ten tasks stay inside the 6–10 cap, so four P1 pieces move to named follow-ups (§10). Each follow-up has a full spec, so the lead can schedule it.

**Sources read in full:**
- `O/audit-packs-promos.md`
- `O/research-ultimate-team.md`
- `O/audit-ut-ui.md`: M2, H3, H7 and §4, plus the rest for context
- `O/STREAM-ut.md`, `O/STREAM-shell.md`: the parts that meet ours
- `docs/PACK-CINEMA.md`, `PULL-TRACKER.md`, `CARD-CIRCULATION.md`, `UT-CONTENT-2.md`, `UT-CONTENT-UPDATE.md`, `RATINGS-AUDIT.md`, `GAMEPLAY-RATINGS.md`

**Code read:**
- `packs.ts`, `rate.ts`, `ut-scale.ts`, `fc-scale.ts`, `rating-quality.ts`, `specials.ts`, `card-stats.ts`, `editions.ts`, `variants.ts`, `rare.ts`, `walkout.ts`, `pack-sequence.ts`
- `market.ts`, `preview-pack.ts`, `content-packs.ts`, `content-state.ts`, `content-sbc.ts`, `content-progress.ts`, `live-packs.ts`, `live-cards.ts`, `calendar*.ts`, `standouts.ts`, `promo.ts`, `pool.ts`, `pull-log.ts`, `pull-log-state.ts`, `sbc.ts`
- `Store.tsx`, `PackOpening.tsx`, `PackArt.tsx`, `Challenges.tsx`
- `admin/catalog.ts`, `economy.test.ts`, `engine/sport-branches.test.ts`, `supabase/functions/card-registry/contract.ts`, `scripts/build_numbered_catalog.ts`
- the buy, open and sell flows in `UltimateTeam.tsx`, `circuit.ts:11` and `progression.ts:183` (the earned Spotlight routes)
- `src/data/live-calendar.json`: every `defaults` and `seasons[]` key

---

## 0. Goals

The owner asked: "fix packs to make them more how real packs work for odds and for promos … people wanna do challenges to get more … attract dopamine … make cards appeal to the eye … make stats more accurate". Coins only. Owner decisions 4 and 5 bind this plan: realistic odds with protection, and an accurate re-rate of every card with every change to a displayed overall documented.

Measured goals for this team:

1. **No economy-breaking bugs.**
   - Spotlight and GOAT quick-sell at 4,000–5,050 and 6,000–9,000 coins (NBA; × the sport's `qs`), from 30. Quick-sell rises along one documented tier order.
   - SBC auto-fill never spends a special, numbered or high-value card.
   - No route sells or pays an 83+ card below its pack-route cost: the Market, the Swap Desk, the Preview Pack and the repeatable SBCs.
   - Soccer never sees an NFL-position SBC.
2. **Real-pack odds.** Every gold any source hands out comes from one per-OVR curve (research §8.1). That covers packs, the Daily Drop, the starter, SBC reward cards, the Market and picks. Per gold slot: 75–82 about 94%, 83+ 5.8%, 85+ 1.0%, 88+ 0.20%.
3. **Honest disclosure.** Every buyable item and every random reward shows a "chance of at least one" sheet before it opens. The sheet is computed from the definition and matches simulation. Boost, pity and duplicate protection change the numbers shown, not just add a tag.
4. **Bad-luck protection that cannot be lost.** Scout Stamps and a program-card guarantee scaled to each pack's odds. Both are recoverable from fields an older build keeps.
5. **Ratings truth (owner decision 5).**
   - Hot Season award editions are re-rated by id to their season + 3..6, capped at 95.
   - Legends are re-rated the same way.
   - The face shows the attributes the match uses (|face − played| ≤ 1).
   - GOAT and Spotlight faces keep the player's shape.
   - Every displayed-overall change is listed in a generated table.
6. **A ladder with numbers.** Expected coins per tier rise with displayed rating, with adjacent rungs at least 1.5× apart (§2, D5).
7. **Promos that feel live.**
   - Program and Weekly Standout caps climb through the year, never down except the January Honors spike.
   - Every future program gets two Friday waves a week apart, a headliner, a rating spread and repeat caps.
   - A Program Hub page, a Store hero and a Store-tab badge mark each wave.
8. **Pack opening that hits.**
   - Cinema levels 1.2 / 2.6 / 4.2 / 5.0 / 6.6 s.
   - At most 3 full walkouts a pack, with SKIP ALL from the first frame.
   - Per-card actions after opening, with total value.
9. **Readable long pages.**
   - Store ≤ 3.0 screens at 393 (from 3.8) and ≤ 3.5 at 320 (from 4.4).
   - SBC page ≤ 2.5 / 3.0 screens on open (from 5.7 / 6.7).

---

## 1. Ground rules for every task

### Commands (shared machine)

| What | Command |
|---|---|
| Typecheck | `cd /home/user/ps-s-packs && bash O/heavy.sh npm run typecheck` |
| NBA tests | `cd /home/user/ps-s-packs && bash O/heavy.sh npx vitest run src/ut/<files>` |
| NFL tests | `cd /home/user/ps-s-packs && PS_SPORT=nfl bash O/heavy.sh npx vitest run src/ut/<files>` |
| Soccer tests | `cd /home/user/ps-s-packs && PS_SPORT=soccer bash O/heavy.sh npx vitest run soccer sport-branches` |
| Measurement | `cd /home/user/ps-s-packs && PS_SPORT=<sport> bash O/heavy.sh npx vite-node scripts/packs/<script>.ts` |
| Dev server start | `cd /home/user/ps-s-packs && nohup npx vite --port 5213 --strictPort > /tmp/ps-packs-vite.log 2>&1 & echo $! > /tmp/ps-packs-vite.pid` |
| Dev server stop | `kill $(cat /tmp/ps-packs-vite.pid)` |

- Full `npm test` and `npm run build` run only in packs-10.
- Never use `pkill -f` or `pgrep -f`.

### Tests

- **Soccer coverage.** `npm test` runs soccer as `PS_SPORT=soccer vitest run soccer sport-branches`, so only paths containing "soccer" run there.
  - Every sport-generic packs suite lives in a plain module (`src/ut/packs-suites/*.ts`) that exports `describe` blocks.
  - `src/ut/<name>.test.ts` runs the suite when `SPORT !== 'soccer'`.
  - `src/ut/soccer-<name>.test.ts` runs it when `SPORT === 'soccer'`.
  - So each suite runs once per sport.
- **Runtime budget.** New packs test files total ≤ 60 s per sport under heavy.sh.
  - Size N by the binomial σ: 10,000 opens give ±1.5 points at p ≈ 50% (3σ).
  - Use 200,000 draws only for cheap pure functions (`curvePick`, the pity counter process), never for full pack opens.
- **Foreign rating modules.** `rate.ts` imports `src/game/hoops2/ratings.ts` (nba), `src/game/football2/ratings.ts` (nfl), `src/ut/card-face.ts` (players) and the unassigned `calibration.ts` / `season-reference.ts`. Every test that compares ratings against a packs-1 fixture first checks `FOREIGN_FINGERPRINT`, a hash of those files' source stored in the fixture.
  - If the fingerprint differs, the test **fails** with the message "foreign rating modules changed: run `scripts/packs/rebaseline.ts`, review the OVR diff, accept".
  - It never skips. The lead runs the re-baseline once after merging (packs-10 ships the script).

### Browser QA

- Every page opens with `?ns=inspect&relay=ws://localhost:7777`.
- Every Playwright context runs `context.route('**/*')` and aborts every host except localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com. Copy the harness from `O/audit-scripts/utui/lib.mjs`. Keep the abort on even for fixtures, because numbered sync fires on any 90+ copy.
- Never open a Spotlight or registry pack in QA.
- **Fixtures** (seed pending packs into the save):

  | Need | Fixture |
  |---|---|
  | One season, Hot Season, Legend, Standout or Landmark card | `admin-card:<id>` (the regex at `packs.ts:438` allows only these kinds) |
  | One program card | a pending `live-plus:<promo>` guarantee pack (100% program) |
  | Multi-special packs (Legend + Standout, 3 specials) | the dev-only `fixture:<id,id,…>` kind (packs-9). It is compiled out of production by `import.meta.env.DEV`; packs-10 greps `dist/` to prove it. |

- Viewports: 393×852 with insets 59/34 (the owner's phone) and 320×568, touch on, `deviceScaleFactor: 1`. Screenshots go to `O/shots/packs/<task>/<sport>-<width>-<screen>.png`. Look at every one.

### Saves

- Never change a storage key, card/edition/copy id, uid format, claim id or the meaning of a saved field.
- New state goes only in optional `ut.content.*` fields, added to `ContentState` **and** `normalizeContent` (`content-state.ts`).
- **Old builds strip new fields.** `normalizeContent` drops unknown keys ("unknown fields go"), so an older cached build that loads and re-saves a cloud snapshot deletes our new fields. Therefore:
  - Anything of value (stamps, pity) must be recoverable from fields old builds keep: `pulls`, `claims`, `buys`, `owned`. See D7.
  - Fields that only hold preferences or "seen" marks (`prefs`, `seenDrops`, `preview.wk`) may be lost. Losing them is harmless; document that.
- packs-1 freezes a copy of today's normalizer as `src/ut/__fixtures__/legacy-content-state.ts` (the "old build"). Every task that adds state runs this round-trip test:
  1. new build state;
  2. legacy normalize (strip);
  3. new normalize;
  4. capture → `checkedSnapshot` → `applyProgress` → `validateSaveValues`.

  It asserts that every coin, card, level and claim is kept, and that stamps and pity stay within the stated loss bound.
- **Claims.** `withClaim` keeps the last 5,000. Our time-scoped families (`sbc:*`, `cal:*`) may age out harmlessly. The non-time-scoped `stamps:*` claims are kept at the end of the list (D7), so any `slice(-5000)`, including an old build's, keeps them.

### Protocol

- Never edit `DRAFT_RULES` or `UT_RULES`.
- Pack odds, prices, stamps, pity and presentation need no bump.
- Ratings a match reads do. Write "Protocol bump needed: …" in `docs/studio-overhaul/packs.md`, with the exact attribute deltas for the sport teams.
- `CONTENT_PRINT` (`pool.ts`) is ours. Changing it changes `pool.print`, and so the online UT queue, in **all three** sports. Say so whenever it moves.

### Cutoffs (so started content never moves)

- **`PROMO_EDIT_FROM = '2026-12-04'`** and **`SHIP_DATE = '2026-11-27'`**, both in `calendar.ts`.
  - Only promos with `start >= PROMO_EDIT_FROM` may change band, delta, featured, rule, waves or selection.
  - A test pins a hash of every earlier promo and its frozen selection, and asserts `PROMO_EDIT_FROM > SHIP_DATE`.
  - `scripts/packs/release-check.ts` (packs-7) fails if today's Eastern date is after `SHIP_DATE`, or if any promo it would edit has started. The lead runs it before shipping and moves both constants together if the ship date slips; the cutoff never moves earlier.
  - The real condition is ship date < 2026-12-04, when s2-cup-crown goes live with its frozen selection.
- Registered Spotlight/GOAT packs rebuild their common slots with the **legacy** draw (`legacyFill`), so a retried receipt reconstructs the cards it was minted with. That holds only while `pool.buckets.gold` is unchanged. If a packs re-rate or another team's ratings change moves gold membership, a receipt opened *before* the update may rebuild differently. Deposits are already exactly-once via `registeredOpenings`. This mismatch is accepted and documented.

### Outside our lane

- **One packs-owned hook module.** All new UT actions live in `src/ut/pack-actions.ts` (packs-2): `usePackActions(ctx)` returns `{ openOpts, canBuy, store, opening, hub }`.
- `UltimateTeam.tsx` (ut's) gets **one** integration hunk of about 5 lines: the import, the hook call, and `{...pa.store}`, `{...pa.opening}` spread into `<Store>` and `<PackOpening>`. On top of that come these one-line edits:
  - `openPack(…, pa.openOpts(kind))` in `openNow` and `buyLive`;
  - `pa.canBuy(kind)` replacing the local `LIMITED` array in `buy`;
  - `pa.canBuy('spotlight')` in `startPromo`;
  - the `program` view render, plus one `nav.ts` line (packs-7).

  That is about 12 lines over the whole stream. Each hunk is listed in `packs.md` under "Touched outside my lane".
- New CSS goes in our own files: `pack-cinema.css`, `pack-reveal.css`, `pack-art.css`, `content.css`, `pull-tracker.css`, plus the new `store.css`, `odds-sheet.css`, `program-hub.css` and `sbc-page.css`. Never `styles.css`.
- **Shell owns** the pack SKIP target size (its M6, in `styles.css`). We size only the buttons whose rules live in our files: TAP TO CONTINUE, QUICK SELL DUPES and everything new.
- **New sounds** go in a new packs-owned `src/ut/pack-sound.ts`, built on the existing exported `packSound`/`sfx`. `src/lib/sound.ts` is never edited.

### Layout

- 390 frame, taps ≥ 44 design px (the `::before` hit-area pattern for compact chips), text ≥ 10 design px. No width media queries. SVG for symbols.
- Full-screen layers put top controls below `var(--sat)` (shell's variable, the same name after shell's Fix A). Never `env()` directly, never a fixed px.
- Sticky chips use `top: var(--ut-sticky-top, 0px)`. packs-1 asks shell to define it from the header height, because shell is changing header plates. Never a hard-coded offset.
- Sheets (OddsSheet, BuyConfirm, the per-card action sheet) are flex columns: header, then a scrolling body, then a **non-scrolling** footer. Never copy `position: sticky; bottom: -18px` (UT-UI H1 with `--sab`).
- At 320 (k = 0.82), every odds row, per-slot bar and segmented control still keeps 44 design-px targets and ≥ 10 design-px text.

### Reduced motion (every task that animates)

- No flips, flares, pulses, pattern drift, hero animation or chained walkouts.
- `scroll-behavior: auto` for chip jumps.
- Countdowns re-render at most once a second, with no animation.
- Each animated piece has a reduced-motion test (a class check in a React test, or `page.emulateMedia({ reducedMotion: 'reduce' })` in QA).

### Performance

- Odds and EV are computed lazily (on sheet open, or in `requestIdleCallback` after the Store's first paint) and memoized per `(pool, def key, day)`.
- Targets:
  - `oddsTable` for any pack ≤ 20 ms at 1×;
  - Store first render with no long task over 200 ms at 4× CPU throttle;
  - tile tap to a visible odds sheet ≤ 150 ms at 4×.
- New modules stay inside the lazy UT chunk. `ProgramHub` and `OddsSheet` load with `React.lazy`.
- Budget: first-paint bundle +0 bytes, UT chunk +≤ 25 KB gzipped for all packs work, no new dependencies.

### Ethics (research §7 warns against stacking pity + batch pulls + limited discounts)

- No buy-many and no "open all" of purchases.
- The pity counter shows on the odds sheet and the Program Hub, never beside a BUY button.
- BuyConfirm's "Don't ask again" never applies to a purchase of 10,000 coins or more.
- Coins only. "Buy" always means coins.

### Branding

- No "Icon" in new copy: the new reward is a "Legend Pack". No TOTW/TOTY/TOTS/FUTTIES wording.
- Pack art uses original SVG patterns, never a reference game's pack silhouette.
- Mode names never change (owner decision 1).

### Commits

- Start with `Claude: `, end with the two trailer lines from BUILD-RULES, and stage explicit paths. Then push `claude/studio-packs`, retrying 4 times on a network error.
- Update `docs/studio-overhaul/packs.md` in the same commit as the work.

---

## 2. Decisions (binding for every builder)

### D1. One canonical tier order

- **`TIER_RANK` (`pool.ts:173`) is canonical and stays:** bronze 0 < silver 1 < gold 2 < standout 2.5 < program 3 = promo (Hot Season) 3 < landmark 3.5 < legend 4 < spotlight 5 < goat 6.
- packs-6 adds `rankOf(rc)` in `pool.ts`, which breaks ties and places the two time-limited program kinds by what they are:
  - program 3.0, Hot Season 3.2;
  - Honors program cards (band top ≥ 96) 4.3, the Finale 4.6.

  `revealOrder`, `byValue`, `walkoutLevel` and the ladder all use `rankOf`.
- Quick-sell must be strictly increasing between distinct ranks of `TIER_RANK`. The test compares each tier's min, median and max OVR at levels 1 and 5, against the next tier's min, median and max. Equal ranks (program, promo) are exempt.

### D2. Quick-sell numbers (NBA; × `PACK_SHAPE[sport].qs`; levels add up to +2 OVR)

| Tier | Formula | Range |
|---|---|---|
| GOAT | 6,000 + 500·(ovr − 106) | 6,000–9,000 |
| Spotlight | 4,000 + 150·(ovr − 100) | 4,000–5,050 |
| Legend | 2,500 + 150·max(0, ovr − 89) (unchanged) | 2,500–3,700 |
| Landmark | unchanged | ≤ 1,800 |
| Hot Season | 650 + 50·max(0, ovr − 80) (packs-5, after the re-rate) | 650–1,500 |
| Program, Standout, gold, silver, bronze | unchanged | |

Legend max 3,700 < Spotlight min 4,000, and Spotlight max 5,050 < GOAT min 6,000. packs-1 fixes the overwrite chain with these numbers. packs-5 changes only the Hot Season line.

### D3. The re-rate (owner decision 5; packs-5)

- **Hot Season** (`kind: 'promo'`, 518 NBA / 1,106 NFL editions): displayed = `min(95, seasonShown + d)`.
  - `d` is 3..6 from the line's award: MVP or POY 6; first-team All-League or DPOY 5; other All-League 4; stat titles and the rest 3.
  - Played attributes = `editionAttributes(attrs, d, 99, false)`. The face is those attributes on the display scale, so `faceLift` is gone.
  - If `round(shownFaceMean)` falls short of the displayed overall by more than 1, raise the role's strengths by at most +2 each.
- **Legends:** the same rule with the line's own edition boost (3–6), cap 95, **no floor** (Cooper '81 becomes about 81). Legend keeps its tier, frame and ability.
- **January Honors** (`s4-honors`, a live program) keeps 94–97 as a time-limited program. Program cards are not touched by D3.
- **Soccer award editions** are not re-rated. Their file overalls already average season +3.3, inside the +3..+6 rule. Only those under 80 leave the pack buckets (L4).
- **Ids, owned copies, levels, XP and serials never change.** Every displayed-overall change is listed (packs-5).

### D4. GOAT/Spotlight shape (packs-5)

- `editionAttributes(…, special = true)` changes its gain for attributes ≥ 80 from the full boost to `boost × (cap − v)/(cap − 60)`, so it scales with headroom. Then `supportEdition` lifts strengths in proportion to `(v − 60)^1.5`, spilling overflow at the cap to the next strength.
- Rule priority, applied in order:
  1. at most 2 face values at the cap, and at least 3 distinct values;
  2. the base season card's strength order is kept (Kendall τ ≥ 0.8);
  3. tier floors hold (Spotlight ≥ 100, GOAT ≥ 106);
  4. the displayed OVR may move from today's and is documented.
- First a feasibility run (`promoattrs --feasibility`) lists every card where rules 1 and 3 conflict. Only those cards may have 3 values at the cap, and they are listed in `packs.md`.

### D5. The ladder (packs-6; NBA)

Each rung is the expected coins for one card of the tier by its cheapest coin route. Pity is included. Fodder is valued at acquisition cost: 2 × QS below 83, and the D10 route cost at 83+.

| Rung | Typical displayed OVR | Target coins | Main levers |
|---|---|---|---|
| Standout | 80–93 | 3,000–3,600 | Standout Guarantee |
| Program | ≤ season cap | 6,600–10,000 | guarantee ≥ 2.2× pack; pack with pity |
| Hot Season (re-rated) | season + 3..6, ≤ 95 | 15,000–26,000 | weekly Hot Season SBCs (fodder tuned); Premium promo slot 2% |
| Legend | season + 3..6, ≤ 95 | 40,000–55,000 | Elite Gold Legend slot 1% → about 4.5%; Premium 0.66%; Headliners 1%; Vault 2% |
| Honors (S4, time-limited) | 94–97 | ≥ 40,000 | program-pack odds ≤ 8% with pity; its guarantee priced ≥ 40,000, 1 per wave |
| Finale | 98–99 | ≥ Legend + 6 Program (its SBC consumes a Legend) | the SBC |
| Spotlight | 100–105 | ≥ 1.5 × max(Legend, Finale) measured | pack price = rung ÷ 0.20 rounded up to 1,000 (expected 25,000–30,000), 1 a week |
| GOAT | 106–110 | ≥ 1,000,000 | unchanged contract odds |

- Each bound is set so any values inside them keep adjacent rungs ≥ 1.5× apart. Example: Program max 10,000 × 1.5 = HS min 15,000.
- Two exceptions: Finale consumes a Legend, so it only needs to cost more than one; Honors only needs ≥ Legend's lower bound.
- **Earned routes** (ut's Circuit and Season Pass) are modelled in **days** for the engaged player, and the day ladder must be monotone too.
- packs-1 asks ut to change the two earned Spotlight routes (`circuit.ts:11` 6-0, `progression.ts:183` level 25) to a Program Pick, as research §8.7/§8.9 already specify. packs-6 sets the Spotlight price only after ut's answer is recorded in `packs.md`.
- Program cards in late seasons (cap 98) outrank Legends (cap 95) while costing less. That is the deliberate power curve of a live year, stated in `packs.md`.

### D6. Pity length scaled by odds (packs-6)

- Length `L(p) = max(13, ceil(3.9 / p))`, where `p` is the pack's **unboosted** program rate. That gives 30% → 13 packs, 20% → 20, 8% → 49 and 7% → 56.
- The pity fires on about 1.4–1.9% of program cards whatever the pack, so the rarity of low-odds packs survives.
- Share of program cards that come from pity = (1 − p)^(L−1). At 30% that is 1.384%. Per pack it is 0.42%.
- Effective rate = p / (1 − (1 − p)^L). At 30% that is 30.29%; at 7% it is 7.12%. The sheet publishes it.

### D7. Stamps and pity survive old builds (packs-6)

- **Primary store:** `ut.content.stamps = { earned, spent }`, written by `recordPull` and redemption.
- **Recovery floors,** computed only from fields old builds keep:
  - `earnedFloor` = the stamps of every pull-log entry (newest 300 packs) with `at ≥ STAMPS_FROM` (the release instant). A special counts as a duplicate when its card id appears in an earlier entry.
  - `spentFloor` = Σ cost over `stamps:<item>:<cost>:<uuid>` claims. The cost is encoded in the id.
- **Balance** = `max(earned, earnedFloor) − max(spent, spentFloor)`, never below 0.
- **Loss bound** after an old build strips the field: only stamps from packs older than the newest 300 since release. It is documented and tested.
- **No exploit:** both floors come from real logs and claims. Our `withClaim` moves `stamps:` claims to the end of the list, so any `slice(-5000)` keeps them.
- **No back-pay** for packs before `STAMPS_FROM`.
- **Pity is not stored at all.** It is recomputed from the pull log: trailing opens of that promo's program packs in the current wave without a program card.

### D8. Season caps (packs-7; promos and Standout weeks from the cutoff only)

| Calendar season | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9–12 |
|---|---|---|---|---|---|---|---|---|---|
| Program cap | 94 | 94 | 95 | 97 (Honors) | 97 | 97 | 98 | 98 (Finale 99) | 98 |
| Weekly Standout cap | 93 | 93 | 94 | 95 | 95 | 95 | 96 | 96 | 96 |

- Both rows are non-decreasing. The S4 Honors 97 is held through S6, so no season steps down.
- The re-rated permanent Hot Season (≤ 95) sits at most 1 above the S1–S2 program cap, and only for MVP seasons.
- Each season's `standouts.band` in `live-calendar.json` (for example s4 [82, 92]) is read and clamped by this cap. `defaults.standouts.cap` (97) becomes the fallback only.

### D9. New pack kinds as pending rewards (packs-1 decides by test)

- packs-1 runs a regression test **on today's code** before any new kind exists. A save holding a pending pack of an unknown kind (`headliners`) must:
  - survive `normalizeContent`, capture, `checkedSnapshot`, `applyProgress` and `validateSaveValues`;
  - make `openPack` throw a handled error that leaves the pending entry in place.
- If it passes, the old client is safe. ut may then award `headliners` as a pending pack (Scout Reveal 0.6%, Season Pass levels 24 and 29).
- If it fails, ut awards `jumbo` instead. packs-1 records the outcome in `packs.md`.

### D10. Coin value of a card (packs-3; used by the SBC value rules, the Market and the ladder)

- `coinValue(rc)`:
  - non-gold, or gold under 83: 2 × QS (acquisition at the 0.5 EV ratio);
  - gold 83+: `routeCost(ovr)` = Premium price ÷ P(at least one ≥ ovr per Premium). packs-3 ships it as a table from packsim, and packs-4 replaces the table with `odds.ts` and tests that they agree within 5%;
  - specials: their D5 rung.

### D11. Walkout levels (packs-9; decided from the awarded cards, so truthful)

| Level | When |
|---|---|
| 0 | best < 80, no special |
| 1 | best gold 80–84; a Standout < 86 that isn't featured ("promo flash" in tier colour) |
| 2 | gold ≥ 85; any program card; a Standout ≥ 86 or featured; a Hot Season or Landmark < 86 |
| 3 | Legend; a Hot Season or Landmark ≥ 86; Spotlight |
| 4 | GOAT |

At most 3 full walkouts a pack, best last. The rest become level-1 flashes inside the grid.

### D12. Launch moment without a new modal

- This round ships the launch moment as:
  - a Store-tab badge (`storeBadge`, wired by ut);
  - the Store's featured hero, with a countdown and a NEW WAVE tag;
  - the Program Hub page;
  - the `liveNow` feed for ut's Hub.
- The full-screen takeover is deferred (§10 F3). ut is rebuilding first-run and modal order (UT-UI M7 already complains of two stacked modals). The takeover ships later under a modal-priority contract: first-run, then the rewards inbox, then the promo takeover, one modal per UT open.

---

## 3. Baseline and targets (from the audits; packs-1 re-measures every "Now")

| Measure | Now | Target |
|---|---|---|
| QS Spotlight / GOAT (NBA) | 30 / 30 (NFL 10 / 10) | D2 ranges; strictly monotone by D1 at min/median/max |
| Auto-fill with a Spotlight 104 MJ in the club | in 7 SBCs | 0 |
| Per G75 slot: 85+ / 86+ / 88+ | n/a | 1.0% ± 0.08 / 0.58% ± 0.06 / 0.20% ± 0.04 (200k draws) |
| Gold-pack golds 75–79 / 80–82 / 83–85 / 86+ | 64.7 / 28.7 / 5.7 / ≈1.0% | 45 / 49 / 5 / 0.7 (± 2) |
| `rewardCard` 84+ (Golden Hour) | uniform over every 84+ gold | G84 curve: 85+ 42% ± 3, 86+ 24% ± 3 |
| Market 83+ items a day / max OVR | Hot Season 94–97 ×2 + Standout + rare 83–91 | ≤ 1 / ≤ 86, priced ≥ 25% of `routeCost` |
| Swap Desk Scout picks a day | 3 | 1 |
| Preview: specials via previews in 30 days (hourly checks) | ≈ 20 | ≤ 2.5; ≤ 1 preview per 24 h |
| EV / price, every sold non-chase item | 0.43–0.84 (soccer Lightning 0.84) | 0.45–0.60; flash offers ≤ 0.75; never below 0.43 |
| Program pack vs guarantee (NBA) | 3,000 vs 3,200 | guarantee ≥ 2.2×, guarantee EV/price ≥ 0.25, pack EV/price 0.45–0.60 |
| Boosted program row | n/a | min(0.6, 1.5 × base) ± 0.1 pt, for program packs, Headliners and Vault |
| Daily Upgrade / repeatable SBC value out ÷ in (D10) | unmeasured | 1.1–1.3 / 0.9–1.1 |
| Odds sheet | tiers per slot only | bands, tiers, holo, featured, effective program rate with pity; ±1.5 pt of 10k sim |
| Duplicates at 200 packs | Elite 27%; NFL LB/DL/OL Unit 39–47% | Elite ≤ 20%; Units ≤ 35%; guarantees 0% while any of the set is unowned |
| Ladder (NBA coins) | HS ≈2,100, Spotlight ≈17,500, Legend ≈177,000 | D5 table |
| Hot Season shown vs played (NFL Ferguson '77) | shown 94, face THP 99, played 79 | shown = season + d ≤ 95; max \|face − played\| ≤ 1 |
| GOAT faces at the cap (Brady) | 5 of 6 at 110 | ≤ 2 (D4) |
| Program caps by season | 97 flat | D8, non-decreasing |
| Promos with Team 1/Team 2 waves | 9 of 42 | every promo from the cutoff |
| Program repeats (NBA, year 1) | MJ '88 ×8; LeBron ×14 | ≤ 2 per (player, season), ≤ 4 per player per cycle |
| Walkouts per pack | 1; an 82 Standout walks out | D11; ≤ 3 full; ≤ 12 s before SKIP ALL |
| Store length 393 / 320 | 3.8 / 4.4 screens | ≤ 3.0 / ≤ 3.5; first viewport shows wallet, chips and a hero with art ≥ 120 design px |
| SBC page length 393 / 320 | 5.7 / 6.7 screens | ≤ 2.5 / ≤ 3.0 on open |
| Stamps | none | engaged: 50 every ≤ 3 days, 300 every ≤ 21 days; casual: first 50 ≤ 7 days; every shelf item worth 5–12% of the coins spent to earn it |

---

## 4. Task overview (ordered; P0 first)

| # | Id | Pri | Title | Est | Depends on |
|---|---|---|---|---|---|
| 1 | packs-1 | P0 | Baselines, contracts and the critical fixes (QS, auto-fill, confirm, soccer SBCs, guard) | 3.5 h | — |
| 2 | packs-2 | P0 | Real-pack odds: the gold curve and slot lists for every source, new tiers, holo, duplicate protection, `pack-actions.ts` | 3 h | packs-1 |
| 3 | packs-3 | P0 | Prices, limits and exploits: Market, Swap Desk, Preview, Club Collection + admin floor, program pricing and boost, flash windows and named flash sales, EV band, SBC value rules | 3 h | packs-2 |
| 4 | packs-4 | P0 | Odds engine and disclosure: `odds.ts`, OddsSheet, BuyConfirm, reward and pick odds, Pack Tracker and Pack Helper | 3 h | packs-3 |
| 5 | packs-5 | P0 | Ratings truth: accurate re-rate of Hot Season and Legends, real faces, GOAT/Spotlight shape, the OVR diff, fit re-runs | 3 h | packs-1; the lead's file assignment |
| 6 | packs-6 | P0 | Bad-luck protection and the tier ladder: stamps, scaled pity, the shelf, `rankOf`, Legend/Hot Season/Honors/Spotlight levers, ladder in coins and days | 3 h | packs-2, 4, 5; ut's answer on earned Spotlight routes |
| 7 | packs-7 | P1 | Promo content and the Program Hub (NBA/NFL): caps, Standout caps, waves, headliners, repeats, cycle 2, refreeze, `promo-hub.ts`, the hub page | 3.5 h | packs-5, 6 |
| 8 | packs-8 | P1 | Long pages: Store IA, pack art for every kind, the SBC page | 3.5 h | packs-4, 6, 7 |
| 9 | packs-9 | P1 | Pack opening that hits: levels, flares, walkout queue, program walkout, headline, PickSheet order; then post-open management | 3.5 h (two commits) | packs-2, 5, 7 |
| 10 | packs-10 | P1 | Final QA, bundle, docs and the integration re-baseline kit | 2.5 h | all |

Three tasks are 3.5 h because of the 10-task cap. Each has an explicit internal commit point with its own acceptance, so a failure in the second half never blocks the first.

---

## 5. Tasks in detail

### packs-1 (P0): Baselines, contracts and the critical fixes

**Why:** every later "equal to before" test needs a fixture taken before any code moves. ut builds its Hub in parallel and needs our API types now. Audit C1 and H4 are critical. It also covers the brief's P0 items 1 and 6.

**Changes:**

1. **The "before" fixture set** (`scripts/packs/snapshot.ts` → `src/ut/__fixtures__/packs-before/<sport>.json`, compact, ≤ 400 KB total, never imported by app code). Taken on the untouched base, per sport:
   - **Ratings:** every Hot Season, Legend, GOAT, Spotlight, Landmark, started Standout week and frozen program edition. For each: `[ovr L1..L5, tier, rawOvr, face L1, hash(attrs L1), hash(attrs L5)]`.
   - **SBCs:** the 60-day SBC catalogue (`sbcsFor` per day: titles, reqs, rewards).
   - **Registered receipts:** 20 registered-receipt seeds → card ids, through today's `registeredPack`.
   - **Started promos:** the golden hash of every `live-calendar.json` / `live-editions.json` entry with `start < PROMO_EDIT_FROM`.
   - **Numbered catalog:** `scripts/build_numbered_catalog.ts --check` (a new read-only flag that writes nothing): the hash of the generated `numbered-{nba,nfl}.json` against the committed files.
   - **`FOREIGN_FINGERPRINT`** (§1 Tests).
   - **The legacy normalizer:** a frozen copy of today's `normalizeContent` as `src/ut/__fixtures__/legacy-content-state.ts`.
2. **Harness.** Port `packsim.ts`, `promos.ts`, `promoattrs.ts` (with `--feasibility`) and `autofill.ts` into `scripts/packs/`, with relative imports.
   - Output goes to `O/packs-out/<PACKSIM_LABEL>/`.
   - packsim adds per-gold-slot OVR histograms and "at least one" rows (80+ … 88+).
   - Add `scripts/packs/ovr-diff.ts`: snapshot vs current → per-id old/new OVR at levels 1..5, tier, delta, a "crosses 90" flag and counts by kind and delta. packs-5 uses it.
   - Run all three sports with `PACKSIM_LABEL=before`, and put the headline tables in `packs.md`.
3. **Contracts for ut** (types plus working stubs, so ut can code against them today). The contract text goes in `packs.md`.
   - `src/ut/promo-hub.ts`:
     ```ts
     export interface LiveDrop {
       id: string;                 // 'drop:<promoId>:w<i>' | 'standouts:<week>' | 'flash:<window>'
       kind: 'program' | 'wave' | 'standouts' | 'landmark' | 'flash';
       title: string; subtitle?: string; accent: [string, string];
       start: number; end: number; band?: [number, number];
       heroCardId?: string;        // the released headliner, never an unreleased card
       isNew: boolean;             // first 48 h
       boosted?: { until: number };
       cta: { view: 'program' | 'store' | 'standouts' | 'sbc'; arg?: string };
     }
     liveNow(pool, ut, at): LiveDrop[]                  // stub [] until packs-7
     upcomingDrops(sport, at, n?): { id; title; start; band }[]
     launchDue(pool, ut, at): LiveDrop | null           // for a future takeover (F3) and ut's "new wave" hero
     markLaunchSeen(ut, id): UtState                    // ut.content.seenDrops
     storeBadge(pool, ut, at): { n: number; reasons: ('wave' | 'daily' | 'stamps')[] }
     programRewardCard(pool, promoId, slot: 'objective', seed): RatedCard | null     // ut's program objective group card
     seasonPassCard(pool, day, slot: 'A' | 'B' | 'headliner'): RatedCard | null      // research §8.7
     resolvedEditions(pool, kinds): { id; kind; label; ovr }[]                       // ut's Collection (UT-UI M12)
     ```
   - `src/ut/stamps.ts`: `stampsBalance(ut): number` (stub 0).
   - `content-packs.ts`: `awardPick(ut, pool, kind, id, at)` for `'front-office'` (1 of 5 on G80), `'pick-82'` (1 of 3 on G82) and `'program-pick'` (1 of 3 current program; falls back to `'pick-82'` when no program is live). These are research §8.2's picks for ut's Rivals Bounties, weekly chest and Season Pass. Stubs throw "not yet" until packs-2.
4. **Requests posted in `packs.md` "Requests" (answers recorded there):**
   - **Lead:** assign `src/ut/ut-scale.ts` (its promo/legend knots at :47/:54), `scripts/fit_ut_scale.ts` and `scripts/fit_ut_balance.ts` to packs for packs-5. OWNERSHIP gives them to nobody. Without that assignment packs-5 uses the rate.ts-only fallback.
   - **ut:**
     - the Circuit 6-0 and Season Pass level-25 Spotlight packs become Program Picks (D5);
     - new UT state goes under `ut.hq`, or ut asks us to add it to `ContentState` (one normalizer, no silent drops);
     - the D12 modal order for a later takeover;
     - wire `storeBadge` onto the Store tab;
     - `labels.ts` names for "Hot Season", "Weekly Standouts" / "Matchday Standouts" and "Program".
   - **shell:**
     - define `--ut-sticky-top` from the header height;
     - SKIP's target size stays yours; TAP TO CONTINUE / QUICK SELL DUPES / new buttons are ours (no duplicate rules).
   - **players:** an edit to `supportOverall` in `card-face.ts` changes the attributes matches use, so it means "Protocol bump needed".
   - **nba/nfl:** packs-5 changes Hot Season, Legend, Spotlight and GOAT played attributes. Exact deltas will follow in `packs.md`.
   - **All teams:** the stricter `sport-branches` regex (change 8) will flag any `nba(x) ? a : b` helper ternary at merge.
5. **Quick-sell (C1).**
   - `quickSellValue` becomes one `if / else if` chain with the D2 numbers.
   - Export `TIER_ORDER` (D1) for the test.
6. **Auto-fill (C1).**
   - `sbc.ts autoFill` never takes a card when any of these holds:
     - its tier is in `{goat, spotlight, legend, landmark, promo, program}`;
     - `line.programKind === 'finale'`;
     - it has a `mint`;
     - it is locked;
     - its `quickSellValue` exceeds `rewardValue(reward, sport)`.
   - A card can still be picked by hand.
   - This needs `FillCard.mint?`, mapped in `Challenges.tsx`.
7. **Confirm warning (C1, research §8.8).** The `Challenges.tsx` confirm:
   - always says "These cards are removed permanently";
   - shows a red row naming any special, numbered, 90+ or above-reward card;
   - in that case labels the yes button `TRADE IN ANYWAY`.
8. **Soccer SBCs and the guard (H4).**
   - Rewrite the five `nba(c) ? … : …` templates with `pickFor(c.pool.sport, { nba, nfl, soccer })`, keeping each list's length and order:

     | Template | Soccer version | Positions |
     |---|---|---|
     | Pickup Game | Kickabout | — |
     | Backcourt / Pass Catchers | Front Three | W ST W |
     | A Full Five / Skill Set | Back Four | FB CB CB FB |
     | Frontcourt / No Fly Zone | Midfield Engine | DM CM AM |
     | Gold Standard / Gold Front Seven | Gold Spine | GK CB DM ST |

   - Delete the `nba` helper.
   - Add `/\b(?:nba|nfl|isNba|isNfl)\([^)]*\)\s*\?/` and a self-test to `sport-branches.test.ts`.

**Tests (suite `packs-economy`; `packs-economy.test.ts` + `soccer-packs-economy.test.ts`):**
- **Quick-sell:** strictly monotone by D1 at each tier's min/median/max OVR, at levels 1 and 5, in every sport. Spotlight ≥ 4,000·qs and GOAT ≥ 6,000·qs.
- **Auto-fill fixture** (the audit's club):
  - no returned uid is a special or numbered card over 28 days of SBCs;
  - every SBC fillable from commons still fills.
- **Soccer:** 60 days of `sbcsFor` name only `GK CB FB DM CM AM W ST`.
- **NBA/NFL:** the 60-day catalogue equals the fixture.
- **Fixture self-check:** a fresh snapshot on this commit equals the committed fixture, apart from the deliberate QS change. `FOREIGN_FINGERPRINT` matches.
- **D9:** the unknown-pending-kind round trip on today's code.
- **Branch guard:** `branchHits` flags `nba(c)\n ? a : b`, and the full scan is `[]`.

**Measurements:** `autofill.ts` before (MJ in 7 SBCs) → after (0). `packsim` after: Spotlight pack EV/price NBA 0.31 → about 0.5 with the new QS.

**Screenshots:** the SBC confirm with the warning (NBA 393); soccer "Back Four" (393, 320).

**Protocol:** none.

**Save-compat risks:**
- Soccer: on release day a soccer daily slot can change template under the same `d:<day>:<i>` id. A finished one still shows DONE. Noted.

**Acceptance:**
- All tests pass in three sports, and typecheck is clean.
- The fixture is committed.
- The before tables, the contracts, the D9 outcome and the requests are in `packs.md`.

---

### packs-2 (P0): Real-pack odds for every source

**Why:** the brief's P0 "Gold OVR curve" and "Guarantees as OVR floors", owner decision 4 ("83+ a real hit"), research §8.1/§8.2, audit M7/M8 and the critic's cheap-route finding for `rewardCard`.

**Changes (`src/ut/packs.ts` unless noted):**

1. **Curves.**
   - `GOLD_CURVE` (display OVR → weight): 75 4.56, 76 5.02, 77 6.71, 78 13.46, 79 15.29, 80 17.67, 81 16.22, 82 15.28, 83 3.40, 84 1.38, 85 0.43, 86 0.22, 87 0.16, 88 0.15, 89 0.034, 90 0.011, 91 0.005.
   - `SILVER_CURVE`: 65–69 at 9% each, 70–74 at 11% each. Bronze stays flat.
   - All of them are relative to `TIER_CUTS[sport]`.
2. **`curvePick(list, curve, floor, rand, opts?)`.**
   1. Index the list by OVR once (`WeakMap`).
   2. Draw an OVR on the curve restricted to `≥ floor`, renormalised.
   3. Resolve to the nearest OVR present: −1, +1, −2, +2, …, never below `floor` or above the curve's top.
   4. Pick uniformly at that OVR.
   - **`opts.preferUnowned`**: pick an unowned card *at the drawn OVR* when one exists. That cuts duplicates without changing any published OVR or tier number.
   - Keep `weighted()` as `legacyWeighted()`.
3. **Floor slot kinds** `'g78' | 'g80' | 'g82' | 'g84' | 'g86' | 'g88'`. Legacy `rare` maps to `g78`, so saved `studio:` recipes still open. "Rare" is the shimmer only.
4. **Slot lists for every source** (NBA shown; NFL and soccer scale counts through `pick({ nba, nfl, soccer })`: NFL about ×2, soccer about ×1.4):

   | Source | Slots | Special slot | Limit |
   |---|---|---|---|
   | Bronze | 4 B, 1 × (B .8 / S .2) | — | — |
   | Silver | 1 B, 3 S, 1 × (S .75 / G75 .25) | — | — |
   | Gold | 2 S, 2 G75, 1 G78 | on G78: standout .015, promo .005, legend .002 | — |
   | Premium | 2 S, 3 G75, 2 G78 + premium slot | standout .04, promo .02, legend .0066 | — |
   | Jumbo | 4 S, 4 G75, 7 G78, 1 premium slot | as Premium | 1/day |
   | Position / Unit | (k−1) G75 + 1 G78 at the position(s), `preferUnowned` | — | — |
   | Elite Gold (re-spec) | 5 G82 + 1 G84 slot, `preferUnowned` | G84 slot: standout .10, legend .01 (packs-6 sets the legend lever) | 2/day |
   | **Headliners** (`headliners`) | 5 G80 + 2 G82 + 1 slot, `preferUnowned` | g82 .79, program .12, standout .08, legend .01 (no live program → standout .20) | 2/day |
   | **Franchise Vault** (`vault`) | 9 G82 + 2 G84 + 1 slot, `preferUnowned` | g84 .68, program .30, legend .02 (no live program → standout) | 1/week |
   | Program pack (`LIVE_SHAPE`) | 4 G75 + 3 G80 + program slot | program odds, legend .005, standout rest | 3/day |
   | Program Guarantee | 5 G82 + program 1.0 | — | 1/week |
   | Standout Guarantee / Lightning | G75 / G78 for the old G / R | standout 1.0 | as today |
   | Daily Drop (`dailyLast`) | last card: S .60 / G75 .38 / standout .02 | — | 1/day |
   | Starter | its golds on G75 | — | once |
   | Club Collection (`studio:`) | `gold` → G75, `rare` → G78 | standout | packs-3 |
   | Spotlight (local common slots) | 7 G75; registered packs use `legacyFill` | server chase slot | packs-6 |
   | SBC `rewardCard` | `minOvr` 82 → G82, 84 → G84, 86 → G86, 88 → G88; other floors take the nearest lower floor curve | — | — |
   | Scout's Choice | 3 on G84; a Standout option only when its OVR ≥ 84 | — | as today |
   | `front-office` / `pick-82` | 5 on G80 / 3 on G82 | — | — |

5. **Program slot outside live packs.** `programDrawFor(pool, day)` in `live-packs.ts` returns released cards of the program-kind promos live that day, or null. `openPack` passes it to `fill` for `headliners` and `vault`.
6. **Prices (initial; packs-3 tunes them).**
   - `headliners` 3,800 / 3,000 / 3,400 and `vault` 9,000 / 7,000 / 8,000 (NBA / NFL / soccer).
   - Elite 3,000 / 2,100 / 2,600.
   - Limits `headliners {day, 2}` and `vault {week, 1}`, exported as `LIMITED_PACKS`.
7. **Holo.** `HOLO_CHANCE = 0.05`, only when the slot's chance of that card's tier was < 1, so guaranteed slots never go holo. Export `holoChanceOf(slot)`.
8. **Registered packs.** `registeredPack` and every receipt reconstruction use `legacyFill`. Check them against the packs-1 seeds.
9. **Chase duplicate protection (M7, H2).**
   - `openPack(…, opts?: { avoid?: Set<string> })`: a Standout or program slot never gives an owned `line.id` while any card of that set is unowned. It redraws within the set.
   - Gold slots use `preferUnowned` per the table.
10. **`src/ut/pack-actions.ts` (new).**
    - `usePackActions(ctx)`, with `openOpts(kind)` (avoid set and owned index) and `canBuy(kind, day, at)` (`LIMITED_PACKS`).
    - The one integration hunk in `UltimateTeam.tsx` plus the `openNow` / `buy` / `buyLive` one-liners (§1).
11. **`awardPick`** implementation (packs-1 stub) for `front-office`, `pick-82` and `program-pick`.
12. **Pull log and art.** `pull-log.ts packGroup` / `defFor` know `headliners` / `vault`. Minimal Store tiles go under Featured (packs-8 restyles). `PackArt` maps both to premium art until packs-8.

**Tests (suite `pack-curve`; `pack-curve.test.ts` + `soccer-pack-curve.test.ts`):**
- **Curve.** 200k `curvePick` draws over the real pool per floor reproduce "≥ x":
  - ±0.5 pt for x ≤ 84;
  - 85+ 1.0% ± 0.08, 86+ 0.58% ± 0.06, 88+ 0.20% ± 0.04 (G75);
  - the step-down fallback moves ≤ 1.5% of mass (NFL K/OL, soccer GK). The sheet publishes the measured number.
- **Slots:** every slot sums to 1; card counts match the table; `rare` recipes open.
- **Registered seeds:** the 20 frozen seeds per sport rebuild the same ids. The test is gated on `FOREIGN_FINGERPRINT`.
- **Holo:** 0 holos in guaranteed slots over 10k Standout Guarantees; 5% ± 0.6 of special cards from random slots.
- **Duplicates at 200 packs** (one player, same pack in a row):
  - Elite ≤ 20%;
  - NFL LB/DL/OL Unit ≤ 35%;
  - Standout Guarantee and Program Guarantee repeat an owned card 0% while any of the set is unowned.
- **Reward card:** `rewardCard` 84+ over 10k draws gives 85+ 42% ± 3 and 86+ 24% ± 3.
- **Scout's Choice:** no option under 84.
- **Picks:** `front-office` and `pick-82` best-of distributions match research §8.2 (84+ 20% / 30%) ± 3.
- **Economy:** `economy.test.ts` "days to a gold squad" is re-measured (golds average about 79.9 vs 77.9 today). The new band and its reason go in the test comment and in `packs.md`.
- Existing `packs.test.ts`, `content2.test.ts` and `pull-tracker.test.ts` are updated to the new slot names, never weakened.

**Measurements:** `PACKSIM_LABEL=after-curve`, three sports:
- the gold-slot histograms;
- the Gold-pack band split (target 45 / 49 / 5 / 0.7 ± 2);
- "at least one" for every pack against research §8.2 (Premium NBA 82+ 79%, 84+ 15%, 86+ 3.7%, each ± 3), with any pool-shape deviation explained;
- EV/price per pack (input to packs-3);
- duplicates at 100 and 200 packs.

**Screenshots:** the Featured row with Headliners and Vault (NBA 393).

**Protocol:** none (pack contents don't affect matches or `pool.print`).

**Save-compat risks:**
- Unopened earned packs roll on the new curve.
- The current Preview's cards re-derive once; noted.
- Registered packs: `legacyFill` plus the seed test.
- `rare` recipes map to `g78`.

**Acceptance:**
- All tests pass in three sports.
- Curves are within tolerance.
- Headliners and Vault buy and open in the browser at 393 with 0 page errors.
- `pack-actions.ts` exists, and the `UltimateTeam.tsx` hunk is ≤ 8 lines and listed.

---

### packs-3 (P0): Prices, limits and exploits

**Why:** audit C2, H1, H2, H3, M2, M5 and H7 (flash windows); the brief's P0 items 2 and 5; owner decision 4 ("cheap 94–97 routes cut back"); research §8.2 (boost, flash) and §8.8 (SBC value rules).

**Changes:**

1. **Scout Market (C2), `market.ts`.**
   - `MARKET_MIX = ['silver','silver','gold','gold','gold','gold','gold','rare','rare','rare','rare','high']`.
   - `gold` draws on G75 and `rare` on G78 among `isRare` golds; both are capped at 82.
   - `high` is one base gold 83–86 on the curve restricted to ≤ 86.
   - Price = `max(floor, round50(3 × QS), round50(0.25 × routeCost(ovr)))` (D10), with floors silver 100, gold 300, rare 400, high 1,500.
   - No `promo`, `standout` or other special. `MarketTag` keeps the old members in its union for type safety.
   - Bump the seed to `'ut-market:v2:' + sport + ':' + day`. `Store.tsx Market` drops the special labels.
2. **Swap Desk:** `LIMITS.swap` goes from 3 a day to **1**.
3. **Preview Pack (H1), `preview-pack.ts`.**
   - `PREVIEW_COOLDOWN_MS = 24 h` after both buy and skip.
   - The preview binds its week at creation (`preview.wk`, optional; a missing one adopts the current week on first read).
   - `PreviewPack.tsx` shows "Next preview in 23 h".
4. **Club Collection (H2), `src/admin/catalog.ts` + the Admin Studio Store Packs editor.**
   - `floorPrice(sport, counts)` = `counts.standout × CONTENT_PRICES[sport].standout` + the QS EV of the gold/rare/silver slots ÷ 0.6.
   - `checkedCatalog` clamps up to it, so a live catalog below the floor still loads.
   - The **editor** shows "Minimum N coins" under each price field and refuses to save below it, so the owner never sets 1,000 and sees players pay 1,800 unexplained.
   - Defaults: NBA Captains ≥ 3,000, NFL Captains ≥ 1,800.
   - Limits: `roster` 2/day, `captains` 1/day, `dynasty` 1/week, routed through `pa.canBuy`.
5. **Program packs (H3), `live-packs.ts`.**
   - Guarantee price = `max(round100(tplPrice × PRICE_FACTOR.guarantee), ceil100(2.2 × the promo's program-pack price))`.
   - The program pack itself is re-priced into EV/price 0.45–0.60.
   - **Friday boost:** `boostOf(promo, at)` runs from a wave's Friday 18:00 ET for 48 h. Program-slot odds go ×1.5, capped at 0.6, in **program packs, Headliners and Vault** alike.
   - `livePackDef` / the `headliners` and `vault` defs return `boost: { until } | null` and the boosted slots.
6. **Flash.**
   - **Lightning** keeps research's 25% off. `flashWindowsOf(week)` picks 2 of the 4 `defaults.flashWindows.slots`, seeded by `'flash:' + week`. The limit key format `lightning:<day>:<hour>` is unchanged.
   - **Named season flash sales** (`seasons[].flash`, unread today): `flashOffers(day, at)` parses
     - `"<pack>@-N%"` into a discounted Store price for the window, 1 per player, key `flash:<id>:<pack>`;
     - `"swap-desk 4-for-1"` into a swap size of 4 during the window.

     An unknown offer string is ignored and logged by a test, never thrown.
   - Flash offers may exceed the EV band, up to EV/price ≤ 0.75. Soccer's Lightning base price is raised to get there (0.84 today).
7. **Prices by value (M5).**
   - `PRICE_BY_VALUE[sport]` feeds `CONTENT_PRICES`, `PACK_SHAPE.price` and the studio floors.
   - Every sold non-chase item must have 10k-pack EV/price in **0.45–0.60**.
   - Chase items are listed apart: the Program Guarantee (EV ≥ 0.25), Vault (≥ 0.35), and Spotlight (packs-6).
8. **SBC value rules (research §8.8), `sbc.ts`.**
   - `coinValue` (D10). Output value ÷ input value, with the input as the cheapest fodder that satisfies the requirements:
     - Daily Upgrades 1.1–1.3×;
     - repeatables (Golden Hour, Elite Pull) 0.9–1.1×. Tune `size` / `teamOvr` / `minOvr`, keeping ids and list order.
   - The Flash SBC family doesn't exist yet (§10).

**Tests (suite `exploits`; `exploits.test.ts` + `soccer-exploits.test.ts`; plus `economy.test.ts`):**
- **EV band:** every sold non-chase item in every sport (Bronze, Silver, Gold, Premium, each Position/Unit key, Jumbo, Elite, Headliners, Standout Guarantee, the base program pack, every studio pack, Preview = Premium) sits in [0.45, 0.60] over 10k packs. Flash offers ≤ 0.75. Each guaranteed Standout costs ≥ the Standout Guarantee.
- **Market** over 60 days × 3 sports:
  - ≤ 1 item ≥ 83 a day, none > 86, no special;
  - every 83+ item priced ≥ 0.25 × `routeCost`.
- **Swap Desk:** 1 a day (4-for-1 inside a named window).
- **Preview:**
  - `previewStatus(at + 24 h − 1).ready === false` after a buy and after a skip;
  - the cards are identical across a Monday rollover;
  - an hourly-checking 30-day simulation buying only special previews gets ≤ 2.5 specials and ≤ 1 preview per 24 h.
- **Club Collection:** NFL Captains 1,000 clamps to ≥ 1,800; a sub-floor live catalog loads; an editor component test refuses a below-floor save and shows the minimum.
- **Program packs:**
  - guarantee ≥ 2.2× for every scheduled pack (NBA, NFL);
  - boost 1.5× inside the window and 1.0× outside, at Sun 18:00 ± 1 min;
  - boosted program row = min(0.6, 1.5 × base) ± 0.1 pt for program packs, Headliners and Vault.
- **Flash:** exactly 2 Lightning windows a weekend, deterministic, different across ≥ 50% of 52 weeks; the s4 "Big Game Flash" offers parse to the right prices and windows.
- **SBC value:** the bands above for every Daily Upgrade and repeatable, in every sport.

**Measurements:**
- `PACKSIM_LABEL=after-economy`: the EV/price table for every item and sport;
- Market 28-day max OVR (97 → ≤ 86);
- Swap picks a week (21 → 7);
- the D10 `routeCost` table.

**Screenshots:**
- the Market (NBA, soccer 393);
- a Program tile with BOOSTED (clock Friday 19:00 ET);
- the Lightning note;
- the admin editor's minimum line.

**Protocol:** none.

**Save-compat risks:**
- `preview.wk` is additive; if an old build strips it, the week re-binds once. Harmless.
- Market `bought[]` on release day points at new items (day-scoped). Noted.
- Lightning keys are unchanged.
- Pending studio packs keep their frozen recipe.

**Acceptance:**
- All tests pass in three sports, and the EV table is in band.
- `packs.md` has the coin-flow note (an engaged player's coins per pack-equivalent, before and after).

---

### packs-4 (P0): Odds engine and disclosure

**Why:** the brief's "Odds sheets everywhere … computed from the actual pack definitions, and a test must prove the sheet matches simulation"; owner decision 4 ("clear odds sheets"); audit H5, M4 (confirm), M8, L2; research §8.2/§8.3/§7 (every random reward shows odds first).

**Changes:**

1. **`src/ut/odds.ts` (new): the one source of published numbers.**
   - `slotDist(pool, slot, ctx)` gives each slot's exact distribution over (tier, displayed OVR). It covers:
     - position mix × curve × the `curvePick` resolution;
     - specials: uniform over the bucket, with the featured card's share and released program cards;
     - holo.
   - `oddsTable(pool, def, ctx)` returns `cards`, `slotsText`, `bands` (80, 82, 83, 84, 85, 86, 88+; "at least one"), `tiers`, `holo`, `featured` (`{ name, p }`, the headliner / featured card), `perSlot`, `boosted`, `effectiveProgram` (packs-6 fills it with pity), `notes` (strings) and `updated`.
   - Memoized per `(pool, def key, day)` and computed only when asked.
   - `routeCost(sport, ovr)` replaces packs-3's table.
   - `pickTable(pool, kind)` for Scout's, `front-office`, `pick-82`, `program-pick` and Standout picks.
   - `rewardOdds(pool, reward)` for random SBC/objective rewards ("a random 84+ gold", "a random Hot Season"). It is exported for ut's objectives.
   - `fmtPct(p)`: < 0.1% reads "less than 0.1%", ≥ 99.5% reads "100%", one decimal below 10%.
2. **Notes the sheet must carry** (each from the definition, not hand-written):
   - "Rare = shimmer only";
   - "Never a Standout you already own until you own them all", on packs with `avoid`;
   - "Gold slots skip cards you own at the same rating when another exists", on `preferUnowned` packs;
   - BOOSTED with countdown, showing the boosted number;
   - the Spotlight note (contract odds unchanged).
3. **`OddsSheet.tsx` + `odds-sheet.css` (new, lazy)**, replacing `Store.tsx OddsSheet`.
   - Layout: the slots text, then the "Chance of at least one" table (bands, then tiers, the featured row and holo), then the notes, then a PER CARD toggle.
   - Non-scrolling footer: "Each pack is independent. Updated <ODDS_UPDATED>."
   - Opened from:
     - every Store tile's "%" chip;
     - the Preview Pack;
     - pending "Your packs";
     - program packs;
     - BuyConfirm;
     - every random SBC reward chip in `Challenges.tsx`.
   - Scout copy: "Three different 84+ cards from the gold curve; each option is a Weekly Standout (84+) 3% of the time."
   - The Standout pick sheet says "each of this week's Standouts is equally likely" (M10; uniform 3 of 8 is kept, §13).
4. **BuyConfirm** (inside `Store.tsx`).
   - Packs ≥ 1,500 coins: art, price, the three most informative "at least one" rows, VIEW ODDS, and BUY / CANCEL.
   - "Don't ask again" stores `ut.content.prefs.skipBuyConfirm`, but never for a price ≥ 10,000. The pref writes through `pa.store.onPrefs`.
5. **Pack Tracker (`pull-log.ts`, `PullTracker.tsx`).**
   - `expectedFor` uses `oddsTable` exact expectations instead of simulating 160 packs at runtime.
   - Footnotes:
     - "Values are counted when pulled": `PullAgg.q` keeps pull-time QS, so old Spotlight/GOAT pulls still read 30;
     - "Walkout counts before <packs-9 date> used the old rule".
6. **Pack Helper (M8).** `pack-helper.ts` adds a RARE tag for shimmer golds. The visible rare treatment on the face is players'.
7. **Daily Drop blurb (L2)** shows the sheet's numbers.

**Tests (suite `odds`; `odds.test.ts` + `soccer-odds.test.ts`):**
- **Every sheet against simulation.** Every sold item plus Daily, Preview, a program pack (boosted and not), Headliners, Vault and each studio default: 10,000 seeded opens give every band, tier and featured row within ±1.5 pt of `oddsTable`, and holo within ±0.5.
- **Picks:** `pickTable` for every pick matches 10,000 option draws within ±1.5.
- **Rewards:** `rewardOdds` for every random SBC reward in the 60-day catalogue matches 10,000 `rewardCard` draws within ±1.5.
- **Route cost:** within 5% of packs-3's table.
- **Spotlight:** the sheet's tier rows equal `SPOTLIGHT_RATES` exactly.
- **Speed:** `oddsTable` ≤ 20 ms at 1× for every pack after warm-up.
- **Formatting:** `fmtPct` cases.
- **BuyConfirm:** "Don't ask again" is hidden at 10,000 and above.
- **Old saves:** `prefs` absent → confirm shown; a legacy-normalizer round trip loses only `prefs`.

**Measurements (Playwright, 393 and 320, three sports):**
- tile tap → visible sheet ≤ 150 ms at 4× throttle;
- 0 targets < 44, no text < 10, no overflow, 0 page errors.

**Screenshots:**
- the Premium sheet with PER CARD;
- the Scout's sheet;
- a boosted program sheet;
- BuyConfirm;
- an SBC reward odds sheet;
- the tracker footnote;
- NBA, NFL and soccer at 393 and 320.

**Protocol:** none.

**Save-compat risks:** `prefs` is additive and safe to lose.

**Acceptance:**
- The odds tests pass in three sports.
- Every buyable item and every random reward shows odds before it opens.
- QA is clean at both sizes.

---

### packs-5 (P0): Ratings truth

**Why:** owner decision 5 (binding); audit C3/C4 fix order item 4; the brief's P0 item 4 and P1 H7.

**Precondition:** the lead's answer to the packs-1 request.
- **Assigned:** edit `ut-scale.ts` so its promo knots express D3 (`editionDisplay` returns `min(95, seasonShown + d)`) and the legend knots match. Re-run `scripts/fit_ut_scale.ts`, `scripts/fit_ut_balance.ts` and the ratings audit, and commit their outputs.
- **Not assigned:** the **fallback**. D3 is implemented in `rate.ts`, which stops calling `editionDisplay` for promo and legend. The fit scripts run in report-only mode (outputs to `O/packs-out/fit/`), and `packs.md` records the stale knots for the lead.

**Changes:**

1. **Hot Season (D3), `rate.ts` promo branch** (NBA, NFL).
   - `hotSeasonDelta(line)` gives 3..6 from honors.
   - Displayed = `min(95, seasonShown + d)`; attrs = `editionAttributes(attrs, d, 99, false)`; `baseOvr = cap(baseOvr + d)`.
   - The face comes from the attributes. `faceLift` is deleted; the `supportShown` repair adds at most +2 per attribute, and only when the gap is > 1.
2. **Legends (D3).** The same rule with the line's boost, cap 95, no floor.
3. **GOAT/Spotlight (D4).** First run `promoattrs --feasibility` and commit its table to `packs.md`. Then:
   - `editionAttributes` special gain = `boost × (cap − v)/(cap − 60)` for v ≥ 80;
   - the shape-keeping `supportEdition`;
   - the tier floors.
4. **QS for Hot Season** becomes the D2 formula, and the D1 monotone test is re-run.
5. **Soccer (L4):** promo editions under 80 leave `pool.buckets.promo` (`pool.ts poolBuilder`, a one-hunk change). Owned copies still resolve via `base`. Soccer award editions stay as they are (D3).
6. **`CONTENT_PRINT` → `'ut-content-5'`.**
7. **The OVR diff (owner decision 5: "document every change").**
   - `scripts/packs/ovr-diff.ts` against the packs-1 fixture writes `docs/studio-overhaul/packs-ovr-diff.md`, generated with one row per changed id:
     - id, name, kind;
     - old/new OVR at levels 1–5;
     - old/new tier;
     - delta;
     - crosses 90.
   - `packs.md` carries the summary:
     - counts by kind × delta (−10 … +5);
     - the share of owned-possible ids affected;
     - max |face − played| per kind;
     - the list of ids crossing 90 (numbered eligibility).
8. **Numbered catalog: never regenerated.**
   - `--check` must still match. `numbered-*.json` and `supabase/functions/card-registry/numbered.json` are frozen, deployed contracts. We never write or deploy them.
   - A card that drops below 90 keeps its serial. The crossing list goes to the lead.
9. **Entry snapshots.** A test confirms that Cup and Club Season settlement read the entry-level snapshot (`ut.cup` entry rules), so a squad entered before the update isn't disqualified mid-run by a drop. ut's modules are only read.
10. **Attribute deltas for the sport teams.** `packs.md` gets a table per sport and position: the mean and max played-attribute change for Hot Season, Legend, Spotlight and GOAT, for Squad Battles balance (owner decision 3).

**Tests (suite `ratings-truth`; NBA and NFL; soccer for the bucket):**
- **Hot Season**, every edition at levels 1 and 5:
  - displayed = `min(95, seasonShown + d)` (+ the level bonus);
  - each face key satisfies `|face − round(toDisplay(attrs[key]))| ≤ 1`;
  - `|shown − round(shownFaceMean)| ≤ 1`.
- **Legend:** the same, with the line boost.
- **GOAT/Spotlight:**
  - ≥ 3 distinct face values;
  - ≤ 2 at the cap (the feasibility list excepted, ≤ 3);
  - Kendall τ ≥ 0.8 against the base card;
  - floors 100 / 106;
  - if the base face spread is ≥ 10, the weakest face ≤ strongest − 8.
- **Unchanged cards:** every edition *not* in {promo, legend, goat, spotlight} equals the packs-1 fixture (fingerprint-gated). Program, Standout and Landmark are unchanged.
- **Numbered catalog:** `--check` is identical, and the crossing list equals `ovr-diff`'s.
- **Quick-sell:** the D1 monotone test passes after the re-rate.
- **Soccer:** buckets have no promo < 80, and owned soccer promos < 80 still resolve.
- **Entry snapshots:** the Cup test above.

**Measurements:**
- `promoattrs` before/after: worst face − played per kind (Ferguson 99 vs 79 → ≤ 1);
- Brady at the cap 5/6 → ≤ 2/6;
- the delta histogram;
- `rate.test.ts` / `ratings-audit.test.ts` deltas, explained.

**Screenshots:** card detail for Ferguson HS, Nate McMillan HS, Michael Cooper Legend, and Brady and Kareem GOAT, before and after (NBA/NFL 393), side by side in `packs.md`.

**Protocol:**
- **Protocol bump needed: NBA UT and NFL UT**: Hot Season, Legend, Spotlight and GOAT played attributes change, with the exact deltas in `packs.md`.
- `CONTENT_PRINT` changes `pool.print` in all three sports. Soccer's separation rides on the soccer team's own UT bump (the lead bumps each sport once). No draft change.

**Save-compat risks:**
- Ids, copies, levels, XP and serials are kept.
- Displayed overalls drop for many Hot Season and Legend copies. That is deliberate (owner decision 5) and fully listed.
- SBC `teamOvr` uses the new numbers. A squad built for a requirement may need re-checking, which is expected.
- Cup entries keep their snapshot (tested).

**Acceptance:**
- The tests pass in NBA and NFL, and the soccer bucket test passes.
- The numbered check is identical.
- `packs-ovr-diff.md` and the summary are committed.
- `packs.md` carries the bump line and the delta table.

---

### packs-6 (P0): Bad-luck protection and the tier ladder

**Why:** the brief's P0 "Bad-luck protection" and P0 item 3 (rarity against rating); owner decision 4; research §8.4; the critic's ladder and pity findings.

**Precondition:** ut's answer on the earned Spotlight routes is recorded in `packs.md`. The ladder models whatever ut keeps.

**Changes:**

1. **Stamps (D7)**: `content-state.ts` (`stamps`, claim pinning), `pull-log.ts recordPull` (earning), and `src/ut/stamps.ts` (balance, floors, redemption).
   - **Earning:** 1 per 100 coins of the price paid, or of the store price for an earned pack. The Daily Drop, picks, the starter and `admin-*` packs give 0. A pulled special whose `line.id` was already owned gives +10.
   - **Shelf (NBA values; 1 stamp = 100 coins spent; each item worth 5–12% of that spend; none purchasable for coins):**

     | Cost | Reward | Value ≈ | % of spend |
     |---|---|---|---|
     | 50 | 1 of 3 82+ gold (G82) | 550 | 11% |
     | 120 | 1 of 3 85+ ("Stamp Scout", G85 floor; not the store's 84+ Scout's Choice) | 800 | 6.7% |
     | 300 | 1 of 3 of this week's Weekly Standouts | 3,300 | 11% |
     | 600 | Program Pick: 1 of 3 released program cards (live programs only) | 6,600–7,200 | 11–12% |

     The brief's "82+ picks or Scout's Choice" is the first two rows. Research's Program Pick is the last.
   - **Redemption:** `redeemStamps(ut, pool, item, uuid, day, at)` debits the balance and calls `awardPick` under `stamps:<item>:<cost>:<uuid>`, exactly once. A short balance returns null.
   - A minimal Store STAMPS section: the balance, "38/50 to your next pick", and four tiles. packs-8 restyles it.
   - Hooks go through `pa.store.onRedeem`.
   - The odds sheet footer says "This pack adds 18 stamps". `storeBadge` gains the `stamps` reason.
2. **Pity (D6, D7)**, `live-packs.ts`.
   - `pityState(ut, pack, day)` is recomputed from the pull log.
   - `pa.openOpts` adds `forceProgram` when `misses ≥ L − 1`.
   - `oddsTable.effectiveProgram` = D6, shown as the sheet's program row with "Program card guaranteed within N packs". The Program Hub shows it too, never beside BUY.
3. **`rankOf` (D1)** in `pool.ts`. `revealOrder` and `byValue` use it.
4. **Ladder levers (D5).**
   - **Legend:** the Elite Gold legend slot rises from 1% toward about 4.5%, until the rung sits in 40,000–55,000.
   - **Hot Season:** the weekly SBCs that pay `card:{tier:'promo'}` (Dynasty, Hall of Fame Class, Rival Dynasties, Hot Season Hunt) keep paying Hot Season (re-rated). Their fodder is tuned so the rung sits in 15,000–26,000, with ids and list order kept. The Premium promo slot stays 2%.
   - **Honors** (`s4-honors` and any promo with band top ≥ 96): program-pack odds ≤ 8% with pity, and the guarantee priced ≥ 40,000, 1 per wave. s4 starts 2027-01-15, after the cutoff.
   - **Spotlight:**
     - price = the D5 rung ÷ 0.20, rounded up to 1,000 (expected 25,000–30,000 NBA; × sport factor);
     - limit 1 a week via `pa.canBuy('spotlight')` in `startPromo`;
     - a pending reservation keeps its price;
     - the server's `SPOTLIGHT_RATES` are untouched, and nothing is deployed.
5. **Ladder model.** `scripts/packs/ladder.ts` + `ladder.test.ts` compute:
   - each rung's coins by cheapest coin route, using real defs, odds, pity, prices, limits and SBC fodder (D10);
   - each rung's days for the engaged and casual players (about 1,300 / 650 coins a day plus earned packs), including ut's earned routes (Circuit, Season Pass, chests) as answered in `packs.md`.

**Tests (suites `stamps` and `ladder`; `stamps.test.ts` + `soccer-stamps.test.ts`; `ladder.test.ts` + `soccer-ladder.test.ts`; pity NBA/NFL):**
- **Stamps earning:**
  - once per opening: a replayed pack id or a reloaded deposit earns 0;
  - 0 for Daily, picks and the starter;
  - earned packs at their nominal price;
  - +10 only for an already-owned special.
- **Redemption:**
  - the balance drops by the item cost, and exactly one pick sheet opens;
  - a repeat with the same uuid is a no-op;
  - a short balance returns null.
- **Old builds:**
  - a legacy-normalizer strip keeps `balance ≥ true balance − (stamps of packs beyond the newest 300 since release)`, and never above the true balance;
  - claim eviction by `slice(-5000)` keeps every `stamps:` claim.
- **Shelf:** each item's value ÷ (cost × 100) is in [0.05, 0.12] in every sport, and none is sold for coins.
- **Stamp pace:** the economy model gives engaged 50 in ≤ 3 days and 300 in ≤ 21 days; casual first 50 in ≤ 7 days.
- **Pity**, a pure counter process over 200k packs at p = 0.30:
  - per program card 1.38% ± 0.15;
  - per pack 0.42% ± 0.05;
  - max consecutive misses = 12.
  - For p = 0.07 and p = 0.20: L = 56 / 20, and the per-card pity share is 1.4–1.9%.
  - Integration: 2,000 real opens never exceed L − 1 misses.
  - The sheet's effective rate matches simulation ± 1 pt.
  - A natural program card resets the count.
- **Ladder:**
  - every NBA/NFL rung within its D5 band;
  - adjacent coin rungs ≥ 1.5× (exceptions per D5);
  - the day ladder monotone.
  - Soccer uses its subset (Standout, Hot Season, Legend; no programs, Spotlight or GOAT).
- **Economy:** `economy.test.ts` legend cadence is updated to the new Elite rate.

**Measurements:**
- the ladder table before/after (coins and days, NBA/NFL/soccer);
- stamps a day and days to each shelf item, casual and engaged;
- the new Spotlight price.

**Screenshots:**
- the STAMPS section (NBA 393, soccer 320);
- the redeem pick sheet;
- a program sheet with "guaranteed within 3 packs".

**Protocol:** none. Odds, prices and stamps only. `rankOf` changes sort order, not ratings.

**Save-compat risks:**
- `stamps` is additive and recoverable (D7).
- Pity has no state.
- The new claim family `stamps:*` is pinned.
- A Spotlight reservation keeps its price.
- Weekly SBC reqs change mid-week for SBCs not yet done; claims are by id.

**Acceptance:**
- The tests pass (stamps in three sports, pity in NBA/NFL, ladder per sport).
- QA redeems a pick end to end in NBA and soccer.
- The ladder table and the Spotlight price are in `packs.md`. The price is flagged in §12.

---

### packs-7 (P1): Promo content and the Program Hub (NBA/NFL)

**Why:** the brief's P1 "Promo cadence: two Friday waves a week apart", "Program Hub page … small exported API", "Promo sets … cap promo ratings by calendar season so they climb"; audit H6, H8, H9, M3, M10; research §8.5/§8.12.

**Changes:**

1. **Cutoff safety.**
   - `SHIP_DATE` and `PROMO_EDIT_FROM` (§1) with their test.
   - `scripts/packs/release-check.ts`.
   - `loadSchedule` failure becomes non-fatal: the pool loads without programs, and the Store says "This season's programs are offline".
2. **Season caps (D8).**
   - `seasonCap(promo)` and `standoutCap(week)`.
   - `live-cards.ts rateLive` uses `top = finale ? 99 : min(PROGRAM_CAP, seasonCap)`.
   - `standouts.ts` reads each season's `standouts.band`, clamped by `standoutCap`, for weeks from the cutoff.
   - Started promos and Standout weeks are pinned by the packs-1 fixture.
3. **Waves for every future program** (`live-calendar.json`, `start >= PROMO_EDIT_FROM`, only promos without `waves`):
   - Team 1 on the start Friday 18:00 ET and Team 2 seven days later, each about half the cards.
   - The headliner goes in Team 1.
   - Each wave triggers the packs-3 boost.
4. **Headliners and spread** (same promos):
   - `ovrBand` `lo = hi − 6`;
   - `featured: { count: 1 (count < 12) or 2, band: [min(hi + 2, cap), min(hi + 4, cap)] }` where it is missing;
   - bump `version`.
5. **Repeat caps** (`live-cards.ts selectPromo`). A cycle-wide usage map counts every earlier promo of the cycle, frozen ones included. The strict pass skips a candidate whose (pid, season) already has 2 editions this cycle, or whose pid already has 4. The relaxed pass fills a short promo and logs it.
6. **Fresh second cycle.**
   - The seed key uses `promo.id` (it carries `-y2`) instead of `baseId`.
   - `excludePrevious` is honoured for cycle-2 promos. They start 2027-11, so nothing live moves.
7. **Re-freeze** (`scripts/freeze_live_editions.ts --refreeze-from <date>`). It rewrites only promos from the cutoff, refuses an earlier date, and refuses any promo that has started by the machine's Eastern date. `--check` still verifies.
8. **Released-wave rewards (M3).** `programReward` draws only from released waves. With nothing released, it falls back to the wave-1 featured card.
9. **Standouts.**
   - `standoutReason(line)`: "MVP · 1st in scoring (30.1 PPG)", "All-Pro 1st team · 1,512 rec yds", with the best stat line as fallback.
   - It shows in `StandoutsView.tsx` and is exported for players' card back and for packs-9.
   - Soccer's weekly Standouts read **"Matchday Standouts"** via `pickFor` (ids unchanged).
   - `defaults.rhythm` text is corrected to Monday Standouts (M10). The Wednesday move is deferred, §10.
10. **`promo-hub.ts` implementation** (packs-1 contract):
    - `liveNow`, `upcomingDrops`, `launchDue` / `markLaunchSeen` (`seenDrops`, cap 200, safe to lose);
    - `storeBadge` adds the `wave` reason, for a new wave unseen in its first 48 h;
    - `programRewardCard` and `seasonPassCard`: released cards of the current season's programs; A ≈ cap − 3, B ≈ cap − 2, headliner = the featured card;
    - `resolvedEditions`.
11. **`ProgramHub.tsx` + `program-hub.css` (new, lazy, view `program`).** From top to bottom:
    - **Hero:** the released headliner (`UtCard` w = 190), the promo and wave label, a NEW WAVE tag in the first 48 h, a band chip, and a countdown to the next wave or the end.
    - **Waves:** released cards in a grid that opens the card detail. Future waves show as locked silhouettes in the accent at 40% with a countdown, never revealed early.
    - **Packs:** program pack and guarantee tiles with odds chip, BOOSTED, and the pity line from the sheet.
    - **SBCs:** this promo's SBCs, with the reward card face.
    - **Objectives:** an optional slot for ut's program objective group.
    - Hooks: the `program` view (2 lines in `UltimateTeam.tsx`, 1 in `nav.ts`: `program: { title: 'Program', tab: 'store', parent: 'store' }`). The Store hero and This Season tiles link to it.

**Tests (suite `promo-content`; `calendar.test.ts` extended; `promo-hub.test.ts`):**
- **Pinned past:**
  - the golden hash of every entry with `start < PROMO_EDIT_FROM` is unchanged;
  - every owned-possible started program and Standout id rates as in the fixture (fingerprint-gated);
  - `PROMO_EDIT_FROM > SHIP_DATE`.
- **Caps:**
  - every rated program card ≤ `seasonCap` (Finale 98–99);
  - every Standout from the cutoff ≤ `standoutCap`;
  - the cap sequences are non-decreasing.
- **Waves:** every promo from the cutoff has ≥ 2 waves 7 days apart, each wave ≥ 40% of the cards.
- **Spread:**
  - count ≥ 8 → ≥ 3 distinct OVRs;
  - count ≥ 6 → ≥ 1 featured card.
- **Repeats:** across the cutoff cycle and cycle 2, (pid, season) ≤ 2 and pid ≤ 4 (before: MJ '88 ×8, LeBron ×14). Cycle-2 promos share ≤ 20% of pids with their cycle-1 base.
- **Rewards:** `programReward` never returns an unreleased card over 200 random days.
- **Hub API:**
  - `liveNow` on 2026-11-14 and 2027-01-16 lists the right drops with ends ≥ now and never an unreleased id;
  - `launchDue` returns each wave once, then null after `markLaunchSeen`;
  - `storeBadge` counts a wave, the free Daily Drop and redeemable stamps.
- **Offline:** a `loadSchedule` rejection leaves a working pool.
- **Freeze:** `freeze_live_editions --check` passes.

**Measurements:**
- `promos.ts` before/after: per-promo OVR spread, headliner presence, the top-10 repeated players;
- the Program Hub in Playwright at 393/320 (0 errors, no target < 44, no overflow).

**Screenshots:**
- the hub top and bottom (clock 2026-11-14 19:00 ET and 2027-01-16, NBA and NFL; 393 and 320);
- StandoutsView reason lines;
- soccer "Matchday Standouts".

**Protocol:** NBA/NFL `pool.print` changes via the schedule `version`. No released card's rating changes. This rides on the packs-5 bump.

**Save-compat risks:**
- `seenDrops` is additive and safe to lose.
- Started promos are pinned.
- Cycle-2 ids aren't live until 2027-11.

**Acceptance:**
- The tests pass in NBA and NFL; soccer's label test passes.
- The freeze check and release-check are green.
- The hub QA is clean.
- The API contract in `packs.md` is updated to "implemented".

---

### packs-8 (P1): Long pages: Store, pack art and SBCs

**Why:** UT-UI M4 (Store 3.8, SBC 5.7–6.7 screens) and H3 (Gold, Captains, Dynasty, Elite and Jumbo near-identical; thumbnail labels at 3.5–5.5 px); the brief's "Long pages (M4) for Store and SBC"; research §8.12.

**Changes:**

1. **`SectionNav` (new, in `store.css` / `sbc-page.css`)**, one component for both pages:
   - sticky chips at `top: var(--ut-sticky-top, 0px)`;
   - scroll-spy via `IntersectionObserver`;
   - taps ≥ 44 through `::before`;
   - instant jumps under reduced motion.
2. **Store IA (`Store.tsx`).**
   - Chips: FEATURED · THIS SEASON · DAILY · PACKS · PICKS · STAMPS · CLUB COLLECTION.
   - Order:
     1. Your packs
     2. **Featured hero**: the live program pack, else Headliners. Art ≥ 120 design px, the BOOSTED / NEW WAVE tag, the odds chip, and a link to the hub.
     3. This Season
     4. Daily (Daily Drop, the Market link)
     5. Packs, ascending price
     6. Picks & Preview
     7. Stamps
     8. Club Collection
     9. PULL HISTORY
   - Coin numbers use `toLocaleString('en-US')` on our tiles and the Market. The wallet pill is ut's header: requested, not edited.
   - Unaffordable tiles are disabled with "Need N more".
   - BEST VALUE goes on the highest EV/price sold non-chase pack, computed lazily (§1 Performance).
3. **Pack art for every kind (`PackArt.tsx`, `pack-art.css`).**
   - One table `PACK_LOOK[kind] = { pattern, accent: [a, b], label }`, with 15+ kinds distinct in both pattern and accent: Bronze, Silver, Gold, Premium, Jumbo, Elite, Daily, Standout, Lightning, Position/Unit (NFL reads UNIT), Roster, Captains, Dynasty, Spotlight, Preview, Headliners, Vault and Program.
   - Program patterns use `hashString(promoId) % N` over original SVG patterns: stripes, chevrons, dots, waves, grid and diamonds.
   - Labels are fit by character count onto two lines. Below a 72-design-px tile width the label is dropped and an `aria-label` carries it, so no visible label is under 10 design px.
4. **SBC page (`Challenges.tsx`, `sbc-page.css`).**
   - Category tiles: This Season, Standouts & Landmarks, Daily, This Week, Upgrades. Each shows its count, NEW, an amber "ends in < 24 h" marker and a DONE count.
   - `SectionNav` mirrors the tiles. Sections other than This Season and Daily start collapsed, with a "Show N" row.
   - **Reward previews:** a `cardId` / program / Standout reward shows the actual face (`UtCard` w = 56; the featured card for random Standout/program). Packs show `PackArt` small; random cards show a "%" chip into `rewardOdds`; coins show a coin chip.
   - **"1 card away":** `nearlyDone(s, club)` in `sbc.ts` is true when `autoFill` fills `size − 1` cards under every per-card requirement. A "Ready / 1 card away" row goes first.
5. The STAMPS section gets its final look (from packs-6).

**Tests:**
- `sbc-page.test.ts`: `nearlyDone` true and false fixtures; category counts equal the list.
- `pack-art.test.ts`:
  - no two kinds share pattern and accent;
  - the longest program name per sport fits two lines at full size without truncation;
  - below 72 px the visible label is absent and `aria-label` is present.
- `store-ia.test.ts`: section order; BEST VALUE equals the max EV/price item; unaffordable tiles show "Need N more".

**Measurements (Playwright, three sports, 393 and 320):**
- Store ≤ 3.0 / ≤ 3.5 screens;
- the first viewport shows wallet, chips and a hero with art ≥ 120 design px;
- Store first render has no long task over 200 ms at 4×;
- SBC page ≤ 2.5 / ≤ 3.0 screens on open, every SBC reachable in ≤ 2 taps;
- 0 targets < 44, no text < 10, no overflow, 0 page errors;
- reduced motion: no smooth scroll and no hero animation.

**Screenshots:**
- Store top, the hero, chips stuck mid-scroll, and the pack-art sheet of all kinds (full and thumbnail);
- SBC top, a reward face, a "1 card away" chip, an expanded section;
- NBA, NFL and soccer at 393 and 320.

**Protocol:** none.

**Save-compat risks:** none (UI).

**Acceptance:**
- The tests pass.
- The page-length and performance targets are met.
- Screenshots are reviewed.

---

### packs-9 (P1): Pack opening that hits

**Why:** the brief's P1 "three cinema levels", "Multiple walkouts", "M2: management after opening" and the promo presentation fixes; audit H6, M1, H9, L1, L5; UT-UI M2; research §8.2 (pick reveal order) and §8.11.

**Commit A: presentation (no state changes)**

1. **Cinema levels.**
   - `cinemaLevel(cards)` / `walkoutLevel(rc)` per D11.
   - `packSequence(level)` beats:

     | Level | Beats | Total to Continue |
     |---|---|---|
     | 0 | tear 450, fan-out flips at a 70 ms stagger | ≈ 1.2 s |
     | 1 | tear 600, teal flare 300, position 450, team 700, slam | ≈ 2.6 s |
     | 2 | tear 680, flare ≤ 400 ms, era, position, crest, OVR count-up (60 ms/pt over the last 6), walk-in | ≈ 4.2 s |
     | 3 | as level 2 with a white flare and an extra crest beat | ≈ 5.0 s |
     | 4 | GOAT, unchanged | 6.6 s |

   - Each ± 15%.
2. **Flares.** `flareFor(rc)`:

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

   - The flare shows by 1.0 s after the tear.
   - Two flares only when ≥ 2 cards are level ≥ 2. One special never shows two.
3. **Walkout queue.**
   - Up to **3** full walkouts, ascending, best last. Further specials flash inside the grid.
   - SKIP (to the next) and SKIP ALL (to the grid), both visible within 100 ms of the first walkout.
   - Total cinema ≤ 12 s before SKIP ALL.
4. **Order.** Packs ≤ 8 cards reveal ascending with the walkout card(s) last. Packs ≥ 9 cards: walkouts first, then the grid by OVR descending with Pack Helper tags.
5. **Program walkout (H6).**
   - The stamp reads `<PROMO NAME> · <wave label>` on the accent scenery (`ut-prog-scenery` in `pack-cinema.css`), never "PROGRAM".
   - The Standout stamp shows `standoutReason`. Soccer reads "MATCHDAY STANDOUT".
   - **L1:** the pulse line no longer crosses the "WEEKLY STANDOUT · WK 46" eyebrow, which moves above the line.
6. **Headline.** `revealHeadline(cards)` counts every tier ("12 cards · 1 Program · 3 rare golds · 8 golds"), adds "Best: 97 Name" and the total QS.
7. **PickSheet (research §8.2, §8.11).**
   - The best option flips last.
   - A crack + light-burst stinger (`pack-sound.ts`) plays when the best option is level ≥ 2.
8. **Sound and haptics (`pack-sound.ts`).**
   - `packSound` cues pitched by level, a tick per flip, and the stinger at level ≥ 2.
   - `vibrate` light at level ≥ 1 and heavier at level ≥ 2, gesture-gated.
   - Silent when sound is off.
9. **Reduced motion.** A static card with its coloured edge, the OVR at once, the grid at once; no flares, no chained walkouts.
10. **Dev fixture.** `fixture:<ids>` pending kind, under `import.meta.env.DEV` only (§1 Browser QA).
11. **Pack Tracker** footnote date set (packs-4).

**Commit B: post-open management (uses existing sell/storage paths; no new saved state)**

12. Tapping a grid card opens an action sheet:
    - VIEW;
    - QUICK SELL +N: two-step for specials, 90+ or numbered cards, never for locked;
    - STORE / SEND TO CLUB for duplicates.
13. **Bulk bar:** QUICK SELL ALL UNDER [75 | 80 | 82], a segmented control with 44-px segments. It never touches specials, locked, new-to-club or squad-upgrade cards, and confirms with the total.
14. **Follow-ups (M1).**
    - OPEN NEXT (n left) when other openable pending packs exist.
    - BUY AGAIN for store packs: disabled when short or at the limit, and never shown for prices ≥ 10,000.
    - TAP TO CONTINUE and QUICK SELL DUPES ≥ 44 design px. SKIP is shell's.
15. All handlers come through `pa.opening` (`onSell` = existing `quickSell`, `onView`, `onStore`, `onToClub`, `onNext`, `onBuyAgain`). There are no new `UltimateTeam.tsx` lines beyond the packs-2 spread.

**Tests:**
- `pack-cinema.test.ts`:
  - D11 table cases (the 82 Standout → 1; featured → 2; HS 84 → 2; HS 90 → 3; Legend 81 → 3);
  - `flareFor` is monotone by `rankOf`;
  - two flares only with ≥ 2 level-2 cards;
  - the walkout queue caps at 3;
  - order rules for 5-, 8-, 12- and 16-card packs;
  - `revealHeadline` cases;
  - the PickSheet best-last order;
  - the reduced-motion class.
- `pack-actions.test.ts`:
  - bulk sell never includes the protected classes;
  - a two-step confirm is required for specials;
  - OPEN NEXT counts only openable pending packs.

**Measurements (Playwright, NBA, NFL and soccer, 393 and 320; fixtures per §1):**
- tap → Continue per level (`data-phase` timestamps) within ± 15%;
- flare ≤ 1.0 s after the tear;
- SKIP and SKIP ALL respond ≤ 100 ms;
- 2 specials → 2 walkouts and 2 flares;
- 4 specials → 3 walkouts plus a grid flash, ≤ 12 s;
- reduced motion: grid visible ≤ 300 ms;
- a 32-card NFL Jumbo with the bulk bar and OPEN NEXT has no overflow at 320;
- 0 targets < 44, 0 page errors.

**Screenshots:**
- each level mid-flare and at the card;
- a double walkout and the program walkout stamp;
- a Matchday Standout;
- the grid with the action sheet and the bulk bar;
- OPEN NEXT / BUY AGAIN;
- the PickSheet final flip;
- the reduced-motion grid.

**Protocol:** none.

**Save-compat risks:**
- Selling from the reveal goes through the existing `quickSell` / `removeCards`, so numbered retirements queue as today.
- The `walkoutLevel` meaning changes for the Pack Tracker's `w` counts: the footnote covers it.

**Acceptance:**
- Commit A: its tests and measurements pass.
- Commit B: its tests pass.
- Screenshots are reviewed, and reduced motion is verified.

---

### packs-10 (P1): Final QA, bundle, docs and the integration re-baseline kit

**Why:** BUILD-RULES' final QA task; the critic's integration and bundle findings.

**Changes:**

1. **Full checks**, each once, via heavy.sh: `npm run typecheck`, then `npm test` (three sports), then `npm run build`.
2. **Bundle.**
   - From the build's chunk report: first-paint +0 bytes; UT chunk +≤ 25 KB gzipped against the base build; no new dependency.
   - `grep -r "fixture:" dist/` finds nothing.
3. **QA walk** (`scripts/packs/qa-packs.mjs`, from the audit harness):

   > Store → odds → confirm → open (levels 0–4 via fixtures) → management → Program Hub → stamps redeem → SBC page → submit with warning

   - Three sports, 393×852 (59/34) and 320×568.
   - 0 page errors, 0 targets < 44, 0 text < 10, no overflow, no non-localhost request except fonts.
   - Reduced-motion pass.
4. **Final numbers.** Re-run `packsim`, `promos`, `promoattrs`, `ladder` and `ovr-diff` with `PACKSIM_LABEL=final` and check every §3 target.
5. **Coin flow.** One table of packs' contribution to coins-equivalent per day (casual / engaged), before and after: stamps shelf, Headliners/Vault, prices, SBC value rules, Spotlight. It is handed to the lead to merge with ut's (Circuit pay, Rivals, chests, pass), because nobody else owns the combined number.
6. **Integration re-baseline kit** (`scripts/packs/rebaseline.ts` + a checklist in `packs.md`). The lead runs it after merging the nba, nfl, players and ut branches. It:
   - recomputes `FOREIGN_FINGERPRINT`;
   - re-runs packsim/odds/ladder/promoattrs, the numbered `--check` and the started-promo pins;
   - writes a diff report;
   - with `--accept`, regenerates the packs fixtures after review.

   Expected diffs and what each means are listed, for example: "a sport team's ratings change → OVR diff rows outside promo/legend/goat/spotlight; numbered crossings → tell the lead, never regenerate".
7. **Docs.**
   - Finish `docs/studio-overhaul/packs.md`:
     - before/after tables;
     - tests added;
     - Protocol bump lines and attribute deltas;
     - touched outside my lane (every hunk);
     - owner device checks;
     - the API contracts;
     - requests and answers;
     - unwired calendar keys (`seasons[].pass.top`, `events`, `moments`, `checkIn` and `checkIn.final`: ut's or deferred F2);
     - what is left undone.
   - Update `docs/PACK-CINEMA.md`, `docs/PULL-TRACKER.md` (stamps, pity, footnotes) and `docs/UT-CONTENT-2.md` (an addendum: curve, tiers, odds, caps, waves).

**Acceptance:**
- Full `npm test` and the build pass.
- The bundle budget is met.
- QA is clean in 3 sports × 2 sizes.
- The re-baseline kit runs green on our own branch.
- `packs.md` is complete and pushed.

---

## 6. New saved state (all optional under `ut.content`; normalised in `content-state.ts`)

| Field | Shape | Task | If an old build strips it |
|---|---|---|---|
| `preview.wk` | ISO week | packs-3 | re-binds to the current week once; harmless |
| `prefs` | `{ skipBuyConfirm?: boolean }` | packs-4 | confirm shows again; harmless |
| `stamps` | `{ earned, spent }` | packs-6 | recovered from the pull log and `stamps:` claims (D7); bounded loss, tested |
| `seenDrops` | `string[]` (cap 200) | packs-7 | a wave's NEW tag shows again; harmless |

- **Pity has no saved state** (recomputed from the pull log).
- **New claim families:** `stamps:<item>:<cost>:<uuid>` (pinned at the end of `claims`).
- **New buy-limit keys:** `headliners:<day>`, `vault:<week>`, `spotlight:<week>`, `roster:<day>`, `captains:<day>`, `dynasty:<week>`, `flash:<id>:<pack>`.
- **No new pending-pack id families.** New kinds may be pending awards per D9.
- No storage key, card/edition/copy id, uid format or existing field meaning changes.

## 7. Contracts and hand-offs

- **To ut:**
  - `promo-hub.ts` (types and stubs in packs-1; implemented in packs-7);
  - `stampsBalance` (packs-6);
  - `storeBadge` for the Store tab;
  - `awardPick` kinds `front-office` / `pick-82` / `program-pick` (packs-2);
  - `rewardOdds` for objective rewards (packs-4);
  - `programRewardCard` / `seasonPassCard` / `resolvedEditions` (packs-7);
  - D9's ruling on awarding `headliners`.
  - Requests:
    - Circuit 6-0 and Pass level 25 → Program Pick;
    - new state under `ut.hq`;
    - wallet pill thousands separator in the header;
    - the D12 modal order for the later takeover;
    - `labels.ts` names (we route new strings through it once it exists);
    - This Season banner in soccer stays hidden until F1.
  - Hooks we add to `UltimateTeam.tsx` / `nav.ts`: the packs-2 integration hunk, the one-liners in `openNow` / `buy` / `buyLive` / `startPromo`, and the packs-7 `program` view. All are listed in `packs.md`.
- **To players:**
  - holo Regular (≤ 87) / Pristine (88+) looks;
  - per-program frame accents (`line.accent`, `PACK_LOOK`);
  - `standoutReason(line)` for the card back;
  - GOAT faces now vary (D4);
  - `supportOverall` edits are match-rating changes.
- **To shell:**
  - `--ut-sticky-top`;
  - SKIP stays shell's, and the rest of the pack-screen buttons are ours;
  - `var(--sat)` for our full-screen layers;
  - nothing of ours changes pool loading;
  - `pool.ts` gets two content hunks only (the soccer bucket filter and `CONTENT_PRINT`, plus `rankOf` next to `TIER_RANK`).
- **To nba / nfl:** the packs-5 attribute delta table (Squad Battles balance, owner decision 3).
- **To the lead:**
  - the protocol bumps (§8);
  - the `ut-scale.ts` / fit-scripts assignment;
  - `SHIP_DATE` and `PROMO_EDIT_FROM` (release-check);
  - the numbered crossing list;
  - the re-baseline kit;
  - the coin-flow table;
  - §12.

## 8. Protocol summary (copy into `packs.md` as the tasks land)

- **Protocol bump needed: NBA UT and NFL UT** (packs-5). Hot Season, Legend, Spotlight and GOAT played attributes change (D3, D4). `CONTENT_PRINT` → `ut-content-5`.
- **`pool.print` changes in all three sports** with `CONTENT_PRINT`. Soccer's UT separation rides on the soccer team's own bump (one bump per sport, by the lead).
- packs-7 changes NBA/NFL `pool.print` again via the schedule `version` (future promos only). This rides on the same bump.
- No draft protocol change.
- packs-1, 2, 3, 4, 6, 8, 9 and 10 change no match rule or rating.

## 9. Scope mapping (nothing silently dropped)

| Brief item | Task |
|---|---|
| P0.1 QS, auto-fill, confirm warning, tests | packs-1 |
| P0.2 Market Hot Season | packs-3 |
| P0.3 Rarity against rating; Spotlight 20%; finale over a routine pack | packs-6 (D5), packs-5 (re-rate) |
| P0.4 Hot Season shown vs used | packs-5 |
| P0.5 Preview, admin packs, program pricing | packs-3 |
| P0.6 Soccer NFL SBCs and the guard | packs-1 |
| P0 gold curve with packsim before/after | packs-2 |
| P0 guarantees as floors; rare = shimmer | packs-2 |
| P0 odds sheets, Scout fix, View Odds before purchase, simulation test | packs-4 |
| P0 Scout Stamps and the 13th-pack guarantee | packs-6 (D6 scales the 13 by odds) |
| P0 Program Bag (optional) | deferred (§10) |
| P1 two Friday waves, weekly in-forms | packs-7 (waves), packs-3 (boost); in-forms = Weekly Standouts (exist) |
| P1 launch moment, Program Hub, API for ut | packs-7 (hub, API), packs-8 (hero), D12 (badge); takeover deferred F3 |
| P1 program walkout name; whole-pack headline; no full walkout for an 82 Standout | packs-9 |
| P1 promo sets: spread, repeats, season caps; owned ids kept | packs-7 |
| P1 re-rate accurately, document every change | packs-5 |
| P1 H7 walls of 110s | packs-5 |
| P1 Live Calendar: flash windows | packs-3 |
| P1 Live Calendar: check-in, Season Path, extra pass tiers | deferred F2 (§10) |
| P1 soccer calendar and program names | deferred F1; Matchday Standouts naming ships in packs-7/9 |
| P1 cinema levels, colour first second, two flares, best last, truthful cues, Skip, reduced motion | packs-9 |
| P1 multiple walkouts | packs-9 |
| P1 M2 management after opening | packs-9 |
| P1 long pages: Store and SBC | packs-8 |

| Audit (packs/promos) | Task |
|---|---|
| C1, H4 | packs-1 |
| C2, H1, H2, H3, M2, M5 | packs-3 |
| C3 | packs-5, packs-6 |
| C4, L4 | packs-5 |
| H5, M4 (confirm), M8, L2 | packs-4 |
| M6, L1 (labels) | packs-8 |
| L1 (pulse line) | packs-9 |
| H6 | packs-8 (art, hero), packs-7 (hub), packs-9 (walkout, headline) |
| H7 | packs-3 (flash), F1 (soccer), F2 (check-in, path) |
| H8, M3 | packs-7 |
| H9 | packs-9 (threshold), packs-7 (reason line) |
| M1, L5 | packs-9 |
| M7 | packs-2 (avoid, `preferUnowned`), packs-6 (duplicate stamps) |
| M9 | ut, with `seasonPassCard` |
| M10 | packs-7 (rhythm text), packs-4 (pick disclosure) |
| L3 | QA rules in every task |

**UT-UI audit:**
- M2 → packs-9.
- H3 → packs-8.
- H7 → packs-5.
- M4 (Store, SBC) → packs-8.
- M6 (pack targets) → packs-9 for ours, shell for SKIP.
- M12 → `resolvedEditions` (packs-7).

**Research:**
- §8.1 → packs-2.
- §8.2 tiers, picks, holo → packs-2; boost → packs-3; pick reveal order → packs-9.
- §8.3 → packs-4.
- §8.4 → packs-6 (bag deferred).
- §8.5 caps → packs-7; soccer → F1; Momentum and the Wednesday move are deferred.
- §8.7 Season cards → `seasonPassCard`.
- §8.8 value rules → packs-3; the confirm → packs-1; Legend SBC → F4.
- §8.11 → packs-9.
- §8.12 Store and Program Hub → packs-8 and packs-7.

## 10. Deferred, with reasons

**Follow-ups with full specs, ready for the lead to schedule after integration (each one session):**

### F1. Soccer Live Calendar

- **Why deferred:**
  - it is the biggest data-authoring job in the stream (12 seasons of JSON plus a frozen manifest);
  - it needs shell's per-sport offline precache (P-2) to include the new lazy JSONs;
  - it needs its own `soccer-*.test.ts` suite;
  - it adds soccer program editions, a soccer UT protocol change best taken in one bump with the soccer team's engine change.

  None of that fits the 10-task cap without dropping a P0.
- **Spec:**
  - `src/data/live-calendar-soccer.json` + `live-editions-soccer.json` (same schema). `calendar.ts loadSchedule` imports them inside the lazy soccer chunk. A load failure is non-fatal (packs-7 already makes it so).
  - Fixes: `per()`, `shiftWaves` and `parseLiveId` must accept `soccer`.
  - 12 Monday-aligned seasons from the first Monday after ship, with research §8.5's original programs:
    - Opening Day (`career:first`);
    - Derby Days (`{pair}` same club);
    - Golden Boot Race (`honor:BOOT | stat:g>=20`);
    - Winter Fixtures;
    - Midseason XI (`honor:POTY|UEFA|BDOR`; cap 97);
    - Wonderkids (`careerYear:1-2`);
    - Knockout Nights (`honor:UCL`);
    - Title Run (`honor:CHAMP`);
    - Season XI (5 league waves);
    - Summer Tournament.
  - Two Friday waves each, D8 caps, no Landmarks or Finale.
  - Data coverage is checked against `docs/SOCCER-DATA.md`.
  - Tests: `soccer-calendar.test.ts` (loads only in soccer, every rule compiles, every promo selects ≥ 90% of its count, packs open, SBCs list, the freeze `--check`).
  - Lazy JSON ≤ 10 KB gzipped.
  - "Protocol bump needed: soccer UT".

### F2. Live Calendar check-in days, Season Path and extra pass tiers

- **Why deferred:** `defaults.checkIn` pays about 2,550 coins plus Gold, Premium, Scout, Elite, Jumbo and a program pick a season, and Season Path adds more. That is roughly +100% coins-equivalent for a casual player, while ut adds Circuit pay per win, Rivals rewards, chests and a 30-level pass. Nobody owns the combined coin flow until integration. Ship it once the lead has packs-10's coin-flow table, with rewards sized to ≤ +15% (engaged) / ≤ +25% (casual).
- **Spec:**
  - Rename to **"check-in days"**, so it never collides with Scout Stamps.
  - The count is derived from `ut.hq.days`: distinct Eastern days with ≥ 1 UT match, capped at 10. Ask ut to keep ≥ 35 days of `hq.days`.
  - Claims `cal:checkin:<season>:<n>`, honouring per-season `checkIn.final` overrides (for example `live-pick:s4-honors:3`).
  - Season Path goals from `hq.days` only (no new state).
  - Rows in the Program Hub, plus `calendarClaimables` / `claimCalendar` / `calendarPassExtras` for ut's inbox and pass (`seasons[].pass.top`).

### F3. The promo launch takeover (`PromoLaunch.tsx`)

- **Why deferred:** D12. ut owns modal order and is rebuilding first-run (UT-UI M7). This round's launch moment is the badge, the hero and the hub.
- **Spec:**
  - Full screen: accent gradient, "<PROGRAM> · WAVE 2 IS LIVE", 3 face-down cards flipping to the headliner, countdown, SEE THE PROGRAM / LATER.
  - Once per drop (`launchDue` / `seenDrops`, already shipped). Mounted by ut's modal queue after first-run and the inbox.
  - Top controls below `var(--sat)`; reduced motion static; focus trap.

### F4. Monthly Legend SBC (multi-segment)

- **Why deferred:** research specifies it as about 2–3 weeks of play with a segment progress bar. Revision 1's single 11-card team-84 SBC (fodder about 3–6k QS) would be the cheapest Legend route and break the D5 ladder. The ladder is held by pack levers instead.
- **Spec:**
  - 3–4 segments under `sbc:legend:<yyyy-mm>:<seg>`, with fodder valued by D10 so the total sits inside the Legend rung (40,000–55,000).
  - A segment bar on the SBC page.
  - The reward is labelled **"Legend Pack"**, never "Icon".

### F5. Open All (many pending packs)

- **Why deferred:** research §7 lists batch pulls among the patterns to avoid stacking with pity and discounts. It also needs `openMany` state handling and a virtualized combined grid (100–300 `UtCard`s with players' new canvas portraits) to stay under 500 ms at 4× CPU. The per-pack SKIP / OPEN NEXT flow covers the pain this round.

**Not planned this stream:**
6. **Program Bag** (optional in the brief). Its keys come from ut's program objective group and weekly 6/6 chest, which don't exist yet; stamps and pity already cap bad luck.
7. **Legend base/mid/prime versions.** These need new card lines from data build scripts (lead-only data files).
8. **Spotlight/GOAT chase odds** (`SPOTLIGHT_RATES`). A shared server contract; never deployed by us. Only price and limit change.
9. **Themed Standout selection.** There is no game-level data, and it risks mid-week reshuffles. Reason lines ship instead.
10. **Standouts on Wednesday** (M10 first half). The ISO week is part of Standout ids and of claim and limit keys across ut modules. Monday stays, and the rhythm text is fixed (packs-7).
11. **Momentum cards** (research §8.5). Per-copy upgrades belong with ut's Evolutions and need a protocol bump.
12. **New SBC families** (Foundations, Rivalry Puzzles, Flash SBCs). Outside the stream scope. The value rules for existing families ship (packs-3).
13. **Duplicate → 3× QS auto-swap.** Duplicate stamps (+10) cover the same pain.
14. **Holo looks and the card-back reason line.** Card faces are players'. We supply the data.
15. **Global Lightning stock.** It needs a server; per-player limits stay.
16. **Share poster from the reveal.** `poster.ts` is players'.
17. **Soccer award editions uplift** (L4 second half). They already average season +3.3, inside D3's +3..+6 "accurate" rule. Raising them would contradict owner decision 5 and needs lead-only data files. Their look is a players' frame matter.

## 11. Owner device checks (only a real iPhone can confirm)

- Pack-opening feel and length at each level; haptics on levels 1–2; SKIP and SKIP ALL feel instant; a 3-walkout pack doesn't drag.
- Odds sheets readable at arm's length: band rows, PER CARD, the notes.
- The Store sticky chips sit just under the header after shell's top-edge fix, and the featured hero looks premium.
- The re-rated Hot Season and Legend cards read as legit: numbers match play, and GOAT faces vary. Owned cards that dropped are listed in `packs-ovr-diff.md`.
- The Program Hub countdowns are correct in Eastern time.

## 12. Open decisions for the lead and owner (flagged, not acted on)

1. **The re-rate is visible to players.** Many owned Hot Season and Legend cards will show lower overalls (owner decision 5 says yes). Confirm that the owner expects that, with the generated list.
2. **Spotlight pack price.** It is set by D5: expected 25,000–30,000 coins (NBA), 1 a week, from 3,500. The ladder test enforces the minimum. The owner may prefer fewer Spotlights at a lower price instead; the rung is what matters.
3. **`ut-scale.ts` and the fit scripts assignment** (packs-5 precondition).
4. **`SHIP_DATE` / `PROMO_EDIT_FROM`.** Move them together if shipping after 2026-11-27. Never earlier.
5. **The earned Spotlight routes** (ut's Circuit 6-0 and Pass level 25) → Program Pick.
6. **Scheduling F1–F5** after integration.

---

## 13. Critique response (revision 1 → 2)

### Missing

| # | Point | Response |
|---|---|---|
| 1 | Re-rate per owner decision 5; ovr-diff artifact | **Accepted.** D3 and packs-5. Hot Season → season + 3..6, cap 95; Legends the same; Honors kept 94–97. `ovr-diff.ts` writes the generated `packs-ovr-diff.md` with every changed id at levels 1–5 (a separate file because about 2,000 rows would bury `packs.md`), and `packs.md` holds the counts by kind × delta. |
| 2 | fit_ut_* re-runs; `ut-scale.ts` unassigned | **Accepted.** A packs-1 request to the lead and the packs-5 precondition, with a rate.ts-only fallback and report-only fit runs. |
| 3 | Cheap 83+ routes (rewardCard, Market, Swap Desk) | **Accepted.** `rewardCard` on G82–G88 (packs-2); Market ≤ 1 83+ a day, ≤ 86, ≥ 25% of route cost; Swap 1 a day (packs-3). |
| 4 | SBC value rules; Legend SBC too cheap | **Value rules accepted** (packs-3, D10, tested). **Legend SBC deferred** (F4), re-specified as multi-segment inside the Legend rung. |
| 5 | Weekly Standout caps; `standouts.band` unread | **Accepted.** D8 and packs-7. |
| 6 | Program caps must climb; S7–S11 98 | **Accepted.** The D8 non-decreasing table; Hot Season ≤ 95 after D3. |
| 7 | Two Friday waves for every program | **Accepted.** packs-7 item 3, with a test. |
| 8 | Unread calendar keys | **`seasons[].flash`** is implemented (packs-3). **`pass.top`, `events`, `moments`** are reported unwired in `packs.md` (ut's). **`checkIn.final`** is in F2's spec. |
| 9 | Rhythm text; `standoutOptions` weighting | **Rhythm text fixed** in packs-7. **Weighting rejected:** a uniform 3 of 8 is honest and simple. The pick sheet now discloses "each of this week's Standouts is equally likely" (packs-4). |
| 10 | ut contracts (objective/pass cards, pick kinds, store badge, editions list) | **Accepted.** All are in packs-1 as types and stubs, implemented in packs-2 / 4 / 6 / 7. |
| 11 | Headliners awarded as pending packs by ut | **Accepted** as D9, decided by a test on today's code in packs-1, with `jumbo` as the fallback. |
| 12 | Distinct pack art for every kind; tiny labels | **Accepted.** packs-8 `PACK_LOOK`, with labels ≥ 10 px or an `aria-label`. |
| 13 | Slot table gaps; Scout copy | **Accepted.** The packs-2 table covers every source. Scout's Standout options are ≥ 84, and the copy says so. |
| 14 | Odds disclosure gaps (rewards, featured row, avoid, pity/boost rows) | **Accepted.** packs-4 (`rewardOdds`, featured row, notes, boosted numbers) and packs-6 (effective program row). |
| 15 | PickSheet best-last and stinger | **Accepted.** packs-9 item 7. |
| 16 | Pack Tracker on `odds.ts`; QS at pull time; walkout meaning | **Accepted.** packs-4 item 5 and the packs-9 footnote. |
| 17 | Admin editor silent clamp | **Accepted.** packs-3 item 4. |
| 18 | Pack Helper RARE tag | **Accepted.** packs-4 item 6. The face treatment is players'. |
| 19 | L1 pulse line; L4 soccer "+3.3 reprints" | **L1 accepted** (packs-9). **L4 second half rejected** with reason (§10 item 17). |
| 20 | Check-in "stamps" vs Scout Stamps | **Accepted.** Renamed "check-in days" (F2). |
| 21 | Coin flow of check-in / Season Path | **Accepted as the reason to defer F2.** packs-10 publishes our coin-flow table. |
| 22 | Boost on Headliners and Vault program slots | **Accepted.** packs-3 item 5, tested. |
| 23 | Integration re-baseline | **Accepted.** `FOREIGN_FINGERPRINT` (§1) and the packs-10 re-baseline kit. |

### Restructure

| # | Point | Response |
|---|---|---|
| 1 | Rewrite packs-6 against decision 5 and split it | **Accepted.** packs-5 is ratings truth; packs-6 is ladder economics, joined with bad-luck protection because the ladder needs stamps and pity routes. |
| 2 | Wrong function for the 110 walls; feasibility | **Accepted.** D4: headroom-scaled `editionAttributes` first, a feasibility run, and a rule priority (shape > order > floors > OVR move documented). |
| 3 | Split packs-4 | **Accepted.** packs-4 is the odds engine; Store IA and art move to packs-8. |
| 4 | Split packs-9 | **Partly.** The save-touching half (Open All) is deferred (F5). The rest is one task in two commits with separate acceptance (A presentation, B management). Commit B adds no saved state. Reason: the 10-task cap. |
| 5 | Soccer calendar as its own task | **Accepted as separate scope**, deferred to F1 with a full spec (cap and the reasons in §10). |
| 6 | Deliver the promo-hub contract early | **Accepted.** packs-1 types and stubs; packs-7 implements. |
| 7 | Final QA separate; post-merge re-baseline | **Accepted.** packs-10 alone, plus the kit. |
| 8 | All "before" snapshots in packs-1 | **Accepted.** packs-1 item 1. |
| 9 | Curve fixes for rewardCard / Market / Swap belong in 2–3 | **Accepted.** |
| 10 | Spotlight depends on ut's earned routes | **Accepted.** A packs-1 request, the packs-6 precondition, and earned routes modelled in days. |
| 11 | Consolidate hooks in `pack-actions.ts` | **Accepted.** packs-2; about 12 `UltimateTeam.tsx` lines over the stream. |
| 12 | PromoLaunch modal priority | **Accepted** as D12: no takeover this round (F3), with the contract posted to ut. |
| 13 | Pity scaled by odds | **Accepted.** D6. |
| 14 | `SHIP_DATE` constant and test | **Accepted.** §1 Cutoffs, the test and `release-check.ts`. |
| 15 | Derive stamps and pity from durable fields | **Accepted with a hybrid** (D7). Pity is fully derived. Stamps keep a primary field plus recovery floors from the pull log and pinned claims. A pure derivation from per-type totals would either back-pay every past pack or need a stored baseline that old builds strip too. |

### Risks

| # | Point | Response |
|---|---|---|
| 1 | Foreign rating modules | **Accepted.** The fingerprint fails loudly; the lead re-baselines with the kit; players are told `supportOverall` is a match rating. |
| 2 | Numbered eligibility frozen | **Accepted.** Never regenerated; the `--check` guard; the crossing list to the lead (packs-5). |
| 3 | QS ladder order fails its own test | **Accepted.** D1/D2 numbers fixed. One canonical order (`TIER_RANK` + `rankOf`) for QS, reveal, walkout and ladder. |
| 4 | Saves (a)–(e) | **(a)** D7 and the legacy normalizer test. **(b)** `stamps:` claims pinned; time-scoped families harmless. **(c)** In F2's spec. **(d)** The packs-5 entry-snapshot test. **(e)** Noted. |
| 5 | Shared `ContentState` with ut | **Accepted.** A packs-1 request: ut state under `ut.hq`, or added by us on request. |
| 6 | File collisions (1)–(7) | **(1)** `pool.ts` hunks are minimal. **(2)** SKIP is shell's, the rest ours, settled in packs-1. **(3)** The regex is announced in packs-1. **(4)** The wallet separator is requested from ut. **(5)** `pack-sound.ts`, with no `sound.ts` edit. **(6)** Hooks via `pack-actions.ts`. **(7)** `soccer-*.test.ts` wrappers. |
| 7 | Soccer tests never run | **Accepted.** The §1 Tests suite pattern. |
| 8 | QA fixtures don't work | **Accepted.** `live-plus:` for program cards; the dev-only `fixture:` kind, proven absent from `dist/`; the route-abort stays on. |
| 9 | Determinism and protocol; tell sport teams the deltas | **Accepted.** The packs-5 delta table; one bump per sport by the lead. |
| 10 | Performance | **Accepted.** §1 Performance targets; lazy and memoized; Open All deferred. |
| 11 | Bundle and offline | **Accepted.** Budget measured in packs-10; lazy hub and sheet; `loadSchedule` non-fatal; soccer JSONs deferred (F1 notes precache). |
| 12 | iPhone layout | **Accepted.** §1 Layout (`--sat`, `--ut-sticky-top`, non-scrolling footers, 320 rules). |
| 13 | Reduced motion beyond the reveal | **Accepted.** §1 list and per-task tests. |
| 14 | Chained walkouts | **Accepted.** D11 cap 3, ≤ 12 s, SKIP ALL ≤ 100 ms. |
| 15 | Ethics stacking | **Accepted.** §1 Ethics: no buy-many, pity never beside BUY, no "don't ask" ≥ 10,000, Open All deferred. |
| 16 | Branding | **Accepted.** "Legend Pack", no TOTW-family words, original art. |
| 17 | Registered packs vs bucket changes | **Accepted.** §1 Cutoffs: documented mismatch; the seed test is fingerprint-gated. |
| 18 | Economy inflation across teams | **Accepted.** Days-to-gold re-measured in packs-2; the packs-10 coin-flow table to the lead; F2 waits on it. |

### Targets

| # | Point | Response |
|---|---|---|
| 1 | EV band 0.45–0.60 | **Accepted.** §3 and packs-3, never below 0.43. |
| 2 | QS numbers | **Accepted with recomputed numbers.** Spotlight 4,000 + 150·(ovr − 100), GOAT 6,000 + 500·(ovr − 106), because levels push Legend to 3,700 (D2). |
| 3 | Preview rate target | **Accepted.** ≤ 2.5 specials in 30 days, ≤ 1 preview per 24 h. |
| 4 | Pity expectations | **Accepted.** Per card 1.38% ± 0.15, per pack 0.42% ± 0.05, 200k packs, max misses 12, plus the D6 lengths. |
| 5 | Curve tolerances | **Accepted.** 1.0 ± 0.08 / 0.58 ± 0.06 / 0.20 ± 0.04; the measured number is published. |
| 6 | Duplicates | **Accepted.** Met by `preferUnowned` at the drawn OVR, so published odds don't move. |
| 7 | Cheap-route caps | **Accepted.** packs-2 and packs-3, with D10 value. |
| 8 | Ladder with numbers | **Accepted with a different order.** Hot Season sits *below* Legend (D5), because D1 keeps `TIER_RANK` canonical and the re-rated Hot Season (season + 3..6) is a modest award edition. Honors and Finale are placed by their OVR through `rankOf`. Spotlight must exceed max(Legend, Finale) by 1.5×, so the critic's 75,000 becomes about 125,000–150,000 coins (pack about 25,000–30,000). |
| 9 | Monotone season caps | **Accepted.** D8: fully non-decreasing, not even an S4 dip. |
| 10 | Re-rate documentation | **Accepted.** packs-5 item 7 (counts by kind and delta, share of owned-possible ids, max \|face − played\| ≤ 1, Hot Season = season + 3..6 ≤ 95). |
| 11 | Store targets | **Accepted.** packs-8 and packs-4 measurements. |
| 12 | Stamps targets; no dominated shelf item | **Accepted.** The shelf is re-designed (50 / 120 / 300 / 600). Each item is worth 5–12% of the spend, and none is sold for coins. |
| 13 | Check-in coin flow | **Accepted.** It is the condition for F2's rewards. |
| 14 | Walkout chains | **Accepted.** packs-9. |
| 15 | Open All performance | **Moot this round** (F5 deferred). The target is kept in F5's spec. |
| 16 | Bundle | **Accepted.** packs-10. |
| 17 | Test runtime | **Accepted.** §1 Tests. |
| 18 | Pack art | **Accepted.** packs-8 tests. |
| 19 | Program pack pricing | **Accepted.** packs-3, plus the effective-rate publication in packs-6. |
