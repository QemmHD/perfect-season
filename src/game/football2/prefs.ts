// The football screen's own local preferences (Claude, studio overhaul): a pass layout, how many
// defensive snaps to play, a play-stats roll-up. They live only on this device, under their own
// keys, never in a profile or a cloud save. Every read and write goes through here: a missing key,
// a value that isn't one the preference allows, or storage that is blocked or throws all give the
// preference's default, and a write that can't be stored is dropped (the game plays on).

/** A preference: its storage key, its default, and how a stored string becomes a value (or not). */
export interface Pref<T> {
  key: string;
  fallback: T;
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

/** One of a fixed set of words. */
export function choicePref<T extends string>(key: string, choices: readonly T[], fallback: T): Pref<T> {
  return { key, fallback, parse: (raw) => (choices as readonly string[]).includes(raw) ? (raw as T) : undefined, serialize: (v) => v };
}

/** On or off. */
export function flagPref(key: string, fallback: boolean): Pref<boolean> {
  return { key, fallback, parse: (raw) => (raw === '1' ? true : raw === '0' ? false : undefined), serialize: (v) => (v ? '1' : '0') };
}

/** A JSON value, kept only when `check` accepts what was parsed (it returns the typed value or undefined). */
export function jsonPref<T>(key: string, fallback: T, check: (x: unknown) => T | undefined): Pref<T> {
  return {
    key,
    fallback,
    parse: (raw) => {
      try {
        return check(JSON.parse(raw));
      } catch {
        return undefined;
      }
    },
    serialize: (v) => JSON.stringify(v)
  };
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readPref<T>(pref: Pref<T>): T {
  try {
    const raw = storage()?.getItem(pref.key);
    if (raw === null || raw === undefined) return pref.fallback;
    const v = pref.parse(raw);
    return v === undefined ? pref.fallback : v;
  } catch {
    return pref.fallback;
  }
}

/** Store a value; false when storage is unavailable (the value just isn't remembered). */
export function writePref<T>(pref: Pref<T>, value: T): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(pref.key, pref.serialize(value));
    return true;
  } catch {
    return false;
  }
}
