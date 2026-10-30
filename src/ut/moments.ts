// Codex: manually played scenarios; permanent first-clear rewards use the existing engines/packs.
import type { Drill, Attempt } from '../evolution/training';
import type { UtSport } from './types';
import type { UtState } from './state';
import { depositPrize, hqOf, recordActivity, type Reward } from './progression';
import { LEVEL, LEVEL_NAME, LEVELS } from './battles';
export interface Moment {
  id: string;
  title: string;
  kicker: string;
  story: string;
  drill: Drill;
  attempts: number;
  target: number;
  measure: 'success' | 'green' | 'yards';
  difficulty: number;
  reward: Reward;
}
export function momentUnit(m: Moment): string {
  return m.measure === 'yards'
    ? 'YARDS'
    : m.measure === 'green'
      ? 'GREEN RELEASES'
      : m.drill === 'throw'
        ? 'COMPLETIONS'
        : m.drill === 'kick'
          ? 'FIELD GOALS'
          : 'BASKETS';
}
export function momentDifficulty(m: Moment): string {
  const level = LEVELS.reduce((best, candidate) =>
    Math.abs(LEVEL[candidate].def - m.difficulty) <
    Math.abs(LEVEL[best].def - m.difficulty)
      ? candidate
      : best
  );
  return LEVEL_NAME[level];
}
export function momentsFor(sport: UtSport): Moment[] {
  return sport === 'nba'
    ? [
        {
          id: 'nba:first-light',
          title: 'First Light',
          kicker: 'GET INTO YOUR RHYTHM',
          story:
            'Your club. Your first statement. Make three baskets in five possessions.',
          drill: 'shoot',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: -0.5,
          reward: { coins: 100, sp: 150 }
        },
        {
          id: 'nba:paint',
          title: 'Own the Paint',
          kicker: 'FINISH THROUGH PRESSURE',
          story:
            'Attack the rim. Finish three of five chances against a stronger defense.',
          drill: 'finish',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: 0,
          reward: { pack: 'silver', sp: 200 }
        },
        {
          id: 'nba:playmaker',
          title: 'Make the Extra Pass',
          kicker: 'CREATE THE OPENING',
          story:
            'Move the ball before you score. Complete three scoring possessions in five attempts.',
          drill: 'pass',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: 0,
          reward: { coins: 200, sp: 200 }
        },
        {
          id: 'nba:green-room',
          title: 'The Green Room',
          kicker: 'PERFECT THE RELEASE',
          story:
            'Two green releases in five attempts. Contest and shooting talent still matter.',
          drill: 'shoot',
          attempts: 5,
          target: 2,
          measure: 'green',
          difficulty: 0.5,
          reward: { pack: 'gold', sp: 250 }
        },
        {
          id: 'nba:closer',
          title: 'The Closer',
          kicker: 'LEGEND PRESSURE',
          story:
            'Convert three of five possessions against Legend defense. Make your squad count.',
          drill: 'shoot',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: 1,
          reward: { pack: 'premium', sp: 300 }
        }
      ]
    : [
        {
          id: 'nfl:first-down',
          title: 'Move the Chains',
          kicker: 'FOLLOW YOUR BLOCKS',
          story:
            'Gain ten total yards across three rushing attempts. Read the lane before cutting.',
          drill: 'run',
          attempts: 3,
          target: 10,
          measure: 'yards',
          difficulty: -0.5,
          reward: { coins: 100, sp: 150 }
        },
        {
          id: 'nfl:rhythm',
          title: 'Find Your Rhythm',
          kicker: 'READ. SET. RELEASE.',
          story:
            'Complete three passes in five attempts. Use the full playbook to find your receiver.',
          drill: 'throw',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: 0,
          reward: { pack: 'silver', sp: 200 }
        },
        {
          id: 'nfl:ground',
          title: 'Ground Control',
          kicker: 'WIN THE EDGE',
          story:
            'Gain twelve total yards across three runs against Pro defense.',
          drill: 'run',
          attempts: 3,
          target: 12,
          measure: 'yards',
          difficulty: 0,
          reward: { coins: 200, sp: 200 }
        },
        {
          id: 'nfl:uprights',
          title: 'Through the Uprights',
          kicker: 'STAY COMPOSED',
          story: 'Make three of five field goals as the distance increases.',
          drill: 'kick',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: 0.5,
          reward: { pack: 'gold', sp: 250 }
        },
        {
          id: 'nfl:closer',
          title: 'Two-Minute Mindset',
          kicker: 'LEGEND PRESSURE',
          story:
            'Complete three of five throws against Legend defense. Beat the rush with your read.',
          drill: 'throw',
          attempts: 5,
          target: 3,
          measure: 'success',
          difficulty: 1,
          reward: { pack: 'premium', sp: 300 }
        }
      ];
}
export function momentScore(m: Moment, attempts: Attempt[]): number {
  return attempts
    .slice(0, m.attempts)
    .reduce(
      (n, a) =>
        n +
        (m.measure === 'yards'
          ? Math.max(-10, Math.min(40, a.yards ?? 0))
          : m.measure === 'green'
            ? a.green
              ? 1
              : 0
            : a.success
              ? 1
              : 0),
      0
    );
}
export function finishMoment(
  ut: UtState,
  m: Moment,
  attempts: Attempt[],
  at: number
): UtState {
  if (attempts.length < m.attempts) return ut;
  const h = hqOf(ut),
    prior = h.moments[m.id],
    score = momentScore(m, attempts);
  return {
    ...ut,
    hq: {
      ...h,
      moments: {
        ...h.moments,
        [m.id]: {
          ...prior,
          best: Math.max(prior?.best ?? 0, score),
          ...(score >= m.target && !prior?.completedAt
            ? { completedAt: at }
            : {})
        }
      }
    }
  };
}
export function claimMoment(
  ut: UtState,
  sport: UtSport,
  id: string,
  day: string,
  at: number
) {
  const m = momentsFor(sport).find((m) => m.id === id),
    h = hqOf(ut),
    p = h.moments[id];
  if (!m || !p?.completedAt || p.best < m.target || p.claimed)
    return { ut, coins: 0, sp: 0, pack: null };
  const next = recordActivity(
    {
      ...ut,
      hq: { ...h, moments: { ...h.moments, [id]: { ...p, claimed: true } } }
    },
    'moment:' + id,
    day,
    { moments: 1 },
    m.reward.sp ?? 0
  );
  return depositPrize(next, 'moment:' + id, m.reward, at);
}
