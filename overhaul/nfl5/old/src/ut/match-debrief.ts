// Codex (OpenAI): observed drive/possession endings only, never fabricated shooting or player stats.
import type { UtSport } from './types';
export interface Debrief {
  total: number;
  metrics: { label: string; value: string }[];
  title: string;
  advice: string;
}
export function matchDebrief(sport: UtSport, raw: readonly string[]): Debrief {
  const allowed = {
    nba: ['2', '3', 'A', 'X', 'TO'],
    nfl: ['TD', 'FG', 'MISS', 'INT', 'DOWNS', 'PUNT', 'FUM', 'SAF', 'TIME'],
    soccer: ['G', 'S', 'W', 'B', 'L', 'O', 'T'],
  }[sport];
  const ends = raw.filter((x) => allowed.includes(x)),
    total = ends.length,
    n = (...codes: string[]) => ends.filter((e) => codes.includes(e)).length;
  if (!total)
    return {
      total,
      metrics: [],
      title: 'Match overview',
      advice:
        'Play a match to see a breakdown of its completed possessions, drives or attacks.',
    };
  if (sport === 'nba') {
    const scored = n('2', '3', 'A'),
      turnovers = n('TO'),
      points = n('2') * 2 + n('3', 'A') * 3;
    return {
      total,
      metrics: [
        { label: 'Points per possession', value: (points / total).toFixed(2) },
        { label: 'Scoring possessions', value: scored + ' / ' + total },
        { label: 'Turnovers', value: String(turnovers) },
      ],
      title:
        turnovers / total >= 0.25
          ? 'Protect your possessions'
          : scored / total < 0.5
            ? 'Create a cleaner look'
            : 'Keep the ball moving',
      advice:
        turnovers / total >= 0.25
          ? `${turnovers} possessions ended in turnovers. Pass before help arrives and use the dribble moves to change direction.`
          : scored / total < 0.5
            ? `${total - scored} possessions ended without points. Try a pass to an open teammate, let their feet settle, then time the release.`
            : 'Use Last Play during your next game to compare release timing and contest. Keep creating open looks rather than forcing the same shot.',
    };
  }
  if (sport === 'nfl') {
    const td = n('TD'),
      fg = n('FG'),
      giveaways = n('INT', 'FUM'),
      downs = n('DOWNS'),
      timed = n('TIME');
    return {
      total,
      metrics: [
        { label: 'Scoring drives', value: td + fg + ' / ' + total },
        { label: 'Touchdowns / field goals', value: td + ' / ' + fg },
        { label: 'Giveaways', value: String(giveaways) },
      ],
      title: giveaways
        ? 'Keep the ball safe'
        : downs
          ? 'Stay ahead of the chains'
          : timed
            ? 'Manage the last drive'
            : 'Build the next drive',
      advice: giveaways
        ? `${giveaways} drives ended in an interception or fumble. Read coverage before throwing; save burst for a lane rather than holding it through contact.`
        : downs
          ? `${downs} drives ended on downs. Mix short passes and runs, follow your blockers, and use a field goal when it is in range.`
          : timed
            ? 'The clock ended a drive. Incompletions and going out of bounds stop it; check the clock before the next snap.'
            : 'Use Last Play to compare your run gains and pass outcomes. Short gains can keep a drive alive while you wait for an open route.',
    };
  }
  const goals = n('G'),
    onTarget = n('G', 'S'),
    lost = n('L'),
    offside = n('O');
  return {
    total,
    metrics: [
      { label: 'Goals / attacks', value: goals + ' / ' + total },
      { label: 'On-target endings', value: onTarget + ' / ' + total },
      { label: 'Lost / offside', value: lost + ' / ' + offside },
    ],
    title:
      offside >= 2
        ? 'Time the final pass'
        : lost >= 2
          ? 'Keep the attack alive'
          : onTarget / total < 0.5
            ? 'Find the target'
            : 'Work the next opening',
    advice:
      offside >= 2
        ? `${offside} attacks ended offside. Release the pass before your runner goes beyond the last defender.`
        : lost >= 2
          ? `${lost} attacks ended with the ball lost. Pass out of pressure and use space before trying the final shot.`
          : onTarget / total < 0.5
            ? 'Aim toward an open part of the goal and avoid releasing through a defender. The Last Play readout helps compare your timing and pressure.'
            : 'A saved shot still reached the target. Change the angle with a pass and compare your next release in Last Play.',
  };
}
