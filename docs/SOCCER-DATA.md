# Soccer data and cards (phase P1: data only)

**Implemented by Claude (Anthropic), 2026-11-01, branch `claude/soccer-data`.** This adds the data
and card pipeline for a third sport, soccer. Nothing is wired into the app yet: no `SportId`,
profile, queue, engine or UI changes. `src/ut/cards.ts` leaves `cards-soccer.json` out of its card
glob, so the file is neither bundled nor precached until soccer is wired in (phase P2). No saves,
keys, queues, card ids or ratings of NBA/NFL change.

## Files

| File | What | Size (raw / gzip) |
| --- | --- | --- |
| `scripts/soccer_sources.py` | download + cache sources, curated tables (clubs, colors, legends), Transfermarkt aggregate | - |
| `scripts/build_soccer_cards.py` | rating model, `src/data/cards-soccer.json`, sanity report | - |
| `scripts/build_soccer_data.py` | draft cells, `src/data/soccer.json` | - |
| `src/data/cards-soccer.json` | 29,943 lines (29,822 seasons + 121 legend-only), 277 promos, 132 legends | 3.69 MB / 0.99 MB |
| `src/data/soccer.json` | 287 club-decade cells (40 clubs, 1950s-2020s), 11,153 player lines, 75 great teams | 1.03 MB / 0.30 MB |
| `src/data/soccer-data.test.ts` | shape, ids, ranges, tier spread, famous seasons, legends, draft cells | - |

Total about 1.29 MB gzipped (budget 1.8 MB). Both are meant to load lazily. There is no
`soccer-attrs.json`: the card file already carries each line's six face stats and the draft rows
carry `att`/`mid`/`def`. Phase P2 can add gameplay attributes (speed, pass error, shot cone) from
these numbers.

## Sources and licenses

| Source | Used for | License / terms |
| --- | --- | --- |
| [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (dcaribou), public mirror `pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/` | players, appearances, games, game_events, game_lineups, clubs, competitions, club_games: league games, minutes, goals, assists, cards, lineups (position, number, captain), substitutions, goal types, heights, birth dates, career caps, Champions League games 2012-13 to 2025-26 | Dataset is CC0. Its facts were scraped from transfermarkt.co.uk, the same risk level as our Basketball-Reference data. We ship facts and our own ratings only. We never read market values, agents, contract details or photo URLs into an output. |
| [Wikidata](https://www.wikidata.org) SPARQL | legends' club spells (P54 with start/end, matches P1350, goals P1351), birth date, height, Transfermarkt id (P2446), club ids (P7223); Ballon d'Or winners (Q166177); notable pre-2012 players of the draft clubs (sitelinks as notability) | CC0. Queries are polite: one at a time, 2 s apart, a descriptive user agent, all results cached. |
| [openfootball/football.json](https://github.com/openfootball/football.json) | league results 2012-13 onward: cross-checks the champions computed from Transfermarkt (83 tables, all agree) | CC0 / public domain |
| Curated in the scripts | 40 draft clubs; colors and abbreviations of 254 clubs (identity colors only, no crests or kits); 132 legends and their estimated ratings; 90 trait nudges; men's Ballon d'Or 2010-2017 (Wikidata lacks the FIFA Ballon d'Or years), UEFA Men's Player of the Year 2013-2025, PFA Players' Player of the Year 2013-2025 | facts and our estimates |

Not used and not to be bundled: StatsBomb, FBref/Opta advanced stats, Understat xG, EA/sofifa
ratings. We did not fit to these either. Also not used: any EA naming (no FUT/TOTY/TOTS/FIFA
labels). Promo labels are factual award names, e.g. `BALLON D'OR 2015`, `GOLDEN BOOT 2018`,
`PLAYER OF THE SEASON 2017`, `CHAMPIONS 2020`.

## Rebuild

```sh
export SOCCER_DL=/somewhere/outside/the/repo   # or omit: <repo>/.cache/soccer (git-ignored)
python3 -I scripts/soccer_sources.py --dl "$SOCCER_DL"            # tm download, agg, openfootball, wikidata
python3 -I scripts/build_soccer_cards.py --dl "$SOCCER_DL"        # -> src/data/cards-soccer.json + report
python3 -I scripts/build_soccer_data.py --dl "$SOCCER_DL"         # -> src/data/soccer.json (reruns the model)
npx vitest run src/data/soccer-data.test.ts
```

The download is about 230 MB (game_lineups is 126 MB). The aggregate step takes about 1 minute,
the Wikidata step about 3 minutes cold (cached afterwards), and each build a few seconds.
`--step tm|agg|of|wd` runs one step and `--refresh` refetches. Wikidata changes over time: a
refetch can move a legend's spell numbers. Legend card ids use the Wikidata Transfermarkt id
(Pelé `17121`, Beckenbauer `72347`), which the test pins.

## Seasons, positions, ids

- Season = the year it ends (2014-15 is 2015), as for NBA cards. A South American legend's season
  is the calendar year.
- Pool: every club spell with 900+ league minutes in the Premier League, LaLiga, Serie A,
  Bundesliga, Ligue 1, Eredivisie or Primeira Liga, 2012-13 to 2025-26 (29,822 lines, 8,907
  players, 239 clubs).
- Position (GK CB FB DM CM AM W ST), from the Transfermarkt lineup position of each start, by
  minutes. Mapping: Left/Right-Back to FB; Left/Right Midfield and Wingers to W; Second Striker
  and Centre-Forward to ST; Sweeper to CB. Other positions with 25%+ of his minutes follow
  (`W/ST`), up to 3.
- Card id `soccer:<kind>:<season>:<pid>:<fr>`. `pid` is the Transfermarkt id, else the Wikidata
  Q-id. `fr` is our unique club code (`BAR`, `RMA`, `MUN`, `SB29` Brest...). Display `abbr` may
  repeat across clubs.

## Rating model

1. **League strength** L, from all 3,904 European cup games 2012-2026 between clubs whose
   domestic league is known. Ridge least squares (20 games' prior) of goal difference = home edge
   + L_home - L_away + k (club league GD/game home - away). Result: home edge 0.39, k 0.67.
   Centred on the seven leagues: GB1 +0.57, ES1 +0.38, L1 +0.27, IT1 +0.15, FR1 -0.07, PO1 -0.50,
   NL1 -0.80 goals/game.
2. **Club strength** T = L + k x club league GD per game that season.
3. **Per-player measures**, rates per 90 shrunk to the position mean with 900 minutes. Attacking
   rates are multiplied by exp(0.45 L). On-pitch goals for/against come from goal and substitution
   events (minute windows; red cards end a window). Events match the final score in 33,589 of
   33,603 games; the other 14 use minutes pro rata. On-pitch GA/90 is shrunk to the team's rate
   with 1,800 minutes, minus 0.5 L.
   - usage = U x exp(0.45 T), with U = minutes / (90 x team games)
   - role output by position: ST .70 npG90 + .15 G90 + .15 A90; W .5 G90 + .5 A90; AM .45/.55;
     CM .3 G90 + .4 A90 - .3 GA90; DM .1/.1/-.8; FB .1 G90 + .3 A90 - .6 GA90; CB .1 G90 - .9 GA90;
     GK -.65 GA90 + .35 clean-sheet rate (all z-scores within season and position)
   - on/off = on-pitch GD/90 minus off-pitch GD/90 (both shrunk with 1,800 minutes)
   - honours = league title 1, Champions League win (3+ CL games) 1, Ballon d'Or 3, UEFA player
     of the year 2, PFA player of the year 1.5, golden boot 1.2, assists title (8+) 0.8,
     captaincy share up to 0.5, career caps (log, to 100) up to 0.8, CL games up to 0.4
4. **Q0** = .40 usage + .35 role + .15 on/off + .10 honours, each as a z-score within season and
   position, clipped to [-3, 4] (honours to 10, so a Ballon d'Or season stands out).
   **Q** = Q0 blended toward the player's minutes-weighted Q0 in his other seasons, with weight
   0.30 x n/(n+1) for n other seasons. Stars are consistent; a squad player's one outlier season
   is pulled back.
5. **Overall**: Q's percentile within the season, mapped piecewise-linearly to p0 48, p5 57, p10
   60, p25 65.5, p50 70, p75 75, p90 79, p97 83, p99 86, p99.8 89, top 93. A Ballon d'Or season is
   at least 90.
6. **Tiers**: bronze < 65, silver 65-74, gold 75+.

### Face stats

PAC SHO PAS DRI DEF PHY (keepers DIV HAN KIC REF SPD POS) = template[pos] at 75 + beta (OVR - 75)
+ evidence + traits. beta is 1.0 for stats weighted 0.10+ in the position, else 0.6. Then the
position-weighted overall of the six is shifted onto the target overall *before* clamping to
25-99, so the profile keeps its shape. Any clamped remainder moves onto the other weighted stats.
The six always agree with the OVR.

Templates (at 75) and overall weights:

| pos | PAC SHO PAS DRI DEF PHY | weights |
| --- | --- | --- |
| ST | 77 76 64 73 35 72 | SHO .45 DRI .18 PAC .15 PHY .12 PAS .10 |
| W | 84 70 71 79 38 63 | DRI .30 PAC .25 SHO .20 PAS .20 PHY .05 |
| AM | 74 71 77 79 50 63 | PAS .30 DRI .30 SHO .20 PAC .10 DEF .05 PHY .05 |
| CM | 68 66 75 74 66 71 | PAS .35 DRI .20 DEF .15 PHY .15 SHO .10 PAC .05 |
| DM | 63 58 70 68 74 76 | DEF .35 PAS .25 PHY .25 DRI .10 PAC .05 |
| FB | 79 52 68 72 72 71 | DEF .30 PAC .25 PAS .20 PHY .15 DRI .10 |
| CB | 64 40 56 57 77 79 | DEF .55 PHY .30 PAC .10 PAS .05 |
| GK | DIV 76 HAN 73 KIC 70 REF 77 SPD 50 POS 74 | REF .25 DIV .22 POS .22 HAN .20 KIC .08 SPD .03 |

Evidence (SD units within season and position, clipped at 2.5):
- SHO: +6/SD non-penalty G90 for ST/W/AM, else +4/SD G90.
- PAS: +5/SD A90, plus +2/SD cross/corner assists for FB/W.
- DEF: -5/SD on-pitch GA90 for CB/FB/DM/CM.
- PHY: +2.5 height, +1.5 yellow cards/90, +1.5 share of full 90s.
- PAC: -0.8/yr after 28, +0.6/yr under 24, -2 per SD of height.
- DRI: -1 per SD of height, +G+A for W/AM/ST, -0.4/yr after 31.
- Keepers: DIV/REF/HAN/POS from on-pitch GA90 and clean-sheet rate, DIV from height, SPD from age.

**PAC, DRI and DEF are estimates.** The data has no tracking, dribbling or tackling numbers.
`TRAITS_TABLE` in `build_soccer_cards.py` holds 90 curated nudges for well-known players (Messi
DRI+7, Mbappé PAC+13, Neuer KIC+6 SPD+10...). They change the shape of the six, not the OVR.

### Legends

`LEGENDS_TABLE` in `soccer_sources.py` has 132 curated all-time greats. Each has one peak spell
(club and season) and an estimated overall of 88-97. Our scale: a season's best player is about
93, 97 is the very best ever (Pelé, Maradona, Messi). Each also has a few face-trait nudges.
- A peak from 2012-13 on (Messi, Ronaldo, Lahm, Neymar, Modrić, Lewandowski, Ramos, Neuer,
  Suárez, Benzema, Ibrahimović) uses that real Transfermarkt season. The legend OVR is at least
  the season OVR + 2; the boost is the difference.
- Earlier peaks get a legend-only line (`cols.est = 1`, `sparse = 1`, no season card of its own).
  It carries the spell's Wikidata league apps/goals and seasons, the peak season and the club. The
  line's own `ovr` is the legend's minus 4 (boost 4).
- Peak clubs outside the seven leagues' data use extra team rows: Santos, Flamengo, Botafogo,
  Corinthians, Fluminense, Boca Juniors, River Plate, Dynamo Moscow, Dynamo Kyiv, Honvéd,
  Ferencváros, Dukla Prague, Celtic, Blackburn.

## Card file layout (`cards-soccer.json`)

Same column layout as `cards-nba.json` (`build_cards.py`, `src/ut/cards.ts` `CardsFile`). Soccer
additions:
- `groups`: `OUT` stats `apps starts min g a pen yc rc cl clg yrs`, ranks `g90 a90 usage onoff def q`;
  `GK` stats `apps starts min cs ga yc rc cl yrs`, ranks `ga90 cs usage onoff q`. Ranks are
  permille within season and position. `cl`/`clg` are Champions League games/goals; `yrs` is
  seasons in the line (a legend spell).
- `players`: `[pid, name, height cm, null]`. Height is in **cm**, not inches.
- `teams`: `[fr, abbr, name, c1, c2]`.
- `honors`: `CHAMP UCL BOOT ASSIST BDOR UEFA POTY`.
- `cols.lg`: index into `leagues` (`GB1 ES1 IT1 L1 FR1 NL1 PO1`), null for legend-only lines.
- `cols.ovr`: season overall. `cols.face`: six ints in `faceKeys[OUT|GK]` order. `cols.est`.
- `promos` / `legends`: `[line, boost, label, ovr, face]`. The last two are that edition's own
  overall and face stats, so the app needs no soccer rating code to show a card.
- Promos (277, 0.9%): Ballon d'Or +5, player of the year/season +4, golden boot +3, assists title
  +3, best player of each league champion +3. +1 with two reasons, max +6, OVR max 97.

## Draft file layout (`soccer.json`)

Shape of `nba.json`/`nfl.json`: `{source, built: 2026, fields, positions, teams, playoff}`.
- `teams`: club x decade cells (`BAR-2010`, era `2010s`, `from`/`to`, `c1`/`c2`).
- Row fields: `name pos apps seasons from to est prime pid g a cs min ovr att mid def`. `g a cs min`
  are per season, -1 if unknown.
- 2012-13 to 2025-26 rows are real league stats. Their rating is the minutes-weighted mean of the
  season OVRs.
- Before that (and 2010-12 inside the 2010s), rows come from two sources. Legends' spells at the
  draft clubs: curated OVR in the peak spell, -2 in its other decades, -3 in other spells; only
  spells of 30+ apps or 3+ seasons. Notable Wikidata club spells: 8+ sitelinks, 30+ apps or 3+
  seasons, OVR estimated as 66 + 14 p^1.5 (p = sitelink percentile) + up to 4 for games per season
  + up to 2 for length of stay, capped at 86. Both carry `est = 1`.
- Cells need 11+ players. 29 thin 1950s-70s cells are left out (listed in the build output).
- `playoff`: 75 great teams (every top-five-league champion and every Champions League winner,
  2012-13 to 2025-26). Fields: W-D-L, points, `wFull` (wins per 38), goals per game, `champ`,
  `ucl`, and a 4-3-3 `xi` of `[name, pos, apps, g, a, ovr]`.

The 40 draft clubs: MUN LIV ARS CHE MCI TOT EVE NEW AVL; RMA BAR ATM VAL SEV ATH VIL; JUV MIL INT
ROM LAZ NAP FIO; FCB(Bayern) BVB B04 S04 BMG HSV; PSG OM OL ASM LIL; AJA PSV FEY; SLB FCP SCP.

## Sanity check (build output, 2026-11-01)

| Player | Season | Club | Pos | OVR | Face |
| --- | --- | --- | --- | --- | --- |
| Lionel Messi | 2014-15 | BAR | W/ST | 93 | PAC 92 SHO 93 PAS 93 DRI 99 DEF 39 PHY 59 |
| Cristiano Ronaldo | 2013-14 | RMA | W | 92 | 92 99 91 90 42 78 |
| Robert Lewandowski | 2019-20 | FCB | ST | 92 | 86 99 76 88 38 92 |
| Erling Haaland | 2022-23 | MCI | ST | 93 | 90 99 83 83 38 97 |
| Mohamed Salah | 2017-18 | LIV | W | 92 | 97 93 92 92 39 61 |
| Virgil van Dijk | 2018-19 | LIV | CB | 91 | 69 47 61 55 97 92 |
| Kevin De Bruyne | 2019-20 | MCI | CM/AM | 93 | 77 95 99 91 92 87 |
| Luka Modrić | 2017-18 | RMA | CM | 90 | 78 80 99 94 88 77 |
| Manuel Neuer | 2013-14 | FCB | GK | 88 | DIV 91 HAN 87 KIC 79 REF 91 SPD 63 POS 89 (top keeper of the season) |
| N'Golo Kanté | 2016-17 | CHE | DM | 88 | 78 59 80 82 99 85 |
| Kylian Mbappé | 2023-24 | PSG | ST/W | 86 | 95 91 69 82 34 76 |
| Kylian Mbappé | 2024-25 | RMA | ST | 88 | 96 96 64 83 34 77 |
| Harry Kane | 2025-26 | FCB | ST | 93 | 84 99 88 91 39 89 |
| Rodri | 2023-24 | MCI | DM | 93 | 61 74 97 79 98 94 |
| Lamine Yamal | 2024-25 | BAR | W | 91 | 94 84 95 95 39 62 |
| Jan Oblak | 2015-16 | ATM | GK | 85 | |
| Jamie Vardy | 2015-16 | LEI | ST | 84 | |
| Troy Deeney | 2015-16 | WAT | ST | 77 | |
| Glenn Murray | 2018-19 | BHA | ST | 73 (silver) | |
| Moussa Sissoko | 2018-19 | TOT | W/DM/CM | 74 (silver) | |

Season leaders come out right: 2015 Messi, Ronaldo, Neymar; 2018 Messi, Salah, De Bruyne; 2020
De Bruyne, Lewandowski, Messi; 2023 Haaland, De Bruyne, Salah; 2024 Rodri, Foden, Kane; 2026
Kane, Olise, Haaland. The top keeper is Neuer in 2013-2016, 2020 and 2025, and Ederson in most of 2018-2023.

Distribution of season cards: bronze 6,642 (22%), silver 14,980 (50%), gold 8,200 (27%). The
spread is about the same at every position (gold 26-30%). Players rated 85+: GK 45, CB 81, FB 87,
DM 52, CM 73, AM 35, W 129, ST 93. Gold share by league: Premier League 52%, LaLiga 36%,
Bundesliga 35%, Serie A 27%, Ligue 1 19%, Primeira Liga 10%, Eredivisie 7%.

## Known gaps and estimates

- Mbappé 2023-24 (PSG, 2,159 league minutes) is 86. His 2024-25 Real Madrid season is 88. If
  "Mbappé 2024" means 2024-25, it fits; otherwise this is a model judgement on a part-time
  Ligue 1 season.
- Defenders and defensive midfielders are rated through team goals against, on/off and usage;
  there are no tackling numbers. A regular in the best defence can rate high (e.g. Eric García
  2025-26 88). The career blend damps one-off seasons but cannot remove this.
- Premier League journeymen at mid-table clubs land at 75-78 (low gold). That follows from the
  league strength fit. The weakest PL regulars are silver.
- National-team tournament games are not in the dataset's appearances (only the 2026 World Cup).
  Caps are career totals as of the dataset date.
- The Champions League 2025-26 final is not in the dataset, so no `UCL` honour for 2026.
- Pre-2012 draft cells use spell totals, not per-season stats. Wikidata has gaps (some spells have
  no apps/goals, shown as -1), positions are often coarse (midfielder/forward/defender), and
  ratings are notability estimates. 29 early cells are too thin to keep.
- The Ballon d'Or year is mapped to the season ending that year. Before 2022 the award was by
  calendar year.
- `TRAITS_TABLE` and `LEGENDS_TABLE` ratings and nudges are our documented estimates, not data.
- Online play: nothing changes. Soccer has no queue or protocol yet. NBA 8 / NFL 9 are unaffected.
