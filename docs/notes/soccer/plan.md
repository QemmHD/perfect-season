# Soccer plan (research, 2026-11-01)

The condensed research plan for the third sport. What was built is in [`docs/SOCCER-DATA.md`](../../SOCCER-DATA.md), [`docs/SOCCER-ENGINE.md`](../../SOCCER-ENGINE.md) and [`docs/SOCCER.md`](../../SOCCER.md); sources and licences are credited in [`docs/CREDITS.md`](../../CREDITS.md).

Data (downloads tested):
- MAIN: dcaribou/transfermarkt-datasets (dataset CC0; scraped origin = same risk level as Basketball-Reference data). 2012-07..2026-06. players 4.4MB, appearances 45MB, game_events 45MB, game_lineups 126MB, games 5MB (gz). Top-5 + NED + POR, >=900 min: 29,738 player-seasons / 8,895 players. Ship only facts + our own ratings (no market values/photos/agents). Lineups give position/number/captain, games give formations, events give goal type/assist type, subs+goal minutes → on-pitch GF/GA per 90.
- Pre-2012 legends: Wikidata (CC0) club spells with apps/goals (Pelé, Cruyff, Messi...), Ballon d'Or, positions, height, birth dates. Curated ~120 must-have legends list (like NBA_MUST) with documented estimates.
- openfootball (CC0) league tables/champions; martj42/international_results (CC0).
- DO NOT bundle: StatsBomb, FBref/Opta advanced stats, Understat xG, EA/sofifa FIFA ratings (don't fit to them either). football-data.co.uk / engsoccerdata offline only.

Ratings: per player-season-club spell. League Elo from cross-league UEFA games; club strength = PPG/GD within league × league strength. Usage U = minutes/(90×team games). Per-90 rates shrunk to position prior (900-min prior; on-pitch GD 1800). Q = .40·(U×clubStrength) + .35·role output + .15·on-pitch GD (vs off) + .10·honours/caps, as within-season percentiles. OVR via quantile map: p50=70, p75=75, p90=79, p97=83, p99=86, p99.8=89, max=93. Tiers FC-like: bronze<65, silver 65–74, gold 75+.
Face stats PAC/SHO/PAS/DRI/DEF/PHY = clamp(T[pos] + β(OVR−75) + evidence, 25, 99). Templates at OVR 75:
ST 77/76/64/73/35/72; W 84/70/71/79/38/63; AM 74/71/77/79/50/63; CM 68/66/75/74/66/71; DM 63/58/70/68/74/76; FB 79/52/68/72/72/71; CB 64/40/56/57/77/79; GK DIV/HAN/KIC/REF/SPD/POS 76/73/70/77/50/74.
Evidence: SHO +6/SD npG90, PAS +5/SD A90 (+cross assists → crossing), DEF +5/SD (−on-pitch GA90), PHY height/cards/90-min completion/headers, PAC age curve (−0.8/yr after 28) & role & height; weak foot from L/R goal split; PEN from conversion. Recompute OVR from face stats with position weights (ST: SHO .45 DRI .18 PAC .15 PHY .12 PAS .10) then shift to the quantile target. Label PAC/DRI/DEF as estimates.

Wiring (as it was before soccer landed): SportId/UtSport only 'nba'|'nfl'. 252 sport branches in 72 files mostly `NFL ? a : b` → soccer would silently fall to NBA. Add typed pick({nba,nfl,soccer}) helper. Profiles: lib/profile.ts assumes two sports (new key perfect-season:profile:soccer:v1 additive; generalize "other sport" helpers; recovery.ts + cloud snapshot). Supabase CHECK sport in ('nba','nfl') → needs owner migration for soccer serials (skip numbering for soccer initially). engine/data.ts imports nba.json/nfl.json directly (3.6MB main chunk) — load soccer lazily.

Draft/season: slots GK, CB, FB, DM/CM, CM/AM, W, ST, FLEX; 38 games; W-D-L + points; knockout with shootouts. Sim engine src/game/soccer/sim.ts (Poisson team attack vs defense).

Arcade match ("Attacks", Retro Goal-like, one-sided like our engines): 6 attacks each (3/half), ≤30s each + stoppage; scenarios: build-up, 3v2 counter, wide overload, corner, free kick, penalty on box foul. Results G/S/W/B/L/O/T. Tie → 5-kick shootout. Controls: joystick (reuse NFL two-axis), PASS (tap ground / hold lofted/cross), THRU, SHOOT (hold power meter with green window, aim stick, swipe curl), SPRINT (shared stamina). Defense zonal block, press+cover, offside line; tackles DEF vs DRI within 1.2m; GK positions on angle bisector, dive from DIV/REF, HAN catch vs parry. Speed 6.8–9.4 m/s from PAC; pass error 7°→1.5° by PAS; shot cone from SHO. Render: reuse pixel/persp.ts camera; new pixel/pitch.ts; kits from uniforms.ts; CMU subject 10 kick clips exist.
UT: formations 4-3-3/4-4-2/4-2-3-1/3-5-2/5-3-2 with club/league/nation links; six-stat card face; league 20 clubs/38 games with draws.
Size budget: ≤1.8MB gz all lazy.
Risks: data rights, EA branding (no FUT/TOTY/TOTS/FIFA names or crests), draws everywhere assume a winner, NBA fallback branches.
