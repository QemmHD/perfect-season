# Screen-fit correction

Implemented by **Codex (OpenAI), 2026-11-07**, after the owner reported the installed app still did not fit the phone screen. The supplied image was approximately 393×853 logical points, showing Soccer Home. The exact phone/iOS version was not available during implementation.

## Verified causes in source

1. `Stage.measure` sized the game from the fixed root/layout viewport. Safari's visible viewport can be smaller while browser controls or the keyboard are present; fixed controls could therefore sit outside the visible area.
2. The phone scale depended on height through `MIN_CONTENT`. A keyboard or short viewport could shrink the entire 390px game frame and introduce side gutters instead of just reducing the content area.
3. Rotation inferred a sideways phone from `width > height`. An upright phone with an open keyboard can satisfy that condition and be rotated incorrectly.
4. Installed-app recovery guessed full height from `screen.height`, enlarged the HTML document, allowed body scrolling, performed a one-pixel document scroll and briefly hid/re-showed the root. These workarounds were documented for WebKit issue 301108, but were not a reliable source of actual visible geometry and could also reset animation/scroll state.

## Changes

`src/stage-layout.ts` contains pure viewport/frame geometry. At normal browser zoom, the visual viewport's dimensions and offset define the visible container. Layout dimensions remain a fallback when that API is absent or invalid. A larger advertised device screen never overrides a valid smaller visible viewport. When browser zoom is active, normal layout geometry remains stable and the browser applies zoom once.

Phones always fill the visible width with the existing 390px design frame. Visible height changes the frame height and existing compact/tight layout class; it no longer shrinks the whole app. Long Home content scrolls within its existing content region while PLAY and the bottom tabs remain anchored. Safe-area padding stays inside the measured frame. A known portrait orientation blocks aspect-ratio-based rotation when the keyboard opens; real landscape angles retain the game's existing portrait lock.

The standalone forced-document-height/scroll/re-layout workarounds are removed. Resize, visual-viewport scroll, rotation, foreground return and keyboard dismissal only trigger bounded remeasurement. All delayed measurements/listeners are cleaned up. `frameRect` also accounts for the visible-container origin, preserving hit/gesture coordinates when the visible viewport pans. Settings viewport diagnostics now include visual dimensions, scale and offsets.

The existing Home content scroller, primary PLAY action and sport selector are retained; no other game-mode styling or layout is redesigned by this change.

## Files and compatibility

- `src/stage-layout.ts`: pure visible-viewport, orientation and frame geometry.
- `src/stage.tsx`: browser measurement/listeners/container and frame-coordinate translation; existing `useLayout`, `Layout`, `Fit`, `Rot`, `DESIGN_W`, `frameRect`, `frameY` exports remain compatible.
- `src/styles.css`: removes standalone document-growth/scroll rules.
- `src/stage-layout.test.ts`: bounded geometry regressions.
- `scripts/qa/screen-fit.mjs`: real Home rendered under explicit safe-area/viewport simulations.

No account keys, profiles, save fields, wallet, cards, owned-copy identities, serials, progression, queue protocols, registry or backend connections change.

## Verification and limits

Pure geometry tests: **13 passed**, covering 393×852, 390×844, 375×667, 430×932 and 320×568 with 59pt/34pt insets; Safari browser-control shrinkage; a standalone root reporting short while the visual viewport is accurate; refusal to guess a larger physical-screen height; keyboard aspect ratio/scale; browser pinch zoom; both landscape rotations; bounded desktop framing; initial missing dimensions.

The browser matrix renders actual Soccer Home, checks the stage against the visible viewport, PLAY above the tabs, visible sport selection, no document scrolling, and captures normal and compact phones. It also simulates a 743pt visible browser area, a 310pt keyboard area and landscape rotation. Parent release notes record final browser/build/publication results.

**Device limit:** Chromium safe-area and visual-viewport simulations are not an actual iOS standalone device or a reproduction of every WebKit 301108 condition. If WebKit itself reports both layout and visual height incorrectly, this implementation deliberately does not force `screen.height` over those reports; a physical iPhone check remains necessary. It fixes verified geometry errors and provides useful viewport diagnostics without claiming untested OS recovery behavior.

### Completed browser matrix

`screen-fit.mjs` passed **both standalone and Safari simulations** across all five phone sizes (10 rendered layouts), plus browser controls at 743 visible pixels, keyboard height 310 pixels without rotation/whole-app zoom, restored full height, and landscape rotation. Every run retained visible sport selection, PLAY above the tabs, no horizontal stage crop and no outer-document scrolling. **Zero page errors.** Screenshots are actual current Home components under simulated insets/viewport metrics, not physical iPhone captures: `/tmp/perfect-season-screen-fit/screen-fit-standalone-393x852.png`, `screen-fit-standalone-320x568.png`, and the other size/control/rotation files in the same directory.

The existing compact Home presentation still omits optional hero decoration and leaves flexible space above the pinned PLAY action. This update does not claim to remove every design gap or fit every scrollable panel’s complete contents onto one short screen. It keeps the app frame and fixed controls inside the visible viewport while preserving internal scrolling and readable width scale.
