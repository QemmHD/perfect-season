# Perfect Season studio overhaul: shared brief (read first)

## The owner's request (verbatim, 2026-11-09)

> Continue work on the app and fix and overhaul and implement new gameplay i wanna make it play better stats feel more legit more like how there respected sports game plays so find all aspects dont miss them and fix packs to make them more how real packs work for odds and for promos and add different characters for characters that match them in real life in game so we know who is who and make animations seem real like how the games do use the mobile version and console and pc versions of them to get a good reference dont grab a couple and think thats good the game olay unique that makes people like them and remember this is a mobile game so controls have to be good for it and make sure the games loads runs and has animations and overhaul the ultimate teams for each to the max 1000x so it looks plays feels and has the addictive style of the uktimate tesm it should make it where people wanna do challenges to get more make cards appeal to the eye make stats more accurate make the ui look detailed snd beautiful make it all look productions studio made and ui still doesnt scale fully to iphone the top part gets blurred around the dynamic island and cuts some things off you can see from ss and really make the game seem addictive and attract dopamine and have the menus wanna lead players to places and be clear and have good objectives and rewards and all menus work and taps and movements all work good make sure its all production studio quality

The owner's iPhone screenshot (installed home-screen app, Soccer Home) is at:
`/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/owner-iphone-home.jpg`

In it the header row (LV ring, LEVEL 19 / XP bar, coins, help and settings) sits just under the status bar and Dynamic Island. It looks faded or blurred, and things near the top are cut off.

## The product

Perfect Season is a React/TypeScript/Vite iPhone home-screen PWA served on GitHub Pages: https://qemmhd.github.io/perfect-season/

It has three sports: NBA, NFL and Soccer. Each has:
- draft modes: Classic, Blind, Daily, Head to Head
- arcade match engines: `src/game/hoops2`, `src/game/football2`, `src/game/soccer2`, with a pixel-art renderer and mocap
- Ultimate Team (`src/ut`): packs, cards, squads, SBCs, objectives, Season Pass, Cups, Club Season, Rivals, Moments, Evolutions, a Pack Tracker, the Live Calendar and promos

Online play runs over Nostr relays. Cloud saves and the card registry are on Supabase.

Read the repo's `CLAUDE.md` first. Its rules are hard constraints.

## Hard constraints (never break these)

- **Saves and progress.** Never reset or wipe saves, accounts, coins, owned cards or copy UIDs, serials, levels, XP, squads, receipts or progress. Never change storage keys or rename card or edition IDs. New state is optional and additive (see `src/ut/state.ts`). Existing owned cards must keep working, and may be re-rated by ID.
- **Coins only.** No real money, purchases or ads.
- **Online protocols.** Any change to match physics, rules or ratings that could make two clients disagree must bump that sport's online protocol (draft and UT queue version), so old and new clients never meet in a match. Current versions: draft NBA 10 / NFL 10, UT NBA 10 / NFL 11, soccer draft 2 / UT 2. Bump only the sports you change, and say so.
- **Never touch live services.** Never write to the live Supabase registry or saves, or to the live Nostr relays or leaderboards.
  - Browser QA always uses `?ns=inspect&relay=ws://localhost:7777` or the isolation in `scripts/qa/browser.mjs`. QA fixtures are restricted to localhost.
  - An earlier QA run registered cards live by accident. Do not repeat that.
- **No secrets.** No email addresses in network requests. The admin password must never appear in code, commits or docs.
- **Commits.** No model identifiers in commits or code. Start every commit message with "Claude: " and end it with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011urYpz1EMtNjEmc3DMeH4r
  ```
- **Sport branching.** Use `pick({ nba, nfl, soccer })` / `pickFor(sport, …)`, never a two-way `NFL ? a : b`. `src/engine/sport-branches.test.ts` enforces this.
- **Layout.** The app draws a 390px design frame scaled to the phone. Never use width media queries inside screens. Tap targets are at least 44 design px. Respect reduced motion. Use SVG for symbols, not unsupported Unicode glyphs.
- **Original game.** No copied brand names, logos, music or assets from EA, 2K or anyone else. Use "Ultimate Team"-style mechanics with our own names. Real player names and real stats are already in the game, and that stays.
- **Bundle size.** Don't add heavy dependencies or large raster images. Prefer CSS, SVG and canvas. Soccer, admin and the game screens load lazily; keep it that way.

## Working

- **Checks.** Run `npm run typecheck`, then `npm test` (NBA, NFL and Soccer suites; slow). `npm run build` uses a 4 GB heap.
- **Tools.** Playwright is pre-installed: `require('playwright')`, and `chromium.launch()` needs no options. The QA scripts are in `scripts/qa/`. The soccer lab is at `?soccer-lab`.
- **Dev server.** Use the port you were assigned, so agents don't collide.
- **Machine.** It has 4 CPUs and 15 GB RAM, shared with other agents. Don't run more than one heavy build or test suite at a time yourself.
- **Docs.** The repo's existing docs cover the engines, ratings and UT: `docs/*.md`. Read the ones for your area.

## OWNER DECISIONS (2026-11-09, binding; they override anything above or in a STREAM brief)

1. **Mode names stay exactly as they are** ("Ultimate Team", "Squad Battles", "Rivals", "SBC", "Evolutions", "Champions", …). Do not rename any mode. (Removing links that leave the installed app is still wanted.)
2. **Defense is played by default in solo games** (Squad Battles, Cups, Club Season, Moments, Gauntlet, draft seasons/playoffs vs AI), with an Auto-defend switch and a per-possession/drive/phase SIM button. Online head-to-head stays offense-only.
3. **A solo game takes 4–6 minutes** with defense included. Tune possession/drive/attack counts to that.
4. **Pack odds are realistic, with protection:** real-UT-style odds (most golds 75–82, 83+ a real hit, cheap 94–97 routes cut back) plus bad-luck protection (guaranteed program cards, Scout Stamps) and clear odds sheets.
5. **Re-rate everything accurately.** Corrected ratings apply to every card, owned or not, even when an owned card's numbers drop. Still never change ids, never remove an owned card, and document every change to a displayed overall.
6. **Shipping:** the iPhone top-edge fix ships early, as soon as it passes review; everything else ships together after full QA, straight to live.
