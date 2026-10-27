"""Defenders, offensive linemen and kickers, 1970-2025, for Perfect Season's Ultimate Team.

Writes .cache/nfl_players_more.json: one record per player, season and franchise for the
position groups nfl_sources.py doesn't cover (DL, LB, CB, S, OL, K), with whatever each
season has: games, depth-chart starts, defensive or kicking stats, honors, jersey, height,
weight. Then prints a coverage table by decade and position group.

Sources (all free, no login; raw files are cached in raw_dir, default .cache/nfl, the same
folder nfl_sources.py fills, so files it already fetched are reused):
  players.csv          nflverse player register: ids (gsis, pfr), birth dates, heights,
                       weights, draft slots (CC BY 4.0)
  rs/<year>.csv        nflverse season rosters 1999-2025 (shared with nfl_sources.py) and
  more/rs/<year>.csv   1970-1998: name, team, position, birth date, height, weight for every
                       rostered player, offense and defense alike (CC BY 4.0)
  wk/<year>.csv        nflverse weekly player stats 1999-2025: tackles, sacks, INT, passes
                       defended, forced fumbles, field goals by distance, extra points (CC BY 4.0)
  rw/<year>.csv        nflverse weekly rosters 2002-2025: games active (CC BY 4.0)
  games.csv            nflverse schedules: which weeks each team played (CC BY 4.0)
  more/dc/<year>.csv   nflverse depth charts 2001-2025: weeks listed first string (CC BY 4.0)
  more/wikidata_pfr.csv  Wikidata: English Wikipedia article <-> Pro-Football-Reference id,
                       to join Wikipedia names to the register (CC0)
  more/wiki/*.txt      English Wikipedia wikitext (CC BY-SA 4.0): "<year> All-Pro Team"
                       pages, the Pro Bowl page for each season, and the articles of
                       kickers and defenders, for their pre-1999 season tables

Not used, on purpose: anything scraped from Pro-Football-Reference (its data use policy says
not to build tools on scraped data), which includes nflverse's pfr_advstats, snap_counts,
draft_picks and combine releases, and NFL.com / ESPN pages (their terms bar automated access).

Usage: python3 scripts/nfl_more_sources.py [raw_dir] [out_path]
"""

import csv
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nfl_sources as S  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", ".cache", "nfl_players_more.json")
FIRST, SPLIT, LAST = S.FIRST_SEASON, S.SPLIT, S.LAST_SEASON
DC_FIRST = 2001  # nflverse depth charts start here
UA = "perfect-season-data/1.0 (hobby NFL game data build; python-urllib)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
WDQS = "https://query.wikidata.org/sparql"
GROUPS = ("DL", "LB", "CB", "S", "OL", "K")

# roster / depth-chart / stats position -> (group, position). DB is settled later (CB or S).
POS = {
    "DE": ("DL", "DE"), "LDE": ("DL", "DE"), "RDE": ("DL", "DE"), "EDGE": ("DL", "DE"),
    "DT": ("DL", "DT"), "LDT": ("DL", "DT"), "RDT": ("DL", "DT"), "DI": ("DL", "DT"), "NT": ("DL", "NT"), "DL": ("DL", "DL"),
    "LB": ("LB", "LB"), "OLB": ("LB", "OLB"), "ILB": ("LB", "ILB"), "MLB": ("LB", "MLB"), "SLB": ("LB", "OLB"),
    "WLB": ("LB", "OLB"), "LOLB": ("LB", "OLB"), "ROLB": ("LB", "OLB"), "LILB": ("LB", "ILB"), "RILB": ("LB", "ILB"),
    "CB": ("CB", "CB"), "LCB": ("CB", "CB"), "RCB": ("CB", "CB"), "NB": ("CB", "CB"),
    "S": ("S", "S"), "SS": ("S", "SS"), "FS": ("S", "FS"), "SAF": ("S", "S"), "DB": ("DB", "DB"),
    "T": ("OL", "T"), "OT": ("OL", "T"), "LT": ("OL", "T"), "RT": ("OL", "T"), "G": ("OL", "G"), "OG": ("OL", "G"),
    "LG": ("OL", "G"), "RG": ("OL", "G"), "C": ("OL", "C"), "OL": ("OL", "OL"),
    "K": ("K", "K"), "PK": ("K", "K"),
}
GENERIC = ("DB", "DL", "OL", "LB")


def classify(*cands):
    """The most specific (group, position) among a row's position fields."""
    found = [POS[c] for c in ((x or "").upper().strip() for x in cands) if c in POS]
    for g, p in found:
        if p not in GENERIC:
            return g, p
    return found[0] if found else None


# ---------------------------------------------------------------- fetching

def get(url, data=None, accept=None, tries=6):
    """One polite HTTP request: a descriptive User-Agent, and on 429/5xx a wait (Retry-After,
    or a growing pause) before trying again."""
    headers = {"User-Agent": UA}
    if accept:
        headers["Accept"] = accept
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or i == tries - 1:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 20 * (i + 1)
            print("  HTTP", e.code, "- waiting", wait, "s")
            time.sleep(min(wait, 120))


def download(url, path):
    if not os.path.exists(path):
        print("downloading", url)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = get(url)
        with open(path + ".part", "wb") as f:
            f.write(data)
        os.replace(path + ".part", path)


def fetch(raw_dir):
    V = S.NFLVERSE
    want = [(V + "players/players.csv", "players.csv"), (V + "schedules/games.csv", "games.csv")]
    want += [(V + "rosters/roster_%d.csv" % y, "more/rs/%d.csv" % y) for y in range(FIRST, SPLIT)]
    want += [(V + "rosters/roster_%d.csv" % y, "rs/%d.csv" % y) for y in range(SPLIT, LAST + 1)]
    want += [(V + "stats_player/stats_player_week_%d.csv" % y, "wk/%d.csv" % y) for y in range(SPLIT, LAST + 1)]
    want += [(V + "weekly_rosters/roster_weekly_%d.csv" % y, "rw/%d.csv" % y) for y in range(S.ROSTER_FIRST, LAST + 1)]
    want += [(V + "depth_charts/depth_charts_%d.csv" % y, "more/dc/%d.csv" % y) for y in range(DC_FIRST, LAST + 1)]
    for url, rel in want:
        download(url, os.path.join(raw_dir, rel))


def wikidata_pfr(more):
    """Wikidata: every English Wikipedia article about someone with a Pro-Football-Reference id.
    One query (the service allows about one a minute), cached."""
    path = os.path.join(more, "wikidata_pfr.csv")
    if not os.path.exists(path):
        print("querying Wikidata for Wikipedia titles <-> PFR ids")
        q = ("SELECT ?pfr ?article ?born WHERE { ?p wdt:P3561 ?pfr . ?article schema:about ?p ; "
             "schema:isPartOf <https://en.wikipedia.org/> . OPTIONAL { ?p wdt:P569 ?born } }")
        data = get(WDQS + "?" + urllib.parse.urlencode({"query": q}), accept="text/csv")
        with open(path, "wb") as f:
            f.write(data)
    title_pfr, pfr_title = {}, {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        title = urllib.parse.unquote(r["article"].rsplit("/wiki/", 1)[-1]).replace("_", " ")
        pfr = r["pfr"].split("/")[-1]  # "S/stenejan01" -> "stenejan01" (the register's form)
        title_pfr[title] = pfr
        pfr_title[pfr] = title
    return title_pfr, pfr_title


def wiki_file(more, title):
    safe = re.sub(r"[^A-Za-z0-9._-]", lambda m: "%%%02X" % ord(m.group()) if ord(m.group()) < 256 else "_", title)
    return os.path.join(more, "wiki", safe[:180] + ".txt")


def wiki_pages(more, titles):
    """Wikitext of English Wikipedia pages, 50 per API request, about one request a second,
    cached one file per title (a missing page is cached as empty)."""
    out = {}
    need = []
    for t in dict.fromkeys(titles):
        p = wiki_file(more, t)
        if os.path.exists(p):
            out[t] = open(p, encoding="utf-8").read()
        else:
            need.append(t)
    os.makedirs(os.path.join(more, "wiki"), exist_ok=True)
    done = 0
    while need:
        chunk, need = need[:50], need[50:]
        q = {"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "redirects": "1",
             "format": "json", "formatversion": "2", "titles": "|".join(chunk)}
        d = json.loads(get(WIKI_API, data=urllib.parse.urlencode(q).encode()))
        alias = {}
        for kind in ("normalized", "redirects"):
            for x in d.get("query", {}).get(kind, []):
                alias[x["from"]] = x["to"]
        text, gone = {}, set()
        for p in d.get("query", {}).get("pages", []):
            revs = p.get("revisions")
            if revs:
                text[p["title"]] = revs[0]["slots"]["main"]["content"]
            elif p.get("missing") or p.get("invalid"):
                gone.add(p["title"])
        later = []
        for t in chunk:
            u = t
            while u in alias and alias[u] != u:
                u = alias[u]
            if u not in text and u not in gone:
                later.append(t)  # left out of a response that hit its size limit: ask again
                continue
            out[t] = text.get(u, "")
            with open(wiki_file(more, t), "w", encoding="utf-8") as f:
                f.write(out[t])
        if later and len(later) == len(chunk):
            raise RuntimeError("Wikipedia returned none of " + ", ".join(chunk[:3]))
        need = later + need
        done += len(chunk) - len(later)
        print("wikipedia: %d pages fetched, %d to go" % (done, len(need)))
        time.sleep(1)
    return out


# ---------------------------------------------------------------- names, teams, register

def nkey(n):
    n = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode()
    return S.name_key(n)


def roster_fr(code, season):
    if season >= SPLIT:
        fr = S.ROSTER_CODES.get(code, code)
    else:
        fr = {"BAL": "IND" if season <= 1983 else "BAL", "STL": "ARI" if season <= 1987 else "LAR", "HOU": "TEN",
              "LA": "LAR", "RAM": "LAR", "RAI": "LV", "OAK": "LV", "SD": "LAC", "BOS": "NE", "PHO": "ARI",
              "ARZ": "ARI", "WSH": "WAS"}.get(code, code)
    if fr not in S.FRANCHISES:
        raise ValueError("unknown roster team %s in %d" % (code, season))
    return fr


NICK = {"49ers": "SF", "Bears": "CHI", "Bengals": "CIN", "Bills": "BUF", "Broncos": "DEN", "Browns": "CLE",
        "Buccaneers": "TB", "Cardinals": "ARI", "Chargers": "LAC", "Chiefs": "KC", "Colts": "IND", "Commanders": "WAS",
        "Cowboys": "DAL", "Dolphins": "MIA", "Eagles": "PHI", "Falcons": "ATL", "Giants": "NYG", "Jaguars": "JAX",
        "Jets": "NYJ", "Lions": "DET", "Oilers": "TEN", "Packers": "GB", "Panthers": "CAR", "Patriots": "NE",
        "Raiders": "LV", "Rams": "LAR", "Ravens": "BAL", "Redskins": "WAS", "Saints": "NO", "Seahawks": "SEA",
        "Steelers": "PIT", "Texans": "HOU", "Titans": "TEN", "Vikings": "MIN", "Football Team": "WAS"}
CITY = {"Arizona": "ARI", "Phoenix": "ARI", "Atlanta": "ATL", "Buffalo": "BUF", "Carolina": "CAR", "Chicago": "CHI",
        "Cincinnati": "CIN", "Cleveland": "CLE", "Dallas": "DAL", "Denver": "DEN", "Detroit": "DET", "Green Bay": "GB",
        "Indianapolis": "IND", "Jacksonville": "JAX", "Kansas City": "KC", "Las Vegas": "LV", "Oakland": "LV",
        "Miami": "MIA", "Minnesota": "MIN", "New England": "NE", "Boston": "NE", "New Orleans": "NO",
        "Philadelphia": "PHI", "Pittsburgh": "PIT", "San Diego": "LAC", "San Francisco": "SF", "Seattle": "SEA",
        "Tampa Bay": "TB", "Tennessee": "TEN", "Washington": "WAS"}


def wiki_fr(texts, season):
    """Franchise from a Wikipedia team link (target and label), nickname first."""
    for t in texts:
        for k, fr in NICK.items():
            if re.search(r"\b" + k + r"\b", t or ""):
                return fr
    for t in texts:
        for k, fr in CITY.items():
            if re.search(r"\b" + k + r"\b", t or ""):
                return fr
        if re.search(r"\bBaltimore\b", t or ""):
            return "IND" if season <= 1983 else "BAL"
        if re.search(r"\bHouston\b", t or ""):
            return "TEN" if season <= 1996 else "HOU"
        if re.search(r"\bSt\. Louis\b", t or ""):
            return "ARI" if season <= 1987 else "LAR"
    for t in texts:
        code = (t or "").strip().upper()
        if re.fullmatch(r"[A-Z]{2,3}", code):
            fr = S.VERSE.get(code) or S.pfr_franchise(code, season)
            if code == "LA":
                fr = "LAR"
            if fr in S.FRANCHISES:
                return fr
    return None


class Register:
    def __init__(self, path):
        self.by_id, self.by_pfr = {}, {}
        self.by_key_born = defaultdict(list)
        self.by_key = defaultdict(list)
        for r in csv.DictReader(open(path, encoding="utf-8")):
            p = {"id": r["gsis_id"], "name": r["display_name"], "born": r["birth_date"], "pfr": r["pfr_id"],
                 "pos": r["position"], "ht": int(S.num(r["height"])) or None, "wt": int(S.num(r["weight"])) or None,
                 "jersey": int(S.num(r["jersey_number"])) or None, "esb": r["esb_id"],
                 "first": int(S.num(r["rookie_season"])) or None, "last": int(S.num(r["last_season"])) or None,
                 "draft": [int(S.num(r[k])) or None for k in ("draft_year", "draft_round", "draft_pick")] + [r["draft_team"] or None]}
            self.by_id[p["id"]] = p
            if p["pfr"]:
                self.by_pfr[p["pfr"]] = p
            if p["esb"]:
                self.by_id.setdefault(p["esb"], p)
            for nm in {r["display_name"], (r["first_name"] + " " + r["last_name"]), (r["football_name"] + " " + r["last_name"])}:
                k = nkey(nm)
                if k and p not in self.by_key[k]:
                    self.by_key[k].append(p)
                    self.by_key_born[(k, p["born"])].append(p)

    def find(self, names, born):
        for nm in names:
            c = self.by_key_born.get((nkey(nm), born), [])
            if len(c) == 1:
                return c[0]
        return None

    def near(self, name, season, group=None):
        """The one register player of this name whose career spans the season."""
        c = [p for p in self.by_key.get(nkey(name), []) if p["first"] and p["last"] and p["first"] - 2 <= season <= p["last"] + 1]
        if group and len(c) > 1:
            c2 = [p for p in c if (classify(p["pos"]) or ("",))[0] in (group, "DB" if group in ("CB", "S") else group)]
            c = c2 or c
        return c[0] if len(c) == 1 else None


# ---------------------------------------------------------------- rosters, stats, games, starts

def new_rec(pid, name, season, fr, gp, reg_p):
    return {"id": pid, "gsis_id": reg_p["id"] if reg_p else None, "pfr_id": (reg_p or {}).get("pfr") or None,
            "name": name, "season": season, "team": fr, "group": gp[0], "pos": gp[1], "src": set()}


def rosters(raw_dir, reg, recs):
    """Every rostered DL/LB/DB/OL/K, 1970-2025, keyed by (player id, season, franchise)."""
    unmatched = 0
    for y in range(FIRST, LAST + 1):
        path = os.path.join(raw_dir, "more/rs" if y < SPLIT else "rs", "%d.csv" % y)
        for r in csv.DictReader(open(path, encoding="utf-8")):
            gp = classify(r["depth_chart_position"], r["position"])
            if not gp:
                continue
            names = [r["full_name"], r["first_name"] + " " + r["last_name"]]
            p = reg.by_id.get(r["gsis_id"]) or reg.by_id.get(r.get("esb_id") or "-") or reg.find(names, r["birth_date"])
            if p is None:
                unmatched += 1
            pid = p["id"] if p else "nfl:%s:%s" % (nkey(r["full_name"]).replace(" ", "-"), r["birth_date"] or "?")
            fr = roster_fr(r["team"], y)
            key = (pid, y, fr)
            rec = recs.get(key)
            if rec is None:
                rec = recs[key] = new_rec(pid, r["full_name"], y, fr, gp, p)
                rec["status"] = r["status"]
            elif rec["status"] != "ACT" and r["status"] == "ACT":
                rec["status"] = "ACT"
            rec["src"].add("roster")
            if rec["pos"] in GENERIC and gp[1] not in GENERIC:
                rec["group"], rec["pos"] = gp
            j = int(S.num(r["jersey_number"]))
            if j:
                rec["jersey"], rec["jersey_src"] = j, "roster"
            rec["height"] = int(S.num(r["height"])) or (p or {}).get("ht")
            rec["weight"] = int(S.num(r["weight"])) or (p or {}).get("wt")
            rec["birth_date"] = r["birth_date"] or (p or {}).get("born") or None
    print("roster rows the register couldn't place (stand-in ids):", unmatched)


DEF = {"tkl_solo": "def_tackles_solo", "tkl_ast": "def_tackle_assists", "tfl": "def_tackles_for_loss",
       "sacks": "def_sacks", "qb_hits": "def_qb_hits", "int": "def_interceptions", "int_yds": "def_interception_yards",
       "pd": "def_pass_defended", "ff": "def_fumbles_forced", "fr": "fumble_recovery_opp", "def_td": "def_tds",
       "safety": "def_safeties"}
KICK = {"fgm": "fg_made", "fga": "fg_att", "fg_blk": "fg_blocked", "xpm": "pat_made", "xpa": "pat_att"}
BUCKETS = (("0_19", "0_19"), ("20_29", "20_29"), ("30_39", "30_39"), ("40_49", "40_49"), ("50_59", "50_59"), ("60_", "60_plus"))


def weekly_stats(raw_dir):
    """nflverse weekly stats 1999-2025, regular season, summed per (player id, season,
    franchise), with the game count and the stats row's own position. The same visitors-label
    fix as nfl_sources.verse_rows (2001-02 Jaguars home games)."""
    on_team = defaultdict(set)
    for y in range(SPLIT, LAST + 1):
        for r in csv.DictReader(open(os.path.join(raw_dir, "rs", "%d.csv" % y), encoding="utf-8")):
            on_team[(r["gsis_id"], y)].add(S.ROSTER_CODES.get(r["team"], r["team"]))
    agg = {}
    for y in range(SPLIT, LAST + 1):
        rows = [r for r in csv.DictReader(open(os.path.join(raw_dir, "wk", "%d.csv" % y), encoding="utf-8"))
                if r["season_type"] == "REG" and r["team"]]
        labels = defaultdict(set)
        for r in rows:
            labels[r["game_id"]].add(r["team"])
        for r in rows:
            fr = S.VERSE.get(r["team"], r["team"])
            opp = S.VERSE.get(r["opponent_team"], r["opponent_team"])
            on = on_team.get((r["player_id"], y), set())
            if len(labels[r["game_id"]]) == 1 and opp in on and fr not in on:
                fr = opp
            key = (r["player_id"], y, fr)
            a = agg.get(key)
            if a is None:
                a = agg[key] = {"name": r["player_display_name"], "pos": r["position"], "g": 0, "s": Counter(), "fg_long": 0}
            a["g"] += 1
            for k, col in list(DEF.items()) + list(KICK.items()):
                a["s"][k] += S.num(r[col])
            for b, out in BUCKETS:
                m, x = S.num(r["fg_made_" + b]), S.num(r["fg_missed_" + b])
                a["s"]["fgm_" + out] += m
                a["s"]["fga_" + out] += m + x
            a["fg_long"] = max(a["fg_long"], S.num(r["fg_long"]))
    return agg


def depth_starts(raw_dir, played):
    """Weeks each player was first string at a position of his group, per (gsis id, season,
    franchise): the weekly depth charts 2001-2024 (depth_team 1), and for 2025 the daily
    snapshots, read as the last one on or before each game day (pos_rank 1). A depth chart is
    the team's pre-game listing, so this is a stand-in for official starts."""
    weeks = defaultdict(set)
    for y in range(DC_FIRST, LAST + 1):
        path = os.path.join(raw_dir, "more/dc", "%d.csv" % y)
        rdr = csv.DictReader(open(path, encoding="utf-8"))
        if "depth_team" in rdr.fieldnames:
            for r in rdr:
                if r["game_type"] != "REG" or r["depth_team"].strip() != "1" or not r["gsis_id"]:
                    continue
                gp = classify(r["depth_position"], r["position"])
                if not gp:
                    continue
                if (gp[0] == "OL") != (r["formation"] == "Offense") or (gp[0] == "K") != (r["formation"] == "Special Teams"):
                    continue
                fr = S.ROSTER_CODES.get(r["club_code"], r["club_code"])
                wk = int(S.num(r["week"]))
                if (y, wk, fr) in played:
                    weeks[(r["gsis_id"], y, fr)].add(wk)
        else:  # 2025-: timestamped snapshots
            snaps = defaultdict(lambda: defaultdict(set))  # team -> date -> starters
            for r in rdr:
                if r["pos_rank"] != "1" or not r["gsis_id"] or r["pos_abb"] in ("KR", "PR", "H", "LS", "P"):
                    continue
                if not classify(r["pos_abb"]):
                    continue
                fr = S.ROSTER_CODES.get(r["team"], r["team"])
                snaps[fr][r["dt"][:10]].add(r["gsis_id"])
            for (s, wk, fr), day in played.items():
                if s != y or fr not in snaps:
                    continue
                before = [d for d in snaps[fr] if d <= day]
                if before:
                    for gid in snaps[fr][max(before)]:
                        weeks[(gid, y, fr)].add(wk)
    return {k: len(v) for k, v in weeks.items()}


def played_weeks(raw_dir):
    out = {}
    for r in csv.DictReader(open(os.path.join(raw_dir, "games.csv"), encoding="utf-8")):
        if r["game_type"] == "REG" and r["home_score"] != "":
            for t in (r["home_team"], r["away_team"]):
                out[(int(r["season"]), int(r["week"]), S.VERSE.get(t, t))] = r["gameday"]
    return out


# ---------------------------------------------------------------- Wikipedia tables

TAGS = re.compile(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|<!--.*?-->", re.S | re.I)
BR = re.compile(r"<br\s*/?>|\n\s*[*#]", re.I)
LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]*))?\]\]")


def top_split(s, sep):
    """Split on sep outside [[...]] and {{...}}."""
    out, depth, cur, i = [], 0, "", 0
    while i < len(s):
        two = s[i:i + 2]
        if two in ("[[", "{{"):
            depth += 1
            cur += two
            i += 2
            continue
        if two in ("]]", "}}"):
            depth = max(0, depth - 1)
            cur += two
            i += 2
            continue
        if depth == 0 and s.startswith(sep, i):
            out.append(cur)
            cur = ""
            i += len(sep)
            continue
        cur += s[i]
        i += 1
    out.append(cur)
    return out


def cell_parts(c):
    """(attributes, content) of a table cell."""
    parts = top_split(c, "|")
    if len(parts) > 1 and ("=" in parts[0] or not parts[0].strip()) and "[[" not in parts[0] and "{{" not in parts[0]:
        return parts[0], "|".join(parts[1:])
    return "", c


def tables(text):
    """Every wikitable as a list of rows; a row is [(is_header, attrs, content)], plus the
    section heading above the table."""
    text = TAGS.sub("", text)
    out, stack, heading = [], [], ""
    for line in text.split("\n"):
        s = line.strip()
        m = re.match(r"^(={2,})\s*(.*?)\s*\1$", s)
        if m:
            heading = m.group(2)
            continue
        if s.startswith("{|"):
            stack.append({"heading": heading, "rows": [], "cur": None})
            continue
        if not stack:
            continue
        t = stack[-1]
        if s.startswith("|}"):
            if t["cur"]:
                t["rows"].append(t["cur"])
            out.append((t["heading"], t["rows"]))
            stack.pop()
            continue
        if s.startswith("|-"):
            if t["cur"]:
                t["rows"].append(t["cur"])
            t["cur"] = []
            continue
        if s.startswith("|+"):
            continue
        if s.startswith("!") or s.startswith("|"):
            hdr = s.startswith("!")
            body = s[1:]
            cells = top_split(body, "!!") if hdr else [body]
            cells = [x for c in cells for x in top_split(c, "||")]
            if t["cur"] is None:
                t["cur"] = []
            for c in cells:
                a, v = cell_parts(c)
                t["cur"].append([hdr, a, v])
        elif t["cur"]:
            t["cur"][-1][2] += "\n" + line
    return out


def plain(s):
    """Wikitext -> text: links to their labels, {{abbr|X|..}} to X, other templates dropped."""
    s = re.sub(r"\{\{\s*(?:abbr|tooltip|nowrap|small|sortname)\s*\|([^|}]*)(?:\|([^|}]*))?[^}]*\}\}",
               lambda m: m.group(1) + (" " + m.group(2) if m.group(0).lower().lstrip("{ ").startswith("sortname") and m.group(2) else ""), s, flags=re.I)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = LINK.sub(lambda m: m.group(2) if m.group(2) is not None else m.group(1), s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"<[^>]+>", "", s).replace("&nbsp;", " ")
    return " ".join(s.split())


def entries(cell):
    """The players listed in an honors cell: (wiki title, name, team texts, selectors, jersey, raw)."""
    out = []
    for piece in BR.split(cell):
        if not piece.strip():
            continue
        jersey = None
        m = re.search(r"\{\{\s*small\s*\|[\s&nbsp;]*(\d+)\s*\}\}", piece, re.I)
        if m:
            jersey = int(m.group(1))
        p = re.sub(r"\{\{\s*small\s*\|[^}]*\}\}", "", piece, flags=re.I)
        p = re.sub(r"\{\{\s*(?:ref label|efn|sup|dagger|double-dagger|ref|cross|\^|·)[^}]*\}\}", "", p, flags=re.I)
        nfp = re.match(r"\s*\{\{\s*NFLplayer\s*\|(.*)\}\}", p, re.I | re.S)
        if nfp:  # {{NFLplayer|num| Name |d=..| ([[Team]])}}
            args = [a.strip() for a in top_split(nfp.group(1), "|")]
            pos_args = [a for a in args if "=" not in a.split("[[")[0]]
            jersey = int(re.sub(r"\D", "", pos_args[0]) or 0) or None if pos_args else None
            name = pos_args[1] if len(pos_args) > 1 else ""
            team = " ".join(pos_args[2:])
            tl = LINK.findall(team)
            out.append({"title": name, "name": name, "team": [x for l in tl for x in l], "sel": [], "jersey": jersey})
            continue
        links = LINK.findall(p)
        sel = []
        m = re.search(r"\(([^()]*)\)\s*$", plain(p))
        if m and re.search(r"\b(AP|NEA|UPI|PFWA|PFW|SN|TSN|FW|NY|PW)\b", m.group(1)):
            sel = [x.strip() for x in m.group(1).split(",") if x.strip()]
        if links:
            title, label = links[0]
            name = label or title
            team = [x for l in links[1:2] for x in l]
            if not team:
                rest = plain(p).split(",", 1)
                team = [re.sub(r"\(.*", "", rest[1]).strip()] if len(rest) > 1 else []
        else:
            txt = plain(p)
            parts = txt.split(",", 1)
            title, name = None, parts[0]
            team = [re.sub(r"\(.*", "", parts[1]).strip()] if len(parts) > 1 else []
        name = re.sub(r"[*†‡#^§¤+]|\(.*?\)", "", plain(name)).strip()
        if name and len(name) > 2:
            out.append({"title": title.strip() if title else None, "name": name, "team": team, "sel": sel, "jersey": jersey})
    return out


HONOR_POS = [  # (pattern on the position cell, group, position)
    (r"defensive end|edge", "DL", "DE"), (r"defensive tackle|nose tackle|interior lineman|defensive lineman", "DL", "DT"),
    (r"middle linebacker", "LB", "MLB"), (r"inside linebacker", "LB", "ILB"), (r"outside linebacker", "LB", "OLB"),
    (r"linebacker", "LB", "LB"), (r"cornerback", "CB", "CB"), (r"free safety", "S", "FS"), (r"strong safety", "S", "SS"),
    (r"safet", "S", "S"), (r"defensive back", "DB", "DB"), (r"tackle", "OL", "T"), (r"guard", "OL", "G"),
    (r"center", "OL", "C"), (r"offensive line", "OL", "OL"), (r"kicker", "K", "K"),
]
SKIP_POS = r"punter|return|special team|long snap|quarterback|running back|halfback|fullback|receiver|tight end|kick returner|punt returner|flex"


def honor_pos(cell):
    t = plain(cell).lower()
    if not t or re.search(SKIP_POS, t) and not re.search(r"placekicker|^kicker", t):
        return None
    for pat, g, p in HONOR_POS:
        if re.search(pat, t):
            return g, p
    return None


def allpro(text, season):
    """'<year> All-Pro Team': every first- and second-team pick at our positions, with selectors."""
    out = []
    for _, rows in tables(text):
        for row in rows:
            if len(row) < 2:
                continue
            gp = honor_pos(row[0][2])
            if not gp:
                continue
            for col, c in enumerate(row[1:3]):
                for e in entries(c[2]):
                    sel = e["sel"] or (["AP"] if col == 0 else ["AP-2"])
                    out.append(dict(e, season=season, gp=gp, sel=sel, kind="allpro"))
    return out


def probowl(text, season):
    """The season's Pro Bowl page: every selection at our positions (an alternate only when
    marked as a replacement)."""
    out = []
    for heading, rows in tables(text):
        cols = None
        for row in rows:
            if all(c[0] for c in row) and len(row) >= 2:
                cols = [plain(c[2]).lower() for c in row]
                continue
            if len(row) < 2:
                continue
            gp = honor_pos(row[0][2])
            if not gp:
                continue
            for i, c in enumerate(row[1:], 1):
                alt = cols and i < len(cols) and "alternate" in cols[i]
                for e in entries(c[2]):
                    out.append(dict(e, season=season, gp=gp, kind="probowl", alt=alt))
    # alternates: the replacement mark was dropped with the templates, so look again
    keep = []
    for e in out:
        if e.get("alt"):
            pat = re.escape(e["title"] or e["name"]) + r"[^\n<]*?ref label\|replacement"
            if not re.search(pat, text):
                continue
        keep.append(e)
    # the bullet-list rosters (2014-2016): '''[[Position]]''' headings, then * {{NFLplayer ...}}
    pos = None
    for line in text.split("\n"):
        s = line.strip()
        m = re.match(r"^'''\s*(\[\[[^\]]+\]\]\w*)\s*'''$", s)
        if m:
            pos = honor_pos(m.group(1))
            continue
        if pos and re.match(r"^\*\s*\{\{\s*NFLplayer", s, re.I):
            for e in entries(s[1:]):
                keep.append(dict(e, season=season, gp=pos, kind="probowl"))
    return keep


def probowl_title(season):
    return "%d Pro Bowl" % (season + 1) if season + 1 <= 2022 else "%d Pro Bowl Games" % (season + 1)


# ---------------------------------------------------------------- kickers' Wikipedia tables

KCOLS = {"G": "g", "GP": "g", "GMS": "g", "FGM": "fgm", "FGA": "fga", "LNG": "fg_long", "LONG": "fg_long", "LG": "fg_long",
         "XPM": "xpm", "XPA": "xpa", "EPM": "xpm", "EPA": "xpa", "BLK": "fg_blk"}
KBUCK = {"<20": "0_19", "0-19": "0_19", "1-19": "0_19", "10-19": "0_19", "20-29": "20_29", "30-39": "30_39",
         "40-49": "40_49", "50+": "50_plus", "50-59": "50_plus", "60+": "50_plus"}


def span(attrs, kind):
    m = re.search(kind + r"\s*=\s*\"?(\d+)", attrs or "", re.I)
    return int(m.group(1)) if m else 1


def header_labels(hrows):
    """Column labels of a run of header rows, rowspans and colspans laid out: (top label,
    lowest label) per column."""
    grid = {}
    for r, row in enumerate(hrows):
        c = 0
        for _, attrs, content in row:
            while (r, c) in grid:
                c += 1
            cs, rs = span(attrs, "colspan"), span(attrs, "rowspan")
            lab = plain(content).upper().replace(" ", "").replace("\u2013", "-").rstrip(".")
            for dr in range(rs):
                for dc in range(cs):
                    grid[(r + dr, c + dc)] = lab
            c += cs
    ncols = max((c for _, c in grid), default=-1) + 1
    nrows = max((r for r, _ in grid), default=-1) + 1
    out = []
    for c in range(ncols):
        labs = [grid[(r, c)] for r in range(nrows) if grid.get((r, c))]
        out.append((labs[0] if labs else "", labs[-1] if labs else ""))
    return out


def kick_fields(hdr):
    return [("b", KBUCK[b]) if b in KBUCK else ("n", KCOLS.get(b)) for _, b in hdr]


DCOLS = {"G": "g", "GP": "g", "GMS": "g", "GS": "gs", "COMB": "tkl", "CMB": "tkl", "TOT": "tkl", "TOTAL": "tkl",
         "TKL": "tkl", "TCK": "tkl", "TACKLES": "tkl", "SOLO": "tkl_solo", "AST": "tkl_ast", "ASST": "tkl_ast",
         "TFL": "tfl", "SCK": "sacks", "SACK": "sacks", "SACKS": "sacks", "SK": "sacks", "SFTY": "safety",
         "SFT": "safety", "PD": "pd", "PDEF": "pd", "PDF": "pd", "INT": "int", "INTS": "int", "FF": "ff",
         "FR": "fr", "QBHITS": "qb_hits", "QBH": "qb_hits"}


def def_fields(hdr):
    """Field per column of a defender's table; a Yds or TD column belongs to the interception
    or fumble group it sits in (or follows)."""
    out, ctx = [], None
    for top, b in hdr:
        if "INT" in top:
            ctx = "int"
        elif "FUM" in top:
            ctx = "fum"
        f = DCOLS.get(b)
        if f == "int":
            ctx = "int"
        elif f in ("ff", "fr"):
            ctx = "fum"
        elif b in ("YDS", "YD", "YARDS"):
            f = "int_yds" if ctx == "int" else None
        elif b in ("TD", "TDS"):
            f = "def_td"
        elif f is None and ctx is None and "SACK" in top:
            f = "sacks"
        out.append(("n", f))
    return out


def season_tables(text, kind):
    """A player article's regular-season table: {season: [(team texts, stats)]}. kind K wants a
    table with FGM and FGA, kind D one with interceptions, sacks or tackles."""
    out = defaultdict(list)
    for _, rows in tables(text):
        hdr, hrows, last_year, fields = None, [], None, None
        for row in rows:
            if row and all(c[0] for c in row):
                hrows.append(row)
                h = header_labels(hrows)
                lows = {b for _, b in h}
                if kind == "K" and {"FGM", "FGA"} <= lows:
                    hdr, fields = h, kick_fields(h)
                elif kind == "D" and lows & {"INT", "SCK", "SACKS", "SK", "COMB", "SOLO", "TKL", "TOTAL"} and lows & {"YEAR", "SEASON", "YR"}:
                    hdr, fields = h, def_fields(h)
                continue
            hrows = []
            if not hdr or not row:
                continue
            m = re.search(r"\b(19[2-9]\d|20[0-2]\d)\b", plain(row[0][2]))
            if not m and last_year and len(row) == len(hdr) - 1:
                row = [[False, "", str(last_year)]] + row  # a season split over two teams (rowspan)
                m = re.search(r"\d{4}", str(last_year))
            if not m or len(row) < len(hdr) - 1 or "post" in plain(row[0][2]).lower():
                continue
            year = last_year = int(m.group(0))
            team = [x for l in LINK.findall(row[1][2]) for x in l] + [plain(row[1][2])]
            st = {}
            for (how, f), c in zip(fields[2:], row[2:]):
                v = plain(c[2]).replace("\u2013", "-").replace("\u2014", "-")
                if how == "b":
                    mm = re.match(r"\s*(\d+)\s*-\s*(\d+)", v)
                    if mm:
                        st["fgm_" + f] = st.get("fgm_" + f, 0) + float(mm.group(1))
                        st["fga_" + f] = st.get("fga_" + f, 0) + float(mm.group(2))
                elif f:
                    n = re.sub(r"[^\d.]", "", v.split("-")[0] if f != "fg_long" else v.lstrip("-"))
                    if n and n != ".":
                        st[f] = st.get(f, 0) + float(n) if f == "def_td" else float(n)
            if kind == "K" and "fgm" in st and "fga" in st or kind == "D" and len(st) >= 2:
                out[year].append((team, st))
    return out


# ---------------------------------------------------------------- assembly

def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".cache", "nfl")
    out_path = sys.argv[2] if len(sys.argv) > 2 else OUT
    more = os.path.join(raw_dir, "more")
    fetch(raw_dir)
    reg = Register(os.path.join(raw_dir, "players.csv"))
    title_pfr, pfr_title = wikidata_pfr(more)

    recs = {}
    rosters(raw_dir, reg, recs)

    # stats 1999-2025, and players with stats the season roster misses
    print("reading weekly stats")
    agg = weekly_stats(raw_dir)
    for (pid, y, fr), a in agg.items():
        key = (pid, y, fr)
        if key not in recs:
            gp = classify(a["pos"])
            if not gp:
                continue
            p = reg.by_id.get(pid)
            recs[key] = new_rec(pid, a["name"], y, fr, gp, p)
            recs[key].update(status=None, height=(p or {}).get("ht"), weight=(p or {}).get("wt"), birth_date=(p or {}).get("born"))
        rec = recs[key]
        rec["stat_g"] = a["g"]
        s = a["s"]
        if rec["group"] == "K" or s["fga"] or s["xpa"]:
            ks = {k: s[k] for k in ("fgm", "fga", "xpm", "xpa", "fg_blk")}
            ks["fg_long"] = a["fg_long"]
            for _, b in BUCKETS:
                ks["fgm_" + b], ks["fga_" + b] = s["fgm_" + b], s["fga_" + b]
            ks["fgm_50_plus"] = ks.pop("fgm_50_59") + ks.pop("fgm_60_plus")
            ks["fga_50_plus"] = ks.pop("fga_50_59") + ks.pop("fga_60_plus")
            rec["kicking"] = ks
        if rec["group"] != "K":
            ds = {k: s[k] for k in DEF}
            ds["tkl"] = ds["tkl_solo"] + ds["tkl_ast"]
            rec["defense"] = ds
        rec["src"].add("nflverse_stats")

    print("reading weekly rosters and depth charts")
    played = played_weeks(raw_dir)
    active, rostered = S.roster_games(raw_dir)
    starts = depth_starts(raw_dir, played)
    for (pid, y, fr), rec in recs.items():
        stat_g = rec.get("stat_g", 0)
        gs = starts.get((pid, y, fr))
        if y >= DC_FIRST:
            rec["gs"], rec["gs_src"] = gs or 0, "depth_chart"
        if S.roster_counts(y) and (pid, y, fr) in active:
            rec["g"], rec["g_src"] = max(active[(pid, y, fr)], stat_g), "active"
        elif y >= SPLIT and (stat_g or gs):
            rec["g"], rec["g_src"] = max(stat_g, gs or 0), "min"  # games with a stat, or first-string weeks
        elif y >= SPLIT and S.roster_counts(y):
            rec["g"], rec["g_src"] = 0, "active"
        rec["rostered_weeks"] = rostered.get((pid, y, fr))

    # honors
    print("reading Wikipedia honors pages")
    titles = ["%d All-Pro Team" % y for y in range(FIRST, LAST + 1)] + [probowl_title(y) for y in range(FIRST, LAST + 1)]
    pages = wiki_pages(more, titles)
    honors = []
    for y in range(FIRST, LAST + 1):
        honors += allpro(pages["%d All-Pro Team" % y], y)
        honors += probowl(pages[probowl_title(y)], y)
    no_pb = [y for y in range(FIRST, LAST + 1) if not any(h["kind"] == "probowl" and h["season"] == y for h in honors)]
    print("seasons whose Pro Bowl page has no rosters:", no_pb)
    by_season = defaultdict(list)
    for rec in recs.values():
        by_season[rec["season"]].append(rec)
    honors_only = 0
    for h in honors:
        fr = wiki_fr(h["team"], h["season"])
        rec = match_honor(h, fr, by_season[h["season"]], reg, title_pfr)
        if rec is None:
            p = None
            pfr = title_pfr.get(h["title"] or "")
            if pfr:
                p = reg.by_pfr.get(pfr)
            p = p or reg.near(h["name"], h["season"], h["gp"][0])
            pid = p["id"] if p else "wiki:" + (h["title"] or h["name"]).replace(" ", "_")
            if fr is None:
                continue
            key = (pid, h["season"], fr)
            if key not in recs:
                honors_only += 1
                gp = h["gp"] if h["gp"][0] != "DB" else ("DB", "DB")
                recs[key] = new_rec(pid, p["name"] if p else h["name"], h["season"], fr, gp, p)
                recs[key].update(status=None, height=(p or {}).get("ht"), weight=(p or {}).get("wt"), birth_date=(p or {}).get("born"))
                by_season[h["season"]].append(recs[key])
            rec = recs[key]
        hn = rec.setdefault("honors", {})
        rec["src"].add("wikipedia_honors")
        if h["kind"] == "probowl":
            hn["pro_bowl"] = True
            if h.get("jersey") and not rec.get("jersey"):
                rec["jersey"], rec["jersey_src"] = h["jersey"], "pro_bowl_page"
        else:
            for s in h["sel"]:
                second = "-2" in s
                lst = hn.setdefault("all_pro_2" if second else "all_pro", [])
                tag = s.split("-")[0]
                if tag not in lst:
                    lst.append(tag)
                if tag == "AP":
                    hn["ap2" if second else "ap1"] = True
            hn["all_pro_pos"] = h["gp"][1]
        if rec.get("wiki_title") is None and h.get("title"):
            rec["wiki_title"] = h["title"]
    for rec in recs.values():
        hn = rec.get("honors")
        if hn and hn.get("ap1"):
            hn.pop("ap2", None)
    print("honors with no roster row (honors-only records):", honors_only)

    # before 1999: kickers' and defenders' season tables from their Wikipedia articles
    titles = {}
    for rec in recs.values():
        t = rec.get("wiki_title") or pfr_title.get(rec.get("pfr_id") or "")
        if t:
            rec["wiki_title"] = t
            if rec["season"] < SPLIT and rec["group"] != "OL":
                titles[rec["id"]] = t
    print("kickers and defenders before 1999 with a Wikipedia article:", len(set(titles.values())))
    arts = wiki_pages(more, sorted(set(titles.values())))
    by_pid_season = defaultdict(list)
    for rec in recs.values():
        by_pid_season[(rec["id"], rec["season"])].append(rec)
    parsed = {}
    for (pid, y), lst in by_pid_season.items():
        t = titles.get(pid)
        if not t or y >= SPLIT:
            continue
        kind = "K" if lst[0]["group"] == "K" else "D"
        if (t, kind) not in parsed:
            parsed[(t, kind)] = season_tables(arts.get(t, ""), kind)
        rows = parsed[(t, kind)].get(y, [])
        for team, st in rows:
            fr = wiki_fr(team, y)
            tgt = [r for r in lst if r["team"] == fr] or (lst if len(lst) == 1 and len(rows) == 1 else [])
            for rec in tgt:
                stats = {k: v for k, v in st.items() if k not in ("g", "gs")}
                if kind == "K":
                    rec["kicking"] = stats
                else:
                    if "tkl" not in stats and ("tkl_solo" in stats or "tkl_ast" in stats):
                        stats["tkl"] = stats.get("tkl_solo", 0) + stats.get("tkl_ast", 0)
                    rec["defense"] = stats
                if st.get("g"):
                    rec["g"], rec["g_src"] = st["g"], "wikipedia"
                if st.get("gs") is not None:
                    rec["gs"], rec["gs_src"] = st["gs"], "wikipedia"
                rec["src"].add("wikipedia_career_table")

    settle_db(recs, reg)
    finish(recs, out_path)


def match_honor(h, fr, recs, reg, title_pfr):
    """The roster record an honors line is about: by Wikipedia title -> PFR id -> register id,
    then by name with the team, then by surname and first initial with the team, then by name
    across the league that season."""
    pfr = title_pfr.get(h["title"] or "")
    p = reg.by_pfr.get(pfr) if pfr else None
    if p:
        c = [r for r in recs if r["id"] == p["id"]]
        if c:
            return next((r for r in c if r["team"] == fr), c[0])
    k = nkey(h["name"])
    team = [r for r in recs if r["team"] == fr]
    for pool in (team, recs):
        c = [r for r in pool if nkey(r["name"]) == k]
        if len(c) > 1:
            c = [r for r in c if r["group"] == h["gp"][0] or "DB" in (r["group"], h["gp"][0])] or c
        if len(c) == 1:
            return c[0]
        if pool is team:
            parts = k.split()
            if parts:
                c = [r for r in team if nkey(r["name"]).split()[-1:] == parts[-1:] and nkey(r["name"])[:1] == k[:1]]
                if len(c) == 1:
                    return c[0]
                c = [r for r in team if nkey(r["name"]).split()[-1:] == parts[-1:] and (r["group"] == h["gp"][0] or "DB" in (r["group"], h["gp"][0]))]
                if len(c) == 1:
                    return c[0]
    return None


def settle_db(recs, reg):
    """A season listed only as 'DB' takes the player's CB or S from his other seasons, else the
    register's position, else (marked as a guess) S at 200 lb or more, CB below."""
    seen = defaultdict(Counter)
    for r in recs.values():
        if r["group"] in ("CB", "S"):
            seen[r["id"]][(r["group"], r["pos"])] += 1
    for r in recs.values():
        if r["group"] != "DB":
            continue
        if seen[r["id"]]:
            r["group"], r["pos"] = seen[r["id"]].most_common(1)[0][0]
            r["pos_src"] = "other_seasons"
            continue
        gp = classify((reg.by_id.get(r["id"]) or {}).get("pos"))
        if gp and gp[0] in ("CB", "S"):
            r["group"], r["pos"], r["pos_src"] = gp[0], gp[1], "register"
        else:
            heavy = (r.get("weight") or 0) >= 200
            r["group"], r["pos"], r["pos_src"] = ("S", "S", "guess_weight") if heavy else ("CB", "CB", "guess_weight")


def finish(recs, out_path):
    keep = []
    for r in recs.values():
        y = r["season"]
        hn = r.get("honors")
        if y >= SPLIT and not hn:
            # from 1999 a season counts when he played: active, a stat, or first string
            if not (r.get("g") or r.get("stat_g") or r.get("gs")):
                if not (y < S.ROSTER_FIRST and r.get("status") == "ACT"):
                    continue
        elif y < SPLIT and r.get("status") in ("CUT", "RET", "NWT") and not hn:
            continue
        r["team_abbr"] = S.identity(r["team"], y)[0]
        if not r.get("jersey"):
            p_j = None
            r.pop("jersey_src", None)
        if r.get("draft") is None:
            pass
        r["src"] = sorted(r["src"])
        for k in ("defense", "kicking"):
            if k in r:
                r[k] = {a: (int(b) if float(b).is_integer() else round(b, 1)) for a, b in r[k].items() if b}
                if not r[k]:
                    del r[k]
        keep.append({k: v for k, v in r.items() if v not in (None, "", [], {}) and k != "stat_g"})
    keep.sort(key=lambda r: (r["season"], r["team"], r["group"], r["name"]))
    report(keep)
    meta = {
        "built": time.strftime("%Y-%m-%d"),
        "groups": list(GROUPS),
        "notes": [
            "one record per player, season and franchise; id is the nflverse gsis id where the register has him, else a stand-in (nfl:name:birthdate or wiki:title)",
            "g: games. g_src active = weekly-roster active games (2002-2015, 2020-2025); min = games with a stat or first-string weeks (a lower bound); wikipedia = kicker article table. No games before 1999 except kickers' tables",
            "gs: weeks listed first string on the nflverse depth chart (2001-2025), not official starts",
            "defense: nflverse weekly stats 1999-2025 summed (regular season). tkl = solo + assists. None before 1999",
            "kicking: nflverse 1999-2025 (fg by distance), Wikipedia kicker articles before 1999 where they have a season table",
            "honors: all_pro / all_pro_2 list first- and second-team selectors (AP, NEA, PFWA, PFW, SN...); ap1 / ap2 the AP team; pro_bowl selected (incl. injury/declined; alternates only as replacements)",
            "Wikipedia-derived fields are CC BY-SA 4.0; nflverse fields CC BY 4.0; Wikidata CC0",
        ],
    }
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "players": keep}, f, separators=(",", ":"))
    print("wrote", out_path, len(keep), "player-seasons")


def report(rows):
    print()
    print("decade grp  seasons  w/stats  w/honors  honors-only  w/games  w/starts")
    cells = defaultdict(Counter)
    for r in rows:
        d = r["season"] // 10 * 10
        c = cells[(d, r["group"])]
        c["n"] += 1
        has = bool(r.get("defense") or r.get("kicking"))
        c["stats"] += has
        c["hon"] += bool(r.get("honors"))
        c["only"] += bool(r.get("honors")) and r["src"] == ["wikipedia_honors"]
        c["g"] += r.get("g") is not None
        c["gs"] += bool(r.get("gs"))
    for d in range(FIRST // 10 * 10, LAST + 1, 10):
        for g in GROUPS:
            c = cells[(d, g)]
            print("%ds %-3s %8d %8d %9d %12d %8d %9d" % (d, g, c["n"], c["stats"], c["hon"], c["only"], c["g"], c["gs"]))
    print()


if __name__ == "__main__":
    main()
