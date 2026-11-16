// Heat (plan §3.7 and §4.5, V2 B.0.2): one team bar per side that every sport fills by the same
// published rules. PERFECT skill moments, baskets, stops and clean possessions raise it; turnovers
// and conceding drain it. At 66 the side is HEATING UP; at 100 it is ON FIRE for its next few
// possessions (drives, attacks), which widens its gold windows by ×1.25 (through perfect.ts
// windowScale) and turns an uncontested amber ring gold. When the spell ends the bar returns to 0,
// and it resets to 0 at half-time.
//
// Deterministic and integer-only: both phones work out the same bars from the same marks, so the
// state is never saved and never sent. (hoops2/determinism.test.ts scans this file: no floats, no
// clocks, no randomness.)
import { pickFor, SPORT, type PerSport, type SportId } from '../engine/sport';

export type HeatEvent = 'perfect' | 'score' | 'stop' | 'clean' | 'turnover' | 'conceded';

export interface HeatState {
  /** 0..100 */
  v: number;
  /** units (possessions, drives, attacks) of On Fire left */
  fire: number;
  /** the highest the bar reached this match */
  peak: number;
  /** On Fire spells this match */
  fires: number;
}

export interface HeatRules {
  gain: Record<HeatEvent, number>;
  up: 66;
  fire: 100;
  /** how many units a spell lasts */
  spell: number;
  windowMult: 1.25;
}

/** A basket is worth more where baskets are rarer; a spell lasts as long as a few chances do. */
const SCORE: PerSport<number> = { nba: 10, nfl: 25, soccer: 40 };
const SPELL: PerSport<number> = { nba: 2, nfl: 3, soccer: 1 };

/** The published rules for a sport. */
export function heatRules(sport: SportId): HeatRules {
  return {
    gain: { perfect: 12, score: pickFor(sport, SCORE), stop: 15, clean: 5, turnover: -20, conceded: -10 },
    up: 66,
    fire: 100,
    spell: pickFor(sport, SPELL),
    windowMult: 1.25
  };
}

/** This page's sport's rules (the Help sheet prints them). */
export const HEAT: HeatRules = heatRules(SPORT);

export const heatStart: HeatState = Object.freeze({ v: 0, fire: 0, peak: 0, fires: 0 });

/** An integer in 0..100 whatever came in (a gain table is integers; this keeps the bar honest). */
const bar = (x: number) => (x < 0 ? 0 : x > 100 ? 100 : x | 0);

/**
 * The bar after an event. `extra` is an integer bonus on top of the published gain (a Heat Check
 * card's PERFECT: +4, so +16 in all). Reaching 100 starts a spell. While On Fire the bar stays full
 * and nothing changes but the peak.
 */
export function heatAfter(s: HeatState, ev: HeatEvent, sport: SportId, extra = 0): HeatState {
  if (s.fire > 0) return s;
  const r = heatRules(sport);
  const v = bar(s.v + r.gain[ev] + (extra | 0));
  const peak = v > s.peak ? v : s.peak;
  if (v >= r.fire) return { v: r.fire, fire: r.spell, peak, fires: s.fires + 1 };
  return { v, fire: 0, peak, fires: s.fires };
}

/** One unit (possession, drive, attack) played On Fire: at the last one the bar returns to 0. */
export function heatUnitEnd(s: HeatState): HeatState {
  if (s.fire <= 0) return s;
  const fire = s.fire - 1;
  return fire > 0 ? { ...s, fire } : { ...s, v: 0, fire: 0 };
}

/** Half-time: the bar and any spell reset; the peak and the spells are kept for the grade. */
export function heatHalf(s: HeatState): HeatState {
  return { v: 0, fire: 0, peak: s.peak, fires: s.fires };
}

export type HeatStage = 'cold' | 'heating' | 'fire';

export function heatStage(s: HeatState): HeatStage {
  return s.fire > 0 ? 'fire' : s.v >= 66 ? 'heating' : 'cold';
}

/** The WindowPart multiplier On Fire gives (perfect.ts windowScale). */
export const heatWindow = (s: HeatState): 1 | 1.25 => (s.fire > 0 ? 1.25 : 1);
