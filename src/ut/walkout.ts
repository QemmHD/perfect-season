// Claude, 2026-11-01 (wave 2): the walkout's clue sequence for the big pulls (FC 27: nation, league,
// club before the card). Ours: era (decade) → conference and division → franchise → the card, with a
// stage colour for promo editions. Conferences/divisions are today's alignment of each franchise.
import { walkoutAt } from './fc-scale';
import type { RatedCard } from './types';

const NBA: Record<string, [string, string]> = {
  ATL: ['EAST', 'SOUTHEAST'], BOS: ['EAST', 'ATLANTIC'], BKN: ['EAST', 'ATLANTIC'], CHA: ['EAST', 'SOUTHEAST'], CHI: ['EAST', 'CENTRAL'],
  CLE: ['EAST', 'CENTRAL'], DAL: ['WEST', 'SOUTHWEST'], DEN: ['WEST', 'NORTHWEST'], DET: ['EAST', 'CENTRAL'], GSW: ['WEST', 'PACIFIC'],
  HOU: ['WEST', 'SOUTHWEST'], IND: ['EAST', 'CENTRAL'], LAC: ['WEST', 'PACIFIC'], LAL: ['WEST', 'PACIFIC'], MEM: ['WEST', 'SOUTHWEST'],
  MIA: ['EAST', 'SOUTHEAST'], MIL: ['EAST', 'CENTRAL'], MIN: ['WEST', 'NORTHWEST'], NOP: ['WEST', 'SOUTHWEST'], NYK: ['EAST', 'ATLANTIC'],
  OKC: ['WEST', 'NORTHWEST'], ORL: ['EAST', 'SOUTHEAST'], PHI: ['EAST', 'ATLANTIC'], PHX: ['WEST', 'PACIFIC'], POR: ['WEST', 'NORTHWEST'],
  SAC: ['WEST', 'PACIFIC'], SAS: ['WEST', 'SOUTHWEST'], TOR: ['EAST', 'ATLANTIC'], UTA: ['WEST', 'NORTHWEST'], WAS: ['EAST', 'SOUTHEAST'],
};
const NFL: Record<string, [string, string]> = {
  BUF: ['AFC', 'EAST'], MIA: ['AFC', 'EAST'], NE: ['AFC', 'EAST'], NYJ: ['AFC', 'EAST'], BAL: ['AFC', 'NORTH'], CIN: ['AFC', 'NORTH'],
  CLE: ['AFC', 'NORTH'], PIT: ['AFC', 'NORTH'], HOU: ['AFC', 'SOUTH'], IND: ['AFC', 'SOUTH'], JAX: ['AFC', 'SOUTH'], TEN: ['AFC', 'SOUTH'],
  DEN: ['AFC', 'WEST'], KC: ['AFC', 'WEST'], LV: ['AFC', 'WEST'], LAC: ['AFC', 'WEST'], DAL: ['NFC', 'EAST'], NYG: ['NFC', 'EAST'],
  PHI: ['NFC', 'EAST'], WAS: ['NFC', 'EAST'], CHI: ['NFC', 'NORTH'], DET: ['NFC', 'NORTH'], GB: ['NFC', 'NORTH'], MIN: ['NFC', 'NORTH'],
  ATL: ['NFC', 'SOUTH'], CAR: ['NFC', 'SOUTH'], NO: ['NFC', 'SOUTH'], TB: ['NFC', 'SOUTH'], ARI: ['NFC', 'WEST'], LAR: ['NFC', 'WEST'],
  SF: ['NFC', 'WEST'], SEA: ['NFC', 'WEST'],
};

/** The walkout threshold (ut-scale.ts: 86 on the displayed scale), or any special edition. */
export function bigWalkout(rc: RatedCard): boolean {
  if (rc.tier === 'bronze' || rc.tier === 'silver') return false;
  return rc.tier !== 'gold' || rc.ovr >= walkoutAt(rc.line.sport);
}

export interface WalkoutClues {
  era: string;
  conference: string;
  division: string;
  /** promo stage colour class */
  stage: string;
}

export function walkoutClues(rc: RatedCard): WalkoutClues {
  const l = rc.line;
  const cd = (l.sport === 'nba' ? NBA : NFL)[l.fr] ?? (l.sport === 'nba' ? ['NBA', 'LEAGUE'] : ['NFL', 'LEAGUE']);
  const decade = Math.floor(l.season / 10) * 10;
  return {
    era: "THE '" + String(decade).slice(2) + 'S',
    conference: l.sport === 'nba' ? cd[0] + 'ERN CONFERENCE' : cd[0],
    division: l.sport === 'nba' ? cd[1] + ' DIVISION' : cd[0] + ' ' + cd[1],
    stage: 'stage-' + (l.holo ? 'holo' : rc.tier),
  };
}
