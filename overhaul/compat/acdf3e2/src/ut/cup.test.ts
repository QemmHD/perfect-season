// Codex: real-pool Cups across NBA/NFL/Soccer; roster checks, deterministic matches and protected receipts.
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { getPool, type Pool } from './pool';
import { freshUt, migrateUt, type UtState } from './state';
import { canPlay, setSoccerFormation, slotsFor } from './squad';
import { TIER_CUTS } from './rate';
import { CUP_KINDS, normalizeCup } from './cup-state';
import {
  CUP_PRIZES,
  claimCup,
  cupClaimId,
  cupEligibility,
  cupOf,
  cupOpponent,
  cupRule,
  retireCup,
  settleCup,
  startCup,
  validCupRequest,
} from './cup';
import type { RatedCard } from './types';
let pool: Pool, club: UtState;
function makeClub(
  prefer: (c: RatedCard) => boolean = (c) => c.tier === 'silver',
): UtState {
  setSoccerFormation('4-3-3');
  const ut = freshUt(),
    all = [...pool.base.values()],
    used = new Set<string>();
  for (const slot of slotsFor(SPORT).filter((s) => s.weight > 0)) {
    const fits = all.filter((c) => canPlay(slot, c) && !used.has(c.line.pid));
    const rc = fits.find(prefer) ?? fits[0];
    if (!rc) throw Error('Fixture position unavailable ' + slot.id);
    used.add(rc.line.pid);
    const uid = 'kept:' + slot.id;
    ut.owned.push({ uid, cardId: rc.line.id, level: 1, xp: 31, at: 1 });
    ut.squad[slot.id] = uid;
  }
  ut.owned[0].mint = {
    serial: 8,
    totalAtPull: 20,
    activeAtPull: 17,
    namespace: 'inspect',
    requestId: 'original',
  };
  ut.packs = [{ id: 'old-pack', kind: 'gold', at: 1 }];
  return ut;
}
const week = '2026-W44';
function advance(ut: UtState, won = true) {
  const a = cupOf(ut).active!;
  return settleCup(
    ut,
    { runId: a.id, round: a.round },
    {
      won,
      us: won ? 20 : 10,
      them: won ? 10 : 20,
      at: 100 + a.round,
      how: 'played',
      matchId: a.id + ':' + a.round,
    },
  );
}
beforeAll(async () => {
  pool = await getPool();
  club = makeClub();
}, 60000);
describe('own-club Cups ' + SPORT, () => {
  it('opens starter-friendly and rated-capped brackets without consuming copies or packs', () => {
    for (const kind of ['open', 'silver'] as const) {
      expect(cupEligibility(pool, club, kind, week).ok).toBe(true);
      const a = startCup(club, pool, kind, 'run-' + kind, 10, week, 'rookie');
      expect(a.owned).toBe(club.owned);
      expect(a.squad).toBe(club.squad);
      expect(a.packs).toBe(club.packs);
      expect(cupOf(a).active?.round).toBe(0);
      expect(() =>
        startCup(a, pool, kind, 'another', 11, week, 'rookie'),
      ).toThrow('current Cup');
    }
  });
  it('checks actual playing-card ratings, the NBA bench, missing positions and duplicate players', () => {
    const high = [...pool.base.values()].find(
      (c) => c.ovr > TIER_CUTS[SPORT].gold + 3,
    )!;
    const slot = slotsFor(SPORT).find((s) => s.weight > 0 && canPlay(s, high))!;
    const over = {
      ...club,
      owned: [
        ...club.owned,
        { uid: 'too-strong', cardId: high.line.id, level: 1, xp: 0, at: 1 },
      ],
      squad: { ...club.squad, [slot.id]: 'too-strong' },
    };
    expect(cupEligibility(pool, over, 'silver', week).ok).toBe(false);
    expect(cupEligibility(pool, { ...club, squad: {} }, 'open', week).ok).toBe(
      false,
    );
    if (SPORT === 'nba')
      expect(
        cupEligibility(
          pool,
          {
            ...club,
            owned: over.owned,
            squad: { ...club.squad, B1: 'too-strong' },
          },
          'silver',
          week,
        ).ok,
      ).toBe(false);
    const bad = {
      ...club,
      squad: { ...club.squad, [Object.keys(club.squad)[1]]: club.owned[0].uid },
    };
    expect(cupEligibility(pool, bad, 'open', week).ok).toBe(false);
  });
  it('keeps entered Silver cards eligible as they gain XP without resetting their real level', () => {
    const before = makeClub((c) => c.ovr === TIER_CUTS[SPORT].gold - 1);
    expect(cupEligibility(pool, before, 'silver', week).ok).toBe(true);
    const entered = startCup(
      before,
      pool,
      'silver',
      'earned-xp',
      10,
      week,
      'pro',
    );
    const upgraded = {
      ...entered,
      owned: entered.owned.map((c) => ({ ...c, level: 5 })),
    };
    expect(
      cupEligibility(pool, { ...upgraded, cup: undefined }, 'silver', week).ok,
    ).toBe(false);
    expect(cupEligibility(pool, upgraded, 'silver', week).ok).toBe(true);
    const restored = migrateUt(JSON.parse(JSON.stringify(upgraded)));
    expect(restored.owned.every((c) => c.level === 5)).toBe(true);
    expect(cupEligibility(pool, restored, 'silver', week).ok).toBe(true);
  });
  it('rotates meaningful Chemistry rules and accepts real themed rosters', () => {
    const rule = cupRule(SPORT, week, 'chemistry');
    const themed = makeClub((c) =>
      rule.type === 'franchise'
        ? c.line.fr === { nba: 'CHI', nfl: 'NE', soccer: 'BAR' }[SPORT]
        : Math.floor(c.line.season / 10) === 201,
    );
    expect(cupEligibility(pool, themed, 'chemistry', week).ok).toBe(true);
    expect(
      new Set(
        Array.from(
          { length: 16 },
          (_, i) =>
            cupRule(
              SPORT,
              '2026-W' + String(i + 30).padStart(2, '0'),
              'chemistry',
            ).type,
        ),
      ).size,
    ).toBe(2);
  });
  it('builds complete deterministic real opponents and respects chosen difficulty', () => {
    const low = startCup(club, pool, 'open', 'opponents', 10, week, 'rookie'),
      high = startCup(club, pool, 'open', 'opponents', 10, week, 'legend'),
      req = { runId: 'opponents', round: 0 };
    const a = cupOpponent(pool, low, req)!;
    expect(a).toEqual(
      cupOpponent(pool, migrateUt(JSON.parse(JSON.stringify(low))), req),
    );
    const b = cupOpponent(pool, high, req)!;
    expect(b.rung.skill).toBeGreaterThan(a.rung.skill);
    expect(b.def).toBeGreaterThan(a.def);
    expect(b.rung.target).toBeGreaterThan(a.rung.target);
    for (const slot of slotsFor(SPORT).filter((s) => s.weight > 0))
      expect(a.rung.squad.some(([id]) => id === slot.id)).toBe(true);
    expect(cupOpponent(pool, { ...low, squad: {} }, req)).toBeNull();
    expect(cupOpponent(pool, low, { ...req, round: 1 })).toBeNull();
  });
  it('rejects simulations, stale requests, replay IDs and inconsistent score claims', () => {
    const ut = startCup(club, pool, 'open', 'guard', 10, week, 'pro'),
      req = { runId: 'guard', round: 0 },
      r = {
        won: true,
        us: 20,
        them: 10,
        at: 20,
        how: 'played' as const,
        matchId: 'm',
      };
    expect(settleCup(ut, req, { ...r, how: 'sim' })).toBe(ut);
    expect(settleCup(ut, { ...req, round: 1 }, r)).toBe(ut);
    expect(settleCup(ut, req, { ...r, won: false })).toBe(ut);
    const next = settleCup(ut, req, r);
    expect(settleCup(next, req, r)).toBe(next);
    expect(validCupRequest(next, { ...req, round: 1 })).toBe(true);
    expect(settleCup(next, { ...req, round: 1 }, r)).toBe(next);
  });
  it('pays a title once, preserves receipts through reload/replay and honors the entry week at late claim', () => {
    let ut = startCup(club, pool, 'open', 'champion', 10, week, 'pro');
    for (let i = 0; i < 3; i++) ut = advance(ut);
    expect(cupOf(ut).active?.done).toBe(true);
    const r = claimCup(ut, pool, '2026-11-20', 200)!;
    expect(r.coins).toBe(CUP_PRIZES.open.coins);
    expect(r.pack).toBe('gold');
    expect(cupOf(r.ut).trophies.open).toBe(1);
    expect(
      r.ut.packs.find((p) => p.id === cupClaimId(SPORT, week, 'open')),
    ).toBeTruthy();
    expect(r.ut.owned).toEqual(club.owned);
    expect(r.ut.squad).toBe(club.squad);
    expect(claimCup(r.ut, pool, '2026-11-20', 200)).toBeNull();
    let replay = startCup(
      migrateUt(JSON.parse(JSON.stringify(r.ut))),
      pool,
      'open',
      'replay',
      210,
      week,
      'pro',
    );
    for (let i = 0; i < 3; i++) replay = advance(replay);
    const again = claimCup(replay, pool, '2026-11-21', 300)!;
    expect(again.coins).toBe(0);
    expect(again.pack).toBeNull();
    expect(cupOf(again.ut).trophies.open).toBe(1);
    expect(
      again.ut.packs.filter((p) => p.id === cupClaimId(SPORT, week, 'open')),
    ).toHaveLength(1);
    expect(again.ut.hq?.seasons).toEqual(r.ut.hq?.seasons);
  });
  it('ends on a loss, archives retirement, and retains earlier inventory/claim history', () => {
    const initial = startCup(club, pool, 'open', 'lost', 10, week, 'pro'),
      lost = advance(initial, false);
    expect(cupOf(lost).active?.done).toBe(true);
    expect(validCupRequest(lost, { runId: 'lost', round: 1 })).toBe(false);
    expect(retireCup(lost, 40)).toBe(lost);
    const r = claimCup(lost, pool, '2026-11-01', 50)!;
    expect(r.coins).toBe(0);
    expect(cupOf(r.ut).history[cupOf(r.ut).history.length - 1]?.outcome).toBe(
      'eliminated',
    );
    const next = startCup(r.ut, pool, 'silver', 'retired', 60, week, 'pro'),
      retired = retireCup(next, 70);
    expect(cupOf(retired).active).toBeUndefined();
    expect(
      cupOf(retired).history[cupOf(retired).history.length - 1]?.outcome,
    ).toBe('retired');
    expect(retired.owned).toBe(club.owned);
    expect(retired.packs).toBe(club.packs);
  });
  it('normalizes inconsistent optional state without trusting forged round/done fields or changing original saves', () => {
    expect(normalizeCup(undefined)).toBeUndefined();
    const active = startCup(club, pool, 'open', 'normalize', 10, week, 'pro')
      .cup!.active!;
    const c = normalizeCup({
      active: { ...active, round: 3, done: true },
      claims: ['not-a-cup', cupClaimId(SPORT, week, 'open')],
      trophies: { open: NaN },
    })!;
    expect(c.active?.round).toBe(0);
    expect(c.active?.done).toBe(false);
    expect(c.claims).toEqual([cupClaimId(SPORT, week, 'open')]);
    expect(c.trophies.open).toBe(0);
    const original = migrateUt(club);
    expect(original.cup).toBeUndefined();
    expect(original.owned).toEqual(club.owned);
    for (const k of CUP_KINDS)
      expect(CUP_PRIZES[k].coins).toBeLessThanOrEqual(300);
  });
});
