# Resume the studio overhaul (paused 2026-11-10 ~01:00 UTC for the owner's usage reset)

## State at pause
- Live: main `acdf3e2` (unchanged). Nothing from the overhaul is live yet.
- Seven teams. Each has a worktree `/home/user/ps-s-<team>` on branch `claude/studio-<team>` (cut from acdf3e2, pushed). Teams: shell, ut, packs, players, nba, nfl, soccer.
- Every team finished planning: a 10-task plan in `docs/studio-overhaul/<team>-plan.md`, critiqued and revised.
- Every team was partway through task 1. That uncommitted work stays in each worktree and is also pushed as a snapshot commit on `wip/studio-<team>`, whose parent is the branch head.
- Briefs, research, audits, the build script, notes and the NFL owner SQL are pushed on `wip/studio-briefs`. Scratchpad copies: `scratchpad/overhaul/`, `scratchpad/notes/`.
- Owner decisions are in the "OWNER DECISIONS" section of `overhaul/BRIEF.md`: keep mode names; defense by default; 4–6 min solo games; realistic pack odds with protection; re-rate accurately; ship the iPhone fix early; everything else straight to live.
- The 3 throwaway NBA test cards are retired. The NFL throwaway copies wait on the owner running `retire-qa/owner-query.sql`.

## How to resume
1. **If the worktrees exist:** check `git -C /home/user/ps-s-<team> status` and HEAD against `origin/claude/studio-<team>`.
   **If the container was reclaimed:**
   - Clone the repo, run `git worktree add -b claude/studio-<team> /home/user/ps-s-<team> origin/claude/studio-<team>`, then `git -C ... checkout wip/studio-<team> -- .` and `git reset` to restore the uncommitted work.
   - Restore the scratchpad overhaul files from `wip/studio-briefs`.
   - Recreate node_modules: `npm ci` in one place, symlinked into each worktree; `/node_modules` goes in `.git/info/exclude`.
2. **Relaunch each team.** Use `Workflow({scriptPath: <studio-build-team script>, resumeFromRunId: <run id>, args: {team}})`. Its implPrompt RESTART NOTE tells task 1 to finish the in-progress work.
   - Run ids: shell wf_8617583a-802, players wf_04ce9c4b-2f3, packs wf_7ba39aa3-7c2, ut wf_2e8761ad-4e7, nba wf_23927f4f-6b8, nfl wf_f9e0b686-033, soccer wf_fe10e410-1c3.
   - Script: `/root/.claude/projects/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/workflows/scripts/studio-build-team-wf_8617583a-802.js`. A copy is in `wip/studio-briefs:workflow/`.
   - If the journals are gone, a fresh run with the same script will re-plan. To avoid that, give the planner the existing plan file and tell it to return that plan unchanged.
3. **Re-arm the early-ship watch.** The iPhone fix is shell-2 (Fix A + D + M1) plus shell-3 (Fix B + header plates + H1). When both pass review, cherry-pick them to main, push, and check Pages `version.json`.
4. **Then:** integrate all branches into `claude/studio-overhaul`, bump `DRAFT_RULES`/`UT_RULES` once per sport as the team docs request, run the cross-team review and full QA, ship to main and Pages, and send the owner patch notes.
- 2026-11-10 pause: wip/studio-briefs @0d891f2 also holds journals/<run id>/journal.jsonl (copy back to /root/.claude/projects/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/subagents/workflows/<run id>/ to keep cached resume) and audit-script data. Audit screenshots (790 MB) were not pushed; regenerate them with the scripts if needed.

## 2026-11-16 19:20 — early ship in progress
- shell-3 re-review PASS (lows only: old-Safari <15.4 fallback strip; 60-120ms seam during Home->Draft transition; :has() cost unconfirmed on loaded machine). Ship branch claude/studio-shell-edge @ 6a8e772 (FF of main acdf3e2).
- Lead verifying in /home/user/ps-ship (typecheck/test/build + own screenshots), then: backup/pre-studio=acdf3e2, push main, poll version.json.
- INTEGRATION TODO: pre-existing Squad tap blocker (SquadView.tsx:235 DETAILS chip -> close(after) never unmounts picker; invisible scrim swallows taps). One-line fix `onInspect={(uid)=>{setPick(null);props.onInspect(uid)}}` + `.scrim.closing{pointer-events:none}`. Confirm ut team fixed it; else lead fixes at integration.
- INTEGRATION TODO: overlays over header screens must keep classes .champ .cast .ut-pick-screen .promotion .sportfade; new overlays need adding to plates.css transparent rule.
- 19:40 SHIPPED early iPhone fix: main = 6a8e772 (FF from acdf3e2), Pages version 20261116.1940-6a8e772 verified live (plate y0 h59, 0 page errors). Rollback branch backup/pre-studio = acdf3e2. Integration base is now 6a8e772 (studio-shell already contains it).
- INTEGRATION TODO: PERFECT SEASON wordmark wraps mid-word at 320x568 ("PERFEC/T SEASO/N") — pre-existing on acdf3e2 too; shell/ut must fix.
- INTEGRATION TODO: CODEX-UPDATE-LOG entry for the early ship (lead-only doc), add with the big release.

## 2026-11-16 20:05 — OWNER DECISION: SHIP IN WAVES (replaces "one release")
- Owner: "Youre taking way too long" -> chose "Ship in waves". Teams keep running; each finished+verified batch ships.
- Wave 1 integration agent launched (background): worktree /home/user/ps-wave1, branch claude/studio-wave1 from main 6a8e772; merges all 7 team tips, bumps protocols per changed sport, fixes Squad tap blocker + 320 wordmark wrap, full QA, update log. Does NOT push main — lead ships after report.
- Next waves: re-merge team tips onto main; any further engine change = another per-sport protocol bump.
- Container restart #2 (after 21:xx): Wave 1 agent resumed via SendMessage (its id is in this session). Teams relaunched with resumeFromRunId; args {team} for shell, {team, redesign:true} for the other 6. New task ids: shell w193b3j86, players wvxomx2xc, packs w4ngpdcx5, ut wsfa4gdr1, nba whp1y5d5j, nfl w32ys8m27, soccer wrbtmq9v2.
- 22:59 SHIPPED WAVE 1: main = 2598bf3 (FF from 6a8e772), Pages 20261116.2259-2598bf3, live smoke 3 sports 0 errors. Protocols now DRAFT nba11/nfl11/soccer3, UT nba11/nfl12/soccer3. Rollbacks: 6a8e772 (iPhone fix only), backup/pre-studio=acdf3e2.
- Wave 1 merged team SHAs: shell 856aee6, players 5b74686, packs 651b0cc (packs-3 5defa22 reverted), ut d16d94e, nba 64761f3, nfl 3c4c2e6, soccer 3762287 (+ lead fixes). Wave 2 must re-merge team tips onto main; packs-3 (+fix c99de81) comes back in wave 2 after review; any further engine change = another per-sport bump.
- Open for wave 2: soccer 4x-CPU perf (far-player LOD: 8 facings / every 3rd frame) -> soccer team; three different pause sheets -> unify; soccer corner framing at 320; HEAD TO HEAD clip w/o web font.
- Container restart #3 (2026-11-17): teams snapshotted to wip/* and relaunched: shell ws55nujrc, players wv6wlzs0j, packs w8ou9k80b, ut wxg2q5srs, nba wsyw6nteg, nfl wdku17c5q, soccer wp1mccdts.

## 2026-11-17 ~05:00 — PAUSED SAFELY at owner request
- All 7 team workflows stopped (shell, packs, ut, nfl stopped mid-task early; nba after t3 re-review [verdict fix: 1 medium left]; players after t5 build; soccer after t4 fix). Wave 2 check-in trigger deleted. Leftover dev servers killed; reviewer worktrees removed.
- Every worktree snapshotted to wip/studio-<team>; team branches pushed. Live main = Wave 1 2598bf3.
- TO RESUME: relaunch each team with Workflow({scriptPath: studio-build-team script, resumeFromRunId, args:{team} for shell / {team, redesign:true} for others}) — run ids in summary list. RESTART NOTE handles in-progress files. Then re-arm the Wave 2 check-in.
