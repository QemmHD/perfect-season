# Team nfl: studio overhaul record

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, cut from `claude/studio-overhaul` = main `acdf3e2`. Dev-server port **5216**. The build plan is [`nfl-plan.md`](nfl-plan.md); this file is the running record every task appends to: what changed and why, measurements, "Protocol bump needed", "Touched outside my lane", the cross-team contracts, merge steps, owner device checks and what was left undone.

`O` below means the shared overhaul scratch folder named in `BUILD-RULES.md`.

## Protocol bump needed

**Protocol bump needed: NFL draft 10→11, UT 11→12**, because:

| Task | Reason |
|---|---|
| nfl-2 | The pocket: the stick moves the quarterback (sight and throw error follow), the automatic scramble when he crosses the line, `throwAway` (outside the tackle box only, never intercepted), `giveUp` slide and dive (a tackle, no fumble roll), `coverBall` (a covered ball comes loose 0.3 as often; no moves), the TOUCH/BULLET/LOB chip resetting to TOUCH each snap, and burst read from the stick's ring. Human-played drives come out differently. The AI's drives, sims and takeovers are unchanged (the determinism pins hold): its quarterback never moves on the stick and keeps its old sideline bail throw. |
| nfl-1 | Input semantics after a carrier change: a stick the player has not touched since the catch, handoff or scramble now reaches the engine as `null` (the carrier keeps his momentum) instead of `{0,0}` (a hard brake); the engine's `null` carry for receivers and scrambling QBs keeps the heading for 0.35 s. Human-played drives come out differently, so an old and a new client must not share a queue. AI drives, sims and takeovers are unchanged (the autopilot never sends `null` to a carrier; the determinism test proves it). |

NBA and soccer are not changed by this team. The lead bumps each sport once at integration (`DRAFT_RULES` in `src/net/match.ts`, `UT_RULES` in `src/ut/Match.tsx`; we never edit either).

## Cross-team contracts

Settled here before any code, so the teams build against one shape. C1–C14 were written in revision 2 (commit `2a54e41`); nfl-1 amended C2, C3, C6 and C9 for Game Design V2 and added C15–C23. Where another plan already defines a contract we adopt it (contracts A and B from ut); where one cannot work we say why and propose the fix (C1). Each contract names its owner (who writes the code) and its consumers.

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

### C2. Overtime and the meaning of `done` (amended for V2 §B.2.1)

- **Owner:** nfl (`football2/match-flow.ts`, `football2/sim-match.ts`, Arcade's NFL branch, nfl-9). Consumers: nba (same shape), ut (`simBoth`).
- **V2 amendment.** Overtime is **alternating sudden-death two-point tries from the 2-yard line**, straight after the 4 regulation drives. Revision 2's extra OT drive from the opponent's 25 is dropped: it cost up to 90 s and V2 does not have it.
- `done` is sent only when this side knows the result is final, so it stays monotonic (the same rule as nba-7).
- **NFL units:**
  - 4 regulation drives;
  - then rounds of one try each: `'P2'` is good (2 points), `'P0'` is no good. A round decides it when the two results differ;
  - the cap is **20 rounds** (at most 24 ends, inside the wire's 40). With a round-tie probability of about 0.505, 20 rounds leave about 1.2 × 10⁻⁶ unresolved. Only past the cap does the old `decide()` path run.
- **Exports of the pure `football2/match-flow.ts`:**
  - `required(us: string[], them: string[]): number` — units each side must play now;
  - `final(us: Progress, them: Progress): 'us' | 'them' | null`;
  - `forfeitBy(ends: string[]): boolean`;
  - `pointsOf(ends: string[]): number`;
  - `isTouchdown(end: string): boolean`;
  - `MAX_ROUNDS = 20`.
- **Arcade's NFL branch** uses these in place of `TOTAL` in `rivalLive` (slice and `done`), `finishedFrom`, `shown`, takeover and `taken`.
- **Waiting.** A side that has finished every unit currently required while the rival hasn't sees a wait line. `STALL_MS` and `GONE_MS` apply to each waiting phase, regulation or OT.
- **Takeovers** cover OT with the seeds `seed + ':takeover:ot<n>'` as both sides' ends arrive. Both phones compute it from identical inputs.
- **In solo** you also defend the AI's tries; they are key snaps (see "The solo format").
- **To nba:** the same shape through a `pick`-chosen `flowFor` in Arcade; whichever team lands first writes the generic Arcade hunk, and the other plugs in its flow module.

### C3. Box score: ut contract A, adopted and extended for V2

- **Owner:** nfl fills it (nfl-9); ut reads it (ut-5).
- `Progress.box?: BoxLine[]`, a 2-line optional field in `src/game/progress.ts` (touched outside the lane, listed below when it lands).
- `BoxLine = { id: string; name: string; side: 'us' | 'them'; pos: string; stats: Record<string, number>; rating: number }`.
- NFL `stats` keys: `passYds passTd int rushYds rushTd rec recYds recTd tkl sacks defInt`, plus `fgm fga xpm xpa long`. ut reads them duck-typed.
- **V2 §D.6 adds three keys** for ut's card-mastery feats: `pf` (PERFECT moments by that player), `bt` (broken tackles) and `bh` (BIG HITs).
- We fill `rating` (1.0-10.0) on every line. It is the **single source** for our player of the game and ut-5's MOTM ("highest rating, ties to the winning side"), so the two screens cannot disagree.
- `box` is attached only to the finished `Progress` objects passed to `onFinish`, never to `onProgress`, so it never reaches the wire (a test enforces it). Online, the rival's `box` is absent.

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

### C6. Auto-defend: one meaning, one preference (amended for playtime)

- **Owner:** nfl writes `src/game/match-prefs.ts` (nfl-8) unless nba lands it first; ut's PreMatch reads it.
- **Meaning:** Auto-defend plays the defensive snaps by themselves at ≥ 3× speed, still watchable. SIM DRIVE is an instant result for one drive.
- **Preference:** one shared key, `perfect-season:auto-defend` (boolean, default off), with `getAutoDefend(): boolean` and `setAutoDefend(on: boolean): void`. nba's prefs read and write through it. Unchanged by V2.
- **V2 §E.1 adds:** auto-played snaps and Auto-defend never call the playtime `input()` (C21). Auto-defend alone does not count as playing.

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

### C9. Acts for players: existing acts only (amended for the V2 §B.2.6 frame plans)

- **Owner:** nfl sets acts and events in the engine; players render them.
- **The engine sets the existing acts:** `backpedal` while the QB drops; `down` on a sacked QB and `tackle` on the sacker; `catch` on the RB at the handoff mesh; `juke`/`spin`/`stiff`/`truck` on moves; `windup` on a tackler.
- **Events in `p.events`:** `catch:poss`, `catch:yac`, `catch:high`; V2 adds `perfect:juke`, `perfect:spin`, `bighit`, `stumble:<id>` (the beaten tackler), `handoff:mesh` and `incomplete:bounce`.
- **Players choose clips from these:** the `cut` clip for the juke, `stumble`/`slip` for a beaten tackler, `fall_back` for BIG HIT and truck losers, `getup_front` after a sack. Sack falls come from `p.end.kind === 'sack'`.
- **No new act type**, and no `getup` act: get-ups render from `down` plus elapsed time.
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

### V2 contracts we consume (C15–C21)

All of these are reached only through **`football2/shared-v2.ts`** (built in nfl-1). Until the authors' files reach this branch it holds a thin local version of each contract below: the same names and signatures, pure maths where the contract is pure, pass-throughs to today's `sfx`/`vibrate` where it is feedback, and a no-op playtime meter. `imports.test.ts` fails if any other football file imports the V2 modules directly. At the merge the lead swaps each body for a re-export from the real module (merge step 7); where an author's signature differs, the lead adapts `shared-v2.ts`, never football code.

#### C15. Control geometry: `src/game/controls-geometry.css` (author: nba; V2 §A.5)

- **What we read:** CSS custom properties on `.arcade-full`, inset-aware and switched by the stage, never by a width media query:

  | Group | Properties |
  |---|---|
  | Buttons | `--ctl-a-d`, `--ctl-b-d`, `--ctl-c-d`, `--ctl-d-d` (diameters) |
  | Button centres | `--ctl-{a,b,c,d}-right`, `--ctl-{a,b,c,d}-bottom` (centre offsets from the right and bottom edges) |
  | Stick | `--stick-d` (ring diameter), `--stick-ghost-left`, `--stick-ghost-bottom`, `--stick-zone-w`, `--stick-zone-h` |
  | Action-safe box | `--safe-top`, `--safe-bottom` |
  | Score bug | `--bug-w`, `--bug-h`, `--bug-top` |
  | Heat bar | `--heat-h` |
  | Toast line | `--toast-bottom` |
  | Pause | `--pause-top`, `--pause-left` |

- **Before nba's file lands:** `football2/hud.css` (nfl-3) declares the same names with the A.5 values as fallbacks, so nothing moves when the real file arrives.
- **Our acceptance:** at viewport A the measured centres are within 4 px of A (323, 738), B (238, 778), C (250, 694), D (340, 652); at C, A (266, 510), B (190, 536), C (200, 468), D (282, 436).

#### C16. Stick: `src/game/Stick.tsx` + `stick.ts` (author: nba)

- **Pure `stick.ts`:** `stickFrom(origin: Pt, point: Pt, radius: number, sprintAt = 1.15): { vec: Pt; mag: number; sprint: boolean }`. `vec` is in −1..1 with y up, after the dead zone. (Local version in `shared-v2.ts`, dead zone 0.12, tested.)
- **`Stick.tsx` props:** `onDown(e)` on every **new** pointerdown in the zone, including one already resting there before the whistle; `onMove(vec, sprint, e)`; `onUp(e)`; `ghost?: boolean`; `label?: string`.
- **Imperative handle** `read(): { vec: Pt | null; sprint: boolean; heldSince: number | null }`, so the per-frame read needs no React state.
- **Haptic** `tick` when the sprint ring is crossed.
- **Why NFL needs it this way:** `onDown` is the "new touch" `CarryGate.touch()` requires (nfl-1); the world vector stays ours (`controls.ts` `screenRunInput` maps `vec` to the field for the end and side views); `sprint` drives burst unless the Burst-button preference is on.

#### C17. The gold ring: `src/game/perfect.ts` + `PerfectRing` (author: nba; V2 §B.0.1)

```ts
type Ring = 'gold' | 'amber' | 'red';
interface RingWindow { center: number; half: number; state: Ring }  // engine seconds
const MIN_HALF = 0.030;
const FIRE_SCALE = 1.25;
windowHalf(base: number, scale: number, fire: boolean): number       // ≥ MIN_HALF, × FIRE_SCALE on fire
judge(at: number, w: RingWindow): 'perfect' | 'good' | 'early' | 'late' // 'perfect' only when state === 'gold'
touchTime(e: { timeStamp: number }, anchor: { perf: number; engine: number }, lagMs: number): number
calibrationLag(): number                                              // ms; nba's one-time "tap on the beat"
drawRing(ctx, x, y, r, progress, w, state)                            // gold segment ≥ 8 design px on screen
```

- Pure: no DOM, no RNG. The local `judge` calls a release inside the half-window `perfect` (gold) or `good` (amber/red), within twice the half-window `good`, beyond it `early`/`late`; `calibrationLag()` is 0 until nba's lands.
- Each sport decides whether gold is offered and what it guarantees. NFL's rules are "gold never lies" (the control map below); the toast names the failing dial: TIMING, PRESSURE or RANGE.

#### C18. Heat: `src/game/heat.ts` (author: nba; V2 §B.0.2)

```ts
interface Heat { pts: number; fire: number; best: number; lit: number }
type HeatEv = 'perfect' | 'score' | 'stop' | 'clean' | 'turnover' | 'conceded' | 'half';
addHeat(h: Heat, ev: HeatEv, sport: SportId): { h: Heat; heating: boolean; lit: boolean }
spendFire(h: Heat): Heat
HEATING = 66; FULL = 100;
```

- **The NFL table, filled by us through `pick`:** perfect +12, score (TD) +25, stop or turnover forced +15, clean +5, turnover −20, conceded −10.
- **"Clean" for NFL** is a first down gained on a drive with ≥ 2 completions and no sack (our reading of V2's "clean possession with ≥ 2 passes"; nfl-10 fits it).
- **On Fire** lasts 3 of your snaps. `half` resets `pts` and `fire` after drive 2.
- **Online,** the rival's bar is computed from their wire `ends` only (TD +25, turnover −20), display only. No wire change.
- `shared-v2.ts` carries the types and `HEATING`/`FULL` now; `addHeat`/`spendFire` come with nfl-4. Heat is integer engine state stepped only by engine events.

#### C19. HUD kit: `src/game/hud/*` (author: nba; V2 §C.3)

- `ScoreBug` props: `{ us; them; label /* 'DRIVE 3' | 'OT' | 'CLUTCH' */; clock?; heatUs; heatThem; fireUs; fireThem; progress /* 0–1, the 3 px pip line */ }`.
- `Toast`: one line, 28 px. `toast(text, { prio, ms, key })` queues by priority and clears on `clear(phase)`.
- `PauseButton({ onPause })`.
- nfl adds small hunks only for NFL labels.

#### C20. Haptics and the chime (ut's `src/lib/haptics.ts`; the `sound.ts` chime is whoever lands it, V2 §F.1)

- `haptic('tick' | 'double' | 'long')`; `perfectChime(streak: number)`: two notes, +1 semitone per consecutive perfect, up to 5.
- **Before they land,** `shared-v2.ts` maps `haptic` to the shared `vibrate` (10 ms, 12-40-12, 45 ms; it honours the haptics setting and iOS gesture rules) and `perfectChime` to the existing two-note `sfx.coin()`.

#### C21. Playtime: `src/lib/playtime.ts` (author: ut; V2 §E.1)

- `usePlaytime('match')` returns `{ input(): void; pause(on: boolean): void; complete(): void; abandon(elapsedMs: number): void }`.
- One Arcade hunk (NFL branch) calls the hook. `Football2` calls `input()` on every gameplay or play-call pointerdown or keydown (stick, A–D, tray card, slingshot, icon, kick tap), never on an auto snap, Auto-defend, SIM or replay; `pause(true/false)` from the pause menu and auto-pause; `complete()` at the final whistle; `abandon()` on a quit or forfeit.
- Before ut's module lands, the local meter is a no-op.

### V2 contracts we produce (C22, C23)

#### C22. Match grade: `Progress.grade` (ours, V2 §B.0.3 and §F.1)

```ts
interface MatchGrade {
  letter: 'S' | 'A' | 'B' | 'C';
  perfects: number;     // your PERFECT moments
  chances: number;      // gold rings offered to you
  heatBest: number;     // 0–100
  lit: number;          // times On Fire
  flawless: boolean;    // won with 0 turnovers
}
```

- One optional field in `src/game/progress.ts`, next to `box`, attached to **finished** `Progress` only, never on the wire (test).
- **The letter** comes from your points per drive against `PAR[level]`: S ≥ par + 1.5, A ≥ par + 0.5, B ≥ par − 0.5, else C. `PAR` is a constants table nfl-10 fits.
- **Consumers:** ut-5's tally and the One-More bar, ut-6's objectives ("3 PERFECT releases", "reach ON FIRE once"), and the Touch rating (`perfects / chances`). Grades never pay coins directly (V2 §B.0.3).

#### C23. Daily Play scenarios: `football2/daily-play.ts` (ours, P1, V2 §D.3; ut hosts it and owns the board)

```ts
interface NflScenario {
  id: string;                                  // 'nfl:<ET day key>'
  title: string;                               // '4th and goal from the 6'
  squad: { era: string; edition?: string };
  start: { ballOn: number; down: number; toGo: number; clock: number | null; need: 'td' | 'fd' | 'score' | 'win'; margin: number };
  maxPlays: number;
}
dailyPlay(dayKey: string): NflScenario   // deterministic from the day key; the same for everyone
```

- `Football2` prop `scenario?: NflScenario` plays it on the normal engine and reports through `onDaily({ ok, plays, secs, perfects })`.
- The score formula belongs to ut (outcome + PERFECTs + time); we return the parts.
- At least 28 scenarios rotate by day key. Practice attempts after the 3 scored ones use the same scenario.

### Contract status

| Contract | Counterpart | Status |
|---|---|---|
| C1 forfeit marker | nba, ut, App | proposed |
| C2 OT (V2 two-point rounds) and `done` | nba, ut | proposed, amended for V2 |
| C3 `Progress.box` (+ `pf`, `bt`, `bh`) | ut (contract A) | adopted, extended for V2 |
| C4 `onQuit` | ut (contract B), App | adopted |
| C5 `rivalOffenseFaces` | nba | adopted (nba's name) |
| C6 auto-defend pref (+ playtime rule) | nba, ut | proposed, amended for V2 |
| C8 end codes | ut | requested |
| C9 acts and V2 events | players | requested, amended for V2 |
| C10 `impactOf`, `preloadClips` | players | merge steps |
| C11 shell event and offsets | shell | adopted |
| C12 league sim | ut | requested |
| C13 Bulldozer label, fixtures | packs | requested |
| C14 camera notice, floor LOD | players | requested, awaiting answer |
| C15 geometry | nba | proposed names, local fallbacks (nfl-3) |
| C16 Stick | nba | proposed; local `stickFrom` in `shared-v2.ts` |
| C17 gold ring | nba | proposed; local maths in `shared-v2.ts` |
| C18 Heat | nba | proposed; local types |
| C19 HUD kit | nba | proposed; local props type |
| C20 haptics and chime | ut, soccer | adapter in `shared-v2.ts` |
| C21 playtime | ut | proposed; no-op adapter in `shared-v2.ts` |
| C22 grade | ut | offered |
| C23 Daily Play | ut | offered (P1) |

## Merge steps for the lead

1. Swap the body of `football2/feel.ts` `impact()` for players' `impactOf` (C10; lands with nfl-7).
2. Add `preloadClips('nfl')` to the `Football2` mount effect (C10).
3. Re-screenshot the NFL HUD after nba's `.hg2:not(.fb2)` scoping and shell's `--sat` fix merge (`scripts/qa/nfl-*.mjs`, viewports A-E).
4. Re-run calibration on the merged card pool: `MODE=full FIXTURES=pool npx vite-node scripts/nfl_calibrate.ts` rebuilds the pinned fixture ids from the merged ratings (C13), next to the pinned snapshot.
5. Bump NFL draft 10→11 and UT 11→12 once (see "Protocol bump needed").
6. Re-measure players' stale-draw target for sprites ≥ 48 px after their sprite budget and our camera both merge (nfl-10).
7. Replace the local bodies in `football2/shared-v2.ts` with re-exports from nba's `Stick.tsx`/`stick.ts`/`perfect.ts`/`heat.ts`/`hud/*` and ut's `lib/haptics.ts`/`lib/playtime.ts` (C15–C21), adapting the adapter where a signature differs. `shared-v2.test.ts` and `imports.test.ts` must stay green; no other football file changes.

## QA isolation and the local relay lock

- Browser QA for this team goes through `scripts/qa/nfl-lib.mjs` (new scripts) or `scripts/qa/nfl-guard.cjs` (legacy scripts): every request to a host other than localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com is aborted and reported, and a run that attempted one fails. URLs always carry `?ns=inspect&relay=ws://localhost:7777`. The dev server is on port 5216.
- **Relay lock: `/tmp/ps-qa-relay-7777.lock`.** The local relay binds the fixed port 7777, so every relay-using run, from any team, should hold this lock: `flock -w 1800 /tmp/ps-qa-relay-7777.lock env PS_QA_RELAY_LOCKED=1 node scripts/qa/<script>.mjs`. `nfl-lib.mjs` `relayGuard()` refuses to start a relay-using NFL script without the lock and checks that the port is free.

## Controls: the V2 grammar for NFL (pointer ownership, gestures and the control map)

This replaces revision 2's control map (its ten-button pass panel and the BURST exception are gone; V2 allows at most four right-thumb targets). Built in nfl-2 as the pure, unit-tested `football2/gestures.ts`; the carry rule below is built (nfl-1).

**The stick at a carrier change (nfl-1, built).** When the ball changes hands (a catch, a handoff, a scramble), a stick that is already held counts only when the change is a designed handoff, or when the stick has an upfield component of at least 0.3 of its length. Otherwise the new carrier runs on momentum (`null` to the engine) until a new stick touch or key press, or until the stick moves at least 0.25 from where it was at the change. A stick touched and then released still brakes (`{0,0}`). So a thumb drifting the QB back-left in the pocket never sends the receiver back-left after the catch. With the floating Stick (C16), `onDown` is the new touch. While the ball is in the air a HOLD TO RUN ghost pulses round today's stick; nfl-2 moves it onto the floating Stick, and nfl-3 moves its text into the toast line as "Momentum carries · steer when ready".

### Pointer ownership and gestures

`football2/gestures.ts` is pure and unit-tested, built in nfl-2.

**Ownership is decided on pointerdown, in this order:**
1. on A/B/C/D or the pause button → that control
2. inside the stick zone (left 48% of the width, lower 55% of the height; C15) → the stick until it lifts
3. on a receiver icon → the icon
4. anywhere else on the right two thirds → the slingshot surface

**Tap or drag.** A tap moves < 10 design px and lasts < 250 ms. Anything else is a drag. The slingshot starts at 10 px of travel.

**Receiver icon.** A tap throws an auto-led TOUCH pass to that receiver. A drag of ≥ 10 px from it becomes a slingshot from there.

**Swipes start on A** (V2 §A.5): for the carrier, a swipe ≥ 36 px within 250 ms off JUKE is a juke that way. There is no invisible full-screen swipe layer.

**Everything fires on pointerdown**, except holds (POWER's truck charge) and the slingshot release.

**Before the snap,** a drag of ≥ 10 px on the field above the tray collapses it to look around. Taps on receivers do nothing.

**Cover ball.** The right thumb held still on the field, not on a control, for ≥ 0.3 s while carrying. It is kept from revision 2 for STREAM C-4's "protect ball"; it is a hold, not a swipe layer.

**Second-finger toggle** (cut line). During a slingshot drag, a tap by another pointer cycles the throw type, exactly like C. It never counts the stick's pointer.

### The context map (V2 §B.2.2)

| State | Left stick | A (Ø92, gold) | B (Ø64, teal) | C (Ø48) | D (Ø48) | Field |
|---|---|---|---|---|---|---|
| **Pre-snap** | – | **SNAP** | **AUDIBLE** (flip the picked play to its run/pass mirror) | – | – | the 124 px tray (3 cards; swipe for the book); drag to look around |
| **Pocket** | moves the QB (slide, step up, roll); crossing the line of scrimmage makes him a runner automatically | **RUN IT** inside the tackle box; **THROW AWAY** outside it (same slot, label changes) | – | **TOUCH / BULLET / LOB** chip (tap cycles; resets to TOUCH each snap) | – | slingshot anywhere on the right two thirds, or tap a receiver icon; the landing reticle is always drawn |
| **Ball carrier** | steer; momentum carries until the first touch (C-1); **past the ring = burst** (shares stamina) | **JUKE** toward the stick side (a swipe off A picks the side) | **SPIN** | **POWER**: tap = stiff arm, hold ≤ 0.6 s = truck charge | **DIVE** within 3 yd of the line to gain or the goal line; **SLIDE** for a QB past the line; hidden otherwise | – |
| **Defense, pre-snap** | – | **READY** (the AI snaps 1.0 s later anyway) | – | **SWITCH** | – | the tray shows 3 calls (BLITZ / MAN / ZONE family, from the nfl-5 table); ALL CALLS swipes |
| **Defense, live key snap** | moves your defender | **TACKLE**: the ring closes on the carrier as you close; gold = BIG HIT. Ball in the air and your man facing it: **PICK** ring on the ball (gold = INT); facing away: **SWAT** | – | **SWITCH** (to the man nearest the ball) | – | – |
| **Kick** | – | two taps: power, then accuracy on a sweep scaled by the kicker's rating | – | – | – | – |

**The Burst-button preference** (`fb2-burst-button`, pause → Controls): when on, D is a hold-BURST button as before. DIVE/SLIDE replaces it only while in context, and the stick ring then does nothing. The default is off (lead decision 2). This is an owner device check.

**The gold ring in NFL. "Gold never lies"** means gold is offered only when the outcome below can be guaranteed. Otherwise the ring is amber or red, and the toast names the dial.

| Moment | Ring | Gold is offered when | Gold guarantees | Amber / red |
|---|---|---|---|---|
| **Sling** (nfl-4) | the landing reticle; release as the break lines up | the target's separation halo is green, the spot is in his catch radius and within the QB's arm range | a catchable ball in stride: no placement error, no drop, no interception | amber under pressure ≥ 0.5, or a tight halo (the timing still narrows error); red out of arm range (RANGE) |
| **Tap throw** | none | – | never better than a PERFECT sling (auto must not beat manual) | – |
| **Juke / spin** (nfl-4) | the tackler's wind-up ring (`windupOf`) | the tackler is in his wind-up and the carrier has the move ready | that tackler misses and stumbles for 0.8 s | early = the cut is slowed; late = wrapped (contest, nfl-7) |
| **Truck** (nfl-7) | the POWER charge meter | – (STR + momentum decides; no gold) | – | – |
| **BIG HIT** (nfl-8) | ring on the carrier as you close | your defender is in range (2.6 yd) and closing | a tackle that ends the play now (the fumble roll still applies) | amber when he is out of range; early or late = a wrap with a broken-tackle chance |
| **PICK** (nfl-8) | ring on the ball at the catch point | your defender faces the ball (75° rule) and can reach the catch point | an interception | facing away = SWAT, amber |
| **Kick** (nfl-9) | the accuracy sweep's gold band | the distance is inside the kicker's range | the kick is good | beyond range the band is amber (the make chance falls off over 5 yd) |

- **Gold windows.** The half-width is `windowHalf(base, scale, fire)`, with the ±30 ms floor. Ratings set the size:
  - the sling: QB accuracy (ACC/THP short/mid/deep)
  - juke/spin: JKM/SPM and AGI
  - BIG HIT: HIT and TAK
  - pick: the defender's catching and play recognition
  - kick: KAC
- **Seeing it.** On screen the gold segment is ≥ 8 px, so a 95 visibly gets a fatter gold than a 70 (V2 §B.0.1).
- **The deep throw (G-2).** 20+ air yards scale `base` by 0.7 and are never gold under pressure. This, with nfl-6's coverage fixes, is how deep completion reaches 33–45% for the human proxy.

## The solo format, Clutch and session length (OD-2, OD-3, V2 §B.2.1)

**The budget.** The binding target is a median of **4-6 min** per solo game, P90 ≤ 6.5 min, at 1× speed with replays on and defense played.

**Why 4 drives stay.** With conversions and about 2.1 points per drive the chance of a tie after regulation is ≈ 11.5% with 4 drives each (0-0 ≈ 1.8%) against ≈ 16% (0-0 ≈ 4.7%) with 3. Only 4 drives meet OT ≤ 12% and 0-0 ≤ 2%.

**Format.** Solo games alternate: your drive k, then the AI's drive k on defense.
- `DRIVES` stays 4 for online, solo and `league.ts`.
- On the AI's drives you play the **key snaps**:
  - every 3rd and 4th down
  - every snap inside your own 20
  - the AI's two-point tries
- The other AI snaps play themselves at 3×, watchable and skippable.
- Auto-defend plays every AI snap at 3×. SIM DRIVE resolves one AI drive at once and shows the recap.
- **Online** head to head stays the parallel offense race.

**Ties** go to two-point rounds from the 2 (C2). In solo you also defend the AI's tries; they are key snaps.

**Clutch = drive 4** (V2 §B.0.4). This is your drive 4 and, in solo, the AI's drive 4 too.
- **Rules:** a two-minute drill with a running clock and **three timeouts shown as pips in the bug**, plus HURRY and SPIKE. The clock and timeouts are rules (protocol).
- **Staging** (presentation only):
  - the crowd bed rises
  - the bug turns gold and reads CLUTCH
  - the camera sits 6% tighter
  - the heartbeat haptic runs while the margin is one score
  - "FOR THE WIN" is announced when the drive can tie or win
  - that drive's score always gets the replay

**Time budget.** Model from `pacing.ts`; nfl-1 measured an offensive drive median of 42.3 s.

| Drive | Make-up | Target |
|---|---|---|
| Offense | about 6 plays × (2.5 s pick + live play + 0.6–0.8 s whistle-to-tray) | median ≤ 45 s |
| Defense | about 2.5 key snaps × (call + play + 0.7 s) + about 3.5 auto snaps at 3× + 3 s of transitions | median 35–40 s |
| OT | each round ≈ 2 × 12 s | median ≤ 30 s when it happens |

**Replays** play only on TDs and takeaways (V2 §B.2.7), so revision 2's second fallback is now the default.

**Fallbacks**, in order:
1. auto snaps at 4×
2. 0.6 s whistle-to-tray
3. last resort: `SOLO_DRIVES = 3` (never `DRIVES`), with the OT target relaxed and recorded

**What "solo" covers:**
- **Covered:** Squad Battles, Cups, Club Season, Events, UT Draft games and draft games against the AI.
- **Not covered:** Gauntlet (a pure sim) and NFL Moments (drills). Both are deliberate readings of OD-2, recorded.
- **Defensive SIM DRIVE** is allowed in manual-only modes, and the match stays `how: 'played'`.


**`perfect-season:fb2-defense-snaps` = `'all'`** is an opt-in "Longer games" mode that plays every AI snap. ut is offered a defensive Moment through `practice.drill = 'defend'` (nfl-8 cut line).

## Task record

### nfl-1: contracts, calibration harness, baselines and the momentum carry (C-1) — done 2026-11-16

**Commits** (branch `claude/studio-nfl`): `1df36f0` harness and fast baseline · `10aa263` the momentum carry (C-1) · `f9504f1` prefs and the QA harness · `6d1957c` `shared-v2.ts` · `2850925` guard paths and profiler liveness · this record with the full baseline.

**What changed and why.**
- **C-1, the carrier braked to a stop after every catch and handoff** unless the stick was already held (the screen sent `{0,0}` for an untouched stick). Now `controls.ts` `CarryGate` sends the engine `null` for a new carrier the player has not taken yet, and the engine's momentum carry keeps his speed, bends him upfield (0.35 s at 0.6 of his turn rate, then his full rate) and plants a man caught drifting back. A new touch, or the held stick moving 0.25, hands him to the stick; a stick held upfield at the change, or any deflection on a designed handoff, drives at once; a touched centred or released stick still brakes. The rule is in "Controls" above and in `docs/NFL-DIRECT-CONTROL.md`.
- **The HOLD TO RUN ghost:** while the ball is in the air and the stick is untouched, a teal ring pulses round the stick under an 11 px label (`rushing-controls.css`); reduced motion keeps the label and drops the pulse. It hides as soon as the stick is held.
- **The knob is drawn by ref:** a drag no longer re-renders `Football2` per pointer move.
- **Calibration harness:** `sim-kit.ts` (seeded whole games through the real loop, an AI pilot or a human proxy whose thumb lands late, bands with 95% intervals, the wall-clock model), `scripts/nfl_calibrate.ts` (fast 100 / full 400 games per case, pinned fixtures in `nfl-calibration/fixtures.json`), and `pacing.ts`, the screen's own waits, which both `Football2` and the model read.
- **`shared-v2.ts`:** the single import point for nba's and ut's V2 pieces with local fallbacks (C15–C21 above); `imports.test.ts` enforces it.
- **`prefs.ts`:** typed local preference keys (no key added yet; nfl-2 adds `fb2-burst-button`).
- **QA:** `nfl-lib.mjs` (isolated phones A–E, explicit reduced motion, a self-test probe), `nfl-guard.cjs` (the same isolation for legacy scripts), `nfl-catch-run.mjs`, `nfl-baselines.mjs`.

**Before → after (C-1).**

| Measure | Before | After | Acceptance |
|---|---|---|---|
| Full CAL YPC, stick 0.35 s late vs held (gold v gold, Pro, 400 games) | fast: 1.06 vs 4.15 (0.26×) | **5.23 vs 3.90 (1.34×)** | ≥ 0.95× |
| Full CAL YPC, never touched vs held | fast: −3.67 (100% ≤ 0) | **4.63 (1.19×)** | ≥ 0.95× |
| Full CAL YAC, stick 0.35 s late vs held | fast: 2.10 vs 5.32 (0.39×) | **4.66 vs 4.99 (0.93×)** | ≥ 0.85× |
| Ladder, human proxy with the stick 0.35 s late, wins Rookie / Pro / Legend | fast: 24 / 22 / 19% | **53.8 / 45.0 / 37.5%** (in time: 49.0 / 43.3 / 33.3%) | — |
| Live catch with the stick never touched (`nfl-catch-run.mjs`, A and C, normal and reduced motion) | audit: 5 of 5 braked to 0 within 0.25 s | **6 of 6 in all four runs:** speed at +0.25 s and +0.5 s 1.46–1.81× catch speed, YAC 3.9–8.1 yd | 6/6 ≥ 70% at +0.25 s and ≥ 50% at +0.5 s; YAC > 1 yd on ≥ 5/6 |
| `Football2` React commits during a 2 s stick drag (56–63 pointer moves) | one per move (`setKnob`) | **0** (11 before the drag, so the hook is live) | ≤ 10 |

The late thumb now beats the held one on designed runs because `null` follows the play's lane, and the proxy's held stick (straight at the pilot's lane) is a weaker runner than the lane path. That is the proxy, not a reward for waiting; nfl-7 recalibrates runs and re-checks it.

**Baselines taken** (all after C-1; the AI and the stickless human proxy are unchanged by it, so they are the baseline to beat for nfl-2 onward):
- **Full CAL:** `nfl-calibration/baseline-full.{json,md}`, 400 games per case, **3214 s (53.6 min) wall, 47.8 min CPU** under the shared semaphore (budget ≤ 60 min). Fast CAL: 539 s (≤ 15 min). Highlights: AI Pro gold 3.64 pts/drive, 68.4% cmp, 2.8% INT, 2.9% sacks, YPC 3.93, 3rd down 48.9%; Legend elite 1.17 pts/drive, 7.1% INT, 31.1% of drives end in a turnover; Legend promo 9.3% INT, 40.0% turnover drives; the 11-drive shape 3.93 pts/drive; human proxy (stick 0.35 s late, 2.5 s to call) median drive **45.4 s**, P90 72.5 s, game 184 s.
- **PLAY tap → first playable tray** (A, reduced motion, dev server): draft **409 ms** at 1× and **1434 ms** at 4× CPU; UT Squad Battle **338 ms** and **1268 ms** (targets ≤ 1.6 s and ≤ 4 s). Mount → tray 930 / 3342 ms (draft) and 763 / 2925 ms (UT).
- **`nfl-attrs` bytes in a match:** 1,637,454 bytes (dev server, untransformed) for both the draft game and the UT match; a production byte count belongs to nfl-3's load work.
- **Heap after two autoplayed drives:** **20.0 MB** used (21.5 MB total), offense only.
- **Wall-clock model vs the browser:** 5 autoplayed games at 1× (20 drives, 149 plays): measured mean drive **32.77 s**, model **32.63 s**, model/measured **0.996** (each drive within 1%; target ± 10%).

**Tests added or changed.**
- `rushing.test.ts`: a null-input catch in the open field keeps ≥ 0.85× catch speed at +0.5 s and gains ≥ 4 yd in 1 s (5 headings); drifting back, he heads upfield within 0.3 s; a touched `{0,0}` brakes to < 0.01 yd/s; a pre-held upfield stick drives at once; the stick held back-left through the catch gives an upfield heading at +0.3 s in 20 of 20 seeds; the autopilot never sends `null` to a carrier.
- `controls.test.ts`: every `CarryGate` rule (handoff with any deflection, upfield pre-hold at the 0.3 line, back-left pre-hold, a 0.25 move, a new touch, release-to-brake, a resting centred thumb, a fresh decision per carrier).
- `determinism.test.ts` (new): 200 seeded AI plays at three levels and strengths, `aiDrivesOf` and takeover seeds, pinned to hashes computed on the pre-change tree (`b0277ad`); unchanged.
- `calibration.test.ts` (kit, always on; the CAL bands opt-in with `CAL=1`), `imports.test.ts` (kit isolation and the V2 single import point), `prefs.test.ts`, `shared-v2.test.ts`.
- **Changed old test:** `scripts/qa/joystick.mjs` asserted that an untouched carrier stands still after the handoff. That was the C-1 bug; it now asserts the carry and that a touched, centred stick stops him. Its other checks (two-axis directions at 390, 320 and landscape, two-thumb burst, release-to-stop, interrupt-stop, copies preserved) pass under the guard.

**Isolation findings.** The guard blocked a probe `fetch('https://example.com/qa-probe')` and a WebSocket to a non-local host, and failed those runs as designed. Running the legacy `joystick.mjs` through the guard showed that the shared `scripts/qa/browser.mjs` fixture, under `?ns=inspect`, still tries the **live** cloud save (`functions/v1/player-save`) and card registry (`functions/v1/card-registry`): 15 requests, every one aborted on the machine, so the run is marked failed by the isolation rule although all of its assertions pass. The app's home screen does the same (8 registry requests, aborted, in `nfl-baselines.mjs load`). Reported to the lead below; no team should run that fixture unguarded.

**Protocol bump needed:** NFL draft 10→11, UT 11→12 (see the table at the top).

## Touched outside my lane

- **nfl-2** `src/game/Arcade.tsx` (shared with nba; NFL branch only): four optional props, `onQuit`/`quitText` (C4) and `feedback`/`onFeedback` (the pause menu's sound and haptics switches), passed to `Football2`; `onQuit` is offered only offline (about 12 lines).
- **nfl-2** `src/App.tsx` (ut/shell's): the draft game's `<Arcade>` passes `feedback={profile.settings}` and an `onFeedback` that updates the same settings the Settings sheet does (2 lines). It does **not** pass `onQuit`: what quitting a draft game means is App's call (C4), so the pause menu there shows Resume, Controls and Sound/Haptics only until App and ut wire it.
- **nfl-2** `src/game/Lab.tsx` (the `?arcade` test bench): local sound/haptics state and an `onQuit` that writes the progress into a hidden `data-quit` span, so QA can prove quit reaches the host (6 lines).
- **nfl-2** `src/game/football2/render.ts` (ours, outside the players' sections): `heads` is kept public for the name chips, and the canvas slot tags in the pocket are skipped when the screen draws chips (`chips` overlay flag). No player-drawing code changed.

- `scripts/qa/joystick.mjs` (Codex's shared QA script; nfl-1, `10aa263`): the post-handoff assertion now checks the momentum carry and that a touched, centred stick stops the runner (about 12 lines).
- `docs/NFL-DIRECT-CONTROL.md` is in our lane (OWNERSHIP); nfl-1 appended a "momentum carry" section and left the Codex text as it was.

### nfl-2: the V2 control grammar (floating stick, A/B/C/D, pocket, passing surface, pause) — done 2026-11-16

**What changed and why** (audit C-2, C-3, C-6, D-5 pause; V2 §A.5 and §B.2.2; the record is also in `docs/NFL-DIRECT-CONTROL.md`).
- **The floating stick** (`shared-v2.ts` `Stick`, the local C16): it lives in the C15 zone (left 48%, lower 55%), the ring jumps to the thumb, a thumb resting there before the snap is live at the snap, `onDown` feeds `CarryGate.touch()`, and the knob, ring and sprint state move by ref. **Burst is the ring**: past 1.15 × the radius `setBurst(p, true)` at the touch and on every step after (stamina maths untouched); `prefs.ts` `BURST_BUTTON` (`perfect-season:fb2-burst-button`, default off) puts hold-BURST on D instead. HOLD TO RUN now rides the floating stick's ghost ring.
- **A/B/C/D** (`pass-controls.css`) from the C15 variables, which `shared-v2.ts` `controlGeometry(w, h, insets)` computes (the V2 §A.5 table at 393×852 and 320×568, blended between by the tighter of width and height, landscape compact and pushed in by the side insets) and Football2 sets on `.arcade-full`, with the insets from the stage's test hook or an `env()` probe. Context map as in "The context map" above; fourth down adds FIELD GOAL (C) and PUNT (D). Glossy bevelled buttons with SVG symbols, the gold A, the teal B.
- **`gestures.ts`** (pure): ownership on touch-down (control → stick zone → receiver chip → right two thirds), tap vs drag at 10 px / 250 ms, the slingshot from 10 px, a pending A press that resolves as a swipe (≥ 36 px in 250 ms) or a plain JUKE, the cover-ball hold (0.3 s still), the second-finger TOUCH → BULLET → LOB cycle that never counts the stick's finger, and `burstHeld` (one source at a time).
- **The pocket** (`engine.ts`, `types.ts`): the stick moves the quarterback from the first step at `lerp(3.6, 5.0, AGI)` yd/s (until he's at his 6.5 yd drop he keeps backpedalling: the stick can drift him, not bring him forward); `p.roll` costs up to 20% of his sight; letting go holds the spot the stick left (`p.spot`); the act is `backpedal` through the drop. `outsideBox` is |x − ball| > 4.5. Crossing the line makes him a runner (`scramble`), and then he can't throw. `throwAway` (outside the box only) lands 3 yd past the near sideline, nobody plays it, it is never intercepted, and it reads THROWN AWAY. `giveUp('slide')` (a quarterback past the line: 0.25 s of slowing) and `giveUp('dive')` (anyone: 1.2–2.0 yd by SPD in 0.32 s) end as a tackle at the end or at first contact, with no fumble roll. `coverBall` (the right thumb held still on the field): 4% slower, no moves, a hit jars the ball loose 0.3 as often. A sack sets `down` on the quarterback and `tackle` on the sacker. After a throw from a moving pocket the quarterback stops instead of gliding.
- **The passing surface** (`ReceiverIcons.tsx`): a chip in the route colour 4 px over each eligible receiver's head (surname at 11 px, else the number, else the slot; fill-ins' "WR 86" style names fall back to the number), each a 44×44 touch area; where two areas overlap a touch fans the chips out instead of throwing. A chip throws an auto-led pass of the current type **on touch-down** (V2 "everything fires on touch-down"; so the plan's "drag from a chip becomes a slingshot" was dropped: aim starts on the open field around the chips). The landing reticle is always drawn: the slingshot's own while dragging, otherwise a teal ring at the lead spot of the most open receiver, whose chip is outlined.
- **Pause** (`shared-v2.ts` `PauseButton` at the C15 slot, `PauseMenu.tsx`, `pause.css`, `clock.ts`): in every pre-snap and live state (not the final, replays, practice or autoplay). The menu: RESUME, CONTROLS (the map for each moment and the Burst-button switch), SOUND/HAPTICS (when the host passes `feedback`), and offline QUIT with a confirm through `onQuit` (C4). `clock.ts` `GameClock` is the screen's real time: the fixed-step loop, replays, slow motion, the kick needle and every wait between plays (`after`) stop while paused. The game pauses itself on `visibilitychange` to hidden and on `pagehide`. Playtime `pause(true/false)` and `abandon()` are called (C21; a no-op until ut's module lands). Online, pausing stops only your own game and the menu says so; forfeit comes with nfl-9.
- **The play-call strip** before the snap is the existing cards in a swipeable strip left of the cluster (FLIP and PLAYBOOK as its last cards) so SNAP and AUDIBLE can sit on A and B; nfl-3 replaces it with the 124 px tray. The score bug makes room for the pause button.
- Old move buttons, BURST, the pass panel and the fixed stick are gone (their CSS removed from `rushing-controls.css`).

**Before → after.**

| Measure | Before | After | Acceptance |
|---|---|---|---|
| Human proxy, Pro gold, sack % of dropbacks (`scripts/nfl_pocket_proxy.ts`, 400 games each, 95% intervals) | 13.2 [12.4–14.1] (pocket off) | **8.3 [7.6–9.0]** (pocket on) | ≥ 3 points lower |
| … throwaways | 0 | **3.6% [3.2–4.1]** | 1–4% |
| … INT % of attempts | 2.12 [1.77–2.54] | **1.81 [1.49–2.19]** | up ≤ 0.3 points |
| … points per drive | 3.49 | 3.69 | — |
| A/B/C/D centres vs V2 §A.5 (`nfl-controls.mjs`) | fixed buttons elsewhere | **0 px off** at A and C | ≤ 4 px |
| Gaps A–B / A–C / A–D | — | **15.9 / 15.2 / 17.7** (A), **10.3 / 14.2 / 11.7** (C) | 10–18 |
| Right-thumb targets (pre-snap / pocket / carrier) | up to 10 in the pass panel | **2 / 2 / 3–4**, none in the top two thirds | ≤ 4 |
| Thumb held before the snap moves the QB on the first step | the old stick appeared only after the snap | **10/10** at A and C, both motion settings | 10/10 |
| Crossing the sprint ring → `p.bursting` | (no ring) | **the next frame** | ≤ 1 frame |
| Name chips to the heads | slot letters drawn on the canvas | **4 px** | ≤ 12 px |
| Touch-down on a chip → ball in the air | a panel button, on click | **0.6–1.1 ms** after the page receives the touch (the emulated event's own timestamp is 23–56 ms earlier on this loaded machine: it waits in the browser's input queue) | ≤ 16 ms |
| Paused: drift of `p.t` over 3 s; hidden page | no pause | **0**; paused within the frame, drift 0 | 0; ≤ 1 frame |

The proxy's pocket thumb (`autopilot.ts` `pocketThumb`): a beaten rusher is seen and, 0.25–0.5 s later, escaped sideways (stepping up from an edge, backing off an inside man, never to the line); on one dropback in ten he rolls out on purpose; outside the box, rushed, half the time he throws it away; and a hurried bail inside the box is no longer a throwaway for a person (`Pilot.legalOnly`). The AI's pilot is untouched.

**Tests added or changed.**
- `gameplay.test.ts`, "the pocket (nfl-2)": displacement 1.5–5 yd in 1 s with a stick at AGI 40/70/99 in four directions and none beyond the drop with `null` or a centred stick; a stick held at the snap moves him on step one and can't bring him forward while dropping; throwaway refused inside the box and never intercepted outside it (500 seeds, > 400 thrown); the automatic scramble fires the step he crosses the line and never before, and he can't throw after; slide and dive always end in a tackle with no fumble (500 seeds) and a slide is refused behind the line; covering the ball; a sack's acts; identical inputs give an identical end; **C9**: 500 seeded plays identical with every act swapped for a dummy; **burst**: stamina traces identical from the ring and from D over 200 seeds.
- `gestures.test.ts` (new): every ownership rule, tap/drag at the thresholds, the chip's touch-down throw, swipe off A (left, right, too short, too slow, vertical, lapsed), the cover hold with the stick held, the second finger never the stick's.
- `clock.test.ts` (new): paused time stands still, timers keep their remaining time, cancel, dispose, nested timers.
- `shared-v2.test.ts`: `controlGeometry` matches the V2 table at both sizes (and landscape), buttons ≥ 44 px on any phone.
- `prefs.test.ts`: the Burst-button key (missing, garbage, throwing storage, missing storage).
- `determinism.test.ts`: unchanged and green (the AI's plays, `aiDrivesOf` and takeovers still hash to the pins).
- `scripts/qa/nfl-controls.mjs` (new): all of the browser checks above at A and C with motion on and reduced, 0 page errors, no non-local requests. `nfl-catch-run.mjs` and `nfl-baselines.mjs` selectors follow the new stick and SNAP; `nfl-catch-run.mjs` still passes at A and C (6 of 6 carriers keep ≥ 70% of catch speed at +0.25 s, YAC > 1 yd on 6 of 6).

**Protocol bump needed:** NFL draft 10→11, UT 11→12 (see the table at the top).

## For the lead (found in nfl-1)

- **QA isolation:** under `?ns=inspect` the app and the shared `scripts/qa/browser.mjs` fixture still call the live `player-save` and `card-registry` functions (aborted here by `nfl-guard.cjs`). Every team's legacy QA should run behind a route-abort, and `ns=inspect` should probably disable cloud saves and registry writes in the app itself (`src/lib/cloud-save.ts`, `src/ut/registry.ts`: lead-only paths).

## Owner device checks

- **nfl-2** The floating stick under the left thumb, and burst by pushing past the ring (V2 lead decision 2: the "Burst button" switch under pause → Controls restores hold-BURST on D if the owner prefers it).
- **nfl-2** The A/B/C/D cluster's reach for the right thumb on the owner's phone, JUKE toward the stick or by a swipe off A, and DIVE/SLIDE showing on D only near the sticks.
- **nfl-2** Moving in the pocket and THROW AWAY outside the tackles; the name chips (tap = throw on touch-down) and the reticle.
- **nfl-2** Pause, and the automatic pause when the phone locks or the app goes to the background.

- The catch-and-run feel without touching the stick, and the HOLD TO RUN ghost while the ball is in the air (nfl-1).
- That a thumb resting on the stick through the throw never stops the catch, and that the first deliberate push takes the carrier at once (nfl-1).
- The HOLD TO RUN label's place above the stick on the owner's phone (it sits over the field's lower left; nfl-3 moves it into the toast line).

## Deferred and rejected

Copied from the plan (§9), each with its reason; cut-line items land here with the task that dropped them.

**Deferred**
- **nfl-2: the AI quarterback's 0.8 yd step-up** against a free edge rusher. It changes every AI drive (the determinism pins, the fast/full baselines), so it moves to nfl-5 with the rest of the AI's football brain; the AI's old sideline bail throw stays with it until then.
- **nfl-2: the legacy Codex QA scripts** `joystick.mjs`, `rushing.mjs` and `core-gameplay.mjs` still look for the fixed stick, BURST and the pass panel (`Run joystick:`, `.fb2-burst`, `.fb2-passing`). Their checks (two-axis displacement, release-to-stop, two-thumb burst, interruption) are covered for the new controls by `nfl-controls.mjs` and the engine tests; porting their selectors to `.v2-stick` and `[data-ctl]` is listed for nfl-3's QA step.
- **nfl-2: quit wiring in the hosts.** `Arcade` offers `onQuit`/`quitText` (C4); App's draft game and ut's `Match.tsx` decide what quitting means and pass them (ut contract B). Until then the pause menu in those hosts has no QUIT row.
- **nfl-2: the CONTROLS page's drawing** (a diagram of the thumbs) is the plan's second cut-line item; the page lists the map as text and moves to nfl-3 for the drawing.
- **nfl-2: the online takeover deadline on the pause menu** comes with nfl-9's forfeit.
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
