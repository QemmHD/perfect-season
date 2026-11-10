# File ownership for the studio overhaul (7 teams)

The first matching rule wins. "Shared" files may be edited by the teams named, in small local hunks only (see `BUILD-RULES.md`).

## shell: iPhone fit, app shell, loading, offline, performance

- `index.html`
- `src/stage.tsx`, `src/stage-layout.ts`, `src/stage-layout.test.ts`
- `src/main.tsx`
- `vite.config.ts`, `public/**`
- `src/lib/update.ts`, `src/soccer-lazy.ts`, `src/soccer-lazy.artifact.ts`
- **UT data loading paths:** how `src/ut/pool.ts` and the card JSON load and get cached. pool.ts *content* (buckets, `CONTENT_PRINT`) belongs to packs; shell changes only the loading and caching.
- `scripts/qa/screen-fit.mjs`, `scripts/qa/startup.mjs`, `scripts/qa/browser.mjs` (harness improvements)
- `docs/OVERHAUL-SCREEN-FIT.md`, `docs/OVERHAUL-PERFORMANCE.md`, `docs/BROWSER-QA.md`
- **CSS, as edits inside `src/styles.css` and `src/ut/nav.css`:**
  - the top-bar/header rules (`.topbar`, `.shell-top`, `.ut-top`)
  - the `.arcade-full` safe-area variables
  - toast and SKIP top offsets
  - the card-detail sticky action-bar offset (nav.css ~1118-1127, styles.css ~3374)
  - the Home hint/spacer rule (styles.css ~11653)
  - min-size fixes for small targets on the draft and pack screens
- **Small edits in shared `src/ui/Pages.tsx`:** the Home hint/spacer and the Reset Progress danger zone only.

## ut: Ultimate Team menus, hub, objectives, rewards loop, results

- **UT screens:** `src/ut/` UltimateTeam.tsx, Hub.tsx, Clubhouse.tsx, DailyHubView.tsx, InboxView.tsx, SeasonBanner.tsx, CollectionGallery.tsx, SetsView.tsx, EvolutionsView.tsx, Moments.tsx, Rivals.tsx, Battles.tsx, CupView.tsx, LeagueSeason.tsx, Events.tsx, StreamlinedView.tsx, Club.tsx, SquadView.tsx, DraftView.tsx, MatchDebrief.tsx, play-art.tsx, ui.tsx, icons.tsx
- **UT logic and state:** `src/ut/` play.ts, play-status.ts, daily-hub.ts, hq-state.ts, progression.ts, events.ts, inbox.ts, nav.ts, return-view.ts, rivals.ts, rivals-net.ts, battles.ts, circuit.ts, cup*.ts, league*.ts, collection.ts, sets.ts, evolutions.ts, moments.ts, match-debrief.ts, streamlined.ts, club-management.ts, draft-mode.ts, state.ts (additive only), and their tests
- **UT CSS:** `src/ut/` clubhouse.css, content-ui.css, nav.css (except shell's card-detail bar rule), play-hq.css, play-art.css, match-debrief.css, match.css, cup.css, league.css, storage.css
- **Shared `src/ut/Match.tsx`:** the result screen, the solo vote screen, and progress/rewards after a match. It does not own the `UT_RULES` line, which belongs to the lead.
- **Shared `src/App.tsx`:** the tab badges, the main-Home bridge to UT, and first-run modal order.
- **Shared `src/ui/Pages.tsx`:** the Home rewards strip, GO links on missions and objectives, and the Profile/Missions pages.
- `src/ui/Welcome.tsx`, `src/ui/Results.tsx`, `src/ui/Gauntlet.tsx`, `src/ui/Rewards.tsx`, `src/engine/missions.ts`
- **New:** `src/ut/labels.ts`, a single module for player-facing mode names, so a later rename is one edit.

## packs: economy, odds, promos, pack opening, Store and SBC screens

- **Pack and promo logic:** `src/ut/` packs.ts, market.ts, preview-pack.ts, live-packs.ts, live-cards.ts, promo.ts, calendar.ts, calendar-rules.ts, calendar-sbc.ts, specials.ts, standouts.ts, content-packs.ts, content-sbc.ts, content-progress.ts, content-state.ts, sbc.ts, pack-sequence.ts, pack-helper.ts, walkout.ts, rare.ts, editions.ts, variants.ts, new-era.ts, acquisition.ts, pull-log*.ts, circulation.ts, numbered-sync.ts, registry.ts (read-only use; never write live)
- **The content of `src/ut/pool.ts`** (buckets, `CONTENT_PRINT`). shell owns how it loads.
- **Screens:** `src/ut/` PackOpening.tsx, PackArt.tsx, PackAtmosphere.tsx, PreviewPack.tsx, PullTracker.tsx, PickSheet.tsx, Store.tsx, StandoutsView.tsx, Challenges.tsx (the SBC screen, including its long-page layout)
- **CSS:** `src/ut/` pack-cinema.css, pack-reveal.css, pack-art.css, pull-tracker.css, content.css
- **Data:** `src/data/live-calendar.json`, `src/data/live-editions.json`, `src/data/special-editions.json`
- `src/admin/**` and `supabase/functions/card-registry/admin-packs.ts`: repo code only. Never deploy or call live.
- **Ratings shown versus used for special cards:** `src/ut/card-stats.ts`, `rate.ts`, `rating-quality.ts`, `specials.ts`, coordinated with the sport teams through the team doc. Any change to ratings a match uses means "Protocol bump needed".

## players: likeness, card faces, animation tech

- **Rendering and animation core:** `src/game/pixel/**` (body, poses, mocap, rig, style, color, bvh, persp, pixbuf, Scene, galleries), `src/game/sprites.ts`, `src/game/uniforms.ts`, `src/data/mocap/**`
- **New appearance data and code:** `src/game/pixel/appearance*.ts`, `src/data/appearance/**`, `scripts/build_appearance*.{ts,py}`
- **Card faces:** `src/ut/` CardArt.tsx, card-face.ts, card-editions.css, CardDetail.tsx, CardSerial.tsx, `src/ui/Card.tsx`, `src/ui/Binder.tsx`, `src/ui/poster.ts`, plus the matching card CSS blocks in styles.css (`.utc*`, `.card*` face rules)
- **In each sport's `render.ts`, shared with the sport teams:** the player-drawing sections only. That means look selection (skin, hair, build, gear), pose and clip selection, blending, and sprite caching. Camera, court/pitch/field, HUD and banners belong to the sport team.

## nba / nfl / soccer: gameplay for each sport

- **nba:**
  - `src/game/hoops2/**` (except the players sections of `render.ts`)
  - `src/game/hoops/**`
  - `src/game/play-feedback.ts`, `src/game/PlayReadout.tsx`, `src/game/play-readout.css`: shared with nfl, small hunks
  - docs: `docs/ARCADE-V2.md`, `docs/CORE-GAMEPLAY.md`, `docs/GAMEPLAY-RATINGS.md` (NBA parts)
- **nfl:**
  - `src/game/football2/**` (except the players sections of `render.ts`)
  - `src/game/football/**`
  - docs: `docs/NFL-DIRECT-CONTROL.md`, `docs/NFL-RUSHING.md` (NFL parts of the shared docs)
- **soccer:**
  - `src/game/soccer2/**` (except the players sections of `render.ts`)
  - docs: `docs/SOCCER-ENGINE.md`, `docs/SOCCER.md`
  - the soccer crowd wiring in `src/lib/sound.ts`
- **Shared by nba and nfl:**
  - `src/game/Arcade.tsx`: the match flow, the rival score, adding defense possessions, pause
  - `src/game/difficulty.ts`
  - `src/game/juice.ts`, `src/game/replay.ts`, `src/game/useInputInterrupt.ts`, `src/game/attrs.ts`
  - Each team edits only its own sport's branch inside these files.
- **Match ratings** (`src/game/*/ratings.ts`) belong to the sport team. Any change means "Protocol bump needed: <sport> draft + UT".

## Nobody (lead only)

- `DRAFT_RULES` (`src/net/match.ts`) and `UT_RULES` (`src/ut/Match.tsx`)
- `CLAUDE.md`, `README.md`, `docs/CODEX-UPDATE-LOG.md`
- `src/net/**` and `src/lib/cloud*`
- The `src/data/*.json` player data files: edit only through their build scripts, and only if your brief says so.
