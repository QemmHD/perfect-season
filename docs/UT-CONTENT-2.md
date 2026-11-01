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
