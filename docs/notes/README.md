# Working notes

A durable place to record what we learn while building Perfect Season, so nothing lives only in a chat or a scratch folder. The polished, per-feature docs are one level up (see the [docs index](../README.md)); these notes keep the instructions, decisions, research and plans behind them.

**Rules for this folder**
- Put a note in the category that fits; add a category only when none does, and list it below.
- Date entries, and say when something was superseded rather than deleting it.
- Link to the shipped doc when a plan becomes real.
- Never store secrets: no email addresses, passwords or admin credentials, tokens, keys, private URLs or local machine paths. The admin password lives outside the repository.

## Categories

| Folder | What goes here | Notes |
|---|---|---|
| [`owner/`](owner/) | What the owner asked for, and things to tell him | [instructions.md](owner/instructions.md) · [tell-owner.md](owner/tell-owner.md) |
| [`decisions/`](decisions/) | Decisions and their reasons (saves, economy, ratings, online compatibility, naming) | [decisions.md](decisions/decisions.md) |
| [`research/`](research/) | Raw findings from outside sources, with licence notes | [README.md](research/README.md) (index) · [fc27-research.md](research/fc27-research.md) · [web-resources.md](research/web-resources.md) |
| [`ratings/`](ratings/) | Rating audits and fix plans | [fixplan.md](ratings/fixplan.md) |
| [`content-plan/`](content-plan/) | Ultimate Team content specs and the live-service calendar | [ut-spec.md](content-plan/ut-spec.md) · [live-calendar.md](content-plan/live-calendar.md) |
| [`soccer/`](soccer/) | Soccer data, ratings and match-design plans | [plan.md](soccer/plan.md) |
| [`gameplay/`](gameplay/) | Measured gameplay plans (what to change in the engines and why) | [gameplay-plan.md](gameplay/gameplay-plan.md) |
| [`release/`](release/) | Branch/merge status and ship checklists | [branches-and-status.md](release/branches-and-status.md) · [ship-checklist.md](release/ship-checklist.md) |

Most notes here are from the 2026-11-01 season update. Numbers in plans written before a change landed (for example the ratings plan, on the old rating scale) are kept as they were; each note's header says where the shipped version is.
