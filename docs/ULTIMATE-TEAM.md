# Ultimate Team: design

The owner's choices are in docs/ARCADE-V2.md. This file is the working design that the code
follows. It covers cards, packs, squads, chemistry, challenges and matches, for basketball and
football alike.

## Cards

The card pool is every player-season in the data, rated 2K/Madden-style.

- **Season card:** one per player per season. NBA covers 1960-2026, NFL 1970-2025.
  - The minimum is 20 games in the NBA, or 8 games or 4 starts in the NFL.
  - Any honors (All-Pro, Pro Bowl, All-NBA, MVP) qualify a season regardless.
  - The tier comes from overall: Bronze under 65, Silver 65-74, Gold 75 and up.
- **Promo ("Hot Season"):** a boosted copy of a player's best or most famous seasons, worth +3 to
  +6 overall plus an ability.
  - Qualifying seasons: MVP, All-NBA 1st team, AP All-Pro 1st team, scoring/rushing/receiving/sack
    titles, and record seasons.
  - About 2-4% of the pool.
- **Legend / Icon:** about 120 all-time greats per sport, each at his peak season. 2K/Madden
  legend style, 90-99.
- **Upgradable card:** any card can be levelled. Each game it plays in earns XP. Levels 1-5, each
  giving +1 overall (spread over its key attributes). A promo or legend keeps its own cap.

The card id is stable: `<sport>:<kind>:<season>:<pid>:<team>`.

A card shows:
- name, season, team (era colors), position, overall, tier frame;
- key attributes: 6 per position, 2K/Madden style;
- abilities (badges / X-factors);
- jersey number, height and weight.

## Ratings

There is one implementation, in TypeScript, so the draft games, Ultimate Team and the played games
always agree.

- **NBA:** `src/game/hoops2/ratings.ts` `hooper(line, spot, num)`.
- **NFL:** `src/game/football2/ratings.ts`. Madden-style attributes by position; overall weighted
  by position.
- **Card data:** the per-season data files carry raw stats, plus each stat's percentile rank
  within that season and position. The ratings code turns those into attributes. Ranks within a
  season are the era adjustment.

## Economy (Balanced)

- **Coins only, never real money.** Coins are the same as today's.
- **Where coins come from:** games, missions, daily reward, level-ups, quick-sell, challenge
  rewards.
- **Target:** a full Gold starting squad after about a week of normal play, which is about 3-4
  games a day plus missions and the daily reward.
- **Legends:** about 1 in 150 Premium packs.

| Pack | Price | Contents |
|---|---|---|
| Bronze | 150 | 5 cards, mostly bronze, 20% a silver |
| Silver | 400 | 5 cards, silver-heavy, 25% a gold |
| Gold | 900 | 5 cards, 3 gold guaranteed |
| Premium Gold | 1,800 | 8 cards, 6 gold, 6% a promo, 0.66% a legend |
| Position pack | 700 | 3 golds at one position |

- **Starter pack:** free, once per sport. Enough cards to field a full bronze/silver squad.
- **Duplicates:** quick-sell value depends on tier and overall: bronze 15-30, silver 40-80,
  gold 100-400, promo 500+, legend 2,500+.

## Squads

- **NBA:** 5 starters and 5 bench. The bench subs in on fatigue at halftime and when a starter's
  energy drops below 0.65.
- **NFL:** offense QB, RB, WR x3, TE, OL x5 (LT LG C RG RT); defense DL x4, LB x3, CB x2, S x2;
  plus K. That's 23 cards.
- **Team overall:** the average of the starters weighted by position, plus a chemistry bonus.
- **Chemistry, from 0 to 100:**
  - Links: same franchise +3, same decade +2, same season +4, same college is skipped (no data).
  - The squad's chemistry gives up to +3 overall across the squad, applied as attribute boosts in
    the games.
- **Uniforms:** the squad wears your favorite team's uniforms.
- **The club:** every card you own, filtered by position, tier, team and decade, and sorted by
  overall, newest, position or any rating (speed, three-point shot, driving dunk, throw power...),
  with that rating shown on each card.

## Squad Building Challenges (SBCs)

- You trade in cards that meet requirements for a pack or a special card. Examples:
  - "3 players from the same franchise, 70+"
  - "a five with team overall 80"
  - "any 1990s lineup"
- A rotating set: 6 daily (two easy, two medium, two hard) and 4 weekly, deterministic from the
  date (like the Daily), from a pool of 29 challenges. Plus three upgrades open every day, twice
  each: any five cards for a Silver pack, five silvers for a Gold pack, five good golds for a
  Premium pack. And three repeatables, as often as you like, each asking more the better it
  pays: five silvers for a Gold card, eight golds with a team overall of 77+ for an 84+ Gold card
  (Golden Hour), eight golds with a team overall of 83+ for an 88+ Gold card (Elite Pull). Reward
  cards are drawn at random from every card that fits. Challenges pay packs and cards, not coins.
- Building one: the team overall of the cards put in shows as you go, with what the empty spots
  have to average to reach the requirement, and the card picker shows the team overall each card
  would make. Auto-fill never uses the cards that play (basketball: the five starters and the
  first three off the bench; football: the whole squad); they can still go in by hand.

## Playing

- **Vs AI challenges (Squad Battles):** ladders of 8 themed AI squads of increasing overall.
  Example: rung 1 the '70s Nuggets, the top an all-time team. Beat all eight and the next ladder
  comes up. Four difficulties move every squad's overall, the AI's play on offense, how well its
  defense plays (reads, closeouts, help, steals; in football coverage, the rush and run fits), and
  what it pays:
  Rookie (weaker, x0.6 coins, Bronze and Silver packs), Pro (the standard, Silver and Gold),
  All-Star (better, x1.5, Gold and Premium), Legend (all-time squads, x2.2, four packs, two of
  them Premium). Changing difficulty starts that ladder from the bottom. Games pay, rung packs
  included, up to the day's paid-games limit.
- **Online UT head to head:**
  - Matched by squad overall: within ±3, widening by 2 every 10 seconds up to ±10, then an AI
    fallback.
  - The match uses the same Sim/Play vote and the played arcade games, with each side's squad.
  - The wire carries each side's squad as card ids plus levels. Both phones rate cards with the
    same code, so they agree.
- **What a game pays:** 60 coins for a win, 30 for a loss, and XP for every card in the squad,
  for the first 8 games of a day (Squad Battles and head to head together, played or simmed). Past
  that a game still counts for the record and the ladder (and a rung's pack), but pays nothing:
  a simmed game takes seconds, so unlimited pay would be a coin farm.
- **Cheating:** collections live on the phone, so a tampered client could fake cards. Accepted;
  there's no server.

## Storage

- Per sport, in the profile: `ut: { owned: OwnedCard[], squad, packsOpened, sbcDone, xp... }`.
- Cards are referenced by id; the card data loads lazily only when UT opens.
- `OwnedCard`: `{ uid, cardId, level, xp, at }`.
