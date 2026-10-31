// Implemented by Codex. Public same-season Madden benchmark -> our playable attribute vocabulary.
import { groupOf } from '../game/football2/ratings';
import { profileQuality } from './rating-quality';
import type { CardLine } from './types';

export function calibrateNflReference(line: CardLine, pos: string, overall: number, raw: Record<string, number>) {
  const ref = line.ratingReference;
  const attrs = { ...raw };
  if (ref) {
    for (const [code, value] of Object.entries(ref.attrs)) {
      if (!(code in attrs)) continue;
      // Physical measurements must not be inferred from yards/TDs. Position skills keep a small season-stat contribution.
      const weight = ['SPD', 'ACC', 'AGI', 'STR', 'THP'].includes(code) ? 1 : 0.85;
      attrs[code] = Math.max(1, Math.min(99, Math.round(value * weight + attrs[code] * (1 - weight))));
    }
    if (groupOf(pos) === groupOf(line.pos[0])) overall = ref.ovr * 0.9 + overall * 0.1;
  }
  return { attrs, ovr: Math.round(Math.min(overall, profileQuality('nfl', pos, attrs) + 5)), source: ref?.source };
}
