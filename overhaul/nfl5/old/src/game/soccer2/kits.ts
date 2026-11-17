// Soccer v2: what each side wears. Implemented by Claude (Anthropic), 2026-11-01. Club identity
// colors only (no crests, no real kits): the home set in the club's first color, an away set in
// its second (or white) when the two first colors clash on the pitch (uniforms.ts' clash test),
// and each keeper in a color neither outfield set nor the other keeper wears.
import { luma, rgb } from '../pixel/color';
import type { PitchTheme } from '../pixel/pitch';
import { colorDistance, colorsClash } from '../uniforms';
import type { SoccerKit } from './render';

export interface ClubColors {
  c1: string;
  c2: string;
}

const WHITE = '#f4f4f0';
const BLACK_SHOE = '#16161c';
const KEEPER = ['#b6f23a', '#ff8a1f', '#2fd4f0', '#ff5fa8', '#1d1f26', '#f2e43a'];

const light = (c: string) => luma(rgb(c)) > 200;

export function homeKit(t: ClubColors): SoccerKit {
  return { jersey: t.c1, trim: t.c2, shorts: light(t.c2) ? t.c2 : t.c1, socks: t.c1, shoes: BLACK_SHOE };
}

export function awayKit(t: ClubColors): SoccerKit {
  // the second color as the shirt, unless it's too close to the first; then white (or dark on a white club)
  const shirt = colorDistance(t.c1, t.c2) > 160 ? t.c2 : light(t.c1) ? '#1d2230' : WHITE;
  return { jersey: shirt, trim: t.c1, shorts: shirt, socks: shirt, shoes: light(shirt) ? BLACK_SHOE : WHITE };
}

function keeperKit(avoid: string[]): SoccerKit {
  const c = KEEPER.find((k) => avoid.every((a) => !colorsClash(k, a))) ?? KEEPER[0];
  return { jersey: c, trim: '#16161c', shorts: c, socks: c, shoes: BLACK_SHOE, gloves: '#f2f2ee' };
}

export interface SoccerKits {
  us: SoccerKit;
  them: SoccerKit;
  usGk: SoccerKit;
  themGk: SoccerKit;
  /** the rival changed into the away set */
  rivalAway: boolean;
  /** the stadium: the rival's ground (you attack their goal, in front of their fans) */
  pitch: PitchTheme;
}

export function soccerKits(me: ClubColors, them: ClubColors): SoccerKits {
  const us = homeKit(me);
  const home = homeKit(them);
  const away = awayKit(them);
  const clash = colorsClash(me.c1, them.c1) || (me.c1 === them.c1 && me.c2 === them.c2);
  const rivalAway = clash && colorDistance(me.c1, away.jersey) > colorDistance(me.c1, home.jersey);
  const theirs = rivalAway ? away : home;
  const usGk = keeperKit([us.jersey, theirs.jersey]);
  const themGk = keeperKit([us.jersey, theirs.jersey, usGk.jersey]);
  return { us, them: theirs, usGk, themGk, rivalAway, pitch: { homeC1: them.c1, homeC2: them.c2, awayC1: me.c1 } };
}
