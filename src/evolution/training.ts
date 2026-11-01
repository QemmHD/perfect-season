export type Drill = 'shoot' | 'finish' | 'pass' | 'throw' | 'run' | 'kick';
export interface Attempt {
  points: number;
  success: boolean;
  green?: boolean;
  offset?: number;
  contest?: string;
  yards?: number;
  detail: string;
}
export interface Practice {
  drill: Drill;
  onAttempt: (attempt: Attempt) => void;
}
export interface DrillDef {
  id: Drill;
  title: string;
  subtitle: string;
  goal: string;
  icon: string;
  target: number;
}
export const HOOPS_DRILLS: DrillDef[] = [
  {
    id: 'shoot',
    title: 'GREEN MACHINE',
    subtitle: 'Find the release. Feel the rhythm.',
    goal: 'Make 6 of 10 shots',
    icon: '◎',
    target: 6,
  },
  {
    id: 'finish',
    title: 'ABOVE THE RIM',
    subtitle: 'Beat your man. Finish with authority.',
    goal: 'Finish 6 of 10 possessions',
    icon: '↗',
    target: 6,
  },
  {
    id: 'pass',
    title: 'READ & REACT',
    subtitle: 'Draw the help. Find the open man.',
    goal: 'Pass, then score on 5 possessions',
    icon: '⇄',
    target: 5,
  },
];
export const FOOTBALL_DRILLS: DrillDef[] = [
  {
    id: 'throw',
    title: 'POCKET POETRY',
    subtitle: 'Read the route. Put it on the money.',
    goal: 'Complete 6 of 10 passes',
    icon: '⌁',
    target: 6,
  },
  {
    id: 'run',
    title: 'BREAKAWAY',
    subtitle: 'Hit the hole. Make someone miss.',
    goal: 'Gain 5+ yards on 5 of 10 runs',
    icon: '↯',
    target: 5,
  },
  {
    id: 'kick',
    title: 'ICE IN YOUR VEINS',
    subtitle: 'One meter. No second thoughts.',
    goal: 'Make 6 of 10 field goals',
    icon: '⊔',
    target: 6,
  },
];
