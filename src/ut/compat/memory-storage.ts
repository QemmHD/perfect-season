// Claude, 2026-11-10 (studio overhaul, team ut): a localStorage stand-in, so the save-compatibility
// tests (studio-compat.test.ts) and scripts (scripts/compat/) can load, save and sync profiles the way
// the app does. profile.ts reads localStorage on each call, never at import, so pointing the global
// at one of these before a call is enough.

export class MemoryStorage {
  private m = new Map<string, string>();
  constructor(init: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(init)) this.m.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  /** Every key, its value parsed as JSON where it is JSON. */
  dump(): Record<string, unknown> {
    return Object.fromEntries(
      [...this.m].map(([k, v]) => {
        try {
          return [k, JSON.parse(v)];
        } catch {
          return [k, v];
        }
      }),
    );
  }
}

/** Point the global localStorage at `s`. */
export function useStorage(s: MemoryStorage): MemoryStorage {
  (globalThis as { localStorage?: unknown }).localStorage = s;
  return s;
}
