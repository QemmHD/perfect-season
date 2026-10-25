"""Loads the public NFL sources into one shape, for build_nfl_data.py.

Sources (all public, fetched into raw_dir on first use):
  fdp/<year>.csv      Pro-Football-Reference season tables, 1970-2021, as scraped by
                      github.com/fantasydatapros/data (passing, rushing, receiving)
  wk/<year>.csv       nflverse weekly player stats, 1999-2025 (each game a player recorded a stat in)
  rs/<year>.csv       nflverse season rosters, 1999-2025 (each player's position that season)
  rw/<year>.csv       nflverse weekly rosters, 2002-2025 (who was active for each game)
  games.csv           also tells which weeks each team played (the weekly rosters list byes too)
  players.csv         nflverse player register (names, birth dates, ids back to the 1920s)
  nfl_games.csv       FiveThirtyEight's NFL game results, 1920-2020
  games.csv           nflverse schedules and scores, 1999-
"""

import csv
import os
import re
import urllib.request
from collections import defaultdict

FIRST_SEASON = 1970
SPLIT = 1999  # PFR season tables before this, nflverse weekly stats from it
PFR_LAST = 2021  # the PFR season tables go this far
ROSTER_FIRST = 2002  # nflverse weekly rosters start here
LAST_SEASON = 2025

FDP = "https://raw.githubusercontent.com/fantasydatapros/data/master/yearly/{}.csv"
NFLVERSE = "https://github.com/nflverse/nflverse-data/releases/download/"
GAMES_538 = "https://raw.githubusercontent.com/fivethirtyeight/nfl-elo-game/master/data/nfl_games.csv"

STATS = ("pass_yds", "pass_td", "int", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td")

# PFR season-table team codes -> franchise, by season
def pfr_franchise(code, season):
    if code == "BAL":
        return "IND" if season <= 1983 else "BAL"
    if code == "STL":
        return "ARI" if season <= 1987 else "LAR"
    if code == "HOU":
        return "TEN" if season <= 1998 else "HOU"  # the Oilers, then (from 2002) the Texans
    return {
        "BOS": "NE", "NWE": "NE", "GNB": "GB", "KAN": "KC", "NOR": "NO", "OAK": "LV", "RAI": "LV", "LVR": "LV",
        "RAM": "LAR", "PHO": "ARI", "SDG": "LAC", "SFO": "SF", "TAM": "TB",
    }.get(code, code)


# nflverse (stats and schedules) and FiveThirtyEight codes -> franchise
VERSE = {"LA": "LAR", "STL": "LAR", "OAK": "LV", "SD": "LAC", "WSH": "WAS"}
# the weekly rosters' own codes
ROSTER_CODES = {**VERSE, "ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU", "SL": "LAR"}

FRANCHISES = ("ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
              "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS")


def identity(fr, season):
    """(display abbreviation, team name, primary color, secondary color) for a franchise in a season."""
    if fr == "ARI":
        if season <= 1987:
            return ("STL", "St. Louis Cardinals", "#97233F", "#000000")
        if season <= 1993:
            return ("PHO", "Phoenix Cardinals", "#97233F", "#000000")
        return ("ARI", "Arizona Cardinals", "#97233F", "#000000")
    if fr == "IND":
        if season <= 1983:
            return ("BAL", "Baltimore Colts", "#002C5F", "#A2AAAD")
        return ("IND", "Indianapolis Colts", "#002C5F", "#A2AAAD")
    if fr == "LAC":
        if season <= 2016:
            return ("SD", "San Diego Chargers", "#0080C6", "#FFC20E")
        return ("LAC", "Los Angeles Chargers", "#0080C6", "#FFC20E")
    if fr == "LAR":
        if season <= 1994:
            return ("LAR", "Los Angeles Rams", "#003594", "#FFD100")
        if season <= 2015:
            return ("STL", "St. Louis Rams", "#002244", "#B3995D")
        return ("LAR", "Los Angeles Rams", "#003594", "#FFA300")
    if fr == "LV":
        if 1982 <= season <= 1994:
            return ("RAI", "Los Angeles Raiders", "#000000", "#A5ACAF")
        if season <= 2019:
            return ("OAK", "Oakland Raiders", "#000000", "#A5ACAF")
        return ("LV", "Las Vegas Raiders", "#000000", "#A5ACAF")
    if fr == "NE":
        if season <= 1970:
            return ("BOS", "Boston Patriots", "#C8102E", "#002244")
        if season <= 1992:
            return ("NE", "New England Patriots", "#C8102E", "#002244")
        return ("NE", "New England Patriots", "#002244", "#C60C30")
    if fr == "TEN":
        if season <= 1996:
            return ("HOU", "Houston Oilers", "#4B92DB", "#C8102E")
        if season <= 1998:
            return ("TEN", "Tennessee Oilers", "#4B92DB", "#C8102E")
        return ("TEN", "Tennessee Titans", "#0C2340", "#4B92DB")
    if fr == "WAS":
        if season <= 2019:
            return ("WAS", "Washington", "#5A1414", "#FFB612")
        if season <= 2021:
            return ("WAS", "Washington Football Team", "#5A1414", "#FFB612")
        return ("WAS", "Washington Commanders", "#5A1414", "#FFB612")
    if fr == "PHI":
        return ("PHI", "Philadelphia Eagles", "#00843D", "#A5ACAF") if season <= 1995 else ("PHI", "Philadelphia Eagles", "#004C54", "#A5ACAF")
    if fr == "TB":
        return ("TB", "Tampa Bay Buccaneers", "#FF7900", "#D50A0A") if season <= 1996 else ("TB", "Tampa Bay Buccaneers", "#D50A0A", "#34302B")
    if fr == "SEA":
        return ("SEA", "Seattle Seahawks", "#002A5C", "#A5ACAF") if season <= 2001 else ("SEA", "Seattle Seahawks", "#002244", "#69BE28")
    return {
        "ATL": ("ATL", "Atlanta Falcons", "#A71930", "#000000"),
        "BAL": ("BAL", "Baltimore Ravens", "#241773", "#9E7C0C"),
        "BUF": ("BUF", "Buffalo Bills", "#00338D", "#C60C30"),
        "CAR": ("CAR", "Carolina Panthers", "#0085CA", "#101820"),
        "CHI": ("CHI", "Chicago Bears", "#0B162A", "#C83803"),
        "CIN": ("CIN", "Cincinnati Bengals", "#FB4F14", "#000000"),
        "CLE": ("CLE", "Cleveland Browns", "#311D00", "#FF3C00"),
        "DAL": ("DAL", "Dallas Cowboys", "#003594", "#869397"),
        "DEN": ("DEN", "Denver Broncos", "#FB4F14", "#002244"),
        "DET": ("DET", "Detroit Lions", "#0076B6", "#B0B7BC"),
        "GB": ("GB", "Green Bay Packers", "#203731", "#FFB612"),
        "HOU": ("HOU", "Houston Texans", "#03202F", "#A71930"),
        "JAX": ("JAX", "Jacksonville Jaguars", "#006778", "#D7A22A"),
        "KC": ("KC", "Kansas City Chiefs", "#E31837", "#FFB81C"),
        "MIA": ("MIA", "Miami Dolphins", "#008E97", "#FC4C02"),
        "MIN": ("MIN", "Minnesota Vikings", "#4F2683", "#FFC62F"),
        "NO": ("NO", "New Orleans Saints", "#D3BC8D", "#101820"),
        "NYG": ("NYG", "New York Giants", "#0B2265", "#A71930"),
        "NYJ": ("NYJ", "New York Jets", "#125740", "#FFFFFF"),
        "PIT": ("PIT", "Pittsburgh Steelers", "#FFB612", "#101820"),
        "SF": ("SF", "San Francisco 49ers", "#AA0000", "#B3995D"),
    }[fr]


def fetch(raw_dir):
    for d in ("fdp", "wk", "rs", "rw"):
        os.makedirs(os.path.join(raw_dir, d), exist_ok=True)
    want = [(FDP.format(y), os.path.join(raw_dir, "fdp", str(y) + ".csv")) for y in range(FIRST_SEASON, PFR_LAST + 1)]
    want += [(NFLVERSE + "stats_player/stats_player_week_" + str(y) + ".csv", os.path.join(raw_dir, "wk", str(y) + ".csv")) for y in range(SPLIT, LAST_SEASON + 1)]
    want += [(NFLVERSE + "rosters/roster_" + str(y) + ".csv", os.path.join(raw_dir, "rs", str(y) + ".csv")) for y in range(SPLIT, LAST_SEASON + 1)]
    want += [(NFLVERSE + "weekly_rosters/roster_weekly_" + str(y) + ".csv", os.path.join(raw_dir, "rw", str(y) + ".csv")) for y in range(ROSTER_FIRST, LAST_SEASON + 1)]
    want += [
        (NFLVERSE + "players/players.csv", os.path.join(raw_dir, "players.csv")),
        (NFLVERSE + "schedules/games.csv", os.path.join(raw_dir, "games.csv")),
        (GAMES_538, os.path.join(raw_dir, "nfl_games.csv")),
    ]
    for url, path in want:
        if not os.path.exists(path):
            print("downloading", url)
            urllib.request.urlretrieve(url, path)


def num(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return 0.0
    return 0.0 if v != v else v


SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")


def name_key(n):
    n = n.lower().replace("’", "'")
    n = re.sub(r"[^a-z' ]", " ", n.replace(".", ""))
    n = SUFFIX.sub(" ", n).replace("'", "")
    return " ".join(n.split())


def norm_pos(p):
    p = (p or "").upper().strip()
    if p in ("QB", "RB", "WR", "TE"):
        return p
    if p in ("FB", "HB"):
        return "RB"
    return None


class Register:
    """nflverse's player register: finds the id for a PFR row by name and birth year."""

    def __init__(self, path):
        self.by_name = defaultdict(list)
        self.by_id = {}
        for r in csv.DictReader(open(path, encoding="utf-8")):
            born = int(r["birth_date"][:4]) if r["birth_date"][:4].isdigit() else None
            p = {"id": r["gsis_id"], "name": r["display_name"], "born": born, "pos": norm_pos(r["position"]),
                 "first": int(num(r["rookie_season"])) or None, "last": int(num(r["last_season"])) or None}
            self.by_name[name_key(r["display_name"])].append(p)
            self.by_id[r["gsis_id"]] = p

    def find(self, name, season, age, pos):
        cands = self.by_name.get(name_key(name), [])
        if not cands:
            return None
        born = season - int(age) if age else None

        def score(c):
            s = 0.0
            if born and c["born"]:
                d = abs(c["born"] - born)
                if d > 1:
                    return None
                s += 2 - d
            elif c["first"] and c["last"] and not (c["first"] - 1 <= season <= c["last"] + 1):
                return None
            if c["first"] and c["last"] and c["first"] - 1 <= season <= c["last"] + 1:
                s += 1
            if pos and c["pos"] == pos:
                s += 0.5
            return s

        scored = [(score(c), c) for c in cands]
        scored = [x for x in scored if x[0] is not None]
        if not scored:
            return None
        scored.sort(key=lambda x: -x[0])
        if len(scored) > 1 and scored[0][0] == scored[1][0]:
            return None
        return scored[0][1]["id"]


def pfr_rows(raw_dir, reg, years):
    """PFR season rows. A traded player's combined season (2TM/3TM) has no team: it comes with
    fr None and xtm True, for the league's totals only."""
    out = []
    for y in years:
        rows = list(csv.reader(open(os.path.join(raw_dir, "fdp", str(y) + ".csv"), encoding="utf-8")))
        head = rows[0]
        for r in rows[1:]:
            d = {}
            for k, v in zip(head, r):
                d.setdefault(k, v)  # the first "Att"/"Yds" is passing; the named totals below are what we use
            tm = d["Tm"]
            xtm = tm.endswith("TM")
            name = d["Player"].strip().rstrip("*+").strip()
            pos = norm_pos(d["Pos"])
            pid = reg.find(name, y, num(d["Age"]), pos)
            fr = None if xtm else pfr_franchise(tm, y)
            if fr is not None and fr not in FRANCHISES:
                raise ValueError("unknown PFR team " + tm + " in " + str(y))
            out.append({
                "season": y, "pid": pid or ("pfr:" + name_key(name) + ":" + str(y - int(num(d["Age"])))), "name": name,
                "fr": fr, "xtm": xtm, "pos": pos, "g": num(d["G"]), "gs": num(d["GS"]),
                "pass_att": num(d["PassingAtt"]), "pass_yds": num(d["PassingYds"]), "pass_td": num(d["PassingTD"]), "int": num(d["Int"]),
                "rush_att": num(d["RushingAtt"]), "rush_yds": num(d["RushingYds"]), "rush_td": num(d["RushingTD"]),
                "rec": num(d["Rec"]), "rec_yds": num(d["ReceivingYds"]), "rec_td": num(d["ReceivingTD"]),
            })
    settle_ids(out)
    return out


def settle_ids(rows):
    """Rows the register couldn't tell from a namesake get a stand-in id (pfr:name:birth year).
    Such a row takes the id the same name has with the same team in a season nearby; and a
    stand-in id never holds two teams in one season (PFR has no per-team rows for a traded
    player, so that is two people)."""
    known = defaultdict(set)
    for r in rows:
        if r["fr"] and not r["pid"].startswith("pfr:"):
            known[(name_key(r["name"]), r["fr"])].add((r["season"], r["pid"]))
    # season by season: a stint can reach back from the year the register first tells him apart
    changed = True
    while changed:
        changed = False
        for r in rows:
            if r["fr"] and r["pid"].startswith("pfr:"):
                k = (name_key(r["name"]), r["fr"])
                near = {pid for s, pid in known.get(k, ()) if abs(s - r["season"]) <= 2}
                if len(near) == 1:
                    r["pid"] = near.pop()
                    known[k].add((r["season"], r["pid"]))
                    changed = True
    teams = defaultdict(set)
    for r in rows:
        if r["fr"] and r["pid"].startswith("pfr:"):
            teams[(r["pid"], r["season"])].add(r["fr"])
    shared = {pid for (pid, _), frs in teams.items() if len(frs) > 1}
    for r in rows:
        if r["pid"] in shared and r["fr"]:
            r["pid"] += ":" + r["fr"]


def season_rosters(raw_dir):
    """nflverse season rosters: (player id, season) -> (position, teams)."""
    out = {}
    for y in range(SPLIT, LAST_SEASON + 1):
        for r in csv.DictReader(open(os.path.join(raw_dir, "rs", str(y) + ".csv"), encoding="utf-8")):
            if not r["gsis_id"]:
                continue
            pos, teams = out.setdefault((r["gsis_id"], y), [None, set()])
            out[(r["gsis_id"], y)][0] = pos or norm_pos(r["position"])
            teams.add(ROSTER_CODES.get(r["team"], r["team"]))
    return out


def roster_counts(y):
    """Whether the weekly rosters' active count can stand in for games played that season. It
    matches PFR's games played for 88-94% of backs, receivers and tight ends in 2002-2015 and
    2020-2021, and is never lower; in 2016-2019 the files don't mark game-day inactives."""
    return ROSTER_FIRST <= y <= 2015 or y >= 2020


def active_games(raw_dir):
    """Regular-season games each player was active for, per team (weekly rosters):
    (player id, season, franchise) -> games. Only weeks his team played (byes are listed too),
    and not when he was a game-day inactive. A quarterback is active for many games he doesn't play."""
    played = set()
    for r in csv.DictReader(open(os.path.join(raw_dir, "games.csv"), encoding="utf-8")):
        if r["game_type"] == "REG" and r["home_score"] != "":
            for t in (r["home_team"], r["away_team"]):
                played.add((int(r["season"]), int(r["week"]), VERSE.get(t, t)))
    n = defaultdict(int)
    for y in range(ROSTER_FIRST, LAST_SEASON + 1):
        if not roster_counts(y):
            continue
        for r in csv.DictReader(open(os.path.join(raw_dir, "rw", str(y) + ".csv"), encoding="utf-8")):
            if r["game_type"] != "REG" or r["status"] != "ACT" or not r["gsis_id"] or r["status_description_abbr"].startswith("I"):
                continue
            fr = ROSTER_CODES.get(r["team"], r["team"])
            if (y, int(r["week"]), fr) in played:
                n[(r["gsis_id"], y, fr)] += 1
    return n


def verse_rows(raw_dir, reg):
    """1999-2025, per player, season and team. Stats are nflverse's weekly rows, which only exist
    for games a player recorded a stat in, so games played come from elsewhere: a season with one
    team through 2021 is PFR's season row (games, starts and totals, as for 1970-1998); a traded
    season through 2021 shares PFR's combined games out over its stints; otherwise a back's,
    receiver's or tight end's games are the ones the weekly rosters have him active for, where
    they can tell (roster_counts). Positions are the season roster's."""
    rosters = season_rosters(raw_dir)
    active = active_games(raw_dir)
    pfr_all = pfr_rows(raw_dir, reg, range(SPLIT, PFR_LAST + 1))
    agg = {}
    for y in range(SPLIT, LAST_SEASON + 1):
        rows = [r for r in csv.DictReader(open(os.path.join(raw_dir, "wk", str(y) + ".csv"), encoding="utf-8")) if r["season_type"] == "REG" and r["team"]]
        # in a few games every row carries the visitors' team (the Jaguars' home games in
        # 2001-02): there a player who was on the other team's roster played for the other team
        labels = defaultdict(set)
        for r in rows:
            labels[r["game_id"]].add(r["team"])
        for r in rows:
            fr = VERSE.get(r["team"], r["team"])
            opp = VERSE.get(r["opponent_team"], r["opponent_team"])
            on = rosters.get((r["player_id"], y), (None, set()))[1]
            if len(labels[r["game_id"]]) == 1 and opp in on and fr not in on:
                fr = opp
            key = (r["player_id"], y, fr)
            a = agg.get(key)
            if a is None:
                a = agg[key] = {
                    "season": y, "pid": r["player_id"], "name": r["player_display_name"], "fr": fr, "pos": norm_pos(r["position"]),
                    "g": 0.0, "gs": 0.0, "pass_att": 0.0, "pass_yds": 0.0, "pass_td": 0.0, "int": 0.0,
                    "rush_att": 0.0, "rush_yds": 0.0, "rush_td": 0.0, "rec": 0.0, "rec_yds": 0.0, "rec_td": 0.0,
                }
            a["g"] += 1
            att = num(r["attempts"])
            a["pass_att"] += att
            a["gs"] += 1 if att >= 10 else 0
            a["pass_yds"] += num(r["passing_yards"])
            a["pass_td"] += num(r["passing_tds"])
            a["int"] += num(r["passing_interceptions"])
            a["rush_att"] += num(r["carries"])
            a["rush_yds"] += num(r["rushing_yards"])
            a["rush_td"] += num(r["rushing_tds"])
            a["rec"] += num(r["receptions"])
            a["rec_yds"] += num(r["receiving_yards"])
            a["rec_td"] += num(r["receiving_tds"])
    pfr = match_pfr(pfr_all, agg)
    stints = defaultdict(list)
    for a in agg.values():
        stints[(a["pid"], a["season"])].append(a)
    for key, lst in stints.items():
        p = pfr.get(key)
        for a in lst:
            a["pos"] = rosters.get(key, (None,))[0] or a["pos"]
        if p and not p["xtm"] and len(lst) == 1 and p["fr"] == lst[0]["fr"]:
            # the season as Pro-Football-Reference has it, like 1970-1998: every game played, every game's stats
            for k in ("g", "gs", "pass_att", "rush_att") + STATS:
                lst[0][k] = p[k]
            continue
        # the games he recorded a stat in, or (backs, receivers, tight ends) the ones he was active for
        for a in lst:
            a["stat_g"] = a["g"]
            if a["pos"] != "QB":
                a["g"] = max(a["g"], active.get((a["pid"], a["season"], a["fr"]), 0))
        if p and p["xtm"] and len(lst) > 1:
            # a traded season: PFR's combined games played, shared out over the stints
            extra = sum(a["g"] for a in lst) - p["g"]
            for a in sorted(lst, key=lambda a: a["stat_g"] - a["g"]):
                cut = min(max(0.0, extra), a["g"] - a["stat_g"])
                a["g"] -= cut
                extra -= cut
        for a in lst:
            del a["stat_g"]
    return list(agg.values())


def match_pfr(pfr_all, agg):
    """PFR's season rows by (nflverse id, season). The register finds most players by name; a
    name it can't place (Ben Watson for Benjamin Watson) is found by team, season and yards.
    An id with two PFR rows that season is trusted for neither."""
    out = {}
    for r in pfr_all:
        if not r["pid"].startswith("pfr:"):
            key = (r["pid"], r["season"])
            out[key] = None if key in out else r
    by_team = defaultdict(list)
    for a in agg.values():
        by_team[(a["season"], a["fr"])].append(a)
    yards = lambda x: (x["pass_yds"], x["rush_yds"], x["rec_yds"])
    for r in pfr_all:
        if not r["pid"].startswith("pfr:") or not r["fr"] or sum(yards(r)) < 50:
            continue
        last = name_key(r["name"]).split()[-1:]
        cands = [a for a in by_team[(r["season"], r["fr"])] if (a["pid"], a["season"]) not in out
                 and name_key(a["name"]).split()[-1:] == last and all(abs(u - v) <= max(5, 0.03 * u) for u, v in zip(yards(r), yards(a)))]
        if len(cands) == 1:
            out[(cands[0]["pid"], r["season"])] = r
    return out


def team_games(raw_dir):
    """Every game 1970-, from FiveThirtyEight (to 1998) and nflverse (1999 on):
    (season, playoff, round, home franchise, away franchise, home score, away score, neutral)."""
    out = []
    for r in csv.DictReader(open(os.path.join(raw_dir, "nfl_games.csv"), encoding="utf-8")):
        s = int(r["season"])
        if not (FIRST_SEASON <= s < SPLIT):
            continue
        out.append({"season": s, "playoff": r["playoff"] == "1", "round": None, "date": r["date"],
                    "home": VERSE.get(r["team1"], r["team1"]), "away": VERSE.get(r["team2"], r["team2"]),
                    "hs": int(r["score1"]), "as": int(r["score2"]), "neutral": r["neutral"] == "1"})
    for r in csv.DictReader(open(os.path.join(raw_dir, "games.csv"), encoding="utf-8")):
        s = int(r["season"])
        if not (SPLIT <= s <= LAST_SEASON) or r["home_score"] == "":
            continue
        out.append({"season": s, "playoff": r["game_type"] != "REG", "round": r["game_type"], "date": r["gameday"],
                    "home": VERSE.get(r["home_team"], r["home_team"]), "away": VERSE.get(r["away_team"], r["away_team"]),
                    "hs": int(r["home_score"]), "as": int(r["away_score"]), "neutral": r["location"] == "Neutral"})
    return out


def team_seasons(games):
    """Regular-season record, points for and against, and the playoff run of every team-season."""
    ts = {}
    for g in games:
        for us, them, pf, pa in ((g["home"], g["away"], g["hs"], g["as"]), (g["away"], g["home"], g["as"], g["hs"])):
            t = ts.setdefault((g["season"], us), {"w": 0, "l": 0, "t": 0, "pf": 0, "pa": 0, "g": 0, "po": [], "champ": False})
            if g["playoff"]:
                t["po"].append((g["date"], pf > pa, them, pf, pa))
                continue
            t["g"] += 1
            t["pf"] += pf
            t["pa"] += pa
            if pf > pa:
                t["w"] += 1
            elif pf < pa:
                t["l"] += 1
            else:
                t["t"] += 1
    # the champion won the season's last playoff game
    by_season = defaultdict(list)
    for g in games:
        if g["playoff"]:
            by_season[g["season"]].append(g)
    for s, gs in by_season.items():
        last = max(gs, key=lambda g: g["date"])
        win = last["home"] if last["hs"] > last["as"] else last["away"]
        ts[(s, win)]["champ"] = True
    for t in ts.values():
        t["po"].sort()
    return ts
