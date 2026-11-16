// Claude (packs-1, 2026-11-10), ported from the packs/promos audit: open N seeded packs of every kind and
// tabulate tiers, OVR bands, specials, duplicates and quick-sell EV, plus each pack's gold-slot OVR
// histogram and its "at least one 80+ ... 88+" rows (the per-OVR curve's before/after, packs-2). Read-only.
//   PACKS_OUT=<dir> PACKSIM_LABEL=before PS_SPORT=nba npx vite-node scripts/packs/packsim.ts   (N=10000 by default)
import { writeOut } from './out';
import { getPool } from '../../src/ut/pool';
import { packDefs, openPack, quickSellValue, positionChoices, walkoutLevel, registeredPack } from '../../src/ut/packs';
import { isRare, rareInfo } from '../../src/ut/rare';
import { SPOTLIGHT_RATES } from '../../supabase/functions/card-registry/contract';
import { scoutOptions } from '../../src/ut/content-packs';
import { livePackDef, openLivePack } from '../../src/ut/live-packs';
import { packsOn } from '../../src/ut/calendar';
import { standoutProgram } from '../../src/ut/standouts';
import { marketFor } from '../../src/ut/market';
import { rng, hashString } from '../../src/engine/rng';
import type { RatedCard } from '../../src/ut/types';

const N = Number(process.env.N ?? 10000);
const pool = await getPool();
const sport = pool.sport;
const week = '2026-W46';
const defs = packDefs(sport);
rareInfo(pool);

const band = (o: number) => (o < 65 ? '<65' : o < 75 ? '65-74' : o < 80 ? '75-79' : o < 83 ? '80-82' : o < 86 ? '83-85' : o < 88 ? '86-87' : o < 90 ? '88-89' : o < 94 ? '90-93' : o < 100 ? '94-99' : '100+');
const BANDS = ['<65', '65-74', '75-79', '80-82', '83-85', '86-87', '88-89', '90-93', '94-99', '100+'];
const tierKey = (rc: RatedCard) => (rc.tier === 'gold' && isRare(rc, pool) ? 'rare' : rc.tier) + (rc.line.holo ? '+holo' : '');
const SPECIAL = new Set(['promo', 'legend', 'standout', 'landmark', 'program', 'spotlight', 'goat']);

interface Stat {
  kind: string; name: string; price: number; packs: number; cards: number;
  tiers: Record<string, number>; bands: Record<string, number>;
  qsMean: number; qsP50: number; qsP90: number; qsMax: number; evRatio: number | null;
  pAnySpecial: number; pAny86: number; pAny88: number; pAny90: number; pWalkout2: number; pWalkout3: number;
  bestOvrMean: number; distinctCards: number; dupRateSeq: Record<string, number>;
  topCardShare: number; meanOvr: number; goldOvrMean: number;
  /** every gold card pulled (rare golds included), share by displayed OVR */
  goldOvr: Record<string, number>;
  /** share of packs with at least one card of this displayed OVR or better */
  atLeast: Record<string, number>;
}

const AT_LEAST = [80, 81, 82, 83, 84, 85, 86, 87, 88];

function analyse(kind: string, name: string, price: number, open: (i: number) => RatedCard[]): Stat {
  const tiers: Record<string, number> = {};
  const bands: Record<string, number> = {};
  const qs: number[] = [];
  let cards = 0, special = 0, a86 = 0, a88 = 0, a90 = 0, w2 = 0, w3 = 0, best = 0, ovrSum = 0, goldSum = 0, goldN = 0;
  const freq = new Map<string, number>();
  const seen = new Set<string>();
  const seqDup: Record<string, number> = {};
  const marks = [1, 5, 10, 25, 50, 100, 200];
  let dupCount = 0, seqCards = 0;
  const goldOvr: Record<string, number> = {};
  const atLeast = AT_LEAST.map(() => 0);
  for (let i = 0; i < N; i++) {
    const cs = open(i);
    let q = 0, sp = false, b = 0, wl = 0;
    for (const rc of cs) {
      cards++;
      const tk = tierKey(rc);
      tiers[tk] = (tiers[tk] ?? 0) + 1;
      bands[band(rc.ovr)] = (bands[band(rc.ovr)] ?? 0) + 1;
      q += quickSellValue(rc);
      if (SPECIAL.has(rc.tier)) sp = true;
      b = Math.max(b, rc.ovr);
      wl = Math.max(wl, walkoutLevel(rc));
      ovrSum += rc.ovr;
      if (rc.tier === 'gold') { goldSum += rc.ovr; goldN++; goldOvr[rc.ovr] = (goldOvr[rc.ovr] ?? 0) + 1; }
      freq.set(rc.line.id, (freq.get(rc.line.id) ?? 0) + 1);
      // a single player opening these packs in order: how many pulls are an edition he already has
      if (i < 200) { seqCards++; if (seen.has(rc.line.id)) dupCount++; seen.add(rc.line.id); }
    }
    if (i < 200 && marks.includes(i + 1)) seqDup['after' + (i + 1)] = +(dupCount / Math.max(1, seqCards)).toFixed(3);
    qs.push(q);
    if (sp) special++;
    AT_LEAST.forEach((x, k) => b >= x && atLeast[k]++);
    if (b >= 86) a86++;
    if (b >= 88) a88++;
    if (b >= 90) a90++;
    if (wl >= 2) w2++;
    if (wl >= 3) w3++;
    best += b;
  }
  qs.sort((a, b) => a - b);
  const mean = qs.reduce((a, b) => a + b, 0) / qs.length;
  const top = Math.max(...freq.values());
  return {
    kind, name, price, packs: N, cards,
    tiers: Object.fromEntries(Object.entries(tiers).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / N).toFixed(4)])),
    bands: Object.fromEntries(BANDS.filter((b) => bands[b]).map((b) => [b, +(bands[b] / cards).toFixed(4)])),
    qsMean: Math.round(mean), qsP50: qs[Math.floor(N / 2)], qsP90: qs[Math.floor(N * 0.9)], qsMax: qs[N - 1],
    evRatio: price ? +(mean / price).toFixed(3) : null,
    pAnySpecial: +(special / N).toFixed(4), pAny86: +(a86 / N).toFixed(4), pAny88: +(a88 / N).toFixed(4), pAny90: +(a90 / N).toFixed(4),
    pWalkout2: +(w2 / N).toFixed(4), pWalkout3: +(w3 / N).toFixed(4),
    bestOvrMean: +(best / N).toFixed(2), distinctCards: freq.size, dupRateSeq: seqDup,
    topCardShare: +(top / cards).toFixed(5), meanOvr: +(ovrSum / cards).toFixed(2), goldOvrMean: goldN ? +(goldSum / goldN).toFixed(2) : 0,
    goldOvr: Object.fromEntries(Object.entries(goldOvr).sort((a, b) => +a[0] - +b[0]).map(([o, n]) => [o, +(n / Math.max(1, goldN)).toFixed(5)])),
    atLeast: Object.fromEntries(AT_LEAST.map((x, k) => [x + '+', +(atLeast[k] / N).toFixed(5)])),
  };
}

const results: Stat[] = [];
const kinds = Object.keys(defs).filter((k) => !['spotlight', 'scout', 'position'].includes(k));
for (const k of kinds) {
  if (sport === 'soccer' && k === 'spotlight') continue;
  const d = defs[k as keyof typeof defs];
  results.push(analyse(k, d.name, d.price, (i) => openPack(pool, k, 'audit:' + k + ':' + i, week)));
}
for (const ch of positionChoices(sport)) results.push(analyse('position:' + ch.key, defs.position.name + ' ' + ch.label, defs.position.price, (i) => openPack(pool, 'position:' + ch.key, 'audit:pos:' + ch.key + ':' + i, week)));
results.push(analyse('starter', 'Starter', 0, (i) => openPack(pool, 'starter', 'audit:starter:' + i, week)));

// Spotlight: the server's chase tier (contract rates, uniform within tier) + the client's common golds
if (sport !== 'soccer') {
  const r = rng(hashString('audit-spot-' + sport));
  const lists: Record<string, string[]> = {};
  for (const t of ['goat', 'spotlight', 'legend', 'promo']) lists[t] = Object.values(pool.buckets[t as 'promo']).flat().map((rc) => rc.line.id);
  results.push(
    analyse('spotlight', 'Spotlight Pack', 3500, (i) => {
      let x = r();
      let tier = 'gold';
      for (const [t, p] of Object.entries(SPOTLIGHT_RATES)) { if (x < p) { tier = t; break; } x -= p; }
      const id = tier === 'gold' ? null : lists[tier][Math.floor(r() * lists[tier].length)];
      return registeredPack(pool, 'spotlight', 'audit-spot:' + i, id);
    })
  );
}

// Scout's Choice: the best option of three, and the chance of a Standout among them
{
  let bestSum = 0, so = 0, qsBest = 0;
  const bestBands: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const { options } = scoutOptions(pool, 'audit:' + i, week);
    const b = options.slice().sort((a, b) => b.ovr - a.ovr)[0];
    bestSum += b.ovr;
    bestBands[band(b.ovr)] = (bestBands[band(b.ovr)] ?? 0) + 1;
    if (options.some((o) => o.tier === 'standout')) so++;
    qsBest += Math.max(...options.map(quickSellValue));
  }
  (results as unknown[]).push({ kind: 'scout', name: "Scout's Choice", price: defs.scout.price, bestOvrMean: +(bestSum / N).toFixed(2), bestBands: Object.fromEntries(Object.entries(bestBands).map(([k, v]) => [k, +(v / N).toFixed(4)])), pStandoutOption: +(so / N).toFixed(4), qsBestMean: Math.round(qsBest / N), evRatio: +((qsBest / N) / defs.scout.price).toFixed(3) });
}

// Live Calendar program packs on representative days
const liveDays = ['2026-11-14', '2026-12-12', '2027-01-23', '2027-02-20', '2027-04-17', '2027-05-15', '2027-06-05', '2027-07-17', '2027-10-02'];
const live: unknown[] = [];
if (sport !== 'soccer') {
  for (const day of liveDays) {
    for (const p of packsOn(day)) {
      if (live.some((x) => (x as { kind: string }).kind === p.id)) continue;
      const def = livePackDef(sport, p);
      const st = analyse(p.id, def.name, def.price, (i) => openLivePack(pool, p.id, rng(hashString('audit-live:' + p.id + ':' + i)), day, week));
      live.push({ ...st, day, programOdds: def.odds, extra: def.extra });
    }
  }
}

// Weekly Standouts: their overall uplift over the season card
const prog = standoutProgram(pool, week);
const standouts = prog.cards.map((rc) => ({ id: rc.line.id, name: rc.line.name, season: rc.line.season, ovr: rc.ovr, base: pool.base.get(rc.line.seasonId!)?.ovr, featured: rc.line.featured }));

// Hot Season / Legend / Spotlight / GOAT: rating above the season card
const uplift: Record<string, { n: number; meanBase: number; meanEd: number; meanDelta: number; minEd: number; maxEd: number; deltaHist: Record<string, number> }> = {};
for (const t of ['promo', 'legend', 'spotlight', 'goat'] as const) {
  const list = Object.values(pool.buckets[t]).flat();
  if (!list.length) continue;
  let b = 0, e = 0, mn = 999, mx = 0;
  const hist: Record<string, number> = {};
  for (const rc of list) {
    const base = pool.base.get(rc.line.seasonId!)?.ovr ?? rc.ovr;
    b += base; e += rc.ovr; mn = Math.min(mn, rc.ovr); mx = Math.max(mx, rc.ovr);
    const d = rc.ovr - base;
    const k = d <= 2 ? '0-2' : d <= 5 ? '3-5' : d <= 10 ? '6-10' : d <= 20 ? '11-20' : '21+';
    hist[k] = (hist[k] ?? 0) + 1;
  }
  uplift[t] = { n: list.length, meanBase: +(b / list.length).toFixed(1), meanEd: +(e / list.length).toFixed(1), meanDelta: +((e - b) / list.length).toFixed(1), minEd: mn, maxEd: mx, deltaHist: hist };
}

// Pool shape: gold OVR distribution and the rare cut
const golds = Object.values(pool.buckets.gold).flat();
const goldBands: Record<string, number> = {};
for (const rc of golds) goldBands[band(rc.ovr)] = (goldBands[band(rc.ovr)] ?? 0) + 1;
const ri = rareInfo(pool);

// Scout Market for a month: price / quick-sell ratios by tag
const market: Record<string, { n: number; meanPrice: number; meanQs: number; meanOvr: number }> = {};
for (let d = 1; d <= 28; d++) {
  const day = '2026-11-' + String(d).padStart(2, '0');
  for (const it of marketFor(pool, day)) {
    const rc = pool.base.get(it.cardId)!;
    const m = (market[it.tag] ??= { n: 0, meanPrice: 0, meanQs: 0, meanOvr: 0 });
    m.n++; m.meanPrice += it.price; m.meanQs += quickSellValue(rc); m.meanOvr += rc.ovr;
  }
}
for (const m of Object.values(market)) { m.meanPrice = Math.round(m.meanPrice / m.n); m.meanQs = Math.round(m.meanQs / m.n); m.meanOvr = +(m.meanOvr / m.n).toFixed(1); }

const qsByTier: Record<string, [number, number, number]> = {};
for (const [t, b] of Object.entries(pool.buckets)) {
  const l = Object.values(b).flat();
  if (!l.length) continue;
  const v = l.map(quickSellValue).sort((a, b) => a - b);
  qsByTier[t] = [v[0], v[Math.floor(v.length / 2)], v[v.length - 1]];
}

const out = { sport, week, N, packs: results, live, standouts, uplift, goldPool: { n: golds.length, bands: goldBands, rareCut: ri.cut, rareN: ri.ids.size }, market, qsByTier, bucketSizes: Object.fromEntries(Object.entries(pool.buckets).map(([t, b]) => [t, Object.values(b).flat().length])) };
console.log('wrote', writeOut('packsim-' + sport + '.json', out), results.length, 'packs', live.length, 'live');
