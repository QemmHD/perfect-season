// The binder: every player you've drafted is a card you keep. Each team-decade has a core set,
// its best players (and in football its defense); finishing one pays out. Cosmetic: nothing here
// changes how a team is rated or ranked.
import { CELL_BY_ID, CELLS } from './data';
import { rarityOf } from './rarity';
import { NFL } from './sport';
import type { Cell, Player } from './types';

/** card id (a player's line on one team-decade) -> times drafted */
export type Collection = Record<string, number>;

/** coins for finishing a team-decade's core set */
export const SET_REWARD = 40;

/** A team-decade's core set: its five best players (football: its defense and five best). */
export function coreSet(cell: Cell): Player[] {
  const byVal = cell.players.slice().sort((a, b) => b.val - a.val);
  if (!NFL) return byVal.slice(0, 5);
  const def = byVal.find((p) => p.pos[0] === 'DEF');
  const rest = byVal.filter((p) => p.pos[0] !== 'DEF').slice(0, 5);
  return def ? [...rest, def] : rest;
}

export function setProgress(c: Collection, cell: Cell): { have: number; size: number; done: boolean } {
  const set = coreSet(cell);
  const have = set.filter((p) => (c[p.id] ?? 0) > 0).length;
  return { have, size: set.length, done: set.length > 0 && have === set.length };
}

/** Add a drafted team to the binder: the cards that are new, and the sets they finished. */
export function collect(c: Collection, players: Player[]): { next: Collection; fresh: string[]; sets: string[] } {
  const next = { ...c };
  const fresh: string[] = [];
  for (const p of players) {
    if (!next[p.id]) fresh.push(p.id);
    next[p.id] = (next[p.id] ?? 0) + 1;
  }
  const cells = [...new Set(players.map((p) => p.cellId))];
  const sets = cells.filter((id) => {
    const cell = CELL_BY_ID[id];
    return cell && !setProgress(c, cell).done && setProgress(next, cell).done;
  });
  return { next, fresh, sets };
}

export interface BinderSummary {
  cards: number;
  sets: number;
  totalSets: number;
  byRarity: Record<string, number>;
}

export function summarize(c: Collection): BinderSummary {
  const byRarity: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  let cards = 0;
  for (const id of Object.keys(c)) {
    const p = cardPlayer(id);
    if (!p || !c[id]) continue;
    cards++;
    byRarity[rarityOf(p)]++;
  }
  const sets = CELLS.filter((cell) => setProgress(c, cell).done).length;
  return { cards, sets, totalSets: CELLS.length, byRarity };
}

/** franchise -> its team-decades, oldest first */
export function franchises(): { fr: string; name: string; c1: string; c2: string; cells: Cell[] }[] {
  const by = new Map<string, Cell[]>();
  for (const c of CELLS) by.set(c.fr, [...(by.get(c.fr) ?? []), c]);
  return [...by.entries()].map(([fr, cells]) => {
    const sorted = cells.slice().sort((a, b) => a.from - b.from);
    const last = sorted[sorted.length - 1];
    return { fr, name: last.name, c1: last.c1, c2: last.c2, cells: sorted };
  });
}

/** A card id's player, if it still exists in the data. */
export function cardPlayer(id: string): Player | null {
  const cell = CELL_BY_ID[id.slice(0, id.indexOf(':'))];
  return cell?.players.find((p) => p.id === id) ?? null;
}
