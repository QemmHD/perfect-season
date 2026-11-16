# Engagement research: what keeps people playing, and how to make Perfect Season hard to put down (without manipulating anyone)

**For:** the Perfect Season design-v2 overhaul (NBA, NFL and Soccer; draft modes, arcade matches, Ultimate Team; coins only, no ads, no real money).

**Owner's ask (verbatim):** "there isnt a addictive hook that makes players wanna keep playing forever it needs a freshen up to keep it lively and find a way to make it addictive and research how other developers and game makers make there games addictive and fix ours". The owner also wants a time-played leaderboard and time-played rewards that are worth it.

**Not repeated here.** `research-ultimate-team.md` already covers pack odds, bad-luck protection, UT objectives, the Season Pass, promos, the UT hub "next best action" and the End-of-Match screen. `audit-ut-ui.md` §5 lists the hooks that already exist and the ones that are missing. This report builds on both and points back to them instead of restating them.

---

## 0. The short version

1. **The app has plenty of reward faucets and very little reason to come back.** Daily drops, objectives, a login calendar, a Season Pass and many ladders exist (audit §5). What's missing is the layer that great live games put on top of faucets:
   - **an identity that grows forever:** one career level across all three sports, plus prestige that never resets;
   - **a weekly social stake:** leagues with promotion and relegation;
   - **a daily ritual worth sharing:** one shared challenge a day, Wordle-style;
   - **a "one more" moment at the end of every match.**
2. **Make time count, but count it honestly.** Count only *active* minutes (visible, recent input, real gameplay). Cap them at **90 a day**, pay most of the reward in the first hour, and say "Done for today" when the cap is reached. Headline: **"Play an hour a day, earn a Gold Pack a day."** The same capped minutes drive a weekly board, Duolingo-style leagues and an all-time Hall of Fame. Because of the cap, the boards reward *showing up*, not *staying up*.
3. **Use variable rewards, but transparently.** Brawl Stars removed its random boxes and DAU kept falling. D30 retention only started to recover when randomised Starr Drops came back ([mobilegamer.biz on Supercell's GDC talk](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)). Surprise matters. Keep it free, capped and with odds shown.
4. **Streaks need slack.** Duolingo's own A/B tests show:
   - streak protection and planned breaks raise retention (Weekend Amulet: +4% week-later return);
   - an explicit wager raised D7 by +14%;
   - lowering the bar to keep a streak raised new learners on a streak by +19% ([Duolingo blog](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals), [Duolingo blog](https://blog.duolingo.com/improving-the-streak)).
5. **Paying for raw time is the reward type most likely to kill intrinsic interest.** In Deci, Koestner & Ryan's meta-analysis, engagement-contingent rewards gave d = −0.40 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/10589297/)). So time rewards should be:
   - capped;
   - framed as milestones and thanks;
   - smaller than rewards for *playing well*;
   - heavy on status and cosmetics at the top tiers.
6. **Ethical lines** (§8):
   - odds on everything random;
   - no fake near-misses;
   - no punishing missed days;
   - timed content always returns;
   - at most one notification a day, with quiet hours;
   - break reminders and "Done for today";
   - no pressure aimed at minors.

The ranked list of 22 recommendations is in §9 and the time-played spec is in §10.

---

## 1. Method and limits

**Sources:**
- developer statements: GDC talks, studio blogs, patch notes;
- industry analysis: Deconstructor of Fun, GameRefinery, Naavik, PocketGamer.biz, Game Developer;
- peer-reviewed research;
- regulators;
- player forums.

**Limits:**
- Retention numbers from Duolingo and Supercell are company-reported relative lifts.
- Fan-wiki and single-source claims are flagged.
- Reddit was poorly indexed by my tools, so player voice leans on EA's FC Mobile forums.
- Impact rankings are estimates, to be validated with §11.

**Codebase facts used** (read-only):
- Boards are signed Nostr replaceable events, checked and ranked on the phone (`src/net/leaderboard.ts`, ISO `weekKey` on Eastern dates).
- UT currently pays 60 coins for a win and 30 for a loss, for 8 paid games a day (`src/ut/play.ts`).
- §10's numbers use the brief's design-v2 economy instead: a Gold Pack is about 750–1,500 coins, and a strong player earns about 1,000–2,000 coins an hour.

## 2. Why people keep playing: the models that matter

### 2.1 Self-Determination Theory (the "why")
Ryan, Rigby & Przybylski (2006) found that perceived **autonomy, competence and relatedness** each independently predicted enjoyment and *future play* ([Motivation and Emotion PDF](https://link.springer.com/content/pdf/10.1007%2Fs11031-006-9051-8.pdf)). Competence was linked to how intuitive the controls felt. The work became the PENS measure ([SDT.org](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)).

Implications for us:
- **Competence:** good controls, readable feedback and visible mastery.
- **Autonomy:** real choices (draft picks, squad building, which mode to play today).
- **Relatedness:** friends, rivals, clubs and sharing.

Today the app is strong on autonomy, middling on competence feedback, and weak on relatedness. The only social layer is best-run boards and online H2H.

### 2.2 Flow
Jenova Chen's thesis applied Csikszentmihalyi's flow to games through *player-driven* difficulty. Players choose their challenge level, often without noticing, instead of the game silently rubber-banding ([jenovachen.info](https://jenovachen.info/abstract)). For us, this means:
- difficulty tiers the player picks (Squad Battles already has them);
- optional harder routes in a run (Hades' Heat, Balatro's stakes);
- never secretly rigging outcomes.

### 2.3 Reinforcement schedules
John Hopson's 2001 Gamasutra article mapped ratio (work-based) and interval (time-based) schedules onto games. Variable-ratio rewards produce steady, persistent play. Hopson later argued that rewards are only legitimate "if the rewards make a more enjoyable game — not if they trick players into changing their behavior" ([Game Developer retrospective](https://gamedeveloper.com/design/10-years-of-behavioral-game-design-with-bungie-s-research-boss); [Game Developer](https://gamedeveloper.com/design/there-is-no-skinner-box-says-bungie-user-research-lead)).

Time-played rewards are an **interval** schedule. Interval schedules produce "check in, then stop" behaviour, which is good for daily habit and bad for depth. That is why the time ladder in §10 is paired with variable, skill-linked rewards.

### 2.4 The Hooked model
Nir Eyal's loop is trigger, action, variable reward, investment. "Investment" is the part most games forget: the user stores value (data, content, connections) that loads the next trigger ([Farnam Street summary](https://fs.blog/hooked/); [Google Play Dev on Hooked for retention](https://medium.com/googleplaydev/optimize-app-retention-with-the-hooked-model-a0781f8e5d29)).

In Perfect Season, investment would be:
- a career level and prestige that are *yours*;
- a club you belong to;
- a streak you're protecting;
- a league placement you'd lose.

### 2.5 Near-misses (handle with care)
Clark et al. (2009, *Neuron*): near-miss outcomes recruited the same striatal and insula reward circuitry as wins. They felt *less* pleasant but *increased the desire to play*, and only when the player had personal control ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737)).

Larche, Musielak & Dixon (2016) found the same arousal and urge-to-continue effect in Candy Crush. That game "signals when you just miss getting to the next level by one or two moves" ([Journal of Gambling Studies](https://link.springer.com/article/10.1007/s10899-016-9633-7)).

Lesson for us:
- **Honest skill near-misses** are fine and motivating. Examples: "You lost by 2", "1 yard short", "your shot hit the post", "3rd place, 40 points behind 2nd".
- **Manufactured** near-misses on random rewards are not. An example would be a pack reveal that teases a walkout and then gives a 76. The UT research doc already bans that.

### 2.6 Rewards can undermine interest
Deci, Koestner & Ryan's meta-analysis (128 studies) found that **engagement-contingent rewards** (paid just for doing the activity) reduced later free-choice intrinsic motivation the most (d = −0.40). Completion-contingent was −0.36 and performance-contingent −0.28. Tangible rewards hit children harder ([PubMed](https://pubmed.ncbi.nlm.nih.gov/10589297/)). The finding is contested (Cameron & Pierce argue the effects are limited), but the direction matters here.

**Paying coins per minute played is literally an engagement-contingent reward.** The fix:
- cap it;
- front-load it into a small daily ladder;
- make the big rewards about play quality and goals;
- make the top time milestones about *status*, not power.

### 2.7 Who plays sports games
Quantic Foundry's 1.75M-respondent motivation model puts Competition, Challenge and Completion among the 12 drivers. Competition drops from 1st to 9th place for players aged 36+, while Completion and Fantasy stay strong ([ironSource / Nick Yee](https://medium.com/ironsource-levelup/gamer-motivations-4-surprising-findings-5f705c212a93); [Quantic Foundry](https://quanticfoundry.com/)).

A sports card game straddles Competition (H2H, leagues) and Completion (collections, sets). So we need both a **ladder for competitors** and an **album for completers**, and neither should require the other.

---

## 3. Diagnosis: why Perfect Season lacks a "forever" hook

From the audit (§5) and the code, the app has most of the *chore* layer but little of the *meaning* layer:

| Layer | What great games have | Perfect Season today |
|---|---|---|
| Moment to moment | Juice and readable feedback (§4.1) | Good arcade engines; feedback depth audited separately |
| End of session | "One more" pull: next match one tap away, a visible bar about to fill | Results screens are thin (audit M3); UT has no post-match reward sequence |
| Daily | One ritual worth opening the app for, plus a reason to stop | Daily Drop, 3 objectives, Daily draft. UT's paid-game cap (8) is a hard stop with no "Done for today" framing and no other progress after it |
| Weekly | A social stake you can win or lose (league, clan goal) | Weekly boards for best runs; no promotion or relegation, no group goal |
| Forever | An identity that grows (account level, trophy road, prestige, collection score) and never resets | Per-mode levels and ladders, but no single career that spans the 3 sports and all modes; no prestige |
| Social | Friends, rivals, clubs, shareable results | Nostr boards and online H2H only; no friends list, clubs or share card |
| Return | Comeback missions, rested bonus | None found |
| Reach | Notifications and home-screen badge | None (no push, no `setAppBadge`) |

So **"make it addictive" really means building the weekly, forever, social and return layers on top of the faucets we already have.**

---

## 4. Mechanic-by-mechanic: how the reference games do it

### 4.1 Core loop, feel and session shape

**Juice.** "Juice It or Lose It" (Jonasson & Purho, GDC Europe 2012) layered screen shake, flashes, particles, tweening and sound onto a bland Breakout clone until it felt great ([GDC Vault](https://gdcvault.com/play/1016789/Juice-It-or-Lose)). Vlambeer's "Art of Screenshake" (Jan Willem Nijman) made the same point for action games ([Kenney's list of essential talks](https://kenney.nl/learn/must-see-videos-for-indie-developers)).

Balatro's designer credits its pull partly to how "pleasant its user interface is, and how good the feedback feels with satisfying audio" ([GamesRadar](https://www.gamesradar.com/exploring-balatros-hype-its-ingenious-twists-on-poker-and-its-mysterious-creator)). He also practised "ruthless design", where removing whole systems often made the game more fun ([Game Developer](https://www.gamedeveloper.com/business/localthunk-knew-balatro-needed-to-draw-players-in-with-poker)).

**Applied to us:**
- hit-stop on dunks, sacks and goals;
- number pops for stat lines;
- crowd swells on runs;
- a "big play" camera punch;
- the scoreboard flipping with weight.

All of it must respect reduced motion. Note that iOS Safari does not expose the Vibration API, so haptics are not available to a PWA. Verify this on device.

**Short, fixed sessions:**
- Marvel Snap locks matches at 6 turns, about 3–4 minutes. Brode's team tried 5, 6 and 7 turns before settling ([Game Developer](https://www.gamedeveloper.com/game-platforms/designers-don-t-sleep-on-marvel-snap-s-simultaneous-turns)). When a longer mode (Conquest) arrived, players complained it broke the "quick and low commitment" promise.
- Wardle framed Wordle as "three minutes a day" ([Game Developer on GDC 2022](https://www.gamedeveloper.com/marketing/josh-wardle-reflects-on-the-the-unconventional-road-to-wordle-s-success)).
- Duolingo lessons run 3–5 minutes, in parts of 10–20 seconds ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)).

Our owner's decision is 4–6 minutes per solo game with defense. That is fine for a "main course", but we also need a **60–90-second snack format** for the bus-stop session. Examples: a 2-minute Daily Challenge scenario, a "last drive", a penalty shootout.

**"One more run":**
- **Hades** designed the *moment of death* to be anticipated, not dreaded. Every death returns you to a hub where story and relationships advance, so "death is progress" ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death); [GDC Podcast ep. 16](https://gdconf.com/news/roguelikes-and-narrative-design-hades-creative-director-greg-kasavin-gdc-podcast-ep-16)).
- **Vampire Survivors** ties gold spent between runs to unlocks and a long achievement list. One analysis counts an item roughly every 23 seconds ([The Conversation](https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613); [Substack analysis](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors)). The designer came from casino-game work and chose not to use mobile monetisation tricks ([PC Gamer](https://pcgamer.com/vampire-survivors-saved-its-creator-from-working-on-mobile-gambling-games)).
- **Retro Bowl** works because short games feed a season, the season feeds a franchise, and "no two seasons feel the same". The player is also GM ([GamesRadar](https://gamesradar.com/retro-bowls-addictive-simplicity-makes-it-one-of-the-best-sports-games-in-recent-years); [Defector](https://defector.com/this-little-football-game-on-my-phone-is-fun-as-hell)).

**Mapping to us:**
- A failed draft run or a lost match must *always* pay into something permanent (career XP, prestige points, mastery, a collection stamp).
- The results screen must show what moved.
- The first button must be "Run it back" or "Next game", one tap.

**Stopping points.** Good games give an *honest* place to stop:
- Wordle's one puzzle a day;
- Duolingo's daily goal met;
- Royal Match giving players "enough lives and resources to play for a set amount of time every day" instead of hard-walling them ([ironSource design deep dive](https://medium.com/ironsource-levelup/design-deep-dive-02-royal-match-948f7af96f04)).

A clean stop *raises* return rates because players leave satisfied rather than exhausted. Duolingo found bingers were more likely to abandon the app than paced learners ([Duolingo blog](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)).

### 4.2 Progression: levels, trophy roads, mastery, prestige

- **Trophy roads that never reset.** Clash Royale's June 2025 rework made Trophy Road stop at 7,500 and stop resetting each season. Competitive seasonality moved into a separate Ranked Mode with one-time and seasonal rewards ([Supercell, June 2025](https://supercell.com/en/games/clashroyale/blog/release-notes/june-update-2025/); [Clash Royale support](https://support.clashroyale.com/hc/en-us/articles/49484914645915-Trophy-Road)). Separating permanent progress from seasonal competition matters: resets felt like losses.
- **Prestige.** Brawl Stars tried a monthly reset of brawlers above 1,000 trophies, and players disliked it ([Supercell](https://supercell.com/en/games/brawlstars/blog/news/trophy-season-rework-is-coming)). It moved to **Prestige**: at 1,000 a brawler can be prestiged and earns Prestige Trophies, which are permanent, never drop, and unlock neon icons and titles ([Supercell Feb 2026 release notes](https://supercell.com/en/games/brawlstars/blog/release-notes/release-notes-february-2026)).
- **Goals for the engaged.** Brawl Stars' Hypercharges (unlocked at brawler level 11) gave highly engaged players a new goal, and D30 retention rose faster after them ([mobilegamer.biz](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)). The lesson: **D30 is won by giving your best players a new mountain**, not more daily chores.
- **Collection Level.** Marvel Snap's only source of new cards is the Collection Level. You raise it by upgrading card *visuals*, so progress and cosmetics are one system ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2023/5/23/marvel-snap-the-definitive-deconstruction); [Brode on organic collecting](https://www.thegamer.com/marvel-snap-interview-ben-brode-d23-expo/)). Players complained when high upgrade costs stalled the track, so the pacing of the track *is* the product.
- **Tours and cities.**
  - Golf Clash unlocks harder "tours" with trophies, higher entry wagers and better chests ([Game Developer UX review](https://www.gamedeveloper.com/design/ux-review-golfclash-s-swing-to-success-)).
  - 8 Ball Pool's cities raise the entry fee and the pot as you climb, and ranking unlocks "more exclusive match locations" ([8 Ball Pool wiki](https://8ballpool.fandom.com/wiki/Leagues); [App Store](https://apps.apple.com/app/543186831)).
  - Both give a *place* you've reached. For our coins-only game the wager idea is risky, because loss-chasing is gambling-adjacent. Use venue unlocks (arenas and stadiums) without stakes.
- **Stars per level.** Score! Hero's 3-star levels and star-gated seasons drive replays. Players called the "perfectionist urge to replay for three stars" compelling, but the energy cap and AI that ignored the 3-star condition frustrated them ([TouchArcade thread](https://toucharcade.com/community/threads/267750); [App Store](https://apps.apple.com/gb/app/score-hero/id847492141)). Stars work. Our version must have no energy wall and no hidden conditions.

### 4.3 Rewards: variable schedules, chests and timers, streaks, cadence

**Variable rewards: the Supercell natural experiment.**
- **Brawl Stars:** removed Brawl Boxes in December 2022 for deterministic Starr Road rewards ([Game World Observer](https://gameworldobserver.com/2022/12/13/brawl-stars-loot-boxes-removed-supercell)). DAU kept declining. Supercell said players' biggest complaint was missing the *surprise* ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/why-removing-loot-boxes-in-brawlstars-failed)).
- **Starr Drops** returned in June 2023 (3 per 8 wins), and "this is where D30 retention began to recover". Hypercharges, Mega Pig and a pass rework followed. From June 2023 to February 2024, DAU rose 3.9x and MAU 2.4x ([mobilegamer.biz](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)).
- **Clash Royale** went the other way on *timers*. From 31 March 2025 it removed chest slots and timers and Chest Keys, replacing them with **Lucky Drops**: instant post-battle rewards, 3 per day (the first starts at 2 stars, the next two at 1 star). Each tap of a drop can roll up a rarity tier ([EGW](https://egw.news/gaming/news/26988/clash-royale-march-2025-update-brings-major-change-zXrplBuv1); [RoyaleAPI](https://royaleapi.com/blog/rip-chests-2025-q1-update); [Supercell, Lucky Drops](https://supercell.com/en/games/clashroyale/blog/release-notes/game-update-lucky-drops)). They became Lucky Chests in October 2025 ([MobileMatters](https://mobilematters.gg/news/clash-royale/lucky-chests-replace-lucky-drops)).

**Takeaway:** the industry's 2025 direction is **instant, capped, a little random, no wait timers**. Golf Clash's 2–8 hour chest timers existed mainly to sell speed-ups ([Game Developer](https://www.gamedeveloper.com/design/ux-review-golfclash-s-swing-to-success-); [PocketGamer.biz](https://www.pocketgamer.biz/how-does-golf-clash-monetise/)). A coins-only game has no reason to copy wait timers.

**Streaks.**
- Duolingo's streak is the best-documented retention mechanic anywhere:
  - The share of DAU on a 7+ day streak almost tripled to more than half.
  - CURR (current-user retention) rose 21%, cutting best-user churn by over 40%.
  - The first big win was the **streak-saver notification** ([Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)).
- Its controlled experiments:
  - **Separating the streak from the daily goal** (one lesson keeps the streak): D14 +3.3%, DAU +1%, learners on a streak +10.5% (+19% for new learners). Flagged downside: fewer people hit the bigger daily goal ([Duolingo](https://blog.duolingo.com/improving-the-streak)).
  - **Milestone animations:** +1.7% 7-day retention for new learners.
  - **Two equippable Streak Freezes:** +0.38% DAU, without encouraging more days off ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit)).
  - **Streak Wager** (bet currency on keeping 7 more days; success doubles it): D7 +14%.
  - **Weekend Amulet:** +4% return a week later, 5% fewer lost streaks. Weekend DAU drops 5–10% ([Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)).
  - **Streak Revival campaign** (restore your longest streak after 3 lessons): 15.4M revivals, including ~8M users with no active streak ([Pulse 2.0 on Q2 results](https://pulse2.com/duolingo-daily-active-users-reach-58-7-million-as-retention-hits-record-84-and-social-accounts-top-1-billion-organic-impressions/)).
- **Win streaks** (consecutive wins rather than days) power Candy Crush and Royal Match. Formats include capped power-up ladders (3 or 5 wins), endless milestone bundles after the cap, streak badges, and "don't fail for X levels" events. Deconstructor of Fun proposes a "Win Streak Freeze" by analogy with Duolingo ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2024/8/5/win-streak-the-gift-that-keeps-on-giving)).
- NBA 2K's Triple Threat Park pays daily single-win and win-streak rewards in a 24-hour window, and one loss or quit ends the streak ([2K support](https://support.nba2k.com/hc/en-us/articles/41854043835411-NBA-2K-Win-Streak-Rewards-in-Triple-Threat-Park)).

**Login calendars and daily bonuses:**
- **Pokémon GO** added daily first-catch and first-spin bonuses four months after launch to lift retention. A 7-day streak now pays 2,500 XP and 3,000 Stardust, then resets ([Niantic help](https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/105-daily-bonuses/); [TechCrunch](https://techcrunch.com/2016/11/02/pokemon-go-introduces-daily-bonuses-to-keep-players-coming-back)).
- **Subway Surfers'** Word Hunt has you collect letters during runs. Three consecutive days pay a bonus, five pay a Super Mystery Box, and missing a day resets to base ([SYBO help](https://sybo.helpshift.com/hc/en/5-subway-surfers/faq/132-daily-events-1685626989); [Wikipedia](https://wikipedia.com/wiki/Subway_Surfers)).
- **GameRefinery** sorts appointment mechanics by interval, involvement, progression and randomness. It finds daily rewards common among top performers, weekly and monthly task layers common in sports and racing and in mid-core, and **online-time rewards** popular in Chinese RPGs but rare in US top-grossing games ([GameRefinery](https://www.gamerefinery.com/keep-your-players-in-game-with-appointment-mechanics/)).

**Cadence.** The burnout panel at PocketGamer.biz is worth reading in full ([PocketGamer.biz](https://www.pocketgamer.biz/burnout-is-essentially-design-failure-the-mobile-mavens-weigh-in-on-player-burnout/)):
- Oscar Clark: burnout is "essentially design failure", and daily tasks that *punish* a missed day turn fun into resented obligation.
- Burny Games recommends low-pressure daily goals.
- Ampere's Louise Wooldridge: blend long arcs into daily and weekly rewards "so players always feel close to the next milestone".
- Sensor Tower data cited there: milestone rewards rose from 30% to 40% of progression events between 2024 and 2025.

**Comeback rewards.** GameRefinery documents four tactics for lapsed players ([GameRefinery](https://gamerefinery.com/four-ways-how-mobile-games-re-engage-lapsed-players)):
- welcome-back gifts, such as 5 days of daily currency;
- return deals;
- **returning-player missions with buffs**, such as Call of Duty Mobile's 5-day ladder with a choose-1-of-3 main reward, and Mobile Legends' bonus league points and XP;
- friend recall, such as PUBG Mobile's Recall Tokens.

Note: QQ Dance's comeback set includes **online-time tasks**.

### 4.4 Collection and status: leaderboards, leagues, rivals, clubs, sharing

**Duolingo Leagues:**
- Weekly XP leaderboards with 10 tiers. Players are matched with others of **similar study habits and time zone**. Leagues reset each Sunday, the top movers climb, and the top 10 in Diamond enter a knockout Diamond Tournament ([Duolingo blog](https://blog.duolingo.com/duolingo-leagues-leaderboards/)).
- After launch, learning time rose 17% and highly engaged learners (1h+/day, 5 days/week) **tripled** ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)).
- The weekly deadline "drives a rush in the final hours" ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)).
- Demotion matters: "promotion alone would be a one-way ratchet" ([Duolingo mechanics reference by DoF](https://duolingo.deconstructoroffun.com/mechanics/leagues)).
- **The cost:** uncapped XP invites farming. Kotaku and others documented Diamond-league XP farming and bots, while Duolingo says it removes illegitimate XP ([Kotaku](https://kotaku.com/duolingo-app-cheats-hacks-leagues-xp-why-duohacker-1850506482)). **Lesson: cap what counts.**

**Relative boards beat global boards for most players:**
- Studies find top performers increase effort while bottom performers *decrease* it on full boards ([Emerald, Internet Research 2023](https://www.emerald.com/insight/content/doi/10.1108/intr-12-2021-0897/full/html)).
- An HKU study recommends **relative leaderboards** (you plus about 2 neighbours above and below) and hiding the bottom ranks publicly ([HKU](https://hub.hku.hk/bitstream/10722/368255/1/content.pdf)).
- Evidence is mixed (some low-ranked learners tried harder), so show "near me" by default and global on request.

**Clubs and co-op goals:**
- Clash of Clans' Clan Games combine a **personal points cap** with **clan-wide reward tiers**. Your contribution unlocks shared tiers, and excess points still count towards an achievement. Caps vary by season (500, then 2,000, 4,000 and 10,000) ([Supercell](https://supercell.com/en/games/clashofclans/blog/news/the-next-clan-games-are-coming/); [Sportskeeda tiers](https://www.sportskeeda.com/mobile-games/all-clash-clans-clan-games-rewards-points-required-june-2025)).
- Brawl Stars' Mega Pig replaced Club League with "easier entry and fewer matches", and lifted D30 ([mobilegamer.biz](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)).
- **Lesson:** co-op goals with a personal cap beat demanding club wars.

**Friend streaks and quests.** Duolingo layers Friend Quests (co-op goal before a deadline) and Friend Streaks on top of personal streaks ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)).

**Sharing.**
- Wordle's spoiler-free emoji grid was invented by a player typing coloured squares by hand. Wardle built it in, and growth went from about 90 daily players to millions within weeks ([Syntax interview transcript](https://syntax.fm/show/430/creator-of-wordle-josh-wardle/transcript); [Game Developer](https://www.gamedeveloper.com/marketing/josh-wardle-reflects-on-the-the-unconventional-road-to-wordle-s-success)).
- The key is **one shared puzzle a day**, so results are comparable and discussable.
- Steam Replay shows a non-competitive version: your year compared with the *median* player, with platinum/gold/silver tiers rather than a raw rank ([PC Gamer](https://www.pcgamer.com/steams-2023-year-in-review-breaks-down-exactly-how-you-blew-the-past-12-months-on-videogames)).

### 4.5 Live ops and onboarding

**Live events and FOMO:**
- Brawl Stars rotates events and limited modes. Marvel Snap's High Voltage is a 3-turn limited mode.
- The healthy version is a **predictable rhythm** where content *returns*, rather than a fear of missing out (Clark, [PocketGamer.biz](https://www.pocketgamer.biz/burnout-is-essentially-design-failure-the-mobile-mavens-weigh-in-on-player-burnout/)).
- Marvel Snap's live-ops lessons: [PocketGamer.biz](https://www.pocketgamer.biz/lessons-in-mastering-live-ops-from-marvel-snap).

**Onboarding (FTUE):**
- GameRefinery's three-part series: make players feel welcome, show them what to do in what order, give them the means to do it, and hook them. Common tools are a guided first session, a free first pull in gacha tutorials, and "start-dash" missions ([Part 1](https://www.gamerefinery.com/first-impression-seals-the-deal-onboarding-best-practices-part-1), [Part 2](https://www.gamerefinery.com/keep-your-players-coming-back-introducing-onboarding-best-practices-part-2/), [Part 3](https://www.gamerefinery.com/soft-landing-to-conversion-introducing-onboarding-best-practices-part-3/)).
- Marvel Snap's onboarding reveals cards and locations slowly and teaches by playing ([mobilegamer.biz](https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/)).
- Golf Clash teaches by letting you *watch* the opponent's turn ([Game Developer](https://www.gamedeveloper.com/design/ux-review-golfclash-s-swing-to-success-)).

**Benchmarks:**
- GameAnalytics Q1 2024 (10,000+ games): median D1 22.9%, D7 4.2%, D28 0.85% ([GameDevReports summary](https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile)).
- The 2025 data dropped further. The median D30 is about 0.7%, while the top 10% reach about 40% D1, 12% D7 and 4% D30 ([InvestGame PDF](https://investgame.net/wp-content/uploads/2026/01/2026-01-20-Mobile_retention_benchmarks_2026.pdf)).
- A reasonable target for Perfect Season's installed-PWA audience (already self-selected) is top-decile: **D1 ≥ 40%, D7 ≥ 15%, D30 ≥ 6%**.

**Notifications** (the Duolingo playbook):
- Treat push as a precious channel. Increasing volume needed CEO sign-off ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)).
- Choose message templates with a bandit that accounts for novelty decay ("recovering") and ineligible templates ("sleeping"). Success is a lesson within 2 hours ([Yancey & Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf)).
- The streak-saver message was the first big streak win.

**For our installed PWA:**
- Web Push works on iOS 16.4+ **only for Home Screen web apps**. Permission must be requested from a user gesture (a button tap), not on load ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [Apple developer docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)).
- The **Badging API** (`navigator.setAppBadge`) works for Home Screen web apps, but the badge only shows if notification permission was granted ([WebKit](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/)).
- So badges and push share one permission. Ask once, at a moment of value, for example right after the first streak day: "Want a heads-up before your streak ends?"

### 4.6 Goals: personalised goals and "next best action"

- Duolingo's biggest streak lift came from **lowering the bar** to one lesson ([Duolingo](https://blog.duolingo.com/improving-the-streak)).
- Brawl Stars lifted D30 by giving engaged players a *new* goal (Hypercharge).
- Wooldridge says players should "always feel close to the next milestone" ([PocketGamer.biz](https://www.pocketgamer.biz/burnout-is-essentially-design-failure-the-mobile-mavens-weigh-in-on-player-burnout/)).
- The goal-gradient and endowed-progress evidence is already in `research-ultimate-team.md` §7.

The UT doc specifies a UT-only next-best-action hero (§8.12). This report recommends **one engine for the whole app** that knows all three sports and all modes (rec #9).

### 4.7 What players say when they quit

Player complaints from EA's FC Mobile forums:
- free players "save resources for weeks to pull bottom-tier reward pools", so daily events "feel empty" — "I quit completely" ([EA forums](https://forums.ea.com/discussions/fc-mobile-general-discussion-en/the-f2p-chasm-how-recent-updates-are-killing-the-grind-/13562489));
- the systems "completely killed the fun and made me uninstall" ([EA forums](https://forums.ea.com/discussions/fc-mobile-general-discussion-en/fc-26-mobile-%E2%80%93-the-systems-that-completely-killed-the-fun-and-made-me-uninstall/13085593));
- exchanges "do not respect the time and grind players invest".

EA's own FC 27 team acknowledged a "sentiment shift" among players who quit FC 26 Ultimate Team ([Dexerto](https://www.dexerto.com/ea-sports-fc/ea-fc-27-devs-respond-to-frustrated-players-who-quit-ultimate-team-in-ea-fc-26-3393312/)).

The pattern: **people quit when effort stops feeling like it buys progress, and when the power race makes their collection worthless.** Being coins-only is our advantage. We can make every hour of play visibly worth something and keep old cards useful (see the UT doc's power-curve cap).

---

## 5. Time-played rewards: how real games track and reward playtime

### 5.1 Real examples

| System | What counts | Ladder or caps | Anti-farm |
|---|---|---|---|
| **Twitch Drops** (dev guidance) | Minutes watching an eligible live channel | Twitch suggests 15–30 min for a standard drop and 3–6 h for high value; campaign tiers like 15/30/60/90/150 min; progress is cumulative across sessions | Multiple simultaneous streams don't speed progress ([Twitch dev docs](https://dev.twitch.tv/drops/); [Prima on a tiered campaign](https://primagames.com/tips/how-to-get-where-winds-meet-twitch-drops)) |
| **Xbox Game Pass "Daily Play" quest** | ≥15 minutes in any Game Pass game | 10 points a day (10–20 by tier later) | Only catalog titles; a guide notes you needn't actively play, which is a flaw ([Xbox Wire](https://news.xbox.com/en-us/2025/01/06/xbox-quests-rewards-game-pass/); [PureXbox](https://www.purexbox.com/guides/microsoft-rewards-and-xbox-how-to-make-20000-points-per-month)) |
| **Mistplay** | Minutes played in discovered games (GXP per minute) | **2-hour daily cap per game**, level cap 20 per game; rates decline as you level | Must launch through the app ([Mistplay economy disclosure](https://www.mistplay.com/legal/economy-disclosure)) |
| **Chinese RPG "online time rewards"** | Time with the game open; visible menu timer | Daily refresh; offline-time XP usually capped per session | Popular in China, rare in US top-grossing ([GameRefinery](https://www.gamerefinery.com/keep-your-players-in-game-with-appointment-mechanics/)) |
| **World of Warcraft rested XP** | Time *away* (logged out or in an inn) | Accrues to a 150% cap and doubles kill XP until spent | Designed so casuals keep pace and heavy players are nudged to take breaks ([Warcraft wiki](https://warcraft.wiki.gg/wiki/Rested)) |
| **China fatigue system** (2005, minors from 2007) | Continuous or daily online hours | Full rewards for 3 h, **half for the next 2 h, zero after 5 h** | Players fled to non-enforcing servers when it applied to adults; the regulator limited it to minors ([Game Developer](https://www.gamedeveloper.com/game-platforms/the-china-angle-game-safety-); [China Daily 2007](https://covid-19.chinadaily.com.cn/china/2007-04/10/content_846715.htm)) |
| **Fortnite** | XP from play, including Creative and LEGO | Undisclosed weekly Creative XP cap | LEGO mode added an AFK timer that **denies XP while idle** (it monitors input); Epic banned "AFK/XP farm" terms in map names from Feb 2025 ([Prima](https://primagames.com/gaming/afk-xp-farming-no-longer-works-in-lego-fortnite); [Sportskeeda](https://sportskeeda.com/fortnite/news-afk-xp-coin-farm-coin-slide-images-fortnite-coins-removed-creative)) |
| **Roblox** | Experiences commonly give playtime gifts | Platform kicks after ~20 min without input | Devs pause rewards when `Player.Idled` fires; one dev argues playtime rewards mostly attract idlers ([DevForum](https://devforum.roblox.com/t/stop-disconnecting-players-when-they-idled-for-20-minutes/1261990); [DevForum](https://devforum.roblox.com/t/how-effective-are-playtime-reward/3652644)) |
| **Minecraft server plugins** | "Active time" only | Default idle threshold of 5 min; daily caps | One plugin's cap reset on every rejoin and was farmed by reconnecting, so the cap had to persist across relogs ([ActiveRewards](https://github.com/TheMax98000/ActiveRewards); [IdleRewards changelog](https://github.com/arvidhqx-commits/idlerewards)) |
| **Pokémon GO Adventure Sync** (activity, not time) | Weekly distance walked | 5 / 25 / 50 / 100 km weekly tiers; the top tier pays 20,000 Stardust | Speed caps to stop driving ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Adventure_Sync)) |

### 5.2 What the examples teach

1. **Define "active" by input and context, not by the app being open.** Fortnite LEGO, Roblox and the active-time plugins all moved from "connected" to "recent input". Xbox's "just have it running" is the cautionary tale.
2. **Caps must live in durable state.** IdleRewards' cap reset on reconnect. In our case the cap must be keyed to the day in the saved profile, not to the session or the tab.
3. **Front-load, then taper to zero.**
   - Twitch puts the cheap drop at 15–30 minutes.
   - China's system halved rewards after 3 h and zeroed them after 5 h, but the *adult* version failed because it was imposed.
   - **A voluntary daily ladder that simply ends** feels like completion. A *penalty* feels like punishment.
4. **Weekly ladders smooth out life.** Adventure Sync's weekly tiers let someone who misses Tuesday still hit 25 km. Weekly targets are more forgiving than daily ones (compare Duolingo's Weekend Amulet).
5. **Reward rest.** WoW's rested XP is the classic humane design: coming back after time away is *boosted*, so breaks aren't punished.
6. **Time rewards attract idlers if they pay well and need no play.** That is the Roblox developer's complaint. Tie banking to *completed* activities.

### 5.3 What makes a playtime leaderboard fair

- **Same ceiling for everyone.** A daily cap on counted minutes means the board measures *consistency*, not free time or sleeplessness. Anyone can reach the weekly max with about 90 minutes a day. "The board rewards showing up, not staying up."
- **Compare similar players.** Use Duolingo-style groups by prior-week activity, and a relative "near me" view by default ([HKU](https://hub.hku.hk/bitstream/10722/368255/1/content.pdf)).
- **Fresh starts.** A weekly reset means a new player can top a board in week one. The all-time board is a *loyalty wall*, not a race.
- **Ties at the cap are a feature.** Show a "MAX" badge, and break ties by days active, then matches completed.
- **Verifiable shape.** On Nostr, where every client checks entries, the entry must carry enough structure to reject impossible claims (per-day minutes, each ≤ cap). See §10.6.
- **Opt-out.** Duolingo lets learners hide from boards by making their profile private. Do the same.

### 5.4 What feels rewarding versus grindy

| Rewarding | Grindy |
|---|---|
| A few big, visible milestones (5, 15, 30, 60 min) with a chest that pops | Coins dribbling per minute |
| One headline promise ("an hour a day = a Gold Pack a day") | Opaque formulas |
| An explicit end ("Done for today — matches still pay coins") | An endless ladder that always has one more rung |
| Status for long-term time (badges, frames, Hall of Fame) | Power for long-term time, which makes non-grinders feel weak |
| Rested and catch-up bonuses after time away | Missing a day loses rewards forever |
| Time counted during *fun* (matches, drafts, pack openings) | Time counted in menus (which rewards idling) |

---

## 6. Short-session and run-based lessons for draft mode

Draft modes (Classic, Blind, Daily, H2H) are already a roguelite-shaped loop: pick, build, play a season, get a result. Hades, Balatro and Vampire Survivors suggest three upgrades, specified in rec #14:
- **Meta-progression:** every run, won or lost, pays Front Office Points toward small permanent perks for Classic and Blind. Daily and H2H boards stay perk-free.
- **Optional Heat:** player-chosen modifiers with a score multiplier and their own board.
- **An optional "seen it all" challenge album:** Balatro's designer added challenges to help players "explore the design" ([GamesRadar](https://www.gamesradar.com/exploring-balatros-hype-its-ingenious-twists-on-poker-and-its-mysterious-creator)).

Lost runs lead with what advanced, then the loss, then "Draft again".

## 7. Sports-specific notes (NBA, NFL, Soccer)

- **Real calendars are free live ops.**
  - **NBA:** opening night, Christmas, All-Star, the trade deadline, playoffs, the draft.
  - **NFL:** kickoff, Thanksgiving, the playoffs, the "big game" week (don't use the trademarked name), the draft.
  - **Soccer:** league openers, derbies, the winter break, cup finals, summer tournaments.

  Pin the weekly events (rec #13) and Daily Challenges (rec #4) to these dates. The UT research doc already gives soccer a Live Calendar.
- **Scenario snacks per sport** (for the Daily Challenge and "last 2 minutes" modes):
  - **NBA:** "Down 3, 24 seconds, your ball."
  - **NFL:** "4th and 2 from the 38, 1:12 left."
  - **Soccer:** "90+3', 1–1, corner kick", or a penalty shootout.

  These are Score! Hero's best idea (scripted moments with stars) without its energy wall.
- **Cross-sport career.** One level shared by three sports turns "I'm bored of NFL" into "let me level up in soccer" instead of churn. It is our unique advantage over single-sport competitors.

---

## 8. Ethics: compelling, not manipulative

### 8.1 The regulatory landscape (why the lines matter even for coins only)

- **Loot boxes:**
  - **Belgium and the Netherlands** (2018) found some paid loot boxes violated existing gambling law. A 2025 Antwerp ruling treated real-money loot boxes as unlawful ([PC Gamer overview](https://www.pcgamer.com/the-legal-status-of-loot-boxes-around-the-world-and-whats-next); [DLA Piper](https://www.dlapiper.com/en/insights/topics/loot-boxes)).
  - **Australia**, from 22 Sep 2024: games with paid chance-based purchases get at least **M**, and games with **simulated gambling** get at least **R18+**, even without real money. Chance-based rewards that *can't be bought* with real money fall outside the paid-loot-box rule ([Australian Classification](https://www.classification.gov.au/about-us/media-and-news/news/new-mandatory-minimum-classifications-for-gambling-games-content)). **Our coins-only packs are outside the paid-loot-box rule, but any casino-style mini-game (spin wheels, slot reels, coin wagers on matches) risks the simulated-gambling R18+ rule. Do not build those.**
  - **UK:** DCMS (July 2022) found an *association* between loot box spending and problem gambling. Ukie's 11 industry principles (July 2023) cover paid loot boxes, starting with parental-consent controls for under-18s ([GOV.UK](https://www.gov.uk/guidance/loot-boxes-in-video-games-update-on-improvements-to-industry-led-protections)).
  - **Brazil:** one source reports Lei 15.211/25 banning loot box sales to under-18s from March 2026 ([esports.net](https://www.esports.net/news/loot-boxes-and-skins-gambling-face-regulatory-scrutiny-as-countries-warn-of-underage-gambling)). This is a single source; verify it.
  - **EU CPC Network** Key Principles on in-game virtual currencies (March 2025): price transparency and protection of vulnerable consumers. They exclude currencies obtainable *only* through gameplay ([Bird & Bird](https://www.twobirds.com/en/insights/2025/european-move-towards-protecting-users-from-harmful-practices-in-video-games-eu-consumer-protection)). Our coins qualify for that exclusion. Keep it that way: no purchase path, ever.
  - **App stores** require odds disclosure for loot boxes ([PC Gamer on Apple 3.1.1](https://www.pcgamer.com/apple-now-requires-app-store-games-to-disclose-loot-box-odds/)). We are a PWA, but we follow it anyway.
- **Dark patterns:** The FTC's $520M settlement with Epic (Dec 2022) included **$245M in refunds for dark patterns** that tricked players, including children, into unintended purchases ([PC Gamer](https://pcgamer.com/epic-slammed-with-half-a-billion-dollars-in-ftc-fines-because-fortnite-tricked-children-with-dark-patterns)). The academic taxonomy (Zagal, Björk & Lewis 2013) names temporal patterns ("playing by appointment", grinding), monetary ones and social ones (social pyramid schemes, impersonation) ([Chalmers](https://research.chalmers.se/en/publication/177148)). Deterding et al. criticise the frame as too blunt ([DiGRA 2020](https://eprints.whiterose.ac.uk/156460/1/DiGRA_2020_paper_189.pdf)). We use it as a checklist, not a verdict.
- **Design for minors:**
  - The UK **ICO Children's Code** (standard 13) bans nudges that steer children to give up privacy, and *recommends* nudges toward wellbeing: "nudge towards ... taking breaks; provide ... pause and save features" ([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/)).
  - The 2018 draft explicitly named "reward loops ... (such as likes and **streaks**)" as nudges of concern ([IAPP](https://iapp.org/news/a/ico-bans-use-of-nudge-techniques-in-new-draft-guidelines/)).
  - China limits minors to 8–9 pm on Fridays, weekends and holidays ([gov.cn](https://english.www.gov.cn/statecouncil/ministries/202108/30/content_WS612ce08fc6d0df57f98df640.html)). This doesn't apply to us, but it shows where regulators go when industry doesn't self-limit.
  - A sports card game with real athletes *will* attract teenagers. Design as if under-16s are playing.
- **Healthy-play precedent:**
  - Nintendo's "take a break" prompts trace back to EarthBound's dad character, who urged breaks after about 2 hours ([Screen Rant](https://screenrant.com/nintendo-wii-earthbound-game-tracker-break-satoru-iwata/); [Kill Screen](https://www.killscreen.com/should-more-games-tell-us-stop-playing-and-do-something-else/)).
  - The Switch parental controls can suspend software at a time limit ([Nintendo](https://nintendo.com/sg/hardware/switch/parentalcontrols)).
  - WoW's rested XP is a structural break incentive.
  - Duolingo's data says paced use beats bingeing for retention too. Healthy play isn't a tax on engagement.

### 8.2 Clear lines for Perfect Season

**Red lines (never ship):**
1. **No real money, and no way to buy coins, packs or time skips.** That is what keeps us outside the paid-loot-box and EU virtual-currency rules.
2. **No casino-style mechanics:** spin wheels with stakes, slot reels, coin wagers on match outcomes, or entry fees that can be lost (unlike 8 Ball Pool and Golf Clash). These risk Australia's R18+ simulated-gambling floor, and they train loss-chasing.
3. **No fake near-misses or deceptive reveals.** Cues never over-promise (already a UT rule; extend it to Scout Drops and the time ladder).
4. **No escalating-cost or one-shot-forever offers.** Every timed thing returns within a known cycle.
5. **No punishment for not playing.** No decay of owned items, levels or prestige. League demotion is the only "loss", and it is small, weekly and recoverable.
6. **No guilt or shame copy** ("Your team misses you 😢", "Don't let your friends down"). Duolingo's passive-aggressive owl is a meme, not a model.
7. **No social pressure loops:** no "your friend lost their streak because of you", and no club penalties for absent members.
8. **No notifications at night or more than once a day.** Default quiet hours are 21:00–08:00 local.

**Must-haves:**
1. Odds on every random reward, shown before it opens.
2. **Streak shields:** one free miss a week, plus a weekend toggle (a Weekend Amulet equivalent, free).
3. **"Done for today"** states: when the time ladder caps, when dailies are done, and when the UT paid-game cap is hit. Each comes with "matches still count for leagues and XP" so stopping is a choice, not a wall.
4. **Break reminder:** optional, default on, after 60 continuous active minutes ("Good time for a stretch — your progress is saved"). One tap dismisses it. It never interrupts a live possession; it shows at the next stoppage.
5. **Session summary on exit:** what you earned, and what's waiting tomorrow (the audit's "session-end teaser").
6. **Playtime visible to the player:** today and this week, in Profile. Self-awareness is a healthy-play feature (Steam Replay, iOS Screen Time).
7. **Opt out of public boards** (hide your name), as Duolingo allows.
8. **Rested bonus on return** (WoW-style), so breaks are rewarded rather than punished.

---

## 9. Recommendations for Perfect Season

**How to read the ranking:**
- Impact is rated **H/M/L** separately for D1, D7 and D30 retention. The overall rank weighs D7 and D30 more heavily, because that is where "keep playing forever" lives.
- Build size, in rough engineering effort for this codebase:
  - **S** = 1–3 days;
  - **M** = 1–2 weeks;
  - **L** = 3–5 weeks;
  - **XL** = more than 5 weeks or needs new backend work.
- Items marked †UT already have a fuller UT-specific spec in `research-ultimate-team.md` and are listed here only for ranking.

### 9.1 Ranked list

| # | Mechanic | D1 | D7 | D30 | Size |
|---|---|---|---|---|---|
| 1 | Active Time ladder + "Done for today" | H | H | M | M |
| 2 | Weekly Leagues on capped Active Minutes | L | H | H | L |
| 3 | Career Level across all sports and modes + permanent Career Road | M | H | H | L |
| 4 | Daily Challenge "one a day" + share card | H | H | M | M |
| 5 | Post-match "One More" sequence (all modes) † | H | H | M | M |
| 6 | Streak with shields, weekend mode, repair and milestones | M | H | H | S |
| 7 | First-5-minutes and first-week onboarding (Rookie Week) | H | M | L | M |
| 8 | Scout Drops: 3 free surprise rewards a day, odds shown | H | M | M | S |
| 9 | App-wide next-best-action engine | M | H | M | M |
| 10 | Prestige per sport (and per card) | L | M | H | M |
| 11 | Hot Hand win streak bonus | M | M | L | S |
| 12 | Rivals and friends (Nostr follows, "near me" boards, friend quests) | L | M | H | L |
| 13 | Weekly Showdown events with modifiers, repeating | L | H | M | M |
| 14 | Draft meta-progression (Front Office Points) + Heat | M | M | H | M |
| 15 | Notifications and home-screen badge (opt-in, max 1 a day) | L | H | M | M (badge S) |
| 16 | Comeback "Rested" bonus + 5-day return missions | L | L | H | S |
| 17 | Lifetime milestones + All-time Hall of Fame + season recap card | L | M | H | S |
| 18 | Clubs with co-op weekly goal (personal cap) | L | M | H | XL |
| 19 | Juice pass on match and results feedback | H | M | L | M |
| 20 | Card and team Mastery | L | M | H | M |
| 21 | Scenario Road per sport (3-star moments) | M | M | M | L |
| 22 | Healthy-play kit (break reminder, quiet hours, playtime panel) | L | L | M | S |

### 9.2 Each recommendation in detail

**1. Active Time ladder + "Done for today" (M).**
- *What:* A daily ladder of chests that unlock at 5, 15, 30, 60 and 90 active minutes, with a weekly ladder on top. The headline is "Play an hour a day, earn a Gold Pack a day." It ends with an explicit "Done for today" card. Full spec in §10.
- *Why:* It answers the owner's request directly.
  - Twitch-style front-loaded tiers (15–30 min first reward) ([Twitch](https://dev.twitch.tv/drops/)).
  - Persistent daily caps (Mistplay's 2 h cap; the IdleRewards relog bug).
  - Input-based AFK exclusion (Fortnite LEGO).
  - The cap and taper protect intrinsic motivation from the engagement-contingent effect ([Deci et al.](https://pubmed.ncbi.nlm.nih.gov/10589297/)).
- *Mapping:* One clock across NBA, NFL and Soccer. Time counts in arcade matches, draft picks and sims, UT matches, SBC building and pack opening.
- The 90-minute daily cap also gives the existing UT 8-paid-games cap a friendlier frame. When a player hits the paid cap, the copy becomes "Coins are done for today. Matches still count for League minutes and Career XP until 90 minutes."

**2. Weekly Leagues on capped Active Minutes (L).**
- *What:*
  - Six tiers: Rookie, Starter, Pro, All-Star, MVP, Hall of Fame.
  - Divisions of about 30 players.
  - The weekly score is capped Active Minutes (max 630).
  - Top 20% promote, bottom 20% relegate (except Rookie); everyone else stays.
  - Promotion chests.
  - The week ends Sunday 23:59 ET, matching `weekKey`. Spec in §10.5.
- *Why:* Duolingo leagues tripled its highly engaged learners and raised learning time 17% ([Lenny's](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)). Demotion creates the weekly stake ([DoF reference](https://duolingo.deconstructoroffun.com/mechanics/leagues)). Capping what counts prevents Diamond-style XP farming ([Kotaku](https://kotaku.com/duolingo-app-cheats-hacks-leagues-xp-why-duohacker-1850506482)).
- *Mapping:* All modes and sports feed one league. A per-sport filter shows "your NBA minutes", but promotion uses the total.

**3. Career Level across all sports and modes + permanent Career Road (L).**
- *What:*
  - A single account level (Career XP from every match, draft run, SBC and pack).
  - A 100-level **Career Road** that never resets, with rewards every level: coins, packs, arena unlocks, profile frames, the next sport's features.
  - The existing per-mode levels stay as sub-tracks.
- *Why:*
  - Clash Royale's non-resetting Trophy Road with a separate Ranked season ([Supercell](https://supercell.com/en/games/clashroyale/blog/release-notes/june-update-2025/)).
  - Marvel Snap's Collection Level as the single spine of progress ([DoF](https://www.deconstructoroffun.com/blog/2023/5/23/marvel-snap-the-definitive-deconstruction)).
  - SDT competence ([Ryan et al.](https://link.springer.com/content/pdf/10.1007%2Fs11031-006-9051-8.pdf)).
- *Mapping:* Gives a reason to try the other two sports ("Level 12: Soccer UT unlocks a free Gold Pack"). The existing "LEVEL 19" header ring becomes this level.

**4. Daily Challenge, one a day + share card (M).**
- *What:*
  - Each sport has one seeded 60–120-second scenario per day, the same for everyone. Examples: "NFL: 4th & 2, 1:12 left, down 4"; "NBA: down 3, 24 s"; "Soccer: 90+3', win a penalty shootout".
  - Three attempts, best one counts, on a daily board.
  - The result is a spoiler-free emoji-style grid (rendered as SVG and shared as text with a link), for example `PS NFL #214 🏈 TD in 3 plays ⏱0:41 ⭐⭐⭐`.
  - The existing Daily draft gets the same share card.
- *Why:* Wordle's single shared daily puzzle and built-in share grid drove its growth ([Syntax](https://syntax.fm/show/430/creator-of-wordle-josh-wardle/transcript)). It is a 3-minute ritual with a natural stopping point.
- *Mapping:* Reuses the arcade engines with a seeded start state. A daily board already exists in `leaderboard.ts` (`kind: 'daily'`), so this is a new kind.

**5. Post-match "One More" sequence, all modes (M) †.**
- *What:* Every match and draft season ends in a fixed order:
  1. Score.
  2. Count-ups: coins, Career XP, Active Minutes, league position change.
  3. Bars filling, with honest near-miss chips ("2 min to your Gold Pack", "1 win to Pro").
  4. **"Next game" or "Run it back" as the primary one-tap button.**
- *Why:* Hades makes the end of a run something to look forward to ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)). Brode: "little victories add a little joy, even if you lose" ([mobilegamer.biz](https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/)). Audit M3. UT doc §8.12 gives the UT version; extend it to draft and arcade.

**6. Streak with shields, weekend mode, repair and milestones (S).**
- *What:* Extend the existing daily streak (`nextStreak` in `missions.ts`):
  - **one match keeps the streak** (not all dailies);
  - 1 free Shield a week, holding up to 2;
  - a "Weekend Off" toggle;
  - a free **Streak Repair** within 48 h after 3 matches;
  - milestone celebrations at 3, 7, 14, 30, 50, 100 and 365 days;
  - an optional **wager** after day 7: stake 300 coins on reaching +7 days and win 600.
- *Why:* Every element has a measured Duolingo lift (§4.3), for example Wager D7 +14% ([Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)).
- *Ethics:* The wager uses earned coins only, is a skill/consistency commitment (not chance), and is opt-in. If testing shows minors misuse it, turn it off for everyone.

**7. First five minutes and first week: Rookie Week (M).**
- *What:*
  - **Minute 0–1:** pick a sport, and you're *in a match* within 60 seconds. Short controls overlay, opponent on easy, and the first possession is scripted to score.
  - **Minutes 2–4:** a free Starter Pack, opened with full cinema.
  - **Minute 5:** first streak day, Career Level 2, the Daily Challenge teased.
  - **Days 1–7:** a "Rookie Week" start-dash with 3 tasks a day across modes. Day 7 pays a Player Pick (82+), with the reward shown from day 1.
  - Ask for notification permission only after day 1 ends, from a button.
- *Why:* GameRefinery's FTUE best practices and start-dash missions ([Part 1](https://www.gamerefinery.com/first-impression-seals-the-deal-onboarding-best-practices-part-1), [Part 2](https://www.gamerefinery.com/keep-your-players-coming-back-introducing-onboarding-best-practices-part-2/)). Session-1 to session-2 conversion is the leading indicator of D1 ([Playio](https://blog.playio.co/mobile-game-onboarding-retention)). Audit M7.

**8. Scout Drops: 3 free surprise rewards a day, odds shown (S).**
- *What:*
  - The first 3 wins each day (any mode) each grant a Scout Drop. The first starts one tier higher.
  - Tap to reveal. Each tap has a shown chance to upgrade a tier (Common 20%, Rare 25%, Epic 30%).
  - Contents: coins, Career XP boosts, Scout Stamps, a rare pack.
  - After 3 a day, wins still pay normally.
- *Why:* Brawl Stars' D30 recovery began when randomised Starr Drops returned ([mobilegamer.biz](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)). Clash Royale's 3-a-day Lucky Drops replaced timers ([RoyaleAPI](https://royaleapi.com/blog/rip-chests-2025-q1-update); [Supercell](https://supercell.com/en/games/clashroyale/blog/release-notes/game-update-lucky-drops)).
- *Ethics:* Free, capped at 3, odds visible, truthful animation.

**9. App-wide next-best-action engine (M).**
- *What:* One function ranks candidate actions across all sports and modes and powers:
  - the main Home hero;
  - the post-match button;
  - the session-end teaser;
  - notification content.

  Priority order: claimables, then an unfinished run, then streak at risk, then 1–2 steps from a milestone (time ladder, league promotion, Career level), then the Daily Challenge not yet played, then the event ending within 24 h, then "Play {favourite sport}". Personalise by recent sport and mode share.
- *Why:* The UT doc's §8.12 hero, generalised. Goal-gradient (UT doc §7). "Always feel close to the next milestone" ([PocketGamer.biz](https://www.pocketgamer.biz/burnout-is-essentially-design-failure-the-mobile-mavens-weigh-in-on-player-burnout/)). Fixes audit H4 (Home doesn't surface UT claimables).

**10. Prestige per sport, and per card (M).**
- *What:*
  - At Career Road level 100 in a sport track (or at a sport's top ladder rank), **Prestige**: a permanent star on your badge, a neon frame tier, and continued "Prestige Points" for a separate board.
  - Never resets, never drops.
  - Card prestige: a card at max level can be prestiged for a cosmetic finish and +1 to its card level cap, applied by UID so IDs never change.
- *Why:* Brawl Stars moved from hated trophy resets to permanent Prestige ([Supercell](https://supercell.com/en/games/brawlstars/blog/release-notes/release-notes-february-2026)). Hypercharge-style new mountains lift D30 ([mobilegamer.biz](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)).

**11. Hot Hand win streak (S).**
- *What:* Consecutive wins in any mode raise a flame meter: 2 wins +10% match coins, 3 wins +20%, 5+ wins +30% plus a cosmetic on-court flame trail. One loss drops it one level instead of to zero (a built-in "timeout").
- *Why:* Win-streak systems in Candy Crush and Royal Match ([DoF](https://www.deconstructoroffun.com/blog/2024/8/5/win-streak-the-gift-that-keeps-on-giving)). NBA 2K's Triple Threat streak rewards ([2K](https://support.nba2k.com/hc/en-us/articles/41854043835411-NBA-2K-Win-Streak-Rewards-in-Triple-Threat-Park)). The step-down protection follows Duolingo's flexibility finding.

**12. Rivals and friends (L).**
- *What:*
  - Follow players by Nostr pubkey: QR code or a share link from the Daily Challenge card.
  - A "Friends" tab on every board.
  - Auto-assigned weekly **Rival**: the player just above you in your league, with "beat them by Sunday" chips.
  - **Friend Quest:** two friends co-op a weekly target ("combined 300 Active Minutes") for a shared pack.
- *Why:* SDT relatedness. Duolingo Friend Quests ([DoF](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth)). Relative boards help mid and low ranks ([HKU](https://hub.hku.hk/bitstream/10722/368255/1/content.pdf)).
- *Ethics:* No "you let your friend down" messaging. Quest progress is celebratory only.

**13. Weekly Showdown events with modifiers, repeating (M).**
- *What:*
  - A Friday–Sunday event with a rule twist: "Overtime Only", "Legends Era draft", "Big Heads", "3-point contest scoring", "2-minute drill", "Golden Goal".
  - A 5-win reward track, plus a Showdown board.
  - The rotation is published 4 weeks ahead and modifiers repeat. Tie them to real sports calendar dates (§7).
- *Why:* Predictable rhythm and novelty without FOMO ([PocketGamer.biz](https://www.pocketgamer.biz/burnout-is-essentially-design-failure-the-mobile-mavens-weigh-in-on-player-burnout/)). Marvel Snap's limited modes; Brawl Stars' rotating events.
- *Protocol:* Online H2H modifier rounds need a queue/protocol bump per sport.

**14. Draft meta-progression and Heat (M).**
- *What:* Front Office Points from every draft run unlock small permanent perks for *Classic* runs. Optional Heat modifiers multiply the score on a separate Heat board. Detail in §6.
- *Why:* Hades' Mirror and Heat. "Death is progress" ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)). Vampire Survivors' between-run gold ([The Conversation](https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613)).
- *Mapping:* Draft Classic and Blind in all 3 sports. Keep Daily and H2H boards perk-free for fairness.

**15. Notifications and home-screen badge (M; badge alone S).**
- *What:* Opt-in from a button at a moment of value. At most 1 push a day and none in quiet hours (21:00–08:00 local). A per-type toggle in settings. Message types, in priority order:
  1. streak saver (2 h before reset, only if the streak is ≥ 3 days);
  2. "League ends in 3 h — you're 1st in the stay zone, 12 minutes from promotion";
  3. "Your Daily Challenge is ready";
  4. "Rewards waiting".

  Rotate templates with a simple epsilon-greedy bandit; success is a session within 2 h. Use `navigator.setAppBadge(claimables)` for the icon count.
- *Why:* Duolingo's streak saver was its first big streak win, and the push channel was protected by policy ([Lenny's](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)). Bandit rotation per [Yancey & Settles](https://research.duolingo.com/papers/yancey.kdd20.pdf). iOS PWA push rules per [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and [WebKit badging](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/).
- *Build note:* Push needs a sender holding the VAPID private key: a small scheduled function (for example on the existing Supabase project) holding only push subscriptions. Never send emails or personal data. The badge alone needs no server.

**16. Comeback "Rested" bonus and return missions (S).**
- *What:*
  - After 3 or more days away, a **Rested** banner doubles the return day's 5, 15 and 30-minute time-ladder rewards and adds a one-time +60 AM to the weekly ladder (§10.3).
  - A 5-day "Back in the Game" mission set with a choose-1-of-3 main reward (82+ Player Pick, Premium Pack, or a cosmetic).
  - The streak can be revived once by playing 3 matches (Duolingo Revival).
- *Why:* WoW rested XP ([Warcraft wiki](https://warcraft.wiki.gg/wiki/Rested)). GameRefinery's returning-player missions and buffs ([GameRefinery](https://gamerefinery.com/four-ways-how-mobile-games-re-engage-lapsed-players)). Duolingo Streak Revival ([Pulse 2.0](https://pulse2.com/duolingo-daily-active-users-reach-58-7-million-as-retention-hits-record-84-and-social-accounts-top-1-billion-organic-impressions/)).

**17. Lifetime milestones, Hall of Fame and season recap (S).**
- *What:*
  - Lifetime Active-Hour badges (§10.4).
  - An all-time board shown as tiers with rank, plus a "Hall of Fame" wall.
  - Every 6-week season and every December, a shareable **Season Recap** card: hours (capped), favourite sport, best pull, best run, longest streak, percentile versus the median player.
- *Why:* Steam Replay's median comparison and tiers ([PC Gamer](https://www.pcgamer.com/steams-2023-year-in-review-breaks-down-exactly-how-you-blew-the-past-12-months-on-videogames)). Status beats power for long-term time (§5.4).

**18. Clubs with a co-op weekly goal (XL).**
- *What:*
  - Clubs of up to 20, created by invite link.
  - A weekly **Club Drive**: members' Active Minutes and wins fill shared tiers. Each member's contribution caps at 120 minutes, but everyone who contributed ≥ 30 minutes gets every unlocked tier.
  - A club chat is optional and later (moderation cost).
- *Why:* Clash of Clans' Clan Games (personal cap plus shared tiers) ([Supercell](https://supercell.com/en/games/clashofclans/blog/news/the-next-clan-games-are-coming/)). Brawl Stars' Mega Pig, an easier group goal that lifted D30 ([mobilegamer.biz](https://mobilegamer.biz/supercell-explains-brawl-stars-big-comeback-from-an-all-time-low-to-8-8x-revenue/)).
- *Build note:* Group membership and moderation on Nostr is the expensive part. Ship after leagues.

**19. Juice pass (M).**
- *What:* Hit-stop (60–90 ms) on dunks, sacks, tackles and goals; a camera punch; score and stat pops; crowd swell; streak flames; results count-up ticks with rising pitch. Reduced motion turns movement off and keeps the sound.
- *Why:* "Juice It or Lose It" ([GDC Vault](https://gdcvault.com/play/1016789/Juice-It-or-Lose)). Balatro's feedback ([GamesRadar](https://www.gamesradar.com/exploring-balatros-hype-its-ingenious-twists-on-poker-and-its-mysterious-creator)). SDT competence is tied to how intuitive the controls feel.

**20. Card and team Mastery (M).**
- *What:* Playing with a card earns Mastery stars (1–5) for cosmetic badges on the card face, plus a tiny chemistry nudge capped well below promo deltas. Team mastery comes from wins with a franchise's players. Draft mode credits mastery to the real player id.
- *Why:* Brawl Stars mastery and Marvel Snap's cosmetic-progress fusion ([DoF](https://www.deconstructoroffun.com/blog/2023/5/23/marvel-snap-the-definitive-deconstruction)). This is the "investment" step in Hooked: cards *you* used become yours.
- *Protocol:* Any chemistry effect in online H2H needs a UT queue bump. Making it cosmetic-only avoids that.

**21. Scenario Road per sport (L).**
- *What:* 60 bite-size scripted moments per sport with 1–3 stars and visible star conditions (Score! Hero minus energy and hidden criteria). Stars gate "chapters" and pay Career XP.
- *Why:* Score! Hero's replay pull and its documented frustrations ([TouchArcade](https://toucharcade.com/community/threads/267750)). Also gives D1 players a solo path that doesn't need UT knowledge.

**22. Healthy-play kit (S).**
- *What:* Break reminder (60 active minutes, at the next stoppage), quiet hours, a playtime panel (today and week, raw and counted), the "Done for today" states, and a board opt-out.
- *Why:* ICO wellbeing nudges ([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/)). Nintendo break prompts ([Kill Screen](https://www.killscreen.com/should-more-games-tell-us-stop-playing-and-do-something-else/)). Duolingo's pacing finding. It makes #1 and #2 defensible.

---

## 10. The time-played system: full spec

### 10.1 What counts as active time

Count **Active Seconds** with a 1 Hz ticker using `performance.now()` deltas, not the wall clock. A second counts only when **all** of these hold:

1. `document.visibilityState === 'visible'` and the window has focus ([Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)). `visibilitychange` is already used in `App.tsx` and `net/match.ts`.
2. **Only one tab ticks.** A `BroadcastChannel` or `localStorage` lock elects one ticking tab per device, which stops multi-tab farming.
3. **The context is an activity**, with these input-recency rules:

| Context | Counts if | Notes |
|---|---|---|
| Live arcade match (any sport) | A gameplay input in the last **45 s** | Auto-defend plays itself, so require an *offense* or *menu* input in the window. Paused matches don't count |
| SIM / auto possessions | Counted at **real elapsed time** only | A simmed drive that takes 4 s counts 4 s |
| Draft picks, re-spins, lineup | An input in the last **30 s** | |
| Draft season sim / playoffs viewing | Counted while it animates, max **3 min per run** | Prevents leaving the sim on loop |
| UT: squad, SBC, pack opening, store, card detail | An input in the last **20 s** | |
| Menus, hubs, boards, settings | An input in the last **20 s** | **Menu seconds can be at most 25% of the day's counted total** |
| Online queue waiting | Up to **2 min per queue** | |
| Replays and highlights | Up to **2 min per match** | |

4. **Banking:**
   - Match and draft-run seconds are held as *provisional* and **banked only when the match or run completes**, or after a forfeit if the match had run ≥ 2 minutes. Quitting at the opening tip repeatedly banks nothing.
   - Menu and UT-builder seconds bank every 60 s.
5. **Idle:** with no input for 60 s outside a match, ticking stops. After 5 minutes idle the session is marked paused, and the next input starts a new session (for break-reminder purposes).

The raw *in-app* time (visible and focused, regardless of input) is tracked separately and **shown only to the player** in the playtime panel. Rewards, boards and leagues all use **Active Minutes (AM)** = banked Active Seconds ÷ 60, capped as below.

### 10.2 Caps and diminishing returns

- **Daily cap: 90 AM.** Seconds above 90 minutes still count for Career XP (from matches) and the private raw total. They don't count for the time ladder, leagues or time boards.
- **Day boundary:** the app's existing Eastern-time day key, so the reset matches the daily draft, streak and weekly boards. Notifications and quiet hours use local time.
- **Shape:** most of the value lands by 30 minutes, the headline lands at 60 and a token at 90. Zero after that. This is a voluntary version of the 3 h / 5 h taper, without the adult backlash ([China Daily](https://covid-19.chinadaily.com.cn/china/2007-04/10/content_846715.htm)).
- **Weekly cap:** 630 AM (7 × 90), implied by the daily cap.
- **State:** the per-day AM ledger is stored in the saved profile (additive, optional state; no new storage keys renamed), keyed by day, so relaunching can't reset it (the IdleRewards lesson).

### 10.3 Reward ladder: daily and weekly

The economy assumptions come from the brief:
- a Gold Pack costs about 750–1,500 coins (the current code's NBA/NFL Gold is 900, and Premium is 1,800);
- a strong player earns about 1,000–2,000 coins an hour from play;
- pack quick-sell value is roughly 45–60% of price (UT doc).

Target: for the **first hour of a day**, time rewards are worth about half of what a strong player earns from play in that hour (more, relatively, for a casual player). The headline is one Gold Pack a day. Rewards fall to **zero beyond 90 minutes**, so over a long session play income dominates.

**Daily "Warm-Up" ladder** (claim from the Home chip or the post-match sequence):

| Active minutes today | Reward | Running total |
|---|---|---|
| 5 | 50 coins | 50 |
| 15 | 100 coins | 150 |
| 30 | 150 coins + 1 Scout Stamp | 300 + stamp |
| **60** | **Gold Pack** (untradeable; store price ~900, quick-sell EV ~450) | 300 + stamp + Gold |
| 90 | 100 coins + "Done for today" card | 400 + stamp + Gold |

**Weekly "Season Ticket" ladder** (ISO week, Mon–Sun, ET; counted AM, so the max is 630):

| Weekly AM | Reward | Who reaches it |
|---|---|---|
| 60 | 300 coins | Plays 10 min a day most days |
| 150 | Gold Pack | 30 min a day, 5 days |
| 300 | **Premium Gold Pack** (~1,800) | 45 min a day, most days |
| 450 | **Player Pick: 1 of 3 golds, 82+** | 65 min a day, or 90 min on 5 days |
| 600 | 1,000 coins + weekly badge flair ("Iron Man week") | About 86 min every day; only daily, consistent players |

**Weekly totals by player type** (worked out from the tables above):

| Player | Week | Time rewards | Real value* |
|---|---|---|---|
| Casual: 30 min/day, 5 days | 150 AM | 1,800 coins, 1 Gold, 5 stamps | ~2,250 |
| Engaged: 60 min/day, 7 days | 420 AM | 2,400 coins, 8 Gold, 1 Premium, 7 stamps | ~6,900 |
| Max: 90 min/day, 7 days | 630 AM | 4,100 coins, 8 Gold, 1 Premium, 1 Player Pick, 7 stamps | ~9,600 |

\*Real value counts packs at ~50% quick-sell EV and a Player Pick at ~1,000.

**Sanity check against play income.** The engaged player's 7 hours of play at 1,000–2,000 coins an hour earns 7,000–14,000 coins. Time rewards add roughly 50–100% on top in real value, mostly as packs, the thing players want.

That is deliberately generous, because the owner asked for rewards that are "worth it". But it is front-loaded and capped. A strong player who plays 3 hours in one day earns 3,000–6,000 coins from play and only the fixed daily ladder from time.

**Tuning levers** (check with `economy.test.ts` against the UT doc's intended pull rate):
1. Make the 60-minute reward "Gold Pack *or* 900 coins (player's choice)".
2. Give the Gold Pack on 5 of 7 days, alternating with a Silver Pack.
3. Drop the weekly 150 tier to 500 coins.

Keep the headline "an hour a day earns a Gold Pack" if at all possible. It is the clearest promise in the system.

**Rested and comeback** (rec #16): on the first day back after 3 or more days away, the 5, 15 and 30-minute daily rewards are doubled, and the weekly ladder gets a one-time +60 AM credit. Breaks are rewarded, not punished.

### 10.4 Lifetime milestones

Lifetime milestones use **lifetime counted AM** (already capped at 90 a day, so 100 hours means at least 67 active days). They never reset.

| Lifetime hours | Badge tier | One-time reward |
|---|---|---|
| 1 | Rookie | Gold Pack |
| 5 | Starter | 2,000 coins |
| 10 | Pro (bronze frame) | Premium Gold Pack |
| 25 | All-Star (silver frame) | Player Pick 1 of 3, 84+ |
| 50 | MVP (gold frame) | Profile banner + animated name plate |
| 100 | Hall of Famer (platinum frame) | Exclusive card *finish* (cosmetic overlay applied by UID to one card of your choice) |
| 250 | Legend (diamond) | Legend title + Hall of Fame wall entry |
| 500 / 1,000 | Icon / GOAT | Cosmetic-only: neon frame, crown on board rows |

Power-type rewards stop at 25 hours. Everything beyond is status, which keeps the game fair for new players and avoids rewarding grinding with power (§5.4).

### 10.5 Leaderboards and leagues

**A. Weekly Active board (global and "near me").**
- Score is the week's counted AM, max 630.
- Ties are broken by days active (more first), then matches completed, then earliest time of reaching the score.
- A **MAX** badge marks 630.
- Default view is "near me": you, 2 above, 2 below, and the top 3. Tabs for Global, Friends and per sport (per-sport AM is filtered; the cap still applies to the total).
- Rewards for the global top are cosmetic only (a "Top 100 this week" flair). Packs come from the ladder and leagues so everyone can earn.

**B. Leagues** (the main competitive hook):
- **Tiers:** Rookie, Starter, Pro, All-Star, MVP, Hall of Fame. New players start in Rookie.
- **Division size:** 30. On Nostr, with no central server, a division is computed deterministically:
  - `division = hash(pubkey + weekKey) mod D[tier]`, where `D[tier]` = ceil(last week's active players in the tier ÷ 30), published as a constant per week.
  - Simplest version: use last week's board entries to compute it, with a floor of 1.
  - Every client computes the same grouping.
  - Grouping by similar prior-week activity and time zone (Duolingo) can come later by sorting on last week's AM before chunking.
- **Score:** weekly counted AM (same cap). An optional later variant adds "wins × 5" so competitive players have an edge. Keep v1 pure time, as the owner asked.
- **Movement:**
  - top 6 of 30 (20%) promote;
  - bottom 6 relegate (not from Rookie);
  - anyone with 0 AM is removed from the division view (no shame at the bottom);
  - at Hall of Fame, the top 3 earn a "Champion" crown for the week.
- **Rewards at week end:**
  - Promote: Gold Pack (Rookie→Starter) up to a Player Pick 84+ (MVP→HoF).
  - Stay: 300 coins.
  - Finish 1st: an extra Premium Pack.
  - Relegate: nothing is taken away.
- **Week end:** Sunday 23:59 ET. Show the countdown in the last 24 hours (Duolingo's final-hours rush). A notification only fires if you're within 15 AM of the promotion line and have notifications on.
- **Season:** 6 weeks. At season end, everyone above Pro drops one tier (soft reset), and a season badge shows your highest tier.

**C. All-time board (Hall of Fame).**
- Score is lifetime counted AM, ranked, but displayed with tier badges (§10.4).
- Defaults to "near me" plus the top 10. It is a loyalty wall: early adopters will lead it, and that's fine.

### 10.6 Anti-farm and integrity rules

| Threat | Rule |
|---|---|
| Leave the app open | Input-recency per context (§10.1); idle stops the tick; visibility/focus required |
| Start a match and idle | Match time banks only on completion or a forfeit after ≥ 2 min; 45 s offense-input requirement; auto-defend alone doesn't count |
| Loop the draft sim | Max 3 min of sim viewing counted per run |
| Menu idling | Input recency of 20 s; menus ≤ 25% of the day's counted time |
| Multiple tabs | A single-ticker lock across tabs |
| Relaunch to reset caps | The daily ledger lives in the saved profile, keyed by ET day |
| Clock tampering | Intervals from `performance.now()`. If the device date goes backwards or a day key repeats, freeze AM accrual for that day. Board entries must have `created_at` within the claimed week, and relays stamp receipt |
| Forged board entries (Nostr) | Entries carry `{ v, name, week, perDay: [7 ints], matches, runs }`. Clients reject an entry when: any `perDay[i] > 90`; the sum is above `90 × days elapsed`; `perDay` is non-zero for a future day; or `matches + runs` is implausible for the minutes (for example more than 25 counted minutes per completed activity on average, or fewer than 1 activity per 12 minutes in a day above 30 AM). Updates are rate-limited to one per 5 min. The existing owner `BLOCKED` list in `leaderboard.ts` stays the manual backstop |
| Bots and automation | v1 relies on plausibility checks plus blocks, and states openly that a determined spoofer can fake a capped number. **The cap limits the damage to "appears to play 90 min a day"**, which caps the advantage of cheating at what an honest regular can reach |
| Alt accounts | Rewards are per profile and cosmetic at the top. Leagues give packs only to that profile, so alts earn nothing transferable (no trading) |
| QA and live isolation | All new boards use the existing `NS_SUFFIX` namespacing. QA runs with `?ns=inspect` against a local relay and never writes to live relays (brief constraint) |

### 10.7 Copy and UX

- **Home chip:** "⏱ 23 / 30 min · 250 coins next", with a ring that fills. At 60: "Gold Pack ready!" At 90: "✔ Done for today. Great session."
- **Post-match:** "+4 active min (now 27). 3 more for your Scout Stamp."
- **Weekly tile:** "Season Ticket 212 / 300 · Premium Pack at 300 · resets Sun".
- **League tile:** "Pro League · 8th of 30 · Promotion line: 6th (+14 min) · 2d 4h left".
- **Never:** "Don't lose your progress!", or red guilt states.
- **Explainer sheet (one screen):** "How active time works: we count time you're actually playing, up to 90 minutes a day. Menus count a little. Idle time doesn't count. Rewards stop at 90 minutes so you can do other things. Matches still pay coins as usual."

---

## 11. How to measure it (ship with instrumentation)

The app has no analytics backend and shouldn't send personal data. Use **local, privacy-safe counters** in the profile (day of install, days active, sessions, AM per day, D1/D7/D30 returns). Optionally publish an **anonymous aggregate** by opt-in. Track:

| Metric | Target |
|---|---|
| Session 1 → session 2 conversion | ≥ 70% |
| D1 / D7 / D30 retention (installed PWA cohort) | ≥ 40% / 15% / 6%; top-decile per [GameAnalytics 2025](https://investgame.net/wp-content/uploads/2026/01/2026-01-20-Mobile_retention_benchmarks_2026.pdf) |
| Share of DAU with a 7+ day streak | ≥ 35% at 3 months (Duolingo reached more than half over years) |
| Median AM per active day | 20–35 min. If the median sits at 90, the cap is too low or rewards too high: rebalance |
| League participation (≥ 1 AM in week) | ≥ 60% of weekly actives |
| Daily Challenge play rate and share-tap rate | ≥ 50% of DAU play; ≥ 5% of players share |
| Healthy-play guardrails | Under 10% of players hitting the 90-min cap on 6+ days a week; break-reminder dismiss rate tracked; 0 notifications in quiet hours |

**A/B where possible**, in Duolingo style. A local deterministic split by pubkey hash is enough for UI copy and reward-size tests, and needs no server.

---

## 12. Suggested build order

**Phase 1 (2–3 weeks), the "freshen-up" pack:**
- #1 Active Time ladder + "Done for today"
- #5 One More sequence (all modes)
- #6 Streak shields and repair
- #8 Scout Drops
- #11 Hot Hand
- #22 Healthy-play kit
- the badge part of #15

Mostly S/M, all local. Visible on day one.

**Phase 2 (3–5 weeks):**
- #4 Daily Challenge + share
- #3 Career Level and Road
- #9 next-best-action engine
- #7 Rookie Week
- #16 Rested/comeback
- #17 lifetime milestones and Hall of Fame

**Phase 3 (5–8 weeks):**
- #2 Leagues (Nostr divisions)
- #12 Rivals and friends
- #13 Weekly Showdowns (protocol bumps)
- #14 Draft meta and Heat
- #15 push sender

**Phase 4:**
- #10 Prestige
- #20 Mastery
- #21 Scenario Road
- #18 Clubs

**Constraints to respect in every phase:**
- New state is additive and optional; never rename storage keys or IDs.
- Use `pick({ nba, nfl, soccer })` for per-sport numbers.
- Bump the online protocol for any rule change that two clients could disagree on (modifiers, chemistry from mastery).
- Use QA isolation for boards.
- No real money, ever.

---

*All sources are cited inline at the point of use.*
