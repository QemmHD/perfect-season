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


## 90+ live issue stamp — Codex, 2026-10-30

[Numbered NBA gold card](serial-nba-live.png) · [Numbered NFL gold card](serial-nfl-live.png) · [NBA card detail](serial-detail-nba.png) · [NFL card detail](serial-detail-nfl.png). Actual localhost components and signed inspect-namespace fixture copies, not player accounts or simulated worldwide claims. Numbers reflect the isolated registry at capture time and subsequently change with registrations/disposals. The inset stamp shares the existing card frame palette and typeface. Reproduction and behavior: [CARD-CIRCULATION.md](../CARD-CIRCULATION.md).


## Pack cinema — Codex, 2026-10-30

[Sealed foil](pack-cinema-sealed.png) → [GOAT escalation](pack-cinema-shatter.png) → [GOAT card](pack-cinema-goat.png); [Spotlight entrance](pack-cinema-spotlight.png). These are actual localhost renders with the original stage, Archivo type, card art and simulated iPhone safe areas. The 8/20 copy stamp is a presentation-only fixture with mocked `packart` counts, never a deposited/minted card or a claim about global circulation.

The reveal includes charge/tear, opening doors, mystery card, position/team clues, procedural streaks, a GOAT-only limit break and the actual card's entrance. Stills cannot show all the motion; `scripts/qa/pack-cinema.mjs` records the first case to WebM (visual-only recording, no system audio). [Timing, sound, source connections and device verification limits](../PACK-CINEMA.md). No boosted odds or preview-only cheat UI is shipped.


## NFL rushing fix — Codex, 2026-10-30

[390px portrait](nfl-rushing-390.png) · [320px short portrait](nfl-rushing-320.png) · [844px landscape](nfl-rushing-844.png). Actual NFL component, manual forward-stick input after the handoff, equal real gold squads at Legend, isolated inspect profile. Juke/Spin/Power reuse the existing game-control skins; short portrait sizes leave the runner and blockers visible. Screenshots are rendered QA fixtures, not a real player account or a promise of a successful run. The controls/path fixes and complete fixed-seed measurements are documented in [NFL-RUSHING.md](../NFL-RUSHING.md).
