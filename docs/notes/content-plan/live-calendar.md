# Live Calendar plan: Nov 2026 to Oct 2027 (planning notes)

This is the planning document behind the Live Calendar (content wave 3). It is kept for the reasoning: design rules, the yearly arc, the weekly rhythm, economy guardrails and the squad-strength curve.

**What actually shipped differs in places.** The implementation and the owner's later decisions are in [`docs/UT-CONTENT-2.md`](../../UT-CONTENT-2.md) ("Wave 3: Live Calendar"), and the schedule the game reads is [`src/data/live-calendar.json`](../../../src/data/live-calendar.json) (called `schedule.json` in the text below, its name while it was being planned). In particular:
- "All-Star Break" became **Midseason Stars** and "Summer League" became **Summer Run** (no league event names in the UI).
- The Perfect Season Finale (98–99) is **SBC-only**; Summer Heat's featured card is capped at 97.
- The card pool stays **frozen** for year one (no new-season data rebuild, so no extra online queue splits).
- Program pack prices were scaled per sport to this game's coin economy (see UT-CONTENT-2.md), so the coin prices below are the plan's, not the Store's.
- Not built yet: calendar-driven pass tiers, season Path/check-in, Live Event themes and flash windows.
- Soccer does not use the Live Calendar yet.

The generated week-by-week table and the per-season detail (sections 7 and 8 of the original plan) are left out here: they were generated from the schedule data, which now lives in `src/data/live-calendar.json`.

All OVR numbers use the FC-style display scale: Bronze 40–64, Silver 65–74, Gold 75–99, walkout at 86+. Spotlight and GOAT cards above 99 stay server-registered ultra-rares and are outside this calendar.

---
## 1. Design rules (what the year has to do)

1. **Zero server.** Everything below comes from the US-Eastern date (`easternDateKey`) plus `schedule.json` plus the card data. Promo cards are selected by rules (`franchise:CHI`, `era:1990s`, `stat:pts>=30`, `honor:ALLPRO1`, `career:first` …) with a seed per promo. Nobody has to curate a card list. Every player sees the same cards on the same day.
2. **A rhythm players can feel** (FC, MUT and 2K all do this): a weekly beat (Mon reset, Wed Weekly Standouts, Fri program drop, weekend Flash Windows), seasons of about 5 weeks with their own pass, check-in card, Live Event and finale, and a yearly arc. The arc climbs to Hot Season Honors (94–97) in mid-January and peaks with a sparse 98–99 **Perfect Season Finale** in late June.
3. **Every season is tied to the real NBA/NFL calendar**, using dates the leagues have confirmed (marked *projected* when only the pattern is known).
4. **Controlled power creep** (FC 27 lessons: slower climb from weak to strong, faster climb from strong to elite, Evolutions capped below the top promos). Program bands follow the typical-squad curve: a program's top sits near the typical squad at launch, and its floor sits about 6 below so its cards also feed SBCs. Only the Finale goes above 97 (plus one Summer Heat card per sport). That is **0.8% of NBA specials and 0.7% of NFL specials at 98–99**, counting the 55 weeks of Weekly Standouts.
5. **Coins only.** Program Packs cost about one week of an engaged player's earnings (FC parity: a weekly haul buys about one promo pack). Free paths (objectives, check-in, pass, events) always lead to at least one program card per season.
6. **Original names.** No TOTW/TOTY/TOTS/FUT/FUTTIES/Lightning/Thunderstruck/"Ones to Watch". League trademarks are not used as program names: "Big Game Sunday", not "Super Bowl"; "Honor Roll Week", not "Pro Bowl"; "Cup Crown", not "NBA Cup". League event names appear only in the real-world calendar notes. *Owner call:* "Summer League" and "All-Star Break" are the season names the owner suggested and are kept. They are league event terms, so rename them to "Summer Run" / "Midseason Stars" if that's preferred. Their programs already use original names.
7. **Saves are sacred.** The live `season:1` (2026-10-26 to 11-22, 25 tiers) is untouched. `season:2` starts 2026-11-23, the same start date the current 28-day `seasonFor` gives it. Every id is append-only. Generated promo cards get permanent edition ids (`<sport>:live:<promoId>:<season>:<pid>:<fr>`) that rebuild from the id alone.

## 2. The 12-month arc

| # | Season | Dates (Mon–Sun) | Wks | Real-world anchor | Headline programs (OVR) | Pass top reward |
|---|---|---|---|---|---|---|
| 1 | **Opening Tip** (live) | Oct 26 – Nov 22 | 4 | NBA opening night Oct 20, Cup group play | First Tip / Rookie Breakouts 84–89 · Landmark "Thirty a Night / Air Raid" 86–92 | existing tier 25 (Spotlight + 500) |
| 2 | **Gridiron Thanksgiving** | Nov 23 – Dec 20 | 4 | Thanksgiving Eve + 3 Thanksgiving games, Black Friday, Cup final Dec 11 (Indianapolis) | Feast Week / Cup Contenders 86–91 · Cup Crown / Snow Globe 87–92 · first Marquee 90 | Feast Week pick |
| 3 | **Holiday Hoops** | Dec 21 – Jan 10 | 3 | Christmas Eve/Day (5 NBA + 3 NFL games), NFL Week 18 | Holiday Hoops / Christmas Slate 88–92 · *Twelve Days* gift calendar | Holiday pick |
| 4 | **Hot Season** | Jan 11 – Feb 14 | 5 | Wild Card → Conf. Championships, MLK Day, trade deadline Feb 11, the big game Feb 14 at SoFi | **Hot Season Honors 94–97** (12 NBA / 24 NFL, 3 waves) · Hot Season Legends 92–96 · Perfect Pairs 88–92 | Honors pick (94–95) |
| 5 | **All-Star Break** | Feb 15 – Mar 21 | 5 | All-Star Phoenix Feb 19–21, tag window, Combine Mar 1–8, free agency Mar 11 | Desert All-Stars / Franchise Tag 89–93 · Next Up · Combine Kings · Free Agent Frenzy | All-Stars pick |
| 6 | **Playoff Push** | Mar 22 – Apr 25 | 5 | NBA final day Apr 11, play-in Apr 13–16, playoffs Apr 17 | Farewell Tour 87–92 · Underdog Run / Day One Starters · Postseason Primetime 90–94 | Primetime pick |
| 7 | **Draft Night** | Apr 26 – May 30 | 5 | NFL Draft Apr 29–May 1 (National Mall, D.C.), NBA 2nd round/conf. finals | Draft Night (3 waves by round) · Capital Classics · **Decade Dream Teams 90–96** (5 weekly waves, one 97 each) | Dream Teams pick |
| 8 | **Road to the Ring** | May 31 – Jul 4 | 5 | NBA Finals (~Jun 3), NBA Draft (~Jun 22), free agency Jun 30 6pm ET | Ring Night 93–96 · **Perfect Season Finale 98–99** (5 NBA / 8 NFL) · Lottery Night / Minicamp | Ring Night pick |
| 9 | **Summer League** | Jul 5 – Aug 8 | 5 | Las Vegas summer league (~Jul 9–19), camps open, Hall of Fame Game Aug 5, enshrinement Aug 7 | **Summer Heat 92–96** (4 waves, one 98 per sport) · Summer Run + Summer Lab Evo · Canton Class legends | Summer Heat pick |
| 10 | **Training Camp** | Aug 9 – Sep 12 | 5 | Preseason, Basketball HoF (early Sep), NFL Kickoff ~Sep 9 | Jersey Night / Camp Battles 90–94 · Springfield Class legends 92–96 · Kickoff Countdown 91–95 | Kickoff pick |
| 11 | **Kickoff** | Sep 13 – Oct 17 | 5 | NFL Weeks 1–6, NBA camps/preseason | Media Day / Primetime Lights 91–95 · Rivalry Week 92–96 | Rivalry pick |
| 12 | **Year Two: Opening Night** | Oct 18 – Nov 21 | 5 | NBA 2027-28 opening (~Oct 19), **game's 1st anniversary Oct 24** | Anniversary Club 93–96 (free pick) · First Tip II 90–94 | Anniversary pick |

Seasons S2–S11 (ten seasons) sit fully inside Nov 2026 – Oct 2027. S1 is the season already live, and S12 bridges into the next cycle. **After S12** the engine repeats seasons 2–12 shifted by 364 days (same weekdays), so content never stops. Promo ids get a `-y2` suffix, and `excludePrevious` rotates the cards so a repeat brings new players. The plan is still to refresh `schedule.json` each autumn with the next real calendar.

### The promo ladder across the year

| Window | Weekly Standouts | Programs | Elite tier |
|---|---|---|---|
| Nov–Dec | 80–90 | 84–92 | Marquee 90 |
| Jan–mid Feb | 82–92 | 85–92 | **Hot Season Honors 94–97**, Hot Season Legends 92–96 |
| mid Feb–Apr | 82–92 → 83–92 | 86–93 | Postseason Primetime 90–94 |
| May–Jun | 84–93 | 87–93 | Decade Dream Teams 90–96 (+5×97), Ring Night 93–96, **Finale 98–99** |
| Jul–Aug | 85–93 | 88–94 | Summer Heat 92–96 (+1×98 per sport), legends 92–96 |
| Sep–Nov | 85–93 | 90–96 | Anniversary 93–96 |

Volume per year (from schedule.json): **NBA ≈ 780 special cards** (440 Weekly Standouts + 340 program cards); **NFL ≈ 1,370** (825 + 542). Only 6 NBA and 9 NFL cards are 98–99.

## 3. Weekly rhythm template (Eastern time)

| Day | What changes | Systems touched (existing → new) |
|---|---|---|
| **Mon** 00:00 | **Weekly reset:** weekly objectives, 4 weekly SBCs, Squad Battles ladder, 3 Champions Circuit entries with this week's **Circuit theme** (opponent pool from the season's `circuit[week]` rule). Season *Path* objectives keep running. | `weekOf()` keys (sbc.ts, progression.ts, battles.ts, circuit.ts), plus calendar theme |
| **Tue** | Second wave day for multi-wave programs (Honors Backcourt/Offense, Cup Semifinal, Play-In). Scout Market refreshes, as it does every day. | calendar waves |
| **Wed** | **Weekly Standouts drop.** 8 NBA / 15 NFL season cards, +3 (featured +5), cap 97. A Standout week runs Wed→Tue (`weekOf(day − 2)`). The weekly SBC "Standout Squad" and the Monday objective "win 5 with 2 Standouts" pay out from the current set. | standouts.ts (UT-SPEC #3) |
| **Thu** | NFL "Thursday Night" objective (win 2 Thursday matches → Gold). A season's Live Event opens its nodes in thirds of its window: node *k* opens at start + ⌊k·len/3⌋ days, so a 10-day event opens nodes on days 0, 3 and 6. | events, objectives |
| **Fri** | **Program drop day.** A new program or wave goes into the Store's featured slot (Program Pack 5,000c + Program Guarantee 12,000c), program SBCs open, and a season objective is added. Most real-world tie-ins also land on a Friday (Black Friday, Christmas, New Year's Day, Hot Season Honors on Jan 15). | packs, sbc, objectives |
| **Sat** | **Weekend Flash Window #1** (2 h, a seeded pick of 4 slots: Sat 12–14 / 20–22, Sun 13–15 / 19–21). Standout Guarantee at 25% off, 1 per player. Weekend objectives open. | store flash |
| **Sun** | **Flash Window #2.** NFL "Sunday Slate" objective. Weekend objectives close 23:59. | store flash |
| Daily | 3 daily objectives, 6 daily SBCs + upgrades, **Daily Drop** free pack, Scout Market (12 cards), **season check-in stamp** (first UT match of the day). | existing + UT-SPEC packs |

Per season: about 5 weeks with 1 pass (20/25/30 levels × 300 SP; levels 26–30 are new and add-on only), a 10-stamp check-in card whose stamp 10 is a season program pick, a 4-step season *Path* (play 20 → Program Pack; win 15 → program pick; 8 SBCs → Elite Gold; 5 wins with 3+ program cards → Program Guarantee), 1–2 Live Events (3 nodes, boss legend, last node pays a program pick), 1 Moment reskin, 1 Landmark Seasons drop (SBC-only), and a finale week where the pass, the Path and the last program wave all close together.

## 4. Economy guardrails

- **Earnings today:** 60 coins per win and 30 per loss, multiplied by difficulty pay (0.6–2.2), over 8 paid games a day. Add 200 coins/day from daily objectives, 250 + packs from weekly objectives, and up to 1,250/week from the Circuit. An engaged player makes about **4,000–6,000 coins + 8–12 packs per week**.
- **Program Pack 5,000c** (8 NBA / 16 NFL cards: 3 rare golds, 4 golds, 1 program slot at 30%, otherwise a current Standout; max 3 per day) works out to about one per week. **Program Guarantee 12,000c** (5 rare golds + 1 guaranteed program card, 1 per week) is about 2–3 weeks of saving. Elite-tier packs cost more and hit less: Hot Season Pack 6,000c with a 6% Honors slot, Ring Night 7,000c with 8%, Dream Teams 6,000c with 20%, Summer Heat 6,500c with 15%.
- **Pack EV target 45–60% of price** at quick-sell/Item Score value (FC research). The implementer checks this with `economy.test.ts`.
- **Free path per season** ≥ 1 program pick (check-in stamp 10) + 1 program pick (Path: win 15) + 1 pass-top pick + event node 3. That is at least 3 program cards per season without spending.
- **Sinks:** every program has a repeatable SBC (2–3×) whose team-OVR target follows the curve (S2 83 → S6 87–90 → S9 92). Each season also has 1 marquee SBC (Honors Ceremony, The Perfect Season 99, Gold Jacket) that eats 11 cards including promos and legends. Item-Score SBCs (UT-SPEC) count duplicates.
- **Flash offers** are discounts, not new items: 20–30% off existing packs in 1–4 h windows with a per-player limit of 1. Black Friday has five windows. Christmas Day, New Year's Eve, deadline day (Swap Desk 4-for-1), big-game Sunday, final day, draft night, free-agency midnight (Scout Market 24 cards), July 4, Labor Day and the anniversary get one or two each.

## 5. Typical-squad OVR curve (FC research → our year)

The FC 27 research estimate for an engaged FC squad is: Sep 80–83, Oct 85–87, Nov 87–89, Dec 88–90, Jan 90–92, Feb–Mar 91–93, Apr–May 93–95, summer 95–97. Our game starts 6 weeks "later" (players began at the Oct 24 launch), so the curve is shifted and then flattens, because nothing resets each September:

| Date | Typical | Casual (−3) | Grinder (+1.5, cap 97.5) | What moves it |
|---|---|---|---|---|
| Nov 2 | 81.8 | 79 | 83.3 | starter + early golds, first Standouts |
| Nov 23 | 84.0 | 81 | 85.5 | First Tip, Thanksgiving programs |
| Dec 21 | 86.5 | 84 | 88.0 | Cup Crown, Holiday Hoops |
| Jan 11 | 88.0 | 85 | 89.5 | Holiday + Week-18 grind |
| **Jan 25** | **90.5** | 88 | 92.0 | **Hot Season Honors (+2.5 in two weeks: the year's biggest jump)** |
| Mar 22 | 92.0 | 89 | 93.5 | All-Star / Frenzy / landmarks |
| Apr 26 | 93.0 | 90 | 94.5 | Postseason Primetime |
| May 31 | 94.2 | 91 | 95.7 | Decade Dream Teams |
| Jul 5 | 95.2 | 92 | 96.7 | Ring Night + Finale |
| Sep 13 | 96.0 | 93 | 97.5 | Summer Heat, legends |
| Oct 18 | 96.3 | 93 | 97.5 | plateau; Year Two reopens the climb with Evolutions and new data |

`schedule.json` stores this per week (`ovrCurve.typical`). The engine uses it for three things. First, Live Event node targets: curve + the event's offsets, e.g. −3 / 0 / +3. Second, Squad Battles: the Pro ladder target is the curve − 2, replacing the fixed `TARGETS` drift. Third, SBC team-OVR sanity tests: a season's repeatable SBC must be fillable at curve − 3.

## 6. Data-driven selection, in one paragraph

Every promo has a `rule` per sport, an `ovrBand [lo, hi]`, a `delta`, a `count` and a pick policy: `top` takes the best base OVR, `seeded` is a seeded shuffle, plus `distinct: pid`, `maxPer: {fr|era|grp: n}`, optional `waves` (each with its own count/rule/position slots) and an optional `featured` card. Card OVR = `clamp(base_display + delta, lo, hi)`. That is a pure function of the season card and the promo, so an owned card rebuilds from its id even if the selection would come out differently later. The grammar uses only fields the card JSON already has: `fr`, `season`, `pos`, `grp`, `num`, `games`, `starts`, raw `stats`, percentile `rk`, `honors`, career position derived from the player's own lines, `traded` (two stints in one season), and the legend list. The implemented grammar is `src/ut/calendar-rules.ts`.

Validation highlights (players available ÷ cards needed): Hot Season Honors NBA 87/12 and NFL 523/24. Decade Dream Teams NBA 176/40 and NFL 523/75. Finale NBA 29/5 (`honor:MVP & rk:pts>=0.95`, top by base) and NFL 91/8. Two traps the check caught: NFL `stat:sk` on QBs means *sacks taken*, so sack rules must say `group:DL|LB`; and plain `career:last` includes active players, so retirement rules use `career:final`.

---


## 9. Soccer (arrives later)

The schema is sport-keyed (`{nba, nfl}`), and the engine skips any sport a promo doesn't list. When soccer ships, add a `soc` key to existing seasons rather than creating new ones. Each season then gets soccer rules on the same grammar (`franchise:` = club, `era:`, `honor:` once the soccer data carries honours, `pos:`). Natural hooks inside this calendar: European league openers in mid-August (S10 Training Camp / S11 Kickoff), the Champions League group/league phase (S11–S12), winter fixtures (S3 Holiday Hoops "Boxing Day"), and title races (S7 Draft Night / S8 Road to the Ring = "Season's End"). The 2026 World Cup is already over, so no tournament tie-in is needed in this cycle.

## 10. Open questions for the owner (answered: see the list at the top)

1. "Summer League" and "All-Star Break" season names are league event terms (kept because you suggested them). Rename to "Summer Run" / "Midseason Stars"?
2. The Finale's 99 is SBC-only, plus a 0.2% pack slot in Lottery Night packs. Do you want the 99 to be SBC-only?
3. The data drops (2026 NFL season lines in S5, 2026-27 NBA season lines in S9) need a `scripts/build_cards.py` run and touch `pool.print`, which means an online queue bump. Schedule them, or keep the card pool frozen for year one?
4. Squad Battles / Live Event difficulty following the curve changes AI squads only, not card ratings. That is single-player and needs no queue bump, but it does change difficulty for long-time players.

## 11. Sources (accessed 2026-11-01)

NBA 2026-27: [NBA.com key dates](https://www.nba.com/news/key-dates) (opening night Oct 20; Cup group play Oct 30–Nov 27, QF Dec 4–5, SF Dec 8–9, final Dec 11 at Hinkle Fieldhouse; Christmas slate; trade deadline Feb 11; All-Star Phoenix Feb 19–21; season ends Apr 11; play-in Apr 13–16; playoffs Apr 17; 2026 Finals Jun 3 / draft Jun 23–24 / free agency Jun 30 6pm ET / Summer League Jul 9–19 used as 2027 patterns) · [NBC key dates 2026-27](https://www.nbcnewyork.com/nba/nba-key-dates-2026-27-opening-night-trade-deadline-finals/6535379/) · [ESPN 2026 NBA Cup format](https://africa.espn.com/nba/story/_/id/49577473/2026-nba-season-tournament-cup-format-highlights-updates) · [Eurohoops: Cup final moves to Hinkle](https://www.eurohoops.net/en/nba-news/1986361/nba-cup-update-indianapolis-groups/) · [Fox News Christmas 2026 slate](https://www.foxnews.com/sports/2026-nba-christmas-games-schedule-matchups-start-times) · [NBA.com 2026 draft dates](https://www.nba.com/news/nba-draft-2026-set-barclays-center-june-23-24) · [2026 Summer League schedule](https://pr.nba.com/2026-nba-summer-league-schedule-announced/) · [basket-mag 2027 Summer League projection](https://www.basket-mag.com/us/nba-summer-league-2027-tickets-dates-schedule-prices-rosters/)

NFL 2026: [NFL.com 2026-27 important dates](https://www.nfl.com/news/2026-27-national-football-league-important-dates) (kickoff weekend Sep 9–14; Week 18 Jan 9–10; Wild Card Jan 16–18; Divisional Jan 23–24; Championships Jan 31; Super Bowl LXI Feb 14 at SoFi; tags Feb 17–Mar 3; Combine Mar 1–8; negotiating window Mar 9; league year Mar 11; Annual Meeting Mar 21–24; Draft Apr 29–May 1 D.C.) · [Bleacher Report holiday schedule](https://bleacherreport.com/articles/25428007-nfl-holiday-schedule-2026-released-previewing-thanksgiving-and-christmas-day-games) · [NBC Christmas games](https://www.nbcwashington.com/news/sports/nfl/nfl-christmas-schedule-games-2026-rams-seahawks/4104265/) · [FBSchedules: Super Bowl LXI at SoFi](https://fbschedules.com/super-bowl-lxi-to-be-played-at-sofi-stadium-in-los-angeles/) · [Super Bowl LXI (Wikipedia)](https://en.wikipedia.org/wiki/Super_Bowl_LXI) · [NFL.com 2027 draft in Washington](https://www.nfl.com/news/nfl-announces-dates-for-2027-draft-in-washington-d-c) · [PFT: free agency a day after the Combine](https://www.nbcsports.com/nfl/profootballtalk/rumor-mill/news/2027-free-agent-negotiating-window-will-open-a-day-after-the-combine-ends) · [Buccaneers.com: Combine moves to March](https://www.buccaneers.com/news/nfl-moves-start-of-scouting-combine-to-march-in-2027) · [Pro Football HoF tickets: 2027 HoF Game Aug 5, enshrinement Aug 7](https://www.profootballhof.com/tickets/index) · [CBS: Pro Bowl Games moved to Super Bowl week](https://www.cbssports.com/nfl/news/nfl-moves-the-pro-bowl-games-to-tuesday-of-super-bowl-week-in-events-host-city) (2027 date unconfirmed → *projected*)

Live-service cadence: [FC 27 promo calendar (Realsport101)](https://realsport101.com/article/fc-27-promo-calendar-confirmed-expected-dates-for-every-ultimate-team-campaign) (season 1–4 split, Friday 6pm UK drops, five fewer campaign weeks, TOTY expected Jan 15 2027) · [Fifauteam FC 27 promos](https://fifauteam.com/fc-27-promos-campaigns-events/) · [Dexerto FC 26 TOTW (Wednesday 6pm UK)](https://www.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/team-of-the-week-totw) · [FUT.GG FC 26 TOTS schedule](https://www.fut.gg/news/fc-26-team-of-the-season-release-dates-full-tots-schedule-confirmed/) · [EA FC 26 TOTS](https://www.ea.com/games/ea-sports-fc/fc-26/news/fc-26-tots) · [GamesRadar FC 26 TOTY schedule](https://www.gamesradar.com/games/ea-sports-fc/ea-fc-26-toty-release-schedule) · [FIFPlay FC 27 TOTW (23-player squads)](https://www.fifplay.com/fc-27-totw/) · [FUTWIZ FC 27 TOTW 4](https://www.futwiz.com/guides/fc-27-totw-4) · [NBA 2K26 Season Roundup (6-week seasons, 40 levels)](https://support.nba2k.com/hc/en-us/articles/50400543902867-NBA-2K26-Season-Roundup) · [Worthplaying: 2K26 Season 7 May 15](https://worthplaying.com/article/2026/5/13/news/149845-nba-2k26-season-7-begins-later-this-week-with-new-content-for-mycareer-myteam-and-the-w/) · [2K25 MyTEAM playbook (Friday weekly prizes)](https://nba.2k.com/2k25/the-game/myteam/season-playbook) · [Madden 26 Ultimate Team deep dive (seasonal + weekly passes, shared tokens)](https://www.mut.gg/news/madden-nfl-26-ultimate-team-deep-dive/) · [Madden 26 Gridiron Notes: Ultimate Team](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-ultimate-team) · [Madden 26 Season 7 dates](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-season-7) · plus the FC 27 pricing/odds/earnings research in [`../research/fc27-research.md`](../research/fc27-research.md).
