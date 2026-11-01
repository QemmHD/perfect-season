// Claude, 2026-11-01 (wave 2): card variants derived from another edition, resolved lazily like the
// Standout and Landmark editions (pool.ts):
//   `holo~<card id>`                      a holographic copy: the same stats, a holo shine, more Item
//                                         Score. Only special editions (Standout, Hot Season,
//                                         Landmark, Legend) drop as holo, from packs, never from
//                                         fixed picks or rewards.
//   `evo~<evo+evo>~<card id>`             an owned copy upgraded by Evolutions (evolutions.ts). The
//                                         owned copy keeps its card id; this is how it plays and shows.
// Both rate their base edition, then add their own changes (rate.ts routes `variantOf` here).
import { applyEvos } from './evolutions';
import { rateCard } from './rate';
import type { CardLine, RatedCard } from './types';

export const HOLO_CHANCE = 0.04;
export const HOLO_TIERS = new Set(['standout', 'promo', 'landmark', 'legend']);

export const holoId = (cardId: string) => 'holo~' + cardId;
export const isVariantId = (id: string) => id.startsWith('holo~') || id.startsWith('evo~');

/** The base id of a variant id, and what it adds. */
export function parseVariant(id: string): { base: string; holo?: true; evo?: string[] } | null {
  if (id.startsWith('holo~')) {
    const base = id.slice(5);
    return base && !base.startsWith('holo~') ? { base, holo: true } : null;
  }
  if (id.startsWith('evo~')) {
    const i = id.indexOf('~', 4);
    if (i < 0) return null;
    const evo = id.slice(4, i).split('+').filter(Boolean);
    const base = id.slice(i + 1);
    return evo.length && base && !base.startsWith('evo~') ? { base, evo } : null;
  }
  return null;
}

/** The variant's line from its base line (found by `lineOf`, which resolves editions too). */
export function deriveVariantLine(id: string, lineOf: (id: string) => CardLine | undefined): CardLine | null {
  const v = parseVariant(id);
  if (!v) return null;
  const base = lineOf(v.base);
  if (!base) return null;
  return { ...base, id, variantOf: base, ...(v.holo ? { holo: true } : {}), ...(v.evo ? { evo: v.evo } : {}) };
}

export function rateVariant(line: CardLine, level = 1, pos?: string): RatedCard {
  const base = rateCard(line.variantOf!, level, pos);
  const rc: RatedCard = { ...base, line };
  return line.evo?.length ? applyEvos(rc, line.evo) : rc;
}
