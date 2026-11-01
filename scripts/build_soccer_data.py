"""Build the soccer draft database src/data/soccer.json (Python 3 standard library only).

Same shape as nba.json / nfl.json (see src/engine/data.ts): club x decade cells, each with its
players' lines, plus great teams as opponents. Read docs/SOCCER-DATA.md for sources and the model.

Clubs: the ~40 big clubs in soccer_sources.BIG (Premier League, LaLiga, Serie A, Bundesliga,
Ligue 1, Eredivisie, Primeira Liga). A season belongs to the decade it ENDS in (2014-15 -> 2010s).
Cells 1950s-2020s (a cell needs MIN_CELL players):
  - 2012-13 .. 2025-26: every player with a 900+ league-minute season for the club in that
    decade, from Transfermarkt (real league stats; rating = minutes-weighted mean of his season
    overalls from build_soccer_cards.py)
  - before 2012-13 (and 2010-12 inside the 2010s): the curated legends' club spells (their
    curated overall in the spell holding the peak season, 3 lower in other spells) and notable
    players from Wikidata club spells (8+ sitelinks, 30+ apps or 3+ seasons), whose overall is an
    estimate from notability, games per season and length of stay (66-86). These lines have est = 1
    and per-season averages of the spell's Wikidata totals (-1 where Wikidata has no number).
Row fields (fields in the file): name, pos (GK CB FB DM CM AM W ST, main first, '/'-joined),
  apps (league games in the cell), seasons, from, to (season years, ending year), est, prime (the
  player's best cell id if not this one, else null), pid (Transfermarkt id, else Wikidata Q-id),
  g a cs min (per season: goals, assists, clean sheets (GK), minutes; -1 = not known), ovr,
  att mid def (0-99 sub-ratings: attack 0.6 SHO + 0.4 DRI, creation 0.6 PAS + 0.4 DRI,
  defence 0.7 DEF + 0.3 PHY; a keeper: 0, KIC, his four shot-stopping stats).
playoff: every top-five-league champion 2012-13 .. 2025-26 (and the Champions League winners):
  year "2014-15", team, abbr, gp w d l pts, wFull (wins over 38 games), c1 c2, star, gf ga (per
  game), champ, ucl, xi: [name, pos, apps, g, a, ovr] (4-3-3 by overall).

Usage: python3 -I scripts/build_soccer_data.py [--dl DIR]
"""

import argparse
import gzip
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_soccer_cards as C  # noqa: E402
import soccer_sources as S  # noqa: E402

OUT = os.path.join(HERE, "..", "src", "data", "soccer.json")
FIELDS = ["name", "pos", "apps", "seasons", "from", "to", "est", "prime", "pid", "g", "a", "cs", "min", "ovr", "att", "mid", "def"]
FIRST_DECADE = 1950
NON_PEAK = 3
MIN_CELL = 11  # a cell must be able to field a team  # a legend's other spells sit this much below his curated peak

WD_POS = [("goalkeeper", "GK"), ("goaltender", "GK"), ("full-back", "FB"), ("fullback", "FB"), ("left back", "FB"), ("right-back", "FB"),
          ("wing-back", "FB"), ("defensive midfielder", "DM"), ("attacking midfielder", "AM"), ("playmaker", "AM"), ("inside forward", "AM"),
          ("winger", "W"), ("wide midfielder", "W"), ("left midfielder", "W"), ("right midfielder", "W"), ("centre-back", "CB"),
          ("sweeper", "CB"), ("libero", "CB"), ("stopper", "CB"), ("centre-forward", "ST"), ("second striker", "ST"), ("striker", "ST"),
          ("central midfielder", "CM"), ("wing half", "CM"), ("midfielder", "CM"), ("defender", "CB"), ("forward", "ST"), ("attacker", "ST")]


def wd_positions(label):
    out = []
    labels = [l.strip().lower() for l in (label or "").split("|")]
    for key, pos in WD_POS:
        if key in labels and pos not in out:
            out.append(pos)
    return out[:2] or ["CM"]


def decade(y):
    return y // 10 * 10


def subratings(pos, face):
    if pos == "GK":
        div, han, kic, ref, spd, ps = face
        return 0, kic, int(round((div + han + ref + ps) / 4.0))
    pac, sho, pas, dri, de, phy = face
    return int(round(0.6 * sho + 0.4 * dri)), int(round(0.6 * pas + 0.4 * dri)), int(round(0.7 * de + 0.3 * phy))


def spell_seasons(y0, y1):
    """Wikidata start/end years -> the seasons (ending years) of the spell."""
    if y0 is None:
        return []
    y1 = y1 if y1 is not None else y0 + 1
    return list(range(y0 + 1, max(y0 + 1, y1) + 1))


def build(dl):
    by_tm, by_fr = S.clubs()
    lines, lines_all, legends, promos, L, k = C.build(dl)
    wd = S.load_json(dl, "wikidata.json")
    agg = S.load_agg(dl)
    big = set(S.BIG)

    cells = defaultdict(dict)  # (fr, decade) -> pid -> entry
    # 1. Transfermarkt seasons
    for x in lines:
        fr = x["club"]["fr"]
        if fr not in big:
            continue
        d = decade(x["season"])
        e = cells[(fr, d)].setdefault(x["pid"], {"name": x["name"], "pid": x["pid"], "pos": Counter(), "seasons": [], "est": 0})
        e["seasons"].append(x)
        for p in x["pos"]:
            e["pos"][p] += x["src"]["min"] if p == x["pos"][0] else x["src"]["min"] * 0.4
    rows = {}
    for key, ps in cells.items():
        for pid, e in ps.items():
            ss = e["seasons"]
            mins = sum(s["src"]["min"] for s in ss)
            n = len(ss)
            ovr = sum(s["ovr"] * s["src"]["min"] for s in ss) / mins
            face = [sum(s["face"][i] * s["src"]["min"] for s in ss) / mins for i in range(6)]
            main = e["pos"].most_common(1)[0][0]
            pos = [p for p, m in e["pos"].most_common() if p == main or m >= 0.3 * e["pos"][main]][:3]
            att, mid, de = subratings(main, face)
            rows[(key, pid)] = {"name": e["name"], "pos": pos, "apps": sum(s["src"]["apps"] for s in ss), "seasons": n,
                                "from": min(s["season"] for s in ss), "to": max(s["season"] for s in ss), "est": 0, "pid": pid,
                                "g": round(sum(s["src"]["g"] for s in ss) / n, 1), "a": round(sum(s["src"]["a"] for s in ss) / n, 1),
                                "cs": round(sum(s["src"]["cs"] for s in ss) / n, 1) if main == "GK" else 0,
                                "min": int(round(mins / n)), "ovr": round(ovr, 1), "att": att, "mid": mid, "def": de}

    # 2. curated legends: every spell at a draft club (peak spell at the curated overall)
    meta = {S.qid(r["p"]): r for r in wd["meta"]}
    spells = defaultdict(list)
    for r in wd["spells"]:
        spells[S.qid(r["p"])].append(r)
    legend_q = {}
    for Lg in legends:
        leg, q = Lg["leg"], Lg["qid"]
        legend_q[q] = leg
        tmid = meta.get(q, {}).get("tmid")
        pid = tmid or q
        seen = set()
        for r in spells.get(q, []):
            c = by_tm.get(r.get("tmclub") or "")
            if not c or c["fr"] not in big:
                continue
            y0, y1 = S.year(r.get("start")), S.year(r.get("end"))
            if (c["fr"], y0) in seen:
                continue
            seen.add((c["fr"], y0))
            ss = spell_seasons(y0, y1)
            if not ss:
                continue
            peak = c["fr"] == leg["fr"] and leg["peak"] in ss
            apps, goals = S.numv(r.get("apps")), S.numv(r.get("goals"))
            if not peak and ((apps is not None and apps < 30) or (apps is None and len(ss) < 3)):
                continue  # a short stay elsewhere is not one of his cells
            if leg["pos"] == "GK" or (goals is not None and goals < 0):
                goals = 0 if leg["pos"] == "GK" else None
            ovr = Lg["ovr"] if peak else Lg["ovr"] - NON_PEAK
            face = C.face_stats(leg["pos"], ovr, [0.0] * 6, leg["tweaks"])
            att, mid, de = subratings(leg["pos"], face)
            by_dec = defaultdict(list)
            for s in ss:
                by_dec[decade(s)].append(s)
            for d, dss in by_dec.items():
                if d < FIRST_DECADE or (len(dss) < 2 and len(by_dec) > 1):
                    continue
                pre = [s for s in dss if s < S.FIRST]
                key = ((c["fr"], d), pid)
                if key in rows:
                    # he has Transfermarkt seasons in this cell too: keep the real stats, credit the earlier peak years
                    if pre:
                        rows[key]["ovr"] = max(rows[key]["ovr"], ovr if not peak or leg["peak"] in pre else ovr - 2)
                        rows[key]["est"] = 1
                        rows[key]["from"] = min(rows[key]["from"], min(pre))
                    continue
                if not pre:
                    continue
                n = len(ss)
                rows[key] = {"name": leg["name"], "pos": [leg["pos"]], "apps": int(round(apps * len(dss) / n)) if apps is not None else -1,
                             "seasons": len(dss), "from": min(dss), "to": max(dss), "est": 1, "pid": pid,
                             "g": round(goals / n, 1) if goals is not None else -1, "a": -1, "cs": -1, "min": -1,
                             "ovr": ovr if not peak or decade(leg["peak"]) == d else ovr - 2,
                             "att": att, "mid": mid, "def": de}

    # 3. notable players from Wikidata club spells, before 2012-13
    roster = []
    for fr, rs in wd["roster"].items():
        seen = set()
        for r in rs:
            q = S.qid(r["p"])
            y0 = S.year(r.get("start"))
            if q in legend_q or (q, y0) in seen:
                continue
            seen.add((q, y0))
            ss = [s for s in spell_seasons(y0, S.year(r.get("end"))) if s < S.FIRST]
            apps, goals = S.numv(r.get("apps")), S.numv(r.get("goals"))
            if not ss or (apps is not None and apps < 30) or (apps is None and len(ss) < 3):
                continue
            roster.append((fr, q, r, ss, apps, goals))
    sl = C.Ranker([int(r["sl"]) for _, _, r, _, _, _ in roster])
    for fr, q, r, ss, apps, goals in roster:
        n_all = len(spell_seasons(S.year(r.get("start")), S.year(r.get("end"))))
        pos = wd_positions(r.get("pos"))
        if pos[0] == "GK":
            goals = 0
        per = (apps / max(1, n_all)) if apps is not None else None
        est = 66 + 14 * sl(int(r["sl"])) ** 1.5 + 4 * (min(1.0, per / 28.0) if per is not None else 0.5) + 2 * min(1.0, n_all / 6.0)
        est = round(min(86.0, est), 1)
        face = C.face_stats(pos[0], int(round(est)), [0.0] * 6)
        att, mid, de = subratings(pos[0], face)
        pid = r.get("tmid") or q
        by_dec = defaultdict(list)
        for s in ss:
            by_dec[decade(s)].append(s)
        for d, dss in by_dec.items():
            if d < FIRST_DECADE or (len(dss) < 2 and len(by_dec) > 1):
                continue
            key = ((fr, d), pid)
            if key in rows:
                continue
            rows[key] = {"name": r["pLabel"], "pos": pos, "apps": int(round(apps * len(dss) / n_all)) if apps is not None else -1,
                         "seasons": len(dss), "from": min(dss), "to": max(dss), "est": 1, "pid": pid,
                         "g": round(goals / n_all, 1) if goals is not None else -1, "a": -1, "cs": -1, "min": -1,
                         "ovr": est, "att": att, "mid": mid, "def": de}

    by_cell = defaultdict(list)
    for (cell, pid), row in rows.items():
        by_cell[cell].append(row)
    # prime: the player's best cell (among the cells that are kept)
    best = {}
    for (cell, pid), row in rows.items():
        if len(by_cell[cell]) >= MIN_CELL and (pid not in best or row["ovr"] > best[pid][0]):
            best[pid] = (row["ovr"], cell)
    teams = []
    tables = agg["tables"]
    dropped = []
    for (fr, d), rs in sorted(by_cell.items(), key=lambda kv: (S.BIG.index(kv[0][0]), kv[0][1])):
        if len(rs) < MIN_CELL:
            dropped.append("%s-%d (%d)" % (fr, d, len(rs)))
            continue
        c = by_fr[fr]
        cid = "%s-%d" % (fr, d)
        rs.sort(key=lambda r: -r["ovr"])
        names = Counter(r["name"] for r in rs)
        out_rows = []
        for r in rs:
            name = r["name"] if names[r["name"]] == 1 else "%s (%d-%02d)" % (r["name"], r["from"], r["to"] % 100)
            pr = best[r["pid"]][1]
            prime = None if pr == (fr, d) else "%s-%d" % pr
            out_rows.append([name, "/".join(r["pos"]), r["apps"], r["seasons"], r["from"], r["to"], r["est"], prime, r["pid"], r["g"], r["a"],
                             r["cs"], r["min"], r["ovr"], r["att"], r["mid"], r["def"]])
        teams.append({"id": cid, "fr": fr, "abbr": c["abbr"], "name": c["name"], "era": "%ds" % d, "c1": c["c1"], "c2": c["c2"],
                      "from": min(r["from"] for r in rs), "to": max(r["to"] for r in rs), "players": out_rows})

    # great teams: league champions of the top five leagues and the Champions League winners
    cl_final = {int(s): cl for s, cl in agg["cl_final"].items()}
    by_team_season = defaultdict(list)
    for x in lines:
        by_team_season[(x["club"]["tm"], x["season"])].append(x)
    playoff = []
    for key, t in tables.items():
        club, season = key.split(":")
        season = int(season)
        champ = t.get("rank") == 1 and t["lg"] in ("GB1", "ES1", "IT1", "L1", "FR1")
        ucl = cl_final.get(season) == club
        if not (champ or ucl) or club not in by_tm:
            continue
        c = by_tm[club]
        xs = sorted(by_team_season[(club, season)], key=lambda x: -x["ovr"])
        xi = pick_xi(xs)
        playoff.append({"year": "%d-%02d" % (season - 1, season % 100), "team": c["name"], "abbr": c["abbr"], "gp": t["gp"], "w": t["w"],
                        "d": t["d"], "l": t["l"], "pts": t["pts"], "wFull": int(round(t["w"] * 38.0 / t["gp"])), "c1": c["c1"], "c2": c["c2"],
                        "star": xs[0]["name"] if xs else "", "gf": round(t["gf"] / t["gp"], 2), "ga": round(t["ga"] / t["gp"], 2),
                        "champ": champ, "ucl": ucl,
                        "xi": [[x["name"], x["pos"][0], x["src"]["apps"], x["src"]["g"], x["src"]["a"], x["ovr"]] for x in xi]})
    playoff.sort(key=lambda p: (-(p["pts"] * 38.0 / p["gp"]), p["year"]))
    out = {
        "source": "Transfermarkt via transfermarkt-datasets (CC0) 2012-13 to 2025-26; Wikidata (CC0) club spells; curated legends; ratings our own (docs/SOCCER-DATA.md)",
        "built": S.LAST,
        "fields": FIELDS,
        "positions": C.POSITIONS,
        "teams": teams,
        "playoff": playoff,
    }
    raw = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(raw)
    gz = len(gzip.compress(raw.encode("utf-8"), 9))
    n = sum(len(t["players"]) for t in teams)
    print("soccer.json: %d cells, %d player lines (%d estimated), %d great teams; %d bytes, %d gzipped" % (
        len(teams), n, sum(1 for t in teams for p in t["players"] if p[6]), len(playoff), len(raw.encode()), gz))
    eras = Counter()
    for t in teams:
        eras[t["era"]] += 1
    print("cells per era:", dict(sorted(eras.items())))
    print("cells left out (under %d players):" % MIN_CELL, ", ".join(dropped))
    small = [(t["id"], len(t["players"])) for t in teams if len(t["players"]) < 18]
    print("cells under 18 players:", small)
    for cid in ("BAR-2010", "MIL-1990", "MUN-1960", "AJA-1970", "FCB-2020"):
        t = next((t for t in teams if t["id"] == cid), None)
        if t:
            print(cid, len(t["players"]), "; ".join("%s %s %s" % (p[0], p[1], p[13]) for p in t["players"][:12]))


XI = [("GK", 1), ("CB", 2), ("FB", 2), ("DM", 1), ("CM", 1), ("AM", 1), ("W", 2), ("ST", 1)]
FILL = {"GK": [], "CB": ["DM", "FB"], "FB": ["CB", "W"], "DM": ["CM", "CB"], "CM": ["DM", "AM"], "AM": ["CM", "W", "ST"], "W": ["AM", "ST", "FB"], "ST": ["W", "AM"]}


def pick_xi(xs):
    used, xi = set(), []
    for pos, n in XI:
        for want in [pos] + FILL[pos]:
            for x in xs:
                if len([y for y in xi if y[1] == pos]) >= n:
                    break
                if id(x) not in used and x["pos"][0] == want:
                    used.add(id(x))
                    xi.append((x, pos))
    for x in xs:  # short of a position: the best of the rest (not a second keeper)
        if len(xi) >= 11:
            break
        if id(x) not in used and x["pos"][0] != "GK":
            used.add(id(x))
            xi.append((x, x["pos"][0]))
    return [x for x, _ in xi]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dl", default=S.DEFAULT_DL)
    args = ap.parse_args()
    build(os.path.abspath(args.dl))


if __name__ == "__main__":
    main()
