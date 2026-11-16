# Team packs: team doc

Team **packs** (pack economy, odds, promos, pack opening, the Store and SBC screens). Branch `claude/studio-packs`, worktree `/home/user/ps-s-packs`. Plan: `docs/studio-overhaul/packs-plan.md` (revision 3, Game Design V2). `O` means the overhaul scratch folder named in BUILD-RULES.md.

## Status

| Task | State | Commits |
|---|---|---|
| packs-1 A: baselines, contracts, critical fixes | done | see `git log` (subject "packs-1 commit A") |
| packs-1 B: the Scout Stamp core and V2 hand-off contracts | done | see `git log` (subject "packs-1 commit B") |
| packs-2 … packs-10 | not started | |

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

**D. `src/ut/content-packs.ts` picks (packs-1 A; curve in packs-2).** `awardPick(ut, pool, kind, id, at): UtState`, with `kind: 'front-office' | 'pick-82' | 'pick-84' | 'program-pick'`. **[V2]** `'pick-84'` = 1 of 3 different golds, 84+, on the G84 curve, with no special: the 25-hour MINUTES milestone and the Rookie Week day-7 pick. Exactly once per `id` (the caller's claim id, for example `minutes:life:25h`). The pick sheet opens through the existing pending-pick path.

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
