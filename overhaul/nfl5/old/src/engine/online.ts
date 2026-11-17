// Rules for a head-to-head draft against a real player. Both phones derive the same five
// team-decades from the match seed, so only the picks travel over the network.
import { CELLS, CELL_BY_ID } from './data';
import { type DraftState, openSlots, ROUNDS, SLOT_PREFERENCE } from './draft';
import { rateTeam } from './rating';
import { hashString, rng, shuffle } from './rng';
import { type Player, type Slot, SLOTS } from './types';

/** Seconds each player gets to make a pick. */
export const SHOT_CLOCK = 25;

/** The match's cell order: the rounds use the first five (six in football); redraws come from further down. */
export function onlineOrder(seed: string): string[] {
  return shuffle(
    CELLS.map((c) => c.id),
    rng(hashString('perfect-season-h2h:' + seed))
  );
}

function fits(lineup: DraftState['lineup'], p: Player): boolean {
  const open = openSlots(lineup);
  const held = new Set(Object.values(lineup).filter(Boolean).map((x) => (x as Player).pid));
  return !held.has(p.pid) && p.pos.some((x) => open.includes(x));
}

/**
 * Your own redraw when nobody in the round's team fits: the next cell in your half of the
 * order (the host takes even positions from twice the round count on, the guest odd ones),
 * unused, with someone who fits. Never one of the round cells.
 */
export function redrawCell(s: DraftState, order: string[], host: boolean): string | null {
  const blocked = new Set(s.used.concat(s.cellId ? [s.cellId] : []).concat(order.slice(0, ROUNDS)));
  for (let i = 2 * ROUNDS + (host ? 0 : 1); i < order.length; i += 2) {
    const id = order[i];
    if (blocked.has(id)) continue;
    if (CELL_BY_ID[id].players.some((p) => fits(s.lineup, p))) return id;
  }
  return null;
}

/** The pick that raises your team the most from a cell (for when your shot clock runs out). */
export function bestPickFor(s: DraftState, cellId: string, exclude: string[]): { player: Player; slot: Slot } | null {
  const cell = CELL_BY_ID[cellId];
  if (!cell) return null;
  const mine = SLOTS.map((k) => s.lineup[k]);
  let best: { player: Player; slot: Slot; gain: number } | null = null;
  for (const p of cell.players) {
    if (exclude.includes(p.id) || !fits(s.lineup, p)) continue;
    const gain = rateTeam(mine.concat([p])).rating;
    if (!best || gain > best.gain) {
      const open = openSlots(s.lineup);
      const slot = SLOT_PREFERENCE.find((x) => open.includes(x) && p.pos.includes(x))!;
      best = { player: p, slot, gain };
    }
  }
  return best ? { player: best.player, slot: best.slot } : null;
}
