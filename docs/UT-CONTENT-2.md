# Ultimate Team content drop 2 — Claude (Anthropic), 2026-11-01

Branch `claude/ut-content` (from `feature/season-evolution` at `9ab10f8`). Implemented by Claude from the research spec (UT-SPEC). Coins only, never real money. Not deployed.

Nothing is reset: owned copies, edition IDs, serials, levels, XP, squads, coins and identity are untouched. All new state is optional and additive (`ut.content`). New edition IDs are stable forever.

## Features and where they live

| # | Feature | Where in the UI | Files |
|---|---|---|---|
| 1 | **Daily Drop** and a 7-day streak (day 7 adds a Gold Pack) | Home card and the top of Store | `content-packs.ts` (`claimDaily`, `dailyStatus`), `Store.tsx`, `Hub.tsx` |
| 2 | **Scout's Choice** pick sheet: three face-down cards flip over, you keep one | Store → Featured; also opened by rewards | `content-packs.ts` (`scoutOptions`, `pickFor`, `keepPick`), `PickSheet.tsx` |
| 3 | **Elite Gold** pack | Store → Featured | `packs.ts` |
| 4 | **Jumbo Premium** pack | Store → Featured | `packs.ts` |
| 5 | **Standout Guarantee** pack, plus its weekend **Lightning** copy at 25% off | Store → Featured | `packs.ts`, `content-packs.ts` (limits, `lightningWindow`) |
| 6 | **Rare golds**: the top 35% of each position's season golds. Packs guarantee them and cards get a subtle shimmer | Every pack, card art, odds sheets | `rare.ts`, `packs.ts`, `CardArt.tsx`, `card-editions.css` |
| 7 | **Weekly Standouts** promo: weekly program, the "Standout Squad" SBC and a weekly objective | Home → Weekly Standouts, SBC tab, packs | `standouts.ts`, `editions.ts`, `content-progress.ts`, `StandoutsView.tsx` |
| 8 | **Landmark Seasons** promo: real statistical landmarks; three Landmark SBCs a week | SBC tab; Sets → Landmarks archive | `landmarks.ts`, `editions.ts`, `content-sbc.ts`, `SetsView.tsx` |
| 9 | **Scout Market**: 12 cards a day at fixed prices, each buyable once | Store → SCOUT MARKET | `market.ts`, `Store.tsx` |
| 10 | **Swap Desk**: 5 duplicate golds → a Scout's Choice | Store → SCOUT MARKET | `market.ts` |
| 11 | **Pack Helper** tags on the reveal (NEW / UPGRADE +N / SET / SBC FODDER), plus a "quick sell dupes" bar | Every pack reveal | `pack-helper.ts`, `PackOpening.tsx` |
| 12 | **Set Collections**: Programs, All-Decade, Franchise eras, Landmarks | Home → Sets; Collection Gallery → Set Collections | `sets.ts`, `SetsView.tsx` |
| 13 | **UT Draft**: pick a captain from 5, then 1 of 5 per spot; win up to 4 real matches | Play → UT Draft | `draft-mode.ts`, `DraftView.tsx`, `Match.tsx` |
| 14 | **Chemistry pips** (0–3) per starter | Squad (beside each slot tag) | `chem-pips.ts`, `SquadView.tsx` |
| 16 | **Favourite / LOCK**: a locked copy is never quick-sold (single or bulk), traded in SBCs, used by the Swap Desk or offered in the dupes bar | Card details → LOCK AS FAVOURITE | `content-state.ts` (`toggleLock`, `isLocked`), `CardDetail.tsx`, `UltimateTeam.tsx`, `market.ts` |
| 15 | **New Era thank-you bundle**, one time: an Icon pick (choose 1 of 3 Legends) plus 65,000 coins | Home (shown only to eligible players) | `new-era.ts`, `profile.ts` hook, `Hub.tsx` |

## Packs and odds

Every pack in this table opens on the device, the same way Gold and Premium do (`openNow`). None of them use the card registry. `SPOTLIGHT_RATES` and the Supabase contract are unchanged. The Store's odds sheet lists every slot below.

In the table:
- **R** is a rare gold: always a gold, drawn from the rare set.
- **G** is a gold. **S** is a silver.
- **Std** is one of this week's Weekly Standouts. 10% of Standout pulls are the week's Featured Standout; otherwise all Standouts are equally likely.

| Pack | Price (NBA / NFL) | Cards | Slots | Limit |
|---|---|---|---|---|
| Daily Drop | free | 3 / 6 | 2 / 5 × (bronze 50%, silver 50%) + 1 × (silver 60%, gold 38%, Std 2%) | once per Eastern day; day 7 of the streak adds a Gold Pack |
| Scout's Choice | 1,500 / 1,500 | keep 1 of 3 | each option: a gold at `onScale(84)`+ 97%, Std 3%. NFL options all come from one position group | 3 per ISO week |
| Elite Gold | 3,000 / 2,500 | 6 / 12 | 5 / 11 × R + 1 × (R 89%, Std 10%, Legend 1%) | 2 per day |
| Jumbo Premium | 3,200 / 3,200 | 16 / 32 | 4 / 8 S, 4 / 9 G, 7 / 14 R, 1 premium slot (G 93.34%, Std 4%, Hot Season 2%, Legend 0.66%) | 1 per day |
| Standout Guarantee | 4,500 / 3,300 | 8 / 16 | 4 / 9 G, 3 / 6 R, 1 × Std (100%) | 1 per ISO week |
| Lightning Standout | 3,375 / 2,475 | same as Standout Guarantee | same | 1 per window. Windows: Saturday and Sunday, 12–2 pm and 8–10 pm Eastern |

Changes to the existing packs:
- **Gold**:
  - 1 rare gold guaranteed in NBA, 2 in NFL.
  - The special slot is now G 97.8%, Std 1.5%, Hot Season 0.5%, Legend 0.2%. The total special chance is unchanged at 2.2%.
- **Premium Gold**:
  - 3 rare golds guaranteed in NBA, 6 in NFL.
  - The special slot is G 93.34%, Std 4%, Hot Season 2%, Legend 0.66%. The total special chance is unchanged.
- **Position / Unit**: 1 rare gold in NBA, 2 in NFL.

Spotlight is unchanged.

The NFL prices for Elite and Standout are lower because a football card quick-sells for about a third as much. Every pack's quick-sell value per coin stays between 0.3 and 0.95 of its price (`economy.test.ts`).

Measured average quick-sell value per pack price (300 packs each):

| Pack | NBA | NFL |
|---|---|---|
| Elite Gold | 0.44 | 0.39 |
| Jumbo Premium | 0.72 | 0.52 |
| Standout Guarantee | 0.37 | 0.32 |

## Promo rules

Both promos derive their ratings from the season card's rating. Their deltas are relative to that base, so they rescale automatically when the ratings rework lands. Every threshold goes through `onScale` or `TIER_CUTS`.

**Weekly Standouts** (`standouts.ts`, `editions.ts`)
- **The week's set:** each Eastern ISO week gets 8 NBA / 15 NFL different players, seeded by `ut-standout:<sport>:<week>`.
  - They are drawn from season cards whose base overall is between `max(onScale(70), gold cut)` and `onScale(86)`.
  - Positions are spread out. NBA takes PG, SG, SF, PF, C plus 3 more. NFL takes QB, RB, WR×2, TE, OT, OG, C, DE, DT, LB×2, CB, S, K.
  - The Featured Standout comes from the week's theme decade, from the top of that band.
- **Rating:**
  - Overall is base +3, or +5 for the Featured Standout, capped at 97 (and never below the base).
  - The card's three best face attributes get the full delta, but a physical attribute gets at most +1.
  - The other face attributes get +1. FT never changes.
- **Card art:** a midnight-navy and teal frame, a pulse line, and a "WK 44" stamp. The Featured Standout uses a gold variant.
- **How to get one:**
  - The Standout Guarantee and Lightning packs.
  - The special slot in Gold, Premium, Jumbo and Elite packs, and the Daily Drop's last slot.
  - Scout's Choice (3% per option).
  - The Scout Market (1 a day).
  - The weekly **Standout Squad** SBC (`so:<week>`): 8 golds with team overall `onScale(78)`. It pays a random current Standout.
  - The weekly objective: win 5 matches with 2+ Standouts in the squad. It pays a Standout pick, claimed as `so-obj:<week>`; each match id counts once.

**Landmark Seasons** (`landmarks.ts`, `editions.ts`)
- **What counts as a landmark:** the catalog is built from stats, not ratings.
  - NBA, only stints of 50+ games:
    - a triple-double average
    - 30+ PPG
    - a rebounding title (≥11 RPG)
    - an assists title (≥8 APG)
    - a blocks title (≥2.5 BPG)
  - NFL:
    - QB 4,500+ yards or 40+ TD
    - RB 1,500+ rushing yards
    - WR/TE 1,500+ receiving yards
    - DL/LB 15+ sacks
    - DB/LB 10+ interceptions
  - Catalog size: NBA 252.
- **Rating:**
  - Overall is base +5, capped at 99.
  - The landmark's own skills get +6. For example, a scorer gets 3PT/MID/CLS/LAY, a rusher BTK/JKM/CAR/BCV, and a pass rusher PMV/FMV/BSH.
  - Other face attributes get +1. Every other attribute is unchanged, so weak skills stay weak.
- **The printed line:** the landmark appears on the card, e.g. "31.3 PPG" or "2,105 RUSH YDS".
- **How to get one:** only from Landmark SBCs and Set rewards.
  - Three Landmark SBCs a week (`lm:<card id>`): 6 NBA / 9 NFL cards, including 1 from that franchise, size−2 golds, and a team overall between `onScale(76)` and `onScale(84)`.
  - Each SBC can be done once, ever: the claim `sbc:lm:<id>` lives in `ut.content.claims`.
- **Card art:** a sepia frame with film grain, a box-score ticker band and a gold laurel.

**Reveal flourish** (`PackOpening.tsx`, `content-ui.css`)
- A Standout walkout gets teal pulse lines and a "WEEKLY STANDOUT · WK nn" stamp.
- A Landmark walkout gets a scrolling record-book ticker, a laurel and film grain.
- Both get their own edition line, reveal headline and flip flare.
- They use the existing cinema timings: a Standout is walkout level 2, a Landmark level 3.

## Edition IDs and how they resolve

- Standout: `<sport>:standout:<week>:<season>:<pid>:<fr>`, where `<week>` is `2026-W44`. The featured card's week is written `2026-W44F`, so it keeps its +5 without needing the program.
- Landmark: `<sport>:landmark:<season>:<pid>:<fr>`.

`pool.ts` wraps `byId` and `base` so they resolve these IDs **lazily** from the season card (`EditionLines` / `EditionRatings`). The lazy entries are cached apart from the built map, so iterating `pool.lines`, `byId` or `buckets` never sees them.

A Standout from week 44 therefore loads in week 50 or any later week, in the club, in squads (`squadFromWire`), in SBCs and on the wire. A Landmark whose season leaves a future catalog still resolves, printing that season's best line.

The `rare` flag is not a tier, so tier cuts do not move.

The tier union gains `standout` and `landmark`:

| Tier | Rank |
|---|---|
| gold | 2 |
| standout | 2.5 |
| promo | 3 |
| landmark | 3.5 |
| legend | 4 |

## State fields (`ut.content`, all optional; `content-state.ts` `normalizeContent`)

| Field | Meaning |
|---|---|
| `daily {day, streak, total}` | Daily Drop |
| `buys {key: n}` | Purchase limits, keyed like `elite:<day>`, `scout:<week>`, `lightning:<window>` or `swap:<day>`. Old keys are pruned |
| `picks [{id, kind, title, options[], at}]` | Open pick sheets. They are saved before the sheet shows |
| `claims []` | Exactly-once claim IDs (see below) |
| `market {day, bought[]}` | Scout Market purchases |
| `soWins {week, ids[]}` | Standout objective match IDs |
| `draft {active?, tokenWeek?, history?}` | UT Draft |
| `era {eligible}` | New Era eligibility marker |
| `locked []` | Favourite / LOCK copy uids |

`migrateUt` keeps `content` when it is present and adds nothing otherwise. Old saves come back byte-identical, which `content2.test.ts` checks.

The encrypted automatic server save stores the whole profile keys (`cloud-data.ts` `CLOUD_KEYS`), so `ut.content` syncs with no backend change.

Stable claim IDs:

| Claim ID | For |
|---|---|
| `pick:<id>` | A kept pick |
| `set:<set id>` | A set reward |
| `sbc:so:<week>` and `sbc:lm:<card id>` | Content SBCs |
| `so-obj:<week>` | The Standout objective |
| `draft:<run id>` | Draft rewards |
| `new-era-2026` | The New Era pick, in this sport's `ut.content.claims`. The New Era coins are recorded under the same ID in the profile's shared `gifts` list, so they pay once across both sports |

Uids of the new copies:

| Uid | Source |
|---|---|
| `pack:daily-<sport>-<day>:<i>` | Daily Drop |
| `pick:<id>` | Picks |
| `market:<sport>:<day>:<i>` | Scout Market |

Reward packs land as `PendingPack`s in the Store:

| Pack ID | From |
|---|---|
| `daily-gold:<day>` | Day 7 of the Daily Drop streak |
| `set:<sport>:<id>` | Set rewards |
| `draft:<run>` | Draft rewards |

## UT Draft

- **Entry:** 800 coins, or the free weekly token (`tokenWeek`).
- **Drafting:**
  - The captain is chosen from 5 Legend or Hot Season cards.
  - Then 1 of 5 for every spot: NBA's five starters plus B1–B3, NFL's 23.
  - Options are mostly golds, about 25% rare golds and about 7% specials. Bench spots can also offer silvers.
  - **AUTO-DRAFT THE REST** fills every remaining spot with its best option.
- **The squad:** drafted cards are never owned. No card joins or leaves the club, and they earn no XP.
- **Matches:**
  - Real `Match.tsx` games (`req.draft`) against `aiOpponent` at the draft overall plus [-3, -1, +1, +3] (NBA) or [-2, -1, +1, +2] (NFL).
  - AI skill per game: 0.55, 0.62, 0.70, 0.78.
  - You can play or sim. A loss ends the run.
- **Settlement:** `settleDraft` accepts a game exactly once:
  - only for the active run, at its current game index;
  - only with a match id not already in `ut.settled`;
  - not after the run is done.

  It records W/L and Season Points, and pays no per-game coins.
- **Rewards by wins**, claimed once as `draft:<run>`:

  | Wins | Reward |
  |---|---|
  | 0 | 200 coins |
  | 1 | Silver Pack + 200 coins |
  | 2 | Gold Pack |
  | 3 | Premium Gold |
  | 4 | Elite Gold |

  At a 50% win rate per game the expected value is about 660 coins against the 800 entry; at 60% it is about 900.
- **Retire:** "End run now" scores the run on its current wins.

## New Era bundle

When this build first loads a sport's save, `profile.ts` `loadFrom` calls `stampNewEra` once.

**Who is eligible:** the save already had UT cards, packs or a UT record, or any games played or XP.

**Who isn't:**
- New profiles (`freshProfile` → `markNewPlayer`) are never eligible, even after they start playing.
- A restored cloud save from before the update has no marker, so it qualifies once.

**Claiming:**
- `claimNewEra` opens a pick of 3 different Legends at `onScale(88)`+ in this sport (`new-era-2026:<sport>`).
- It pays 65,000 coins unless the shared `gifts` list already has `new-era-2026`.

## Online compatibility

- `pool.print` now mixes in `CONTENT_PRINT = 'ut-content-2'`. This build's online UT queue therefore never pairs with older builds, which can't resolve Standout or Landmark cards in a squad.
- No gameplay rule or existing card rating changes. Chemistry pips are display-only, and the team chemistry formula is unchanged.
- `UT_RULES` stays NBA 8 / NFL 9. Only the fingerprint part of the queue key changes. The ratings rework will change the fingerprint anyway.

## Tests

`src/ut/content2.test.ts` runs in both sports (28 tests each). It covers:
- Edition ID round-trips, and lazy resolution for past and future weeks, including inside squads.
- The Standout and Landmark rating rules: caps, deltas, FT unchanged, weak skills kept.
- Program determinism per week and difference across weeks.
- The objective counting each match once.
- The content SBCs.
- Every odds slot summing to 1.
- Rare share between 25% and 50% per position.
- Every new pack's size and guarantees.
- Daily Drop once a day, streak and reset, and day 7 paying once.
- Day, week and Lightning-window limits.
- Scout's Choice determinism, distinct players, and keep-exactly-one.
- The market: 12 deterministic cards a day, price floors, buy-once.
- The Swap Desk: exactly 5 stored golds.
- Sets: claim once, and discovery-based progress that survives selling.
- Draft: drafting, settle guards (repeated match id, wrong game, wrong run, after done), the loss ending the run, claim once, the weekly token.
- Migration: an old save unchanged; content round-trips; junk dropped.
- Pack Helper tags and pips.
- New Era: eligibility, exactly once per sport, coins once per wallet, and survival across migration and JSON (cloud) round-trips.

`economy.test.ts` now skips free and pick kinds in the quick-sell bound, and every new paid pack passes it.

Browser QA: `scripts/qa/ut-content.mjs`, run as `PS_QA_URL=http://localhost:5185/ node scripts/qa/ut-content.mjs`.
- **Main runs** (NBA and NFL, 390 and 320 wide): New Era claim and Icon pick, Daily Drop (once), Standout Guarantee, Elite, Jumbo, a Scout's Choice pick, a market buy, a Set claim, the Landmarks archive, the Standouts page, the SBC tab, squad pips, and a UT Draft (free entry, captain, auto-draft, one simmed real match, retire, claim).
- **Weekend runs** (clock set to a Saturday window): buys the Lightning pack in both sports.
- Every run asserts zero page errors.

## Known gaps

- Lightning "limited stock" is per player per window. A shared global stock would need a server.
- Landmark first-clear Moments rewards and an FC-style Evolutions lab are not built. Landmarks come from SBCs and Set rewards.
- The Standout objective counts Squad Battles, Circuit, Events and Club Season wins. It doesn't count online wins or Draft games.
- Chemistry pips have no in-match effect. That was deliberate, to keep match strength and online parity unchanged.

---

# Wave 2: FC 27 mechanics — Claude, 2026-11-01

These are modelled on the EA FC 27 research notes. Every rating threshold goes through `onScale`, so each mechanic follows the final rating scale.

| # | Feature | Where | Files |
|---|---|---|---|
| 17 | **Item Score**. Curve points by FC overall: Bronze 20, Silver 35, then 75:90, 80:180, 83:410, 84:830, 85:2,100, 86:4,100, 88:8,300, 90:14,000, 92:20,000, 95:40,000, 99:100,000. The overalls are mapped through `onScale` and interpolated log-linearly. Multipliers: Standout/Hot Season ×1.25, Landmark ×1.35, Legend ×1.5, Spotlight ×2, GOAT ×2.5, holo ×1.5 | Shown in the Streamlined sheets | `item-score.ts` |
| 18 | **Streamlined SBCs**: Gold, Premium, Scout, Elite and Standout streams | SBC tab (top) | `streamlined.ts`, `StreamlinedView.tsx` |
| 19 | **Daily hub**: Daily Drop + 5-day login calendar + today's 3 objectives with an all-three bonus | Home → Daily card | `daily-hub.ts`, `DailyHubView.tsx` |
| 20 | **Preview Pack**: see a Premium Gold pack's exact cards, then buy or skip | Store → after Featured | `preview-pack.ts`, `PreviewPack.tsx` |
| 21 | **Holographic variants** `holo~<card id>` | Packs only | `variants.ts`, `card-editions.css` |
| 22 | **Walkout sequence**: era → conference/division → franchise → card, with a stage colour per promo | Pack reveals | `walkout.ts`, `PackOpening.tsx`, `content-ui.css` |
| 23 | **Evolutions lab** | Home → Development → Evolutions Lab | `evolutions.ts`, `EvolutionsView.tsx`, `variants.ts` |
| 24 | **Rewards inbox** with CLAIM ALL; HOME tab badge | Home → Rewards Inbox | `inbox.ts`, `InboxView.tsx` |

## How each one works

**Streamlined SBCs**
- Any cards can go in, duplicates included. Locked favourites and players in the starting squad (or the NBA's first three bench spots) are never taken.
- Progress is saved in `ut.content.streams[id]` and overflow carries over.
- Each full target deposits the reward pack `stream:<sport>:<id>:<n>`.
- Targets calibrate themselves: 1.8 × the average Item Score of the reward, measured on 60 seeded packs or picks from the live pool. A stream therefore can't be looped for profit, and it re-scales after the rating merge.

**Login calendar**
- It moves on each day you claim; missed days don't reset it. FC's calendar works the same way.
- Rewards:

  | Day | Reward |
  |---|---|
  | D1 | Silver Pack + 100 coins |
  | D2 | 300 coins |
  | D3 | 200 Season Points |
  | D4 | Gold pick, 1 of 2 at `onScale(78)`+ |
  | D5 | Gold Pack + 500 coins |

- The three daily objectives are Codex's existing HQ dailies.
- The all-three bonus pays 100 coins + a Silver Pack, claimed as `daily-bonus:<day>`.

**Preview Pack**
- The contents come from a per-player seed (`content.preview.seed`) and the preview number, so reloading never rerolls them.
- Buying opens exactly the previewed cards (`openNow` preset) and the next preview is ready at once.
- Skipping advances to the next preview after a 1-hour cooldown.
- If the Eastern week changes between previewing and buying, a Standout slot could show a different card; at 4% per pack that edge was accepted.

**Holographic variants**
- Same stats as the edition, plus a pointer-following holo shine written from scratch (colour-dodge sheen, diffraction grating, sparkle field).
- 4% of the special editions (Standout, Hot Season, Landmark, Legend) drawn in packs come out holo.
- They are never in picks, SBC rewards or the market.

**Walkout sequence**
- It plays for golds at `onScale(86)`+ and for every special edition. Bronze and silver have no walkout.
- The gold "star" walkout threshold moved from `onScale(85)` to `onScale(86)`.
- Tap to skip, as before; with reduced motion the card shows directly.

**Evolutions**

| Evolution | Eligible | Objectives | Upgrade | Ceiling |
|---|---|---|---|---|
| Rising Star I | ≤`onScale(80)`, silver or gold | 3 games, 1 win | +2 OVR, face +2 | `onScale(84)` |
| Rising Star II (after I) | ≤`onScale(84)` | 4 games, 2 wins | +2 OVR, best 3 +3 | `onScale(87)` |
| Specialist | ≤`onScale(85)`, gold or Standout | 3 games, 2 wins | +1 OVR, best 2 +4 | `onScale(88)` |
| Veteran Leader | ≤`onScale(86)`, seasons before 2000 | 5 games, 3 wins | +3 OVR, face +2 | `onScale(89)` |

- Up to 3 evolutions run at once. A match counts once per id, for evolving cards that played in it (any non-draft match).
- Each evolution is applied once, with APPLY.
- The owned copy keeps its card id. It shows and plays as `evo~<ids>~<card id>`, which goes on the wire so both phones rate it the same.
- The lab shows each card's whole chain result before you start.
- It extends Codex's Development lab, linked from its page.

**Rewards inbox**
- It aggregates: New Era, Daily Drop, calendar, objectives, the daily bonus, Season Pass tiers, sets, the Standout objective, Draft rewards and finished Evolutions.
- CLAIM ALL claims everything in one transaction, each with its own receipt. The Daily Drop is deposited as a pack in the Store.
- Packs and picks still to open are listed with a Store shortcut.
- The HOME tab badge counts claimables.

## Saves and online

New `ut.content` fields (optional; `normalizeContent` validates them):

| Field | Holds |
|---|---|
| `streams` | Streamlined progress and reward counters |
| `calendar {day, n}` | Login calendar |
| `preview {seed, n, until?}` | Preview Pack |
| `evo {uid: {done[], active?}}` | Evolutions per owned copy |
| `evoSeen` | Match ids already counted for Evolutions |

- `CONTENT_PRINT` is now `ut-content-3`, so wave-1 builds can't resolve holo/evo ids and don't share the online queue with this build.
- `UT_RULES` is unchanged.

## Tests

`content3.test.ts` (both sports) covers:
- the Item Score curve and multipliers
- stream targets: stable, and above the reward's value
- streams: partial progress, overflow, exactly-once rewards, locked/squad/duplicate exclusions
- the calendar cycle and once-a-day claims, and the D4 pick
- the bonus paying once
- preview determinism across reload, buy/skip and the cooldown
- holo rating equality and pack-only drops
- Evolutions: caps, per-match counting, apply once, chain, ceiling, cancel, the wire id, migration
- walkout thresholds and clues
- the inbox: listing, CLAIM ALL once, counts

`scripts/qa/ut-content.mjs` now also covers, at 390 and 320 in both sports:
- Daily hub, calendar, inbox CLAIM ALL
- Preview Pack: the same cards after a reload, the bought cards matching the preview, skip
- a Streamlined submission
- starting and applying an Evolution
- a holo card's details

---

# Wave 3: Live Calendar — Claude, 2026-11-01

This is the 12-month calendar from the content plan (`content-plan/CALENDAR.md`, `schedule.json`, `IMPLEMENTATION.md`). It was regenerated and validated with `content-plan-tools/build.sh` after the owner's decisions:

- **Seasons renamed:**
  - "All-Star Break" is now **Midseason Stars**.
  - "Summer League" is now **Summer Run**.
- **No league marks in UI text:** "NBA Cup", "Super Bowl" and "Pro Bowl" appear only in the real-world notes, which the UI never shows. A test checks this.
- **The Perfect Season Finale (98–99) is SBC-only.** Its 0.2% pack slot was removed, and the objective that offered a 98 pick now pays a Ring Night pick.
- **Summer Heat's featured card is capped at 97**, so no 98–99 card exists outside the Finale.
- **The card pool stays frozen:** no new-season data rebuild.
- **The packs it references map to this build's packs** (`resolvePackKind`):

  | Schedule name | Pack here |
  |---|---|
  | `scout-choice` | Scout's Choice |
  | `elite-gold` | Elite Gold |
  | `jumbo-premium` | Jumbo Premium |
  | `standout-guarantee` | Standout Guarantee |
  | `daily-drop` | Daily Drop |
  | `season-program-*` | the season's program pack or pick |

## Delivered

**Data**
- `src/data/live-calendar.json` is a copy of the regenerated schedule (12 seasons, 2026-10-26 to 2027-11-21). It loads with the card pool (`getPool`), never in the main chunk.

**`calendar-rules.ts`**
- The selection grammar (franchise, era, season, pos/anypos, group, honor, stat, rk, career, careerYear, kind, years, games, starts, num, traded, franchises, dense, base), ported from `rules.js`.
- Career facts are computed once per pool.
- Unknown keys throw.

**`calendar.ts`**
- `seasonOn(day)`.
- After the scheduled year, a **364-day repeat** of seasons 2–12: ids continue `season:13…`, and promo/SBC/pack ids get `-y<cycle>`.
- Also: `promoById` (any cycle), `promosOn`, `packsOn`, `sbcsOn`, `upcoming` (names only), `nextSeason`, and per-sport waves.

**`live-cards.ts`: program cards**
- Id: `<sport>:live:<promoId>[.f]:<season>:<pid>:<fr>`.
- **Rebuilt from the id alone** (the promo's band and delta + the season card), so an owned program card resolves after its promo ends, in any later week or cycle, even if selection would no longer pick it.
- Rating: `clamp(base + delta, onScale(band))`, capped at 97 except the Finale. Face attributes get the delta, physicals at most +2, FT unchanged. The new tier is `program`, ranked with Hot Season for SBC requirements.
- Selection is deterministic per sport and promo id:
  1. the rule
  2. a rating gate (widened up to 3 times)
  3. order: top by base, or seeded
  4. take with distinct players, `maxPer` caps and wave position slots; a second pass relaxes the caps and slots only when a promo would otherwise ship short
  5. the featured card (`.f`)
- Waves release on their dates.

**`live-packs.ts`: program packs**

| Pack | NBA | NFL |
|---|---|---|
| `live:<promo>` (Program Pack) | 3 rare golds, 4 golds + 1 program slot | 6 rare golds, 9 golds + 1 program slot |
| `live-plus:<promo>` (Program Guarantee) | 5 rare golds + 1 program card | 11 rare golds + 1 program card |

- The program slot uses the schedule's `programOdds` (30% for base packs) plus its non-Finale `extraOdds`; otherwise it gives a current Weekly Standout.
- `live-pick:<promo>:<n>` is a pick sheet.
- Limits: 3 a day (program), 1 a week (guarantee).
- **Prices:** the schedule's prices were planned on a larger coin scale, so each template's price is scaled per sport:

  | Template | NBA | NFL |
  |---|---|---|
  | Program | ×0.7 | ×0.45 |
  | Guarantee | ×0.35 | ×0.21 |

  A base Program Pack and Guarantee then return 41–52% of their price in quick-sell value (tested). Elite-tier packs (Hot Season, Ring Night, Dream Teams, Summer Heat) keep their planned premium, so their EV is lower (about 33–41%).
- A program card quick-sells for 700 + 60 per overall point above `onScale(84)` (×0.35 in NFL).

**`calendar-sbc.ts`: season SBCs**
- They appear on the SBC tab under **This Season**, at the top.
- Repeatable ones count completions in `ut.content.claims` (`sbc:cal:<id>:<k>`).
- Overall requirements go through `onScale`.
- New requirement kinds: `season` (n from season ≥ min) and `distinctFr`.
- The reward is a released card of the promo; "The Perfect Season" pays the featured Finale card.

**UI**
- Home **This Season** banner: season number and name, tagline, days left, the season's accent, live program chips (band and end date; tap opens the Store), and **Coming next** (the next three drops by name only, plus the next season five days before it starts).
- Store **This Season** row with odds sheets.
- Program card art `t-program` in the season's accent colours, with a program ribbon.

## Online and saves

- `CONTENT_PRINT` is now `ut-content-4`, and the pool fingerprint mixes in the schedule version, so builds that can't rate each other's program cards don't share the UT queue.
- No existing card's rating changes. `UT_RULES` is unchanged.
- No new state field: purchase limits live in `ut.content.buys`, and SBC completions in `ut.content.claims`.

## Retuned prices

These now give 45–60% quick-sell EV on the current scale. Recheck them after the ratings rework lands.

| Pack | NBA | NFL |
|---|---|---|
| Standout Guarantee | 4,500 → **3,600** | 3,300 → **2,300** |
| Lightning (25% off) | 3,375 → **2,700** | 2,475 → **1,725** |
| Elite Gold | 3,000 → **2,800** | 2,500 → **2,100** |

## Not built yet (IMPLEMENTATION.md steps 4, 6, 8, parts of 5 and 7)

- Calendar-driven Season Pass changes: per-season 20/25/30 tiers, extra rewards, renaming. The pass keeps its existing 28-day seasons and 25 tiers; season 2's dates match.
- Season objectives, the Season Path, the check-in card, `winsWith`.
- Live Events, Moments reskins, Circuit themes, the Squad Battles curve.
- Flash Windows from the schedule. The existing weekend Lightning windows remain.
- Season-specific Standout bands and features.
- The Gallery "Programs" tab.
- The frozen-manifest script. Today no promo has started yet, so the manifest would be empty; it should be added before the first promo (2026-11-06) if ratings may still change, because `top` selection depends on base ratings.

## Tests and QA

`calendar.test.ts` (both sports) covers:
- schedule shape (contiguous Mon–Sun seasons, season 1 untouched, unique ids, every rule compiles, unknown keys throw)
- the owner decisions
- date → season, including 364/728-day repeats and `-y` ids
- deterministic selection near full count
- bands (98–99 only in the Finale, everything else ≤97)
- owned and synthetic ids resolving after the promo and in later cycles
- wave release
- pack shapes and odds (the Finale never in a pack)
- limits, seeded picks with keep-exactly-one
- season SBCs, including repeats and the Finale paying 98+
- program pack EV

Browser QA (`scripts/qa/ut-content.mjs`) moves the browser clock to Black Friday (2026-11-27), Honors (2027-01-15, at 320 wide) and Finale week (2027-06-23), in both sports. Each run: Home banner, Store row, buying a program pack, the SBC This Season section.

---

# After the ratings rework (merge of `feature/season-evolution` d64921c) — Claude, 2026-11-01

## The display scale

Displayed overalls are now on the FC 27-style scale (`ut-scale.ts`). Thresholds in this content are written on that scale and pass through `fcToDisplay` (`fc-scale.ts`, which is the identity while the tier cuts are 65/75). They no longer go through the legacy `onScale`.

| Content | Range now |
|---|---|
| Weekly Standouts | base seasons 77–89 +3 (featured +5), capped 92 (featured 93). Measured: 80–93, median 83 |
| Landmark Seasons | `clamp(base + 4, 85, 93)` (was +5, cap 99). Measured: 85–93 |
| Live Calendar programs | inside their schedule bands. All 340 NBA / 542 NFL selected cards are in band |
| New Era Icon pick | Legends at 88+ (measured 88–93) |
| Scout's Choice | 84+ golds |
| Calendar Day-4 pick | 78+ golds |

- The Item Score knots and the Evolution caps are FC numbers, used directly.
- The walkout uses `UT_SCALE.walkout` (86).

**Edition faces and `rawOvr`:** an edition's printed face rises with its overall. That covers the NBA six categories from `card-face.ts` and NFL key attributes, via `liftShown` in `editions.ts`. `rawOvr` is the new overall read back on the rating scale, which numbering uses. This applies to Standouts, Landmarks, programs and Evolutions.

## Prices: quick-sell EV 45–60% of price, measured on the new scale

Values are NBA / NFL; the percentage is the average quick-sell value as a share of the price.

| Pack | Old price | New price | EV now |
|---|---|---|---|
| Bronze | 150 / 150 | **250 / 175** | 54% / 54% |
| Silver | 400 / 400 | 400 / **320** | 60% / 50% |
| Gold | 900 / 900 | 900 / 900 | 57% / 50% |
| Premium | 1,800 / 1,800 | 1,800 / **1,400** | 55% / 51% |
| Position / Unit | 700 / 500 | unchanged | 56% / 54% |
| Elite Gold | 2,800 / 2,100 | **2,200 / 1,500** | 50% / 48% |
| Jumbo Premium | 3,200 / 3,200 | **3,600 / 2,700** | 56% / 50% |
| Standout Guarantee | 3,600 / 2,300 | **3,000 / 1,800** | 50% / 50% |
| Lightning (25% off) | 2,700 / 1,725 | 2,250 / 1,350 | 67% (a discount by design) |
| Scout's Choice | 1,500 / 1,500 | **650 / 250** | priced on its best option's value (320 / 112) |
| Program Pack, base (template ×0.6 / ×0.36) | | 3,000 / 1,800 | 53% / 51% |
| Program Guarantee (×0.27 / ×0.155) | | 3,200 / 1,900 | 51% / 49% |

Elite-tier program packs stay lower: Hot Season, Dream Teams and Ring Night land at 38–46% NBA and 36–45% NFL.

## Frozen selections

- `scripts/freeze_live_editions.ts` (`npx vite-node scripts/freeze_live_editions.ts`, with `--check` to verify only) wrote `src/data/live-editions.json`: 42 promos, 84 sport selections, each as `[card id, wave]`.
- At runtime a frozen selection always wins over a fresh one. Rating tweaks therefore never reshuffle a program's players.
- The script is append-only and refuses to change a frozen id.
- `calendar.test.ts` checks that every scheduled promo is frozen, that the manifest equals today's fresh selection, and that every frozen id resolves.
- Repeat cycles (`-y2`…) still select fresh from their seeded order.
