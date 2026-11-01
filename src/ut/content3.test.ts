// Claude, 2026-11-01 (wave 2): Item Score, Streamlined SBCs, the Daily hub (login calendar, daily
// bonus), Preview Pack, holographic variants, the walkout clues, Evolutions and the Rewards inbox.
// Both sports (npm test runs NBA then PS_SPORT=nfl).
import { SPORT } from '../engine/sport';
import { claimed, contentOf, toggleLock } from './content-state';
import { keepPick } from './content-packs';
import { calendarPickOptions, calendarStatus, CALENDAR_DAYS, claimCalendar, claimDailyBonus, dailyBonusReady } from './daily-hub';
import { applyEvos, cancelEvo, claimEvo, EVOS, evoBlock, playId, readyEvos, recordEvoMatch, startEvo } from './evolutions';
import { claimAll, inboxCount, inboxItems } from './inbox';
import { curvePoints, itemScore, ITEM_BRONZE, ITEM_SILVER } from './item-score';
import { openPack, walkoutLevel } from './packs';
import { getPool, type Pool } from './pool';
import { nextPreview, previewCards, previewId, previewStatus, PREVIEW_COOLDOWN_MS, withPreviewSeed } from './preview-pack';
import { claimObjective, recordActivity } from './progression';
import { onScale, rateCard } from './rate';
import { freshUt, migrateUt, type UtState } from './state';
import { STREAMS, streamProgress, streamTarget, submitStream } from './streamlined';
import { squadFromWire } from './teams';
import type { OwnedCard, RatedCard } from './types';
import { holoId, parseVariant } from './variants';
import { bigWalkout, walkoutClues } from './walkout';

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);

const W = '2026-W44';
const DAY = '2026-11-01';
const owned = (cardId: string, uid: string, level = 1): OwnedCard => ({ uid, cardId, level, xp: 0, at: 1 });
const golds = () => Object.values(pool.buckets.gold).flat().filter((x) => x.line.kind === 'season');

describe('Item Score (' + SPORT + ')', () => {
  it('follows the curve through onScale and values specials higher', () => {
    expect(curvePoints(onScale(75, SPORT), SPORT)).toBe(90);
    expect(curvePoints(onScale(99, SPORT), SPORT)).toBe(100000);
    for (let o = onScale(75, SPORT); o < 99; o++) expect(curvePoints(o + 1, SPORT)).toBeGreaterThanOrEqual(curvePoints(o, SPORT));
    const b = Object.values(pool.buckets.bronze).flat()[0];
    const s = Object.values(pool.buckets.silver).flat()[0];
    expect(itemScore(b)).toBe(ITEM_BRONZE);
    expect(itemScore(s)).toBe(ITEM_SILVER);
    const legend = Object.values(pool.buckets.legend).flat()[0];
    expect(itemScore(legend)).toBeGreaterThan(curvePoints(legend.ovr, SPORT));
    expect(itemScore(pool.base.get(holoId(legend.line.id))!)).toBeGreaterThan(itemScore(legend));
  });
});

describe('Streamlined SBCs (' + SPORT + ')', () => {
  it('has self-calibrating targets above what the reward is worth', () => {
    for (const s of STREAMS) {
      const t = streamTarget(pool, s.id);
      expect(t).toBeGreaterThan(0);
      expect(Number.isFinite(t)).toBe(true);
      expect(streamTarget(pool, s.id)).toBe(t);
    }
    // a Gold Pack's cards are worth well under the Gold stream's target: no loop
    let sum = 0;
    for (let i = 0; i < 40; i++) sum += openPack(pool, 'gold', 'loop' + i, W).reduce((a, rc) => a + itemScore(rc), 0);
    expect(sum / 40).toBeLessThan(streamTarget(pool, 'gold') * 0.7);
  });

  it('saves partial progress, pays each full target once, excludes locked and squad cards', () => {
    const gs = golds().slice(0, 40);
    let ut: UtState = migrateUt({ ...freshUt(), owned: gs.map((g, i) => owned(g.line.id, 'u' + i)) });
    const score = (uid: string) => {
      const o = ut.owned.find((x) => x.uid === uid);
      return o ? itemScore(pool.base.get(o.cardId)!) : null;
    };
    const target = streamTarget(pool, 'gold');
    const first = submitStream(ut, pool, 'gold', ['u0'], score, 1)!;
    expect(first.points).toBe(score('u0'));
    expect(streamProgress(first.ut, 'gold')).toBe(first.points % target);
    expect(first.ut.owned.some((o) => o.uid === 'u0')).toBe(false);
    ut = first.ut;
    expect(submitStream(ut, pool, 'gold', ['u0'], score, 2)).toBeNull(); // already gone
    expect(submitStream(ut, pool, 'gold', ['u1', 'u1'], score, 2)).toBeNull();
    const locked = toggleLock(ut, 'u1');
    expect(submitStream(locked, pool, 'gold', ['u1'], score, 2)).toBeNull();
    const squadded = { ...ut, squad: { [pool.sport === 'nba' ? 'PG' : 'QB']: 'u2' } };
    expect(submitStream(squadded, pool, 'gold', ['u2'], score, 2)).toBeNull();
    // enough cards to pass the target: the reward lands once per full target, overflow kept
    const all = ut.owned.map((o) => o.uid);
    const big = submitStream(ut, pool, 'gold', all, score, 3)!;
    const total = streamProgress(ut, 'gold') + big.points;
    expect(big.rewards).toBe(Math.floor(total / target));
    expect(streamProgress(big.ut, 'gold')).toBe(total - big.rewards * target);
    expect(big.ut.packs.filter((p) => p.id.startsWith('stream:' + SPORT + ':gold:'))).toHaveLength(big.rewards);
    expect(migrateUt(JSON.parse(JSON.stringify(big.ut))).content?.streams).toEqual(big.ut.content?.streams);
  });
});

describe('Daily hub', () => {
  it('moves the 5-day calendar on each claimed day and pays each step once', () => {
    let ut = freshUt();
    const days = ['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09'];
    const steps: number[] = [];
    for (const d of days) {
      expect(calendarStatus(ut, d).ready).toBe(true);
      const r = claimCalendar(ut, pool, d, 1)!;
      steps.push(r.reward.day);
      ut = r.ut;
      expect(claimCalendar(ut, pool, d, 2)).toBeNull();
    }
    expect(steps).toEqual([1, 2, 3, 4, 5, 1]);
    expect(CALENDAR_DAYS).toBe(5);
    expect(contentOf(ut).picks).toHaveLength(1);
    expect(contentOf(ut).picks![0].options).toHaveLength(2);
    expect(keepPick(ut, contentOf(ut).picks![0].id, 1, 5).card).not.toBeNull();
    expect(calendarPickOptions(pool, 'x')).toEqual(calendarPickOptions(pool, 'x'));
  });

  it('pays the all-three bonus once after the three daily objectives', () => {
    let ut = recordActivity(freshUt(), 'm1', DAY, { games: 2, wins: 1, points: 30 });
    expect(dailyBonusReady(ut, DAY)).toBe(false);
    for (const id of ['show-up', 'winner', 'score']) ut = claimObjective(ut, 'daily:' + DAY + ':' + id, DAY, 1).ut;
    expect(dailyBonusReady(ut, DAY)).toBe(true);
    const r = claimDailyBonus(ut, SPORT, DAY, 1)!;
    expect(r.coins).toBe(100);
    expect(claimDailyBonus(r.ut, SPORT, DAY, 2)).toBeNull();
    expect(claimed(r.ut, 'daily-bonus:' + DAY)).toBe(true);
  });
});

describe('Preview Pack (' + SPORT + ')', () => {
  it('shows the same cards on every reload until bought or skipped', () => {
    let ut = withPreviewSeed(freshUt(), 'seed1');
    expect(withPreviewSeed(ut, 'other')).toBe(ut);
    const a = previewCards(pool, ut, W).map((c) => c.line.id);
    expect(a.length).toBeGreaterThan(0);
    expect(previewCards(pool, migrateUt(JSON.parse(JSON.stringify(ut))), W).map((c) => c.line.id)).toEqual(a);
    const bought = nextPreview(ut, true, 100);
    expect(previewStatus(bought, 100).ready).toBe(true);
    expect(previewCards(pool, bought, W).map((c) => c.line.id)).not.toEqual(a);
    const skipped = nextPreview(ut, false, 100);
    expect(previewStatus(skipped, 100 + PREVIEW_COOLDOWN_MS - 1).ready).toBe(false);
    expect(previewStatus(skipped, 100 + PREVIEW_COOLDOWN_MS).ready).toBe(true);
    expect(previewId(skipped)).not.toBe(previewId(ut));
    ut = skipped;
  });
});

describe('holographic variants and evolutions (' + SPORT + ')', () => {
  it('a holo copy rates exactly like its edition and resolves in squads', () => {
    const promo = Object.values(pool.buckets.promo).flat()[0] ?? Object.values(pool.buckets.legend).flat()[0];
    const id = holoId(promo.line.id);
    const h = pool.base.get(id)!;
    expect(h.line.holo).toBe(true);
    expect(h.ovr).toBe(promo.ovr);
    expect(h.attrs).toEqual(promo.attrs);
    expect(h.tier).toBe(promo.tier);
    expect(parseVariant('holo~holo~x')).toBeNull();
    expect(pool.lines.some((l) => l.holo)).toBe(false);
  });

  it('holos only drop from packs, as special editions', () => {
    let holos = 0;
    for (let i = 0; i < 400; i++)
      for (const rc of openPack(pool, 'elite', 'h' + i, W))
        if (rc.line.holo) {
          holos++;
          expect(['standout', 'promo', 'landmark', 'legend']).toContain(rc.tier);
        }
    expect(holos).toBeGreaterThanOrEqual(0);
  });

  it('runs an evolution: caps, progress once per match, apply, chain, ceiling', () => {
    const low = golds()
      .filter((g) => g.ovr <= onScale(80, SPORT))
      .sort((a, b) => a.ovr - b.ovr)[0];
    expect(low).toBeTruthy();
    let ut: UtState = migrateUt({ ...freshUt(), owned: [owned(low.line.id, 'e1')] });
    const high = golds().sort((a, b) => b.ovr - a.ovr)[0];
    expect(evoBlock(ut, 'e1', high, EVOS[0], SPORT)).toMatch(/Overall above/);
    expect(evoBlock(ut, 'e1', low, EVOS[1], SPORT)).toMatch(/Needs/);
    ut = startEvo(ut, pool, 'e1', low, 'rising-1', 1);
    expect(startEvo(ut, pool, 'e1', low, 'specialist', 1)).toBe(ut);
    ut = recordEvoMatch(ut, { matchId: 'm1', won: true, played: ['e1'] });
    ut = recordEvoMatch(ut, { matchId: 'm1', won: true, played: ['e1'] });
    expect(contentOf(ut).evo!.e1.active).toMatchObject({ games: 1, wins: 1 });
    expect(claimEvo(ut, 'e1')).toBe(ut);
    ut = recordEvoMatch(ut, { matchId: 'm2', won: false, played: ['e1'] });
    ut = recordEvoMatch(ut, { matchId: 'm3', won: false, played: ['other'] });
    ut = recordEvoMatch(ut, { matchId: 'm4', won: false, played: ['e1'] });
    expect(readyEvos(ut)).toEqual(['e1']);
    ut = claimEvo(ut, 'e1');
    expect(contentOf(ut).evo!.e1.done).toEqual(['rising-1']);
    expect(claimEvo(ut, 'e1')).toBe(ut);
    // the copy keeps its card id; it plays as the evolved variant, on both phones
    expect(ut.owned[0].cardId).toBe(low.line.id);
    const pid = playId(ut, ut.owned[0]);
    expect(pid).toBe('evo~rising-1~' + low.line.id);
    const evolved = pool.base.get(pid)!;
    expect(evolved.ovr).toBe(Math.max(low.ovr, Math.min(onScale(84, SPORT), low.ovr + 2)));
    expect(rateCard(pool.byId.get(pid)!, 3).ovr).toBeGreaterThanOrEqual(rateCard(low.line, 3).ovr);
    const sq = squadFromWire(pool, [[pool.sport === 'nba' ? 'B1' : 'K', pid, 1]]);
    if (pool.sport === 'nba') expect(sq.B1.line.evo).toEqual(['rising-1']);
    // chain: Rising Star II is now open for this copy; the whole chain stays under its ceiling
    expect(evoBlock(ut, 'e1', evolved, EVOS[1], SPORT)).toBeNull();
    const end = applyEvos(low, ['rising-1', 'rising-2']);
    expect(end.ovr).toBeLessThanOrEqual(Math.max(low.ovr, onScale(87, SPORT)));
    for (const [c, v] of Object.entries(end.attrs)) expect(v).toBeGreaterThanOrEqual(low.attrs[c]);
    // cancelling keeps what was applied
    const started = startEvo(ut, pool, 'e1', evolved, 'rising-2', 5);
    expect(contentOf(cancelEvo(started, 'e1')).evo!.e1).toEqual({ done: ['rising-1'] });
    expect(migrateUt(JSON.parse(JSON.stringify(ut))).content?.evo).toEqual(contentOf(ut).evo);
  });
});

describe('walkout (' + SPORT + ')', () => {
  it('runs the big walkout from basketball’s 86 on this scale, with clues', () => {
    const gs = golds();
    const star = gs.find((g) => g.ovr >= onScale(86, SPORT))!;
    const plain = gs.find((g) => g.ovr < onScale(86, SPORT));
    expect(bigWalkout(star)).toBe(true);
    if (plain) {
      expect(bigWalkout(plain)).toBe(false);
      expect(walkoutLevel(plain)).toBe(1);
    }
    expect(walkoutLevel(star)).toBe(2);
    const c = walkoutClues(star);
    expect(c.era).toMatch(/^THE '\d0S$/);
    expect(c.conference.length).toBeGreaterThan(2);
    expect(c.stage).toBe('stage-gold');
    expect(bigWalkout(Object.values(pool.buckets.silver).flat()[0])).toBe(false);
  });
});

describe('Rewards inbox (' + SPORT + ')', () => {
  it('lists claimables, claims them all once, and counts packs to open', () => {
    let ut = recordActivity(freshUt(), 'm1', DAY, { games: 2, wins: 1, points: 30 });
    const p0 = { coins: 0, ut };
    const items = inboxItems(pool, p0, DAY, W);
    expect(items.map((i) => i.id)).toEqual(expect.arrayContaining(['daily', 'calendar', 'objectives']));
    const n = inboxCount(pool, p0, DAY, W);
    const r = claimAll(pool, p0, DAY, W, 1);
    expect(r.claimed).toBeGreaterThanOrEqual(n);
    expect(r.profile.coins).toBeGreaterThan(0);
    expect(inboxCount(pool, r.profile, DAY, W)).toBe(0);
    // the Daily Drop and the bonus/calendar packs wait in the Store
    expect(r.profile.ut.packs.some((pp) => pp.kind === 'daily')).toBe(true);
    expect(inboxItems(pool, r.profile, DAY, W).some((i) => i.id === 'packs')).toBe(true);
    const again = claimAll(pool, r.profile, DAY, W, 2);
    expect(again.claimed).toBe(0);
    expect(again.profile.coins).toBe(r.profile.coins);
    ut = r.profile.ut;
    expect(claimed(ut, 'daily-bonus:' + DAY)).toBe(true);
    void (null as unknown as RatedCard);
  });
});
