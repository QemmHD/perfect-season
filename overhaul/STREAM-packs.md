# Team packs: pack economy, real odds, promos, pack opening, Store and SBC screens

Worktree `/home/user/ps-s-packs`, branch `claude/studio-packs`, port 5213. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` first.

## Why

The owner says: "fix packs to make them more how real packs work for odds and for promos … people wanna do challenges to get more … attract dopamine … make cards appeal to the eye … make stats more accurate". Coins only, never real money.

## Sources

- **`O/audit-packs-promos.md`.** Read all of it. It has:
  - measured odds and values from 10,000 seeded packs per type and sport
  - Critical, High, Medium and Low findings
  - the promo audit and the economy section
  - the comparison with real UT
  - what to preserve
  - a fix order
  - Its scripts are in `O/audit-scripts/` (`packsim.ts`, `promos.ts`, `promoattrs*.ts`, `autofill.ts`, output in `out/`). Reuse them to measure before and after.
- **`O/research-ultimate-team.md`.** Read all of it. Above all:
  - §8.1, the per-OVR gold curve
  - §8.2, odds sheets and computed tables
  - pack tiers (Headliners, Franchise Vault)
  - the Friday odds boost
  - holo chance
  - Scout Stamps and the Program Bag
  - the 13th-pack program guarantee
  - promo cadence and rating caps by calendar season
  - Momentum cards
  - the three cinema levels of pack reveal
  - §8.5, soccer's Matchday Standouts and its program names
  - The calculator is `O/calc/odds.py`.
- **`O/audit-ut-ui.md`:** M2 (pack-opening result management), H7 (walls of 110s on GOAT/top cards; the face design belongs to players, but the attribute generation lives in specials and card-stats, which are yours), and the pack screens in §4.
- **Existing docs:** `docs/PACK-CINEMA.md`, `docs/PULL-TRACKER.md`, `docs/CARD-CIRCULATION.md`, `docs/UT-CONTENT-2.md`, `docs/UT-CONTENT-UPDATE.md`, `docs/RATINGS-AUDIT.md`, `docs/GAMEPLAY-RATINGS.md`.

## Scope

### P0: critical economy bugs

1. **Spotlight (100–105) and GOAT (106–110) cards sell for 30/10 coins** (`packs.ts:504-517`), and SBC auto-fill uses them as fodder.
   - Fix the sell value.
   - Make auto-fill never pick special or high-value cards.
   - Add a confirm-screen warning whenever a card worth more than the reward is submitted.
   - Add tests for all three.
2. **The Scout Market sells two 94–97 Hot Season cards a day** for about 2,000 coins (`market.ts:27-33`). Reprice them, or restrict them to base/rare stock, so the chase isn't over in two weeks.
3. **Fix rarity running backwards against rating:**
   - Hot Season is a permanent cheap pool.
   - Legends are the rarest.
   - A 3,500-coin Spotlight pack gives a 100+ card 20% of the time.
   - Higher-rated special tiers must be rarer and cost more; the year's finale must outrank a routine pack.
4. **Hot Season cards show numbers the match doesn't use** (a card face shows THP 99 while the match uses 79).
   - Make shown and used agree. Preferably the match uses the card's own ratings.
   - That changes match ratings, so record "Protocol bump needed: NBA/NFL UT".
   - Coordinate the engine side through your doc only; don't edit the engines.
5. **Exploits and pricing:**
   - Close the Preview Pack exploit.
   - Stop admin store packs undercutting the weekly Standout guarantee.
   - Fix live program packs costing almost the same as their guarantee packs.
6. **Soccer shows NFL-position SBCs** ("Pass Catchers: WR WR TE", "Skill Set").
   - Fix them.
   - Extend `src/engine/sport-branches.test.ts` so the `nba(c) ? … : …` pattern behind this bug is caught (keep the test's spirit).

### P0: real-pack odds and transparency

- **Gold OVR curve.** Golds land about 94% in a flat 75–82 band, and 83+ is a real hit.
  - Use a per-OVR curve: pick an OVR, then a card at that OVR.
  - Measure before/after with `packsim.ts` for every pack type and sport.
- **Guarantees as OVR floors and slot lists** ("3 golds, one 78+"). "Rare" means the shimmer only.
- **Odds sheets everywhere.**
  - "Chance of at least one" per OVR band, tier and holo, with a timestamp.
  - Fix the wrong Scout's Choice sheet.
  - Every pack shows a View Odds sheet before purchase.
  - The numbers must be computed from the actual pack definitions, and a test must prove the sheet matches simulation within tolerance.
- **Bad-luck protection:**
  - Scout Stamps (1 per 100 coins of packs; never expire; spend on 82+ picks or Scout's Choice).
  - A guaranteed program card on the 13th program pack.
  - Optionally a Program Bag of visible prizes per wave.
  - All saved state is additive.

### P1: promos like a live service

- **Promo cadence:** two Friday waves a week apart, plus weekly in-forms.
  - Each wave gets a launch moment (banner, takeover, countdown) and a Program Hub page: featured cards, packs, SBCs and objectives, with countdowns.
  - Hook into the ut team's hub through a small exported API: "what's live now / upcoming". Write the contract in your doc.
- **Fix promo presentation:**
  - A program card's walkout must not say "PROGRAM".
  - The reveal headline must count the whole pack properly, not just golds.
  - An 82 Weekly Standout must not get a full walkout.
- **Promo sets.** Ratings should spread within a promo, and stop repeating the same player across 8 editions (MJ '88). Cap promo ratings by calendar season so they climb across the year (≈93–94 → 97 → 99 at the finale; Spotlight/GOAT stay above).
  - Existing owned cards keep their ids. If an owned card's displayed rating changes, document it.
  - The owner decided: re-rate accurately, owned cards included, even when one drops. Keep ids, and document every change to a displayed overall.
- **H7, walls of 110s.** GOAT/top cards show every attribute as 110 (Brady: THP/SAC/MAC/DAC/TUP 110). Generate special attributes that keep the player's real shape: boost real strengths most and keep weaknesses visibly weaker.
  - If ratings used in matches change, record "Protocol bump needed".
- **Live Calendar.** Finish the half-built parts: check-in stamps, Season Path, extra pass tiers, surprise flash windows.
- **Soccer gets a calendar:** Matchday Standouts (11 cards weekly) and original program names, from research §8.5.

### P1: pack opening that hits

- **Three cinema levels** (best card under 80: about 1.2 s; 80–84: about 2.6 s; 85+ or any promo: about 4.2 s), plus GOAT.
  - The tier colour shows in the first second.
  - Two specials show two flares.
  - The best card comes last in small packs.
  - Cues never over-promise.
  - Skip and Open-all always work.
  - Reduced motion is respected.
- **Multiple walkouts.** When there is more than one top card, each gets a walkout.
- **M2: management after opening.** Per-card actions (Send to Club, Quick Sell with value, Store, View), "Store all duplicates", "Quick sell all under X", and a total value. The headline counts all tiers.
- **Long pages (M4) for Store and SBC:** sections, sticky chips, a featured hero pack with art, SBC reward card faces shown, and "1 card away" states.

## Notes

- **Card face art belongs to players** (CardArt.tsx). Pack opening uses CardArt, so it gets their new faces at merge. Don't edit CardArt.
- **Coins only.** No real-money language anywhere ("buy" means coins).
- **Saves.** Never remove a card a player owns, change ids, or reset pull logs, trackers or stamps. All new state is additive.
- **Protocol.** Pack and economy changes need no bump. Ratings used in matches do: record them.
- **Owner device checks:** the pack-opening feel and length, and readable odds sheets.

## Owner decisions

Read the "OWNER DECISIONS (2026-11-09)" section at the end of BRIEF.md. It is binding and overrides this brief where they differ.
