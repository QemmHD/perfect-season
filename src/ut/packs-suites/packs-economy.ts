/// <reference types="vite/client" />
// Claude (packs-1, 2026-11-10): the packs-economy suite (docs/studio-overhaul/packs.md). One module,
// run once per sport: packs-economy.test.ts in the NBA and NFL runs, soccer-packs-economy.test.ts in the
// soccer run (which only picks files named for soccer). It holds the packs team's economy invariants:
// the quick-sell ladder, auto-fill never trading a special or numbered card, the SBC templates per sport,
// the "before" fixture (nothing the packs team didn't mean to change has moved), the D9 ruling on reward
// packs an older build doesn't know, the contracts the ut team codes against, and the frozen legacy
// normalizer. Test code only: no app module imports it.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applyProgress, captureProgress, checkedSnapshot } from '../../lib/cloud-data';
import { freshProfile, PROFILE_KEYS } from '../../lib/profile';
import { OPTIONAL_KEYS, RECOVERY_KEYS, validateSaveValues } from '../../lib/recovery';
import { pickFor, SPORT } from '../../engine/sport';
import { legacyNormalizeContent } from '../__fixtures__/legacy-content-state';
import { addDays } from '../calendar';
import { awardPick, keepPick } from '../content-packs';
import { normalizeContent } from '../content-state';
import { fcToDisplay } from '../fc-scale';
import { openPack, PACK_SHAPE, packDefs, quickSell, quickSellValue, TIER_ORDER, UNKNOWN_PACK } from '../packs';
import { getPool, type Pool, TIER_RANK } from '../pool';
import { programRewardCard, resolvedEditions, seasonPassCard, storeBadge, upcomingDrops } from '../promo-hub';
import { rateCard } from '../rate';
import { autoFill, type FillCard, protectedReason, rewardValue, type Sbc, sbcsFor, tradeWarning } from '../sbc';
import { stampsBalance } from '../stamps';
import { standoutProgram } from '../standouts';
import { freshUt, migrateUt, type UtState } from '../state';
import type { CardMint, RatedCard, Tier } from '../types';
import { diffSnapshot, type PacksSnapshot, snapshotEditions, takeSnapshot } from './snapshot';

const FIXTURES = import.meta.glob<PacksSnapshot>('../__fixtures__/packs-before/*.json', { import: 'default' });
const fixture = () => FIXTURES['../__fixtures__/packs-before/' + SPORT + '.json']();
const MINT: CardMint = { serial: 7, totalAtPull: 7, requestId: 'packs-test', namespace: 'inspect' };
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));
/** The positions a sport's SBCs may ask for. */
const VOCAB = pickFor(SPORT, {
  nba: ['PG', 'SG', 'SF', 'PF', 'C'],
  nfl: ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  soccer: ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'],
});

export function packsEconomySuite(): void {
  let pool: Pool;
  beforeAll(async () => {
    pool = await getPool();
  }, 120000);

  describe('quick-sell ladder (' + SPORT + ')', () => {
    /** each tier's lowest, middle and highest card, at levels 1 and 5 */
    const samples = () => {
      const byTier = new Map<Tier, RatedCard[]>();
      for (const t of ['bronze', 'silver', 'gold'] as const) byTier.set(t, Object.values(pool.buckets[t]).flat());
      for (const list of Object.values(snapshotEditions(pool))) for (const rc of list) byTier.set(rc.tier, [...(byTier.get(rc.tier) ?? []), rc]);
      const out = new Map<Tier, number[]>();
      for (const [t, list] of byTier) {
        if (!list.length) continue;
        const s = list.slice().sort((a, b) => a.ovr - b.ovr || (a.line.id < b.line.id ? -1 : 1));
        const picks = [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]];
        const l5 = picks.map((rc) => rateCard(pool.byId.get(rc.line.id) ?? rc.line, 5));
        out.set(t, [...picks, ...l5].map(quickSellValue));
      }
      return out;
    };

    it('rises strictly between distinct tier ranks at each tier’s min, median and max overall, levels 1 and 5', () => {
      const qs = samples();
      const ranks = [...new Set(TIER_ORDER.filter((t) => qs.has(t)).map((t) => TIER_RANK[t]))];
      expect(ranks.length).toBeGreaterThanOrEqual(pickFor(SPORT, { nba: 9, nfl: 9, soccer: 5 }));
      const bad: string[] = [];
      for (let i = 0; i + 1 < ranks.length; i++) {
        const lo = TIER_ORDER.filter((t) => TIER_RANK[t] === ranks[i] && qs.has(t));
        const hi = TIER_ORDER.filter((t) => TIER_RANK[t] === ranks[i + 1] && qs.has(t));
        for (const a of lo) for (const b of hi) qs.get(a)!.forEach((v, k) => v < qs.get(b)![k] || bad.push(a + ' ' + v + ' ≥ ' + b + ' ' + qs.get(b)![k] + ' (' + ['min', 'median', 'max'][k % 3] + ' L' + (k < 3 ? 1 : 5) + ')'));
      }
      expect(bad).toEqual([]);
    });

    it('sells a Spotlight for 4,000+ and a GOAT for 6,000+ (times the sport’s factor), never the bronze line', () => {
      const k = PACK_SHAPE[SPORT].qs;
      expect(quickSell('spotlight', 100, SPORT)).toBe(4000 * k);
      expect(quickSell('spotlight', 107, SPORT)).toBe(Math.round((5050 * k) / 5) * 5);
      expect(quickSell('goat', 106, SPORT)).toBe(6000 * k);
      expect(quickSell('goat', 112, SPORT)).toBe(9000 * k);
      for (const t of ['spotlight', 'goat'] as const)
        for (const rc of Object.values(pool.buckets[t]).flat()) {
          expect(quickSellValue(rc)).toBeGreaterThanOrEqual((t === 'goat' ? 6000 : 4000) * k);
          expect(quickSellValue(rateCard(rc.line, 5))).toBeLessThanOrEqual((t === 'goat' ? 9000 : 5050) * k);
        }
      // the Legend line tops out under the Spotlight floor, levels included
      expect(quickSell('legend', 99, SPORT)).toBeLessThanOrEqual(quickSell('spotlight', 100, SPORT));
    });

    it('changes only the Spotlight, GOAT and Standout values against the before fixture', async () => {
      const before = (await fixture()).qs;
      const now = takeSnapshot(pool).qs;
      for (const t of Object.keys(before) as Tier[]) {
        if (t === 'spotlight' || t === 'goat' || t === 'standout') expect(now[t], t).not.toEqual(before[t]);
        else expect(now[t], t).toEqual(before[t]);
      }
    });
  });

  describe('SBC auto-fill and the trade-in warning (' + SPORT + ')', () => {
    /** the audit's club (an unplayed Spotlight and GOAT, golds of 77 or less, silvers), every special
     * edition this sport has, a numbered gold and a locked one, and a wide spread of base cards */
    const clubs = () => {
      const special = [
        ...(['spotlight', 'goat', 'legend', 'promo', 'landmark'] as const).flatMap((t) => Object.values(pool.buckets[t]).flat().slice(0, 2)),
        ...standoutProgram(pool, '2026-W46').cards.slice(0, 2),
        ...snapshotEditions(pool).program.slice(0, 2),
      ];
      const golds = Object.values(pool.buckets.gold).flat();
      const commons = [
        ...golds.filter((c) => c.ovr <= 77).slice(0, 12),
        ...Object.values(pool.buckets.silver).flat().slice(0, 12),
        ...[...pool.base.values()].filter((rc, i) => rc.line.kind === 'season' && i % 9 === 0),
      ];
      const seen = new Set<string>();
      const fill = (rcs: RatedCard[], tag: string, extra: Partial<FillCard> = {}) =>
        rcs.filter((rc) => !seen.has(rc.line.id) && seen.add(rc.line.id)).map((rc, i) => ({ uid: tag + i, rc, slot: null, ...extra }));
      const guarded = [...fill(special, 'special'), ...fill(golds.filter((c) => c.ovr <= 76).slice(40, 43), 'numbered', { mint: MINT }), ...fill(golds.filter((c) => c.ovr <= 76).slice(50, 53), 'locked', { locked: true })];
      return { guarded, commons: fill(commons, 'common') };
    };

    it('never trades a special, numbered or locked card over 28 days of SBCs; every SBC commons can fill still fills', () => {
      const { guarded, commons } = clubs();
      expect(guarded.filter((c) => c.uid.startsWith('special')).length).toBeGreaterThanOrEqual(pickFor(SPORT, { nba: 12, nfl: 12, soccer: 6 }));
      const club = [...guarded, ...commons];
      let fillable = 0;
      const used: string[] = [];
      const lost: string[] = [];
      for (const day of days('2026-11-09', 28))
        for (const s of sbcsFor(pool, day)) {
          const got = autoFill(s, club);
          for (const uid of got ?? []) if (!uid.startsWith('common')) used.push(s.id + ' ' + uid);
          if (autoFill(s, commons, { guard: false })) {
            fillable++;
            if (!got) lost.push(s.id + ' ' + s.title);
          }
        }
      expect(used).toEqual([]);
      expect(lost).toEqual([]);
      expect(fillable).toBeGreaterThan(28 * 10);
    }, 60000);

    it('leaves out cards worth more than the reward, and says when only a protected card would do', () => {
      const golds = Object.values(pool.buckets.gold).flat().sort((a, b) => a.ovr - b.ovr);
      const cheap = golds.slice(0, 3).map((rc, i) => ({ uid: 'g' + i, rc, slot: null }));
      const star = { uid: 'star', rc: golds[golds.length - 1], slot: null };
      const s: Sbc = { id: 't', kind: 'daily', title: 'T', blurb: '', size: 1, reqs: [{ k: 'minOvr', ovr: star.rc.ovr }], reward: { pack: 'silver' } };
      // the only card that meets it sells for more than a Silver pack costs? Then auto-fill won't trade it
      const worth = rewardValue(s.reward, SPORT);
      expect(worth).toBe(packDefs(SPORT).silver.price);
      expect(protectedReason(star, worth)).toBe(quickSellValue(star.rc) > worth ? 'value' : null);
      expect(protectedReason({ ...cheap[0], mint: MINT }, worth)).toBe('numbered');
      expect(protectedReason({ ...cheap[0], locked: true }, worth)).toBe('locked');
      const legend = Object.values(pool.buckets.legend).flat()[0];
      expect(protectedReason({ uid: 'l', rc: legend, slot: null }, 1e9)).toBe('special');
      expect(autoFill({ ...s, reqs: [] }, [{ uid: 'l', rc: legend, slot: null }])).toBeNull();
      expect(autoFill({ ...s, reqs: [] }, [{ uid: 'l', rc: legend, slot: null }], { guard: false })).toEqual(['l']);
      // a card reward is worth the least card it can be
      expect(rewardValue({ card: { tier: 'gold', minOvr: 84 } }, SPORT)).toBe(quickSell('gold', 84, SPORT));
      expect(rewardValue({ pack: 'premium', card: { tier: 'gold', minOvr: 82 } }, SPORT)).toBe(packDefs(SPORT).premium.price + quickSell('gold', 82, SPORT));
      expect(rewardValue({ pack: 'live:s1-first-tip' }, SPORT)).toBe(packDefs(SPORT).premium.price);
    });

    it('names a special, numbered, 90+ or above-the-reward card on the confirm, and nothing else', () => {
      const worth = rewardValue({ pack: 'gold' }, SPORT);
      const plain = Object.values(pool.buckets.silver).flat()[0];
      expect(tradeWarning(plain, undefined, worth)).toBeNull();
      expect(tradeWarning(plain, MINT, worth)).toBe('numbered #7');
      const top = Object.values(pool.buckets.gold).flat().find((rc) => rc.ovr >= 90);
      if (top) expect(tradeWarning(top, undefined, worth)).toContain(top.ovr + ' overall');
      const hs = Object.values(pool.buckets.promo).flat()[0];
      expect(tradeWarning(hs, undefined, worth)).toContain('Hot Season edition');
      expect(tradeWarning(hs, undefined, 1)).toMatch(/sells for [\d,]+ coins, more than the reward$/);
    });
  });

  describe('SBC templates (' + SPORT + ')', () => {
    it('ask only for this sport’s positions over 60 days (soccer: Kickabout, Front Three, Back Four, Midfield Engine, Gold Spine)', () => {
      const asked = new Set<string>();
      const titles = new Set<string>();
      for (const day of days('2026-11-10', 60))
        for (const s of sbcsFor(pool, day)) {
          titles.add(s.title);
          for (const r of s.reqs) if (r.k === 'positions') r.pos.forEach((p) => asked.add(p));
        }
      expect([...asked].filter((p) => !VOCAB.includes(p))).toEqual([]);
      const own = pickFor(SPORT, {
        nba: ['Pickup Game', 'Backcourt', 'A Full Five', 'Frontcourt', 'Gold Standard'],
        nfl: ['Scrimmage', 'Pass Catchers', 'Skill Set', 'No Fly Zone', 'Gold Front Seven'],
        soccer: ['Kickabout', 'Front Three', 'Back Four', 'Midfield Engine', 'Gold Spine'],
      });
      expect(own.filter((t) => !titles.has(t))).toEqual([]);
    });

    it('can fill every position template from the sport’s golds', () => {
      const club = [...pool.base.values()].filter((rc) => rc.line.kind === 'season' && rc.tier === 'gold').map((rc, i) => ({ uid: 'c' + i, rc, slot: null }));
      for (const day of days('2026-11-10', 60))
        for (const s of sbcsFor(pool, day)) if (s.reqs.some((r) => r.k === 'positions')) expect(autoFill(s, club), s.title).not.toBeNull();
    }, 60000);
  });

  describe('the before fixture (' + SPORT + ')', () => {
    it('matches a fresh snapshot apart from the deliberate changes', async () => {
      const before = await fixture();
      const now = takeSnapshot(pool);
      // a rating module another team owns moved: the fixture can't tell our changes from theirs
      if (now.foreignFingerprint !== before.foreignFingerprint) throw new Error('foreign rating modules changed: run scripts/packs/rebaseline.ts, review the OVR diff, accept (' + JSON.stringify(diffSnapshot(before, now).foreign) + ')');
      const diff = diffSnapshot(before, now);
      // quick-sell: Spotlight, GOAT and Standout (packs-1); soccer's SBC catalogue: the five templates (packs-1)
      const allowed: Record<string, (path: string) => boolean> = { qs: (p) => ['spotlight', 'goat', 'standout'].includes(p), sbcs: () => SPORT === 'soccer' };
      const unexpected = Object.entries(diff).flatMap(([sec, paths]) => paths.filter((p) => !allowed[sec]?.(p)).map((p) => sec + '.' + p));
      expect(unexpected).toEqual([]);
      expect(diff.qs?.length).toBeGreaterThan(0);
    }, 60000);

    it('keeps the 60-day SBC catalogue (NBA, NFL) and every started Live Calendar entry', async () => {
      const before = await fixture();
      const now = takeSnapshot(pool);
      if (SPORT === 'soccer') expect(Object.keys(now.sbcs)).toEqual(Object.keys(before.sbcs));
      else expect(now.sbcs).toEqual(before.sbcs);
      expect(now.started).toEqual(before.started);
      expect(Object.keys(now.started).length).toBe(11);
      expect(now.receipts).toEqual(before.receipts);
      expect(now.numbered).toEqual(before.numbered);
    }, 60000);
  });

  describe('D9: a reward pack an older build doesn’t know (' + SPORT + ')', () => {
    let values: Map<string, string>;
    const storage = () => ({ getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), removeItem: (k: string) => void values.delete(k) });

    it('survives every save path and stays pending when opening it fails', () => {
      values = new Map();
      vi.stubGlobal('localStorage', storage());
      const pending = { id: 'reward:pass:24', kind: 'headliners', at: 1700000000000 };
      const p = freshProfile();
      p.name = 'Pending';
      p.ut = { ...freshUt(), packs: [pending], content: { claims: ['pass:24'] } };
      const key = PROFILE_KEYS[SPORT];
      // every save holds the basketball profile; this sport's (the same key in basketball) holds the pack
      values.set(PROFILE_KEYS.nba, JSON.stringify({ ...freshProfile(), name: 'Pending' }));
      values.set(key, JSON.stringify(p));
      // the profile's own load, the content normalizers (today's and the frozen older build's)
      const loaded = migrateUt(JSON.parse(values.get(key)!).ut);
      expect(loaded.packs).toEqual([pending]);
      expect(legacyNormalizeContent(loaded.content)).toEqual(normalizeContent(loaded.content));
      // the cloud snapshot round trip and the file-backup check
      const snap = captureProgress(storage());
      expect(() => checkedSnapshot(snap)).not.toThrow();
      values = new Map();
      applyProgress(storage(), snap);
      const back = migrateUt(JSON.parse(values.get(key)!).ut);
      expect(back.packs).toEqual([pending]);
      const data: Record<string, string | null> = Object.fromEntries(RECOVERY_KEYS.filter((k) => !OPTIONAL_KEYS.includes(k)).map((k) => [k, null]));
      for (const [k, v] of values) data[k] = v;
      expect(validateSaveValues(data, 1).name).toBe('Pending');
      // opening it: this build throws a message the Store shows, and nothing is spent (UltimateTeam openNow
      // catches it before its update runs). On the base (claude/studio-overhaul) it opened as no cards
      // and the pending pack was gone: docs/studio-overhaul/packs.md, "D9".
      expect(() => openPack(pool, pending.kind, pending.id)).toThrow(UNKNOWN_PACK);
      vi.unstubAllGlobals();
    });
  });

  describe('contracts for the ut team (' + SPORT + ')', () => {
    it('stamps, the Store badge, Season Pass cards', () => {
      const ut = freshUt();
      expect(stampsBalance(ut)).toBe(0);
      const at = Date.UTC(2026, 10, 20, 17);
      expect(storeBadge(pool, ut, at)).toEqual({ n: 1, reasons: ['daily'] });
      const claimedToday = { ...ut, content: { daily: { day: '2026-11-20', streak: 1, total: 1 } } };
      expect(storeBadge(pool, claimedToday, at)).toEqual({ n: 0, reasons: [] });
      expect(seasonPassCard(pool, '2026-11-20', 'A')).toBeNull();
    });

    it('lists the next drops in order, names only (none in soccer yet)', () => {
      const at = Date.UTC(2026, 10, 20, 17);
      const next = upcomingDrops(SPORT, at, 4);
      if (SPORT === 'soccer') return expect(next).toEqual([]);
      expect(next).toHaveLength(4);
      expect(next.map((d) => d.start)).toEqual(next.map((d) => d.start).sort((a, b) => a - b));
      expect(next.every((d) => d.start > at && /^drop:[a-z0-9-]+:w\d$/.test(d.id) && d.band[0] <= d.band[1])).toBe(true);
      // s2-feast-week starts 2026-11-27: midnight Eastern is 05:00 UTC in November
      expect(next[0]).toMatchObject({ id: 'drop:s2-feast-week:w0', start: Date.UTC(2026, 10, 27, 5) });
    });

    it('a program objective card (released only), and the Collection’s editions, best first', () => {
      if (SPORT !== 'soccer') {
        expect(programRewardCard(pool, 's1-first-tip', 'objective', 'u1', '2026-11-12')).toBeNull();
        const a = programRewardCard(pool, 's1-first-tip', 'objective', 'u1', '2026-11-15')!;
        expect(a.tier).toBe('program');
        expect(programRewardCard(pool, 's1-first-tip', 'objective', 'u1', '2026-11-15')!.line.id).toBe(a.line.id);
      }
      const eds = resolvedEditions(pool, ['legend', 'promo', 'landmark']);
      expect(eds.length).toBe(Object.values(pool.buckets.legend).flat().length + Object.values(pool.buckets.promo).flat().length + snapshotEditions(pool).landmark.length);
      expect(eds.map((e) => e.ovr)).toEqual(eds.map((e) => e.ovr).sort((a, b) => b - a));
    });

    it('awards Front Office, 82+ and Program picks once per id, one card kept', () => {
      const at = Date.UTC(2026, 10, 15, 17);
      let ut: UtState = awardPick(freshUt(), pool, 'front-office', 'fo1', at);
      const fo = ut.content!.picks![0];
      expect(fo.options).toHaveLength(5);
      const opts = fo.options.map((id) => pool.base.get(id)!);
      expect(opts.every((rc) => rc.tier === 'gold' && rc.ovr >= fcToDisplay(80, SPORT))).toBe(true);
      expect(new Set(opts.map((rc) => rc.line.pid)).size).toBe(5);
      expect(awardPick(ut, pool, 'front-office', 'fo1', at)).toBe(ut);
      ut = awardPick(ut, pool, 'pick-82', 'p82', at);
      expect(ut.content!.picks![1].options.every((id) => pool.base.get(id)!.ovr >= fcToDisplay(82, SPORT))).toBe(true);
      ut = awardPick(ut, pool, 'program-pick', 'pp', at);
      const pp = ut.content!.picks![2];
      expect(pp.options).toHaveLength(3);
      // a program is live on 2026-11-15 in NBA and NFL; soccer has no calendar, so it falls back to 82+
      expect(pp.kind).toBe(pickFor(SPORT, { nba: 'program-pick', nfl: 'program-pick', soccer: 'pick-82' }));
      const kept = keepPick(ut, 'fo1', 4, at);
      expect(kept.card?.cardId).toBe(fo.options[4]);
      expect(kept.ut.content!.picks!.map((p) => p.id)).toEqual(['p82', 'pp']);
    });
  });

  describe('the frozen older-build normalizer (' + SPORT + ')', () => {
    it('reads every field it knew exactly as today’s normalizer does', () => {
      const raw = {
        daily: { day: '2026-11-10', streak: 3, total: 9 },
        buys: { 'elite:2026-11-10': 2 },
        picks: [{ id: 'x', kind: 'scout', title: 'S', options: ['a', 'b', 'c'], at: 1 }],
        claims: ['a', 'b'],
        market: { day: '2026-11-10', bought: [1, 2] },
        soWins: { week: '2026-W46', ids: ['m1'] },
        draft: { tokenWeek: '2026-W46', history: [{ id: 'd', wins: 2, at: 3 }] },
        era: { eligible: true },
        locked: ['u1'],
        evo: { u1: { done: ['e1'], active: { id: 'e2', games: 1, wins: 1, at: 4 } } },
        evoSeen: ['e1'],
        streams: { s: 40 },
        calendar: { day: '2026-11-10', n: 4 },
        preview: { seed: 's', n: 2, until: 9 },
        pulls: { since: 5, r: [{ id: 'g', k: 'gold', n: 'Gold Pack', c: 900, s: 'store', at: 5, u: 'pack:g:', cs: [['nba:x', 80, 'gold']] }], a: {} },
        future: { dropped: true },
      };
      expect(legacyNormalizeContent(raw)).toEqual(normalizeContent(raw));
      expect(legacyNormalizeContent(raw)).not.toHaveProperty('future');
    });
  });
}
