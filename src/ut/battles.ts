// Squad Battles: this week's ladder of AI squads, each built from real cards around a target
// overall, harder every rung. A rung is a franchise in a decade (the 1990s Bulls), its own cards
// first, then that decade's, then anyone's, picked to land near the target. The same ladder for
// everyone all week (from the week's key), different every week.
import { teamOf } from '../data/teams';
import { hashString, pickOne, rng } from '../engine/rng';
import { aiFavorite } from '../game/uniforms';
import { type Pool, ratedOf } from './pool';
import { onScale } from './rate';
import { canPlay, rateSquad, slotsFor } from './squad';
import type { UtState } from './state';
import type { SquadWire } from './teams';
import type { RatedCard, UtSport } from './types';

export const RUNGS = 8;
/**
 * Each rung's target team overall, on the sport's own scale: the first a little under a starter
 * pack's squad (basketball's rate about 68-75, football's about 80), the last an all-time team.
 */
const TARGETS: Record<UtSport, number[]> = { nba: [62, 66, 70, 74, 78, 82, 86, 90], nfl: [76, 79, 82, 85, 88, 90, 92, 94] };
/** how well the AI plays its own offense on each rung (0-1, the autopilot's skill) */
const SKILLS = [0.45, 0.5, 0.56, 0.62, 0.68, 0.74, 0.8, 0.87];

export interface Rung {
  i: number;
  /** "1990s Chicago Bulls" */
  title: string;
  fr: string;
  decade: number;
  target: number;
  /** the squad's team overall */
  ovr: number;
  squad: SquadWire;
  skill: number;
  /** the team it wears */
  fav: string;
  /** rewards for the first clear this week */
  pack: string | null;
}

/** First clears this week: a Silver pack at rung 4, a Gold pack at the top. */
export const RUNG_PACKS: Record<number, string> = { 3: 'silver', 7: 'gold' };

interface Theme {
  fr: string;
  decade: number;
  name: string;
  cards: RatedCard[];
}

/** franchise-decades with cards enough to fill a squad's starters */
function themes(pool: Pool): Theme[] {
  const by = new Map<string, Theme>();
  for (const rc of pool.base.values()) {
    const l = rc.line;
    if (l.kind !== 'season') continue;
    const decade = Math.floor(l.season / 10) * 10;
    const k = l.fr + ':' + decade;
    let t = by.get(k);
    if (!t) by.set(k, (t = { fr: l.fr, decade, name: l.teamName, cards: [] }));
    t.cards.push(rc);
    // the name the franchise went by most recently in that decade
    if (l.season >= decade && l.teamName) t.name = l.teamName;
  }
  const need = slotsFor(pool.sport).length;
  return Array.from(by.values())
    .filter((t) => t.cards.length >= need * 1.5)
    .sort((a, b) => (a.fr + a.decade < b.fr + b.decade ? -1 : 1));
}

/** A squad for a theme, each spot the card nearest `aim` from the theme, then its decade, then anyone. */
export function buildSquad(pool: Pool, theme: Theme, aim: number, seed: string): SquadWire {
  const rand = rng(hashString(seed));
  const slots = slotsFor(pool.sport);
  const decadeCards = Array.from(pool.base.values()).filter((rc) => rc.line.kind === 'season' && Math.floor(rc.line.season / 10) * 10 === theme.decade);
  const all = Array.from(pool.base.values()).filter((rc) => rc.line.kind === 'season');
  const used = new Set<string>();
  const out: SquadWire = [];
  // the starters first (they make the overall), the bench after
  for (const sl of slots.slice().sort((a, b) => b.weight - a.weight)) {
    const want = sl.weight ? aim : aim - onScale(68, pool.sport) + onScale(62, pool.sport);
    let pick: RatedCard | null = null;
    for (const set of [theme.cards, decadeCards, all]) {
      let best: RatedCard | null = null;
      let bestD = Infinity;
      for (const rc of set) {
        if (used.has(rc.line.pid) || !canPlay(sl, rc)) continue;
        // ties broken by the seed, so equal cards vary from week to week
        const d = Math.abs(rc.ovr - want) + rand() * 0.5;
        if (d < bestD) {
          bestD = d;
          best = rc;
        }
      }
      if (best && (bestD <= 3.5 || set === all)) {
        pick = best;
        break;
      }
    }
    if (!pick) continue;
    used.add(pick.line.pid);
    out.push([sl.id, pick.line.id, 1]);
  }
  return out;
}

/** The squad's team overall, as the squad builder works it out. */
export function wireRating(pool: Pool, w: SquadWire): number {
  const lineup = Object.fromEntries(w.map(([slot, id, level]) => [slot, ratedOf(pool, { cardId: id, level })]));
  return rateSquad(pool.sport, lineup).ovr;
}

/** A themed AI squad around a target overall (this sport's scale). */
function themedAround(pool: Pool, all: Theme[], target: number, rand: () => number, seed: string, avoid: Set<string>, min = 0): { theme: Theme; squad: SquadWire; ovr: number } {
  // a theme with cards near this level: its best players should reach the target
  const fits = all.filter((th) => !avoid.has(th.fr + th.decade) && th.cards.filter((c) => c.ovr >= target).length >= 3);
  const theme = pickOne(fits.length ? fits : all, rand);
  // a themed squad's chemistry adds a little: aim its cards just under the target, then correct
  let aim = target - 1;
  let squad = buildSquad(pool, theme, aim, seed);
  let ovr = wireRating(pool, squad);
  // (and above `min`: a ladder's rungs only get harder)
  for (let k = 0; k < 5 && (Math.abs(ovr - target) > 1 || ovr < min); k++) {
    aim += ovr < min ? min - ovr : target - ovr;
    squad = buildSquad(pool, theme, aim, seed);
    ovr = wireRating(pool, squad);
  }
  return { theme, squad, ovr };
}

const favOf = (pool: Pool, fr: string, seed: string) => teamOf(pool.sport, fr)?.abbr ?? aiFavorite(seed, pool.sport);

/** This week's ladder. */
export function ladderFor(pool: Pool, week: string): Rung[] {
  const sport: UtSport = pool.sport;
  const rand = rng(hashString('ut-battles:' + sport + ':' + week));
  const all = themes(pool);
  const picked = new Set<string>();
  let prev = 0;
  return TARGETS[sport].map((target, i) => {
    const { theme, squad, ovr } = themedAround(pool, all, target, rand, week + ':' + i, picked, prev + 1);
    picked.add(theme.fr + theme.decade);
    prev = ovr;
    return { i, title: theme.decade + 's ' + theme.name, fr: theme.fr, decade: theme.decade, target, ovr, squad, skill: SKILLS[i], fav: favOf(pool, theme.fr, 'battle:' + week + ':' + i), pack: RUNG_PACKS[i] ?? null };
  });
}

/** The AI that steps in when no one online is near your squad: a themed squad at your overall. */
export function aiOpponent(pool: Pool, target: number, seed: string): Rung {
  const rand = rng(hashString('ut-ai:' + pool.sport + ':' + seed));
  const { theme, squad, ovr } = themedAround(pool, themes(pool), target, rand, 'ai:' + seed, new Set());
  return { i: -1, title: theme.decade + 's ' + theme.name, fr: theme.fr, decade: theme.decade, target, ovr, squad, skill: 0.68, fav: favOf(pool, theme.fr, 'ai:' + seed), pack: null };
}

const ladders = new Map<string, { pool: Pool; rungs: Rung[] }>();

/** The week's ladder, worked out once per pool and week (the ladder screen and the match share it). */
export function weekLadder(pool: Pool, week: string): Rung[] {
  const k = pool.sport + ':' + week;
  const got = ladders.get(k);
  if (got && got.pool === pool) return got.rungs;
  const rungs = ladderFor(pool, week);
  ladders.set(k, { pool, rungs });
  return rungs;
}

/** What the game calls a rung's team: "’90s Bulls". */
export function shortName(r: Pick<Rung, 'title' | 'decade'>): string {
  const nick = r.title.split(' ').pop() ?? r.title;
  return '’' + String(r.decade).slice(2) + 's ' + nick;
}

/** How hard a rung's AI plays, in words. */
export function skillName(skill: number): string {
  return skill < 0.53 ? 'Rookie' : skill < 0.65 ? 'Pro' : skill < 0.77 ? 'All-Star' : 'Legend';
}

/** This week's progress: a new week starts at the bottom (the best week stays). */
export function battlesThisWeek(b: UtState['battles'], week: string): UtState['battles'] {
  return b.week === week ? b : { week, cleared: 0, best: b.best };
}
