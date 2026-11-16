// The held arena's engine side (nba-3, plan §4.8; Claude 2026-11-16): a rematch's AI game worked out a
// possession per task is the AI game itself (the same marks, score and possessions as
// aiPossessionsOf, the online race's function), and stepping `autoplaySteps` to the end is `autoplay`.
import { describe, expect, it } from 'vitest';
import { aiPossessionsLater, autoplay, autoplaySteps } from './autopilot';
import { newHoopsGame } from './game';
import { synthSquad } from './harness';
import { aiPossessionsOf } from './Hoops2';

describe('the held arena: the rematch AI game', () => {
  it('a possession per task gives exactly aiPossessionsOf', async () => {
    for (const k of [0, 1, 2]) {
      const a = synthSquad('held-a' + k);
      const b = synthSquad('held-b' + k);
      const want = aiPossessionsOf(b.five, a.five, 'held:' + k, 0.68, 16, b.bench, 0.3);
      const got = await new Promise((res) => aiPossessionsLater(b.five, a.five, 'held:' + k, 0.68, 16, b.bench, 0.3, res));
      expect(got).toEqual(want);
    }
  });

  it('can be cancelled', async () => {
    const a = synthSquad('held-c');
    let called = false;
    const cancel = aiPossessionsLater(a.five, a.five, 'x', 0.5, 16, [], 0, () => (called = true));
    cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
  });

  it('autoplaySteps drained is autoplay', () => {
    const a = synthSquad('held-d');
    const b = synthSquad('held-e');
    const g1 = autoplay(newHoopsGame(a.five, b.five, 's', 16, a.bench, 0), 0.7, 's');
    const g2 = newHoopsGame(a.five, b.five, 's', 16, a.bench, 0);
    let n = 0;
    for (const _ of autoplaySteps(g2, 0.7, 's')) n++;
    expect(n).toBe(16);
    expect(g2.marks).toEqual(g1.marks);
    expect(g2.score).toBe(g1.score);
  });
});
