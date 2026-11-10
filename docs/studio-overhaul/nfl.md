# Team nfl: studio overhaul record

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, cut from `claude/studio-overhaul` = main `acdf3e2`. Dev-server port **5216**. The build plan is [`nfl-plan.md`](nfl-plan.md); this file is the running record every task appends to: what changed and why, measurements, "Protocol bump needed", "Touched outside my lane", the cross-team contracts, merge steps, owner device checks and what was left undone.

`O` below means the shared overhaul scratch folder named in `BUILD-RULES.md`.

## Protocol bump needed

**Protocol bump needed: NFL draft 10→11, UT 11→12**, because:

| Task | Reason |
|---|---|
| nfl-1 | Input semantics after a carrier change: a stick the player has not touched since the catch, handoff or scramble now reaches the engine as `null` (the carrier keeps his momentum) instead of `{0,0}` (a hard brake); the engine's `null` carry for receivers and scrambling QBs keeps the heading for 0.35 s. Human-played drives come out differently, so an old and a new client must not share a queue. AI drives, sims and takeovers are unchanged (the autopilot never sends `null` to a carrier; the determinism test proves it). |

NBA and soccer are not changed by this team. The lead bumps each sport once at integration (`DRAFT_RULES` in `src/net/match.ts`, `UT_RULES` in `src/ut/Match.tsx`; we never edit either).

## Cross-team contracts

Settled here before any code, so the teams build against one shape. Where another plan already defines a contract we adopt it (contracts A and B from ut); where one cannot work we say why and propose the fix (C1). Each contract names its owner (who writes the code) and its consumers.

### C1. Forfeit: the `'FF'` drive-end marker

- **Owner:** nfl writes the NFL side (nfl-2); nba is asked to use the same marker; `App.tsx` and `ut/Match.tsx` hunks by whichever team lands first.
- **Why not `Progress.forfeit`:** `src/net/match.ts` `arcadeOf` (lines 543-552) keeps only `score` (0-999), `drive` (0-99), `done`, `ends` (at most 40 strings of at most 8 characters) and `plays`. A `Progress.forfeit` field is silently dropped on the wire, and accepting it would need a lead-owned `src/net` edit. A marker inside `ends` needs none.
- **Rule:**
  - A quitting side pads its `ends` with `'FF'` (worth 0 points) up to the number of units currently required, and at least one past what it has played, then sends `done: true`.
  - Any `'FF'` in a side's `ends` means that side forfeited. Its score is not used to decide the match.
- **Signatures:**
  - `Arcade` `onFinish(us, them, how, took, pens?, forfeit?: 'us' | 'them')` gains an optional 6th argument.
  - `App.tsx` `finish` and `ut/Match.tsx` `finish` map `forfeit` to `won` in at most 6 lines each.
  - `football2/match-flow.ts` `forfeitBy(ends: string[]): boolean`.
- **Proposal to nba:** use the same marker (sport-agnostic, fits the 8-character rule). The lead keeps one copy at the merge.

### C2. Overtime and the meaning of `done`

- **Owner:** nfl (`football2/match-flow.ts`, `football2/sim-match.ts`, Arcade's NFL branch, nfl-2). Consumers: nba (same shape), ut (`simBoth`).
- `done` is sent only when this side knows the result is final, so it stays monotonic (the same rule as nba-7).
- **NFL units:**
  - 4 regulation drives;
  - then 1 OT drive each from the opponent's 25 (4 downs, no clock, the normal end codes);
  - then sudden-death two-point rounds: `'P2'` is good (2 points), `'P0'` is no good;
  - the cap is **20 rounds** (at most 25 ends, inside the wire's 40). With a round-tie probability of 0.45² + 0.55² ≈ 0.505, 20 rounds leave about 1.2 × 10⁻⁶ unresolved. Only past the cap does the old `decide()` path run.
- **Exports of the pure `football2/match-flow.ts`:**
  - `required(us: string[], them: string[]): number` — units each side must play now;
  - `final(us: Progress, them: Progress): 'us' | 'them' | null`;
  - `forfeitBy(ends: string[]): boolean`;
  - `pointsOf(ends: string[]): number`;
  - `isTouchdown(end: string): boolean`;
  - `MAX_ROUNDS = 20`.
- **Arcade's NFL branch** uses these in place of `TOTAL` in `rivalLive` (slice and `done`), `finishedFrom`, `shown`, takeover and `taken`.
- **Waiting.** A side that has finished every unit currently required while the rival hasn't sees a wait line. `STALL_MS` and `GONE_MS` apply to each waiting phase, regulation or OT.
- **Takeovers** cover OT: the AI plays the rival's OT units with the seeds `seed + ':takeover:ot<n>'` as both sides' ends arrive. Both phones compute it from identical inputs.
- **To nba:** the same shape. We propose a sport-agnostic `flowFor` chosen with `pick` in Arcade; whichever team lands first writes the generic Arcade hunk, and the other plugs in its flow module.

### C3. Box score: ut contract A, adopted

- **Owner:** nfl fills it (nfl-9); ut reads it (ut-5).
- `Progress.box?: BoxLine[]`, a 2-line optional field in `src/game/progress.ts` (touched outside the lane, listed below when it lands).
- `BoxLine = { id: string; name: string; side: 'us' | 'them'; pos: string; stats: Record<string, number>; rating: number }`.
- NFL `stats` keys: `passYds passTd int rushYds rushTd rec recYds recTd tkl sacks defInt`, plus `fgm fga xpm xpa long`. ut reads them duck-typed.
- We fill `rating` (1.0-10.0) on every line. It is the **single source** for our player of the game and ut-5's MOTM ("highest rating, ties to the winning side"), so the two screens cannot disagree.
- `box` is attached only to the `Progress` objects passed to `onFinish`, never to `onProgress`, so it never reaches the wire (a test enforces it). Online, the rival's `box` is absent.

### C4. Solo quit: ut contract B, adopted

- **Owner:** nfl adds the Arcade props and menu (nfl-2); ut and App decide what quitting means.
- `Arcade` gets `onQuit?: (us: Progress, them: Progress) => void` and `quitText?: string`.
- ut maps Cup, Circuit, Club Season and UT Draft to the forfeit settlement, and Squad Battles and Events to leaving with no result, with `quitText` "Leave match? No result is recorded." `App.tsx` maps a draft game against the AI to a loss.
- Without `onQuit` the pause menu shows Resume only, as NBA does.

### C5. Difficulty: one helper in `difficulty.ts`

- **Owner:** nba names it; nfl fills the NFL branch (nfl-5).
- `rivalOffenseFaces(online: boolean, level?: BotLevel): number` — how well the user's team defends the AI's offense.
  - Online: `COMPETITIVE_DEFENSE`.
  - Offline: `pick({ nba: 0, nfl: NFL_USER_DEFENSE[level ?? 'pro'], soccer: 0 })` with `NFL_USER_DEFENSE = { rookie: 0.35, pro: 0, legend: 0 }`.
- `defenseDifficulty` keeps its meaning (the AI defense facing the human).

### C6. Auto-defend: one meaning, one preference

- **Owner:** nfl writes `src/game/match-prefs.ts` (nfl-8) unless nba lands it first; ut's PreMatch reads it.
- **Meaning:** Auto-defend plays the defensive snaps by themselves at ≥ 3× speed, still watchable. SIM is an instant result for one drive or possession.
- **Preference:** one shared key, `perfect-season:auto-defend` (boolean, default off), with `getAutoDefend(): boolean` and `setAutoDefend(on: boolean): void`. nba's prefs read and write through it.

### C7. Crowd flag: not added

Crowd pressure is deferred (see "Deferred and rejected"). If a later wave adds it, `Arcade` forces `'neutral'` whenever `online`, with a test, and never trusts the caller.

### C8. Drive-end codes and counting touchdowns

- **Owner:** nfl defines the codes (nfl-2, nfl-9); ut reads them.
- **Codes:** `TD` (7, extra point made), `TD6` (missed extra point or failed two-point try), `TD8` (good two-point try), `FF` (forfeit, 0), `P2` / `P0` (OT rounds). All fit the wire's 8-character rule.
- **Requests to ut:**
  - `ut/match-debrief.ts:52` counts `n('TD', 'TD6', 'TD8')`, and its allowed list gains every new code. We make this ≤ 3-line hunk ourselves in nfl-9 if ut hasn't.
  - ut-6's daily "Score 2 touchdowns" counter uses `isTouchdown(end)`.
  - ut-5's `verdictOf` honours a forfeit: a forfeit winner with fewer points shows WIN.
  - `ut/Match.tsx` points and labels maps gain the codes.

### C9. Acts for players: existing acts only

- **Owner:** nfl sets acts in the engine; players render them.
- The engine sets: `backpedal` while the QB drops; `down` on a sacked QB and `tackle` on the sacker; `catch` on the RB at the handoff mesh; catch-style events `catch:poss`, `catch:yac` and `catch:high` in `p.events`.
- **No new `getup` act.** players-8 renders get-ups from `down` plus elapsed time and sack falls from `p.end.kind === 'sack'`.
- **Requested from players:** a holder kneel pose for field goals; QB rollout and play-action fake clips (optional).
- A test proves engine logic never reads `act`: swapping every `act` value for a dummy leaves 500 seeded plays identical (nfl-4).

### C10. Juice and clips

- **Owner:** players (`juice.ts` cap, `impactOf`, `preloadClips`); nfl calls them.
- We approve players' `juice.ts` hit-stop cap hunk (about 8 lines).
- Every NFL hit-stop and shake goes through one local function, `football2/feel.ts` `impact(kind, a, b)` (nfl-7). At the merge the lead swaps its body for players' `impactOf` (a one-line merge step).
- `preloadClips('nfl')` is called on `Football2` mount, also a one-line merge step, since the function doesn't exist on our branch.

### C11. Shell

- All HUD offsets use `var(--sat/--sar/--sab/--sal)`; they are re-measured after shell's Fix A merges.
- After the first frame is drawn we dispatch `window.dispatchEvent(new Event('ps:arena-ready'))` — the same event shell's `arenaReady()` sends, so no import is needed (nfl-2).
- shell-5's `withCurtain` wraps our `Football2` return; our Arcade hunks avoid those lines.
- We review the NFL lines of shell's `arena-tips.ts` here after nfl-3 and again in nfl-10.

### C12. Club Season simulation (written request to ut)

- `ut/league.ts:421-431` scores AI games as 7/3/0 per `DRIVES` with a 43% touchdown rate per drive (real: about 23%), plus +3 for OT.
- Its box score (`league.ts:348-357`) assumes only 7s and 3s, so a played 6- or 8-point touchdown would save wrong player TD totals into `ut.league`.
- **Request:** for played games, take touchdowns from `ends` with `isTouchdown()`, or from `box`; for AI sims, use the `DRIVE_ODDS` table nfl-10 publishes from calibration.
- `DRIVES` stays 4 everywhere, because `league.ts:2` imports it.

### C13. packs (written request)

- The in-game display label for the `truck-stick` ability changes from "Truck Stick" (a reference game's mechanic name) to "Bulldozer". The id is unchanged.
- The UT card detail takes ability names from `ut/rate.ts` `abilityName()`, which falls back to the id, so packs or players should add the same label there.
- Re-rated cards (packs-6, OD-5) move calibration fixtures. We pin fixture card ids and a ratings snapshot in `nfl-calibration/fixtures.json` (nfl-1, done) and re-run calibration on the merged pool at integration.

### C14. players (written request and notice)

- **Camera notice.** The nfl-3 camera reframe changes on-screen sprite sizes. players-1's stale-draw targets were measured on the old camera; they get a notice here the day it lands.
- **V-1 requests:** the floor yard-number LOD and the per-frame JS `drawFloor` (audit §10). Both live in `pixel/persp.ts`, which players own, and are not in `players-plan.md`.
- **Acknowledgement:** tracked here. If players decline, both move to "Deferred" with their reason.

| Contract | Counterpart | Status |
|---|---|---|
| C1 forfeit marker | nba, ut, App | proposed |
| C2 OT and `done` | nba, ut | proposed |
| C3 `Progress.box` | ut (contract A) | adopted |
| C4 `onQuit` | ut (contract B), App | adopted |
| C5 `rivalOffenseFaces` | nba | adopted (nba's name) |
| C6 auto-defend pref | nba, ut | proposed |
| C8 end codes | ut | requested |
| C9 acts | players | requested |
| C10 `impactOf`, `preloadClips` | players | merge steps |
| C11 shell event and offsets | shell | adopted |
| C12 league sim | ut | requested |
| C13 Bulldozer label, fixtures | packs | requested |
| C14 camera notice, floor LOD | players | requested, awaiting answer |

## Merge steps for the lead

1. Swap the body of `football2/feel.ts` `impact()` for players' `impactOf` (C10; lands with nfl-7).
2. Add `preloadClips('nfl')` to the `Football2` mount effect (C10).
3. Re-screenshot the NFL HUD after nba's `.hg2:not(.fb2)` scoping and shell's `--sat` fix merge (`scripts/qa/nfl-*.mjs`, viewports A-E).
4. Re-run calibration on the merged card pool: `MODE=full FIXTURES=pool npx vite-node scripts/nfl_calibrate.ts` rebuilds the pinned fixture ids from the merged ratings (C13), next to the pinned snapshot.
5. Bump NFL draft 10→11 and UT 11→12 once (see "Protocol bump needed").
6. Re-measure players' stale-draw target for sprites ≥ 48 px after their sprite budget and our camera both merge (nfl-10).

## QA isolation and the local relay lock

- Browser QA for this team goes through `scripts/qa/nfl-lib.mjs` (new scripts) or `scripts/qa/nfl-guard.cjs` (legacy scripts): every request to a host other than localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com is aborted and reported, and a run that attempted one fails. URLs always carry `?ns=inspect&relay=ws://localhost:7777`. The dev server is on port 5216.
- **Relay lock: `/tmp/ps-qa-relay-7777.lock`.** The local relay binds the fixed port 7777, so every relay-using run, from any team, should hold this lock: `flock -w 1800 /tmp/ps-qa-relay-7777.lock env PS_QA_RELAY_LOCKED=1 node scripts/qa/<script>.mjs`. `nfl-lib.mjs` `relayGuard()` refuses to start a relay-using NFL script without the lock and checks that the port is free.

## Gestures, pointer ownership and the control map

Written here in nfl-1 and built as `football2/gestures.ts` (pure, unit-tested) in nfl-4.

**Pointer ownership.**
- A pointer that goes down on the stick, or in its zone (the bottom-left 45%), belongs to the stick until it lifts.
- Every other pointer belongs to the action surface; button pointers belong to their button.

**Tap or drag.** A tap moves < 10 design px and lasts < 250 ms; anything else is a drag. The slingshot starts at 10 px of travel.

**Receiver icon.** A pointer down on an icon and up as a tap throws to that receiver. If it moves ≥ 10 px it becomes a slingshot drag from there, and the icon tap is cancelled.

**Second-finger bullet/lob toggle.** During an active slingshot drag, a tap by another pointer toggles BULLET and LOB. That pointer must not be the stick's pointer and must not be on a button, so the left thumb holding the stick never counts as a "second finger".

**Before the snap.** A drag ≥ 10 px on the field above the tray collapses the tray. Taps on receivers do nothing before the snap (hot routes are deferred).

**The stick at a carrier change (nfl-1, built).** When the ball changes hands (a catch, a handoff, a scramble), a stick that is already held counts only when the change is a designed handoff, or when the stick has an upfield component of at least 0.3 of its length. Otherwise the new carrier runs on momentum (`null` to the engine) until a new stick touch or key press, or until the stick moves at least 0.25 from where it was at the change. A stick touched and then released still brakes (`{0,0}`). So a thumb drifting the QB back-left in the pocket never sends the receiver back-left after the catch.

**Cover ball.** The right thumb held still on the field for ≥ 0.3 s while running, not on a button. One thumb is on the stick, so a two-finger hold is impractical.

**Defense.** TACKLE is one button: a tap in range dives, and a tap inside the Big Hit window is a big hit. While the ball is in the air and your man can reach it, the same slot reads SWAT. SWITCH is separate.

**Control map, at most 3 context buttons per state:**

| State | Left thumb | Context buttons (right thumb) |
|---|---|---|
| Pass, in the pocket | the stick moves the QB | RUN IT · THROW AWAY (shown only outside the box) · BULLET/AUTO/LOB chip. The slingshot and receiver icons are the surface. |
| Ball carrier | the stick | JUKE · SPIN, or SLIDE for a QB past the line, or DIVE within 3 yd of the line to gain or the goal line · POWER (tap; hold to truck) |
| Defense | the stick moves your defender | TACKLE or SWAT · SWITCH |

**Documented exception: BURST.** BURST stays a hold modifier in the carrier state (CLAUDE.md: "a permanent stick and separate skill buttons"). It is not a context button. It is the one recorded exception, and the owner checks it on a device.

## The solo format and session length (OD-2, OD-3)

**The budget.** The binding target is a median of **4-6 min** per solo game, P90 ≤ 6.5 min, at 1× speed with replays on and defense played.

**Why 4 drives stay.** With conversions and about 2.1 points per drive, the chance of a tie after regulation is:

| Drives each | Tie after regulation | 0-0 finals |
|---|---|---|
| 4 | ≈ 11.5% | ≈ 1.8% |
| 3 | ≈ 16% | ≈ 4.7% |

Only 4 drives meet the targets of OT ≤ 12% and 0-0 ≤ 2%, so `DRIVES` stays 4 for online, solo and `league.ts`.

**The format.** Solo games alternate: your drive k, then the AI's drive k on defense.
- On the AI's drives you play **key snaps**: 3rd and 4th downs, every snap inside your own 20, and the AI's two-point tries.
- Every other AI snap plays itself at 3×, watchable, with your call made by the situational table at your level. SKIP jumps to the next key snap.
- `perfect-season:fb2-defense-snaps` = `'all'` is an opt-in "Longer games" mode that plays every snap.
- Auto-defend (C6) plays all AI snaps at 3×. SIM DRIVE sims one AI drive instantly and shows the recap.
- Online head to head stays the parallel offense race (OD-2).

**Time budget per drive** (nfl-8 tunes it with the `pacing.ts` wall-clock model; nfl-1 measured the offense, below):

| Drive | Make-up | Target |
|---|---|---|
| Offense | about 6 plays × (2.5 s pick + live play + whistle-to-tray), plus skippable replays on big plays | median ≤ 45 s |
| Defense | about 2.5 key snaps × (call + play + 0.7 s), plus about 3.5 auto snaps at 3×, plus 3 s of transitions | median 35-40 s |
| OT | — | adds ≤ 90 s |

**Fallbacks**, in order, if the median is above 6 min after tuning: (1) auto snaps at 4×; (2) replays only on TDs and turnovers; (3) 0.6 s whistle-to-tray; (4) last resort, a separate `SOLO_DRIVES = 3`, never a change to `DRIVES`, with the OT target relaxed and recorded. Online race: median ≤ 5 min.

**What "solo" covers.** Squad Battles, Cups, Club Season, Events, UT Draft games and draft games against the AI. Gauntlet (`engine/gauntlet.ts`) is a pure simulation with no Arcade, and NFL Moments are run, throw and kick drills with no AI drives; both are a deliberate reading of OD-2. ut is offered a defensive Moment through `practice.drill = 'defend'` (nfl-8 cut line).

**Per-drive SIM in manual-only modes** (Circuit, Club Season, Cups): a defensive SIM DRIVE is allowed and the match stays `how: 'played'`; offensive SIM stays disabled.

## Touched outside my lane

None yet.

## Owner device checks

- The catch-and-run feel without touching the stick, and the HOLD TO RUN ghost while the ball is in the air (nfl-1).

## Deferred and rejected

Copied from the plan (§9), each with its reason; cut-line items land here with the task that dropped them.

**Deferred**
- **Precision Passing and the SNAG catch tap.** The passing window already asks too much in 2-3 s (audit C-3); revisit after the owner's device check of the icon and slingshot controls. The Big Hit ring is built (nfl-8).
- **Earned zones, pre-snap zone chips, trigger and knockout on the card face.** They change ability activation on every play (a full recalibration) and need a card-face hand-off; the P0 noise fix (one pop per play) ships in nfl-3. When built, the trigger and knockout text belongs on the card face (players) and in the card detail (packs/ut).
- **Crowd pressure on solo road games.** Solo-only flair that needs a ut `crowd` prop; the later rule is C7, with a static border under reduced motion.
- **The one-button assist.** Needs the final control set and owner feedback first; off online.
- **Hot routes.** Another gesture state; the nfl-5 audible covers "change the call".
- **Adaptive counters and Hot/Cold.** Need per-game tendency state over a calibrated call table; Hot/Cold is flair only.
- **Throwing lanes and batted balls.** Risk feel-bad incompletions.
- **A defensive camera behind your defense.** `pixel/persp.ts` (players) assumes the offense's view; the broadcast camera behind the AI's offense reads well in tests, and the owner checks it on a device.
- **Floor yard-number LOD and per-frame `drawFloor`.** players' `persp.ts`, requested in C14; moved here only if players decline.
- **Player looks, mocap clips and get-up rendering.** players own these; we supply the C9 acts.
- **The overall-99 cap.** Card display, owned by packs and ut.
- **Real names for OL and K fill-ins.** The draft data has none, and loading the UT pool into draft games would add weight.
- **An intentional-grounding penalty.** The throwaway is refused inside the box, which is simpler on a phone.
- **Kickoff-return mini-plays, pick-sixes and safeties for the opponent.** New wire and score semantics in the parallel format are a lead decision.
- **A 6-drive "Standard" length.** OD-3 fixes the game at 4-6 minutes.

**Rejected**
- **Kneel.** No situation where it helps: your clock never affects the rival in the parallel format, and in the alternate solo format the AI's drive comes last and OT has no clock.
- **OT for `App.tsx` `simH2H`.** It decides the draft vote-to-sim by season rating, so no tie arises; making it an arcade sim is a format change for NBA and NFL draft games, recorded as a proposal for the lead.
