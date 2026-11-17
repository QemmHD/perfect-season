import { loadCards } from './cards';
import { cardStatLine } from './card-stats';
import type { CardPool } from './cards';
let nfl: CardPool, nba: CardPool;
beforeAll(async () => {
  [nfl, nba] = await Promise.all([loadCards('nfl'), loadCards('nba')]);
}, 60000);
it('shows NFL season totals and completion percentage using their actual data keys', () => {
  const brady = nfl.lines.find((l) => l.kind === 'season' && l.name === 'Tom Brady' && l.season === 2007)!;
  const before = JSON.stringify(brady);
  expect(Object.fromEntries(cardStatLine(brady))).toMatchObject({ G: '16', 'PASS YDS': '4,806', 'PASS TD': '50', 'CMP%': '68.9', 'RUSH YDS': '98' });
  const gronk = nfl.lines.find((l) => l.kind === 'season' && l.name === 'Rob Gronkowski' && l.season === 2011)!;
  expect(Object.fromEntries(cardStatLine(gronk))).toMatchObject({ 'REC YDS': '1,327', 'REC TD': '17' });
  expect(JSON.stringify(brady)).toBe(before);
});
it('retains NBA per-game numbers and percentage formatting', () => {
  const jordan = nba.lines.find((l) => l.kind === 'season' && l.name === 'Michael Jordan' && l.season === 1996)!;
  expect(Object.fromEntries(cardStatLine(jordan))).toMatchObject({ G: '82', PTS: '30.4', 'FT%': '83.4' });
});
