// One sport-neutral, per-device key for the touch preferences (plan §4.7): the release calibration,
// gestures or buttons, the meter, the one-line hints already seen, Auto-defend. Never in the profile,
// the cloud save or the recovery lists; a missing, corrupt or old-shape value reads as the defaults,
// and a save touches no other key.
import type { SportId } from '../../engine/sport';

export const PREFS_KEY = 'perfect-season:touch-prefs:v1';

export interface TouchPrefs {
  v: 1;
  /** calibration, shared by all sports (ms) */
  offsetMs?: number;
  controls?: 'gestures' | 'buttons';
  meter?: 'on' | 'off';
  /** bitmask of seen one-line hints, per sport */
  hints?: Partial<Record<SportId, number>>;
  autoDefend?: Partial<Record<SportId, boolean>>;
}

const SPORTS: SportId[] = ['nba', 'nfl', 'soccer'];
const DEFAULTS: TouchPrefs = { v: 1 };

const store = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

/** Only the fields we know, each checked: anything else is dropped. */
function clean(raw: unknown): TouchPrefs {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return { ...DEFAULTS };
  const r = raw as Record<string, unknown>;
  const out: TouchPrefs = { v: 1 };
  if (typeof r.offsetMs === 'number' && Number.isFinite(r.offsetMs) && Math.abs(r.offsetMs) <= 250) out.offsetMs = r.offsetMs;
  if (r.controls === 'gestures' || r.controls === 'buttons') out.controls = r.controls;
  if (r.meter === 'on' || r.meter === 'off') out.meter = r.meter;
  for (const field of ['hints', 'autoDefend'] as const) {
    const v = r[field];
    if (!v || typeof v !== 'object') continue;
    const m: Record<string, number | boolean> = {};
    for (const s of SPORTS) {
      const x = (v as Record<string, unknown>)[s];
      if (field === 'hints' && typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 2 ** 30) m[s] = x;
      if (field === 'autoDefend' && typeof x === 'boolean') m[s] = x;
    }
    if (Object.keys(m).length) (out as unknown as Record<string, unknown>)[field] = m;
  }
  return out;
}

/** Missing, corrupt or an old shape: the defaults. Never throws. */
export function loadPrefs(): TouchPrefs {
  const s = store();
  if (!s) return { ...DEFAULTS };
  try {
    const raw = s.getItem(PREFS_KEY);
    return raw ? clean(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Read-modify-write of this one key; the per-sport maps merge. */
export function savePrefs(patch: Partial<TouchPrefs>): void {
  const s = store();
  if (!s) return;
  const cur = loadPrefs();
  const next: TouchPrefs = { ...cur, ...patch, v: 1 };
  if (patch.hints) next.hints = { ...cur.hints, ...patch.hints };
  if (patch.autoDefend) next.autoDefend = { ...cur.autoDefend, ...patch.autoDefend };
  try {
    s.setItem(PREFS_KEY, JSON.stringify(clean(next)));
  } catch {
    // storage full or blocked: the preference lasts this session only
  }
}

/** A one-line hint, once per device: true the first time (and marks it seen). */
export function firstTime(sport: SportId, bit: number): boolean {
  const seen = loadPrefs().hints?.[sport] ?? 0;
  if (seen & (1 << bit)) return false;
  savePrefs({ hints: { [sport]: seen | (1 << bit) } });
  return true;
}
