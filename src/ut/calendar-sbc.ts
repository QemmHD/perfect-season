// Claude, 2026-11-01 (wave 3): the Live Calendar's SBCs on the SBC tab ("This Season"): each season
// SBC whose window includes the day. Repeatable ones count their completions in ut.content.claims
// (`sbc:cal:<id>:<k>`); the Finale ("The Perfect Season") is the only way to a 98–99 card. Overall
// requirements are written on the FC-style scale (fc-scale.ts).
import { per, promoById, sbcsOn } from './calendar';
import { contentOf } from './content-state';
import { resolvePackKind } from './live-packs';
import type { Pool } from './pool';
import { fcToDisplay } from './fc-scale';
import type { Req, Sbc } from './sbc';
import type { UtState } from './state';

export function calendarSbcs(pool: Pool, ut: UtState, day: string): Sbc[] {
  const sport = pool.sport;
  const claims = contentOf(ut).claims ?? [];
  return sbcsOn(day).flatMap((b) => {
    const raw = (Array.isArray(b.reqs) ? b.reqs : per(b.reqs as Record<string, unknown[]>, sport)) as Req[] | undefined;
    const name = per(b.name, sport);
    if (!raw || !name) return [];
    const reqs: Req[] = raw.map((r) => (r.k === 'teamOvr' || r.k === 'minOvr' ? { ...r, ovr: fcToDisplay(r.ovr, sport) } : r));
    const prefix = 'cal:' + b.id + ':';
    const done = claims.filter((c) => c.startsWith('sbc:' + prefix)).length;
    let key: string;
    let left: number | undefined;
    if (b.repeat === 'daily') key = day;
    else {
      const times = typeof b.repeat === 'number' ? b.repeat : 1;
      key = String(Math.min(done, times - 1));
      left = Math.max(0, times - done);
    }
    const promo = b.reward.card ? promoById(b.reward.card) : null;
    const reward = b.reward.card
      ? { program: b.reward.card, programName: per(promo?.name, sport) ?? 'program', ...(b.reward.featured ? { programFeatured: true } : {}) }
      : b.reward.pack
        ? { pack: resolvePackKind(b.reward.pack, day) }
        : {};
    return [
      {
        id: prefix + key,
        kind: 'program' as const,
        title: name,
        blurb: (b.season.name + ' · ' + (promo ? per(promo.name, sport) : '')).replace(/ · $/, '') + (left !== undefined && left > 1 ? ' · repeatable ×' + left : ''),
        size: b.size,
        reqs,
        reward,
        ...(left !== undefined ? { left: Math.max(1, left) } : {}),
      },
    ];
  });
}
