import { beforeEach, expect, it, vi } from 'vitest';
import { SPORT } from '../engine/sport';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  publish: vi.fn(),
  sign: vi.fn(),
}));
vi.mock('../net/nostr', () => ({
  KIND_APP: 30078,
  NET_ON: true,
  NS_SUFFIX: '-qa',
  query: mocks.query,
  sign: mocks.sign,
  pool: { publish: mocks.publish },
  tagValue: (e: any, name: string) =>
    e.tags.find((t: string[]) => t[0] === name)?.[1],
}));
import { fetchRivals, publishRivals } from './rivals-net';
import { freshProfile } from '../lib/profile';
import { rivalsMatch } from './rivals';
const tag = 'perfect-season/rivals/v1/' + SPORT + '/2026-W44-qa';
beforeEach(() => {
  mocks.query.mockReset();
  mocks.publish.mockReset();
  mocks.sign.mockReset();
  mocks.sign.mockReturnValue({ signed: true });
});
it('publishes a separate board without changing existing queue messages or profile data', async () => {
  const p = freshProfile();
  p.name = 'Player';
  p.ut.rivals = rivalsMatch(undefined, '2026-W44', 'm1', true);
  const before = JSON.stringify(p);
  mocks.publish.mockResolvedValue(1);
  expect(await publishRivals(p, '2026-W44')).toBe(true);
  expect(mocks.sign.mock.calls[0][1]).toEqual([
    ['d', tag],
    ['t', tag],
  ]);
  expect(JSON.stringify(p)).toBe(before);
});
it('filters invalid scores, cross-board events and superseded entries', async () => {
  const event = (
    key: string,
    at: number,
    points: number,
    w: number,
    d = tag
  ) => ({
    pubkey: key,
    created_at: at,
    tags: [['d', d]],
    content: JSON.stringify({ v: 1, name: key, points, w, l: 0 }),
  });
  mocks.query.mockResolvedValue([
    event('a', 1, 30, 1),
    event('a', 2, 60, 2),
    event('impossible', 2, 500, 1),
    event('wrong-board', 2, 30, 1, 'other'),
  ]);
  expect(await fetchRivals('2026-W44')).toEqual([
    { key: 'a', name: 'Player', points: 60, w: 2, l: 0 },
  ]);
});
it('reports a pending submission on relay failure', async () => {
  const p = freshProfile();
  p.name = 'Player';
  p.ut.rivals = rivalsMatch(undefined, '2026-W44', 'm1', true);
  mocks.publish.mockResolvedValue(0);
  expect(await publishRivals(p, '2026-W44')).toBe(false);
});
// Claude, 2026-11-16 (studio overhaul, ut-3): "Hide me from leaderboards" stops the Rivals standings too
it('publishes nothing while the player is hidden from the boards; the same entry as before once shown', async () => {
  const p = freshProfile();
  p.name = 'Player';
  p.ut.rivals = rivalsMatch(undefined, '2026-W44', 'm1', true);
  mocks.publish.mockResolvedValue(1);
  expect(await publishRivals({ ...p, settings: { ...p.settings, hideBoards: true } }, '2026-W44')).toBe(true);
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
  expect(await publishRivals({ ...p, settings: { ...p.settings, hideBoards: false } }, '2026-W44')).toBe(true);
  expect(JSON.parse(mocks.sign.mock.calls[0][2])).toEqual({ v: 1, name: 'Player', points: expect.any(Number), best: expect.any(Number), w: 1, l: 0 });
});
