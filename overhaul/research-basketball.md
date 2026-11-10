# Basketball track research: what the respected games do, and what Perfect Season's hoops2 should do

Research agent, 2026-11-09. No repo files were changed. Sources are cited inline. Where only community testing or one secondary source exists, the text says so. Official 2K pages (nba.2k.com) returned HTTP 403 to the fetcher, so their content is quoted through search summaries and mirrors (NBA2KLab, GamingBolt and others), and those are cited instead.

Context read from the repo (read-only) so the recommendations fit the real engine. In `src/game/hoops2` the user plays offense only, 16 possessions (8 a half) on a 14 s shot clock. A jumper's meter top is 0.52 s and a layup's 0.42 s. The best open green half-window is 36 ms (`GREEN_W`), so about 72 ms in total, and 84 ms on a rhythm catch. Contests are open, light, heavy and smothered, which scale the window ×1 / 0.7 / 0.4 / 0.15. Players catch fire after 3 straight makes (×1.2 window). Badges are tiered with 2K26's thresholds. The defensive looks are man, sag, switch and trap, and the play calls are screen, cut and space. The simulated score in `engine/broadcast.ts` uses a mean total of 206 ± 17, uniformly distributed, and SIGMA = 11.5.

---

## 0. The 20 things that matter most

1. **Timing is the game.** In 2K the green window opens about 500–565 ms after the press. It is narrow: about 15–35 ms "pure" on console, about 40–60 ms where makes are possible ([NBA2KLab 2K26](https://www.nba2klab.com/videos/nba-2k26-how-to-shoot), [Prism/NBA2KLab](https://www.prismnews.com/hobbies/nba-2k/nba2klab-says-nba-2k26-shot-timing-still-hinges-on), [NBA2KLab green windows](https://www.nba2klab.com/green-windows)). Our 0.52 s top is right. Our open window is about 2× console width, which is correct for touch. Keep it.
2. **Openness, rating and timing are separate dials.** 2K26 shot feedback reports all three, and an "Excellent" release on a wide-open shot by a good shooter is an instant green ([Mike Wang FAQ via NBA2KLab](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Our feedback should name the dial that failed.
3. **The green window should move, not only shrink.** Fatigue, low adrenaline, contests, distance and a moving shot move the window's position, and contests and adrenaline also narrow it ([NBA2KLab](https://www.nba2klab.com/green-windows)). Draw the moved slice on the meter so it stays fair.
4. **Meter-off bonus.** Turning the meter off gives a slightly bigger window: about 20% in 2K25 per one guide, "slightly" per the 2K26 developer, about 10 points per NBA2KLab ([Escapist](https://www.escapistmagazine.com/does-turning-off-shot-meter-still-give-20-green-window-in-nba-2k25/), [FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Add a "Cue only" meter mode with a +10% window.
5. **Rebound timing cue.** 2K26 flashes a green indicator for a well-timed rebound jump, just before the ball's last bounce off the rim. If both players time it, position, ratings and height decide ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Add this to our BOARD button.
6. **Rating-tiered moves.** The momentum crossover has three tiers by Ball Handle: 85+, 60–84 and under 60 ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Spamming escape moves drains an adrenaline bar. Give our CROSS, STEP BACK and SPIN three visible power tiers and a per-possession budget of pips.
7. **Animation must never steal control.** The loudest complaint about 2K for a decade is canned, locked animations ([NLSC](https://www.nba-live.com/mto-canned-moments-the-myth-of-the-skill-gap/), [2K17 patch](https://www.gameinformer.com/b/news/archive/2016/11/22/latest-nba-2k17-patch-cleans-up-dribbling-animations.aspx)). Every move needs a cancel point within about 150 ms.
8. **Touch is the weak point of every mobile basketball game.** GameSpot found 2K Arcade Edition's touch controls "too sensitive at best and non-functional at worst" ([GameSpot](https://www.gamespot.com/reviews/nba-2k21-arcade-edition-review-air-ball/1900-6417676/)). A 2K14 review found the joystick "overcompensates", while the one-finger tap-to-pass, hold-to-shoot mode was "the best way" to play ([Pocket Gamer](https://www.pocketgamer.com/nba-2k14/review/)). Use a floating stick with a 12% dead zone, tap-a-teammate passing, and a large hold-to-shoot button.
9. **Auto-play must never beat manual play.** The main criticism of 2K Mobile was that auto mode played better than the player ([Pocket Gamer](https://pocketgamer.com/articles/079442/nba-2k-mobile-basketball-review/), [Wikipedia](https://en.wikipedia.org/wiki/NBA_2K_Mobile)).
10. **Basketball on mobile needs a planning beat.** Deconstructor of Fun's analysis of NBA Live Mobile says basketball has no natural break between planning and execution. It recommends discrete, timed possessions with pre-set plays and tap-triggered abilities ([PocketGamer.biz](https://www.pocketgamer.biz/nba-live-mobile-why-ea-cant-replicate-madden-mobiles-success/)). We already have discrete possessions. Add three play cards per possession, as football has.
11. **Arcade games are remembered for one big hook.** NBA Jam's "On Fire" comes after 3 straight baskets with no opponent score in between. It ends when the opponent scores or after 4 more baskets ([Wikipedia](https://en.wikipedia.org/wiki/NBA_Jam_(2010_video_game)), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NBAJam)). Make ours a two-stage, visible "Heating Up" then "On Fire".
12. **Hoop Land is the closest model for us**: pixel art, phone, deep modes, 4.8★ from 18K ratings ([App Store](https://apps.apple.com/us/app/hoop-land/id1605197976)). It has play icons, tap-icon passing and switching, pump fakes, off-ball and defensive assist, a customisable button and joystick layout, and a distinct free-throw meter.
13. **Free throws are missing.** Real teams take 0.24 FTA per FGA ([Basketball-Reference 2024-25](https://www.basketball-reference.com/leagues/NBA_2025.html)). We award free throws only on and-ones. Add shooting fouls and a separate FT mini-meter.
14. **Transition is missing.** About 15.7% of real plays are transition, at about 1.22 points a play against 0.95 in the halfcourt ([Cleaning the Glass](https://cleaningtheglass.com/stats/league/context)). Seed fast-break possessions after simulated stops.
15. **Real per-possession targets for 2024-25:** 1.145 points a possession; per 16 possessions, 14.4 FGA, 6.0 3PA, 3.5 FTA, 2.3 TOV, 1.8 ORB, 4.3 AST and 18.3 points ([B-R per 100](https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html)).
16. **Shot mix (2024-25):** 22.6% at 0–3 ft (69.6% FG), 21.4% at 3–10 ft (46.1%), 9.1% at 10–16 ft (44.3%), 4.8% from 16 ft to the arc (40.0%), 42.1% threes (36.0%), and 24.3% of threes from the corner (38.8%) ([B-R](https://www.basketball-reference.com/leagues/NBA_2025.html)).
17. **The simulated score is too low and too narrow for modern teams.** Real total points averaged 227.6 in 2024-25 and 231.2 in 2025-26, but 194.4 in 2004-05 ([B-R](https://www.basketball-reference.com/leagues/NBA_stats_per_game.html)). Make the total era-aware with a standard deviation of about 17. The current uniform ±17 has an SD of only about 9.8.
18. **Hot zones** are worth about +5.4 points in a lethal zone and −2.1 in a cold one in 2K27 testing ([NBA2KLab](https://www.nba2klab.com/green-windows)). Derive our own from real season splits and show them on the card.
19. **Identity sells "who is who".** 2K25 added 9,000 ProPLAY animations, 1,100 of them signature shots ([NBA2KLab](https://www.nba2klab.com/nba-2k25-gameplay-courtside-report)). For us, build a per-player shot DNA (release speed, height, set point and fade), a dribble style and a finishing package, plus curated looks for marquee players.
20. **Short, daily, player-locked challenges** make good UT content. 2K Mobile's Rewind had up to 10 daily Top Plays built from real games, with targets scaled down: a real 45-point night becomes "5 points in a short span". Plays unlocked in a chain and leaderboards reset every two weeks ([NBA 2K Mobile](https://nba2kmobile.com/news/introducing-rewind)). This fits our pending "Flashbacks".

---

## 1. Console and PC: NBA 2K25 and NBA 2K26

### 1.1 Shooting and timing (the green window)

**Where the window sits.** Community tests of 2K24's Shot Timing Visual Cue put the green windows at about 500 ms (Jump), 501 ms (Set Point), 551 ms (Push) and 565 ms (Release) after the press. The cue only changes how long you hold; it does not speed up the animation ([Operation Sports, visual cue explainer](https://www.operationsports.com/nba-2k25-shot-timing-visual-cue-explained), [2K24 release timing](https://www.operationsports.com/nba-2k24-shot-release-timing-explanation)). 2K24 named its four cues Jump, Set Point, Push and Release, replacing the older Very Early through Very Late settings. 2K's own window and our `JUMPER_TOP = 0.52 s` sit in the same place.

**How wide it is.** These figures come from community testing:
- **2K26.** NBA2KLab measured two jumpers with pure windows of 35 ms and 20 ms. The window's timing depends on the jumper's animation and the distance from the basket ([NBA2KLab video](https://www.nba2klab.com/videos/nba-2k26-how-to-shoot)). Coverage of the same work says a make or a miss is decided inside about 40–60 ms, and the release point moves about 30–40 ms with animation and distance ([Prism News](https://www.prismnews.com/hobbies/nba-2k/nba2klab-says-nba-2k26-shot-timing-still-hinges-on)).
- **2K27.** The typical pure window is about 15–20 ms with no boosts. One example has a 19 ms pure window inside a 55 ms green window (515–570 ms), and anything outside it always misses ([NBA2KLab](https://www.nba2klab.com/green-windows)).
- **Rating effect, 30,700 shots.** The core band that almost always greens is ±3.1 ms at a 65 rating and ±3.6 ms at 99. The band with about a 70% make rate grows from ±5.8 ms to ±13.9 ms, which is 2.4× more room. Rating mostly forgives near misses; it barely widens the perfect core ([NBA2KLab](https://www.nba2klab.com/green-windows)).
- **Release speed.** Very Quick costs 12.1% of the window (the developer says 10%) and Quick costs 8.5% (5%). Each notch moves the window's centre about 15 ms ([NBA2KLab](https://www.nba2klab.com/green-windows)).

**Green or miss, and no RNG.** 2K26's developer FAQ says there is no RNG in shooting. In 2K19–2K24 only the centre of the window was pure, and makes fell from 100% to 0% toward its edges. In 2K26 any release inside the window goes in. Height does not change the window on open shots. Free throws are green or miss on All-Star difficulty and up. Turning the shot meter off slightly enlarges the window for jumpers and layups. The shot and layup risk-reward settings were removed ([Mike Wang FAQ via NBA2KLab](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). 2K25 instead had Shot Timing Profiles. Low Risk-Reward favoured ratings, openness and smart shots over button timing. High Risk-Reward was green or miss ([2K25 Courtside via search](https://nba.2k.com/2k25/courtside-report/gameplay/), [GameSided](https://gamesided.com/posts/new-nba-2k25-mechanic-will-make-open-shots-function-more-like-open-shots-01j4recnwc5s)).

**Rhythm shooting (2K25–2K26).** The player flicks the stick down and up. Pushing early or flicking fast rushes the animation and shrinks the tempo window. A late push hangs at the set point, and a slow flick gives a lazy follow-through ([GamingBolt](https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report), [FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Matching tempo enlarges the window, but the developer calls the bonus "not a massive boost" ([NBA2KLab](https://www.nba2klab.com/green-windows)). The tempo requirement makes the shot feel physical, which is why players like it.

**What moves or shrinks the window.** NBA2KLab's 2K27 list: stamina (a tired player releases later), adrenaline (low adrenaline slows the release and shrinks the window), distance, the catch animation, load-ups, contests (which move and narrow the window), starting ball position, set versus moving shots, and the jumper's grades ([NBA2KLab](https://www.nba2klab.com/green-windows)). 2K22's official deep dive had already moved to a dynamically resizing make window. It grows for good shooters taking good shots and shrinks when the shot is heavily contested, the shooter is low-rated or the player is fatigued. Shot IQ was the main factor in shooting success ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/)).

**Jumpshot grades** give each player's shot an identity. They are Release Height (against contests), Defensive Immunity, Release Speed (traded against window size) and Release Window. A+ release-window grades are about +10% and F grades about −10%, per the developer, not yet confirmed by testing ([NBA2KLab](https://www.nba2klab.com/green-windows)).

**Feedback vocabulary.** 2K22's feedback named timing in seven steps: Very Early, Early, Slightly Early, Excellent, Slightly Late, Late and Very Late ([Sportskeeda](https://sportskeeda.com/basketball/how-shoot-better-nba-2k22)). 2K26's full shot feedback shows the coverage percentage again ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). 2K27 feedback separates early or late timing from fast or slow tempo ([NBA2KLab](https://www.nba2klab.com/green-windows)).

**Player sentiment.** The shooting changes in 2K25 were "contested by community members" ([Dexerto review](https://dexerto.com/nba-2k/nba-2k25-review-nba-2k25-review-a-small-step-forward-but-not-a-slam-dunk-2978137)). In 2K26 one reviewer found shooting "so simplified that you can drain shots at a startlingly high rate", while others praised the enhanced rhythm shooting ([Heavy](https://heavy.com/sports/nba/nba-2k26-review-gameplay/)). On Steam, some players reported a make in only about 5% of attempts, and the meter setting kept turning itself back on ([Steam 1](https://steamcommunity.com/app/3472040/discussions/0/554627540143304308/), [Steam 2](https://steamcommunity.com/app/3472040/discussions/0/840627496100741753/)). The lesson: a window that is too tight feels like RNG even when it isn't, and a window that is too wide removes the skill.

### 1.2 Contests and shot coverage

- 2K22 completely rebuilt the contest system to remove ghost contests, where open shots were randomly contested. Being out of position, or not getting a hand up, gives up easy baskets ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/), [TheGamer](https://www.thegamer.com/nba-2k22-rebuilt-blocking-systems-reworked-dribbling/)).
- 2K24 weighted the defender's body position more heavily. Jumping early, biting on fakes and late closeouts are punished with fouls and and-ones ([Hoopsgamers 2K24](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)).
- 2K26 rebalanced hands-up, no-jump and jumping contests. A defender who jumps early and is landing when you release has much less effect, in the paint too ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). This is the "make him land" skill play.
- The sliders show how sensitive this is. One user reported that at a Shot Coverage Impact of 100, every open shot went in ([Operation Sports forum](https://forums.operationsports.com/forums/nba-2k-basketball-sliders/992535-shot-coverage-impact.html)). In 2K15, a mid-range shooter went from about 45% open and 10% heavily contested before a patch to about 60% and 20% after it ([OSFTW](https://www.osftw.com/features/2142/nba-2k15-fixing-broken-shot-forms-exposes-flaw-in-shooting-system/?page=3)).

**Real-world anchor for contest tiers on threes, 2024 tracking.** Wide open (6 ft or more) was 39.1%, open (4–6 ft) 35.0%, tight (2–4 ft) 29.7% and very tight (0–2 ft) 27.1%. This is a community calculation from NBA.com data and its method is not shown ([r/nbadiscussion](https://redlib.shreven.org/r/nbadiscussion/comments/1e0h4hl/the_creation_of_a3p_a_new_way_to_track_threepoint)). CBS put wide-open threes at 38.6% in an earlier season ([CBS](https://www.cbssports.com/nba/news/wide-open-3s-and-ranking-how-each-nba-team-fared-at-making-defenses-pay)). The real ratio from wide open to very tight is only about 0.69, because very tight threes are mostly taken by good shooters. The arcade game can and should punish contests harder than that ratio, but the averages in §6.1 keep it believable.

### 1.3 Finishing: layups, dunks, alley-oops

- Layup timing is always on in 2K26. Each player's signature package mixes layup styles: normal, reverse, floater, quick scoop, Euro step, hop step and spin ([GamingBolt](https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report)).
- The dunk meter is Turbo plus Pro Stick down. Open dunks, driving or standing, get much larger green windows, and the window adjusts dynamically ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). 2K22 added timing meters for alley-oops (press Shoot while the pass is in the air) and aggressive skill dunks ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/)).
- Rim protection: 2K22's block rebuild aimed to let rim protectors "send away weak shot attempts at will", with snatch blocks and volleyball spikes. In 2K26, a heavily contested big under the rim stumbles ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/), [FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)).
- Layup and dunk packages are gated by height and rating. 2K26 loosened some, such as allowing players under 6'10" ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)).

### 1.4 Dribbling, size-ups, ProPLAY

- **ProPLAY** builds animations from real NBA broadcast footage instead of mocap sessions. 2K25 added 9,000 new ProPLAY animations: 1,100 signature shots and 1,500 dribbling animations, plus a rebuilt dribble engine ([NBA2KLab](https://www.nba2klab.com/nba-2k25-gameplay-courtside-report), [review roundup](https://www.newgamenetwork.com/article/2809/nba-2k25-review)). In 2K26 ProPLAY drives motion styles, and the faster styles are gated by ratings ([Hoopsgamers](https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more)).
- **2K26 controls:**
  - A size-up without Turbo gives the player's signature size-up; with Turbo it gives escape combos. Flicking up while walking backwards gives a retreat size-up.
  - Momentum cross: flick up on the right stick, then sprint toward the off hand. It is full strength at 85+ Ball Handle, slower at 60–84 and weak below 60.
  - Misdirection: start a behind-the-back, cross, tween or hesitation, then hold Turbo and flick the other way before the first bounce.
  - How fast you move the stick sets the dribble speed. Game speed is about 10% faster than earlier titles ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)).
- **Adrenaline.** Spamming escape moves, or dexing back and forth to cut, drains a bar. Quick Protect costs nothing ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). In 2K24, a defender's bump on a drive knocked off the boosts, and losing them sharply cut shooting attributes ([Hoopsgamers 2K24](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)).
- 2K22 merged basic and signature size-ups into about 50 signature size-up packages and 32 dribble sequences. A quick flick gives faster dribbles ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/)).
- Reviews: Dexerto called 2K25's dribbling the best in years, and Game8 scored it 82 for smoother animation and better rewards for good defense ([Dexerto](https://dexerto.com/nba-2k/nba-2k25-review-nba-2k25-review-a-small-step-forward-but-not-a-slam-dunk-2978137), [Game8](https://game8.co/articles/reviews/nba-2k25-review)).

### 1.5 Defense, steals, help AI

- **On-ball.** 2K25 retuned on-ball defense. At lower difficulties, body-ups more often end in a blow-by ([2K25 Courtside via search](https://nba.2k.com/2k25/es-MX/courtside-report/gameplay)). 2K26 made interior defense more physical, with easier body bumps. Strength sets the chance of stonewalling a drive. Holding L2 for Quick Protect gives the handler more counters ([GamingBolt](https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report), [FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)).
- **Steals.** 2K26 almost entirely disabled canned pluck steals and improved on-ball steal targeting. A ball handler who is poked is briefly stunned. Posting up far from the rim leaves the ball very exposed ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). In 2K24, steals were directional: reach with the hand nearer the ball ([Hoopsgamers 2K24](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)).
- **Help and AI.** 2K26 added drive-and-kick logic to the offensive AI, which reads defensive rotations, and help defense that follows the ball for paint protection and closeouts. Teams can carry up to 80 plays each ([GamingBolt](https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report), [Hoopsgamers](https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more)). 2K24 added a substitution engine that keeps scorers on the floor, and freelance offenses that move between 3-out, 4-out and 5-out ([Hoopsgamers 2K24](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)).

### 1.6 Rebounding

2K26 shows a teaching cue: a green meter flashes under the player for a well-timed jump, and the ideal moment is just before the ball's last bounce off the rim. Players can still rebound without it. If both time it well, positioning, ratings and height decide. A small player with perfect timing does not automatically beat a big, unless the big is standing still ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs), [GamingBolt](https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report)).

### 1.7 Badges, Takeover, hot zones

- **Badges.** 2K25 cut from 77 badges to 40, and 2K26 kept that system. The tiers are Bronze, Silver, Gold, Hall of Fame and the new Legend, each unlocked at an attribute threshold. For example, Challenger needs Perimeter Defense of 71, 82, 92, 95 and 99 ([Dexerto](https://dexerto.com/nba-2k/all-badges-in-nba-2k25-full-list-how-progression-works-2856379), [GameSkinny](https://www.gameskinny.com/tips/all-badge-requirements-in-nba-2k25/), [FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). The categories are inside scoring (11 badges), outside scoring (5), rebounding (2), playmaking (8), defense (9), general offense (2) and all-around (1). Our `badges.ts` already uses 2K26's thresholds.
- **Takeover.** A meter in the top-right fills with good play and drops with mistakes. It activates on its own, the meter ignites, and it raises the chosen attribute group ([Operation Sports](https://www.operationsports.com/how-to-activate-takeover-in-nba-2k25), [Prima](https://primagames.com/tips/how-to-activate-takeovers-in-nba-2k25)). In 2K24 the groups were Finishing, Shooting, Playmaking, Defense/Rebounding and Physicals, with a second meter for a Double Takeover ([Hoopsgamers 2K24](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)). In 2K26, Custom Takeover can target up to 3 attributes, and fewer targets give a bigger boost ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). NBA2KLab measured Takeover's shooting boost at about **2× the whole 65→99 rating ladder**: in one 20 ms range, 500 of 500 attempts greened ([NBA2KLab](https://www.nba2klab.com/green-windows)).
- **Hot zones** track where a player shoots well. 2K24 added Lethal zones, at most two at a time, as a bigger boost ([nba2kw 2K24](https://nba2kw.com/nba-2k24-hot-zones-lethal-zones-explained-how-to-get-check-hot-zones)). NBA2KLab measured a lethal zone at about +5.4 points of make rate and a cold zone at about −2.1 ([NBA2KLab](https://www.nba2klab.com/green-windows)).

### 1.8 Fatigue

Fatigue shrinks the dynamic window (2K22) and pushes the release later (2K27 testing). Higher Timing Stability grades "dampen the effects of fatigue/defense on your shot speed" ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/), [NBA2KLab](https://www.nba2klab.com/green-windows), [Dot Esports](https://dotesports.com/nba-2k/news/what-is-timing-stability-in-nba-2k25)). Hoop Land's players notice the same effect: "if a star plays too many minutes, their shooting and speed stats will drop in the fourth quarter" ([Hoop Land App Store reviews](https://apps.apple.com/us/app/hoop-land/id1605197976?see-all=reviews&platform=ipad)).

### 1.9 Playcalling, controls, camera

- **Playcalling.** Press left on the D-pad for favourite quick plays such as "Isolation" ([MagicGameWorld 2K26](https://www.magicgameworld.com/nba-2k26-offense-guide-how-to-run-quick-screens-pick-controls-plays/)). 2K24 offered 16 actions on that menu and an overlay showing the call ([ClutchPoints](https://clutchpoints.com/gaming/nba-2k24-gameplay-brings-changes-to-every-phase-of-the-game)). Positional playcalling puts button icons over players' heads ([Twinfinite 2K20](https://twinfinite.net/guides/nba-2k20-how-to-call-plays/)).
- **Default controls** ([NBA2KLab](https://nba2klab.com/nba2k-controls)):
  - Offense: Pass, Bounce Pass, **Icon Pass** (tap a teammate's icon), Lob, Shoot, Post Up, Call Play, Sprint.
  - Off-ball: Call for Pass, Call for Alley-oop, **Call for Screen**, Quick Screen.
  - Defense: Steal, Block/Rebound, Take Charge, Intense-D, Double Team, Icon Swap.
- **Camera.** The usual recommendation for 2K25 is "2K Low", zoom 5, height 7, key zoom off and auto flip on, so the ball always moves up the court ([GameWitted](https://gamewitted.com/gaming/nba-2k25-best-camera-settings)). Hoop Land players ask for more camera options than broadcast and overhead ([Steam](https://steamcommunity.com/app/2453660/discussions/0/599667160179473448/)).

### 1.10 How 2K shows ratings

- Attributes are grouped and colour-coded by category: Finishing (Close Shot, Driving Layup, Driving Dunk, Standing Dunk, Post Control), Shooting (Mid-Range, Three, Free Throw), Playmaking (Pass Accuracy, Ball Handle, Speed with Ball), Defense (Interior, Perimeter, Steal, Block), Rebounding (Offensive, Defensive), and Physicals (Speed, Agility, Strength, Vertical, Stamina). They cap at 99, and the build's height, weight and wingspan limit the caps ([NBA2KLab attributes](https://nba2klab.com/nba2k-attributes), [Hoopsgamers](https://hoopsgamers.com/nba-2k25-attributes-explained-tests)).
- Other surfaces: badge tier chips, a hot-zone court map, jumpshot letter grades, shot feedback with coverage %, and the Takeover meter. 2K22 showed every badge's cost and attribute threshold for each tier ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/)). That transparency is liked because players can see why a player is good.

### 1.11 MyTEAM: the basketball Ultimate Team

- **Modes:**
  - 2K25 Breakout is a single-player board game: you move outward from the centre, difficulty rises toward the edge, and a gatekeeper guards each edge reward.
  - Clutch Time and Triple Threat were folded into Breakout.
  - Showdown is head-to-head with 13-card lineups and 4-minute quarters, 15 tiers starting from tier 15, and checkpoints you cannot fall back below.
  - Triple Threat Park is 3v3, and King of the Court is a weekly event.
  - Sources: [Dexerto](https://dexerto.com/nba-2k/nba-2k25-myteam-will-feature-re-addition-of-auction-house-new-modes-2870420), [Gaming Nexus](https://www.gamingnexus.com/News/65122/NBA-2K25-shares-MyTEAM-mode-details2c-return-of-the-Auction-House).
- **2K26 additions** ([Bleeding Cool](https://bleedingcool.com/games/nba-2k26-reveals-details-about-this-years-version-of-myteam)):
  - **Breakout: Gauntlet**, where each player card can be used only once per run and rewards grow with run length.
  - **Game Changer cards**: one-use power-ups such as a REP multiplier, a saved win streak or easier Domination.
  - Daily **Streak Buster** rewards for ending an opponent's streak.
  - A MyTEAM Arena that shows your banners and trophies.
  - Single-player salary cap and coach development.
- **Clutch Time rules (2K22–2K24):** one 5-minute quarter, a **14-second shot clock**, a 4-point line, starting fives with no subs, and both teams in the bonus for the last 2 minutes ([nba2kw](https://nba2kw.com/nba-2k22-clutch-time-myteam-game-mode-details-revealed-for-season-3), [Progameguides](https://progameguides.com/nba-2k/what-is-clutch-time-mode-in-nba-2k22-myteam/)). Our 14 s clock matches a mode 2K players already know.
- **Card ladder** (2K23 cycle, ranges shift a little by year): Gold 65–79, Emerald 80–83, Sapphire 84–86, Ruby 87–89, Amethyst 90–91, Diamond 92–94, Pink Diamond 95–96, Galaxy Opal 97–98, Dark Matter 99, with Invincible and 100-rated cards later ([nba2kw](https://nba2kw.com/nba-2k23-myteam-card-tiers-colors-explained), [2K24 official](https://nba.2k.com/2k24/myteam/lineup), [GameDaily](https://gamedaily.com/games/nba-2k26-drops-free-wnba-30th-season-locker-code-one-100-ovr-two-dark-matter-and-two-galaxy-opal-cards-inside)). **The design insight is that the top bands are only 1–3 points wide, so every small rating gain unlocks a new colour.** Those are 2K's names and must not be copied. 2K does not publish clear per-pack odds. One secondary source says the best cards come at under 1% even from the most expensive packs ([HoopWRLD](https://hoopwrld.com/game-over-hoopwrlds-guide-to-the-most-broken-myteam-cards-in-2k25/)).
- **Biggest complaint:** VC is "intertwined in almost everything" ([Heavy](https://heavy.com/sports/nba/nba-2k26-review-gameplay/)). Our coins-only rule is an advantage worth saying out loud in the UI.

---

## 2. Mobile versions

### 2.1 NBA 2K Mobile (Cat Daddy, 2018 onward)

- **Format** ([Wikipedia](https://en.wikipedia.org/wiki/NBA_2K_Mobile)):
  - Starting fives only, no substitutions and infinite endurance.
  - Two halves of about 2 minutes each, with the real 24 s shot clock.
  - An auto/manual toggle. In auto, the player still decides when to shoot and block.
  - A shot meter appears on the Shoot press. Timing, distance and rating decide the result.
  - On defense, holding Defend makes players switch on passes; Steal, Block and fouls are available.
- **Controls** ([LevelWinner](https://www.levelwinner.com/?p=20543)):
  - Joystick bottom-left. Offense buttons are Shoot, Pass and Drive; defense buttons are Defend, Steal and Block.
  - Tapping a teammate passes to him, with more control than the Pass button.
  - Mashing Steal causes reach-in fouls. Two fouls in a quarter put the team in the penalty.
  - A circular **Boost** meter fills during play; tapping it gives the whole team a short attribute boost.
- **Cards** ([Wikipedia](https://en.wikipedia.org/wiki/NBA_2K_Mobile)): 43 card tiers, star levels, training to level 100, mentors, gear, and Tourneys of best-of-4 playoff rounds.
- **Downloads:** about 41M by Sensor Tower estimates ([Wikipedia](https://en.wikipedia.org/wiki/NBA_2K_Mobile)).
- **Criticism.** Auto mode plays better than the player, and the AI runs plays the player cannot. Pocket Gamer called that "a bit like a slap in the face" and gave 2.5/5: it "tries to be for everyone and ends up being for no one" ([Pocket Gamer](https://pocketgamer.com/articles/079442/nba-2k-mobile-basketball-review/)). LevelWinner found auto-play "not very smart": poor shooters jack threes and it passes up open fast-break layups ([LevelWinner](https://www.levelwinner.com/?p=20543)).
- **Season 7 "Rewind"** ([NBA 2K Mobile](https://nba2kmobile.com/news/introducing-rewind)):
  - **Top Plays**: up to 10 a day, refreshed at 11 AM Pacific, built from the previous night's real games.
  - Play types: single actions such as a buzzer-beater; player stat goals for points, threes, assists or triple-doubles; and team goals such as a 10-0 run or several players hitting threes.
  - Many are player-locked, and targets are scaled down: a real 45-point night becomes 5 points in a short span.
  - Each play takes seconds to a few minutes. Plays unlock in a chain and can be restarted from the pause menu.
  - **Replays** are 4 × 5-minute quarters: win by the real margin, or flip the result as the losing team, plus a player goal.
  - Rewind points feed leaderboards that reset about every two weeks. A repeat run only scores the points above your previous best.

### 2.2 NBA 2K Arcade Edition (Apple Arcade) and earlier 2K ports

- 2K25 Arcade Edition runs on iPhone, iPad, Mac, Apple TV and Vision Pro, with controller support ([MacRumors](https://www.macrumors.com/2024/10/04/nba-2k25-apple-arcade/)). 2K says it plays best with a controller ([App Store KR](https://apps.apple.com/kr/app/nba-2k25-%EC%95%84%EC%BC%80%EC%9D%B4%EB%93%9C-%EC%97%90%EB%94%94%EC%85%98/id6504000920)). TouchArcade recommends a controller but calls touch "workable" ([TouchArcade](https://toucharcade.com/2023/10/24/nba-2k24-apple-arcade-edition-download-size-controller-support/)).
- GameSpot on 2K21 Arcade Edition: the touch controls are "too sensitive at best and non-functional at worst". Passing and shooting worked better because they sit on dedicated buttons ([GameSpot](https://www.gamespot.com/reviews/nba-2k21-arcade-edition-review-air-ball/1900-6417676/)).
- Pocket Gamer on 2K14: the joystick "overcompensates for small movements", and the pass and shoot buttons were unreliable. The hidden "one-finger mode", where you tap a teammate to pass and press and hold the ball handler to shoot, was the "best way" to play and allowed playcalling ([Pocket Gamer](https://www.pocketgamer.com/nba-2k14/review/)).

### 2.3 NBA Infinite (Level Infinite, 2024)

- **Controls.** Touch only: a joystick on the left and four contextual buttons on each side of the ball ([ClutchPoints](https://clutchpoints.com/nba-infinite-beginners-guide), [BlueStacks](https://www.bluestacks.com/blog/game-guides/nba-infinite/nbai-beginners-guide-en.html)).
  - The shot is hold and release, "very similar to NBA 2K", and "consistent".
  - The meter is colour-graded: blue or green is best, yellow is acceptable, and red "severely decreases" accuracy ([TopUpLive](https://www.topuplive.com/news/nba-Infinite-beginners-guide.html)).
  - The Custom UI rearranges buttons. Pro Controls add an "Independent Direction" shooting stick. Dribble Assist helps crossovers.
  - Stars get signature moves (Kyrie, SGA, Booker and Tatum were reworked) and named specials such as "Royal Charge" ([App Store](https://apps.apple.com/us/app/nba-infinite-pvp-basketball/id1633590206)).
- **Modes.** 1v1, 3v3 Ranked, Dynasty, 11-point games and a 3-Point Contest. Matches run up to about 10 minutes including halftime ([BlueStacks](https://www.bluestacks.com/blog/game-guides/nba-infinite/nbai-beginners-guide-en.html)).
- **Praise.** "Precise and responsive" controls and smooth animations ([GamingonPhone](https://gamingonphone.com/reviews/nba-infinite-review/)).
- **Complaints** ([App Store](https://apps.apple.com/us/app/nba-infinite-pvp-basketball/id1633590206), [TapTap](https://www.taptap.io/app/33582224)):
  - Pay-to-win, with expensive packs and market.
  - "Player ratings don't match in-game stats".
  - AI teammates ignore passes and take bad shots.
  - Some players found the controls unresponsive or hard to learn.
  - Requests for a controller layout and camera options.
  - Rating 4.5★ from about 5K ratings.

### 2.4 NBA Live Mobile (EA)

- Gamezebo scored it 70/100 ([Gamezebo](https://www.gamezebo.com/reviews/nba-live-mobile-review-an-overstuffed-rotation/)):
  - The stick and buttons are "comfortable and responsive". A dunk is a swipe from the Drive button to the Shoot button, which the reviewer called "especially intuitive".
  - Head to Head was asynchronous: each player controlled alternate quarters against the other side's AI.
  - The energy system was "unforgiving".
  - Each player could fill only one of five lineups, which pushed the roster requirement to about 25 players.
- In March 2018 a Head to Head game became one quarter, with matchmaking ([EA](https://www.ea.com/games/nba-live/nba-live-mobile/news/nba-live-mobile-march-update)).
- Controls ([LevelWinner](https://www.levelwinner.com/?p=6372)): Drive tap spins, double-tap spin-layups, and a single tap while standing is a hesitation. There is no steal button: tapping Guard reaches in.
- **Why it underperformed** (Deconstructor of Fun via [PocketGamer.biz](https://www.pocketgamer.biz/nba-live-mobile-why-ea-cant-replicate-madden-mobiles-success/)). It peaked at #39 top-grossing in the US during the NBA playoffs, against Madden Mobile at #2.
  - Card collecting pushes players to the highest-rated roster, not a lineup that fits a plan.
  - Basketball has no planning phase, and console-style continuous control is "a mistake" on touch.
  - Units did not feel distinct or true to the real players.
  - The proposed fixes: discrete, timed possessions with pre-set plays and lineups; tap-triggered special abilities; and deep skill trees per player rather than wide collections.

### 2.5 What mobile players consistently praise and complain about

| Praise | Complaint |
|---|---|
| Responsive dedicated shoot and pass buttons ([GameSpot](https://www.gamespot.com/reviews/nba-2k21-arcade-edition-review-air-ball/1900-6417676/)) | An over-sensitive or jittery joystick ([Pocket Gamer 2K14](https://www.pocketgamer.com/nba-2k14/review/)) |
| Tap-a-teammate passing and hold-to-shoot ([Pocket Gamer](https://www.pocketgamer.com/nba-2k14/review/), [LevelWinner](https://www.levelwinner.com/?p=20543)) | Auto-play stronger than manual play ([Pocket Gamer](https://pocketgamer.com/articles/079442/nba-2k-mobile-basketball-review/)) |
| Gesture finishes, such as swiping from drive to shoot to dunk ([Gamezebo](https://www.gamezebo.com/reviews/nba-live-mobile-review-an-overstuffed-rotation/)) | AI teammates who ignore passes or take bad shots ([App Store](https://apps.apple.com/us/app/nba-infinite-pvp-basketball/id1633590206)) |
| Customisable button layout ([ClutchPoints](https://clutchpoints.com/nba-infinite-beginners-guide), [Hoop Land](https://apps.apple.com/us/app/hoop-land/id1605197976)) | Ratings that don't match how players perform |
| Short sessions: 2 × 2-minute halves, or a single quarter | Energy timers and pay-to-win |
| Signature moves for stars | Losing control after a basket ([Hoop Land reviews](https://apps.apple.com/us/app/hoop-land/id1605197976?see-all=reviews&platform=ipad)) |

---

## 3. Arcade references

### 3.1 NBA Jam

- **2-on-2**, oversized dunks, turbo, shoves with no fouls, and only the shot clock and goaltending enforced ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NBAJam)).
- **On Fire.** Three straight baskets by one player, with no opponent score in between, set him on fire. He gets more accurate shots and unlimited turbo, and can goaltend. The fire goes out when the opponent scores or after 4 more baskets; sources differ on whether the 4 includes the first 3. "He's heating up" is called after the second basket. Hangtime added a lob-based version, and the 2010 edition added Team Fire ([Wikipedia](https://en.wikipedia.org/wiki/NBA_Jam_(2010_video_game)), [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NBAJam)).
- The mechanic was left vague in the manual on purpose so players would discover it by word of mouth ([NLSC](https://www.nba-live.com/ww-why-being-on-fire-was-so-cool-in-nba-jam/), from a search summary).
- **Rubber-band AI.** Designer Mark Turmell described rubber-banding as keeping the two sides close with small automatic cheats, so the game stays exciting ([Giant Bomb](https://giantbomb.com/wiki/Concepts/Rubber_Band_AI), [GamesRadar](https://www.gamesradar.com/nba-jams-secret-bulls-and-pistons-rivalry-cheat-confirmed-almost-3-decades-later)). Players notice it and resent it when it is obvious.
- **Why it is remembered:** spectacle (dunks and fire), a readable escalation (heating up, then on fire), short games, and a single announcer catchphrase.

### 3.2 Hoop Land (Koality Game; iOS, Android, Steam)

- **Ratings.** 4.8★ from about 18K App Store ratings; 95% positive from 751 Steam reviews ([App Store](https://apps.apple.com/us/app/hoop-land/id1605197976), [Steam](https://store.steampowered.com/app/2453660/Hoop_Land/)).
- **Features** ([App Store](https://apps.apple.com/us/app/hoop-land/id1605197976)):
  - Ankle breakers, spins, step-backs, alley-oops and chase-down blocks.
  - 3D rim and ball physics on 2D pixel art.
  - Offensive play icons, icon passing and switching, pump fakes, off-ball and defensive assistance.
  - Customisable on-screen buttons with adjustable joystick size and position.
  - Game lengths of 32, 40 or 48 minutes, and gameplay and simulation sliders.
  - Box scores, game logs, advanced stats, awards and a Hall of Fame.
  - Career, Campus, Franchise and Commissioner modes; Franchise is free with no ads or microtransactions.
- **Liked:**
  - "Easy to learn, hard to master"; the franchise and career modes are surprisingly deep ([GameKeepr](https://gamekeepr.net/en/reviews/63)).
  - It feels arcade, but "capitalizing on possessions and playing good defense" decides games, and the AI "can't be easily exploited" ([148Apps](http://www.148apps.com/reviews/hoop-land-review/)).
  - "Each player has unique stats and a distinct look", which makes key players easy to recognise ([148Apps](http://www.148apps.com/reviews/hoop-land-review/)).
  - Bad passes are punished ([Steam](https://steamcommunity.com/app/2453660/discussions/0/599667160179473448/)).
- **Disliked:**
  - Teammate AI drifts away from the ball on lobs. The free-throw meter is hard; one player liked that it differs from the jumper, and others want it sized by rating ([Steam](https://steamcommunity.com/app/2453660/discussions/0/599667160179473448/)).
  - "Too arcadey" on Pro: one shooter went 14 of 15 on threes, the CPU made zero blocks or steals, rebounds land near the rim, and the CPU never fouls, so Hack-a-Shaq works ([Steam](https://steamcommunity.com/app/2453660/discussions/0/591784958348254757/)).
  - Losing control after a made basket, too many collision fouls, and teammates playing worse when not controlled ([App Store reviews](https://apps.apple.com/us/app/hoop-land/id1605197976?see-all=reviews&platform=ipad)).

### 3.3 Basketball Stars (Miniclip)

- 4.8★ from about 355K ratings. Two 1v1 online modes: Attacker-Defender duels and timed Shootouts. Progression moves you up through better courts, and Trophy Road gains trophies for wins and loses them for losses. There are 400+ cosmetic items and 60+ balls ([App Store](https://apps.apple.com/app/id976173170)).
- **Lessons:** a 1v1 duel is the simplest PvP basketball that works on a phone. The timed shootout teaches release timing without defense. Cosmetics carry long-term retention.

---

## 4. Real NBA statistics for calibration

### 4.1 Modern per-team, per-game league averages

Sources: [Basketball-Reference per game](https://www.basketball-reference.com/leagues/NBA_stats_per_game.html), [per 100 possessions](https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html), [2024-25 season page](https://www.basketball-reference.com/leagues/NBA_2025.html) and [2025-26 season page](https://www.basketball-reference.com/leagues/NBA_2026.html).

| Stat (per team per game) | 2024-25 | 2025-26 |
|---|---|---|
| Pace (possessions) | 98.8 | 99.4 |
| Points | 113.8 | 115.6 |
| ORtg (points per 100 possessions) | 114.5 (an all-time high then, per [NBA.com](https://www.nba.com/news/nba-storylines-most-improved-offenses-2024-25)) | 115.7 |
| FG / FGA / FG% | 41.7 / 89.2 / .467 | 42.0 / 89.1 / .471 |
| 3P / 3PA / 3P% | 13.5 / 37.6 / .360 | 13.3 / 37.0 / .360 |
| 3PA rate (3PA/FGA) | .421 | .415 |
| FT / FTA / FT% | 16.9 / 21.7 / .780 | 18.4 / 23.5 / .783 |
| FTA rate (FTA/FGA) / FT per FGA | .243 / .189 | .264 / .206 |
| eFG% / TS% | .543 / .576 | .546 / .581 |
| TOV / TOV% | 14.3 / 12.6% | 14.5 / 12.7% |
| ORB / DRB / ORB% | 11.1 / 33.0 / 25.2% | 11.4 / 32.4 / 26.0% |
| AST (AST/FGM) | 26.5 (63.5%) | 26.7 (63.6%) |
| STL / BLK / PF | 8.2 / 4.9 / 18.6 | 8.4 / 4.8 / 19.9 |
| % of FGM assisted, 2s / 3s | 54.2% / 83.4% | 53.7% / 85.4% |

Team extremes in 2024-25: pace from 95.7 (Boston) to 103.3 (Memphis); ORtg from 106.8 (Washington) to 121.7 (Cleveland). In 2025-26, 3PA rate ran from .339 (Sacramento) to .497 (Golden State) ([B-R 2025](https://www.basketball-reference.com/leagues/NBA_2025.html), [B-R 2026](https://www.basketball-reference.com/leagues/NBA_2026.html)). Boston set records in 2024-25 with 1,457 threes made from 3,955 attempted ([Statitudes](https://www.statitudes.com/p/2024-25-mega-statistical-recap)).

### 4.2 Shot distribution and accuracy by zone

| Zone (2024-25) | % of FGA | FG% |
|---|---|---|
| 0–3 ft | 22.6% | 69.6% |
| 3–10 ft | 21.4% | 46.1% |
| 10–16 ft | 9.1% | 44.3% |
| 16 ft to the arc | 4.8% | 40.0% |
| 3PT (all) | 42.1% | 36.0% |
| Corner 3 (share of 3PA) | 24.3% | 38.8% |
| Above-break 3 (derived) | 75.7% of 3PA | ≈35.1% |
| Dunks | 6.1% of FGA | — |

Average shot distance was 14.5 ft. In 2025-26 it was 14.3 ft, with layups at 26.4% of FGA ([B-R 2025](https://www.basketball-reference.com/leagues/NBA_2025.html), [B-R 2026](https://www.basketball-reference.com/leagues/NBA_2026.html)).

- **Shot type, 2024-25** ([NBA.com](https://www.nba.com/news/best-shooters-of-the-2024-25-season)): catch-and-shoot threes 37.4%, pull-up threes 32.9%, pull-up twos 42.5%, paint FG% 57.1%. Leaders: Curry's 93.3% FT led the league, and Jarrett Allen shot 70.6% FG ([Statitudes](https://www.statitudes.com/p/2024-25-mega-statistical-recap)).
- **Points per shot by distance.** A wide-open 20 ft two is worth about 0.84 points; a tightly guarded 25 ft three about 0.71 ([Todd Schneider](https://toddwschneider.com/posts/nba-vs-ncaa-basketball-shooting-performance/)).
- **Defender distance on threes, 2024:** wide open 39.1%, open 35.0%, tight 29.7%, very tight 27.1% (community calculation; see §1.2).

### 4.3 How possessions start, and transition

- **2025-26** ([inpredictable](https://stats.inpredictable.com/nba/ssnTeamPoss.php)): all possessions average 14.2 s and 1.14 points. After a made shot: 55% of possessions, 17.0 s, 1.10 points. After a defensive rebound: 34%, 11.1 s, 1.15. After a turnover: 8%, 8.3 s, 1.31.
- **2014-15**, for comparison: after a turnover, 15% of possessions at 1.12 points ([inpredictable 2015](https://inpredictable.com/2015/03/team-pace-and-efficiency-by-possession.html)).
- **Cleaning the Glass, early 2026-27, excluding garbage time:** halfcourt 94.9 points per 100 plays (80.7% of plays), transition 122.5 (15.7%), putbacks 110.1 ([CTG](https://cleaningtheglass.com/stats/league/context)).
- **Play types, approximate:** spot-up about 1.00 points a possession, isolation about 0.90 ([Fantasy Team Advice](https://fantasyteamadvice.com/nba/teams/new-york-knicks/playtypes/2024)). This source is secondary and gives no method.

### 4.4 Star usage and how scoring spreads

| Player (2024-25) | USG% | TS% |
|---|---|---|
| LaMelo Ball | 35.9 | .536 |
| Giannis Antetokounmpo | 35.2 | .625 |
| Shai Gilgeous-Alexander | 34.8 | .637 |
| Luka Dončić | 33.9 | .587 |
| Paolo Banchero | 33.6 | .551 |
| Cade Cunningham | 33.2 | .565 |
| Anthony Edwards | 31.4 | .595 |
| Jayson Tatum | 31.2 | .582 |
| Victor Wembanyama | 30.4 | .594 |
| LeBron James | 30.1 | .604 |
| Stephen Curry | 29.8 | .618 |

([B-R advanced](https://www.basketball-reference.com/leagues/NBA_2025_advanced.html)). Wembanyama's block rate was 10.4%. League-average usage is 20% by definition, so a five's usage sums to 100%. A team's star uses about 30–35% and the fifth starter about 12–16%; the five-man pattern is an estimate from the table and the 20% average. Luka Dončić led 2025-26 in scoring at 33.5 points a game ([B-R 2026](https://www.basketball-reference.com/leagues/NBA_2026.html)).

### 4.5 Game-level variance

- **Margin.** The standard deviation of the final margin against the point spread is about 12 points. A back-of-envelope derivation: 85 FGA at a 50% eFG gives about 6.5 made shots of difference, or about 13 points ([blog derivation](https://www.goodreads.com/author_blog_posts/16483561-why-is-standard-deviation-of-nba-scores-about-point-spread-12-points)). Our `SIGMA = 11.5` is fine.
- **Lead changes.** 6.68 ± 5.72 a game ([arXiv 2026](https://arxiv.org/pdf/2606.27957)).
- **Comebacks.** A team trailing by 15 won .060 of the time in 2001-02 and .130 by 2023-24: "20 is the old 12" ([ESPN](https://www.espn.com.au/nba/story/_/id/39698420/no-lead-safe-nba-big-comebacks-blown-leads)). In 2016-17, teams down 15 or more won about 11% ([FiveThirtyEight](https://fivethirtyeight.com/features/the-warriors-dont-start-trying-until-theyre-down-15)).
- **Home court.** In 2024-25, 22 of 30 teams won more at home than on the road ([SI](https://www.si.com/nba/thunder/onsi/news/okc-thunder-bolstered-by-home-court-advantage-in-2025-playoffs)).
- **Scoring records.** Oklahoma City's +12.87 point differential in 2024-25 is the best in NBA history, and four teams averaged 120+ points ([Statitudes](https://www.statitudes.com/p/2024-25-mega-statistical-recap)).

### 4.6 Era differences

Sources: [B-R per game](https://www.basketball-reference.com/leagues/NBA_stats_per_game.html) and [B-R per 100](https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html). In the table, "Total" is points per game for both teams, "3PAr" is 3PA per FGA and "FT/FGA" is free throws made per FGA.

| Season | Pace | Pts/g | Total | FG% | 3PAr | 3P% | FT/FGA | TOV% | ORB% | eFG% | ORtg |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1965-66 | ~120+ (est.) | 115.5 | 231 | .433 | — | — | .262 | — | — | .433 | — |
| 1975-76 | 105.5 | 104.3 | 209 | .458 | — | — | .221 | 16.0 | 30.3 | .458 | 98.3 |
| 1985-86 | 102.1 | 110.2 | 220 | .487 | .037 | .282 | .258 | 14.9 | 32.4 | .493 | 107.2 |
| 1995-96 | 91.8 | 99.5 | 199 | .462 | .200 | .367 | .243 | 14.7 | 30.6 | .499 | 107.6 |
| 2004-05 | 90.9 | 97.2 | 194 | .447 | .197 | .356 | .245 | 13.6 | 28.7 | .482 | 106.1 |
| 2014-15 | 93.9 | 100.0 | 200 | .449 | .268 | .350 | .205 | 13.3 | 25.1 | .496 | 105.6 |
| 2024-25 | 98.8 | 113.8 | 228 | .467 | .421 | .360 | .189 | 12.6 | 25.2 | .543 | 114.5 |
| 2025-26 | 99.4 | 115.6 | 231 | .471 | .415 | .360 | .206 | 12.7 | 26.0 | .546 | 115.7 |

- **Pace before 1973-74 is estimated.** Turnovers and offensive rebounds weren't tracked, so B-R estimates use league-wide rates of 30% offensive rebounds and 16.3% turnovers ([Sports Reference](https://www.sports-reference.com/blog/2013/12/estimating-pace-and-per-possession-ratings-1951-1973/)). Secondary sites put early-1960s pace near 126.
- **2000-01 shot profile versus 2024-25** ([B-R 2001](https://www.basketball-reference.com/leagues/NBA_2001.html)):

| | 2000-01 | 2024-25 |
|---|---|---|
| Long twos (16 ft to the arc), % of FGA | 23.2% | 4.8% |
| Threes, % of FGA | 17.0% | 42.1% |
| Dunks, % of FGA | 3.6% | 6.1% |
| FG% at 0–3 ft | 61.9% | 69.6% |
| Average shot distance | 12.0 ft | 14.5 ft |
| Pace | 91.3 | 98.8 |
| ORtg | 103.0 | 114.5 |

- **Rule landmarks** ([Dunkest](https://dunkest.com/en/nba/news/196560/10-rules-changed-nba), [Sportskeeda](https://www.sportskeeda.com/basketball/news-when-nba-zone-defense-rule-change-impact-league)):
  - The 3-point line arrived in 1979-80.
  - The line was shortened to 22 ft for 1994-97; league 3P% went from 33.6% to 35.9%.
  - Zone defense became legal in 2001-02, with defensive three seconds added.
  - Hand-checking enforcement tightened in 2004-05.

### 4.7 Scaling to our 16-possession offensive game

These are per-possession rates from the [B-R per-100 table](https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html), multiplied by 16. "Pts/poss" is points per possession.

| Era | Points | FGA | 3PA | FTA | TOV | ORB | AST | Pts/poss |
|---|---|---|---|---|---|---|---|---|
| 1985-86 | 17.2 | 13.8 | 0.5 | 4.7 | 2.8 | 2.2 | 4.0 | 1.07 |
| 1995-96 | 17.2 | 13.9 | 2.8 | 4.6 | 2.7 | 2.2 | 3.9 | 1.08 |
| 2005-06 | 17.0 | 13.8 | 2.8 | 4.6 | 2.5 | 2.0 | 3.6 | 1.06 |
| 2015-16 | 17.0 | 14.0 | 4.0 | 3.9 | 2.4 | 1.7 | 3.7 | 1.06 |
| 2024-25 | 18.3 | 14.4 | 6.0 | 3.5 | 2.3 | 1.8 | 4.3 | 1.145 |
| 2025-26 | 18.5 | 14.3 | 5.9 | 3.8 | 2.3 | 1.8 | 4.3 | 1.157 |

For 2024-25 that is about 6.7 FGM, 2.2 3PM and 2.7 FTM: 2 × 4.5 + 3 × 2.2 + 2.7 = 18.3 points. The engine's `ratings-matter.test.ts` band of 0.95–1.18 points per possession for even teams is consistent with this.

---

## 5. Recommendations for Perfect Season basketball

The game is an iPhone PWA with pixel-art players, touch controls and Ultimate Team. Names below are our own, not the reference games'. **Protocol:** anything in §5.1–5.7 or §5.11 that changes hoops2 physics, outcomes or ratings must bump the NBA queues: draft NBA 10 → 11 and UT NBA 10 → 11. NFL and soccer stay unchanged. Presentation-only items (meter drawing, feedback text, card UI) need no bump.

### 5.1 Shooting and timing

1. **Keep the window position.** Keep `JUMPER_TOP = 0.52 s` (2K's band is 500–565 ms) and `LAYUP_TOP = 0.42 s`. Give each player's shot DNA (§5.9) a release-speed offset of −40 ms to +30 ms, so a quick-release guard tops out near 0.48 s and a slow-release big near 0.55 s. This copies 2K's "15 ms per speed notch" and makes shooters recognisable by feel.
2. **Window widths on Pro difficulty, as full widths (twice our half-window):**

   | Situation | Full window | Notes |
   |---|---|---|
   | Elite open shooter (rating 95+) | 70–85 ms | Rhythm catch to about 95 ms |
   | Average open shooter (rating 75) | 45–55 ms | |
   | Poor shooter (rating 55) | 15–25 ms | |
   | Heavy contest on a good shooter | about 25–30 ms | |
   | Smothered | about 10–12 ms | Treat as a hope shot |

   This is roughly what the engine gives today (72 ms × 0.12–1.0 by rating, × 0.4 heavy, × 0.15 smothered). Do not tighten it toward console width: Apple's own figure is up to 2 frames (about 32 ms) of touch latency ([Apple Developer Forums](https://developer.apple.com/forums/thread/71301)), and rhythm-game "Perfect" windows are about ±45–49 ms ([dev.to](https://dev.to/skywalker_2de7de5f97df567/building-fair-rhythm-game-judgement-windows-in-javascript-1og9), [fluXis](https://mintlify.wiki/InventiveRhythm/fluXis/gameplay/scoring)). Legend tightens to about 0.8× and Rookie widens to about 1.25×; today `(1 − 0.16 × defIQ)` does this.
3. **Move the window, and show it.** Fatigue should push the green slice later, by about +15 ms at 60% energy and +25 ms at 40%. A moving or fading shot should push it about +10 ms. Draw the slice where it really sits on the arch meter. The player then learns "my man is tired" from the meter instead of feeling cheated, which is NBA2KLab's 2K27 model ([NBA2KLab](https://www.nba2klab.com/green-windows)).
4. **Three meter modes.** Full arch (the default), Cue only (a flash at the release point, +5% window) and Off (+10% window). These match 2K's meter-off bonus ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs), [Escapist](https://www.escapistmagazine.com/does-turning-off-shot-meter-still-give-20-green-window-in-nba-2k25/)). Store the choice per viewer.
5. **Pure green on open shots.** An open shot released inside the window always goes in, as 2K26 does and as the round-3 design intended. Contested shots keep the rating-scaled cap in `perfectCap`.
6. **A jumper's chance, averaged over a realistic human timing spread (about 35 ms SD), should land near these targets:**

   | Contest | League-average shooter, three | Elite shooter, three |
   |---|---|---|
   | Open | 38–41% | 48–52% |
   | Light | 33–36% | |
   | Heavy | 25–29% | |
   | Smothered | 15–22% | |

   Anchors: the real 39.1 / 35.0 / 29.7 / 27.1% contest tiers, and catch-and-shoot 37.4% against pull-up 32.9% ([NBA.com](https://www.nba.com/news/best-shooters-of-the-2024-25-season)). A pull-up should cost about 10–12% relative to a catch-and-shoot through the existing `balance` term. Add these four numbers as a seeded test next to `tune.test.ts`.
7. **Take the skill back from the defender.** If the closest defender is already landing from a jump at the moment of release, downgrade the contest one tier. That is 2K26's "make him land" rule ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)), and pairs well with a pump fake (§5.3).

### 5.2 Shot feedback and making ratings visible in play

- **Post-shot chip, about 900 ms.** Line 1 is timing in seven steps, using our own words: Very Early, Early, A Touch Early, **PURE**, A Touch Late, Late, Very Late. Line 2 is the coverage: "Wide open · 7.2 ft", or "Heavy contest 68%". Line 3, shown only on a miss, names the main reason: timing, contest, rating or fatigue. 2K separates timing, tempo and coverage the same way ([NBA2KLab](https://www.nba2klab.com/green-windows), [FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Last Play already stores the release offset and contest, so this is presentation only.
- **Keep the live shot %** under the ball handler (from Hoop Land; it already exists). Add a small hot or cold flame when he is standing in one of his hot or cold zones (§5.8).

### 5.3 Touch controls for iPhone

- **Left stick.**
  - Floating: it spawns where the thumb lands inside the left 45% of the screen and below the HUD, and shows a ghost at its rest position.
  - Base radius about 48–56 design px (the 390 px frame).
  - Dead zone 12% of radius, with the output rescaled so the edge of the dead zone reads 0, not a jump.
  - Sprint at 92% deflection, which `SPRINT_AT` already does.
  - These come from common virtual-stick guidance: a 10–15% dead zone, rescaled output and a restricted activation zone ([Abratabia](https://www.abratabia.com/game-controls/virtual-joystick.php)).
  - Set `touch-action: none` and use non-passive listeners on the game surface ([CSS-Tricks](https://css-tricks.com/almanac/properties/t/touch-action)). Handle each pointer separately so two thumbs never steal from each other.
- **Right cluster.** The SHOOT button is the biggest, about 84–96 design px across. PASS is about 64 px. CROSS, STEP and SPIN are 44–52 px each.
  - **Hold SHOOT** for the jumper, or the auto layup or dunk when attacking the rim (unchanged).
  - **A quick tap under 120 ms is a pump fake**, as in 2K. Today there is no fake.
  - **Swipe up off SHOOT while driving** for the flashy or contact dunk if the ratings allow it. NBA Live Mobile's drive-to-shoot swipe was called "especially intuitive" ([Gamezebo](https://www.gamezebo.com/reviews/nba-live-mobile-review-an-overstuffed-rotation/)).
  - **Swipe down off SHOOT** for a floater or hop step near the paint.
- **Passing.**
  - **Tap a teammate's icon or body to pass to him**. This was praised from 2K14 through 2K Mobile ([Pocket Gamer](https://www.pocketgamer.com/nba-2k14/review/), [LevelWinner](https://www.levelwinner.com/?p=20543)). PASS alone passes in the stick's direction, then to the most open man.
  - **Hold PASS and release over the rim** for a lob, which becomes an alley-oop if the target is a dunker running to the rim.
- **No lost control after a score**, the Hoop Land complaint. After a made shot, control returns the moment the next possession can be played. If a highlight replay is running, tapping anywhere skips it.
- **Layout editor.** A Settings screen to drag the right-hand buttons and resize the stick between 0.8× and 1.3×. Hoop Land and NBA Infinite both offer this ([Hoop Land](https://apps.apple.com/us/app/hoop-land/id1605197976), [ClutchPoints](https://clutchpoints.com/nba-infinite-beginners-guide)). Save it per viewer.
- **Never let auto-play beat manual.** Any autopilot "Takeover" or sim mode must score below a skilled human on the same squad. Add a regression check: autopilot points per possession must stay at least 0.05 under the human harness on Pro, because of the 2K Mobile lesson ([Pocket Gamer](https://pocketgamer.com/articles/079442/nba-2k-mobile-basketball-review/)).

### 5.4 Moves, burst and animation feel

- **Three tiers per move from Ball Handle (`hnd`)**, mirroring 2K26's momentum cross. A 99 handle plays as "elite".

  | hnd | Tier | Move travel | Defender's lost step |
  |---|---|---|---|
  | 85+ | Elite | 100% | 0.45 s |
  | 60–84 | Standard | 80% | 0.30 s |
  | Under 60 | Basic | 60% | 0.15 s, with a higher strip risk |

  Show the tier as 1–3 pips on each move button.
- **Per-possession burst budget.** Three move pips a possession refill on a pass or on a new possession. Repeating the same move within 2 s works less well (football already does this). This copies 2K's adrenaline idea in a readable form ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs), [Hoopsgamers](https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more)). A defender's bump on a drive costs one pip, as in 2K24.
- **Responsiveness rule.** Every move animation has a cancel window from about 150 ms: a shoot or pass input cuts the rest of the move. No pickup or out-of-bounds "canned" sequences ([NLSC](https://www.nba-live.com/mto-canned-moments-the-myth-of-the-skill-gap/), [Game Informer](https://www.gameinformer.com/b/news/archive/2016/11/22/latest-nba-2k17-patch-cleans-up-dribbling-animations.aspx)).
- **Separate size-up and escape.** A slow stick wiggle near the defender plays the player's signature size-up, which is cosmetic and builds rhythm: a jumper taken straight out of a size-up gets the rhythm bonus. The move buttons stay as escapes.
- **Calibration.** Docs/GAMEPLAY-RESEARCH.md measured direct drives at 0.48 points a possession, crossover drives at 0.92 and drive-and-kick at 1.35. The real anchors are paint FG% 57%, halfcourt about 0.95, spot-up about 1.0 and transition about 1.22.
  - Direct drive into a set defender: about 0.80–0.90 (shoving or charging into the body should still cost).
  - A beaten-defender drive: about 1.05–1.15.
  - Drive-and-kick to an open spot-up: about 1.10–1.20.
  - Re-measure on the human harness before changing anything, because the current values may have moved.

### 5.5 Defense AI, plays and the planning beat (offense-only)

- **Three play cards before each possession.** Football already has these. Hand-drawn chalk routes, about 2 s to choose, defaulting to the highlighted card. The calls are built from the existing `screen`, `cut` and `space` primitives:
  - High Pick (screen on the ball, roll or pop)
  - Iso Star (clear one side for the best handler)
  - Drive and Kick (spacing, one cutter)
  - Post Feed (the big seals; entry pass)
  - Floppy (a shooter comes off two screens)
  - Horns (two bigs at the elbows)
  - Weight the cards by the five's archetypes, so a team of shooters sees Floppy more often. This answers Deconstructor of Fun's "no planning phase" problem ([PocketGamer.biz](https://www.pocketgamer.biz/nba-live-mobile-why-ea-cant-replicate-madden-mobiles-success/)) and copies 2K's quick-play menu ([MagicGameWorld](https://www.magicgameworld.com/nba-2k26-offense-guide-how-to-run-quick-screens-pick-controls-plays/)).
- **Defensive looks.** Keep the existing labelled looks: man, sag, switch and trap. Add **drop** (the big sags on a pick: the pull-up is open, the roll is covered) and **zone 2-3** (a weak-side corner opens, the paint is crowded). Let the opponent's real ratings choose. **Help** should follow the ball and close out on the drive-and-kick, as 2K26 does ([GamingBolt](https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report)).
- **Steals.** Directional and rating-based, with no canned "pluck" from behind. A poked handler is briefly stunned ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). Keep the existing range of 6.5–9.5 steals per 100 possessions.
- **Optional "Clutch Stop" (new, short).** In the last two possessions of a close game, show one defensive card pick: Switch, Trap or Drop. It changes how the rival's simulated final possession resolves; there is no live defense. This adds tension without a networking project.

### 5.6 Rebounds, free throws, transition, fouls

- **BOARD timing flash.** When a shot misses, a small ring under the user's nearest man flashes green in a window from 120 ms to 0 ms before the ball's last rim contact. A green jump adds about +25% reach-race weight. Ratings (`reb`, `vrt`), height and position still decide, and a big who is set still beats a small man with perfect timing ([FAQ](https://www.nba2klab.com/nba-2k26-mike-wang-faqs)). The target ORB rate is about 25% of the user's missed shots: 24–28% on Pro against an even five ([B-R](https://www.basketball-reference.com/leagues/NBA_2025.html)).
- **Shooting fouls and free throws.** Real teams average 0.24 FTA per FGA, or about 3.5 FTA per 16 possessions.
  - Foul rates: contested drives and finishes about 12–18%, scaled by the defender's discipline and the driver's strength and draw-foul (the existing `str`); heavily contested jumpers about 2–3%; threes about 1%.
  - Free throws use **their own meter**: a vertical bar with a still target. A distinct meter makes free throws feel like their own moment, which Hoop Land players noticed ([Steam](https://steamcommunity.com/app/2453660/discussions/0/599667160179473448/)). Size the window by the `ft` rating, so an 0.93 shooter feels close to automatic and an 0.55 shooter is a real risk.
  - Give the window a calm bonus: not shrunk by contests, and shrunk 10% by fatigue.
  - Target average FT% about 76–80% (league 78%).
  - A rival five in the penalty late in a game will foul the user's worst FT shooter on purpose. This is our version of Hack-a-Shaq: a readable, real-basketball tactic.
- **Transition.** The rival's off-screen possessions decide how ours start. About 8–10% start from a steal: a 2-on-1 or 3-on-2, 6–8 s on the clock, flagged "FAST BREAK". About 6–8% start from a long rebound: an early-offense 4-on-4 with defenders still running back. Total transition about 15% of possessions, with a target of about 1.20–1.30 points a possession ([CTG](https://cleaningtheglass.com/stats/league/context), [inpredictable](https://stats.inpredictable.com/nba/ssnTeamPoss.php)). Possessions are short, so these are big dopamine moments.
- **Turnover target.** About 12–13% of possessions, or 2.0–2.3 per 16, split roughly 57% live-ball steals and 43% dead-ball (steals are 8.3 of 14.4 turnovers per 100 possessions in [B-R](https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html)).

### 5.7 Fatigue

Keep the existing energy and substitution model (`SUB_AT 0.65`, bench recovery). Add the visible effects described in §5.1: the slice moves later and shrinks up to 15%. Below 50% energy, give speed and burst a −5% movement cap, matching Hoop Land's fourth-quarter fade. Show the energy ring colour under each player, which the round-3 design already has for the sprint bar. A future "Timing Stability" shot trait can damp the fatigue shift on a per-player basis.

### 5.8 Badges, Heat, hot zones

- **Two-stage Heat.** Our version of NBA Jam's fire and 2K's Takeover. The data shape is additive and works with the existing `fire` field.

  | Stage | How you get there | Effect |
  |---|---|---|
  | Heating Up | 2 straight makes | Ember trail; ×1.10 window |
  | On Fire | 3 straight makes | Flame sprite and court-edge glow; ×1.25 window; burst pips refill |
  | Out | A miss, a turnover, or the rival scoring 2 straight possessions (our offense-only stand-in for "the opponent scored") | — |

  Also stop the fire after 4 further makes, as NBA Jam does, so it stays special ([TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NBAJam)). Keep "Heat Check" cards at 2. Do not use 2K's measured Takeover size of 2× the rating ladder: it would break competitive balance in our online matches.
- **Team run.** Three straight scoring possessions by anyone lights a "RUN 7-0" banner: one possession at ×1.08 window for all five. Our version of 2K Mobile's team Boost ([LevelWinner](https://www.levelwinner.com/?p=20543)) and Jam's team fire.
- **Hot zones from real data.** No new data is needed. For each card, compare its real 2P%, 3P% and FT-adjusted shooting with that season's league average from the §4.6 table:
  - **Hot:** 3P% at least 3 points above the season average on at least 2 3PA a game.
  - **Lethal:** at least 6 points above on at least 4 3PA a game.
  - **Cold:** at least 4 points below.
  - Effects on the make rate: Lethal +5, Hot +3, Cold −2 (2K27's lethal and cold sizes, [NBA2KLab](https://www.nba2klab.com/green-windows)).
  - Zones: paint (from 2P% and position), mid-range (from the `mid` rating against the era), corner 3 and above-break 3 (from 3P%; corner gets +2.7 points as in the league split).
  - **Era-normalise** so that 1985-86's 28.2% league 3P% does not make every old shooter cold.
- **Badge names.** Several of our badge display names are 2K's own (Deadeye, Limitless, Dimer, Posterizer and others). Keep the internal IDs but give them original display names, for example: Deadeye → "Ice Water", Limitless → "Deep Range", Dimer → "Table Setter", Posterizer → "Poster Maker", Clamps → "Lockdown", Ankle Breaker → "Ankle Taker", Rim Protector → "Paint Wall". Ratings, tiers and effects stay the same, so no protocol bump is needed if only labels change.

### 5.9 "Who is who": player identity in pixel art

2K's appeal rests on 1,100 signature shots and star-specific moves ([NBA2KLab](https://www.nba2klab.com/nba-2k25-gameplay-courtside-report), [NBA Infinite](https://apps.apple.com/us/app/nba-infinite-pvp-basketball/id1633590206)). Hoop Land wins with "a distinct look" for each player ([148Apps](http://www.148apps.com/reviews/hoop-land-review/)). For us:

- **Shot DNA, deterministic from data and the card ID.** The NBA2KLab "Jumpshot grades" idea in our own words.
  - Release speed (−40 to +30 ms): high-volume three-point guards fast, slow-shooting bigs slow.
  - Release height: tall and high-arc players get less block exposure and a taller arch meter.
  - Set point: one-motion or two-motion, which changes the meter fill curve.
  - Fade tendency: mid-range specialists get a one-leg fade animation on post and mid shots.
  - FT routine: 1–3 dribbles.
  - Show these on the card as four letter grades (A+ to F): Release, Speed, Height, Contest Resist.
- **Dribble style.** Low and quick, upright, or hesi-heavy, from `hnd` and `spd`. The size-up loop animation differs by style.
- **Finishing package.** Floater, Euro, finger roll, power or two-hand dunk, or lob finisher, from `lay`, `ddk`, `sdk`, `vrt` and height. Each dunker gets 1–2 "signature" dunk sprites.
- **Look.** Already in the game: height scale, build from weight, number and team colours. Add skin tone, hair shape, headband, arm sleeve, goggles, knee pads and shoe colour from a **small curated table for about 100–150 marquee players** (MVPs, Hall of Famers, current stars), with seeded defaults for everyone else. Curate respectfully: no caricature and no copied likeness art. These are 6–10 px pixel traits drawn in code.
- **Celebration.** One per archetype and a few curated, for example "the shimmy", the flex after an and-one or the three-goggles, all drawn in code as original animations.

### 5.10 Animations that read as "real" in pixels

- Prioritise what 2K and ProPLAY get right: no foot sliding (planted feet), weight shift on a stop, and the set point before release ([Hoopsgamers](https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more)). The CMU mocap pipeline already gives the jumper and strides. The hand-keyed gaps listed in ARCADE-V2.md are next: crossover, step-back, spin, passes, rim contests and dunks. Give each 6–10 frames with anticipation (2–3 frames), action and follow-through.
- **Make the release pop.** A one-frame hit-stop on a PURE release, the arch flashing green, and a swish particle. Light screen shake only on posterizers and blocks, which already exists in `juice.ts`. Respect reduced motion.
- **Contact reads.** A defender's stumble when beaten by an elite-tier move. A big's stumble under a heavy rim contest (2K26). A short poke-stun when stripped.

### 5.11 Simulated box scores and season stats

- **Era-aware simulated scores** (`engine/broadcast.ts basketballScore`). Replace the uniform total of 206 ± 17 with a normal distribution: mean = 2 × the league points a game for the lineup's median season, from the §4.6 table (about 228–231 for 2024-26, 194–200 for 1995-2015, 220 for 1985-86); SD about 17. That SD is our estimate: about √2 × 12 for two teams, with a small correlation for pace. Keep `SIGMA = 11.5` for the margin.
- **AI box scores** (`ut/league.ts box`). Share out points by **usage** (from the real season: USG%, or failing that points a game) with a soft cap of about 36% for one player. Create FGA, 3PA and FTA from each player's real rates scaled to the era. Assists ≈ 0.635 × team FGM, rebounds by `reb` share (ORB about 25%), steals about 8.3 and blocks about 4.9 per 100 possessions.
- **Per-player sanity checks.** Elite three-point shooters 40–45%, league 36%, bigs who rarely shoot under 1 3PA a game. FT 50–93%. Stars 25–35 points a game in a full-length game.

### 5.12 Card and ratings screens

- Show an **overall** plus **six category bars**: Inside, Outside, Playmaking, Defense, Rebounding, Athleticism. Map our attributes as follows:
  - Inside: `cls`, `lay`, `ddk`, `sdk`
  - Outside: `thr`, `mid`, `ft`
  - Playmaking: `hnd`, `pas`
  - Defense: `prd`, `ind`, `stl`, `blk`
  - Rebounding: `reb`
  - Athleticism: `spd`, `acc`, `str`, `vrt`, `sta`
- Then **badge chips with tier colours** and "next tier at 92 3PT", which reuses the threshold transparency players liked in 2K22.
- Then **a hot-zone court map** (5 zones, flame or ice), **shot DNA grades**, and **real season line** (points, rebounds, assists, shooting splits) with the source season.
- In matches, a **post-game box score** for the user's 16 possessions, with points, FG and 3P, AST, TOV, ORB and Pure releases per player. Add a **"real-game pace" extrapolation** (×6.2, 99 ÷ 16) so a 30-point night "feels" like one. The real Pure-release count is a strong share stat.

### 5.13 Basketball Ultimate Team ideas (for the UT track)

- **Daily "Top Plays" (fits pending Flashbacks).** Each day, generate 5–10 short, player-locked scenarios from historic box scores in our data, with targets scaled down: "1987 Finals, Game 4: score 4 points in 3 possessions with [card]"; "Close a 6-point deficit in 4 possessions"; "Hit 2 threes with the same shooter". Unlock them in a chain. Award coins, XP and a weekly leaderboard that counts only improvement over your best ([NBA 2K Mobile Rewind](https://nba2kmobile.com/news/introducing-rewind)). A full "Replay" version would replay a historic game as 16 possessions where you must win by the real margin.
- **Gauntlet: use each card once per run.** It makes depth matter and creates demand for more good cards. Our version of 2K26's Breakout Gauntlet ([Bleeding Cool](https://bleedingcool.com/games/nba-2k26-reveals-details-about-this-years-version-of-myteam)).
- **Streak rewards and "Streak Breaker"** daily bonuses for online UT. **Tiered ladder with checkpoints** (15 tiers, can't drop below a checkpoint), as in Showdown ([Gaming Nexus](https://www.gamingnexus.com/News/65122/NBA-2K25-shares-MyTEAM-mode-details2c-return-of-the-Auction-House)).
- **Clutch mode.** One "quarter" of 8 possessions, starting five only, a 14 s clock, and a 4-point "logo shot" zone. It suits short sessions and our engine already has a 14 s clock ([Clutch Time rules](https://nba2kw.com/nba-2k22-clutch-time-myteam-game-mode-details-revealed-for-season-3)).
- **Narrow colour bands at the top of the card ladder.** Every one or two rating points above 90 earns a new original finish, so promos and Evolutions feel like visible jumps. This is the 2K ladder insight ([nba2kw](https://nba2kw.com/nba-2k23-myteam-card-tiers-colors-explained)), with our own names and art.
- **One-use boost cards ("Game Changers") for coins:** a ×2 XP game, a saved win streak, an easier Gauntlet step. They reward engagement with no real money involved.

### 5.14 Calibration test targets

Add seeded tests or report rows. All figures are for an even matchup on Pro unless stated.

| Metric | Target (16 possessions, user side, modern era) | Real anchor |
|---|---|---|
| Points per possession, human harness | 1.08–1.20 | 1.145 ([B-R](https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html)) |
| Points per possession, autopilot | at least 0.05 below the human harness | lesson from 2K Mobile |
| Threes, share of FGA | 35–45% | 42.1% |
| Rim attempts (0–3 ft), share of FGA | 20–28% | 22.6% |
| FG% at the rim | 62–72% | 69.6% |
| 3P% overall / open / heavy | 34–38% / 38–41% / 25–29% | 36.0 / 39.1 / 29.7 |
| FTA per FGA | 0.18–0.26 | 0.243 |
| FT% | 74–80% | 78.0% |
| TOV per possession | 11–14% | 12.6% |
| ORB% of misses | 23–28% | 25.2% |
| Transition share / points per possession | 12–17% / 1.15–1.30 | 15.7% / 1.225 |
| AST per FGM | 55–65% | 63.5% |
| Sim total points (2024-26 lineups) | mean about 229, SD about 17 | 227.6–231.2 |

### 5.15 Things to avoid

- **Visible rubber-banding.** Jam-style "cheats" are remembered and resented ([Giant Bomb](https://giantbomb.com/wiki/Concepts/Rubber_Band_AI)). If a catch-up mechanic is used, make it explicit and symmetric, like the RUN banner.
- **Windows so tight that touch latency decides the outcome.** Smothered shots at 10 ms are fine as "hope shots", but open shots must not drop below about 40 ms total on Pro.
- **Ghost contests.** Contests must come from a visible defender: his hand up, distance and timing ([PlayStation Blog](https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/)).
- **Energy timers, pay-to-win, and AI teammates who ignore the open man** ([Gamezebo](https://www.gamezebo.com/reviews/nba-live-mobile-review-an-overstuffed-rotation/), [App Store](https://apps.apple.com/us/app/nba-infinite-pvp-basketball/id1633590206)).
- **Copying names.** Don't use 2K's or EA's terms in the UI: Takeover, Pro Stick, ProPLAY, MyTEAM, gem names, badge names, "He's on fire".

---

## 6. Confidence notes

- **Official 2K figures** (animation counts, 40 badges, the tiers and the rhythm rules) come from 2K's Courtside Reports through mirrors and the developer's quoted FAQ answers, and are reliable.
- **Millisecond figures** are NBA2KLab's community testing. They are careful but not official, and the 2K27 page flags some values as placeholders.
- **The contest-tier 3P% split** is a community calculation. **CTG's transition numbers** are early 2026-27, and the 2025-26 inpredictable numbers are season totals.
- **The mobile control descriptions** come from reviews and guides, some of them several years old (2K14 through 2K21 Arcade Edition).
- **The sim-total SD of about 17** is my own estimate (marked as such), not a sourced figure.

## 7. Source list

**2K console and PC**
- https://www.nba2klab.com/nba-2k26-mike-wang-faqs
- https://www.nba2klab.com/green-windows
- https://www.nba2klab.com/videos/nba-2k26-how-to-shoot
- https://www.prismnews.com/hobbies/nba-2k/nba2klab-says-nba-2k26-shot-timing-still-hinges-on
- https://www.nba2klab.com/nba-2k25-gameplay-courtside-report
- https://gamingbolt.com/nba-2k26-improvements-to-gameplay-controls-and-ai-detailed-in-new-courtside-report
- https://hoopsgamers.com/nba-2k26-gameplay-full-breakdown-proplay-shooting-dribbling-more
- https://hoopsgamers.com/nba-2k24-full-details-trailer-proplay-animations-adrenaline-boosts-much-more
- https://blog.playstation.com/2021/08/31/nba-2k22-gameplay-deep-dive/
- https://www.thegamer.com/nba-2k22-rebuilt-blocking-systems-reworked-dribbling/
- https://nba.2k.com/2k25/courtside-report/gameplay/
- https://gamesided.com/posts/new-nba-2k25-mechanic-will-make-open-shots-function-more-like-open-shots-01j4recnwc5s
- https://www.escapistmagazine.com/does-turning-off-shot-meter-still-give-20-green-window-in-nba-2k25/
- https://www.operationsports.com/nba-2k25-shot-timing-visual-cue-explained
- https://www.operationsports.com/nba-2k24-shot-release-timing-explanation
- https://sportskeeda.com/basketball/how-shoot-better-nba-2k22
- https://dexerto.com/nba-2k/all-badges-in-nba-2k25-full-list-how-progression-works-2856379
- https://www.gameskinny.com/tips/all-badge-requirements-in-nba-2k25/
- https://www.operationsports.com/how-to-activate-takeover-in-nba-2k25
- https://primagames.com/tips/how-to-activate-takeovers-in-nba-2k25
- https://nba2kw.com/nba-2k24-hot-zones-lethal-zones-explained-how-to-get-check-hot-zones
- https://nba2klab.com/nba2k-attributes
- https://hoopsgamers.com/nba-2k25-attributes-explained-tests
- https://nba2klab.com/nba2k-controls
- https://www.magicgameworld.com/nba-2k26-offense-guide-how-to-run-quick-screens-pick-controls-plays/
- https://clutchpoints.com/gaming/nba-2k24-gameplay-brings-changes-to-every-phase-of-the-game
- https://twinfinite.net/guides/nba-2k20-how-to-call-plays/
- https://gamewitted.com/gaming/nba-2k25-best-camera-settings
- https://dotesports.com/nba-2k/news/what-is-timing-stability-in-nba-2k25
- https://forums.operationsports.com/forums/nba-2k-basketball-sliders/992535-shot-coverage-impact.html
- https://www.osftw.com/features/2142/nba-2k15-fixing-broken-shot-forms-exposes-flaw-in-shooting-system/?page=3
- https://dexerto.com/nba-2k/nba-2k25-review-nba-2k25-review-a-small-step-forward-but-not-a-slam-dunk-2978137
- https://game8.co/articles/reviews/nba-2k25-review
- https://www.newgamenetwork.com/article/2809/nba-2k25-review
- https://heavy.com/sports/nba/nba-2k26-review-gameplay/
- https://steamcommunity.com/app/3472040/discussions/0/554627540143304308/
- https://steamcommunity.com/app/3472040/discussions/0/840627496100741753/
- https://www.nba-live.com/mto-canned-moments-the-myth-of-the-skill-gap/
- https://www.gameinformer.com/b/news/archive/2016/11/22/latest-nba-2k17-patch-cleans-up-dribbling-animations.aspx

**MyTEAM**
- https://www.gamingnexus.com/News/65122/NBA-2K25-shares-MyTEAM-mode-details2c-return-of-the-Auction-House
- https://dexerto.com/nba-2k/nba-2k25-myteam-will-feature-re-addition-of-auction-house-new-modes-2870420
- https://bleedingcool.com/games/nba-2k26-reveals-details-about-this-years-version-of-myteam
- https://nba2kw.com/nba-2k22-clutch-time-myteam-game-mode-details-revealed-for-season-3
- https://progameguides.com/nba-2k/what-is-clutch-time-mode-in-nba-2k22-myteam/
- https://nba2kw.com/nba-2k23-myteam-card-tiers-colors-explained
- https://nba.2k.com/2k24/myteam/lineup
- https://gamedaily.com/games/nba-2k26-drops-free-wnba-30th-season-locker-code-one-100-ovr-two-dark-matter-and-two-galaxy-opal-cards-inside
- https://hoopwrld.com/game-over-hoopwrlds-guide-to-the-most-broken-myteam-cards-in-2k25/

**Mobile**
- https://en.wikipedia.org/wiki/NBA_2K_Mobile
- https://pocketgamer.com/articles/079442/nba-2k-mobile-basketball-review/
- https://www.levelwinner.com/?p=20543
- https://nba2kmobile.com/news/introducing-rewind
- https://www.macrumors.com/2024/10/04/nba-2k25-apple-arcade/
- https://apps.apple.com/kr/app/nba-2k25-%EC%95%84%EC%BC%80%EC%9D%B4%EB%93%9C-%EC%97%90%EB%94%94%EC%85%98/id6504000920
- https://toucharcade.com/2023/10/24/nba-2k24-apple-arcade-edition-download-size-controller-support/
- https://www.gamespot.com/reviews/nba-2k21-arcade-edition-review-air-ball/1900-6417676/
- https://www.pocketgamer.com/nba-2k14/review/
- https://gamingonphone.com/reviews/nba-infinite-review/
- https://apps.apple.com/us/app/nba-infinite-pvp-basketball/id1633590206
- https://clutchpoints.com/nba-infinite-beginners-guide
- https://www.bluestacks.com/blog/game-guides/nba-infinite/nbai-beginners-guide-en.html
- https://www.topuplive.com/news/nba-Infinite-beginners-guide.html
- https://www.taptap.io/app/33582224
- https://www.gamezebo.com/reviews/nba-live-mobile-review-an-overstuffed-rotation/
- https://www.levelwinner.com/?p=6372
- https://www.ea.com/games/nba-live/nba-live-mobile/news/nba-live-mobile-march-update
- https://www.pocketgamer.biz/nba-live-mobile-why-ea-cant-replicate-madden-mobiles-success/

**Arcade**
- https://en.wikipedia.org/wiki/NBA_Jam_(2010_video_game)
- https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NBAJam
- https://www.nba-live.com/ww-why-being-on-fire-was-so-cool-in-nba-jam/
- https://giantbomb.com/wiki/Concepts/Rubber_Band_AI
- https://www.gamesradar.com/nba-jams-secret-bulls-and-pistons-rivalry-cheat-confirmed-almost-3-decades-later
- https://store.steampowered.com/app/2453660/Hoop_Land/
- https://apps.apple.com/us/app/hoop-land/id1605197976
- https://apps.apple.com/us/app/hoop-land/id1605197976?see-all=reviews&platform=ipad
- http://www.148apps.com/reviews/hoop-land-review/
- https://gamekeepr.net/en/reviews/63
- https://steamcommunity.com/app/2453660/discussions/0/599667160179473448/
- https://steamcommunity.com/app/2453660/discussions/0/591784958348254757/
- https://apps.apple.com/app/id976173170

**NBA statistics**
- https://www.basketball-reference.com/leagues/NBA_stats_per_game.html
- https://www.basketball-reference.com/leagues/NBA_stats_per_poss.html
- https://www.basketball-reference.com/leagues/NBA_2025.html
- https://www.basketball-reference.com/leagues/NBA_2026.html
- https://www.basketball-reference.com/leagues/NBA_2001.html
- https://www.basketball-reference.com/leagues/NBA_2025_advanced.html
- https://cleaningtheglass.com/stats/league/context
- https://stats.inpredictable.com/nba/ssnTeamPoss.php
- https://inpredictable.com/2015/03/team-pace-and-efficiency-by-possession.html
- https://fantasyteamadvice.com/nba/teams/new-york-knicks/playtypes/2024
- https://www.nba.com/news/best-shooters-of-the-2024-25-season
- https://www.nba.com/news/nba-storylines-most-improved-offenses-2024-25
- https://www.statitudes.com/p/2024-25-mega-statistical-recap
- https://redlib.shreven.org/r/nbadiscussion/comments/1e0h4hl/the_creation_of_a3p_a_new_way_to_track_threepoint
- https://www.cbssports.com/nba/news/wide-open-3s-and-ranking-how-each-nba-team-fared-at-making-defenses-pay
- https://toddwschneider.com/posts/nba-vs-ncaa-basketball-shooting-performance/
- https://www.goodreads.com/author_blog_posts/16483561-why-is-standard-deviation-of-nba-scores-about-point-spread-12-points
- https://arxiv.org/pdf/2606.27957
- https://www.espn.com.au/nba/story/_/id/39698420/no-lead-safe-nba-big-comebacks-blown-leads
- https://fivethirtyeight.com/features/the-warriors-dont-start-trying-until-theyre-down-15
- https://www.si.com/nba/thunder/onsi/news/okc-thunder-bolstered-by-home-court-advantage-in-2025-playoffs
- https://www.sports-reference.com/blog/2013/12/estimating-pace-and-per-possession-ratings-1951-1973/
- https://dunkest.com/en/nba/news/196560/10-rules-changed-nba
- https://www.sportskeeda.com/basketball/news-when-nba-zone-defense-rule-change-impact-league

**Touch input**
- https://www.abratabia.com/game-controls/virtual-joystick.php
- https://developer.apple.com/forums/thread/71301
- https://css-tricks.com/almanac/properties/t/touch-action
- https://dev.to/skywalker_2de7de5f97df567/building-fair-rhythm-game-judgement-windows-in-javascript-1og9
- https://mintlify.wiki/InventiveRhythm/fluXis/gameplay/scoring
