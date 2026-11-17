// Claude (packs-2, 2026-11-16): the `pack-curve` suite (docs/studio-overhaul/packs.md "packs-2"). One
// module, run once per sport: pack-curve.test.ts in the NBA and NFL runs, soccer-pack-curve.test.ts in the
// soccer run. It proves the per-overall gold curve (research §8.1) behind every source that hands out a
// gold, the floor slots, holo only from rolled slots, chase duplicate protection, the reward card, Scout's
// Choice and the reward picks (Player Pick 84+ among them). Test code only: no app module imports it.
import { beforeAll, describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { SPORT } from '../../engine/sport';
import { awardPick, goldOptions, scoutOptions } from '../content-packs';
import { fcToDisplay } from '../fc-scale';
import { promoCards } from '../live-cards';
import { livePackDef, livePacksOn, openLivePack, promoOfPack } from '../live-packs';
import { curveOdds, curveStepMass, drawGold, fill, FLOORS, type FloorKind, GOLD_CURVE, goldsOf, isFloorKind, openPack, ownedCardIds, packDefs, packRand, positionChoices } from '../packs';
import { getPool, type Pool } from '../pool';
import { rewardCard } from '../sbc';
import { grantStamps } from '../scout-stamps';
import { redeemStamps, SHELF_FLOOR, shelfPickKind } from '../stamp-shelf';
import { positionMix } from '../squad';
import { standoutProgram } from '../standouts';
import { freshUt, type UtState } from '../state';
import type { RatedCard } from '../types';

const W = '2026-W46';
const BASE = new Set(['bronze', 'silver', 'gold']);
const at = (x: number) => fcToDisplay(x, SPORT);
/** P(a card ≥ x) over cards, in %. */
const share = (cards: RatedCard[], x: number) => (100 * cards.filter((c) => c.ovr >= at(x)).length) / cards.length;
/** Over packs, the share in % that hold at least one card ≥ x. */
const anyAtLeast = (picks: RatedCard[][], x: number) => (100 * picks.filter((p) => p.some((c) => c.ovr >= at(x))).length) / picks.length;

export function packCurveSuite(): void {
  let pool: Pool;
  beforeAll(async () => {
    pool = await getPool();
  }, 120000);

  describe('the gold curve (' + SPORT + ')', () => {
    it('reproduces the published per-slot chances over 200,000 any-gold (G75) draws', () => {
      const rand = rng(hashString('curve:g75'));
      const cards = Array.from({ length: 200000 }, () => drawGold(pool, 75, rand)!);
      expect(share(cards, 85)).toBeGreaterThan(1.0 - 0.08);
      expect(share(cards, 85)).toBeLessThan(1.0 + 0.08);
      expect(Math.abs(share(cards, 86) - 0.58)).toBeLessThan(0.06);
      expect(Math.abs(share(cards, 88) - 0.2)).toBeLessThan(0.04);
      // the band split of an any-gold slot: 75–79 / 80–82 / 83–85 / 86+ = 45 / 49 / 5 / 0.7 (± 2)
      const band = (lo: number, hi: number) => share(cards, lo) - share(cards, hi);
      expect(Math.abs(band(75, 80) - 45)).toBeLessThan(2);
      expect(Math.abs(band(80, 83) - 49)).toBeLessThan(2);
      expect(Math.abs(band(83, 86) - 5)).toBeLessThan(2);
      expect(Math.abs(share(cards, 86) - 0.7)).toBeLessThan(2);
      expect(cards.every((c) => c.tier === 'gold')).toBe(true);
    });

    it('matches the curve within 0.5 pt at every floor for "x or better" up to 84', () => {
      for (const [kind, floor] of Object.entries(FLOORS) as [FloorKind, number][]) {
        if (kind === 'g75') continue;
        const rand = rng(hashString('curve:' + kind));
        const cards = Array.from({ length: 100000 }, () => drawGold(pool, floor, rand)!);
        expect(cards.every((c) => c.ovr >= at(floor))).toBe(true);
        const odds = curveOdds(GOLD_CURVE, at(floor), SPORT);
        for (const x of [80, 81, 82, 83, 84]) {
          if (x <= floor) continue;
          let want = 0;
          for (const [o, p] of odds) if (o >= at(x)) want += p * 100;
          expect(Math.abs(share(cards, x) - want), kind + ' ' + x + '+').toBeLessThan(0.5);
        }
      }
    });

    it('moves at most 1.5% of a slot’s mass to a neighbouring overall (the overall a slot’s positions lack)', () => {
      const need = positionMix(SPORT);
      for (const kind of Object.keys(FLOORS) as FloorKind[]) {
        expect(curveStepMass(pool, kind), kind).toBeLessThanOrEqual(0.015);
        // the slots a Position or Unit pack has (any gold and 78+)
        if (kind === 'g75' || kind === 'g78')
          for (const ch of positionChoices(SPORT)) expect(curveStepMass(pool, kind, ch.positions.map((p) => [p, need[p] ?? 1])), ch.key + ' ' + kind).toBeLessThanOrEqual(0.015);
      }
    });
  });

  describe('slot lists (' + SPORT + ')', () => {
    it('every slot adds up to 1 and every pack opens its slot count', () => {
      for (const def of Object.values(packDefs(SPORT))) {
        for (const o of def.slots) expect(Object.values(o).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1, 9);
        if (['spotlight', 'scout'].includes(def.kind)) continue;
        const kind = def.kind === 'position' ? 'position:' + positionChoices(SPORT)[0].key : def.kind;
        expect(openPack(pool, kind, 'slots:' + def.kind, W).length).toBe(def.slots.length);
      }
    });

    it('a saved recipe’s `rare` is a gold 78+ and its `gold` any gold; floors hold in every pack', () => {
      for (let i = 0; i < 200; i++) {
        const [r, g] = fill(pool, [{ rare: 1 }, { gold: 1 }], packRand('legacy-slot:' + i), undefined, W);
        expect(r.tier).toBe('gold');
        expect(r.ovr).toBeGreaterThanOrEqual(at(78));
        expect(g.tier).toBe('gold');
      }
      const defs = packDefs(SPORT);
      for (let i = 0; i < 100; i++) {
        const elite = openPack(pool, 'elite', 'floor:e' + i, W);
        expect(elite.filter((c) => c.tier === 'gold').every((c) => c.ovr >= at(82))).toBe(true);
        // every gold slot gives a gold, but the one special slot may give a special instead
        const gold = openPack(pool, 'gold', 'floor:g' + i, W);
        const goldSlots = defs.gold.slots.filter((o) => Object.keys(o).some(isFloorKind)).length;
        expect(gold.filter((c) => c.tier === 'gold').length).toBeGreaterThanOrEqual(goldSlots - 1);
      }
    });
  });

  describe('holo and duplicate protection (' + SPORT + ')', () => {
    it('never makes a guaranteed slot holo, and 5% ± 0.6 of specials from a rolled slot', () => {
      let holo = 0;
      for (let i = 0; i < 10000; i++) holo += openPack(pool, 'standout', 'holo-guarantee:' + i, W).filter((c) => c.line.holo).length;
      expect(holo).toBe(0);
      let specials = 0;
      let holos = 0;
      const rand = packRand('holo-rolled');
      for (let i = 0; i < 20000; i++)
        for (const c of fill(pool, [{ standout: 0.5, g75: 0.5 }], rand, undefined, W)) {
          if (BASE.has(c.tier)) continue;
          specials++;
          if (c.line.holo) holos++;
        }
      expect(Math.abs((100 * holos) / specials - 5)).toBeLessThan(0.6);
    });

    /** One player opening `n` packs in a row, keeping everything: the share of pulls he already had. */
    const dupRate = (open: (i: number, owned: ReadonlySet<string>) => RatedCard[], n = 200) => {
      const owned = new Set<string>();
      let dup = 0;
      let all = 0;
      for (let i = 0; i < n; i++)
        for (const c of open(i, owned)) {
          const id = c.line.variantOf?.id ?? c.line.id;
          all++;
          if (owned.has(id)) dup++;
          owned.add(id);
        }
      return dup / all;
    };

    /**
     * The fewest repeats any protection can reach in `n` packs without ever giving a card under the overall
     * drawn (the published odds stay minimums): the expected draws per overall matched top-down to unused
     * cards at that overall or above.
     */
    const upwardFloor = (key: string, n = 200) => {
      const positions = positionChoices(SPORT).find((c) => c.key === key)!.positions;
      const have = new Map<number, number>();
      for (const c of positions.flatMap((q) => pool.buckets.gold[q] ?? [])) have.set(c.ovr, (have.get(c.ovr) ?? 0) + 1);
      const want = new Map<number, number>();
      let draws = 0;
      for (const slot of packDefs(SPORT).position.slots)
        for (const [k, p] of Object.entries(slot))
          if (isFloorKind(k))
            for (const [o, q] of curveOdds(GOLD_CURVE, at(FLOORS[k]), SPORT)) {
              want.set(o, (want.get(o) ?? 0) + n * (p ?? 0) * q);
              draws += n * (p ?? 0) * q;
            }
      let free = 0;
      let unique = 0;
      for (const o of [...new Set([...have.keys(), ...want.keys()])].sort((a, b) => b - a)) {
        free += have.get(o) ?? 0;
        const m = Math.min(free, want.get(o) ?? 0);
        unique += m;
        free -= m;
      }
      return 1 - unique / draws;
    };

    it('keeps duplicates at 200 packs to Elite ≤ 20% (or the pool’s own floor) and (NFL) Unit packs ≤ 35% (or the upward-only floor)', () => {
      // football's Elite opens 2,400 cards in 200 packs from about 1,850 golds 82+: at least 23% must repeat
      const cards = 200 * packDefs(SPORT).elite.slots.length;
      const floor = Math.max(0, 1 - goldsOf(pool).filter((c) => c.ovr >= at(82)).length / cards);
      expect(dupRate((i, owned) => openPack(pool, 'elite', 'dup:e' + i, W, { owned }))).toBeLessThanOrEqual(Math.max(0.2, floor + 0.01));
      // packs-2 review fix: the protection never steps below the drawn overall, so a thin unit (football's
      // linebackers: 1,016 golds, 433 of them 78+, for 1,200 draws) repeats at least its upward-only floor
      if (SPORT === 'nfl')
        for (const key of ['LB', 'DL', 'OL', 'DB']) {
          const rate = dupRate((i, owned) => openPack(pool, 'position:' + key, 'dup:' + key + i, W, { owned }));
          expect(rate, key).toBeLessThanOrEqual(Math.max(0.35, upwardFloor(key) + 0.02));
        }
      // basketball's positions have room: the floor is about 0 (a few hundredths of a card at the very top)
      if (SPORT === 'nba') for (const key of ['SF', 'C']) expect(upwardFloor(key), key).toBeLessThan(0.005);
    });

    // Claude (packs-2 review fix): the protection only ever moves a gold up, never below the drawn overall,
    // so "x or better" with an owned club is never under the published (fresh-club) chance.
    it('duplicate protection never lowers a published chance: paired seeds, Position/Unit and Elite, 82+ … 88+', () => {
      const kinds = ['elite', ...positionChoices(SPORT).map((c) => 'position:' + c.key)];
      for (const kind of kinds) {
        const owned = new Set<string>();
        const fresh: RatedCard[] = [];
        const kept: RatedCard[] = [];
        for (let i = 0; i < 500; i++) {
          const a = openPack(pool, kind, 'paired:' + kind + i, W);
          const b = openPack(pool, kind, 'paired:' + kind + i, W, { owned });
          for (const c of b) owned.add(c.line.variantOf?.id ?? c.line.id);
          // count once the club has a real collection (the reviewer's window started at pack 300 of 1,500)
          if (i < 150) continue;
          fresh.push(...a.filter((c) => c.tier === 'gold'));
          kept.push(...b.filter((c) => c.tier === 'gold'));
        }
        for (let x = 82; x <= 88; x++) expect(share(kept, x), kind + ' ' + x + '+').toBeGreaterThanOrEqual(share(fresh, x) - 0.05);
      }
    });

    it('a club owning every 88 and 89 still gets 88+ from a G82 slot at least as often as a fresh club', () => {
      const golds = goldsOf(pool);
      const owned = new Set(golds.filter((c) => c.ovr === at(88) || c.ovr === at(89)).map((c) => c.line.id));
      expect(golds.some((c) => c.ovr >= at(90) && !owned.has(c.line.id))).toBe(true);
      const ra = rng(hashString('own-88-89'));
      const rb = rng(hashString('own-88-89'));
      let hiFresh = 0;
      let hiOwned = 0;
      for (let i = 0; i < 40000; i++) {
        const a = drawGold(pool, 82, ra)!;
        const b = drawGold(pool, 82, rb, undefined, owned)!;
        // the same draws: the protected card is never below the fresh one, and never one he owns here
        if (b.ovr < a.ovr) throw new Error('protection stepped down: ' + a.ovr + ' -> ' + b.ovr);
        if (owned.has(b.line.id)) throw new Error('gave an owned 88/89 while 90+ were unowned: ' + b.line.id);
        if (a.ovr >= at(88)) hiFresh++;
        if (b.ovr >= at(88)) hiOwned++;
      }
      expect(hiFresh).toBeGreaterThan(0);
      expect(hiOwned).toBeGreaterThanOrEqual(hiFresh);
      // owning everything from the drawn overall up gives a duplicate at that overall, not a lower card
      const top = new Set(golds.filter((c) => c.ovr >= at(84)).map((c) => c.line.id));
      const rc = rng(hashString('own-84-up'));
      const rd = rng(hashString('own-84-up'));
      for (let i = 0; i < 5000; i++) {
        const a = drawGold(pool, 82, rc)!;
        const b = drawGold(pool, 82, rd, undefined, top)!;
        if (b.ovr < a.ovr) throw new Error('protection stepped down: ' + a.ovr + ' -> ' + b.ovr);
      }
    });

    it('never repeats an owned guarantee card while any of its set is unowned', () => {
      const set = standoutProgram(pool, W).cards.map((c) => c.line.id);
      const owned = new Set<string>();
      for (let i = 0; i < set.length; i++) {
        const so = openPack(pool, 'standout', 'dup:so' + i, W, { owned }).find((c) => c.tier === 'standout')!;
        expect(owned.has(so.line.id)).toBe(false);
        owned.add(so.line.id);
      }
      expect(set.every((id) => owned.has(id))).toBe(true);
      if (SPORT === 'soccer') return;
      const day = '2026-11-14';
      const pack = livePacksOn(day).find((p) => p.tpl === 'guarantee')!;
      const slots = livePackDef(SPORT, pack).slots;
      expect(slots[slots.length - 1]).toEqual({ program: 1 });
      const released = promoCards(pool, promoOfPack(pack.id), day);
      expect(released.length).toBeGreaterThan(1);
      const have = new Set<string>();
      for (let i = 0; i < released.length; i++) {
        const card = openLivePack(pool, pack.id, packRand('dup:pg' + i), day, W, have).find((c) => c.tier === 'program')!;
        expect(have.has(card.line.id)).toBe(false);
        have.add(card.line.id);
      }
      expect(have.size).toBe(released.length);
    });
  });

  describe('rewards and picks on the curve (' + SPORT + ')', () => {
    it('pays an 84+ SBC gold on the G84 curve: 85+ 42% ± 3, 86+ 24% ± 3', () => {
      const cards = Array.from({ length: 10000 }, (_, i) => rewardCard(pool, { tier: 'gold', minOvr: at(84) }, 'reward:' + i)!);
      expect(cards.every((c) => c.tier === 'gold' && c.ovr >= at(84))).toBe(true);
      expect(Math.abs(share(cards, 85) - 42)).toBeLessThan(3);
      expect(Math.abs(share(cards, 86) - 24)).toBeLessThan(3);
    });

    it('Scout’s Choice offers nothing under 84, and its best is 85+ about 81% of the time (a little more with Standouts)', () => {
      const picks = Array.from({ length: 3000 }, (_, i) => scoutOptions(pool, 'scout-curve:' + i, W).options);
      expect(picks.every((p) => p.length === 3 && p.every((c) => c.ovr >= at(84)))).toBe(true);
      expect(picks.every((p) => new Set(p.map((c) => c.line.pid)).size === 3)).toBe(true);
      // three G84 golds give 81%; a Weekly Standout option (3% each, always 84+, often higher) only adds
      expect(anyAtLeast(picks, 85)).toBeGreaterThan(81 - 3);
      expect(anyAtLeast(picks, 85)).toBeLessThan(81 + 6);
    });

    it('Front Office (5 on G80) and 82+ (3 on G82) picks match research §8.2 for 84+: 20% / 30% ± 3', () => {
      const fo = Array.from({ length: 3000 }, (_, i) => goldOptions(pool, 80, 5, 'fo-curve:' + i));
      const p82 = Array.from({ length: 3000 }, (_, i) => goldOptions(pool, 82, 3, 'p82-curve:' + i));
      expect(Math.abs(anyAtLeast(fo, 84) - 20)).toBeLessThan(3);
      expect(Math.abs(anyAtLeast(p82, 84) - 30)).toBeLessThan(3);
    });

    it('Player Pick 84+: over 10,000 awards three different golds 84+, never a special; a repeat id is a no-op', () => {
      const t = Date.UTC(2026, 11, 1, 17);
      const fresh = freshUt();
      for (let i = 0; i < 10000; i++) {
        const ut = awardPick(fresh, pool, 'pick-84', 'minutes:life:25h:' + i, t)!;
        const pick = ut.content!.picks![0];
        expect(pick.kind).toBe('pick-84');
        const opts = pick.options.map((id) => pool.base.get(id)!);
        expect(opts.length).toBe(3);
        if (opts.some((c) => c.tier !== 'gold' || c.ovr < at(84))) throw new Error('pick-84 option out of range: ' + pick.options.join(','));
        if (new Set(opts.map((c) => c.line.pid)).size !== 3) throw new Error('pick-84 repeats a player: ' + pick.options.join(','));
      }
      const once = awardPick(fresh, pool, 'pick-84', 'minutes:life:25h', t)!;
      expect(once.content!.picks!.map((p) => p.title)).toEqual(['Player Pick · ' + at(84) + '+']);
      expect(awardPick(once, pool, 'pick-84', 'minutes:life:25h', t)).toBe(once);
    });

    it('Player Pick 84+ prefers golds the club doesn’t own', () => {
      const t = Date.UTC(2026, 11, 1, 17);
      // a club that owns every 84 and 85: options come from what it lacks wherever the curve allows
      const club = Object.values(pool.buckets.gold)
        .flat()
        .filter((c) => c.ovr === at(84) || c.ovr === at(85))
        .map((c, i) => ({ uid: 'own:' + i, cardId: c.line.id, level: 1, xp: 0, at: 0 }));
      const ut: UtState = { ...freshUt(), owned: club };
      const owned = ownedCardIds(club);
      for (let i = 0; i < 300; i++) {
        const pick = awardPick(ut, pool, 'pick-84', 'prefer:' + i, t)!.content!.picks![0];
        expect(pick.options.some((id) => owned.has(id))).toBe(false);
      }
    });

    // Claude (packs-6): the 120 rung's floor is the sport's (stamp-shelf.ts SHELF_FLOOR: 85+ paid back 62% of the
    // coins its stamps stand for); it was 85+ in packs-2
    it('the stamp shelf’s 120 rung opens a Stamp Scout: 1 of 3 golds at the sport’s floor', () => {
      const t = Date.UTC(2026, 11, 1, 17);
      const rich = grantStamps(grantStamps(grantStamps(freshUt(), 50, 'other', 'a'), 50, 'other', 'b'), 30, 'other', 'c');
      const r = redeemStamps(rich, pool, 'scout85', 'u1', '2026-12-01', t)!;
      const pick = r.content!.picks![0];
      expect(pick.kind).toBe(shelfPickKind('scout85', SPORT));
      expect(pick.options.every((id) => pool.base.get(id)!.tier === 'gold' && pool.base.get(id)!.ovr >= at(SHELF_FLOOR[SPORT].scout85))).toBe(true);
      expect(redeemStamps(r, pool, 'scout85', 'u1', '2026-12-01', t)).toBe(r);
    });
  });
}
