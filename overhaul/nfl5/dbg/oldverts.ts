const base = process.env.BASE!;
const { hashString, rng } = await import(base + '/src/engine/rng');
const { decide, pilot } = await import(base + '/src/game/football2/autopilot');
const { newGame } = await import(base + '/src/game/football2/drive');
const { lineUp, snap, step } = await import(base + '/src/game/football2/engine');
const { fixtureTeams } = await import(base + '/src/game/football2/sim-kit');
const K = process.env.K ?? 'verts';
for (const cov of ['man', 'zone']) {
  let n = 0, yd = 0, cmp = 0, sack = 0, ttt = 0, thr = 0;
  for (let i = 0; i < 300; i++) {
    const t = fixtureTeams('gold');
    const g = newGame(t.off, t.def, 's' + i, 4, 0);
    const r = rng(hashString('ov' + i));
    const p = lineUp(t.off, t.def, 'pass', K, 'inside', 35, 26.67, r, 0, base.includes('old') ? undefined : undefined);
    if (p.coverage !== cov) continue;
    snap(p);
    const pl = pilot(0.68, 'p' + i); pl.readAt = 0;
    for (let s = 0; s < 1500 && !p.end; s++) { decide(p, g, pl); step(p, 1 / 60, null); if (p.events.some((e: string) => e.startsWith('throw'))) { ttt += p.t; thr++; } p.events.length = 0; }
    n++; if (p.end.kind !== 'int') yd += p.end.gain; if (p.end.caught) cmp++; if (p.end.kind === 'sack') sack++;
  }
  console.log(base.slice(-12), K, cov, 'n', n, 'cmp/drop', (cmp / n * 100).toFixed(0), 'sack', (sack / n * 100).toFixed(1), 'yd/drop', (yd / n).toFixed(1), 'ttt', (ttt / thr).toFixed(2));
}
