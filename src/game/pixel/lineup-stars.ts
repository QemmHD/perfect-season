// The lineup stars (studio overhaul players-4): the twelve players per sport the identity row
// (likeness.test.ts, scripts/qa/players-lineup.mjs) and the looks gallery (?pixel=looks) draw side by
// side, chosen for different builds, hair and gear. Plus the seven looks the owner named, each with
// the season that shows it. Names as the card data spells them. Pure data.
import type { Sport } from './appearance';

export const STARS: Record<Sport, string[]> = {
  nba: ["Shaquille O'Neal", 'Stephen Curry', 'Dennis Rodman', 'Allen Iverson', 'Michael Jordan', 'LeBron James', 'Muggsy Bogues', 'Manute Bol', 'Nikola Jokić', 'Kareem Abdul-Jabbar', 'Yao Ming', 'Giannis Antetokounmpo'],
  // William Perry has no NFL card, so the NFL row is 11
  nfl: ['Patrick Mahomes', 'Derrick Henry', 'Tom Brady', 'Aaron Donald', 'Jerry Rice', 'Travis Kelce', 'Barry Sanders', 'William Perry', 'Randy Moss', 'Ray Lewis', 'Justin Tucker', 'Tyreek Hill'],
  soccer: ['Lionel Messi', 'Erling Haaland', 'Cristiano Ronaldo', 'Pelé', 'Diego Maradona', 'Peter Crouch', 'Zlatan Ibrahimović', 'Ronaldinho', 'Paul Pogba', 'Manuel Neuer', 'Kylian Mbappé', "N'Golo Kanté"],
};

/** The owner's examples (STREAM-players): who, the season that shows the look, and what must show. */
export const OWNER_EXAMPLES: { sport: Sport; name: string; season: number; shows: string }[] = [
  { sport: 'nba', name: "Shaquille O'Neal", season: 2000, shows: 'bald, goatee, the heaviest build' },
  { sport: 'nba', name: 'Allen Iverson', season: 2001, shows: 'cornrows, headband, arm sleeve' },
  { sport: 'nba', name: 'Kareem Abdul-Jabbar', season: 1985, shows: 'goggles' },
  { sport: 'nba', name: 'Dennis Rodman', season: 1997, shows: 'dyed hair (red, 1996-98)' },
  { sport: 'soccer', name: 'Erling Haaland', season: 2023, shows: 'long blond hair' },
  { sport: 'soccer', name: 'Kylian Mbappé', season: 2023, shows: 'short hair, no beard' },
  { sport: 'nfl', name: 'Tom Brady', season: 2007, shows: 'short light-brown hair under the helmet, no beard' },
];
