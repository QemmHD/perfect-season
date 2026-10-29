import manifest from '../data/special-editions.json';
import type { CardLine, UtSport } from './types';

/** Stable editions: rebuilding the client never renames an owned card. */
export const GOAT_NAMES: Record<UtSport, readonly string[]> = {
  nba: [
    'Michael Jordan',
    'LeBron James',
    'Kobe Bryant',
    'Scottie Pippen',
    'Shaquille O’Neal',
    'Kareem Abdul-Jabbar',
    'Magic Johnson',
    'Larry Bird',
    'Wilt Chamberlain',
    'Bill Russell',
    'Hakeem Olajuwon',
    'Tim Duncan',
    'Stephen Curry',
    'Kevin Durant',
    'Kevin Garnett',
    'Dwyane Wade',
    'Dirk Nowitzki',
    'Oscar Robertson',
    'Jerry West',
    'Giannis Antetokounmpo',
  ],
  nfl: [
    'Tom Brady',
    'Jerry Rice',
    'Lawrence Taylor',
    'Barry Sanders',
    'Walter Payton',
    'Joe Montana',
    'Peyton Manning',
    'Randy Moss',
    'Reggie White',
    'Deion Sanders',
    'Ray Lewis',
    'Ed Reed',
    'Tony Gonzalez',
    'Rob Gronkowski',
    'Bruce Smith',
    'Ronnie Lott',
    'Aaron Donald',
    'Patrick Mahomes',
    'Emmitt Smith',
    'Drew Brees',
  ],
};
/** Implemented by Codex. Frozen IDs are independent of future all-time legend selections.
 * Never remove/rename released manifest entries. Add new editions alongside them. */
export function specialEditions(seasons: CardLine[]): CardLine[] {
  const byId = new Map(seasons.map((line) => [line.id, line]));
  return manifest.flatMap((entry) => {
    const base = byId.get(entry.seasonId);
    if (!base) return [];
    const kind = entry.kind as 'spotlight' | 'goat';
    return [{ ...base, id: entry.id, kind, boost: kind === 'goat' ? 14 : 8, label: kind === 'goat' ? 'GOAT' : 'SPOTLIGHT', seasonId: base.id }];
  });
}
