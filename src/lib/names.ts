// Player names for the leaderboard and head-to-head: the rules, and a few random suggestions.
import { NFL } from '../engine/sport';

/** Why a name can't be used, or null when it's fine. */
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return 'Use at least 2 characters.';
  if (n.length > 16) return 'Use 16 characters or fewer.';
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._'-]*$/.test(n)) return 'Use letters, numbers, spaces and . _ ’ - only.';
  // 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, $→s, then letters only, so "Sh1t" and "s.h.i.t" are caught too
  const letters = n
    .toLowerCase()
    .replace(/[013457$]/g, (d) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', $: 's' })[d] as string)
    .replace(/[^a-z]/g, '');
  if (/(fuck|shit|cunt|nigg|faggot|bitch|whore|slut|nazi|hitler|porn|rape)/.test(letters)) return 'Pick a different name.';
  return null;
}

/** A clean name for display: names that break the rules show as "Player". */
export function displayName(name: unknown): string {
  return typeof name === 'string' && !nameProblem(name) ? name.trim() : 'Player';
}

const FIRST = NFL
  ? ['Clutch', 'Blitz', 'Gridiron', 'Endzone', 'Hailmary', 'Redzone', 'Shotgun', 'Pylon', 'Audible', 'Pocket', 'Fourth', 'Fast', 'Ice', 'Primetime', 'Twominute', 'Goalline', 'Spiral', 'Sack', 'Turf', 'Kickoff']
  : ['Clutch', 'Splash', 'Swish', 'Dunk', 'Fadeaway', 'Hoop', 'Buzzer', 'Triple', 'Fast', 'Ice', 'Showtime', 'Rim', 'Glass', 'Downtown', 'Posterize', 'Alley', 'Crossover', 'Baseline', 'Paint', 'Sixth'];
const SECOND = NFL
  ? ['King', 'Cobra', 'Wizard', 'Legend', 'Machine', 'Hawk', 'Dragon', 'Gunslinger', 'Boss', 'Phantom', 'Rocket', 'Titan', 'Ghost', 'Maestro', 'Jet', 'Bulldozer', 'Ace', 'Comet', 'Bandit', 'Express']
  : ['King', 'Cobra', 'Wizard', 'Legend', 'Machine', 'Hawk', 'Dragon', 'Mamba', 'Shooter', 'Boss', 'Phantom', 'Rocket', 'Titan', 'Ghost', 'Maestro', 'Jet', 'Vandal', 'Ace', 'Comet', 'Bandit'];

/** A suggestion in the sport's own slang. */
export function randomName(): string {
  const a = FIRST[Math.floor(Math.random() * FIRST.length)];
  const b = SECOND[Math.floor(Math.random() * SECOND.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return (a + b).length <= 13 ? a + b + n : a + b;
}
