// The crowd (studio overhaul players-4, V2 C.2's "calmer venues"): the stands as three dark bands of
// value, the nearest the lightest and each tier behind it darker, flecked with the home colour (at
// most 6% of the crowd) and white (at most 2%) in 2 px blocks. The stands sit back, softer and
// darker than the play, so the players are what the eye lands on. One function for every venue: the
// far wall of stands (persp.ts), the courtside and touchline seats seen from above (persp.ts,
// pitch.ts) and the side-on stands (court.ts, field.ts). Colour only: where the stands are and how
// big is the venue code's, unchanged.
//
// `excite` is the reaction hook the sport teams call on a score, ON FIRE or Clutch. It is safe to call
// now and does nothing yet: the front rows standing and waving land in players-9 (the living venue).
import { mix, type RGB, rgb } from './color';
import { noise } from './pixbuf';

/** The three bands, nearest (lightest) to farthest (darkest). */
export const CROWD_BANDS: readonly string[] = ['#4a426e', '#342d52', '#221d36'];
/** Flecks of the home colour and of white, as shares of the crowd's pixels (V2 C.2: at most 6% and 2%). */
export const CROWD_TEAM_SHARE = 0.05;
export const CROWD_WHITE_SHARE = 0.015;
/** A fleck is a block this many texels square. */
export const FLECK = 2;
/** The bands lean this far toward the home colour, so each arena's stands carry its team (still three tones). */
const TEAM_TINT = 0.1;
const WHITE: RGB = [232, 232, 236];

export type Band = 0 | 1 | 2;

/** A venue's crowd colours: the three bands toward the home colour, the home fleck and the white one. */
export interface CrowdPalette {
  bands: [RGB, RGB, RGB];
  team: RGB;
  white: RGB;
}

export function crowdPalette(home: RGB | string): CrowdPalette {
  const team = typeof home === 'string' ? rgb(home) : home;
  // whole channel values: the textures pack them as bytes, and a fleck is exactly one of these
  const round = (c: RGB): RGB => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
  const bands = CROWD_BANDS.map((c) => round(mix(rgb(c), team, TEAM_TINT))) as [RGB, RGB, RGB];
  // the home fleck dimmed a little so it sits in the stands, not on them
  return { bands, team: round(mix(team, bands[0], 0.2)), white: WHITE };
}

/**
 * The crowd's colour at texel (x, y) of a stand in band `band`: the band, or a 2 px fleck of the home
 * colour or white. `seed` keeps two stands from showing the same pattern. Steady: the same texel is
 * always the same colour (the crowd is baked into the venue's textures).
 */
export function crowdAt(p: CrowdPalette, x: number, y: number, band: Band, seed = 0): RGB {
  const n = noise(Math.floor(x / FLECK), Math.floor(y / FLECK), 97 + seed);
  if (n < CROWD_TEAM_SHARE) return p.team;
  if (n < CROWD_TEAM_SHARE + CROWD_WHITE_SHARE) return p.white;
  return p.bands[band];
}

/** What can excite the crowd (V2 C.2: a score, ON FIRE, a Clutch moment). */
export type Excite = 'score' | 'onfire' | 'clutch';

/**
 * The crowd reacts to `kind` at render time `t` (seconds). Safe to call from any renderer now; it does
 * nothing yet (players-9 animates the front rows), so wiring it early changes no frame.
 */
export function excite(kind: Excite, t: number): void {
  void kind;
  void t;
}

/** The crowd API the sport teams call (`crowd.excite('score', t)`). */
export const crowd = { excite };
