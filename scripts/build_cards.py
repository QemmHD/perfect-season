"""Build the Ultimate Team card data (Python 3 standard library only).

Every player-season (one per team stint) becomes a card line: raw stats, each stat's percentile
rank within its season and position group (the era adjustment the ratings code relies on),
honors, size, jersey number and the team's name and colors that season. On top of the season
lines come promo ("Hot Season") lines and about 120 legends per sport. See docs/ULTIMATE-TEAM.md
and src/ut/types.ts (CardLine); src/ut/cards.ts loads these files.

Outputs (minified, stored column by column, which gzips about a fifth smaller than rows):
src/data/cards-nba.json and src/data/cards-nfl.json, each
  {"sport", "n": number of season lines,
   "groups": [[group, statKeys, rkKeys]]          NBA one group "ALL"; NFL QB RB WR TE OL DL LB CB S K
   "players": [[pid, name, ht, wt]], "teams": [[fr, abbr, teamName, c1, c2]], "honors": [code],
   "cols": {player, season, team, pos ("SG/SF"), num, games, starts, group, honors ([index]),
            sparse (0/1)}: one array each, n long, line i at index i
   "stats": {group: {key: [value per line of that group, in line order]}},
   "rk": {group: {key: [integer permille 0-1000, or null, per line of that group]}},
   "promos": [[line index, boost, label]], "legends": [[line index, boost, "LEGEND"]]}
  Card ids are built by the loader: <sport>:<kind>:<season>:<pid>:<fr> (fr = franchise code; a
  stand-in pid has anything but [A-Za-z0-9._-] turned into '-'). Non-integer numbers carry 3
  significant digits; counts are exact.

---------------------------------------------------------------- NBA (cards-nba.json)
Source: Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets (the files
build_nba_data.py and build_game_attrs.py already use, read from .cache; the two award files are
fetched into .cache/ut on first use): Player Totals, Team Summaries, Team Totals, Player Career
Info (height, weight), Player Shooting (dunks, 0-3 ft), End of Season Teams
(All-NBA, All-Defense), Player Award Shares (MVP, DPOY, ROY winners).
Seasons 1960-2026 (a season is the year it ends: 1995-96 is 1996), NBA only. A traded player
gets one line per team stint; the combined TOT/2TM/3TM rows are skipped, as in the other scripts.
Eligible: the stint has 20+ games, or the season carries an honor.
Team: franchise code, abbreviation and colors from build_nba_data.py's FRANCHISE/IDENTITY (read
from that file), the team's name that season from Team Summaries (a 1985 Bulls card says CHI,
Chicago Bulls).
pos: the season's listed position first, then his other career positions (12%+ of his games).
num: the number he wore for that team that season: the APBR uniform-number lists (1960-2007),
then the nba.stats season rosters (1997-2026), both cached by build_game_attrs.py's sources if
present; where neither has him, src/data/nba-attrs.json's `num` for his line with that franchise
in that decade (the number he wore most there that decade, which adds ESPN's rosters from
2012-13; line key "<fr>-<decade>:<pid>", a season in the decade it ends in); else null.
ht/wt: inches/pounds from Player Career Info (one value per career).
stats (per game unless noted):
  g      games;  mpg minutes per game
  pts reb ast stl blk tov   per game (stl/blk from 1973-74, tov from 1977-78; null before)
  fg2    2-point FG% (0-1; before 1979-80 every field goal was a two)
  fg3    3-point FG%, null under 25 attempts;  a3 3-point attempts per game (0 before 1979-80)
  ft     FT%, null under 20 attempts;  fta free-throw attempts per game
  orb drb  offensive/defensive rebounds per game (from 1973-74)
  dunk   share of FG attempts that were dunks;  rim FG% from 0-3 feet (both 1996-97 on)
rk (0-1), among the season's stints with 20+ games (a line under 20 games is placed among them):
  pts    points per game
  reb ast stl blk   per 36 minutes
  val    the draft game's value (build_nba_data.py W weights on era-rated per-game stats: each
         stat scaled by the all-seasons league average over that season's; steals and blocks
         before 1973-74 estimated by the same least-squares model, fit on 1974-1985), per season
  fg3 ft among stints with a percentage (25+ 3PA, 20+ FTA)
honors: MVP DPOY ROY ALLNBA1-3 ALLDEF1-2 (award files; NBA only), and stat titles SCORING REB AST
  STL BLK: the league leader, by total through 1968-69, then per game among qualifiers (games
  played at 70/82 of the schedule through 2012-13 and 70% after, or the total floors pts 1400,
  reb 800, ast 400, stl 125, blk 100 scaled to the schedule). A season honor goes on the player's
  main stint that season (most games).
records: a qualifier's per-game pts/reb/ast/stl/blk, or total threes made, at or above every
  earlier season's (1946-47 on, steals and blocks from 1973-74, threes from 1979-80).

---------------------------------------------------------------- NFL (cards-nfl.json)
Sources: QB/RB/WR/TE rows exactly as nfl_sources.py and build_game_attrs.py make them (PFR season
tables 1970-2021 via fantasydatapros, nflverse weekly stats 1999-2025; the same ids, games and
traded-season handling). Defense, offensive line and kickers: .cache/nfl_players_more.json
(scripts/nfl_more_sources.py: nflverse rosters, stats, depth charts; Wikipedia honors and pre-1999
article tables). Offensive All-Pro and Pro Bowl picks come from the same cached Wikipedia pages
nfl_more_sources.py reads (its parsers, at offensive positions); AP MVP, OPOY and DPOY from the
Wikipedia lists of winners (fetched once into the same cache).
Seasons 1970-2025 (the year it starts). Groups: QB RB WR TE OL DL LB CB S K; pos: QB RB WR TE
OT OG C DE DT LB CB S K.
Team: nfl_sources.identity (a 1985 Raiders card is RAI, Los Angeles Raiders).
num: offense 1999+ the nflverse rosters (most weeks worn); otherwise the number on that season's
Pro Bowl page, or the register's number when every later season of his was with this franchise
(the register keeps a player's last number); defense/OL/K from nfl_players_more.json by the same
rule. ht/wt from the register / roster.
stats are season totals (nulls where the source doesn't say):
  all    dr dp  draft round and overall pick (register; null if undrafted or unknown)
  QB     att cmp yds td int  passing (cmp null 1992-1998: the PFR tables drop it); sk sacks taken
         (1999+); car ry rtd  rushing attempts, yards, TDs
  RB     car ry rtd; tgt rec recy rectd  targets (PFR 1992+, weekly 1999+), receptions, yards, TDs
  WR     tgt rec recy rectd car ry rtd;   TE  tgt rec recy rectd
  DL LB CB S  tkl tfl sk qbh int pd ff td  tackles, tackles for loss, sacks, QB hits, INTs,
         passes defensed, forced fumbles, defensive TDs. 1999+ nflverse (tfl null 2003-2011,
         qbh null 2003-2005: not kept). Before 1999 only from the player's Wikipedia table: sk and
         int (0 when absent), the rest null when absent; most pre-1999 defenders have none.
  OL     dr dp only (no blocking stats exist)
  K      fgm fga  field goals; fgm40 fga40  from 40-49 yards; fgm50 fga50  50+; lng longest;
         xpm xpa  extra points
games/starts: offense PFR (or nflverse) games, starts where the source has them; defense/OL/K
  active games (2002+), games with a stat (1999-2001), depth-chart first-string weeks as starts
  (2001+), or the Wikipedia table's G/GS; null before 1999 otherwise.
sparse: a line with no games and no stats (pre-1999 defenders and linemen, 1999-2000 linemen,
  whose only "games" in the source are the few they recorded a stat in, so they are left null).
rk (0-1), within the season and group, among the group's regulars in the pool (QB 6+ pass
  attempts per team game, RB 3+ touches per team game, WR/TE 1.25+ catches per team game, K 1+
  field goal try per two team games, defenders 8+ games of 16 (scaled to the schedule) with
  stats; OL every line). Counting stats are per game (games unknown: the team's games). A line
  outside the regulars is placed among them; a ratio is null under its minimum volume.
  QB  yds td ry (per game), ypa (yds/att), cmpp (cmp/att), intr (int/att, inverted: fewer is
      higher), rating (NFL passer rating; needs cmp), aya ((yds + 20 td - 45 int)/att);
      ratios need 50+ attempts
  RB  ry rtd rec recy (per game), ypc (30+ carries)
  WR TE  rec recy rectd tgt (per game), ypr (10+ catches), cr (rec/tgt, 20+ targets)
  DL  sk tfl qbh tkl ff;  LB tkl sk int tfl pd;  CB S  int pd tkl ff  (per game)
  K   fgp (FG%, 5+ tries), fgp50 (50+, 2+ tries), lng, fgm (per game), xpp (XP%, 5+ tries)
  all but K: gs (starts, among lines with starts known), draft (overall pick, earlier is higher;
      undrafted or unknown counts as pick 500)
  Before 1999 most defenders have no stats table (Wikipedia's tables are mostly of the notable
  ones): where under half a group's lines have stats, the rest count as zeros in the others'
  ranks, and have null ranks themselves.
honors: ALLPRO1 ALLPRO2 (AP first/second team), PB (Pro Bowl; offense none for 1970 and 1979,
  whose Pro Bowl pages list no rosters), MVP OPOY DPOY (AP), and stat titles PASSYDS RUSHYDS
  RECYDS (1970 on) and SACKS INTS (1999 on: before that only the notable defenders have stats
  and the true leader is often missing), the league leader in season totals (all teams summed;
  on the stint with most of it). 1999+ defensive stats are nflverse's play-by-play credits, which
  can differ from the official totals by a sack or two (1999: Kevin Carter 15, officially 17), so
  a title can differ from the record book.
records: a season total at or above every earlier one (pre-1970 records as the starting bar):
  pass yds/TD, rush yds/TD, catches, rec yds/TD, sacks (from 1983, after the first official
  season), interceptions.
Eligible: QB/RB/WR/TE 8+ games with real volume (QB 100 attempts, RB 50 touches, WR 20 catches,
  TE 15) or a full season's (QB 150 attempts, RB 100 touches, WR 35 / TE 30 catches); defenders
  2001+ 4+ first-string weeks, or 8+ games with production (25 tackles, 3 sacks, 2 INT or 6 passes
  defensed); 1999-2000 8+ games with production; K 8+ tries; before 1999 a stats table with 8+
  games; and with no games data (pre-1999 defenders and linemen, 1999-2000 linemen) players
  drafted in rounds 1-4 with 3+ seasons on that franchise's roster. Any honor qualifies.
  These minimums alone give ~55k lines, so a depth cap per team, season and group keeps the
  pool near 30k (honors always kept, then by volume, starts, production and draft slot): QB 2,
  RB 2, WR 3, TE 1, OL 5, DL 4, LB 3, CB 2, S 2, K 1; before 1999, when nothing tells starters
  apart, OL 2, DL 2, LB 1, CB 1, S 1.

---------------------------------------------------------------- both
Promo: one per qualifying season (MVP, ALLNBA1/ALLPRO1, a stat title, a record), on that season's
  line; boost 3 (title), 4 (1st team), 5 (MVP), 6 (record), +1 with two or more reasons, max 6;
  label e.g. 'MVP 1996', 'RUSHING TITLE 2003', 'SCORING RECORD 1962' (the top reason). An NFL
  first-team All-Pro lineman or kicker gets no promo for that alone, which keeps promos at 2-4% of
  the pool (NBA 2.4%, NFL 3.7%); OPOY/DPOY add to a promo's reasons but don't make one.
Legend: the top ~120 players by a career honors score, each at his best season by value (NBA:
  `val`; NFL: honors plus his main ranks), plus named greats always in. NBA score: MVP 10,
  ALLNBA1 5, ALLNBA2 3, ALLNBA3 2, DPOY 4, ALLDEF1 2, ALLDEF2 1, stat title 3, record 2, ROY 1,
  over his 1960+ seasons (a card's era; a 1950s star at 34 isn't a legend card). NFL score: MVP 10,
  OPOY/DPOY 6, ALLPRO1 5, ALLPRO2 2, PB 1, stat title 3, record 2. Named greats (NBA_MUST,
  NFL_MUST) are always in, so a sport has 120 plus any of those outside the top 120.
  boost = the legend's target (90 + 9 x his standing among legends) minus an estimate of the
  line's own overall on the 2K/Madden curve 56 + 43 p^3.4 (p: NBA rk.val; NFL his honors and
  ranks), kept within 2..8; label 'LEGEND'.

Note: Basketball-Reference and Pro-Football-Reference data here come from third-party scrapes
(sumitrodatta, fantasydatapros) the app already uses; Sports Reference's data-use policy
discourages building tools on scraped data. This script adds no scraping of their sites.

Usage: python3 scripts/build_cards.py [--cache DIR] [--sport nba|nfl]
  --cache  the repo's .cache (default ../.cache next to this script; in a git worktree pass the
           main checkout's .cache)
"""

import argparse
import bisect
import csv
import glob
import gzip
import html
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_game_attrs as B  # noqa: E402
import nfl_more_sources as M  # noqa: E402
import nfl_sources as S  # noqa: E402

DATA = os.path.join(HERE, "..", "src", "data")

# ---------------------------------------------------------------- shared


def num(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if v != v else v


def sig3(x):
    """3 significant digits for a non-integer, exact for an integer; None stays None."""
    if x is None:
        return None
    x = float(x)
    if x != x:
        return None
    if x.is_integer():
        return int(x)
    v = float("%.3g" % x)
    return int(v) if v.is_integer() else v


def div(a, b):
    return a / b if a is not None and b else None


def pid_key(pid):
    """Card ids are split on ':', so a stand-in id ('pfr:joe smith:1950') becomes 'pfr-joe-smith-1950'."""
    return re.sub(r"[^A-Za-z0-9._-]+", "-", pid).strip("-")


def nkey(n):
    return M.nkey(n or "")


class Ranker:
    """Percentile (0-1) of a value within a population, ties at their midpoint."""

    def __init__(self, values):
        self.v = sorted(v for v in values if v is not None)

    def __call__(self, x):
        if x is None or not self.v:
            return None
        lo = bisect.bisect_left(self.v, x)
        hi = bisect.bisect_right(self.v, x)
        return (lo + 0.5 * (hi - lo)) / len(self.v)


LINE_FIELDS = ["player", "season", "team", "pos", "num", "games", "starts", "group", "honors", "sparse"]


def permille(r):
    return None if r is None else int(round(r * 1000))


def solve(a, b):
    """Gaussian elimination for a small dense system a x = b."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c and m[c][c]:
                f = m[r][c] / m[c][c]
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    return [m[i][n] / m[i][i] if m[i][i] else 0.0 for i in range(n)]


def lstsq(xs, ys):
    k = len(xs[0])
    ata = [[sum(x[i] * x[j] for x in xs) for j in range(k)] for i in range(k)]
    aty = [sum(x[i] * y for x, y in zip(xs, ys)) for i in range(k)]
    return solve(ata, aty)


def promo_of(reasons, season):
    """(boost, label) for a promo from its reasons [(priority, boost, label text)]."""
    reasons = sorted(reasons, key=lambda r: (-r[1], r[0]))
    boost = min(6, reasons[0][1] + (1 if len(reasons) > 1 else 0))
    return boost, reasons[0][2] + " " + str(season)


def overall_est(p):
    """The 2K/Madden-shaped overall curve the ratings code uses for a 0-1 standing."""
    return 56 + 43 * max(0.0, min(1.0, p)) ** 3.4


def legend_boosts(chosen):
    """chosen: [(score, line, p)] best first -> [(line, boost)]: target 90-99 by standing."""
    out = []
    n = len(chosen)
    for i, (score, line, p) in enumerate(chosen):
        target = 90 + 9 * (1 - i / max(1, n - 1))
        out.append((line, max(2, min(8, int(round(target - overall_est(p)))))))
    return out


def write(sport, groups, lines, promos, legends):
    """lines: dicts with pid name ht wt season team(tuple) pos num games starts grp stats rk honors sparse.
    Written column by column (each field, stat and rank one array over the lines), which gzips
    about a fifth smaller than row by row."""
    players, pidx = [], {}
    teams, tidx = [], {}
    codes = sorted({h for ln in lines for h in ln["honors"]})
    hidx = {h: i for i, h in enumerate(codes)}
    gidx = {g: i for i, (g, _, _) in enumerate(groups)}
    cols = {k: [] for k in LINE_FIELDS}
    stats = {g: {k: [] for k in st} for g, st, _ in groups}
    ranks = {g: {k: [] for k in rk} for g, _, rk in groups}
    for ln in lines:
        pk = ln["pid"]
        if pk not in pidx:
            pidx[pk] = len(players)
            players.append([pk, ln["name"], ln["ht"], ln["wt"]])
        if ln["team"] not in tidx:
            tidx[ln["team"]] = len(teams)
            teams.append(list(ln["team"]))
        for k, v in (("player", pidx[pk]), ("season", ln["season"]), ("team", tidx[ln["team"]]), ("pos", "/".join(ln["pos"])),
                     ("num", ln["num"]), ("games", sig3(ln["games"])), ("starts", sig3(ln["starts"])), ("group", gidx[ln["grp"]]),
                     ("honors", sorted(hidx[h] for h in ln["honors"])), ("sparse", 1 if ln.get("sparse") else 0)):
            cols[k].append(v)
        for k, col in stats[ln["grp"]].items():
            col.append(sig3(ln["stats"].get(k)))
        for k, col in ranks[ln["grp"]].items():
            col.append(permille(ln["rk"].get(k)))
    index = {id(ln): i for i, ln in enumerate(lines)}
    out = {
        "sport": sport,
        "n": len(lines),
        "groups": [[g, st, rk] for g, st, rk in groups],
        "players": players,
        "teams": teams,
        "honors": codes,
        "cols": cols,
        "stats": stats,
        "rk": ranks,
        "promos": [[index[id(ln)], b, lab] for ln, b, lab in promos],
        "legends": [[index[id(ln)], b, "LEGEND"] for ln, b in legends],
    }
    path = os.path.join(DATA, "cards-%s.json" % sport)
    raw = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(raw)
    gz = len(gzip.compress(raw.encode("utf-8"), 9))
    print("%s: %d season lines, %d promos, %d legends; %d bytes, %d gzipped" % (sport, len(lines), len(promos), len(legends), len(raw.encode("utf-8")), gz))


# ---------------------------------------------------------------- NBA

NBA_STATS = ["g", "mpg", "pts", "reb", "ast", "stl", "blk", "tov", "fg2", "fg3", "a3", "ft", "fta", "orb", "drb", "dunk", "rim"]
NBA_RK = ["pts", "reb", "ast", "stl", "blk", "val", "fg3", "ft"]
NBA_FIRST, NBA_STL_BLK, NBA_THREE, NBA_ORB, NBA_TOV, NBA_SHOOT = 1960, 1974, 1980, 1974, 1978, 1997
NBA_MIN_G = 20
TITLE_FLOOR = {"pts": 1400, "trb": 800, "ast": 400, "stl": 125, "blk": 100}
NBA_TITLES = [("pts", "SCORING", "SCORING TITLE", 1947), ("trb", "REB", "REBOUNDING TITLE", 1951), ("ast", "AST", "ASSISTS TITLE", 1947),
              ("stl", "STL", "STEALS TITLE", NBA_STL_BLK), ("blk", "BLK", "BLOCKS TITLE", NBA_STL_BLK)]
NBA_RECORDS = [("pts", "SCORING RECORD"), ("trb", "REBOUNDING RECORD"), ("ast", "ASSISTS RECORD"), ("stl", "STEALS RECORD"),
               ("blk", "BLOCKS RECORD"), ("x3p", "3-POINT RECORD")]
NBA_SCORE = {"MVP": 10, "ALLNBA1": 5, "ALLNBA2": 3, "ALLNBA3": 2, "DPOY": 4, "ALLDEF1": 2, "ALLDEF2": 1, "ROY": 1,
             "SCORING": 3, "REB": 3, "AST": 3, "STL": 3, "BLK": 3, "RECORD": 2}
NBA_MUST = ["Michael Jordan", "Kareem Abdul-Jabbar", "Magic Johnson", "Larry Bird", "Bill Russell", "Wilt Chamberlain",
            "LeBron James", "Kobe Bryant", "Tim Duncan", "Shaquille O'Neal", "Hakeem Olajuwon", "Stephen Curry",
            "Kevin Durant", "Julius Erving", "Jerry West", "Oscar Robertson"]
NBA_LEGENDS = 120


def nba_file(cache, name, *dirs):
    """A cached Basketball-Reference dataset file, else fetched into cache/ut."""
    fn = name.replace(" ", "_")
    for d in dirs:
        p = os.path.join(cache, d, fn)
        if os.path.exists(p):
            return p
    return B.download(B.NBA_BASE + name.replace(" ", "%20"), os.path.join(cache, "ut", fn))


def norm_positions(pos):
    out = []
    for p in (pos or "").replace("/", "-").split("-"):
        p = p.strip().upper()
        if p == "G":
            out += ["PG", "SG"]
        elif p == "F":
            out += ["SF", "PF"]
        elif p in ("PG", "SG", "SF", "PF", "C"):
            out.append(p)
    return out


def nba_numbers(cache, stints, names):
    """(season, franchise, pid) -> jersey number: the APBR uniform-number lists (season, then
    team, then '23 Michael Jordan, 33 Scottie Pippen'), preferred through 2006-07; the nba.stats
    season rosters (season = the year it ends) from 1997, preferred from 2007-08. Matched by
    name within the team-season, else by last name and first initial."""
    roster = defaultdict(list)  # (season, fr) -> [(pid, name key)]
    season_names = defaultdict(lambda: defaultdict(set))  # season -> name key -> {(pid, fr)}
    for s in stints:
        k = nkey(s["name"])
        roster[(s["season"], s["fr"])].append((s["pid"], k))
        season_names[s["season"]][k].add((s["pid"], s["fr"]))

    def match(season, fr, name):
        k = nkey(re.sub(r"\(.*?\)", "", name))
        team = roster.get((season, fr), [])
        c = {pid for pid, n in team if n == k}
        if len(c) == 1:
            return c.pop()
        parts = k.split()
        if not parts:
            return None
        c = {pid for pid, n in team if n.split()[-1:] == parts[-1:] and n[:1] == k[:1]}
        if len(c) == 1:
            return c.pop()
        c = {pid for pid, n in team if n.split()[-1:] == parts[-1:]}
        return c.pop() if len(c) == 1 else None

    apbr, stats = {}, {}
    for path in sorted(glob.glob(os.path.join(cache, "attrs", "**", "*nmbr*.html"), recursive=True)):
        text = open(path, encoding="latin-1").read()
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"<br\s*/?>|</p>|<p[^>]*>", "\n", text, flags=re.I)
        text = html.unescape(re.sub(r"<[^>]+>", "", text))
        season, fr = None, None
        for block in re.split(r"\n\s*\n", text):
            lines = [x.strip() for x in block.split("\n") if x.strip()]
            for i, line in enumerate(lines):
                m = re.match(r"^(?:(NBA|ABA|BAA) )?(\d{4})-(\d{2})(?: (NBA|ABA|BAA))?$", line)  # "1990-91 NBA" or "NBA 1960-61"
                if m:
                    season = int(m.group(2)) + 1 if (m.group(1) or m.group(4) or "NBA") == "NBA" else None
                    fr = None
                    continue
                if season is None:
                    continue
                if re.fullmatch(r"[A-Z][A-Z0-9 .'&-]+", line):
                    fr = names.get((season, line.upper()))
                    if fr is None:  # a nickname-only match ("SUPERSONICS")
                        nick = [f for (s, n), f in names.items() if s == season and n.split()[-1:] == line.upper().split()[-1:]]
                        fr = nick[0] if len(set(nick)) == 1 else None
                    continue
                if fr is None:
                    continue
                for n, who in re.findall(r"(?:^|,)\s*(\d{1,2})\s+([^,]+)", line):
                    pid = match(season, fr, who)
                    if pid and (season, fr, pid) not in apbr:
                        apbr[(season, fr, pid)] = int(n)
    team_votes = defaultdict(Counter)
    rows = []
    for path in sorted(glob.glob(os.path.join(cache, "attrs", "**", "rosters_*.csv"), recursive=True)):
        rdr = csv.DictReader(open(path, encoding="utf-8"))
        if not {"team_id", "season", "player", "num"} <= set(rdr.fieldnames or []):
            continue
        for r in rdr:
            season = int(num(r["season"]) or 0)
            rows.append((season, r["team_id"], r["player"], r["num"]))
            c = season_names[season].get(nkey(r["player"]), set())
            if len({pid for pid, _ in c}) == 1 and len(c) == 1:
                team_votes[r["team_id"]][next(iter(c))[1]] += 1
    team_fr = {t: v.most_common(1)[0][0] for t, v in team_votes.items()}
    for season, tid, name, n in rows:
        fr = team_fr.get(tid)
        n = (n or "").strip()
        if fr is None or not re.fullmatch(r"\d{1,2}", n):
            continue
        pid = match(season, fr, name)
        if pid:
            stats.setdefault((season, fr, pid), int(n))
    out = {}
    for key in set(apbr) | set(stats):
        first, second = (apbr, stats) if key[0] <= 2007 else (stats, apbr)
        out[key] = first.get(key, second.get(key))
    print("nba numbers: %d from APBR lists, %d from nba.stats rosters" % (len(apbr), len(stats)))
    return out


def attrs_numbers():
    """build_game_attrs.py's per-line jersey numbers ("<fr>-<decade>:<pid>" -> number), or {}."""
    path = os.path.join(DATA, "nba-attrs.json")
    if not os.path.exists(path):
        return {}
    d = json.load(open(path, encoding="utf-8"))
    if "num" not in d["fields"]:
        return {}
    i = d["fields"].index("num")
    return {k: v[i] for k, v in d["lines"].items() if v[i] is not None}


def build_nba(cache):
    franchise, identity, w = B.from_build_script("build_nba_data.py", "FRANCHISE", "IDENTITY", "W")
    totals = nba_file(cache, "Player Totals.csv", "raw", "attrs", "ut")
    summaries = nba_file(cache, "Team Summaries.csv", "raw", "ut")
    team_totals = nba_file(cache, "Team Totals.csv", "raw", "ut")
    info = nba_file(cache, "Player Career Info.csv", "attrs", "ut")
    shooting = nba_file(cache, "Player Shooting.csv", "attrs", "ut")
    eos = nba_file(cache, "End of Season Teams.csv", "ut", "attrs")
    shares = nba_file(cache, "Player Award Shares.csv", "ut", "attrs")

    body = {}
    for r in csv.DictReader(open(info, encoding="utf-8")):
        body[r["player_id"]] = (num(r["ht_in_in"]), num(r["wt"]))
    shoot = {}
    for r in csv.DictReader(open(shooting, encoding="utf-8")):
        if r["lg"] == "NBA":
            shoot[(int(r["season"]), r["player_id"], r["team"])] = r
    names, team_name, team_games = {}, {}, Counter()
    for r in csv.DictReader(open(summaries, encoding="utf-8")):
        if r["lg"] not in ("NBA", "BAA"):
            continue
        season = int(r["season"])
        team_games[season] = max(team_games[season], int(num(r["w"]) or 0) + int(num(r["l"]) or 0))
        if r["abbreviation"] in franchise:
            nm = r["team"].rstrip("*").strip()
            team_name[(season, r["abbreviation"])] = nm
            names[(season, nm.upper())] = franchise[r["abbreviation"]]

    # every NBA/BAA player-season, one row per player (the combined row for a traded player): titles and records
    by_ps = defaultdict(list)
    stints = []
    pos_games = defaultdict(Counter)
    for r in csv.DictReader(open(totals, encoding="utf-8")):
        if r["lg"] not in ("NBA", "BAA"):
            continue
        season = int(r["season"])
        by_ps[(season, r["player_id"])].append(r)
        g = num(r["g"]) or 0
        if r["lg"] != "NBA" or r["team"] not in franchise or g <= 0:
            continue
        listed = norm_positions(r["pos"])
        for p in listed:
            pos_games[r["player_id"]][p] += g / len(listed)
        if season < NBA_FIRST:
            continue
        stints.append({"season": season, "pid": r["player_id"], "name": r["player"], "team": r["team"], "fr": franchise[r["team"]], "r": r, "g": g})
    season_rows = {}
    for key, rows in by_ps.items():
        tot = [r for r in rows if r["team"] in ("TOT",) or r["team"].endswith("TM")]
        season_rows[key] = tot[0] if tot else rows[0]

    # honors from the award files, by (season, pid)
    honors = defaultdict(set)
    for r in csv.DictReader(open(eos, encoding="utf-8")):
        if r["lg"] != "NBA":
            continue
        n = {"1st": "1", "2nd": "2", "3rd": "3"}.get(r["number_tm"])
        if r["type"] == "All-NBA" and n:
            honors[(int(r["season"]), r["player_id"])].add("ALLNBA" + n)
        elif r["type"] == "All-Defense" and n in ("1", "2"):
            honors[(int(r["season"]), r["player_id"])].add("ALLDEF" + n)
    for r in csv.DictReader(open(shares, encoding="utf-8")):
        code = {"nba mvp": "MVP", "nba dpoy": "DPOY", "nba roy": "ROY"}.get(r["award"])
        if code and r["winner"] == "TRUE":
            honors[(int(r["season"]), r["player_id"])].add(code)

    # stat titles and records over every season
    def qualifies(r, season, k):
        g = num(r["g"]) or 0
        tg = team_games[season] or 82
        share = 70 / 82 if season <= 2013 else 0.70
        floor = TITLE_FLOOR.get(k)
        return g >= share * tg - 1e-9 or (floor is not None and (num(r[k]) or 0) >= floor * tg / 82)

    records = defaultdict(list)  # (season, pid) -> [label]
    best = {}
    by_season = defaultdict(list)
    for (season, pid), r in season_rows.items():
        by_season[season].append((pid, r))
    for season in sorted(by_season):
        rows = by_season[season]
        for k, code, _, first in NBA_TITLES:
            if season < first:
                continue
            if season <= 1969:
                vals = [(num(r[k]) or 0, pid) for pid, r in rows]
            else:
                vals = [((num(r[k]) or 0) / (num(r["g"]) or 1), pid) for pid, r in rows if qualifies(r, season, k)]
            if vals:
                top = max(v for v, _ in vals)
                for v, pid in vals:
                    if v == top and v > 0:
                        honors[(season, pid)].add(code)
        for k, label in NBA_RECORDS:
            if (k in ("stl", "blk") and season < NBA_STL_BLK) or (k == "x3p" and season < NBA_THREE):
                continue
            if k == "x3p":
                vals = [(num(r[k]) or 0, pid) for pid, r in rows]
            else:
                vals = [((num(r[k]) or 0) / (num(r["g"]) or 1), pid) for pid, r in rows if (num(r["g"]) or 0) >= 0.7 * (team_games[season] or 82)]
            if not vals:
                continue
            top = max(v for v, _ in vals)
            if k not in best:  # the first season a stat was kept sets the bar, it isn't a record
                best[k] = top
                continue
            if top > 0 and top >= best[k]:
                for v, pid in vals:
                    if v == top:
                        records[(season, pid)].append(label)
            best[k] = max(best.get(k, 0), top)

    # era-rated value (build_nba_data.py): league per-team-game averages, the 1960+ mean as the scale
    tot = defaultdict(lambda: defaultdict(float))
    for r in csv.DictReader(open(team_totals, encoding="utf-8")):
        if r["lg"] != "NBA" or r["abbreviation"] in ("", "NA"):
            continue
        season, g = int(r["season"]), num(r["g"]) or 0
        for k, col in (("pts", "pts"), ("reb", "trb"), ("ast", "ast"), ("stl", "stl"), ("blk", "blk")):
            v = num(r[col])
            if v is not None and g:
                tot[season][k] += v
                tot[season]["g_" + k] += g
    league = {s: {k: t[k] / t["g_" + k] for k in w if t.get("g_" + k)} for s, t in tot.items()}
    scale = {k: sum(v[k] for s, v in league.items() if s >= NBA_FIRST and k in v) / len([1 for s, v in league.items() if s >= NBA_FIRST and k in v]) for k in w}
    for s in stints:
        r, lg = s["r"], league[s["season"]]
        raw = {"pts": num(r["pts"]), "reb": num(r["trb"]), "ast": num(r["ast"]), "stl": num(r["stl"]), "blk": num(r["blk"])}
        s["adj"] = {k: (raw[k] * scale[k] / lg[k] if raw[k] is not None and k in lg else None) for k in w}

    def grp(pos):
        p = pos.split("-")[0]
        return 0 if p in ("PG", "SG", "G") else 1 if p in ("SF", "PF", "F") else 2

    def feats(s):
        g, gp = s["g"], grp(s["r"]["pos"])
        return [1.0, s["adj"]["pts"] / g, s["adj"]["reb"] / g, s["adj"]["ast"] / g, 1.0 if gp == 0 else 0.0, 1.0 if gp == 2 else 0.0]

    fit = [s for s in stints if NBA_STL_BLK <= s["season"] <= 1985 and s["g"] >= 20]
    xs = [feats(s) for s in fit]
    model = {k: lstsq(xs, [s["adj"][k] / s["g"] for s in fit]) for k in ("stl", "blk")}
    for s in stints:
        g = s["g"]
        rated = {}
        for k in w:
            v = s["adj"][k]
            if v is None:  # steals/blocks not recorded: the estimate, as build_nba_data.py makes it
                v = max(0.0, sum(a * b for a, b in zip(feats(s), model[k]))) * g
            rated[k] = v / g
        s["val"] = sum(rated[k] * w[k] for k in w)

    # career positions (12%+ of his games, up to 3)
    def career_pos(pid):
        by = pos_games.get(pid)
        if not by:
            return []
        total = sum(by.values())
        ranked = sorted(by.items(), key=lambda kv: -kv[1])
        return [p for p, gm in ranked if gm / total >= 0.12][:3] or [ranked[0][0]]

    main_stint = {}
    for s in stints:
        key = (s["season"], s["pid"])
        if key not in main_stint or (s["g"], num(s["r"]["mp"]) or 0) > (main_stint[key]["g"], num(main_stint[key]["r"]["mp"]) or 0):
            main_stint[key] = s

    numbers = nba_numbers(cache, stints, names)
    decade_num = attrs_numbers()
    filled = 0
    lines = []
    for s in stints:
        r, season, g = s["r"], s["season"], s["g"]
        main = main_stint[(season, s["pid"])] is s
        hn = set(honors.get((season, s["pid"]), ())) if main else set()
        recs = records.get((season, s["pid"]), []) if main else []
        if g < NBA_MIN_G and not hn:
            continue
        mp = num(r["mp"])
        fg, fga, x3p, x3pa = num(r["fg"]), num(r["fga"]), num(r["x3p"]), num(r["x3pa"])
        if season < NBA_THREE:
            x3p = x3pa = 0.0
        ftm, fta = num(r["ft"]), num(r["fta"])
        st = {
            "g": g, "mpg": div(mp, g), "pts": div(num(r["pts"]), g), "reb": div(num(r["trb"]), g), "ast": div(num(r["ast"]), g),
            "stl": div(num(r["stl"]), g) if season >= NBA_STL_BLK else None,
            "blk": div(num(r["blk"]), g) if season >= NBA_STL_BLK else None,
            "tov": div(num(r["tov"]), g) if season >= NBA_TOV else None,
            "fg2": div(fg - x3p, fga - x3pa) if None not in (fg, fga, x3p, x3pa) and fga - x3pa > 0 else None,
            "fg3": div(x3p, x3pa) if x3pa and x3pa >= 25 else None,
            "a3": div(x3pa, g) if x3pa is not None else None,
            "ft": div(ftm, fta) if fta and fta >= 20 and ftm is not None else None,
            "fta": div(fta, g),
            "orb": div(num(r["orb"]), g) if season >= NBA_ORB else None,
            "drb": div(num(r["drb"]), g) if season >= NBA_ORB else None,
            "dunk": None, "rim": None,
        }
        sh = shoot.get((season, s["pid"], s["team"]))
        if season >= NBA_SHOOT and sh is not None:
            st["dunk"] = num(sh["percent_dunks_of_fga"])
            f03 = num(sh["percent_fga_from_x0_3_range"])
            st["rim"] = num(sh["fg_percent_from_x0_3_range"]) if f03 else None
        per36 = {k: div(num(r[col]), mp) * 36 if div(num(r[col]), mp) is not None else None
                 for k, col in (("reb", "trb"), ("ast", "ast"), ("stl", "stl"), ("blk", "blk"))}
        if season < NBA_STL_BLK:
            per36["stl"] = per36["blk"] = None
        pos = norm_positions(r["pos"])[:1]
        pos += [p for p in career_pos(s["pid"]) if p not in pos]
        abbr, c1, c2 = identity[s["team"]]
        ht, wt = body.get(s["pid"], (None, None))
        n = numbers.get((season, s["fr"], s["pid"]))
        if n is None:
            n = decade_num.get("%s-%d:%s" % (s["fr"], season // 10 * 10, s["pid"]))
            filled += n is not None
        lines.append({
            "pid": s["pid"], "name": s["name"], "ht": sig3(ht), "wt": sig3(wt), "season": season, "fr": s["fr"],
            "team": (s["fr"], abbr, team_name.get((season, s["team"]), abbr), c1, c2), "pos": pos or ["SF"],
            "num": n, "games": g, "starts": num(r["gs"]), "grp": "ALL",
            "stats": st, "honors": hn, "records": recs, "val": s["val"],
            "_rk": {"pts": st["pts"], **per36, "val": s["val"], "fg3": st["fg3"], "ft": st["ft"]},
        })

    print("nba numbers from nba-attrs.json (where the season lists have none): %d; known on %.1f%% of lines"
          % (filled, 100.0 * sum(ln["num"] is not None for ln in lines) / len(lines)))

    # ranks within the season among stints with 20+ games
    by_season = defaultdict(list)
    for ln in lines:
        by_season[ln["season"]].append(ln)
    for season, lst in by_season.items():
        pop = [ln for ln in lst if ln["games"] >= NBA_MIN_G]
        rankers = {k: Ranker([ln["_rk"][k] for ln in pop]) for k in NBA_RK}
        for ln in lst:
            ln["rk"] = {k: rankers[k](ln["_rk"][k]) for k in NBA_RK}

    # promos
    promos = []
    for ln in lines:
        reasons = []
        if "MVP" in ln["honors"]:
            reasons.append((0, 5, "MVP"))
        for lab in ln["records"]:
            reasons.append((1, 6, lab))
        if "ALLNBA1" in ln["honors"]:
            reasons.append((3, 4, "ALL-NBA 1ST"))
        for _, code, lab, _ in NBA_TITLES:
            if code in ln["honors"]:
                reasons.append((4, 3, lab))
        if reasons:
            b, lab = promo_of(reasons, ln["season"])
            promos.append((ln, b, lab))

    # legends: career score over every NBA season (pre-1960 honors included), peak = best val
    score = Counter()
    for (season, pid), hn in honors.items():
        if season >= NBA_FIRST:
            for h in hn:
                score[pid] += NBA_SCORE.get(h, 0)
    for (season, pid), recs in records.items():
        if season >= NBA_FIRST:
            score[pid] += NBA_SCORE["RECORD"] * len(recs)
    peak = {}
    for ln in lines:
        if ln["games"] >= NBA_MIN_G and (ln["pid"] not in peak or ln["val"] > peak[ln["pid"]]["val"]):
            peak[ln["pid"]] = ln
    ranked = sorted((pid for pid in score if pid in peak), key=lambda p: (-score[p], p))
    chosen = ranked[:NBA_LEGENDS]
    for nm in NBA_MUST:
        pids = [pid for pid, ln in peak.items() if ln["name"] == nm]
        if not pids:
            sys.exit("nba legend missing from the data: " + nm)
        pid = max(pids, key=lambda p: score[p])
        if pid not in chosen:
            chosen.append(pid)
    chosen.sort(key=lambda p: (-score[p], p))
    legends = legend_boosts([(score[p], peak[p], peak[p]["rk"]["val"] or 0) for p in chosen])

    lines.sort(key=lambda ln: (ln["season"], ln["fr"], ln["pid"]))
    return [("ALL", NBA_STATS, NBA_RK)], lines, promos, legends, score


# ---------------------------------------------------------------- NFL

GROUP_STATS = {
    "QB": ["att", "cmp", "yds", "td", "int", "sk", "car", "ry", "rtd", "dr", "dp"],
    "RB": ["car", "ry", "rtd", "tgt", "rec", "recy", "rectd", "dr", "dp"],
    "WR": ["tgt", "rec", "recy", "rectd", "car", "ry", "rtd", "dr", "dp"],
    "TE": ["tgt", "rec", "recy", "rectd", "dr", "dp"],
    "OL": ["dr", "dp"],
    "DL": ["tkl", "tfl", "sk", "qbh", "int", "pd", "ff", "td", "dr", "dp"],
    "LB": ["tkl", "tfl", "sk", "qbh", "int", "pd", "ff", "td", "dr", "dp"],
    "CB": ["tkl", "tfl", "sk", "qbh", "int", "pd", "ff", "td", "dr", "dp"],
    "S": ["tkl", "tfl", "sk", "qbh", "int", "pd", "ff", "td", "dr", "dp"],
    "K": ["fgm", "fga", "fgm40", "fga40", "fgm50", "fga50", "lng", "xpm", "xpa", "dr", "dp"],
}
GROUP_RK = {
    "QB": ["yds", "td", "ypa", "cmpp", "intr", "rating", "aya", "ry", "gs", "draft"],
    "RB": ["ry", "ypc", "rtd", "rec", "recy", "gs", "draft"],
    "WR": ["rec", "recy", "rectd", "ypr", "tgt", "cr", "gs", "draft"],
    "TE": ["rec", "recy", "rectd", "ypr", "tgt", "cr", "gs", "draft"],
    "OL": ["gs", "draft"],
    "DL": ["sk", "tfl", "qbh", "tkl", "ff", "gs", "draft"],
    "LB": ["tkl", "sk", "int", "tfl", "pd", "gs", "draft"],
    "CB": ["int", "pd", "tkl", "ff", "gs", "draft"],
    "S": ["int", "pd", "tkl", "ff", "gs", "draft"],
    "K": ["fgp", "fgp50", "lng", "fgm", "xpp"],
}
GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K"]
CAP = {"QB": 2, "RB": 2, "WR": 3, "TE": 1, "OL": 5, "DL": 4, "LB": 3, "CB": 2, "S": 2, "K": 1}
CAP_OLD = {"OL": 2, "DL": 2, "LB": 1, "CB": 1, "S": 1}  # defense and line before 1999: no games or starts to go by
DEF_GROUPS = ("DL", "LB", "CB", "S")
MORE_POS = {"T": "OT", "G": "OG", "C": "C", "DE": "DE", "DT": "DT", "NT": "DT", "LB": "LB", "OLB": "LB", "ILB": "LB",
            "MLB": "LB", "CB": "CB", "S": "S", "SS": "S", "FS": "S", "K": "K"}
NFL_TITLES = [("pass_yds", "PASSYDS", "PASSING TITLE", 1970), ("rush_yds", "RUSHYDS", "RUSHING TITLE", 1970),
              ("rec_yds", "RECYDS", "RECEIVING TITLE", 1970), ("sacks", "SACKS", "SACK TITLE", 1999), ("int", "INTS", "INT TITLE", 1999)]
# (sack and interception titles only from 1999: before that only the notable defenders have stats, and the leader is often missing)
# the record each key stood at going into 1970 (sacks: official from 1982, so the bar is 1982's best)
NFL_RECORDS = [("pass_yds", "PASSING RECORD", 4007, 1970), ("pass_td", "TD PASS RECORD", 36, 1970),
               ("rush_yds", "RUSHING RECORD", 1863, 1970), ("rush_td", "RUSHING TD RECORD", 19, 1970),
               ("rec", "CATCHES RECORD", 101, 1970), ("rec_yds", "RECEIVING RECORD", 1746, 1970),
               ("rec_td", "TD CATCH RECORD", 17, 1970), ("sacks", "SACK RECORD", 11.5, 1983), ("int", "INT RECORD", 14, 1970)]
NFL_SCORE = {"MVP": 10, "OPOY": 6, "DPOY": 6, "ALLPRO1": 5, "ALLPRO2": 2, "PB": 1,
             "PASSYDS": 3, "RUSHYDS": 3, "RECYDS": 3, "SACKS": 3, "INTS": 3, "RECORD": 2}
NFL_SEASON_PTS = {"MVP": 10, "OPOY": 6, "DPOY": 6, "ALLPRO1": 5, "ALLPRO2": 3, "PB": 1,
                  "PASSYDS": 3, "RUSHYDS": 3, "RECYDS": 3, "SACKS": 3, "INTS": 3}
NFL_MUST = [("Joe Montana", "QB"), ("Tom Brady", "QB"), ("Peyton Manning", "QB"), ("Jerry Rice", "WR"), ("Walter Payton", "RB"),
            ("Barry Sanders", "RB"), ("Lawrence Taylor", "LB"), ("Reggie White", "DL"), ("Deion Sanders", "CB"),
            ("Ronnie Lott", None), ("Anthony Munoz", "OL"), ("Jim Otto", "OL"), ("Dan Marino", "QB"), ("John Elway", "QB"),
            ("Emmitt Smith", "RB"), ("Joe Greene", "DL"), ("Dick Butkus", "LB"), ("Ray Lewis", "LB"), ("Randy Moss", "WR"),
            ("Bruce Smith", "DL"), ("Mike Singletary", "LB"), ("Jack Lambert", "LB"), ("Mel Blount", "CB"),
            ("Franco Harris", "RB"), ("Terry Bradshaw", "QB"), ("Roger Staubach", "QB"), ("O.J. Simpson", "RB"),
            ("Earl Campbell", "RB"), ("Eric Dickerson", "RB"), ("John Hannah", "OL"), ("Jackie Slater", "OL"),
            ("Mike Webster", "OL"), ("Ed Reed", "S"), ("Troy Polamalu", "S"), ("Rod Woodson", "CB"), ("Aaron Donald", "DL"),
            ("J.J. Watt", "DL"), ("Patrick Mahomes", "QB"), ("Tony Gonzalez", "TE"), ("Kellen Winslow", "TE"),
            ("Morten Andersen", "K"), ("Adam Vinatieri", "K")]
NFL_LEGENDS = 120


def nfl_identity(fr, season):
    abbr, name, c1, c2 = S.identity(fr, season)
    return (fr, abbr, name, c1, c2)


OFF_POS = [(r"quarterback", "QB"), (r"running back|halfback|fullback", "RB"), (r"wide receiver|flanker|split end|\breceiver", "WR"),
           (r"tight end", "TE")]
OFF_LIST = {"qb": "QB", "quarterback": "QB", "quarterbacks": "QB", "rb": "RB", "running back": "RB", "running backs": "RB",
            "hb": "RB", "fb": "RB", "fullback": "RB", "halfback": "RB", "wr": "WR", "wide receiver": "WR", "wide receivers": "WR",
            "receivers": "WR", "te": "TE", "tight end": "TE", "tight ends": "TE"}


def off_pos(cell):
    t = M.plain(cell).lower()
    # a position cell is a few words; a whole roster column ("Quarterbacks * 12 Roger Staubach ...") is not
    if not t or len(t.split()) > 5 or re.search(r"return|punter|kicker|special|long snap", t):
        return None
    for pat, p in OFF_POS:
        if re.search(pat, t):
            return (p, p)
    return None


def off_list(label):
    t = M.plain(label).lower().strip(" :")
    if t in OFF_LIST:
        return (OFF_LIST[t], OFF_LIST[t])
    if t in M.LISTPOS or t in ("p", "kr", "pr", "st", "k", "ls"):
        return None
    return off_pos(label)


def offense_honors(pages):
    """All-Pro and Pro Bowl picks at QB/RB/WR/TE, read with nfl_more_sources.py's own parsers
    (which skip those positions) by swapping in the offensive position readers."""
    saved = M.honor_pos, M.list_pos
    M.honor_pos, M.list_pos = off_pos, off_list
    try:
        out = []
        for y in range(S.FIRST_SEASON, S.LAST_SEASON + 1):
            out += M.allpro(pages["%d All-Pro Team" % y], y)
            out += M.probowl(pages[M.probowl_title(y)], y)
    finally:
        M.honor_pos, M.list_pos = saved
    return out


def award_winners(text):
    """[(season, name, wiki title)] from a Wikipedia list of AP award winners."""
    out = []
    for _, rows in M.tables(text):
        for row in rows:
            if len(row) < 2:
                continue
            m = re.search(r"\[\[(\d{4}) (?:NFL|AFL) season", row[0][2])
            if not m:
                continue
            for piece in re.split(r"<br\s*/?>", row[1][2], flags=re.I):
                piece = re.sub(r"\{\{\s*small\s*\|[^}]*\}\}", "", piece, flags=re.I)
                sm = re.search(r"\{\{\s*sortname\s*\|([^}]*)\}\}", piece, re.I)
                if sm:
                    args = [a.strip() for a in sm.group(1).split("|")]
                    pos_args = [a for a in args if "=" not in a]
                    name = " ".join(pos_args[:2])
                    dab = [a.split("=", 1)[1] for a in args if a.startswith("dab=")]
                    title = pos_args[2] if len(pos_args) > 2 else name + (" (%s)" % dab[0] if dab else "")
                else:
                    lk = M.LINK.search(piece)
                    if not lk:
                        continue
                    title, name = lk.group(1), lk.group(2) or lk.group(1)
                out.append((int(m.group(1)), M.plain(name), title))
    return out


def build_nfl(cache):
    raw = os.path.join(cache, "nfl")
    more_dir = os.path.join(raw, "more")
    players_csv = os.path.join(raw, "players.csv")
    reg = S.Register(players_csv)
    regm = M.Register(players_csv)
    title_pfr, _, _ = M.wikidata_pfr(more_dir)
    tg_of = {k: t["g"] for k, t in S.team_seasons(S.team_games(raw)).items()}
    season_tg = Counter()
    for (season, _), g in tg_of.items():
        season_tg[season] = max(season_tg[season], g)

    # ---- offense: the rows nfl_sources.py / build_game_attrs.py make
    print("reading offense (nfl_sources)")
    early = B.pfr_rows(raw, reg, range(S.FIRST_SEASON, S.SPLIT))
    late, links, _ = B.verse_rows(raw, reg)
    S.link_careers(early, late, links, reg)
    off_rows = early + late
    pos_games = defaultdict(Counter)
    for r in off_rows:
        if r["pos"]:
            pos_games[r["pid"]][r["pos"]] += r["g"]
    worn = B.jersey_numbers(raw)

    lines = []
    for r in off_rows:
        if r.get("xtm") or r["fr"] not in S.FRANCHISES or r["g"] <= 0:
            continue
        pos = r["pos"] or (pos_games[r["pid"]].most_common(1)[0][0] if pos_games.get(r["pid"]) else None)
        if pos is None:
            continue
        cmp = None
        if r.get("cmp_pair") and r["cmp_pair"][1]:
            c, a = r["cmp_pair"]
            cmp = c if a == r["pass_att"] else round(r["pass_att"] * c / a)
        tgt = r["tgt_pair"][0] if r.get("tgt_pair") else None
        p = regm.by_id.get(r["pid"])
        dr = p["draft"] if p else [None] * 4
        st = {"att": r["pass_att"], "cmp": cmp, "yds": r["pass_yds"], "td": r["pass_td"], "int": r["int"], "sk": r.get("sk"),
              "car": r["rush_att"], "ry": r["rush_yds"], "rtd": r["rush_td"], "tgt": tgt, "rec": r["rec"], "recy": r["rec_yds"],
              "rectd": r["rec_td"], "dr": dr[1], "dp": dr[2]}
        w = worn.get((r["pid"], r["season"], r["fr"]))
        lines.append({
            "src": "off", "rawid": r["pid"], "pid": pid_key(r["pid"]), "name": r["name"], "season": r["season"], "fr": r["fr"],
            "grp": pos, "pos": [pos], "ht": p["ht"] if p else None, "wt": p["wt"] if p else None,
            "num": w.most_common(1)[0][0] if w else None, "reg_num": p["jersey"] if p else None,
            "games": r["g"], "starts": r["gs"] if r["gs"] > 0 else None, "stats": st, "has_stats": True, "honors": set(),
            "tot": {"pass_yds": r["pass_yds"], "pass_td": r["pass_td"], "rush_yds": r["rush_yds"], "rush_td": r["rush_td"],
                    "rec": r["rec"], "rec_yds": r["rec_yds"], "rec_td": r["rec_td"]},
        })

    # ---- defense, offensive line, kickers: nfl_players_more.json
    more = json.load(open(os.path.join(cache, "nfl_players_more.json"), encoding="utf-8"))["players"]
    spec_pos = defaultdict(Counter)
    for rec in more:
        if MORE_POS.get(rec["pos"]):
            spec_pos[(rec["id"], rec["group"])][MORE_POS[rec["pos"]]] += 1
    tracked = defaultdict(set)  # season -> the 1999+ defensive stats anyone has
    for rec in more:
        if rec.get("stats_src") == "nflverse":
            tracked[rec["season"]] |= set(rec.get("defense", {}))
    for rec in more:
        gp = rec["group"]
        pos = MORE_POS.get(rec["pos"])
        if pos is None:
            c = spec_pos.get((rec["id"], gp))
            pos = c.most_common(1)[0][0] if c else ("OG" if gp == "OL" else "DT" if (rec.get("weight") or 0) >= 285 else "DE")
        src = rec.get("stats_src")
        st = dict.fromkeys(GROUP_STATS[gp])
        dr = rec.get("draft") or [None] * 4
        st["dr"], st["dp"] = dr[1], dr[2]
        has = False
        d, k = rec.get("defense"), rec.get("kicking")
        if gp in DEF_GROUPS and d is not None and src:
            has = True
            names = {"tkl": "tkl", "tfl": "tfl", "sk": "sacks", "qbh": "qb_hits", "int": "int", "pd": "pd", "ff": "ff", "td": "def_td"}
            for key, col in names.items():
                if src == "nflverse":
                    st[key] = d.get(col, 0) if col in tracked[rec["season"]] or d.get(col) else None
                else:
                    st[key] = d.get(col, 0 if key in ("sk", "int") else None)
        if gp == "K" and k is not None and src:
            has = True
            buckets = any(x.startswith("fga_") for x in k) or src == "nflverse"
            z = 0 if src == "nflverse" else None
            st.update(fgm=k.get("fgm", 0), fga=k.get("fga", 0), lng=k.get("fg_long", z), xpm=k.get("xpm", z), xpa=k.get("xpa", z),
                      fgm40=k.get("fgm_40_49", 0) if buckets else None, fga40=k.get("fga_40_49", 0) if buckets else None,
                      fgm50=k.get("fgm_50_plus", 0) if buckets else None, fga50=k.get("fga_50_plus", 0) if buckets else None)
        hn = rec.get("honors") or {}
        honors = set()
        if hn.get("ap1"):
            honors.add("ALLPRO1")
        elif hn.get("ap2"):
            honors.add("ALLPRO2")
        if hn.get("pro_bowl"):
            honors.add("PB")
        jersey = rec.get("jersey")
        jsrc = rec.get("jersey_src")
        lines.append({
            "src": "more", "rawid": rec["id"], "pid": pid_key(rec["id"]), "name": rec["name"], "season": rec["season"], "fr": rec["team"],
            "grp": gp, "pos": [pos], "ht": rec.get("height"), "wt": rec.get("weight"),
            "num": jersey if jsrc == "pro_bowl_page" or (jsrc == "roster" and rec["season"] >= S.SPLIT) else None,
            "reg_num": jersey if jsrc in ("roster", "register_latest") else None,
            # a lineman's 1999-2000 "games" are the few he recorded a stat in (no depth charts yet): unknown
            "games": None if gp == "OL" and rec.get("g_src") == "min" and rec["season"] < 2001 else rec.get("g"),
            "starts": rec.get("gs"), "stats": st, "has_stats": has, "honors": honors,
            "tot": {"sacks": st.get("sk") or 0, "int": st.get("int") or 0} if gp in DEF_GROUPS and has else {},
            "roster": "roster" in rec.get("src", []), "gs_src": rec.get("gs_src"),
        })
    print("nfl candidate lines:", len(lines))

    # ---- honors: offensive All-Pro / Pro Bowl, AP awards
    titles = ["%d All-Pro Team" % y for y in range(S.FIRST_SEASON, S.LAST_SEASON + 1)]
    titles += [M.probowl_title(y) for y in range(S.FIRST_SEASON, S.LAST_SEASON + 1)]
    awards = {"MVP": "AP NFL Most Valuable Player", "OPOY": "AP NFL Offensive Player of the Year", "DPOY": "AP NFL Defensive Player of the Year"}
    pages = M.wiki_pages(more_dir, titles + list(awards.values()))
    by_season = defaultdict(list)
    for ln in lines:
        by_season[ln["season"]].append(ln)
    recs_by_season = defaultdict(list)
    for ln in lines:
        if ln["src"] == "off":
            recs_by_season[ln["season"]].append({"id": ln["rawid"], "name": ln["name"], "team": ln["fr"], "group": ln["grp"], "line": ln})
    placed = missed = 0
    for h in offense_honors(pages):
        fr = M.wiki_fr(h["team"], h["season"])
        rec = M.match_honor(h, fr, recs_by_season[h["season"]], regm, title_pfr)
        if rec is None:
            missed += 1
            continue
        placed += 1
        ln = rec["line"]
        if h["kind"] == "probowl":
            ln["honors"].add("PB")
            if h.get("jersey") and ln["season"] < S.SPLIT:
                ln["num"] = h["jersey"]
        else:
            for s in h["sel"]:
                if s.split("-")[0] == "AP":
                    ln["honors"].add("ALLPRO2" if "-2" in s else "ALLPRO1")
    for ln in lines:
        if "ALLPRO1" in ln["honors"]:
            ln["honors"].discard("ALLPRO2")
    print("offensive honors placed: %d, not matched: %d" % (placed, missed))
    for code, title in awards.items():
        for season, name, wtitle in award_winners(pages[title]):
            if not (S.FIRST_SEASON <= season <= S.LAST_SEASON):
                continue
            pfr = title_pfr.get(wtitle)
            p = regm.by_pfr.get(pfr) if pfr else None
            ids = {p["id"] if p else None, "pfr:" + pfr if pfr else None} - {None}
            c = [ln for ln in by_season[season] if ln["rawid"] in ids] or [ln for ln in by_season[season] if nkey(ln["name"]) == nkey(name)]
            if not c:
                print("  award not placed:", code, season, name)
                continue
            # a player with stints on two teams: the one with most games
            max(c, key=lambda ln: (ln["games"] or 0, ln["has_stats"])).setdefault("honors", set()).add(code)

    # ---- stat titles and records, on season totals over a player's stints
    totals = defaultdict(lambda: defaultdict(float))
    holder = {}
    for ln in lines:
        for k, v in ln["tot"].items():
            key = (ln["season"], ln["pid"])
            totals[key][k] += v or 0
            hk = (key, k)
            if hk not in holder or (v or 0) > (holder[hk]["tot"].get(k) or 0):
                holder[hk] = ln
    per_season = defaultdict(list)
    for key, t in totals.items():
        per_season[key[0]].append((key, t))
    best = {k: seed for k, _, seed, _ in NFL_RECORDS}
    for season in sorted(per_season):
        rows = per_season[season]
        for k, code, _, first in NFL_TITLES:
            if season < first:
                continue
            top = max((t.get(k, 0) for _, t in rows), default=0)
            for key, t in rows:
                if top > 0 and t.get(k, 0) == top:
                    holder[(key, k)]["honors"].add(code)
        for k, label, _, first in NFL_RECORDS:
            if season < first:
                continue
            top = max((t.get(k, 0) for _, t in rows), default=0)
            if top > 0 and top >= best[k]:
                for key, t in rows:
                    if t.get(k, 0) == top:
                        holder[(key, k)].setdefault("records", []).append(label)
            best[k] = max(best[k], top)

    # ---- jersey numbers before 1999: the register's (latest) number only where every later season was with this franchise
    career = defaultdict(set)
    for ln in lines:
        career[ln["pid"]].add((ln["season"], ln["fr"]))
    for ln in lines:
        if ln["num"] is None and ln.get("reg_num"):
            later = {fr for s, fr in career[ln["pid"]] if s >= ln["season"]}
            if later == {ln["fr"]}:
                ln["num"] = ln["reg_num"]

    # ---- eligibility
    roster_seasons = Counter((ln["pid"], ln["fr"]) for ln in lines if ln["src"] == "more")

    def tgames(ln):
        return tg_of.get((ln["season"], ln["fr"])) or season_tg[ln["season"]] or 16

    def minimum(ln):
        st, gp, g, y = ln["stats"], ln["grp"], ln["games"] or 0, ln["season"]
        if ln["honors"]:
            return True
        if ln["src"] == "off":
            some = {"QB": st["att"] >= 100, "RB": st["car"] + st["rec"] >= 50, "WR": st["rec"] >= 20, "TE": st["rec"] >= 15}[gp]
            full = {"QB": st["att"] >= 150, "RB": st["car"] + st["rec"] >= 100, "WR": st["rec"] >= 35, "TE": st["rec"] >= 30}[gp]
            return (g >= 8 and some) or full
        if gp == "K":
            return ln["has_stats"] and (st["fga"] or 0) >= 8
        prod = ln["has_stats"] and ((st.get("tkl") or 0) >= 25 or (st.get("sk") or 0) >= 3 or (st.get("int") or 0) >= 2 or (st.get("pd") or 0) >= 6)
        if y >= 2001 and gp != "OL" or y >= 2001 and ln["gs_src"] == "depth_chart":
            return (ln["starts"] or 0) >= 4 or (g >= 8 and prod)
        if y >= S.SPLIT and gp != "OL":
            return g >= 8 and prod
        if ln["has_stats"] and g >= 8:
            return True
        dr = st.get("dr")
        if dr and dr <= 4 and roster_seasons[(ln["pid"], ln["fr"])] >= 3:
            ln["sparse"] = not ln["has_stats"] and ln["games"] is None
            return True
        return False

    def depth_value(ln):
        st, gp = ln["stats"], ln["grp"]
        v = 10000 if ln["honors"] else 0
        if gp == "QB":
            return v + st["yds"] + st["ry"]
        if gp == "RB":
            return v + st["ry"] + st["recy"]
        if gp in ("WR", "TE"):
            return v + st["recy"] + st["ry"]
        if gp == "K":
            return v + (st["fga"] or 0)
        prod = 0
        if ln["has_stats"] and gp != "OL":
            prod = (st.get("tkl") or 0) / 4 + (st.get("sk") or 0) * 2 + (st.get("int") or 0) * 3 + (st.get("pd") or 0) + (st.get("ff") or 0) * 2
        dp = st.get("dp") or 500
        return v + 3 * (ln["starts"] or 0) + (ln["games"] or 0) + prod + (500 - dp) / 50 + roster_seasons[(ln["pid"], ln["fr"])]

    cells = defaultdict(list)
    for ln in lines:
        if minimum(ln):
            cells[(ln["season"], ln["fr"], ln["grp"])].append(ln)
    pool = []
    for (season, fr, gp), lst in cells.items():
        lst.sort(key=lambda ln: -depth_value(ln))
        cap = CAP_OLD.get(gp, CAP[gp]) if season < S.SPLIT else CAP[gp]
        pool += [ln for i, ln in enumerate(lst) if i < cap or ln["honors"]]
    # one card per id: a player listed on both sides of the ball keeps the line with honors, else the offensive one
    seen = {}
    for ln in pool:
        key = (ln["season"], ln["pid"], ln["fr"])
        if key in seen:
            old = seen[key]
            if (bool(ln["honors"]), ln["src"] == "off") > (bool(old["honors"]), old["src"] == "off"):
                seen[key] = ln
        else:
            seen[key] = ln
    print("nfl duplicate ids dropped:", len(pool) - len(seen))
    pool = list(seen.values())
    for ln in pool:
        ln["sparse"] = bool(ln.get("sparse")) or (not ln["has_stats"] and ln["games"] is None)

    # ---- ranks within season and group
    def rate(ln, k):
        """(value, enough volume) for an rk key."""
        st, g = ln["stats"], ln["games"] or tgames(ln)

        def pg(x):
            return None if x is None else x / g
        if k == "draft":
            return st.get("dp") or 500, True
        if k == "gs":
            return ln["starts"], ln["starts"] is not None
        gp = ln["grp"]
        if gp == "QB":
            att, cmp, yds, td, it = st["att"], st["cmp"], st["yds"], st["td"], st["int"]
            vol = att >= 50
            if k == "yds":
                return pg(yds), True
            if k == "td":
                return pg(td), True
            if k == "ry":
                return pg(st["ry"]), True
            if k == "ypa":
                return div(yds, att), vol
            if k == "cmpp":
                return div(cmp, att), vol and cmp is not None
            if k == "intr":
                return div(it, att), vol
            if k == "aya":
                return div(yds + 20 * td - 45 * it, att), vol
            if k == "rating":
                if cmp is None or not att:
                    return None, False
                parts = [(cmp / att - 0.3) * 5, (yds / att - 3) * 0.25, td / att * 20, 2.375 - it / att * 25]
                return sum(max(0.0, min(2.375, x)) for x in parts) / 6 * 100, vol
        if gp == "RB":
            if k == "ypc":
                return div(st["ry"], st["car"]), st["car"] >= 30
            return pg(st[k]), True
        if gp in ("WR", "TE"):
            if k == "ypr":
                return div(st["recy"], st["rec"]), st["rec"] >= 10
            if k == "cr":
                return div(st["rec"], st["tgt"]), (st["tgt"] or 0) >= 20
            if k == "tgt":
                return pg(st["tgt"]), st["tgt"] is not None
            return pg(st[k]), True
        if gp == "K":
            if k == "fgp":
                return div(st["fgm"], st["fga"]), (st["fga"] or 0) >= 5
            if k == "fgp50":
                return div(st["fgm50"], st["fga50"]), (st["fga50"] or 0) >= 2
            if k == "xpp":
                return div(st["xpm"], st["xpa"]), (st["xpa"] or 0) >= 5
            if k == "lng":
                return st["lng"], st["lng"] is not None
            return pg(st[k]), st[k] is not None
        # defense: per game
        return pg(st.get(k)), ln["has_stats"] and st.get(k) is not None

    def regular(ln):
        st, gp, tg = ln["stats"], ln["grp"], tgames(ln)
        if gp == "QB":
            return st["att"] >= 6 * tg
        if gp == "RB":
            return st["car"] + st["rec"] >= 3 * tg
        if gp in ("WR", "TE"):
            return st["rec"] >= 1.25 * tg
        if gp == "K":
            return ln["has_stats"] and (st["fga"] or 0) >= tg / 2
        if gp == "OL":
            return True
        return ln["games"] is None or ln["games"] >= tg / 2

    cell = defaultdict(list)
    for ln in pool:
        cell[(ln["season"], ln["grp"])].append(ln)
    for (season, gp), lst in cell.items():
        regs = [ln for ln in lst if regular(ln)] or lst
        sparse_cell = gp in DEF_GROUPS and sum(1 for ln in regs if ln["has_stats"]) < 0.5 * len(regs)
        for ln in lst:
            ln["rk"] = {}
        for k in GROUP_RK[gp]:
            vals = []
            for ln in regs:
                v, ok = rate(ln, k)
                if ok and v is not None:
                    vals.append(v)
                elif sparse_cell and not ln["has_stats"] and k not in ("gs", "draft"):
                    vals.append(0.0)
            rk = Ranker(vals)
            for ln in lst:
                v, ok = rate(ln, k)
                r = rk(v) if ok else None
                if r is not None and k in ("intr", "draft"):
                    r = 1 - r
                ln["rk"][k] = r

    # ---- promos
    promos = []
    for ln in pool:
        reasons = []
        if "MVP" in ln["honors"]:
            reasons.append((0, 5, "MVP"))
        for lab in ln.get("records", []):
            reasons.append((1, 6, lab))
        for code in ("OPOY", "DPOY"):
            if code in ln["honors"] and reasons:
                reasons.append((2, 5, code))
        if "ALLPRO1" in ln["honors"] and ln["grp"] not in ("OL", "K"):
            reasons.append((3, 4, "ALL-PRO"))
        for _, code, lab, _ in NFL_TITLES:
            if code in ln["honors"]:
                reasons.append((4, 3, lab))
        if reasons:
            b, lab = promo_of(reasons, ln["season"])
            promos.append((ln, b, lab))

    # ---- legends
    main_rk = {"QB": ["yds", "td", "aya"], "RB": ["ry", "rtd", "recy"], "WR": ["recy", "rec", "rectd"], "TE": ["recy", "rec", "rectd"],
               "OL": ["gs"], "DL": ["sk", "tfl", "qbh"], "LB": ["tkl", "sk", "int"], "CB": ["int", "pd"], "S": ["int", "pd"], "K": ["fgp", "lng"]}

    def season_value(ln):
        rks = [ln["rk"].get(k) for k in main_rk[ln["grp"]] if ln["rk"].get(k) is not None]
        return sum(NFL_SEASON_PTS.get(h, 0) for h in ln["honors"]) + 3 * len(ln.get("records", [])) + (4 * sum(rks) / len(rks) if rks else 0)

    def standing(ln):
        h = ln["honors"]
        hp = 0.98 if "ALLPRO1" in h or "MVP" in h else 0.94 if "ALLPRO2" in h else 0.88 if "PB" in h else 0
        rks = [ln["rk"].get(k) for k in main_rk[ln["grp"]] if ln["rk"].get(k) is not None]
        return max(hp, 0.9 * max(rks) if rks else 0)

    score = Counter()
    peak = {}
    for ln in pool:
        score[ln["pid"]] += sum(NFL_SCORE.get(h, 0) for h in ln["honors"]) + NFL_SCORE["RECORD"] * len(ln.get("records", []))
        if ln["pid"] not in peak or season_value(ln) > season_value(peak[ln["pid"]]):
            peak[ln["pid"]] = ln
    ranked = sorted((pid for pid in score if score[pid] > 0), key=lambda p: (-score[p], p))
    chosen = ranked[:NFL_LEGENDS]
    for nm, gp in NFL_MUST:
        pids = {ln["pid"] for ln in pool if nkey(ln["name"]) == nkey(nm) and (gp is None or ln["grp"] == gp)}
        if not pids:
            sys.exit("nfl legend missing from the data: " + nm)
        pid = max(pids, key=lambda p: score[p])
        if pid not in chosen:
            chosen.append(pid)
    chosen.sort(key=lambda p: (-score[p], p))
    legends = legend_boosts([(score[p], peak[p], standing(peak[p])) for p in chosen])

    for ln in pool:
        ln["team"] = nfl_identity(ln["fr"], ln["season"])
    pool.sort(key=lambda ln: (ln["season"], ln["fr"], GROUPS.index(ln["grp"]), ln["pid"]))
    return [(g, GROUP_STATS[g], GROUP_RK[g]) for g in GROUPS], pool, promos, legends, score


# ---------------------------------------------------------------- checks and main


def report(sport, lines, promos, legends, score):
    kinds = Counter()
    for ln in lines:
        kinds[ln["grp"]] += 1
    print("%s lines by group: %s" % (sport, dict(kinds)))
    print("%s promos: %d (%.1f%% of the pool)" % (sport, len(promos), 100.0 * len(promos) / len(lines)))
    names = ["%s %d (%s, +%d)" % (ln["name"], ln["season"], score[ln["pid"]], b) for ln, b in legends]
    print("%s legends (%d): %s" % (sport, len(legends), "; ".join(names)))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", default=os.path.join(HERE, "..", ".cache"))
    ap.add_argument("--sport", choices=("nba", "nfl"))
    args = ap.parse_args()
    if args.sport in (None, "nba"):
        groups, lines, promos, legends, score = build_nba(args.cache)
        report("nba", lines, promos, legends, score)
        write("nba", groups, lines, promos, legends)
    if args.sport in (None, "nfl"):
        groups, lines, promos, legends, score = build_nfl(args.cache)
        report("nfl", lines, promos, legends, score)
        write("nfl", groups, lines, promos, legends)


if __name__ == "__main__":
    main()
