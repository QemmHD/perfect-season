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
names=[{'name':data['players'][c['player'][i]][1],'season':c['season'][i]} for i,_,_ in data['legends']]
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
 key,paths=item;path=paths[0];html=get(path);s=BeautifulSoup(html,'html.parser');attrs={}
 for li in s.select('li.mb-1'):
  m=re.match(r'^(\d+)\s+(.+)$',li.get_text(' ',strip=True))
  if m and m[2] in labels:attrs[labels[m[2]]]=int(m[1])
 overall=s.select_one('.attribute-box-player')
 if overall and len(attrs)>12:
  return {'name':want[key]['name'],'peakSeason':want[key]['season'],'ovr':int(overall.get_text(strip=True)),'attrs':attrs,'source':'https://www.2kratings.com'+path}
refs=[]
with cf.ThreadPoolExecutor(max_workers=6) as ex:
 for v in ex.map(parse,urls.items()):
  if v:refs.append(v)
refs.sort(key=lambda r:r['name'])
out={'checkedAt':datetime.date.today().isoformat(),'scope':'Public 2KRatings all-time roster references; used as approximate peak anchors, not official season-by-season ratings. Season cards remain estimates.','players':refs}
(ROOT/'src/data/nba-rating-references.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print('references',len(refs),flush=True)
