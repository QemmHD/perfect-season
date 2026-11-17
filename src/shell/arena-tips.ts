// Claude (studio overhaul, shell-6, 2026-11-16): one tip on the arena curtain while a match loads.
// Each tip names the game's own controls as they are on screen today (the button labels in Hoops2,
// Football2 and Soccer2). No other game's system names. When a sport team renames a control, the
// tip that names it changes with it: `arena-tips.test.ts` lists the labels each tip relies on.
import { hashString } from '../engine/rng';
import { pickFor, type SportId } from '../engine/sport';

export interface ArenaTip {
  /** the short heading, e.g. "SHOOTING" */
  head: string;
  text: string;
}

export const ARENA_TIPS: Record<SportId, ArenaTip[]> = {
  nba: [
    { head: 'SHOOTING', text: 'Hold SHOOT and let go in the green for a perfect release.' },
    { head: 'PASSING', text: 'Tap a teammate to pass him the ball.' },
    { head: 'SPEED', text: 'Push the stick to its edge to sprint past your man.' },
    { head: 'MOVES', text: 'CROSS, SPIN and STEP BACK shake a defender. Each move needs a moment to recharge.' },
    { head: 'SPACING', text: 'Watch the shot % over a teammate: pass to the open man.' },
  ],
  nfl: [
    { head: 'PASSING', text: 'Drag back anywhere and let go to throw. The arc shows who it’s going to.' },
    { head: 'THROWS', text: 'BULLET, TOUCH or LOB: pick how the ball travels before you let it go.' },
    { head: 'TARGETS', text: 'Tap a receiver under PASS TO to throw straight to him.' },
    { head: 'RUNNING', text: 'Drag to steer, then JUKE, SPIN or POWER as a tackler closes in.' },
    { head: 'SPEED', text: 'Hold BURST to sprint. It spends the same legs as your moves.' },
  ],
  soccer: [
    { head: 'SHOOTING', text: 'Hold SHOOT, drag to aim, and let go in the green.' },
    { head: 'PASSING', text: 'Tap PASS for a ball along the grass. Hold it to lob.' },
    { head: 'THROUGH BALLS', text: 'THRU plays the ball into space ahead of a runner.' },
    { head: 'SPEED', text: 'Hold SPRINT to run at a defender and past him.' },
    { head: 'AIMING', text: 'The stick runs your man and aims your pass and shot.' },
  ],
};

/**
 * The tip for this match: the same one for the same seed (a render-only choice; the seed is any
 * string that differs per match, never a game's RNG).
 */
export function arenaTip(sport: SportId, seed: string): ArenaTip {
  const list = pickFor(sport, ARENA_TIPS);
  return list[hashString('tip:' + seed) % list.length];
}
