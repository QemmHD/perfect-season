# Decisions
- No account reset; displayed OVR/tier may change; New Era bundle (Legend pick ≥ scale-88 + 65k coins) once for pre-update players.
- SPOTLIGHT_RATES (server contract) unchanged; new packs open locally.
- Test page builds with `vite build --mode testpage` (Spotlight rolls locally there only).
- Don't ship EA FC ratings for soccer; own ratings model. 2K/Madden refs for NBA/NFL follow existing precedent (risk noted).
- Rating changes split UT online queue automatically via pool.print; engine rule changes need DRAFT_RULES/UT_RULES bumps.
- Do not regenerate numbered-eligibility files.
- Decision: Spotlight/GOAT stay above 99 (registered numbered ultra-rares). New Era 65k coins honored as owner asked even though it's large vs our 60/30 economy.
- Content calendar decisions (mine): rename "Summer League" → "Summer Run", "All-Star Break" → "Midseason Stars" (avoid league marks); Finale 99 SBC-only (no pack slot); card pool frozen for year one (no new-season card data rebuild → no extra queue splits).
- Tests can time out under machine load (vitest 5s default) — agents raised timeouts in pool-loading tests; final QA run should be with fewer agents running.
