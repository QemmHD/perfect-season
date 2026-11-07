import { describe, it, expect } from 'vitest';
import {
  basketballFeedback,
  footballFeedback,
  soccerFeedback,
  releaseText,
} from './play-feedback';
import type { Possession } from './hoops2/types';
import type { Play } from './football2/types';
import type { Attack } from './soccer2/types';
describe('actual-play coach feedback', () => {
  it('keeps clipped basketball timing distinct from full soccer timing', () => {
    expect(releaseText(-65, false)).toBe('65 ms early');
    expect(releaseText(250, false, true)).toBe('250+ ms late');
    expect(releaseText(350, false)).toBe('350 ms late');
    expect(releaseText(0, true)).toBe('Perfect · on time');
  });
  it('uses the actual contest and timing without rerolling or altering the possession', () => {
    const p = {
      lastShot: {
        kind: 'three',
        contest: 'heavy',
        greened: false,
        off: 0.26,
        make: false,
      },
      end: { kind: 'miss', text: 'OFF THE RIM' },
      passes: 2,
      rand: () => {
        throw Error('feedback must never roll');
      },
    } as unknown as Possession;
    const before = JSON.stringify(p),
      read = basketballFeedback(p);
    expect(read.result).toBe('OFF THE RIM');
    expect(read.facts).toContainEqual({
      label: 'Release',
      value: '65 ms late',
    });
    expect(read.facts).toContainEqual({
      label: 'Coverage',
      value: 'Heavy contest',
    });
    expect(read.next).toContain('Create space');
    expect(JSON.stringify(p)).toBe(before);
  });
  it('does not blame an old shot when an offensive rebound ends in a turnover', () => {
    const read = basketballFeedback({
      lastShot: {
        kind: 'three',
        contest: 'open',
        greened: true,
        off: 0,
        make: false,
      },
      end: { kind: 'steal', text: 'STRIPPED' },
      passes: 1,
    } as unknown as Possession);
    expect(read.facts.some((f) => f.label === 'Release')).toBe(false);
    expect(read.next).toContain('pass lane');
  });
  it('reports actual run type, coverage, gain and stamina with a relevant next action', () => {
    const read = footballFeedback({
      call: 'run',
      run: 'outside',
      coverage: 'zone',
      stamina: 0.18,
      end: { kind: 'tackle', gain: 1.7, text: 'TACKLED', caught: false },
    } as unknown as Play);
    expect(read.facts).toContainEqual({ label: 'Gain', value: '+2 yd' });
    expect(read.facts).toContainEqual({
      label: 'Energy at whistle',
      value: '18%',
    });
    expect(read.next).toContain('Save BURST');
  });
  it('distinguishes an accepted flag from the raw play gain', () => {
    const read = footballFeedback(
      {
        call: 'pass',
        concept: 'flood',
        coverage: 'man',
        stamina: 1,
        end: { kind: 'incomplete', gain: 0, text: 'INCOMPLETE', caught: false },
      } as unknown as Play,
      { text: 'FLAG · FIRST DOWN', flag: { kind: 'def-holding', by: 'D' } },
    );
    expect(read.result).toBe('FLAG · FIRST DOWN');
    expect(read.facts).toContainEqual({
      label: 'Gain before flag',
      value: '0 yd',
    });
    expect(read.next).toContain('flag changed');
  });
  it('reports real soccer timing and assisted aim while distinguishing offside from a shot miss', () => {
    const a = {
      scenario: 'counter',
      stamina: 0.73,
      end: { kind: 'S', text: 'SAVED BY KEEPER' },
      lastShot: { kind: 'shot', off: -0.025, greened: true, assisted: true },
    } as unknown as Attack;
    const read = soccerFeedback(a);
    expect(read.facts).toContainEqual({
      label: 'Release',
      value: 'Perfect · 25 ms early',
    });
    expect(read.facts).toContainEqual({ label: 'Aim', value: 'Assisted' });
    expect(read.result).toBe('SAVED BY KEEPER');
    a.end!.kind = 'O';
    expect(soccerFeedback(a).next).toContain('last defender');
  });
  it('does not invent a measured release for an automatic dunk', () => {
    const read = basketballFeedback({
      lastShot: {
        kind: 'dunk',
        contest: 'open',
        greened: false,
        off: 0,
        make: true,
      },
      end: { kind: 'make', text: 'DUNK' },
      passes: 0,
    } as unknown as Possession);
    expect(read.facts).toContainEqual({
      label: 'Release',
      value: 'Automatic finish',
    });
    expect(read.next).not.toContain('green');
  });
});
