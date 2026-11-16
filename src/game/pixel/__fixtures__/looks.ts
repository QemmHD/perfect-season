// Six looks that cover the sprite code's branches (NBA hair styles and a beard, an NFL lineman's pads
// and helmet, soccer locs, a keeper's long sleeves and gloves), shared by the raster tests.
import type { Look } from '../body';

export const LOOKS: Look[] = [
  { sport: 'nba', ht: 78, wt: 215, num: 23, hair: 0, beard: false, skin: '#a8714f', hairColor: '#1d1612', jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' },
  { sport: 'nba', ht: 85, wt: 325, num: 34, hair: 3, beard: true, skin: '#a8714f', hairColor: '#1d1612', jersey: '#552583', trim: '#fdb927', shorts: '#552583', socks: '#ffffff', shoes: '#111111' },
  { sport: 'nba', ht: 72, wt: 165, num: 3, hair: 4, beard: false, skin: '#a8714f', hairColor: '#3b2a20', jersey: '#ffffff', trim: '#006bb6', shorts: '#ffffff', socks: '#ffffff', shoes: '#ffffff' },
  { sport: 'nfl', ht: 76, wt: 315, num: 71, hair: 0, skin: '#a8714f', hairColor: '#1d1612', jersey: '#203731', trim: '#ffb612', shorts: '#ffb612', socks: '#203731', shoes: '#111111', helmet: '#203731', stripe: '#ffffff', mask: '#9aa0a6', pants: '#ffb612', pads: 1.25 },
  { sport: 'soccer', ht: 70, wt: 159, num: 10, hair: 5, beard: true, skin: '#a8714f', hairColor: '#1d1612', jersey: '#75aadb', trim: '#ffffff', shorts: '#111111', socks: '#ffffff', shoes: '#111111', sleeves: 'short' },
  { sport: 'soccer', ht: 76, wt: 190, num: 1, hair: 2, beard: false, skin: '#a8714f', hairColor: '#1d1612', jersey: '#1fa34a', trim: '#111111', shorts: '#111111', socks: '#1fa34a', shoes: '#111111', sleeves: 'long', gloves: '#f2f2ee' },
];
