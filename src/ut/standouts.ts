// Claude, 2026-11-01: Weekly Standouts (a team-of-the-week style promo, original name). Every Eastern
// ISO week the same 8 basketball / 15 football season cards for everyone, drawn from the gold band
// by the week's key, one of them the week's Featured Standout from the week's theme decade. They
// come from pack promo slots, the Standout Guarantee pack, the weekly "Standout Squad" SBC and the
// weekly objective (win 5 with 2+ Standouts in the squad). Owned copies keep their week forever.
import { hashString, rng, shuffle } from '../engine/rng';
import { standoutId, weekLabel } from './editions';
import type { Pool } from './pool';
import { onScale, TIER_CUTS } from './rate';
import type { Sbc } from './sbc';
import type { RatedCard, UtSport } from './types';

export const STANDOUT_COUNT: Record<UtSport, number> = { nba: 8, nfl: 15 };
/** football's fifteen by position: the skill spots and the defense's playmakers first */
const NFL_SPOTS = ['QB', 'RB', 'WR', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'LB', 'CB', 'S', 'K'];
const NBA_SPOTS = ['PG', 'SG', 'SF', 'PF', 'C', '*', '*', '*'];

export interface StandoutProgram {
  week: string;
  sport: UtSport;
  /** the theme decade the featured card comes from */
  decade: number;
  featured: RatedCard;
  /** every Standout of the week, featured first */
  cards: RatedCard[];
}

/** The base-overall band a Standout is drawn from (basketball's scale 70–86, never below gold). */
export function standoutBand(sport: UtSport): [number, number] {
  return [Math.max(onScale(70, sport), TIER_CUTS[sport].gold), onScale(86, sport)];
}

const cache = new WeakMap<Pool, Map<string, StandoutProgram>>();

/** The week's program. Deterministic from the sport, the week and the card pool. */
export function standoutProgram(pool: Pool, week: string): StandoutProgram {
  let byWeek = cache.get(pool);
  if (!byWeek) cache.set(pool, (byWeek = new Map()));
  const got = byWeek.get(week);
  if (got) return got;
  const sport = pool.sport;
  const rand = rng(hashString('ut-standout:' + sport + ':' + week));
  const [lo, hi] = standoutBand(sport);
  const cands: RatedCard[] = [];
  for (const rc of pool.base.values()) if (rc.line.kind === 'season' && !rc.line.sparse && rc.ovr >= lo && rc.ovr <= hi) cands.push(rc);
  cands.sort((a, b) => (a.line.id < b.line.id ? -1 : 1));
  const decades = [...new Set(cands.map((c) => Math.floor(c.line.season / 10) * 10))].sort((a, b) => a - b).filter((d) => cands.filter((c) => Math.floor(c.line.season / 10) * 10 === d).length >= 40);
  const decade = decades[Math.floor(rand() * decades.length)] ?? 2000;
  const used = new Set<string>();
  // the featured card: a top-band season from the theme decade
  const top = cands.filter((c) => Math.floor(c.line.season / 10) * 10 === decade && c.ovr >= hi - 3);
  const fpick = (top.length ? top : cands)[Math.floor(rand() * (top.length || cands.length))];
  used.add(fpick.line.pid);
  const ids: { line: RatedCard; featured: boolean }[] = [{ line: fpick, featured: true }];
  const spots = (sport === 'nba' ? NBA_SPOTS : NFL_SPOTS).slice();
  // the featured card fills its own position's spot
  const own = spots.indexOf(sport === 'nba' ? fpick.line.pos[0] : fpick.pos);
  spots.splice(own >= 0 ? own : spots.length - 1, 1);
  for (const spot of spots) {
    const list = shuffle(
      cands.filter((c) => !used.has(c.line.pid) && (spot === '*' || c.line.pos[0] === spot)),
      rand
    );
    const c = list[0];
    if (!c) continue;
    used.add(c.line.pid);
    ids.push({ line: c, featured: false });
  }
  const cards = ids.flatMap(({ line, featured }) => {
    const rc = pool.base.get(standoutId(week, featured, line.line));
    return rc ? [rc] : [];
  });
  const program: StandoutProgram = { week, sport, decade, featured: cards[0], cards };
  byWeek.set(week, program);
  return program;
}

/** One of the week's Standouts: featured with `featuredChance`, otherwise any of the others. */
export function drawStandout(pool: Pool, week: string, rand: () => number, featuredChance = 1 / STANDOUT_COUNT[pool.sport]): RatedCard | null {
  const p = standoutProgram(pool, week);
  if (!p.cards.length) return null;
  if (rand() < featuredChance || p.cards.length === 1) return p.cards[0];
  return p.cards[1 + Math.floor(rand() * (p.cards.length - 1))];
}

/** How many Standouts (any week) a squad fields. */
export function standoutsIn(cardIds: string[]): number {
  return cardIds.filter((id) => id.split(':')[1] === 'standout').length;
}

// ---------- the weekly SBC and objective ----------

export const STANDOUT_OBJECTIVE_WINS = 5;
export const STANDOUT_OBJECTIVE_NEED = 2;

/** The week's "Standout Squad" SBC: eight golds at a good team overall for a random current Standout. */
export function standoutSbc(pool: Pool, week: string): Sbc {
  return {
    id: 'so:' + week,
    kind: 'standout',
    title: 'Standout Squad · ' + weekLabel(week),
    blurb: 'Eight golds who can play. One of this week’s Standouts comes back.',
    size: 8,
    reqs: [
      { k: 'tier', tier: 'gold', n: 8 },
      { k: 'teamOvr', ovr: onScale(78, pool.sport) },
    ],
    reward: { standout: true },
  };
}

