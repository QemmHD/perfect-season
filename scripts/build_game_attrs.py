"""Build per-line attributes for the arcade mini-games (Python 3 standard library only).

Every player line in src/data/nba.json and src/data/nfl.json (teams[].players, id = team id + ':' +
pid) gets an entry describing how he played and looked: shooting, rebounding, passing, carrying,
catching, his size and jersey number. The numbers come from exactly the seasons that line is made
of, formed by the same rules as the builds that wrote those files, and the script checks each line's
games, seasons and per-game stats against them before writing anything.

Outputs (minified): src/data/nba-attrs.json and src/data/nfl-attrs.json, each
  {"fields": [...], "lines": {"<team id>:<pid>": [values in field order, null where unknown]}}

Basketball (Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets):
  ht, wt   height (in) and weight (lb), Player Career Info.csv
  mpg      minutes per game
  fg2      2-point FG% (before the 1979-80 three-point line every field goal was a 2)
  fg3      3P%, null under 25 attempts in the line (so null before 1979-80)
  a3       3-point attempts per game (0 before 1979-80)
  ft       FT%, null under 20 attempts
  fta      free-throw attempts per game
  orb, drb offensive and defensive rebounds per game (split from 1973-74)
  tov      turnovers per game (from 1977-78)
  dunk     share of field-goal attempts that were dunks (Player Shooting.csv, from 1996-97)
  rim      FG% from 0-3 feet (Player Shooting.csv, from 1996-97)
  A line is the player's rows with one franchise in one decade (a season belongs to the decade it
  ends in), NBA only, 1959-60 on; a traded season's combined 2TM/3TM row is left out and each team's
  own row counts for that team, exactly as in build_nba_data.py.

Football (Pro-Football-Reference via github.com/fantasydatapros/data to 1998, nflverse from 1999):
  ht, wt   height (in) and weight (lb), nflverse player register
  num      the jersey number he wore most for that team in that decade: from 1999 the nflverse
           rosters (weekly rosters from 2002, counting the weeks he wore each number; season
           rosters 1999-2001). Before 1999 there are no per-season numbers (nflverse's pre-1999
           rosters carry 0 or the register's number), so the register's number is used only where
           it is shown to be his number with that team: every season he played from this line's
           first on was with this franchise, and either that stint ended his career before 1999
           with the register's latest team being this franchise, or the stint runs unbroken into
           1999 and the roster shows him wearing the register's number there that first season
  QB       cmp (completion %), ypa (yards per attempt), att (attempts per game), intr
           (interceptions per attempt), sk (times sacked per game, 1999 on), ry (rushing yards per
           game). Completions: PFR's tables through 1991 (they drop the column from 1992), the
           weekly stats from 1999, so a 1992-1998 season has none
  RB       ypc (yards per carry), car (carries per game), rec (receptions per game), ypr (yards per
           reception, null under 10 catches)
  WR, TE   rec, ypr, tgt (targets per game, 1999 on), cr (catch rate, receptions / targets, 1999 on,
           null under 20 targets). Targets go with the receptions they're measured against: PFR's
           where the season's totals are PFR's (a one-team season through 2021), otherwise the
           weekly stats', which have none in 2003-2008 (so a traded season then has none)
  DEF      dsk (sacks per game) and dto (takeaways per game: interceptions plus fumbles lost),
           counted off the offenses the team faced in the weekly stats, 1999 on, over the team's
           games in the cell's seasons; no pre-1999 source, so null for cells before the 2000s
  The line's rows come from nfl_sources.py itself (same ids, same games, same traded-season
  handling); only completions, sacks, targets and defensive stats are added alongside.

Shared rules:
  - per-game values are totals over the line's games; percentages are 0-1, rounded to 3 decimals
  - a stat that wasn't kept for every season of a line (offensive rebounds before 1973-74, dunks
    before 1996-97, NFL targets and sacks before 1999, completions in 1992-1998, a jersey number) is
    taken from the seasons that have it when those hold at least half of the line's games (for
    completion %, half its pass attempts); otherwise it is null. Nothing is estimated
  - a ratio with no denominator (no attempts) is null
  - height and weight are the player's one listed value (the sources keep no per-season sizes before
    1999), so they're the same on each of his lines

Usage: python3 scripts/build_game_attrs.py [--cache DIR] [--nba-raw DIR] [--nfl-raw DIR]
  --cache    where this script's own downloads go (default .cache/attrs)
  --nba-raw  build_nba_data.py's cache; its Player_Totals.csv is the very file nba.json was built
             from (default .cache/raw; downloaded into --cache if it isn't there)
  --nfl-raw  build_nfl_data.py's cache (default .cache/nfl; nfl_sources.py fills in anything missing)
"""

import argparse
import ast
import csv
import json
import os
import sys
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nfl_sources as S  # noqa: E402

DATA = os.path.join(HERE, "..", "src", "data")
NBA_BASE = "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/"
MIN_SHARE = 0.5  # a stat kept for only part of a line needs at least this share of its games
THREE_FIRST = 1980  # the NBA's three-point line: 1979-80
ORB_FIRST = 1974
TOV_FIRST = 1978
SHOOT_FIRST = 1997
TGT_FIRST = 1999  # targets as asked for: from 1999 (PFR's tables have them from 1992 too)
NUMBER_ZERO_FIRST = 2023  # the NFL allowed #0 from 2023; earlier a 0 means "unknown"

NBA_FIELDS = ["ht", "wt", "mpg", "fg2", "fg3", "a3", "ft", "fta", "orb", "drb", "tov", "dunk", "rim"]
NFL_FIELDS = ["ht", "wt", "num", "cmp", "ypa", "att", "intr", "sk", "ry", "ypc", "car", "rec", "ypr", "tgt", "cr", "dsk", "dto"]


def num(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if v != v else v


def rnd(x, nd):
    """Rounded; a whole number is written without a trailing .0 to keep the file small."""
    if x is None:
        return None
    v = round(x, nd)
    return int(v) if v == int(v) else v


def ratio(a, b, nd=3, min_b=0):
    return rnd(a / b, nd) if b and b > 0 and b >= min_b else None


def covered(part, whole):
    return whole > 0 and part > 0 and part >= MIN_SHARE * whole


def from_build_script(name, *keys):
    """Constants of build_nba_data.py, read without importing it (it needs numpy)."""
    tree = ast.parse(open(os.path.join(HERE, name), encoding="utf-8").read())
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id in keys:
            out[node.targets[0].id] = ast.literal_eval(node.value)
    return [out[k] for k in keys]


def download(url, path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print("downloading", url)
        urllib.request.urlretrieve(url, path)
    return path


def write(name, fields, lines):
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"fields": fields, "lines": lines}, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


# ---------------------------------------------------------------- basketball


def build_nba(cache, nba_raw):
    franchise, first_season = from_build_script("build_nba_data.py", "FRANCHISE", "FIRST_SEASON")
    totals = os.path.join(nba_raw, "Player_Totals.csv")
    if not os.path.exists(totals):
        totals = download(NBA_BASE + "Player%20Totals.csv", os.path.join(cache, "Player_Totals.csv"))
    info = download(NBA_BASE + "Player%20Career%20Info.csv", os.path.join(cache, "Player_Career_Info.csv"))
    shooting = download(NBA_BASE + "Player%20Shooting.csv", os.path.join(cache, "Player_Shooting.csv"))
    main = json.load(open(os.path.join(DATA, "nba.json"), encoding="utf-8"))
    built = main["built"]

    body = {}
    for r in csv.DictReader(open(info, encoding="utf-8")):
        body[r["player_id"]] = (num(r["ht_in_in"]), num(r["wt"]))

    shoot = {}
    for r in csv.DictReader(open(shooting, encoding="utf-8")):
        if r["lg"] == "NBA":
            shoot[(int(r["season"]), r["player_id"], r["team"])] = r

    agg = {}
    for r in csv.DictReader(open(totals, encoding="utf-8")):
        if r["lg"] != "NBA" or r["team"] not in franchise:
            continue
        season = int(r["season"])
        g = num(r["g"]) or 0
        if g <= 0 or season < first_season or season > built:
            continue
        key = (r["player_id"], franchise[r["team"]], season // 10 * 10)
        a = agg.get(key)
        if a is None:
            a = agg[key] = defaultdict(float)
            a["seasons"] = set()
        a["seasons"].add(season)
        a["g"] += g
        a["pts"] += num(r["pts"]) or 0.0
        mp = num(r["mp"])
        if mp is not None:
            a["g_mp"] += g
            a["mp"] += mp
        fg, fga, x3p, x3pa = num(r["fg"]), num(r["fga"]), num(r["x3p"]), num(r["x3pa"])
        if season < THREE_FIRST:
            x3p = x3pa = 0.0  # no three-point line: every field goal was a two
        if None not in (fg, fga, x3p, x3pa):
            a["g_fg"] += g
            a["fg2m"] += fg - x3p
            a["fg2a"] += fga - x3pa
            a["fg3m"] += x3p
            a["fg3a"] += x3pa
        ft, fta = num(r["ft"]), num(r["fta"])
        if ft is not None and fta is not None:
            a["g_ft"] += g
            a["ftm"] += ft
            a["fta"] += fta
        orb, drb = num(r["orb"]), num(r["drb"])
        if season >= ORB_FIRST and orb is not None and drb is not None:
            a["g_reb"] += g
            a["orb"] += orb
            a["drb"] += drb
        tov = num(r["tov"])
        if season >= TOV_FIRST and tov is not None:
            a["g_tov"] += g
            a["tov"] += tov
        s = shoot.get((season, r["player_id"], r["team"]))
        if season >= SHOOT_FIRST and s is not None and fga is not None:
            dunk, f03, p03 = num(s["percent_dunks_of_fga"]), num(s["percent_fga_from_x0_3_range"]), num(s["fg_percent_from_x0_3_range"])
            if fga == 0 or (dunk is not None and f03 is not None and (f03 == 0 or p03 is not None)):
                a["g_sh"] += g
                a["sh_fga"] += fga
                if fga:
                    a["dunk_a"] += round(dunk * fga)  # dunk attempts (the share is of attempts; num_of_dunks counts makes)
                    rim_a = round(f03 * fga)
                    a["rim_a"] += rim_a
                    a["rim_m"] += round(rim_a * p03) if rim_a else 0

    lines = {}
    bad = []
    for t in main["teams"]:
        for p in t["players"]:
            lid = t["id"] + ":" + p[13]
            a = agg.get((p[13], t["fr"], int(t["id"].split("-")[1])))
            if a is None:
                bad.append((lid, "missing"))
                lines[lid] = [None] * len(NBA_FIELDS)
                continue
            seas = sorted(a["seasons"])
            if (int(a["g"]), len(seas), seas[0], seas[-1], round(a["pts"] / a["g"], 1)) != (p[7], p[8], p[9], p[10], p[2]):
                bad.append((lid, (int(a["g"]), len(seas), seas[0], seas[-1]), tuple(p[7:11])))
            g = a["g"]
            ht, wt = body.get(p[13], (None, None))
            lines[lid] = [
                rnd(ht, 0), rnd(wt, 0),
                ratio(a["mp"], a["g_mp"], 1) if covered(a["g_mp"], g) else None,
                ratio(a["fg2m"], a["fg2a"]) if covered(a["g_fg"], g) else None,
                ratio(a["fg3m"], a["fg3a"], 3, 25) if covered(a["g_fg"], g) else None,
                ratio(a["fg3a"], a["g_fg"], 1) if covered(a["g_fg"], g) else None,
                ratio(a["ftm"], a["fta"], 3, 20) if covered(a["g_ft"], g) else None,
                ratio(a["fta"], a["g_ft"], 1) if covered(a["g_ft"], g) else None,
                ratio(a["orb"], a["g_reb"], 1) if covered(a["g_reb"], g) else None,
                ratio(a["drb"], a["g_reb"], 1) if covered(a["g_reb"], g) else None,
                ratio(a["tov"], a["g_tov"], 1) if covered(a["g_tov"], g) else None,
                ratio(a["dunk_a"], a["sh_fga"]) if covered(a["g_sh"], g) else None,
                ratio(a["rim_m"], a["rim_a"]) if covered(a["g_sh"], g) else None,
            ]
    return lines, bad


# ---------------------------------------------------------------- football


def pfr_rows(raw, reg, years):
    """nfl_sources.pfr_rows, with PFR's completions (its tables have them through 1991) and targets
    (from 1992) on each row, None where the table has no such column."""
    rows = S.pfr_rows(raw, reg, years)
    extra = []
    for y in years:
        data = list(csv.reader(open(os.path.join(raw, "fdp", str(y) + ".csv"), encoding="utf-8")))
        col = {k: data[0].index(k) if k in data[0] else None for k in ("Cmp", "Tgt")}
        extra += [{k: num(r[i]) if i is not None else None for k, i in col.items()} for r in data[1:]]
    assert len(extra) == len(rows), "PFR rows out of step with nfl_sources.pfr_rows"
    for r, x in zip(rows, extra):
        r["cmp_pair"] = (x["Cmp"], r["pass_att"]) if x["Cmp"] is not None else None
        r["tgt_pair"] = (x["Tgt"], r["rec"]) if x["Tgt"] is not None else None
    return rows


def verse_rows(raw, reg):
    """nfl_sources.verse_rows, step for step, also keeping each stint's completions, sacks and
    targets, and each team-season's defensive sacks and takeaways (all from the weekly stats).

    Completions and sacks always come from the weekly stats (PFR's tables from 1992 have neither),
    over the weekly attempts. Targets go with the receptions they're measured against: where the
    season's totals are PFR's, PFR's targets; otherwise the weekly ones, in the seasons the weekly
    files have them (2003-2008 they're all but empty)."""
    rosters = S.season_rosters(raw)
    active, rostered = S.roster_games(raw)
    pfr_all = pfr_rows(raw, reg, range(S.SPLIT, S.PFR_LAST + 1))
    agg = {}
    defense = defaultdict(lambda: defaultdict(float))
    league = defaultdict(lambda: defaultdict(float))
    for y in range(S.SPLIT, S.LAST_SEASON + 1):
        rows = [r for r in csv.DictReader(open(os.path.join(raw, "wk", str(y) + ".csv"), encoding="utf-8")) if r["season_type"] == "REG" and r["team"]]
        labels = defaultdict(set)
        for r in rows:
            labels[r["game_id"]].add(r["team"])
        for r in rows:
            fr = S.VERSE.get(r["team"], r["team"])
            opp = S.VERSE.get(r["opponent_team"], r["opponent_team"])
            on = rosters.get((r["player_id"], y), (None, set()))[1]
            vs = opp
            if len(labels[r["game_id"]]) == 1 and opp in on and fr not in on:
                fr, vs = opp, fr
            # the defense's sacks and takeaways, counted off the offense it faced (the defenders' own
            # sack credits miss a sack or two a season that went to no one)
            d = defense[(y, vs)]
            d["sk"] += S.num(r["sacks_suffered"])
            d["to"] += S.num(r["passing_interceptions"]) + S.num(r["fumbles_lost_total"])
            key = (r["player_id"], y, fr)
            a = agg.get(key)
            if a is None:
                a = agg[key] = {
                    "season": y, "pid": r["player_id"], "name": r["player_display_name"], "fr": fr, "pos": S.norm_pos(r["position"]),
                    "g": 0.0, "gs": 0.0, "pass_att": 0.0, "pass_yds": 0.0, "pass_td": 0.0, "int": 0.0,
                    "rush_att": 0.0, "rush_yds": 0.0, "rush_td": 0.0, "rec": 0.0, "rec_yds": 0.0, "rec_td": 0.0,
                    "w_cmp": 0.0, "w_att": 0.0, "w_sk": 0.0, "w_rec": 0.0, "w_tgt": 0.0,
                }
            a["g"] += 1
            att = S.num(r["attempts"])
            a["pass_att"] += att
            a["gs"] += 1 if att >= 10 else 0
            a["pass_yds"] += S.num(r["passing_yards"])
            a["pass_td"] += S.num(r["passing_tds"])
            a["int"] += S.num(r["passing_interceptions"])
            a["rush_att"] += S.num(r["carries"])
            a["rush_yds"] += S.num(r["rushing_yards"])
            a["rush_td"] += S.num(r["rushing_tds"])
            a["rec"] += S.num(r["receptions"])
            a["rec_yds"] += S.num(r["receiving_yards"])
            a["rec_td"] += S.num(r["receiving_tds"])
            a["w_cmp"] += S.num(r["completions"])
            a["w_att"] += att
            a["w_sk"] += S.num(r["sacks_suffered"])
            a["w_rec"] += S.num(r["receptions"])
            a["w_tgt"] += S.num(r["targets"])
            lg = league[y]
            for k in ("completions", "sacks_suffered", "receptions", "targets"):
                lg[k] += S.num(r[k])
    pfr, links = S.match_pfr(pfr_all, agg)
    for a in agg.values():
        lg = league[a["season"]]
        a["cmp_pair"] = (a["w_cmp"], a["w_att"]) if lg["completions"] > 0 else None
        a["sk"] = a["w_sk"] if lg["sacks_suffered"] > 0 else None
        a["tgt_pair"] = (a["w_tgt"], a["w_rec"]) if lg["targets"] >= lg["receptions"] > 0 else None
    stints = defaultdict(list)
    for a in agg.values():
        stints[(a["pid"], a["season"])].append(a)
    for key, lst in stints.items():
        p = pfr.get(key)
        for a in lst:
            a["pos"] = rosters.get(key, (None,))[0] or a["pos"]
        if p and not p["xtm"] and len(lst) == 1 and p["fr"] == lst[0]["fr"]:
            for k in ("g", "gs", "pass_att", "rush_att") + S.STATS:
                lst[0][k] = p[k]
            if p["tgt_pair"]:
                lst[0]["tgt_pair"] = p["tgt_pair"]
            continue
        for a in lst:
            a["stat_g"] = a["g"]
            if a["pos"] != "QB":
                a["g"] = max(a["g"], active.get((a["pid"], a["season"], a["fr"]), 0))
        if p and p["xtm"] and len(lst) > 1:
            S.share_traded(lst, p["g"], rostered)
        for a in lst:
            del a["stat_g"]
    return list(agg.values()), links, defense


def jersey_numbers(raw):
    """(gsis id, season, franchise) -> Counter of jersey numbers: weeks worn (weekly rosters, 2002 on,
    regular-season weeks his team played), else the season roster's number (1999-2001)."""
    played = set()
    for r in csv.DictReader(open(os.path.join(raw, "games.csv"), encoding="utf-8")):
        if r["game_type"] == "REG" and r["home_score"] != "":
            for t in (r["home_team"], r["away_team"]):
                played.add((int(r["season"]), int(r["week"]), S.VERSE.get(t, t)))

    def jersey(x, season):
        n = num(x)
        if n is None or n < 0 or n > 99 or (n == 0 and season < NUMBER_ZERO_FIRST):
            return None
        return int(n)

    out = defaultdict(Counter)
    for y in range(S.ROSTER_FIRST, S.LAST_SEASON + 1):
        weeks = defaultdict(dict)
        for r in csv.DictReader(open(os.path.join(raw, "rw", str(y) + ".csv"), encoding="utf-8")):
            if r["game_type"] != "REG" or not r["gsis_id"]:
                continue
            fr = S.ROSTER_CODES.get(r["team"], r["team"])
            week = int(r["week"])
            n = jersey(r["jersey_number"], y)
            if (y, week, fr) in played and n is not None:
                weeks[(r["gsis_id"], y, fr)][week] = n  # each week once (some files repeat rows)
        for key, by_week in weeks.items():
            out[key].update(by_week.values())
    for y in range(S.SPLIT, S.LAST_SEASON + 1):
        for r in csv.DictReader(open(os.path.join(raw, "rs", str(y) + ".csv"), encoding="utf-8")):
            key = (r["gsis_id"], y, S.ROSTER_CODES.get(r["team"], r["team"]))
            n = jersey(r["jersey_number"], y)
            if r["gsis_id"] and n is not None and key not in out:
                out[key][n] += 1
    return out


def register_franchise(code, last_season):
    """The register's latest_team as a franchise (its codes are today's, except the old Oilers and Colts)."""
    if code == "HOU":
        return "TEN" if last_season <= 1998 else "HOU"
    if code == "BAL":
        return "IND" if last_season <= 1983 else ("BAL" if last_season >= 1996 else None)
    if code == "STL":
        return "ARI" if last_season <= 1987 else "LAR"
    fr = S.VERSE.get(code, code)
    return fr if fr in S.FRANCHISES else None


def build_nfl(nfl_raw):
    S.fetch(nfl_raw)
    reg = S.Register(os.path.join(nfl_raw, "players.csv"))
    people = {r["gsis_id"]: r for r in csv.DictReader(open(os.path.join(nfl_raw, "players.csv"), encoding="utf-8"))}
    early = pfr_rows(nfl_raw, reg, range(S.FIRST_SEASON, S.SPLIT))
    late, links, defense = verse_rows(nfl_raw, reg)
    S.link_careers(early, late, links, reg)
    rows = early + late
    numbers = jersey_numbers(nfl_raw)
    ts = S.team_seasons(S.team_games(nfl_raw))
    main = json.load(open(os.path.join(DATA, "nfl.json"), encoding="utf-8"))

    # every season of every player, any team: for telling whether a register number belongs to a stint
    career = defaultdict(list)
    for r in rows:
        career[r["pid"]].append((r["season"], r["fr"]))  # fr None: a traded season before 1999

    # the rows build_nfl_data.py keeps
    pos_games = defaultdict(Counter)
    for r in rows:
        if r["pos"]:
            pos_games[r["pid"]][r["pos"]] += r["g"]
    agg = {}
    for r in rows:
        if r.get("xtm"):
            continue
        if not pos_games.get(r["pid"]) and not (r["pid"].startswith("pfr:") or r["pass_att"] >= 50 or r["rush_yds"] + r["rec_yds"] >= 100):
            continue
        if r["fr"] not in S.FRANCHISES or r["g"] <= 0:
            continue
        a = agg.setdefault((r["pid"], r["fr"], r["season"] // 10 * 10), {"rows": [], "sum": defaultdict(float)})
        a["rows"].append(r)
        su = a["sum"]
        g = r["g"]
        su["g"] += g
        for k in S.STATS + ("pass_att", "rush_att"):
            su[k] += r[k]
        # stats some seasons don't have: each counted with the share of the line it covers
        if r.get("cmp_pair"):
            su["cmp"] += r["cmp_pair"][0]
            su["cmp_att"] += r["cmp_pair"][1]
            su["cmp_cov"] += r["pass_att"]  # the line's attempts in seasons with completions
        if r.get("sk") is not None:
            su["sk"] += r["sk"]
            su["g_sk"] += g
        if r["season"] >= TGT_FIRST and r.get("tgt_pair"):
            su["tgt"] += r["tgt_pair"][0]
            su["tgt_rec"] += r["tgt_pair"][1]
            su["g_tgt"] += g

    def register_number(pid, fr, first):
        """The register's number, if it is shown to be the one he wore for fr from season `first`."""
        p = people.get(pid)
        n = num(p["jersey_number"]) if p else None
        if not n or n < 1 or n > 99:
            return None
        n = int(n)
        later = sorted(x for x in career[pid] if x[0] >= first)
        for s, f in later:
            if f != fr:
                return None  # another team (or a traded season) before anything shows the number
            if s >= S.SPLIT:
                # the stint runs unbroken into 1999: the roster must show him wearing the register's number
                worn = numbers.get((pid, s, fr))
                return n if worn and worn.most_common(1)[0][0] == n else None
        # the rest of his career was this stint, before 1999: the register's latest team must be this one
        return n if later and register_franchise(p["latest_team"], later[-1][0]) == fr else None

    def line_number(pid, fr, a):
        weight = Counter()
        last_seen = {}
        known = 0.0
        first = min(r["season"] for r in a["rows"])
        reg_n = register_number(pid, fr, first) if first < S.SPLIT else None
        for r in sorted(a["rows"], key=lambda r: r["season"]):
            g = r["g"]
            if r["season"] >= S.SPLIT:
                worn = numbers.get((pid, r["season"], fr))
                if not worn:
                    continue
                total = sum(worn.values())
                for n, c in worn.items():
                    weight[n] += g * c / total
                    last_seen[n] = r["season"]
            elif reg_n is not None:
                weight[reg_n] += g
                last_seen[reg_n] = r["season"]
            else:
                continue
            known += g
        if not weight or not covered(known, a["sum"]["g"]):
            return None
        return max(weight, key=lambda n: (round(weight[n], 6), last_seen[n]))

    lines = {}
    bad = []
    for t in main["teams"]:
        dec = int(t["id"].split("-")[1])
        for p in t["players"]:
            pid, pos = p[7], p[1]
            lid = t["id"] + ":" + pid
            out = dict.fromkeys(NFL_FIELDS)
            if pos == "DEF":
                # the team's seasons in the cell, as build_nfl_data.py takes them
                fr = t["fr"]
                ss = [s for s in range(dec, dec + 10) if (s, fr) in ts]
                g = sum(ts[(s, fr)]["g"] for s in ss)
                if (int(g), len(ss), ss[0], ss[-1]) != tuple(p[2:6]):
                    bad.append((lid, (int(g), len(ss), ss[0], ss[-1]), p[2:6]))
                wk = [s for s in ss if s >= S.SPLIT]
                g_wk = sum(ts[(s, fr)]["g"] for s in wk)
                if covered(g_wk, g):
                    out["dsk"] = ratio(sum(defense[(s, fr)]["sk"] for s in wk), g_wk, 2)
                    out["dto"] = ratio(sum(defense[(s, fr)]["to"] for s in wk), g_wk, 2)
                lines[lid] = out
                continue
            a = agg.get((pid, t["fr"], dec))
            if a is None:
                bad.append((lid, "missing"))
                lines[lid] = out
                continue
            su = a["sum"]
            g = su["g"]
            seas = sorted({r["season"] for r in a["rows"]})
            shown = [round(su[k] / g, 2 if k in ("pass_td", "int", "rush_td", "rec_td") else 1) for k in ("pass_yds", "pass_td", "int", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td")]
            if [int(g), len(seas), seas[0], seas[-1]] + shown != [p[2], p[3], p[4], p[5]] + list(p[8:16]):
                bad.append((lid, [int(g), len(seas), seas[0], seas[-1]] + shown, p[2:6] + p[8:16]))
            person = people.get(pid)
            if person:
                out["ht"] = rnd(num(person["height"]), 0)
                out["wt"] = rnd(num(person["weight"]), 0)
            out["num"] = line_number(pid, t["fr"], a)
            if pos == "QB":
                out["cmp"] = ratio(su["cmp"], su["cmp_att"]) if covered(su["cmp_cov"], su["pass_att"]) else None
                out["ypa"] = ratio(su["pass_yds"], su["pass_att"], 1)
                out["att"] = ratio(su["pass_att"], g, 1)
                out["intr"] = ratio(su["int"], su["pass_att"])
                out["sk"] = ratio(su["sk"], su["g_sk"], 1) if covered(su["g_sk"], g) else None
                out["ry"] = ratio(su["rush_yds"], g, 1)
            elif pos == "RB":
                out["ypc"] = ratio(su["rush_yds"], su["rush_att"], 1)
                out["car"] = ratio(su["rush_att"], g, 1)
                out["rec"] = ratio(su["rec"], g, 1)
                out["ypr"] = ratio(su["rec_yds"], su["rec"], 1, 10)
            else:
                out["rec"] = ratio(su["rec"], g, 1)
                out["ypr"] = ratio(su["rec_yds"], su["rec"], 1, 10)
                if covered(su["g_tgt"], g):
                    out["tgt"] = ratio(su["tgt"], su["g_tgt"], 1)
                    out["cr"] = ratio(su["tgt_rec"], su["tgt"], 3, 20)
            lines[lid] = out
    return {lid: [out[k] for k in NFL_FIELDS] for lid, out in lines.items()}, bad


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", default=os.path.join(HERE, "..", ".cache", "attrs"))
    ap.add_argument("--nba-raw", default=os.path.join(HERE, "..", ".cache", "raw"))
    ap.add_argument("--nfl-raw", default=os.path.join(HERE, "..", ".cache", "nfl"))
    args = ap.parse_args()

    nba, bad = build_nba(args.cache, args.nba_raw)
    if bad:
        sys.exit("nba: %d lines don't match nba.json, e.g. %s" % (len(bad), bad[:5]))
    nfl, bad = build_nfl(args.nfl_raw)
    if bad:
        sys.exit("nfl: %d lines don't match nfl.json, e.g. %s" % (len(bad), bad[:5]))
    # both checked before either is written
    print("nba lines", len(nba), "bytes", write("nba-attrs.json", NBA_FIELDS, nba))
    print("nfl lines", len(nfl), "bytes", write("nfl-attrs.json", NFL_FIELDS, nfl))


if __name__ == "__main__":
    main()
