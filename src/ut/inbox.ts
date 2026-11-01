// Claude, 2026-11-01 (wave 2): the Rewards inbox on Home. Lists every reward ready to claim
// (Daily Drop, login calendar, daily objectives and their bonus, other objectives, Season Pass
// tiers, sets, the Standout objective, a finished Draft, finished Evolutions, the New Era bundle) and
// claims them all in one transaction with each reward's own exactly-once receipt. Packs and picks go
// to the Store's Your packs; the Daily Drop arrives there as a pack too. Unopened packs and open
// picks are counted so the badge shows everything waiting.
import { claimed, contentOf } from './content-state';
import { claimDaily, dailyPackId, dailyStatus } from './content-packs';
import { claimStandoutObjective, standoutObjectiveId, standoutWins } from './content-progress';
import { calendarStatus, claimCalendar, claimDailyBonus, dailyBonusReady } from './daily-hub';
import { claimDraft, draftOf } from './draft-mode';
import { claimEvo, readyEvos } from './evolutions';
import { claimNewEra, newEraReady } from './new-era';
import type { Pool } from './pool';
import { claimObjective, claimReadySeason, hqOf, objectiveDeck, SEASON_STEP, SEASON_TIERS } from './progression';
import { claimSet, setsFor } from './sets';
import { STANDOUT_OBJECTIVE_WINS } from './standouts';
import type { UtState } from './state';

export interface InboxItem {
  id: string;
  title: string;
  detail: string;
  /** claimed by CLAIM ALL; false: shown with a shortcut (packs to open) */
  claimable: boolean;
}

type Wallet = { coins: number; gifts?: string[]; ut: UtState };

function seasonsReady(ut: UtState): { period: string; n: number }[] {
  return Object.entries(hqOf(ut).seasons).flatMap(([period, s]) => {
    const n = Array.from({ length: SEASON_TIERS }, (_, i) => i + 1).filter((t) => s.xp >= t * SEASON_STEP && !s.claimed.includes(t)).length;
    return n ? [{ period, n }] : [];
  });
}

export function inboxItems(pool: Pool, p: Wallet, day: string, week: string): InboxItem[] {
  const ut = p.ut;
  const out: InboxItem[] = [];
  if (newEraReady(ut)) out.push({ id: 'new-era', title: 'New Era bundle', detail: 'Icon pick + coins', claimable: true });
  if (dailyStatus(ut, day).ready) out.push({ id: 'daily', title: 'Daily Drop', detail: 'Day ' + dailyStatus(ut, day).streak + ' of the streak', claimable: true });
  const cal = calendarStatus(ut, day);
  if (cal.ready) out.push({ id: 'calendar', title: 'Login calendar', detail: 'Day ' + cal.step + ' of 5', claimable: true });
  const objectives = objectiveDeck(ut, day).filter((o) => !o.claimed && o.progress >= o.target);
  if (objectives.length) out.push({ id: 'objectives', title: 'Objectives', detail: objectives.length + ' complete', claimable: true });
  if (dailyBonusReady(ut, day) || (objectives.some((o) => o.group === 'daily' && o.period === day) && !claimed(ut, 'daily-bonus:' + day) && objectiveDeck(ut, day).filter((o) => o.group === 'daily' && o.period === day).every((o) => o.claimed || o.progress >= o.target)))
    out.push({ id: 'daily-bonus', title: 'Daily objectives bonus', detail: 'All three done', claimable: true });
  const seasons = seasonsReady(ut).reduce((a, s) => a + s.n, 0);
  if (seasons) out.push({ id: 'season', title: 'Season Pass', detail: seasons + (seasons === 1 ? ' tier' : ' tiers') + ' unlocked', claimable: true });
  const sets = setsFor(pool, ut).filter((s) => !s.claimed && s.have >= s.need).length;
  if (sets) out.push({ id: 'sets', title: 'Set Collections', detail: sets + (sets === 1 ? ' set' : ' sets') + ' complete', claimable: true });
  if (standoutWins(ut, week) >= STANDOUT_OBJECTIVE_WINS && !claimed(ut, standoutObjectiveId(week))) out.push({ id: 'standout', title: 'Weekly Standouts objective', detail: 'Standout pick', claimable: true });
  if (draftOf(ut)?.done) out.push({ id: 'draft', title: 'UT Draft', detail: 'Run rewards', claimable: true });
  const evos = readyEvos(ut).length;
  if (evos) out.push({ id: 'evos', title: 'Evolutions', detail: evos + ' upgrade' + (evos === 1 ? '' : 's') + ' ready', claimable: true });
  const picks = contentOf(ut).picks?.length ?? 0;
  if (picks) out.push({ id: 'picks', title: 'Picks to choose', detail: picks + ' waiting in the Store', claimable: false });
  if (ut.packs.length) out.push({ id: 'packs', title: 'Packs to open', detail: ut.packs.length + ' waiting in the Store', claimable: false });
  return out;
}

/** Every claimable count for the badges. */
export function inboxCount(pool: Pool, p: Wallet, day: string, week: string): number {
  return inboxItems(pool, p, day, week).filter((i) => i.claimable).length;
}

/** CLAIM ALL: one transaction, each reward with its own receipt (re-running claims nothing more). */
export function claimAll<P extends Wallet>(pool: Pool, p: P, day: string, week: string, at: number): { profile: P; coins: number; claimed: number } {
  let cur: P = p;
  let n = 0;
  const coins0 = p.coins;
  const set = (ut: UtState, coins = 0) => {
    if (ut !== cur.ut || coins) n++;
    cur = { ...cur, ut, coins: cur.coins + coins };
  };
  if (newEraReady(cur.ut)) {
    const r = claimNewEra(cur, pool, at);
    if (r !== cur) n++;
    cur = r;
  }
  const d = claimDaily(cur.ut, day, at);
  if (d) {
    const id = dailyPackId(pool.sport, day);
    set(d.ut.packs.some((x) => x.id === id) ? d.ut : { ...d.ut, packs: [...d.ut.packs, { id, kind: 'daily', at }] });
  }
  const cal = claimCalendar(cur.ut, pool, day, at);
  if (cal) set(cal.ut, cal.coins);
  for (const o of objectiveDeck(cur.ut, day))
    if (!o.claimed && o.progress >= o.target) {
      const r = claimObjective(cur.ut, o.id, day, at);
      set(r.ut, r.coins);
    }
  const bonus = claimDailyBonus(cur.ut, pool.sport, day, at);
  if (bonus) set(bonus.ut, bonus.coins);
  for (const s of seasonsReady(cur.ut)) {
    const r = claimReadySeason(cur.ut, s.period, at);
    set(r.ut, r.coins);
  }
  for (const s of setsFor(pool, cur.ut).filter((x) => !x.claimed && x.have >= x.need)) {
    const r = claimSet(pool, cur.ut, s.id, at);
    set(r.ut, r.coins);
  }
  const so = claimStandoutObjective(cur.ut, pool, week, at);
  if (so !== cur.ut) set(so);
  if (draftOf(cur.ut)?.done) {
    const r = claimDraft(cur.ut, at);
    set(r.ut, r.coins);
  }
  for (const uid of readyEvos(cur.ut)) set(claimEvo(cur.ut, uid));
  return { profile: cur, coins: cur.coins - coins0, claimed: n };
}
