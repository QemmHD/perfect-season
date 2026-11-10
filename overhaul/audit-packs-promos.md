# Audit: Ultimate Team packs, odds, promos and economy

Area: `src/ut/packs.ts`, `pool.ts`, `cards.ts`, `rate.ts`, `ut-scale.ts`, `content-packs.ts`, `promo.ts`, `calendar*.ts`, `live-*.ts`, `market.ts`, `preview-pack.ts`, `PreviewPack.tsx`, `Store.tsx`, `PackOpening.tsx`, `pack-sequence.ts`, `pull-log.ts`, `standouts.ts`, `editions.ts`, `variants.ts`, `sbc.ts` (rewards), `src/admin/catalog.ts` (Club Collection store packs) and `src/data/live-calendar.json`. Repo state: `claude/studio-overhaul` = `acdf3e2`, untouched.

## Method

- **Seeded simulations.** `audit-scripts/packsim.ts` opens 10,000 seeded packs of every pack type in each sport through the real `openPack` / `fill` / `openLivePack` / `registeredPack` code, for week `2026-W46`. That covers 13 store and reward packs, every Position/Unit choice, the starter and the Club Collection packs. Spotlight chase tiers are rolled with the shared `SPOTLIGHT_RATES` contract and picked uniformly within the tier, as the server does. It also runs 26 Live Calendar program packs on 9 representative days. For each pack it tabulates tiers, OVR bands, special share, the walkout chance, quick-sell (QS) EV and the duplicate rate seen by one player opening packs in order. Output: `audit-scripts/out/packsim-<sport>.json`.
- **Promos.** `audit-scripts/promos.ts` covers every Live Calendar promo selection (uplift over the season card), 52 weeks of Weekly Standouts, Landmarks, a 28-day SBC catalogue and reward-card EVs (`out/promos-<sport>.json`). `promoattrs*.ts` compares displayed overall and face values with gameplay attributes. `autofill.ts` runs SBC auto-fill against a club holding a Spotlight and a GOAT. `soccersbc.ts` lists impossible soccer SBCs.
- **Screenshots.** Playwright against `vite --port 5204`, with `?ns=inspect&relay=ws://localhost:7777` and every non-localhost request aborted. Two were blocked: a Google Fonts request and one request to the live Supabase host. No Spotlight or registry pack was opened. Viewports were 390×844 and 430×932 at DPR 3 with touch and mobile enabled, plus 320×568. The clock was moved to 2026-11-14 (First Tip program live) and 2027-01-16 (Hot Season Honors live). Shots are in `audit-shots/packs-promos/`.
- All scripts are in `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/`.

## Executive summary

The pack code is clean, deterministic, well documented and unusually transparent: every slot has odds, there is a Pack Tracker and the chase odds are a server contract. The problem is **design and economy coherence**, not plumbing. Five problems make the promo/pack loop feel arbitrary and cut off the long-term chase that gives an Ultimate Team its addictive pull:

1. **Bug.** Spotlight (100–105) and GOAT (106–110) cards quick-sell for **30 coins** (NBA) or **10** (NFL). SBC auto-fill treats them as the cheapest card and **puts a registered 104 Michael Jordan Spotlight into a Bronze Upgrade**.
2. **The Scout Market sells two 94–97 "Hot Season" cards every day** for about 2,100 coins (NBA) or 1,500 (NFL). That is the top non-registry tier, about a day and a half of play for an engaged player. Promo packs, promo SBCs and the January "Hot Season Honors" event become pointless.
3. **Rarity and rating are inverted across chase tiers.**
   - Hot Season (94–97) is a *permanent* tier of 518 NBA / 1,106 NFL cards and is the cheapest chase card.
   - Legends (88–94) are the rarest: about 177k–310k coins expected.
   - Spotlight (100–105) is 20% of a 3,500-coin pack, about 17.5k coins.
   - The year's "pinnacle", the 98–99 Finale, sits below a store pack.
4. **Hot Season cards lie.** A bronze 59 NFL season (Joe Ferguson '77) becomes a **94** whose face shows THP 99 / SAC 90, while the attributes the match reads are THP 79 / SAC 65 (raw overall 72). 115 NFL Hot Season cards are built on bronze or silver seasons.
5. **The Live Calendar is half-built and visually mute.**
   - Check-in stamps, Season Path, extra pass tiers and seeded flash windows exist in the JSON but are not implemented.
   - There is no promo hub, no launch moment, and no branded program walkout: the walkout says "PROGRAM" and the reveal says "8 golds".
   - Program packs are priced almost the same as their guarantee packs (3,000 vs 3,200), so the program pack is never worth buying.
   - Soccer has no calendar at all.

Also high:
- The Preview Pack's one-hour cooldown lets a player buy only Premium packs that contain a special. That cuts a special's cost from about 27,000 to 1,800 coins.
- The Club Collection packs (admin store) undercut the once-a-week Standout Guarantee with no limit. NFL Captains costs 1,000 against 1,800.
- Soccer gets **NFL-position SBCs** that cannot be completed ("Pass Catchers: WR WR TE", "Skill Set: QB RB WR WR TE").
- Odds sheets show tiers only: no OVR-band odds and no holo odds, and the Scout's Choice sheet is inaccurate.

## Measured pack odds and values (10,000 seeded packs each)

"Special" means a Standout, Hot Season, Legend, Landmark, Program, Spotlight or GOAT card. "Walkout" is the chance of a level-2+ walkout (an 86+ gold or any special). QS EV is the mean quick-sell value of the pack's cards. Spotlight EV is understated by the QS bug (finding C1).

### NBA

| Pack | Price | Cards | QS EV | EV/price | Special | 86+ | 90+ | Walkout | Best OVR (mean) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bronze Pack | 250 | 5 | 134 | 0.54 | 0% | 0% | 0% | 0% | 64.0 |
| Silver Pack | 400 | 5 | 240 | 0.60 | 0% | 0% | 0% | 0% | 71.3 |
| Position Pack (avg of 5) | 700 | 3 | 394 | 0.56 | 0% | 1.9% | 0.05% | 1.9% | 81.1 |
| Gold Pack | 900 | 5 | 508 | 0.56 | 2.1% | 2.9% | 0.91% | 4.0% | 81.3 |
| Premium Gold | 1,800 | 8 | 989 | 0.55 | 6.6% | 8.8% | 2.83% | 11.9% | 82.8 |
| Daily Drop | free | 3 | 159 | — | 2.1% | 0.5% | 0.21% | 2.1% | 71.5 |
| Elite Gold | 2,200 | 6 | 1,082 | 0.49 | 10.6% | 12.9% | 2.13% | 19.7% | 83.5 |
| Jumbo Premium | 3,600 | 16 | 1,996 | 0.56 | 7.1% | 15.2% | 3.23% | 18.1% | 83.9 |
| Standout Guarantee | 3,000 | 8 | 1,500 | 0.50 | 100% | 26.8% | 9.75% | 100% | 84.5 |
| Lightning Standout | 2,250 | 8 | 1,501 | **0.67** | 100% | 27.4% | 10.2% | 100% | 84.5 |
| Roster Builder (admin) | 1,500 | 10 | 803 | 0.54 | 0% | 2.1% | 0.05% | 2.1% | 81.2 |
| Captains Pack (admin) | 2,400 | 6 | 1,222 | 0.51 | 100% | 25.9% | 10.5% | 100% | 84.3 |
| Dynasty Pack (admin) | 4,400 | 11 | 2,333 | 0.53 | 100% | 47.3% | 21.2% | 100% | 86.2 |
| Spotlight Pack | 3,500 | 8 | 1,095* | 0.31* | 50.1% | 50.6% | 49.5% | 50.6% | 88.4 |
| Starter | free | 11 | 487 | — | 0% | 0.1% | 0% | 0.1% | 76.3 |
| Scout's Choice (best of 3) | 650 | 1 kept | 315 | 0.48 | 8.6% a Standout option | best ≥86: 79% | 90+: 8.0% | — | 86.9 |

\* The QS bug makes Spotlight and GOAT pulls worth 30 coins. With a correct value (~1,400) the EV is about 1,370 (0.39).

Spotlight per-pack tiers: 27.7% Hot Season, 20.4% Spotlight, 2.0% Legend, 0.03% GOAT. These match the contract.

### NFL (shared wallet; QS ×0.35)

| Pack | Price | Cards | QS EV | EV/price | Special | 86+ | 90+ | Walkout | Best OVR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bronze | 175 | 10 | 95 | 0.54 | 0% | 0% | 0% | 0% | 64.8 |
| Silver | 320 | 10 | 160 | 0.50 | 0% | 0% | 0% | 0% | 72.5 |
| Unit Pack (avg of 6) | 500 | 6 | 266 | 0.53 | 0% | 1.7% | 0.03% | 1.7% | 81.4 |
| Gold | 900 | 12 | 455 | 0.51 | 2.1% | 3.4% | 0.87% | 4.0% | 81.8 |
| Premium Gold | 1,400 | 16 | 701 | 0.50 | 6.6% | 9.1% | 2.98% | 11.1% | 83.2 |
| Daily Drop | free | 6 | 92 | — | 2.1% | 1.0% | 0.24% | 2.1% | 71.5 |
| Elite Gold | 1,500 | 12 | 728 | 0.48 | 11.0% | 14.8% | 2.01% | 19.6% | 83.9 |
| Jumbo Premium | 2,700 | 32 | 1,344 | 0.50 | 6.7% | 15.5% | 2.92% | 17.4% | 84.1 |
| Standout Guarantee | 1,800 | 16 | 899 | 0.50 | 100% | 50.6% | 9.84% | 100% | 85.7 |
| Lightning Standout | 1,350 | 16 | 899 | **0.67** | 100% | 51.1% | 9.80% | 100% | 85.7 |
| Roster Builder (admin) | 900 | 19 | 480 | 0.53 | 0% | 0.8% | 0.03% | 0.8% | 80.8 |
| **Captains Pack (admin)** | **1,000** | 9 | 552 | 0.55 | **100%** | 49.0% | 10.5% | 100% | 85.4 |
| Dynasty Pack (admin) | 1,900 | 16 | 1,029 | 0.54 | 100% | 75.7% | 19.4% | 100% | 87.3 |
| Spotlight Pack | 3,500 | 16 | 670* | 0.19* | 49.6% | 49.8% | 49.4% | 49.8% | 88.4 |
| Scout's Choice | 250 | 1 kept | 113 | 0.45 | 9.3% | 79% | 10.1% | — | 87.0 |

### Soccer (no Spotlight, no Live Calendar)

| Pack | Price | Cards | QS EV | EV/price | Special | 86+ | 90+ | Walkout | Best OVR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bronze | 220 | 7 | 129 | 0.58 | 0% | 0% | 0% | 0% | 64.9 |
| Silver | 380 | 7 | 221 | 0.58 | 0% | 0% | 0% | 0% | 71.7 |
| Position (avg of 4) | 650 | 4 | 323 | 0.50 | 0% | 2.9% | 0.13% | 2.9% | 81.4 |
| Gold | 900 | 6 | 412 | 0.46 | 2.5% | 4.2% | 0.70% | 5.2% | 81.4 |
| Premium Gold | 1,600 | 10 | 813 | 0.51 | 6.6% | 12.9% | 2.33% | 15.4% | 83.3 |
| Elite Gold | 1,900 | 8 | 873 | 0.46 | 11.2% | 21.9% | 3.15% | 26.7% | 84.2 |
| Jumbo Premium | 3,200 | 21 | 1,634 | 0.51 | 6.6% | 22.9% | 2.59% | 25.1% | 84.3 |
| Standout Guarantee | 2,600 | 11 | 1,643 | **0.63** | 100% | 52.2% | 19.6% | 100% | 85.7 |
| Lightning Standout | 1,950 | 11 | 1,640 | **0.84** | 100% | 50.7% | 19.5% | 100% | 85.7 |
| Captains (admin) | 2,300 | 6 | 1,220 | 0.53 | 100% | 48.1% | 19.4% | 100% | 85.3 |
| Dynasty (admin) | 4,300 | 11 | 2,370 | 0.55 | 100% | 76.1% | 36.4% | 100% | 87.4 |
| Scout's Choice | 500 | 1 kept | 210 | 0.42 | 8.6% | 87% | 21.6% | — | 87.9 |

### Live Calendar program packs (NBA / NFL, on their live day)

| Pack | NBA price | P(program) | NBA EV/price | NFL price | NFL EV/price |
|---|---:|---:|---:|---:|---:|
| First Tip Pack (program, 3/day) | 3,000 | 30% (else a Standout) | 0.53 | 1,800 | 0.51 |
| **First Tip Guarantee (1/week)** | **3,200** | **100%** | 0.51 | **1,900** | 0.48 |
| Hot Season Pack (s4-honors) | 3,600 | 6% Honors + 1% Legends | 0.43 | 2,200 | 0.42 |
| Postseason Primetime Pack / Guarantee | 3,600 / 3,800 | 25% / 100% | 0.45 / 0.50 | 2,200 / 2,200 | 0.43 / 0.47 |
| Ring Night Pack / Guarantee | 4,200 / 4,900 | 8% / 100% | 0.37 / 0.45 | 2,500 / 2,800 | 0.37 / 0.40 |
| Dream Teams Pack / Guarantee | 3,600 / 4,100 | 20% / 100% | 0.45 / 0.49 | 2,200 / 2,300 | 0.43 / 0.45 |

Tier shares match the published slot odds. The engine draws exactly what the sheets say.

### Duplicates (one player opening the same pack type in a row; share of pulls that are an edition he already got)

- NBA Premium: 2% after 25 packs, 6% after 100, 12% after 200.
- Elite: 15% after 100, 27% after 200.
- Position packs: 11–17% after 100, 22–29% after 200. NFL LB/DL/OL units reach 39–47% after 200.
- Guaranteed-Standout packs: the chase slot draws from only 8 (NBA), 15 (NFL) or 11 (soccer) cards. A single Standout edition is 1.6–2.3% of *all* cards pulled from Captains/Dynasty. Four NBA Dynasty packs give 8 Standouts from 8 cards, so about 34% of chase pulls are repeats.

---

## Findings

### Critical

**C1. Spotlight and GOAT cards quick-sell for 30 / 10 coins, and SBC auto-fill spends them first.**
- Evidence: `src/ut/packs.ts:504-517`. The GOAT and Spotlight values are set in one `if/else`, then a *second* chain (`if (rc.tier === 'legend') … else v = 15 + 15 * clamp01(…)`) overwrites them with the bronze formula.
- Measured: `qsByTier` gives spotlight `[30,30,30]` and goat `[30,30,30]` (NBA), `[10,10,10]` (NFL).
- `audit-scripts/autofill.ts`: with an unplayed Spotlight MJ (104) in the club, `autoFill` (`sbc.ts:420`, cheapest QS first; `Challenges.tsx:166`) submits it to **Bronze Upgrade → Silver pack**, Silver Upgrade, Gold Upgrade, Pairs, Golden Pair, Hot Season Hunt and Silver to Gold.
- The confirm sheet (`Challenges.tsx:254-266`) gives no warning about a numbered or special card. The card detail's SELL button reads "SELL 30" on a card that cost a 3,500-coin pack, and duplicate "QUICK SELL DUPES" totals also undercount.
- Impact: players can lose a registered, serial-numbered chase card for a Silver pack. That is irreversible loss of the rarest items in the game. Spotlight pack EV is also misreported (0.31 / 0.19), and the Pack Tracker's "return" is wrong for Spotlight pulls.
- Fix:
  - Make the QS chain one `if/else` (GOAT 5,000+ and Spotlight 1,400+ values already exist).
  - Exclude goat, spotlight, legend, landmark, finale and any card with `mint` from `autoFill` candidates unless the player picks them by hand.
  - Add a red warning row in the SBC confirm when any special or numbered card is included.
  - Add a unit test: `quickSellValue` must be monotonic by tier rank for every tier.

**C2. The Scout Market sells 94–97 "Hot Season" cards every day at about one Premium pack's price.**
- Evidence: `market.ts:27` has `MARKET_MIX` with two `promo` slots and one `standout` slot a day. `market.ts:28,32` sets the price to 3×QS with a 1,500 floor.
- Over 28 days: NBA promo mean price 2,137 for mean OVR 95.4; NFL 1,500 for OVR 94.9. The Featured Standout appears at 2,750.
- Screenshot `nba-390-market-0.png`: Stephen Curry 95 and George Gervin 95 Hot Season for 2,100 each, Kareem Abdul-Jabbar 93 Featured Standout for 2,750.
- Compare the pack routes (NBA):
  - A Hot Season from Premium Gold costs 1,800 / 1.9% ≈ 96,000 coins.
  - From the Spotlight pack (27.7%) about 12,600.
  - The market makes it **45× cheaper than Premium and 6× cheaper than Spotlight**.
- Impact:
  - An engaged player (~1,300 coins/day, see Economy) can field an all-94+ NBA starting five in roughly 8–10 days.
  - Every promo pack, promo SBC and the January "Hot Season Honors" program (94–97) loses its point.
  - The "chase" ends in the first two weeks. This is the single largest threat to long-term retention in this area.
- Fix:
  - Restrict the market to silver, gold and rare gold (plus at most one *base* 86+ gold).
  - If specials stay, price them at 10–25× QS with a weekly limit of 1, never Hot Season or Featured.
  - Add a regression test that no market item's OVR exceeds the best Premium-pack gold band.

**C3. Rarity and rating are inverted across the chase tiers. Promos have no coherent power ladder.**

| Tier (NBA) | Displayed OVR | Cards in the pool | Cheapest route | Expected coins |
|---|---|---:|---|---:|
| Hot Season ("promo") | 94–97 (79 at 94, 257 at 95, 168 at 96, 14 at 97) | 518 (NFL 1,106) | Scout Market | ~2,100 |
| Featured Standout | 91–93 | 1/week | Market / Standout pack 10% | ~2,750 |
| Spotlight | 100–105 | 120 | Spotlight pack 20% | ~17,500 |
| Legend | 88–94 | 120 | Spotlight 1.98% / Elite 0.98% / Premium 0.58% | ~177,000–310,000 |
| Finale (year's pinnacle) | 98–99 | 5 | SBC: team 94 + 6 promo + **1 Legend** | gated by a Legend |
| GOAT | 106–110 | 20 | Spotlight 0.05% | ~7,000,000 |

- Evidence: `ut-scale.ts:47,54` (promo knots map seasons of 78–91 into 94–97); `packs.ts:72-85`; the contract `SPOTLIGHT_RATES`; `calendar-sbc.ts` header ("the Finale is the only way to a 98–99 card").
- Impact:
  - The best-rated cards are the easiest to get. The rarest (Legends) are rated *below* them.
  - A 3,500-coin store pack beats the year-long Finale.
  - Players can't read value from a card's colour or number. This is exactly the "promos feel arbitrary" complaint.
- Fix: define one tier ladder, with rating and rarity rising together, and enforce it in a test. Suggested ladder:
  - Gold 75–91.
  - Weekly Standout: base +1 to +3, 80–93.
  - Program: base +4 to +6, gated (already true).
  - Hot Season *award* editions re-rated by ID to base +3 to +6 (MVP highest, stat titles lowest), cap 95.
  - Legend/Icon: three versions (base / mid / prime).
  - January Honors: 94–97, time-limited.
  - Finale 98–99.
  - Spotlight 100–105, GOAT 106–110 (registry).
  - Card IDs stay. A UT online queue bump is required (ratings change → `pool.print` changes; bump UT NBA 10→11, NFL 11→12, and soccer 2→3 if soccer promos are touched).

**C4. Hot Season (and Legend) cards display numbers the match does not use.**
- Evidence: `rate.ts:328-337`. The displayed overall comes from the edition curve (`editionDisplay`), while the playable profile gains only the line's `boost` (3–6) and the *face* is lifted by `faceLift` to match the new number.
- `audit-scripts/promoattrs2.ts` (NFL):
  - Joe Ferguson 1977 QB: base **59 bronze** → Hot Season **94**. Face: THP 99, SAC 90, MAC 88. Real key attributes: THP 79, SAC 65, MAC 63; raw overall 72.
  - William Henderson 2004 FB: 59 → 94, face BTK 99, real BTK 77.
  - 115 NFL Hot Season cards are built on bronze or silver seasons; 61 have a raw overall under 85.
- NBA: Nate McMillan 1994 (75 base) → 94 with DEF 99 shown; Ron Lee 1978 (73) → 94; 35 cards with raw overall under 85.
- Legends behave the same way, more mildly: Michael Cooper '81 (base 76) → Legend 88; Bruce Bowen '06 (75) → 88.
- Impact:
  - The card art promises 99s that don't exist in play ("stats feel legit" is an explicit owner ask).
  - `teamOvr` requirements in SBCs use the inflated number.
  - Squad overall and matchmaking misstate strength.
- Fix: rate award editions as season + boost with the face computed from the *real* attributes (the `rateEdition` approach for Standouts and Landmarks already does this right). Keep `promo` IDs; re-rate by ID; bump the UT queues.

### High

**H1. The Preview Pack cooldown lets players cherry-pick specials.**
- Evidence: `preview-pack.ts:12`: the cooldown is one hour after a *skip*, and none after a buy. `UltimateTeam.tsx:838-872` has no daily cap.
- 6.64% of Premium previews hold a special. With hourly checks (about 16 a day) a player sees one about 67% of days and buys only those: **1,800 coins per special instead of about 27,100**.
- A Legend preview (0.58%) appears about every 11 days, and it then costs 1,800 instead of about 310,000.
- Impact: an optimal player bypasses pack odds, and the "dopamine of the unknown" turns into a chore of checking every hour.
- Fix: one preview per 24 h per pack type (as in the FC original), cooldown applied after a buy as well, and the preview seed advanced on week change too (today the contents depend on `week`, so a reload across Monday shows different cards, breaking "no rerolls").

**H2. The Club Collection (admin) packs undercut the limited Standout Guarantee and sit above Featured.**
- Evidence: `src/admin/catalog.ts:14-48`.
  - NBA Captains: 2,400 for 3 gold + 2 rare + 1 Standout, unlimited. The Standout Guarantee is 3,000, once a week.
  - NFL Captains: **1,000** against 1,800. NFL Dynasty: 1,900 for 2 Standouts.
- Screenshots `nba-390-store-0.png` and `nba-390-store-1.png`: Captains is shown directly above the Standout Guarantee.
- `checkedCatalog` allows any price from 500 to 100,000 with no limit fields, and the catalog is configurable live over Nostr.
- Duplicates: the chase slot draws from the same 8–15 weekly Standouts (see Duplicates).
- Impact: the weekly-limit design is void. The "Featured" chase packs read as worse deals than generic admin packs.
- Fix:
  - Enforce `price per guaranteed Standout ≥ Standout Guarantee price` in `checkedCatalog`.
  - Add per-day and per-week limits to studio packs.
  - Move Club Collection below Featured and This Season.
  - Exclude Standouts already owned from the chase slot (duplicate protection), or draw the slot from the last 4 weeks of Standouts.

**H3. Program packs are priced almost the same as their guarantee packs.**
- Evidence: `live-packs.ts:24-31`. The schedule planned 5,000 (program) against 12,000 (guarantee). `PRICE_FACTOR` (nba 0.6 / 0.27, nfl 0.36 / 0.155) collapses that to 3,000 against 3,200 (NBA) and 1,800 against 1,900 (NFL).
- Screenshot `nba-390-firsttip-store-1.png`.
- At 30% program odds, the program pack's cost per program card is 10,000 against 3,200 for the guarantee.
- Impact: the program pack, the main promo pack bought three times a day, is never the right buy. After the weekly guarantee, players have no promo pack worth buying. Promo weeks feel thin.
- Fix:
  - Price the guarantee at ≥2.2× the program pack.
  - Raise program-pack odds during each wave's first 24 h ("promo boost", as FC promo packs do).
  - Add a 1-of-3 program *pick* as the weekly guarantee.

**H4. Soccer gets impossible NFL-position SBCs.**
- Evidence: `sbc.ts:293,300,310,325` use two-way `nba(c) ? … : …`, so soccer receives "Pass Catchers (WR WR TE)", "Skill Set (QB RB WR WR TE)", "No Fly Zone (CB CB S S)" and "Gold Front Seven (DE DE DT DT LB LB LB)".
- Over 28 days they appear 8, 10, 12 and 14 times (`out/promos-soccer.json`). On 2026-11-12 soccer shows Pass Catchers (Gold pack) and Skill Set (Premium).
- Screenshot `soccer-390-sbc-2.png`.
- `src/engine/sport-branches.test.ts:25-33` patterns miss helper ternaries like `nba(c) ?`.
- Impact: dead challenges with Premium rewards every few days; soccer players see NFL vocabulary.
- Fix:
  - Rewrite these four templates with `pickFor(c.pool.sport, { nba, nfl, soccer })`. Soccer equivalents: "Back Four: FB CB CB FB", "Midfield Engine: DM CM AM", "Front Three: W ST W", "Gold Spine: GK CB DM ST".
  - Extend the guard regex to `\bnba\([^)]*\)\s*\?` and `\bnfl\([^)]*\)\s*\?`.

**H5. Odds disclosure falls short of a real Ultimate Team in four ways.**
- Evidence: `Store.tsx:61-125`; screenshots `nba-390-odds-*.png`.
- (a) **No OVR-band odds.** Sheets list tier odds per slot and a vague "each point above the tier's floor is a little rarer". FC-style disclosure gives "chance of at least one 83+/85+/87+/90+". The data exists: in this audit, Premium NBA has 8.8% for 86+ and 2.83% for 90+.
- (b) **Holo variants are undisclosed.** `variants.ts:15` has `HOLO_CHANCE = 0.04` for every special edition.
- (c) **The Scout's Choice sheet is inaccurate.**
  - The options are picked *uniformly* among 84+ golds (`content-packs.ts:167`), not weighted toward low overalls as the sheet says.
  - The Featured Standout comes up 1 in 8 (NBA) or 1 in 15 (NFL) (`content-packs.ts:162`), not the "10%" printed.
  - "Three 84+ golds" is broken when a Standout option rated 80–83 appears.
- (d) Rounding makes rows not add to 100: "Gold 93%" + 4 + 2 + 0.66 = 99.66.
- Impact: for a loot game, accurate disclosure is a trust and store-policy issue.
- Fix:
  - Add an OVR-band table per pack, computed by the same seeded simulation `pull-log.ts expectedFor` already runs (or exactly from bucket weights), plus a holo line.
  - Fix the Scout copy.
  - Show "less than 0.1%" rather than rounding.
  - A test should assert that every number on the sheet matches a 10k-pack simulation within tolerance.

**H6. Promos have no presence: no promo hub, no launch moment, no branded walkout.**
- Evidence:
  - No view lists a program's cards: `promoCards` and `selectPromo` are used by no `.tsx`.
  - Home's `SeasonBanner.tsx` shows only text chips: name, OVR band, end date (`nba-390-firsttip-ut-home.png`, `nba-390-honors-ut-home.png`).
  - No first-open splash when a promo or wave starts (`promosOn` is only used by the banner).
  - In `PackOpening.tsx` program cards get the generic walkout. The tier word is `TIER_NAMES.program` = "PROGRAM" (`:356`). The reveal heading chain (`:420-436`) has no `program` case, so a 97 Hot Season Honors pull is titled "8 golds".
  - Only Standout and Landmark have custom scenery.
  - Pack art is the same "NBA UT <LABEL>" foil for every program, with only accent colours. Long labels are cut off at full size ("STANDOUT G…", "PREMIUM GO…"; `nba-390-open-0-pack.png`, `nfl-390-buy-premium-0.png`).
- Impact: promos are the heartbeat of an Ultimate Team. Here a new promo is a line of grey text, and its best pull is announced as "golds".
- Fix:
  - Add a Promo Hub page per program: hero art from the top card, a grid of released cards with locked silhouettes for future waves and countdowns, the SBCs and objectives that award it, and its packs and odds.
  - Show a one-time launch modal on the first UT open after a promo or wave starts.
  - Add program walkout scenery: the accent colours, the promo name as the stamp, and the wave name.
  - Add a `program` case in the reveal heading.
  - Use per-program pack art (an SVG pattern from the accent colours, the promo name on two lines, auto-fit text).

**H7. The Live Calendar is only half-built, and soccer has none.**
- Evidence: `src/data/live-calendar.json` `defaults` defines `checkIn` (10 stamps: Gold, Premium, Scout, Elite, Jumbo, program pick…), `seasonPath` (4 season-long goals), `pass.extraTierRewards` and `flashWindows` (2 seeded windows per weekend). `grep` finds no reader for any of them in `src/`.
- Lightning uses fixed Sat/Sun 12–2 and 8–10 pm windows (`content-packs.ts:29`), 4 per weekend, not the planned 2 seeded ones.
- `calendar.ts:96-99` returns `null` for soccer: no programs, no season banner, no promo SBCs.
- Impact: the designed "show up every day of the season" loop (check-in stamps leading to a program pick) is missing. Soccer has no promo cadence at all.
- Fix:
  - Implement check-in (one stamp per distinct day with a UT match) and Season Path as additive `ut.content` claims with stable IDs.
  - Wire `extraTierRewards`.
  - Make flash windows seeded per week, so they are a surprise.
  - Give soccer a calendar with its own named promos (team of the matchday, Derby Week, Golden Boot race…).

**H8. Promo sets are flat, headliner-less and repetitive.**
- Evidence (`out/promos-nba.json`): band clamping gives whole promos a single OVR:
  - Cup Crown: all 87.
  - Thirty a Night: all 92.
  - Capital Classics: 88–89.
  - Postseason Primetime: 90–91.
  - Hot Season Legends: all 92.
- Only 3 of 42 promos have a featured headliner.
- In the frozen manifest, NBA's 340 program cards cover just 124 players: Michael Jordan '88 appears in **8** program editions, LeBron James in 14, Wilt Chamberlain in 12.
- After year one, `-y2` promos reuse the same seeded selection (`live-cards.ts` shuffles by `promo.baseId`), so the same players come back with new IDs.
- Impact: promos look interchangeable. There is no "who's the 93 this week?" moment, and the same legends keep coming back.
- Fix:
  - Every promo gets 1–2 headliners 2–4 points above the band, revealed last in the hub.
  - Cap any (pid, season) at 2 program editions a year and any player at 4.
  - Seed the cycle-2 selection with the cycle ID and exclude the previous year's picks (`excludePrevious` already exists in the type).
  - Widen bands, so the delta, not the clamp, decides the OVR.

**H9. Weekly Standouts are arbitrary, and their walkouts are cheapened.**
- Evidence: `standouts.ts:36-90`. Standouts are drawn at random from all seasons with base 77–89, and the "theme decade" only applies to the featured card. Screenshot `nba-390-standouts-0.png`: "THEME: THE 1970S", with the other seven from '93, '08, '09, '11, '17, '25 and '26.
- Over a year, 69% of non-featured NBA Standouts are 80–84 (`standoutsYear`).
- `walkoutLevel` (`packs.ts:531-537`) gives every Standout a level-2 walkout with confetti, so an 82 Dale Davis gets the full scene (`nba-390-open-1-walk-2800.png`), while an 85 base gold gets none.
- No reason is shown for *why* a player is a Standout.
- Impact: TOTW-style promos work because they reward real performances. Here they read as random cards with a teal frame.
- Fix:
  - Pick Standouts by a theme: "this week in history" seasons with milestone games in this calendar week, franchise week, or rookie week.
  - Print the reason line ("51 pts vs SEA, Nov 12 1992") on the card back.
  - Walk out only for 86+ or the featured card; otherwise use a smaller "promo flash" reveal.

### Medium

**M1. The walkout scale is not tied to value, and there are no follow-up loops.**
- `walkoutLevel` gives the same level 2 to an 80 Standout, an 86 gold and a 97 Hot Season; Legend and Spotlight share level 3.
- Only the best card walks out. A Dynasty pack with 2 Standouts, or a Jumbo with a Legend and a Standout, gets one walkout.
- After the reveal there is only SEE CLUB / DONE: no "Open next pack (n left)" and no "Buy again" (`nba-390-open-2-reveal.png`).
- Fix: map walkout level to displayed OVR within specials (≥94 → 3), walk out each special in turn, and add OPEN NEXT and BUY AGAIN buttons to the reveal.

**M2. Some packs exceed the economy's own 45–60% EV target, and the tests don't cover them.**
- Lightning: 0.67 (NBA/NFL) and **0.84** (soccer). Soccer Standout Guarantee: 0.63.
- `economy.test.ts:63-75` skips Spotlight and Scout. It never covers Lightning-type prices against the target band, the Market, Preview or the admin packs.
- Fix: a test asserting the 0.40–0.60 band for every *sold* item, including Market and Club Collection, per sport.

**M3. Program SBC rewards can hand out cards from waves not yet released.**
- `live-cards.ts:200`: `programReward` uses `promoCards(pool, id, promo.end)`, the whole selection.
- This contradicts `upcoming()`'s "players are never revealed early" and spoils later waves (e.g. the Cup Crown "Final" wave).
- Fix: use the released waves only, or reward a pick from the current wave.

**M4. Pack purchases have no confirmation.**
- `UltimateTeam.tsx:972-1012`: one tap spends up to 4,400 coins. The "short" button still accepts taps and shows a toast.
- Fix: a confirm sheet for packs ≥1,500 with an "always skip" toggle; a disabled visual state when the player can't afford it.

**M5. Prices are inconsistent across the shared wallet.**
- Spotlight is 3,500 in both sports, while every other NFL pack is 35–78% of NBA's.
- NFL Scout's Choice is 250 against 650. NFL Captains is 1,000 against 2,400.
- Coins are shared across sports, so this shapes which sport a player spends in.
- Fix: price from a per-sport "value of a guaranteed chase item" table, not per pack.

**M6. Store information architecture.**
- About 15 store items plus "This Season". The order is: Your packs → Daily Drop → **Club Collection** → This Season → Featured → Picks → Preview → All packs, with Spotlight last.
- The Spotlight blurb hides its 28% Hot Season and 2% Legend odds (sheet only).
- The coin pill shows "60000" with no thousands separator, while buttons show "1,500" (`nba-390-store-*.png`).
- Fix: order This Season → Featured → Picks → Store packs → Club Collection, and badge the "best value" item.

**M7. Weak duplicate handling on chase slots.**
- Measured above: Elite 27% and Unit packs up to 47% repeats over 200 packs; Standout slots repeat within a week.
- Fix: no repeat of an owned Standout or program card in guaranteed chase slots until the set is complete (a common "no dupes" promise in promo packs), and a "duplicate → 3× QS" auto-swap option for specials.

**M8. "Rare gold" is just the top 35% by OVR.**
- `rare.ts:7`: the cut is 78–80 by position, so "1 rare guaranteed" means "one card ≥ about 79".
- Fine mechanically, but the concept is invisible: the shimmer is subtle and the odds sheet explains it in a footnote.
- Fix: rename it on the face ("82+ guaranteed"), or keep it rare and make it visible (a foil stripe), and show "Rare" in Pack Helper tags.

**M9. Season Pass and calendar are not connected.**
- The pass is 25 generic tiers (`progression.ts:182-190`), mostly 100–150 coins, with a Spotlight at 25. It is not themed to the calendar season (name, accent, the program pick).
- Fix: theme each pass to the current Live season, put that season's program pick and guarantee on tiers 10, 20 and 25, and show the next reward card art.

**M10. Weak Standout week boundary and pick variety.**
- Standouts roll Monday (ISO week); the plan says Wednesday (`live-calendar.json defaults.rhythm`).
- `standoutOptions` (Standout Pick) shuffles all 8 and takes 3 with no featured weighting.
- Low-impact consistency issues; align with the plan or update the plan.

### Low

- **L1.** The "WK 46" chip overlaps the OVR digits on Standout cards, and the walkout's pulse line runs through the "WEEKLY STANDOUT · WK 46" eyebrow (`nba-390-open-1-walk-2800.png`, `nba-390-standouts-0.png`). Pack labels are truncated, and the NFL "Unit Pack" art reads "POSITION".
- **L2.** The Daily Drop blurb ("the last can be a gold or a Weekly Standout") doesn't give the 38% / 2% numbers that the sheet has.
- **L3.** `?ns=inspect` still issued a request to the live Supabase host during Store QA (blocked by my route filter). QA scripts should keep blocking non-localhost hosts.
- **L4.** Soccer "Hot Season" editions include cards rated 73–77 (Édouard Duplan 2016 "ASSISTS TITLE" at 73). A "Hot Season" rated as a silver is confusing, and its QS (350) beats most golds. Soccer award editions average only +3.3 over base, so they feel like reprints.
- **L5.** `HOLO` variants raise Item Score but have no reveal moment or odds line (see H5).

---

## Promo audit

**Promos that exist, and how far they rate above base:**

| Promo | Where it comes from | Uplift (measured) | Count |
|---|---|---|---|
| Hot Season (permanent `promo` tier; awards, MVP, All-NBA 1st, stat titles) | Premium 2%, Gold 0.5%, Spotlight 27.7%, **Market 2/day**, weekly SBCs | NBA +6 to +21 (mean +11.3); NFL mean +14.1 with 107 cards at +21 or more; displayed 94–97 | 518 NBA / 1,106 NFL / 277 soccer |
| Legend | Premium 0.66%, Gold 0.2%, Elite 1%, Spotlight 2% | +3 to +12 (mean +6.5 NBA / +7.3 NFL), 88–95 | 120 / 130 / 132 |
| Weekly Standout | packs' special slot, Standout Guarantee/Lightning, SBC, objective, Market | +3 (featured +5), 80–93 | 8 / 15 / 11 a week |
| Landmark Season | calendar landmark SBCs | mostly +4 (floor 85, cap 93) | 252 NBA / 354 NFL |
| Live programs (42 a year) | program packs / guarantees / SBCs / picks | +4 to +9, gated to "visibly improves, ≤2 floor-up" | 340 NBA / 542 NFL cards |
| Finale (98–99) | SBC only | +9 | 5 / 8 |
| Spotlight / GOAT | registry-rolled | +17 / +21, 100–110 | 120 / 20 (NBA) |

**Cadence.**
- Live Calendar: 12 seasons a year, each with 2–5 promos. Programs run about 14 days, overlapping, and drop on Fridays.
- Waves: 2–5 per promo where used. Landmark SBCs run alongside.
- That cadence is good, and close to FC's weekly Friday promos with team 1 and team 2 a week apart.
- It is undercut by C2 and C3, which sell the top tier daily; by H6 (no presentation); and by H8 (flat sets, repeated players).

**How promos are introduced.**
- Only through the Home banner's text chips, the Store's "This Season" section and the SBC list.
- There is no launch moment, hub, trailer or countdown, and no "new" badge on the Store tab when a wave drops.
- `upcoming()` teases names and bands, which is good; it should become a countdown card with silhouettes.

**Are they exciting or arbitrary?**
- *Live programs:* the rating rule is legitimate and well built (gated uplift, frozen manifest, stable IDs). They read as arbitrary only because sets are flat and repetitive and presentation is absent.
- *Hot Season and Standouts:* arbitrary today. They are random, flat at 94–97 regardless of base, and Standouts lack any narrative.

## Economy

**Coin sources** (code constants):
- UT matches: `play.ts:45-53`: 60 for a win, 30 for a loss, × difficulty pay (0.6 / 1 / 1.5 / 2.2), **8 paid games a day**.
- Daily objectives: 200 coins (`progression.ts:267-271`) + daily bonus 100 and a Silver pack.
- Login calendar: average 180 coins a day plus Silver, Gold and a gold pick (`daily-hub.ts:23-29`).
- Weekly: objectives 250 + Gold + Silver; Circuit 150 + 350 + 750 + Silver/Gold/**Spotlight** for 6 wins (`circuit.ts:8-12`); Rivals 50–400 + a pack; Cup 200–300 + Gold/Premium.
- Season Pass: 25 tiers, mostly 100–150 coins, Premium at 10/15/20 and Spotlight at 25.
- Draft modes: about 400 coins a day (the `packs.ts` header).
- The wallet is shared across sports.

**Estimated earnings:**
- Casual UT player (4 Pro games at 50%, objectives, calendar): about **650 coins/day** plus about 1 pack a day.
- Engaged player (8 All-Star games at 55% = 558, objectives 300, calendar 180, weekly prizes ~270 a day): about **1,300 coins/day** in UT, about 1,700 with drafts, plus about 10 packs a week and a weekly Spotlight pack from the Circuit.

**Days to afford (NBA prices; casual / engaged in UT only):**

| Item | Price | Casual | Engaged |
|---|---:|---:|---:|
| Gold | 900 | 1.4 | 0.7 |
| Premium Gold | 1,800 | 2.8 | 1.4 |
| Market Hot Season (94–97) | ~2,100 | 3.2 | 1.6 |
| Elite Gold | 2,200 | 3.4 | 1.7 |
| Standout Guarantee | 3,000 | 4.6 | 2.3 |
| Program Guarantee | 3,200 | 4.9 | 2.5 |
| Spotlight | 3,500 | 5.4 | 2.7 |
| Jumbo Premium | 3,600 | 5.5 | 2.8 |
| Dynasty (admin) | 4,400 | 6.8 | 3.4 |
| A Legend (expected, best route) | ~177,000 | ~270 | ~136 |

**Comparison.**
- Prices against earnings are reasonable for packs: a pack every one to three days is the right rhythm for a mobile coins-only game.
- The problem is the *ceiling*. In the FC original, the top promo cards cost hundreds of pack-equivalents. Here, the 94–97 tier costs about 1.2 Premium packs while Legends (lower rated) cost about 100 Premium packs.
- The days-to-gold-squad test (`economy.test.ts`: 3–9 days seller, 5–12 keeper) holds, and is a good guard to keep.

**SBC reward value** (NBA, cheapest fodder by QS: gold 100–105, silver 40–60):
- **Good:**
  - Upgrades: 5 bronze (~110 QS) → Silver pack (EV 240); 5 silver (~300) → Gold pack (EV 508).
  - Golden Hour: 8 golds → 84+ uniform pick (mean OVR 85.5); Elite Pull → 88+ (mean 88.7). These are uniform within the tier, which is generous compared with pack weighting (pack gold mean 77.9).
- **Too generous:** "Hot Season Hunt" (6 cards: 5 gold, 3 teammates) and "Rival Dynasties" or "Dynasty" give a 94–97 card for about 650 QS of fodder. About 1.8 such SBCs appear each week, and the calendar Finale's "6 promo" requirement becomes trivial.
- **Broken:** soccer's four NFL-position SBCs (H4).

**Sell prices.**
- QS values: bronze 15–30, silver 40–80, gold 100–400 (curve exponent 1.5), Hot Season 660–780, Legend 2,500–3,250 (NBA); ×0.35 NFL, ×0.7 soccer.
- Pack QS EV is 0.42–0.60 for almost every pack (target 0.45–0.60), so selling never loops profitably. Exceptions: Lightning (M2), and Spotlight and GOAT, which are broken (C1).
- Quick-sell is the only coin sink return (no trading), so QS is the right tuning lever. It should not be the *only* balance metric. Squad-value metrics (P(86+), P(90+), best OVR) are what players feel.

**Are odds shown to players?**
- Yes: per slot, per pack, with pack-level "in this pack" chances, a GOAT disclaimer and the Pack Tracker's "you against the odds".
- That is better than many shipped games.
- Missing: OVR bands, holo, and accurate Scout and pick sheets (H5).

## Comparison with real Ultimate Team products (mechanics only; original names kept)

| Mechanic | FC / MyTEAM / MUT standard | Here | Gap |
|---|---|---|---|
| Guaranteed rare slots | "1 rare / 3 rares guaranteed" per pack | Rare golds guaranteed (1 in Gold, 3 in Premium) | OK. "Rare" is an OVR cut (M8) |
| OVR-band odds | Disclosed per pack (83+/85+/87+…) | Tier odds only | H5 |
| Player picks | 1 of 3 at an OVR floor, untradeable | Scout's Choice, calendar and program picks, Swap Desk | Good. Sheet inaccurate |
| Promo boosting | Promo packs boost the current promo slot; guaranteed promo packs | 30% program slot; guarantee 1/week | Guarantee mispriced (H3); no first-24h boost |
| Promo cadence & hub | Weekly Friday promo, team 1/team 2, hub, loading-screen reveal, countdowns | Good schedule, no hub or reveal | H6, H7 |
| Promo power ladder | TOTW +1–3 < promo +4–6 < TOTY 97–99 (limited window) < Icons by version | Inverted (C3); TOTY-like tier always sold (C2) | Critical |
| Untradeables / duplicates | SBC/objective rewards untradeable; duplicate swap; "no dupes" in promo picks | No trading; duplicate storage + QS dupes; no chase dupe protection | M7 |
| Preview pack | 1 per 24 h | 1-hour cooldown, none after a buy | H1 |
| Lightning / limited packs | Limited stock, timed | Fixed weekend windows, 1 per window, 25% off | OK. EV above target (M2) |
| Box packs (MyTEAM) | Fixed contents; odds improve as you open | Not present | Idea: a promo "box" per program |
| Walkouts | Flare colour by tier/OVR; multiple walkouts; clue sequence | Clue sequence (nice); one walkout; not OVR-keyed | M1 |

## What already works well and must be preserved

- **Deterministic, seed-addressable packs** (`packRand`, `fill`), with stable, never-renamed edition IDs that resolve forever. This covers Standout, Landmark and `live` IDs, which rebuild from the ID, and `holo~` and `evo~` variants. All fixes should re-rate by ID, never rename.
- **Slot-based odds with one `drawTier` and exact per-pack probabilities** on the sheet. The engine matches its published odds in simulation, and a test checks Legend odds.
- **The Spotlight/GOAT chase is server-rolled from a shared contract** (`contract.ts`, integer buckets), with per-actor limits (30/hour, 100/day) and registered serials. Keep it separate from local packs.
- **The Pack Tracker**, comparing a player's pulls with the published odds through the same code. This is rare transparency; extend it with OVR bands.
- **The economy guard tests**: no pack sells for more than it cost, and days to a gold squad. Extend them to Market, Preview, Lightning and admin packs.
- **The Live selection rule**: every program card visibly improves, at most +2 floor-up, frozen per promo in `live-editions.json`. The calendar's 12-season structure, waves and Friday rhythm are a strong backbone.
- **Purchase limits** (day / week / window) and their stable keys; Lightning windows; Daily Drop streak; login calendar; the Swap Desk turning dupes into picks.
- **Pack Helper tags** (NEW, UPGRADE +N, SET, SBC FODDER), automatic duplicate storage and "quick sell dupes" from the reveal.
- **Pack cinema**: tear, era → conference → franchise clue walkout, skip at every stage, reduced-motion path, cancellable synthesized audio, focus trap and Escape. Standout and Landmark scenery are good templates for the missing program scenery.
- **Coins only**, with the "never real money" note in the Store.

## Suggested fix order (dependencies noted)

1. **C1** (QS chain, auto-fill exclusion, confirm warning). A pure bug fix with no rating change and no queue bump.
2. **C2 + H1 + H2 + H3 + M2.** Economy levers: Market mix, preview cooldown, admin price floor and limits, guarantee pricing, Lightning EV. No rating change.
3. **H4.** Soccer SBC templates and the extended sport-branch guard.
4. **C3 + C4.** Re-rate Hot Season and Legend editions by ID to the ladder, with the real-attribute face. This changes ratings and `pool.print`, so bump the UT queues (NBA 10→11, NFL 11→12, soccer 2→3 if soccer award editions change). Keep every ID. Re-run `fit_ut_scale` / `fit_ut_balance` and the ratings audit.
5. **H6 + M1.** Promo hub, launch modal, program walkout and heading, per-program pack art, OPEN NEXT / BUY AGAIN, OVR-keyed and multiple walkouts.
6. **H5.** OVR-band and holo odds on every sheet; an accuracy test against simulation.
7. **H7 + H8 + H9.** Check-in, Season Path, seeded flash windows, a soccer calendar; headliners and repeat caps; themed Standouts with a reason line. New state stays additive in `ut.content` with stable claim IDs.

Screenshots: `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-shots/packs-promos/`, with:
- `nba-390-store-0..3`, `nba-430-store-*`, `nba-320-store-*`, `nfl-390-store-*` and `soccer-390-store-*`
- `nba-390-odds-*`
- `nba-390-market-0`
- `nba-390-open-0-pack`, `nba-390-open-1-walk-*` and `nba-390-open-2-reveal`
- `nfl-390-buy-premium-*`
- `nba-390-firsttip-*` and `nba-390-honors-*`
- `nba-390-standouts-*`
- `soccer-390-sbc-*`

Data: `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/out/`.
