"""Build the NBA player database for Perfect Season.

Source: per-season, per-team player totals from the public
sumitrodatta/bball-reference-datasets repo (Basketball-Reference data).

Output: src/data/nba.json with
  teams:   franchise-decade cells, each with its players' games-weighted
           per-game averages for that team in that decade
  playoff: historical great teams used as playoff opponents

Rules (see research/perfect-season/SPEC.md §11):
  - NBA only (no ABA/BAA), seasons ending 1960..latest
  - a season belongs to the decade it ENDS in (1989-90 -> 1990s)
  - a cell is (franchise, decade); it is labelled with the franchise's
    dominant name in that decade (most seasons; ties go to the later name)
  - stats are sum(totals) / sum(games) over every season of that player
    with that franchise in that decade; traded-season "2TM"/"TOT" rows skipped
  - each player line carries two versions of the same five stats:
      shown:  the real per-game averages, as on Basketball-Reference
      rated:  what the game scores, which differs in two ways
        * era: every season's stats are measured against that season's
          league (per team-game averages) and put on the 1960-2026
          average scale. A 1960s team saw ~1.7x the rebounds of a 2000s
          team, so raw numbers would make the early decades a jackpot;
          rated this way, real teams' top fives predict their records
          better (r 0.48 vs 0.39) and no decade is favored
        * small samples: a stint is blended with the player's career
          rate as if he had played SHRINK_GAMES more games at it, so a
          one-game cameo isn't valued like a full season
  - steals/blocks before 1973-74 weren't recorded; they are estimated from
    the player's era-rated points, rebounds, assists and position, and flagged
  - positions: each season's listed position(s) weighted by games across
    the player's NBA career; positions with 12%+ of his games are kept, up
    to 3 (LeBron SF/PF, Magic PG/SG, Jordan SG). The few players with no
    listed position at all get the nearest one by their stat profile
  - when different players share a name (Patrick Ewing and his son), the one
    with the longest career keeps the plain name and the others get the
    years they spent with that team, e.g. "Patrick Ewing (2010–11)"
  - prime = the player's best cell (20+ games) by rated value

Usage: python3 scripts/build_nba_data.py [raw_dir]
"""

import csv
import json
import os
import sys
import urllib.request
from collections import defaultdict

import numpy as np

BASE = "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/"
FILES = {"totals": "Player Totals.csv", "teams": "Team Summaries.csv", "team_totals": "Team Totals.csv"}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "nba.json")
FIRST_SEASON = 1960
STL_BLK_FIRST = 1974
SHRINK_GAMES = 10
STATS = ("pts", "reb", "ast", "stl", "blk")
POS_SHARE = 0.12
POS_MAX = 3
SLOT_ORDER = ["PG", "SG", "SF", "PF", "C"]
W = {"pts": 0.33, "reb": 0.67, "ast": 0.64, "stl": 1.2, "blk": 1.13}

# B-Ref abbreviation -> franchise id
FRANCHISE = {
    "STL": "ATL", "ATL": "ATL",
    "BOS": "BOS",
    "NYN": "BKN", "NJN": "BKN", "BRK": "BKN",
    "CHH": "CHA", "CHA": "CHA", "CHO": "CHA",
    "CHI": "CHI", "CLE": "CLE", "DAL": "DAL", "DEN": "DEN", "DET": "DET",
    "PHW": "GSW", "SFW": "GSW", "GSW": "GSW",
    "SDR": "HOU", "HOU": "HOU",
    "IND": "IND",
    "BUF": "LAC", "SDC": "LAC", "LAC": "LAC",
    "MNL": "LAL", "LAL": "LAL",
    "VAN": "MEM", "MEM": "MEM",
    "MIA": "MIA", "MIL": "MIL", "MIN": "MIN",
    "NOH": "NOP", "NOK": "NOP", "NOP": "NOP",
    "NYK": "NYK",
    "SEA": "OKC", "OKC": "OKC",
    "ORL": "ORL",
    "SYR": "PHI", "PHI": "PHI",
    "PHO": "PHX",
    "POR": "POR",
    "CIN": "SAC", "KCO": "SAC", "KCK": "SAC", "SAC": "SAC",
    "SAS": "SAS", "TOR": "TOR",
    "NOJ": "UTA", "UTA": "UTA",
    "CHP": "WAS", "CHZ": "WAS", "BAL": "WAS", "CAP": "WAS", "WSB": "WAS", "WAS": "WAS",
}

# B-Ref abbreviation -> (display abbreviation, primary color, secondary color)
IDENTITY = {
    "STL": ("STL", "#C8102E", "#FDB927"), "ATL": ("ATL", "#E03A3E", "#C1D32F"),
    "BOS": ("BOS", "#007A33", "#BA9653"),
    "NYN": ("NYN", "#E31837", "#1D428A"), "NJN": ("NJN", "#C8102E", "#003DA5"), "BRK": ("BKN", "#000000", "#FFFFFF"),
    "CHH": ("CHH", "#00788C", "#1D1160"), "CHA": ("CHA", "#F26532", "#002B5C"), "CHO": ("CHA", "#00788C", "#1D1160"),
    "CHI": ("CHI", "#CE1141", "#000000"), "CLE": ("CLE", "#6F263D", "#FFB81C"), "DAL": ("DAL", "#00538C", "#B8C4CA"),
    "DEN": ("DEN", "#0E2240", "#FEC524"), "DET": ("DET", "#C8102E", "#1D42BA"),
    "PHW": ("PHW", "#1D428A", "#FFC72C"), "SFW": ("SFW", "#1D428A", "#FFC72C"), "GSW": ("GSW", "#1D428A", "#FFC72C"),
    "SDR": ("SDR", "#006A4E", "#FDB927"), "HOU": ("HOU", "#CE1141", "#C4CED4"),
    "IND": ("IND", "#002D62", "#FDBB30"),
    "BUF": ("BUF", "#F47B20", "#00338D"), "SDC": ("SDC", "#1D428A", "#F58426"), "LAC": ("LAC", "#1D428A", "#C8102E"),
    "MNL": ("MNL", "#1D428A", "#FDB927"), "LAL": ("LAL", "#552583", "#FDB927"),
    "VAN": ("VAN", "#00B2A9", "#BC7844"), "MEM": ("MEM", "#5D76A9", "#12173F"),
    "MIA": ("MIA", "#98002E", "#F9A01B"), "MIL": ("MIL", "#00471B", "#EEE1C6"), "MIN": ("MIN", "#0C2340", "#78BE20"),
    "NOH": ("NOH", "#00788C", "#1D1160"), "NOK": ("NOK", "#00788C", "#1D1160"), "NOP": ("NOP", "#0C2340", "#C8102E"),
    "NYK": ("NYK", "#006BB6", "#F58426"),
    "SEA": ("SEA", "#00653A", "#FFC200"), "OKC": ("OKC", "#007AC1", "#EF3B24"),
    "ORL": ("ORL", "#0077C0", "#C4CED4"),
    "SYR": ("SYR", "#1D428A", "#ED174C"), "PHI": ("PHI", "#006BB6", "#ED174C"),
    "PHO": ("PHX", "#1D1160", "#E56020"), "POR": ("POR", "#E03A3E", "#000000"),
    "CIN": ("CIN", "#0046AD", "#E31837"), "KCO": ("KCO", "#0046AD", "#E31837"), "KCK": ("KCK", "#0046AD", "#E31837"), "SAC": ("SAC", "#5A2D81", "#63727A"),
    "SAS": ("SAS", "#000000", "#C4CED4"), "TOR": ("TOR", "#CE1141", "#000000"),
    "NOJ": ("NOJ", "#5A2D81", "#FDB927"), "UTA": ("UTA", "#002B5C", "#F9A01B"),
    "CHP": ("CHP", "#002B5C", "#E31837"), "CHZ": ("CHZ", "#002B5C", "#E31837"), "BAL": ("BAL", "#002B5C", "#E31837"),
    "CAP": ("CAP", "#002B5C", "#E31837"), "WSB": ("WSB", "#002B5C", "#E31837"), "WAS": ("WAS", "#002B5C", "#E31837"),
}


def fetch(raw_dir):
    os.makedirs(raw_dir, exist_ok=True)
    paths = {}
    for key, name in FILES.items():
        path = os.path.join(raw_dir, name.replace(" ", "_"))
        if not os.path.exists(path):
            print("downloading", name)
            urllib.request.urlretrieve(BASE + name.replace(" ", "%20"), path)
        paths[key] = path
    return paths


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def pos_group(pos):
    p = pos.split("-")[0]
    if p in ("PG", "SG", "G"):
        return 0
    if p in ("SF", "PF", "F"):
        return 1
    return 2


def norm_positions(pos):
    out = []
    for p in pos.replace("/", "-").split("-"):
        p = p.strip().upper()
        if p == "G":
            out += ["PG", "SG"]
        elif p == "F":
            out += ["SF", "PF"]
        elif p in ("PG", "SG", "SF", "PF", "C"):
            out.append(p)
    return out


def league_averages(path):
    """Per team-game league averages by season (steals and blocks from 1973-74)."""
    tot = defaultdict(lambda: defaultdict(float))
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r["lg"] != "NBA" or r["abbreviation"] in ("", "NA"):
            continue
        season = int(r["season"])
        g = num(r["g"]) or 0
        for k, col in (("pts", "pts"), ("reb", "trb"), ("ast", "ast"), ("stl", "stl"), ("blk", "blk")):
            v = num(r[col])
            if v is not None and g:
                tot[season][k] += v
                tot[season]["g_" + k] += g
    return {s: {k: t[k] / t["g_" + k] for k in STATS if t.get("g_" + k)} for s, t in tot.items()}


def fit_estimators(rows):
    """Least-squares models for era-rated per-game steals and blocks, from 1974-1985 seasons."""
    xs, ys_s, ys_b = [], [], []
    for r in rows:
        if not (STL_BLK_FIRST <= r["season"] <= 1985) or r["g"] < 20:
            continue
        g = r["g"]
        xs.append(features(r))
        ys_s.append(r["adj"]["stl"] / g)
        ys_b.append(r["adj"]["blk"] / g)
    ws = np.linalg.lstsq(np.array(xs), np.array(ys_s), rcond=None)[0]
    wb = np.linalg.lstsq(np.array(xs), np.array(ys_b), rcond=None)[0]
    return ws, wb


def features(r):
    g = r["g"]
    grp = pos_group(r["pos"])
    return [1.0, r["adj"]["pts"] / g, r["adj"]["reb"] / g, r["adj"]["ast"] / g, 1.0 if grp == 0 else 0.0, 1.0 if grp == 2 else 0.0]


def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".cache", "raw")
    paths = fetch(raw_dir)

    rows = []
    pos_games = defaultdict(lambda: defaultdict(float))
    career = defaultdict(lambda: {"g": 0.0, "pts": 0.0, "reb": 0.0, "ast": 0.0})
    for r in csv.DictReader(open(paths["totals"], encoding="utf-8")):
        if r["lg"] != "NBA" or r["team"] not in FRANCHISE:
            continue
        season = int(r["season"])
        g = num(r["g"]) or 0
        if g <= 0:
            continue
        listed = norm_positions(r["pos"])
        for p in listed:
            pos_games[r["player_id"]][p] += g / len(listed)
        c = career[r["player_id"]]
        c["g"] += g
        c["pts"] += num(r["pts"]) or 0.0
        c["reb"] += num(r["trb"]) or 0.0
        c["ast"] += num(r["ast"]) or 0.0
        if season < FIRST_SEASON:
            continue
        rows.append({
            "season": season, "pid": r["player_id"], "name": r["player"], "team": r["team"], "pos": r["pos"],
            "g": g, "pts": num(r["pts"]) or 0.0, "reb": num(r["trb"]) or 0.0, "ast": num(r["ast"]) or 0.0,
            "stl": num(r["stl"]), "blk": num(r["blk"]), "mp": num(r["mp"]) or 0.0,
        })

    # era rating: each season against its own league, on the all-seasons average scale
    league = league_averages(paths["team_totals"])
    scale = {k: float(np.mean([v[k] for s, v in league.items() if s >= FIRST_SEASON and k in v])) for k in STATS}
    for r in rows:
        lg = league[r["season"]]
        r["adj"] = {k: (r[k] * scale[k] / lg[k] if r[k] is not None and k in lg else None) for k in STATS}

    ws, wb = fit_estimators(rows)
    for r in rows:
        r["est"] = False
        if r["stl"] is None or r["blk"] is None:
            g = r["g"]
            feats = np.array(features(r))
            for k, wk in (("stl", ws), ("blk", wb)):
                if r[k] is None:
                    # not recorded: the estimate is already on the rated scale, and is also what we show
                    r[k] = r["adj"][k] = max(0.0, float(feats @ wk)) * g
            r["est"] = True

    # career rates on the rated scale, the anchor for short stints
    career_rate = {}
    sums = defaultdict(lambda: defaultdict(float))
    for r in rows:
        c = sums[r["pid"]]
        c["g"] += r["g"]
        for k in STATS:
            c[k] += r["adj"][k]
    for pid, c in sums.items():
        career_rate[pid] = {k: c[k] / c["g"] for k in STATS}

    # career positions, weighted by games
    def profile(c):
        t = c["pts"] + c["reb"] + c["ast"] or 1.0
        return np.array([c["reb"] / t, c["ast"] / t])

    centroids = {}
    for p in SLOT_ORDER:
        pts = [profile(career[pid]) for pid, by in pos_games.items() if by and max(by, key=by.get) == p and career[pid]["g"] >= 40]
        centroids[p] = np.mean(pts, axis=0)

    def positions_for(pid):
        by = pos_games.get(pid)
        if not by:
            # no listed position anywhere: nearest stat profile (rebound and assist share)
            v = profile(career[pid])
            return [min(SLOT_ORDER, key=lambda p: float(np.sum((centroids[p] - v) ** 2)))]
        total = sum(by.values())
        ranked = sorted(by.items(), key=lambda kv: -kv[1])
        keep = [p for p, gm in ranked if gm / total >= POS_SHARE][:POS_MAX] or [ranked[0][0]]
        return sorted(keep, key=SLOT_ORDER.index)

    # team-season records (for labels and playoff opponents)
    team_seasons = {}
    for r in csv.DictReader(open(paths["teams"], encoding="utf-8")):
        if r["lg"] != "NBA" or r["abbreviation"] not in FRANCHISE:
            continue
        team_seasons[(int(r["season"]), r["abbreviation"])] = {
            "name": r["team"], "w": int(float(r["w"])), "l": int(float(r["l"])), "playoffs": r["playoffs"] == "TRUE",
        }

    # dominant identity per (franchise, decade)
    seasons_by = defaultdict(lambda: defaultdict(set))
    for r in rows:
        fr = FRANCHISE[r["team"]]
        seasons_by[(fr, r["season"] // 10 * 10)][r["team"]].add(r["season"])
    identity = {}
    for key, by_abbr in seasons_by.items():
        abbr = sorted(by_abbr, key=lambda a: (len(by_abbr[a]), max(by_abbr[a])))[-1]
        name = None
        for s in sorted(by_abbr[abbr], reverse=True):
            if (s, abbr) in team_seasons:
                name = team_seasons[(s, abbr)]["name"]
                break
        all_seasons = sorted(set().union(*by_abbr.values()))
        identity[key] = {"abbr": abbr, "name": name or abbr, "first": all_seasons[0], "last": all_seasons[-1], "n": len(all_seasons)}

    # aggregate per (player, franchise, decade)
    agg = {}
    for r in rows:
        fr = FRANCHISE[r["team"]]
        key = (r["pid"], fr, r["season"] // 10 * 10)
        a = agg.setdefault(key, {"name": r["name"], "pid": r["pid"], "g": 0.0, "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "adj": defaultdict(float), "seasons": set(), "est": False})
        a["g"] += r["g"]
        for k in STATS:
            a[k] += r[k]
            a["adj"][k] += r["adj"][k]
        a["seasons"].add(r["season"])
        a["est"] = a["est"] or r["est"]

    def line(a):
        g = a["g"]
        return {k: a[k] / g for k in STATS}

    def rated(a):
        """Era-rated per-game line, blended with the career rate for short stints."""
        g = a["g"]
        c = career_rate[a["pid"]]
        return {k: (a["adj"][k] + SHRINK_GAMES * c[k]) / (g + SHRINK_GAMES) for k in STATS}

    def value(s):
        return sum(s[k] * W[k] for k in W)

    # prime line per player
    prime = {}
    for (pid, fr, dec), a in agg.items():
        if a["g"] < 20:
            continue
        v = value(rated(a))
        if pid not in prime or v > prime[pid][0]:
            prime[pid] = (v, fr, dec)

    cells = defaultdict(list)
    for (pid, fr, dec), a in agg.items():
        cells[(fr, dec)].append((pid, a))

    by_name = defaultdict(set)
    for (pid, fr, dec), a in agg.items():
        by_name[a["name"]].add(pid)
    namesakes = set()
    for pids in by_name.values():
        if len(pids) > 1:
            best = max(pids, key=lambda x: career[x]["g"])
            namesakes |= pids - {best}

    teams = []
    for (fr, dec) in sorted(cells):
        ident = identity[(fr, dec)]
        disp, c1, c2 = IDENTITY[ident["abbr"]]
        plist = []
        for pid, a in cells[(fr, dec)]:
            s = line(a)
            rt = rated(a)
            pos = positions_for(pid)
            pr = prime.get(pid)
            pr_ref = None
            if pr and (pr[1], pr[2]) != (fr, dec):
                pr_ref = pr[1] + "-" + str(pr[2])
            seas = sorted(a["seasons"])
            plist.append([
                a["name"], "/".join(pos), round(s["pts"], 1), round(s["reb"], 1), round(s["ast"], 1),
                round(s["stl"], 1), round(s["blk"], 1), int(a["g"]), len(seas), seas[0], seas[-1],
                1 if a["est"] else 0, pr_ref, pid,
                round(rt["pts"], 1), round(rt["reb"], 1), round(rt["ast"], 1), round(rt["stl"], 1), round(rt["blk"], 1),
            ])
        plist.sort(key=lambda p: -(p[14] * W["pts"] + p[15] * W["reb"] + p[16] * W["ast"] + p[17] * W["stl"] + p[18] * W["blk"]))
        # same name, different players: all but the best-known get their years with this team
        for p in plist:
            if p[13] in namesakes:
                p[0] = p[0] + " (" + str(p[9] - 1) + "–" + str(p[10])[2:] + ")"
        if len(plist) < 6:
            continue
        teams.append({
            "id": fr + "-" + str(dec), "fr": fr, "abbr": disp, "name": ident["name"], "era": str(dec) + "s",
            "c1": c1, "c2": c2, "from": ident["first"], "to": ident["last"], "players": plist,
        })

    # playoff opponents: great real teams, normalised to 82 games
    playoff = []
    roster = defaultdict(list)
    for r in rows:
        roster[(r["season"], r["team"])].append(r)
    season_best = {}
    for r in rows:
        if r["g"] < 30:
            continue
        g = r["g"]
        v = value({k: r["adj"][k] / g for k in W})
        key = (r["season"], r["team"])
        if key not in season_best or v > season_best[key][0]:
            season_best[key] = (v, r["name"])
    for (season, abbr), t in team_seasons.items():
        if season < FIRST_SEASON:
            continue
        games = t["w"] + t["l"]
        if games < 50:
            continue
        w82 = round(t["w"] * 82 / games)
        if w82 < 53:
            continue
        disp, c1, c2 = IDENTITY[abbr]
        star = season_best.get((season, abbr), (0, ""))[1]
        # their starting five: the five who played the most minutes that season, with that season's real per-game line
        five = []
        for r in sorted(roster[(season, abbr)], key=lambda x: -x["mp"])[:5]:
            g = r["g"]
            pos = (norm_positions(r["pos"]) or ["?"])[0]
            five.append([r["name"], pos, round(r["pts"] / g, 1), round(r["reb"] / g, 1), round(r["ast"] / g, 1), round(r["stl"] / g, 1), round(r["blk"] / g, 1), int(g), 1 if r["est"] else 0])
        playoff.append({
            "year": str(season - 1) + "-" + str(season)[2:], "team": t["name"], "abbr": disp, "w": t["w"], "l": t["l"],
            "w82": w82, "c1": c1, "c2": c2, "star": star, "five": five,
        })
    playoff.sort(key=lambda x: (-x["w82"], x["year"]))

    out = {
        "source": "Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets",
        "built": max(r["season"] for r in rows),
        "fields": ["name", "pos", "pts", "reb", "ast", "stl", "blk", "g", "seasons", "from", "to", "est", "prime", "pid", "r_pts", "r_reb", "r_ast", "r_stl", "r_blk"],
        "scale": {k: round(scale[k], 2) for k in STATS},
        "teams": teams,
        "playoff": playoff,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n_players = sum(len(t["players"]) for t in teams)
    print("teams", len(teams), "player-lines", n_players, "playoff teams", len(playoff), "bytes", os.path.getsize(OUT))
    print("stl model", np.round(ws, 3), "blk model", np.round(wb, 3))


if __name__ == "__main__":
    main()
