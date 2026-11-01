#!/usr/bin/env python3
"""Claude 2026-11-01: expand the same-season game-rating references (see docs/RATINGS-AUDIT.md,
"Expanded game-rating references").

Keeps every existing row of src/data/season-references-{nba,nfl}.json untouched (the original
2K Archive / nflscraPy rows from build_season_references.py win any conflict) and adds `sets`:
extra blocks of rows, one block per (source, snapshot kind), in priority order. A card key
("<player id>:<season>") lives in exactly one place, so every entry's provenance is its block.

Edition -> season rule ("the edition that represents season X", choosing the snapshot that best
reflects how the player played in X):
  kind 'final'     latest in-season roster update of the edition played during X
                   (NBA 2K(X) final update, Madden (X+1) final update)
  kind 'next'      launch roster of the following edition, built from season X's play
                   (NBA 2K(X+1) launch, Madden (X+2) launch). Measured on 2021-23 Madden: the next
                   launch matches the final in-season update almost exactly (OVR MAE 0.3-0.9, r>=0.985)
                   while the preseason roster misses it (MAE 1.6-2.1, r 0.94-0.96).
  kind 'preseason' launch roster of the edition played during X (NBA 2K(X), Madden (X+1)): the
                   publisher's projection made before X. Fallback only (retired / waived players).
  kind 'retro'     a later game's "classic team" rating of that exact season (2K26 classic teams).
                   Fallback only; the only same-season source before 1999.
Priority per key: existing rows > final > next > preseason > retro. Other seasons are never copied;
nearest-season propagation and age adjustment belong to the rating code.

Raw downloads stay outside the repo (PS_RESEARCH_CACHE, default <tmp>/ps-rating-research), pinned to
commits where the source is a git repository; sha256 of every input is recorded in the output.
Matching: a source row is attached to a card only if exactly one player in our season-X cards fits
(name, then nickname/suffix/alias variants with a team or position+height check). Ambiguous rows
are dropped. Football rows keep only the attributes that player's position groups use.
"""
from __future__ import annotations
import csv, hashlib, io, json, os, pathlib, re, sys, tempfile, time, unicodedata, urllib.request
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path(os.getenv('PS_RESEARCH_CACHE', str(pathlib.Path(tempfile.gettempdir()) / 'ps-rating-research')))
CACHE.mkdir(parents=True, exist_ok=True)
UA = 'PerfectSeasonResearch/1.0 (rating-reference build; contact via repository)'
HASHES: dict[str, str] = {}

NFL_MADDEN_DATA = 'https://raw.githubusercontent.com/theedgepredictor/nfl-madden-data/7443ba168722fc259857ef192fdf3af9ae7f50c5/data/madden/raw/{y}.csv'
NBA2KAPI = 'https://raw.githubusercontent.com/wkoverfield/nba2kapi/6f460b8d187f449ce1fc1bfce304b475f20463fc/{f}'
R2K25 = 'https://raw.githubusercontent.com/ReinerJasin/NBA2k25_Web_Scraping/{sha}/output/current_nba_players.csv'
R2K25_LAUNCH = 'f7d72466719985d8382c7a5cba2c39965f347937'  # scraped 2024-10-09, before 2024-25 opening night
R2K25_FINAL = 'eedbdef16fc83b7d436b45cba714a69d9f95fb0c'  # scraped 2025-08-23, last 2K25 roster update
API_URL = 'https://github.com/wkoverfield/nba2kapi'
MD_URL = 'https://github.com/theedgepredictor/nfl-madden-data'
NSP = 'https://github.com/blnkpagelabs/nflscraPy/releases/download/MaddenRatings/MaddenRatings-{y}.csv'


def fetch(url: str, name: str) -> pathlib.Path:
    p = CACHE / name
    if not p.exists():
        time.sleep(1.0)  # polite: one request a second, cached forever after
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        p.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    HASHES[name] = hashlib.sha256(p.read_bytes()).hexdigest()
    return p


# ---------------------------------------------------------------- names
SUFFIX = {'jr', 'sr', 'ii', 'iii', 'iv', 'v'}
NICK = [
    'lou louis', 'pat patrick patty', 'mike michael mikey', 'nick nicholas nicolas', 'chris christopher', 'bob robert bobby rob robbie',
    'bill william will billy willie', 'tony anthony', 'joe joseph joey', 'jim james jimmy jamie', 'dan daniel danny', 'matt matthew',
    'steve steven stephen', 'tim timothy timmy', 'tom thomas tommy', 'ben benjamin', 'alex alexander', 'andy andrew drew', 'cam cameron',
    'greg gregory', 'ed eddie edward eddy', 'dave david', 'ron ronald ronnie', 'rick richard ricky rich', 'sam samuel sammy', 'zach zachary zack',
    'nate nathan nathaniel', 'jeff jeffrey', 'ken kenneth kenny', 'fred frederick freddie', 'cliff clifford', 'walt walter', 'larry lawrence',
    'jake jacob', 'josh joshua', 'kj kevin', 'mo maurice', 'deshawn dashawn', 'charlie charles chuck', 'gerald gerry jerry', 'manny emmanuel',
    'vince vincent', 'herb herbert', 'phil phillip philip', 'doug douglas', 'jon jonathan', 'don donald donnie', 'gabe gabriel', 'abe abraham',
    'trey tre', 'ty tyrone tyler', 'al alan allen', 'nene', 'bones nahshon', 'nic nicolas', 'stan stanley', 'russ russell', 'marty martin',
    'terry terrence terrance', 'ike isaac', 'kc', 'ollie oliver', 'cj calvin', 'pj', 'dj', 'tj', 'jj', 'aj',
]
NICKMAP: dict[str, int] = {}
for gi, g in enumerate(NICK):
    for n in g.split():
        NICKMAP.setdefault(n, gi)
# Public name changes / known spellings, normalised both ways.
ALIAS = {
    'ronartest': 'mettaworldpeace', 'mettasandifordartest': 'mettaworldpeace', 'eneskanter': 'enesfreedom', 'enesKanterfreedom': 'enesfreedom',
    'lewalcindor': 'kareemabduljabbar', 'jianlianyi': 'yijianlian', 'nenehilario': 'nene', 'maybyner': 'nene', 'mohammedbamba': 'mohamedbamba',
    'bonesthyland': 'nahshonhyland', 'kjmartin': 'kenyonmartin', 'mikevick': 'michaelvick', 'stevesmith': 'stevesmith',
    'chadjohnson': 'chadochocinco', 'chadjohnsonochocinco': 'chadochocinco', 'robertgriffiniii': 'robertgriffin',
    'patmahomesii': 'patrickmahomes', 'patmahomes': 'patrickmahomes', 'jamarrchase': 'jamarrchase', 'mitchtrubisky': 'mitchelltrubisky',
}


def ascii_lower(s: str) -> str:
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()


def tokens(s: str) -> list[str]:
    s = ascii_lower(s).replace('.', '').replace("'", '').replace('’', '')
    t = [x for x in re.split(r'[^a-z0-9]+', s) if x]
    while len(t) > 1 and t[-1] in SUFFIX:
        t.pop()
    return t


def key(s: str) -> str:
    k = ''.join(tokens(s))
    return ALIAS.get(k, k)


def loose_same(a: str, b: str) -> bool:
    """Same last name and an equivalent first name (nickname, initials or prefix)."""
    ta, tb = tokens(a), tokens(b)
    if len(ta) < 2 or len(tb) < 2 or ta[-1] != tb[-1]:
        return sorted(ta) == sorted(tb) and len(ta) > 1
    fa, fb = ''.join(ta[:-1]), ''.join(tb[:-1])
    if fa == fb:
        return True
    ga, gb = NICKMAP.get(fa), NICKMAP.get(fb)
    if ga is not None and ga == gb:
        return True
    return len(fa) >= 3 and len(fb) >= 3 and (fa.startswith(fb) or fb.startswith(fa))


def inches(h) -> int | None:
    if h is None or h == '':
        return None
    if isinstance(h, (int, float)):
        return int(h) if 60 <= h <= 90 else None
    m = re.match(r"\s*(\d)\s*['’]\s*(\d{1,2})", str(h))
    if m:
        return int(m[1]) * 12 + int(m[2])
    try:
        v = float(h)
        return int(v) if 60 <= v <= 90 else None
    except ValueError:
        return None


def num(v) -> int | None:
    try:
        x = int(round(float(str(v).strip().replace('%', ''))))
    except (TypeError, ValueError):
        return None
    return x if 1 <= x <= 99 else None


# ---------------------------------------------------------------- our cards
class Cards:
    def __init__(self, sport: str):
        d = json.loads((ROOT / f'src/data/cards-{sport}.json').read_text())
        c = d['cols']
        self.sport = sport
        self.teams = d['teams']
        self.by_season: dict[int, dict[str, dict]] = defaultdict(dict)
        self.name_index: dict[tuple[int, str], set[str]] = defaultdict(set)
        self.last_index: dict[tuple[int, str], set[str]] = defaultdict(set)
        self.sorted_index: dict[tuple[int, str], set[str]] = defaultdict(set)
        self.fr_by_pid_season: dict[tuple[str, int], set[str]] = defaultdict(set)
        for i, idx in enumerate(c['player']):
            pid, name, ht, wt = d['players'][idx]
            s = c['season'][i]
            team = self.teams[c['team'][i]]
            info = self.by_season[s].setdefault(pid, {'name': name, 'ht': ht, 'pos': set(), 'fr': set()})
            info['pos'].update(c['pos'][i].split('/'))
            info['fr'].add(team[0])
            self.fr_by_pid_season[(pid, s)].add(team[0])
            self.name_index[(s, key(name))].add(pid)
            t = tokens(name)
            if t:
                self.last_index[(s, t[-1])].add(pid)
                self.sorted_index[(s, ' '.join(sorted(t)))].add(pid)
        # team names -> franchise
        self.fr_alias: dict[str, str] = {}
        for t in self.teams:
            fr, abbr, full = t[0], t[1], t[2]
            for k in {fr, abbr, ascii_lower(full).replace(' ', ''), tokens(full)[-1] if tokens(full) else ''}:
                if k:
                    self.fr_alias.setdefault(k.lower(), fr)
        extra = {'brk': 'BKN', 'bkn': 'BKN', 'cho': 'CHA', 'pho': 'PHX', 'gs': 'GSW', 'no': 'NOP', 'sa': 'SAS', 'ny': 'NYK', 'utah': 'UTA',
                 'wsh': 'WAS', 'nj': 'NJN', 'nok': 'NOP', 'noh': 'NOP', 'sonics': 'OKC', 'supersonics': 'OKC', 'bobcats': 'CHA'}
        if sport == 'nfl':
            extra = {'redskins': 'WAS', 'commanders': 'WAS', 'footballteam': 'WAS', 'washingtonfootballteam': 'WAS', 'jac': 'JAX', 'la': 'LAR',
                     'lvr': 'LV', 'oak': 'LV', 'raiders': 'LV', 'sd': 'LAC', 'chargers': 'LAC', 'stl': 'LAR', 'rams': 'LAR', 'wsh': 'WAS',
                     'gnb': 'GB', 'kan': 'KC', 'nwe': 'NE', 'nor': 'NO', 'sfo': 'SF', 'tam': 'TB', 'clv': 'CLE', 'blt': 'BAL', 'hst': 'HOU',
                     'arz': 'ARI', 'houstontexans': 'HOU', 'texans': 'HOU', 'oilers': 'TEN', 'titans': 'TEN', 'colts': 'IND', 'cardinals': 'ARI'}
        for k, v in extra.items():
            self.fr_alias.setdefault(k, v)
        # NBA franchise codes by our first column; make sure the alias targets exist
        frs = {t[0] for t in self.teams}
        for k, v in list(self.fr_alias.items()):
            if v not in frs:
                hit = next((t[0] for t in self.teams if t[1] == v), None)
                self.fr_alias[k] = hit or v

    def franchise(self, team: str | None) -> str | None:
        if not team:
            return None
        t = ascii_lower(team).replace(' ', '').replace('.', '')
        if t in self.fr_alias:
            return self.fr_alias[t]
        toks = tokens(team)
        return self.fr_alias.get(toks[-1]) if toks else None


# ---------------------------------------------------------------- matching
def group_nfl(p: str) -> str:
    p = (p or '').upper().strip()
    if p in ('LT', 'LG', 'C', 'RG', 'RT', 'OT', 'OG', 'T', 'G', 'OL'):
        return 'OL'
    if p in ('LE', 'RE', 'DE', 'DT', 'NT', 'DL', 'EDGE', 'LEDG', 'REDG'):
        return 'DL'
    if p in ('LOLB', 'MLB', 'ROLB', 'LB', 'OLB', 'ILB', 'SAM', 'WILL', 'MIKE'):
        return 'LB'
    if p in ('FS', 'SS', 'S'):
        return 'S'
    if p in ('HB', 'FB', 'RB'):
        return 'RB'
    if p in ('K', 'PK'):
        return 'K'
    return p


NBA_POS = {'G': {'PG', 'SG'}, 'F': {'SF', 'PF'}, 'GF': {'SG', 'SF'}, 'FC': {'PF', 'C'}}


def pos_ok(sport: str, src_pos: list[str], card_pos: set[str]) -> bool:
    if not src_pos:
        return True
    if sport == 'nfl':
        cg = {group_nfl(p) for p in card_pos}
        return any(group_nfl(p) in cg for p in src_pos)
    want = set()
    for p in src_pos:
        want |= NBA_POS.get(p, {p})
    near = {'PG': {'PG', 'SG'}, 'SG': {'PG', 'SG', 'SF'}, 'SF': {'SG', 'SF', 'PF'}, 'PF': {'SF', 'PF', 'C'}, 'C': {'PF', 'C'}}
    return any(c in near.get(w, {w}) for w in want for c in card_pos)


def match(cards: Cards, season: int, rec: dict, team_seasons: tuple[int, ...]) -> tuple[str | None, str]:
    """rec: name, team, pos(list), ht. Returns (pid, how) or (None, reason)."""
    sp = cards.by_season.get(season)
    if not sp:
        return None, 'no-season'
    fr = cards.franchise(rec.get('team'))
    ht = rec.get('ht')

    def team_ok(pid):
        if fr is None:
            return False
        return any(fr in cards.fr_by_pid_season.get((pid, s), ()) for s in team_seasons)

    def ht_ok(pid):
        h2 = sp[pid]['ht']
        return ht is None or h2 is None or abs(h2 - ht) <= 3

    exact = {p for p in cards.name_index.get((season, key(rec['name'])), set()) if ht_ok(p)}
    if exact:
        cand = exact
        if len(cand) > 1:
            cand = {p for p in cand if team_ok(p)} or {p for p in cand if pos_ok(cards.sport, rec['pos'], sp[p]['pos'])}
        if len(cand) == 1:
            pid = next(iter(cand))
            if cards.sport == 'nfl' and not pos_ok('nfl', rec['pos'], sp[pid]['pos']) and not team_ok(pid):
                return None, 'pos'
            if cards.sport == 'nba' and not (team_ok(pid) or pos_ok('nba', rec['pos'], sp[pid]['pos'])):
                return None, 'pos'
            return pid, 'exact'
        return None, 'ambiguous' if len(cand) > 1 else 'filtered'
    t = tokens(rec['name'])
    if not t:
        return None, 'noname'
    loose = {p for p in cards.last_index.get((season, t[-1]), set()) if loose_same(rec['name'], sp[p]['name']) and ht_ok(p)}
    # an unchanged first name with an alias'd/ordered surname (Yi Jianlian) lands here too
    if len(t) > 1:
        loose |= cards.sorted_index.get((season, ' '.join(sorted(t))), set())
    loose = {p for p in loose if team_ok(p) and pos_ok(cards.sport, rec['pos'], sp[p]['pos'])}
    if len(loose) == 1:
        return next(iter(loose)), 'loose'
    return None, 'ambiguous' if loose else 'none'


# ---------------------------------------------------------------- sources: NBA
NBA_COLS = ['3PT', 'MID', 'LAY', 'DNK', 'SPD', 'HND', 'PRD', 'IND', 'ACC', 'PAS', 'CLS', 'FT', 'SDK', 'STR', 'VRT', 'STA', 'STL', 'BLK', 'REB']
KA_NBA = {'3': '3PT', 'm': 'MID', 'l': 'LAY', 'd': 'DNK', 's': 'SPD', 'bh': 'HND', 'pd': 'PRD', 'id': 'IND'}
TWOK_ATTR = {  # 2KRatings attribute names (camelCase API and snake_case CSV) -> card codes
    'threepointshot': '3PT', 'midrangeshot': 'MID', 'layup': 'LAY', 'drivinglayup': 'LAY', 'drivingdunk': 'DNK', 'speed': 'SPD',
    'ballhandle': 'HND', 'perimeterdefense': 'PRD', 'interiordefense': 'IND', 'agility': 'ACC', 'passaccuracy': 'PAS', 'closeshot': 'CLS',
    'freethrow': 'FT', 'standingdunk': 'SDK', 'strength': 'STR', 'vertical': 'VRT', 'stamina': 'STA', 'steal': 'STL', 'block': 'BLK',
    'defensiverebound': 'REB',
}


def twok_attrs(src: dict) -> dict[str, int]:
    out = {}
    for k, v in src.items():
        code = TWOK_ATTR.get(re.sub(r'[^a-z]', '', k.lower()))
        if code and num(v) is not None:
            out[code] = num(v)
    return out


def load_2ka_nba() -> dict[int, list[dict]]:
    html = fetch('https://2karchive.com/', '2karchive-nba.html').read_text()
    start = html.index('const YEARS = ') + len('const YEARS = ')
    years, _ = json.JSONDecoder().raw_decode(html[start:])
    out = {}
    for e, players in years.items():
        out[int(e)] = [{'name': p['n'], 'ovr': p['o'], 'team': p.get('t'), 'pos': [x for x in (p.get('p') or '').split('/') if x],
                        'ht': inches(p.get('h')), 'attrs': {KA_NBA[k]: p[k] for k in KA_NBA if num(p.get(k)) is not None}} for p in players]
    return out


def load_r2k25(sha: str, label: str) -> list[dict]:
    p = fetch(R2K25.format(sha=sha), f'nba2k25-{label}.csv')
    rows = []
    for r in csv.DictReader(io.StringIO(p.read_text(encoding='utf-8', errors='replace'))):
        if num(r.get('overall')) is None:
            continue
        rows.append({'name': r['name'], 'ovr': num(r['overall']), 'team': r.get('team'), 'pos': [x for x in (r.get('position_1'), r.get('position_2')) if x],
                     'ht': inches(r.get('height_feet')), 'attrs': twok_attrs(r)})
    return rows


def load_nba2kapi() -> tuple[list[dict], list[dict], list[dict]]:
    arch = json.loads(fetch(NBA2KAPI.format(f='data/roster-archive/2K26.json'), 'nba2kapi-2K26-archive.json').read_text())
    early = json.loads(fetch(NBA2KAPI.format(f='nba2k-all-players.json'), 'nba2kapi-2K26-early.json').read_text())['players']

    def conv(p):
        return {'name': p['name'], 'ovr': num(p.get('overall')), 'team': p.get('team'), 'pos': p.get('positions') or [], 'ht': inches(p.get('height')),
                'attrs': twok_attrs(p.get('attributes') or {})}
    final = [conv(p) for p in arch if p.get('teamType') == 'curr' and num(p.get('overall'))]
    classic = []
    for p in arch:
        m = re.match(r'(\d{4})-(\d{2}) (.+)', p.get('team') or '')
        if p.get('teamType') == 'class' and m and num(p.get('overall')):
            r = conv(p)
            r['team'] = m[3]
            r['season'] = int(m[1]) + 1
            classic.append(r)
    pre = [conv(p) for p in early if p.get('teamType') == 'curr' and num(p.get('overall'))]
    return final, classic, pre


# ---------------------------------------------------------------- sources: NFL
NFL_COLS = ['SPD', 'ACC', 'AGI', 'STR', 'AWR', 'THP', 'SAC', 'MAC', 'DAC', 'TUP', 'BTK', 'TRK', 'JKM', 'SPM', 'SFA', 'CAR', 'BCV', 'CTH', 'CIT', 'SPC',
            'REL', 'RBK', 'PBK', 'IBL', 'PMV', 'FMV', 'BSH', 'TAK', 'PUR', 'PRC', 'MCV', 'ZCV', 'PRS', 'HIT', 'KPW', 'KAC', 'RTE']
# Attribute codes each position group's card actually reads (rate.ts output); other columns are dropped.
NFL_USE = {
    'QB': 'SPD ACC AGI STR AWR THP SAC MAC DAC TUP', 'RB': 'SPD ACC AGI STR AWR BTK TRK JKM SPM SFA CAR BCV CTH',
    'WR': 'SPD ACC AGI STR AWR CTH RTE CIT SPC REL RBK BTK JKM', 'TE': 'SPD ACC AGI STR AWR CTH RTE CIT SPC REL RBK BTK JKM',
    'OL': 'SPD ACC AGI STR AWR PBK RBK IBL', 'DL': 'SPD ACC AGI STR AWR PMV FMV BSH TAK PUR PRC HIT THP',
    'LB': 'SPD ACC AGI STR AWR TAK PUR PRC ZCV MCV BSH PMV FMV HIT THP', 'CB': 'SPD ACC AGI STR AWR MCV ZCV PRS CTH TAK HIT PRC PUR',
    'S': 'SPD ACC AGI STR AWR MCV ZCV PRS CTH TAK HIT PRC PUR', 'K': 'SPD ACC AGI STR AWR KAC KPW',
}
NFL_USE = {g: set(v.split()) for g, v in NFL_USE.items()}
MADDEN_HDR = {
    'speed': 'SPD', 'acceleration': 'ACC', 'accleration': 'ACC', 'agility': 'AGI', 'strength': 'STR', 'stength': 'STR', 'awareness': 'AWR',
    'throwpower': 'THP', 'throwaccuracyshort': 'SAC', 'shortaccuracy': 'SAC', 'shortthrowaccuracy': 'SAC', 'throwaccshort': 'SAC',
    'throwaccuracymid': 'MAC', 'throwaccuracymiddle': 'MAC', 'throwaccuracymedium': 'MAC', 'middleaccuracy': 'MAC', 'mediumthrowaccuracy': 'MAC',
    'throwaccmid': 'MAC', 'throwaccuracydeep': 'DAC', 'deepaccuracy': 'DAC', 'deepthrowaccuracy': 'DAC', 'deepthrowaccruacy': 'DAC', 'throwaccdeep': 'DAC',
    'throwunderpressure': 'TUP', 'breaktackle': 'BTK', 'trucking': 'TRK', 'jukemove': 'JKM', 'spinmove': 'SPM', 'stiffarm': 'SFA', 'carrying': 'CAR',
    'ballcarriervision': 'BCV', 'bcvision': 'BCV', 'catching': 'CTH', 'catch': 'CTH', 'catchintraffic': 'CIT', 'spectacularcatch': 'SPC',
    'speccatch': 'SPC', 'spectactularcatch': 'SPC', 'release': 'REL', 'runblock': 'RBK', 'runblocking': 'RBK', 'passblock': 'PBK',
    'passblocking': 'PBK', 'impactblocking': 'IBL', 'impactblock': 'IBL', 'powermoves': 'PMV', 'powermove': 'PMV', 'finessemoves': 'FMV',
    'finessemove': 'FMV', 'finnessemoves': 'FMV', 'finesseemove': 'FMV', 'blockshedding': 'BSH', 'tackle': 'TAK', 'pursuit': 'PUR',
    'playrecognition': 'PRC', 'mancoverage': 'MCV', 'mancover': 'MCV', 'zonecoverage': 'ZCV', 'zonecover': 'ZCV', 'press': 'PRS',
    'hitpower': 'HIT', 'kickpower': 'KPW', 'kickaccuracy': 'KAC', 'routerunning': 'RTE',
}
ROUTES = {'shortrouterunning', 'shortrouteruning', 'shortrr', 'mediumrouterunning', 'mediumrr', 'deeprouterunning', 'deeprr'}


def hdr(h: str) -> str:
    h = h.lower().replace('stats/', '').replace('/value', '').replace('plyr_', '')
    return re.sub(r'[^a-z]', '', h)


def madden_rows(text: str) -> list[dict]:
    rd = csv.reader(io.StringIO(text))
    head = next(rd)
    hs = [hdr(h) for h in head]
    out, seen = [], set()
    for row in rd:
        r = {}
        for h, v in zip(hs, row):  # duplicate headers (2010's two OVERALL columns): first non-empty wins
            if v.strip() or h not in r:
                r[h] = v if (h not in r or not r[h].strip()) else r[h]
        if any(h.endswith('diff') for h in r):
            r = {k: v for k, v in r.items() if not k.endswith('diff')}
        name = r.get('fullname') or r.get('name') or ' '.join(x for x in (r.get('firstname') or r.get('first'), r.get('lastname') or r.get('last')) if x)
        if r.get('firstname') and r.get('lastname'):
            name = f"{r['firstname']} {r['lastname']}"
        ovr = next((num(r[k]) for k in ('overall', 'overallrating', 'ovr') if k in r and num(r[k]) is not None), None)
        pos = (r.get('position') or r.get('pos') or r.get('positionshortlabel') or '').strip()
        team = r.get('team') or r.get('teamname') or ''
        if not name.strip() or ovr is None:
            continue
        sig = (key(name), team, pos)
        if sig in seen:
            continue
        seen.add(sig)
        attrs = {}
        for h, v in r.items():
            code = MADDEN_HDR.get(h)
            if code and num(v) is not None:
                attrs.setdefault(code, num(v))
        if 'throwaccuracy' in r and num(r['throwaccuracy']) is not None:
            for c in ('SAC', 'MAC', 'DAC'):
                attrs.setdefault(c, num(r['throwaccuracy']))
        routes = [num(v) for h, v in r.items() if h in ROUTES and num(v) is not None]
        if routes and 'RTE' not in attrs:
            attrs['RTE'] = round(sum(routes) / len(routes))
        out.append({'name': name.strip(), 'ovr': ovr, 'team': team, 'pos': [pos] if pos else [], 'ht': inches(r.get('height')), 'attrs': attrs})
    return out


def load_madden_launch() -> dict[int, list[dict]]:
    """nfl-madden-data raw file Y = Madden (Y+1) launch ratings (season Y rosters)."""
    out = {}
    for y in range(2001, 2026):
        p = fetch(NFL_MADDEN_DATA.format(y=y), f'nfl-madden-data-raw-{y}.csv')
        out[y + 1] = madden_rows(p.read_text(encoding='utf-8', errors='replace'))
    return out


def load_2ka_madden() -> dict[int, list[dict]]:
    html = fetch('https://2karchive.com/madden/', '2karchive-madden.html').read_text()
    i = html.index('const YEARS=(function(D){')
    j = html.index('})(', i) + 3
    fields = json.loads(re.search(r'const F=(\[[^\]]*\])', html[i:j]).group(1))
    data, _ = json.JSONDecoder().raw_decode(html[j:])
    codes = {'s': 'SPD', 'ac': 'ACC', 'ag': 'AGI', 'st': 'STR', 'aw': 'AWR'}
    out = {}
    for e, rows in data.items():
        lst = []
        for a in rows:
            r = dict(zip(fields, a))
            lst.append({'name': r['n'], 'ovr': num(r['o']), 'team': r.get('t'), 'pos': [r['p']] if r.get('p') else [], 'ht': inches(r.get('h')),
                        'attrs': {codes[k]: num(r[k]) for k in codes if num(r.get(k)) is not None}})
        out[int(e)] = lst
    return out


def load_nsp_final() -> dict[int, tuple[str, list[dict]]]:
    cols = {'speed_rating': 'SPD', 'acceleration_rating': 'ACC', 'agility_rating': 'AGI', 'strength_rating': 'STR', 'awareness_rating': 'AWR',
            'throw_power_rating': 'THP', 'throw_accuracy_short_rating': 'SAC', 'throw_accuracy_mid_rating': 'MAC', 'throw_accuracy_deep_rating': 'DAC',
            'throw_under_pressure_rating': 'TUP', 'break_tackle_rating': 'BTK', 'trucking_rating': 'TRK', 'juke_move_rating': 'JKM',
            'spin_move_rating': 'SPM', 'stiff_arm_rating': 'SFA', 'carrying_rating': 'CAR', 'ball_carrier_vision_rating': 'BCV',
            'catching_rating': 'CTH', 'catch_in_traffic_rating': 'CIT', 'spectacular_catch_rating': 'SPC', 'release_rating': 'REL',
            'run_block_rating': 'RBK', 'pass_block_rating': 'PBK', 'impact_blocking_rating': 'IBL', 'power_moves_rating': 'PMV',
            'finesse_moves_rating': 'FMV', 'block_shedding_rating': 'BSH', 'tackle_rating': 'TAK', 'pursuit_rating': 'PUR',
            'play_recognition_rating': 'PRC', 'man_coverage_rating': 'MCV', 'zone_coverage_rating': 'ZCV', 'press_rating': 'PRS',
            'hit_power_rating': 'HIT', 'kick_power_rating': 'KPW', 'kick_accuracy_rating': 'KAC'}
    out = {}
    for y in (2021, 2022, 2023):
        p = fetch(NSP.format(y=y), f'MaddenRatings-{y}.csv')
        best = {}
        for r in csv.DictReader(p.open(encoding='utf-8', errors='replace')):
            if r['status'] != 'published' or int(r['season']) != y:
                continue
            k = (key(r['player_full_name']), r['player_position'], r['team_id'])
            if k in best and best[k]['iteration_date'] >= r['iteration_date']:
                continue
            best[k] = r
        rows = []
        for r in best.values():
            attrs = {c: num(r.get(k)) for k, c in cols.items() if num(r.get(k)) is not None}
            routes = [num(r.get(k)) for k in ('short_route_running_rating', 'medium_route_running_rating', 'deep_route_running_rating')]
            if all(routes):
                attrs['RTE'] = round(sum(routes) / 3)
            rows.append({'name': r['player_full_name'], 'ovr': num(r['overall_rating']), 'team': r.get('alias') or r.get('market'),
                         'pos': [r['player_position']], 'ht': inches(r.get('player_height')), 'attrs': attrs, 'date': r['iteration_date']})
        out[y] = rows
    return out


# ---------------------------------------------------------------- assemble
def twok_label(e: int) -> str:
    return 'NBA 2K' if e == 2000 else f'2K{e % 100}'


def madden_label(e: int) -> str:
    if e == 2014:
        return 'Madden 25 (2013)'  # the anniversary edition between Madden 13 and 15
    return f'Madden {e}' if e <= 2005 else f'Madden {e % 100:02d}'


def build(sport: str) -> dict:
    cards = Cards(sport)
    path = ROOT / f'src/data/season-references-{sport}.json'
    old = json.loads(path.read_text())
    # A rebuild starts from the original block only; previous expanded sets are regenerated.
    legacy_rows = old['rows']
    legacy_cols = old['columns']
    columns = legacy_cols + [c for c in (NBA_COLS if sport == 'nba' else NFL_COLS) if c not in legacy_cols]
    taken = set(legacy_rows)
    sets: list[dict] = []
    stats = defaultdict(lambda: defaultdict(int))

    def add_set(sid, label, source, basis, kind, licence, items):
        """items: iterable of (season, snapshot label, rec, team_seasons)."""
        rows, labels = {}, []
        for season, snap, rec, team_seasons in items:
            if rec.get('ovr') is None:
                continue
            pid, how = match(cards, season, rec, team_seasons)
            stats[sid][how] += 1
            if not pid:
                continue
            k = f'{pid}:{season}'
            if k in taken or k in rows:
                continue
            attrs = dict(rec['attrs'])
            if sport == 'nfl':
                use = set().union(*(NFL_USE.get(group_nfl(p), set()) for p in cards.by_season[season][pid]['pos']))
                attrs = {c: v for c, v in attrs.items() if c in use}
            vals = [attrs.get(c) for c in columns]
            while vals and vals[-1] is None:
                vals.pop()
            if snap not in labels:
                labels.append(snap)
            rows[k] = [labels.index(snap), rec['ovr'], *vals]  # row[0] indexes the set's snapshot labels
        taken.update(rows)
        stats[sid]['added'] = len(rows)
        if rows:
            sets.append({'id': sid, 'kind': kind, 'label': label, 'source': source, 'basis': basis, 'licence': licence, 'snapshots': labels, 'rows': rows})

    if sport == 'nba':
        ka = load_2ka_nba()
        r_launch = load_r2k25(R2K25_LAUNCH, 'launch-2024-10-09')
        r_final = load_r2k25(R2K25_FINAL, 'final-2025-08-23')
        api_final, classic, api_early = load_nba2kapi()
        ka_terms = '2K Archive fan site (terms: free, as-is; ratings belong to 2K/Take-Two). Numeric facts only.'
        repo_terms = 'Public GitHub scrape of 2KRatings (README says MIT, no LICENSE file). Numeric facts only; ratings belong to 2K/Take-Two.'
        finals = [(e, p) for e in (2025, 2026) for p in ka[e]]
        add_set('2ka-final', '2K Archive latest roster update', 'https://2karchive.com/',
                '2K(X) latest in-season roster update -> season X (X = 2025, 2026).', 'final', ka_terms,
                ((e, f'{twok_label(e)} final', p, (e, e - 1)) for e, p in finals))
        add_set('2kr25-final', '2KRatings 2K25 latest roster update (public scrape)', 'https://github.com/ReinerJasin/NBA2k25_Web_Scraping',
                '2K25 roster scraped 2025-08-23 (last update of 2024-25) -> season 2025.', 'final', repo_terms,
                ((2025, '2K25 final', p, (2025, 2024)) for p in r_final))
        add_set('api26-final', '2KRatings 2K26 roster archive (nba2kapi)', API_URL,
                '2K26 roster archive captured 2026-08-08 (last update of 2025-26) -> season 2026.', 'final', repo_terms,
                ((2026, '2K26 final', p, (2026, 2025)) for p in api_final))
        launches = [(e, p) for e in ka if e not in (2025, 2026) for p in ka[e]]
        add_set('2ka-next', '2K Archive launch roster, next edition', 'https://2karchive.com/',
                '2K(X+1) launch roster (built from season X) -> season X.', 'next', ka_terms,
                ((e - 1, f'{twok_label(e)} launch', p, (e - 1, e)) for e, p in launches))
        add_set('2kr25-next', '2KRatings 2K25 near-launch roster (public scrape)', 'https://github.com/ReinerJasin/NBA2k25_Web_Scraping',
                '2K25 roster scraped 2024-10-09 (launch ratings, before opening night) -> season 2024.', 'next', repo_terms,
                ((2024, '2K25 launch', p, (2024, 2025)) for p in r_launch))
        add_set('2ka-pre', '2K Archive launch roster, same edition', 'https://2karchive.com/',
                'Fallback: 2K(X) launch roster (preseason projection) -> season X.', 'preseason', ka_terms,
                ((e, f'{twok_label(e)} launch', p, (e, e - 1)) for e, p in launches if e <= 2024))
        add_set('2kr25-pre', '2KRatings 2K25 near-launch roster (public scrape)', 'https://github.com/ReinerJasin/NBA2k25_Web_Scraping',
                'Fallback: 2K25 roster scraped 2024-10-09 -> season 2025.', 'preseason', repo_terms,
                ((2025, '2K25 launch', p, (2025, 2024)) for p in r_launch))
        add_set('api26-pre', '2KRatings 2K26 early-season roster (nba2kapi)', API_URL,
                'Fallback: 2K26 roster scraped 2025-11-16 -> season 2026.', 'preseason', repo_terms,
                ((2026, '2K26 early season', p, (2026, 2025)) for p in api_early))
        add_set('2k26-classic', 'NBA 2K26 classic teams', API_URL,
                'Fallback: a 2K26 classic-team rating of that exact season (e.g. 1985-86 Celtics -> 1986). Modern retro scale.', 'retro', repo_terms,
                ((p['season'], f"2K26 classic {p['season'] - 1}-{p['season'] % 100:02d}", p, (p['season'],)) for p in classic))
    else:
        launch = load_madden_launch()  # edition -> rows
        ka = load_2ka_madden()
        nsp = load_nsp_final()
        md_terms = 'theedgepredictor/nfl-madden-data (no licence file; data collected from maddenratings.weebly.com). Numeric facts only; ratings belong to EA.'
        add_set('nsp-final', 'nflscraPy Madden final in-season update', 'https://github.com/blnkpagelabs/nflscraPy/releases/tag/MaddenRatings',
                'Madden (X+1) final published roster iteration -> season X (rows the original strict match missed).', 'final',
                'nflscraPy archive (code MIT). Numeric facts only; ratings belong to EA.',
                ((y, f"Madden {(y + 1) % 100:02d} final", p, (y,)) for y, rows in nsp.items() for p in rows))
        add_set('md-next', 'Madden launch roster, next edition', MD_URL,
                'Madden (X+2) launch roster (built from season X) -> season X.', 'next', md_terms,
                ((e - 2, f'{madden_label(e)} launch', p, (e - 2, e - 1)) for e, rows in launch.items() for p in rows))
        add_set('2ka-next', '2K Archive Madden 27 launch roster', 'https://2karchive.com/madden/',
                'Madden 27 launch roster (EA, August 2026; built from 2025) -> season 2025. Core attributes only.', 'next',
                '2K Archive fan site (terms: free, as-is; ratings belong to EA). Numeric facts only.',
                ((2025, 'Madden 27 launch', p, (2025, 2026)) for p in ka.get(2027, [])))
        add_set('md-pre', 'Madden launch roster, same edition', MD_URL,
                'Fallback: Madden (X+1) launch roster (preseason projection) -> season X.', 'preseason', md_terms,
                ((e - 1, f'{madden_label(e)} launch', p, (e - 1, e - 2)) for e, rows in launch.items() for p in rows))
        # cross-check: the two Madden launch archives should agree on overall where both list a player
        agree = []
        for e, rows in launch.items():
            kk = {(key(p['name']), p['ovr']) for p in ka.get(e, [])}
            ks = {key(p['name']) for p in ka.get(e, [])}
            both = [p for p in rows if key(p['name']) in ks]
            agree.append((e, len(both), sum((key(p['name']), p['ovr']) in kk for p in both)))
        stats['crosscheck'] = {str(e): f'{a}/{n}' for e, n, a in agree}

    out = {k: v for k, v in old.items() if k not in ('sets', 'sha256', 'columns', 'rows')}
    out['sha256'] = {**old.get('sha256', {}), **{k: v for k, v in HASHES.items()}}
    out['columns'] = columns
    out['rows'] = legacy_rows
    out['expandedAt'] = '2026-11-01'
    out['kinds'] = {
        'final': "latest in-season roster update of the edition played during the season",
        'next': "launch roster of the following edition (built from the season's play)",
        'preseason': 'fallback: launch roster of the edition played during the season (projection made before it)',
        'retro': "fallback: a later game's classic-team rating of that exact season",
    }
    out['sets'] = sets
    HASHES.clear()
    return out, stats


if __name__ == '__main__':
    report = {}
    for sport in sys.argv[1:] or ['nba', 'nfl']:
        data, stats = build(sport)
        path = ROOT / f'src/data/season-references-{sport}.json'
        path.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')
        report[sport] = {'legacyRows': len(data['rows']), 'sets': {s['id']: len(s['rows']) for s in data['sets']},
                         'total': len(data['rows']) + sum(len(s['rows']) for s in data['sets']), 'match': {k: dict(v) for k, v in stats.items()}}
    print(json.dumps(report, indent=1))
