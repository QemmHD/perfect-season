# Ultimate Team clubhouse overhaul — Codex, 2026-10-30

**Implemented by Codex (OpenAI)** on `feature/season-evolution`. Verification/publication references are recorded in `CODEX-UPDATE-LOG.md` when complete. Main/Pages and the original restore source are not promoted. Pre-overhaul source restore: `backup/pre-ut-overhaul-2026-10-30` at `8e7773bc329cf9cdf10431bb95ec72a022a15603`.

## The connected experience

The original mode had packs, SBCs, collection, events, Squad Battles and real Nostr H2H. This revision connects those activities to repeatable goals and adds manually played content. It keeps the existing Archivo display type, teal/gold palette, foil cards, pixel athletes, bottom tabs and pack reveals. The new UI uses original SVG/CSS/canvas work and the game's existing assets; no EA/2K artwork or libraries are copied and no dependency is added.

- **Clubhouse / Play HQ:** one place to find Champions Circuit, Moments, Squad Battles, H2H, Division Rivals and the existing Spotlight series. The home shows the current free season, objective rewards, an unfinished Circuit and the current squad.
- **Free Season Pass:** 25 levels, 300 Season Points (SP) per level; 28-day periods anchored at October 26, 2026. There is no paid track. Rewards include coins and existing Bronze, Silver, Gold, Premium and Spotlight packs. Old earned levels remain claimable from the track selector. A new season starts its own SP counter; owned items and old claims remain.
- **Objectives:** three daily, three weekly and eight lifetime goals. Match, scoring, collection, pack, SBC, Moment, development and online-win progress connect to the original activities. Completed unclaimed older daily/weekly goals stay in **Saved**. Claim Ready processes actual eligible objectives once; it never unlocks an unearned goal.
- **Champions Circuit:** solo AI, six manually played matches per entry, three free entries per ISO week. Losses do not end an entry. Opponents strengthen each round; the finale uses Legend defense. Two/four/six-win milestones pay 150/350/750 coins plus Silver/Gold/Spotlight packs, once each week, deposited at settlement. Entries persist across reload. An unfinished previous-week entry remains playable before current-week entries open. Ending an entry retains earned prizes and uses that entry. It has no instant-Sim option.
- **Moments:** five NBA and five NFL scenarios, using the actual engines, difficulty, current owned squad and existing Practice attempt callbacks. NBA: shooting, finishing, passing, green releases and Legend conversion. NFL: rushing yardage, completions, field goals and Legend completions. Attempts are free. A whole attempt set must finish before its score is stored. First-clear rewards are claimable once; replays can improve best score. Leaving an incomplete try abandons that try without consuming cards or coins.
- **Development Lab:** enroll one owned copy in Breakout (3 played games/1 win, 200 card XP/150 SP), Captain (5/3, 350 XP/250 SP) or Ironman (6 games, 300 XP/200 SP). The exact UID must be in the played squad; Sim does not advance it. One program can be active and each copy can complete one program. Awards use the original XP thresholds and level-5/edition caps. Canceling a program leaves its card/earned XP; removing its card ends the unfinished enrollment. Search and Show More make large clubs selectable.
- **Saved lineups:** three named presets using existing owned UIDs. Loading validates positions, prevents one UID occupying multiple slots, and reuses duplicate-storage organization. Removed copies are pruned from presets. Saving/loading creates no card and spends no currency.
- **Club Records / card story:** retain original lifetime wins, losses and packs opened; new settlements populate the last 20 matches, recent form, and per-owned-copy squad appearances/wins. These are squad selections, including bench, not invented individual points/minutes. Detailed records begin with this update. Completed development is visible in card detail.

## Gameplay additions

**NBA:** SCREEN calls an eligible teammate to a real court landmark, where he plants in an original brace pose and then rolls. A stationary screen holds ground using existing strength/collision rules; defenders route around it. CUT sends the aimed teammate (or a suitable finisher) toward the rim, where the existing pass/lob system can find him. SPACE spreads teammates and suppresses automatic cuts briefly. A four-and-a-half-second call cooldown prevents repeated screen/cut spam; Space can cancel a call. Calls require the ball in hand and cannot interrupt a shot or finish. On-court guides and compact buttons communicate the movement. Calls do not change any attribute, shot probability, stun timer or possession length.

**NFL:** the pre-snap Full Playbook offers all eight existing passing concepts and Inside Zone, Power and Outside Zone. Flip Play mirrors the formation, routes, coverage landmarks, blocking assignments and run lane together; handoff/stretch logic and diagrams honor handedness. A live play cannot be flipped. Rush-only/throw-only Moments filter the playbook appropriately. Existing slingshot passing, rushing improvements, stamina, tackle resolution and move controls remain. The arrow uses SVG to avoid missing-font boxes.

Both engines are shared by draft and UT, so the new play calls also work in existing played draft matches. Default engine behavior stays on the existing path unless a new call/flip is made. Online remains Legend. Draft rules and UT queue rules are now **6 for both sports**; peers with older mechanics do not share the new queue. `DATA_V`, board history, signed identities and save keys are unchanged.

## Source and data connections

| Module | Responsibility / connection |
| --- | --- |
| `src/ut/hq-state.ts` | Optional `ClubHQ` data model and defensive normalization; finite counters, valid owned references, bounded histories; full-precision timestamps. |
| `src/ut/state.ts`, `storage.ts` | Additive `ut.hq` migration and pruning of preset/development references when a copy is removed. Original canonical `owned` inventory remains. |
| `src/ut/progression.ts` | Season calendar, reward definitions, objectives, idempotent activity journal, history and squad appearances; pure functions. |
| `src/ut/play.ts`, `Match.tsx` | Existing settlement plus SP, objectives, active development, Circuit and result receipts. Duplicate matches/stale Circuit rounds are rejected before base payments. |
| `src/ut/circuit.ts` | Free entries, deterministic AI opponents, six-round settlement and persistent per-week prize receipts. |
| `src/ut/moments.ts`, `Moments.tsx` | Scenario definitions, real engine attempt collection, best scores and first-clear claims. |
| `src/ut/club-management.ts` | Preset save/load and development enrollment/claim through original `awardXp`. |
| `src/ut/Clubhouse.tsx`, `Hub.tsx`, `clubhouse.css` | Dashboard, Play HQ, season/objective/Circuit/development/lineup/history surfaces. |
| `src/ut/UltimateTeam.tsx`, `promo.ts` | Navigation and existing profile updater; pack/SBC activity counted before legacy counters increment. Registered-pack receipt dedupe remains authoritative for its transaction. |
| `src/ut/PackArt.tsx` | Original foil wrapper extracted from Hub, re-exported for existing imports; reward screens reuse it. |
| `src/ut/SquadView.tsx`, `CardDetail.tsx` | Saved-lineup toolbar; copy-level appearance/win/program story. |
| `src/game/hoops2/` | Real coach-call movement, planted-screen collision/path reading, brace pose/court guides and matching controls. |
| `src/game/football2/` | Pre-snap mirror execution, complete playbook, mirrored diagrams and responsive sheet. |
| `src/game/Arcade.tsx` | Optional manual-only challenge entry, retaining normal draft/H2H vote and Sim paths. |
| `src/net/match.ts` | Matching mechanics revision; original leaderboard/data namespace retained. |

`ut.hq` stores totals, date/week counters, season SP/claims, objective/competition receipts, an activity journal, the last 20 match entries, owned-copy appearances, presets, active/completed development, Moment bests/claims and Circuit state. It lives in the existing profile v1. The existing encrypted server snapshot therefore includes it with no new account, table, backend deployment, or recovery flow. Cloud tests exercise the new state, not just old inventory.

Legacy lifetime totals are seeded from actual existing wins/losses, H2H record, packs and known SBC completions. The current match/pack/SBC is counted after that seed, avoiding double counts. No retrospective SP, fake match history, individual stats or per-card appearances are invented. Legacy collected editions qualify for the appropriate lifetime collection goals.

## Economy and preservation

- The existing wallet, account identity, card/edition IDs, canonical owned UIDs, mint serials, levels, XP, squads, collection, duplicate storage, entitlements, old records and original reward claims retain their meaning. There is no reset/mass card replacement or manual backup-file flow.
- Original base match coins/card XP retain the **eight paid games per Eastern day** cap. SP can be earned from the first **16 settled UT matches/day**: played 80 plus 30 for a win; eligible non-Circuit Sim 30 plus 10 for a win; real online adds 10. Later matches still count toward objectives/records. The separate Circuit milestones and earned objective/season/Moment rewards are explicit bonuses, not a change to base match pay.
- Rewards append stable pending-pack IDs and use the original Store/opening path. Claims mark their receipt in the same profile update that credits coins or appends a pack. Reload/repeat clicks do not re-award. Circuit prize receipts also survive a device date returning to a past week.
- Pack prices and published odds are unchanged. Earned Spotlight packs use the same registered pack request/retry/receipt flow; their GOAT chance remains **0.05%**. They never guarantee a GOAT or fabricate a serial. Existing guaranteed Spotlight event rewards keep their original separate definition.
- Existing Nostr matchmaking/leaderboards/gifts, Supabase card registry and encrypted save services are reused. No database migration or new service was needed.

## Verification and previews

Reproduce `npm test`, `npm run audit:ratings`, `npm run build`. `src/ut/overhaul.test.ts` checks legacy preservation, full-precision timestamps, duplicate/stale settlement, season/objective rollover, Circuit reward receipts, manual development, Moment completion, and removed-copy references. New engine tests cover real movement, cooldowns, screen approach/plant/roll, mirrored route/coverage assignments, snap lock and matched left/right handoffs. `cloud-data.test.ts` checks encrypted round-trip of the new state together with original copies.

`node scripts/qa/clubhouse.mjs` uses only isolated localhost/inspect profiles: both sports, home/Play HQ, saved lineup load, active development and Circuit reload, reward claims/reload, actual manual Moment attempts and first-clear UI, 11-play NFL book, mirrored run, Circuit manual-only launch, and 390/320/landscape captures. It separately labels fixture-seeded claim coverage; those seeds are confined to localhost QA, never product hooks. `scripts/qa/cloud.mjs` now restores presets/development/active Circuit from the real existing inspect server and checks normal conflict handling. `content.mjs` and `online.mjs` cover the prior pack/event/collection and two-client H2H systems.

See [actual rendered captures](previews/README.md) and [QA instructions](BROWSER-QA.md). Chromium input/layout tests do not claim a physical-iPhone playtest or commercial 2K/Madden parity. The existing owner-private preview retains its origin, `preview2026` namespace, install identity and access policy. Main is not merged or deployed by this update.

## Primary-source design research

Exa: 12 search result slots across FC, MyTEAM and Madden, with direct reading of selected official pages. These inform original mode structure and progression, not proprietary mechanics or copied assets.

- EA [Ultimate Team Objectives](https://help.ea.com/en/articles/ea-sports-fc/ultimate-team-objectives/): earned season points and daily/weekly/lifetime objectives.
- EA [FC26 FUT Deep Dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-fut-deep-dive): connected play, event requirements and performance rewards.
- 2K [MyTEAM Courtside Report](https://nba.2k.com/2k26/courtside-report/myteam/): solo progression, increasing competition and collection depth.
- 2K [Greatness Challenges](https://nba.2k.com/2k26/game-guide/myteam-greatness-challenge/): performance goals and short challenges.
- EA [Madden26 MUT Deep Dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-26-gridiron-notes-ultimate-team): solo Champions, escalating opposition and field-pass progression.
