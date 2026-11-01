// Claude, 2026-11-01: UT content drop 2 (both sports: npm test runs NBA then PS_SPORT=nfl).
// Editions resolve forever, odds add up, weekly/daily content is deterministic, every reward is
// claimed exactly once, saves migrate additively, pick sheets keep exactly one card, the market
// sells once, and Draft settles each game once for the active run only.
import { SPORT } from '../engine/sport';
import { claimed, normalizeContent } from './content-state';
import { addPick, buysLeft, claimDaily, dailyPackId, dailyStatus, keepPick, LIMITS, lightningWindow, minutesToLightning, pickFor, previousDay, recordBuy, scoutOptions } from './content-packs';
import { claimStandoutObjective, recordStandoutWin, standoutWins } from './content-progress';
import { contentSbcs, landmarkCards, landmarkSbcs } from './content-sbc';
import { autoDraft, chooseCaptain, claimDraft, DRAFT_GAMES, draftComplete, draftOf, draftPick, draftRung, draftSlots, draftWire, retireDraft, settleDraft, startDraft, tokenReady } from './draft-mode';
import { deriveEditionLine, landmarkId, LANDMARK_CAP, LANDMARK_FLOOR, parseEditionId, standoutId, STANDOUT_CAP, STANDOUT_FEATURED_CAP } from './editions';
import { landmarkCatalog, LANDMARK_ATTRS, type LandmarkType } from './landmarks';
import { buyMarket, marketBought, marketFor, MARKET_FLOOR, swapForPick } from './market';
import { packTags } from './pack-helper';
import { openPack, packDefs, quickSellValue } from './packs';
import { getPool, type Pool } from './pool';
import { isRare, rareInfo } from './rare';
import { rateCard, TIER_CUTS } from './rate';
import { fcToDisplay as onScale } from './fc-scale';
import { claimSet, setsFor } from './sets';
import { playerChem } from './chem-pips';
import { freshUt, migrateUt, type UtState } from './state';
import { standoutProgram, STANDOUT_COUNT, standoutBand, standoutsIn } from './standouts';
import { squadFromWire } from './teams';
import type { OwnedCard, RatedCard } from './types';

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);

const W = '2026-W44';
const DAY = '2026-11-01';
const owned = (cardId: string, uid: string): OwnedCard => ({ uid, cardId, level: 1, xp: 0, at: 1 });
const anySeason = (pred: (rc: RatedCard) => boolean = () => true) => [...pool.base.values()].find((rc) => rc.line.kind === 'season' && pred(rc))!;

describe('editions (' + SPORT + ')', () => {
  it('builds and parses stable Standout and Landmark ids', () => {
    const s = anySeason((rc) => rc.tier === 'gold').line;
    const id = standoutId(W, false, s);
    expect(id).toBe(`${SPORT}:standout:${W}:${s.season}:${s.pid}:${s.fr}`);
    expect(parseEditionId(id)).toMatchObject({ kind: 'standout', week: W, featured: false, seasonId: s.id });
    expect(parseEditionId(standoutId(W, true, s))).toMatchObject({ featured: true, week: W });
    expect(parseEditionId(landmarkId(s))).toMatchObject({ kind: 'landmark', seasonId: s.id });
    expect(parseEditionId(s.id)).toBeNull();
    expect(parseEditionId('nba:standout:bad:1:2:3')).toBeNull();
  });

  it('resolves an owned Standout from any week forever, through the pool and squads', () => {
    const s = anySeason((rc) => rc.tier === 'gold').line;
    for (const wk of ['2026-W01', '2026-W44', '2031-W52']) {
      const id = standoutId(wk, false, s);
      expect(pool.byId.get(id)?.kind).toBe('standout');
      expect(pool.byId.has(id)).toBe(true);
      expect(pool.base.get(id)?.tier).toBe('standout');
      const sq = squadFromWire(pool, [[pool.sport === 'nba' ? 'B1' : 'K', id, 2]]);
      if (pool.sport === 'nba') expect(sq.B1?.line.id).toBe(id);
    }
    // derived lines never join the built lines
    expect(pool.lines.some((l) => l.kind === 'standout')).toBe(false);
    expect(pool.byId.get(`${SPORT}:standout:${W}:1800:nobody:XXX`)).toBeUndefined();
  });

  it('rates Standouts +3 (featured +5) capped at 92/93, boosting the best face attributes and never FT', () => {
    for (const rc of [...pool.base.values()].filter((x) => x.line.kind === 'season' && x.tier === 'gold').slice(0, 300)) {
      const base = rateCard(rc.line);
      const so = pool.base.get(standoutId(W, false, rc.line))!;
      const fe = pool.base.get(standoutId(W, true, rc.line))!;
      expect(so.ovr).toBe(Math.max(base.ovr, Math.min(STANDOUT_CAP, base.ovr + 3)));
      expect(fe.ovr).toBe(Math.max(base.ovr, Math.min(STANDOUT_FEATURED_CAP, base.ovr + 5)));
      if (base.face && so.face) expect(so.face[0][2] - base.face[0][2]).toBe(Math.min(99 - base.face[0][2], so.ovr - base.ovr));
      if (base.attrs.FT !== undefined) expect(so.attrs.FT).toBe(base.attrs.FT);
      for (const [c, v] of Object.entries(so.attrs)) expect(v - base.attrs[c]).toBeLessThanOrEqual(3);
      expect(Object.keys(so.attrs).some((c) => so.attrs[c] > base.attrs[c])).toBe(true);
    }
  });

  it('rates Landmarks into 85–93 with the landmark skills +6 and weak skills kept', () => {
    const cat = [...landmarkCatalog(pool.lines).values()];
    expect(cat.length).toBeGreaterThan(30);
    for (const lm of cat.slice(0, 60)) {
      const season = pool.byId.get(lm.seasonId)!;
      const base = rateCard(season);
      const rc = pool.base.get(landmarkId(season))!;
      expect(rc.tier).toBe('landmark');
      expect(rc.line.landmark).toBe(lm.text);
      expect(rc.ovr).toBe(Math.max(LANDMARK_FLOOR, Math.min(LANDMARK_CAP, base.ovr + 4)));
      const face = new Set(base.key.map(([c]) => c));
      for (const [c, v] of Object.entries(rc.attrs)) {
        const d = v - base.attrs[c];
        if (!LANDMARK_ATTRS[lm.type as LandmarkType].includes(c) && !face.has(c)) expect(d).toBe(0);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });

  it('a Landmark whose season left the catalog still resolves with a printed line', () => {
    const s = anySeason((rc) => !landmarkCatalog(pool.lines).has(rc.line.id)).line;
    const line = deriveEditionLine(landmarkId(s), (id) => pool.byId.get(id), pool.lines);
    expect(line?.kind).toBe('landmark');
    expect(line?.landmark).toBeTruthy();
  });
});

describe('Weekly Standouts (' + SPORT + ')', () => {
  it('is deterministic per week and different across weeks', () => {
    const a = standoutProgram(pool, W);
    expect(a.cards).toHaveLength(STANDOUT_COUNT[SPORT]);
    expect(new Set(a.cards.map((c) => c.line.pid)).size).toBe(a.cards.length);
    expect(a.cards[0].line.featured).toBe(true);
    expect(a.cards.slice(1).every((c) => !c.line.featured)).toBe(true);
    const [lo, hi] = standoutBand(SPORT);
    for (const c of a.cards) {
      const base = rateCard(pool.byId.get(c.line.seasonId!)!).ovr;
      expect(base).toBeGreaterThanOrEqual(lo);
      expect(base).toBeLessThanOrEqual(hi);
      expect(c.ovr).toBeLessThanOrEqual(STANDOUT_FEATURED_CAP);
    }
    const again = standoutProgram({ ...pool } as Pool, W).cards.map((c) => c.line.id);
    expect(again).toEqual(a.cards.map((c) => c.line.id));
    expect(standoutProgram(pool, '2026-W45').cards.map((c) => c.line.id)).not.toEqual(again);
  });

  it('counts the weekly objective once per match and pays one Standout pick', () => {
    const ids = standoutProgram(pool, W).cards.slice(0, 2).map((c) => c.line.id);
    expect(standoutsIn(ids)).toBe(2);
    let ut = freshUt();
    for (let i = 0; i < 7; i++) ut = recordStandoutWin(ut, { matchId: 'm' + (i % 6), week: W, won: true, cardIds: ids });
    ut = recordStandoutWin(ut, { matchId: 'lost', week: W, won: false, cardIds: ids });
    ut = recordStandoutWin(ut, { matchId: 'one', week: W, won: true, cardIds: ids.slice(0, 1) });
    expect(standoutWins(ut, W)).toBe(5);
    const a = claimStandoutObjective(ut, pool, W, 5);
    expect(a.content?.picks).toHaveLength(1);
    expect(claimStandoutObjective(a, pool, W, 6)).toBe(a);
    expect(a.content!.picks![0].options.every((id) => parseEditionId(id)?.kind === 'standout')).toBe(true);
  });

  it('lists a weekly Standout SBC and three Landmark SBCs, the same all week', () => {
    const s = contentSbcs(pool, W);
    expect(s[0]).toMatchObject({ id: 'so:' + W, kind: 'standout' });
    const lm = landmarkSbcs(pool, W);
    expect(lm).toHaveLength(3);
    expect(lm.map((x) => x.id)).toEqual(landmarkSbcs(pool, W).map((x) => x.id));
    for (const x of lm) expect(pool.base.get(x.reward.cardId!)?.tier).toBe('landmark');
    expect(landmarkCards(pool).length).toBe(landmarkCatalog(pool.lines).size);
  });
});

describe('packs and odds (' + SPORT + ')', () => {
  it('every slot of every pack adds up to 1', () => {
    for (const def of Object.values(packDefs(SPORT))) for (const o of def.slots) expect(Object.values(o).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1, 9);
  });

  it('marks about 35% of each position’s golds rare', () => {
    const r = rareInfo(pool);
    for (const [pos, list] of Object.entries(pool.buckets.gold)) {
      const season = list.filter((x) => x.line.kind === 'season');
      if (season.length < 40) continue;
      const share = (r.buckets[pos]?.length ?? 0) / season.length;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.5);
    }
  });

  it('opens the new packs with their guarantees', () => {
    const defs = packDefs(SPORT);
    const gold = (c: RatedCard) => ['gold', 'standout', 'promo', 'legend', 'landmark'].includes(c.tier);
    for (let i = 0; i < 60; i++) {
      const g = openPack(pool, 'gold', 'g' + i, W);
      expect(g.filter((c) => isRare(c, pool)).length).toBeGreaterThanOrEqual(SPORT === 'nba' ? 1 : 2);
      const e = openPack(pool, 'elite', 'e' + i, W);
      expect(e).toHaveLength(defs.elite.slots.length);
      expect(e.every(gold)).toBe(true);
      expect(e.filter((c) => isRare(c, pool)).length).toBeGreaterThanOrEqual(defs.elite.slots.length - 1);
      const j = openPack(pool, 'jumbo', 'j' + i, W);
      expect(j).toHaveLength(SPORT === 'nba' ? 16 : 32);
      for (const kind of ['standout', 'lightning']) {
        const s = openPack(pool, kind, kind + i, W);
        expect(s).toHaveLength(SPORT === 'nba' ? 8 : 16);
        expect(s.filter((c) => c.tier === 'standout')).toHaveLength(1);
      }
      const d = openPack(pool, 'daily', 'd' + i, W);
      expect(d).toHaveLength(SPORT === 'nba' ? 3 : 6);
      expect(new Set(d.map((c) => c.line.id)).size).toBe(d.length);
    }
    expect(() => openPack(pool, 'scout', 'x')).toThrow();
  });

  it('values the new tiers for quick-sell above a gold', () => {
    const so = standoutProgram(pool, W).cards[1];
    expect(quickSellValue(so)).toBeGreaterThan(quickSellValue(rateCard(pool.byId.get(so.line.seasonId!)!)));
  });
});

describe('Daily Drop, limits and picks', () => {
  it('claims once a day, keeps a streak, pays a Gold pack on day 7 once', () => {
    let ut = freshUt();
    expect(previousDay('2026-11-01')).toBe('2026-10-31');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    for (const [i, d] of days.entries()) {
      expect(dailyStatus(ut, d)).toEqual({ ready: true, streak: i + 1 });
      const r = claimDaily(ut, d, i)!;
      expect(r.streak).toBe(i + 1);
      expect(r.gold).toBe(i === 6);
      ut = r.ut;
      expect(claimDaily(ut, d, i)).toBeNull();
    }
    expect(ut.packs.filter((p) => p.kind === 'gold')).toHaveLength(1);
    expect(dailyStatus(ut, '2026-11-08').streak).toBe(1);
    expect(dailyStatus(ut, '2026-11-10').streak).toBe(1);
    expect(dailyPackId('nba', DAY)).not.toBe(dailyPackId('nfl', DAY));
  });

  it('enforces per-day, per-week and Lightning-window limits', () => {
    let ut = freshUt();
    const at = Date.parse('2026-11-01T16:30:00Z'); // Sunday 11:30 Eastern
    expect(buysLeft(ut, 'elite', DAY, at)).toBe(LIMITS.elite.n);
    ut = recordBuy(recordBuy(ut, 'elite', DAY, at), 'elite', DAY, at);
    expect(buysLeft(ut, 'elite', DAY, at)).toBe(0);
    expect(buysLeft(ut, 'elite', '2026-11-02', at)).toBe(2);
    ut = recordBuy(ut, 'standout', DAY, at);
    expect(buysLeft(ut, 'standout', '2026-10-31', at)).toBe(0); // same ISO week
    expect(lightningWindow(at)).toBeNull();
    expect(buysLeft(ut, 'lightning', DAY, at)).toBe(0);
    const open = Date.parse('2026-11-01T17:30:00Z'); // Sunday 12:30 Eastern
    expect(lightningWindow(open)?.id).toBe('2026-11-01:12');
    expect(minutesToLightning(at)).toBe(30);
    expect(buysLeft(ut, 'lightning', DAY, open)).toBe(1);
    ut = recordBuy(ut, 'lightning', DAY, open);
    expect(buysLeft(ut, 'lightning', DAY, open)).toBe(0);
    expect(lightningWindow(Date.parse('2026-11-03T17:30:00Z'))).toBeNull(); // a Tuesday
  });

  it('Scout’s Choice offers three different 84+ players and keeps exactly one', () => {
    const { options } = scoutOptions(pool, 'seed-1', W);
    expect(options).toHaveLength(3);
    expect(new Set(options.map((c) => c.line.pid)).size).toBe(3);
    for (const c of options) expect(c.ovr).toBeGreaterThanOrEqual(c.tier === 'standout' ? 0 : onScale(84, SPORT));
    expect(scoutOptions(pool, 'seed-1', W).options.map((c) => c.line.id)).toEqual(options.map((c) => c.line.id));
    let ut = addPick(freshUt(), pickFor(pool, 'scout', 'p1', W, 1));
    ut = addPick(ut, pickFor(pool, 'scout', 'p1', W, 1));
    expect(ut.content?.picks).toHaveLength(1);
    const r = keepPick(ut, 'p1', 1, 9);
    expect(r.card?.cardId).toBe(ut.content!.picks![0].options[1]);
    expect(r.ut.owned).toHaveLength(1);
    expect(r.ut.content?.picks).toHaveLength(0);
    expect(keepPick(r.ut, 'p1', 0, 9).card).toBeNull();
    expect(addPick(r.ut, pickFor(pool, 'scout', 'p1', W, 1)).content?.picks).toHaveLength(0);
    expect(keepPick(ut, 'p1', 5, 9).card).toBeNull();
  });
});

describe('Scout Market and Swap Desk (' + SPORT + ')', () => {
  it('has twelve deterministic daily cards at fixed prices, each bought once', () => {
    const m = marketFor(pool, DAY);
    expect(m).toHaveLength(12);
    expect(marketFor({ ...pool } as Pool, DAY).map((x) => x.cardId)).toEqual(m.map((x) => x.cardId));
    expect(marketFor(pool, '2026-11-02').map((x) => x.cardId)).not.toEqual(m.map((x) => x.cardId));
    for (const it of m) expect(it.price).toBeGreaterThanOrEqual(MARKET_FLOOR[it.tag] ?? 0);
    let ut = freshUt();
    const r = buyMarket(ut, pool, DAY, 3, 1e6, 1)!;
    expect(r.price).toBe(m[3].price);
    ut = r.ut;
    expect(ut.owned.map((c) => c.cardId)).toEqual([m[3].cardId]);
    expect(buyMarket(ut, pool, DAY, 3, 1e6, 2)).toBeNull();
    expect(buyMarket(ut, pool, DAY, 4, 0, 2)).toBeNull();
    expect(marketBought(ut, '2026-11-02').size).toBe(0);
  });

  it('swaps exactly five stored duplicate golds for one pick', () => {
    const golds = Object.values(pool.buckets.gold).flat().filter((x) => x.line.kind === 'season').slice(0, 5);
    let ut: UtState = migrateUt({ ...freshUt(), owned: golds.flatMap((g, i) => [owned(g.line.id, 'a' + i), owned(g.line.id, 'b' + i)]) });
    const stored = ut.duplicateStorage!;
    expect(stored).toHaveLength(5);
    expect(swapForPick(ut, pool, stored.slice(0, 4), 'x', DAY, 1)).toBeNull();
    const after = swapForPick(ut, pool, stored, 'x', DAY, 1)!;
    expect(after.owned).toHaveLength(5);
    expect(after.content?.picks).toHaveLength(1);
    expect(after.retirements).toHaveLength(5);
  });
});

describe('Set Collections (' + SPORT + ')', () => {
  it('pays a completed set once', () => {
    const sets = setsFor(pool, freshUt());
    const era = sets.find((s) => s.kind === 'era')!;
    expect(era.have).toBe(0);
    const [, fr, decade] = era.id.split(':');
    const pids = new Set<string>();
    const cards = Object.values(pool.buckets.gold)
      .flat()
      .filter((rc) => rc.line.kind === 'season' && rc.line.fr === fr && Math.floor(rc.line.season / 10) * 10 === Number(decade) && !pids.has(rc.line.pid) && pids.add(rc.line.pid));
    let ut = migrateUt({ ...freshUt(), owned: cards.slice(0, era.need).map((rc, i) => owned(rc.line.id, 'c' + i)) });
    const done = setsFor(pool, ut).find((s) => s.id === era.id)!;
    expect(done.have).toBe(era.need);
    const r = claimSet(pool, ut, era.id, 1);
    expect(r.coins).toBe(era.coins);
    expect(r.ut.packs).toHaveLength(1);
    expect(claimed(r.ut, 'set:' + era.id)).toBe(true);
    expect(claimSet(pool, r.ut, era.id, 2).coins).toBe(0);
    // progress is discovery: selling every card keeps the set claimed and complete
    ut = migrateUt({ ...r.ut, owned: [] });
    expect(setsFor(pool, ut).find((s) => s.id === era.id)).toMatchObject({ claimed: true, have: era.need });
    expect(claimSet(pool, ut, sets.find((s) => s.id === 'program:standouts-3')!.id, 3).coins).toBe(0);
  });
});

describe('UT Draft (' + SPORT + ')', () => {
  const run = () => {
    let ut = startDraft(freshUt(), pool, 'run1', 1, W, 'coins');
    ut = chooseCaptain(ut, pool, 0);
    ut = draftPick(ut, pool, 2);
    return autoDraft(ut, pool);
  };
  it('drafts a captain and one of five for every spot', () => {
    const ut = run();
    const r = draftOf(ut)!;
    expect(r.captains).toHaveLength(5);
    expect(draftComplete(SPORT, r)).toBe(true);
    expect(Object.keys(r.squad)).toHaveLength(draftSlots(SPORT).length);
    expect(new Set(Object.values(r.squad).map((id) => pool.base.get(id)!.line.pid)).size).toBe(draftSlots(SPORT).length);
    expect(Object.keys(squadFromWire(pool, draftWire(r)))).toHaveLength(draftSlots(SPORT).length);
    expect(ut.owned).toHaveLength(0);
    expect(() => startDraft(ut, pool, 'run2', 2, W, 'coins')).toThrow();
    expect(draftRung(pool, r, 0)!.squad.length).toBeGreaterThan(4);
    expect(draftRung(pool, r, 4)).toBeNull();
  });

  it('settles each game once for the active run, ends on a loss and pays once', () => {
    let ut = run();
    const base = { runId: 'run1', us: 50, them: 40, at: 1, day: DAY, how: 'sim' as const, opponent: 'AI' };
    let r = settleDraft(ut, { ...base, game: 0, won: true, matchId: 'd0' });
    expect(r.ok).toBe(true);
    ut = r.ut;
    expect(settleDraft(ut, { ...base, game: 0, won: true, matchId: 'd0' }).ok).toBe(false);
    expect(settleDraft(ut, { ...base, game: 0, won: true, matchId: 'd0b' }).ok).toBe(false);
    expect(settleDraft(ut, { ...base, game: 1, won: true, matchId: 'd0' }).ok).toBe(false);
    expect(settleDraft(ut, { ...base, runId: 'other', game: 1, won: true, matchId: 'x' }).ok).toBe(false);
    expect(claimDraft(ut, 2).coins + (claimDraft(ut, 2).pack ? 1 : 0)).toBe(0);
    r = settleDraft(ut, { ...base, game: 1, won: false, matchId: 'd1' });
    ut = r.ut;
    expect(draftOf(ut)).toMatchObject({ wins: 1, games: 2, done: true });
    expect(settleDraft(ut, { ...base, game: 2, won: true, matchId: 'd2' }).ok).toBe(false);
    const c = claimDraft(ut, 3);
    expect(c).toMatchObject({ coins: 200, pack: 'silver', wins: 1 });
    expect(c.ut.packs.filter((p) => p.id === 'draft:run1')).toHaveLength(1);
    expect(draftOf(c.ut)).toBeUndefined();
    expect(claimDraft(c.ut, 4).coins).toBe(0);
    expect(c.ut.record.w).toBe(1);
    expect(c.ut.record.l).toBe(1);
    expect(c.ut.content?.draft?.history?.[0]).toMatchObject({ id: 'run1', wins: 1 });
  });

  it('gives one free entry a week, and can retire a run', () => {
    let ut = startDraft(freshUt(), pool, 't1', 1, W, 'token');
    expect(tokenReady(ut, W)).toBe(false);
    ut = retireDraft(ut);
    ut = claimDraft(ut, 2).ut;
    expect(() => startDraft(ut, pool, 't2', 1, W, 'token')).toThrow();
    expect(tokenReady(ut, '2026-W45')).toBe(true);
    expect(DRAFT_GAMES).toBe(4);
  });
});

describe('save migration', () => {
  it('keeps an old save exactly as it was (no content field appears)', () => {
    const old = { ...freshUt(), owned: [owned(`${SPORT}:season:1996:x:CHI`, 'u1')], squad: { PG: 'u1' } };
    const m = migrateUt(JSON.parse(JSON.stringify(old)));
    expect(m.content).toBeUndefined();
    expect(m.owned).toEqual(old.owned);
    expect(m.squad).toEqual(old.squad);
  });

  it('round-trips content and drops junk', () => {
    let ut = freshUt();
    ut = claimDaily(ut, DAY, 1)!.ut;
    ut = recordBuy(ut, 'elite', DAY, 1);
    ut = addPick(ut, { id: 'p', kind: 'scout', title: 'S', options: ['a', 'b', 'c'], at: 1 });
    const back = migrateUt(JSON.parse(JSON.stringify(ut)));
    expect(back.content).toEqual(ut.content);
    expect(normalizeContent({ daily: 5, picks: [{ id: 1 }], claims: ['a', 3, 'a'], market: { day: DAY, bought: [1, 1, -1, 'x'] } })).toEqual({ picks: [], claims: ['a'], market: { day: DAY, bought: [1] } });
    expect(normalizeContent('junk')).toBeUndefined();
  });
});

describe('pack helper and chemistry pips (' + SPORT + ')', () => {
  it('tags new cards, upgrades and spare copies', () => {
    const g = Object.values(pool.buckets.gold).flat().filter((x) => x.line.kind === 'season');
    const a = g[0];
    const ut = migrateUt({ ...freshUt(), owned: [owned(a.line.id, 'u1')] });
    const tags = packTags(pool, ut, {}, [a, g[1], g[1]]);
    expect(tags[0].map((t) => t.k)).toContain('fodder');
    expect(tags[1].map((t) => t.k)).toContain('new');
    expect(tags[2].map((t) => t.k)).not.toContain('new');
    const low = { ...g[1], ovr: 10 };
    const slot = pool.sport === 'nba' ? a.line.pos[0] : undefined;
    if (slot) expect(packTags(pool, ut, { [slot]: low }, [a])[0].find((t) => t.k === 'upgrade')?.text).toBe('UPGRADE +' + (a.ovr - 10));
  });

  it('gives each filled spot 0-3 pips from its own links', () => {
    const g = Object.values(pool.buckets.gold).flat();
    const same = g.filter((x) => x.line.fr === g[0].line.fr && x.line.season === g[0].line.season);
    const lineup = pool.sport === 'nba' ? { PG: same[0], SG: same[1] ?? same[0], SF: null } : { LT: same[0], LG: same[1] ?? same[0] };
    const pips = playerChem(pool.sport, lineup);
    for (const v of Object.values(pips)) expect(v).toBeGreaterThanOrEqual(0);
    expect(Math.max(...Object.values(pips))).toBeGreaterThan(0);
    expect(pips.SF).toBeUndefined();
  });
});

describe('the Gold pack keeps a gold floor (' + SPORT + ')', () => {
  it('guarantees its golds', () => {
    for (let i = 0; i < 50; i++) expect(openPack(pool, 'gold', 'gf' + i, W).filter((c) => c.ovr >= TIER_CUTS[SPORT].gold).length).toBeGreaterThanOrEqual(SPORT === 'nba' ? 3 : 10);
  });
});

describe('New Era bundle (' + SPORT + ')', () => {
  it('is eligible only for saves that existed before this build', async () => {
    const { stampNewEra, markNewPlayer, newEraReady } = await import('./new-era');
    const old = migrateUt({ ...freshUt(), owned: [owned(`${SPORT}:season:1996:x:CHI`, 'u1')] });
    expect(newEraReady(stampNewEra(old, {}))).toBe(true);
    // no UT cards, but games played before: still an existing player
    expect(newEraReady(stampNewEra(migrateUt(undefined), { stats: { games: 3 } }))).toBe(true);
    expect(newEraReady(stampNewEra(migrateUt(undefined), { xp: 0, stats: { games: 0 } }))).toBe(false);
    // a new player is marked at creation and stays ineligible after playing
    const fresh = markNewPlayer(freshUt());
    const played = stampNewEra(migrateUt(JSON.parse(JSON.stringify({ ...fresh, owned: [owned('x', 'u')], packsOpened: 3 }))), { stats: { games: 9 }, xp: 500 });
    expect(newEraReady(played)).toBe(false);
    // the marker survives migration and a cloud (JSON) round trip, and is never re-stamped
    const stamped = stampNewEra(old, {});
    const back = stampNewEra(migrateUt(JSON.parse(JSON.stringify(stamped))), { stats: { games: 0 } });
    expect(back.content?.era).toEqual({ eligible: true });
  });

  it('pays the Icon pick once per sport and the coins once per wallet', async () => {
    const { stampNewEra, claimNewEra, newEraReady, NEW_ERA_COINS, NEW_ERA_ID, legendOptions } = await import('./new-era');
    const opts = legendOptions(pool, 'x');
    expect(opts).toHaveLength(3);
    for (const id of opts) expect(pool.base.get(id)!.tier).toBe('legend');
    expect(new Set(opts.map((id) => pool.base.get(id)!.line.pid)).size).toBe(3);
    expect(legendOptions(pool, 'x')).toEqual(opts);
    // Icons are all-time greats, not modern star seasons (owner QA: a 2021-22 centre was offered)
    const { ICON_BEFORE } = await import('./new-era');
    for (const seed of ['x', 'y', 'z', 'nba', 'nfl']) for (const id of legendOptions(pool, seed)) expect(pool.base.get(id)!.line.season).toBeLessThan(ICON_BEFORE);
    const ut = stampNewEra(migrateUt({ ...freshUt(), packsOpened: 2 }), {});
    const p0 = { coins: 100, gifts: [] as string[], ut };
    const p1 = claimNewEra(p0, pool, 1);
    expect(p1.coins).toBe(100 + NEW_ERA_COINS);
    expect(p1.gifts).toEqual([NEW_ERA_ID]);
    expect(p1.ut.content?.picks).toHaveLength(1);
    expect(newEraReady(p1.ut)).toBe(false);
    expect(claimNewEra(p1, pool, 2)).toBe(p1);
    // round trip, then the pick is kept exactly once
    const restored = { ...p1, ut: migrateUt(JSON.parse(JSON.stringify(p1.ut))) };
    expect(claimNewEra(restored, pool, 3)).toBe(restored);
    const k = keepPick(restored.ut, restored.ut.content!.picks![0].id, 2, 4);
    expect(pool.base.get(k.card!.cardId)!.tier).toBe('legend');
    expect(keepPick(k.ut, restored.ut.content!.picks![0].id, 0, 5).card).toBeNull();
    // the other sport's eligible save: its own Icon pick, but no second 65,000 coins
    const other = claimNewEra({ coins: p1.coins, gifts: p1.gifts, ut: stampNewEra(migrateUt({ ...freshUt(), packsOpened: 1 }), {}) }, pool, 6);
    expect(other.coins).toBe(p1.coins);
    expect(other.ut.content?.picks).toHaveLength(1);
    // never eligible: nothing happens
    const none = { coins: 5, ut: stampNewEra(migrateUt(undefined), {}) };
    expect(claimNewEra(none, pool, 7)).toBe(none);
  });
});

describe('Favourite / LOCK (' + SPORT + ')', () => {
  it('toggles, survives migration and keeps a locked copy out of the Swap Desk', async () => {
    const { isLocked, toggleLock } = await import('./content-state');
    const golds = Object.values(pool.buckets.gold).flat().filter((x) => x.line.kind === 'season').slice(0, 5);
    let ut: UtState = migrateUt({ ...freshUt(), owned: golds.flatMap((g, i) => [owned(g.line.id, 'a' + i), owned(g.line.id, 'b' + i)]) });
    const stored = ut.duplicateStorage!;
    ut = toggleLock(ut, stored[0]);
    expect(isLocked(ut, stored[0])).toBe(true);
    expect(isLocked(migrateUt(JSON.parse(JSON.stringify(ut))), stored[0])).toBe(true);
    expect(swapForPick(ut, pool, stored, 'x', DAY, 1)).toBeNull();
    ut = toggleLock(ut, stored[0]);
    expect(isLocked(ut, stored[0])).toBe(false);
    expect(swapForPick(ut, pool, stored, 'x', DAY, 1)).not.toBeNull();
  });
});

describe('pack prices after the ratings rework (' + SPORT + ')', () => {
  it('every paid pack returns 45–60% of its price in quick-sell value', async () => {
    const { positionChoices } = await import('./packs');
    const defs = packDefs(SPORT);
    for (const d of Object.values(defs)) {
      // spotlight is registry-rolled, scout a pick, daily free, lightning a 25% discount by design
      if (['spotlight', 'scout', 'daily', 'lightning'].includes(d.kind)) continue;
      let v = 0;
      const N = 300;
      for (let i = 0; i < N; i++) v += openPack(pool, d.kind === 'position' ? 'position:' + positionChoices(SPORT)[i % positionChoices(SPORT).length].key : d.kind, 'ev' + i, W).reduce((a, c) => a + quickSellValue(c), 0);
      const r = v / N / d.price;
      expect(r, d.kind).toBeGreaterThan(0.43);
      expect(r, d.kind).toBeLessThan(0.63);
    }
  }, 120000);
});
