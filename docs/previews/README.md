# Codex visual QA previews

Implemented by Codex, 2026-10-29. These show the real card/reveal components in isolated localhost QA profiles, inside the existing game stage and typography. **The displayed #8 / 20 is a visual fixture, not an actual registered pull or live global count.**

- [GOAT reveal](goat-reveal.png): black/gold foil, the shared crown mark, player/overall and copy stamp.
- [Spotlight reveal](spotlight-reveal.png): violet/teal foil and coordinated lighting.

Reproduce normal and reduced motion with [the reveal QA script](../../scripts/qa/reveal.mjs). The full sequence includes pack tear, prologue, position, franchise, card entrance and serial stamp; a still image captures only one stage. [UI rules and connections](../UT-CONTENT-UPDATE.md#card-art-and-special-pack-motion).

The GOAT/Spotlight stills were refreshed after the all-tier rating correction; Jordan's 1989 shooting weakness is visible instead of a universal 100 floor. [Cloud Save](cloud-save.png) shows the new automatic-server-save sheet from an isolated QA identity, replacing the old file-backup UI. None of these previews shows a real player's save.


## Codex gameplay revision — 2026-10-30

Actual localhost rendered match captures with isolated rated test squads at Legend defense. They are gameplay verification artifacts, not proposed mockups or real player accounts.

- [NBA release](gameplay-nba-release.png) and [NBA action](gameplay-nba-action.png), 390×844.
- [NFL aiming](gameplay-nfl-aim.png) and [NFL action](gameplay-nfl-action.png), 390×844.
- [NBA small portrait](gameplay-nba-320.png), 320×568, and [NFL landscape](gameplay-nfl-landscape.png), 844×390.

Source: `scripts/qa/gameplay.mjs`. Full sources, behavior changes, balance diagnostics and verification limits: [GAMEPLAY-RESEARCH.md](../GAMEPLAY-RESEARCH.md).


## 90+ live issue stamp — Codex, 2026-10-30

[Numbered NBA gold card](serial-nba-live.png) · [Numbered NFL gold card](serial-nfl-live.png) · [NBA card detail](serial-detail-nba.png) · [NFL card detail](serial-detail-nfl.png). Actual localhost components and signed inspect-namespace fixture copies, not player accounts or simulated worldwide claims. Numbers reflect the isolated registry at capture time and subsequently change with registrations/disposals. The inset stamp shares the existing card frame palette and typeface. Reproduction and behavior: [CARD-CIRCULATION.md](../CARD-CIRCULATION.md).


## Pack cinema — Codex, 2026-10-30

[Sealed foil](pack-cinema-sealed.png) → [GOAT escalation](pack-cinema-shatter.png) → [GOAT card](pack-cinema-goat.png); [Spotlight entrance](pack-cinema-spotlight.png). These are actual localhost renders with the original stage, Archivo type, card art and simulated iPhone safe areas. The 8/20 copy stamp is a presentation-only fixture with mocked `packart` counts, never a deposited/minted card or a claim about global circulation.

The reveal includes charge/tear, opening doors, mystery card, position/team clues, procedural streaks, a GOAT-only limit break and the actual card's entrance. Stills cannot show all the motion; `scripts/qa/pack-cinema.mjs` records the first case to WebM (visual-only recording, no system audio). [Timing, sound, source connections and device verification limits](../PACK-CINEMA.md). No boosted odds or preview-only cheat UI is shipped.


## NFL rushing fix — Codex, 2026-10-30

[390px portrait](nfl-rushing-390.png) · [320px short portrait](nfl-rushing-320.png) · [844px landscape](nfl-rushing-844.png). Actual NFL component, manual forward-stick input after the handoff, equal real gold squads at Legend, isolated inspect profile. Juke/Spin/Power reuse the existing game-control skins; short portrait sizes leave the runner and blockers visible. Screenshots are rendered QA fixtures, not a real player account or a promise of a successful run. The controls/path fixes and complete fixed-seed measurements are documented in [NFL-RUSHING.md](../NFL-RUSHING.md).


## Connected Ultimate Team clubhouse — Codex, 2026-10-30

Actual rendered components, original fonts/cards and isolated localhost/inspect profiles. These show implemented screens, not mockups or real player accounts. Fixture cards, balances, Moment claims and any copy numbers are QA-only. The game ships no preview coin/card/claim override.

- [Clubhouse home](ut-clubhouse-home.png) and [Play HQ](ut-play-hq.png).
- [Free Season Pass](ut-season-pass.png), [objectives](ut-objectives.png) and [Champions Circuit](ut-champions-circuit.png).
- [Development Lab](ut-development-lab.png), [saved lineups](ut-saved-lineups.png) and [Moments](ut-moments.png).
- [NBA screen-and-roll call](ut-nba-coach-call.png) and [320px NBA controls](ut-nba-controls-320.png).
- [NFL full playbook](ut-nfl-playbook.png), [left-side outside run](ut-nfl-flipped-run.png) and [landscape playbook](ut-nfl-playbook-landscape.png).

`scripts/qa/clubhouse.mjs` exercises both sports, navigation, preserved wallet/copies, reload/claims, actual manual Moment attempts, existing practice callbacks, pre-snap book/flip and Circuit launch. The viewport checks are Chromium at 390×844, 320×568 and 844×390; they are not a physical-iPhone playtest. [Implementation, connections, economy and primary sources](../UT-OVERHAUL.md).


## Researched fixes and polish — Codex, 2026-10-30

[Batch season claims](ut-polish-nba-season-ready.png) · [Exact development copy in duplicate storage](ut-polish-nba-development-copy.png) · [Modal playbook in landscape](ut-polish-nfl-modal-landscape.png) · [Earlier earned season rewards](ut-polish-saved-season.png) · [320px NBA controls](ut-polish-nba-controls-320.png).

Actual components and original materials in isolated localhost/inspect fixtures. The archived-season image uses an explicit future date supplied to the real SeasonView; the OS/server clock was not changed. The dedicated input-isolation game uses weak synthetic defenders to distinguish gesture bugs from steals/sacks. No fixture balances, cards, counts, date override or weak-defense setting is shipped. [Research, confirmed issues, fixes and validation](../UT-POLISH.md).


## Actual court and field overhaul — Codex, 2026-10-30

Actual NBA/NFL components with isolated rated squads and the original UI/art. Core interaction captures run at the existing lab's **0.5×** playback speed to show motion; the normal-speed match QA is separate. No live accounts were copied. [Mechanics, research and measurements](../CORE-GAMEPLAY.md).

- [NBA court and shot rhythm](core-nba-live.png)
- [NFL receiver targets and pass types](core-nfl-pass-390.png)
- [NFL compact phone layout](core-nfl-pass-320.png)
- [NFL landscape passing](core-nfl-pass-844.png)
- [NFL held burst](core-nfl-burst.png)
- [NFL landscape running controls](core-nfl-run-landscape.png)


## Direct NFL joystick — Codex, 2026-10-30

- [390px normal Legend defense](nfl-direct-390.png)
- [320px two-touch control-isolation fixture](nfl-direct-320.png)
- [Landscape two-touch control-isolation fixture](nfl-direct-844.png)

Actual original-style joystick/BURST/skill UI. Direction-isolation captures hold defenders away to measure the player's input and velocity; the normal-defense capture does not. All run at normal 1× speed. [Defect, control contract and measured results](../NFL-DIRECT-CONTROL.md).


## UI consistency and flow polish — Codex, 2026-10-30

Current-run actual game captures. [Findings, file connections, numbered review and verification](../UI-CONSISTENCY.md).

- [Before: Circuit title overlaps wallet](ui-before-circuit.png) → [after: small-phone header and menu](ui-circuit-320.png)
- [Before: Lineups](ui-before-lineups.png) → [after: readable inputs/actions and Close](ui-lineups.png)
- [Home: original card fan and polished typography](ui-hub.png)
- [100+ GOAT stat layout](ui-goat-stats.png) (isolated holding still awaiting its serial) / [registered Spotlight detail](ui-registered-card.png)
- [Passing controls with shared arena panels](ui-nfl-passing.png)
- [Playbook in landscape](ui-nfl-playbook.png)

Menus use normal-time isolated profiles; game-control captures use the existing lab's 0.5× capture setting. Real card art, profile keys, progress and engine behavior are retained; these are not generated concept images.


## Play tab and football overlay — Codex, 2026-10-30

Real current-run components on isolated localhost QA profiles. Implemented by Codex (OpenAI).

- [Play tab](play-tab.png): existing Archivo, gold active treatment and all competition entries under Play.
- [Football before](football-hint-before.png): the reproduced 487px black tip panel.
- [Football after](football-hint-after.png): compact tip below the scoreboard, with the field and joystick visible. Simulated safe-area insets; normal-match tips enabled.

[Cause, file connections, validation and preservation constraints](../PLAY-TAB-AND-FOOTBALL-HINT.md). Older clubhouse captures above predate the dedicated Play tab.


## Ultimate Team Club Season — Codex, 2026-10-31

Real current components from isolated QA profiles. Designed and implemented by Codex (OpenAI).

- [Season setup](league-intro.png): full season and difficulty choice in the original clubhouse style.
- [NBA season after a real game](league-nba-hub.png): saved record, next opponent, real OVR and points averages.
- [AI player stats](league-stats.png): scouting and simulated season totals; midseason presentation fixture.
- [Championship](league-champions.png): completed bracket/title presentation fixture.
- [NFL season after a real game](league-nfl-hub.png): 32-club season, next fixture and saved record.
- [NFL playoffs](league-nfl-playoffs.png): knockout fixture presentation.

[Rules, save connections, full file map, verification and fixture limits](../UT-CLUB-SEASON.md). Full matches use the existing QA autopilot and an 8× test-only simulation speed; seeded later-season captures are not actual player achievements.
