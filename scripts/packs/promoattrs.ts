// Claude (packs-1, 2026-11-10), ported from the packs/promos audit (promoattrs.ts + promoattrs2.ts),
// read-only: what a special card shows against what the match plays (audit C4, H7).
//   PACKS_OUT=<dir> PACKSIM_LABEL=before PS_SPORT=nfl npx vite-node scripts/packs/promoattrs.ts [-- --feasibility]
// Default: Hot Season and Legend cards against their season card (shown overall, raw overall, face vs
// played attributes), and the GOAT/Spotlight faces (how many values sit at the tier's cap).
// --feasibility (packs plan D4): the GOAT/Spotlight cards where "at most 2 face values at the cap, at
// least 3 distinct" (rule 1) conflicts with the tier floor (rule 3, Spotlight 100+, GOAT 106+). Model: the
// face keeps its order, its two best values stay at the cap and every other value at the cap drops to
// cap - 1 (the lowest to cap - 2 when that leaves fewer than 3 distinct values). The card's own gap
// between its displayed overall and its face mean is kept, so the overall falls by as much as the face
// mean does; a card conflicts when that lands under the tier floor.
import { getPool } from '../../src/ut/pool';
import type { RatedCard } from '../../src/ut/types';
import { writeOut } from './out';

const pool = await getPool();
const sport = pool.sport;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const faceOf = (rc: RatedCard) => (rc.face ?? rc.key).map(([c, , v]) => [c, v] as [string, number]);
const attrMean = (rc: RatedCard) => mean(Object.values(rc.attrs));
const CAP: Record<string, number> = { spotlight: 105, goat: 110 };
const FLOOR: Record<string, number> = { spotlight: 100, goat: 106 };

if (process.argv.includes('--feasibility')) {
  const rows: unknown[] = [];
  let conflicts = 0;
  for (const tier of ['spotlight', 'goat'] as const) {
    for (const rc of Object.values(pool.buckets[tier]).flat()) {
      const cap = CAP[tier];
      const face = faceOf(rc);
      const order = face.map((_, i) => i).sort((a, b) => face[b][1] - face[a][1]);
      const capped = face.map(([, v]) => v);
      order.forEach((i, rank) => {
        if (rank >= 2 && capped[i] >= cap) capped[i] = cap - 1;
      });
      // at least three distinct values: the lowest at cap - 1 steps down once more when needed
      if (new Set(capped).size < 3) {
        const i = order[order.length - 1];
        capped[i] = Math.min(capped[i], cap - 2);
      }
      const atCap = face.filter(([, v]) => v >= cap).length;
      const drop = mean(face.map(([, v]) => v)) - mean(capped);
      const implied = rc.ovr - drop;
      const conflict = Math.round(implied) < FLOOR[tier];
      if (conflict) conflicts++;
      rows.push({ id: rc.line.id, name: rc.line.name + ' ' + rc.line.season, tier, ovr: rc.ovr, atCap, distinct: new Set(face.map(([, v]) => v)).size, face: face.map(([c, v]) => c + v).join(' '), faceMeanDrop: +drop.toFixed(2), impliedOvr: +implied.toFixed(2), conflict });
    }
  }
  const summary = { sport, cards: rows.length, conflicts, atCapHist: rows.reduce((h: Record<number, number>, r) => ((h[(r as { atCap: number }).atCap] = (h[(r as { atCap: number }).atCap] ?? 0) + 1), h), {}) };
  console.log(JSON.stringify(summary));
  console.log('wrote', writeOut('promoattrs-feasibility-' + sport + '.json', { summary, rows }));
} else {
  const show = (rc: RatedCard) => ({ name: rc.line.name + ' ' + rc.line.season, tier: rc.tier, shown: rc.ovr, raw: rc.rawOvr ?? null, boost: rc.line.boost ?? 0, face: faceOf(rc).map(([c, v]) => c + v).join(' '), played: faceOf(rc).map(([c]) => c + (rc.attrs[c] ?? '?')).join(' ') });
  const out: Record<string, unknown> = { sport };
  for (const tier of ['promo', 'legend'] as const) {
    const list = Object.values(pool.buckets[tier]).flat();
    if (!list.length) continue;
    const rows = list.map((p) => {
      const b = pool.base.get(p.line.seasonId!)!;
      // the largest gap between a face value and the attribute the match reads for it
      const gap = Math.max(...faceOf(p).map(([c, v]) => v - (p.attrs[c] ?? v)));
      return { ...show(p), baseShown: b.ovr, baseRaw: b.rawOvr ?? null, attrGain: +(attrMean(p) - attrMean(b)).toFixed(1), faceOverPlayed: gap };
    });
    rows.sort((a, b) => (a.raw ?? 0) - (b.raw ?? 0));
    const gaps = rows.map((r) => r.shown - (r.raw ?? r.shown));
    out[tier] = {
      n: rows.length,
      shownMinusRawMean: +mean(gaps).toFixed(1),
      rawUnder85: rows.filter((r) => (r.raw ?? 99) < 85).length,
      rawUnder80: rows.filter((r) => (r.raw ?? 99) < 80).length,
      builtOnBronzeOrSilver: rows.filter((r) => r.baseShown < 75).length,
      faceOverPlayedMax: Math.max(...rows.map((r) => r.faceOverPlayed)),
      faceOverPlayedOver1: rows.filter((r) => r.faceOverPlayed > 1).length,
      lowestRaw: rows.slice(0, 5),
    };
  }
  for (const tier of ['spotlight', 'goat'] as const) {
    const list = Object.values(pool.buckets[tier]).flat();
    if (!list.length) continue;
    const atCap = list.map((rc) => faceOf(rc).filter(([, v]) => v >= CAP[tier]).length);
    out[tier] = { n: list.length, faceAtCapMean: +mean(atCap).toFixed(2), faceAtCapMax: Math.max(...atCap), example: show(list.slice().sort((a, b) => b.ovr - a.ovr)[0]) };
  }
  console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, typeof v === 'object' && v ? Object.fromEntries(Object.entries(v).filter(([kk]) => kk !== 'lowestRaw' && kk !== 'example')) : v]))));
  console.log('wrote', writeOut('promoattrs-' + sport + '.json', out));
}
