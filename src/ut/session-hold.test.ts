// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): the visit outlives a match. UT unmounts while
// a UT match plays; the summary on EXIT must still count what the match paid (session-summary.ts).
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { loadProfile, type Profile } from '../lib/profile';
import { MemoryStorage, useStorage } from './compat/memory-storage';
import { HOLD_MS, holdSession, markSession, resumeSession, sessionSummary } from './session-summary';

const NOON = Date.parse('2026-11-17T17:00:00Z');
const base = (): Profile => {
  useStorage(new MemoryStorage());
  return loadProfile();
};

describe('a visit held across a match (' + SPORT + ')', () => {
  it('UT comes back after the match with the visit mark it left with, so EXIT counts the match', () => {
    const p = base();
    const start = markSession(p, NOON);
    holdSession(start); // UT unmounts for the match
    const after = { ...p, coins: p.coins + 60 };
    const again = resumeSession(after, NOON + 6 * 60000); // UT mounts again after the result
    expect(again).toBe(start);
    expect(sessionSummary(again, after, NOON + 7 * 60000)!.earned).toBe('This visit: +60 coins');
  });
  it('the held mark is taken once; EXIT holds nothing, so the next visit starts fresh', () => {
    const p = base();
    holdSession(markSession(p, NOON));
    resumeSession(p, NOON + 1000);
    const next = resumeSession({ ...p, coins: p.coins + 500 }, NOON + 2000);
    expect(next.coins).toBe(p.coins + 500);
    holdSession(null);
    expect(resumeSession(p, NOON + 3000).at).toBe(NOON + 3000);
  });
  it('a held mark older than HOLD_MS, or from another day, starts a new visit', () => {
    const p = base();
    holdSession(markSession(p, NOON));
    expect(resumeSession(p, NOON + HOLD_MS).at).toBe(NOON + HOLD_MS);
    holdSession(markSession(p, NOON));
    const tomorrow = NOON + 24 * 3600000;
    expect(resumeSession(p, tomorrow).at).toBe(tomorrow);
  });
});
