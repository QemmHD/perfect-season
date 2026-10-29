#!/usr/bin/env python3
"""Implemented by Codex. Refresh factual public 2KRatings all-time anchors, not official season ratings.
Requires beautifulsoup4. Reads existing NBA legend selections without changing source season data.
Run from the repository root; cached HTML lives outside the repo in the system temp directory.
Review the resulting factual snapshot and RATINGS-AUDIT.md before committing.
"""
import concurrent.futures as cf,urllib.request,re,json,unicodedata,pathlib
from bs4 import BeautifulSoup
import tempfile,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
cache=pathlib.Path(tempfile.gettempdir())/'ps-2k-cache';cache.mkdir(exist_ok=True)
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def get(path):
 f=cache/(path.strip('/').replace('/','_')+'.html')
 if f.exists():return f.read_text()
 try:
  req=urllib.request.Request('https://www.2kratings.com'+path,headers={'User-Agent':'Mozilla/5.0'})
  text=urllib.request.urlopen(req,timeout=18).read().decode();f.write_text(text);return text
 except Exception:return ''
teams=['atlanta-hawks','boston-celtics','brooklyn-nets','charlotte-hornets','chicago-bulls','cleveland-cavaliers','dallas-mavericks','denver-nuggets','detroit-pistons','golden-state-warriors','houston-rockets','indiana-pacers','los-angeles-clippers','los-angeles-lakers','memphis-grizzlies','miami-heat','milwaukee-bucks','minnesota-timberwolves','new-orleans-pelicans','new-york-knicks','oklahoma-city-thunder','orlando-magic','philadelphia-76ers','phoenix-suns','portland-trail-blazers','sacramento-kings','san-antonio-spurs','toronto-raptors','utah-jazz','washington-wizards']
data=json.loads((ROOT/'src/data/cards-nba.json').read_text());c=data['cols']
names=[]
for player_index,(_,name,_,_) in enumerate(data['players']):
 indices=[i for i,p in enumerate(c['player']) if p==player_index and (c['games'][i] or 0)>=20]
 if not indices:continue
 def standing(i):
  h={data['honors'][j] for j in c['honors'][i]};return (data['rk']['ALL']['val'][i] or 0)/1000 + (.06 if 'MVP' in h else .03 if 'ALLNBA1' in h else .015 if 'ALLNBA2' in h else 0)
 peak=max(indices,key=standing);names.append({'name':name,'season':c['season'][peak],'team':data['teams'][c['team'][peak]][0]})
want={norm(n['name']):n for n in names};urls={}
with cf.ThreadPoolExecutor(max_workers=6) as ex:
 for html in ex.map(get,['/teams/all-time-'+t for t in teams]):
  soup=BeautifulSoup(html,'html.parser')
  for a in soup.select('a[href]'):
   href=a['href'].replace('https://www.2kratings.com','');name=norm(a.get_text(' ',strip=True))
   if '-all-time-' in href and not href.startswith('/teams/') and name in want:urls.setdefault(name,[]).append(href)
print('matched',len(urls),flush=True)
labels={'Three-Point Shot':'3PT','Mid-Range Shot':'MID','Close Shot':'CLS','Free Throw':'FT','Speed':'SPD','Agility':'ACC','Strength':'STR','Vertical':'VRT','Stamina':'STA','Layup':'LAY','Driving Dunk':'DNK','Standing Dunk':'SDK','Ball Handle':'HND','Pass Accuracy':'PAS','Block':'BLK','Steal':'STL','Interior Defense':'IND','Perimeter Defense':'PRD','Defensive Rebound':'REB'}
def parse(item):
 key,paths=item;best=None
 for path in sorted(set(paths)):
  html=get(path);s=BeautifulSoup(html,'html.parser');attrs={}
  for li in s.select('li.mb-1'):
   m=re.match(r'^(\d+)\s+(.+)$',li.get_text(' ',strip=True))
   if m and m[2] in labels:attrs[labels[m[2]]]=int(m[1])
  overall=s.select_one('.attribute-box-player')
  if overall and len(attrs)>12:
   candidate={'name':want[key]['name'],'peakSeason':want[key]['season'],'ovr':int(overall.get_text(strip=True)),'attrs':attrs,'source':'https://www.2kratings.com'+path}
   team_codes=['ATL','BOS','BRK','CHO','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS']
   preferred=dict(zip(team_codes,teams)).get(want[key]['team'],'')
   if best is None or candidate['ovr']>best['ovr'] or candidate['ovr']==best['ovr'] and path.endswith('-all-time-'+preferred):best=candidate
 return best
refs=[]
with cf.ThreadPoolExecutor(max_workers=6) as ex:
 for v in ex.map(parse,urls.items()):
  if v:refs.append(v)
previous=json.loads((ROOT/'src/data/nba-rating-references.json').read_text())
found={p['name'] for p in refs}
refs += [p for p in previous['players'] if p['name'] not in found]
refs.sort(key=lambda r:r['name'])
out={'checkedAt':datetime.date.today().isoformat(),'scope':'Public 2KRatings all-time roster references, strongest available team version selected by overall; approximate peak anchors, not official season-by-season ratings. Season cards remain estimates.','players':refs}
(ROOT/'src/data/nba-rating-references.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print('references',len(refs),flush=True)
