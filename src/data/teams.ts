// The current franchises, for favorite teams and the uniforms a head to head is played in.
// Colors are each team's own: `c1` the home jersey (the game's home set is the colored one),
// `c2` the trim and numbers on it, `alt` the away or alternate jersey (white for nearly everyone).
// Football adds the helmet, its stripe and face mask, and the home pants.
import type { SportId } from '../engine/sport';

export interface TeamInfo {
  abbr: string;
  name: string;
  /** primary: the home jersey */
  c1: string;
  /** secondary: trim and numbers */
  c2: string;
  /** the away or alternate jersey */
  alt: string;
  /** football: helmet shell (default the primary), face mask (default gray), home pants (default white) */
  helmet?: string;
  mask?: string;
  pants?: string;
}

const W = '#F6F6F2';

const t = (abbr: string, name: string, c1: string, c2: string, alt = W, extra: Partial<TeamInfo> = {}): TeamInfo => ({ abbr, name, c1, c2, alt, ...extra });

export const NBA_TEAMS: TeamInfo[] = [
  t('ATL', 'Atlanta Hawks', '#E03A3E', '#FDB927'),
  t('BOS', 'Boston Celtics', '#007A33', '#FFFFFF'),
  t('BKN', 'Brooklyn Nets', '#000000', '#FFFFFF'),
  t('CHA', 'Charlotte Hornets', '#00788C', '#1D1160'),
  t('CHI', 'Chicago Bulls', '#CE1141', '#000000'),
  t('CLE', 'Cleveland Cavaliers', '#860038', '#FDBB30'),
  t('DAL', 'Dallas Mavericks', '#00538C', '#B8C4CA'),
  t('DEN', 'Denver Nuggets', '#0E2240', '#FEC524'),
  t('DET', 'Detroit Pistons', '#C8102E', '#1D42BA'),
  t('GSW', 'Golden State Warriors', '#1D428A', '#FFC72C'),
  t('HOU', 'Houston Rockets', '#CE1141', '#C4CED4'),
  t('IND', 'Indiana Pacers', '#002D62', '#FDBB30'),
  t('LAC', 'Los Angeles Clippers', '#1D428A', '#C8102E'),
  t('LAL', 'Los Angeles Lakers', '#552583', '#FDB927'),
  t('MEM', 'Memphis Grizzlies', '#5D76A9', '#12173F'),
  t('MIA', 'Miami Heat', '#98002E', '#F9A01B'),
  t('MIL', 'Milwaukee Bucks', '#00471B', '#EEE1C6'),
  t('MIN', 'Minnesota Timberwolves', '#0C2340', '#78BE20'),
  t('NOP', 'New Orleans Pelicans', '#0C2340', '#C8102E'),
  t('NYK', 'New York Knicks', '#006BB6', '#F58426'),
  t('OKC', 'Oklahoma City Thunder', '#007AC1', '#EF3B24'),
  t('ORL', 'Orlando Magic', '#0077C0', '#C4CED4'),
  t('PHI', 'Philadelphia 76ers', '#006BB6', '#ED174C'),
  t('PHX', 'Phoenix Suns', '#1D1160', '#E56020'),
  t('POR', 'Portland Trail Blazers', '#E03A3E', '#000000'),
  t('SAC', 'Sacramento Kings', '#5A2D81', '#63727A'),
  t('SAS', 'San Antonio Spurs', '#000000', '#C4CED4'),
  t('TOR', 'Toronto Raptors', '#CE1141', '#000000'),
  t('UTA', 'Utah Jazz', '#002B5C', '#F9A01B'),
  t('WAS', 'Washington Wizards', '#002B5C', '#E31837'),
];

export const NFL_TEAMS: TeamInfo[] = [
  t('ARI', 'Arizona Cardinals', '#97233F', '#FFFFFF', W, { helmet: '#F4F4F4' }),
  t('ATL', 'Atlanta Falcons', '#A71930', '#000000', W, { helmet: '#101820' }),
  t('BAL', 'Baltimore Ravens', '#241773', '#9E7C0C', W, { helmet: '#101820' }),
  t('BUF', 'Buffalo Bills', '#00338D', '#C60C30', W, { helmet: '#F4F4F4' }),
  t('CAR', 'Carolina Panthers', '#0085CA', '#101820', W, { helmet: '#A5ACAF', pants: '#A5ACAF' }),
  t('CHI', 'Chicago Bears', '#0B162A', '#C83803', W, { mask: '#0B162A' }),
  t('CIN', 'Cincinnati Bengals', '#FB4F14', '#000000', W, { mask: '#101820' }),
  t('CLE', 'Cleveland Browns', '#311D00', '#FF3C00', W, { helmet: '#FF3C00' }),
  t('DAL', 'Dallas Cowboys', '#003594', '#869397', W, { helmet: '#B0B7BC', pants: '#B0B7BC' }),
  t('DEN', 'Denver Broncos', '#FB4F14', '#002244', W, { helmet: '#002244' }),
  t('DET', 'Detroit Lions', '#0076B6', '#B0B7BC', W, { helmet: '#B0B7BC', pants: '#B0B7BC' }),
  t('GB', 'Green Bay Packers', '#203731', '#FFB612', W, { helmet: '#FFB612', pants: '#FFB612', mask: '#203731' }),
  t('HOU', 'Houston Texans', '#03202F', '#A71930'),
  t('IND', 'Indianapolis Colts', '#002C5F', '#FFFFFF', W, { helmet: '#F4F4F4' }),
  t('JAX', 'Jacksonville Jaguars', '#006778', '#D7A22A', W, { helmet: '#101820' }),
  t('KC', 'Kansas City Chiefs', '#E31837', '#FFB81C'),
  t('LAC', 'Los Angeles Chargers', '#0080C6', '#FFC20E', W, { helmet: '#F4F4F4' }),
  t('LAR', 'Los Angeles Rams', '#003594', '#FFA300'),
  t('LV', 'Las Vegas Raiders', '#000000', '#A5ACAF', W, { helmet: '#A5ACAF', pants: '#A5ACAF', mask: '#101820' }),
  t('MIA', 'Miami Dolphins', '#008E97', '#FC4C02', W, { helmet: '#F4F4F4' }),
  t('MIN', 'Minnesota Vikings', '#4F2683', '#FFC62F'),
  t('NE', 'New England Patriots', '#002244', '#C60C30', W, { helmet: '#B0B7BC', pants: '#B0B7BC' }),
  t('NO', 'New Orleans Saints', '#101820', '#D3BC8D', W, { helmet: '#D3BC8D', pants: '#D3BC8D', mask: '#101820' }),
  t('NYG', 'New York Giants', '#0B2265', '#A71930', W, { pants: '#A2AAAD' }),
  t('NYJ', 'New York Jets', '#125740', '#FFFFFF'),
  t('PHI', 'Philadelphia Eagles', '#004C54', '#A5ACAF'),
  t('PIT', 'Pittsburgh Steelers', '#101820', '#FFB612', W, { pants: '#FFB612', mask: '#101820' }),
  t('SEA', 'Seattle Seahawks', '#002244', '#69BE28', W, { pants: '#A5ACAF' }),
  t('SF', 'San Francisco 49ers', '#AA0000', '#B3995D', W, { helmet: '#B3995D', pants: '#B3995D' }),
  t('TB', 'Tampa Bay Buccaneers', '#D50A0A', '#34302B', W, { helmet: '#8A8D8F', pants: '#8A8D8F' }),
  t('TEN', 'Tennessee Titans', '#0C2340', '#4B92DB'),
  t('WAS', 'Washington Commanders', '#5A1414', '#FFB612', W, { pants: '#FFB612' }),
];

export function teamsOf(sport: SportId): TeamInfo[] {
  return sport === 'nfl' ? NFL_TEAMS : NBA_TEAMS;
}

/** A team by its abbreviation, or null for anything that isn't one (also what comes off the wire). */
export function teamOf(sport: SportId, abbr: unknown): TeamInfo | null {
  if (typeof abbr !== 'string' || abbr.length > 4) return null;
  return teamsOf(sport).find((x) => x.abbr === abbr) ?? null;
}
