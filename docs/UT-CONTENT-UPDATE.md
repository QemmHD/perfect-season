# Ultimate Team: Spotlight content update

**Implemented by Codex (OpenAI), 2026-10-28–2026-10-29.** Implementation ownership, commit history and connections are recorded in [CODEX-UPDATE-LOG.md](CODEX-UPDATE-LOG.md). This document describes the current content implementation, including the rules that supersede the original [Ultimate Team design](ULTIMATE-TEAM.md).

## Cards and playable ratings

- **251 Spotlight editions:** 120 NBA and 131 NFL. Base overalls 100–105; levels cap at 105.
- **40 GOAT editions:** 20 per sport, including Michael Jordan, LeBron James, Kobe Bryant and Scottie Pippen. Base overalls 106–110; levels cap at 110.
- Standard Season, Hot Season and Legend editions retain a maximum of 99. Existing owned IDs, UIDs, levels and XP are preserved.
- Spotlight adds eight points to the underlying attribute profile; GOAT adds fourteen, bounded by the edition's cap. Key attributes have edition floors of 96/100. Overall uses the calibrated base plus the edition's own floor/scale; it is not merely a label. Signature weaknesses outside the key attributes remain: ordinary Shaq is not a shooter, GOAT Brady remains a pocket passer.
- The actual basketball and football engines support attributes over 99. Basketball gets wider shooting windows and additional speed/acceleration. Football gets additional movement speed and advantages in rating comparisons. Standard 0–99 engine behavior is retained.
- Edition identities are fixed in [`src/data/special-editions.json`](../src/data/special-editions.json). `cards.ts` → `specials.ts` resolves these against their original season IDs. Future data refreshes must retain every released manifest entry; never silently replace a pulled edition with a new peak season.

The [ratings audit](RATINGS-AUDIT.md) explains the NBA recalibration and NFL totals/rates correction, with before/after examples and source links. Every rating remains a game estimate; public all-time references do not imply official historical 2K ratings for every season.

## Spotlight Pack and genuine pull odds

The Store sells a **3,500-coin Spotlight Pack**, with eight NBA or sixteen NFL gold-or-better cards. The final chase slot has these whole-pack probabilities:

| Result of chase slot | Per-pack probability |
| --- | ---: |
| Any GOAT edition | 0.05% — 1 in 2,000 |
| Spotlight edition | 20% |
| Legend | 2% |
| Hot Season | 28% |
| Gold | 49.95% |

The remaining seven/fifteen slots are gold. The GOAT probability is for any GOAT; a particular GOAT has a smaller probability. Special editions are selected uniformly within their tier. Every pack is independent, with no guarantee or pity counter after 2,000 packs. Existing normal packs keep their original special-tier probabilities and remain usable offline; numbered editions are obtained through registered Spotlight packs/rewards.

The browser's odds display and the server's integer roll share [`contract.ts`](../supabase/functions/card-registry/contract.ts). The server uses rejection sampling for uniform integer rolls and a 500-of-1,000,000 GOAT bucket. `openPack()` refuses registered packs; `registeredPack()` reconstructs common slots from the canonical receipt seed.

A pending request is saved before network contact. A failed request keeps coins and existing cards untouched. Retry/reload uses the same request ID, server receipt and contents. Completion adds cards, charges the price once, removes the earned pack if applicable, and records the receipt ID together. New copy UIDs include the full pack ID; rewards with common prefixes no longer collide.

## Collection Gallery and Duplicate Storage

UT Home → **Collection Gallery** opens a book of all editions. Search by player/team/year, filter tier and ownership, and browse pages of 36. Owned editions show their original art; missing ones are muted. A previously sold/submitted edition remains discovered. Stored duplicates count as owned without adding another edition to the book.

Discovery milestones at 25/50/100/250/500/1,000 editions pay coins, with Gold/Premium packs at later milestones. Each franchise set asks for five different player IDs and pays 100 coins plus a Silver Pack. Claims are additive, do not consume cards, and pay once per sport. Selling a card never resets a claimed milestone.

Club / Duplicate Storage keeps exact extra copies out of the main Club view. Different seasons/editions remain separate. All copies stay in the original `ut.owned` save list; a UID marker controls location. Every copy retains its XP/level and can be swapped, quick-sold with confirmation, or used directly in SBCs. See [the earlier release's compatibility notes](EVOLUTION-RELEASE.md#duplicate-storage).

## Spotlight Events

Three permanent series per sport each contain three full matches:

| Series | NBA opposition | NFL opposition |
| --- | --- | --- |
| Dynasty Nights | Chicago Bulls / GOAT Jordan finale | New England Patriots / GOAT Brady finale |
| Beyond the Arc / Air Raid | Golden State Warriors / GOAT Curry finale | San Francisco 49ers / GOAT Rice finale |
| The Immortals | Los Angeles Lakers / GOAT Kobe finale | Dallas Cowboys / GOAT Emmitt Smith finale |

Use the existing squad, controls, Play/Sim vote and production match engines. No extra entry restriction is imposed. First clears pay a Silver Pack, Premium Gold, then one guaranteed **Spotlight** reward. The reward is not a GOAT guarantee. Stages must be cleared in order, a loss does not advance, and replays do not repeat the pack reward. Match IDs also prevent duplicate settlement. Normal daily coin/XP limits remain; event first-clear progress/rewards remain available after that daily limit. Events do not advance Squad Battles or Rivals.

The final reward pack calls the registry with a per-player/per-sport/per-series entitlement, so retrying with another request ID still returns the same registered reward.

## Global copy numbers and backend

Each newly pulled Spotlight/GOAT copy receives a permanent serial. A player who pulls copy 8 sees **8 / 20** when that edition has twenty registered copies worldwide. The denominator grows; it is not a cap. The original copy number stays fixed. Pack reveals show the receipt; card details refresh aggregate counts every thirty seconds and on focus. Offline details keep the last confirmed total and label it accordingly. Catalog previews can also show the edition's last fetched total.

The separate Supabase project is **Perfect Season Card Registry**, ref `ryqaibujweiwwvdtswxj`, in QemmHD's Org. Public endpoint:

`https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/card-registry`

The original game continues to use **Nostr** for identity, queues, live matches, leaderboards and admin gifts. Players need no new login. The registry authenticates POSTs by verifying the existing player's signed Nostr event (kind 27235, URL/method tags, timestamp within five minutes). Only public configuration appears in the frontend; service credentials are read from the Edge Function's environment.

- `GET ?sport=nba&ns=` returns edition → aggregate total. QA uses `ns=inspect`, separate from live counts.
- `POST {event}` carries signed JSON `{v:1,sport,namespace,requestId,kind}`. Kinds are `spotlight` or `event-spotlight:<series-id>`.
- A receipt contains `id`, `kind`, `sport`, `namespace`, `tier`, `cardId`, `seed`, and, for numbered cards, `serial`/`totalAtPull`.
- `ps_registry_open` atomically reuses an entitlement's receipt or increments the edition counter and inserts its receipt in one transaction. Concurrent pulls receive distinct serials; retries cannot mint again.
- Raw tables and mint RPC are inaccessible to browser roles. RLS and explicit deny policies protect both tables. The Edge Function exposes aggregate counts and verified caller-owned results, not the receipt table.
- Abuse limits: thirty new registered openings per signed identity per hour, one hundred per day. A retry of an existing receipt remains recoverable. The existing coin wallet and match/event outcomes are client-owned; signed identity and authoritative rolls/serials do not create a server-authoritative economy or full anti-cheat system.

Backend sources, catalog and migrations are committed under [`supabase/`](../supabase/). Run `npm run data:registry` after adding manifest entries, then redeploy the Edge Function's catalog before shipping a client that can draw those editions. Keep existing receipts and counters permanently when redeploying. Never reset them as part of an update.

## Card art and special pack motion

**Implemented by Codex, 2026-10-29:** the original pack crimp, foil tear, position → team → player progression, pixel portraits, Archivo typography and existing sound cues remain the visual language.

- `CardArt.tsx` exports one `GoatCrown` SVG shared by the card and reveal. `card-editions.css` travels with the card component, including match screens. `pack-art.css` gives Spotlight the original pack structure in a matching violet/teal foil material.
- `PackOpening.tsx` and `pack-reveal.css` add the GOAT crown prologue, edition rails, light sweep, position/team suspense, foil card entrance, overall count-up and registered-copy stamp. Spotlight has its own coordinated light/material treatment.
- Controls stay where the original reveal places them. Every reveal can be skipped. Clearing timers and remembering an early skip prevents the reveal from restarting at Position after the card is already shown.
- Reduced motion shows the final card without the decorative sequence or confetti. Timings, small screens and safe-area offsets are checked through the existing scaled stage, not a separate layout system.

## Compatibility and verification

Profile version and keys are unchanged. Migrations add collection history, event progress, pending opening/receipt IDs and optional mint metadata. Save Locker includes them in both sports. Core original online/gift payloads remain compatible. UT's revised full-attribute pool fingerprint and rules version 2 pair clients using the same rating model; both phones need the updated build to match in that UT queue. Draft queues retain their original protocol.

[Browser QA instructions](BROWSER-QA.md) cover fresh isolated profiles, pack recovery, global numbers, collection claims, events, two-client online matches and animated/reduced-motion reveals. [CODEX-UPDATE-LOG.md](CODEX-UPDATE-LOG.md) records the final measured checks and GitHub release state.
