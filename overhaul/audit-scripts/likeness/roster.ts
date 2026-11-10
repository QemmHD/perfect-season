// AUDIT (read-only): per sport, how many distinct players / cards exist, who the stars are (by best
// overall and by number of editions), and what appearance data each star's card lines carry
// (ht, wt, num). Run: cd /home/user/ps-studio && PS_SPORT=nba npx vite-node likeness/roster.ts
import { writeFileSync } from 'node:fs';
import { getPool } from '/home/user/ps-studio/src/ut/pool';
import type { RatedCard } from '/home/user/ps-studio/src/ut/types';

const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/likeness/out';
const pool = await getPool();
const sport = pool.sport;
const byPid = new Map<string, { name: string; best: RatedCard; n: number; kinds: Set<string>; hts: Set<number | null>; wts: Set<number | null>; nums: Set<number | null> }>();
let cards = 0;
for (const rc of pool.base.values()) {
  cards++;
  const l = rc.line;
  let e = byPid.get(l.pid);
  if (!e) byPid.set(l.pid, (e = { name: l.name, best: rc, n: 0, kinds: new Set(), hts: new Set(), wts: new Set(), nums: new Set() }));
  e.n++;
  e.kinds.add(l.kind);
  e.hts.add(l.ht);
  e.wts.add(l.wt);
  e.nums.add(l.num);
  if (rc.ovr > e.best.ovr) e.best = rc;
}
const all = [...byPid.values()];
const top = all.slice().sort((a, b) => b.best.ovr - a.best.ovr).slice(0, 60);
const tiers: Record<string, number> = {};
for (const rc of pool.base.values()) tiers[rc.tier] = (tiers[rc.tier] ?? 0) + 1;
const htAll = all.map((e) => [...e.hts].find((x) => x != null) ?? null);
const wtAll = all.map((e) => [...e.wts].find((x) => x != null) ?? null);
const q = (xs: number[], k: number) => xs.sort((a, b) => a - b)[Math.floor(k * (xs.length - 1))];
const hts = htAll.filter((x): x is number => x != null);
const wts = wtAll.filter((x): x is number => x != null);
const out = {
  sport,
  cards,
  players: all.length,
  tiers,
  htCoverage: hts.length / all.length,
  wtCoverage: wts.length / all.length,
  numMissingCards: [...pool.base.values()].filter((rc) => rc.line.num == null).length,
  ht: { min: Math.min(...hts), p10: q(hts, 0.1), p50: q(hts, 0.5), p90: q(hts, 0.9), max: Math.max(...hts) },
  wt: wts.length ? { min: Math.min(...wts), p10: q(wts, 0.1), p50: q(wts, 0.5), p90: q(wts, 0.9), max: Math.max(...wts) } : null,
  top: top.map((e) => ({ name: e.name, ovr: e.best.ovr, tier: e.best.tier, pos: e.best.line.pos[0], editions: e.n, ht: [...e.hts], wt: [...e.wts], num: [...e.nums] })),
  mostEditions: all
    .slice()
    .sort((a, b) => b.n - a.n)
    .slice(0, 25)
    .map((e) => ({ name: e.name, editions: e.n, best: e.best.ovr })),
};
writeFileSync(OUT + '/roster-' + sport + '.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, top: out.top.slice(0, 30).map((t) => `${t.name} ${t.ovr} ${t.pos} ed${t.editions} ht${t.ht.join('/')} wt${t.wt.join('/')} #${t.num.join('/')}`), mostEditions: out.mostEditions.slice(0, 12) }, null, 1));
process.exit(0);
