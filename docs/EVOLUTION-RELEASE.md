# Evolution release: Save Locker, Training Camp, Ultimate Team Rivals

This release extends the existing iPhone home-screen game. It preserves the existing profile keys, wallets, collections, card levels, packs, gift claims and player identity. New UT fields are optional; original saves receive no reset or forced onboarding.

## Original restore point

The exact original working source is preserved on GitHub at `backup/original-working-2026-10-28`, commit `7285ced3e66cb76c4a38d7bda134d6554fe04d33`. A ZIP and verified full-history Git bundle were also prepared in the review workspace. Source backups are separate from players' phone-local saves.

Development is isolated on `feature/season-evolution`. Opening a draft PR does not change the GitHub Pages deployment. The existing workflow deploys only pushes to main.

## Save Locker and solo continuation

- Home offers Continue for a saved solo draft, season or playoff run. Generated playoff brackets are retained. Starting a different solo draft asks before replacing an unfinished one.
- Checkpoints are per sport and include the scoring-data fingerprint. Incompatible checkpoints are not loaded into a different game model.
- Completed run IDs prevent normal reload/resume from paying the same run twice.
- Existing profile storage keys and profile version are unchanged. Save failures show a persistent warning with retry and backup actions.
- Settings → Save Locker exports a password-protected `.psbackup` file through the iOS share sheet or a browser download. It includes both sports, UT, gifts, favorites, player identity and compatible solo checkpoints. The password is not uploaded or saved. Admin session credentials are excluded. Active online session markers are cleared in backup copies to avoid replaying a stale forfeit after restore.
- AES-GCM encryption uses a fresh IV and PBKDF2-SHA256 with 210,000 iterations and a fresh salt. Restore unlocks and validates first, previews the player/cards/coins, and asks for explicit replacement before writing. A wrong password changes nothing.
- This is manual backup/transfer, not automatic cloud synchronization. Online matches retain the existing disconnect and forfeit rules.

## Training Camp

Home → Training Camp opens three drills per sport, each with ten attempts, a controls briefing, defensive pressure choices, immediate feedback, retry and personal bests. Players can use the camp squad or their owned UT starters.

Basketball: Green Machine (shooting), Above the Rim (finishing), Read & React (pass before scoring). Football: Pocket Poetry (passing), Breakaway (running), Ice in Your Veins (kicking).

Drills use the production Hoops2/Football2 engines through optional practice configuration. Normal matches receive no practice configuration. Practice awards no coins, card XP, ranked wins or daily paid games. The football first-games hint counter is unchanged by practice.

The visual treatment uses the existing Archivo type, teal/gold palette, ArenaHero renderer and button style. New symbols are SVGs to avoid unsupported font glyphs on phones. Promotion/reward motion respects reduced-motion settings through the existing confetti and new CSS rules.

## Ultimate Team Rivals

UT Home → Rivals adds five divisions: Rookie (0 RP), Pro (90), All-Star (210), Elite (390), Legend (600). Eligible real-opponent UT wins give 30 RP; losses deduct 12, with a floor of zero. The existing UT queue and squad-overall matching are reused. AI fallback never earns Rivals progress.

The weekly reward track requires both the division's RP threshold and 3/3/5/8/12 wins. Rewards are respectively Bronze/Silver/Gold/Gold/Premium packs plus 50/100/150/250/400 coins. Each reward is claimed once per sport/week. Unclaimed earned rewards survive weekly reset. The UI shows current points, next division, season best, win/loss record, rewards and an additive weekly relay leaderboard. Promotions trigger a dedicated reveal.

The protocol, queue identifiers, existing leaderboard payloads and scoring data version are unchanged. Rivals uses separate namespaced replaceable Nostr events. Latest local Rivals entries are retried on connection/resume. Match IDs deduplicate normal settlement. As with existing client-owned records, signed messages establish identity, not server-authoritative anti-cheat.

## Validation and remaining release checks

Automated coverage includes original-save round trips, encrypted backup round trips and wrong-password rejection, solo checkpoint round trips, unchanged old UT migration, duplicate match/reward prevention, AI exclusion, promotion/demotion, weekly rollover, and namespaced leaderboard filtering.

Chromium browser checks use copied/local test profiles, a test namespace and a localhost relay override. They exercise draft → reload → identical resume, manual shot input, ten-attempt NBA and NFL drill completion, starter packs, Rivals rewards, encrypted file download and restore preview. Preview leaderboard standings use a local fixture, not live-player data.

Before promoting this draft to the live game, verify on actual installed iPhones: portrait and landscape controls, Safari share-to-Files backup and restore, screen lock/background/reload, and a two-phone online match/rematch. Chromium and protocol tests do not substitute for those device checks. No original player accounts or live player data were modified during development.

Final automated results: NBA invocation 221 tests passed (30 skipped); NFL invocation 189 passed (61 skipped). TypeScript checking, production build, and whitespace checks passed. Shared tests execute in both invocations, so these are execution counts, not unique-test counts. The production build retains the pre-existing large-chunk warning. A separate pull-request-only review workflow tests/builds proposed changes without deploying them.
