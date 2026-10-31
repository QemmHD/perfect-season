// Codex: isolated AI season form changes actual attributes; canonical cards stay untouched.
import { profileQuality } from './rating-quality';
import type { RatedCard } from './types';
export function withLeagueForm(rc: RatedCard, boost: number): RatedCard {
  const delta = Math.max(-10, Math.min(10, boost));
  if (!delta) return rc;
  const attrs = Object.fromEntries(
    Object.entries(rc.attrs).map(([k, v]) => [
      k,
      Math.max(1, Math.min(110, Math.round(v + delta)))
    ])
  );
  const ovr = Math.max(
    1,
    Math.min(
      110,
      Math.round(rc.ovr + delta),
      Math.round(profileQuality(rc.line.sport, rc.pos, attrs) + 10)
    )
  );
  return {
    ...rc,
    attrs,
    ovr,
    key: rc.key.map(([code, label]) => [code, label, attrs[code] ?? ovr])
  };
}
