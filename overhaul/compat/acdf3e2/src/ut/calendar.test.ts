// Claude, 2026-11-01 (wave 3): the Live Calendar (both sports). Schedule shape and owner decisions,
// date → season (incl. the 364-day repeat), deterministic selection, program ids that resolve forever,
// bands (98–99 only in the SBC-only Finale), program packs, season SBCs and picks.
import { SPORT } from '../engine/sport';
import { addDays, cycleOf, daysBetween, nextSeason, per, promoById, promosOn, schedule, seasonOn, seasonsOfCycle, upcoming, wavesOf } from './calendar';
import { compileRule, ruleContext } from './calendar-rules';
import { calendarSbcs } from './calendar-sbc';
import { addPick, keepPick } from './content-packs';
import { liveId, parseLiveId, programReward, promoCards, PROGRAM_CAP, selectPromo } from './live-cards';
import { livePackDef, livePacksOn, livePick, liveBuysLeft, openLivePack, recordLiveBuy, resolvePackKind } from './live-packs';
import { openPack, packRand } from './packs';
import { getPool, type Pool } from './pool';
import { fcToDisplay as onScale } from './fc-scale';
import { checkSbc } from './sbc';
import { freshUt } from './state';
import type { RatedCard } from './types';

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);

const allPromos = () => schedule()!.seasons.flatMap((s) => s.promos);
const rulesOf = (r: unknown): string[] => (typeof r === 'string' ? [r] : Array.isArray(r) ? r : r && typeof r === 'object' && 'pair' in (r as object) ? (r as { pair: string[] }).pair : r && typeof r === 'object' ? Object.values(r as object).flatMap(rulesOf) : []);

describe('Live Calendar schedule', () => {
  it('has contiguous Mon–Sun seasons, the live season 1 untouched, unique ids, valid rules', () => {
    const s = schedule()!;
    expect(s.seasons[0]).toMatchObject({ id: 'season:1', start: '2026-10-26', end: '2026-11-22' });
    expect(s.seasons[1].start).toBe('2026-11-23');
    for (let i = 1; i < s.seasons.length; i++) expect(s.seasons[i].start).toBe(addDays(s.seasons[i - 1].end, 1));
    for (const se of s.seasons) {
      expect(new Date(se.start + 'T12:00:00Z').getUTCDay()).toBe(1);
      expect(new Date(se.end + 'T12:00:00Z').getUTCDay()).toBe(0);
    }
    const ids = [...allPromos().map((p) => p.id), ...s.seasons.flatMap((x) => x.sbcs.map((b) => 'sbc:' + b.id)), ...s.seasons.flatMap((x) => x.packs.map((p) => p.id))];
    expect(new Set(ids).size).toBe(ids.length);
    const ctx = ruleContext(pool.lines);
    for (const p of allPromos()) {
      for (const r of [...rulesOf(p.rule), ...[...wavesOf(p, 'nba'), ...wavesOf(p, 'nfl')].flatMap((w) => rulesOf(w.rule))]) expect(() => compileRule(r, ctx)).not.toThrow();
    }
    expect(() => compileRule('nonsense:1', ctx)).toThrow();
  });

  it('applies the owner decisions: renamed seasons, no league marks in UI text, Finale SBC-only', () => {
    const s = schedule()!;
    const names = s.seasons.map((x) => x.name);
    expect(names).toContain('Summer Run');
    expect(names).toContain('Midseason Stars');
    expect(names).not.toContain('Summer League');
    expect(names).not.toContain('All-Star Break');
    const ui = JSON.stringify([s.seasons.map((x) => [x.name, x.tagline, x.promos.map((p) => [p.name, [...wavesOf(p, 'nba'), ...wavesOf(p, 'nfl')].map((w) => w.label)]), x.packs.map((p) => p.name), x.sbcs.map((b) => b.name)])]);
    expect(ui).not.toMatch(/NBA Cup|Super Bowl|Pro Bowl/);
    for (const se of s.seasons) for (const p of se.packs) for (const id of Object.keys(p.extraOdds ?? {})) expect(promoById(id)?.kind).not.toBe('finale');
  });
});

describe('date → season', () => {
  it('maps days to seasons and repeats seasons 2–12 every 364 days', () => {
    expect(seasonOn('2026-11-01')?.id).toBe('season:1');
    expect(seasonOn('2026-10-01')?.id).toBe('season:1');
    expect(seasonOn('2026-11-23')?.id).toBe('season:2');
    expect(seasonOn('2027-02-20')?.name).toBe('Midseason Stars');
    expect(seasonOn('2027-07-10')?.name).toBe('Summer Run');
    const last = schedule()!.seasons[schedule()!.seasons.length - 1];
    expect(cycleOf(last.end)).toBe(0);
    expect(cycleOf(addDays(last.end, 1))).toBe(1);
    expect(seasonOn(addDays(last.end, 1))).toMatchObject({ id: 'season:13', n: 13, name: schedule()!.seasons[1].name, cycle: 1 });
    for (const d of ['2026-11-25', '2027-01-15', '2027-06-18', '2027-11-01']) {
      const a = seasonOn(d)!;
      const b = seasonOn(addDays(d, 364))!;
      expect(b.name).toBe(a.name);
      expect(b.n).toBe(a.n + 11);
      expect(seasonOn(addDays(d, 728))!.n).toBe(a.n + 22);
    }
    expect(seasonsOfCycle(1)).toHaveLength(11);
    expect(daysBetween(seasonsOfCycle(1)[0].start, seasonsOfCycle(2)[0].start)).toBe(364);
    expect(nextSeason('2026-11-20')?.id).toBe('season:2');
    // repeat promos get their own stable ids
    const p = promoById('s4-honors-y2')!;
    expect(p.start).toBe(addDays(promoById('s4-honors')!.start, 364));
    expect(promosOn(addDays('2027-01-16', 364)).some((x) => x.id === 's4-honors-y2')).toBe(true);
    expect(promoById('s4-honors-y1')).toBeNull();
    const up = upcoming('2026-11-01', 3, SPORT);
    expect(up).toHaveLength(3);
    expect(up[0].date >= '2026-11-01').toBe(true);
  });
});

describe('program cards (' + SPORT + ')', () => {
  it('selects every promo deterministically, distinct players, at or near its count', () => {
    let short = 0;
    for (const p of allPromos()) {
      const need = (wavesOf(p, SPORT).length ? wavesOf(p, SPORT).reduce((a, w) => a + (per(w.count, SPORT) ?? 0), 0) : per(p.count, SPORT)) ?? 0;
      const sel = selectPromo(pool, p.id);
      expect(selectPromo({ ...pool } as Pool, p.id).map((x) => x.id)).toEqual(sel.map((x) => x.id));
      expect(new Set(sel.map((x) => parseLiveId(x.id)!.seasonId.split(':')[3])).size).toBe(sel.length);
      if (sel.length < need) short++;
      expect(sel.length).toBeGreaterThanOrEqual(Math.min(need, Math.ceil(need * 0.6)));
    }
    expect(short).toBeLessThanOrEqual(3);
  });

  it('keeps bands: 98–99 only in the Finale, everything else at most 97', () => {
    let top = 0;
    for (const p of allPromos()) {
      for (const s of selectPromo(pool, p.id)) {
        const rc = pool.base.get(s.id)!;
        expect(rc.tier).toBe('program');
        if (rc.ovr >= 98) {
          expect(p.kind).toBe('finale');
          top++;
        }
        if (p.kind !== 'finale') expect(rc.ovr).toBeLessThanOrEqual(PROGRAM_CAP);
        const band = s.featured ? (p.featured ?? wavesOf(p, SPORT).find((w) => w.featured)?.featured)!.band : p.ovrBand;
        expect(rc.ovr).toBeLessThanOrEqual(Math.max(onScale(band[1], SPORT), 0));
      }
    }
    expect(top).toBeGreaterThan(0);
  });

  it('owned program cards resolve forever from their id', () => {
    const p = allPromos().find((x) => x.id === 's4-honors')!;
    const sel = selectPromo(pool, p.id);
    const rc = pool.base.get(sel[0].id)!;
    expect(rc.line.program).toBe('s4-honors');
    // long after the promo ended, through a fresh lookup
    expect(promoCards(pool, 's4-honors', '2031-01-01').length).toBeGreaterThan(0);
    // a season card the selection never picked still resolves under the promo
    const other = [...pool.base.values()].find((x) => x.line.kind === 'season' && x.tier === 'gold' && !sel.some((s) => s.id.includes(':' + x.line.pid + ':')))!;
    const synthetic = liveId('s4-honors', false, other.line);
    expect(pool.byId.get(synthetic)?.kind).toBe('live');
    expect(pool.base.get(synthetic)?.tier).toBe('program');
    expect(pool.base.get(liveId('s4-honors-y3', false, other.line))?.tier).toBe('program');
    expect(pool.byId.get(SPORT + ':live:unknown-promo:2000:x:YY')).toBeUndefined();
    expect(pool.lines.some((l) => l.kind === 'live')).toBe(false);
  });

  it('releases waves on their dates only', () => {
    const p = promoById('s4-honors')!;
    expect(promoCards(pool, p.id, addDays(p.start, -1))).toHaveLength(0);
    const first = promoCards(pool, p.id, p.start).length;
    const all = promoCards(pool, p.id, p.end).length;
    expect(first).toBeGreaterThan(0);
    expect(all).toBeGreaterThan(first);
  });
});

describe('program packs, picks and SBCs (' + SPORT + ')', () => {
  it('opens program packs with their published shape; the Finale never fills a slot', () => {
    const day = '2027-06-25';
    const packs = livePacksOn(day);
    expect(packs.length).toBeGreaterThan(0);
    for (const pk of packs) {
      const def = livePackDef(SPORT, pk);
      for (const o of def.slots) expect(Object.values(o).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1, 9);
      let program = 0;
      for (let i = 0; i < 150; i++) {
        const cards = openLivePack(pool, pk.id, packRand(pk.id + i), day);
        expect(cards).toHaveLength(def.slots.length);
        for (const c of cards) expect(c.line.programKind).not.toBe('finale');
        if (cards.some((c: RatedCard) => c.tier === 'program')) program++;
      }
      if (pk.tpl === 'guarantee') expect(program).toBe(150);
      else expect(program).toBeGreaterThan(0);
    }
    expect(openPack(pool, packs[0].id, 'x', '2027-W25').length).toBeGreaterThan(0);
  });

  it('limits purchases per day / week', () => {
    const day = '2026-11-14';
    const pk = livePacksOn(day).find((x) => x.tpl === 'guarantee')!;
    let ut = freshUt();
    expect(liveBuysLeft(ut, pk, day)).toBe(1);
    ut = recordLiveBuy(ut, pk, day);
    expect(liveBuysLeft(ut, pk, day)).toBe(0);
    expect(liveBuysLeft(ut, pk, '2026-11-15')).toBe(0);
    expect(liveBuysLeft(ut, pk, '2026-11-16')).toBe(1);
    const prog = livePacksOn(day).find((x) => x.tpl === 'program')!;
    for (let i = 0; i < 3; i++) ut = recordLiveBuy(ut, prog, day);
    expect(liveBuysLeft(ut, prog, day)).toBe(0);
    expect(liveBuysLeft(ut, prog, '2026-11-15')).toBe(3);
  });

  it('pick sheets keep exactly one program card, seeded', () => {
    const a = livePick(pool, 'live-pick:s4-honors:3', 'pid1', '2027-01-25', 1)!;
    expect(a.options).toHaveLength(3);
    expect(livePick(pool, 'live-pick:s4-honors:3', 'pid1', '2027-01-25', 1)!.options).toEqual(a.options);
    const ut = addPick(freshUt(), a);
    const k = keepPick(ut, 'pid1', 0, 2);
    expect(pool.base.get(k.card!.cardId)!.tier).toBe('program');
    expect(keepPick(k.ut, 'pid1', 1, 3).card).toBeNull();
    expect(resolvePackKind('scout-choice', '2027-01-25')).toBe('scout');
    expect(resolvePackKind('season-program-pick', '2027-01-25')).toMatch(/^live-pick:/);
  });

  it('lists the season SBCs; the Finale SBC pays a 98–99 card', () => {
    const fin = calendarSbcs(pool, freshUt(), '2027-06-20').find((s) => s.id.startsWith('cal:s8-finale-99:'))!;
    expect(fin).toBeTruthy();
    expect(fin.kind).toBe('program');
    expect(fin.reward.programFeatured).toBe(true);
    const rc = programReward(pool, fin.reward.program!, true, '2027-06-20')!;
    expect(rc.ovr).toBeGreaterThanOrEqual(98);
    expect(checkSbc(fin, []).ok).toBe(false);
    const ut = { ...freshUt(), content: { claims: ['sbc:cal:s8-lottery:0', 'sbc:cal:s8-lottery:1'] } };
    expect(calendarSbcs(pool, ut, '2027-06-25').find((s) => s.id.startsWith('cal:s8-lottery:'))?.id).toBe('cal:s8-lottery:2');
    expect(calendarSbcs(pool, freshUt(), '2026-11-15').length).toBeGreaterThan(0);
  });
});

describe('program pack economy (' + SPORT + ')', () => {
  it('a base Program Pack and Guarantee return about half their price in quick-sell value', async () => {
    const { quickSellValue } = await import('./packs');
    const day = '2026-11-15';
    for (const pk of livePacksOn(day)) {
      const def = livePackDef(SPORT, pk);
      let v = 0;
      const N = 150;
      for (let i = 0; i < N; i++) v += openLivePack(pool, pk.id, packRand('ev' + pk.id + i), day).reduce((a, c) => a + quickSellValue(c), 0);
      const ratio = v / N / def.price;
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.65);
    }
  });
});

describe('frozen promo selections (' + SPORT + ')', () => {
  it('cover every scheduled promo and match a fresh selection today', async () => {
    const { manifest, setManifest } = await import('./calendar');
    const m = manifest();
    for (const p of allPromos()) {
      const need = (wavesOf(p, SPORT).length ? wavesOf(p, SPORT).reduce((a, w) => a + (per(w.count, SPORT) ?? 0), 0) : per(p.count, SPORT)) ?? 0;
      if (need) expect(m[p.id]?.[SPORT]?.length).toBeGreaterThan(0);
    }
    const frozenIds = (id: string) => selectPromo(pool, id).map((x) => x.id);
    setManifest({});
    try {
      for (const p of allPromos()) if (m[p.id]?.[SPORT]) expect(selectPromo({ ...pool } as Pool, p.id).map((x) => x.id)).toEqual(m[p.id][SPORT]!.map(([id]) => id));
    } finally {
      setManifest(m);
    }
    // every frozen id resolves to a program card
    for (const p of allPromos()) for (const id of frozenIds(p.id)) expect(pool.base.get(id)?.tier).toBe('program');
  });
});
