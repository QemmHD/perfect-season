// Claude, 2026-11-01 (wave 2): the Preview Pack (EA FC 27 has them): see exactly what a Premium
// Gold pack holds before buying. The contents come from a per-player seed and the preview's number,
// so a reload shows the same cards (no rerolls). Buying gets exactly those cards and unlocks the next
// preview at once; skipping moves on to the next preview after a cooldown.
import { contentOf } from './content-state';
import { openPack } from './packs';
import type { Pool } from './pool';
import type { UtState } from './state';
import type { RatedCard } from './types';

export const PREVIEW_KIND = 'premium';
export const PREVIEW_COOLDOWN_MS = 60 * 60 * 1000;

/** The state with a preview seed (made once, from `seed`, before the first preview shows). */
export function withPreviewSeed(ut: UtState, seed: string): UtState {
  const c = contentOf(ut);
  return c.preview ? ut : { ...ut, content: { ...c, preview: { seed, n: 0 } } };
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

/** The current preview's cards (the same every time until it is bought or skipped). */
export function previewCards(pool: Pool, ut: UtState, week: string): RatedCard[] {
  const id = previewId(ut);
  return id ? openPack(pool, PREVIEW_KIND, id, week) : [];
}

/** Bought: the next preview is ready now. Skipped: the next one after the cooldown. */
export function nextPreview(ut: UtState, bought: boolean, at: number): UtState {
  const c = contentOf(ut);
  if (!c.preview) return ut;
  const { until: _u, ...rest } = c.preview;
  void _u;
  return { ...ut, content: { ...c, preview: { ...rest, n: c.preview.n + 1, ...(bought ? {} : { until: at + PREVIEW_COOLDOWN_MS }) } } };
}
