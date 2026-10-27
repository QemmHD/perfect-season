// What each side wears in a head to head, from the two players' favorite teams: each in his team's
// home (colored) set, except that the rival changes into his away set when both picked the same
// team or the two home jerseys are too alike to tell apart. The court belongs to the defending side,
// so your offense plays on the rival's home floor. Pure: each phone works out its own view.
import { type TeamInfo, teamOf, teamsOf } from '../data/teams';
import { hashString, rng } from '../engine/rng';
import type { SportId } from '../engine/sport';
import type { Kit as BasketballKit } from './hoops2/render';
import { hex, luma, onColor, type RGB, rgb } from './pixel/color';
import type { CourtTheme } from './pixel/court';

export type { BasketballKit };

export interface FootballKit {
  jersey: string;
  trim: string;
  pants: string;
  helmet: string;
  stripe: string;
  socks: string;
  shoes: string;
  mask: string;
}

export type Kit = BasketballKit | FootballKit;

export interface Kits<K extends Kit = Kit> {
  mine: K;
  theirs: K;
  /** the floor your offense plays on: the rival's */
  court: CourtTheme;
  /** the rival changed into his away set */
  rivalAway: boolean;
}

const WHITE = '#F4F4F4';
const DARK_SHOE = '#16161C';
const MASK = '#9AA0A6';

/** Nobody picked (an older rival, or a player who skipped): the app's own teal, and the rival purple. */
const HOUSE: TeamInfo = { abbr: 'PS', name: 'Perfect Season', c1: '#19E3C9', c2: '#032027', alt: '#F6F6F2' };
const HOUSE_RIVAL: TeamInfo = { abbr: 'PS', name: 'Perfect Season', c1: '#9B7BFF', c2: '#24145E', alt: '#F6F6F2' };

/**
 * How far apart two colors look: the "redmean" weighting of RGB distance, which follows the eye
 * better than plain RGB (0 the same, about 765 black to white).
 */
export function colorDistance(a: string, b: string): number {
  const x = rgb(a);
  const y = rgb(b);
  const rm = (x[0] + y[0]) / 2;
  const dr = x[0] - y[0];
  const dg = x[1] - y[1];
  const db = x[2] - y[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Closer than this, two jerseys read as the same team on the court. */
export const CLASH_DISTANCE = 140;
/** Two very dark jerseys (black, navy) are hard to tell apart whatever their hue. */
const DARK = 50;

export function colorsClash(a: string, b: string): boolean {
  return colorDistance(a, b) < CLASH_DISTANCE || (luma(rgb(a)) < DARK && luma(rgb(b)) < DARK);
}

const isWhite = (c: string) => luma(rgb(c)) > 225;

export function homeKit(team: TeamInfo, sport: 'nba'): BasketballKit;
export function homeKit(team: TeamInfo, sport: 'nfl'): FootballKit;
export function homeKit(team: TeamInfo, sport: SportId): Kit;
export function homeKit(team: TeamInfo, sport: SportId): Kit {
  if (sport === 'nfl') return { jersey: team.c1, trim: team.c2, pants: team.pants ?? WHITE, helmet: team.helmet ?? team.c1, stripe: team.c2, socks: team.c1, shoes: DARK_SHOE, mask: team.mask ?? MASK };
  return { jersey: team.c1, trim: team.c2, shorts: team.c1, socks: WHITE, shoes: DARK_SHOE };
}

export function awayKit(team: TeamInfo, sport: 'nba'): BasketballKit;
export function awayKit(team: TeamInfo, sport: 'nfl'): FootballKit;
export function awayKit(team: TeamInfo, sport: SportId): Kit;
export function awayKit(team: TeamInfo, sport: SportId): Kit {
  if (sport === 'nfl') {
    // white pants at home go with a colored pair on the road (a white jersey over white pants is a practice kit)
    const pants = team.pants && !isWhite(team.pants) ? team.pants : team.c1;
    return { jersey: team.alt, trim: team.c1, pants, helmet: team.helmet ?? team.c1, stripe: team.c2, socks: team.c1, shoes: WHITE, mask: team.mask ?? MASK };
  }
  return { jersey: team.alt, trim: team.c1, shorts: team.alt, socks: WHITE, shoes: WHITE };
}

/** A home court in a team's colors, its letters in a color that reads on its paint. */
export function courtOf(team: TeamInfo): CourtTheme {
  const base = rgb(team.c1);
  const ink: RGB = onColor(base, [rgb(team.c2), [255, 255, 255]]);
  return { c1: team.c1, c2: hex(ink), abbr: team.abbr };
}

export function kitsFor(myFav: string | null, rivalFav: string | null, sport: 'nba'): Kits<BasketballKit>;
export function kitsFor(myFav: string | null, rivalFav: string | null, sport: 'nfl'): Kits<FootballKit>;
export function kitsFor(myFav: string | null, rivalFav: string | null, sport: SportId): Kits;
export function kitsFor(myFav: string | null, rivalFav: string | null, sport: SportId): Kits {
  const me = teamOf(sport, myFav) ?? HOUSE;
  const them = teamOf(sport, rivalFav) ?? HOUSE_RIVAL;
  const mine = homeKit(me, sport);
  const home = homeKit(them, sport);
  const away = awayKit(them, sport);
  // the same team, or two jerseys too alike: the rival changes, unless his away set is no better
  const same = me.abbr === them.abbr && me !== HOUSE;
  const clash = same || colorsClash(me.c1, them.c1);
  const rivalAway = clash && (same || colorDistance(me.c1, them.alt) > colorDistance(me.c1, them.c1));
  return { mine, theirs: rivalAway ? away : home, court: courtOf(them), rivalAway };
}

/** The AI's favorite for a game, from its seed: any team but yours, so it usually wears its home set. */
export function aiFavorite(seed: string, sport: SportId, avoid: string | null = null): string {
  const list = teamsOf(sport).filter((t) => t.abbr !== avoid);
  return list[Math.floor(rng(hashString('aifav:' + seed))() * list.length)].abbr;
}
