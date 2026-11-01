// Flashbacks: the games no one forgets, replayed with the squads of the day. Each puts you in the
// moment (down 28-3, down 10 with 35 seconds left) with the real team that was there, against the
// real defense, and asks for what they did: so many points in so many drives or possessions. The
// first clear pays its coins and the hero's Moments card (src/ut/campaigns.ts); a replay won
// pays a little, a few times a day.
import { campaignCardId, CAMPAIGNS } from './campaigns';
import type { Pool } from './pool';
import { autoBuild } from './squad';
import type { UtState } from './state';
import { type SquadCards, type Teams, teamsOf } from './teams';
import type { CardLine, OwnedCard, UtSport } from './types';

export interface FlashSide {
  fr: string;
  season: number;
  /** what the screen calls them: "Rockets" */
  name: string;
}

export interface Flashback {
  id: string;
  sport: UtSport;
  title: string;
  date: string;
  /** the moment, told in a line or two */
  story: string;
  /** the score as it stood */
  board: string;
  us: FlashSide;
  them: FlashSide;
  /** whose moment it was (his Moments card is the prize); he plays */
  hero: string;
  /** possessions (basketball) or drives (football), and the points it takes */
  n: number;
  need: number;
  /** football: the yard line the drive starts on, and the clock on a one-drive moment (seconds) */
  start?: number;
  clock?: number;
  /** how hard, 1-3; and the coins its first clear pays */
  stars: 1 | 2 | 3;
  coins: number;
}

export const FLASHBACKS: Flashback[] = [
  // ---- basketball
  {
    id: 'g7-2016',
    sport: 'nba',
    title: 'Game 7',
    date: 'June 19, 2016 · NBA Finals',
    story: 'Tied at 89 with under a minute left, down 3-1 in the series no more. One stop, one shot, a title.',
    board: 'Cavaliers 89, Warriors 89',
    us: { fr: 'CLE', season: 2016, name: 'Cavaliers' },
    them: { fr: 'GSW', season: 2016, name: 'Warriors' },
    hero: 'Kyrie Irving',
    n: 2,
    need: 3,
    stars: 1,
    coins: 1500,
  },
  {
    id: 'ray-2013',
    sport: 'nba',
    title: 'The Corner Three',
    date: 'June 18, 2013 · NBA Finals, Game 6',
    story: 'Down 3 with the trophy being wheeled out. The rebound comes back out to the corner.',
    board: 'Spurs 95, Heat 92',
    us: { fr: 'MIA', season: 2013, name: 'Heat' },
    them: { fr: 'SAS', season: 2013, name: 'Spurs' },
    hero: 'Ray Allen',
    n: 2,
    need: 3,
    stars: 1,
    coins: 1500,
  },
  {
    id: 'last-shot-1998',
    sport: 'nba',
    title: 'The Last Shot',
    date: 'June 14, 1998 · NBA Finals, Game 6',
    story: 'Down 3 in Utah with 41.9 seconds left. A layup, a steal, and the shot.',
    board: 'Jazz 86, Bulls 83',
    us: { fr: 'CHI', season: 1998, name: 'Bulls' },
    them: { fr: 'UTA', season: 1998, name: 'Jazz' },
    hero: 'Michael Jordan',
    n: 3,
    need: 4,
    stars: 2,
    coins: 2000,
  },
  {
    id: 'kobe-81',
    sport: 'nba',
    title: '81',
    date: 'January 22, 2006 · Lakers vs Raptors',
    story: 'Down 14 in the third. Then Kobe takes over, and doesn’t stop until he has 81.',
    board: 'Raptors 71, Lakers 57',
    us: { fr: 'LAL', season: 2006, name: 'Lakers' },
    them: { fr: 'TOR', season: 2006, name: 'Raptors' },
    hero: 'Kobe Bryant',
    n: 10,
    need: 15,
    stars: 2,
    coins: 2500,
  },
  {
    id: 'tmac-13',
    sport: 'nba',
    title: '13 in 33 Seconds',
    date: 'December 9, 2004 · Rockets vs Spurs',
    story: 'Down 10 with 35 seconds left and the building emptying. Tracy McGrady scores 13 in 33 seconds.',
    board: 'Spurs 76, Rockets 66',
    us: { fr: 'HOU', season: 2005, name: 'Rockets' },
    them: { fr: 'SAS', season: 2005, name: 'Spurs' },
    hero: 'Tracy McGrady',
    n: 6,
    need: 11,
    stars: 3,
    coins: 3000,
  },
  // ---- football
  {
    id: 'mahomes-2019',
    sport: 'nfl',
    title: 'The Comeback',
    date: 'February 2, 2020 · Super Bowl LIV',
    story: 'Down 10 in the fourth quarter. Third and 15, and the Chiefs start throwing deep.',
    board: '49ers 20, Chiefs 10',
    us: { fr: 'KC', season: 2019, name: 'Chiefs' },
    them: { fr: 'SF', season: 2019, name: '49ers' },
    hero: 'Patrick Mahomes',
    n: 3,
    need: 11,
    stars: 1,
    coins: 1500,
  },
  {
    id: 'tyree-2007',
    sport: 'nfl',
    title: 'The Helmet Catch',
    date: 'February 3, 2008 · Super Bowl XLII',
    story: 'Down 4 to the 18-0 Patriots, 2:39 left, 83 yards to go. Escape the rush and throw it up.',
    board: 'Patriots 14, Giants 10',
    us: { fr: 'NYG', season: 2007, name: 'Giants' },
    them: { fr: 'NE', season: 2007, name: 'Patriots' },
    hero: 'Eli Manning',
    n: 1,
    need: 7,
    start: 17,
    clock: 159,
    stars: 2,
    coins: 2000,
  },
  {
    id: 'montana-1988',
    sport: 'nfl',
    title: 'The Winning Drive',
    date: 'January 22, 1989 · Super Bowl XXIII',
    story: 'Down 3, backed up at your own 8 with the clock running. A field goal won’t do: go win it.',
    board: 'Bengals 16, 49ers 13',
    us: { fr: 'SF', season: 1988, name: '49ers' },
    them: { fr: 'CIN', season: 1988, name: 'Bengals' },
    hero: 'Joe Montana',
    n: 1,
    need: 7,
    start: 8,
    clock: 170,
    stars: 2,
    coins: 2000,
  },
  {
    id: 'elway-1986',
    sport: 'nfl',
    title: 'The Drive',
    date: 'January 11, 1987 · AFC Championship',
    story: 'Down 7 in Cleveland with 5:32 left, the ball on your own 2. Ninety-eight yards.',
    board: 'Browns 20, Broncos 13',
    us: { fr: 'DEN', season: 1986, name: 'Broncos' },
    them: { fr: 'CLE', season: 1986, name: 'Browns' },
    hero: 'John Elway',
    n: 1,
    need: 7,
    start: 2,
    clock: 240,
    stars: 2,
    coins: 2000,
  },
  {
    id: '28-3',
    sport: 'nfl',
    title: '28–3',
    date: 'February 5, 2017 · Super Bowl LI',
    story: 'Down 25 in the third quarter. No team had ever come back from more than 10 in a Super Bowl.',
    board: 'Falcons 28, Patriots 3',
    us: { fr: 'NE', season: 2016, name: 'Patriots' },
    them: { fr: 'ATL', season: 2016, name: 'Falcons' },
    hero: 'Tom Brady',
    n: 5,
    need: 26,
    stars: 3,
    coins: 3000,
  },
];

/** what a replay won pays, and how many a day do */
export const REPLAY_COINS = 200;
export const PAID_REPLAYS_A_DAY = 5;

export function flashbacksFor(sport: UtSport): Flashback[] {
  return FLASHBACKS.filter((f) => f.sport === sport);
}

/** "11 points in 5 possessions" */
export function goalText(f: Flashback): string {
  if (f.sport === 'nfl' && f.n === 1) return f.need === 7 ? 'Score a touchdown on one drive' : 'Score ' + f.need + ' on one drive';
  return 'Score ' + f.need + ' in ' + f.n + (f.sport === 'nba' ? ' possessions' : ' drives');
}

/** The hero's Moments card (the first clear's prize), if the campaign has him. */
export function heroCard(pool: Pool, f: Flashback): CardLine | null {
  const c = CAMPAIGNS.find((x) => x.cards[f.sport].some((cc) => cc.name === f.hero));
  const cc = c?.cards[f.sport].find((x) => x.name === f.hero);
  if (!c || !cc) return null;
  const season = pool.lines.find((l) => l.kind === 'season' && l.name === cc.name && l.season === cc.season && l.fr === cc.fr);
  return season ? (pool.byId.get(campaignCardId(season, c)) ?? null) : null;
}

/** A side's squad: the team that season, built the way auto-build builds yours; the hero starts. */
export function flashSquad(pool: Pool, side: FlashSide, hero?: string): SquadCards {
  const lines = pool.lines.filter((l) => l.kind === 'season' && l.fr === side.fr && l.season === side.season);
  const cands = lines.map((l) => ({ uid: l.id, rc: pool.base.get(l.id)! })).filter((c) => c.rc);
  const pick = autoBuild(pool.sport, cands);
  // the moment's man is on the floor: in at his position if auto-build left him on the bench
  const h = hero ? lines.find((l) => l.name === hero) : undefined;
  if (h && pool.sport === 'nba' && !['PG', 'SG', 'SF', 'PF', 'C'].some((s) => pick[s] === h.id)) {
    const at = (['PG', 'SG', 'SF', 'PF', 'C'] as const).find((s) => h.pos.includes(s)) ?? 'SG';
    const benched = Object.entries(pick).find(([, id]) => id === h.id)?.[0];
    const was = pick[at];
    pick[at] = h.id;
    if (benched) {
      if (was) pick[benched] = was;
      else delete pick[benched];
    }
  }
  return Object.fromEntries(Object.entries(pick).map(([slot, id]) => [slot, { line: pool.byId.get(id)!, level: 1 }]));
}

export function flashTeams(pool: Pool, f: Flashback): Teams {
  return teamsOf(pool.sport, flashSquad(pool, f.us, f.hero), flashSquad(pool, f.them), 'flash:' + f.id);
}

export interface FlashResult {
  ut: UtState;
  coins: number;
  /** the Moments card that came with a first clear (the owned card) */
  card: OwnedCard | null;
  first: boolean;
  /** a replay won once today's paid ones were used */
  capped: boolean;
}

/** A flashback played: a first clear pays its coins and the hero's card, a replay won a little. */
export function settleFlash(ut: UtState, f: Flashback, won: boolean, day: string, hero: CardLine | null, uid: string, at: number): FlashResult {
  const flash = ut.flash && ut.flash.day === day ? ut.flash : { done: ut.flash?.done ?? {}, day, n: 0 };
  if (!won) return { ut, coins: 0, card: null, first: false, capped: false };
  const before = flash.done[f.id] ?? 0;
  const done = { ...flash.done, [f.id]: before + 1 };
  if (!before) {
    const card: OwnedCard | null = hero ? { uid, cardId: hero.id, level: 1, xp: 0, at } : null;
    return { ut: { ...ut, flash: { ...flash, done }, owned: card ? [...ut.owned, card] : ut.owned }, coins: f.coins, card, first: true, capped: false };
  }
  const capped = flash.n >= PAID_REPLAYS_A_DAY;
  return { ut: { ...ut, flash: { done, day, n: flash.n + (capped ? 0 : 1) } }, coins: capped ? 0 : REPLAY_COINS, card: null, first: false, capped };
}
