// Prints the match-sim tables from soccer_sim_out_<part>.json
const fs = require('fs');
const dir = __dirname + '/';
const part = process.argv[2] || 'all';
const d = JSON.parse(fs.readFileSync(dir + 'soccer_sim_out_' + part + '.json', 'utf8'));
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
for (const [lvl, v] of Object.entries(d)) {
  const { shots, atks, results } = v;
  console.log('\n===== ' + lvl + ' (' + results.length + ' matches, ' + atks.length + ' attacks, ' + shots.length + ' shots) =====');
  const goals = results.map((r) => r.h + r.a);
  const mean = goals.reduce((a, b) => a + b, 0) / results.length;
  const perSide = mean / 2;
  const draws = results.filter((r) => r.h === r.a).length;
  const nil = results.filter((r) => r.h + r.a === 0).length;
  const dist = {};
  for (const r of results) for (const g of [r.h, r.a]) dist[g] = (dist[g] || 0) + 1;
  console.log('goals/match total', mean.toFixed(2), ' per side', perSide.toFixed(2), ' draws', pct(draws, results.length), ' 0-0', pct(nil, results.length));
  console.log('per-side goal distribution', JSON.stringify(dist));
  // better team wins
  let better = 0, worse = 0, level = 0, nb = 0;
  for (const r of results) {
    if (Math.abs(r.dOvr) < 4) continue;
    nb++;
    const bh = r.dOvr > 0;
    if (r.h === r.a) level++;
    else if ((r.h > r.a) === bh) better++;
    else worse++;
  }
  console.log('|dOvr|>=4: better wins', pct(better, nb), ' draw', pct(level, nb), ' worse wins', pct(worse, nb), ' n', nb);
  let b8 = 0, l8 = 0, w8 = 0, n8 = 0;
  for (const r of results) {
    if (Math.abs(r.dOvr) < 8) continue;
    n8++;
    const bh = r.dOvr > 0;
    if (r.h === r.a) l8++;
    else if ((r.h > r.a) === bh) b8++;
    else w8++;
  }
  console.log('|dOvr|>=8: better wins', pct(b8, n8), ' draw', pct(l8, n8), ' worse wins', pct(w8, n8), ' n', n8);
  // attacks
  const ends = {};
  for (const a of atks) ends[a.end] = (ends[a.end] || 0) + 1;
  console.log('attack ends', Object.entries(ends).map(([k, n]) => k + ' ' + pct(n, atks.length)).join('  '));
  const bySc = {};
  for (const a of atks) {
    const s = (bySc[a.sc] = bySc[a.sc] || { n: 0, G: 0, shots: 0, withShot: 0, used: 0, pen: 0, passes: 0, T: 0, L: 0, O: 0 });
    s.n++;
    if (a.end === 'G') s.G++;
    if (a.end === 'T') s.T++;
    if (a.end === 'L') s.L++;
    if (a.end === 'O') s.O++;
    s.shots += a.shots;
    if (a.shots) s.withShot++;
    s.used += a.used;
    if (a.pen) s.pen++;
    s.passes += a.passes;
  }
  for (const [k, s] of Object.entries(bySc)) console.log(('  ' + k).padEnd(12), 'goal', pct(s.G, s.n).padStart(6), ' shot in', pct(s.withShot, s.n).padStart(6), ' shots/att', (s.shots / s.n).toFixed(2), ' clock used', (s.used / s.n).toFixed(1) + 's', ' pens won', pct(s.pen, s.n), ' passes/att', (s.passes / s.n).toFixed(2), ' lost', pct(s.L, s.n), ' offside', pct(s.O, s.n), ' time', pct(s.T, s.n));
  const shotsPerSide = shots.length / (results.length * 2);
  console.log('shots per side per match', shotsPerSide.toFixed(2));
  const res = {};
  for (const s of shots) res[s.res] = (res[s.res] || 0) + 1;
  const n = shots.length;
  console.log('shot results', Object.entries(res).map(([k, m]) => k + ' ' + pct(m, n)).join('  '), ' on target (G+S)', pct((res.G || 0) + (res.S || 0), n), ' save% of on-target', pct(res.S || 0, (res.G || 0) + (res.S || 0)));
  const bands = [[0, 6], [6, 11], [11, 16.5], [16.5, 22], [22, 30], [30, 99]];
  for (const [lo, hi] of bands) {
    const ss = shots.filter((s) => s.d >= lo && s.d < hi && s.kind !== 'pen' && s.kind !== 'fk');
    const g = ss.filter((s) => s.res === 'G').length;
    console.log(('  open-play ' + lo + '-' + hi + ' m').padEnd(22), 'shots', String(ss.length).padStart(5), ' share', pct(ss.length, n).padStart(6), ' goal', pct(g, ss.length).padStart(6), ' green', pct(ss.filter((s) => s.greened).length, ss.length));
  }
  for (const k of ['shot', 'header', 'volley', 'fk', 'pen']) {
    const ss = shots.filter((s) => s.kind === k);
    console.log(('  kind ' + k).padEnd(22), 'shots', String(ss.length).padStart(5), ' goal', pct(ss.filter((s) => s.res === 'G').length, ss.length).padStart(6), ' mean dist', (ss.reduce((a, s) => a + s.d, 0) / Math.max(1, ss.length)).toFixed(1));
  }
  const inb = shots.filter((s) => s.inBox && s.kind !== 'pen');
  console.log('  share of non-pen shots in box', pct(inb.length, shots.filter((s) => s.kind !== 'pen').length));
  // end texts top
  const tx = {};
  for (const a of atks) {
    const t = a.text.replace(/ BY .*/, ' BY x').replace(/ · .*/, ' · x');
    tx[t] = (tx[t] || 0) + 1;
  }
  console.log('  end texts', Object.entries(tx).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, m]) => k + ' ' + pct(m, atks.length)).join(' | '));
}
