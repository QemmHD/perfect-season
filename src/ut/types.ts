// Ultimate Team: the shared shapes. A card line is one player's season as the card data files
// carry it (raw stats plus each stat's rank within that season and position); the ratings code
// turns it into 2K/Madden-style attributes. See docs/ULTIMATE-TEAM.md.

export type UtSport = 'nba' | 'nfl';

/** What kind of card: a season, a boosted hot season, an all-time legend. */
export type CardKind = 'season' | 'promo' | 'legend';

export type Tier = 'bronze' | 'silver' | 'gold' | 'promo' | 'legend';

/**
 * One player-season as stored in src/data/cards-<sport>.json.
 *  - `stats`: raw per-season numbers, keyed by short names (see the data script's header for each
 *    sport's list; NBA per game, NFL season totals)
 *  - `rk`: each listed stat's percentile (0-1) within that season among players at the same
 *    position group, so ratings compare a player with his own era
 */
export interface CardLine {
  /** stable: `<sport>:<kind>:<season>:<pid>:<team>` */
  id: string;
  sport: UtSport;
  kind: CardKind;
  pid: string;
  name: string;
  /** the season (NBA: the year it ends, 1989-90 is 1990; NFL: the year it starts) */
  season: number;
  /** franchise code and the abbreviation, name and colors that season */
  fr: string;
  abbr: string;
  teamName: string;
  c1: string;
  c2: string;
  /** NBA: PG SG SF PF C (main first); NFL: QB RB WR TE OT OG C DE DT LB CB S K */
  pos: string[];
  ht: number | null;
  wt: number | null;
  num: number | null;
  games: number | null;
  starts: number | null;
  stats: Record<string, number | null>;
  rk: Record<string, number | null>;
  /** e.g. 'MVP', 'ALLNBA1', 'ALLPRO1', 'ALLPRO2', 'PB', 'DPOY', 'SCORING' */
  honors: string[];
  /** promo/legend: the boost it carries (+overall) and its label */
  boost?: number;
  label?: string;
}

/** A card in a player's club. */
export interface OwnedCard {
  uid: string;
  cardId: string;
  level: number;
  xp: number;
  /** when it was packed (ms) */
  at: number;
}

/** A rated card, ready to show or to play. */
export interface RatedCard {
  line: CardLine;
  ovr: number;
  tier: Tier;
  /** the position it's rated at */
  pos: string;
  /** 0-99, the sport's attribute names */
  attrs: Record<string, number>;
  /** the six shown on the card, in order */
  key: [string, string, number][];
  abil: string[];
}
