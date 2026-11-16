// What each side wears in a head to head, from the two players' favorite teams: each in his team's
// home (colored) set, except that the rival changes into his away set when both picked the same
// team or the two home jerseys are too alike to tell apart (V2 C.1.6: primaries within CIEDE2000
// delta E 25). A kit is jersey base + trim + number; the body raster gives each its three-tone ramp.
// The court belongs to the defending side, so your offense plays on the rival's home floor. Pure:
// each phone works out its own view. Render only: kits never reach the simulation.
import { type TeamInfo, teamOf, teamsOf } from '../data/teams';
import { hashString, rng } from '../engine/rng';
import { pickFor, type SportId } from '../engine/sport';
import type { Kit as BasketballKit } from './hoops2/render';
import { deltaE2000, hex, luma, onColor, type RGB, rgb } from './pixel/color';
import type { CourtTheme } from './pixel/court';
import type { FieldTheme } from './pixel/field';
import { MARK_COLOR } from './pixel/ground';

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
  /** football: your end zone behind you, theirs the one you're going for */
  field: FieldTheme;
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

/** Closer than this (CIEDE2000), two jerseys read as the same team on the court (V2 C.1.6). */
export const CLASH_DE = 25;
/** Two very dark jerseys (black, navy) are hard to tell apart whatever their hue. */
const DARK = 50;

/** How far apart two kit colours look (CIEDE2000 delta E). */
export function kitDeltaE(a: string, b: string): number {
  return deltaE2000(rgb(a), rgb(b));
}

export function colorsClash(a: string, b: string): boolean {
  return kitDeltaE(a, b) < CLASH_DE || (luma(rgb(a)) < DARK && luma(rgb(b)) < DARK);
}

/** The ground rings' colours (ground.ts): no kit may be one of them, so "you" always reads as you. */
export const RING_COLORS: readonly string[] = Object.values(MARK_COLOR);

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
  // the same team, or two jerseys too alike: the rival changes into his away set, or (when that is
  // no better against yours) a change kit in his second colour, white or charcoal
  const same = me.abbr === them.abbr && me !== HOUSE;
  const rivalAway = same || colorsClash(me.c1, them.c1);
  if (!rivalAway) return { mine, theirs: home, court: courtOf(them), rivalAway, field: fieldOf(me, them) };
  const change = (c: string): Kit => ({ ...away, jersey: c, trim: kitDeltaE(c, them.c1) < CLASH_DE ? them.c2 : them.c1, ...pickFor<Partial<Kit>>(sport, { nba: { shorts: c }, nfl: {}, soccer: { shorts: c } }) });
  const theirs = clearOf(mine.jersey, [away, ...CHANGE_COLORS(them.c2).map(change)]);
  return { mine, theirs, court: courtOf(them), rivalAway, field: fieldOf(me, them) };
}

/** The change kits' shirt colours after the away set, in order: the team's second colour, white, charcoal. */
export const CHANGE_COLORS = (second: string): string[] => [second, WHITE, '#1D2230'];

/**
 * The first of a rival's kits (away set first, then the change kits) whose jersey doesn't clash with
 * yours; if every one does, the farthest from yours. Every sport's kits go through this (soccer2/kits.ts too).
 */
export function clearOf<K extends { jersey: string }>(mine: string, options: readonly K[]): K {
  return options.find((k) => !colorsClash(mine, k.jersey)) ?? options.reduce((a, b) => (kitDeltaE(mine, b.jersey) > kitDeltaE(mine, a.jersey) ? b : a));
}

/** The end zones: the nickname across each, yours behind your offense. */
export function fieldOf(me: TeamInfo, them: TeamInfo): FieldTheme {
  const nick = (t: TeamInfo, fallback: string) => (t.abbr === 'PS' ? fallback : t.name.split(' ').pop() ?? t.abbr);
  return { homeC1: me.c1, homeC2: me.c2, homeName: nick(me, 'Perfect'), awayC1: them.c1, awayC2: them.c2, awayName: nick(them, 'Rivals') };
}

/** The AI's favorite for a game, from its seed: any team but yours, so it usually wears its home set. */
export function aiFavorite(seed: string, sport: SportId, avoid: string | null = null): string {
  const list = teamsOf(sport).filter((t) => t.abbr !== avoid);
  return list[Math.floor(rng(hashString('aifav:' + seed))() * list.length)].abbr;
}
