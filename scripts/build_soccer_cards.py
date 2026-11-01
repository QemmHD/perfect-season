"""Build the soccer Ultimate Team card data: src/data/cards-soccer.json (Python 3 standard library).

Reads the cache scripts/soccer_sources.py makes (Transfermarkt aggregate, Wikidata, openfootball)
and rates every league player-season with our own model (docs/SOCCER-DATA.md has the full rules):

Pool: every club spell of 900+ league minutes in the Premier League, LaLiga, Serie A,
  Bundesliga, Ligue 1, Eredivisie and Primeira Liga, 2012-13 to 2025-26 (season = the year it
  ends), plus one peak-spell line for each curated legend whose peak is before 2012-13.
Strength: league strength L from every European cup game 2012-2026 (goal difference ~ home edge
  + L_home - L_away + k (club GD/game at home - away), ridge-fitted), club strength
  T = L + k x club league GD per game that season.
Quality, within the season and position: Q0 = .40 usage x club strength (U = minutes / (90 x
  team games), times exp(0.45 T)) + .35 role output (position-specific mix of per-90 non-penalty
  goals, assists, on-pitch goals against; rates shrunk to the position mean with 900 minutes,
  league adjusted) + .15 on-pitch goal difference vs off-pitch (shrunk with 1800 minutes) + .10
  honours (league title, Champions League win, Ballon d'Or, UEFA / PFA player of the year, golden
  boot, assists title, captaincy, caps), each a z-score clipped to [-3, 4] (honours to 10);
  Q = Q0 blended 30% x n/(n+1) toward the player's other n seasons. Q's percentile within the
  season maps to the overall: p50 70, p75 75, p90 79, p97 83, p99 86, p99.8 89, best 93 (below the
  median p25 65.5, p10 60, p0 48); a Ballon d'Or season is at least 90.
Tiers: bronze < 65, silver 65-74, gold 75+.
Face stats PAC SHO PAS DRI DEF PHY (GK DIV HAN KIC REF SPD POS) = position template at 75
  + beta (OVR - 75) + evidence (SD units within season and position) + curated traits
  (TRAITS_TABLE), then the position-weighted overall of the six is shifted onto the target overall
  before clamping (so the six always agree with the OVR and keep their shape).
  PAC, DRI and DEF are estimates (no tracking data): PAC from role, age and height, DRI from role,
  output and height, DEF from on-pitch goals against.
Legends: ~130 curated (scripts/soccer_sources.py LEGENDS_TABLE), 88-97, each at one peak spell;
  peak seasons from 2012-13 on use the real Transfermarkt season (boost = legend OVR - season OVR),
  earlier ones get a legend-only line with the spell's Wikidata totals (cols.est = 1, sparse = 1:
  no season card is made from such a line).

Output layout = cards-nba.json's (see build_cards.py and src/ut/cards.ts), with soccer additions:
  groups OUT and GK; players [pid, name, height cm, null]; teams [fr, abbr, name, c1, c2]
  cols + lg (index into "leagues"), ovr (season overall), face ([6 ints] in faceKeys order), est
  promos/legends rows [line, boost, label, ovr, face] (ovr/face of that edition)
  card id soccer:<kind>:<season>:<pid>:<fr>  (pid = Transfermarkt id, else Wikidata Q-id)

Usage: python3 -I scripts/build_soccer_cards.py [--dl DIR]   (prints the sanity report)
"""

import argparse
import bisect
import gzip
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import soccer_sources as S  # noqa: E402

DATA = os.path.join(HERE, "..", "src", "data")
POSITIONS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"]
MIN_MINUTES = 900

OUT_FACE = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]
GK_FACE = ["DIV", "HAN", "KIC", "REF", "SPD", "POS"]
TEMPLATE = {  # at OVR 75
    "ST": [77, 76, 64, 73, 35, 72], "W": [84, 70, 71, 79, 38, 63], "AM": [74, 71, 77, 79, 50, 63],
    "CM": [68, 66, 75, 74, 66, 71], "DM": [63, 58, 70, 68, 74, 76], "FB": [79, 52, 68, 72, 72, 71],
    "CB": [64, 40, 56, 57, 77, 79], "GK": [76, 73, 70, 77, 50, 74],
}
WEIGHTS = {  # overall from the six, by position (sums to 1)
    "ST": [.15, .45, .10, .18, 0, .12], "W": [.25, .20, .20, .30, 0, .05], "AM": [.10, .20, .30, .30, .05, .05],
    "CM": [.05, .10, .35, .20, .15, .15], "DM": [.05, 0, .25, .10, .35, .25], "FB": [.25, 0, .20, .10, .30, .15],
    "CB": [.10, 0, .05, 0, .55, .30], "GK": [.22, .20, .08, .25, .03, .22],
}
# overall quantile map (percentile of Q within the season -> overall)
QMAP = [(0.0, 48), (0.05, 57), (0.10, 60), (0.25, 65.5), (0.50, 70), (0.75, 75), (0.90, 79), (0.97, 83), (0.99, 86), (0.998, 89), (1.0, 93)]
TIERS = [(75, "gold"), (65, "silver"), (0, "bronze")]

W_USAGE, W_ROLE, W_ONOFF, W_HON = 0.40, 0.35, 0.15, 0.10
ZCLIP = (-3.0, 4.0)
CAREER_W = 0.30
BDOR_FLOOR = 90
HON_CLIP = 10.0  # a Ballon d'Or season stands far out in honours; let it count
HONOR_PTS = {"BDOR": 3.0, "UEFA": 2.0, "POTY": 1.5, "BOOT": 1.2, "ASSIST": 0.8, "CHAMP": 1.0, "UCL": 1.0}


def tier(ovr):
    return next(t for lo, t in TIERS if ovr >= lo)


class Ranker:
    def __init__(self, values):
        self.v = sorted(v for v in values if v is not None)

    def __call__(self, x):
        if x is None or not self.v:
            return None
        lo = bisect.bisect_left(self.v, x)
        hi = bisect.bisect_right(self.v, x)
        return (lo + 0.5 * (hi - lo)) / len(self.v)


def qmap(p):
    for (p0, o0), (p1, o1) in zip(QMAP, QMAP[1:]):
        if p <= p1:
            return o0 + (o1 - o0) * (p - p0) / (p1 - p0)
    return QMAP[-1][1]


def solve(a, b):
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        if abs(m[c][c]) < 1e-12:
            continue
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    return [m[i][n] / m[i][i] if abs(m[i][i]) > 1e-12 else 0.0 for i in range(n)]


def mean_sd(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return 0.0, 1.0
    m = sum(xs) / len(xs)
    v = sum((x - m) ** 2 for x in xs) / max(1, len(xs) - 1)
    return m, math.sqrt(v) or 1.0


def sig3(x):
    if x is None:
        return None
    x = float(x)
    if x.is_integer():
        return int(x)
    v = float("%.3g" % x)
    return int(v) if v.is_integer() else v


# ---------------------------------------------------------------- league strength


def league_strength(agg):
    """Ridge fit of European cup goal difference -> {league: L}, k (per club GD/game), home edge."""
    dom = agg["dom"]
    dtab = agg["dom_tab"]

    def club_info(club, season):
        for s in (season, season - 1, season + 1):
            lg = dom.get("%s:%d" % (club, s))
            if lg:
                t = dtab["%s:%d" % (club, s)]
                return lg, (t[4] - t[5]) / max(1, t[0])
        return None, 0.0

    rows = []
    count = Counter()
    for season, h, a, hg, ag, cid in agg["euro"]:
        lh, qh = club_info(h, season)
        la, qa = club_info(a, season)
        if not lh or not la:
            continue
        rows.append((lh, la, qh - qa, max(-5, min(5, hg - ag))))
        count[lh] += 1
        count[la] += 1
    leagues = sorted(l for l, n in count.items() if n >= 40)
    idx = {l: i for i, l in enumerate(leagues)}
    other = len(leagues)
    n = other + 3  # leagues, OTHER, home, k
    ata = [[0.0] * n for _ in range(n)]
    atb = [0.0] * n
    for lh, la, dq, y in rows:
        x = [0.0] * n
        x[idx.get(lh, other)] += 1
        x[idx.get(la, other)] -= 1
        x[n - 2] = 1.0
        x[n - 1] = dq
        for i in range(n):
            if x[i]:
                atb[i] += x[i] * y
                for j in range(n):
                    if x[j]:
                        ata[i][j] += x[i] * x[j]
    for i in range(other + 1):
        ata[i][i] += 20.0  # ridge: 20 games' worth toward the average European league
    sol = solve(ata, atb)
    L = {l: sol[idx[l]] for l in leagues}
    L["OTHER"] = sol[other]
    # centre on the seven leagues' mean so 0 = an average top-seven league
    c = sum(L[l] for l in S.LEAGUES) / len(S.LEAGUES)
    L = {k: v - c for k, v in L.items()}
    return L, sol[n - 1], sol[n - 2], len(rows)


# ---------------------------------------------------------------- season lines


def main_positions(posmin, fallback):
    tot = sum(posmin.values())
    if not tot:
        return [fallback]
    ranked = sorted(posmin.items(), key=lambda kv: -kv[1])
    out = [ranked[0][0]]
    for p, m in ranked[1:]:
        if m >= 0.25 * tot and len(out) < 3:
            out.append(p)
    return out


SUB_POS = {"Goalkeeper": "GK", "Centre-Back": "CB", "Left-Back": "FB", "Right-Back": "FB", "Defensive Midfield": "DM",
           "Central Midfield": "CM", "Attacking Midfield": "AM", "Left Midfield": "W", "Right Midfield": "W",
           "Left Winger": "W", "Right Winger": "W", "Second Striker": "ST", "Centre-Forward": "ST"}


def age_at(dob, season):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", dob or "")
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return season - y - (mo - 1 + (d - 1) / 31.0) / 12.0  # age on 1 January of the season's second half


def build_lines(agg, wd, of, L, k):
    by_tm, by_fr = S.clubs()
    tables = agg["tables"]
    players = agg["players"]
    lines = [l for l in agg["lines"] if l["min"] >= MIN_MINUTES and l["club"] in by_tm]
    # honours
    cl_final = {int(s): c for s, c in agg["cl_final"].items()}
    bdo = ballon_dor(wd)
    boot, assist = {}, {}
    by_lgs = defaultdict(list)
    for l in agg["lines"]:
        by_lgs[(l["lg"], l["season"])].append(l)
    for key, ls in by_lgs.items():
        g = max(x["g"] for x in ls)
        a = max(x["a"] for x in ls)
        for x in ls:
            if x["g"] == g:
                boot[(x["pid"], x["season"], x["club"])] = True
            if x["a"] == a:
                assist[(x["pid"], x["season"], x["club"])] = True
    # champion check vs openfootball
    names = {c["tm"]: c["name"] for c in by_tm.values()}
    agree = disagree = 0
    for key, t in tables.items():
        if t.get("rank") == 1:
            club, season = key.split(":")
            o = of.get("%s:%s" % (t["lg"], season))
            if o:
                a = re.sub(r"[^a-z]", "", S_norm(o))
                b = re.sub(r"[^a-z]", "", S_norm(names.get(club, "")))
                if a[:5] in b or b[:5] in a or a[-5:] in b:
                    agree += 1
                else:
                    disagree += 1
                    print("champion differs: %s %s TM %s / openfootball %s" % (t["lg"], season, names.get(club), o))
    print("league champions agree with openfootball in %d tables, differ in %d" % (agree, disagree))

    out = []
    for l in lines:
        p = players.get(l["pid"], {})
        t = tables["%s:%d" % (l["club"], l["season"])]
        pos = main_positions(l["pos"], SUB_POS.get(p.get("sub"), "CM"))
        honors = []
        key = (l["pid"], l["season"], l["club"])
        if t.get("rank") == 1:
            honors.append("CHAMP")
        if cl_final.get(l["season"]) == l["club"] and l["cl_apps"] >= 3:
            honors.append("UCL")
        if boot.get(key):
            honors.append("BOOT")
        if assist.get(key) and l["a"] >= 8:
            honors.append("ASSIST")
        if bdo.get((l["pid"], l["season"])):
            honors.append("BDOR")
        for code, winners in AWARDS.items():
            if winners.get(l["season"]) == p.get("name") and (code != "POTY" or l["lg"] == "GB1"):
                honors.append(code)
        T = L.get(l["lg"], 0.0) + k * (t["gf"] - t["ga"]) / t["gp"]
        out.append({"src": l, "pid": l["pid"], "name": p.get("name") or l["pid"], "season": l["season"], "club": by_tm[l["club"]],
                    "lg": l["lg"], "pos": pos, "honors": honors, "T": T, "team": t, "age": age_at(p.get("dob"), l["season"]),
                    "ht": p.get("ht"), "caps": p.get("caps") or 0, "est": 0})
    # a season honour sits on the player's main spell that season (most minutes)
    best = {}
    for x in out:
        k2 = (x["pid"], x["season"])
        if k2 not in best or x["src"]["min"] > best[k2]["src"]["min"]:
            best[k2] = x
    for x in out:
        if best[(x["pid"], x["season"])] is not x:
            x["honors"] = [h for h in x["honors"] if h not in ("BDOR", "UEFA")]
    return out


def S_norm(s):
    import unicodedata
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


# Men's Ballon d'Or (France Football; 2010-2015 the FIFA Ballon d'Or), by the year awarded, where
# Wikidata's award statements lack the winner. Facts, kept here as a fallback for the TM era.
BDOR_FALLBACK = {2010: "28003", 2011: "28003", 2012: "28003", 2013: "8198", 2014: "8198", 2015: "28003", 2016: "8198", 2017: "8198"}


# Individual season awards we add as honours (facts, by the season they were awarded for):
# UEFA Men's Player of the Year and the PFA Players' Player of the Year (Premier League).
AWARDS = {
    "UEFA": {2013: "Franck Ribéry", 2014: "Cristiano Ronaldo", 2015: "Lionel Messi", 2016: "Cristiano Ronaldo", 2017: "Cristiano Ronaldo",
             2018: "Luka Modrić", 2019: "Virgil van Dijk", 2020: "Robert Lewandowski", 2021: "Jorginho", 2022: "Karim Benzema",
             2023: "Erling Haaland", 2024: "Rodri", 2025: "Ousmane Dembélé"},
    "POTY": {2013: "Gareth Bale", 2014: "Luis Suárez", 2015: "Eden Hazard", 2016: "Riyad Mahrez", 2017: "N'Golo Kanté", 2018: "Mohamed Salah",
             2019: "Virgil van Dijk", 2020: "Kevin De Bruyne", 2021: "Kevin De Bruyne", 2022: "Mohamed Salah", 2023: "Erling Haaland",
             2024: "Phil Foden", 2025: "Mohamed Salah"},
}


def ballon_dor(wd):
    """{(tm pid, season): True}; the award's year is the season that ends that year."""
    out = {}
    for r in wd["ballon_dor"]:
        if r.get("tmid") and S.year(r.get("t")):
            out[(r["tmid"], S.year(r["t"]))] = True
    for y, pid in BDOR_FALLBACK.items():
        out[(pid, y)] = True
    return out


# ---------------------------------------------------------------- the model


def shrink(x, minutes, prior_rate, prior_min):
    return (x + prior_rate * prior_min / 90.0) / ((minutes + prior_min) / 90.0)


def rate_lines(lines):
    """Adds q (0-1 within season), ovr, face, rk dict and evidence z-scores to each line."""
    groups = defaultdict(list)
    for x in lines:
        groups[(x["season"], x["pos"][0])].append(x)
    # position priors (all seasons)
    prior = {}
    by_pos = defaultdict(list)
    for x in lines:
        by_pos[x["pos"][0]].append(x)
    for pos, xs in by_pos.items():
        mins = sum(x["src"]["min"] for x in xs)
        prior[pos] = {k: 90.0 * sum(x["src"][k] for x in xs) / mins for k in ("g", "a", "pen", "xa")}
        prior[pos]["npg"] = prior[pos]["g"] - prior[pos]["pen"]
    for x in lines:
        s, t, pos = x["src"], x["team"], x["pos"][0]
        pr = prior[pos]
        lgf = math.exp(0.45 * x["T_league"]) if "T_league" in x else 1.0
        m = s["min"]
        x["g90"] = shrink(s["g"], m, pr["g"], 900) * lgf
        x["npg90"] = shrink(s["g"] - s["pen"], m, pr["npg"], 900) * lgf
        x["a90"] = shrink(s["a"], m, pr["a"], 900) * lgf
        x["xa90"] = shrink(s["xa"], m, pr["xa"], 900) * lgf
        team_ga90 = 90.0 * t["ga"] / (90.0 * t["gp"])
        team_gd90 = (t["gf"] - t["ga"]) / t["gp"]
        on_ga90 = (s["on_ga"] + team_ga90 * 20) / (s["on_min"] / 90.0 + 20)
        x["ga90"] = on_ga90 - 0.5 * x.get("T_league", 0.0)  # conceding in a stronger league counts for less
        on_gd90 = (s["on_gf"] - s["on_ga"] + team_gd90 * 20) / (s["on_min"] / 90.0 + 20)
        off_min = max(0.0, t["gp"] * 90.0 - s["on_min"])
        off_gd = (t["gf"] - s["on_gf"]) - (t["ga"] - s["on_ga"])
        off_gd90 = (off_gd + team_gd90 * 20) / (off_min / 90.0 + 20)
        x["onoff"] = on_gd90 - off_gd90
        x["U"] = min(1.0, m / (90.0 * t["gp"]))
        x["usage"] = x["U"] * math.exp(0.45 * x["T"])
        x["cs_rate"] = s["cs"] / max(1, s["apps"])
        x["full_share"] = s["full"] / max(1, s["apps"])
        x["yc90"] = 90.0 * s["yc"] / m
        hon = sum(HONOR_PTS.get(h, 0) for h in x["honors"])
        hon += 0.5 * min(1.0, s["capt"] / max(1, s["apps"]) * 2)
        hon += 0.8 * min(1.0, math.log1p(x["caps"]) / math.log(100))
        hon += 0.4 * min(1.0, s["cl_apps"] / 8.0)
        x["hon"] = hon
    # z-scores and percentiles within season and position
    for (season, pos), xs in groups.items():
        for key in ("g90", "npg90", "a90", "xa90", "ga90", "onoff", "usage", "cs_rate", "full_share", "yc90", "hon"):
            mu, sd = mean_sd([x[key] for x in xs])
            for x in xs:
                x.setdefault("z", {})[key] = (x[key] - mu) / sd
        hts = [x["ht"] for x in xs if x["ht"]]
        mu, sd = mean_sd(hts)
        ages = [x["age"] for x in xs if x["age"] is not None]
        for x in xs:
            x["z"]["ht"] = (x["ht"] - mu) / sd if x["ht"] else 0.0
        for x in xs:
            z = x["z"]
            if pos == "ST":
                role = 0.70 * z["npg90"] + 0.15 * z["g90"] + 0.15 * z["a90"]
            elif pos == "W":
                role = 0.50 * z["g90"] + 0.50 * z["a90"]
            elif pos == "AM":
                role = 0.45 * z["g90"] + 0.55 * z["a90"]
            elif pos == "CM":
                role = 0.30 * z["g90"] + 0.40 * z["a90"] - 0.30 * z["ga90"]
            elif pos == "DM":
                role = 0.10 * z["g90"] + 0.10 * z["a90"] - 0.80 * z["ga90"]
            elif pos == "FB":
                role = 0.10 * z["g90"] + 0.30 * z["a90"] - 0.60 * z["ga90"]
            elif pos == "CB":
                role = 0.10 * z["g90"] - 0.90 * z["ga90"]
            else:
                role = -0.65 * z["ga90"] + 0.35 * z["cs_rate"]
            x["role"] = role
        for key in ("usage", "role", "onoff", "hon"):
            rk = Ranker([x[key] for x in xs])
            mu, sd = mean_sd([x[key] for x in xs])
            for x in xs:
                x.setdefault("p", {})[key] = rk(x[key])
                x.setdefault("zc", {})[key] = max(ZCLIP[0], min(HON_CLIP if key == "hon" else ZCLIP[1], (x[key] - mu) / sd))
        for x in xs:
            zc = x["zc"]
            x["Q0"] = W_USAGE * zc["usage"] + W_ROLE * zc["role"] + W_ONOFF * zc["onoff"] + W_HON * zc["hon"]
    # a season is read against the player's other seasons (minutes-weighted): stars are consistent,
    # a lone outlier season of a squad player is pulled back toward his usual level
    career = defaultdict(list)
    for x in lines:
        career[x["pid"]].append(x)
    for xs in career.values():
        tot = sum(x["src"]["min"] * x["Q0"] for x in xs)
        mins = sum(x["src"]["min"] for x in xs)
        for x in xs:
            n = len(xs) - 1
            if n:
                other = (tot - x["src"]["min"] * x["Q0"]) / (mins - x["src"]["min"])
                w = CAREER_W * n / (n + 1.0)
                x["Q"] = (1 - w) * x["Q0"] + w * other
            else:
                x["Q"] = x["Q0"]
    by_season = defaultdict(list)
    for x in lines:
        by_season[x["season"]].append(x)
    for season, xs in by_season.items():
        rk = Ranker([x["Q"] for x in xs])
        for x in xs:
            x["q"] = rk(x["Q"])
            x["ovr"] = int(round(qmap(x["q"])))
            if "BDOR" in x["honors"]:
                x["ovr"] = max(x["ovr"], BDOR_FLOOR)  # the world's best player that year
    for (season, pos), xs in groups.items():
        rk = Ranker([x["Q"] for x in xs])
        for x in xs:
            x["p"]["q"] = rk(x["Q"])
    for x in lines:
        x["face"] = face_stats(x["pos"][0], x["ovr"], evidence(x), x.get("traits"))


def evidence(x):
    """Face-stat nudges from the season's numbers, in rating points."""
    pos, z = x["pos"][0], x.get("z", {})
    age = x.get("age")
    e = [0.0] * 6
    clip = lambda v, a=2.5: max(-a, min(a, v))  # noqa: E731
    if pos == "GK":
        g = -clip(z.get("ga90", 0))
        e[0] += 3 * g + 1.0 * clip(z.get("ht", 0))  # DIV
        e[1] += 2 * g + 1.0 * clip(z.get("cs_rate", 0))  # HAN
        e[3] += 3 * g  # REF
        e[5] += 2 * g + 2 * clip(z.get("cs_rate", 0))  # POS
        if age is not None:
            e[4] += -0.8 * max(0, age - 28) + 0.5 * max(0, 25 - age)  # SPD
        return e
    e[1] += 6 * clip(z.get("npg90", 0)) if pos in ("ST", "W", "AM") else 4 * clip(z.get("g90", 0))
    e[2] += 5 * clip(z.get("a90", 0)) + (2 * clip(z.get("xa90", 0)) if pos in ("FB", "W") else 0)
    e[4] += -5 * clip(z.get("ga90", 0)) if pos in ("CB", "FB", "DM", "CM") else 0
    e[5] += 2.5 * clip(z.get("ht", 0)) + 1.5 * clip(z.get("yc90", 0)) + 1.5 * clip(z.get("full_share", 0))
    if age is not None:
        e[0] += -0.8 * max(0, age - 28) + 0.6 * max(0, 24 - age)
        e[3] += -0.4 * max(0, age - 31)
    e[0] += -2.0 * clip(z.get("ht", 0))
    e[3] += -1.0 * clip(z.get("ht", 0)) + (2 * clip(z.get("a90", 0) + z.get("g90", 0), 3) / 2 if pos in ("W", "AM", "ST") else 0)
    return e


def face_stats(pos, ovr, ev, tweaks=None):
    keys = GK_FACE if pos == "GK" else OUT_FACE
    tmpl, w = TEMPLATE[pos], WEIGHTS[pos]
    f = []
    for i in range(6):
        beta = 1.0 if w[i] >= 0.10 else 0.6
        v = tmpl[i] + beta * (ovr - 75) + ev[i]
        if tweaks:
            v += tweaks.get(keys[i], 0)
        f.append(v)
    # shift the weighted overall of the six onto the target overall (before clamping, so the profile
    # keeps its shape), then clamp to 25..99 and move any clamped remainder onto the other weighted stats
    d = ovr - sum(wi * v for wi, v in zip(w, f))
    f = [v + d for v in f]
    for _ in range(5):
        f = [max(25.0, min(99.0, v)) for v in f]
        d = ovr - sum(wi * v for wi, v in zip(w, f))
        if abs(d) < 0.2:
            break
        free = [i for i in range(6) if w[i] > 0 and ((d > 0 and f[i] < 99) or (d < 0 and f[i] > 25))]
        ws = sum(w[i] for i in free)
        if not ws:
            break
        for i in free:
            f[i] += d / ws
    return [int(round(max(25.0, min(99.0, v)))) for v in f]


# Curated face-stat traits for well-known players of the Transfermarkt era (our estimates; the data
# has no tracking or dribbling numbers): name | birth year | tweaks, applied to all their seasons
# before the face stats are shifted onto the overall, so they change the shape, not the OVR.
TRAITS_TABLE = """
Lionel Messi|1987|DRI+7 PAC-3 PHY-4
Cristiano Ronaldo|1985|SHO+3 PHY+5 DRI-2
Kylian Mbappé|1998|PAC+13 DRI+2 PAS-3
Erling Haaland|2000|PHY+6 PAC+3 DRI-4 PAS-3
Mohamed Salah|1992|PAC+4 DRI+2
Virgil van Dijk|1991|DEF+3 PHY+3 PAC+3
Manuel Neuer|1986|KIC+6 SPD+10
Neymar|1992|DRI+8 PAC+2 PHY-6
Kevin De Bruyne|1991|PAS+5 SHO+2
Luka Modrić|1985|PAS+3 DRI+3 PHY-4
N'Golo Kanté|1991|DEF+4 PAC+4 PHY+2 SHO-4
Robert Lewandowski|1988|SHO+2 PHY+2
Eden Hazard|1991|DRI+7 PAC+2
Gareth Bale|1989|PAC+7 SHO+2
Vinicius Junior|2000|PAC+7 DRI+5
Adama Traoré|1996|PAC+9 PHY+6
Kyle Walker|1990|PAC+9
Alphonso Davies|2000|PAC+11
Sergio Ramos|1986|PHY+3 DEF+2
Toni Kroos|1990|PAS+7 PAC-5
Sergio Busquets|1988|PAS+4 PAC-6
Andrés Iniesta|1984|DRI+5 PAS+3 PHY-5
Xavi|1980|PAS+6 PAC-6
Andrea Pirlo|1979|PAS+7 PAC-8
Zlatan Ibrahimović|1981|PHY+6 PAC-4
Thibaut Courtois|1992|DIV+2 SPD-4
Jan Oblak|1993|REF+2
Alisson|1992|KIC+4 SPD+3
Ederson|1993|KIC+10 SPD+3
Arjen Robben|1984|PAC+3 DRI+3 SHO+2
Franck Ribéry|1983|DRI+4
Lamine Yamal|2007|DRI+6 PAS+2 PHY-6
Jude Bellingham|2003|PHY+3
Rodri|1996|PAS+2 DEF+2 PAC-5
Harry Kane|1993|SHO+3 PAS+4 PAC-4
Achraf Hakimi|1998|PAC+8
Trent Alexander-Arnold|1998|PAS+6 DEF-3 PAC-2
Luis Suárez|1987|SHO+2 PHY+2 PAC-2
Karim Benzema|1987|PAS+3 PAC-2
Leroy Sané|1996|PAC+7
Ousmane Dembélé|1997|PAC+5 DRI+4
Raheem Sterling|1994|PAC+5 DRI+2
Pierre-Emerick Aubameyang|1989|PAC+9
Jamie Vardy|1987|PAC+7
Thomas Müller|1989|PAS+3 PAC-5 DRI-3
Giorgio Chiellini|1984|DEF+3 PHY+4 PAC-4
Leonardo Bonucci|1987|PAS+4
Thiago Silva|1984|DEF+3
Paul Pogba|1993|PHY+3 PAS+2
Casemiro|1992|PHY+4 DEF+2
Bruno Fernandes|1994|PAS+3 SHO+2
Heung-min Son|1992|PAC+4 SHO+2
Victor Osimhen|1998|PAC+3 PHY+3
Romelu Lukaku|1993|PHY+8 DRI-4
Florian Wirtz|2003|DRI+4 PAS+3
Jamal Musiala|2003|DRI+7 PHY-4
Pedri|2002|PAS+3 DRI+3 PHY-5
Frenkie de Jong|1997|DRI+4 PAS+2
Joshua Kimmich|1995|PAS+4
Rúben Dias|1997|DEF+2 PHY+2
Marquinhos|1994|DEF+2 PAC+2
Riyad Mahrez|1991|DRI+4 PAC-2
Philippe Coutinho|1992|DRI+3 SHO+2
Yaya Touré|1983|PHY+5
James Rodríguez|1991|PAS+3 SHO+2
Mesut Özil|1988|PAS+6 PHY-6
David Silva|1986|PAS+5 PAC-4
Mats Hummels|1988|PAS+3 PAC-4
Philipp Lahm|1983|PAS+3 PHY-5
Dani Alves|1983|PAC+2 PAS+3
Marcelo|1988|DRI+5 DEF-3
Jordi Alba|1989|PAC+6
Kalidou Koulibaly|1991|PHY+5
Sadio Mané|1992|PAC+6
Phil Foden|2000|DRI+4
Martin Ødegaard|1998|PAS+4
Declan Rice|1999|PHY+3 DEF+2
William Saliba|2001|PAC+3 DEF+2
Khvicha Kvaratskhelia|2001|DRI+5
Rafael Leão|1999|PAC+7 DRI+3
Kingsley Coman|1996|PAC+6
Marc-André ter Stegen|1992|KIC+8
Ederson Moraes|1993|KIC+10
David de Gea|1990|REF+5 KIC-4
Gianluigi Donnarumma|1999|DIV+3 KIC-4
"""


def traits(players):
    """{tm pid: {stat: tweak}} for TRAITS_TABLE (matched by name and birth year)."""
    want = {}
    for row in TRAITS_TABLE.strip().splitlines():
        name, born, tw = row.split("|")
        want[(S_norm(name), int(born))] = {m.group(1): int(m.group(2)) for m in re.finditer(r"([A-Z]{3})([+-]\d+)", tw)}
    out, hit = {}, set()
    for pid, p in players.items():
        k = (S_norm(p.get("name") or ""), int((p.get("dob") or "0")[:4] or 0))
        if k in want:
            out[pid] = want[k]
            hit.add(k)
    for k in want:
        if k not in hit:
            print("traits: no Transfermarkt player %s (%d)" % k)
    return out


# ---------------------------------------------------------------- legends


def legend_lines(wd, season_lines):
    by_tm, by_fr = S.clubs()
    meta = {S.qid(r["p"]): r for r in wd["meta"]}
    spells = defaultdict(list)
    for r in wd["spells"]:
        spells[S.qid(r["p"])].append(r)
    by_pid_season = defaultdict(list)
    for x in season_lines:
        by_pid_season[(x["pid"], x["season"])].append(x)
    out = []
    for leg in S.legends():
        q = wd["resolved"].get(leg["name"])
        m = meta.get(q, {})
        tmid = m.get("tmid")
        club = by_fr[leg["fr"]]
        tw = leg["tweaks"]
        if leg["peak"] >= S.FIRST:
            cands = [x for x in by_pid_season.get((tmid, leg["peak"]), []) if x["club"]["fr"] == leg["fr"]]
            if not cands:
                print("legend %s: no %d %s season line" % (leg["name"], leg["peak"], leg["fr"]))
                continue
            x = max(cands, key=lambda c: c["src"]["min"])
            ovr = min(97, max(leg["ovr"], x["ovr"] + 2))  # a legend card always sits above its season card
            face = face_stats(x["pos"][0], ovr, evidence(x), merge(x.get("traits"), tw))
            out.append({"line": x, "ovr": ovr, "face": face, "leg": leg, "qid": q})
            continue
        # a legend-only line from the Wikidata spell at that club that holds the peak season
        best = None
        for r in spells.get(q, []):
            ok = (club["tm"] and r.get("tmclub") == club["tm"]) or (not club["tm"] and re.search(club["pat"], r.get("clubLabel", "")))
            if not ok:
                continue
            y0, y1 = S.year(r.get("start")), S.year(r.get("end"))
            apps, goals = S.numv(r.get("apps")), S.numv(r.get("goals"))
            inside = y0 is not None and y0 < leg["peak"] <= (y1 or 9999)
            score = (inside, apps is not None, -(apps or 0))  # holds the peak, has apps; the league figure is the smaller one
            if best is None or score > best[0]:
                best = (score, y0, y1, apps, goals)
        if best is None:
            y0, y1, apps, goals = LEGEND_SPELL_FALLBACK.get(leg["name"], (leg["peak"] - 3, leg["peak"] + 3, None, None))
        else:
            _, y0, y1, apps, goals = best
            if y0 is None:
                y0, y1, apps, goals = LEGEND_SPELL_FALLBACK.get(leg["name"], (leg["peak"] - 3, leg["peak"] + 3, apps, goals))
        if leg["pos"] == "GK" or (goals is not None and goals < 0):
            goals = 0 if leg["pos"] == "GK" else None
        ht = m.get("ht")
        ht = S.numv(float(ht) * 100) if ht and float(ht) < 3 else S.numv(ht)
        dob = (m.get("dob") or "")[:10]
        seasons = max(1, (y1 or leg["peak"]) - y0) if y0 else None
        pid = tmid or q or re.sub(r"[^A-Za-z0-9]+", "-", leg["name"]).strip("-")
        x = {"pid": pid, "name": leg["name"], "season": leg["peak"], "club": club, "lg": None, "pos": [leg["pos"]], "honors": [],
             "age": age_at(dob, leg["peak"]), "ht": ht, "est": 1, "spell": (y0 + 1 if y0 else None, y1), "apps": apps, "goals": goals,
             "seasons": seasons, "ovr": leg["ovr"] - 4, "q": None}
        x["face"] = face_stats(leg["pos"], x["ovr"], evidence(x), tw)
        face = face_stats(leg["pos"], leg["ovr"], evidence(x), tw)
        out.append({"line": x, "ovr": leg["ovr"], "face": face, "leg": leg, "qid": q})
    return out


def merge(a, b):
    out = dict(a or {})
    for k, v in (b or {}).items():
        out[k] = out.get(k, 0) + v
    return out


# Spells Wikidata lacks dates or numbers for: (first year, last year, league apps, league goals)
LEGEND_SPELL_FALLBACK = {"Lev Yashin": (1949, 1970, 326, 0)}


# ---------------------------------------------------------------- promos


def promos_of(lines):
    out = []
    labels = {"BDOR": (5, "BALLON D'OR"), "UEFA": (4, "PLAYER OF THE YEAR"), "POTY": (4, "PLAYER OF THE SEASON"), "BOOT": (3, "GOLDEN BOOT"), "ASSIST": (3, "ASSISTS TITLE")}
    champs_best = {}
    for x in lines:
        if "CHAMP" in x["honors"]:
            key = (x["club"]["fr"], x["season"])
            if key not in champs_best or x["Q"] > champs_best[key]["Q"]:
                champs_best[key] = x
    best_ids = {id(x) for x in champs_best.values()}
    for x in lines:
        reasons = [labels[h] for h in x["honors"] if h in labels]
        if id(x) in best_ids:
            reasons.append((3, "CHAMPIONS"))
        if not reasons:
            continue
        reasons.sort(key=lambda r: -r[0])
        boost = min(6, reasons[0][0] + (1 if len(reasons) > 1 else 0))
        ovr = min(97, x["ovr"] + boost)
        out.append((x, ovr - x["ovr"], "%s %d" % (reasons[0][1], x["season"]), ovr, face_stats(x["pos"][0], ovr, evidence(x), x.get("traits"))))
    return out


# ---------------------------------------------------------------- write

OUT_STATS = ["apps", "starts", "min", "g", "a", "pen", "yc", "rc", "cl", "clg", "yrs"]
GK_STATS = ["apps", "starts", "min", "cs", "ga", "yc", "rc", "cl", "yrs"]
OUT_RK = ["g90", "a90", "usage", "onoff", "def", "q"]
GK_RK = ["ga90", "cs", "usage", "q"]


def line_stats(x):
    if x["est"]:
        st = {"apps": x["apps"], "g": x["goals"], "yrs": x["seasons"]}
        return st
    s = x["src"]
    st = {"apps": s["apps"], "starts": s["starts"], "min": s["min"], "g": s["g"], "a": s["a"], "pen": s["pen"], "yc": s["yc"], "rc": s["rc"],
          "cl": s["cl_apps"], "clg": s["cl_g"], "cs": s["cs"], "ga": int(round(s["on_ga"])), "yrs": 1}
    return st


def write(lines, legends, promos):
    leagues = list(S.LEAGUES)
    groups = [["OUT", OUT_STATS, OUT_RK], ["GK", GK_STATS, GK_RK]]
    # percentile ranks (permille) within season and position for shown per-90 measures
    grp_rank = defaultdict(list)
    for x in lines:
        if not x["est"]:
            grp_rank[(x["season"], x["pos"][0])].append(x)
    for xs in grp_rank.values():
        for key, sign in (("g90", 1), ("a90", 1), ("ga90", -1), ("cs_rate", 1)):
            rk = Ranker([sign * x[key] for x in xs])
            for x in xs:
                x.setdefault("pr", {})[key] = rk(sign * x[key])
    players, pidx, teams, tidx = [], {}, [], {}
    codes = sorted({h for x in lines for h in x["honors"]})
    hidx = {h: i for i, h in enumerate(codes)}
    cols = {k: [] for k in ["player", "season", "team", "pos", "num", "games", "starts", "group", "honors", "sparse", "lg", "ovr", "face", "est"]}
    stats = {g: {k: [] for k in st} for g, st, _ in groups}
    ranks = {g: {k: [] for k in rk} for g, _, rk in groups}
    index = {}
    for i, x in enumerate(lines):
        index[id(x)] = i
        if x["pid"] not in pidx:
            pidx[x["pid"]] = len(players)
            players.append([x["pid"], x["name"], x["ht"], None])
        c = x["club"]
        tk = (c["fr"], c["abbr"], c["name"], c["c1"], c["c2"])
        if tk not in tidx:
            tidx[tk] = len(teams)
            teams.append(list(tk))
        grp = "GK" if x["pos"][0] == "GK" else "OUT"
        st = line_stats(x)
        src = x.get("src") or {}
        cols["player"].append(pidx[x["pid"]])
        cols["season"].append(x["season"])
        cols["team"].append(tidx[tk])
        cols["pos"].append("/".join(x["pos"]))
        cols["num"].append(src.get("num"))
        cols["games"].append(src.get("apps", x.get("apps")))
        cols["starts"].append(src.get("starts"))
        cols["group"].append(0 if grp == "OUT" else 1)
        cols["honors"].append(sorted(hidx[h] for h in x["honors"]))
        cols["sparse"].append(1 if x["est"] else 0)
        cols["lg"].append(leagues.index(x["lg"]) if x["lg"] else None)
        cols["ovr"].append(x["ovr"])
        cols["face"].append(x["face"])
        cols["est"].append(x["est"])
        for k in stats[grp]:
            stats[grp][k].append(sig3(st.get(k)))
        pr = x.get("pr", {})
        p = x.get("p", {})
        rkv = {"g90": pr.get("g90"), "a90": pr.get("a90"), "ga90": pr.get("ga90"), "cs": pr.get("cs_rate"), "usage": p.get("usage"),
               "onoff": p.get("onoff"), "q": p.get("q"), "def": pr.get("ga90")}
        for k in ranks[grp]:
            v = rkv.get(k)
            ranks[grp][k].append(None if v is None else int(round(v * 1000)))
    out = {
        "sport": "soccer",
        "n": len(lines),
        "source": "Transfermarkt via transfermarkt-datasets (CC0), Wikidata (CC0), openfootball; ratings are our own model (docs/SOCCER-DATA.md)",
        "leagues": [[c, S.LEAGUES[c]] for c in leagues],
        "faceKeys": {"OUT": OUT_FACE, "GK": GK_FACE},
        "groups": groups,
        "players": players,
        "teams": teams,
        "honors": codes,
        "cols": cols,
        "stats": stats,
        "rk": ranks,
        "promos": [[index[id(x)], b, lab, ovr, face] for x, b, lab, ovr, face in promos],
        "legends": [[index[id(L["line"])], L["ovr"] - L["line"]["ovr"], "LEGEND", L["ovr"], L["face"]] for L in legends],
    }
    path = os.path.join(DATA, "cards-soccer.json")
    raw = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(raw)
    gz = len(gzip.compress(raw.encode("utf-8"), 9))
    print("cards-soccer.json: %d lines, %d promos, %d legends; %d bytes, %d gzipped" % (len(lines), len(promos), len(legends), len(raw.encode()), gz))


# ---------------------------------------------------------------- report

SANITY = [("Lionel Messi", 2015, "BAR"), ("Cristiano Ronaldo", 2014, "RMA"), ("Cristiano Ronaldo", 2015, "RMA"),
          ("Robert Lewandowski", 2020, "FCB"), ("Robert Lewandowski", 2021, "FCB"), ("Erling Haaland", 2023, "MCI"),
          ("Mohamed Salah", 2018, "LIV"), ("Virgil van Dijk", 2019, "LIV"), ("Kevin De Bruyne", 2020, "MCI"),
          ("Luka Modrić", 2018, "RMA"), ("Manuel Neuer", 2014, "FCB"), ("N'Golo Kanté", 2017, "CHE"), ("Kylian Mbappé", 2024, "PSG"),
          ("Kylian Mbappé", 2025, "RMA"), ("Harry Kane", 2026, "FCB"), ("Rodri", 2024, "MCI"), ("Ousmane Dembélé", 2025, "PSG"),
          ("Lamine Yamal", 2025, "BAR"), ("Jude Bellingham", 2024, "RMA"), ("Thiago Silva", 2016, "PSG"), ("Sergio Busquets", 2016, "BAR"),
          ("Toni Kroos", 2017, "RMA"), ("Jan Oblak", 2016, "ATM"), ("Alisson", 2019, "LIV"), ("Marc-André ter Stegen", 2018, "BAR"),
          ("Neymar", 2015, "BAR"), ("Luis Suárez", 2016, "BAR"), ("Zlatan Ibrahimović", 2016, "PSG"), ("Franck Ribéry", 2013, "FCB"),
          ("Gareth Bale", 2013, "TOT"), ("Eden Hazard", 2015, "CHE"), ("Antoine Griezmann", 2016, "ATM"), ("Andrew Robertson", 2020, "LIV"),
          ("Trent Alexander-Arnold", 2020, "LIV"), ("Joshua Kimmich", 2020, "FCB"), ("Jamie Vardy", 2016, "LEI")]


def report(lines, legends, promos):
    by = defaultdict(list)
    for x in lines:
        by[(x["name"], x["season"])].append(x)
    print("\n%-26s %4s %-4s %-6s %3s %-6s %-26s %s" % ("player", "seas", "club", "pos", "OVR", "tier", "face", "line"))
    for name, season, fr in SANITY:
        xs = [x for x in by.get((name, season), []) if x["club"]["fr"] == fr]
        if not xs:
            print("%-26s %4d %-4s  (no line)" % (name, season, fr))
            continue
        x = xs[0]
        s = x["src"]
        keys = GK_FACE if x["pos"][0] == "GK" else OUT_FACE
        face = " ".join("%s%d" % (k[:1], v) for k, v in zip(keys, x["face"]))
        print("%-26s %4d %-4s %-6s %3d %-6s %-26s %dap %dmin %dg %da cs%d Q%.3f u%.2f r%.2f o%.2f h%.2f" % (
            name, season, fr, "/".join(x["pos"]), x["ovr"], tier(x["ovr"]), face, s["apps"], s["min"], s["g"], s["a"], s["cs"], x["Q"],
            x["p"]["usage"], x["p"]["role"], x["p"]["onoff"], x["p"]["hon"]))
    tm = [x for x in lines if not x["est"]]
    print("\ntiers:", dict(Counter(tier(x["ovr"]) for x in tm)))
    print("tier x position:")
    for pos in POSITIONS:
        c = Counter(tier(x["ovr"]) for x in tm if x["pos"][0] == pos)
        n = sum(c.values())
        print("  %-3s %5d  bronze %4.1f%%  silver %4.1f%%  gold %4.1f%%  85+ %d" % (pos, n, 100.0 * c["bronze"] / n, 100.0 * c["silver"] / n,
                                                                                 100.0 * c["gold"] / n, sum(1 for x in tm if x["pos"][0] == pos and x["ovr"] >= 85)))
    print("ovr histogram:", sorted(Counter(x["ovr"] for x in tm).items()))
    print("\ntop 3 per season:")
    for season in range(S.FIRST, S.LAST + 1):
        xs = sorted((x for x in tm if x["season"] == season), key=lambda x: -x["Q"])[:3]
        print("  %d: %s" % (season, "; ".join("%s %s %s %d" % (x["name"], x["club"]["fr"], x["pos"][0], x["ovr"]) for x in xs)))
    print("\nby league share of gold:", {lg: "%.1f%%" % (100.0 * sum(1 for x in tm if x["lg"] == lg and x["ovr"] >= 75) / max(1, sum(1 for x in tm if x["lg"] == lg))) for lg in S.LEAGUES})
    print("\nlegends (%d):" % len(legends))
    print("; ".join("%s %d %s %s %d %s" % (L["leg"]["name"], L["line"]["season"], L["line"]["club"]["fr"], L["line"]["pos"][0], L["ovr"], L["face"]) for L in legends[:40]))
    print("promos: %d (%.1f%%)" % (len(promos), 100.0 * len(promos) / len(tm)), Counter(lab.rsplit(" ", 1)[0] for _, _, lab, _, _ in promos))


def build(dl):
    agg = S.load_agg(dl)
    wd = S.load_json(dl, "wikidata.json")
    of = S.load_json(dl, "openfootball.json")
    L, k, h, n = league_strength(agg)
    print("league strength from %d European games (home edge %.2f, club GD/game x %.2f):" % (n, h, k))
    print("  " + ", ".join("%s %+.2f" % (lg, L[lg]) for lg in sorted(L, key=lambda l: -L[l])[:20]))
    lines = build_lines(agg, wd, of, L, k)
    tr = traits(agg["players"])
    for x in lines:
        x["T_league"] = L.get(x["lg"], 0.0)
        x["traits"] = tr.get(x["pid"])
    rate_lines(lines)
    legends = legend_lines(wd, lines)
    lines_all = lines + [L_["line"] for L_ in legends if L_["line"]["est"]]
    promos = promos_of(lines)
    return lines, lines_all, legends, promos, L, k


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dl", default=S.DEFAULT_DL)
    args = ap.parse_args()
    lines, lines_all, legends, promos, L, k = build(os.path.abspath(args.dl))
    report(lines, legends, promos)
    write(lines_all, legends, promos)


if __name__ == "__main__":
    main()
