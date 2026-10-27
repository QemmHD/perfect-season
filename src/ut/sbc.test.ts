// Squad Building Challenges: requirement checks, the day's and week's set, rewards and auto-fill.
import { SPORT } from '../engine/sport';
import { fakeCard } from './fake.test-util';
import { getPool, type Pool } from './pool';
import { autoFill, checkReq, checkSbc, type Req, rewardCard, rewardText, type Sbc, sbcsFor, weekOf } from './sbc';

const bulls96 = (n: number, ovr = 80) => Array.from({ length: n }, (_, i) => fakeCard({ pos: ['PG', 'SG', 'SF', 'PF', 'C'][i % 5], ovr, fr: 'CHI', season: 1996 }));

describe('requirements', () => {
  it('checks every kind, with progress', () => {
    const cards = [fakeCard({ pos: 'PG', ovr: 81, fr: 'CHI', season: 1996 }), fakeCard({ pos: 'SG', ovr: 72, fr: 'CHI', season: 1991 }), fakeCard({ pos: 'C', ovr: 64, fr: 'NYK', season: 1994 })];
    const t = (r: Req) => checkReq(r, cards);
    expect(t({ k: 'minOvr', ovr: 64 })).toEqual({ ok: true, have: 'all 64+' });
    expect(t({ k: 'minOvr', ovr: 65 })).toEqual({ ok: false, have: '1 under' });
    expect(t({ k: 'teamOvr', ovr: 72 })).toEqual({ ok: true, have: '72' });
    expect(t({ k: 'teamOvr', ovr: 73 }).ok).toBe(false);
    expect(t({ k: 'tier', tier: 'silver', n: 2 })).toEqual({ ok: true, have: '2/2' });
    expect(t({ k: 'tier', tier: 'gold', n: 2 })).toEqual({ ok: false, have: '1/2' });
    expect(t({ k: 'sameFr', n: 2 }).ok).toBe(true);
    expect(t({ k: 'sameFr', n: 3 })).toEqual({ ok: false, have: '2/3' });
    expect(t({ k: 'fr', fr: 'NYK', name: 'Knicks', n: 1 }).ok).toBe(true);
    expect(t({ k: 'decade', decade: 1990, n: 3 }).ok).toBe(true);
    expect(t({ k: 'decade', decade: 1980, n: 1 }).ok).toBe(false);
    expect(t({ k: 'sameDecade', n: 3 }).ok).toBe(true);
    expect(t({ k: 'positions', pos: ['PG', 'SG', 'C'] })).toEqual({ ok: true, have: '3/3' });
    expect(t({ k: 'positions', pos: ['PG', 'PG'] })).toEqual({ ok: false, have: '1/2' });
  });

  it('matches positions to different cards (a PG/SG can only fill one)', () => {
    const combo = fakeCard({ pos: ['PG', 'SG'], ovr: 70 });
    expect(checkReq({ k: 'positions', pos: ['PG', 'SG'] }, [combo]).ok).toBe(false);
    expect(checkReq({ k: 'positions', pos: ['PG', 'SG'] }, [combo, fakeCard({ pos: 'SG', ovr: 70 })]).ok).toBe(true);
    // the scarce position goes first, so the flexible card covers the other
    expect(checkReq({ k: 'positions', pos: ['SG', 'PG'] }, [combo, fakeCard({ pos: 'SG', ovr: 70 })]).ok).toBe(true);
  });

  it('finds the full five among two-position cards whatever order they came in', () => {
    const five = [['SF', 'PF'], ['PF', 'SG'], ['PG', 'PF'], ['C', 'SF'], ['SF']].map((pos) => fakeCard({ pos, ovr: 70 }));
    const all = ['PG', 'SG', 'SF', 'PF', 'C'];
    for (let k = 0; k < five.length; k++) {
      const order = five.slice(k).concat(five.slice(0, k));
      expect(checkReq({ k: 'positions', pos: all }, order)).toEqual({ ok: true, have: '5/5' });
      expect(checkReq({ k: 'positions', pos: all }, order.slice().reverse())).toEqual({ ok: true, have: '5/5' });
    }
  });

  it('needs exactly the right number of different players', () => {
    const s: Sbc = { id: 't', kind: 'daily', title: 'T', blurb: '', size: 3, reqs: [{ k: 'sameFr', n: 3 }], reward: { coins: 100 } };
    expect(checkSbc(s, bulls96(3)).ok).toBe(true);
    expect(checkSbc(s, bulls96(2)).ok).toBe(false);
    expect(checkSbc(s, bulls96(4)).full).toBe(false);
    const twice = bulls96(2);
    const same = { ...twice[0], line: { ...twice[0].line, id: 'other-season' } };
    expect(checkSbc(s, [...twice, same]).ok).toBe(false);
  });
});

describe('the day’s challenges (' + SPORT + ')', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = await getPool();
  });

  it('are three daily and two weekly, the same for everyone on a day', () => {
    const a = sbcsFor(pool, '2026-10-27');
    expect(a.filter((s) => s.kind === 'daily')).toHaveLength(3);
    expect(a.filter((s) => s.kind === 'weekly')).toHaveLength(2);
    expect(sbcsFor(pool, '2026-10-27')).toEqual(a);
    expect(new Set(a.map((s) => s.id)).size).toBe(5);
    // the weekly ones hold all week; the daily ones change
    const b = sbcsFor(pool, '2026-10-28');
    expect(b.filter((s) => s.kind === 'weekly')).toEqual(a.filter((s) => s.kind === 'weekly'));
    const days = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'].map((d) => sbcsFor(pool, d).filter((s) => s.kind === 'daily').map((s) => s.title).join('|'));
    expect(new Set(days).size).toBeGreaterThan(1);
    expect(weekOf('2026-10-27')).toBe('2026-W44');
    expect(weekOf('2026-11-02')).toBe('2026-W45');
  });

  it('every challenge can be met by some cards in the pool, and pays something', () => {
    const all = Array.from(pool.base.values());
    const club = all.filter((_, i) => i % 3 === 0).map((rc, i) => ({ uid: 'u' + i, rc, slot: null }));
    let filled = 0;
    let n = 0;
    for (let d = 1; d <= 28; d++) {
      const day = '2026-11-' + String(d).padStart(2, '0');
      for (const s of sbcsFor(pool, day)) {
        n++;
        expect(rewardText(s.reward, SPORT, () => 'Pack').length).toBeGreaterThan(0);
        const got = autoFill(s, club);
        if (got) {
          filled++;
          const cards = got.map((u) => club.find((c) => c.uid === u)!.rc);
          expect(checkSbc(s, cards).ok).toBe(true);
        }
      }
    }
    // a big club meets nearly all of them
    expect(filled / n).toBeGreaterThan(0.95);
  });

  it('auto-fills with the cheapest cards and leaves the squad alone when it can', () => {
    const s: Sbc = { id: 'x', kind: 'daily', title: 'X', blurb: '', size: 3, reqs: [{ k: 'sameFr', n: 3 }], reward: { coins: 1 } };
    const club = [...bulls96(3, 90).map((rc, i) => ({ uid: 'star' + i, rc, slot: 'S' + i })), ...bulls96(4, 60).map((rc, i) => ({ uid: 'bench' + i, rc, slot: null }))];
    const got = autoFill(s, club)!;
    expect(got).toHaveLength(3);
    expect(got.every((u) => u.startsWith('bench'))).toBe(true);
    expect(autoFill({ ...s, reqs: [{ k: 'sameFr', n: 3 }, { k: 'minOvr', ovr: 95 }] }, club)).toBeNull();
  });

  it('pays the same reward card every time for a challenge', () => {
    const want = { tier: 'gold' as const, minOvr: 80 };
    const a = rewardCard(pool, want, 'd:2026-10-27:2');
    expect(a).not.toBeNull();
    expect(a!.ovr).toBeGreaterThanOrEqual(80);
    expect(rewardCard(pool, want, 'd:2026-10-27:2')!.line.id).toBe(a!.line.id);
    const promo = rewardCard(pool, { tier: 'promo' }, 'w');
    expect(promo?.tier).toBe('promo');
  });
});
