// Made-up rated cards for the Ultimate Team tests: only what squads, chemistry and challenges read.
import type { CardLine, RatedCard, Tier } from './types';

let n = 0;

export function fakeCard(o: { pos: string | string[]; ovr: number; fr?: string; season?: number; pid?: string; tier?: Tier; sport?: 'nba' | 'nfl' }): RatedCard {
  n++;
  const pos = Array.isArray(o.pos) ? o.pos : [o.pos];
  const season = o.season ?? 1996;
  const fr = o.fr ?? 'CHI';
  const pid = o.pid ?? 'p' + n;
  const line: CardLine = {
    id: (o.sport ?? 'nba') + ':season:' + season + ':' + pid + ':' + fr,
    sport: o.sport ?? 'nba',
    kind: o.tier === 'promo' ? 'promo' : o.tier === 'legend' ? 'legend' : 'season',
    pid,
    name: 'Player ' + n,
    season,
    fr,
    abbr: fr,
    teamName: fr + ' team',
    c1: '#123456',
    c2: '#abcdef',
    pos,
    ht: 78,
    wt: 210,
    num: 1,
    games: 70,
    starts: null,
    stats: {},
    rk: {},
    honors: [],
  };
  const tier: Tier = o.tier ?? (o.ovr >= 75 ? 'gold' : o.ovr >= 65 ? 'silver' : 'bronze');
  return { line, ovr: o.ovr, tier, pos: pos[0], attrs: {}, key: [], abil: [] };
}
