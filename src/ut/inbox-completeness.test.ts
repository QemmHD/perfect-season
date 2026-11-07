// Codex (OpenAI): mixed real-pool claims, canonical receipts and save-preserving repeat protection.
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { getPool, type Pool } from './pool';
import { claimAll, inboxCount, inboxItems } from './inbox';
import { claimRivals, DIVISIONS, rivalsOf } from './rivals';
import { momentsFor } from './moments';
import { freshHQ } from './hq-state';
import { freshCup } from './cup-state';
import { cupClaimId, CUP_PRIZES } from './cup';
import { freshUt, migrateUt } from './state';
import { seasonFor } from './progression';

const DAY = '2026-11-07',
  WEEK = '2026-W45',
  OLD_WEEK = '2026-W44';
let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);
function fixture() {
  const cards = [...pool.base.values()];
  const mint = {
    serial: 8,
    totalAtPull: 20,
    activeAtPull: 18,
    requestId: 'retained-request',
    namespace: 'inspect',
  };
  const ut = freshUt();
  ut.owned = [
    { uid: 'trained', cardId: cards[0].line.id, level: 1, xp: 0, at: 1, mint },
    {
      uid: 'retained',
      cardId: cards[1].line.id,
      level: 3,
      xp: 42,
      at: 2,
      mint: { ...mint, serial: 9 },
    },
  ];
  ut.squad = { PG: 'retained' };
  ut.collected = pool.lines.slice(0, 30).map((c) => c.id);
  const h = freshHQ();
  if (SPORT !== 'soccer') {
    const m = momentsFor(SPORT)[0];
    h.moments[m.id] = { best: m.target, completedAt: 10 };
  }
  h.development.active = {
    uid: 'trained',
    path: 'breakout',
    games: 3,
    wins: 1,
    points: 0,
    at: 1,
  };
  ut.hq = h;
  ut.rivals = {
    ...rivalsOf(undefined, WEEK),
    rewards: [
      {
        id: OLD_WEEK + ':1',
        week: OLD_WEEK,
        division: 1,
        pack: 'goat',
        coins: 999999,
      },
    ],
  };
  ut.cup = {
    ...freshCup(),
    active: {
      id: 'saved-cup',
      kind: 'open',
      week: OLD_WEEK,
      sport: SPORT,
      level: 'rookie',
      anchor: 75,
      at: 1,
      round: 3,
      results: [0, 1, 2].map((n) => ({
        id: 'cup-match-' + n,
        won: true,
        us: 3,
        them: 0,
        at: n + 2,
      })),
      done: true,
    },
  };
  return {
    coins: 1234,
    gifts: ['old-receipt'],
    ut,
    settings: { sound: false },
    identityMarker: 'must-survive',
  };
}
describe('complete rewards inbox ' + SPORT, () => {
  it('finds earned collection/Rivals/development/Cup rewards and supported Moments', () => {
    const p = fixture(),
      ids = inboxItems(pool, p, DAY, WEEK)
        .filter((i) => i.claimable)
        .map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining(['collection', 'rivals', 'development', 'cup']),
    );
    expect(ids.includes('moments')).toBe(SPORT !== 'soccer');
  });
  it('claims every source, includes newly unlocked Season tiers, and preserves unrelated copies and identity', () => {
    const p = fixture(),
      untouched = structuredClone(p.ut.owned[1]),
      beforeMint = structuredClone(p.ut.owned[0].mint);
    const r = claimAll(pool, p, DAY, WEEK, 100),
      u = r.profile.ut;
    expect(r.profile.coins).toBeGreaterThan(p.coins + CUP_PRIZES.open.coins);
    expect(r.profile.identityMarker).toBe(p.identityMarker);
    expect(r.profile.settings).toBe(p.settings);
    expect(r.profile.gifts).toEqual(p.gifts);
    expect(u.owned.find((c) => c.uid === 'retained')).toEqual(untouched);
    expect(u.owned.find((c) => c.uid === 'trained')?.mint).toEqual(beforeMint);
    expect(u.squad).toBe(p.ut.squad);
    expect(u.hq?.development.active).toBeUndefined();
    expect(u.hq?.development.completed.trained.path).toBe('breakout');
    expect(u.rivals?.claimed).toContain(OLD_WEEK + ':1');
    const rivalPack = u.packs.find(
      (c) => c.id === 'rivals:' + SPORT + ':' + OLD_WEEK + ':1',
    );
    expect(rivalPack?.kind).toBe(DIVISIONS[1].pack);
    expect(rivalPack?.kind).not.toBe('goat');
    expect(u.cup?.claims).toContain(cupClaimId(SPORT, OLD_WEEK, 'open'));
    expect(u.cup?.active).toBeUndefined();
    expect(u.cup?.trophies.open).toBe(1);
    expect(u.collectionClaims).toContain('editions:25');
    if (SPORT !== 'soccer')
      expect(u.hq?.moments[momentsFor(SPORT)[0].id].claimed).toBe(true);
    expect(u.hq?.seasons[seasonFor(DAY).id].claimed.length).toBeGreaterThan(0);
    expect(inboxCount(pool, r.profile, DAY, WEEK)).toBe(0);
    const reloaded = {
      ...r.profile,
      ut: migrateUt(JSON.parse(JSON.stringify(u))),
    };
    const again = claimAll(pool, reloaded, DAY, WEEK, 200);
    expect(again.claimed).toBe(0);
    expect(again.coins).toBe(0);
    expect(again.profile).toBe(reloaded);
    expect(again.profile.ut.packs).toEqual(reloaded.ut.packs);
    expect(again.profile.ut.collectionClaims).toEqual(
      reloaded.ut.collectionClaims,
    );
  });
  it('does not promise or silently archive a reward for an eliminated or already rewarded Cup', () => {
    const p = fixture();
    p.ut.cup!.active!.results = [
      { id: 'lost', won: false, us: 0, them: 3, at: 2 },
    ];
    p.ut.cup!.active!.round = 1;
    let items = inboxItems(pool, p, DAY, WEEK);
    expect(items.find((i) => i.id === 'cup')).toBeUndefined();
    expect(items.find((i) => i.id === 'cup-result')).toMatchObject({
      claimable: false,
      view: 'cup',
    });
    const r = claimAll(pool, p, DAY, WEEK, 100);
    expect(r.profile.ut.cup?.active?.id).toBe('saved-cup');
    const champion = fixture();
    champion.ut.cup!.claims = [cupClaimId(SPORT, OLD_WEEK, 'open')];
    items = inboxItems(pool, champion, DAY, WEEK);
    expect(items.find((i) => i.id === 'cup')).toBeUndefined();
    expect(items.find((i) => i.id === 'cup-result')?.view).toBe('cup');
  });
  it('uses the same canonical Rivals claim after weekly rollover and never grants it twice', () => {
    const p = fixture(),
      id = OLD_WEEK + ':1';
    const r = claimRivals(p.ut, SPORT, WEEK, id, 100);
    expect(r.coins).toBe(DIVISIONS[1].coins);
    expect(r.pack).toBe(DIVISIONS[1].pack);
    expect(r.ut.owned).toBe(p.ut.owned);
    const reloaded = migrateUt(JSON.parse(JSON.stringify(r.ut))),
      repeat = claimRivals(reloaded, SPORT, WEEK, id, 200);
    expect(repeat).toEqual({ ut: reloaded, coins: 0, pack: null });
  });
});
