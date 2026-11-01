# Pack Tracker

**Implemented by Claude (Anthropic), 2026-11-01**, branch `claude/pull-tracker` (from `1cc9835`, not deployed).

The owner's ask: *"add a tracker so you can see all cards pulled to weigh packs."* The Pack Tracker shows every card a player has pulled and whether each pack type is worth its price, in all three sports (each sport's Ultimate Team keeps its own log).

## Where it is

- **Club → Pack Tracker**: a row at the top of Club's Players segment.
- **Store → PULL HISTORY**: a link on the "Your packs" heading (or on "All packs · by price" when nothing is waiting).

The screen is the `tracker` view in `src/ut/nav.ts` (title *Pack Tracker*, tab CLUB, back to Club). It has three sections:

| Section | What it shows |
|---|---|
| **BY PACK** | One card per pack type: packs opened, cards, coins spent, the best pull, then a YOU / EXPECTED table: **Return** (quick-sell value of what paid packs gave, as a % of their price; free packs show value per pack), **86+ in a pack**, **90+ in a pack**, **Special edition**; cards by overall bucket (<75, 75–79, 80–82, 83–85, 86–89, 90+), walkouts, specials, legends and total quick-sell. Picks show YOU only. |
| **RECENT** | The newest packs, newest first, each with its source (Store, Daily, Reward, Season Pass, SBC, …), price and its best five cards as minis (tap one you still own for its details). Filters: pack type (only the types in the log) and ANY CARD / GOLD+ / 86+ / SPECIAL. |
| **ALL CARDS** | Every copy the save knows: `ut.owned`, pending retirements (sold / SBC) and logged cards no longer owned, newest first, each with the pack it came from and the date. Filters: overall (75+ … 90+) and tier. Copies packed before the tracker are marked **Before tracker** (their pack type was never saved). |

The header shows packs, cards, coins spent and overall return, and how many packs (`ut.packsOpened`) were opened before the tracker began. With nothing logged yet, BY PACK and RECENT show an empty state with a GO TO THE STORE button; ALL CARDS still lists the club.

**Expected** numbers come from each pack's published odds: `expectedFor` (pull-log.ts) draws 160 packs with fixed seeds through the same code that fills real packs (`openPack`, or `fill` with the Spotlight slots), so it follows the odds sheet's slots and the within-tier weighting exactly; the special-edition chance is computed exactly from the slot odds (`specialOdds`). Picks, the starter and event Spotlight rewards have no expected column. The results are cached per sport, pack type and week.

## Storage

Optional and additive: `ut.content.pulls` (profile version 1, no new localStorage key). The shape and its normaliser are in `src/ut/pull-log-state.ts` (no imports, so the profile load stays card-free); `normalizeContent` (content-state.ts) keeps it, so `migrateUt` validates it on every load and a save without it simply has nothing tracked.

```ts
pulls: {
  since: number,                 // when the first pack was tracked
  r: PullEntry[],                // recent packs, oldest first
  a: Record<string, PullAgg>,    // running totals by pack type, never capped
}
PullEntry = { id, k /* kind */, n /* name */, c /* coins */, s /* source */, at, u /* uid prefix */, cs: [cardId, ovr, tier][] }
PullAgg   = { nm, n, pd, c, q, qp, k, t /* by tier */, o /* 6 ovr buckets */, sp, lg, w, h86, h90, hs, b /* best */, f, l }
```

- **Caps**: the recent list keeps the newest **300 packs**, then drops the oldest until it holds at most **1,500 cards** (football's packs are big). Totals in `a` are never capped or reset. Worst case measured at about 95 KB (NBA, all Jumbo/Premium/Gold) per sport; a typical log is a few KB (QA: 2–3 KB after five packs).
- **Card uids** are not stored per card: card *i* of an entry is `u + i` (`pack:<id>:`, `registered:<id>:`), or `u` itself for a one-card pick (`pick:<id>`).
- **Pack types** (`packGroup`): the pack kind, except unit/position packs together (`position`), the Preview Pack apart from Premium Gold (`preview`, its buyer saw the cards), event Spotlight rewards together and program picks together.
- **Source** of an earned pack is read from its stable id (`sourceOfPending`: `event:`, `set:`, `objective:`, `…:tier:` Season Pass, `stream:` SBC, `daily-…`, `draft:`, `rivals:`, …); SBC reward packs and admin gifts use plain ids and show as *Reward*.

## Exactly once

`recordPull` (pull-log.ts) runs inside the same state update that deposits the pack's cards, on the state *before* they land, and does nothing when the pack's id is already in the recent list or its first card is already owned (a retried or replayed opening). Each call site also keeps its existing guard. Call sites:

| Opening | Where | Price / source |
|---|---|---|
| Store packs (Bronze, Silver, Gold, Premium, Position/Unit), Elite, Jumbo, Standout, Lightning, Live Calendar program packs | `UltimateTeam.openNow` via `buy`, `buyLimited`, `buyLive` | price paid, `store` |
| Daily Drop | `claimDailyDrop` | 0, `daily` |
| Preview Pack | `buyPreview` | price, `preview` |
| Starter | `claimStarter` | 0, `starter` |
| Waiting packs (rewards, gifts, Season Pass, SBC, events, sets, calendar, draft, Rivals) | `openPending` | 0, from the id |
| Spotlight Pack and event Spotlight rewards | `promo.ts registeredOpening` (guarded by `registeredOpenings`) | reserved price, `store` or the reward's source |
| Kept picks: Scout's Choice (Store or reward), Standout/Icon/calendar/program picks, Swap Desk | `UltimateTeam.keep` (guarded by the `pick:<id>` claim) | Scout's Choice price when bought (`scout:` id), else 0 |

Not packs, so not logged as packs (they still appear under ALL CARDS): SBC reward cards, Scout Market buys, UT Draft cards (never owned).

## Not changed

Odds, prices, card ids, pack contents, `packsOpened`, transactions, protocols and online queues are unchanged (UI and local state only; no queue bump). The cloud snapshot and file-backup validation are unchanged and accept saves with and without `pulls`.

## Tests and QA

- `src/ut/pull-tracker.test.ts` (and `soccer-pull-tracker.test.ts`, which runs the same cases under `PS_SPORT=soccer`): logging exactly once (same id, replayed uids, reload), the caps with uncapped totals, every aggregate against the cards, pack grouping and sources, a kept pick, a registered Spotlight receipt settled twice, the all-cards list (before-tracker, SBC, sold-and-pruned), expected rates through the real pack code, old saves without the field, bad entries dropped, and a round trip through `captureProgress` / `checkedSnapshot` / `applyProgress` and `validateSaveValues`.
- `scripts/qa/pull-tracker.mjs [nba|nfl|soccer|all] [390|320|all]`: starts its own Vite server (stopped by its PID), loads a pre-tracker save, checks the empty state and the before-tracker cards, buys Gold and Silver packs, opens the Daily Drop, keeps a Scout's Choice pick (and in soccer opens the waiting reward pack), then checks all three sections, the filters, a mini card's details and that a reload logs nothing twice; it fails on page errors, horizontal overflow and tap targets under 44 design px.
