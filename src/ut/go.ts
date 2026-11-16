// Claude, 2026-11-16 (studio overhaul, team ut-1): where each unfinished goal is done, so every
// progress surface (Objectives, Daily, later Missions, Sets, Evolutions, the Home strip) can lead
// there in one tap instead of showing a dead "IN PROGRESS" chip (audit H5). Light: no pool.
//
// The ethics rule (research ultimate-team §7, V2 D.11): a goal that needs cards points to the ways of
// earning them first (an SBC, then the Scout Market's fixed prices, then a pick already owned) and to
// the Store's random packs only when nothing else gets there, and then the chip says the odds are
// shown there (`odds`).
import type { Counter } from './hq-state';
import { rememberSegment } from './nav';
import type { Objective } from './objectives';
import { rememberUtReturn } from './return-view';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { UtView } from './UltimateTeam';

export interface GoTarget {
  view: UtView;
  /** the chip's word: PLAY, OPEN, SBC… (≤ 8 letters) */
  label: string;
  /** the route is the Store's random packs: the chip says the odds are shown there */
  odds?: true;
}

/**
 * Where a counter moves. `ut` decides "open the packs you have" against "the Store". Null when no
 * screen of this sport moves it (soccer's Moments: see `goNote`), never a GO to a screen that can't.
 */
export function goForCounter(counter: Counter | 'collect', sport: UtSport, ut?: UtState): GoTarget | null {
  switch (counter) {
    case 'games':
    case 'wins':
    case 'points':
      return { view: 'battles', label: 'PLAY' };
    case 'onlineWins':
      return { view: 'rivals', label: 'RIVALS' };
    case 'packs':
      return ut?.packs.length ? { view: 'store', label: 'OPEN' } : { view: 'store', label: 'STORE', odds: true };
    case 'sbcs':
      return { view: 'sbc', label: 'SBC' };
    case 'moments':
      // soccer has no Moments, and only claiming a Moment (moments.ts claimMoment) moves this counter:
      // a GO anywhere would be a disguised dead end (audit H5), so soccer gets a note instead (goNote)
      return sport === 'soccer' ? null : { view: 'moments', label: 'PLAY' };
    case 'development':
      return { view: 'development', label: 'TRAIN' };
    case 'collect':
      return goForCards({ sbc: true });
  }
}

/** An objective's GO (null once it is complete or claimed: it shows CLAIM or CLAIMED instead). */
export function goForObjective(o: Objective, sport: UtSport, ut?: UtState): GoTarget | null {
  if (o.claimed || o.progress >= o.target) return null;
  return goForCounter(o.counter, sport, ut);
}

/**
 * A short, non-tappable note for an unfinished objective no screen of this sport can move (shown where
 * the GO would be, instead of a claim button). Display only: the objective's id and reward stay.
 */
export function goNote(o: Objective, sport: UtSport): string | null {
  if (o.claimed || o.progress >= o.target) return null;
  return o.counter === 'moments' && sport === 'soccer' ? 'Moments are in NBA and NFL' : null;
}

/** The ways a missing card can be earned, best first (the ethics rule above). */
export function goForCards(routes: { sbc?: boolean; market?: boolean; pick?: boolean }): GoTarget {
  if (routes.sbc) return { view: 'sbc', label: 'SBC' };
  if (routes.market) return { view: 'store', label: 'MARKET' };
  if (routes.pick) return { view: 'store', label: 'PICK' };
  return { view: 'store', label: 'STORE', odds: true };
}

/** Open Ultimate Team at `view` from outside it (the main app): UT opens where the task is done. */
export function openUtAt(view: UtView, open: () => void): void {
  rememberUtReturn(view);
  rememberSegment(view);
  open();
}
