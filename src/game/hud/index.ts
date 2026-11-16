// The shared match HUD kit (plan §4.3): every sport mounts these. See docs/studio-overhaul/shared-controls.md.
import '../controls-geometry.css';
import './hud.css';

export { classify, ClusterTracker, travel, type ClusterInput, type Gesture, type GPoint, type Slot } from './gestures';
export { Cluster, Radial, radialAt, type SlotSpec } from './Cluster';
export { ToastLine, ToastProvider, useToast, type Toast, type ToastTone } from './ToastLine';
export { PauseButton } from './PauseButton';
export { PauseSheet, SheetToggle } from './PauseSheet';
export { firstTime, loadPrefs, PREFS_KEY, savePrefs, type TouchPrefs } from './prefs';
export { chime, feelCount, haptic, ringTick, type HapticPattern } from './feel';
export { PausableTimers } from './timers';
export { Stick } from '../StickPad';
export * from '../stick';
export { ScoreBug, type BugProps, type HeatView } from './ScoreBug';
export { HeatBar, HEATING_UP } from './HeatBar';
export { readGeometry, intersects, type Geometry } from './geometry';
