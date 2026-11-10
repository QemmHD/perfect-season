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
