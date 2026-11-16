// What the arcade games know about a player beyond his card: his size, his number, and the splits
// that shape how he plays (a shooter's three-point percentage, a quarterback's completions).
// Built by scripts/build_game_attrs.py into src/data/<sport>-attrs.json, one entry per line
// (`cellId:pid`), and loaded only when a game starts. Anything a source doesn't say is missing,
// and the games fall back to the player's main stats.
/// <reference types="vite/client" />
import { pick } from '../engine/sport';
import type { Player } from '../engine/types';

export interface Attrs {
  /** inches, pounds */
  ht?: number | null;
  wt?: number | null;
  /** football: jersey number */
  num?: number | null;
  // basketball
  mpg?: number | null;
  fg2?: number | null;
  fg3?: number | null;
  a3?: number | null;
  ft?: number | null;
  fta?: number | null;
  orb?: number | null;
  drb?: number | null;
  tov?: number | null;
  dunk?: number | null;
  rim?: number | null;
  // football
  cmp?: number | null;
  ypa?: number | null;
  att?: number | null;
  intr?: number | null;
  sk?: number | null;
  ry?: number | null;
  ypc?: number | null;
  car?: number | null;
  rec?: number | null;
  ypr?: number | null;
  tgt?: number | null;
  cr?: number | null;
  // football defenders (DL, LB, DB), per game over the seasons whose source kept the stat:
  // nflverse's weekly stats from 1999, before that the player's Wikipedia career table (where it
  // has the column), so a line before the 1990s mostly has none
  /** sacks */
  sck?: number | null;
  /** interceptions */
  ints?: number | null;
  /** tackles (from 2020 the credited assists run higher) */
  tkl?: number | null;
  /** passes defended (rarely before 1999) */
  pd?: number | null;
  /** forced fumbles */
  ff?: number | null;
}

interface AttrsFile {
  fields: string[];
  lines: Record<string, (number | null)[]>;
}

// the files may not exist (an older build): a glob finds whatever is there
const FILES = import.meta.glob<{ default: AttrsFile }>('../data/*-attrs.json');

let cache: Promise<(p: Player) => Attrs | null> | null = null;

/**
 * A lookup from player to attributes; resolves to one that returns null when there's no file.
 * When the file exists but can't be downloaded (offline before it was cached, or a newer build
 * removed it), it also resolves to that null lookup, unless `strict`: then it rejects, so a match
 * shows the recovery screen instead of playing without real ratings (shell-4). The failed promise
 * isn't kept here, but browsers (Chrome, Safari) keep a failed dynamic import in the page's module
 * map, so in the app a new try normally needs a page reload (the recovery card's RELOAD); within
 * the same page the next call usually fails again at once.
 */
export function loadAttrs(strict = false): Promise<(p: Player) => Attrs | null> {
  const load = (cache ??= (async () => {
    const key = Object.keys(FILES).find((k) => k.endsWith(pick({ nba: 'nba', nfl: 'nfl', soccer: 'soccer' }) + '-attrs.json'));
    if (!key) return () => null;
    const file = (await FILES[key]()).default;
    const memo = new Map<string, Attrs | null>();
    return (p: Player) => {
      if (memo.has(p.id)) return memo.get(p.id)!;
      const row = file.lines[p.id];
      let a: Attrs | null = null;
      if (row) {
        a = {};
        file.fields.forEach((f: string, i: number) => ((a as Record<string, number | null>)[f] = row[i] ?? null));
      }
      memo.set(p.id, a);
      return a;
    };
  })());
  return load.catch((e) => {
    if (cache === load) cache = null;
    if (strict) throw e;
    return () => null;
  });
}
