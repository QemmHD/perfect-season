// Football boards and head to head, run with PS_SPORT=nfl (npm test does both sports).
import { CELLS, CELL_BY_ID } from '../engine/data';
import { dailyOrder, newDraft, ROUNDS } from '../engine/draft';
import { missionsFor } from '../engine/missions';
import { onlineOrder, redrawCell } from '../engine/online';
import { rateTeam } from '../engine/rating';
import { NFL } from '../engine/sport';
import { type Slot, SLOTS } from '../engine/types';
import { DATA_V } from '../engine/version';
import { boardTag, readEntry, rebuildLineup } from './leaderboard';
import { NET_V } from './match';
import { KIND_APP, sign } from './nostr';

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
const entry = (content: object) => sign(KIND_APP, [['d', 'x']], JSON.stringify(content));
const day = '2026-10-24';

describe.skipIf(!NFL)('football boards', () => {
  it('keeps its own boards and matchmaking, apart from basketball', () => {
    expect(boardTag('classic', 'all', day)).toContain('perfect-season/nfl/v1');
    expect(boardTag('h2h', 'week', day)).toContain('/nfl/');
    expect(NET_V).toContain(DATA_V);
    // basketball's fingerprint, which football must never match
    expect(DATA_V).not.toBe('1gypzor');
  });
  it('accepts a real six-player lineup at the record it earns', () => {
    const ids = realLineup();
    expect(ids.length).toBe(6);
    const r = rateTeam(rebuildLineup(ids, null)!);
    const ok = readEntry(entry({ v: 1, name: 'Joe', wins: r.wins, series: r.wins >= 10 ? 2 : 0, title: false, perfect: false, rating: 1, lineup: ids }), 'classic', day);
    expect(ok?.run?.wins).toBe(r.wins);
    expect(ok?.run?.lineup.map((x) => x.slot)).toEqual(SLOTS);
  });
  it('rejects impossible football lineups and records', () => {
    const ids = realLineup();
    const r = rateTeam(rebuildLineup(ids, null)!);
    const base = { v: 1, name: 'Cheat', wins: r.wins, series: 0, title: false, perfect: false, rating: 1, lineup: ids };
    expect(readEntry(entry({ ...base, wins: r.wins === 17 ? 16 : r.wins + 1 }), 'classic', day)).toBeNull();
    // five players is a basketball lineup
    expect(readEntry(entry({ ...base, lineup: ids.slice(0, 5) }), 'classic', day)).toBeNull();
    // a quarterback can't be the FLEX, a defense can't play QB
    const qb = ids.find((x) => x.s === 'QB')!;
    const def = ids.find((x) => x.s === 'DEF')!;
    expect(readEntry(entry({ ...base, lineup: ids.map((x) => (x.s === 'FLEX' ? { s: 'FLEX', id: qb.id } : x.s === 'QB' ? { s: 'QB', id: ids.find((y) => y.s === 'FLEX')!.id } : x)) }), 'classic', day)).toBeNull();
    expect(readEntry(entry({ ...base, lineup: ids.map((x) => (x.s === 'QB' ? { s: 'QB', id: def.id } : x.s === 'DEF' ? { s: 'DEF', id: qb.id } : x)) }), 'classic', day)).toBeNull();
    // a basketball spot
    expect(readEntry(entry({ ...base, lineup: ids.map((x) => (x.s === 'TE' ? { ...x, s: 'C' } : x)) }), 'classic', day)).toBeNull();
    // a perfect season needs 17-0 and a title
    expect(readEntry(entry({ ...base, perfect: true }), 'classic', day)).toBeNull();
  });
  it('takes Daily lineups only from that day’s team-decades', () => {
    const today = dailyOrder(day).slice(0, ROUNDS);
    const ids = realLineup(today);
    const r = rateTeam(rebuildLineup(ids, null)!);
    expect(readEntry(entry({ v: 1, name: 'D', wins: r.wins, series: 0, title: false, perfect: false, rating: 1, lineup: ids }), 'daily', day)).not.toBeNull();
    const other = CELLS.map((c) => c.id).filter((id) => !dailyOrder(day).slice(0, 120).includes(id));
    if (other.length) {
      const bad = realLineup(other.slice(0, 8));
      const rb = rateTeam(rebuildLineup(bad, null)!);
      expect(readEntry(entry({ v: 1, name: 'D', wins: rb.wins, series: 0, title: false, perfect: false, rating: 1, lineup: bad }), 'daily', day)).toBeNull();
    }
  });
  it('plays six head-to-head rounds and redraws outside them', () => {
    const order = onlineOrder('seed1');
    expect(order.length).toBe(CELLS.length);
    const s = { ...newDraft('1v1', 'pro', null, false), order };
    const host = redrawCell(s, order, true)!;
    const guest = redrawCell(s, order, false)!;
    expect(order.slice(0, 6)).not.toContain(host);
    expect(order.slice(0, 6)).not.toContain(guest);
    expect(order.indexOf(host) % 2).toBe(0);
    expect(order.indexOf(guest) % 2).toBe(1);
    expect(order.indexOf(host)).toBeGreaterThanOrEqual(12);
  });
  it('has football missions', () => {
    const texts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => missionsFor('2026-11-0' + i).map((m) => m.text)).join(' | ');
    expect(texts).not.toMatch(/62\+|4–0|series/);
  });
});
