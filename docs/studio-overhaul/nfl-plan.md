# Team nfl: build plan (studio overhaul), revision 2

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, dev-server port **5216**. Cut from `claude/studio-overhaul` = main `acdf3e2`.
`O` below means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

**Sources read in full:** `O/BRIEF.md` (including the binding OWNER DECISIONS), `O/BUILD-RULES.md`, `O/OWNERSHIP.md`, `O/STREAM-nfl.md`, `O/audit-nfl.md`, `O/research-football.md`, the repo `CLAUDE.md`, `docs/NFL-DIRECT-CONTROL.md`, `docs/NFL-RUSHING.md`, `docs/CORE-GAMEPLAY.md`, `docs/GAMEPLAY-RATINGS.md`, all of `src/game/football2/`, and the NFL paths in `src/game/Arcade.tsx`, `src/game/difficulty.ts`, `src/game/progress.ts`, `src/game/play-feedback.ts`, `src/net/match.ts` (the wire parser), `src/ut/Match.tsx`, `src/ut/play.ts`, `src/ut/league.ts`, `src/ut/match-debrief.ts`, `src/ut/rate.ts`, `src/evolution/Training.tsx`, `src/App.tsx` and `scripts/qa/browser.mjs` / `online.mjs`.

**Other teams' plans read for the hand-offs:** `nba-plan.md` (nba-7, nba-9, NBA-30), `ut-plan.md` (contracts A and B, ut-4 PreMatch, ut-5 verdict and match ratings, ut-6 counters), `players-plan.md` (players-1, players-5, players-8 `impactOf`/`preloadClips`/sack falls and get-ups), `shell-plan.md` (Fix A `--sat`, shell-5 arena curtain, `browser.mjs` isolation), `packs-plan.md` (packs-6 ratings).

**Revision 2** answers an independent critique of revision 1. Every point is either built into a task below or rejected with a reason. §12 maps each point to where it went.

The team doc is `docs/studio-overhaul/nfl.md`. It holds what changed and why, measurements, "Protocol bump needed", "Touched outside my lane", the cross-team contracts, "Merge steps for the lead", owner device checks and what was left undone. nfl-1 creates it, and every later task appends to it.

---

## 1. Goals

The binding owner decisions come first:
- **OD-2:** defense is played by default in solo games, with an Auto-defend switch and a per-drive SIM.
- **OD-3:** a solo game takes 4–6 minutes including defense.

The team's goals:

1. **The ball carrier never gives up.** After a catch or handoff he keeps running with natural momentum until the thumb lands (C-1, the audit's critical bug).
2. **You see your team before the snap.** This holds at 320, 375, 393 and 430 widths and in landscape. Calling a play is quick, run plays show their lane, and the HUD never overlaps (P-1, V-1, V-3).
3. **Passing and pocket play fit a phone.**
   - Keep the Retro Bowl slingshot.
   - Add on-field receiver icons, a second-finger bullet/lob toggle, pocket movement, throwaways and slides (C-2, C-3).
   - Every state has at most 3 context buttons.
4. **Stats read as real.** Per-play distributions and rating spreads are calibrated to 2024–25 NFL numbers (research §1, §8.1). Seeded calibration tests assert them with 95% confidence intervals.
5. **Fair difficulty, and ties settled on the field.**
   - Difficulty changes only the AI's side, and the AI QB reads like a person (D-3).
   - Conversions and overtime run in every path (played, online, sim, takeover), and no result is decided by squad rating (D-4).
6. **Football, not half of it.**
   - A real defensive call table (D-1).
   - In solo games you play defense on the AI's drives, inside a 4–6 minute game (D-2, OD-2, OD-3).
   - Situational play suggestions (P-2).
7. **A studio-quality shell.**
   - Pause and quit everywhere, with an online forfeit (D-5).
   - Fast loading, and 0.6–0.8 s between plays.
   - A box score whose player of the game matches the UT result screen (F-2).

**Preserve** (audit §11):
- **The engine:** seeded, fixed-step and deterministic, 11-on-11, with render-only juice (`juice.test.ts`).
- **The `RunInput` contract:**
  - A `Pt` is human intent. A touched, centred stick is `{0,0}`, which brakes. It is never turned into `null`.
  - A number or `null` is the AI's lane.
  - nfl-1 adds one documented case: "the human has not touched the stick since this carrier got the ball" is sent as `null`. It is not a centred stick.
- **Above-99 ratings** stay bounded and finite.
- **The physical, rating-driven sub-systems:** blocking proximity, power and finesse rush, route breaks, coverage lag, one swept play on the ball per defender, catch-point reach, the tackler wind-up, move counterplay, and the 16 abilities.
- **Rules details:** penalties with accept/decline, blown coverages, and the seeded kickoff spot.
- **The landscape side camera**, which is the readability reference.
- **The feel touches:** replays, hit-stop, On Fire, the stamina bar, the tackler ring, high-point leaps, heavy gaits and afterimages.
- **Accessibility:** reduced motion, ARIA labels on every control, and the keyboard/WASD fallback.

## 2. Rules applied to every task

### Lane

- **We own** `src/game/football2/**` and `src/game/football/**`, except the player-drawing sections of `render.ts`: `lookFor`, `poseOf`, `animOf`, `sprite`, the sprite budget and the cache.
- **Shared with nba**, NFL branches only, in small hunks that never reformat a file:
  - `Arcade.tsx`, `difficulty.ts`
  - `play-feedback.ts`, `PlayReadout.tsx`/`play-readout.css`
  - `juice.ts`, `replay.ts`, `useInputInterrupt.ts`, `attrs.ts`
- **Keeping `render.ts` hunks small.** New camera and overlay logic goes in new files, `football2/camera.ts` and `football2/overlay.ts`. The `render.ts` hunks are calls only. This keeps us clear of players' `sprite()`, budget and draw-order edits (around lines 508, 672 and 794).
- **Keeping `Arcade.tsx` hunks small.** Match arithmetic goes in new pure modules, `football2/match-flow.ts` and `football2/sim-match.ts`. Arcade's NFL hunks stay a few lines each, which keeps clear of nba-7, nba-9 and shell-5's `withCurtain`.
- **New CSS** goes in new files under `src/game/football2/`, imported from our components: `play-tray.css`, `hud.css`, `pause.css`, `pass-controls.css`, `defense.css`. `src/styles.css` does not grow; it still holds about 69 `.fb2` rules.
- **Edits outside the lane** are listed under "Touched outside my lane" in `nfl.md`. The known ones are:
  - `src/game/progress.ts`: one optional field, `box`
  - `src/evolution/Training.tsx` NFL tip strings (an unowned file)
  - small hunks in `App.tsx`, `ut/Match.tsx` and `ut/match-debrief.ts`
  - a new shared `src/game/match-prefs.ts`

### Sport branches and determinism

- In shared files use `pick({ nba, nfl, soccer })`. Never write a two-way sport ternary.
- Engine, drive and autopilot code uses `p.rand` or `rng(hashString(…))` only. `Math.random()` is allowed in render-only code.
- Timed user inputs (Big Hit, tackle, swat) are stamped in engine time and applied at the next fixed engine step, never at wall-clock time.
- Engine logic never reads `Body.act`; a test enforces this (contract C9).

### Protocol

- Never edit `DRAFT_RULES` or `UT_RULES`.
- Write one line in `nfl.md`: **"Protocol bump needed: NFL draft 10→11, UT 11→12, because …"**, adding each task's reason.
- NBA and soccer are unchanged by us.
- New wire values are drive-end strings of at most 8 characters. `net/match.ts` `arcadeOf` (lines 543–552) accepts at most 40 such strings, `drive` ≤ 99 and `score` ≤ 999, and drops every other field. No net code changes.

### Saves

- No profile, storage-key, card, edition or copy id changes.
- New state is local, optional preference keys only, read and written through the new `football2/prefs.ts` (try/catch, typed defaults):

  | Key | Values | Added in |
  |---|---|---|
  | `perfect-season:fb2-pass-layout` | `'field'` / `'panel'` | nfl-4 |
  | `perfect-season:fb2-defense-snaps` | `'key'` / `'all'` | nfl-8 |
  | `perfect-season:auto-defend` | shared with nba, through `src/game/match-prefs.ts` | nfl-8 |
  | `perfect-season:fb2-playlog` | local play-stats roll-up | nfl-6 |

- Each key gets a test: missing, garbage and a throwing `localStorage` each give the default.
- None of these keys is in the cloud-save key list (checked, not edited).
- `perfect-season:fb2-played` is untouched.

### Commands (all through the semaphore)

- **Area tests:** `bash O/heavy.sh env PS_SPORT=nfl npx vitest run src/game/football2 src/game/play-feedback.test.ts src/game/juice.test.ts src/engine/sport-branches.test.ts`
- **Typecheck:** `bash O/heavy.sh npm run typecheck`
- **Fast calibration** (each task's bands plus guard bands, about 100 games per case, ≤ 15 min): `bash O/heavy.sh env MODE=fast CASES=… npx vite-node scripts/nfl_calibrate.ts`
- **Full calibration** (≥ 400 events behind every percentage band, each reported with a 95% Wilson interval, ≤ 60 min): `MODE=full`. It runs only at the end of nfl-7 and in nfl-10, plus the dedicated kick and two-point harnesses in nfl-9.
- **Fallback when a band can't be met in the session:** record the closest result with its interval and follow this priority order:
  1. determinism and safety
  2. OD-2 and OD-3 (defense, session length)
  3. turnovers and INT
  4. completion by depth and sacks
  5. the run distribution
  6. game shape
  7. secondary bands (scrambles, target share, kick mix)
- Full `npm test` and the single `npm run build` run only in nfl-10.

### Browser QA, isolated from live services

- **Dev server:** `nohup npx vite --port 5216 --strictPort > /tmp/ps-nfl-vite.log 2>&1 & echo $! > /tmp/ps-nfl-vite.pid`. Stop it with `kill $(cat /tmp/ps-nfl-vite.pid)`.
- **URL:** `http://localhost:5216/?arcade&sport=nfl&ns=inspect&relay=ws://localhost:7777&seed=…`
- **New harness `scripts/qa/nfl-lib.mjs`**, copied from `O/audit-scripts/utui/lib.mjs`:
  - `context.route('**/*')` aborts every host except localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com, and logs what it blocked.
  - It injects insets on `.arcade-full` until shell's QA override lands.
  - It sets `reducedMotion` explicitly on every run, so motion checks are not vacuous.
  - The base URL is fixed to port 5216.
- **Legacy scripts** (`joystick`, `rushing`, `core-gameplay`, `play-feedback`, `gameplay`, `online`) use shell's `browser.mjs`, which has no route-abort until shell's branch merges, defaults to `reducedMotion: 'reduce'` and to port 5173. They run only through a preload guard: `node -r ./scripts/qa/nfl-guard.cjs scripts/qa/<name>.mjs`.
  - The guard wraps `chromium.launch` so every `newContext` gets the same route-abort.
  - It sets `PS_QA_URL=http://localhost:5216/` and takes `reducedMotion` from `NFL_RM`.
  - It fails the run if any non-local request was attempted.
  - A legacy script the guard can't wrap is not run until the merge, and that is recorded.
- **The local relay** binds the fixed port 7777, so other teams' runs would collide. Every relay-using run is serialized with `flock -w 1800 /tmp/ps-qa-relay-7777.lock …` and checks that the port is free first. The lock path is published in `nfl.md` for other teams.
- **Positions** are read by hooking `FootballRenderer.prototype.draw` from the dev server, QA-only, as `nfl_catchstop.cjs` does. No product debug hooks are shipped.

### Viewports

Use touch, `isMobile` and `deviceScaleFactor: 1`. Every UI task runs all five, plus a reduced-motion run:

| Name | Viewport | Insets |
|---|---|---|
| A | 393×852 | 59/34 (owner's phone) |
| B | 430×932 | 59/34 |
| C | 320×568 | 20/0 |
| D | 844×390 landscape | top 0, bottom 21, left/right 59 |
| E | 375×667 | 20/0 (SE class) |

Screenshots go to `O/shots/nfl/<task>/`, and each is looked at.

### Layout acceptance on every UI task

- Every control is ≥ 44×44 design px and ≥ 8 px from its neighbours.
- Every text a player must read is ≥ 10 design px.
- The tray, SNAP and bottom controls sit ≥ 8 px above `var(--sab)`.
- In landscape, the stick and buttons are ≥ 8 px inside `--sal`/`--sar`.
- No horizontal overflow.

### Reduced-motion spec, decided once

| Element | Normal | Reduced motion |
|---|---|---|
| Dynamic zoom | eases | fixed at 1 |
| Tray collapse, scoreboard flip, box-score reveal, lower-third | animate | instant |
| Incompletion bounce | 0.6 s tumble | the ball fades in place |
| Takeaway return | 1.2 s run | a cut to the spot |
| HOLD TO RUN ghost | pulses | static label |
| Timing rings (Big Hit, pressure ring) | glow | still fill and still show the window (they carry information); no pulse, glow or flash |

### Performance

- Rings, icons, meters and needles are written through refs, never React state.
- During live play, outside input events, there are at most 2 React commits per second (Profiler).
- The match uses one `FootballRenderer` (the defense draws with swapped kits; no second renderer or sprite cache).

### Commits

- Stage explicit paths after each task, at the commit points each task lists.
- The message starts `Claude: ` and ends with the two trailer lines from BUILD-RULES.
- Push with `git push -u origin claude/studio-nfl`, retrying 4 times (2/4/8/16 s) on network errors.
- Never `git add -A`, force-push, rebase or bare `git stash`.

## 3. Baseline to beat

From the audit at `acdf3e2`, 120 seeded games per case, re-measured by nfl-1 with confidence intervals:

| Metric | Target | Measured now |
|---|---|---|
| Completion % | 64–65 | AI Pro gold 70.1; elite-Legend 51.0; human proxy 63–68 |
| By depth: behind / 0–9 / 10–19 / 20+ | 79 / 72 / 55 / 35 | Deep: AI 55%, human proxy 57–62% |
| INT % | 2.2, rising with depth | AI Pro gold 2.7; elite 5.8–6.9 |
| Sack % | 6.9 (≈ −6.5 yd each) | AI 0.1–3.5; human proxy 10.8 / 12.3 / 26.6 (Rookie / Pro / Legend) |
| Time to throw / to sack | ~2.8 s / 3.8–4.5 s | AI 1.39–1.64 s / ~3.0 s |
| 20+ yd gains, % of attempts | 8–9 | Human proxy 18.5–19.9 |
| YAC | 5.2 | 1.4–4.2; 2.0 with a 0.35 s stick delay |
| Runs: YPC / median / ≤0 / 10+ / 20+ | 4.3 / 3 / 18% / 10–11% / 2.2% | 3.76 / 3.1 / 10% / 1% / 0.3%; P99 9.7 |
| Target share | WR2 matters | Z 5.7%; RB 20–44% |
| Points per drive | ~2.1 (AI v AI) | AI Pro gold 3.75; elite-Legend 1.22 |
| Turnovers / DOWNS, % of drives | ~10 / ~6 | elite-Legend 31 / 12–55 |
| 3rd-down conversion | 39–40, by distance | 40–49 |
| Ties decided by squad rating | 0 | 10–13% (gold); 20% (elite Legend) |
| Human proxy wins (Rookie / Pro / Legend) | ≥70 / 45–55 / 28–38 | 47.5 / 41.2 / 29.9 |
| Catch with no stick (live) | keeps running | 5 of 5 braked to 0 within 0.25 s |
| Play-call panel vs line of scrimmage (390) | formation visible | QB and RB hidden; at 320 all 11 hidden |
| Ability pops per play | ≤ 1 | 0.7 (gold); 2.0–2.4 (elite) |
| Frame pacing at 4× throttle, 15 s | frames > 33 ms ≤ 5; long tasks ≤ 250 ms | 10 frames; 6 long tasks (527 ms) |
| Offensive drive wall time (1×) | measured by nfl-1 | unknown |
| PLAY tap → first playable tray | ≤ 1.6 s at 1×, ≤ 4 s at 4× | measured by nfl-1; UT matches always fetch `nfl-attrs` (~1.04 MB) and keep PLAY disabled until it loads |
| Heap, solo game | ≤ 45 MB with defense | 35.6 MB (offense only) |

## 4. Cross-team contracts (settled in writing in nfl-1, before any code)

The plans already diverge, so "whichever lands first" would guarantee rework.
- nfl-1 writes these contracts into `nfl.md` under "Cross-team contracts", each with the exact signature and the owning team.
- Where another plan already defines a contract, we adopt theirs (contracts A and B from ut).
- Where theirs cannot work, we say why and propose a fix (C1).

**C1. Forfeit: the `'FF'` drive-end marker** (nba, ut, App.tsx).
- `net/match.ts` `arcadeOf` keeps only `score`, `drive`, `done`, `ends` and `plays`. NBA's proposed `Progress.forfeit` field is therefore silently dropped on the wire, and a lead-owned `src/net` edit would be needed.
- The only design that works without one is a marker inside `ends`.
- **Rule:**
  - A quitter pads its `ends` with `'FF'` (worth 0) up to the number of units currently required, at least one more than it has played, and sends `done: true`.
  - Any `'FF'` in a side's `ends` means that side forfeited. The score is not used.
- `Arcade.onFinish` gets an optional 6th argument, `forfeit?: 'us' | 'them'`.
- `App.tsx` `finish` and `ut/Match.tsx` `finish` map it to `won` in at most 6 lines each.
- We propose that nba uses the same marker (it is sport-agnostic and fits the 8-character rule). The lead keeps one copy.

**C2. Overtime and the meaning of `done`** (nba, ut).
- `done` is sent only when this side knows the result is final, so it stays monotonic. This is the same as nba-7.
- NFL units:
  - 4 regulation drives
  - then 1 OT drive each from the opponent's 25 (4 downs, no clock, normal end codes)
  - then sudden-death two-point rounds: `'P2'` is good (2 points), `'P0'` is no good
  - The cap is **20 rounds**, so at most 25 ends, inside the wire's 40. With a round tie probability of 0.45² + 0.55² ≈ 0.505, 20 rounds leave 1.2 × 10⁻⁶ unresolved, about 0.01 per 10,000 ties. Only past the cap does the old `decide()` path run.
- The pure `football2/match-flow.ts` exports:
  - `required(us, them)`: units each side must play
  - `final(us, them)`
  - `forfeitBy(ends)`
  - `pointsOf(ends)`
  - `isTouchdown(end)`
- **Arcade's NFL branch** uses these in place of `TOTAL`: in `rivalLive` (slice and `done`), `finishedFrom`, `shown`, takeover and `taken`.
- **Waiting.** A side that has finished every unit currently required, while the rival hasn't, sees a wait line. The `STALL_MS` and `GONE_MS` rules apply to each waiting phase, regulation or OT.
- **Takeovers** cover OT. The AI plays the rival's OT units with the seeds `seed + ':takeover:ot<n>'` as both sides' ends arrive. Both phones compute it from identical inputs.
- **To nba:** the same shape. We propose a sport-agnostic `flowFor` chosen with `pick` in Arcade. Whichever team lands first writes the generic Arcade hunk, and the other plugs in its own flow module.

**C3. Box score: ut contract A, adopted.**
- `Progress.box?: BoxLine[]` (a 2-line optional field in `src/game/progress.ts`, touched outside the lane).
- NFL `stats` keys: `passYds passTd int rushYds rushTd rec recYds recTd tkl sacks defInt`, plus extras `fgm fga xpm xpa long`. ut reads `Record<string, number>` duck-typed.
- We fill `rating` (1.0–10.0) on every line. It is the **single source** for both our player of the game and ut-5's MOTM ("highest rating, ties to the winning side"), so the two screens can't disagree.
- `box` is attached only to the `Progress` objects passed to `onFinish`, never to `onProgress`, so it never reaches the wire. A test enforces this.
- Online, the rival's `box` is absent.
- This replaces revision 1's `onBoxScore` callback.

**C4. Solo quit: ut contract B, adopted.**
- `Arcade` gets `onQuit?: (us: Progress, them: Progress) => void` and an optional `quitText?: string`.
- Hosts decide what quitting means:
  - ut maps Cup, Circuit, Club Season and UT Draft to the forfeit settlement, and Squad Battles and Events to leaving without a result, with `quitText` "Leave match? No result is recorded."
  - `App.tsx` maps a draft game against the AI to a loss.
- Without `onQuit` the menu shows Resume only, as NBA does.
- Revision 1's "quit counts as a loss" everywhere is withdrawn.

**C5. Difficulty: one helper in `difficulty.ts`** (nba).
- We adopt nba's name, `rivalOffenseFaces(online: boolean, level?: BotLevel): number`, for how well the user's team defends the AI's offense.
- Online it returns `COMPETITIVE_DEFENSE`. Offline it returns `pick({ nba: 0, nfl: NFL_USER_DEFENSE[level ?? 'pro'], soccer: 0 })`, where `NFL_USER_DEFENSE = { rookie: 0.35, pro: 0, legend: 0 }`.
- `defenseDifficulty` keeps its meaning (the AI defense facing the human).
- Revision 1's `userDefenseIQ` is withdrawn.

**C6. Auto-defend: one meaning, one preference** (nba, ut).
- **Meaning:** Auto-defend means the defensive snaps play themselves at ≥ 3× speed and stay watchable. SIM means an instant result for one drive or possession.
- **Preference:** one shared key, `perfect-season:auto-defend` (boolean, default off), in a new `src/game/match-prefs.ts` with `getAutoDefend()`/`setAutoDefend()`.
  - nba's prefs object reads and writes through it.
  - ut's PreMatch (M13) can read it to show the switch.
- Revision 1's NFL-only `fb2-defense: 'play' | 'sim'` is withdrawn.

**C7. Crowd flag: not added** (crowd pressure is deferred, §9).
- If a later wave adds it, `Arcade` forces `'neutral'` whenever `online`, with a test, and never trusts the caller.

**C8. Drive-end codes and counting touchdowns** (ut).
- **Codes:**
  - `TD` (7, XP made)
  - `TD6` (missed XP or failed two-point try)
  - `TD8` (good two-point try)
  - `FF` (forfeit, 0)
  - `P2` / `P0` (OT rounds)
- **Requests to ut:**
  - `match-debrief.ts:52` counts `n('TD', 'TD6', 'TD8')`, and its allowed list gains every new code. We make this ≤ 3-line hunk ourselves in nfl-9 if ut hasn't.
  - ut-6's daily "Score 2 touchdowns" counter uses `isTouchdown(end)`.
  - ut-5's `verdictOf` honours a forfeit: a forfeit winner with fewer points shows WIN.
  - `ut/Match.tsx` points and labels maps gain the codes.

**C9. Acts for players: existing acts only.**
- The engine sets:
  - `backpedal` while the QB drops (players-5 renders the same)
  - `down` on a sacked QB and `tackle` on the sacker
  - `catch` on the RB at the handoff mesh
  - catch-style events `catch:poss`, `catch:yac` and `catch:high` in `p.events`
- **No new `getup` act.** players-8 renders get-ups from `down` plus elapsed time, and sack falls from `p.end.kind === 'sack'`. Revision 1's engine `getup` would have duplicated that work with a conflicting design.
- Requested from players:
  - a holder kneel pose for field goals
  - QB rollout and play-action fake clips (optional)
- A test proves engine logic never reads `act`. Swapping every `act` value for a dummy leaves 500 seeded plays identical, so render-only acts can never change outcomes.

**C10. Juice and clips** (players).
- We approve players' `juice.ts` hit-stop cap hunk (about 8 lines).
- Every NFL hit-stop and shake goes through one local function, `football2/feel.ts` `impact(kind, a, b)` (nfl-7). At the merge the lead swaps its body to players' `impactOf`, a one-line merge step.
- `preloadClips('nfl')` is called on `Football2` mount, also a one-line merge step, since the function doesn't exist on our branch.

**C11. Shell.**
- All HUD offsets use `var(--sat/--sar/--sab/--sal)`; they are re-measured after Fix A merges.
- After the first frame is drawn we dispatch `window.dispatchEvent(new Event('ps:arena-ready'))`. This is the same event shell's `arenaReady()` sends, so no import is needed.
- shell-5's `withCurtain` wraps our `Football2` return; our Arcade hunks avoid those lines.
- We review the NFL lines of shell's `arena-tips.ts` in `nfl.md` after nfl-3 and again in nfl-10, once the controls are final.

**C12. Club Season simulation** (ut, written request).
- `ut/league.ts:421-431` scores AI games as 7/3/0 per `DRIVES` with a 43% touchdown rate per drive (real: 23%), plus +3 for OT.
- Its box score (`league.ts:348-357`) assumes only 7s and 3s, so a played 6- or 8-point touchdown would save wrong player TD totals into `ut.league`.
- **Request:**
  - For played games, take TDs from `ends` with `isTouchdown()`, or from `box`.
  - For AI sims, use the `DRIVE_ODDS` table nfl-10 publishes from calibration.
- `DRIVES` stays 4 everywhere, because `league.ts:2` imports it.

**C13. packs** (written request).
- The in-game display label for `truck-stick` changes from "Truck Stick", a reference-game mechanic name, to "Bulldozer". The id is unchanged.
- The UT card detail takes ability names from `ut/rate.ts` `abilityName()`, which falls back to the id, so packs or players should add the same label there.
- Re-rated cards (packs-6, OD-5) move our calibration fixtures. We pin fixture card ids and a ratings snapshot, and re-run at integration (§11).

**C14. players** (written request plus notice).
- **Camera notice.** The camera reframe (nfl-3, step 1) changes on-screen sprite sizes. players-1's stale-draw targets were measured on the old camera, so they get a notice the day it lands.
- **V-1 requests:** the floor yard-number LOD and the per-frame JS `drawFloor` (audit §10). Both live in `pixel/persp.ts`, which players own, and are not in `players-plan.md`.
- **Acknowledgement.** We track their answer in `nfl.md`. If they decline, both move to deferred with that reason.

## 5. The solo format and session length (OD-2, OD-3)

**The budget.**
- Revision 1 planned 4 offensive drives plus 4 fully played defensive drives at ≤ 75 s each, which comes to about 9–10 min.
- The binding target is a median of **4–6 min**, with P90 ≤ 6.5 min, at 1× speed with replays on and defense played.

**Why 4 drives stay.** With conversions and about 2.1 points per drive, the chance of a tie after regulation is:

| Drives each | Tie after regulation | 0-0 finals |
|---|---|---|
| 4 | ≈ 11.5% | ≈ 1.8% |
| 3 | ≈ 16% | ≈ 4.7% |

Only 4 drives meet the targets of OT ≤ 12% and 0-0 ≤ 2%. So `DRIVES` stays 4 for online, solo and `league.ts`.

**The format.** Solo games alternate: your drive k, then the AI's drive k on defense.
- On the AI's drives you play **key snaps**:
  - 3rd and 4th downs
  - every snap inside your own 20
  - the AI's two-point tries
- Every other AI snap plays itself at 3×, watchable, with your call made by the situational table at your level. A SKIP button jumps to the next key snap.
- The preference `perfect-season:fb2-defense-snaps` = `'all'` is an opt-in "Longer games" mode that plays every snap.
- Auto-defend (C6) plays all AI snaps at 3×.
- SIM DRIVE sims one AI drive instantly and shows the D-2 recap.
- Online head to head stays the parallel offense race (OD-2).

**Time budget per drive** (nfl-8 measures it with the wall-clock model):

| Drive | Make-up | Target |
|---|---|---|
| Offense | about 6 plays × (2.5 s pick + live play + 0.7 s whistle-to-tray), plus skippable replays on big plays | median ≤ 45 s |
| Defense | about 2.5 key snaps × (call + play + 0.7 s), plus about 3.5 auto snaps at 3×, plus 3 s of transitions | median 35–40 s |
| OT | — | adds ≤ 90 s |

**Fallbacks**, in order, if the median is above 6 min after tuning:
1. auto snaps at 4×
2. replays only on TDs and turnovers
3. 0.6 s whistle-to-tray
4. last resort: a separate `SOLO_DRIVES = 3`, never a change to `DRIVES`, with the OT target relaxed and recorded

**Online race:** median ≤ 5 min.

**What "solo" covers (OD-2).**
- **Covered:** Squad Battles, Cups, Club Season, Events, UT Draft games and draft games against the AI.
- **Gauntlet** (`engine/gauntlet.ts`) is a pure simulation with no Arcade, so there are no drives to defend.
- **NFL Moments** are run, throw and kick drills, with no AI drives.
- These are recorded in `nfl.md` as a deliberate reading of OD-2. We offer ut a defensive Moment through `practice.drill = 'defend'` (nfl-8, cut line).

**Per-drive SIM in manual-only modes** (Circuit, Club Season, Cups):
- **Defensive SIM DRIVE is allowed.** The rival's drives were always simulated before this overhaul, and the match stays `how: 'played'` because you played your offense. Cup settlement still rejects a whole-match sim; nfl-8 checks this.
- **Offensive SIM stays disabled** in manual-only modes.

## 6. Gestures, pointer ownership and the control map

This is written in nfl-1 and built as `football2/gestures.ts` (pure, unit-tested) in nfl-4.

**Pointer ownership.**
- A pointer that goes down on the stick, or in its zone (the bottom-left 45%), belongs to the stick until it lifts.
- Every other pointer belongs to the action surface.
- Button pointers belong to their button.

**Tap or drag.**
- A tap moves < 10 design px and lasts < 250 ms. Anything else is a drag.
- The slingshot starts at 10 px of travel.

**Receiver icon.**
- A pointer down on an icon and up as a tap throws to that receiver.
- If it moves ≥ 10 px it becomes a slingshot drag from there, and the icon tap is cancelled.

**Second-finger bullet/lob toggle.**
- During an active slingshot drag, a tap by another pointer toggles BULLET and LOB.
- That pointer must not be the stick's pointer id and must not be on a button.
- So the left thumb holding the stick never counts as a "second finger".

**Before the snap.** A drag ≥ 10 px on the field above the tray collapses the tray. Taps on receivers do nothing before the snap, because hot routes are deferred.

**Cover ball.** The right thumb held still on the field for ≥ 0.3 s while running, not on a button. One thumb is on the stick, so research's two-finger hold is impractical.

**Defense.**
- TACKLE is one button: a tap in range dives, and a tap inside the Big Hit window is a big hit.
- While the ball is in the air and your man can reach it, the same slot reads SWAT.
- SWITCH is separate.

**Control map, at most 3 context buttons per state:**

| State | Left thumb | Context buttons (right thumb) |
|---|---|---|
| Pass, in the pocket | stick moves the QB | RUN IT · THROW AWAY (shown only outside the box) · BULLET/AUTO/LOB chip. Slingshot and icons are the surface. |
| Ball carrier | stick | JUKE · SPIN, or SLIDE for a QB past the line, or DIVE within 3 yd of the line to gain or goal line · POWER (tap; hold to truck) |
| Defense | stick moves your defender | TACKLE or SWAT · SWITCH |

**Documented exception: BURST.** BURST stays as a hold modifier in the carrier state, from CLAUDE.md's "permanent stick and separate skill buttons". It is not a context button. This is the one recorded exception, and the owner checks it on a device.

Revision 1's separate DIVE, PROTECT and SLIDE buttons are folded into the contextual slot and the cover-ball hold.

## 7. Protocol summary

**Protocol bump needed: NFL draft 10→11, UT 11→12.** Each task adds its reason to `nfl.md`:

| Task | Reason |
|---|---|
| nfl-1 | input semantics after a carrier change |
| nfl-2 | OT units, the `FF`/`P2`/`P0` codes and `done` semantics |
| nfl-4 | pocket, throwaway, slide, scramble throws |
| nfl-5 | defensive calls, AI reads, play calling, formations |
| nfl-6 | passing calibration and catch types |
| nfl-7 | runs, contact and moves |
| nfl-9 | kicking, punts, conversions, the two-minute clock, draft fill-ins |
| nfl-10 | calibration tuning |

Two tasks need no bump:
- **nfl-3** is render and UI only.
- **nfl-8** is solo-only. Its engine additions are inert without `p.user`. A determinism guard over AI plays, `aiDrivesOf`, `simMatch` and takeover outputs proves it.

NBA and soccer are not bumped by us.

---

## 8. Ordered tasks

Each task lists its commit points, so the session can push partial progress safely, and a **cut line**: the items that move on (to a named later task, or to §9) if the session runs short. Cut-line items are placed so that the binding work (OD-2, OD-3) and the P0 bugs are never the ones cut.

### nfl-1 (P0, enabling): contracts, calibration harness, baselines and the momentum carry (C-1)

**Commit points:** (1) contracts and specs; (2) harness and baselines; (3) C-1 and the stick knob; (4) preferences and QA harness.

**Changes**
- **`nfl.md`.** The BUILD-RULES sections, plus:
  - "Cross-team contracts" (C1–C14 in full)
  - "Merge steps for the lead": `impactOf`, `preloadClips`, re-screenshot the NFL HUD after nba and shell merge, re-run calibration on the merged card pool
  - the relay lock path
  - the gesture and control map from §6
  - the solo format from §5
  - the first "Protocol bump needed" line
- **New `src/game/football2/sim-kit.ts`.** Pure, with no DOM.
  - `fixtureTeams('silver' | 'gold' | 'elite' | 'promo')`, built as `nfl_sim.ts` builds them. `promo` is GOAT and promo editions with 100–110 attributes.
  - Fixture card ids and an attribute snapshot are pinned in `docs/studio-overhaul/nfl-calibration/fixtures.json`, so before and after stay comparable after packs-6 re-rates cards.
  - `synthTeams(level)`.
  - `PilotMode = { kind: 'ai' | 'human'; skill: number; defIQ: number; stickDelay?: number; neverStick?: boolean; pocket?: boolean; pickS?: number }`.
  - `playGame(…)`.
  - `summarize(acc)`. It returns every §3 metric with event counts and 95% Wilson intervals, plus:
    - the run histogram and percentiles
    - passing by depth
    - 3rd down by distance
    - red zone
    - target share
    - time to throw and time to sack
    - sack and scramble yards
    - FG by distance
    - score histogram, tie and 0-0 odds
    - margins
  - `wallClock(game, pacing)`: the wall-clock model from engine time plus the UI constants exported by `football2/pacing.ts` (play pick 2.5 s, stick 0.35 s, whistle-to-tray, replay lengths, banner lengths).
- **New `scripts/nfl_calibrate.ts`.** Read-only, run with vite-node.
  - `MODE=fast|full`; `CASES=ai,human,stick,mis,shape,ladder,promo,wall`.
  - It writes `docs/studio-overhaul/nfl-calibration/<label>.json` and a markdown table.
  - It never touches a profile, relay or registry.
- **New `calibration.test.ts`.**
  - An always-on fast block: synthetic teams, 40 games, sanity bands.
  - An opt-in `CAL=1` block with real-card bands that later tasks extend.
- **New `imports.test.ts`.** No product file imports `sim-kit`, `nfl_calibrate` or the fixtures, which keeps them out of every bundle.
- **C-1, the momentum carry (`Football2.tsx`).** The pre-hold rule is designed together with the nfl-4 pocket stick.
  - On a carrier change, `touched` becomes true when either:
    - it is a designed run handoff and the stick is deflected, or
    - the stick is deflected with an upfield component ≥ 0.3 × its length.
  - Otherwise the carrier runs on momentum (`null`) until a new stick pointerdown or keydown, or until the stick moves ≥ 0.25 from its value at the change.
  - So a QB drifting back-left who completes a pass does not send the receiver back-left.
  - A touched-then-released stick still brakes.
- **`engine.ts` carrier branch.** With `null` input, a receiver or a scrambling QB carries his heading. Lateral velocity decays at 0.6× the AGI turn rate for 0.35 s, then the existing upfield path takes over. The RB keeps `followingRun`.
- **HOLD TO RUN ghost.** It pulses on `.fb2-stick` while the ball is in the air and the stick is untouched. Under reduced motion it is a static label.
- **Knob performance.** The knob is driven through a ref (`knobRef.style.transform`), not `setKnob` state.
- **New `football2/prefs.ts`.** `readPref`/`writePref`, typed and guarded by try/catch.
- **QA harness.** `scripts/qa/nfl-lib.mjs`, `scripts/qa/nfl-guard.cjs` and the relay lock (§2).
- **Baselines:**
  - every §3 metric, fast and full
  - the **offensive drive wall time**, from the model over 30 games and from 5 browser autoplay games at 1× with real timers (the model must match within ±10%)
  - **PLAY tap to first playable tray** at 1× and 4× CPU, for a draft game and a UT Squad Battle
  - `nfl-attrs` bytes fetched in a UT match
  - heap after 2 drives
  - shell's chunk-size baseline, noted for nfl-10

**Tests and measurements**
- **`rushing.test.ts`.**
  - `null` after a catch in the open field: speed at +0.5 s ≥ 0.85 × catch speed, and ≥ 4 yd gained in 1 s.
  - A touched `{0,0}` brakes to < 0.01 yd/s.
  - A pre-held upfield `Pt` drives at once.
  - **Pocket-drift case:** the stick held back-left at the catch. In 20 of 20 seeds the receiver's heading has an upfield component at +0.3 s.
- **CAL stick cases** (gold v gold, Pro, full mode):
  - YPC(+0.35 s) ≥ **0.95×** YPC(held) (revision 1 had 0.9×)
  - untouched YPC ≥ 0.95× held
  - YAC(+0.35 s) ≥ 0.85× held
  - If 0.95× is missed, the gap and its cause go in `nfl.md`, and the fix is tracked in nfl-7.
- **Live `scripts/qa/nfl-catch-run.mjs`** (6 seeds, A and C, a pass to the RB with the stick never touched):
  - 6 of 6 carriers keep ≥ 70% of catch speed at +0.25 s and ≥ 50% at +0.5 s.
  - YAC > 1 yd on ≥ 5 of 6.
  - `joystick.mjs`, run through the guard, still passes.
- **Profiler.** ≤ 10 commits to `Football2` during a 2 s drag (baseline: about one per pointermove).
- **Preferences.** `prefs.test.ts` covers a missing key, garbage values and a throwing `getItem`/`setItem`, all giving defaults.
- **Harness budget.** Fast CAL takes ≤ 15 min and full ≤ 60 min under `heavy.sh`, with the measured times written down.
- **QA isolation.** The guard blocks a probe `fetch('https://example.com')`, and `nfl-lib` reports it as blocked.

**Screenshots.** A and C: a catch at +0.25 s with no stick, and the HOLD TO RUN ghost, normal and reduced motion.

**Protocol.** Needed. **Saves.** None (the prefs helper adds no key yet).

**Cut line.** None; this task enables all the others.

**Dependencies.** None.

### nfl-2 (P0): match flow: pause, quit and forfeit, overtime in every path, fast load and between-play pacing (D-5, D-4 OT, NBA-30-style load, research §8.9)

**Commit points:** (1) `match-flow.ts`, `sim-match.ts` and OT in `drive.ts` with unit tests; (2) Arcade hunks and the two-client tests; (3) pause, quit and the scheduler; (4) load and pacing; (5) QA.

**Changes**
- **New pure `football2/match-flow.ts`**, as in contract C2:
  - points for every code, `isTouchdown`
  - `required`, `final`, `forfeitBy`
  - `MAX_ROUNDS = 20`
- **`drive.ts`:**
  - `otStart(g)`: `ballOn` 75, 4 downs, no clock
  - `tryFrom2(g)`: one snap from the 2 using the normal tray, success only on a TD, recorded as `P2` or `P0`
  - Both are reused by conversions in nfl-9.
- **New `football2/sim-match.ts` `simMatch(...)`** returns `{ us, them }` with OT units appended, deterministically from seeds. It is used by:
  - `Arcade.sim()` (SIM MY DRIVES)
  - takeovers
  - `ut/Match.tsx` `simBoth`, through a ≤ 6-line hunk in a ut-owned file, listed. The online vote-to-sim gives the same result on both phones.
- **`Arcade.tsx` NFL branch** (contract C2; small hunks):
  - The OT wait line: "Level after 4 drives: overtime. One drive each from their 25, then two-point rounds."
  - Your waiting deadline shown during OT.
  - Forfeit handling: any `FF` finishes the match at once.
  - `onQuit`/`quitText` (C4).
  - Kickoff copy: "a tie goes to the better team" (`Arcade.tsx:390`) becomes the OT line; "from your own 25" becomes "from where the kickoff leaves you".
- **`App.tsx` simH2H.** Not an arcade path, so rejected with a reason (§9).
- **New `football2/PauseMenu.tsx` and `pause.css`.**
  - **Button:** 44 px, at `top: calc(var(--sat) + 8px); right: calc(var(--sar) + 8px)`, in every live and pre-snap state. It is hidden in final, in replays and in `practice`.
  - **Menu:** Resume; Controls (the §6 control map diagram); Sound and Haptics (existing setters); Quit or Forfeit.
  - **Offline**, pause freezes the fixed-step loop, replays, the kick meter and every between-play timer. A new pause-aware scheduler, `football2/clock.ts` `after(ms, fn)`, replaces the `setTimeout` chains in `finish`, `nextUp` and the replays.
  - **Auto-pause** on `visibilitychange` to hidden and on `pagehide`, through our own listener. The shared `useInputInterrupt.ts` is left alone.
  - **Online**, pause freezes only your own game. In the parallel format nothing of yours is live for the rival, and the takeover rules still bound stalling. The menu shows **your** takeover deadline: once the rival is done, the AI takes your drives after `STALL_MS` = 60 s without a play, or `GONE_MS` = 25 s after your phone goes quiet. A countdown chip shows when < 30 s remain. The difference from nba (no online pause) is recorded for the lead to align.
- **Quit (D-5).** A confirm sheet:
  - offline: `quitText`, or "Quit match? It counts as a loss."
  - online: "Forfeit? <rival> wins."
  - `App.tsx` and `ut/Match.tsx` map `forfeit` and `onQuit` in ≤ 6 lines each.
- **Load.**
  - `Football2` and `Arcade` skip `loadAttrs()` when `offense` and `rivalDefense` (or `teams`) are given, setting `attrs = () => null` as soccer does. So UT matches fetch none of `nfl-attrs` and PLAY is enabled at once.
  - `ps:arena-ready` is dispatched after the first drawn frame (C11).
- **Pacing (research §8.9).**
  - Whistle to tray: 0.6–0.8 s on non-scoring plays (from 1.35 s), and 0.8 s on a first down.
  - TD to tray ≤ 2.5 s, or ≤ 0.4 s after a tap.
  - Celebrations and replays skip on a tap.

**Tests and measurements**
- **`match-flow.test.ts`.**
  - The `required` sequence, points, `final` and `forfeitBy`.
  - **10,000 seeded tied regulations** through `simMatch`: 0 decided by squad rating, and the most rounds used is reported (< 20).
  - OT adds ≤ 90 s in the wall-clock model.
- **`overtime.test.ts`.** Two simulated clients exchange `Progress` with random delays, over 500 seeds, and agree on the same final in:
  - regulation
  - a forced tie into OT
  - a takeover in regulation
  - a **takeover in OT**
  - a **quit in OT** (`FF`)
  - `GONE` during OT
- **Determinism.** The `aiDrivesOf` regulation hash is unchanged; OT is appended only.
- **New `scripts/qa/nfl-shell.mjs`** (A–E, normal and reduced motion; relay runs under the lock):
  - Pause holds `p.t` with 0 drift over 3 s, and resume continues.
  - A hidden-page event pauses within one frame.
  - Offline quit shows a loss.
  - **Online, two clients:**
    - A forfeits in drive 2; B shows a win within 5 s and A a loss.
    - A forced tie plays OT on both phones, which settle the same winner.
    - The takeover countdown shows below 30 s.
  - **Load:** PLAY to first playable tray ≤ 1.6 s at 1× and ≤ 4 s at 4× CPU, for a draft game and a UT fixture; 0 bytes of `nfl-attrs` in the UT match.
  - **Pacing:** whistle to tray 0.6–0.8 s over 20 plays; TD to tray ≤ 2.5 s, or ≤ 0.4 s after a tap.
  - The pause menu and sheets: controls ≥ 44 px, text ≥ 10 px, no overlaps.

**Screenshots.** A, C, D and E: the pause menu, the quit confirm (offline and online), the OT wait line, the OT banner and the final with OT marks.

**Protocol.** Needed. **Saves.** None. Saved match records may now contain the new codes; readers are handled in C8 and nfl-9.

**Cut line.** The Controls page's diagram moves to nfl-3.

**Dependencies:**
- nba: the C1 and C2 Arcade shape
- ut: `simBoth`, `finish`, `onQuit`
- shell: `--sat`, `ps:arena-ready`

### nfl-3 (P0): the screen: pre-snap tray, HUD manager, camera and overlays (P-1, P-3, P-4, V-1, V-3, V-4 display, C-6, F-1 drive clock, §8.6.2 On Fire meter)

**Commit points:** (1) **`camera.ts` alone, committed, with a notice to players in `nfl.md` that day** (C14); (2) the tray; (3) the HUD manager; (4) overlays and copy; (5) QA.

**Changes**
- **New `football2/camera.ts`.** The `render.ts` hunk is a call only.
  - The row eases from 0.50 before the snap to 0.62 when live; the horizon goes from 0.13 to 0.07.
  - Scale makes near-line players ≥ 28 css px tall at A.
  - Dynamic zoom:
    - 0.88 with a flight ≥ 1.2 s or an aim ≥ 25 yd
    - 1.12 with 2 or more defenders within 3 yd of the carrier
    - 1 otherwise
    - fixed at 1 under reduced motion
- **New `PlayTray.tsx` and `play-tray.css`**, replacing `.fb2-call`.
  - **Header:** down and distance, FLIP and PLAYBOOK.
  - **Strip:** a scroll-snap strip of 3 suggested and 2 recent cards, about 104×88 each.
  - **Buttons:** SNAP ≥ 64×64; on 4th down a GO / KICK / PUNT row.
  - **Collapse:** the chevron collapses the tray to a 56 px bar, and so does a field drag (§6).
  - **Placement:** ≥ 8 px above `--sab`.
  - **Landscape:** a 300 px dock inside `--sar`, with move buttons on an arc (C-6).
- **New `football2/hud.ts` and `hud.css` (V-3).**
  - One queue, with priorities, minimum display times and clearing on phase change.
  - Slots:
    - top banner (hints, OT and conversion banners)
    - lower-third broadcast strip (result pops from `say()`, the TOUCHDOWN strip)
    - corner (the LAST PLAY readout, positioned through our CSS)
    - over-head (ability pops)
  - The nfl-2 OT banner is moved into it.
  - **V-4:** at most one ability pop per play, the first that changed the play. The existing seeded per-play ability roll is kept; there are no pre-snap zone chips (earned zones are deferred, §9).
  - **On Fire meter (§8.6.2):** 3 small pips toward QB On Fire, with a "1 MORE" chip one completion away.
  - **Drive clock (F-1):** a drive-time chip on every drive, counting up on drives 1–3 and down in the two-minute drill.
  - **Audio:** a 3rd-down swell, a red-zone swell and a two-minute heartbeat, through the existing `crowd`/`sfx` APIs.
- **New `football2/overlay.ts`.**
  - **Run lane:** the RB path to the hole, lineman block arrows and the TE seal, in purple with an arrowhead, before the snap and through the mesh.
  - **Ball:** min 4 css px, a shadow ring and a 3-dot trail.
- **Branding.** The display label for `truck-stick` becomes "Bulldozer" (id unchanged; C13). New copy avoids "Hit Stick", "X-Factor", "Superstar" and "in the zone".
- **P-3.** `.fb2-playbook` gets `box-sizing: border-box` and `width: min(620px, calc(100vw - 24px - var(--sal) - var(--sar)))`. The dialog padding is reset, and grid cards get `min-width: 0`.
- **P-4, all copy.**
  - `Football2` tips, including the two-minute copy.
  - `play-feedback.ts` NFL lines.
  - `Arcade.tsx` kickoff run row: "Run: joystick, hold BURST · JUKE, SPIN or POWER at a tackler".
  - **`src/evolution/Training.tsx:132-147`** NFL tips. They are already stale ("Swipe up to spin. Double-tap to truck", "Tap as the needle crosses the center"). This is an unowned file, listed, and re-checked in nfl-4, nfl-7, nfl-9 and nfl-10.
  - `tip()` hints clear on every phase change and in `lineUpNext`.
  - Every string fits one line at C.
  - The NFL lines of shell's `arena-tips.ts` are reviewed in `nfl.md`.
- **Replay.** Snapshots at 30 Hz in `Football2`; `replay.ts` is untouched.

**Tests and measurements** (new `scripts/qa/nfl-presnap.mjs`)
- **Formation visible.** At A, B, C and E every offensive body and the line of scrimmage sit above the tray top − 6 px. At D, no body is inside the tray.
- **Tray size.** ≤ 150 px at A and ≤ 140 px at C and E (baseline ≈ 236).
- **Framing.**
  - The line of scrimmage sits at 45–58% of the height before the snap.
  - Near-line sprites are ≥ 28 css px at A (baseline 12–25).
  - Sky, stands and score bug take ≤ 15% of the height at A (baseline 27%).
- **Ball.** ≥ 4 css px in flight.
- **Dynamic zoom is not vacuous.**
  - With reduced motion off, zoom drops below 0.92 on a seeded deep ball.
  - With it on, zoom stays at 1.
- **Playbook.** Within [12, vw − 12] at A–E, with `scrollWidth === clientWidth`.
- **HUD overlaps.** The pairwise intersection area is 0 at A–E among the score bug, drive marks, pause button, readout, hint, lower-third, drive clock, On Fire pips and controls. Baseline: LAST PLAY overlaps the hint in landscape.
- **Text.** Every HUD text is ≥ 10 design px, including the drive clock, pips, lower-third and card labels.
- **One line.** Every hint is one line (≤ 30 px) at C and E.
- **`hud.test.ts`.** Priorities, the one-pop rule and clearing on phase change.
- **Ability roll.** The existing per-play roll fires on 45–55% of ≥ 2,000 eligible plays, and pops are ≤ 1 per play (baseline 0.7–2.4).
- **Profiler.** ≤ 2 commits per second during live play outside input events.
- **Regression.** `play-feedback.mjs` and `joystick.mjs` pass through the guard, and there are 0 page errors.

**Screenshots.** A–E: pass call, run call with the lane, 4th down, playbook open, collapsed tray, lower-third, On Fire pips and drive clock. Each sits beside the audit's `*-01`, `-02`, `-08` and `-12` shots.

**Protocol.** None. **Saves.** None.

**Cut line.** The crowd audio cues move to nfl-10's polish list.

**Dependencies:** shell (`--sat`); players (the camera notice, sent the day of commit point 1).

### nfl-4 (P0): pocket and passing controls (C-2, C-3, §6 gestures, G-6 incompletion bounce)

**Commit points:** (1) the engine pocket; (2) `gestures.ts` and its tests; (3) icons and the throw type; (4) QA.

**Engine (`engine.ts`, `types.ts`, `autopilot.ts`)**
- **Drop.** A scripted drop to `los − 6.5` over 0–0.75 s, with act `backpedal` while moving and `stance` once set (C9).
- **Pocket movement.**
  - With a `Pt` at t ≥ 0.45 s on a pass play, the QB moves at up to `lerp(3.6, 5.0, rt(AGI))` yd/s.
  - The movement feeds the `throwErrorRadius` movement term, and `sight()` is multiplied by `lerp(1, 0.8, movement)`.
  - With AI input the QB holds, plus a 0.8 yd step-up against a free edge rusher.
- **Tackle box.** `outsideBox(p)` is `|qb.x − p.bx| > 4.5` or the QB is past the line of scrimmage.
- **Scramble throws** are allowed until the line of scrimmage.
- **`throwAway(p)`.** Legal only outside the box. The ball lands 3 yd past the near sideline, never intercepted, with the text 'THROWN AWAY'. There is no grounding flag (§9).
- **`slide(p)`.** For a QB past the line: decelerate for 0.25 s, then a tackle with no fumble roll.
- **Sack.** QB act `down` and sacker act `tackle`, with no RNG draws. players render the fall (C9).

**UI**
- **New `football2/gestures.ts`.** Implements §6.
- **New `ReceiverIcons.tsx` and `pass-controls.css`.**
  - Positioned by refs from `renderer.screenOf`.
  - A 26–30 px disc in the route colour inside a 44×44 hit area.
  - **Label:** the jersey number, or the slot letter (X, Z, SL, TE, RB) when `num` is null. 26% of NFL cards have no number (audit-likeness L-5), and draft fill-ins have `num: null`.
  - **De-overlap:**
    - Discs are offset until every eligible receiver has an effective, unambiguous ≥ 44×44 hit area.
    - If that's impossible, the overlapping icons fan out on touch-down.
- **Throw type.**
  - A BULLET · AUTO · LOB chip near the QB, ≥ 44 px.
  - The second-finger toggle excludes the stick pointer (§6).
- **Pass layout preference** `fb2-pass-layout` (`'field'` default, or the old `'panel'`), with its pref test. It is shown in pause → Controls.
- **Context buttons** per the §6 map. THROW AWAY is shown only outside the box, not disabled.
- **Incompletion bounce.** A 0.6 s render-only tumble; under reduced motion the ball fades in place.
- **Copy.**
  - `play-feedback.ts` NFL lines: "Step up in the pocket, throw it away outside the tackle box, or RUN IT".
  - The `Arcade.tsx` pass row: "Pass: tap a receiver or drag back to aim · left stick moves the QB".
  - The Training throw tips.
  - `docs/NFL-DIRECT-CONTROL.md`.

**Tests and measurements**
- **`gameplay.test.ts`.**
  - Pocket displacement is 1.5–5 yd in 1 s with a `Pt`, and none beyond the drop with `null`.
  - `throwAway` inside the box returns false; outside it is never intercepted over 500 seeds.
  - A scramble throw is allowed before the line and refused after it.
  - A slide always ends as a tackle with no fumble (500 seeds).
  - A sack sets the acts.
  - The same inputs give an identical `PlayEnd`.
  - The C9 "engine never reads act" test.
- **`gestures.test.ts`.** Synthetic pointer sequences for:
  - tap vs drag at the thresholds
  - icon tap vs icon drag
  - the second finger with the stick held, which toggles
  - the stick pointer, which never toggles
  - a pre-snap field drag, which collapses the tray
- **Human proxy (`pocket: true`)** on Pro gold:
  - sack % ≥ 3 points lower than with `pocket: false` (baseline 12.3)
  - throwaways 1–4% of dropbacks
  - INT % up by no more than 0.3 points
- **New `scripts/qa/nfl-passing.mjs`** (A, C, D, E):
  - Icons sit within 12 px of the receivers' heads.
  - The effective hit area is ≥ 44×44 for every eligible receiver in the tightest current alignment (the slot and TE stack). It is re-run on Trips in nfl-5.
  - The fallback label shows when `num` is null.
  - pointerdown-to-throw ≤ 16 ms.
  - **20 of 20** CDP second-finger toggles succeed with the stick held.
  - THROW AWAY shows only outside the box.
  - At D, no control covers the RB or slot.
  - ≤ 3 context buttons.
  - Text ≥ 10 px, including the icon numbers.
- **Determinism.** The incompletion bounce is render-only: seeded results are identical with it on and off, in the style of `juice.test.ts`.

**Screenshots.** A, C, D and E: dropback with icons, the fallback label, the QB moving, a throwaway, a scramble throw, a slide, the sack fall and an incompletion bounce.

**Protocol.** Needed. **Saves.** Pref `fb2-pass-layout` (tested).

**Cut line.** The `'panel'` layout toggle in Controls moves to nfl-9.

**Dependencies:** nba (`play-feedback.ts` NFL strings only); players (the C9 acts).

### nfl-5 (P0/P1): the AI's football brain: defensive calls, AI QB reads, play calling and difficulty (D-1, D-3, P-2 suggestions, audibles, defensive On Fire)

This task comes before passing calibration, so that nfl-6 calibrates against the real coverage mix, and ahead of the offensive playbook additions, so that the defensive half can't be cut.

**Commit points:** (1) the difficulty helper; (2) `calls.ts` and the engine alignment; (3) AI reads and windup; (4) AI play calling; (5) suggestions and the audible; (6) formations (cut line); (7) fast CAL and QA.

**Changes**
- **`difficulty.ts`.** `rivalOffenseFaces(online, level?)` (C5). Arcade's NFL `aiPlay(rival = true)` uses it.
- **New `football2/calls.ts`: the D-1 call table.** Data per call: the shell (0, 1 or 2 high), each defender's job (a man rule, a zone landmark relative to the line and hash, rush or spy) and 3–6 rushers.
  - **Calls:** Cover 0, Cover 1, Cover 1 Robber, Cover 2, Tampa 2, Cover 3, Cover 4, Fire Zone, Sim Pressure, Goal Line, Prevent.
  - `lineUp` reads the call.
  - **Protection:** the RB on a `check` route and the TE stay in to pick up a free blitzer.
  - **Calling:**
    - Rookie: random among 4 basic calls.
    - Pro: situational.
    - Legend: situational, plus formation counters and disguise.
  - **Shell and rotation:** the shell shows before the snap and rotates after it on 25–35% of Legend snaps, 10–15% of Pro and 0% of Rookie.
  - **FREE RUSHER** (an SVG flame, our own term). It is computed from the protection plan at alignment, so it shows only for a truly unblocked rusher, and disguise hides it more often on Legend.
- **Defensive On Fire (§8.6.1).**
  - Lights after 2 straight sacks or a takeaway: rushers' `winAt` −0.3 s and speed +3%.
  - Goes out on a 10+ yd first down allowed.
  - Applies to the AI defense in every mode, and to yours in solo from nfl-8. A flame chip shows through the HUD manager.
- **AI QB reads (`autopilot.ts`).**
  - `READS: Record<Concept, Slot[]>`, as in revision 1.
  - Read timing is **relative to the set** (the drop ends at 0.75 s): the first read at set + 0.15–0.45 s by AWR, and each next read `lerp(0.55, 0.32, rt(AWR))` later.
  - **Release windup** of 0.35–0.45 s after the decision (research §8.10.3), so time to throw lands at 2.4–3.0 s even when the first read is open.
  - Read caps: Rookie 1–2, Pro 2–3, Legend by AWR (1 below 60 … 4 at 90+).
  - Rookie locks onto a covered man 25% of the time.
  - The RB checkdown comes after the reads, and he throws it away when hurried with nothing open.
  - AI scramble: when pressure > 0.7, nobody is open and there is a 5+ yd lane.
- **AI play calling.**
  - `situation(g)` gives pass share by down (47 / 59 / 74 / 62%).
  - The 4th-down chart: go for it on 4th and ≤ 2 past your own 40, or 4th and 1 past your own 30; kick in range; otherwise punt.
- **User suggestions (P-2).**
  - `choices(g)` deals 3 cards from the same `situation(g)` table: 3rd and short, 3rd and long, red zone, two-minute, 1st and 10.
  - **Coach Pick:** one card gets a badge and a one-line reason drawn from the shown shell ("Two deep: the seam is open").
  - Every card carries a "beats Cover 3 / man / blitz" note.
- **Audible (P-2 evidence "no audibles").** After a play is picked and before the snap, the collapsed tray reads CHANGE PLAY. Re-opening it lets you switch; the defense keeps its call and re-aligns to the new formation.
- **Formations (cut line 1).**
  - Gun Trips and Singleback (TE inline) as `lineUp` variants, with Legend rotating against Trips.
  - Playbook dialog formation tabs.
  - `nfl-passing.mjs` re-checks the icon hit areas on Trips at C and E.

**Tests and measurements**
- **Call mix** (1,000 Pro snaps):
  - ≥ 6 distinct calls
  - 3rd and 7+: ≥ 30% two-high or blitz
  - red zone: ≥ 30% man, Cover 0/1 or Goal Line
- **Beaters.** Every call has a concept that completes ≥ 10 points above its average against it, and every concept has a call that holds it ≥ 10 points below.
- **Blitz risk and reward.** Sack rate ≥ 1.5× base; allowed 20+ yd plays ≥ 1.3× base.
- **FREE RUSHER is honest.**
  - When shown, the rusher really is unblocked ≥ 90% of the time.
  - It shows on 40–60% of unblocked blitzes on Pro and 20–35% on Legend.
- **Coach Pick is useful.** Each of the 3 dealt cards is replayed counterfactually from the same seed against the actual call. Success means a gain of ≥ 40% of the distance on 1st down, ≥ 60% on 2nd, and 100% on 3rd and 4th. The picked card's success rate and yards are ≥ the mean of the other two on **≥ 60%** of snaps.
- **AI pass share by down** (research §1.5): 1st 41–53%, 2nd 53–65%, 3rd 68–80%, 4th 56–68%.
- **AI behaviour.** It goes for it on 4th down 1.0–2.0 times per 11-drive game; time to throw is 2.4–3.0 s; scrambles are 3–7%.
- **Unit tests.** The defensive On Fire state machine, and the difficulty helper (online symmetric; offline table; `sport-branches.test.ts` green).
- **Fast-CAL guard bands** (nothing collapsed before nfl-6): completion 55–75%, INT ≤ 4%, YPC 3–6.
- **UI** (A–E):
  - the tray with Coach Pick, the notes and CHANGE PLAY
  - the FREE RUSHER flame and the shell icon
  - controls ≥ 44 px, text ≥ 10 px, no overlaps

**Screenshots.** A, C, D and E: the Coach Pick card, FREE RUSHER, the shell icon before and after a Legend rotation, CHANGE PLAY, and Trips if built.

**Protocol.** Needed. **Saves.** None; the playbook is not saved.

**Cut line, in order:**
1. formations → §9 with a reason
2. Cover 1 Robber and Tampa 2 → §9
3. the audible → nfl-10's polish list

The call table core, AI reads, play calling and the difficulty helper are never cut.

**Dependencies:** nba (the C5 helper in `difficulty.ts`).

### nfl-6 (P0): passing realism (completion and INT by depth, sacks, deep balls, targets, top tier, rating spread, catch types)

**Commit points:** (1) the INT facing rule and shape; (2) deep balls, YAC and targets; (3) sacks and scrambles; (4) catch types and spreads; (5) the promo tier; (6) the play log (cut line).

**Changes (`engine.ts`, `autopilot.ts`)**
- **Facing rule.** `facingBall(d, at)`: an interception needs the ball within 75° of his heading and `t ≥ breakAt`; otherwise it is a deflection. It applies in `playPassingLane` and `arrive()`.
- **INT shape.**
  - The lane pick is capped at 0.35.
  - Contested `pi` is scaled by air yards: × 0.3 / 0.6 / 1.0 / 1.4.
  - Ballhawk becomes +0.05, additive.
  - Under pressure, interceptable throws rise to about 5.5% (§8.1C).
- **Deep balls (G-2).**
  - Deep defenders in every `calls.ts` shell keep ≥ 1.5 yd over the deepest receiver in their area until the throw.
  - On flights ≥ 1.3 s, `breakAt` comes 0.06 s sooner.
  - A trailing defender within reach of a high ball cuts the catch chance by 0.08–0.15.
- **YAC.** Pursuers turning after a catch pay a reaction lag of `lerp(0.35, 0.15, PRC)`.
- **Targets (G-3).** Route and read fixes so that WR2 and the TE draw real targets.
- **Top tier (G-4).**
  - `routeWinChance` is clamped to [0.15, 0.85].
  - Coverage lag gets a floor.
  - The lane-play chance including `defIQ` is capped at 0.55.
  - These are checked on the `promo` fixture (100–110 attributes) as well as `elite`.
- **Sacks and scrambles (C-2 reconciled).**
  - The audit's arc is adopted: the pressure ring at 2.6–3.4 s with **average pressure 2.9 ± 0.3 s**, and **median time to sack 3.8–4.5 s**. Revision 1's 3.2–3.8 s is withdrawn.
  - Tune `WIN_AT`, `POCKET` and free-rusher pursuit.
  - Sack yardage −6.5 ± 1.5; scramble gains 7.5 ± 2.
- **Automatic catch type by trait (§8.3.1).** Chosen at the catch from the receiver's ratings:
  - **Possession** (CTH highest): drop chance × 0.7, YAC × 0.85.
  - **YAC** (SPD/AGI highest): turns upfield 0.1 s sooner.
  - **Contested** (CIT/SPC highest, defender within 1.5 yd): high-point, +0.06 contested chance.
  - It is emitted as a `catch:poss|yac|high` event for players' clip choice.
- **Rating spread (§8.1D, §1.9).** QB accuracy, pressure and pocket-sense terms are tuned so the clamps below hold. Receiver CTH/CIT and YAC terms produce the catch-rate spread.
- **Pass plays (cut line 1, P-2):** PA Post (`p.pa`: linebackers and safeties read run keys for `lerp(0.6, 0.35, PRC)` s) and RB Screen (the OL releases at 1.0 s).
- **Play log (cut line 2, research §8.13.3).**
  - New `football2/playlog.ts` folds your real plays into the same accumulator `sim-kit` uses: completion and INT by depth, sacks, the run histogram and the 3rd-down curve.
  - The rolling last 500 plays are stored locally in `perfect-season:fb2-playlog` and shown in pause → Controls → "My play stats".
  - Unlike research's dev-only idea, it ships, because the owner plays the installed production build. It stays local only, never in cloud saves, with a pref test.
- **Harness.** `tune.test.ts` and `human.test.ts` move onto `sim-kit`, keeping their env flags.

**Tests and measurements**
- **Facing rule.** Always on: no interception by a defender turned more than 75° from the ball, over 2,000 seeded passes.
- **CAL, AI Pro gold v gold, against the nfl-5 call mix:**
  - completion 62–67%
  - by depth: behind the line 74–84%, 0–9 yd 67–77%, 10–19 yd 49–61%, 20+ yd 30–42%
  - INT 1.8–2.6%, rising with depth
  - sacks 5.5–8.5%, at −6.5 ± 1.5 yd
  - time to throw 2.4–3.0 s; median time to sack 3.8–4.5 s; average pressure 2.9 ± 0.3 s
  - YAC 4.2–5.8; Y/A 6.3–8.0
  - 20+ yd gains on 7–11% of attempts
  - scrambles 3–7%, at 7.5 ± 2 yd
- **Human proxy, Pro gold, pocket on:**
  - completion 58–67%
  - deep completion 33–45% (baseline 57–62)
  - 20+ yd gains 7–11% (baseline 19)
  - sacks 6–9.5% on Pro and ≤ 12% on Legend (baseline 12.3 / 26.6)
- **Pressure.** Completion under pressure ≥ 0.5 is ≥ 15 points below throws under ≤ 0.2 pressure (NFL: 49 vs 72).
- **Targets.** X, Z and SL 12–30% each, TE 12–25%, RB ≤ 22%. A WR 95 at Z instead of a 70 gives Z ≥ 1.25× the catches and yards.
- **QB clamps** (one QB card swapped on otherwise identical teams):
  - 99 QB: completion ≤ 74%, INT ≥ 0.8%, sacks ≥ 3%
  - 60 QB: completion ≥ 54%, INT ≤ 4.5%, sacks ≤ 12%
  - 92 vs 75: +4 to +9 points of completion, with lower INT and sack rates
- **Receiver spread.** Catch rate 57–77% from CTH 60 to 95, and YAC per catch 3.0–6.7 across the 10th–90th percentile receivers.
- **Top tier.**
  - Elite v elite and **promo v promo** on Legend score within **25%** of gold v gold in points per drive, with INT ≤ 3.5%, completion 55–72% and turnovers on ≤ 15% of drives.
  - Baseline elite: 1.22 vs 2.96 points per drive, 6.9% INT, 31% turnover drives.
- **Catch types.** Each type occurs on ≥ 10% of catches in the gold fixture. The possession-type drop rate is below the YAC type's.
- **Rigour.** Every band comes from ≥ 400 events and is reported with its 95% interval.
- **Regression.** `ratings-matter.test.ts`, `gameplay.test.ts` and `juice.test.ts` stay green.

**Screenshots.** A: a deep shot against Cover 3, a facing INT next to a trailing swat, a contested high-point, and "My play stats" if built.

**Protocol.** Needed. **Saves.** `fb2-playlog` (local only, tested) if built.

**Cut line, in order:**
1. the play log → nfl-10's polish list
2. the PA Post and RB Screen plays → §9

**Dependencies:** nfl-5 (the call table); packs (re-rated fixtures, C13).

### nfl-7 (P0): run game, ball-carrier moves and tackling (G-1, G-5, C-4; auto stiff-arm and hurdle; hold-to-truck; `PlayEnd.by`)

**Commit points:** (1) run designs; (2) contact and `PlayEnd.by`; (3) moves and the control map; (4) stamina and the automatic moves; (5) controls QA; (6) the first full CAL.

**Changes (`engine.ts`, `types.ts`, `drive.ts`, `autopilot.ts`, `Football2.tsx`, the HUD)**
- **Run identities.**
  - **Inside:** a double team at the point of attack, climbing to the MLB at 0.6–0.9 s.
  - **Power:** the backside guard pulls (new Job `'pull'`).
  - **Outside:** a stretch, with a backside cutback when the backside DE crashes.
  - Lanes are picked by BCV.
- **Second-level variance.**
  - LB overrun or misfit on 10–20% of runs, by PRC.
  - Safety angle error scaled by (1 − PUR).
  - The pursuit closing burst drops to +2–5%.
- **Contact (G-5).**
  - `p.contact = { since, tacklers, drive }`: the carrier drives forward for 0.3–0.6 s.
  - Each extra defender within 1.2 yd joins and shortens the contact by 0.15 s.
  - The play ends with 'TACKLED BY <tag>' or '<tag> & <tag>'.
  - **`PlayEnd.by?: string[]`** holds the tackler and assist ids, the interceptor or the sacker. It is transient, with no RNG; the box score (nfl-9) and the D-2 recap (nfl-8) use it.
- **Moves (C-4) per the §6 control map.**
  - **JUKE direction:** the stick's field-x when |x| > 0.3, or a swipe on the button; otherwise "away from the man".
  - **The contextual slot:**
    - SPIN
    - SLIDE for a QB past the line
    - DIVE within 3 yd of the line to gain or the goal line: +1.0–1.5 yd, fumble × 0.3; a reach at the goal line is +0.3 yd but fumble × 1.5 if hit
  - **POWER:** a tap is today's power. A hold of 0.4–0.6 s charges a truck at speed × 0.85, tackleable from behind; releasing near full adds +0.1 truck edge.
  - **Cover ball:** the right thumb held on the field ≥ 0.3 s gives fumble × 0.3, speed × 0.9 and no moves.
  - **BURST** stays a hold modifier (the documented exception).
- **Stamina across a drive.** `Game.fatigue[rbId]` carries `min(1, fatigue + 0.35)` into the next play and resets at the end of the drive. The RB chip shows it before the snap.
- **Automatic stiff arm and hurdle.** With no move pressed, these fire by STR/SFA and SPD/AGI against a low diving tackler. They are seeded at 0.25× a manual move's edge and never guaranteed.
- **New `football2/feel.ts` `impact(kind, a, b)`.** The single call site for hit-stop and shake (C10).
- **Run plays (cut line, P-2):** HB Draw (the QB drops 1.2 s, then hands off), QB Sneak, Toss and Counter.
- **Copy.** Training run tips, the Arcade run row, `play-feedback.ts`, and `docs/NFL-RUSHING.md`.

**Tests and measurements**
- **`rushing.test.ts`.**
  - A juke with dir −1 moves Δx < −1 yd in 0.4 s.
  - A dive gains ≥ 0.8 yd.
  - Cover ball keeps fumbles ≤ 0.4× normal over 5,000 seeded hits.
  - Yards after first contact ≥ 1.0 for a power back and ≤ 0.5 for a scat back.
  - A gang tackle resolves within 0.35 s.
  - Fatigue carries across plays.
  - 99+ backs stay finite.
  - `PlayEnd.by` names the right ids.
- **CAL, AI Pro gold v gold, designed runs:**

  | Measure | Target | Baseline |
  |---|---|---|
  | ≤ 0 yd | 15–21% | 10% |
  | 1–3 yd | 32–40% | |
  | 4–6 yd | 20–27% | |
  | 7–9 yd | 8–13% | |
  | 10+ yd | 9–13% | 1% |
  | 20+ yd | 1.5–3% | 0.3% |
  | 40+ yd | 0.2–0.8% | |
  | Median | 2–4 | |
  | Mean | 4.0–4.7 | 3.76 |
  | P90 | 8–11 | |
  | P99 | ≥ 18 | 9.7 |

- **RB spread (§1.9).** From 10th- to 90th-percentile backs on the gold fixture: YPC 3.75–5.2, stuffed 22.4% → 13.5%, 10+ runs 8% → 13.8%.
- **Matchups.**
  - Elite defense v gold RB: 3.3–3.9 YPC, 21–29% stuffed.
  - Elite RB v gold defense: 5.0–6.0 YPC, 13–18% of runs gaining 10+.
- **Run types.**
  - Inside has the lowest stuff % and P90.
  - Outside has the highest 10+ rate and stuff %.
  - Power converts ≥ 65% on 3rd and 4th and 1.
- **Other bands.**
  - Missed tackles 12–20% of attempts.
  - Fumbles lost 0.5–0.9% of carries.
  - Human proxy with the 0.35 s stick: 3.8–4.8 YPC.
  - SPD 95 v 70: 10+ rate ≥ 1.5× and 20+ rate ≥ 2×.
- **Automatic moves.** Fire on 3–8% of contacts for STR or SPD 90+ backs, and ≤ 1% for ≤ 70.
- **Truck charge.** Takes 0.4–0.6 s.
- **Controls QA** (`scripts/qa/nfl-controls.mjs`; A–E and landscape):
  - ≤ 3 context buttons per state, plus the documented BURST exception
  - each ≥ 44 px and ≥ 8 px apart, with no overlaps
  - cover ball works with the stick held (two CDP touches)
  - text ≥ 10 px
  - `rushing.mjs` passes through the guard
- **First full CAL.** Every band from nfl-5, nfl-6 and nfl-7 in one run; any band that moved is fixed or recorded.

**Screenshots.** A, C and D: Power with the pulling guard, a gang tackle, the truck charge, a dive, the slide slot, and the stamina chip.

**Protocol.** Needed. **Saves.** None.

**Cut line.** The four run plays → §9. The juke-swipe on the button → §9; the stick direction stays.

**Dependencies:** players (the clips for juke → `cut` and stiff arm → `stiff_arm`; `impactOf` at merge).

### nfl-8 (P0 by OD-2/OD-3): solo defense, Auto-defend, per-drive SIM, the D-2 recap, takeaways and a 4–6 minute game

**Commit points:** (1) the engine user-defender, Big Hit and the determinism guard (pure and unit-tested; this is the critic's 9a); (2) the alternate flow and the defensive UI; (3) key snaps, Auto-defend, SIM and the recap; (4) takeaways and field position; (5) session-length tuning and QA.

**Changes**
- **Engine.**
  - `Play.user?: { id; input: Pt; tackleAt?: number; swatAt?: number }`. Times are in engine seconds, applied at the next fixed step.
  - TACKLE dives in range (2.6 yd).
  - **Big Hit:** the window is `lerp(90, 160)` ms by HIT and TAK. A hit inside it has a 6–8% fumble chance (+2% for Enforcer); early or late is a wrap tackle with a broken-tackle chance.
  - SWAT and PICK use the nfl-6 facing rule.
  - Everything is inert without `p.user`.
- **Flow (contract and Arcade NFL hunk).**
  - `Football2` gets `solo?: { rivalOffense; ourDefense; skill; defIQ }` and `onRival(p)`.
  - When `!online`, Arcade's shown and final rival progress come from `onRival`; online is unchanged.
  - Order: your drive k, then the AI's drive k, through regulation, then OT (your OT drive, theirs, then the two-point rounds).
  - **One renderer, kits swapped.**
- **New `DefenseDrive.tsx` and `defense.css`.**
  - The 3 suggested calls (nfl-5 table at your level) plus ALL CALLS.
  - Tap a defender to control him; the default is the deepest safety or the MLB, by call.
  - Your defender gets a ring and a name chip.
  - Context buttons per §6.
- **Key snaps (§5).**
  - Interactive key snaps; the rest auto-play at 3× with SKIP.
  - Pref `fb2-defense-snaps` (`'key'` default, or `'all'` "Longer games").
- **Auto-defend (C6).**
  - Plays every AI snap at 3×.
  - A toggle on the defensive call screen and in pause → Controls, backed by the shared `perfect-season:auto-defend` through new `src/game/match-prefs.ts`.
- **SIM DRIVE.**
  - Sims the rest of one AI drive instantly from its seed.
  - Allowed in manual-only modes; the match stays `'played'` (§5).
- **D-2 recap** (≤ 20 s, skippable), after a SIM DRIVE:
  - a drive chart (start, each play's gain, the end)
  - 2–3 key plays re-simulated from the seed and replayed through the renderer
  - your defenders' names on tackles, sacks and INTs (from `PlayEnd.by`)
- **Takeaways and field position (§8.1B, §1.6).**
  - After your INT or forced fumble, your next drive starts at the takeaway spot plus a seeded return (engine RNG, solo only), clamped between your own 20 and their 20. A 1.2 s render return plays, or a cut under reduced motion.
  - The AI's next drive starts at your punt landing spot or your turnover-on-downs spot (punt distance refined in nfl-9).
  - This is `nextStart(prevEnd)` in a pure module.
- **Defensive On Fire** applies to your defense (from nfl-5).
- **Online rival ticker (cut line 1).** A lower-third "RIVAL · DRIVE 2 · TOUCHDOWN" as each rival end arrives online. The rival's drives can't be replayed: only their ends cross the wire.
- **Defend drill (cut line 2).** `practice.drill = 'defend'`: one AI drive from a set spot with the defensive UI, offered to ut as a defensive Moment.

**Tests and measurements**
- **Engine.**
  - The controlled defender follows input.
  - TACKLE works only in range.
  - The facing rule applies to SWAT and PICK.
  - The Big Hit window matches its formula, and a perfectly timed in-range Big Hit lands ≥ 80%.
- **Determinism guard.** These hashes are identical before and after the task, proving online play is untouched:
  - 200 seeded AI plays without `p.user`
  - `aiDrivesOf`
  - `simMatch` (with OT)
  - takeover outputs
- **Proxy defender bot** (0.35 s reaction, average timing), Pro gold: the AI's points per drive against a played defense are within ±25% of SIM DRIVE over 300 drives.
- **Takeaways.** The next drive after your INT or fumble is worth **+1.5 to +2.5 expected points** over a kickoff start (`sim-kit`, ≥ 400 takeaways).
- **Session length (OD-3).** Wall-clock model over ≥ 20 games each at Rookie, Pro and Legend: 2.5 s play pick, 0.35 s stick, key-snap defense, replays on, OT included.
  - **median 4–6 min, P90 ≤ 6.5 min**
  - defensive drive median 35–40 s; offensive median ≤ 45 s
  - **3 browser autoplay games** at 1× with real timers match the model within ±10%
  - The §5 fallbacks are applied in order if needed, and recorded.
- **Speed.** SIM resolves in ≤ 50 ms. Auto-defend plays at ≥ 3× and stays watchable (frames are drawn every tick). The recap is ≤ 20 s and skippable.
- **Settlement.** With a defensive SIM the result stays `how: 'played'`. ut's existing Cup settlement test (whole-match sim rejected) still passes in our worktree.
- **New `scripts/qa/nfl-defense.mjs`** (A–E and reduced motion):
  - A solo draft fixture alternates through a full match: call pick, SWITCH, TACKLE, Big Hit, SWAT, SKIP, SIM DRIVE with its recap, Auto-defend.
  - Online on the local relay: still parallel with no defense UI.
  - ≤ 3 context buttons, controls ≥ 44 px, text ≥ 10 px, no overlaps.
  - The reduced-motion Big Hit ring still fills and shows its window, without a pulse.
- **Preferences.** Tests for `fb2-defense-snaps` and `auto-defend`.
- **Heap.** ≤ 45 MB in a solo game with defense (baseline 35.6 MB offense only).
- **Profiler.** ≤ 2 commits per second during live defensive play outside input.

**Screenshots.** A, C and D: the defensive call screen, your defender with the Big Hit ring, a swat, an auto snap at 3×, SIM DRIVE and the recap, a takeaway return, and the Auto-defend toggle.

**Protocol.** None (solo-only; the guard proves it). **Saves.** Prefs `fb2-defense-snaps` and `auto-defend` (tested).

**Cut line, in order:**
1. the online rival ticker → nfl-10's polish list
2. the defend drill → §9 as an offer to ut
3. the "Longer games" `'all'` option → §9

The engine defender, the alternate flow, key snaps, Auto-defend, SIM DRIVE and the session-length target are never cut.

**Dependencies:**
- nba: the C6 shared pref
- ut: PreMatch shows the Auto-defend switch (C6) and solo flows pass no new props
- players: the existing `tackle` and `catch` acts

### nfl-9 (P0): special teams, conversions, the two-minute clock and the box score (C-5, D-4 conversions, F-1, F-2, V-2 fill-ins)

**Commit points:** (1) kicking and the kick-only harness; (2) punts; (3) conversions; (4) the two-minute clock; (5) the box score and contract A; (6) fill-ins (cut line); (7) QA.

**Changes**
- **Two-tap kicking (`drive.ts`, a rewritten `KickMeter`, needles driven by refs).**
  - **Tap 1, power.** A vertical needle; KPW sets the range. Full power reaches about `lerp(48, 63, rt(KPW, 60, 99))` yd, and Big Leg adds +3.
  - There is no hard range cut: beyond the range the make chance falls off over 5 yd. The red overkick zone above 0.92 costs accuracy.
  - **Tap 2, accuracy.** A sweep with period `lerp(0.85, 1.35, rt(KAC))` s, and a window of `lerp(0.10, 0.22, rt(KAC))` × a distance factor, with no shared floor.
  - **Wind:** seeded per drive, at most 2.5 yd of drift at 50 yd, shown as an arrow.
  - `kick(g, { power, aim })` decides the result. `kickNow`'s render-only ball path is drawn **to the result `kick()` decided**.
  - Blocks happen on 0.5–1.5% of kicks, by DL BSH.
  - The snap and hold are presented (snapper and holder; the kneel pose is requested from players, C9), and the FG defense rush is animated in render.
- **AI kicking.** `kickAI(g, skill)` samples errors. The AI's attempt choice puts 18–26% of its FGAs at 50+ (baseline 26–40%).
- **Punts.**
  - One power tap; 36–46 yd net by KPW and the tap, with the touchback rule.
  - **Parallel format** (online, sims): a punt that pins inside the 20 makes your next drive start 5–12 yd better, and a turnover on downs in your territory 3–8 yd worse.
  - **Alternate solo:** the real exchange through `nextStart` (nfl-8).
- **Conversions (D-4).**
  - After a TD: **KICK XP** (one short tap, 94–97% for an average kicker) or **GO FOR 2** (`tryFrom2`).
  - The codes are `TD`, `TD6` and `TD8`.
  - The AI goes for 2 by chart when it knows the score (solo alternate), and on 6–12% of TDs overall.
- **The two-minute drill (F-1).**
  - 2 timeouts.
  - HURRY: snap the same play without the tray, with the runoff halved.
  - SPIKE: an incompletion that takes 1 s.
  - The drive clock chip from nfl-3 counts down.
  - Kneel is rejected (§9).
- **Box score (F-2, contract C3).**
  - New `football2/boxscore.ts` folds each `Play` and `PlayEnd`, with `by`, into passing, rushing, receiving, defense and kicking lines.
  - `rating` 1.0–10.0 per line: passer rating for QBs; yards and TDs for skill players; tackles, sacks and INTs for defenders. The highest rating is the player of the game.
  - In solo alternate, your defenders' lines come from your defensive snaps.
  - `Progress.box` goes only on finished progress.
  - The final card is opaque: score, drive marks with OT, the top 3 lines per side, and the player-of-the-game card. The pre-snap play is not drawn once `g.over`.
- **ut hunks (C8).** In `match-debrief.ts`: the allowed codes and `n('TD', 'TD6', 'TD8')` (≤ 3 lines, if ut hasn't made them). The `ut/Match.tsx` points and labels maps.
- **Fill-ins (cut line, V-2).**
  - `football2/fillins.ts` `realDepth(pos, level, seed, slot, exclude)` picks real, seeded players from the draft data for the WR2, slot, DL, LB, CB, S and RB fill-ins, with no duplicate names.
  - It is **lazily imported by the draft path only**, so the UT match chunk never pulls in draft data.
  - OL and K keep "POS #" (§9).

**Tests and measurements**
- **Kick-only harness** (≥ 1,000 kicks per 5-yd bin, gold kickers):

  | Distance | Made |
  |---|---|
  | < 30 | 95–99% |
  | 30–39 | 90–96% |
  | 40–49 | 76–84% |
  | 50–59 | 65–76% |
  | 60+ | 30–50% |

  - An average kicker's perfect 50-yd attempt succeeds 85–90% of the time.
  - At 55 yd the window for a KAC 55 kicker differs from a KAC 95 kicker by ≥ 40% (today both are 132 ms).
  - The range rule: KPW 60 ≈ 48 yd and KPW 99 ≈ 63 yd (± 2).
- **Other kicking bands.**
  - XP 94–97% over ≥ 2,000 tries.
  - **Two-point tries 40–50% over ≥ 2,000 forced tries.**
  - The AI goes for 2 on 6–12% of TDs.
  - 50+ yd share of AI FGAs 18–26%.
  - Blocks 0.5–1.5%.
  - Punts 36–46 yd net.
- **Two-minute clock.** Unit tests for timeouts, spike and hurry-up.
- **`boxscore.test.ts`.**
  - Yards reconcile with the plays, by the stated rules for sacks and penalties.
  - Points equal the score.
  - The player of the game is deterministic.
  - `box` never appears in any `onProgress` payload.
- **`squad.test.ts`** (if fill-ins are built): real names, deterministic, no duplicates, finite ratings, and the module is reached only by dynamic import.
- **UI** (A–E): the kick meter (power, accuracy, wind), the conversion choice, the two-minute buttons and the box-score final at 320, with text ≥ 10 px, controls ≥ 44 px and no overlaps. The final is opaque: a pixel sample behind it shows no route lines.
- **Moments.** Every NFL Moment and Training drill (ut-owned) is still completable by the Pro autopilot. This is verified, not edited.

**Screenshots.** A, C and D: the two taps with wind, a block, the conversion choice, GO FOR 2, the two-minute buttons, the box-score final with the player of the game, and real fill-in names beside the audit's `390-01` ("WR 81").

**Protocol.** Needed (kicks, punts, conversions, codes, clock, and draft fill-ins).

**Saves.**
- Saved match records may contain the new codes; their readers are handled by C8.
- Old records hold only old codes.
- No key changes.

**Cut line, in order:**
1. fill-ins → §9
2. HURRY → §9

Kicking, conversions and the box score are never cut.

**Dependencies:**
- ut: the C3 consumer, `match-debrief`, the counters, `verdictOf`
- players: the holder pose
- lead: the bump

### nfl-10 (P0): game shape, the difficulty ladder and the team's final QA

This task tunes and measures only. No new features beyond cut-line items carried in from earlier tasks, and those only if the QA budget allows.

**Changes**
- **Game shape.** Tuning knobs only, to meet the bands below with the full CAL. It runs in the real 4-drive format with conversions and OT, and in an 11-drive §8.1A simulation.
- **Publish `DRIVE_ODDS`** (TD, FG, punt, turnover, downs and missed-FG shares from the calibrated sim) for ut's Club Season request (C12).
- **Difficulty ladder.** Re-run in the alternate solo format, after nfl-8, with the proxy defender. The parallel online format is re-run too.
- **Final checks.**
  - The Training tips and shell's `arena-tips.ts` NFL lines are reviewed against the final controls.
  - `nfl.md` is finished, with before/after for every §3 metric, "Owner device checks", "Merge steps for the lead" and "Left undone".
- **Team final QA.**
  - `bash O/heavy.sh npm run typecheck`
  - `bash O/heavy.sh npm test` (all three sports)
  - `bash O/heavy.sh npm run build`, once
  - Every QA script at A–E and under reduced motion: the legacy ones through the guard, the relay ones under the lock.
  - The full CAL.
  - A performance run like `nfl_perf.cjs` on port 5216.
  - The final before/after screenshot set.

**Tests and measurements**
- **Game shape, AI v AI, gold v gold, Pro** (≥ 400 drives per band, with intervals):

  | Measure | Target | Baseline |
  |---|---|---|
  | Points per drive | 1.9–2.4 | 3.75 |
  | TD, % of drives | 21–30 | 44 |
  | FG, % of drives | 13–20 | |
  | Turnovers, % of drives | 8–13 | |
  | DOWNS, % of drives | ≤ 9 | 12–55 |
  | Punts, % of drives | 18–35 | |
  | Red-zone TD / any score | 50–64% / 80–92% | |
  | 3rd down: 1 / 2–3 / 4–6 / 7–10 / 11+ | 60–76 / 45–61 / 37–51 / 25–39 / 9–22% | |
  | 3rd down overall | 35–44% | 49% |
  | Plays per drive | 5–7 | |

- **Ties.**
  - OT in **≤ 12%** of even games in the 4-drive format.
  - 0-0 finals **≤ 2%**.
  - 0 results decided by squad rating.
- **11-drive simulation (§8.1A).**
  - 21–25 points per team, P10 7–12, P90 32–40.
  - A 3-point margin in 10–17% of games and a 7-point margin in 6–12%.
  - OT in 4–8%.
- **Ladder, alternate solo with the proxy defender** (gold v gold, ≥ 300 games per level): Rookie ≥ 70% wins, Pro 45–55%, Legend 28–38%. AI sacks 4–9% at every level, and AI time to throw 2.3–3.0 s.
- **Top tier.** Promo v promo on Legend still within 25% of gold in points per drive, with INT ≤ 3.5%.
- **Session length re-check.** Solo median 4–6 min, P90 ≤ 6.5; the online race median ≤ 5 min; OT adds ≤ 90 s.
- **Bundle** (the one build):
  - entry chunk +0 KB gzip
  - Football2/arcade chunk ≤ +30 KB gzip over shell's baseline
  - draft data (`CELLS`) is absent from the UT match chunk, by the build manifest
- **Performance** at 393×852, 4× CPU, 15 s:
  - frames > 33 ms ≤ 5
  - long tasks ≤ 250 ms in total
  - heap ≤ 45 MB in a solo game with defense
  - players' stale-draw target for sprites ≥ 48 px (< 2%) is re-measured at integration, after their budget and our camera both merge (a merge step).
- **Whole suite.** Full `npm test`, typecheck and build pass, with 0 page errors in every script.

**Protocol.** Needed (calibration tuning). **Saves.** None.

**Cut line.** A band that can't be met is recorded with its closest value, interval and the §2 priority order. Polish items carried in (crowd audio cues, the audible, the play log, the rival ticker) are dropped before any QA step is.

**Dependencies:** lead (the bump and the merge steps).

---

## 9. Deferred and rejected (each is copied into `nfl.md` with its reason)

**Deferred:**
- **Precision Passing (§8.2.2) and the SNAG catch tap (§8.3.2).**
  - The audit's C-3 says the passing window already asks too much in 2–3 s; these add a third and fourth timed target to it.
  - They should be revisited after the owner's device check of the new icon and slingshot controls.
  - The Big Hit ring, the third timing skill, is built (nfl-8).
- **Earned zones (trigger and knockout state per ability), pre-snap zone chips, and trigger and knockout shown on the card face (§8.6.3).**
  - These change ability activation on every play, so they would need a full recalibration, and a card-face hand-off to players and packs.
  - Neither fits the 10 sessions after OD-2 and OD-3. The P0 noise fix (one pop per play) ships in nfl-3.
  - Hand-off note: when built, the trigger and knockout text belongs on the card face (players) and in the card detail (packs/ut).
- **Crowd pressure on solo road games (§8.6.5).**
  - Solo-only flair that needs a ut `crowd` prop hunk.
  - The rule for later is recorded: Arcade forces `'neutral'` online, with a test; reduced motion gets a static border, never a pulse or flash.
- **The one-button assist (§8.11).** It needs the final control set and owner feedback first. Rookie difficulty, the momentum carry and automatic catch types cover new players for now. It would be off online.
- **Hot routes (P-2).** Pre-snap receiver taps would need another gesture state in §6, and the audible covers the "change the call" need.
- **Adaptive counters (§8.8.2)** need per-game tendency state on top of a calibrated call table. **Hot/Cold (§8.6.4)** is flair only.
- **Throwing lanes and batted balls (§8.2.3).** Out of scope; they risk feel-bad incompletions.
- **A defensive camera rotated behind your defense.**
  - `pixel/persp.ts` (players) assumes the offense's view.
  - The defense uses the broadcast camera behind the AI's offense, which reads well in tests; the owner checks it on a device.
- **Floor yard-number LOD (V-1) and the per-frame `drawFloor` (§10).** Both are in players' `persp.ts` and are requested by C14. They move here only if players decline, with their reason.
- **Player looks, mocap clips and get-up rendering (V-2, A-1).** players own these; we supply the C9 acts.
- **The overall-99 cap (§8.12).** Card display, owned by packs and ut.
- **Real names for OL and K fill-ins.** The draft data has no OL or K, and loading the UT pool into draft games would add weight.
- **An intentional-grounding penalty.** The throwaway is refused inside the box, which is simpler on a phone.
- **Kickoff-return mini-plays, pick-sixes and safeties awarded to the opponent (G-6).** In the parallel online format, scoring for the other side needs new wire and score semantics, which is a lead decision. The incompletion bounce (nfl-4) and the takeaway return in solo (nfl-8) are built.
- **A 6-drive "Standard" length (F-1).** OD-3 fixes the game at 4–6 minutes, and §5 shows 4 drives each fits it.

**Cut-line items** that a task had to drop land here, each with the task that dropped it.

**Rejected:**
- **Kneel (P-2).** There is no situation where it helps.
  - In the parallel format your clock never affects the rival.
  - In the alternate solo format the AI's drive comes last, and OT has no clock.
- **OT for `App.tsx` `simH2H`.**
  - It doesn't use an arcade score at all: it decides the draft vote-to-sim by season rating (`App.tsx:631-632`), so no tie arises.
  - Turning it into an arcade sim is a format change for both NBA and NFL draft games, recorded as a proposal for the lead.
- **Splitting into about 17 sessions**, as the critique's splits would add up to.
  - The plan is capped at 10 tasks.
  - Instead, related work is regrouped:
    - pause, quit and OT together, as nba-7 does
    - the HUD manager with the tray
    - the AI brain before passing calibration
  - Every task has commit points and a cut line, P1 extras are deferred above, and nfl-10 is calibration and QA only.

## 10. Owner device checks (only a real iPhone can confirm)

- **Running.** The catch-and-run feel without touching the stick, and the HOLD TO RUN ghost.
- **The tray** on the owner's phone (393×852 with the Dynamic Island): formation visible, cards readable, SNAP reachable with one thumb, CHANGE PLAY.
- **Two-thumb passing.**
  - The stick moves the QB while the other thumb slingshots.
  - The second-finger bullet/lob tap with the stick held.
  - Receiver icons are tappable mid-route.
- **Run controls.** The contextual SLIDE/DIVE slot, the truck hold, cover ball, and whether BURST as a fourth control is comfortable.
- **Kicking.** The two taps, and whether the wind is readable.
- **Defense.** SWITCH, TACKLE/SWAT and the Big Hit timing; whether the broadcast camera reads well on defense; Auto-defend at 3×; SIM DRIVE and its recap.
- **Solo game length with defense,** timed on the phone across 3 Squad Battles games (target 4–6 min).
- **OT on two phones.** A tied online game into OT, and a forfeit with confirm.
- **Pause.** During a phone call or OS interruption (auto-pause), and resuming.
- **Frame pacing** on the phone (audit §10: profile on an A13-class iPhone if available), at the start of a play and in a gang tackle.
- **Haptics** on big hits and sacks.
- **My play stats** (if built) after a session, compared with the calibration bands.

## 11. Risks

- **Calibration interplay.** nfl-5, nfl-6 and nfl-7 move the same distributions.
  - Each task runs fast CAL with guard bands. The full CAL runs at the end of nfl-7 and in nfl-10.
  - The call table lands before passing calibration, and every play added in nfl-5–7 is calibrated in its own task.
- **Flaky bands.** FG make % by distance and two-point % from 300 games have standard errors of 5–10 points. They are measured only with the dedicated kick and two-point harnesses (≥ 1,000 kicks per bin; ≥ 2,000 tries). Every band reports its interval.
- **Calibration validity.**
  - packs-6 raises Hot Season, Legend, Spotlight and GOAT played attributes, and OD-5 re-rates cards.
  - Mitigation: pinned fixture ids and a ratings snapshot keep before and after comparable. The `promo` fixture covers 100–110 cards. The CAL re-runs on the merged pool at integration (merge step).
  - Any conflict between OD-5 and packs' rules is the lead's call.
- **Scoring looks lower in played games.**
  - At 2.1 points per drive, a 4-drive game averages about 8–10 points a side.
  - Research §8.1B suggested 3.1–3.5 for played arcade drives. The stream's 2.1 is followed for AI v AI and per-play realism, and the tension is flagged in `nfl.md`.
  - Conversions and OT keep ties settled on the field; §5 shows 4 drives keeps OT ≤ 12%.
- **Session length.**
  - The budget in §5 is a model until nfl-1 measures the offensive drive. If offense alone is above 50 s, the §5 fallbacks apply.
  - The last resort, `SOLO_DRIVES = 3`, raises ties to about 16%, which is recorded rather than hidden.
- **Online OT edge cases.** Covered by the two-client tests in nfl-2: takeover in OT, quit in OT, `GONE` in OT, and delayed messages. `done` stays monotonic.
- **Determinism.**
  - Timed inputs are applied at fixed steps.
  - The kick ball path follows `kick()`.
  - Engine logic never reads acts (test).
  - The hash guard covers AI plays, `aiDrivesOf`, `simMatch` and takeovers.
- **File collisions.**

  | File | Also edited by | Mitigation |
  |---|---|---|
  | `Arcade.tsx` | nba-7/9, shell-5 `withCurtain` | logic moved to pure football2 modules; hunks stay tiny |
  | `difficulty.ts` | nba | one helper (C5) |
  | `ut/Match.tsx` | ut-4/ut-5 | `simBoth` → `simMatch`, maps, `onQuit` (≤ 6 lines each) |
  | `App.tsx` | ut modal order, nba forfeit | forfeit hunk ≤ 6 lines |
  | `football2/render.ts` | players | calls only (`camera.ts`, `overlay.ts`) |
  | `juice.ts` | players' cap | approved (C10) |
  | `useInputInterrupt.ts` | nba auto-pause | not touched by us |
  | `styles.css` `.fb2` rules | nba scopes `.hg2:not(.fb2)` | the HUD is re-screenshotted after nba and shell merge (merge step) |

- **QA isolation.** Legacy scripts run only through `nfl-guard.cjs`, which adds route-abort, sets the port and makes reduced motion explicit. The relay runs serialize on the lock. A script the guard can't wrap waits for shell's merge.
- **Performance.**
  - One renderer with swapped kits.
  - Refs for all per-frame UI.
  - 30 Hz replay snapshots.
  - The camera's bigger near-line sprites depend on players' time-based sprite budget; the integration perf check is a merge step.
- **Bundle.**
  - `sim-kit`, `nfl_calibrate` and the fixtures are never imported by product code (test).
  - Fill-ins are lazily imported by the draft path only.
  - The chunk budgets are checked in the nfl-10 build.
- **iPhone layout.** Covered by the §6 control map, de-overlapped icons, the home-indicator clearance, viewport E, and landscape insets.
- **Branding.**
  - "Truck Stick" becomes "Bulldozer" in display text only (ids keep `truck-stick`, C13).
  - New copy avoids "Hit Stick", "X-Factor", "Superstar" and "in the zone".
  - "Big Hit", "Coach Pick" and "FREE RUSHER" are generic or our own.
- **Player of the game vs MOTM.** One source: our per-line `rating` (C3).
- **Moments and Training.** Kicking and calibration changes must leave every NFL Moment and Training drill completable. This is verified in nfl-9 and nfl-10.

## 12. Critique response map

Each point of the revision-1 critique, and where it is handled.

**Missing items**

| Critique point | Where it is handled |
|---|---|
| OD-3 total length; baseline offense time; solo format; `DRIVES` stays 4 | §5; nfl-1 baseline; nfl-8 tuning; nfl-10 re-check; C12 |
| OD-2 (a) Moments and Gauntlet | §5 recorded interpretation; `practice.drill 'defend'` offered (nfl-8 cut line) |
| OD-2 (b) one Auto-defend meaning and shared pref | C6; nfl-8 |
| OD-2 (c) per-drive SIM in manual-only modes vs Cup | §5; nfl-8 test |
| D-2 drive recap; online invisibility | nfl-8 recap; online rival ticker (cut line) |
| Takeaway start (+1.5–2.5 EP) | nfl-8 |
| F-1 drive clock | nfl-3 |
| F-1 timeouts and hurry-up | nfl-9 |
| Two-minute copy | nfl-3 P-4 |
| Kneel | rejected, §9 |
| P-4 copy outside Football2 (`Training.tsx`, `Arcade.tsx:390`, `arena-tips`) | nfl-3, nfl-2; re-checked in nfl-4, nfl-7, nfl-9, nfl-10 |
| Load (`loadAttrs` skip, PLAY-to-first-snap, `arenaReady`) | nfl-2; C11 |
| §8.3.1 automatic catch type; receiver spread | nfl-6 |
| §8.1D QB clamps | nfl-6 |
| RB spread | nfl-7 |
| §8.11 one-button assist | deferred, §9 |
| ≤ 3 context buttons; control map; cover-ball input; nfl-5 browser QA | §6; nfl-4; nfl-7 controls QA |
| §8.6.2 On Fire meter | nfl-3 |
| §8.6.3 zone on the card face | deferred, with a hand-off note, §9 |
| Kicking: KPW range, 60+ band, attempt mix, snap and hold | nfl-9 |
| Sack yards, scramble yards, sack timing | nfl-6 (reconciled to the audit's 3.8–4.5 s) |
| V-1 floor LOD and `drawFloor` | C14 request with tracked acknowledgement; §9 |
| Hand-offs: `impactOf`, juice cap, `preloadClips`, getup duplication | C9, C10 |
| Jersey-number fallback | nfl-4 |
| `league.ts` sim and box | C12 request; `DRIVE_ODDS` in nfl-10 |
| OT in every sim path | nfl-2 `simMatch` (`Arcade.sim`, takeovers, `simBoth`); `simH2H` rejected with reason, §9 |
| Auto-pause; online pause semantics; own takeover deadline | nfl-2 |
| Audibles | nfl-5 CHANGE PLAY |
| UT counters (TD6/TD8 count as TDs) | C8; nfl-9 |
| Text ≥ 10 px; 375×667 | §2 layout acceptance; viewport E |
| Pref tests | §2; nfl-1; each key's task |
| §8.13.3 telemetry roll-up | nfl-6 play log (cut line) |
| Owner device checks | §10 |

**Restructure**

| Critique point | Where it is handled |
|---|---|
| Contracts settled first | §4; nfl-1 commit point 1 |
| Split nfl-6 | AI brain → nfl-5; kicking and conversions → nfl-9; OT → nfl-2; game shape → nfl-10 |
| Split nfl-7 | pause, quit, forfeit → nfl-2; HUD manager, strip, audio → nfl-3; box score → nfl-9; fill-ins as nfl-9's cut line |
| Split nfl-9 | engine defender as nfl-8's first commit point; flow; pacing → nfl-2; crowd deferred; session length in nfl-8 |
| Split nfl-10 | features moved or deferred; nfl-10 is calibration and QA only |
| HUD and pause before icons and banners | nfl-2, nfl-3 before nfl-4 and nfl-9 |
| Call table before passing calibration | nfl-5 before nfl-6 |
| Defense before offensive depth | offensive plays are the first cut-line items in nfl-5–7; the call table is never cut; solo defense is never cut |
| Pre-hold vs pocket stick | nfl-1 rule; pocket-drift test |
| Second finger vs stick | §6; 20/20 CDP |
| Gesture arbitration | §6 spec; nfl-4 `gestures.ts`. Precision deferred, so no release ambiguity remains |
| Ladder after the format change | nfl-10 |
| CAL budget and fallback | §2 |
| `render.ts` and `Arcade.tsx` containment | §2: `camera.ts`, `overlay.ts`, `match-flow.ts`, `sim-match.ts` |
| Camera as its own step | nfl-3 commit point 1, with the players notice |
| Earned zones vs final CAL | deferred, so no zone chips show a coin flip |

**Risks:** each is answered in §11. Specifically:
- OT details: C2 and nfl-2
- ties: 0 by rating, 20-round cap
- saves and data meaning: C8, C12, `SOLO_DRIVES` never replaces `DRIVES`
- determinism: §2, C9, nfl-8 guard
- collisions: the §11 table
- QA isolation: §2
- performance: one renderer
- bundle: lazy fill-ins, import test
- layout: §6
- reduced motion: the §2 table
- branding: nfl-3
- calibration validity: pinned fixtures
- AI read timing: relative to the set, plus windup
- player of the game: C3
- flaky bands: dedicated harnesses

**Targets:** each appears as an acceptance criterion:
- solo length and OT: nfl-8, nfl-10
- OT ≤ 12%, 0-0 ≤ 2%, 10k ties: nfl-2, nfl-10
- load: nfl-2
- between plays 0.6–0.8 s: nfl-2
- bundle and heap: nfl-10, nfl-8
- 0 per-frame commits: §2, nfl-3, nfl-8
- icons and second finger: nfl-4
- run controls and auto-moves: nfl-7
- text ≥ 10 px: §2
- pass share by down: nfl-5
- QB, WR and RB spreads: nfl-6, nfl-7
- sacks, scrambles and timing: nfl-6
- kicking and two-point: nfl-9
- takeaway EP: nfl-8
- Coach Pick ≥ 60%: nfl-5
- FREE RUSHER honesty: nfl-5
- zone fire rate 45–55% on the existing roll: nfl-3
- Auto-defend, SIM and recap: nfl-8
- pause: nfl-2
- ladder in the alternate format: nfl-10
- top tier with promos: nfl-6, nfl-10
- CAL rigour: §2
- C-1 0.95×: nfl-1
- integration perf: nfl-10 plus merge step
- pref tests: §2
