// Claude (packs-1, 2026-11-10), ported from the packs/promos audit (promoattrs.ts + promoattrs2.ts),
// read-only: what a special card shows against what the match plays (audit C4, H7).
//   PACKS_OUT=<dir> PACKSIM_LABEL=before PS_SPORT=nfl npx vite-node scripts/packs/promoattrs.ts [-- --feasibility]
// Default (packs-5 measure, plan D3/D4), at levels 1 and 5:
//  - Hot Season and Legend: the displayed overall against the season card's (the delta histogram), each
//    face value against the played attributes on the displayed scale (`|face − played|`), and the
//    displayed overall against the weighted face it prints (`shown − round(shownFaceMean)`).
//  - GOAT and Spotlight: face values at the tier's cap, distinct face values, Kendall τ of the face
//    against the season card's face (rating scale), and the tier floor.
// --feasibility (packs plan D4): the GOAT/Spotlight cards where "at most 2 face values at the cap, at
// least 3 distinct" (rule 1) conflicts with the tier floor (rule 3, Spotlight 100+, GOAT 106+). Model: the
// face keeps its order, its two best values stay at the cap and every other value at the cap drops to
// cap - 1 (the lowest to cap - 2 when that leaves fewer than 3 distinct values). The card's own gap
// between its displayed overall and its face mean is kept, so the overall falls by as much as the face
// mean does; a card conflicts when that lands under the tier floor.
// Self-contained on purpose (only pool, rate and card-face exports that predate packs-5), so the same
// file measures an older tree.
import { getPool } from '../../src/ut/pool';
import { rateCard } from '../../src/ut/rate';
import { faceOf, shownFaceMean } from '../../src/ut/card-face';
import { toDisplay } from '../../src/ut/ut-scale';
import type { RatedCard } from '../../src/ut/types';
import { writeOut } from './out';

const pool = await getPool();
const sport = pool.sport;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const faceVals = (rc: RatedCard) => (rc.face ?? rc.key).map(([, , v]) => v);
const CAP: Record<string, number> = { spotlight: 105, goat: 110 };
const FLOOR: Record<string, number> = { spotlight: 100, goat: 106 };
/** the position a card's face is weighed at (rate.ts: basketball's own listed position, else SF) */
const facePos = (rc: RatedCard) => (sport === 'nba' ? (['PG', 'SG', 'SF', 'PF', 'C'].includes(rc.line.pos[0]) ? rc.line.pos[0] : 'SF') : rc.pos);
const hist = (xs: number[]) => xs.reduce((h: Record<number, number>, x) => ((h[x] = (h[x] ?? 0) + 1), h), {});
/** Kendall τ-b of two equal-length lists */
function tau(a: number[], b: number[]): number {
  let c = 0,
    d = 0,
    ta = 0,
    tb = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const x = Math.sign(a[i] - a[j]),
        y = Math.sign(b[i] - b[j]);
      if (x === 0 && y === 0) continue;
      if (x === 0) ta++;
      else if (y === 0) tb++;
      else if (x === y) c++;
      else d++;
    }
  const den = Math.sqrt((c + d + ta) * (c + d + tb));
  return den ? (c - d) / den : 1;
}
const levelOf = (rc: RatedCard, level: number) => (level === 1 ? rc : rateCard(pool.byId.get(rc.line.id) ?? rc.line, level));

if (process.argv.includes('--feasibility')) {
  const rows: unknown[] = [];
  let conflicts = 0;
  for (const tier of ['spotlight', 'goat'] as const) {
    for (const rc of Object.values(pool.buckets[tier]).flat()) {
      const cap = CAP[tier];
      const face = (rc.face ?? rc.key).map(([c, , v]) => [c, v] as [string, number]);
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
  const summary = { sport, cards: rows.length, conflicts, conflictIds: rows.filter((r) => (r as { conflict: boolean }).conflict).map((r) => (r as { id: string }).id), atCapHist: hist(rows.map((r) => (r as { atCap: number }).atCap)) };
  console.log(JSON.stringify(summary));
  console.log('wrote', writeOut('promoattrs-feasibility-' + sport + '.json', { summary, rows }));
} else {
  const out: Record<string, unknown> = { sport };
  for (const tier of ['promo', 'legend'] as const) {
    const list = Object.values(pool.buckets[tier]).flat();
    if (!list.length || sport === 'soccer') continue;
    for (const level of [1, 5]) {
      const rows = list.map((p0) => {
        const p = levelOf(p0, level);
        const season = pool.base.get(p.line.seasonId!)!;
        const pos = facePos(p);
        const played = faceOf(sport, pos, p.attrs, 99).map(([, , v]) => Math.round(toDisplay(sport, v)));
        const face = faceVals(p);
        return {
          id: p.line.id,
          name: p.line.name + ' ' + p.line.season,
          shown: p.ovr,
          season: season.ovr,
          raw: p.rawOvr ?? null,
          faceGap: Math.max(...face.map((v, i) => Math.abs(v - played[i]))),
          meanGap: p.ovr - Math.round(shownFaceMean(sport, pos, p.attrs)),
          face: (p.face ?? p.key).map(([c, , v]) => c + v).join(' '),
          played: played.join(' '),
        };
      });
      rows.sort((a, b) => b.faceGap - a.faceGap || b.meanGap - a.meanGap);
      out[tier + '@' + level] = {
        n: rows.length,
        shown: [Math.min(...rows.map((r) => r.shown)), Math.max(...rows.map((r) => r.shown))],
        overSeasonMean: +mean(rows.map((r) => r.shown - r.season)).toFixed(2),
        overSeason: hist(rows.map((r) => r.shown - r.season - (level === 5 ? 2 : 0))),
        rawUnder85: rows.filter((r) => (r.raw ?? 99) < 85).length,
        faceOverPlayedMax: Math.max(...rows.map((r) => r.faceGap)),
        faceOverPlayedOver1: rows.filter((r) => r.faceGap > 1).length,
        meanGapMax: Math.max(...rows.map((r) => r.meanGap)),
        meanGapOver1: rows.filter((r) => Math.abs(r.meanGap) > 1).length,
        meanGapHist: hist(rows.map((r) => r.meanGap)),
        worst: rows.slice(0, 5),
      };
    }
  }
  for (const tier of ['spotlight', 'goat'] as const) {
    const list = Object.values(pool.buckets[tier]).flat();
    if (!list.length) continue;
    for (const level of [1, 5]) {
      const rows = list.map((p0) => {
        const rc = levelOf(p0, level);
        const season = pool.base.get(rc.line.seasonId!)!;
        const face = faceVals(rc);
        const ref = faceOf(sport, facePos(season), season.attrs, 99).map(([, , v]) => v);
        return { id: rc.line.id, name: rc.line.name + ' ' + rc.line.season, ovr: rc.ovr, atCap: face.filter((v) => v >= CAP[tier]).length, distinct: new Set(face).size, tau: +tau(ref, face).toFixed(3), spread: Math.max(...face) - Math.min(...face), face: (rc.face ?? rc.key).map(([c, , v]) => c + v).join(' ') };
      });
      out[tier + '@' + level] = {
        n: rows.length,
        ovr: [Math.min(...rows.map((r) => r.ovr)), Math.max(...rows.map((r) => r.ovr))],
        underFloor: rows.filter((r) => r.ovr < FLOOR[tier]).length,
        atCapHist: hist(rows.map((r) => r.atCap)),
        faceAtCapMean: +mean(rows.map((r) => r.atCap)).toFixed(2),
        distinctMin: Math.min(...rows.map((r) => r.distinct)),
        tauMin: Math.min(...rows.map((r) => r.tau)),
        tauUnder08: rows.filter((r) => r.tau < 0.8).length,
        examples: rows.filter((r) => /Brady|Kareem|Jordan|Curry|O.Neal/.test(r.name)).slice(0, 8),
      };
    }
  }
  console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, typeof v === 'object' && v ? Object.fromEntries(Object.entries(v).filter(([kk]) => kk !== 'worst' && kk !== 'examples')) : v]))));
  console.log('wrote', writeOut('promoattrs-' + sport + '.json', out));
}
