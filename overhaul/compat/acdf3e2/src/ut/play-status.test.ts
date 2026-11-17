// Codex: navigation resumes recent real run activity without altering saved progress.
import { describe, expect, it } from 'vitest';
import { continueRun, type ModeStatus, type playStatus } from './play-status';
function statuses(patch: Partial<Record<string, Partial<ModeStatus>>> = {}) {
  const keys = [
    'league',
    'battles',
    'circuit',
    'events',
    'moments',
    'draft',
    'rivals',
  ] as const;
  return Object.fromEntries(
    keys.map((view) => [view, { view, line: 'status', ...patch[view] }]),
  ) as ReturnType<typeof playStatus>;
}
describe('continue recommendation', () => {
  it('does not invent a continuation when no run is active', () =>
    expect(continueRun(statuses())).toBeNull());
  it('resumes a newly played circuit instead of always choosing an old season', () =>
    expect(
      continueRun(
        statuses({
          league: { live: true, lastPlayedAt: 100 },
          circuit: { live: true, lastPlayedAt: 500 },
        }),
      )?.view,
    ).toBe('circuit'));
  it('resumes a new draft before older ongoing runs and ignores completed ones', () =>
    expect(
      continueRun(
        statuses({
          league: { live: true, lastPlayedAt: 100 },
          circuit: { live: false, lastPlayedAt: 1000 },
          draft: { live: true, lastPlayedAt: 700 },
        }),
      )?.view,
    ).toBe('draft'));
  it('keeps the legacy priority for old saves without usable timestamps', () =>
    expect(
      continueRun(
        statuses({
          league: { live: true },
          circuit: { live: true },
          draft: { live: true },
        }),
      )?.view,
    ).toBe('league'));
});
