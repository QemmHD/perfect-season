// Claude, 2026-11-01 (wave 2): the Preview Pack (EA FC 27 has them): see exactly what a Premium
// Gold pack holds before buying. The contents come from a per-player seed and the preview's number,
// so a reload shows the same cards (no rerolls).
// Claude (packs-3, audit H1): the next preview comes 24 hours after a buy or a skip. Before, a buy unlocked
// the next preview at once and a skip after an hour, so a player checking hourly saw 24 Premiums a day and
// bought only the ones with a special (about 48 specials in 30 days, measured). A preview is also bound to
// the week it was made in (`preview.wk`), so its Weekly Standout slot shows the same cards across the
// Monday rollover instead of changing under the player.
import { contentOf } from './content-state';
import { openPack } from './packs';
import type { Pool } from './pool';
import type { UtState } from './state';
import type { RatedCard } from './types';

export const PREVIEW_KIND = 'premium';
export const PREVIEW_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** The state with a preview seed (made once, from `seed`, before the first preview shows), bound to `week`. */
export function withPreviewSeed(ut: UtState, seed: string, week?: string): UtState {
  const c = contentOf(ut);
  return c.preview ? ut : { ...ut, content: { ...c, preview: { seed, n: 0, ...(week ? { wk: week } : {}) } } };
}

export function previewStatus(ut: UtState, at: number): { ready: boolean; minutesLeft: number; n: number } {
  const p = contentOf(ut).preview;
  const left = p?.until ? Math.max(0, p.until - at) : 0;
  return { ready: !!p && left === 0, minutesLeft: Math.ceil(left / 60000), n: p?.n ?? 0 };
}

/** The pack id of the current preview (its cards' uids are `pack:<id>:<i>`). */
export function previewId(ut: UtState): string | null {
  const p = contentOf(ut).preview;
  return p ? 'preview-' + p.seed + '-' + p.n : null;
}

/** The week a preview's Standout slot draws from: the one it was made in (an old save's adopts `week`). */
export function previewWeek(ut: UtState, week: string): string {
  return contentOf(ut).preview?.wk ?? week;
}

/** The current preview's cards (the same every time until it is bought or skipped). */
export function previewCards(pool: Pool, ut: UtState, week: string): RatedCard[] {
  const id = previewId(ut);
  return id ? openPack(pool, PREVIEW_KIND, id, previewWeek(ut, week)) : [];
}

/** Bought or skipped: the next preview, ready 24 hours later and bound to `week`, the week it is made in. */
export function nextPreview(ut: UtState, _bought: boolean, at: number, week?: string): UtState {
  const c = contentOf(ut);
  if (!c.preview) return ut;
  const { wk: _w, ...rest } = c.preview;
  void _w;
  return { ...ut, content: { ...c, preview: { ...rest, n: c.preview.n + 1, until: at + PREVIEW_COOLDOWN_MS, ...(week ? { wk: week } : {}) } } };
}
