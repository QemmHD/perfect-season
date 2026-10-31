#!/usr/bin/env python3
"""Codex: public, same-era numerical benchmarks. No third-party game code/art is copied.
NBA: 2K Archive's documented release/update snapshots. NFL: final published nflscraPy season rows (MIT archive).
Raw downloads stay outside the repo. Only exact-name, compatible-position matches to our existing players are emitted.
"""
from datetime import date
import csv,json,re,unicodedata,urllib.request,pathlib,concurrent.futures,hashlib,os,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path(os.getenv('PS_RESEARCH_CACHE',str(pathlib.Path(tempfile.gettempdir())/'ps-rating-research')));CACHE.mkdir(parents=True,exist_ok=True)
def fetch(url,path):
 p=CACHE/path
 if not p.exists():p.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read())
 return p
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('michaelvick','mikevick'))
def group(p):
 return 'OL' if p in ['LT','LG','C','RG','RT','OT','OG']else'DL'if p in ['LE','RE','DE','DT']else'LB'if p in ['LOLB','MLB','ROLB','LB']else'S'if p in ['FS','SS','S']else'RB'if p in ['HB','FB','RB']else p
nba_cols={'3':'3PT','m':'MID','l':'LAY','d':'DNK','s':'SPD','bh':'HND','pd':'PRD','id':'IND'}
nfl_cols={'speed_rating':'SPD','acceleration_rating':'ACC','agility_rating':'AGI','strength_rating':'STR','awareness_rating':'AWR','throw_power_rating':'THP','throw_accuracy_short_rating':'SAC','throw_accuracy_mid_rating':'MAC','throw_accuracy_deep_rating':'DAC','throw_under_pressure_rating':'TUP','break_tackle_rating':'BTK','trucking_rating':'TRK','juke_move_rating':'JKM','spin_move_rating':'SPM','stiff_arm_rating':'SFA','carrying_rating':'CAR','ball_carrier_vision_rating':'BCV','catching_rating':'CTH','catch_in_traffic_rating':'CIT','spectacular_catch_rating':'SPC','release_rating':'REL','run_block_rating':'RBK','pass_block_rating':'PBK','impact_blocking_rating':'IBL','power_moves_rating':'PMV','finesse_moves_rating':'FMV','block_shedding_rating':'BSH','tackle_rating':'TAK','pursuit_rating':'PUR','play_recognition_rating':'PRC','man_coverage_rating':'MCV','zone_coverage_rating':'ZCV','press_rating':'PRS','hit_power_rating':'HIT','kick_power_rating':'KPW','kick_accuracy_rating':'KAC'}
summary={}
for sport in ['nba','nfl']:
 data=json.loads((ROOT/f'src/data/cards-{sport}.json').read_text());c=data['cols'];eligible={}
 for i,idx in enumerate(c['player']):
  pid,name,ht,wt=data['players'][idx];eligible.setdefault((norm(name),c['season'][i]),[]).append((pid,c['pos'][i].split('/'),ht))
 rows={};ambiguous=0
 if sport=='nba':
  html=fetch('https://2karchive.com/','nba.html').read_text();start=html.index('const YEARS = ')+len('const YEARS = ');years,_=json.JSONDecoder().raw_decode(html[start:]);columns=list(nba_cols.values())
  for edition,players in years.items():
   edition=int(edition);season=edition if edition in [2025,2026] else edition-1
   for p in players:
    candidates=eligible.get((norm(p['n']),season),[]);pos=p.get('p','').split('/')
    height=re.match(r"(\d+)'(\d+)",p.get('h',''));height=int(height[1])*12+int(height[2])if height else None
    candidates={pid for pid,ps,ht in candidates if (not pos or not p.get('p') or set(ps)&set(pos)) and (height is None or ht is None or abs(ht-height)<=3)}
    if len(candidates)!=1:ambiguous+=len(candidates)>1;continue
    pid=next(iter(candidates));key=f'{pid}:{season}'
    attrs=[p.get(k) for k in nba_cols]
    candidate=[edition,p['o'],*attrs]
    # Latest-update snapshots take priority over an adjacent launch snapshot for the same completed season.
    if key not in rows or edition in [2025,2026]:rows[key]=candidate
  source='https://2karchive.com/';basis='NBA 2K release snapshots use prior completed season; 2K25/26 updated snapshots use edition-ending season. Benchmark, not official season-final roster.'
 else:
  columns=list(nfl_cols.values())+['RTE'];source='https://github.com/blnkpagelabs/nflscraPy/releases/tag/MaddenRatings';basis='Final available published roster iteration for explicitly named NFL season. Numeric archive facts; original archive code MIT.'
  def download(y):return fetch(f'https://github.com/blnkpagelabs/nflscraPy/releases/download/MaddenRatings/MaddenRatings-{y}.csv',f'MaddenRatings-{y}.csv')
  files=list(concurrent.futures.ThreadPoolExecutor(max_workers=3).map(download,[2021,2022,2023]));latest={}
  for f in files:
   for p in csv.DictReader(f.open()):
    if p['status']!='published':continue
    season=int(p['season']);cand=eligible.get((norm(p['player_full_name']),season),[])
    candidates={pid for pid,ps,ht in cand if group(p['player_position']) in [group(x)for x in ps] and (ht is None or abs(ht-float(p['player_height']or ht))<=3)}
    if len(candidates)!=1:ambiguous+=len(candidates)>1;continue
    pid=next(iter(candidates));key=f'{pid}:{season}';date=p['iteration_date']
    if key in latest and latest[key]>=date:continue
    attrs=[int(float(p.get(k)or 0))or None for k in nfl_cols]
    routes=[int(p.get(k)or 0)for k in ['short_route_running_rating','medium_route_running_rating','deep_route_running_rating']];attrs.append(round(sum(routes)/3)if all(routes)else None)
    rows[key]=[date,int(p['overall_rating']),*attrs];latest[key]=date
 inputs=[CACHE/'nba.html']if sport=='nba'else files
 hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in inputs}
 out={'sha256':hashes,'checkedAt':date.today().isoformat(),'source':source,'basis':basis,'columns':columns,'rows':rows}
 (ROOT/f'src/data/season-references-{sport}.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
 summary[sport]={'matchedPlayerSeasons':len(rows),'uniquePlayers':len({k.rsplit(':',1)[0]for k in rows}),'ambiguousRejected':ambiguous,'source':source}
print(json.dumps(summary,indent=2))
