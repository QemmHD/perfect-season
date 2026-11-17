import { pickFor } from '../engine/sport';
// Claude, 2026-11-01: UT Draft. Pay 800 coins (or the free weekly token), pick a captain from five,
// then one of five for every squad spot. The drafted squad (never owned: no card leaves or joins the
// club, no XP) plays up to four real matches through Match.tsx against a rising AI ladder; a loss
// ends the run. Rewards by wins are claimed once (`draft:<run id>`).
//
// Exactly-once guards (like Club Season): a match settles only for the active run, its current game
// index, and a match id not already in `ut.settled`.
import { packRand } from './packs';
import { aiOpponent, type Rung } from './battles';
import { contentOf, claimed, withClaim, type DraftRun } from './content-state';
import type { Pool } from './pool';
import { rareInfo } from './rare';
import { TIER_CUTS } from './rate';
import { fcToDisplay } from './fc-scale';
import { recordMatchProgress } from './progression';
import { canPlay, rateSquad, slotsFor, type SlotDef, type SquadRating } from './squad';
import { standoutProgram } from './standouts';
import type { UtState } from './state';
import type { SquadWire } from './teams';
import type { RatedCard, UtSport } from './types';

export const DRAFT_PRICE = 800;
export const DRAFT_GAMES = 4;
export const DRAFT_OPTIONS = 5;

/** What a run pays by its wins (claim once). */
export const DRAFT_REWARDS: { coins: number; pack?: string }[] = [
  { coins: 200 },
  { coins: 200, pack: 'silver' },
  { coins: 0, pack: 'gold' },
  { coins: 0, pack: 'premium' },
  { coins: 0, pack: 'elite' },
];

/** the AI each game: overall vs your draft (this sport's scale), and how well it plays */
const OFFSETS: Record<UtSport, number[]> = { nba: [-3, -1, 1, 3], nfl: [-2, -1, 1, 2], soccer: [-2, -1, 1, 2] };
const SKILL = [0.55, 0.62, 0.7, 0.78];

/** The spots a draft fills: basketball's five and the three who play off the bench; football's 23. */
export function draftSlots(sport: UtSport): SlotDef[] {
  return slotsFor(sport).filter((s) => sport !== 'nba' || s.unit === 'start' || ['B1', 'B2', 'B3'].includes(s.id));
}

export function draftOf(ut: UtState): DraftRun | undefined {
  return contentOf(ut).draft?.active;
}

export function tokenReady(ut: UtState, week: string): boolean {
  return contentOf(ut).draft?.tokenWeek !== week;
}

function withRun(ut: UtState, run: DraftRun | undefined, extra: Partial<NonNullable<ReturnType<typeof contentOf>['draft']>> = {}): UtState {
  const c = contentOf(ut);
  const d = { ...(c.draft ?? {}), ...extra };
  if (run) d.active = run;
  else delete d.active;
  return { ...ut, content: { ...c, draft: d } };
}

const byId = (a: RatedCard, b: RatedCard) => (a.line.id < b.line.id ? -1 : 1);

/** Five captains: legends and Hot Seasons, five different positions where it can. */
export function captainOptions(pool: Pool, id: string): RatedCard[] {
  const rand = packRand('draft-captain:' + id);
  const list = [...Object.values(pool.buckets.legend).flat(), ...Object.values(pool.buckets.promo).flat()].sort(byId);
  const out: RatedCard[] = [];
  const pids = new Set<string>();
  const pos = new Set<string>();
  for (let k = 0; out.length < DRAFT_OPTIONS && k < 400; k++) {
    const rc = list[Math.floor(rand() * list.length)];
    if (!rc || pids.has(rc.line.pid) || (k < 200 && pos.has(rc.line.pos[0]))) continue;
    pids.add(rc.line.pid);
    pos.add(rc.line.pos[0]);
    out.push(rc);
  }
  return out;
}

/** Five options for a spot: mostly golds, some rare golds, a few Standouts, Hot Seasons and Legends. */
export function slotOptions(pool: Pool, run: Pick<DraftRun, 'id' | 'week' | 'squad'>, slot: SlotDef): RatedCard[] {
  const rand = packRand('draft:' + run.id + ':' + slot.id);
  const taken = new Set(Object.values(run.squad).map((id) => pool.base.get(id)?.line.pid));
  const fits = (rc: RatedCard) => canPlay(slot, rc) && !taken.has(rc.line.pid);
  const rare = rareInfo(pool);
  const golds = Object.values(pool.buckets.gold).flat().filter(fits).sort(byId);
  const rares = Object.values(rare.buckets).flat().filter(fits).sort(byId);
  const special = [...Object.values(pool.buckets.promo).flat(), ...Object.values(pool.buckets.legend).flat(), ...standoutProgram(pool, run.week).cards].filter(fits).sort(byId);
  const silvers = Object.values(pool.buckets.silver).flat().filter(fits).sort(byId);
  const out: RatedCard[] = [];
  const pids = new Set<string>();
  for (let k = 0; out.length < DRAFT_OPTIONS && k < 200; k++) {
    const x = rand();
    const list = slot.weight === 0 && x < 0.25 && silvers.length ? silvers : x > 0.93 && special.length ? special : x > 0.68 && rares.length ? rares : golds.length ? golds : silvers;
    const rc = list[Math.floor(rand() * list.length)];
    if (!rc || pids.has(rc.line.pid)) continue;
    pids.add(rc.line.pid);
    out.push(rc);
  }
  return out;
}

/** The first spot still empty, in the order the sheet drafts them (football: offense, then defense). */
function nextSlot(sport: UtSport, squad: Record<string, string>): SlotDef | undefined {
  return draftSlots(sport).find((s) => !squad[s.id]);
}

function advance(pool: Pool, run: DraftRun): DraftRun {
  const sl = nextSlot(pool.sport, run.squad);
  const { pick: _, ...rest } = run;
  void _;
  return sl ? { ...rest, pick: { slot: sl.id, options: slotOptions(pool, run, sl).map((rc) => rc.line.id) } } : rest;
}

/** A new run (no run may be active). `paid`: coins (the caller charges DRAFT_PRICE) or this week's token. */
export function startDraft(ut: UtState, pool: Pool, id: string, at: number, week: string, paid: 'coins' | 'token'): UtState {
  if (draftOf(ut)) throw new Error('Finish your current draft first.');
  if (paid === 'token' && !tokenReady(ut, week)) throw new Error('This week’s free entry is used.');
  const run: DraftRun = { id, at, week, paid, captains: captainOptions(pool, id).map((rc) => rc.line.id), squad: {}, games: 0, wins: 0, results: [], done: false };
  return withRun(ut, run, paid === 'token' ? { tokenWeek: week } : {});
}

/** Pick the captain: he takes a spot he plays, then the first spot's options come up. */
export function chooseCaptain(ut: UtState, pool: Pool, index: number): UtState {
  const run = draftOf(ut);
  if (!run || Object.keys(run.squad).length || !run.captains[index]) return ut;
  const rc = pool.base.get(run.captains[index]);
  if (!rc) return ut;
  const slot = draftSlots(pool.sport).find((s) => s.pos === rc.line.pos[0]) ?? draftSlots(pool.sport).find((s) => canPlay(s, rc));
  if (!slot) return ut;
  return withRun(ut, advance(pool, { ...run, squad: { [slot.id]: rc.line.id } }));
}

/** Draft option `index` into the spot being picked. */
export function draftPick(ut: UtState, pool: Pool, index: number): UtState {
  const run = draftOf(ut);
  const id = run?.pick?.options[index];
  if (!run || !run.pick || !id || run.squad[run.pick.slot]) return ut;
  return withRun(ut, advance(pool, { ...run, squad: { ...run.squad, [run.pick.slot]: id } }));
}

/** Fill every remaining spot with its best option (by overall). */
export function autoDraft(ut: UtState, pool: Pool): UtState {
  let next = ut;
  for (let k = 0; k < 30; k++) {
    const run = draftOf(next);
    if (!run?.pick) break;
    const opts = run.pick.options.map((id, i) => ({ i, ovr: pool.base.get(id)?.ovr ?? 0 }));
    const best = opts.sort((a, b) => b.ovr - a.ovr)[0];
    next = draftPick(next, pool, best?.i ?? 0);
  }
  return next;
}

export const draftComplete = (sport: UtSport, run: DraftRun | undefined) => !!run && !run.pick && draftSlots(sport).every((s) => !!run.squad[s.id]);

export function draftWire(run: DraftRun): SquadWire {
  return Object.entries(run.squad)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([slot, id]) => [slot, id, 1]);
}

export function draftRating(pool: Pool, run: DraftRun): SquadRating {
  return rateSquad(pool.sport, Object.fromEntries(Object.entries(run.squad).map(([s, id]) => [s, pool.base.get(id) ?? null])));
}

/** Game `game`'s AI squad (deterministic from the run). */
export function draftRung(pool: Pool, run: DraftRun, game: number): Rung | null {
  if (game < 0 || game >= DRAFT_GAMES) return null;
  const target = Math.max(TIER_CUTS[pool.sport].silver, Math.min(pickFor(pool.sport, { nba: 97, nfl: 98, soccer: 92 }), draftRating(pool, run).ovr + OFFSETS[pool.sport][game]));
  const r = aiOpponent(pool, target, 'draft:' + run.id + ':' + game);
  return { ...r, i: -5, skill: SKILL[game], pack: null };
}

/** A draft match's result on the run: once per match id, only for the active run's current game. */
export function settleDraft(
  ut: UtState,
  r: { runId: string; game: number; won: boolean; us: number; them: number; matchId: string; at: number; day: string; how: 'played' | 'sim'; opponent: string }
): { ut: UtState; ok: boolean; sp: number } {
  const run = draftOf(ut);
  if (!run || run.id !== r.runId || run.done || run.games !== r.game || r.game >= DRAFT_GAMES || ut.settled?.includes(r.matchId) || !draftComplete(sameSportOf(run), run)) return { ut, ok: false, sp: 0 };
  const results = [...run.results, r.won];
  const wins = results.filter(Boolean).length;
  const done = !r.won || wins >= DRAFT_GAMES;
  let next: UtState = withRun(
    {
      ...ut,
      settled: [...(ut.settled ?? []), r.matchId].slice(-1000),
      record: { ...ut.record, w: ut.record.w + (r.won ? 1 : 0), l: ut.record.l + (r.won ? 0 : 1) },
    },
    { ...run, results, games: results.length, wins, done }
  );
  const p = recordMatchProgress(next, { id: r.matchId, at: r.at, mode: 'draft', won: r.won, us: r.us, them: r.them, opponent: r.opponent, coins: 0, xp: 0, day: r.day, how: r.how, played: [] });
  next = p.ut;
  return { ut: next, ok: true, sp: p.sp };
}

/** settleDraft's sport check reads it off the squad's card ids. */
function sameSportOf(run: DraftRun): UtSport {
  return (Object.values(run.squad)[0]?.split(':')[0] as UtSport) ?? 'nba';
}

/** End a run early: it is scored on the wins so far. */
export function retireDraft(ut: UtState): UtState {
  const run = draftOf(ut);
  if (!run || run.done) return ut;
  return withRun(ut, { ...run, done: true });
}

/** Claim a finished run's rewards once; the run moves to history. */
export function claimDraft(ut: UtState, at: number): { ut: UtState; coins: number; pack: string | null; wins: number } {
  const run = draftOf(ut);
  if (!run || !run.done || claimed(ut, 'draft:' + run.id)) return { ut, coins: 0, pack: null, wins: 0 };
  const reward = DRAFT_REWARDS[Math.min(DRAFT_GAMES, run.wins)];
  const packId = 'draft:' + run.id;
  const history = [...(contentOf(ut).draft?.history ?? []), { id: run.id, wins: run.wins, at }].slice(-10);
  let next = withRun(withClaim(ut, 'draft:' + run.id), undefined, { history });
  if (reward.pack && !next.packs.some((p) => p.id === packId)) next = { ...next, packs: [...next.packs, { id: packId, kind: reward.pack, at }] };
  return { ut: next, coins: reward.coins, pack: reward.pack ?? null, wins: run.wins };
}

/** an 84+ (FC scale) draft option gets a glow */
export const draftStar = (sport: UtSport) => fcToDisplay(84, sport);
