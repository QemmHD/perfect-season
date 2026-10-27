// Full elevens from what was drafted. The draft gives a quarterback, a back, a receiver, a tight end
// and a flex (and the rival's defense); the rest of the field is filled with depth players rated
// to fit the team around them: a line, more receivers, the defenders the draft didn't name.
import { hashString, rng } from '../../engine/rng';
import type { Lineup, Player } from '../../engine/types';
import type { Attrs } from '../attrs';
import { rankOf } from '../football/model';
import { rateDraftLine } from './draftrate';
import { groupOf, rateNfl } from './ratings';
import type { Defense, FbPlayer, Offense } from './types';

function tagOf(name: string): string {
  const parts = name.replace(/ \(.*\)$/, '').split(' ');
  return (parts.slice(1).join(' ') || parts[0]).toUpperCase().slice(0, 12);
}

/** A drafted player, rated. */
export function fromDraft(p: Player, a: Attrs | null, pos?: string): FbPlayer {
  const pp = pos ?? (p.pos[0] === 'FLEX' ? 'WR' : p.pos[0]);
  const r = rateDraftLine(p, a, pp);
  return { id: p.id, name: p.name, tag: tagOf(p.name), num: a?.num ?? null, ht: a?.ht ?? 74, wt: a?.wt ?? 220, pos: pp, ovr: r.ovr, a: r.attrs, abil: r.abil };
}

const NUMS: Record<string, [number, number]> = {
  QB: [1, 19],
  RB: [20, 49],
  WR: [80, 89],
  TE: [80, 89],
  OT: [60, 79],
  OG: [60, 79],
  C: [50, 79],
  DE: [90, 99],
  DT: [90, 99],
  LB: [50, 59],
  CB: [20, 39],
  S: [20, 49],
  K: [1, 19],
};
const SIZES: Record<string, [number, number]> = {
  QB: [75, 222],
  RB: [71, 212],
  WR: [72, 196],
  TE: [77, 252],
  OT: [78, 315],
  OG: [76, 312],
  C: [75, 300],
  DE: [76, 270],
  DT: [75, 305],
  LB: [74, 240],
  CB: [71, 192],
  S: [72, 206],
  K: [72, 196],
};

/** A depth player at a position, rated around `level` (0-1, the team's standing). */
export function depth(pos: string, level: number, seed: string, slot: string): FbPlayer {
  const r = rng(hashString('depth:' + seed + ':' + slot));
  const [lo, hi] = NUMS[pos] ?? [10, 99];
  const [ht, wt] = SIZES[pos] ?? [74, 220];
  const h = ht + Math.round((r() - 0.5) * 3);
  const w = wt + Math.round((r() - 0.5) * 24);
  const rank = Math.max(0.05, Math.min(0.95, level + (r() - 0.5) * 0.25));
  const rating = rateNfl({ pos, ht: h, wt: w, rank, stats: {}, rk: {}, honors: [] });
  const num = lo + Math.floor(r() * (hi - lo + 1));
  // a fill-in has no name: his position and number stand for one
  return { id: 'depth:' + slot + ':' + seed, name: pos + ' #' + num, tag: pos + ' ' + num, num, ht: h, wt: w, pos, ovr: rating.ovr, a: rating.attrs, abil: rating.abil };
}

/**
 * Your offense: the drafted QB, RB, WR, TE and flex, a line and the other receivers as depth rated
 * to the team, and a kicker.
 */
export function offenseOf(lineup: Lineup, attrs: (p: Player) => Attrs | null, seed: string): Offense {
  const get = (s: string) => lineup[s as keyof Lineup] as Player | null | undefined;
  const qbP = get('QB');
  const rbP = get('RB');
  const wrP = get('WR');
  const teP = get('TE');
  const flexP = get('FLEX');
  const drafted = [qbP, rbP, wrP, teP, flexP].filter(Boolean) as Player[];
  const level = drafted.length ? drafted.reduce((s, p) => s + rankOf(p), 0) / drafted.length : 0.5;
  const qb = qbP ? fromDraft(qbP, attrs(qbP), 'QB') : depth('QB', level, seed, 'QB');
  const rb = rbP ? fromDraft(rbP, attrs(rbP), 'RB') : depth('RB', level, seed, 'RB');
  const x = wrP ? fromDraft(wrP, attrs(wrP), 'WR') : depth('WR', level, seed, 'WR1');
  const te = teP ? fromDraft(teP, attrs(teP), 'TE') : depth('TE', level, seed, 'TE');
  // the flex: a receiver lines up wide right; a back or tight end plays the slot
  const flex = flexP ? fromDraft(flexP, attrs(flexP), flexP.pos.includes('WR' as never) ? 'WR' : flexP.pos[0] === 'TE' ? 'TE' : 'RB') : depth('WR', level, seed, 'WR2');
  const z = flex.pos === 'WR' ? flex : depth('WR', level * 0.85, seed, 'WR2');
  const slot = flex.pos === 'WR' ? depth('WR', level * 0.8, seed, 'SLOT') : flex;
  const ol = (['LT', 'LG', 'C', 'RG', 'RT'] as const).map((s) => depth(s === 'C' ? 'C' : s.endsWith('T') ? 'OT' : 'OG', level * 0.9 + 0.05, seed, s)) as Offense['ol'];
  return { qb, rb, wr: [x, z, slot], te, ol, k: depth('K', 0.5 + level * 0.3, seed, 'K') };
}

/**
 * The rival's defense: drafted defenders where the draft has them (DL, LB, DB), the rest as depth
 * rated to that defense; a team-defense card (the older draft) sets the level for all eleven.
 */
export function defenseOf(lineup: Lineup, attrs: (p: Player) => Attrs | null, seed: string): Defense {
  const get = (s: string) => lineup[s as keyof Lineup] as Player | null | undefined;
  const dlP = get('DL');
  const lbP = get('LB');
  const dbP = get('DB');
  const teamDef = get('DEF');
  const named = [dlP, lbP, dbP].filter(Boolean) as Player[];
  const level = teamDef ? rankOf(teamDef) : named.length ? named.reduce((s, p) => s + rankOf(p), 0) / named.length : 0.5;
  const real = (p: Player | null | undefined, pos: string) => (p ? fromDraft(p, attrs(p), pos) : null);
  const dlPos = dlP ? (groupOf(dlP.pos[0]) === 'DL' ? 'DE' : 'DE') : 'DE';
  const dl: Defense['dl'] = [real(dlP, dlPos) ?? depth('DE', level, seed, 'LE'), depth('DT', level, seed, 'LDT'), depth('DT', level, seed, 'RDT'), depth('DE', level, seed, 'RE')];
  const lb: Defense['lb'] = [depth('LB', level, seed, 'WLB'), real(lbP, 'LB') ?? depth('LB', level, seed, 'MLB'), depth('LB', level, seed, 'SLB')];
  const dbIsS = dbP ? dbP.pos[0] === 'S' : false;
  const cb: Defense['cb'] = [!dbIsS ? (real(dbP, 'CB') ?? depth('CB', level, seed, 'CB1')) : depth('CB', level, seed, 'CB1'), depth('CB', level, seed, 'CB2')];
  const s: Defense['s'] = [dbIsS ? (real(dbP, 'S') ?? depth('S', level, seed, 'FS')) : depth('S', level, seed, 'FS'), depth('S', level, seed, 'SS')];
  return { dl, lb, cb, s };
}
