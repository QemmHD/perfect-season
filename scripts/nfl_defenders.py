"""Defenders for the NFL draft: each franchise-decade's defensive linemen (DL), linebackers (LB) and
defensive backs (DB: corners and safeties), with a value on the same scale as the offense.

Input: .cache/nfl_players_more.json from scripts/nfl_more_sources.py (one record per player, season
and franchise, 1970-2025: games, starts, defensive stats from 1999 and from Wikipedia career tables
before, All-Pro and Pro Bowl honors every season, draft slot, size). build_nfl_data.py calls
build() and writes the lines into the cells next to the offense.

The value, era-fair:
  1. Every season gets a quality score.
     - Production (1999 on, everyone): a stat score per position (sacks, tackles, interceptions,
       passes defended, forced fumbles, defensive touchdowns...), ranked within that season and
       group, the rank counted per team in the league, as a grade 0-100.
     - Honors: AP first-team All-Pro 98, another first team 94, second team 91, Pro Bowl 87, nudged
       by a quarter of how much more (or less) he produced than a typical honoree.
     - A season without honors starts from what a modern season (1999-2021, no honors) of the same
       profile produced on average: how many honors he had in his other seasons, career length,
       year in the league, draft slot and, where known, share of starts (an additive model fitted
       on the modern seasons). So a ten-year starter rates like one, a backup cut after a year like
       one, and a perennial Pro Bowler's off year like a good season. Its own stats move it toward
       them: 1999 on, LAMBDA_MODERN of the way; before, where a Wikipedia career table has his
       sacks and interceptions (per 16 games, interceptions on the 1970-2025 league rate, ranked
       against the modern seasons), LAMBDA_CORE.
  2. The season's grade is the score's rank within its season and position (DL, LB, DB), per team
     in the league, on one curve: so every season, with stats or not, 26 teams or 32, hands out the
     same spread of grades, and the honorees are on top.
  3. A line (one player, one franchise, one decade) is the games-weighted average of its season
     grades, blended with the player's whole career as if he had played SHRINK more seasons at it
     (a short stint is valued near his usual level, like the offense).
  4. Lines are mapped onto the shared value scale by quantile, per position, on the best POOL of
     each cell: a 95th percentile linebacker is worth what a 95th percentile quarterback is.

Each cell lists its best CAP lines per position. Shown stats are per season, over the seasons
that have them (-1: not known), plus Pro Bowls and first-team All-Pro seasons in the line.
"""

import json
import math
import os
from bisect import bisect_left
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
MORE = os.path.join(HERE, "..", ".cache", "nfl_players_more.json")

SPLIT = 1999
FIT_LAST = 2021  # modern seasons used to learn what a profile produces: careers mostly over by 2025
GROUP_SLOT = {"DL": "DL", "LB": "LB", "CB": "DB", "S": "DB"}
# starters a team plays at each group: the production rank's scale
STARTERS = {"DL": 4, "LB": 3, "CB": 2, "S": 2, "DB": 4}
TAU = 0.82  # grade = 100 * exp(-rank per team / (TAU * starters))
CAP = {"DL": 7, "LB": 6, "DB": 7}
POOL = {"DL": 4, "LB": 3, "DB": 4}
SHRINK = 0.35  # seasons of career average a line is blended with
HONOR_GRADE = {4: 98.0, 3: 94.0, 2: 91.0, 1: 87.0}
HONOR_NUDGE = 0.25
# a season without honors: what its profile produces on average, moved this far toward its own stats
LAMBDA_MODERN = 0.65
LAMBDA_CORE = {"DL": 0.5, "LB": 0.5, "CB": 0.35, "S": 0.35}
STAT_KEYS = ("sacks", "tkl", "int", "pd", "ff")
ROLE = {"DE": "DE", "DT": "DT", "NT": "NT", "DL": "DL", "OLB": "OLB", "ILB": "ILB", "MLB": "ILB", "LB": "LB",
        "CB": "CB", "S": "S", "FS": "FS", "SS": "SS", "DB": "DB"}


def full_metric(group, d):
    """The production score from every stat a 1999+ season has (missing ones are 0)."""
    g = lambda k: d.get(k, 0) or 0  # noqa: E731
    td = 1.5 * g("def_td") + g("safety")
    if group == "DL":
        return g("sacks") + 0.25 * g("tfl") + 0.15 * g("qb_hits") + 0.04 * g("tkl") + 0.6 * g("ff") + 0.3 * g("fr") + 0.8 * g("int") + 0.2 * g("pd") + td
    if group == "LB":
        return 0.07 * g("tkl") + 0.9 * g("sacks") + 0.2 * g("tfl") + 0.1 * g("qb_hits") + 1.6 * g("int") + 0.35 * g("pd") + 0.6 * g("ff") + 0.3 * g("fr") + td
    if group == "CB":
        return 1.6 * g("int") + 0.55 * g("pd") + 0.025 * g("tkl") + 0.6 * g("ff") + 0.3 * g("fr") + 0.003 * g("int_yds") + td
    return 1.6 * g("int") + 0.45 * g("pd") + 0.045 * g("tkl") + 0.6 * g("ff") + 0.3 * g("fr") + 0.6 * g("sacks") + 0.003 * g("int_yds") + td


def core_metric(group, d, per16, int_adj):
    """Sacks, interceptions and touchdowns only: what the old Wikipedia tables and the modern stats
    both have. Per 16 games, interceptions on the 1970-2025 average rate."""
    g = lambda k: d.get(k, 0) or 0  # noqa: E731
    i = g("int") * int_adj
    if group == "DL":
        v = g("sacks") + 0.8 * i + 1.5 * g("def_td")
    elif group == "LB":
        v = 0.9 * g("sacks") + 1.6 * i + 1.5 * g("def_td")
    else:
        v = 1.6 * i + 1.5 * g("def_td") + 0.003 * g("int_yds")
    return v * per16


def grade_of(u, group):
    """A rank per team in the league (0 = the best) as a grade, 100 down toward 0."""
    return 100.0 * math.exp(-u / (TAU * STARTERS[group]))


def rank_grades(rs, field, teams, group, out):
    """Grade records by the rank of their `field` among them, best first, per team in the league;
    ties share their middle rank."""
    rs = sorted(rs, key=lambda r: -r[field])
    i = 0
    while i < len(rs):
        j = i
        while j < len(rs) and abs(rs[j][field] - rs[i][field]) < 1e-9:
            j += 1
        g = grade_of((i + j) / 2 / teams, group)
        for r in rs[i:j]:
            r[out] = g
        i = j


def honor_tier(h):
    if not h:
        return 0
    if h.get("ap1"):
        return 4
    if h.get("all_pro"):
        return 3
    if h.get("ap2") or h.get("all_pro_2"):
        return 2
    if h.get("pro_bowl"):
        return 1
    return 0


def bucket(x, edges):
    for i, e in enumerate(edges):
        if x <= e:
            return i
    return len(edges)


class Additive:
    """y ~ mean + one effect per feature level, fitted by backfitting. Each feature's effects
    average zero over the data, so a feature that's unknown (None) adds nothing: the average."""

    def __init__(self, rows, feats, iters=25, k=20.0):
        self.feats = feats
        ys = [y for _, y in rows]
        self.mu = sum(ys) / len(ys)
        self.eff = {f: {} for f in feats}
        pred = [self.mu] * len(rows)
        for _ in range(iters):
            for f in feats:
                sums, ns = defaultdict(float), Counter()
                for i, (x, y) in enumerate(rows):
                    lv = x[f]
                    if lv is not None:
                        sums[lv] += y - (pred[i] - self.eff[f].get(lv, 0.0))
                        ns[lv] += 1
                new = {lv: sums[lv] / (ns[lv] + k) for lv in sums}  # thin levels shrink toward 0
                tot = sum(ns.values())
                m = sum(new[lv] * ns[lv] for lv in ns) / tot if tot else 0.0
                new = {lv: v - m for lv, v in new.items()}
                for i, (x, _) in enumerate(rows):
                    lv = x[f]
                    if lv is not None:
                        pred[i] += new[lv] - self.eff[f].get(lv, 0.0)
                self.eff[f] = new
            self.mu += sum(y - p for (_, y), p in zip(rows, pred)) / len(rows)
            pred = [self(x) for x, _ in rows]

    def __call__(self, x):
        return self.mu + sum(self.eff[f].get(x[f], 0.0) for f in self.feats if x[f] is not None)


def build(team_games, int_rate, int_scale, qmap_cls, cells, more_path=MORE):
    """team_games: (season, fr) -> regular-season games; int_rate: season -> league interceptions per
    team-game; int_scale: the 1970-2025 average; qmap_cls: build_nfl_data.QuantileMap; cells: the
    (fr, decade) keys that exist. Returns (lines by cell, playoff defenders by (season, fr))."""
    recs = [r for r in json.load(open(more_path, encoding="utf-8"))["players"] if r["group"] in GROUP_SLOT]
    teams_in = Counter()
    for (s, fr) in team_games:
        teams_in[s] += 1

    # ---- who played: a season's weight, and games shown
    for r in recs:
        s, fr = r["season"], r["team"]
        tg = team_games.get((s, fr)) or (14 if s < 1978 else 16)
        r["tg"] = tg
        g = r.get("g")
        if g:
            r["w"] = min(1.0, g / tg)
        elif s < SPLIT:
            st = r.get("roster_status")
            r["w"] = 1.0 if st == "ACT" or r.get("honors") else 0.25 if st == "RES" else 0.5
        else:
            r["w"] = 0.3 if r.get("honors") else 0.05
        r["games"] = g if g else round(r["w"] * tg)
        r["games_est"] = not g

    # ---- careers: length, honors, start
    by_pid = defaultdict(list)
    for r in recs:
        by_pid[r["id"]].append(r)
    for pid, rs in by_pid.items():
        seasons = sorted({r["season"] for r in rs})
        first = seasons[0]
        if first <= 1970:
            # began before the data: from his draft year, else at 22
            d = next((r["draft"][0] for r in rs if r.get("draft") and r["draft"][0]), None)
            born = next((int(r["birth_date"][:4]) for r in rs if r.get("birth_date")), None)
            first = min(first, d or (born + 22 if born else first))
        hon_seasons = {r["season"] for r in rs if honor_tier(r.get("honors"))}
        draft = next((r["draft"] for r in rs if r.get("draft")), None)
        for r in rs:
            r["car_len"] = seasons[-1] - first + 1
            r["exp"] = r["season"] - first + 1
            r["hon_other"] = len(hon_seasons - {r["season"]})
            if draft and draft[1]:
                rd, pk = draft[1], draft[2] or 999
                r["draft_b"] = "1a" if rd == 1 and pk <= 10 else "1" if rd == 1 else str(min(rd, 6))
            else:
                # no draft listed: undrafted from 1980 (the register has every pick since), unknown before
                r["draft_b"] = "u" if first >= 1980 else "na"
            gs = r.get("gs")
            r["start_b"] = None if gs is None else bucket(gs / r["tg"], (0.05, 0.4, 0.75))
        # a wiki season's missing stat is 0 only when his table has that column
        cols = set()
        for r in rs:
            if r.get("stats_src") == "wikipedia":
                cols |= set(r.get("defense", {}))
        for r in rs:
            if r.get("stats_src") == "nflverse":
                r["known"] = set(STAT_KEYS)
            elif r.get("stats_src") == "wikipedia":
                # sacks and interceptions: his table's columns (a blank is a 0). Tackles, passes
                # defended and forced fumbles came into the tables over the years: a season
                # without them doesn't know them
                d = r.get("defense", {})
                r["known"] = {k for k in STAT_KEYS if k in cols and (k in ("sacks", "int") or k in d)}
            else:
                r["known"] = set()

    # ---- production grades, 1999 on: rank within season and group, per team
    modern = defaultdict(list)
    for r in recs:
        if r["season"] >= SPLIT:
            r["metric"] = full_metric(r["group"], r.get("defense", {}))
            modern[(r["season"], r["group"])].append(r)
    for (s, grp), rs in modern.items():
        rank_grades(rs, "metric", teams_in[s] or 32, grp, "prod")

    # the core stats against every modern season: where an old line would have ranked
    def per16(r):
        return 16.0 / r["tg"]

    def int_adj(s):
        return int_scale / int_rate[s] if int_rate.get(s) else 1.0

    core_by = defaultdict(list)  # (season, group) -> sorted core values, modern
    for (s, grp), rs in modern.items():
        core_by[(s, grp)] = sorted(core_metric(grp, r.get("defense", {}), per16(r), int_adj(s)) for r in rs)

    def core_grade(grp, x):
        us = []
        for (s, g), xs in core_by.items():
            if g == grp:
                us.append((len(xs) - bisect_left(xs, x - 1e-9)) / (teams_in[s] or 32))
        u = max(0.0, sum(us) / len(us) - 0.5 / 32)
        return grade_of(u, grp)

    # old seasons from a career table; modern honorees, for what a typical one produced
    for r in recs:
        if (r["season"] < SPLIT and {"sacks", "int"} & r["known"]) or (r["season"] >= SPLIT and honor_tier(r.get("honors"))):
            r["core"] = core_grade(r["group"], core_metric(r["group"], r.get("defense", {}), per16(r), int_adj(r["season"])))

    # ---- what a profile produces, learned from modern seasons without honors: an additive model
    # per group of honors in his other seasons, career length, year in the league, draft slot and
    # share of starts (one model with each feature that can be missing, one without)
    def feats(r):
        return {"hon": bucket(r["hon_other"], (0, 1, 3, 6)), "car": bucket(r["car_len"], (2, 4, 7, 10, 13)), "exp": bucket(r["exp"], (1, 2, 4, 8, 11)),
                "draft": r["draft_b"], "start": r["start_b"]}

    train = defaultdict(list)
    tier_prod = defaultdict(list)
    tier_core = defaultdict(list)
    for r in recs:
        s = r["season"]
        if s < SPLIT:
            continue
        t = honor_tier(r.get("honors"))
        if t:
            tier_prod[(r["group"], t)].append(r["prod"])
            tier_core[(r["group"], t)].append(r["core"])
        elif s <= FIT_LAST:
            train[r["group"]].append((feats(r), r["prod"]))
    tier_prod = {k: sum(v) / len(v) for k, v in tier_prod.items()}
    tier_core = {k: sum(v) / len(v) for k, v in tier_core.items()}
    base_f = ["hon", "car", "exp"]
    models = {}
    for grp, rows in train.items():
        models[(grp, "full")] = Additive([(x, y) for x, y in rows if x["start"] is not None], base_f + ["draft", "start"])
        models[(grp, "draft")] = Additive(rows, base_f + ["draft"])
        models[(grp, "none")] = Additive(rows, base_f)

    def imputed(r):
        x = feats(r)
        kind = "none" if r["draft_b"] == "na" else "full" if r["start_b"] is not None else "draft"
        return models[(r["group"], kind)](x)

    # ---- season grades: a quality score, then its rank within the season and position
    for r in recs:
        t = honor_tier(r.get("honors"))
        modern_season = r["season"] >= SPLIT
        if t:
            q = HONOR_GRADE[t]
            if modern_season:
                q += HONOR_NUDGE * (r["prod"] - tier_prod[(r["group"], t)])
            elif "core" in r:
                q += HONOR_NUDGE * (r["core"] - tier_core[(r["group"], t)])
        else:
            q = imputed(r)
            if modern_season:
                q += LAMBDA_MODERN * (r["prod"] - q)
            elif "core" in r:
                q += LAMBDA_CORE[r["group"]] * (r["core"] - q)
        r["q"] = q
    by_season = defaultdict(list)
    for r in recs:
        by_season[(r["season"], GROUP_SLOT[r["group"]])].append(r)
    for (s, slot), rs in by_season.items():
        rank_grades(rs, "q", teams_in[s] or 28, slot, "sg")

    # ---- lines: (player, franchise, decade)
    career = {}
    for pid, rs in by_pid.items():
        w = sum(r["w"] for r in rs)
        career[pid] = sum(r["w"] * r["sg"] for r in rs) / w if w else 0.0
    agg = defaultdict(list)
    for r in recs:
        dec = r["season"] // 10 * 10
        if (r["team"], dec) in cells:
            agg[(r["id"], r["team"], dec)].append(r)

    lines = defaultdict(list)
    for (pid, fr, dec), rs in agg.items():
        rs.sort(key=lambda r: r["season"])
        w = sum(r["w"] for r in rs)
        games = sum(r["games"] for r in rs)
        honors = [honor_tier(r.get("honors")) for r in rs]
        if games < 4 and not any(honors):
            continue
        raw = (sum(r["w"] * r["sg"] for r in rs) + SHRINK * career[pid]) / (w + SHRINK)
        slot_w = Counter()
        role_w = Counter()
        for r in rs:
            slot_w[GROUP_SLOT[r["group"]]] += r["w"] + 1e-6
            role_w[ROLE.get(r["pos"], r["pos"])] += r["w"] + 1e-6
        slot = slot_w.most_common(1)[0][0]
        role = next((p for p, _ in role_w.most_common() if p not in ("DL", "LB", "DB")), role_w.most_common(1)[0][0])
        shown = {}
        for k in STAT_KEYS:
            known = [r for r in rs if k in r["known"]]
            shown[k] = round(sum((r.get("defense") or {}).get(k, 0) for r in known) / len(known), 1) if known else -1
        seasons = sorted({r["season"] for r in rs})
        lines[(fr, dec)].append({
            "pid": pid, "name": rs[-1]["name"], "slot": slot, "role": role, "g": int(round(games)), "est": any(r["games_est"] for r in rs),
            "seasons": seasons, "raw": raw, "pb": sum(1 for r in rs if (r.get("honors") or {}).get("pro_bowl")),
            "ap": sum(1 for t in honors if t >= 3), "shown": shown,
        })

    # ---- value: quantile map per position, fitted on the best of each cell
    pools = defaultdict(list)
    for lst in lines.values():
        for slot, n in POOL.items():
            pools[slot] += sorted((a["raw"] for a in lst if a["slot"] == slot), reverse=True)[:n]
    qmap = {slot: qmap_cls(pool) for slot, pool in pools.items()}
    kept = {}
    for cell, lst in lines.items():
        for a in lst:
            a["val"] = qmap[a["slot"]](a["raw"])
        keep = []
        for slot, cap in CAP.items():
            keep += sorted((a for a in lst if a["slot"] == slot), key=lambda a: -a["val"])[:cap]
        kept[cell] = keep

    # ---- playoff teams' defenders: that season's best at each position
    by_team = defaultdict(list)
    for r in recs:
        by_team[(r["season"], r["team"])].append(r)
    playoff = {}
    for st, rs in by_team.items():
        best = {}
        for r in rs:
            if r["w"] < 0.5:
                continue
            slot = GROUP_SLOT[r["group"]]
            if slot not in best or r["sg"] > best[slot]["sg"]:
                best[slot] = r
        out = []
        for slot in ("DL", "LB", "DB"):
            r = best.get(slot)
            if not r:
                continue
            d = r.get("defense") or {}
            stat = [round(d.get(k, 0), 1) if k in r["known"] else -1 for k in ("sacks", "tkl", "int")]
            t = honor_tier(r.get("honors"))
            out.append([r["name"], slot, int(r["games"]), *stat, 2 if t >= 3 else 1 if t else 0])
        playoff[st] = out

    return kept, playoff
