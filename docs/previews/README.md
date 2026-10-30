# Codex visual QA previews

Implemented by Codex, 2026-10-29. These show the real card/reveal components in isolated localhost QA profiles, inside the existing game stage and typography. **The displayed #8 / 20 is a visual fixture, not an actual registered pull or live global count.**

- [GOAT reveal](goat-reveal.png): black/gold foil, the shared crown mark, player/overall and copy stamp.
- [Spotlight reveal](spotlight-reveal.png): violet/teal foil and coordinated lighting.

Reproduce normal and reduced motion with [the reveal QA script](../../scripts/qa/reveal.mjs). The full sequence includes pack tear, prologue, position, franchise, card entrance and serial stamp; a still image captures only one stage. [UI rules and connections](../UT-CONTENT-UPDATE.md#card-art-and-special-pack-motion).

The GOAT/Spotlight stills were refreshed after the all-tier rating correction; Jordan's 1989 shooting weakness is visible instead of a universal 100 floor. [Cloud Save](cloud-save.png) shows the new automatic-server-save sheet from an isolated QA identity, replacing the old file-backup UI. None of these previews shows a real player's save.


## Codex gameplay revision — 2026-10-30

Actual localhost rendered match captures with isolated rated test squads at Legend defense. They are gameplay verification artifacts, not proposed mockups or real player accounts.

- [NBA release](gameplay-nba-release.png) and [NBA action](gameplay-nba-action.png), 390×844.
- [NFL aiming](gameplay-nfl-aim.png) and [NFL action](gameplay-nfl-action.png), 390×844.
- [NBA small portrait](gameplay-nba-320.png), 320×568, and [NFL landscape](gameplay-nfl-landscape.png), 844×390.

Source: `scripts/qa/gameplay.mjs`. Full sources, behavior changes, balance diagnostics and verification limits: [GAMEPLAY-RESEARCH.md](../GAMEPLAY-RESEARCH.md).
