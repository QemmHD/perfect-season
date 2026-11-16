// Claude (packs-2, 2026-11-16): the `drop-tables` suite (docs/studio-overhaul/packs.md "Scout Drops"). One
// module, run once per sport: drop-tables.test.ts in the NBA and NFL runs, soccer-drop-tables.test.ts in the
// soccer run. It proves the Scout Drop tables ut's drop screen shows and rolls: exact final odds that equal
// 200,000 rolls, the published numbers, the expected value, determinism, honest paths and a light module.
// Test code only: no app module imports it.
/// <reference types="vite/client" />
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../../engine/sport';
import { DROP_TIERS, dropEv, type DropIndex, dropOdds, dropTable, PACK_VALUE, rollDrop } from '../drop-tables';
import { openPack, quickSellValue } from '../packs';
import { getPool, type Pool } from '../pool';

const SOURCE = import.meta.glob<string>('../drop-tables.ts', { query: '?raw', import: 'default', eager: true });
const INDEXES: DropIndex[] = [1, 2, 3];

export function dropTablesSuite(): void {
  describe('Scout Drop tables (' + SPORT + ')', () => {
    it('publishes the planned final odds exactly: drops 2–3 51.2 / 36.05 / 11.25 / 1.5%, drop 1 65.0 / 26.25 / 7.44 / 1.31%', () => {
      for (const i of INDEXES) expect(DROP_TIERS.reduce((a, t) => a + dropOdds(SPORT, i)[t], 0)).toBeCloseTo(1, 12);
      for (const i of [2, 3] as DropIndex[]) {
        const o = dropOdds(SPORT, i);
        expect(o.common).toBeCloseTo(0.512, 12);
        expect(o.rare).toBeCloseTo(0.3605, 12);
        expect(o.epic).toBeCloseTo(0.1125, 12);
        expect(o.legendary).toBeCloseTo(0.015, 12);
      }
      const one = dropOdds(SPORT, 1);
      expect(one.common).toBeCloseTo(0.65, 12);
      expect(one.rare).toBeCloseTo(0.2625, 12);
      expect(Math.round(one.epic * 10000) / 100).toBe(7.44);
      expect(Math.round(one.legendary * 10000) / 100).toBe(1.31);
      // drop 1 is ut's Scout Reveal: a Silver Pack + 100 coins upgrading to Gold, Premium, Jumbo
      expect(DROP_TIERS.map((t) => dropTable(SPORT, 1).rewards[t].pack)).toEqual(['silver', 'gold', 'premium', 'jumbo']);
      expect(DROP_TIERS.every((t) => dropTable(SPORT, 1).rewards[t].coins === 100)).toBe(true);
    });

    it('equals 200,000 rolls within 0.5 pt, for every drop', () => {
      for (const i of INDEXES) {
        const n = 200000;
        const seen: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
        for (let k = 0; k < n; k++) seen[rollDrop('scout-drop:p1:' + SPORT + ':2026-12-01:' + i + ':' + k, SPORT, i).tier]++;
        const o = dropOdds(SPORT, i);
        for (const t of DROP_TIERS) expect(Math.abs((100 * seen[t]) / n - 100 * o[t]), i + ' ' + t).toBeLessThan(0.5);
      }
    });

    it('rolls the same for the same seed, and its path never skips or teases a tier', () => {
      for (let k = 0; k < 5000; k++) {
        const i = INDEXES[k % 3];
        const seed = 'scout-drop:p2:' + SPORT + ':2026-12-02:' + i + ':' + k;
        const r = rollDrop(seed, SPORT, i);
        expect(rollDrop(seed, SPORT, i)).toEqual(r);
        expect(r.path).toHaveLength(3);
        expect(r.path[2]).toBe(r.tier);
        let prev = DROP_TIERS.indexOf(dropTable(SPORT, i).start);
        let missed = false;
        for (const t of r.path) {
          const j = DROP_TIERS.indexOf(t);
          expect(j - prev === 0 || j - prev === 1).toBe(true);
          // drop 1 settles on its first miss: nothing moves after it
          if (i === 1 && missed) expect(j).toBe(prev);
          if (j === prev) missed = true;
          prev = j;
        }
        expect(r.reward).toEqual(dropTable(SPORT, i).rewards[r.tier]);
      }
    });

    it('drops 2–3 are worth 35–45 coin-equivalents', () => {
      for (const i of [2, 3] as DropIndex[]) {
        expect(dropEv(SPORT, i)).toBeGreaterThanOrEqual(35);
        expect(dropEv(SPORT, i)).toBeLessThanOrEqual(45);
      }
    });

    it('imports nothing heavy (only the seeded rng and types)', () => {
      const src = Object.values(SOURCE)[0];
      const imports = [...src.matchAll(/^import\s.*?from\s+'([^']+)'/gm)].map((m) => m[1]);
      expect(imports.sort()).toEqual(['../engine/rng', './types']);
    });
  });

  describe('Scout Drop pack values (' + SPORT + ')', () => {
    let pool: Pool;
    beforeAll(async () => {
      pool = await getPool();
    }, 120000);

    it('values each pack within 12% of its real quick-sell average', () => {
      for (const kind of ['silver', 'gold', 'premium', 'jumbo'] as const) {
        const n = 1500;
        let qs = 0;
        for (let i = 0; i < n; i++) qs += openPack(pool, kind, 'drop-value:' + kind + ':' + i, '2026-W46').reduce((a, c) => a + quickSellValue(c), 0);
        expect(Math.abs(PACK_VALUE[SPORT][kind] / (qs / n) - 1), kind + ' ' + Math.round(qs / n)).toBeLessThan(0.12);
      }
    });
  });
}
