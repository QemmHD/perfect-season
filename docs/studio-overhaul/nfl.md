# Team nfl: studio overhaul record

Worktree `/home/user/ps-s-nfl`, branch `claude/studio-nfl`, cut from `claude/studio-overhaul` = main `acdf3e2`. Dev-server port **5216**. The build plan is [`nfl-plan.md`](nfl-plan.md); this file is the running record every task appends to: what changed and why, measurements, "Protocol bump needed", "Touched outside my lane", the cross-team contracts, merge steps, owner device checks and what was left undone.

`O` below means the shared overhaul scratch folder named in `BUILD-RULES.md`.

## Protocol bump needed

**Protocol bump needed: NFL draft 10→11, UT 11→12**, because:

| Task | Reason |
|---|---|
| nfl-4 | The gold ring: a PERFECT sling is caught in stride with no error, drop or interception; early or late throws carry 1.3× the error; a PERFECT JUKE/SPIN puts that tackler on the turf for 0.8 s (the AI's own moves meet the same ring). Touch-timestamp timing. Heat replaces the three-completion On Fire (no more quicker ball or whole arc); ON FIRE widens every gold window 1.25× and turns a rush-only amber gold. The determinism pins moved (`9d4f17f7` / `d7536bc8`), so AI drives, sims and takeovers come out differently too. |
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
  turnovers: number;    // nfl-4: what flawless reads, settled once the rival's score is final
}
```

- **nfl-4 amendment:** `turnovers` is carried so `flawless` can be settled when the result is known. The game screen sends its grade in `onDone` before the rival may have finished, and `Arcade` sets `flawless` with `gradeResult(us, them)` as it calls `onFinish` (`src/game/progress.ts`). Consumers read `flawless`, never the count.

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
| C14 camera notice, floor LOD, sprite-scale steps | players | notice delivered with nfl-3 (near players 34-35 css px at 393 through `camera.ts` `ART` = 1.38 × the projected size); floor LOD still requested; **nfl-3's `spriteScale` (render.ts, 4 px size steps for sprites ≥ 28 px) is in players' sprite-sizing code: players to take it over or approve it** (see "Touched outside my lane") |
| C15 geometry | nba | proposed names, local fallbacks (nfl-3) |
| C16 Stick | nba | proposed; local `stickFrom` in `shared-v2.ts` |
| C17 gold ring | nba | proposed; local maths in `shared-v2.ts` |
| C18 Heat | nba | proposed; local types |
| C19 HUD kit | nba | proposed; local `ScoreBug` (+ Heat bar) and `ToastLine` in `shared-v2.ts` (nfl-3), with football's additions in `ScoreBugExtra` |
| C20 haptics and chime | ut, soccer | adapter in `shared-v2.ts` |
| C21 playtime | ut | proposed; no-op adapter in `shared-v2.ts`; `input()` wired on every touch, key, control, tray card and kick tap (nfl-3) |
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

- Browser QA for this team goes through `scripts/qa/nfl-lib.mjs` (new scripts) or `scripts/qa/nfl-guard.cjs` (legacy scripts): every request to a host other than localhost, 127.0.0.1, fonts.googleapis.com and fonts.gstatic.com is aborted and reported, and a run that attempted one fails. Service workers are blocked in every context (their fetches would bypass the route guard); the `--probe` self-test checks it. URLs always carry `?ns=inspect&relay=ws://localhost:7777`. The dev server is on port 5216.
- **Relay lock: `/tmp/ps-qa-relay-7777.lock`.** The local relay binds the fixed port 7777, so every relay-using run, from any team, should hold this lock: `flock -w 1800 /tmp/ps-qa-relay-7777.lock env PS_QA_RELAY_LOCKED=1 node scripts/qa/<script>.mjs`. `nfl-lib.mjs` `relayGuard()` refuses to start a relay-using NFL script without the lock and checks that the port is free.

## Controls: the V2 grammar for NFL (pointer ownership, gestures and the control map)

This replaces revision 2's control map (its ten-button pass panel and the BURST exception are gone; V2 allows at most four right-thumb targets). Built in nfl-2 as the pure, unit-tested `football2/gestures.ts`; the carry rule below is built (nfl-1).

**The stick at a carrier change (nfl-1, built).** When the ball changes hands (a catch, a handoff, a scramble), a stick that is already held counts only when the change is a designed handoff, or when the stick has an upfield component of at least 0.3 of its length. Otherwise the new carrier runs on momentum (`null` to the engine) until a new stick touch or key press, or until the stick moves at least 0.25 from where it was at the change. A stick touched and then released still brakes (`{0,0}`). So a thumb drifting the QB back-left in the pocket never sends the receiver back-left after the catch. **A touch made while the ball is in the air counts at the catch whatever its direction** (review fix): the thumb can only have landed after the throw, so it is deliberate, and the HOLD TO RUN ghost asks for exactly that. `touch(true)` marks it; a touch in the pocket (`touch()`) stays gated. With the floating Stick (C16), `onDown` is the new touch. While the ball is in the air a HOLD TO RUN ghost pulses round today's stick; nfl-2 moves it onto the floating Stick, and nfl-3 moves its text into the toast line as "Momentum carries · steer when ready".

### Pointer ownership and gestures

`football2/gestures.ts` is pure and unit-tested, built in nfl-2.

**Ownership is decided on pointerdown, in this order:**
1. on A/B/C/D or the pause button → that control
2. in the pocket, on a receiver icon → the icon (nfl-2 review fix: a chip wins over the stick zone; the back's chip sits in the zone on most pass plays, and the chips are drawn over it)
3. inside the stick zone (left 48% of the width, lower 55% of the height; C15) → the stick until it lifts
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

**The Burst-button preference** (`fb2-burst-button`, pause → Controls): when on, D is a hold-BURST button for the whole run and the stick ring does nothing. Near the sticks DIVE/SLIDE takes B (in SPIN's place) instead of D, so a held BURST never changes under the thumb (nfl-2 review fix; before it, BURST unmounted mid-hold and the runner kept bursting with no button on screen). The default is off (lead decision 2). This is an owner device check.

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

The late thumb beats the held one on designed runs. The review fix below measured why against the old perfect thumb (corrected there: the held proxy is not weaker than the lane path; the momentum path is stronger than both on outside and power runs, and that goes to nfl-7).

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

#### nfl-1 review fixes (2026-11-16, on top of nfl-2)

An independent review of `b0277ad..7ac837c` found one medium and four low issues. All five are fixed or answered.

- **(medium) A touch made while the ball was in the air was ignored at the catch.** On a carrier change the gate re-decided from the held stick, and a stick held sideways (toward the sideline, or cutting back) was gated until it moved 0.25 or was touched again. In the pocket the thumb now moves the quarterback (nfl-2), but in the air it can only have landed after the throw, so it is deliberate. `CarryGate.touch(inAir)` remembers a touch made while nobody carries the ball (`fresh`); at the next carrier change a held, deflected stick then counts whatever its direction, and `fresh` is spent (a lateral decides afresh) and cleared by `reset()`. Football2 passes `p.phase === 'air'` from the stick-down gesture and from a key press. A pocket touch (`touch()`) is never fresh, so the pocket-drift guard is unchanged (the 20/20 back-left test still passes).

  | Measure | Before | After |
  |---|---|---|
  | Unit: `touch(true)`, stick `{1,0}` held through the catch | `null` on every step | **`{1,0}`** from the first step |
  | Live, `nfl-catch-run.mjs … held` (stick pushed hard right in the air, held through the catch; 6 carriers at A) | **0/6** turn right; catch3 vx −4.77 at the catch → −5.89 at +0.25 s (keeps drifting left) | **6/6 at A and 6/6 at C**: vx up 2.7–3.6 yd/s by +0.1 s; catch3 −4.77 → +2.21 at +0.25 s |
  | Live, stick never touched (`nfl-catch-run.mjs`, A and C, motion on and reduced) | 6/6 in all four | **6/6 in all four** (unchanged) |

- **(low) Is the held stick a weak baseline for the C-1 ratios?** The stick case now includes `stick-lane`, the human proxy steering by the pilot's numeric lane (the old perfect thumb, the same config as `human-pro-gold`). Full CAL, 400 games per case, `nfl-calibration/stick-compare.{json,md}`:

  | Thumb | YPC [95%] | inside | outside | power | YAC | pts/drive |
  |---|---|---|---|---|---|---|
  | lane (perfect thumb) | 3.94 [3.76–4.12] | 3.53 | 4.16 | 4.11 | 4.33 | 3.70 |
  | held from the change | 3.90 [3.74–4.05] | 3.70 | 3.98 | 4.03 | 4.99 | 3.71 |
  | late 0.35 s | 5.23 [5.00–5.46] | 3.83 | **6.76** | 5.04 | 4.66 | 3.88 |
  | late 0.7 s | 5.33 [5.07–5.59] | 3.87 | **6.68** | 5.44 | 4.61 | 3.88 |
  | never touched | 4.63 [4.46–4.79] | 4.09 | 5.11 | 4.65 | 4.27 | 3.80 |

  So the held proxy runs exactly like the old perfect thumb (3.90 vs 3.94), and the C-1 ratios hold against it too: late 0.35 s / lane = **1.33×**, never touched / lane = **1.18×** (≥ 0.95×). The earlier note ("the proxy's held stick is a weaker runner") was wrong and is corrected above. The real finding is the reviewer's second point: the engine's `null` path for a designed run (follow the play's lane and landmark) out-gains any steered thumb on **outside** (+2.6 YPC) and **power** runs, so a person who pushes the stick at the handoff gains about 1.3 yards a carry less than one who waits, and outside runs reach 6.7 YPC with the representative late thumb (target 4.3 overall). Handed to **nfl-7** (run feel and G-1 calibration): either the held stick should get the lane's shaping (the stretch landmark) for its first beats, or `null`'s outside path is too generous; recalibrate with `stick-late0.35` as the human reference.
- **(low) Service workers could bypass the QA route guard.** `nfl-lib.mjs` `phone()` and `nfl-guard.cjs` now open every context with `serviceWorkers: 'block'`. The `--probe` self-test proves it against a throwaway local origin: a bare context registers a worker (`control: registered`), the QA context does not (`worker: blocked`), and the fetch and WebSocket probes are still blocked and reported.
- **(low) Screenshots defaulted to this session's scratchpad path.** `SHOTS` is now `NFL_SHOTS` or `os.tmpdir()/ps-nfl-shots`.
- **(low, P-4) The pocket's tip ("Tap a name to throw…") stayed up while the ball was in the air, arguing with HOLD TO RUN.** It is cleared on the throw (and on a throwaway), and the first real throw shows "Momentum carries · steer when ready" in its place (checked in screenshots at A and C, with the ghost and with the stick held). nfl-3 may move that line into the toast.

**Tests added:** `controls.test.ts` "steers at once with a touch made while the ball is in the air" (the reviewer's repro, back-left too, a pocket touch still gated, spent after one carrier, let go before the catch = momentum); `rushing.test.ts` "steers a receiver at once with a thumb that landed while the ball was in the air": 20 seeded catches, held right vs never touched on the same seed: vx rises on the first step and by > 1.5 yd/s at +0.1 s, > 1 yd/s right of the momentum path, positive by +0.25 s, and positive within 0.15 s whenever the catch was not already moving left faster than 1 yd/s. `nfl-catch-run.mjs` gains the `held` mode above.

## Touched outside my lane

- **nfl-4** `src/game/progress.ts` (shared by all three sports, additive): optional `Progress.grade` (`MatchGrade`, C22), `wireProgress` and `gradeResult`, and optional `RivalLive.ends`. nba's C22 lands the same field; the lead keeps one copy.
- **nfl-4** `src/game/Arcade.tsx` (shared; about 8 lines, every sport, harmless for the others): `onProgress(wireProgress(p))` so a grade never reaches the wire, `onFinish(gradeResult(us, them), …)` to settle FLAWLESS, and the rival's `ends` passed in `shown` (online, from their progress; solo, the AI's ends so far).

- **nfl-3** `src/game/football2/render.ts`, the players' player-drawing section: `spriteScale()` and its one call in the player loop (`this.sprite(b, p.t, p, spriteScale(b.p.ht, f.s * art))`, with `art` = `camera.ts` `ART`). Sprites 28 px or taller change size in 4 px steps, so a player moving in depth no longer rebuilds his sprite every few frames; under 28 px the size is unchanged. It changes which size a sprite is drawn and cached at (never a pose, look or clip). Listed in C14 for players to take over or approve (found by the nfl-3 review).
- **nfl-3** `src/game/Arcade.tsx` (shared with nba; NFL lines only): the NFL kickoff copy (P-4) and one line that skips `loadAttrs()` for an NFL UT match (`FOOTBALL && teams…`).
- **nfl-3** `src/evolution/Training.tsx`: the NFL drill tips (strings only).
- **nfl-3** `src/game/play-feedback.ts` and its test (shared nba/nfl; NFL strings only): the next-step copy (P-4).

- **nfl-2** `src/game/Arcade.tsx` (shared with nba; NFL branch only): four optional props, `onQuit`/`quitText` (C4) and `feedback`/`onFeedback` (the pause menu's sound and haptics switches), passed to `Football2`; `onQuit` is offered only offline (about 12 lines).
- **nfl-2** `src/App.tsx` (ut/shell's): the draft game's `<Arcade>` passes `feedback={profile.settings}` and an `onFeedback` that updates the same settings the Settings sheet does (2 lines). It does **not** pass `onQuit`: what quitting a draft game means is App's call (C4), so the pause menu there shows Resume, Controls and Sound/Haptics only until App and ut wire it.
- **nfl-2 review fixes** `scripts/qa/polish.mjs` (Codex's shared QA): the play-art selector `.fb2-cards` → `.fb2-tray-strip`, and A's accessible name "Scramble: the quarterback runs" → "Run it: the quarterback tucks it and runs" (2 lines). `scripts/qa/joystick.mjs` and `core-gameplay.mjs`: their NFL steps ported to the V2 stick, A–D and the name chips (about 70 lines, NFL parts only).
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

#### nfl-2 review fixes (2026-11-16, on top of nfl-3)

An independent review of `7ac837c..cf63eb6` found two high, three medium and four low issues. All are fixed, or answered below.

- **High: a chip in the stick zone could not be tapped.** The stick (z 3) sat over the chips (z 2), and `ownerOf` asked the zone before the icon, so the back's chip (in the zone on nearly every pass play) had a hit area of 0. Now the chips are drawn over the zone (`.fb2-icons` z 4, still under A–D), `ownerOf` takes a pocket icon before the zone, a touch whose target is a chip's own element always throws to him, and a long surname's label (wider than 44 px) counts as his touch area. Two more chip bugs turned up in the landscape run and are fixed: a touch on a long label next to another chip fanned them out forever (labels never fan now; only overlapping 44 px cores do, else the nearest chip takes it), and `fanOut` compared only neighbours in x, so two stacked chips with a third between them in x never separated (it now steps each chip past every placed chip it overlaps; `receiver-icons.test.ts`).
- **High: AUDIBLE ignored a practice drill.** In a rushing Moment or a run Training rep, B flipped the play to a pass from the book, and a caught pass counted as a rep. `controls.ts` `callAllowed(drill, call)` is now the one rule for the tray, the book and AUDIBLE; `audibleTo` never returns the other call when the drill forbids it, and B is not shown at all in a run, throw or kick drill (`canAudible`). Tests: every card mix in a run drill and a throw drill, and the real `choices()` under a run drill (only runs).
- **Medium: BURST unmounted under the thumb near the sticks** (Burst-button preference on). BURST now stays on D for the whole run, and DIVE/SLIDE goes on B instead; the held burst also ends from a window `pointerup`/`pointercancel` watcher, when the preference is switched off, when the run ends and on unmount. The pause menu's map follows the preference.
- **Medium: the resting thumb and the play strip.** nfl-3's 124 px tray (docked above A, on the right in landscape) had already replaced nfl-2's strip; this fix measures it. `nfl-controls.mjs` now runs A, C and D by default (B and E on request) and checks, before the snap, that the stick's ghost spot belongs to the stick and lies under no control or tray, and that no control, tray, pause button or score bug covers the RB or the slot. The landscape thumb now pushes along the screen's vertical (the side-on camera turns the field, so screen right there is upfield, which a drop refuses: that was the reviewer's 0/10).
- **Medium: legacy QA names.** The tray's FLIP card is named "FLIP PLAY: the formation is now RIGHT/LEFT" (with `aria-pressed`) and BOOK "FULL PLAYBOOK: every play", so `clubhouse.mjs` and `polish.mjs` find them unchanged; `polish.mjs`'s play-art selector moves from `.fb2-cards` to `.fb2-tray-strip` (one line). `joystick.mjs` (and `rushing.mjs`, which imports it) and `core-gameplay.mjs` are ported to `.v2-stick` and `[data-ctl]`: the ring burst, the Burst-button D with two thumbs, C cycling to LOB, the chips' 44 px areas, a chip touch that throws.
- **Low, copy:** the chips' accessible name (touch a name to throw at once; drag on the open field to aim) and `ReceiverIcons.tsx`'s header; the pause map's stale "C · D: FIELD GOAL · PUNT" row (nfl-3 moved fourth down into the tray). The kickoff rows, the "Save the burst" line and the run tip were already fixed by nfl-3's P-4 copy.
- **Low, THROW AWAY** reads top to bottom: the icon, THROW, AWAY (it read AWAY / THROW). The 320 strip's clipped second card is nfl-3's tray now (three cards and a swipe into the book), not this strip.
- **Low, the burst-equivalence test** was tautological. It now drives the real sources: a scripted thumb read through the Stick's own `stickFrom` at the 1.15 ring, applied at the touch through `burstAtTouch` (the function the Stick's `onMove` now calls) and on every step through `burstHeld`, against D's pointer state with the preference on while the stick is pushed at random. 200 seeds give identical stamina traces, more than 100 of them really burst, and a third test shows the ring alone does nothing with the preference on.
- **Low, quit in the shipped hosts:** unchanged and still on the integration checklist (below, "For the lead"): App's draft `<Arcade>` and ut's `Match.tsx` must pass `onQuit`/`quitText` (C4) before ship.

**Measured** (`nfl-controls.mjs`, isolated, touch, dsf 1; A, C, D with both motion settings, B and E reduced):

| Measure | Before (review) | After |
|---|---|---|
| Visible chips that throw when touched (3 seeds × every chip, motion on) | the back's chip in the zone: 0/6 at A | **A 15/15** (3 in the zone), **C 15/15**, **D 15/15** (9 in the zone, 6 after a fan-out); reduced motion A, C, D, B, E 5/5 each |
| The ball goes to the touched receiver (nearest to the landing spot, led) | — | 15/15 at A, C and D |
| Thumb resting on the ghost spot before the snap moves the QB on the first step | D 0/10 | **10/10** at A, C and D, both motion settings |
| Ghost spot owned by the stick, under no tray or control (A / C / D) | D under the strip | **(86,728) / (72,494) / (131,295): free** |
| Controls, tray, pause or bug over the RB or the slot before the snap | D: the strip over the slot | **0** in A, B, C, D, E |
| Burst-button D bursts; ring burst within 1 frame | pass | pass (all views) |

The two "chips within 12 px of the heads" misses in the first A–D run (14 px at C, 12.x at D, reduced motion, the machine at a load of 6+) did not repeat on the rerun (5.8 / 10.8 / 9.4 / 6.4 px at C / D / B / E); the chip places are unchanged by this fix except after a fan-out. The legacy scripts, through `nfl-guard.cjs`: `joystick.mjs` (390, 320, 844: directions, release-to-stop, ring burst, two-thumb D burst, interruption, copies preserved) and `core-gameplay.mjs` (NBA court; NFL pass: C to LOB, 44 px ctl and chips at 320/844/390, a chip touch throws; NFL run: D burst, release outside, keyboard, interruption) pass every assertion, and so do `polish.mjs` (both sports; its NFL step needed the A label's new name, one line, and a Tab wrap in `PlaybookDialog.tsx`: Chromium let Shift+Tab leave the modal playbook for the browser's own UI) and ut's `clubhouse.mjs` (both sports; the rushing Moment's book shows 3 runs, FLIP PLAY is pressed, 3 manual attempts). The guard still marks these runs failed because the shared `browser.mjs` fixture tries the live `player-save` and `card-registry` (15 requests, all aborted; reported to the lead in nfl-1).

**Protocol:** none beyond nfl-2's (`audibleTo`, the chip and burst fixes are input routing; a drill never goes online). **Saves:** none (the Burst-button key is unchanged).

### nfl-3: the screen: camera, action-safe box, 124 px tray, HUD kit, overlays, load and pacing (P-1, P-3, P-4, V-1, V-3, V-4) — done 2026-11-16

**What changed and why.**
- **The broadcast camera, `camera.ts`** (V2 §B.2.3; called from `render.ts`, render-only). Upright: the line of scrimmage sits at 45% of the height before the snap and the formation is centred on the ball; live, the play's spot eases to 58% (the pocket holds halfway). The horizon is at 6%; pitch 0.6, field of view 0.75, 0.034 px a yard per css px of width at the focus, so the wideouts split 13 yd stay on screen at every width. Players are drawn `ART` = 1.38 times their projected size (V2 §C.6 "sprite scale = projected scale × a per-sport constant"): the quarterback and the back measure 35 css px at 393 while the field keeps its real proportions. **Dynamic zoom:** the slingshot's reticle (or the ball's landing spot in the air) pulls the zoom back, down to 0.75, until it fits the C15 action-safe box, then the focus slides so the passer and his target are both inside; a carrier with 2+ defenders within 3 yd or in contact pushes in to 1.15; Clutch (`frame.clutch`, nfl-9 sets it) multiplies by 1.06; under reduced motion the zoom stays 1 and the camera only follows. Each new play lines up at once; the camera settles exactly when close, so a still camera reuses its floor. Landscape keeps the side-on camera (the audit's readability reference) with the line a little left of centre, clear of the tray.
- **Turf overlays, `overlay.ts`** (render-only): the V2 ground rings (gold `#f6b93b` under the man you control, teal `#4fe3c1` under the receiver your throw is going to, a red `#ff5d5d` arc on the side the nearest rusher comes from), the run lane (a faint arrow from the back through the hole, before the snap and through the mesh), the ball never under 4×3 px with a shadow ring that tightens as it comes down and a three-dot trail, the incompletion's bounce (two hops and a roll over 0.6 s; it fades in place under reduced motion), and the line to gain flashing on a conversion (steady under reduced motion). The "who's open" helper rings for new players no longer use red or gold (green / amber / grey), so the four ring colours mean one thing each (V2 §C.5 rule 5).
- **The play tray, `PlayTray.tsx` + `play-tray.css`** (P-1, replacing nfl-2's strip): docked 8 px above A, full width between the safe areas, **124 px** at 393 and 112 at 320 (the bug's own blend). Three suggested cards, then FLIP, BOOK (the full dialog) and the rest of the book in the same swipe. Fourth down: **[the best play] [FIELD GOAL n YARDS] [PUNT]**, preselected (the kick in range, a punt from deep with 4+ to go, else the play), and **A says what the pick does: GO / KICK / PUNT** (the C and D fourth-down buttons are gone). The header is one line: the down, distance and spot, then whatever the toast line has to say before the snap, else **LAST PLAY** with the result (tap for the breakdown: the facts and the coaching line, which used to be the `PlayReadout` chip that overlapped the hint, V-3). A drag on the field before the snap folds the tray to a 44 px bar and pans the camera (gestures.ts `look`); a tap on the bar brings it back.
- **The HUD kit (C19, local in `shared-v2.ts`, styled by `hud.css`):** one 232×40 score bug (YOU and the rival in skewed team blocks, the drive label with the two-minute clock, the down and distance, and a 3 px line of one pip a drive: gold TD, teal FG, red turnover, grey otherwise, the live one filling with field position); the Heat bar directly under it (until nfl-4 it shows the quarterback's On Fire streak, burning when he's on fire; the old ON FIRE chip and the drive-mark row are gone); and **one toast line** (28 px, bottom edge at `--toast-bottom`, docked into the tray's header before the snap; under the Heat bar in landscape). Everything the screen says goes through `hud.ts`'s `ToastQueue`: hints (cleared the moment the play moves on, not 4.2 s later: P-4), results ("+7 YDS · TACKLED BY SMITH", "FIRST DOWN", "SACKED BY …"), the ability pop and the banners, by priority. The big centre-screen pop is gone (audit §9: banners belong in the toast line).
- **V-4, one ability pop a play:** the first ability a play reports goes to the toast line ("BULLDOZER · HENRY"), the rest are not shown; the engine's seeded roll is untouched. "Truck Stick" now reads **BULLDOZER** (C13; the id `truck-stick` is unchanged).
- **P-3:** the playbook dialog is one shrinkable grid track (`minmax(0, 1fr)`), `box-sizing: border-box` with `min-width: 0` on its cards; the width media query is gone (auto-fill columns instead) and its 9 px labels are 10 px.
- **P-4 copy:** every `Football2` tip shortened to fit one toast line at 320; `Arcade.tsx`'s NFL kickoff: "from your own 25" → "starting wherever the kickoff leaves you", and the how-to rows describe the stick, its ring, the name chips and JUKE/SPIN/POWER; Training's NFL tips (no swipes or double-taps any more); `play-feedback.ts`'s NFL next steps (no SCRAMBLE or BURST button, the lane arrow, stepping away and throwing it away). The kickoff's "a tie goes to the better team" stays true until nfl-9's overtime lands (follow-up below). Shell's `arena-tips.ts` is not on this branch; its NFL lines are reviewed when it merges.
- **Load:** `Football2` and `Arcade` skip `loadAttrs()` when the teams come rated (a UT match): **0 bytes of `nfl-attrs`**. `ps:arena-ready` is dispatched after the first drawn frame (C11).
- **Pacing (`pacing.ts`):** whistle to tray **0.7 s** (from 1.35), 0.78 s on a first down (its line flashes; 0.75 since the review fixes); a score's 2.3 s celebration and a long touchdown's replay lead-in end 0.3 s after a tap; **replays only for touchdowns** (25+ yards, as before; the big-hit, truck and stiff-arm replays are gone, their slow motion stays). Takeaway replays come with nfl-8's played returns. `sim-kit.ts`'s wall-clock model reads the same constants (`after: 'first'` added, the `moment` replay removed).
- **Playtime (C21):** `input()` on every pointerdown on the screen, the stick, A–D, the tray, the kick meter and the run keys; never from the autopilot.
- **Name chips** stay between the Heat bar and the toast line (and above D in landscape), so they never overlap the HUD.
- **Performance:** the floor is re-projected only when the camera moved (V2 §C.6), the canvas's 2D context is read once, and sprites 28 px or taller change size in 4 px steps so the larger players don't rebuild every few frames as they move in depth.

**Before → after** (`scripts/qa/nfl-presnap.mjs`, isolated, touch, dsf 1; before = `c7f90e5`):

| Measure | Before | After | Acceptance |
|---|---|---|---|
| Line of scrimmage, % of height before the snap (A / C) | 62.1 / 62.1 | **45.0 / 45.0** | 43–47 |
| Lowest offensive body vs tray top (A / C / E) | RB at 597 vs 712 (A) | **507 vs 560 / 338 vs 348 / 397 vs 434**; B 555 vs 634; D: no body inside the tray | ≤ tray top − 6 |
| Tray height (A / C / E) | 98 / 113 / 98 (nfl-2's strip; plan baseline 236) | **124 / 112 / 116** | ≤ 124 |
| Near players (QB, RB) at A, css px | 20–22 (audit 12–25) | **35** (B 38, E 32, C 27–30); linemen in their crouch 27 | 32–36 at A |
| Stands, sky and bug, % of height (A, own 25) | 27.1 | **12.7** | ≤ 15 |
| Ball in flight | 2–4 px (audit) | **≥ 4 px** (4×3 minimum) | ≥ 4 |
| Deep ball, motion on (A) | no zoom | **zoom 0.84**, reticle inside the safe box on 19/19 samples | < 0.85; inside |
| Deep ball, reduced motion | — | **zoom 1** | 1 |
| HUD overlaps (bug, Heat, pause, toast, tray, icons, A–D), A–E × pre-snap pass/run, pocket, after, fourth, both motions | 0 overlaps but 9 px text and two-line toasts | **0**, smallest HUD text **10 px** | 0; ≥ 10 px |
| Toasts at C and E | 35–55 px, two lines | **28 px, one line** | one line |
| Playbook at A / C / E | x = −5, 10 px wider than the screen | **inside [12, vw − 12]**, scrollWidth = clientWidth | — |
| Ability roll, 2,000+ plays each (gold / elite / promo) | 0.50 / 0.50 / 0.50 of chances | **unchanged** (0.500 / 0.501 / 0.499) | 45–55% |
| Ability pops shown per play (gold / elite / promo) | 0.72 / 2.41 / 2.59 | **0.58 / 0.78 / 0.84**, never more than 1 | ≤ 1 |
| PLAY → first playable tray, draft / UT, 1× | 409 / 338 ms (nfl-1) | **370 / 255 ms** | ≤ 1.6 s |
| … 4× CPU | 1434 / 1268 ms | **1059 / 1448 ms** | ≤ 4 s |
| `nfl-attrs` bytes in a UT match | 1,637,454 | **0** (the draft game still loads it) | 0 |
| `ps:arena-ready` | not sent | **sent** after the first frame (205–891 ms after PLAY) | sent |
| Whistle → tray, 20 plays (A) | 1.35 s nominal | **0.66–0.81 s** (0.70–0.72 ordinary, 0.79–0.81 first downs) | 0.6–0.8 |
| React commits a second in live play with no input (19 plays) | — | **0.26–1.62** | ≤ 2 |
| Frame pacing, autoplay lab at 390×844 dsf 3, 15 s, 4× CPU (load average 5–7 on the shared machine; same session) | 51.8 / 55.1 fps, 17–28 frames > 33 ms, 10–13 long tasks | **52.6 / 51.5 fps, 21–29 frames > 33 ms, 13–14 long tasks** | no regression (within noise) |

The far players (the two deepest defenders) draw 11–12 px at A: the plan's "about 22" is not met by this camera (perspective puts them at a third of the quarterback's height). It is not in nfl-3's acceptance; listed below.

**Tests added or changed.**
- `hud.test.ts` (new): the toast line's priorities, waiting and stale toasts, keys, clearing on phase change and at a new play, "never stacks" over 500 random pushes; the one-pop rule; BULLDOZER and no banned words; **the ability roll over 2,100 real plays (elite and promo squads): 45–55% of chances, at most one pop a play, and more than one ability reported on 20+ plays (not vacuous)**; the bug's model (labels, pips, FINAL).
- `camera.test.ts` (new): the framing at A and C through the renderer's own projection (line of scrimmage 43–47%, every receiver on screen, stands ≤ 15%, far/near < 0.65); the live row; **20 seeded deep throws: zoom under 0.85 on 20/20 and the reticle, the passer and the landing spot inside the safe box on 20/20; reduced motion keeps the zoom at exactly 1 on all 20**; traffic and Clutch zoom; the ball's 4×3 floor; the run lane's life; the bounce and the line flash; and **render-only: 72 seeded plays hash identically with the camera and every overlay drawing each step (a recording context saw 1,000+ calls) and without them**.
- `gestures.test.ts`: the pre-snap field is now `look` (was `none`: the old behaviour was the gap the tray collapse fills); look-drag, tap, stick-zone and cancel cases.
- `calibration.test.ts`: the wall-clock model's `first` wait and the touchdown-only replay (its `moment` replays were removed on purpose).
- `play-feedback.test.ts`: "Save BURST" → "Save the burst" (the copy was the P-4 bug).
- QA: `scripts/qa/nfl-presnap.mjs` (new: `layout`, `zoom`, `pace`, `load`); `nfl-controls.mjs`, `nfl-catch-run.mjs` and `nfl-baselines.mjs` follow the tray (`.fb2-tray`, `[data-call]`) and the stick's label; `nfl-controls.mjs` rests the pre-snap thumb on the stick's ghost spot (below the tray) and leaves out chips held inside the HUD band or at the screen's edge from its 12 px tip check. All pass at A and C, both motion settings; `nfl-catch-run.mjs` 6/6 at A and C.

**Protocol:** none (render and UI only; the determinism pins and the render-only test hold). **Saves:** none.

#### nfl-3 review fixes (2026-11-17, on top of nfl-4)

An independent review of `c7f90e5..b66a260` found two medium and five low issues. All are fixed.

- **Medium: the look-around leaked into the next play.** `lookFrom` (where the next drag starts) was cleared only when the folded tray's bar was tapped, so a look followed by a snap from the folded tray made the next play's first small drag jump by the old offset (the reviewer: 7.0 yd across and 8.2 yd downfield for a 14 px drag). `Football2.tsx` now has one `resetLook()` (the view and the drag's start), called when the next play lines up, at the snap and from the bar.
- **Medium: LAST PLAY's touch target.** It was 36 px tall, and its invisible area reached 8 px down over the play cards' top edges, so a tap there opened the breakdown instead of picking the play. The button now fills the 20 px header row, and its touch area runs up through the tray's top padding and 20 px into the field above the tray, and down only to the strip's top edge: **50–51 px tall, 0 card pixels taken** (`elementFromPoint` down the button's column and over every card's top 12 px, A–E).
- **Low: a book pick vanished from under the finger.** A play picked past the seam moves to the front of the strip; the strip now scrolls home after the strip re-renders (smoothly, or at once under reduced motion; a scroll in the click handler was undone by the strip's snap when the cards changed under reduced motion). At A the strip goes from scrollLeft 761 to 0 with the gold card in view (B 724, C 834, D 798, E 779 → 0).
- **Low: cut-off card names.** The card's name is 11 px (from 12; the card has 72 px of text), so "Double Post" (70 px) and "Inside Zone" (68 px) fit. Two names are shortened on the tray only: "Four Verticals" → **Four Verts** and "Outside Zone" → **Wide Zone** (the same run's other common name), with its line "OUTSIDE RUN" (76 px) → **EDGE RUN**. The field goal out of range reads **NO RANGE** (was "OUT OF RANGE", 82 px). The playbook dialog and the accessible names keep the full names. Measured: no `.fb2-card` label in the tray has scrollWidth > clientWidth at A–E, before the snap (pass and run) and on fourth down.
- **Low: the fourth-down suggestion.** It suggested GO on 4th & 36 at the OPP 44, because the punt needed the ball on your own side. `hud.ts suggestFourth` (pure, tested): the kick when the autopilot's own call is the kick (in range), else a punt when it is a long way for the spot (4+ on your side of midfield, 7+ across it, 10+ inside the 35), else GO. The screenshot at A shows **PUNT** preselected on 4th & 36 at the OPP 44. It only changes which card starts selected; nothing about the kick or the play changes.
- **Low: the pace check.** A timed-out tray wait used to reuse the previous tray's time (the reviewer's −3.21 s sample); a sample is now taken only when the next tray came and is stamped after this play's whistle. The bound is the acceptance's 0.8 s, and the first-down wait is **0.75 s** (from 0.78) so frame jitter stays inside it. Run: 19 ordinary waits **0.70–0.76 s** (the one 1.91 s wait is a drive change), commits a second 0.26–1.40.
- **Low: `spriteScale` in render.ts** (the 4 px sprite-size steps) is in the players' player-drawing section. It is now listed under "Touched outside my lane" and in the C14 row for players to take over or approve.

**Tests.** `hud.test.ts`: `suggestFourth` (the kick cases, 4th & 36 at the OPP 44 punts, short yardage goes). `nfl-presnap.mjs layout` adds, in every view: look, snap from the folded tray, then a 14 px drag moves the view < 2 yd and less than half the first look (A: 6.3 yd first look → 1.3 yd; C 7.7 → 1.6; B, E alike; D 2.9 → 0.6); LAST PLAY ≥ 44 px with no card pixels; the book pick scrolls home with the pick in view; no cut-off card labels (pre-snap and fourth down). Runs: `layout A,C both` all checks passed; `layout B,D,E reduce` and `layout D both` (after the look check's guard was made relative for landscape's smaller drag); `pace 20` passed; `PS_SPORT=nfl vitest run src/game/football2 src/game/play-feedback.test.ts src/engine/sport-branches.test.ts` 197 passed, 4 skipped; typecheck clean. Screenshots in `O/shots/nfl/nfl-3-fix/nfl-3/`.

**Protocol:** none (the look, the tray, the suggestion and the pacing are UI only; `WHISTLE_TO_TRAY` is wall-clock time between plays and never reaches a result). **Saves:** none.

### nfl-4: the gold ring, Heat and the match grade (slice #5) — done 2026-11-17

**What changed and why.**
- **Timing from the touch (C17).** Every timed input (the sling's release, JUKE, SPIN, a swipe off A) is turned into engine time once, from the event's own `timeStamp`, by `touchTime(e, anchor, calibrationLag())`. The anchor pairs `performance.now()` with the engine's time (the play clock plus what is waiting in the fixed-step accumulator) and is refreshed every frame. The input waits in one slot (`timed`) and is applied at the first step its time has reached, and the engine judges it at that exact time, so a late frame never moves the judgement. A JUKE press that turns into a swipe is timed by the press. On a tackler's live gold ring the press cuts away from him at once instead of waiting for the lift: the browser QA found a tap's ~100 ms between press and lift could put a perfectly timed JUKE after the hit (it failed at 320 px on seeds where the dive lands 60–80 ms after the commit).
- **The sling ring (`engine.ts` `slingWindow`, drawn on the reticle).** The window is centred on the release that has the ball arrive as the receiver gets there (`slingTarget`: the closest pass of his route to the spot, or his arrival at a curl's settle). Its half-width is `windowHalf(22 ms + 33 ms × accuracy at that distance, 1, On Fire)`, ×0.7 for 20+ air yards, floored at 30 ms. It is **gold only when the outcome can be promised**: the spot within his 1.2 yd catch radius and in bounds, in arm range, his separation halo green (2.4 yd; 3.4 yd for a 20+ yard ball, which hangs), and the rush under 0.5 (under 0.25 deep). It is **amber** under pressure or tight coverage (PRESSURE) or off his path (TIMING), and **red** past the arm (RANGE, the whole ring, no timing). **Gold + PERFECT** = no placement error, nobody plays the ball in the lane, no drop and no interception (`ball.sure`). Early or late = 1.3× the throw error. Amber or red can never be PERFECT. A tap on a name chip, and every AI throw, take the `good` path (today's accuracy), so a tap never beats a PERFECT sling.
- **The separation halo** on each name chip (`ReceiverIcons`): green when he is open where a throw now would meet him, amber when tight. It uses the same `separation()` value the autopilot reads to choose its man.
- **PERFECT JUKE and SPIN.** A tackler's wind-up (`windupOf`) is now the gold ring around him (`jukeWindow`), centred on the moment he commits. Its half-width is `windowHalf(22 + 33 × his moves and agility)`. It is gold while the carrier has a move ready, amber while he does not. **PERFECT:** that tackler grabs at air and is on the turf for 0.8 s (`stumble:<id>`), and the carrier keeps 90% of his speed. **Early:** the cut is 25% weaker. **Late or good:** as before (the dive's own timing decides; nfl-7 adds the contest). The AI's own moves meet the same rings at its step.
- **Heat (C18) replaces the three-completion On Fire.** It is integer `Game` state (`drive.ts heatEvent`, the pure maths in `shared-v2 addHeat/spendFire`):
  - +12 for each PERFECT, +25 for a touchdown, +15 for a stop or takeaway by your defense (solo: the rival's drive ends in a punt, downs, a missed kick, a turnover or a safety), +5 for a clean first down (a set of downs moved on with no sack or flag), −20 for a turnover, −10 when the rival scores (solo).
  - HEATING UP at 66 (the ball's trail warms and lengthens, the crowd lifts, the bar glows). ON FIRE at 100 for your next 3 snaps (4 with a Heat Check card, which used to light the old fire a completion sooner): every gold window 1.25× wide, an amber that is only the rush's turns gold short of 20 air yards, the ball burns (flame particles; under reduced motion the bug's still flame says it), and the first score while On Fire gets the slow-motion replay. The bar empties after drive 2.
  - The quarterback's old On Fire (the whole arc shown, a 12% quicker ball) is gone; ON FIRE's wider gold covers it. The defensive On Fire of revision 2 is cut.
  - **The rival's bar** is worked out from their wire `ends` alone (`heatFromEnds`: TD +25, turnover −20, empty after their drive 2), online and solo. `RivalLive.ends` carries them from `Arcade`. Online, your Heat is your offense's alone.
  - The score bug shows two bars (yours under YOU, theirs under the rival), each with the 66 mark, and a still flame in the block of whoever is ON FIRE.
- **Words, sound and feel (V2 §B.0.5).** PERFECT on the toast line in gold ("PERFECT · IN STRIDE / JUKE / SPIN"), scaling 1.0 → 1.25 → 1.0 over 220 ms (no scale under reduced motion). `perfectChime(streak)` (two notes a fourth apart, a semitone higher for each PERFECT in a row up to five; the shared `sfx.perfect` when the merge brings it) and `haptic('double')`. A non-gold release names its dial: TIMING (EARLY / LATE / NOT IN STRIDE), PRESSURE (RUSHED / TIGHT COVERAGE) or RANGE (PAST HIS ARM). HEATING UP and ON FIRE are toasts too, also when a stop by your defense lights it. A PERFECT move gets a 50 ms hit-stop. Every NFL hit-stop now goes through `feel.ts impact()`: 33–120 ms each, 30 ms under reduced motion, never more than 150 ms in any second.
- **The match grade (C22).** `Game` counts PERFECTs (and each player's, for nfl-9's `pf` box key), gold chances, turnovers, best Heat and times lit. `gradeOf` gives the letter from points a drive against a provisional `PAR` (Rookie 4.0, Pro 3.4, Legend 2.1; nfl-10 fits it). The grade rides only on the finished `Progress` from `onDone`. `Arcade` strips it from everything it sends (`wireProgress`) and settles FLAWLESS (a win with 0 turnovers) once the rival's score is final (`gradeResult`). The final card shows the letter, PERFECT n/m, best HEAT, ON FIRE ×n and FLAWLESS.
- **The human proxy (`sim-kit.ts`).** Release error σ = 50 ms around each ring's centre, judged at that instant (the same model as nba-4). On a sling he drags onto where his man will be, with the pilot's own aim error. The ring corrects him up to twice: if its moment has already passed, he leads further; if it is amber TIMING, he slides halfway back onto the path. He goes for 70% of the gold JUKE/SPIN rings he is shown, on any tackler closing on him, once his move is ready. His solo rival's drive ends (the AI pilot at the difficulty) land after each of his drives, as `Arcade` shows them. The AI side is unchanged by the proxy.

**Before → after.** Calibration: `MODE=fast CASES=ai,human,stick npx vite-node scripts/nfl_calibrate.ts`, 100 games a case, gold fixtures v gold. "Before" is the pre-task tree `3c4c2e6` (`nfl-calibration/nfl4-before.*`; its AI rows are `baseline-fast`). "After" is `nfl-calibration/nfl4-fast.*`.

| Measure | Before | After | Acceptance |
|---|---|---|---|
| Human proxy, Pro gold: PERFECT share of gold chances | — (no ring) | **39.7%** [36.7–42.7] (slings 41.8%, moves 39.1%; 10.3 chances a game) | 25–45% |
| … completion | 66.7% | **72.8%** [70.3–75.3] | 55–75% |
| … games reaching HEATING UP | — | **69%** [59–77] | ≥ 50% |
| … games ON FIRE | — | **24%** [17–33] | 20–45% (starting band) |
| … points a drive | 3.66 | 3.91 | — |
| … deep (20+) completion | 59.3% | **72.2%** | ≤ 50% (fitted in nfl-6: see "Left undone") |
| … yards a carry | 3.94 | **3.31** | (fitted in nfl-7) |
| Human Rookie / Legend: PERFECT, HEATING UP, ON FIRE | — | 40% / 78% / 29%; 38% / 48% / 14% | — |
| AI Pro gold: points a drive, completion, yards a carry | 3.50, 68.9%, 4.01 | 3.62, 69.8%, 3.84 | the AI's own play unchanged within noise |
| Gold window, ratings 40–110 × every difficulty × On Fire | — | half ≥ 30 ms, full ≤ 110 ms before ×1.25; 3+ steps at any 60 Hz phase | ✓ |
| Gold segment on screen (24 px sling ring, 22 px tackler ring) | — | **≥ 8 px** at 70 for every throw and wind-up; **95 vs 70 ≥ 1.4×** on every throw short of 20 air yards and every wind-up | ✓ |
| Gold never lies, 10,000 seeded centre releases each (`NFL_LONG=1`) | — | slings 10,000/10,000 caught, 0 INT; jukes/spins 10,000/10,000 tacklers on the turf for 0.8 s | 100% |

**Live (`scripts/qa/nfl-ring.mjs`, isolated, touch, A = 393×852 with insets 59/34, C = 320×568, both motion settings).** Touches go in through CDP with their own timestamps. The checks: the sling's gold ring on the reticle and a release on its centre judged PERFECT, with the PERFECT toast and the chime called exactly once; PERFECT pops (`v2-perfect-pop`) with motion and holds still under reduced motion; Heat 90 + PERFECT lights ON FIRE (the bug's flame, the hot bar, the next play's `fire`); amber off the man's path, red past the arm with RANGE on the toast; with every frame delayed 30 ms (one frame every ~47 ms), three releases near the centre judged as their touch timestamps say; a JUKE on a tackler's gold ring judged PERFECT, the chime called once and that tackler down and stunned; HEATING UP at 60 + 12; the final card shows the grade, and only the finished Progress carries it; no page errors and no non-local requests. Screenshots are in `O/shots/nfl/nfl-4/`.

**Tests added or changed.**
- `ring.test.ts` (new): the window property test (ratings 40–110, Rookie/Pro/Legend, On Fire on/off, 7 lengths, short and deep: ≥ 30 ms a side, ≤ 110 ms across before ×1.25; On Fire exactly ×1.25; deep narrower); judging at the touch's own time, with every window spanning 3+ steps at any 60 Hz phase, and the same touch through two anchors a delayed frame apart giving the same engine time; the on-screen segment (≥ 8 px at 70, ≥ 1.4× for 95 vs 70); **gold never lies** for slings and for jukes/spins (1,000 each in the ordinary suite, 10,000 with `NFL_LONG=1`), where every gold ring also re-checks every promise (catch radius, halo, arm, rush); gold is never offered amber or red (random spots, a forced rush, past the arm; red is RANGE and never PERFECT); a tap takes the good path; 95 vs 70 windows.
- `heat.test.ts` (new): every NFL value; HEATING UP at 66 and ON FIRE at 100; full while lit, put out by a loss; 3 snaps (4 with Heat Check) spent on the plays they line up; the bar empties after drive 2 (a kick, a punt; not in a one-drive drill); clean first downs per series; solo rival ends (−10 conceded; +15 for a punt, downs, a miss, a takeaway or a safety; nothing for the clock; a stop can light ON FIRE); the rival's bar from ends alone; identical Heat from identical seeded games, with the AI's own chances counted; the grade's letter against par and its determinism; FLAWLESS iff a win with 0 turnovers; the grade never on the wire, and `Football2` only ever sends `progress(g)` through `onProgress` (a source check), with the grade added in `onDone` alone.
- `feel.test.ts` (new): the 50 ms juke stop, every kind inside 33–120 ms, the 150 ms-a-second budget (cut to fit or skipped), 30 ms under reduced motion.
- `drive.test.ts`: the old three-completion On Fire test is removed. That behaviour is gone on purpose; Heat replaces it and `heat.test.ts` covers it. `ratings-matter.test.ts`: Heat Check now gives a fourth ON FIRE snap. `determinism.test.ts`: re-pinned, because the AI's own JUKE/SPIN meet the gold ring and its On Fire is Heat's (`9d4f17f7` / `d7536bc8`; before `f3099ed1` / `ade7aadc`).
- `sim-kit.ts` summary adds `perfectRate`, `perfectBy`, `ringsJudged`, `slingByDepth`, `chancesPerGame`, `heatingGames` and `fireGames`.

**Protocol bump needed: NFL draft 10→11, UT 11→12** (one row in the table at the top).

**Saves:** none. Heat, the grade's counts and the touch anchor live in the match only; `Progress.grade` is optional and never stored or sent.

## For the lead (found in nfl-1)

- **Integration checklist (nfl-2 review):** (1) wire `onQuit`/`quitText` (C4) in App's draft `<Arcade>` and ut's `Match.tsx` before ship: today QUIT exists only in the `?arcade` lab, so D-5 quit is not yet reachable by players; (2) the AI quarterback's 0.8 yd step-up (nfl-5), the online takeover deadline on the pause menu (nfl-9) and the controls diagram stay deferred (see "Deferred and rejected").

- **QA isolation:** under `?ns=inspect` the app and the shared `scripts/qa/browser.mjs` fixture still call the live `player-save` and `card-registry` functions (aborted here by `nfl-guard.cjs`). Every team's legacy QA should run behind a route-abort, and `ns=inspect` should probably disable cloud saves and registry writes in the app itself (`src/lib/cloud-save.ts`, `src/ut/registry.ts`: lead-only paths).

## Owner device checks

- **nfl-4** The gold ring on the reticle while dragging: whether 24 px reads at arm's length, the closing outer ring, and letting go on gold for PERFECT · IN STRIDE.
- **nfl-4** The tackler's gold ring and a PERFECT JUKE: the 50 ms beat, the double buzz and the climbing chime (iOS Safari gives no web haptics; the double pattern only plays where `navigator.vibrate` exists).
- **nfl-4** Heat on the bug (both bars), HEATING UP and ON FIRE with the burning ball, and the grade line on the final card.
- **nfl-4** Touch timing on the device: a release on the ring's centre should feel exact. The device's own input lag comes in with nba's one-time calibration (`calibrationLag`, 0 until it lands).

- **nfl-3** The new camera on the owner's phone: the formation above the tray before the snap, the players' size (35 px quarterback), the pull-back on a deep throw and the push-in on contact.
- **nfl-3** The 124 px tray: three cards and a swipe into the book, the fourth-down [play] [FIELD GOAL] [PUNT] with A saying GO / KICK / PUNT, LAST PLAY in the header, and dragging the field to look around.
- **nfl-3** The score bug and Heat bar under the Dynamic Island, and the toast line's one-line results ("+7 YDS · TACKLED BY …").

- **nfl-2 review fixes** The back's name chip low on the left throws when touched (it is drawn over the stick zone), while the stick still answers everywhere else in the zone; with the Burst-button switch on, BURST stays on D through a run and DIVE/SLIDE shows on B near the sticks.
- **nfl-2** The floating stick under the left thumb, and burst by pushing past the ring (V2 lead decision 2: the "Burst button" switch under pause → Controls restores hold-BURST on D if the owner prefers it).
- **nfl-2** The A/B/C/D cluster's reach for the right thumb on the owner's phone, JUKE toward the stick or by a swipe off A, and DIVE/SLIDE showing on D only near the sticks.
- **nfl-2** Moving in the pocket and THROW AWAY outside the tackles; the name chips (tap = throw on touch-down) and the reticle.
- **nfl-2** Pause, and the automatic pause when the phone locks or the app goes to the background.

- The catch-and-run feel without touching the stick, and the HOLD TO RUN ghost while the ball is in the air (nfl-1).
- That a thumb resting on the stick through the throw never stops the catch, and that the first deliberate push takes the carrier at once (nfl-1).
- That a thumb put on the stick while the ball is in the air steers the catch at once in any direction, including toward the sideline (nfl-1 review fix).
- The HOLD TO RUN label's place above the stick on the owner's phone (it sits over the field's lower left; nfl-3 moves it into the toast line).

## Deferred and rejected

Copied from the plan (§9), each with its reason; cut-line items land here with the task that dropped them.

**Deferred**
- **nfl-4: deep completions.** The human proxy completes 72% of 20+ yard throws (59% before). Gold deep balls are rarer (×0.7 window, a 3.4 yd halo, no gold under any real rush), but the ring's information and its PERFECT catches lift the rest too. The plan fits deep completion to ≤ 50% in nfl-6, and that is where it belongs: the accuracy model by depth.
- **nfl-4: the human proxy's yards a carry** fell from 3.94 to 3.31. The proxy now spends its moves on the tacklers' rings (70% of the gold ones it's shown, pursuers included); the AI's carries are unchanged within noise. nfl-7 fits the run game and the move economy.
- **nfl-4: the AI's Heat in solo** scales nothing on defense yet. "Its On Fire scales its defenders' tackle-ring and pick odds ×1.25" needs the defensive rings of nfl-8. The AI already earns Heat by the same rules on its own drives (its PERFECTs come from its own move timing, not separate rolls), and its bar is shown from its ends.
- **nfl-4: hit-stop and real time.** The touch anchor maps real time to engine time 1:1, so a touch made during a hit-stop (≤ 90 ms) or slow motion is judged up to that much late. Rings never sit inside a stop in practice (a stop follows a PERFECT or a hit); nba's shared C17 can carry the time scale if it ever matters.
- **nfl-4: PAR** for the grade letter is provisional (Rookie 4.0, Pro 3.4, Legend 2.1), and so are the clean-first-down reading and the 25–45% band; nfl-10 fits them.
- **nfl-3: the far players' size.** The deepest defenders draw 11–12 px at 393 (the plan hoped for about 22). A flatter camera would shrink the near players below 34 or push the wideouts off the screen; players' LOD sprites (C14) and nfl-10's final camera fit can revisit it.
- **nfl-3: the kickoff copy's tie line.** "A tie goes to the better team" is still true; nfl-9 replaces it with the C2 overtime line when overtime lands.
- **nfl-3: the crowd-swell audio cues** (the plan's cut line) move to nfl-10's polish list.
- **nfl-3: frame pacing at 4× CPU** is at parity with the pre-task tree (about 52 fps, 20–30 frames over 33 ms in 15 s) and still short of the plan's ≤ 5; the floor's per-frame projection while the camera moves (`persp.ts drawFloor`, players' C14 request) and the sprite budget for sprites ≥ 28 px (players) are the remaining costs.
- **nfl-2: the AI quarterback's 0.8 yd step-up** against a free edge rusher. It changes every AI drive (the determinism pins, the fast/full baselines), so it moves to nfl-5 with the rest of the AI's football brain; the AI's old sideline bail throw stays with it until then.
- ~~**nfl-2: the legacy Codex QA scripts**~~ ported in the nfl-2 review fixes (`joystick.mjs`, `rushing.mjs`, `core-gameplay.mjs`; `clubhouse.mjs` and `polish.mjs` keep working through the tray's FLIP PLAY / FULL PLAYBOOK names).
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
