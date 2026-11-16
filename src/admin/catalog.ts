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
  // Claude (packs-2): golds on the per-overall curve sell for more, so the Roster Builder returned 65-70%
  // of its price (NBA 1,500 → 1,700, NFL 900 → 1,100); soccer's Captains and Dynasty fell to 35% when
  // packs-1 moved Standout quick-sell under Hot Season (2,300 → 1,450, 4,300 → 2,700). Saved recipes keep
  // the price they were awarded at (snapshots).
  // Claude (packs-3, audit H2): no Club Collection pack sells a Weekly Standout for less than the Standout
  // Guarantee does (floorPrice), so Captains and Dynasty rose: NBA 2,400 → 2,500 and 4,400 → 4,800, NFL
  // 1,000 → 1,200 and 1,900 → 2,200, soccer 1,450 → 1,700 and 2,700 → 3,200.
  // Claude (packs-3 review fixes, audit H2): that floor still charged a Standout only part of the Standout
  // Guarantee's price, so Dynasty sold two for less than two Guarantees. Each Standout now costs the full
  // Guarantee price, and Captains and Dynasty are chase items at their floor (packs.md "packs-3 review
  // fixes"): NBA 4,300 and 8,400, NFL 2,600 and 4,900, soccer 3,200 and 6,200.
  const prices = {
    nba: [1700, 4300, 8400],
    nfl: [1100, 2600, 4900],
    soccer: [1100, 3200, 6200],
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
/**
 * Claude (packs-3, audit H2): what one card of each recipe tier is worth in a Club Collection pack's
 * minimum price. `silver`, `gold` and `rare` are a slot's mean quick-sell value (value.ts slotQs: a silver,
 * a gold, a gold 78+); `standout` is the Standout Guarantee's whole price (CONTENT_PRICES.standout), so a
 * Club Collection pack never sells a Standout for less than the Guarantee asks for one (review fix: it was
 * the Guarantee's price less its golds' value ÷ 0.6, NBA 1,196, NFL 428, soccer 883). The exploits suite
 * pins these to the live definitions (the numbers live here, not imported, because packs.ts imports this
 * module).
 */
export const STUDIO_VALUE: Record<
  UtSport,
  Record<(typeof STUDIO_TIERS)[number], number>
> = {
  nba: { silver: 61, gold: 151, rare: 159, standout: 3000 },
  nfl: { silver: 21.4, gold: 53.6, rare: 56.8, standout: 1800 },
  soccer: { silver: 42.8, gold: 89.6, rare: 93.1, standout: 2400 },
};
/** The share of its quick-sell value a pack's price may not go under (a pack returns at most 60%). */
export const STUDIO_EV_MAX = 0.6;
/**
 * The least a Club Collection pack may cost (packs-plan packs-3 item 4): each Standout at the Standout
 * Guarantee's whole price, plus the rest at their quick-sell value ÷ 0.6, rounded up to 100 coins. A live
 * catalog priced below it still loads, at this price; the Store Packs editor shows it and refuses to
 * publish under it. A pack with a Standout is therefore a chase item (it returns about a quarter of its
 * price; the 0.45–0.60 band and this floor can't both hold, packs.md); one without stays in the band.
 */
export function floorPrice(
  sport: UtSport,
  counts: StudioPack["counts"],
): number {
  const v = STUDIO_VALUE[sport];
  const rest =
    (counts.silver * v.silver + counts.gold * v.gold + counts.rare * v.rare) /
    STUDIO_EV_MAX;
  return Math.max(
    500,
    Math.ceil((counts.standout * v.standout + rest) / 100) * 100,
  );
}
export function catalogOf(sport: UtSport): Catalog {
  return catalogs[sport] ?? defaultCatalog(sport);
}
/** Claude (packs-3): the packs of a catalog priced under their floorPrice (the editor refuses to publish them). */
export function belowFloor(catalog: Catalog, sport: UtSport): StudioKind[] {
  return STUDIO_PACKS.filter(
    (k) => catalog[k].price < floorPrice(sport, catalog[k].counts),
  );
}
/**
 * A catalog's packs, checked; with `sport`, each price is raised to its floorPrice (packs-3), so a catalog
 * published before the floor existed (or below it) still loads and never undercuts the Standout Guarantee.
 */
export function checkedCatalog(raw: unknown, sport?: UtSport): Catalog | null {
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
      price: sport
        ? Math.min(100000, Math.max(p.price, floorPrice(sport, counts)))
        : p.price,
      enabled: p.enabled,
      counts,
    };
  }
  return out;
}
export function setCatalog(sport: UtSport, catalog: Catalog) {
  const checked = checkedCatalog(catalog, sport);
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
