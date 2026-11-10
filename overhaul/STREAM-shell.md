# Team shell: iPhone fit, app shell, loading, offline, performance

Worktree `/home/user/ps-s-shell`, branch `claude/studio-shell`, port 5211. Read `BRIEF.md`, `BUILD-RULES.md` and `OWNERSHIP.md` (all in `O`) first.

## Why

The owner says: "ui still doesnt scale fully to iphone the top part gets blurred around the dynamic island and cuts some things off you can see from ss … make sure the games loads runs … all menus work and taps and movements all work good".

Their screenshot is at `O/owner-iphone-home.jpg`.

## Sources (read them)

- **`O/audit-ut-ui.md` §1** (root cause and exact fix of the iPhone header blur):
  - C1, H1, M1, M6, M8, M9, L items
  - §4 screen notes
  - §6 what to preserve
  - its scripts in `O/audit-scripts/utui/` (`edge.mjs` simulates the iOS 26 blur zone; `lib.mjs` is the isolated harness)
- **`O/audit-likeness-animation-perf.md` Part 3** (P-1 … P-5, loading and runtime performance; measurements in §3.1)
- **`O/research-likeness-animation.md`:** responsiveness (input to visible change ≤ 100 ms)
- **Existing docs:** `docs/OVERHAUL-SCREEN-FIT.md`, `docs/OVERHAUL-PERFORMANCE.md`, `docs/BROWSER-QA.md`
- **CLAUDE.md:** the history of the iOS standalone height bug (`index.html` inline rule ~lines 41-44)

## Scope

### P0: the iPhone top edge (C1), first and perfect

1. **Fix A.** Edge clearance in `stage-layout.ts`/`stage.tsx` (`--sat` = inset + edge; a new `--inset-top`), plus the `.arcade-full` `--sat`.
   - Keep the `stage-layout` tests' meaning: `sat` stays the raw inset; add tests for `edge`.
   - Watch the 393×852 `fit` threshold margin the audit flags. Compute `fit` so the class doesn't flip.
2. **Fix B.** A fixed `status-plate` element outside the transformed stage.
3. **Fix C.** Real header plates: a solid surface from y=0 under every top bar, with a hairline.
   - Covers the main TopBar, UT `.ut-top`, sub-page headers, game HUD score bugs, toasts and the pack SKIP.
   - Make them look premium (subtle gradient/noise, depth, crisp edge), not a flat grey strip.
4. **Fix D.** Hygiene: the stale `index.html` comment, `viewportInfo()` showing `edge`, a `screen-fit.mjs` assertion that the topmost control is at y ≥ sat+edge, and a QA override for `.arcade-full` insets.
5. **Verify** every screen of all three sports at 393×852 (59/34), 430×932, 390×844 (47/34) and 375×667 (20/0) using `edge.mjs`'s simulated blur band.
   - No text or control may start inside the band.
   - Nothing may be cut off at the bottom (PLAY bar, tab bar, home indicator).
   - Save before/after contact sheets to `O/shots/shell/`.

### P0: other fit and tap bugs

- **H1:** the card-detail sticky action bar floats 34 pt above the sheet bottom.
- **M1:** the NBA/NFL Home hint line under the PLAY bar shadow; Soccer Home's dead gap.
- **M6:** remaining small targets (draft respins 38, boosters 40, pack SKIP 65×36, season chip 141×41).
- **M9:** the black arena loading gap of about 1.2 s. Show a branded loading state: matchup, team colours, a tip, a progress shimmer.
- **M8:** RESET PROGRESS sits one confirm away. Make it a real danger zone, styled apart, with type-to-confirm. It protects saves.

### P0: loading, offline, performance

- **P-1:** opening UT takes 7.4–9.0 s at 4× CPU, with long tasks up to 669 ms and 41–57 MB retained.
  - Profile it, then cut the work: lazy and indexed card pools, chunked or idle-time parsing, no full-pool scans on first paint, memoisation, a skeleton UI while loading.
  - Target under 2.5 s at 4× CPU and no long task over 200 ms.
- **P-2:** UT is unavailable offline, while the precache spends 3.2 MB on files that don't help.
  - Make UT work offline for any sport opened before, with a sensible precache per sport.
  - Fix the pre-existing bugs: "UT offline for a sport not opened online since the update shows the retry screen", and "an offline first visit to soccer shows a blank screen" (it should show a friendly offline state instead).
- **P-3:**
  - Drop the fixed splash floor of ≥1.15 s down to what's needed.
  - Stop the Google Fonts stylesheet blocking render (preload, `font-display: swap`, a fallback metric match).
  - Bring the offline relaunch from 3.9 s to under 1.5 s to Home.
- **P-4/P-5:** frame headroom, and bundle-shape quick wins that don't break lazy chunks.
- **General:**
  - Check every screen transition and tap for jank.
  - Keep the update flow (`src/lib/update.ts`) working: the home-screen app must still auto-update.

## Notes

- Changes to screen-fit and stage must keep the 390 frame model. No `screen.height` guesses and no width media queries.
- **Owner device checks to list in your doc:**
  - installed-app screenshots of Home and UT Home ("LEVEL N" as bright as "x/y XP")
  - Settings → diagnostics showing `safe 59/34 · edge 22`
  - whether Fix B turns the band into a flat colour
- No protocol bump is expected from this team.
