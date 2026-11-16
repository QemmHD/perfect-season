# Team packs: team doc

Team **packs** (pack economy, odds, promos, pack opening, the Store and SBC screens). Branch `claude/studio-packs`, worktree `/home/user/ps-s-packs`. Plan: `docs/studio-overhaul/packs-plan.md` (revision 3, Game Design V2). `O` means the overhaul scratch folder named in BUILD-RULES.md.

## Status

| Task | State | Commits |
|---|---|---|
| packs-1 A: baselines, contracts, critical fixes | done | see `git log` (subject "packs-1 commit A") |
| packs-1 B: the Scout Stamp core and V2 hand-off contracts | done | see `git log` (subject "packs-1 commit B") |
| packs-2: real-pack odds for every source, Player Pick 84+, Scout Drop tables | done | see `git log` (subject "packs-2") |
| packs-1 review fixes (SBC stamps, pick cap, confirm, auto-fill, unknown pack tile) | done | see `git log` (subject "packs-1 review fixes") |
| packs-3: prices, limits and exploits | done | see `git log` (subject "packs-3") |
| packs-2 review fixes (protection never lowers a published chance; acceptance wording; holo doc) | done | see `git log` (subject "packs-2 review fixes") |
| packs-4: odds engine and disclosure (sheets everywhere, BuyConfirm, picks, rewards, Scout Drops, tracker, RARE) | done | see `git log` (subject "packs-4") |
| packs-3 review fixes (the plan's Club Collection floor, Club Collection limits shown, Scout's Choice by route cost, snapshot kind, flash pick price, NFL Silver Upgrade, first-paint split) | done | see `git log` (subject "packs-3 review fixes") |
| packs-5 … packs-10 | not started | |

## packs-1 commit A: baselines, contracts and the critical fixes

### What changed and why

- **Quick-sell is one chain (audit C1).** `quickSellValue` used two separate `if` chains, so the second one overwrote GOAT and Spotlight with the bronze line: a 104 Spotlight sold for 30 coins (NFL 10) and SBC auto-fill spent it first. It is now one `if / else if` chain with the D2 numbers (GOAT 6,000 + 500 per point over 106; Spotlight 4,000 + 150 per point over 100; Legend, Landmark, Program and Hot Season unchanged), times the sport's `qs` factor. `quickSell(tier, ovr, sport)` is exported for reward values, and `TIER_ORDER` (the canonical `TIER_RANK` order) for the test.
- **Standout quick-sell moved under Hot Season.** The old Standout line (400 + 40 a point from the Hot Season knot − 14) sold a 93 Standout above a 97 Hot Season, and in soccer every Standout above every Hot Season. It is now 400 + 20 a point over 80. This is the third deliberate quick-sell change (the fixture test allows exactly Spotlight, GOAT and Standout).
- **Auto-fill never trades a protected card.** `autoFill` skips special editions (anything above gold, and the Finale), numbered copies (`mint`), locked favourites and any card that quick-sells for more than the reward is worth (`rewardValue`: packs at Store price, an unsold kind at a Premium's, cards at the least they can be). A card can still be put in by hand. When only protected cards would complete a challenge, the toast says so ("Auto-fill never trades special, numbered or high-value cards. Put those in by hand."). The position matching also seats one copy per player now, so two seasons of one man can no longer fill two spots and leave a third empty.
- **The trade-in confirm warns (research §8.8).** It always says the cards are removed permanently. A red row names each special, numbered, 90+ or worth-more-than-the-reward card with the reason, and then the button reads TRADE IN ANYWAY (styled danger). New CSS lives in `src/ut/sbc-page.css`.
- **Soccer SBCs ask for soccer positions (audit H4).** The five two-way `nba(c) ? … : …` templates fell to football in soccer ("Pass Catchers: WR WR TE", "Skill Set"). They are `pickFor(sport, { nba, nfl, soccer })` now, with soccer versions Kickabout, Front Three (W ST W), Back Four (FB CB CB FB), Midfield Engine (DM CM AM) and Gold Spine (GK CB DM ST). The template lists keep their length and order, so NBA and NFL get byte-identical SBCs (the 60-day catalogue equals the fixture). The `nba` helper is gone.
- **The sport-branch guard catches the helper pattern.** `src/engine/sport-branches.test.ts` adds `/\b(?:nba|nfl|isNba|isNfl)\([^)]*\)\s*\?(?![?.])/` (`??` and `?.` are not ternaries) with a self-test, and the full scan is clean.
- **D9: a pack this build can't open stays pending.** `openPack` used to return no cards for an unknown kind (or an unknown position choice), and the pending entry was spent. It now throws `UNKNOWN_PACK` ("Update the game to open this pack. It stays in your Store until then."), and `openNow` in `UltimateTeam.tsx` shows that toast and returns before its state update.
- **Reward picks for ut (`awardPick`).** `'front-office'` (1 of 5 golds 80+), `'pick-82'` (1 of 3 golds 82+) and `'program-pick'` (1 of 3 released cards of the newest live program, or a `pick-82` when none is live, always in soccer), exactly once per id through the existing pick sheets. **[V2]** `'pick-84'` is in the kind union and throws `PICK_84_NOT_YET` until packs-2 lands its gold curve, so no caller can hand out a uniform 84+ pick.
- **The promo hub contract (`src/ut/promo-hub.ts`).** Working today: `upcomingDrops`, `storeBadge` (its Daily Drop reason), `programRewardCard`, `resolvedEditions`. Returning their empty answer until packs-7: `liveNow`, `launchDue`, `markLaunchSeen`, `seasonPassCard`. **[V2]** `LiveDrop.kind` gains `'event'` and `cta.view` gains `'events'` (Era Nights); `eraNights` and `calendarClaimables` are exported and return `[]`.
- **`src/ut/stamps.ts` is `src/ut/scout-stamps.ts`**, because ut-1 creates its own `stamps.ts` (enrolment stamps).
- **The "before" fixture set and harness.** `src/ut/__fixtures__/packs-before/{nba,nfl,soccer}.json` (344 KB in all) were taken on the untouched base before any code moved: the ratings of every Hot Season, Legend, Spotlight, GOAT, Landmark, started Standout week and frozen program edition at levels 1–5 (NBA 1,418 rows, NFL 2,373, soccer 475), the 60-day SBC catalogue, 20 registered-receipt seeds, the 11 started Live Calendar entries, the numbered catalogs and `FOREIGN_FINGERPRINT` (`5r:wt1t2o1jaeybo`, a hash of the rating modules other teams own). `src/ut/__fixtures__/legacy-content-state.ts` is a frozen copy of today's `normalizeContent` (the "older build"). `scripts/packs/` holds `snapshot.ts` (`--check`), `packsim.ts`, `promos.ts`, `promoattrs.ts` (`--feasibility`), `autofill.ts`, `ovr-diff.ts` and `out.ts`. `scripts/build_numbered_catalog.ts -- --check` compares the generated catalogs with the committed ones and writes nothing.

### Before: measured on the untouched base (`O/packs-out/before/`)

Every number below comes from `PACKSIM_LABEL=before` runs of `scripts/packs/*.ts` on `claude/studio-overhaul` = `acdf3e2`, before any packs code changed. EV / price is the quick-sell value of the contents over the price. The gold columns are the share of all gold cards pulled (rare golds included) by displayed overall.

#### NBA (10,000 seeded packs per type, week 2026-W46)

| Pack | Price | EV / price | Golds 75–79 / 80–82 / 83–85 / 86+ (%) | P(≥1 special) % | P(≥1 86+) % | Mean best OVR |
|---|---|---|---|---|---|---|
| Bronze Pack | 250 | 0.54 | — | 0.0 | 0.0 | 64.03 |
| Silver Pack | 400 | 0.60 | 94.3 / 4.9 / 0.7 / 0.1 | 0.0 | 0.0 | 71.25 |
| Gold Pack | 900 | 0.56 | 65.2 / 28.7 / 5.4 / 0.6 | 2.1 | 2.9 | 81.28 |
| Premium Gold | 1,800 | 0.55 | 51.2 / 40.5 / 7.3 / 1.0 | 6.6 | 8.8 | 82.81 |
| Daily Drop | 0 | — | 93.1 / 5.8 / 1.1 / 0.1 | 2.1 | 0.5 | 71.51 |
| Elite Gold | 2,200 | 0.49 | 10.1 / 74.4 / 13.7 / 1.8 | 10.6 | 12.9 | 83.49 |
| Jumbo Premium | 3,600 | 0.56 | 44.3 / 46.0 / 8.6 / 1.1 | 7.1 | 15.2 | 83.9 |
| Standout Guarantee | 3,000 | 0.50 | 57.6 / 35.2 / 6.5 / 0.8 | 100.0 | 26.8 | 84.46 |
| Lightning Standout | 2,250 | 0.67 | 57.5 / 35.5 / 6.2 / 0.8 | 100.0 | 27.4 | 84.5 |
| Roster Builder | 1,500 | 0.54 | 72.3 / 23.1 / 4.1 / 0.5 | 0.0 | 2.1 | 81.19 |
| Captains Pack | 2,400 | 0.51 | 59.8 / 33.4 / 6.0 / 0.7 | 100.0 | 25.9 | 84.33 |
| Dynasty Pack | 4,400 | 0.53 | 56.2 / 36.2 / 6.8 / 0.8 | 100.0 | 47.3 | 86.17 |
| Position Pack PG | 700 | 0.57 | 62.4 / 29.4 / 7.6 / 0.6 | 0.0 | 1.7 | 81.56 |
| Position Pack SG | 700 | 0.54 | 79.7 / 17.1 / 2.9 / 0.3 | 0.0 | 0.9 | 80.17 |
| Position Pack SF | 700 | 0.57 | 60.8 / 33.2 / 5.6 / 0.5 | 0.0 | 1.4 | 81.27 |
| Position Pack PF | 700 | 0.56 | 61.4 / 34.5 / 3.5 / 0.6 | 0.0 | 1.9 | 81.12 |
| Position Pack C | 700 | 0.57 | 62.9 / 29.1 / 6.8 / 1.2 | 0.0 | 3.7 | 81.5 |
| Starter | 0 | — | 93.0 / 5.8 / 1.0 / 0.1 | 0.0 | 0.1 | 76.34 |
| Spotlight Pack | 3,500 | 0.31 | 93.0 / 5.9 / 1.0 / 0.1 | 50.1 | 50.6 | 88.39 |
| First Tip Pack | 3,000 | 0.53 | 57.5 / 35.2 / 6.6 / 0.8 | 100.0 | 31.2 | 84.82 |
| First Tip Guarantee | 3,200 | 0.51 | 10.2 / 74.6 / 13.4 / 1.8 | 100.0 | 42.7 | 85.66 |
| Cup Crown Pack | 3,000 | 0.53 | 57.5 / 35.2 / 6.5 / 0.8 | 100.0 | 48.7 | 85.26 |
| Cup Crown Guarantee | 3,200 | 0.54 | 10.0 / 74.2 / 14.1 / 1.7 | 100.0 | 100.0 | 87.02 |
| Hot Season Pack | 3,600 | 0.43 | 57.5 / 35.2 / 6.5 / 0.8 | 100.0 | 32.1 | 85.22 |
| Perfect Pairs Pack | 3,000 | 0.55 | 57.4 / 35.1 / 6.7 / 0.8 | 100.0 | 49.0 | 85.93 |
| Perfect Pairs Guarantee | 3,200 | 0.58 | 10.1 / 74.2 / 14.1 / 1.6 | 100.0 | 100.0 | 89.17 |
| Next Up Pack | 3,000 | 0.54 | 57.6 / 35.2 / 6.5 / 0.8 | 100.0 | 48.2 | 85.37 |
| Next Up Guarantee | 3,200 | 0.55 | 10.1 / 74.3 / 13.8 / 1.8 | 100.0 | 100.0 | 87.44 |
| Desert All-Stars Pack | 3,300 | 0.50 | 57.6 / 35.2 / 6.4 / 0.8 | 100.0 | 48.9 | 86.2 |
| Desert All-Stars Guarantee | 3,200 | 0.60 | 10.0 / 74.4 / 13.9 / 1.7 | 100.0 | 100.0 | 90.17 |
| Underdog Run Pack | 3,000 | 0.53 | 57.4 / 35.3 / 6.4 / 0.9 | 100.0 | 49.4 | 85.24 |
| Underdog Run Guarantee | 3,200 | 0.54 | 10.2 / 74.1 / 13.9 / 1.8 | 100.0 | 100.0 | 86.95 |
| Postseason Primetime Pack | 3,600 | 0.45 | 57.5 / 35.3 / 6.5 / 0.8 | 100.0 | 45.1 | 85.87 |
| Postseason Primetime Guarantee | 3,800 | 0.50 | 10.0 / 74.5 / 13.8 / 1.7 | 100.0 | 100.0 | 90.1 |
| Dream Teams Pack | 3,600 | 0.45 | 57.5 / 35.4 / 6.3 / 0.8 | 100.0 | 41.1 | 85.89 |
| Dream Teams Guarantee | 4,100 | 0.49 | 10.0 / 74.6 / 13.8 / 1.7 | 100.0 | 100.0 | 91.52 |
| Ring Night Pack | 4,200 | 0.37 | 57.6 / 35.2 / 6.4 / 0.8 | 100.0 | 32.8 | 85.33 |
| Ring Night Guarantee | 4,900 | 0.45 | 10.3 / 74.4 / 13.7 / 1.7 | 100.0 | 100.0 | 94.66 |
| Summer Run Pack | 3,000 | 0.54 | 57.3 / 35.6 / 6.4 / 0.7 | 100.0 | 48.7 | 85.74 |
| Summer Run Guarantee | 3,200 | 0.57 | 10.4 / 74.5 / 13.4 / 1.7 | 100.0 | 100.0 | 88.62 |
| Summer Heat Pack | 3,900 | 0.41 | 57.4 / 35.3 / 6.5 / 0.8 | 100.0 | 37.9 | 85.63 |
| Summer Heat Guarantee | 4,300 | 0.47 | 9.9 / 74.5 / 13.9 / 1.7 | 100.0 | 100.0 | 92 |
| Rivalry Week Pack | 3,300 | 0.51 | 57.7 / 35.0 / 6.5 / 0.8 | 100.0 | 47.8 | 86.66 |
| Rivalry Week Guarantee | 3,200 | 0.64 | 10.1 / 74.4 / 13.8 / 1.7 | 100.0 | 100.0 | 92 |

Quick-sell by tier, [min, median, max] at level 1: bronze [15, 25, 30]; silver [40, 60, 80]; gold [100, 125, 400]; promo [660, 700, 780]; spotlight [30, 30, 30]; legend [2500, 2650, 3250]; goat [30, 30, 30].

Auto-fill with the audit club (spotlight Michael Jordan 104 qs 30, goat Michael Jordan 109 qs 30): 8 SBCs on 2026-11-09 took a special; 220 SBC fills in 28 days took one.

#### NFL (10,000 seeded packs per type, week 2026-W46)

| Pack | Price | EV / price | Golds 75–79 / 80–82 / 83–85 / 86+ (%) | P(≥1 special) % | P(≥1 86+) % | Mean best OVR |
|---|---|---|---|---|---|---|
| Bronze Pack | 175 | 0.54 | — | 0.0 | 0.0 | 64.84 |
| Silver Pack | 320 | 0.50 | 96.9 / 2.9 / 0.2 / 0.0 | 0.0 | 0.0 | 72.5 |
| Gold Pack | 900 | 0.51 | 81.7 / 15.9 / 2.2 / 0.2 | 2.1 | 3.4 | 81.75 |
| Premium Gold | 1,400 | 0.50 | 64.5 / 30.5 / 4.6 / 0.4 | 6.6 | 9.1 | 83.2 |
| Daily Drop | 0 | — | 97.3 / 2.5 / 0.2 / 0.0 | 2.1 | 1.0 | 71.49 |
| Elite Gold | 1,500 | 0.48 | 21.7 / 67.2 / 10.2 / 0.9 | 11.0 | 14.8 | 83.85 |
| Jumbo Premium | 2,700 | 0.50 | 53.0 / 40.3 / 6.2 / 0.5 | 6.7 | 15.5 | 84.1 |
| Standout Guarantee | 1,800 | 0.50 | 66.8 / 28.5 / 4.3 / 0.4 | 100.0 | 50.6 | 85.7 |
| Lightning Standout | 1,350 | 0.67 | 66.8 / 28.6 / 4.3 / 0.3 | 100.0 | 51.1 | 85.74 |
| Roster Builder | 900 | 0.53 | 86.1 / 12.0 / 1.7 / 0.1 | 0.0 | 0.8 | 80.82 |
| Captains Pack | 1,000 | 0.55 | 78.0 / 18.9 / 3.0 / 0.2 | 100.0 | 49.0 | 85.42 |
| Dynasty Pack | 1,900 | 0.54 | 75.4 / 21.1 / 3.2 / 0.3 | 100.0 | 75.7 | 87.33 |
| Position Pack QB · RB · K | 500 | 0.52 | 73.3 / 23.5 / 2.9 / 0.2 | 0.0 | 1.4 | 81.15 |
| Position Pack Receivers | 500 | 0.56 | 64.5 / 28.4 / 6.7 / 0.4 | 0.0 | 2.3 | 82.26 |
| Position Pack Offensive Line | 500 | 0.54 | 69.9 / 25.2 / 4.4 / 0.5 | 0.0 | 2.8 | 81.93 |
| Position Pack Defensive Line | 500 | 0.55 | 63.4 / 33.7 / 2.7 / 0.2 | 0.0 | 0.9 | 81.58 |
| Position Pack Linebackers | 500 | 0.51 | 81.5 / 15.9 / 2.4 / 0.2 | 0.0 | 1.4 | 80.77 |
| Position Pack Secondary | 500 | 0.52 | 81.3 / 16.4 / 2.1 / 0.2 | 0.0 | 1.1 | 80.73 |
| Starter | 0 | — | 96.8 / 2.8 / 0.3 / 0.0 | 0.0 | 0.0 | 75.95 |
| Spotlight Pack | 3,500 | 0.19 | 96.7 / 3.0 / 0.3 / 0.0 | 49.6 | 49.8 | 88.41 |
| First Tip Pack | 1,800 | 0.51 | 66.8 / 28.6 / 4.3 / 0.3 | 100.0 | 47.6 | 85.58 |
| First Tip Guarantee | 1,900 | 0.48 | 21.9 / 67.1 / 10.1 / 0.9 | 100.0 | 44.7 | 85.46 |
| Snow Globe Pack | 1,800 | 0.52 | 66.7 / 28.6 / 4.3 / 0.4 | 100.0 | 65.4 | 86.4 |
| Snow Globe Guarantee | 1,900 | 0.51 | 22.0 / 66.8 / 10.3 / 0.8 | 100.0 | 100.0 | 87.96 |
| Hot Season Pack | 2,200 | 0.42 | 66.8 / 28.5 / 4.3 / 0.3 | 100.0 | 53.3 | 86.3 |
| Perfect Pairs Pack | 1,800 | 0.52 | 66.7 / 28.7 / 4.3 / 0.3 | 100.0 | 66.7 | 86.62 |
| Perfect Pairs Guarantee | 1,900 | 0.52 | 21.9 / 67.0 / 10.3 / 0.8 | 100.0 | 100.0 | 88.5 |
| Next Up Pack | 1,800 | 0.51 | 66.8 / 28.6 / 4.2 / 0.3 | 100.0 | 65.3 | 85.95 |
| Next Up Guarantee | 1,900 | 0.49 | 21.8 / 67.1 / 10.2 / 0.8 | 100.0 | 100.0 | 86.51 |
| Franchise Tag Pack | 2,000 | 0.47 | 66.8 / 28.6 / 4.2 / 0.4 | 100.0 | 65.6 | 87.09 |
| Franchise Tag Guarantee | 1,900 | 0.54 | 22.0 / 66.9 / 10.2 / 0.8 | 100.0 | 100.0 | 90.24 |
| Day One Starters Pack | 1,800 | 0.52 | 66.8 / 28.6 / 4.3 / 0.3 | 100.0 | 65.8 | 86.32 |
| Day One Starters Guarantee | 1,900 | 0.51 | 22.0 / 66.9 / 10.2 / 0.9 | 100.0 | 100.0 | 87.73 |
| Postseason Primetime Pack | 2,200 | 0.43 | 66.9 / 28.5 / 4.3 / 0.3 | 100.0 | 62.9 | 87.09 |
| Postseason Primetime Guarantee | 2,200 | 0.47 | 22.0 / 67.0 / 10.2 / 0.8 | 100.0 | 100.0 | 91.33 |
| Dream Teams Pack | 2,200 | 0.42 | 66.7 / 28.7 / 4.2 / 0.3 | 100.0 | 60.9 | 86.77 |
| Dream Teams Guarantee | 2,300 | 0.45 | 21.8 / 67.2 / 10.3 / 0.8 | 100.0 | 100.0 | 90.81 |
| Ring Night Pack | 2,500 | 0.37 | 66.9 / 28.6 / 4.2 / 0.4 | 100.0 | 54.9 | 86.46 |
| Ring Night Guarantee | 2,800 | 0.40 | 22.0 / 67.0 / 10.1 / 0.8 | 100.0 | 100.0 | 94.63 |
| Rookie Camp Pack | 1,800 | 0.52 | 66.7 / 28.7 / 4.3 / 0.3 | 100.0 | 64.8 | 86.43 |
| Rookie Camp Guarantee | 1,900 | 0.51 | 22.0 / 67.0 / 10.1 / 0.8 | 100.0 | 100.0 | 88.14 |
| Summer Heat Pack | 2,300 | 0.40 | 66.8 / 28.6 / 4.3 / 0.3 | 100.0 | 58.5 | 86.68 |
| Summer Heat Guarantee | 2,500 | 0.42 | 21.9 / 67.1 / 10.1 / 0.9 | 100.0 | 100.0 | 92.1 |
| Rivalry Week Pack | 2,000 | 0.48 | 66.9 / 28.5 / 4.3 / 0.4 | 100.0 | 65.3 | 87.6 |
| Rivalry Week Guarantee | 1,900 | 0.56 | 21.9 / 67.1 / 10.2 / 0.9 | 100.0 | 100.0 | 92 |

Quick-sell by tier, [min, median, max] at level 1: bronze [5, 10, 10]; silver [15, 20, 30]; gold [35, 45, 140]; promo [230, 245, 275]; spotlight [10, 10, 10]; legend [875, 980, 1190]; goat [10, 10, 10].

Auto-fill with the audit club (spotlight Peyton Manning 104 qs 10, goat Peyton Manning 109 qs 10): 7 SBCs on 2026-11-09 took a special; 211 SBC fills in 28 days took one.

#### Soccer (10,000 seeded packs per type, week 2026-W46)

| Pack | Price | EV / price | Golds 75–79 / 80–82 / 83–85 / 86+ (%) | P(≥1 special) % | P(≥1 86+) % | Mean best OVR |
|---|---|---|---|---|---|---|
| Bronze Pack | 220 | 0.58 | — | 0.0 | 0.0 | 64.86 |
| Silver Pack | 380 | 0.58 | 93.0 / 5.9 / 1.0 / 0.2 | 0.0 | 0.0 | 71.74 |
| Gold Pack | 900 | 0.46 | 72.8 / 22.2 / 4.3 / 0.7 | 2.5 | 4.2 | 81.43 |
| Premium Gold | 1,600 | 0.51 | 52.3 / 38.8 / 7.7 / 1.2 | 6.6 | 12.9 | 83.29 |
| Daily Drop | 0 | — | 92.8 / 5.8 / 1.1 / 0.2 | 1.9 | 0.9 | 72 |
| Elite Gold | 1,900 | 0.46 | 12.1 / 71.3 / 14.3 / 2.4 | 11.2 | 21.9 | 84.19 |
| Jumbo Premium | 3,200 | 0.51 | 47.4 / 42.7 / 8.6 / 1.4 | 6.6 | 22.9 | 84.34 |
| Standout Guarantee | 2,600 | 0.63 | 60.9 / 31.7 / 6.4 / 1.0 | 100.0 | 52.2 | 85.74 |
| Lightning Standout | 1,950 | 0.84 | 60.8 / 31.9 / 6.3 / 1.0 | 100.0 | 50.7 | 85.67 |
| Roster Builder | 1,000 | 0.54 | 72.8 / 22.2 / 4.3 / 0.7 | 0.0 | 2.7 | 81.31 |
| Captains Pack | 2,300 | 0.53 | 60.7 / 32.0 / 6.3 / 1.1 | 100.0 | 48.1 | 85.28 |
| Dynasty Pack | 4,300 | 0.55 | 57.1 / 34.9 / 6.9 / 1.2 | 100.0 | 76.1 | 87.43 |
| Position Pack Goalkeepers | 650 | 0.49 | 74.5 / 21.1 / 3.8 / 0.6 | 0.0 | 2.5 | 81.22 |
| Position Pack Defenders | 650 | 0.49 | 73.6 / 22.4 / 3.6 / 0.4 | 0.0 | 1.7 | 81.09 |
| Position Pack Midfielders | 650 | 0.50 | 71.2 / 22.2 / 5.6 / 0.9 | 0.0 | 3.7 | 81.71 |
| Position Pack Attackers | 650 | 0.50 | 72.4 / 21.4 / 5.2 / 1.0 | 0.0 | 3.9 | 81.49 |
| Starter | 0 | — | 93.6 / 5.2 / 1.0 / 0.2 | 0.0 | 0.2 | 76.51 |

Quick-sell by tier, [min, median, max] at level 1: bronze [10, 20, 20]; silver [30, 45, 55]; gold [70, 80, 205]; promo [350, 685, 940]; legend [1750, 1750, 2590].

Auto-fill with the audit club (soccer has no Spotlight or GOAT): 0 SBCs on 2026-11-09 took a special; 0 SBC fills in 28 days took one.

#### Ratings (`ovr-diff.ts` against the fixture, on the base)

NBA 1,418, NFL 2,373 and soccer 475 edition rows compared: 0 changed, 0 cross 90. The special-edition uplift on the base (NBA): Hot Season 518 cards, mean +11.3 over the base season (94–97 shown); Legends 120, +6.5 (88–94); Spotlight 120, +17.0 (100–105); GOAT 20, +20.9 (106–110). `promoattrs.ts` (NBA): 260 of 518 Hot Season cards show a face attribute more than 1 above the attribute the match plays; 35 have a raw (played) overall under 85 while showing 94+.

### After commit A

| Measure | Before | After |
|---|---|---|
| Auto-fill with the audit club (unplayed Spotlight MJ 104 and GOAT MJ 109, numbered) | NBA 8 SBCs on 2026-11-09 and 220 fills in 28 days took a special; NFL 7 and 211 | 0 and 0 (`autofill.ts`, `PACKSIM_LABEL=after-packs-1`) |
| Quick-sell Spotlight / GOAT, NBA | 30 / 30 | 4,000–5,050 / 6,000–9,000 (NFL × 0.35, soccer has neither) |
| Quick-sell strictly rising between tier ranks (min, median, max; levels 1 and 5) | fails (Spotlight and GOAT below bronze; soccer Standouts above Hot Season) | holds in all three sports |
| Soccer SBCs naming a football position (60 days) | Pass Catchers, Skill Set, No Fly Zone, Gold Front Seven | none; only GK CB FB DM CM AM W ST |
| A pending pack of an unknown kind | opened as nothing, pending entry spent | stays pending; the Store shows "Update the game to open this pack" |

### D9 outcome (the reward-pack safety net)

Tested on this code (`packs-economy` suite, "D9"): a save holding a pending `headliners` pack (a kind this build doesn't know) survives the profile load, today's and the frozen older normalizer, `captureProgress` → `checkedSnapshot` → `applyProgress` and `validateSaveValues`, and the pending entry is unchanged after the round trip. Opening it throws `UNKNOWN_PACK` and leaves it pending. On the base (`acdf3e2`) the same open returned no cards and the pending entry was spent. **Ruling:** reward packs a newer build sends to an older one are safe from this build on, but not on clients older than this release. V2 cut Headliners (no new buyable kinds), and every V2 reward pack (MINUTES, league, milestones) uses an existing kind (`silver`, `gold`, `premium`), so no award needs a fallback. The safety net stays for whatever comes next.

### The V2.4 interface contract (copied from packs-plan.md §V2.4)

Other teams may code against these signatures today. Stubs that return safe empties exist from packs-1 (commit A or B, as marked); bodies land in the task named. A signature only ever gains optional fields or new union members; anything else is announced in `packs.md` first.

**A. `src/ut/scout-stamps.ts` (packs-1 B; light: imports only `content-state` and `pull-log-state` types, never `pool`, `packs`, `cards`, `sbc`, `rate`, `squad`, `content-packs`, `daily-hub`, `moments` or `inbox`, so ut's claimables import-graph test passes).** Renamed from `stamps.ts`, because ut-1 creates its own `src/ut/stamps.ts` (enrolment stamps), and two new files at one path would collide at merge.
```ts
export const STAMP_SHELF: readonly { item: 'g82' | 'scout85' | 'standouts' | 'program'; cost: 50 | 120 | 300 | 600 }[];
export const STAMP_GRANT: { minutes30: 5; drop: 3 };   // D13: one "Scout Stamp" reward = this many stamps
export function stampsBalance(ut): number;              // never below 0; D7 floors included
export function stampsToNext(ut): { have: number; need: number; item: string } | null;  // "12 stamps to your 82+ pick"
export function grantStamps(ut, n: number, source: 'minutes' | 'drop' | 'rookie' | 'other', id: string): UtState;
//   exactly once per (source, id): claim 'stamps-grant:<n>:<source>:<id>' (pinned, D7); n is an integer 1..50;
//   granted in the sport the player is in when they claim (stamps are per sport, like packs)
```
**B. `src/ut/stamp-shelf.ts` (packs-1 B logic; packs-6 page).** `redeemStamps(ut, pool, item, uuid, day, at): UtState | null` (exactly once under `stamps:<item>:<cost>:<uuid>`; null when short). The `stamps` view (reserved by ut in `nav.ts`) renders `StampShelf` from packs-6.

**C. `src/ut/packs-claimables.ts` body (packs-1 B; ut owns the file's existence and shape).** `packsClaimables(ut, day, sport): { n: number; ids: string[]; lines: string[] }`. This round: one line when `stampsBalance ≥ 50` ("Scout Stamps: a pick is ready"). It never counts the Daily Drop (ut re-implements it). The check-in lines are F2, so they are not in it.

**D. `src/ut/content-packs.ts` picks (packs-1 A; curve in packs-2).** `awardPick(ut, pool, kind, id, at): UtState` (since the review fixes `UtState | null`: null when the 50 open picks are full or nothing can be offered; write no claim then), with `kind: 'front-office' | 'pick-82' | 'pick-84' | 'program-pick'`. **[V2]** `'pick-84'` = 1 of 3 different golds, 84+, on the G84 curve, with no special: the 25-hour MINUTES milestone and the Rookie Week day-7 pick. Exactly once per `id` (the caller's claim id, for example `minutes:life:25h`). The pick sheet opens through the existing pending-pick path.

**E. `src/ut/drop-tables.ts` (packs-2; pure, light, no pool).**
```ts
export type DropTier = 'common' | 'rare' | 'epic' | 'legendary';
export interface DropReward { coins?: number; xp?: number; stamps?: number; pack?: 'silver' | 'gold' | 'premium' | 'jumbo' }
export function dropTable(sport, index: 1 | 2 | 3): { start: DropTier; up: Record<DropTier, number>; taps: 3; rewards: Record<DropTier, DropReward> };
export function dropOdds(sport, index): Record<DropTier, number>;          // exact final-tier odds, shown before the first tap
export function rollDrop(seed: string, sport, index): { tier: DropTier; path: DropTier[]; reward: DropReward };  // deterministic per seed
```
- **Drop 1** is ut's planned Scout Reveal, data moved here unchanged so there is one source: Silver Pack + 100 coins, upgrading Silver → Gold 35%, → Premium 25%, → Jumbo 15%. ut keeps its claim `daily-bonus:<day>`, pack id and seed. It shows final odds Silver 65.0%, Gold 26.25%, Premium 7.44%, Jumbo 1.31%.
- **Drops 2 and 3** (D14): start Common; per-tap upgrade Common 20%, Rare 25%, Epic 30% (V2 D.12). Rewards: Common 25 coins, Rare 45 coins, Epic 60 coins + 3 stamps, Legendary a Silver Pack. Final odds: Common 51.2%, Rare 36.05%, Epic 11.25%, Legendary 1.5%. Expected value ≈ 42 coin-equivalents (V2 targets about 40). `xp` is reserved for ut's Career XP outcome, if ut wants one; packs values it at 0.
- ut owns the drop UI, the "first 3 wins a day" rule, the claims and the seed (`'scout-drop:' + playerKey + ':' + sport + ':' + day + ':' + index`). Stamps from a drop go through `grantStamps(ut, n, 'drop', '<day>:<index>')`.

**F. `src/ut/promo-hub.ts` (packs-1 A stubs; bodies in packs-7).** As §5 packs-1 item 3, with two **[V2]** additions:
- `LiveDrop.kind` gains `'event'`, and `LiveDrop.cta.view` gains `'events'`, for Era Nights (`id: 'era:<isoWeek>'`, `cta: { view: 'events', arg: 'era:<isoWeek>' }`).
- `eraNights(sport, at, weeks = 4): EraNight[]`, with `EraNight = { id; title; era: string; squads: string[]; start; end }`: Friday 18:00 ET to Sunday 23:59 ET, a rotation published 4 weeks ahead, the squads as team-season ids that exist in the pool. ut hosts the matches (Events), solo only, no rule change, so no protocol.
- `calendarClaimables(...)` is exported as a stub returning `[]` (the check-in work is F2), so ut's import compiles.
- There is **no** `PROGRAM_KEY` export this round (the Program Bag is not planned), so ut's Circuit and chest add no keys.
- `storeBadge(pool, ut, at).n` is what ut adds to `setAppBadge` for the Store.

**G. `src/ut/odds.ts` (packs-4).** `oddsTable`, `pickTable(pool, kind)` (now including `'pick-84'`), `rewardOdds(pool, reward)` for ut's random objective and MINUTES rewards, `dropSheet(sport, index)` for the Scout Drop sheet, and `fmtPct`. ut shows the sheet with `<OddsSheet … />` (lazy) before any random reward opens.

**H. To players (packs-9).** Walkout slots per D15. The cinema level comes from `cinemaLevel(cards)`, and `walkoutLevel(rc)` is exported so players' figure can scale. We pass `{ rc, size, maxMs: 2000, onDone, reduced }` and never put text in the figure.

**I. To the sport teams (packs-5).** The per-sport, per-position played-attribute delta table for Hot Season, Legend, Spotlight and GOAT. Protocol lines are in §8.

**J. Near-miss feeds for `nextBestAction()` (ut).** These are true, deterministic distances only (V2 D.10): `stampsToNext(ut)`, `nearlyDone(sbc, club)` from `sbc.ts` (packs-8; "1 card away"), and `liveNow(...).isNew` for "new program wave".

### Contracts as shipped in commit A

`src/ut/promo-hub.ts` (light enough for ut's Hub; it reads the calendar, the pool and `scout-stamps.ts`):

```ts
export interface LiveDrop {
  id: string;   // 'drop:<promoId>:w<i>' | 'standouts:<week>' | 'flash:<window>' | 'era:<isoWeek>'
  kind: 'program' | 'wave' | 'standouts' | 'landmark' | 'flash' | 'event';
  title: string; subtitle?: string; accent: [string, string];
  start: number; end: number; band?: [number, number];
  heroCardId?: string;  // the released headliner, never an unreleased card
  isNew: boolean;       // first 48 h
  boosted?: { until: number };
  cta: { view: 'program' | 'store' | 'standouts' | 'sbc' | 'events'; arg?: string };
}
liveNow(pool, ut, at): LiveDrop[]                                  // [] until packs-7
upcomingDrops(sport, at, n = 3): { id; title; start; band }[]      // works; [] in soccer (no calendar yet)
launchDue(pool, ut, at): LiveDrop | null                           // null until packs-7
markLaunchSeen(ut, id): UtState                                    // no-op until packs-7
storeBadge(pool, ut, at): { n; reasons: ('wave' | 'daily' | 'stamps')[] }   // works (daily, stamps)
programRewardCard(pool, promoId, 'objective', seed, day?): RatedCard | null // works (released cards only)
seasonPassCard(pool, day, 'A' | 'B' | 'headliner'): RatedCard | null        // null until packs-7
resolvedEditions(pool, kinds): { id; kind; label; ovr }[]                   // works, best first
eraNights(sport, at, weeks = 4): EraNight[]                        // [] until packs-7
calendarClaimables(ut, day, sport): { id; line }[]                 // [] (check-in days are deferred F2)
```

`src/ut/content-packs.ts`: `awardPick(ut, pool, kind, id, at)` with `kind: 'front-office' | 'pick-82' | 'pick-84' | 'program-pick'` (pick-84 throws `PICK_84_NOT_YET` until packs-2). `src/ut/sbc.ts`: `rewardValue(reward, sport)`, `protectedReason(card, worth)`, `tradeWarning(rc, mint, worth)`, `autoFill(s, club, { guard })`. `src/ut/packs.ts`: `quickSell(tier, ovr, sport)`, `TIER_ORDER`, `UNKNOWN_PACK`.

## packs-1 commit B: the Scout Stamp core and the V2 hand-off contracts

This is the first-impression dependency: ut's local MINUTES ladder pays "75 coins + a Scout Stamp" at the 30-minute rung (V2 F.4 item 8), so the real balance and the grant API ship before anything else.

### What changed

- **`src/ut/scout-stamps.ts` (light: no runtime imports at all, types only).**
  - `ut.content.stamps = { earned, spent }`, optional and additive, in `ContentState` and `normalizeContent`.
  - **Earning** (in `recordPull`, the same update that deposits a pack): 1 stamp per 100 coins of the price paid; an earned (free) pack at its Store price (`NOMINAL_PRICE`, pinned to `packDefs` by a test), so a MINUTES Silver is 4 stamps in NBA and 3 in NFL and soccer; +10 for each special edition the player already had (in the club, or pulled by an earlier logged pack). The Daily Drop and daily bonuses (Scout Drop 1), Scout Drop packs (ids `scout-drop:`), every pick (including the shelf's own), the starter and `admin-*` awards earn 0. Kinds without a Store price (Spotlight and event rewards, Live Calendar program packs, Club Collection packs) earn only for coins actually paid. Earning starts at `STAMPS_FROM` = midnight Eastern on 2026-11-27 (the planned release), with no back-pay.
  - **Grants** (`grantStamps(ut, n, source, id)`, D13): exactly once per (source, id) through the claim `stamps-grant:<n>:<source>:<id>`; a repeat returns the same state object; `n` must be an integer 1–50 or it throws. `STAMP_GRANT = { minutes30: 5, drop: 3 }`. Stamps are per sport, like packs: the grant goes to the `ut` passed in.
  - **Balance** (`stampsBalance`): `max(earned, earnedFloor) − max(spent, spentFloor)`, never below 0. `earnedFloor` = the stamps of the Pack Tracker's recent packs since `STAMPS_FROM` (a special counts as a duplicate when an earlier logged pack holds its card) + Σ n over `stamps-grant:` claims. `spentFloor` = Σ cost over `stamps:<item>:<cost>:<uuid>` claims. Every write builds on the floors, and `normalizeContent` keeps the field at or above them.
  - **Pinned claims.** `withClaim` (content-state.ts) and the normalizer keep `stamps:` and `stamps-grant:` claims at the end of `claims`, so the 5,000 cap (this build's or an older one's `slice(-5000)`) drops other claims first.
  - `stampsToNext(ut)` → `{ have, need, item }` for the next shelf item not yet affordable ("12 to your 82+ Player Pick"), null when all are in reach. `STAMP_SHELF` (50 / 120 / 300 / 600 with labels).
- **`src/ut/stamp-shelf.ts`:** `redeemStamps(ut, pool, item, uuid, day, at)`. The 50-stamp 82+ Player Pick is open now (`awardPick('pick-82')`, pick id `stamps:g82:<uuid>`, claim `stamps:g82:50:<uuid>`); the 120, 300 and 600 rungs return null until packs-2 (the G85 curve) and packs-6 (the shelf page) open them (`shelfOpen`). A uuid already redeemed returns the same state; a short balance returns null. No UI yet (packs-6).
- **`src/ut/packs-claimables.ts` body** (ut's published shape): `packsClaimables(ut, day, sport) → { n, ids, lines }`, one line "Scout Stamps: a pick is ready" (id `stamp-shelf:ready`) once the balance reaches 50. It imports only `scout-stamps.ts`.
- `promo-hub.ts` `storeBadge` now lights its `stamps` reason from the real balance.

**Against the published V2.4 A–C signatures:** `STAMP_SHELF` entries gain a `label` ("82+ Player Pick"), which `stampsToNext` returns as `item`; `grantStamps` is generic (`<T extends { content? }>(ut: T, …) => T`), so it accepts and returns ut's `UtState` unchanged in type; `STAMP_SHELF_MIN` (50) stays exported for `storeBadge`. Everything else is exactly as published.

### Saved state and older builds

| Field | Shape | If an older build strips it |
|---|---|---|
| `ut.content.stamps` | `{ earned, spent }` | rebuilt from the floors on the next load: granted and spent stamps exactly, pack stamps from the newest 300 packs since release |

Loss bound (tested with 400 packs since release, eight 30-minute grants and a redemption): after a legacy-normalizer strip, the balance is the truth minus exactly the stamps of the 100 packs that left the recent list; grants and the spend are recovered exactly; it never exceeds the truth. One more case can lose a little: a duplicate special whose earlier copy has itself left the recent list loses its +10 in the floor. No storage key, id, claim id or existing field meaning changed. An old save without stamps normalizes exactly as the frozen older normalizer does.

### Numbers

| Measure | Result |
|---|---|
| `stampsBalance`, a full log (300 packs, 1,500 cards) + 4,060 claims, cold (no memo hit) | NBA 0.105, NFL 0.184, soccer 0.122 ms per call (budget 1 ms) |
| A 30-minute grant | 5 stamps, once per (source, id) |
| A MINUTES Silver (NBA / NFL / soccer) | 4 / 3 / 3 stamps |
| A bought Gold (NBA) | 9 stamps |
| Import walk from `scout-stamps.ts` and `packs-claimables.ts` | reaches only those two files (none of pool, packs, cards, sbc, rate, squad, content-packs, daily-hub, moments, inbox) |

### Tests (suite `stamps`: `stamps.test.ts` NBA/NFL, `soccer-stamps.test.ts` soccer)

Earning once per opening (a replayed id and a deposited pack earn 0); a MINUTES Silver earns its Store price; 0 for the Daily Drop, daily bonuses, picks, the shelf's pick, the starter, Scout Drop packs and admin awards; +10 only for a special already had; nothing before `STAMPS_FROM`; `NOMINAL_PRICE` equals `packDefs`. Grants once per (source, id), in order, pinned; n = 0, 51, 2.5, −1, NaN throw. `stampsToNext` and `packsClaimables`. Redemption: cost spent, exactly one pick pending, a repeat uuid a no-op, short → null, unopened rungs → null. Older builds: the strip bound above; 6,000 later claims and an older build's `slice(-5000)` keep every stamp claim, and the normalizer re-pins them; the cloud snapshot, `checkedSnapshot`, `applyProgress` and `validateSaveValues` keep the field; an old save loads exactly as before. The import walk; the 1 ms budget.

### Requests for this commit (ut and players)

- **ut:** at the 30-minute MINUTES rung call `grantStamps(ut, STAMP_GRANT.minutes30, 'minutes', 'day:' + day + ':30')` in the update that pays the rung. Scout Drops: `grantStamps(ut, STAMP_GRANT.drop, 'drop', day + ':' + index)` for a stamp outcome, and pending pack ids starting `scout-drop:` for a pack outcome. Rookie Week: `grantStamps(ut, n, 'rookie', 'day<k>')`. Read the badge from `packsClaimables` (and `storeBadge`), the near-miss line from `stampsToNext`. Keep your `packs-claimables.ts` shape; this body drops in.
- **players:** confirm the D15 walkout slot props (see Requests above).

### Protocol

None. Stamps are economy only; no match reads them.

## packs-2: real-pack odds for every source, Player Pick 84+ and the Scout Drop tables

### What changed and why

- **One per-overall gold curve (research §8.1, owner decision 4).** Every gold any source hands out is drawn by overall first: `GOLD_CURVE` (75 4.56, 76 5.02, 77 6.71, 78 13.46, 79 15.29, 80 17.67, 81 16.22, 82 15.28, 83 3.40, 84 1.38, 85 0.43, 86 0.22, 87 0.16, 88 0.15, 89 0.034, 90 0.011, 91 0.005, plus a 0.002 / 0.001 trace at 92 / 93 so soccer's few base golds that high can still drop), restricted to the slot's floor and renormalised. Then a position of the slot's mix that has a card at that overall (by the mix's weights), then a card there uniformly. Only when no position of the mix has the overall does it step to the nearest one that does (−1, +1, …; `curveStepMass` measures it: ≤ 1.5% for every floor, sport and unit). Per any-gold slot: 75–79 45.0%, 80–82 49.2%, 83–85 5.2%, 86+ 0.59% (85+ 1.0%, 88+ 0.20%). Silvers use `SILVER_CURVE` (65–69 9% each, 70–74 11% each); bronze stays flat. The old in-tier exponential (each point 20% rarer) is gone from every pack.
- **Floor slots, not rare slots.** Slot kinds `g75 g78 g80 g82 g84 g86 g88` ("a gold 78+"). A rare gold (`rare.ts`, top 35% per position) is the shimmer only. Saved Club Collection recipes keep opening: their `gold` reads as `g75` and `rare` as `g78`.
- **Slot lists for every source** (NBA; NFL and soccer keep their card counts, the old rare golds becoming the 78+ slots):

  | Source | Slots now |
  |---|---|
  | Bronze / Silver | unchanged; Silver's last slot is Silver 75% / G75 25% |
  | Gold | 2 S, 2 G75, 1 G78 that is the special slot (Standout 1.5%, Hot Season 0.5%, Legend 0.2%) |
  | Premium | 2 S, 3 G75, 2 G78 + the premium slot on G78 (Standout 4%, Hot Season 2%, Legend 0.66%) |
  | Jumbo | 4 S, 4 G75, 7 G78 + the premium slot |
  | Position / Unit | (k − rare) G75 + rare G78 at the position(s), preferring unowned (NBA 2 + 1, NFL 4 + 2, soccer 3 + 1) |
  | Elite Gold (re-spec) | 5 G82 + G84 special slot (Standout 10%, Legend 1%), preferring unowned (NFL 10 G82 + 2 G84, soccer 7 + 1) |
  | Program Pack (`live:`) | 4 G75 + 3 G80 + program slot (program odds and extras, **Legend 0.5%**, the rest a Weekly Standout) |
  | Program Guarantee | 5 G82 + a program card |
  | Standout Guarantee / Lightning | G75 / G78 for the old gold / rare, + the Standout |
  | Daily Drop | last card Silver 60% / G75 38% / Standout 2% |
  | Starter, Club Collection, admin squads | their golds on the curve (`gold` → G75, `rare` → G78) |
  | Spotlight / GOAT (registered) | common golds by `legacyFill`, the pre-curve draw, so every receipt rebuilds exactly |
  | SBC `rewardCard` (gold) | the curve from its `minOvr` (84 → G84, 86 → G86, …; any other floor is the curve from that overall) |
  | Scout's Choice | 3 options on G84; a Weekly Standout option only when it is 84+ |
  | Picks | `front-office` 5 on G80, `pick-82` 3 on G82, **`pick-84` 3 on G84 (unowned first), `pick-85` 3 on G85 (the stamp shelf's 120 rung, open now)** |

  Headliners and Franchise Vault are cut (D16): no new buyable kind.
- **Holo 5%, only from a rolled slot.** `HOLO_CHANCE` 4% → 5% (`variants.ts`), and `holoChanceOf(slot, tier)` is 0 when the slot's chance of that tier is 1: a guaranteed Standout, program card or Club Collection Standout is never holo now.
- **Chase duplicate protection.** With the club's card ids (`openPack(…, { owned })`), a Standout slot never gives an owned Weekly Standout and a program slot never an owned program card while any of that set is unowned (it redraws among the unowned). Position/Unit packs, Elite Gold and the 84+ / 85+ picks also prefer golds the club doesn't own: at the drawn overall at that position, then at the mix's other positions, then the nearest overall **above** (up to the curve's top). It never steps below the drawn overall: when the club owns every card from there up, it gives a duplicate at the drawn overall. A fresh club draws exactly the published curve, and the protection can only raise a published chance, so the odds sheet shows them as minimums ("these odds are the least you get"). (The first packs-2 commit also tried the overall below after each one above, which lowered 84+ / 88+ rates; fixed after review, see "packs-2 review fixes".)
- **Initial re-prices (packs-3 tunes them all again).** Golds on the curve sell for more (gold mean 77.9 → 79.9), so the packs that went above 63% EV were re-priced to about 57–59%: NBA Silver 400 → 500, Gold 900 → 1,050, Position 700 → 800, Roster Builder 1,500 → 1,700; NFL Silver 320 → 350, Gold 900 → 1,000, Unit 500 → 575, Roster Builder 900 → 1,100; soccer Silver 380 → 450. Elite Gold's re-spec is priced on its value: research's 3,000 would return 42%, so NBA 2,200 → 2,600, NFL 1,500 → 1,800, soccer stays 1,900 (about 49%). Soccer's Captains and Dynasty had fallen to 35% when packs-1 moved Standout quick-sell under Hot Season: 2,300 → 1,450 and 4,300 → 2,700. `NOMINAL_PRICE` (stamps for earned packs) follows: a MINUTES Silver is now 5 / 3 / 4 stamps.
- **`src/ut/drop-tables.ts` (V2.4 E, D14), pure: imports only the seeded rng and types.** `dropTable`, `dropOdds` (exact, every tap path enumerated), `rollDrop(seed, sport, index)` (deterministic per seed, `path` = the tier after each of the 3 taps, so the reveal plays only what was rolled), `dropValue` / `dropEv` (coins, stamps at 11, packs at their measured quick-sell value). Drop 1 is ut's Scout Reveal unchanged: Silver Pack + 100 coins, each tap upgrading the pack (→ Gold 35%, → Premium 25%, → Jumbo 15%) and **the first miss settling it** (`stopOnMiss: true`, the only reading that gives ut's published 65.0 / 26.25 / 7.44 / 1.31%). Drops 2–3 start Common, each tap upgrading Common 20% / Rare 25% / Epic 30%, a miss only spending that tap: 51.2 / 36.05 / 11.25 / 1.5%; Common 25 coins, Rare 45, Epic 60 + 3 stamps, Legendary a Silver Pack.
- **`src/ut/pack-actions.ts`: the packs team's one hook in `UltimateTeam.tsx`.** `usePackActions(ut)` → `openOpts()` (the owned card ids, memoised on `ut.owned`) and `limitOf(kind)` (the limit kind of an Elite, Jumbo, Standout or Lightning pack, from `LIMITED_PACKS` in `content-packs.ts`). Named `limitOf` rather than the plan's `canBuy`, because the buy flow needs which limit routes the purchase, not a yes/no (it checks the count itself).
- **Pack Tracker.** The reward picks (`front-office`, `pick-82`, `pick-84`, `pick-85`, `program-pick`) are pick groups with their own names ("Player Pick 84+"), so they no longer count as opened packs. Sources `scout-drop:` → Scout Drop, `minutes:` → Minutes, `stamps:` → Scout Stamps. A Scout Drop's pack logs under its pack kind with source `drop` and earns no stamps.
- **Store and pick sheet.** The odds sheet names floor slots ("Gold 78+"), replaces "each point above the floor is a little rarer" with the curve's real band split, and says when a pack prefers unowned golds. A waiting pick's tile reads its kind ("Player Pick 84+", "Front Office Pick 80+") with "PICK 1 OF n" (a Front Office Pick has 5); the pick sheet's heading counts the options.

### Before → after (`O/packs-out/before/` → `O/packs-out/after-packs-2/`, 10,000 seeded packs per type, week 2026-W46)

EV / price uses each run's own price (the Price column is the new one). "Dup at 200" is one player opening that pack 200 times in a row and keeping everything (after: with duplicate protection, which sees his club).

##### NBA

| Pack | Price | EV / price (before → after) | Golds 75–79 / 80–82 / 83–85 / 86+ % after | P(≥1 86+) before → after | Dup at 200 before → after |
|---|---|---|---|---|---|
| Bronze Pack | 250 | 0.54 → 0.55 | 0.0 / 0.0 / 0.0 / 0.00 | 0.0 → 0.0 | 7% → 7% |
| Silver Pack | 500 | 0.60 → 0.59 | 44.7 / 49.7 / 4.8 / 0.77 | 0.0 → 0.2 | 8% → 4% |
| Gold Pack | 1,050 | 0.56 → 0.57 | 41.3 / 52.8 / 5.4 / 0.59 | 2.9 → 2.7 | 6% → 6% |
| Premium Gold | 1,800 | 0.55 → 0.61 | 40.0 / 53.7 / 5.7 / 0.62 | 8.8 → 7.1 | 12% → 14% |
| Daily Drop | 0 | — → — | 45.4 / 48.8 / 5.0 / 0.80 | 0.5 → 0.7 | 4% → 3% |
| Elite Gold | 2,600 | 0.49 → 0.49 | 0.0 / 60.8 / 32.9 / 6.28 | 12.9 → 35.3 | 27% → 2% |
| Jumbo Premium | 3,600 | 0.56 → 0.60 | 37.9 / 55.6 / 5.8 / 0.66 | 15.2 → 10.8 | 21% → 23% |
| Standout Guarantee | 3,000 | 0.50 → 0.52 | 40.9 / 52.9 / 5.6 / 0.66 | 26.8 → 27.3 | 24% → 29% |
| Lightning Standout | 2,250 | 0.67 → 0.69 | 40.6 / 53.0 / 5.7 / 0.64 | 27.4 → 25.3 | 23% → 29% |
| Roster Builder | 1,700 | 0.54 → 0.58 | 42.4 / 51.4 / 5.5 / 0.66 | 2.1 → 2.6 | 11% → 10% |
| Captains Pack | 2,400 | 0.51 → 0.52 | 41.1 / 52.7 / 5.6 / 0.65 | 25.9 → 25.9 | 24% → 27% |
| Dynasty Pack | 4,400 | 0.53 → 0.53 | 40.5 / 53.2 / 5.7 / 0.64 | 47.3 → 46.0 | 32% → 37% |
| Position Pack PG | 800 | 0.57 → 0.58 | 41.6 / 52.0 / 5.8 / 0.67 | 1.7 → 2.0 | 27% → 0% |
| Position Pack SG | 800 | 0.54 → 0.58 | 41.5 / 52.0 / 5.8 / 0.67 | 0.9 → 2.0 | 22% → 0% |
| Position Pack SF | 800 | 0.57 → 0.58 | 41.8 / 51.8 / 5.8 / 0.62 | 1.4 → 1.8 | 29% → 0% |
| Position Pack PF | 800 | 0.56 → 0.58 | 41.3 / 52.4 / 5.6 / 0.61 | 1.9 → 1.8 | 24% → 0% |
| Position Pack C | 800 | 0.57 → 0.58 | 41.4 / 52.2 / 5.8 / 0.68 | 3.7 → 2.0 | 25% → 0% |
| Starter | 0 | — → — | 45.5 / 48.5 / 5.4 / 0.59 | 0.1 → 0.6 | 8% → 6% |
| Spotlight Pack | 3,500 | 0.31 → 0.55 | 93.0 / 5.9 / 1.0 / 0.12 | 50.6 → 50.6 | 14% → 14% |

Scout's Choice best option bands: {'86-87': 0.3378, '90-93': 0.0593, '83-85': 0.4106, '88-89': 0.1923} mean best 86.33

##### NFL

| Pack | Price | EV / price (before → after) | Golds 75–79 / 80–82 / 83–85 / 86+ % after | P(≥1 86+) before → after | Dup at 200 before → after |
|---|---|---|---|---|---|
| Bronze Pack | 175 | 0.54 → 0.55 | 0.0 / 0.0 / 0.0 / 0.00 | 0.0 → 0.0 | 8% → 8% |
| Silver Pack | 350 | 0.50 → 0.59 | 45.6 / 48.4 / 5.5 / 0.56 | 0.0 → 0.3 | 13% → 6% |
| Gold Pack | 1,000 | 0.51 → 0.59 | 42.9 / 51.1 / 5.4 / 0.59 | 3.4 → 7.1 | 12% → 18% |
| Premium Gold | 1,400 | 0.50 → 0.59 | 40.6 / 53.1 / 5.7 / 0.61 | 9.1 → 12.5 | 18% → 24% |
| Daily Drop | 0 | — → — | 45.4 / 48.8 / 5.4 / 0.47 | 1.0 → 1.2 | 6% → 2% |
| Elite Gold | 1,800 | 0.48 → 0.49 | 0.0 / 60.3 / 33.1 / 6.55 | 14.8 → 59.4 | 40% → 23% |
| Jumbo Premium | 2,700 | 0.50 → 0.56 | 38.4 / 55.1 / 5.8 / 0.65 | 15.5 → 18.4 | 30% → 33% |
| Standout Guarantee | 1,800 | 0.50 → 0.55 | 41.1 / 52.7 / 5.6 / 0.62 | 50.6 → 53.4 | 26% → 33% |
| Lightning Standout | 1,350 | 0.67 → 0.74 | 41.0 / 52.8 / 5.7 / 0.62 | 51.1 → 52.5 | 25% → 32% |
| Roster Builder | 1,100 | 0.53 → 0.58 | 43.6 / 50.4 / 5.4 / 0.62 | 0.8 → 4.3 | 18% → 14% |
| Captains Pack | 1,000 | 0.55 → 0.61 | 42.7 / 51.1 / 5.5 / 0.61 | 49.0 → 51.1 | 21% → 24% |
| Dynasty Pack | 1,900 | 0.54 → 0.59 | 42.3 / 51.5 / 5.5 / 0.61 | 75.7 → 76.8 | 29% → 35% |
| Position Pack QB · RB · K | 575 | 0.52 → 0.57 | 41.4 / 52.1 / 5.7 / 0.73 | 1.4 → 3.9 | 35% → 1% |
| Position Pack Receivers | 575 | 0.56 → 0.57 | 41.5 / 52.1 / 5.7 / 0.63 | 2.3 → 3.6 | 33% → 0% |
| Position Pack Offensive Line | 575 | 0.54 → 0.57 | 41.8 / 51.6 / 5.8 / 0.78 | 2.8 → 4.1 | 38% → 2% |
| Position Pack Defensive Line | 575 | 0.55 → 0.57 | 41.5 / 52.1 / 5.7 / 0.63 | 0.9 → 3.6 | 39% → 7% |
| Position Pack Linebackers | 575 | 0.51 → 0.57 | 41.9 / 51.7 / 5.7 / 0.67 | 1.4 → 3.7 | 47% → 18% |
| Position Pack Secondary | 575 | 0.52 → 0.57 | 42.0 / 51.7 / 5.7 / 0.65 | 1.1 → 3.6 | 39% → 12% |
| Starter | 0 | — → — | 44.2 / 50.4 / 4.8 / 0.55 | 0.0 → 0.5 | 14% → 12% |
| Spotlight Pack | 3,500 | 0.19 → 0.28 | 96.7 / 3.0 / 0.3 / 0.03 | 49.8 → 49.8 | 25% → 25% |

Scout's Choice best option bands: {'88-89': 0.1814, '86-87': 0.3838, '83-85': 0.4012, '90-93': 0.0336} mean best 86.21

##### SOCCER

| Pack | Price | EV / price (before → after) | Golds 75–79 / 80–82 / 83–85 / 86+ % after | P(≥1 86+) before → after | Dup at 200 before → after |
|---|---|---|---|---|---|
| Bronze Pack | 220 | 0.58 → 0.60 | 0.0 / 0.0 / 0.0 / 0.00 | 0.0 → 0.0 | 10% → 10% |
| Silver Pack | 450 | 0.58 → 0.58 | 45.4 / 48.7 / 5.2 / 0.70 | 0.0 → 0.2 | 6% → 4% |
| Gold Pack | 900 | 0.46 → 0.51 | 42.5 / 51.6 / 5.3 / 0.60 | 4.2 → 3.5 | 6% → 7% |
| Premium Gold | 1,600 | 0.51 → 0.53 | 40.0 / 53.7 / 5.7 / 0.64 | 12.9 → 8.6 | 13% → 15% |
| Daily Drop | 0 | — → — | 44.9 / 49.8 / 4.7 / 0.58 | 0.9 → 1.1 | 2% → 2% |
| Elite Gold | 1,900 | 0.46 → 0.49 | 0.0 / 63.5 / 31.1 / 5.46 | 21.9 → 40.1 | 31% → 2% |
| Jumbo Premium | 3,200 | 0.51 → 0.54 | 38.5 / 55.0 / 5.8 / 0.66 | 22.9 → 13.3 | 22% → 25% |
| Standout Guarantee | 2,600 | 0.63 → 0.48 | 41.0 / 52.7 / 5.6 / 0.64 | 52.2 → 49.9 | 24% → 29% |
| Lightning Standout | 1,950 | 0.84 → 0.64 | 40.9 / 52.8 / 5.7 / 0.64 | 50.7 → 49.0 | 23% → 28% |
| Roster Builder | 1,000 | 0.54 → 0.62 | 42.4 / 51.3 / 5.5 / 0.66 | 2.7 → 2.6 | 6% → 8% |
| Captains Pack | 1,450 | 0.53 → 0.55 | 41.1 / 52.7 / 5.6 / 0.65 | 48.1 → 48.7 | 22% → 25% |
| Dynasty Pack | 2,700 | 0.55 → 0.56 | 40.5 / 53.2 / 5.7 / 0.64 | 76.1 → 74.1 | 29% → 34% |
| Position Pack Goalkeepers | 650 | 0.49 → 0.56 | 42.7 / 50.8 / 5.8 / 0.73 | 2.5 → 2.8 | 47% → 18% |
| Position Pack Defenders | 650 | 0.49 → 0.56 | 42.2 / 51.7 / 5.6 / 0.58 | 1.7 → 2.3 | 16% → 0% |
| Position Pack Midfielders | 650 | 0.50 → 0.56 | 42.2 / 51.6 / 5.6 / 0.64 | 3.7 → 2.6 | 20% → 0% |
| Position Pack Attackers | 650 | 0.50 → 0.56 | 42.2 / 51.4 / 5.8 / 0.62 | 3.9 → 2.4 | 20% → 0% |
| Starter | 0 | — → — | 46.2 / 48.3 / 4.9 / 0.61 | 0.2 → 0.6 | 12% → 12% |

Scout's Choice best option bands: {'86-87': 0.3394, '90-93': 0.064, '83-85': 0.4044, '88-89': 0.1922} mean best 86.3

Live Calendar program packs (NBA): First Tip Pack EV 0.53 → 0.57, P(≥1 84+) 64%; its Guarantee 0.51 → 0.55, every gold 82+. NFL First Tip 0.51 → 0.59 (84+ in 83% of packs). The guarantee card itself never repeats while any released card is unowned (tested); the 5 golds 82+ around it do repeat more at 200 packs (35% → 55%), but a guarantee is 1 a week, so 200 is four years of them.

**Against the acceptance:**

| Acceptance | Result |
|---|---|
| G75 slot, 200,000 draws: 85+ 1.0% ± 0.08, 86+ 0.58% ± 0.06, 88+ 0.20% ± 0.04 | pass in NBA, NFL and soccer (`pack-curve` suite) |
| Gold-pack band split 45 / 49 / 5 / 0.7 ± 2 | the any-gold slots: 45.0 / 49.2 / 5.2 / 0.6 (tested, all sports). The whole Gold pack's golds read 41.3 / 52.8 / 5.4 / 0.6 (NBA) because research's slot list makes one of its three golds a G78; that is the research's own odds sheet (Gold NBA 80+ 93%, 82+ 53%), so the 45 / 49 / 5 / 0.7 target is the per-slot curve, which holds |
| Registered-receipt seeds rebuild identical ids (fingerprint-gated); 0 holos in guaranteed slots | the 20 frozen receipts per sport equal the packs-1 fixture (`packs-economy` suite, gated on `FOREIGN_FINGERPRINT`); 0 holos in 10,000 Standout Guarantees; 5.0% ± 0.6 holo among specials from a rolled slot |
| Duplicates at 200 packs: Elite ≤ 20%, NFL Units ≤ 35%, guarantees 0% while any of the set is unowned | Elite NBA 27% → 2%, soccer 31% → 2%; **NFL 40% → 23%**: NFL Elite opens 2,400 cards in 200 packs from about 1,850 golds 82+, so at least 23% must repeat; the test holds NFL to that floor + 1 pt. NFL Units 33–47% → 0–18% (LB 18%) in the first packs-2 commit; **after the packs-2 review fix** (protection never steps below the drawn overall) QB-RB-K 6.3%, WR-TE 3.9%, OL 15.9%, DL 20.3%, DB 34.7%, **LB 53.5%**: each is its upward-only floor (see "packs-2 review fixes"). Standout and Program Guarantees 0% |
| pick-84 over 10k awards: every option ≥ 84, three distinct, none special; repeat id a no-op | pass in all sports; it also prefers unowned golds (tested) |
| `dropOdds` = 200k `rollDrop` ± 0.5 pt; drops 2–3 51.2 / 36.05 / 11.25 / 1.5%, drop 1 65.0 / 26.25 / 7.44 / 1.31%; drops 2–3 EV 35–45 | exact and within 0.5 pt in all sports; EV NBA 43.9, NFL 42.6, soccer 43.4 coin-equivalents |
| pick-84 and a Scout Drop roll in the browser at 393 with 0 page errors | pass (below) |

Other numbers: `rewardCard` 84+ → 85+ 42% ± 3 and 86+ 24% ± 3 (was uniform over every 84+ gold); Scout's Choice best option 85+ about 81% (three G84 golds; a Standout option only adds, so the test holds it to 78–87%), mean best 86.3; Front Office 84+ 20% and 82+ pick 84+ 30% (± 3). Elite Gold 85+ in 55% of packs (NBA; research 55%). Days to a full Gold squad (`economy.test.ts`, 400 coins a day): NBA seller 4 / keeper 6 → 4 / 7, NFL 8 / 11 → 8 / 12 (inside the test's bands; the cheap packs cost a little more now).

### Tests

- **`pack-curve` suite** (`packs-suites/pack-curve.ts`; `pack-curve.test.ts` NBA/NFL, `soccer-pack-curve.test.ts` soccer), 14 tests: the 200k G75 curve and band split; every floor's "x or better" within 0.5 pt of `curveOdds` over 100k draws; step mass ≤ 1.5% for every floor and every Position/Unit mix; slots add to 1 and open their count; saved `rare` / `gold` recipe slots; Elite and Gold floors; holo (0 in guarantees, 5% ± 0.6 rolled); duplicates at 200 packs (Elite, NFL LB/DL/OL); Standout and Program Guarantees never repeat while the set has an unowned card; `rewardCard` 84+; Scout's Choice; Front Office and 82+ picks; Player Pick 84+ over 10,000 awards, its exactly-once id and its unowned preference; the Stamp Scout 85+ redemption.
- **`drop-tables` suite** (`packs-suites/drop-tables.ts`; `drop-tables.test.ts`, `soccer-drop-tables.test.ts`), 6 tests: exact published odds and drop 1's rewards; 200k rolls per drop within 0.5 pt; determinism and honest paths (no skipped tier, nothing moves after drop 1's settling miss); EV 35–45; the import list (only `../engine/rng` and `./types`); `PACK_VALUE` within 12% of real openings.
- **Changed old tests (behaviour changed by design, never weakened):** `content2.test.ts` "opens the new packs with their guarantees" checked rare-gold counts; a guarantee is an overall floor now (golds 78+, Elite golds 82+), so it checks those. The `stamps` suite's MINUTES Silver is 5 / 3 / 4 stamps (the Silver's new price). The `packs-economy` suite's "pick-84 refuses" line (the packs-1 placeholder until this curve) moved to the pack-curve suite as the real pick. The stamps suite's "120 rung returns null" case still passes (that state is short of 120); the open rung is tested in pack-curve.
- Typecheck clean. NBA `vitest run src/ut src/engine/sport-branches.test.ts` 301 passed; NFL 299 passed; soccer `vitest run soccer sport-branches` 129 passed.

### Browser QA (packs-2)

`scripts/packs/qa-picks.mjs` (dev server 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted: the only host blocked was the Supabase registry; touch, `deviceScaleFactor: 1`). In the page it awards `pick-84` under `minutes:life:25h` (a repeat is a no-op), rolls Scout Drop 1 with ut's seed shape and deposits its pack as `scout-drop:<sport>:<day>:1`, and grants a drop-2 Epic's 3 stamps through `grantStamps(…, 'drop', '<day>:2')`. Then from the Store like a player: the Player Pick 84+ tile (78×142 design px), the sheet, choose, keep, the reveal; the Scout Drop's pack opens as an ordinary pack. After: the kept card is `pick:minutes:life:25h`, no pick left, the tracker logs `pick-84/minutes` and `gold/drop` (or `silver/drop`), and the stamp balance is 3 (the drop pack earned none). 0 page errors in NBA 393 and 320 (reduced motion), NFL 393 (full motion) and soccer 320. Shots in `O/shots/packs/packs-2/`: `*-store-mine.png`, `*-pick84-facedown.png`, `*-pick84-chosen.png`, `*-pick84-cinema.png`, `*-pick84-cards.png`, `*-drop-pack-cinema.png`, `*-drop-pack-cards.png`.

### Saved state and older builds

No new saved field. No storage key, card or copy id, claim id or receipt changes. Unopened earned packs open on the new curve; a saved Club Collection recipe's `gold` / `rare` read as G75 / G78; a registered Spotlight or GOAT receipt rebuilds its common golds with the pre-curve draw (`legacyFill`). The Preview Pack opens exactly the cards it showed. The new pick kinds (`pick-84`, `pick-85`) are ordinary saved pick sheets (`kind` is a free string the normalizer keeps), so an older build shows and keeps them like a Scout's Choice.

### Protocol

None. Pack contents, odds and prices don't touch matches, and `CONTENT_PRINT` / `pool.print` are unchanged.

### Touched outside my lane (packs-2)

- `src/ut/UltimateTeam.tsx` (ut): the `usePackActions` import and call (2 lines), `openPack(pool, kind, undefined, undefined, pa.openOpts())` in `openNow` (1 line; `buy`, `buyLimited` and `buyLive` all open through it), and the local `LIMITED` array replaced by `pa.limitOf(kind)` (−7 / +2 lines). 5 added lines in all.
- `src/admin/catalog.ts`: the Club Collection default prices (packs owns `src/admin/**` repo code; saved recipes keep their awarded snapshot).

### Owner device checks (packs-2)

- A Player Pick 84+ tile and sheet read well at phone size; the odds sheet's new curve line is readable.
- The new prices feel fair against the bigger pulls (Gold 1,050, Silver 500, Elite 2,600 NBA).

### Left for later tasks (packs-2)

- packs-3: every price against the 0.45–0.60 EV band (Premium NBA sits at 0.61, Lightning at 0.69–0.74 by design, the Spotlight's commons stay pre-curve); the Market's gold draws on the curve.
- packs-4: the odds sheets computed from these definitions (`curveOdds`, `curveStepMass`, `holoChanceOf`, `dropOdds` are the inputs), the Scout Drop and Pick 84+ sheets.
- ut: show `dropOdds` before the first tap and play `rollDrop(...).path`; award `pick-84` under the caller's claim id.

## packs-1 review fixes (after the independent review of 9fd5180..c78475d)

Fixed on top of packs-2. No storage key, card or copy id, claim id or receipt changes; no new saved field.

### What changed and why

- **SBC reward packs earn no Scout Stamps (medium).** An SBC pack is paid for with traded-in cards, yet it earned stamps at its full Store price because its pending id was a bare `newId()` (source `reward`). The reviewer measured about 119 stamps a day in NBA and 101 in NFL and soccer from a full day of SBCs. The two-a-day Upgrades alone paid 62 a day in NBA from junk. That is more than one 82+ Player Pick a day and about 6 times the plan's pace target (50 every 3 days or less). Now:
  - New SBC reward packs get the pending id `sbc:<challenge id>:<uuid>` (`UltimateTeam.tsx`, one line). This is additive: existing pending ids stay as they are. `sourceOfPending` reads `sbc:` as `sbc`, the source the Streamlined SBCs' `stream:` packs already had.
  - `earnsNothing` (now exported) returns true for source `sbc` and for ids starting `sbc:` or `stream:`. A Streamlined SBC pack is also paid for with cards, and it used to earn stamps at its Store price too. The special-duplicate +10 is off for these packs as well.
  - The `stamps` suite adds two cases. First, an SBC Silver (`sbc:` and `stream:` ids) earns 0, while a MINUTES or objective Silver still earns its Store price (NBA 5, NFL 3, soccer 4 since packs-2's prices). Second, a pace test over 14 days of `sbcsFor`: SBC packs now pay 0 stamps. The same packs under the old ids pay more than 50/3 a day, so the measured problem is real on this catalogue.
  - Packs that were already pending under a random id when the update arrives still earn as before. That is a small, one-time amount: `STAMPS_FROM` is the release instant, so nothing earned before it counts.
- **A full pick list never eats stamps or coins (low, real).** `normalizeContent` keeps the first 50 open picks, so a 51st pick was dropped on the next load after its stamps, coins or reward claim were spent. Changes:
  - `content-state.ts` now exports `PICKS_MAX = 50`, `picksFull(ut)` and the toast text `PICKS_FULL`.
  - **Contract change for ut:** `awardPick` now returns `UtState | null`. It returns null when the picks are full or the pool has no option, so the caller writes no claim and the reward stays claimable. A repeat id still returns the same state.
  - `redeemStamps` returns null in the same case, with nothing spent.
  - In `UltimateTeam.tsx`, the Scout's Choice purchase refuses with the toast before charging coins, both in the handler and inside the update. A pending Scout's Choice, Standout or Live Calendar pick pack stays pending, with the toast, instead of turning into a pick that would be dropped.
- **Trade-in confirm (low).**
  - A count line now sits above the red rows ("4 cards you may want to keep · scroll to see all").
  - With more than three rows, the list fades at the bottom, so a hidden 4th card is no longer a surprise.
  - The 90+ reason reads "90+ rated" instead of repeating the overall shown in the row title ("Michael Jordan 92 · 92 overall" before).
- **Auto-fill's failing path no longer searches twice (low).**
  - Before, the toast choice ran a second full `autoFill` with `guard: false`.
  - Now it uses `guardBlocked(s, club)` (sbc.ts): one pass that asks whether any protected card meets everything each card must (`cardFits`).
- **A pack this build doesn't know says so before the tap (low).** `knownPack(sport, kind)` (packs.ts) mirrors what `openPack` handles. An unknown kind (a reward from a newer build) gets:
  - a "New Pack" tile with NEW pack art;
  - a gold "UPDATE TO OPEN" tag on two lines inside the 78 px tile;
  - the aria-label "New pack: update the game to open it. It stays saved until then."

  Tapping still shows the D9 toast, and the pack stays saved.
- **Pick tiles (low): already fixed by packs-2, so no change here.** `pickLabel` names Front Office, Player Pick 82+/84+, Stamp Scout 85+ and Program picks, and the art reads `PICK 1 OF ` + the option count. The 1-of-5 Front Office Pick shows "PICK 1 OF 5". The shelf's `stamps:g82:<uuid>` pick is kind `pick-82`, so it reads "Player Pick 82+".

### Tests

- `stamps` suite (all three sports), three new cases:
  - an SBC pack earns 0, while MINUTES and objective packs still earn;
  - the 14-day SBC pace;
  - with 50 picks open, `redeemStamps` spends nothing and `awardPick` (front-office, program-pick) returns null; with 49 picks the redemption goes through and survives the normalizer.
- `packs-economy` suite:
  - `guardBlocked` cases next to the protection test;
  - the confirm's 90+ wording (no repeated overall);
  - D9: `knownPack` is false for `headliners` and for an unknown position choice, and true for every `packDefs` kind, the starter, picks, Spotlight, Live and admin packs.
- `pack-curve` and `packs-economy` callers use `awardPick(...)!` for the new nullable return.

### Browser QA

`scripts/packs/qa-fixes-1.mjs`, isolated as for packs-1: dev server on 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted, touch, `deviceScaleFactor: 1`, reduced motion. Results are below.

Run with NBA at 393×852 (insets 59/34) and at 320×568. Shots are in `O/shots/packs/packs-1-fixes/`. Both sizes gave the same results:
- **Your packs** (`nba-393-your-packs.png`). The four tiles read:
  - "PICK 1 OF 5 · Front Office Pick 80+ · CHOOSE";
  - "PICK 1 OF 3 · Player Pick 82+ · CHOOSE" (the shelf's `stamps:g82:` pick);
  - "NEW · New Pack · UPDATE TO OPEN" (kind `headliners`);
  - "GOLD · Gold · OPEN".

  The new tile is 78×142 design px, with its two-line tag inside it. Tapping it shows "Update the game to open this pack. It stays in your Store until then." The saved pending kinds are still `headliners,gold` afterwards.
- **Auto-fill.** On a spare club of 40 special editions, AUTO-FILL answered in 80–91 ms: "Auto-fill never trades special, numbered or high-value cards. Put those in by hand." The toast came from `guardBlocked`, with no second search.
- **Trade-in confirm** (`nba-393-sbc-confirm.png`, `nba-320-sbc-confirm.png`). Fresh Faces had 8 specials put in by hand. The count line reads "8 cards you may want to keep · scroll to see all". The list scrolls (583 of 246 px shown), and the fourth row fades out under the third. The rows read "Luka Dončić 96 · Hot Season edition · 90+ rated · sells for 740 coins, more than the reward", with no repeated overall.
- No page errors. The only host blocked was the Supabase registry: nothing reached a live service.

### Touched outside my lane (review fixes)

- `src/ut/UltimateTeam.tsx` (ut), 15 added and 2 changed lines:
  - the SBC reward pack's id (`'sbc:' + s.id + ':' + newId()`);
  - the `picksFull` / `PICKS_FULL` import;
  - the Scout's Choice purchase guard (handler and update);
  - the pending-pick guard in `openPending`.

### Protocol

None. Stamps, picks, the confirm and the Store tile are economy and presentation.

## packs-3: prices, limits and exploits

### What changed and why

- **One coin model (`src/ut/value.ts`, D10).** `routeCost(sport, ovr)` = the Premium Gold price ÷ the exact chance a Premium holds a gold of that overall or better (from the pack's own slots on the gold curve). `coinValue(rc)`: 2 × quick-sell, a gold 83+ at its route cost, a special at its D5 rung (`SPECIAL_RUNG`, the rung's lower bound until packs-6 measures the ladder). `goldRewardValue(sport, floor)`: a gold reward from 83 up is worth `routeCost(floor)`, because buying Premiums until one holds a gold `floor`+ hands out exactly that draw. Below 83 it is the curve's mean. `cheapestFodder` is a DP over the overall sum. `packEv(pool, slots, ctx)` / `livePackEv(...)` give a pack's expected quick-sell value exactly. They agree with 10,000 simulated packs within 0.001–0.002 for every Store kind.
- **Scout Market (audit C2, owner decision 4).** Twelve base cards a day: 2 silvers, 5 golds up to 82 and 4 golds 78–82, all on the curves, plus one **scouted** gold 83–86 (the curve cut at 86). No Hot Season, Standout or other special, and nothing above 86. Each card costs the most of: its kind's floor (silver 100, gold 300, gold 78+ 400, scouted 1,500), 3 × quick-sell, and ¼ of its route cost. The seed is now `ut-market:v2:<sport>:<day>`. `MarketTag` keeps `promo` / `standout` in its union, and the Store tags read SILVER / GOLD / GOLD 78+ / SCOUTED at 10 design px (they were 7.5).
- **Swap Desk:** 1 a day (it was 3), so 7 picks a week instead of 21. Inside a "swap-desk 4-for-1" flash window it takes 4 duplicates (`swapSize(at, sport)`); otherwise 5.
- **Preview Pack (audit H1).** The next preview comes 24 hours after a buy **or** a skip (`PREVIEW_COOLDOWN_MS`). Before, a buy unlocked the next one at once and a skip waited only an hour. A preview binds the week it was made in (`preview.wk`, optional, written at creation and by each next preview), so its Standout slot shows the same cards across the Monday rollover. The copy says "Next preview in 23 h 50 min. One preview a day."
- **Club Collection (audit H2), `src/admin/catalog.ts`.** *(Superseded: the review fixes below put each Standout at the Standout Guarantee's whole price, as the plan says.)* `floorPrice(sport, counts)` prices each Standout at what the Standout Guarantee asks for one (its price less its golds' quick-sell value ÷ 0.6), and the rest at quick-sell ÷ 0.6, rounded up to 100. `STUDIO_VALUE` pins the per-tier values, and the exploits suite holds them to the live definitions within 1%. `checkedCatalog(raw, sport)` raises a price to its floor, so a live catalog under the floor still loads (`setCatalog` and the relay path pass the sport). The Store Packs editor shows "Minimum N coins" under the price field. Below it, the line turns red, REVIEW is disabled, the error names the pack, and `publishCatalog` refuses too (`belowFloor`). Default prices: NBA Captains 2,400 → 2,500 and Dynasty 4,400 → 4,800; NFL Captains 1,000 → 1,200 and Dynasty 1,900 → 2,200; soccer Roster 1,000 → 1,100, Captains 1,450 → 1,700 and Dynasty 2,700 → 3,200. Limits through `pa.limitOf` (`studio:` recipes included): Roster 2 a day, Captains 1 a day, Dynasty 1 a week.
- **Program packs (audit H3, M5), `live-packs.ts`.** One program-pack price per sport (`LIVE_PROGRAM_PRICE`: NBA 3,300, NFL 2,000; soccer 2,800, held for when it has a calendar). Every program pack returns about the same coins whatever its odds, so the schedule's premium on low-odds packs only made them poor value: Ring Night returned 0.40 and Summer Heat 0.44. A guarantee costs `max(its scaled schedule price, ceil100(2.2 × the program pack))`: NBA 7,300 (was 3,200–4,900), NFL 4,400 (was 1,900–2,800).
- **Friday boost (`flash.ts`).** From the Friday on or after each release day (the promo's start, or each wave) at 18:00 Eastern, for 48 hours, a promo's program packs draw the program slot at `min(0.6, 1.5 × base)`. The share is scaled across the promo and its extras; the Legend chance stays and the Weekly Standout share shrinks. `livePackDef(sport, pack, at)` returns `boost: { until } | null` and the boosted slot. A pack opens with the odds of the moment it opens (`OpenOpts.at`, default now). The Store tile shows "BOOSTED program odds ×1.5 for 1d 23h", and its odds sheet shows the boosted row. Guarantees are never boosted (they are 100% already).
- **Lightning windows.** Two of the four weekend slots (Sat 12–2 pm and 8–10 pm, Sun 1–3 pm and 7–9 pm Eastern) each ISO week, seeded by `'flash:' + week` and the same for everyone. Before, all four Sat/Sun 12–2 / 8–10 slots were open every weekend. The limit key `lightning:<day>:<hour>` is unchanged. The Store note names the next window ("opens in 1d 1h: Sat 8 pm–10 pm Eastern. Two surprise windows every weekend."). Soccer gets the same windows: the slots are code constants, so they don't depend on the calendar.
- **Named season flash sales.** `flashSalesAt(at, sport)` reads `seasons[].flash`, which nothing read before. It handles one date or `every <Day> A..B`, each window's start (Eastern) and length, and the cycle shift and id suffix. `"<pack>@-N%"` becomes a deal at the Store price N% off (to 50 coins), 1 per player per sale day under `flash:<sale>:<kind>:<day>`. That key is kept by both counter prunes (`recordBuy` keeps `flash:` keys within its last 40). `"swap-desk 4-for-1"` sets the swap size. Any other text is ignored and listed by `flashOfferIssues()`: today the two "scout-market 24 cards" offers. The Store shows a FLASH SALE block (name, time left, struck Store price, −N% chip, 1 left / Bought in this sale, a 44-px BUY), and `buyFlash` in `UltimateTeam.tsx` buys it. Scout's Choice deals become a pick; the rest open as packs.
- **Prices by value (M5).** Every sold non-chase item returns 0.45–0.60 of its price, and every flash deal 0.75 or less at its sale price, boost included. NBA Premium 1,800 → 1,900 (0.61 → 0.58). Jumbo NBA 3,600 → 4,200, NFL 2,700 → 3,000, soccer 3,200 → 3,300: Jumbo sells 30% off in sales, so it sits near 0.51. Soccer Standout Guarantee 2,600 → 2,400 (0.48 → 0.52), Lightning 1,950 → 1,800, still 25% off. `NOMINAL_PRICE` (stamps for earned packs) follows. Chase items are listed apart: the Program Guarantee (0.23–0.32), Spotlight (packs-6) and Scout's Choice, a pick of three 84+ golds valued by route cost, not quick-sell. *(The review fixes below re-price Scout's Choice by route cost and make Captains and Dynasty chase items.)*
- **SBC value rules (research §8.8), `sbc.ts`.** `sbcValue(s, sport)` is reward ÷ the cheapest cards that meet the challenge, at D10 values. `UPGRADE_TUNE[sport]` sets each upgrade's size and team-overall or every-card minimum (display scale, per sport) so the Daily Upgrades pay 1.1–1.3 and the repeatables 0.9–1.1. Golden Hour pays an 84+ and Elite Pull an 85+ in every sport (NBA was 83 / 85, NFL 81 / 83). Ids, titles, list order and rewards' kinds are unchanged. Blurbs are generated from the numbers ("Four golds, team 83+ for a better one.").

### Before → after (`O/packs-out/before-packs-3/` → `O/packs-out/after-packs-3/`, `scripts/packs/exploits.ts`, 10,000 packs per item)

| Measure | NBA | NFL | Soccer |
|---|---|---|---|
| Store packs, EV / price range | 0.49–0.61 → 0.49–0.58 | 0.49–0.61 → 0.49–0.59 | 0.48–0.62 → 0.47–0.60 |
| Program packs (every scheduled one) | 3,000–4,200 at 0.40–0.60 → 3,300 at 0.51–0.55 | 1,800–2,500 at 0.42–0.61 → 2,000 at 0.52–0.55 | no calendar |
| Program Guarantee price / EV | 3,200–4,900 / 0.47–0.67 → 7,300 / 0.24–0.32 | 1,900–2,800 / 0.44–0.61 → 4,400 / 0.23–0.28 | — |
| Boosted program packs, highest EV | — → 0.59 | — → 0.57 | — |
| Flash deals, highest EV at sale price | — → 0.734 (Jumbo −30%) | — → 0.743 (Standout −25%) | none |
| Lightning Standout | 0.69 | 0.74 | 0.64 → 0.70 |
| Market, 60 days: max overall / days with > 1 card 83+ / specials | 97 / 60 / 180 → 86 / 0 / 0 | 97 / 60 / 180 → 85 / 0 / 0 | 97 / 59 / 180 → 86 / 0 / 0 |
| Market 83+ price ÷ route cost, lowest | 0.002 → 0.25 | 0 → 0.249 | 0 → 0.249 |
| Swap Desk picks a week | 21 → 7 | 21 → 7 | 21 → 7 |
| Preview, hourly checker buying only specials, 30 days (20 players) | 47.7 specials, up to 8 previews a day → 2.50, 1 a day | 48.7 → 2.20 | 45.9 → 2.40 |
| Daily Upgrades value out ÷ in (Bronze / Silver / Gold) | 3.33 / 2.63 / 1.12 → 1.19 / 1.21 / 1.20 | 7.00 / 6.67 / 2.64 → 1.21 / 1.19 / 1.20 | 4.50 / 3.00 / 1.72 → 1.22 / 1.20 / 1.21 |
| Repeatables (Silver to Gold / Golden Hour / Elite Pull) | 1.50 / 2.20 / 1.18 → 0.98 / 1.04 / 1.01 | 1.56 / 0.62 / 2.56 → 1.02 / 0.95 / 1.04 | 1.31 / 2.66 / 1.14 → 0.99 / 1.01 / 0.96 |

The Preview's 2.2–2.5 is the Premium's own rate (30 previews × about 8% a special): checking hourly no longer helps.

**D10 route costs** (coins for a gold of this overall or better by the Premium route, after):

| Overall | 80 | 82 | 83 | 84 | 85 | 86 | 87 | 88 |
|---|---|---|---|---|---|---|---|---|
| NBA | 1,908 | 2,407 | 5,893 | 13,022 | 29,639 | 50,904 | 81,270 | 144,697 |
| NFL | 1,400 | 1,439 | 2,355 | 4,570 | 9,828 | 16,576 | 26,218 | 46,363 |
| Soccer | 1,601 | 1,827 | 3,942 | 8,413 | 18,869 | 32,256 | 51,375 | 91,312 |

**Coin flow (an engaged NBA player, ≈ 1,470 coin-equivalents a day by D.16, in Premium-equivalents a day):** income buys 0.82 → 0.77 Premiums (Premium 1,800 → 1,900). The two-a-day Daily Upgrades added 2,380 coins of value a day above what went in (≈ 1.32 Premiums) → 1,160 (≈ 0.61). In all, 2.14 → 1.38 Premium-equivalents a day. The removed cheap routes are on top of that: two 94–97 Hot Season cards a day for about 2,100 coins each, 14 extra Scout's Choice picks a week, and about 45 extra specials a month from previews.

### Tests

- **`exploits` suite** (`packs-suites/exploits.ts`; `exploits.test.ts` NBA/NFL, `soccer-exploits.test.ts` soccer), 20 tests, 20–35 s a sport:
  - every Store kind over 10,000 packs in [0.45, 0.60], agreeing with the exact EV within 0.015; every Position/Unit key; Premium (the Preview); the Standout Guarantee in band and Lightning ≤ 0.75 in each of 52 weeks;
  - Market over 60 days: 12 distinct players, ≤ 1 card 83+ a day (present ≥ 55 days), none above 86, no special, 83+ priced ≥ ¼ route cost;
  - Swap Desk 1 a day, 5 cards, 4 in the s4 Deadline Day window;
  - Preview not ready at +24 h − 1 ms after a buy and after a skip, ready at +24 h; the same cards across a Monday rollover; `wk` survives today's normalizer, an older build drops it; the hourly 30-day simulation ≤ 2.5 specials and ≥ 24 h between previews;
  - Club Collection values pinned to the definitions; defaults at or above the floor and in band; a 1,000 Captains clamps to the floor (`checkedCatalog(raw, sport)`), and `belowFloor` names it (the editor's refusal); the three limits;
  - Lightning: exactly 2 windows a weekend from the 4 slots, deterministic, each 2 h, inside the window and not 1 ms outside, the pair changing in ≥ 26 of 51 week-to-week steps;
  - offer parsing (sales, swap, ignored texts listed); the s4 Big Game Flash: its two deals at the right prices in 15:00–17:00 and 21:00–23:00 only, its key, 1 per player kept across a prune;
  - every flash deal of the year ≤ 0.75 at its window, boost included;
  - every scheduled program pack in band, also boosted; every guarantee ≥ 2.2 × its program pack and ≥ 0.2 EV;
  - boost windows Fri 18:00 → Sun 18:00 Eastern; at Sun 18:00 − 1 min the row is min(0.6, 1.5 × base) ± 0.001, at + 1 min the base; the slot still sums to 1 with the Legend kept; guarantees never boosted; 10,000 boosted openings hit the published row within 1.5 pt;
  - the six upgrades in their bands on three days;
  - route cost rising and matching 10,000 simulated Premiums within 5%.
- **Changed old tests (the old behaviour was the bug, or the design changed):**
  - `calendar.test.ts`: a guarantee returns 0.2–0.35, not about half (it costs 2.2 packs now).
  - `content2.test.ts`: the Lightning case uses the week's seeded window instead of a fixed Sunday 12:00.
  - `content3.test.ts`: a bought preview waits 24 hours (it was ready at once: audit H1).
  - `sbc.test.ts`: Golden Hour's size comes from `UPGRADE_TUNE`, and Elite Pull asks more by value, not by an 8-card team overall.
  - `packs-economy` "before fixture": the upgrades may differ, and a new check rebuilds the old six upgrades and proves every day's catalogue (dailies, weeklies, ids, order) still equals the packs-1 fixture.
- Typecheck clean. NBA `vitest run src/ut src/admin src/engine/sport-branches.test.ts` 341 passed; NFL 339 passed; soccer `vitest run soccer sport-branches` 152 passed.

### Browser QA (packs-3)

`scripts/packs/qa-exploits.mjs` was isolated as before: dev server 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted (the only host blocked was the Supabase registry), touch, `deviceScaleFactor: 1`. The clock was fixed at Black Friday 2026-11-27 18:30 Eastern.

Runs: NBA 393 (reduced motion) and 320 (full motion), NFL 393, soccer 393 and 320. Shots are in `O/shots/packs/packs-3/` (`*-store-top`, `*-flash`, `*-flash-bought`, `*-program-boosted`, `*-lightning-note`, `*-preview-wait`, `*-market`, `*-swap`).

- **FLASH SALE · Black Friday Blitz, "Ends in 1h 30m".** Five deals: Jumbo 4,200 → 2,950, Elite 2,600 → 1,800, Cup Contenders Pack 3,300 → 2,650 (−20%), Scout's Choice 650 → 450, Standout Guarantee 3,000 → 2,250. The BUY button is 83×44 design px.
- **Buying a deal like a player.** Buying the Jumbo charged 2,950 and logged `jumbo/store/2950`. It saved `flash:s2-black-friday:jumbo:2026-11-27`, and the tile then read "Bought in this sale" (NFL: 2,100).
- **The program tile** reads "BOOSTED program odds ×1.5 for 1d 23h". Its blurb says 45% (base 30%).
- **Lightning:** "opens in 1d 1h: Sat 8 pm–10 pm Eastern."
- **Preview:** "Next preview in 23 h 50 min. One preview a day."
- **The Market.** Tags at 10 design px. Prices: NBA silvers 200, golds 400–450, the scouted 83 at 1,500; soccer's scouted 84 at 2,100.
- **The Swap Desk** reads "One swap a day: ready."
- No page errors in any run. Soccer shows no flash block (it has no calendar) and the same Lightning windows.
- The admin editor's minimum line was not shot: the editor sits behind the owner's admin unlock, which QA does not use. It is covered by `belowFloor` / `checkedCatalog` tests, and it is an owner device check below.

### Saved state and older builds

| Field | Shape | If an older build strips it |
|---|---|---|
| `ut.content.preview.wk` | ISO week | the preview reads the current week until the next one is made (its Standout slot could change once at a Monday); harmless |

- No storage key, card or copy id, claim id or receipt changed.
- Market `bought[]` is day-scoped. On release day it points at the new day's items, so an item bought before the update marks the same index bought.
- Lightning and live limit keys keep their formats. Flash keys are new (`flash:…`) and expire with the 40-counter prune.
- Pending Club Collection packs keep their frozen recipe.
- Old previews keep their `until`, so an old one-hour skip finishes as before.

### Protocol

None. Prices, limits, odds, boosts and SBC requirements don't touch matches, and `CONTENT_PRINT` / `pool.print` are unchanged.

### Touched outside my lane (packs-3)

- `src/ut/UltimateTeam.tsx` (ut), 40 added and 12 removed lines:
  - `buyFlash` (24 lines) and `onFlash={buyFlash}` on `<Store>`;
  - imports of `swapSize`, `LIMITS`, `flashDeal` / `flashLeft` / `recordFlash`;
  - `swap()` uses `swapSize(at, SPORT)`, and its toast says "once a day";
  - the preview start, buy and skip pass `week`, and the skip toast says "24 hours";
  - the limit toast reads `LIMITS[kind].per` (a Dynasty resets next week).
- `src/ut/content-ui.css` is not edited: the market tag size is overridden from the new packs-owned `src/ut/store.css`.

### Owner device checks (packs-3)

- The flash sale block and its struck prices read well at phone size.
- The BOOSTED line on a program tile.
- The admin Store Packs editor's "Minimum N coins" line, and the refusal below it: set NFL Captains to 1,000 and REVIEW stays disabled.
- The new prices feel fair: Program Guarantee 7,300 (NBA) and 4,400 (NFL), Jumbo 4,200 (NBA).

### Left for later tasks (packs-3)

- **The Program Guarantee returns 0.23–0.32, under the plan's 0.25 for a few packs.** 2.2 × the program pack and a 0.25 floor can't both hold with its 5 golds 82+ and one program card. The test holds it to 0.2. packs-6 (the ladder: Program rung 6,600–10,000) decides whether its contents grow.
- The "scout-market 24 cards" offers (s5 Market Frenzy, s8 Midnight Market) are ignored. A 24-card market is new behaviour for a later task, and `flashOfferIssues` lists them.
- The sale's `gift` packs (Black Friday's Gold, Christmas's Premium) are not paid. That is a free reward with its own claim, which belongs with packs-7's launch moment.
- packs-4 replaces the odds sheet with the computed one (it already shows the boosted row).

## packs-2 review fixes (after the independent review of c78475d..35a8181)

Fixed on top of packs-3. No storage key, card or copy id, claim id or receipt changes; no new saved field. Protocol: none (pack contents only).

### What changed and why

- **Duplicate protection can no longer lower a published chance (medium).** `unownedNear` (packs.ts) searched +1 then −1 at each distance, so a club owning every card at the drawn overall and the one above got a card *below* the drawn overall even when unowned cards existed higher up. The odds sheet's "these odds are the least you get" was false for exactly the `prefer` packs. Now the search is upward only: unowned cards at the drawn overall at that position, then at the mix's other positions, then the nearest overall above (up to the curve's top); when the club owns everything from there up, it gives a duplicate **at the drawn overall**, never lower. With the same random numbers, the protected card is never below the fresh one, so P(x or better) ≥ the published value for every x. The Store note now reads "… at the overall drawn or higher, never lower, so these odds are the least you get."
- Measured with paired seeds, 1,500 packs, counting packs 300–1,500 (share of golds, `scripts/packs/protect.ts`): fresh → protected.

  | Pack | 84+ old code | 84+ fixed | 88+ old code | 88+ fixed |
  |---|---|---|---|---|
  | NBA PG | 2.667 → 2.556 | 2.667 → 2.667 | 0.222 → 0.222 | 0.222 → 0.222 |
  | NBA SG | 2.444 → 2.139 | 2.444 → 2.444 | 0.306 → 0.306 | 0.306 → 0.306 |
  | NBA SF | 2.806 → 2.611 | 2.806 → 2.806 | 0.139 → 0.111 | 0.139 → 0.139 |
  | NBA PF | 2.861 → 2.667 | 2.861 → 2.861 | 0.194 → 0.167 | 0.194 → 0.194 |
  | NBA C | 2.694 → 2.472 | 2.694 → 2.694 | 0.250 → 0.250 | 0.250 → 0.250 |
  | NFL QB-RB-K | 2.556 → 2.444 | 2.556 → 2.556 | 0.292 → 0.278 | 0.292 → 0.292 |
  | NFL WR-TE | 2.125 → 2.111 | 2.125 → 2.125 | 0.222 → 0.222 | 0.222 → 0.222 |
  | Elite NBA / NFL | unchanged | unchanged | unchanged | unchanged |

  (NFL OL reads 2.514 → 2.500 in both builds: that is the in-pack no-repeat redraw changing the random sequence, one card in about 7,200, not the protection.)
- **The cost: thin NFL units repeat more.** The old downward step was what held NFL LB to 18% duplicates at 200 packs. Honest odds and few duplicates conflict on a thin unit: LB has 1,016 golds but only 433 of them 78+, against 1,200 draws (4 G75 + 2 G78 a pack). The fewest repeats any protection can reach without giving a card under the drawn overall (expected draws per overall, matched top-down to cards at that overall or above) is QB-RB-K 6.0%, WR-TE 6.0%, OL 16.2%, DL 21.4%, DB 35.0%, **LB 53.1%**; the protection measures 6.3 / 3.9 / 15.9 / 20.3 / 34.7 / 53.5%, i.e. at the floor. NBA positions have a floor of 0. The `pack-curve` test now holds NFL Units to max(35%, upward-only floor + 2 pt), like the Elite floor rule. **For the lead:** the alternatives are a smaller LB Unit pack, folding LB into a wider front-seven unit, or accepting it (200 LB packs is about 115,000 coins). Published odds win over the duplicate target here.
- **Acceptance wording (low, issues 2 and 3).** `packs-plan.md` §3 and the test list now say the 45 / 49 / 5 / 0.7 band split is per any-gold (G75) slot (the whole Gold pack reads about 42 / 52 / 5.5 / 0.6 because research's slot list puts a G78 in it; lead to confirm), and that NFL Elite's duplicate target is the pool's own floor + 1 pt (2,400 cards from about 1,850 golds 82+ must repeat at least 23%). No code change: the measured numbers in "packs-2" above already said so.
- **UT-CONTENT-2.md holo line (low).** It said 4% of pack specials come out holo; it now says 5%, only from slots that roll for their special, and never from a guaranteed Standout, program or Legend slot (`holoChanceOf`).
- **Preview Pack and Daily Drop reroll once at release (low, documented, no code).** A preview's cards are recomputed from its seed (`openPack('premium', 'preview-<seed>-<n>')`), not saved, and packs-2 changed the draw. So when this build ships, each player's current unbought preview shows different cards, once; today's Daily Drop contents change the same way. Nothing owned, saved or bought changes, and the next previews are stable again. Not worth a new saved field (`preview.curve`): advancing the preview would also show different cards. Listed under owner checks and for the release notes.

### Tests (`pack-curve` suite, all three sports, now 16)

- **"duplicate protection never lowers a published chance"**: Elite and every Position/Unit choice, 500 packs with paired seeds, with and without an accumulating owned set (counting from pack 150); for x = 82 … 88 the protected share of golds x+ is ≥ the fresh share − 0.05 pt.
- **"a club owning every 88 and 89"**: 40,000 paired G82 draws: the protected card is never below the fresh one, never an owned 88/89 while unowned 90+ exist, and 88+ comes at least as often; and a club owning every gold 84+ gets a duplicate at the drawn overall, never a lower card.
- Both new tests fail on the previous `unownedNear` (checked: "position:PG 82+: 23.52 < 23.95" and "protection stepped down: 88 -> 87") and pass now.
- The 200-pack duplicate test adds DB and uses the upward-only floor for NFL Units (above); in NBA it asserts SF and C have a floor under 0.5%.

### Browser QA

`scripts/packs/qa-odds.mjs` (the packs-3 harness: dev server on 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted, touch, `deviceScaleFactor: 1`, reduced motion), NBA at 393×852 (insets 59/34) and 320×568. The Position Pack and Elite Gold odds sheets both end "Golds in this pack prefer players you don’t own yet, at the overall drawn or higher, never lower, so these odds are the least you get." It wraps to two lines at 320 and stays inside the sheet above CLOSE. Shots: `O/shots/packs/packs-2-fixes/nba-{393,320}-{position-pack,elite-gold}-odds.png`. No page errors; the only host blocked was the Supabase registry.

### Owner device checks (packs-2 review fixes)

- After the update installs, the current Preview Pack shows different cards once (and today's Daily Drop, if unopened). Expected; nothing owned changes. Worth one line in the release notes.

## packs-4: odds engine and disclosure

Base `651b0cc` (the worktree was clean: no leftover work from the restart).

### What changed and why

- **`src/ut/odds.ts`: the one source of published numbers (owner decision 4, "clear odds sheets").** Every chance is computed from the definitions that fill real packs, with the same steps as the draws. New exact mirrors sit next to the draws in `packs.ts`: `goldDist` / `goldCardDist` (drawGold: curve overall → nearest overall the mix has → position by weight → card; the whole pool when the mix has nothing in range), `curveDist` (curvePick), `legacyGoldDist` (the registered Spotlight's pre-curve golds) and `tierBelow` (drawCard's empty-tier fall).
  - `oddsFor(pool, kind, at)` / `oddsTable(pool, def, ctx)`: "chance of at least one" by overall band (80, 82, 83, 84, 85, 86, 88+ on the sport's scale), by tier (special tiers always, bronze/silver/gold when not certain), the featured card (this week's Featured Standout, or a program's headliner) and holo; `perSlot`, `boosted` (`now`, `base`, `until`), `effectiveProgram` (null until packs-6's pity), generated `notes` and `updated` (the later of `ODDS_UPDATED` = 2026-11-16, the Weekly Standout week's Monday and a program's latest released wave). Kinds: every Store kind, `position` (a random choice: the mean of the choices, with "each position's own chances differ from these by at most N points") and `position:<key>`, `live:` / `live-plus:` (boosted inside a Friday boost), Club Collection kinds and `studio:` recipes, `preview`, `spotlight` (null in soccer). Memoised per (pool, kind, day/week, boost, Club Collection recipe).
  - Two pack effects the slot product alone gets wrong are counted: **two or more guaranteed Standouts in one pack** (a Club Collection Dynasty) are drawn without replacement (an exact recursion over the sets of Standouts drawn: fill never repeats a player and keeps the 6th draw); and **in-pack no-repeat redraws of golds** (first order: each card's chance × the chance it isn't taken yet, renormalised). The second moved a soccer Goalkeepers pack's 83+ from 22.18% to 22.24% (40,000 real packs: 22.54%).
  - `pickTable(pool, kind, at)`: Scout's Choice and the Swap Desk (NFL: the mean over the 7 position groups; the Standout option only when that group has an 84+ Standout), Front Office 80+, Player Picks 82+ / **84+**, Stamp Scout 85+, Standout Pick (hypergeometric: each Standout equally likely), Program Pick (the same `programPickSource` the award uses; a Player Pick 82+ when no program is live), `live-pick:<promo>:<n>`, the login calendar's gold pick, and the stamp shelf's items as `shelf:g82 | scout85 | standouts | program`. `hasPickOdds(kind)` says which saved picks have a table (all but the one-time Icon pick).
  - `rewardOdds(pool, reward, at)`: an SBC or objective reward (a gold on the curve from its floor, from its franchise when named; a Hot Season; a Weekly Standout; a program card; any pack it pays) as one table. `isRandomReward(w)`. ut's MINUTES, league and Rookie Week rewards pass `{ pack }` or a pick kind.
  - `dropSheet(sport, index)`: each tap's upgrade chance, the exact final odds (`dropOdds`, unchanged numbers) with each tier's reward in words, the EV and the honest-reveal note.
  - `routeCost` and `premiumChanceAtLeast` moved here from `value.ts` (re-exported there, so every caller keeps its import; same numbers).
  - `fmtPct(p)`: "less than 0.1%" under 0.1%, "100%" from 99.5%, one decimal under 10%, whole numbers above; `oneIn(p)` adds "1 in 150" under 1%. `confirmFor(price, prefs)` and `headline(table)` for the buy confirm.
- **`OddsSheet.tsx` + `odds-sheet.css` (lazy) replace the Store's old sheet.** A bottom sheet: header (what it is), a scrolling body (By overall, By edition with the featured row and holo, each a glass table row with a tier-coloured bar and "1 in N" under 1%; the BOOSTED banner; the generated notes; a PER CARD / PER OPTION toggle with the slot chips), and a footer that never scrolls: "Each pack is independent. Updated 16 Nov 2026." and CLOSE (44 px). `odds-lazy.tsx`: `LazyOddsSheet` (React.lazy; once the module is preloaded it renders with no Suspense round trip), `preloadOdds` / `useOddsPreload` (fetched in an idle moment after a screen's first paint) and `useOddsHost` (the open sheet's state lives in a tiny host, so opening a sheet never re-renders the whole Store). The Store also computes its tiles' sheets one per idle moment after it paints.
- **Where a sheet opens:** every Store tile's Odds (Spotlight, Bronze to Jumbo, Standout/Lightning, Club Collection, Scout's Choice as a pick table), flash-sale deals, program packs (boosted), the Daily Drop, every waiting pack and pick under Your packs (an ODDS chip under each tile; not the starter, admin awards or an event Spotlight), the Preview Pack, the buy confirm's VIEW ODDS, the pick sheet itself (ODDS by its title; it opens above the full-screen pick), the SBC sheet's reward line for a random reward, and the Pack Tracker's ODDS SHEET on each tracked pack. ut's Scout Drop screen and random rewards use the exported lazy sheet (contract below).
- **BuyConfirm (in `Store.tsx`)** for every Store purchase of 1,500 coins or more (tiles, program packs, flash deals; Spotlight too): pack art, price "of your N", the three most telling "at least one" rows from the sheet (the best band hit at least 1 in 20, the best at least 1 in 200, the rarest special), VIEW ODDS, CANCEL, BUY. "Don't ask again for packs under 10,000 coins" is a 44-px checkbox saved as `ut.content.prefs.skipBuyConfirm` through the Store's new `onPrefs`; from 10,000 coins it is never offered and never honoured ("Packs of 10,000 coins or more always ask first."). A purchase that can't go through (short of coins, at its limit) skips the confirm, so its own message explains why. The Preview Pack's BUY THESE does not ask (the player has already seen the exact cards).
- **Pack Tracker.** `expectedFor` reads the exact sheet (r86, r90, special) and the exact quick-sell value (`packEv` / `livePackEv`; the Position pack's mean over its choices; Spotlight from the registered draw) instead of simulating 160 packs on the phone; `Expected.packs` is 0 now. The footnote says expected rates are each pack's published odds, and "Values are counted when pulled: … an early Spotlight or GOAT pull still reads 30 coins" (`PullAgg.q` keeps pull-time quick-sell). The walkout-rule footnote waits for packs-9, which changes the rule.
- **Pack Helper (M8): RARE** on a rare gold (`pack-helper.ts`, `isRare`; a gold-foil tag in `pack-reveal.css`). Rare is the shimmer only, said on every sheet with golds.
- **Daily Drop (L2):** its line reads "A gold 38%, a Weekly Standout 2.0%." from its sheet, with an Odds link.
- **Refactors in our files:** `content-packs.ts` exports `NFL_GROUPS` and `programPickSource(pool, day)` (the Program Pick's promo and option list, now shared by `awardPick` and `pickTable`; the award's options are unchanged for the same seed).

### Numbers (before → after)

| Measure | Before (base `651b0cc`) | After |
|---|---|---|
| What a pack's sheet shows | per-slot tier chips; "in this pack" only for Standout / Hot Season / Legend | bands 80–88+, every tier, featured card, holo, per card, boost, generated notes, updated date |
| Sheets that exist | Store tiles and program packs only | + Daily Drop, waiting packs and picks, Preview, flash deals, buy confirm, pick sheet, SBC reward, tracker, Scout Drop (ut), shelf picks |
| Sheet vs 10,000 seeded opens (bands, tiers, featured / holo) | not tested | every sold item, Daily, Preview, Position/Unit choices, program pack boosted and not, a Program Guarantee, Club Collection defaults, Spotlight receipts: within ±1.5 pt / ±0.5 pt in NBA, NFL and soccer |
| Picks vs 10,000 option draws | not tested | every gold pick, Scout's / Swap, Standout, Program and live picks within ±1.5 pt; the login calendar's pick 4,000 draws within ±2.4 pt (3σ) |
| SBC rewards vs 10,000 `rewardCard` draws | not tested | every tier and floor of the 60-day catalogue (and a franchise reward) within ±1.5 pt |
| Spotlight tier rows | "20%", "0.05%" typed in a note | exactly `SPOTLIGHT_RATES` (0.2, 0.0005, 0.02) |
| `oddsTable` (warm, 1×) | n/a | 0.1–7.3 ms (worst: soccer Gold 7.3, NFL Silver 5.9) |
| Tile tap → visible sheet at 4× CPU (dev server, Playwright touch) | not measured | 29–95 ms in every sport at 393 and 320 (the first open of a session 68–94 ms) |
| Pack Tracker expectation | 160 simulated packs per type, 8–60 ms each at 1× | exact, 1–32 ms once the pool's caches exist |

Sample sheets (NBA): Premium Gold 82+ 80%, 83+ 35%, 85+ 9.3%, 88+ 4.3%, Legend 0.7% (1 in 150), Hot Season 2.0%, Standout 4.0%, featured Standout 0.4%, holo 0.3%. Jumbo Premium 86+ 10%, 88+ 5.7%. Player Pick 84+ (best of 3) 85+ 81%, 86+ 57%, 88+ 23%; Scout's Choice NFL 85+ 82%, 88+ 20%. Cup Contenders Pack inside its Friday boost: program card 45% (normally 30%).

### Tests (suite `odds`: `packs-suites/odds.ts`; `odds.test.ts` NBA/NFL, `soccer-odds.test.ts` soccer), 18 tests

- fmtPct and oneIn cases; every sold Store kind + Daily Drop + Club Collection defaults against 10,000 seeded opens; every Position/Unit choice (10,000 each) and the random-choice sheet is their mean; Preview = Premium; program pack boosted and not (10,000 each) and a guarantee (4,000, program 100%); Spotlight rows exact and 10,000 registered receipts (chase tier by the contract's `chaseTier`).
- Picks: gold picks, the shelf's items equal their picks, Scout's / Swap, Standout, Program, live and calendar picks.
- Rewards: every random SBC reward of the 60-day catalogue; a pack reward equals the pack's sheet; pack + card together; coins only is null; a program reward against `programReward`.
- Scout Drops: the sheet's final odds `toBe` `dropOdds` for drops 1–3, each tap's chance, each tier's reward listed.
- Route cost within 5% of the step-resolved Premium odds (`goldDist`); the tracker's expectations equal the sheet; every sheet ≤ 20 ms after warm-up; the confirm's thresholds (1,500; "Don't ask again" never at 10,000+, never honoured there); old saves: no `prefs` → the confirm asks; `prefs` survives today's normalizer, an older build drops only it.
- `content2.test.ts`: RARE marks a rare gold and nothing else (new test).
- **Changed old test:** `pull-tracker.test.ts` "compares with the published odds": `expectedFor` no longer takes a simulated pack count and returns `packs: 0`, because its numbers are exact now (the old 60/160-pack simulation was the behaviour this task replaces).
- Typecheck clean. NBA `vitest run src/ut src/admin src/engine/sport-branches.test.ts` 362 passed (15 skipped); NFL 360 passed (16 skipped); soccer `vitest run soccer sport-branches` 172 passed. Suite time per sport: NBA 56 s, soccer 45 s, **NFL 79 s** (over the plan's 60 s: its 24-card packs × 10,000; see "Left for later").

### Browser QA (packs-4)

`scripts/packs/qa-odds-sheets.mjs` (dev server 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted: the only host blocked was the Supabase registry; touch, `deviceScaleFactor: 1`; clock 2026-11-27 18:30 Eastern, inside the s2 Friday boost and the Black Friday flash sale). Runs: NBA 393 (reduced) and 320 (full), NFL 393 (full) and 320 (reduced), soccer 393 (reduced) and 320 (full). In each it opens, like a player: four Store tiles at 4× CPU (timed), the Premium sheet and PER CARD, the Daily Drop, a waiting Player Pick 84+ and a waiting Premium, the pick screen's own ODDS (checked on top of the pick screen), Scout's Choice, a boosted program pack, the Preview Pack, the buy confirm (Jumbo flash deal) and its VIEW ODDS, then CANCEL (coins unchanged), the Pack Tracker's footnote and a tracked pack's sheet, and an SBC's reward odds. Every sheet and the confirm: **0 controls under 44 design px, 0 texts under 10, no overflow, the footer always on screen, 0 page errors.** The only sub-10-px text is the decorative, `aria-hidden` pack-art label on the small pack art (waiting tiles, the confirm's art), which is packs-8's H3 label fix. Shots: `O/shots/packs/packs-4/<sport>-<width>-{store-top, premium-sheet, premium-percard, daily-sheet, pick84-sheet, waiting-premium-sheet, pick-screen-sheet, scout-sheet, program-sheet, buy-confirm, buy-confirm-odds, tracker-foot, sbc-reward-sheet}.png`.

### Saved state and older builds

| Field | Shape | If an older build strips it |
|---|---|---|
| `ut.content.prefs` | `{ skipBuyConfirm?: true }` | the buy confirm asks again (a preference only; harmless) |

No storage key, card or copy id, claim id, receipt or pack draw changed. `odds.ts` only reads definitions; no RNG is consumed.

### The odds contract for ut (V2.4 G, as shipped)

- Show a sheet: `import { LazyOddsSheet } from './odds-lazy'` and render `<LazyOddsSheet pool={pool} sport={SPORT} source={…} onClose={…} />` (optionally `useOddsPreload()` on the screen, or `useOddsHost(pool, sport)` for a long screen). Sources: `{ type: 'drop', index: 1 | 2 | 3 }` (Scout Drops: show it before the first tap; `pool` may be null), `{ type: 'reward', reward: { pack: 'silver' } }` (a MINUTES, league or Rookie Week pack, or any SBC-style `Reward`), `{ type: 'pick', kind: 'pick-84' }` (the 25-hour pick, Rookie Week's pick; also `'shelf:g82'` etc. for the stamp shelf), `{ type: 'pack', kind }`.
- Pure numbers: `dropSheet(sport, index)`, `rewardOdds(pool, reward, at)`, `pickTable(pool, kind, at)`, `oddsFor(pool, kind, at)`, `fmtPct(p)`, `isRandomReward(w)`, `hasPickOdds(kind)` from `odds.ts`.

### Protocol

None. Sheets, the confirm, the tracker's expectations and the RARE tag change no pack contents, prices, ratings or matches; `CONTENT_PRINT` and `pool.print` are unchanged.

### Touched outside my lane (packs-4)

- `src/ut/UltimateTeam.tsx` (ut), 2 added lines: `withPrefs` in the `content-state` import and `onPrefs={(prefs) => setUt((u) => withPrefs(u, prefs))}` on `<Store>`.

### Owner device checks (packs-4)

- The odds sheet reads well on the phone: the bars, "1 in 150", the notes, PER CARD, and the footer (CLOSE) always reachable with the thumb.
- The buy confirm on a Jumbo or Elite purchase, "Don't ask again" (it should stop asking under 10,000 coins and keep asking above), and that it never feels in the way on cheaper packs (under 1,500 coins it never shows).
- The RARE tag on a rare gold in a pack's reveal.

### Left for later (packs-4)

- packs-6: `effectiveProgram` (pity) on program sheets, and the stamp shelf page opening `shelf:<item>` sheets (the tables exist and are tested).
- packs-9: the tracker footnote "walkout counts before <date> used the old rule", once the walkout rule changes.
- packs-8: the pack-art label legibility (H3) on the small art the confirm and waiting tiles use.
- The NFL odds suite runs 79 s (the plan's budget is 60 s per sport); packs-10 can trim the calendar-pick draws or share openings with the exploits suite.
- Tap-to-sheet was measured on the dev server (unminified React); packs-10 re-measures on the production build.

## packs-3 review fixes (after the independent review of 8731f48..5defa22)

Fixed on top of packs-4. No storage key, card or copy id, claim id, receipt or saved field changes. Protocol: none (prices, limits, Store copy and module layout only; `CONTENT_PRINT` and `pool.print` unchanged, and the calendar's `version` is unchanged).

### What changed and why

- **Club Collection floor = the plan's floor (finding 1, high, audit H2).** packs-3 had priced a Standout at "the Standout Guarantee's price less its golds' quick-sell ÷ 0.6" (NBA 1,196, NFL 428, soccer 883), so NFL Dynasty sold two Standouts for 2,200 against an 1,800 Guarantee and a lone-Standout pack could go for 500 coins. `floorPrice` is now exactly the plan's: `standouts × CONTENT_PRICES.standout + (silver·QS + gold·QS + rare·QS) ÷ 0.6`, rounded up to 100 (`STUDIO_VALUE.standout` = the Guarantee price, pinned to `packDefs` by the suite). NFL Captains at 1,000 now clamps to 2,600 (≥ 1,800), and any recipe the editor can publish costs at least one Guarantee per Standout. The editor's line "A Weekly Standout never sells for less than the Standout Guarantee asks" is now true.
- **Deviation, reported: Captains and Dynasty are chase items.** Under this floor a pack holding a Standout can't also return 0.45–0.60. In band it would need `0.25 × gold value ≥ standouts × (0.45 × Guarantee − Standout quick-sell)`: per Standout about 23 extra golds in NBA, 33 in soccer and 47 in NFL, while a recipe holds at most 40 cards. So the floor wins (no weaker floor), and the defaults sit exactly on it. Roster Builder (no Standout) stays in the band. `NOMINAL_PRICE` follows.

  | Pack | NBA | NFL | Soccer |
  |---|---|---|---|
  | Captains, price / EV ÷ price | 2,500 / 0.50 → **4,300 / 0.29** | 1,200 / 0.51 → **2,600 / 0.235** | 1,700 / 0.47 → **3,200 / 0.25** |
  | Dynasty | 4,800 / 0.49 → **8,400 / 0.28** | 2,200 / 0.51 → **4,900 / 0.227** | 3,200 / 0.47 → **6,200 / 0.244** |
  | Coins per guaranteed Standout (Captains / Dynasty) vs the Guarantee | 2,500 / 2,400 vs 3,000 → 4,300 / 4,200 | 1,200 / 1,100 vs 1,800 → 2,600 / 2,450 | 1,700 / 1,600 vs 2,400 → 3,200 / 3,100 |
  | Roster Builder (unchanged) | 1,700 / 0.58 | 1,100 / 0.58 | 1,100 / 0.56 |

  (10,000 simulated packs each, week 2026-W46, `O/packs-out/after-packs-3-fixes/`.) The chase test holds them to ≥ 0.2, like the Program Guarantee. **For the lead / packs-6:** if the owner would rather keep Captains and Dynasty value packs, the alternative is to drop their Standout (they would then be gold bundles in band); that changes what the owner's catalog sells, so it is the owner's call, not ours.
- **Club Collection limits are shown (finding 2, medium).** The Store renders Roster / Captains / Dynasty with `limitNote` and the `limit` disabled state, like Elite and Jumbo: "2 of 2 left today", "1 of 1 left today", "1 of 1 left this week", then "Limit reached today" and a dimmed BUY.
- **Scout's Choice is priced by route cost (finding 3, medium; owner decision 4).** Re-measured (3,000 picks, best option kept, quick-sell ÷ price): NBA 0.46, NFL 0.40, soccer 0.32, while the kept card is a gold 84+ worth `routeCost(84)` = 13,022 / 4,570 / 8,413, so it was the cheapest 84+ in the game. Repricing into the quick-sell band (NFL 200, soccer 300) would have made that worse, so it is a declared chase item: price ≥ ¼ × `routeCost(84)`, the Market's own share. NBA 650 → **3,300**, NFL 250 → **1,200**, soccer 500 → **2,150** (route share 0.253 / 0.263 / 0.256; quick-sell 0.09 / 0.085 / 0.075). Limit unchanged (3 a week). A flash sale may go 20% under the chase floor (the band's 0.60 → 0.75), so the four calendar offers `scout-choice@-30%` became `@-20%` (none has run yet: the first is Black Friday 2026-11-27): NBA 2,650, NFL 950 (0.204 / 0.208 of route). Its flash deal is now tested instead of skipped. Stamps follow the coins paid, as before (a Store Scout's Choice earns 33 / 12 / 21 stamps).
- **A Club Collection buy opens its frozen recipe again (finding 4).** `buyLimited(kind, price, openKind = kind)` records the limit under `captains` but opens (and logs, and names) the `studio:captains:<counts>:<name>` snapshot `buy()` built. The Pack Tracker groups it with older `studio:` entries, and `expectedFor` reads the frozen recipe.
- **A flash-sale Scout's Choice is logged at its sale price (finding 5).** Its pick id is `scout:flash:<price>:<uuid>`; `pickMeta` reads the price from it (any other `scout:` id keeps the Store price). An id, not a new PickState field, so an older build that keeps only known fields still logs a price.
- **NFL Silver Upgrade can be done with silvers (finding 6).** "Eight silvers or better, team 80+" needed golds (a silver is at most 74). It is now "Eleven silvers or better, each 74+" (11 cards is the most any challenge takes). Value out ÷ in is **1.52**, above the 1.1–1.3 band, because eleven 74 silvers are worth 660 coins against the Gold pack's 1,000: no silver-only challenge can reach the band. Accepted and tested as the one exception (NFL ≤ 1.55), with a new check that every sport's Silver Upgrade and Silver to Gold are cheapest with silvers alone. NFL's Gold Upgrade (nine 82+ golds for a Premium) is value-correct but card-count heavy: **packs-6** should revisit how D10 values NFL golds under 83 (2 × quick-sell).
- **First-paint bundle (finding 8).** `sbcValue` moved from `sbc.ts` to `value.ts`, so `sbc.ts` no longer imports the coin model. The Lightning windows and the Eastern clock moved to `lightning.ts` (content-packs needs only those), and the Friday boost to `boost.ts` (live-packs needs only that); `flash.ts` re-exports both, so every other import is unchanged. Measured on the static import graph from `src/main.tsx`: `value.ts`, `odds.ts` and `flash.ts` are no longer reached at first paint (they were, through `profile.ts → new-era.ts → content-packs.ts → sbc.ts / flash.ts`); `lightning.ts` (102 lines) and `boost.ts` (49 lines) are.
- **Market copy (finding 9).** The lede says "usually one of them an 83–86" (the scouted card falls back to a gold ≤ 82 on a few days).

### Findings left as they are (with reasons)

- **Program Guarantee 0.23–0.32 (finding 7).** Unchanged and already listed for packs-6 below. The chase test keeps ≥ 0.2; the lead decides between one more 82+ gold in the guarantee and accepting 0.23.
- **PackArt small labels at 5.5 design px in the flash block (finding 9).** Left to packs-8's label-legibility task, as planned; the FLASH SALE block (5 more small arts) is added to that task's checklist below.

### Tests

- `exploits` suite, now 23 tests per sport: the tier values pinned (Standout = the Guarantee's price); every default and every editor recipe with 1–3 Standouts costs ≥ the Guarantee per Standout; NFL Captains 1,000 → ≥ 1,800 (2,600); the defaults sit on their floor, Roster in band, Captains/Dynasty chase (≥ 0.2, < 0.45); Scout's Choice ≥ ¼ route cost and < route cost, its 3,000 kept cards all 84+ golds or Standouts, a −20% sale ≥ 0.2 route and −30% under it; every flash Scout's Choice deal of the year ≥ 0.2 route (no longer skipped); NFL Silver Upgrade ≤ 1.55 and both silver challenges cheapest with silvers.
- Changed old tests: `content2.test.ts` and `economy.test.ts` list Captains and Dynasty with the chase items (0.2 floor) instead of the 0.43 / 0.3 pack floors; `sbc.test.ts` imports `sbcValue` from `value.ts`.
- Typecheck clean. NBA `vitest run src/ut src/admin src/engine/sport-branches.test.ts` 365 passed; NFL 363 passed; soccer `vitest run soccer sport-branches` 175 passed.

### Browser QA

`scripts/packs/qa-fixes-3.mjs`: dev server on 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted (the only host blocked was the Supabase registry), touch, `deviceScaleFactor: 1`, clock at Black Friday 2026-11-27 18:30 Eastern. NBA 393 (reduced motion), NFL 320 (full motion), soccer 320. Shots: `O/shots/packs/packs-3-fixes/*-club-before.png`, `*-club-after.png`, `*-flash-scout.png`.
- Club Collection before: "2 of 2 left today", "1 of 1 left today", "1 of 1 left this week" at 1,700 / 4,300 / 8,400 (NFL 1,100 / 2,600 / 4,900; soccer 1,100 / 3,200 / 6,200).
- Buying Captains charged 4,300 (NFL 2,600, soccer 3,200), logged `studio:captains:0,3,2,1:Captains%20Pack/store/4300` (NFL `…0,6,2,1…`) and saved `captains:2026-11-27`. The tile then read "Limit reached today" with `aria-disabled` BUY; a second tap gave "You've reached this pack's limit. It resets tomorrow." and charged nothing.
- Flash Scout's Choice: "3,300 −20% … 2,650" (NFL 1,200 → 950). Kept a card; paid 2,650 (NFL 950) and the tracker logged `scout/store/2650` (`…/950`).
- No page errors.

### Touched outside my lane (packs-3 review fixes)

- `src/ut/UltimateTeam.tsx` (ut), 16 added and 7 removed lines: `buyLimited`'s `openKind` parameter (its `openNow` kind and name) and the `buy()` call passing `kind`; the flash Scout's Choice id `scout:flash:<price>:<uuid>`; `flashPickPrice` and its use in `pickMeta`.

### Owner device checks (packs-3 review fixes)

- The new Club Collection prices (NBA Captains 4,300, Dynasty 8,400) and Scout's Choice (NBA 3,300) feel right for what they guarantee, and the "Limit reached today" line reads clearly.

### Left for later (packs-3 review fixes)

- packs-6: the Program Guarantee's 0.23 (above); how D10 values NFL golds under 83 (the NFL upgrades are value-correct but card-count heavy); whether Captains/Dynasty stay chase items.
- packs-8: add the FLASH SALE block's small PackArt labels (5 instances, 5.5 design px) to the label-legibility checklist.

## Requests (answers are recorded here as they arrive)

- **Lead:** assign `src/ut/ut-scale.ts` (its promo/legend knots), `scripts/fit_ut_scale.ts` and `scripts/fit_ut_balance.ts` to packs for packs-5. OWNERSHIP gives them to nobody; without the assignment packs-5 uses the rate.ts-only fallback. *Answer: pending.*
- **Lead:** `STAMPS_FROM` (scout-stamps.ts) is the release instant, midnight Eastern on 2026-11-27, the planned `SHIP_DATE`. If the ship date moves, move it with `SHIP_DATE` (packs-7's release check covers both). *Answer: pending.*
- **ut:**
  - the Circuit 6-0 Spotlight pack (`circuit.ts:11`) and the Season Pass level-25 Spotlight pack (`progression.ts:183`) become Program Picks (`awardPick(…, 'program-pick', <claim id>, at)`), as research §8.7/§8.9 specify. packs-6 prices the Spotlight only after this answer. *Answer: pending.*
  - new UT state goes under `ut.hq`, or ask us to add it to `ContentState` (one normalizer, nothing silently dropped);
  - the D12 modal order for the later promo takeover (your `ut-modal-queue.ts` slot 2 matches);
  - wire `storeBadge(pool, ut, at).n` onto the Store tab and `setAppBadge`;
  - `labels.ts` names for "Hot Season", "Weekly Standouts" / "Matchday Standouts", "Program" and "Scout Stamps";
  - **[V2] the 30-minute MINUTES rung:** `grantStamps(ut, STAMP_GRANT.minutes30, 'minutes', 'day:' + day + ':30')` in the sport the player is in when they claim (commit B ships it).
  - **[V2] Scout Drops:** seed as V2.4 E (`'scout-drop:' + playerKey + ':' + sport + ':' + day + ':' + index`); stamps from a drop through `grantStamps(ut, STAMP_GRANT.drop, 'drop', day + ':' + index)`; a pack from a drop as a pending pack whose id starts `scout-drop:` (drop 1 keeps `daily-bonus:<day>`), so it earns no pack stamps.
  - **[V2] Era Nights** are hosted by your Events from `eraNights(...)` (packs-7), solo only.
  - **[V2]** `packsClaimables` body: commit B ships it in `src/ut/packs-claimables.ts` with your published shape. Keep the shape and the file at merge; your stub and ours are identical in signature.
- **shell:** define `--ut-sticky-top` from the header height (our sticky chips use it). SKIP's target size stays yours; TAP TO CONTINUE, QUICK SELL DUPES and every new pack-screen button are ours, so no rule is duplicated.
- **players:** an edit to `supportOverall` in `card-face.ts` changes attributes matches use, so it means "Protocol bump needed". **[V2]** Please confirm the D15 walkout slot props `{ rc, size, maxMs: 2000, onDone, reduced }`, no text inside the figure, at most 3 a pack. *Answer: pending.*
- **nba / nfl:** packs-5 changes Hot Season, Legend, Spotlight and GOAT played attributes. The exact per-position deltas will follow here.
- **All teams:** the stricter `sport-branches` regex flags any `nba(x) ? a : b` helper ternary at merge.

## Tests

- `src/ut/packs-suites/packs-economy.ts`, run by `packs-economy.test.ts` (NBA, NFL) and `soccer-packs-economy.test.ts` (soccer): 18 tests. Quick-sell strictly rising between tier ranks at min/median/max, levels 1 and 5; Spotlight ≥ 4,000·qs and GOAT ≥ 6,000·qs; only Spotlight, GOAT and Standout quick-sell moved against the fixture; auto-fill never trades a special, numbered or locked card over 28 days of SBCs and every SBC the plain cards fill still fills; reward values and protection reasons; the confirm's warning text; each sport's SBC positions over 60 days and every position template fillable; the fixture self-check (`FOREIGN_FINGERPRINT` first, then nothing moved but the deliberate changes; the 60-day NBA/NFL SBC catalogue, the 11 started calendar entries, the 20 receipts and the numbered catalogs equal); D9; the promo-hub and pick contracts (pick-84 refuses); the frozen older normalizer reads every field it knew exactly as today's.
- `src/engine/sport-branches.test.ts`: the helper-ternary pattern and its self-test.
- `packs.test.ts`: an unknown position choice throws `UNKNOWN_PACK` (its old behaviour, an empty pack that spent the pending entry, was the D9 bug). `sbc.test.ts`: two auto-fill cases used a 1-coin dummy reward; with value protection that would protect every card, so they use a Gold pack reward (the cases test ordering, not value).

## Browser QA (packs-1)

`scripts/packs/qa-sbc.mjs` (dev server on 5213, `?ns=inspect&relay=ws://localhost:7777`, every non-localhost request aborted: the only host blocked was the Supabase registry, so nothing reached a live service; touch, `deviceScaleFactor: 1`, reduced motion; 393×852 with insets 59/34 and 320×568). Shots in `O/shots/packs/packs-1/`:
- `nba-393-sbc-confirm.png`, `nba-320-sbc-confirm.png`, `soccer-393-sbc-confirm.png`, `soccer-320-sbc-confirm.png`: Bronze Upgrade auto-filled, then a Legend put in by hand. The confirm reads "These 5 cards are removed permanently", one red row ("Michael Jordan 92 · Legend edition · 92 overall · sells for 2,950 coins, more than the reward"; soccer Pelé 97), and TRADE IN ANYWAY. Buttons 155×48 design px. No page errors.
- `soccer-393-sbc-list.png`, `soccer-393-sbc-sheet.png` (Kickabout), `soccer-320-sbc-sheet.png` (Back Four: "One each: FB CB CB FB"). That day's soccer list: Kickabout, Back Four and Gold Spine; no football position anywhere.

## Protocol

**None** for packs-1 (commits A and B). Quick-sell, auto-fill, the confirm, soccer SBC templates and Scout Stamps are economy and presentation. No ratings a match reads changed, and `CONTENT_PRINT` is unchanged.

## Touched outside my lane

- `src/ut/UltimateTeam.tsx` (ut): `openNow` wraps `openPack` in try/catch and returns with a toast before its state update (D9), 8 lines.
- `scripts/build_numbered_catalog.ts` (no owner; numbered cards are ours): a read-only `--check` flag. Without it the script behaves exactly as before.
- `src/ut/packs-claimables.ts`: ut owns the file's existence and shape, packs its body (ut plan §4 H). Ours is created here with ut's published signature; at merge keep one file with this body.

## Owner device checks

- The SBC trade-in confirm with the red warning rows and TRADE IN ANYWAY: readable and tappable on the phone.
- Soccer Back Four and Front Three SBCs read naturally.

## Left for later tasks

- packs-2 onward per the plan. Auto-fill on a soccer club of several thousand cards spends seconds on Rival Dynasties (two franchise requirements): its 160 franchise tries repeat the same swap search. Real clubs hold far fewer cards; packs-8 (the SBC page) trims the tries.
