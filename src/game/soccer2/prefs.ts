// Soccer's device preferences (Claude 2026-11-16, studio overhaul soccer-2; plan §5.9). One small
// device-local key, never in cloud saves or checkpoints. It has never shipped before this, so its
// shape is set here; later fields are optional and additive. Unknown fields are kept on a round trip
// (a newer build's fields survive an older one). Nothing that both phones compute reads it: no
// engine, AI simulation, takeover, sim or Daily Play imports this module (prefs.test checks the
// import graph), so a preference can never make two phones disagree.

export const PREFS_KEY = 'perfect-season:soccer-prefs:v1';

export type AutoSwitch = 'on' | 'cross' | 'off';

export interface SoccerPrefs {
  v: 1;
  /** solo defend phases play themselves (nba's meaning; soccer-9) */
  autoDefend: boolean;
  /** in defence, control moves to the defender nearest the ball: always, on a cross, or never (soccer-8) */
  autoSwitch: AutoSwitch;
  /** shot types from visible buttons instead of gestures on SHOOT (soccer-6) */
  buttonsOnly: boolean;
  /** fields from a newer build, kept as they were */
  [extra: string]: unknown;
}

export const DEFAULT_PREFS: Readonly<SoccerPrefs> = { v: 1, autoDefend: false, autoSwitch: 'on', buttonsOnly: false };

const SWITCH: readonly AutoSwitch[] = ['on', 'cross', 'off'];

/** Whatever was stored (absent, garbage, an older or newer shape) as a valid preference set. */
export function prefsOf(raw: unknown): SoccerPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    ...o,
    v: 1,
    autoDefend: typeof o.autoDefend === 'boolean' ? o.autoDefend : DEFAULT_PREFS.autoDefend,
    autoSwitch: SWITCH.includes(o.autoSwitch as AutoSwitch) ? (o.autoSwitch as AutoSwitch) : DEFAULT_PREFS.autoSwitch,
    buttonsOnly: typeof o.buttonsOnly === 'boolean' ? o.buttonsOnly : DEFAULT_PREFS.buttonsOnly,
  };
}

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
const store = (): Store | null => {
  try {
    return (globalThis as { localStorage?: Store }).localStorage ?? null;
  } catch {
    return null;
  }
};

export function loadPrefs(s: Store | null = store()): SoccerPrefs {
  try {
    const raw = s?.getItem(PREFS_KEY);
    return prefsOf(raw ? JSON.parse(raw) : null);
  } catch {
    return prefsOf(null);
  }
}

/** Save a change (merged over what is stored, so unknown fields stay); returns what was saved. */
export function savePrefs(change: Partial<Omit<SoccerPrefs, 'v'>>, s: Store | null = store()): SoccerPrefs {
  const next = prefsOf({ ...loadPrefs(s), ...change });
  try {
    s?.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // private mode or a full store: the change holds for this match only
  }
  return next;
}
