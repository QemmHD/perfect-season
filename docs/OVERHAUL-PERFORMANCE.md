# Startup and offline performance audit

Audited and implemented by **Codex (OpenAI), 2026-11-07**. This is part of the wider game overhaul. No game rules, ratings, odds, online protocols, player identities, save keys or existing progress are changed by this work.

## Verified problems

1. `engine/data.ts` imported both NBA and NFL draft JSON unconditionally. A basketball page parsed football's dataset, and Soccer parsed both before loading its own data.
2. `App.tsx` statically imported the arcade renderer, Training Camp and the entire owner interface. Even opening Home evaluated their import graphs. `giftText` and `withGift` lived in the owner UI module, making passive gift collection pull that interface into the shell.
3. The service worker's install list included large unused NBA/NFL card datasets. This spent bandwidth/cache space before the player chose those sports or opened Ultimate Team.
4. `main.tsx` added its service-worker `window.load` listener only after asynchronous module evaluation. The load event can already have fired after awaited data imports, leaving the first launch without a registered worker. This was reproduced by the production offline test before the fix.
5. Merely excluding data from install was insufficient: the first page can fetch its sport dataset before its worker controls the page. That already-used file must also be cached for the next offline launch.

## Changes and connections

| File | Change |
| --- | --- |
| `src/engine/sport-raw.ts` | Uses the existing fixed sport choice and awaited dynamic import to fetch only the selected NBA/NFL draft JSON. Soccer retains Claude's existing loader. |
| `src/engine/data.ts` | Reads those selected raw exports; all conversion functions and public data/ID exports remain unchanged. |
| `src/engine/sport-raw.artifact.ts`, `vite.config.ts` | Keeps the single-file IIFE build static and NBA/NFL-only, without top-level await. Standard builds retain the existing ES2022/Safari 15 target. |
| `src/net/gift-apply.ts` | Extracts the original pure gift description/application code and pack names. No reward logic or payload change. |
| `src/ui/Admin.tsx` | Imports the shared helpers and preserves its original `giftText`/`withGift` re-exports for existing callers/tests. |
| `src/App.tsx` | Loads Arcade, Training Camp and Admin through the existing missing-chunk recovery path. Provides named loading screens instead of blank UT/match placeholders and a cancellable loading sheet for Admin. Passive gift collection remains active in the shell. |
| `vite.config.ts` | Excludes pure sport-only data/engine chunks from install using Rollup's source module IDs, not emitted filename guesses. Shared dependencies and both NBA/NFL attribute datasets remain in install, so a first offline draft game keeps real player ratings. Existing runtime `cacheFirst` serves used card data offline. |
| `src/main.tsx` | Registers the worker immediately when load already completed; otherwise uses a one-time load listener. |
| `src/lib/update.ts` | After the worker becomes ready, warms already-loaded same-origin hashed JS/CSS into this build's app cache. API URLs, profiles, signing keys and cross-origin resources are excluded. This covers startup files fetched before worker control. |
| `scripts/audit_startup.py` | Reproducible static import closure plus selected awaited dataset, deterministic gzip estimates and install-precache byte counts from a production `--manifest` build. |
| `scripts/qa/startup.mjs` | Real production-worker QA: selected-sport requests only, unused-sport cache exclusion, deferred owner UI, then an offline reload for all three sports. |

Existing missing-file recovery still reloads at most once per minute and offers Reload if a screen cannot be recovered. A loading/caching failure never resets a profile or substitutes generated progress. The installed app still needs an initial online visit and cache completion before offline use; a sport never visited online is not promised offline availability.

## Measured results

Comparison is an isolated production baseline at `ea0334792fdf9c83fa772cb5a04bdb508dd0f15b` versus that exact source with these performance changes. Other overhaul features were excluded to avoid attributing their bundle changes to this work. Final integrated build sizes can differ slightly.

“Startup JS” includes the selected sport's awaited dataset, not merely entry/modulepreload scripts. Values are raw built bytes and deterministic gzip estimates; they are **not** measured iPhone load times.

| Sport | Before startup JS | After startup JS | Reduction | Before/after gzip estimate |
| --- | ---: | ---: | ---: | ---: |
| NBA | 3,808,665 B | 2,335,394 B | 38.7% | 1,222,650 / 771,789 B |
| NFL | 3,808,665 B | 2,039,903 B | 46.4% | 1,222,650 / 643,781 B |
| Soccer | 4,807,841 B | 1,852,911 B | 61.5% | 1,517,770 / 590,943 B |

The common static JS closure fell from **3,808,665 B** to **853,735 B**. Install precache fell from **17,600,598 B** to **8,750,164 B** (50.3%); the selected sport's data is then cached on use. The updated install figure includes both NBA/NFL attribute datasets deliberately; deferring them would silently weaken the first offline draft game. The figure is derived from the same isolated manifest with those two chunks restored; the final integrated build must verify its generated precache. The install figure alone does not represent the entire first-visit transfer. Background precaching may download lazy UI code for offline readiness, while its parsing/evaluation stays deferred until opened.

## Verification

- Isolated production build succeeds with the existing large-chunk notices. The single-file artifact/IIFE build also passes (23.4 seconds), verifying the static NBA/NFL loader alias and absence of top-level await in that format.
- Chromium with actual service workers: NBA, NFL and Soccer each fetched only their own raw dataset, left the other two out of both page requests and caches, deferred Admin evaluation, and relaunched offline with the correct sport and zero page errors. This original run covered Home only. Follow-up audit restored NBA/NFL attribute chunks to install; the expanded QA now also requires importing real player attributes while offline (final integrated run required).
- Existing NBA data invariants/draft tests, original gift tests, admin catalog/reward tests and NFL rules/gift tests passed for the changed data/helper paths. The root overhaul release record contains the final integrated suite and typecheck results.
- No backend or database deployment is required. Installed-iPhone timing/background behavior remains a device acceptance check; these byte savings do not imply a fixed speed multiplier.

Reproduce measurements with `vite build --manifest --outDir <directory>` followed by `python3 scripts/audit_startup.py <directory>`. Serve the build on localhost, set `PS_QA_BUILD_ROOT` to that directory and run `scripts/qa/startup.mjs` using the existing QA browser environment variables. Test profiles remain isolated under `ns=inspect`; no real owner credential is used.

Offline scope: visiting Home online prepares the current draft sport and its original NBA/NFL match attributes. Ultimate Team cards remain cached on first use; open that sport’s Ultimate Team online before relying on it offline after an update. A previously unvisited sport is not downloaded simply to claim universal offline readiness.

### Final integrated confirmation

Root's complete overhaul production build/typecheck and real-worker `startup.mjs` pass for NBA/NFL/Soccer, including cached real attributes imported while offline. Integrated startup JS: NBA 2,338,196 B (772,899 gzip estimate), NFL 2,042,705 B (644,891), Soccer 1,855,713 B (592,053); install precache 8,792,185 B (~50% below baseline). The wider feature code slightly increases the isolated figures above. No fallback-ratings regression is accepted for first-offline NBA/NFL games.
