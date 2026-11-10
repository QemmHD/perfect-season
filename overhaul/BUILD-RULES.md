# Studio overhaul: build rules (every build agent reads this and BRIEF.md first)

`O` below means `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul`.

## Seven teams in parallel

Seven build teams work at the same time. Each has its own git worktree and branch, cut from `claude/studio-overhaul` = live main `acdf3e2`. The lead (not you) merges the branches at the end.

| Team | Worktree | Branch | Dev-server port | Brief |
|---|---|---|---|---|
| shell | /home/user/ps-s-shell | claude/studio-shell | 5211 | `O/STREAM-shell.md` |
| ut | /home/user/ps-s-ut | claude/studio-ut | 5212 | `O/STREAM-ut.md` |
| packs | /home/user/ps-s-packs | claude/studio-packs | 5213 | `O/STREAM-packs.md` |
| players | /home/user/ps-s-players | claude/studio-players | 5214 | `O/STREAM-players.md` |
| nba | /home/user/ps-s-nba | claude/studio-nba | 5215 | `O/STREAM-nba.md` |
| nfl | /home/user/ps-s-nfl | claude/studio-nfl | 5216 | `O/STREAM-nfl.md` |
| soccer | /home/user/ps-s-soccer | claude/studio-soccer | 5217 | `O/STREAM-soccer.md` |

### Staying in your lane

- Work only in your own worktree. Never touch another team's worktree, and never merge another team's branch.
- **File ownership** is in `O/OWNERSHIP.md`. Edit only files your team owns. When you truly need a small hook in someone else's file (a prop, an import, one call), keep it to a few lines, never reformat the file, and list it under "Touched outside my lane" in your team doc.
- **Shared big files** (`src/styles.css`, `src/App.tsx`, `src/ui/Pages.tsx`, `src/game/Arcade.tsx`, `src/game/difficulty.ts`, `src/ut/Match.tsx`) are edited by several teams.
  - Keep each hunk small and local.
  - Put new CSS in a NEW file your team owns, imported from your own component, rather than growing `styles.css`.
  - Never run a formatter over a whole file.
  - Never reorder imports or blocks you didn't change.

## The machine is shared (4 CPUs, 15 GB RAM)

- **The semaphore.** Every heavy command goes through it: `tsc`, `vitest`, `vite build`, Playwright/Chromium runs, and long `vite-node` simulations. Usage:
  `bash O/heavy.sh npm run typecheck`
  `bash O/heavy.sh npx vitest run src/game/hoops2`
  It waits for one of 3 machine-wide slots.
- **Test only your area while you work:**
  - NBA (default sport): `npx vitest run <paths>`
  - NFL: `PS_SPORT=nfl npx vitest run <paths>`
  - Soccer: `PS_SPORT=soccer npx vitest run soccer sport-branches`
  - Run the full `npm test` (slow, all three sports) only in your team's final QA task.
- **Dev server.** Start it with:
  `nohup npx vite --port <your port> --strictPort > /tmp/ps-<team>-vite.log 2>&1 & echo $! > /tmp/ps-<team>-vite.pid`
  Stop it with `kill $(cat /tmp/ps-<team>-vite.pid)`.
  - NEVER use `pkill -f` or `pgrep -f`: they match your own shell and kill it.
  - Only one dev server per team. Stop it when you finish.
- **No full builds.** Don't run `npm run build` except in the final QA task, and then once, via heavy.sh.

## Never break these (on top of BRIEF.md's hard constraints)

- **Saves.** Never change a storage key, a card/edition/copy id, or the meaning of saved fields.
  - New state is optional and additive, with defaults for old saves.
  - Old saves must load and keep every coin, card, level, XP, squad, streak and progress.
  - If you add saved state, add a test that loads an old-shape save.
- **Online protocol versions belong to the lead.** Do NOT edit `DRAFT_RULES` (`src/net/match.ts:21`) or `UT_RULES` (`src/ut/Match.tsx:110`). If your change alters how a match plays or comes out (physics, rules, ratings used in matches, how a UT match result is decided), write "Protocol bump needed: <sport> draft/UT, because …" in your team doc. The lead bumps each sport once at integration.
  - Current versions: draft NBA 10 / NFL 10 / soccer 2; UT NBA 10 / NFL 11 / soccer 2.
- **Live services.** Never write to the live Supabase registry or saves, live Nostr relays, or leaderboards.
  - Browser QA always opens `?ns=inspect&relay=ws://localhost:7777`.
  - Playwright contexts must `context.route('**/*', …)` and abort every request whose host isn't localhost/127.0.0.1, except fonts.googleapis.com and fonts.gstatic.com.
  - `O/audit-scripts/utui/lib.mjs` has a working harness (insets, fixture, isolation): copy from it.
  - Never run admin or registry scripts against live hosts.
- **Determinism.** The engines are seeded and deterministic, because both phones replay the same match. Never use `Math.random()` or `Date.now()` inside simulation code; use the engine's seeded RNG. Rendering-only randomness is fine.
- **Sport branches.** Use `pick({ nba, nfl, soccer })` / `pickFor(sport, …)`. Never write a two-way `x ? nba : nfl` (`src/engine/sport-branches.test.ts` enforces this).
- **Layout.**
  - 390 design-px frame; no width media queries inside screens.
  - Taps ≥ 44 design px.
  - `prefers-reduced-motion` respected.
  - SVG for symbols, not unusual Unicode glyphs.
  - Text ≥ 10 design px for anything a player must read.
- **Original branding.** No EA/2K/Konami names, logos, music or art. Real player names and stats stay. The owner decided to KEEP all current mode names: never rename a mode.
- **Size and laziness.** No heavy dependencies and no large raster images; use canvas/SVG/CSS. Soccer, admin and the game screens stay lazy-loaded. Appearance data must load lazily with the game or UT chunk, not the first-paint bundle.
- **Secrets and privacy.** No secrets or email addresses anywhere. Never print or commit env secrets.

## Git

- Commit after every task, with focused commits, and stage explicit paths (never `git add -A` / `git add .`).
- Message format:
  ```
  Claude: <what changed, plain words>

  <why / what was measured>

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011urYpz1EMtNjEmc3DMeH4r
  ```
- No model names in commits, code or docs.
- After each commit, push: `git push -u origin claude/studio-<team>`. On a network error retry up to 4 times (2 s, 4 s, 8 s, 16 s).
- Never push to `main`, never force-push, never rebase, and never use bare `git stash`.

## Quality bar

The owner wants "production studio quality" that "plays like the respected sports games" and is fit for mobile thumbs.

- **Measure before and after** with real numbers, using the audit's scripts in `O/audit-scripts/` where they apply.
- **Check in a real browser** (Playwright, touch, `deviceScaleFactor: 1` for your own checks) at 393×852 with iPhone insets 59/34 (the owner's phone) and at 320×568.
- **Own UI work:** screenshot it and look at the images yourself.
- **Keep what the audits list under "what works well".**

## Your team doc

Write and keep updating `docs/studio-overhaul/<team>.md` in your worktree. It holds:
- what changed and why, with before/after measurements;
- tests added;
- "Protocol bump needed" lines;
- "Touched outside my lane";
- "Owner device checks" (things only a real iPhone can confirm);
- anything left undone, and why.

You may also update your area's existing doc in `docs/`.
