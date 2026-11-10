# Ultimate Team research: economy, packs, promos, progression, retention and UI

Track: Ultimate Team modes. Research agent output, 2026-11-09. No repo files were edited.

Reference games: EA SPORTS FC Ultimate Team (FC 26 and the current FC 27, console/PC) and FC Mobile; Madden Ultimate Team (Madden 26/27) and Madden NFL Mobile; NBA 2K MyTEAM (2K25 to 2K27) and NBA 2K Mobile; Pokémon TCG Pocket, Marvel Snap and Clash Royale for reward-loop pacing.

Everything in section 8 is written for Perfect Season's own names and code. It uses mechanics only and copies no brand names, art or audio.

---

## 0. The short version (what to build)

1. **Draw golds from an OVR-band curve, not a pure exponential.** In real Ultimate Team packs, about 94% of golds land in a fairly flat 75–82 band, and there is a cliff at 83+. A standard gold card is 83+ about 5.8% of the time, 85+ about 1.0% and 88+ about 0.2% (FC 27 tracker data, §2.1). Today our `weighted()` makes every point above the floor about 30% rarer. That produces too much 75–77 filler and has no recognisable "cliff". §8.1 gives a drop-in per-OVR curve.
2. **Express pack guarantees as OVR floors and slot lists**, the way FC 27 and Madden do: "3 golds, one 78+", "1 player 84+". FC 27 dropped the Common/Rare base labels from guarantees ([EA FC 27 deep dive](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-fut-deep-dive)). Show every pack's odds as "minimum chance of at least one", with a timestamp, in EA's format ([EA pack probabilities](https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities)). §8.2 has computed tables for all three sports.
3. **Add a transparent bad-luck system** with three parts. Scout Stamps work like Pokémon TCG Pocket's pack points ([pocketcards.net](https://pocketcards.net/pull-rates)). A Program Bag of 4 visible prizes uses Marvel Snap's 25%, 33%, 50%, 100% escalation ([snap.fan dev Q&A](https://snap.fan/news/dev-qa-new-card-acquisition-system/)). A hard pity on program packs guarantees a program card on the 13th pack, in the spirit of FC Mobile's 70-pull draft pity ([BlueStacks TOTS guide](https://www.bluestacks.com/blog/game-guides/fifa-mobile-football/ffs-team-of-the-season-event-en.html)).
4. **Fix the promo rhythm.** Programs drop on Fridays in two waves a week apart, which matches FUT's "Team 1 / Team 2" structure ([RealSport101](https://realsport101.com/article/fc-26-promo-schedule-all-upcoming-campaigns-before-fc-27)). Weekly in-forms drop mid-week (TOTW goes live on Wednesdays). Boosted-odds windows are labelled and timed. Each promo gets one Campaign Hub page listing its packs, SBCs, objectives, evolution and event, as FC 27 does.
5. **Add a power-curve cap per calendar season**, so promos climb through the year: about 93 at launch, 96 by the midseason honours, 99 at the finale. Keep Spotlight and GOAT as the ultra-chase above 99. FC 26 and FC 27 both cut upgrade sizes so cards "stay playable longer" ([mein-mmo on FC 26 Pitch Notes](https://mein-mmo.de/en/ea-fc-26-pitch-notes-reveal-dozens-of-new-features-the-most-important-changes-at-a-glance,1525844/)).
6. **Give soccer a Live Calendar.** Today soccer has none (`calendar.ts` returns null), so it has no promos, program packs or season SBCs. §8.5 gives a soccer cadence.
7. **Rebuild objectives in five layers.** Daily (3, done in about 3 matches, like Clash Royale's daily tasks), weekly (6, with 4/6 and 6/6 chests), program (per promo wave, a group that awards a free promo card), card-attached (Madden 27 and 2K27 style), and Rivals Bounties (FC 26). Show objective chips on every mode tile and during matches, as FC 26 and Madden 26 do.
8. **Repace the Season Pass** to 30 levels × 1,000 SP, with level 1 granted on day 1 (endowed progress: 34% vs 19% completion in Nunes & Drèze). Show the level-30 card as the banner from day 1 (goal gradient). Add overflow Gold Packs after level 30. A casual player finishes in about 24 of 28 days and an engaged player in about 13.
9. **Pay something for every competitive win.** FC 26 Champions moved to a reward for every win plus milestones at 12 and 14 wins. Rivals pays weekly at 5 and 10 wins. Gauntlets have no elimination.
10. **Make the pack reveal truthful and tiered**, with three cinema levels plus GOAT. FUT gives no animation below the 81–85 "boards" tier and a walkout from 86+. Colour cues show in the first second. The rare-pull light and sound cues come from TCG Pocket. A cue must never promise more than the pack contains (no fake near-misses). Skip must always work.
11. **Build the hub around one "Next best action" hero.** Below it go a Live Now carousel with countdowns, then tiles carrying objective chips. Badges appear only for claimable items, and an amber clock marks anything due within 24 hours. Every match ends on an End-of-Match rewards screen with animated progress bars and one "What's next" button.
12. **Keep it coins-only and humane.** Show odds everywhere and give every streak a weekly shield. Never fake an escalation. Make every timed window repeat. Pity and batch pulls should help the player, never pressure them. Make "you're done for today" states explicit.

---

## 1. Sources, versions and limits

- **Current titles at the time of writing (Nov 2026):**
  - FC 27 launched in September 2026. EA's deep dive gives 18 September; a store page lists 25 September. Its FUT deep dive was published in August 2026 ([EA](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-fut-deep-dive), [VGC](https://www.videogameschronicle.com/news/ea-sports-fc-27-ultimate-team-changes-explained-simplified-sbcs-fut-gallery-holographic-items-and-more/)).
  - Madden 27 early access opened 6 August 2026 ([EA Madden 27 deep dive](https://www.ea.com/en/games/madden-nfl/madden-nfl-27/news/madden-27-ultimate-team)).
  - NBA 2K27 MyTEAM launched in late August 2026 ([games.gg](https://games.gg/nba-2k27/guides/nba-2k27-myteam-complete-guide/)).
- **Pack-odds figures** come from three kinds of source:
  - EA's official explainers, which describe the format but give only illustrative numbers.
  - Community trackers that mirror the in-game probability screens: [futmind](https://futmind.com) for FC 27 packs.
  - Older full disclosures: the Madden 20 store table and the FIFA 23 store table.
- **Treat these as shape references, not current live values.** EA itself says odds change with every content update ([EA](https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities)).
- **Limits of this research:**
  - Several sites refused automated reads (HTTP 403): futbin/futnext, the 2K site, marvelsnapzone, RoyaleAPI, fifplay and Sportskeeda.
  - The session's shared web-search budget (200 searches) ran out before Marvel Snap's season-pass details and a few Clash Royale chest specifics could be checked.
  - Where a number is from memory or a single secondary source, the text says so.

---

## 2. Pack odds: what the reference games publish

### 2.1 EA FC Ultimate Team (console/PC)

**How odds are shown and computed** ([EA, "Ultimate Team Probabilities"](https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities)):
- Every store pack has a "Show Pack Probabilities" screen. Items are grouped by player type and OVR band, with club items in a separate group (shown from FC 25 onward).
- Each figure is the **minimum probability of getting one or more items** in that band. A 100% row is the guarantee. One item can count in several rows.
- EA's illustrative example: Gold 75+ Player **100%**, Gold 82+ **18%**, Gold 84+ **4.2%**.
- Odds are **per pack, not cumulative**: "each pack opening is an independent event". EA computes them by simulating "a very large number of packs" and re-runs the simulation with every content update. The screen carries a timestamp.
- Because pools are large, the chance of any one named player is "significantly less than the displayed probability … often less than 1%".
- Packs that show gold odds "may occasionally grant" active Team of the Week, Hero, Icon or Campaign items.
- **FC 27 Holographic variants:** every randomly awarded item other than base Bronze, Silver and Gold has an approximate **5%** chance to be a Holographic variant. Guaranteed items are not eligible.
  - Items ≤87 OVR get **Regular Holo** (animated foil). Items 88+ get **Pristine Holo** (premium look, stylised name).
  - Holo changes no gameplay stats, but adds more to Gallery and SBC scores.

**What real gold packs look like inside** (FC 27, tracker mirrors of the in-game screen, [futmind](https://futmind.com/pack/301/premium-gold-pack)):

| OVR | Large Gold Pack (12 items, 7,500 coins) | Gold Pack (9 items) |
|---|---|---|
| 75 | 4.56% | 4.94% |
| 76 | 5.02% | 6.92% |
| 77 | 6.71% | 6.82% |
| 78 | 13.46% | 13.39% |
| 79 | 15.29% | 15.33% |
| 80 | 17.67% | 17.31% |
| 81 | 16.22% | 17.57% |
| 82 | 15.28% | 17.72% |
| 83 | 3.40% | 0 (capped at 82) |
| 84 | 1.38% | – |
| 85 | 0.43% | – |
| 86 | 0.22% | – |
| 87 | 0.16% | – |
| 88 | 0.15% | – |
| 89 | 0.034% | – |
| 90 | 0.011% | – |

Rarity rows (Large Gold Pack): Common **99.86%**, Team of the Week **0.128%**, Base Icon **0.0063%**, Hero **0.0031%**.

Item types: players are only **27.4%** of items. The rest is vanity 25.3%, training 20.6%, kits 10.7% and so on. The guarantee is "≥3 players, 2 rated 75–82".

**The key shape:** the 75–82 band is flat-to-rising and holds about 94% of golds. Then there is a cliff: 83 is 3.4%, 84 is 1.4%, and 85+ is about 1% in total.

**Higher packs** ([futmind 84+ pack](https://futmind.com/pack/1030/84+-rare-gold-player-pack), [futmind Jumbo Premium](https://futmind.com/pack/6303/jumbo-premium-gold-pack)):
- An **84+ player pack** (one card) skews strongly to 84. Its 86+ chance is listed at **35%** in a small-sample mirror.
- A **Jumbo Premium Gold** (24 items) averages **7.2 players**. Its average pack value is listed at **5,250 coins**, against a FIFA 23 store price of 15,000. That is about 35% of price.

**Classic store ladder with full odds** (FIFA 23, [RealSport101](https://realsport101.com/article/fifa-23-packs-cost-contents-probabilities-ultimate-team)):

| Pack | Coins | Items / rares | Disclosed odds |
|---|---|---|---|
| Premium Gold | 7,500 | 12 / 3 | 75+ 100%, 82+ **30%**, 84+ **7.9%**, Ones to Watch <1% |
| Jumbo Premium Gold | 15,000 | 24 / 7 | 82+ **59%**, 85+ **9%**, OTW 1.7% |
| Premium Gold Players | 25,000 | 12 / 3 | 82+ 59%, 85+ 3.8%, OTW 1% |
| Prime Gold Players | 45,000 | 12 / 6 | 82+ **80%**, 87+ **4.3%**, Special **1.8%** |
| Rare Gold | 25,000 | 12 / 12 | 82+ 58%, 86+ 4.3%, Special 1% |
| Rare Mega | 55,000 | 30 / 30 | n/a |
| Ultimate | 125,000 | 30 / 30 (all players) | n/a |

**Other FUT pack conventions:**
- **Player Picks:** for example "1 of 5 84+ Gold Player Pick" (§4.5).
- **Untradeable reward packs:** most objective and season rewards ([futmind Rivals](https://futmind.com/division-rivals-weekly-rewards)).
- **"Campaign Guarantee" packs:** one guaranteed promo card, given at the top of the Champions ranks.
- **Lightning Rounds:** one-hour, limited-stock store drops with a *global* stock cap, run around Black Friday and the winter holiday event ([Lightning Rounds explainer](https://www.dbltap.com/posts/when-do-fifa-22-lightning-rounds-start-01fm332dfnq5)).
- **FC 27 change:** base-item odds at 82 OVR and below were kept equal to FC 26. Packs no longer state a minimum number of "rares", because base rarity labels were removed.
- **Duplicates:** duplicate untradeables go to **SBC Storage** ([EA help](https://help.ea.com/en/articles/ea-sports-fc/sbcs/)). Players complain about high duplicate rates for Hero and Icon packs, and an EA moderator answered that "duplicates can occur and there is nothing that we can do" ([EA forums](https://forums.ea.com/discussions/fc-26-feedback-en/fc26-packs-ridiculously-high-duplicate-heroicon-rates%E2%80%94why-no-player-protection/12903451)). This is a pain point we can design away (§8.4).

### 2.2 Madden Ultimate Team (console)

**Disclosure format** ([EA MUT probability](https://www.ea.com/games/madden-nfl/news/mut-pack-probabilties), [Madden 26 breakdown](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-ultimate-team-26-pack-probability)):
- Each pack's main page shows how many items it holds. **View Info** shows the probability for each category.
- A row at 100% is always awarded. "The higher an OVR band, the lower the probability."
- Odds are per pack and independent.
- EA adds: "With all packs in the game, you will always receive value."

**The most complete public MUT table** (Madden 20, [GamingBolt](https://gamingbolt.com/madden-nfl-20-ultimate-team-guide-tips-pack-prices-and-card-chances)) shows MUT's **slot-list guarantees**:

| Pack | Coins | Guaranteed slots | Odds |
|---|---|---|---|
| Get A Player | 500 | 1 × 62+ Silver | 66+ 31%, Gold 70+ 7.8%, 72+ 3.1% |
| Get A Gold Player | 5,000 | 1 × 70+ Gold | 75+ 35%, Elite 80+ **9%**, 82+ 4.3% |
| Superstars | 18,000 | 1 Superstar 77+, 1 × 66+, 3 × 62+ | 80+ 16%, 83+ 15%, 85+ 4.9% |
| All-Pro | 30,000 | 2 × 75+, 1 × 70+, 1 × 66+, 3 × 62+ | 80+ 42%, 83+ 14%, 85+ 5.2% |
| Clutch | 40,000 | 1 × 80+ Elite, 5 × 62+ | 82+ 45%, 84+ 18%, 86+ 5.8% |
| Elite Player | 50,000 | 1 × 80+, 2 × 70+, 2 × 66+, 2 × 62+ | 83+ **33%**, 85+ **12%**, 87+ **3.4%** |
| Legends Fantasy | 120,000 | 3 Silver+, 2 Gold+, 1 × 83+, an 81+ Legend guaranteed | 85+ 20%, 87+ 7.2%, 88+ 3.7% |

**Madden 26 and 27 changes worth copying:**
- **LTD cards:** non-fantasy reward packs can now contain an LTD (limited-time chase card), and LTDs last a **full week instead of three days** ([EA Madden 26 Gridiron Notes](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-ultimate-team)).
- **Program champions:** these now come from **one fantasy pack with a choice** of champion, replacing bespoke sets.
- **Pack Helper:** shows "in two clicks or fewer" whether a pulled player beats your starter, completes a set, is trending, or boosts chemistry tiers. Our Pack Helper tags already cover part of this.

### 2.3 NBA 2K MyTEAM (console)

- **Gem tiers by OVR** (2K23/2K24 ranges, [HoopsGamers](https://hoopsgamers.com/nba-2k23-myteam-card-tiers-colors-explained)):

  | Tier | OVR |
  |---|---|
  | Gold | 67–79 |
  | Emerald | 80–83 |
  | Sapphire | 84–86 |
  | Ruby | 87–89 |
  | Amethyst | 90–91 |
  | Diamond | 92–94 |
  | Pink Diamond | 95–96 |
  | Galaxy Opal | 97–98 |
  | Dark Matter | 99 |

  Above them sit Invincible and GOAT cards at 100. In 2K27 the tier is a label shifted toward OVR (90 Amethyst, 91 Diamond, 92 Pink Diamond, 93 Galaxy Opal, 94 Dark Matter, 100 Invincible/GOAT). Reveals give PD, GO and DM "distinct glows" and "no longer delay the card" ([games.gg](https://games.gg/nba-2k27/guides/nba-2k27-myteam-complete-guide/)).
- **Published odds style** (2K20 base packs, mirrored in the [r/NBA2k wiki listing](https://axebps-redlib.hf.space/r/NBA2k/wiki/2k20/packodds)): **100%** for at least one 68+ card, **18%** for an 80+ card. Odds for packs that can hold 93+ cards are shown at purchase. 2K23 Dark Matter set boxes posted a **20% Dark Matter** rate per pack; one 20-pack box produced 2 Dark Matter (10%), 3 Galaxy Opal, 3 Pink Diamond, 4 Diamond and 8 lower-tier cards ([HoopsGamers experiment](https://hoopsgamers.com/the-nba-2k23-myteam-pack-experiment-what-does-a-20-pack-box-get-you)).
- **Option packs:** the Premiere Option Pack Chain lets you choose from **12 top players per pack** along a chain that adds a PD, a GO and a DM ([NBA2K MyTEAM on X](https://x.com/NBA2KMyTEAM/status/2062187557895499842)).
- **2K27 Parallels** (On Fire, Glass, Gem, Holo) are cosmetic holo variants with no gameplay impact. This is the same idea as FC 27 Holo.
- **Prize balls:** an escalating-chance reward. Each game played, win or lose, raises the chance that the ball "breaks" for a prize after your next win ([2K23 card glossary](https://NBA.2k.com/2k23/myteam/card-glossary/)). It is a gentle, visible pity mechanic tied to play rather than to spending.

### 2.4 Mobile versions

**FC Mobile** ([EA FC Mobile pack probabilities](https://www.ea.com/games/ea-sports-fc/fc-mobile/news/mobile-pack-probabilities)):
- **Odds display:** odds appear under "More Pack Info", grouped by OVR and rarity, with a timestamp. Odds are calculated mathematically, then validated by simulation, with no cumulative chance.
- **Events are where mobile differs** (TOTS 2026 event, 42 days, [BlueStacks guide](https://www.bluestacks.com/blog/game-guides/fifa-mobile-football/ffs-team-of-the-season-event-en.html)):
  - **Draft pity** activates at **70 pulls**, down from 100, and top rewards rose to 120 OVR.
  - **Chapter structure:**
    - A Main chapter has a claim-count milestone track (rewards at **2 / 5 / 10 / 20 / 30 / 40** claims) and a free 117 OVR card claim near the end.
    - League chapters run 7 days of daily featured-player challenges (3 objectives a day). Full completion yields **2,100 tokens**, and the guide says that is "enough to clear the … Exchange Store".
    - Exchange stores are capped per item, for example a 112+ Tag for 100 tokens ×5 and a 114+ Tag for 500 tokens ×1.
  - **TOTS Box:** a "box" with escalating pull costs (**28,800 FC Points** to clear it) aimed at spenders, where the first pull is free.
  - **Star Pass:** headlined by a 118 OVR card at Rank 5.
  - **Account-wide badge:** an event badge whose maximum gives **+15 Positioning and +1 Team OVR**.
- **Rank Up instead of duplicates** (FC Mobile 26, [fifamobileguide](https://www.fifamobileguide.com/rank-up)):
  - Ranks 1–5 are coloured green, blue, purple, red and orange/gold.
  - Each rank gives **+1 OVR and +1 skill point**.
  - Rank Up Points come from events. 110+ cards need **1,400** points to reach Rank 4 and **2,100** for Rank 5.
  - Duplicates are no longer required, and the old *success-chance* (could-fail) mechanic was removed.

**Madden NFL Mobile:**
- **Rarities run Uncommon → Rare → Epic → Iconic → Mythic, with OVRs up to 150** (Collector's Series players go Epic 124 → Mythic 150) ([EA Madden Mobile Collector's Series](https://www.ea.com/en/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-collectors-series)).
- **Collector's Series:** 4 collected items open a 3-card pack with a chance at a Mythic. The alternative is a "guaranteed value" **1:1 trade for Uncommons and Tokens**. This is a clean gamble-or-guarantee choice.
- **Team Diamonds:** a Reward Board that **resets every two weeks** ([EA](https://www.ea.com/es/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-team-diamonds)).
- **Madden Heroes:** one Hero needs **8,650 Hero Tokens**, and the tokens carry over month to month ([EA](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-madden-heroes)).

**NBA 2K Mobile:**
- **Duplicate-copy levelling:** Style cards level by copies (**12 copies → Uncommon, 90 → Champion**) ([nba2kmobile.com Rewind](https://nba2kmobile.com/news/introducing-rewind)).
- **Dynamic theme cards:** Playoff theme cards **gain PWR as their real team advances** ([Playoff Frenzy](https://www.nba2kmobile.com/news/introducing-playoff-frenzy)).
- **Tier refresh:** seasons refresh the tier set and raise the lowest pack tier (Season 6 replaced Ruby and Sapphire with Garnet, Cobalt and Zircon, [RealSport101](https://realsport101.com/article/nba-2k-mobile-season-6)).
- **Lesson on rating inflation:** mobile titles inflate OVR to 110–150 to keep showing "bigger numbers" each season. Our FC 27-style display scale (gold 75–99, chase above 99) is a better, more legible ceiling. Do not chase mobile inflation.

### 2.5 Card games and gacha with good pacing

**Pokémon TCG Pocket**: per-slot odds, a rare "god pack", and currency pity ([pocketcards.net](https://pocketcards.net/pull-rates); the god-pack rate is confirmed by [GameWith](https://gamewith.net/pokemon-tcg-pocket/48591)):
- **Slots:**
  - Slots 1–3 are always the lowest rarity.
  - **Slot 4:** 2-diamond 89%, 3-diamond 4.95%, 4-diamond 1.67%, 1-star 2.57%, crown 0.04%.
  - **Slot 5 (best slot, revealed last):** 2-diamond 56.8%, 3-diamond 19.0%, 4-diamond 6.66%, 1-star 10.3%, crown 0.16%.
- **God pack:** **0.05%** (1 in 2,000) of packs are "rare packs" in which every card is star-tier or better.
- **Pack Points:** **5 per pack**. Any card can be bought with points, from 35 for the commonest to 2,500 for a Crown Rare (500 packs). There is no hidden pity timer; points *are* the safety net.
- **Daily cadence:** two free packs a day ([Pokémon corporate design notes](https://corporate.pokemon.co.jp/en/topics/detail/t-28/)).

**Marvel Snap Spotlight Caches** ([snap.fan dev Q&A](https://snap.fan/news/dev-qa-new-card-acquisition-system/), [untapped](https://blog.snap.untapped.gg/marvel-snap-wiki-spotlight-caches-system-keys)):
- **The bag:** a weekly "bag of four" items: the new card, featured variants and a random Series 4/5 card. All four are shown up front.
- **Escalation:** each key draws one at random, and misses raise the odds for the item you want: **25% → 33% → 50% → guaranteed**. The bag resets weekly.
- **Older pity:** earlier, 6 Collector's Reserves without a card guaranteed one on the 7th ([MobileMatters](https://mobilematters.gg/gaming/marvel-snap-collectors-cache-collectors-reserve-season-cache)).
- **Retired:** Snap Packs replaced Spotlight Caches on 29 April 2025.

**Clash Royale Lucky Drops** ([Supercell](https://supercell.com/en/games/clashroyale/blog/release-notes/game-update-lucky-drops), [MobileMatters](https://mobilematters.gg/guides/clash-royale/clash-royale-lucky-drops)):
- **Taps:** opening takes **three taps**. Each tap may upgrade the rarity: Common→Rare **20%**, Rare→Epic **25%**, Epic→Legendary **30%**. That gives a final distribution of about 51.2% / 36.1% / 11.3% / 1.5% (our calculation).
- **Where drops come from:** daily tasks, all completable in **as few as three battles**. Unclaimed drops expire at reset.
- **Lucky Chests (2025):** 5 star levels and up to 4 spins. Final odds for the seasonal chest are 6.25 / 29.0 / 40.9 / 21.2 / 2.7% for 1–5 stars, per RoyaleAPI (summarised in search results; the page refused a direct read).
- **Why it works:** the tap-to-upgrade sequence turns one reward into three short, readable anticipation beats.

### 2.6 Patterns worth copying, and ones to avoid

**Copy:**
- **Slot lists with floors.** For example "1 × 80+, 2 × 70+" (MUT) or "3 players, 2 rated 75–82" (FC 27). Players can read exactly what they are buying.
- **"At least one" odds per band, with a timestamp** (EA, Madden, 2K).
- **A flat main band with a sharp cliff above it** (FUT gold curve), so 83+ and 85+ feel special.
- **The best slot last.** TCG Pocket's slot 5 and Clash Royale's final tap make the ending the climax.
- **Transparent bad-luck protection:** points (TCG Pocket), a visible bag (Snap), or escalating per-game chances (2K prize balls).
- **Cosmetic variants:** about 5% holo (FC 27) or parallels (2K27) give collectors a chase without power creep.
- **Gamble-or-guarantee choices:** Madden Mobile's 1:1 trade and 2K option packs.

**Avoid:**
- Mobile-style OVR inflation to 120–150.
- Escalating-cost "boxes" (FC Mobile TOTS Box).
- Hidden duplicate rates with no protection (the FC 26 complaint).
- Animations that can't be skipped. TCG Pocket's forced animations are its top complaint ([Dexerto](https://jamtest.dexerto.com/pokemon/pokemon-tcg-pocket-desperately-needs-one-key-qol-feature-3005478)).

---

## 3. Promos: design and cadence

### 3.1 FUT: weekly in-forms and the campaign calendar

**Team of the Week (TOTW):**
- **Timing:** a new squad of **23 in-form cards every Wednesday** at 6pm UK / 10am PT. It stays in packs for one week, then is replaced ([fifplay](https://www.fifplay.com/fc-26-totw-30/), [VGC TOTW 12](https://www.videogameschronicle.com/news/ea-sports-fc-26-team-of-the-week-12-is-out-now-including-an-89-rated-lautaro-martinez)).
- **Upgrade size:** in-forms are small boosts. One example is 88 → 89 (+1).
- **Uses:** TOTW cards double as SBC fodder for Icon and Player-of-the-Month SBCs. FC 27 adds **community voting** for TOTW.

**Campaigns** (FC 26 full-year list, [FIFAUTeam](https://fifauteam.com/fc-26-promos-events/), [RealSport101](https://realsport101.com/article/fc-26-promo-schedule-all-upcoming-campaigns-before-fc-27)):
- **Volume:** 29 named promos in about 51 weeks. Most launch **Friday at 6pm UK** and many overlap.
- **Order through the year:**
  - **Launch window:** Cornerstones (+2 club chemistry link) and Ratings Reload, where community-voted players get upgrades to their six face stats.
  - **Autumn:** Ultimate Scream (dynamic boosts), Primetime (dynamic on real results), Captains and Pro Live (upgrades tied to esports pros).
  - **Black Friday:** re-released TOTWs plus **hourly promo packs, lightning rounds and flash SBCs**.
  - **December:** Joga Bonito (5-star skills), Unbreakables and Winter Wildcards (3 squads, daily player SBCs).
  - **January:** Time Warp, then **Team of the Year** (best XI, 16–30 Jan), then **Future Stars** (potential ratings).
  - **February to April:** Knockout Royalty, Fantasy FC (upgrades from goals, assists, clean sheets and results), FUT Birthday (5★ weak foot and skills), Answer the Call (**+1 OVR, +1 PlayStyle+** if selected for the World Cup) and Road to the Final (upgrades as teams advance).
  - **Spring and summer:** Trophy Titans, then **Team of the Season** (about **19 squads over 5–7 weeks**), then the World Cup summer promos (Path to Glory, Glory Hunters, Phenoms, Summer Stars).
  - **Late summer:** **FUTTIES** (99-rated "best of", community-voted, about 5 weeks), Ultimate Rewind, then **Pre-Season**, which pays objective rewards into next year's game.
- **Two-wave promos:** these release Team 1 and then Team 2 a week later (Path to Glory: 5 and 12 June).

**Power curve:**
- FC 26 made upgrades "smaller, cards remain playable longer; rewards are weaker – to support the Powercurve" ([mein-mmo](https://mein-mmo.de/en/ea-fc-26-pitch-notes-reveal-dozens-of-new-features-the-most-important-changes-at-a-glance,1525844/)).
- FC 27 again "reduced" the attribute upgrade scale "so the gap between base and final Campaign Items is … smaller". It cut campaign squad weeks by about **5** across the year.
- FC 27 gives every special item **Role++** in its primary and secondary positions, and caps PlayStyle+ at **3**, down from 5 ([EA FC 27 deep dive](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-fut-deep-dive)).

### 3.2 MUT programs

- **Weekly Spotlight Pass:** debuts with **Legends, Team of the Week and Collector's Series**, and **all weekly programs share one token**. The seasonal Event Pass is fed by events, including solo ones ([EA Madden 26](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-ultimate-team)).
- **Event pairing:** each content drop ships a **CPU event and a head-to-head event**. Examples are Campus Chaos (4 college years × 2 games) and Game Time (a 5-game H2H season).
- **Card design rule:** name, OVR and position **stay in a fixed location** while program art varies. Cards flip to back pages showing attributes, X-Factors, abilities and chemistries.
- **Madden 27 progression:**
  - **Upgrades:** **upgrade multiple tiers at once**, with archetype-driven paths. Skill Points come from objectives on the item itself, and the progress stays tied to the item.
  - **Ultimate Captain:** one core player kept and upgraded all year.
  - **Event Pass:** rebalanced toward **total wins over long win streaks**.
  - **Ranked:** climbing needs "increasingly better win rates" up to a Top 100 ([EA](https://www.ea.com/en/games/madden-nfl/madden-nfl-27/news/madden-27-ultimate-team), [MUT.GG](https://www.mut.gg/news/madden-nfl-27-ultimate-team-deep-dive/)).

### 3.3 MyTEAM seasons, exchanges and levels

- **2K25 progression** ([2K newsroom](https://newsroom-uk.2k.com/news/nba-2k25-unveils-major-updates-coming-to-myteam)):
  - **REP** is year-long and never resets. It pays seasonal, monthly and weekly free packs and a GOAT card at the Dark Matter tier.
  - **Showdown** is a **15-tier** win ladder with streak bonuses. Every Friday at 8am PT, players choose a weekly reward group.
  - **King of the Court** runs Saturdays 10am–2pm PT, and **3 losses** end your run.
  - **Breakout** is a board game: you move outward from the centre toward a chosen reward, and each board ends at a gatekeeper team.
- **2K27 progression** ([games.gg](https://games.gg/nba-2k27/guides/nba-2k27-myteam-complete-guide/)):
  - **Per-card player XP:** milestones offer **a choice between upgrade paths**, for example hot zones everywhere vs starting games with a near-full takeover meter.
  - **Free reward card:** the Season Level 40 card.
  - **Exchanges:** **three new exchanges every Friday** plus one **Premier Exchange per season**. Any card can be exchanged, and higher gems satisfy lower-gem requirements.
  - **Evolutions:** for example a first stage after 1 game and a second after 20 assists.
  - **Hone Your Skills:** **4 challenges → 5 Emerald picks**.

### 3.4 Mobile promo events

- **FC Mobile:**
  - Events run 4–6 weeks.
  - **Chapters unlock weekly**, and each has its own token and exchange store.
  - Daily featured challenges pay 300 tokens a day.
  - A claim-count milestone track runs alongside, and a Star Pass with a headline card sits on top ([BlueStacks](https://www.bluestacks.com/blog/game-guides/fifa-mobile-football/ffs-team-of-the-season-event-en.html)).
- **Madden Mobile:**
  - **Map-based events:** a Blitz map of 6 nodes, achievement and display maps, and daily events that reset at a fixed time.
  - **Token pacing:** Hero tokens are paced monthly and carry over.

### 3.5 How promo cards stack above base

**Observed ladders:**
- **FUT:**
  - base → in-form +1 → second in-form +1–2 → campaign card (+3–6, often dynamic up to +4 more) → TOTY/TOTS (+6–10) → FUTTIES 99.
  - **Dynamic** promos add +1 per real-world condition met, such as a team win, goals or advancing.
  - Answer the Call shows how small a single upgrade step can be: **+1 OVR and +1 PlayStyle+**.
- **2K:** promo tiers line up with gem colours (Amethyst is the first promo tier at 90–91, Dark Matter tops each set). New promos push the ceiling up by about one gem every season.
- **Madden Mobile:** promo cards launch at the tier ceiling and are "upgradable" to the next rarity (Epic 124 → Mythic 150).

**What to borrow:** a fixed promo ladder with small steps, dynamic upgrades on visible conditions, and a ceiling that rises month by month instead of jumping.

---

## 4. Progression

### 4.1 Squad Building Challenges

- **Types** ([EA help](https://help.ea.com/en/articles/ea-sports-fc/sbcs/), [Red Bull SBC guide](https://www.redbull.com/gb-en/sbc-crafting-guide-fifa-21-ultimate-team), [FUT.GG](https://www.fut.gg/news/what-are-streamlined-sbcs-in-ea-fc-27-new-ultimate-team-feature-explained/)):
  - **Foundations:** one-time onboarding SBCs paying untradeable packs.
  - **Upgrades:** repeatable or limited-repeatable exchanges of fodder for a better pack.
  - **Player SBCs:** promo cards, Player of the Month, Icons and Heroes.
  - **Challenge/puzzle SBCs:** Marquee Matchups (weekly, themed on real fixtures) and Daily Puzzles.
  - **Live/promo SBCs** and **Flash SBCs**.
- **FC 27 Streamlined SBCs:**
  - **No chemistry, position or squad-rating rules** for most Player and Upgrade SBCs. Each item adds a **score from OVR and rarity**, the same score the Gallery uses.
  - Example: a target of 2,000 can be met by 10 items worth 200 or 2 worth 1,000 ([VGC](https://www.videogameschronicle.com/news/ea-sports-fc-27-ultimate-team-changes-explained-simplified-sbcs-fut-gallery-holographic-items-and-more/)).
  - Duplicates count. Partial submissions are saved. Traditional SBCs remain only for puzzle-style challenges.
  - Our Item Score and Streamlined SBC already mirror this.
- **Submissions are permanent:** EA support cannot restore them, so confirmation UX matters.

### 4.2 Objectives

- **FC 26:** relevant objectives **appear in the Play menu beside each mode**. Event objectives are claimed straight from the Event Hub. Live Events show their entry requirements next to their objectives ([EA FC 26 deep dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-fut-deep-dive)).
- **FC 27:** **End of Match Rewards** pay coins and SP after matches, moving some weekly objective rewards into per-match pay. A **Campaign Hub** collects each promo's objectives, SBCs, evolutions, Gallery sets and events in one place.
- **Madden 26/27:**
  - Objective tracking appears **on the play-call and presnap screens**, and favourited item objectives show progress mid-game.
  - Challenge star ratings were **rescaled so 1★ is easiest and 5★ hardest**.
- **Clash Royale:** daily tasks are tracked at the same time, so a player can finish them all in **three battles**.

### 4.3 Season and battle passes

- **FC 27 Season 2:** **30 levels at 1,000 SP each** (30,000 SP), running 22 Oct – 3 Dec 2026 (about 6 weeks) ([FUT.GG season pass](https://www.fut.gg/season-pass/)).
  - Rewards escalate from 2× 80+ packs at level 2, through 1 of 4 81+ picks around level 5–13, to 2× 86+ and 4× 85+ at level 30.
  - Reward player cards appear at levels 5, 15, 20, 25 and 30, and Evolutions are spread through the track.
  - The free track holds **8 players, 7 Evolutions and 21 packs**.
- **FC 26 Pre-Season:** level 40 needed 40,000 SP.
- **2K:** a free **Level 40 reward card** each season.
- **Ours today:** 25 levels × 300 SP over 28 days, free only (`UT-OVERHAUL.md`).

### 4.4 Evolutions and upgrades

- **FC 26** ([EA FC 26 deep dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-fut-deep-dive), [launch notes](https://www.ea.com/nb-no/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-launch-update)):
  - **Slots:** one active Evo slot (two for the premium edition).
  - **Structure and cost:** Evos are multi-level, with objectives per level. They cost 0–40,000 coins (for example 10k and 30k Evos).
  - **Repeatable Evos:** "limited repeatable", with a set number of runs and a cooldown.
  - **Card look:** the item keeps its design unless rarity changes. Evolution badges can be used in squad requirements. Consumables preview the cosmetics they unlock.
- **FC 27:**
  - **Branching pathways:** for example dribbling + Technical vs defending + Jockey.
  - An **Evolution Chain Preview** shows which Evos may follow (for example 84 → 87).
  - **PlayStyles Lab** is recurring.
- **Madden 27:** Evos raise max OVR, unlock paths and abilities, add chemistries and change archetypes. Some Evos chain together.
- **2K27:** per-card XP with branching choices, and evolutions that raise the gem tier.
- **FC Mobile:** Rank Up (§2.4) adds guaranteed +1 OVR steps with no fail chance.

### 4.5 Competitive and solo reward ladders

**Division Rivals** (FUT):
- **Format:** 10 divisions + Elite. A win is worth 3 points and a draw 1.
- **Weekly reward thresholds:** base rewards at **15 points**, upgraded rewards at **35 points**. The FC 26 launch notes lowered the upgraded threshold to 30 ([futmind](https://futmind.com/division-rivals-weekly-rewards), [EA launch notes](https://www.ea.com/nb-no/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-launch-update)).
- **Example rewards (upgraded tier):**
  - Division 10: 1× 3× 81+ pack.
  - Division 5: 5× 83+, 1 of 4 83+ pick, 1 of 4 81+ pick, 22,500 coins.
  - Elite: 5× 84+, 5× 83+, 1 of 5 84+ pick, a Giant Gold pack, a TOTW pack and **122,500 coins**.
  - The coin reward roughly **doubles every two divisions** at the top.
- **Bounties:** random mini-challenges after every match (score first, win by 2+, keep a clean sheet), many completable without winning. **Duels** pit both players against each other for the same bounty. **Breakable checkpoints** stop relegation until a loss threshold is reached.

**Champions** (FUT):
- **Entry:** **1,000 qualification points** from Rivals at Division 6+ ([Beebom](https://beebom.com/ea-fc-26-champions-game-mode)).
- **Rewards:** **15 matches**, **15 rank tiers with a reward for every win**, and milestones at **12 and 14 wins**.
- **Rank 1:** 85,000 coins, 2 Campaign Guarantees, 3× TOTW, 3× 88+ and 30 rare player packs.
- **Challengers:** a lighter version for Division 7 and below.

**Squad Battles** (FUT):
- **Format:** **18 counted matches a week**, up from 14, plus a Featured Squad and a TOTW squad. **Four opponents** are offered at a time, one each from Easy, Medium and Hard plus a random fourth.
- **Ranks:** percentile ranks run Bronze 3 → Elite 1 → Top 200, refreshing on **Sunday 09:00 UTC** ([FIFAUTeam](https://fifauteam.com/fc-26-squad-battles-explained/)).
- **Points:** more points on harder difficulty.

**Gauntlet** (FC 26):
- Up to 3 rounds, each needing a **completely different squad** (11 starters + 7 bench, 54 cards across all three rounds).
- One attempt a day, every two weeks, and **no elimination**: better results earn better rewards.

**Madden solo modes** (Madden 26):
- **Solo Champions:** a **12-game weekly** gauntlet with escalating difficulty, one entry token a week and more tokens from weekly objectives.
- **"The Run":** 4 levels × 5 two-quarter games.
- **Sick Six:** 3 runs a week.

### 4.6 Collections

- **FC 27 FUT Gallery** ([EA](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-fut-deep-dive)):
  - **Sets:** Nation, League, Club and Campaign sets, plus custom sets.
  - **Permanent history:** items count **even after being sold or used in SBCs**.
  - **Grading:** each completed set is **graded** (B through S) by its items' OVR and rarity.
  - **Gallery Level:** milestones pay Holo chances, tokens and cosmetics. Tags give bonus criteria.
- **Pokémon TCG Pocket's team:** "The act of collecting is the original source of fun across all Pokémon games."

---

## 5. Card design and the pack-opening sequence

### 5.1 Tiers, colours and finishes

- **FUT:**
  - Base bronze, silver and gold; FC 27 removed the common/rare split.
  - **TOTW in-forms** are black and gold.
  - Every campaign has its own colourway, Icons are white and gold, and Heroes have their own frame.
  - **Holo** variants: Regular foil, or Pristine (88+, stylised name).
- **2K:** a gem colour ladder (above) with glows on the top tiers, and **Parallels** (On Fire, Glass, Gem, Holo).
- **Madden:** program-specific art around a fixed OVR/name/position block, plus card **flip pages**. Mobile rarity runs Uncommon → Mythic.
- **TCG Pocket:**
  - **Tilt parallax:** "Tilting the device shows each card from different angles".
  - **"Immersive" cards** have full-screen 3D parallax animation and are reserved for rare cards.
  - **The goal:** "recreating the physical feel of a card".

### 5.2 Card anatomy

What the references converge on:
- **Fixed anchors:** OVR top-left, position under it, name plate, six face stats.
- **Identity strip:** club or team and nation/era.
- **Edition stamp.**
- **Back page:** full attributes, abilities or PlayStyles, and history.

Two notes from FC 27: special cards get **Role++ markers**, and evolutions get **badges usable as filters**.

### 5.3 Pack-opening beats

**FUT** ([Dexerto](https://www.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/pack-animations/), [games.gg](https://games.gg/ea-sports-fc-26/guides/ea-fc-26-walkout-animation/), [FUTFC](https://futfc.gg/how-to-spot-a-walkout-and-a-double-walkout-in-fc-26/)):
- **Rating tiers:**
  - **Below 81:** no animation; the card appears immediately.
  - **81–85 ("boards"):** an animation without the tunnel.
  - **86+ ("walkout"):** a tunnel flash of about **0.5 s** at the start.
- **Colour cue:** lines appear within the first second. Sources disagree, but the common reading is silver/grey for 86+, gold for 81–85, and white for Icon. Promo packs add colour splashes in the tunnel.
- **Reveal order:** quick cuts to **position → nation flag → league → club badge → rating count-up → card**. The full build takes about **10–15 s**. The player walks on at the end.
- **Double-walkout cue:** the club flag hangs stiff instead of waving.

**TCG Pocket:**
- A **swipe-to-tear gesture** with tear sound and vibration.
- A rare card is guaranteed a "cracking sound, light shining out of the pack, and background colour changes" ([GameWith via search summary](https://gamewith.net/pokemon-tcg-pocket/48549)).
- Cards are revealed one by one, with the best slot last.

**Clash Royale:** three taps, each an upgrade chance.

**2K27:** top-tier glows are shown without delaying the card.

**Ours today** (`docs/PACK-CINEMA.md`, `pack-sequence.ts`):
- The beats are tear (680/1,050 ms), position (540/900), team (1,120/1,750), player (1,650 → 3,900 ms) and settle (2,650 → 5,550 ms).
- GOAT is the longest entrance at 6.6 s, and Skip works throughout.

---

## 6. Menus and hub UX

- **FC 26 Play menu** ([EA FC 26 deep dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-fut-deep-dive), [RealSport101 UI](https://realsport101.com/article/fc-26s-new-ui-a-deep-dive-into-the-redesigned-ultimate-team-menu)):
  - **"For You" tab:** **New** (just-launched competitions), **Continue Playing** (recent modes) and **Upcoming** (in date order, with entry and squad requirements shown in advance so players can prepare).
  - **Other tabs:** Online, Play vs CPU, Play vs Friend, and Other, which holds up to 6 Live Event tabs.
  - **Objectives** sit on the side of each mode screen.
  - **Event Hub** shows availability, requirements, rewards and progress.
- **FC 27:**
  - **Campaign Hub** gathers one promo's content on one page.
  - **End of Match Rewards** pay coins and SP immediately after a match.
- **Madden 26:**
  - **Pack Helper:** two-click answers to "better than my starter? completes a set? boosts chemistry?".
  - **Live lineup compliance:** real-time alerts when a lineup misses team-building event requirements, plus an auto-built baseline.
- **2K25:** onboarding runs from tutorials into "Welcome to MyTEAM" challenges, and the Home tab includes a Training Hub.
- **FIFA Mobile UX critique** ([Super Jump](https://superjumpmagazine.com/ux-game-analysis-of-the-fifa-mobile-app)):
  - Always show the currency total in the top bar.
  - Disable unaffordable buttons instead of failing on the second tap.
  - Label icon buttons with text.
  - Make the primary action visually distinct.
  - Use "Close", not "Confirm", on info-only modals.
  - Add search for long lists such as the 44-league crest picker.
- **PTCGP complaint:** forced animations make opening several packs "a chore", so bulk open and skip are essential.

---

## 7. Engagement psychology, used ethically

- **Variable-ratio reinforcement.** Loot boxes reward on an intermittent schedule, which builds behaviour that is "highly resistant to extinction". Drummond & Sauer (2018, *Nature Human Behaviour*) found **45%** of 22 games met all five psychological criteria for gambling (summarised via [PeerJ, Zendle 2019](https://www.peerj.com/articles/7700) and the Australian Senate inquiry).
- **Prevalence across top mobile games.** Zheng, Xiao & Sharman (CDiGRA 2025) coded the first hour of 20 top-grossing mobile games ([DiGRA PDF](https://dl.digra.org/index.php/dl/article/download/2764/2748/2808)). They found:
  - currency conversion in **100%** of games;
  - limited discounts and VIP schemes in **90%**;
  - **variable-ratio reinforcement and rarity tiers in 85%**.
  
  They also noted three patterns:
  - **Losses disguised as wins** through duplicate handling.
  - **Near-miss effects**, which often co-occur with LDWs.
  - **Pity mechanics**, which are commonly bundled with batch pulls and limited discounts.
  
  This is a checklist of what *not* to stack.
- **Goal gradient.** In Kivetz, Urminsky & Zheng (2006), café customers bought **more often the closer they got** to a free coffee. The time between purchases shrank by about **20%** from the first stamp to the last ([EconPapers](https://econpapers.repec.org/RePEc:feb:natura:00658), [Chicago Booth](https://www.chicagobooth.edu/review/going-goal)).
- **Endowed progress.** In Nunes & Drèze (2006), a car-wash card with **2 of 10** stamps pre-filled was completed by **34%** of customers, vs **19%** for an empty 8-stamp card ([Silicon Canals](https://siliconcanals.com/t-car-wash-loyalty-cards-endowed-progress/)).
- **Collections and treasure.** TCG Pocket designs for cards to feel like "personal treasures", and the FUT Gallery keeps every item ever owned.

**Ethical rules for our coins-only game.** These keep the "pull" and drop the predatory parts:
- Every random reward shows its odds before opening.
- Cues never over-promise. This is already a rule for GOAT reveals; extend it to every tier.
- No escalating-cost boxes, and no limited windows that never return.
- Streaks have a weekly shield.
- Daily objectives fit in about 3 matches, and the game says clearly when you're done.
- Skip and bulk-open are always available.
- Reduced motion turns off flourishes.

---

## 8. Spec for Perfect Season (NBA, NFL, Soccer)

### 8.0 What we already have, and the gaps

**Already built** (from `docs/ULTIMATE-TEAM.md`, `UT-CONTENT-2.md`, `UT-OVERHAUL.md`, `PACK-CINEMA.md`, `CLAUDE.md` and `src/data/live-calendar.json`):
- **Packs and picks:** Bronze, Silver, Gold, Premium, Position, Spotlight, Daily Drop (7-day streak), Scout's Choice, Elite Gold, Jumbo Premium, Standout Guarantee, Lightning windows, Preview Pack and program pack templates (5,000 coins, 30% program slot, 3 a day).
- **Pack presentation:** rare-gold shimmer, holo variants, Pack Helper tags, Pack Tracker and the pack cinema.
- **Promos:** Weekly Standouts (Wednesday, +3 / +5, cap 97) and Landmarks (+5, cap 99).
- **Live Calendar:** 12 seasons with 2–5 promos each, deltas 3–9, a weekly rhythm (Mon reset, Wed Standouts, Fri drop, Sat/Sun flash windows), and NBA and NFL only.
- **Progression:** Item Score and Streamlined SBCs, evolutions, a free Season Pass (25 × 300 SP, 28 days), and objectives (3 daily, 3 weekly, 8 lifetime).
- **Modes:** Circuit (6 matches, 3 entries a week, milestones at 2/4/6 wins), Rivals, Cups, Club Season, Moments, UT Draft, and the Rewards inbox.

**Gaps against the references:**
1. **Within-tier draws.** `weighted()` in `packs.ts` makes every point above the tier floor 0.8^1.6 (about 30%) rarer. FUT's curve is flat across 75–82 and then falls off a cliff. Our curve probably overproduces 75–77 filler and has no recognisable "83+ is a hit" moment. **Measure first:** run 10,000 simulated Gold packs per sport through the existing `economy.test.ts` harness and plot the OVR histogram against §8.1.
2. **Guarantees and the odds sheet.** Guarantees are tier- and "rare"-based. Odds sheets list slots, not "at least one ≥ X" rows.
3. **No bad-luck protection** other than the GOAT rules.
4. **Soccer has no Live Calendar**, so it has no promos, program packs or season SBCs.
5. **Objectives** are only 3 daily and 3 weekly. There are no program objective groups, card-attached objectives or match bounties, and no objective chips on mode tiles or in matches.
6. **Season Pass pacing** has no featured end card on the banner, no endowed first level and no overflow.
7. **Promo ceiling.** Promo deltas are set per promo, with no explicit season-by-season cap.
8. **Competitive pay.** Circuit and Rivals pay at milestones only. There is no per-win reward and no two-threshold weekly reward.

None of this needs a save reset. All new state belongs under the optional `ut.content` or `ut.hq` fields with stable claim IDs.

**Online protocols:**
- Changing **pack odds does not touch match physics or ratings**, so no protocol bump is needed.
- New promo edition rules that change how a card is *rated* do need the UT queue bump for that sport. Today that is UT NBA 10 / NFL 11 / soccer 2. This is the same reason `pool.print` already mixes in `CONTENT_PRINT`.

### 8.1 The OVR-band draw model (the "FUT curve")

Replace the per-card exponential inside the silver and gold tiers with **band targets**:
1. Pick an OVR value from the target curve for the slot's floor.
2. Pick a card uniformly at that OVR, within the position mix. Keep the existing position-mix logic.
3. If a sport's pool has no card at that OVR, step down one point, then up one point.

This is how a disclosed table can be honoured whatever the pool's shape. Express every OVR through `onScale` and `TIER_CUTS`, as the existing code does.

**Gold slot curve** (display scale, gold floor 75; FC 27 Large Gold Pack shape, extended to our 91 base ceiling):

| OVR | 75 | 76 | 77 | 78 | 79 | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weight % | 4.56 | 5.02 | 6.71 | 13.46 | 15.29 | 17.67 | 16.22 | 15.28 | 3.40 | 1.38 | 0.43 | 0.22 | 0.16 | 0.15 | 0.034 | 0.011 | 0.005 |

**Per-slot chances**, from this curve (computed; script in `scratchpad/overhaul/calc/odds.py`):

| Slot | 80+ | 82+ | 83+ | 84+ | 85+ | 86+ | 87+ | 88+ |
|---|---|---|---|---|---|---|---|---|
| G75 (any gold) | 55.0 | 21.1 | 5.8 | 2.4 | 1.0 | 0.58 | 0.36 | 0.20 |
| G78 (gold 78+) | 65.7 | 25.2 | 6.9 | 2.9 | 1.2 | 0.69 | 0.43 | 0.24 |
| G80 | 100 | 38.3 | 10.5 | 4.4 | 1.8 | 1.05 | 0.65 | 0.36 |
| G82 | 100 | 100 | 27.5 | 11.4 | 4.8 | 2.7 | 1.7 | 0.94 |
| G84 | 100 | 100 | 100 | 100 | 42.2 | 24.1 | 15.0 | 8.3 |
| G86 | 100 | 100 | 100 | 100 | 100 | 100 | 62.3 | 34.6 |

**Silver slot:** flat across 65–74 with a gentle rise toward 70–74 (45/55 split between 65–69 and 70–74).

**Bronze slot:** flat.

**Keep "rare gold" as the cosmetic shimmer** (top 35% per position, `rare.ts`), as FC 27 does: rarity is a look, and guarantees are OVR floors. Do not delete the flag, because sets and filters may use it.

### 8.2 Pack catalogue and odds tables

**Assumptions:**
- Prices are NBA. Keep the existing per-sport price and quick-sell factors (`PACK_SHAPE`, `CONTENT_PRICES`) and the **45–60% quick-sell EV target** (`economy.test.ts`). FUT's own EV is about 35% (Jumbo Premium), and our generosity is deliberate for a coins-only game.
- Card counts follow the existing ratio: NBA ×1, soccer about ×1.4, NFL about ×2–2.4, because NFL has 23 starters.
- Per-slot rates are the same in every sport. NFL therefore shows higher "at least one" numbers because it opens more cards, which is honest and matches its roster need.
- "Special" means the current program, Weekly Standout, Hot Season, Landmark or Legend. Spotlight and GOAT stay in their registered online pack only.

#### Store packs

| Pack (our name) | NBA price | Cards NBA / Soccer / NFL | Slot list (NBA) | Special slot | Limit |
|---|---|---|---|---|---|
| Bronze | 250 | 5 / 7 / 10 | 4 B, 1 × (B 80% / S 20%) | none | none |
| Silver | 400 | 5 / 7 / 10 | 1 B, 3 S, 1 × (S 75% / G75 25%) | none | none |
| Gold | 900 | 5 / 6 / 12 | 2 S, 2 G75, 1 G78 | +2.2% (Std 1.5, Hot 0.5, Legend 0.2) on the G78 slot | none |
| Premium Gold | 1,800 | 8 / 10 / 16 | 2 S, 3 G75, 3 G78 | 1 premium slot: Std 4%, Hot 2%, Legend 0.66% | none |
| Jumbo Premium | 3,200 | 16 / 21 / 32 | 4 S, 4 G75, 7 G78, 1 premium slot | as Premium | 1/day |
| **Headliners** (new; FUT "Prime Players" tier) | ~3,800 | 8 / 11 / 16 | 6 G80, 2 G82 | 1 program slot: current program 12%, Std 8%, Legend 1% | 2/day |
| Elite Gold (re-spec) | 3,000 | 6 / 8 / 12 | 5 G82, 1 G84 | Std 10%, Legend 1% on the G84 slot (keeps today's 10/1) | 2/day |
| **Franchise Vault** (new; FUT "Ultimate" tier) | ~9,000 | 12 / 17 / 24 | 10 G82, 2 G84 | 1 program slot: program 30%, Legend 2% | 1/week |
| Program Pack (template, exists) | 5,000 | 8 / 11 / 16 | 4 G75, 3 G80, 1 program slot | program 30%, legend 0.5% | 3/day |
| Program Guarantee (exists) | 12,000 | 6 / 8 / 12 | 5 G82, 1 program card 100% | — | 1/week |

#### Displayed odds: minimum chance of at least one

These are computed from §8.1. Re-run them by simulation at build time and stamp the sheet.

| Pack | Sport | 80+ | 82+ | 83+ | 84+ | 85+ | 86+ | 88+ | Special |
|---|---|---|---|---|---|---|---|---|---|
| Gold | NBA | 93% | 53% | 17% | 7.4% | 3.2% | 1.8% | 0.6% | 2.2% |
| Gold | Soccer | 97% | 63% | 22% | 9.7% | 4.2% | 2.4% | 0.8% | 2.2% |
| Gold | NFL | 100% | 92% | 46% | 22% | 10% | 5.8% | 2.0% | 2.2% |
| Premium Gold | NBA | 99.6% | 79% | 33% | 15% | 6.5% | 3.7% | 1.3% | 6.7% |
| Premium Gold | Soccer | 99.9% | 88% | 41% | 19% | 8.5% | 4.9% | 1.7% | 6.7% |
| Premium Gold | NFL | 100% | 97% | 60% | 31% | 14% | 8.4% | 3.0% | 6.7% |
| Jumbo Premium | NBA | 100% | 95% | 52% | 26% | 12% | 6.9% | 2.4% | 6.7% |
| Jumbo Premium | Soccer | 100% | 98% | 63% | 33% | 16% | 9.2% | 3.3% | 6.7% |
| Jumbo Premium | NFL | 100% | 99.8% | 79% | 46% | 23% | 14% | 5.0% | 6.7% |
| Headliners | NBA | 100% | 100% | 73% | 40% | 19% | 11% | 4.0% | 21% |
| Headliners | Soccer | 100% | 100% | 84% | 51% | 26% | 15% | 5.6% | 21% |
| Headliners | NFL | 100% | 100% | 93% | 64% | 34% | 21% | 7.8% | 21% |
| Elite Gold | NBA | 100% | 100% | 100% | 100% | 55% | 34% | 13% | 11% |
| Elite Gold | Soccer | 100% | 100% | 100% | 100% | 59% | 38% | 14% | 11% |
| Elite Gold | NFL | 100% | 100% | 100% | 100% | 80% | 56% | 24% | 11% |
| Franchise Vault | NBA | 100% | 100% | 100% | 100% | 80% | 56% | 24% | 32% |
| Franchise Vault | Soccer | 100% | 100% | 100% | 100% | 90% | 70% | 33% | 32% |
| Franchise Vault | NFL | 100% | 100% | 100% | 100% | 96% | 81% | 42% | 32% |

How these compare with the references:
- Our Premium Gold (NBA, 82+ **79%**, 84+ **15%**) sits between FUT's Premium Gold (82+ 30%, 84+ 7.9%) and its Jumbo (82+ 59%, 85+ 9%). That is deliberately sweeter for a 1,800-coin pack in a coins-only economy.
- Elite Gold (85+ 55%) is comparable to MUT's Elite Player pack (83+ 33%, 85+ 12%) shifted up one band.

#### Player picks

| Pick | Where from | Chances for the best of the options |
|---|---|---|
| Scout's Choice: 1 of 3, 84+ (exists, on scale) | Store, 3 a week; rewards | 85+ **81%**, 86+ 56%, 87+ 39%, 88+ 23% |
| Front Office Pick: 1 of 5, 80+ (new) | Weekly objectives, Season Pass | 84+ 20%, 85+ 8.9%, 86+ 5.1% |
| 1 of 3, 82+ (new) | Rivals base, Season Pass | 84+ 30%, 85+ 14%, 86+ 8% |
| Program Pick: 1 of 3 current program (new) | Program objectives, Scout Stamps, Circuit 6-0 | 100% program |

**Reveal order for picks:** keep the face-down flip with the best option flipped last (TCG Pocket's "best slot last").

#### Promo odds boosts

- **When:** for the first 48 hours of each program wave (Friday 18:00 to Sunday 18:00 ET).
- **What:** Program Pack and Headliners program-slot odds go up ×1.5 (30% → 45%, 12% → 18%).
- **How it is shown:** the sheet shows the **boosted number, not just a badge**, with an end time. EA likewise updates odds with live content.
- **Flash windows:** keep them as they are (2 a weekend, 25% off, 1 per player).
- **No global stock:** FUT's Lightning Rounds rely on server stock we don't have. A per-player stock is the honest equivalent.

#### Holo variants

- **Rate:** set the existing `holo~` chance to about **5%** on randomly awarded *special* items only, never on guaranteed slots, following FC 27.
- **Two looks:** "Regular" for OVR ≤ 87 and "Pristine" for 88+.
- **Effects:** cosmetic and Item Score only.

### 8.3 How the odds sheet should look

Use one sheet per pack, opened from a "%" chip on the pack tile and in the Preview Pack. The 44-px tap targets and the 390 px frame already apply.

1. **Header:** pack name, card count and the slot list in plain words. For example: "8 cards: 2 silvers, 6 golds, 3 of them 78+, and 1 Premium slot".
2. **Main table:** "Chance of at least one". Bands: 80+, 82+, 83+, 84+, 85+, 86+, 88+. Then Standout, Program, Hot Season, Landmark and Legend rows. Above-99 cards are shown only in their own pack.
3. **"Per card" toggle:** the per-slot curve, so curious players can see the cliff.
4. **Footer:** "Each pack is independent. Updated <date> (simulated 200,000 packs)". Add the Scout Stamps line: "This pack adds 9 stamps (38/50 to your next pick)".
5. **Boosted rows** show a teal BOOSTED tag and a countdown.

### 8.4 Bad-luck protection

**Scout Stamps** (the pack-point model):
- **Earning:** 1 stamp per 100 coins of pack price opened, from store and earned packs alike. Daily Drop and picks give none.
- **Redemption shelf:** 50 stamps = 1 of 3 82+ pick. 120 = Scout's Choice (1 of 3 84+). 300 = Program Pick (1 of 3 current program).
- **Never expire.** Optional `ut.content.stamps` with stable claim IDs.
- **Duplicates:** when a pull duplicates a special card you own, add +10 stamps on top, so a disappointing duplicate becomes visible progress. This directly answers the FC 26 complaint about duplicate Hero and Icon packs.

**Program Bag** (the Marvel Snap model):
- **Contents:** each program wave publishes a bag of 4 prizes: 2 program cards (one featured), 1 Program Pick and 1 Headliners pack.
- **Program Keys:** earned from the wave's objective group, a Circuit 4-win milestone and the weekly 6/6 chest. Each key opens one random *remaining* prize.
- **Odds:** the featured card's chance climbs 25% → 33% → 50% → 100%, and the bag shows what is left.
- **Reset:** the bag resets with each wave. Leftover keys convert to 40 stamps.

**Hard pity on Program Packs:**
- **Rule:** if a player opens **12 program packs in one wave without a program card**, the 13th guarantees one.
- **How often it fires:** at 30% per pack the chance of 12 misses is 0.7^12 = **1.4%**, so it rarely triggers but caps the worst case.
- **Display:** show the counter ("Program card guaranteed within 5 packs").

**Spotlight and GOAT:** unchanged at 0.05% and registered online. They are the "god pack" tier and are not part of the pity system.

### 8.5 Promo ladder and cadence

**Power-curve caps by calendar season.** Use these for future seasons only, because started promos must not be edited:

| Calendar season (from `live-calendar.json`) | Weekly Standout cap | Program cap | Notes |
|---|---|---|---|
| S1 Opening Tip, S2 Thanksgiving | 93 | 94 | Launch window: small steps (+3 / +4) |
| S3 Holiday Hoops | 94 | 95 | Holiday double wave |
| S4 Hot Season (TOTY equivalent) | 95 | **97** | Hot Season Honors +6 headline |
| S5 Midseason Stars, S6 Playoff Push | 95 | 96–97 | Dynamic programs (below) |
| S7 Draft Night, S8 Road to the Ring | 96 | 98 | **Finale +9 → 99** |
| S9–S11 summer and Kickoff | 96 | 98 | "Best of" community-pick program |
| Above 99 | — | — | Spotlight 100–105 and GOAT 106–110 only (existing) |

**Promo ladder for one player:**
- Base gold (top 91) → Weekly Standout +3 (featured +5) → Program +4 to +6 → Hot Season +6 (94–97) → Landmark +5 → Finale.
- Each step must also move **face attributes by role**. This is the existing rule: three best faces get the full delta, physical faces at most +1, FT never changes.

**"Momentum" cards**, a personal-dynamic version of FUT's live upgrades:
- **The problem:** our cards are historical seasons, so they can't upgrade on tonight's real results.
- **The mechanic:** give some promo cards **three upgrade checkpoints that the owner hits personally**. Example: win 3 UT matches with him in the starting lineup, his team reaches the Cup semi-final, he scores X in Club Season. Each checkpoint adds +1 OVR, up to +3, like FC 26 Fantasy FC.
- **Implementation:** encode progress on the owned copy (the per-copy evolution track already exists).
- **Protocol:** the rated card changes, so add the edition rule to `CONTENT_PRINT` and **bump the UT queue for the affected sport**.

**Weekly rhythm** (keep the calendar's `rhythm`, tighten what ships each day):

| Day (ET) | What ships |
|---|---|
| Mon | Weekly reset: weekly objectives, weekly SBCs, Circuit entries, Rivals week, Program Bag refill if a new wave |
| Tue | **Flash SBC** (24 h, cheap) plus a Scout Market refresh |
| Wed | **Weekly Standouts** (8 NBA / 15 NFL / **11 soccer**), Standout Squad SBC, Standout objective |
| Thu | Live Event node, the sport's "night" objective (NFL Thursday Night, NBA Rivalry Night, soccer Midweek Cup) |
| Fri 18:00 | **Program wave drop:** pack-only set (8 / 15 / 11 cards), 1 cheap and 1 premium Player SBC, 1 objective-group card, 1 Evolution, Program Bag, 48 h boost |
| Sat/Sun | Flash windows (2 × 2 h), weekend objectives, Circuit weekend bonus SP |
| Every other Fri | Wave 2 of the program (FUT "Team 2"); the bag resets |
| Every 2 weeks | **Depth Gauntlet** (FC 26 Gauntlet): 3 rounds, 3 different lineups, no elimination |

**Soccer Live Calendar.** This is new; reuse the calendar schema's `soccer` keys, which the types already allow:
- **Weekly:** Matchday Standouts every Wednesday (11 cards: GK, 2 FB, 2 CB, 2 CM, 1 AM, 2 W, ST).
- **Program names** (original names, keyed to the club-football year):
  - **Opening Day** (Aug–Sep)
  - **Derby Days**, a rivalry pair program (Oct)
  - **Golden Boot Race**, a Momentum program on goals (Nov)
  - **Winter Fixtures** (late Dec)
  - **Midseason XI**, the Hot Season equivalent (Jan)
  - **Wonderkids**, potential ratings (Feb)
  - **Knockout Nights**, which upgrades with personal Cup progress (Mar)
  - **Title Run** (Apr)
  - **Season XI**, the TOTS equivalent in 5 league waves (May–Jun)
  - **Summer Tournament** (Jun–Jul)
- **Landmark lines from data:** for example 30+ league goals or 20+ assists, using the same landmark grammar.
- **Before shipping:** check data coverage in `docs/SOCCER-DATA.md`, and keep the soccer chunk lazy.

### 8.6 Objectives structure

| Layer | Count and reset | Design rule | Reward guide (NBA coins; scale by sport) |
|---|---|---|---|
| **Daily** | 3, Eastern midnight | Doable in **≤3 matches total**: 1 play task, 1 skill task (for example "hit 4 threes", "throw 2 TDs", "score from outside the box"), 1 club task (open a pack, do an SBC) | 150 coins + 200 SP each; **all 3 done** = a 3-tap Scout Reveal (below) |
| **Weekly** | 6, Monday | Mix of modes: Circuit, Rivals, SBC, Standouts, Moments, a Cup round | 500 SP each; **4/6 chest** = Premium Gold; **6/6** = Front Office Pick + 1 Program Key |
| **Program group** | 5–8 per wave | Played in any mode, using that program's cards where it makes sense | Each objective: a pack or stamps. **Group complete** = the wave's free objective program card (FUT objective players) |
| **Card-attached** | 1–2 per promo or evolution card | Signature stat for that player (scorer: 60 pts; QB: 6 TD passes; striker: 5 goals), progress shown in match | Momentum +1 / ability unlock |
| **Rivals Bounties** | 1 random per online or Rivals match | Can be completed without winning (score first, win by 10+, 3 sacks, clean sheet) | Rivals points + 25 SP; a 1-in-5 bounty pays a 1 of 3 82+ pick |
| **Season milestones** | 6 per season | 10 / 25 / 50 wins, 20 SBCs, 50 packs, full Standout week | Escalating packs, ending with a Program Pick |
| **Lifetime achievements** | Tiered bronze, silver, gold (expand the existing 8) | Collection, record, mastery | Titles, card frames, stamps |

**Scout Reveal** (Clash Royale Lucky Drop style, *earned only*):
- **The reveal:** the daily reward starts as a Gold Pack and can upgrade 3 times.
  - **Gold → Premium:** 30%
  - **Premium → Jumbo:** 20%
  - **Jumbo → Headliners:** 10%
- **Final odds:** Gold 34.3%, Premium 50.7%, Jumbo 14.4%, Headliners 0.6%. These are shown on the sheet.
- **Presentation:** each tap is a 600 ms beat with a pitch rise. Tap-to-skip resolves all three.

**Placement** (FC 26 and Madden 26):
- **Where chips go:** every Play tile shows up to 2 objective chips ("2/3 wins"), the in-match HUD shows 1 tracked objective, and the pre-game screen lists the objectives that match can advance.
- **Claiming:** happens on the End-of-Match screen, so no extra trip is needed.

### 8.7 Season Pass pacing

Apply from the next season boundary. Old seasons and claims are untouched.

- **Shape:** **30 levels × 1,000 SP**, 28 days, free.
- **Level 1 auto-granted** at season start (endowed progress).
- **Overflow:** after level 30, every **1,500 SP** = one Gold Pack, capped at 10 per season.

**SP sources** (rescaled ×1.5 from today's 80 + 30):

| Source | SP |
|---|---|
| Played match | 120, +40 for a win |
| Sim | 40, +10 for a win |
| Real online | +20 |
| Cap | First 16 matches a day (existing cap) |
| Daily objectives | 3 × 200 |
| Weekly objectives | 6 × 500 |
| Program objectives | ~150 each |
| Login stamp | 50 |

**Projected pace:**

| Player | Daily SP | Level 30 reached |
|---|---|---|
| Casual: 3 matches, all dailies, half the weeklies | ≈ 1,224 | ≈ **day 24–25** |
| Engaged: 8 matches, all dailies and weeklies, program objectives | ≈ 2,290 | ≈ **day 13**, then overflow |

**Reward layout:**

| Levels | Rewards |
|---|---|
| 1, 2, 4, 6, 8 | Gold and Premium packs |
| 3 | Card frame cosmetic |
| 5 | Weekly Standout pick |
| 7 | Evolution |
| 10 | **Season card A** (promo +4) |
| 12 | Court, pitch or field theme |
| 15 | Scout's Choice 84+ |
| 18 | Title cosmetic |
| 20 | **Season card B** (+5) |
| 22 | Evolution |
| 25 | Program Pick |
| 27 | Badge cosmetic |
| **30** | **Season Headliner (+6, at the season cap)**, shown as the banner art from day 1 |
| Others | Escalating packs: Jumbo from about 14, Headliners at 24 and 29 |

**The progress bar** shows "N levels to Season card B", so the goal gradient points at the next named card, not the next level.

### 8.8 SBC catalogue and value rules

| Family | Cadence | Example (NBA; NFL and soccer scaled) | Value rule |
|---|---|---|---|
| Foundations (new) | One-time, 10 | "Field a full gold five", "Hit chemistry 60", "Submit 3 duplicates" | Untradeable starter packs; teaches the systems |
| Daily Upgrades (exists) | 3/day, ×2 each | 5 B → Silver pack; 5 S → Gold; 5 golds 80+ → **82+ player** | Output quick-sell EV **1.1–1.3×** the input's (the fodder loop must pay) |
| Repeatables (exist) | Unlimited | Golden Hour (84+), Elite Pull (88+) | EV 0.9–1.1×, a chase not a profit |
| Streamlined Player SBC (exists, Item Score) | With each program wave | Cheap program card ≈ **1 day** of earnings; premium ≈ **4–5 days** | Partial submit, duplicates count |
| **Rivalry Puzzles** (new, FUT Marquee equivalent) | Weekly, 4 | Classic franchise pairs, era-matched (for example a 1980s East vs West pair; an NFL 1990s division rivalry; a soccer derby pair) with chemistry and position rules | Each: Premium pack; all 4: Front Office Pick |
| Flash SBC (new) | Tue and Thu, 24 h | One-off upgrade or cheap Standout | ≈ 1.3× EV, a small spike |
| Legend SBC | Monthly | Multi-segment; ≈ **2–3 weeks** of play | Shows a segment progress bar |
| Set Collections (exist) | Ongoing | Franchise eras, decades, programs, graded B–S (FUT Gallery style) | Grade upgrades pay stamps and cosmetics |

**Confirm screens** must say "These cards are removed permanently" and show the duplicate or locked status, because submissions are permanent and locked favourites are never offered.

### 8.9 Competitive ladders (pay per win)

- **Rivals:**
  - Keep the divisions.
  - Add **weekly two-threshold rewards**: base at **5 wins** (15 points at 3 per win) and upgraded at **10 wins**, scaling by division. Use the futmind ratios: about ×2 coins every two divisions near the top.
  - Add **Bounties**, and a **breakable checkpoint** every 2 divisions that holds until 3 losses.
- **Champions Circuit:**
  - Keep 6 matches and 3 entries a week.
  - Pay **something every win**: 100, 150, 200, 250, 300 and 400 coins.
  - Keep milestones at 2, 4 and 6 wins, and add **6-0 → Program Pick**.
- **Squad Battles:**
  - Show **4 opponents at a time** (Easy, Medium, Hard, plus a random fourth).
  - Count 18 matches a week. Points come from result × difficulty.
  - **Absolute weekly thresholds** decide Bronze 3 → Elite 1, because we have no server percentiles. Example: Elite 1 = 85% of the maximum possible points.
  - Rewards arrive Monday in the inbox.
- **Depth Gauntlet:** every 2 weeks, 3 rounds, each needing a different starting lineup (5 / 11 / 23). Rewards scale with rounds won, with no elimination.
- **Solo Run** (Madden 26 Solo Champions): an optional 12-game weekly run with rising difficulty, rewards by total score, 1 token a week plus 1 from the weekly 6/6 chest.

### 8.10 Card visual ladder

Use original CSS/SVG on the existing Archivo, teal and gold theme. Keep the anchors fixed: OVR top-left, position under it, name plate, 6 faces and chemistry pips.

| Tier | Material | Motion (off under reduced motion) | Reveal colour cue |
|---|---|---|---|
| Bronze | Matte copper, flat | none | none (instant) |
| Silver | Brushed steel, linear grain | none | none |
| Gold | Gold foil, warm gradient | none | none below 80 |
| Rare gold (cosmetic) | Gold with a diagonal sheen | Sheen sweep every 4 s | Teal (80–84) |
| Weekly Standout | Midnight navy and teal pulse (exists) | Pulse line | Teal with a pulse |
| Program | Per-program palette registry (2 colours + pattern + stamp) | Pattern drift | **Program colour** |
| Landmark | Sepia, film grain, laurel (exists) | Ticker band | Sepia |
| Hot Season | Ember red and gold | Heat shimmer on the frame | Ember |
| Legend | Ivory marble with gold edges | Slow glint | **White** |
| Holo (any special, 5%) | Regular foil (≤87) or Pristine (88+, stylised name) | Tilt-reactive foil (device orientation, gesture-gated) | Adds a rainbow edge |
| Spotlight | Prismatic | Prism sweep | Prismatic |
| GOAT | Black and gold crown (exists) | Crown pulse | Black and gold |

**Dynamic pixel portraits:**
- Give special tiers a 2–4 frame idle loop (breathing or dribbling) drawn on the card canvas, paused off-screen.
- Base cards stay static, to protect performance.

**Card back (flip):**
1. All attributes
2. Abilities and badges with tier
3. The printed season line (Landmark style)
4. **"With your club"**: appearances, wins and record from `ut.hq`, which is already stored

### 8.11 Pack-opening beat sheet

**Pick the cinema level from the best card in the pack.** This is truthful, because the outcome is already decided before the cinema starts.

| Level | Trigger (display scale) | Beats and timings | Total to Continue |
|---|---|---|---|
| 0 | Best card < 80 | Tear (swipe) 450 ms → fan-out with all flips at 70 ms stagger → summary | ≈ 1.2 s |
| 1 "Board" | Best 80–84, or rare | Tear 600 → **teal flare** 300 → position 450 → team 700 → card slam | ≈ 2.6 s |
| 2 "Walkout" | Best 85+ or any Standout/Program | Tear 680 → **flare colour** (gold 85–89 / program colour) in the first 400 ms → era stamp → position → team crest → **OVR count-up** (60 ms per point over the last 6 points) → pixel player walk-in → card | ≈ 4.2 s |
| 3 "Legend" | Legend, Hot Season or Landmark | As level 2 with a **white** flare and an extra crest beat | ≈ 5.0 s |
| GOAT | Unchanged (exists) | 6.6 s | 6.6 s |

**Rules:**
- **Flare timing:** the flare shows in the first second (FUT), so the player knows the tier immediately and the rest is ceremony.
- **Two specials:** if a pack holds two specials, show **two flares** (FUT's double-walkout cue). Never show two flares for one.
- **Pack order:** in packs of 8 cards or fewer, reveal the rest in ascending order with **the walkout card last** (TCG Pocket slot 5). In packs of 9 or more (NFL, Jumbo), do the walkout first, then a grid sorted by OVR with Pack Helper tags.
- **Multi-open:** "Open all": one cinema for the best card across all packs, then a combined grid. This answers TCG Pocket's top complaint.
- **Sound:**
  - a synthesised rising charge with pitch tied to the cinema level (existing `packSound`);
  - a short tick per flip;
  - a **crack + light burst** stinger on level 2+;
  - silent when sound is off.
- **Haptics:** a gesture-gated light tap on level 1+ and a heavier one on level 2+ (where iOS allows).
- **Reduced motion:** a static card with a coloured edge and the OVR shown at once.

### 8.12 Hub IA, the next-action engine and badges

**UT HOME layout** (390 px frame; the header wallet sits below the safe area, with the Dynamic Island fix owned by the screen-fit track):
1. **Hero: "Next best action"**. It is one card with one primary button, chosen in this priority order:
   1. Unclaimed rewards (inbox count)
   2. An unfinished match or run (Circuit, Cup, Gauntlet)
   3. A promo SBC or objective expiring in < 24 h
   4. Daily objectives at 2 of 3 ("1 more for your Scout Reveal")
   5. Season level within 30% of a named card
   6. A new program wave (first 48 h)
   7. Otherwise "Play: <best mode for your squad>"
2. **Live Now carousel:** program waves, Standouts, the Flash SBC and the Gauntlet, each with a countdown, a progress ring and the free card on offer.
3. **2×2 tiles:** Store (stamp meter), Challenges (SBC and objective counts), Squad (team OVR, chemistry and an "upgrade available" chip), Club and Collection (set grade).
4. **Upcoming strip:** the next 3 drops with dates and *requirements* ("Needs: 3 golds 82+"), as FC 26 does.

**Program Hub** (FC 27 Campaign Hub): one screen per program wave. It holds the hero art, the pack (odds chip), Player SBCs, the objective group with its free card, the Evolution, the Program Bag, the event and a countdown.

**End-of-Match screen:**
- Coins, card XP, SP and Rivals points count up first.
- Then objective bars animate and newly completed ones get a "Claim" button.
- The bottom button is the next best action, for example "Next Circuit match" or "Claim 2 rewards".

**Badge rules:**
- A **number** shows the count of claimable rewards (Home tab and inbox).
- A **dot** marks something new and unseen; it clears on first view.
- An **amber clock** marks anything expiring in < 24 h.
- Never badge things the player can't act on.
- Optionally use the Web App Badging API (`navigator.setAppBadge`) for the home-screen icon count, which is supported for home-screen web apps on recent iOS. Verify on device, and no server is required.

**Store layout:**
1. **Featured** (program pack and Headliners, with the boost badge)
2. **Daily** (Daily Drop, Scout Market)
3. **Packs** (ascending price)
4. **Picks**
5. **Scout Stamps** shelf
6. **Pull History**

Rules:
- Unaffordable buttons are visibly disabled, and the price shows next to the wallet.
- Every pack tile has a "%" chip.

### 8.13 Guardrails and constraints checklist

**Saves and IDs:**
- Never reset or wipe saves, coins, owned cards, UIDs or serials.
- New state goes only in the optional `ut.content` or `ut.hq` fields with stable claim IDs (`stamps`, `bags`, `pity`, `bounties`, `objectives2`).
- New edition and program IDs are append-only. **Never edit a started promo's band, delta or rule.**

**Online protocols:**
- Pack odds, prices, stamps, bags and pity are local economy changes, so no queue bump is needed.
- New *rating* rules (Momentum cards, new promo deltas) require a UT queue bump for that sport, and a `CONTENT_PRINT` update.

**Pack openings:** every new opening path must call `recordPull` (Pack Tracker rule).

**Sport branching:** use `pick({ nba, nfl, soccer })` for all per-sport numbers (counts, prices, Standout sizes).

**Test coverage:**
- Extend `economy.test.ts` to assert each pack's simulated "at least one" rows within ±1.5 points of the published sheet.
- Assert pity triggers at pack 13.
- Assert the quick-sell EV band of 45–60%.

**Ethics:**
- Odds are visible everywhere and cues are truthful.
- Skip and Open-all always work.
- Daily objectives are completable in 3 matches. The streak shield is 1 free miss a week.
- No escalating-cost boxes, coins only.

---

## 9. Open questions to verify

1. **Our current OVR histogram** from Gold and Premium packs. Simulate it before switching to §8.1. If the pool lacks enough 83–86 cards at some positions, step-down fallback is needed. That matters most for NFL K/OL and soccer GK.
2. **Exact FUT colour-line meanings** (silver vs gold vs white). Fan sources conflict. Our flare key is our own and only needs to be internally consistent.
3. **Marvel Snap's season pass and mission cadence**, and **2K's current pack-odds screens**. These were not reachable this session.
4. **Whether to expose the per-card curve** to players, or only the "at least one" rows. EA shows only rows; TCG Pocket shows per-slot tables. I'd show both behind a toggle.

---

## Sources

**EA SPORTS FC (console/PC):**
- [EA – Ultimate Team Probabilities](https://www.ea.com/games/ea-sports-fc/news/fc-pack-probabilities)
- [EA – FC 27 FUT Deep Dive](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-fut-deep-dive)
- [EA – FC 26 FUT Deep Dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-fut-deep-dive)
- [EA – FC 26 Launch Update Pitch Notes](https://www.ea.com/nb-no/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-launch-update)
- [EA help – SBCs](https://help.ea.com/en/articles/ea-sports-fc/sbcs/)
- [EA forums – FC 26 duplicate complaint](https://forums.ea.com/discussions/fc-26-feedback-en/fc26-packs-ridiculously-high-duplicate-heroicon-rates%E2%80%94why-no-player-protection/12903451)

**Pack trackers and FUT guides:**
- [futmind – Large Gold Pack](https://futmind.com/pack/301/premium-gold-pack), [Gold Pack](https://futmind.com/pack/300/gold-pack), [84+ pack](https://futmind.com/pack/1030/84+-rare-gold-player-pack), [Jumbo Premium](https://futmind.com/pack/6303/jumbo-premium-gold-pack), [Rivals rewards](https://futmind.com/division-rivals-weekly-rewards)
- [RealSport101 – FIFA 23 packs](https://realsport101.com/article/fifa-23-packs-cost-contents-probabilities-ultimate-team), [FC 26 promo schedule](https://realsport101.com/article/fc-26-promo-schedule-all-upcoming-campaigns-before-fc-27), [FC 26 UI](https://realsport101.com/article/fc-26s-new-ui-a-deep-dive-into-the-redesigned-ultimate-team-menu)
- [FIFAUTeam – FC 26 promos](https://fifauteam.com/fc-26-promos-events/), [Squad Battles](https://fifauteam.com/fc-26-squad-battles-explained/)
- [FUT.GG – season pass](https://www.fut.gg/season-pass/), [Streamlined SBCs](https://www.fut.gg/news/what-are-streamlined-sbcs-in-ea-fc-27-new-ultimate-team-feature-explained/)
- [VGC – FC 27 changes](https://www.videogameschronicle.com/news/ea-sports-fc-27-ultimate-team-changes-explained-simplified-sbcs-fut-gallery-holographic-items-and-more/)
- [mein-mmo – FC 26 Pitch Notes](https://mein-mmo.de/en/ea-fc-26-pitch-notes-reveal-dozens-of-new-features-the-most-important-changes-at-a-glance,1525844/)
- [Beebom – FC 26 Champions](https://beebom.com/ea-fc-26-champions-game-mode)
- [fifplay – TOTW 30](https://www.fifplay.com/fc-26-totw-30/)
- [Dexerto – pack animations](https://www.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/pack-animations/), [games.gg – walkouts](https://games.gg/ea-sports-fc-26/guides/ea-fc-26-walkout-animation/), [FUTFC – walkouts](https://futfc.gg/how-to-spot-a-walkout-and-a-double-walkout-in-fc-26/)

**FC Mobile:**
- [EA – FC Mobile pack probabilities](https://www.ea.com/games/ea-sports-fc/fc-mobile/news/mobile-pack-probabilities)
- [BlueStacks – FC Mobile TOTS event](https://www.bluestacks.com/blog/game-guides/fifa-mobile-football/ffs-team-of-the-season-event-en.html)
- [fifamobileguide – Rank Up](https://www.fifamobileguide.com/rank-up)

**Madden:**
- [EA – MUT pack probability](https://www.ea.com/games/madden-nfl/news/mut-pack-probabilties), [Madden 26 probability breakdown](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-ultimate-team-26-pack-probability)
- [EA – Madden 26 Gridiron Notes: MUT](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-ultimate-team), [Madden 27 MUT deep dive](https://www.ea.com/en/games/madden-nfl/madden-nfl-27/news/madden-27-ultimate-team)
- [MUT.GG – Madden 27 deep dive](https://www.mut.gg/news/madden-nfl-27-ultimate-team-deep-dive/)
- [GamingBolt – Madden 20 pack odds](https://gamingbolt.com/madden-nfl-20-ultimate-team-guide-tips-pack-prices-and-card-chances)
- [EA – Madden Mobile Collector's Series](https://www.ea.com/en/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-collectors-series), [Team Diamonds](https://www.ea.com/es/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-team-diamonds), [Madden Heroes](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-madden-heroes)

**NBA 2K:**
- [2K – NBA 2K25 MyTEAM reveal](https://newsroom-uk.2k.com/news/nba-2k25-unveils-major-updates-coming-to-myteam)
- [games.gg – 2K27 MyTEAM guide](https://games.gg/nba-2k27/guides/nba-2k27-myteam-complete-guide/)
- [mmoexp – 2K27 launch guide](https://www.mmoexp.com/News/nba-2k27-myteam-launch-guide-player-xp-best-cards-gameplay-new-modes.html)
- [HoopsGamers – tiers](https://hoopsgamers.com/nba-2k23-myteam-card-tiers-colors-explained), [box experiment](https://hoopsgamers.com/the-nba-2k23-myteam-pack-experiment-what-does-a-20-pack-box-get-you)
- [2K23 card glossary (prize balls)](https://NBA.2k.com/2k23/myteam/card-glossary/)
- [NBA 2K MyTEAM on X – option pack chain](https://x.com/NBA2KMyTEAM/status/2062187557895499842)
- [NBA 2K Mobile – Rewind](https://nba2kmobile.com/news/introducing-rewind), [Playoff Frenzy](https://www.nba2kmobile.com/news/introducing-playoff-frenzy)
- [RealSport101 – 2K Mobile S6](https://realsport101.com/article/nba-2k-mobile-season-6)

**Card games and gacha:**
- [pocketcards.net – TCG Pocket pull rates](https://pocketcards.net/pull-rates)
- [GameWith – god pack](https://gamewith.net/pokemon-tcg-pocket/48591)
- [Pokémon corporate – TCG Pocket design](https://corporate.pokemon.co.jp/en/topics/detail/t-28/)
- [Dexerto – TCG Pocket QoL](https://jamtest.dexerto.com/pokemon/pokemon-tcg-pocket-desperately-needs-one-key-qol-feature-3005478)
- [snap.fan – Spotlight Cache dev Q&A](https://snap.fan/news/dev-qa-new-card-acquisition-system/)
- [untapped – Spotlight keys](https://blog.snap.untapped.gg/marvel-snap-wiki-spotlight-caches-system-keys)
- [MobileMatters – Snap reserves](https://mobilematters.gg/gaming/marvel-snap-collectors-cache-collectors-reserve-season-cache)
- [Supercell – Lucky Drops](https://supercell.com/en/games/clashroyale/blog/release-notes/game-update-lucky-drops)
- [MobileMatters – Lucky Drops](https://mobilematters.gg/guides/clash-royale/clash-royale-lucky-drops)

**UX and psychology:**
- [Super Jump – FIFA Mobile UX](https://superjumpmagazine.com/ux-game-analysis-of-the-fifa-mobile-app)
- [Zheng, Xiao & Sharman, CDiGRA 2025](https://dl.digra.org/index.php/dl/article/download/2764/2748/2808)
- [PeerJ – Zendle 2019](https://www.peerj.com/articles/7700)
- [EconPapers – Kivetz et al. 2006](https://econpapers.repec.org/RePEc:feb:natura:00658)
- [Chicago Booth Review – goal gradient](https://www.chicagobooth.edu/review/going-goal)
- [Silicon Canals – endowed progress](https://siliconcanals.com/t-car-wash-loyalty-cards-endowed-progress/)

**Repo context** (read-only): `docs/ULTIMATE-TEAM.md`, `docs/UT-CONTENT-2.md`, `docs/UT-OVERHAUL.md`, `docs/PACK-CINEMA.md`, `src/ut/packs.ts`, `src/ut/pack-sequence.ts`, `src/data/live-calendar.json`, `CLAUDE.md` (in `/home/user/ps-studio`).
