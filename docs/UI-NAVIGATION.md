# UI navigation and naming — Claude (Anthropic), 2026-11-01

Branch `claude/ui-reorg` (from `feature/season-evolution` at `09691e8`). Not deployed.

This reorganises the whole app the way current sports-game apps are organised: a short, fixed tab bar, an action hub that only shows what to do next, one name for every thing, and every screen reachable in at most two taps from its tab. It implements the UI/IA audit (P0–P2 below) and places every feature added since that audit (docs/UT-CONTENT-2.md).

Nothing about saves, rewards, odds, prices, ratings or matches changes. No profile field, localStorage key, claim ID, card ID or queue changes; online queues are untouched. The only new state is in-memory (which segment a tab last showed).

## Research

What the reference games do, and what we took:

| Source | What it does | What we adapted |
|---|---|---|
| EA SPORTS FC 26 Play Menu, "reworked from the ground up" ([EA FUT deep dive](https://www.ea.com/en/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-fut-deep-dive), [RealSport101 UI deep dive](https://realsport101.com/article/fc-26s-new-ui-a-deep-dive-into-the-redesigned-ultimate-team-menu)) | A **For You** landing tab with *New*, *Continue Playing* and *Upcoming*; then *Online* (Rivals, Champions, Draft…) and *Play vs. CPU* (Squad Battles, Moments, Draft); Live Events show entry requirements and their own objectives in place | UT **Home** leads with a **Continue** card (the run in progress), then *This Season* + *Coming next* (Upcoming). **Play** is two lists, *Solo · vs the AI* and *Online · vs real players*; each row shows its live status, a run in progress says CONTINUE |
| EA SPORTS FC 27 **Campaign Hub** ([PlayStation store copy](https://www.playstation.com/en-pl/games/fifa-ultimate-team/), [AltChar FUT 27 deep dive](https://www.altchar.com/game-news/ea-sports-fc-27-fut-deep-dive-reveals-fut-gallery-faster-sbcs-and-evolution-upgrades-avC1O1v3gRtt), [Khel Now](https://khelnow.com/gaming/ea-fc-27-ultimate-team-new-changes-all-confirmed-features-so-far-202607)) | One place showing what's live this season: new objectives, SBCs, Evolutions, Gallery sets and Live Events. FC 27 also adds faster point-based SBCs and a persistent Gallery of sets | Home's *This Season* banner (Live Calendar) with its Season Pass strip; **Challenges** gathers SBCs (incl. Streamlined and season SBCs), Objectives and the Season Pass; **Club → Collection → Sets** is our Gallery |
| Madden 26 Mobile home redesign ([EA "What's new in MM26"](https://www.ea.com/games/madden-nfl/madden-nfl-mobile/news/madden-nfl-26-mobile-whats-new-in-mm26)) | "Completely redesigned the home screen to make it easier to jump straight into the action, with bigger buttons and fewer distractions" | Home lost the 260px "BUILD YOUR DYNASTY" banner and the tile wall that duplicated every tab |
| NBA 2K MyTEAM (guides: [Deltia's](https://deltiasgaming.com/?p=340943), [Magic Game World](https://www.magicgameworld.com/?p=129087)) | Home for challenges/season/packs; a separate **Manage** area for lineups and the collection | **Club** is our Manage: Players · Storage · Collection · Development as one segmented control; **Squad** stays its own tab because it is used before every match |
| Apple HIG summaries (tab bars 3–5, ≤6; 44×44pt targets) ([summary](https://www.remoteopenclaw.com/skills/ehmo/platform-design-skills/ios-design-guidelines)) | Few top-level tabs; ≥44pt hit targets; back buttons show the parent's name and shorten when the title needs room | Six UT tabs (the FC/MUT count), four main tabs; every target ≥44 design px; back labels fold to just the chevron for long titles |
| Mobile navigation patterns ([UX Collective](https://uxdesign.cc/navigation-patterns-in-mobile-applications-how-to-make-the-right-choice-fa3c228e5097), [Smashing](https://smashingmagazine.com/2017/05/basic-patterns-mobile-navigation)), badge guidance ([uxcel](https://app.uxcel.com/courses/gamification-in-design-context/gamification-mechanics-elements-558/badges-5638)) | Tab bars for primary navigation; overused badges cause "badge blindness" | Badges count only things to claim or open, never chores |
| [Game UI Database](https://alternativeto.net/news/2024/8/game-ui-database-2-0-launches-with-over-55-500-screens-and-enhanced-tools-for-ui-designers/) (sports/menu filters) | Reference screens of hub/menu layouts | Compact list rows with an icon tile, name, one status line and a chevron or pill |

Limits of the research: the FC 27 Campaign Hub's exact layout comes from pre-launch coverage and store copy; no official 2K26 tab list was found (third-party guides only).

## Structure map

### Main app — HOME · ULTIMATE TEAM · RANKS · PROFILE

| Tab | Holds |
|---|---|
| **HOME** | The draft game: sport switch, the 82–0 hero, stat strip (streak, who's online, **Missions** sheet, **Legends Gauntlet** sheet), Continue run, Training Camp, the four modes (Classic, Blind, **Daily #N** with its result and countdown, Head to Head) and the **PLAY** button, which never leaves the screen (everything above it scrolls when it must) |
| **ULTIMATE TEAM** | Opens UT (its own screen and tabs). Gold, with a FREE badge until the starter pack is opened. The button keeps the `Ultimate Team: …` accessible name |
| **RANKS** | Unchanged (Global / Yours) |
| **PROFILE** | One header (name, level, XP), the draft stats, an **Ultimate Team** card (cards, record, packs; opens UT), Favorite teams, Binder, **Draft boosters** (moved from the old BOOSTERS tab), recent drafts |

Removed tabs: **DAILY** (its content is the Daily tile and the line under the modes) and **BOOSTERS** (now in Profile). No route or save used those tab names.

### Ultimate Team — HOME · PLAY · SQUAD · CLUB · CHALLENGES · STORE

`src/ut/nav.ts` is the single map: every view has one **title**, one **tab** (highlighted) and one **parent** (back). Root views (tabs and their segments) have no back button; UT Home's is **EXIT**.

| Tab | Root screen / segments | Sub-screens (back → parent) |
|---|---|---|
| **HOME** | Starter pack (new players) · New Era card (eligible players) · **Continue** (Club Season / Circuit / UT Draft in progress, else a Play prompt) · **Rewards** row with **CLAIM ALL** · **This Season** banner + Coming next + **Season Pass** strip · **Daily** and **Weekly Standouts** tiles · featured Store promo (Lightning when live, else Preview Pack) · squad OVR/CHEM with a card fan · **Club Records** row with recent form | Rewards (inbox), Daily (Drop + login calendar + objectives), Club Records |
| **PLAY** | *Solo · vs the AI*: Club Season, Squad Battles, Champions Circuit, Legends Events, Moments, UT Draft · *Online · vs real players*: one **Rivals** card (division, RP, meter) with **FIND MATCH** | Each mode; Rivals (division ladder, rewards, board) |
| **SQUAD** | Lineup, chemistry, AUTO, saved lineups | — |
| **CLUB** | Segments **PLAYERS · STORAGE · COLLECTION · DEVELOPMENT**. Players/Storage have one **Filter & Sort** sheet (count badge; NFL positions grouped Offense/Defense/Kicking) | Sets (from Collection; includes the Landmarks archive), Evolutions (from Development) |
| **CHALLENGES** | Segments **SBCs · OBJECTIVES · SEASON PASS**. SBCs: Weekly Standouts link, This Season (calendar SBCs), Standouts & Landmarks, Streamlined, Daily, This week, Upgrades. Season Pass: one horizontal track opened at your level | Weekly Standouts |
| **STORE** | Segments **PACKS · SCOUT MARKET**. Packs: Your packs → Daily Drop → This Season (program packs) → Featured (Lightning, Standout Guarantee, Elite, Jumbo) → Picks & previews (Scout's Choice, Preview Pack) → All packs by price → note. Every pack has an Odds sheet. Scout Market: 12 cards a day + Swap Desk | — |

A tab tapped from elsewhere opens its last-used segment; tapped from one of its own sub-screens, it goes back up.

### Badges (claimables and things to open only)

| Tab | Counts |
|---|---|
| HOME | Rewards inbox claimables (Daily Drop, calendar, objectives and bonus, Season Pass tiers, sets, Standout objective, Draft, Evolutions, New Era) |
| CLUB | Sets complete + Collection milestones + a finished Development program + Evolutions ready |
| CHALLENGES | Objectives ready + Season Pass tiers unlocked (also per segment) |
| STORE | Unopened packs + open picks + the starter |
| PLAY / SQUAD | none (Play rows say CONTINUE / FREE / CLAIM instead) |

SBCs left to do are no longer a badge (they were a chore count, "14").

## Naming glossary (one name per thing)

| Name | Is | Not to be called |
|---|---|---|
| **Season Pass** | The free 25-level reward track (`ut.hq.seasons`), shown as "Season Pass · Level N / 25" | Season Rewards, Season 01 Free Rewards |
| **This Season** / **Season N: name** | The Live Calendar season (e.g. "Season 01 · Opening Tip"); the Season Pass runs on the same seasons | — |
| **Club Season** | The league mode (`ut.league`) | Season |
| **Rivals** | The online UT queue and its weekly divisions; its week is "Rivals Week 44" | Head to Head (in UT), Division Rivals, Season 44 |
| **Legends Events** | The themed legend squads with a Spotlight boss reward (`Events.tsx`) | Spotlight Events, Spotlight Series, Legends Series |
| **Spotlight** | Only the registered-serial pack and its edition | — |
| **SBCs** (Squad Building Challenges) | All squad challenges, including Streamlined and season SBCs; they live under Challenges | the SBC tab |
| **Challenges** | The tab: SBCs, Objectives, Season Pass | — |
| **Rewards** | The inbox (Home → Rewards); CLAIM ALL | Rewards Inbox |
| **Collection** / **Sets** | UT's discovered editions and their set rewards | Collection Gallery, Set Collections |
| **Binder** | The draft game's player cards (Profile) | Collection |
| **Development** / **Evolutions** | XP programs / permanent stat upgrades (Club → Development → Evolutions Lab) | — |
| **Storage** | Duplicate Storage (segment label STORAGE) | — |
| **Daily** | In UT: Daily Drop + login calendar + daily objectives. In the main app: the Daily #N draft | — |

## Layout rules

- **The frame.** The app draws a 390-px-wide frame and scales it to the phone (`stage.tsx`, k = width/390). Widths never reflow, so all sizes are design px and width media queries must not be used inside screens. Heights do vary: short phones get the `fit-tight`/`fit-compact` classes and pages scroll.
- **Headers.** The top bar holds the only title. Screens open with at most a one-line `Lede`, then their content or CTA; no in-page H1 or marketing hero.
- **Rows.** `ModeRow` (`src/ut/ui.tsx`): 46px icon tile, name, one live status line, chevron or pill; ~70px tall.
- **Segments.** `Segmented` (role `tablist`/`tab`) with a sliding indicator and claim counts.
- **Scrolling columns.** Children of a `.page` or a sheet never shrink (`flex-shrink: 0`), and a `.btn` directly inside one keeps its height (`flex: none`). This is what squashed START SEASON to 23px and the filter sheet's button.
- **Sticky actions.** Card details keep CLOSE / the context action (ADD TO SQUAD, USE IN CLUB or DEVELOP) / SELL at the bottom of the sheet; the Club Season start keeps START SEASON in reach. All attributes are folded into a disclosure.
- **Tap targets ≥ 44 design px.** Real size where there is room; compact chips, pills, switches and inline links extend their tap area with an invisible `::before` (Apple's approach). At 320-wide phones the whole frame is scaled by 0.82, so a 44-px target is 36 CSS px on screen; iPhones that run iOS 26 are ≥375 wide (k ≥ 0.96).
- **Icons.** SVG only (`src/ut/icons.tsx`): one icon per mode/section (league table, crossed swords, route, crown, bolt, cards, shield, gift, ticket, book, growth chart, box, sliders, chart, puzzle piece for Challenges).
- **Motion.** Lists rise in with a short stagger, Home's Continue card has a slow sheen, the squad fan deals in, badges pop, the segment indicator slides. The global reduced-motion rule turns all of it off.
- **Empty states.** `EmptyState`: icon, one line, one hint (empty Storage, no matches, no rewards).

## Audit status (P0–P2)

| # | Item | Status |
|---|---|---|
| P0-1 | START SEASON squashed / below the fold | Fixed: global no-shrink rule + `flex: none` buttons; sticky CTA bar |
| P0-2 | Home PLAY cut at 320 | Fixed: Home content scrolls above a fixed PLAY bar; UT card moved to the tab bar |
| P0-3 | "Season" collisions | Fixed: Season Pass / This Season / Club Season / Rivals Week N |
| P0-4 | UT Home overloaded | Rebuilt as the action hub above |
| P0-5 | Naming/back | `nav.ts`; root tabs have no back; Home EXIT; parent-named back |
| P1-6 | Play wall; H2H = Rivals | Solo / Online lists, one Rivals card with FIND MATCH ("TAKE THE SPOTLIGHT" renamed) |
| P1-7 | Duplicate H1 / heroes | Removed on Play, Objectives, Season Pass, Circuit, Development, Records, Inbox, Moments, Draft, Evolutions, Events, Collection, Standouts, Club Season |
| P1-8 | Club filter block | Segments + Filter & Sort sheet; no filters on an empty Storage |
| P1-9 | Badges count chores | Badges count claimables / things to open only |
| P1-10 | Season Pass 5 screens tall | Horizontal track, opens on your level |
| P1-11 | Main tabs | HOME · ULTIMATE TEAM · RANKS · PROFILE |
| P1-12 | Dev wording leaks | Rewritten ("existing …", "clubhouse update", "Win 1 matches", raw dates, "1 packs", "Online..") |
| P1-13 | Card detail actions | Sticky action bar, attributes folded |
| P2-14 | Tap targets | ≥44 design px everywhere the QA visits (see ui-reorg QA) |
| P2-15 | Truncation | Pack names wrap, chemistry hint shortened, long titles fold the back label |
| P2-16 | NUMBERING… placeholder | Gone; card details say the serial comes next time you're online |
| P2-17 | Binder vs Collection | Binder = draft, Collection = UT |
| P2-18 | Icons | New per-section SVG icons |
| P2-19 | Gauntlet toast, Profile | Gauntlet sheet; one level header; UT stats card in Profile |
| P2-20 | Store order | Your packs → Daily → This Season → Featured → Picks & previews → by price |

## Files

- `src/ut/nav.ts` — tabs, titles, parents, segments.
- `src/ut/ui.tsx` — `Segmented`, `Lede`, `SectionHead`, `ModeRow`, `EmptyState`, `stagger`.
- `src/ut/play-status.ts` — each mode's live status line and the run to continue.
- `src/ut/nav.css` — shell, shared pieces, Home, Play, Season Pass, Club toolbar/sheet, card-detail bar.
- `src/ut/UltimateTeam.tsx` — shell (top bar, segments, tab bar, badges), `storage` view.
- `src/ut/Hub.tsx`, `Clubhouse.tsx` (PlayHQ, SeasonRibbon, SeasonView, compact headers), `Club.tsx`, `Store.tsx`, `CardDetail.tsx`, `Challenges.tsx`, `LeagueSeason.tsx`, `SeasonBanner.tsx` (compact), and copy in `Events`, `Rivals`, `Moments`, `DraftView`, `EvolutionsView`, `InboxView`, `StandoutsView`, `SetsView`, `CollectionGallery`, `SquadView`, `Match` (titles), `CardArt` (no placeholder stamp), `progression.ts` (plural text only), `inbox.ts` (item title only).
- `src/ui/Pages.tsx`, `src/App.tsx`, `src/styles.css` — main tabs, Home, Profile, Gauntlet sheet, 44pt hit areas.

## QA

- `scripts/qa/ui-reorg.mjs` — every main tab and sheet, every UT tab, segment and sub-screen, card details and the filter sheet, at 430×932, 390×844 and 320×568, NBA and NFL. Checks horizontal overflow, clipped text, tap targets <44 design px (measuring `::before` hit areas), squeezed flex items, the highlighted tab / back target / title per screen, and page errors. `PS_QA_URL=http://localhost:5191/ node scripts/qa/ui-reorg.mjs [nba|nfl|all] [430|390|320|all]`.
- Updated for the new names and structure, with their checks kept: `play-tab.mjs` (all modes under PLAY, no back on the root tab, Circuit CONTINUE), `ui-consistency.mjs` (header collisions on root and sub-screens), `clubhouse.mjs`, `ut-content.mjs` (segments are `role=tab`), `league-season.mjs` (unchanged).
