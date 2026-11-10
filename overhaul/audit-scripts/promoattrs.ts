import { getPool } from '/home/user/ps-studio/src/ut/pool';
const pool = await getPool();
const show = (id: string) => { const rc = pool.base.get(id)!; const face = (rc.face ?? rc.key).map(([c,,v]) => c + v).join(' '); return `${rc.line.name} ${rc.line.season} ${rc.tier} ovr ${rc.ovr} raw ${rc.rawOvr} boost ${rc.line.boost ?? 0} face [${face}]`; };
const promos = Object.values(pool.buckets.promo).flat().sort((a,b)=>a.ovr-b.ovr || ((pool.base.get(a.line.seasonId!)?.ovr??0)-(pool.base.get(b.line.seasonId!)?.ovr??0)));
for (const p of [promos[0], promos[1], promos[Math.floor(promos.length/2)], promos[promos.length-1]]) { console.log('PROMO ', show(p.line.id)); console.log('  base', show(p.line.seasonId!)); }
const legs = Object.values(pool.buckets.legend).flat().sort((a,b)=>a.ovr-b.ovr);
for (const p of [legs[0], legs[legs.length-1]]) { console.log('LEGEND', show(p.line.id)); console.log('  base', show(p.line.seasonId!)); }
// best base golds
const golds = Object.values(pool.buckets.gold).flat().sort((a,b)=>b.ovr-a.ovr);
console.log('TOP GOLD', show(golds[0].line.id));
const sp = Object.values(pool.buckets.spotlight).flat().sort((a,b)=>a.ovr-b.ovr);
if (sp.length) { console.log('SPOT low', show(sp[0].line.id)); console.log('SPOT hi', show(sp[sp.length-1].line.id)); }
// mean rawOvr by tier
for (const t of ['gold','promo','legend','spotlight','goat'] as const) { const l = Object.values(pool.buckets[t]).flat(); if (!l.length) continue; const top = l.filter(x=>x.ovr>=(t==='gold'?88:0)); console.log(t, 'n', l.length, 'mean shown', (l.reduce((a,b)=>a+b.ovr,0)/l.length).toFixed(1), 'mean raw', (l.reduce((a,b)=>a+(b.rawOvr??0),0)/l.length).toFixed(1), 'mean attr', (l.reduce((a,b)=>a+Object.values(b.attrs).reduce((x,y)=>x+y,0)/Object.values(b.attrs).length,0)/l.length).toFixed(1), t==='gold' ? 'gold88+ raw '+(top.reduce((a,b)=>a+(b.rawOvr??0),0)/top.length).toFixed(1)+' attr '+(top.reduce((a,b)=>a+Object.values(b.attrs).reduce((x,y)=>x+y,0)/Object.values(b.attrs).length,0)/top.length).toFixed(1) : ''); }
