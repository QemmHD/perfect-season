# Ship checklist: season update to `main` / GitHub Pages

Tick items in the PR or a follow-up commit; leave this list as the template for the next release.

- [ ] All branches merged into `feature/season-evolution`, conflicts resolved
- [ ] `npm run typecheck` · `npm test` (NBA, NFL and soccer) · `npm run build` · `npm run audit:ratings`
- [ ] Codex QA scripts (league-season, ui-consistency, play-tab, content, clubhouse …) and the new QA scripts (ut-content, ui-reorg, soccer-app) pass
- [ ] Browser QA at 390 and 320 wide, every sport, plus WebKit; zero page errors; screenshots reviewed
- [ ] Old-save migration tests with real-shaped profiles: cards, coins, levels and serials preserved; New Era granted exactly once
- [ ] Online queue / protocol bumps documented
- [x] Rollback point: `backup/pre-new-era-2026-11-01` = `main` at 7285ced
- [ ] README in App Store style, `docs/notes/`, and a Claude section in `CODEX-UPDATE-LOG.md`
- [ ] Merge PR #1 → `main` (owner authorised); the Pages deploy workflow is green; the live site loads
- [ ] Republish the owner test page; tell the owner the Sites preview needs a Codex redeploy
- [ ] Clean up worktrees and scratch branches
