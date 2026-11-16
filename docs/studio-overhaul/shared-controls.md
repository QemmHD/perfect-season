# Shared match controls (V2 A.5): how a sport mounts them

Written by team nba in nba-2 (2026-11-16), to the contracts in
[`nba-plan.md` §4.1–4.3 and §4.7](nba-plan.md#4-the-shared-v2-pieces-nba-writes-interface-contracts).
nfl and soccer consume these files and may make small hunks in them (OWNERSHIP V2 grants). Any signature
change is logged in [`nba.md`](nba.md) under "Contract changes".

| File | What it is |
|---|---|
| `src/game/controls-geometry.css` | The A.5 geometry as CSS tokens on `.ps-geo` (no width media queries; `.ps-geo.land` for sideways) |
| `src/game/stick.ts` | The floating stick's rules, pure: dead zone 12%, sprint at 1.15 R, follow at 1.6 R, home band, fixed mode |
| `src/game/Stick.tsx` | The stick on screen: ghost ring, spawn under the thumb, pre-held thumb adoption, one report per frame |
| `src/game/hud/gestures.ts` | `classify` (tap / hold / swipe) and `ClusterTracker`, the pure pointer bookkeeping |
| `src/game/hud/Cluster.tsx` | The A/B/C/D buttons, the SVG swipe labels, the Buttons-only arc, and `Radial` (the CALL menu) |
| `src/game/hud/ToastLine.tsx` | `ToastProvider`, `useToast`, `ToastLine`: the one line of text above the controls |
| `src/game/hud/PauseButton.tsx`, `PauseSheet.tsx` | The 44 px pause button and the sheet (Resume, sport items, Quit with a confirm) |
| `src/game/hud/timers.ts` | `PausableTimers`: delayed match steps that stop with a pause |
| `src/game/hud/prefs.ts` | `perfect-season:touch-prefs:v1` (gestures/buttons, calibration, seen hints, Auto-defend) |
| `src/game/hud/feel.ts` | `haptic('tick' / 'double' / 'long' / 'heartbeat')`, `chime(streak)`, `ringTick()` shims, counted in `feelCount` |
| `src/game/hud/hud.css` | Every style above: glossy gold / teal / glass buttons, the radial, toast, pause, sheet, scrim |
| `src/game/hud/index.ts` | One import for all of it (also pulls in both CSS files) |

## The rules every sport keeps

- **Everything fires on touch-down.** `Cluster` delivers `{ phase: 'down' }` from `pointerdown`; a swipe
  arrives with the `'move'` that makes it one; the tap / hold lands with `'up'`. Use the event's `t`
  (`PointerEvent.timeStamp`) for anything timed, never the frame that heard it.
- **One meaning per gesture per context.** Map your contexts to `Record<Slot, SlotSpec>` in a pure function
  and test it (nba: `hoops2/HoopsControls.tsx slotsFor`).
- **At most four right-thumb targets, none above 2/3 of the height.** Hide what a context doesn't use
  (`hidden: true`); D is free for the sport that needs a fourth button.
- **The disabled state comes from the loop**, every frame, as a `data-off` attribute ("a b c d") on an
  ancestor of the cluster; `.ps-ctl-btn.off` / `[data-off~='a']` dim it. Buttons stay pressable (the
  engine call is the real gate): a `disabled` attribute would swallow the pointer events.
- **Everything the game says goes in the toast line.** Priorities: hints 0, calls and banners 1,
  results 2. A toast replaces the one showing unless that one has a higher priority and is still up.
- **Pause offline means frozen**: no engine steps, no timer callbacks (`PausableTimers`), the toast's
  clock stopped (`ToastProvider paused`), auto-pause on `visibilitychange` / `pagehide`. Online the sheet
  opens and says the game keeps going.
- **The stick's output is never null** (`{ x: 0, y: 0, mag: 0 }` when centred). Your engine decides what a
  centred stick means.
- **Haptics through `feel.ts`**: `tick` for input accepted (the sprint edge, a CALL pick), `long` for a
  turnover against you. Pass `inTouch = true` when you call it from inside a pointer handler (iOS plays
  its tick only there).

## Geometry tokens (`.ps-geo`)

Interpolated by viewport width between the 320 and 393 values and clamped outside, e.g.
`--ctl-a-d: clamp(84px, calc(84px + (100vw - 320px) * 8 / 73), 92px)`. Offsets are from the safe-inset
edge to the element's outer edge, so A sits at `right: calc(var(--sar) + var(--ctl-a-r)); bottom:
calc(var(--sab) + var(--ctl-a-b))`.

| Token | 320 → 393 | |
|---|---|---|
| `--ctl-a-d/-r/-b` | 84→92, 12→24, 16→34 | A |
| `--ctl-b-d/-r/-b` | 56→64, 102→123, 4→8 | B |
| `--ctl-c-d/-r/-b` | 44→48, 98→119, 78→100 | C |
| `--ctl-d-d/-r/-b` | 44→48, 16→29, 110→142 | D |
| `--stick-d/-l/-b`, `--stick-zone-w`, `--stick-zone-top` | 104→120, 18→24, 20→28; 48vw; 45vh | stick ghost and zone |
| `--bug-w/-h/-t`, `--heat-h/-t` | 200→232, 34→40, 4→6; 5→6, 40→49 | score bug and Heat bar (nba-3) |
| `--pause-l/-t` | 6→12, 0→4 | pause, 44×44 |
| `--toast-b/-h` | 164→234, 24→28 | toast line bottom edge above the viewport bottom; height |
| `--safe-t/-b` | 56; 200→284 | action-safe box (nba-3) |
| `--scrim-h` | 240 | the bottom scrim |
| colours | `--ps-gold #f6b93b`, `--ps-teal #4fe3c1`, `--ps-red #ff5d5d`, `--ps-violet #8b7cf6`, `--ps-glass`, `--ps-stroke #1d3a50` | V2 C.3 |

`.ps-geo.land` (set from JS when the game is wider than tall) keeps the 393 sizes anchored to the
corners and moves the toast under the score bug.

## Mounting it: a 20-line example

```tsx
import { Cluster, PauseButton, PauseSheet, PausableTimers, ToastLine, ToastProvider, haptic, type ClusterInput } from '../hud';
import { Stick } from '../Stick';

function MyMatch({ online, onQuit }: { online: boolean; onQuit?: () => void }) {
  const toast = useRef<{ show(t: Toast): void; clear(): void } | null>(null);
  const timers = useRef(new PausableTimers()); // every delayed step: timers.current.set(fn, ms)
  const [paused, setPaused] = useState(false); // the loop skips its steps while true
  const stick = useRef<StickOut | null>(null); // read it in the loop
  const onInput = (e: ClusterInput) => { if (e.slot === 'A' && e.phase === 'down') startKick(e.t); };
  return (
    <div className={'arcade-full ps-geo' + (wide ? ' land' : '')}>
      <ToastProvider paused={paused} apiRef={toast}>
        <canvas />
        <div className="ps-scrim" />
        <Stick onChange={(o) => (stick.current = o)} onSprintEdge={() => haptic('tick')} />
        <Cluster slots={slotsFor(context)} onInput={onInput} />
        <ToastLine />
        <PauseButton onPause={() => (timers.current.pause(), setPaused(!online))} />
        <PauseSheet open={paused} online={online} onResume={() => (timers.current.resume(), setPaused(false))} onQuit={onQuit} />
      </ToastProvider>
    </div>
  );
}
```

NBA's full wiring is `src/game/hoops2/Hoops2.tsx` (the loop, the engine calls) with
`src/game/hoops2/HoopsControls.tsx` (contexts to slots, the stick, the cluster and the CALL radial).

## Details worth knowing

- **The stick's zone is a target region of its own.** A second finger that taps inside it while the
  stick is held comes out as `onOtherTap(x, y, t)` (nba passes to the teammate there), so the stick's own
  finger can never trigger anything else.
- **Pre-held thumb.** The stick tracks its pointer even while `disabled`, and reports the moment it
  enables. Simpler still (what nba does): keep it enabled and store its output between plays, so the
  first step of the next play already has the direction.
- **Swipes only on slots with `swipes: true`**, and never in Buttons-only mode (`buttonsOnly`), which
  shows `arc` items around D's spot instead (they fire on down).
- **The radial** opens above its slot; tap an item (it fires on down), or slide from the slot and lift
  on an item: pass the lift point from the slot's `'up'` event to `radialAt(x, y)`.
- **Gesture thresholds** (`gestures.ts`): tap < 120 ms and < 12 px; swipe ≥ 36 px within 250 ms; else
  hold. A finger that drifts ≥ 12 px reports `dist` on its `'move'` events, so a provisional action can
  be taken back before the swipe is certain.
- **Reduced motion** (hud.css): the toast pop and slide, the sheet's entrance, the radial's spring and
  the press-sink are all off; colours stay.

## Contract changes made in nba-2 (also in `nba.md`)

- `ClusterInput` gained optional `dist`, `x`, `y` (where the finger is, and how far it travelled).
- `ToastProvider` (new export) takes `paused` and `apiRef`; `ToastLine()` reads it from context.
- `geomFrom(el, opts?)` takes optional `{ floating, sprint }`; `stickGeom(...)` builds a geometry with the
  default ratios.
- `PauseButton` takes an optional `label`; `PauseSheet` exports a `SheetToggle` row for sport items.
- `PausableTimers` (`hud/timers.ts`) and `firstTime(sport, bit)` (`hud/prefs.ts`) are new helpers.
