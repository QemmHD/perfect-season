// Audit (read-only): every Live Calendar promo's selected cards, their uplift over the season card,
// the always-on Hot Season tier, Landmarks, Weekly Standouts over a year, and SBC reward values.
import { writeFileSync } from 'node:fs';
import { getPool } from '/home/user/ps-studio/src/ut/pool';
import { schedule, promoById, per, wavesOf } from '/home/user/ps-studio/src/ut/calendar';
import { selectPromo } from '/home/user/ps-studio/src/ut/live-cards';
import { standoutProgram } from '/home/user/ps-studio/src/ut/standouts';
import { quickSellValue, openPack, packDefs } from '/home/user/ps-studio/src/ut/packs';
import { sbcsFor, rewardCard } from '/home/user/ps-studio/src/ut/sbc';
import { landmarkCatalog } from '/home/user/ps-studio/src/ut/landmarks';
import { landmarkId } from '/home/user/ps-studio/src/ut/editions';

const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/out';
const pool = await getPool();
const sport = pool.sport;
const res: Record<string, unknown> = { sport };

// Live Calendar programs
const promos: unknown[] = [];
for (const se of schedule()?.seasons ?? []) {
  for (const p of se.promos) {
    if (!per(p.count, sport)) continue;
    const sel = selectPromo(pool, p.id);
    const rows = sel.map((s) => {
      const rc = pool.base.get(s.id);
      const base = rc ? pool.base.get(rc.line.seasonId!) : undefined;
      return { name: rc?.line.name, season: rc?.line.season, ovr: rc?.ovr, base: base?.ovr, featured: s.featured, wave: s.wave };
    });
    const d = rows.map((r) => (r.ovr ?? 0) - (r.base ?? 0));
    const down = rows.filter((r) => (r.ovr ?? 0) < (r.base ?? 0)).length;
    promos.push({
      id: p.id, kind: p.kind, name: per(p.name, sport), start: p.start, end: p.end, band: p.ovrBand, delta: p.delta, n: rows.length,
      ovrMin: Math.min(...rows.map((r) => r.ovr ?? 0)), ovrMax: Math.max(...rows.map((r) => r.ovr ?? 0)),
      meanUplift: +(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length)).toFixed(2), minUplift: Math.min(...d), maxUplift: Math.max(...d), belowBase: down,
      sample: rows.slice(0, 4).map((r) => r.name + " '" + String(r.season).slice(2) + ' ' + r.base + '→' + r.ovr),
    });
  }
}
res.promos = promos;

// Weekly Standouts for a year
const weeks: unknown[] = [];
const featuredOvr: number[] = [];
const allOvr: number[] = [];
const decades: Record<string, number> = {};
for (let w = 46; w <= 52; w++) weeks.push('2026-W' + w);
for (let w = 1; w <= 45; w++) weeks.push('2027-W' + String(w).padStart(2, '0'));
for (const wk of weeks as string[]) {
  const p = standoutProgram(pool, wk);
  featuredOvr.push(p.cards[0]?.ovr ?? 0);
  for (const c of p.cards) allOvr.push(c.ovr);
  decades[p.decade] = (decades[p.decade] ?? 0) + 1;
}
const hist = (xs: number[]) => xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {} as Record<number, number>);
res.standoutsYear = { weeks: weeks.length, featuredHist: hist(featuredOvr), allHist: hist(allOvr), decades };

// Landmarks
try {
  const cat = landmarkCatalog(pool.lines);
  const lm = [...cat.keys()].map((sid) => {
    const base = pool.base.get(sid);
    const ed = base ? pool.base.get(landmarkId(base.line)) : undefined;
    return { base: base?.ovr ?? 0, ovr: ed?.ovr ?? 0 };
  });
  res.landmarks = { n: lm.length, uplift: hist(lm.map((x) => x.ovr - x.base)), ovr: hist(lm.map((x) => x.ovr)) };
} catch (e) {
  res.landmarks = String(e);
}

// SBC catalogue over 28 days: reward kinds and the cheapest fodder QS for tier/size reqs (estimate)
const golds = Object.values(pool.buckets.gold).flat().map(quickSellValue).sort((a, b) => a - b);
const silvers = Object.values(pool.buckets.silver).flat().map(quickSellValue).sort((a, b) => a - b);
const bronzes = Object.values(pool.buckets.bronze).flat().map(quickSellValue).sort((a, b) => a - b);
res.fodderQs = { goldMin: golds[0], goldP25: golds[Math.floor(golds.length / 4)], silverMin: silvers[0], silverP50: silvers[Math.floor(silvers.length / 2)], bronzeMin: bronzes[0] };
const counts: Record<string, number> = {};
for (let d = 1; d <= 28; d++) {
  const day = '2026-11-' + String(d).padStart(2, '0');
  for (const s of sbcsFor(pool, day)) {
    if (s.kind !== 'daily' && s.kind !== 'weekly') continue;
    const k = s.kind + ':' + s.title.replace(/:.*$/, '').replace(/^The \d+s All-Stars$/, 'Decade All-Stars').replace(/^\d+s Night$/, 'Decade Night').replace(/ Legacy$/, ' Legacy').replace(/^Champions of the .*/, 'Champions of the decade') + ' -> ' + JSON.stringify(s.reward);
    counts[k] = (counts[k] ?? 0) + 1;
  }
}
res.sbcCatalogue = counts;
// reward card EVs
const promoRewards = Array.from({ length: 400 }, (_, i) => rewardCard(pool, { tier: 'promo' }, 'p' + i)!);
const g84 = Array.from({ length: 400 }, (_, i) => rewardCard(pool, { tier: 'gold', minOvr: 84 }, 'g' + i)!);
const g88 = Array.from({ length: 400 }, (_, i) => rewardCard(pool, { tier: 'gold', minOvr: 88 }, 'h' + i)!);
const gAny = Array.from({ length: 400 }, (_, i) => rewardCard(pool, { tier: 'gold' }, 'a' + i)!);
const mean = (xs: number[]) => +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
res.rewardCards = {
  promo: { ovr: mean(promoRewards.map((c) => c.ovr)), qs: mean(promoRewards.map(quickSellValue)) },
  gold84: { ovr: mean(g84.map((c) => c.ovr)), qs: mean(g84.map(quickSellValue)) },
  gold88: { ovr: mean(g88.map((c) => c.ovr)), qs: mean(g88.map(quickSellValue)) },
  goldAny: { ovr: mean(gAny.map((c) => c.ovr)), qs: mean(gAny.map(quickSellValue)) },
};
// pack golds weighted vs uniform
const pg = Array.from({ length: 3000 }, (_, i) => openPack(pool, 'gold', 'w' + i)).flat().filter((c) => c.tier === 'gold');
res.packGoldMeanOvr = mean(pg.map((c) => c.ovr));
res.prices = Object.fromEntries(Object.entries(packDefs(sport)).map(([k, d]) => [k, d.price]));
writeFileSync(OUT + '/promos-' + sport + '.json', JSON.stringify(res, null, 1));
console.log('ok', sport);
