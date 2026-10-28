export interface RivalsReward {
  id: string;
  week: string;
  division: number;
  pack: string;
  coins: number;
}
export interface RivalsState {
  week: string;
  points: number;
  best: number;
  peak: number;
  w: number;
  l: number;
  seen: string[];
  rewards: RivalsReward[];
  claimed: string[];
}
export const DIVISIONS = [
  {
    name: 'Rookie',
    title: 'EVERY LEGEND STARTS HERE',
    at: 0,
    color: '#94b9bb',
    pack: 'bronze',
    coins: 50,
    wins: 3,
  },
  {
    name: 'Pro',
    title: 'YOU BELONG HERE',
    at: 90,
    color: '#5dc2ee',
    pack: 'silver',
    coins: 100,
    wins: 3,
  },
  {
    name: 'All-Star',
    title: 'BUILT FOR THE SPOTLIGHT',
    at: 210,
    color: '#19e3c9',
    pack: 'gold',
    coins: 150,
    wins: 5,
  },
  {
    name: 'Elite',
    title: 'RARE COMPANY',
    at: 390,
    color: '#b996ff',
    pack: 'gold',
    coins: 250,
    wins: 8,
  },
  {
    name: 'Legend',
    title: 'YOUR NAME. IN THE RAFTERS.',
    at: 600,
    color: '#f5b83d',
    pack: 'premium',
    coins: 400,
    wins: 12,
  },
];
const nat = (x: unknown) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;
export function divisionOf(points: number) {
  return Math.max(0, DIVISIONS.filter((d) => points >= d.at).length - 1);
}
export function rivalsOf(
  raw: Partial<RivalsState> | undefined,
  week: string
): RivalsState {
  const same = raw?.week === week;
  return {
    week,
    points: same ? nat(raw?.points) : 0,
    best: same ? nat(raw?.best) : 0,
    peak: nat(raw?.peak),
    w: same ? nat(raw?.w) : 0,
    l: same ? nat(raw?.l) : 0,
    seen: Array.isArray(raw?.seen)
      ? raw!.seen.filter((x) => typeof x === 'string').slice(-1000)
      : [],
    rewards: Array.isArray(raw?.rewards)
      ? raw!.rewards
          .filter(
            (r) =>
              r &&
              typeof r.id === 'string' &&
              Number.isInteger(r.division) &&
              r.division >= 0 &&
              r.division < 5 &&
              typeof r.week === 'string'
          )
          .map((r) => ({
            ...r,
            pack: DIVISIONS[r.division].pack,
            coins: DIVISIONS[r.division].coins,
          }))
      : [],
    claimed: Array.isArray(raw?.claimed)
      ? raw!.claimed.filter((x) => typeof x === 'string')
      : [],
  };
}
export function rivalsMatch(
  raw: RivalsState | undefined,
  week: string,
  id: string,
  won: boolean
): RivalsState {
  const r = rivalsOf(raw, week);
  if (r.seen.includes(id)) return r;
  const points = Math.max(0, r.points + (won ? 30 : -12)),
    best = Math.max(r.best, points),
    w = r.w + (won ? 1 : 0);
  const next = {
    ...r,
    points,
    best,
    peak: Math.max(r.peak, divisionOf(best)),
    w,
    l: r.l + (won ? 0 : 1),
    seen: [...r.seen, id].slice(-1000),
    rewards: r.rewards.slice(),
  };
  DIVISIONS.forEach((d, i) => {
    const key = week + ':' + i;
    if (
      best >= d.at &&
      w >= d.wins &&
      !next.rewards.some((x) => x.id === key) &&
      !next.claimed.includes(key)
    )
      next.rewards.push({
        id: key,
        week,
        division: i,
        pack: d.pack,
        coins: d.coins,
      });
  });
  return next;
}
