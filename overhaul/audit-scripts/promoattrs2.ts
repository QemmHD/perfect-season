import { getPool } from '/home/user/ps-studio/src/ut/pool';
const pool = await getPool();
const promos = Object.values(pool.buckets.promo).flat();
const rows = promos.map((p) => { const b = pool.base.get(p.line.seasonId!)!; const am = (r: typeof p) => Object.values(r.attrs).reduce((x, y) => x + y, 0) / Object.values(r.attrs).length; return { name: p.line.name + ' ' + p.line.season, shown: p.ovr, raw: p.rawOvr!, baseShown: b.ovr, baseRaw: b.rawOvr!, attrGain: +(am(p) - am(b)).toFixed(1), key: p.key.map(([c,,v]) => c + v).join(' '), face: (p.face ?? []).map(([c,,v]) => c + v).join(' ') }; });
rows.sort((a, b) => a.raw - b.raw);
for (const r of rows.slice(0, 3)) console.log(JSON.stringify(r));
const gap = rows.map((r) => r.shown - r.raw);
console.log('n', rows.length, 'shown-raw gap: mean', (gap.reduce((a,b)=>a+b,0)/gap.length).toFixed(1), 'cards with raw<85:', rows.filter(r=>r.raw<85).length, 'raw<80:', rows.filter(r=>r.raw<80).length, 'base bronze/silver(shown<75):', rows.filter(r=>r.baseShown<75).length);
