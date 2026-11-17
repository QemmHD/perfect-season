// Codex (OpenAI): recipe snapshots keep already-awarded packs independent of future edits.
import { useSyncExternalStore } from "react";
import type { UtSport } from "../ut/types";
export const STUDIO_PACKS = ["roster", "captains", "dynasty"] as const;
export type StudioKind = (typeof STUDIO_PACKS)[number];
export const STUDIO_TIERS = ["silver", "gold", "rare", "standout"] as const;
export interface StudioPack {
  name: string;
  price: number;
  enabled: boolean;
  counts: Record<(typeof STUDIO_TIERS)[number], number>;
}
export type Catalog = Record<StudioKind, StudioPack>;
const defaults: Catalog = {
  roster: {
    name: "Roster Builder",
    price: 1800,
    enabled: true,
    counts: { silver: 6, gold: 3, rare: 1, standout: 0 },
  },
  captains: {
    name: "Captains Pack",
    price: 4200,
    enabled: true,
    counts: { silver: 0, gold: 3, rare: 2, standout: 1 },
  },
  dynasty: {
    name: "Dynasty Pack",
    price: 8000,
    enabled: true,
    counts: { silver: 0, gold: 5, rare: 4, standout: 2 },
  },
};
const catalogs: Partial<Record<UtSport, Catalog>> = {},
  listeners = new Set<() => void>();
let revision = 0;
export function defaultCatalog(sport: UtSport): Catalog {
  const c = JSON.parse(JSON.stringify(defaults)) as Catalog;
  const prices = {
    nba: [1500, 2400, 4400],
    nfl: [900, 1000, 1900],
    soccer: [1000, 2300, 4300],
  }[sport];
  STUDIO_PACKS.forEach((k, i) => {
    c[k].price = prices[i];
  });
  if (sport === "nfl")
    for (const p of Object.values(c)) {
      p.counts.gold *= 2;
      p.counts.silver *= 2;
    }
  return c;
}
export function catalogOf(sport: UtSport): Catalog {
  return catalogs[sport] ?? defaultCatalog(sport);
}
export function checkedCatalog(raw: unknown): Catalog | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as Catalog;
  for (const k of STUDIO_PACKS) {
    const p = (raw as Catalog)[k];
    if (
      !p ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.trim().length > 32 ||
      !Number.isSafeInteger(p.price) ||
      p.price < 500 ||
      p.price > 100000 ||
      typeof p.enabled !== "boolean" ||
      !p.counts
    )
      return null;
    try {
      encodeURIComponent(p.name);
    } catch {
      return null;
    }
    const counts = {} as StudioPack["counts"];
    for (const tier of STUDIO_TIERS) {
      const n = p.counts[tier];
      if (!Number.isSafeInteger(n) || n < 0 || n > 20) return null;
      counts[tier] = n;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total < 1 || total > 40) return null;
    out[k] = {
      name: p.name.trim(),
      price: p.price,
      enabled: p.enabled,
      counts,
    };
  }
  return out;
}
export function setCatalog(sport: UtSport, catalog: Catalog) {
  const checked = checkedCatalog(catalog);
  if (!checked) throw Error("Invalid pack catalog");
  catalogs[sport] = checked;
  revision++;
  listeners.forEach((fn) => fn());
}
export function useCatalog() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => revision,
    () => revision,
  );
}
export function studioKind(k: string): k is StudioKind {
  return STUDIO_PACKS.includes(k as StudioKind);
}
export function snapshotPack(sport: UtSport, kind: string): string {
  if (!studioKind(kind)) return kind;
  const p = catalogOf(sport)[kind];
  return (
    "studio:" +
    kind +
    ":" +
    STUDIO_TIERS.map((t) => p.counts[t]).join(",") +
    ":" +
    encodeURIComponent(p.name)
  );
}
export function readPackSnapshot(
  kind: string,
): { base: StudioKind; pack: StudioPack } | null {
  const parts = kind.split(":");
  if (parts.length !== 4 || parts[0] !== "studio" || !studioKind(parts[1]))
    return null;
  try {
    const counts = Object.fromEntries(
      parts[2].split(",").map((n, i) => [STUDIO_TIERS[i], Number(n)]),
    );
    if (parts[2].split(",").length !== 4) return null;
    const c = JSON.parse(JSON.stringify(defaults));
    c[parts[1]] = {
      name: decodeURIComponent(parts[3]),
      price: 500,
      enabled: true,
      counts,
    };
    const valid = checkedCatalog(c);
    return valid ? { base: parts[1], pack: valid[parts[1]] } : null;
  } catch {
    return null;
  }
}
