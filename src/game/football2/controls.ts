// Codex: screen-relative, full two-axis movement. Field y increases toward the far end zone.
import type { Pt } from './types';

/** Radial dead zone removes thumb jitter; full deflection retains the full speed budget. */
export function screenRunInput(x: number, y: number, view: 'end' | 'side'): Pt {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0.12) return { x: 0, y: 0 };
  const strength = (Math.min(1, length) - 0.12) / 0.88;
  const sx = (x / length) * strength,
    sy = (y / length) * strength;
  return view === 'side' ? { x: -sy, y: sx } : { x: sx, y: -sy };
}
