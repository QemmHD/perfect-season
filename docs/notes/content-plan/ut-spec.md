# Ultimate Team build spec (research, 2026-11-01)

The condensed spec that content drop 2 was built from. What shipped, with final prices and odds, is in [`docs/UT-CONTENT-2.md`](../../UT-CONTENT-2.md); the rating problems in section D were fixed by the ratings rework ([`docs/RATINGS-AUDIT.md`](../../RATINGS-AUDIT.md)). Pool measurements came from throwaway `npx vite-node` scripts. All OVR numbers here are on the **old** rating scale (gold 85+), before the FC-style display scale.

## Measured problems (D)
1. OVR overstates the 6 face stats shown on card: median OVR − face mean: NBA gold +7 (p90 +12.3), NBA promo +5.8, NFL gold +7.2 (Jokić 98 over avg 84). Causes: profileQuality rating-quality.ts:135 (0.35 wavg + 0.65 best-three); calibrateNba calibration.ts:126,147 (+4, quality +8); rateCard rate.ts:219–221 support +2/+8. Face stats = NBA_KEYS per position not OVR inputs. Fix: universal category face stats built from the same weights as OVR; |OVR − weighted category mean| ≤ 3. NBA: OUT(3PT/MID/FT) INS(CLS/LAY/DNK/SDK) PLY(HND/PAS) ATH(SPD/ACC/VRT/STR/STA) DEF(PRD/IND/STL/BLK) REB. NFL: keep position key stats but OVR must follow from them.
2. Hot Season promos pile at 99 (NBA 259/518 = 50% are 99, 76% 95+; NFL 404/1106 = 37%). Fix: promo OVR = base + delta capped 97; choose seasons across gold band; leave 98–99 to Legends. IDs unchanged.
3. NFL OL and K inflated: 66/98 NFL season 99s are OT/OG; 2025 has 26 players 95+, 4 kickers (Reichard 99). Drake Maye 98 > Josh Allen 94. Madden 26 launch had 7–8 99s. Fix: cap per position percentile; ~1–2 per position-season at 95+; 3–6 99s per season.
4. Levels add ~+4 OVR at L5 (380 NBA / 1057 NFL base cards reach 99 at L5). Recommend +1 at L3 and +1 at L5 (max +2) rest to attributes — changes owned levels' effect (owner sign-off; owner gave full control).
5. Gold share by position uneven: NBA PG 19.2%, C 18.4% vs SF 8.8%, SG 10.2%; NFL C 22.2%, OG 18.9% vs TE 6.4%, DT 9.9%. Fix: per-position percentile normalization so ~13–15% gold each.
6. Narrow tier bands (NFL bronze <84 = 67% of pool, silver 84–88; NBA gold 85+ = 14%). Don't move cuts; add additive `rare` flag for top ~35% of golds per position, used in pack guarantees.
Targets: NBA gold 85–87 ≈50%, 88–90 ≈28%, 91–94 ≈16%, 95+ ≈6%. Standouts 85–97 uniform; Hot Season 88–97; Landmark 88–99; Legends 90–99 with ≤10% at 99 (now 22/120 NBA, 42/130 NFL at 99); Spotlight 100–105, GOAT 106–110 unchanged.
Online: any rating change alters pool.print → bump queues NBA 8→9, NFL 9→10.
Real refs: 2K26 launch 23 players 90+, Jokić/SGA 98 (ours matches at top).

## Pack sims (current): NBA Gold P(90+) 19.1%, 92+ 8.3%, 95+ 1.9%, special 2.2%; Premium 90+ 36%, special 6.6%; NFL Gold 93+ in 68%. ≈2× FC generosity (fine). Spotlight half the packs give a special — too generous.

## Five new packs (NBA/NFL sizes)
1. Daily Drop 3/6 free once per Eastern day: 2 (NFL 5) slots bronze 50/silver 50; last slot silver 60 / gold 38 / Weekly Standout 2. 7-day streak: day 7 = Gold pack.
2. Scout's Choice (pick 1 of 3) 1,500: three golds ≥ onScale(84) (NBA≈91), same position group in NFL; 3% an option is a Standout. 3/week; also SBC/objective reward.
3. Elite Gold 6/12, 3,000: all rare golds; 1 slot Standout 10% / Legend 1%. 2/day.
4. Jumbo Premium 16/32, 3,200: 4 silver, 11 gold, 1 premiumPlus; 7 rare golds. 1/day.
5. Standout Guarantee 8/16, 4,500: 7 golds (≥3 rare) + 1 guaranteed current Weekly Standout (featured 10%). 1/week. Lightning copy 25% off Sat/Sun 2h windows, limited stock.
Existing: Gold 900 → 1 rare guaranteed; promo slot 1.5% Standout + 0.5% Hot Season; Legend 0.2%. Premium 1,800 → 3 rare guaranteed; promo slot 4% Standout + 2% Hot Season; Legend 0.66%. Spotlight: suggest 8%/3%/20% (needs backend deploy — SPOTLIGHT_RATES in supabase/functions/card-registry/contract.ts; DO NOT change, server-side; leave as is). Position 700 → 3 golds, 1 rare. Store sections: Featured · Gold · Bronze & Silver · Picks · My Packs.

## Two promos
1. Weekly Standouts (TOTW-inspired): each ISO week seeded from easternDateKey pick 8 NBA / 15 NFL season cards base OVR between onScale(70)..onScale(86); one Featured themed card. Standard +3 OVR, featured +5, cap 97. Attributes: position's top-3 weighted attrs (roleWeights) full delta, other weighted +1, physicals ≤+1, FT unchanged. Obtained: pack slots, weekly SBC "Standout Squad" (8 golds, team OVR onScale(78)) pays random current Standout; weekly objective win 5 with 2+ Standouts → Standout pick. Art: midnight navy, teal pulse/EKG stripe, "WK 44" stamp. ID `<sport>:standout:<week>:<season>:<pid>:<fr>`, kind `standout`.
2. Landmark Seasons (Flashback/Record-breaker): real statistical landmarks from our data (30+ ppg, reb/ast titles, 4,000 pass yds, 1,500 rush yds, 15+ sacks, 10+ INT). OVR base +5 cap 99; landmark attrs +6 (scorer 3PT/MID/CLS/LAY; rebounder REB/BLK/IND; passer PAS/HND; NFL rusher BTK/JKM/CAR/BCV), others +1, keep weak skills weak. Printed landmark line ("31.4 PPG"). SBC-only + first-clear Moments rewards. Art: sepia film grain, box-score ticker band, gold laurel.

## Top 10 features
1 Daily Drop + login streak (packs.ts PackKind daily, Store.tsx hero, state dailyDrop{day,streak}).
2 Scout's Choice player picks (packs.ts pickOptions, PickSheet in PackOpening.tsx, UltimateTeam.tsx flow; rewards in sbc.ts/progression.ts).
3 Weekly Standouts program (new standouts.ts, cards.ts, rate.ts, CardArt.tsx + card-editions.css t-standout, sbc.ts rotating SBC).
4 Universal face stats + OVR consistency (rate.ts, rating-quality.ts, CardArt.tsx utc-attrs, CardDetail.tsx, ratings-audit test).
5 Rare golds + pack guarantees (pool.ts, packDefs, CardArt shimmer, OddsSheet wording).
6 Scout Market: 12 cards/day deterministic, fixed price ≈3× quick-sell (gold ≥300, promo ≥1,500), each buyable once; Swap Desk: 5 duplicate golds → Scout's Choice (market.ts, Store tab, state marketBought).
7 Per-player chemistry pips 0–3 from franchise/decade/season links (squad.ts chemistry(), SquadView, CardArt) — gameplay, queue bump.
8 Draft mode: captain 1 of 5, then 1 of 5 per slot, up to 4 wins vs AI ladder; rewards 0 Silver / 2 Gold / 4 Elite Gold; entry 800 coins or weekly free token (draft.ts, Clubhouse Play hub, Match.tsx temp squad, play.ts settle).
9 Pack Helper tags on reveal: NEW / UPGRADE +N / SET / SBC FODDER; "send duplicates to storage / quick sell all" bar (PackOpening.tsx, squad.ts, collection.ts).
10 Franchise/era Set Collections paying coins + Landmark/Scout's Choice; Development Lab FC-style evolutions with eligibility caps stored on owned copy additively (collection.ts, CollectionGallery.tsx, club-management.ts, Clubhouse.tsx, rate.ts).
Names original: Weekly Standouts, Landmark Seasons, Scout's Choice, Daily Drop.
