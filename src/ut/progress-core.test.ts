// Claude, 2026-11-16 (studio overhaul, team ut-1): the small pieces of the progress core: seen state,
// the studio stamps, GO targets (every one a real screen of this sport) and the additive hq fields
// (old saves load unchanged; a stripped cache or seen map is harmless). Runs in soccer through
// soccer-claimables.test.ts.
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { utClaimables } from './claimables';
import { goForCards, goForCounter, goForObjective, openUtAt } from './go';
import { COUNTERS, freshHQ, normalizeHQ } from './hq-state';
import { viewInfo } from './nav';
import { objectiveDeck } from './objectives';
import { utReturnView } from './return-view';
import { isUnseen, markSeen, showDot } from './seen';
import { freshUt, migrateUt } from './state';
import { ensureStudio, playerKey, studioSince } from './stamps';

const DAY = '2026-11-16';
const bytes = (fill: number) => (n: number) => new Uint8Array(n).fill(fill);

describe('seen state (hq.seen)', () => {
  it('a dot shows only for something unseen that can be acted on, and clears once seen', () => {
    let ut = freshUt();
    expect(showDot(ut, 'store:wave', 'w1', true)).toBe(true);
    expect(showDot(ut, 'store:wave', 'w1', false)).toBe(false);
    ut = markSeen(ut, 'store:wave', 'w1');
    expect(isUnseen(ut, 'store:wave', 'w1')).toBe(false);
    expect(showDot(ut, 'store:wave', 'w2', true)).toBe(true);
    expect(markSeen(ut, 'store:wave', 'w1')).toBe(ut);
  });
  it('keeps at most 64 keys, newest last, and survives normalization', () => {
    let ut = freshUt();
    for (let i = 0; i < 70; i++) ut = markSeen(ut, 'live:' + i, 't' + i);
    const seen = ut.hq!.seen!;
    expect(Object.keys(seen)).toHaveLength(64);
    expect(seen['live:69']).toBe('t69');
    expect(seen['live:0']).toBeUndefined();
    expect(normalizeHQ(JSON.parse(JSON.stringify(ut.hq)), []).seen).toEqual(seen);
    expect(markSeen(freshUt(), 'x'.repeat(81), 't')).toEqual(freshUt());
  });
});

describe('studio stamps', () => {
  it('writes studio:since and a 12-character key once, and never moves them', () => {
    const a = ensureStudio(freshUt(), DAY, bytes(7));
    expect(studioSince(a)).toBe(DAY);
    expect(playerKey(a)).toMatch(/^[0-9a-z]{12}$/);
    const b = ensureStudio(a, '2026-12-01', bytes(9));
    expect(b).toBe(a);
    expect(ensureStudio(freshUt(), 'not a day')).toEqual(freshUt());
  });
  it('lives in hq.claims, so the old client and a reload keep it, and objectives ignore it', () => {
    const a = ensureStudio(freshUt(), DAY, bytes(3));
    const reloaded = migrateUt(JSON.parse(JSON.stringify(a)));
    expect(studioSince(reloaded)).toBe(DAY);
    expect(playerKey(reloaded)).toBe(playerKey(a));
    expect(objectiveDeck(reloaded, DAY)).toEqual(objectiveDeck(freshUt(), DAY));
  });
  it('two phones racing keep the earliest day', () => {
    const a = ensureStudio(freshUt(), DAY, bytes(1));
    const merged = { ...a, hq: { ...a.hq!, claims: [...a.hq!.claims, 'studio:since:2026-11-14'] } };
    expect(studioSince(merged)).toBe('2026-11-14');
  });
});

describe('GO targets (' + SPORT + ')', () => {
  it('every counter leads to a real screen of this sport, never a dead end', () => {
    const hidden = SPORT === 'soccer' ? ['league', 'events', 'moments'] : [];
    for (const c of [...COUNTERS, 'collect' as const]) {
      const g = goForCounter(c, SPORT);
      expect(viewInfo(g.view).title, c).toBeTruthy();
      expect(hidden).not.toContain(g.view);
      expect(g.label.length).toBeLessThanOrEqual(8);
    }
  });
  it('packs: OPEN the packs you have, else the Store with its odds', () => {
    const ut = freshUt();
    expect(goForCounter('packs', SPORT, ut)).toEqual({ view: 'store', label: 'STORE', odds: true });
    ut.packs = [{ id: 'p', kind: 'gold', at: 1 }];
    expect(goForCounter('packs', SPORT, ut)).toEqual({ view: 'store', label: 'OPEN' });
  });
  it('the ethics rule: SBC, then the Scout Market, then a pick, the Store last and with odds', () => {
    expect(goForCards({ sbc: true, market: true, pick: true }).view).toBe('sbc');
    expect(goForCards({ market: true, pick: true }).label).toBe('MARKET');
    expect(goForCards({ pick: true }).label).toBe('PICK');
    expect(goForCards({})).toEqual({ view: 'store', label: 'STORE', odds: true });
  });
  it('a complete or claimed objective has no GO (it shows CLAIM / CLAIMED)', () => {
    const ut = freshUt();
    ut.hq = freshHQ();
    ut.hq.days[DAY] = { ...ut.hq.days[DAY], games: 2, wins: 0, points: 0, onlineWins: 0, packs: 0, sbcs: 0, moments: 0, development: 0 };
    const deck = objectiveDeck(ut, DAY);
    expect(goForObjective(deck.find((o) => o.id.endsWith(':show-up'))!, SPORT)).toBeNull();
    expect(goForObjective(deck.find((o) => o.id.endsWith(':winner'))!, SPORT)).toEqual({ view: 'battles', label: 'PLAY' });
  });
  it('openUtAt remembers the view UT opens on', () => {
    let opened = false;
    openUtAt('objectives', () => (opened = true));
    expect(opened).toBe(true);
    expect(utReturnView()).toBe('objectives');
    openUtAt('hub', () => {});
  });
});

describe('additive hq fields', () => {
  it('a well-formed cache survives normalization; a malformed one is dropped', () => {
    const h = { ...freshHQ(), poolClaimables: { sig: 'nba1.a.b:0.0.0:0.0.0.0', n: 2 } };
    expect(normalizeHQ(JSON.parse(JSON.stringify(h)), []).poolClaimables).toEqual(h.poolClaimables);
    expect(normalizeHQ({ ...h, poolClaimables: { sig: 'x'.repeat(81), n: 2 } }, []).poolClaimables).toBeUndefined();
    expect(normalizeHQ({ ...h, poolClaimables: { sig: 's', n: 5000 } }, []).poolClaimables).toEqual({ sig: 's', n: 999 });
  });
  it('an old save (no cache, no seen) normalizes to the same hq as before, with no new keys', () => {
    const old = normalizeHQ({ ...freshHQ(), claims: ['daily:2026-11-10:show-up'] }, []);
    expect('poolClaimables' in old).toBe(false);
    expect('seen' in old).toBe(false);
  });
  it('losing the cache (an old client strips it) only makes the light count approximate', () => {
    const ut = freshUt();
    const c = utClaimables(ut, DAY, '2026-W47', SPORT, Date.parse(DAY + 'T17:00:00Z'));
    expect(c.approx).toBe(true);
    expect(c.count).toBe(2); // the Daily Drop and the login calendar
  });
});
