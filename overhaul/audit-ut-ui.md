# Audit: the whole app UI/UX and Ultimate Team, all three sports (real browser)

Audit agent, 2026-11-09. Build: `claude/studio-overhaul` = live main `acdf3e2`. I did not change, commit or publish anything in the repo.

**Paths.** All paths in this report are relative to the scratchpad folder `/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/`.
- Scripts: `audit-scripts/utui/` (`lib.mjs`, `walk.mjs`, `edge.mjs`, `match.mjs`, `ranks.mjs`, `firstrun.mjs`, `ingame.mjs`, `cards.mjs`, `sheet.py`).
- Screenshots: `audit-shots/ut-ui/<sport>-<width>/NN-<screen>[-sN].png`. Each folder has a `report.json` with the measurements for every screen.
- Contact sheets: `audit-shots/ut-ui/sheets/`.

---

## 0. Method (what was measured and how)

- **Server and browser.** Dev server `npx vite --port 5205 --strictPort` with Playwright Chromium. Each context ran `isMobile`, `hasTouch` and `deviceScaleFactor: 3`.
- **Viewports and insets.** Insets were simulated the way `scripts/qa/screen-fit.mjs` does it (`window.__psInsets`), with `navigator.standalone = true`:
  - **393×852** (iPhone 15/16 Pro, the owner's phone): 59/34 pt.
  - **430×932** (Pro Max): 59/34 pt.
  - **320×568**: a 20 pt status bar.
  - 390×844 is the same frame as 393 with a 47 pt notch, so it adds nothing: the frame scales by width.
- **Standalone mode was only partly emulated.** CDP `Emulation.setEmulatedMedia` does not support `display-mode` (`matchMedia('(display-mode: standalone)')` stayed `false`). So the inline standalone rule in `index.html` was not exercised.
- **Isolation.** Every run used `?ns=inspect&relay=ws://localhost:7777`. A `context.route` aborted every non-localhost request except Google Fonts (so Archivo renders as on the phone). The only other host the app tried was the project's Supabase host at startup, blocked in every run. No writes reached any live service.
- **Fixture.** The same as `scripts/qa/browser.mjs`: 10,000 coins, starter pack, three GOATs, 25 cards of one franchise (CHI / NE / BAR), and two unopened Gold packs. A fresh-profile run covered first launch.
- **Walks.** `walk.mjs` visits about 50 screens per sport: every main-app screen and sheet, the draft, and every UT tab, segment, sub-screen and Play mode, an odds sheet, the Scout Market and a full pack opening. Long pages were scrolled and captured page by page.
- **Measurements per screen** (`lib.mjs: audit`): overflow and document scroll, off-frame elements, clipped/truncated text, tap targets under 44 design px (counting `::before` hit areas), text under 10 px, WCAG contrast against the nearest solid background, and the topmost text or control relative to `--sat`.
- **Matches.** `match.mjs` played real Squad Battles matches to the result and debrief, using autopilot (`?autoplay`) at 8× time, in NBA and Soccer.
- **iOS 26 simulation.** `edge.mjs` reproduces the owner's header blur and tests the proposed fix by injecting CSS at runtime only.

**Totals:** 3 sports × 3 widths: 9 walks, 748 walk screenshots, plus 74 targeted shots and 45 contact sheets. Zero page errors in every walk. No horizontal overflow, no document scroll, no off-frame elements, no clipped (non-ellipsis) text on any screen.

---

## 1. The owner's iPhone header problem: root cause and exact fix (CRITICAL)

### 1.1 What the owner's screenshot shows (measured, not eyeballed)

The image is 1188×2576, which is 3.02 px per pt, so it is a 393×852 pt iPhone 15/16 Pro. I measured the brightest pixel and the sharpest horizontal edge in each text row (`owner-iphone-home.jpg`; crops in `audit-shots/ut-ui/owner-top-crop.png` and `owner-level-zoom.png`). The "LEVEL 19" eyebrow and the "510/620 XP" line use the same colour (`--sub #8fa6b2`), so they are a direct comparison.

| Row (pt from the top) | Element | Peak luminance (0–255) | Edge sharpness (max Δ between adjacent px) |
|---|---|---|---|
| 69–71 | "LEVEL 19" eyebrow | 109–111 | 21–26 (smeared) |
| 70–78 | LV ring label "LV" and the top of the ring | 127–161 | 17–44 (smeared) |
| 80–86 | coin digits "59672" | 220–246 | 73–107 (nearly sharp) |
| 86–98 | LV ring "19" | 187–193 | 117–120 (sharp) |
| 96–98 | "510/620 XP" | 168–171 | 93–99 (sharp) |

Text of the same colour is about 35% darker and about 4× softer above roughly 80 pt than below about 86 pt. The top arcs of the LV ring, the coin pill and the help/settings circles are blurred, and their bottoms are crisp.

So a **progressive blur plus dimming** covers the screen from the top down to about **sat + 21–27 pt** (the inset is 59 pt) and fades out there.

### 1.2 The app does not draw it

`audit-shots/ut-ui/proto-soccer-home-393.png` is the same Soccer Home in Chromium at 393×852 with 59/34 insets. Its geometry matches the owner's photo point for point (eyebrow 68.6–80.7 pt, XP bar 84.7–90.7 pt, XP text 94.8–105.9 pt, buttons 65–109 pt), and it is perfectly crisp.

`proto-stack.mjs` checked every element and its `::before`/`::after` that intersects y < 90 for `filter`, `backdrop-filter`, `mask` or `opacity < 1`. It found **zero**.

The paint stack under "LEVEL 19", from the top down:
1. `span.eyebrow`
2. `.level-text`
3. `button.level`
4. `.topbar`
5. `.shell-top` (z 2)
6. `.shell`, whose background is a **radial-gradient** with a transparent `background-color`
7. `.view.in-fade`
8. `.stage`, CSS-transformed by `scale()`
9. `.viewport`
10. `#root`, `position: fixed; inset: 0` with a **transparent** background
11. `body` / `html` (#04121a)

Nothing in `index.html`, `src/styles.css`, `src/stage.tsx` or `src/stage-layout.ts` adds a top fade, scrim, mask or backdrop. The only blur rules in the app (`styles.css:6231, 7319, 7487, 8345`; `pack-cinema.css:159`) belong to other screens.

### 1.3 Cause

**iOS 26 WebKit draws a soft "scroll-edge effect" under the status bar.** It is a progressive blur with dimming that runs from the top of the screen to about 20–25 pt below the safe-area inset. Home-screen web apps get it too, on top of web content.

- Web pages cannot turn it off with CSS. The only known switch is native: `scrollView.topEdgeEffect.isHidden` on a `WKWebView`, which a PWA cannot reach.
- WebKit replaces the soft blur with a solid colour extension only when a viewport-constrained (fixed or sticky) element with a sampleable background touches that edge. WebKit's explanation is in [bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756): "a solid background color extension … is only needed in cases where there's a viewport-constrained (fixed or sticky) element", with a softer blur on iPhone.
- Our top edge has no such element. `#root` is fixed but transparent. What sits at the edge is a gradient (`.shell`'s radial-gradient, or UT's `radial-gradient(… rgba(245,184,61,.13) …)` at `styles.css:8736-8741`) inside a transformed `.stage`. So WebKit most likely falls back to the soft blur.
- I am inferring the sampling step from WebKit's public explanation; I could not observe it outside the device. The blur itself is measured fact (§1.1).

The blur only becomes visible because of where the app places content:

- **Every header starts 6–17 pt below the inset.** On every screen measured at 393 wide (about 150 across the three sports), the topmost text or control is at **65–76 pt = sat + 6…17** (`report.json` "topMost").
  - The main `TopBar` is a 56 px bar starting exactly at `--sat` (`styles.css:603, 464-472`). Its ring is at sat+7, the "LEVEL" eyebrow at sat+10, and its buttons at sat+6.
  - UT's `.ut-top` bar (`UltimateTeam.tsx:1953`, `styles.css:8742`) is the same.
- **Other overlays sit in the zone too:**
  - toasts at `sat + 6` (`styles.css:3502`)
  - the pack-opening SKIP at `sat + 12` (`styles.css:9876`)
  - the in-game score bug `.hg2-bug` at `sat + 8` (`styles.css:7853`). Inside `.arcade-full`, `--sat` is `env(safe-area-inset-top)` (`styles.css:7826-7830`).

  The top 15–20 pt of every one of these is under the blur.

**"Things get cut off."**
- **No horizontal crop:**
  - The stage equals the viewport width at all sizes.
  - Off-frame elements: 0.
  - `docScroll`: 0.
  - The gear's right edge is 16 pt from the screen edge, both in Chromium and in the owner's photo.
- **What looks cut off is the blur band.** It eats the top of the LV ring, the whole LEVEL label, and the top halves of the coin pill and the round buttons.
- **A second, real "cut" is at the bottom of NBA/NFL Home** (§3, M1).

**Reproduction:** `edge.mjs` overlays a simulated edge effect (blur 2.6 px, brightness 0.66, masked from 0 to sat+26 with the fade starting at sat+12). It matches the owner's photo: `audit-shots/ut-ui/edge-soccer-393-2-ios26-sim.png`, with a side-by-side top crop in `sheets/edge-top-compare.png`.

### 1.4 Exact fix

**Fix A — required.** Keep all content clear of the effect zone. The change is systemic, because every screen uses `--sat` as its content offset.

`src/stage-layout.ts`, in `stageBox`, keep `sat` as the raw inset, since the tests assert `sat*k === inset`, and add an edge clearance:

```ts
/** iOS 26 blurs and dims a band under the status bar reaching ~22 pt below the inset
 *  (measured on an installed iPhone 15/16 Pro). Content starts below it; backgrounds still bleed. */
export const topEdge = (insetTop: number) => Math.min(22, Math.round(insetTop * 0.4));
// in stageBox, phone branch:
edge = topEdge(top) / k;
const content = Math.max(0, h - sat - edge - sab);   // fitFor() then sees the real room
return { ..., sat, edge, ... };
```

- **Edge values:** 59 pt island → 22, 47 pt notch → 19, 20 pt status bar → 8, no inset → 0.
- **`src/stage.tsx:151`:** `'--sat': (box.sat + box.edge) + 'px'`, plus a new `'--inset-top': box.sat + 'px'` for anything that must hug the real inset. Nothing needs it today.
- **`styles.css:7830`** (`.arcade-full`): `--sat: calc(env(safe-area-inset-top, 0px) + min(22px, env(safe-area-inset-top, 0px) * 0.4));`. This moves the game score bug and in-game buttons the same way.

**Measured effect** (`edge.mjs`, CSS injected at runtime):
- At 393×852 the LV ring moves to 88–131 pt and "LEVEL" to 91–103 pt. Both are fully clear of the 59–83 pt zone.
- PLAY (673–756) and the tab bar (756–852) do not move.
- **Soccer Home** still fits; the 22 px comes out of its spacer.
- **NBA/NFL Home** have the Training Camp row and no slack, so their content now scrolls about 22 px, and the hint line goes fully under PLAY (`edge-nfl-393-3-fix-sim.png`). Ship Fix A together with M1.
- `fitFor` classes are unchanged on every iPhone size, though one margin is thin:

  | Size | Content before → after (frame px) | Class |
  |---|---|---|
  | 393×852 | 753 → 731 | `normal` (threshold 730, so a 1.4 px margin) |
  | 390×844 | 763 → 744 | `normal` |
  | 430×932 | 761 → 741 | `normal` |
  | 375×667 | 673 → 665 | `tight` |

  On 393×852, an edge above 22 would flip it to `tight`. Either keep the 22 cap, or compute `fit` from `h - sat - sab` and ignore the edge.

Screenshots: `edge-*-3-fix-sim.png` and `edge-*-4-ut-fix-sim.png`.

**Fix B — recommended, but verify on the device.** Give WebKit a solid, fixed element at the top edge to sample. Add it to `index.html` before `#root`, outside the transformed stage. Fixed descendants of a transformed element are not viewport-fixed, so it cannot live inside the stage.

```html
<div class="status-plate" aria-hidden="true"></div>
<style>.status-plate{position:fixed;left:0;right:0;top:0;height:env(safe-area-inset-top,0px);
  background:#04121a;z-index:2;pointer-events:none}</style>
```

- If WebKit uses its colour extension here, the band becomes a flat colour. Then nothing is blurred even with Fix A off.
- If it does not, the plate is harmless: the blurred band then contains only flat colour plus the OS status text.
- Neither outcome can be shown in Chromium. Test it on the owner's phone with both fixes on and with B alone.

**Fix C — design.** Make each top bar a real header plate. Use a flat `--bg-2` from y = 0 to sat + edge + top-h, with a 1 px `--line` hairline, instead of a transparent bar over a gradient. This is how production sports apps frame the status area, and it makes Fix B's colour sampling deterministic.

**Fix D — hygiene.**
- The `index.html:41` comment says the rule is also in styles.css; it was removed (`docs/CODEX-UPDATE-LOG.md:731`). Correct it.
- Add `edge N` to `viewportInfo()`.
- Assert in `scripts/qa/screen-fit.mjs` that the topmost control is at y ≥ sat + edge.
- Let QA override `.arcade-full`'s `--sat`/`--sab`. The games read `env()`, so every Chromium run draws the HUD at y = 8 pt (`match-*-03-ingame.png`) and hides in-game inset bugs.

**Device check after shipping:**
1. Take an installed-app screenshot of Home and of UT Home.
2. "LEVEL N" must have the same brightness as "x/y XP": roughly 168 vs 168, instead of 110 vs 168 today.
3. Settings → diagnostics should read `safe 59/34 · edge 22`.

---

## 2. Severity summary

| ID | Sev | Finding | Where |
|---|---|---|---|
| C1 | critical | iOS 26 status-bar blur/dim covers the top 15–20 pt of every header, toast, SKIP and game HUD | §1 |
| H1 | high | The card-detail sticky action bar floats 34 pt above the sheet bottom on every notch/island iPhone. Content shows below it and its stats are cut | `nav.css:1118-1127` + `styles.css:3374-3375` |
| H2 | high | Every player has the same skin tone and hair colour, and cards show a tiny back-turned figure, so stars are unrecognisable | `game/pixel/body.ts:591-593`, `CardArt.tsx:35-36`, `hoops2/render.ts:69-70`, `football2/render.ts:64-65` |
| H3 | high | Cards look flat and alike: every gold is identical, the figure takes ~25% of the card, text is 3–9 px, team badges are illegible | `CardArt.tsx`, `card-editions.css` |
| H4 | high | The main app never surfaces UT claimables. The UT tab badge shows "FREE" only before the starter pack | `ui/Pages.tsx:71`, `App.tsx:1190` |
| H5 | high | Objectives, Missions and Gauntlet are dead ends: no GO / deep link | `Clubhouse.tsx:870-885`, `ui/Pages.tsx:664,691` |
| H6 | high | Player-facing names copy EA FC's mode names (Ultimate Team/UT, Squad Battles, Rivals, SBC, Evolutions, Moments, Champions) and show "2K"/"Madden" reference links | many; `CardDetail.tsx:160-166` |
| H7 | high | GOAT/top cards show walls of 110s (Brady: 110 THP/SAC/MAC/DAC/TUP), so card faces stop informing | card face |
| M1 | medium | The NBA/NFL Home hint line sits under the PLAY bar's shadow (faded and cut) at 393 and 320. Soccer Home has a dead gap of about 50 px | `styles.css:11653-11656`, `Pages.tsx:254` |
| M2 | medium | The pack-opening result has no per-card actions and only one walkout. The headline counts only golds ("10 GOLDS" over 12 cards). Duplicates do auto-store with QUICK SELL | `PackOpening.tsx` |
| M3 | medium | The match result has no player ratings or MOTM and no animated progress. Soccer draws show as **WIN** | `Match.tsx:1440-1580` |
| M4 | medium | Long, flat pages: SBCs are 5.7–6.7 screens, Development 4.8–6.2, Store 3.8–4.4, Collection 3.4–4.0 | report.json "scroll" |
| M5 | medium | Collection progress reads "39 / 22,082" (0.2%), a demotivating meter | `CollectionGallery.tsx:62-70` |
| M6 | medium | Draft-screen targets are under 44: respins 38, boosters 40. Pack SKIP is 65×36 and the season chip 141×41 | report.json "small" |
| M7 | medium | First launch never mentions UT. Two stacked modals ("thank you for testing" gift, then the Day 1 chest) come before Home | `Welcome.tsx`, gift flow |
| M8 | medium | RESET PROGRESS is one confirm away and styled like any other button | `Pages.tsx:519-531` |
| M9 | medium | Arena loading gap: about 1.2 s of black court with only the score bug and no loading indicator | `match-nba-393-01-pre.png` |
| M10 | medium | Season Pass track: three small tiles, no hero reward and empty space below. Nothing shows what's worth grinding for | `42-ut-ch-season-pass.png` |
| M11 | medium | The card detail's rating-reference link opens Safari and leaves the installed app | `CardDetail.tsx:160` |
| M12 | medium | Collection chips LANDMARK, PROGRAM and STANDOUT always show "0 editions". Missing cards are near-identical grey silhouettes | `CollectionGallery.tsx:34` |
| M13 | medium | Every solo Squad Battles game shows the online "HEAD TO HEAD · SIM OR PLAY?" vote with a 10 s countdown | `Match.tsx:668-676, 955-976`, `ui/Vote.tsx:198` |
| L1–L9 | low | Contrast, tiny text, truncation, scroller affordance, stale meta, QA limits | §3 |

---

## 3. Findings in detail

### C1. iOS 26 status-bar blur over every header (critical)

Covered in §1.

**Reach.** The topmost text or control sits between sat + 4 (the draft) and sat + 17 (Season Pass), which is inside the ~22 pt band, on:
- every main and UT header
- toasts and the pack SKIP
- the in-game score bug in all three sports

**Player impact.** Every screen opens with a smeared, dimmed header. It reads as a rendering bug, and it dulls the level and coin balance, which are the core reward signals.

**Fix.** §1.4 A, plus B and C.

### H1. Card-detail action bar floats mid-sheet on notch/island iPhones (high)

**Evidence.**
- `soccer-393/27-ut-card-detail.png` (crop `sheets/soc-detail-bottom.png`): the CLOSE / ADD TO SQUAD / SELL bar overlaps the second row of season stats. The "LS" of a stat label shows between the buttons, and the "ALL 6 ATTRIBUTES" disclosure is visible *below* the bar.
- `nfl-393/30-ut-card-detail.png` (crop `sheets/nfl-detail-bottom.png`): NFL shows season stats (16 G, 68.9 CMP%, 4,806…) below the bar.
- NBA shows "Lob City" below it.

**Cause.**
- `.sheet.bottom` has `padding-bottom: calc(18px + var(--sab))` (`styles.css:3375`).
- `.ut-detail-btns` is `position: sticky; bottom: -18px; margin: … -18px` (`nav.css:1120-1123`). It compensates only the 18 px and not `--sab`, so it sticks 34 pt (`--sab`) above the sheet's bottom edge, and content scrolls through the strip beneath it.
- The bar's own `padding-bottom: calc(16px + var(--sab))` double-counts the inset.
- On phones without a home indicator (`--sab` = 0) it looks right. The 320×568 run, with no bottom inset, shows the bar flush at the bottom (`nba-320/30-ut-card-detail.png`). Any QA without a bottom inset would miss this.

**Fix.**
```css
.ut-detail-btns { bottom: calc(-18px - var(--sab)); margin-bottom: calc(-18px - var(--sab));
  padding-bottom: calc(16px + var(--sab)); background: var(--panel); }  /* solid under the buttons */
```
A sturdier option is to make the action row a non-scrolling footer: the sheet becomes a flex column, with the content scroller and the footer as siblings. Check every other sticky-in-sheet bar with the same pattern, too: `.ut-cta-bar` (`nav.css:294-304`, `bottom: -16px`) when it is used inside a bottom sheet.

**Player impact.** On the most-used card screen, the main actions sit on top of other content. It looks broken, and it is the screen players see after every pull.

### H2. Players aren't recognisable: one skin tone, one hair colour, back-turned (high; the owner asked for this explicitly)

**Evidence.**
- `src/game/pixel/body.ts:591`: *"No reliable source says what a player looks like, so everyone shares one skin tone; hair varies by player."* `DEFAULT_SKIN = '#a8714f'` and `DEFAULT_HAIR = '#1d1612'`.
- Used on every card (`CardArt.tsx:35-36`) and in the NBA and NFL renderers (`hoops2/render.ts:69-70`, `football2/render.ts:64-65`).
- Hair *style* is a hash of the player id (`hairFor(pid)`), so it is random rather than real. In `sheets/nba-club-cards-zoom.png`, Michael Jordan has a full head of hair, and Jordan, Abdul-Jabbar and Chamberlain share the same skin, the same hair colour and the same stance.
- The portrait pose (`facing: 1.2`) shows mostly the back of the head, so there is no face at all.

**Player impact.** "Make different characters that match them in real life so we know who is who" is unmet. Twenty Jordan cards in one club (`28-ut-club-players.png`) are indistinguishable except for the year.

**Fix direction.**
- Add an optional per-player appearance table, `src/data/appearance-<sport>.json`, keyed by the stable `line.pid`. It holds a skin tone from a small, respectful palette (~8 tones), hair style and colour, facial hair, and signature accessories: goggles (Abdul-Jabbar), headbands, sleeves, a bald head (Jordan, Barkley, O'Neal), dyed hair (Rodman).
- Author it from public photos for the top ~300 cards per sport first, and keep the neutral default for the rest. It is small JSON, so there is no bundle concern.
- Turn the card portrait to face front: a ¾-front head-and-shoulders crop at 2× pixel scale.
- Gameplay is untouched: this is render-only, so no queue bump.

### H3. Card art falls short of a production UT (high)

**Evidence.**
- Club grids in all sports (`*-393/28-ut-club-players.png`, `soccer-393/25-…`): every gold card is the same yellow gradient with a pale team-colour halo. The figure fills about 25% of the card height. The name plate is a flat bar.
- Text sizes measured on cards, in design px: "GREATEST OF ALL TIME" 3.1–8.3; team code 3.4–9; "DAILY"/"GOLD" labels on pack thumbnails 3.5–5.5; position 7–9.
- Team-badge text contrast on the badge: Villarreal 1.25:1, Las Palmas 1.28, RKC/RJC 1.45, PIT 1.76, NO 1.85, WOB 2.61, NAP 2.98, CIN/DEN 3.37 (`report.json` "lowContrast").
- Pack art is a flat ticket with "NBA UT GOLD" text (`43-ut-store.png`, `46-ut-pack-open-0.png`). Gold, Captains, Dynasty, Elite and Jumbo are visually near-identical.

**Comparison.** In production UT the face and upper body dominate the card. Each promo has its own frame (colour, pattern, foil, animated sheen), cards carry six key stats, and packs are themed per promo.

**Fix direction.**
1. Bigger front-facing bust (H2).
2. An edition frame system: ten or more distinct SVG/CSS frames, one per tier and promo, each with a pattern, foil sweep and edge glow, and a "special" animated variant for Hot Season, Standout, Legend, GOAT and Spotlight.
3. Six mini-stats on the grid card at ≥ 9 px when the card is ≥ 100 px wide.
4. Team badges: compute text colour by contrast (`lum(c1)`), or use an outlined badge.
5. Per-pack art: an SVG pattern plus an accent colour per pack, and the promo name in a big condensed italic.
6. Drop "GREATEST OF ALL TIME" vertical microtext below 8 px; use the crown alone.

### H4. Main Home never surfaces Ultimate Team claimables (high)

**Evidence.**
- With 6 rewards ready and 2 packs unopened (UT badges 6/3/1/2, `14-ut-home.png`), the main tab bar shows a plain "ULTIMATE TEAM". `Tabs` only renders `utNew && <i className="tab-new">FREE</i>`, and App passes `utNew={!profile.ut.starterClaimed}` (`Pages.tsx:71`, `App.tsx:1190`).
- Main Home has no UT tile.
- Main Profile's UT card shows cards, record and packs opened, but nothing claimable (`11-main-profile.png`).

**Player impact.** The draft game is the landing screen. A returning player sees no reason to open UT, even with rewards waiting. This is the biggest broken link in the dopamine loop.

**Fix.**
- Pass the UT inbox count (`inboxReady` plus pending packs) into `Tabs` and show a red count badge.
- Add a one-line "Ultimate Team · 6 rewards ready · 2 packs" strip above the modes on Home. It deep-links to UT → Rewards.

### H5. Dead-end progress screens (high)

**Evidence.**
- **Objectives.** Every unfinished objective has a disabled "IN PROGRESS" chip and no way to go play it (`Clubhouse.tsx:870-885`; `41-ut-ch-objectives.png`).
- **Main Missions sheet.** The only action is DONE (`03-main-missions.png`). "Win a Head to Head match" has no PLAY H2H button.
- **Legends Gauntlet sheet.** The only action is GOT IT (`04-main-gauntlet.png`), and its copy says to "take your team up … from the results screen", so players cannot start from here.
- **Objectives' "1 REWARDS READY · CLAIM READY".** The ready objective was in a different group tab than the one shown, so the player has to hunt for it.

**Fix.**
- Give each objective a target view (`play` / `battles` / `sbc` / `store`) and render a GO → chip when it is not complete.
- Give missions PLAY buttons.
- Open the Gauntlet sheet on "Start with your last finished team", or show which draft qualifies.
- Open Objectives on the group that holds the ready reward. The pluralisation "1 REWARDS READY" is also wrong.

### H6. Brand names and external brand references (high, the owner's constraint)

**Evidence.**
- Player-facing strings use EA FC's own feature names verbatim: "Ultimate Team" and "UT" (the tab, pack art, the title on every UT screen), "Squad Battles", "Rivals", "SBCs / Squad Building Challenges", "Evolutions", "Moments" and "Champions Circuit".
- The card detail links "Peak 2K reference" / "2K… benchmark" / "Madden… benchmark" (`CardDetail.tsx:160-166`).
- The brief says to use "Ultimate Team"-style mechanics with **our own names**.

**Fix.**
- A display-only rename pass, with no ids, keys, routes or claim ids changed. For example: Ultimate Team → "Dynasty Club", Squad Battles → "Ladder", SBCs → "Builds", Evolutions → "Upgrades Lab", Rivals → "Divisions".
- Replace the 2K/Madden link text with "Public ratings benchmark".
- This is the owner's call; I flag it because it is a hard constraint.

### H7. Saturated attribute walls on top cards (high for perceived legitimacy)

**Evidence.**
- `nfl-393/30-ut-card-detail.png`: Tom Brady GOAT has THP 110, SAC 110, MAC 110, DAC 110 and TUP 110.
- Kareem has INS 109, DEF 100 and REB 110 (`nba-393/30`).
- Grid overalls of 108–110 sit next to base golds topping out at 91.

**Player impact.** "Stats feel more legit" is the owner's ask. Five identical maxed numbers read as fake and remove any reason to compare cards.

**Fix.** This belongs to the ratings agents. In the UI, show 99+ as "99" with a "+" glow badge, or show the uncapped value only in the detail sheet. Ratings must differ across the six face stats.

### M1. Home: hint line faded/cut by the PLAY bar; dead gap on Soccer (medium)

**Evidence.**
- At 393×852 (and at 320), the NBA and NFL Home text "1 free team respin and 1 free decade respin every draft." sits directly under the PLAY bar's upward shadow `box-shadow: 0 -14px 18px -6px var(--bg)` (`styles.css:11653-11656`). It reads as half-faded and cut (`nba-393/01-main-home.png`, `nba-320/01-main-home.png`).
- The Training Camp row (NBA/NFL only, `Pages.tsx:217`) uses up the slack.
- On Soccer, with no Training Camp, the same spot is a dead gap of about 50 px (`soccer-393/01-main-home.png`).

**Fix.**
- Move the hint into the selected mode tile's subtitle, or drop it. The How-to sheet already says it.
- Clamp the PLAY shadow to the spacer.
- Fix A (§1.4) adds 22 px of header clearance; Home has room for it only once this line is gone.

### M2. Pack opening: one walkout and thin post-open management (medium)

**Evidence.**
- `*-393/46…49-ut-pack-open-*.png`, and with motion on, `first-nba-393-06-starter-*.png`: Break the Seal, then a single walkout of the best card, then a grid. The grid header counts golds only: "10 GOLDS" over 12 cards (NFL), "4 GOLDS" over 6 (Soccer, `soccer-430/46-ut-pack-open-done.png`).
- Duplicates are handled well: they are auto-stored ("1 duplicate sent to storage"), there is a two-step QUICK SELL DUPES, and SBC FODDER / NEW / UPGRADE +n tags. But the QUICK SELL DUPES button is 133×34 (under 44).
- Beyond that, the result offers only SEE CLUB and DONE. Cards cannot be tapped to inspect or add, and a second top pull gets no walkout.
- Under reduced motion the staged entrance is skipped, which is correct.

**Fix.**
- Tapping a card in the grid should open the card detail with ADD / STORE / SELL.
- Raise QUICK SELL DUPES to 44 px.
- Give every pull above a threshold its own walkout (FC/MUT stack walkouts).
- Make the headline "12 cards · best 79 Surtain", and add a share poster (`ui/poster.ts` exists).

### M3. Match result and debrief (medium)

**Evidence.**
- `sheets/match-res.png` and `match-*-393-04/05-result*.png`. The verdict, box line, rung, rewards, Season Points and breakdown with a coaching tip are good.
- Missing:
  - per-player ratings and a player of the match
  - an animated Season Pass bar
  - objective ticks ("Two games. One goal 1/2")
  - card XP bars with level-ups (it says "+60 XP for every card in your squad" only as text)
- **Soccer:** a 2–2 draw is shown as a big **WIN** with "A tie goes to the better squad: yours." (`match-soccer-393-04-result.png`).
- **NBA:** Squad Battles rung 1 finished **24–2** at Pro difficulty with a 96 OVR squad against 64 OVR (`match-nba-393-04-result.png`).

**Player impact.** Both scorelines undercut "legit". The result screen is the main reward moment and is mostly static text.

**Fix.**
- A results sequence: verdict, then XP/coins counting up, then the Season Pass bar filling (and a level-up burst), then objective checkmarks, then card level-ups.
- Soccer: show DRAW and settle by penalties or a shootout. Never relabel a draw as a WIN.
- Squad Battles: give rung 1 opponents a floor relative to your OVR (a gameplay/economy item for the other agents).

### M4. Long flat pages (medium)

**Evidence.** `report.json` "scroll" (content height / viewport):

| Page | 393 | 320 |
|---|---|---|
| SBCs | 5.7 | 6.7 |
| Development | 4.8 (NBA), 6.1–6.2 (NFL) | 5.5 |
| Store | 3.8 | 4.4 |
| Collection | 3.4 | 4.0 |
| Club Players | 2.4–2.8 | — |
| Play | 2.1 | 2.4 |

SBCs are one long list of big tiles. Production UT groups SBCs into category tiles (Upgrades, Players, Icons, Foundations, Expiring) with counts and NEW/expiring ribbons.

**Fix.**
- **SBCs:** category tiles, then a list, with "Expires in" on season SBCs and a REWARD card preview using the actual card face.
- **Development:** collapse the "select your owned copy" grid behind a picker.
- **Store:** sticky section chips (Your packs · Daily · Featured · All).

### M5. Collection meter (medium)

"39 / 22,082 EDITIONS DISCOVERED", with a bar under 1% (`34-ut-club-collection.png`).

**Fix.** Lead with near-complete sets ("Bulls 1990s · 7/8 · 1 card away") and per-tier completion. Keep the grand total as a footnote.

### M6. Small targets left (medium)

**Evidence.**
- Draft screen, all sports: "Respin team" / "Respin decade" are 172×38, and the DOUBLE / TRADE / PRIME chips are 90–107×40 (`08/09-main-*`).
- Pack opening: SKIP is 65×36 and QUICK SELL DUPES 133×34. At 320, TAP TO CONTINUE is 224×42 and the draft respins drop to 172×36.
- The UT Home season promo chip ("Thirty a Night …" / "Air Raid …") is 141×41.
- At 320 (k = 0.82) these become 28–34 CSS px.

**Fix.** Give each a `::before` hit area to 44, using the existing pattern (`styles.css:11826-11846`).

### M7. First-run funnel (medium)

**Evidence.**
- `sheets/first-a.png`, `first-b.png`: the name step, then team pick, then two stacked modals before a new player sees Home.
  - "Thank you for testing — 9,000 coins", shown to a *brand-new* player.
  - A "Day 1 Reward" chest.
- The welcome copy lists Draft, Climb and Battle, with no mention of Ultimate Team, which is the deepest feature.
- Inside UT the first visit is good: a "FREE · YOUR FIRST SQUAD · OPEN YOUR STARTER PACK" hero card, then the starter walkout and grid (`first-c.png`). After the starter there is no guided next step beyond the generic PLAY card.

**Fix.**
- Gate the tester gift text, or reword it as "Welcome gift".
- Add a 4-step "Starter objectives" chain on UT Home, shown until done, with a reward per step:
  1. Open your free pack
  2. Set your squad
  3. Win a Squad Battle
  4. Complete your first build

### M8. Reset Progress (medium, protects saves)

`RESET PROGRESS` (Settings) needs a single confirm, "ERASE EVERYTHING", in the same button style. It erases the UT club as well (`App.tsx:1203-1211`).

**Fix.**
- Move it under "Advanced".
- Require typing ERASE.
- Show "Cloud save last synced …" first and offer to save.

### M9. Arena loading gap (medium)

**Evidence.** `match-nba-393-01-pre.png` and `match-soccer-393-01-pre.png`: about 1.2 s after PLAY, the screen is black or shows an empty court with only the score bug and the hint.

**Fix.** A VS/intro card that stays until the first frame is drawn: team crests, OVRs and a "Loading arena" bar.

### M10. Season Pass presentation (medium)

**Evidence.** `42-ut-ch-season-pass.png`: three 120 px tiles in a horizontal track (Bronze Pack, 100 coins, Silver Pack), then empty space and two notes.

**Fix.**
- A hero area: "Level 25 reward" with the actual card or pack art and a countdown to season end.
- The track with the current level centred.
- A "next 3 rewards" teaser on UT Home's Season Pass strip.

### M11. External link out of the app (medium)

`CardDetail.tsx:160` uses `target="_blank"` to a ratings site. In an installed PWA this jumps into Safari mid-session.

**Fix.** Show the source as plain text, or in an in-app sheet.

### M12. Collection filters that are always empty; silhouettes hide the chase (medium)

**Evidence.**
- `CollectionGallery.tsx:34` builds the list from `pool.base` only. The Landmark, Program and Weekly Standout editions resolve lazily (`pool.ts`) and are never in it.
- So those tier chips always show "0 EDITIONS · No editions match these filters" (`cards-nba-05/07/08-*.png`), even while Challenges lists Landmark SBCs and eight Standouts this week.
- Missing GOAT, Spotlight, Legend and Hot Season cards render as near-identical dark grey silhouettes (`cards-nba-02…06`), so the gallery never shows what you are chasing.

**Fix.**
- Include the resolved current and past program, Standout and Landmark editions (their ids are stable), or hide empty chips.
- Show missing cards in full colour at 40% opacity with a lock, so each promo's design is the lure.

### M13. Solo matches reuse the online vote screen (medium)

**Evidence.** `vote.mjs` and `ingame-*-1.png`.
- After the 2.5 s VS card, each Squad Battles, Legends Events and Moments game shows "HEAD TO HEAD · TIP-OFF / SIM OR PLAY?" with a 10-second countdown that defaults to PLAY. Measured: vote from 3.0 s to about 13 s.
- Circuit, Club Season and Cups skip it (`Match.tsx:673`).
- The mode is not Head to Head, and the countdown adds up to 10 s of friction before every game.

**Fix.** In solo modes, put PLAY / SIM as two buttons on the VS card, with no countdown and the mode's own name.

### Low

- **L1.** Tab badge numbers (white on red) are 4.28:1, below 4.5 for 10 px text. Use #e5484d or bold 11 px.
- **L2.** Tiny text, in design px (CSS px at 320 is ×0.82): "Find your rhythm. Own the game." 9, Cloud Save subtitle 9, LV ring "LV" 8, "NEW" 9, login-calendar day numbers 9, mission difficulty pills 9.
- **L3.** The Legends Events tab row is a horizontal scroller with no edge fade ("THE IMMORT…" just stops at the frame edge, `23-ut-play-legends-events.png`). Add a mask fade or a "more" chevron.
- **L4.** Truncation: NFL attribute "Throw under pressure", the squad name plate "PEDRO REBOCHO", and "ANTETOKOUNMPO" / "GILGEOUS-ALEXANDER" on grid cards. Use a two-line name plate, or condensed width for long names.
- **L5.** The Weekly Standouts back button folds to a bare chevron (by design for long titles). It is fine, but it is the only sub-screen without a label.
- **L6.** `index.html`/manifest description says "NBA or NFL" with no soccer, and "Super Bowl".
- **L7.** QA limits in the existing harness: `display-mode: standalone` cannot be emulated via CDP, and `.arcade-full` reads `env()`. So neither the standalone `min-height` rule nor in-game insets are covered by any automated run (§1.4 D).
- **L8.** Ranks offline: skeleton rows for about 5 s, then "Can't reach the leaderboard right now. TRY AGAIN" (`ranks-offline-*.png`). That is good. Shorten the skeleton to about 3 s and keep the last cached board.
- **L9.** The Squad Battles ladder header says "YOUR OVR 96" next to rung opponents of 64–84. There is no "recommended difficulty" nudge when you outclass the ladder.

---

## 4. Screen-by-screen notes (all three sports)

Screens not listed here have no issues beyond the IDs above.

| Screen (file no.) | Verdict |
|---|---|
| Main Home (`01`) | Strong hero and mode tiles; PLAY never moves. Its stat chips lead to dead-end sheets (H5). Header: C1. Bottom: M1. |
| How to play (`02`) | A 1.7–2.0 screen text wall. Use a 4-card illustrated carousel per sport. |
| Draft (`08/09`) | Clear reels and slots. Targets under 44 (M6). Soccer's "DM/CM", "CM/AM", "FLEX" need a one-line legend. |
| Ranks (`10`) | Good segmented filters and offline state (L8). |
| Profile (`11`) | A 10-tile grid of zeros and dashes for a new drafter; hide it behind "Play your first draft". The UT card should show claimables (H4). |
| Settings (`12`) | Diagnostics line is excellent for device debugging. Reset: M8. |
| UT Home (`13/14`) | **The best screen in the app.** Continue card, Rewards with CLAIM ALL, This Season with a countdown, Season Pass strip, Daily/Standouts tiles, Preview Pack and squad fan. Missing "next unlock" teasers. |
| Rewards / Daily (`15/16`) | CLAIM ALL (6), rows that navigate, 7-day pips, login calendar, three objectives plus an all-three bonus. A good loop. |
| Play (`18`) | "YOUR NEXT PLAY" with a CTA, mode art, FREE ENTRY flags, Rivals with FIND MATCH. Right pattern. |
| Cups, Club Season, Circuit, UT Draft (`19/20/22/25`) | Clear rules, eligibility, bracket and reward tables, with a sticky CTA. |
| Squad Battles (`21`) | Locked ladder and difficulty multipliers (L9). |
| Legends Events, Moments (`23/24`) | Clear numbered challenges (L3). |
| Rivals (`26`) | Division shield, RP meter, climb list. "Updating board…" offline is fine. |
| Squad (`27`) | Pitch/court/field with chemistry lines, bench, AUTO, LINEUPS, formations. Close to MUT/FC mobile quality except the card faces (H2/H3). |
| Club Players, Filter, Card detail (`28–31`) | Good filter sheet with a count CTA. Rich detail: abilities, real season line, level bar. H1, H3, H7, M11. |
| Pack Tracker, Storage, Records (`32/33/17`) | Proper empty states with icon, line and CTA. |
| Collection, Sets, Development, Evolutions (`34–37`) | M5 and M4. Sets with progress/CLAIM and evolution caps/requirements are clear. |
| SBCs, Standouts (`38–40`) | Live requirement checks, AUTO-FILL, Streamlined progress; the featured Standout and "how to get them" are strong. Length: M4. |
| Objectives, Season Pass (`41/42`) | H5, M10. |
| Store, pack opening (`43–49`) | Limited stock, Odds on every pack, Preview Pack: honest and good. Arena and clue staging, SKIP, NEW/SET/UPGRADE tags. H3, M2. |
| Match / Result (`match-*`) | M3, M9. |

**At 430×932** the layout is the same as 393 scaled ×1.10 (k = 1.103), by design. No extra issues appeared: every walk at 430 had 0 clipped, 0 offscreen and the same small-target list as 393.

**At 320×568** (k = 0.82) everything fits and scrolls correctly, with:
- the same M1 cut on Home
- one more small target: pack-open TAP TO CONTINUE at 224×42
- small targets shrinking to 30–34 CSS px (respins 172×36 design)
- 9–11 px design text rendering at 7.4–9 CSS px
- the NFL squad's OL row overlapping ("LOGAN MANKI…" truncated, `nfl-320/27-ut-squad.png`)
- longer pages (M4)

iOS 26 requires an iPhone ≥ 375 wide, so 320 matters only for older iOS.

---

## 5. Does the app lead players to the next action? (dopamine-loop review)

**Already present, and must be preserved:**
- daily drop streak and 7-day login calendar
- three daily objectives plus a bonus, with weekly and lifetime objectives
- a 25-level Season Pass and the This Season live calendar with countdowns
- Weekly Standouts with a featured card
- Lightning windows, Preview Pack, and a Scout Market that refreshes daily
- limited-stock packs
- Sets and collection milestones
- Club Cups with weekly titles, Champions Circuit with weekly entries, the UT Draft ladder, Rivals divisions with RP meters, and the Squad Battles ladder
- Evolutions and Development programs
- New Era bundle
- a Rewards inbox with CLAIM ALL, and tab badges that count only claimables
- the "YOUR NEXT PLAY" recommendation

**Missing hooks** (ordered by expected impact):
1. **A bridge from the landing screen** (H4): a UT count badge on the main tab and a "6 rewards · 2 packs" strip on Home.
2. **GO links everywhere progress is shown** (H5): objectives, missions, Gauntlet, the Season Pass ("Earn 300 SP → Play"), and Sets ("1 card away → SBC / Store").
3. **A post-match reward sequence** (M3): count-ups, the Season Pass bar, objective ticks, card level-ups, and "next unlock in X".
4. **Starter objectives chain** for new players (M7).
5. **Pack management after opening** (M2), plus a per-pull walkout for more than one top card.
6. **Visible goals with art:** Season Pass level 25 hero, SBC reward card faces, Standout and Icon pick previews (M10, M4).
7. **Near-miss framing:** "1 card away", "2 wins to Pro", "1 more game for the daily bonus" chips on UT Home.
8. **Streak loss warning.** The UT Home Daily tile already says "Open Day 1 · 6 days to a Gold Pack", and that should stay. Add a last-hours warning ("Claim before midnight ET or the streak resets") and a matching dot on the HOME tab.
9. **Account level-up celebration** in UT. It exists only on draft Results (`ui/Results.tsx:176`).
10. **Session-end teaser** on EXIT from UT: "Tomorrow: Day 2 of 7 — 300 coins".
11. *(Optional; needs a push backend, which installed iOS PWAs ≥ 16.4 support)* "Your Daily Drop is ready". Coins-only, no ads.

---

## 6. What already works well and must be preserved

- **Navigation model.** The `nav.ts` single map (title, tab and parent per view): 4 main tabs, 6 UT tabs, segments with claim counts, back labels naming the parent, EXIT on UT Home, and "a tab tapped from its sub-screen goes back up". No dead taps were found in about 150 screens × 3 widths. Every step in every walk resolved.
- **Badges count claimables only.** No chore badges.
- **Layout robustness.** Across 9 walks: zero horizontal overflow, document scroll, off-frame elements, clipped non-ellipsis text and page errors. `.page` children never squeeze, PLAY and the tab bars stay pinned, and Cups and the card detail keep a sticky CTA (fix only H1's offset).
- **Empty and error states.** Storage, Pack Tracker, Club Records and Ranks offline with TRY AGAIN.
- **Trust features.** Odds on every pack, the Pack Tracker, limited-stock labels, Preview Pack, "Each copy keeps its own level" and serial notes.
- **UT Home action hub, Play's "YOUR NEXT PLAY", the Rewards inbox CLAIM ALL, and the Daily loop.** These are the right production patterns. Extend them; don't replace them.
- **Visual identity.** Archivo condensed italic, teal/gold, gold gradient titles and SVG icons, consistent across all three sports. Add depth on top; don't replace them.
- **Pack cinema.** Seal break, clue walkout, tier-aware timing, SKIP, reduced-motion handling, duplicate auto-storage with QUICK SELL, and NEW/UPGRADE/SBC FODDER tags.
- **Squad screen** with chemistry lines and formation switch, and the **SBC** live requirement checks with AUTO-FILL.
- **Stage model.** A 390 frame scaled to width, with heights flexing. §1's fix adds a clearance on top of it; it must not reintroduce `screen.height` guesses or width media queries.

---

## 7. Suggested fix order

1. **C1:** Fix A (stage edge clearance plus `.arcade-full`) and Fix B (status plate). Then get a device screenshot from the owner.
2. **H1:** the card-detail bar offset. One CSS rule.
3. **H4 + H5:** UT badge and Home strip, then GO links on objectives, missions and Gauntlet.
4. **M1, M6, M13:** Home hint, the remaining small targets, and the solo vote screen.
5. **H2 + H3:** appearance table and front-facing bust, then the edition frame system and pack themes. Coordinate with the character/animation agent.
6. **M2, M3, M10, M12:** pack-open management, the results sequence, Season Pass hero, and Collection filters and colour previews.
7. **H6:** display-name rename. The owner decides.
8. **H7, M3 scorelines:** with the ratings and gameplay agents.

None of these changes touch saves, keys, card or edition ids, or online protocols. H2, H3 and C1 in-game are render-only, so no queue bump. Soccer's draw display (M3) is presentation only, unless the settlement itself changes; that would need a soccer UT protocol bump.

*Sources for the iOS 26 behaviour:* [WebKit bug 301756 (top bar tint / colour extension only with fixed or sticky elements; softer blur on iPhone)](https://bugs.webkit.org/show_bug.cgi?id=301756). Related standalone viewport bugs: [301108](https://bugs.webkit.org/show_bug.cgi?id=301108), [301994](https://bugs.webkit.org/show_bug.cgi?id=301994), [316008](https://bugs.webkit.org/show_bug.cgi?id=316008). The measurements in §1.1 are from the owner's screenshot itself.
