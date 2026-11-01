// Claude, 2026-11-01 (UI reorganisation): the one-line live status of every Ultimate Team mode, and
// the run to continue. Home's Continue card and the Play tab's rows read the same lines, so a mode
// says the same thing wherever it's shown. Read-only: nothing here changes state.
import { easternDateKey } from '../engine/season';
import { weekKey } from '../net/leaderboard';
import { battlesThisWeek, LEVEL_NAME, levelOf, RUNGS } from './battles';
import { circuitOf, CIRCUIT_ENTRIES, CIRCUIT_GAMES } from './circuit';
import { draftOf, tokenReady, DRAFT_GAMES } from './draft-mode';
import { eventsFor } from './events';
import { seasonGames } from './league';
import { momentsFor } from './moments';
import type { Pool } from './pool';
import { hqOf } from './progression';
import { DIVISIONS, divisionOf, rivalsOf } from './rivals';
import type { UtState } from './state';
import type { UtView } from './UltimateTeam';

export interface ModeStatus {
  view: UtView;
  /** the status line */
  line: string;
  /** a run is in progress */
  live?: boolean;
  /** something to claim or a free entry waiting */
  ready?: boolean;
}

export function playStatus(pool: Pool, ut: UtState, week: string): Record<'league' | 'battles' | 'circuit' | 'events' | 'moments' | 'draft' | 'rivals', ModeStatus> {
  const s = ut.league?.active;
  const leagueLive = !!s && s.phase !== 'complete';
  const me = s?.teams[0];
  const games = s ? me!.w + me!.l : 0;
  const league: ModeStatus = {
    view: 'league',
    live: leagueLive,
    line: !s
      ? 'Full ' + seasonGames(pool.sport) + '-game season · top 8 make the playoffs'
      : s.phase === 'complete'
        ? 'Season ' + s.number + ' complete · start the next one'
        : s.phase === 'playoffs'
          ? 'Season ' + s.number + ' playoffs · ' + me!.w + '–' + me!.l
          : 'Season ' + s.number + ' · ' + me!.w + '–' + me!.l + ' · game ' + (games + 1) + ' of ' + seasonGames(pool.sport),
  };
  const b = battlesThisWeek(ut.battles, week);
  const battles: ModeStatus = {
    view: 'battles',
    line: LEVEL_NAME[levelOf(b.level)] + ' ladder · ' + Math.min(b.cleared, RUNGS) + ' of ' + RUNGS + ' beaten this week',
  };
  const c = circuitOf(ut, week);
  const circuit: ModeStatus = c.active
    ? { view: 'circuit', live: true, line: 'Match ' + (c.active.games + 1) + ' of ' + CIRCUIT_GAMES + ' · ' + c.active.wins + (c.active.wins === 1 ? ' win' : ' wins') + ' so far' }
    : {
        view: 'circuit',
        ready: c.entries < CIRCUIT_ENTRIES,
        line: c.entries < CIRCUIT_ENTRIES ? CIRCUIT_ENTRIES - c.entries + ' free ' + (CIRCUIT_ENTRIES - c.entries === 1 ? 'entry' : 'entries') + ' left · best ' + c.best + ' wins' : 'Entries used · best ' + c.best + ' wins this week',
      };
  const evs = eventsFor(pool);
  const cleared = evs.reduce((n, e) => n + Math.min(3, ut.events?.[e.id] ?? 0), 0);
  const events: ModeStatus = { view: 'events', line: evs.length + ' series · ' + cleared + ' of ' + evs.length * 3 + ' stages cleared' };
  const ms = momentsFor(pool.sport);
  const h = hqOf(ut);
  const done = ms.filter((m) => h.moments[m.id]?.completedAt).length;
  const unclaimed = ms.filter((m) => h.moments[m.id]?.completedAt && !h.moments[m.id]?.claimed).length;
  const moments: ModeStatus = { view: 'moments', ready: unclaimed > 0, line: unclaimed ? unclaimed + ' reward' + (unclaimed === 1 ? '' : 's') + ' ready · ' + done + ' of ' + ms.length + ' cleared' : done + ' of ' + ms.length + ' cleared' };
  const run = draftOf(ut);
  const draft: ModeStatus = run
    ? { view: 'draft', live: !run.done, ready: !!run.done, line: run.done ? 'Run over · ' + run.wins + (run.wins === 1 ? ' win' : ' wins') + ' · claim rewards' : run.results.length ? run.results.length + ' played · ' + run.wins + ' wins · game ' + (run.results.length + 1) + ' of ' + DRAFT_GAMES : 'Drafting your squad' }
    : { view: 'draft', ready: tokenReady(ut, week), line: tokenReady(ut, week) ? 'Free weekly entry ready' : 'Draft a squad, win up to ' + DRAFT_GAMES + ' in a row' };
  const r = rivalsOf(ut.rivals, weekKey(easternDateKey()));
  const d = divisionOf(r.points);
  const ready = r.rewards.some((x) => !r.claimed.includes(x.id));
  const rivals: ModeStatus = { view: 'rivals', ready, line: DIVISIONS[d].name + ' · ' + r.points + ' RP · ' + r.w + 'W ' + r.l + 'L' + (ready ? ' · reward ready' : '') };
  return { league, battles, circuit, events, moments, draft, rivals };
}

/** The run to pick back up, most involved first: a Club Season, a Circuit entry, a UT Draft. */
export function continueRun(st: ReturnType<typeof playStatus>): ModeStatus | null {
  return [st.league, st.circuit, st.draft].find((m) => m.live) ?? null;
}

export const MODE_NAME: Record<string, string> = {
  league: 'Club Season',
  battles: 'Squad Battles',
  circuit: 'Champions Circuit',
  events: 'Legends Events',
  moments: 'Moments',
  draft: 'UT Draft',
  rivals: 'Rivals',
};
