// A fingerprint of the player data and the scoring rules. Two phones only pair up for head to
// head when theirs match, and leaderboard entries carry it, so a data rebuild never leaves an
// old entry standing in the way of a new one.
import { CELLS } from './data';
import { BENCHMARK, W, WIN_CURVE } from './rating';
import { hashString } from './rng';

/** Bump when the rating formula changes in a way the constants below don't show. */
const RULES = 1;

export const DATA_V: string = (() => {
  let h = hashString(JSON.stringify([W, BENCHMARK, WIN_CURVE, RULES]));
  for (const c of CELLS) for (const p of c.players) h = Math.imul(h ^ hashString(p.id + ':' + Math.round(p.val * 100) + ':' + p.pos.join('')), 16777619) >>> 0;
  return h.toString(36);
})();
