# Owner instructions (2026-11-01 season update)

What the owner asked for during the overnight "New Era" season update, in his intent, oldest first. Later sections record how each was answered ([decisions](../decisions/decisions.md), [release status](../release/branches-and-status.md)).

## Ground rules

- Start from Codex's `feature/season-evolution` work: inspect it, fix bugs.
- **Never lose player progress:** accounts, coins, cards, serial numbers, levels and squads are preserved. No storage-key changes. Keep Nostr and Supabase as they are. No "download a backup file" workflow.
- Full control over the design, and earlier rules may be overridden if that truly improves the game, but progress is never lost.
- Everything must work: no bugs or errors, and scaling and UI must be right on every phone.

## Scope

- Deep research: many websites, GitHub repos and tools, with licences checked and refined, not just a couple of sources. Every implementing pass should keep researching as it builds.
- Organise the UI like a real game app.
- 10+ new features, 5+ new packs and 2 promos.
- Balance overalls and pack weights. Learn pack pricing in full detail; be exhaustive.
- Rework Ultimate Team ratings to feel like real Ultimate Team. Model the overall scale on how EA FC 27 really progresses (launch starters, good golds, icons, then the promo ladder through the year). The owner's own numbers (starters 80–87, good 88–92, icons 87–96 at launch) were a rough guess: use the researched FC 27 numbers instead.
- Pull ratings from the real games (NBA 2K, Madden); the rating year must match the card's season.
- Ratings must matter in gameplay and be balanced. Use NBA 2K, Madden and EA FC as references for animation and how the game plays; the art may change. Make the gameplay enjoyable, with wow factor.
- Soccer as a third sport, after the rest, with accurate data.
- Months of content, planned in detail (a 12-month live calendar).

## Compensation

- If accounts ever had to be reset, existing players would get compensation: an Icon pick (88+) and an extra 65,000 coins.
- Preferred plan, adopted: **no reset** (all cards, coins and levels stay; only displayed ratings change), and existing players still get a one-time **New Era** thank-you bundle: an Icon (Legend) pick at the 88 equivalent or better on the new scale, plus 65,000 coins, exactly once, under a stable claim ID. See `src/ut/new-era.ts`.

## Shipping

- Authorised by the owner: push to `main` and the live GitHub Pages site once the work is complete, perfected and verified.
- Before shipping: full tests in every sport, typecheck, build, browser QA including WebKit, save-migration checks with real-shaped old profiles, a rollback point (branch of the current `main`), and an updated owner test page.

## Housekeeping

- Keep the owner informed (see [tell-owner](tell-owner.md)).
- Keep files clean, make the GitHub repo look like an App Store listing, and keep categorised notes (this folder).
