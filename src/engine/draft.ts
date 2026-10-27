import { CELLS, CELL_BY_ID, primeVersion } from './data';
import { rateTeam } from './rating';
import { type Rand, hashString, pickOne, rng, shuffle } from './rng';
import { NFL } from './sport';
import { type Booster, type BotLevel, type Cell, type Lineup, type Mode, type Player, type Slot, SLOTS, emptyLineup } from './types';

/** Where a player goes first when he can play more than one spot (the FLEX fills last). */
export const SLOT_PREFERENCE: Slot[] = NFL ? ['QB', 'DL', 'LB', 'DB', 'TE', 'RB', 'WR', 'FLEX'] : ['C', 'PG', 'PF', 'SG', 'SF'];
/** Spots in a lineup, and so rounds in a draft. */
export const ROUNDS = SLOTS.length;

export interface DraftState {
  mode: Mode;
  botLevel: BotLevel;
  /** 1v1: the bot has the first pick of round 1 (a coin flip per match), then you alternate */
  botFirst: boolean;
  /** daily: shared cell order for everyone that day */
  order: string[] | null;
  ptr: number;
  lineup: Lineup;
  botLineup: Lineup;
  /** every cell shown this draft, so none repeats */
  used: string[];
  cellId: string | null;
  /** cells fully picked from (1v1 alternates who picks first by this count) */
  cellsDone: number;
  freeTeam: number;
  freeEra: number;
  picksLeft: number;
  youDone: boolean;
  botDone: boolean;
  /** players in the current cell taken by the bot */
  taken: string[];
  armed: Booster | null;
  /** primed versions of players in the current cell */
  primed: Record<string, Player>;
  boostersUsed: Booster[];
  /** every pick you made, as it was made: for the report card after the draft */
  log: PickLog[];
}

/** One pick: where it came from and what else could have gone there at that moment. */
export interface PickLog {
  round: number;
  cellId: string;
  /** the player as placed (primed when the Prime booster was used on him) */
  player: Player;
  slot: Slot;
  /** the spots it could have gone to: open ones, or with Trade the filled ones */
  open: Slot[];
  /** players the AI or the other player had already taken from this team */
  taken: string[];
  trade: boolean;
  /** the lineup just before the pick */
  before: Lineup;
}

export function newDraft(mode: Mode, botLevel: BotLevel, dailyKey: string | null, botFirst = false): DraftState {
  return {
    mode,
    botLevel,
    botFirst: mode === '1v1' && botFirst,
    order: mode === 'daily' && dailyKey ? dailyOrder(dailyKey) : null,
    ptr: 0,
    lineup: emptyLineup(),
    botLineup: emptyLineup(),
    used: [],
    cellId: null,
    cellsDone: 0,
    freeTeam: 1,
    freeEra: 1,
    picksLeft: 0,
    youDone: false,
    botDone: false,
    taken: [],
    armed: null,
    primed: {},
    boostersUsed: [],
    log: [],
  };
}

export function dailyOrder(dailyKey: string): string[] {
  return shuffle(CELLS.map((c) => c.id), rng(hashString('perfect-season-daily:' + dailyKey)));
}

export function filledCount(l: Lineup): number {
  return SLOTS.filter((s) => l[s]).length;
}

export function openSlots(l: Lineup): Slot[] {
  return SLOTS.filter((s) => !l[s]);
}

export function currentCell(s: DraftState): Cell | null {
  return s.cellId ? CELL_BY_ID[s.cellId] : null;
}

export function botPicksFirst(s: DraftState): boolean {
  // botDone is already true when the bot picked this round before you got a no-fit respin
  return s.mode === '1v1' && s.cellsDone % 2 === (s.botFirst ? 0 : 1) && !s.botDone;
}

export function isDraftComplete(s: DraftState): boolean {
  if (filledCount(s.lineup) < ROUNDS) return false;
  if (s.mode === '1v1') return filledCount(s.botLineup) === ROUNDS && s.cellId === null;
  return s.cellId === null;
}

/** The version of a player the user would draft right now (primed if the Prime booster was used on him). */
export function effectivePlayer(s: DraftState, p: Player): Player {
  return s.primed[p.id] ?? p;
}

export type Unavailable = 'taken' | 'dup' | 'nofit' | null;

export function whyUnavailable(s: DraftState, p: Player): Unavailable {
  if (s.taken.includes(p.id)) return 'taken';
  const held = SLOTS.filter((k) => s.lineup[k]?.pid === p.pid);
  // Trade lets you replace a slot, but you still can't hold the same person twice. A football
  // trade that can only replace him with another decade's line of his (Reggie White's 1990s
  // Packers for his 1980s Eagles) is fine.
  const upgrade = NFL && s.armed === 'trade' && held.every((k) => s.lineup[k]!.id !== p.id) && eligibleSlots(s, p).every((k) => held.includes(k));
  if (held.length && !upgrade) return 'dup';
  const targets = s.armed === 'trade' ? SLOTS.filter((x) => s.lineup[x]) : openSlots(s.lineup);
  if (!p.pos.some((x) => targets.includes(x))) return 'nofit';
  return null;
}

export function eligibleSlots(s: DraftState, p: Player): Slot[] {
  if (s.armed === 'trade') return SLOTS.filter((x) => s.lineup[x] && p.pos.includes(x));
  return openSlots(s.lineup).filter((x) => p.pos.includes(x));
}

export function noOneFits(s: DraftState): boolean {
  const cell = currentCell(s);
  if (!cell || s.youDone) return false;
  return cell.players.every((p) => whyUnavailable(s, p) !== null);
}

export type SpinKind = 'spin' | 'team' | 'era' | 'nofit';

/** Choose the next team-decade. Random by franchise then decade, never repeating within a draft. */
export function nextCell(s: DraftState, kind: SpinKind, rand: Rand): { cellId: string; ptr: number } {
  const cur = currentCell(s);
  const blocked = new Set(s.used.concat(cur ? [cur.id] : []));
  if (s.order) {
    let ptr = s.ptr;
    while (ptr < s.order.length && blocked.has(s.order[ptr])) ptr++;
    return { cellId: s.order[Math.min(ptr, s.order.length - 1)], ptr: ptr + 1 };
  }
  let pool = CELLS.filter((c) => !blocked.has(c.id));
  if (kind === 'team' && cur) {
    const same = pool.filter((c) => c.era === cur.era && c.fr !== cur.fr);
    if (same.length) pool = same;
  }
  if (kind === 'era' && cur) {
    const same = pool.filter((c) => c.fr === cur.fr && c.era !== cur.era);
    if (same.length) pool = same;
  }
  if (!pool.length) pool = CELLS.filter((c) => !cur || c.id !== cur.id);
  const franchises = Array.from(new Set(pool.map((c) => c.fr)));
  const fr = pickOne(franchises, rand);
  const cell = pickOne(pool.filter((c) => c.fr === fr), rand);
  return { cellId: cell.id, ptr: s.ptr };
}

export interface BotPick {
  slot: Slot;
  player: Player;
  /** the cell he came from: the round's cell, or the bot's own redraw when nobody there fit */
  cellId: string;
}

/** Bot's choice for its open slots, by its level. */
function botPickFrom(s: DraftState, cellId: string, excludeIds: string[], rand: Rand): BotPick | null {
  const cell = CELL_BY_ID[cellId];
  const open = openSlots(s.botLineup);
  const held = new Set(Object.values(s.botLineup).filter(Boolean).map((p) => (p as Player).pid));
  const cands = cell.players.filter((p) => !excludeIds.includes(p.id) && !held.has(p.pid) && p.pos.some((x) => open.includes(x))).sort((a, b) => b.val - a.val);
  if (!cands.length) return null;
  const mine = SLOTS.map((k) => s.botLineup[k]);
  const gain = (p: Player) => rateTeam(mine.concat([p])).rating;
  const top = cands.slice(0, 8).sort((a, b) => gain(b) - gain(a));
  let player: Player;
  if (s.botLevel === 'rookie') {
    // one of the three best on paper, by raw value
    player = cands[Math.floor(rand() * Math.min(3, cands.length))];
  } else if (s.botLevel === 'pro') {
    // the best fit for its team, balance included; now and then the next best
    player = top.length > 1 && rand() < 0.25 ? top[1] : top[0];
  } else {
    // Legend: the best fit for its team; when it picks first in a round it also weighs
    // how much each player would have helped you, and takes him away
    const deny = cellId === s.cellId && !s.youDone ? (p: Player) => yourBestGain(s, cellId, p.id) : () => 0;
    const base = yourBestGain(s, cellId, null);
    player = top.reduce((best, p) => (gain(p) + 0.6 * (base - deny(p)) > gain(best) + 0.6 * (base - deny(best)) ? p : best), top[0]);
  }
  const slot = SLOT_PREFERENCE.find((x) => open.includes(x) && player.pos.includes(x))!;
  return { slot, player, cellId };
}

/** How much the best available player in a cell would raise your team score, without `skipId`. */
function yourBestGain(s: DraftState, cellId: string, skipId: string | null): number {
  const open = openSlots(s.lineup);
  if (!open.length) return 0;
  const yours = SLOTS.map((k) => s.lineup[k]);
  const now = rateTeam(yours).rating;
  const held = new Set(yours.filter(Boolean).map((p) => (p as Player).pid));
  let best = 0;
  for (const p of CELL_BY_ID[cellId].players.slice(0, 12)) {
    if (p.id === skipId || held.has(p.pid) || !p.pos.some((x) => open.includes(x))) continue;
    best = Math.max(best, rateTeam(yours.concat([p])).rating - now);
  }
  return best;
}

/**
 * The bot's pick for this round. Like you, it can only place players at positions
 * they played; when nobody in the round's team fits its open spots, it gets a free
 * redraw of its own (an unused team-decade), just as you get a free respin.
 */
export function botChoose(s: DraftState, cellId: string, excludeIds: string[], rand: Rand): BotPick | null {
  if (!openSlots(s.botLineup).length) return null;
  const here = botPickFrom(s, cellId, excludeIds, rand);
  if (here) return here;
  const blocked = new Set(s.used.concat([cellId]));
  for (const c of shuffle(CELLS.filter((x) => !blocked.has(x.id)), rand)) {
    const pick = botPickFrom(s, c.id, [], rand);
    if (pick) return pick;
  }
  return null;
}

export type DraftAction =
  | { type: 'land'; cellId: string; ptr: number; keepBot?: boolean }
  | { type: 'respin'; kind: 'team' | 'era' | 'nofit'; paid: boolean }
  | { type: 'arm'; booster: Booster | null }
  | { type: 'prime'; playerId: string }
  | { type: 'place'; playerId: string; slot: Slot }
  | { type: 'move'; from: Slot; to: Slot }
  | { type: 'bot'; playerId: string; slot: Slot; cellId?: string }
  | { type: 'endCell' };

export function draftReducer(s: DraftState, a: DraftAction): DraftState {
  switch (a.type) {
    case 'land': {
      const used = s.cellId ? s.used.concat([s.cellId]) : s.used;
      // keepBot: a no-fit respin in 1v1 after the bot already picked this round
      const botDone = s.mode !== '1v1' || (!!a.keepBot && s.botDone);
      return { ...s, used, cellId: a.cellId, ptr: a.ptr, picksLeft: 1, youDone: false, botDone, taken: [], armed: null, primed: {} };
    }
    case 'respin': {
      if (a.kind === 'team' && !a.paid) return { ...s, freeTeam: Math.max(0, s.freeTeam - 1) };
      if (a.kind === 'era' && !a.paid) return { ...s, freeEra: Math.max(0, s.freeEra - 1) };
      return s;
    }
    case 'arm': {
      if (a.booster === 'double') return { ...s, armed: 'double', picksLeft: 2 };
      if (a.booster === null && s.armed === 'double') return { ...s, armed: null, picksLeft: 1 };
      return { ...s, armed: a.booster };
    }
    case 'prime': {
      const cell = currentCell(s);
      const p = cell?.players.find((x) => x.id === a.playerId);
      const up = p ? primeVersion(p) : null;
      if (!up) return s;
      return { ...s, primed: { ...s.primed, [up.id]: up }, armed: null, boostersUsed: s.boostersUsed.concat(['prime']) };
    }
    case 'place': {
      const cell = currentCell(s);
      const base = cell?.players.find((x) => x.id === a.playerId);
      if (!cell || !base || s.youDone) return s;
      const p = effectivePlayer(s, base);
      if (!p.pos.includes(a.slot)) return s;
      const trading = s.armed === 'trade';
      if (trading ? !s.lineup[a.slot] : !!s.lineup[a.slot]) return s;
      const lineup = { ...s.lineup, [a.slot]: p };
      const entry: PickLog = { round: s.cellsDone, cellId: cell.id, player: p, slot: a.slot, open: trading ? SLOTS.filter((x) => s.lineup[x]) : openSlots(s.lineup), taken: s.taken, trade: trading, before: s.lineup };
      const boostersUsed = trading ? s.boostersUsed.concat(['trade']) : s.armed === 'double' && s.picksLeft === 2 ? s.boostersUsed.concat(['double']) : s.boostersUsed;
      const picksLeft = s.picksLeft - 1;
      const done = picksLeft <= 0 || filledCount(lineup) === ROUNDS;
      return { ...s, lineup, picksLeft: Math.max(0, picksLeft), youDone: done, armed: done ? null : s.armed === 'trade' ? null : s.armed, boostersUsed, log: (s.log ?? []).concat([entry]) };
    }
    case 'move': {
      const mover = s.lineup[a.from];
      const other = s.lineup[a.to];
      if (!mover || !mover.pos.includes(a.to)) return s;
      if (other && !other.pos.includes(a.from)) return s;
      return { ...s, lineup: { ...s.lineup, [a.to]: mover, [a.from]: other } };
    }
    case 'bot': {
      const fromCell = a.cellId ?? s.cellId;
      const p = fromCell ? CELL_BY_ID[fromCell]?.players.find((x) => x.id === a.playerId) : undefined;
      const held = SLOTS.map((k) => s.botLineup[k]).filter(Boolean) as Player[];
      // one pick per round: a late duplicate (the AI and a real pick racing) is ignored
      if (!p || s.botDone || held.length >= ROUNDS || held.some((x) => x.pid === p.pid)) return s;
      let botLineup: Lineup;
      if (!s.botLineup[a.slot] && p.pos.includes(a.slot)) botLineup = { ...s.botLineup, [a.slot]: p };
      else {
        // the other player moved people around on their phone: find seats that work
        const seated = assignSlots(held.concat([p]), { ...Object.fromEntries(SLOTS.filter((k) => s.botLineup[k]).map((k) => [k, s.botLineup[k]!.id])), [a.slot]: p.id });
        if (!seated) return s;
        botLineup = seated;
      }
      const ownRedraw = fromCell !== s.cellId;
      // a redrawn team-decade counts as used, so neither of you sees it again
      const used = ownRedraw && fromCell ? s.used.concat([fromCell]) : s.used;
      return { ...s, used, botLineup, taken: ownRedraw ? s.taken : s.taken.concat([p.id]), botDone: true };
    }
    case 'endCell': {
      if (!s.cellId) return s;
      return { ...s, used: s.used.concat([s.cellId]), cellId: null, cellsDone: s.cellsDone + 1, picksLeft: 0, armed: null, primed: {}, taken: [] };
    }
  }
}

/**
 * Seat players at positions they played, keeping `prefer` where it works. Null when no
 * arrangement fits. (Team rating doesn't depend on who plays where, only on who's on the team.)
 */
export function assignSlots(players: Player[], prefer: Partial<Record<Slot, string>> = {}): Lineup | null {
  const out = emptyLineup();
  const rest: Player[] = [];
  for (const p of players) {
    const want = SLOTS.find((k) => prefer[k] === p.id);
    if (want && !out[want] && p.pos.includes(want)) out[want] = p;
    else rest.push(p);
  }
  const place = (i: number): boolean => {
    if (i >= rest.length) return true;
    for (const k of SLOT_PREFERENCE) {
      if (out[k] || !rest[i].pos.includes(k)) continue;
      out[k] = rest[i];
      if (place(i + 1)) return true;
      out[k] = null;
    }
    return false;
  };
  if (place(0)) return out;
  // the preferred seats themselves block a fit: try again from scratch
  if (Object.keys(prefer).length) return assignSlots(players, {});
  return null;
}

export function canMove(l: Lineup, from: Slot, to: Slot): boolean {
  const mover = l[from];
  const other = l[to];
  if (!mover || from === to || !mover.pos.includes(to)) return false;
  return !other || other.pos.includes(from);
}
