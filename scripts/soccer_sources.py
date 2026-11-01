"""Soccer sources: download, cache and pre-aggregate everything the soccer data and card builds read
(Python 3 standard library only). Nothing here is shipped as is: build_soccer_cards.py and
build_soccer_data.py turn the cached aggregate into src/data/cards-soccer.json and soccer.json.
See docs/SOCCER-DATA.md.

Sources (all fetched once into the cache folder, never into the repo):
  transfermarkt-datasets (github.com/dcaribou/transfermarkt-datasets, dataset CC0; facts scraped
    from transfermarkt.co.uk): players, appearances, games, game_events, game_lineups, clubs,
    competitions, club_games, from the project's public mirror. We read facts only (games, goals,
    assists, minutes, cards, lineups, positions, numbers, height, birth date, foot, caps); market
    values, agents and photo URLs are never read into the outputs.
  Wikidata (CC0) SPARQL: the curated legends' club spells (P54 with start/end, matches P1350,
    goals P1351), birth date, height, Transfermarkt id (P2446); notable pre-2012 players of the
    draft clubs (sitelinks as notability); Ballon d'Or winners (Q166177). Polite: one request at a
    time, 2 s apart, a descriptive user agent, results cached.
  openfootball/football.json (CC0/public domain): league results 2012-13 on, used to cross-check
    the league champions computed from the Transfermarkt games.

The curated legends (LEGENDS below) are ~130 all-time greats with an estimated overall for one
peak spell each (88-97). These ratings are our own estimates (documented in docs/SOCCER-DATA.md),
not from any game.

Usage: python3 -I scripts/soccer_sources.py [--dl DIR] [--step all|tm|agg|wd|of] [--refresh]
  --dl  cache folder (default $SOCCER_DL or <repo>/.cache/soccer). Keep it outside the repo or in
        the git-ignored .cache.
"""

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DL = os.environ.get("SOCCER_DL") or os.path.join(HERE, "..", ".cache", "soccer")
UA = "PerfectSeasonDataBuild/1.0 (offline build of a game's sports data; github.com/QemmHD/perfect-season)"
TM_BASE = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/"
TM_FILES = ["players", "appearances", "games", "game_events", "game_lineups", "clubs", "competitions", "club_games"]
OF_BASE = "https://raw.githubusercontent.com/openfootball/football.json/master/"
WDQS = "https://query.wikidata.org/sparql"

csv.field_size_limit(1 << 24)

# the seven leagues the cards cover, and the season range (a season is named by the year it ends: 2014-15 is 2015)
LEAGUES = {"GB1": "Premier League", "ES1": "LaLiga", "IT1": "Serie A", "L1": "Bundesliga", "FR1": "Ligue 1", "NL1": "Eredivisie", "PO1": "Primeira Liga"}
FIRST, LAST = 2013, 2026  # Transfermarkt seasons 2012-13 .. 2025-26 (the dataset's start years 2012..2025)
EURO_CUPS = {"CL", "CLQ", "EL", "ELQ", "UCOL", "ECLQ", "USC"}
NATIONS_CUPS = {"FIWC", "EURO", "COPA", "AFCN", "AFAC"}
OF_LEAGUES = {"GB1": "en.1", "ES1": "es.1", "IT1": "it.1", "L1": "de.1", "FR1": "fr.1", "NL1": "nl.1", "PO1": "pt.1"}

# ---------------------------------------------------------------- clubs
# Transfermarkt club id | franchise code (unique, used in card ids) | display abbreviation | short name | color 1 | color 2
# Colors are the clubs' main identity colors (approximate, hand-picked; no crests or kits are used).
CLUB_TABLE = """
131|BAR|BAR|FC Barcelona|#A50044|#004D98
418|RMA|RMA|Real Madrid|#00529F|#FEBE10
13|ATM|ATM|Atlético Madrid|#CB3524|#272E61
1049|VAL|VAL|Valencia|#000000|#EE7623
368|SEV|SEV|Sevilla|#D8001E|#FFFFFF
621|ATH|ATH|Athletic Club|#EE2523|#FFFFFF
1050|VIL|VIL|Villarreal|#FFE667|#005187
1084|MAL|MAL|Málaga|#0A4DA2|#FFFFFF
1108|ALA|ALA|Alavés|#1E5BC6|#FFFFFF
12321|GIR|GIR|Girona|#CD2534|#FFFFFF
1244|LEG|LEG|Leganés|#0050A0|#FFFFFF
142|ZAR|ZAR|Real Zaragoza|#0B4EA2|#FFFFFF
150|BET|BET|Real Betis|#00954C|#FFFFFF
1531|ELC|ELC|Elche|#05642C|#FFFFFF
1533|EIB|EIB|Eibar|#A6192E|#003DA5
16795|GRA|GRA|Granada|#C8102E|#FFFFFF
237|MLL|MLL|Mallorca|#E20613|#000000
2448|SPG|SPG|Sporting Gijón|#E30613|#FFFFFF
2497|OVI|OVI|Real Oviedo|#0057B8|#FFFFFF
2687|CAD|CAD|Cádiz|#FFE000|#0045A5
3302|ALM|ALM|Almería|#E30613|#FFFFFF
331|OSA|OSA|Osasuna|#D91A21|#0A346F
3368|LEV|LEV|Levante|#B4053F|#004D98
366|VLL|VLL|Real Valladolid|#5C2D91|#FFFFFF
367|RAY|RAY|Rayo Vallecano|#E53027|#FFFFFF
3709|GET|GET|Getafe|#005999|#FFFFFF
472|LPA|LPA|Las Palmas|#FFE400|#0055A4
5358|HUE|HUE|Huesca|#0D2D6C|#B30838
681|RSO|RSO|Real Sociedad|#0067B1|#FFFFFF
714|ESP|ESP|Espanyol|#007FC8|#FFFFFF
897|DEP|DEP|Deportivo La Coruña|#0067B1|#FFFFFF
940|CEL|CEL|Celta Vigo|#8AC3EE|#E30613
993|COR|COR|Córdoba|#006633|#FFFFFF
583|PSG|PSG|Paris Saint-Germain|#004170|#DA291C
244|OM|OM|Marseille|#2FAEE0|#FFFFFF
1041|OL|OL|Lyon|#1B3F8B|#DA001A
162|ASM|ASM|Monaco|#E7001C|#FFFFFF
1082|LIL|LIL|Lille|#E01E13|#1A2D5A
10004|PFC|PFC|Paris FC|#13294B|#8CC8EC
1095|TRO|TRO|Troyes|#0055A4|#FFFFFF
1147|ACA|ACA|AC Ajaccio|#E30613|#FFFFFF
1158|LOR|LOR|Lorient|#F58113|#000000
1159|ASN|NCY|Nancy|#E2001A|#FFFFFF
1160|NIM|NIM|Nîmes|#E30613|#FFFFFF
1162|CAE|CAE|Caen|#004B93|#E2001A
1416|AMI|AMI|Amiens|#1A1A1A|#FFFFFF
14171|ETG|ETG|Évian TG|#E5007D|#FFFFFF
1420|ANG|ANG|Angers|#000000|#FFFFFF
1421|REI|REI|Reims|#E30613|#FFFFFF
1423|VAF|VAF|Valenciennes|#E2001A|#FFFFFF
273|REN|REN|Rennes|#E13327|#000000
290|AUX|AUX|Auxerre|#0055A4|#FFFFFF
2969|DIJ|DIJ|Dijon|#E2001A|#FFFFFF
347|MET|MET|Metz|#8C1E3C|#FFFFFF
3524|CLE|CLE|Clermont|#C8102E|#0B2240
3558|GFC|GFC|GFC Ajaccio|#E2001A|#1F4E9E
3911|SB29|BRS|Brest|#E30613|#FFFFFF
40|BOR|BOR|Bordeaux|#0B2240|#FFFFFF
415|TFC|TFC|Toulouse|#6B2C91|#FFFFFF
417|NIC|NIC|Nice|#E30613|#000000
595|BAS|BAS|Bastia|#0055A4|#FFFFFF
618|STE|STE|Saint-Étienne|#009639|#FFFFFF
667|STR|STR|Strasbourg|#009FE3|#FFFFFF
738|HAC|HAC|Le Havre|#8AC6F0|#0B2D5B
750|SOC|SOC|Sochaux|#FFD200|#003F87
826|RCL|RCL|Lens|#FFD100|#E30613
855|GUI|GUI|Guingamp|#E30613|#000000
969|MHSC|MTP|Montpellier|#F58113|#002B5C
995|FCN|NAN|Nantes|#FCD405|#008B3D
985|MUN|MUN|Manchester United|#DA291C|#FBE122
31|LIV|LIV|Liverpool|#C8102E|#00B2A9
11|ARS|ARS|Arsenal|#EF0107|#FFFFFF
631|CHE|CHE|Chelsea|#034694|#FFFFFF
281|MCI|MCI|Manchester City|#6CABDD|#1C2C5B
148|TOT|TOT|Tottenham Hotspur|#132257|#FFFFFF
29|EVE|EVE|Everton|#003399|#FFFFFF
762|NEW|NEW|Newcastle United|#241F20|#FFFFFF
405|AVL|AVL|Aston Villa|#670E36|#95BFE5
1003|LEI|LEI|Leicester City|#003090|#FDBE11
1010|WAT|WAT|Watford|#FBEE23|#ED2127
1031|LUT|LUT|Luton Town|#F78F1E|#002D62
1032|REA|REA|Reading|#004494|#FFFFFF
1039|QPR|QPR|Queens Park Rangers|#1D5BA4|#FFFFFF
1071|WIG|WIG|Wigan Athletic|#1D59AF|#FFFFFF
1110|HUD|HUD|Huddersfield Town|#0E63AD|#FFFFFF
1123|NOR|NOR|Norwich City|#FFF200|#00A650
1132|BUR|BUR|Burnley|#6C1D45|#99D6EA
1148|BRE|BRE|Brentford|#E30613|#FFFFFF
1237|BHA|BHA|Brighton|#0057B8|#FFFFFF
180|SOU|SOU|Southampton|#D71920|#FFFFFF
2288|SWA|SWA|Swansea City|#121212|#FFFFFF
289|SUN|SUN|Sunderland|#EB172B|#FFFFFF
3008|HUL|HUL|Hull City|#F5A12D|#000000
350|SHU|SHU|Sheffield United|#EE2737|#000000
379|WHU|WHU|West Ham United|#7A263A|#1BB1E7
399|LEE|LEE|Leeds United|#1D428A|#FFCD00
512|STK|STK|Stoke City|#E03A3E|#FFFFFF
543|WOL|WOL|Wolves|#FDB913|#231F20
603|CAR|CAR|Cardiff City|#0070B5|#D11524
641|MID|MID|Middlesbrough|#E11B22|#FFFFFF
677|IPS|IPS|Ipswich Town|#3A64A3|#FFFFFF
703|NFO|NFO|Nottingham Forest|#DD0000|#FFFFFF
873|CRY|CRY|Crystal Palace|#1B458F|#C4122E
931|FUL|FUL|Fulham|#000000|#FFFFFF
984|WBA|WBA|West Bromwich Albion|#122F67|#FFFFFF
989|BOU|BOU|Bournemouth|#DA291C|#000000
506|JUV|JUV|Juventus|#000000|#FFFFFF
5|MIL|MIL|AC Milan|#FB090B|#000000
46|INT|INT|Inter|#0068A8|#000000
12|ROM|ROM|Roma|#8E1F2F|#F0BC42
398|LAZ|LAZ|Lazio|#87D8F7|#0B2240
6195|NAP|NAP|Napoli|#12A0D7|#FFFFFF
430|FIO|FIO|Fiorentina|#482E92|#FFFFFF
800|ATA|ATA|Atalanta|#1E71B8|#000000
1005|LEC|LEC|Lecce|#FFED00|#E30613
1025|BOL|BOL|Bologna|#1A2F48|#A21C26
1038|SAM|SAM|Sampdoria|#1B5497|#FFFFFF
1047|COM|COM|Como|#1C3F94|#FFFFFF
1210|LVR|LIV|Livorno|#9E1B32|#FFFFFF
130|PAR|PAR|Parma|#FFD200|#1B4594
1387|SIE|SIE|Siena|#000000|#FFFFFF
1390|CAG|CAG|Cagliari|#A6192E|#002350
1429|CES|CES|Cesena|#000000|#FFFFFF
1627|CAT|CAT|Catania|#E2001A|#0055A4
19|BSC|BRE|Brescia|#0055A4|#FFFFFF
2239|CRE|CRE|Cremonese|#B40E2D|#8A8D8F
252|GEN|GEN|Genoa|#A6192E|#002350
2722|SPAL|SPA|SPAL|#0064AF|#FFFFFF
276|HVR|VER|Hellas Verona|#002F6C|#FFD200
2919|MNZ|MON|Monza|#E2001A|#FFFFFF
2921|PES|PES|Pescara|#0074C1|#FFFFFF
3522|SPE|SPE|Spezia|#000000|#FFFFFF
380|SAL|SAL|Salernitana|#8B1F2F|#FFFFFF
4083|CRO|CRO|Crotone|#E30613|#0055A4
410|UDI|UDI|Udinese|#000000|#FFFFFF
4102|CRP|CRP|Carpi|#E2001A|#FFFFFF
416|TOR|TOR|Torino|#8A1E03|#FFFFFF
4171|BNV|BEN|Benevento|#F7C600|#E30613
4172|PIS|PIS|Pisa|#00205B|#000000
458|PAL|PAL|Palermo|#F5B7C5|#000000
607|VEN|VEN|Venezia|#000000|#F58220
6574|SAS|SAS|Sassuolo|#00A752|#000000
749|EMP|EMP|Empoli|#005CA9|#FFFFFF
862|CHV|CHI|Chievo Verona|#FFE600|#0055A4
8970|FRO|FRO|Frosinone|#FFE600|#0055A4
27|FCB|FCB|Bayern Munich|#DC052D|#0066B2
16|BVB|BVB|Borussia Dortmund|#FDE100|#000000
15|B04|B04|Bayer Leverkusen|#E32221|#000000
33|S04|S04|Schalke 04|#004D9D|#FFFFFF
18|BMG|BMG|Borussia Mönchengladbach|#000000|#00A651
41|HSV|HSV|Hamburger SV|#0A3F86|#FFFFFF
10|DSC|DSC|Arminia Bielefeld|#004E95|#000000
105|D98|D98|Darmstadt 98|#004E9E|#FFFFFF
127|P07|SCP|Paderborn|#005CA9|#000000
167|FCA|FCA|Augsburg|#BA3733|#46714D
2036|FCH|FCH|Heidenheim|#E30613|#003B79
23|EBS|EBS|Eintracht Braunschweig|#FFD200|#0055A4
23826|RBL|RBL|RB Leipzig|#DD0741|#001F47
24|SGE|SGE|Eintracht Frankfurt|#E1000F|#000000
269|KSV|KSV|Holstein Kiel|#003C8A|#FFFFFF
3|KOE|KOE|1. FC Köln|#ED1C24|#FFFFFF
35|STP|STP|St. Pauli|#624839|#FFFFFF
38|F95|F95|Fortuna Düsseldorf|#E30613|#FFFFFF
39|M05|M05|Mainz 05|#C3141E|#FFFFFF
4|FCNU|FCN|1. FC Nürnberg|#AA1124|#000000
42|H96|H96|Hannover 96|#E30613|#009036
44|BSC2|BSC|Hertha BSC|#005CA9|#FFFFFF
4795|FCI|FCI|Ingolstadt|#E30613|#000000
533|TSG|TSG|Hoffenheim|#1961B5|#FFFFFF
60|SCF|SCF|SC Freiburg|#E2001A|#000000
65|SGF|SGF|Greuther Fürth|#009639|#FFFFFF
79|VFB|VFB|VfB Stuttgart|#E32219|#FFFFFF
80|BOC|BOC|VfL Bochum|#005BA4|#FFFFFF
82|WOB|WOB|VfL Wolfsburg|#65B32E|#FFFFFF
86|SVW|SVW|Werder Bremen|#1D9053|#FFFFFF
89|FCU|FCU|Union Berlin|#EB1923|#FFFFFF
610|AJA|AJA|Ajax|#D2122E|#FFFFFF
383|PSV|PSV|PSV Eindhoven|#ED1C24|#FFFFFF
234|FEY|FEY|Feyenoord|#EE1C25|#FFFFFF
1090|AZ|AZ|AZ Alkmaar|#DB0021|#FFFFFF
1268|ADO|ADO|ADO Den Haag|#00813D|#FFD200
1269|PEC|PEC|PEC Zwolle|#005CA9|#FFFFFF
1283|EMM|EMM|FC Emmen|#E30613|#FFFFFF
1304|HER|HER|Heracles Almelo|#000000|#FFFFFF
132|NAC|NAC|NAC Breda|#FFD200|#000000
133|CAM|CAM|Cambuur|#FFD200|#0055A4
1426|VVV|VVV|VVV-Venlo|#FFD200|#000000
1434|TEL|TEL|Telstar|#E30613|#FFFFFF
1435|GAE|GAE|Go Ahead Eagles|#E30613|#FFD200
1455|DOR|DOR|FC Dordrecht|#E30613|#FFFFFF
192|RJC|RJC|Roda JC|#FFD200|#000000
200|UTR|UTR|FC Utrecht|#E30613|#FFFFFF
202|GRO|GRO|FC Groningen|#00A651|#FFFFFF
235|RKC|RKC|RKC Waalwijk|#FFD200|#0055A4
306|HEE|HEE|Heerenveen|#0055A4|#FFFFFF
317|TWE|TWE|FC Twente|#E30613|#FFFFFF
385|FOR|FOR|Fortuna Sittard|#FFD200|#009639
403|WIL|WIL|Willem II|#E30613|#0055A4
467|NEC|NEC|NEC Nijmegen|#D50032|#009639
468|SPR|SPR|Sparta Rotterdam|#E30613|#FFFFFF
499|VIT|VIT|Vitesse|#FFD200|#000000
642|DGR|DGR|De Graafschap|#0055A4|#FFFFFF
723|ALC|ALC|Almere City|#E30613|#000000
724|VOL|VOL|FC Volendam|#F58220|#FFFFFF
798|EXC|EXC|Excelsior|#E30613|#000000
294|SLB|SLB|Benfica|#E83030|#FFFFFF
720|FCP|FCP|FC Porto|#0B3B8C|#FFFFFF
336|SCP|SCP|Sporting CP|#00A859|#FFFFFF
1075|SCB|SCB|SC Braga|#E30613|#FFFFFF
1085|VSE|VSE|Vitória Setúbal|#009639|#FFFFFF
110302|AVS|AVS|AVS|#E30613|#FFFFFF
1301|MAR|MAR|Marítimo|#E30613|#009639
1436|BMA|BMA|Beira-Mar|#FFD200|#000000
1465|EST|EST|Estoril|#FFD200|#0055A4
2420|VSC|VSC|Vitória Guimarães|#000000|#FFFFFF
2423|STC|STC|Santa Clara|#E30613|#FFFFFF
2424|GIL|GIL|Gil Vicente|#E30613|#0055A4
2425|RAV|RAV|Rio Ave|#009639|#FFFFFF
2431|EAM|EAM|Estrela Amadora|#E30613|#009639
2457|BSAD|BSA|B SAD|#0055A4|#FFFFFF
2503|BOA|BOA|Boavista|#000000|#FFFFFF
2521|ALV|ALV|Alverca|#E30613|#FFFFFF
2990|AAC|AAC|Académica|#000000|#FFFFFF
2995|PFE|PAC|Paços de Ferreira|#FFD200|#009639
3268|CPA|CPA|Casa Pia|#000000|#FFFFFF
3325|CHA|CHA|Chaves|#E30613|#0055A4
3327|PEN|PEN|Penafiel|#E30613|#000000
3329|FAM|FAM|Famalicão|#0055A4|#FFFFFF
3336|AVE|AVE|Desportivo Aves|#E30613|#FFFFFF
3349|FEI|FEI|Feirense|#0055A4|#FFFFFF
4294|FAR|FAR|Farense|#000000|#FFFFFF
4750|OLH|OLH|Olhanense|#E30613|#000000
68608|BEL|BEL|Belenenses|#0055A4|#FFFFFF
6912|VIZ|VIZ|Vizela|#0055A4|#FFFFFF
7179|TON|TON|Tondela|#FFD200|#009639
7378|POR|POR|Portimonense|#000000|#FFFFFF
8024|ARO|ARO|Arouca|#FFD200|#0055A4
976|UMA|UMA|União Madeira|#FFD200|#0055A4
979|MOR|MOR|Moreirense|#009639|#FFFFFF
982|CDN|NAC|Nacional|#000000|#FFFFFF
"""

# clubs outside the seven leagues' 2012-2026 data, for legends' peak spells: fr | abbr | name | c1 | c2 | Wikidata label pattern
EXTRA_TABLE = """
SAN|SAN|Santos|#000000|#FFFFFF|^Santos F
FLA|FLA|Flamengo|#C3281E|#000000|Flamengo
BOT|BOT|Botafogo|#000000|#FFFFFF|^Botafogo
CRN|COR|Corinthians|#000000|#FFFFFF|Corinthians
FLU|FLU|Fluminense|#870A28|#00613C|^Fluminense
BJR|BOC|Boca Juniors|#103F79|#F3B229|Boca Juniors
RIV|RIV|River Plate|#E30613|#FFFFFF|River Plate$
DYN|DYN|Dynamo Moscow|#0055A4|#FFFFFF|Dynamo Moscow
DYK|DYK|Dynamo Kyiv|#FFFFFF|#0055A4|Dynamo Kyiv
HON|HON|Honvéd|#E30613|#000000|Honvéd
FTC|FTC|Ferencváros|#009639|#FFFFFF|Ferencváros
DUK|DUK|Dukla Prague|#A6192E|#FFD200|Dukla Prag
CFC|CEL|Celtic|#018749|#FFFFFF|^Celtic F
BLB|BLB|Blackburn Rovers|#009EE0|#FFFFFF|Blackburn Rovers
"""

# The draft game's clubs: about forty big clubs with history, from the seven leagues.
BIG = ["MUN", "LIV", "ARS", "CHE", "MCI", "TOT", "EVE", "NEW", "AVL",
       "RMA", "BAR", "ATM", "VAL", "SEV", "ATH", "VIL",
       "JUV", "MIL", "INT", "ROM", "LAZ", "NAP", "FIO",
       "FCB", "BVB", "B04", "S04", "BMG", "HSV",
       "PSG", "OM", "OL", "ASM", "LIL",
       "AJA", "PSV", "FEY",
       "SLB", "FCP", "SCP"]


def clubs():
    """{tm id: dict(fr, abbr, name, c1, c2)} and {fr: same, plus tm, pattern}."""
    by_tm, by_fr = {}, {}
    for row in CLUB_TABLE.strip().splitlines():
        tm, fr, abbr, name, c1, c2 = row.split("|")
        d = {"tm": tm, "fr": fr, "abbr": abbr, "name": name, "c1": c1, "c2": c2}
        by_tm[tm] = d
        by_fr[fr] = d
    for row in EXTRA_TABLE.strip().splitlines():
        fr, abbr, name, c1, c2, pat = row.split("|")
        by_fr[fr] = {"tm": None, "fr": fr, "abbr": abbr, "name": name, "c1": c1, "c2": c2, "pat": pat}
    assert len(by_fr) == len(set(by_fr)), "franchise codes must be unique"
    return by_tm, by_fr


# ---------------------------------------------------------------- curated legends
# name | other Wikidata labels (;) | birth year | position (GK CB FB DM CM AM W ST) | club (franchise code)
# | peak season (the year it ends; 1971-72 is 1972; South American clubs the calendar year) | overall | face tweaks
# Overall: our estimate of the player at that peak, on the card scale where a season's best
# player is about 93 (88 = an all-time great's peak, 97 = the very best ever). Tweaks nudge face
# stats for well-known traits (e.g. "PAC+4"). A peak season from 2013 on uses that real
# Transfermarkt season as the legend's line; earlier ones get their spell's Wikidata totals.
LEGENDS_TABLE = """
Pelé||1940|ST|SAN|1962|97|DRI+2 SHO+2
Diego Maradona|Diego Armando Maradona|1960|AM|NAP|1987|97|DRI+4 PAC-2
Lionel Messi||1987|W|BAR|2015|97|DRI+3
Cristiano Ronaldo||1985|ST|RMA|2015|96|SHO+3 PHY+3
Johan Cruyff|Johan Cruijff|1947|AM|AJA|1972|96|DRI+2 PAS+2
Alfredo Di Stéfano|Alfredo Di Stefano|1926|ST|RMA|1957|95|PHY+2 PAS+2
Franz Beckenbauer||1945|CB|FCB|1974|95|PAS+8 DRI+6
Ronaldo|Ronaldo Nazário|1976|ST|BAR|1997|95|PAC+3 DRI+4
Zinedine Zidane||1972|AM|RMA|2002|95|DRI+3 PAS+2 PAC-4
Ferenc Puskás|Ferenc Puskas|1927|ST|RMA|1960|94|SHO+4 PAC-4
Eusébio|Eusebio|1942|ST|SLB|1965|94|PAC+3 SHO+2
Michel Platini||1955|AM|JUV|1985|94|PAS+3 SHO+2 PAC-4
Gerd Müller|Gerd Muller|1945|ST|FCB|1972|94|SHO+5 PAC-4 PAS-4
Marco van Basten||1964|ST|MIL|1989|94|SHO+3
Paolo Maldini||1968|FB|MIL|1994|93|DEF+5 PHY+2
Franco Baresi||1960|CB|MIL|1989|93|DEF+4 PAS+3
Ronaldinho||1980|AM|BAR|2006|93|DRI+5 DEF-6
Lev Yashin||1929|GK|DYN|1963|93|REF+2 POS+2
Garrincha||1933|W|BOT|1962|93|DRI+5 PAS-2
George Best||1946|W|MUN|1968|92|DRI+3
Bobby Charlton||1937|AM|MUN|1966|92|SHO+4
Xavi|Xavi Hernández|1980|CM|BAR|2011|92|PAS+6 PAC-6 PHY-4
Andrés Iniesta|Andres Iniesta|1984|CM|BAR|2011|91|DRI+5 PAS+3 PHY-4
Lothar Matthäus|Lothar Matthaus|1961|CM|INT|1990|91|PHY+3 SHO+2
Thierry Henry||1977|ST|ARS|2004|92|PAC+4
Zico||1953|AM|FLA|1981|92|SHO+2
Roberto Baggio||1967|AM|JUV|1993|91|DRI+2 SHO+2
Gianluigi Buffon||1978|GK|JUV|2006|92|REF+2
Kaká|Kaka|1982|AM|MIL|2007|91|PAC+4 DRI+2
Andriy Shevchenko|Andrei Shevchenko|1976|ST|MIL|2004|91|PAC+2
Luís Figo|Luis Figo|1972|W|BAR|2000|90|PAS+3 DRI+2
Rivaldo||1972|AM|BAR|1999|90|SHO+3
Romário|Romario|1966|ST|BAR|1994|91|SHO+3 PHY-4
Fabio Cannavaro||1973|CB|JUV|2006|90|DEF+3 PAC+2
Alessandro Nesta||1976|CB|MIL|2003|90|DEF+4
Andrea Pirlo||1979|CM|MIL|2007|90|PAS+7 PAC-8 DEF-3
Francesco Totti||1976|AM|ROM|2007|90|PAS+3 SHO+2 PAC-4
Alessandro Del Piero||1974|ST|JUV|1998|90|DRI+2
Raúl|Raúl González|1977|ST|RMA|2001|90|
Philipp Lahm||1983|FB|FCB|2013|90|PAS+2 DEF+2
Oliver Kahn||1969|GK|FCB|2001|90|REF+2 HAN+1
Steven Gerrard||1980|CM|LIV|2009|89|SHO+4 PAS+2
Frank Lampard||1978|CM|CHE|2005|89|SHO+5
Eric Cantona|Éric Cantona|1966|ST|MUN|1994|89|PAS+3 PHY+2
Ryan Giggs||1973|W|MUN|1999|88|PAC+2
Paul Scholes||1974|CM|MUN|2003|88|PAS+4
David Beckham||1975|W|MUN|1999|89|PAS+8 PAC-5 DRI-3
Kenny Dalglish||1951|ST|LIV|1979|90|PAS+3
Kevin Keegan||1951|ST|HSV|1979|89|
Karl-Heinz Rummenigge||1955|ST|FCB|1981|90|PAC+2
Sepp Maier||1944|GK|FCB|1974|89|
Paul Breitner||1951|CM|FCB|1981|89|SHO+2
Günter Netzer|Gunter Netzer|1944|AM|BMG|1972|89|PAS+4
Matthias Sammer||1967|CB|BVB|1996|89|PAS+3 DRI+3
Michael Laudrup||1964|AM|BAR|1992|89|PAS+4
Hristo Stoichkov||1966|W|BAR|1994|90|SHO+4
Ruud Gullit||1962|AM|MIL|1988|90|PHY+5
Frank Rijkaard||1962|DM|MIL|1990|89|PHY+2
Ronald Koeman||1963|CB|BAR|1992|89|SHO+12 PAS+6 PAC-5
Dennis Bergkamp||1969|ST|ARS|1998|89|PAS+6 DRI+3 PAC-3
Patrick Vieira||1976|DM|ARS|2004|89|PHY+3
Clarence Seedorf||1976|CM|MIL|2007|88|
Edwin van der Sar||1970|GK|MUN|2009|88|KIC+4
Ruud van Nistelrooy||1976|ST|MUN|2003|89|SHO+2
Johan Neeskens||1951|CM|AJA|1973|89|
Ruud Krol||1949|FB|AJA|1973|88|
Willem van Hanegem|Wim van Hanegem|1944|CM|FEY|1970|88|PAS+3
Roberto Carlos||1973|FB|RMA|2002|89|PAC+5 SHO+6
Cafu||1970|FB|MIL|2004|89|PAC+3
Sócrates|Socrates|1954|AM|CRN|1982|90|PAS+3 PAC-3
Carlos Alberto Torres|Carlos Alberto|1944|FB|SAN|1970|89|
Jairzinho||1944|W|BOT|1970|89|
Nílton Santos|Nilton Santos|1925|FB|BOT|1958|88|
Samuel Eto'o||1981|ST|BAR|2006|89|PAC+2
Didier Drogba||1978|ST|CHE|2010|89|PHY+4
George Weah||1966|ST|MIL|1996|89|PAC+2
Hugo Sánchez|Hugo Sanchez|1958|ST|RMA|1990|89|SHO+3
Emilio Butragueño||1963|ST|RMA|1987|88|
Fernando Hierro||1968|CB|RMA|1998|88|SHO+3
Iker Casillas||1981|GK|RMA|2008|90|REF+3
Carles Puyol||1978|CB|BAR|2009|89|DEF+2
Xabi Alonso||1981|DM|RMA|2012|88|PAS+5
David Villa||1981|ST|VAL|2009|88|
Fernando Torres||1984|ST|LIV|2008|88|PAC+3
Luis Suárez Miramontes|Luis Suárez|1935|AM|BAR|1960|90|PAS+3
Francisco Gento|Paco Gento|1933|W|RMA|1958|89|PAC+5
Raymond Kopa||1931|AM|RMA|1958|89|DRI+3
Just Fontaine||1933|ST|REI|1958|89|SHO+3
Bobby Moore||1941|CB|WHU|1966|90|DEF+3 PAS+3 PAC-3
Gordon Banks||1937|GK|LEI|1966|89|
Denis Law||1940|ST|MUN|1964|90|
Gary Lineker||1960|ST|EVE|1986|88|
Alan Shearer||1970|ST|NEW|1997|89|SHO+2 PHY+2
Peter Schmeichel||1963|GK|MUN|1999|89|
Roy Keane||1971|CM|MUN|2000|88|PHY+3
John Terry||1980|CB|CHE|2005|88|
Rio Ferdinand||1978|CB|MUN|2008|88|PAC+2
Wayne Rooney||1985|ST|MUN|2010|89|
Ian Rush||1961|ST|LIV|1984|88|
Gianni Rivera||1943|AM|MIL|1969|89|PAS+3
Giacinto Facchetti||1942|FB|INT|1965|89|SHO+2
Sandro Mazzola|Alessandro Mazzola|1942|AM|INT|1965|88|
Luigi Riva|Gigi Riva|1944|ST|CAG|1970|89|SHO+3
Dino Zoff||1942|GK|JUV|1973|89|
Gaetano Scirea||1953|CB|JUV|1982|88|PAS+3
Paolo Rossi||1956|ST|JUV|1982|88|
Gabriel Batistuta||1969|ST|FIO|1996|89|SHO+4
Javier Zanetti||1973|FB|INT|2010|88|
Pavel Nedvěd|Pavel Nedved|1972|AM|JUV|2003|89|SHO+2
Juan Román Riquelme|Juan Roman Riquelme|1978|AM|VIL|2006|88|PAS+4 PAC-5
Mario Kempes||1954|ST|VAL|1978|88|
Daniel Passarella||1953|CB|RIV|1978|88|
Fernando Redondo||1969|DM|RMA|1998|88|PAS+3
Deco||1977|AM|FCP|2004|88|PAS+2
Rui Costa||1972|AM|FIO|1999|88|PAS+3
Mário Coluna|Mario Coluna|1935|CM|SLB|1962|88|
Michael Ballack||1976|CM|B04|2002|88|SHO+2
Uwe Seeler||1936|ST|HSV|1964|88|
Oleg Blokhin||1952|W|DYK|1975|89|PAC+4
Josef Masopust||1931|CM|DUK|1962|88|
Sándor Kocsis|Sandor Kocsis|1929|ST|HON|1954|89|
Flórián Albert|Florian Albert|1941|ST|FTC|1967|88|
Petr Čech|Petr Cech|1982|GK|CHE|2005|89|
Henrik Larsson||1971|ST|CFC|2001|88|
Zlatan Ibrahimović|Zlatan Ibrahimovic|1981|ST|PSG|2016|89|PHY+3
Neymar||1992|W|BAR|2015|90|DRI+3
Luka Modrić|Luka Modric|1985|CM|RMA|2018|90|PAS+2
Robert Lewandowski||1988|ST|FCB|2020|91|
Sergio Ramos||1986|CB|RMA|2017|89|
Manuel Neuer||1986|GK|FCB|2014|90|KIC+4 SPD+6
Luis Suárez||1987|ST|BAR|2016|89|
Karim Benzema||1987|ST|RMA|2022|89|
"""


def legends():
    out = []
    for row in LEGENDS_TABLE.strip().splitlines():
        name, alt, born, pos, fr, peak, ovr, tw = row.split("|")
        tweaks = {}
        for t in tw.split():
            m = re.match(r"([A-Z]{3})([+-]\d+)$", t)
            tweaks[m.group(1)] = int(m.group(2))
        out.append({"name": name, "labels": [name] + [a for a in alt.split(";") if a], "born": int(born), "pos": pos,
                    "fr": fr, "peak": int(peak), "ovr": int(ovr), "tweaks": tweaks})
    return out


# ---------------------------------------------------------------- fetching


def fetch(url, path, refresh=False, binary=True):
    if os.path.exists(path) and not refresh:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            os.replace(path + ".part", path)
            return path
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(5 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("could not fetch " + url)


def tm_download(dl, refresh=False):
    for f in TM_FILES:
        p = fetch(TM_BASE + f + ".csv.gz", os.path.join(dl, "tm", f + ".csv.gz"), refresh)
        print("tm", f, os.path.getsize(p))


def tm_rows(dl, name):
    with gzip.open(os.path.join(dl, "tm", name + ".csv.gz"), "rt", encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f)


_last_query = [0.0]


def sparql(dl, key, query, refresh=False):
    """One Wikidata query, cached by key; 2 s between live requests."""
    path = os.path.join(dl, "wikidata", key + ".json")
    if os.path.exists(path) and not refresh:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wait = 2.0 - (time.time() - _last_query[0])
    if wait > 0:
        time.sleep(wait)
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    req = urllib.request.Request(WDQS, data=data, headers={"User-Agent": UA, "Accept": "application/sparql-results+json",
                                                            "Content-Type": "application/x-www-form-urlencoded"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                res = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(int(e.headers.get("Retry-After") or 10 * (attempt + 1)))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(10 * (attempt + 1))
    else:
        raise RuntimeError("wikidata query failed: " + key)
    _last_query[0] = time.time()
    rows = [{k: v["value"] for k, v in b.items()} for b in res["results"]["bindings"]]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    return rows


def qid(uri):
    return uri.rsplit("/", 1)[-1]


def year(ts):
    m = re.match(r"(-?\d{4})", ts or "")
    return int(m.group(1)) if m else None


def numv(x):
    try:
        return int(round(float(x)))
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- Wikidata


def wd_all(dl, refresh=False):
    by_tm, by_fr = clubs()
    # 1. club items from their Transfermarkt ids
    vals = " ".join('"%s"' % t for t in by_tm)
    rows = sparql(dl, "clubs", 'SELECT ?club ?tm WHERE { VALUES ?tm { %s } ?club wdt:P7223 ?tm . }' % vals, refresh)
    club_q = {}
    for r in rows:
        club_q.setdefault(r["tm"], qid(r["club"]))
    print("wikidata: %d of %d clubs matched" % (len(club_q), len(by_tm)))

    # 2. the curated legends: find each by label + birth year (most sitelinks wins)
    leg = legends()
    labels = sorted({l for x in leg for l in x["labels"]})
    cand = defaultdict(list)
    for i in range(0, len(labels), 40):
        chunk = labels[i:i + 40]
        vals = " ".join('"%s"@en' % l.replace('"', '\\"') for l in chunk)
        tag = hashlib.sha1(vals.encode()).hexdigest()[:10]
        q = ('SELECT ?p ?l ?dob ?sl WHERE { VALUES ?l { %s } ?p rdfs:label|skos:altLabel ?l . ?p wdt:P106 wd:Q937857 . '
             '?p wdt:P569 ?dob . ?p wikibase:sitelinks ?sl . }' % vals)
        for r in sparql(dl, "legend-labels-" + tag, q, refresh):
            cand[r["l"]].append((int(r["sl"]), qid(r["p"]), year(r["dob"])))
    resolved = {}
    for x in leg:
        best = None
        for l in x["labels"]:
            for sl, q, y in cand.get(l, []):
                if y == x["born"] and (best is None or sl > best[0]):
                    best = (sl, q)
        if not best:
            # fall back to Wikidata's entity search for the name
            for l in x["labels"]:
                q = ('SELECT ?p ?dob ?sl WHERE { SERVICE wikibase:mwapi { bd:serviceParam wikibase:endpoint "www.wikidata.org"; '
                     'wikibase:api "EntitySearch"; mwapi:search "%s"; mwapi:language "en". ?p wikibase:apiOutputItem mwapi:item. } '
                     '?p wdt:P569 ?dob . ?p wikibase:sitelinks ?sl . }' % l.replace('"', '\\"'))
                key = "legend-search-" + re.sub(r"[^A-Za-z0-9]+", "-", l)
                for r in sparql(dl, key, q, refresh):
                    if year(r["dob"]) == x["born"] and (best is None or int(r["sl"]) > best[0]):
                        best = (int(r["sl"]), qid(r["p"]))
                if best:
                    break
        if best:
            resolved[x["name"]] = best[1]
        else:
            print("wikidata: no match for legend", x["name"])
    qs = sorted(set(resolved.values()))
    spells, meta = [], []
    for i in range(0, len(qs), 50):
        vals = " ".join("wd:" + q for q in qs[i:i + 50])
        tag = hashlib.sha1(vals.encode()).hexdigest()[:10]
        spells += sparql(dl, "legend-spells-" + tag,
                         'SELECT ?p ?club ?clubLabel ?tmclub ?start ?end ?apps ?goals WHERE { VALUES ?p { %s } ?p p:P54 ?st . ?st ps:P54 ?club . '
                         'OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P1350 ?apps } OPTIONAL { ?st pq:P1351 ?goals } '
                         'OPTIONAL { ?club wdt:P7223 ?tmclub } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }' % vals, refresh)
        meta += sparql(dl, "legend-meta-" + tag,
                       'SELECT ?p ?pLabel ?dob ?ht ?tmid ?sl WHERE { VALUES ?p { %s } ?p wikibase:sitelinks ?sl . OPTIONAL { ?p wdt:P569 ?dob } '
                       'OPTIONAL { ?p wdt:P2048 ?ht } OPTIONAL { ?p wdt:P2446 ?tmid } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }' % vals, refresh)

    # 3. Ballon d'Or winners (year awarded)
    bdo = sparql(dl, "ballon-dor", 'SELECT ?p ?pLabel ?t ?tmid WHERE { ?p p:P166 ?st . ?st ps:P166 wd:Q166177 . ?st pq:P585 ?t . '
                 'OPTIONAL { ?p wdt:P2446 ?tmid } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }', refresh)

    # 4. notable pre-2012 players of the draft clubs (depth for the older decades)
    roster = {}
    for fr in BIG:
        c = by_fr[fr]
        q = club_q.get(c["tm"])
        if not q:
            continue
        roster[fr] = sparql(dl, "roster8-" + fr,
                            'SELECT ?p ?pLabel ?sl ?start ?end ?apps ?goals ?dob ?tmid (GROUP_CONCAT(DISTINCT ?posLabel; separator="|") AS ?pos) WHERE { '
                            '?p p:P54 ?st . ?st ps:P54 wd:%s . ?st pq:P580 ?start . FILTER(YEAR(?start) >= 1946 && YEAR(?start) <= 2011) '
                            '?p wikibase:sitelinks ?sl . FILTER(?sl >= 8) OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P1350 ?apps } '
                            'OPTIONAL { ?st pq:P1351 ?goals } OPTIONAL { ?p wdt:P569 ?dob } OPTIONAL { ?p wdt:P2446 ?tmid } '
                            'OPTIONAL { ?p wdt:P413 ?posi . ?posi rdfs:label ?posLabel . FILTER(LANG(?posLabel) = "en") } '
                            'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } '
                            'GROUP BY ?p ?pLabel ?sl ?start ?end ?apps ?goals ?dob ?tmid' % q, refresh)
        print("wikidata roster", fr, len(roster[fr]))

    out = {"club_q": club_q, "resolved": resolved, "spells": spells, "meta": meta, "ballon_dor": bdo, "roster": roster}
    with open(os.path.join(dl, "wikidata.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print("wikidata: %d legends resolved, %d spells, %d Ballon d'Or rows" % (len(resolved), len(spells), len(bdo)))


# ---------------------------------------------------------------- openfootball


def of_all(dl, refresh=False):
    """League champion per (league, season) from openfootball results (where the file exists)."""
    champs = {}
    for season in range(FIRST, LAST + 1):
        tag = "%d-%02d" % (season - 1, season % 100)
        for lg, code in OF_LEAGUES.items():
            p = fetch(OF_BASE + tag + "/" + code + ".json", os.path.join(dl, "openfootball", tag, code + ".json"), refresh)
            if not p:
                continue
            with open(p, encoding="utf-8") as f:
                d = json.load(f)
            tab = defaultdict(lambda: [0, 0, 0])  # pts, gd, gf
            for m in d.get("matches", []):
                sc = m.get("score")
                ft = sc.get("ft") if isinstance(sc, dict) else sc if isinstance(sc, list) else None
                if not ft or len(ft) != 2 or None in ft:
                    continue
                a, b = ft
                for t, gf, ga in ((m["team1"], a, b), (m["team2"], b, a)):
                    tab[t][0] += 3 if gf > ga else 1 if gf == ga else 0
                    tab[t][1] += gf - ga
                    tab[t][2] += gf
            if tab:
                champs["%s:%d" % (lg, season)] = max(tab.items(), key=lambda kv: kv[1])[0]
    with open(os.path.join(dl, "openfootball.json"), "w", encoding="utf-8") as f:
        json.dump(champs, f, ensure_ascii=False, indent=0)
    print("openfootball: %d league tables" % len(champs))


# ---------------------------------------------------------------- Transfermarkt aggregate

POS_MAP = {"Goalkeeper": "GK", "Centre-Back": "CB", "Sweeper": "CB", "Left-Back": "FB", "Right-Back": "FB",
           "Defensive Midfield": "DM", "Central Midfield": "CM", "Attacking Midfield": "AM",
           "Left Midfield": "W", "Right Midfield": "W", "Left Winger": "W", "Right Winger": "W",
           "Second Striker": "ST", "Centre-Forward": "ST"}
COARSE = {"Defender": "CB", "midfield": "CM", "Attack": "ST", "Goalkeeper": "GK"}


def end_year(start):
    return int(start) + 1


def aggregate(dl):
    """One pass over each Transfermarkt file -> dl/agg.json.gz (league player-seasons, tables, cross-league games)."""
    t0 = time.time()
    # games
    league_games = {}  # game_id -> (lg, season, home, away, hg, ag)
    dom = {}  # (club, season) -> league (every domestic league in the dataset)
    dom_tab = defaultdict(lambda: [0, 0, 0, 0, 0, 0])  # (club, season) -> games w d l gf ga
    euro, nat_games, cl_games = [], {}, {}
    cl_final = {}
    for g in tm_rows(dl, "games"):
        try:
            season = end_year(g["season"])
            hg, ag = int(g["home_club_goals"]), int(g["away_club_goals"])
        except ValueError:
            continue
        cid, typ = g["competition_id"], g["competition_type"]
        h, a = g["home_club_id"], g["away_club_id"]
        if typ == "domestic_league":
            dom[(h, season)] = cid
            dom[(a, season)] = cid
            for c, gf, ga in ((h, hg, ag), (a, ag, hg)):
                t = dom_tab[(c, season)]
                t[0] += 1
                t[1 if gf > ga else 2 if gf == ga else 3] += 1
                t[4] += gf
                t[5] += ga
            if cid in LEAGUES and FIRST <= season <= LAST:
                league_games[g["game_id"]] = (cid, season, h, a, hg, ag)
        elif cid in EURO_CUPS:
            euro.append((season, h, a, hg, ag, cid))
            if cid == "CL":
                cl_games[g["game_id"]] = season
                if g["round"] == "Final" and hg != ag:
                    cl_final[season] = h if hg > ag else a
        elif cid in NATIONS_CUPS:
            nat_games[g["game_id"]] = (cid, season)
    print("games: %d league, %d european, %d national (%.0fs)" % (len(league_games), len(euro), len(nat_games), time.time() - t0))

    # events: goals, substitutions, red cards in league games
    goals = defaultdict(list)  # game -> [(minute, club, scorer, assist, kind flags)]
    subs_in, subs_out, sent_off = {}, {}, {}
    for e in tm_rows(dl, "game_events"):
        gid = e["game_id"]
        if gid not in league_games:
            continue
        try:
            minute = int(e["minute"])
        except ValueError:
            minute = 45
        typ, desc = e["type"], e["description"] or ""
        if typ == "Goals":
            shot, _, assist = desc.partition("Assist:")
            goals[gid].append((minute, e["club_id"], e["player_id"], e["player_assist_id"] or None,
                               "own" if "Own-goal" in shot else "pen" if "Penalty" in shot else "hdr" if "Header" in shot
                               else "lf" if "Left-footed" in shot else "rf" if "Right-footed" in shot else "fk" if "free kick" in shot else "",
                               "cross" if re.search(r"Cross|Corner", assist) else ""))
        elif typ == "Substitutions":
            if e["player_id"]:
                subs_out[(gid, e["player_id"])] = minute
            if e["player_in_id"]:
                subs_in[(gid, e["player_in_id"])] = minute
        elif typ == "Cards" and re.search(r"Red card|Second yellow", desc):
            sent_off[(gid, e["player_id"])] = minute
    print("events: goals in %d games (%.0fs)" % (len(goals), time.time() - t0))

    # lineups: starter flag, position, number, captain
    lineup = {}
    for r in tm_rows(dl, "game_lineups"):
        gid = r["game_id"]
        if gid not in league_games:
            continue
        lineup[(gid, r["player_id"])] = (r["type"] == "starting_lineup", POS_MAP.get(r["position"]) or COARSE.get(r["position"]),
                                         numv(r["number"]), r["team_captain"] == "1")
    print("lineups: %d rows (%.0fs)" % (len(lineup), time.time() - t0))

    # check goal events against final scores
    ok = bad = 0
    for gid, (lg, season, h, a, hg, ag) in league_games.items():
        n = Counter(c for _, c, *_ in goals.get(gid, []))
        if n.get(h, 0) == hg and n.get(a, 0) == ag:
            ok += 1
        else:
            bad += 1
    print("goal events match the final score in %d games, differ in %d" % (ok, bad))
    good_events = {gid for gid, (lg, season, h, a, hg, ag) in league_games.items()
                   if Counter(c for _, c, *_ in goals.get(gid, [])) == Counter({h: hg, a: ag}) - Counter()}

    # appearances
    L = {}  # (pid, season, club) -> dict
    cl = defaultdict(lambda: [0, 0])
    nat = defaultdict(Counter)
    def blank(lg):
        return {"lg": lg, "apps": 0, "starts": 0, "min": 0, "g": 0, "a": 0, "yc": 0, "rc": 0, "pen": 0, "hdr": 0, "lf": 0, "rf": 0, "fk": 0,
                "xa": 0, "full": 0, "on_gf": 0, "on_ga": 0, "on_min": 0, "cs": 0, "capt": 0, "pos": Counter(), "num": Counter(), "ev_games": 0}
    for r in tm_rows(dl, "appearances"):
        gid = r["game_id"]
        if gid in cl_games:
            k = (r["player_id"], cl_games[gid])
            cl[k][0] += 1
            cl[k][1] += int(r["goals"] or 0)
            continue
        if gid in nat_games:
            cid, season = nat_games[gid]
            nat[r["player_id"]][season] += 1
            continue
        if gid not in league_games:
            continue
        lg, season, h, a, hg, ag = league_games[gid]
        pid, club = r["player_id"], r["player_club_id"]
        if club not in (h, a):
            continue
        k = (pid, season, club)
        d = L.get(k)
        if d is None:
            d = L[k] = blank(lg)
        m = int(r["minutes_played"] or 0)
        d["apps"] += 1
        d["min"] += m
        d["g"] += int(r["goals"] or 0)
        d["a"] += int(r["assists"] or 0)
        d["yc"] += int(r["yellow_cards"] or 0)
        d["rc"] += int(r["red_cards"] or 0)
        lu = lineup.get((gid, pid))
        if lu:
            starter, pos, number, capt = lu
            if pos:
                d["pos"][pos] += max(m, 1)
            if number is not None:
                d["num"][number] += 1
            d["capt"] += capt
        else:
            starter = (gid, pid) not in subs_in
        d["starts"] += starter
        if starter and m >= 90:
            d["full"] += 1
        # on the pitch: from kick-off (starter) or the minute he came on, until he went off or the end
        if starter:
            t_in = 0
        else:
            t_in = subs_in.get((gid, pid), max(0, 90 - m))
        t_out = min(subs_out.get((gid, pid), 999), sent_off.get((gid, pid), 999))
        gf = ga = 0
        if gid in good_events:
            d["ev_games"] += 1
            for minute, gclub, scorer, assist, kind, akind in goals[gid]:
                if (t_in == 0 or minute > t_in) and minute <= t_out:
                    if gclub == club:
                        gf += 1
                    else:
                        ga += 1
                if kind != "own" and scorer == pid and gclub == club and kind in ("pen", "hdr", "lf", "rf", "fk"):
                    d[kind] += 1
                if assist == pid and akind and gclub == club:
                    d["xa"] += 1
        else:
            # no usable events: count the whole game's score pro rata of his minutes
            own, opp = (hg, ag) if club == h else (ag, hg)
            gf, ga = own * m / 90.0, opp * m / 90.0
        d["on_gf"] += gf
        d["on_ga"] += ga
        d["on_min"] += m
        if ga == 0 and m >= 60:
            d["cs"] += 1
    print("appearances: %d player-season-club league lines (%.0fs)" % (len(L), time.time() - t0))

    # team tables for the seven leagues
    tables = {}
    for gid, (lg, season, h, a, hg, ag) in league_games.items():
        for c, gf, ga in ((h, hg, ag), (a, ag, hg)):
            t = tables.setdefault("%s:%d" % (c, season), {"lg": lg, "gp": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0})
            t["gp"] += 1
            t["w" if gf > ga else "d" if gf == ga else "l"] += 1
            t["gf"] += gf
            t["ga"] += ga
    by_lg = defaultdict(list)
    for k, t in tables.items():
        t["pts"] = 3 * t["w"] + t["d"]
        by_lg[(t["lg"], int(k.split(":")[1]))].append((t["pts"], t["gf"] - t["ga"], t["gf"], k))
    for key, rows in by_lg.items():
        rows.sort(reverse=True)
        for i, (_, _, _, k) in enumerate(rows):
            tables[k]["rank"] = i + 1
            tables[k]["n"] = len(rows)

    players = {}
    need = {k[0] for k in L}
    for r in tm_rows(dl, "players"):
        if r["player_id"] not in need:
            continue
        players[r["player_id"]] = {"name": r["name"], "dob": (r["date_of_birth"] or "")[:10], "ht": numv(r["height_in_cm"]),
                                   "foot": r["foot"], "nat": r["country_of_citizenship"], "caps": numv(r["international_caps"]),
                                   "pos": r["position"], "sub": r["sub_position"]}
    lines = []
    for (pid, season, club), d in L.items():
        d["pos"] = dict(d["pos"])
        d["num"] = d["num"].most_common(1)[0][0] if d["num"] else None
        d["on_gf"] = round(d["on_gf"], 2)
        d["on_ga"] = round(d["on_ga"], 2)
        d.update(pid=pid, season=season, club=club, cl_apps=cl[(pid, season)][0], cl_g=cl[(pid, season)][1], nat=nat[pid].get(season, 0))
        lines.append(d)
    out = {
        "lines": lines,
        "tables": tables,
        "players": players,
        "dom": {"%s:%d" % k: v for k, v in dom.items()},
        "dom_tab": {"%s:%d" % k: v for k, v in dom_tab.items()},
        "euro": euro,
        "cl_final": cl_final,
    }
    with gzip.open(os.path.join(dl, "agg.json.gz"), "wt", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("aggregate written: %d lines, %d players (%.0fs)" % (len(lines), len(players), time.time() - t0))


def load_agg(dl):
    with gzip.open(os.path.join(dl, "agg.json.gz"), "rt", encoding="utf-8") as f:
        return json.load(f)


def load_json(dl, name):
    with open(os.path.join(dl, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dl", default=DEFAULT_DL)
    ap.add_argument("--step", default="all", choices=("all", "tm", "agg", "wd", "of"))
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    dl = os.path.abspath(args.dl)
    os.makedirs(dl, exist_ok=True)
    if args.step in ("all", "tm"):
        tm_download(dl, args.refresh)
    if args.step in ("all", "agg"):
        aggregate(dl)
    if args.step in ("all", "of"):
        of_all(dl, args.refresh)
    if args.step in ("all", "wd"):
        wd_all(dl, args.refresh)


if __name__ == "__main__":
    main()
