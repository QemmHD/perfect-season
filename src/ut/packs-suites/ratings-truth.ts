/// <reference types="vite/client" />
// Claude (packs-5, 2026-11-16): the `ratings-truth` suite (docs/studio-overhaul/packs.md "packs-5"; plan D3,
// D4, owner decision 5). One module, run once per sport: ratings-truth.test.ts in the NBA and NFL runs,
// soccer-ratings-truth.test.ts in the soccer run. It proves:
//  - every Hot Season and Legend edition displays min(95, season + d) at levels 1 and 5 (d from honors,
//    or the legend's boost held to 3..6) and prints exactly the attributes the match plays;
//  - every GOAT and Spotlight keeps the player's shape (at most two face values at the cap, at least
//    three distinct values, Kendall τ ≥ 0.8 against the season card) and its tier floor;
//  - nothing outside those four kinds moved against the packs-1 fixture (gated on FOREIGN_FINGERPRINT);
//  - the frozen numbered catalog is untouched and the cards whose 90+ level moved are exactly the
//    OVR diff's crossing list;
//  - soccer Hot Seasons under 80 leave the pack buckets but still resolve when owned;
//  - Cups and Club Season keep judging a run by what was saved when it started.
// Test code only: no app module imports it.
import { beforeAll, describe, expect, it } from 'vitest';
import { pickFor, SPORT } from '../../engine/sport';
import { faceOf, shownFaceMean } from '../card-face';
import { cupOf, cupOpponent, startCup } from '../cup';
import { leagueBoost } from '../league';
import type { LeagueSeason, LeagueTeam } from '../league-state';
import { PACK_SHAPE, quickSell, quickSellValue } from '../packs';
import { CONTENT_PRINT, getPool, ratedOf, SOCCER_PROMO_MIN, type Pool } from '../pool';
import { editionDelta, EDITION_TOP, hotSeasonDelta, levelBonus } from '../rate';
import { SPECIAL_AT_CAP } from '../rating-quality';
import { canPlay, setSoccerFormation, slotsFor } from '../squad';
import { freshUt, type UtState } from '../state';
import type { RatedCard } from '../types';
import { diffSnapshot, numberedPrint, parseRow, rowsOf, SNAPSHOT_KINDS, takeSnapshot, type PacksSnapshot } from './snapshot';
import { at, crossingList, facePosOf, faceVals, kendallTau, playedFace, RERATED } from './truth-measure';

const FIXTURES = import.meta.glob<PacksSnapshot>('../__fixtures__/packs-before/*.json', { import: 'default' });
const fixture = () => FIXTURES['../__fixtures__/packs-before/' + SPORT + '.json']();
export const SPECIAL_CAP = { spotlight: 105, goat: 110 } as const;
export const SPECIAL_FLOOR = { spotlight: 100, goat: 106 } as const;
/**
 * The feasibility list (plan D4, `promoattrs.ts --feasibility`): cards that may show a third value at
 * the cap because two could not carry the tier floor. Measured empty in both sports on the base.
 */
export const FEASIBILITY: readonly string[] = [];

export function ratingsTruthSuite(): void {
  let pool: Pool;
  beforeAll(async () => {
    pool = await getPool();
  }, 120000);

  describe('the edition deltas (' + SPORT + ')', () => {
    it('earn 3..6 from honors (Hot Season) and hold a legend boost to 3..6', () => {
      expect(hotSeasonDelta({ honors: ['ALLNBA1', 'MVP'] })).toBe(6);
      expect(hotSeasonDelta({ honors: ['ALLPRO1', 'OPOY', 'PB'] })).toBe(6);
      expect(hotSeasonDelta({ honors: ['ALLPRO1', 'PB'] })).toBe(5);
      expect(hotSeasonDelta({ honors: ['DPOY', 'ALLDEF1'] })).toBe(5);
      expect(hotSeasonDelta({ honors: ['ALLNBA3', 'REB'] })).toBe(4);
      expect(hotSeasonDelta({ honors: ['ALLPRO2', 'PB'] })).toBe(4);
      expect(hotSeasonDelta({ honors: ['SCORING'] })).toBe(3);
      expect(hotSeasonDelta({ honors: ['PB'] })).toBe(3);
      expect(hotSeasonDelta({ honors: [] })).toBe(3);
      expect(editionDelta({ kind: 'legend', honors: ['MVP'], boost: 2 })).toBe(3);
      expect(editionDelta({ kind: 'legend', honors: [], boost: 8 })).toBe(6);
      expect(editionDelta({ kind: 'legend', honors: [], boost: 5 })).toBe(5);
      expect(CONTENT_PRINT).toBe('ut-content-5');
    });
  });

  if (SPORT !== 'soccer') {
    describe('Hot Season and Legend: shown is played (' + SPORT + ')', () => {
      for (const kind of ['promo', 'legend'] as const)
        it(kind + ': every edition at levels 1 and 5 displays min(95, season + d) and prints its played attributes', () => {
          const bad: string[] = [];
          let n = 0;
          for (const rc0 of Object.values(pool.buckets[kind]).flat()) {
            const season = pool.base.get(rc0.line.seasonId!)!;
            const want = Math.min(EDITION_TOP, season.ovr + editionDelta(rc0.line));
            for (const level of [1, 5]) {
              const rc = at(pool, rc0, level);
              n++;
              if (rc.ovr !== want + levelBonus(level)) bad.push(rc.line.id + ' L' + level + ' shows ' + rc.ovr + ', wants ' + (want + levelBonus(level)));
              if (rc.tier !== kind) bad.push(rc.line.id + ' tier ' + rc.tier);
              const played = playedFace(rc);
              faceVals(rc).forEach((v, i) => Math.abs(v - played[i]) > 1 && bad.push(rc.line.id + ' L' + level + ' face ' + (rc.face ?? rc.key)[i][0] + ' ' + v + ' plays ' + played[i]));
            }
          }
          expect(n).toBeGreaterThan(pickFor(SPORT, { nba: 200, nfl: 200, soccer: 0 }));
          expect(bad.slice(0, 10)).toEqual([]);
        });

      it('raises measured speed by at most half the delta (an honored season is not a faster one)', () => {
        const codes = pickFor(SPORT, { nba: ['SPD', 'ACC'], nfl: ['SPD', 'ACC', 'AGI'], soccer: [] as string[] });
        const bad: string[] = [];
        for (const kind of ['promo', 'legend'] as const)
          for (const rc of Object.values(pool.buckets[kind]).flat()) {
            const season = pool.base.get(rc.line.seasonId!)!;
            for (const c of codes)
              if (typeof season.attrs[c] === 'number' && rc.attrs[c] - season.attrs[c] > Math.ceil(editionDelta(rc.line) / 2)) bad.push(rc.line.id + ' ' + c + ' ' + season.attrs[c] + ' → ' + rc.attrs[c]);
          }
        expect(bad.slice(0, 10)).toEqual([]);
      });

      it('reads as close to its face as its season card does (up to 90, where the displayed scale reaches)', () => {
        // The displayed curve tops out at 91 (ut-scale.ts), so a 91-95 edition's weighted face sits under its
        // number; there the face is as high as the played attributes go, and the gap is reported in packs.md.
        // Season cards themselves sit up to 3-4 over their face (card-face.ts supportOverall), so an edition
        // is held to its season card's gap (at least 1): 95% within two more points, none more than five
        // (basketball's categories blend attributes that top out at 91 on the displayed scale one by one: Jerry
        // Lucas '65/'68 already print REB 91 and CLS/IND 99 on the rating scale, so a +5 edition's face can rise
        // only through its two +1 lifts; his speed, which an edition raises by half, barely weighs).
        const gapOf = (rc: RatedCard) => rc.ovr - Math.round(shownFaceMean(SPORT, facePosOf(rc), rc.attrs));
        let n = 0,
          close = 0;
        const bad: string[] = [];
        for (const kind of ['promo', 'legend'] as const)
          for (const rc of Object.values(pool.buckets[kind]).flat()) {
            if (rc.ovr > 90) continue;
            const over = gapOf(rc) - Math.max(1, gapOf(pool.base.get(rc.line.seasonId!)!));
            n++;
            if (over <= 2) close++;
            if (over > 5) bad.push(rc.line.id + ' ' + rc.ovr + ' reads ' + over + ' further from its face than its season');
          }
        expect(n).toBeGreaterThan(100);
        expect(close / n).toBeGreaterThanOrEqual(0.95);
        expect(bad).toEqual([]);
      });

      it('sells a Hot Season on the D2 line, 650 + 50 a point over 80 (times the sport’s factor)', () => {
        for (const rc of Object.values(pool.buckets.promo).flat().filter((_, i) => i % 7 === 0)) expect(quickSellValue(rc)).toBe(quickSell('promo', rc.ovr, SPORT));
        const k = PACK_SHAPE[SPORT].qs;
        expect(quickSell('promo', 80, SPORT)).toBe(Math.round((650 * k) / 5) * 5);
        expect(quickSell('promo', 70, SPORT)).toBe(Math.round((650 * k) / 5) * 5);
        expect(quickSell('promo', 97, SPORT)).toBe(Math.round((1500 * k) / 5) * 5);
      });
    });

    describe('GOAT and Spotlight keep the player’s shape (' + SPORT + ')', () => {
      for (const kind of ['spotlight', 'goat'] as const)
        it(kind + ': at most two face values at the cap, three distinct, τ ≥ 0.8, the floor', () => {
          const cap = SPECIAL_CAP[kind];
          const bad: string[] = [];
          const list = Object.values(pool.buckets[kind]).flat();
          expect(list.length).toBeGreaterThan(100 * (kind === 'spotlight' ? 1 : 0.15));
          for (const rc0 of list)
            for (const level of [1, 5]) {
              const rc = at(pool, rc0, level);
              const face = faceVals(rc);
              const allowed = FEASIBILITY.includes(rc.line.id) ? SPECIAL_AT_CAP + 1 : SPECIAL_AT_CAP;
              const atCap = face.filter((v) => v >= cap).length;
              if (atCap > allowed) bad.push(rc.line.id + ' L' + level + ' ' + atCap + ' at the cap');
              if (Object.values(rc.attrs).filter((v) => v >= cap).length > allowed) bad.push(rc.line.id + ' L' + level + ' attributes at the cap');
              if (new Set(face).size < 3) bad.push(rc.line.id + ' L' + level + ' ' + new Set(face).size + ' distinct');
              if (rc.ovr < SPECIAL_FLOOR[kind]) bad.push(rc.line.id + ' L' + level + ' under the floor ' + rc.ovr);
              if (rc.rawOvr! < SPECIAL_FLOOR[kind]) bad.push(rc.line.id + ' raw under the floor');
              // against the season card's own shape (level 1: its rating-scale face, before any 99 ceiling
              // a level would add)
              const season = pool.base.get(rc.line.seasonId!)!;
              const ref = faceOf(SPORT, facePosOf(season), season.attrs, 99).map(([, , v]) => v);
              const tau = kendallTau(ref, face);
              // the shape is the edition's (level 1); a level adds to the six position keys, which basketball's
              // categories blend unevenly on every card, so τ is the level-1 card's
              if (level === 1 && tau < 0.8) bad.push(rc.line.id + ' L' + level + ' τ ' + tau.toFixed(2));
              if (Math.max(...ref) - Math.min(...ref) >= 10 && Math.min(...face) > Math.max(...face) - 8) bad.push(rc.line.id + ' L' + level + ' weakness flattened');
            }
          expect(bad.slice(0, 10)).toEqual([]);
        });

      it('reads like the player (Brady GOAT a pocket passer with two values at 110; Kareem’s skyhook over his three)', () => {
        const goat = (name: string) => Object.values(pool.buckets.goat).flat().find((rc) => rc.line.name.includes(name))!;
        if (SPORT === 'nfl') {
          const b = goat('Tom Brady');
          expect(faceVals(b).filter((v) => v >= 110).length).toBeLessThanOrEqual(2);
          expect(b.attrs.SPD).toBeLessThan(70);
          expect(b.attrs.SAC).toBeGreaterThan(99);
          expect(b.ovr).toBeGreaterThanOrEqual(106);
        } else {
          const k = goat('Kareem');
          expect(k.attrs.CLS).toBeGreaterThan(k.attrs['3PT'] + 20);
          expect(k.ovr).toBeGreaterThanOrEqual(106);
        }
      });
    });

    describe('the frozen numbered catalog (' + SPORT + ')', () => {
      it('is untouched, and the editions whose first 90+ level moved are the OVR diff’s crossing list', async () => {
        // eligibility is frozen (docs/CARD-CIRCULATION.md): the committed catalogs never follow a re-rate,
        // so the cards whose catalog level the generator would now move go to the lead, and they must be
        // exactly the OVR diff's crossing list
        const before = await fixture();
        if (takeSnapshot(pool).foreignFingerprint !== before.foreignFingerprint) throw new Error('foreign rating modules changed: run scripts/packs/rebaseline.ts, review the OVR diff, accept');
        expect(numberedPrint()).toEqual(before.numbered);
        const first = (ovr: number[]) => ovr.findIndex((o) => o >= 90);
        const moved: string[] = [];
        for (const kind of RERATED) {
          const old = rowsOf(before, kind);
          for (const rc of Object.values(pool.buckets[kind]).flat()) {
            const was = old.get(rc.line.id);
            if (was && first(parseRow(was, kind).ovr) !== first([1, 2, 3, 4, 5].map((l) => at(pool, rc, l).ovr))) moved.push(rc.line.id);
          }
        }
        expect(moved.sort()).toEqual(crossingList(pool, before));
      }, 120000);
    });
  }

  describe('nothing else moved (' + SPORT + ')', () => {
    it('every edition outside Hot Season, Legend, Spotlight and GOAT equals the packs-1 fixture', async () => {
      const before = await fixture();
      const now = takeSnapshot(pool);
      if (now.foreignFingerprint !== before.foreignFingerprint) throw new Error('foreign rating modules changed: run scripts/packs/rebaseline.ts, review the OVR diff, accept (' + JSON.stringify(diffSnapshot(before, now).foreign) + ')');
      for (const kind of SNAPSHOT_KINDS) if (!(RERATED as readonly string[]).includes(kind)) expect(now.ratings[kind], kind).toEqual(before.ratings[kind]);
      expect(now.receipts).toEqual(before.receipts);
      expect(now.numbered).toEqual(before.numbered);
    }, 60000);
  });

  if (SPORT === 'soccer') {
    describe('soccer Hot Season buckets (L4)', () => {
      it('hold no promo under 80; one under 80 still resolves when owned; the rest equal the fixture', async () => {
        const before = await fixture();
        const inBuckets = Object.values(pool.buckets.promo).flat();
        expect(inBuckets.length).toBeGreaterThan(0);
        expect(inBuckets.filter((rc) => rc.ovr < SOCCER_PROMO_MIN)).toEqual([]);
        const low = pool.lines.filter((l) => l.kind === 'promo').map((l) => pool.base.get(l.id)!).filter((rc) => rc.ovr < SOCCER_PROMO_MIN);
        expect(low.length).toBeGreaterThan(0);
        for (const rc of low) {
          expect(ratedOf(pool, { cardId: rc.line.id, level: 1 })?.line.id).toBe(rc.line.id);
          expect(ratedOf(pool, { cardId: rc.line.id, level: 5 })?.ovr).toBe(rc.ovr + levelBonus(5));
        }
        // soccer's own editions are not re-rated: every promo still in the buckets is the fixture's row,
        // and the fixture's rows that left are exactly the under-80 ones
        const now = takeSnapshot(pool).ratings.promo;
        for (const [id, row] of Object.entries(now)) expect(row, id).toBe(before.ratings.promo[id]);
        const left = Object.keys(before.ratings.promo).filter((id) => !(id in now));
        expect(left.length).toBe(low.length);
        for (const k of ['legend'] as const) expect(takeSnapshot(pool).ratings[k]).toEqual(before.ratings[k]);
      }, 60000);
    });
  }

  describe('runs keep their entry snapshot (' + SPORT + ')', () => {
    function club(prefer: (c: RatedCard) => boolean): UtState {
      setSoccerFormation('4-3-3');
      const ut = freshUt(),
        all = [...pool.base.values()],
        used = new Set<string>();
      for (const slot of slotsFor(SPORT).filter((s) => s.weight > 0)) {
        const fits = all.filter((c) => canPlay(slot, c) && !used.has(c.line.pid));
        const rc = fits.find(prefer) ?? fits[0];
        used.add(rc.line.pid);
        const uid = 'entry:' + slot.id;
        ut.owned.push({ uid, cardId: rc.line.id, level: 1, xp: 0, at: 1 });
        ut.squad[slot.id] = uid;
      }
      return ut;
    }

    it('a Cup sets its opponents from the squad rating saved at entry, not today’s re-rated squad', () => {
      const ut = club((c) => c.tier === 'promo' || c.tier === 'gold');
      const run = startCup(ut, pool, 'open', 'entry-run', 10, '2026-W46', 'pro');
      const a = cupOf(run).active!;
      // the same run as if it had been entered before the re-rate, when the squad rated 6 higher
      const older: UtState = { ...run, cup: { ...cupOf(run), active: { ...a, anchor: a.anchor + 6 } } };
      const now = cupOpponent(pool, run, { runId: a.id, round: 0 })!;
      const then = cupOpponent(pool, older, { runId: a.id, round: 0 })!;
      expect(now).not.toBeNull();
      expect(then).not.toBeNull();
      expect(then.rung.target - now.rung.target).toBe(Math.min(6, Math.max(0, pickFor(SPORT, { nba: 107, nfl: 107, soccer: 97 }) - now.rung.target)));
    });

    it('a Silver Cup judges each card at its entry level, so levelling after entry never disqualifies', () => {
      const ut = club((c) => c.tier === 'silver' && c.ovr >= 73);
      const run = startCup(ut, pool, 'silver', 'silver-run', 10, '2026-W46', 'pro');
      const levelled: UtState = { ...run, owned: run.owned.map((c) => ({ ...c, level: 5 })) };
      const a = cupOf(levelled).active!;
      expect(levelled.owned.some((c) => ratedOf(pool, c)!.ovr > 74)).toBe(true);
      expect(cupOpponent(pool, levelled, { runId: a.id, round: 0 })).not.toBeNull();
    });

    it('Club Season keeps the overall saved at its start, and a drop moves its AI by at most 4', () => {
      const s = { anchor: 92, clubOvr: 80, adaptive: 0 } as unknown as LeagueSeason;
      const t = { form: 0 } as unknown as LeagueTeam;
      expect(leagueBoost(s, t)).toBe(-4);
      expect(leagueBoost({ ...s, clubOvr: 90 } as LeagueSeason, t)).toBeCloseTo(-0.7, 5);
    });
  });
}
