import { CELLS, CELL_BY_ID } from '../engine/data';
import { assignSlots, dailyOrder, type DraftState, draftReducer, newDraft, openSlots } from '../engine/draft';
import { advance, dayBefore, missionsFor, nextStreak, rewardFor } from '../engine/missions';
import { bestPickFor, onlineOrder, redrawCell } from '../engine/online';
import { rarityOf } from '../engine/rarity';
import { rateTeam } from '../engine/rating';
import { type Player, type Slot, SLOTS } from '../engine/types';
import { nameProblem } from '../lib/names';
import type { RunRecord } from '../lib/profile';
import { boardTag, compareRuns, type LbState, prune, readEntry, rebuildLineup, renamed, weekKey, withH2H, withRun } from './leaderboard';
import { cleanRoomCode, NET_V } from './match';
import { KIND_APP, sign } from './nostr';
import { NFL } from '../engine/sport';

/** A legal lineup from the data: the five best players at each position across a few cells. */
function realLineup(cellIds?: string[]): { s: Slot; id: string }[] {
  const out: { s: Slot; id: string }[] = [];
  const pids = new Set<string>();
  const pool = (cellIds ?? CELLS.slice(0, 40).map((c) => c.id)).flatMap((id) => CELL_BY_ID[id].players).sort((a, b) => b.val - a.val);
  for (const s of SLOTS) {
    const p = pool.find((x) => x.pos.includes(s) && !pids.has(x.pid))!;
    pids.add(p.pid);
    out.push({ s, id: p.id });
  }
  return out;
}

function entry(content: object, d = 'x') {
  return sign(KIND_APP, [['d', d]], JSON.stringify(content));
}

function record(over: Partial<RunRecord>, ids = realLineup()): RunRecord {
  const players = rebuildLineup(ids, null)!;
  const r = rateTeam(players);
  return { id: 'r', at: new Date().toISOString(), mode: 'classic', wins: r.wins, rating: r.rating, grade: 'A', tier: 't', playoff: '', series: 0, title: false, perfect: false, lineup: [], ids, ...over };
}

describe.skipIf(NFL)('leaderboard entries', () => {
  it('names weeks the ISO way, in Eastern dates', () => {
    expect(weekKey('2026-10-24')).toBe('2026-W43');
    expect(weekKey('2026-10-26')).toBe('2026-W44');
    expect(weekKey('2027-01-01')).toBe('2026-W53');
    expect(weekKey('2027-01-04')).toBe('2027-W01');
    expect(weekKey('2024-12-30')).toBe('2025-W01');
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
  });

  it('accepts a real lineup and ranks it by the record it actually earns', () => {
    const ids = realLineup();
    const players = rebuildLineup(ids, null)!;
    const r = rateTeam(players);
    const ok = readEntry(entry({ v: 1, name: 'Steph', wins: r.wins, series: r.wins >= 50 ? 2 : 0, title: false, perfect: false, rating: 1, lineup: ids }), 'classic', '2026-10-24');
    expect(ok?.run?.wins).toBe(r.wins);
    expect(ok?.name).toBe('Steph');
    expect(ok?.run?.lineup.map((x) => x.slot)).toEqual(SLOTS);
  });

  it('rejects made-up records, impossible lineups and broken entries', () => {
    const ids = realLineup();
    const r = rateTeam(rebuildLineup(ids, null)!);
    const base = { v: 1, name: 'Cheat', wins: r.wins, series: 0, title: false, perfect: false, rating: 1, lineup: ids };
    const day = '2026-10-24';
    expect(readEntry(entry({ ...base, wins: r.wins === 82 ? 81 : r.wins + 1 }), 'classic', day)).toBeNull();
    expect(readEntry(entry({ ...base, series: 4, title: false }), 'classic', day)).toBeNull();
    expect(readEntry(entry({ ...base, perfect: true }), 'classic', day)).toBeNull();
    expect(readEntry(entry({ ...base, lineup: ids.slice(0, 4) }), 'classic', day)).toBeNull();
    expect(readEntry(entry({ ...base, lineup: [...ids.slice(0, 4), { s: 'C', id: ids[0].id }] }), 'classic', day)).toBeNull();
    expect(readEntry(entry({ ...base, lineup: ids.map((x) => ({ ...x, id: 'NOPE:1' })) }), 'classic', day)).toBeNull();
    // a player at a position he never played
    const pg = CELLS.flatMap((c) => c.players).find((p) => p.pos.length === 1 && p.pos[0] === 'C')!;
    expect(readEntry(entry({ ...base, lineup: [{ s: 'PG', id: pg.id }, ...ids.slice(1)] }), 'classic', day)).toBeNull();
    expect(readEntry({ ...entry(base), content: 'not json' }, 'classic', day)).toBeNull();
    // a bad name shows as "Player", the entry still counts
    expect(readEntry(entry({ ...base, name: 'Sh1t' }), 'classic', day)?.name).toBe('Player');
  });

  it('only accepts Daily lineups drawn from that day’s teams', () => {
    const day = '2026-10-24';
    const today = dailyOrder(day).slice(0, 5);
    const ids = realLineup(today);
    const r = rateTeam(rebuildLineup(ids, day)!);
    expect(readEntry(entry({ v: 1, name: 'D', wins: r.wins, series: 0, title: false, perfect: false, rating: 1, lineup: ids }), 'daily', day)).not.toBeNull();
    const other = dailyOrder(day).slice(-30).filter((c) => !dailyOrder(day).slice(0, 40).includes(c));
    const far = realLineup(other.length ? other : dailyOrder('2026-10-25').slice(60, 70));
    expect(rebuildLineup(far, day)).toBeNull();
  });

  it('checks head-to-head records for sane numbers', () => {
    expect(readEntry(entry({ v: 1, name: 'A', w: 3, l: 1, streak: 2 }), 'h2h', '2026-10-24')?.h2h).toEqual({ w: 3, l: 1, streak: 2 });
    expect(readEntry(entry({ v: 1, name: 'A', w: -1, l: 1 }), 'h2h', '2026-10-24')).toBeNull();
    expect(readEntry(entry({ v: 1, name: 'A', w: 1.5, l: 1 }), 'h2h', '2026-10-24')).toBeNull();
  });

  it('keeps your best per board and sends only what changed', () => {
    const day = '2026-10-24';
    let lb: LbState = { entries: {}, dirty: [] };
    const good = record({ series: 1 });
    const a = withRun(lb, 'Me', good, day);
    expect(a.improved).toEqual([boardTag('classic', 'all', day), boardTag('classic', 'week', day)]);
    lb = { ...a.lb, dirty: [] };
    const worse = record({ wins: good.wins, series: 0 });
    expect(withRun(lb, 'Me', worse, day).improved).toEqual([]);
    const better = record({ series: 3 });
    expect(withRun(lb, 'Me', better, day).improved.length).toBe(2);
    // the Daily counts your first ranked run only
    const daily = record({ mode: 'daily', ranked: true, dailyKey: day });
    const d1 = withRun(lb, 'Me', daily, day);
    expect(d1.improved).toEqual([boardTag('daily', 'all', day)]);
    expect(withRun(d1.lb, 'Me', record({ mode: 'daily', ranked: true, dailyKey: day, series: 4, title: true }), day).improved).toEqual([]);
    expect(withRun(lb, 'Me', record({ mode: 'daily', ranked: false, dailyKey: day }), day).improved).toEqual([]);
    expect(withRun(lb, 'Me', record({ mode: '1v1' }), day).improved).toEqual([]);
  });

  it('drops closed boards and re-sends open ones under a new name', () => {
    const lb = withH2H(withRun({ entries: {}, dirty: [] }, 'Old', record({}), '2026-10-17').lb, 'Old', { w: 1, l: 0, streak: 1 }, { w: 1, l: 0, streak: 1 }, '2026-10-17');
    const now = prune(lb, '2026-10-24');
    expect(Object.keys(now.entries).sort()).toEqual([boardTag('classic', 'all', '2026-10-24'), boardTag('h2h', 'all', '2026-10-24')].sort());
    const re = renamed(lb, 'New', '2026-10-24');
    expect(Object.values(re.entries).every((c) => c.name === 'New')).toBe(true);
    expect(re.dirty.length).toBe(2);
  });

  it('orders runs by wins, then playoff rounds, then a perfect run, then rating', () => {
    const r = (wins: number, series: number, perfect = false, rating = 90) => ({ wins, series, title: series === 4, perfect, rating });
    expect(compareRuns(r(70, 1), r(69, 4))).toBeLessThan(0);
    expect(compareRuns(r(70, 1), r(70, 2))).toBeGreaterThan(0);
    expect(compareRuns(r(82, 4, true), r(82, 4))).toBeLessThan(0);
    expect(compareRuns(r(70, 1, false, 95), r(70, 1, false, 94))).toBeLessThan(0);
  });

  it('keeps names clean', () => {
    expect(nameProblem('Steph 30')).toBeNull();
    expect(nameProblem('x')).not.toBeNull();
    expect(nameProblem('<b>hi</b>')).not.toBeNull();
    expect(nameProblem('s.h.1.t')).not.toBeNull();
    expect(nameProblem('Grapes')).not.toBeNull(); // "rape" inside: blocked on purpose, err on the safe side
    expect(nameProblem('A'.repeat(17))).not.toBeNull();
    expect(cleanRoomCode(' k7q-m ')).toBe('K7QM');
    expect(NET_V).toMatch(/^ps1-[0-9a-z]+-1$/);
  });
});

describe.skipIf(NFL)('head to head rules', () => {
  it('gives both phones the same five teams, and redraws that never touch them', () => {
    const a = onlineOrder('seed-1');
    expect(onlineOrder('seed-1')).toEqual(a);
    expect(onlineOrder('seed-2')).not.toEqual(a);
    const s = { ...newDraft('1v1', 'pro', null, false), order: a };
    const host = redrawCell(s, a, true)!;
    const guest = redrawCell(s, a, false)!;
    expect(a.slice(0, 5)).not.toContain(host);
    expect(a.slice(0, 5)).not.toContain(guest);
    expect(host).not.toBe(guest);
  });

  it('auto-picks the player who helps your team most, at a position he plays', () => {
    const s = { ...newDraft('1v1', 'pro', null, false), cellId: CELLS[3].id };
    const pick = bestPickFor(s, CELLS[3].id, [])!;
    expect(pick.player.pos).toContain(pick.slot);
    const best = Math.max(...CELLS[3].players.filter((p) => p.pos.some((x) => openSlots(s.lineup).includes(x))).map((p) => rateTeam([p]).rating));
    expect(rateTeam([pick.player]).rating).toBeCloseTo(best, 6);
    expect(bestPickFor(s, CELLS[3].id, [pick.player.id])!.player.id).not.toBe(pick.player.id);
  });

  it('seats the other player’s pick even after they moved people around', () => {
    const flex = CELLS.flatMap((c) => c.players).find((p) => p.pos.includes('PG') && p.pos.includes('SG'))!;
    const pgOnly = CELLS.flatMap((c) => c.players).find((p) => p.pos.length === 1 && p.pos[0] === 'PG' && p.pid !== flex.pid)!;
    // on this phone the flexible guard sits at PG; on theirs he moved to SG and they drafted a PG
    let s: DraftState = { ...newDraft('1v1', 'pro', null, false), cellId: flex.cellId };
    s = draftReducer(s, { type: 'bot', playerId: flex.id, slot: 'PG', cellId: flex.cellId });
    s = { ...s, botDone: false, cellId: pgOnly.cellId };
    const after = draftReducer(s, { type: 'bot', playerId: pgOnly.id, slot: 'PG', cellId: pgOnly.cellId });
    expect(after.botLineup.PG?.id).toBe(pgOnly.id);
    expect(after.botLineup.SG?.id).toBe(flex.id);
    const seated = assignSlots([flex, pgOnly], { SG: flex.id });
    expect(seated?.SG?.id).toBe(flex.id);
    expect(seated?.PG?.id).toBe(pgOnly.id);
    expect(assignSlots([pgOnly, { ...pgOnly, id: 'x', pid: 'y' } as Player])).toBeNull();
  });
});

describe.skipIf(NFL)('missions, streaks and rarity', () => {
  it('gives everyone the same three missions a day: easy, medium, hard', () => {
    const a = missionsFor('2026-10-24');
    expect(a.map((m) => m.id)).toEqual(missionsFor('2026-10-24').map((m) => m.id));
    expect(a.length).toBe(3);
    expect(a[0].coins).toBeLessThan(a[1].coins);
    expect(a[1].coins).toBeLessThan(a[2].coins);
  });

  it('moves missions forward and reports each completion once', () => {
    const day = '2026-10-24';
    const ev = { mode: 'classic' as const, wins: 70, series: 4, title: true, sweeps: 2, balance: 0.95, legends: 2, vsWon: null, online: false };
    const one = advance(day, [0, 0, 0], ev);
    const two = advance(day, one.progress, ev);
    for (const i of one.completed) expect(two.completed).not.toContain(i);
    missionsFor(day).forEach((m, i) => expect(two.progress[i]).toBeLessThanOrEqual(m.goal));
  });

  it('builds the daily streak from consecutive days', () => {
    let s = { count: 0, last: null as string | null, best: 0 };
    s = nextStreak(s, '2026-10-24');
    expect(s.count).toBe(1);
    s = nextStreak(s, '2026-10-25');
    expect(s.count).toBe(2);
    expect(nextStreak(s, '2026-10-25').count).toBe(2);
    s = nextStreak(s, '2026-10-27');
    expect(s).toEqual({ count: 1, last: '2026-10-27', best: 2 });
    expect(rewardFor(1).coins).toBe(25);
    expect(rewardFor(7).coins).toBe(rewardFor(30).coins);
  });

  it('makes Legendary rare and the all-time greats Legendary', () => {
    const all = CELLS.flatMap((c) => c.players);
    const legends = all.filter((p) => rarityOf(p) === 'legendary');
    expect(legends.length / all.length).toBeLessThan(0.01);
    expect(legends.length).toBeGreaterThan(30);
    expect(legends.some((p) => p.name === 'Michael Jordan')).toBe(true);
    expect(legends.some((p) => p.name === 'Wilt Chamberlain')).toBe(true);
  });
});

describe.skipIf(NFL)('hostile or stale network data', () => {
  it('ignores ids that look like object built-ins instead of crashing', () => {
    expect(CELL_BY_ID['constructor']).toBeUndefined();
    expect(CELL_BY_ID['toString']).toBeUndefined();
    const ids = realLineup();
    expect(() => readEntry(entry({ v: 1, name: 'x', wins: 1, series: 0, title: false, perfect: false, rating: 1, lineup: [{ s: 'PG', id: 'constructor:1' }, ...ids.slice(1)] }), 'classic', '2026-10-24')).not.toThrow();
    expect(readEntry(entry({ v: 1, name: 'x', wins: 1, series: 0, title: false, perfect: false, rating: 1, lineup: [{ s: 'PG', id: '__proto__:1' }, ...ids.slice(1)] }), 'classic', '2026-10-24')).toBeNull();
    const s: DraftState = { ...newDraft('1v1', 'pro', null, false), cellId: CELLS[0].id };
    expect(draftReducer(s, { type: 'bot', playerId: 'x', slot: 'PG', cellId: 'toString' })).toBe(s);
  });

  it('takes one pick per round from the other player, even if two arrive', () => {
    const cell = CELLS[5];
    const [a, b] = cell.players.filter((p) => p.pos.length > 0);
    let s: DraftState = { ...newDraft('1v1', 'pro', null, false), cellId: cell.id };
    s = draftReducer(s, { type: 'bot', playerId: a.id, slot: a.pos[0], cellId: cell.id });
    expect(draftReducer(s, { type: 'bot', playerId: b.id, slot: b.pos[0], cellId: cell.id })).toBe(s);
  });

  it('replaces an entry scored with older player data', () => {
    const day = '2026-10-24';
    const first = withRun({ entries: {}, dirty: [] }, 'Me', record({ series: 4, title: true }), day);
    const stale: LbState = { entries: Object.fromEntries(Object.entries(first.lb.entries).map(([d, c]) => [d, { ...c, dv: 'old' }])), dirty: [] };
    const worse = record({ series: 0 });
    expect(withRun(stale, 'Me', worse, day).improved.length).toBe(2);
    expect(withRun({ ...first.lb, dirty: [] }, 'Me', worse, day).improved).toEqual([]);
  });
});
