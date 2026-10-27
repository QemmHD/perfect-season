"""Build the NFL player database for Perfect Season.

Sources: see scripts/nfl_sources.py (Pro-Football-Reference season tables 1970-2021,
nflverse weekly stats and rosters 1999-2025, FiveThirtyEight and nflverse game scores) and,
for defenders, scripts/nfl_more_sources.py (.cache/nfl_players_more.json; see
scripts/nfl_defenders.py for how they're valued).

Output: src/data/nfl.json with
  teams:   franchise-decade cells. Each holds its quarterbacks, running backs, receivers
           and tight ends (per-game averages for that team in that decade) and its defensive
           linemen, linebackers and defensive backs (per-season averages, Pro Bowls, All-Pros)
  playoff: every real playoff team since 1970, used as playoff opponents, with its key
           players on offense and its best defender at each position that season

Rules:
  - seasons 1970 (the first after the AFL-NFL merger) through 2025; a season belongs to the
    decade it is played in (the 1985 season -> 1980s)
  - a cell is (franchise, decade), labelled with the franchise's dominant name that decade
    (most seasons; ties go to the later name): the 1980s Raiders are the Los Angeles Raiders
  - stats are sum(totals) / sum(games played) over every season of that player with that
    franchise in that decade. A traded player's split season before 1999 has no team in the
    source (PFR lists it as 2TM) and is left out of the cells (it still counts in the league's
    totals and the player's career rate); from 1999 every game counts for its own team
  - each line carries the real per-game stats (shown) and what the game scores (rated):
      * era: every stat is measured against that season's league (per team-game) and put on
        the 1970-2025 average scale, so 1970s passing and 2010s rushing aren't penalised
      * value in adjusted yards per game: yards + 20 per touchdown - 45 per interception
        (the weights of adjusted net yards per attempt), split into passing, rushing and
        receiving. Quarterbacks count passing and rushing; everyone else rushing and receiving
      * small samples: a stint is blended with the player's career rate as if he had played
        SHRINK_GAMES more games at it
      * positions are put on one scale: each position's adjusted yards are mapped, by
        quantile, onto the value distribution of the NBA game's rotation players (top 11 of
        each team-decade), using that position's top players in each cell. So a 95th
        percentile tight end is worth what a 95th percentile quarterback is, and rarity tiers
        mean the same thing in both sports. Above the 98th percentile the map goes by yards,
        not rank, so two near-equal lines at the top are worth near the same
  - defenders: DL, LB and DB lines, the same rule (one player, one franchise, one decade),
    valued on the same scale (scripts/nfl_defenders.py); the best few of each per cell
  - positions: the player's most-played position over his career (FB counts as RB; from
    1999 each season's roster position). The few PFR rows with no position get the one from
    his other seasons, or the nearest by stats
  - lists: QBs with 4+ starts and 100+ attempts, RBs with 6+ games and 40+ touches,
    WRs and TEs with 6+ games and 15+ catches; at most POS_CAP of each per cell
  - same name, different players: all but the one with the most games get their years
  - prime = the player's best listed line (8+ games) by value

Usage: python3 scripts/build_nfl_data.py [raw_dir] [players_more.json]
"""

import json
import os
import sys
from bisect import bisect_left
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nfl_defenders as D  # noqa: E402
import nfl_sources as S  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "data", "nfl.json")
SHRINK_GAMES = 4
TD_YARDS = 20
INT_YARDS = 45
POS_CAP = {"QB": 5, "RB": 9, "WR": 12, "TE": 6}
# how many per cell count as "that position's players" for the value scale
POS_POOL = {"QB": 2, "RB": 3, "WR": 4, "TE": 2}
# NBA rotation players' value quantiles (top 11 of each team-decade in src/data/nba.json)
TARGET = [(0, 5.19), (0.02, 8.59), (0.05, 10.05), (0.1, 10.91), (0.2, 11.83), (0.3, 12.54), (0.4, 13.18), (0.5, 13.69), (0.6, 14.41),
          (0.7, 15.37), (0.8, 16.46), (0.9, 18.18), (0.95, 19.81), (0.98, 22.07), (0.99, 23.32), (0.995, 24.41), (1, 30.33)]
SHOWN = ("pass_yds", "pass_td", "int", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td")
# a defender's shown stats: per season (-1 not known), then Pro Bowls and All-Pro seasons in the line
DEF_SHOWN = ("sacks", "tkl", "int", "pd", "ff", "pb", "ap")


def target_at(q):
    for (q0, v0), (q1, v1) in zip(TARGET, TARGET[1:]):
        if q <= q1:
            return v0 + (q - q0) / (q1 - q0) * (v1 - v0) if q1 > q0 else v1
    return TARGET[-1][1]


TAIL = 0.98


class QuantileMap:
    """Monotone map from a raw score to the shared value scale, fitted on a reference pool.

    By rank up to the pool's 98th percentile. Above it by raw score, at the yards-to-value rate
    of the 90th-98th percentile band, up to the scale's top: by rank alone the pool's best would
    always get the scale's maximum and the runner-up the next quantile, however close they are."""

    def __init__(self, pool):
        self.xs = sorted(pool)
        n = len(self.xs)
        self.ys = [target_at(i / (n - 1)) for i in range(n)]
        self.t = int(TAIL * (n - 1))
        lo = int(0.9 * (n - 1))
        self.rate = (self.ys[self.t] - self.ys[lo]) / max(1e-9, self.xs[self.t] - self.xs[lo])

    def __call__(self, x):
        xs, ys = self.xs, self.ys
        if x <= xs[0]:
            # below the pool: on toward zero along the slope of the bottom fifth
            k = max(1, len(xs) // 5)
            slope = (ys[k] - ys[0]) / max(1e-9, xs[k] - xs[0])
            return max(0.5, ys[0] - (xs[0] - x) * slope)
        if x >= xs[self.t]:
            return min(TARGET[-1][1], ys[self.t] + (x - xs[self.t]) * self.rate)
        i = bisect_left(xs, x)
        x0, x1, y0, y1 = xs[i - 1], xs[i], ys[i - 1], ys[i]
        return y0 + (x - x0) / (x1 - x0) * (y1 - y0) if x1 > x0 else y1


def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".cache", "nfl")
    more_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(raw_dir, "..", "nfl_players_more.json")
    S.fetch(raw_dir)
    reg = S.Register(os.path.join(raw_dir, "players.csv"))
    rows = S.player_rows(raw_dir, reg)
    games = S.team_games(raw_dir)
    ts = S.team_seasons(games)

    # positions: most-played over the career
    pos_games = defaultdict(Counter)
    for r in rows:
        if r["pos"]:
            pos_games[r["pid"]][r["pos"]] += r["g"]

    def by_stats(r):
        if r["pass_att"] >= 50:
            return "QB"
        return "RB" if r["rush_att"] >= r["rec"] else "WR"

    # a traded player's combined season before 1999: real league yards, but no team
    xtm = [r for r in rows if r.get("xtm")]
    kept = []
    for r in rows:
        if r.get("xtm"):
            continue
        c = pos_games.get(r["pid"])
        if c:
            r["cpos"] = c.most_common(1)[0][0]
        elif r["pid"].startswith("pfr:") or r["pass_att"] >= 50 or r["rush_yds"] + r["rec_yds"] >= 100:
            r["cpos"] = by_stats(r)  # PFR rows with no listed position, and the odd defender with offense
        else:
            continue  # nflverse rows for defenders and kickers
        if r["fr"] not in S.FRANCHISES or r["g"] <= 0:
            continue
        kept.append(r)
    rows = kept

    # league per team-game averages by season, and the scale they're all put on
    team_g = Counter()
    pts = Counter()
    for (s, fr), t in ts.items():
        team_g[s] += t["g"]
        pts[s] += t["pf"]
    league = defaultdict(lambda: defaultdict(float))
    for r in rows + xtm:
        for k in S.STATS:
            league[r["season"]][k] += r[k]
    for s in league:
        for k in S.STATS:
            league[s][k] /= team_g[s]
        league[s]["pts"] = pts[s] / team_g[s]
    seasons = sorted(league)
    scale = {k: sum(league[s][k] for s in seasons) / len(seasons) for k in list(S.STATS) + ["pts"]}
    for r in rows + xtm:
        lg = league[r["season"]]
        r["adj"] = {k: r[k] * scale[k] / lg[k] for k in S.STATS}

    def parts(a, g):
        """Adjusted yards per game: passing, rushing, receiving."""
        return (
            (a["pass_yds"] + TD_YARDS * a["pass_td"] - INT_YARDS * a["int"]) / g,
            (a["rush_yds"] + TD_YARDS * a["rush_td"]) / g,
            (a["rec_yds"] + TD_YARDS * a["rec_td"]) / g,
        )

    # career rates on the rated scale, the anchor for short stints
    career = defaultdict(lambda: defaultdict(float))
    for r in rows + xtm:
        c = career[r["pid"]]
        c["g"] += r["g"]
        for k in S.STATS:
            c[k] += r["adj"][k]
    career_rate = {pid: parts(c, c["g"]) for pid, c in career.items()}

    # aggregate per (player, franchise, decade)
    agg = {}
    for r in rows:
        key = (r["pid"], r["fr"], r["season"] // 10 * 10)
        a = agg.get(key)
        if a is None:
            a = agg[key] = {"pid": r["pid"], "name": r["name"], "pos": r["cpos"], "g": 0.0, "gs": 0.0, "pass_att": 0.0, "rush_att": 0.0,
                            "seasons": set(), "raw": defaultdict(float), "adj": defaultdict(float)}
        a["g"] += r["g"]
        a["gs"] += r["gs"]
        a["pass_att"] += r["pass_att"]
        a["rush_att"] += r["rush_att"]
        a["seasons"].add(r["season"])
        a["name"] = r["name"]  # the latest spelling
        for k in S.STATS:
            a["raw"][k] += r[k]
            a["adj"][k] += r["adj"][k]

    def rated_parts(a):
        g = a["g"]
        own = parts(a["adj"], 1.0)
        c = career_rate[a["pid"]]
        out = [(own[i] + SHRINK_GAMES * c[i]) / (g + SHRINK_GAMES) for i in range(3)]
        # a quarterback is valued for passing and running, everyone else for running and catching
        # (a running back's option pass or a gadget player's snaps at quarterback don't count)
        if a["pos"] == "QB":
            out[2] = 0.0
        else:
            out[0] = 0.0
        return tuple(out)

    def eligible(a):
        raw = a["raw"]
        if a["pos"] == "QB":
            return a["gs"] >= 4 and a["pass_att"] >= 100
        if a["pos"] == "RB":
            return a["g"] >= 6 and a["rush_att"] + raw["rec"] >= 40
        return a["g"] >= 6 and raw["rec"] >= 15

    cells = defaultdict(list)
    for (pid, fr, dec), a in agg.items():
        if eligible(a):
            a["parts"] = rated_parts(a)
            a["ay"] = sum(a["parts"])
            cells[(fr, dec)].append(a)

    # one value scale for every position
    pools = defaultdict(list)
    for key, lst in cells.items():
        for pos, n in POS_POOL.items():
            pools[pos] += sorted((a["ay"] for a in lst if a["pos"] == pos), reverse=True)[:n]
    qmap = {pos: QuantileMap(pool) for pos, pool in pools.items()}
    for lst in cells.values():
        for a in lst:
            a["val"] = qmap[a["pos"]](a["ay"])

    # each cell's listed players: the best at each position, up to its cap
    kept = {}
    for (fr, dec), lst in cells.items():
        keep = []
        for pos, cap in POS_CAP.items():
            keep += sorted((a for a in lst if a["pos"] == pos), key=lambda a: -a["val"])[:cap]
        kept[(fr, dec)] = keep

    # defenders: DL, LB and DB lines on the same value scale
    int_rate = {s: league[s]["int"] for s in league}
    defs, playoff_defs = D.build({k: t["g"] for k, t in ts.items()}, int_rate, scale["int"], QuantileMap, set(cells), more_path)
    for cell in cells:
        # a two-way player (Deion Sanders, the 1990s Cowboys) keeps his better line: one a cell
        off = {a["pid"]: a for a in kept[cell]}
        dfn = {a["pid"]: a for a in defs.get(cell, [])}
        both = off.keys() & dfn.keys()
        kept[cell] = [a for a in kept[cell] if a["pid"] not in both or a["val"] >= dfn[a["pid"]]["val"]]
        defs[cell] = [a for a in defs.get(cell, []) if a["pid"] not in both or a["val"] > off[a["pid"]]["val"]]
    # a defender's prime: his best listed line with 8+ games
    def_prime = {}
    for (fr, dec), lst in defs.items():
        for a in lst:
            if a["g"] >= 8 and (a["pid"] not in def_prime or a["val"] > def_prime[a["pid"]][0]):
                def_prime[a["pid"]] = (a["val"], fr, dec)

    def stored(a):
        """The value as the app reads it: the three rated parts, each rounded on its own."""
        total = sum(max(0.0, x) for x in a["parts"]) or 1.0
        return [round(a["val"] * max(0.0, x) / total, 2) for x in a["parts"]]

    # prime line per player, among the lines that are listed
    prime = {}
    for (fr, dec), lst in kept.items():
        for a in lst:
            if a["g"] < 8:
                continue
            if a["pid"] not in prime or a["val"] > prime[a["pid"]][0]:
                prime[a["pid"]] = (a["val"], fr, dec, round(sum(stored(a)), 2))

    # dominant identity per cell
    def cell_identity(fr, dec):
        ss = defaultdict(list)
        for s in range(dec, dec + 10):
            if (s, fr) in ts:
                ident = S.identity(fr, s)
                ss[ident[1]].append(s)
        name = sorted(ss, key=lambda n: (len(ss[n]), max(ss[n])))[-1]
        s = max(ss[name])
        allss = sorted(x for v in ss.values() for x in v)
        return S.identity(fr, s), allss[0], allss[-1]

    # same name, different players
    by_name = defaultdict(set)
    games_of = Counter()
    for lst in list(cells.values()) + list(defs.values()):
        for a in lst:
            by_name[a["name"]].add(a["pid"])
            games_of[a["pid"]] += a["g"]
    namesakes = set()
    for pids in by_name.values():
        if len(pids) > 1:
            namesakes |= pids - {max(pids, key=lambda x: games_of[x])}

    teams = []
    for (fr, dec) in sorted(cells):
        (disp, name, c1, c2), first, last = cell_identity(fr, dec)
        keep = kept[(fr, dec)]
        plist = []
        for a in keep:
            g = a["g"]
            seas = sorted(a["seasons"])
            pr = prime.get(a["pid"])
            shown = stored(a)
            # a short stint can rate above his prime: then there's nothing to upgrade to
            pr_ref = pr[1] + "-" + str(pr[2]) if pr and (pr[1], pr[2]) != (fr, dec) and pr[3] >= round(sum(shown), 2) + 0.01 else None
            nm = a["name"]
            if a["pid"] in namesakes:
                nm += " (" + str(seas[0]) + ("–" + str(seas[-1])[2:] if seas[-1] != seas[0] else "") + ")"
            raw = a["raw"]
            plist.append([
                nm, a["pos"], int(g), len(seas), seas[0], seas[-1], pr_ref, a["pid"],
                *[round(raw[k] / g, 2 if k in ("pass_td", "int", "rush_td", "rec_td") else 1) for k in SHOWN],
                *shown, 0,
            ])
        for a in defs[(fr, dec)]:
            seas = a["seasons"]
            pr = def_prime.get(a["pid"])
            val = round(a["val"], 2)
            pr_ref = pr[1] + "-" + str(pr[2]) if pr and (pr[1], pr[2]) != (fr, dec) and round(pr[0], 2) >= val + 0.01 else None
            nm = a["name"]
            if a["pid"] in namesakes:
                nm += " (" + str(seas[0]) + ("–" + str(seas[-1])[2:] if seas[-1] != seas[0] else "") + ")"
            shown = a["shown"]
            plist.append([
                nm, a["slot"], a["g"], len(seas), seas[0], seas[-1], pr_ref, a["pid"],
                *[shown[k] for k in DEF_SHOWN[:5]], a["pb"], a["ap"], 1 if a["est"] else 0,
                0, 0, 0, val, a["role"],
            ])
        plist.sort(key=lambda p: -(p[16] + p[17] + p[18] + p[19]))
        teams.append({"id": fr + "-" + str(dec), "fr": fr, "abbr": disp, "name": name, "era": str(dec) + "s", "c1": c1, "c2": c2,
                      "from": first, "to": last, "players": plist})

    # playoff opponents: every playoff team since 1970, normalised to 17 games
    season_rows = defaultdict(list)
    for r in rows:
        season_rows[(r["season"], r["fr"])].append(r)
    playoff = []
    for (s, fr), t in sorted(ts.items()):
        if not t["po"] or fr not in S.FRANCHISES or not t["g"]:
            continue
        disp, name, c1, c2 = S.identity(fr, s)
        roster = season_rows[(s, fr)]

        def top(pos, key, n=1, skip=()):
            got = [r for r in sorted(roster, key=lambda r: -r[key]) if r["cpos"] in pos and r["pid"] not in skip]
            return got[:n]

        qb = top(("QB",), "pass_att")
        rb = top(("RB",), "rush_att")
        rec = top(("WR", "TE"), "rec_yds", 2)
        five = []
        for r in qb + rb + rec:
            g = r["g"]
            five.append([r["name"], r["cpos"], int(g)] + [round(r[k] / g, 2 if k in ("pass_td", "int", "rush_td", "rec_td") else 1) for k in SHOWN])
        star = max(qb + rb + rec, key=lambda r: sum(parts(r["adj"], r["g"])), default=None)
        w17 = round((t["w"] + t["t"] / 2) * 17 / t["g"])
        rounds_won = sum(1 for p in t["po"] if p[1])
        playoff.append({
            "year": str(s), "team": name, "abbr": disp, "w": t["w"], "l": t["l"], "t": t["t"], "w17": w17, "c1": c1, "c2": c2,
            "star": star["name"] if star else "", "pf": round(t["pf"] / t["g"], 1), "pa": round(t["pa"] / t["g"], 1),
            "champ": t["champ"], "won": rounds_won, "five": five, "def": playoff_defs.get((s, fr), []),
        })
    playoff.sort(key=lambda x: (-x["w17"], x["year"]))

    out = {
        "source": "Pro-Football-Reference via github.com/fantasydatapros/data (1970-98), nflverse (1999-2025), FiveThirtyEight and nflverse scores; defenders: nflverse, Wikidata and Wikipedia",
        "built": S.LAST_SEASON,
        "fields": ["name", "pos", "g", "seasons", "from", "to", "prime", "pid", *SHOWN, "r_pass", "r_rush", "r_recv", "r_def"],
        "def_fields": ["name", "pos", "g", "seasons", "from", "to", "prime", "pid", *DEF_SHOWN, "games_est", "-", "-", "-", "r_def", "role"],
        "playoff_def_fields": ["name", "pos", "g", "sacks", "tkl", "int", "honor (2 first-team All-Pro, 1 Pro Bowl or second team)"],
        "scale": {k: round(v, 2) for k, v in scale.items()},
        "teams": teams,
        "playoff": playoff,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(t["players"]) for t in teams)
    print("cells", len(teams), "lines", n, "playoff teams", len(playoff), "bytes", os.path.getsize(OUT))


if __name__ == "__main__":
    main()
