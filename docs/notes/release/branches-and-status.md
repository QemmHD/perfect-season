# Branches and status: the 2026-11-01 season update

How the season update was split across branches and merged into `feature/season-evolution` (PR #1), in landing order. Commit hashes are the heads at the time. Update this file as branches land; the authoritative record of each change is [`docs/CODEX-UPDATE-LOG.md`](../../CODEX-UPDATE-LOG.md).

| Order | Work | Branch | State (as of the last update here) |
|---|---|---|---|
| 1 | Ratings rework (FC-style display scale, `ut-scale.ts`, NBA six-category card face) | `feature/season-evolution` | Landed: 955f17d, merge d64921c |
| 2 | Expanded 2K/Madden references, season-matched | `claude/ratings-refs` | Landed with 1 (cd99759). NBA same-season coverage 44% → 55% (modern 96%), NFL 7% → 63% (modern 99%) |
| 3 | UT content waves 1–3 (16 features, FC 27 mechanics, Live Calendar) | `claude/ut-content` | Landed: feature fast-forwarded to 09691e8 (frozen live editions, prices retuned to 48–60% EV). Tests NBA 415 / NFL 382 |
| 4 | Gameplay: every rating matters, juice, animation | `claude/gameplay` | Landed: 713c63f. Tests NBA 439 / NFL 406 |
| 5 | UI reorganisation | `claude/ui-reorg` | Landed: eb68508. QA 204 screens + WebKit 44 |
| 6 | Soccer data, engine and app wiring | `claude/soccer-data` | Landed: ea85989 (pushed; CI green). Tests NBA 481 / NFL 448 / soccer 53 |
| 7 | README, screenshots, docs index, these notes | `claude/readme` | This branch |
| 8 | Balance tuning follow-up | `claude/gameplay` (base 713c63f) | In progress; must merge ea85989 before landing |

Rollback point: branch `backup/pre-new-era-2026-11-01` = `main` at 7285ced.

## Details worth keeping

- **Soccer data (P1):** 29,822 season cards and 132 legends, about 1.3 MB gzipped, all lazy-loaded.
- **Soccer engine (P2):** `src/game/soccer2`, dev lab `?soccer-lab` (dropped from production builds), QA `scripts/qa/soccer-lab.mjs`. Set pieces were generous at first (corners/free kicks ~30%, penalties 79%): a tuning candidate.
- **Ratings rework:** shown 90+ cards: NBA 14 (top 91), NFL 25; Hot Season 94–97; Legends 88–95; level 5 adds +2 overall. Bronze/Silver/Gold split about 35/35/30%. NFL speeds from Combine data (`nfl-combine.ts`).
- **Ratings refs:** Mahomes 2024 83 → 94; NFL level-1 99s 98 → 76. The NFL refs file is 2.55 MB (402 KB gzipped). The older `build_season_references.py` has a known `date` shadowing bug (not fixed).
- **Content waves 2–3, not built yet:** calendar-driven pass tiers, season objectives/Path/check-in, Live Events/Moments/Circuit themes, flash windows, a Gallery programs tab.
- **Gameplay, deferred:** NFL 90-vs-75 win rate 99% and NBA 89% (target 70–80%); the NBA AI still prefers contested jumpers over rim attacks; no new mocap dunk clips.
- **UI reorg, open items:** at 320 px wide a 44 design-px target is about 36 real px; tab memory; collection milestones not in the Rewards inbox; long surnames ellipsis.
- **Soccer, hidden for now:** Club Season, Legends Events, Moments, Spotlight/GOAT/serials, Landmarks, Live Calendar, Training Camp. The build uses a 4 GB heap and an es2022 target (top-level await).
