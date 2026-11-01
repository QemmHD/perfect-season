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

/**
 * Claude 2026-11-01: soccer's forty draft clubs (src/data/soccer.json), identity colors only (no
 * crests, no real kits): the shirt in `c1`, the trim in `c2`.
 */
export const SOCCER_TEAMS: TeamInfo[] = [
  t('MUN', 'Manchester United', '#DA291C', '#FBE122'),
  t('LIV', 'Liverpool', '#C8102E', '#00B2A9'),
  t('ARS', 'Arsenal', '#EF0107', '#FFFFFF'),
  t('CHE', 'Chelsea', '#034694', '#FFFFFF'),
  t('MCI', 'Manchester City', '#6CABDD', '#1C2C5B'),
  t('TOT', 'Tottenham Hotspur', '#132257', '#FFFFFF'),
  t('EVE', 'Everton', '#003399', '#FFFFFF'),
  t('NEW', 'Newcastle United', '#241F20', '#FFFFFF'),
  t('AVL', 'Aston Villa', '#670E36', '#95BFE5'),
  t('RMA', 'Real Madrid', '#00529F', '#FEBE10'),
  t('BAR', 'FC Barcelona', '#A50044', '#004D98'),
  t('ATM', 'Atlético Madrid', '#CB3524', '#272E61'),
  t('VAL', 'Valencia', '#000000', '#EE7623'),
  t('SEV', 'Sevilla', '#D8001E', '#FFFFFF'),
  t('ATH', 'Athletic Club', '#EE2523', '#FFFFFF'),
  t('VIL', 'Villarreal', '#FFE667', '#005187'),
  t('JUV', 'Juventus', '#000000', '#FFFFFF'),
  t('MIL', 'AC Milan', '#FB090B', '#000000'),
  t('INT', 'Inter', '#0068A8', '#000000'),
  t('ROM', 'Roma', '#8E1F2F', '#F0BC42'),
  t('LAZ', 'Lazio', '#87D8F7', '#0B2240'),
  t('NAP', 'Napoli', '#12A0D7', '#FFFFFF'),
  t('FIO', 'Fiorentina', '#482E92', '#FFFFFF'),
  t('FCB', 'Bayern Munich', '#DC052D', '#0066B2'),
  t('BVB', 'Borussia Dortmund', '#FDE100', '#000000'),
  t('B04', 'Bayer Leverkusen', '#E32221', '#000000'),
  t('S04', 'Schalke 04', '#004D9D', '#FFFFFF'),
  t('BMG', 'Borussia Mönchengladbach', '#000000', '#00A651'),
  t('HSV', 'Hamburger SV', '#0A3F86', '#FFFFFF'),
  t('PSG', 'Paris Saint-Germain', '#004170', '#DA291C'),
  t('OM', 'Marseille', '#2FAEE0', '#FFFFFF'),
  t('OL', 'Lyon', '#1B3F8B', '#DA001A'),
  t('ASM', 'Monaco', '#E7001C', '#FFFFFF'),
  t('LIL', 'Lille', '#E01E13', '#1A2D5A'),
  t('AJA', 'Ajax', '#D2122E', '#FFFFFF'),
  t('PSV', 'PSV Eindhoven', '#ED1C24', '#FFFFFF'),
  t('FEY', 'Feyenoord', '#EE1C25', '#FFFFFF'),
  t('SLB', 'Benfica', '#E83030', '#FFFFFF'),
  t('FCP', 'FC Porto', '#0B3B8C', '#FFFFFF'),
  t('SCP', 'Sporting CP', '#00A859', '#FFFFFF'),
];

export function teamsOf(sport: SportId): TeamInfo[] {
  return ({ nba: NBA_TEAMS, nfl: NFL_TEAMS, soccer: SOCCER_TEAMS } satisfies Record<SportId, TeamInfo[]>)[sport] ?? NBA_TEAMS;
}

/** A team by its abbreviation, or null for anything that isn't one (also what comes off the wire). */
export function teamOf(sport: SportId, abbr: unknown): TeamInfo | null {
  if (typeof abbr !== 'string' || abbr.length > 4) return null;
  return teamsOf(sport).find((x) => x.abbr === abbr) ?? null;
}
