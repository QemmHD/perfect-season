// Claude (packs-4, 2026-11-16): the `odds` suite (docs/studio-overhaul/packs.md "packs-4"). One module, run
// once per sport: odds.test.ts in the NBA and NFL runs, soccer-odds.test.ts in the soccer run. It proves
// that every published number (odds.ts) is what the real draws do: every sold pack, the Daily Drop, the
// Preview Pack, program packs (boosted and not), Club Collection defaults and Spotlight against 10,000
// seeded openings; every pick against 10,000 option draws; every random SBC reward of the 60-day
// catalogue against 10,000 rewardCard draws; the Scout Drop sheet against dropOdds exactly. It also pins
// fmtPct, the route cost, the buy confirm's rules, the Pack Tracker's exact expectations, the sheet's
// speed and the old-save handling of the new `prefs`. Test code only.
import { beforeAll, describe, expect, it } from 'vitest';
import { chaseTier } from '../../../supabase/functions/card-registry/contract';
import { hashString, rng, shuffle } from '../../engine/rng';
import { SPORT } from '../../engine/sport';
import { STUDIO_PACKS } from '../../admin/catalog';
import { addDays, schedule } from '../calendar';
import { goldOptions, GOLD_PICKS, programPickSource, scoutOptions, standoutOptions } from '../content-packs';
import { normalizeContent, withPrefs } from '../content-state';
import { legacyNormalizeContent } from '../__fixtures__/legacy-content-state';
import { calendarPickOptions } from '../daily-hub';
import { DROP_TIERS, dropOdds, dropTable } from '../drop-tables';
import { fcToDisplay } from '../fc-scale';
import { boostWindows, easternAt, easternParts, weekMonday } from '../flash';
import { livePick, livePacksOn as packsOnDay, packOfKind } from '../live-packs';
import { ALWAYS_CONFIRM_FROM, CONFIRM_FROM, confirmFor, dropSheet, fmtPct, hasPickOdds, headline, ODDS_UPDATED, oddsFor, oddsTable, oneIn, pickTable, pickTableNow, premiumChanceAtLeast, rewardOdds, routeCost, type OddsTable } from '../odds';
import { FLOORS, goldDist, isFloorKind, LEGEND_PREMIUM, openPack, packDefs, positionChoices, registeredPack } from '../packs';
import { getPool, type Pool } from '../pool';
import { shelfPickKind } from '../stamp-shelf';
import { expectedFor } from '../pull-log';
import { rewardCard, sbcsFor, weekOf, type Reward } from '../sbc';
import { drawStandout } from '../standouts';
import { programReward } from '../live-cards';
import { parseVariant } from '../variants';
import { packEv } from '../value';
import type { RatedCard } from '../types';

const N = 10000;
/** Thursday 2026-11-12, noon Eastern: Weekly Standouts week 2026-W46. */
const AT = easternAt('2026-11-12', 12);
const DAY = '2026-11-12';
const W = weekOf(DAY);
const TOL = 0.015;
const HOLO_TOL = 0.005;
/** Every Store kind sold for coins, plus the free Daily Drop. */
const SOLD = ['bronze', 'silver', 'gold', 'premium', 'elite', 'jumbo', 'standout', 'lightning', 'daily', ...STUDIO_PACKS] as const;

const baseId = (id: string) => parseVariant(id)?.base ?? id;

/** The share of `packs` that have at least one card meeting each of the table's rows. */
function measure(t: OddsTable, packs: Iterable<RatedCard[]>): { rows: Map<string, number>; holo: number; featured: number } {
  const counts = new Map<string, number>();
  let holo = 0;
  let featured = 0;
  let n = 0;
  const ids = new Set(t.featured?.ids ?? []);
  for (const cards of packs) {
    n++;
    for (const b of t.bands) if (cards.some((c) => c.ovr >= fcToDisplay(Number(b.key.slice(1)), SPORT))) counts.set(b.key, (counts.get(b.key) ?? 0) + 1);
    for (const r of t.tiers) if (cards.some((c) => 't-' + c.tier === r.key)) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);
    if (cards.some((c) => c.line.id.startsWith('holo~'))) holo++;
    if (cards.some((c) => ids.has(baseId(c.line.id)))) featured++;
  }
  const rows = new Map<string, number>();
  for (const r of [...t.bands, ...t.tiers]) rows.set(r.key, (counts.get(r.key) ?? 0) / n);
  return { rows, holo: holo / n, featured: featured / n };
}

/** Every row of the table within tolerance of the measured shares. */
function agrees(t: OddsTable, packs: Iterable<RatedCard[]>, label: string, tol = TOL): void {
  const m = measure(t, packs);
  for (const r of [...t.bands, ...t.tiers]) expect(Math.abs(m.rows.get(r.key)! - r.p), label + ' ' + r.label + ' sim ' + m.rows.get(r.key) + ' sheet ' + r.p).toBeLessThanOrEqual(tol);
  expect(Math.abs(m.holo - t.holo), label + ' holo ' + m.holo + ' vs ' + t.holo).toBeLessThanOrEqual(HOLO_TOL);
  if (t.featured) expect(Math.abs(m.featured - t.featured.p), label + ' featured ' + m.featured + ' vs ' + t.featured.p).toBeLessThanOrEqual(tol);
}

function* opens(pool: Pool, kind: string, at: number, n = N): Generator<RatedCard[]> {
  const { day } = easternParts(at);
  for (let i = 0; i < n; i++) yield openPack(pool, kind, 'odds:' + kind + ':' + i, weekOf(day), { at });
}

export function oddsSuite(): void {
  let pool: Pool;
  beforeAll(async () => {
    pool = await getPool();
  }, 120000);

  describe('fmtPct and oneIn', () => {
    it('writes chances the way the sheets promise', () => {
      expect(fmtPct(0)).toBe('0%');
      expect(fmtPct(0.0005)).toBe('less than 0.1%');
      expect(fmtPct(0.00099)).toBe('less than 0.1%');
      expect(fmtPct(0.001)).toBe('0.1%');
      expect(fmtPct(0.0066)).toBe('0.7%');
      expect(fmtPct(0.015)).toBe('1.5%');
      expect(fmtPct(0.0996)).toBe('10%');
      expect(fmtPct(0.42)).toBe('42%');
      expect(fmtPct(0.994)).toBe('99%');
      expect(fmtPct(0.995)).toBe('100%');
      expect(fmtPct(1)).toBe('100%');
      expect(oneIn(0.0005)).toBe('1 in 2,000');
      expect(oneIn(0.0066)).toBe('1 in 150');
      expect(oneIn(0.05)).toBeNull();
    });
  });

  describe('every sold pack against 10,000 seeded openings (' + SPORT + ')', () => {
    it('the Store kinds, the Daily Drop and the Club Collection defaults', () => {
      for (const kind of SOLD) {
        const t = oddsFor(pool, kind, AT)!;
        expect(t, kind).toBeTruthy();
        agrees(t, opens(pool, kind, AT), kind);
      }
    });

    it('every Position/Unit choice, and the random-choice sheet is their mean', () => {
      const tables = positionChoices(SPORT).map((c) => oddsFor(pool, 'position:' + c.key, AT)!);
      positionChoices(SPORT).forEach((c, i) => agrees(tables[i], opens(pool, 'position:' + c.key, AT), c.key));
      const all = oddsFor(pool, 'position', AT)!;
      // (from every computed band, also ones a choice's own sheet hides because they are certain there)
      for (const b of all.bands) {
        const i = [80, 82, 83, 84, 85, 86, 88].indexOf(Number(b.key.slice(1)));
        const mean = tables.reduce((a, t) => a + t.raw.bands[i], 0) / tables.length;
        expect(b.p).toBeCloseTo(mean, 9);
      }
      expect(all.notes[0]).toMatch(/differ from these by at most \d+\.\d points/);
    });

    it('the Preview Pack shows the Premium Gold it opens', () => {
      const t = oddsFor(pool, 'preview', AT)!;
      const premium = oddsFor(pool, 'premium', AT)!;
      expect(t.bands).toEqual(premium.bands);
      expect(t.tiers).toEqual(premium.tiers);
      expect(t.title).toBe('Preview Pack');
    });

    it('program packs, boosted and not, and a Program Guarantee (NBA and NFL calendar)', () => {
      if (SPORT === 'soccer' || !schedule()) return;
      const kind = 'live:s4-pairs';
      const p = packOfKind(kind)!;
      const w = boostWindows('s4-pairs', SPORT).find((x) => easternParts(x.start).day >= p.start)!;
      const on = w.start + 3600000;
      const off = w.start - 3 * 3600000;
      const boosted = oddsFor(pool, kind, on)!;
      const plain = oddsFor(pool, kind, off)!;
      expect(boosted.boosted).toBeTruthy();
      expect(plain.boosted).toBeNull();
      expect(boosted.boosted!.now).toBeGreaterThan(boosted.boosted!.base);
      expect(boosted.tiers.find((x) => x.key === 't-program')!.p).toBeGreaterThan(plain.tiers.find((x) => x.key === 't-program')!.p);
      agrees(boosted, opens(pool, kind, on), kind + ' boosted');
      agrees(plain, opens(pool, kind, off), kind);
      const day = easternParts(on).day;
      const g = packsOnDay(day).find((x) => x.tpl === 'guarantee');
      if (g) {
        const t = oddsFor(pool, g.id, on)!;
        expect(t.tiers.find((x) => x.key === 't-program')!.p).toBeCloseTo(1, 9);
        agrees(t, opens(pool, g.id, on, 4000), g.id);
      }
    });

    it('Spotlight: the registry rates exactly, and the rest against 10,000 receipts', () => {
      if (SPORT === 'soccer') {
        expect(oddsFor(pool, 'spotlight', AT)).toBeNull();
        return;
      }
      const t = oddsFor(pool, 'spotlight', AT)!;
      const row = (k: string) => t.tiers.find((x) => x.key === 't-' + k)!.p;
      expect(row('spotlight')).toBe(0.2);
      expect(row('goat')).toBe(0.0005);
      expect(row('legend')).toBeCloseTo(0.02, 12);
      expect(t.holo).toBe(0);
      expect(t.notes.join(' ')).toMatch(/1 in 2,000/);
      // the golds are the pre-curve draw (legacyFill), so no row moves when the gold curve does
      function* receipts(): Generator<RatedCard[]> {
        for (let i = 0; i < N; i++) {
          const seed = 'odds-spot:' + i;
          const r = rng(hashString(seed));
          const tier = chaseTier(Math.floor(r() * 1_000_000));
          if (tier === 'gold') yield registeredPack(pool, 'spotlight', seed, null);
          else {
            const all = Object.values(pool.buckets[tier]).flat();
            yield registeredPack(pool, 'spotlight', seed, all[Math.floor(r() * all.length)].line.id);
          }
        }
      }
      agrees(t, receipts(), 'spotlight');
    });
  });

  describe('picks against 10,000 option draws (' + SPORT + ')', () => {
    const check = (t: OddsTable, draws: Iterable<RatedCard[]>, label: string) => agrees(t, draws, label);
    it('Front Office, Player Picks 82+ and 84+, the Stamp Scout 85+ and the shelf picks', () => {
      for (const kind of Object.keys(GOLD_PICKS) as (keyof typeof GOLD_PICKS)[]) {
        const g = GOLD_PICKS[kind];
        const t = pickTable(pool, kind, AT)!;
        expect(t.cards).toBe(g.n);
        check(
          t,
          (function* () {
            for (let i = 0; i < N; i++) yield goldOptions(pool, g.floor, g.n, kind + ':odds:' + i);
          })(),
          kind,
        );
      }
      // Claude (packs-6): the shelf's gold rungs open the sport's floor (stamp-shelf.ts SHELF_FLOOR)
      expect(pickTable(pool, 'shelf:g82', AT)!.bands).toEqual(pickTable(pool, shelfPickKind('g82', SPORT), AT)!.bands);
      expect(pickTable(pool, 'shelf:scout85', AT)!.bands).toEqual(pickTable(pool, shelfPickKind('scout85', SPORT), AT)!.bands);
      expect(pickTable(pool, 'shelf:standouts', AT)!.bands).toEqual(pickTable(pool, 'standout-pick', AT)!.bands);
      // with no program live the shelf's Program Pick has no sheet (it can't be redeemed: never an 82+ stand-in)
      if (!programPickSource(pool, DAY)) expect(pickTable(pool, 'shelf:program', AT)).toBeNull();
    });

    it("Scout's Choice and the Swap Desk (40,000 draws, ±0.8 points: NFL's repeated players are modelled)", () => {
      const t = pickTable(pool, 'scout', AT)!;
      agrees(
        t,
        (function* () {
          for (let i = 0; i < 4 * N; i++) yield scoutOptions(pool, 'odds-scout:' + i, W).options;
        })(),
        'scout',
        0.008,
      );
      // the Standout share follows the Weekly Standout week, and so does the sheet's date
      const later = easternAt('2026-11-26', 12);
      expect(pickTable(pool, 'scout', later)!.updated).toBe(weekMonday(weekOf('2026-11-26')));
      expect(pickTable(pool, 'swap', later)!.updated).toBe(weekMonday(weekOf('2026-11-26')));
      expect(pickTable(pool, 'pick-84', later)!.updated).toBe(ODDS_UPDATED);
      expect(t.slotsText).toMatch(/Weekly Standout/);
      expect(pickTable(pool, 'swap', AT)!.bands).toEqual(t.bands);
    });

    it('the Standout Pick: each Standout equally likely, the featured one included', () => {
      const t = pickTable(pool, 'standout-pick', AT)!;
      check(
        t,
        (function* () {
          for (let i = 0; i < N; i++) yield standoutOptions(pool, 'odds-so:' + i, W);
        })(),
        'standout-pick',
      );
      expect(t.notes[0]).toMatch(/equally likely/);
    });

    it('Program, program (live) and calendar picks', () => {
      const ids = (xs: string[]) => xs.map((id) => pool.base.get(id)!);
      // the login calendar's pick sorts every gold per draw: the same draw with the sorted list built once
      // (checked against calendarPickOptions itself), so 10,000 draws fit
      const floor = fcToDisplay(78, SPORT);
      const sorted = Object.values(pool.buckets.gold)
        .flat()
        .filter((rc) => rc.line.kind === 'season' && rc.ovr >= floor)
        .sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
      const calDraw = (id: string): RatedCard[] => {
        const out: RatedCard[] = [];
        const pids = new Set<string>();
        for (const rc of shuffle(sorted, rng(hashString('calendar:' + id)))) {
          if (pids.has(rc.line.pid)) continue;
          pids.add(rc.line.pid);
          out.push(rc);
          if (out.length === 2) break;
        }
        return out;
      };
      for (let i = 0; i < 100; i++) expect(calDraw('odds-cal:' + i).map((rc) => rc.line.id)).toEqual(calendarPickOptions(pool, 'odds-cal:' + i));
      const cal = pickTable(pool, 'calendar', AT)!;
      expect(cal.cards).toBe(2);
      // season golds only: no special edition row, not even a rounding error's "1 in 10^14"
      expect(cal.tiers.filter((x) => x.key !== 't-gold'), 'calendar tiers').toEqual([]);
      expect(cal.special).toBe(0);
      agrees(
        cal,
        (function* () {
          for (let i = 0; i < N; i++) yield calDraw('odds-cal:' + i);
        })(),
        'calendar',
      );
      if (SPORT === 'soccer' || !schedule()) return;
      // a day a program is live
      let day = DAY;
      for (let k = 0; k < 200 && !programPickSource(pool, day); k++) day = addDays(day, 1);
      const src = programPickSource(pool, day);
      if (!src) return;
      const at = easternAt(day, 12);
      const t = pickTable(pool, 'program-pick', at)!;
      check(
        t,
        (function* () {
          for (let i = 0; i < N; i++) yield shuffle(src.cards, rng(hashString('program-pick:odds' + i))).slice(0, 3);
        })(),
        'program-pick',
      );
      const live = packsOnDay(day).find((p) => p.tpl === 'program');
      if (live) {
        const kind = 'live-pick:' + live.id.replace(/^live:/, '') + ':3';
        const lt = pickTable(pool, kind, at);
        if (lt)
          check(
            lt,
            (function* () {
              for (let i = 0; i < N; i++) yield ids(livePick(pool, kind, 'odds-lp:' + i, day, at)!.options);
            })(),
            kind,
          );
      }
    });
  });

  describe('random rewards against 10,000 draws (' + SPORT + ')', () => {
    it('every random SBC reward card of the 60-day catalogue', () => {
      const seen = new Map<string, Reward>();
      for (let d = 0; d < 60; d++)
        for (const s of sbcsFor(pool, addDays(DAY, d))) {
          // every tier and floor once, and a franchise reward for each of them (the franchise varies by day)
          if (s.reward.card) seen.set(s.reward.card.tier + ':' + (s.reward.card.minOvr ?? '') + (s.reward.card.fr ? ':fr' : ''), { card: s.reward.card });
          if (s.reward.standout) seen.set('standout', { standout: true });
        }
      expect(seen.size).toBeGreaterThan(2);
      for (const [key, w] of seen) {
        const t = rewardOdds(pool, w, AT)!;
        expect(t, key).toBeTruthy();
        const draws = (function* () {
          for (let i = 0; i < N; i++) yield [w.card ? rewardCard(pool, w.card, 'odds-reward:' + key + ':' + i)! : drawStandout(pool, W, rng(hashString('odds-so-reward:' + i)), 0.1)!];
        })();
        agrees(t, draws, key);
      }
    });

    it('a pack reward, a pack and card together, and the program reward', () => {
      const pack = rewardOdds(pool, { pack: 'gold' }, AT)!;
      expect(pack.bands).toEqual(oddsFor(pool, 'gold', AT)!.bands);
      const both = rewardOdds(pool, { pack: 'premium', card: { tier: 'gold', minOvr: fcToDisplay(82, SPORT) } }, AT)!;
      expect(both.cards).toBe(packDefs(SPORT).premium.slots.length + 1);
      expect(both.bands.find((b) => b.key === 'b82')!.p).toBeCloseTo(1, 9);
      expect(rewardOdds(pool, { coins: 500 }, AT)).toBeNull();
      if (SPORT === 'soccer' || !schedule()) return;
      let day = DAY;
      for (let k = 0; k < 200 && !programPickSource(pool, day); k++) day = addDays(day, 1);
      const promo = packsOnDay(day).find((p) => p.tpl === 'program');
      if (!promo) return;
      const w: Reward = { program: promo.id.replace(/^live:/, '').replace(/-y\d+$/, '') };
      const t = rewardOdds(pool, w, easternAt(day, 12));
      if (!t) return;
      const draws = (function* () {
        for (let i = 0; i < N; i++) yield [programReward(pool, w.program!, false, day)!];
      })();
      agrees(t, draws, 'program reward');
    });
  });

  describe('Scout Drops: the sheet is dropOdds exactly', () => {
    it('drops 1, 2 and 3', () => {
      for (const i of [1, 2, 3] as const) {
        const s = dropSheet(SPORT, i);
        const o = dropOdds(SPORT, i);
        const t = dropTable(SPORT, i);
        expect(s.final.map((f) => f.tier)).toEqual([...DROP_TIERS]);
        for (const f of s.final) {
          expect(f.p).toBe(o[f.tier]);
          expect(f.reward.length).toBeGreaterThan(0);
        }
        for (const st of s.steps) expect(st.p).toBe(t.up[st.from]);
        expect(s.stopOnMiss).toBe(i === 1);
      }
      expect(dropSheet(SPORT, 2).final.find((f) => f.tier === 'epic')!.reward).toMatch(/3 Scout Stamps/);
      expect(dropSheet(SPORT, 1).final[0].reward).toMatch(/Silver Pack \+ 100 coins/);
    });
  });

  describe('route cost, the tracker, speed and the buy confirm (' + SPORT + ')', () => {
    it('route cost is within 5% of the step-resolved Premium odds', () => {
      const prem = packDefs(SPORT).premium;
      for (const o of [83, 84, 85, 86, 88]) {
        const ovr = fcToDisplay(o, SPORT);
        let none = 1;
        for (const slot of prem.slots) {
          let p = 0;
          for (const [k, w] of Object.entries(slot)) {
            if (!w || !isFloorKind(k)) continue;
            for (const [x, q] of goldDist(pool, FLOORS[k])) if (x >= ovr) p += w * q;
          }
          none *= 1 - p;
        }
        const exact = prem.price / (1 - none);
        expect(Math.abs(routeCost(SPORT, ovr) / exact - 1), String(o)).toBeLessThanOrEqual(0.05);
        expect(premiumChanceAtLeast(SPORT, ovr)).toBeGreaterThan(0);
      }
    });

    it('the Pack Tracker expects exactly what the sheet says', () => {
      for (const kind of ['gold', 'premium', 'daily', 'jumbo']) {
        const e = expectedFor(pool, kind, DAY, W)!;
        const t = oddsFor(pool, kind, AT)!;
        expect(e.r86).toBe(t.r86);
        expect(e.r90).toBe(t.r90);
        expect(e.special).toBe(t.special);
        expect(e.qs).toBeCloseTo(packEv(pool, packDefs(SPORT)[kind as 'gold'].slots, { week: W }), 6);
      }
    });

    it('a sheet is computed in 20 ms or less (after warm-up) for every pack', () => {
      const defs = packDefs(SPORT);
      const kinds = [...SOLD, 'position', SPORT === 'soccer' ? 'premium' : 'spotlight'];
      for (const k of kinds) oddsTable(pool, { ...(defs[k as 'gold'] ?? defs.premium), kind: k }, { week: W, day: DAY });
      for (const k of kinds) {
        const def = { ...(defs[k as 'gold'] ?? defs.premium), kind: k };
        const t0 = performance.now();
        oddsTable(pool, def, { week: W, day: DAY });
        expect(performance.now() - t0, k).toBeLessThanOrEqual(20);
      }
    });

    it('every pick and random reward table is computed in 20 ms or less (after warm-up)', () => {
      // every saved pick kind with a table, the stamp shelf's, and a program's own pick
      const kinds = ['calendar', 'standout-pick', 'program-pick', 'scout', 'swap', 'front-office', 'pick-82', 'pick-84', 'pick-85', 'shelf:g82', 'shelf:scout85', 'shelf:standouts', 'shelf:program'];
      for (const k of kinds) expect(hasPickOdds(k), k).toBe(true);
      const rewards: [string, Reward][] = [
        ['gold', { card: { tier: 'gold', minOvr: fcToDisplay(82, SPORT) } }],
        ['standout', { standout: true }],
        ['pack', { pack: 'premium' }],
      ];
      if (SPORT !== 'soccer' && schedule()) {
        let day = DAY;
        for (let k = 0; k < 200 && !programPickSource(pool, day); k++) day = addDays(day, 1);
        const promo = packsOnDay(day).find((p) => p.tpl === 'program');
        if (promo) rewards.push(['program', { program: promo.id.replace(/^live:/, '').replace(/-y\d+$/, '') }]);
      }
      // warm-up: the pool's own caches (gold curves, the week's Standouts) and the JIT, as after a Store visit
      // (packs-6: the shelf's Program Pick has a sheet only while a program is live)
      if (!programPickSource(pool, DAY)) kinds.splice(kinds.indexOf('shelf:program'), 1);
      for (const k of kinds) pickTableNow(pool, k, DAY, W);
      for (const [, w] of rewards) rewardOdds(pool, w, AT);
      // the best of three runs: the computation's own cost, not a busy machine's scheduling
      const best = (f: () => unknown) => {
        let ms = Infinity;
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          expect(f()).toBeTruthy();
          ms = Math.min(ms, performance.now() - t0);
        }
        return ms;
      };
      for (const k of kinds) expect(best(() => pickTableNow(pool, k, DAY, W)), k).toBeLessThanOrEqual(20);
      for (const [k, w] of rewards) expect(best(() => rewardOdds(pool, w, AT)), 'reward ' + k).toBeLessThanOrEqual(20);
    });

    it('sheets list one certain band at most, and the Premium header writes its Legend chance like the table', () => {
      const tables = [...SOLD.map((k) => oddsFor(pool, k, AT)!), ...['pick-84', 'pick-85', 'scout', 'calendar', 'standout-pick'].map((k) => pickTable(pool, k, AT)!)];
      for (const t of tables) expect(t.bands.filter((b) => b.p >= 0.995).length, t.title).toBeLessThanOrEqual(1);
      // a Player Pick 84+ leads with its one certain row, then the rows that matter
      const p84 = pickTable(pool, 'pick-84', AT)!;
      expect(p84.bands[0].key).toBe('b84');
      expect(p84.bands.slice(1).every((b) => b.p < 0.995)).toBe(true);
      const prem = oddsFor(pool, 'premium', AT)!;
      const legend = prem.tiers.find((x) => x.key === 't-legend')!;
      expect(legend.p).toBeCloseTo(LEGEND_PREMIUM, 12);
      expect(prem.slotsText).toContain(fmtPct(legend.p) + ' a Legend');
    });

    it('the buy confirm: from 1,500 coins; "Don’t ask again" never at 10,000 or more', () => {
      expect(confirmFor(CONFIRM_FROM - 1).ask).toBe(false);
      expect(confirmFor(CONFIRM_FROM).ask).toBe(true);
      expect(confirmFor(4200, { skipBuyConfirm: true }).ask).toBe(false);
      expect(confirmFor(4200).canSkip).toBe(true);
      expect(confirmFor(ALWAYS_CONFIRM_FROM).canSkip).toBe(false);
      expect(confirmFor(ALWAYS_CONFIRM_FROM, { skipBuyConfirm: true }).ask).toBe(true);
      expect(confirmFor(25000, { skipBuyConfirm: true }).ask).toBe(true);
      // its three rows come from the sheet
      const rows = headline(oddsFor(pool, 'jumbo', AT)!);
      expect(rows.length).toBe(3);
      for (const r of rows) expect(r.p).toBeGreaterThan(0);
      // for every pack: common to rare, led by the best band hit 1 time in 20, and no band row below it
      for (const kind of SOLD) {
        const t = oddsFor(pool, kind, AT)!;
        const h = headline(t);
        for (let i = 1; i < h.length; i++) expect(h[i].p, kind).toBeLessThanOrEqual(h[i - 1].p);
        const a = [...t.bands].reverse().find((b) => b.p >= 0.05 && b.p < 0.995);
        // every band row is that band or a rarer one; 83+ only as the stand-in when nothing rarer is left
        const band = (key: string) => Number(key.slice(1));
        if (a) for (const r of h.filter((x) => x.key.startsWith('b') && x.key !== 'b83')) expect(band(r.key), kind + ' ' + r.label).toBeGreaterThanOrEqual(band(a.key));
        if (a) expect(h.some((r) => r.key === a.key), kind).toBe(true);
        expect(new Set(h.map((r) => r.key)).size, kind).toBe(h.length);
      }
    });

    it('old saves: no prefs asks first; the field survives today and an older build drops only it', () => {
      expect(normalizeContent({})!.prefs).toBeUndefined();
      expect(confirmFor(1900, normalizeContent({})!.prefs).ask).toBe(true);
      const ut = withPrefs({ content: { claims: ['a'], buys: { 'elite:2026-11-12': 1 } } }, { skipBuyConfirm: true });
      expect(normalizeContent(ut.content)!.prefs).toEqual({ skipBuyConfirm: true });
      expect(normalizeContent({ prefs: { skipBuyConfirm: 'yes', junk: 1 } })!.prefs).toEqual({});
      const legacy = legacyNormalizeContent(JSON.parse(JSON.stringify(ut.content))) as Record<string, unknown>;
      expect(legacy.prefs).toBeUndefined();
      const back = normalizeContent(legacy)!;
      const { prefs: _p, ...rest } = normalizeContent(ut.content)!;
      void _p;
      expect(back).toEqual(rest);
      expect(confirmFor(1900, back.prefs).ask).toBe(true);
    });
  });
}
